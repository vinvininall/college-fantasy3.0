import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { loginUser, registerUser } from "../services/auth.js";
import { useAuth } from "../App.jsx";

export default function AuthPage({ mode }) {
  const isRegister = mode === "register";
  const { user, login, loading: checkingSession } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (checkingSession) {
    return <main className="empty-page"><p className="state-message">Checking your session...</p></main>;
  }
  if (user) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (isRegister) {
        await registerUser({ name: form.name, email: form.email, password: form.password });
        navigate("/login", { state: { registered: true } });
      } else {
        const { token, user: signedInUser } = await loginUser({ email: form.email, password: form.password });
        login(token, signedInUser);
        navigate("/dashboard");
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-aside">
        <p className="eyebrow"><span className="live-dot" /> YOUR SEAT IS WAITING</p>
        <h1>{isRegister ? <>Get in<br /><span>the game.</span></> : <>Welcome<br /><span>back.</span></>}</h1>
        <p>{isRegister ? "Join the SFL community and follow every name on the team sheet." : "The pitch is calling. Sign in to pick up where you left off."}</p>
        <div className="aside-stamp">SFL<br /><span>01 / 26</span></div>
      </section>
      <section className="auth-form-panel">
        <p className="eyebrow">{isRegister ? "CREATE YOUR ACCOUNT" : "PLAYER SIGN IN"}</p>
        <h2>{isRegister ? "Let's get you started." : "Good to have you back."}</h2>
        {!isRegister && location.state?.registered && <p className="success-message" role="status">Account created. Log in to get started.</p>}
        <form onSubmit={handleSubmit}>
          {isRegister && <label>Full name<input autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required maxLength={80} /></label>}
          <label>Email address<input type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></label>
          <label>Password<input type="password" autoComplete={isRegister ? "new-password" : "current-password"} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required minLength={isRegister ? 8 : undefined} /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button form-submit" disabled={submitting}>{submitting ? "One moment..." : isRegister ? "Create account" : "Log in"} <span aria-hidden="true">↗</span></button>
        </form>
        <p className="auth-switch">{isRegister ? "Already on the roster?" : "New to SFL Fantasy?"} <Link to={isRegister ? "/login" : "/register"}>{isRegister ? "Log in" : "Create an account"}</Link></p>
        <p className="form-note">Your password is encrypted before it is stored. We never store it on your device.</p>
      </section>
    </main>
  );
}
