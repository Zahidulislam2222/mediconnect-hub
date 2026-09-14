// Local-only visual review entry. The original app, SDK setup, auth services and
// protected routes are preserved in main.tsx/App.tsx and never boot here.
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import CinematicShowcase from "./pages/CinematicShowcase";
import CinematicAuth from "./pages/CinematicAuth";
import { cinematic as c } from "./content/cinematic";
import "./index.css";
import "./styles/cinematic.css";

createRoot(document.getElementById("root")!).render(<BrowserRouter><Routes>
  <Route path="/" element={<CinematicShowcase />} />
  <Route path="/auth" element={<CinematicAuth />} />
  <Route path="/admin-auth" element={<CinematicAuth />} />
  <Route path="*" element={<main className="cin-page cin-not-found"><h1>{c.ui.notFound}</h1><Link to="/">{c.ui.home}</Link></main>} />
</Routes></BrowserRouter>);
