import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Save, PlusCircle, History, ChevronUp, ChevronDown, Layers } from "lucide-react";
import { toast } from "sonner";
import { useState, useCallback } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface RoutineDetailViewProps {
  routineId?: string;
  routineName: string;
  totalDays: number;
  editable?: boolean;
  assignedWorkoutId?: string;
  clientId?: string;
  initialDay?: number;
}

export default function RoutineDetailView({ routineId = "", routineName, totalDays, editable = false, assignedWorkoutId, clientId, initialDay = 1 }: RoutineDetailViewProps) {
  const queryClient = useQueryClient();
  // Cuando hay un workout asignado con día específico, ese día es fijo
  const isFixedDay = !!assignedWorkoutId;
  const [selectedDay, setSelectedDay] = useState(initialDay);
  const [addExOpen, setAddExOpen] = useState(false);
  const [addExBlock, setAddExBlock] = useState(1);
  const [selectedExercises, setSelectedExercises] = useState<Set<string>>(new Set());
  const [sets, setSets] = useState("3");
  const [reps, setReps] = useState("10");
  const [weight, setWeight] = useState("");

  // Filtros del buscador
  const [filterCategory, setFilterCategory] = useState("");
  const [filterSearch, setFilterSearch] = useState("");

  const [createExOpen, setCreateExOpen] = useState(false);
  const [newExName, setNewExName] = useState("");
  const [newExCategoryId, setNewExCategoryId] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSets, setEditSets] = useState("");
  const [editReps, setEditReps] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editUnit, setEditUnit] = useState("kg");

  // Historial por ejercicio
  const [historyExerciseId, setHistoryExerciseId] = useState<string | null>(null);

  // Series progresivas (set_groups)
  const [editingGroupsId, setEditingGroupsId] = useState<string | null>(null);
  const [editingGroups, setEditingGroups] = useState<{ sets: string; reps: string; weight: string }[]>([]);

  const isOverrideMode = !!assignedWorkoutId;

  const { data: baseExercises } = useQuery({
    queryKey: ["routine-exercises", routineId],
    enabled: !!routineId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routine_exercises")
        .select("*, exercises(name, muscle_group)")
        .eq("routine_id", routineId)
        .order("day_number")
        .order("block_number")
        .order("order_index");
      if (error) throw error;
      return data;
    },
  });

  const { data: overrideExercises } = useQuery({
    queryKey: ["assigned-workout-exercises", assignedWorkoutId],
    enabled: isOverrideMode,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assigned_workout_exercises")
        .select("*, exercises(name, muscle_group)")
        .eq("assigned_workout_id", assignedWorkoutId!)
        .order("day_number")
        .order("block_number")
        .order("order_index");
      if (error) throw error;
      return data;
    },
  });

  const hasOverrides = isOverrideMode && overrideExercises && overrideExercises.length > 0;
  const routineExercises = hasOverrides ? overrideExercises : baseExercises;

  const ensureOverrides = useCallback(async () => {
    if (!isOverrideMode || hasOverrides) return;
    if (!routineId || !baseExercises?.length) return;

    const rows = baseExercises.map((re: any) => ({
      assigned_workout_id: assignedWorkoutId!,
      exercise_id: re.exercise_id,
      sets: re.sets,
      reps: re.reps,
      weight: re.weight,
      unit: re.unit ?? 'kg',
      order_index: re.order_index,
      block_number: re.block_number,
      day_number: re.day_number,
      rest_seconds: re.rest_seconds,
    }));

    const { error } = await supabase.from("assigned_workout_exercises").insert(rows);
    if (error) throw error;

    await queryClient.invalidateQueries({ queryKey: ["assigned-workout-exercises", assignedWorkoutId] });
  }, [isOverrideMode, hasOverrides, baseExercises, assignedWorkoutId, queryClient]);

  // Historial de las últimas 3 sesiones del ejercicio seleccionado
  const { data: exerciseHistory, isFetching: historyFetching } = useQuery({
    queryKey: ["exercise-history", clientId, historyExerciseId],
    enabled: !!clientId && !!historyExerciseId,
    queryFn: async () => {
      const excludeId = assignedWorkoutId ?? "00000000-0000-0000-0000-000000000000";
      // Últimos 30 workouts del cliente (excluyendo el actual)
      const { data: clientWorkouts } = await supabase
        .from("assigned_workouts")
        .select("id, workout_date")
        .eq("client_id", clientId!)
        .neq("id", excludeId)
        .order("workout_date", { ascending: false })
        .limit(30);
      if (!clientWorkouts?.length) return [];

      const workoutIds = clientWorkouts.map(w => w.id);
      const { data: logs } = await supabase
        .from("workout_logs")
        .select("assigned_workout_id, set_number, reps_done, weight_used")
        .in("assigned_workout_id", workoutIds)
        .eq("exercise_id", historyExerciseId!)
        .eq("completed", true)
        .order("set_number");
      if (!logs?.length) return [];

      const workoutMap = new Map(clientWorkouts.map(w => [w.id, w.workout_date]));
      const byWorkout = new Map<string, { date: string; logs: any[] }>();
      for (const log of logs) {
        const wId = log.assigned_workout_id;
        if (!byWorkout.has(wId)) byWorkout.set(wId, { date: workoutMap.get(wId) ?? "", logs: [] });
        byWorkout.get(wId)!.logs.push(log);
      }
      return Array.from(byWorkout.values())
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 3);
    },
  });

  const { data: exercises } = useQuery({
    queryKey: ["exercises"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercises")
        .select("*, exercise_categories(name)")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: editable,
  });

  const { data: categories } = useQuery({
    queryKey: ["exercise-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("exercise_categories").select("*").order("name");
      if (error) throw error;
      return data;
    },
    enabled: editable,
  });

  const invalidateKey = isOverrideMode
    ? ["assigned-workout-exercises", assignedWorkoutId]
    : ["routine-exercises", routineId];

  // Filtrar ejercicios por categoría y búsqueda
  const filteredExercises = exercises?.filter(ex => {
    const matchCategory = filterCategory
      ? (ex as any).category_id === filterCategory
      : true;
    const matchSearch = filterSearch
      ? ex.name.toLowerCase().includes(filterSearch.toLowerCase())
      : true;
    return matchCategory && matchSearch;
  }) ?? [];

  const addExercise = useMutation({
    mutationFn: async () => {
      if (isOverrideMode) await ensureOverrides();

      const currentExercises = isOverrideMode
        ? (await supabase.from("assigned_workout_exercises").select("*").eq("assigned_workout_id", assignedWorkoutId!)).data ?? []
        : routineExercises ?? [];

      const dayExercises = currentExercises.filter(
        (re: any) => re.day_number === selectedDay && re.block_number === addExBlock
      );

      const exerciseIds = Array.from(selectedExercises);
      const rows = exerciseIds.map((exId, i) => {
        const base: any = {
          exercise_id: exId,
          sets: null,
          reps: null,
          weight: null,
          order_index: dayExercises.length + i,
          day_number: selectedDay,
          block_number: addExBlock,
        };
        if (isOverrideMode) {
          base.assigned_workout_id = assignedWorkoutId;
        } else {
          base.routine_id = routineId;
        }
        return base;
      });

      const table = isOverrideMode ? "assigned_workout_exercises" : "routine_exercises";
      const { error } = await supabase.from(table).insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invalidateKey });
      setSelectedExercises(new Set());
      setSets("3"); setReps("10"); setWeight("");
      setFilterCategory(""); setFilterSearch("");
      setAddExOpen(false);
      toast.success(`${selectedExercises.size} ejercicio${selectedExercises.size > 1 ? "s" : ""} agregado${selectedExercises.size > 1 ? "s" : ""}`);
    },
  });

  const deleteExercise = useMutation({
    mutationFn: async (id: string) => {
      if (isOverrideMode && !hasOverrides) {
        await ensureOverrides();
        queryClient.invalidateQueries({ queryKey: invalidateKey });
        toast.info("Datos clonados. Intentá de nuevo.");
        return;
      }
      const table = isOverrideMode ? "assigned_workout_exercises" : "routine_exercises";
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invalidateKey });
    },
  });

  const updateExercise = useMutation({
    mutationFn: async ({ id, sets, reps, weight, unit }: { id: string; sets: number; reps: number; weight: number | null; unit: string }) => {
      if (isOverrideMode && !hasOverrides) {
        await ensureOverrides();
        const original = routineExercises?.find((re: any) => re.id === id);
        if (original) {
          const { data: cloned } = await supabase
            .from("assigned_workout_exercises")
            .select("id")
            .eq("assigned_workout_id", assignedWorkoutId!)
            .eq("exercise_id", original.exercise_id)
            .eq("day_number", original.day_number)
            .eq("block_number", original.block_number)
            .eq("order_index", original.order_index)
            .single();
          if (cloned) {
            const { error } = await supabase
              .from("assigned_workout_exercises")
              .update({ sets, reps, weight, unit })
              .eq("id", cloned.id);
            if (error) throw error;
            return;
          }
        }
        queryClient.invalidateQueries({ queryKey: invalidateKey });
        toast.info("Datos clonados. Intentá de nuevo.");
        return;
      }

      const table = isOverrideMode ? "assigned_workout_exercises" : "routine_exercises";
      const { error } = await supabase.from(table).update({ sets, reps, weight, unit }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invalidateKey });
      setEditingId(null);
      toast.success("Actualizado");
    },
  });

  const moveBlock = useMutation({
    mutationFn: async ({ blockA, blockB }: { blockA: number; blockB: number }) => {
      if (isOverrideMode && !hasOverrides) {
        await ensureOverrides();
        queryClient.invalidateQueries({ queryKey: invalidateKey });
        toast.info("Datos clonados. Intentá de nuevo.");
        return;
      }
      const table = isOverrideMode ? "assigned_workout_exercises" : "routine_exercises";
      const idField = isOverrideMode ? "assigned_workout_id" : "routine_id";
      const idValue = isOverrideMode ? assignedWorkoutId! : routineId;

      // Usar número temporal (9999) para evitar conflictos de unicidad al hacer el swap
      const idsA = (routineExercises ?? [])
        .filter((re: any) => re.block_number === blockA && re.day_number === selectedDay)
        .map((re: any) => re.id);
      const idsB = (routineExercises ?? [])
        .filter((re: any) => re.block_number === blockB && re.day_number === selectedDay)
        .map((re: any) => re.id);

      const maxBlock = Math.max(...(routineExercises ?? []).map((re: any) => re.block_number ?? 1)) + 1;
      if (idsA.length) await supabase.from(table).update({ block_number: maxBlock }).in("id", idsA);
      if (idsB.length) await supabase.from(table).update({ block_number: blockA }).in("id", idsB);
      if (idsA.length) await supabase.from(table).update({ block_number: blockB }).in("id", idsA);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invalidateKey });
    },
    onError: () => toast.error("Error al mover el bloque"),
  });

  const updateSetGroups = useMutation({
    mutationFn: async ({ id, groups }: { id: string; groups: { sets: string; reps: string; weight: string }[] }) => {
      const parsed = groups.map(g => ({
        sets: parseInt(g.sets) || 1,
        reps: parseInt(g.reps) || 1,
        weight: g.weight ? parseFloat(g.weight) : null,
      }));
      const value = parsed.length ? parsed : null;

      if (isOverrideMode && !hasOverrides) {
        await ensureOverrides();
        const original = routineExercises?.find((re: any) => re.id === id);
        if (original) {
          const { data: cloned } = await supabase
            .from("assigned_workout_exercises")
            .select("id")
            .eq("assigned_workout_id", assignedWorkoutId!)
            .eq("exercise_id", original.exercise_id)
            .eq("day_number", original.day_number)
            .eq("block_number", original.block_number)
            .eq("order_index", original.order_index)
            .single();
          if (cloned) {
            const { error } = await supabase
              .from("assigned_workout_exercises")
              .update({ set_groups: value })
              .eq("id", cloned.id);
            if (error) throw error;
            return;
          }
        }
        queryClient.invalidateQueries({ queryKey: invalidateKey });
        toast.info("Datos clonados. Intentá de nuevo.");
        return;
      }
      const table = isOverrideMode ? "assigned_workout_exercises" : "routine_exercises";
      const { error } = await supabase.from(table).update({ set_groups: value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invalidateKey });
      setEditingGroupsId(null);
      toast.success("Series guardadas");
    },
    onError: () => toast.error("Error al guardar series"),
  });

  const createExercise = useMutation({
    mutationFn: async () => {
      const catName = categories?.find(c => c.id === newExCategoryId)?.name ?? null;
      const { data, error } = await supabase.from("exercises").insert({
        name: newExName,
        category_id: newExCategoryId || null,
        muscle_group: catName,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["exercises"] });
      setCreateExOpen(false);
      setNewExName(""); setNewExCategoryId("");
      setSelectedExercises(prev => new Set([...prev, data.id]));
      toast.success("Ejercicio creado y seleccionado");
    },
  });

  const dayExercises = routineExercises?.filter((re: any) => re.day_number === selectedDay) ?? [];
  const blocks = [...new Set(dayExercises.map((re: any) => re.block_number))].sort((a, b) => a - b);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-foreground">{routineName}</p>
      </div>

      {totalDays > 1 && (
        <div className="flex gap-1 mb-3">
          {Array.from({ length: totalDays }, (_, i) => i + 1).map(d => (
            <button
              key={d}
              onClick={() => { if (!isFixedDay) setSelectedDay(d); }}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                selectedDay === d
                  ? "bg-primary text-primary-foreground"
                  : isFixedDay
                    ? "bg-secondary/40 text-muted-foreground cursor-default opacity-40"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              Día {d}
            </button>
          ))}
          {isFixedDay && (
            <span className="text-[10px] text-muted-foreground self-center ml-1">
              (día asignado)
            </span>
          )}
        </div>
      )}

      {!blocks.length ? (
        <p className="text-xs text-muted-foreground">Sin ejercicios.</p>
      ) : (
        blocks.map(blockNum => {
          const blockExercises = dayExercises.filter((re: any) => re.block_number === blockNum);
          return (
            <div key={blockNum} className="mb-3">
              <div className="flex items-center gap-1 mb-1">
                <p className="text-[10px] font-bold text-primary uppercase tracking-wider flex-1">Bloque {blockNum}</p>
                {editable && (
                  <>
                    <button
                      disabled={blockNum === blocks[0]}
                      onClick={() => {
                        const idx = blocks.indexOf(blockNum);
                        moveBlock.mutate({ blockA: blockNum, blockB: blocks[idx - 1] });
                      }}
                      className="p-0.5 rounded hover:bg-secondary/60 disabled:opacity-25 disabled:cursor-default transition-colors"
                      title="Subir bloque"
                    >
                      <ChevronUp className="h-3 w-3 text-muted-foreground" />
                    </button>
                    <button
                      disabled={blockNum === blocks[blocks.length - 1]}
                      onClick={() => {
                        const idx = blocks.indexOf(blockNum);
                        moveBlock.mutate({ blockA: blockNum, blockB: blocks[idx + 1] });
                      }}
                      className="p-0.5 rounded hover:bg-secondary/60 disabled:opacity-25 disabled:cursor-default transition-colors"
                      title="Bajar bloque"
                    >
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </>
                )}
              </div>
              <div className="space-y-1">
                {blockExercises.map((re: any) => {
                  const isEditing = editingId === re.id;
                  const showHistory = historyExerciseId === re.exercise_id;
                  return (
                    <div key={re.id} className="bg-secondary/50 rounded-lg px-3 py-1.5">
                      <div className="flex items-center justify-between">
                        {isEditing ? (
                          <div className="flex flex-col gap-1.5 flex-1">
                            <p className="text-xs font-medium text-foreground">{re.exercises?.name}</p>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Input type="number" className="w-14 h-7 text-xs" value={editSets} onChange={e => setEditSets(e.target.value)} placeholder="S" />
                              <span className="text-xs text-muted-foreground">×</span>
                              <Input type="number" className="w-14 h-7 text-xs" value={editReps} onChange={e => setEditReps(e.target.value)} placeholder="R" />
                              <span className="text-xs text-muted-foreground">@</span>
                              <Input type="number" className="w-16 h-7 text-xs" value={editWeight} onChange={e => setEditWeight(e.target.value)} placeholder="0" />
                              <div className="flex rounded-md border border-input overflow-hidden h-7">
                                {["kg", "seg", "m"].map(u => (
                                  <button key={u} type="button" onClick={() => setEditUnit(u)}
                                    className={`px-2 text-xs font-medium transition-colors ${editUnit === u ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-secondary"}`}>
                                    {u}
                                  </button>
                                ))}
                              </div>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateExercise.mutate({
                                id: re.id,
                                sets: parseInt(editSets) || 1,
                                reps: parseInt(editReps) || 1,
                                weight: editWeight ? parseFloat(editWeight) : null,
                                unit: editUnit,
                              })}>
                                <Save className="h-3 w-3 text-primary" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingId(null)}>
                                <span className="text-xs text-muted-foreground">✕</span>
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button
                              className="text-left flex-1"
                              onClick={() => {
                                if (!editable) return;
                                setEditingId(re.id);
                                setEditSets(String(re.sets));
                                setEditReps(String(re.reps));
                                setEditWeight(re.weight != null ? String(re.weight) : "");
                                setEditUnit(re.unit ?? "kg");
                              }}
                            >
                              <p className="text-xs font-medium text-foreground">{re.exercises?.name}</p>
                              {re.set_groups?.length ? (
                                re.set_groups.map((g: any, i: number) => (
                                  <p key={i} className="text-[10px] text-muted-foreground">
                                    {g.sets}×{g.reps}{g.weight ? ` @ ${g.weight}${re.unit ?? "kg"}` : ""}
                                  </p>
                                ))
                              ) : (
                                <p className="text-[10px] text-muted-foreground">
                                  {re.sets}×{re.reps}{re.weight ? ` @ ${re.weight}${re.unit ?? "kg"}` : ""}
                                </p>
                              )}
                            </button>
                            <div className="flex items-center gap-0.5">
                              {clientId && (
                                <Button
                                  variant="ghost" size="icon" className="h-6 w-6"
                                  title="Últimas sesiones"
                                  onClick={() => setHistoryExerciseId(showHistory ? null : re.exercise_id)}
                                >
                                  <History className={`h-3 w-3 ${showHistory ? "text-primary" : "text-muted-foreground"}`} />
                                </Button>
                              )}
                              {editable && (
                                <>
                                <Button
                                  variant="ghost" size="icon" className="h-6 w-6"
                                  title="Series progresivas"
                                  onClick={() => {
                                    if (editingGroupsId === re.id) {
                                      setEditingGroupsId(null);
                                    } else {
                                      const groups = re.set_groups?.length
                                        ? re.set_groups.map((g: any) => ({ sets: String(g.sets), reps: String(g.reps), weight: g.weight != null ? String(g.weight) : "" }))
                                        : [{ sets: String(re.sets ?? 3), reps: String(re.reps ?? 10), weight: re.weight != null ? String(re.weight) : "" }];
                                      setEditingGroups(groups);
                                      setEditingGroupsId(re.id);
                                    }
                                  }}
                                >
                                  <Layers className={`h-3 w-3 ${re.set_groups?.length ? "text-primary" : "text-muted-foreground"}`} />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteExercise.mutate(re.id)}>
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Editor de series progresivas */}
                      {editingGroupsId === re.id && !isEditing && (
                        <div className="mt-2 pt-2 border-t border-border/50 space-y-1.5">
                          <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Series progresivas</p>
                          {editingGroups.map((g, i) => (
                            <div key={i} className="flex items-center gap-1.5">
                              <span className="text-[10px] text-muted-foreground w-4">{i + 1}.</span>
                              <Input type="number" className="w-12 h-6 text-xs px-1" value={g.sets} onChange={e => setEditingGroups(prev => prev.map((x, j) => j === i ? { ...x, sets: e.target.value } : x))} placeholder="S" />
                              <span className="text-[10px] text-muted-foreground">×</span>
                              <Input type="number" className="w-12 h-6 text-xs px-1" value={g.reps} onChange={e => setEditingGroups(prev => prev.map((x, j) => j === i ? { ...x, reps: e.target.value } : x))} placeholder="R" />
                              <span className="text-[10px] text-muted-foreground">@</span>
                              <Input type="number" className="w-16 h-6 text-xs px-1" value={g.weight} onChange={e => setEditingGroups(prev => prev.map((x, j) => j === i ? { ...x, weight: e.target.value } : x))} placeholder={re.unit ?? "kg"} />
                              <button onClick={() => setEditingGroups(prev => prev.filter((_, j) => j !== i))} className="text-destructive hover:opacity-70">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                          <div className="flex gap-2 pt-1">
                            <button
                              className="text-[10px] text-primary hover:opacity-70 flex items-center gap-0.5"
                              onClick={() => setEditingGroups(prev => [...prev, { sets: "2", reps: "8", weight: "" }])}
                            >
                              <Plus className="h-3 w-3" /> Agregar grupo
                            </button>
                            <div className="flex-1" />
                            <button className="text-[10px] text-muted-foreground hover:opacity-70" onClick={() => setEditingGroupsId(null)}>Cancelar</button>
                            <button
                              className="text-[10px] text-primary font-bold hover:opacity-70"
                              onClick={() => updateSetGroups.mutate({ id: re.id, groups: editingGroups })}
                            >
                              Guardar
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Panel historial por ejercicio */}
                      {showHistory && !isEditing && (
                        <div className="mt-2 pt-2 border-t border-border/50">
                          <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1.5">Últimas 3 sesiones</p>
                          {historyFetching ? (
                            <p className="text-[10px] text-muted-foreground">Cargando...</p>
                          ) : !exerciseHistory?.length ? (
                            <p className="text-[10px] text-muted-foreground">Sin registros anteriores.</p>
                          ) : (
                            <div className="space-y-1.5">
                              {exerciseHistory.map((session, i) => (
                                <div key={i}>
                                  <p className="text-[10px] font-medium text-muted-foreground mb-0.5">
                                    {format(new Date(session.date + "T12:00:00"), "d MMM yyyy", { locale: es })}
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    {session.logs.map((l: any, j: number) => (
                                      <span key={j} className="text-[10px] px-1.5 py-0.5 rounded bg-card border border-border text-foreground">
                                        S{l.set_number}: {l.reps_done ?? "—"} rep{l.weight_used ? ` @ ${l.weight_used}${re.unit ?? "kg"}` : ""}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      {editable && (
        <>
          <Button variant="outline" size="sm" className="mt-1" onClick={() => {
            const maxBlock = dayExercises.length ? Math.max(...dayExercises.map((re: any) => re.block_number)) : 1;
            setAddExBlock(maxBlock);
            setAddExOpen(true);
          }}>
            <Plus className="h-3 w-3 mr-1" />Agregar Ejercicio
          </Button>

          <Dialog open={addExOpen} onOpenChange={(open) => {
            setAddExOpen(open);
            if (!open) {
              setFilterCategory("");
              setFilterSearch("");
              setSelectedExercises(new Set());
            }
          }}>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Agregar Ejercicios - Día {selectedDay}</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-4">

                {/* 1. Bloque */}
                <div>
                  <label className="text-xs text-muted-foreground">Bloque</label>
                  <Input type="number" min="1" className="mt-1" value={addExBlock} onChange={e => setAddExBlock(e.target.value === "" ? 1 : parseInt(e.target.value) || 1)} onFocus={e => e.target.select()} />
                </div>

                {/* 2. Categoría */}
                <div>
                  <label className="text-xs text-muted-foreground">Categoría</label>
                  <select
                    className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground mt-1"
                    value={filterCategory}
                    onChange={e => {
                      setFilterCategory(e.target.value);
                      setFilterSearch("");
                    }}
                  >
                    <option value="">Todas las categorías</option>
                    {categories?.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* 3. Lista de ejercicios con selección múltiple */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-muted-foreground">Ejercicios</label>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setCreateExOpen(true)}>
                      <PlusCircle className="h-3 w-3 mr-1" />Nuevo
                    </Button>
                  </div>
                  <div className="border border-input rounded-lg overflow-hidden">
                    <div className="border-b border-input px-3 py-2">
                      <Input
                        className="h-7 text-xs border-0 p-0 focus-visible:ring-0 bg-transparent"
                        placeholder="Buscar..."
                        value={filterSearch}
                        onChange={e => setFilterSearch(e.target.value)}
                      />
                    </div>
                    <div className="max-h-32 overflow-y-auto">
                      {filteredExercises.length === 0 ? (
                        <p className="text-xs text-muted-foreground px-3 py-3 text-center">Sin resultados.</p>
                      ) : (
                        filteredExercises.map(ex => {
                          const isSelected = selectedExercises.has(ex.id);
                          return (
                            <button
                              key={ex.id}
                              type="button"
                              onClick={() => {
                                setSelectedExercises(prev => {
                                  const next = new Set(prev);
                                  next.has(ex.id) ? next.delete(ex.id) : next.add(ex.id);
                                  return next;
                                });
                              }}
                              className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${
                                isSelected
                                  ? "bg-primary text-primary-foreground"
                                  : "hover:bg-secondary text-foreground"
                              }`}
                            >
                              <span>{ex.name}</span>
                              {isSelected && <span className="text-xs">✓</span>}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* 4. Seleccionados (memoria entre categorías) */}
                {selectedExercises.size > 0 && (
                  <div className="bg-secondary/30 rounded-lg px-3 py-2">
                    <p className="text-xs text-muted-foreground mb-2">Seleccionados ({selectedExercises.size}):</p>
                    <div className="flex flex-wrap gap-1">
                      {Array.from(selectedExercises).map(id => {
                        const ex = exercises?.find(e => e.id === id);
                        return ex ? (
                          <span key={id} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                            {ex.name}
                            <button onClick={() => setSelectedExercises(prev => {
                              const next = new Set(prev);
                              next.delete(id);
                              return next;
                            })}>✕</button>
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}

                <Button
                  className="w-full"
                  onClick={() => addExercise.mutate()}
                  disabled={selectedExercises.size === 0}
                >
                  Agregar {selectedExercises.size > 0 ? `${selectedExercises.size} ejercicio${selectedExercises.size > 1 ? "s" : ""}` : ""}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={createExOpen} onOpenChange={setCreateExOpen}>
            <DialogContent>
              <DialogHeader><DialogTitle>Crear Ejercicio Nuevo</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-4">
                <Input
                  placeholder="Nombre del ejercicio *"
                  value={newExName}
                  onChange={e => setNewExName(e.target.value)}
                />
                <div>
                  <label className="text-xs text-muted-foreground">Categoría (opcional)</label>
                  <select
                    className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground mt-1"
                    value={newExCategoryId}
                    onChange={e => setNewExCategoryId(e.target.value)}
                  >
                    <option value="">Sin categoría</option>
                    {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <Button
                  className="w-full"
                  onClick={() => createExercise.mutate()}
                  disabled={!newExName.trim()}
                >
                  Crear y seleccionar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}

    </div>
  );
}
