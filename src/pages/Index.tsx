import { useNavigate } from "react-router-dom";
import { useRef, useEffect, useState } from "react";
import {
  Video,
  Shield,
  Brain,
  Calendar,
  FileText,
  ArrowRight,
  Clock,
  Activity,
  Lock,
  Globe,
  ChevronRight,
  CheckCircle2,
  HeartPulse,
  Sparkles,
  BarChart3,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicHeader } from "@/components/PublicHeader";
import {
  motion,
  useScroll,
  useTransform,
  useInView,
  useMotionValue,
  useSpring,
  animate,
} from "framer-motion";

// ─── Animated Counter: visibly ticks from 0 to target ───
function CountUp({ target, suffix = "", prefix = "", duration = 2, displayTarget }: { target: number; suffix?: string; prefix?: string; duration?: number; displayTarget: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const [done, setDone] = useState(false);
  const count = useMotionValue(0);
  const rounded = useSpring(count, { stiffness: 60, damping: 18 });
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    if (isInView) {
      const controls = animate(count, target, {
        duration,
        onComplete: () => setDone(true),
      });
      return controls.stop;
    }
  }, [isInView, target, duration, count]);

  useEffect(() => {
    const unsubscribe = rounded.on("change", (v) => {
      if (done) {
        setDisplay(displayTarget);
      } else {
        setDisplay(Math.round(v).toLocaleString());
      }
    });
    return unsubscribe;
  }, [rounded, done, displayTarget]);

  return (
    <span ref={ref} className="font-display text-3xl sm:text-4xl font-bold text-foreground tabular-nums">
      {prefix}{done ? displayTarget : display}{suffix}
    </span>
  );
}

