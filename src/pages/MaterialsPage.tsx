import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Boxes, Users, CalendarDays, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// ─── Fase 1: Ocupación de materiales por turno ──────────────────────────────
// Lee los turnos del Modo Sala y, para un día, muestra los ejercicios de cada
// turno agrupados por bloque, con cuántos alumnos usan cada uno (para detectar
// embotellamiento). NO modifica nada del Modo Sala ni del registro.

type OccItem = { block: number; name: string; count: number; categoryId: string | null };

export default function MaterialsPage() {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedTurno, setSelectedTurno] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>(""); // "" = todas
  const [showMembers, setShowMembers] = useState(false); // desplegar lista de alumnos del turno

  const { data: categories } = useQuery({
    queryKey: ["exercise-categories"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("exercise_categories").select("id, name").order("name");
      return (data ?? []) as { id: string; name: string }[];
    },
  });

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
    queryFn: async (): Promise<{ memberCount: number; memberList: { id: string; name: string }[]; items: OccItem[] }> => {
      // 1. Alumnos del turno
      const { data: members } = await (supabase as any)
        .from("kiosk_group_members")
        .select("clients(id, name)")
        .eq("kiosk_group_id", selectedTurno);
      const memberList: { id: string; name: string }[] = (members ?? [])
        .map((m: any) => ({ id: m.clients?.id, name: m.clients?.name ?? "—" }))
        .filter((m: any) => m.id)
        .sort((a: any, b: any) => a.name.localeCompare(b.name));
      const clientIds: string[] = memberList.map(m => m.id);
      if (!clientIds.length) return { memberCount: 0, memberList: [], items: [] };

      // 2. Entrenamientos del día para esos alumnos
      const { data: workouts } = await supabase
        .from("assigned_workouts")
        .select("id, client_id, routine_id, day_number")
        .eq("workout_date", date)
        .in("client_id", clientIds);
      if (!workouts?.length) return { memberCount: clientIds.length, memberList, items: [] };

      const workoutIds = workouts.map((w: any) => w.id);
      const workoutClient = new Map<string, string>(workouts.map((w: any) => [w.id, w.client_id]));

      // 3. Ejercicios modificados (overrides) de esos entrenamientos
      const { data: overrides } = await supabase
        .from("assigned_workout_exercises")
        .select("assigned_workout_id, block_number, exercises(name, category_id)")
        .in("assigned_workout_id", workoutIds);

      // 4. Entrenamientos sin overrides → ejercicios de la rutina base
      const withOverride = new Set((overrides ?? []).map((o: any) => o.assigned_workout_id));
      const missing = workouts.filter((w: any) => !withOverride.has(w.id) && w.routine_id);
      const routineIds = [...new Set(missing.map((w: any) => w.routine_id))];
      let baseEx: any[] = [];
      if (routineIds.length) {
        const { data: base } = await supabase
          .from("routine_exercises")
          .select("routine_id, day_number, block_number, exercises(name, category_id)")
          .in("routine_id", routineIds as string[]);
        baseEx = base ?? [];
      }

      // 5. Lista unificada {block, exerciseName, clientId, categoryId}
      const rows: { block: number; name: string; clientId: string; categoryId: string | null }[] = [];
      for (const o of (overrides ?? []) as any[]) {
        rows.push({
          block: o.block_number ?? 1,
          name: o.exercises?.name ?? "—",
          clientId: workoutClient.get(o.assigned_workout_id) ?? "",
          categoryId: o.exercises?.category_id ?? null,
        });
      }
      for (const w of missing as any[]) {
        const base = baseEx.filter(
          (b) => b.routine_id === w.routine_id && (b.day_number ?? 1) === (w.day_number ?? 1)
        );
        for (const b of base) {
          rows.push({ block: b.block_number ?? 1, name: b.exercises?.name ?? "—", clientId: w.client_id, categoryId: b.exercises?.category_id ?? null });
        }
      }

      // 6. Contar alumnos distintos por (bloque, ejercicio) y ordenar por demanda
      const byKey = new Map<string, { block: number; name: string; categoryId: string | null; set: Set<string> }>();
      for (const r of rows) {
        const key = `${r.block}__${r.name}`;
        if (!byKey.has(key)) byKey.set(key, { block: r.block, name: r.name, categoryId: r.categoryId, set: new Set() });
        byKey.get(key)!.set.add(r.clientId);
      }
      const items: OccItem[] = [...byKey.values()]
        .map(v => ({ block: v.block, name: v.name, count: v.set.size, categoryId: v.categoryId }))
        .sort((a, b) => b.count - a.count || a.block - b.block || a.name.localeCompare(b.name));

      return { memberCount: clientIds.length, memberList, items };
    },
  });

  // Color según congestión: 1 = ok, 2 = medio, 3+ = alto
  const barColor = (count: number) =>
    count >= 3 ? "bg-destructive" : count === 2 ? "bg-amber-400" : "bg-primary/70";
  const textColor = (count: number) =>
    count >= 3 ? "text-destructive" : count === 2 ? "text-amber-500" : "text-muted-foreground";

  const items = (overview?.items ?? []).filter(i => !filterCategory || i.categoryId === filterCategory);
  const maxCount = Math.max(1, ...items.map(i => i.count));
  const hotspots = items.filter(i => i.count >= 3);
  const watch = items.filter(i => i.count === 2);

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Boxes className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-heading font-bold">Materiales</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
          >
            <option value="">Todas las categorías</option>
            {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-40 h-9" />
          </div>
        </div>
      </div>
      <p className="text-muted-foreground mb-4 text-sm">
        Qué ejercicios se van a usar más en cada turno ese día — para evitar que se junten en el mismo material.
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
            <button
              type="button"
              onClick={() => setShowMembers(v => !v)}
              disabled={!overview?.memberList?.length}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-secondary transition-colors disabled:hover:bg-transparent disabled:cursor-default normal-case"
              title="Ver alumnos del turno"
            >
              <Users className="h-3.5 w-3.5" />
              {overview?.memberCount ?? 0} alumnos
              {!!overview?.memberList?.length && (
                showMembers ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          {/* Lista de alumnos del turno (desplegable) */}
          {showMembers && !!overview?.memberList?.length && (
            <div className="mb-4 bg-card border border-border rounded-xl p-3">
              <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2">Alumnos del turno</p>
              <div className="flex flex-wrap gap-1.5">
                {overview.memberList.map(m => (
                  <span key={m.id} className="inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-foreground">
                    {m.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Cargando...</p>
          ) : !items.length ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {filterCategory && (overview?.items.length ?? 0) > 0
                ? "No hay ejercicios de esa categoría en este turno/día."
                : "Este turno no tiene entrenamientos asignados para este día."}
            </p>
          ) : (
            <div className="space-y-4">
              {/* Alerta de puntos calientes */}
              {hotspots.length > 0 ? (
                <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3">
                  <p className="text-sm font-bold text-destructive flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" />
                    {hotspots.length} {hotspots.length === 1 ? "punto" : "puntos"} de posible embotellamiento
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {hotspots.map(h => `${h.name} (${h.count})`).join(" · ")}
                  </p>
                </div>
              ) : watch.length > 0 ? (
                <div className="bg-amber-400/10 border border-amber-400/30 rounded-xl p-3">
                  <p className="text-sm font-semibold text-amber-500">Ojo con: {watch.map(h => `${h.name} (${h.count})`).join(" · ")}</p>
                </div>
              ) : (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
                  <p className="text-sm font-semibold text-primary flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" />Sin embotellamientos previstos</p>
                </div>
              )}

              {/* Ranking con barras — el más pedido arriba */}
              <div className="bg-card border border-border rounded-xl divide-y divide-border/60 overflow-hidden">
                {items.map((it, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-medium text-foreground truncate">{it.name}</span>
                        <span className={`text-sm font-bold shrink-0 ${textColor(it.count)}`}>
                          {it.count} <span className="text-[10px] font-normal text-muted-foreground">alumno{it.count > 1 ? "s" : ""}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                          <div className={`h-full rounded-full ${barColor(it.count)}`} style={{ width: `${(it.count / maxCount) * 100}%` }} />
                        </div>
                        <span className="text-[9px] text-muted-foreground shrink-0">Bloque {it.block}</span>
                      </div>
                    </div>
                  </div>
                ))}
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
