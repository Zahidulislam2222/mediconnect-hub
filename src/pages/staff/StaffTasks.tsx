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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { getUser, clearAllSensitive } from "@/lib/secure-storage";
import { ClipboardList, Plus, Pencil, CheckCircle, Clock, AlertCircle } from "lucide-react";

interface Task {
    taskId: string;
    title: string;
    description?: string;
    assignedTo: string;
    assignedBy: string;
    priority: string;
    status: string;
    department?: string;
    dueDate?: string;
    createdAt: string;
    completedAt?: string;
    completedBy?: string;
    notes?: string;
}

const priorityBadge = (priority: string) => {
    switch (priority) {
        case "Urgent":
            return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">{priority}</Badge>;
        case "High":
            return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">{priority}</Badge>;
        case "Medium":
            return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">{priority}</Badge>;
        case "Low":
            return <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100">{priority}</Badge>;
        default:
            return <Badge variant="outline">{priority}</Badge>;
    }
};

const statusBadge = (status: string) => {
    switch (status) {
        case "OPEN":
            return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Open</Badge>;
        case "IN_PROGRESS":
            return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">In Progress</Badge>;
        case "COMPLETED":
            return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Completed</Badge>;
        case "CANCELLED":
            return <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100">Cancelled</Badge>;
        default:
            return <Badge variant="outline">{status}</Badge>;
    }
};

