import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  FileText,
  LayoutDashboard,
  Mic,
  MicOff,
  RotateCcw,
  Stethoscope,
  Video,
  VideoOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { continuity as c, roleSchema } from "@/content/continuity";
import { useCare } from "@/components/continuity/care-store";
import {
  AppointmentAnchor,
  Brand,
  Portrait,
  Status,
  VisitMeta,
} from "@/components/continuity/Primitives";

export default function ContinuityWorkspace() {
  const params = useParams();
  const parsed = roleSchema.safeParse(params.role);
  const role = parsed.success ? parsed.data : "patient";
  const content = c.workspace.roles.find((item) => item.id === role)!;
  const care = useCare();
  const [feedback, setFeedback] = useState("");
  const [visit, setVisit] = useState(false);
  const [followup, setFollowup] = useState(false);
  const [mic, setMic] = useState(true);
  const [camera, setCamera] = useState(true);
  const consultation = useRef<HTMLElement>(null);
  useEffect(() => {
    if (visit && consultation.current) {
      consultation.current.focus({ preventScroll: true });
      consultation.current.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }, [visit]);
  if (!parsed.success)
    return (
      <main className="ct-not-found">
        <Brand />
        <h1>{c.footer.notFound}</h1>
        <Link to="/">{c.footer.return}</Link>
      </main>
    );
  return (
    <div className="ct-workspace">
      <aside className="ct-sidebar">
        <Brand />
        <span className="ct-demo-tag">{c.workspace.demoLabel}</span>
        <nav aria-label={c.navigation.workspace}>
          {c.workspace.roles.map((item) => (
            <Link
              key={item.id}
              to={`/demo/${item.id}`}
              aria-current={role === item.id ? "page" : undefined}
            >
              <LayoutDashboard size={17} />
              {item.name}
              <ChevronRight size={14} />
            </Link>
          ))}
        </nav>
        <div className="ct-sidebar-bottom">
          <p>{c.notice}</p>
          <Link to="/">
            <ArrowLeft size={16} />
            {c.navigation.home}
          </Link>
        </div>
      </aside>
      <div className="ct-workspace-main">
        <header className="ct-workspace-header">
          <span>
            {content.name} <ChevronRight size={13} />{" "}
            {visit ? c.workspace.visitLabel : c.workspace.appointment}
          </span>
          <div>
            <button
              onClick={() => {
                care.reset();
                setFeedback(c.workspace.resetFeedback);
                setVisit(false);
                setFollowup(false);
                setMic(true);
                setCamera(true);
              }}
            >
              <RotateCcw size={15} />
              {c.workspace.reset}
            </button>
            <Link to="/auth">
              {c.navigation.login}
              <ArrowRight size={15} />
            </Link>
            <span className="ct-avatar">
              {role === "patient"
                ? c.sample.patientInitials
                : role === "staff"
                  ? c.workspace.staffInitials
                  : c.sample.clinicianInitials}
            </span>
          </div>
        </header>
        <main id="main" tabIndex={-1} className="ct-workspace-content">
          <div className="ct-workspace-welcome">
            <div>
              <p className="ct-eyebrow">{c.sample.date}</p>
              <h1>{content.greeting}</h1>
              <p>{content.subtitle}</p>
            </div>
            <span className="ct-demo-disclosure">
              {c.workspace.demoLabel}
              <span>{c.hero.footnote}</span>
            </span>
          </div>
          <p className="ct-feedback" role="status">
            {feedback}
          </p>
          {visit ? (
          <section
            ref={consultation}
            tabIndex={-1}
            className="ct-consultation"
              aria-label={c.workspace.visitLabel}
            >
              <button
                className="ct-back-button"
                onClick={() => {
                  setVisit(false);
                  setMic(true);
                  setCamera(true);
                }}
              >
                <ArrowLeft size={17} />
                {c.workspace.closeVisit}
              </button>
              <div className="ct-consultation-layout">
                <div className="ct-consultation-video">
                  {camera ? (
                    <Portrait
                      film
                      subject={role === "clinician" ? "patient" : "clinician"}
                    />
                  ) : (
                    <div className="ct-camera-off">
                      <VideoOff size={36} />
                      <p>{c.workspace.cameraOff}</p>
                    </div>
                  )}
                  <span className="ct-preview-badge">
                    {c.workspace.previewBadge}
                  </span>
                  <div className="ct-consultation-name">
                    <strong>
                      {role === "clinician"
                        ? c.sample.patient
                        : c.sample.clinician}
                    </strong>
                    <span>
                      {role === "clinician"
                        ? c.workspace.patientInCall
                        : c.sample.specialty}
                    </span>
                  </div>
                  <div className="ct-call-controls">
                    <button
                      aria-label={c.workspace.mic}
                      aria-pressed={!mic}
                      onClick={() => setMic((value) => !value)}
                    >
                      {mic ? <Mic size={20} /> : <MicOff size={20} />}
                    </button>
                    <button
                      aria-label={c.workspace.camera}
                      aria-pressed={!camera}
                      onClick={() => setCamera((value) => !value)}
                    >
                      {camera ? <Video size={20} /> : <VideoOff size={20} />}
                    </button>
                  </div>
                </div>
                <aside className="ct-consultation-notes">
                  <p className="ct-eyebrow">{c.workspace.notes}</p>
                  <h2>{c.sample.patient}</h2>
                  <AppointmentAnchor compact />
                  <p>{c.workspace.notesDescription}</p>
                  <div className="ct-note">
                    <FileText size={19} />
                    <p>{c.sample.patientNote}</p>
                  </div>
                  <p className="ct-offline-notice">{c.workspace.visitNotice}</p>
                </aside>
              </div>
            </section>
          ) : (
            <div className={`ct-dashboard-grid ct-dashboard-${role}`}>
              {role === "clinician" && (
                <section className="ct-dashboard-card ct-queue">
                  <div className="ct-card-heading">
                    <h2>{c.workspace.queueTitle}</h2>
                    <CalendarDays size={20} />
                  </div>
                  <div className="ct-queue-row">
                    <time>{c.sample.queue[0].time}</time>
                    <span className="ct-avatar">
                      {c.sample.queue[0].initials}
                    </span>
                    <div>
                      <strong>{c.sample.queue[0].name}</strong>
                      <small>{c.sample.queue[0].status}</small>
                    </div>
                  </div>
                  <div className="ct-queue-row is-selected">
                    <time>{care.slot}</time>
                    <span className="ct-avatar">
                      {c.sample.patientInitials}
                    </span>
                    <div>
                      <strong>{c.sample.patient}</strong>
                      <small>{c.workspace.selected}</small>
                    </div>
                    <ChevronRight size={16} />
                  </div>
                  <div className="ct-queue-row">
                    <time>{c.sample.queue[1].time}</time>
                    <span className="ct-avatar">
                      {c.sample.queue[1].initials}
                    </span>
                    <div>
                      <strong>{c.sample.queue[1].name}</strong>
                      <small>{c.sample.queue[1].status}</small>
                    </div>
                  </div>
                  <p className="ct-card-footnote">{c.sample.timezone}</p>
                </section>
              )}
              <section className="ct-dashboard-card ct-primary-appointment">
                <div className="ct-card-heading">
                  <h2>
                    {role === "staff"
                      ? c.workspace.coordination
                      : c.workspace.appointment}
                  </h2>
                  <Status />
                </div>
                <div className="ct-profile-banner">
                  <Portrait />
                  <div>
                    <p className="ct-eyebrow">{c.sample.specialty}</p>
                    <h3>{c.sample.clinician}</h3>
                    <p>{c.sample.visitType}</p>
                  </div>
                  <Stethoscope className="ct-profile-watermark" size={80} />
                </div>
                <AppointmentAnchor />
                <VisitMeta />
                {role === "patient" && (
                  <fieldset className="ct-slot-picker">
                    <legend>{c.workspace.chooseTime}</legend>
                    <div>
                      {c.sample.slots.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          aria-pressed={care.slot === slot}
                          onClick={() => {
                            care.setSlot(slot);
                            setFeedback(c.workspace.slotFeedback);
                          }}
                        >
                          {slot}
                          {care.slot === slot && <Check size={16} />}
                        </button>
                      ))}
                    </div>
                    <p>{c.sample.timezone}</p>
                  </fieldset>
                )}
                {role === "staff" ? (
                  <div className="ct-staff-action">
                    <p>{c.workspace.connected}</p>
                    <Button
                      className="ct-action"
                      onClick={() => {
                        care.toggleReady();
                        setFeedback(c.workspace.staffFeedback);
                      }}
                    >
                      {care.status === "ready"
                        ? c.workspace.markPending
                        : c.workspace.markReady}
                      <Check size={17} />
                    </Button>
                    <small>{c.workspace.noNotification}</small>
                  </div>
                ) : (
                  <Button
                    className="ct-action ct-full"
                    onClick={() => setVisit(true)}
                  >
                    {c.workspace.openVisit}
                    <Video size={18} />
                  </Button>
                )}
              </section>
              <section className="ct-dashboard-card ct-context">
                <div className="ct-card-heading">
                  <h2>
                    {role === "staff"
                      ? c.workspace.staffContextTitle
                      : c.workspace.contextTitle}
                  </h2>
                  <FileText size={20} />
                </div>
                <span className="ct-small-label">
                  {role === "staff"
                    ? c.workspace.staffContextLabel
                    : c.workspace.contextLabel}
                </span>
                <h3>
                  {role === "staff"
                    ? c.workspace.staffContextHeading
                    : c.sample.reason}
                </h3>
                <blockquote>
                  {role === "staff"
                    ? c.workspace.staffContextBody
                    : c.sample.patientNote}
                </blockquote>
                <span className="ct-card-footnote">
                  {role === "staff"
                    ? c.workspace.staffBoundary
                    : c.workspace.noteLabel}
                </span>
                <div className="ct-context-bottom">
                  <span className="ct-avatar">{c.sample.patientInitials}</span>
                  <div>
                    <strong>{c.sample.patient}</strong>
                    <small>{c.sample.appointmentId}</small>
                  </div>
                </div>
              </section>
              {role === "staff" ? (
                <section className="ct-dashboard-card ct-followup">
                  <div>
                    <span className="ct-record-icon">
                      <Check size={23} />
                    </span>
                    <div>
                      <h2>{c.workspace.staffHandoffTitle}</h2>
                      <p>{c.workspace.staffHandoffBody}</p>
                    </div>
                  </div>
                </section>
              ) : (
                <section className="ct-dashboard-card ct-followup">
                  <div>
                    <span className="ct-record-icon">
                      <FileText size={23} />
                    </span>
                    <div>
                      <h2>{c.sample.recordTitle}</h2>
                      <p>{c.sample.recordNote}</p>
                    </div>
                  </div>
                  <button
                    aria-expanded={followup}
                    onClick={() => setFollowup((value) => !value)}
                  >
                    {followup ? c.workspace.hideFollowup : c.workspace.followup}
                    <ChevronRight
                      className={followup ? "is-open" : ""}
                      size={18}
                    />
                  </button>
                  {followup && (
                    <ul>
                      {c.sample.recordItems.map((item) => (
                        <li key={item}>
                          <Check size={16} />
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}
            </div>
          )}
          <p className="ct-workspace-legal">{c.notice}</p>
        </main>
      </div>
    </div>
  );
}
