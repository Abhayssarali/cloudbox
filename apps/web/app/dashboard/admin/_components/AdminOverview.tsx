"use client";

import { useQuery } from "@tanstack/react-query";
import { Users, Server, HardDrive, FileText, Loader2, Wifi, WifiOff, ShieldCheck } from "lucide-react";
import WorkspacePanel from "./WorkspacePanel";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type Stats = {
  userCount: number;
  agentCount: number;
  onlineAgentCount: number;
  fileCount: number;
  totalUsedBytes: string;
};

type AgentSummary = {
  id: string;
  cloudId: string;
  status: "ONLINE" | "OFFLINE";
  fileCount: number;
  user: {
    email: string;
  };
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
  error?: string;
};

function formatBytes(bytesStr: string) {
  const bytes = parseInt(bytesStr, 10);
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

export default function AdminOverview() {
  const { data: stats, isLoading, error } = useQuery<Stats>({
    queryKey: ["admin", "stats"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/admin/stats`, { credentials: "include" });
      const data = (await res.json()) as ApiResponse<Stats>;
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    refetchInterval: 30_000,
  });

  const statCards = [
    {
      label: "Total Users",
      value: stats?.userCount ?? 0,
      icon: Users,
      color: "text-indigo-400 bg-indigo-500/10",
    },
    {
      label: "Storage Nodes",
      value: stats?.agentCount ?? 0,
      sub: `${stats?.onlineAgentCount ?? 0} online`,
      icon: Server,
      color: "text-emerald-400 bg-emerald-500/10",
    },
    {
      label: "Total Files",
      value: stats?.fileCount ?? 0,
      icon: FileText,
      color: "text-cyan-400 bg-cyan-500/10",
    },
    {
      label: "Storage Capacity Used",
      value: formatBytes(stats?.totalUsedBytes ?? "0"),
      icon: HardDrive,
      color: "text-violet-400 bg-violet-500/10",
    },
  ];

  if (error) {
    return (
      <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl">
        Failed to load stats: {(error as Error).message}
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Workspace Panel */}
      <WorkspacePanel />

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="glass-card rounded-3xl p-5 flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{card.label}</span>
                <div className={`p-2.5 rounded-2xl ${card.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>

              <div>
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                ) : (
                  <>
                    <div className="text-2xl font-extrabold text-white tracking-tight">{card.value}</div>
                    {card.sub && <div className="text-xs text-slate-400 mt-0.5">{card.sub}</div>}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Agent Status */}
      <AgentQuickStatus />
    </div>
  );
}

function AgentQuickStatus() {
  const { data: agents = [], isLoading } = useQuery<AgentSummary[]>({
    queryKey: ["admin", "agents"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/admin/agents`, { credentials: "include" });
      const data = (await res.json()) as ApiResponse<{ agents: AgentSummary[] }>;
      if (!data.success) throw new Error(data.error);
      return data.data.agents;
    },
    refetchInterval: 30_000,
  });

  return (
    <div className="glass-card rounded-3xl p-6 space-y-5 border border-white/[0.08]">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
          <Server className="w-5 h-5 text-emerald-400" />
          Node Health Snapshot
        </h3>
        <span className="text-xs text-slate-400">{agents.length} Total Registered Node(s)</span>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-slate-500 text-xs py-4">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-400" /> Loading storage agents...
        </div>
      ) : agents.length === 0 ? (
        <p className="text-slate-500 text-xs py-4 text-center">No storage nodes registered on the system.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {agents.map((agent) => {
            const isOnline = agent.status === "ONLINE";
            return (
              <div
                key={agent.id}
                className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${
                  isOnline
                    ? "bg-emerald-500/[0.03] border-emerald-500/20"
                    : "bg-white/[0.02] border-white/[0.05]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${isOnline ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-800 text-slate-500"}`}>
                    {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="text-xs font-mono font-bold text-white truncate max-w-[160px]">
                      {agent.cloudId}
                    </div>
                    <div className="text-[11px] text-slate-500">Owner: {agent.user.email}</div>
                  </div>
                </div>

                <div className="text-right space-y-0.5">
                  <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-full ${
                    isOnline ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-700/50 text-slate-400"
                  }`}>
                    {agent.status}
                  </span>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {agent.fileCount} File{agent.fileCount !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
