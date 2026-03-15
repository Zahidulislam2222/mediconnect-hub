import { useState, useEffect, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useCheckout } from "@/context/CheckoutContext";
import { api } from "@/lib/api";

interface Props {
    doctors: any[];
    onCancel: () => void;
    onSuccess: () => void;
}

export function AppointmentBookingForm({ doctors, onCancel, onSuccess }: Props) {
    const { toast } = useToast();
    const { requestPayment } = useCheckout();

    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // New 2-Step State
    const [selectedSpecialty, setSelectedSpecialty] = useState("");
    const[formData, setFormData] = useState({ doctorId: "", date: "", time: "09:00" });

    const [availableSlots, setAvailableSlots] = useState<string[]>([]);
    const[loadingSlots, setLoadingSlots] = useState(false);
    const [doctorTimezone, setDoctorTimezone] = useState("UTC");

    // Extract unique, formatted specialties from the doctors array
    const specialties = useMemo(() => {
        const specs = doctors.map(d => d.specialization).filter(Boolean);
        return Array.from(new Set(specs)).sort();
    }, [doctors]);

    // Filter doctors based on selected specialty
    const filteredDoctors = useMemo(() => {
        if (!selectedSpecialty) return[];
        return doctors.filter(d => d.specialization === selectedSpecialty);
    }, [doctors, selectedSpecialty]);

    // Reset doctor selection if specialty changes
    useEffect(() => {
        setFormData(prev => ({ ...prev, doctorId: "", time: "09:00" }));
        setAvailableSlots([]);
    }, [selectedSpecialty]);

    // Smart Schedule Logic
    useEffect(() => {
        if (!formData.doctorId || !formData.date) return;

        async function fetchSlots() {
            setLoadingSlots(true);
            setAvailableSlots([]);
            try {
                const [bookingRes, scheduleRes]: any = await Promise.all([
                    api.get(`/appointments?doctorId=${formData.doctorId}`),
                    api.get(`/doctors/${formData.doctorId}/schedule`)
                ]);

                const bookings = bookingRes.existingBookings ||[];
                const weeklySchedule = scheduleRes.schedule || {};
                setDoctorTimezone(scheduleRes.timezone || "UTC");

                const dateObj = new Date(formData.date);
                const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
                const shift = weeklySchedule[dayName];

                if (!shift || shift === "OFF") return;

                const [startStr, endStr] = shift.split('-');
                const startHour = parseInt(startStr.split(':')[0]);
                const endHour = parseInt(endStr.split(':')[0]);

                const slots =[];
                for (let h = startHour; h < endHour; h++) {
                    const timeStr = `${h.toString().padStart(2, '0')}:00`;
                    const isTaken = bookings.some((b: any) => {
                        if (b.status === 'CANCELLED') return false;
                        const bookedTime = b.resource?.start || b.timeSlot;
                        if (!bookedTime) return false;

                        const dbTimeStr = bookedTime.split('.')[0].split('Z')[0] + "Z";
                        const dropdownTimeStr = `${formData.date}T${timeStr}:00Z`;
                        return dbTimeStr === dropdownTimeStr;
                    });
                    if (!isTaken) slots.push(timeStr);
                }
                setAvailableSlots(slots);
            } catch (e) {
                toast({ variant: "destructive", title: "Schedule Error", description: "Could not load availability." });
            } finally {
                setLoadingSlots(false);
            }
        }
        fetchSlots();
    }, [formData.doctorId, formData.date, toast]);

    const handleBook = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const selectedDoc = doctors.find(d => d.doctorId === formData.doctorId);
            const currentPrice = selectedDoc?.consultationFee || 50;
            const timeSlotISO = `${formData.date}T${formData.time}:00`;

            const paymentMethod = await requestPayment({
                amount: currentPrice,
                title: "Confirm Appointment",
                description: `Consultation with ${selectedDoc?.name || "Doctor"}`
            });

            await api.post('/appointments', {
                doctorId: formData.doctorId,
                doctorName: selectedDoc?.name || "Doctor",
                timeSlot: timeSlotISO,
                paymentToken: paymentMethod.id
            });

            toast({ title: "Success!", description: `Booked successfully.` });
            onSuccess(); // Tell parent to refresh and close form

        } catch (error: any) {
            if (error.message !== "User cancelled payment") {
                toast({ variant: "destructive", title: "Error", description: error.message });
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const selectedDoc = doctors.find(d => d.doctorId === formData.doctorId);

    return (
        <Card className="border-primary/20 shadow-lg bg-primary/5 mb-6 animate-fade-in">
            <CardHeader><CardTitle>Book New Appointment</CardTitle></CardHeader>
            <CardContent>
                <form onSubmit={handleBook} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        {/* STEP 1: Specialty */}
                        <div className="space-y-2">
                            <Label>1. Select Specialty</Label>
                            <select
                                className="flex h-10 w-full rounded-md border bg-background px-3 capitalize"
                                value={selectedSpecialty}
                                onChange={(e) => setSelectedSpecialty(e.target.value)}
                                required
                            >
                                <option value="">-- Choose Specialty --</option>
                                {specialties.map((spec, i) => (
                                    <option key={i} value={spec as string}>
                                        {String(spec).replace(/_/g, ' ')}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* STEP 2: Doctor (Disabled if no specialty selected) */}
                        <div className="space-y-2">
                            <Label>2. Select Doctor</Label>
                            <select
                                className="flex h-10 w-full rounded-md border bg-background px-3"
                                value={formData.doctorId}
                                onChange={(e) => setFormData({ ...formData, doctorId: e.target.value })}
                                disabled={!selectedSpecialty}
                                required
                            >
                                <option value="">-- Choose Doctor --</option>
                                {filteredDoctors.map((doc, i) => (
                                    <option key={i} value={doc.doctorId}>
                                        {doc.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Date */}
                        <div className="space-y-2">
                            <Label>Date</Label>
                            <Input
                                type="date"
                                value={formData.date}
                                min={new Date().toISOString().split('T')[0]}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                disabled={!formData.doctorId}
                                required
                            />
                        </div>

                        {/* Time Slot */}
                        <div className="space-y-2">
                            <Label>
                                Time Slot
                                {loadingSlots && <span className="text-xs text-muted-foreground ml-2">(Loading...)</span>}
                                {!loadingSlots && doctorTimezone && (
                                    <span className="text-xs text-blue-600 ml-2 font-medium">({doctorTimezone} Time)</span>
                                )}
                            </Label>
                            <select
                                className="flex h-10 w-full rounded-md border bg-background px-3"
                                value={formData.time}
                                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                                disabled={loadingSlots || availableSlots.length === 0 || !formData.date}
                                required
                            >
                                {availableSlots.length === 0 ? (
                                    <option>No slots available</option>
                                ) : (
                                    availableSlots.map(slot => <option key={slot} value={slot}>{slot}</option>)
                                )}
                            </select>
                        </div>
                    </div>

                    {selectedDoc && (
                        <div className="p-4 bg-slate-50 rounded-md border mt-2 flex justify-between items-center">
                            <span className="text-sm text-slate-500">Consultation Fee</span>
                            <span className="font-bold text-slate-900">
                                ${selectedDoc.consultationFee || 50}.00
                            </span>
                        </div>
                    )}

                    <div className="flex gap-3 justify-end mt-4">
                        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting || !formData.doctorId || availableSlots.length === 0}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Proceed to Payment"}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}