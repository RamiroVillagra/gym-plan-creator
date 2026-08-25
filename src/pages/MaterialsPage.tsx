import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Boxes, Users, CalendarDays, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Package, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";

// ─── Fase 1: Ocupación de materiales por turno ──────────────────────────────
// Lee los turnos del Modo Sala y, para un día, muestra los ejercicios de cada
// turno agrupados por bloque, con cuántos alumnos usan cada uno (para detectar
// embotellamiento). NO modifica nada del Modo Sala ni del registro.

type OccItem = { block: number; name: string; count: number; categoryId: string | null };
// Demanda de un material en un bloque del turno vs. stock disponible (Fase 2 · Paso 4)
type MatItem = { block: number; materialId: string; name: string; demand: number; stock: number };

export default function MaterialsPage() {
  const [mainView, setMainView] = useState<"ocupacion" | "inventario">("ocupacion");
  const [occView, setOccView] = useState<"ejercicio" | "material">("ejercicio"); // sub-vista de Ocupación
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
    queryFn: async (): Promise<{ memberCount: number; memberList: { id: string; name: string }[]; items: OccItem[]; matItems: MatItem[] }> => {
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
      if (!clientIds.length) return { memberCount: 0, memberList: [], items: [], matItems: [] };

      // 2. Entrenamientos del día para esos alumnos
      const { data: workouts } = await supabase
        .from("assigned_workouts")
        .select("id, client_id, routine_id, day_number")
        .eq("workout_date", date)
        .in("client_id", clientIds);
      if (!workouts?.length) return { memberCount: clientIds.length, memberList, items: [], matItems: [] };

      const workoutIds = workouts.map((w: any) => w.id);
      const workoutClient = new Map<string, string>(workouts.map((w: any) => [w.id, w.client_id]));

      // 3. Ejercicios modificados (overrides) de esos entrenamientos
      const { data: overrides } = await supabase
        .from("assigned_workout_exercises")
        .select("assigned_workout_id, block_number, exercise_id, exercises(name, category_id)")
        .in("assigned_workout_id", workoutIds);

      // 4. Entrenamientos sin overrides → ejercicios de la rutina base
      const withOverride = new Set((overrides ?? []).map((o: any) => o.assigned_workout_id));
      const missing = workouts.filter((w: any) => !withOverride.has(w.id) && w.routine_id);
      const routineIds = [...new Set(missing.map((w: any) => w.routine_id))];
      let baseEx: any[] = [];
      if (routineIds.length) {
        const { data: base } = await supabase
          .from("routine_exercises")
          .select("routine_id, day_number, block_number, exercise_id, exercises(name, category_id)")
          .in("routine_id", routineIds as string[]);
        baseEx = base ?? [];
      }

      // 5. Lista unificada {block, exerciseId, exerciseName, clientId, categoryId}
      const rows: { block: number; exerciseId: string | null; name: string; clientId: string; categoryId: string | null }[] = [];
      for (const o of (overrides ?? []) as any[]) {
        rows.push({
          block: o.block_number ?? 1,
          exerciseId: o.exercise_id ?? null,
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
          rows.push({ block: b.block_number ?? 1, exerciseId: b.exercise_id ?? null, name: b.exercises?.name ?? "—", clientId: w.client_id, categoryId: b.exercises?.category_id ?? null });
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

      // 7. Demanda por material (Fase 2 · Paso 4): mapeo ejercicio→materiales y stock.
      const exerciseIds = [...new Set(rows.map(r => r.exerciseId).filter(Boolean) as string[])];
      let matItems: MatItem[] = [];
      if (exerciseIds.length) {
        const [{ data: exMats }, { data: mats }] = await Promise.all([
          (supabase as any).from("exercise_materials").select("exercise_id, material_id, quantity").in("exercise_id", exerciseIds),
          (supabase as any).from("materials").select("id, name, quantity"),
        ]);
        const matById = new Map<string, { name: string; stock: number }>(
          (mats ?? []).map((m: any) => [m.id, { name: m.name, stock: m.quantity ?? 0 }])
        );
        // exerciseId -> [{materialId, units}]
        const exToMats = new Map<string, { materialId: string; units: number }[]>();
        for (const em of (exMats ?? []) as any[]) {
          if (!exToMats.has(em.exercise_id)) exToMats.set(em.exercise_id, []);
          exToMats.get(em.exercise_id)!.push({ materialId: em.material_id, units: em.quantity ?? 1 });
        }
        // Por (bloque, material): unidades que ocupa cada alumno = máx entre sus ejercicios del bloque.
        // Demanda del bloque = suma de las unidades por alumno (evita contar dos veces al mismo alumno).
        const perStudent = new Map<string, Map<string, number>>(); // key block__material -> (clientId -> units)
        for (const r of rows) {
          if (!r.exerciseId) continue;
          const usage = exToMats.get(r.exerciseId);
          if (!usage) continue;
          for (const u of usage) {
            const key = `${r.block}__${u.materialId}`;
            if (!perStudent.has(key)) perStudent.set(key, new Map());
            const sm = perStudent.get(key)!;
            sm.set(r.clientId, Math.max(sm.get(r.clientId) ?? 0, u.units));
          }
        }
        matItems = [...perStudent.entries()].map(([key, sm]) => {
          const [blockStr, materialId] = key.split("__");
          const info = matById.get(materialId);
          const demand = [...sm.values()].reduce((a, b) => a + b, 0);
          return { block: Number(blockStr), materialId, name: info?.name ?? "—", demand, stock: info?.stock ?? 0 };
        }).sort((a, b) => (b.demand - b.stock) - (a.demand - a.stock) || b.demand - a.demand || a.block - b.block);
      }

      return { memberCount: clientIds.length, memberList, items, matItems };
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

  // Vista por material (Paso 4): demanda vs stock
  const matItems = overview?.matItems ?? [];
  const matShortages = matItems.filter(m => m.demand > m.stock);
  const maxMatDemand = Math.max(1, ...matItems.map(m => Math.max(m.demand, m.stock)));

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Boxes className="h-7 w-7 text-primary" />
          <h1 className="text-3xl font-heading font-bold">Materiales</h1>
        </div>
        {mainView === "ocupacion" && (
          <div className="flex items-center gap-2 flex-wrap">
            {occView === "ejercicio" && (
              <select
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
              >
                <option value="">Todas las categorías</option>
                {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-40 h-9" />
            </div>
          </div>
        )}
      </div>

      {/* Toggle de vista: Ocupación (Fase 1) / Inventario (Fase 2) */}
      <div className="flex gap-1 mb-4 bg-secondary/60 p-1 rounded-lg w-fit">
        <button
          onClick={() => setMainView("ocupacion")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            mainView === "ocupacion" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="h-4 w-4" /> Ocupación
        </button>
        <button
          onClick={() => setMainView("inventario")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            mainView === "inventario" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Package className="h-4 w-4" /> Inventario
        </button>
      </div>

      {mainView === "inventario" ? (
        <InventoryManager />
      ) : (
      <>
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

          {/* Sub-toggle: por ejercicio / por material */}
          <div className="flex gap-1 mb-4 bg-secondary/60 p-1 rounded-lg w-fit">
            <button
              onClick={() => setOccView("ejercicio")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                occView === "ejercicio" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Por ejercicio
            </button>
            <button
              onClick={() => setOccView("material")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                occView === "material" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Por material
            </button>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Cargando...</p>
          ) : occView === "material" ? (
            !matItems.length ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Sin datos de materiales. Asigná materiales a los ejercicios (en Ejercicios) y cargá stock en Inventario.
              </p>
            ) : (
              <div className="space-y-4">
                {/* Alerta de faltantes de material */}
                {matShortages.length > 0 ? (
                  <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3">
                    <p className="text-sm font-bold text-destructive flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4" />
                      {matShortages.length} {matShortages.length === 1 ? "material no alcanza" : "materiales no alcanzan"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {matShortages.map(m => `${m.name} (faltan ${m.demand - m.stock})`).join(" · ")}
                    </p>
                  </div>
                ) : (
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
                    <p className="text-sm font-semibold text-primary flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" />El material alcanza para todos los bloques</p>
                  </div>
                )}

                {/* Ranking de materiales: demanda vs stock */}
                <div className="bg-card border border-border rounded-xl divide-y divide-border/60 overflow-hidden">
                  {matItems.map((m, i) => {
                    const short = m.demand > m.stock;
                    return (
                      <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-sm font-medium text-foreground truncate">{m.name}</span>
                            <span className={`text-sm font-bold shrink-0 ${short ? "text-destructive" : "text-muted-foreground"}`}>
                              {m.demand}<span className="text-[10px] font-normal text-muted-foreground">/{m.stock}</span>
                              {short && <span className="ml-1 text-[10px] font-bold text-destructive">faltan {m.demand - m.stock}</span>}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                              <div className={`h-full rounded-full ${short ? "bg-destructive" : "bg-primary/70"}`} style={{ width: `${Math.min(100, (m.demand / maxMatDemand) * 100)}%` }} />
                            </div>
                            <span className="text-[9px] text-muted-foreground shrink-0">Bloque {m.block}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Demanda = alumnos que usan el material en ese bloque (× unidades) · el número chico es el stock disponible.
                </p>
              </div>
            )
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
      </>
      )}
    </div>
  );
}

// ─── Fase 2 · Paso 1: ABM del inventario de materiales ──────────────────────
// CRUD sobre la tabla `materials` (nombre + stock del gym + nota opcional).
// Es la base: en pasos siguientes se mapea cada ejercicio a sus materiales
// (`exercise_materials`) y se cruza la demanda por turno/bloque contra este stock.
type Material = { id: string; name: string; quantity: number; notes: string | null };

function InventoryManager() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editQty, setEditQty] = useState("1");

  const { data: materials, isLoading } = useQuery({
    queryKey: ["materials"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("materials").select("id, name, quantity, notes").order("name");
      if (error) throw error;
      return (data ?? []) as Material[];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["materials"] });

  const addMaterial = useMutation({
    mutationFn: async () => {
      const n = name.trim();
      if (!n) throw new Error("empty");
      const q = Math.max(0, parseInt(quantity) || 0);
      const { error } = await (supabase as any).from("materials").insert({ name: n, quantity: q });
      if (error) throw error;
    },
    onSuccess: () => { setName(""); setQuantity("1"); invalidate(); toast.success("Material agregado"); },
    onError: (e: any) => { if (e?.message !== "empty") toast.error("No se pudo agregar el material"); },
  });

  const updateMaterial = useMutation({
    mutationFn: async () => {
      const n = editName.trim();
      if (!editingId || !n) throw new Error("empty");
      const q = Math.max(0, parseInt(editQty) || 0);
      const { error } = await (supabase as any).from("materials").update({ name: n, quantity: q }).eq("id", editingId);
      if (error) throw error;
    },
    onSuccess: () => { setEditingId(null); invalidate(); toast.success("Material actualizado"); },
    onError: (e: any) => { if (e?.message !== "empty") toast.error("No se pudo actualizar"); },
  });

  const deleteMaterial = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("materials").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Material eliminado"); },
    onError: () => toast.error("No se pudo eliminar"),
  });

  const startEdit = (m: Material) => { setEditingId(m.id); setEditName(m.name); setEditQty(String(m.quantity)); };

  return (
    <div className="max-w-xl">
      <p className="text-muted-foreground mb-4 text-sm">
        El equipamiento del gimnasio y cuántas unidades hay de cada uno. Es la base para avisar,
        más adelante, cuándo un turno pide más material del disponible.
      </p>

      {/* Alta */}
      <form
        onSubmit={e => { e.preventDefault(); addMaterial.mutate(); }}
        className="flex items-end gap-2 mb-5 flex-wrap"
      >
        <div className="flex-1 min-w-[10rem]">
          <label className="text-[11px] font-medium text-muted-foreground block mb-1">Material</label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Barra, Rack, Banco" className="h-9" />
        </div>
        <div className="w-20">
          <label className="text-[11px] font-medium text-muted-foreground block mb-1">Cantidad</label>
          <Input type="number" min={0} value={quantity} onChange={e => setQuantity(e.target.value)} className="h-9" />
        </div>
        <button
          type="submit"
          disabled={!name.trim() || addMaterial.isPending}
          className="h-9 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Agregar
        </button>
      </form>

      {/* Lista */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Cargando...</p>
      ) : !materials?.length ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Todavía no cargaste materiales. Agregá el primero arriba.
        </p>
      ) : (
        <div className="bg-card border border-border rounded-xl divide-y divide-border/60 overflow-hidden">
          {materials.map(m => (
            <div key={m.id} className="flex items-center gap-3 px-3 py-2.5">
              {editingId === m.id ? (
                <>
                  <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-8 flex-1" autoFocus />
                  <Input type="number" min={0} value={editQty} onChange={e => setEditQty(e.target.value)} className="h-8 w-20" />
                  <button onClick={() => updateMaterial.mutate()} disabled={updateMaterial.isPending} title="Guardar" className="p-1.5 rounded-md hover:bg-secondary text-primary transition-colors">
                    <Check className="h-4 w-4" />
                  </button>
                  <button onClick={() => setEditingId(null)} title="Cancelar" className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 text-sm font-medium text-foreground truncate">{m.name}</span>
                  <span className="text-sm font-bold text-foreground shrink-0">
                    {m.quantity} <span className="text-[10px] font-normal text-muted-foreground">u.</span>
                  </span>
                  <button onClick={() => startEdit(m)} title="Editar" className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground transition-colors">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={async () => {
                      if (await confirm({ title: `¿Eliminar "${m.name}"?`, description: "Se quitará del inventario. Esta acción no se puede deshacer." })) {
                        deleteMaterial.mutate(m.id);
                      }
                    }}
                    title="Eliminar"
                    className="p-1.5 rounded-md hover:bg-secondary text-destructive transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
