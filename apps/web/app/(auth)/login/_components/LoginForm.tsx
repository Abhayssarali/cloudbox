"use client";

import { useState, useId } from "react";
import { useAuthStore } from "@/stores/useAuthStore";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface FormState {
  email: string;
  password: string;
  rememberMe: boolean;
}

interface FormErrors {
  email?: string;
  password?: string;
  general?: string;
}

export default function LoginForm() {
  const emailId = useId();
  const passwordId = useId();
  const rememberMeId = useId();
  const setUser = useAuthStore((s: import("@/stores/useAuthStore").AuthState) => s.setUser);

  const [form, setForm] = useState<FormState>({ email: "", password: "", rememberMe: false });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<"login" | "totp">("login");
  const [tempToken, setTempToken] = useState<string>("");
  const [totpCode, setTotpCode] = useState("");
  const [accountNotFound, setAccountNotFound] = useState(false);

  function validate(): FormErrors {
    const errs: FormErrors = {};
    if (!form.email.trim()) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Enter a valid email";
    if (!form.password) errs.password = "Password is required";
    else if (form.password.length < 8) errs.password = "Password must be at least 8 characters";
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setAccountNotFound(false);
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: form.email, password: form.password }),
      });
      const data = await res.json() as { success: boolean; error?: string; errorCode?: string; data?: { requiresTotp?: boolean; tempToken?: string; user?: { id: string; email: string; role: "SUPER_ADMIN" | "ADMIN" | "USER" } } };
      if (!res.ok || !data.success) {
        if (data.errorCode === "ACCOUNT_NOT_FOUND") {
          setAccountNotFound(true);
        } else {
          setErrors({ general: data.error ?? "Invalid credentials" });
        }
        return;
      }
      
      if (data.data?.requiresTotp && data.data.tempToken) {
        setTempToken(data.data.tempToken);
        setStep("totp");
        return;
      }

      if (data.data?.user) setUser(data.data.user);
      window.location.href = "/dashboard";
    } catch {
      setErrors({ general: "Network error — check your connection and try again." });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleTotpSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!totpCode || totpCode.length !== 6) {
      setErrors({ general: "Enter a valid 6-digit code" });
      return;
    }
    setErrors({});
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/login/totp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tempToken, code: totpCode }),
      });
      const data = await res.json() as { success: boolean; error?: string; data?: { user: { id: string; email: string; role: "SUPER_ADMIN" | "ADMIN" | "USER" } } };
      if (!res.ok || !data.success) {
        setErrors({ general: data.error ?? "Invalid or expired code" });
        return;
      }
      if (data.data?.user) setUser(data.data.user);
      window.location.href = "/dashboard";
    } catch {
      setErrors({ general: "Network error — check your connection and try again." });
    } finally {
      setIsLoading(false);
    }
  }

  if (step === "totp") {
    return (
      <form onSubmit={handleTotpSubmit} noValidate id="totp-form" className="lf">
        {errors.general && (
          <div className="lf__error-banner" role="alert">
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
            {errors.general}
          </div>
        )}
        <div className="lf__group text-center mb-2">
          <h3 style={{ color: "var(--cb-text)", fontSize: "1.2rem", fontWeight: 600 }}>Two-Factor Authentication</h3>
          <p style={{ color: "var(--cb-text-subtle)", fontSize: "0.9rem", marginTop: "0.25rem" }}>Enter the 6-digit code from your authenticator app.</p>
        </div>
        <div className="lf__group">
          <input
            type="text"
            value={totpCode}
            onChange={(e) => { setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setErrors({}); }}
            className="lf__input text-center text-xl tracking-widest"
            placeholder="000000"
            disabled={isLoading}
            autoFocus
          />
        </div>
        <button type="submit" className="lf__submit" disabled={isLoading || totpCode.length !== 6}>
          {isLoading ? <><span className="lf__spinner" aria-hidden="true" />Verifying…</> : "Verify Code"}
        </button>
        <button
          type="button"
          className="lf__google-btn"
          style={{ border: "none", background: "none", marginTop: "-0.5rem" }}
          onClick={() => setStep("login")}
        >
          Cancel
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate id="login-form" className="lf">
      {errors.general && (
        <div className="lf__error-banner" role="alert">
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
          {errors.general}
        </div>
      )}

      {accountNotFound && (
        <div className="lf__info-banner" role="alert">
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" /></svg>
          <span>No account found with this email.&nbsp;<a href="/signup" className="lf__info-link">Create an account →</a></span>
        </div>
      )}

      {/* Google OAuth button */}
      <a href={`${API_URL}/auth/google`} className="lf__google-btn" id="google-signin-button">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </a>

      <div className="lf__divider"><span>or sign in with email</span></div>

      {/* Email */}
      <div className="lf__group">
        <label htmlFor={emailId} className="lf__label">Email address</label>
        <input id={emailId} type="email" autoComplete="email" value={form.email}
          onChange={(e) => { setForm((f) => ({ ...f, email: e.target.value })); if (errors.email) setErrors((er) => ({ ...er, email: undefined })); }}
          className={`lf__input ${errors.email ? "lf__input--error" : ""}`}
          placeholder="you@example.com" aria-invalid={!!errors.email} disabled={isLoading} />
        {errors.email && <p className="lf__field-error" role="alert">{errors.email}</p>}
      </div>

      {/* Password */}
      <div className="lf__group">
        <div className="lf__label-row">
          <label htmlFor={passwordId} className="lf__label">Password</label>
          <a href="/forgot-password" className="lf__forgot" id="forgot-password-link">Forgot password?</a>
        </div>
        <div className="lf__password-wrap">
          <input id={passwordId} type={showPassword ? "text" : "password"} autoComplete="current-password"
            value={form.password}
            onChange={(e) => { setForm((f) => ({ ...f, password: e.target.value })); if (errors.password) setErrors((er) => ({ ...er, password: undefined })); }}
            className={`lf__input lf__input--padded-right ${errors.password ? "lf__input--error" : ""}`}
            placeholder="••••••••" aria-invalid={!!errors.password} disabled={isLoading} />
          <button type="button" className="lf__eye" onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? "Hide password" : "Show password"} id="toggle-password-visibility">
            {showPassword ? (
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 6.862 19.5 11 19.5c4.138 0 7.774-3.162 9.066-7.5a10.477 10.477 0 00-2.046-3.777M10 12a2 2 0 100-4 2 2 0 000 4z" /><path d="M3 3l14 14" strokeLinecap="round" /></svg>
            ) : (
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path d="M10 3C6.5 3 3.5 5.5 2 10c1.5 4.5 4.5 7 8 7s6.5-2.5 8-7c-1.5-4.5-4.5-7-8-7z" /></svg>
            )}
          </button>
        </div>
        {errors.password && <p className="lf__field-error" role="alert">{errors.password}</p>}
      </div>

      {/* Remember me */}
      <div className="lf__remember">
        <input type="checkbox" id={rememberMeId} checked={form.rememberMe}
          onChange={(e) => setForm((f) => ({ ...f, rememberMe: e.target.checked }))}
          className="lf__checkbox" disabled={isLoading} />
        <label htmlFor={rememberMeId} className="lf__remember-label">Remember me for 30 days</label>
      </div>

      {/* Submit */}
      <button type="submit" className="lf__submit" disabled={isLoading} id="login-submit-button">
        {isLoading ? <><span className="lf__spinner" aria-hidden="true" />Signing in…</> : "Sign in"}
      </button>

      <style>{`
        .lf { display: flex; flex-direction: column; gap: 1.25rem; }
        .lf__error-banner { display: flex; align-items: center; gap: .5rem; padding: .75rem 1rem; background: rgba(244,63,94,.12); border: 1px solid rgba(244,63,94,.3); border-radius: 10px; color: #fb7185; font-size: .875rem; animation: fadeIn .2s ease; }
        .lf__error-banner svg { width: 1rem; height: 1rem; flex-shrink: 0; }
        .lf__info-banner { display: flex; align-items: flex-start; gap: .5rem; padding: .75rem 1rem; background: rgba(99,102,241,.1); border: 1px solid rgba(99,102,241,.3); border-radius: 10px; color: #a5b4fc; font-size: .875rem; animation: fadeIn .2s ease; }
        .lf__info-banner svg { width: 1rem; height: 1rem; flex-shrink: 0; margin-top: 1px; }
        .lf__info-link { color: #818cf8; font-weight: 600; text-decoration: underline; transition: color .15s; }
        .lf__info-link:hover { color: white; }

        /* Google button */
        .lf__google-btn { display: flex; align-items: center; justify-content: center; gap: .625rem; padding: .75rem 1rem; background: rgba(255,255,255,0.05); border: 1px solid var(--cb-border); border-radius: 10px; color: var(--cb-text); font-size: .9375rem; font-weight: 500; text-decoration: none; transition: background .15s, border-color .15s, transform .1s; }
        .lf__google-btn:hover { background: rgba(255,255,255,0.09); border-color: var(--cb-border-hover); transform: translateY(-1px); }
        .lf__google-btn:active { transform: translateY(0); }
        .lf__google-btn svg { width: 1.125rem; height: 1.125rem; flex-shrink: 0; }

        /* Divider */
        .lf__divider { display: flex; align-items: center; gap: .75rem; color: var(--cb-text-subtle); font-size: .8125rem; }
        .lf__divider::before, .lf__divider::after { content: ''; flex: 1; height: 1px; background: var(--cb-border); }

        .lf__group { display: flex; flex-direction: column; gap: .375rem; }
        .lf__label-row { display: flex; align-items: center; justify-content: space-between; }
        .lf__label { font-size: .875rem; font-weight: 500; color: var(--cb-text-muted); }
        .lf__forgot { font-size: .8125rem; color: var(--cb-primary-light); text-decoration: none; transition: color .15s; }
        .lf__forgot:hover { color: var(--cb-text); }
        .lf__input { width: 100%; padding: .75rem 1rem; background: var(--cb-surface-2); border: 1px solid var(--cb-border); border-radius: 10px; color: var(--cb-text); font-size: .9375rem; font-family: inherit; transition: border-color .15s, box-shadow .15s; outline: none; }
        .lf__input::placeholder { color: var(--cb-text-subtle); }
        .lf__input:focus { border-color: var(--cb-primary); box-shadow: 0 0 0 3px var(--cb-primary-glow); }
        .lf__input--error { border-color: #f43f5e; box-shadow: 0 0 0 3px rgba(244,63,94,.15); }
        .lf__input:disabled { opacity: .6; cursor: not-allowed; }
        .lf__input--padded-right { padding-right: 3rem; }
        .lf__password-wrap { position: relative; }
        .lf__eye { position: absolute; right: .75rem; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--cb-text-subtle); padding: .25rem; display: flex; align-items: center; justify-content: center; transition: color .15s; border-radius: 4px; }
        .lf__eye:hover { color: var(--cb-text-muted); }
        .lf__eye svg { width: 1.125rem; height: 1.125rem; }
        .lf__field-error { font-size: .8125rem; color: #fb7185; animation: fadeIn .15s ease; }
        .lf__remember { display: flex; align-items: center; gap: .625rem; }
        .lf__checkbox { width: 1rem; height: 1rem; accent-color: var(--cb-primary); cursor: pointer; }
        .lf__remember-label { font-size: .875rem; color: var(--cb-text-muted); cursor: pointer; user-select: none; }
        .lf__submit { width: 100%; padding: .8125rem 1rem; background: linear-gradient(135deg, var(--cb-primary) 0%, #4f46e5 100%); color: white; font-size: .9375rem; font-weight: 600; font-family: inherit; border: none; border-radius: 10px; cursor: pointer; transition: opacity .15s, transform .1s, box-shadow .15s; box-shadow: 0 4px 20px var(--cb-primary-glow); display: flex; align-items: center; justify-content: center; gap: .5rem; margin-top: .25rem; }
        .lf__submit:hover:not(:disabled) { opacity: .92; transform: translateY(-1px); box-shadow: 0 8px 30px var(--cb-primary-glow); }
        .lf__submit:active:not(:disabled) { transform: translateY(0); }
        .lf__submit:disabled { opacity: .7; cursor: not-allowed; }
        .lf__spinner { width: 1rem; height: 1rem; border: 2px solid rgba(255,255,255,.3); border-top-color: white; border-radius: 50%; animation: spin .7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </form>
  );
}
