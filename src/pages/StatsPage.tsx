import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Dot,
} from "recharts";

export default function StatsPage() {
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedClientName, setSelectedClientName] = useState("");
  const [clientSearch, setClientSearch] = useState("");

  const [selectedExercise, setSelectedExercise] = useState("");
  const [selectedExerciseName, setSelectedExerciseName] = useState("");
  const [exerciseSearch, setExerciseSearch] = useState("");

  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: exercises } = useQuery({
    queryKey: ["exercises"],
    queryFn: async () => {
      const { data, error } = await supabase.from("exercises").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Traer todos los workout_logs del cliente+ejercicio con la fecha del workout
  const { data: logs, isLoading } = useQuery({
    queryKey: ["stats-logs", selectedClient, selectedExercise],
    enabled: !!selectedClient && !!selectedExercise,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workout_logs")
        .select("set_number, reps_done, weight_used, completed, assigned_workouts!inner(workout_date, client_id)")
        .eq("exercise_id", selectedExercise)
        .eq("assigned_workouts.client_id", selectedClient)
        .eq("completed", true)
        .order("set_number");
      if (error) throw error;
      return data as any[];
    },
  });

  // Ordenar por fecha y agrupar por sesión
  const sortedLogs = logs
    ? [...logs].sort((a, b) =>
        a.assigned_workouts.workout_date.localeCompare(b.assigned_workouts.workout_date)
      )
    : [];

  // Agrupar por fecha para el gráfico (peso máximo por sesión)
  const chartData = Object.values(
    sortedLogs.reduce((acc: Record<string, any>, log) => {
      const date = log.assigned_workouts.workout_date;
      if (!acc[date]) {
        acc[date] = { date, maxWeight: 0, totalSets: 0 };
      }
      if ((log.weight_used ?? 0) > acc[date].maxWeight) {
        acc[date].maxWeight = log.weight_used ?? 0;
      }
      acc[date].totalSets += 1;
      return acc;
    }, {})
  ).sort((a: any, b: any) => a.date.localeCompare(b.date));

  const clientName = selectedClientName;
  const exerciseName = selectedExerciseName;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <TrendingUp className="h-7 w-7 text-primary" />
        <h1 className="font-heading text-2xl font-bold">Estadísticas</h1>
      </div>

      {/* Selectores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">

        {/* Buscador cliente */}
        <div>
          <label className="text-sm text-muted-foreground block mb-2">Cliente</label>
          {selectedClient ? (
            <div className="flex items-center justify-between h-10 px-3 rounded-lg bg-primary/10 border border-primary/30">
              <span className="text-sm font-medium text-primary">{selectedClientName}</span>
              <button onClick={() => { setSelectedClient(""); setSelectedClientName(""); setClientSearch(""); setSelectedExercise(""); setSelectedExerciseName(""); setExerciseSearch(""); }}>
                <X className="h-4 w-4 text-primary/60 hover:text-primary" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Escribí el nombre..."
                className="pl-10"
                value={clientSearch}
                onChange={e => setClientSearch(e.target.value)}
              />
            </div>
          )}
          {!selectedClient && clientSearch && (
            <div className="mt-1 border border-border rounded-lg bg-card overflow-hidden max-h-48 overflow-y-auto">
              {clients?.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase())).map(c => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedClient(c.id); setSelectedClientName(c.name); setClientSearch(""); }}
                  className="w-full text-left px-3 py-2.5 hover:bg-secondary/60 text-sm text-foreground border-b border-border/40 last:border-0 transition-colors"
                >
                  {c.name}
                </button>
              ))}
              {!clients?.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase())).length && (
                <p className="text-xs text-muted-foreground px-3 py-2.5">Sin resultados.</p>
              )}
            </div>
          )}
        </div>

        {/* Buscador ejercicio */}
        <div>
          <label className="text-sm text-muted-foreground block mb-2">Ejercicio</label>
          {selectedExercise ? (
            <div className="flex items-center justify-between h-10 px-3 rounded-lg bg-primary/10 border border-primary/30">
              <span className="text-sm font-medium text-primary">{selectedExerciseName}</span>
              <button onClick={() => { setSelectedExercise(""); setSelectedExerciseName(""); setExerciseSearch(""); }}>
                <X className="h-4 w-4 text-primary/60 hover:text-primary" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={selectedClient ? "Escribí el ejercicio..." : "Primero elegí un cliente"}
                className="pl-10"
                value={exerciseSearch}
                onChange={e => setExerciseSearch(e.target.value)}
                disabled={!selectedClient}
              />
            </div>
          )}
          {!selectedExercise && exerciseSearch && selectedClient && (
            <div className="mt-1 border border-border rounded-lg bg-card overflow-hidden max-h-48 overflow-y-auto">
              {exercises?.filter(e => e.name.toLowerCase().includes(exerciseSearch.toLowerCase())).map(e => (
                <button
                  key={e.id}
                  onClick={() => { setSelectedExercise(e.id); setSelectedExerciseName(e.name); setExerciseSearch(""); }}
                  className="w-full text-left px-3 py-2.5 hover:bg-secondary/60 text-sm text-foreground border-b border-border/40 last:border-0 transition-colors"
                >
                  {e.name}
                </button>
              ))}
              {!exercises?.filter(e => e.name.toLowerCase().includes(exerciseSearch.toLowerCase())).length && (
                <p className="text-xs text-muted-foreground px-3 py-2.5">Sin resultados.</p>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Contenido */}
      {!selectedClient || !selectedExercise ? (
        <div className="text-center py-20 text-muted-foreground">
          <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>Elegí un cliente y un ejercicio para ver la progresión.</p>
        </div>
      ) : isLoading ? (
        <div className="text-center py-20 text-muted-foreground">Cargando...</div>
      ) : sortedLogs.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>No hay registros de <span className="text-foreground font-medium">{exerciseName}</span> para <span className="text-foreground font-medium">{clientName}</span>.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Gráfico */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="font-heading font-semibold text-foreground mb-1">{exerciseName}</h2>
            <p className="text-xs text-muted-foreground mb-6">Peso máximo por sesión — {clientName}</p>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  tickFormatter={d => format(parseISO(d), "d MMM", { locale: es })}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `${v}kg`}
                  width={48}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: 12,
                  }}
                  labelFormatter={d => format(parseISO(d), "EEEE d 'de' MMMM yyyy", { locale: es })}
                  formatter={(value: any) => [`${value} kg`, "Peso máximo"]}
                />
                <Line
                  type="monotone"
                  dataKey="maxWeight"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  dot={<Dot r={4} fill="hsl(var(--primary))" stroke="hsl(var(--card))" strokeWidth={2} />}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Tabla de registros */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="font-heading font-semibold text-foreground">Historial de series</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Fecha</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Serie</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Reps</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Peso</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedLogs.map((log, i) => {
                    const date = log.assigned_workouts.workout_date;
                    const prevDate = i > 0 ? sortedLogs[i - 1].assigned_workouts.workout_date : null;
                    const isNewDate = date !== prevDate;
                    return (
                      <tr key={i} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                        <td className="px-6 py-3 text-foreground">
                          {isNewDate
                            ? format(parseISO(date), "EEEE d MMM yyyy", { locale: es })
                            : <span className="text-muted-foreground">—</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-center text-muted-foreground">{log.set_number}</td>
                        <td className="px-4 py-3 text-center text-foreground">{log.reps_done ?? "—"}</td>
                        <td className="px-4 py-3 text-center font-medium text-primary">
                          {log.weight_used != null ? `${log.weight_used} kg` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
