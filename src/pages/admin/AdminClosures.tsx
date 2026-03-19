import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from 'aws-amplify/auth';
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { getUser, clearAllSensitive } from "@/lib/secure-storage";
import { ShieldCheck, CheckCircle, XCircle, Eye, Calendar, Loader2, AlertTriangle } from "lucide-react";

export default function AdminClosures() {
    const navigate = useNavigate();
    const { toast } = useToast();

    const [profile] = useState<any>(() => {
        try { return getUser() || null; } catch { return null; }
    });

    const [closures, setClosures] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Decision dialog
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogAction, setDialogAction] = useState<"approve" | "reject">("approve");
    const [dialogTarget, setDialogTarget] = useState<any>(null);
    const [reason, setReason] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // Detail dialog
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailData, setDetailData] = useState<any>(null);
    const [detailAppointments, setDetailAppointments] = useState<any[]>([]);
    const [loadingDetail, setLoadingDetail] = useState(false);

    const handleAuthError = (error: any) => {
        if (error?.message?.includes('401')) {
            clearAllSensitive();
            navigate("/auth");
            return true;
        }
        return false;
    };

    const fetchClosures = async () => {
        try {
            setLoading(true);
            const data: any = await api.get('/api/v1/admin/closures/pending');
            setClosures(data.pendingClosures || []);
        } catch (error: any) {
            if (!handleAuthError(error)) {
                toast({ variant: "destructive", title: "Error", description: error?.message || "Failed to load closure requests" });
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchClosures(); }, []);

    const viewClosureDetail = async (doctorId: string) => {
        try {
            setLoadingDetail(true);
            setDetailOpen(true);
            const data: any = await api.get(`/api/v1/admin/closures/${doctorId}`);
            setDetailData(data.doctor || null);
            setDetailAppointments(data.pendingAppointments || []);
        } catch (error: any) {
            if (!handleAuthError(error)) {
                toast({ variant: "destructive", title: "Error", description: error?.message || "Failed to load details" });
            }
            setDetailOpen(false);
        } finally {
            setLoadingDetail(false);
        }
    };

    const openDecisionDialog = (doctor: any, action: "approve" | "reject") => {
        setDialogTarget(doctor);
        setDialogAction(action);
        setReason("");
        setDialogOpen(true);
    };

    const handleDecision = async () => {
        if (!dialogTarget || reason.length < 10) return;

        const doctorId = dialogTarget.doctorId || dialogTarget.id;
        try {
            setSubmitting(true);
            await api.post(`/api/v1/admin/closures/${doctorId}/${dialogAction}`, { reason });

            toast({
                title: dialogAction === "approve" ? "Closure Approved" : "Closure Rejected",
                description: dialogAction === "approve"
                    ? `${dialogTarget.name || "Doctor"} can now finalize account deletion.`
                    : `${dialogTarget.name || "Doctor"}'s account has been reactivated.`,
            });
            setDialogOpen(false);
            await fetchClosures();
        } catch (error: any) {
            if (!handleAuthError(error)) {
                toast({ variant: "destructive", title: "Error", description: error?.message || "Action failed" });
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleLogout = async () => {
        try { await signOut(); } catch {}
        clearAllSensitive();
        navigate("/auth");
    };

    const futureAppointments = detailAppointments.filter(a => {
        if (!a.timeSlot) return false;
        return new Date(a.timeSlot).getTime() > Date.now();
    });

    return (
        <DashboardLayout
            title="Closure Requests"
            subtitle="Review doctor account closure requests"
            userRole="admin"
            userName={profile?.name || "Admin"}
            userAvatar={profile?.avatar || ""}
            onLogout={handleLogout}
        >
            <div className="space-y-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5" />
                            Pending Closure Requests
                        </CardTitle>
                        <Badge variant="secondary" className="text-sm">
                            {closures.length} pending
                        </Badge>
                    </CardHeader>
                    <CardContent>
                        {closures.length === 0 && !loading ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <ShieldCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                <p>No pending closure requests</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Doctor</TableHead>
                                        <TableHead>Specialization</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        Array.from({ length: 3 }).map((_, i) => (
                                            <TableRow key={`skeleton-${i}`}>
                                                {Array.from({ length: 5 }).map((_, j) => (
                                                    <TableCell key={j}>
                                                        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        ))
                                    ) : (
                                        closures.map((doctor) => (
                                            <TableRow key={doctor.doctorId || doctor.id}>
                                                <TableCell className="font-medium">{doctor.name || "N/A"}</TableCell>
                                                <TableCell>{doctor.specialization || "N/A"}</TableCell>
                                                <TableCell className="text-muted-foreground">{doctor.email || "N/A"}</TableCell>
                                                <TableCell>
                                                    <Badge variant="destructive" className="text-xs">
                                                        PENDING_CLOSURE
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => viewClosureDetail(doctor.doctorId || doctor.id)}
                                                        >
                                                            <Eye className="mr-1 h-3 w-3" />
                                                            Review
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="default"
                                                            className="bg-green-600 hover:bg-green-700"
                                                            onClick={() => openDecisionDialog(doctor, "approve")}
                                                        >
                                                            <CheckCircle className="mr-1 h-3 w-3" />
                                                            Approve
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="destructive"
                                                            onClick={() => openDecisionDialog(doctor, "reject")}
                                                        >
                                                            <XCircle className="mr-1 h-3 w-3" />
                                                            Reject
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Decision Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {dialogAction === "approve" ? "Approve Closure" : "Reject Closure"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <p className="text-sm text-muted-foreground">
                            {dialogAction === "approve" ? (
                                <>
                                    You are approving <span className="font-semibold">{dialogTarget?.name || "this doctor"}</span>'s
                                    account closure. They will be able to finalize their deletion.
                                </>
                            ) : (
                                <>
                                    You are rejecting <span className="font-semibold">{dialogTarget?.name || "this doctor"}</span>'s
                                    closure request. Their account will be reactivated.
                                </>
                            )}
                        </p>
                        {dialogAction === "approve" && (
                            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                                <p className="text-xs text-amber-700">
                                    Once approved, the doctor can permanently delete their account, anonymizing all appointment
                                    records and erasing their identity from the platform. This cannot be undone.
                                </p>
                            </div>
                        )}
                        <Textarea
                            placeholder={`Enter reason for ${dialogAction}ion (minimum 10 characters)...`}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={4}
                        />
                        {reason.length > 0 && reason.length < 10 && (
                            <p className="text-xs text-destructive">
                                Reason must be at least 10 characters ({reason.length}/10)
                            </p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
                            Cancel
                        </Button>
                        <Button
                            variant={dialogAction === "approve" ? "default" : "destructive"}
                            className={dialogAction === "approve" ? "bg-green-600 hover:bg-green-700" : ""}
                            onClick={handleDecision}
                            disabled={reason.length < 10 || submitting}
                        >
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            {submitting
                                ? "Processing..."
                                : dialogAction === "approve"
                                    ? "Confirm Approval"
                                    : "Confirm Rejection"
                            }
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Detail Review Dialog */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Closure Review</DialogTitle>
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
                                    <span className="text-muted-foreground">Specialization:</span>
                                    <p className="font-medium">{detailData.specialization || "N/A"}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">License:</span>
                                    <p className="font-medium">{detailData.licenseNumber || "N/A"}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Closure Status:</span>
                                    <p><Badge variant="destructive" className="text-xs">{detailData.closureStatus}</Badge></p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Created:</span>
                                    <p className="font-medium">
                                        {detailData.createdAt ? new Date(detailData.createdAt).toLocaleDateString() : "N/A"}
                                    </p>
                                </div>
                            </div>

                            {/* Appointments Section */}
                            <div className="border-t pt-4">
                                <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                                    <Calendar className="h-4 w-4" />
                                    Appointments ({detailAppointments.length} total, {futureAppointments.length} future)
                                </h4>
                                {futureAppointments.length > 0 && (
                                    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 mb-3">
                                        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                                        <p className="text-xs text-amber-700">
                                            This doctor has {futureAppointments.length} future appointment(s).
                                            Patients with upcoming appointments should be notified or reassigned before approval.
                                        </p>
                                    </div>
                                )}
                                {detailAppointments.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No appointments found</p>
                                ) : (
                                    <div className="max-h-48 overflow-y-auto space-y-1">
                                        {detailAppointments.slice(0, 20).map((apt: any, idx: number) => (
                                            <div key={idx} className="flex justify-between items-center text-xs border-b pb-1">
                                                <Badge
                                                    variant={apt.status === "CANCELLED" ? "secondary" : new Date(apt.timeSlot).getTime() > Date.now() ? "destructive" : "default"}
                                                    className="text-[10px]"
                                                >
                                                    {apt.status || "BOOKED"}
                                                </Badge>
                                                <span className="text-muted-foreground truncate mx-2 flex-1">
                                                    {apt.patientName || apt.patientId || "Patient"}
                                                </span>
                                                <span className="text-muted-foreground whitespace-nowrap">
                                                    {apt.timeSlot ? new Date(apt.timeSlot).toLocaleString() : "N/A"}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : null}
                    <DialogFooter className="flex gap-2">
                        {detailData && (
                            <>
                                <Button
                                    variant="default"
                                    className="bg-green-600 hover:bg-green-700"
                                    onClick={() => {
                                        setDetailOpen(false);
                                        openDecisionDialog(detailData, "approve");
                                    }}
                                >
                                    <CheckCircle className="mr-1 h-3 w-3" />
                                    Approve
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={() => {
                                        setDetailOpen(false);
                                        openDecisionDialog(detailData, "reject");
                                    }}
                                >
                                    <XCircle className="mr-1 h-3 w-3" />
                                    Reject
                                </Button>
                            </>
                        )}
                        <Button variant="outline" onClick={() => setDetailOpen(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
}
