import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  userRole: "patient" | "doctor";
  userName: string;
  userAvatar: string;
  onLogout: () => void;
}

export function DashboardLayout({
  children,
  title,
  subtitle,
  userRole,
  userName,
  userAvatar,
  onLogout,
}: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        userRole={userRole}
        userName={userName}
        userAvatar={userAvatar}
        onLogout={onLogout}
      />
      <div className="pl-64 transition-all duration-300">
        <Header title={title} subtitle={subtitle} />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
