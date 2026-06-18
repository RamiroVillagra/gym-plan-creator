import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ConfirmProvider } from "@/components/ConfirmDialog";
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
// staleTime:0     → data is immediately stale; always background-refetches on mount
//                   (safe for real-time training data — logs, kiosk sessions, etc.)
// gcTime:5min     → keeps unused queries in memory for 5 min so re-navigating shows
//                   cached data instantly while the background refetch completes
// refetchOnWindowFocus:false → switching tabs/apps on mobile no longer triggers extra refetches
// retry:1         → fail fast on network errors rather than retrying 3 times
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: 5 * 60 * 1000,
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

  // Show spinner while initial load OR while role is still being fetched
  // (role === undefined means the DB fetch is in flight — prevents flashing
  // the coach dashboard before the student role is confirmed)
  if (loading || (user && role === undefined)) {
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
        <ConfirmProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<AuthPageWrapper />} />
              <Route path="/*"     element={<ProtectedRoutes />} />
            </Routes>
          </BrowserRouter>
        </ConfirmProvider>
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
