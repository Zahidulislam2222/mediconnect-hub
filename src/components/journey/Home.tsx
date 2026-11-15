import { useJourneyRoutes } from './Routing';
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { journey as c } from "@/content/journey";
import HeroThread from "./HeroThread";
import HomeSections from './HomeSections';

export default function Home() {
  const routes = useJourneyRoutes();
  const reduced = useReducedMotion();
  return (
    <main id="main" tabIndex={-1}>
      <HeroThread />
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
              <Link to={role.id === "staff" ? routes.adminAuth : routes.auth} className="jy-text-link">
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
      <HomeSections />
    </main>
  );
}
