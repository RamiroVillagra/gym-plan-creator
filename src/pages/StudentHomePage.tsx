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
import { ChevronLeft, ChevronRight, Dumbbell, CheckCircle2, Circle, History, ArrowLeft, Play, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import VideoModal from "@/components/VideoModal";

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
  const workoutIds = workouts?.map((w: any) => w.id) ?? [];
  const { data: completedWorkoutIds } = useQuery({
    queryKey: ["student-completed", clientId, start, end],
    enabled: !!workouts?.length,
    queryFn: async () => {
      const ids = workoutIds;
      if (!ids.length) return new Set<string>();
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
        onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["student-completed"] });
            queryClient.invalidateQueries({ queryKey: ["student-workouts"] });
          }}
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
            onClick={() => { setCurrentDate(new Date()); setViewMode("month"); }}
            className="text-xs px-2.5 py-1 rounded-lg border border-primary/50 hover:bg-primary/10 transition-colors text-primary font-medium"
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
                      {dayWorkouts[0].routines?.name ?? "Sesión"}
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
                  <p className="font-bold">{w.routines?.name ?? "Sesión"}</p>
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
        .select("*, exercises(name, muscle_group, video_url)")
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
        .select("*, exercises(name, muscle_group, video_url)")
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
    mutationFn: async (params: { exercise_id: string; set_number: number; reps_done: number; weight_used: number; duration_done?: number; distance_done?: number }) => {
      const { error } = await supabase.from("workout_logs").upsert(
        { ...params, assigned_workout_id: workout.id, completed: true },
        { onConflict: "assigned_workout_id,exercise_id,set_number" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      refetchLogs();
      toast.success("Serie registrada");
    },
  });

  const saveAllSets = useMutation({
    mutationFn: async () => {
      // Detectar modificaciones para el toast
      const hasAnyModification = [...cardRefs.current.values()].some(card => card.hasModifications());

      // Guardar TODOS los ejercicios (no solo los modificados)
      const rows: any[] = [];
      for (const [, card] of cardRefs.current) {
        const sets = card.getSets();
        for (const s of sets) {
          rows.push({
            assigned_workout_id: workout.id,
            exercise_id: card.exerciseId,
            set_number: s.set_number,
            reps_done: s.reps_done,
            weight_used: s.weight_used,
            // aeróbico: solo presentes para ejercicios aeróbicos (undefined se omite al serializar)
            duration_done: (s as any).duration_done,
            distance_done: (s as any).distance_done,
            completed: true,
          });
        }
      }
      if (rows.length) {
        const { error } = await supabase.from("workout_logs").upsert(
          rows, { onConflict: "assigned_workout_id,exercise_id,set_number" }
        );
        if (error) throw error;
      }
      return hasAnyModification;
    },
    onSuccess: (hadChanges) => {
      refetchLogs();
      onSaved();
      if (hadChanges) {
        toast.success("¡Sesión guardada!");
      } else {
        toast.info("Entrenamiento confirmado — sin cambios respecto al plan");
      }
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

      {/* Mensaje del coach para esta sesión */}
      {workout.coach_note && (
        <div className="flex items-start gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2.5 mb-4">
          <MessageSquare className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-primary mb-0.5">Mensaje de tu coach</p>
            <p className="text-sm text-foreground whitespace-pre-wrap">{workout.coach_note}</p>
          </div>
        </div>
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
                coachNotes={re.notes ?? null}
                workoutType={re.workout_type ?? "strength"}
                duration={re.duration_seconds ?? null}
                distanceM={re.distance_meters ?? null}
                micro={re.micro_pause ?? null}
                macro={re.macro_pause ?? null}
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

      {exercises.length > 0 && (
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

  // Sync notes when navigating to a different workout
  useEffect(() => {
    setNotes(initialNotes);
    setSaved(true);
  }, [workoutId]); // eslint-disable-line react-hooks/exhaustive-deps
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
  exercise, sets, reps, weight, unit = "kg", setGroups, coachNotes, exerciseId, existingLogs, prevLogs, onLogSet,
  workoutType = "strength", duration, distanceM, micro, macro,
}: {
  exercise: any; sets: number; reps: number; weight: number | null; unit?: string;
  setGroups?: { sets: number; reps: number; weight: number | null }[] | null;
  coachNotes?: string | null;
  exerciseId: string; existingLogs: any[]; prevLogs: any[];
  onLogSet: (params: { exercise_id: string; set_number: number; reps_done: number; weight_used: number; duration_done?: number; distance_done?: number }) => void;
  // Aeróbico (no afecta a Fuerza)
  workoutType?: string; duration?: number | null; distanceM?: number | null; micro?: number | null; macro?: number | null;
}, ref: any) {
  const [showPrev, setShowPrev] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const allSets = setGroups?.length
    ? setGroups.flatMap(g => Array.from({ length: g.sets }, () => ({ targetReps: g.reps, targetWeight: g.weight })))
    : Array.from({ length: sets ?? 1 }, () => ({ targetReps: reps, targetWeight: weight }));

  const [localSets, setLocalSets] = useState(
    allSets.map((s, i) => {
      const log = existingLogs.find((l: any) => l.set_number === i + 1);
      const prevLog = prevLogs.find((l: any) => l.set_number === i + 1);
      return {
        reps: log?.reps_done?.toString() ?? s.targetReps?.toString() ?? "",
        // Prioridad: log de hoy → peso del PLAN (incl. series divididas) → peso anterior.
        // El plan del coach manda sobre lo que se hizo la última vez; así, si el alumno
        // guarda sin tocar nada, se registra el valor planificado (no el de la sesión previa).
        // El peso anterior sigue visible con el toggle "ver anterior".
        weightDone: log?.weight_used?.toString() ?? s.targetWeight?.toString() ?? prevLog?.weight_used?.toString() ?? "",
      };
    })
  );

  // Snapshot del estado inicial (al montar) para detectar si el usuario cambió algo
  // Comparamos contra esto, no contra el plan, para no confundir prevLogs con modificaciones
  const initialSetsRef = useRef(localSets);

  // Estado AERÓBICO: tiempo/distancia realizados por serie (pre-relleno con el plan o el log)
  const [aeroSets, setAeroSets] = useState(
    Array.from({ length: sets ?? 1 }, (_, i) => {
      const log = existingLogs.find((l: any) => l.set_number === i + 1);
      return {
        duration: log?.duration_done?.toString() ?? (duration != null ? String(duration) : ""),
        distance: log?.distance_done?.toString() ?? (distanceM != null ? String(distanceM) : ""),
      };
    })
  );
  const initialAeroRef = useRef(aeroSets);

  useImperativeHandle(ref, () => ({
    exerciseId,
    getSets: () => {
      if (workoutType === "aerobic") {
        return aeroSets.map((s, i) => ({
          set_number:  i + 1,
          reps_done:   0,
          weight_used: 0,
          duration_done: s.duration ? parseFloat(s.duration) : (duration ?? 0),
          distance_done: s.distance ? parseFloat(s.distance) : (distanceM ?? 0),
        }));
      }
      return localSets.map((s, i) => {
        const pReps   = parseInt(s.reps);
        const pWeight = parseFloat(s.weightDone);
        return {
          set_number:   i + 1,
          reps_done:    isNaN(pReps)   ? (allSets[i]?.targetReps   ?? 0) : pReps,
          weight_used:  isNaN(pWeight) ? (allSets[i]?.targetWeight  ?? 0) : pWeight,
        };
      });
    },
    // True solo si el usuario cambió algo respecto a lo que estaba pre-relleno al abrir
    hasModifications: () => {
      if (workoutType === "aerobic") {
        return aeroSets.some((s, i) =>
          s.duration !== initialAeroRef.current[i]?.duration ||
          s.distance !== initialAeroRef.current[i]?.distance
        );
      }
      return localSets.some((s, i) =>
        s.reps       !== initialSetsRef.current[i]?.reps ||
        s.weightDone !== initialSetsRef.current[i]?.weightDone
      );
    },
  }));

  // ── Vista AERÓBICA (misma tarjeta que Fuerza, con datos aeróbicos) ──
  if (workoutType === "aerobic") {
    // La duración es un solo valor en su unidad (seg o m)
    const aUnit = distanceM != null ? "m" : "seg";
    const planVal = distanceM ?? duration ?? null;
    return (
      <div className="bg-sky-500/5 border border-sky-500/30 rounded-xl p-4 mb-3">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2">
              <p className="text-lg font-heading font-bold text-foreground leading-snug break-words">{exercise?.name}</p>
              {(exercise as any)?.video_url && (
                <button onClick={() => setVideoUrl((exercise as any).video_url)} title="Ver video del ejercicio" className="shrink-0 mt-0.5">
                  <Play className="h-4 w-4 text-primary hover:text-primary/70 transition-colors" />
                </button>
              )}
              <VideoModal url={videoUrl} onClose={() => setVideoUrl(null)} />
            </div>
            {coachNotes && (
              <p className="text-xs text-amber-500 mt-1 italic">💬 {coachNotes}</p>
            )}
          </div>
          <div className="flex flex-col items-end shrink-0 gap-0.5">
            <span className="text-[9px] font-bold uppercase tracking-wide text-sky-500 bg-sky-500/10 px-1.5 py-0.5 rounded-full">Aeróbico</span>
            <span className="text-xs text-muted-foreground whitespace-nowrap">{sets}×{reps ?? "?"}</span>
          </div>
        </div>

        {/* Datos del plan aeróbico */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mb-3">
          {planVal != null ? <span>{aUnit === "m" ? "📏 Distancia" : "⏱ Tiempo"}: <span className="text-foreground font-medium">{planVal}{aUnit === "m" ? "m" : "s"}</span></span> : null}
          {micro ? <span>Micro pausa: <span className="text-foreground font-medium">{micro}s</span></span> : null}
          {macro ? <span>Macro pausa: <span className="text-foreground font-medium">{macro}s</span></span> : null}
        </div>

        {/* Encabezados */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] text-muted-foreground w-14" />
          <span className="text-[10px] text-muted-foreground w-20 text-center">{aUnit === "m" ? "Distancia (m)" : "Tiempo (s)"} realizado</span>
          <span className="w-7" />
        </div>
        {/* Una fila por serie: el alumno registra lo que hizo (en la unidad del plan) */}
        <div className="space-y-2">
          {aeroSets.map((s, i) => {
            const isLogged = existingLogs.some((l: any) => l.set_number === i + 1 && l.completed);
            const val = aUnit === "m" ? s.distance : s.duration;
            const setVal = (v: string) => {
              const n = [...aeroSets];
              if (aUnit === "m") n[i].distance = v; else n[i].duration = v;
              setAeroSets(n);
            };
            return (
              <div key={i} className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-14">Serie {i + 1}</span>
                <Input
                  type="number" inputMode="numeric" placeholder={aUnit === "m" ? "m" : "seg"}
                  className="w-20 h-10 text-base text-center"
                  value={val}
                  onChange={e => setVal(e.target.value)}
                />
                <button onClick={() => onLogSet({
                  exercise_id: exerciseId, set_number: i + 1, reps_done: 0, weight_used: 0,
                  duration_done: aUnit === "seg" ? (s.duration ? parseFloat(s.duration) : (duration ?? 0)) : 0,
                  distance_done: aUnit === "m" ? (s.distance ? parseFloat(s.distance) : (distanceM ?? 0)) : 0,
                })}>
                  {isLogged
                    ? <CheckCircle2 className="h-7 w-7 text-sky-500" />
                    : <Circle className="h-7 w-7 text-muted-foreground hover:text-sky-500" />
                  }
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 mb-3">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <p className="text-lg font-heading font-bold text-foreground leading-snug break-words">{exercise?.name}</p>
            {(exercise as any)?.video_url && (
              <button onClick={() => setVideoUrl((exercise as any).video_url)} title="Ver video del ejercicio" className="shrink-0 mt-0.5">
                <Play className="h-4 w-4 text-primary hover:text-primary/70 transition-colors" />
              </button>
            )}
            <VideoModal url={videoUrl} onClose={() => setVideoUrl(null)} />
          </div>
          {coachNotes && (
            <p className="text-xs text-amber-500 mt-1 italic">💬 {coachNotes}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {setGroups?.length ? (
            <div className="text-right">
              {setGroups.map((g, i) => (
                <p key={i} className="text-xs text-muted-foreground">{g.sets}×{g.reps}{g.weight ? ` @ ${g.weight}${unit}` : ""}</p>
              ))}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground whitespace-nowrap">{sets}×{reps}{weight ? ` @ ${weight}${unit}` : ""}</span>
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
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] text-muted-foreground w-16" />
        <span className="text-[10px] text-muted-foreground w-16 text-center">Reps</span>
        <span className="text-[10px] text-muted-foreground w-20 text-center">Planif.</span>
        <span className="text-[10px] text-muted-foreground w-20 text-center">Realiz.</span>
        <span className="w-7" />
      </div>

      <div className="space-y-2">
        {localSets.map((s, i) => {
          const isLogged = existingLogs.some((l: any) => l.set_number === i + 1 && l.completed);
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground w-16">Serie {i + 1}</span>
              <Input
                type="number"
                inputMode="numeric"
                className="w-16 h-10 text-base text-center"
                value={s.reps}
                onChange={e => { const n = [...localSets]; n[i].reps = e.target.value; setLocalSets(n); }}
              />
              <span className="text-xs text-muted-foreground w-20 text-center">
                {allSets[i]?.targetWeight ? `${allSets[i].targetWeight}${unit}` : "—"}
              </span>
              <Input
                type="number"
                inputMode="numeric"
                placeholder={unit}
                className="w-20 h-10 text-base"
                value={s.weightDone}
                onChange={e => { const n = [...localSets]; n[i].weightDone = e.target.value; setLocalSets(n); }}
              />
              <button onClick={() => {
                // #1: isNaN para que 0 sea un valor registrable
                const pReps   = parseInt(s.reps);
                const pWeight = parseFloat(s.weightDone);
                onLogSet({
                  exercise_id: exerciseId,
                  set_number:  i + 1,
                  reps_done:   isNaN(pReps)   ? 0 : pReps,
                  weight_used: isNaN(pWeight) ? 0 : pWeight,
                });
              }}>
                {isLogged
                  ? <CheckCircle2 className="h-7 w-7 text-primary" />
                  : <Circle className="h-7 w-7 text-muted-foreground hover:text-primary" />
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
