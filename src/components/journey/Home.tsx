import { useJourneyRoutes } from './Routing';
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  HeartHandshake,
  X,
  Plus,
} from "lucide-react";
import { journey as c } from "@/content/journey";
import Film from "./Film";

export default function Home({
  slot,
  ready,
}: {
  slot: string;
  ready: boolean;
}) {
  const routes = useJourneyRoutes();
  const track = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const [manualReduced, setManualReduced] = useState(false);
  const [short, setShort] = useState(false);
  const [active, setActive] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const detail = useRef<HTMLDialogElement>(null);
  const { scrollYProgress: progress } = useScroll({
    target: track,
    offset: ["start start", "end end"],
  });
  const enabled = !reduced && !manualReduced && !short;
  const cardY = useTransform(
    progress,
    [0, 0.3, 0.6, 1],
    [0, -c.motion.cardTravelPx, 0, -c.motion.cardTravelPx / 2],
  );
  const cardRotate = useTransform(
    progress,
    [0, 0.3, 0.6, 1],
    [0, -c.motion.cardTiltDegrees, c.motion.cardTiltDegrees, 0],
  );
  useMotionValueEvent(progress, "change", (value) => {
    if (enabled)
      setActive(
        c.stages.reduce(
          (selected, stage, index) => (value >= stage.at ? index : selected),
          0,
        ),
      );
  });
  useEffect(() => {
    const query = matchMedia(`(max-height: ${c.motion.minimumHeight}px)`);
    const update = () => setShort(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const dialog = detail.current;
    if (!dialog || !expanded) return;
    dialog.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
      if (dialog.open) dialog.close();
    };
  }, [expanded]);
  const go = (index: number) => {
    setActive(index);
    if (enabled && track.current) {
      const rect = track.current.getBoundingClientRect();
      window.scrollTo({
        top:
          scrollY +
          rect.top +
          (track.current.offsetHeight - innerHeight) * c.stages[index].at,
        behavior: "instant",
      });
    } else {
      requestAnimationFrame(() => {
        const heading = track.current?.querySelector<HTMLHeadingElement>("h1");
        heading?.focus({ preventScroll: true });
        heading?.scrollIntoView({ block: "start", behavior: "instant" });
      });
    }
  };
  const stage = c.stages[active];
  return (
    <main id="main" tabIndex={-1}>
      <section
        ref={track}
        className={`jy-track ${enabled ? "" : "is-static"}`}
        style={
          {
            "--journey-height": `${c.motion.scrollHeightVh}vh`,
            "--journey-mobile-height": `${c.motion.mobileScrollHeightVh}vh`,
          } as CSSProperties
        }
        aria-label={c.navigation.journey}
      >
        <div className="jy-stage" data-phase={active}>
          <Film
            progress={progress}
            enabled={enabled}
            poster={active >= 2 ? c.media.homePoster : c.media.poster}
          />
          <div className="jy-shade" aria-hidden="true" />
          <div className="jy-stage-top">
            <span>
              <span className="jy-live-dot" />
              {c.tagline}
            </span>
            <Link className="jy-mobile-skip" to="#explore">
              {c.hero.skip}
              <ArrowDown size={16} />
            </Link>
            <button
              onClick={() => setManualReduced((value) => !value)}
              disabled={Boolean(reduced || short)}
              aria-pressed={!enabled}
            >
              {reduced || short
                ? c.hero.motionStatic
                : enabled
                  ? c.hero.motionOff
                  : c.hero.motionOn}
            </button>
          </div>
          <div className="jy-story-copy" data-chapter={stage.id}>
            <p className="jy-eyebrow">{stage.label}</p>
            <h1 tabIndex={-1}>
              {stage.title}
              <br />
              <em>{stage.emphasis}</em>
            </h1>
            <p className="jy-story-body">{stage.body}</p>
            <div className="jy-actions">
              <Link className="jy-button jy-button-light" to={`${routes.workspace}/patient`}>
                {c.hero.primary}
                <ArrowUpRight size={20} />
              </Link>
              <Link className="jy-text-link" to="#explore">
                {c.hero.skip}
                <ArrowDown size={18} />
              </Link>
            </div>
          </div>
          <motion.aside
            className="jy-care-card"
            style={enabled ? { y: cardY, rotateY: cardRotate } : {}}
            aria-label={stage.cardLabel}
          >
            <div className="jy-card-top">
              <HeartHandshake size={25} />
              <span>{stage.cardLabel}</span>
              <span className="jy-card-id">{c.sample.appointment}</span>
            </div>
            <h3>{stage.cardTitle}</h3>
            <div className="jy-card-bottom">
              <span>
                <Check size={16} />
                {stage.cardStatus}
              </span>
              <button
                aria-label={c.hero.openDetail}
                aria-haspopup="dialog"
                aria-expanded={expanded}
                onClick={() => setExpanded((value) => !value)}
              >
                <Plus />
              </button>
            </div>
          </motion.aside>
          <div className="jy-story-bottom">
            <div className="jy-chapters" aria-label={c.hero.chapters}>
              {c.stages.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => go(index)}
                  aria-current={active === index ? "step" : undefined}
                >
                  <span className="jy-chapter-number">0{index + 1}</span>
                  <span>{item.label}</span>
                  <span className="jy-chapter-line" />
                </button>
              ))}
            </div>
            <p className="jy-film-credit">
              {c.media.finished ? c.hero.illustration : c.hero.blockout}
            </p>
          </div>
        </div>
      </section>
      <dialog
        className="jy-plan-dialog"
        ref={detail}
        onClose={() => setExpanded(false)}
        aria-labelledby="plan-title"
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const controls = event.currentTarget.querySelectorAll<HTMLElement>(
            "button:not([disabled]), a[href]",
          );
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <button
          className="jy-dialog-close"
          aria-label={c.hero.closeDetail}
          onClick={() => setExpanded(false)}
          autoFocus
        >
          <X />
        </button>
        <p className="jy-eyebrow">{stage.cardLabel}</p>
        <h2 id="plan-title">{stage.cardTitle}</h2>
        <p>{stage.cardBody}</p>
        <div className="jy-card-detail">
          <strong>{c.sample.doctor}</strong>
          <span>
            {c.sample.date} · {slot}
          </span>
          <span>{ready ? c.workspace.ready : c.workspace.pending}</span>
          <p className="jy-local-notice">{c.workspace.notice}</p>
          <Link className="jy-button" to={`${routes.workspace}/patient`}>
            {c.workspace.details}
            <ArrowUpRight size={20} />
          </Link>
        </div>
      </dialog>
      <section id="explore" className="jy-explore jy-section" tabIndex={-1}>
        <div className="jy-section-heading">
          <p className="jy-eyebrow">{c.explore.eyebrow}</p>
          <h2>{c.explore.title}</h2>
          <p>{c.explore.body}</p>
        </div>
        <div className="jy-role-grid">
          {c.explore.roles.map((role, index) => (
            <motion.article
              className="jy-role-card"
              key={role.id}
              initial={reduced ? false : { opacity: 0, y: 36 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5, delay: reduced ? 0 : index * 0.08 }}
            >
              <div className="jy-role-top">
                <span>{role.label}</span>
                <span>{role.number}</span>
              </div>
              <h3>{role.title}</h3>
              <p>{role.body}</p>
              <Link to={`${routes.workspace}/${role.id}`} className="jy-text-link">
                {role.action}
                <ArrowUpRight />
              </Link>
            </motion.article>
          ))}
        </div>
        <div className="jy-learning-links">
          <Link to={routes.knowledge}>
            <span>{c.navigation.knowledge}</span>
            <strong>{c.hero.knowledgeLink}</strong>
            <ArrowUpRight />
          </Link>
          <Link to={routes.blog}>
            <span>{c.navigation.blog}</span>
            <strong>{c.hero.journalLink}</strong>
            <ArrowUpRight />
          </Link>
        </div>
      </section>
    </main>
  );
}
