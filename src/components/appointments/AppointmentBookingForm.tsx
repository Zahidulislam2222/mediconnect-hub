import { useState, useEffect, useMemo, useRef, useId } from "react";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useCheckout } from "@/context/CheckoutContext";
import { usePaymentLifetime } from "@/hooks/use-payment-lifetime";
import { api } from "@/lib/api";
import { appointmentRouting } from "@/config/env";
import { bookingContent as copy, bookingPolicy } from "@/lib/booking-content";
import { bookingDoctorSchema, loadBookingAvailability, parseBookingFee, type BookingAvailability } from "@/lib/booking-availability";

interface Props { doctors: unknown[]; onCancel: () => void; onSuccess: () => void }
const acknowledgement = z.object({ id: z.string().trim().min(1) });
const paymentSelection = z.object({ id: z.string().trim().min(1) });

export function AppointmentBookingForm({ doctors, onCancel, onSuccess }: Props) {
    const { toast } = useToast();
    const { requestPayment } = useCheckout();
    const lifetime = usePaymentLifetime();
    const id = useId();
    const mounted = useRef(false);
    const submitting = useRef(false);
    const posted = useRef(false);
    const [busy, setBusy] = useState(false);
    const [uncertain, setUncertain] = useState(false);
    const [specialty, setSpecialty] = useState("");
    const [form, setForm] = useState({ doctorId: "", date: "", time: "" });
    const [availability, setAvailability] = useState<(BookingAvailability & { key: string }) | null>(null);
    const [loading, setLoading] = useState(false);
    const [scheduleError, setScheduleError] = useState(false);
    const validDoctors = useMemo(() => doctors.flatMap(value => {
        const parsed = bookingDoctorSchema.safeParse(value);
        return parsed.success ? [parsed.data] : [];
    }), [doctors]);
    const specialties = useMemo(() => [...new Set(validDoctors.map(doctor => doctor.specialization))].sort(), [validDoctors]);
    const filteredDoctors = validDoctors.filter(doctor => doctor.specialization === specialty);
    const selectedDoctor = filteredDoctors.find(doctor => doctor.doctorId === form.doctorId);
    const fee = parseBookingFee(selectedDoctor?.consultationFee);
    const formattedFee = fee === null ? '' : new Intl.NumberFormat(bookingPolicy.displayLocale,
        { style: 'currency', currency: bookingPolicy.currency }).format(fee);
    const selectionKey = JSON.stringify([form.doctorId, form.date]);
    const currentAvailability = availability?.key === selectionKey ? availability : null;
    const selectedSlot = currentAvailability?.slots.find(slot => slot.start === form.time);
    const currentSelection = useRef({ selectionKey, time: form.time, fee, doctorId: selectedDoctor?.doctorId });
    currentSelection.current = { selectionKey, time: form.time, fee, doctorId: selectedDoctor?.doctorId };
    const canSubmit = !busy && !uncertain && !loading && fee !== null && selectedDoctor && selectedSlot && Date.parse(selectedSlot.start) > Date.now();

    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; };
    }, []);
    useEffect(() => {
        const controller = new AbortController();
        setAvailability(null); setScheduleError(false);
        if (!form.doctorId || !form.date) { setLoading(false); return () => controller.abort(); }
        setLoading(true);
        loadBookingAvailability(form.doctorId, form.date, api.get, controller.signal, Date.now()).then(value => {
            if (!controller.signal.aborted) setAvailability({ ...value, key: selectionKey });
        }).catch(() => {
            if (!controller.signal.aborted) setScheduleError(true);
        }).finally(() => {
            if (!controller.signal.aborted) setLoading(false);
        });
        return () => controller.abort();
    }, [form.doctorId, form.date, selectionKey]);

    const handleBook = async (event: React.FormEvent) => {
        event.preventDefault();
        const signal = lifetime.current.signal;
        if (!mounted.current || signal.aborted || submitting.current || posted.current || !canSubmit || !selectedDoctor || !selectedSlot || fee === null) return;
        submitting.current = true; setBusy(true);
        const snapshot = currentSelection.current;
        const active = () => mounted.current && !signal.aborted && lifetime.current.signal === signal;
        try {
            const method = await requestPayment({ amount: fee, title: copy.paymentTitle,
                description: copy.paymentDescription.replace("{doctor}", selectedDoctor.name),
                presentation: { amount: formattedFee, label: copy.fee, disclosure: copy.feeDisclosure, confirmLabel: copy.selectPaymentMethod } });
            if (!active()) return;
            const current = currentSelection.current;
            if (current.selectionKey !== snapshot.selectionKey || current.time !== snapshot.time || current.fee !== snapshot.fee ||
                current.doctorId !== snapshot.doctorId || Date.parse(selectedSlot.start) <= Date.now()) {
                toast({ variant: "destructive", title: copy.errorTitle, description: copy.selectionChanged }); return;
            }
            const token = paymentSelection.parse(method);
            // Once submitted, a lost acknowledgement may hide a completed charge. Never replay here.
            posted.current = true;
            const response = await api.post(appointmentRouting.book, { doctorId: selectedDoctor.doctorId,
                doctorName: selectedDoctor.name, timeSlot: selectedSlot.start, paymentToken: token.id }, { signal });
            if (!active()) return;
            acknowledgement.parse(response);
            toast({ title: copy.successTitle, description: copy.successDescription });
            onSuccess();
        } catch {
            if (!active()) return;
            if (posted.current) setUncertain(true);
            toast({ variant: "destructive", title: copy.errorTitle,
                description: posted.current ? copy.unknownOutcome : copy.paymentUnavailable });
        } finally {
            submitting.current = false;
            if (active()) setBusy(false);
        }
    };

    return (
        <Card className="border-primary/20 shadow-lg bg-primary/5 mb-6 animate-fade-in">
            <CardHeader><CardTitle>{copy.title}</CardTitle></CardHeader>
            <CardContent>
                <form onSubmit={handleBook} className="space-y-4">
                    <fieldset disabled={busy || uncertain} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor={`${id}-specialty`}>{copy.specialty}</Label>
                            <select id={`${id}-specialty`} className="flex h-10 w-full rounded-md border bg-background px-3 capitalize"
                                value={specialty} required onChange={event => {
                                    setSpecialty(event.target.value); setForm(previous => ({ ...previous, doctorId: "", time: "" }));
                                }}>
                                <option value="">{copy.chooseSpecialty}</option>
                                {specialties.map(value => <option key={value} value={value}>{value.replace(/_/g, ' ')}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`${id}-doctor`}>{copy.doctor}</Label>
                            <select id={`${id}-doctor`} className="flex h-10 w-full rounded-md border bg-background px-3"
                                value={form.doctorId} disabled={!specialty} required
                                onChange={event => setForm(previous => ({ ...previous, doctorId: event.target.value, time: "" }))}>
                                <option value="">{copy.chooseDoctor}</option>
                                {filteredDoctors.map(doctor => <option key={doctor.doctorId} value={doctor.doctorId}>{doctor.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`${id}-date`}>{copy.date}</Label>
                            <Input id={`${id}-date`} type="date" value={form.date} required disabled={!selectedDoctor}
                                onChange={event => setForm(previous => ({ ...previous, date: event.target.value, time: "" }))} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`${id}-time`}>{copy.time}
                                {currentAvailability && <span className="text-xs text-muted-foreground ml-2">({currentAvailability.timezone})</span>}
                            </Label>
                            <select id={`${id}-time`} className="flex h-10 w-full rounded-md border bg-background px-3"
                                value={form.time} required disabled={loading || !currentAvailability?.slots.length}
                                onChange={event => setForm(previous => ({ ...previous, time: event.target.value }))}>
                                <option value="">{loading ? copy.loading : currentAvailability?.slots.length ? copy.chooseTime : copy.noSlots}</option>
                                {currentAvailability?.slots.map(slot => <option key={slot.start} value={slot.start}>{slot.label}</option>)}
                            </select>
                        </div>
                    </fieldset>
                    {scheduleError && <p role="alert" className="text-destructive">{copy.scheduleError}</p>}
                    {selectedDoctor && <div className="p-4 bg-muted rounded-md border space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">{copy.fee}</span>
                            {fee !== null && <span className="font-bold text-foreground">{formattedFee}</span>}
                        </div>
                        <p className="text-sm text-muted-foreground">{fee === null ? copy.feeUnavailable : copy.feeDisclosure}</p>
                    </div>}
                    {uncertain && <p role="alert" className="text-destructive">{copy.unknownOutcome}</p>}
                    <div className="flex gap-3 justify-end mt-4">
                        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>{copy.cancel}</Button>
                        <Button type="submit" disabled={!canSubmit}>
                            {busy && <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />}{copy.proceed}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
