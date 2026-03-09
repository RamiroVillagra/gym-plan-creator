import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle2, Circle, Dumbbell, Search } from "lucide-react";
import { toast } from "sonner";

export default function WorkoutPage() {
  const queryClient = useQueryClient();
  const [selectedClient, setSelectedClient] = useState("");
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: todayWorkouts } = useQuery({
    queryKey: ["today-workouts", selectedClient, today],
    enabled: !!selectedClient,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assigned_workouts")
        .select("*, routines(name, routine_exercises(*, exercises(name, muscle_group)))")
        .eq("client_id", selectedClient)
        .eq("workout_date", today);
      if (error) throw error;
      return data;
    },
  });

  const { data: existingLogs } = useQuery({
    queryKey: ["workout-logs", todayWorkouts?.map((w: any) => w.id)],
    enabled: !!todayWorkouts?.length,
    queryFn: async () => {
      const workoutIds = todayWorkouts!.map((w: any) => w.id);
      const { data, error } = await supabase
        .from("workout_logs")
        .select("*")
        .in("assigned_workout_id", workoutIds);
      if (error) throw error;
      return data;
    },
  });

  const logSet = useMutation({
    mutationFn: async (params: {
      assigned_workout_id: string;
      exercise_id: string;
      set_number: number;
      reps_done: number;
      weight_used: number;
    }) => {
      // Check if log exists
      const existing = existingLogs?.find(
        l => l.assigned_workout_id === params.assigned_workout_id &&
          l.exercise_id === params.exercise_id &&
          l.set_number === params.set_number
      );

      if (existing) {
        const { error } = await supabase.from("workout_logs").update({
          reps_done: params.reps_done,
          weight_used: params.weight_used,
          completed: true,
        }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("workout_logs").insert({
          ...params,
          completed: true,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workout-logs"] });
      toast.success("Serie registrada");
    },
  });

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Dumbbell className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-heading font-bold">Mi Entrenamiento</h1>
        </div>
        <p className="text-muted-foreground">
          {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
        </p>
      </div>

      <select
        className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground mb-6"
        value={selectedClient}
        onChange={e => setSelectedClient(e.target.value)}
      >
        <option value="">Selecciona tu nombre</option>
        {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>

      {selectedClient && !todayWorkouts?.length && (
        <div className="text-center py-12 text-muted-foreground">
          <Dumbbell className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No tienes entrenamiento asignado para hoy.</p>
        </div>
      )}

      {todayWorkouts?.map((workout: any) => (
        <div key={workout.id} className="space-y-4">
          {workout.routines?.name && (
            <h2 className="text-xl font-heading font-bold text-primary">{workout.routines.name}</h2>
          )}

          {workout.routines?.routine_exercises?.map((re: any) => (
            <ExerciseCard
              key={re.id}
              exercise={re.exercises}
              sets={re.sets}
              reps={re.reps}
              weight={re.weight}
              assignedWorkoutId={workout.id}
              exerciseId={re.exercise_id}
              existingLogs={existingLogs?.filter(
                (l: any) => l.exercise_id === re.exercise_id && l.assigned_workout_id === workout.id
              ) ?? []}
              onLogSet={logSet.mutate}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function ExerciseCard({
  exercise, sets, reps, weight, assignedWorkoutId, exerciseId, existingLogs, onLogSet
}: {
  exercise: any;
  sets: number;
  reps: number;
  weight: number | null;
  assignedWorkoutId: string;
  exerciseId: string;
  existingLogs: any[];
  onLogSet: (params: any) => void;
}) {
  const [localSets, setLocalSets] = useState<{ reps: string; weight: string }[]>(
    Array.from({ length: sets }, (_, i) => {
      const log = existingLogs.find((l: any) => l.set_number === i + 1);
      return {
        reps: log?.reps_done?.toString() ?? reps.toString(),
        weight: log?.weight_used?.toString() ?? (weight?.toString() ?? ""),
      };
    })
  );

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-heading font-bold text-foreground">{exercise?.name}</p>
          {exercise?.muscle_group && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{exercise.muscle_group}</span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{sets}×{reps} {weight ? `@ ${weight}kg` : ""}</span>
      </div>

      <div className="space-y-2">
        {localSets.map((s, i) => {
          const isLogged = existingLogs.some((l: any) => l.set_number === i + 1 && l.completed);
          return (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-12">Serie {i + 1}</span>
              <Input
                type="number"
                placeholder="Reps"
                className="w-20 h-8 text-sm"
                value={s.reps}
                onChange={e => {
                  const next = [...localSets];
                  next[i].reps = e.target.value;
                  setLocalSets(next);
                }}
              />
              <Input
                type="number"
                placeholder="Kg"
                className="w-20 h-8 text-sm"
                value={s.weight}
                onChange={e => {
                  const next = [...localSets];
                  next[i].weight = e.target.value;
                  setLocalSets(next);
                }}
              />
              <button
                onClick={() => onLogSet({
                  assigned_workout_id: assignedWorkoutId,
                  exercise_id: exerciseId,
                  set_number: i + 1,
                  reps_done: parseInt(s.reps) || 0,
                  weight_used: parseFloat(s.weight) || 0,
                })}
                className="transition-colors"
              >
                {isLogged ? (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground hover:text-primary" />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
