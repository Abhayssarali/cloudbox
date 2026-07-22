"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Copy, Check, RefreshCw, Users, Link2, Building } from "lucide-react";

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
      <div className="glass-card rounded-3xl p-6 animate-pulse space-y-4">
        <div className="h-6 bg-white/5 rounded-lg w-1/3" />
        <div className="h-12 bg-white/5 rounded-xl w-full" />
      </div>
    );
  }

  if (!workspace) return null;

  return (
    <div className="glass-card rounded-3xl p-6 space-y-5 border border-white/[0.08]">
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">{workspace.name}</h3>
            <p className="text-xs text-slate-400">Workspace parameters &amp; member onboarding</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
          <Users className="w-3.5 h-3.5" />
          <span>{workspace.memberCount} Member{workspace.memberCount !== 1 ? "s" : ""}</span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
            <Link2 className="w-4 h-4 text-indigo-400" />
            Workspace Invite Token
          </span>
          <button
            onClick={() => {
              if (confirm("Regenerate invite code? The old code will immediately stop working.")) {
                regenMutation.mutate();
              }
            }}
            disabled={regenMutation.isPending}
            className="text-[11px] text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${regenMutation.isPending ? "animate-spin" : ""}`} />
            Regenerate Token
          </button>
        </div>

        <div className="flex items-center gap-3 bg-black/60 border border-white/10 rounded-2xl p-3">
          <code className="flex-1 font-mono text-base font-bold text-indigo-300 tracking-wider text-center select-all">
            {workspace.inviteCode}
          </code>
          <button
            onClick={copyCode}
            className="btn-primary px-4 py-2 rounded-xl text-xs flex items-center gap-1.5"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied!" : "Copy Code"}
          </button>
        </div>
      </div>
    </div>
  );
}
