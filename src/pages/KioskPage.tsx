import { useState, useRef, forwardRef, useImperativeHandle } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dumbbell, ArrowLeft, CheckCircle2, Circle, Search, UserPlus, X, Settings, Plus, Trash2 } from "lucide-react";
import { format, addWeeks } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
 
const MANUAL_CLIENTS_KEY = "kiosk_manual_clients";

function loadManualClients(today: string): { id: string; name: string }[] {
  try {
    const raw = localStorage.getItem(MANUAL_CLIENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Solo usar si es del día de hoy
    if (parsed.date === today) return parsed.clients ?? [];
    // Si es de otro día, limpiar
    localStorage.removeItem(MANUAL_CLIENTS_KEY);
    return [];
  } catch {
    return [];
  }
}

function saveManualClients(today: string, clients: { id: string; name: string }[]) {
  localStorage.setItem(MANUAL_CLIENTS_KEY, JSON.stringify({ date: today, clients }));
}

export default function KioskPage() {
  const queryClient = useQueryClient();
  const [selectedGroup, setSelectedGroup] = useState("");
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [selectedClientName, setSelectedClientName] = useState("");
  const today = format(new Date(), "yyyy-MM-dd");
  const [manualClients, setManualClients] = useState<{ id: string; name: string }[]>(() => loadManualClients(today));

  const addManualClient = (client: { id: string; name: string }) => {
    setManualClients(prev => {
      if (prev.some(c => c.id === client.id)) return prev;
      const next = [...prev, client];
      saveManualClients(today, next);
      return next;
    });
  };
  const [searchOpen, setSearchOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [managingOpen, setManagingOpen] = useState(false);
  const [pendingManualClient, setPendingManualClient] = useState<{ id: string; name: string } | null>(null);
  const cardRefs = useRef<Map<string, any>>(new Map());
 
  // --- Gestión de grupos de kiosco ---
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [managingGroupId, setManagingGroupId] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
 
  const { data: kioskGroups } = useQuery({
    queryKey: ["kiosk-groups"],
    queryFn: async () => {
      const { data, error } = await supabase.from("kiosk_groups").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
 
  const { data: allClients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: pendingClientAllWorkouts } = useQuery({
    queryKey: ["pending-client-all-workouts", pendingManualClient?.id],
    enabled: !!pendingManualClient,
    queryFn: async () => {
      // Traer todos los entrenamientos del alumno (últimas 8 semanas + próximas 8 semanas)
      const from = format(addWeeks(new Date(), -8), "yyyy-MM-dd");
      const to = format(addWeeks(new Date(), 8), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("assigned_workouts")
        .select("*, routines(id, name)")
        .eq("client_id", pendingManualClient!.id)
        .gte("workout_date", from)
        .lte("workout_date", to)
        .order("workout_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const assignWorkoutToday = useMutation({
    mutationFn: async ({ clientId, routineId, dayNumber, sourceWorkoutId }: { clientId: string; routineId: string | null; dayNumber: number; sourceWorkoutId: string }) => {
      // Borrar cualquier workout existente para hoy (evita duplicados)
      await supabase.from("assigned_workouts")
        .delete()
        .eq("client_id", clientId)
        .eq("workout_date", today);

      // Crear el workout de hoy con el day_number correcto
      const { data: newWorkout, error } = await supabase.from("assigned_workouts").insert({
        client_id: clientId,
        routine_id: routineId,
        workout_date: today,
        day_number: dayNumber,
      }).select().single();
      if (error) throw error;

      // Primero intentar copiar ejercicios modificados del día fuente
      const { data: sourceExercises } = await supabase
        .from("assigned_workout_exercises")
        .select("*")
        .eq("assigned_workout_id", sourceWorkoutId);

      if (sourceExercises?.length && newWorkout) {
        // Tiene ejercicios modificados → copiar esos
        const copies = sourceExercises.map((ex: any) => ({
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
      } else if (newWorkout) {
        // No tiene modificaciones → copiar desde la rutina base filtrando por el día correcto
        const { data: baseExercises } = await supabase
          .from("routine_exercises")
          .select("*")
          .eq("routine_id", routineId)
          .eq("day_number", dayNumber);
        if (baseExercises?.length) {
          const copies = baseExercises.map((ex: any) => ({
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
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kiosk-workouts"] });
      queryClient.invalidateQueries({ queryKey: ["kiosk-assigned-exercises"] });
      queryClient.invalidateQueries({ queryKey: ["kiosk-logs"] });
    },
  });
 
  const { data: groupMembers } = useQuery({
    queryKey: ["kiosk-members", selectedGroup],
    enabled: !!selectedGroup,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kiosk_group_members")
        .select("*, clients(id, name)")
        .eq("kiosk_group_id", selectedGroup);
      if (error) throw error;
      return data;
    },
  });
 
  const { data: managingGroupMembers } = useQuery({
    queryKey: ["kiosk-managing-members", managingGroupId],
    enabled: !!managingGroupId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kiosk_group_members")
        .select("*, clients(id, name)")
        .eq("kiosk_group_id", managingGroupId!);
      if (error) throw error;
      return data;
    },
  });
 
  const { data: todayWorkouts } = useQuery({
    queryKey: ["kiosk-workouts", selectedClient, today],
    enabled: !!selectedClient,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assigned_workouts")
        .select("*, routines(name, total_days, routine_exercises(*, exercises(name, muscle_group)))")
        .eq("client_id", selectedClient!)
        .eq("workout_date", today);
      if (error) throw error;
      return data;
    },
  });
 
  const { data: assignedExercises } = useQuery({
    queryKey: ["kiosk-assigned-exercises", todayWorkouts?.map((w: any) => w.id)],
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
    queryKey: ["kiosk-logs", todayWorkouts?.map((w: any) => w.id)],
    enabled: !!todayWorkouts?.length,
    queryFn: async () => {
      const ids = todayWorkouts!.map((w: any) => w.id);
      const { data, error } = await supabase.from("workout_logs").select("*").in("assigned_workout_id", ids);
      if (error) throw error;
      return data;
    },
  });
 
  const createGroup = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("kiosk_groups").insert({
        name: newGroupName,
        description: newGroupDesc || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kiosk-groups"] });
      setNewGroupName("");
      setNewGroupDesc("");
      toast.success("Turno creado");
    },
    onError: () => toast.error("Error al crear turno"),
  });
 
  const deleteGroup = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("kiosk_groups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kiosk-groups"] });
      if (managingGroupId) setManagingGroupId(null);
      toast.success("Turno eliminado");
    },
  });
 
  const addMember = useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await supabase.from("kiosk_group_members").insert({
        kiosk_group_id: managingGroupId,
        client_id: clientId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kiosk-managing-members", managingGroupId] });
      setMemberSearch("");
      toast.success("Alumno agregado al turno");
    },
    onError: () => toast.error("Error (¿ya está en el turno?)"),
  });
 
  const removeMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("kiosk_group_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kiosk-managing-members", managingGroupId] });
      toast.success("Alumno removido del turno");
    },
  });
 
  const saveNote = useMutation({
    mutationFn: async ({ workoutId, notes }: { workoutId: string; notes: string }) => {
      const { error } = await supabase.from("assigned_workouts").update({ notes }).eq("id", workoutId);
      if (error) throw error;
    },
    onSuccess: () => toast.success("Comentario guardado"),
    onError: () => toast.error("Error al guardar"),
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
      queryClient.invalidateQueries({ queryKey: ["kiosk-logs"] });
      toast.success("Serie registrada");
    },
  });

  const logAllSets = useMutation({
    mutationFn: async () => {
      // Agrupar por ejercicio para saber sets reales
      const byExercise: Record<string, { assignedWorkoutId: string; exerciseId: string; sets: { set_number: number; reps_done: number; weight_used: number }[] }> = {};
      for (const [key, card] of cardRefs.current) {
        const sets = card.getSets();
        byExercise[key] = { assignedWorkoutId: card.assignedWorkoutId, exerciseId: card.exerciseId, sets };
      }

      // 1. Guardar workout_logs
      for (const { assignedWorkoutId, exerciseId, sets } of Object.values(byExercise)) {
        for (const s of sets) {
          const existing = existingLogs?.find(
            l => l.assigned_workout_id === assignedWorkoutId &&
              l.exercise_id === exerciseId &&
              l.set_number === s.set_number
          );
          if (existing) {
            await supabase.from("workout_logs").update({
              reps_done: s.reps_done, weight_used: s.weight_used, completed: true,
            }).eq("id", existing.id);
          } else {
            await supabase.from("workout_logs").insert({
              assigned_workout_id: assignedWorkoutId,
              exercise_id: exerciseId,
              set_number: s.set_number,
              reps_done: s.reps_done,
              weight_used: s.weight_used,
              completed: true,
            });
          }
        }
      }

      // 2. Sobreescribir assigned_workout_exercises con valores reales
      for (const { assignedWorkoutId, exerciseId, sets } of Object.values(byExercise)) {
        const totalSets = sets.length;
        const reps = sets[0]?.reps_done ?? 0;
        const weight = sets[0]?.weight_used ?? 0;

        const { data: existing } = await supabase
          .from("assigned_workout_exercises")
          .select("id")
          .eq("assigned_workout_id", assignedWorkoutId)
          .eq("exercise_id", exerciseId)
          .maybeSingle();

        if (existing) {
          await supabase.from("assigned_workout_exercises")
            .update({ sets: totalSets, reps, weight })
            .eq("id", existing.id);
        } else {
          await supabase.from("assigned_workout_exercises").insert({
            assigned_workout_id: assignedWorkoutId,
            exercise_id: exerciseId,
            sets: totalSets,
            reps,
            weight,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kiosk-logs"] });
      queryClient.invalidateQueries({ queryKey: ["kiosk-assigned-exercises"] });
      toast.success("¡Sesión guardada completa!");
    },
    onError: () => toast.error("Error al guardar la sesión"),
  });
 
  const groupClientIds = groupMembers?.map((m: any) => m.clients.id) ?? [];
  const allKioskClients = [
    ...(groupMembers?.map((m: any) => ({ id: m.clients.id, name: m.clients.name })) ?? []),
    ...manualClients.filter(c => !groupClientIds.includes(c.id)),
  ];
 
  const filteredSearch = allClients?.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) &&
    !manualClients.some(k => k.id === c.id)
  ) ?? [];
 
  const managingMemberIds = managingGroupMembers?.map((m: any) => m.client_id) ?? [];
  const filteredMemberSearch = allClients?.filter(c =>
    c.name.toLowerCase().includes(memberSearch.toLowerCase()) &&
    !managingMemberIds.includes(c.id)
  ) ?? [];
 
  // --- Vista de entrenamiento del alumno ---
  if (selectedClient) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => setSelectedClient(null)}>
            <ArrowLeft className="h-4 w-4 mr-2" />Volver
          </Button>
          <span className="text-sm text-muted-foreground">
            {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
          </span>
        </div>
 
        <div className="flex items-center gap-2 mb-6">
          <Dumbbell className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-heading font-bold">{selectedClientName}</h1>
        </div>
 
        {!todayWorkouts?.length ? (
          <div className="text-center py-12 text-muted-foreground">
            <Dumbbell className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No hay entrenamiento asignado para hoy.</p>
          </div>
        ) : (
          todayWorkouts.map((workout: any) => {
            // Prioridad: ejercicios propios (modificados), si no hay fallback a rutina base
            const dayNum = workout.day_number ?? 1;
            const workoutAssigned = (assignedExercises ?? [])
              .filter((e: any) => e.assigned_workout_id === workout.id && (e.day_number ?? 1) === dayNum);
            const exercises = workoutAssigned.length > 0
              ? workoutAssigned
              : (workout.routines?.routine_exercises ?? []).filter((re: any) => (re.day_number ?? 1) === dayNum);
            const blocks = [...new Set(exercises.map((re: any) => re.block_number ?? 1))].sort((a: number, b: number) => a - b);
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
                    <div key={blockNum} className="rounded-2xl border-2 border-primary/20 bg-card overflow-hidden shadow-sm">
                      {blocks.length > 1 && (
                        <div className="flex items-center gap-3 px-4 py-3 bg-primary/10 border-b-2 border-primary/20">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm shrink-0">
                            {blockNum}
                          </div>
                          <span className="text-base font-bold text-primary uppercase tracking-widest">
                            Bloque {blockNum}
                          </span>
                        </div>
                      )}
                      <div className="p-3 space-y-2">
                        {blockExercises.map((re: any) => (
                          <KioskExerciseCard
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
                            assignedWorkoutId={workout.id}
                            exerciseId={re.exercise_id}
                            existingLogs={existingLogs?.filter(
                              (l: any) => l.exercise_id === re.exercise_id && l.assigned_workout_id === workout.id
                            ) ?? []}
                            onLogSet={logSet.mutate}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
                <button
                  onClick={() => logAllSets.mutate()}
                  disabled={logAllSets.isPending}
                  className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-bold text-base tracking-wide shadow-md hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="h-5 w-5" />
                  {logAllSets.isPending ? "Guardando..." : "Guardar sesión completa"}
                </button>
                <WorkoutNotes
                  workoutId={workout.id}
                  initialNotes={workout.notes ?? ""}
                  onSave={(notes) => saveNote.mutate({ workoutId: workout.id, notes })}
                />
              </div>
            );
          })
        )}
      </div>
    );
  }
 
  // --- Vista principal del kiosco ---
  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2">
          <Dumbbell className="h-8 w-8 text-primary" />
          <span className="font-heading text-2xl font-bold">Modo Kiosco</span>
        </div>
        <Button variant="outline" onClick={() => setManagingOpen(true)}>
          <Settings className="h-4 w-4 mr-2" />Gestionar Turnos
        </Button>
      </div>
 
      <div className="flex gap-4 mb-8 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <label className="text-sm text-muted-foreground block mb-2">Seleccioná el turno:</label>
          <select
            className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
            value={selectedGroup}
            onChange={e => setSelectedGroup(e.target.value)}
          >
            <option value="">Elegir turno</option>
            {kioskGroups?.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          <Button variant="outline" onClick={() => setSearchOpen(!searchOpen)}>
            <UserPlus className="h-4 w-4 mr-2" />Agregar Alumno
          </Button>
        </div>
      </div>
 
      {searchOpen && (
        <div className="mb-6 bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm font-semibold text-foreground">Agregar alumnos a la sesión</p>
              <p className="text-xs text-muted-foreground">Podés agregar varios uno por uno</p>
            </div>
            <button onClick={() => { setSearchOpen(false); setClientSearch(""); setPendingManualClient(null); setWeekOffset(0); }}>
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Alumnos ya agregados en esta sesión */}
          {manualClients.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3 pb-3 border-b border-border">
              {manualClients.map(c => (
                <span key={c.id} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
                  {c.name}
                </span>
              ))}
            </div>
          )}

          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Escribí el nombre del alumno..."
              className="pl-10"
              value={clientSearch}
              onChange={e => setClientSearch(e.target.value)}
              autoFocus
            />
          </div>
          {clientSearch && !pendingManualClient && (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {filteredSearch.map(c => (
                <button
                  key={c.id}
                  onClick={() => {
                    setPendingManualClient({ id: c.id, name: c.name });
                    setClientSearch("");
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-secondary/50 text-sm text-foreground"
                >
                  {c.name}
                </button>
              ))}
              {!filteredSearch.length && <p className="text-xs text-muted-foreground px-3">Sin resultados.</p>}
            </div>
          )}

          {/* Paso 2: elegir entrenamiento */}
          {pendingManualClient && (
            <div className="mt-3 border-t border-border pt-3">
              <p className="text-sm font-medium text-foreground mb-1">
                ¿Qué entrenamiento hace <span className="text-primary">{pendingManualClient.name}</span> hoy?
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                Elegí cualquier día planificado — pasado o futuro.
              </p>

              {/* Lista de entrenamientos */}
              {!pendingClientAllWorkouts ? (
                <p className="text-xs text-muted-foreground text-center py-3">Cargando...</p>
              ) : (() => {
                if (!pendingClientAllWorkouts.length) {
                  return <p className="text-xs text-muted-foreground text-center py-3">No hay entrenamientos planificados.</p>;
                }
                // Separar por sección
                const todayWorkout = pendingClientAllWorkouts.filter(w => w.workout_date === today);
                const upcoming = pendingClientAllWorkouts.filter(w => w.workout_date > today);
                const past = pendingClientAllWorkouts.filter(w => w.workout_date < today);
                const renderItem = (w: any, isToday = false) => {
                  const dateObj = new Date(w.workout_date + "T12:00:00");
                  const isPast = w.workout_date < today;
                  return (
                    <button
                      key={w.id}
                      disabled={assignWorkoutToday.isPending}
                      onClick={async () => {
                        try {
                          const label = (w as any).routines?.name ?? "Entrenamiento libre";
                          if (w.workout_date === today) {
                            // Ya es de hoy → no borrar ni recrear, usar directamente
                            addManualClient(pendingManualClient);
                            queryClient.invalidateQueries({ queryKey: ["kiosk-workouts", pendingManualClient.id, today] });
                            toast.success(`${pendingManualClient.name} — "${label}" cargado`);
                            setPendingManualClient(null);
                            setClientSearch("");
                          } else {
                            await assignWorkoutToday.mutateAsync({
                              clientId: pendingManualClient.id,
                              routineId: (w as any).routines?.id ?? null,
                              dayNumber: (w as any).day_number ?? 1,
                              sourceWorkoutId: w.id,
                            });
                            addManualClient(pendingManualClient);
                            queryClient.invalidateQueries({ queryKey: ["kiosk-workouts", pendingManualClient.id, today] });
                            toast.success(`${pendingManualClient.name} — "${label}" asignado para hoy`);
                            setPendingManualClient(null);
                            setClientSearch("");
                          }
                        } catch {
                          toast.error("Error al asignar el entrenamiento");
                        }
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all text-left group
                        ${isToday
                          ? "border-primary bg-primary/5 hover:bg-primary/10"
                          : "border-border hover:bg-primary/10 hover:border-primary/40"
                        }`}
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                          {(w as any).routines?.name ?? "Entrenamiento libre"}
                          {((w as any).routines?.total_days ?? 1) > 1 && (
                            <span className="text-xs text-muted-foreground ml-1">— Día {(w as any).day_number ?? 1}</span>
                          )}
                        </p>
                        <p className={`text-xs mt-0.5 ${isToday ? "text-primary font-medium" : isPast ? "text-muted-foreground" : "text-primary/70"}`}>
                          {isToday ? "Hoy" : format(dateObj, "EEEE d 'de' MMMM", { locale: es })}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        isToday ? "bg-primary text-primary-foreground" :
                        isPast ? "bg-secondary text-muted-foreground" :
                        "bg-primary/10 text-primary"
                      }`}>
                        {isToday ? "hoy" : isPast ? "pasado" : "próximo"}
                      </span>
                    </button>
                  );
                };
                return (
                  <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                    {todayWorkout.length > 0 && (
                      <>
                        <p className="text-[10px] font-bold text-primary uppercase tracking-wider px-1 pb-1">Hoy</p>
                        {todayWorkout.map(w => renderItem(w, true))}
                      </>
                    )}
                    {upcoming.length > 0 && (
                      <>
                        <p className="text-[10px] font-bold text-primary uppercase tracking-wider px-1 pb-1 pt-2">Próximos</p>
                        {[...upcoming].reverse().map(w => renderItem(w))}
                      </>
                    )}
                    {past.length > 0 && (
                      <>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1 pb-1 pt-2">Anteriores</p>
                        {past.map(w => renderItem(w))}
                      </>
                    )}
                  </div>
                );
              })()}

              <div className="flex gap-2 mt-3">
                <Button variant="ghost" size="sm" className="flex-1"
                  onClick={() => { setPendingManualClient(null); setClientSearch(""); }}>
                  ← Volver
                </Button>
                <Button variant="outline" size="sm" className="flex-1"
                  onClick={() => {
                    addManualClient(pendingManualClient);
                    toast.success(`${pendingManualClient.name} agregado sin entrenamiento`);
                    setPendingManualClient(null);
                    setClientSearch("");
                  }}>
                  Sin entrenamiento
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
 
      {(selectedGroup || allKioskClients.length > 0) && (
        <>
          <p className="text-sm text-muted-foreground mb-4">Tocá tu nombre para ver tu rutina de hoy:</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {allKioskClients.map(c => (
              <button
                key={c.id}
                onClick={() => {
                  setSelectedClient(c.id);
                  setSelectedClientName(c.name);
                }}
                className="bg-card border border-border rounded-xl p-6 text-center hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3 text-lg font-bold">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <p className="font-medium text-foreground text-sm">{c.name}</p>
              </button>
            ))}
          </div>
          {allKioskClients.length === 0 && (
            <p className="text-center text-muted-foreground py-8">Este turno no tiene alumnos.</p>
          )}
        </>
      )}
 
      {/* Dialog para gestionar turnos */}
      <Dialog open={managingOpen} onOpenChange={setManagingOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gestionar Turnos de Kiosco</DialogTitle>
          </DialogHeader>
 
          {/* Crear nuevo turno */}
          <div className="bg-secondary/30 rounded-lg p-4 mt-2">
            <p className="text-sm font-medium text-foreground mb-3">Nuevo turno</p>
            <div className="space-y-2">
              <Input
                placeholder="Nombre del turno (ej: Lunes 8hs) *"
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
              />
              <Input
                placeholder="Descripción (opcional)"
                value={newGroupDesc}
                onChange={e => setNewGroupDesc(e.target.value)}
              />
              <Button
                className="w-full"
                onClick={() => createGroup.mutate()}
                disabled={!newGroupName.trim()}
              >
                <Plus className="h-4 w-4 mr-2" />Crear Turno
              </Button>
            </div>
          </div>
 
          {/* Lista de turnos */}
          <div className="mt-4 space-y-2">
            {!kioskGroups?.length ? (
              <p className="text-sm text-muted-foreground text-center py-4">No hay turnos creados.</p>
            ) : (
              kioskGroups.map(g => (
                <div key={g.id} className="border border-border rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-card">
                    <p className="font-medium text-sm text-foreground">{g.name}</p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setManagingGroupId(managingGroupId === g.id ? null : g.id)}
                      >
                        {managingGroupId === g.id ? "Cerrar" : "Alumnos"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteGroup.mutate(g.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
 
                  {/* Panel de alumnos del turno */}
                  {managingGroupId === g.id && (
                    <div className="px-4 py-3 bg-secondary/20 border-t border-border">
                      {/* Alumnos actuales */}
                      {managingGroupMembers?.length ? (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {managingGroupMembers.map((m: any) => (
                            <span key={m.id} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                              {m.clients?.name}
                              <button onClick={() => removeMember.mutate(m.id)}>
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground mb-3">Sin alumnos en este turno.</p>
                      )}
 
                      {/* Buscar y agregar alumnos */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                        <Input
                          placeholder="Buscar alumno para agregar..."
                          className="pl-8 h-8 text-xs"
                          value={memberSearch}
                          onChange={e => setMemberSearch(e.target.value)}
                        />
                      </div>
                      {memberSearch && (
                        <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                          {filteredMemberSearch.map(c => (
                            <button
                              key={c.id}
                              onClick={() => addMember.mutate(c.id)}
                              className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-secondary text-xs text-foreground"
                            >
                              + {c.name}
                            </button>
                          ))}
                          {!filteredMemberSearch.length && (
                            <p className="text-xs text-muted-foreground px-3">Sin resultados.</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
 
function WorkoutNotes({ workoutId, initialNotes, onSave }: { workoutId: string; initialNotes: string; onSave: (notes: string) => void }) {
  const [notes, setNotes] = useState(initialNotes);
  const [saved, setSaved] = useState(true);

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Comentarios de la sesión</p>
      <textarea
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
        rows={3}
        placeholder="Anotá algo sobre esta sesión: cómo te sentiste, qué ajustar, observaciones..."
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

const KioskExerciseCard = forwardRef(function KioskExerciseCard({
  exercise, sets, reps, weight, unit = "kg", setGroups, assignedWorkoutId, exerciseId, existingLogs, onLogSet,
}: {
  exercise: any; sets: number | null; reps: number | null; weight: number | null; unit?: string;
  setGroups?: { sets: number; reps: number; weight: number | null }[] | null;
  assignedWorkoutId: string; exerciseId: string; existingLogs: any[];
  onLogSet: (params: any) => void;
}, ref: any) {
  // Expandir set_groups en filas individuales de series
  const allSets = setGroups?.length
    ? setGroups.flatMap(g => Array.from({ length: g.sets }, () => ({ targetReps: g.reps, targetWeight: g.weight })))
    : Array.from({ length: sets ?? 1 }, () => ({ targetReps: reps, targetWeight: weight }));

  const [localSets, setLocalSets] = useState(
    allSets.map((s, i) => {
      const log = existingLogs.find((l: any) => l.set_number === i + 1);
      return {
        reps: log?.reps_done?.toString() ?? s.targetReps?.toString() ?? "",
        weight: log?.weight_used?.toString() ?? s.targetWeight?.toString() ?? "",
      };
    })
  );

  useImperativeHandle(ref, () => ({
    assignedWorkoutId,
    exerciseId,
    getSets: () => localSets.map((s, i) => ({
      set_number: i + 1,
      reps_done: parseInt(s.reps) || 0,
      weight_used: parseFloat(s.weight) || 0,
    })),
  }));

  return (
    <div className="bg-card border border-border rounded-xl p-4 mb-3">
      <div className="mb-3">
        <p className="font-heading font-bold text-foreground">{exercise?.name}</p>
        {exercise?.muscle_group && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{exercise.muscle_group}</span>
        )}
        {setGroups?.length ? (
          setGroups.map((g, i) => (
            <p key={i} className="text-xs text-muted-foreground">{g.sets}×{g.reps}{g.weight ? ` @ ${g.weight}${unit}` : ""}</p>
          ))
        ) : (
          sets ? <p className="text-xs text-muted-foreground">{sets}×{reps ?? "?"}{weight ? ` @ ${weight}${unit}` : ""}</p> : null
        )}
      </div>
      <div className="space-y-2">
        {/* Encabezados de columna */}
        <div className="flex items-center gap-3">
          <span className="w-12" />
          <span className="w-20 text-[10px] font-semibold text-muted-foreground text-center uppercase tracking-wider">Reps</span>
          <span className="w-20 text-[10px] font-semibold text-muted-foreground text-center uppercase tracking-wider">{unit}</span>
        </div>
        {localSets.map((s, i) => {
          const isLogged = existingLogs.some((l: any) => l.set_number === i + 1 && l.completed);
          return (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-12">Serie {i + 1}</span>
              <Input type="number" placeholder="Reps" className="w-20 h-8 text-sm" value={s.reps}
                onChange={e => { const n = [...localSets]; n[i].reps = e.target.value; setLocalSets(n); }} />
              <Input type="number" placeholder={unit} className="w-20 h-8 text-sm" value={s.weight}
                onChange={e => { const n = [...localSets]; n[i].weight = e.target.value; setLocalSets(n); }} />
              <button onClick={() => onLogSet({
                assigned_workout_id: assignedWorkoutId, exercise_id: exerciseId,
                set_number: i + 1, reps_done: parseInt(s.reps) || 0, weight_used: parseFloat(s.weight) || 0,
              })}>
                {isLogged ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <Circle className="h-5 w-5 text-muted-foreground hover:text-primary" />}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
});

