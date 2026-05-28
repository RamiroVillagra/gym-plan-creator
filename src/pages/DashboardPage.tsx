import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, ListChecks, ClipboardList, CalendarDays, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

function StatCard({
  icon: Icon,
  label,
  value,
  to,
  accent = false,
}: {
  icon: any;
  label: string;
  value: number;
  to: string;
  accent?: boolean;
}) {
  return (
    <Link
      to={to}
      className="group relative bg-card border border-border/60 rounded-2xl p-6 overflow-hidden transition-all duration-300 hover:border-primary/35 hover:shadow-card-hover hover:-translate-y-0.5"
    >
      {/* Top-light shimmer — the "directional light from above" */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />

      {/* Hover: teal glow from top edge */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      {/* Subtle bg gradient on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />

      <div className="relative z-10">
        {/* Icon + Label row */}
        <div className="flex items-center justify-between mb-5">
          <div className={`
            p-2.5 rounded-xl ring-1 transition-all duration-200
            ${accent
              ? "bg-primary/15 text-primary ring-primary/25 group-hover:bg-primary/25"
              : "bg-muted/80 text-muted-foreground ring-border/60 group-hover:bg-primary/12 group-hover:text-primary group-hover:ring-primary/20"
            }
          `}>
            <Icon className="h-4 w-4" />
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary/70 group-hover:translate-x-0.5 transition-all duration-200" />
        </div>

        {/* Value — JetBrains Mono for the numeric punch */}
        <p className="font-data text-4xl font-bold text-foreground tracking-tight leading-none mb-2">
          {value}
        </p>

        {/* Label */}
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">
          {label}
        </p>
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();

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
      {/* Page header */}
      <div className="mb-10">
        <p className="text-[11px] font-data font-bold text-primary uppercase tracking-[0.2em] mb-2">
          Panel de control
        </p>
        <h1 className="text-4xl font-heading font-bold tracking-tight text-foreground leading-tight">
          Dashboard
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Resumen general de tu sistema de entrenamiento
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users}       label="Clientes"        value={clients ?? 0}   to="/clients"  accent />
        <StatCard icon={ListChecks}  label="Ejercicios"      value={exercises ?? 0} to="/exercises" />
        <StatCard icon={ClipboardList} label="Rutinas"       value={routines ?? 0}  to="/routines" />
        <StatCard icon={CalendarDays}  label="Entrenamientos" value={workouts ?? 0} to="/calendar" />
      </div>
    </div>
  );
}
