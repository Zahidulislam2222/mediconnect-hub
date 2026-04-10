import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Video,
  FileText,
  Pill,
  BookOpen,
  Calendar,
  MessageSquare,
  Settings,
  CreditCard,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Users,
  BarChart3,
  Brain,
  Activity,
  ShieldCheck,
  ClipboardList,
  Server,
  ScrollText,
  Clock,
  Megaphone,
  Contact,
  Beaker,
  HeartPulse,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  userRole: "patient" | "doctor" | "admin" | "staff";
  userName: string;
  userAvatar: string;
  onLogout: () => void;
  className?: string;
}

const patientNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/patient-dashboard" },
  { icon: Calendar, label: "Appointments", path: "/appointments" },
  { icon: CreditCard, label: "Billing", path: "/billing" },
  { icon: Video, label: "Consultation", path: "/consultation" },
  { icon: MessageSquare, label: "Messages", path: "/patient/messages" },
  { icon: Brain, label: "Symptom Checker", path: "/symptom-checker" },
  { icon: FileText, label: "Health Records", path: "/healthRecords" },
  { icon: Pill, label: "Pharmacy", path: "/pharmacy" },
  { icon: BookOpen, label: "Knowledge Base", path: "/knowledge" },
];

const doctorNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/doctor-dashboard" },
  { icon: Users, label: "Patient Queue", path: "/patient-queue" },
  { icon: BarChart3, label: "Analytics", path: "/analytics" },
  { icon: Video, label: "Consultation", path: "/consultation" },
  { icon: MessageSquare, label: "Messages", path: "/doctor/messages" },
  { icon: Activity, label: "Live Monitoring", path: "/live-monitoring" },
  { icon: FileText, label: "Patient Records", path: "/patient-records" },
  { icon: Pill, label: "Prescriptions", path: "/prescriptions" },
  { icon: Beaker, label: "Clinical Tools", path: "/clinical-tools" },
  { icon: BookOpen, label: "Knowledge Base", path: "/knowledge" },
];

const adminNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/admin/dashboard" },
  { icon: Users, label: "User Management", path: "/admin/users" },
  { icon: ShieldCheck, label: "Closure Requests", path: "/admin/closures" },
  { icon: ScrollText, label: "Audit Logs", path: "/admin/audit-logs" },
  { icon: Server, label: "System Health", path: "/admin/system" },
];

const staffNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/staff/dashboard" },
  { icon: Clock, label: "Shift Schedule", path: "/staff/schedule" },
  { icon: ClipboardList, label: "Tasks", path: "/staff/tasks" },
  { icon: Contact, label: "Directory", path: "/staff/directory" },
];

const roleConfig = {
  patient: { label: "Patient Portal", color: "bg-accent/10 text-accent border-accent/15" },
  doctor: { label: "Doctor Portal", color: "bg-accent/10 text-accent border-accent/15" },
  admin: { label: "Admin Portal", color: "bg-destructive/10 text-destructive border-destructive/15" },
  staff: { label: "Staff Portal", color: "bg-warning/10 text-warning border-warning/15" },
};

export function Sidebar({ userRole, userName, userAvatar, onLogout, className }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  const navItemsMap = { patient: patientNavItems, doctor: doctorNavItems, admin: adminNavItems, staff: staffNavItems };
  const navItems = navItemsMap[userRole] || patientNavItems;
  const config = roleConfig[userRole];

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200",
        collapsed ? "w-[72px]" : "w-64",
        className
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-4">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background">
              <HeartPulse className="h-4 w-4" />
            </div>
            <span className="font-display text-base font-bold text-sidebar-foreground">MediConnect</span>
          </div>
        )}
        {collapsed && (
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background">
            <HeartPulse className="h-4 w-4" />
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7 rounded-md text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-foreground",
            collapsed && "absolute -right-3.5 top-6 bg-card shadow-md border border-border h-7 w-7"
          )}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {/* Divider */}
      <div className="mx-3 h-px bg-sidebar-border" />

      {/* Role Badge */}
      {!collapsed && (
        <div className="px-3 py-3">
          <div className={cn(
            "flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-medium",
            config.color
          )}>
            {config.label}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-1 scrollbar-thin">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={cn(
                    "nav-item",
                    isActive ? "nav-item-active" : "nav-item-inactive",
                    collapsed && "justify-center px-2"
                  )}
                >
                  <item.icon className={cn("h-[18px] w-[18px] flex-shrink-0", isActive && "text-sidebar-primary")} />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Divider */}
      <div className="mx-3 h-px bg-sidebar-border" />

      {/* Settings */}
      <div className="px-3 py-2">
        {(userRole === "patient" || userRole === "doctor") && (
          <NavLink
            to={userRole === 'doctor' ? "/doctor/settings" : "/patient/settings"}
            className={cn(
              "nav-item",
              location.pathname.includes("/settings") ? "nav-item-active" : "nav-item-inactive",
              collapsed && "justify-center px-2"
            )}
          >
            <Settings className="h-[18px] w-[18px] flex-shrink-0" />
            {!collapsed && <span>Settings</span>}
          </NavLink>
        )}
      </div>

      {/* Divider */}
      <div className="mx-3 h-px bg-sidebar-border" />

      {/* User Profile */}
      <div className={cn("p-3", collapsed && "px-2")}>
        <div className={cn(
          "flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-sidebar-accent",
          collapsed && "justify-center"
        )}>
          <Avatar className="h-8 w-8 border border-border rounded-lg">
            <AvatarImage src={userAvatar} alt={userName} className="object-cover rounded-lg" />
            <AvatarFallback className="bg-accent/10 text-accent text-xs font-medium rounded-lg">
              {(userName || "User").substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          {!collapsed && (
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-sidebar-foreground">{userName}</p>
              <p className="truncate text-xs text-sidebar-foreground/50">
                {userRole === "doctor" ? "Doctor" : userRole === "admin" ? "Administrator" : userRole === "staff" ? "Staff" : "Patient"}
              </p>
            </div>
          )}
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-md text-sidebar-foreground/40 hover:bg-destructive/10 hover:text-destructive"
              onClick={onLogout}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
}
