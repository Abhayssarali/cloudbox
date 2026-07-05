"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, LogIn, Upload, UserPlus, Activity } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type LogEntry = {
  id: string;
  action: string;
  userEmail: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
};

const ACTION_CONFIG: Record<string, { label: string; Icon: React.ElementType; color: string }> = {
  LOGIN: { label: "User Login", Icon: LogIn, color: "text-blue-400 bg-blue-500/10" },
  SIGNUP: { label: "New Signup", Icon: UserPlus, color: "text-emerald-400 bg-emerald-500/10" },
  UPLOAD: { label: "File Upload", Icon: Upload, color: "text-indigo-400 bg-indigo-500/10" },
};

function getActionConfig(action: string) {
  return ACTION_CONFIG[action] ?? { label: action, Icon: Activity, color: "text-gray-400 bg-gray-500/10" };
}

export default function AdminActivity() {
  const { data: logs = [], isLoading, error } = useQuery<LogEntry[]>({
    queryKey: ["admin", "activity"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/admin/activity?limit=100`, { credentials: "include" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data.logs;
    },
    refetchInterval: 15_000,
  });

  if (error) {
    return (
      <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg">
        Failed to load activity: {(error as Error).message}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Activity Log</h2>
        <p className="text-sm text-gray-500">Audit trail of the last 100 platform events.</p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-gray-500 py-10">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading activity…
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 text-gray-500">No activity recorded yet.</div>
      ) : (
        <div className="bg-[#12141a] border border-[#1f2229] rounded-xl overflow-hidden">
          <div className="divide-y divide-[#1a1c22]">
            {logs.map((log) => {
              const { label, Icon, color } = getActionConfig(log.action);
              return (
                <div key={log.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-200 font-medium">{label}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {log.userEmail ?? "System"}
                      {log.meta && typeof log.meta === "object" && "name" in log.meta
                        ? ` · ${String(log.meta.name)}`
                        : ""}
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 shrink-0">
                    {new Date(log.createdAt).toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
