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
import KnowledgeBasePost from "./pages/KnowledgeBasePost";
import Appointments from "./pages/Appointments";
import Messages from "./pages/Messages";
import Settings from "./pages/Settings";
import PatientQueue from "./pages/PatientQueue";
import Analytics from "./pages/Analytics";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import HipaaCompliance from "./pages/HipaaCompliance";
import Contact from "./pages/Contact";
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

          {/* Knowledge Base */}
          <Route path="/knowledge" element={<KnowledgeBase role="patient" />} />
          <Route path="/knowledge/:slug" element={<KnowledgeBasePost role="patient" />} />
          <Route path="/doctor/knowledge" element={<KnowledgeBase role="doctor" />} />
          <Route path="/doctor/knowledge/:slug" element={<KnowledgeBasePost role="doctor" />} />

          <Route path="/appointments" element={<Appointments />} />
          <Route path="/messages" element={<Messages role="patient" />} />
          <Route path="/doctor/messages" element={<Messages role="doctor" />} />

          {/* Settings */}
          <Route path="/settings" element={<Settings role="patient" />} />
          <Route path="/doctor/settings" element={<Settings role="doctor" />} />

          <Route path="/patient-queue" element={<PatientQueue />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/patient-records" element={<HealthRecords role="patient" />} />
          <Route path="/doctor/patient-records" element={<HealthRecords role="doctor" />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/hipaa-compliance" element={<HipaaCompliance />} />
          <Route path="/contact" element={<Contact />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
