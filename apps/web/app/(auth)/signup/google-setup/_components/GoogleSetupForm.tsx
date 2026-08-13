"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/useAuthStore";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type Mode = "choose" | "create" | "join";

export default function GoogleSetupForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const setUser = useAuthStore((s: import("@/stores/useAuthStore").AuthState) => s.setUser);

  const [mode, setMode] = useState<Mode>("choose");
  const [workspaceName, setWorkspaceName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [wsError, setWsError] = useState("");
  const [inviteError, setInviteError] = useState("");

  // Redirect to signup if no token
  useEffect(() => {
    if (!token) {
      router.replace("/signup?error=google_setup_missing");
    }
  }, [token, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setWsError("");
    setInviteError("");

    if (mode === "create" && !workspaceName.trim()) {
      setWsError("Workspace name is required");
      return;
    }
    if (mode === "join" && !inviteCode.trim()) {
      setInviteError("Invite code is required");
      return;
    }

    setIsLoading(true);
    try {
      const body: Record<string, string> = { token: token!, mode };
      if (mode === "create") body["workspaceName"] = workspaceName.trim();
      if (mode === "join") body["inviteCode"] = inviteCode.trim();

      const res = await fetch(`${API_URL}/auth/google/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const data = await res.json() as {
        success: boolean;
        error?: string;
        errorCode?: string;
        data?: { user?: { id: string; email: string; role: "SUPER_ADMIN" | "ADMIN" | "USER" } };
      };

      if (!res.ok || !data.success) {
        if (data.errorCode === "TOKEN_EXPIRED") {
          router.replace("/signup?error=google_session_expired");
          return;
        }
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      if (data.data?.user) setUser(data.data.user);
      window.location.href = "/dashboard";
    } catch {
      setError("Network error — check your connection.");
    } finally {
      setIsLoading(false);
    }
  }

  if (!token) return null;

  // ── Workspace type chooser ────────────────────────────────────────────────
  if (mode === "choose") {
    return (
      <div className="gs">
        <div className="gs__header">
          <div className="gs__google-badge">
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span>Signed in with Google</span>
          </div>
          <h2 className="gs__title">Almost there!</h2>
          <p className="gs__subtitle">How would you like to use CloudBox?</p>
        </div>

        <div className="gs__cards">
          <button id="gs-create" className="gs__card" onClick={() => setMode("create")}>
            <div className="gs__icon">🏢</div>
            <div className="gs__card-title">Create a workspace</div>
            <div className="gs__card-sub">Set up your own storage workspace and invite your team.</div>
            <div className="gs__badge gs__badge--admin">Admin account</div>
          </button>

          <button id="gs-join" className="gs__card" onClick={() => setMode("join")}>
            <div className="gs__icon">🔗</div>
            <div className="gs__card-title">Join a workspace</div>
            <div className="gs__card-sub">Enter an invite code from your admin to join their workspace.</div>
            <div className="gs__badge gs__badge--user">Member account</div>
          </button>
        </div>

        <style>{`
          .gs { display: flex; flex-direction: column; gap: 1.5rem; }
          .gs__header { text-align: center; display: flex; flex-direction: column; align-items: center; gap: .5rem; }
          .gs__google-badge { display: flex; align-items: center; gap: .5rem; background: rgba(255,255,255,.05); border: 1px solid var(--cb-border); border-radius: 99px; padding: .375rem .875rem; font-size: .8125rem; color: var(--cb-text-muted); }
          .gs__title { font-size: 1.375rem; font-weight: 700; color: var(--cb-text); margin: .25rem 0 0; }
          .gs__subtitle { font-size: .9375rem; color: var(--cb-text-muted); margin: 0; }
          .gs__cards { display: grid; grid-template-columns: 1fr 1fr; gap: .875rem; }
          @media (max-width: 480px) { .gs__cards { grid-template-columns: 1fr; } }
          .gs__card { background: var(--cb-surface-2, rgba(255,255,255,.04)); border: 1px solid var(--cb-border); border-radius: 14px; padding: 1.5rem 1.125rem; text-align: center; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: .5rem; transition: border-color .2s, background .2s, transform .15s; }
          .gs__card:hover { border-color: rgba(99,102,241,.5); background: rgba(99,102,241,.06); transform: translateY(-2px); }
          .gs__icon { font-size: 2rem; line-height: 1; }
          .gs__card-title { font-size: 1rem; font-weight: 600; color: var(--cb-text); }
          .gs__card-sub { font-size: .8125rem; color: var(--cb-text-muted); line-height: 1.5; }
          .gs__badge { font-size: .6875rem; font-weight: 700; letter-spacing: .04em; padding: .25rem .625rem; border-radius: 99px; }
          .gs__badge--admin { background: rgba(139,92,246,.15); color: #a78bfa; border: 1px solid rgba(139,92,246,.3); }
          .gs__badge--user { background: rgba(34,197,94,.1); color: #4ade80; border: 1px solid rgba(34,197,94,.25); }
        `}</style>
      </div>
    );
  }

  // ── Workspace form ────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} noValidate id="google-setup-form" className="gs">
      <button type="button" className="gs__back" onClick={() => { setMode("choose"); setError(""); }}>
        ← {mode === "create" ? "Create a workspace" : "Join a workspace"}
      </button>

      {error && (
        <div className="gs__error" role="alert">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
          {error}
        </div>
      )}

      {mode === "create" && (
        <div className="gs__group">
          <label htmlFor="gs-workspace-name" className="gs__label">Workspace name</label>
          <input
            id="gs-workspace-name"
            type="text"
            autoComplete="organization"
            value={workspaceName}
            onChange={(e) => { setWorkspaceName(e.target.value); setWsError(""); }}
            className={`gs__input ${wsError ? "gs__input--error" : ""}`}
            placeholder="e.g. Acme Corp"
            disabled={isLoading}
            autoFocus
          />
          {wsError && <p className="gs__field-error" role="alert">{wsError}</p>}
          <p className="gs__hint">Your team members will use your invite code to join.</p>
        </div>
      )}

      {mode === "join" && (
        <div className="gs__group">
          <label htmlFor="gs-invite-code" className="gs__label">Invite code</label>
          <input
            id="gs-invite-code"
            type="text"
            autoComplete="off"
            value={inviteCode}
            onChange={(e) => { setInviteCode(e.target.value.trim()); setInviteError(""); }}
            className={`gs__input gs__input--mono ${inviteError ? "gs__input--error" : ""}`}
            placeholder="Paste the code from your admin"
            disabled={isLoading}
            autoFocus
          />
          {inviteError && <p className="gs__field-error" role="alert">{inviteError}</p>}
        </div>
      )}

      <button type="submit" className="gs__submit" disabled={isLoading} id="gs-submit-button">
        {isLoading ? (
          <><span className="gs__spinner" aria-hidden="true" />{mode === "create" ? "Creating workspace…" : "Joining workspace…"}</>
        ) : (
          mode === "create" ? "Create workspace" : "Join workspace"
        )}
      </button>

      <style>{`
        .gs { display: flex; flex-direction: column; gap: 1.25rem; }
        .gs__back { background: none; border: none; color: var(--cb-text-muted); font-size: .9375rem; font-weight: 600; cursor: pointer; text-align: left; padding: 0; transition: color .15s; }
        .gs__back:hover { color: var(--cb-text); }
        .gs__error { display: flex; align-items: center; gap: .5rem; padding: .75rem 1rem; background: rgba(244,63,94,.12); border: 1px solid rgba(244,63,94,.3); border-radius: 10px; color: #fb7185; font-size: .875rem; }
        .gs__error svg { width: 1rem; height: 1rem; flex-shrink: 0; }
        .gs__group { display: flex; flex-direction: column; gap: .375rem; }
        .gs__label { font-size: .875rem; font-weight: 500; color: var(--cb-text-muted); }
        .gs__input { width: 100%; padding: .75rem 1rem; background: var(--cb-surface-2); border: 1px solid var(--cb-border); border-radius: 10px; color: var(--cb-text); font-size: .9375rem; font-family: inherit; outline: none; transition: border-color .15s, box-shadow .15s; box-sizing: border-box; }
        .gs__input--mono { font-family: monospace; letter-spacing: .05em; }
        .gs__input::placeholder { color: var(--cb-text-subtle); }
        .gs__input:focus { border-color: var(--cb-primary); box-shadow: 0 0 0 3px var(--cb-primary-glow); }
        .gs__input--error { border-color: #f43f5e; box-shadow: 0 0 0 3px rgba(244,63,94,.15); }
        .gs__input:disabled { opacity: .6; cursor: not-allowed; }
        .gs__field-error { font-size: .8125rem; color: #fb7185; }
        .gs__hint { font-size: .8125rem; color: var(--cb-text-subtle); margin: .125rem 0 0; }
        .gs__submit { width: 100%; padding: .8125rem 1rem; background: linear-gradient(135deg, var(--cb-primary) 0%, #4f46e5 100%); color: white; font-size: .9375rem; font-weight: 600; font-family: inherit; border: none; border-radius: 10px; cursor: pointer; transition: opacity .15s, transform .1s, box-shadow .15s; box-shadow: 0 4px 20px var(--cb-primary-glow); display: flex; align-items: center; justify-content: center; gap: .5rem; }
        .gs__submit:hover:not(:disabled) { opacity: .92; transform: translateY(-1px); }
        .gs__submit:disabled { opacity: .7; cursor: not-allowed; }
        .gs__spinner { width: 1rem; height: 1rem; border: 2px solid rgba(255,255,255,.3); border-top-color: white; border-radius: 50%; animation: spin .7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </form>
  );
}
