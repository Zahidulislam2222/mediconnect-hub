import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
    Activity,
    Heart,
    Thermometer,
    AlertTriangle,
    RefreshCw,
    Wifi,
    WifiOff,
    User,
    ArrowLeft,
    Loader2,
    Clock,
    Users,       // Added
    ArrowRight   // Added
} from "lucide-react";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from "recharts";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getCurrentUser, signOut, fetchAuthSession } from 'aws-amplify/auth'; // 🟢 Added fetchAuthSession

const API_URL = import.meta.env.VITE_API_BASE_URL || "";

// --- TYPES ---
interface VitalReading {
    timestamp: string;
    heartRate: number;
    temperature?: number;
    status: 'NORMAL' | 'WARNING' | 'CRITICAL';
}

interface PatientProfile {
    name: string;
    id: string;
    avatar: string | null;
    age?: string;
}

// --- HELPER: Smart Initials ---
const getInitials = (name: string) => {
    if (!name) return "PT";
    const parts = name.split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
};

// --- HELPER: Time Since Formatter ---
const getTimeSince = (dateString: string) => {
    const diff = new Date().getTime() - new Date(dateString).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
};

export default function LiveMonitoring() {
    const navigate = useNavigate();
    const location = useLocation();
    const { toast } = useToast();

    // 🟢 FIX: Define patientId HERE (At the very top)
    const queryParams = new URLSearchParams(location.search);
    const patientId = queryParams.get("patientId");

    // Refs
    const pollingRef = useRef<NodeJS.Timeout | null>(null);
    const isPageVisible = useRef(true);

    // --- STATE ---
    // Doctor Profile
    const [doctorProfile] = useState(() => {
        const saved = localStorage.getItem('user');
        return saved ? JSON.parse(saved) : { name: "Doctor", avatar: null, role: "doctor" };
    });

    // --- REAL DATA STATE ---
    const [myPatients, setMyPatients] = useState<any[]>([]);
    const [isListLoading, setIsListLoading] = useState(true);

    // --- FETCH REAL PATIENTS (AUTHENTICATED) ---
    useEffect(() => {
        const fetchMyList = async () => {
            try {
                // 1. Get Current User & Credentials from Amplify
                const currentUser = await getCurrentUser();
                const session = await fetchAuthSession();
                const token = session.tokens?.idToken?.toString(); // 🟢 Get the security token

                // 2. Determine Doctor ID (User ID)
                // Use the ID from Amplify, which is safer than localStorage
                const doctorId = currentUser.userId || currentUser.username;

                console.log("🔍 Fetching list for Doctor:", doctorId);

                // 3. Fetch with Headers (The Fix)
                const response = await fetch(`${API_URL}/doctor-appointments?doctorId=${doctorId}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`, // 🟢 REQUIRED for API Gateway
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    console.log("📦 API Data:", data);

                    // 4. Extract 'existingBookings' (Confirmed by your Lambda Code)
                    const bookingList = data.existingBookings || [];

                    // 5. Filter Unique Patients
                    const uniquePatientsMap = new Map();

                    bookingList.forEach((appt: any) => {
                        // Ensure we rely on the correct field 'patientId'
                        if (appt.patientId && !uniquePatientsMap.has(appt.patientId)) {
                            uniquePatientsMap.set(appt.patientId, {
                                id: appt.patientId,
                                name: appt.patientName || "Unknown Patient",
                                status: "Offline",
                                lastVitals: "Waiting..."
                            });
                        }
                    });

                    setMyPatients(Array.from(uniquePatientsMap.values()));
                } else {
                    console.error("❌ API Error:", response.status);
                }
            } catch (e) {
                console.error("❌ Network Error:", e);
            } finally {
                setIsListLoading(false);
            }
        };

        // Trigger logic
        if (!patientId) {
            fetchMyList();
        } else {
            setIsListLoading(false);
        }
    }, [patientId]);

    // Patient Detail Data
    const [patient, setPatient] = useState<PatientProfile | null>(null);
    const [vitals, setVitals] = useState<VitalReading[]>([]);
    const [loading, setLoading] = useState(true);
    const [connectionStatus, setConnectionStatus] = useState<'CONNECTED' | 'STALE' | 'DISCONNECTED' | 'POLLING'>('CONNECTED');
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [useSimulation, setUseSimulation] = useState(false);
    const [emergencyLoading, setEmergencyLoading] = useState(false);

    // --- MOCK GENERATORS ---
    const generateMockReading = (): VitalReading => {
        const now = new Date();
        const baseHr = 75;
        const randomVar = Math.floor(Math.random() * 30) - 10;
        const hr = baseHr + randomVar;
        return {
            timestamp: now.toISOString(),
            heartRate: hr,
            status: (hr > 100 ? 'CRITICAL' : hr > 90 ? 'WARNING' : 'NORMAL') as 'NORMAL' | 'WARNING' | 'CRITICAL'
        };
    };

    const generateMockHistory = (): VitalReading[] => {
        const history: VitalReading[] = [];
        for (let i = 19; i >= 0; i--) {
            const time = new Date();
            time.setSeconds(time.getSeconds() - (i * 5));
            const hr = 70 + Math.floor(Math.random() * 20);
            history.push({
                timestamp: time.toISOString(),
                heartRate: hr,
                status: (hr > 100 ? 'CRITICAL' : hr > 90 ? 'WARNING' : 'NORMAL') as 'NORMAL' | 'WARNING' | 'CRITICAL'
            });
        }
        return history;
    };

    // --- 1. VISIBILITY LISTENER ---
    useEffect(() => {
        const handleVisibilityChange = () => {
            isPageVisible.current = document.visibilityState === "visible";
            if (isPageVisible.current && patientId) {
                fetchLatestVitals();
            }
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
    }, [patientId]);

    // --- 2. INITIAL LOAD ---
    useEffect(() => {
        // Only fetch if an ID is selected
        if (patientId) {
            fetchInitialData();
            pollingRef.current = setInterval(() => {
                if (isPageVisible.current) fetchLatestVitals();
            }, 5000);
        } else {
            setLoading(false); // Stop loading if showing list
        }

        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, [patientId]);

    const handleLogout = async () => {
        await signOut();
        localStorage.removeItem('user');
        navigate("/");
    };

    // --- 3. DATA FETCHING ---
    const fetchInitialData = async () => {
        if (!patientId) return;

        try {
            setLoading(true);
            await getCurrentUser();

            const [profileRes, vitalsRes] = await Promise.allSettled([
                fetch(`${API_URL}/register-patient?id=${patientId}`),
                fetch(`${API_URL}/vitals?patientId=${patientId}&limit=20`)
            ]);

            // Profile Logic
            if (profileRes.status === 'fulfilled' && profileRes.value.ok) {
                const pData = await profileRes.value.json();
                const pInfo = pData.Item || pData;
                setPatient({
                    name: pInfo.name || "Unknown Patient",
                    id: patientId,
                    avatar: pInfo.avatar || null,
                    age: pInfo.age || "Unknown"
                });
            } else {
                setPatient({ name: "Patient " + patientId, id: patientId, avatar: null });
            }

            // Vitals Logic
            if (vitalsRes.status === 'fulfilled' && vitalsRes.value.ok) {
                const vData = await vitalsRes.value.json();
                processVitalsData(vData);
            } else {
                console.warn("⚠️ API Unavailable - Starting Demo Mode");
                setUseSimulation(true);
                setVitals(generateMockHistory());
            }

        } catch (error) {
            console.error("Init Error:", error);
            setUseSimulation(true);
        } finally {
            setLoading(false);
        }
    };

    const fetchLatestVitals = useCallback(async () => {
        if (!patientId) return;

        if (useSimulation) {
            setVitals(prev => {
                const newPoint = generateMockReading();
                const newHistory = [...prev, newPoint].slice(-20);
                return newHistory;
            });
            setLastUpdated(new Date());
            return;
        }

        try {
            setConnectionStatus('POLLING');
            const res = await fetch(`${API_URL}/vitals?patientId=${patientId}&limit=5`);
            if (res.ok) {
                const data = await res.json();
                processVitalsData(data);
            } else {
                setConnectionStatus('DISCONNECTED');
            }
        } catch (err) {
            setConnectionStatus('DISCONNECTED');
        }
    }, [useSimulation, patientId]);

    // --- 4. PROCESSING LOGIC ---
    const processVitalsData = (rawData: any[]) => {
        if (!rawData || rawData.length === 0) return;

        const formatted: VitalReading[] = rawData.map((item: any) => {
            const hr = Number(item.heartRate);
            return {
                timestamp: item.timestamp,
                heartRate: hr,
                temperature: item.temperature ? Number(item.temperature) : undefined,
                status: (hr > 100 ? 'CRITICAL' : hr > 90 ? 'WARNING' : 'NORMAL') as 'NORMAL' | 'WARNING' | 'CRITICAL'
            };
        }).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        setVitals(formatted);

        const latestTime = new Date(formatted[formatted.length - 1].timestamp).getTime();
        const now = new Date().getTime();
        if (now - latestTime > 60000) {
            setConnectionStatus('STALE');
        } else {
            setConnectionStatus('CONNECTED');
        }

        setLastUpdated(new Date());
    };

    // --- 5. EMERGENCY ACTION HANDLER ---
    const handleEmergencyDispatch = async () => {
        if (!patientId) return;
        setEmergencyLoading(true);
        try {
            const response = await fetch(`${API_URL}/emergency`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    patientId: patientId,
                    type: 'MANUAL_OVERRIDE',
                    heartRate: latestVital?.heartRate || 0
                })
            });

            if (!response.ok) throw new Error("Dispatch failed");
            const data = await response.json();

            toast({
                title: "🚑 EMERGENCY DISPATCHED",
                description: `Alert ID: ${data.id}. The ER Team has been notified.`,
                variant: "destructive",
            });
        } catch (e) {
            console.error(e);
            toast({ title: "Dispatch Failed", description: "Network Error. Call 911.", variant: "destructive" });
        } finally {
            setEmergencyLoading(false);
        }
    };

    // --- VIEW 1: PATIENT LIST (MASTER VIEW) ---
    if (!patientId) {
        return (
            <DashboardLayout
                title="Live Monitoring"
                subtitle="Select a patient to view real-time telemetry"
                userRole="doctor"
                userName={doctorProfile.name}
                userAvatar={doctorProfile.avatar}
                onLogout={handleLogout}
            >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">

                    {/* SHOW LOADING SKELETON */}
                    {isListLoading && (
                        <div className="col-span-3 text-center py-10 text-muted-foreground">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                            <p>Loading your patients...</p>
                        </div>
                    )}

                    {/* SHOW REAL PATIENTS */}
                    {!isListLoading && myPatients.length > 0 && myPatients.map((pt) => (
                        <Card
                            key={pt.id}
                            className="hover:shadow-lg transition-all cursor-pointer border-l-4 border-l-blue-500 hover:scale-105"
                            onClick={() => navigate(`/live-monitoring?patientId=${pt.id}`)}
                        >
                            {/* 1. Header: Just say "Patient" (Removed the ugly ID) */}
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">
                                    Patient
                                </CardTitle>
                                <WifiOff className="h-4 w-4 text-gray-300" />
                            </CardHeader>

                            <CardContent>
                                <div className="flex items-center gap-4 mt-2">
                                    <Avatar className="h-12 w-12 border-2 border-blue-50">
                                        <AvatarFallback className="bg-blue-100 text-blue-700 font-bold text-lg">
                                            {getInitials(pt.name)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        {/* 2. Content: Only show Name (Removed the ID line below) */}
                                        <div className="text-xl font-bold capitalize">{pt.name}</div>
                                        <p className="text-xs text-green-600 font-medium mt-1">
                                            Click to Monitor
                                        </p>
                                    </div>
                                </div>
                                <Button className="w-full mt-4" variant="secondary">
                                    View Vitals <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </CardContent>
                        </Card>
                    ))}

                    {/* SHOW EMPTY STATE (If no appointments found) */}
                    {!isListLoading && myPatients.length === 0 && (
                        <div className="col-span-3 text-center py-10 border-2 border-dashed rounded-xl bg-muted/20">
                            <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                            <h3 className="text-lg font-semibold">No Patients Found</h3>
                            <p className="text-sm text-muted-foreground">
                                You have no appointments scheduled. Patients will appear here once they book a slot.
                            </p>
                        </div>
                    )}
                </div></DashboardLayout>
        );
    }

    // --- VIEW 2: MONITORING DASHBOARD (DETAIL VIEW) ---
    // Extract vital logic for view
    const latestVital = vitals.length > 0 ? vitals[vitals.length - 1] : null;
    const isCritical = latestVital && latestVital.status === 'CRITICAL';

    if (loading) {
        return (
            <DashboardLayout
                title="Live Monitoring"
                subtitle="Initializing telemetry..."
                userRole="doctor"
                userName={doctorProfile.name}
                userAvatar={doctorProfile.avatar}
                onLogout={handleLogout}
            >
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-pulse">
                    <div className="md:col-span-3 h-96 bg-muted/20 rounded-xl"></div>
                    <div className="space-y-4">
                        <div className="h-32 bg-muted/20 rounded-xl"></div>
                        <div className="h-32 bg-muted/20 rounded-xl"></div>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout
            title="Live Patient Monitoring"
            subtitle={`Real-time telemetry for ${patient?.name}`}
            userRole="doctor"
            userName={doctorProfile.name}
            userAvatar={doctorProfile.avatar}
            onLogout={handleLogout}
        >
            <div className="space-y-6 pb-10 animate-fade-in">

                {/* HEADER BAR */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-4 rounded-xl border shadow-sm">
                    <div className="flex items-center gap-4">
                        {/* UPDATE: Back Button now clears the ID to show list */}
                        <Button variant="ghost" size="icon" onClick={() => navigate("/live-monitoring")}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <Avatar className="h-12 w-12 border-2 border-primary/10">
                            <AvatarImage src={patient?.avatar || ""} />
                            <AvatarFallback className="bg-blue-100 text-blue-700 font-bold">
                                {getInitials(patient?.name || "")}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <h2 className="font-bold text-lg">{patient?.name}</h2>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <User className="h-3 w-3" /> ID: {patient?.id} • Age: {patient?.age || "N/A"}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${connectionStatus === 'CONNECTED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            connectionStatus === 'STALE' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                'bg-red-50 text-red-700 border-red-200'
                            }`}>
                            {connectionStatus === 'CONNECTED' ? <Wifi className="h-3 w-3" /> :
                                connectionStatus === 'STALE' ? <Clock className="h-3 w-3" /> :
                                    <WifiOff className="h-3 w-3" />}

                            {useSimulation ? "SIMULATION MODE" :
                                connectionStatus === 'CONNECTED' ? "LIVE SIGNAL" :
                                    connectionStatus === 'STALE' ? "STALE DATA" : "OFFLINE"}
                        </div>

                        {useSimulation && (
                            <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
                                <RefreshCw className="h-3 w-3 mr-2" /> Retry Connection
                            </Button>
                        )}
                    </div>
                </div>

                {/* MAIN GRID */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

                    {/* CHART AREA */}
                    <Card className={`lg:col-span-3 border-none shadow-elevated overflow-hidden ${isCritical ? 'ring-2 ring-red-500 animate-pulse' : ''}`}>
                        <CardHeader className="bg-card/50 backdrop-blur-sm border-b">
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <Activity className="h-5 w-5 text-blue-600" />
                                        Heart Rate Trend
                                    </CardTitle>
                                    <CardDescription>
                                        {latestVital ? `Last signal: ${getTimeSince(latestVital.timestamp)}` : "Waiting for data..."}
                                    </CardDescription>
                                </div>
                                {isCritical && (
                                    <Badge variant="destructive" className="animate-bounce">
                                        <AlertTriangle className="h-3 w-3 mr-1" /> CRITICAL
                                    </Badge>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="p-0 h-[400px] bg-gradient-to-b from-card to-muted/20">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={vitals}>
                                    <defs>
                                        <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={isCritical ? "#ef4444" : "#2563eb"} stopOpacity={0.8} />
                                            <stop offset="95%" stopColor={isCritical ? "#ef4444" : "#2563eb"} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                    <XAxis
                                        dataKey="timestamp"
                                        tickFormatter={(str) => new Date(str).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                        stroke="#9ca3af"
                                        fontSize={12}
                                        tickMargin={10}
                                    />
                                    <YAxis
                                        domain={[40, 160]}
                                        stroke="#9ca3af"
                                        fontSize={12}
                                    />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                        labelFormatter={(label) => new Date(label).toLocaleTimeString()}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="heartRate"
                                        stroke={isCritical ? "#ef4444" : "#2563eb"}
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#colorHr)"
                                        isAnimationActive={false}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    {/* SIDEBAR STATS */}
                    <div className="space-y-6">

                        {/* HEART RATE CARD */}
                        <Card className={`${isCritical ? 'bg-red-50 border-red-200' : 'bg-card'} transition-colors duration-500`}>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between">
                                    Heart Rate
                                    <Heart className={`h-4 w-4 ${isCritical ? 'text-red-500 fill-red-500 animate-pulse' : 'text-muted-foreground'}`} />
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-4xl font-bold flex items-end gap-2">
                                    {latestVital?.heartRate || "--"}
                                    <span className="text-sm font-normal text-muted-foreground mb-1">bpm</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {latestVital?.status === 'CRITICAL' ? "⚠️ High Risk" :
                                        latestVital?.status === 'WARNING' ? "⚠️ Elevated" : "✅ Normal Range"}
                                </p>
                            </CardContent>
                        </Card>

                        {/* TEMP CARD */}
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between">
                                    Body Temperature
                                    <Thermometer className="h-4 w-4 text-muted-foreground" />
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-4xl font-bold flex items-end gap-2">
                                    {latestVital?.temperature ? latestVital.temperature : "--"}
                                    <span className="text-sm font-normal text-muted-foreground mb-1">°F</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {latestVital?.temperature ? "Sensor Active" : "No Sensor Data"}
                                </p>
                            </CardContent>
                        </Card>

                        {/* EMERGENCY ACTION */}
                        <Card className="border-red-100 bg-red-50/50">
                            <CardHeader>
                                <CardTitle className="text-red-700 flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4" /> Emergency
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <Button
                                    className="w-full bg-red-600 hover:bg-red-700 text-white shadow-md"
                                    onClick={handleEmergencyDispatch}
                                    disabled={emergencyLoading}
                                >
                                    {emergencyLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                    {emergencyLoading ? "Dispatching..." : "Dispatch Emergency Unit"}
                                </Button>
                                <p className="text-xs text-red-600/80 text-center">
                                    Pressing this triggers an immediate alert to the On-Call ER Team.
                                </p>
                            </CardContent>
                        </Card>

                    </div>

                </div>
            </div>
        </DashboardLayout>
    );
}