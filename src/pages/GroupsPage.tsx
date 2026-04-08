import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ChevronDown, ChevronUp, Users, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
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
  
  // Bulk assign state
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkGroupId, setBulkGroupId] = useState<string | null>(null);
  const [bulkRoutineId, setBulkRoutineId] = useState("");
  const [bulkDate, setBulkDate] = useState(format(new Date(), "yyyy-MM-dd"));

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
    mutationFn: async () => {
      const { error } = await supabase.from("group_members").insert({
        group_id: addMemberGroupId!, client_id: selectedClientId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-members"] });
      setSelectedClientId(""); setAddMemberOpen(false);
      toast.success("Alumno agregado al grupo");
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

      const inserts = members.map(m => ({
        client_id: m.client_id,
        routine_id: bulkRoutineId || null,
        workout_date: bulkDate,
      }));

      const { error } = await supabase.from("assigned_workouts").insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assigned-workouts"] });
      queryClient.invalidateQueries({ queryKey: ["workouts-count"] });
      setBulkAssignOpen(false); setBulkRoutineId("");
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
      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Agregar Alumno al Grupo</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <select
              className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground"
              value={selectedClientId}
              onChange={e => setSelectedClientId(e.target.value)}
            >
              <option value="">Seleccionar alumno</option>
              {availableClients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Button className="w-full" onClick={() => addMember.mutate()} disabled={!selectedClientId}>Agregar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk assign routine dialog */}
      <Dialog open={bulkAssignOpen} onOpenChange={setBulkAssignOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Asignar Rutina al Grupo</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <select
              className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground"
              value={bulkRoutineId}
              onChange={e => setBulkRoutineId(e.target.value)}
            >
              <option value="">Seleccionar rutina</option>
              {routines?.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <div>
              <label className="text-xs text-muted-foreground">Fecha</label>
              <Input type="date" value={bulkDate} onChange={e => setBulkDate(e.target.value)} />
            </div>
            <Button className="w-full" onClick={() => bulkAssignRoutine.mutate()} disabled={!bulkRoutineId}>
              Asignar a Todos
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
