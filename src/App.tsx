import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";

// Lazy-loaded pages — each route gets its own chunk, only loaded on demand
const AuthPage         = lazy(() => import("./pages/AuthPage"));
const DashboardPage    = lazy(() => import("./pages/DashboardPage"));
const ExercisesPage    = lazy(() => import("./pages/ExercisesPage"));
const ClientsPage      = lazy(() => import("./pages/ClientsPage"));
const RoutinesPage     = lazy(() => import("./pages/RoutinesPage"));
const CalendarPage     = lazy(() => import("./pages/CalendarPage"));
const GroupsPage       = lazy(() => import("./pages/GroupsPage"));
const WorkoutPage      = lazy(() => import("./pages/WorkoutPage"));
const StudentHomePage  = lazy(() => import("./pages/StudentHomePage"));
const StudentStatsPage = lazy(() => import("./pages/StudentStatsPage"));
const StudentProfilePage = lazy(() => import("./pages/StudentProfilePage"));
const KioskPage        = lazy(() => import("./pages/KioskPage"));
const StatsPage        = lazy(() => import("./pages/StatsPage"));
const BlocksPage       = lazy(() => import("./pages/BlocksPage"));
const NotFound         = lazy(() => import("./pages/NotFound"));

// Global QueryClient configuration
// staleTime:5min  → navigating back within 5 min shows cached data instantly (no loading flash)
// gcTime:10min    → keeps unused queries in memory for 10 min so re-mounting is instant
// refetchOnWindowFocus:false → switching tabs/apps on mobile no longer triggers refetches
// retry:1         → fail fast on network errors rather than retrying 3 times
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
}

function ProtectedRoutes() {
  const { user, role, loading } = useAuth();

  if (loading || (user && role === null)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (role === "student") {
    return (
      <AppLayout>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/"       element={<StudentHomePage />} />
            <Route path="/stats"  element={<StudentStatsPage />} />
            <Route path="/profile" element={<StudentProfilePage />} />
            <Route path="*"       element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/"        element={<DashboardPage />} />
          <Route path="/exercises" element={<ExercisesPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/routines" element={<RoutinesPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/groups"  element={<GroupsPage />} />
          <Route path="/workout" element={<WorkoutPage />} />
          <Route path="/kiosk"   element={<KioskPage />} />
          <Route path="/stats"   element={<StatsPage />} />
          <Route path="/bloques" element={<BlocksPage />} />
          <Route path="*"        element={<NotFound />} />
        </Routes>
      </Suspense>
    </AppLayout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<AuthPageWrapper />} />
            <Route path="/*"     element={<ProtectedRoutes />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

function AuthPageWrapper() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return (
    <Suspense fallback={null}>
      <AuthPage />
    </Suspense>
  );
}

export default App;
