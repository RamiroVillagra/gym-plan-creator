import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Search, Pencil, Tag, X, ChevronDown, ChevronRight } from "lucide-react";
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

  const deleteExercise = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("exercises").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exercises"] });
      toast.success("Ejercicio eliminado");
    },
  });

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
        <Button variant="ghost" size="icon" onClick={() => deleteExercise.mutate(ex.id)}>
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
