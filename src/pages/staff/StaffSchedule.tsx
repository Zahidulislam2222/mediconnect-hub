import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut, fetchUserAttributes } from 'aws-amplify/auth';
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { getUser, clearAllSensitive } from "@/lib/secure-storage";
import { Clock, Plus, Pencil, Trash2, Calendar } from "lucide-react";

interface Shift {
    shiftId: string;
    staffId: string;
    startTime: string;
    endTime: string;
    department: string;
    role: string;
    notes: string;
    status: string;
    createdAt: string;
}

const STATUS_BADGE_MAP: Record<string, string> = {
    SCHEDULED: "bg-blue-100 text-blue-800 border-blue-200",
    IN_PROGRESS: "bg-amber-100 text-amber-800 border-amber-200",
    COMPLETED: "bg-green-100 text-green-800 border-green-200",
    CANCELLED: "bg-gray-100 text-gray-800 border-gray-200",
};

const EMPTY_CREATE_FORM = {
    staffId: "",
    startTime: "",
    endTime: "",
    department: "",
    role: "",
    notes: "",
};

const EMPTY_EDIT_FORM = {
    shiftId: "",
    status: "",
    startTime: "",
    endTime: "",
    notes: "",
};

export default function StaffSchedule() {
    const navigate = useNavigate();
    const { toast } = useToast();

    // --- User session ---
    const [profile] = useState<any>(() => {
        try {
            return getUser() || null;
        } catch (e) { return null; }
    });

    const [userId, setUserId] = useState<string>("");
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Create dialog
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
    const [isCreating, setIsCreating] = useState(false);

    // Edit dialog
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
    const [isUpdating, setIsUpdating] = useState(false);

    // Delete confirmation
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // --- INIT ---
    useEffect(() => {
        async function init() {
            try {
                const attr = await fetchUserAttributes();
                const sub = attr.sub || "";
                setUserId(sub);
                await loadShifts();
            } catch (error: any) {
                if (error?.message?.includes('401')) {
                    clearAllSensitive();
                    navigate("/auth");
                } else {
                    toast({ variant: "destructive", title: "Session Error", description: error?.message || "Failed to initialize." });
                }
            }
        }
        init();
    }, []);

    // --- LOAD SHIFTS ---
    const loadShifts = async () => {
        setIsLoading(true);
        try {
            const data: any = await api.get("/shifts");
            const list = data?.shifts || [];
            setShifts(list);
        } catch (error: any) {
            if (error?.message?.includes('401')) {
                clearAllSensitive();
                navigate("/auth");
            } else {
                toast({ variant: "destructive", title: "Error", description: error?.message || "Failed to load shifts." });
            }
        } finally {
            setIsLoading(false);
        }
    };

    // --- CREATE SHIFT ---
    const openCreateDialog = () => {
        setCreateForm({ ...EMPTY_CREATE_FORM, staffId: userId });
        setShowCreateDialog(true);
    };

    const handleCreate = async () => {
        if (!createForm.startTime || !createForm.endTime || !createForm.department) {
            toast({ variant: "destructive", title: "Validation", description: "Start time, end time, and department are required." });
            return;
        }
        setIsCreating(true);
        try {
            await api.post("/shifts", {
                staffId: createForm.staffId,
                startTime: createForm.startTime,
                endTime: createForm.endTime,
                department: createForm.department,
                role: createForm.role,
                notes: createForm.notes,
            });
            toast({ title: "Shift Created", description: "Your new shift has been added to the schedule." });
            setShowCreateDialog(false);
            await loadShifts();
        } catch (error: any) {
            if (error?.message?.includes('401')) {
                clearAllSensitive();
                navigate("/auth");
            } else {
                toast({ variant: "destructive", title: "Error", description: error?.message || "Failed to create shift." });
            }
        } finally {
            setIsCreating(false);
        }
    };

    // --- EDIT SHIFT ---
    const openEditDialog = (shift: Shift) => {
        setEditForm({
            shiftId: shift.shiftId,
            status: shift.status,
            startTime: shift.startTime,
            endTime: shift.endTime,
            notes: shift.notes || "",
        });
        setShowEditDialog(true);
    };

    const handleUpdate = async () => {
        if (!editForm.shiftId) return;
        setIsUpdating(true);
        try {
            await api.put("/shifts", {
                shiftId: editForm.shiftId,
                status: editForm.status,
                startTime: editForm.startTime,
                endTime: editForm.endTime,
                notes: editForm.notes,
            });
            toast({ title: "Shift Updated", description: "The shift has been updated successfully." });
            setShowEditDialog(false);
            await loadShifts();
        } catch (error: any) {
            if (error?.message?.includes('401')) {
                clearAllSensitive();
                navigate("/auth");
            } else {
                toast({ variant: "destructive", title: "Error", description: error?.message || "Failed to update shift." });
            }
        } finally {
            setIsUpdating(false);
        }
    };

    // --- DELETE SHIFT ---
    const handleDelete = async (shiftId: string) => {
        setIsDeleting(true);
        try {
            await api.delete(`/shifts/${shiftId}`);
            toast({ title: "Shift Deleted", description: "The shift has been removed from the schedule." });
            setDeleteTarget(null);
            await loadShifts();
        } catch (error: any) {
            if (error?.message?.includes('401')) {
                clearAllSensitive();
                navigate("/auth");
            } else {
                toast({ variant: "destructive", title: "Error", description: error?.message || "Failed to delete shift." });
            }
        } finally {
            setIsDeleting(false);
        }
    };

    // --- LOGOUT ---
    const handleLogout = async () => {
        await signOut();
        clearAllSensitive();
        navigate("/auth");
    };

    // --- HELPERS ---
    const formatDate = (t: string) => {
        try { return new Date(t).toLocaleDateString(); }
        catch { return t; }
    };

    const formatTime = (t: string) => {
        try { return new Date(t).toLocaleTimeString(); }
        catch { return t; }
    };

    const getStatusBadge = (status: string) => {
        const classes = STATUS_BADGE_MAP[status] || STATUS_BADGE_MAP.SCHEDULED;
        return <Badge className={classes}>{status.replace("_", " ")}</Badge>;
    };

    // Convert ISO string to datetime-local format for input fields
    const toDatetimeLocal = (isoStr: string) => {
        try {
            const d = new Date(isoStr);
            if (isNaN(d.getTime())) return isoStr;
            const pad = (n: number) => n.toString().padStart(2, "0");
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        } catch {
            return isoStr;
        }
    };

    // --- SKELETON ---
    const renderSkeletonRows = () => (
        <>
            {[1, 2, 3, 4, 5].map((i) => (
                <TableRow key={i}>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((j) => (
                        <TableCell key={j}>
                            <div className="h-4 bg-muted animate-pulse rounded w-20" />
                        </TableCell>
                    ))}
                </TableRow>
            ))}
        </>
    );

    return (
        <DashboardLayout
            title="Staff Schedule"
            subtitle="Manage your shifts and work schedule"
            userRole="staff"
            userName={profile?.name || "Staff"}
            userAvatar={profile?.avatar || ""}
            onLogout={handleLogout}
        >
            <div className="space-y-6 animate-fade-in pb-10">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Calendar className="h-6 w-6 text-primary" />
                        <h2 className="text-2xl font-bold">Shift Schedule</h2>
                    </div>
                    <Button onClick={openCreateDialog}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Shift
                    </Button>
                </div>

                {/* Shifts Table */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="h-5 w-5" />
                            All Shifts
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Start Time</TableHead>
                                    <TableHead>End Time</TableHead>
                                    <TableHead>Department</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Notes</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    renderSkeletonRows()
                                ) : shifts.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                                            <Calendar className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                                            <p className="text-lg font-medium">No shifts scheduled</p>
                                            <p className="text-sm">Click "Create Shift" to add a new shift.</p>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    shifts.map((shift) => (
                                        <TableRow
                                            key={shift.shiftId}
                                            className="cursor-pointer hover:bg-muted/50"
                                            onClick={() => openEditDialog(shift)}
                                        >
                                            <TableCell>{formatDate(shift.startTime)}</TableCell>
                                            <TableCell>{formatTime(shift.startTime)}</TableCell>
                                            <TableCell>{formatTime(shift.endTime)}</TableCell>
                                            <TableCell>{shift.department}</TableCell>
                                            <TableCell>{shift.role || "-"}</TableCell>
                                            <TableCell>{getStatusBadge(shift.status)}</TableCell>
                                            <TableCell className="max-w-[200px] truncate">{shift.notes || "-"}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            openEditDialog(shift);
                                                        }}
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-destructive hover:text-destructive"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setDeleteTarget(shift.shiftId);
                                                        }}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            {/* Create Shift Dialog */}
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Create New Shift</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="create-staffId">Staff ID</Label>
                            <Input
                                id="create-staffId"
                                value={createForm.staffId}
                                onChange={(e) => setCreateForm({ ...createForm, staffId: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="create-startTime">Start Time</Label>
                            <Input
                                id="create-startTime"
                                type="datetime-local"
                                value={createForm.startTime}
                                onChange={(e) => setCreateForm({ ...createForm, startTime: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="create-endTime">End Time</Label>
                            <Input
                                id="create-endTime"
                                type="datetime-local"
                                value={createForm.endTime}
                                onChange={(e) => setCreateForm({ ...createForm, endTime: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="create-department">Department</Label>
                            <Input
                                id="create-department"
                                placeholder="e.g. Emergency, Radiology"
                                value={createForm.department}
                                onChange={(e) => setCreateForm({ ...createForm, department: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="create-role">Role (optional)</Label>
                            <Input
                                id="create-role"
                                placeholder="e.g. Nurse, Technician"
                                value={createForm.role}
                                onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="create-notes">Notes (optional)</Label>
                            <Textarea
                                id="create-notes"
                                placeholder="Any additional notes..."
                                value={createForm.notes}
                                onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreate} disabled={isCreating}>
                            {isCreating ? "Creating..." : "Create Shift"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Shift Dialog */}
            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Update Shift</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-status">Status</Label>
                            <Select
                                value={editForm.status}
                                onValueChange={(value) => setEditForm({ ...editForm, status: value })}
                            >
                                <SelectTrigger id="edit-status">
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                                    <SelectItem value="COMPLETED">Completed</SelectItem>
                                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-startTime">Start Time</Label>
                            <Input
                                id="edit-startTime"
                                type="datetime-local"
                                value={toDatetimeLocal(editForm.startTime)}
                                onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-endTime">End Time</Label>
                            <Input
                                id="edit-endTime"
                                type="datetime-local"
                                value={toDatetimeLocal(editForm.endTime)}
                                onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-notes">Notes</Label>
                            <Textarea
                                id="edit-notes"
                                placeholder="Any additional notes..."
                                value={editForm.notes}
                                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleUpdate} disabled={isUpdating}>
                            {isUpdating ? "Updating..." : "Update Shift"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Delete Shift</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground py-4">
                        Are you sure you want to delete this shift? This action cannot be undone.
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => deleteTarget && handleDelete(deleteTarget)}
                            disabled={isDeleting}
                        >
                            {isDeleting ? "Deleting..." : "Delete"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
}
