import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route, Outlet, Navigate, useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { useEffect, useState } from "react";
import { PushNotifications } from '@capacitor/push-notifications';
import { api } from "./lib/api";
import { signOut } from 'aws-amplify/auth';

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

// =========================================================================
// 🇪🇺 GDPR GUARD: Cookie & Consent Banner
// =========================================================================
const GdprBanner = () => {
  const [consent, setConsent] = useState(localStorage.getItem('gdpr_consent') === 'true');
  if (consent) return null;

  return (
    <div className="fixed bottom-0 w-full bg-slate-900 text-white p-4 z-[9999] flex flex-col sm:flex-row justify-between items-center shadow-lg">
      <p className="text-sm mb-3 sm:mb-0">
        We use cookies and process data strictly in your region to comply with GDPR & HIPAA. 
        By using this app, you agree to our Privacy Policy.
      </p>
      <button 
        onClick={() => { 
          localStorage.setItem('gdpr_consent', 'true'); 
          setConsent(true); 
          window.location.reload(); // Reload to initialize PushNotifications safely
        }}
        className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded-md font-semibold text-sm transition-colors"
      >
        I Accept
      </button>
    </div>
  );
};

// =========================================================================
// 📱 PUSH INITIALIZER (Fixed Role Routing Bug & Added GDPR Block)
// =========================================================================
const PushInitializer = () => {
  useEffect(() => {
    // GDPR Check: Do not initialize trackers without consent
    if (localStorage.getItem('gdpr_consent') !== 'true') return;
    if (!Capacitor.isNativePlatform()) return;

    const setupPush = async () => {
      let perm = await PushNotifications.checkPermissions();
      if (perm.receive === 'prompt') {
        perm = await PushNotifications.requestPermissions();
      }
      if (perm.receive !== 'granted') return;

      await PushNotifications.register();

      await PushNotifications.addListener('registration', async (token) => {
        console.log('FCM Token:', token.value);
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
          const { id, role } = JSON.parse(savedUser);
          // 🟢 BUG FIX: Prevent Doctor Tokens from being sent to Patient Table
          const endpoint = role === 'doctor' ? `/doctors/${id}` : `/patients/${id}`;
          await api.put(endpoint, { fcmToken: token.value }).catch(console.error);
        }
      });

      await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('Notification tapped:', notification.notification);
      });
    };

    setupPush();
  }, []);

  return null;
};

// =========================================================================
// 🏥 HIPAA GUARD: 15-Min Auto-Logout & Tab Blur Visual Privacy
// =========================================================================
const HipaaGuard = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const [isBlurred, setIsBlurred] = useState(false);

  // 1. Tab Blur (Visual Privacy)
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsBlurred(document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // 2. 15-Minute Auto Logout (Session Security)
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const INACTIVITY_LIMIT = 15 * 60 * 1000; // 15 minutes

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => { // 🟢 Make this async
        try {
          // 🟢 CRITICAL FIX: Tell AWS to end the session
          await signOut(); 
          console.log("HIPAA Auto-Logout Triggered");
        } catch (error) {
          console.error("Error signing out:", error);
        }

        // Clear all sensitive data
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        localStorage.removeItem('userRegion');
        
        // Redirect
        navigate('/auth', { replace: true, state: { message: 'Session expired due to inactivity (HIPAA).' } });
      }, INACTIVITY_LIMIT);
    };

    const events = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'];
    events.forEach(event => window.addEventListener(event, resetTimer));
    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [navigate]);

  return (
    <div style={{ 
      filter: isBlurred ? 'blur(12px)' : 'none', 
      transition: 'filter 0.3s ease-in-out',
      minHeight: '100vh'
    }}>
      {children}
    </div>
  );
};

// =========================================================================
// 🔒 ROUTE PROTECTOR: Blocks unauthenticated URL guessing
// =========================================================================
const ProtectedRoute = () => {
  const token = localStorage.getItem('access_token');
  
  if (!token) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <CheckoutProvider>
      <Outlet />
    </CheckoutProvider>
  );
};

// =========================================================================
// 🚦 MAIN ROUTER CONTENT
// =========================================================================
const AppContent = () => {
  return (
    <HipaaGuard>
      <Routes>
        {/* PUBLIC ZONE */}
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/knowledge" element={<KnowledgeBase role="patient" />} />
        <Route path="/knowledge/:slug" element={<KnowledgeBasePost role="patient" />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-of-service" element={<TermsOfService />} />
        <Route path="/hipaa-compliance" element={<HipaaCompliance />} />
        <Route path="/contact" element={<Contact />} />

        {/* PROTECTED ZONE */}
        <Route element={<ProtectedRoute />}>
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
    </HipaaGuard>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <GdprBanner />
      <PushInitializer />
      <Toaster />
      <Sonner />
      <Router>
        <AppContent />
      </Router>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;