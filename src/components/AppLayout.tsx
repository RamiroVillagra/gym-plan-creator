import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Dumbbell, Users, ListChecks, CalendarDays, ClipboardList, Menu, X, LogOut, UsersRound, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const coachNav = [
  { to: "/", label: "Dashboard", icon: Dumbbell },
  { to: "/exercises", label: "Ejercicios", icon: ListChecks },
  { to: "/clients", label: "Clientes", icon: Users },
  { to: "/routines", label: "Rutinas", icon: ClipboardList },
  { to: "/calendar", label: "Calendario", icon: CalendarDays },
  { to: "/groups", label: "Grupos", icon: UsersRound },
];

const studentNav = [
  { to: "/", label: "Mi Entrenamiento", icon: Dumbbell },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { role, user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = role === "coach" ? coachNav : studentNav;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar - desktop */}
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-card p-6 gap-2">
        <Link to="/" className="flex items-center gap-2 mb-8">
          <Dumbbell className="h-7 w-7 text-primary" />
          <span className="font-heading text-xl font-bold text-foreground">TrainPro</span>
        </Link>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                location.pathname === item.to
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-1">
          {role === "coach" && (
            <>
              <Link
                to="/workout"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-muted transition-colors"
              >
                <Dumbbell className="h-4 w-4" />
                Vista Alumno
              </Link>
              <a
                href="/kiosk"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-muted transition-colors"
              >
                <Monitor className="h-4 w-4" />
                Modo Kiosco
              </a>
            </>
          )}
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors w-full"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-card border-b border-border px-4 h-14">
        <Link to="/" className="flex items-center gap-2">
          <Dumbbell className="h-6 w-6 text-primary" />
          <span className="font-heading text-lg font-bold">TrainPro</span>
        </Link>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="text-foreground">
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile nav overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-background/95 pt-14">
          <nav className="flex flex-col gap-1 p-4">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors",
                  location.pathname === item.to
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            ))}
            {role === "coach" && (
              <>
                <Link
                  to="/workout"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium bg-secondary text-secondary-foreground hover:bg-muted mt-4"
                >
                  <Dumbbell className="h-5 w-5" />
                  Vista Alumno
                </Link>
                <a
                  href="/kiosk"
                  target="_blank"
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium bg-secondary text-secondary-foreground hover:bg-muted"
                >
                  <Monitor className="h-5 w-5" />
                  Modo Kiosco
                </a>
              </>
            )}
            <button
              onClick={() => { setMobileOpen(false); signOut(); }}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium text-muted-foreground hover:text-foreground hover:bg-secondary mt-2"
            >
              <LogOut className="h-5 w-5" />
              Cerrar sesión
            </button>
          </nav>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 md:p-8 p-4 pt-18 md:pt-8 overflow-auto">
        {children}
      </main>
    </div>
  );
}
