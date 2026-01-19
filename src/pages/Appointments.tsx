import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchUserAttributes, fetchAuthSession } from 'aws-amplify/auth';
import { Clock, Video, Plus, Loader2, CreditCard, ShieldCheck, Stethoscope } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

// --- STRIPE IMPORTS ---
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

export default function Appointments() {
    return (
        <Elements stripe={stripePromise}>
            <AppointmentsContent />
        </Elements>
    );
}

function AppointmentsContent() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const stripe = useStripe();
    const elements = useElements();

    // User State
    const [user, setUser] = useState<any>(null);

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
        insuranceProvider: "",
        policyId: ""
    });

    // Dynamic Slot State
    const [availableSlots, setAvailableSlots] = useState<string[]>([]);
    const [loadingSlots, setLoadingSlots] = useState(false);

    // Price
    const price = (formData.insuranceProvider && formData.policyId) ? 20 : 50;

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
            const token = await getAuthToken();
            const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/doctor-appointments?patientId=${patientId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Failed to fetch");
            const data = await res.json();
            const list = Array.isArray(data) ? data : [];

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
                const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/doctors`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                const json = await res.json();

                // The Python Lambda returns { "doctors": [...] }
                if (json.doctors) setDoctors(json.doctors);
                else if (Array.isArray(json)) setDoctors(json);

            } catch (e) { console.error("Doctor Directory Error:", e); }
        }

        async function getUser() {
            try {
                const attr = await fetchUserAttributes();
                const u = {
                    id: attr.sub,
                    name: attr.name || attr.email,
                    avatar: ""
                };
                setUser(u);
                await fetchAppointments(u.id);
            } catch (e) { }
        }
        getUser();
        fetchDoctors();
    }, []);

    // --- SMART SCHEDULE LOGIC ---
    useEffect(() => {
        if (!formData.doctorId || !formData.date) return;

        async function fetchSlots() {
            setLoadingSlots(true);
            setAvailableSlots([]);
            try {
                const token = await getAuthToken();
                const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/doctor-appointments?doctorId=${formData.doctorId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();

                const bookings = data.existingBookings || [];
                const weeklySchedule = data.weeklySchedule || {};

                // 1. Determine Day
                const dateObj = new Date(formData.date);
                const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });

                // 2. Get Shift
                const shift = weeklySchedule[dayName];

                if (!shift || shift === "OFF") {
                    setAvailableSlots([]);
                    return;
                }

                // 3. Generate Slots
                const [startStr, endStr] = shift.split('-');
                const startHour = parseInt(startStr.split(':')[0]);
                const endHour = parseInt(endStr.split(':')[0]);

                const slots = [];
                for (let h = startHour; h < endHour; h++) {
                    const timeStr = `${h.toString().padStart(2, '0')}:00`;
                    const slotISO = new Date(`${formData.date}T${timeStr}:00`).toISOString();
                    const isTaken = bookings.some((b: any) => b.timeSlot === slotISO);

                    if (!isTaken) slots.push(timeStr);
                }
                setAvailableSlots(slots);

            } catch (e) {
                console.error("Slot error", e);
            } finally {
                setLoadingSlots(false);
            }
        }
        fetchSlots();
    }, [formData.doctorId, formData.date]);


    // --- HANDLING BOOKING ---
    const handleBook = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!stripe || !elements) return;
        setLoading(true);

        try {
            const token = await getAuthToken();
            const selectedDoc = doctors.find(d => d.doctorId === formData.doctorId);
            const timeSlotISO = new Date(`${formData.date}T${formData.time}:00`).toISOString();

            // 1. Get Stripe Token
            const cardElement = elements.getElement(CardElement);
            if (!cardElement) throw new Error("Card input not found");
            const { error, paymentMethod } = await stripe.createPaymentMethod({ type: 'card', card: cardElement });
            if (error) throw new Error(error.message);

            // 2. Send Payload
            const payload = {
                patientId: user?.id,
                patientName: user?.name,
                doctorId: formData.doctorId,
                doctorName: selectedDoc?.name || "Doctor",
                timeSlot: timeSlotISO,
                paymentToken: paymentMethod.id,
                insuranceProvider: formData.insuranceProvider,
                policyId: formData.policyId
            };

            const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/book-appointment`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                if (res.status === 409) throw new Error("Slot just taken. Please pick another.");
                throw new Error("Booking failed");
            }

            await fetchAppointments(user.id);
            setIsBooking(false);
            setFormData({ doctorId: "", date: "", time: "", insuranceProvider: "", policyId: "" });
            toast({ title: "Success!", description: `Booked for $${price}.00` });

        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setLoading(false);
        }
    };

    // --- HANDLING CANCELLATION ---
    const handleCancel = async (appointmentId: string) => {
        if (!confirm("Are you sure? This will refund your payment.")) return;

        try {
            const token = await getAuthToken();
            const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/cancel-appointment`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ appointmentId, patientId: user.id })
            });

            if (!res.ok) throw new Error("Cancel failed");

            toast({ title: "Cancelled", description: "Appointment cancelled and refunded." });
            fetchAppointments(user.id);
        } catch (e) {
            toast({ variant: "destructive", title: "Error", description: "Could not cancel." });
        }
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
                                        <Label>Time Slot {loadingSlots && <span className="text-xs text-muted-foreground">(Loading...)</span>}</Label>
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

                                {/* INSURANCE SECTION */}
                                <div className="p-4 bg-white rounded-md border mt-2">
                                    <div className="flex items-center gap-2 mb-3 text-blue-800 font-semibold">
                                        <ShieldCheck className="h-4 w-4" /> Insurance (Optional)
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Provider</Label>
                                            <Input
                                                placeholder="e.g. BlueCross"
                                                value={formData.insuranceProvider}
                                                onChange={(e) => setFormData({ ...formData, insuranceProvider: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Policy ID</Label>
                                            <Input
                                                placeholder="e.g. POL-12345"
                                                value={formData.policyId}
                                                onChange={(e) => setFormData({ ...formData, policyId: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* PAYMENT SECTION */}
                                <div className="p-4 bg-white rounded-md border mt-2">
                                    <Label className="mb-2 block flex items-center justify-between">
                                        <span className="flex items-center gap-2"><CreditCard className="w-4 h-4" /> Credit Card</span>
                                        <span className={price === 20 ? "text-green-600 font-bold" : "text-gray-900 font-bold"}>
                                            Total: ${price}.00 {price === 20 && "(Insurance Applied)"}
                                        </span>
                                    </Label>
                                    <div className="p-3 border rounded-md">
                                        <CardElement options={{ style: { base: { fontSize: '16px' } } }} />
                                    </div>
                                </div>

                                <div className="flex gap-3 justify-end mt-4">
                                    <Button type="button" variant="outline" onClick={() => setIsBooking(false)}>Cancel</Button>
                                    <Button type="submit" disabled={loading || !stripe}>
                                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Pay & Confirm"}
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
                        {loadingAppointments ? (
                            <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>
                        ) : appointments.filter(a => a.status !== 'CANCELLED').length > 0 ? (
                            appointments.filter(a => a.status !== 'CANCELLED').map((apt, i) => {
                                // 🟢 DYNAMIC LOOKUP LOGIC
                                // 1. Find doctor profile from the directory
                                const docProfile = doctors.find(d => d.doctorId === apt.doctorId);
                                // 2. Use Live Name or Fallback
                                const docName = docProfile?.name || apt.doctorName || "Dr. Medical Officer";
                                // 3. Use Live Specialization or Fallback
                                const docSpecialty = docProfile?.specialization || "General Practice";

                                return (
                                    <Card key={i} className="hover:shadow-md transition-shadow">
                                        <CardContent className="p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                                            <div className="flex gap-4 items-center">
                                                <div className="bg-primary/10 p-3 rounded-lg text-primary text-center min-w-[60px]">
                                                    <div className="font-bold text-xl">{new Date(apt.timeSlot || apt.date).getDate()}</div>
                                                    <div className="text-xs font-bold uppercase">{new Date(apt.timeSlot || apt.date).toLocaleString('default', { month: 'short' })}</div>
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="font-semibold text-lg">{docName}</h3>
                                                        {apt.coverageType?.includes('INSURANCE') && <Badge variant="secondary">Insured</Badge>}
                                                    </div>
                                                    {/* 🟢 NEW: DISPLAY SPECIALIZATION */}
                                                    <div className="flex gap-4 text-sm text-muted-foreground mt-1 items-center">
                                                        <span className="flex items-center gap-1 text-primary/80 font-medium">
                                                            <Stethoscope className="h-3 w-3" /> {docSpecialty}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="h-3 w-3" /> {new Date(apt.timeSlot || apt.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button variant="outline" className="text-red-600 hover:text-red-700" onClick={() => handleCancel(apt.appointmentId)}>
                                                    Cancel
                                                </Button>
                                                <Button onClick={() => navigate("/consultation")}>
                                                    <Video className="h-4 w-4 mr-2" /> Join
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })
                        ) : (
                            <div className="text-center text-muted-foreground py-10">No upcoming appointments.</div>
                        )}
                    </TabsContent>

                    <TabsContent value="past" className="mt-6">
                        {appointments.filter(a => a.status === 'CANCELLED' || new Date(a.timeSlot) < new Date()).map((apt, i) => {
                            // Dynamic Lookup also for Past History
                            const docProfile = doctors.find(d => d.doctorId === apt.doctorId);
                            const docName = docProfile?.name || apt.doctorName || "Dr. Medical Officer";

                            return (
                                <Card key={i} className="mb-4 opacity-75 bg-gray-50">
                                    <CardContent className="p-4 flex justify-between items-center">
                                        <div>
                                            <div className="font-semibold">{docName}</div>
                                            <div className="text-sm text-muted-foreground">{new Date(apt.timeSlot).toLocaleDateString()}</div>
                                        </div>
                                        <Badge variant={apt.status === 'CANCELLED' ? 'destructive' : 'outline'}>
                                            {apt.status || 'COMPLETED'}
                                        </Badge>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </TabsContent>
                </Tabs>
            </div>
        </DashboardLayout>
    );
}