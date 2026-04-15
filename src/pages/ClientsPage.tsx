import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Search, ArrowLeft, ClipboardList, CalendarDays, UsersRound, X, Eye, FileText } from "lucide-react";
import { toast } from "sonner";
import { format, addDays, addWeeks, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import RoutineDetailView from "@/components/RoutineDetailView";

export default function ClientsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  const [selectedClient, setSelectedClient] = useState<any>(null);

  // Planificar dialog
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignRoutineId, setAssignRoutineId] = useState("");
  const [assignDays, setAssignDays] = useState<{ dayOfWeek: number; routineDay: number }[]>([]);
  const [assignWeeks, setAssignWeeks] = useState("4");

  const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  // Assign group dialog
  const [groupOpen, setGroupOpen] = useState(false);
  const [assignGroupId, setAssignGroupId] = useState("");

  // Create routine dialog
  const [createRoutineOpen, setCreateRoutineOpen] = useState(false);
  const [newRoutineName, setNewRoutineName] = useState("");
  const [newRoutineDesc, setNewRoutineDesc] = useState("");
  const [newRoutineDays, setNewRoutineDays] = useState("1");

  // View routine detail
  const [viewRoutineId, setViewRoutineId] = useState<string | null>(null);
  const [viewRoutineName, setViewRoutineName] = useState("");
  const [viewRoutineDays, setViewRoutineDays] = useState(1);
  const [viewAssignedWorkoutId, setViewAssignedWorkoutId] = useState<string | null>(null);
  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("name");
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

  const { data: groups } = useQuery({
    queryKey: ["groups"],
    queryFn: async () => {
      const { data, error } = await supabase.from("groups").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: clientWorkouts } = useQuery({
    queryKey: ["client-workouts", selectedClient?.id],
    enabled: !!selectedClient,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assigned_workouts")
        .select("*, routines(name, total_days)")
        .eq("client_id", selectedClient.id)
        .gte("workout_date", format(new Date(), "yyyy-MM-dd"))
        .order("workout_date");
      if (error) throw error;
      return data;
    },
  });

  const { data: clientGroups } = useQuery({
    queryKey: ["client-groups", selectedClient?.id],
    enabled: !!selectedClient,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("*, groups(name)")
        .eq("client_id", selectedClient.id);
      if (error) throw error;
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("clients").insert({
        name, email: email || null, phone: phone || null, notes: notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["clients-count"] });
      setName(""); setEmail(""); setPhone(""); setNotes("");
      setOpen(false);
      toast.success("Cliente registrado");
    },
    onError: () => toast.error("Error al registrar cliente"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["clients-count"] });
      setSelectedClient(null);
      toast.success("Cliente eliminado");
    },
  });

  const assignRoutine = useMutation({
    mutationFn: async () => {
      if (!selectedClient || !assignDays.length) return;
      const weeks = parseInt(assignWeeks) || 1;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const firstOccurrences = assignDays.map(({ dayOfWeek, routineDay }) => {
        const thisWeek = addDays(startOfWeek(today, { weekStartsOn: 1 }), dayOfWeek);
        const firstDate = thisWeek < today ? addWeeks(thisWeek, 1) : thisWeek;
        return { routineDay, firstDate };
      });

      const inserts: any[] = [];
      for (const { routineDay, firstDate } of firstOccurrences) {
        for (let w = 0; w < weeks; w++) {
          inserts.push({
            client_id: selectedClient.id,
            routine_id: assignRoutineId || null,
            workout_date: format(addWeeks(firstDate, w), "yyyy-MM-dd"),
            day_number: routineDay,
          });
        }
      }
      const { error } = await supabase.from("assigned_workouts").insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-workouts", selectedClient?.id] });
      queryClient.invalidateQueries({ queryKey: ["assigned-workouts"] });
      setAssignOpen(false);
      setAssignRoutineId(""); setAssignDays([]); setAssignWeeks("4");
      toast.success("Entrenamientos planificados");
    },
    onError: () => toast.error("Error al planificar"),
  });

  const toggleAssignDay = (dayOfWeek: number) => {
    setAssignDays(prev => {
      const exists = prev.find(x => x.dayOfWeek === dayOfWeek);
      if (exists) return prev.filter(x => x.dayOfWeek !== dayOfWeek);
      return [...prev, { dayOfWeek, routineDay: 1 }];
    });
  };
  const setAssignRoutineDay = (dayOfWeek: number, routineDay: number) =>
    setAssignDays(prev => prev.map(x => x.dayOfWeek === dayOfWeek ? { ...x, routineDay } : x));

  const removeWorkout = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("assigned_workouts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-workouts", selectedClient?.id] });
      queryClient.invalidateQueries({ queryKey: ["assigned-workouts"] });
      toast.success("Entrenamiento eliminado");
    },
  });

  const assignGroup = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("group_members").insert({
        client_id: selectedClient.id,
        group_id: assignGroupId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-groups", selectedClient?.id] });
      queryClient.invalidateQueries({ queryKey: ["group-members"] });
      setGroupOpen(false);
      setAssignGroupId("");
      toast.success("Agregado al grupo");
    },
    onError: () => toast.error("Error (¿ya está en el grupo?)"),
  });

  const removeFromGroup = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("group_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-groups", selectedClient?.id] });
      toast.success("Removido del grupo");
    },
  });

  const createRoutine = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("routines").insert({
        name: newRoutineName,
        description: newRoutineDesc || null,
        total_days: parseInt(newRoutineDays) || 1,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["routines"] });
      setCreateRoutineOpen(false);
      setNewRoutineName(""); setNewRoutineDesc(""); setNewRoutineDays("1");
      // Open it for editing
      setViewRoutineId(data.id);
      setViewRoutineName(data.name);
      setViewRoutineDays(data.total_days);
      toast.success("Rutina creada, ahora podés agregar ejercicios");
    },
    onError: () => toast.error("Error al crear rutina"),
  });

  const filtered = clients?.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  // Client detail panel
  if (selectedClient) {
    const existingGroupIds = clientGroups?.map((g: any) => g.group_id) ?? [];
    const availableGroups = groups?.filter(g => !existingGroupIds.includes(g.id));

    return (
      <div className="animate-fade-in">
        <Button variant="ghost" className="mb-4" onClick={() => setSelectedClient(null)}>
          <ArrowLeft className="h-4 w-4 mr-2" />Volver a Clientes
        </Button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-heading font-bold">{selectedClient.name}</h1>
            <div className="flex gap-3 mt-1 text-sm text-muted-foreground">
              {selectedClient.email && <span>{selectedClient.email}</span>}
              {selectedClient.phone && <span>{selectedClient.phone}</span>}
            </div>
          </div>
          <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate(selectedClient.id)}>
            <Trash2 className="h-4 w-4 mr-2" />Eliminar
          </Button>
        </div>

        {/* Quick actions */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <Button variant="outline" onClick={() => setAssignOpen(true)}>
            <ClipboardList className="h-4 w-4 mr-2" />Asignar Rutina
          </Button>
          <Button variant="outline" onClick={() => setCreateRoutineOpen(true)}>
            <FileText className="h-4 w-4 mr-2" />Crear Rutina
          </Button>
          <Button variant="outline" onClick={() => setGroupOpen(true)}>
            <UsersRound className="h-4 w-4 mr-2" />Asignar Grupo
          </Button>
        </div>

        {/* Assigned workouts */}
        <div className="mb-6">
          <h2 className="text-lg font-heading font-bold mb-3 flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Próximos Entrenamientos
          </h2>
          {!clientWorkouts?.length ? (
            <p className="text-sm text-muted-foreground">Sin entrenamientos asignados.</p>
          ) : (
            <div className="space-y-2">
              {clientWorkouts.map((w: any) => (
                <div key={w.id} className="flex items-center justify-between bg-card border border-border rounded-lg px-4 py-2">
                  <div className="flex-1">
                    <span className="text-sm font-medium text-foreground">
                      {format(new Date(w.workout_date + "T12:00:00"), "EEE d MMM", { locale: es })}
                    </span>
                    {w.routines?.name && (
                      <span className="text-xs text-muted-foreground ml-2">— {w.routines.name}</span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => {
                      setViewRoutineId(w.routine_id || "");
                      setViewRoutineName(w.routines?.name || "Entrenamiento");
                      setViewRoutineDays(w.routines?.total_days || 1);
                      setViewAssignedWorkoutId(w.id);
                    }}>
                      <Eye className="h-3 w-3 text-primary" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => removeWorkout.mutate(w.id)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Groups */}
        <div>
          <h2 className="text-lg font-heading font-bold mb-3 flex items-center gap-2">
            <UsersRound className="h-5 w-5 text-primary" />
            Grupos
          </h2>
          {!clientGroups?.length ? (
            <p className="text-sm text-muted-foreground">No pertenece a ningún grupo.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {clientGroups.map((g: any) => (
                <span key={g.id} className="inline-flex items-center gap-1 text-sm px-3 py-1 rounded-full bg-primary/10 text-primary">
                  {g.groups?.name}
                  <button onClick={() => removeFromGroup.mutate(g.id)}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Planificar dialog */}
        <Dialog open={assignOpen} onOpenChange={v => { setAssignOpen(v); if (!v) { setAssignRoutineId(""); setAssignDays([]); setAssignWeeks("4"); } }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Planificar para {selectedClient.name}</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <select
                className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
                value={assignRoutineId}
                onChange={e => { setAssignRoutineId(e.target.value); setAssignDays([]); }}
              >
                <option value="">Sin rutina (ejercicios manuales)</option>
                {routines?.map(r => <option key={r.id} value={r.id}>{r.name}{(r as any).total_days > 1 ? ` (${(r as any).total_days} días)` : ""}</option>)}
              </select>

              <div>
                <label className="text-xs text-muted-foreground block mb-2">¿Qué días entrena?</label>
                <div className="flex gap-1 mb-3">
                  {dayNames.map((d, i) => {
                    const isSelected = assignDays.some(x => x.dayOfWeek === i);
                    return (
                      <button
                        key={i}
                        onClick={() => toggleAssignDay(i)}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${isSelected ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
                {(() => {
                  const totalDays = (routines?.find(r => r.id === assignRoutineId) as any)?.total_days ?? 1;
                  if (!assignRoutineId || totalDays <= 1 || !assignDays.length) return null;
                  return (
                    <div className="space-y-2 border border-border rounded-lg p-3 bg-secondary/20">
                      <p className="text-xs text-muted-foreground font-medium">¿Qué día de la rutina corresponde a cada día?</p>
                      {[...assignDays].sort((a, b) => a.dayOfWeek - b.dayOfWeek).map(({ dayOfWeek, routineDay }) => (
                        <div key={dayOfWeek} className="flex items-center gap-3">
                          <span className="text-xs font-medium text-foreground w-8">{dayNames[dayOfWeek]}</span>
                          <div className="flex gap-1 flex-1">
                            {Array.from({ length: totalDays }, (_, i) => i + 1).map(d => (
                              <button
                                key={d}
                                onClick={() => setAssignRoutineDay(dayOfWeek, d)}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${routineDay === d ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
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
                <Input type="number" min="1" max="52" value={assignWeeks} onChange={e => setAssignWeeks(e.target.value)} className="mt-1" />
              </div>

              <Button
                className="w-full"
                onClick={() => assignRoutine.mutate()}
                disabled={!assignDays.length || assignRoutine.isPending}
              >
                {assignRoutine.isPending ? "Planificando..." : "Planificar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Assign group dialog */}
        <Dialog open={groupOpen} onOpenChange={setGroupOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Agregar a Grupo</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <select
                className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
                value={assignGroupId}
                onChange={e => setAssignGroupId(e.target.value)}
              >
                <option value="">Seleccionar grupo</option>
                {availableGroups?.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <Button className="w-full" onClick={() => assignGroup.mutate()} disabled={!assignGroupId}>
                Agregar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Create routine dialog */}
        <Dialog open={createRoutineOpen} onOpenChange={setCreateRoutineOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Crear Rutina para {selectedClient.name}</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <Input placeholder="Nombre de la rutina *" value={newRoutineName} onChange={e => setNewRoutineName(e.target.value)} />
              <Input placeholder="Descripción (opcional)" value={newRoutineDesc} onChange={e => setNewRoutineDesc(e.target.value)} />
              <div>
                <label className="text-xs text-muted-foreground">Días de entrenamiento</label>
                <Input type="number" min="1" max="7" value={newRoutineDays} onChange={e => setNewRoutineDays(e.target.value)} />
              </div>
              <Button className="w-full" onClick={() => createRoutine.mutate()} disabled={!newRoutineName.trim()}>
                Crear Rutina
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* View/Edit routine detail dialog */}
        <Dialog open={!!viewAssignedWorkoutId} onOpenChange={() => { setViewRoutineId(null); setViewAssignedWorkoutId(null); }}>
          <DialogContent className="max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Plan: {viewRoutineName}</DialogTitle></DialogHeader>
            {viewAssignedWorkoutId && (
              <div className="mt-4">
                <RoutineDetailView
                  routineId={viewRoutineId ?? ""}
                  routineName={viewRoutineName}
                  totalDays={viewRoutineDays}
                  editable
                  assignedWorkoutId={viewAssignedWorkoutId}
                  clientId={selectedClient?.id}
                />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Client list
  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-heading font-bold">Clientes</h1>
          <p className="text-muted-foreground">Gestiona tus alumnos</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nuevo Cliente</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Registrar Cliente</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <Input placeholder="Nombre *" value={name} onChange={e => setName(e.target.value)} />
              <Input placeholder="Email (opcional)" value={email} onChange={e => setEmail(e.target.value)} />
              <Input placeholder="Teléfono (opcional)" value={phone} onChange={e => setPhone(e.target.value)} />
              <Input placeholder="Notas (opcional)" value={notes} onChange={e => setNotes(e.target.value)} />
              <Button className="w-full" onClick={() => addMutation.mutate()} disabled={!name.trim()}>Guardar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar clientes..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Cargando...</p>
      ) : !filtered?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No hay clientes{search ? " que coincidan" : ""}.</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {filtered.map(client => (
            <button
              key={client.id}
              onClick={() => setSelectedClient(client)}
              className="flex items-center justify-between bg-card border border-border rounded-lg px-4 py-3 hover:border-primary/30 transition-colors w-full text-left"
            >
              <div>
                <p className="font-medium text-foreground">{client.name}</p>
                <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                  {client.email && <span>{client.email}</span>}
                  {client.phone && <span>{client.phone}</span>}
                </div>
              </div>
              <span className="text-xs text-muted-foreground">→</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
