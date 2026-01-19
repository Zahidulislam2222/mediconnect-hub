import { ReactNode, useState } from "react";
import { Menu, X, Stethoscope } from "lucide-react";
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* 1. MOBILE HEADER (md:hidden) */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b z-40 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg medical-gradient">
            <Stethoscope className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold">MediConnect</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(true)}>
          <Menu className="h-6 w-6 text-slate-700" />
        </button>
      </div>

      {/* 2. DESKTOP SIDEBAR (Hidden on mobile) */}
      <Sidebar
        className="hidden md:flex"
        userRole={userRole}
        userName={userName}
        userAvatar={userAvatar}
        onLogout={onLogout}
      />

      {/* 3. MOBILE SIDEBAR OVERLAY/DRAWER */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          {/* Drawer */}
          <div className="relative z-50 animate-in slide-in-from-left duration-300">
            <Sidebar
              className="flex w-64 shadow-2xl h-screen"
              userRole={userRole}
              userName={userName}
              userAvatar={userAvatar}
              onLogout={() => {
                onLogout();
                setIsMobileMenuOpen(false);
              }}
            />
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute top-4 right-[-3rem] p-2 bg-white rounded-full shadow-md text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      <div className="md:pl-64 pt-16 md:pt-0 transition-all duration-300">
        <Header title={title} subtitle={subtitle} />
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}