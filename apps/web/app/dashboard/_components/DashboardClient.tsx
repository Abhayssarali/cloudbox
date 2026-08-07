"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/stores/useAuthStore";
import type { AuthState } from "@/stores/useAuthStore";
import Link from "next/link";
import {
  HardDrive, CheckCircle2, AlertTriangle, Server, Plus,
  FolderOpen, Share2, Wifi, WifiOff, ArrowUpRight,
  Clock, Zap, X, Copy, Check, FileText, Image, Film, Archive,
  ShieldCheck, Activity, ChevronRight
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface AgentRecord {
  id: string;
  cloudId: string;
  status: "ONLINE" | "OFFLINE";
  lastHeartbeat: string | null;
  version: string | null;
  createdAt: string;
}

interface UserWithUsage {
  usedBytes: number;
  quotaBytes: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function DashboardClient() {
  const user = useAuthStore((s: AuthState) => s.user);
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [usage, setUsage] = useState<UserWithUsage | null>(null);
  const [fileStats, setFileStats] = useState<{ totalFiles: number; totalShares: number }>({ totalFiles: 0, totalShares: 0 });
  const [claimCode, setClaimCode] = useState<string | null>(null);
  const [isLoadingNode, setIsLoadingNode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const username = user?.email?.split("@")[0] ?? "User";

  // Fetch agents, user info & file counts
  const fetchDashboardData = useCallback(async () => {
    try {
      // Auth me
      const meRes = await fetch(`${API_URL}/auth/me`, { credentials: "include" });
      const meData = await meRes.json();
      if (meData.success) {
        setUsage({
          usedBytes: Number(meData.data.user.usedBytes || 0),
          quotaBytes: Number(meData.data.user.quotaBytes || 0),
        });
      }

      // Agents list
      const agentRes = await fetch(`${API_URL}/agents`, { credentials: "include" });
      const agentData = await agentRes.json();
      if (agentData.success && Array.isArray(agentData.data?.agents)) {
        setAgents(agentData.data.agents);
      }

      // Files list for metrics
      const filesRes = await fetch(`${API_URL}/files`, { credentials: "include" });
      const filesData = await filesRes.json();

      const shareRes = await fetch(`${API_URL}/sharing`, { credentials: "include" });
      const shareData = await shareRes.json();

      setFileStats({
        totalFiles: filesData.success && Array.isArray(filesData.data?.files) ? filesData.data.files.length : 0,
        totalShares: shareData.success && Array.isArray(shareData.data?.shareLinks) ? shareData.data.shareLinks.length : 0,
      });
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 15_000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  async function handleClaimNode() {
    setIsLoadingNode(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/agents/claim`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to generate claim code");
      setClaimCode(data.data.code);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoadingNode(false);
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const used = usage?.usedBytes ?? 0;
  const quota = usage?.quotaBytes ?? 0;
  const pct = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0;
  const onlineCount = agents.filter((a) => a.status === "ONLINE").length;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">

      {/* ── Ambient Background Glow ── */}
      <div className="ambient-glow top-0 left-1/3 w-96 h-96 bg-indigo-600" />
      <div className="ambient-glow top-20 right-1/4 w-80 h-80 bg-violet-600" />

      {/* ── Hero Welcome Banner ── */}
      <div className="relative overflow-hidden rounded-3xl glass-card p-8 border border-white/[0.08] bg-gradient-to-r from-indigo-950/40 via-slate-900/60 to-slate-950/80">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
              <Zap className="w-3.5 h-3.5 text-indigo-400" />
              <span>CloudBox Storage Network Active</span>
            </div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">
              Welcome back, <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">{username}</span> 👋
            </h2>
            <p className="text-sm text-slate-400 max-w-xl leading-relaxed">
              {isAdmin
                ? onlineCount > 0
                  ? `Your personal storage server network is online and synchronized across ${onlineCount} active node(s).`
                  : "No storage nodes currently online. Start your Ubuntu agent daemon to connect."
                : "Your personal private cloud is ready. Access and manage your files securely."}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/files"
              className="btn-primary px-5 py-3 rounded-2xl text-sm font-semibold flex items-center gap-2"
            >
              <FolderOpen className="w-4 h-4" />
              Browse Files
            </Link>

            {isAdmin && (
              <button
                onClick={handleClaimNode}
                disabled={isLoadingNode}
                className="px-5 py-3 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-white text-sm font-semibold transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4 text-indigo-400" />
                {isLoadingNode ? "Generating..." : "Add Storage Node"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Top Summary Metric Cards (4 Grid) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

        {/* Card 1: Storage Used */}
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Used Capacity</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <HardDrive className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white tracking-tight">{formatBytes(used)}</div>
            <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
              <span>{quota > 0 ? `of ${formatBytes(quota)} allocated` : "Unlimited storage"}</span>
              <span className="font-semibold text-indigo-400">{quota > 0 ? `${pct}%` : ""}</span>
            </div>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                pct >= 90 ? "bg-rose-500" : pct >= 75 ? "bg-amber-500" : "bg-gradient-to-r from-indigo-500 to-violet-500"
              }`}
              style={{ width: `${quota > 0 ? pct : 100}%` }}
            />
          </div>
        </div>

        {/* Card 2: Storage Nodes */}
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Storage Nodes</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Server className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              {onlineCount} <span className="text-xs font-normal text-slate-400">/ {agents.length} online</span>
            </div>
            <div className="text-xs text-emerald-400 font-medium mt-1 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${onlineCount > 0 ? "bg-emerald-400 status-pulse-green" : "bg-slate-500"}`} />
              {onlineCount > 0 ? "Tunnel Connected" : "Agent Offline"}
            </div>
          </div>
        </div>

        {/* Card 3: Total Files */}
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Files</span>
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
              <FolderOpen className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white tracking-tight">{fileStats.totalFiles}</div>
            <div className="text-xs text-slate-400 mt-1">Files synchronized across nodes</div>
          </div>
        </div>

        {/* Card 4: Active Shares */}
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Public Shares</span>
            <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400">
              <Share2 className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white tracking-tight">{fileStats.totalShares}</div>
            <div className="text-xs text-slate-400 mt-1">Active share tokens generated</div>
          </div>
        </div>

      </div>

      {/* ── Main Section: Storage Nodes & Activity Split ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left 2-Cols: Storage Node Management */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card rounded-3xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <Server className="w-5 h-5 text-indigo-400" />
                  Connected Storage Devices
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Ubuntu laptops and machines running the CloudBox Agent daemon
                </p>
              </div>

              {isAdmin && (
                <button
                  onClick={handleClaimNode}
                  disabled={isLoadingNode}
                  className="btn-primary px-4 py-2 rounded-xl text-xs flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Add Node
                </button>
              )}
            </div>

            {error && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                {error}
              </div>
            )}

            {agents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center bg-white/[0.02] border border-dashed border-white/10 rounded-2xl p-6 space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Server className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-white">No Storage Nodes Registered</p>
                  <p className="text-xs text-slate-400 max-w-sm">
                    Install the Agent script on your Ubuntu device to turn it into your private cloud server.
                  </p>
                </div>
                {isAdmin && (
                  <button
                    onClick={handleClaimNode}
                    className="btn-primary px-5 py-2.5 rounded-xl text-xs mt-2"
                  >
                    Claim First Device
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {agents.map((agent) => {
                  const isOnline = agent.status === "ONLINE";
                  return (
                    <div
                      key={agent.id}
                      className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${
                        isOnline
                          ? "bg-emerald-500/[0.03] border-emerald-500/20 hover:border-emerald-500/40"
                          : "bg-white/[0.02] border-white/[0.06] hover:border-white/10"
                      }`}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                          isOnline ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-slate-800 text-slate-500 border border-white/5"
                        }`}>
                          {isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-bold text-white truncate max-w-[200px] sm:max-w-xs">
                              {agent.cloudId}
                            </span>
                            <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${
                              isOnline ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-700/50 text-slate-400"
                            }`}>
                              {agent.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-slate-400 font-mono">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-500" />
                              {agent.lastHeartbeat ? `Heartbeat ${timeAgo(agent.lastHeartbeat)}` : "Never synced"}
                            </span>
                            {agent.version && (
                              <span>v{agent.version}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Link
                          href="/dashboard/files"
                          className="px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-slate-300 hover:text-white transition-colors"
                        >
                          Files
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Quick Access & Actions */}
        <div className="space-y-6">

          {/* Quick Actions Card */}
          <div className="glass-card rounded-3xl p-6 space-y-4">
            <h3 className="text-base font-bold text-white tracking-tight">Quick Shortcuts</h3>
            <div className="space-y-2">
              <Link
                href="/dashboard/files"
                className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.05] transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition-transform">
                    <FolderOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">File Explorer</div>
                    <div className="text-[11px] text-slate-500">Upload &amp; manage files</div>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
              </Link>

              <Link
                href="/dashboard/shared"
                className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.05] transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400 group-hover:scale-110 transition-transform">
                    <Share2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-violet-300 transition-colors">Shared Links</div>
                    <div className="text-[11px] text-slate-500">Public access management</div>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
              </Link>

              {isAdmin && (
                <Link
                  href="/dashboard/admin"
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.05] transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 group-hover:scale-110 transition-transform">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors">Admin Portal</div>
                      <div className="text-[11px] text-slate-500">Users, quotas &amp; audit logs</div>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
                </Link>
              )}
            </div>
          </div>

          {/* Cloud Security Guarantee Banner */}
          <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-900/30 to-violet-900/20 border border-indigo-500/20 space-y-3">
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs">
              <CheckCircle2 className="w-4 h-4" />
              Zero Central Disk Persistence
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Your file bytes are never stored on CloudBox central servers. All storage remains strictly on your local Ubuntu node hardware.
            </p>
          </div>

        </div>

      </div>

      {/* ── Claim Node Modal ── */}
      {claimCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
          <div className="bg-[#141b27] border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-white/[0.07] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Add Storage Node</h3>
                  <p className="text-xs text-slate-400">Link an Ubuntu machine to your CloudBox account</p>
                </div>
              </div>
              <button
                onClick={() => setClaimCode(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  1. Run Agent Service
                </p>
                <div className="flex items-center gap-2 bg-black/60 border border-white/[0.08] rounded-xl p-3">
                  <code className="text-xs text-indigo-300 font-mono flex-1 break-all">
                    pnpm --filter agent run dev start
                  </code>
                  <button
                    onClick={() => copyToClipboard("pnpm --filter agent run dev start", "start")}
                    className="p-1.5 text-slate-400 hover:text-white transition-colors"
                  >
                    {copiedCmd === "start" ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  2. Register Claim Code
                </p>
                <div className="flex items-center gap-2 bg-black/60 border border-white/[0.08] rounded-xl p-3">
                  <code className="text-xs text-indigo-300 font-mono flex-1 break-all">
                    npx cloudbox-agent register {claimCode}
                  </code>
                  <button
                    onClick={() => copyToClipboard(`npx cloudbox-agent register ${claimCode}`, "reg")}
                    className="p-1.5 text-slate-400 hover:text-white transition-colors"
                  >
                    {copiedCmd === "reg" ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
                This claim code expires in 10 minutes.
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setClaimCode(null)}
                className="btn-primary px-6 py-2.5 rounded-xl text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
