import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from 'aws-amplify/auth';
import { ScrollText, Search, Filter, RefreshCw } from "lucide-react";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { getUser, clearAllSensitive } from "@/lib/secure-storage";

interface AuditLog {
    timestamp: string;
    actorId: string;
    action: string;
    details: string;
    region: string;
}

interface AuditLogsResponse {
    logs: AuditLog[];
    count: number;
    lastEvaluatedKey?: string;
}

const getActionVariant = (action: string) => {
    if (action.includes('VIOLATION') || action.includes('HIJACK') || action.includes('FRAUD') || action.includes('SPOOF') || action.includes('UNAUTHORIZED') || action.includes('ILLEGAL')) return "destructive";
    if (action.startsWith('ADMIN_')) return "default";
    if (action.startsWith('CREATE') || action.startsWith('UPDATE')) return "secondary";
    return "outline";
};

export default function AdminAuditLogs() {
    const navigate = useNavigate();
    const { toast } = useToast();

    const [adminProfile] = useState(() => {
        const saved = getUser();
        return saved || { name: "Admin", avatar: null, role: "admin" };
    });

    const [isLoading, setIsLoading] = useState(true);
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [lastEvaluatedKey, setLastEvaluatedKey] = useState<string | undefined>(undefined);

    const [actionTypes, setActionTypes] = useState<string[]>([]);
    const [selectedAction, setSelectedAction] = useState("");
    const [actorId, setActorId] = useState("");

    // --- AUTH ERROR HANDLER ---
    const handleAuthError = (error: any) => {
        if (error?.message?.includes("401")) {
            clearAllSensitive();
            navigate("/auth");
            return true;
        }
        return false;
    };

    // --- FETCH ACTION TYPES ---
    const fetchActionTypes = async () => {
        try {
            const data = await api.get("/api/v1/admin/audit/logs/actions");
            setActionTypes(data.actions || []);
        } catch (error: any) {
            if (!handleAuthError(error)) {
                console.error("Failed to fetch action types:", error);
            }
        }
    };

    // --- FETCH AUDIT LOGS ---
    const fetchLogs = async (append = false) => {
        try {
            setIsLoading(true);

            const params = new URLSearchParams();
            if (selectedAction) params.set("action", selectedAction);
            if (actorId.trim()) params.set("actor_id", actorId.trim());
            params.set("limit", "50");
            if (append && lastEvaluatedKey) params.set("start_key", lastEvaluatedKey);

            const queryString = params.toString();
            const endpoint = `/api/v1/admin/audit/logs${queryString ? `?${queryString}` : ""}`;

            const data: AuditLogsResponse = await api.get(endpoint);

            if (append) {
                setLogs((prev) => [...prev, ...(data.logs || [])]);
            } else {
                setLogs(data.logs || []);
            }
            setTotalCount(data.count || 0);
            setLastEvaluatedKey(data.lastEvaluatedKey);
        } catch (error: any) {
            if (!handleAuthError(error)) {
                toast({
                    title: "Error",
                    description: "Failed to load audit logs. Please try again.",
                    variant: "destructive",
                });
            }
        } finally {
            setIsLoading(false);
        }
    };

    // --- INIT ---
    useEffect(() => {
        fetchActionTypes();
        fetchLogs();
    }, []);

    // --- SEARCH ---
    const handleSearch = () => {
        setLastEvaluatedKey(undefined);
        fetchLogs(false);
    };

    // --- CLEAR FILTERS ---
    const handleClearFilters = () => {
        setSelectedAction("");
        setActorId("");
        setLastEvaluatedKey(undefined);
        // Fetch with cleared filters on next tick
        setTimeout(() => fetchLogs(false), 0);
    };

    // --- LOAD MORE ---
    const handleLoadMore = () => {
        fetchLogs(true);
    };

    // --- LOGOUT ---
    const handleLogout = async () => {
        await signOut();
        clearAllSensitive();
        navigate("/auth");
    };

    // --- SKELETON ROWS ---
    const SkeletonRow = () => (
        <TableRow>
            <TableCell><div className="animate-pulse h-4 w-32 bg-slate-200 rounded" /></TableCell>
            <TableCell><div className="animate-pulse h-4 w-20 bg-slate-200 rounded" /></TableCell>
            <TableCell><div className="animate-pulse h-5 w-24 bg-slate-200 rounded-full" /></TableCell>
            <TableCell><div className="animate-pulse h-4 w-48 bg-slate-200 rounded" /></TableCell>
            <TableCell><div className="animate-pulse h-4 w-16 bg-slate-200 rounded" /></TableCell>
        </TableRow>
    );

    return (
        <DashboardLayout
            title="HIPAA Audit Logs"
            subtitle="Review all system activity and compliance events"
            userRole="admin"
            userName={adminProfile.name}
            userAvatar={adminProfile.avatar}
            onLogout={handleLogout}
        >
            <div className="space-y-6 animate-fade-in pb-10">

                {/* HEADER */}
                <div className="flex items-center gap-2">
                    <ScrollText className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold">Audit Trail</h2>
                    {!isLoading && (
                        <span className="text-sm text-muted-foreground ml-2">
                            ({totalCount} total records)
                        </span>
                    )}
                </div>

                {/* FILTER CONTROLS */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Filter className="h-4 w-4" />
                            Filters
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col sm:flex-row gap-3 items-end">
                            <div className="flex-1 min-w-[200px]">
                                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                                    Action Type
                                </label>
                                <Select value={selectedAction} onValueChange={setSelectedAction}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="All actions" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {actionTypes.map((action) => (
                                            <SelectItem key={action} value={action}>
                                                {action}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex-1 min-w-[200px]">
                                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                                    Actor ID
                                </label>
                                <Input
                                    placeholder="Enter actor ID..."
                                    value={actorId}
                                    onChange={(e) => setActorId(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                                />
                            </div>
                            <Button onClick={handleSearch} className="gap-2">
                                <Search className="h-4 w-4" />
                                Search
                            </Button>
                            <Button variant="outline" onClick={handleClearFilters} className="gap-2">
                                <RefreshCw className="h-4 w-4" />
                                Clear
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* AUDIT LOG TABLE */}
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Timestamp</TableHead>
                                    <TableHead>Actor ID</TableHead>
                                    <TableHead>Action</TableHead>
                                    <TableHead>Details</TableHead>
                                    <TableHead>Region</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading && logs.length === 0 ? (
                                    <>
                                        <SkeletonRow />
                                        <SkeletonRow />
                                        <SkeletonRow />
                                        <SkeletonRow />
                                        <SkeletonRow />
                                    </>
                                ) : logs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                                            No audit logs found matching the current filters.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    logs.map((log, index) => (
                                        <TableRow key={`${log.timestamp}-${log.actorId}-${index}`}>
                                            <TableCell className="whitespace-nowrap text-sm">
                                                {new Date(log.timestamp).toLocaleString()}
                                            </TableCell>
                                            <TableCell className="font-mono text-sm" title={log.actorId}>
                                                {log.actorId?.substring(0, 8)}...
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={getActionVariant(log.action) as any}>
                                                    {log.action}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm max-w-[300px] truncate">
                                                {log.details}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {log.region}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* LOAD MORE */}
                {lastEvaluatedKey && (
                    <div className="flex justify-center">
                        <Button
                            variant="outline"
                            onClick={handleLoadMore}
                            disabled={isLoading}
                            className="gap-2"
                        >
                            {isLoading ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                                <RefreshCw className="h-4 w-4" />
                            )}
                            Load More
                        </Button>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
