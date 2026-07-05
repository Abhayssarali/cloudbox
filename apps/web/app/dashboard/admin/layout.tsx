"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/useAuthStore";
import { useEffect } from "react";
import { Users, Server, Activity, BarChart3 } from "lucide-react";

const adminTabs = [
  { name: "Overview", href: "/dashboard/admin", icon: BarChart3 },
  { name: "Users", href: "/dashboard/admin/users", icon: Users },
  { name: "Agents", href: "/dashboard/admin/agents", icon: Server },
  { name: "Activity", href: "/dashboard/admin/activity", icon: Activity },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s: any) => s.user);

  useEffect(() => {
    if (user && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      router.replace("/dashboard");
    }
  }, [user, router]);

  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    return null;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Admin Header */}
      <div className="bg-[#12141a] border-b border-[#1f2229] px-6 pt-6 pb-0">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V7l-9-5z" fill="currentColor" />
            </svg>
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">Admin Dashboard</h1>
            <p className="text-gray-500 text-xs">Platform management &amp; monitoring</p>
          </div>
        </div>

        {/* Sub-nav tabs */}
        <nav className="flex gap-1">
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
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                  isActive
                    ? "border-violet-500 text-violet-400 bg-violet-500/5"
                    : "border-transparent text-gray-500 hover:text-gray-300 hover:bg-white/5"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.name}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-[#0b0c10]">{children}</div>
    </div>
  );
}
