import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  format, addDays, addWeeks, addMonths, startOfWeek, startOfMonth, endOfMonth,
  eachDayOfInterval, isSameMonth, isSameDay, subMonths, subWeeks
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Trash2, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";

type ViewMode = "month" | "week" | "day";

export default function CalendarPage() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [filterClient, setFilterClient] = useState("");

  // Assign dialog
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedRoutine, setSelectedRoutine] = useState("");

  // Bulk assign dialog
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkClient, setBulkClient] = useState("");
  const [bulkRoutine, setBulkRoutine] = useState("");
  const [bulkDays, setBulkDays] = useState<number[]>([]);
  const [bulkWeeks, setBulkWeeks] = useState("4");

  const { dateRange, days } = getDateRange(viewMode, currentDate);

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
    queryKey: ["assigned-workouts", dateRange.start, dateRange.end, filterClient],
    queryFn: async () => {
      let query = supabase
        .from("assigned_workouts")
        .select("*, clients(name), routines(name)")
        .gte("workout_date", dateRange.start)
        .lte("workout_date", dateRange.end)
        .order("workout_date");
      if (filterClient) query = query.eq("client_id", filterClient);
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
      setAssignOpen(false);
      setSelectedClient(""); setSelectedRoutine("");
      toast.success("Entrenamiento asignado");
    },
  });

  const bulkAssign = useMutation({
    mutationFn: async () => {
      const weeks = parseInt(bulkWeeks) || 1;
      const inserts: any[] = [];
      for (let w = 0; w < weeks; w++) {
        for (const dayOfWeek of bulkDays) {
          const weekStart = startOfWeek(addWeeks(currentDate, w), { weekStartsOn: 1 });
          const date = addDays(weekStart, dayOfWeek);
          inserts.push({
            client_id: bulkClient,
            routine_id: bulkRoutine || null,
            workout_date: format(date, "yyyy-MM-dd"),
          });
        }
      }
      const { error } = await supabase.from("assigned_workouts").insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assigned-workouts"] });
      setBulkOpen(false);
      setBulkDays([]); setBulkClient(""); setBulkRoutine("");
      toast.success("Entrenamientos asignados");
    },
  });

  const deleteWorkout = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("assigned_workouts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assigned-workouts"] });
      toast.success("Eliminado");
    },
  });

  const navigate = (dir: -1 | 1) => {
    if (viewMode === "month") setCurrentDate(dir === 1 ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    else if (viewMode === "week") setCurrentDate(dir === 1 ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, dir));
  };

  const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const toggleBulkDay = (d: number) => setBulkDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-heading font-bold">Calendario</h1>
          <p className="text-muted-foreground">Asigna rutinas a tus clientes</p>
        </div>
        <div className="flex items-center gap-2">
          {role === "coach" && (
            <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)}>
              <CalendarDays className="h-4 w-4 mr-1" />Planificar
            </Button>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground min-w-[180px] text-center font-medium">
            {viewMode === "month" && format(currentDate, "MMMM yyyy", { locale: es })}
            {viewMode === "week" && `${format(days[0], "d MMM", { locale: es })} - ${format(days[days.length - 1], "d MMM yyyy", { locale: es })}`}
            {viewMode === "day" && format(currentDate, "EEEE d 'de' MMMM yyyy", { locale: es })}
          </span>
          <Button variant="outline" size="icon" onClick={() => navigate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date())}>Hoy</Button>
        </div>

        <div className="flex items-center gap-2">
          {role === "coach" && (
            <select
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
              value={filterClient}
              onChange={e => setFilterClient(e.target.value)}
            >
              <option value="">Todos</option>
              {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["month", "week", "day"] as ViewMode[]).map(v => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === v ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {v === "month" ? "Mes" : v === "week" ? "Semana" : "Día"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Calendar grid */}
      {viewMode === "day" ? (
        <DayView
          date={currentDate}
          workouts={workouts?.filter((w: any) => w.workout_date === format(currentDate, "yyyy-MM-dd")) ?? []}
          role={role}
          onAdd={() => { setSelectedDate(currentDate); setAssignOpen(true); }}
          onDelete={(id) => deleteWorkout.mutate(id)}
        />
      ) : (
        <div>
          {viewMode === "week" && (
            <div className="grid grid-cols-7 gap-1 mb-1">
              {dayNames.map(d => (
                <div key={d} className="text-center text-xs text-muted-foreground font-medium py-1">{d}</div>
              ))}
            </div>
          )}
          {viewMode === "month" && (
            <div className="grid grid-cols-7 gap-1 mb-1">
              {dayNames.map(d => (
                <div key={d} className="text-center text-xs text-muted-foreground font-medium py-1">{d}</div>
              ))}
            </div>
          )}
          <div className={`grid grid-cols-7 gap-1`}>
            {days.map(day => {
              const dateStr = format(day, "yyyy-MM-dd");
              const dayWorkouts = workouts?.filter((w: any) => w.workout_date === dateStr) ?? [];
              const isToday = isSameDay(day, new Date());
              const isCurrentMonth = viewMode === "month" ? isSameMonth(day, currentDate) : true;

              return (
                <div
                  key={dateStr}
                  className={`bg-card border rounded-lg p-2 min-h-[80px] md:min-h-[100px] cursor-pointer transition-colors hover:border-primary/30 ${
                    isToday ? "border-primary" : "border-border"
                  } ${!isCurrentMonth ? "opacity-40" : ""}`}
                  onClick={() => {
                    if (role === "coach") {
                      setSelectedDate(day);
                      setAssignOpen(true);
                    }
                  }}
                >
                  <p className={`text-xs font-medium mb-1 ${isToday ? "text-primary" : "text-foreground"}`}>
                    {format(day, "d")}
                  </p>
                  <div className="space-y-0.5">
                    {dayWorkouts.slice(0, 3).map((w: any) => (
                      <div key={w.id} className="bg-secondary/50 rounded px-1.5 py-0.5 flex items-center justify-between group text-[10px]">
                        <span className="text-foreground truncate">{w.clients?.name}</span>
                        {role === "coach" && (
                          <button
                            onClick={e => { e.stopPropagation(); deleteWorkout.mutate(w.id); }}
                            className="opacity-0 group-hover:opacity-100 ml-1"
                          >
                            <Trash2 className="h-2.5 w-2.5 text-destructive" />
                          </button>
                        )}
                      </div>
                    ))}
                    {dayWorkouts.length > 3 && (
                      <p className="text-[10px] text-muted-foreground">+{dayWorkouts.length - 3} más</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Assign dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Asignar - {selectedDate ? format(selectedDate, "d MMMM yyyy", { locale: es }) : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <select
              className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
              value={selectedClient}
              onChange={e => setSelectedClient(e.target.value)}
            >
              <option value="">Seleccionar cliente *</option>
              {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select
              className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
              value={selectedRoutine}
              onChange={e => setSelectedRoutine(e.target.value)}
            >
              <option value="">Rutina (opcional)</option>
              {routines?.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <Button className="w-full" onClick={() => assignWorkout.mutate()} disabled={!selectedClient}>
              Asignar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk assign / Planificar dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Planificar Entrenamientos</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <select
              className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
              value={bulkClient}
              onChange={e => setBulkClient(e.target.value)}
            >
              <option value="">Seleccionar cliente *</option>
              {clients?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select
              className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
              value={bulkRoutine}
              onChange={e => setBulkRoutine(e.target.value)}
            >
              <option value="">Rutina (opcional)</option>
              {routines?.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <div>
              <label className="text-xs text-muted-foreground block mb-2">¿Qué días entrena?</label>
              <div className="flex gap-1">
                {dayNames.map((d, i) => (
                  <button
                    key={i}
                    onClick={() => toggleBulkDay(i)}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                      bulkDays.includes(i) ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">¿Por cuántas semanas?</label>
              <Input type="number" min="1" max="52" value={bulkWeeks} onChange={e => setBulkWeeks(e.target.value)} />
            </div>
            <Button className="w-full" onClick={() => bulkAssign.mutate()} disabled={!bulkClient || !bulkDays.length}>
              Planificar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DayView({ date, workouts, role, onAdd, onDelete }: {
  date: Date; workouts: any[]; role: string | null;
  onAdd: () => void; onDelete: (id: string) => void;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-heading font-bold">
          {format(date, "EEEE d 'de' MMMM", { locale: es })}
        </h2>
        {role === "coach" && (
          <Button size="sm" onClick={onAdd}><Plus className="h-4 w-4 mr-1" />Agregar</Button>
        )}
      </div>
      {!workouts.length ? (
        <p className="text-muted-foreground text-sm">Sin entrenamientos.</p>
      ) : (
        <div className="space-y-2">
          {workouts.map((w: any) => (
            <div key={w.id} className="flex items-center justify-between bg-secondary/50 rounded-lg px-4 py-3">
              <div>
                <p className="font-medium text-foreground">{w.clients?.name}</p>
                {w.routines?.name && <p className="text-xs text-muted-foreground">{w.routines.name}</p>}
              </div>
              {role === "coach" && (
                <Button variant="ghost" size="icon" onClick={() => onDelete(w.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getDateRange(viewMode: ViewMode, currentDate: Date) {
  if (viewMode === "month") {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = addDays(startOfWeek(addDays(monthEnd, 6), { weekStartsOn: 1 }), 6);
    const days = eachDayOfInterval({ start: calStart, end: calEnd }).slice(0, 42);
    return {
      dateRange: { start: format(calStart, "yyyy-MM-dd"), end: format(calEnd, "yyyy-MM-dd") },
      days,
    };
  } else if (viewMode === "week") {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    return {
      dateRange: { start: format(weekStart, "yyyy-MM-dd"), end: format(addDays(weekStart, 6), "yyyy-MM-dd") },
      days,
    };
  } else {
    return {
      dateRange: { start: format(currentDate, "yyyy-MM-dd"), end: format(currentDate, "yyyy-MM-dd") },
      days: [currentDate],
    };
  }
}
