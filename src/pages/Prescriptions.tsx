import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser, signOut } from 'aws-amplify/auth';
import {
    Pill, FileSignature, AlertTriangle, CheckCircle2,
    Search, Plus, RefreshCw, Loader2, X, ClipboardList,
    ShieldCheck, Calendar
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
import { cn } from "@/lib/utils";

const API_URL = import.meta.env.VITE_API_BASE_URL || "";

export default function Prescriptions() {
    const navigate = useNavigate();
    const { toast } = useToast();

    // --- STATE ---
    const [user, setUser] = useState<any>({ name: "Doctor", id: "" });
    const [isLoading, setIsLoading] = useState(true);

    // Data Containers
    const [prescriptions, setPrescriptions] = useState<any[]>([]);
    const [patientList, setPatientList] = useState<any[]>([]); // For Dropdown

    // Modal & Form State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [interactionError, setInteractionError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        patientId: "",
        medication: "",
        dosage: "",
        instructions: ""
    });

    // --- 1. INITIAL LOAD (Parallel Fetching) ---
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const authUser = await getCurrentUser();
            const userId = authUser.userId;

            // Fetch Profile (for Name) & Schedule (for Patients) & Prescriptions (for List)
            const [profileRes, scheduleRes, rxRes] = await Promise.all([
                fetch(`${API_URL}/register-doctor?id=${userId}`),
                fetch(`${API_URL}/doctor-schedule?doctorId=${userId}`),
                fetch(`${API_URL}/prescription?doctorId=${userId}`)
            ]);

            // 1. Set User Profile
            if (profileRes.ok) {
                const data = await profileRes.json();
                const profile = data.doctors?.find((d: any) => d.doctorId === userId) || data;
                setUser({ name: profile.name, id: userId, avatar: profile.avatar });
            }

            // 2. Build Unique Patient List (for Dropdown)
            if (scheduleRes.ok) {
                const items = await scheduleRes.json();
                const rawList = Array.isArray(items) ? items : [];

                const uniqueMap = new Map();
                rawList.forEach((apt: any) => {
                    if (apt.patientId && apt.patientName) {
                        uniqueMap.set(apt.patientId, {
                            id: apt.patientId,
                            name: apt.patientName,
                            avatar: null // Appointments don't have avatars, use initials
                        });
                    }
                });
                setPatientList(Array.from(uniqueMap.values()));
            }

            // 3. Set Prescriptions
            if (rxRes.ok) {
                const data = await rxRes.json();
                setPrescriptions(data.prescriptions || []);
            }

        } catch (e) {
            console.error("Load Error", e);
            toast({ variant: "destructive", title: "Connection Error", description: "Failed to sync with Pharmacy Network." });
        } finally {
            setIsLoading(false);
        }
    };

    // --- 2. LOGIC: ISSUE NEW RX (POST) ---
    const handleIssueRx = async () => {
        if (!formData.patientId || !formData.medication || !formData.dosage) {
            toast({ variant: "destructive", title: "Missing Fields", description: "Please fill out all required fields." });
            return;
        }

        setIsSubmitting(true);
        setInteractionError(null);

        try {
            const payload = {
                doctorId: user.id,
                patientId: formData.patientId,
                medication: formData.medication,
                dosage: formData.dosage,
                instructions: formData.instructions,
                currentMeds: ["Aspirin"] // Simulation: In real app, fetch from EHR
            };

            const res = await fetch(`${API_URL}/prescription`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            // ⚠️ CRITICAL: Handle Drug Interactions (409 Conflict)
            if (res.status === 409) {
                const errorData = await res.json();
                setInteractionError(errorData.message); // Show Red Alert
                setIsSubmitting(false);
                return;
            }

            if (res.ok) {
                const data = await res.json();
                toast({
                    title: "Prescription Issued",
                    description: (
                        <div className="flex items-center gap-2 mt-1">
                            <ShieldCheck className="h-4 w-4 text-green-600" />
                            <span>Digitally Signed via AWS KMS</span>
                        </div>
                    )
                });

                // Add to local list immediately (Optimistic Update)
                const newRx = {
                    prescriptionId: data.prescriptionId,
                    patientId: formData.patientId,
                    medication: formData.medication,
                    dosage: formData.dosage,
                    instructions: formData.instructions,
                    status: "ISSUED",
                    timestamp: new Date().toISOString(),
                    digitalSignature: data.digitalSignature
                };

                setPrescriptions([newRx, ...prescriptions]);
                setIsModalOpen(false);
                setFormData({ patientId: "", medication: "", dosage: "", instructions: "" });
            } else {
                throw new Error("Failed to issue");
            }

        } catch (err) {
            toast({ variant: "destructive", title: "Error", description: "Could not issue prescription." });
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- 3. LOGIC: APPROVE REFILL (PUT) ---
    const handleApproveRefill = async (rx: any) => {
        try {
            // Optimistic UI Update
            const updatedList = prescriptions.map(item =>
                item.prescriptionId === rx.prescriptionId
                    ? { ...item, status: "ISSUED", timestamp: new Date().toISOString() }
                    : item
            );
            setPrescriptions(updatedList);
            toast({ title: "Refill Approved", description: `Sent to pharmacy for ${rx.medication}` });

            // Backend Call
            await fetch(`${API_URL}/prescription`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prescriptionId: rx.prescriptionId,
                    status: "ISSUED"
                })
            });
        } catch (e) {
            console.error(e);
            toast({ variant: "destructive", title: "Sync Error", description: "Changes may not have saved." });
        }
    };

    const handleLogout = async () => {
        await signOut();
        navigate("/");
    };

    // --- HELPER: Resolve Patient Name from ID ---
    const getPatientName = (pid: string) => {
        const found = patientList.find(p => p.id === pid);
        return found ? found.name : "Unknown Patient"; // Or fetch if missing
    };

    // --- HELPER: Initials ---
    const getInitials = (name: string) => name ? name.substring(0, 2).toUpperCase() : "RX";

    // --- MEMO: Filter Lists ---
    const activeRx = useMemo(() => prescriptions.filter(p => p.status === "ISSUED"), [prescriptions]);
    const refillRx = useMemo(() => prescriptions.filter(p => p.status === "REFILL_REQUESTED"), [prescriptions]);

    return (
        <DashboardLayout
            title="Prescriptions"
            subtitle="Manage medications & pharmacy orders"
            userRole="doctor"
            userName={user.name}
            userAvatar={user.avatar}
            onLogout={handleLogout}
        >
            <div className="space-y-6 animate-fade-in pb-10">

                {/* 1. HEADER ACTIONS */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex gap-2">
                        <Badge variant="outline" className="bg-white px-3 py-1 text-sm h-9">
                            <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-green-600" />
                            KMS Signing Active
                        </Badge>
                    </div>
                    <Button onClick={() => setIsModalOpen(true)} className="shadow-md bg-primary hover:bg-primary/90">
                        <Plus className="h-4 w-4 mr-2" /> New Prescription
                    </Button>
                </div>

                {/* 2. MAIN CONTENT TABS */}
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

                    {/* TAB A: ACTIVE PRESCRIPTIONS */}
                    <TabsContent value="active" className="space-y-4">
                        {isLoading ? (
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {[1, 2, 3].map(i => <div key={i} className="h-40 bg-muted/30 animate-pulse rounded-xl" />)}
                            </div>
                        ) : activeRx.length === 0 ? (
                            <div className="text-center py-16 bg-slate-50/50 rounded-xl border border-dashed">
                                <Pill className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                                <p className="text-slate-500">No active prescriptions found.</p>
                            </div>
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {activeRx.map((rx) => (
                                    <Card key={rx.prescriptionId} className="shadow-sm border-border/50 hover:shadow-md transition-all">
                                        <CardHeader className="pb-2 flex flex-row items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-10 w-10">
                                                    <AvatarFallback className="bg-blue-100 text-blue-700 font-bold">
                                                        {getInitials(getPatientName(rx.patientId))}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <CardTitle className="text-base text-slate-900">{getPatientName(rx.patientId)}</CardTitle>
                                                    <CardDescription className="text-xs">{new Date(rx.timestamp).toLocaleDateString()}</CardDescription>
                                                </div>
                                            </div>
                                            <Badge className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100">Active</Badge>
                                        </CardHeader>
                                        <CardContent className="pt-2 space-y-3">
                                            <div>
                                                <p className="font-semibold text-lg text-slate-800">{rx.medication}</p>
                                                <p className="text-sm text-slate-500">{rx.dosage}</p>
                                            </div>
                                            <div className="p-2 bg-slate-50 rounded text-xs text-slate-600 italic">
                                                "{rx.instructions}"
                                            </div>
                                            <div className="pt-2 border-t flex items-center justify-between text-[10px] text-slate-400">
                                                <span className="flex items-center gap-1">
                                                    <FileSignature className="h-3 w-3" />
                                                    Signed: {rx.digitalSignature ? `${rx.digitalSignature.substring(0, 8)}...` : "Legacy"}
                                                </span>
                                                <span className="font-mono">{rx.prescriptionId.substring(0, 8)}</span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    {/* TAB B: REFILL REQUESTS */}
                    <TabsContent value="refills" className="space-y-4">
                        {refillRx.length === 0 ? (
                            <div className="text-center py-16 bg-slate-50/50 rounded-xl border border-dashed">
                                <CheckCircle2 className="h-10 w-10 mx-auto text-green-500/50 mb-2" />
                                <p className="text-slate-500">All refill requests handled.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {refillRx.map((rx) => (
                                    <Card key={rx.prescriptionId} className="border-l-4 border-l-orange-500 shadow-sm flex flex-col md:flex-row items-center p-4 gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Badge variant="outline" className="text-orange-600 bg-orange-50 border-orange-200">Refill Requested</Badge>
                                                <span className="text-xs text-slate-400">{new Date(rx.timestamp).toLocaleDateString()}</span>
                                            </div>
                                            <h4 className="font-semibold text-lg">{rx.medication} <span className="text-sm font-normal text-slate-500">• {rx.dosage}</span></h4>
                                            <p className="text-sm text-slate-600">Patient: {getPatientName(rx.patientId)}</p>
                                        </div>
                                        <div className="flex items-center gap-2 w-full md:w-auto">
                                            <Button variant="outline" className="flex-1 md:flex-none text-slate-500">Deny</Button>
                                            <Button
                                                className="flex-1 md:flex-none bg-green-600 hover:bg-green-700"
                                                onClick={() => handleApproveRefill(rx)}
                                            >
                                                Approve
                                            </Button>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>

                {/* 3. NEW PRESCRIPTION MODAL */}
                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>Issue New Prescription</DialogTitle>
                            <DialogDescription>
                                Securely sign and transmit an e-prescription.
                            </DialogDescription>
                        </DialogHeader>

                        {/* DRUG INTERACTION ALERT */}
                        {interactionError && (
                            <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-start gap-3">
                                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                                <div>
                                    <h5 className="text-sm font-bold text-red-800">Safety Alert</h5>
                                    <p className="text-xs text-red-700 mt-1">{interactionError}</p>
                                </div>
                            </div>
                        )}

                        <div className="grid gap-4 py-2">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Patient</label>
                                <Select
                                    onValueChange={(val) => setFormData({ ...formData, patientId: val })}
                                    value={formData.patientId}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a patient..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {patientList.length === 0 ? (
                                            <div className="p-2 text-xs text-center text-muted-foreground">No patients in schedule</div>
                                        ) : (
                                            patientList.map((p) => (
                                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
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
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing...
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