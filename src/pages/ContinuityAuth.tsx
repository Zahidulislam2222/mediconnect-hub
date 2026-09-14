import { useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { continuity as c, type CareRole } from "@/content/continuity";
import { Brand, Portrait } from "@/components/continuity/Primitives";

export default function ContinuityAuth() {
  const location = useLocation();
  const [role, setRole] = useState<CareRole>(
    location.pathname === "/admin-auth" ? "staff" : "patient",
  );
  const [mode, setMode] = useState<"login" | "reset" | "signup">("login");
  const [show, setShow] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [formKey, setFormKey] = useState(0);
  const changeMode = (next: typeof mode) => {
    setMode(next);
    setShow(false);
    setFeedback("");
    setFormKey((value) => value + 1);
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.currentTarget.reset();
    setShow(false);
    setFeedback(mode === "reset" ? c.auth.resetFeedback : c.auth.feedback);
  };
  return (
    <div className="ct-auth">
      <aside className="ct-auth-art">
        <Brand />
        <Portrait />
        <div className="ct-auth-art-copy">
          <p className="ct-eyebrow">{c.auth.eyebrow}</p>
          <h2>{c.auth.quote}</h2>
          <p>{c.auth.quoteCaption}</p>
        </div>
        <small>{c.hero.mediaLabel}</small>
      </aside>
      <div className="ct-auth-main">
        <Link to="/" className="ct-back-button">
          <ArrowLeft size={16} />
          {c.navigation.home}
        </Link>
        <main id="main" tabIndex={-1} className="ct-auth-form">
          <p className="ct-eyebrow">{c.auth.eyebrow}</p>
          <h1>
            {mode === "login"
              ? c.auth.title
              : mode === "reset"
                ? c.auth.resetTitle
                : c.auth.signupTitle}
          </h1>
          <p className="ct-auth-description">{c.auth.description}</p>
          <div
            className="ct-auth-roles"
            role="group"
            aria-label={c.navigation.workspace}
          >
            {c.workspace.roles.map((item) => (
              <button
                key={item.id}
                aria-pressed={role === item.id}
                onClick={() => {
                  setRole(item.id as CareRole);
                  changeMode("login");
                }}
              >
                {item.name}
              </button>
            ))}
          </div>
          <p className="ct-offline-notice" id="auth-notice">
            <Info size={18} />
            {c.auth.notice}
          </p>
          <form
            key={formKey}
            onSubmit={submit}
            aria-describedby="auth-notice"
            autoComplete="off"
          >
            {mode === "signup" && (
              <label>
                {c.auth.name}
                <input
                  name="name"
                  required
                  maxLength={c.authValidation.nameMax}
                  autoComplete="off"
                />
              </label>
            )}
            <label>
              {c.auth.email}
              <input
                name="email"
                type="email"
                required
                maxLength={c.authValidation.emailMax}
                autoComplete="off"
              />
            </label>
            {mode !== "reset" && (
              <label>
                {c.auth.password}
                <span className="ct-password-input">
                  <input
                    name="password"
                    type={show ? "text" : "password"}
                    required
                    minLength={c.authValidation.passwordMin}
                    maxLength={c.authValidation.passwordMax}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    aria-label={show ? c.auth.hide : c.auth.show}
                    onClick={() => setShow((value) => !value)}
                  >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </span>
              </label>
            )}
            {mode === "login" && (
              <button
                className="ct-forgot"
                type="button"
                onClick={() => changeMode("reset")}
              >
                {c.auth.forgot}
              </button>
            )}
            <Button className="ct-action ct-full" type="submit">
              {mode === "login"
                ? c.auth.submit
                : mode === "reset"
                  ? c.auth.reset
                  : c.auth.signup}
              <ArrowRight size={17} />
            </Button>
          </form>
          <p role="status" className="ct-auth-feedback">
            {feedback}
          </p>
          {mode === "login" ? (
            role === "patient" ? (
              <button
                className="ct-auth-alternate"
                onClick={() => changeMode("signup")}
              >
                {c.auth.create}
                <ArrowRight size={15} />
              </button>
            ) : (
              <p className="ct-auth-invitation">
                {role === "staff" ? c.auth.staffNote : c.auth.clinicianNote}
              </p>
            )
          ) : (
            <button
              className="ct-auth-alternate"
              onClick={() => changeMode("login")}
            >
              <ArrowLeft size={15} />
              {c.auth.back}
            </button>
          )}
          <Link className="ct-auth-demo" to={`/demo/${role}`}>
            {c.auth.demo}
            <ArrowRight size={16} />
          </Link>
        </main>
        <p className="ct-auth-legal">{c.notice}</p>
      </div>
    </div>
  );
}
