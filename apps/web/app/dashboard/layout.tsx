"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, FolderOpen, Settings, LogOut,
  ShieldCheck, Share2, Trash2, ChevronRight, Cloud,
  HardDrive, Server, Search, Bell, Plus, User, CheckCircle2,
  ChevronDown
} from "lucide-react";
import { useAuthStore } from "@/stores/useAuthStore";
import type { AuthState } from "@/stores/useAuthStore";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const NAV_MAIN = [
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { name: "My Files", href: "/dashboard/files", icon: FolderOpen },
  { name: "Shared Links", href: "/dashboard/shared", icon: Share2 },
  { name: "Trash", href: "/dashboard/trash", icon: Trash2 },
];

const NAV_SYSTEM = [
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useAuthStore((s: AuthState) => s.user);
  const clearUser = useAuthStore((s: AuthState) => s.clearUser);
  const setUser = useAuthStore((s: AuthState) => s.setUser);

  const [usage, setUsage] = useState<{ usedBytes: number; quotaBytes: number } | null>(null);
  const [agentOnline, setAgentOnline] = useState<boolean | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Sync session & fetch user usage on mount
  useEffect(() => {
    fetch(`${API_URL}/auth/me`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data?.user) {
          setUser({ id: d.data.user.id, email: d.data.user.email, role: d.data.user.role });
          setUsage({
            usedBytes: Number(d.data.user.usedBytes || 0),
            quotaBytes: Number(d.data.user.quotaBytes || 0),
          });
        } else {
          clearUser();
          window.location.href = "/login";
        }
      })
      .catch(() => {});

    // Check agent status periodically
    const checkAgents = () => {
      fetch(`${API_URL}/agents`, { credentials: "include" })
        .then((r) => r.json())
        .then((d) => {
          if (d.success && Array.isArray(d.data?.agents)) {
            const hasOnline = d.data.agents.some((a: { status: string }) => a.status === "ONLINE");
            setAgentOnline(hasOnline);
          } else {
            setAgentOnline(false);
          }
        })
        .catch(() => setAgentOnline(false));
    };

    checkAgents();
    const interval = setInterval(checkAgents, 10_000);
    return () => clearInterval(interval);
  }, [setUser, clearUser]);

  async function handleLogout() {
    await fetch(`${API_URL}/auth/logout`, { method: "POST", credentials: "include" });
    clearUser();
    window.location.href = "/login";
  }

  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const initials = user?.email?.charAt(0).toUpperCase() ?? "U";
  const username = user?.email?.split("@")[0] ?? "User";

  const used = usage?.usedBytes ?? 0;
  const quota = usage?.quotaBytes ?? 0;
  const pct = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0;

  function NavItem({ name, href, icon: Icon }: { name: string; href: string; icon: React.ElementType }) {
    const isActive = href === "/dashboard"
      ? pathname === href
      : pathname?.startsWith(href);

    return (
      <Link
        href={href}
        className={`group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
          isActive
            ? "bg-gradient-to-r from-indigo-500/15 to-violet-500/10 text-white shadow-sm border border-indigo-500/20"
            : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
        }`}
      >
        <Icon className={`w-4 h-4 flex-shrink-0 transition-colors ${isActive ? "text-indigo-400" : "text-slate-500 group-hover:text-slate-300"}`} />
        <span className="flex-1 truncate">{name}</span>
        {isActive && <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_#818cf8]" />}
      </Link>
    );
  }

  return (
    <div className="flex h-screen bg-[#0b0e14] text-slate-100 font-sans overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className="w-64 flex flex-col flex-shrink-0 bg-[#0f141f]/90 backdrop-blur-xl border-r border-white/[0.07] z-20">

        {/* Brand Header */}
        <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform flex-shrink-0">
              <Cloud className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
                CloudBox
                <span className="text-[10px] font-semibold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">PRO</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Personal Storage Cloud</p>
            </div>
          </Link>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">

          {/* Main Menu */}
          <div>
            <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Storage &amp; Files
            </div>
            <div className="space-y-1">
              {NAV_MAIN.map((item) => <NavItem key={item.href} {...item} />)}
            </div>
          </div>

          {/* Admin Panel (Conditional) */}
          {isAdmin && (
            <div>
              <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-violet-400 flex items-center justify-between">
                <span>Management</span>
                <span className="text-[9px] px-1.5 py-0.2 bg-violet-500/15 text-violet-300 rounded font-semibold">ADMIN</span>
              </div>
              <div className="space-y-1">
                <NavItem name="Admin Portal" href="/dashboard/admin" icon={ShieldCheck} />
              </div>
            </div>
          )}

          {/* System Settings */}
          <div>
            <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Preferences
            </div>
            <div className="space-y-1">
              {NAV_SYSTEM.map((item) => <NavItem key={item.href} {...item} />)}
            </div>
          </div>

        </div>

        {/* Sidebar Footer: Storage Meter & User Profile */}
        <div className="p-3 border-t border-white/[0.07] space-y-3 bg-[#0d111a]/50">

          {/* Storage Quota Progress Card */}
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
                Storage
              </span>
              <span className="text-slate-300 font-semibold">{quota > 0 ? `${pct}%` : "Usage"}</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  pct >= 90 ? "bg-rose-500" : pct >= 75 ? "bg-amber-500" : "bg-gradient-to-r from-indigo-500 to-violet-500"
                }`}
                style={{ width: `${quota > 0 ? pct : 100}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500 font-mono">
              <span>{formatBytes(used)} used</span>
              <span>{quota > 0 ? formatBytes(quota) : "Unlimited"}</span>
            </div>
          </div>

          {/* User Profile Card */}
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.05] transition-all text-left group"
            >
              <div className="relative">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-xs shadow-md">
                  {initials}
                </div>
                <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0f141f] ${
                  agentOnline === true ? "bg-emerald-400" : "bg-slate-500"
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-white truncate group-hover:text-indigo-300 transition-colors">
                  {username}
                </div>
                <div className="text-[10px] text-slate-400 truncate">{user?.email}</div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 transition-colors" />
            </button>

            {/* Profile Dropdown Popup */}
            {showProfileMenu && (
              <div className="absolute bottom-14 left-0 right-0 z-30 bg-[#141b27] border border-white/10 rounded-xl shadow-2xl p-1.5 space-y-1 backdrop-blur-xl">
                <div className="px-3 py-2 border-b border-white/[0.06]">
                  <p className="text-[11px] font-semibold text-slate-400">Signed in as</p>
                  <p className="text-xs font-medium text-white truncate">{user?.email}</p>
                  <span className={`inline-block mt-1 text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                    user?.role === "SUPER_ADMIN" ? "bg-fuchsia-500/20 text-fuchsia-300" :
                    user?.role === "ADMIN" ? "bg-violet-500/20 text-violet-300" :
                    "bg-slate-700/50 text-slate-300"
                  }`}>
                    {user?.role || "USER"}
                  </span>
                </div>
                <Link
                  href="/dashboard/settings"
                  onClick={() => setShowProfileMenu(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                  <Settings className="w-3.5 h-3.5 text-slate-400" />
                  Account Settings
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors text-left"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            )}
          </div>

        </div>
      </aside>

      {/* ── Main View Area ── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#0b0e14]">

        {/* Top Navbar */}
        <header className="h-16 border-b border-white/[0.07] bg-[#0f141f]/70 backdrop-blur-xl px-8 flex items-center justify-between z-10">
          <div className="flex items-center gap-4">
            <h1 className="text-base font-bold text-white tracking-tight">
              {pathname === "/dashboard" && "Dashboard Overview"}
              {pathname === "/dashboard/files" && "My Files"}
              {pathname === "/dashboard/shared" && "Shared Links"}
              {pathname === "/dashboard/trash" && "Trash"}
              {pathname === "/dashboard/settings" && "Settings"}
              {pathname?.startsWith("/dashboard/admin") && "Admin Portal"}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Storage Node Live Connection Badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] text-xs font-medium text-slate-300">
              <span className={`w-2 h-2 rounded-full ${
                agentOnline === true ? "bg-emerald-400 status-pulse-green" : agentOnline === false ? "bg-rose-400" : "bg-amber-400"
              }`} />
              <span>
                {agentOnline === true ? "Storage Node Online" : agentOnline === false ? "Node Offline" : "Checking Status..."}
              </span>
            </div>

            {/* Quick Upload Link Button */}
            <Link
              href="/dashboard/files"
              className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-xs"
            >
              <Plus className="w-4 h-4" />
              Upload File
            </Link>
          </div>
        </header>

        {/* Content Page Injection */}
        <div className="flex-1 overflow-y-auto relative">
          {children}
        </div>
      </main>

    </div>
  );
}
