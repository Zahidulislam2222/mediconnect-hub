import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowUpRight,
  CalendarDays,
  Check,
  Circle,
  CircleCheck,
  ClipboardCheck,
  MessageSquare,
  Mic,
  PhoneOff,
  Video,
} from "lucide-react";
import { journey as c } from "@/content/journey";
import { publicSite as site } from "@/content/public-site";
import { arrivalMs, changeOrder, momentState, THREAD_START } from "@/lib/hero-thread";
import { useJourneyRoutes } from "./Routing";
import "@/styles/hero-thread.css";

type MomentId = (typeof c.moments)[number]["id"];

const LAST = c.moments.length - 1;
const preview = c.heroPreview;
/** Validated timing handed to the stylesheet, so the five-second rule covers what CSS animates. */
const motionVariables = {
  "--jy-hero-segment": `${c.heroMotion.segmentMs}ms`,
  "--jy-hero-arrival": `${arrivalMs(c.heroMotion)}ms`,
  "--jy-hero-reveal": `${c.heroMotion.revealMs}ms`,
} as CSSProperties;

/**
 * Artwork geometry on an 800 x 590 canvas: the connector that leads into each moment, in order.
 * The heartbeat between booking and the visit echoes the pulse line in the brand mark.
 */
const CANVAS = { width: 800, height: 590 };
const WIRES = [
  "M-70 190H24",
  "M290 190h28q7-13 14 0h8l6 9 9-66 10 84 7-27h7q9-17 18 0h17",
  "M568 262c0 70-116 32-176 66-30 17-48 32-62 54",
  "M376 446c50 0 46 40 104 40",
];
/** Shape of the check-in trace inside the follow-up illustration. */
const TRACE = "M0 30h58q6-11 12 0h9l5 7 8-31 9 41 6-17h9q8-13 16 0h108";

