import { useLayoutEffect } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { CareProvider } from "./CareState";
import { continuity as c } from "@/content/continuity";
import ContinuityHome from "@/pages/ContinuityHome";
import ContinuityWorkspace from "@/pages/ContinuityWorkspace";
import ContinuityAuth from "@/pages/ContinuityAuth";

function LocationFocus() {
  const location = useLocation();
  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => {
      const target = location.hash
        ? document.getElementById(location.hash.slice(1))
        : document.getElementById("main");
      if (location.hash) target?.scrollIntoView({ behavior: "instant" });
      else {
        window.scrollTo({ top: 0, behavior: "instant" });
        target?.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [location.key, location.hash]);
  return null;
}

export default function ContinuityApp() {
  const { pathname } = useLocation();
  return (
    <CareProvider>
      <a className="ct-skip" href="#main">
        {c.navigation.skip}
      </a>
      <LocationFocus />
      <Routes>
        <Route path="/" element={<ContinuityHome />} />
        <Route
          path="/demo/:role"
          element={<ContinuityWorkspace key={pathname} />}
        />
        <Route path="/auth" element={<ContinuityAuth />} />
        <Route path="/admin-auth" element={<ContinuityAuth key={pathname} />} />
        <Route
          path="*"
          element={
            <main id="main" tabIndex={-1} className="ct-not-found">
              <h1>{c.footer.notFound}</h1>
              <Link to="/">{c.footer.return}</Link>
            </main>
          }
        />
      </Routes>
    </CareProvider>
  );
}
