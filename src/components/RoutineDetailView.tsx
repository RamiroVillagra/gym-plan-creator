import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface RoutineDetailViewProps {
  routineId: string;
  routineName: string;
  totalDays: number;
  editable?: boolean;
}

export default function RoutineDetailView({ routineId, routineName, totalDays, editable = false }: RoutineDetailViewProps) {
  const queryClient = useQueryClient();
  const [selectedDay, setSelectedDay] = useState(1);
  const [addExOpen, setAddExOpen] = useState(false);
  const [addExBlock, setAddExBlock] = useState(1);
  const [selectedExercise, setSelectedExercise] = useState("");
  const [sets, setSets] = useState("3");
  const [reps, setReps] = useState("10");
  const [weight, setWeight] = useState("");

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

  const dayExercises = routineExercises?.filter((re: any) => re.day_number === selectedDay) ?? [];
  const blocks = [...new Set(dayExercises.map((re: any) => re.block_number))].sort((a, b) => a - b);

  return (
    <div>
      <p className="text-sm font-semibold text-foreground mb-2">{routineName}</p>

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
                {blockExercises.map((re: any) => (
                  <div key={re.id} className="flex items-center justify-between bg-secondary/50 rounded-lg px-3 py-1.5">
                    <div>
                      <p className="text-xs font-medium text-foreground">{re.exercises?.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {re.sets}×{re.reps}{re.weight ? ` @ ${re.weight}kg` : ""}
                      </p>
                    </div>
                    {editable && (
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteExercise.mutate(re.id)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
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
                  <div><label className="text-xs text-muted-foreground">Series</label><Input type="number" value={sets} onChange={e => setSets(e.target.value)} min="1" /></div>
                  <div><label className="text-xs text-muted-foreground">Reps</label><Input type="number" value={reps} onChange={e => setReps(e.target.value)} min="1" /></div>
                  <div><label className="text-xs text-muted-foreground">Peso (kg)</label><Input type="number" value={weight} onChange={e => setWeight(e.target.value)} min="0" step="0.5" /></div>
                </div>
                <Button className="w-full" onClick={() => addExercise.mutate()} disabled={!selectedExercise}>Agregar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
