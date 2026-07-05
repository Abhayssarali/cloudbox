"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link2, Trash2, Loader2, Share2, Clipboard, ExternalLink } from "lucide-react";
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
    if (isNaN(bytes) || bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="flex flex-col flex-1 p-8 overflow-y-auto bg-[#0b0c10]">
      <div className="max-w-5xl w-full mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
            <Share2 className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Shared Links</h1>
            <p className="text-sm text-gray-400">Manage all public sharing links you have created.</p>
          </div>
        </div>

        {error ? (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg">
            Failed to load shared links: {(error as Error).message}
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-500 gap-3">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Loading links...</span>
          </div>
        ) : shareLinks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500 bg-[#12141a] rounded-xl border border-[#1f2229]">
            <Link2 className="w-16 h-16 text-[#1f2229] mb-4" />
            <p className="text-gray-400 font-medium">No shared links created yet</p>
            <p className="text-sm text-gray-600 mt-1">Select a file in My Files to generate a public link.</p>
          </div>
        ) : (
          <div className="bg-[#12141a] border border-[#1f2229] rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#1f2229] bg-black/20 text-gray-400 text-sm font-medium">
                  <th className="p-4">File Name</th>
                  <th className="p-4">Size</th>
                  <th className="p-4">Created At</th>
                  <th className="p-4">Expires</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shareLinks.map((link) => {
                  const shareUrl = `${window.location.origin}/s/${link.token}`;
                  return (
                    <tr key={link.id} className="border-b border-[#1f2229]/50 hover:bg-white/[0.01] transition-colors text-sm text-gray-300">
                      <td className="p-4 font-medium text-white max-w-xs truncate">
                        {link.fileName}
                      </td>
                      <td className="p-4 text-gray-400">{formatBytes(link.fileSize)}</td>
                      <td className="p-4 text-gray-400">{new Date(link.createdAt).toLocaleDateString()}</td>
                      <td className="p-4 text-gray-400">
                        {link.expiresAt ? new Date(link.expiresAt).toLocaleDateString() : "Never"}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => copyToClipboard(link.token, link.id)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors border border-[#1f2229] text-xs font-semibold flex items-center gap-1"
                            title="Copy link to clipboard"
                          >
                            <Clipboard className="w-3.5 h-3.5" />
                            {copiedId === link.id ? "Copied!" : "Copy"}
                          </button>
                          <a
                            href={shareUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors border border-[#1f2229]"
                            title="Open link"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          <button
                            onClick={() => {
                              if (confirm("Are you sure you want to revoke this public link? It will stop working immediately.")) {
                                revokeMutation.mutate(link.id);
                              }
                            }}
                            disabled={revokeMutation.isPending}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors border border-rose-500/20"
                            title="Revoke link"
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
    </div>
  );
}
