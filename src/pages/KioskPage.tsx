import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dumbbell, ArrowLeft, CheckCircle2, Circle, Search, UserPlus, X, Settings, Plus, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
 
export default function KioskPage() {
  const queryClient = useQueryClient();
  const [selectedGroup, setSelectedGroup] = useState("");
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [selectedClientName, setSelectedClientName] = useState("");
  const [manualClients, setManualClients] = useState<{ id: string; name: string }[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [managingOpen, setManagingOpen] = useState(false);
  const [pendingManualClient, setPendingManualClient] = useState<{ id: string; name: string } | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const today = format(new Date(), "yyyy-MM-dd");
 
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

  const baseWeek = addWeeks(new Date(), weekOffset);
  const weekStart = format(startOfWeek(baseWeek, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(baseWeek, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekDays = eachDayOfInterval({
    start: startOfWeek(baseWeek, { weekStartsOn: 1 }),
    end: endOfWeek(baseWeek, { weekStartsOn: 1 }),
  });

  const { data: pendingClientWeekWorkouts } = useQuery({
    queryKey: ["pending-client-week", pendingManualClient?.id, weekStart, weekEnd],
    enabled: !!pendingManualClient,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assigned_workouts")
        .select("*, routines(id, name)")
        .eq("client_id", pendingManualClient!.id)
        .gte("workout_date", weekStart)
        .lte("workout_date", weekEnd);
      if (error) throw error;
      return data;
    },
  });

  const assignWorkoutToday = useMutation({
    mutationFn: async ({ clientId, routineId }: { clientId: string; routineId: string }) => {
      const { error } = await supabase.from("assigned_workouts").insert({
        client_id: clientId,
        routine_id: routineId,
        workout_date: today,
      });
      if (error) throw error;
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
 
  const groupClientIds = groupMembers?.map((m: any) => m.clients.id) ?? [];
  const allKioskClients = [
    ...(groupMembers?.map((m: any) => ({ id: m.clients.id, name: m.clients.name })) ?? []),
    ...manualClients.filter(c => !groupClientIds.includes(c.id)),
  ];
 
  const filteredSearch = allClients?.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) &&
    !allKioskClients.some(k => k.id === c.id)
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
            // Prioridad: ejercicios propios del workout, sino los de la rutina base
            const workoutAssigned = assignedExercises?.filter((e: any) => e.assigned_workout_id === workout.id) ?? [];
            const dayNum = workout.day_number ?? 1;
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
                    <div key={blockNum}>
                      {blocks.length > 1 && (
                        <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Bloque {blockNum}</p>
                      )}
                      {blockExercises.map((re: any) => (
                        <KioskExerciseCard
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
                  );
                })}
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
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-foreground">Buscar alumno</p>
            <button onClick={() => { setSearchOpen(false); setClientSearch(""); }}>
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nombre..." className="pl-10" value={clientSearch} onChange={e => setClientSearch(e.target.value)} />
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

          {/* Paso 2: elegir día del calendario semanal */}
          {pendingManualClient && (
            <div className="mt-3 border-t border-border pt-3">
              <p className="text-sm font-medium text-foreground mb-1">
                ¿Qué día usa <span className="text-primary">{pendingManualClient.name}</span> hoy?
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                Tocá el día cuyo entrenamiento querés asignarle para hoy.
              </p>

              {/* Navegación de semana */}
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={() => setWeekOffset(o => o - 1)}
                  className="p-1 rounded hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs text-muted-foreground font-medium">
                  {format(startOfWeek(baseWeek, { weekStartsOn: 1 }), "d MMM", { locale: es })} — {format(endOfWeek(baseWeek, { weekStartsOn: 1 }), "d MMM yyyy", { locale: es })}
                </span>
                <button
                  onClick={() => setWeekOffset(o => o + 1)}
                  className="p-1 rounded hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {/* Días de la semana */}
              <div className="grid grid-cols-7 gap-1 mb-3">
                {weekDays.map(day => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const isToday = dateStr === today;
                  const workout = pendingClientWeekWorkouts?.find(w => w.workout_date === dateStr);
                  const hasRoutine = !!(workout as any)?.routines?.id;
                  const isClickable = hasRoutine && !isToday;

                  return (
                    <button
                      key={dateStr}
                      disabled={!isClickable}
                      onClick={async () => {
                        const routineId = (workout as any).routines.id;
                        const routineName = (workout as any).routines.name;
                        try {
                          await assignWorkoutToday.mutateAsync({
                            clientId: pendingManualClient.id,
                            routineId,
                          });
                          setManualClients(prev => [...prev, pendingManualClient]);
                          queryClient.invalidateQueries({ queryKey: ["kiosk-workouts", pendingManualClient.id, today] });
                          toast.success(`${pendingManualClient.name} — "${routineName}" asignado para hoy`);
                          setPendingManualClient(null);
                          setWeekOffset(0);
                          setSearchOpen(false);
                        } catch {
                          toast.error("Error al asignar el entrenamiento");
                        }
                      }}
                      className={`flex flex-col items-center rounded-lg p-1.5 text-xs transition-colors border
                        ${isToday
                          ? "border-primary/30 bg-primary/5 text-primary opacity-60 cursor-default"
                          : isClickable
                            ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/25 cursor-pointer"
                            : "border-border bg-secondary/20 text-muted-foreground opacity-40 cursor-default"
                        }`}
                    >
                      <span className="font-bold uppercase">{format(day, "EEE", { locale: es }).slice(0, 2)}</span>
                      <span className="mt-0.5">{format(day, "d")}</span>
                      {isClickable && <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1" />}
                      {isToday && <div className="w-1.5 h-1.5 rounded-full bg-primary/50 mt-1" />}
                    </button>
                  );
                })}
              </div>

              {pendingClientWeekWorkouts !== undefined && pendingClientWeekWorkouts.filter(w => {
                const isNotToday = w.workout_date !== today;
                const hasR = !!(w as any).routines?.id;
                return isNotToday && hasR;
              }).length === 0 && (
                <p className="text-xs text-muted-foreground text-center mb-3">
                  Sin entrenamientos en esta semana. Navegá a otra semana.
                </p>
              )}

              <div className="flex gap-2 mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1"
                  onClick={() => { setPendingManualClient(null); setWeekOffset(0); }}
                >
                  ← Volver
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setManualClients(prev => [...prev, pendingManualClient]);
                    toast.success(`${pendingManualClient.name} agregado sin entrenamiento`);
                    setPendingManualClient(null);
                    setWeekOffset(0);
                    setSearchOpen(false);
                  }}
                >
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
 
function KioskExerciseCard({
  exercise, sets, reps, weight, assignedWorkoutId, exerciseId, existingLogs, onLogSet,
}: {
  exercise: any; sets: number | null; reps: number | null; weight: number | null;
  assignedWorkoutId: string; exerciseId: string; existingLogs: any[];
  onLogSet: (params: any) => void;
}) {
  const numSets = sets ?? 1;
  const defaultReps = reps?.toString() ?? "";
  const defaultWeight = weight?.toString() ?? "";
 
  const [localSets, setLocalSets] = useState(
    Array.from({ length: numSets }, (_, i) => {
      const log = existingLogs.find((l: any) => l.set_number === i + 1);
      return {
        reps: log?.reps_done?.toString() ?? defaultReps,
        weight: log?.weight_used?.toString() ?? defaultWeight,
      };
    })
  );
 
  const setsLabel = sets ? `${sets}×${reps ?? "?"}` : "";
  const weightLabel = weight ? ` @ ${weight}kg` : "";
 
  return (
    <div className="bg-card border border-border rounded-xl p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-heading font-bold text-foreground">{exercise?.name}</p>
          {exercise?.muscle_group && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{exercise.muscle_group}</span>
          )}
        </div>
        {setsLabel && (
          <span className="text-xs text-muted-foreground">{setsLabel}{weightLabel}</span>
        )}
      </div>
      <div className="space-y-2">
        {localSets.map((s, i) => {
          const isLogged = existingLogs.some((l: any) => l.set_number === i + 1 && l.completed);
          return (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-12">Serie {i + 1}</span>
              <Input type="number" placeholder="Reps" className="w-20 h-8 text-sm" value={s.reps}
                onChange={e => { const n = [...localSets]; n[i].reps = e.target.value; setLocalSets(n); }} />
              <Input type="number" placeholder="Kg" className="w-20 h-8 text-sm" value={s.weight}
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
}

