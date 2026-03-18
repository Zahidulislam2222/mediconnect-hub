import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from 'aws-amplify/auth';
import {
    Server,
    Activity,
    RefreshCw,
    CheckCircle,
    XCircle,
    AlertTriangle,
    Wifi,
    Clock,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { getUser, clearAllSensitive } from "@/lib/secure-storage";
import { cn } from "@/lib/utils";

// --- Types ---

interface RegisteredService {
    name: string;
    port: number;
    type: string;
}

interface ServiceHealth {
    name: string;
    port: number;
    status: "UP" | "DEGRADED" | "DOWN" | "UNKNOWN";
    latencyMs: number;
}

interface PlatformConfig {
    environment: string;
    region: string;
    features: Record<string, boolean>;
    versions: Record<string, string>;
}

// --- Helpers ---

const statusIcon = (status: string) => {
    switch (status) {
        case "UP":
            return <CheckCircle className="h-4 w-4 text-emerald-600" />;
        case "DEGRADED":
            return <AlertTriangle className="h-4 w-4 text-amber-600" />;
        case "DOWN":
            return <XCircle className="h-4 w-4 text-red-600" />;
        default:
            return <Wifi className="h-4 w-4 text-slate-400" />;
    }
};

const statusBorderColor = (status: string) => {
    switch (status) {
        case "UP":
            return "border-emerald-300";
        case "DEGRADED":
            return "border-amber-300";
        case "DOWN":
            return "border-red-300";
        default:
            return "border-slate-200";
    }
};

export default function AdminSystemHealth() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // --- User session ---
    const [profile] = useState<any>(() => {
        try {
            return getUser() || null;
        } catch (e) { return null; }
    });

    const handleLogout = async () => {
        try {
            await signOut();
        } catch (_) { /* ignore */ }
        clearAllSensitive();
        navigate("/");
    };

    // --- State ---
    const [registeredServices, setRegisteredServices] = useState<RegisteredService[]>([]);
    const [serviceHealth, setServiceHealth] = useState<ServiceHealth[]>([]);
    const [platformConfig, setPlatformConfig] = useState<PlatformConfig | null>(null);
    const [checkedAt, setCheckedAt] = useState<string | null>(null);
    const [loadingRegistry, setLoadingRegistry] = useState(true);
    const [loadingHealth, setLoadingHealth] = useState(true);
    const [loadingConfig, setLoadingConfig] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(false);

    // --- Auth Error Handler ---
    const handleAuthError = useCallback(async (error: any) => {
        if (error?.message?.includes("401")) {
            clearAllSensitive();
            try { await signOut(); } catch (_) { /* ignore */ }
            navigate("/auth");
            return true;
        }
        return false;
    }, [navigate]);

    // --- Data Fetchers ---

    const fetchServiceRegistry = useCallback(async () => {
        try {
            setLoadingRegistry(true);
            const data = await api.get("/api/v1/admin/system/services");
            setRegisteredServices(data.services || []);
        } catch (error: any) {
            if (await handleAuthError(error)) return;
            toast({
                title: "Service Registry Error",
                description: error.message || "Failed to load service registry.",
                variant: "destructive",
            });
        } finally {
            setLoadingRegistry(false);
        }
    }, [handleAuthError, toast]);

    const fetchHealthCheck = useCallback(async () => {
        try {
            setLoadingHealth(true);
            const data = await api.get("/api/v1/admin/system/health-check");
            setServiceHealth(data.services || []);
            setCheckedAt(data.checkedAt || new Date().toISOString());
        } catch (error: any) {
            if (await handleAuthError(error)) return;
            toast({
                title: "Health Check Error",
                description: error.message || "Failed to run health check.",
                variant: "destructive",
            });
        } finally {
            setLoadingHealth(false);
            setRefreshing(false);
        }
    }, [handleAuthError, toast]);

    const fetchPlatformConfig = useCallback(async () => {
        try {
            setLoadingConfig(true);
            const data = await api.get("/api/v1/admin/system/config");
            setPlatformConfig(data);
        } catch (error: any) {
            if (await handleAuthError(error)) return;
            toast({
                title: "Config Error",
                description: error.message || "Failed to load platform configuration.",
                variant: "destructive",
            });
        } finally {
            setLoadingConfig(false);
        }
    }, [handleAuthError, toast]);

    // --- Initial Load ---
    useEffect(() => {
        fetchServiceRegistry();
        fetchHealthCheck();
        fetchPlatformConfig();
    }, [fetchServiceRegistry, fetchHealthCheck, fetchPlatformConfig]);

    // --- Auto-Refresh Polling ---
    useEffect(() => {
        if (autoRefresh) {
            pollingRef.current = setInterval(() => {
                fetchHealthCheck();
            }, 30000);
        } else {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
        }
        return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
        };
    }, [autoRefresh, fetchHealthCheck]);

    // --- Manual Refresh ---
    const handleRunHealthCheck = () => {
        setRefreshing(true);
        fetchHealthCheck();
    };

    // --- Skeleton Loaders ---
    const SkeletonCard = () => (
        <Card className="border">
            <CardHeader className="pb-2">
                <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-6 w-16" />
            </CardContent>
        </Card>
    );

    // --- Computed Values ---
    const upCount = serviceHealth.filter(s => s.status === "UP").length;
    const degradedCount = serviceHealth.filter(s => s.status === "DEGRADED").length;
    const downCount = serviceHealth.filter(s => s.status === "DOWN").length;

    return (
        <DashboardLayout
            title="System Health"
            subtitle="Real-time status of all MediConnect platform services"
            userRole="admin"
            userName={profile?.name || "Admin"}
            userAvatar={profile?.avatar || ""}
            onLogout={handleLogout}
        >
            <div className="space-y-6 p-6">
                {/* Page Header */}
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            <Activity className="h-6 w-6 text-blue-600" />
                            System Health Monitor
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Real-time status of all MediConnect platform services.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="auto-refresh"
                                checked={autoRefresh}
                                onCheckedChange={(checked) => setAutoRefresh(checked === true)}
                            />
                            <label
                                htmlFor="auto-refresh"
                                className="text-sm text-muted-foreground cursor-pointer select-none"
                            >
                                Auto-refresh (30s)
                            </label>
                        </div>
                        <Button
                            onClick={handleRunHealthCheck}
                            disabled={refreshing}
                            variant="outline"
                            className="gap-2"
                        >
                            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
                            Run Health Check
                        </Button>
                    </div>
                </div>

                {/* Last Checked Timestamp */}
                {checkedAt && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        Last checked at: {new Date(checkedAt).toLocaleString()}
                    </div>
                )}

                {/* Summary Badges */}
                {!loadingHealth && serviceHealth.length > 0 && (
                    <div className="flex items-center gap-3">
                        <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            {upCount} UP
                        </Badge>
                        {degradedCount > 0 && (
                            <Badge className="bg-amber-100 text-amber-700 text-xs">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                {degradedCount} DEGRADED
                            </Badge>
                        )}
                        {downCount > 0 && (
                            <Badge className="bg-red-100 text-red-700 text-xs">
                                <XCircle className="h-3 w-3 mr-1" />
                                {downCount} DOWN
                            </Badge>
                        )}
                    </div>
                )}

                {/* Section 1: Service Registry */}
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Server className="h-5 w-5 text-slate-600" />
                        Service Registry
                    </h2>
                    {loadingRegistry ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <SkeletonCard key={i} />
                            ))}
                        </div>
                    ) : registeredServices.length === 0 ? (
                        <Card>
                            <CardContent className="py-8 text-center text-muted-foreground">
                                No registered services found.
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {registeredServices.map((service) => (
                                <Card key={service.name} className="border">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                                            <Server className="h-4 w-4 text-blue-500" />
                                            {service.name}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-1 text-sm text-muted-foreground">
                                        <p>Port: <span className="font-mono font-medium text-foreground">{service.port}</span></p>
                                        <p>Type: <span className="font-medium text-foreground">{service.type}</span></p>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>

                {/* Section 2: Live Health Check */}
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Wifi className="h-5 w-5 text-green-600" />
                        Live Health Check
                    </h2>
                    {loadingHealth ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <SkeletonCard key={i} />
                            ))}
                        </div>
                    ) : serviceHealth.length === 0 ? (
                        <Card>
                            <CardContent className="py-8 text-center text-muted-foreground">
                                No health data available. Click "Run Health Check" to start.
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {serviceHealth.map((service) => (
                                <Card
                                    key={service.name}
                                    className={cn("border-2 transition-colors", statusBorderColor(service.status))}
                                >
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium flex items-center justify-between">
                                            <span className="flex items-center gap-2">
                                                {statusIcon(service.status)}
                                                {service.name}
                                            </span>
                                            <Badge className={cn(
                                                "text-xs",
                                                service.status === "UP" ? "bg-emerald-100 text-emerald-700" :
                                                service.status === "DEGRADED" ? "bg-amber-100 text-amber-700" :
                                                service.status === "DOWN" ? "bg-red-100 text-red-700" :
                                                "bg-slate-100 text-slate-500"
                                            )}>
                                                {service.status}
                                            </Badge>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-1 text-sm text-muted-foreground">
                                        <p>Port: <span className="font-mono font-medium text-foreground">{service.port}</span></p>
                                        <p className="flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            Latency: <span className={cn(
                                                "font-medium",
                                                service.latencyMs < 100 ? "text-emerald-600" :
                                                service.latencyMs < 500 ? "text-amber-600" :
                                                "text-red-600"
                                            )}>{service.latencyMs}ms</span>
                                        </p>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>

                {/* Section 3: Platform Config */}
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Server className="h-5 w-5 text-purple-600" />
                        Platform Configuration
                    </h2>
                    {loadingConfig ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <SkeletonCard />
                            <SkeletonCard />
                        </div>
                    ) : !platformConfig ? (
                        <Card>
                            <CardContent className="py-8 text-center text-muted-foreground">
                                Unable to load platform configuration.
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Environment Info */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm font-medium">Environment</CardTitle>
                                    <CardDescription>Current deployment details</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Environment</span>
                                        <Badge variant="outline" className="font-mono">
                                            {platformConfig.environment}
                                        </Badge>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Region</span>
                                        <Badge variant="outline" className="font-mono">
                                            {platformConfig.region}
                                        </Badge>
                                    </div>
                                    {platformConfig.versions && Object.entries(platformConfig.versions).map(([key, value]) => (
                                        <div key={key} className="flex justify-between">
                                            <span className="text-muted-foreground">{key}</span>
                                            <span className="font-mono text-xs text-foreground">{value}</span>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>

                            {/* Feature Flags */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-sm font-medium">Feature Flags</CardTitle>
                                    <CardDescription>Platform feature toggles</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-2 gap-3">
                                        {platformConfig.features && Object.entries(platformConfig.features).map(([flag, enabled]) => (
                                            <div
                                                key={flag}
                                                className="flex items-center justify-between rounded-md border px-3 py-2"
                                            >
                                                <span className="text-xs font-medium truncate mr-2">
                                                    {flag}
                                                </span>
                                                <Badge className={cn(
                                                    "text-xs shrink-0",
                                                    enabled
                                                        ? "bg-emerald-100 text-emerald-700"
                                                        : "bg-slate-100 text-slate-500"
                                                )}>
                                                    {enabled ? "ON" : "OFF"}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
