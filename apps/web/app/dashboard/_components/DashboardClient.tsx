"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/stores/useAuthStore";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface AgentRecord {
  id: string;
  cloudId: string;
  status: "ONLINE" | "OFFLINE";
  lastHeartbeat: string | null;
  createdAt: string;
}

export default function DashboardClient() {
  const user = useAuthStore((s: import("@/stores/useAuthStore").AuthState) => s.user);
  const clearUser = useAuthStore((s: import("@/stores/useAuthStore").AuthState) => s.clearUser);
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [claimCode, setClaimCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/agents`, { credentials: "include" });
      const data = await res.json() as any;
      if (data.success) setAgents(data.data.agents);
    } catch {
      // silently fail on polling error
    }
  }, []);

  // Poll every 10 seconds for live status
  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, 10_000);
    return () => clearInterval(interval);
  }, [fetchAgents]);

  async function handleLogout() {
    await fetch(`${API_URL}/auth/logout`, { method: "POST", credentials: "include" });
    clearUser();
    window.location.href = "/login";
  }

  async function handleClaimNode() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/agents/claim`, { method: "POST", credentials: "include" });
      const data = await res.json() as any;
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to get claim code");
      setClaimCode(data.data.code);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  const onlineCount = agents.filter((a) => a.status === "ONLINE").length;

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
          <p className="dash__hero-sub">
            {onlineCount > 0
              ? `${onlineCount} node${onlineCount > 1 ? "s" : ""} online and ready`
              : "No nodes online. Start your agent to begin."}
          </p>
        </div>

        <div className="dash__section">
          <div className="dash__section-header">
            <h3>Storage Nodes</h3>
            <button onClick={handleClaimNode} disabled={isLoading} className="dash__btn dash__btn--primary">
              {isLoading ? "Generating..." : "+ Add Node"}
            </button>
          </div>

          {error && <p className="dash__error">{error}</p>}

          {agents.length === 0 ? (
            <div className="dash__empty">
              <p>No nodes registered yet.</p>
              <p className="dash__empty-sub">Click <strong>+ Add Node</strong> to link your first device.</p>
            </div>
          ) : (
            <div className="dash__agent-list">
              {agents.map((agent) => (
                <div key={agent.id} className="dash__agent-card">
                  <div className="dash__agent-info">
                    <span className={`dash__status-dot ${agent.status === "ONLINE" ? "dash__status-dot--online" : ""}`} />
                    <div>
                      <div className="dash__agent-id">{agent.cloudId}</div>
                      <div className="dash__agent-meta">
                        {agent.status === "ONLINE"
                          ? "🟢 Online"
                          : `🔴 Offline${agent.lastHeartbeat ? ` · Last seen ${new Date(agent.lastHeartbeat).toLocaleString()}` : ""}`}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {claimCode && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Add a New Storage Node</h3>
            <p>Run this command on the computer you want to add as storage:</p>
            <div className="modal__code-block">
              <code>pnpm --filter agent run dev start</code>
            </div>
            <p style={{ marginTop: "1rem" }}>First time? Register with your claim code:</p>
            <div className="modal__code-block">
              <code>pnpm --filter agent run dev register {claimCode}</code>
            </div>
            <p className="modal__note">⚠️ This code expires in 10 minutes.</p>
            <button onClick={() => setClaimCode(null)} className="dash__btn" style={{ marginTop: "1rem" }}>Close</button>
          </div>
        </div>
      )}

      <style>{`
        .dash { display: flex; flex-direction: column; min-height: 100vh; color: var(--cb-text); font-family: var(--font-inter); }
        .dash__header { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 2rem; border-bottom: 1px solid var(--cb-border); background: var(--cb-surface); backdrop-filter: blur(12px); position: sticky; top: 0; z-index: 10; }
        .dash__header-left { display: flex; align-items: center; gap: .75rem; }
        .dash__header-left h1 { font-size: 1.125rem; font-weight: 700; margin: 0; }
        .dash__logo { width: 32px; height: 32px; flex-shrink: 0; }
        .dash__logo svg { width: 100%; height: 100%; border-radius: 8px; }
        .dash__header-right { display: flex; align-items: center; gap: 1rem; }
        .dash__user { font-size: .875rem; color: var(--cb-text-muted); }
        .dash__logout-btn { background: none; border: 1px solid var(--cb-border); color: var(--cb-text-muted); padding: .4rem .9rem; border-radius: 6px; cursor: pointer; transition: all .15s; font-size: .8125rem; }
        .dash__logout-btn:hover { background: rgba(255,255,255,.05); color: var(--cb-text); }

        .dash__content { flex: 1; padding: 2.5rem 2rem; max-width: 900px; margin: 0 auto; width: 100%; }
        .dash__hero { margin-bottom: 2.5rem; }
        .dash__hero h2 { font-size: 1.75rem; font-weight: 700; margin: 0 0 .5rem 0; }
        .dash__hero-sub { color: var(--cb-text-muted); font-size: 1rem; margin: 0; }

        .dash__section { background: var(--cb-surface); border: 1px solid var(--cb-border); border-radius: 14px; padding: 1.5rem; }
        .dash__section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; }
        .dash__section-header h3 { margin: 0; font-size: 1rem; font-weight: 600; }

        .dash__btn { background: var(--cb-surface-2, rgba(255,255,255,.06)); border: 1px solid var(--cb-border); color: var(--cb-text); padding: .5rem 1rem; border-radius: 8px; cursor: pointer; font-size: .875rem; font-weight: 500; transition: all .15s; }
        .dash__btn:hover { background: rgba(255,255,255,.1); }
        .dash__btn--primary { background: var(--cb-primary, #6366f1); color: white; border: none; }
        .dash__btn--primary:hover { opacity: .88; }
        .dash__btn:disabled { opacity: .45; cursor: not-allowed; }
        .dash__error { color: #fb7185; font-size: .875rem; margin: .75rem 0 0; }

        .dash__empty { padding: 2.5rem 1rem; text-align: center; color: var(--cb-text-muted); }
        .dash__empty p { margin: 0 0 .5rem; }
        .dash__empty-sub { font-size: .875rem; }

        .dash__agent-list { display: flex; flex-direction: column; gap: .75rem; }
        .dash__agent-card { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem; background: rgba(255,255,255,.03); border: 1px solid var(--cb-border); border-radius: 10px; transition: border-color .2s; }
        .dash__agent-card:hover { border-color: rgba(99,102,241,.4); }
        .dash__agent-info { display: flex; align-items: center; gap: .875rem; }
        .dash__status-dot { width: 10px; height: 10px; border-radius: 50%; background: #4b5563; flex-shrink: 0; box-shadow: 0 0 0 3px rgba(75,85,99,.2); transition: all .3s; }
        .dash__status-dot--online { background: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,.25), 0 0 8px rgba(34,197,94,.5); animation: pulse-green 2s infinite; }
        .dash__agent-id { font-family: monospace; font-size: .875rem; color: var(--cb-text); }
        .dash__agent-meta { font-size: .8125rem; color: var(--cb-text-muted); margin-top: .2rem; }

        @keyframes pulse-green {
          0%, 100% { box-shadow: 0 0 0 3px rgba(34,197,94,.25), 0 0 8px rgba(34,197,94,.4); }
          50% { box-shadow: 0 0 0 5px rgba(34,197,94,.15), 0 0 14px rgba(34,197,94,.6); }
        }

        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.65); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; z-index: 50; }
        .modal { background: var(--cb-surface); border: 1px solid var(--cb-border); border-radius: 14px; padding: 2rem; max-width: 520px; width: 90%; box-shadow: 0 24px 48px rgba(0,0,0,.5); }
        .modal h3 { margin: 0 0 .75rem; font-size: 1.125rem; }
        .modal p { color: var(--cb-text-muted); font-size: .9375rem; margin: 0 0 1rem; line-height: 1.6; }
        .modal__code-block { background: #000; border: 1px solid rgba(255,255,255,.08); padding: .875rem 1rem; border-radius: 8px; font-family: monospace; font-size: .9375rem; color: #a5b4fc; word-break: break-all; }
        .modal__note { font-size: .8125rem !important; color: #fb7185 !important; margin-top: 1rem !important; }
      `}</style>
    </div>
  );
}
