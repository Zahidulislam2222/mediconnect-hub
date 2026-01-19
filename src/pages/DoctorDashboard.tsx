import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser, signOut } from 'aws-amplify/auth';
import {
  Users,
  Clock,
  Calendar,
  MoreVertical,
  MapPin,
  Video,
  FileText,
  Upload,
  Loader2,
  TrendingUp,
  Activity,
  Star,
  CreditCard
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

const API_URL = import.meta.env.VITE_API_BASE_URL || "";

// --- HELPER: Smart Initials (e.g. "Dr. John Smith" -> "DS") ---
const getInitials = (name: string) => {
  if (!name) return "DR";
  const cleanName = name.replace("Dr. ", ""); // Remove title for initials
  const parts = cleanName.split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return cleanName.substring(0, 2).toUpperCase();
};

export default function DoctorDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [appointments, setAppointments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // 🟢 PROFILE STATE (Initialized from LocalStorage for speed, updated by API)
  const [doctorProfile, setDoctorProfile] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : {
      name: "Doctor",
      avatar: null,
      role: "doctor",
      specialization: "General Practice"
    };
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const user = await getCurrentUser();
      const userId = user.userId;

      // 🟢 STEP 1: FETCH PROFILE
      try {
        const profileRes = await fetch(`${API_URL}/register-doctor?id=${userId}`, { cache: "no-store" });
        if (profileRes.ok) {
          const data = await profileRes.json();

          let myProfile = null;

          // 🔍 LOGIC: Handle both List and Single Object responses
          if (data.doctors && Array.isArray(data.doctors)) {
            // Case A: API returns a list (Your current situation)
            myProfile = data.doctors.find((d: any) => d.doctorId === userId);
          } else if (data.doctorId || data.name) {
            // Case B: API returns a single object
            myProfile = data;
          }

          // Force update the name if found
          if (myProfile && myProfile.name) {
            console.log("✅ Found Profile:", myProfile.name);
            const updatedProfile = {
              ...doctorProfile,
              ...myProfile,
              name: myProfile.name
            };
            setDoctorProfile(updatedProfile);
            localStorage.setItem('user', JSON.stringify(updatedProfile));
          } else {
            console.warn("❌ Could not find my profile in the API response", data);
          }
        }
      } catch (pErr) {
        console.error("Profile Network Error:", pErr);
      }

      // 🟢 STEP 2: FETCH SCHEDULE
      try {
        const scheduleRes = await fetch(`${API_URL}/doctor-schedule?doctorId=${userId}`, { cache: "no-store" });
        if (scheduleRes.ok) {
          const data = await scheduleRes.json();
          const list = Array.isArray(data) ? data : [];

          const sorted = list
            .filter((a: any) => a.status !== 'CANCELLED')
            .sort((a: any, b: any) => new Date(a.timeSlot).getTime() - new Date(b.timeSlot).getTime());

          setAppointments(sorted);
        }
      } catch (sErr) {
        console.error("Schedule Network Error:", sErr);
      }

    } catch (err) {
      console.error("Auth Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    localStorage.removeItem('user');
    navigate("/");
  };

  const handleJoinConsultation = (apt: any) => {
    navigate(`/consultation`, {
      state: {
        appointmentId: apt.appointmentId,
        patientName: apt.patientName
      }
    });
  };

  const handleUploadReport = () => {
    setUploading(true);
    setTimeout(() => {
      setUploading(false);
      toast({ title: "Report Uploaded", description: "Patient record updated successfully." });
    }, 1500);
  };

  // --- SKELETON LOADER ---
  const SkeletonRow = () => (
    <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card animate-pulse">
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-muted"></div>
        <div className="space-y-2">
          <div className="h-4 w-32 bg-muted rounded"></div>
          <div className="h-3 w-24 bg-muted rounded"></div>
        </div>
      </div>
      <div className="h-8 w-16 bg-muted rounded"></div>
    </div>
  );

  return (
    <DashboardLayout
      title={`Welcome, ${doctorProfile.name}`}
      subtitle="Here is your daily practice overview"
      userRole="doctor"
      userName={doctorProfile.name} // 🟢 Fixes Sidebar Name
      userAvatar={doctorProfile.avatar}
      onLogout={handleLogout}
    >
      <div className="space-y-6 animate-fade-in pb-10">

        {/* 1. KEY METRICS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="shadow-sm border-border/50">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Today's Visits</p>
                  <h3 className="text-2xl font-bold mt-2">{appointments.length}</h3>
                </div>
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/50">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Patient Satisfaction</p>
                  <h3 className="text-2xl font-bold mt-2">4.9/5.0</h3>
                </div>
                <div className="p-2 bg-yellow-50 rounded-lg">
                  <Star className="h-5 w-5 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/50">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Monthly Revenue</p>
                  <h3 className="text-2xl font-bold mt-2">$12,450</h3>
                </div>
                <div className="p-2 bg-emerald-50 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 2. MAIN CONTENT AREA */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* LEFT: SCHEDULE */}
          <Card className="lg:col-span-2 shadow-card border-border/50 h-fit">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="space-y-1">
                <CardTitle>Today's Schedule</CardTitle>
                <CardDescription>
                  Your upcoming appointments
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={loadDashboardData} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </div>
              ) : appointments.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground bg-muted/10 rounded-xl border border-dashed">
                  <Calendar className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>No appointments scheduled for today.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {appointments.map((apt: any) => (
                    <div key={apt.appointmentId} className="flex items-center justify-between p-4 rounded-xl border border-border hover:shadow-md transition-all bg-card group">
                      <div className="flex items-center gap-4">
                        {/* 🟢 SMART INITIALS AVATAR */}
                        <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                          <AvatarFallback className="bg-primary/10 text-primary font-bold">
                            {getInitials(apt.patientName)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h4 className="font-semibold text-lg group-hover:text-primary transition-colors">{apt.patientName}</h4>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1 bg-muted px-2 py-0.5 rounded text-xs font-medium">
                              <Clock className="h-3 w-3" />
                              {new Date(apt.timeSlot).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="flex items-center gap-1">
                              {apt.type === 'In-Person' ? <MapPin className="h-3 w-3 text-emerald-500" /> : <Video className="h-3 w-3 text-blue-500" />}
                              {apt.type || "Video Call"}
                            </span>
                            {apt.paymentStatus === 'paid' && (
                              <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium">
                                <CreditCard className="h-3 w-3" /> Paid
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" onClick={() => handleJoinConsultation(apt)} className="bg-blue-600 hover:bg-blue-700 shadow-sm">
                          <Video className="h-4 w-4 mr-2" /> Join
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>View Patient Record</DropdownMenuItem>
                            <DropdownMenuItem>Reschedule</DropdownMenuItem>
                            <DropdownMenuItem className="text-red-500">Cancel Appointment</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* RIGHT: ACTIONS & INSIGHTS */}
          <div className="space-y-6">

            {/* 🟢 REPLACED SYSTEM STATUS WITH INSIGHTS */}
            <Card className="medical-gradient text-white border-none shadow-elevated overflow-hidden relative">
              <CardContent className="p-6 relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg">Practice Health</h3>
                  <Activity className="h-5 w-5 opacity-80" />
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm border-b border-white/20 pb-2">
                    <span className="opacity-90">New Patients</span>
                    <span className="font-bold text-xl">+12</span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-b border-white/20 pb-2">
                    <span className="opacity-90">Pending Reports</span>
                    <span className="font-bold text-xl">0</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="opacity-90">Compliance</span>
                    <Badge variant="secondary" className="bg-emerald-400/20 text-emerald-50 hover:bg-emerald-400/30 border-none">100%</Badge>
                  </div>
                </div>
              </CardContent>
              {/* Decorative Background */}
              <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
            </Card>

            {/* QUICK ACTIONS (Cleaned Up) */}
            <Card className="shadow-card border-border/50">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  className="w-full justify-start gap-3 h-12 text-base font-medium"
                  variant="outline"
                  onClick={handleUploadReport}
                  disabled={uploading}
                >
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5 text-primary" />}
                  Upload Medical Report
                </Button>
                <Button
                  className="w-full justify-start gap-3 h-12 text-base font-medium"
                  variant="outline"
                  onClick={() => navigate('/pharmacy')}
                >
                  <FileText className="h-5 w-5 text-primary" />
                  Write E-Prescription
                </Button>
                {/* 🟢 Removed "Sign Out" from here. It is now handled by the Sidebar/Layout */}
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}