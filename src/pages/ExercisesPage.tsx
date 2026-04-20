import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Search, Pencil, Tag, X, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";

export default function ExercisesPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");

  // Edit exercise
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState("");
  const [editName, setEditName] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editDescription, setEditDescription] = useState("");

  // Category management
  const [catOpen, setCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState("");

  // Collapsed categories
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [usageInfo, setUsageInfo] = useState<{ routines: number; sessions: number; blocks: number; logs: number } | null>(null);
  const [checkingUsage, setCheckingUsage] = useState(false);

  const { data: categories } = useQuery({
    queryKey: ["exercise-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("exercise_categories").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: exercises, isLoading } = useQuery({
    queryKey: ["exercises"],
    queryFn: async () => {
      const { data, error } = await supabase.from("exercises").select("*, exercise_categories(name)").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Category mutations
  const addCategory = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("exercise_categories").insert({ name: newCatName });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exercise-categories"] });
      setNewCatName("");
      toast.success("Categoría creada");
    },
  });

  const updateCategory = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("exercise_categories").update({ name: editingCatName }).eq("id", editingCatId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exercise-categories"] });
      queryClient.invalidateQueries({ queryKey: ["exercises"] });
      setEditingCatId(null);
      toast.success("Categoría actualizada");
    },
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("exercise_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exercise-categories"] });
      queryClient.invalidateQueries({ queryKey: ["exercises"] });
      toast.success("Categoría eliminada");
    },
  });

  // Exercise mutations
  const addExercise = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("exercises").insert({
        name,
        category_id: categoryId || null,
        muscle_group: categoryId ? categories?.find(c => c.id === categoryId)?.name ?? null : null,
        description: description || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exercises"] });
      setName(""); setCategoryId(""); setDescription("");
      setOpen(false);
      toast.success("Ejercicio agregado");
    },
    onError: () => toast.error("Error al agregar ejercicio"),
  });

  const updateExercise = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("exercises").update({
        name: editName,
        category_id: editCategoryId || null,
        muscle_group: editCategoryId ? categories?.find(c => c.id === editCategoryId)?.name ?? null : null,
        description: editDescription || null,
      }).eq("id", editId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exercises"] });
      setEditOpen(false);
      toast.success("Ejercicio actualizado");
    },
  });

  const [replaceSearch, setReplaceSearch] = useState("");
  const [replaceTargetId, setReplaceTargetId] = useState("");
  const [replaceTargetName, setReplaceTargetName] = useState("");

  const deleteExercise = useMutation({
    mutationFn: async ({ deleteId, replaceWithId }: { deleteId: string; replaceWithId: string | null }) => {
      if (replaceWithId) {
        // Reemplazar en todas las tablas antes de borrar
        await supabase.from("routine_exercises").update({ exercise_id: replaceWithId }).eq("exercise_id", deleteId);
        await supabase.from("assigned_workout_exercises").update({ exercise_id: replaceWithId }).eq("exercise_id", deleteId);
        await supabase.from("workout_block_exercises").update({ exercise_id: replaceWithId }).eq("exercise_id", deleteId);
        await supabase.from("workout_logs").update({ exercise_id: replaceWithId }).eq("exercise_id", deleteId);
      } else {
        await supabase.from("routine_exercises").delete().eq("exercise_id", deleteId);
        await supabase.from("assigned_workout_exercises").delete().eq("exercise_id", deleteId);
        await supabase.from("workout_block_exercises").delete().eq("exercise_id", deleteId);
        await supabase.from("workout_logs").delete().eq("exercise_id", deleteId);
      }
      const { error } = await supabase.from("exercises").delete().eq("id", deleteId);
      if (error) throw error;
    },
    onSuccess: (_d, { replaceWithId }) => {
      queryClient.invalidateQueries({ queryKey: ["exercises"] });
      queryClient.invalidateQueries({ queryKey: ["routine-exercises"] });
      queryClient.invalidateQueries({ queryKey: ["assigned-workout-exercises"] });
      queryClient.invalidateQueries({ queryKey: ["workout-blocks"] });
      setDeleteConfirm(null);
      setUsageInfo(null);
      setReplaceSearch(""); setReplaceTargetId(""); setReplaceTargetName("");
      toast.success(replaceWithId ? "Ejercicio reemplazado y eliminado" : "Ejercicio eliminado");
    },
    onError: () => toast.error("Error al eliminar"),
  });

  const handleDeleteClick = async (ex: { id: string; name: string }) => {
    setDeleteConfirm(ex);
    setUsageInfo(null);
    setReplaceSearch(""); setReplaceTargetId(""); setReplaceTargetName("");
    setCheckingUsage(true);
    try {
      const [re, awe, wbe, wl] = await Promise.all([
        supabase.from("routine_exercises").select("id", { count: "exact", head: true }).eq("exercise_id", ex.id),
        supabase.from("assigned_workout_exercises").select("id", { count: "exact", head: true }).eq("exercise_id", ex.id),
        supabase.from("workout_block_exercises").select("id", { count: "exact", head: true }).eq("exercise_id", ex.id),
        supabase.from("workout_logs").select("id", { count: "exact", head: true }).eq("exercise_id", ex.id),
      ]);
      setUsageInfo({
        routines: re.count ?? 0,
        sessions: awe.count ?? 0,
        blocks: wbe.count ?? 0,
        logs: wl.count ?? 0,
      });
    } finally {
      setCheckingUsage(false);
    }
  };

  const totalUsage = usageInfo ? usageInfo.routines + usageInfo.sessions + usageInfo.blocks + usageInfo.logs : 0;
  const replaceOptions = exercises?.filter(e =>
    e.id !== deleteConfirm?.id &&
    e.name.toLowerCase().includes(replaceSearch.toLowerCase())
  ) ?? [];

  const filtered = exercises?.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    ((e as any).exercise_categories?.name?.toLowerCase().includes(search.toLowerCase())) ||
    (e.muscle_group?.toLowerCase().includes(search.toLowerCase()))
  );

  // Group by category
  const grouped: { catId: string | null; catName: string; items: typeof filtered }[] = [];
  const catMap = new Map<string | null, (typeof filtered)>();
  
  filtered?.forEach(ex => {
    const cid = (ex as any).category_id ?? null;
    if (!catMap.has(cid)) catMap.set(cid, []);
    catMap.get(cid)!.push(ex);
  });

  // Sort: named categories first, then uncategorized
  categories?.forEach(cat => {
    if (catMap.has(cat.id)) {
      grouped.push({ catId: cat.id, catName: cat.name, items: catMap.get(cat.id) });
      catMap.delete(cat.id);
    }
  });
  if (catMap.has(null)) {
    grouped.push({ catId: null, catName: "Sin categoría", items: catMap.get(null) });
    catMap.delete(null);
  }
  // Any remaining (orphan category_ids)
  catMap.forEach((items, cid) => {
    grouped.push({ catId: cid, catName: "Otra", items });
  });

  const toggleCat = (catId: string) => {
    setCollapsedCats(prev => {
      const next = new Set(prev);
      next.has(catId) ? next.delete(catId) : next.add(catId);
      return next;
    });
  };

  const renderExercise = (ex: any) => (
    <div key={ex.id} className="flex items-center justify-between bg-card border border-border rounded-lg px-4 py-3 hover:border-primary/30 transition-colors">
      <div>
        <p className="font-medium text-foreground">{ex.name}</p>
        <div className="flex gap-2 mt-1">
          {ex.description && <span className="text-xs text-muted-foreground">{ex.description}</span>}
        </div>
      </div>
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" onClick={() => {
          setEditId(ex.id);
          setEditName(ex.name);
          setEditCategoryId((ex as any).category_id ?? "");
          setEditDescription(ex.description ?? "");
          setEditOpen(true);
        }}>
          <Pencil className="h-4 w-4 text-muted-foreground" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => handleDeleteClick({ id: ex.id, name: ex.name })}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-heading font-bold">Ejercicios</h1>
          <p className="text-muted-foreground">Biblioteca de ejercicios disponibles</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCatOpen(true)}>
            <Tag className="h-4 w-4 mr-2" />Categorías
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Agregar</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nuevo Ejercicio</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-4">
                <Input placeholder="Nombre del ejercicio" value={name} onChange={e => setName(e.target.value)} />
                <select
                  className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
                  value={categoryId}
                  onChange={e => setCategoryId(e.target.value)}
                >
                  <option value="">Categoría (opcional)</option>
                  {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <Input placeholder="Descripción (opcional)" value={description} onChange={e => setDescription(e.target.value)} />
                <Button className="w-full" onClick={() => addExercise.mutate()} disabled={!name.trim()}>Guardar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar ejercicios..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Cargando...</p>
      ) : !filtered?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No hay ejercicios{search ? " que coincidan" : ""}.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(group => {
            const key = group.catId ?? "__none";
            const isCollapsed = collapsedCats.has(key);
            return (
              <div key={key}>
                <button
                  onClick={() => toggleCat(key)}
                  className="flex items-center gap-2 mb-2 text-sm font-bold text-primary uppercase tracking-wider"
                >
                  {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  {group.catName}
                  <span className="text-xs font-normal text-muted-foreground">({group.items?.length ?? 0})</span>
                </button>
                {!isCollapsed && (
                  <div className="grid gap-2 ml-2">
                    {group.items?.map(renderExercise)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit exercise dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Ejercicio</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <Input placeholder="Nombre" value={editName} onChange={e => setEditName(e.target.value)} />
            <select
              className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
              value={editCategoryId}
              onChange={e => setEditCategoryId(e.target.value)}
            >
              <option value="">Sin categoría</option>
              {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Input placeholder="Descripción" value={editDescription} onChange={e => setEditDescription(e.target.value)} />
            <Button className="w-full" onClick={() => updateExercise.mutate()} disabled={!editName.trim()}>Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete / merge dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={v => { if (!v) { setDeleteConfirm(null); setUsageInfo(null); setReplaceSearch(""); setReplaceTargetId(""); setReplaceTargetName(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Eliminar: {deleteConfirm?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-4">

            {checkingUsage ? (
              <p className="text-xs text-muted-foreground">Verificando uso...</p>
            ) : usageInfo && totalUsage > 0 ? (
              <>
                {/* Resumen de uso */}
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Está en uso en {totalUsage} lugar{totalUsage !== 1 ? "es" : ""}
                  </p>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {usageInfo.routines > 0 && <p>• {usageInfo.routines} rutina{usageInfo.routines !== 1 ? "s" : ""}</p>}
                    {usageInfo.sessions > 0 && <p>• {usageInfo.sessions} sesión{usageInfo.sessions !== 1 ? "es" : ""} asignada{usageInfo.sessions !== 1 ? "s" : ""}</p>}
                    {usageInfo.blocks > 0 && <p>• {usageInfo.blocks} bloque{usageInfo.blocks !== 1 ? "s" : ""} de biblioteca</p>}
                    {usageInfo.logs > 0 && <p>• {usageInfo.logs} registro{usageInfo.logs !== 1 ? "s" : ""} de sesiones</p>}
                  </div>
                </div>

                {/* Opción: reemplazar por otro ejercicio */}
                <div>
                  <p className="text-xs font-semibold text-foreground mb-1.5">Reemplazar con otro ejercicio (recomendado)</p>
                  {replaceTargetId ? (
                    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-primary/10 border border-primary/30">
                      <span className="text-sm font-medium text-primary">{replaceTargetName}</span>
                      <button onClick={() => { setReplaceTargetId(""); setReplaceTargetName(""); }}>
                        <X className="h-4 w-4 text-primary/60 hover:text-primary" />
                      </button>
                    </div>
                  ) : (
                    <div className="border border-border rounded-lg overflow-hidden">
                      <div className="flex items-center px-3 py-2 border-b border-border">
                        <Search className="h-3.5 w-3.5 text-muted-foreground mr-2 shrink-0" />
                        <Input
                          className="h-7 text-xs border-0 p-0 focus-visible:ring-0 bg-transparent"
                          placeholder="Buscar el ejercicio correcto..."
                          value={replaceSearch}
                          onChange={e => setReplaceSearch(e.target.value)}
                          autoFocus
                        />
                      </div>
                      {replaceSearch && (
                        <div className="max-h-36 overflow-y-auto">
                          {replaceOptions.length === 0 ? (
                            <p className="text-xs text-muted-foreground px-3 py-2 text-center">Sin resultados</p>
                          ) : (
                            replaceOptions.map(e => (
                              <button
                                key={e.id}
                                onClick={() => { setReplaceTargetId(e.id); setReplaceTargetName(e.name); setReplaceSearch(""); }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-secondary transition-colors"
                              >
                                {e.name}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Todos los usos del ejercicio duplicado se actualizarán al seleccionado.
                  </p>
                </div>
              </>
            ) : usageInfo ? (
              <p className="text-xs text-muted-foreground bg-secondary/40 rounded-lg px-3 py-2">
                Este ejercicio no está en ninguna rutina ni sesión — se puede eliminar sin problema.
              </p>
            ) : null}

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1"
                onClick={() => { setDeleteConfirm(null); setUsageInfo(null); setReplaceSearch(""); setReplaceTargetId(""); setReplaceTargetName(""); }}>
                Cancelar
              </Button>
              {usageInfo && totalUsage > 0 ? (
                <Button
                  variant={replaceTargetId ? "default" : "destructive"}
                  className="flex-1"
                  disabled={checkingUsage || deleteExercise.isPending}
                  onClick={() => deleteConfirm && deleteExercise.mutate({ deleteId: deleteConfirm.id, replaceWithId: replaceTargetId || null })}
                >
                  {deleteExercise.isPending
                    ? "Procesando..."
                    : replaceTargetId
                      ? "Reemplazar y eliminar"
                      : "Eliminar igual (borrará de todo)"}
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={checkingUsage || deleteExercise.isPending}
                  onClick={() => deleteConfirm && deleteExercise.mutate({ deleteId: deleteConfirm.id, replaceWithId: null })}
                >
                  {deleteExercise.isPending ? "Eliminando..." : "Eliminar"}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category management dialog */}
      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Gestionar Categorías</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="flex gap-2">
              <Input placeholder="Nueva categoría" value={newCatName} onChange={e => setNewCatName(e.target.value)} />
              <Button onClick={() => addCategory.mutate()} disabled={!newCatName.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2 max-h-60 overflow-auto">
              {categories?.map(cat => (
                <div key={cat.id} className="flex items-center justify-between bg-secondary/50 rounded-lg px-3 py-2">
                  {editingCatId === cat.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        className="h-8"
                        value={editingCatName}
                        onChange={e => setEditingCatName(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && updateCategory.mutate()}
                      />
                      <Button size="sm" onClick={() => updateCategory.mutate()}>Ok</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingCatId(null)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="text-sm text-foreground">{cat.name}</span>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                          setEditingCatId(cat.id);
                          setEditingCatName(cat.name);
                        }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteCategory.mutate(cat.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
              {!categories?.length && <p className="text-sm text-muted-foreground text-center py-2">No hay categorías</p>}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
