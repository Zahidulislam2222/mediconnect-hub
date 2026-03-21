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
import { isAuthenticated, clearAllSensitive, getUser } from "./lib/secure-storage";

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
import AdminStaffAuth from "./pages/AdminStaffAuth";
import NotFound from "./pages/NotFound";
import Billing from "./pages/Billing";
import PatientRecords from "./pages/PatientRecords";
import Prescriptions from "./pages/Prescriptions";
import LiveMonitoring from "./pages/LiveMonitoring";
import ClinicalTools from "./pages/ClinicalTools";

// Admin Pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminAuditLogs from "./pages/admin/AdminAuditLogs";
import AdminSystemHealth from "./pages/admin/AdminSystemHealth";
import AdminClosures from "./pages/admin/AdminClosures";

// Staff Pages
import StaffDashboard from "./pages/staff/StaffDashboard";
import StaffSchedule from "./pages/staff/StaffSchedule";
import StaffTasks from "./pages/staff/StaffTasks";
import StaffDirectory from "./pages/staff/StaffDirectory";

// Context Provider
import { CheckoutProvider } from "./context/CheckoutContext";

const Router = Capacitor.isNativePlatform() ? HashRouter : BrowserRouter;
const queryClient = new QueryClient();

// =========================================================================
// GDPR GUARD: Granular Cookie & Consent Banner (GDPR Art. 7)
// =========================================================================
interface GdprConsent {
  essential: boolean;
  functional: boolean;
  analytics: boolean;
  timestamp: string;
}

const getGdprConsent = (): GdprConsent | null => {
  try {
    const raw = localStorage.getItem('gdpr_consent');
    if (!raw) return null;
    if (raw === 'true') return { essential: true, functional: true, analytics: true, timestamp: new Date().toISOString() };
    return JSON.parse(raw);
  } catch { return null; }
};

