import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getCurrentUser, signOut, fetchAuthSession } from 'aws-amplify/auth';
import {
    Search, FileText, Activity, Calendar, Clock,
    Save, Loader2, Brain, Thermometer, Heart,
    AlertTriangle, CheckCircle2, TrendingUp, User, ChevronLeft,
    Image as ImageIcon, Plus, Server, Eye, Database, Upload, Lock
} from "lucide-react";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export default function PatientRecords() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { toast } = useToast();

    // --- STATE ---
    const [doctorProfile, setDoctorProfile] = useState<any>({ name: "Doctor", role: "doctor" });
    const [isLoading, setIsLoading] = useState(true);

    // Data Storage
    const [allAppointments, setAllAppointments] = useState<any[]>([]); // Full History
    const [patientList, setPatientList] = useState<any[]>([]); // Unique Sidebar List
    const [selectedPatientId, setSelectedPatientId] = useState<string | null>(searchParams.get("patientId"));
    const [selectedPatientProfile, setSelectedPatientProfile] = useState<any>(null); // Details (DOB, Email)

    // UI State
    const [searchQuery, setSearchQuery] = useState("");
    const [noteText, setNoteText] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // AI Prediction State
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [predictionResult, setPredictionResult] = useState<any>(null);
    const [vitals, setVitals] = useState({
        temp: 98.6,
        heartRate: 72,
        bpSys: 120,
        age: 0 // Will be updated from real DOB
    });
    const [records, setRecords] = useState<any[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const vaultInputRef = useRef<HTMLInputElement>(null);
    const [noteTitle, setNoteTitle] = useState("");

    const [selectedNote, setSelectedNote] = useState<any>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // --- 1. INITIAL LOAD (Doctor Profile & Patient List) ---
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const user = await getCurrentUser();

            // 🟢 1. GET TOKEN
            const session = await fetchAuthSession();
            const token = session.tokens?.idToken?.toString();

            // A. Fetch Doctor Profile
            const profileRes: any = await api.get(`/register-doctor?id=${user.userId}`);
            if (profileRes) {
                const data = profileRes;
                const profile = data.doctors?.find((d: any) => d.doctorId === user.userId) || data;
                setDoctorProfile(profile);
            }

            // B. Fetch Appointments
            const scheduleRes: any = await api.get(`/doctor-appointments?doctorId=${user.userId}`);

            // Prepare the list
            const data = scheduleRes || {};
            const rawList = data.existingBookings ? data.existingBookings : (Array.isArray(data) ? data : []);

            setAllAppointments(rawList);

            // C. Deduplicate to get Unique Patients
            const uniqueMap = new Map();
            rawList.forEach((apt: any) => {
                // Filter out bad data
                if (apt.patientId && apt.patientName && !uniqueMap.has(apt.patientId)) {
                    uniqueMap.set(apt.patientId, {
                        id: apt.patientId,
                        name: apt.patientName,
                        lastVisit: apt.timeSlot || apt.createdAt,
                        avatar: "" // Placeholder, we will fetch the real one below
                    });
                }
            });

            // 🟢 NEW: Fetch real profiles to get the photos (Logic copied from Prescriptions)
            const uniqueIds = Array.from(uniqueMap.keys());
            if (uniqueIds.length > 0) {
                // Fetch all profiles in parallel
                const profilePromises = uniqueIds.map(pid =>
                    api.get(`/register-patient?id=${pid}`).catch(() => null)
                );
                const profiles = await Promise.all(profilePromises);

                // Update the map with the real avatars
                profiles.forEach((p: any) => {
                    if (p) {
                        const profileData = p.Item || p;
                        const pid = profileData.patientId || profileData.id;
                        if (uniqueMap.has(pid)) {
                            const existing = uniqueMap.get(pid);
                            existing.avatar = profileData.avatar;
                            uniqueMap.set(pid, existing);
                        }
                    }
                });
            }

            setPatientList(Array.from(uniqueMap.values()));

            // ❌ DELETED THE DUPLICATE LOGIC BLOCK THAT WAS HERE ❌

        } catch (e) {
            console.error("Load Error", e);
            toast({ variant: "destructive", title: "Connection Error", description: "Failed to load records." });
        } finally {
            setIsLoading(false);
        }
    };

    // --- 2. SELECT PATIENT LOGIC ---
    useEffect(() => {
        if (selectedPatientId) {
            setSearchParams({ patientId: selectedPatientId });
            setPredictionResult(null);
            loadPatientDetails(selectedPatientId);
        }
    }, [selectedPatientId]);

    const loadPatientDetails = async (pid: string) => {
        try {
            // 1. Fetch Profile (Existing Logic)
            const res: any = await api.get(`/register-patient?id=${pid}`);
            if (res) {
                const profile = res;
                setSelectedPatientProfile(profile);
                if (profile.dob) {
                    const dobYear = new Date(profile.dob).getFullYear();
                    const currentYear = new Date().getFullYear();
                    setVitals(prev => ({ ...prev, age: currentYear - dobYear }));
                }
            }

            // 🟢 2. ADDED: Fetch Document Vault Records
            const ehrRes: any = await api.post('/ehr', {
                action: "list_records",
                patientId: pid
            });
            if (ehrRes) {
                const data = ehrRes;
                const sorted = Array.isArray(data) ? data.sort((a: any, b: any) =>
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                ) : [];
                setRecords(sorted);
            }

        } catch (e) { console.error("Patient Detail Error", e); }
        // 🟢 Fetch real-time vitals for the AI
        try {
            const vitalsRes: any = await api.get(`/vitals?patientId=${pid}`);
            if (vitalsRes && vitalsRes.vitals) {
                setVitals({
                    temp: parseFloat(vitalsRes.vitals.temperature) || 98.6,
                    heartRate: vitalsRes.vitals.heartRate || 72,
                    bpSys: vitalsRes.vitals.bloodPressureSys || 120,
                    age: vitals.age
                });
            }
        } catch (e) { console.warn("Vitals not found for patient"); }
    };

    const handleLogout = async () => {
        await signOut();
        navigate("/");
    };

    // --- 3. FILTER LISTS ---
    const filteredPatients = patientList.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Get History for Selected Patient (Real Data)
    const patientHistory = useMemo(() => {
        if (!selectedPatientId) return [];
        return allAppointments
            .filter(a => a.patientId === selectedPatientId)
            .sort((a, b) => new Date(b.timeSlot).getTime() - new Date(a.timeSlot).getTime());
    }, [selectedPatientId, allAppointments]);

    // --- 4. CLINICAL NOTE LOGIC (MongoDB) ---
    const handleSaveNote = async () => {
        if (!noteText.trim() || !selectedPatientId || !noteTitle.trim()) {
            toast({ variant: "destructive", title: "Missing Info", description: "Please provide a title and note content." });
            return;
        }

        setIsSaving(true);
        try {
            const res = await api.post('/ehr', {
                action: "add_clinical_note",
                patientId: selectedPatientId,
                note: noteText,
                fileName: noteTitle, // 🟢 Matches backend Fix #1
                authorName: doctorProfile.name
            });

            toast({ title: "Securely Saved", description: "Note encrypted and added to history." });

            // 🟢 Reset UI
            setNoteText("");
            setNoteTitle("");

            // Refresh the document list
            loadPatientDetails(selectedPatientId);
        } catch (err) {
            toast({ variant: "destructive", title: "Error", description: "Compliance check failed or network error." });
        } finally {
            setIsSaving(false);
        }
    };

    // --- 5. AI PREDICTION LOGIC (Real Inputs) ---
    const handleRunPrediction = async (modelType: string) => {
        if (!selectedPatientId) return;
        setIsAnalyzing(true);
        setPredictionResult(null);

        try {
            // CALCULATE REAL HISTORY STATS
            const now = new Date();
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(now.getDate() - 30);

            const recentVisitsCount = patientHistory.filter(a => new Date(a.timeSlot) > thirtyDaysAgo).length;
            const missedCount = patientHistory.filter(a => a.status === 'CANCELLED' || a.status === 'MISSED').length;

            const payload = {
                patientId: selectedPatientId,
                modelType: modelType,
                vitals: vitals,
                history: {
                    recentVisits: recentVisitsCount,        // Real Data
                    missedAppointments: missedCount         // Real Data
                }
            };

            const res: any = await api.post('/chat/predict-health', payload);

            if (res && res.analysis) {
                // 🟢 Map the new FHIR-compliant response to your UI
                const data = {
                    modelType: res.modelType || modelType,
                    confidence: res.analysis.riskScore / 100, // Converts 85 to 0.85
                    output: {
                        risk: res.analysis.riskLevel,
                        message: res.analysis.clinicalJustification,
                        recommendation: res.analysis.recommendedIntervention
                    }
                };
                setPredictionResult(data);
                toast({ title: "Analysis Complete", description: `Ran ${modelType} model successfully.` });
            } else { throw new Error("Prediction API Failed"); }
        } catch (err) {
            console.error(err);
            toast({ variant: "destructive", title: "AI Error", description: "Failed to run predictive model." });
        } finally { setIsAnalyzing(false); }
    };

    // --- HELPERS ---
    const getInitials = (name: string) => name ? name.substring(0, 2).toUpperCase() : "??";

    const getRiskColor = (risk: string) => {
        const r = risk?.toUpperCase() || "";
        if (r === "CRITICAL" || r === "HIGH") return "bg-red-500 hover:bg-red-600";
        if (r === "MODERATE") return "bg-orange-500 hover:bg-orange-600";
        return "bg-green-500 hover:bg-green-600";
    };

    // 🟢 ADD THIS FUNCTION:
    const handleDoctorUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0] || !selectedPatientId) return;
        const file = e.target.files[0];
        setIsUploading(true);

        try {
            const initRes: any = await api.post('/ehr', {
                action: "request_upload",
                patientId: selectedPatientId,
                fileName: file.name,
                fileType: file.type,
                doctorId: doctorProfile.doctorId
            });

            // 🟢 FIX: Extract 's3Key' here
            const { uploadUrl, s3Key } = initRes;

            const uploadRes = await fetch(uploadUrl, {
                method: "PUT",
                headers: { "Content-Type": file.type },
                body: file
            });

            if (!uploadRes.ok) throw new Error("S3 Upload Failed");

            // 🟢 Now s3Key is valid
            await api.post('/ehr', {
                action: "save_record_metadata",
                patientId: selectedPatientId,
                fileName: file.name,
                fileType: file.type,
                s3Key: s3Key,
                description: `Imaging uploaded by Dr. ${doctorProfile.name}`
            });

            toast({ title: "Success", description: "File added to patient record." });
            loadPatientDetails(selectedPatientId);

        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Upload failed." });
        } finally {
            setIsUploading(false);
            if (vaultInputRef.current) vaultInputRef.current.value = "";
        }
    };

    // 🟢 NEW: Handle Secure File Viewing
    const handleViewFile = async (s3Key: string) => {
        if (!s3Key) return;

        // 🟢 FIX: Smart check here too
        const approved = doctorProfile.isOfficerApproved === true || doctorProfile.isOfficerApproved === "true";

        if (!approved) {
            toast({ variant: "destructive", title: "Restricted", description: "You need Officer Approval to view scans." });
            return;
        }

        toast({ title: "Opening File", description: "Verifying credentials..." });

        try {
            const data: any = await api.post('/ehr', {
                action: "get_view_url",
                s3Key: s3Key,
                doctorId: doctorProfile.doctorId // 🟢 SEND DOCTOR ID
            });

            // const data = await res.json();

            // if (res.status === 403) {
            //     throw new Error("Officer Approval Required");
            // }

            if (data.viewUrl) {
                window.open(data.viewUrl, '_blank');
            } else {
                throw new Error("No URL returned");
            }
        } catch (error) {
            console.error("View Error:", error);
            toast({ variant: "destructive", title: "Access Denied", description: error.message });
        }
    };

    const isApproved = doctorProfile?.isOfficerApproved === true || doctorProfile?.isOfficerApproved === "true";

    return (
        <DashboardLayout
            title="Patient Records"
            subtitle="EHR & AI Clinical Decision Support"
            userRole="doctor"
            userName={doctorProfile.name}
            userAvatar={doctorProfile.avatar}
            onLogout={handleLogout}
        >
            <div className="h-[calc(100vh-12rem)] min-h-[600px] flex rounded-xl overflow-hidden border border-border/50 bg-card shadow-sm animate-fade-in">

                {/* 1. SIDEBAR: REAL PATIENT LIST */}
                <div className={cn(
                    "border-r border-border/50 bg-slate-50/50 flex flex-col transition-all",
                    "w-full md:w-80",
                    selectedPatientId ? "hidden md:flex" : "flex"
                )}>
                    <div className="p-4 border-b border-border/50 bg-white">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Find patient..."
                                className="pl-9 bg-slate-50"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {isLoading ? (
                            <div className="p-4 space-y-3">
                                <div className="h-12 bg-muted animate-pulse rounded" />
                                <div className="h-12 bg-muted animate-pulse rounded" />
                            </div>
                        ) : filteredPatients.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground text-sm">
                                No patients found in records.
                            </div>
                        ) : (
                            filteredPatients.map((p) => (
                                <div
                                    key={p.id}
                                    onClick={() => setSelectedPatientId(p.id)}
                                    className={cn(
                                        "p-4 flex items-center gap-3 cursor-pointer border-l-4 transition-all hover:bg-white border-b border-b-slate-100",
                                        selectedPatientId === p.id
                                            ? "bg-white border-l-primary shadow-sm"
                                            : "border-l-transparent"
                                    )}
                                >
                                    <Avatar className="h-10 w-10">
                                        {/* 👇 ADD THIS LINE HERE */}
                                        <AvatarImage src={p.avatar} alt={p.name} />

                                        <AvatarFallback className="bg-blue-100 text-blue-700 font-bold">
                                            {getInitials(p.name)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-semibold text-sm text-slate-900">{p.name}</h4>
                                        <p className="text-[10px] text-muted-foreground">Last: {new Date(p.lastVisit).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* 2. MAIN CONTENT AREA */}
                <div className={cn(
                    "flex-1 bg-white flex-col",
                    !selectedPatientId ? "hidden md:flex" : "flex"
                )}>
                    {selectedPatientId && patientList.find(p => p.id === selectedPatientId) ? (
                        <>
                            {/* Patient Header */}
                            <div className="p-6 border-b border-border/50 flex flex-col sm:flex-row justify-between items-start bg-slate-50/30 gap-4">
                                <div className="flex gap-4 items-center sm:items-start">
                                    {/* Mobile Back Button */}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="md:hidden -ml-3"
                                        onClick={() => setSelectedPatientId(null)}
                                    >
                                        <ChevronLeft className="h-5 w-5" />
                                    </Button>

                                    <Avatar className="h-16 w-16 border-2 border-white shadow-sm shrink-0">
                                        <AvatarImage src={selectedPatientProfile?.avatar || ""} />
                                        <AvatarFallback className="bg-primary text-white text-xl">
                                            {getInitials(patientList.find(p => p.id === selectedPatientId).name)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-900">
                                            {patientList.find(p => p.id === selectedPatientId).name}
                                        </h2>
                                        <div className="flex gap-4 text-sm text-slate-500 mt-1">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="h-4 w-4" />
                                                DOB: {selectedPatientProfile?.dob || "Unknown"} (Age: {vitals.age || "?"})
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <Badge variant="outline" className="text-blue-600 bg-blue-50 border-blue-200">
                                    Active Patient
                                </Badge>
                            </div>

                            {/* TABS INTERFACE */}
                            <div className="flex-1 p-6 overflow-y-auto">
                                <Tabs defaultValue="clinical-notes" className="space-y-6">
                                    <TabsList className="bg-slate-100 p-1">
                                        <TabsTrigger value="documents" className="gap-2"><Server className="h-4 w-4" /> Documents</TabsTrigger>
                                        <TabsTrigger value="clinical-notes" className="gap-2"><FileText className="h-4 w-4" /> Clinical Notes</TabsTrigger>
                                        <TabsTrigger value="history" className="gap-2"><Clock className="h-4 w-4" /> History</TabsTrigger>
                                        <TabsTrigger value="ai-analysis" className="gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all">
                                            <Brain className="h-4 w-4" /> AI Risk Analysis
                                        </TabsTrigger>
                                    </TabsList>

                                    {/* --- TAB 1: CLINICAL NOTES (MongoDB) --- */}
                                    <TabsContent value="clinical-notes" className="space-y-4">
                                        <Card className="border-border/50 shadow-sm">
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-lg">New Clinical Entry</CardTitle>
                                                <CardDescription>Records are encrypted and stored in DocumentDB.</CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                                {/* 🟢 NEW TITLE INPUT */}
                                                <div className="space-y-4">
                                                    <Input
                                                        placeholder="Note Title (e.g., Follow-up Visit)"
                                                        value={noteTitle}
                                                        onChange={(e) => setNoteTitle(e.target.value)}
                                                        className="font-semibold"
                                                    />
                                                    <Textarea
                                                        placeholder="Type patient symptoms, diagnosis, and treatment plan..."
                                                        className="min-h-[150px] resize-none text-base"
                                                        value={noteText}
                                                        onChange={(e) => setNoteText(e.target.value)}
                                                    />
                                                    <Button onClick={handleSaveNote} disabled={isSaving || !noteText || !noteTitle}>
                                                        Save to Record
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </TabsContent>

                                    {/* 🟢 NEW DOCUMENT VAULT TAB */}
                                    <TabsContent value="documents" className="space-y-4">
                                        <Card className="border-border/50 shadow-sm bg-blue-50/20 border-blue-100">
                                            <CardHeader className="pb-3 flex flex-row items-center justify-between">
                                                <div>
                                                    <CardTitle className="text-lg flex items-center gap-2 text-blue-800">
                                                        <Database className="h-5 w-5" /> Patient Files
                                                    </CardTitle>
                                                    <CardDescription>Securely shared documents and scans.</CardDescription>
                                                </div>
                                                <div>
                                                    <input type="file" ref={vaultInputRef} className="hidden" onChange={handleDoctorUpload} />
                                                    <Button size="sm" onClick={() => vaultInputRef.current?.click()} disabled={isUploading}>
                                                        {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                                                        Upload File
                                                    </Button>
                                                </div>
                                            </CardHeader>
                                            <CardContent>
                                                {records.length === 0 ? (
                                                    <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl bg-white/50">
                                                        <p>No documents found for this patient.</p>
                                                    </div>
                                                ) : (
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                        {records.map((doc, idx) => (
                                                            <div key={idx} className="bg-white border p-3 rounded-xl shadow-sm hover:shadow-md transition-all group relative">

                                                                {/* 🟢 CHANGE START: SMART ICON LOGIC */}
                                                                <div className="aspect-square bg-slate-50 rounded-lg flex items-center justify-center mb-2">
                                                                    {doc.type === 'NOTE' ? (
                                                                        <FileText className="h-8 w-8 text-amber-600" />
                                                                    ) : doc.fileType?.includes("image") ? (
                                                                        <ImageIcon className="h-8 w-8 text-blue-400" />
                                                                    ) : (
                                                                        <FileText className="h-8 w-8 text-slate-400" />
                                                                    )}
                                                                </div>

                                                                {/* 🟢 HYBRID FHIR MAPPING */}
                                                                <p className="text-xs font-semibold truncate">
                                                                    {/* Preference: FHIR Description -> Legacy fileName -> Defaults */}
                                                                    {doc.resource?.description || doc.fileName || (doc.type === 'NOTE' ? "Untitled Clinical Note" : "Untitled File")}
                                                                </p>

                                                                <p className="text-[10px] text-muted-foreground">{new Date(doc.createdAt).toLocaleDateString()}</p>
                                                                {/* Open Button */}
                                                                <div
                                                                    className="absolute inset-0 bg-black/5 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                                                                    onClick={() => {
                                                                        if (doc.type === 'NOTE') {
                                                                            setSelectedNote(doc); // This passes the data to the Dialog
                                                                            setIsModalOpen(true);
                                                                        } else if (doc.s3Url) {
                                                                            window.open(doc.s3Url, '_blank');
                                                                        }
                                                                    }}
                                                                >
                                                                    {isApproved ? (
                                                                        <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full shadow-sm">
                                                                            <Eye className="h-4 w-4" />
                                                                        </Button>
                                                                    ) : (
                                                                        <Button variant="destructive" size="icon" className="h-8 w-8 rounded-full shadow-sm">
                                                                            <Lock className="h-4 w-4" />
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </TabsContent>

                                    {/* --- TAB 2: HISTORY (Real Timeline) --- */}
                                    <TabsContent value="history">
                                        <div className="space-y-4">
                                            {patientHistory.length === 0 ? (
                                                <div className="text-center text-muted-foreground py-10">
                                                    No past appointments found for this patient.
                                                </div>
                                            ) : (
                                                patientHistory.map((apt) => (
                                                    <Card key={apt.appointmentId} className="border-l-4 border-l-blue-500 shadow-sm">
                                                        <CardContent className="p-4">
                                                            <div className="flex justify-between items-start">
                                                                <div>
                                                                    <h4 className="font-semibold">{apt.type || "Consultation"}</h4>
                                                                    <p className="text-sm text-muted-foreground">
                                                                        {new Date(apt.timeSlot).toLocaleDateString()} at {new Date(apt.timeSlot).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                    </p>
                                                                </div>
                                                                <Badge variant="outline">{apt.status}</Badge>
                                                            </div>
                                                            {apt.notes && <p className="mt-2 text-sm text-slate-700">{apt.notes}</p>}
                                                        </CardContent>
                                                    </Card>
                                                ))
                                            )}
                                        </div>
                                    </TabsContent>

                                    {/* --- TAB 3: AI RISK ANALYSIS (Lambda) --- */}
                                    <TabsContent value="ai-analysis" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                                            {/* LEFT: INPUTS */}
                                            <Card className="border-border/50 shadow-sm">
                                                <CardHeader>
                                                    <CardTitle className="text-lg flex items-center gap-2">
                                                        <Activity className="h-5 w-5 text-indigo-600" /> Vitals Snapshot
                                                    </CardTitle>
                                                    <CardDescription>Enter current vitals to run predictive models.</CardDescription>
                                                </CardHeader>
                                                <CardContent className="space-y-4">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <label className="text-xs font-medium text-slate-500">Temperature (°F)</label>
                                                            <div className="relative">
                                                                <Thermometer className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                                                <Input
                                                                    type="number"
                                                                    className="pl-9"
                                                                    value={vitals.temp}
                                                                    onChange={(e) => setVitals({ ...vitals, temp: parseFloat(e.target.value) })}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-xs font-medium text-slate-500">Heart Rate (BPM)</label>
                                                            <div className="relative">
                                                                <Heart className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                                                <Input
                                                                    type="number"
                                                                    className="pl-9"
                                                                    value={vitals.heartRate}
                                                                    onChange={(e) => setVitals({ ...vitals, heartRate: parseFloat(e.target.value) })}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-xs font-medium text-slate-500">Systolic BP</label>
                                                            <div className="relative">
                                                                <Activity className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                                                <Input
                                                                    type="number"
                                                                    className="pl-9"
                                                                    value={vitals.bpSys}
                                                                    onChange={(e) => setVitals({ ...vitals, bpSys: parseFloat(e.target.value) })}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-xs font-medium text-slate-500">Age</label>
                                                            <div className="relative">
                                                                <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                                                <Input
                                                                    type="number"
                                                                    className="pl-9"
                                                                    value={vitals.age}
                                                                    onChange={(e) => setVitals({ ...vitals, age: parseFloat(e.target.value) })}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="pt-4 space-y-2">
                                                        <label className="text-xs font-bold text-slate-700">Select Predictive Model:</label>
                                                        <div className="flex flex-col gap-2">
                                                            <Button
                                                                variant="outline"
                                                                className="justify-start hover:border-red-300 hover:bg-red-50"
                                                                onClick={() => handleRunPrediction("SEPSIS")}
                                                                disabled={isAnalyzing}
                                                            >
                                                                <AlertTriangle className="h-4 w-4 mr-2 text-red-500" />
                                                                Check Sepsis Risk (Early Warning)
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                className="justify-start hover:border-blue-300 hover:bg-blue-50"
                                                                onClick={() => handleRunPrediction("READMISSION")}
                                                                disabled={isAnalyzing}
                                                            >
                                                                <TrendingUp className="h-4 w-4 mr-2 text-blue-500" />
                                                                Predict 30-Day Readmission
                                                            </Button>
                                                            <Button
                                                                variant="outline"
                                                                className="justify-start hover:border-orange-300 hover:bg-orange-50"
                                                                onClick={() => handleRunPrediction("NO_SHOW")}
                                                                disabled={isAnalyzing}
                                                            >
                                                                <Clock className="h-4 w-4 mr-2 text-orange-500" />
                                                                No-Show Probability
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>

                                            {/* RIGHT: RESULTS */}
                                            <Card className="border-border/50 shadow-sm bg-slate-50/50 flex flex-col justify-center">
                                                {isAnalyzing ? (
                                                    <div className="text-center p-10">
                                                        <Loader2 className="h-10 w-10 animate-spin text-indigo-500 mx-auto mb-4" />
                                                        <h3 className="font-semibold text-slate-700">Neural Engine Running...</h3>
                                                    </div>
                                                ) : predictionResult ? (
                                                    <CardContent className="p-8 space-y-6">
                                                        <div className="text-center">
                                                            <Badge className={cn("text-lg px-4 py-1 mb-4", getRiskColor(predictionResult.output.risk || predictionResult.output.likelihood))}>
                                                                {predictionResult.output.risk || predictionResult.output.likelihood} RISK
                                                            </Badge>
                                                            <h2 className="text-2xl font-bold text-slate-900 mb-2">
                                                                {(predictionResult.confidence * 100).toFixed(1)}% Confidence
                                                            </h2>
                                                            <Progress value={predictionResult.confidence * 100} className="h-2" />
                                                        </div>

                                                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                                            <h4 className="font-semibold text-sm text-slate-900 mb-1 flex items-center gap-2">
                                                                <Brain className="h-4 w-4 text-indigo-500" /> AI Assessment:
                                                            </h4>
                                                            <p className="text-slate-600 text-sm leading-relaxed">
                                                                {predictionResult.output.message}
                                                            </p>
                                                        </div>
                                                        {predictionResult.output.recommendation && (
                                                            <div className="mt-3 p-3 bg-indigo-50 border border-indigo-100 rounded-lg animate-in fade-in zoom-in-95">
                                                                <h5 className="text-xs font-bold text-indigo-700 uppercase flex items-center gap-1">
                                                                    <CheckCircle2 className="h-3 w-3" /> Recommended Intervention:
                                                                </h5>
                                                                <p className="text-sm text-indigo-900 mt-1 italic leading-snug">
                                                                    {predictionResult.output.recommendation}
                                                                </p>
                                                            </div>
                                                        )}

                                                        <div className="flex items-center gap-2 text-xs text-slate-400 justify-center">
                                                            <CheckCircle2 className="h-3 w-3" />
                                                            Model: {predictionResult.modelType}
                                                        </div>
                                                    </CardContent>
                                                ) : (
                                                    <div className="text-center p-10">
                                                        <Brain className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                                                        <p className="font-medium text-slate-500">Clinical Decision Support</p>
                                                        {vitals.heartRate === 72 && vitals.temp === 98.6 ? (
                                                            <Badge variant="outline" className="mt-2 text-orange-500 border-orange-200">
                                                                Waiting for Wearable Sync...
                                                            </Badge>
                                                        ) : (
                                                            <p className="text-xs text-slate-400">Vitals loaded. Select a model to run AI risk assessment.</p>
                                                        )}
                                                    </div>
                                                )}
                                            </Card>
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-slate-50/30">
                            <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                <User className="h-8 w-8 text-slate-300" />
                            </div>
                            <h3 className="font-semibold text-lg text-slate-700">Select a Patient</h3>
                            <p className="text-sm max-w-xs text-center mt-2">
                                Choose a patient from the sidebar to view records.
                            </p>
                        </div>
                    )}
                </div>
            </div>
            {selectedNote && (
                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <FileText className="h-5 w-5 text-amber-500" />
                                {selectedNote.resource?.description || selectedNote.fileName || "Clinical Note"}
                            </DialogTitle>
                            <DialogDescription>
                                Created on {new Date(selectedNote.resource?.date || selectedNote.createdAt).toLocaleDateString()}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="p-6 bg-slate-50 rounded-lg border border-slate-200 mt-4 max-h-[60vh] overflow-y-auto">
                            <p className="whitespace-pre-wrap text-slate-800 leading-relaxed">
                                {selectedNote.resource?.summary || selectedNote.note || selectedNote.content || "No content available."}
                            </p>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </DashboardLayout>
    );
}