import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronDown, FileText, HeartPulse, Menu, MessageCircle, Plus, ShieldCheck, Stethoscope, Users, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { showcase as c } from "@/content/showcase";
import "@/styles/showcase.css";

const stageIcons = [CalendarDays, Video, FileText];
const roleIcons = [HeartPulse, Stethoscope, Users];

function Brand() {
  return <a href="#top" className="craft-brand" aria-label={`${c.brand} — ${c.footer.back}`}>
    <span className="craft-brand-mark"><HeartPulse aria-hidden="true" /></span>{c.brand}<span className="craft-brand-dot">.</span>
  </a>;
}

function Header() {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); toggle.current?.focus(); }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);
  return <header className="craft-header">
    <div className="craft-container craft-header-inner">
      <Brand />
      <nav className="craft-desktop-nav" aria-label={c.ui.navLabel}>
        {c.navigation.map(link => <a key={link.href} href={link.href}>{link.label}</a>)}
      </nav>
      <a href="#workspace" className="craft-nav-cta">{c.ui.previewLabel}<ArrowUpRight aria-hidden="true" size={16} /></a>
      <button ref={toggle} className="craft-menu-toggle" aria-label={open ? c.ui.closeMenu : c.ui.openMenu} aria-expanded={open} aria-controls="craft-mobile-nav" onClick={() => setOpen(!open)}>
        {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
      </button>
    </div>
    <nav id="craft-mobile-nav" className="craft-mobile-nav" aria-label={c.ui.navLabel} hidden={!open}>
      {c.navigation.map(link => <a key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label}<ArrowUpRight aria-hidden="true" size={18} /></a>)}
    </nav>
  </header>;
}

function CarePreview() {
  const [selected, setSelected] = useState(0);
  const stage = c.preview.stages[selected];
  const Icon = stageIcons[selected];
  return <div className="craft-care-scene">
    <div className="craft-scene-caption"><span><span className="craft-status-dot" />{c.preview.label}</span><span>{c.preview.badge}</span></div>
    <div className="craft-care-window">
      <div className="craft-window-bar"><HeartPulse size={18} aria-hidden="true" /><span>{c.ui.careLabel}</span><span className="craft-window-menu" aria-hidden="true">•••</span></div>
      <div className="craft-patient"><span className="craft-avatar">{c.preview.initials}</span><div><strong>{c.preview.person}</strong><span>{c.preview.personDetail}</span></div><ShieldCheck size={20} aria-hidden="true" /></div>
      <div className="craft-preview-body" aria-live="polite" aria-atomic="true">
        <div className="craft-preview-heading"><span className="craft-icon-tile"><Icon size={21} aria-hidden="true" /></span><span className="craft-small-label">{stage.status}</span></div>
        <h2>{stage.title}</h2><p>{stage.description}</p>
        <div className="craft-appointment">
          <div className="craft-doctor"><span className="craft-doctor-avatar">{c.preview.clinicianInitials}</span><div><strong>{c.preview.clinician}</strong><span>{c.preview.specialty}</span></div></div>
          <div className="craft-appointment-time"><CalendarDays size={16} aria-hidden="true" /><span>{c.preview.appointment}</span><strong>{c.preview.time}</strong></div>
        </div>
        <div className="craft-followup"><span className="craft-followup-line" aria-hidden="true" /><div><span>{stage.detailLabel}</span><strong>{stage.detail}</strong></div><Check size={17} aria-hidden="true" /></div>
      </div>
      <div className="craft-step-controls" role="group" aria-label={c.ui.stepsLabel}>
        {c.preview.stages.map((item, index) => <button key={item.id} aria-pressed={selected === index} onClick={() => setSelected(index)}><span>{item.number}</span>{item.label}</button>)}
      </div>
    </div>
    <p className="craft-preview-footnote"><span aria-hidden="true">↳</span>{c.preview.footnote}</p>
  </div>;
}

