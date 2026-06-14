import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ADMIN_EMAIL } from "@/components/sweet-bloom/availability";
import "@/components/sweet-bloom/auth.css";

export const Route = createFileRoute("/admin/login")({
  head: () => ({ meta: [{ title: "Manager Sign In — Selam Cake & Arts" }] }),
  component: AdminLogin,
});

type Mode = "signin" | "signup" | "change";

function AdminLogin() {
  const nav = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [pw, setPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) nav({ to: "/admin" });
    });
  }, [nav]);

  function switchMode(m: Mode) {
    setMode(m);
    setErr("");
    setOk("");
    setPw("");
    setNewPw("");
    setConfirmPw("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setOk("");
    setBusy(true);
    try {
      // CHANGE PASSWORD — must verify the existing password first
      if (mode === "change") {
        if (newPw.length < 6) {
          setErr("New password must be at least 6 characters.");
          return;
        }
        if (newPw !== confirmPw) {
          setErr("New password and confirmation do not match.");
          return;
        }
        // Step 1: re-authenticate with the current password
        const { error: verifyErr } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: pw,
        });
        if (verifyErr) {
          setErr("Current password is incorrect.");
          return;
        }
        // Step 2: set the new password
        const { error: updErr } = await supabase.auth.updateUser({ password: newPw });
        if (updErr) {
          setErr(updErr.message);
          return;
        }
        await supabase.auth.signOut();
        setOk("Password changed successfully. Please sign in with your new password.");
        switchMode("signin");
        setOk("Password changed successfully. Please sign in with your new password.");
        return;
      }

      // CREATE MANAGER ACCOUNT (first time)
      if (mode === "signup") {
        if (email.trim().toLowerCase() !== ADMIN_EMAIL) {
          setErr(`Only the manager email (${ADMIN_EMAIL}) can be registered.`);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password: pw,
          options: { emailRedirectTo: `${window.location.origin}/admin` },
        });
        if (error) {
          setErr(error.message);
          return;
        }
      }

      // SIGN IN
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: pw,
      });
      if (signInErr) {
        setErr(signInErr.message);
        return;
      }
      nav({ to: "/admin" });
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "change" ? "Change Password" : "Sign in";
  const cta =
    mode === "signin"
      ? "Login"
      : mode === "signup"
        ? "Create Account & Sign In"
        : "Update Password";

  return (
    <div className="auth-screen">
      <div className="auth-shell">
        <div className="auth-hero">
          <svg className="topo" viewBox="0 0 430 220" preserveAspectRatio="none" aria-hidden="true">
            {Array.from({ length: 9 }).map((_, i) => (
              <path
                key={i}
                d={`M-20 ${20 + i * 24} C 90 ${-10 + i * 24}, 200 ${70 + i * 18}, 320 ${20 + i * 22} S 480 ${10 + i * 20}, 470 ${40 + i * 22}`}
                fill="none"
                stroke="rgba(255,255,255,0.35)"
                strokeWidth="1.4"
              />
            ))}
          </svg>
          <div className="brand">
            <span className="dot" aria-hidden="true">🎂</span>
            <span>
              <b>Selam Cake &amp; Arts</b>
              <span>Manager Portal</span>
            </span>
          </div>
          <svg className="auth-wave" viewBox="0 0 430 60" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 30 C 80 0, 150 60, 250 35 S 400 5, 430 28 L430 60 L0 60 Z" fill="#ffffff" />
          </svg>
        </div>

        <form className="auth-body" onSubmit={submit}>
          <h1 className="auth-title">{title}</h1>

          {err && <div className="auth-error">{err}</div>}
          {ok && <div className="auth-success">{ok}</div>}

          <div className="auth-group">
            <label htmlFor="email">Email</label>
            <div className="auth-input">
              <Mail size={18} className="lead" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@selamcake.com"
                autoComplete="username"
                required
              />
            </div>
          </div>

          <div className="auth-group">
            <label htmlFor="pw">{mode === "change" ? "Current Password" : "Password"}</label>
            <div className="auth-input">
              <Lock size={18} className="lead" />
              <input
                id="pw"
                type={showPw ? "text" : "password"}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="Enter your password"
                autoComplete={mode === "change" ? "current-password" : "current-password"}
                minLength={6}
                required
              />
              <button
                type="button"
                className="toggle"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {mode === "change" && (
            <>
              <div className="auth-group">
                <label htmlFor="newpw">New Password</label>
                <div className="auth-input">
                  <Lock size={18} className="lead" />
                  <input
                    id="newpw"
                    type={showNew ? "text" : "password"}
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    placeholder="At least 6 characters"
                    autoComplete="new-password"
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    className="toggle"
                    onClick={() => setShowNew((v) => !v)}
                    aria-label={showNew ? "Hide password" : "Show password"}
                  >
                    {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div className="auth-group">
                <label htmlFor="confirmpw">Confirm New Password</label>
                <div className="auth-input">
                  <Lock size={18} className="lead" />
                  <input
                    id="confirmpw"
                    type={showNew ? "text" : "password"}
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    placeholder="Re-enter new password"
                    autoComplete="new-password"
                    minLength={6}
                    required
                  />
                </div>
              </div>
            </>
          )}

          {mode === "signin" && (
            <div className="auth-row">
              <label className="auth-remember">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                Remember Me
              </label>
              <button type="button" className="auth-link" onClick={() => switchMode("change")}>
                Change Password?
              </button>
            </div>
          )}

          <button type="submit" className="auth-btn" disabled={busy}>
            {busy ? "Please wait…" : cta}
          </button>

          <div className="auth-foot">
            {mode === "signin" && (
              <>
                First time here?{" "}
                <button type="button" className="auth-link" onClick={() => switchMode("signup")}>
                  Create the manager account
                </button>
              </>
            )}
            {mode === "signup" && (
              <>
                Already registered?{" "}
                <button type="button" className="auth-link" onClick={() => switchMode("signin")}>
                  Sign in
                </button>
              </>
            )}
            {mode === "change" && (
              <>
                Remembered it?{" "}
                <button type="button" className="auth-link" onClick={() => switchMode("signin")}>
                  Back to sign in
                </button>
              </>
            )}
          </div>

          <div className="auth-foot" style={{ marginTop: 10 }}>
            <Link to="/">← Back to shop</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
