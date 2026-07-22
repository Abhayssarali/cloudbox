"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Copy, Check, RefreshCw, Users, Link2 } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface Workspace {
  id: string;
  name: string;
  inviteCode: string;
  memberCount: number;
}

export default function WorkspacePanel() {
  const [copied, setCopied] = useState(false);

  const { data: workspace, refetch, isLoading } = useQuery<Workspace>({
    queryKey: ["admin", "workspace"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/admin/workspace`, { credentials: "include" });
      const d = await res.json();
      if (!d.success) throw new Error(d.error);
      return d.data.workspace as Workspace;
    },
  });

  const regenMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_URL}/admin/workspace/regenerate-code`, {
        method: "POST",
        credentials: "include",
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.error);
    },
    onSuccess: () => refetch(),
    onError: (e: Error) => alert(`Failed: ${e.message}`),
  });

  async function copyCode() {
    if (!workspace?.inviteCode) return;
    await navigator.clipboard.writeText(workspace.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (isLoading) {
    return (
      <div className="wp wp--loading">
        <div className="wp__shimmer" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="wp wp--empty">
        <p>No workspace found. Your account may not have an associated workspace.</p>
      </div>
    );
  }

  return (
    <div className="wp">
      {/* Header */}
      <div className="wp__header">
        <div>
          <h2 className="wp__title">{workspace.name}</h2>
          <p className="wp__subtitle">Your workspace</p>
        </div>
        <div className="wp__member-pill">
          <Users className="w-3.5 h-3.5" />
          {workspace.memberCount} member{workspace.memberCount !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Invite code block */}
      <div className="wp__invite">
        <div className="wp__invite-label">
          <Link2 className="w-4 h-4 text-indigo-400" />
          Workspace Invite Code
        </div>
        <p className="wp__invite-hint">
          Share this code with anyone you want to add to your workspace. They'll use it during sign-up.
        </p>

        <div className="wp__code-row">
          <code className="wp__code" id="workspace-invite-code">{workspace.inviteCode}</code>
          <button
            id="copy-invite-code"
            className={`wp__copy-btn ${copied ? "wp__copy-btn--done" : ""}`}
            onClick={copyCode}
            title="Copy code"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>

        <button
          id="regen-invite-code"
          className="wp__regen-btn"
          onClick={() => {
            if (confirm("Regenerate invite code? The old code will immediately stop working.")) {
              regenMutation.mutate();
            }
          }}
          disabled={regenMutation.isPending}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${regenMutation.isPending ? "animate-spin" : ""}`} />
          {regenMutation.isPending ? "Regenerating…" : "Regenerate code"}
        </button>
      </div>

      <style>{`
        .wp { background: var(--cb-surface); border: 1px solid var(--cb-border); border-radius: 16px; padding: 1.75rem; }
        .wp--loading { min-height: 180px; display: flex; align-items: center; }
        .wp__shimmer { width: 100%; height: 120px; background: linear-gradient(90deg, rgba(255,255,255,.03) 25%, rgba(255,255,255,.06) 50%, rgba(255,255,255,.03) 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 10px; }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        .wp--empty { color: var(--cb-text-muted); font-size: .9375rem; }
        .wp__header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1.5rem; }
        .wp__title { font-size: 1.25rem; font-weight: 700; color: white; margin: 0 0 .25rem; }
        .wp__subtitle { font-size: .8125rem; color: var(--cb-text-muted); margin: 0; }
        .wp__member-pill { display: flex; align-items: center; gap: .375rem; background: rgba(99,102,241,.1); border: 1px solid rgba(99,102,241,.2); color: #a5b4fc; font-size: .8125rem; font-weight: 600; padding: .375rem .75rem; border-radius: 99px; }
        .wp__invite { background: rgba(255,255,255,.025); border: 1px solid var(--cb-border); border-radius: 12px; padding: 1.25rem; }
        .wp__invite-label { display: flex; align-items: center; gap: .5rem; font-size: .875rem; font-weight: 600; color: var(--cb-text); margin-bottom: .625rem; }
        .wp__invite-hint { font-size: .8125rem; color: var(--cb-text-muted); margin: 0 0 1rem; line-height: 1.6; }
        .wp__code-row { display: flex; align-items: center; gap: .75rem; margin-bottom: .75rem; }
        .wp__code { font-family: monospace; font-size: 1.25rem; letter-spacing: .1em; color: #a5b4fc; background: rgba(99,102,241,.1); border: 1px solid rgba(99,102,241,.2); padding: .625rem 1.125rem; border-radius: 10px; flex: 1; }
        .wp__copy-btn { display: flex; align-items: center; gap: .375rem; padding: .625rem 1rem; border-radius: 10px; font-size: .875rem; font-weight: 600; cursor: pointer; border: 1px solid var(--cb-border); background: rgba(255,255,255,.05); color: var(--cb-text); transition: all .15s; }
        .wp__copy-btn:hover { background: rgba(255,255,255,.1); }
        .wp__copy-btn--done { background: rgba(34,197,94,.1); border-color: rgba(34,197,94,.3); color: #4ade80; }
        .wp__regen-btn { display: flex; align-items: center; gap: .375rem; background: none; border: none; color: var(--cb-text-muted); font-size: .8125rem; cursor: pointer; padding: 0; transition: color .15s; }
        .wp__regen-btn:hover:not(:disabled) { color: #fb7185; }
        .wp__regen-btn:disabled { opacity: .5; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
