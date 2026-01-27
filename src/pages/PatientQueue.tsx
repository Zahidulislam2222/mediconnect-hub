import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser, signOut, fetchAuthSession } from 'aws-amplify/auth';
import {
    Clock,
    CheckCircle2,
    MoreVertical,
    Play,
    AlertCircle,
    Loader2,
    History,
    CalendarCheck,
    Video,
    XCircle,
    AlertTriangle,
    Stethoscope,
    FileText,
    CalendarDays,
    List
} from "lucide-react";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const API_URL = import.meta.env.VITE_API_BASE_URL || "";

// Helper: Smart Initials
const getInitials = (name: string) => {
    if (!name) return "PT";
    const cleanName = name.trim();
    const parts = cleanName.split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return cleanName.substring(0, 2).toUpperCase();
};

export default function PatientQueue() {
    const navigate = useNavigate();
    const { toast } = useToast();

    // --- STATE ---
    const [todayQueue, setTodayQueue] = useState<any[]>([]);
    const [upcomingQueue, setUpcomingQueue] = useState<any[]>([]);
    const [fullHistory, setFullHistory] = useState<any[]>([]);
    const [stats, setStats] = useState({ waiting: 0, completed: 0, avgWait: "0m" });
    const [isLoading, setIsLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [showSummary, setShowSummary] = useState(false);
    const [patientDirectory, setPatientDirectory] = useState<any[]>([]);

    const [doctorName, setDoctorName] = useState("Doctor");
    const [doctorAvatar, setDoctorAvatar] = useState<string | null>(null);

    // 1. POLLING SETUP
    useEffect(() => {
        loadQueueData();
        const intervalId = setInterval(() => { loadQueueData(true); }, 30000);
        return () => clearInterval(intervalId);
    }, []);

    // 🟢 FUNCTION: Load Data
    const loadQueueData = async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const user = await getCurrentUser();

            // Fetch Profile
            fetch(`${API_URL}/register-doctor?id=${user.userId}`)
                .then(res => res.json())
                .then(data => {
                    const profile = Array.isArray(data.doctors) ? data.doctors.find((d: any) => d.doctorId === user.userId) : data;
                    if (profile) {
                        setDoctorName(profile.name || "Doctor");
                        setDoctorAvatar(profile.avatar);
                    }
                }).catch(console.error);

            // Fetch Appointments
            const response = await fetch(`${API_URL}/doctor-appointments?doctorId=${user.userId}`);
            if (response.ok) {
                const data = await response.json();
                let allAppointments = [];

                if (Array.isArray(data)) allAppointments = data;
                else if (data.existingBookings) allAppointments = data.existingBookings;

                // 1. SMART FILTER (Remove Bad Data)
                const validAppointments = allAppointments.filter((a: any) => {
                    if (!a.patientName) return false;
                    if (!a.timeSlot) return false;
                    const date = new Date(a.timeSlot);
                    if (isNaN(date.getTime())) return false;
                    return true;
                });

                setFullHistory(validAppointments);

                // 🟢 NEW: FETCH REAL PATIENT PROFILES
                const uniquePatientIds = [...new Set(validAppointments.map((a: any) => a.patientId))];
                if (uniquePatientIds.length > 0) {
                    const session = await fetchAuthSession();
                    const token = session.tokens?.idToken?.toString();

                    const profilePromises = uniquePatientIds.map(pid =>
                        fetch(`${API_URL}/register-patient?id=${pid}`, { headers: { 'Authorization': `Bearer ${token}` } })
                            .then(r => r.ok ? r.json() : null)
                    );

                    const profilesData = await Promise.all(profilePromises);
                    const cleanProfiles = profilesData.filter(p => p !== null).map((p: any) => p.Item || p);
                    setPatientDirectory(cleanProfiles);
                }

                // 2. SPLIT QUEUES (Today vs Upcoming)
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const activeList = validAppointments.filter((a: any) =>
                    a.status === 'WAITING' || a.status === 'CONFIRMED' || a.status === 'IN_PROGRESS'
                );

                const todayList = [];
                const futureList = [];

                activeList.forEach(apt => {
                    const aptDate = new Date(apt.timeSlot);
                    aptDate.setHours(0, 0, 0, 0);
                    if (aptDate.getTime() === today.getTime()) todayList.push(apt);
                    else if (aptDate.getTime() > today.getTime()) futureList.push(apt);
                });

                // 3. SORTING
                todayList.sort((a, b) => {
                    if (a.status === 'IN_PROGRESS') return -1;
                    if (b.status === 'IN_PROGRESS') return 1;
                    if (a.patientArrived && !b.patientArrived) return -1;
                    if (!a.patientArrived && b.patientArrived) return 1;
                    return new Date(a.timeSlot).getTime() - new Date(b.timeSlot).getTime();
                });

                futureList.sort((a, b) => new Date(a.timeSlot).getTime() - new Date(b.timeSlot).getTime());

                setTodayQueue(todayList);
                setUpcomingQueue(futureList);

                // 4. STATS
                const completedList = validAppointments.filter((a: any) => a.status === 'COMPLETED');

                // Calculate Avg Wait only for today's active items
                let totalWait = 0;
                let validCount = 0;
                todayList.filter(a => a.status !== 'IN_PROGRESS').forEach(a => {
                    const waitMs = Math.max(0, Date.now() - new Date(a.timeSlot).getTime());
                    totalWait += waitMs;
                    validCount++;
                });
                const avgMinutes = validCount > 0 ? Math.round((totalWait / 1000 / 60) / validCount) : 0;

                setStats({
                    waiting: todayList.length,
                    completed: completedList.filter(a => {
                        const d = new Date(a.timeSlot); d.setHours(0, 0, 0, 0);
                        return d.getTime() === today.getTime(); // Today's completed count
                    }).length,
                    avgWait: `${avgMinutes}m`
                });
            }
        } catch (error) {
            console.error("Queue Error:", error);
        } finally {
            if (!silent) setIsLoading(false);
        }
    };

    const updateStatus = async (appointmentId: string, newStatus: string, patientName: string) => {
        setProcessingId(appointmentId);
        try {
            const user = await getCurrentUser();
            const res = await fetch(`${API_URL}/book-appointment`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ appointmentId, doctorId: user.userId, status: newStatus })
            });

            if (res.ok) {
                toast({ title: "Status Updated", description: `Patient marked as ${newStatus}` });
                if (newStatus === 'IN_PROGRESS') {
                    setTimeout(() => navigate(`/consultation?appointmentId=${appointmentId}&patientName=${patientName}`), 500);
                } else {
                    loadQueueData();
                }
            }
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Update failed." });
        } finally {
            setProcessingId(null);
        }
    };

    const renderCard = (patient: any, isUpcoming = false) => {
        const realProfile = patientDirectory.find(p => p.patientId === patient.patientId);
        const aptDate = new Date(patient.timeSlot);
        const diffMs = Date.now() - aptDate.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        let timeStatus = { text: "On Time", color: "text-blue-600 bg-blue-50 border-blue-200", icon: Clock };

        if (!isUpcoming) {
            if (diffMins > 10) timeStatus = { text: `LATE (+${diffMins}m)`, color: "text-red-600 bg-red-50 border-red-200", icon: AlertCircle };
            else if (diffMins < -10) timeStatus = { text: "Early Arrival", color: "text-emerald-600 bg-emerald-50 border-emerald-200", icon: CheckCircle2 };
        } else {
            timeStatus = { text: aptDate.toLocaleDateString(), color: "text-gray-600 bg-gray-50 border-gray-200", icon: CalendarDays };
        }

        const StatusIcon = timeStatus.icon;

        return (
            <Card
                key={patient.appointmentId}
                className={cn(
                    "group hover:shadow-md transition-all border-l-4 mb-3",
                    patient.status === 'IN_PROGRESS' ? "border-l-blue-500 bg-blue-50/30" :
                        patient.patientArrived ? "border-l-green-500 bg-green-50/20" :
                            patient.priority === 'High' ? "border-l-red-500" : "border-l-transparent"
                )}
            >
                <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-4 justify-between">
                    <div className="flex items-center gap-4">
                        <HoverCard>
                            <HoverCardTrigger asChild>
                                <div className="relative cursor-help">
                                    <Avatar className="h-14 w-14 border-2 border-background shadow-sm">
                                        <AvatarImage src={realProfile?.avatar} alt={patient.patientName} />                                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
                                            {getInitials(patient.patientName)}
                                        </AvatarFallback>
                                    </Avatar>
                                    {patient.patientArrived && <span className="absolute -bottom-1 -right-1 h-4 w-4 bg-green-500 border-2 border-white rounded-full animate-pulse shadow-sm" />}
                                </div>
                            </HoverCardTrigger>
                            <HoverCardContent className="w-80">
                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold flex items-center gap-2">
                                        <FileText className="h-4 w-4" /> Patient Details
                                    </h4>
                                    <div className="text-sm text-muted-foreground">
                                        <p><span className="font-medium text-foreground">Age:</span> {patient.patientAge || "N/A"}</p>
                                        <p><span className="font-medium text-foreground">Reason:</span> {patient.reason}</p>
                                    </div>
                                </div>
                            </HoverCardContent>
                        </HoverCard>

                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-lg">{patient.patientName}</h3>
                                {patient.status === 'IN_PROGRESS' && (
                                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none animate-pulse">In Consultation</Badge>
                                )}
                                {patient.priority === 'High' && (
                                    <Badge variant="destructive" className="flex items-center gap-1">
                                        <AlertTriangle className="h-3 w-3" /> High Risk
                                    </Badge>
                                )}
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
                                <span className={cn("flex items-center gap-1 font-medium px-1.5 rounded text-xs", timeStatus.color)}>
                                    <StatusIcon className="h-3 w-3" /> {isUpcoming ? aptDate.toLocaleDateString() : timeStatus.text}
                                </span>
                                <span>•</span>
                                <span className="flex items-center gap-1 text-foreground font-medium">
                                    <Clock className="h-3 w-3" /> {aptDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                    <Stethoscope className="h-3 w-3" /> {patient.reason || "General Checkup"}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center mt-2 md:mt-0">
                        {patient.status === 'IN_PROGRESS' ? (
                            <Button
                                onClick={() => updateStatus(patient.appointmentId, 'COMPLETED', patient.patientName)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[120px]"
                                disabled={!!processingId}
                            >
                                {processingId === patient.appointmentId ? <Loader2 className="h-4 w-4 animate-spin" /> : "Complete Visit"}
                            </Button>
                        ) : (
                            <Button
                                onClick={() => updateStatus(patient.appointmentId, 'IN_PROGRESS', patient.patientName)}
                                className={cn("min-w-[120px] text-white", patient.patientArrived ? "bg-green-600 hover:bg-green-700 animate-pulse" : "bg-blue-600 hover:bg-blue-700")}
                                disabled={!!processingId || isUpcoming}
                            >
                                {processingId === patient.appointmentId ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                                    <>{patient.patientArrived ? <Video className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />} Start</>
                                )}
                            </Button>
                        )}

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4 text-muted-foreground" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => navigate(`/patient-records`, { state: { patientId: patient.patientId } })}>
                                    View Full History
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    className="text-red-600 focus:text-red-600"
                                    onClick={() => updateStatus(patient.appointmentId, 'CANCELLED', patient.patientName)}
                                >
                                    <XCircle className="h-4 w-4 mr-2" /> Mark No-Show / Cancel
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </CardContent>
            </Card>
        );
    };

    return (
        <DashboardLayout
            title="Patient Queue"
            subtitle="Clinical Dashboard & Triage"
            userRole="doctor"
            userName={doctorName}
            userAvatar={doctorAvatar}
            onLogout={() => { signOut(); navigate("/"); }}
        >
            <div className="space-y-6 animate-fade-in pb-10">

                {/* STATS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <Card className="bg-blue-600 text-white border-none shadow-md">
                        <CardContent className="p-6 flex items-center justify-between">
                            <div>
                                <p className="text-blue-100 font-medium text-sm uppercase tracking-wider">Today's Queue</p>
                                <h3 className="text-3xl font-bold mt-1">{stats.waiting}</h3>
                            </div>
                            <Clock className="h-8 w-8 opacity-20" />
                        </CardContent>
                    </Card>

                    {/* 🟢 FIXED: STATIC COMPLETED CARD + SMALL ACTION BUTTON */}
                    <Card
                        className="bg-emerald-600 text-white border-none shadow-md cursor-pointer hover:bg-emerald-700 transition-all active:scale-95"
                        onClick={() => setShowSummary(true)}
                        title="Click to view details"
                    >
                        <CardContent className="p-6 flex items-center justify-between">
                            <div>
                                <p className="text-emerald-100 font-medium text-sm uppercase tracking-wider">Completed</p>
                                <h3 className="text-3xl font-bold mt-1">{stats.completed}</h3>
                            </div>
                            <CheckCircle2 className="h-8 w-8 opacity-20" />
                        </CardContent>
                    </Card>

                    <Card className="bg-white text-foreground border-border shadow-sm">
                        <CardContent className="p-6 flex items-center justify-between">
                            <div>
                                <p className="text-muted-foreground font-medium text-sm uppercase tracking-wider">Avg Wait</p>
                                <h3 className="text-3xl font-bold mt-1">{stats.avgWait}</h3>
                            </div>
                            <History className="h-8 w-8 text-muted-foreground opacity-20" />
                        </CardContent>
                    </Card>
                </div>

                {/* 🟢 TABS: TODAY vs UPCOMING */}
                <Tabs defaultValue="today" className="w-full">
                    {/* ... (Tabs List and Content Logic Remains Perfect) ... */}
                    <TabsList className="w-full max-w-md grid grid-cols-2 mb-4">
                        <TabsTrigger value="today">Today's Queue ({todayQueue.length})</TabsTrigger>
                        <TabsTrigger value="upcoming">Upcoming ({upcomingQueue.length})</TabsTrigger>
                    </TabsList>

                    <TabsContent value="today" className="space-y-4">
                        {isLoading ? (
                            <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></div>
                        ) : todayQueue.length === 0 ? (
                            <div className="text-center py-16 bg-muted/20 rounded-xl border border-dashed">
                                <CalendarCheck className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                                <h3 className="text-lg font-medium text-muted-foreground">You are all caught up!</h3>
                                <p className="text-sm text-muted-foreground/70">No patients waiting for today.</p>
                            </div>
                        ) : (
                            todayQueue.map(p => renderCard(p, false))
                        )}
                    </TabsContent>

                    <TabsContent value="upcoming" className="space-y-4">
                        {isLoading ? (
                            <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></div>
                        ) : upcomingQueue.length === 0 ? (
                            <div className="text-center py-16 bg-muted/20 rounded-xl border border-dashed">
                                <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                                <h3 className="text-lg font-medium text-muted-foreground">No future bookings</h3>
                                <p className="text-sm text-muted-foreground/70">Your schedule is clear for the coming days.</p>
                            </div>
                        ) : (
                            upcomingQueue.map(p => renderCard(p, true))
                        )}
                    </TabsContent>
                </Tabs>
            </div>

            {/* 🟢 FIXED: MODAL VISUALS (Fixed missing list issue) */}
            <Dialog open={showSummary} onOpenChange={setShowSummary}>
                <DialogContent className="max-w-2xl bg-white max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Daily Practice Summary</DialogTitle>
                        <DialogDescription>Patients processed today ({new Date().toLocaleDateString()}).</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {fullHistory.filter(a => a.status === 'COMPLETED').length === 0 && fullHistory.filter(a => a.status === 'CANCELLED').length === 0 ? (
                            <p className="text-center text-muted-foreground py-8 border rounded-lg">No history record for today.</p>
                        ) : (
                            <>
                                {/* Completed List */}
                                <h4 className="font-semibold text-sm text-emerald-700">Completed ({fullHistory.filter(a => a.status === 'COMPLETED').length})</h4>
                                <div className="space-y-2">
                                    {fullHistory.filter(a => a.status === 'COMPLETED').map(apt => (
                                        <div key={apt.appointmentId} className="flex items-center justify-between p-3 border rounded-lg bg-emerald-50/50">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-8 w-8"><AvatarFallback>{getInitials(apt.patientName)}</AvatarFallback></Avatar>
                                                <div>
                                                    <p className="font-medium text-sm">{apt.patientName}</p>
                                                    <p className="text-xs text-muted-foreground">{new Date(apt.timeSlot).toLocaleTimeString()}</p>
                                                </div>
                                            </div>
                                            <Badge className="bg-emerald-200 text-emerald-800 border-none">Billed</Badge>
                                        </div>
                                    ))}
                                </div>

                                {/* Cancelled List */}
                                {fullHistory.filter(a => a.status === 'CANCELLED').length > 0 && (
                                    <>
                                        <h4 className="font-semibold text-sm text-red-700 mt-4">Cancelled / No-Show</h4>
                                        <div className="space-y-2">
                                            {fullHistory.filter(a => a.status === 'CANCELLED').map(apt => (
                                                <div key={apt.appointmentId} className="flex items-center justify-between p-3 border rounded-lg bg-red-50/50">
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-8 w-8"><AvatarFallback>{getInitials(apt.patientName)}</AvatarFallback></Avatar>
                                                        <div>
                                                            <p className="font-medium text-sm">{apt.patientName}</p>
                                                            <p className="text-xs text-muted-foreground">{new Date(apt.timeSlot).toLocaleTimeString()}</p>
                                                        </div>
                                                    </div>
                                                    <Badge variant="destructive">Cancelled</Badge>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

        </DashboardLayout>
    );
}