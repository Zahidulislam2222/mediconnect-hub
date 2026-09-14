import { useEffect, useRef, useState } from "react";
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import {
  ArrowDown,
  ArrowRight,
  Check,
  FileText,
  Mic,
  Video,
} from "lucide-react";
import { Link } from "react-router-dom";
import { continuity as c } from "@/content/continuity";
import { useCare } from "./care-store";
import { ScrubPortrait } from "./ScrubPortrait";
import { AppointmentAnchor, Portrait, Status } from "./Primitives";

function StoryPanel({
  index,
  progress,
}: {
  index: number;
  progress?: MotionValue<number>;
}) {
  const care = useCare();
  if (index === 0)
    return (
      <div className="ct-story-patient">
        <div className="ct-doctor-row">
          <Portrait />
          <div>
            <strong>{c.sample.clinician}</strong>
            <span>{c.sample.specialty}</span>
          </div>
        </div>
        <p className="ct-small-label">{c.sample.date}</p>
        <div className="ct-story-slots">
          {c.sample.slots.map((slot) => (
            <span
              className={slot === care.slot ? "is-selected" : ""}
              key={slot}
            >
              {slot}
              {slot === care.slot && <Check size={14} />}
            </span>
          ))}
        </div>
        <div className="ct-story-divider" />
        <div className="ct-story-bottom">
          <span>{c.sample.visitType}</span>
          <span>{c.sample.duration}</span>
        </div>
        <p className="ct-story-note">{c.sample.timezone}</p>
      </div>
    );
  if (index === 1)
    return (
      <div className="ct-story-clinician">
        <div className="ct-mini-queue">
          <time>{c.sample.queue[0].time}</time>
          <span className="ct-avatar">{c.sample.queue[0].initials}</span>
          <div>
            <strong>{c.sample.queue[0].name}</strong>
            <small>{c.sample.queue[0].status}</small>
          </div>
          <Check size={17} />
        </div>
        <div className="ct-queue-current">
          <span className="ct-avatar">{c.sample.patientInitials}</span>
          <div>
            <strong>{c.sample.patient}</strong>
            <small>{c.sample.reason}</small>
          </div>
          <time>{care.slot}</time>
        </div>
        <div className="ct-story-context">
          <FileText size={18} />
          <div>
            <span>{c.workspace.contextLabel}</span>
            <p>{c.sample.patientNote}</p>
          </div>
        </div>
      </div>
    );
  if (index === 2)
    return (
      <div className="ct-story-call">
        {progress ? <ScrubPortrait progress={progress} /> : <Portrait />}
        <div className="ct-call-name">
          {c.sample.clinician}
          <span>{c.workspace.previewBadge}</span>
        </div>
        <div className="ct-call-decoration">
          <span>
            <Mic size={17} />
          </span>
          <span>
            <Video size={17} />
          </span>
        </div>
      </div>
    );
  return (
    <div className="ct-story-follow">
      <span className="ct-record-icon">
        <FileText size={25} />
      </span>
      <h4>{c.sample.recordTitle}</h4>
      {c.sample.recordItems.map((item) => (
        <p key={item}>
          <Check size={15} />
          {item}
        </p>
      ))}
      <small>{c.sample.recordNote}</small>
    </div>
  );
}

function MovingPanel({
  index,
  progress,
}: {
  index: number;
  progress: MotionValue<number>;
}) {
  const stop = c.motion.stageStops[index];
  const previous = index === 0 ? -1 : stop - c.motion.transitionWindow;
  const next =
    index === c.motion.stageStops.length - 1
      ? 2
      : c.motion.stageStops[index + 1];
  // Opaque panels slide past one another behind the anchored appointment strip.
  // Crossfading the whole surface makes two sets of text compete at the midpoint.
  const opacity = useTransform(progress, (value) =>
    value >= previous && value <= next ? 1 : 0,
  );
  const rotateX = useTransform(
    progress,
    [previous, stop, next - c.motion.transitionWindow, next],
    [-c.motion.foldDegrees, 0, 0, c.motion.foldDegrees],
  );
  const y = useTransform(
    progress,
    [previous, stop, next - c.motion.transitionWindow, next],
    [c.motion.travelPixels, 0, 0, -c.motion.travelPixels],
  );
  return (
    <motion.div
      className="ct-moving-panel"
      style={{ opacity, rotateX, y, zIndex: index + 1 }}
      aria-hidden="true"
      data-story-panel={index}
    >
      <div className="ct-panel-top">
        <span>{c.journey.stages[index].panelLabel}</span>
        <span className="ct-panel-dots">● ● ●</span>
      </div>
      <h3>{c.journey.stages[index].panelTitle}</h3>
      <StoryPanel index={index} progress={progress} />
    </motion.div>
  );
}

