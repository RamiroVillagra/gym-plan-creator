import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { format, addDays, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";

export default function CalendarPage() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedRoutine, setSelectedRoutine] = useState("");
  const [filterClient, setFilterClient] = useState("");

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

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

  const { data: workouts } = useQuery({
    queryKey: ["assigned-workouts", format(weekStart, "yyyy-MM-dd"), filterClient],
    queryFn: async () => {
      const start = format(weekStart, "yyyy-MM-dd");
      const end = format(addDays(weekStart, 6), "yyyy-MM-dd");
      let query = supabase
        .from("assigned_workouts")
        .select("*, clients(name), routines(name)")
        .gte("workout_date", start)
        .lte("workout_date", end)
        .order("workout_date");
      if (filterClient) {
        query = query.eq("client_id", filterClient);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const assignWorkout = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("assigned_workouts").insert({
        client_id: selectedClient,
        routine_id: selectedRoutine || null,
        workout_date: format(selectedDate!, "yyyy-MM-dd"),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assigned-workouts"] });
      queryClient.invalidateQueries({ queryKey: ["workouts-count"] });
      setAssignOpen(false);
      setSelectedClient(""); setSelectedRoutine("");
      toast.success("Entrenamiento asignado");
    },
  });

  const deleteWorkout = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("assigned_workouts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assigned-workouts"] });
      queryClient.invalidateQueries({ queryKey: ["workouts-count"] });
      toast.success("Entrenamiento eliminado");
    },
  });

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-heading font-bold">Calendario</h1>
          <p className="text-muted-foreground">Asigna rutinas a tus clientes por día</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, -7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground min-w-[160px] text-center">
            {format(weekStart, "d MMM", { locale: es })} - {format(addDays(weekStart, 6), "d MMM yyyy", { locale: es })}
          </span>
          <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Client filter */}
      {role === "coach" && (
        <div className="mb-4">
          <select
            className="h-9 rounded-lg border border-border bg-card px-3 text-sm text-foreground"
            value={filterClient}
            onChange={e => setFilterClient(e.target.value)}
          >
            <option value="">Todos los alumnos</option>
            {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
        {days.map(day => {
          const dateStr = format(day, "yyyy-MM-dd");
          const dayWorkouts = workouts?.filter((w: any) => w.workout_date === dateStr) ?? [];
          const isToday = format(new Date(), "yyyy-MM-dd") === dateStr;

          return (
            <div
              key={dateStr}
              className={`bg-card border rounded-xl p-3 min-h-[140px] ${isToday ? "border-primary" : "border-border"}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className={`text-xs uppercase ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                    {format(day, "EEE", { locale: es })}
                  </p>
                  <p className={`text-lg font-heading font-bold ${isToday ? "text-primary" : "text-foreground"}`}>
                    {format(day, "d")}
                  </p>
                </div>
                {role === "coach" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => { setSelectedDate(day); setAssignOpen(true); }}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <div className="space-y-1">
                {dayWorkouts.map((w: any) => (
                  <div key={w.id} className="bg-secondary/50 rounded-md px-2 py-1 flex items-center justify-between group">
                    <div>
                      <p className="text-xs font-medium text-foreground truncate">{w.clients?.name}</p>
                      {w.routines?.name && (
                        <p className="text-[10px] text-muted-foreground truncate">{w.routines.name}</p>
                      )}
                    </div>
                    {role === "coach" && (
                      <button
                        onClick={() => deleteWorkout.mutate(w.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Asignar Entrenamiento - {selectedDate ? format(selectedDate, "d MMMM yyyy", { locale: es }) : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <select
              className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground"
              value={selectedClient}
              onChange={e => setSelectedClient(e.target.value)}
            >
              <option value="">Seleccionar cliente *</option>
              {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select
              className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground"
              value={selectedRoutine}
              onChange={e => setSelectedRoutine(e.target.value)}
            >
              <option value="">Seleccionar rutina (opcional)</option>
              {routines?.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <Button className="w-full" onClick={() => assignWorkout.mutate()} disabled={!selectedClient}>
              Asignar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
