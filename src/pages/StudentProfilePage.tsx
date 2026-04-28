import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { User, Save, Sun, Moon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function StudentProfilePage() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    name: "",
    phone: "",
    weight: "",
    height: "",
    birth_date: "",
    goal: "",
  });
  const [loaded, setLoaded] = useState(false);

  const { data: client, isLoading } = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, phone, weight, height, birth_date, goal")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      if (data && !loaded) {
        setForm({
          name: data.name ?? "",
          phone: data.phone ?? "",
          weight: data.weight != null ? String(data.weight) : "",
          height: data.height != null ? String(data.height) : "",
          birth_date: data.birth_date ?? "",
          goal: data.goal ?? "",
        });
        setLoaded(true);
      }
    },
  } as any);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!client?.id) throw new Error("No client found");
      const { error } = await supabase
        .from("clients")
        .update({
          name: form.name || null,
          phone: form.phone || null,
          weight: form.weight ? parseFloat(form.weight) : null,
          height: form.height ? parseFloat(form.height) : null,
          birth_date: form.birth_date || null,
          goal: form.goal || null,
        })
        .eq("id", client.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success("Perfil actualizado");
    },
    onError: () => toast.error("Error al guardar"),
  });

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="animate-fade-in max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <User className="h-6 w-6 text-primary" />
        <h1 className="font-heading text-2xl font-bold">Mi Perfil</h1>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">Cargando...</div>
      ) : !client ? (
        <div className="text-center py-16 text-muted-foreground">No se encontró tu perfil.</div>
      ) : (
        <div className="space-y-6">
          {/* Datos personales */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h2 className="font-heading font-semibold text-foreground">Datos personales</h2>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Nombre</label>
              <Input value={form.name} onChange={set("name")} placeholder="Tu nombre" />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Teléfono</label>
              <Input value={form.phone} onChange={set("phone")} placeholder="+54 9 11 1234-5678" type="tel" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Peso (kg)</label>
                <Input value={form.weight} onChange={set("weight")} placeholder="70" type="number" min="0" step="0.1" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Altura (cm)</label>
                <Input value={form.height} onChange={set("height")} placeholder="170" type="number" min="0" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Fecha de nacimiento</label>
              <Input value={form.birth_date} onChange={set("birth_date")} type="date" />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Objetivo</label>
              <Input value={form.goal} onChange={set("goal")} placeholder="Ej: bajar de peso, ganar masa muscular..." />
            </div>
          </div>

          {/* Preferencias */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-heading font-semibold text-foreground mb-4">Preferencias</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Tema</p>
                <p className="text-xs text-muted-foreground">{theme === "dark" ? "Modo oscuro activo" : "Modo claro activo"}</p>
              </div>
              <button
                onClick={toggleTheme}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-secondary hover:bg-muted transition-colors text-sm font-medium"
              >
                {theme === "dark"
                  ? <><Sun className="h-4 w-4" /> Modo claro</>
                  : <><Moon className="h-4 w-4" /> Modo oscuro</>
                }
              </button>
            </div>
          </div>

          {/* Email (read-only) */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="font-heading font-semibold text-foreground mb-4">Cuenta</h2>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Email</label>
              <div className="h-10 px-3 flex items-center rounded-lg bg-secondary/50 text-sm text-muted-foreground border border-border/50">
                {user?.email}
              </div>
            </div>
          </div>

          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="w-full"
          >
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      )}
    </div>
  );
}
