import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser, signOut, fetchAuthSession } from 'aws-amplify/auth';
import {
    Pill, FileSignature, AlertTriangle, CheckCircle2,
    Plus, RefreshCw, Loader2, ClipboardList,
    ShieldCheck, User, ArrowLeft, Search, Calendar
} from "lucide-react";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

import { api } from "@/lib/api";

export default function Prescriptions() {
    const navigate = useNavigate();
    const { toast } = useToast();

    // --- STATE ---
    const [user, setUser] = useState<any>({ name: "Doctor", id: "" });
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // Data
    const [prescriptions, setPrescriptions] = useState<any[]>([]);
    const [patientList, setPatientList] = useState<any[]>([]);

    // NAVIGATION STATE (The "Master-Detail" Logic)
    const [selectedPatient, setSelectedPatient] = useState<any | null>(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [interactionError, setInteractionError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        medication: "",
        dosage: "",
        instructions: ""
    });

    const commonDosages = ["250mg", "500mg", "1000mg", "5ml", "10ml"];

    // --- 1. INITIAL LOAD ---
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const authUser = await getCurrentUser();
            const userId = authUser.userId;

            const [profileData, appointmentsData, rxData] = await Promise.all([
                api.get(`/register-doctor?id=${userId}`).catch(() => null),
                api.get(`/doctor-appointments?doctorId=${userId}`).catch(() => null),
                api.get(`/prescription?doctorId=${userId}`).catch(() => null)
            ]);

            // Set Profile
            if (profileData) {
                const data: any = profileData;
                const profile = data.doctors?.find((d: any) => d.doctorId === userId) || data;
                setUser({ name: profile.name, id: userId, avatar: profile.avatar });
            }

            // Set Prescriptions
            if (rxData) {
                const data: any = rxData;
                setPrescriptions(data.prescriptions || []);
            }

            // Build Unique Patient List
            if (appointmentsData) {
                const data: any = appointmentsData;
                const rawList = data.existingBookings || [];
                const uniqueMap = new Map();

                rawList.forEach((apt: any) => {
                    if (apt.patientId && apt.patientName) {
                        uniqueMap.set(apt.patientId, {
                            id: apt.patientId,
                            name: apt.patientName,
                            lastVisit: apt.date,
                            avatar: "" // Placeholder
                        });
                    }
                });

                // 🟢 NEW: Fetch real profiles to get the photos
                const uniqueIds = Array.from(uniqueMap.keys());
                if (uniqueIds.length > 0) {
                    const profilePromises = uniqueIds.map(pid =>
                        api.get(`/register-patient?id=${pid}`).catch(() => null)
                    );
                    const profiles = await Promise.all(profilePromises);

                    profiles.forEach(p => {
                        if (p) {
                            const profileData = p.Item || p;
                            // Match by patientId or id depending on your DB structure
                            const pid = profileData.patientId || profileData.id;
                            if (uniqueMap.has(pid)) {
                                uniqueMap.get(pid).avatar = profileData.avatar;
                            }
                        }
                    });
                }
                setPatientList(Array.from(uniqueMap.values()));
            }

        } catch (e) {
            console.error("Load Error", e);
            toast({ variant: "destructive", title: "Error", description: "Failed to load clinic data." });
        } finally {
            setIsLoading(false);
        }
    };

    // --- 2. ISSUE RX ---
    const handleIssueRx = async () => {
        if (!selectedPatient || !formData.medication || !formData.dosage) {
            toast({ variant: "destructive", title: "Missing Fields", description: "Please fill out all fields." });
            return;
        }

        setIsSubmitting(true);
        setInteractionError(null);

        try {
            const payload = {
                doctorId: user.id,
                patientId: selectedPatient.id, // Auto-selected
                medication: formData.medication,
                dosage: formData.dosage,
                instructions: formData.instructions
            };

            const data: any = await api.post(`/prescription`, payload);

            /* Handle 409 handled by try/catch in api.ts? No, api.ts throws. Need to catch specific or check response? */
            /* api utility throws on error. */

            toast({
                title: "Prescription Issued",
                description: "Digitally signed and sent to patient."
            });

            const newRx = {
                prescriptionId: data.prescriptionId,
                patientId: selectedPatient.id,
                medication: formData.medication,
                dosage: formData.dosage,
                instructions: formData.instructions,
                status: "ISSUED",
                timestamp: new Date().toISOString(),
                digitalSignature: data.digitalSignature
            };

            setPrescriptions([newRx, ...prescriptions]);
            setIsModalOpen(false);
            setFormData({ medication: "", dosage: "", instructions: "" });
        } catch (err) {
            toast({ variant: "destructive", title: "Error", description: "Failed to issue." });
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- 3. APPROVE REFILL ---
    const handleApproveRefill = async (rx: any) => {
        try {
            const updatedList = prescriptions.map(item =>
                item.prescriptionId === rx.prescriptionId
                    ? { ...item, status: "ISSUED", timestamp: new Date().toISOString() }
                    : item
            );
            setPrescriptions(updatedList);
            toast({ title: "Refill Approved", description: `Sent to pharmacy for ${rx.medication}` });

            await api.put(`/prescription`, { prescriptionId: rx.prescriptionId, status: "ISSUED" });
        } catch (e) {
            toast({ variant: "destructive", title: "Error", description: "Update failed." });
        }
    };

    // --- HELPERS ---
    const getInitials = (name: string) => name ? name.substring(0, 2).toUpperCase() : "PT";

    const filteredPatients = patientList.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Filter prescriptions for the SELECTED patient
    const patientRx = useMemo(() => {
        if (!selectedPatient) return [];
        return prescriptions.filter(p => p.patientId === selectedPatient.id);
    }, [prescriptions, selectedPatient]);

    const activeRx = patientRx.filter(p => p.status === "ISSUED");
    const refillRx = patientRx.filter(p => p.status === "REFILL_REQUESTED");

    // --- RENDER ---
    return (
        <DashboardLayout
            title="Prescriptions"
            subtitle="Manage medications & pharmacy orders"
            userRole="doctor"
            userName={user.name}
            userAvatar={user.avatar}
            onLogout={async () => { await signOut(); navigate("/"); }}
        >
            <div className="space-y-6 animate-fade-in pb-10">

                {/* 🟢 VIEW 1: PATIENT DIRECTORY (When no patient selected) */}
                {!selectedPatient ? (
                    <div className="space-y-6">
                        {/* Search Bar */}
                        <div className="flex items-center gap-4">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Search your patients..."
                                    className="pl-10"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Patient Grid */}
                        {isLoading ? (
                            <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-300" /></div>
                        ) : filteredPatients.length === 0 ? (
                            <div className="text-center py-20 bg-slate-50 rounded-xl border border-dashed">
                                <User className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                                <p className="text-slate-500">No patients found.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredPatients.map(patient => {
                                    const rxCount = prescriptions.filter(p => p.patientId === patient.id && p.status === "ISSUED").length;
                                    const refillCount = prescriptions.filter(p => p.patientId === patient.id && p.status === "REFILL_REQUESTED").length;

                                    return (
                                        <Card
                                            key={patient.id}
                                            className="cursor-pointer hover:shadow-md transition-all border-slate-200"
                                            onClick={() => setSelectedPatient(patient)}
                                        >
                                            <CardContent className="p-4 flex items-center gap-4">
                                                <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
                                                    {/* 🟢 NEW: Add AvatarImage here */}
                                                    <AvatarImage src={patient.avatar} className="object-cover" />
                                                    <AvatarFallback className="bg-primary/10 text-primary font-bold">
                                                        {getInitials(patient.name)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1">
                                                    <h4 className="font-semibold text-slate-900">{patient.name}</h4>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        {refillCount > 0 && (
                                                            <Badge variant="destructive" className="text-[10px] h-5 px-1.5">
                                                                {refillCount} Refill Req
                                                            </Badge>
                                                        )}
                                                        <span className="text-xs text-slate-500">
                                                            {rxCount} Active Meds
                                                        </span>
                                                    </div>
                                                </div>
                                                <Button variant="ghost" size="icon">
                                                    <ArrowLeft className="h-4 w-4 rotate-180 text-slate-400" />
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ) : (

                    // 🟢 VIEW 2: PRESCRIPTION MANAGER (Specific Patient)
                    <div className="space-y-6">
                        {/* Header with Back Button */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => setSelectedPatient(null)} // GO BACK TO LIST
                                    className="h-9 w-9"
                                    title="Back to Patient List"
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                </Button>

                                <div className="h-6 w-px bg-slate-200 mx-1"></div>

                                <div>
                                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                        {selectedPatient.name}
                                        <Badge variant="outline" className="ml-2 font-normal text-slate-500">
                                            KMS Secured
                                        </Badge>
                                    </h2>
                                </div>
                            </div>

                            <Button onClick={() => setIsModalOpen(true)} className="shadow-md bg-primary hover:bg-primary/90">
                                <Plus className="h-4 w-4 mr-2" /> New Prescription
                            </Button>
                        </div>

                        {/* Tabs: Active vs Refills */}
                        <Tabs defaultValue="active" className="space-y-6">
                            <TabsList className="bg-slate-100 p-1 w-full md:w-auto">
                                <TabsTrigger value="active" className="gap-2 px-6">
                                    <ClipboardList className="h-4 w-4" /> Active ({activeRx.length})
                                </TabsTrigger>
                                <TabsTrigger value="refills" className="gap-2 px-6">
                                    <RefreshCw className="h-4 w-4" /> Refill Requests
                                    {refillRx.length > 0 && (
                                        <span className="ml-1 bg-orange-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{refillRx.length}</span>
                                    )}
                                </TabsTrigger>
                            </TabsList>

                            {/* TAB: ACTIVE */}
                            <TabsContent value="active" className="space-y-4">
                                {activeRx.length === 0 ? (
                                    <div className="text-center py-16 bg-slate-50/50 rounded-xl border border-dashed">
                                        <Pill className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                                        <p className="text-slate-500">No active prescriptions for this patient.</p>
                                    </div>
                                ) : (
                                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                        {activeRx.map((rx) => (
                                            <Card key={rx.prescriptionId} className="shadow-sm hover:shadow-md transition-all">
                                                <CardHeader className="pb-2 flex flex-row items-start justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="bg-green-50 p-2 rounded-lg">
                                                            <Pill className="h-5 w-5 text-green-600" />
                                                        </div>
                                                        <div>
                                                            <CardTitle className="text-base">{rx.medication}</CardTitle>
                                                            <CardDescription className="text-xs">{new Date(rx.timestamp).toLocaleDateString()}</CardDescription>
                                                        </div>
                                                    </div>
                                                    <Badge className="bg-green-50 text-green-700 hover:bg-green-100 border-green-200">Active</Badge>
                                                </CardHeader>
                                                <CardContent className="pt-2">
                                                    <p className="font-semibold text-slate-800 mb-1">{rx.dosage}</p>
                                                    <div className="p-2 bg-slate-50 rounded text-xs text-slate-600 italic mb-2">
                                                        "{rx.instructions}"
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                                        <ShieldCheck className="h-3 w-3" /> Signed: {rx.digitalSignature?.substring(0, 8)}...
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </TabsContent>

                            {/* TAB: REFILLS */}
                            <TabsContent value="refills" className="space-y-4">
                                {refillRx.length === 0 ? (
                                    <div className="text-center py-16 bg-slate-50/50 rounded-xl border border-dashed">
                                        <CheckCircle2 className="h-10 w-10 mx-auto text-green-500/50 mb-2" />
                                        <p className="text-slate-500">No pending refill requests.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {refillRx.map((rx) => (
                                            <Card key={rx.prescriptionId} className="border-l-4 border-l-orange-500 shadow-sm flex flex-col md:flex-row items-center p-4 gap-4 bg-white">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Badge variant="outline" className="text-orange-600 bg-orange-50 border-orange-200">Refill Requested</Badge>
                                                        <span className="text-xs text-slate-400">{new Date(rx.updatedAt || rx.timestamp).toLocaleDateString()}</span>
                                                    </div>
                                                    <h4 className="font-semibold text-lg">{rx.medication} <span className="text-sm font-normal text-slate-500">• {rx.dosage}</span></h4>
                                                </div>
                                                <Button
                                                    className="bg-green-600 hover:bg-green-700 text-white"
                                                    onClick={() => handleApproveRefill(rx)}
                                                >
                                                    <CheckCircle2 className="w-4 h-4 mr-2" /> Approve
                                                </Button>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    </div>
                )}

                {/* MODAL: NEW PRESCRIPTION */}
                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>Prescribe to {selectedPatient?.name}</DialogTitle>
                            <DialogDescription>
                                Securely sign and transmit an e-prescription.
                            </DialogDescription>
                        </DialogHeader>

                        {interactionError && (
                            <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-start gap-3 animate-pulse">
                                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                                <div>
                                    <h5 className="text-sm font-bold text-red-800">CRITICAL SAFETY ALERT</h5>
                                    <p className="text-xs text-red-700 mt-1">{interactionError}</p>
                                </div>
                            </div>
                        )}

                        <div className="grid gap-4 py-2">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Patient</label>
                                <Input value={selectedPatient?.name} disabled className="bg-slate-50" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Medication</label>
                                    <Input
                                        placeholder="e.g. Amoxicillin"
                                        value={formData.medication}
                                        onChange={(e) => setFormData({ ...formData, medication: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Dosage</label>
                                    <Input
                                        placeholder="e.g. 500mg"
                                        value={formData.dosage}
                                        onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
                                    />
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {commonDosages.map(d => (
                                            <span
                                                key={d}
                                                onClick={() => setFormData({ ...formData, dosage: d })}
                                                className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded cursor-pointer"
                                            >
                                                {d}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Instructions</label>
                                <Textarea
                                    placeholder="e.g. Take twice daily with food..."
                                    value={formData.instructions}
                                    onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                            <Button onClick={handleIssueRx} disabled={isSubmitting} className="bg-primary">
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...
                                    </>
                                ) : (
                                    <>
                                        <FileSignature className="mr-2 h-4 w-4" /> Sign & Issue
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

            </div>
        </DashboardLayout>
    );
}