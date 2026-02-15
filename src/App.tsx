import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route, Outlet } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { useEffect } from "react"; // Ensure this is imported
import { PushNotifications } from '@capacitor/push-notifications'; // 🟢 ADD THIS
import { api } from "./lib/api";

// Page Imports
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
import Billing from "./pages/Billing";
import PatientRecords from "./pages/PatientRecords";
import Prescriptions from "./pages/Prescriptions";
import LiveMonitoring from "./pages/LiveMonitoring";

// Context Provider
import { CheckoutProvider } from "./context/CheckoutContext";

const Router = Capacitor.isNativePlatform() ? HashRouter : BrowserRouter;
const queryClient = new QueryClient();

const PushInitializer = () => {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const setupPush = async () => {
      let perm = await PushNotifications.checkPermissions();

      if (perm.receive === 'prompt') {
        perm = await PushNotifications.requestPermissions();
      }

      if (perm.receive !== 'granted') return;

      await PushNotifications.register();

      // Listen for the token
      await PushNotifications.addListener('registration', async (token) => {
        console.log('FCM Token:', token.value);
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
          const { id } = JSON.parse(savedUser);
          // 🟢 Save token to DB via your existing update route
          await api.put(`/patients/${id}`, { fcmToken: token.value });
        }
      });

      // Handle notification clicks
      await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('Notification tapped:', notification.notification);
      });
    };

    setupPush();
  }, []);

  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <PushInitializer />
      <Toaster />
      <Sonner />
      <Router>
        <Routes>
          {/* ========================================================= */}
          {/* 🌍 PUBLIC ZONE - NO STRIPE / NO LOGIN REQUIRED           */}
          {/* ========================================================= */}
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />

          {/* Educational Content (Independent of Stripe/Auth) */}
          <Route path="/knowledge" element={<KnowledgeBase role="patient" />} />
          <Route path="/knowledge/:slug" element={<KnowledgeBasePost role="patient" />} />

          {/* Static Pages */}
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/hipaa-compliance" element={<HipaaCompliance />} />
          <Route path="/contact" element={<Contact />} />

          {/* ========================================================= */}
          {/* 🔒 PROTECTED ZONE - WRAPPED IN CHECKOUTPROVIDER         */}
          {/* ========================================================= */}
          {/* 
              We use an Outlet here. This allows child pages to handle 
              their own DashboardLayout props while staying inside the Stripe context.
          */}
          <Route
            element={
              <CheckoutProvider>
                <Outlet />
              </CheckoutProvider>
            }
          >
            {/* Patient Features */}
            <Route path="/patient-dashboard" element={<PatientDashboard />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/appointments" element={<Appointments />} />
            <Route path="/consultation" element={<ConsultationRoom />} />
            <Route path="/symptom-checker" element={<SymptomChecker />} />
            <Route path="/healthRecords" element={<HealthRecords />} />
            <Route path="/pharmacy" element={<Pharmacy />} />
            <Route path="/patient/messages" element={<Messages />} />
            <Route path="/patient/settings" element={<Settings />} />

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
          </Route>

          {/* Pharmacy Features */}
          <Route path="/pharmacy/scan" element={<PharmacyScanner />} />

          {/* Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;