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

export default function ClientsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("clients").insert({
        name, email: email || null, phone: phone || null, notes: notes || null
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
      toast.success("Cliente eliminado");
    },
  });

  const filtered = clients?.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

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
              <Button className="w-full" onClick={() => addMutation.mutate()} disabled={!name.trim()}>
                Guardar
              </Button>
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
            <div key={client.id} className="flex items-center justify-between bg-card border border-border rounded-lg px-4 py-3 hover:border-primary/30 transition-colors">
              <div>
                <p className="font-medium text-foreground">{client.name}</p>
                <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                  {client.email && <span>{client.email}</span>}
                  {client.phone && <span>{client.phone}</span>}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(client.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
