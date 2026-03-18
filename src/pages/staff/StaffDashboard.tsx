import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from 'aws-amplify/auth';
import { fetchUserAttributes } from 'aws-amplify/auth';
import {
  Clock,
  ClipboardList,
  Megaphone,
  Calendar,
  AlertCircle,
  Plus
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { getUser, clearAllSensitive } from "@/lib/secure-storage";

interface Shift {
  shiftId: string;
  startTime: string;
  endTime: string;
  department: string;
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
}

interface Task {
  taskId: string;
  title: string;
  priority: "Urgent" | "High" | "Medium" | "Low";
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED";
  dueDate: string;
  assignedTo: string;
}

interface Announcement {
  announcementId: string;
  title: string;
  content: string;
  priority: "Urgent" | "High" | "Medium" | "Low";
  createdAt: string;
}

const SkeletonCard = () => (
  <div className="animate-pulse space-y-2 p-4">
    <div className="h-4 w-20 bg-slate-200 rounded"></div>
    <div className="h-6 w-16 bg-slate-100 rounded"></div>
  </div>
);

const SkeletonList = () => (
  <div className="animate-pulse space-y-3 p-4">
    {[1, 2, 3].map((i) => (
      <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border">
        <div className="space-y-2">
          <div className="h-4 w-40 bg-slate-200 rounded"></div>
          <div className="h-3 w-24 bg-slate-100 rounded"></div>
        </div>
        <div className="h-6 w-16 bg-slate-100 rounded"></div>
      </div>
    ))}
  </div>
);

const shiftStatusColor: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-800 border-blue-200",
  IN_PROGRESS: "bg-amber-100 text-amber-800 border-amber-200",
  COMPLETED: "bg-green-100 text-green-800 border-green-200",
  CANCELLED: "bg-gray-100 text-gray-800 border-gray-200",
};

const priorityColor: Record<string, string> = {
  Urgent: "bg-red-100 text-red-800 border-red-200",
  High: "bg-orange-100 text-orange-800 border-orange-200",
  Medium: "bg-blue-100 text-blue-800 border-blue-200",
  Low: "bg-gray-100 text-gray-800 border-gray-200",
};

const taskStatusColor: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-800 border-blue-200",
  IN_PROGRESS: "bg-amber-100 text-amber-800 border-amber-200",
};