function StageTrack({
  index,
  progress,
  staticMode,
}: {
  index: number;
  progress: MotionValue<number>;
  staticMode: boolean;
}) {
  const start = c.motion.stageStops[index];
  const end = c.motion.stageStops[index + 1] ?? 1;
  const scaleX = useTransform(
    progress,
    [index === 3 ? 1 - c.motion.transitionWindow : start, end],
    [0, 1],
  );
  return (
    <span className="ct-stage-track">
      {!staticMode && <motion.span style={{ scaleX }} />}
    </span>
  );
}

export function CareJourney() {
  const section = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const [motionOff, setMotionOff] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [compact, setCompact] = useState(false);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({
    target: section,
    offset: ["start start", "end end"],
  });
  const staticMode = reduced || motionOff || mobile || compact;
  useEffect(() => {
    const query = matchMedia(c.motion.mobileQuery);
    const short = matchMedia(c.motion.compactQuery);
    const update = () => {
      setMobile(query.matches);
      setCompact(short.matches);
    };
    update();
    query.addEventListener("change", update);
    short.addEventListener("change", update);
    return () => {
      query.removeEventListener("change", update);
      short.removeEventListener("change", update);
    };
  }, []);
  useMotionValueEvent(scrollYProgress, "change", (progress) => {
    if (!staticMode)
      setActive(
        c.motion.stageStops.reduce(
          (found, stop, index) =>
            progress >= stop - c.motion.transitionWindow / 2 ? index : found,
          0,
        ),
      );
  });
  const navigate = (index: number) => {
    if (staticMode) {
      setActive(index);
      return;
    }
    const node = section.current;
    if (node)
      window.scrollTo({
        top:
          node.offsetTop +
          (node.offsetHeight - innerHeight) * c.motion.stageStops[index],
        behavior: "instant",
      });
  };
  const stage = c.journey.stages[active];
  return (
    <section
      ref={section}
      id="journey"
      className={`ct-journey ${staticMode ? "is-static" : ""}`}
      aria-labelledby="journey-title"
    >
      <div className="ct-journey-sticky">
        <div className="ct-journey-top">
          <span className="ct-eyebrow">{c.journey.eyebrow}</span>
          {!mobile && !reduced && (
            <button
              onClick={() => {
                setMotionOff((value) => !value);
                setActive(0);
              }}
            >
              {motionOff ? c.journey.motionOff : c.journey.motionOn}
            </button>
          )}
        </div>
        <div className="ct-journey-layout">
          <div className="ct-journey-copy">
            <p className="ct-chapter">
              {stage.number}
              <span>/ 04</span>
            </p>
            <h2 id="journey-title">{stage.title}</h2>
            <p className="ct-journey-body">{stage.body}</p>
            <Link
              to={active === 1 ? "/demo/clinician" : "/demo/patient"}
              className="ct-story-link"
            >
              {c.journey.readMore}
              <ArrowRight size={17} />
            </Link>
            <div className="ct-journey-note">
              <ArrowDown size={15} />
              {c.journey.sampleLabel}
            </div>
          </div>
          <div className="ct-story-stage" data-stage={stage.id}>
            <div className="ct-orbit ct-orbit-one" />
            <div className="ct-orbit ct-orbit-two" />
            <div className="ct-story-screen">
              <div className="ct-anchor-label">
                {c.journey.anchorLabel}
                <span>{c.sample.appointmentId}</span>
              </div>
              <AppointmentAnchor />
              <div className="ct-story-panels">
                {staticMode ? (
                  <div className="ct-moving-panel">
                    <div className="ct-panel-top">
                      <span>{stage.panelLabel}</span>
                    </div>
                    <h3>{stage.panelTitle}</h3>
                    <StoryPanel index={active} />
                  </div>
                ) : (
                  c.journey.stages.map((item, index) => (
                    <MovingPanel
                      key={item.id}
                      index={index}
                      progress={scrollYProgress}
                    />
                  ))
                )}
              </div>
              {!staticMode && (
                <div className="sr-only">
                  <h3>{stage.panelTitle}</h3>
                  <StoryPanel index={active} />
                </div>
              )}
              <div className="ct-story-foot">
                <span>{c.sample.timezone}</span>
                <Status />
              </div>
            </div>
          </div>
        </div>
        <nav className="ct-stage-nav" aria-label={c.navigation.journey}>
          {c.journey.stages.map((item, index) => (
            <button
              key={item.id}
              onClick={() => navigate(index)}
              aria-current={active === index ? "step" : undefined}
            >
              <StageTrack
                index={index}
                progress={scrollYProgress}
                staticMode={Boolean(staticMode)}
              />
              <span>{item.number}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </div>
    </section>
  );
}
