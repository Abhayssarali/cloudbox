"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link2, Trash2, Loader2, Share2, Clipboard, ExternalLink, Check, Copy, FileText, Globe } from "lucide-react";
import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type ShareLink = {
  id: string;
  token: string;
  fileId: string;
  fileName: string;
  fileSize: string;
  mimeType: string | null;
  expiresAt: string | null;
  createdAt: string;
};

export default function SharedLinksPage() {
  const queryClient = useQueryClient();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: shareLinks = [], isLoading, error } = useQuery({
    queryKey: ["shareLinks"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/sharing`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data.shareLinks as ShareLink[];
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_URL}/sharing/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shareLinks"] });
    },
    onError: (err: Error) => {
      alert(`Failed to revoke link: ${err.message}`);
    },
  });

  const copyToClipboard = (token: string, id: string) => {
    const shareUrl = `${window.location.origin}/s/${token}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatBytes = (bytesStr: string) => {
    const bytes = parseInt(bytesStr, 10);
    if (isNaN(bytes) || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">

      {/* Header Banner */}
      <div className="flex items-center justify-between pb-6 border-b border-white/[0.07]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Shared Links</h2>
            <p className="text-xs text-slate-400">Manage and audit active public access tokens for your files</p>
          </div>
        </div>

        <div className="px-3.5 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] text-xs text-slate-300 font-medium">
          {shareLinks.length} Active Link(s)
        </div>
      </div>

      {error ? (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl">
          Failed to load shared links: {(error as Error).message}
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-20 text-slate-500 gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
          <span className="text-xs font-medium">Loading share links...</span>
        </div>
      ) : shareLinks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center glass-card rounded-3xl p-8 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-slate-600">
            <Globe className="w-7 h-7" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-400">No active public share links</p>
            <p className="text-xs text-slate-600 max-w-sm mt-1">
              Generate share links directly from the File Explorer to grant public access without authenticating.
            </p>
          </div>
        </div>
      ) : (
        <div className="glass-card rounded-3xl border border-white/[0.07] overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/[0.07] bg-white/[0.02] text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="p-4">Shared File</th>
                <th className="p-4">Size</th>
                <th className="p-4">Created Date</th>
                <th className="p-4">Expiration</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {shareLinks.map((link) => {
                const shareUrl = `${window.location.origin}/s/${link.token}`;
                return (
                  <tr key={link.id} className="hover:bg-white/[0.03] transition-colors text-xs text-slate-300">
                    <td className="p-4 font-semibold text-white max-w-xs truncate flex items-center gap-3">
                      <FileText className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                      <span className="truncate">{link.fileName}</span>
                    </td>
                    <td className="p-4 text-slate-400 font-mono">{formatBytes(link.fileSize)}</td>
                    <td className="p-4 text-slate-500 font-mono">{new Date(link.createdAt).toLocaleDateString()}</td>
                    <td className="p-4 text-slate-500 font-mono">
                      {link.expiresAt ? new Date(link.expiresAt).toLocaleDateString() : "Never"}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => copyToClipboard(link.token, link.id)}
                          className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/10 text-slate-200 border border-white/5 transition-all text-xs font-semibold flex items-center gap-1.5"
                          title="Copy public link"
                        >
                          {copiedId === link.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Clipboard className="w-3.5 h-3.5 text-slate-400" />}
                          {copiedId === link.id ? "Copied!" : "Copy URL"}
                        </button>

                        <a
                          href={shareUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-xl bg-white/[0.04] hover:bg-white/10 text-slate-300 hover:text-white transition-colors border border-white/5"
                          title="View Share Landing Page"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>

                        <button
                          onClick={() => {
                            if (confirm("Revoke this public link? Access will be terminated immediately.")) {
                              revokeMutation.mutate(link.id);
                            }
                          }}
                          disabled={revokeMutation.isPending}
                          className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors border border-rose-500/20 disabled:opacity-50"
                          title="Revoke Public Link"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
