"use client";

import { useQuery } from "@tanstack/react-query";
import { Users, Server, HardDrive, FileText, Loader2, Wifi, WifiOff } from "lucide-react";

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
      color: "from-indigo-500 to-blue-500",
      bg: "bg-indigo-500/10",
    },
    {
      label: "Storage Nodes",
      value: stats?.agentCount ?? 0,
      sub: `${stats?.onlineAgentCount ?? 0} online`,
      icon: Server,
      color: "from-cyan-500 to-teal-500",
      bg: "bg-cyan-500/10",
    },
    {
      label: "Total Files",
      value: stats?.fileCount ?? 0,
      icon: FileText,
      color: "from-violet-500 to-purple-500",
      bg: "bg-violet-500/10",
    },
    {
      label: "Storage Used",
      value: formatBytes(stats?.totalUsedBytes ?? "0"),
      icon: HardDrive,
      color: "from-fuchsia-500 to-pink-500",
      bg: "bg-fuchsia-500/10",
    },
  ];

  if (error) {
    return (
      <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg">
        Failed to load stats: {(error as Error).message}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Platform Overview</h2>
        <p className="text-sm text-gray-500">Real-time snapshot of your CloudBox platform.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-[#12141a] border border-[#1f2229] rounded-xl p-5 flex flex-col gap-4"
            >
              <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div>
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
                ) : (
                  <>
                    <div className="text-2xl font-bold text-white">{card.value}</div>
                    {card.sub && <div className="text-xs text-gray-500 mt-0.5">{card.sub}</div>}
                  </>
                )}
                <div className="text-sm text-gray-400 mt-1">{card.label}</div>
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
    <div>
      <h3 className="text-base font-semibold text-white mb-3">Storage Nodes</h3>
      {isLoading ? (
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading agents...
        </div>
      ) : agents.length === 0 ? (
        <p className="text-gray-500 text-sm">No storage nodes registered.</p>
      ) : (
        <div className="space-y-2">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="bg-[#12141a] border border-[#1f2229] rounded-lg px-4 py-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                {agent.status === "ONLINE" ? (
                  <Wifi className="w-4 h-4 text-emerald-400" />
                ) : (
                  <WifiOff className="w-4 h-4 text-gray-600" />
                )}
                <div>
                  <div className="text-sm font-medium text-gray-200 font-mono">
                    {agent.cloudId.substring(0, 16)}…
                  </div>
                  <div className="text-xs text-gray-500">Owner: {agent.user.email}</div>
                </div>
              </div>
              <div className="text-right">
                <div
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    agent.status === "ONLINE"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-gray-500/10 text-gray-500"
                  }`}
                >
                  {agent.status}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {agent.fileCount} file{agent.fileCount !== 1 ? "s" : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
