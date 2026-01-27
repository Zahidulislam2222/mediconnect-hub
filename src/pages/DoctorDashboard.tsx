import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser, signOut, fetchAuthSession } from 'aws-amplify/auth';
import {
  Users,
  Clock,
  Calendar,
  MoreVertical,
  MapPin,
  Video,
  Loader2,
  TrendingUp,
  Activity,
  Star,
  CreditCard,
  CheckCircle2
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
import { cn } from "@/lib/utils";

const API_URL = import.meta.env.VITE_API_BASE_URL || "";

// Helper: Smart Initials
const getInitials = (name: string) => {
  if (!name) return "DR";
  const cleanName = name.replace("Dr. ", "");
  const parts = cleanName.split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return cleanName.substring(0, 2).toUpperCase();
};

export default function DoctorDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [appointments, setAppointments] = useState<any[]>([]);
  // 🟢 NEW: Store real patient profiles here
  const [patientDirectory, setPatientDirectory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [doctorProfile, setDoctorProfile] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : { name: "Doctor", role: "doctor" };
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      const user = await getCurrentUser();
      const userId = user.userId;

      if (!token) return;

      const [profileRes, scheduleRes] = await Promise.all([
        fetch(`${API_URL}/register-doctor?id=${userId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/doctor-appointments?doctorId=${userId}`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (profileRes.ok) {
        const data = await profileRes.json();
        let myProfile = data.Item || (data.doctors ? data.doctors.find((d: any) => d.doctorId === userId) : data);
        if (myProfile && myProfile.name) {
          setDoctorProfile(prev => ({ ...prev, ...myProfile }));
          const currentLocal = JSON.parse(localStorage.getItem('user') || '{}');
          localStorage.setItem('user', JSON.stringify({ ...currentLocal, ...myProfile }));
        }
      }

      if (scheduleRes.ok) {
        const data = await scheduleRes.json();
        let list = [];
        if (Array.isArray(data)) list = data;
        else if (data.existingBookings) list = data.existingBookings;

        // 1. FILTER APPOINTMENTS
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);

        const sorted = list
          .filter((a: any) => {
            if (!a.patientName || !a.timeSlot) return false;
            if (isNaN(new Date(a.timeSlot).getTime())) return false;
            if (a.status === 'CANCELLED' || a.status === 'COMPLETED') return false;
            const aptDate = new Date(a.timeSlot);
            return aptDate >= startOfToday && aptDate <= endOfToday;
          })
          .sort((a: any, b: any) => {
            if (a.patientArrived && !b.patientArrived) return -1;
            if (!a.patientArrived && b.patientArrived) return 1;
            return new Date(a.timeSlot).getTime() - new Date(b.timeSlot).getTime();
          });

        setAppointments(sorted);

        // 🟢 2. NEW: FETCH REAL PATIENT PROFILES (Source of Truth)
        // We look at the appointments to find which patients we need to look up
        const uniquePatientIds = [...new Set(sorted.map((a: any) => a.patientId))];

        if (uniquePatientIds.length > 0) {
          const profilePromises = uniquePatientIds.map(pid =>
            fetch(`${API_URL}/register-patient?id=${pid}`, { headers: { 'Authorization': `Bearer ${token}` } })
              .then(r => r.ok ? r.json() : null)
          );

          const profilesData = await Promise.all(profilePromises);

          // Clean up the data structure (handle DynamoDB .Item or standard array)
          const cleanProfiles = profilesData
            .filter(p => p !== null)
            .map((p: any) => p.Item || (p.patients ? p.patients[0] : p));

          setPatientDirectory(cleanProfiles);
        }
      }

    } catch (err) {
      console.error("Dashboard Load Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinConsultation = (apt: any) => {
    navigate(`/consultation`, { state: { appointmentId: apt.appointmentId, patientName: apt.patientName } });
  };

  // SKELETON LOADING
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

  // 🟢 NEW: Helper to get Real Patient Data
  const getPatientDetails = (apt: any) => {
    // Try to find the patient in our fetched directory
    const realProfile = patientDirectory.find((p: any) => p.patientId === apt.patientId);
    return {
      name: realProfile?.name || apt.patientName || "Unknown Patient",
      avatar: realProfile?.avatar // This will now use the real uploaded photo!
    };
  };

  return (
    <DashboardLayout
      title={`Welcome, ${doctorProfile.name}`}
      subtitle="Here is your daily practice overview"
      userRole="doctor"
      userName={doctorProfile.name}
      userAvatar={doctorProfile.avatar}
      onLogout={async () => { await signOut(); navigate("/"); }}
    >
      <div className="space-y-6 animate-fade-in pb-10">

        {/* 1. METRICS */}
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

        {/* 2. MAIN LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* LEFT: SCHEDULE */}
          <Card className="lg:col-span-2 shadow-card border-border/50 h-fit">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="space-y-1">
                <CardTitle>Today's Schedule</CardTitle>
                <CardDescription>Your upcoming appointments for today</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={loadDashboardData} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  <SkeletonRow /><SkeletonRow /><SkeletonRow />
                </div>
              ) : appointments.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground bg-muted/10 rounded-xl border border-dashed">
                  <Calendar className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>No appointments remaining for today.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {appointments.map((apt: any) => {
                    // 🟢 Call the helper to get Real Name & Avatar
                    const details = getPatientDetails(apt);

                    return (
                      <div
                        key={apt.appointmentId}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-xl border transition-all bg-card group",
                          apt.patientArrived ? "border-green-500/50 bg-green-50/10" : "border-border hover:shadow-md"
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                              {/* 🟢 Add the Image Component here */}
                              <AvatarImage src={details.avatar} className="object-cover" />
                              <AvatarFallback className="bg-primary/10 text-primary font-bold">
                                {getInitials(details.name)}
                              </AvatarFallback>
                            </Avatar>

                            {/* Patient Ready Indicator */}
                            {apt.patientArrived && (
                              <span className="absolute -bottom-1 -right-1 h-4 w-4 bg-green-500 border-2 border-white rounded-full animate-pulse shadow-sm" title="Patient Online" />
                            )}
                          </div>
                          <div>
                            {/* 🟢 Use details.name instead of apt.patientName */}
                            <h4 className="font-semibold text-lg group-hover:text-primary transition-colors">{details.name}</h4>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                              <span className="flex items-center gap-1 bg-muted px-2 py-0.5 rounded text-xs font-medium">
                                <Clock className="h-3 w-3" />
                                {new Date(apt.timeSlot).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {apt.paymentStatus === 'paid' && (
                                <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium">
                                  <CreditCard className="h-3 w-3" /> Paid
                                </span>
                              )}
                              {apt.patientArrived && <span className="text-xs font-bold text-green-600">Online</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleJoinConsultation(apt)}
                            className={cn("shadow-sm", apt.patientArrived ? "bg-green-600 hover:bg-green-700 animate-pulse" : "bg-blue-600 hover:bg-blue-700")}
                          >
                            <Video className="h-4 w-4 mr-2" /> {apt.patientArrived ? "Join Now" : "Join"}
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>View Patient Record</DropdownMenuItem>
                              <DropdownMenuItem className="text-red-500">Cancel Appointment</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* RIGHT: INSIGHTS (Quick Actions Removed) */}
          <div className="space-y-6">
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
              <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}