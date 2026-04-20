import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ChevronDown, ChevronUp, Users, CalendarDays, Search, X } from "lucide-react";
import { toast } from "sonner";
import { format, addWeeks, addDays, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";

export default function GroupsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [addMemberGroupId, setAddMemberGroupId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [addedInSession, setAddedInSession] = useState<{ id: string; name: string }[]>([]);
  
  // Bulk assign state
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkGroupId, setBulkGroupId] = useState<string | null>(null);
  const [bulkRoutineId, setBulkRoutineId] = useState("");
  const [bulkRoutineName, setBulkRoutineName] = useState("");
  const [bulkRoutineSearch, setBulkRoutineSearch] = useState("");
  const [bulkDays, setBulkDays] = useState<{ dayOfWeek: number; routineDay: number }[]>([]);
  const [bulkWeeks, setBulkWeeks] = useState("4");

  const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  const toggleBulkDay = (dayOfWeek: number) => {
    setBulkDays(prev => {
      const exists = prev.find(x => x.dayOfWeek === dayOfWeek);
      if (exists) return prev.filter(x => x.dayOfWeek !== dayOfWeek);
      return [...prev, { dayOfWeek, routineDay: 1 }];
    });
  };
  const setBulkRoutineDayFn = (dayOfWeek: number, routineDay: number) => {
    setBulkDays(prev => prev.map(x => x.dayOfWeek === dayOfWeek ? { ...x, routineDay } : x));
  };

  const { data: groups, isLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: async () => {
      const { data, error } = await supabase.from("groups").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: clients } = useQuery({
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

  const { data: groupMembers } = useQuery({
    queryKey: ["group-members", expandedGroup],
    enabled: !!expandedGroup,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_members")
        .select("*, clients(name)")
        .eq("group_id", expandedGroup!);
      if (error) throw error;
      return data;
    },
  });

  const createGroup = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("groups").insert({
        name, description: description || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      setName(""); setDescription(""); setOpen(false);
      toast.success("Grupo creado");
    },
    onError: () => toast.error("Error al crear grupo"),
  });

  const addMember = useMutation({
    mutationFn: async ({ clientId, clientName }: { clientId: string; clientName: string }) => {
      const { error } = await supabase.from("group_members").insert({
        group_id: addMemberGroupId!, client_id: clientId,
      });
      if (error) throw error;
      return clientName;
    },
    onSuccess: (clientName) => {
      queryClient.invalidateQueries({ queryKey: ["group-members"] });
      setMemberSearch("");
      setAddedInSession(prev => [...prev, { id: selectedClientId, name: clientName }]);
      toast.success(`${clientName} agregado`);
    },
    onError: () => toast.error("Error al agregar alumno"),
  });

  const removeMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("group_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-members"] });
      toast.success("Alumno removido del grupo");
    },
  });

  const deleteGroup = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("groups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      toast.success("Grupo eliminado");
    },
  });

  const bulkAssignRoutine = useMutation({
    mutationFn: async () => {
      // Get all members of the group
      const { data: members, error: membersError } = await supabase
        .from("group_members")
        .select("client_id")
        .eq("group_id", bulkGroupId!);
      if (membersError) throw membersError;
      if (!members?.length) throw new Error("El grupo no tiene alumnos");

      const weeks = parseInt(bulkWeeks) || 1;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Para cada día seleccionado, calcular la primera ocurrencia >= hoy
      const firstOccurrences = bulkDays.map(({ dayOfWeek, routineDay }) => {
        const thisWeekOccurrence = addDays(startOfWeek(today, { weekStartsOn: 1 }), dayOfWeek);
        const firstDate = thisWeekOccurrence < today
          ? addWeeks(thisWeekOccurrence, 1)
          : thisWeekOccurrence;
        return { dayOfWeek, routineDay, firstDate };
      });

      const inserts: any[] = [];
      for (const member of members) {
        for (const { routineDay, firstDate } of firstOccurrences) {
          for (let w = 0; w < weeks; w++) {
            const date = addWeeks(firstDate, w);
            inserts.push({
              client_id: member.client_id,
              routine_id: bulkRoutineId || null,
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
      queryClient.invalidateQueries({ queryKey: ["workouts-count"] });
      setBulkAssignOpen(false); setBulkRoutineId(""); setBulkRoutineName(""); setBulkRoutineSearch(""); setBulkDays([]);
      toast.success("Rutina asignada a todo el grupo");
    },
    onError: (e: any) => toast.error(e.message || "Error al asignar"),
  });

  // Filter out clients already in the group
  const existingMemberIds = groupMembers?.map((m: any) => m.client_id) ?? [];
  const availableClients = clients?.filter(c => !existingMemberIds.includes(c.id));

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-heading font-bold">Grupos</h1>
          <p className="text-muted-foreground">Agrupa alumnos por turno o categoría</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nuevo Grupo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Crear Grupo</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <Input placeholder="Nombre del grupo *" value={name} onChange={e => setName(e.target.value)} />
              <Input placeholder="Descripción (opcional)" value={description} onChange={e => setDescription(e.target.value)} />
              <Button className="w-full" onClick={() => createGroup.mutate()} disabled={!name.trim()}>Crear</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Cargando...</p>
      ) : !groups?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No hay grupos creados.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(group => (
            <div key={group.id} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3">
                <button
                  onClick={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)}
                  className="flex items-center gap-2 text-left flex-1"
                >
                  {expandedGroup === group.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  <div>
                    <p className="font-medium text-foreground">{group.name}</p>
                    {group.description && <p className="text-xs text-muted-foreground">{group.description}</p>}
                  </div>
                </button>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => {
                    setBulkGroupId(group.id);
                    setBulkAssignOpen(true);
                  }}>
                    <CalendarDays className="h-4 w-4 mr-1" />
                    Asignar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => {
                    setAddMemberGroupId(group.id);
                    setExpandedGroup(group.id);
                    setMemberSearch("");
                    setAddedInSession([]);
                    setAddMemberOpen(true);
                  }}>
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteGroup.mutate(group.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>

              {expandedGroup === group.id && (
                <div className="border-t border-border px-4 py-3 space-y-2">
                  {!groupMembers?.length ? (
                    <p className="text-sm text-muted-foreground py-2">Sin alumnos. Agrega uno.</p>
                  ) : (
                    groupMembers.map((m: any) => (
                      <div key={m.id} className="flex items-center justify-between bg-secondary/50 rounded-lg px-3 py-2">
                        <p className="text-sm font-medium text-foreground">{m.clients?.name}</p>
                        <Button variant="ghost" size="icon" onClick={() => removeMember.mutate(m.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add member dialog */}
      <Dialog open={addMemberOpen} onOpenChange={(o) => { setAddMemberOpen(o); if (!o) setMemberSearch(""); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Agregar alumnos al grupo</DialogTitle></DialogHeader>
          <div className="mt-2 space-y-4">

            {/* Alumnos agregados en esta sesión */}
            {addedInSession.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pb-3 border-b border-border">
                {addedInSession.map(c => (
                  <span key={c.id} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">
                    {c.name}
                  </span>
                ))}
              </div>
            )}

            {/* Buscador por texto */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Escribí el nombre del alumno..."
                className="pl-10"
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                autoFocus
              />
              {memberSearch && (
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  onClick={() => setMemberSearch("")}
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>

            {/* Resultados */}
            {memberSearch && (
              <div className="space-y-1 max-h-56 overflow-y-auto -mt-1">
                {availableClients
                  ?.filter(c =>
                    c.name.toLowerCase().includes(memberSearch.toLowerCase()) &&
                    !addedInSession.some(a => a.id === c.id)
                  )
                  .map(c => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setSelectedClientId(c.id);
                        addMember.mutate({ clientId: c.id, clientName: c.name });
                      }}
                      disabled={addMember.isPending}
                      className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-secondary/60 text-sm text-foreground transition-colors flex items-center gap-2"
                    >
                      <Plus className="h-3.5 w-3.5 text-primary shrink-0" />
                      {c.name}
                    </button>
                  ))
                }
                {availableClients?.filter(c =>
                  c.name.toLowerCase().includes(memberSearch.toLowerCase()) &&
                  !addedInSession.some(a => a.id === c.id)
                ).length === 0 && (
                  <p className="text-xs text-muted-foreground px-3 py-2">Sin resultados.</p>
                )}
              </div>
            )}

            <Button
              variant="outline"
              className="w-full"
              onClick={() => { setAddMemberOpen(false); setMemberSearch(""); }}
            >
              Listo
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk assign routine dialog */}
      <Dialog open={bulkAssignOpen} onOpenChange={(o) => {
        setBulkAssignOpen(o);
        if (!o) { setBulkRoutineId(""); setBulkRoutineName(""); setBulkRoutineSearch(""); setBulkDays([]); }
      }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Asignar Rutina al Grupo</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">

            {/* Rutina */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Rutina</label>
              {bulkRoutineId ? (
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-primary/10 border border-primary/30">
                  <span className="text-sm font-medium text-primary">{bulkRoutineName}</span>
                  <button onClick={() => { setBulkRoutineId(""); setBulkRoutineName(""); setBulkRoutineSearch(""); setBulkDays([]); }}>
                    <X className="h-4 w-4 text-primary/60 hover:text-primary" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar rutina..."
                    className="pl-10"
                    value={bulkRoutineSearch}
                    onChange={e => setBulkRoutineSearch(e.target.value)}
                  />
                  {bulkRoutineSearch && (
                    <button
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      onClick={() => setBulkRoutineSearch("")}
                    >
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>
              )}
              {!bulkRoutineId && bulkRoutineSearch && (
                <div className="mt-1 border border-border rounded-lg bg-card max-h-40 overflow-y-auto">
                  {routines?.filter(r => r.name.toLowerCase().includes(bulkRoutineSearch.toLowerCase())).map(r => (
                    <button
                      key={r.id}
                      onClick={() => { setBulkRoutineId(r.id); setBulkRoutineName(r.name); setBulkRoutineSearch(""); setBulkDays([]); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-secondary transition-colors"
                    >
                      {r.name}
                    </button>
                  ))}
                  {!routines?.filter(r => r.name.toLowerCase().includes(bulkRoutineSearch.toLowerCase())).length && (
                    <p className="text-xs text-muted-foreground px-3 py-2">Sin resultados</p>
                  )}
                </div>
              )}
            </div>

            {/* Días de la semana */}
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
                const routine = routines?.find(r => r.id === bulkRoutineId);
                const totalDays = (routine as any)?.total_days ?? 1;
                if (!bulkRoutineId || totalDays <= 1 || !bulkDays.length) return null;
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
                              onClick={() => setBulkRoutineDayFn(dayOfWeek, d)}
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

            {/* Semanas */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1">¿Por cuántas semanas?</label>
              <Input type="number" min="1" max="52" value={bulkWeeks} onChange={e => setBulkWeeks(e.target.value)} />
            </div>

            <Button
              className="w-full"
              onClick={() => bulkAssignRoutine.mutate()}
              disabled={!bulkDays.length || bulkAssignRoutine.isPending}
            >
              Asignar a Todos
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
