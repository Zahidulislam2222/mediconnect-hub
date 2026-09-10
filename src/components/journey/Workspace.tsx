import { useJourneyRoutes } from './Routing';
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Check,
  Clock,
  Mic,
  MicOff,
  Video,
  VideoOff,
} from "lucide-react";
import { journey as c } from "@/content/journey";

export interface DemoState {
  slot: string;
  ready: boolean;
  note: string;
}
export default function Workspace({
  state,
  change,
  reset,
}: {
  state: DemoState;
  change: (next: Partial<DemoState>) => void;
  reset: () => void;
}) {
  const routes = useJourneyRoutes();
  const { role } = useParams();
  const [visit, setVisit] = useState(false);
  const [mic, setMic] = useState(false);
  const [camera, setCamera] = useState(false);
  const [draft, setDraft] = useState(state.note);
  const [saved, setSaved] = useState(false);
  const call = useRef<HTMLElement>(null);
  useEffect(() => {
    if (visit) {
      call.current?.focus({ preventScroll: true });
      call.current?.scrollIntoView({ block: "start" });
    }
  }, [visit]);
  if (!["patient", "doctor", "staff"].includes(role ?? ""))
    return (
      <main id="main" tabIndex={-1} className="jy-section jy-inner">
        <h1>{c.footer.notFound}</h1>
        <Link to={routes.home}>{c.footer.return}</Link>
      </main>
    );
  const isStaff = role === "staff";
  const isDoctor = role === "doctor";
  return (
    <main id="main" tabIndex={-1} className="jy-inner jy-section jy-workspace">
      <div className="jy-workspace-top">
        <div>
          <p className="jy-eyebrow">{c.workspace.eyebrow}</p>
          <h1>
            {isStaff
              ? c.workspace.staff
              : isDoctor
                ? c.workspace.doctor
                : c.workspace.patient}
          </h1>
        </div>
        <button
          className="jy-button jy-button-outline"
          onClick={() => {
            reset();
            setDraft(c.sample.note);
            setSaved(false);
            setVisit(false);
            setMic(false);
            setCamera(false);
          }}
        >
          {c.workspace.reset}
        </button>
      </div>
      <div className="jy-workspace-roles" aria-label={c.labels.workspace}>
        {c.explore.roles.map((item) => (
          <Link
            key={item.id}
            aria-current={role === item.id ? "page" : undefined}
            to={`${routes.workspace}/${item.id}`}
          >
            {item.label}
            <ArrowUpRight size={17} />
          </Link>
        ))}
      </div>
      <p className="jy-local-notice">{c.workspace.notice}</p>
      {visit ? (
        <section
          className="jy-call"
          ref={call}
          tabIndex={-1}
          aria-label={c.workspace.callTitle}
        >
          <button className="jy-text-link" onClick={() => setVisit(false)}>
            <ArrowLeft size={19} />
            {c.workspace.close}
          </button>
          <div className="jy-call-view">
            <img src={c.media.homePoster} alt={c.media.alt} />
            <div className="jy-call-caption">
              <span>{isDoctor ? c.sample.patient : c.sample.doctor}</span>
              <h2>{c.workspace.callTitle}</h2>
            </div>
            <div className="jy-call-controls">
              <button
                aria-pressed={mic}
                aria-label={mic ? c.workspace.micOn : c.workspace.micOff}
                onClick={() => setMic((value) => !value)}
              >
                {mic ? <Mic /> : <MicOff />}
              </button>
              <button
                aria-pressed={camera}
                aria-label={camera ? c.workspace.camOn : c.workspace.camOff}
                onClick={() => setCamera((value) => !value)}
              >
                {camera ? <Video /> : <VideoOff />}
              </button>
            </div>
          </div>
          <p className="jy-local-notice">{c.workspace.callNotice}</p>
        </section>
      ) : (
        <div className="jy-dashboard-grid">
          <section className="jy-appointment-panel">
            <p className="jy-eyebrow">
              {isDoctor ? c.workspace.queue : c.workspace.appointment}
            </p>
            <div className="jy-appointment-person">
              <span className="jy-avatar">
                {isDoctor || isStaff
                  ? c.sample.patientInitials
                  : c.sample.doctorInitials}
              </span>
              <div>
                <h2>
                  {isDoctor || isStaff ? c.sample.patient : c.sample.doctor}
                </h2>
                <p>
                  {c.sample.appointment} ·{" "}
                  {isStaff ? c.sample.doctor : c.tagline}
                </p>
              </div>
            </div>
            <div className="jy-appointment-date">
              <CalendarDays />
              <div>
                <strong>
                  {c.sample.date}, {c.sample.year}
                </strong>
                <span>{c.sample.timezone}</span>
              </div>
              <strong data-slot>{state.slot}</strong>
            </div>
            <fieldset className="jy-slots">
              <legend>{c.workspace.choose}</legend>
              {c.sample.slots.map((slot) => (
                <button
                  key={slot}
                  aria-pressed={state.slot === slot}
                  onClick={() => change({ slot })}
                >
                  {slot}
                </button>
              ))}
            </fieldset>
            <div className="jy-readiness">
              <span>
                {state.ready ? <Check size={20} /> : <Clock size={20} />}
                <span role="status">
                  {state.ready ? c.workspace.ready : c.workspace.pending}
                </span>
              </span>
              {isStaff && (
                <button
                  className="jy-text-link"
                  onClick={() => change({ ready: !state.ready })}
                >
                  {c.workspace.toggle}
                </button>
              )}
            </div>
            {!isStaff && (
              <button className="jy-button" onClick={() => setVisit(true)}>
                {c.workspace.consult}
                <Video size={20} />
              </button>
            )}
          </section>
          <aside className="jy-preparation-panel">
            {isStaff ? (
              <>
                <p className="jy-eyebrow">{c.navigation.knowledge}</p>
                <h2>
                  {
                    c.articles.find(
                      (item) => item.slug === c.workspace.coordinationArticleSlug,
                    )!.title
                  }
                </h2>
                <p>
                  {
                    c.articles.find(
                      (item) => item.slug === c.workspace.coordinationArticleSlug,
                    )!.summary
                  }
                </p>
                <Link
                  className="jy-text-link"
                  to={`${routes.knowledge}/${c.workspace.coordinationArticleSlug}`}
                >
                  {c.library.read}
                  <ArrowUpRight />
                </Link>
              </>
            ) : (
              <>
                <p className="jy-eyebrow">{c.workspace.followup}</p>
                <h2>{c.workspace.notes}</h2>
                {isDoctor ? (
                  <blockquote>{state.note}</blockquote>
                ) : (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      change({ note: draft.trim() });
                      setSaved(true);
                    }}
                  >
                    <label className="sr-only" htmlFor="sample-note">
                      {c.workspace.notes}
                    </label>
                    <textarea
                      id="sample-note"
                      value={draft}
                      maxLength={c.workspace.noteMaxLength}
                      onChange={(event) => {
                        setDraft(event.target.value);
                        setSaved(false);
                      }}
                      rows={4}
                    />
                    <p className="jy-input-hint">{c.workspace.noteHint}</p>
                    <button
                      className="jy-button jy-button-outline"
                      type="submit"
                    >
                      {c.workspace.save}
                    </button>
                    <p role="status">{saved ? c.workspace.saved : ""}</p>
                  </form>
                )}
                <p>{c.workspace.followupBody}</p>
                <Link
                  className="jy-text-link"
                  to={`${routes.knowledge}/${c.workspace.preparationArticleSlug}`}
                >
                  {c.library.read}
                  <ArrowUpRight />
                </Link>
              </>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
