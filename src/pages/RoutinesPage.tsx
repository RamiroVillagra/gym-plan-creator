import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ChevronDown, ChevronUp, Pencil, Folder, FolderOpen, FolderPlus, FolderInput } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import RoutineDetailView from "@/components/RoutineDetailView";

function useFolders(dbFolders: string[]) {
  const [localFolders, setLocalFolders] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("delta-folders") || "[]"); }
    catch { return []; }
  });

  const allFolders = [...new Set([...localFolders, ...dbFolders])].sort();

  const addLocalFolder = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || allFolders.includes(trimmed)) return false;
    const updated = [...localFolders, trimmed];
    setLocalFolders(updated);
    localStorage.setItem("delta-folders", JSON.stringify(updated));
    return true;
  };

  const removeLocalFolder = (name: string) => {
    const updated = localFolders.filter(f => f !== name);
    setLocalFolders(updated);
    localStorage.setItem("delta-folders", JSON.stringify(updated));
  };

  return { allFolders, addLocalFolder, removeLocalFolder };
}

export default function RoutinesPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [routineName, setRoutineName] = useState("");
  const [routineDesc, setRoutineDesc] = useState("");
  const [totalDays, setTotalDays] = useState("1");
  const [routineFolder, setRoutineFolder] = useState("");
  const [expandedRoutine, setExpandedRoutine] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState("");
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editDays, setEditDays] = useState("1");
  const [editFolder, setEditFolder] = useState("");

  const [activeFolder, setActiveFolder] = useState<string | null>(null);

  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const [moveOpen, setMoveOpen] = useState(false);
  const [moveRoutineId, setMoveRoutineId] = useState("");
  const [moveRoutineName, setMoveRoutineName] = useState("");
  const [moveTarget, setMoveTarget] = useState("");

  const { data: routines, isLoading } = useQuery({
    queryKey: ["routines"],
    queryFn: async () => {
      const { data, error } = await supabase.from("routines").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const dbFolders = [...new Set(routines?.map(r => (r as any).folder).filter(Boolean) ?? [])].sort() as string[];
  const { allFolders, addLocalFolder, removeLocalFolder } = useFolders(dbFolders);

  const createRoutine = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("routines").insert({
        name: routineName,
        description: routineDesc || null,
        total_days: parseInt(totalDays) || 1,
        folder: routineFolder.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routines"] });
      setRoutineName(""); setRoutineDesc(""); setTotalDays("1"); setRoutineFolder("");
      setOpen(false);
      toast.success("Rutina creada");
    },
  });

  const updateRoutine = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("routines").update({
        name: editName,
        description: editDesc || null,
        total_days: parseInt(editDays) || 1,
        folder: editFolder.trim() || null,
      }).eq("id", editId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routines"] });
      setEditOpen(false);
      toast.success("Rutina actualizada");
    },
  });

  const moveRoutine = useMutation({
    mutationFn: async ({ id, folder }: { id: string; folder: string | null }) => {
      const { error } = await supabase.from("routines").update({ folder }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routines"] });
      setMoveOpen(false);
      toast.success("Rutina movida");
    },
  });

  const deleteRoutine = useMutation({
    mutationFn: async (id: string) => {
      // Desvincular workouts asignados (mantenerlos pero sin referencia a esta rutina)
      await supabase.from("assigned_workouts").update({ routine_id: null }).eq("routine_id", id);
      // Borrar ejercicios de la rutina
      await supabase.from("routine_exercises").delete().eq("routine_id", id);
      // Borrar la rutina
      const { error } = await supabase.from("routines").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routines"] });
      toast.success("Rutina eliminada");
    },
    onError: (err: any) => toast.error(`Error al eliminar: ${err.message ?? "intenta de nuevo"}`),
  });

  const filteredRoutines = activeFolder
    ? routines?.filter(r => (r as any).folder === activeFolder) ?? []
    : routines ?? [];

  const renderRoutine = (routine: any) => {
    const isExpanded = expandedRoutine === routine.id;
    const rTotalDays = routine.total_days ?? 1;

    return (
      <div key={routine.id} className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setExpandedRoutine(isExpanded ? null : routine.id)}
            className="flex items-center gap-2 text-left flex-1"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            <div>
              <p className="font-medium text-foreground">{routine.name}</p>
              <p className="text-xs text-muted-foreground">
                {routine.description ? `${routine.description} · ` : ""}{rTotalDays} día{rTotalDays > 1 ? "s" : ""}
                {routine.folder && <span className="ml-1 text-primary">📁 {routine.folder}</span>}
              </p>
            </div>
          </button>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              title="Mover a carpeta"
              onClick={() => {
                setMoveRoutineId(routine.id);
                setMoveRoutineName(routine.name);
                setMoveTarget(routine.folder ?? "");
                setMoveOpen(true);
              }}
            >
              <FolderInput className="h-4 w-4 text-muted-foreground" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => {
              setEditId(routine.id);
              setEditName(routine.name);
              setEditDesc(routine.description ?? "");
              setEditDays(String(rTotalDays));
              setEditFolder(routine.folder ?? "");
              setEditOpen(true);
            }}>
              <Pencil className="h-4 w-4 text-muted-foreground" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => deleteRoutine.mutate(routine.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>

        {isExpanded && (
          <div className="border-t border-border px-4 py-3">
            <RoutineDetailView
              routineId={routine.id}
              routineName={routine.name}
              totalDays={rTotalDays}
              editable
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-heading font-bold">Rutinas</h1>
          <p className="text-muted-foreground">Crea plantillas de rutinas con bloques y días</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setNewFolderOpen(true)}>
            <FolderPlus className="h-4 w-4 mr-2" />Nueva Carpeta
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Nueva Rutina</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Crear Rutina</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-4">
                <Input placeholder="Nombre de la rutina" value={routineName} onChange={e => setRoutineName(e.target.value)} />
                <Input placeholder="Descripción (opcional)" value={routineDesc} onChange={e => setRoutineDesc(e.target.value)} />
                <div>
                  <label className="text-xs text-muted-foreground">Carpeta (opcional)</label>
                  <select
                    className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground mt-1"
                    value={routineFolder}
                    onChange={e => setRoutineFolder(e.target.value)}
                  >
                    <option value="">Sin carpeta</option>
                    {allFolders.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Cantidad de días de entrenamiento</label>
                  <Input type="number" min="1" max="7" value={totalDays} onChange={e => setTotalDays(e.target.value)} />
                </div>
                <Button className="w-full" onClick={() => createRoutine.mutate()} disabled={!routineName.trim()}>Guardar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Folder tabs */}
      {allFolders.length > 0 && (
        <div className="flex gap-1 mb-4 flex-wrap">
          <button
            onClick={() => setActiveFolder(null)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              !activeFolder ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            Todas
          </button>
          {allFolders.map(f => {
            const hasRoutines = routines?.some(r => (r as any).folder === f);
            return (
              <button
                key={f}
                onClick={() => setActiveFolder(activeFolder === f ? null : f)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeFolder === f ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {activeFolder === f ? <FolderOpen className="h-3 w-3" /> : <Folder className="h-3 w-3" />}
                {f}
                {!hasRoutines && <span className="opacity-50 ml-0.5">(vacía)</span>}
              </button>
            );
          })}
        </div>
      )}

      {isLoading ? (
        <p className="text-muted-foreground">Cargando...</p>
      ) : !filteredRoutines?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No hay rutinas{activeFolder ? ` en "${activeFolder}"` : " creadas"}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRoutines.map(renderRoutine)}
        </div>
      )}

      {/* Dialog: nueva carpeta */}
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva Carpeta</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <Input
              placeholder="Nombre de la carpeta"
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  if (addLocalFolder(newFolderName)) {
                    toast.success(`Carpeta "${newFolderName.trim()}" creada`);
                    setNewFolderName("");
                    setNewFolderOpen(false);
                  } else {
                    toast.error("Esa carpeta ya existe");
                  }
                }
              }}
            />
            {allFolders.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Carpetas existentes:</p>
                <div className="flex flex-wrap gap-2">
                  {allFolders.map(f => {
                    const isLocal = !dbFolders.includes(f);
                    return (
                      <span key={f} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-secondary text-foreground">
                        <Folder className="h-3 w-3" />
                        {f}
                        {isLocal && (
                          <button
                            onClick={() => { removeLocalFolder(f); toast.success(`Carpeta "${f}" eliminada`); }}
                            className="ml-0.5 text-muted-foreground hover:text-destructive"
                            title="Eliminar carpeta vacía"
                          >
                            ×
                          </button>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
            <Button
              className="w-full"
              disabled={!newFolderName.trim()}
              onClick={() => {
                if (addLocalFolder(newFolderName)) {
                  toast.success(`Carpeta "${newFolderName.trim()}" creada`);
                  setNewFolderName("");
                  setNewFolderOpen(false);
                } else {
                  toast.error("Esa carpeta ya existe");
                }
              }}
            >
              Crear Carpeta
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: mover rutina */}
      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mover Rutina</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              ¿A qué carpeta querés mover <span className="text-foreground font-medium">{moveRoutineName}</span>?
            </p>
            <div className="space-y-2">
              <button
                onClick={() => moveRoutine.mutate({ id: moveRoutineId, folder: null })}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm border transition-colors ${
                  !moveTarget ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-secondary"
                }`}
              >
                Sin carpeta
              </button>
              {allFolders.map(f => (
                <button
                  key={f}
                  onClick={() => moveRoutine.mutate({ id: moveRoutineId, folder: f })}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm border transition-colors flex items-center gap-2 ${
                    moveTarget === f ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-secondary"
                  }`}
                >
                  <Folder className="h-4 w-4" />
                  {f}
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit routine dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Rutina</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <Input placeholder="Nombre" value={editName} onChange={e => setEditName(e.target.value)} />
            <Input placeholder="Descripción" value={editDesc} onChange={e => setEditDesc(e.target.value)} />
            <div>
              <label className="text-xs text-muted-foreground">Carpeta</label>
              <select
                className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground mt-1"
                value={editFolder}
                onChange={e => setEditFolder(e.target.value)}
              >
                <option value="">Sin carpeta</option>
                {allFolders.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Días de entrenamiento</label>
              <Input type="number" min="1" max="7" value={editDays} onChange={e => setEditDays(e.target.value)} />
            </div>
            <Button className="w-full" onClick={() => updateRoutine.mutate()} disabled={!editName.trim()}>Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
