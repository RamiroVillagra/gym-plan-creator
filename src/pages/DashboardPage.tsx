import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, ListChecks, ClipboardList, CalendarDays } from "lucide-react";
import { Link } from "react-router-dom";

function StatCard({ icon: Icon, label, value, to }: { icon: any; label: string; value: number; to: string }) {
  return (
    <Link to={to} className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-colors group">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
          <Icon className="h-5 w-5" />
        </div>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <p className="text-3xl font-heading font-bold text-foreground">{value}</p>
    </Link>
  );
}

export default function DashboardPage() {
  const { data: clients } = useQuery({
    queryKey: ["clients-count"],
    queryFn: async () => {
      const { count } = await supabase.from("clients").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: exercises } = useQuery({
    queryKey: ["exercises-count"],
    queryFn: async () => {
      const { count } = await supabase.from("exercises").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: routines } = useQuery({
    queryKey: ["routines-count"],
    queryFn: async () => {
      const { count } = await supabase.from("routines").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: workouts } = useQuery({
    queryKey: ["workouts-count"],
    queryFn: async () => {
      const { count } = await supabase.from("assigned_workouts").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  return (
    <div className="animate-fade-in">
      <h1 className="text-3xl font-heading font-bold mb-2">Dashboard</h1>
      <p className="text-muted-foreground mb-8">Resumen general de tu sistema de entrenamiento</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Clientes" value={clients ?? 0} to="/clients" />
        <StatCard icon={ListChecks} label="Ejercicios" value={exercises ?? 0} to="/exercises" />
        <StatCard icon={ClipboardList} label="Rutinas" value={routines ?? 0} to="/routines" />
        <StatCard icon={CalendarDays} label="Entrenamientos" value={workouts ?? 0} to="/calendar" />
      </div>
    </div>
  );
}
