import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchUserAttributes } from 'aws-amplify/auth';
import { Plus } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { getUser, clearAllSensitive } from "@/lib/secure-storage";

// Extracted Components
import { AppointmentBookingForm } from "@/components/appointments/AppointmentBookingForm";
import { UpcomingAppointments } from "@/components/appointments/UpcomingAppointments";
import { PastAppointments } from "@/components/appointments/PastAppointments";

export default function Appointments() {
    const navigate = useNavigate();
    const { toast } = useToast();

    const [user, setUser] = useState<any>(() => {
        // ─── SECURE STORAGE FIX ───
        // ORIGINAL: const saved = localStorage.getItem('user'); return saved ? JSON.parse(saved) : null;
        try {
            return getUser() || null;
        } catch (e) { return null; }
    });

    const [doctors, setDoctors] = useState<any[]>([]); 
    const [appointments, setAppointments] = useState<any[]>([]);
    const [loadingAppointments, setLoadingAppointments] = useState(true);
    const [isBooking, setIsBooking] = useState(false);
    const [lastEvaluatedKey, setLastEvaluatedKey] = useState<any>(null);
    const [isLoadingMore, setIsLoadingMore] = useState(false);

    const fetchAppointments = async (patientId: string, isLoadMore = false) => {
        try {
            if (isLoadMore) setIsLoadingMore(true);
            else setLoadingAppointments(true);

            let url = `/appointments?patientId=${patientId}`;
            if (isLoadMore && lastEvaluatedKey) url += `&startKey=${encodeURIComponent(JSON.stringify(lastEvaluatedKey))}`;

            const data: any = await api.get(url);
            const newList = Array.isArray(data) ? data : (data.existingBookings ||[]);

            setAppointments(prev => isLoadMore ? [...prev, ...newList] : newList);
            setLastEvaluatedKey(data.lastEvaluatedKey || null);
        } catch (error: any) {
            // 🟢 FIX: ONLY kick the user out if it is specifically a 401 Unauthorized (Expired Token)
            if (error?.message?.includes('401')) {
                // ─── SECURE STORAGE FIX ───
                // ORIGINAL: localStorage.clear();
                clearAllSensitive();
                navigate("/auth");
            } else {
                toast({ variant: "destructive", title: "Appointments Error", description: error?.message || "Failed to load appointments" });
            }
        } finally {
            setLoadingAppointments(false);
            setIsLoadingMore(false);
        }
    };

    useEffect(() => {
        async function init() {
            try {
                const [docsRes, attr] = await Promise.all([
                    api.get('/doctors'),
                    fetchUserAttributes()
                ]);

                if ((docsRes as any).doctors) setDoctors((docsRes as any).doctors);
                else if (Array.isArray(docsRes)) setDoctors(docsRes);

                let u = { id: attr.sub, name: attr.name || attr.email, avatar: "" };

                // 🟢 FIX: Fetch the Patient's profile so their Avatar appears in the Sidebar!
                try {
                    const profileRes: any = await api.get(`/patients/${attr.sub}`);
                    const profileData = profileRes.Item || profileRes;
                    if (profileData.avatar) u.avatar = profileData.avatar;
                    if (profileData.name) u.name = profileData.name;
                } catch (err) {
                    // No custom profile found — using Cognito defaults
                }

                setUser(u);
                await fetchAppointments(u.id);
            } catch (error: any) {
                console.error("Session Error", error);
                if (error?.message?.includes('401')) {
                    // ─── SECURE STORAGE FIX ───
                    // ORIGINAL: localStorage.clear();
                    clearAllSensitive();
                    navigate("/auth");
                } else {
                    toast({ variant: "destructive", title: "API Error", description: error?.message || "Failed to load data." });
                }
            }
        }
        init();
    }, [navigate]);

    const handleCancel = async (appointmentId: string) => {
        if (!confirm("Are you sure? This will refund your payment.")) return;
        try {
            await api.post('/appointments/cancel', { appointmentId });
            toast({ title: "Cancelled", description: "Appointment cancelled and refunded." });
            fetchAppointments(user.id);
        } catch (e) {
            toast({ variant: "destructive", title: "Error", description: "Could not cancel." });
        }
    };

    const handleJoin = async (apt: any) => {
        try {
            await api.put('/appointments', { appointmentId: apt.appointmentId, status: apt.status, patientArrived: true });
        } catch (e) { console.error("Check-in failed, proceeding anyway", e); }
        navigate(`/consultation?appointmentId=${apt.appointmentId}&patientName=${user?.name}`);
    };

    const handleReceipt = async (appointmentId: string) => {
        try {
            const res: any = await api.get(`/billing/receipt/${appointmentId}`);
            if (res.downloadUrl) window.open(res.downloadUrl, '_blank');
        } catch (e) { toast({ variant: "destructive", title: "Error", description: "Receipt not ready." }); }
    };

    return (
        <DashboardLayout
            title="Appointments"
            subtitle="Manage your scheduled visits"
            userRole="patient"
            userName={user?.name || "User"}
            userAvatar={user?.avatar || ""}
            onLogout={() => navigate("/")}
        >
            <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold">My Appointments</h2>
                    {!isBooking && (
                        <Button onClick={() => setIsBooking(true)}>
                            <Plus className="h-4 w-4 mr-2" /> Book New
                        </Button>
                    )}
                </div>

                {isBooking && (
                    <AppointmentBookingForm 
                        doctors={doctors}
                        onCancel={() => setIsBooking(false)}
                        onSuccess={() => {
                            setIsBooking(false);
                            fetchAppointments(user.id);
                        }}
                    />
                )}

                <Tabs defaultValue="upcoming" className="w-full">
                    <TabsList className="grid w-full max-w-md grid-cols-2">
                        <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                        <TabsTrigger value="past">Past History</TabsTrigger>
                    </TabsList>

                    <TabsContent value="upcoming" className="mt-6">
                        <UpcomingAppointments 
                            appointments={appointments} 
                            doctors={doctors} 
                            loading={loadingAppointments}
                            onJoin={handleJoin}
                            onCancel={handleCancel}
                            onReceipt={handleReceipt}
                        />
                    </TabsContent>

                    <TabsContent value="past" className="mt-6">
                        <PastAppointments 
                            appointments={appointments} 
                            doctors={doctors}
                            lastEvaluatedKey={lastEvaluatedKey}
                            isLoadingMore={isLoadingMore}
                            onLoadMore={() => fetchAppointments(user.id, true)}
                            onReceipt={handleReceipt}
                        />
                    </TabsContent>
                </Tabs>
            </div>
        </DashboardLayout>
    );
}