export default function StaffDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewAnnouncement, setShowNewAnnouncement] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: "", content: "", priority: "Medium" as string });
  const [isCreatingAnnouncement, setIsCreatingAnnouncement] = useState(false);

  const [staffProfile] = useState(() => {
    const saved = getUser();
    return saved || { name: "Staff Member", role: "staff" };
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      const attributes = await fetchUserAttributes();
      const userId = attributes.sub;

      if (!userId) return;

      const [shiftsData, tasksData, announcementsData] = await Promise.all([
        api.get(`/shifts?staffId=${userId}`).catch(() => null),
        api.get(`/tasks?assignedTo=${userId}`).catch(() => null),
        api.get(`/announcements`).catch(() => null),
      ]);

      // Process shifts: filter to today only
      if (shiftsData) {
        const allShifts: Shift[] = shiftsData.shifts || [];
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);

        const todayShifts = allShifts.filter((s) => {
          const shiftDate = new Date(s.startTime);
          return shiftDate >= startOfToday && shiftDate <= endOfToday;
        });

        setShifts(todayShifts);
      }

      // Process tasks: filter to OPEN and IN_PROGRESS
      if (tasksData) {
        const allTasks: Task[] = tasksData.tasks || [];
        const activeTasks = allTasks.filter(
          (t) => t.status === "OPEN" || t.status === "IN_PROGRESS"
        );
        setTasks(activeTasks);
      }

      // Process announcements: latest 5
      if (announcementsData) {
        const allAnnouncements: Announcement[] = announcementsData.announcements || [];
        const latest = allAnnouncements
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 5);
        setAnnouncements(latest);
      }
    } catch (error: any) {
      console.error("Staff Dashboard Load Error:", error);
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

  const handleCreateAnnouncement = async () => {
    if (!newAnnouncement.title.trim() || !newAnnouncement.content.trim()) {
      toast({ variant: "destructive", title: "Validation", description: "Title and content are required." });
      return;
    }
    setIsCreatingAnnouncement(true);
    try {
      await api.post('/announcements', newAnnouncement);
      toast({ title: "Announcement Created", description: "Your announcement has been published." });
      setShowNewAnnouncement(false);
      setNewAnnouncement({ title: "", content: "", priority: "Medium" });
      loadDashboardData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error?.message || "Failed to create announcement." });
    } finally {
      setIsCreatingAnnouncement(false);
    }
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });

  const truncate = (text: string, maxLength: number) =>
    text.length > maxLength ? text.substring(0, maxLength) + "..." : text;

  const openTasksCount = tasks.filter((t) => t.status === "OPEN").length;
  const inProgressCount = tasks.filter((t) => t.status === "IN_PROGRESS").length;

  return (
    <DashboardLayout
      title={`Welcome, ${staffProfile.name}`}
      subtitle="Here is your daily staff overview"
      userRole="staff"
      userName={staffProfile.name}
      userAvatar={staffProfile.avatar}
      onLogout={async () => {
        await signOut();
        clearAllSensitive();
        navigate("/auth");
      }}
    >
      <div className="space-y-6 animate-fade-in pb-10">

        {/* KPI Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="shadow-sm border-border/50">
            <CardContent className="p-6">
              {isLoading ? (
                <SkeletonCard />
              ) : (
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Today's Shifts</p>
                    <h3 className="text-2xl font-bold mt-2">{shifts.length}</h3>
                  </div>
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Calendar className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/50">
            <CardContent className="p-6">
              {isLoading ? (
                <SkeletonCard />
              ) : (
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Open Tasks</p>
                    <h3 className="text-2xl font-bold mt-2">{openTasksCount}</h3>
                  </div>
                  <div className="p-2 bg-orange-50 rounded-lg">
                    <ClipboardList className="h-5 w-5 text-orange-600" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/50">
            <CardContent className="p-6">
              {isLoading ? (
                <SkeletonCard />
              ) : (
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">In Progress</p>
                    <h3 className="text-2xl font-bold mt-2">{inProgressCount}</h3>
                  </div>
                  <div className="p-2 bg-amber-50 rounded-lg">
                    <Clock className="h-5 w-5 text-amber-600" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/50">
            <CardContent className="p-6">
              {isLoading ? (
                <SkeletonCard />
              ) : (
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Announcements</p>
                    <h3 className="text-2xl font-bold mt-2">{announcements.length}</h3>
                  </div>
                  <div className="p-2 bg-purple-50 rounded-lg">
                    <Megaphone className="h-5 w-5 text-purple-600" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Three Sections Below KPIs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* My Shifts Today */}
          <Card className="shadow-sm border-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                <div>
                  <CardTitle className="text-lg">My Shifts Today</CardTitle>
                  <CardDescription>Your scheduled shifts for today</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <SkeletonList />
              ) : shifts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground bg-muted/10 rounded-xl border border-dashed">
                  <Calendar className="h-10 w-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No shifts scheduled for today.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {shifts.map((shift) => (
                    <div
                      key={shift.shiftId}
                      className="flex items-center justify-between p-3 rounded-lg border border-border hover:shadow-sm transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>
                            {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground pl-5">{shift.department}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={shiftStatusColor[shift.status] || ""}
                      >
                        {shift.status.replace("_", " ")}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* My Tasks */}
          <Card className="shadow-sm border-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-orange-600" />
                <div>
                  <CardTitle className="text-lg">My Tasks</CardTitle>
                  <CardDescription>Open and in-progress tasks</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <SkeletonList />
              ) : tasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground bg-muted/10 rounded-xl border border-dashed">
                  <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No open tasks assigned to you.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tasks.map((task) => (
                    <div
                      key={task.taskId}
                      className="flex items-center justify-between p-3 rounded-lg border border-border hover:shadow-sm transition-all"
                    >
                      <div className="space-y-1 flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{task.title}</p>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={priorityColor[task.priority] || ""}
                          >
                            {task.priority}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={taskStatusColor[task.status] || ""}
                          >
                            {task.status.replace("_", " ")}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                        {formatDate(task.dueDate)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Latest Announcements */}
          <Card className="shadow-sm border-border/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Megaphone className="h-5 w-5 text-purple-600" />
                  <div>
                    <CardTitle className="text-lg">Latest Announcements</CardTitle>
                    <CardDescription>Recent updates and notices</CardDescription>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => setShowNewAnnouncement(!showNewAnnouncement)}>
                  <Plus className="h-4 w-4 mr-1" /> New
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {showNewAnnouncement && (
                <div className="mb-4 p-3 border border-purple-200 rounded-lg bg-purple-50/30 space-y-2">
                  <Input
                    placeholder="Announcement title"
                    value={newAnnouncement.title}
                    onChange={(e) => setNewAnnouncement(prev => ({ ...prev, title: e.target.value }))}
                  />
                  <textarea
                    placeholder="Content..."
                    value={newAnnouncement.content}
                    onChange={(e) => setNewAnnouncement(prev => ({ ...prev, content: e.target.value }))}
                    className="w-full min-h-[60px] p-2 text-sm border rounded-md bg-background"
                  />
                  <div className="flex items-center gap-2">
                    <select
                      value={newAnnouncement.priority}
                      onChange={(e) => setNewAnnouncement(prev => ({ ...prev, priority: e.target.value }))}
                      className="text-sm border rounded-md p-1.5 bg-background"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                    <Button size="sm" onClick={handleCreateAnnouncement} disabled={isCreatingAnnouncement}>
                      {isCreatingAnnouncement ? "Publishing..." : "Publish"}
                    </Button>
                  </div>
                </div>
              )}
              {isLoading ? (
                <SkeletonList />
              ) : announcements.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground bg-muted/10 rounded-xl border border-dashed">
                  <Megaphone className="h-10 w-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No announcements at this time.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {announcements.map((announcement) => (
                    <div
                      key={announcement.announcementId}
                      className="p-3 rounded-lg border border-border hover:shadow-sm transition-all space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">{announcement.title}</p>
                        <Badge
                          variant="outline"
                          className={priorityColor[announcement.priority] || ""}
                        >
                          {announcement.priority === "Urgent" && (
                            <AlertCircle className="h-3 w-3 mr-1" />
                          )}
                          {announcement.priority}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {truncate(announcement.content, 100)}
                      </p>
                      <p className="text-xs text-muted-foreground/60">
                        {formatDate(announcement.createdAt)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
