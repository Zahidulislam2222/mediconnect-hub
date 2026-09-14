import { FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, ArrowUpRight, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { Brand } from "@/components/cinematic/Chrome";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cinematic as c } from "@/content/cinematic";

export default function CinematicAuth() {
  const location = useLocation();
  const [params] = useSearchParams();
  const staff = location.pathname === "/admin-auth";
  const a = c.auth;
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [role, setRole] = useState(params.get("role") === "clinician" ? "1" : "0");
  const [show, setShow] = useState(false);
  const [feedback, setFeedback] = useState("");
  useEffect(() => { setFeedback(""); setMode("login"); setRole(params.get("role") === "clinician" ? "1" : "0"); }, [location.pathname, params]);
  const changeMode = (next: typeof mode) => { setMode(next); setFeedback(""); setShow(false); };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // This preview deliberately has no auth adapter. Never read, persist or send
    // credential field values, and never pretend that a session was established.
    event.currentTarget.reset();
    setShow(false);
    setFeedback(mode === "reset" ? a.resetFeedback : mode === "signup" ? a.signupFeedback : a.unavailable);
  };
  return <main className="cin-page cin-auth-page">
    <section className="cin-auth-art" aria-label={a.eyebrow}><img src={c.media.hero} alt="" /><div className="cin-auth-art-shade" /><Brand /><div className="cin-auth-art-copy"><p className="cin-eyebrow">{a.eyebrow}</p><h2>{a.artTitle}</h2><p>{a.artBody}</p></div><p className="cin-auth-art-caption">{c.hero.footnote}</p></section>
    <section className="cin-auth-body">
      <Link to="/" className="cin-auth-back"><ArrowLeft size={17} aria-hidden="true" />{a.back}</Link>
      <div className="cin-auth-panel"><div className="cin-auth-mark"><LockKeyhole size={23} aria-hidden="true" /></div><p className="cin-eyebrow">{staff ? a.staff : a.eyebrow}</p><h1>{mode === "reset" ? a.resetTitle : mode === "signup" ? a.signupTitle : a.title}</h1><p className="cin-auth-description">{a.description}</p>
        <Tabs value={role} onValueChange={value => { setRole(value); setFeedback(""); }}><TabsList className="cin-auth-roles" aria-label={staff ? a.staff : a.patient}>{(staff ? a.staffRoles : a.roles).map((label, index) => <TabsTrigger value={String(index)} key={label}>{label}</TabsTrigger>)}</TabsList></Tabs>
        <form key={`${mode}-${role}-${staff}`} onSubmit={submit} className="cin-auth-form" aria-describedby="cin-auth-notice">
          {mode === "signup" && <label>{a.name}<input name="name" autoComplete="name" required /></label>}
          <label>{a.email}<input name="email" type="email" autoComplete="email" placeholder={a.emailPlaceholder} required /></label>
          {mode !== "reset" && <label>{a.password}<span className="cin-password-field"><input name="password" type={show ? "text" : "password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} required /><button type="button" aria-label={show ? a.hide : a.show} aria-pressed={show} onClick={() => setShow(!show)}>{show ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}</button></span></label>}
          {mode === "login" && <button type="button" className="cin-forgot" onClick={() => changeMode("reset")}>{a.forgot}</button>}
          <button type="submit" className="cin-button cin-auth-submit">{mode === "reset" ? a.resetSubmit : mode === "signup" ? a.signup : a.submit}<ArrowRight size={19} aria-hidden="true" /></button>
        </form>
        <div className="cin-auth-feedback" role="status" aria-live="polite">{feedback}</div>
        <button className="cin-auth-mode" onClick={() => changeMode(mode === "login" ? "signup" : "login")}>{mode === "login" ? a.signup : a.backToLogin}<ArrowUpRight size={16} aria-hidden="true" /></button>
        <div className="cin-auth-notice" id="cin-auth-notice"><span>{a.localBadge}</span><p>{a.notice}</p></div>
        <a href="/#workspace" className="cin-auth-sample">{a.sample}<ArrowUpRight size={16} aria-hidden="true" /></a>
      </div>
      <Link to={staff ? "/auth" : "/admin-auth"} className="cin-auth-team">{staff ? a.patient : a.staff}<ArrowUpRight size={15} aria-hidden="true" /></Link>
    </section>
  </main>;
}
