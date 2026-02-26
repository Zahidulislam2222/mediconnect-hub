import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut, getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';
import {
  Heart, Activity, Droplets, Wind,
  Calendar, Brain, Pill,
  CreditCard,
  Loader2,
  Video,
  MapPin
} from "lucide-react";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { VitalCard } from "@/components/dashboard/VitalCard";
import { ActionButton } from "@/components/dashboard/ActionButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

// --- AUTH HELPER ---
const getAuthToken = async () => {
  try {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString() || "";
  } catch (e) {
    console.error("Token error", e);
    return "";
  }
};

// 🟢 Helper: Smart Initials
const getInitials = (name: string) => {
  if (!name) return "DR";
  const cleanName = name.replace("Dr. ", "");
  return cleanName.substring(0, 2).toUpperCase();
}

export default function PatientDashboard() {
  const navigate = useNavigate();

  // --- STATE ---
  const [hasToday, setHasToday] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) { return null; }
  });

  // Data State
  const [doctors, setDoctors] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [billing, setBilling] = useState<any>(null);
  const [realVitals, setRealVitals] = useState<any>(null);

  // --- DATA LOADING ---
  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      // 🟢 1. STRICT AUTH CHECK: Catch fake demo tokens
      let userId = "";
      try {
        const token = await getAuthToken();
        const user = await getCurrentUser();
        userId = user.userId;
      } catch (authError) {
        console.warn("Invalid AWS Session. Purging demo state and logging out.");
        localStorage.clear();
        navigate("/auth");
        return;
      }

      // 2. Fetch Doctor Directory (Essential for Avatars)
      try {
        const docData: any = await api.get('/doctors');
        if (docData.doctors) setDoctors(docData.doctors);
        else if (Array.isArray(docData)) setDoctors(docData);
      } catch (e) { console.warn("Doc Dir Error", e); }

      // 3. Fetch Patient Data Parallel
      const results = await Promise.allSettled([
        api.get(`/patients/${userId}`),
        api.get(`/appointments?patientId=${userId}`),
        api.get(`/billing?patientId=${userId}`),
        api.get(`/vitals?patientId=${userId}&limit=1`)
      ]);

      const [profileRes, apptRes, billRes, vitalRes] = results;

      // A. Profile Logic
      if (profileRes.status === 'fulfilled') {
        const data: any = profileRes.value;
        // Handle DynamoDB Item structure
        const userData = data.Item || data;

        if (userData) {
          setProfile(userData);
          // Update local storage so Header doesn't flicker next time
          const currentLocal = JSON.parse(localStorage.getItem('user') || '{}');
          localStorage.setItem('user', JSON.stringify({ ...currentLocal, ...userData }));
        }
      }

      // B. Appointments (STRICT FILTER & SMART CONTEXT)
      if (apptRes.status === 'fulfilled') {
        const data: any = apptRes.value;
        let list = Array.isArray(data) ? data : (data.existingBookings || []);

        const now = new Date();
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);

        const seenIds = new Set();
        const allValid = list
          .filter((a: any) => {
            // HYBRID READ: Support both FHIR and Legacy
            const timeSlot = a.resource?.start || a.timeSlot;
            const patientName = a.patientName || a.resource?.participant?.find((p: any) => p.actor?.reference?.includes('Patient'))?.actor?.display;

            if (!timeSlot) return false;
            if (seenIds.has(a.appointmentId)) return false;
            seenIds.add(a.appointmentId);
            
            const status = a.status || a.resource?.status;
            if (['CANCELLED', 'COMPLETED', 'REJECTED', 'cancelled', 'fulfilled'].includes(status)) return false;

            const aptDate = new Date(timeSlot);
            // Show if it hasn't happened yet, or started in the last 60 mins
            return aptDate >= new Date(now.getTime() - 60 * 60000);
          })
          .sort((a: any, b: any) => {
            const tA = a.resource?.start || a.timeSlot;
            const tB = b.resource?.start || b.timeSlot;
            return new Date(tA).getTime() - new Date(tB).getTime();
          });

        // Check if anything in the list is actually for TODAY
        const todayOnly = allValid.filter((a: any) => {
          const timeSlot = a.resource?.start || a.timeSlot;
          return new Date(timeSlot) <= endOfToday;
        });

        setHasToday(todayOnly.length > 0);

        // If nothing today, show the next 3 upcoming ones. Otherwise, show today's list.
        const displayList = todayOnly.length > 0 ? todayOnly : allValid.slice(0, 3);
        setAppointments(displayList);
      }

      // C. Billing
      if (billRes.status === 'fulfilled') {
        const data: any = billRes.value;
        setBilling(data);
      }

      // D. Vitals
      if (vitalRes.status === 'fulfilled') {
        const vData: any = vitalRes.value;
        if (Array.isArray(vData) && vData.length > 0) setRealVitals(vData[0]);
      }

    } catch (error: any) {
        console.error("Load Error:", error);
        const msg = error?.message || String(error);
        
        // ONLY log out if the backend explicitly says you are unauthorized/deleted
        if (msg.includes('401') || msg.includes('403') || msg.includes('404')) {
            localStorage.clear();
            navigate("/auth");
        }
    } finally {
      setLoading(false);
    }
  }

  // --- LOGIC HELPERS ---

  // 🟢 Handle Join Logic (Matches booking.controller.ts)
  const handleJoin = async (apt: any) => {
    try {
      await api.put('/appointments', {
        appointmentId: apt.appointmentId,
        status: apt.status, // Keep status as is
        patientArrived: true // Critical Signal for Doctor Dashboard
      });
    } catch (e) { console.error("Check-in error", e); }

    navigate(`/consultation?appointmentId=${apt.appointmentId}&patientName=${encodeURIComponent(profile?.name || "Patient")}`);
  };

  // 🟢 Get Doctor Details (Matches Directory)
  const getDoctorDetails = (apt: any) => {
    // Find the doctor in the directory we fetched
    const directoryDoc = doctors.find(d => d.doctorId === apt.doctorId);
    
    // Prioritize the directory avatar (signed URL) -> then Appointment Snapshot -> then Null
    let avatarUrl = directoryDoc?.avatar || apt.doctorAvatar;
if (avatarUrl && !avatarUrl.startsWith('http')) {
    avatarUrl = undefined;
}

    return {
      name: directoryDoc?.name || apt.doctorName || "Medical Provider",
      specialty: directoryDoc?.specialization || apt.specialization || "General Practice",
      avatar: avatarUrl
    };
  };

  return (
    <DashboardLayout
      title={loading ? "Loading..." : `Welcome, ${profile?.name || "Patient"}`}
      subtitle="Here's an overview of your health today"
      userRole="patient"
      userName={profile?.name || "Patient"}
      userAvatar={profile?.avatar || ""}
      onLogout={async () => {
        await signOut();
        localStorage.clear();
        window.location.href = "/";
      }}
    >
      <div className="space-y-6 animate-fade-in">

        {/* 1. VITALS & BILLING GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">

          {/* Vitals Section */}
          <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              className="cursor-pointer transition-transform hover:scale-[1.02]"
              onClick={() => navigate(`/live-monitoring?patientId=${profile?.patientId}`)}
            >
              <VitalCard
                title="Heart Rate"
                value={realVitals?.heartRate ? String(realVitals.heartRate) : "--"}
                unit="bpm"
                status={realVitals?.heartRate > 100 ? "critical" : "normal"}
                change={realVitals ? "Live" : "No Signal"}
                trend={[70, 72, 71, 73, 72, 70, realVitals?.heartRate || 70]}
                icon={<Heart className="h-5 w-5" />}
                color="red"
              />
            </div>

            <VitalCard title="Blood Pressure" value="120/80" unit="mmHg" status="normal" change="Stable" trend={[118, 120, 119, 121, 120, 120, 120]} icon={<Activity className="h-5 w-5" />} color="blue" />
            <VitalCard title="Blood Glucose" value="95" unit="mg/dL" status="normal" change="+2%" trend={[92, 94, 95, 96, 95, 94, 95]} icon={<Droplets className="h-5 w-5" />} color="purple" />
            <VitalCard title="SpO2" value="98" unit="%" status="excellent" change="Stable" trend={[97, 98, 98, 99, 98, 98, 98]} icon={<Wind className="h-5 w-5" />} color="teal" />
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
                <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : (
                <div>
                  <div className="text-3xl font-bold text-foreground mb-1">
                    ${billing?.outstandingBalance?.toFixed(2) || "0.00"}
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">Outstanding Balance</p>

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
                  <Calendar className="h-5 w-5 text-primary" />
                  {/* DYNAMIC TITLE */}
                  {appointments.length > 0 && hasToday ? "Today's Appointments" : "Next Upcoming Appointments"}
                </CardTitle>
                <button onClick={() => navigate("/appointments")} className="text-sm text-primary hover:underline font-medium">
                  View full schedule
                </button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-1">
              {loading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : appointments.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground bg-muted/10 rounded-lg border border-dashed">
                  <Calendar className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p className="font-medium">Your schedule is currently clear.</p>
                  <p className="text-xs">No upcoming appointments found.</p>
                  <button onClick={() => navigate("/appointments")} className="text-primary text-sm font-semibold hover:underline mt-2">
                    Book a New Session &rarr;
                  </button>
                </div>
              ) : (
                appointments.slice(0, 3).map((apt) => {
                  const timeSlot = apt.resource?.start || apt.timeSlot;
                  const dateObj = new Date(timeSlot);
                  const details = getDoctorDetails(apt);
                  
                  // UI Logic
                  const uiType = "Video Call"; // Default to Video for this platform
                  const uiStatus = apt.status === 'COMPLETED' ? 'completed' : 'upcoming';

                  return (
                    <div
                      key={apt.appointmentId}
                      className="flex items-center justify-between p-4 rounded-xl border border-border bg-card mb-3 shadow-sm hover:shadow-md transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                          <AvatarImage
                            src={details.avatar || ""}
                            alt={details.name}
                            className="object-cover"
                          />
                          <AvatarFallback className="bg-primary/10 text-primary font-bold">
                            {getInitials(details.name)}
                          </AvatarFallback>
                        </Avatar>

                        <div>
                          <h4 className="font-semibold text-base text-foreground">{details.name}</h4>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                            <span>{details.specialty}</span>
                            <span className="text-xs mx-1">•</span>
                            <span className="text-blue-600 font-medium">Video Call</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {dateObj.toLocaleDateString()} at {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>

                      {/* JOIN BUTTON */}
                      <Button
                        size="sm"
                        onClick={() => handleJoin(apt)}
                        className={uiStatus === 'completed' ? "opacity-50 cursor-not-allowed" : "bg-primary hover:bg-primary/90"}
                        disabled={uiStatus === 'completed'}
                      >
                         <Video className="h-4 w-4 mr-2" />
                         {uiStatus === 'completed' ? 'Completed' : 'Join Call'}
                      </Button>
                    </div>
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
                onClick={() => navigate(`/live-monitoring?patientId=${profile?.patientId}`)}
              />
            </CardContent>
          </Card>
        </div>

        {/* 4. MARKETING BANNER */}
        <Card className="medical-gradient text-white shadow-elevated border-0 overflow-hidden relative group cursor-pointer"
          onClick={() => {
            if (profile?.patientId) navigate(`/live-monitoring?patientId=${profile.patientId}`);
          }}
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