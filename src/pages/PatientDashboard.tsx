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
import { ActionButton } from "@/components/dashboard/ActionButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
// 🟢 Imports for Avatar Fix
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

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
  const { toast } = useToast();

  // --- STATE ---
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
      const token = await getAuthToken();
      const user = await getCurrentUser();
      const userId = user.userId;

      // 1. Fetch Doctor Directory (Essential for Avatars)
      try {
        const docRes = await fetch(`${API_BASE_URL}/doctors`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const docData = await docRes.json();
        if (docData.doctors) setDoctors(docData.doctors);
      } catch (e) { console.warn("Doc Dir Error", e); }

      // 2. Fetch Patient Data Parallel
      const results = await Promise.allSettled([
        fetch(`${API_BASE_URL}/register-patient?id=${userId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/doctor-appointments?patientId=${userId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/billing?patientId=${userId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/vitals?patientId=${userId}&limit=1`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      const [profileRes, apptRes, billRes, vitalRes] = results;

      // A. Profile Logic
      if (profileRes.status === 'fulfilled' && profileRes.value.ok) {
        const data = await profileRes.value.json();
        const userData = (data.patients || []).find((p: any) => p.userId === userId) || data.Item;

        if (userData) {
          setProfile(userData);
          localStorage.setItem('user', JSON.stringify({ ...userData }));
        }
      }

      // B. Appointments (STRICT FILTER & DEDUPING APPLIED)
      if (apptRes.status === 'fulfilled' && apptRes.value.ok) {
        const data = await apptRes.value.json();
        let list = [];
        if (Array.isArray(data)) {
          list = data;
        } else if (data.existingBookings) {
          list = data.existingBookings;
        }

        // --- THIS IS THE NEW LOGIC FROM THE DOCTOR'S DASHBOARD ---
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);
        // --- END OF NEW LOGIC ---

        const seenIds = new Set();
        const active = list
          .filter((a: any) => {
            // Standard data integrity checks
            if (!a.timeSlot || !a.patientName) return false;
            if (isNaN(new Date(a.timeSlot).getTime())) return false;
            if (seenIds.has(a.appointmentId)) return false;
            if (['CANCELLED', 'COMPLETED', 'REJECTED'].includes(a.status)) return false;

            // --- APPLY THE "TODAY ONLY" FILTER ---
            const aptDate = new Date(a.timeSlot);
            if (aptDate < startOfToday || aptDate > endOfToday) {
              return false; // Filter out appointments not scheduled for today
            }

            seenIds.add(a.appointmentId);
            return true;
          })
          .sort((a: any, b: any) => new Date(a.timeSlot).getTime() - new Date(b.timeSlot).getTime());

        setAppointments(active);
      }

      // C. Billing
      if (billRes.status === 'fulfilled' && billRes.value.ok) {
        setBilling(await billRes.value.json());
      }

      // D. Vitals
      if (vitalRes.status === 'fulfilled' && vitalRes.value.ok) {
        const vData = await vitalRes.value.json();
        if (Array.isArray(vData) && vData.length > 0) setRealVitals(vData[0]);
      }

    } catch (error) {
      console.error("Dashboard Load Error:", error);
    } finally {
      setLoading(false);
    }
  }

  // --- LOGIC HELPERS ---

  // 🟢 Handle Join Logic
  const handleJoin = async (apt: any) => {
    try {
      const token = await getAuthToken();
      await fetch(`${API_BASE_URL}/book-appointment`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          appointmentId: apt.appointmentId,
          status: "CONFIRMED",
          patientArrived: true // Critical Signal
        })
      });
    } catch (e) { console.error("Check-in error", e); }

    navigate(`/consultation?appointmentId=${apt.appointmentId}&patientName=${encodeURIComponent(profile?.name || "Patient")}`);
  };

  // 🟢 Get Doctor Details
  const getDoctorDetails = (apt: any) => {
    const directoryDoc = doctors.find(d => d.doctorId === apt.doctorId);
    let avatarUrl = directoryDoc?.avatar;
    if (!avatarUrl || avatarUrl.trim() === "") {
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
        localStorage.removeItem('user');
        navigate("/");
      }}
    >
      <div className="space-y-6 animate-fade-in">

        {/* 1. VITALS & BILLING GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">

          {/* Vitals Section */}
          <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              className="cursor-pointer transition-transform hover:scale-[1.02]"
              onClick={() => navigate(`/live-monitoring?patientId=${profile?.userId}`)}
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
                  <Calendar className="h-5 w-5 text-primary" /> Today's Appointments
                </CardTitle>
                <button onClick={() => navigate("/appointments")} className="text-sm text-primary hover:underline font-medium">
                  View all
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-1">
              {loading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : appointments.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground bg-muted/10 rounded-lg border border-dashed">
                  <Calendar className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p className="font-medium">No upcoming appointments.</p>
                  <button onClick={() => navigate("/appointments")} className="text-primary text-sm font-semibold hover:underline mt-2">
                    Book Now &rarr;
                  </button>
                </div>
              ) : (
                appointments.slice(0, 3).map((apt) => {
                  const dateObj = new Date(apt.timeSlot);
                  const details = getDoctorDetails(apt);
                  const uiType = apt.type === 'IN_PERSON' ? "In-Person" : "Video Call";

                  // 🟢 DEFINED UI STATUS HERE TO FIX ERROR
                  const uiStatus = apt.status === 'COMPLETED' ? 'completed' : 'upcoming';

                  return (
                    <div
                      key={apt.appointmentId}
                      className="flex items-center justify-between p-4 rounded-xl border border-border bg-card mb-3 shadow-sm hover:shadow-md transition-all"
                    >
                      <div className="flex items-center gap-4">
                        {/* 🟢 AVATAR LOGIC */}
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
                            <span className={uiType === 'In-Person' ? "text-orange-600 font-medium" : "text-blue-600 font-medium"}>
                              {uiType}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {dateObj.toLocaleDateString()} at {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>

                      {/* JOIN BUTTON */}
                      <Button
                        size="sm"
                        variant={uiType === 'In-Person' ? "outline" : "default"}
                        onClick={() => {
                          if (uiType === "In-Person") {
                            alert("This is an in-person visit. Please go to the clinic.");
                          } else {
                            handleJoin(apt);
                          }
                        }}
                        className={uiStatus === 'completed' ? "opacity-50 cursor-not-allowed" : ""}
                        disabled={uiStatus === 'completed'}
                      >
                        {uiType === 'In-Person' ? 'Directions' : 'Join Call'}
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
                onClick={() => navigate(`/live-monitoring?patientId=${profile?.userId}`)}
              />
            </CardContent>
          </Card>
        </div>

        {/* 4. MARKETING BANNER */}
        <Card className="medical-gradient text-white shadow-elevated border-0 overflow-hidden relative group cursor-pointer"
          onClick={() => {
            if (profile?.userId) navigate(`/live-monitoring?patientId=${profile.userId}`);
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