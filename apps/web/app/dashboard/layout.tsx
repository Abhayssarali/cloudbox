"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FolderOpen, Settings, LogOut, ShieldCheck, Share2 } from "lucide-react";
import { useAuthStore } from "@/stores/useAuthStore";
import type { AuthState } from "@/stores/useAuthStore";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useAuthStore((s: AuthState) => s.user);
  const clearUser = useAuthStore((s: AuthState) => s.clearUser);

  async function handleLogout() {
    await fetch(`${API_URL}/auth/logout`, { method: "POST", credentials: "include" });
    clearUser();
    window.location.href = "/login";
  }

  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const navItems = [
    { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
    { name: "My Files", href: "/dashboard/files", icon: FolderOpen },
    { name: "Shared", href: "/dashboard/shared", icon: Share2 },
    { name: "Settings", href: "/dashboard/settings", icon: Settings },
    ...(isAdmin ? [{ name: "Admin", href: "/dashboard/admin", icon: ShieldCheck }] : []),
  ];

  return (
    <div className="flex h-screen bg-[#0b0c10] text-gray-200 font-sans">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col bg-[#12141a] border-r border-[#1f2229]">
        <div className="p-6 flex items-center gap-3 border-b border-[#1f2229]">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white">
              <path d="M7 14c0-1.657 1.343-3 3-3a3 3 0 011.8.6A3 3 0 0115 10c1.657 0 3 1.343 3 3v1H7v-1z" fill="currentColor" />
              <circle cx="12" cy="8.5" r="2" fill="currentColor" />
            </svg>
          </div>
          <span className="font-bold text-lg tracking-tight text-white">CloudBox</span>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href));
            const Icon = item.icon;
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive 
                    ? "bg-indigo-500/10 text-indigo-400" 
                    : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#1f2229]">
          <div className="flex items-center gap-3 px-3 py-2 text-sm">
            <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 border border-gray-700">
              {user?.email?.charAt(0).toUpperCase() || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="truncate text-gray-300 font-medium">{user?.email?.split("@")[0]}</div>
              <div className="truncate text-xs text-gray-500">{user?.email}</div>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="mt-3 w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#0b0c10]">
        {children}
      </main>
    </div>
  );
}
