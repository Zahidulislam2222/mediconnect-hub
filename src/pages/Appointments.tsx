import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchUserAttributes, fetchAuthSession } from 'aws-amplify/auth';
import { Clock, Video, Plus, Loader2, CreditCard, Stethoscope, FileText } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { api } from "@/lib/api";

// --- STRIPE IMPORTS ---
import { useCheckout } from "@/context/CheckoutContext";

export default function Appointments() {
    return <AppointmentsContent />;
}

function AppointmentsContent() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { requestPayment } = useCheckout();

    // User State
    const [user, setUser] = useState<any>(() => {
        try {
            const saved = localStorage.getItem('user');
            return saved ? JSON.parse(saved) : null;
        } catch (e) { return null; }
    });

    // Data State

    const [doctors, setDoctors] = useState<any[]>([]); // This is our Directory for Lookups
    const [appointments, setAppointments] = useState<any[]>([]);
    const [loadingAppointments, setLoadingAppointments] = useState(true);

    // Booking Form State
    const [isBooking, setIsBooking] = useState(false);
    const [loading, setLoading] = useState(false);

    // FORM DATA
    const [formData, setFormData] = useState({
        doctorId: "",
        date: "",
        time: "09:00",

    });

    // Dynamic Slot State
    const [availableSlots, setAvailableSlots] = useState<string[]>([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    // 🟢 NEW: Store the Doctor's Timezone
    const [doctorTimezone, setDoctorTimezone] = useState("UTC");

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

    // --- FETCH DATA ---
    const fetchAppointments = async (patientId: string) => {
        try {
            setLoadingAppointments(true);
            setLoadingAppointments(true);
            const data: any = await api.get(`/doctor-appointments?patientId=${patientId}`);

            // 🟢 THIS IS THE FIX: Check for the 'existingBookings' key inside the object
            let list = [];
            if (Array.isArray(data)) {
                list = data;
            } else if (data.existingBookings) {
                list = data.existingBookings;
            }


            // Sort by date descending
            list.sort((a: any, b: any) => new Date(b.timeSlot || b.date).getTime() - new Date(a.timeSlot || a.date).getTime());
            setAppointments(list);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingAppointments(false);
        }
    };

    // --- FETCH DOCTORS & USER ---
    useEffect(() => {
        async function fetchDoctors() {
            try {
                const token = await getAuthToken();

                // 🟢 PROFESSIONAL FIX: Use the new resource you just created
                const json: any = await api.get('/doctors');

                // The Python Lambda returns { "doctors": [...] }
                if (json.doctors) setDoctors(json.doctors);
                else if (Array.isArray(json)) setDoctors(json);

            } catch (e) { console.error("Doctor Directory Error:", e); }
        }

        async function getUser() {
            try {
                const token = await getAuthToken(); // Use your helper
                const attr = await fetchUserAttributes();

                // 1. Default User from Cognito
                let u = {
                    id: attr.sub,
                    name: attr.name || attr.email,
                    avatar: ""
                };

                // 2. 🟢 TRY TO GET REAL PROFILE (With Signed Photo)
                try {
                    const data: any = await api.get(`/register-patient?id=${attr.sub}`);
                    // If backend returns item, use that avatar
                    if (data.avatar) u.avatar = data.avatar;
                } catch (err) {
                    console.log("Could not fetch profile photo");
                }

                setUser(u);
                const currentLocal = JSON.parse(localStorage.getItem('user') || '{}');
                localStorage.setItem('user', JSON.stringify({ ...currentLocal, ...u }));
                await fetchAppointments(u.id);
            } catch (e) { }
        }
        getUser();
        fetchDoctors();
    }, []);

    // --- SMART SCHEDULE LOGIC (TIMEZONE AWARE) ---
    useEffect(() => {
        if (!formData.doctorId || !formData.date) return;

        async function fetchSlots() {
            setLoadingSlots(true);
            setAvailableSlots([]);
            try {
                // 1. Parallel calls to both Microservices
                const [bookingRes, scheduleRes]: any = await Promise.all([
                    api.get(`/doctor-appointments?doctorId=${formData.doctorId}`), // Booking Service (Azure/DynamoDB)
                    api.get(`/doctors/${formData.doctorId}/schedule`)             // Doctor Service (Azure/GCP Postgres)
                ]);

                const bookings = bookingRes.existingBookings || [];
                const weeklySchedule = scheduleRes.schedule || {};
                const tz = scheduleRes.timezone || "UTC";

                setDoctorTimezone(tz);

                // 2. Determine Day Name
                const dateObj = new Date(formData.date);
                const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });

                // 3. Get Shift for that day
                const shift = weeklySchedule[dayName];

                if (!shift || shift === "OFF") {
                    setAvailableSlots([]);
                    return;
                }

                // 4. Generate Slots Logic (remains same)
                const [startStr, endStr] = shift.split('-');
                const startHour = parseInt(startStr.split(':')[0]);
                const endHour = parseInt(endStr.split(':')[0]);

                const slots = [];
                for (let h = startHour; h < endHour; h++) {
                    const timeStr = `${h.toString().padStart(2, '0')}:00`;

                    // 🟢 LOGIC: Compare by actual Date objects, not strings
                    // This handles the "15:00" vs "15:01:30" mismatch
                    const isTaken = bookings.some((b: any) => {
                        // 1. Ignore cancelled appointments
                        if (b.status === 'CANCELLED') return false;

                        // 2. Get the time from either FHIR or Legacy field
                        const bookedTime = b.resource?.start || b.timeSlot;
                        if (!bookedTime) return false;

                        // 3. Format BOTH to the same standard: YYYY-MM-DDT09:00:00Z
                        // This removes the milliseconds that DynamoDB sometimes adds
                        const dbTimeStr = bookedTime.split('.')[0].split('Z')[0] + "Z";
                        const dropdownTimeStr = `${formData.date}T${timeStr}:00Z`;

                        return dbTimeStr === dropdownTimeStr;
                    });

                    if (!isTaken) {
                        slots.push(timeStr);
                    }
                }
                setAvailableSlots(slots);

            } catch (e) {
                console.error("Fetch Slots Error", e);
                toast({ variant: "destructive", title: "Schedule Error", description: "Could not load doctor availability." });
            } finally {
                setLoadingSlots(false);
            }
        }
        fetchSlots();
    }, [formData.doctorId, formData.date]);

    // --- HANDLING BOOKING ---
    const handleBook = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const token = await getAuthToken();
            const selectedDoc = doctors.find(d => d.doctorId === formData.doctorId);
            
            // 🟢 DYNAMIC PRICE: Get from doctor object, default to 50
            const currentPrice = selectedDoc?.consultationFee || 50;

            const timeSlotISO = `${formData.date}T${formData.time}:00`;

            // 1. Request Payment via Modal (Pass the dynamic price)
            const paymentMethod = await requestPayment({
                amount: currentPrice, // <--- UPDATED
                title: "Confirm Appointment",
                description: `Consultation with ${selectedDoc?.name || "Doctor"}`
            });

            // 2. Send Payload
            const payload = {
                patientId: user?.id,
                patientName: user?.name,
                doctorId: formData.doctorId,
                doctorName: selectedDoc?.name || "Doctor",
                timeSlot: timeSlotISO,
                paymentToken: paymentMethod.id
            };

            await api.post('/book-appointment', payload);

            await fetchAppointments(user.id);
            setIsBooking(false);
            setFormData({ doctorId: "", date: "", time: "09:00" }); // Reset time default
            toast({ title: "Success!", description: `Booked for $${selectedDoc?.consultationFee || 50}.00` });

        } catch (error: any) {
            // If user cancelled or payment failed
            if (error.message !== "User cancelled payment") {
                toast({ variant: "destructive", title: "Error", description: error.message });
            }
        } finally {
            setLoading(false);
        }
    };

    // --- HANDLING CANCELLATION ---
    const handleCancel = async (appointmentId: string) => {
        if (!confirm("Are you sure? This will refund your payment.")) return;

        try {
            await api.post('/cancel-appointment', { appointmentId, patientId: user.id });

            toast({ title: "Cancelled", description: "Appointment cancelled and refunded." });
            fetchAppointments(user.id);
        } catch (e) {
            toast({ variant: "destructive", title: "Error", description: "Could not cancel." });
        }
    };
    // 🟢 NEW: Check-In Logic (Add this before the return statement)
    const handleJoin = async (apt: any) => {
        // 1. Notify Backend: "I am here"
        try {
            console.log("📍 Check-in signal sending...");

            await api.put('/book-appointment', {
                appointmentId: apt.appointmentId,
                status: "CONFIRMED", // Keep status as is
                patientArrived: true // 🟢 SIGNAL: Patient is ready
            });
            console.log("✅ Check-in successful");
        } catch (e) {
            console.error("Check-in failed (Connection error)", e);
        }

        // 2. Go to Video Room
        navigate(`/consultation?appointmentId=${apt.appointmentId}&patientName=${user?.name}`);
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
                        <Button onClick={() => setIsBooking(true)} className="bg-primary text-white">
                            <Plus className="h-4 w-4 mr-2" /> Book New
                        </Button>
                    )}
                </div>

                {/* BOOKING FORM */}
                {isBooking && (
                    <Card className="border-primary/20 shadow-lg bg-primary/5 mb-6">
                        <CardHeader><CardTitle>Book New Appointment</CardTitle></CardHeader>
                        <CardContent>
                            <form onSubmit={handleBook} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* DOCTOR SELECT */}
                                    <div className="space-y-2">
                                        <Label>Select Doctor</Label>
                                        <select
                                            className="flex h-10 w-full rounded-md border bg-background px-3"
                                            value={formData.doctorId}
                                            onChange={(e) => setFormData({ ...formData, doctorId: e.target.value })}
                                            required
                                        >
                                            <option value="">-- Choose --</option>
                                            {doctors.map((doc, i) => (
                                                <option key={i} value={doc.doctorId}>
                                                    {doc.name} {doc.specialization ? `(${doc.specialization})` : ""}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* DATE SELECT */}
                                    <div className="space-y-2">
                                        <Label>Date</Label>
                                        <Input
                                            type="date"
                                            value={formData.date}
                                            min={new Date().toISOString().split('T')[0]}
                                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                            required
                                        />
                                    </div>

                                    {/* TIME SELECT */}
                                    <div className="space-y-2">
                                        <Label>
                                            Time Slot
                                            {loadingSlots && <span className="text-xs text-muted-foreground ml-2">(Loading...)</span>}
                                            {/* 🟢 NEW: Show Timezone info to user */}
                                            {!loadingSlots && doctorTimezone && (
                                                <span className="text-xs text-blue-600 ml-2 font-medium">
                                                    ({doctorTimezone} Time)
                                                </span>
                                            )}
                                        </Label>
                                        <select
                                            className="flex h-10 w-full rounded-md border bg-background px-3"
                                            value={formData.time}
                                            onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                                            disabled={loadingSlots || availableSlots.length === 0}
                                            required
                                        >
                                            {availableSlots.length === 0 ? (
                                                <option>No slots available</option>
                                            ) : (
                                                availableSlots.map(slot => (
                                                    <option key={slot} value={slot}>{slot}</option>
                                                ))
                                            )}
                                        </select>
                                    </div>
                                </div>



                                {/* PAYMENT NOTE */}
                                 <div className="p-4 bg-slate-50 rounded-md border mt-2 flex justify-between items-center">
                                    <span className="text-sm text-slate-500">Consultation Fee</span>
                                    <span className="font-bold text-slate-900">
                                        {/* 🟢 DYNAMIC DISPLAY */}
                                        ${doctors.find(d => d.doctorId === formData.doctorId)?.consultationFee || 50}.00
                                    </span>
                                </div>

                                <div className="flex gap-3 justify-end mt-4">
                                    <Button type="button" variant="outline" onClick={() => setIsBooking(false)}>Cancel</Button>
                                    <Button type="submit" disabled={loading}>
                                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Proceed to Payment"}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                )}

                {/* TABS: UPCOMING vs PAST */}
                <Tabs defaultValue="upcoming" className="w-full">
                    <TabsList className="grid w-full max-w-md grid-cols-2">
                        <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                        <TabsTrigger value="past">Past History</TabsTrigger>
                    </TabsList>

                    <TabsContent value="upcoming" className="mt-6 space-y-4">
                        {(() => {
                            // 🟢 STEP 1: Filter the list ONE time and save it.
                            const upcomingAppointments = appointments.filter(apt => {
                                // 🟢 FIX: Ensure 'CANCELLED' items are removed from 'Upcoming' immediately
                                if (apt.status === 'CANCELLED' || apt.status === 'COMPLETED') return false;

                                if (!apt.timeSlot) return false;
                                const aptDate = new Date(apt.timeSlot);
                                const startOfToday = new Date();
                                startOfToday.setHours(0, 0, 0, 0);
                                return aptDate >= startOfToday;
                            });

                            // 🟢 STEP 2: Check the length of the new, filtered list.
                            if (loadingAppointments) {
                                return <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>;
                            }

                            if (upcomingAppointments.length === 0) {
                                return <div className="text-center text-muted-foreground py-10">No upcoming appointments.</div>;
                            }

                            // 🟢 STEP 3: Map over the SAME filtered list to render the cards.
                            return upcomingAppointments.map((apt, i) => {
                                // HYBRID READ: FHIR Fallback
                                const timeSlot = apt.resource?.start || apt.timeSlot;
                                const doctorNameOverride = apt.resource?.participant?.find((p: any) => p.actor?.reference?.includes('Practitioner'))?.actor?.display;

                                const docProfile = doctors.find(d => d.doctorId === apt.doctorId);
                                const docName = docProfile?.name || doctorNameOverride || apt.doctorName || "Doctor";
                                const docSpecialty = docProfile?.specialization || "General Practice";
                                const dateObj = new Date(timeSlot);

                                return (
                                    <Card key={i} className="hover:shadow-md transition-shadow">
                                        <CardContent className="p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                                            <div className="flex gap-4 items-center">
                                                {/* 🟢 NEW: DOCTOR AVATAR */}
                                                <Avatar className="h-12 w-12 border shadow-sm">
                                                    <AvatarImage src={docProfile?.avatar} className="object-cover" />
                                                    <AvatarFallback>{docProfile?.name?.substring(0, 2).toUpperCase() || "DR"}</AvatarFallback>
                                                </Avatar>

                                                {/* Date Badge */}
                                                <div className="bg-primary/10 p-3 rounded-lg text-primary text-center min-w-[60px]">
                                                    <div className="font-bold text-xl">{dateObj.getDate()}</div>
                                                    <div className="text-xs font-bold uppercase">{dateObj.toLocaleString('default', { month: 'short' })}</div>
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="font-semibold text-lg">{docName}</h3>

                                                    </div>
                                                    <div className="flex gap-4 text-sm text-muted-foreground mt-1 items-center">
                                                        <span className="flex items-center gap-1 text-primary/80 font-medium">
                                                            <Stethoscope className="h-3 w-3" /> {docSpecialty}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="h-3 w-3" />
                                                            {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 items-center">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-9 border-slate-200 text-slate-600"
                                                    onClick={async () => {
                                                        try {
                                                            const res: any = await api.get(`/receipt/${apt.appointmentId}`);
                                                            if (res.downloadUrl) window.open(res.downloadUrl, '_blank');
                                                        } catch (e) {
                                                            toast({ variant: "destructive", title: "Error", description: "Receipt not ready." });
                                                        }
                                                    }}
                                                >
                                                    <FileText className="h-4 w-4 mr-1" /> Receipt
                                                </Button>

                                                <Button variant="outline" size="sm" className="h-9 text-red-600 border-red-100 hover:bg-red-50" onClick={() => handleCancel(apt.appointmentId)}>
                                                    Cancel
                                                </Button>

                                                <Button size="sm" className="h-9" onClick={() => handleJoin(apt)}>
                                                    <Video className="h-4 w-4 mr-1" /> Join
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            });
                        })()}
                    </TabsContent>

                    <TabsContent value="past" className="mt-6">
                        {appointments
                            .filter(apt => {
                                const isPast = new Date(apt.timeSlot) < new Date();
                                const isDone = apt.status === 'CANCELLED' || apt.status === 'COMPLETED';
                                const hasData = apt.timeSlot && apt.doctorId;
                                const realDoctor = doctors.find(d => d.doctorId === apt.doctorId);
                                return (isPast || isDone) && hasData && realDoctor;
                            })
                            .map((apt, i) => {
                                const docProfile = doctors.find(d => d.doctorId === apt.doctorId);
                                const dateObj = new Date(apt.timeSlot);

                                return (
                                    <Card key={i} className="mb-4 opacity-75 bg-gray-50 hover:opacity-100 transition-opacity">
                                        <CardContent className="p-4 flex flex-col md:flex-row justify-between items-center gap-4">
                                            <div className="flex items-center gap-4">
                                                <div className="bg-gray-200 p-2 rounded text-center min-w-[50px]">
                                                    <div className="font-bold text-gray-600">{dateObj.getDate()}</div>
                                                    <div className="text-[10px] font-bold uppercase text-gray-500">{dateObj.toLocaleString('default', { month: 'short' })}</div>
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-lg">{docProfile?.name}</div>
                                                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                                                        <span>{docProfile?.specialization}</span>
                                                        <span>•</span>
                                                        <span>{dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* 🟢 Action Area: Receipt + Status */}
                                            <div className="flex items-center gap-3">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8"
                                                    onClick={async () => {
                                                        try {
                                                            const res: any = await api.get(`/receipt/${apt.appointmentId}`);
                                                            if (res.downloadUrl) window.open(res.downloadUrl, '_blank');
                                                        } catch (e) {
                                                            toast({ variant: "destructive", title: "Error", description: "Receipt not available." });
                                                        }
                                                    }}
                                                >
                                                    <FileText className="h-4 w-4 mr-2" /> Receipt
                                                </Button>

                                                <Badge variant={apt.status === 'CANCELLED' ? 'destructive' : 'outline'}>
                                                    {apt.status || 'COMPLETED'}
                                                </Badge>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}

                        {/* Empty State */}
                        {appointments.filter(a => a.status === 'CANCELLED' || a.status === 'COMPLETED' || new Date(a.timeSlot) < new Date()).length === 0 && (
                            <div className="text-center text-muted-foreground py-10">No past appointments.</div>
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </DashboardLayout>
    );
}