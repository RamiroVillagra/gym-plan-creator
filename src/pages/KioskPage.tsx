import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dumbbell, ArrowLeft, CheckCircle2, Circle, Search, UserPlus, X } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

export default function KioskPage() {
  const queryClient = useQueryClient();
  const [selectedGroup, setSelectedGroup] = useState("");
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [selectedClientName, setSelectedClientName] = useState("");
  const [manualClients, setManualClients] = useState<{ id: string; name: string }[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: groups } = useQuery({
    queryKey: ["groups"],
    queryFn: async () => {
      const { data, error } = await supabase.from("groups").select("*").order("name");
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

  const { data: groupMembers } = useQuery({
    queryKey: ["kiosk-members", selectedGroup],
    enabled: !!selectedGroup,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("*, clients(id, name)")
        .eq("group_id", selectedGroup);
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
        .select("*, routines(name, routine_exercises(*, exercises(name, muscle_group)))")
        .eq("client_id", selectedClient!)
        .eq("workout_date", today);
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

  // Combine group members + manual clients
  const groupClientIds = groupMembers?.map((m: any) => m.clients.id) ?? [];
  const allKioskClients = [
    ...(groupMembers?.map((m: any) => ({ id: m.clients.id, name: m.clients.name })) ?? []),
    ...manualClients.filter(c => !groupClientIds.includes(c.id)),
  ];

  const filteredSearch = allClients?.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) &&
    !allKioskClients.some(k => k.id === c.id)
  ) ?? [];

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
            const exercises = workout.routines?.routine_exercises ?? [];
            const blocks = [...new Set(exercises.map((re: any) => re.block_number ?? 1))].sort((a: number, b: number) => a - b);

            return (
              <div key={workout.id} className="space-y-4 mb-6">
                {workout.routines?.name && (
                  <h2 className="text-xl font-heading font-bold text-primary">{workout.routines.name}</h2>
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

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-8">
        <Dumbbell className="h-8 w-8 text-primary" />
        <span className="font-heading text-2xl font-bold">Modo Kiosco</span>
      </div>

      <div className="flex gap-4 mb-8 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <label className="text-sm text-muted-foreground block mb-2">Seleccioná el turno/grupo:</label>
          <select
            className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
            value={selectedGroup}
            onChange={e => setSelectedGroup(e.target.value)}
          >
            <option value="">Elegir grupo</option>
            {groups?.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
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
          {clientSearch && (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {filteredSearch.map(c => (
                <button
                  key={c.id}
                  onClick={() => {
                    setManualClients(prev => [...prev, { id: c.id, name: c.name }]);
                    setClientSearch("");
                    setSearchOpen(false);
                    toast.success(`${c.name} agregado al kiosco`);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-secondary/50 text-sm text-foreground"
                >
                  {c.name}
                </button>
              ))}
              {!filteredSearch.length && <p className="text-xs text-muted-foreground px-3">Sin resultados.</p>}
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
            <p className="text-center text-muted-foreground py-8">Este grupo no tiene alumnos.</p>
          )}
        </>
      )}
    </div>
  );
}

function KioskExerciseCard({
  exercise, sets, reps, weight, assignedWorkoutId, exerciseId, existingLogs, onLogSet,
}: {
  exercise: any; sets: number; reps: number; weight: number | null;
  assignedWorkoutId: string; exerciseId: string; existingLogs: any[];
  onLogSet: (params: any) => void;
}) {
  const [localSets, setLocalSets] = useState(
    Array.from({ length: sets }, (_, i) => {
      const log = existingLogs.find((l: any) => l.set_number === i + 1);
      return {
        reps: log?.reps_done?.toString() ?? reps.toString(),
        weight: log?.weight_used?.toString() ?? (weight?.toString() ?? ""),
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
        <span className="text-xs text-muted-foreground">{sets}×{reps} {weight ? `@ ${weight}kg` : ""}</span>
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
