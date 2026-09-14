import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  MoveUpRight,
  Pause,
  Play,
  Video,
} from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { continuity as c } from "@/content/continuity";
import { useCare } from "./care-store";

export function Mark() {
  return (
    <svg className="ct-mark" viewBox="0 0 36 36" aria-hidden="true">
      <path d="M12 3h12v9h9v12h-9v9H12v-9H3V12h9z" fill="currentColor" />
      <path d="M13 18h10M18 13v10" stroke="var(--ct-paper)" strokeWidth="2" />
    </svg>
  );
}
export function Brand() {
  return (
    <Link to="/" className="ct-brand" aria-label={c.navigation.home}>
      <Mark />
      {c.brand}
      <span className="ct-brand-dot" />
    </Link>
  );
}
export function Action({
  to,
  children,
  secondary = false,
}: {
  to: string;
  children: React.ReactNode;
  secondary?: boolean;
}) {
  return (
    <Button
      asChild
      className={`ct-action ${secondary ? "ct-action-secondary" : ""}`}
    >
      <Link to={to}>
        {children}
        <ArrowRight aria-hidden="true" size={17} />
      </Link>
    </Button>
  );
}
export function Header({ minimal = false }: { minimal?: boolean }) {
  return (
    <header className="ct-header">
      <Brand />
      <nav aria-label={c.brand}>
        {!minimal && (
          <>
            <Link className="ct-nav-link" to="/#journey">
              {c.navigation.journey}
            </Link>
            <Link className="ct-nav-link" to="/#platform">
              {c.navigation.workspace}
            </Link>
          </>
        )}
        <Link className="ct-login" to="/auth">
          {c.navigation.login}
          <MoveUpRight size={15} aria-hidden="true" />
        </Link>
      </nav>
    </header>
  );
}

export function Portrait({
  film = false,
  className = "",
  priority = false,
  subject = "clinician",
}: {
  film?: boolean;
  className?: string;
  priority?: boolean;
  subject?: "clinician" | "patient";
}) {
  const reduced = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [painted, setPainted] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: c.motion.mediaThreshold },
    );
    if (root.current) observer.observe(root.current);
    const visibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  const shouldLoad = film && !reduced && inView && !hidden && !failed;
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    let frame: number | undefined;
    if (shouldLoad && !paused) {
      void element.play().catch(() => setPaused(true));
      if ("requestVideoFrameCallback" in element)
        frame = element.requestVideoFrameCallback(() => setPainted(true));
    } else {
      element.pause();
      setPainted(false);
    }
    return () => {
      element.pause();
      if (frame !== undefined) element.cancelVideoFrameCallback(frame);
    };
  }, [shouldLoad, paused]);
  return (
    <div className={`ct-portrait ${className}`} ref={root}>
      <div className="ct-portrait-fallback" aria-hidden="true">
        <Mark />
      </div>
      {!imageFailed && (
        <img
          src={
            subject === "patient"
              ? c.media.patientPoster
              : c.media.clinicianPoster
          }
          alt={subject === "patient" ? c.media.patientLabel : c.hero.mediaLabel}
          fetchPriority={priority ? "high" : "auto"}
          loading={priority ? "eager" : "lazy"}
          onError={() => setImageFailed(true)}
        />
      )}
      {shouldLoad && (
        <video
          ref={video}
          className={painted ? "is-painted" : ""}
          src={
            subject === "patient"
              ? c.media.patientVideo
              : c.media.clinicianVideo
          }
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
          onError={() => {
            setFailed(true);
            setPainted(false);
          }}
          onPlaying={() => {
            if (
              video.current &&
              !("requestVideoFrameCallback" in video.current)
            )
              setPainted(true);
          }}
        />
      )}
      {film && !reduced && !failed && (
        <button
          className="ct-film-control"
          aria-label={paused ? c.media.play : c.media.pause}
          onClick={() => setPaused((value) => !value)}
        >
          {paused ? <Play size={14} /> : <Pause size={14} />}
        </button>
      )}
      {imageFailed && <span className="ct-media-failed">{c.media.failed}</span>}
    </div>
  );
}

export function AppointmentAnchor({ compact = false }: { compact?: boolean }) {
  const care = useCare();
  return (
    <div
      className={`ct-appointment-anchor ${compact ? "is-compact" : ""}`}
      data-appointment={c.sample.appointmentId}
    >
      <div className="ct-anchor-icon">
        <CalendarDays size={21} aria-hidden="true" />
      </div>
      <div className="ct-anchor-person">
        <small>
          {c.sample.appointmentId} <span>· {c.sample.patient}</span>
        </small>
        <strong>{c.sample.clinician}</strong>
      </div>
      <div className="ct-anchor-time">
        <strong data-slot>{care.slot}</strong>
        <small>{c.sample.shortDate}</small>
      </div>
      <span
        className={`ct-status-dot ${care.status === "ready" ? "is-ready" : ""}`}
        title={
          care.status === "ready" ? c.sample.ready : c.sample.needsConfirmation
        }
      />
    </div>
  );
}
export function Status() {
  const { status } = useCare();
  return (
    <span className={`ct-status ${status === "ready" ? "is-ready" : ""}`}>
      <span />
      {status === "ready" ? c.sample.ready : c.sample.needsConfirmation}
    </span>
  );
}
export function VisitMeta() {
  return (
    <div className="ct-visit-meta">
      <span>
        <Video size={15} aria-hidden="true" />
        {c.sample.visitType}
      </span>
      <span>{c.sample.duration}</span>
    </div>
  );
}
