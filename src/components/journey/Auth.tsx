import { useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowUpRight, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { journey as c } from "@/content/journey";

export default function Auth() {
  const location = useLocation();
  const [role, setRole] = useState(
    location.pathname === "/admin-auth" ? "staff" : "patient",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [message, setMessage] = useState("");
  const [invalid, setInvalid] = useState(false);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      password.length < c.auth.minimumPasswordLength
    ) {
      setInvalid(true);
      setMessage(c.auth.error);
      return;
    }
    setEmail("");
    setPassword("");
    setInvalid(false);
    setMessage(c.auth.result);
  };
  return (
    <main id="main" tabIndex={-1} className="jy-auth jy-inner">
      <section className="jy-auth-art">
        <img src={c.media.poster} alt={c.media.alt} />
        <div>
          <p className="jy-eyebrow">{c.tagline}</p>
          <h1>{c.auth.title}</h1>
          <p>{c.auth.body}</p>
        </div>
      </section>
      <section className="jy-auth-panel">
        <p className="jy-eyebrow">{c.auth.eyebrow}</p>
        <h2>{c.navigation.login}</h2>
        <p className="jy-local-notice">
          <ShieldCheck size={21} />
          {c.auth.notice}
        </p>
        <div className="jy-auth-roles" aria-label={c.labels.loginRole}>
          {c.explore.roles.map((item) => (
            <button
              key={item.id}
              aria-pressed={role === item.id}
              onClick={() => {
                setRole(item.id);
                setEmail("");
                setPassword("");
                setMessage("");
                setInvalid(false);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        {role === "staff" && <p className="jy-input-hint">{c.auth.invite}</p>}
        <form noValidate onSubmit={submit}>
          <label htmlFor="demo-email">{c.auth.email}</label>
          <input
            id="demo-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={c.auth.emailPlaceholder}
            autoComplete="off"
            aria-invalid={invalid}
            aria-describedby="auth-message"
          />
          <label htmlFor="demo-password">{c.auth.password}</label>
          <div className="jy-password">
            <input
              id="demo-password"
              type={show ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={c.auth.passwordPlaceholder}
              autoComplete="off"
              aria-invalid={invalid}
              aria-describedby="auth-message"
            />
            <button
              type="button"
              aria-label={show ? c.auth.hide : c.auth.show}
              onClick={() => setShow((value) => !value)}
            >
              {show ? <EyeOff /> : <Eye />}
            </button>
          </div>
          <button
            type="button"
            className="jy-text-link jy-reset-link"
            onClick={() => {
              setEmail("");
              setPassword("");
              setMessage(c.auth.resetNotice);
              setInvalid(false);
            }}
          >
            {c.auth.forgot}
          </button>
          <button className="jy-button" type="submit">
            {c.auth.submit}
            <ArrowUpRight size={20} />
          </button>
          <p
            id="auth-message"
            className={invalid ? "jy-error" : "jy-form-message"}
            role="status"
          >
            {message}
          </p>
        </form>
        <div className="jy-auth-demo">
          <span>{c.auth.signup}</span>
          <Link className="jy-text-link" to={`/demo/${role}`}>
            {c.auth.signupAction}
            <ArrowUpRight size={20} />
          </Link>
        </div>
      </section>
    </main>
  );
}