// ─── SVG Heartbeat Line Draw ───
function HeartbeatLine() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end center"],
  });
  const pathLength = useSpring(useTransform(scrollYProgress, [0, 1], [0, 1]), {
    stiffness: 100,
    damping: 30,
  });

  return (
    <div ref={ref} className="w-full overflow-hidden py-8">
      <svg viewBox="0 0 1200 120" className="w-full h-16 md:h-20" fill="none" preserveAspectRatio="none">
        <motion.path
          d="M0,60 L200,60 L230,60 L250,20 L270,100 L290,10 L310,90 L330,40 L350,60 L400,60 L600,60 L630,60 L650,25 L670,95 L690,15 L710,85 L730,45 L750,60 L800,60 L1000,60 L1030,60 L1050,20 L1070,100 L1090,10 L1110,90 L1130,40 L1150,60 L1200,60"
          stroke="hsl(221 83% 53%)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ pathLength }}
        />
        <motion.path
          d="M0,60 L200,60 L230,60 L250,20 L270,100 L290,10 L310,90 L330,40 L350,60 L400,60 L600,60 L630,60 L650,25 L670,95 L690,15 L710,85 L730,45 L750,60 L800,60 L1000,60 L1030,60 L1050,20 L1070,100 L1090,10 L1110,90 L1130,40 L1150,60 L1200,60"
          stroke="hsl(221 83% 53% / 0.15)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

// ─── Platform Mockup that assembles on scroll ───
function PlatformMockup() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  const cardVariants = {
    hidden: { opacity: 0, y: 40, scale: 0.95 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        delay: 0.3 + i * 0.15,
        duration: 0.7,
        ease: [0.16, 1, 0.3, 1],
      },
    }),
  };

  return (
    <div ref={ref} className="relative mx-auto max-w-4xl mt-16 md:mt-20">
      {/* Browser chrome */}
      <motion.div
        initial={{ opacity: 0, y: 60, scale: 0.92 }}
        animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-xl border border-border bg-card shadow-elevated overflow-hidden"
      >
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-secondary/50">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-destructive/60" />
            <div className="w-3 h-3 rounded-full bg-warning/60" />
            <div className="w-3 h-3 rounded-full bg-success/60" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="bg-background rounded-md px-16 py-1 text-xs text-muted-foreground border border-border">
              app.mediconnect.health
            </div>
          </div>
        </div>

        {/* Dashboard content */}
        <div className="p-4 md:p-6 bg-background min-h-[280px] md:min-h-[360px]">
          <div className="flex gap-4 md:gap-6">
            {/* Sidebar mockup */}
            <motion.div
              custom={0}
              variants={cardVariants}
              initial="hidden"
              animate={isInView ? "visible" : "hidden"}
              className="hidden md:block w-48 space-y-2 flex-shrink-0"
            >
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-accent/10">
                <div className="w-4 h-4 rounded bg-accent/30" />
                <div className="h-3 w-20 rounded bg-accent/20" />
              </div>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg">
                  <div className="w-4 h-4 rounded bg-muted" />
                  <div className="h-3 rounded bg-muted" style={{ width: `${50 + i * 8}px` }} />
                </div>
              ))}
            </motion.div>

            {/* Main content */}
            <div className="flex-1 space-y-4">
              {/* Header */}
              <motion.div
                custom={1}
                variants={cardVariants}
                initial="hidden"
                animate={isInView ? "visible" : "hidden"}
                className="flex items-center justify-between"
              >
                <div>
                  <div className="h-5 w-40 rounded bg-foreground/10 mb-1.5" />
                  <div className="h-3 w-56 rounded bg-muted" />
                </div>
                <div className="h-8 w-8 rounded-full bg-accent/15" />
              </motion.div>

              {/* Vitals row */}
              <motion.div
                custom={2}
                variants={cardVariants}
                initial="hidden"
                animate={isInView ? "visible" : "hidden"}
                className="grid grid-cols-2 md:grid-cols-4 gap-3"
              >
                {[
                  { label: "Heart Rate", value: "72", unit: "bpm", color: "bg-destructive/10 text-destructive" },
                  { label: "Blood Pressure", value: "120/80", unit: "mmHg", color: "bg-accent/10 text-accent" },
                  { label: "SpO2", value: "98", unit: "%", color: "bg-success/10 text-success" },
                  { label: "Temperature", value: "98.6", unit: "°F", color: "bg-warning/10 text-warning" },
                ].map((vital, i) => (
                  <div key={i} className="rounded-lg border border-border p-3 bg-card">
                    <p className="text-[10px] text-muted-foreground mb-1">{vital.label}</p>
                    <p className="font-display text-lg font-bold text-foreground">{vital.value}
                      <span className="text-xs font-normal text-muted-foreground ml-1">{vital.unit}</span>
                    </p>
                    <div className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium mt-1 ${vital.color}`}>
                      Normal
                    </div>
                  </div>
                ))}
              </motion.div>

              {/* Appointments */}
              <motion.div
                custom={3}
                variants={cardVariants}
                initial="hidden"
                animate={isInView ? "visible" : "hidden"}
                className="rounded-lg border border-border p-4 bg-card"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="h-4 w-36 rounded bg-foreground/10" />
                  <div className="h-3 w-20 rounded bg-accent/20" />
                </div>
                {[1, 2].map((i) => (
                  <div key={i} className="flex items-center justify-between py-2.5 border-t border-border first:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-muted" />
                      <div>
                        <div className="h-3.5 w-28 rounded bg-foreground/8 mb-1" />
                        <div className="h-2.5 w-36 rounded bg-muted" />
                      </div>
                    </div>
                    <div className="h-7 w-16 rounded-md bg-accent/15" />
                  </div>
                ))}
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Floating glow behind mockup */}
      <div className="absolute -inset-8 -z-10 bg-accent/5 rounded-3xl blur-3xl" />
    </div>
  );
}

// ─── Horizontal Scroll Features ───
function HorizontalFeatures() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });
  const x = useTransform(scrollYProgress, [0, 1], ["10%", "-30%"]);

  const features = [
    { icon: Video, title: "HD Video Consultations", description: "Crystal-clear calls powered by AWS Chime SDK with end-to-end encryption", color: "bg-blue-500/10 text-blue-600" },
    { icon: Brain, title: "AI Symptom Checker", description: "Instant health insights using Bedrock & Vertex AI multi-model diagnostics", color: "bg-violet-500/10 text-violet-600" },
    { icon: Shield, title: "HIPAA & GDPR Compliant", description: "AES-256 encryption, immutable audit logs, and regional data sovereignty", color: "bg-emerald-500/10 text-emerald-600" },
    { icon: Calendar, title: "Smart Scheduling", description: "Real-time availability, instant booking, and automated reminders", color: "bg-amber-500/10 text-amber-600" },
    { icon: FileText, title: "Digital Health Records", description: "FHIR R4 compliant records accessible anytime with PHI encryption", color: "bg-sky-500/10 text-sky-600" },
    { icon: Clock, title: "24/7 Care Access", description: "Round-the-clock medical advice from certified healthcare providers", color: "bg-rose-500/10 text-rose-600" },
  ];

  return (
    <div ref={containerRef} className="overflow-hidden py-8">
      <motion.div style={{ x }} className="flex gap-5 w-max px-6">
        {features.map((feature, idx) => (
          <div
            key={idx}
            className="w-[320px] md:w-[360px] flex-shrink-0 rounded-xl bg-card border border-border p-6 shadow-soft hover:shadow-card transition-all duration-200 hover:-translate-y-1 group"
          >
            <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${feature.color} mb-4 transition-transform duration-200 group-hover:scale-110`}>
              <feature.icon className="h-5 w-5" />
            </div>
            <h3 className="font-display text-base font-semibold text-foreground mb-2">{feature.title}</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

// ─── Text Reveal on Scroll ───
function ScrollRevealText({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.9", "start 0.3"],
  });

  const words = text.split(" ");

  return (
    <p ref={ref} className="text-2xl md:text-4xl font-display font-bold leading-snug">
      {words.map((word, i) => {
        const start = i / words.length;
        const end = start + 1 / words.length;
        return <ScrollWord key={i} word={word} range={[start, end]} progress={scrollYProgress} />;
      })}
    </p>
  );
}

function ScrollWord({ word, range, progress }: { word: string; range: [number, number]; progress: any }) {
  const opacity = useTransform(progress, range, [0.15, 1]);
  const y = useTransform(progress, range, [4, 0]);
  return (
    <motion.span style={{ opacity, y }} className="inline-block mr-[0.3em] transition-colors">
      {word}
    </motion.span>
  );
}

// ─── Step Card (extracted to avoid hooks-in-map) ───
function StepCard({ item, idx, total }: { item: { num: string; title: string; description: string }; idx: number; total: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: idx * 0.15, ease: [0.16, 1, 0.3, 1] }}
      className="relative group"
    >
      {idx < total - 1 && (
        <div className="hidden md:block absolute top-12 left-[60%] w-[80%] h-px border-t-2 border-dashed border-border" />
      )}
      <div className="relative bg-card rounded-xl p-8 border border-border shadow-soft hover:shadow-card transition-all duration-200 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-foreground text-background text-lg font-display font-bold mx-auto mb-5 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
          {item.num}
        </div>
        <h3 className="font-display text-lg font-semibold text-foreground mb-3">{item.title}</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">{item.description}</p>
      </div>
    </motion.div>
  );
}

