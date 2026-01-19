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
  Stethoscope,
  Users,
  BarChart3,
  Shield,
  Brain,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
// 🟢 ADDED AvatarImage HERE
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

interface SidebarProps {
  userRole: "patient" | "doctor";
  userName: string;
  userAvatar: string;
  onLogout: () => void;
  className?: string;
}

const patientNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: Calendar, label: "Appointments", path: "/appointments" },
  { icon: CreditCard, label: "Billing", path: "/billing" },
  { icon: Brain, label: "Symptom Checker", path: "/symptom-checker" },
  { icon: Video, label: "Consultation", path: "/consultation" },
  { icon: FileText, label: "Health Records", path: "/healthRecords" },
  { icon: Pill, label: "Pharmacy", path: "/pharmacy" },
  { icon: BookOpen, label: "Knowledge Base", path: "/knowledge" },
];

const doctorNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/doctor-dashboard" },
  { icon: Users, label: "Patient Queue", path: "/patient-queue" },
  { icon: Video, label: "Consultation", path: "/consultation" },
  { icon: BarChart3, label: "Analytics", path: "/analytics" },
  { icon: Activity, label: "Live Monitoring", path: "/live-monitoring" },
  { icon: FileText, label: "Patient Records", path: "/patient-records" },
  { icon: Pill, label: "Prescriptions", path: "/prescriptions" },
  { icon: MessageSquare, label: "Messages", path: "/messages" },
  { icon: BookOpen, label: "Knowledge Base", path: "/knowledge" },
];

export function Sidebar({ userRole, userName, userAvatar, onLogout, className }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  const navItems = userRole === "patient" ? patientNavItems : doctorNavItems;

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
        collapsed ? "w-[72px]" : "w-64",
        className
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl medical-gradient">
              <Stethoscope className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-sidebar-foreground">MediConnect</span>
          </div>
        )}
        {collapsed && (
          <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl medical-gradient">
            <Stethoscope className="h-5 w-5 text-white" />
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 rounded-lg text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground",
            collapsed && "absolute -right-3 top-6 bg-card shadow-md border"
          )}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Role Badge */}
      {!collapsed && (
        <div className="px-4 py-3">
          <Badge
            variant="secondary"
            className={cn(
              "w-full justify-center py-1.5 text-xs font-medium",
              userRole === "doctor"
                ? "bg-primary/10 text-primary border-primary/20"
                : "bg-accent/10 text-accent border-accent/20"
            )}
          >
            <Shield className="mr-1.5 h-3 w-3" />
            {userRole === "doctor" ? "Provider Portal" : "Patient Portal"}
          </Badge>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 scrollbar-thin">
        <ul className="space-y-1">
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
                  <item.icon className={cn("h-5 w-5 flex-shrink-0", isActive && "text-primary")} />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <Separator className="bg-sidebar-border" />

      {/* Settings & User */}
      <div className="p-3">
        <NavLink
          to={userRole === 'doctor' ? "/doctor/settings" : "/settings"}
          className={cn(
            "nav-item",
            location.pathname === "/settings" ? "nav-item-active" : "nav-item-inactive",
            collapsed && "justify-center px-2"
          )}
        >
          <Settings className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span>Settings</span>}
        </NavLink>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* User Profile */}
      <div className={cn("p-3", collapsed && "px-2")}>
        <div
          className={cn(
            "flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-sidebar-accent",
            collapsed && "justify-center"
          )}
        >
          <Avatar className="h-9 w-9 border-2 border-primary/20">
            {/* 🟢 1. Try to load the S3 Photo URL */}
            <AvatarImage src={userAvatar} alt={userName} className="object-cover" />

            {/* 🟢 2. If no photo, use initials (but ensure we don't print a URL string) */}
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
              {userAvatar && !userAvatar.includes('http') ? userAvatar : userName.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          {!collapsed && (
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {userName}
              </p>
              <p className="truncate text-xs text-sidebar-foreground/60">
                {userRole === "doctor" ? "Provider" : "Patient"}
              </p>
            </div>
          )}
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-sidebar-foreground/60 hover:bg-destructive/10 hover:text-destructive"
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