"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Wifi, WifiOff, HardDrive, FileText, Clock, Users, UserCheck, ChevronDown, X, Copy, Check } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type Agent = {
  id: string;
  cloudId: string;
  status: "ONLINE" | "OFFLINE";
  lastHeartbeat: string | null;
  version: string | null;
  createdAt: string;
  user: { id: string; email: string };
  fileCount: number;
  allocatedUser: { id: string; email: string } | null;
  allocatedGroup: { id: string; name: string } | null;
};

type AdminUser = { id: string; email: string };
type Group = { id: string; name: string };

function timeAgo(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ---- Allocation Selector ----
function AllocationSelector({ agent, users, groups }: { agent: Agent; users: AdminUser[]; groups: Group[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const allocateMutation = useMutation({
    mutationFn: async ({ userId, groupId }: { userId?: string | null; groupId?: string | null }) => {
      const res = await fetch(`${API_URL}/admin/agents/${agent.id}/allocate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userId ?? null, groupId: groupId ?? null }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "agents"] });
      setOpen(false);
    },
    onError: (e: Error) => alert(`Failed: ${e.message}`),
  });

  const currentLabel = agent.allocatedGroup
    ? `Group: ${agent.allocatedGroup.name}`
    : agent.allocatedUser
    ? `User: ${agent.allocatedUser.email.split("@")[0]}`
    : "Not allocated";

  return (
    <div className="relative mt-3">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-black/20 hover:bg-white/5 border border-[#2a2d38] rounded-lg text-xs text-gray-300 transition-colors"
      >
        <div className="flex items-center gap-2 truncate">
          {agent.allocatedGroup ? (
            <Users className="w-3.5 h-3.5 text-violet-400 shrink-0" />
          ) : agent.allocatedUser ? (
            <UserCheck className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          ) : (
            <HardDrive className="w-3.5 h-3.5 text-gray-600 shrink-0" />
          )}
          <span className="truncate">{currentLabel}</span>
        </div>
        <ChevronDown className="w-3 h-3 text-gray-500 shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-10 z-20 bg-[#12141a] border border-[#1f2229] rounded-xl shadow-2xl py-1 max-h-64 overflow-y-auto">
          {/* Clear allocation */}
          <button
            onClick={() => allocateMutation.mutate({ userId: null, groupId: null })}
            className="w-full text-left px-4 py-2.5 text-xs text-gray-400 hover:bg-white/5 transition-colors border-b border-[#1f2229]"
          >
            — Clear allocation (owner only)
          </button>

          {/* Groups */}
          {groups.length > 0 && (
            <>
              <div className="px-4 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-600">Groups</div>
              {groups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => allocateMutation.mutate({ groupId: g.id, userId: null })}
                  className={`w-full text-left px-4 py-2.5 text-xs hover:bg-white/5 transition-colors flex items-center gap-2 ${agent.allocatedGroup?.id === g.id ? "text-violet-400" : "text-gray-300"}`}
                >
                  <Users className="w-3.5 h-3.5 shrink-0" />
                  {g.name}
                  {agent.allocatedGroup?.id === g.id && <span className="ml-auto text-[10px] text-violet-400">active</span>}
                </button>
              ))}
            </>
          )}

          {/* Users */}
          {users.length > 0 && (
            <>
              <div className="px-4 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-600 border-t border-[#1f2229] mt-1">Users</div>
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => allocateMutation.mutate({ userId: u.id, groupId: null })}
                  className={`w-full text-left px-4 py-2.5 text-xs hover:bg-white/5 transition-colors flex items-center gap-2 ${agent.allocatedUser?.id === u.id ? "text-indigo-400" : "text-gray-300"}`}
                >
                  <UserCheck className="w-3.5 h-3.5 shrink-0" />
                  {u.email}
                  {agent.allocatedUser?.id === u.id && <span className="ml-auto text-[10px] text-indigo-400">active</span>}
                </button>
              ))}
            </>
          )}

          {allocateMutation.isPending && (
            <div className="flex items-center gap-2 px-4 py-2.5 text-xs text-gray-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminAgents() {
  const [claimCode, setClaimCode] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);

  const { data: agents = [], isLoading: agentsLoading, error } = useQuery<Agent[]>({
    queryKey: ["admin", "agents"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/admin/agents`, { credentials: "include" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data.agents;
    },
    refetchInterval: 15_000,
  });

  const { data: users = [] } = useQuery<AdminUser[]>({
    queryKey: ["admin", "users-list"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/admin/users`, { credentials: "include" });
      const data = await res.json();
      if (!data.success) return [];
      return data.data.users.map((u: { id: string; email: string }) => ({ id: u.id, email: u.email }));
    },
  });

  const { data: groups = [] } = useQuery<Group[]>({
    queryKey: ["admin", "groups"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/admin/groups`, { credentials: "include" });
      const data = await res.json();
      if (!data.success) return [];
      return data.data.groups;
    },
  });

  async function handleClaimNode() {
    try {
      setIsClaiming(true);
      const res = await fetch(`${API_URL}/agents/claim`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to generate claim code");
      setClaimCode(data.data.code);
    } catch (err) {
      alert(`Error generating claim code: ${(err as Error).message}`);
    } finally {
      setIsClaiming(false);
    }
  }

  if (error) {
    return (
      <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg">
        Failed to load agents: {(error as Error).message}
      </div>
    );
  }

  const online = agents.filter((a) => a.status === "ONLINE");
  const offline = agents.filter((a) => a.status === "OFFLINE");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Storage Node Health</h2>
          <p className="text-sm text-gray-500">
            Monitor, register, and allocate storage nodes to users or groups.
          </p>
        </div>
        <button
          onClick={handleClaimNode}
          disabled={isClaiming}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 shadow-lg shadow-indigo-600/20"
        >
          {isClaiming ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
          + Add Storage Node
        </button>
      </div>

      {/* Summary pills */}
      <div className="flex gap-3">
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm px-3 py-1.5 rounded-lg">
          <Wifi className="w-4 h-4" />
          {online.length} Online
        </div>
        <div className="flex items-center gap-2 bg-gray-500/10 border border-gray-500/20 text-gray-400 text-sm px-3 py-1.5 rounded-lg">
          <WifiOff className="w-4 h-4" />
          {offline.length} Offline
        </div>
      </div>

      {agentsLoading ? (
        <div className="flex items-center gap-2 text-gray-500 py-10">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading agents…
        </div>
      ) : agents.length === 0 ? (
        <div className="text-center py-16 text-gray-500">No storage nodes registered yet.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className={`bg-[#12141a] rounded-xl border p-5 transition-all ${
                agent.status === "ONLINE"
                  ? "border-emerald-500/20"
                  : "border-[#1f2229]"
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      agent.status === "ONLINE"
                        ? "bg-emerald-500/10"
                        : "bg-gray-700/30"
                    }`}
                  >
                    {agent.status === "ONLINE" ? (
                      <Wifi className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <WifiOff className="w-4 h-4 text-gray-600" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-mono text-gray-200">
                      {agent.cloudId.substring(0, 18)}…
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">Owner: {agent.user.email}</div>
                  </div>
                </div>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    agent.status === "ONLINE"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-gray-500/10 text-gray-500"
                  }`}
                >
                  {agent.status}
                </span>
              </div>

              {/* Details */}
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="bg-black/20 rounded-lg p-2.5">
                  <div className="flex items-center gap-1 text-gray-500 mb-1">
                    <Clock className="w-3 h-3" />
                    Heartbeat
                  </div>
                  <div className="text-gray-300 font-medium">
                    {timeAgo(agent.lastHeartbeat)}
                  </div>
                </div>
                <div className="bg-black/20 rounded-lg p-2.5">
                  <div className="flex items-center gap-1 text-gray-500 mb-1">
                    <FileText className="w-3 h-3" />
                    Files
                  </div>
                  <div className="text-gray-300 font-medium">{agent.fileCount}</div>
                </div>
                <div className="bg-black/20 rounded-lg p-2.5">
                  <div className="flex items-center gap-1 text-gray-500 mb-1">
                    <HardDrive className="w-3 h-3" />
                    Version
                  </div>
                  <div className="text-gray-300 font-medium">{agent.version ?? "—"}</div>
                </div>
              </div>

              {/* Allocation selector */}
              <AllocationSelector agent={agent} users={users} groups={groups} />

              <div className="mt-3 text-xs text-gray-600">
                Registered {new Date(agent.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Claim Node Modal */}
      {claimCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#12141a] border border-[#1f2229] rounded-2xl p-6 max-w-lg w-full shadow-2xl relative">
            <button
              onClick={() => setClaimCode(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold text-white mb-2">Claim Storage Node</h3>
            <p className="text-sm text-gray-400 mb-6">
              Use this claim code on your storage machine to link it to your CloudBox network.
            </p>

            {/* Code Box */}
            <div className="bg-[#0b0c10] border border-indigo-500/30 rounded-xl p-4 text-center mb-6">
              <div className="text-xs uppercase tracking-widest text-indigo-400 font-semibold mb-1">Claim Code</div>
              <div className="text-3xl font-mono font-extrabold text-white tracking-wider">{claimCode}</div>
              <div className="text-xs text-gray-500 mt-2">Expires in 10 minutes</div>
            </div>

            {/* Steps */}
            <div className="space-y-4 text-xs text-gray-300 mb-6">
              <div className="bg-[#181a20] rounded-lg p-3 border border-[#252830]">
                <div className="font-semibold text-white mb-1">Option A: Ubuntu Installer Script</div>
                <code className="block bg-black/40 p-2 rounded text-emerald-400 font-mono overflow-x-auto select-all">
                  sudo bash install.sh --claim {claimCode}
                </code>
              </div>

              <div className="bg-[#181a20] rounded-lg p-3 border border-[#252830]">
                <div className="font-semibold text-white mb-1">Option B: Development CLI</div>
                <code className="block bg-black/40 p-2 rounded text-indigo-400 font-mono overflow-x-auto select-all">
                  pnpm --filter agent run dev register {claimCode}
                </code>
              </div>
            </div>

            <button
              onClick={() => setClaimCode(null)}
              className="w-full py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