function startsSettled(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** People-free interface sketches: initials stand in for faces, and every value is invented content. */
const illustrations: Record<MomentId, () => ReactNode> = {
  book: () => (
    <>
      <span className="jy-hero-kicker">
        <CalendarDays />
        {preview.book.kicker}
        <span className="jy-hero-aside">{c.sample.appointment}</span>
      </span>
      <strong className="jy-hero-tile-title">{preview.book.title}</strong>
      <span className="jy-hero-slot">
        <span className="jy-hero-time">{c.sample.defaultSlot}</span>
        <span>
          {c.sample.date}
          <br />
          {preview.book.mode}
        </span>
      </span>
      <span className="jy-hero-status">
        <Check />
        {preview.book.status}
      </span>
    </>
  ),
  visit: () => (
    <>
      <span className="jy-hero-kicker">
        <Video />
        {preview.visit.kicker}
        <span className="jy-hero-aside jy-hero-live">
          <i />
          {preview.visit.status} {preview.visit.elapsed}
        </span>
      </span>
      <span className="jy-hero-call">
        <span className="jy-hero-monogram">{c.sample.doctorInitials}</span>
        <span className="jy-hero-wave">
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
        <span className="jy-hero-caller">{c.sample.doctor}</span>
      </span>
      <span className="jy-hero-controls">
        <span><Mic /></span>
        <span><Video /></span>
        <span><MessageSquare /></span>
        <span className="is-end"><PhoneOff /></span>
        <span className="jy-hero-self">{c.sample.patientInitials}</span>
      </span>
    </>
  ),
  plan: () => (
    <>
      <span className="jy-hero-kicker">
        <ClipboardCheck />
        {preview.plan.kicker}
      </span>
      {preview.plan.items.map((item) => (
        <span className="jy-hero-check" data-done={item.done} key={item.label}>
          {item.done ? <CircleCheck /> : <Circle />}
          {item.label}
        </span>
      ))}
    </>
  ),
  follow: () => (
    <>
      <span className="jy-hero-kicker">
        <MessageSquare />
        {preview.follow.kicker}
        <span className="jy-hero-aside">{preview.follow.when}</span>
      </span>
      <svg className="jy-hero-trace" viewBox="0 0 240 48" preserveAspectRatio="none" focusable="false">
        <path d={TRACE} />
      </svg>
      <span className="jy-hero-message">{preview.follow.message}</span>
    </>
  ),
};

/**
 * Homepage hero: one appointment shown as four connected moments joined by the care thread.
 * The thread travels through them once on load, then rests; selecting a moment moves it there.
 */
export default function HeroThread() {
  const routes = useJourneyRoutes();
  // Colons from useId are not safe inside the SVG url(#...) reference.
  const id = useId().replace(/:/g, "");
  const [settled] = useState(startsSettled);
  const [thread, setThread] = useState({ active: settled ? LAST : THREAD_START, from: THREAD_START });
  const timers = useRef<number[]>([]);
  const stopSequence = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  };
  const moveTo = (index: number) =>
    setThread((current) => (current.active === index ? current : { active: index, from: current.active }));
  useEffect(() => {
    if (settled) return;
    timers.current = c.moments.map((_, index) =>
      window.setTimeout(() => moveTo(index), c.heroMotion.startDelayMs + index * c.heroMotion.stepMs),
    );
    return stopSequence;
  }, [settled]);
  const sequenced = (index: number) =>
    ({ "--jy-hero-order": changeOrder(index, thread.from, thread.active) }) as CSSProperties;
  return (
    <section className="jy-hero" aria-labelledby={`${id}-title`}>
      <div className="jy-hero-inner">
        <div className="jy-hero-copy">
          <h1 id={`${id}-title`}>
            {c.hero.title}
            <br />
            <em>{c.hero.emphasis}</em>
          </h1>
          <p className="jy-hero-body">{c.hero.body}</p>
          <div className="jy-actions">
            <Link className="jy-button jy-button-light" to={routes.auth}>
              {c.hero.primary}
              <ArrowUpRight size={20} aria-hidden="true" />
            </Link>
            <Link className="jy-text-link" to="#explore">
              {c.hero.secondary}
              <ArrowDown size={18} aria-hidden="true" />
            </Link>
          </div>
        </div>
        <div className="jy-hero-thread" style={motionVariables}>
          <div className="jy-hero-canvas">
            <svg
              className="jy-hero-wires"
              viewBox={`0 0 ${CANVAS.width} ${CANVAS.height}`}
              aria-hidden="true"
              focusable="false"
            >
              <defs>
                <linearGradient id={`${id}-lead`} gradientUnits="userSpaceOnUse" x1="-70" x2="10" y1="0" y2="0">
                  <stop offset="0" stopColor="currentColor" stopOpacity="0" />
                  <stop offset="1" stopColor="currentColor" />
                </linearGradient>
              </defs>
              {WIRES.map((path, index) => (
                <g key={path} data-lit={index <= thread.active} style={sequenced(index)}>
                  <path className="jy-hero-wire-route" d={path} />
                  {/* The first connector fades in from the copy column; a style, so it outranks the stylesheet. */}
                  <path
                    className="jy-hero-wire"
                    d={path}
                    pathLength={1}
                    style={index === 0 ? { stroke: `url(#${id}-lead)` } : undefined}
                  />
                </g>
              ))}
            </svg>
            {/* Explicit role: Safari drops list semantics when list-style is none. */}
            <ol className="jy-hero-moments" role="list" aria-label={c.hero.momentsLabel}>
              {c.moments.map((moment, index) => {
                const state = momentState(index, thread.active);
                return (
                  <li
                    className={`jy-hero-moment is-${moment.id}`}
                    data-state={state}
                    key={moment.id}
                    style={sequenced(index)}
                  >
                    <button
                      type="button"
                      aria-pressed={state === "current"}
                      aria-describedby={`${id}-${moment.id}`}
                      onClick={() => {
                        stopSequence();
                        moveTo(index);
                      }}
                    >
                      <span className="jy-hero-tag">
                        <span>{index + 1}</span>
                        {moment.label}
                      </span>
                      <span className="jy-hero-tile" aria-hidden="true">
                        {illustrations[moment.id]()}
                      </span>
                    </button>
                    <p className="jy-hero-caption" id={`${id}-${moment.id}`}>
                      <strong>{moment.title}</strong> {moment.body}
                    </p>
                  </li>
                );
              })}
            </ol>
          </div>
          <p className="jy-hero-note">
            {c.hero.illustrationNote} {site.status}
          </p>
        </div>
      </div>
    </section>
  );
}
