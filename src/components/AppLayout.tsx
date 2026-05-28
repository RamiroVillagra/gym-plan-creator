import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Dumbbell, Users, ListChecks, CalendarDays, ClipboardList, Menu, X, LogOut, UsersRound, Monitor, ChevronLeft, ChevronRight, TrendingUp, Sun, Moon, Layers, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

const coachNav = [
  { to: "/", label: "Dashboard", icon: Dumbbell },
  { to: "/exercises", label: "Ejercicios", icon: ListChecks },
  { to: "/clients", label: "Clientes", icon: Users },
  { to: "/routines", label: "Rutinas", icon: ClipboardList },
  { to: "/calendar", label: "Calendario", icon: CalendarDays },
  { to: "/groups", label: "Grupos", icon: UsersRound },
  { to: "/bloques", label: "Bloques", icon: Layers },
  { to: "/kiosk", label: "Modo Kiosco", icon: Monitor },
  { to: "/stats", label: "Estadísticas", icon: TrendingUp },
];

const studentNav = [
  { to: "/", label: "Mi Entrenamiento", shortLabel: "Entreno", icon: CalendarDays },
  { to: "/stats", label: "Mi Progresión", shortLabel: "Progresión", icon: TrendingUp },
  { to: "/profile", label: "Mi Perfil", shortLabel: "Perfil", icon: UserCircle },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { role, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const navItems = role === "coach" ? coachNav : studentNav;

  return (
    <div className="flex min-h-screen bg-background">

      {/* ── Sidebar (desktop) ─────────────────────────────── */}
      <aside className={cn(
        "hidden md:flex flex-col border-r border-sidebar-border bg-sidebar gap-1 transition-all duration-300 relative",
        sidebarOpen ? "w-64 p-5" : "w-16 p-3"
      )}>
        {/* Collapse toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute -right-3 top-8 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border/80 bg-sidebar text-muted-foreground hover:text-primary hover:border-primary/40 shadow-md transition-all duration-200"
        >
          {sidebarOpen ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>

        {/* Logo */}
        <Link
          to="/"
          className={cn("flex items-center gap-3 mb-2", !sidebarOpen && "justify-center")}
        >
          <div className={cn(
            "flex items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20 shrink-0 transition-all duration-300",
            sidebarOpen ? "h-9 w-9" : "h-9 w-9"
          )}>
            <img src="/logo.png" alt="Delta App" className="h-5 w-5 object-contain" />
          </div>
          {sidebarOpen && (
            <span className="font-heading text-xl font-bold tracking-tight text-foreground">
              Delta App
            </span>
          )}
        </Link>

        {/* Separator under logo */}
        {sidebarOpen && (
          <div className="h-px mb-4 bg-gradient-to-r from-primary/25 via-sidebar-border to-transparent" />
        )}

        {/* Nav items */}
        <nav className="flex flex-col gap-0.5">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                title={!sidebarOpen ? item.label : undefined}
                className={cn(
                  "relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 overflow-hidden",
                  !sidebarOpen && "justify-center px-0",
                  isActive
                    ? "bg-gradient-to-r from-primary/18 to-transparent text-foreground font-semibold"
                    : "text-sidebar-foreground hover:text-foreground hover:bg-sidebar-accent"
                )}
              >
                {/* Active left-edge indicator */}
                {isActive && (
                  <span
                    className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-primary"
                    aria-hidden
                  />
                )}
                <item.icon className={cn("h-4 w-4 shrink-0 transition-colors", isActive && "text-primary")} />
                {sidebarOpen && item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer actions */}
        <div className={cn(
          "mt-auto flex flex-col gap-0.5 pt-4 border-t border-sidebar-border/60",
        )}>
          {role === "coach" && (
            <Link
              to="/workout"
              title={!sidebarOpen ? "Vista Alumno" : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                "bg-primary/10 text-primary hover:bg-primary/18 border border-primary/20",
                !sidebarOpen && "justify-center px-0"
              )}
            >
              <Dumbbell className="h-4 w-4 shrink-0" />
              {sidebarOpen && "Vista Alumno"}
            </Link>
          )}
          <button
            onClick={toggleTheme}
            title={!sidebarOpen ? (theme === "dark" ? "Modo claro" : "Modo oscuro") : undefined}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:text-foreground hover:bg-sidebar-accent transition-all duration-200 w-full",
              !sidebarOpen && "justify-center px-0"
            )}
          >
            {theme === "dark"
              ? <Sun className="h-4 w-4 shrink-0" />
              : <Moon className="h-4 w-4 shrink-0" />}
            {sidebarOpen && (theme === "dark" ? "Modo claro" : "Modo oscuro")}
          </button>
          <button
            onClick={signOut}
            title={!sidebarOpen ? "Cerrar sesión" : undefined}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:text-destructive hover:bg-destructive/8 transition-all duration-200 w-full",
              !sidebarOpen && "justify-center px-0"
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {sidebarOpen && "Cerrar sesión"}
          </button>
        </div>
      </aside>

      {/* ── Mobile header (coaches) ────────────────────────── */}
      {role !== "student" && (
        <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-card/90 backdrop-blur-md border-b border-border/50 px-4 h-14 shadow-sm">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
              <img src="/logo.png" alt="Delta App" className="h-4 w-4 object-contain" />
            </div>
            <span className="font-heading text-lg font-bold tracking-tight">Delta App</span>
          </Link>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground hover:bg-secondary transition-colors"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      )}

      {/* ── Mobile nav overlay (coaches) ──────────────────── */}
      {role !== "student" && mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-background/96 backdrop-blur-sm pt-14 animate-fade-in">
          <nav className="flex flex-col gap-0.5 p-4">
            {navItems.map((item) => {
              const isActive = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "relative flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 overflow-hidden",
                    isActive
                      ? "bg-gradient-to-r from-primary/18 to-transparent text-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  )}
                >
                  {isActive && (
                    <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-primary" aria-hidden />
                  )}
                  <item.icon className={cn("h-5 w-5 shrink-0", isActive && "text-primary")} />
                  {item.label}
                </Link>
              );
            })}

            {role === "coach" && (
              <Link
                to="/workout"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium bg-primary/10 text-primary hover:bg-primary/18 border border-primary/20 mt-4 transition-all duration-200"
              >
                <Dumbbell className="h-5 w-5" />
                Vista Alumno
              </Link>
            )}

            <div className="h-px bg-border/50 my-3" />

            <button
              onClick={toggleTheme}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all duration-200"
            >
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              {theme === "dark" ? "Modo claro" : "Modo oscuro"}
            </button>
            <button
              onClick={() => { setMobileOpen(false); signOut(); }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-all duration-200"
            >
              <LogOut className="h-5 w-5" />
              Cerrar sesión
            </button>
          </nav>
        </div>
      )}

      {/* ── Bottom tab bar (students, mobile) ─────────────── */}
      {role === "student" && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex bg-card/95 backdrop-blur-md border-t border-border/50 shadow-[0_-1px_16px_rgba(0,0,0,0.18)]">
          {studentNav.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-col items-center justify-center py-2.5 flex-1 text-xs font-medium transition-all duration-200 min-w-0 relative",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {/* Top active indicator */}
                {isActive && (
                  <span
                    className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-b-full bg-primary"
                    aria-hidden
                  />
                )}
                <item.icon className={cn(
                  "h-5 w-5 mb-0.5 shrink-0 transition-all duration-200",
                  isActive && "scale-110"
                )} />
                <span className="truncate w-full text-center px-0.5">
                  {(item as any).shortLabel ?? item.label}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {/* ── Main content ──────────────────────────────────── */}
      <main className={cn(
        "overflow-auto",
        role === "student"
          ? "flex-1 px-4 pt-6 pb-24 md:p-8 md:pt-8"
          : "flex-1 md:p-8 p-4 pt-18 md:pt-8"
      )}>
        {children}
      </main>
    </div>
  );
}
