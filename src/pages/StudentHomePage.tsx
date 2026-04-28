import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  format, addWeeks, subWeeks, addMonths, subMonths,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  eachDayOfInterval, isSameDay, isSameMonth,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Dumbbell, CheckCircle2, Circle, History, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

type ViewMode = "week" | "month";

export default function StudentHomePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedWorkout, setSelectedWorkout] = useState<any>(null);
  const today = format(new Date(), "yyyy-MM-dd");

  // Rango de fechas según vista
  const { start, end, days } = getDateRange(viewMode, currentDate);

  // ID del cliente vinculado al usuario
  const { data: clientId } = useQuery({
    queryKey: ["my-client-id", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data?.id ?? null;
    },
  });

  // Workouts del rango visible
  const { data: workouts } = useQuery({
    queryKey: ["student-workouts", clientId, start, end],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assigned_workouts")
        .select("*, routines(name, total_days)")
        .eq("client_id", clientId!)
        .gte("workout_date", start)
        .lte("workout_date", end)
        .order("workout_date");
      if (error) throw error;
      return data;
    },
  });

  // Logs para saber cuáles días ya fueron completados
  const { data: completedWorkoutIds } = useQuery({
    queryKey: ["student-completed", workouts?.map((w: any) => w.id)],
    enabled: !!workouts?.length,
    queryFn: async () => {
      const ids = workouts!.map((w: any) => w.id);
      const { data } = await supabase
        .from("workout_logs")
        .select("assigned_workout_id")
        .in("assigned_workout_id", ids);
      return new Set(data?.map((l: any) => l.assigned_workout_id) ?? []);
    },
  });

  // Back button del navegador
  useEffect(() => {
    if (selectedWorkout) {
      window.history.pushState({ studentWorkout: true }, "");
      const handlePop = () => {
        setSelectedWorkout(null);
      };
      window.addEventListener("popstate", handlePop);
      return () => window.removeEventListener("popstate", handlePop);
    }
  }, [selectedWorkout]);

  const navigate = (dir: 1 | -1) => {
    if (viewMode === "week") setCurrentDate(dir === 1 ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
    else setCurrentDate(dir === 1 ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
  };

  const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  // Vista de entrenamiento de un día
  if (selectedWorkout) {
    return (
      <WorkoutDetail
        workout={selectedWorkout}
        clientId={clientId!}
        onBack={() => setSelectedWorkout(null)}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["student-completed"] })}
      />
    );
  }

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-heading font-bold capitalize">
          {format(currentDate, "MMMM yyyy", { locale: es })}
        </h1>
        <p className="text-sm text-muted-foreground mt-1 capitalize">
          {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
        </p>
      </div>

      {/* Controles de navegación */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-lg border border-border hover:bg-secondary transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => navigate(1)}
            className="p-1.5 rounded-lg border border-border hover:bg-secondary transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="text-xs px-2.5 py-1 rounded-lg border border-border hover:bg-secondary transition-colors text-muted-foreground"
          >
            Hoy
          </button>
        </div>

        {/* Toggle semana/mes */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          {(["week", "month"] as ViewMode[]).map(v => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === v ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {v === "week" ? "Semana" : "Mes"}
            </button>
          ))}
        </div>
      </div>

      {/* Grilla de días */}
      <div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {dayNames.map(d => (
            <div key={d} className="text-center text-[10px] text-muted-foreground font-medium py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map(day => {
            const dateStr = format(day, "yyyy-MM-dd");
            const isToday = isSameDay(day, new Date());
            const isCurrentMonth = viewMode === "month" ? isSameMonth(day, currentDate) : true;
            const dayWorkouts = workouts?.filter((w: any) => w.workout_date === dateStr) ?? [];
            const hasWorkout = dayWorkouts.length > 0;
            const isCompleted = dayWorkouts.some((w: any) => completedWorkoutIds?.has(w.id));
            const isPast = dateStr < today;

            return (
              <div
                key={dateStr}
                onClick={() => {
                  if (hasWorkout) setSelectedWorkout(dayWorkouts[0]);
                }}
                className={`rounded-xl p-1.5 min-h-[64px] flex flex-col overflow-hidden transition-colors ${
                  hasWorkout ? "cursor-pointer" : "cursor-default"
                } ${
                  isToday
                    ? "border-2 border-primary bg-primary/5"
                    : hasWorkout
                    ? "border border-primary/30 bg-card hover:bg-primary/5"
                    : "border border-border bg-card/50"
                } ${!isCurrentMonth ? "opacity-25" : ""}`}
              >
                {/* Número del día + check */}
                <div className="flex items-center justify-between mb-0.5">
                  <p className={`text-xs font-bold leading-none ${isToday ? "text-primary" : "text-foreground"}`}>
                    {format(day, "d")}
                  </p>
                  {isCompleted && (
                    <CheckCircle2 className="h-2.5 w-2.5 text-primary shrink-0" />
                  )}
                </div>

                {/* Nombre del entrenamiento — truncado, nunca desborda */}
                {hasWorkout && dayWorkouts[0] && (
                  <div className="min-w-0 flex-1">
                    <p className={`text-[9px] font-semibold leading-tight truncate ${
                      isCompleted ? "text-primary" : isToday ? "text-primary" : isPast ? "text-muted-foreground" : "text-foreground"
                    }`}>
                      {dayWorkouts[0].routines?.name ?? "Libre"}
                    </p>
                    {(dayWorkouts[0].routines?.total_days ?? 1) > 1 && (
                      <p className="text-[8px] text-muted-foreground leading-none mt-0.5">
                        D{dayWorkouts[0].day_number ?? 1}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Entrenamiento de hoy (acceso rápido) */}
      {(() => {
        const todayWorkouts = workouts?.filter((w: any) => w.workout_date === today) ?? [];
        if (!todayWorkouts.length) return (
          <div className="mt-6 text-center py-8 text-muted-foreground text-sm">
            No tenés entrenamiento asignado para hoy.
          </div>
        );
        return (
          <div className="mt-6">
            <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Hoy</p>
            {todayWorkouts.map((w: any) => (
              <button
                key={w.id}
                onClick={() => setSelectedWorkout(w)}
                className="w-full flex items-center justify-between bg-primary text-primary-foreground rounded-xl px-4 py-3.5 font-semibold hover:bg-primary/90 transition-colors"
              >
                <div className="text-left">
                  <p className="font-bold">{w.routines?.name ?? "Entrenamiento libre"}</p>
                  {(w.routines?.total_days ?? 1) > 1 && (
                    <p className="text-xs opacity-80">Día {w.day_number ?? 1}</p>
                  )}
                </div>
                <ChevronRight className="h-5 w-5" />
              </button>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

// ─── Vista de detalle del entrenamiento del día ────────────────────────────────

function WorkoutDetail({ workout, clientId, onBack, onSaved }: {
  workout: any;
  clientId: string;
  onBack: () => void;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const cardRefs = useRef<Map<string, any>>(new Map());
  const today = format(new Date(), "yyyy-MM-dd");
  const isToday = workout.workout_date === today;

  const { data: assignedExercises } = useQuery({
    queryKey: ["student-assigned-ex", workout.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assigned_workout_exercises")
        .select("*, exercises(name, muscle_group)")
        .eq("assigned_workout_id", workout.id)
        .order("block_number")
        .order("order_index");
      if (error) throw error;
      return data;
    },
  });

  const { data: routineExercises } = useQuery({
    queryKey: ["student-routine-ex", workout.routine_id, workout.day_number],
    enabled: !!workout.routine_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routine_exercises")
        .select("*, exercises(name, muscle_group)")
        .eq("routine_id", workout.routine_id)
        .eq("day_number", workout.day_number ?? 1)
        .order("block_number")
        .order("order_index");
      if (error) throw error;
      return data;
    },
  });

  const { data: existingLogs, refetch: refetchLogs } = useQuery({
    queryKey: ["student-logs", workout.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workout_logs")
        .select("*")
        .eq("assigned_workout_id", workout.id);
      if (error) throw error;
      return data;
    },
  });

  const { data: prevLogs } = useQuery({
    queryKey: ["student-prev-logs", clientId, workout.routine_id, workout.id],
    enabled: !!workout.routine_id,
    queryFn: async () => {
      const { data: prevWorkouts } = await supabase
        .from("assigned_workouts")
        .select("id")
        .eq("client_id", clientId)
        .eq("routine_id", workout.routine_id)
        .neq("id", workout.id)
        .lt("workout_date", workout.workout_date)
        .order("workout_date", { ascending: false })
        .limit(1);
      if (!prevWorkouts?.length) return [];
      const { data: logs } = await supabase
        .from("workout_logs")
        .select("*")
        .eq("assigned_workout_id", prevWorkouts[0].id);
      return logs ?? [];
    },
  });

  const saveNote = useMutation({
    mutationFn: async (notes: string) => {
      const { error } = await supabase.from("assigned_workouts").update({ notes }).eq("id", workout.id);
      if (error) throw error;
    },
    onSuccess: () => toast.success("Comentario guardado"),
  });

  const logSet = useMutation({
    mutationFn: async (params: { exercise_id: string; set_number: number; reps_done: number; weight_used: number }) => {
      const existing = existingLogs?.find(
        (l: any) => l.exercise_id === params.exercise_id && l.set_number === params.set_number
      );
      if (existing) {
        const { error } = await supabase.from("workout_logs").update({
          reps_done: params.reps_done, weight_used: params.weight_used, completed: true,
        }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("workout_logs").insert({
          ...params, assigned_workout_id: workout.id, completed: true,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      refetchLogs();
      toast.success("Serie registrada");
    },
  });

  const saveAllSets = useMutation({
    mutationFn: async () => {
      for (const [, card] of cardRefs.current) {
        const sets = card.getSets();
        for (const s of sets) {
          const existing = existingLogs?.find(
            (l: any) => l.exercise_id === card.exerciseId && l.set_number === s.set_number
          );
          if (existing) {
            await supabase.from("workout_logs").update({
              reps_done: s.reps_done, weight_used: s.weight_used, completed: true,
            }).eq("id", existing.id);
          } else {
            await supabase.from("workout_logs").insert({
              assigned_workout_id: workout.id,
              exercise_id: card.exerciseId,
              set_number: s.set_number,
              reps_done: s.reps_done,
              weight_used: s.weight_used,
              completed: true,
            });
          }
        }
      }
    },
    onSuccess: () => {
      refetchLogs();
      onSaved();
      toast.success("¡Sesión guardada!");
    },
    onError: () => toast.error("Error al guardar"),
  });

  const exercises = assignedExercises?.length ? assignedExercises : (routineExercises ?? []);
  const blocks = [...new Set(exercises.map((e: any) => e.block_number ?? 1))].sort((a: number, b: number) => a - b);

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </button>
        <span className="text-sm text-muted-foreground">
          {format(new Date(workout.workout_date + "T12:00:00"), "EEEE d 'de' MMMM", { locale: es })}
        </span>
      </div>

      {/* Nombre rutina */}
      {workout.routines?.name && (
        <h2 className="text-xl font-heading font-bold text-primary mb-4">
          {workout.routines.name}
          {(workout.routines?.total_days ?? 1) > 1 && (
            <span className="text-sm font-normal text-muted-foreground ml-2">— Día {workout.day_number ?? 1}</span>
          )}
        </h2>
      )}

      {/* Ejercicios */}
      {blocks.map((blockNum: number) => {
        const blockExercises = exercises.filter((e: any) => (e.block_number ?? 1) === blockNum);
        return (
          <div key={blockNum} className="mb-4">
            {blocks.length > 1 && (
              <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Bloque {blockNum}</p>
            )}
            {blockExercises.map((re: any) => (
              <ExerciseCard
                key={re.id}
                ref={(el: any) => {
                  const key = `${workout.id}-${re.exercise_id}`;
                  if (el) cardRefs.current.set(key, el);
                  else cardRefs.current.delete(key);
                }}
                exercise={re.exercises}
                sets={re.sets}
                reps={re.reps}
                weight={re.weight}
                unit={re.unit ?? "kg"}
                setGroups={re.set_groups}
                exerciseId={re.exercise_id}
                existingLogs={existingLogs?.filter((l: any) => l.exercise_id === re.exercise_id) ?? []}
                prevLogs={(prevLogs ?? []).filter((l: any) => l.exercise_id === re.exercise_id)}
                onLogSet={(params) => logSet.mutate(params)}
              />
            ))}
          </div>
        );
      })}

      {exercises.length === 0 && (
        <div className="text-center py-10 text-muted-foreground">
          <Dumbbell className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No hay ejercicios cargados para este día.</p>
        </div>
      )}

      {/* Botón guardar sesión (solo si es hoy o ya pasó) */}
      {exercises.length > 0 && (workout.workout_date <= today) && (
        <button
          onClick={() => saveAllSets.mutate()}
          disabled={saveAllSets.isPending}
          className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-bold text-base tracking-wide shadow-md hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
        >
          <CheckCircle2 className="h-5 w-5" />
          {saveAllSets.isPending ? "Guardando..." : "Guardar sesión completa"}
        </button>
      )}

      {/* Comentarios */}
      <WorkoutNotes
        workoutId={workout.id}
        initialNotes={workout.notes ?? ""}
        onSave={(notes) => saveNote.mutate(notes)}
      />
    </div>
  );
}

// ─── Componentes auxiliares ────────────────────────────────────────────────────

function WorkoutNotes({ workoutId, initialNotes, onSave }: { workoutId: string; initialNotes: string; onSave: (notes: string) => void }) {
  const [notes, setNotes] = useState(initialNotes);
  const [saved, setSaved] = useState(true);
  return (
    <div className="bg-card border border-border rounded-xl p-4 mt-4">
      <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Comentarios de la sesión</p>
      <textarea
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
        rows={3}
        placeholder="Cómo te sentiste, qué ajustar..."
        value={notes}
        onChange={e => { setNotes(e.target.value); setSaved(false); }}
      />
      <div className="flex justify-end mt-2">
        <button
          disabled={saved}
          onClick={() => { onSave(notes); setSaved(true); }}
          className="text-xs font-medium px-3 py-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-default transition-opacity"
        >
          {saved ? "Guardado" : "Guardar comentario"}
        </button>
      </div>
    </div>
  );
}

const ExerciseCard = forwardRef(function ExerciseCard({
  exercise, sets, reps, weight, unit = "kg", setGroups, exerciseId, existingLogs, prevLogs, onLogSet,
}: {
  exercise: any; sets: number; reps: number; weight: number | null; unit?: string;
  setGroups?: { sets: number; reps: number; weight: number | null }[] | null;
  exerciseId: string; existingLogs: any[]; prevLogs: any[];
  onLogSet: (params: { exercise_id: string; set_number: number; reps_done: number; weight_used: number }) => void;
}, ref: any) {
  const [showPrev, setShowPrev] = useState(false);

  const allSets = setGroups?.length
    ? setGroups.flatMap(g => Array.from({ length: g.sets }, () => ({ targetReps: g.reps, targetWeight: g.weight })))
    : Array.from({ length: sets ?? 1 }, () => ({ targetReps: reps, targetWeight: weight }));

  const [localSets, setLocalSets] = useState(
    allSets.map((s, i) => {
      const log = existingLogs.find((l: any) => l.set_number === i + 1);
      const prevLog = prevLogs.find((l: any) => l.set_number === i + 1);
      return {
        reps: log?.reps_done?.toString() ?? s.targetReps?.toString() ?? "",
        weightDone: log?.weight_used?.toString() ?? prevLog?.weight_used?.toString() ?? "",
      };
    })
  );

  useImperativeHandle(ref, () => ({
    exerciseId,
    getSets: () => localSets.map((s, i) => ({
      set_number: i + 1,
      reps_done: parseInt(s.reps) || 0,
      weight_used: parseFloat(s.weightDone) || 0,
    })),
  }));

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
          {setGroups?.length ? (
            <div className="text-right">
              {setGroups.map((g, i) => (
                <p key={i} className="text-xs text-muted-foreground">{g.sets}×{g.reps}{g.weight ? ` @ ${g.weight}${unit}` : ""}</p>
              ))}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">{sets}×{reps}{weight ? ` @ ${weight}${unit}` : ""}</span>
          )}
          {prevLogs.length > 0 && (
            <button onClick={() => setShowPrev(!showPrev)} className="p-1 rounded hover:bg-secondary transition-colors">
              <History className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {showPrev && prevLogs.length > 0 && (
        <div className="bg-secondary/50 rounded-lg px-3 py-2 mb-3">
          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Sesión anterior</p>
          {prevLogs.sort((a, b) => a.set_number - b.set_number).map((l: any) => (
            <p key={l.id} className="text-[10px] text-muted-foreground">
              Serie {l.set_number}: {l.reps_done ?? "—"} reps @ {l.weight_used ?? "—"}{unit}
            </p>
          ))}
        </div>
      )}

      {/* Headers */}
      <div className="flex items-center gap-3 mb-1">
        <span className="text-[10px] text-muted-foreground w-12" />
        <span className="text-[10px] text-muted-foreground w-14 text-center">Reps</span>
        <span className="text-[10px] text-muted-foreground w-20 text-center">Planif.</span>
        <span className="text-[10px] text-muted-foreground w-20 text-center">Realiz.</span>
        <span className="w-5" />
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
                onChange={e => { const n = [...localSets]; n[i].reps = e.target.value; setLocalSets(n); }}
              />
              <span className="text-xs text-muted-foreground w-20 text-center">
                {allSets[i]?.targetWeight ? `${allSets[i].targetWeight}${unit}` : "—"}
              </span>
              <Input
                type="number"
                placeholder={unit}
                className="w-20 h-8 text-sm"
                value={s.weightDone}
                onChange={e => { const n = [...localSets]; n[i].weightDone = e.target.value; setLocalSets(n); }}
              />
              <button onClick={() => onLogSet({
                exercise_id: exerciseId,
                set_number: i + 1,
                reps_done: parseInt(s.reps) || 0,
                weight_used: parseFloat(s.weightDone) || 0,
              })}>
                {isLogged
                  ? <CheckCircle2 className="h-5 w-5 text-primary" />
                  : <Circle className="h-5 w-5 text-muted-foreground hover:text-primary" />
                }
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
});

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getDateRange(viewMode: ViewMode, currentDate: Date) {
  if (viewMode === "week") {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
    return {
      start: format(weekStart, "yyyy-MM-dd"),
      end: format(weekEnd, "yyyy-MM-dd"),
      days: eachDayOfInterval({ start: weekStart, end: weekEnd }),
    };
  } else {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return {
      start: format(monthStart, "yyyy-MM-dd"),
      end: format(monthEnd, "yyyy-MM-dd"),
      days: eachDayOfInterval({ start: gridStart, end: gridEnd }),
    };
  }
}