export default function StaffTasks() {
    const navigate = useNavigate();
    const { toast } = useToast();

    // --- User session ---
    const [profile] = useState<any>(() => {
        try {
            return getUser() || null;
        } catch (e) { return null; }
    });

    const [userId, setUserId] = useState<string>("");
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("all");

    // Create Task dialog state
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [createForm, setCreateForm] = useState({
        title: "",
        description: "",
        assignedTo: "",
        priority: "Medium",
        dueDate: "",
        department: "",
    });
    const [isCreating, setIsCreating] = useState(false);

    // Update Task dialog state
    const [showUpdateDialog, setShowUpdateDialog] = useState(false);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [updateForm, setUpdateForm] = useState({
        status: "",
        priority: "",
        notes: "",
    });
    const [isUpdating, setIsUpdating] = useState(false);

    // --- INIT ---
    useEffect(() => {
        async function init() {
            try {
                const attr = await fetchUserAttributes();
                const sub = attr.sub || "";
                setUserId(sub);
                setCreateForm(prev => ({ ...prev, assignedTo: sub }));
                await fetchTasks();
            } catch (error: any) {
                const msg = error?.message || String(error);
                if (msg.includes("401")) {
                    clearAllSensitive();
                    navigate("/auth");
                } else {
                    toast({ variant: "destructive", title: "Error", description: "Failed to initialize." });
                }
            }
        }
        init();
    }, []);

    // --- FETCH TASKS ---
    const fetchTasks = async () => {
        setIsLoading(true);
        try {
            const data: any = await api.get("/tasks");
            setTasks(data.tasks || []);
        } catch (error: any) {
            const msg = error?.message || String(error);
            if (msg.includes("401")) {
                clearAllSensitive();
                navigate("/auth");
            } else {
                toast({ variant: "destructive", title: "Error", description: msg });
            }
        } finally {
            setIsLoading(false);
        }
    };

    // --- CREATE TASK ---
    const handleCreateTask = async () => {
        if (!createForm.title.trim()) {
            toast({ variant: "destructive", title: "Validation Error", description: "Title is required." });
            return;
        }
        setIsCreating(true);
        try {
            const body: any = {
                title: createForm.title.trim(),
                assignedTo: createForm.assignedTo || userId,
                priority: createForm.priority,
            };
            if (createForm.description.trim()) body.description = createForm.description.trim();
            if (createForm.dueDate) body.dueDate = createForm.dueDate;
            if (createForm.department.trim()) body.department = createForm.department.trim();

            await api.post("/tasks", body);
            toast({ title: "Task Created", description: "New task has been added successfully." });
            setShowCreateDialog(false);
            setCreateForm({
                title: "",
                description: "",
                assignedTo: userId,
                priority: "Medium",
                dueDate: "",
                department: "",
            });
            await fetchTasks();
        } catch (error: any) {
            const msg = error?.message || String(error);
            if (msg.includes("401")) {
                clearAllSensitive();
                navigate("/auth");
            } else {
                toast({ variant: "destructive", title: "Create Failed", description: msg });
            }
        } finally {
            setIsCreating(false);
        }
    };

    // --- UPDATE TASK ---
    const openUpdateDialog = (task: Task) => {
        setSelectedTask(task);
        setUpdateForm({
            status: task.status,
            priority: task.priority,
            notes: task.notes || "",
        });
        setShowUpdateDialog(true);
    };

    const handleUpdateTask = async () => {
        if (!selectedTask) return;
        setIsUpdating(true);
        try {
            await api.put("/tasks", {
                taskId: selectedTask.taskId,
                status: updateForm.status,
                priority: updateForm.priority,
                notes: updateForm.notes,
            });
            toast({ title: "Task Updated", description: "Task has been updated successfully." });
            setShowUpdateDialog(false);
            setSelectedTask(null);
            await fetchTasks();
        } catch (error: any) {
            const msg = error?.message || String(error);
            if (msg.includes("401")) {
                clearAllSensitive();
                navigate("/auth");
            } else {
                toast({ variant: "destructive", title: "Update Failed", description: msg });
            }
        } finally {
            setIsUpdating(false);
        }
    };

    // --- FILTERED TASKS ---
    const filteredTasks = tasks.filter(task => {
        if (activeTab === "all") return true;
        if (activeTab === "open") return task.status === "OPEN";
        if (activeTab === "in_progress") return task.status === "IN_PROGRESS";
        if (activeTab === "completed") return task.status === "COMPLETED";
        return true;
    });

    // --- SKELETON ROWS ---
    const skeletonRows = Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={`skeleton-${i}`}>
            <TableCell><div className="h-4 w-32 bg-muted animate-pulse rounded" /></TableCell>
            <TableCell><div className="h-4 w-16 bg-muted animate-pulse rounded" /></TableCell>
            <TableCell><div className="h-4 w-20 bg-muted animate-pulse rounded" /></TableCell>
            <TableCell><div className="h-4 w-24 bg-muted animate-pulse rounded" /></TableCell>
            <TableCell><div className="h-4 w-20 bg-muted animate-pulse rounded" /></TableCell>
            <TableCell><div className="h-4 w-24 bg-muted animate-pulse rounded" /></TableCell>
            <TableCell><div className="h-4 w-16 bg-muted animate-pulse rounded" /></TableCell>
        </TableRow>
    ));

    return (
        <DashboardLayout
            title="Staff Tasks"
            subtitle="Manage and track team tasks"
            userRole="staff"
            userName={profile?.name || "Staff"}
            userAvatar={profile?.avatar || ""}
            onLogout={() => { signOut(); clearAllSensitive(); navigate("/"); }}
        >
            <div className="space-y-6 animate-fade-in pb-10">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ClipboardList className="h-6 w-6 text-primary" />
                        <h2 className="text-2xl font-bold">Tasks</h2>
                    </div>
                    <Button onClick={() => setShowCreateDialog(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Task
                    </Button>
                </div>

                {/* Tabs + Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Task List</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="mb-4">
                                <TabsTrigger value="all">
                                    All ({tasks.length})
                                </TabsTrigger>
                                <TabsTrigger value="open">
                                    Open ({tasks.filter(t => t.status === "OPEN").length})
                                </TabsTrigger>
                                <TabsTrigger value="in_progress">
                                    <Clock className="h-3.5 w-3.5 mr-1" />
                                    In Progress ({tasks.filter(t => t.status === "IN_PROGRESS").length})
                                </TabsTrigger>
                                <TabsTrigger value="completed">
                                    <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                    Completed ({tasks.filter(t => t.status === "COMPLETED").length})
                                </TabsTrigger>
                            </TabsList>

                            {["all", "open", "in_progress", "completed"].map(tab => (
                                <TabsContent key={tab} value={tab}>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Title</TableHead>
                                                <TableHead>Priority</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Department</TableHead>
                                                <TableHead>Due Date</TableHead>
                                                <TableHead>Assigned By</TableHead>
                                                <TableHead>Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {isLoading ? (
                                                skeletonRows
                                            ) : filteredTasks.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                                                        <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                                                        No tasks found
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                filteredTasks.map(task => (
                                                    <TableRow
                                                        key={task.taskId}
                                                        className="cursor-pointer hover:bg-muted/50"
                                                        onClick={() => openUpdateDialog(task)}
                                                    >
                                                        <TableCell className="font-medium">{task.title}</TableCell>
                                                        <TableCell>{priorityBadge(task.priority)}</TableCell>
                                                        <TableCell>{statusBadge(task.status)}</TableCell>
                                                        <TableCell>{task.department || "—"}</TableCell>
                                                        <TableCell>
                                                            {task.dueDate
                                                                ? new Date(task.dueDate).toLocaleDateString()
                                                                : "—"}
                                                        </TableCell>
                                                        <TableCell>{task.assignedBy || "—"}</TableCell>
                                                        <TableCell>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    openUpdateDialog(task);
                                                                }}
                                                            >
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </TabsContent>
                            ))}
                        </Tabs>
                    </CardContent>
                </Card>
            </div>

            {/* --- CREATE TASK DIALOG --- */}
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Create New Task</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="create-title">Title *</Label>
                            <Input
                                id="create-title"
                                placeholder="Task title"
                                value={createForm.title}
                                onChange={e => setCreateForm(prev => ({ ...prev, title: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="create-description">Description</Label>
                            <Textarea
                                id="create-description"
                                placeholder="Optional description"
                                value={createForm.description}
                                onChange={e => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="create-assignedTo">Assigned To</Label>
                            <Input
                                id="create-assignedTo"
                                placeholder="User ID"
                                value={createForm.assignedTo}
                                onChange={e => setCreateForm(prev => ({ ...prev, assignedTo: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="create-priority">Priority</Label>
                            <Select
                                value={createForm.priority}
                                onValueChange={val => setCreateForm(prev => ({ ...prev, priority: val }))}
                            >
                                <SelectTrigger id="create-priority">
                                    <SelectValue placeholder="Select priority" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Low">Low</SelectItem>
                                    <SelectItem value="Medium">Medium</SelectItem>
                                    <SelectItem value="High">High</SelectItem>
                                    <SelectItem value="Urgent">Urgent</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="create-dueDate">Due Date</Label>
                            <Input
                                id="create-dueDate"
                                type="date"
                                value={createForm.dueDate}
                                onChange={e => setCreateForm(prev => ({ ...prev, dueDate: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="create-department">Department</Label>
                            <Input
                                id="create-department"
                                placeholder="Optional department"
                                value={createForm.department}
                                onChange={e => setCreateForm(prev => ({ ...prev, department: e.target.value }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={isCreating}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreateTask} disabled={isCreating}>
                            {isCreating ? "Creating..." : "Create Task"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* --- UPDATE TASK DIALOG --- */}
            <Dialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Update Task</DialogTitle>
                    </DialogHeader>
                    {selectedTask && (
                        <div className="space-y-4 py-4">
                            <div>
                                <p className="text-sm text-muted-foreground">Title</p>
                                <p className="font-medium">{selectedTask.title}</p>
                            </div>
                            {selectedTask.description && (
                                <div>
                                    <p className="text-sm text-muted-foreground">Description</p>
                                    <p className="text-sm">{selectedTask.description}</p>
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="update-status">Status</Label>
                                <Select
                                    value={updateForm.status}
                                    onValueChange={val => setUpdateForm(prev => ({ ...prev, status: val }))}
                                >
                                    <SelectTrigger id="update-status">
                                        <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="OPEN">Open</SelectItem>
                                        <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                                        <SelectItem value="COMPLETED">Completed</SelectItem>
                                        <SelectItem value="CANCELLED">Cancelled</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="update-priority">Priority</Label>
                                <Select
                                    value={updateForm.priority}
                                    onValueChange={val => setUpdateForm(prev => ({ ...prev, priority: val }))}
                                >
                                    <SelectTrigger id="update-priority">
                                        <SelectValue placeholder="Select priority" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Low">Low</SelectItem>
                                        <SelectItem value="Medium">Medium</SelectItem>
                                        <SelectItem value="High">High</SelectItem>
                                        <SelectItem value="Urgent">Urgent</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="update-notes">Notes</Label>
                                <Textarea
                                    id="update-notes"
                                    placeholder="Add notes..."
                                    value={updateForm.notes}
                                    onChange={e => setUpdateForm(prev => ({ ...prev, notes: e.target.value }))}
                                />
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowUpdateDialog(false)} disabled={isUpdating}>
                            Cancel
                        </Button>
                        <Button onClick={handleUpdateTask} disabled={isUpdating}>
                            {isUpdating ? "Updating..." : "Update Task"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
}
