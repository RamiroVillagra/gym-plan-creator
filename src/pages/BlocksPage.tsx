import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Pencil, X, Search, Layers } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface BlockExercise {
  exercise_id: string;
  exercise_name: string;
  sets: string;
  reps: string;
  weight: string;
  unit: string;
}

export default function BlocksPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [blockName, setBlockName] = useState("");
  const [blockDesc, setBlockDesc] = useState("");
  const [blockExs, setBlockExs] = useState<BlockExercise[]>([]);
  const [exSearch, setExSearch] = useState("");

  const { data: blocks, isLoading } = useQuery({
    queryKey: ["workout-blocks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workout_blocks")
        .select("*, workout_block_exercises(*, exercises(name, muscle_group))")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: exercises } = useQuery({
    queryKey: ["exercises"],
    queryFn: async () => {
      const { data, error } = await supabase.from("exercises").select("id, name, muscle_group").order("name");
      if (error) throw error;
      return data;
    },
  });

  const filteredEx = exercises?.filter(e =>
    e.name.toLowerCase().includes(exSearch.toLowerCase())
  ) ?? [];

  const openCreate = () => {
    setEditingId(null);
    setBlockName("");
    setBlockDesc("");
    setBlockExs([]);
    setExSearch("");
    setDialogOpen(true);
  };

  const openEdit = (block: any) => {
    setEditingId(block.id);
    setBlockName(block.name);
    setBlockDesc(block.description ?? "");
    setBlockExs(
      [...(block.workout_block_exercises ?? [])]
        .sort((a: any, b: any) => a.order_index - b.order_index)
        .map((be: any) => ({
          exercise_id: be.exercise_id,
          exercise_name: be.exercises?.name ?? "",
          sets: String(be.sets ?? ""),
          reps: String(be.reps ?? ""),
          weight: be.weight != null ? String(be.weight) : "",
          unit: be.unit ?? "kg",
        }))
    );
    setExSearch("");
    setDialogOpen(true);
  };

  const saveBlock = useMutation({
    mutationFn: async () => {
      if (!blockName.trim()) throw new Error("El nombre es obligatorio");

      if (editingId) {
        const { error: ue } = await supabase.from("workout_blocks")
          .update({ name: blockName.trim(), description: blockDesc.trim() || null })
          .eq("id", editingId);
        if (ue) throw ue;
        await supabase.from("workout_block_exercises").delete().eq("workout_block_id", editingId);
        if (blockExs.length) {
          const rows = blockExs.map((e, i) => ({
            workout_block_id: editingId,
            exercise_id: e.exercise_id,
            sets: parseInt(e.sets) || null,
            reps: parseInt(e.reps) || null,
            weight: parseFloat(e.weight) || null,
            unit: e.unit,
            order_index: i,
          }));
          const { error: ie } = await supabase.from("workout_block_exercises").insert(rows);
          if (ie) throw ie;
        }
      } else {
        const { data: block, error: ce } = await supabase.from("workout_blocks")
          .insert({ name: blockName.trim(), description: blockDesc.trim() || null })
          .select().single();
        if (ce) throw ce;
        if (blockExs.length) {
          const rows = blockExs.map((e, i) => ({
            workout_block_id: block.id,
            exercise_id: e.exercise_id,
            sets: parseInt(e.sets) || null,
            reps: parseInt(e.reps) || null,
            weight: parseFloat(e.weight) || null,
            unit: e.unit,
            order_index: i,
          }));
          const { error: ie } = await supabase.from("workout_block_exercises").insert(rows);
          if (ie) throw ie;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workout-blocks"] });
      setDialogOpen(false);
      toast.success(editingId ? "Bloque actualizado" : "Bloque creado");
    },
    onError: (e: any) => toast.error(e.message ?? "Error al guardar"),
  });

  const deleteBlock = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workout_blocks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workout-blocks"] });
      toast.success("Bloque eliminado");
    },
    onError: () => toast.error("Error al eliminar"),
  });

  const addExercise = (ex: { id: string; name: string }) => {
    if (blockExs.some(e => e.exercise_id === ex.id)) return;
    setBlockExs(prev => [...prev, {
      exercise_id: ex.id,
      exercise_name: ex.name,
      sets: "3",
      reps: "10",
      weight: "",
      unit: "kg",
    }]);
    setExSearch("");
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-heading font-bold">Bloques</h1>
          <p className="text-muted-foreground">Bloques de ejercicios reutilizables</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />Nuevo Bloque
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Cargando...</p>
      ) : !blocks?.length ? (
        <div className="text-center py-16">
          <Layers className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="text-muted-foreground font-medium">No hay bloques creados aún.</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">Creá bloques de ejercicios para reutilizarlos en rutinas y sesiones.</p>
          <Button variant="outline" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />Crear primer bloque
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {blocks.map((block: any) => {
            const exs = [...(block.workout_block_exercises ?? [])].sort((a: any, b: any) => a.order_index - b.order_index);
            return (
              <div key={block.id} className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3 hover:border-primary/30 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Layers className="h-4 w-4 text-primary" />
                      </div>
                      <h3 className="font-heading font-bold text-foreground truncate">{block.name}</h3>
                    </div>
                    {block.description && (
                      <p className="text-xs text-muted-foreground mt-1 ml-9">{block.description}</p>
                    )}
                  </div>
                  <div className="flex gap-0.5 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(block)}>
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteBlock.mutate(block.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>

                {exs.length > 0 ? (
                  <div className="space-y-1 bg-secondary/30 rounded-lg p-2">
                    {exs.map((be: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-xs py-0.5">
                        <span className="text-foreground font-medium truncate flex-1">{be.exercises?.name}</span>
                        <span className="text-muted-foreground ml-2 shrink-0">
                          {be.sets && be.reps
                            ? `${be.sets}×${be.reps}${be.weight ? ` @ ${be.weight}${be.unit ?? "kg"}` : ""}`
                            : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Sin ejercicios.</p>
                )}

                <div className="pt-1 border-t border-border/50">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    {exs.length} ejercicio{exs.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog crear/editar */}
      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) setDialogOpen(false); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Bloque" : "Nuevo Bloque"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <Input
              placeholder="Nombre del bloque *"
              value={blockName}
              onChange={e => setBlockName(e.target.value)}
              autoFocus
            />
            <Input
              placeholder="Descripción (opcional)"
              value={blockDesc}
              onChange={e => setBlockDesc(e.target.value)}
            />

            {/* Lista de ejercicios */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Ejercicios del bloque
              </p>

              {blockExs.length > 0 && (
                <div className="space-y-2 mb-3">
                  {blockExs.map((ex, i) => (
                    <div key={i} className="bg-secondary/40 rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-foreground">{ex.exercise_name}</span>
                        <button onClick={() => setBlockExs(prev => prev.filter((_, j) => j !== i))}>
                          <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive transition-colors" />
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Input
                          type="number"
                          className="w-14 h-7 text-xs"
                          placeholder="S"
                          value={ex.sets}
                          onChange={e => setBlockExs(prev => prev.map((x, j) => j === i ? { ...x, sets: e.target.value } : x))}
                        />
                        <span className="text-xs text-muted-foreground">×</span>
                        <Input
                          type="number"
                          className="w-14 h-7 text-xs"
                          placeholder="R"
                          value={ex.reps}
                          onChange={e => setBlockExs(prev => prev.map((x, j) => j === i ? { ...x, reps: e.target.value } : x))}
                        />
                        <span className="text-xs text-muted-foreground">@</span>
                        <Input
                          type="number"
                          className="w-16 h-7 text-xs"
                          placeholder="0"
                          value={ex.weight}
                          onChange={e => setBlockExs(prev => prev.map((x, j) => j === i ? { ...x, weight: e.target.value } : x))}
                        />
                        <div className="flex rounded-md border border-input overflow-hidden h-7">
                          {["kg", "seg", "m"].map(u => (
                            <button
                              key={u}
                              type="button"
                              onClick={() => setBlockExs(prev => prev.map((x, j) => j === i ? { ...x, unit: u } : x))}
                              className={`px-2 text-xs font-medium transition-colors ${
                                ex.unit === u
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-background text-muted-foreground hover:bg-secondary"
                              }`}
                            >
                              {u}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Buscador de ejercicios */}
              <div className="border border-border rounded-lg overflow-hidden">
                <div className="flex items-center px-3 py-2 border-b border-border bg-secondary/20">
                  <Search className="h-3.5 w-3.5 text-muted-foreground mr-2 shrink-0" />
                  <Input
                    className="h-7 text-xs border-0 p-0 focus-visible:ring-0 bg-transparent"
                    placeholder="Buscar ejercicio para agregar..."
                    value={exSearch}
                    onChange={e => setExSearch(e.target.value)}
                  />
                </div>
                {exSearch && (
                  <div className="max-h-40 overflow-y-auto">
                    {filteredEx.length === 0 ? (
                      <p className="text-xs text-muted-foreground px-3 py-3 text-center">Sin resultados</p>
                    ) : (
                      filteredEx.map(ex => {
                        const already = blockExs.some(e => e.exercise_id === ex.id);
                        return (
                          <button
                            key={ex.id}
                            type="button"
                            disabled={already}
                            onClick={() => addExercise(ex)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-secondary transition-colors flex items-center justify-between disabled:opacity-40 disabled:cursor-default"
                          >
                            <span>{ex.name}</span>
                            {already && <span className="text-xs text-primary font-medium">Ya agregado</span>}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
                {!exSearch && !blockExs.length && (
                  <p className="text-xs text-muted-foreground px-3 py-3 text-center">Escribí para buscar ejercicios</p>
                )}
              </div>
            </div>

            <Button
              className="w-full"
              onClick={() => saveBlock.mutate()}
              disabled={!blockName.trim() || saveBlock.isPending}
            >
              {saveBlock.isPending ? "Guardando..." : editingId ? "Guardar cambios" : "Crear bloque"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
