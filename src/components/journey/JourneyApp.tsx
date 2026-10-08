import { useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ArrowUpRight, HeartPulse, Menu, X } from 'lucide-react';
import { journey as c } from '@/content/journey';
import { publicSite as site, type PublicPageId } from '@/content/public-site';
import { publicSiteRoutes } from '@/config/public-site-routing';
import { JourneyRoutingContext, useJourneyRoutes } from './Routing';
import { journeyRouting, type JourneyMode } from '@/config/journey-routing';
import PublicPage from '@/components/public-website/PublicPage';
import Home from './Home';
import Library from './Library';

export default function JourneyApp({ mode = 'application' }: { mode?: JourneyMode }) {
  return <JourneyRoutingContext.Provider value={journeyRouting[mode]}><JourneyView /></JourneyRoutingContext.Provider>;
}
function JourneyView() {
  const routes = useJourneyRoutes();
  const location = useLocation();
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    const present = document.documentElement.classList.contains('jy-document');
    document.documentElement.classList.add('jy-document');
    return () => { if (!present) document.documentElement.classList.remove('jy-document'); };
  }, []);
  useEffect(() => {
    if (!menu) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenu(false);
        document.querySelector<HTMLButtonElement>('.jy-menu')?.focus();
      }
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [menu]);
  useEffect(() => {
    setMenu(false);
    const frame = requestAnimationFrame(() => {
      if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
      else {
        window.scrollTo({ top: 0, behavior: 'instant' });
        document.getElementById('main')?.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [location.key, location.hash]);
  const nav = [
    ...site.navigation.map(item => ({ to: publicSiteRoutes[item.id], label: item.label })),
    { to: routes.knowledge, label: c.navigation.knowledge },
    { to: routes.blog, label: c.navigation.blog },
  ];
  return <div className="jy-app">
    <Link to="#main" className="jy-skip">{c.navigation.skip}</Link>
    <header className="jy-header">
      <Link to={routes.home} className="jy-brand" aria-label={`${c.brand} ${site.homeLabel}`}><HeartPulse aria-hidden="true" />{c.brand}<span /></Link>
      <nav aria-label={site.navigationLabel} className={menu ? 'is-open' : ''} id="main-navigation">
        {nav.map(item => <Link key={item.to} to={item.to} onClick={() => setMenu(false)} aria-current={location.pathname === item.to ? 'page' : undefined}>{item.label}</Link>)}
        <Link to={routes.auth} className="jy-nav-login">{c.navigation.login}<ArrowUpRight size={18} /></Link>
      </nav>
      <button className="jy-menu" aria-label={menu ? c.navigation.close : c.navigation.menu} aria-expanded={menu} aria-controls="main-navigation" onClick={() => setMenu(value => !value)}>{menu ? <X /> : <Menu />}</button>
    </header>
    <Routes>
      <Route path={routes.home} element={<Home />} />
      {Object.entries(publicSiteRoutes).map(([id, path]) => <Route key={id} path={path} element={<PublicPage id={id as PublicPageId} />} />)}
      <Route path={routes.knowledge} element={<Library key="knowledge" kind="knowledge" />} />
      <Route path={`${routes.knowledge}/:slug`} element={<Library key={location.pathname} kind="knowledge" />} />
      <Route path={routes.blog} element={<Library key="blog" kind="blog" />} />
      <Route path={`${routes.blog}/:slug`} element={<Library key={location.pathname} kind="blog" />} />
      <Route path={`${routes.workspace}/staff`} element={<Navigate to={routes.adminAuth} replace />} />
      <Route path={`${routes.workspace}/:role`} element={<Navigate to={routes.auth} replace />} />
      <Route path={routes.storyboard} element={<Navigate to={publicSiteRoutes.about} replace />} />
      <Route path="*" element={<main id="main" tabIndex={-1} className="jy-section jy-inner"><h1>{c.footer.notFound}</h1><Link className="jy-text-link" to={routes.home}>{c.footer.return}<ArrowUpRight /></Link></main>} />
    </Routes>
    <footer className="jy-footer">
      <div><Link to={routes.home} className="jy-brand"><HeartPulse aria-hidden="true" />{c.brand}</Link><p>{c.tagline}</p></div>
      <nav aria-label={site.footerLabel}>
        {nav.map(item => <Link key={item.to} to={item.to}>{item.label}</Link>)}
        <Link to={publicSiteRoutes.contact}>{site.contactLabel}</Link>
        <Link to={c.publicLinks.privacy}>{site.privacyLabel}</Link>
        <Link to={c.publicLinks.terms}>{site.termsLabel}</Link>
        <Link to={c.publicLinks.security}>{site.securityLabel}</Link>
      </nav>
      <p className="jy-footer-notice">{site.status}</p><span>{c.footer.credit}</span>
    </footer>
  </div>;
}
