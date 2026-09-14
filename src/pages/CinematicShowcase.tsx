import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useInView, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowDown, ArrowRight, ArrowUpRight, CalendarDays, Check, FileText, HeartPulse, ShieldCheck, Video } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brand, Header } from "@/components/cinematic/Chrome";
import { cinematic as c } from "@/content/cinematic";

const CareWorld = lazy(() => import("@/components/cinematic/CareWorld"));
const icons = { calendar: CalendarDays, video: Video, record: FileText };

function CareJourney({ motionEnabled, setMotionEnabled }: { motionEnabled: boolean; setMotionEnabled: (value: boolean) => void }) {
  const section = useRef<HTMLElement>(null);
  const near = useInView(section, { margin: "400px" });
  const [desktop, setDesktop] = useState(false);
  const [progress, setProgress] = useState(0);
  const [manualStage, setManualStage] = useState(0);
  const [rotation, setRotation] = useState(0);
  const { scrollYProgress } = useScroll({ target: section, offset: ["start start", "end end"] });
  useMotionValueEvent(scrollYProgress, "change", value => { setProgress(value); });
  useEffect(() => {
    const query = matchMedia(`(min-width: ${c.motion.desktopBreakpoint}px)`);
    const changed = () => setDesktop(query.matches);
    changed(); query.addEventListener("change", changed);
    return () => query.removeEventListener("change", changed);
  }, []);
  const scrollDriven = desktop && motionEnabled;
  const stage = scrollDriven ? Math.min(2, Math.round(progress * 2)) : manualStage;
  const current = c.journey.stages[stage];
  const Icon = icons[current.icon as keyof typeof icons];
  const choose = (index: number) => {
    setManualStage(index);
    if (!scrollDriven || !section.current) return;
    const top = window.scrollY + section.current.getBoundingClientRect().top;
    window.scrollTo({ top: top + (section.current.offsetHeight - window.innerHeight) * index / 2, behavior: "instant" });
  };
  return <section id="journey" ref={section} className={`cin-journey ${scrollDriven ? "is-scroll-driven" : "is-static"}`}>
    <div className="cin-journey-sticky">
      <div className="cin-journey-heading"><div><p className="cin-eyebrow">{c.journey.eyebrow}</p><h2>{c.journey.title}</h2></div><button className="cin-motion-switch" aria-pressed={motionEnabled} onClick={() => setMotionEnabled(!motionEnabled)}><span aria-hidden="true" />{motionEnabled ? c.journey.motionOn : c.journey.motionOff}</button></div>
      <div className="cin-journey-stage">
        <div className="cin-journey-copy" data-stage={current.id}>
          <span className="cin-stage-number" aria-hidden="true">{current.number}</span>
          <div className="cin-stage-rule" /><p className="cin-eyebrow">{current.label}</p><h3>{current.title}</h3><p>{current.body}</p>
          <span className="cin-stage-detail"><Icon aria-hidden="true" size={18} />{current.detail}</span>
        </div>
        <div className="cin-model-wrap">
          <Suspense fallback={<img src={c.media.poster} alt={c.journey.modelLabel} className="cin-world-poster" />}>
            <CareWorld enabled={near && desktop && motionEnabled} progress={scrollDriven ? progress : stage / 2} rotation={rotation} />
          </Suspense>
          <span className="cin-model-annotation">{c.journey.technique}</span>
        </div>
      </div>
      <div className="cin-journey-controls">
        <div className="cin-stage-buttons" role="group" aria-label={c.journey.controls}>{c.journey.stages.map((item, index) => <button key={item.id} aria-pressed={stage === index} onClick={() => choose(index)}><span>{item.number}</span>{item.label}<ArrowUpRight aria-hidden="true" size={15} /></button>)}</div>
        {scrollDriven && <label className="cin-rotation"><span>{c.journey.rotation}</span><input type="range" min={-c.motion.rotationLimit} max={c.motion.rotationLimit} step="0.01" value={rotation} onChange={event => setRotation(Number(event.target.value))} aria-label={c.journey.rotate} /></label>}
      </div>
      <p className="cin-journey-note">{c.journey.description}</p>
    </div>
  </section>;
}

