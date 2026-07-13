"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Edit2, Check, X } from "lucide-react";

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

type Group = { id: string; name: string };

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
  const [editingGroup, setEditingGroup] = useState<{ userId: string } | null>(null);

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
    onError: (e: Error) => alert(`Failed: ${e.message}`),
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
    onError: (e: Error) => alert(`Failed: ${e.message}`),
  });

  const groupMutation = useMutation({
    mutationFn: async ({ userId, groupId }: { userId: string; groupId: string | null }) => {
      const res = await fetch(`${API_URL}/admin/users/${userId}/group`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      setEditingGroup(null);
    },
    onError: (e: Error) => alert(`Failed: ${e.message}`),
  });

  const { data: groups = [] } = useQuery<Group[]>({
    queryKey: ["admin", "groups"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/admin/groups`, { credentials: "include" });
      const data = await res.json();
      if (!data.success) return [];
      return data.data.groups;
    },
  });

  if (error) {
    return (
      <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg">
        Failed to load users: {(error as Error).message}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">User Management</h2>
        <p className="text-sm text-gray-500">Manage roles, quotas, and groups for all platform users.</p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-gray-500 py-10">
          <Loader2 className="w-5 h-5 animate-spin" />Loading users…
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#1f2229]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1f2229] bg-[#12141a]">
                <th className="text-left px-4 py-3 text-gray-400 font-medium">User</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Role</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Group</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Storage Used</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Quota</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-[#1a1c22] hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 text-xs border border-gray-700">
                        {u.email.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-gray-200 truncate max-w-[180px]">{u.email}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {editingRole?.userId === u.id ? (
                      <div className="flex items-center gap-1">
                        <select
                          className="bg-[#1f2229] border border-[#2d3139] text-gray-200 text-xs rounded px-2 py-1"
                          defaultValue={u.role}
                          onChange={(e) => roleMutation.mutate({ userId: u.id, role: e.target.value })}
                        >
                          <option value="USER">USER</option>
                          <option value="ADMIN">ADMIN</option>
                          <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                        </select>
                        <button onClick={() => setEditingRole(null)}>
                          <X className="w-4 h-4 text-gray-500 hover:text-rose-400" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          u.role === "SUPER_ADMIN" ? "bg-fuchsia-500/10 text-fuchsia-400"
                          : u.role === "ADMIN" ? "bg-violet-500/10 text-violet-400"
                          : "bg-gray-500/10 text-gray-400"
                        }`}>{u.role}</span>
                        <button onClick={() => setEditingRole({ userId: u.id })}>
                          <Edit2 className="w-3 h-3 text-gray-600 hover:text-gray-300" />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {editingGroup?.userId === u.id ? (
                      <div className="flex items-center gap-1">
                        <select
                          className="bg-[#1f2229] border border-[#2d3139] text-gray-200 text-xs rounded px-2 py-1"
                          defaultValue={u.groupId ?? ""}
                          onChange={(e) => groupMutation.mutate({ userId: u.id, groupId: e.target.value || null })}
                        >
                          <option value="">— No group</option>
                          {groups.map((g) => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>
                        <button onClick={() => setEditingGroup(null)}>
                          <X className="w-4 h-4 text-gray-500 hover:text-rose-400" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span>{u.group?.name ?? "—"}</span>
                        <button onClick={() => setEditingGroup({ userId: u.id })}>
                          <Edit2 className="w-3 h-3 text-gray-600 hover:text-gray-300" />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-300 text-xs">{formatBytes(u.usedBytes)}</div>
                    {parseInt(u.quotaBytes, 10) > 0 && (
                      <div className="w-28 bg-gray-800 rounded-full h-1 mt-1.5">
                        <div
                          className="bg-indigo-500 h-1 rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, (parseInt(u.usedBytes, 10) / parseInt(u.quotaBytes, 10)) * 100).toFixed(1)}%`,
                          }}
                        />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingQuota?.userId === u.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={editingQuota.value}
                          onChange={(e) => setEditingQuota({ ...editingQuota, value: e.target.value })}
                          className="w-20 bg-[#1f2229] border border-[#2d3139] text-gray-200 text-xs rounded px-2 py-1"
                          placeholder="GB"
                        />
                        <span className="text-gray-500 text-xs">GB</span>
                        <button
                          onClick={() =>
                            quotaMutation.mutate({ userId: u.id, quotaGB: parseFloat(editingQuota.value) })
                          }
                        >
                          <Check className="w-4 h-4 text-emerald-400 hover:text-emerald-300" />
                        </button>
                        <button onClick={() => setEditingQuota(null)}>
                          <X className="w-4 h-4 text-gray-500 hover:text-rose-400" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-300 text-xs">
                          {parseInt(u.quotaBytes, 10) === 0
                            ? "Unlimited"
                            : formatBytes(u.quotaBytes)}
                        </span>
                        <button
                          onClick={() =>
                            setEditingQuota({
                              userId: u.id,
                              value: String(parseInt(u.quotaBytes, 10) / (1024 ** 3) || 0),
                            })
                          }
                        >
                          <Edit2 className="w-3 h-3 text-gray-600 hover:text-gray-300" />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
