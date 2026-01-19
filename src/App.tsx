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
import PharmacyScanner from "./pages/pharmacy/PharmacyScanner";
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
import { DashboardLayout } from './components/layout/DashboardLayout';
import Billing from "./pages/Billing";
import PatientRecords from "./pages/PatientRecords";
import Prescriptions from "./pages/Prescriptions";
import LiveMonitoring from "./pages/LiveMonitoring";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* ========================================================= */}
          {/* 🌍 PUBLIC ZONE - NO LOGIN REQUIRED                      */}
          {/* ========================================================= */}
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />

          {/* FIXED: Knowledge Base is now here, so it WON'T ask for login */}
          <Route path="/knowledge" element={<KnowledgeBase role="patient" />} />
          <Route path="/knowledge/:slug" element={<KnowledgeBasePost role="patient" />} />

          {/* Static Pages */}
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/hipaa-compliance" element={<HipaaCompliance />} />
          <Route path="/contact" element={<Contact />} />

          {/* ========================================================= */}
          {/* 🔒 PROTECTED ZONE - REQUIRES LOGIN + SIDEBAR            */}
          {/* ========================================================= */}
          {/* Patient Features */}
          <Route path="/dashboard" element={<PatientDashboard />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/appointments" element={<Appointments />} />
          <Route path="/consultation" element={<ConsultationRoom />} />
          <Route path="/symptom-checker" element={<SymptomChecker />} />
          <Route path="/healthRecords" element={<HealthRecords />} />
          <Route path="/pharmacy" element={<Pharmacy />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/settings" element={<Settings />} />

          {/* Doctor Features */}
          <Route path="/doctor-dashboard" element={<DoctorDashboard />} />
          <Route path="/patient-queue" element={<PatientQueue />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/doctor/messages" element={<Messages />} />
          <Route path="/live-monitoring" element={<LiveMonitoring />} />
          <Route path="/doctor/settings" element={<Settings />} />
          <Route path="/patient-records" element={<PatientRecords />} />
          <Route path="/prescriptions" element={<Prescriptions />} />
          <Route path="/doctor/knowledge" element={<KnowledgeBase />} />
          <Route path="/doctor/knowledge/:slug" element={<KnowledgeBasePost />} />

          {/* Pharmacy Features */}
          <Route path="/pharmacy/scan" element={<PharmacyScanner />} />

          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
