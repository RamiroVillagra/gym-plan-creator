import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "@/components/AppLayout";
import DashboardPage from "./pages/DashboardPage";
import ExercisesPage from "./pages/ExercisesPage";
import ClientsPage from "./pages/ClientsPage";
import RoutinesPage from "./pages/RoutinesPage";
import CalendarPage from "./pages/CalendarPage";
import WorkoutPage from "./pages/WorkoutPage";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/exercises" element={<ExercisesPage />} />
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/routines" element={<RoutinesPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/workout" element={<WorkoutPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
