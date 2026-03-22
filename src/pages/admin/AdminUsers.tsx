import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from 'aws-amplify/auth';
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { getUser, clearAllSensitive } from "@/lib/secure-storage";
import { Users, UserX, UserCheck, Search, Shield, Eye, FileText } from "lucide-react";

export default function AdminUsers() {
    const navigate = useNavigate();
    const { toast } = useToast();

    // --- User session ---
    const [profile] = useState<any>(() => {
        try {
            return getUser() || null;
        } catch (e) { return null; }
    });

    // --- Patients state ---
    const [patients, setPatients] = useState<any[]>([]);
    const [patientsCount, setPatientsCount] = useState(0);
    const [patientsLastKey, setPatientsLastKey] = useState<any>(null);
    const [loadingPatients, setLoadingPatients] = useState(true);
    const [loadingMorePatients, setLoadingMorePatients] = useState(false);

    // --- Doctors state ---
    const [doctors, setDoctors] = useState<any[]>([]);
    const [doctorsCount, setDoctorsCount] = useState(0);
    const [doctorsLastKey, setDoctorsLastKey] = useState<any>(null);
    const [loadingDoctors, setLoadingDoctors] = useState(true);
    const [loadingMoreDoctors, setLoadingMoreDoctors] = useState(false);

    // --- Suspend dialog state ---
    const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
    const [suspendTarget, setSuspendTarget] = useState<{ id: string; type: "patients" | "doctors"; name: string } | null>(null);
    const [suspendReason, setSuspendReason] = useState("");
    const [suspending, setSuspending] = useState(false);

    // --- Detail dialog state ---
    const [detailDialogOpen, setDetailDialogOpen] = useState(false);
    const [detailData, setDetailData] = useState<any>(null);
    const [detailType, setDetailType] = useState<"patient" | "doctor">("patient");
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [auditTrail, setAuditTrail] = useState<any[]>([]);
    const [loadingAudit, setLoadingAudit] = useState(false);

    // --- Active tab ---
    const [activeTab, setActiveTab] = useState("patients");

    // --- View user detail ---
    const viewUserDetail = async (id: string, type: "patient" | "doctor") => {
        try {
            setLoadingDetail(true);
            setDetailType(type);
            setDetailDialogOpen(true);
            setAuditTrail([]);

            const endpoint = type === "patient"
                ? `/api/v1/admin/users/patients/${id}`
                : `/api/v1/admin/users/doctors/${id}`;

            const data: any = await api.get(endpoint);
            setDetailData(data);

            // Also fetch audit trail
            setLoadingAudit(true);
            try {
                const auditData: any = await api.get(`/api/v1/admin/audit/logs/user/${id}`);
                setAuditTrail(auditData.logs || []);
            } catch {
                setAuditTrail([]);
            } finally {
                setLoadingAudit(false);
            }
        } catch (error: any) {
            if (!handleAuthError(error)) {
                toast({ variant: "destructive", title: "Error", description: error?.message || "Failed to load user details" });
            }
            setDetailDialogOpen(false);
        } finally {
            setLoadingDetail(false);
        }
    };

    // --- Auth error handler ---
    const handleAuthError = (error: any) => {
        if (error?.message?.includes('401')) {
            clearAllSensitive();
            navigate("/auth");
            return true;
        }
        return false;
    };

    // --- Fetch patients ---
    const fetchPatients = async (isLoadMore = false) => {
        try {
            if (isLoadMore) setLoadingMorePatients(true);
            else setLoadingPatients(true);

            let url = `/api/v1/admin/users/patients`;
            if (isLoadMore && patientsLastKey) {
                url += `?start_key=${encodeURIComponent(JSON.stringify(patientsLastKey))}`;
            }

            const data: any = await api.get(url);
            const newPatients = data.patients || [];

            setPatients(prev => isLoadMore ? [...prev, ...newPatients] : newPatients);
            setPatientsCount(data.count || 0);
            setPatientsLastKey(data.lastEvaluatedKey || null);
        } catch (error: any) {
            if (!handleAuthError(error)) {
                toast({ variant: "destructive", title: "Error", description: error?.message || "Failed to load patients" });
            }
        } finally {
            setLoadingPatients(false);
            setLoadingMorePatients(false);
        }
    };

    // --- Fetch doctors ---
    const fetchDoctors = async (isLoadMore = false) => {
        try {
            if (isLoadMore) setLoadingMoreDoctors(true);
            else setLoadingDoctors(true);

            let url = `/api/v1/admin/users/doctors`;
            if (isLoadMore && doctorsLastKey) {
                url += `?start_key=${encodeURIComponent(JSON.stringify(doctorsLastKey))}`;
            }

            const data: any = await api.get(url);
            const newDoctors = data.doctors || [];

            setDoctors(prev => isLoadMore ? [...prev, ...newDoctors] : newDoctors);
            setDoctorsCount(data.count || 0);
            setDoctorsLastKey(data.lastEvaluatedKey || null);
        } catch (error: any) {
            if (!handleAuthError(error)) {
                toast({ variant: "destructive", title: "Error", description: error?.message || "Failed to load doctors" });
            }
        } finally {
            setLoadingDoctors(false);
            setLoadingMoreDoctors(false);
        }
    };

    // --- Initial load ---
    useEffect(() => {
        fetchPatients();
        fetchDoctors();
    }, []);

    // --- Suspend user ---
    const openSuspendDialog = (id: string, type: "patients" | "doctors", name: string) => {
        setSuspendTarget({ id, type, name });
        setSuspendReason("");
        setSuspendDialogOpen(true);
    };

    const handleSuspend = async () => {
        if (!suspendTarget || suspendReason.length < 10) return;

        try {
            setSuspending(true);
            await api.post(`/api/v1/admin/users/${suspendTarget.type}/${suspendTarget.id}/suspend`, { reason: suspendReason });

            toast({ title: "User Suspended", description: `${suspendTarget.name} has been suspended.` });
            setSuspendDialogOpen(false);

            // Refresh the relevant list
            if (suspendTarget.type === "patients") await fetchPatients();
            else await fetchDoctors();
        } catch (error: any) {
            if (!handleAuthError(error)) {
                toast({ variant: "destructive", title: "Suspend Failed", description: error?.message || "Failed to suspend user" });
            }
        } finally {
            setSuspending(false);
        }
    };

    // --- Reactivate user ---
    const handleReactivate = async (id: string, type: "patients" | "doctors", name: string) => {
        try {
            await api.post(`/api/v1/admin/users/${type}/${id}/reactivate`, { reason: "Reactivated by admin" });

            toast({ title: "User Reactivated", description: `${name} has been reactivated.` });

            if (type === "patients") await fetchPatients();
            else await fetchDoctors();
        } catch (error: any) {
            if (!handleAuthError(error)) {
                toast({ variant: "destructive", title: "Reactivate Failed", description: error?.message || "Failed to reactivate user" });
            }
        }
    };

    // --- Logout ---
    const handleLogout = async () => {
        try {
            await signOut();
        } catch (e) {
            console.error("Sign out error", e);
        }
        clearAllSensitive();
        navigate("/auth");
    };

    // --- Status badge ---
    const renderStatusBadge = (status: string) => (
        <Badge
            variant={
                status === "ACTIVE" || status === "APPROVED"
                    ? "default"
                    : status === "SUSPENDED"
                        ? "destructive"
                        : "secondary"
            }
            className="text-xs"
        >
            {status}
        </Badge>
    );

    // --- Skeleton rows ---
    const renderSkeletonRows = (columns: number) => (
        Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={`skeleton-${i}`}>
                {Array.from({ length: columns }).map((_, j) => (
                    <TableCell key={`skeleton-${i}-${j}`}>
                        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                    </TableCell>
                ))}
            </TableRow>
        ))
    );

    return (
        <DashboardLayout
            title="User Management"
            subtitle="Manage patients and doctors"
            userRole="admin"
            userName={profile?.name || "Admin"}
            userAvatar={profile?.avatar || ""}
            onLogout={handleLogout}
        >
            <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{patientsCount}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Doctors</CardTitle>
                            <Shield className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{doctorsCount}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                            <Search className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{patientsCount + doctorsCount}</div>
                        </CardContent>
                    </Card>
                </div>

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList>
                        <TabsTrigger value="patients">
                            <Users className="mr-2 h-4 w-4" />
                            Patients
                        </TabsTrigger>
                        <TabsTrigger value="doctors">
                            <Shield className="mr-2 h-4 w-4" />
                            Doctors
                        </TabsTrigger>
                    </TabsList>

                    {/* Patients Tab */}
                    <TabsContent value="patients">
                        <Card>
                            <CardHeader>
                                <CardTitle>Patients</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Verified</TableHead>
                                            <TableHead>Created At</TableHead>
                                            <TableHead>Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loadingPatients ? (
                                            renderSkeletonRows(6)
                                        ) : patients.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                                    No patients found
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            patients.map((patient) => (
                                                <TableRow key={patient.id || patient.patientId}>
                                                    <TableCell className="font-medium">{patient.name || "N/A"}</TableCell>
                                                    <TableCell>{patient.email || "N/A"}</TableCell>
                                                    <TableCell>{renderStatusBadge(patient.status || "ACTIVE")}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={patient.verified ? "default" : "secondary"} className="text-xs">
                                                            {patient.verified ? "Yes" : "No"}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        {patient.createdAt
                                                            ? new Date(patient.createdAt).toLocaleDateString()
                                                            : "N/A"}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex gap-2">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => viewUserDetail(patient.id || patient.patientId, "patient")}
                                                            >
                                                                <Eye className="mr-1 h-3 w-3" />
                                                                View
                                                            </Button>
                                                            {patient.status === "SUSPENDED" ? (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() =>
                                                                        handleReactivate(
                                                                            patient.id || patient.patientId,
                                                                            "patients",
                                                                            patient.name || "Patient"
                                                                        )
                                                                    }
                                                                >
                                                                    <UserCheck className="mr-1 h-3 w-3" />
                                                                    Reactivate
                                                                </Button>
                                                            ) : (
                                                                <Button
                                                                    size="sm"
                                                                    variant="destructive"
                                                                    onClick={() =>
                                                                        openSuspendDialog(
                                                                            patient.id || patient.patientId,
                                                                            "patients",
                                                                            patient.name || "Patient"
                                                                        )
                                                                    }
                                                                >
                                                                    <UserX className="mr-1 h-3 w-3" />
                                                                    Suspend
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>

                                {patientsLastKey && (
                                    <div className="mt-4 flex justify-center">
                                        <Button
                                            variant="outline"
                                            onClick={() => fetchPatients(true)}
                                            disabled={loadingMorePatients}
                                        >
                                            {loadingMorePatients ? "Loading..." : "Load More"}
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Doctors Tab */}
                    <TabsContent value="doctors">
                        <Card>
                            <CardHeader>
                                <CardTitle>Doctors</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Specialization</TableHead>
                                            <TableHead>Verification Status</TableHead>
                                            <TableHead>Identity Verified</TableHead>
                                            <TableHead>Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loadingDoctors ? (
                                            renderSkeletonRows(5)
                                        ) : doctors.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                                    No doctors found
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            doctors.map((doctor) => (
                                                <TableRow key={doctor.id || doctor.doctorId}>
                                                    <TableCell className="font-medium">{doctor.name || "N/A"}</TableCell>
                                                    <TableCell>{doctor.specialization || "N/A"}</TableCell>
                                                    <TableCell>
                                                        {renderStatusBadge(doctor.verificationStatus || doctor.status || "PENDING")}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            variant={doctor.identityVerified ? "default" : "secondary"}
                                                            className="text-xs"
                                                        >
                                                            {doctor.identityVerified ? "Yes" : "No"}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex gap-2">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => viewUserDetail(doctor.id || doctor.doctorId, "doctor")}
                                                            >
                                                                <Eye className="mr-1 h-3 w-3" />
                                                                View
                                                            </Button>
                                                            {(doctor.verificationStatus || doctor.status) === "SUSPENDED" ? (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() =>
                                                                        handleReactivate(
                                                                            doctor.id || doctor.doctorId,
                                                                            "doctors",
                                                                            doctor.name || "Doctor"
                                                                        )
                                                                    }
                                                                >
                                                                    <UserCheck className="mr-1 h-3 w-3" />
                                                                    Reactivate
                                                                </Button>
                                                            ) : (
                                                                <Button
                                                                    size="sm"
                                                                    variant="destructive"
                                                                    onClick={() =>
                                                                        openSuspendDialog(
                                                                            doctor.id || doctor.doctorId,
                                                                            "doctors",
                                                                            doctor.name || "Doctor"
                                                                        )
                                                                    }
                                                                >
                                                                    <UserX className="mr-1 h-3 w-3" />
                                                                    Suspend
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>

                                {doctorsLastKey && (
                                    <div className="mt-4 flex justify-center">
                                        <Button
                                            variant="outline"
                                            onClick={() => fetchDoctors(true)}
                                            disabled={loadingMoreDoctors}
                                        >
                                            {loadingMoreDoctors ? "Loading..." : "Load More"}
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>

            {/* Suspend Dialog */}
            <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Suspend User</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <p className="text-sm text-muted-foreground">
                            You are about to suspend <span className="font-semibold">{suspendTarget?.name}</span>.
                            Please provide a reason for this action.
                        </p>
                        <Textarea
                            placeholder="Enter reason for suspension (minimum 10 characters)..."
                            value={suspendReason}
                            onChange={(e) => setSuspendReason(e.target.value)}
                            rows={4}
                        />
                        {suspendReason.length > 0 && suspendReason.length < 10 && (
                            <p className="text-xs text-destructive">
                                Reason must be at least 10 characters ({suspendReason.length}/10)
                            </p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSuspendDialogOpen(false)} disabled={suspending}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleSuspend}
                            disabled={suspendReason.length < 10 || suspending}
                        >
                            {suspending ? "Suspending..." : "Confirm Suspend"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* User Detail Dialog */}
            <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {detailType === "patient" ? "Patient" : "Doctor"} Details
                        </DialogTitle>
                    </DialogHeader>
                    {loadingDetail ? (
                        <div className="space-y-3 py-4">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="h-4 w-full animate-pulse rounded bg-muted" />
                            ))}
                        </div>
                    ) : detailData ? (
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <span className="text-muted-foreground">Name:</span>
                                    <p className="font-medium">{detailData.name || "N/A"}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Email:</span>
                                    <p className="font-medium">{detailData.email || "N/A"}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Status:</span>
                                    <p>{renderStatusBadge(detailData.status || detailData.verificationStatus || "ACTIVE")}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Created:</span>
                                    <p className="font-medium">
                                        {detailData.createdAt ? new Date(detailData.createdAt).toLocaleString() : "N/A"}
                                    </p>
                                </div>
                                {detailType === "doctor" && (
                                    <>
                                        <div>
                                            <span className="text-muted-foreground">Specialization:</span>
                                            <p className="font-medium">{detailData.specialization || "N/A"}</p>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">License:</span>
                                            <p className="font-medium">{detailData.licenseNumber || "N/A"}</p>
                                        </div>
                                    </>
                                )}
                                {detailType === "patient" && (
                                    <>
                                        <div>
                                            <span className="text-muted-foreground">Verified:</span>
                                            <p className="font-medium">{detailData.isIdentityVerified ? "Yes" : "No"}</p>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Region:</span>
                                            <p className="font-medium">{detailData.region || "N/A"}</p>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Audit Trail Section */}
                            <div className="border-t pt-4">
                                <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                                    <FileText className="h-4 w-4" />
                                    Audit Trail (HIPAA)
                                </h4>
                                {loadingAudit ? (
                                    <div className="space-y-2">
                                        {Array.from({ length: 3 }).map((_, i) => (
                                            <div key={i} className="h-3 w-full animate-pulse rounded bg-muted" />
                                        ))}
                                    </div>
                                ) : auditTrail.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No audit records found</p>
                                ) : (
                                    <div className="max-h-48 overflow-y-auto space-y-1">
                                        {auditTrail.slice(0, 20).map((log: any, idx: number) => (
                                            <div key={idx} className="flex justify-between items-center text-xs border-b pb-1">
                                                <Badge variant="secondary" className="text-[10px]">{log.action}</Badge>
                                                <span className="text-muted-foreground truncate mx-2 flex-1">{log.description || ""}</span>
                                                <span className="text-muted-foreground whitespace-nowrap">
                                                    {log.timestamp ? new Date(log.timestamp).toLocaleString() : ""}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : null}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
}