const GdprBanner = () => {
  const [consent, setConsent] = useState<GdprConsent | null>(getGdprConsent());
  const [showCustomize, setShowCustomize] = useState(false);
  const [functional, setFunctional] = useState(true);
  const [analytics, setAnalytics] = useState(true);

  if (consent) return null;

  const saveConsent = (fn: boolean, an: boolean) => {
    const c: GdprConsent = { essential: true, functional: fn, analytics: an, timestamp: new Date().toISOString() };
    localStorage.setItem('gdpr_consent', JSON.stringify(c));
    setConsent(c);
    window.location.reload();
  };

  return (
    <div className="fixed bottom-0 w-full z-[9999]">
      <div className="mx-4 mb-4 sm:mx-6 sm:mb-6 max-w-2xl sm:ml-auto">
        <div className="rounded-2xl bg-foreground/95 backdrop-blur-xl text-background p-5 shadow-elevated border border-white/10">
          <p className="text-sm mb-4 text-background/80 leading-relaxed">
            We use cookies and process data strictly in your region to comply with GDPR & HIPAA.
            See our <a href="/privacy-policy" className="underline text-primary-foreground/90 hover:text-primary-foreground">Privacy Policy</a>.
          </p>
          {showCustomize ? (
            <div className="space-y-2.5 mb-4">
              <label className="flex items-center gap-2.5 text-sm">
                <input type="checkbox" checked disabled className="rounded accent-primary" />
                <span className="text-background/70">Essential (required for the app to function)</span>
              </label>
              <label className="flex items-center gap-2.5 text-sm cursor-pointer">
                <input type="checkbox" checked={functional} onChange={(e) => setFunctional(e.target.checked)} className="rounded accent-primary" />
                <span className="text-background/70">Functional (push notifications, real-time features)</span>
              </label>
              <label className="flex items-center gap-2.5 text-sm cursor-pointer">
                <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} className="rounded accent-primary" />
                <span className="text-background/70">Analytics (anonymized usage data)</span>
              </label>
            </div>
          ) : null}
          <div className="flex flex-col sm:flex-row gap-2">
            {!showCustomize && (
              <button onClick={() => setShowCustomize(true)} className="text-background/50 hover:text-background/80 text-sm font-medium mr-4 transition-colors">
                Customize
              </button>
            )}
            {showCustomize && (
              <button onClick={() => saveConsent(functional, analytics)} className="bg-background/10 hover:bg-background/20 px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors text-background">
                Accept Selected
              </button>
            )}
            <button onClick={() => saveConsent(true, true)} className="medical-gradient px-5 py-2.5 rounded-xl font-semibold text-sm text-white shadow-sm hover:shadow-glow transition-all">
              Accept All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// 📱 PUSH INITIALIZER (Fixed Role Routing Bug & Added GDPR Block)
// =========================================================================
const PushInitializer = () => {
  useEffect(() => {
    // GDPR Check: Do not initialize push without functional consent
    try {
      const consent = getGdprConsent();
      if (!consent?.functional) return;
    } catch { return; }
    if (!Capacitor.isNativePlatform()) return;

    const setupPush = async () => {
      let perm = await PushNotifications.checkPermissions();
      if (perm.receive === 'prompt') {
        perm = await PushNotifications.requestPermissions();
      }
      if (perm.receive !== 'granted') return;

      await PushNotifications.register();

      await PushNotifications.addListener('registration', async (token) => {
        // FCM token registered — not logged for HIPAA compliance
        const savedUser = getUser();
        if (savedUser) {
          const { id, role } = savedUser;
          // 🟢 BUG FIX: Prevent Doctor Tokens from being sent to Patient Table
          const endpoint = role === 'doctor' ? `/doctors/${id}` : `/patients/${id}`;
          await api.put(endpoint, { fcmToken: token.value }).catch(console.error);
        }
      });

      await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        // Notification tapped — navigate handled below
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

        // ─── SECURE STORAGE FIX: Use centralized cleanup ───
        clearAllSensitive();
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
// 🔒 ROLE GUARD: Prevents cross-role access (e.g., patient accessing admin)
// =========================================================================
const RoleGuard = ({ allowedRoles, children }: { allowedRoles: string[]; children: React.ReactNode }) => {
  const user = getUser();
  const role = user?.role?.toLowerCase() || '';
  if (!allowedRoles.includes(role)) {
    const fallback = role === 'doctor' ? '/doctor-dashboard'
                   : role === 'admin' ? '/admin/dashboard'
                   : role === 'staff' ? '/staff/dashboard'
                   : '/patient-dashboard';
    return <Navigate to={fallback} replace />;
  }
  return <>{children}</>;
};

// =========================================================================
// 🔒 ROUTE PROTECTOR: Blocks unauthenticated URL guessing + HIPAA session
// =========================================================================
const ProtectedRoute = () => {
  if (!isAuthenticated()) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <CheckoutProvider>
      <HipaaGuard>
        <Outlet />
      </HipaaGuard>
    </CheckoutProvider>
  );
};

// =========================================================================
// 🚦 MAIN ROUTER CONTENT
// =========================================================================
const AppContent = () => {
  return (
    <Routes>
      {/* PUBLIC ZONE — no HIPAA guard needed */}
      <Route path="/" element={<Index />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/admin-auth" element={<AdminStaffAuth />} />
      <Route path="/knowledge" element={<KnowledgeBase role="patient" />} />
      <Route path="/knowledge/:slug" element={<KnowledgeBasePost role="patient" />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/terms-of-service" element={<TermsOfService />} />
      <Route path="/hipaa-compliance" element={<HipaaCompliance />} />
      <Route path="/contact" element={<Contact />} />

      {/* PROTECTED ZONE — HipaaGuard applied inside ProtectedRoute */}
      <Route element={<ProtectedRoute />}>
        {/* Patient Features */}
        <Route path="/patient-dashboard" element={<RoleGuard allowedRoles={['patient']}><PatientDashboard /></RoleGuard>} />
        <Route path="/billing" element={<RoleGuard allowedRoles={['patient']}><Billing /></RoleGuard>} />
        <Route path="/appointments" element={<Appointments />} />
        <Route path="/consultation" element={<ConsultationRoom />} />
        <Route path="/symptom-checker" element={<RoleGuard allowedRoles={['patient']}><SymptomChecker /></RoleGuard>} />
        <Route path="/healthRecords" element={<RoleGuard allowedRoles={['patient']}><HealthRecords /></RoleGuard>} />
        <Route path="/pharmacy" element={<Pharmacy />} />
        <Route path="/pharmacy/scan" element={<PharmacyScanner />} />
        <Route path="/patient/messages" element={<RoleGuard allowedRoles={['patient']}><Messages /></RoleGuard>} />
        <Route path="/patient/settings" element={<RoleGuard allowedRoles={['patient']}><Settings /></RoleGuard>} />

        {/* Doctor Features */}
        <Route path="/doctor-dashboard" element={<RoleGuard allowedRoles={['doctor', 'practitioner']}><DoctorDashboard /></RoleGuard>} />
        <Route path="/patient-queue" element={<RoleGuard allowedRoles={['doctor', 'practitioner']}><PatientQueue /></RoleGuard>} />
        <Route path="/analytics" element={<RoleGuard allowedRoles={['doctor', 'practitioner']}><Analytics /></RoleGuard>} />
        <Route path="/doctor/messages" element={<RoleGuard allowedRoles={['doctor', 'practitioner']}><Messages /></RoleGuard>} />
        <Route path="/live-monitoring" element={<RoleGuard allowedRoles={['doctor', 'practitioner']}><LiveMonitoring /></RoleGuard>} />
        <Route path="/doctor/settings" element={<RoleGuard allowedRoles={['doctor', 'practitioner']}><Settings /></RoleGuard>} />
        <Route path="/patient-records" element={<RoleGuard allowedRoles={['doctor', 'practitioner']}><PatientRecords /></RoleGuard>} />
        <Route path="/prescriptions" element={<RoleGuard allowedRoles={['doctor', 'practitioner']}><Prescriptions /></RoleGuard>} />
        <Route path="/clinical-tools" element={<RoleGuard allowedRoles={['doctor', 'practitioner']}><ClinicalTools /></RoleGuard>} />
        <Route path="/doctor/knowledge" element={<RoleGuard allowedRoles={['doctor', 'practitioner']}><KnowledgeBase /></RoleGuard>} />
        <Route path="/doctor/knowledge/:slug" element={<RoleGuard allowedRoles={['doctor', 'practitioner']}><KnowledgeBasePost /></RoleGuard>} />

        {/* Admin Features */}
        <Route path="/admin/dashboard" element={<RoleGuard allowedRoles={['admin']}><AdminDashboard /></RoleGuard>} />
        <Route path="/admin/users" element={<RoleGuard allowedRoles={['admin']}><AdminUsers /></RoleGuard>} />
        <Route path="/admin/closures" element={<RoleGuard allowedRoles={['admin']}><AdminClosures /></RoleGuard>} />
        <Route path="/admin/audit-logs" element={<RoleGuard allowedRoles={['admin']}><AdminAuditLogs /></RoleGuard>} />
        <Route path="/admin/system" element={<RoleGuard allowedRoles={['admin']}><AdminSystemHealth /></RoleGuard>} />

        {/* Staff Features */}
        <Route path="/staff/dashboard" element={<RoleGuard allowedRoles={['staff']}><StaffDashboard /></RoleGuard>} />
        <Route path="/staff/schedule" element={<RoleGuard allowedRoles={['staff']}><StaffSchedule /></RoleGuard>} />
        <Route path="/staff/tasks" element={<RoleGuard allowedRoles={['staff']}><StaffTasks /></RoleGuard>} />
        <Route path="/staff/directory" element={<RoleGuard allowedRoles={['staff']}><StaffDirectory /></RoleGuard>} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<NotFound />} />
    </Routes>
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