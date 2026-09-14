import {
  ArrowDown,
  ArrowUpRight,
  CalendarDays,
  Check,
  Stethoscope,
  Users,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { continuity as c } from "@/content/continuity";
import {
  Action,
  AppointmentAnchor,
  Brand,
  Header,
  Portrait,
} from "@/components/continuity/Primitives";
import { CareJourney } from "@/components/continuity/CareJourney";

export default function ContinuityHome() {
  const reduced = useReducedMotion();
  const icons = [CalendarDays, Stethoscope, Users];
  return (
    <>
      <Header />
      <main id="main" tabIndex={-1}>
        <section className="ct-hero" aria-labelledby="hero-title">
          <div className="ct-hero-copy">
            <p className="ct-eyebrow">
              <span className="ct-live-mark" />
              {c.hero.eyebrow}
            </p>
            <motion.h1
              id="hero-title"
              initial={reduced ? false : { opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: c.motion.duration }}
            >
              {c.hero.title}
              <em>{c.hero.emphasis}</em>
            </motion.h1>
            <p className="ct-hero-description">{c.hero.description}</p>
            <div className="ct-hero-actions">
              <Action to="/demo/patient">{c.hero.primary}</Action>
              <Link to="/demo/clinician" className="ct-text-link">
                {c.hero.secondary}
                <ArrowUpRight size={17} />
              </Link>
            </div>
            <small className="ct-hero-footnote">
              <Check size={14} />
              {c.hero.footnote}
            </small>
          </div>
          <div className="ct-hero-visual">
            <Portrait film priority />
            <div className="ct-hero-caption">
              <span>{c.sample.specialty}</span>
              <p>{c.hero.caption}</p>
            </div>
            <div className="ct-hero-appointment">
              <div className="ct-hero-appointment-label">
                <span>{c.hero.appointmentLabel}</span>
                <span className="ct-tiny-cross">+</span>
              </div>
              <AppointmentAnchor compact />
            </div>
            <span className="ct-visual-credit">{c.hero.mediaLabel}</span>
          </div>
        </section>
        <div className="ct-hero-bottom">
          <p>{c.notice}</p>
          <Link to="/#journey">
            {c.hero.scroll}
            <ArrowDown size={16} />
          </Link>
        </div>
        <section className="ct-intro">
          <p className="ct-eyebrow">{c.journey.sampleLabel}</p>
          <h2>
            {c.journey.title}
            <br />
            <span>{c.journey.emphasis}</span>
          </h2>
          <p>{c.journey.description}</p>
        </section>
        <CareJourney />
        <section
          className="ct-platform"
          id="platform"
          aria-labelledby="platform-title"
        >
          <div className="ct-section-heading">
            <div>
              <p className="ct-eyebrow">{c.workspace.eyebrow}</p>
              <h2 id="platform-title">{c.workspace.title}</h2>
            </div>
            <p>{c.workspace.description}</p>
          </div>
          <div className="ct-role-grid">
            {c.workspace.roles.map((role, index) => {
              const Icon = icons[index];
              return (
                <Link
                  to={`/demo/${role.id}`}
                  key={role.id}
                  className="ct-role-card"
                >
                  <div className="ct-role-card-top">
                    <span>
                      <Icon size={24} />
                    </span>
                    <span>0{index + 1}</span>
                  </div>
                  <p className="ct-eyebrow">{role.name}</p>
                  <h3>{role.title}</h3>
                  <p>{role.body}</p>
                  <span className="ct-role-card-action">
                    {role.action}
                    <ArrowUpRight size={20} />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
        <section className="ct-ending">
          <div className="ct-ending-art" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
          <p className="ct-eyebrow">{c.brand}</p>
          <h2>{c.footer.title}</h2>
          <p>{c.footer.body}</p>
          <Action to="/demo/patient">{c.hero.primary}</Action>
        </section>
      </main>
      <footer className="ct-footer">
        <Brand />
        <p>{c.footer.disclosure}</p>
        <Link to="/auth">
          {c.navigation.login}
          <ArrowUpRight size={14} />
        </Link>
      </footer>
    </>
  );
}
