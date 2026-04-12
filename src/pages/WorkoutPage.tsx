import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle2, Circle, Dumbbell, History } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function WorkoutPage() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [selectedClient, setSelectedClient] = useState("");
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: myClientId } = useQuery({
    queryKey: ["my-client-id", user?.id],
    enabled: role === "student" && !!user,
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id").eq("user_id", user!.id).maybeSingle();
      return data?.id ?? null;
    },
  });

  const effectiveClientId = role === "student" ? (myClientId ?? "") : selectedClient;

  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: todayWorkouts } = useQuery({
    queryKey: ["today-workouts", effectiveClientId, today],
    enabled: !!effectiveClientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assigned_workouts")
        .select("*, routines(name, total_days)")
        .eq("client_id", effectiveClientId)
        .eq("workout_date", today);
      if (error) throw error;
      return data;
    },
  });

  const { data: assignedExercises } = useQuery({
    queryKey: ["workout-assigned-exercises", todayWorkouts?.map((w: any) => w.id)],
    enabled: !!todayWorkouts?.length,
    queryFn: async () => {
      const ids = todayWorkouts!.map((w: any) => w.id);
      const { data, error } = await supabase
        .from("assigned_workout_exercises")
        .select("*, exercises(name, muscle_group)")
        .in("assigned_workout_id", ids)
        .order("block_number")
        .order("order_index");
      if (error) throw error;
      return data;
    },
  });

  const { data: existingLogs } = useQuery({
    queryKey: ["workout-logs", todayWorkouts?.map((w: any) => w.id)],
    enabled: !!todayWorkouts?.length,
    queryFn: async () => {
      const workoutIds = todayWorkouts!.map((w: any) => w.id);
      const { data, error } = await supabase.from("workout_logs").select("*").in("assigned_workout_id", workoutIds);
      if (error) throw error;
      return data;
    },
  });

  // Fetch previous session logs
  const { data: previousLogs } = useQuery({
    queryKey: ["prev-workout-logs", effectiveClientId, todayWorkouts?.map((w: any) => w.routine_id)],
    enabled: !!todayWorkouts?.length && !!effectiveClientId,
    queryFn: async () => {
      const result: Record<string, any[]> = {};
      for (const w of todayWorkouts!) {
        if (!w.routine_id) continue;
        const { data: prevWorkouts } = await supabase
          .from("assigned_workouts")
          .select("id")
          .eq("client_id", effectiveClientId)
          .eq("routine_id", w.routine_id)
          .neq("id", w.id)
          .lt("workout_date", today)
          .order("workout_date", { ascending: false })
          .limit(1);
        if (prevWorkouts?.length) {
          const { data: logs } = await supabase
            .from("workout_logs")
            .select("*")
            .eq("assigned_workout_id", prevWorkouts[0].id);
          result[w.id] = logs ?? [];
        }
      }
      return result;
    },
  });

  const logSet = useMutation({
    mutationFn: async (params: {
      assigned_workout_id: string; exercise_id: string;
      set_number: number; reps_done: number; weight_used: number;
    }) => {
      const existing = existingLogs?.find(
        l => l.assigned_workout_id === params.assigned_workout_id &&
          l.exercise_id === params.exercise_id &&
          l.set_number === params.set_number
      );
      if (existing) {
        const { error } = await supabase.from("workout_logs").update({
          reps_done: params.reps_done, weight_used: params.weight_used, completed: true,
        }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("workout_logs").insert({ ...params, completed: true });
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

      {role === "coach" && (
        <select
          className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground mb-6"
          value={selectedClient}
          onChange={e => setSelectedClient(e.target.value)}
        >
          <option value="">Selecciona un alumno</option>
          {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}
      {role === "student" && !myClientId && (
        <div className="text-center py-12 text-muted-foreground">
          <p>Tu cuenta aún no está vinculada a un perfil de alumno. Pedile a tu coach que te vincule.</p>
        </div>
      )}

      {effectiveClientId && !todayWorkouts?.length && (
        <div className="text-center py-12 text-muted-foreground">
          <Dumbbell className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No tienes entrenamiento asignado para hoy.</p>
        </div>
      )}

      {todayWorkouts?.map((workout: any) => {
        const dayNum = workout.day_number ?? 1;
        const exercises = (assignedExercises ?? [])
          .filter((e: any) => e.assigned_workout_id === workout.id && (e.day_number ?? 1) === dayNum);
        const blocks = [...new Set(exercises.map((re: any) => re.block_number ?? 1))].sort((a: number, b: number) => a - b);
        const prevLogs = previousLogs?.[workout.id] ?? [];

        return (
          <div key={workout.id} className="space-y-4 mb-6">
            {workout.routines?.name && (
              <h2 className="text-xl font-heading font-bold text-primary">
                {workout.routines.name}
                {(workout.routines?.total_days ?? 1) > 1 && (
                  <span className="text-sm font-normal text-muted-foreground ml-2">— Día {workout.day_number ?? 1}</span>
                )}
              </h2>
            )}
            {blocks.map((blockNum: number) => {
              const blockExercises = exercises.filter((re: any) => (re.block_number ?? 1) === blockNum);
              return (
                <div key={blockNum}>
                  {blocks.length > 1 && (
                    <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Bloque {blockNum}</p>
                  )}
                  {blockExercises.map((re: any) => (
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
                      prevLogs={prevLogs.filter((l: any) => l.exercise_id === re.exercise_id)}
                      onLogSet={logSet.mutate}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function ExerciseCard({
  exercise, sets, reps, weight, assignedWorkoutId, exerciseId, existingLogs, prevLogs, onLogSet
}: {
  exercise: any; sets: number; reps: number; weight: number | null;
  assignedWorkoutId: string; exerciseId: string; existingLogs: any[];
  prevLogs: any[];
  onLogSet: (params: any) => void;
}) {
  const [showPrev, setShowPrev] = useState(false);
  const [localSets, setLocalSets] = useState<{ reps: string; weightDone: string }[]>(
    Array.from({ length: sets }, (_, i) => {
      const log = existingLogs.find((l: any) => l.set_number === i + 1);
      // Pre-fill with previous session data if no current log
      const prevLog = prevLogs.find((l: any) => l.set_number === i + 1);
      return {
        reps: log?.reps_done?.toString() ?? reps.toString(),
        weightDone: log?.weight_used?.toString() ?? prevLog?.weight_used?.toString() ?? "",
      };
    })
  );

  return (
    <div className="bg-card border border-border rounded-xl p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-heading font-bold text-foreground">{exercise?.name}</p>
          {exercise?.muscle_group && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{exercise.muscle_group}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{sets}×{reps} {weight ? `@ ${weight}kg` : ""}</span>
          {prevLogs.length > 0 && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowPrev(!showPrev)} title="Ver sesión anterior">
              <History className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          )}
        </div>
      </div>

      {/* Previous session info */}
      {showPrev && prevLogs.length > 0 && (
        <div className="bg-secondary/50 rounded-lg px-3 py-2 mb-3">
          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Sesión anterior</p>
          {prevLogs.sort((a, b) => a.set_number - b.set_number).map((l: any) => (
            <p key={l.id} className="text-[10px] text-muted-foreground">
              Serie {l.set_number}: {l.reps_done ?? "—"} reps @ {l.weight_used ?? "—"}kg
            </p>
          ))}
        </div>
      )}

      {/* Header row */}
      <div className="flex items-center gap-3 mb-1 px-0">
        <span className="text-[10px] text-muted-foreground w-12"></span>
        <span className="text-[10px] text-muted-foreground w-14 text-center">Reps</span>
        <span className="text-[10px] text-muted-foreground w-20 text-center">Planif.</span>
        <span className="text-[10px] text-muted-foreground w-20 text-center">Realiz.</span>
        <span className="w-5"></span>
      </div>

      <div className="space-y-2">
        {localSets.map((s, i) => {
          const isLogged = existingLogs.some((l: any) => l.set_number === i + 1 && l.completed);
          return (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-12">Serie {i + 1}</span>
              <Input
                type="number"
                className="w-14 h-8 text-sm text-center"
                value={s.reps}
                onChange={e => {
                  const next = [...localSets];
                  next[i].reps = e.target.value;
                  setLocalSets(next);
                }}
              />
              <span className="text-xs text-muted-foreground w-20 text-center">{weight ? `${weight}kg` : "—"}</span>
              <Input
                type="number"
                placeholder="Kg"
                className="w-20 h-8 text-sm"
                value={s.weightDone}
                onChange={e => {
                  const next = [...localSets];
                  next[i].weightDone = e.target.value;
                  setLocalSets(next);
                }}
              />
              <button
                onClick={() => onLogSet({
                  assigned_workout_id: assignedWorkoutId,
                  exercise_id: exerciseId,
                  set_number: i + 1,
                  reps_done: parseInt(s.reps) || 0,
                  weight_used: parseFloat(s.weightDone) || 0,
                })}
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
