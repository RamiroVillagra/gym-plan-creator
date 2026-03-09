import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";

const MUSCLE_GROUPS = ["Pecho", "Espalda", "Piernas", "Hombros", "Bíceps", "Tríceps", "Core", "Glúteos", "Cardio", "Otro"];

export default function ExercisesPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [muscleGroup, setMuscleGroup] = useState("");
  const [description, setDescription] = useState("");

  const { data: exercises, isLoading } = useQuery({
    queryKey: ["exercises"],
    queryFn: async () => {
      const { data, error } = await supabase.from("exercises").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("exercises").insert({ name, muscle_group: muscleGroup || null, description: description || null });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exercises"] });
      queryClient.invalidateQueries({ queryKey: ["exercises-count"] });
      setName(""); setMuscleGroup(""); setDescription("");
      setOpen(false);
      toast.success("Ejercicio agregado");
    },
    onError: () => toast.error("Error al agregar ejercicio"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("exercises").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exercises"] });
      queryClient.invalidateQueries({ queryKey: ["exercises-count"] });
      toast.success("Ejercicio eliminado");
    },
  });

  const filtered = exercises?.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    (e.muscle_group?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-heading font-bold">Ejercicios</h1>
          <p className="text-muted-foreground">Biblioteca de ejercicios disponibles</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Agregar</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo Ejercicio</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <Input placeholder="Nombre del ejercicio" value={name} onChange={e => setName(e.target.value)} />
              <select
                className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground"
                value={muscleGroup}
                onChange={e => setMuscleGroup(e.target.value)}
              >
                <option value="">Grupo muscular (opcional)</option>
                {MUSCLE_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <Input placeholder="Descripción (opcional)" value={description} onChange={e => setDescription(e.target.value)} />
              <Button className="w-full" onClick={() => addMutation.mutate()} disabled={!name.trim()}>
                Guardar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar ejercicios..."
          className="pl-10"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Cargando...</p>
      ) : !filtered?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No hay ejercicios{search ? " que coincidan" : ""}.</p>
          <p className="text-sm mt-1">Agrega uno para comenzar.</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {filtered.map(ex => (
            <div key={ex.id} className="flex items-center justify-between bg-card border border-border rounded-lg px-4 py-3 hover:border-primary/30 transition-colors">
              <div>
                <p className="font-medium text-foreground">{ex.name}</p>
                <div className="flex gap-2 mt-1">
                  {ex.muscle_group && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{ex.muscle_group}</span>
                  )}
                  {ex.description && <span className="text-xs text-muted-foreground">{ex.description}</span>}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(ex.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
