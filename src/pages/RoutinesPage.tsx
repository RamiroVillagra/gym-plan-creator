import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";

export default function RoutinesPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [routineName, setRoutineName] = useState("");
  const [routineDesc, setRoutineDesc] = useState("");
  const [expandedRoutine, setExpandedRoutine] = useState<string | null>(null);

  // Add exercise to routine dialog
  const [addExOpen, setAddExOpen] = useState(false);
  const [addExRoutineId, setAddExRoutineId] = useState<string | null>(null);
  const [selectedExercise, setSelectedExercise] = useState("");
  const [sets, setSets] = useState("3");
  const [reps, setReps] = useState("10");
  const [weight, setWeight] = useState("");

  const { data: routines, isLoading } = useQuery({
    queryKey: ["routines"],
    queryFn: async () => {
      const { data, error } = await supabase.from("routines").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: exercises } = useQuery({
    queryKey: ["exercises"],
    queryFn: async () => {
      const { data, error } = await supabase.from("exercises").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: routineExercises } = useQuery({
    queryKey: ["routine-exercises", expandedRoutine],
    enabled: !!expandedRoutine,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routine_exercises")
        .select("*, exercises(name, muscle_group)")
        .eq("routine_id", expandedRoutine!)
        .order("order_index");
      if (error) throw error;
      return data;
    },
  });

  const createRoutine = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("routines").insert({ name: routineName, description: routineDesc || null });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routines"] });
      queryClient.invalidateQueries({ queryKey: ["routines-count"] });
      setRoutineName(""); setRoutineDesc("");
      setOpen(false);
      toast.success("Rutina creada");
    },
  });

  const addExerciseToRoutine = useMutation({
    mutationFn: async () => {
      const currentExercises = routineExercises?.length ?? 0;
      const { error } = await supabase.from("routine_exercises").insert({
        routine_id: addExRoutineId!,
        exercise_id: selectedExercise,
        sets: parseInt(sets),
        reps: parseInt(reps),
        weight: weight ? parseFloat(weight) : null,
        order_index: currentExercises,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routine-exercises"] });
      setSelectedExercise(""); setSets("3"); setReps("10"); setWeight("");
      setAddExOpen(false);
      toast.success("Ejercicio agregado a rutina");
    },
  });

  const deleteRoutine = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("routines").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routines"] });
      queryClient.invalidateQueries({ queryKey: ["routines-count"] });
      toast.success("Rutina eliminada");
    },
  });

  const deleteRoutineExercise = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("routine_exercises").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routine-exercises"] });
    },
  });

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-heading font-bold">Rutinas</h1>
          <p className="text-muted-foreground">Crea plantillas de rutinas reutilizables</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nueva Rutina</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Crear Rutina</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <Input placeholder="Nombre de la rutina" value={routineName} onChange={e => setRoutineName(e.target.value)} />
              <Input placeholder="Descripción (opcional)" value={routineDesc} onChange={e => setRoutineDesc(e.target.value)} />
              <Button className="w-full" onClick={() => createRoutine.mutate()} disabled={!routineName.trim()}>Guardar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Cargando...</p>
      ) : !routines?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No hay rutinas creadas.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {routines.map(routine => (
            <div key={routine.id} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3">
                <button
                  onClick={() => setExpandedRoutine(expandedRoutine === routine.id ? null : routine.id)}
                  className="flex items-center gap-2 text-left flex-1"
                >
                  {expandedRoutine === routine.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  <div>
                    <p className="font-medium text-foreground">{routine.name}</p>
                    {routine.description && <p className="text-xs text-muted-foreground">{routine.description}</p>}
                  </div>
                </button>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAddExRoutineId(routine.id);
                      setExpandedRoutine(routine.id);
                      setAddExOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteRoutine.mutate(routine.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>

              {expandedRoutine === routine.id && (
                <div className="border-t border-border px-4 py-3 space-y-2">
                  {!routineExercises?.length ? (
                    <p className="text-sm text-muted-foreground py-2">Sin ejercicios. Agrega uno.</p>
                  ) : (
                    routineExercises.map((re: any) => (
                      <div key={re.id} className="flex items-center justify-between bg-secondary/50 rounded-lg px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-foreground">{re.exercises?.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {re.sets} series × {re.reps} reps
                            {re.weight ? ` @ ${re.weight}kg` : ""}
                          </p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => deleteRoutineExercise.mutate(re.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add exercise to routine dialog */}
      <Dialog open={addExOpen} onOpenChange={setAddExOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Agregar Ejercicio a Rutina</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <select
              className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground"
              value={selectedExercise}
              onChange={e => setSelectedExercise(e.target.value)}
            >
              <option value="">Seleccionar ejercicio</option>
              {exercises?.map(ex => (
                <option key={ex.id} value={ex.id}>{ex.name} {ex.muscle_group ? `(${ex.muscle_group})` : ""}</option>
              ))}
            </select>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Series</label>
                <Input type="number" value={sets} onChange={e => setSets(e.target.value)} min="1" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Reps</label>
                <Input type="number" value={reps} onChange={e => setReps(e.target.value)} min="1" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Peso (kg)</label>
                <Input type="number" value={weight} onChange={e => setWeight(e.target.value)} min="0" step="0.5" />
              </div>
            </div>
            <Button className="w-full" onClick={() => addExerciseToRoutine.mutate()} disabled={!selectedExercise}>
              Agregar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
