import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Menu, X, HeartPulse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from 'aws-amplify/auth';
import { getUser } from "@/lib/secure-storage";
import { cn } from "@/lib/utils";

export function PublicHeader() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleGetStarted = async () => {
    try {
      await getCurrentUser();
      const profile = getUser();
      if (profile && ['doctor', 'provider'].includes((profile.role || '').toLowerCase())) {
        navigate('/doctor-dashboard');
      } else if (profile && ['admin'].includes((profile.role || '').toLowerCase())) {
        navigate('/admin/dashboard');
      } else if (profile && ['staff'].includes((profile.role || '').toLowerCase())) {
        navigate('/staff/dashboard');
      } else {
        navigate('/patient-dashboard');
      }
    } catch {
      navigate('/auth');
    }
  };

  const navLinks = [
    { label: "Features", href: "/#features" },
    { label: "How It Works", href: "/#how-it-works" },
    { label: "Knowledge Base", action: () => navigate("/knowledge") },
  ];

  return (
    <>
      <nav className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300 safe-top",
        scrolled
          ? "bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-soft"
          : "bg-background/50 backdrop-blur-md"
      )}>
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div
            className="flex items-center gap-2.5 cursor-pointer group"
            onClick={() => navigate("/")}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background transition-transform duration-200 group-hover:scale-105">
              <HeartPulse className="h-4 w-4" />
            </div>
            <span className="font-display text-lg font-bold text-foreground">MediConnect</span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              link.action ? (
                <button
                  key={link.label}
                  onClick={link.action}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
                >
                  {link.label}
                </button>
              ) : (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
                >
                  {link.label}
                </a>
              )
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/admin-auth")}
              className="hidden md:inline-flex text-muted-foreground hover:text-foreground text-sm"
            >
              Staff Portal
            </Button>
            <Button
              onClick={handleGetStarted}
              size="sm"
              className="bg-foreground text-background hover:bg-foreground/90 rounded-lg text-sm font-medium transition-all duration-200"
            >
              Get Started
            </Button>

            {/* Mobile menu toggle */}
            <button
              className="md:hidden p-2 text-muted-foreground hover:text-foreground"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="fixed top-16 left-0 right-0 bg-background border-b border-border shadow-elevated p-6 space-y-4 animate-fade-in z-50">
            {navLinks.map((link) => (
              <div key={link.label}>
                {link.action ? (
                  <button
                    onClick={() => { link.action(); setMobileOpen(false); }}
                    className="block w-full text-left text-base font-medium text-foreground py-2"
                  >
                    {link.label}
                  </button>
                ) : (
                  <a
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="block text-base font-medium text-foreground py-2"
                  >
                    {link.label}
                  </a>
                )}
              </div>
            ))}
            <div className="pt-2 border-t border-border">
              <button
                onClick={() => { navigate("/admin-auth"); setMobileOpen(false); }}
                className="block w-full text-left text-sm text-muted-foreground py-2"
              >
                Staff & Admin Portal
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
