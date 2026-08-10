"use client";

import { useState, useId, useRef, useEffect, useCallback } from "react";
import { useAuthStore } from "@/stores/useAuthStore";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type Mode = "choose" | "join" | "create";
type Step = "form" | "verify";

interface FormErrors {
  email?: string;
  password?: string;
  confirm?: string;
  workspace?: string;
  inviteCode?: string;
  general?: string;
}

export default function SignupForm() {
  const emailId = useId();
  const passwordId = useId();
  const confirmId = useId();
  const workspaceId = useId();
  const inviteId = useId();
  const setUser = useAuthStore((s: import("@/stores/useAuthStore").AuthState) => s.setUser);

  const [mode, setMode] = useState<Mode>("choose");
  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  // OTP verification state
  const [pendingUserId, setPendingUserId] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  function validate(): FormErrors {
    const errs: FormErrors = {};
    if (!email.trim()) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Enter a valid email";
    if (!password) errs.password = "Password is required";
    else if (password.length < 8) errs.password = "At least 8 characters";
    if (!confirm) errs.confirm = "Please confirm your password";
    else if (confirm !== password) errs.confirm = "Passwords do not match";
    if (mode === "create" && !workspaceName.trim()) errs.workspace = "Workspace name is required";
    if (mode === "join" && !inviteCode.trim()) errs.inviteCode = "Invite code is required";
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setIsLoading(true);

    try {
      const body: Record<string, string> = { email, password };
      if (mode === "create") body["workspaceName"] = workspaceName;
      if (mode === "join") body["inviteCode"] = inviteCode;

      const res = await fetch(`${API_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const data = await res.json() as {
        success: boolean;
        error?: string;
        data?: {
          requiresVerification?: boolean;
          userId?: string;
          email?: string;
          user?: { id: string; email: string; role: "SUPER_ADMIN" | "ADMIN" | "USER" };
          workspace?: { id: string; name: string; inviteCode?: string };
        };
      };

      if (!res.ok || !data.success) {
        setErrors({ general: data.error ?? "Signup failed. Please try again." });
        return;
      }

      // Check if email verification is required
      if (data.data?.requiresVerification && data.data.userId) {
        setPendingUserId(data.data.userId);
        setPendingEmail(data.data.email ?? email);
        setStep("verify");
        setResendCooldown(60);
        return;
      }

      // Fallback: direct login (Google OAuth, etc.)
      if (data.data?.user) setUser(data.data.user);
      window.location.href = "/dashboard";
    } catch {
      setErrors({ general: "Network error — check your connection." });
    } finally {
      setIsLoading(false);
    }
  }

  // ── OTP handlers ──────────────────────────────────────────────────────────

  const handleOtpChange = useCallback((index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // only digits
    const newDigits = [...otpDigits];
    newDigits[index] = value.slice(-1); // only last char
    setOtpDigits(newDigits);
    setOtpError("");

    // Auto-advance to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }, [otpDigits]);

  const handleOtpKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }, [otpDigits]);

  const handleOtpPaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 0) return;
    const newDigits = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] || "";
    }
    setOtpDigits(newDigits);
    setOtpError("");
    // Focus last filled input
    const lastIndex = Math.min(pasted.length, 6) - 1;
    inputRefs.current[lastIndex]?.focus();
  }, [otpDigits]);

  async function handleVerify() {
    const code = otpDigits.join("");
    if (code.length !== 6) {
      setOtpError("Please enter all 6 digits");
      return;
    }

    setIsVerifying(true);
    setOtpError("");

    try {
      const res = await fetch(`${API_URL}/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId: pendingUserId, code }),
      });

      const data = await res.json() as {
        success: boolean;
        error?: string;
        data?: { user?: { id: string; email: string; role: "SUPER_ADMIN" | "ADMIN" | "USER" } };
      };

      if (!res.ok || !data.success) {
        setOtpError(data.error ?? "Verification failed. Please try again.");
        setOtpDigits(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
        return;
      }

      if (data.data?.user) setUser(data.data.user);
      window.location.href = "/dashboard";
    } catch {
      setOtpError("Network error — check your connection.");
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleResendOtp() {
    if (resendCooldown > 0) return;
    setResendCooldown(60);
    setOtpError("");

    try {
      await fetch(`${API_URL}/auth/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId: pendingUserId }),
      });
    } catch {
      // Silently fail — cooldown will still run
    }
  }

  // Auto-submit when all 6 digits are filled
  useEffect(() => {
    if (step === "verify" && otpDigits.every((d) => d !== "") && !isVerifying) {
      handleVerify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otpDigits, step]);

  // ── OTP Verification Screen ───────────────────────────────────────────────
  if (step === "verify") {
    return (
      <div className="otp-verify">
        <div className="otp-verify__icon">✉️</div>
        <h3 className="otp-verify__title">Check your email</h3>
        <p className="otp-verify__subtitle">
          We sent a 6-digit code to <strong>{pendingEmail}</strong>
        </p>

        <div className="otp-verify__inputs" onPaste={handleOtpPaste}>
          {otpDigits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleOtpChange(i, e.target.value)}
              onKeyDown={(e) => handleOtpKeyDown(i, e)}
              className={`otp-verify__digit ${otpError ? "otp-verify__digit--error" : ""}`}
              disabled={isVerifying}
              autoFocus={i === 0}
              aria-label={`Digit ${i + 1}`}
            />
          ))}
        </div>

        {otpError && (
          <div className="otp-verify__error" role="alert">
            <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
            {otpError}
          </div>
        )}

        {isVerifying && (
          <div className="otp-verify__verifying">
            <span className="sf__spinner" aria-hidden="true" /> Verifying…
          </div>
        )}

        <button
          type="button"
          className="otp-verify__verify-btn"
          onClick={handleVerify}
          disabled={isVerifying || otpDigits.some((d) => !d)}
        >
          {isVerifying ? (
            <><span className="sf__spinner" aria-hidden="true" /> Verifying…</>
          ) : (
            "Verify email"
          )}
        </button>

        <div className="otp-verify__resend">
          <span className="otp-verify__resend-text">Didn&apos;t receive the code?</span>
          {resendCooldown > 0 ? (
            <span className="otp-verify__cooldown">Resend in {resendCooldown}s</span>
          ) : (
            <button type="button" className="otp-verify__resend-btn" onClick={handleResendOtp}>
              Resend code
            </button>
          )}
        </div>

        <button
          type="button"
          className="otp-verify__back"
          onClick={() => { setStep("form"); setOtpDigits(["", "", "", "", "", ""]); setOtpError(""); }}
        >
          ← Back to signup
        </button>

        <style>{`
          .otp-verify { display: flex; flex-direction: column; align-items: center; gap: 1rem; text-align: center; }
          .otp-verify__icon { font-size: 3rem; margin-bottom: .25rem; animation: otpBounce .6s ease; }
          @keyframes otpBounce { 0% { transform: scale(0.5); opacity: 0; } 50% { transform: scale(1.15); } 100% { transform: scale(1); opacity: 1; } }
          .otp-verify__title { font-size: 1.375rem; font-weight: 700; color: var(--cb-text); margin: 0; }
          .otp-verify__subtitle { font-size: .9375rem; color: var(--cb-text-muted); margin: 0; line-height: 1.5; }
          .otp-verify__subtitle strong { color: var(--cb-text); font-weight: 600; }
          .otp-verify__inputs { display: flex; gap: .5rem; margin: .75rem 0; }
          .otp-verify__digit { width: 3rem; height: 3.5rem; text-align: center; font-size: 1.5rem; font-weight: 700; font-family: 'Courier New', monospace; color: var(--cb-text); background: var(--cb-surface-2); border: 1.5px solid var(--cb-border); border-radius: 10px; outline: none; transition: border-color .15s, box-shadow .15s; caret-color: var(--cb-primary); }
          .otp-verify__digit:focus { border-color: var(--cb-primary); box-shadow: 0 0 0 3px var(--cb-primary-glow); }
          .otp-verify__digit--error { border-color: #f43f5e; box-shadow: 0 0 0 3px rgba(244,63,94,.15); animation: otpShake .4s ease; }
          @keyframes otpShake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
          .otp-verify__digit:disabled { opacity: .6; cursor: not-allowed; }
          .otp-verify__error { display: flex; align-items: center; gap: .375rem; padding: .5rem .75rem; background: rgba(244,63,94,.12); border: 1px solid rgba(244,63,94,.3); border-radius: 8px; color: #fb7185; font-size: .8125rem; width: 100%; }
          .otp-verify__error svg { width: .875rem; height: .875rem; flex-shrink: 0; }
          .otp-verify__verifying { display: flex; align-items: center; gap: .5rem; color: var(--cb-text-muted); font-size: .875rem; }
          .otp-verify__verify-btn { width: 100%; padding: .8125rem 1rem; background: linear-gradient(135deg, var(--cb-primary) 0%, #4f46e5 100%); color: white; font-size: .9375rem; font-weight: 600; font-family: inherit; border: none; border-radius: 10px; cursor: pointer; transition: opacity .15s, transform .1s, box-shadow .15s; box-shadow: 0 4px 20px var(--cb-primary-glow); display: flex; align-items: center; justify-content: center; gap: .5rem; }
          .otp-verify__verify-btn:hover:not(:disabled) { opacity: .92; transform: translateY(-1px); }
          .otp-verify__verify-btn:disabled { opacity: .7; cursor: not-allowed; }
          .otp-verify__resend { display: flex; align-items: center; gap: .5rem; font-size: .8125rem; color: var(--cb-text-subtle); }
          .otp-verify__cooldown { color: var(--cb-text-subtle); font-variant-numeric: tabular-nums; }
          .otp-verify__resend-btn { background: none; border: none; color: var(--cb-primary-light); font-size: .8125rem; font-weight: 600; cursor: pointer; padding: 0; transition: color .15s; text-decoration: underline; }
          .otp-verify__resend-btn:hover { color: var(--cb-text); }
          .otp-verify__resend-text { color: var(--cb-text-subtle); }
          .otp-verify__back { background: none; border: none; color: var(--cb-text-muted); font-size: .875rem; cursor: pointer; padding: .25rem 0; transition: color .15s; }
          .otp-verify__back:hover { color: var(--cb-text); }
        `}</style>
      </div>
    );
  }

  // ── Mode selection card ──────────────────────────────────────────────────
  if (mode === "choose") {
    return (
      <div className="sf-choose">
        <p className="sf-choose__heading">How would you like to get started?</p>
        <div className="sf-choose__cards">
          <button id="choose-create" className="sf-choose__card" onClick={() => setMode("create")}>
            <div className="sf-choose__icon">🏢</div>
            <div className="sf-choose__card-title">Create a workspace</div>
            <div className="sf-choose__card-sub">
              Set up your own storage workspace and invite your team.
            </div>
            <div className="sf-choose__badge sf-choose__badge--admin">Admin account</div>
          </button>

          <button id="choose-join" className="sf-choose__card" onClick={() => setMode("join")}>
            <div className="sf-choose__icon">🔗</div>
            <div className="sf-choose__card-title">Join a workspace</div>
            <div className="sf-choose__card-sub">
              Enter an invite code from your admin to join their workspace.
            </div>
            <div className="sf-choose__badge sf-choose__badge--user">Member account</div>
          </button>
        </div>

        <style>{`
          .sf-choose { display: flex; flex-direction: column; gap: 1.25rem; }
          .sf-choose__heading { text-align: center; color: var(--cb-text-muted); font-size: .9375rem; margin: 0; }
          .sf-choose__cards { display: grid; grid-template-columns: 1fr 1fr; gap: .875rem; }
          @media (max-width: 480px) { .sf-choose__cards { grid-template-columns: 1fr; } }
          .sf-choose__card { background: var(--cb-surface-2, rgba(255,255,255,.04)); border: 1px solid var(--cb-border); border-radius: 14px; padding: 1.5rem 1.125rem; text-align: center; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: .5rem; transition: border-color .2s, background .2s, transform .15s; }
          .sf-choose__card:hover { border-color: rgba(99,102,241,.5); background: rgba(99,102,241,.06); transform: translateY(-2px); }
          .sf-choose__icon { font-size: 2rem; line-height: 1; }
          .sf-choose__card-title { font-size: 1rem; font-weight: 600; color: var(--cb-text); margin: .25rem 0 0; }
          .sf-choose__card-sub { font-size: .8125rem; color: var(--cb-text-muted); line-height: 1.5; }
          .sf-choose__badge { font-size: .6875rem; font-weight: 700; letter-spacing: .04em; padding: .25rem .625rem; border-radius: 99px; margin-top: .25rem; }
          .sf-choose__badge--admin { background: rgba(139,92,246,.15); color: #a78bfa; border: 1px solid rgba(139,92,246,.3); }
          .sf-choose__badge--user { background: rgba(34,197,94,.1); color: #4ade80; border: 1px solid rgba(34,197,94,.25); }
        `}</style>
      </div>
    );
  }

  // ── Shared form ──────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} noValidate id="signup-form" className="sf">
      {/* Back button */}
      <button type="button" className="sf__back" onClick={() => { setMode("choose"); setErrors({}); }}>
        ← {mode === "create" ? "Create a workspace" : "Join a workspace"}
      </button>

      {errors.general && (
        <div className="sf__error-banner" role="alert">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
          {errors.general}
        </div>
      )}

      {/* Workspace name field (create mode) */}
      {mode === "create" && (
        <div className="sf__group">
          <label htmlFor={workspaceId} className="sf__label">Workspace name</label>
          <input id={workspaceId} type="text" autoComplete="organization"
            value={workspaceName}
            onChange={(e) => { setWorkspaceName(e.target.value); if (errors.workspace) setErrors((er) => ({ ...er, workspace: undefined })); }}
            className={`sf__input ${errors.workspace ? "sf__input--error" : ""}`}
            placeholder="e.g. Acme Corp" disabled={isLoading} />
          {errors.workspace && <p className="sf__field-error" role="alert">{errors.workspace}</p>}
          <p className="sf__hint">Your team members will use your invite code to join this workspace.</p>
        </div>
      )}

      {/* Invite code field (join mode) */}
      {mode === "join" && (
        <div className="sf__group">
          <label htmlFor={inviteId} className="sf__label">Invite code</label>
          <input id={inviteId} type="text" autoComplete="off"
            value={inviteCode}
            onChange={(e) => { setInviteCode(e.target.value.trim()); if (errors.inviteCode) setErrors((er) => ({ ...er, inviteCode: undefined })); }}
            className={`sf__input sf__input--mono ${errors.inviteCode ? "sf__input--error" : ""}`}
            placeholder="Paste code from your admin" disabled={isLoading} />
          {errors.inviteCode && <p className="sf__field-error" role="alert">{errors.inviteCode}</p>}
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

      <div className="sf__divider"><span>or continue with email</span></div>

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
        {isLoading
          ? <><span className="sf__spinner" aria-hidden="true" />{mode === "create" ? "Creating workspace…" : "Joining workspace…"}</>
          : mode === "create" ? "Create workspace" : "Join workspace"}
      </button>

      <style>{`
        .sf { display: flex; flex-direction: column; gap: 1.25rem; }
        .sf__back { background: none; border: none; color: var(--cb-text-muted); font-size: .9375rem; font-weight: 600; cursor: pointer; text-align: left; padding: 0; display: flex; align-items: center; gap: .375rem; transition: color .15s; }
        .sf__back:hover { color: var(--cb-text); }
        .sf__error-banner { display: flex; align-items: center; gap: .5rem; padding: .75rem 1rem; background: rgba(244,63,94,.12); border: 1px solid rgba(244,63,94,.3); border-radius: 10px; color: #fb7185; font-size: .875rem; }
        .sf__error-banner svg { width: 1rem; height: 1rem; flex-shrink: 0; }
        .sf__google-btn { display: flex; align-items: center; justify-content: center; gap: .625rem; padding: .75rem 1rem; background: rgba(255,255,255,.05); border: 1px solid var(--cb-border); border-radius: 10px; color: var(--cb-text); font-size: .9375rem; font-weight: 500; text-decoration: none; transition: background .15s, border-color .15s, transform .1s; }
        .sf__google-btn:hover { background: rgba(255,255,255,.09); border-color: var(--cb-border-hover); transform: translateY(-1px); }
        .sf__google-btn svg { width: 1.125rem; height: 1.125rem; }
        .sf__divider { display: flex; align-items: center; gap: .75rem; color: var(--cb-text-subtle); font-size: .8125rem; }
        .sf__divider::before, .sf__divider::after { content: ''; flex: 1; height: 1px; background: var(--cb-border); }
        .sf__group { display: flex; flex-direction: column; gap: .375rem; }
        .sf__label { font-size: .875rem; font-weight: 500; color: var(--cb-text-muted); }
        .sf__input { width: 100%; padding: .75rem 1rem; background: var(--cb-surface-2); border: 1px solid var(--cb-border); border-radius: 10px; color: var(--cb-text); font-size: .9375rem; font-family: inherit; outline: none; transition: border-color .15s, box-shadow .15s; box-sizing: border-box; }
        .sf__input--mono { font-family: monospace; letter-spacing: .05em; }
        .sf__input::placeholder { color: var(--cb-text-subtle); }
        .sf__input:focus { border-color: var(--cb-primary); box-shadow: 0 0 0 3px var(--cb-primary-glow); }
        .sf__input--error { border-color: #f43f5e; box-shadow: 0 0 0 3px rgba(244,63,94,.15); }
        .sf__input:disabled { opacity: .6; cursor: not-allowed; }
        .sf__input--padded-right { padding-right: 3rem; }
        .sf__password-wrap { position: relative; }
        .sf__eye { position: absolute; right: .75rem; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--cb-text-subtle); padding: .25rem; display: flex; align-items: center; border-radius: 4px; }
        .sf__eye svg { width: 1.125rem; height: 1.125rem; }
        .sf__field-error { font-size: .8125rem; color: #fb7185; }
        .sf__hint { font-size: .8125rem; color: var(--cb-text-subtle); margin: .125rem 0 0; }
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
