import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Search, X, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format, parseISO, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Dot,
} from "recharts";

export default function StatsPage() {
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedClientName, setSelectedClientName] = useState("");
  const [clientSearch, setClientSearch] = useState("");

  // Se pueden combinar varios ejercicios "equivalentes" en un mismo gráfico
  const [selectedExercises, setSelectedExercises] = useState<{ id: string; name: string }[]>([]);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const exerciseIds = selectedExercises.map(e => e.id);

  // Período y exclusiones
  const [preset, setPreset] = useState<string>("todo"); // todo | 3m | 6m | 12m | custom
  const [rangeFrom, setRangeFrom] = useState(""); // yyyy-MM-dd
  const [rangeTo, setRangeTo] = useState("");
  const [excludedDates, setExcludedDates] = useState<Set<string>>(new Set()); // sesiones ocultas del gráfico

  const applyPreset = (key: string, months: number | null) => {
    setPreset(key);
    setRangeFrom(months == null ? "" : format(subMonths(new Date(), months), "yyyy-MM-dd"));
    setRangeTo("");
  };
  const toggleExcluded = (date: string) => {
    setExcludedDates(prev => {
      const next = new Set(prev);
      next.has(date) ? next.delete(date) : next.add(date);
      return next;
    });
  };

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

  // Traer los workout_logs del cliente para TODOS los ejercicios seleccionados
  const { data: logs, isLoading } = useQuery({
    queryKey: ["stats-logs", selectedClient, [...exerciseIds].sort().join(",")],
    enabled: !!selectedClient && exerciseIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workout_logs")
        .select("set_number, reps_done, weight_used, completed, exercise_id, exercises(name), assigned_workouts!inner(workout_date, client_id)")
        .in("exercise_id", exerciseIds)
        .eq("assigned_workouts.client_id", selectedClient)
        .eq("completed", true)
        .order("set_number");
      if (error) throw error;
      return data as any[];
    },
  });

  // Ordenar por fecha
  const allSorted = logs
    ? [...logs].sort((a, b) =>
        a.assigned_workouts.workout_date.localeCompare(b.assigned_workouts.workout_date)
      )
    : [];

  // Filtrar por período (rango de fechas). La tabla muestra estos registros.
  const inRange = (d: string) => (!rangeFrom || d >= rangeFrom) && (!rangeTo || d <= rangeTo);
  const sortedLogs = allSorted.filter(l => inRange(l.assigned_workouts.workout_date));

  // Para el gráfico, además, sacar las sesiones excluidas manualmente
  const visibleLogs = sortedLogs.filter(l => !excludedDates.has(l.assigned_workouts.workout_date));

  // Agrupar por fecha para el gráfico (peso máximo por sesión)
  const chartData = Object.values(
    visibleLogs.reduce((acc: Record<string, any>, log) => {
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
  const exerciseName = selectedExercises.map(e => e.name).join(" + ");
  const hasExercises = selectedExercises.length > 0;
  const isCombined = selectedExercises.length > 1;

  const addExercise = (e: { id: string; name: string }) => {
    setSelectedExercises(prev => prev.some(x => x.id === e.id) ? prev : [...prev, e]);
    setExerciseSearch("");
    setExcludedDates(new Set());
  };
  const removeExercise = (id: string) => {
    setSelectedExercises(prev => prev.filter(e => e.id !== id));
    setExcludedDates(new Set());
  };

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
              <button onClick={() => { setSelectedClient(""); setSelectedClientName(""); setClientSearch(""); setSelectedExercises([]); setExerciseSearch(""); }}>
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

        {/* Buscador ejercicio (múltiple: combina ejercicios equivalentes) */}
        <div>
          <label className="text-sm text-muted-foreground block mb-2">
            Ejercicio{isCombined && <span className="text-primary"> — combinando {selectedExercises.length}</span>}
          </label>
          {/* Chips de ejercicios elegidos */}
          {hasExercises && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {selectedExercises.map(e => (
                <span key={e.id} className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/30 px-2.5 py-1 text-sm font-medium text-primary">
                  {e.name}
                  <button onClick={() => removeExercise(e.id)}><X className="h-3.5 w-3.5 text-primary/60 hover:text-primary" /></button>
                </span>
              ))}
            </div>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={!selectedClient ? "Primero elegí un cliente" : hasExercises ? "Sumar otro ejercicio equivalente..." : "Escribí el ejercicio..."}
              className="pl-10"
              value={exerciseSearch}
              onChange={e => setExerciseSearch(e.target.value)}
              disabled={!selectedClient}
            />
          </div>
          {exerciseSearch && selectedClient && (
            <div className="mt-1 border border-border rounded-lg bg-card overflow-hidden max-h-48 overflow-y-auto">
              {exercises?.filter(e => e.name.toLowerCase().includes(exerciseSearch.toLowerCase()) && !exerciseIds.includes(e.id)).map(e => (
                <button
                  key={e.id}
                  onClick={() => addExercise(e)}
                  className="w-full text-left px-3 py-2.5 hover:bg-secondary/60 text-sm text-foreground border-b border-border/40 last:border-0 transition-colors"
                >
                  {e.name}
                </button>
              ))}
              {!exercises?.filter(e => e.name.toLowerCase().includes(exerciseSearch.toLowerCase()) && !exerciseIds.includes(e.id)).length && (
                <p className="text-xs text-muted-foreground px-3 py-2.5">Sin resultados.</p>
              )}
            </div>
          )}
          {isCombined && (
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Se combinan como un solo ejercicio: el gráfico toma el máximo por sesión entre todos.
            </p>
          )}
        </div>

      </div>

      {/* Contenido */}
      {!selectedClient || !hasExercises ? (
        <div className="text-center py-20 text-muted-foreground">
          <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>Elegí un cliente y uno o más ejercicios para ver la progresión.</p>
        </div>
      ) : isLoading ? (
        <div className="text-center py-20 text-muted-foreground">Cargando...</div>
      ) : allSorted.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>No hay registros de <span className="text-foreground font-medium">{exerciseName}</span> para <span className="text-foreground font-medium">{clientName}</span>.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Selector de período */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-xs font-medium text-muted-foreground">Período:</span>
            <div className="flex gap-1 flex-wrap">
              {([["todo", "Todo", null], ["3m", "3 meses", 3], ["6m", "6 meses", 6], ["12m", "1 año", 12]] as const).map(([key, label, months]) => (
                <button
                  key={key}
                  onClick={() => applyPreset(key, months)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    preset === key ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Desde</span>
              <Input type="date" value={rangeFrom} onChange={e => { setRangeFrom(e.target.value); setPreset("custom"); }} className="h-8 w-36" />
              <span>Hasta</span>
              <Input type="date" value={rangeTo} onChange={e => { setRangeTo(e.target.value); setPreset("custom"); }} className="h-8 w-36" />
            </div>
          </div>

          {excludedDates.size > 0 && (
            <div className="flex items-center justify-between bg-secondary/40 rounded-lg px-3 py-2 -mt-4">
              <span className="text-xs text-muted-foreground">
                {excludedDates.size} sesión{excludedDates.size !== 1 ? "es" : ""} oculta{excludedDates.size !== 1 ? "s" : ""} del gráfico
              </span>
              <button onClick={() => setExcludedDates(new Set())} className="text-xs font-medium text-primary hover:text-primary/80">
                Mostrar todas
              </button>
            </div>
          )}

          {sortedLogs.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No hay registros en el período elegido. Ampliá el rango o tocá "Todo".</p>
            </div>
          ) : (
          <>
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
                  domain={[(dataMin: number) => dataMin - 5, (dataMax: number) => dataMax + 5]}
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
                    {isCombined && <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Ejercicio</th>}
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Serie</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Reps</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Peso</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Gráfico</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedLogs.map((log, i) => {
                    const date = log.assigned_workouts.workout_date;
                    const prevDate = i > 0 ? sortedLogs[i - 1].assigned_workouts.workout_date : null;
                    const isNewDate = date !== prevDate;
                    const excluded = excludedDates.has(date);
                    return (
                      <tr key={i} className={`border-b border-border/50 hover:bg-secondary/20 transition-colors ${excluded ? "opacity-45" : ""}`}>
                        <td className="px-6 py-3 text-foreground">
                          {isNewDate
                            ? format(parseISO(date), "EEEE d MMM yyyy", { locale: es })
                            : <span className="text-muted-foreground">—</span>
                          }
                        </td>
                        {isCombined && <td className="px-4 py-3 text-left text-xs text-muted-foreground">{log.exercises?.name ?? "—"}</td>}
                        <td className="px-4 py-3 text-center text-muted-foreground">{log.set_number}</td>
                        <td className="px-4 py-3 text-center text-foreground">{log.reps_done ?? "—"}</td>
                        <td className={`px-4 py-3 text-center font-medium text-primary ${excluded ? "line-through" : ""}`}>
                          {log.weight_used != null ? `${log.weight_used} kg` : "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isNewDate && (
                            <button
                              onClick={() => toggleExcluded(date)}
                              title={excluded ? "Mostrar esta sesión en el gráfico" : "Ocultar esta sesión del gráfico"}
                              className="inline-flex items-center justify-center p-1 rounded-md hover:bg-secondary transition-colors"
                            >
                              {excluded
                                ? <EyeOff className="h-4 w-4 text-muted-foreground" />
                                : <Eye className="h-4 w-4 text-primary/70" />
                              }
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          </>
          )}
        </div>
      )}
    </div>
  );
}
