import { useEffect, useState } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { ArrowUpRight, HeartPulse, Menu, X } from "lucide-react";
import { journey as c } from "@/content/journey";
import { JourneyRoutingContext, useJourneyRoutes } from './Routing';
import { journeyRouting, type JourneyMode } from '@/config/journey-routing';
import Home from "./Home";
import Library from "./Library";
import Auth from "./Auth";
import Workspace, { type DemoState } from "./Workspace";

const initial = (): DemoState => ({
  slot: c.sample.defaultSlot,
  ready: false,
  note: c.sample.note,
});
export default function JourneyApp({ mode = 'preview' }: { mode?: JourneyMode }) {
  return <JourneyRoutingContext.Provider value={journeyRouting[mode]}><JourneyView mode={mode} /></JourneyRoutingContext.Provider>;
}
function JourneyView({ mode }: { mode: JourneyMode }) {
  const routes = useJourneyRoutes();
  useEffect(() => {
    const alreadyPresent = document.documentElement.classList.contains('jy-document');
    document.documentElement.classList.add('jy-document');
    return () => { if (!alreadyPresent) document.documentElement.classList.remove('jy-document'); };
  }, []);
  const location = useLocation();
  const [menu, setMenu] = useState(false);
  const [state, setState] = useState<DemoState>(initial);
  useEffect(() => {
    if (!menu) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenu(false);
        document.querySelector<HTMLButtonElement>(".jy-menu")?.focus();
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [menu]);
  useEffect(() => {
    setMenu(false);
    const frame = requestAnimationFrame(() => {
      if (location.hash) {
        document.getElementById(location.hash.slice(1))?.scrollIntoView();
      } else {
        window.scrollTo({ top: 0, behavior: "instant" });
        document.getElementById("main")?.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [location.key, location.hash]);
  const nav = [
    { to: routes.home, label: c.navigation.journey },
    { to: routes.knowledge, label: c.navigation.knowledge },
    { to: routes.blog, label: c.navigation.blog },
  ];
  return (
    <div className="jy-app">
      <Link to="#main" className="jy-skip">
        {c.navigation.skip}
      </Link>
      <header className="jy-header">
        <Link
          to={routes.home}
          className="jy-brand"
          aria-label={`${c.brand} ${c.navigation.home}`}
        >
          <HeartPulse aria-hidden="true" />
          {c.brand}
          <span />
        </Link>
        <nav
          aria-label={c.labels.mainNavigation}
          className={menu ? "is-open" : ""}
          id="main-navigation"
        >
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              aria-current={location.pathname === item.to ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
          <Link to={routes.auth} className="jy-nav-login">
            {c.navigation.login}
            <ArrowUpRight size={18} />
          </Link>
        </nav>
        <button
          className="jy-menu"
          aria-label={menu ? c.navigation.close : c.navigation.menu}
          aria-expanded={menu}
          aria-controls="main-navigation"
          onClick={() => setMenu((value) => !value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setMenu(false);
          }}
        >
          {menu ? <X /> : <Menu />}
        </button>
      </header>
      <Routes>
        <Route
          path={routes.home}
          element={<Home slot={state.slot} ready={state.ready} />}
        />
        <Route
          path={routes.knowledge}
          element={<Library key="knowledge" kind="knowledge" />}
        />
        <Route
          path={`${routes.knowledge}/:slug`}
          element={<Library key={location.pathname} kind="knowledge" />}
        />
        <Route path={routes.blog} element={<Library key="blog" kind="blog" />} />
        <Route
          path={`${routes.blog}/:slug`}
          element={<Library key={location.pathname} kind="blog" />}
        />
        {mode === "preview" && <Route path={routes.auth} element={<Auth key={location.pathname} />} />}
        {mode === "preview" && <Route path={routes.adminAuth} element={<Auth key={location.pathname} />} />}
        <Route
          path={`${routes.workspace}/:role`}
          element={
            <Workspace
              key={location.pathname}
              state={state}
              change={(next) =>
                setState((current) => ({ ...current, ...next }))
              }
              reset={() => setState(initial())}
            />
          }
        />
        <Route
          path={routes.storyboard}
          element={
            <main id="main" tabIndex={-1} className="jy-inner jy-section">
              <p className="jy-eyebrow">{c.footer.storyboard}</p>
              <h1>{c.footer.storyboardTitle}</h1>
              <p>{c.footer.storyboardBody}</p>
              <div className="jy-storyboard">
                {c.media.storyboard.map((src, index) => (
                  <figure key={src}>
                    <img
                      src={src}
                      alt={
                        index
                          ? c.labels.homeComposition
                          : c.labels.clinicComposition
                      }
                    />
                    <figcaption>
                      {index ? c.stages[3].label : c.stages[0].label}
                    </figcaption>
                  </figure>
                ))}
              </div>
              <ol className="jy-storyboard-notes">
                {c.stages.map((stage) => (
                  <li key={stage.id}>
                    <h2>{stage.label}</h2>
                    <p>{stage.body}</p>
                  </li>
                ))}
              </ol>
            </main>
          }
        />
        <Route
          path="*"
          element={
            <main id="main" tabIndex={-1} className="jy-section jy-inner">
              <h1>{c.footer.notFound}</h1>
              <Link className="jy-text-link" to={routes.home}>
                {c.footer.return}
                <ArrowUpRight />
              </Link>
            </main>
          }
        />
      </Routes>
      <footer className="jy-footer">
        <div>
          <Link to={routes.home} className="jy-brand">
            <HeartPulse aria-hidden="true" />
            {c.brand}
          </Link>
          <p>{c.tagline}</p>
        </div>
        <nav aria-label="Footer navigation">
          <Link to={routes.knowledge}>{c.navigation.knowledge}</Link>
          <Link to={routes.blog}>{c.navigation.blog}</Link>
          <Link to={routes.auth}>{c.navigation.login}</Link>
          <Link to={routes.storyboard}>{c.footer.storyboard}</Link>
        </nav>
        <p className="jy-footer-notice">{c.notice}</p>
        <span>{c.footer.credit}</span>
      </footer>
    </div>
  );
}
