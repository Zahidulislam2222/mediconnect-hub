import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarDays, MessageCircle, FileText, CreditCard, ShieldCheck, HeartHandshake } from 'lucide-react';
import { homepage as content } from '@/content/homepage';
import { publicSite } from '@/content/public-site';
import { journey } from '@/content/journey';
import { publicSiteRoutes } from '@/config/public-site-routing';
import { useJourneyRoutes } from './Routing';
import '@/styles/homepage.css';

const serviceIcons = [CalendarDays, MessageCircle, FileText, CreditCard];
export default function HomeSections() {
  const routes = useJourneyRoutes();
  return <div className="jy-home-sections">
    <section className="jy-home-block jy-home-steps" aria-labelledby="home-steps-title">
      <div className="jy-section-heading"><p className="jy-eyebrow">{content.steps.eyebrow}</p><h2 id="home-steps-title">{content.steps.title}</h2><p>{content.steps.body}</p></div>
      <ol className="jy-home-step-list">{content.steps.items.map((item, index) => <li key={item.title}><span className="jy-home-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><h3>{item.title}</h3><p>{item.body}</p></li>)}</ol>
    </section>
    <section className="jy-home-block jy-home-services" aria-labelledby="home-services-title">
      <div className="jy-home-split-heading"><div><p className="jy-eyebrow">{content.services.eyebrow}</p><h2 id="home-services-title">{content.services.title}</h2></div><p>{content.services.body}</p></div>
      <div className="jy-home-service-grid">{publicSite.pages.services.sections.map((item, index) => {
        const Icon = serviceIcons[index] ?? HeartHandshake;
        return <article key={item.title}><Icon size={28} aria-hidden="true" /><h3>{item.title}</h3><p>{item.body}</p></article>;
      })}</div>
      <Link className="jy-text-link" to={publicSiteRoutes.services}>{content.services.action}<ArrowUpRight aria-hidden="true" /></Link>
    </section>
    <section className="jy-home-block jy-home-clinicians" aria-labelledby="home-clinicians-title">
      <div className="jy-home-clinician-image"><img src={journey.media.poster} alt="" loading="lazy" decoding="async" /></div>
      <div><p className="jy-eyebrow">{content.clinicians.eyebrow}</p><h2 id="home-clinicians-title">{content.clinicians.title}</h2><p>{content.clinicians.body}</p><ul>{publicSite.pages.clinicians.sections.map(item => <li key={item.title}><HeartHandshake size={22} aria-hidden="true" /><div><h3>{item.title}</h3><p>{item.body}</p></div></li>)}</ul><Link className="jy-text-link" to={publicSiteRoutes.clinicians}>{content.clinicians.action}<ArrowUpRight aria-hidden="true" /></Link></div>
    </section>
    <section className="jy-home-block jy-home-trust" aria-labelledby="home-trust-title">
      <ShieldCheck size={36} aria-hidden="true" /><div className="jy-section-heading"><p className="jy-eyebrow">{content.trust.eyebrow}</p><h2 id="home-trust-title">{content.trust.title}</h2><p>{content.trust.body}</p></div>
      <div className="jy-home-trust-grid">{content.trust.items.map(item => <article key={item.title}><h3>{item.title}</h3><p>{item.body}</p></article>)}</div>
      <div className="jy-home-actions"><Link className="jy-text-link" to={journey.publicLinks.privacy}>{content.trust.privacyAction}<ArrowUpRight aria-hidden="true" /></Link><Link className="jy-text-link" to={journey.publicLinks.security}>{content.trust.securityAction}<ArrowUpRight aria-hidden="true" /></Link></div>
    </section>
    <section className="jy-home-block jy-home-faq" aria-labelledby="home-faq-title">
      <div><p className="jy-eyebrow">{content.faq.eyebrow}</p><h2 id="home-faq-title">{content.faq.title}</h2></div>
      <div>{content.faq.items.map(item => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div>
    </section>
    <section className="jy-home-block jy-home-closing" aria-labelledby="home-closing-title"><p className="jy-eyebrow">{content.closing.eyebrow}</p><h2 id="home-closing-title">{content.closing.title}</h2><p>{content.closing.body}</p><div className="jy-home-actions"><Link className="jy-button jy-button-white" to={publicSiteRoutes.help}>{content.closing.primaryAction}<ArrowUpRight aria-hidden="true" /></Link><Link className="jy-text-link" to={routes.knowledge}>{content.closing.secondaryAction}<ArrowUpRight aria-hidden="true" /></Link></div></section>
  </div>;
}
