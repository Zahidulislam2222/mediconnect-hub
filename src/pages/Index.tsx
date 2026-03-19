import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import {
  Stethoscope,
  Video,
  Shield,
  Brain,
  Calendar,
  FileText,
  ArrowRight,
  Star,
  Clock,
  Heart,
  Activity,
  ChevronRight,
  Lock,
  Zap,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicHeader } from "@/components/PublicHeader";

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setIsVisible(true); obs.disconnect(); } }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, isVisible };
}

export default function Index() {
  const navigate = useNavigate();

  const features = [
    { icon: Video, title: "HD Video Consultations", description: "Crystal-clear calls powered by AWS Chime SDK with end-to-end encryption", color: "from-teal-500/10 to-emerald-500/10", iconColor: "text-teal-600" },
    { icon: Brain, title: "AI Symptom Checker", description: "Instant health insights using Bedrock & Vertex AI multi-model diagnostics", color: "from-violet-500/10 to-purple-500/10", iconColor: "text-violet-600" },
    { icon: Shield, title: "HIPAA & GDPR Compliant", description: "AES-256 encryption, immutable audit logs, and regional data sovereignty", color: "from-rose-500/10 to-pink-500/10", iconColor: "text-rose-600" },
    { icon: Calendar, title: "Smart Scheduling", description: "Real-time availability, instant booking, and automated reminders", color: "from-amber-500/10 to-orange-500/10", iconColor: "text-amber-600" },
    { icon: FileText, title: "Digital Health Records", description: "FHIR R4 compliant records accessible anytime with PHI encryption", color: "from-blue-500/10 to-cyan-500/10", iconColor: "text-blue-600" },
    { icon: Clock, title: "24/7 Care Access", description: "Round-the-clock medical advice from certified healthcare providers", color: "from-emerald-500/10 to-green-500/10", iconColor: "text-emerald-600" },
  ];

  const stats = [
    { value: "50K+", label: "Patients Served", icon: Heart },
    { value: "500+", label: "Verified Doctors", icon: Stethoscope },
    { value: "4.9", label: "App Rating", icon: Star },
    { value: "<5m", label: "Avg Wait Time", icon: Zap },
  ];

  const steps = [
    { num: "01", title: "Create Account", description: "Sign up with multi-factor authentication and biometric identity verification", icon: Lock },
    { num: "02", title: "Book Appointment", description: "Browse verified doctors, check availability, and schedule in seconds", icon: Calendar },
    { num: "03", title: "Start Consultation", description: "Connect via encrypted HD video and receive personalized care plans", icon: Video },
  ];

  const heroSection = useInView(0.1);
  const statsSection = useInView();
  const featuresSection = useInView();
  const stepsSection = useInView();
  const ctaSection = useInView();

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <PublicHeader />

      {/* === HERO === */}
      <section ref={heroSection.ref} className="relative pt-28 pb-20 md:pt-36 md:pb-28 px-6">
        {/* Background gradient mesh */}
        <div className="absolute inset-0 hero-glow" />
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-1/4 w-72 h-72 bg-accent/5 rounded-full blur-3xl" />

        <div className="container mx-auto max-w-6xl relative z-10">
          <div className={`text-center transition-all duration-1000 ${heroSection.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            {/* Trust badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/60 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              Trusted by 50,000+ patients across US & EU
            </div>

            <h1 className="font-display text-4xl sm:text-5xl md:text-7xl font-bold text-foreground mb-6 leading-[1.1] tracking-tight">
              Healthcare Made
              <br />
              <span className="text-gradient">Simple & Secure</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              Connect with certified doctors through encrypted video consultations,
              AI-powered diagnostics, and comprehensive health management — all in one platform.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                onClick={() => navigate("/auth")}
                className="medical-gradient text-white border-0 text-base px-8 h-14 rounded-xl shadow-glow hover:shadow-elevated hover:-translate-y-0.5 transition-all duration-300 group"
              >
                Start Your Visit
                <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate("/auth")}
                className="text-base px-8 h-14 rounded-xl border-border hover:bg-secondary transition-all duration-300"
              >
                I'm a Doctor
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>

            {/* Compliance badges */}
            <div className="flex items-center justify-center gap-6 mt-12 text-xs text-muted-foreground/60">
              <div className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" /> HIPAA
              </div>
              <div className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5" /> GDPR
              </div>
              <div className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" /> AES-256
              </div>
              <div className="flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5" /> FHIR R4
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* === STATS === */}
      <section ref={statsSection.ref} className="py-6 px-6">
        <div className="container mx-auto max-w-5xl">
          <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 transition-all duration-700 ${statsSection.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            {stats.map((stat, idx) => (
              <div
                key={idx}
                className="relative group text-center p-6 rounded-2xl bg-card border border-border shadow-soft hover:shadow-card transition-all duration-300 hover:-translate-y-0.5"
                style={{ animationDelay: `${idx * 0.1}s` }}
              >
                <stat.icon className="h-5 w-5 text-primary/50 mx-auto mb-3" />
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <span className="font-display text-3xl md:text-4xl font-bold text-foreground">{stat.value}</span>
                  {stat.label === "App Rating" && <Star className="h-5 w-5 text-warning fill-warning" />}
                </div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* === FEATURES === */}
      <section ref={featuresSection.ref} id="features" className="py-20 md:py-28 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className={`text-center mb-16 transition-all duration-700 ${featuresSection.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-4 py-1.5 text-xs font-medium text-muted-foreground mb-4 uppercase tracking-wider">
              Platform Features
            </div>
            <h2 className="font-display text-3xl md:text-5xl font-bold text-foreground mb-4">
              Everything for Better Health
            </h2>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              A comprehensive telehealth platform built with enterprise security and patient experience in mind.
            </p>
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 transition-all duration-700 delay-200 ${featuresSection.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            {features.map((feature, idx) => (
              <div
                key={idx}
                className="feature-card group"
                style={{ animationDelay: `${idx * 0.08}s` }}
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${feature.color} mb-5 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3`}>
                  <feature.icon className={`h-6 w-6 ${feature.iconColor}`} />
                </div>
                <h3 className="font-display text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* === HOW IT WORKS === */}
      <section ref={stepsSection.ref} id="how-it-works" className="py-20 md:py-28 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-secondary/30 via-secondary/50 to-secondary/30" />
        <div className="container mx-auto max-w-5xl relative z-10">
          <div className={`text-center mb-16 transition-all duration-700 ${stepsSection.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground mb-4 uppercase tracking-wider">
              Getting Started
            </div>
            <h2 className="font-display text-3xl md:text-5xl font-bold text-foreground mb-4">
              Care in 3 Simple Steps
            </h2>
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 transition-all duration-700 delay-200 ${stepsSection.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            {steps.map((item, idx) => (
              <div key={idx} className="relative group">
                {/* Connecting line between steps (desktop) */}
                {idx < steps.length - 1 && (
                  <div className="hidden md:block absolute top-12 left-[60%] w-[80%] h-px border-t-2 border-dashed border-primary/20" />
                )}
                <div className="relative bg-card rounded-2xl p-8 border border-border shadow-soft hover:shadow-card transition-all duration-300 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl medical-gradient text-white text-lg font-display font-bold mx-auto mb-5 shadow-glow group-hover:scale-110 transition-transform duration-300">
                    {item.num}
                  </div>
                  <h3 className="font-display text-xl font-semibold text-foreground mb-3">{item.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* === CTA === */}
      <section ref={ctaSection.ref} className="py-20 md:py-28 px-6">
        <div className="container mx-auto max-w-4xl">
          <div className={`relative rounded-3xl overflow-hidden transition-all duration-700 ${ctaSection.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            {/* Background */}
            <div className="absolute inset-0 medical-gradient" />
            <div className="absolute inset-0 grain" />
            <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
            <div className="absolute bottom-0 left-0 w-60 h-60 bg-white/5 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />

            <div className="relative z-10 py-16 md:py-20 px-8 md:px-16 text-center">
              <h2 className="font-display text-3xl md:text-5xl font-bold text-white mb-5 leading-tight">
                Ready to Transform Your
                <br className="hidden md:block" />
                Healthcare Experience?
              </h2>
              <p className="text-lg text-white/75 mb-10 max-w-xl mx-auto leading-relaxed">
                Join thousands of patients who have discovered a better way to access quality healthcare — secure, instant, and personal.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button
                  size="lg"
                  onClick={() => navigate("/auth")}
                  className="bg-white text-primary hover:bg-white/90 text-base px-8 h-14 rounded-xl shadow-elevated hover:-translate-y-0.5 transition-all duration-300 font-semibold group"
                >
                  Get Started Free
                  <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  onClick={() => navigate("/admin-auth")}
                  className="text-white/80 hover:text-white hover:bg-white/10 text-base px-8 h-14 rounded-xl transition-all duration-300"
                >
                  Staff & Admin Portal
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* === FOOTER === */}
      <footer className="border-t border-border py-14 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl medical-gradient shadow-glow">
                <Stethoscope className="h-5 w-5 text-white" />
              </div>
              <span className="font-display text-xl font-bold text-foreground">MediConnect</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
              <button onClick={() => navigate("/privacy-policy")} className="hover:text-foreground transition-colors">Privacy</button>
              <button onClick={() => navigate("/terms-of-service")} className="hover:text-foreground transition-colors">Terms</button>
              <button onClick={() => navigate("/hipaa-compliance")} className="hover:text-foreground transition-colors">HIPAA</button>
              <button onClick={() => navigate("/contact")} className="hover:text-foreground transition-colors">Contact</button>
              <button onClick={() => navigate("/admin-auth")} className="hover:text-foreground transition-colors">Staff Portal</button>
            </div>
          </div>
          <div className="mt-10 pt-8 border-t border-border text-center text-sm text-muted-foreground/60">
            &copy; 2026 MediConnect. All rights reserved. Multi-region deployment on AWS, Azure & GCP.
          </div>
        </div>
      </footer>
    </div>
  );
}
