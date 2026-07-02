"use client";

import { useState, useId } from "react";
import { useAuthStore } from "@/stores/useAuthStore";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface FormErrors {
  email?: string;
  password?: string;
  confirm?: string;
  general?: string;
}

export default function SignupForm() {
  const emailId = useId();
  const passwordId = useId();
  const confirmId = useId();
  const setUser = useAuthStore((s: import("@/stores/useAuthStore").AuthState) => s.setUser);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  function validate(): FormErrors {
    const errs: FormErrors = {};
    if (!email.trim()) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Enter a valid email";
    if (!password) errs.password = "Password is required";
    else if (password.length < 8) errs.password = "At least 8 characters";
    if (!confirm) errs.confirm = "Please confirm your password";
    else if (confirm !== password) errs.confirm = "Passwords do not match";
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json() as { success: boolean; error?: string; data?: { user: { id: string; email: string; role: "SUPER_ADMIN" | "ADMIN" | "USER" } } };
      if (!res.ok || !data.success) {
        setErrors({ general: data.error ?? "Signup failed. Please try again." });
        return;
      }
      if (data.data?.user) setUser(data.data.user);
      window.location.href = "/dashboard";
    } catch {
      setErrors({ general: "Network error — check your connection." });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate id="signup-form" className="sf">
      {errors.general && (
        <div className="sf__error-banner" role="alert">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
          {errors.general}
        </div>
      )}

      {/* Google button */}
      <a href={`${API_URL}/auth/google`} className="sf__google-btn" id="google-signup-button">
        <svg viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </a>

      <div className="sf__divider"><span>or create account with email</span></div>

      {/* Email */}
      <div className="sf__group">
        <label htmlFor={emailId} className="sf__label">Email address</label>
        <input id={emailId} type="email" autoComplete="email" value={email}
          onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors((er) => ({ ...er, email: undefined })); }}
          className={`sf__input ${errors.email ? "sf__input--error" : ""}`}
          placeholder="you@example.com" disabled={isLoading} />
        {errors.email && <p className="sf__field-error" role="alert">{errors.email}</p>}
      </div>

      {/* Password */}
      <div className="sf__group">
        <label htmlFor={passwordId} className="sf__label">Password</label>
        <div className="sf__password-wrap">
          <input id={passwordId} type={showPw ? "text" : "password"} autoComplete="new-password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors((er) => ({ ...er, password: undefined })); }}
            className={`sf__input sf__input--padded-right ${errors.password ? "sf__input--error" : ""}`}
            placeholder="Min 8 characters" disabled={isLoading} />
          <button type="button" className="sf__eye" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? "Hide" : "Show"}>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path d="M10 3C6.5 3 3.5 5.5 2 10c1.5 4.5 4.5 7 8 7s6.5-2.5 8-7c-1.5-4.5-4.5-7-8-7z" /></svg>
          </button>
        </div>
        {errors.password && <p className="sf__field-error" role="alert">{errors.password}</p>}
        {/* Strength hint */}
        {password.length > 0 && (
          <div className="sf__strength">
            {[...Array(4)].map((_, i) => (
              <div key={i} className={`sf__strength-bar ${i < Math.min(Math.floor(password.length / 3), 4) ? "sf__strength-bar--fill" : ""}`} />
            ))}
            <span className="sf__strength-label">{password.length < 8 ? "Too short" : password.length < 12 ? "Good" : "Strong"}</span>
          </div>
        )}
      </div>

      {/* Confirm password */}
      <div className="sf__group">
        <label htmlFor={confirmId} className="sf__label">Confirm password</label>
        <input id={confirmId} type={showPw ? "text" : "password"} autoComplete="new-password"
          value={confirm}
          onChange={(e) => { setConfirm(e.target.value); if (errors.confirm) setErrors((er) => ({ ...er, confirm: undefined })); }}
          className={`sf__input ${errors.confirm ? "sf__input--error" : ""}`}
          placeholder="Repeat your password" disabled={isLoading} />
        {errors.confirm && <p className="sf__field-error" role="alert">{errors.confirm}</p>}
      </div>

      <button type="submit" className="sf__submit" disabled={isLoading} id="signup-submit-button">
        {isLoading ? <><span className="sf__spinner" aria-hidden="true" />Creating account…</> : "Create account"}
      </button>

      <style>{`
        .sf { display: flex; flex-direction: column; gap: 1.25rem; }
        .sf__error-banner { display: flex; align-items: center; gap: .5rem; padding: .75rem 1rem; background: rgba(244,63,94,.12); border: 1px solid rgba(244,63,94,.3); border-radius: 10px; color: #fb7185; font-size: .875rem; }
        .sf__error-banner svg { width: 1rem; height: 1rem; flex-shrink: 0; }
        .sf__google-btn { display: flex; align-items: center; justify-content: center; gap: .625rem; padding: .75rem 1rem; background: rgba(255,255,255,.05); border: 1px solid var(--cb-border); border-radius: 10px; color: var(--cb-text); font-size: .9375rem; font-weight: 500; text-decoration: none; transition: background .15s, border-color .15s, transform .1s; }
        .sf__google-btn:hover { background: rgba(255,255,255,.09); border-color: var(--cb-border-hover); transform: translateY(-1px); }
        .sf__google-btn svg { width: 1.125rem; height: 1.125rem; }
        .sf__divider { display: flex; align-items: center; gap: .75rem; color: var(--cb-text-subtle); font-size: .8125rem; }
        .sf__divider::before, .sf__divider::after { content: ''; flex: 1; height: 1px; background: var(--cb-border); }
        .sf__group { display: flex; flex-direction: column; gap: .375rem; }
        .sf__label { font-size: .875rem; font-weight: 500; color: var(--cb-text-muted); }
        .sf__input { width: 100%; padding: .75rem 1rem; background: var(--cb-surface-2); border: 1px solid var(--cb-border); border-radius: 10px; color: var(--cb-text); font-size: .9375rem; font-family: inherit; outline: none; transition: border-color .15s, box-shadow .15s; }
        .sf__input::placeholder { color: var(--cb-text-subtle); }
        .sf__input:focus { border-color: var(--cb-primary); box-shadow: 0 0 0 3px var(--cb-primary-glow); }
        .sf__input--error { border-color: #f43f5e; box-shadow: 0 0 0 3px rgba(244,63,94,.15); }
        .sf__input:disabled { opacity: .6; cursor: not-allowed; }
        .sf__input--padded-right { padding-right: 3rem; }
        .sf__password-wrap { position: relative; }
        .sf__eye { position: absolute; right: .75rem; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--cb-text-subtle); padding: .25rem; display: flex; align-items: center; border-radius: 4px; }
        .sf__eye svg { width: 1.125rem; height: 1.125rem; }
        .sf__field-error { font-size: .8125rem; color: #fb7185; }
        .sf__strength { display: flex; align-items: center; gap: .375rem; margin-top: .25rem; }
        .sf__strength-bar { flex: 1; height: 3px; border-radius: 99px; background: var(--cb-border); transition: background .2s; }
        .sf__strength-bar--fill { background: var(--cb-primary); }
        .sf__strength-label { font-size: .75rem; color: var(--cb-text-subtle); white-space: nowrap; }
        .sf__submit { width: 100%; padding: .8125rem 1rem; background: linear-gradient(135deg, var(--cb-primary) 0%, #4f46e5 100%); color: white; font-size: .9375rem; font-weight: 600; font-family: inherit; border: none; border-radius: 10px; cursor: pointer; transition: opacity .15s, transform .1s, box-shadow .15s; box-shadow: 0 4px 20px var(--cb-primary-glow); display: flex; align-items: center; justify-content: center; gap: .5rem; }
        .sf__submit:hover:not(:disabled) { opacity: .92; transform: translateY(-1px); }
        .sf__submit:disabled { opacity: .7; cursor: not-allowed; }
        .sf__spinner { width: 1rem; height: 1rem; border: 2px solid rgba(255,255,255,.3); border-top-color: white; border-radius: 50%; animation: spin .7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </form>
  );
}
