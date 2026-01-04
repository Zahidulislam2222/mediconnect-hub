import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import PatientDashboard from "./pages/PatientDashboard";
import DoctorDashboard from "./pages/DoctorDashboard";
import ConsultationRoom from "./pages/ConsultationRoom";
import SymptomChecker from "./pages/SymptomChecker";
import HealthRecords from "./pages/HealthRecords";
import Pharmacy from "./pages/Pharmacy";
import KnowledgeBase from "./pages/KnowledgeBase";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<PatientDashboard />} />
          <Route path="/doctor-dashboard" element={<DoctorDashboard />} />
          <Route path="/consultation" element={<ConsultationRoom />} />
          <Route path="/symptom-checker" element={<SymptomChecker />} />
          <Route path="/records" element={<HealthRecords />} />
          <Route path="/pharmacy" element={<Pharmacy />} />
          <Route path="/knowledge" element={<KnowledgeBase />} />
          <Route path="/appointments" element={<PatientDashboard />} />
          <Route path="/patient-queue" element={<DoctorDashboard />} />
          <Route path="/analytics" element={<DoctorDashboard />} />
          <Route path="/patient-records" element={<HealthRecords />} />
          <Route path="/messages" element={<PatientDashboard />} />
          <Route path="/settings" element={<PatientDashboard />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
