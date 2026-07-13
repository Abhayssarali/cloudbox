"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/stores/useAuthStore";
import type { AuthState } from "@/stores/useAuthStore";
import { HardDrive, CheckCircle2, AlertTriangle, Server, Plus } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface AgentRecord {
  id: string;
  cloudId: string;
  status: "ONLINE" | "OFFLINE";
  lastHeartbeat: string | null;
  createdAt: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

interface UserWithUsage {
  usedBytes: number;
  quotaBytes: number;
}

// ---- Storage Usage widget shown to regular users ----
function StorageUsageWidget() {
  const [usage, setUsage] = useState<UserWithUsage | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/me`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setUsage({ usedBytes: Number(d.data.user.usedBytes), quotaBytes: Number(d.data.user.quotaBytes) });
        }
      })
      .catch(() => {/* silent */});
  }, []);

  const used = usage?.usedBytes ?? 0;
  const quota = usage?.quotaBytes ?? 0;
  const pct = quota > 0 ? Math.min(100, (used / quota) * 100) : 0;
  const isWarning = pct >= 80;
  const isCritical = pct >= 95;

  return (
    <div className="usage-card">
      <div className="usage-card__header">
        <div className="usage-card__icon">
          <HardDrive className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <h3 className="usage-card__title">Your Storage</h3>
          <p className="usage-card__sub">Managed by your administrator</p>
        </div>
      </div>

      <div className="usage-card__bar-wrap">
        <div className="usage-card__bar-track">
          <div
            className={`usage-card__bar-fill ${isCritical ? "usage-card__bar-fill--crit" : isWarning ? "usage-card__bar-fill--warn" : ""}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="usage-card__bar-labels">
          <span className={`usage-card__used ${isCritical ? "usage-card__used--crit" : isWarning ? "usage-card__used--warn" : ""}`}>
            {isCritical && <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />}
            {formatBytes(used)} used
          </span>
          <span className="usage-card__quota">
            {quota > 0 ? formatBytes(quota) + " total" : "Unlimited"}
          </span>
        </div>
      </div>

      <div className="usage-card__footer">
        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        <span>Storage is automatically managed — just upload your files</span>
      </div>
    </div>
  );
}

export default function DashboardClient() {
  const user = useAuthStore((s: AuthState) => s.user);
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [claimCode, setClaimCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/agents`, { credentials: "include" });
      const data = (await res.json()) as ApiResponse<{ agents: AgentRecord[] }>;
      if (data.success) setAgents(data.data.agents);
    } catch {
      // silently fail on polling error
    }
  }, []);

  // Poll every 10 seconds for live status — only for admins who own nodes
  useEffect(() => {
    if (!isAdmin) return;
    const initialFetch = setTimeout(fetchAgents, 0);
    const interval = setInterval(fetchAgents, 10_000);
    return () => {
      clearTimeout(initialFetch);
      clearInterval(interval);
    };
  }, [fetchAgents, isAdmin]);

  async function handleClaimNode() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/agents/claim`, { method: "POST", credentials: "include" });
      const data = (await res.json()) as ApiResponse<{ code: string }>;
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to get claim code");
      setClaimCode(data.data.code);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }

  const onlineCount = agents.filter((a) => a.status === "ONLINE").length;

  return (
    <div className="flex flex-col flex-1 p-8 overflow-y-auto">
      <div className="max-w-5xl w-full mx-auto">
        <div className="dash__hero">
          <h2>Welcome back, {user?.email?.split("@")[0]}</h2>
          <p className="dash__hero-sub">
            {isAdmin
              ? onlineCount > 0
                ? `${onlineCount} node${onlineCount > 1 ? "s" : ""} online and ready`
                : "No nodes online. Start your agent to begin."
              : "Your personal cloud storage — fast, private, and managed for you."}
          </p>
        </div>

        {/* Regular user: show storage usage widget, no node details */}
        {!isAdmin && <StorageUsageWidget />}

        {/* Admin: show storage nodes management panel */}
        {isAdmin && (
          <div className="dash__section">
            <div className="dash__section-header">
              <h3>Storage Nodes</h3>
              <button onClick={handleClaimNode} disabled={isLoading} className="dash__btn dash__btn--primary">
                <Plus className="w-3.5 h-3.5 inline mr-1.5" />
                {isLoading ? "Generating..." : "Add Node"}
              </button>
            </div>

            {error && <p className="dash__error">{error}</p>}

            {agents.length === 0 ? (
              <div className="dash__empty">
                <Server className="w-12 h-12 mx-auto mb-3 text-gray-700" />
                <p>No nodes registered yet.</p>
                <p className="dash__empty-sub">Click <strong>Add Node</strong> to link your first device.</p>
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
        )}
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
        .dash__hero { margin-bottom: 2.5rem; }
        .dash__hero h2 { font-size: 1.75rem; font-weight: 700; margin: 0 0 .5rem 0; }
        .dash__hero-sub { color: var(--cb-text-muted); font-size: 1rem; margin: 0; }

        .dash__section { background: var(--cb-surface); border: 1px solid var(--cb-border); border-radius: 14px; padding: 1.5rem; }
        .dash__section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; }
        .dash__section-header h3 { margin: 0; font-size: 1rem; font-weight: 600; }

        .dash__btn { background: var(--cb-surface-2, rgba(255,255,255,.06)); border: 1px solid var(--cb-border); color: var(--cb-text); padding: .5rem 1rem; border-radius: 8px; cursor: pointer; font-size: .875rem; font-weight: 500; transition: all .15s; display:inline-flex; align-items:center; }
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

        /* Storage Usage Widget */
        .usage-card { background: var(--cb-surface); border: 1px solid var(--cb-border); border-radius: 14px; padding: 1.5rem; }
        .usage-card__header { display: flex; align-items: center; gap: .875rem; margin-bottom: 1.25rem; }
        .usage-card__icon { width: 42px; height: 42px; border-radius: 10px; background: rgba(99,102,241,.12); border: 1px solid rgba(99,102,241,.2); display: flex; align-items: center; justify-content: center; }
        .usage-card__title { font-size: 1rem; font-weight: 600; margin: 0; color: white; }
        .usage-card__sub { font-size: .8125rem; color: var(--cb-text-muted); margin: .125rem 0 0; }
        .usage-card__bar-wrap { margin-bottom: 1rem; }
        .usage-card__bar-track { height: 8px; background: rgba(255,255,255,.06); border-radius: 99px; overflow: hidden; margin-bottom: .5rem; }
        .usage-card__bar-fill { height: 100%; background: linear-gradient(90deg, #6366f1, #8b5cf6); border-radius: 99px; transition: width .6s ease; }
        .usage-card__bar-fill--warn { background: linear-gradient(90deg, #f59e0b, #f97316); }
        .usage-card__bar-fill--crit { background: linear-gradient(90deg, #ef4444, #fb7185); }
        .usage-card__bar-labels { display: flex; justify-content: space-between; font-size: .8125rem; }
        .usage-card__used { color: var(--cb-text); font-weight: 500; display: flex; align-items: center; gap: .25rem; }
        .usage-card__used--warn { color: #f59e0b; }
        .usage-card__used--crit { color: #fb7185; }
        .usage-card__quota { color: var(--cb-text-muted); }
        .usage-card__footer { display: flex; align-items: center; gap: .5rem; font-size: .8125rem; color: var(--cb-text-muted); padding-top: 1rem; border-top: 1px solid var(--cb-border); }
      `}</style>
    </div>
  );
}
