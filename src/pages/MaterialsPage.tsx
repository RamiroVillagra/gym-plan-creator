import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Boxes, Users, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// ─── Fase 1: Ocupación de materiales por turno ──────────────────────────────
// Lee los turnos del Modo Sala y, para un día, muestra los ejercicios de cada
// turno agrupados por bloque, con cuántos alumnos usan cada uno (para detectar
// embotellamiento). NO modifica nada del Modo Sala ni del registro.

type BlockOverview = { block: number; exercises: { name: string; count: number }[] };

export default function MaterialsPage() {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedTurno, setSelectedTurno] = useState<string>("");

  const { data: turnos } = useQuery({
    queryKey: ["kiosk-groups"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("kiosk_groups").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  useEffect(() => {
    if (!selectedTurno && turnos?.length) setSelectedTurno(turnos[0].id);
  }, [turnos, selectedTurno]);

  const { data: overview, isLoading } = useQuery({
    queryKey: ["materials-overview", selectedTurno, date],
    enabled: !!selectedTurno,
    queryFn: async (): Promise<{ memberCount: number; blocks: BlockOverview[] }> => {
      // 1. Alumnos del turno
      const { data: members } = await (supabase as any)
        .from("kiosk_group_members")
        .select("clients(id, name)")
        .eq("kiosk_group_id", selectedTurno);
      const clientIds: string[] = (members ?? [])
        .map((m: any) => m.clients?.id)
        .filter(Boolean);
      if (!clientIds.length) return { memberCount: 0, blocks: [] };

      // 2. Entrenamientos del día para esos alumnos
      const { data: workouts } = await supabase
        .from("assigned_workouts")
        .select("id, client_id, routine_id, day_number")
        .eq("workout_date", date)
        .in("client_id", clientIds);
      if (!workouts?.length) return { memberCount: clientIds.length, blocks: [] };

      const workoutIds = workouts.map((w: any) => w.id);
      const workoutClient = new Map<string, string>(workouts.map((w: any) => [w.id, w.client_id]));

      // 3. Ejercicios modificados (overrides) de esos entrenamientos
      const { data: overrides } = await supabase
        .from("assigned_workout_exercises")
        .select("assigned_workout_id, block_number, exercises(name)")
        .in("assigned_workout_id", workoutIds);

      // 4. Entrenamientos sin overrides → ejercicios de la rutina base
      const withOverride = new Set((overrides ?? []).map((o: any) => o.assigned_workout_id));
      const missing = workouts.filter((w: any) => !withOverride.has(w.id) && w.routine_id);
      const routineIds = [...new Set(missing.map((w: any) => w.routine_id))];
      let baseEx: any[] = [];
      if (routineIds.length) {
        const { data: base } = await supabase
          .from("routine_exercises")
          .select("routine_id, day_number, block_number, exercises(name)")
          .in("routine_id", routineIds as string[]);
        baseEx = base ?? [];
      }

      // 5. Lista unificada {block, exerciseName, clientId}
      const rows: { block: number; name: string; clientId: string }[] = [];
      for (const o of (overrides ?? []) as any[]) {
        rows.push({
          block: o.block_number ?? 1,
          name: o.exercises?.name ?? "—",
          clientId: workoutClient.get(o.assigned_workout_id) ?? "",
        });
      }
      for (const w of missing as any[]) {
        const base = baseEx.filter(
          (b) => b.routine_id === w.routine_id && (b.day_number ?? 1) === (w.day_number ?? 1)
        );
        for (const b of base) {
          rows.push({ block: b.block_number ?? 1, name: b.exercises?.name ?? "—", clientId: w.client_id });
        }
      }

      // 6. Agrupar por bloque → ejercicio → alumnos distintos
      const blockMap = new Map<number, Map<string, Set<string>>>();
      for (const r of rows) {
        if (!blockMap.has(r.block)) blockMap.set(r.block, new Map());
        const exMap = blockMap.get(r.block)!;
        if (!exMap.has(r.name)) exMap.set(r.name, new Set());
        exMap.get(r.name)!.add(r.clientId);
      }
      const blocks: BlockOverview[] = [...blockMap.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([block, exMap]) => ({
          block,
          exercises: [...exMap.entries()]
            .map(([name, set]) => ({ name, count: set.size }))
            .sort((a, b) => b.count - a.count),
        }));

      return { memberCount: clientIds.length, blocks };
    },
  });

  // Color según congestión: 1 = ok, 2 = medio, 3+ = alto
  const congestionClass = (count: number) =>
    count >= 3
      ? "bg-destructive/15 border-destructive/40 text-destructive"
      : count === 2
      ? "bg-amber-400/15 border-amber-400/40 text-amber-500"
      : "bg-primary/10 border-primary/25 text-primary";

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Boxes className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-heading font-bold">Materiales</h1>
        </div>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-40 h-9" />
        </div>
      </div>
      <p className="text-muted-foreground mb-4 text-sm">
        Ocupación por turno: cuántos alumnos usan cada ejercicio ese día, agrupado por bloque.
      </p>

      {/* Turnos como pestañas */}
      {!turnos?.length ? (
        <p className="text-sm text-muted-foreground">No hay turnos creados. Creá turnos en Modo Sala → Gestionar Turnos.</p>
      ) : (
        <>
          <div className="flex gap-1 mb-5 flex-wrap">
            {turnos.map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedTurno(t.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  selectedTurno === t.id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>

          {/* Encabezado del turno */}
          <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground capitalize">
            <span className="font-medium text-foreground">{format(new Date(date + "T12:00:00"), "EEEE d 'de' MMMM", { locale: es })}</span>
            <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{overview?.memberCount ?? 0} alumnos</span>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Cargando...</p>
          ) : !overview?.blocks.length ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Este turno no tiene entrenamientos asignados para este día.
            </p>
          ) : (
            <div className="space-y-4">
              {overview.blocks.map(b => (
                <div key={b.block} className="bg-card border border-border rounded-xl p-4">
                  <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-2">Bloque {b.block}</p>
                  <div className="flex flex-wrap gap-2">
                    {b.exercises.map((ex, i) => (
                      <span
                        key={i}
                        className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border ${congestionClass(ex.count)}`}
                      >
                        {ex.name}
                        <span className="text-[10px] font-bold rounded-full bg-background/60 px-1.5">{ex.count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-1">
                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary/60" /> 1 alumno</span>
                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> 2 alumnos</span>
                <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive" /> 3+ (posible embotellamiento)</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Fase 2 (staging, oculto) ─────────────────────────────────────────
          El esquema para materiales ya existe (tablas `materials` y
          `exercise_materials`). En la Fase 2, este mismo agregado se hará por
          MATERIAL (no por ejercicio) y se comparará la demanda contra el stock
          (`materials.quantity`) para marcar "alcanza / no alcanza".
          Placeholder intencional — no renderiza nada todavía. */}
    </div>
  );
}
