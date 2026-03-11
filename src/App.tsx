import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import ExercisesPage from "./pages/ExercisesPage";
import ClientsPage from "./pages/ClientsPage";
import RoutinesPage from "./pages/RoutinesPage";
import CalendarPage from "./pages/CalendarPage";
import GroupsPage from "./pages/GroupsPage";
import WorkoutPage from "./pages/WorkoutPage";
import KioskPage from "./pages/KioskPage";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { user, role, loading } = useAuth();

  if (loading) {
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
        <Routes>
          <Route path="/" element={<WorkoutPage />} />
          <Route path="/workout" element={<WorkoutPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/exercises" element={<ExercisesPage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/routines" element={<RoutinesPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/groups" element={<GroupsPage />} />
        <Route path="/workout" element={<WorkoutPage />} />
        <Route path="/kiosk" element={<KioskPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
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
            <Route path="/*" element={<ProtectedRoutes />} />
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
  return <AuthPage />;
}

export default App;
