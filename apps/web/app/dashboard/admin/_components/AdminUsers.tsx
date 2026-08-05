"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Edit2, X, UserMinus, ShieldCheck, Users, Check, Save } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type AdminUser = {
  id: string;
  email: string;
  role: "USER" | "ADMIN" | "SUPER_ADMIN";
  quotaBytes: string;
  usedBytes: string;
  groupId: string | null;
  group: { name: string } | null;
  createdAt: string;
};
function formatBytes(bytesStr: string) {
  const bytes = parseInt(bytesStr, 10);
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

export default function AdminUsers() {
  const qc = useQueryClient();
  const [editingQuota, setEditingQuota] = useState<{ userId: string; value: string } | null>(null);
  const [editingRole, setEditingRole] = useState<{ userId: string } | null>(null);

  const { data: users = [], isLoading, error } = useQuery<AdminUser[]>({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/admin/users`, { credentials: "include" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data.users;
    },
  });

  const quotaMutation = useMutation({
    mutationFn: async ({ userId, quotaGB }: { userId: string; quotaGB: number }) => {
      const quotaBytes = Math.floor(quotaGB * 1024 * 1024 * 1024);
      const res = await fetch(`${API_URL}/admin/users/${userId}/quota`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quotaBytes }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      setEditingQuota(null);
    },
    onError: (e: Error) => alert(`Quota update failed: ${e.message}`),
  });

  const roleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const res = await fetch(`${API_URL}/admin/users/${userId}/role`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      setEditingRole(null);
    },
    onError: (e: Error) => alert(`Role update failed: ${e.message}`),
  });

  const removeMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`${API_URL}/admin/users/${userId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "users"] }),
    onError: (e: Error) => alert(`Remove failed: ${e.message}`),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-6 border-b border-white/[0.07]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Workspace Members</h2>
            <p className="text-xs text-slate-400">Manage account access, permissions, and storage allocations</p>
          </div>
        </div>

        <div className="px-3.5 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] text-xs text-slate-300 font-medium">
          {users.length} Registered User(s)
        </div>
      </div>

      {error ? (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl">
          Failed to load workspace members: {(error as Error).message}
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-20 text-slate-500 gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
          <span className="text-xs font-medium">Loading workspace users...</span>
        </div>
      ) : users.length === 0 ? (
        <div className="glass-card rounded-3xl p-12 text-center space-y-3">
          <Users className="w-10 h-10 mx-auto text-slate-600" />
          <p className="text-sm font-semibold text-white">No members registered</p>
          <p className="text-xs text-slate-400">Share your workspace invite token from the Overview page to onboard users.</p>
        </div>
      ) : (
        <div className="glass-card rounded-3xl border border-white/[0.07] overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/[0.07] bg-white/[0.02] text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="p-4">Member Email</th>
                <th className="p-4">Role</th>
                <th className="p-4">Storage Used</th>
                <th className="p-4">Quota Limit</th>
                <th className="p-4">Joined Date</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {users.map((u) => {
                const used = Number(u.usedBytes || 0);
                const quota = Number(u.quotaBytes || 0);
                const pct = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0;

                return (
                  <tr key={u.id} className="hover:bg-white/[0.03] transition-colors text-xs text-slate-300">
                    <td className="p-4 font-semibold text-white flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center text-xs">
                        {u.email.charAt(0).toUpperCase()}
                      </div>
                      <span className="truncate max-w-xs">{u.email}</span>
                    </td>

                    {/* Role selector */}
                    <td className="p-4">
                      {editingRole?.userId === u.id ? (
                        <div className="flex items-center gap-2">
                          <select
                            defaultValue={u.role}
                            onChange={(e) => roleMutation.mutate({ userId: u.id, role: e.target.value })}
                            className="bg-[#0b0e14] border border-white/10 text-xs text-white rounded-lg px-2 py-1 focus:outline-none"
                          >
                            <option value="USER">USER</option>
                            <option value="ADMIN">ADMIN</option>
                            <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                          </select>
                          <button onClick={() => setEditingRole(null)} className="text-slate-500 hover:text-slate-300">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            u.role === "SUPER_ADMIN" ? "bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30" :
                            u.role === "ADMIN" ? "bg-violet-500/20 text-violet-300 border border-violet-500/30" :
                            "bg-slate-700/40 text-slate-300"
                          }`}>
                            {u.role}
                          </span>
                          <button onClick={() => setEditingRole({ userId: u.id })} className="text-slate-500 hover:text-slate-300">
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Storage usage */}
                    <td className="p-4 space-y-1">
                      <div className="font-mono text-slate-300">{formatBytes(u.usedBytes)}</div>
                      {quota > 0 && (
                        <div className="w-24 h-1 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </td>

                    {/* Quota limit */}
                    <td className="p-4 font-mono">
                      {editingQuota?.userId === u.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            value={editingQuota.value}
                            onChange={(e) => setEditingQuota({ userId: u.id, value: e.target.value })}
                            className="w-16 bg-[#0b0e14] border border-white/10 text-xs text-white rounded-lg px-2 py-1 focus:outline-none"
                            placeholder="GB"
                          />
                          <span className="text-slate-500">GB</span>
                          <button
                            onClick={() => quotaMutation.mutate({ userId: u.id, quotaGB: parseFloat(editingQuota.value) || 0 })}
                            className="text-indigo-400 font-bold hover:text-indigo-300"
                          >
                            Save
                          </button>
                          <button onClick={() => setEditingQuota(null)} className="text-slate-500 hover:text-slate-300">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">
                            {quota === 0 ? "Unlimited" : formatBytes(u.quotaBytes)}
                          </span>
                          <button
                            onClick={() => setEditingQuota({ userId: u.id, value: (quota / (1024 ** 3)).toFixed(0) })}
                            className="text-slate-500 hover:text-slate-300"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </td>

                    <td className="p-4 font-mono text-slate-500">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>

                    {/* Remove Action */}
                    <td className="p-4 text-right">
                      <button
                        onClick={() => {
                          if (confirm(`Remove ${u.email} from workspace?`)) {
                            removeMutation.mutate(u.id);
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold flex items-center gap-1.5 ml-auto transition-colors"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
