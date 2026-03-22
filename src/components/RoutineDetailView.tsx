import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Save, PlusCircle, History } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface RoutineDetailViewProps {
  routineId: string;
  routineName: string;
  totalDays: number;
  editable?: boolean;
  /** When provided, edits clone into per-client overrides instead of modifying base routine */
  assignedWorkoutId?: string;
  clientId?: string;
}

export default function RoutineDetailView({ routineId, routineName, totalDays, editable = false, assignedWorkoutId, clientId }: RoutineDetailViewProps) {
  const queryClient = useQueryClient();
  const [selectedDay, setSelectedDay] = useState(1);
  const [addExOpen, setAddExOpen] = useState(false);
  const [addExBlock, setAddExBlock] = useState(1);
  const [selectedExercise, setSelectedExercise] = useState("");
  const [sets, setSets] = useState("3");
  const [reps, setReps] = useState("10");
  const [weight, setWeight] = useState("");

  // Inline create exercise
  const [createExOpen, setCreateExOpen] = useState(false);
  const [newExName, setNewExName] = useState("");
  const [newExMuscle, setNewExMuscle] = useState("");

  // Inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSets, setEditSets] = useState("");
  const [editReps, setEditReps] = useState("");
  const [editWeight, setEditWeight] = useState("");

  // Previous session
  const [prevOpen, setPrevOpen] = useState(false);

  const { data: routineExercises } = useQuery({
    queryKey: ["routine-exercises", routineId],
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

  // Fetch previous session logs for comparison
  const { data: previousLogs } = useQuery({
    queryKey: ["previous-logs", clientId, routineId],
    enabled: !!clientId && !!assignedWorkoutId,
    queryFn: async () => {
      // Find previous assigned_workout for same client + routine before this one
      const { data: prevWorkouts } = await supabase
        .from("assigned_workouts")
        .select("id, workout_date")
        .eq("client_id", clientId!)
        .eq("routine_id", routineId)
        .neq("id", assignedWorkoutId!)
        .order("workout_date", { ascending: false })
        .limit(1);
      if (!prevWorkouts?.length) return null;
      const prevId = prevWorkouts[0].id;
      const prevDate = prevWorkouts[0].workout_date;
      const { data: logs } = await supabase
        .from("workout_logs")
        .select("*")
        .eq("assigned_workout_id", prevId);
      return { logs: logs ?? [], date: prevDate };
    },
  });

  const { data: exercises } = useQuery({
    queryKey: ["exercises"],
    queryFn: async () => {
      const { data, error } = await supabase.from("exercises").select("*").order("name");
      if (error) throw error;
      return data;
    },
    enabled: editable,
  });

  const addExercise = useMutation({
    mutationFn: async () => {
      const dayExercises = routineExercises?.filter(
        (re: any) => re.day_number === selectedDay && re.block_number === addExBlock
      ) ?? [];
      const { error } = await supabase.from("routine_exercises").insert({
        routine_id: routineId,
        exercise_id: selectedExercise,
        sets: parseInt(sets),
        reps: parseInt(reps),
        weight: weight ? parseFloat(weight) : null,
        order_index: dayExercises.length,
        day_number: selectedDay,
        block_number: addExBlock,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routine-exercises", routineId] });
      setSelectedExercise(""); setSets("3"); setReps("10"); setWeight("");
      setAddExOpen(false);
      toast.success("Ejercicio agregado");
    },
  });

  const deleteExercise = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("routine_exercises").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routine-exercises", routineId] });
    },
  });

  const updateExercise = useMutation({
    mutationFn: async ({ id, sets, reps, weight }: { id: string; sets: number; reps: number; weight: number | null }) => {
      const { error } = await supabase.from("routine_exercises").update({ sets, reps, weight }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routine-exercises", routineId] });
      setEditingId(null);
      toast.success("Actualizado");
    },
  });

  const createExercise = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("exercises").insert({
        name: newExName,
        muscle_group: newExMuscle || null,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["exercises"] });
      setCreateExOpen(false);
      setNewExName(""); setNewExMuscle("");
      setSelectedExercise(data.id);
      toast.success("Ejercicio creado");
    },
  });

  const dayExercises = routineExercises?.filter((re: any) => re.day_number === selectedDay) ?? [];
  const blocks = [...new Set(dayExercises.map((re: any) => re.block_number))].sort((a, b) => a - b);

  // Helper to find previous log for an exercise
  const getPrevLog = (exerciseId: string) => {
    if (!previousLogs?.logs) return null;
    const logs = previousLogs.logs.filter((l: any) => l.exercise_id === exerciseId);
    if (!logs.length) return null;
    const maxWeight = Math.max(...logs.map((l: any) => l.weight_used ?? 0));
    const avgReps = Math.round(logs.reduce((s: number, l: any) => s + (l.reps_done ?? 0), 0) / logs.length);
    return { sets: logs.length, reps: avgReps, weight: maxWeight };
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-foreground">{routineName}</p>
        {clientId && previousLogs?.logs?.length ? (
          <Button variant="ghost" size="sm" onClick={() => setPrevOpen(true)}>
            <History className="h-3 w-3 mr-1" />Sesión anterior
          </Button>
        ) : null}
      </div>

      {totalDays > 1 && (
        <div className="flex gap-1 mb-3">
          {Array.from({ length: totalDays }, (_, i) => i + 1).map(d => (
            <button
              key={d}
              onClick={() => setSelectedDay(d)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                selectedDay === d
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              Día {d}
            </button>
          ))}
        </div>
      )}

      {!blocks.length ? (
        <p className="text-xs text-muted-foreground">Sin ejercicios.</p>
      ) : (
        blocks.map(blockNum => {
          const blockExercises = dayExercises.filter((re: any) => re.block_number === blockNum);
          return (
            <div key={blockNum} className="mb-3">
              <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">Bloque {blockNum}</p>
              <div className="space-y-1">
                {blockExercises.map((re: any) => {
                  const isEditing = editingId === re.id;
                  const prev = clientId ? getPrevLog(re.exercise_id) : null;
                  return (
                    <div key={re.id} className="bg-secondary/50 rounded-lg px-3 py-1.5">
                      <div className="flex items-center justify-between">
                        {isEditing ? (
                          <div className="flex items-center gap-2 flex-1">
                            <p className="text-xs font-medium text-foreground min-w-[80px]">{re.exercises?.name}</p>
                            <Input type="number" className="w-14 h-7 text-xs" value={editSets} onChange={e => setEditSets(e.target.value)} placeholder="S" />
                            <span className="text-xs text-muted-foreground">×</span>
                            <Input type="number" className="w-14 h-7 text-xs" value={editReps} onChange={e => setEditReps(e.target.value)} placeholder="R" />
                            <span className="text-xs text-muted-foreground">@</span>
                            <Input type="number" className="w-16 h-7 text-xs" value={editWeight} onChange={e => setEditWeight(e.target.value)} placeholder="Kg" />
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateExercise.mutate({
                              id: re.id,
                              sets: parseInt(editSets) || 1,
                              reps: parseInt(editReps) || 1,
                              weight: editWeight ? parseFloat(editWeight) : null,
                            })}>
                              <Save className="h-3 w-3 text-primary" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingId(null)}>
                              <span className="text-xs text-muted-foreground">✕</span>
                            </Button>
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
                              }}
                            >
                              <p className="text-xs font-medium text-foreground">{re.exercises?.name}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {re.sets}×{re.reps}{re.weight ? ` @ ${re.weight}kg` : ""}
                              </p>
                            </button>
                            {editable && (
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteExercise.mutate(re.id)}>
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                      {/* Show previous session inline */}
                      {prev && !isEditing && (
                        <p className="text-[10px] text-accent-foreground/60 mt-0.5">
                          Anterior: {prev.sets}×{prev.reps} @ {prev.weight}kg
                        </p>
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

          <Dialog open={addExOpen} onOpenChange={setAddExOpen}>
            <DialogContent>
              <DialogHeader><DialogTitle>Agregar Ejercicio - Día {selectedDay}</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="flex gap-2">
                  <select
                    className="flex-1 h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
                    value={selectedExercise}
                    onChange={e => setSelectedExercise(e.target.value)}
                  >
                    <option value="">Seleccionar ejercicio</option>
                    {exercises?.map(ex => (
                      <option key={ex.id} value={ex.id}>{ex.name} {ex.muscle_group ? `(${ex.muscle_group})` : ""}</option>
                    ))}
                  </select>
                  <Button variant="outline" size="icon" onClick={() => setCreateExOpen(true)} title="Crear ejercicio nuevo">
                    <PlusCircle className="h-4 w-4" />
                  </Button>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Bloque</label>
                  <Input type="number" min="1" value={addExBlock} onChange={e => setAddExBlock(parseInt(e.target.value) || 1)} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><label className="text-xs text-muted-foreground">Series</label><Input type="number" value={sets} onChange={e => setSets(e.target.value)} min="1" /></div>
                  <div><label className="text-xs text-muted-foreground">Reps</label><Input type="number" value={reps} onChange={e => setReps(e.target.value)} min="1" /></div>
                  <div><label className="text-xs text-muted-foreground">Peso (kg)</label><Input type="number" value={weight} onChange={e => setWeight(e.target.value)} min="0" step="0.5" /></div>
                </div>
                <Button className="w-full" onClick={() => addExercise.mutate()} disabled={!selectedExercise}>Agregar</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Inline create exercise dialog */}
          <Dialog open={createExOpen} onOpenChange={setCreateExOpen}>
            <DialogContent>
              <DialogHeader><DialogTitle>Crear Ejercicio Nuevo</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-4">
                <Input placeholder="Nombre del ejercicio *" value={newExName} onChange={e => setNewExName(e.target.value)} />
                <Input placeholder="Grupo muscular (opcional)" value={newExMuscle} onChange={e => setNewExMuscle(e.target.value)} />
                <Button className="w-full" onClick={() => createExercise.mutate()} disabled={!newExName.trim()}>Crear</Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* Previous session detail dialog */}
      <Dialog open={prevOpen} onOpenChange={setPrevOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Sesión Anterior — {previousLogs?.date}</DialogTitle></DialogHeader>
          <div className="space-y-2 mt-4 max-h-[60vh] overflow-y-auto">
            {previousLogs?.logs?.length ? (
              (() => {
                const byExercise: Record<string, any[]> = {};
                previousLogs.logs.forEach((l: any) => {
                  if (!byExercise[l.exercise_id]) byExercise[l.exercise_id] = [];
                  byExercise[l.exercise_id].push(l);
                });
                const exerciseNames: Record<string, string> = {};
                routineExercises?.forEach((re: any) => {
                  if (re.exercises?.name) exerciseNames[re.exercise_id] = re.exercises.name;
                });
                return Object.entries(byExercise).map(([exId, logs]) => (
                  <div key={exId} className="bg-secondary/50 rounded-lg px-3 py-2">
                    <p className="text-xs font-medium text-foreground mb-1">{exerciseNames[exId] || "Ejercicio"}</p>
                    {logs.sort((a, b) => a.set_number - b.set_number).map((l: any) => (
                      <p key={l.id} className="text-[10px] text-muted-foreground">
                        Serie {l.set_number}: {l.reps_done ?? "—"} reps @ {l.weight_used ?? "—"}kg
                        {l.completed ? " ✓" : ""}
                      </p>
                    ))}
                  </div>
                ));
              })()
            ) : (
              <p className="text-sm text-muted-foreground">No hay datos de sesiones anteriores.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