// ─── Trust Card (extracted to avoid hooks-in-map) ───
function TrustCard({ icon: Icon, label, sub, idx }: { icon: any; label: string; sub: string; idx: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
      animate={isInView ? { opacity: 1, scale: 1, rotate: 0 } : {}}
      transition={{ duration: 0.5, delay: idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
      className="bg-card border border-border rounded-xl p-6 text-center shadow-soft hover:shadow-card transition-all duration-200"
    >
      <Icon className="h-8 w-8 text-accent mx-auto mb-3" />
      <p className="font-display font-semibold text-foreground text-sm">{label}</p>
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════
export default function Index() {
  const navigate = useNavigate();

  // Hero parallax
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: heroScroll } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroTextY = useTransform(heroScroll, [0, 1], [0, 150]);
  const heroOpacity = useTransform(heroScroll, [0, 0.5], [1, 0]);
  const mockupY = useTransform(heroScroll, [0, 1], [0, 80]);

  const stats = [
    { value: 50000, suffix: "+", prefix: "", label: "Patients Served", displayTarget: "50K" },
    { value: 500, suffix: "+", prefix: "", label: "Verified Doctors", displayTarget: "500" },
    { value: 49, suffix: "", prefix: "", label: "App Rating", displayTarget: "4.9" },
    { value: 5, suffix: "", prefix: "< ", label: "Avg Wait Time", displayTarget: "5 min" },
  ];

  const steps = [
    { num: "01", title: "Create Account", description: "Multi-factor auth with biometric identity verification", icon: Lock },
    { num: "02", title: "Book Appointment", description: "Browse verified doctors and schedule in seconds", icon: Calendar },
    { num: "03", title: "Start Consultation", description: "Encrypted HD video with personalized care plans", icon: Video },
  ];

  const trustPoints = [
    "HIPAA compliant infrastructure",
    "GDPR data sovereignty",
    "AES-256 encryption at rest",
    "FHIR R4 interoperability",
    "SOC 2 audit trail",
    "Multi-region deployment",
  ];

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <PublicHeader />

      {/* ═══ HERO ═══ */}
      <section ref={heroRef} className="relative pt-28 pb-8 md:pt-36 md:pb-12 px-6">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-accent/[0.04] via-background to-background" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-accent/[0.06] rounded-full blur-[120px] -translate-y-1/2" />

        <motion.div
          style={{ y: heroTextY, opacity: heroOpacity }}
          className="container mx-auto max-w-4xl relative z-10"
        >
          <div className="text-center">
            {/* Trust badge */}
            <motion.div
              initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-muted-foreground mb-8 shadow-soft"
            >
              <span className="flex h-2 w-2 rounded-full bg-success animate-pulse" />
              Trusted by 50,000+ patients across US & EU
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.8, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="font-display text-5xl sm:text-6xl md:text-8xl font-bold text-foreground mb-6 leading-[1.05] tracking-tight"
            >
              Healthcare that
              <br />
              <span className="text-gradient">works for you</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.8, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
            >
              Connect with certified doctors through encrypted video consultations,
              AI-powered diagnostics, and comprehensive health management.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Button
                size="lg"
                onClick={() => navigate("/auth")}
                className="bg-accent text-accent-foreground hover:bg-accent/90 text-base px-8 h-13 rounded-xl transition-all duration-200 group shadow-md hover:shadow-lg"
              >
                Start Your Visit
                <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate("/auth")}
                className="text-base px-8 h-13 rounded-xl border-border hover:bg-secondary transition-all duration-200"
              >
                I'm a Doctor
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </motion.div>

            {/* Compliance badges */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.9 }}
              className="flex items-center justify-center gap-6 mt-10 text-xs text-muted-foreground/50"
            >
              <div className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> HIPAA</div>
              <div className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> GDPR</div>
              <div className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> AES-256</div>
              <div className="flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" /> FHIR R4</div>
            </motion.div>
          </div>
        </motion.div>

        {/* Platform Mockup — assembles on scroll */}
        <motion.div style={{ y: mockupY }}>
          <PlatformMockup />
        </motion.div>
      </section>

      {/* ═══ HEARTBEAT DIVIDER ═══ */}
      <HeartbeatLine />

      {/* ═══ STATS — Real Counting Numbers ═══ */}
      <section className="py-16 md:py-24 px-6">
        <div className="container mx-auto max-w-5xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {stats.map((stat, idx) => (
              <div key={idx} className="text-center p-6 rounded-xl bg-card border border-border shadow-soft">
                <div className="mb-2">
                  <CountUp target={stat.value} suffix={stat.suffix} prefix={stat.prefix} duration={2.5} displayTarget={stat.displayTarget} />
                </div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FEATURES — Horizontal Scroll ═══ */}
      <section id="features" className="py-16 md:py-24">
        <div className="container mx-auto max-w-6xl px-6 mb-8">
          <p className="text-sm font-medium text-accent uppercase tracking-wider mb-3">Platform Features</p>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-foreground mb-4">
            Everything for better health
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl">
            A comprehensive telehealth platform built with enterprise security and patient experience in mind.
          </p>
        </div>
        <HorizontalFeatures />
      </section>

      {/* ═══ HOW IT WORKS — with text reveal ═══ */}
      <section id="how-it-works" className="py-20 md:py-28 px-6">
        <div className="container mx-auto max-w-5xl">
          {/* Scroll reveal heading */}
          <div className="mb-16 max-w-2xl">
            <p className="text-sm font-medium text-accent uppercase tracking-wider mb-6">Getting Started</p>
            <ScrollRevealText text="Get world-class healthcare in three simple steps from anywhere in the world" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {steps.map((item, idx) => (
              <StepCard key={idx} item={item} idx={idx} total={steps.length} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══ TRUST / COMPLIANCE ═══ */}
      <section className="py-20 md:py-28 px-6 bg-secondary/40">
        <div className="container mx-auto max-w-5xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-sm font-medium text-accent uppercase tracking-wider mb-3">Security & Compliance</p>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-6">
                Built for healthcare-grade security
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-8">
                Every layer of MediConnect is designed to meet the strictest healthcare regulations.
                Your data is encrypted, sovereign, and auditable — across US and EU regions.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {trustPoints.map((point, idx) => (
                  <div key={idx} className="flex items-center gap-2.5 text-sm text-foreground">
                    <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                    {point}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Shield, label: "HIPAA", sub: "Compliant" },
                { icon: Globe, label: "GDPR", sub: "Data Sovereignty" },
                { icon: Lock, label: "AES-256", sub: "Encryption" },
                { icon: Activity, label: "FHIR R4", sub: "Interoperable" },
              ].map((item, idx) => (
                <TrustCard key={idx} icon={item.icon} label={item.label} sub={item.sub} idx={idx} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="py-20 md:py-28 px-6">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-2xl bg-foreground text-background p-12 md:p-16 text-center relative overflow-hidden"
          >
            {/* Subtle accent glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-accent/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/4" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/10 rounded-full blur-[80px] translate-y-1/3 -translate-x-1/4" />

            <div className="relative z-10">
              <h2 className="font-display text-3xl md:text-5xl font-bold mb-5 leading-tight">
                Ready to transform your
                <br className="hidden md:block" />
                healthcare experience?
              </h2>
              <p className="text-lg text-background/60 mb-10 max-w-xl mx-auto leading-relaxed">
                Join thousands of patients who have discovered a better way to access quality healthcare.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button
                  size="lg"
                  onClick={() => navigate("/auth")}
                  className="bg-accent text-accent-foreground hover:bg-accent/90 text-base px-8 h-13 rounded-xl transition-all duration-200 font-semibold group shadow-lg"
                >
                  Get Started Free
                  <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  onClick={() => navigate("/admin-auth")}
                  className="text-background/60 hover:text-background hover:bg-background/10 text-base px-8 h-13 rounded-xl transition-all duration-200"
                >
                  Staff & Admin Portal
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-border py-14 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate("/")}>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background">
                <HeartPulse className="h-4 w-4" />
              </div>
              <span className="font-display text-lg font-bold text-foreground">MediConnect</span>
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
