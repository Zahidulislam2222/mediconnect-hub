import { ReactNode, useState } from "react";
import { Menu, X, Stethoscope } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  userRole: "patient" | "doctor" | "admin" | "staff";
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
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-background/80 backdrop-blur-xl border-b border-border z-40 flex items-center justify-between px-4 safe-top">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg medical-gradient shadow-sm">
            <Stethoscope className="h-4 w-4 text-white" />
          </div>
          <span className="font-display text-base font-bold">MediConnect</span>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-secondary transition-colors"
        >
          <Menu className="h-5 w-5 text-foreground/70" />
        </button>
      </div>

      {/* Desktop Sidebar */}
      <Sidebar
        className="hidden md:flex"
        userRole={userRole}
        userName={userName}
        userAvatar={userAvatar}
        onLogout={onLogout}
      />

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="fixed inset-0 bg-foreground/20 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative z-50 animate-in slide-in-from-left duration-300">
            <Sidebar
              className="flex w-72 shadow-elevated h-screen"
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
              className="absolute top-4 right-[-2.75rem] p-2 bg-card rounded-xl shadow-card text-foreground/60 hover:text-foreground border border-border"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="md:pl-64 pt-14 md:pt-0 transition-all duration-300">
        <Header title={title} subtitle={subtitle} />
        <main className="p-4 md:p-6 safe-bottom">{children}</main>
      </div>
    </div>
  );
}
