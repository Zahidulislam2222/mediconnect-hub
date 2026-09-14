import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowUpRight, HeartPulse, Menu, X } from "lucide-react";
import { cinematic as c } from "@/content/cinematic";

export function Brand() {
  return <Link to="/" className="cin-brand"><HeartPulse aria-hidden="true" strokeWidth={1.8} /><span>{c.brand}<span className="cin-brand-dot">.</span></span></Link>;
}

export function Header() {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const location = useLocation();
  useEffect(() => { setOpen(false); }, [location]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape" && open) { setOpen(false); toggle.current?.focus(); } };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);
  return <header className="cin-header">
    <Brand />
    <nav className="cin-desktop-nav" aria-label={c.ui.nav}>{c.navigation.map(item => <a key={item.href} href={item.href}>{item.label}</a>)}</nav>
    <Link className="cin-nav-login" to="/auth">{c.ui.signIn}<ArrowUpRight size={16} aria-hidden="true" /></Link>
    <button ref={toggle} className="cin-menu" aria-label={open ? c.ui.closeMenu : c.ui.menu} aria-expanded={open} aria-controls="cin-mobile-nav" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
    <nav id="cin-mobile-nav" className="cin-mobile-nav" aria-label={c.ui.nav} hidden={!open}>{c.navigation.map(item => <a key={item.href} href={item.href} onClick={() => setOpen(false)}>{item.label}<ArrowUpRight size={18} /></a>)}</nav>
  </header>;
}
