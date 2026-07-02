"use client";

import { useState } from "react";
import { useAuthStore } from "@/stores/useAuthStore";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function DashboardClient() {
  const user = useAuthStore((s: import("@/stores/useAuthStore").AuthState) => s.user);
  const clearUser = useAuthStore((s: import("@/stores/useAuthStore").AuthState) => s.clearUser);
  const [claimCode, setClaimCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogout() {
    await fetch(`${API_URL}/auth/logout`, { method: "POST", credentials: "include" });
    clearUser();
    window.location.href = "/login";
  }

  async function handleClaimNode() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/agents/claim`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json() as any;
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to get claim code");
      setClaimCode(data.data.code);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="dash">
      <header className="dash__header">
        <div className="dash__header-left">
          <div className="dash__logo">
            <svg viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="14" fill="url(#sg1)" />
              <path d="M14 28c0-3.314 2.686-6 6-6a5.978 5.978 0 013.6 1.2A6 6 0 0130 20c3.314 0 6 2.686 6 6v2H14v-2z" fill="white" fillOpacity=".9" />
              <circle cx="24" cy="17" r="4" fill="white" fillOpacity=".6" />
              <defs><linearGradient id="sg1" x1="0" y1="0" x2="48" y2="48"><stop stopColor="#6366f1"/><stop offset="1" stopColor="#06b6d4"/></linearGradient></defs>
            </svg>
          </div>
          <h1>CloudBox</h1>
        </div>
        <div className="dash__header-right">
          <span className="dash__user">{user?.email}</span>
          <button onClick={handleLogout} className="dash__logout-btn">Sign out</button>
        </div>
      </header>

      <div className="dash__content">
        <div className="dash__hero">
          <h2>Welcome back, {user?.email?.split("@")[0]}</h2>
          <p>This is your personal CloudBox dashboard.</p>
        </div>

        <div className="dash__section">
          <h3>Your Storage Nodes (Agents)</h3>
          <p className="dash__subtext">Connect your personal devices (like an old laptop or Raspberry Pi) to use them as secure cloud storage.</p>
          
          <div className="dash__actions">
            <button onClick={handleClaimNode} disabled={isLoading} className="dash__btn dash__btn--primary">
              {isLoading ? "Generating..." : "Add New Node"}
            </button>
          </div>
          
          {error && <p className="dash__error">{error}</p>}
        </div>
      </div>

      {claimCode && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Add a New Storage Node</h3>
            <p>Run the following command on your server/laptop to register it to your account:</p>
            
            <div className="modal__code-block">
              <code>pnpm --filter agent run dev register {claimCode}</code>
            </div>
            
            <p className="modal__note">This code expires in 10 minutes.</p>
            
            <button onClick={() => setClaimCode(null)} className="dash__btn">Close</button>
          </div>
        </div>
      )}

      <style>{`
        .dash { display: flex; flex-direction: column; min-height: 100vh; color: var(--cb-text); }
        .dash__header { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 2rem; border-bottom: 1px solid var(--cb-border); background: var(--cb-surface); }
        .dash__header-left { display: flex; align-items: center; gap: 1rem; }
        .dash__header-left h1 { font-size: 1.25rem; font-weight: 700; margin: 0; }
        .dash__logo { width: 32px; height: 32px; }
        .dash__logo svg { width: 100%; height: 100%; border-radius: 8px; }
        .dash__header-right { display: flex; align-items: center; gap: 1rem; }
        .dash__user { font-size: .875rem; color: var(--cb-text-muted); }
        .dash__logout-btn { background: none; border: 1px solid var(--cb-border); color: var(--cb-text-muted); padding: .5rem 1rem; border-radius: 6px; cursor: pointer; transition: all .15s; font-size: .8125rem; }
        .dash__logout-btn:hover { background: rgba(255,255,255,.05); color: var(--cb-text); }
        
        .dash__content { flex: 1; padding: 2rem; max-width: 1000px; margin: 0 auto; width: 100%; }
        .dash__hero { margin-bottom: 3rem; }
        .dash__hero h2 { font-size: 1.75rem; margin-bottom: .5rem; }
        .dash__hero p { color: var(--cb-text-muted); }
        
        .dash__section { background: var(--cb-surface); border: 1px solid var(--cb-border); border-radius: 12px; padding: 1.5rem; }
        .dash__section h3 { margin: 0 0 .5rem 0; font-size: 1.125rem; }
        .dash__subtext { color: var(--cb-text-muted); font-size: .9375rem; margin-bottom: 1.5rem; }
        
        .dash__btn { background: var(--cb-surface-2); border: 1px solid var(--cb-border); color: var(--cb-text); padding: .625rem 1.25rem; border-radius: 8px; cursor: pointer; font-size: .875rem; font-weight: 500; transition: all .15s; }
        .dash__btn:hover { background: rgba(255,255,255,.1); }
        .dash__btn--primary { background: var(--cb-primary); color: white; border: none; }
        .dash__btn--primary:hover { opacity: .9; }
        .dash__btn:disabled { opacity: .5; cursor: not-allowed; }
        
        .dash__error { color: #fb7185; font-size: .875rem; margin-top: 1rem; }
        
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.6); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 50; }
        .modal { background: var(--cb-surface); border: 1px solid var(--cb-border); border-radius: 12px; padding: 2rem; max-width: 500px; width: 90%; box-shadow: 0 20px 40px rgba(0,0,0,.4); }
        .modal h3 { margin: 0 0 1rem 0; }
        .modal p { color: var(--cb-text-muted); font-size: .9375rem; margin-bottom: 1.5rem; line-height: 1.5; }
        .modal__code-block { background: #000; border: 1px solid var(--cb-border); padding: 1rem; border-radius: 8px; margin-bottom: 1rem; font-family: monospace; font-size: 1.125rem; color: var(--cb-primary-light); text-align: center; }
        .modal__note { font-size: .8125rem !important; color: #fb7185 !important; }
      `}</style>
    </div>
  );
}
