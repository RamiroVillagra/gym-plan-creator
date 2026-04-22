import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  format, addDays, addWeeks, addMonths, startOfWeek, startOfMonth, endOfMonth, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, subMonths, subWeeks
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Trash2, CalendarDays, Pencil, Copy, Search, X, MessageSquare, Save } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import RoutineDetailView from "@/components/RoutineDetailView";

type ViewMode = "month" | "week" | "day";

export default function CalendarPage() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [filterClient, setFilterClient] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  // Assign dialog
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedRoutine, setSelectedRoutine] = useState("");

  // Edit workout dialog
  const [editWorkoutOpen, setEditWorkoutOpen] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<any>(null);
  const [editWorkoutRoutine, setEditWorkoutRoutine] = useState("");
  const [editWorkoutDay, setEditWorkoutDay] = useState("1");

  // Selected day for assign/edit
  const [selectedDay, setSelectedDay] = useState("1");

  // Workout detail dialog
  const [detailWorkout, setDetailWorkout] = useState<any>(null);

  // Copy dialog (mismo alumno, otros días)
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyDays, setCopyDays] = useState<{ dayOfWeek: number; routineDay: number }[]>([]);
  const [copyWeeks, setCopyWeeks] = useState("1");

  // Copy to client dialog (otro alumno)
  const [copyToClientOpen, setCopyToClientOpen] = useState(false);
  const [copyToClient, setCopyToClient] = useState("");
  const [copyToClientName, setCopyToClientName] = useState("");
  const [copyToClientSearch, setCopyToClientSearch] = useState("");
  const [copyToDate, setCopyToDate] = useState("");
  const [copyToWeekOffset, setCopyToWeekOffset] = useState(0);

  // Bulk assign dialog
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState<"client" | "group">("client");
  const [bulkClient, setBulkClient] = useState("");
  const [bulkClientName, setBulkClientName] = useState("");
  const [bulkClientSearch, setBulkClientSearch] = useState("");
  const [bulkGroup, setBulkGroup] = useState("");
  const [bulkGroupName, setBulkGroupName] = useState("");
  const [bulkGroupSearch, setBulkGroupSearch] = useState("");
  const [bulkRoutine, setBulkRoutine] = useState("");
  const [bulkRoutineName, setBulkRoutineName] = useState("");
  const [bulkRoutineSearch, setBulkRoutineSearch] = useState("");
  const [bulkDays, setBulkDays] = useState<{ dayOfWeek: number; routineDay: number }[]>([]);
  const [bulkWeeks, setBulkWeeks] = useState("4");

  const { dateRange, days } = getDateRange(viewMode, currentDate);

  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: groups } = useQuery({
    queryKey: ["groups"],
    queryFn: async () => {
      const { data, error } = await supabase.from("groups").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: groupMembers } = useQuery({
    queryKey: ["all-group-members"],
    queryFn: async () => {
      const { data, error } = await supabase.from("group_members").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: routines } = useQuery({
    queryKey: ["routines"],
    queryFn: async () => {
      const { data, error } = await supabase.from("routines").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: workouts } = useQuery({
    queryKey: ["assigned-workouts", dateRange.start, dateRange.end, filterClient],
    enabled: !!filterClient,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assigned_workouts")
        .select("*, clients(name), routines(name, total_days)")
        .gte("workout_date", dateRange.start)
        .lte("workout_date", dateRange.end)
        .eq("client_id", filterClient)
        .order("workout_date");
      if (error) throw error;
      return data;
    },
  });

  const assignWorkout = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("assigned_workouts").insert({
        client_id: selectedClient,
        routine_id: selectedRoutine || null,
        workout_date: format(selectedDate!, "yyyy-MM-dd"),
        day_number: parseInt(selectedDay) || 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assigned-workouts"] });
      setAssignOpen(false);
      setSelectedClient(""); setSelectedRoutine(""); setSelectedDay("1");
      toast.success("Entrenamiento asignado");
    },
  });

  const updateWorkout = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("assigned_workouts").update({
        routine_id: editWorkoutRoutine || null,
        day_number: parseInt(editWorkoutDay) || 1,
      }).eq("id", editingWorkout.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assigned-workouts"] });
      setEditWorkoutOpen(false);
      setEditingWorkout(null);
      toast.success("Entrenamiento actualizado");
    },
  });

  const copyWorkout = useMutation({
    mutationFn: async () => {
      if (!detailWorkout || !copyDays.length) return;
      const weeks = parseInt(copyWeeks) || 1;
      const workoutDate = new Date(detailWorkout.workout_date + "T12:00:00");

      // Para cada día destino, obtener sus ejercicios según el routineDay elegido
      const exercisesByRoutineDay: Record<number, any[]> = {};
      for (const { routineDay } of copyDays) {
        if (exercisesByRoutineDay[routineDay] !== undefined) continue;
        const { data: overrides } = await supabase
          .from("assigned_workout_exercises")
          .select("*")
          .eq("assigned_workout_id", detailWorkout.id)
          .eq("day_number", routineDay);
        if (overrides?.length) {
          exercisesByRoutineDay[routineDay] = overrides;
        } else if (detailWorkout.routine_id) {
          const { data: base } = await supabase
            .from("routine_exercises")
            .select("*")
            .eq("routine_id", detailWorkout.routine_id)
            .eq("day_number", routineDay);
          exercisesByRoutineDay[routineDay] = base ?? [];
        } else {
          exercisesByRoutineDay[routineDay] = [];
        }
      }

      const inserts: any[] = [];
      const targetDates: string[] = [];
      for (let w = 0; w < weeks; w++) {
        for (const { dayOfWeek, routineDay } of copyDays) {
          const weekStart = startOfWeek(addWeeks(workoutDate, w + 1), { weekStartsOn: 1 });
          const date = addDays(weekStart, dayOfWeek);
          const dateStr = format(date, "yyyy-MM-dd");
          targetDates.push(dateStr);
          inserts.push({
            client_id: detailWorkout.client_id,
            routine_id: detailWorkout.routine_id || null,
            workout_date: dateStr,
            day_number: routineDay,
          });
        }
      }

      // Borrar workouts existentes del cliente en esas fechas
      if (targetDates.length) {
        await supabase
          .from("assigned_workouts")
          .delete()
          .eq("client_id", detailWorkout.client_id)
          .in("workout_date", targetDates);
      }

      // Crear los nuevos workouts
      const { data: newWorkouts, error } = await supabase
        .from("assigned_workouts")
        .insert(inserts)
        .select();
      if (error) throw error;

      // Copiar ejercicios correctos a cada nuevo workout
      if (newWorkouts?.length) {
        const exerciseInserts: any[] = [];
        for (const nw of newWorkouts) {
          const exs = exercisesByRoutineDay[nw.day_number] ?? [];
          for (const ex of exs) {
            exerciseInserts.push({
              assigned_workout_id: nw.id,
              exercise_id: ex.exercise_id,
              sets: ex.sets,
              reps: ex.reps,
              weight: ex.weight,
              unit: ex.unit ?? 'kg',
              order_index: ex.order_index,
              block_number: ex.block_number,
              day_number: ex.day_number,
              rest_seconds: ex.rest_seconds,
            });
          }
        }
        if (exerciseInserts.length) await supabase.from("assigned_workout_exercises").insert(exerciseInserts);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assigned-workouts"] });
      setCopyOpen(false);
      setCopyDays([]); setCopyWeeks("1");

      toast.success("Entrenamiento copiado");
    },
    onError: () => toast.error("Error al copiar"),
  });

  const copyWorkoutToClient = useMutation({
    mutationFn: async () => {
      if (!detailWorkout || !copyToClient || !copyToDate) return;

      // Obtener ejercicios del workout original (modificados o base)
      const { data: originalExercises } = await supabase
        .from("assigned_workout_exercises")
        .select("*")
        .eq("assigned_workout_id", detailWorkout.id);

      const exercisesToCopy = originalExercises?.length ? originalExercises : [];

      // Si no tiene ejercicios propios, buscar en la rutina base filtrado por día
      let finalExercises = exercisesToCopy;
      if (!finalExercises.length && detailWorkout.routine_id) {
        const { data: baseEx } = await supabase
          .from("routine_exercises")
          .select("*")
          .eq("routine_id", detailWorkout.routine_id)
          .eq("day_number", detailWorkout.day_number ?? 1);
        finalExercises = baseEx ?? [];
      }

      // Borrar workout existente del alumno destino en esa fecha (evita duplicados)
      await supabase
        .from("assigned_workouts")
        .delete()
        .eq("client_id", copyToClient)
        .eq("workout_date", copyToDate);

      // Crear el nuevo workout para el alumno destino
      const { data: newWorkout, error } = await supabase
        .from("assigned_workouts")
        .insert({
          client_id: copyToClient,
          routine_id: detailWorkout.routine_id || null,
          workout_date: copyToDate,
          day_number: detailWorkout.day_number ?? 1,
        })
        .select()
        .single();
      if (error) throw error;

      // Copiar los ejercicios
      if (finalExercises.length && newWorkout) {
        const copies = finalExercises.map((ex: any) => ({
          assigned_workout_id: newWorkout.id,
          exercise_id: ex.exercise_id,
          sets: ex.sets,
          reps: ex.reps,
          weight: ex.weight,
          unit: ex.unit ?? 'kg',
          order_index: ex.order_index,
          block_number: ex.block_number,
          day_number: ex.day_number,
          rest_seconds: ex.rest_seconds,
        }));
        await supabase.from("assigned_workout_exercises").insert(copies);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assigned-workouts"] });
      setCopyToClientOpen(false);
      setCopyToClient(""); setCopyToDate("");
      toast.success("Entrenamiento copiado al alumno");
    },
    onError: () => toast.error("Error al copiar"),
  });

  const bulkAssign = useMutation({
    mutationFn: async () => {
      const weeks = parseInt(bulkWeeks) || 1;
      let clientIds: string[] = [];
      if (bulkMode === "client") {
        if (!bulkClient) return;
        clientIds = [bulkClient];
      } else {
        if (!bulkGroup) return;
        const members = groupMembers?.filter(m => m.group_id === bulkGroup) ?? [];
        clientIds = members.map(m => m.client_id);
        if (!clientIds.length) {
          toast.error("El grupo no tiene alumnos");
          return;
        }
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Para cada día seleccionado, calcular la primera ocurrencia >= hoy
      const firstOccurrences = bulkDays.map(({ dayOfWeek, routineDay }) => {
        const thisWeekOccurrence = addDays(startOfWeek(today, { weekStartsOn: 1 }), dayOfWeek);
        const firstDate = thisWeekOccurrence < today
          ? addWeeks(thisWeekOccurrence, 1) // ya pasó esta semana → próxima semana
          : thisWeekOccurrence;             // es hoy o futuro → usar esa fecha
        return { dayOfWeek, routineDay, firstDate };
      });

      const inserts: any[] = [];
      for (const clientId of clientIds) {
        for (const { routineDay, firstDate } of firstOccurrences) {
          for (let w = 0; w < weeks; w++) {
            const date = addWeeks(firstDate, w);
            inserts.push({
              client_id: clientId,
              routine_id: bulkRoutine || null,
              workout_date: format(date, "yyyy-MM-dd"),
              day_number: routineDay,
            });
          }
        }
      }
      const { error } = await supabase.from("assigned_workouts").insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assigned-workouts"] });
      setBulkOpen(false);
      setBulkDays([]); setBulkClient(""); setBulkClientName(""); setBulkClientSearch("");
      setBulkGroup(""); setBulkGroupName(""); setBulkGroupSearch("");
      setBulkRoutine(""); setBulkRoutineName(""); setBulkRoutineSearch(""); setBulkWeeks("4");
      toast.success("Entrenamientos asignados");
    },
  });

  const deleteWorkout = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("assigned_workouts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assigned-workouts"] });
      toast.success("Eliminado");
    },
  });

  const navigate = (dir: -1 | 1) => {
    if (viewMode === "month") setCurrentDate(dir === 1 ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    else if (viewMode === "week") setCurrentDate(dir === 1 ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, dir));
  };

  const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const { data: workoutExercises } = useQuery({
    queryKey: ["calendar-workout-exercises", workouts?.map((w: any) => w.id), filterClient],
    enabled: !!filterClient && !!workouts?.length,
    queryFn: async () => {
      const ids = workouts!.map((w: any) => w.id);
      const { data, error } = await supabase
        .from("assigned_workout_exercises")
        .select("assigned_workout_id, exercises(name), block_number, order_index")
        .in("assigned_workout_id", ids)
        .order("block_number")
        .order("order_index");
      if (error) throw error;
      return data;
    },
  });


  const [savingDay, setSavingDay] = useState<string | null>(null);

  const saveDayWorkouts = async (dateStr: string) => {
    setSavingDay(dateStr);
    try {
      // Obtener todos los workouts de ese día (de los ya cargados, o buscar sin filtro)
      let dayWorkouts: any[] = workouts?.filter((w: any) => w.workout_date === dateStr) ?? [];

      // Si no hay filtro de cliente, buscar todos los workouts de ese día
      if (!filterClient) {
        const { data } = await supabase
          .from("assigned_workouts")
          .select("*, routines(id, total_days)")
          .eq("workout_date", dateStr);
        dayWorkouts = data ?? [];
      }

      if (!dayWorkouts.length) {
        toast.info("No hay entrenamientos para guardar ese día");
        return;
      }

      let savedCount = 0;

      for (const workout of dayWorkouts) {
        const dayNum = workout.day_number ?? 1;

        // Ejercicios modificados del workout
        const { data: assignedExs } = await supabase
          .from("assigned_workout_exercises")
          .select("*")
          .eq("assigned_workout_id", workout.id);

        let exercises: any[] = assignedExs ?? [];

        // Fallback a rutina base
        if (!exercises.length && workout.routine_id) {
          const { data: routineExs } = await supabase
            .from("routine_exercises")
            .select("*")
            .eq("routine_id", workout.routine_id)
            .eq("day_number", dayNum);
          exercises = routineExs ?? [];
        }

        if (!exercises.length) continue;

        // Logs ya existentes para este workout
        const { data: existingLogs } = await supabase
          .from("workout_logs")
          .select("exercise_id, set_number")
          .eq("assigned_workout_id", workout.id);

        const toInsert: any[] = [];
        for (const ex of exercises) {
          const totalSets = ex.sets ?? 1;
          for (let s = 1; s <= totalSets; s++) {
            const alreadyLogged = existingLogs?.some(
              (l: any) => l.exercise_id === ex.exercise_id && l.set_number === s
            );
            if (!alreadyLogged) {
              toInsert.push({
                assigned_workout_id: workout.id,
                exercise_id: ex.exercise_id,
                set_number: s,
                reps_done: ex.reps ?? 0,
                weight_used: ex.weight ?? 0,
                completed: true,
              });
            }
          }
        }

        if (toInsert.length) {
          await supabase.from("workout_logs").insert(toInsert);
          savedCount++;
        }
      }

      if (savedCount > 0) {
        toast.success(`${savedCount} entrenamiento${savedCount > 1 ? "s" : ""} guardado${savedCount > 1 ? "s" : ""}`);
      } else {
        toast.info("Todos los entrenamientos ya estaban guardados");
      }
    } catch {
      toast.error("Error al guardar el día");
    } finally {
      setSavingDay(null);
    }
  };

  const toggleBulkDay = (dayOfWeek: number) => {
    setBulkDays(prev => {
      const exists = prev.find(x => x.dayOfWeek === dayOfWeek);
      if (exists) return prev.filter(x => x.dayOfWeek !== dayOfWeek);
      return [...prev, { dayOfWeek, routineDay: 1 }];
    });
  };
  const setBulkRoutineDay = (dayOfWeek: number, routineDay: number) => {
    setBulkDays(prev => prev.map(x => x.dayOfWeek === dayOfWeek ? { ...x, routineDay } : x));
  };
  const toggleCopyDay = (dayOfWeek: number) => {
    setCopyDays(prev => {
      const exists = prev.find(x => x.dayOfWeek === dayOfWeek);
      if (exists) return prev.filter(x => x.dayOfWeek !== dayOfWeek);
      return [...prev, { dayOfWeek, routineDay: detailWorkout?.day_number ?? 1 }];
    });
  };
  const setCopyRoutineDay = (dayOfWeek: number, routineDay: number) =>
    setCopyDays(prev => prev.map(x => x.dayOfWeek === dayOfWeek ? { ...x, routineDay } : x));

  const isClientFiltered = !!filterClient;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-heading font-bold">Calendario</h1>
          <p className="text-muted-foreground">Asigna rutinas a tus clientes</p>
        </div>
        <div className="flex items-center gap-2">
          {role === "coach" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => saveDayWorkouts(format(viewMode === "day" ? currentDate : new Date(), "yyyy-MM-dd"))}
                disabled={!!savingDay}
              >
                <Save className="h-4 w-4 mr-1" />
                {savingDay ? "Guardando..." : "Guardar día"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)}>
                <CalendarDays className="h-4 w-4 mr-1" />Planificar
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground min-w-[180px] text-center font-medium">
            {viewMode === "month" && format(currentDate, "MMMM yyyy", { locale: es })}
            {viewMode === "week" && `${format(days[0], "d MMM", { locale: es })} - ${format(days[days.length - 1], "d MMM yyyy", { locale: es })}`}
            {viewMode === "day" && format(currentDate, "EEEE d 'de' MMMM yyyy", { locale: es })}
          </span>
          <Button variant="outline" size="icon" onClick={() => navigate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date())}>Hoy</Button>
        </div>

        <div className="flex items-center gap-2">
          {role === "coach" && (
            <div className="relative">
              <Input
                className="h-9 w-48 text-sm"
                placeholder="Buscar alumno..."
                value={clientSearch}
                onChange={e => {
                  setClientSearch(e.target.value);
                  setShowClientDropdown(true);
                  if (!e.target.value) {
                    setFilterClient("");
                  }
                }}
                onFocus={() => setShowClientDropdown(true)}
              />
              {showClientDropdown && clientSearch && (
                <div className="absolute top-10 left-0 z-50 w-64 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {clients?.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase())).map(c => (
                    <button
                      key={c.id}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-secondary transition-colors"
                      onClick={() => {
                        setFilterClient(c.id);
                        setClientSearch(c.name);
                        setShowClientDropdown(false);
                      }}
                    >
                      {c.name}
                    </button>
                  ))}
                  {clients?.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase())).length === 0 && (
                    <p className="text-xs text-muted-foreground px-3 py-2">Sin resultados</p>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["month", "week", "day"] as ViewMode[]).map(v => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === v ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {v === "month" ? "Mes" : v === "week" ? "Semana" : "Día"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Calendar grid */}
      {viewMode === "day" ? (
        <DayView
          date={currentDate}
          workouts={workouts?.filter((w: any) => w.workout_date === format(currentDate, "yyyy-MM-dd")) ?? []}
          role={role}
          isClientFiltered={isClientFiltered}
          onAdd={() => { setSelectedDate(currentDate); setSelectedClient(""); setSelectedRoutine(""); setSelectedDay("1"); setAssignOpen(true); }}
          onDelete={(id) => deleteWorkout.mutate(id)}
          onEdit={(w) => { setEditingWorkout(w); setEditWorkoutRoutine(w.routine_id || ""); setEditWorkoutDay(String(w.day_number ?? 1)); setEditWorkoutOpen(true); }}
          onViewDetail={(w) => setDetailWorkout(w)}
          onSaveDay={() => saveDayWorkouts(format(currentDate, "yyyy-MM-dd"))}
          isSavingDay={savingDay === format(currentDate, "yyyy-MM-dd")}
        />
      ) : (
        <div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {dayNames.map(d => (
              <div key={d} className="text-center text-xs text-muted-foreground font-medium py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map(day => {
              const dateStr = format(day, "yyyy-MM-dd");
              const dayWorkouts = workouts?.filter((w: any) => w.workout_date === dateStr) ?? [];
              const isToday = isSameDay(day, new Date());
              const isCurrentMonth = viewMode === "month" ? isSameMonth(day, currentDate) : true;

              return (
                <div
                  key={dateStr}
                  className={`group bg-card border rounded-lg p-2 min-h-[80px] md:min-h-[100px] cursor-pointer transition-colors hover:border-primary/30 ${
                    isToday ? "border-primary" : "border-border"
                  } ${!isCurrentMonth ? "opacity-40" : ""}`}
                  onClick={() => {
                    if (role === "coach") {
                      setSelectedDate(day);
                      setSelectedClient(""); setSelectedRoutine(""); setSelectedDay("1");
                      setAssignOpen(true);
                    }
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className={`text-xs font-medium ${isToday ? "text-primary" : "text-foreground"}`}>
                      {format(day, "d")}
                    </p>
                    {dayWorkouts.length > 0 && (
                      <button
                        onClick={e => { e.stopPropagation(); saveDayWorkouts(dateStr); }}
                        disabled={savingDay === dateStr}
                        title="Guardar día"
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-primary/10 disabled:opacity-40"
                      >
                        <Save className={`h-2.5 w-2.5 ${savingDay === dateStr ? "text-muted-foreground" : "text-primary"}`} />
                      </button>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {dayWorkouts.slice(0, 3).map((w: any) => {
                      const wExercises = workoutExercises?.filter((e: any) => e.assigned_workout_id === w.id) ?? [];
                      return (
                        <div
                          key={w.id}
                          className="bg-secondary/50 rounded px-1.5 py-0.5 group text-[10px] cursor-pointer"
                          onClick={e => {
                            e.stopPropagation();
                            setDetailWorkout(w);
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 min-w-0 flex-1">
                              <span className="text-foreground truncate font-medium">
                                {isClientFiltered
                                  ? (w.routines?.name || "Entrenamiento libre")
                                  : w.clients?.name
                                }
                              </span>
                              {w.notes && (
                                <MessageSquare className="h-2.5 w-2.5 text-primary shrink-0" />
                              )}
                            </div>
                            {role === "coach" && (
                              <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 ml-1">
                                <button onClick={e => { e.stopPropagation(); setEditingWorkout(w); setEditWorkoutRoutine(w.routine_id || ""); setEditWorkoutDay(String(w.day_number ?? 1)); setEditWorkoutOpen(true); }}>
                                  <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
                                </button>
                                <button onClick={e => { e.stopPropagation(); deleteWorkout.mutate(w.id); }}>
                                  <Trash2 className="h-2.5 w-2.5 text-destructive" />
                                </button>
                              </div>
                            )}
                          </div>
                          {isClientFiltered && wExercises.length > 0 && (
                            <div className="mt-0.5 space-y-0.5">
                              {wExercises.slice(0, 3).map((ex: any, i: number) => (
                                <p key={i} className="text-muted-foreground truncate">• {ex.exercises?.name}</p>
                              ))}
                              {wExercises.length > 3 && (
                                <p className="text-muted-foreground">+{wExercises.length - 3} más</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {dayWorkouts.length > 3 && (
                      <p className="text-[10px] text-muted-foreground">+{dayWorkouts.length - 3} más</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Assign dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Asignar - {selectedDate ? format(selectedDate, "d MMMM yyyy", { locale: es }) : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <select
              className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
              value={selectedClient}
              onChange={e => setSelectedClient(e.target.value)}
            >
              <option value="">Seleccionar cliente *</option>
              {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select
              className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
              value={selectedRoutine}
              onChange={e => { setSelectedRoutine(e.target.value); setSelectedDay("1"); }}
            >
              <option value="">Sin rutina (agregar ejercicios manualmente)</option>
              {routines?.map(r => <option key={r.id} value={r.id}>{r.name}{(r as any).total_days > 1 ? ` (${(r as any).total_days} días)` : ""}</option>)}
            </select>
            {(() => {
              const routine = routines?.find(r => r.id === selectedRoutine);
              const totalDays = (routine as any)?.total_days ?? 1;
              if (!routine || totalDays <= 1) return null;
              return (
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">¿Qué día de la rutina es este entrenamiento?</label>
                  <div className="flex gap-1">
                    {Array.from({ length: totalDays }, (_, i) => i + 1).map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setSelectedDay(String(d))}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                          selectedDay === String(d) ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Día {d}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}
            <Button className="w-full" onClick={() => assignWorkout.mutate()} disabled={!selectedClient}>
              Asignar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit workout dialog */}
      <Dialog open={editWorkoutOpen} onOpenChange={setEditWorkoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modificar Entrenamiento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {editingWorkout && (
              <p className="text-sm text-muted-foreground">
                {editingWorkout.clients?.name} — {format(new Date(editingWorkout.workout_date + "T12:00:00"), "d MMM yyyy", { locale: es })}
              </p>
            )}
            <select
              className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
              value={editWorkoutRoutine}
              onChange={e => { setEditWorkoutRoutine(e.target.value); setEditWorkoutDay("1"); }}
            >
              <option value="">Sin rutina</option>
              {routines?.map(r => <option key={r.id} value={r.id}>{r.name}{(r as any).total_days > 1 ? ` (${(r as any).total_days} días)` : ""}</option>)}
            </select>
            {(() => {
              const routine = routines?.find(r => r.id === editWorkoutRoutine);
              const totalDays = (routine as any)?.total_days ?? 1;
              if (!routine || totalDays <= 1) return null;
              return (
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">¿Qué día de la rutina?</label>
                  <div className="flex gap-1">
                    {Array.from({ length: totalDays }, (_, i) => i + 1).map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setEditWorkoutDay(String(d))}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                          editWorkoutDay === String(d) ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Día {d}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}
            <Button className="w-full" onClick={() => updateWorkout.mutate()}>
              Guardar Cambios
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Workout detail dialog — siempre muestra editor de ejercicios */}
      <Dialog open={!!detailWorkout} onOpenChange={() => { setDetailWorkout(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detailWorkout?.clients?.name} — {detailWorkout && format(new Date(detailWorkout.workout_date + "T12:00:00"), "d MMM yyyy", { locale: es })}
            </DialogTitle>
          </DialogHeader>
          {detailWorkout && (
            <div className="mt-2">
              {detailWorkout.notes && (
                <div className="flex items-start gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2.5 mb-3">
                  <MessageSquare className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-primary mb-0.5">Comentario de la sesión</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{detailWorkout.notes}</p>
                  </div>
                </div>
              )}
              {detailWorkout.routine_id && (
                <p className="text-xs text-muted-foreground mb-3">
                  Rutina base: <span className="text-primary">{detailWorkout.routines?.name}</span> — Los cambios se aplican solo a este alumno.
                </p>
              )}
              <RoutineDetailView
                routineId={detailWorkout.routine_id || ""}
                routineName={detailWorkout.routines?.name || "Entrenamiento"}
                totalDays={detailWorkout.routines?.total_days || 1}
                editable={role === "coach"}
                assignedWorkoutId={detailWorkout.id}
                clientId={detailWorkout.client_id}
                initialDay={detailWorkout.day_number ?? 1}
              />
              {role === "coach" && (
                <div className="mt-4 pt-4 border-t border-border flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => { setDetailWorkout(detailWorkout); setCopyOpen(true); }}
                  >
                    <Copy className="h-4 w-4 mr-2" />Copiar a otros días
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setCopyToDate(format(new Date(), "yyyy-MM-dd"));
                      setCopyToClientOpen(true);
                    }}
                  >
                    <Copy className="h-4 w-4 mr-2" />Copiar a otro alumno
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Copy dialog */}
      <Dialog open={copyOpen} onOpenChange={setCopyOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Copiar Entrenamiento</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Se copiará el entrenamiento de <span className="text-foreground font-medium">{detailWorkout?.clients?.name}</span> a los días seleccionados.
            </p>
            <div>
              <label className="text-xs text-muted-foreground block mb-2">¿Qué días de la semana?</label>
              <div className="flex gap-1 mb-3">
                {dayNames.map((d, i) => {
                  const isSelected = copyDays.some(x => x.dayOfWeek === i);
                  return (
                    <button
                      key={i}
                      onClick={() => toggleCopyDay(i)}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                        isSelected ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
              {/* Por cada día seleccionado, elegir qué día de la rutina */}
              {(() => {
                const totalDays = detailWorkout?.routines?.total_days ?? 1;
                if (totalDays <= 1 || !copyDays.length) return null;
                return (
                  <div className="space-y-2 border border-border rounded-lg p-3 bg-secondary/20">
                    <p className="text-xs text-muted-foreground font-medium">¿Qué día de la rutina corresponde a cada día?</p>
                    {[...copyDays].sort((a, b) => a.dayOfWeek - b.dayOfWeek).map(({ dayOfWeek, routineDay }) => (
                      <div key={dayOfWeek} className="flex items-center gap-3">
                        <span className="text-xs font-medium text-foreground w-8">{dayNames[dayOfWeek]}</span>
                        <div className="flex gap-1 flex-1">
                          {Array.from({ length: totalDays }, (_, i) => i + 1).map(d => (
                            <button
                              key={d}
                              onClick={() => setCopyRoutineDay(dayOfWeek, d)}
                              className={`flex-1 py-1 rounded text-xs font-medium transition-colors ${
                                routineDay === d ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              D{d}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
            <div>
              <label className="text-xs text-muted-foreground">¿Por cuántas semanas?</label>
              <Input
                type="number"
                min="1"
                max="52"
                value={copyWeeks}
                onChange={e => setCopyWeeks(e.target.value)}
                className="mt-1"
              />
            </div>
            <Button
              className="w-full"
              onClick={() => copyWorkout.mutate()}
              disabled={!copyDays.length}
            >
              Copiar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Copy to client dialog */}
      <Dialog open={copyToClientOpen} onOpenChange={v => {
        setCopyToClientOpen(v);
        if (!v) { setCopyToClient(""); setCopyToClientName(""); setCopyToClientSearch(""); setCopyToDate(""); setCopyToWeekOffset(0); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copiar a otro alumno</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <p className="text-xs text-muted-foreground">
              Entrenamiento de <span className="text-foreground font-medium">{detailWorkout?.clients?.name}</span>{" "}
              ({detailWorkout && format(new Date(detailWorkout.workout_date + "T12:00:00"), "d MMM", { locale: es })})
            </p>

            {/* Buscador de alumno */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Alumno destino</label>
              {copyToClient ? (
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-primary/10 border border-primary/30">
                  <span className="text-sm font-medium text-primary">{copyToClientName}</span>
                  <button onClick={() => { setCopyToClient(""); setCopyToClientName(""); setCopyToClientSearch(""); }}>
                    <X className="h-4 w-4 text-primary/60 hover:text-primary" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Escribí el nombre..."
                    className="pl-10"
                    value={copyToClientSearch}
                    onChange={e => setCopyToClientSearch(e.target.value)}
                    autoFocus
                  />
                </div>
              )}
              {!copyToClient && copyToClientSearch && (
                <div className="mt-1 space-y-0.5 max-h-40 overflow-y-auto border border-border rounded-lg bg-card p-1">
                  {clients
                    ?.filter(c => c.id !== detailWorkout?.client_id && c.name.toLowerCase().includes(copyToClientSearch.toLowerCase()))
                    .map(c => (
                      <button
                        key={c.id}
                        onClick={() => { setCopyToClient(c.id); setCopyToClientName(c.name); setCopyToClientSearch(""); }}
                        className="w-full text-left px-3 py-2 rounded-md hover:bg-secondary/60 text-sm text-foreground transition-colors"
                      >
                        {c.name}
                      </button>
                    ))
                  }
                  {!clients?.filter(c => c.id !== detailWorkout?.client_id && c.name.toLowerCase().includes(copyToClientSearch.toLowerCase())).length && (
                    <p className="text-xs text-muted-foreground px-3 py-2">Sin resultados.</p>
                  )}
                </div>
              )}
            </div>

            {/* Selector de día semanal */}
            <div>
              <label className="text-xs text-muted-foreground block mb-2">Día destino</label>
              {(() => {
                const base = addWeeks(new Date(), copyToWeekOffset);
                const wStart = startOfWeek(base, { weekStartsOn: 1 });
                const wEnd = endOfWeek(base, { weekStartsOn: 1 });
                const days = eachDayOfInterval({ start: wStart, end: wEnd });
                const today = format(new Date(), "yyyy-MM-dd");
                return (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <button onClick={() => setCopyToWeekOffset(o => o - 1)} className="p-1.5 rounded-lg hover:bg-secondary/60 transition-colors">
                        <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                      </button>
                      <span className="text-xs font-medium text-muted-foreground">
                        {format(wStart, "d MMM", { locale: es })} — {format(wEnd, "d MMM yyyy", { locale: es })}
                      </span>
                      <button onClick={() => setCopyToWeekOffset(o => o + 1)} className="p-1.5 rounded-lg hover:bg-secondary/60 transition-colors">
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {days.map(day => {
                        const dateStr = format(day, "yyyy-MM-dd");
                        const isSelected = copyToDate === dateStr;
                        const isToday = dateStr === today;
                        return (
                          <button
                            key={dateStr}
                            onClick={() => setCopyToDate(dateStr)}
                            className={`flex flex-col items-center py-2 rounded-xl text-xs font-medium transition-all border
                              ${isSelected
                                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                : isToday
                                  ? "bg-primary/10 text-primary border-primary/30"
                                  : "bg-card text-muted-foreground border-border hover:bg-secondary/50 hover:text-foreground"
                              }`}
                          >
                            <span className="uppercase text-[10px] font-bold">{format(day, "EEE", { locale: es }).slice(0, 2)}</span>
                            <span className="text-base font-bold mt-0.5">{format(day, "d")}</span>
                          </button>
                        );
                      })}
                    </div>
                    {copyToDate && (
                      <p className="text-xs text-center text-primary mt-2 font-medium">
                        {format(new Date(copyToDate + "T12:00:00"), "EEEE d 'de' MMMM", { locale: es })}
                      </p>
                    )}
                  </>
                );
              })()}
            </div>

            <Button
              className="w-full"
              disabled={!copyToClient || !copyToDate || copyWorkoutToClient.isPending}
              onClick={() => copyWorkoutToClient.mutate()}
            >
              {copyWorkoutToClient.isPending ? "Copiando..." : "Copiar entrenamiento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk assign / Planificar dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Planificar Entrenamientos</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setBulkMode("client")}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  bulkMode === "client" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"
                }`}
              >
                Por Alumno
              </button>
              <button
                onClick={() => setBulkMode("group")}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  bulkMode === "group" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"
                }`}
              >
                Por Grupo
              </button>
            </div>

            {/* Alumno o Grupo */}
            {bulkMode === "client" ? (
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Alumno *</label>
                {bulkClient ? (
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-primary/10 border border-primary/30">
                    <span className="text-sm font-medium text-primary">{bulkClientName}</span>
                    <button onClick={() => { setBulkClient(""); setBulkClientName(""); setBulkClientSearch(""); }}>
                      <X className="h-4 w-4 text-primary/60 hover:text-primary" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar alumno..." className="pl-10"
                      value={bulkClientSearch} onChange={e => setBulkClientSearch(e.target.value)} autoFocus />
                  </div>
                )}
                {!bulkClient && bulkClientSearch && (
                  <div className="mt-1 border border-border rounded-lg bg-card max-h-40 overflow-y-auto">
                    {clients?.filter(c => c.name.toLowerCase().includes(bulkClientSearch.toLowerCase())).map(c => (
                      <button key={c.id} onClick={() => { setBulkClient(c.id); setBulkClientName(c.name); setBulkClientSearch(""); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-secondary transition-colors">
                        {c.name}
                      </button>
                    ))}
                    {!clients?.filter(c => c.name.toLowerCase().includes(bulkClientSearch.toLowerCase())).length && (
                      <p className="text-xs text-muted-foreground px-3 py-2">Sin resultados</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Grupo *</label>
                {bulkGroup ? (
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-primary/10 border border-primary/30">
                    <span className="text-sm font-medium text-primary">{bulkGroupName}</span>
                    <button onClick={() => { setBulkGroup(""); setBulkGroupName(""); setBulkGroupSearch(""); }}>
                      <X className="h-4 w-4 text-primary/60 hover:text-primary" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar grupo..." className="pl-10"
                      value={bulkGroupSearch} onChange={e => setBulkGroupSearch(e.target.value)} autoFocus />
                  </div>
                )}
                {!bulkGroup && bulkGroupSearch && (
                  <div className="mt-1 border border-border rounded-lg bg-card max-h-40 overflow-y-auto">
                    {groups?.filter(g => g.name.toLowerCase().includes(bulkGroupSearch.toLowerCase())).map(g => (
                      <button key={g.id} onClick={() => { setBulkGroup(g.id); setBulkGroupName(g.name); setBulkGroupSearch(""); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-secondary transition-colors">
                        {g.name}
                      </button>
                    ))}
                    {!groups?.filter(g => g.name.toLowerCase().includes(bulkGroupSearch.toLowerCase())).length && (
                      <p className="text-xs text-muted-foreground px-3 py-2">Sin resultados</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Rutina */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Rutina</label>
              {bulkRoutine ? (
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-primary/10 border border-primary/30">
                  <span className="text-sm font-medium text-primary">{bulkRoutineName}</span>
                  <button onClick={() => { setBulkRoutine(""); setBulkRoutineName(""); setBulkRoutineSearch(""); setBulkDays([]); }}>
                    <X className="h-4 w-4 text-primary/60 hover:text-primary" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar rutina (o dejar vacío para sin rutina)..." className="pl-10"
                    value={bulkRoutineSearch} onChange={e => setBulkRoutineSearch(e.target.value)} />
                </div>
              )}
              {!bulkRoutine && bulkRoutineSearch && (
                <div className="mt-1 border border-border rounded-lg bg-card max-h-40 overflow-y-auto">
                  {routines?.filter(r => r.name.toLowerCase().includes(bulkRoutineSearch.toLowerCase())).map(r => (
                    <button key={r.id}
                      onClick={() => { setBulkRoutine(r.id); setBulkRoutineName(r.name + ((r as any).total_days > 1 ? ` (${(r as any).total_days} días)` : "")); setBulkRoutineSearch(""); setBulkDays([]); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-secondary transition-colors">
                      {r.name}{(r as any).total_days > 1 ? <span className="text-xs text-muted-foreground ml-1">({(r as any).total_days} días)</span> : ""}
                    </button>
                  ))}
                  {!routines?.filter(r => r.name.toLowerCase().includes(bulkRoutineSearch.toLowerCase())).length && (
                    <p className="text-xs text-muted-foreground px-3 py-2">Sin resultados</p>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-2">¿Qué días entrena?</label>
              <div className="flex gap-1 mb-3">
                {dayNames.map((d, i) => {
                  const isSelected = bulkDays.some(x => x.dayOfWeek === i);
                  return (
                    <button
                      key={i}
                      onClick={() => toggleBulkDay(i)}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                        isSelected ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>

              {/* Por cada día seleccionado, elegir qué día de la rutina */}
              {(() => {
                const routine = routines?.find(r => r.id === bulkRoutine);
                const totalDays = (routine as any)?.total_days ?? 1;
                if (!bulkRoutine || totalDays <= 1 || !bulkDays.length) return null;
                return (
                  <div className="space-y-2 border border-border rounded-lg p-3 bg-secondary/20">
                    <p className="text-xs text-muted-foreground font-medium">¿Qué día de la rutina corresponde a cada día?</p>
                    {[...bulkDays].sort((a, b) => a.dayOfWeek - b.dayOfWeek).map(({ dayOfWeek, routineDay }) => (
                      <div key={dayOfWeek} className="flex items-center gap-3">
                        <span className="text-xs font-medium text-foreground w-8">{dayNames[dayOfWeek]}</span>
                        <div className="flex gap-1 flex-1">
                          {Array.from({ length: totalDays }, (_, i) => i + 1).map(d => (
                            <button
                              key={d}
                              onClick={() => setBulkRoutineDay(dayOfWeek, d)}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                routineDay === d ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              Día {d}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
            <div>
              <label className="text-xs text-muted-foreground">¿Por cuántas semanas?</label>
              <Input type="number" min="1" max="52" value={bulkWeeks} onChange={e => setBulkWeeks(e.target.value)} />
            </div>
            <Button
              className="w-full"
              onClick={() => bulkAssign.mutate()}
              disabled={(bulkMode === "client" ? !bulkClient : !bulkGroup) || !bulkDays.length || bulkDays.length === 0}
            >
              Planificar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DayView({ date, workouts, role, isClientFiltered, onAdd, onDelete, onEdit, onViewDetail, onSaveDay, isSavingDay }: {
  date: Date; workouts: any[]; role: string | null; isClientFiltered: boolean;
  onAdd: () => void; onDelete: (id: string) => void; onEdit: (w: any) => void; onViewDetail: (w: any) => void;
  onSaveDay: () => void; isSavingDay: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-heading font-bold">
          {format(date, "EEEE d 'de' MMMM", { locale: es })}
        </h2>
        {role === "coach" && (
          <Button size="sm" onClick={onAdd}><Plus className="h-4 w-4 mr-1" />Agregar</Button>
        )}
      </div>
      {!workouts.length ? (
        <p className="text-muted-foreground text-sm">Sin entrenamientos.</p>
      ) : (
        <div className="space-y-2">
          {workouts.map((w: any) => (
            <div
              key={w.id}
              className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-3 cursor-pointer hover:bg-secondary/70 transition-colors"
              onClick={() => onViewDetail(w)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground">{w.clients?.name}</p>
                  {w.notes && (
                    <MessageSquare className="h-3.5 w-3.5 text-primary shrink-0" />
                  )}
                </div>
                {w.routines?.name
                  ? <p className="text-xs text-muted-foreground">{w.routines.name}</p>
                  : <p className="text-xs text-muted-foreground">Entrenamiento libre</p>
                }
                {w.notes && (
                  <p className="text-xs text-muted-foreground mt-1 truncate italic">"{w.notes}"</p>
                )}
              </div>
              {role === "coach" && (
                <div className="flex gap-1 ml-2 shrink-0">
                  <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); onEdit(w); }}>
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); onDelete(w.id); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getDateRange(viewMode: ViewMode, currentDate: Date) {
  if (viewMode === "month") {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = addDays(startOfWeek(addDays(monthEnd, 6), { weekStartsOn: 1 }), 6);
    const days = eachDayOfInterval({ start: calStart, end: calEnd }).slice(0, 42);
    return { dateRange: { start: format(calStart, "yyyy-MM-dd"), end: format(calEnd, "yyyy-MM-dd") }, days };
  } else if (viewMode === "week") {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    return { dateRange: { start: format(weekStart, "yyyy-MM-dd"), end: format(addDays(weekStart, 6), "yyyy-MM-dd") }, days };
  } else {
    return { dateRange: { start: format(currentDate, "yyyy-MM-dd"), end: format(currentDate, "yyyy-MM-dd") }, days: [currentDate] };
  }
}
