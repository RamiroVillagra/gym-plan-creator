import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Dumbbell, Users, ListChecks, CalendarDays, ClipboardList, Menu, X, LogOut, UsersRound, Monitor, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const coachNav = [
  { to: "/", label: "Dashboard", icon: Dumbbell },
  { to: "/exercises", label: "Ejercicios", icon: ListChecks },
  { to: "/clients", label: "Clientes", icon: Users },
  { to: "/routines", label: "Rutinas", icon: ClipboardList },
  { to: "/calendar", label: "Calendario", icon: CalendarDays },
  { to: "/groups", label: "Grupos", icon: UsersRound },
  { to: "/kiosk", label: "Modo Kiosco", icon: Monitor },
];

const studentNav = [
  { to: "/", label: "Mi Entrenamiento", icon: Dumbbell },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { role, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const navItems = role === "coach" ? coachNav : studentNav;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar - desktop */}
      <aside className={cn(
        "hidden md:flex flex-col border-r border-border bg-card gap-2 transition-all duration-300 relative",
        sidebarOpen ? "w-64 p-6" : "w-16 p-3"
      )}>
        {/* Toggle button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute -right-3 top-8 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground shadow-sm transition-colors"
        >
          {sidebarOpen ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>

        <Link to="/" className={cn("flex items-center gap-3", sidebarOpen ? "mb-8" : "mb-6 justify-center")}>
          <img src="/logo.png" alt="Delta App" className="h-8 w-8 object-contain shrink-0" />
          {sidebarOpen && <span className="font-heading text-xl font-bold text-foreground">Delta App</span>}
        </Link>

        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              title={!sidebarOpen ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                !sidebarOpen && "justify-center px-2",
                location.pathname === item.to
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {sidebarOpen && item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-1">
          {role === "coach" && (
            <Link
              to="/workout"
              title={!sidebarOpen ? "Vista Alumno" : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-muted transition-colors",
                !sidebarOpen && "justify-center px-2"
              )}
            >
              <Dumbbell className="h-4 w-4 shrink-0" />
              {sidebarOpen && "Vista Alumno"}
            </Link>
          )}
          <button
            onClick={signOut}
            title={!sidebarOpen ? "Cerrar sesión" : undefined}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors w-full",
              !sidebarOpen && "justify-center px-2"
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {sidebarOpen && "Cerrar sesión"}
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-card border-b border-border px-4 h-14">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo.png" alt="Delta App" className="h-7 w-7 object-contain" />
          <span className="font-heading text-lg font-bold">Delta App</span>
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
              <Link
                to="/workout"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium bg-secondary text-secondary-foreground hover:bg-muted mt-4"
              >
                <Dumbbell className="h-5 w-5" />
                Vista Alumno
              </Link>
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