function Workspace() {
  const [feedback, setFeedback] = useState(false);
  return <section id="workspace" className="craft-workspace craft-section">
    <div className="craft-container">
      <div className="craft-section-intro"><div><p className="craft-eyebrow">{c.workspace.eyebrow}</p><h2>{c.workspace.title}</h2></div><p>{c.workspace.description}</p></div>
      <Tabs defaultValue={c.workspace.roles[0].id} onValueChange={() => setFeedback(false)}>
        <TabsList className="craft-role-tabs" aria-label={c.ui.rolesLabel}>
          {c.workspace.roles.map((role, index) => { const Icon = roleIcons[index]; return <TabsTrigger key={role.id} value={role.id}><Icon size={17} aria-hidden="true" />{role.label}</TabsTrigger>; })}
        </TabsList>
        {c.workspace.roles.map(role => <TabsContent key={role.id} value={role.id} className="craft-role-panel">
          <div className="craft-role-story"><p className="craft-eyebrow">{role.eyebrow}</p><h3>{role.title}</h3><p>{role.description}</p><div className="craft-role-note"><Plus size={19} aria-hidden="true" /><span>{role.note}</span></div></div>
          <div className="craft-workspace-screen">
            <div className="craft-workspace-toolbar"><span><HeartPulse size={17} aria-hidden="true" />{c.brand}</span><span className="craft-example-badge">{c.workspace.badge}</span></div>
            <div className="craft-workspace-content"><p className="craft-small-label">{role.screenSubtitle}</p><h4>{role.screenTitle}</h4>
              <div className="craft-workspace-rows">{role.rows.map((row, index) => { const Icon = stageIcons[index]; return <div className="craft-workspace-row" key={row.label}><span className="craft-row-icon"><Icon size={19} aria-hidden="true" /></span><div><span>{row.label}</span><strong>{row.value}</strong></div><span>{row.meta}</span></div>; })}</div>
              <div className="craft-workspace-action"><span><span className="craft-status-dot" />{c.preview.badge}</span><Button className="craft-button craft-button-small" onClick={() => setFeedback(!feedback)}>{feedback ? c.ui.reset : c.workspace.action}<ArrowRight size={16} aria-hidden="true" /></Button></div>
              <p className="craft-feedback" role="status">{feedback ? c.workspace.feedback : ""}</p>
              {feedback && <div className="craft-followup-detail"><strong>{c.preview.stages[2].detail}</strong><ul>{c.preview.stages[2].items.map(item => <li key={item}><Check size={14} aria-hidden="true" />{item}</li>)}</ul></div>}
            </div>
          </div>
        </TabsContent>)}
      </Tabs>
    </div>
  </section>;
}

export default function Showcase() {
  return <div className="craft-page" id="top">
    <a className="craft-skip" href="#main-content">{c.ui.skip}</a>
    <Header />
    <main id="main-content" tabIndex={-1}>
      <section className="craft-hero craft-container" aria-labelledby="craft-title">
        <div className="craft-hero-copy"><p className="craft-eyebrow"><span className="craft-eyebrow-line" />{c.hero.eyebrow}</p>
          <h1 id="craft-title" aria-label={c.hero.title}>{c.hero.lines.map((line, index) => <span key={line} className={index === 2 ? "craft-title-accent" : undefined}>{line}</span>)}</h1>
          <p className="craft-hero-description">{c.hero.description}</p>
          <div className="craft-hero-actions"><Button asChild className="craft-button"><a href="#workspace">{c.hero.primary}<ArrowUpRight size={18} aria-hidden="true" /></a></Button><a href="#experience" className="craft-text-link">{c.hero.secondary}<ArrowDown size={16} aria-hidden="true" /></a></div>
          <p className="craft-disclaimer"><span className="craft-status-dot" />{c.hero.disclaimer}</p>
        </div>
        <CarePreview />
      </section>
      <section id="experience" className="craft-principles craft-container" aria-label={c.hero.secondary}>
        {c.principles.map(item => <article key={item.number}><span className="craft-principle-number">{item.number}</span><div><h2>{item.title}</h2><p>{item.description}</p></div><ArrowUpRight aria-hidden="true" size={18} /></article>)}
      </section>
      <Workspace />
      <section id="engineering" className="craft-engineering craft-section">
        <div className="craft-container craft-engineering-layout">
          <div><p className="craft-eyebrow">{c.engineering.eyebrow}</p><h2>{c.engineering.title}</h2><p className="craft-engineering-description">{c.engineering.description}</p><div className="craft-engineering-note"><ShieldCheck size={20} aria-hidden="true" /><p>{c.engineering.note}</p></div></div>
          <div className="craft-engineering-list">{c.engineering.items.map(item => <article key={item.number}><span>{item.number}</span><div><h3>{item.title}</h3><p>{item.body}</p><span className="craft-engineering-status">{item.status}</span></div></article>)}</div>
        </div>
      </section>
      <section className="craft-faq craft-section craft-container"><div><p className="craft-eyebrow">{c.faq.eyebrow}</p><h2>{c.faq.title}</h2><MessageCircle className="craft-faq-icon" size={42} strokeWidth={1} aria-hidden="true" /></div><div>{c.faq.items.map(item => <details key={item.question}><summary>{item.question}<ChevronDown size={19} aria-hidden="true" /></summary><p>{item.answer}</p></details>)}</div></section>
      <section className="craft-closing craft-container"><div><p className="craft-eyebrow">{c.closing.eyebrow}</p><h2>{c.closing.title}</h2><p>{c.closing.description}</p></div><Button asChild className="craft-button"><a href="#workspace">{c.closing.action}<ArrowUpRight size={18} aria-hidden="true" /></a></Button></section>
    </main>
    <footer className="craft-footer craft-container"><div><Brand /><p>{c.footer.description}</p></div><div><p>{c.footer.status}</p><p>{c.footer.note}</p></div><a href="#top">{c.footer.back}<ArrowUpRight size={16} aria-hidden="true" /></a></footer>
  </div>;
}
