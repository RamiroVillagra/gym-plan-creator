import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ChevronDown, ChevronUp, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";

export default function RoutinesPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [routineName, setRoutineName] = useState("");
  const [routineDesc, setRoutineDesc] = useState("");
  const [totalDays, setTotalDays] = useState("1");
  const [expandedRoutine, setExpandedRoutine] = useState<string | null>(null);

  // Add exercise to routine
  const [addExOpen, setAddExOpen] = useState(false);
  const [addExRoutineId, setAddExRoutineId] = useState<string | null>(null);
  const [addExDay, setAddExDay] = useState(1);
  const [addExBlock, setAddExBlock] = useState(1);
  const [selectedExercise, setSelectedExercise] = useState("");
  const [sets, setSets] = useState("3");
  const [reps, setReps] = useState("10");
  const [weight, setWeight] = useState("");

  // Edit routine
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState("");
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editDays, setEditDays] = useState("1");

  // Selected day tab
  const [selectedDay, setSelectedDay] = useState(1);

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
        .order("day_number")
        .order("block_number")
        .order("order_index");
      if (error) throw error;
      return data;
    },
  });

  const createRoutine = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("routines").insert({
        name: routineName,
        description: routineDesc || null,
        total_days: parseInt(totalDays) || 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routines"] });
      setRoutineName(""); setRoutineDesc(""); setTotalDays("1");
      setOpen(false);
      toast.success("Rutina creada");
    },
  });

  const updateRoutine = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("routines").update({
        name: editName,
        description: editDesc || null,
        total_days: parseInt(editDays) || 1,
      }).eq("id", editId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routines"] });
      setEditOpen(false);
      toast.success("Rutina actualizada");
    },
  });

  const addExerciseToRoutine = useMutation({
    mutationFn: async () => {
      const dayExercises = routineExercises?.filter(
        (re: any) => re.day_number === addExDay && re.block_number === addExBlock
      ) ?? [];
      const { error } = await supabase.from("routine_exercises").insert({
        routine_id: addExRoutineId!,
        exercise_id: selectedExercise,
        sets: parseInt(sets),
        reps: parseInt(reps),
        weight: weight ? parseFloat(weight) : null,
        order_index: dayExercises.length,
        day_number: addExDay,
        block_number: addExBlock,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routine-exercises"] });
      setSelectedExercise(""); setSets("3"); setReps("10"); setWeight("");
      setAddExOpen(false);
      toast.success("Ejercicio agregado");
    },
  });

  const deleteRoutine = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("routines").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routines"] });
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

  const getExpandedRoutine = () => routines?.find(r => r.id === expandedRoutine);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-heading font-bold">Rutinas</h1>
          <p className="text-muted-foreground">Crea plantillas de rutinas con bloques y días</p>
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
              <div>
                <label className="text-xs text-muted-foreground">Cantidad de días de entrenamiento</label>
                <Input type="number" min="1" max="7" value={totalDays} onChange={e => setTotalDays(e.target.value)} />
              </div>
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
          {routines.map(routine => {
            const isExpanded = expandedRoutine === routine.id;
            const rTotalDays = (routine as any).total_days ?? 1;
            
            return (
              <div key={routine.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3">
                  <button
                    onClick={() => {
                      setExpandedRoutine(isExpanded ? null : routine.id);
                      setSelectedDay(1);
                    }}
                    className="flex items-center gap-2 text-left flex-1"
                  >
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    <div>
                      <p className="font-medium text-foreground">{routine.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {routine.description ? `${routine.description} · ` : ""}{rTotalDays} día{rTotalDays > 1 ? "s" : ""}
                      </p>
                    </div>
                  </button>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => {
                      setEditId(routine.id);
                      setEditName(routine.name);
                      setEditDesc(routine.description ?? "");
                      setEditDays(String(rTotalDays));
                      setEditOpen(true);
                    }}>
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteRoutine.mutate(routine.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border">
                    {/* Day tabs */}
                    {rTotalDays > 1 && (
                      <div className="flex gap-1 px-4 pt-3">
                        {Array.from({ length: rTotalDays }, (_, i) => i + 1).map(d => (
                          <button
                            key={d}
                            onClick={() => setSelectedDay(d)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
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

                    <div className="px-4 py-3">
                      {(() => {
                        const dayExercises = routineExercises?.filter((re: any) => re.day_number === selectedDay) ?? [];
                        const blocks = [...new Set(dayExercises.map((re: any) => re.block_number))].sort((a, b) => a - b);
                        
                        if (!blocks.length) {
                          return <p className="text-sm text-muted-foreground py-2">Sin ejercicios en este día.</p>;
                        }

                        return blocks.map(blockNum => {
                          const blockExercises = dayExercises.filter((re: any) => re.block_number === blockNum);
                          return (
                            <div key={blockNum} className="mb-4">
                              <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2">
                                Bloque {blockNum}
                              </p>
                              <div className="space-y-2">
                                {blockExercises.map((re: any) => (
                                  <div key={re.id} className="flex items-center justify-between bg-secondary/50 rounded-lg px-3 py-2">
                                    <div>
                                      <p className="text-sm font-medium text-foreground">{re.exercises?.name}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {re.sets} series × {re.reps} reps{re.weight ? ` @ ${re.weight}kg` : ""}
                                      </p>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => deleteRoutineExercise.mutate(re.id)}>
                                      <Trash2 className="h-3 w-3 text-destructive" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        });
                      })()}

                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => {
                          setAddExRoutineId(routine.id);
                          setAddExDay(selectedDay);
                          const dayExercises = routineExercises?.filter((re: any) => re.day_number === selectedDay) ?? [];
                          const maxBlock = dayExercises.length ? Math.max(...dayExercises.map((re: any) => re.block_number)) : 1;
                          setAddExBlock(maxBlock);
                          setAddExOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-1" />Agregar Ejercicio
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add exercise dialog */}
      <Dialog open={addExOpen} onOpenChange={setAddExOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Agregar Ejercicio - Día {addExDay}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <select
              className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
              value={selectedExercise}
              onChange={e => setSelectedExercise(e.target.value)}
            >
              <option value="">Seleccionar ejercicio</option>
              {exercises?.map(ex => (
                <option key={ex.id} value={ex.id}>{ex.name} {ex.muscle_group ? `(${ex.muscle_group})` : ""}</option>
              ))}
            </select>
            <div>
              <label className="text-xs text-muted-foreground">Bloque</label>
              <Input type="number" min="1" value={addExBlock} onChange={e => setAddExBlock(parseInt(e.target.value) || 1)} />
            </div>
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

      {/* Edit routine dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Rutina</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <Input placeholder="Nombre" value={editName} onChange={e => setEditName(e.target.value)} />
            <Input placeholder="Descripción" value={editDesc} onChange={e => setEditDesc(e.target.value)} />
            <div>
              <label className="text-xs text-muted-foreground">Días de entrenamiento</label>
              <Input type="number" min="1" max="7" value={editDays} onChange={e => setEditDays(e.target.value)} />
            </div>
            <Button className="w-full" onClick={() => updateRoutine.mutate()} disabled={!editName.trim()}>Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
