import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser, signOut } from 'aws-amplify/auth';
import { CalendarCheck, CalendarDays, Loader2 } from "lucide-react";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

// Sub-components & Utils (Added in previous step)
import { getAptTime } from "@/components/patient-queue/utils";
import { QueueStatCards } from "@/components/patient-queue/QueueStatCards";
import { PatientCard } from "@/components/patient-queue/PatientCard";
import { DailySummaryDialog } from "@/components/patient-queue/DailySummaryDialog";

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

    // 🟢 DATA ORCHESTRATION
    const loadQueueData = async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            const user = await getCurrentUser();

            // Fetch Doctor Profile
            api.get(`/doctors/${user.userId}`)
                .then((data: any) => {
                    const profile = Array.isArray(data.doctors) ? data.doctors.find((d: any) => d.doctorId === user.userId) : data;
                    if (profile) {
                        setDoctorName(profile.name || "Doctor");
                        setDoctorAvatar(profile.avatar);
                    }
                }).catch(console.error);

            // Fetch Appointments
            const data: any = await api.get(`/appointments?doctorId=${user.userId}`);
            
            if (data) {
                let allAppointments = [];
                if (Array.isArray(data)) allAppointments = data;
                else if (data.existingBookings) allAppointments = data.existingBookings;

                const validAppointments = allAppointments.filter((a: any) => {
                    const timeVal = getAptTime(a);
                    return a.patientName && timeVal && !isNaN(new Date(timeVal).getTime());
                });

                setFullHistory(validAppointments);

                // Fetch Patient Profiles (Avatars/Details)
                const uniquePatientIds = [...new Set(validAppointments.map((a: any) => a.patientId))];
                if (uniquePatientIds.length > 0) {
                    const profilePromises = uniquePatientIds.map(pid =>
                        api.get(`/patients/${pid}`).then(r => r || null).catch(() => null)
                    );
                    const profilesData = await Promise.all(profilePromises);
                    setPatientDirectory(profilesData.filter(p => p !== null).map((p: any) => p.Item || p));
                }

                // Split Queues
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const activeList = validAppointments.filter((a: any) =>
                    ['WAITING', 'CONFIRMED', 'IN_PROGRESS'].includes(a.status)
                );

                const todayList: any[] = [];
                const futureList: any[] = [];

                activeList.forEach(apt => {
                    const aptDate = new Date(getAptTime(apt));
                    aptDate.setHours(0, 0, 0, 0);
                    if (aptDate.getTime() === today.getTime()) todayList.push(apt);
                    else if (aptDate.getTime() > today.getTime()) futureList.push(apt);
                });

                // Sort Today: In Progress first, then Arrived, then by Time
                todayList.sort((a, b) => {
                    if (a.status === 'IN_PROGRESS') return -1;
                    if (b.status === 'IN_PROGRESS') return 1;
                    if (a.patientArrived && !b.patientArrived) return -1;
                    if (!a.patientArrived && b.patientArrived) return 1;
                    return new Date(getAptTime(a)).getTime() - new Date(getAptTime(b)).getTime();
                });

                setTodayQueue(todayList);
                setUpcomingQueue(futureList.sort((a, b) => new Date(getAptTime(a)).getTime() - new Date(getAptTime(b)).getTime()));

                // Calculate Stats
                const completedToday = validAppointments.filter(a => {
                    const d = new Date(getAptTime(a)); d.setHours(0,0,0,0);
                    return a.status === 'COMPLETED' && d.getTime() === today.getTime();
                });

                let totalWait = 0;
                todayList.filter(a => a.status !== 'IN_PROGRESS').forEach(a => {
                    totalWait += Math.max(0, Date.now() - new Date(getAptTime(a)).getTime());
                });
                const avgMins = todayList.length > 0 ? Math.round((totalWait / 1000 / 60) / todayList.length) : 0;

                setStats({ waiting: todayList.length, completed: completedToday.length, avgWait: `${avgMins}m` });
            }
        } catch (error: any) {
            if (error?.message?.includes('401') || error?.message?.includes('403')) {
                localStorage.clear();
                navigate("/auth");
            }
        } finally {
            if (!silent) setIsLoading(false);
        }
    };

    // 🟢 STATUS UPDATE LOGIC
    const updateStatus = async (appointmentId: string, newStatus: string, patientName: string) => {
        setProcessingId(appointmentId);
        try {
            const res = await api.put('/appointments', { appointmentId, status: newStatus });
            if (res) {
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
                
                {/* 1. Stat Cards Component */}
                <QueueStatCards stats={stats} onShowSummary={() => setShowSummary(true)} />

                <Tabs defaultValue="today" className="w-full">
                    <TabsList className="w-full max-w-md grid grid-cols-2 mb-4">
                        <TabsTrigger value="today">Today's Queue ({todayQueue.length})</TabsTrigger>
                        <TabsTrigger value="upcoming">Upcoming ({upcomingQueue.length})</TabsTrigger>
                    </TabsList>

                    {/* 2. Today's List */}
                    <TabsContent value="today" className="space-y-4">
                        {isLoading ? (
                            <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></div>
                        ) : todayQueue.length === 0 ? (
                            <div className="text-center py-16 bg-muted/20 rounded-xl border border-dashed">
                                <CalendarCheck className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                                <h3 className="text-lg font-medium text-muted-foreground">You are all caught up!</h3>
                            </div>
                        ) : (
                            todayQueue.map(p => (
                                <PatientCard 
                                    key={p.appointmentId}
                                    patient={p} 
                                    patientDirectory={patientDirectory}
                                    processingId={processingId}
                                    onUpdateStatus={updateStatus}
                                />
                            ))
                        )}
                    </TabsContent>

                    {/* 3. Upcoming List */}
                    <TabsContent value="upcoming" className="space-y-4">
                        {isLoading ? (
                            <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /></div>
                        ) : upcomingQueue.length === 0 ? (
                            <div className="text-center py-16 bg-muted/20 rounded-xl border border-dashed">
                                <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                                <h3 className="text-lg font-medium text-muted-foreground">No future bookings</h3>
                            </div>
                        ) : (
                            upcomingQueue.map(p => (
                                <PatientCard 
                                    key={p.appointmentId}
                                    patient={p} 
                                    isUpcoming
                                    patientDirectory={patientDirectory}
                                    processingId={processingId}
                                    onUpdateStatus={updateStatus}
                                />
                            ))
                        )}
                    </TabsContent>
                </Tabs>
            </div>

            {/* 4. Summary Dialog Component */}
            <DailySummaryDialog 
                show={showSummary} 
                onOpenChange={setShowSummary} 
                fullHistory={fullHistory} 
            />
        </DashboardLayout>
    );
}