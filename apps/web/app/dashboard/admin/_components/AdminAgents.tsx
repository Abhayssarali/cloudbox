"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, Wifi, WifiOff, HardDrive, FileText, Clock } from "lucide-react";

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
};

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

export default function AdminAgents() {
  const { data: agents = [], isLoading, error } = useQuery<Agent[]>({
    queryKey: ["admin", "agents"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/admin/agents`, { credentials: "include" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data.agents;
    },
    refetchInterval: 15_000,
  });

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
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Storage Node Health</h2>
        <p className="text-sm text-gray-500">
          Monitor real-time connectivity and status of all registered storage nodes.
        </p>
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

      {isLoading ? (
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
                    <div className="text-xs text-gray-500 mt-0.5">{agent.user.email}</div>
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

              <div className="mt-3 text-xs text-gray-600">
                Registered {new Date(agent.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
