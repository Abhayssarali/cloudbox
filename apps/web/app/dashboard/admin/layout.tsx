"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/useAuthStore";
import type { AuthState } from "@/stores/useAuthStore";
import { useEffect } from "react";
import { Users, Server, Activity, BarChart3, ShieldCheck } from "lucide-react";

const adminTabs = [
  { name: "Overview", href: "/dashboard/admin", icon: BarChart3 },
  { name: "Users", href: "/dashboard/admin/users", icon: Users },
  { name: "Agents", href: "/dashboard/admin/agents", icon: Server },
  { name: "Activity", href: "/dashboard/admin/activity", icon: Activity },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s: AuthState) => s.user);

  useEffect(() => {
    if (user && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      router.replace("/dashboard");
    }
  }, [user, router]);

  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    return null;
  }

  return (
    <div className="flex flex-col h-full bg-[#0b0e14]">

      {/* Admin Header Sub-nav */}
      <div className="bg-[#0f141f]/80 backdrop-blur-md border-b border-white/[0.07] px-8 pt-6 pb-0">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Admin Management Portal</h2>
            <p className="text-xs text-slate-400">System oversight, user quota allocation &amp; agent telemetry</p>
          </div>
        </div>

        {/* Sub-nav tabs */}
        <nav className="flex gap-2">
          {adminTabs.map((tab) => {
            const isActive =
              tab.href === "/dashboard/admin"
                ? pathname === tab.href
                : pathname?.startsWith(tab.href);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 transition-all ${
                  isActive
                    ? "border-violet-400 text-violet-300 bg-white/[0.05]"
                    : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.name}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto p-8">{children}</div>
    </div>
  );
}
