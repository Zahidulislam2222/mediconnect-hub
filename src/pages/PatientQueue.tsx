import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser, signOut } from 'aws-amplify/auth';
import {
    Clock,
    CheckCircle2,
    MoreVertical,
    Play,
    AlertCircle,
    Loader2,
    History,
    CalendarCheck
} from "lucide-react";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const API_URL = import.meta.env.VITE_API_BASE_URL || "";

// 🟢 HELPER: Smart Initials (Optimized)
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
    const [queue, setQueue] = useState<any[]>([]);
    const [stats, setStats] = useState({ waiting: 0, completed: 0, avgWait: "0m" });
    const [isLoading, setIsLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    // User Identity State
    const [doctorName, setDoctorName] = useState("Doctor");
    const [doctorAvatar, setDoctorAvatar] = useState<string | null>(null);

    useEffect(() => {
        loadQueueData();
    }, []);

    // 🟢 FUNCTION: Load Data (Strategy A: Fetch Rich Data Instantly)
    const loadQueueData = async () => {
        try {
            const user = await getCurrentUser();

            // 1. Fetch Profile (For Sidebar/Header)
            // We reuse the logic from Dashboard to ensure Name/Avatar matches
            fetch(`${API_URL}/register-doctor?id=${user.userId}`)
                .then(res => res.json())
                .then(data => {
                    const profile = Array.isArray(data.doctors)
                        ? data.doctors.find((d: any) => d.doctorId === user.userId)
                        : data;
                    if (profile) {
                        setDoctorName(profile.name || "Doctor");
                        setDoctorAvatar(profile.avatar);
                    }
                })
                .catch(console.error);

            // 2. Fetch Schedule (The Queue)
            const response = await fetch(`${API_URL}/doctor-schedule?doctorId=${user.userId}`);
            if (response.ok) {
                const data = await response.json();

                // 🛡️ SAFETY FIX: Check what format the API actually sent
                let allAppointments = [];

                if (Array.isArray(data)) {
                    // Scenario A: The New Backend (Correct)
                    allAppointments = data;
                } else if (data.bookings && Array.isArray(data.bookings)) {
                    // Scenario B: The Old Backend (Backward Compatibility)
                    allAppointments = data.bookings;
                } else if (data.appointments && Array.isArray(data.appointments)) {
                    // Scenario C: Another possible format
                    allAppointments = data.appointments;
                } else {
                    console.error("❌ Unexpected API Format:", data);
                    allAppointments = []; // Prevent crash
                }

                // --- 📊 CALCULATE STATS ---
                const waitingList = allAppointments.filter((a: any) => a.status === 'WAITING' || a.status === 'CONFIRMED');
                const inProgressList = allAppointments.filter((a: any) => a.status === 'IN_PROGRESS');
                const completedList = allAppointments.filter((a: any) => a.status === 'COMPLETED');

                // Calculate Average Wait Time (Simple Logic: Now - SlotTime)
                let totalWait = 0;
                waitingList.forEach((a: any) => {
                    const waitMs = Math.max(0, Date.now() - new Date(a.timeSlot).getTime());
                    totalWait += waitMs;
                });
                const avgMinutes = waitingList.length > 0 ? Math.round((totalWait / 1000 / 60) / waitingList.length) : 0;

                setStats({
                    waiting: waitingList.length + inProgressList.length,
                    completed: completedList.length,
                    avgWait: `${avgMinutes}m`
                });

                // --- 🔄 SORTING LOGIC ---
                // 1. IN_PROGRESS (Top)
                // 2. High Priority
                // 3. Time (Earliest First)
                const activeQueue = [...inProgressList, ...waitingList].sort((a, b) => {
                    if (a.status === 'IN_PROGRESS') return -1;
                    if (b.status === 'IN_PROGRESS') return 1;

                    const priorityScore = { High: 3, Medium: 2, Low: 1 };
                    const pA = priorityScore[a.priority as keyof typeof priorityScore] || 1;
                    const pB = priorityScore[b.priority as keyof typeof priorityScore] || 1;

                    if (pA !== pB) return pB - pA; // Higher priority first
                    return new Date(a.timeSlot).getTime() - new Date(b.timeSlot).getTime(); // Then earliest time
                });

                setQueue(activeQueue);
            }
        } catch (error) {
            console.error("Queue Error:", error);
            toast({ variant: "destructive", title: "Connection Error", description: "Could not load patient queue." });
        } finally {
            setIsLoading(false);
        }
    };

    // 🟢 FUNCTION: Update Status (WAITING -> IN_PROGRESS -> COMPLETED)
    const updateStatus = async (appointmentId: string, newStatus: string) => {
        setProcessingId(appointmentId);
        try {
            const user = await getCurrentUser();

            const res = await fetch(`${API_URL}/book-appointment`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    appointmentId,
                    doctorId: user.userId,
                    status: newStatus
                })
            });

            if (res.ok) {
                toast({
                    title: newStatus === 'IN_PROGRESS' ? "Consultation Started" : "Patient Discharged",
                    className: newStatus === 'IN_PROGRESS' ? "bg-blue-600 text-white" : "bg-green-600 text-white"
                });
                loadQueueData(); // Refresh list to move item
            } else {
                throw new Error("Update failed");
            }
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Could not update status." });
        } finally {
            setProcessingId(null);
        }
    };

    // --- UTILS ---
    const handleLogout = async () => {
        await signOut();
        navigate("/");
    };

    const getPriorityColor = (priority: string) => {
        switch (priority?.toLowerCase()) {
            case "high": return "bg-red-50 text-red-600 border-red-200";
            case "medium": return "bg-yellow-50 text-yellow-600 border-yellow-200";
            default: return "bg-emerald-50 text-emerald-600 border-emerald-200";
        }
    };

    const getWaitTime = (timeSlot: string) => {
        const diff = Date.now() - new Date(timeSlot).getTime();
        const minutes = Math.floor(diff / 60000);
        if (minutes < 0) return "Arriving Soon";
        if (minutes < 60) return `${minutes} min wait`;
        return `${Math.floor(minutes / 60)}h ${minutes % 60}m wait`;
    };

    return (
        <DashboardLayout
            title="Patient Queue"
            subtitle="Real-time waiting list management"
            userRole="doctor"
            userName={doctorName}
            userAvatar={doctorAvatar}
            onLogout={handleLogout}
        >
            <div className="space-y-6 animate-fade-in pb-10">

                {/* 1. STATS CARDS (Dynamic) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <Card className="bg-blue-600 text-white border-none shadow-md">
                        <CardContent className="p-6 flex items-center justify-between">
                            <div>
                                <p className="text-blue-100 font-medium text-sm uppercase tracking-wider">Waiting</p>
                                <h3 className="text-3xl font-bold mt-1">{stats.waiting}</h3>
                            </div>
                            <Clock className="h-8 w-8 opacity-20" />
                        </CardContent>
                    </Card>
                    <Card className="bg-emerald-600 text-white border-none shadow-md">
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

                {/* 2. THE QUEUE LIST */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold flex items-center gap-2">
                            Current Queue
                            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                        </h2>
                    </div>

                    {!isLoading && queue.length === 0 ? (
                        <div className="text-center py-16 bg-muted/20 rounded-xl border border-dashed">
                            <CalendarCheck className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                            <h3 className="text-lg font-medium text-muted-foreground">No patients waiting</h3>
                            <p className="text-sm text-muted-foreground/70">Your queue is currently empty.</p>
                        </div>
                    ) : (
                        queue.map((patient) => (
                            <Card
                                key={patient.appointmentId}
                                className={cn(
                                    "group hover:shadow-md transition-all border-l-4",
                                    patient.status === 'IN_PROGRESS' ? "border-l-blue-500 bg-blue-50/30" : "border-l-transparent"
                                )}
                            >
                                <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-4 justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="relative">
                                            {/* 🟢 STRATEGY A: AVATAR + SMART INITIALS */}
                                            <Avatar className="h-14 w-14 border-2 border-background shadow-sm">
                                                <AvatarImage src={patient.patientAvatar} alt={patient.patientName} />
                                                <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
                                                    {getInitials(patient.patientName)}
                                                </AvatarFallback>
                                            </Avatar>

                                            {/* 🟢 STRATEGY A: PRIORITY BADGE */}
                                            <div className={cn(
                                                "absolute -top-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center border-2 border-background font-bold text-[10px]",
                                                patient.priority === 'High' ? "bg-red-500 text-white" :
                                                    patient.priority === 'Medium' ? "bg-yellow-500 text-white" : "bg-emerald-500 text-white"
                                            )}>
                                                {patient.priority === 'High' ? '!' : '#'}
                                            </div>
                                        </div>

                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-semibold text-lg">{patient.patientName}</h3>

                                                {/* Status Badge */}
                                                {patient.status === 'IN_PROGRESS' ? (
                                                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none animate-pulse">
                                                        In Consultation
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className={cn("text-xs font-normal capitalize", getPriorityColor(patient.priority))}>
                                                        {patient.priority || "Low"} Priority
                                                    </Badge>
                                                )}
                                            </div>

                                            {/* 🟢 STRATEGY A: RICH METADATA (AGE, WAIT TIME, REASON) */}
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
                                                <span>{patient.patientAge ? `${patient.patientAge} yrs` : "Age N/A"}</span>
                                                <span>•</span>
                                                <span className={patient.status === 'IN_PROGRESS' ? "text-blue-600 font-medium" : ""}>
                                                    {patient.status === 'IN_PROGRESS' ? "Started Just Now" : getWaitTime(patient.timeSlot)}
                                                </span>
                                                <span>•</span>
                                                <span className="flex items-center gap-1 text-foreground font-medium">
                                                    <AlertCircle className="h-3 w-3" />
                                                    {patient.reason || "General Checkup"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* ACTIONS */}
                                    <div className="flex items-center gap-2 self-end md:self-center mt-2 md:mt-0">
                                        <Button variant="ghost" size="sm" onClick={() => navigate(`/patient-records`, { state: { patientId: patient.patientId } })}>
                                            History
                                        </Button>

                                        {patient.status === 'IN_PROGRESS' ? (
                                            <Button
                                                onClick={() => updateStatus(patient.appointmentId, 'COMPLETED')}
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[100px]"
                                                disabled={!!processingId}
                                            >
                                                {processingId === patient.appointmentId ? <Loader2 className="h-4 w-4 animate-spin" /> : "Complete"}
                                            </Button>
                                        ) : (
                                            <Button
                                                onClick={() => updateStatus(patient.appointmentId, 'IN_PROGRESS')}
                                                className="bg-blue-600 hover:bg-blue-700 text-white min-w-[100px]"
                                                disabled={!!processingId}
                                            >
                                                {processingId === patient.appointmentId ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                                                    <>
                                                        <Play className="h-4 w-4 mr-2" /> Start
                                                    </>
                                                )}
                                            </Button>
                                        )}

                                        <Button variant="ghost" size="icon">
                                            <MoreVertical className="h-4 w-4 text-muted-foreground" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}