function Workspace() {
  const [recordOpen, setRecordOpen] = useState(false);
  const w = c.workspace;
  return <section className="cin-workspace cin-section" id="workspace">
    <div className="cin-section-heading"><div><p className="cin-eyebrow">{w.eyebrow}</p><h2>{w.title}</h2></div><p>{w.description}</p></div>
    <Tabs defaultValue="0" onValueChange={() => setRecordOpen(false)}>
      <TabsList className="cin-role-tabs" aria-label={w.eyebrow}>{w.roles.map((role, index) => <TabsTrigger key={role} value={String(index)}>{role}<ArrowUpRight size={16} aria-hidden="true" /></TabsTrigger>)}</TabsList>
      {w.roles.map((role, index) => <TabsContent key={role} value={String(index)} className="cin-workspace-panel">
        <aside className="cin-workspace-sidebar"><HeartPulse size={31} aria-hidden="true" /><span>{role}</span><CalendarDays aria-hidden="true" /><FileText aria-hidden="true" /><ShieldCheck aria-hidden="true" /></aside>
        <div className="cin-workspace-main"><div className="cin-workspace-top"><span>{w.date}</span><span className="cin-demo-badge">{w.badge}</span></div>
          <h3>{[w.hello, w.clinicianTitle, w.teamTitle][index]}</h3>
          <div className="cin-workspace-grid"><div className="cin-appointment-card"><span className="cin-eyebrow">{[w.appointment, w.clinicianTask, w.teamTask][index]}</span><div className="cin-person"><span className="cin-person-monogram" aria-hidden="true">M</span><div><strong>{w.doctor}</strong><p>{w.time}</p></div></div><span className="cin-calendar-mark" aria-hidden="true"><Video size={22} /></span></div>
            <div className="cin-record-card"><FileText size={23} aria-hidden="true" /><span>{w.record}</span><strong>{[w.recordValue, w.clinicianValue, w.teamValue][index]}</strong><button onClick={() => setRecordOpen(!recordOpen)} aria-expanded={recordOpen}>{recordOpen ? w.close : w.action}<ArrowRight size={18} aria-hidden="true" /></button></div></div>
          {recordOpen && <div className="cin-record-detail" role="region" aria-label={w.recordTitle}><h4>{w.recordTitle}</h4><p>{w.recordBody}</p><ul>{w.recordItems.map(item => <li key={item}><Check size={16} aria-hidden="true" />{item}</li>)}</ul></div>}
          <Link className="cin-inline-link" to={index === 2 ? "/admin-auth" : `/auth?role=${index === 1 ? "clinician" : "patient"}`}>{w.signIn}<ArrowUpRight size={16} aria-hidden="true" /></Link>
        </div>
      </TabsContent>)}
    </Tabs>
  </section>;
}

export default function CinematicShowcase() {
  const reduced = useReducedMotion();
  const [motionPreference, setMotionPreference] = useState(true);
  const motionEnabled = motionPreference && !reduced;
  const hero = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: hero, offset: ["start start", "end start"] });
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "14%"]);
  return <div className="cin-page" id="top" data-motion={motionEnabled ? "on" : "off"}>
    <a className="cin-skip" href="#main-content">{c.ui.skip}</a><Header />
    <main id="main-content" tabIndex={-1}>
      <section ref={hero} className="cin-hero">
        <motion.img style={{ y: motionEnabled ? imageY : 0 }} className="cin-hero-art" src={c.media.hero} alt={c.media.heroAlt} fetchPriority="high" />
        <div className="cin-hero-shade" />
        <div className="cin-hero-copy"><p className="cin-eyebrow"><span className="cin-signal" />{c.hero.eyebrow}</p><h1>{c.hero.lines.map((line, index) => <span key={line} className={index ? "cin-soft-title" : ""}>{line}</span>)}</h1><p className="cin-hero-description">{c.hero.description}</p><div className="cin-hero-actions"><a className="cin-button" href="#journey">{c.hero.primary}<ArrowDown size={18} aria-hidden="true" /></a><Link className="cin-text-button" to="/auth">{c.hero.secondary}<ArrowUpRight size={17} aria-hidden="true" /></Link></div></div>
        <div className="cin-hero-bottom"><a href="#journey"><span className="cin-scroll-line" aria-hidden="true" />{c.hero.scroll}<ArrowDown size={15} aria-hidden="true" /></a><p>{c.hero.footnote}</p><span className="cin-hero-edition" aria-hidden="true">01 — 03</span></div>
      </section>
      <div className="cin-art-caption"><span>{c.hero.caption}</span><span>{c.brand} / Care pavilion</span></div>
      <CareJourney motionEnabled={motionEnabled} setMotionEnabled={setMotionPreference} />
      <Workspace />
      <section className="cin-engineering cin-section" id="engineering"><div><p className="cin-eyebrow">{c.engineering.eyebrow}</p><h2>{c.engineering.title}</h2><p className="cin-engineering-description">{c.engineering.body}</p></div><div className="cin-engineering-list">{c.engineering.items.map((item, index) => <article key={item.title}><span className="cin-eyebrow">0{index + 1}</span><h3>{item.title}</h3><p>{item.body}</p></article>)}</div></section>
      <section className="cin-closing cin-section"><p className="cin-eyebrow">{c.closing.eyebrow}</p><h2>{c.closing.title}</h2><Link to="/auth" className="cin-button">{c.closing.action}<ArrowUpRight size={20} aria-hidden="true" /></Link><p className="cin-closing-note">{c.closing.note}</p></section>
    </main>
    <footer className="cin-footer"><Brand /><p>{c.hero.footnote}</p><a href="#top">{c.ui.backTop}<ArrowUpRight size={16} aria-hidden="true" /></a></footer>
  </div>;
}
