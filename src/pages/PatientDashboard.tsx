import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut, getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';
import {
  Heart, Activity, Droplets, Wind,
  Calendar, Brain, Pill,
  CreditCard, ShieldCheck,
  Loader2
} from "lucide-react";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { VitalCard } from "@/components/dashboard/VitalCard";
import { AppointmentCard } from "@/components/dashboard/AppointmentCard";
import { ActionButton } from "@/components/dashboard/ActionButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// --- STRICT TYPES FOR COMPONENTS ---
type VitalStatus = "normal" | "warning" | "critical" | "excellent";
type AppointmentStatus = "scheduled" | "upcoming" | "completed";
type AppointmentType = "Video Call" | "In-Person";

export default function PatientDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();

  // --- STATE ---
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  // Data State
  const [doctors, setDoctors] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [billing, setBilling] = useState<any>(null);
  const [realVitals, setRealVitals] = useState<any>(null);

  // --- AUTH HELPER (From Appointments.tsx) ---
  const getAuthToken = async () => {
    try {
      const session = await fetchAuthSession();
      return session.tokens?.idToken?.toString() || "";
    } catch (e) {
      console.error("Token error", e);
      return "";
    }
  };

  // --- DATA LOADING ---
  useEffect(() => {
    async function loadDashboardData() {
      try {
        const token = await getAuthToken();
        const user = await getCurrentUser();
        const userId = user.userId;

        // 1. Fetch Doctor Directory (For Smart Name/Specialty Lookups)
        try {
          const docRes = await fetch(`${API_BASE_URL}/doctors`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const docData = await docRes.json();

          if (docData.doctors) setDoctors(docData.doctors);
        } catch (e) {
          console.warn("Could not load doctor directory", e);
        }

        // 2. Fetch Patient Data
        const results = await Promise.allSettled([
          fetch(`${API_BASE_URL}/register-patient?id=${userId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch(`${API_BASE_URL}/doctor-appointments?patientId=${userId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch(`${API_BASE_URL}/billing?patientId=${userId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch(`${API_BASE_URL}/vitals?patientId=${userId}&limit=1`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        const [profileRes, apptRes, billRes, vitalRes] = results;

        // A. Profile
        if (profileRes.status === 'fulfilled' && profileRes.value.ok) {
          const data = await profileRes.value.json();
          const userData = data.Item || data;
          setProfile(userData);

          // Sync local storage so Layout picks it up on refresh
          const localUser = JSON.parse(localStorage.getItem('user') || '{}');
          if (userData.name) localUser.name = userData.name;
          if (userData.avatar) localUser.avatar = userData.avatar;
          localStorage.setItem('user', JSON.stringify(localUser));
        }

        // B. Appointments
        if (apptRes.status === 'fulfilled' && apptRes.value.ok) {
          const data = await apptRes.value.json();
          const list = Array.isArray(data) ? data : [];
          // Sort: Soonest first
          const active = list
            .filter((a: any) => a.status !== 'CANCELLED')
            .sort((a: any, b: any) => new Date(a.timeSlot || a.date).getTime() - new Date(b.timeSlot || b.date).getTime());
          setAppointments(active);
        }

        // C. Billing
        if (billRes.status === 'fulfilled' && billRes.value.ok) {
          const data = await billRes.value.json();
          setBilling(data);
        }

        // D. Vitals
        if (vitalRes.status === 'fulfilled' && vitalRes.value.ok) {
          const data = await vitalRes.value.json();
          if (Array.isArray(data) && data.length > 0) {
            setRealVitals(data[0]);
          }
        }

      } catch (error) {
        console.error("Dashboard Load Error:", error);
        toast({ title: "Error", description: "Failed to load dashboard data", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, [toast]);

  const handleLogout = async () => {
    try {
      await signOut();
      localStorage.removeItem('user');
      navigate("/auth");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // --- HELPERS (STRICT UI LOGIC) ---

  const getDoctorDetails = (appt: any) => {
    // Cross-reference doctorId with the directory to get clean names/specialties
    const directoryDoc = doctors.find(d => d.doctorId === appt.doctorId);
    return {
      name: directoryDoc?.name || appt.doctorName || "Medical Provider",
      specialty: directoryDoc?.specialization || appt.specialization || "General Practice",
      // Pass null/empty string if no avatar, allowing Component to handle fallback
      avatar: directoryDoc?.avatar || ""
    };
  };

  // Maps backend enum to "Video Call" | "In-Person"
  const getApptType = (type: string): AppointmentType => {
    if (type === 'IN_PERSON') return "In-Person";
    return "Video Call";
  };

  // Maps backend enum to "scheduled" | "upcoming" | "completed"
  const getApptStatus = (status: string): AppointmentStatus => {
    if (status === 'COMPLETED') return "completed";
    if (status === 'PENDING') return "upcoming";
    return "scheduled";
  };

  // Maps vital number to "normal" | "warning" | "critical"
  const getHeartRateStatus = (hr: number): VitalStatus => {
    if (!hr) return "normal";
    if (hr > 100) return "critical";
    if (hr > 90) return "warning";
    return "normal";
  };

  const formatCurrency = (amount: any) => {
    if (typeof amount === 'number') return amount.toFixed(2);
    if (typeof amount === 'string') return parseFloat(amount).toFixed(2);
    return "0.00";
  };

  // --- UI PREPARATION ---
  const displayName = profile?.name || "Patient";
  // STRICT FIX: Do not use external API. Pass existing avatar or empty string.
  // DashboardLayout will render the Blue "ZA" circle automatically.
  const displayAvatar = profile?.avatar || "";

  return (
    <DashboardLayout
      title={loading ? "Loading..." : `Welcome, ${displayName}`}
      subtitle="Here's an overview of your health today"
      userRole="patient"
      userName={displayName}
      userAvatar={displayAvatar}
      onLogout={handleLogout}
    >
      <div className="space-y-6 animate-fade-in">

        {/* 1. VITALS & BILLING GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">

          {/* Vitals Section */}
          <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

            {/* Real Heart Rate */}
            <div
              className="cursor-pointer transition-transform hover:scale-[1.02]"
              onClick={() => navigate(`/live-monitoring?patientId=${profile?.userId || profile?.id}`)}
            >
              <VitalCard
                title="Heart Rate"
                value={realVitals?.heartRate ? String(realVitals.heartRate) : "--"}
                unit="bpm"
                status={getHeartRateStatus(realVitals?.heartRate)}
                change={realVitals ? "Live" : "No Signal"}
                // Fallback array for chart strictly number[]
                trend={[70, 72, 71, 73, 72, 70, realVitals?.heartRate || 70]}
                icon={<Heart className="h-5 w-5" />}
                color="red"
              />
            </div>

            {/* Static Vitals for UI completeness */}
            <VitalCard
              title="Blood Pressure"
              value="120/80"
              unit="mmHg"
              status="normal"
              change="Stable"
              trend={[118, 120, 119, 121, 120, 120, 120]}
              icon={<Activity className="h-5 w-5" />}
              color="blue"
            />
            <VitalCard
              title="Blood Glucose"
              value="95"
              unit="mg/dL"
              status="normal"
              change="+2%"
              trend={[92, 94, 95, 96, 95, 94, 95]}
              icon={<Droplets className="h-5 w-5" />}
              color="purple"
            />
            <VitalCard
              title="SpO2"
              value="98"
              unit="%"
              status="excellent"
              change="Stable"
              trend={[97, 98, 98, 99, 98, 98, 98]}
              icon={<Wind className="h-5 w-5" />}
              color="teal"
            />
          </div>

          {/* Billing Widget */}
          <Card className="shadow-card border-border/50 bg-white h-full flex flex-col justify-between">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CreditCard className="h-4 w-4" /> Billing Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div>
                  <div className="text-3xl font-bold text-foreground mb-1">
                    ${formatCurrency(billing?.outstandingBalance)}
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">Outstanding Balance</p>

                  <div className={`flex items-center gap-2 p-2 rounded-md text-xs font-medium mb-4 ${billing?.insuranceStatus === 'Active' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                    <ShieldCheck className="h-3 w-3" />
                    {billing?.insuranceProvider || "No Insurance"} ({billing?.insuranceStatus || "Inactive"})
                  </div>

                  <button
                    onClick={() => navigate("/billing")}
                    className="w-full text-xs bg-primary text-primary-foreground py-2.5 rounded-md hover:bg-primary/90 transition-colors font-medium"
                  >
                    View Billing History
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* 2. APPOINTMENTS LIST */}
          <Card className="lg:col-span-2 shadow-card border-border/50">
            <CardHeader className="pb-3 border-b mb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" /> Upcoming Appointments
                </CardTitle>
                <button onClick={() => navigate("/appointments")} className="text-sm text-primary hover:underline font-medium">
                  View all
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-1">
              {loading ? (
                <div className="flex flex-col gap-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-4 p-4 border rounded-xl bg-muted/5">
                      <div className="h-12 w-12 rounded-full bg-muted animate-pulse" />
                      <div className="space-y-2 flex-1">
                        <div className="h-4 w-1/3 bg-muted animate-pulse rounded" />
                        <div className="h-3 w-1/4 bg-muted animate-pulse rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : appointments.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground bg-muted/10 rounded-lg border border-dashed">
                  <Calendar className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p className="font-medium">No upcoming appointments.</p>
                  <p className="text-sm mb-4">Book a visit to get started.</p>
                  <button onClick={() => navigate("/appointments")} className="text-primary text-sm font-semibold hover:underline">
                    Book Now &rarr;
                  </button>
                </div>
              ) : (
                appointments.slice(0, 3).map((apt) => {
                  const dateObj = new Date(apt.timeSlot || apt.date);
                  const details = getDoctorDetails(apt);
                  const uiStatus = getApptStatus(apt.status || "CONFIRMED");
                  const uiType = getApptType(apt.type || "VIDEO");

                  return (
                    <AppointmentCard
                      key={apt.appointmentId}
                      doctor={details.name}
                      specialty={details.specialty}
                      date={dateObj.toLocaleDateString()}
                      time={dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      type={uiType}
                      // Strictly pass empty string if null, allowing card to render initials
                      avatar={details.avatar || ""}
                      status={uiStatus}
                      onJoin={() => {
                        if (uiType === 'In-Person') {
                          alert("This is an in-person visit. Please go to the clinic.");
                        } else {
                          navigate("/consultation");
                        }
                      }}
                    />
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* 3. QUICK ACTIONS */}
          <Card className="shadow-card border-border/50 h-fit">
            <CardHeader className="pb-3 border-b mb-3">
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 pt-1">
              <ActionButton
                icon={<Calendar className="h-5 w-5" />}
                label="Book"
                description="Appointment"
                onClick={() => navigate("/appointments")}
                variant="primary"
              />
              <ActionButton
                icon={<Brain className="h-5 w-5" />}
                label="Check"
                description="Symptoms"
                onClick={() => navigate("/symptom-checker")}
                variant="accent"
              />
              <ActionButton
                icon={<Pill className="h-5 w-5" />}
                label="Refill"
                description="Prescription"
                onClick={() => navigate("/pharmacy")}
              />
              <ActionButton
                icon={<Activity className="h-5 w-5" />}
                label="Monitor"
                description="Live Vitals"
                onClick={() => navigate(`/live-monitoring?patientId=${profile?.userId || profile?.id}`)}
              />
            </CardContent>
          </Card>
        </div>

        {/* 4. MARKETING BANNER */}
        <Card className="medical-gradient text-white shadow-elevated border-0 overflow-hidden relative group cursor-pointer"
          onClick={() => navigate(`/live-monitoring?patientId=${profile?.userId}`)}
        >
          <CardContent className="py-8 relative z-10">
            <div className="absolute right-0 top-0 w-64 h-full opacity-10 transition-transform group-hover:scale-110 duration-700">
              <svg viewBox="0 0 200 200" className="w-full h-full">
                <path fill="currentColor" d="M100,10 L120,40 L160,40 L130,60 L140,100 L100,80 L60,100 L70,60 L40,40 L80,40 Z" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                <Activity className="h-5 w-5 text-white/90" /> Monitor Your Health Real-Time
              </h3>
              <p className="text-white/90 text-sm max-w-lg leading-relaxed">
                Connect your wearable device or use our live tracking tools to keep your heart rate and vitals monitored instantly on this dashboard.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}