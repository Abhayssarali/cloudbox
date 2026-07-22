"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2, RotateCcw, AlertTriangle, File as FileIcon, Folder, FileImage, FileText, FileArchive, ShieldAlert } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type FileNode = {
  id: string;
  agentId: string;
  path: string;
  name: string;
  size: string;
  isFolder: boolean;
  mimeType: string | null;
  parentId: string | null;
  updatedAt: string;
  deletedAt: string | null;
};

function formatBytes(bytesStr: string) {
  const bytes = parseInt(bytesStr, 10);
  if (isNaN(bytes) || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function FileNodeIcon({ file, size = "w-5 h-5" }: { file: FileNode; size?: string }) {
  if (file.isFolder) return <Folder className={`${size} text-indigo-400 fill-indigo-400/20`} />;
  if (file.mimeType?.includes("image")) return <FileImage className={`${size} text-cyan-400`} />;
  if (file.mimeType?.includes("text") || file.mimeType?.includes("pdf")) return <FileText className={`${size} text-slate-300`} />;
  if (file.mimeType?.includes("zip") || file.mimeType?.includes("tar")) return <FileArchive className={`${size} text-amber-400`} />;
  return <FileIcon className={`${size} text-slate-400`} />;
}

export default function TrashPage() {
  const queryClient = useQueryClient();

  const { data: files = [], isLoading, error } = useQuery({
    queryKey: ["files", "trash"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/files/trash`, { credentials: "include" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data.files as FileNode[];
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const res = await fetch(`${API_URL}/files/${fileId}/restore`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files", "trash"] });
      queryClient.invalidateQueries({ queryKey: ["files"] });
    },
    onError: (err: Error) => { alert(`Restore failed: ${err.message}`); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const res = await fetch(`${API_URL}/files/${fileId}/permanent`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files", "trash"] });
    },
    onError: (err: Error) => { alert(`Permanent deletion failed: ${err.message}`); },
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">

      {/* Header Banner */}
      <div className="flex items-center justify-between pb-6 border-b border-white/[0.07]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Trash Manager</h2>
            <p className="text-xs text-slate-400">Items in trash are retained for 30 days before permanent deletion</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-full font-medium">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
          Auto-purged after 30 days
        </div>
      </div>

      {error ? (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl">
          Failed to load trash: {(error as Error).message}
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-20 text-slate-500 gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
          <span className="text-xs font-medium">Loading deleted items...</span>
        </div>
      ) : files.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center glass-card rounded-3xl p-8 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-slate-600">
            <Trash2 className="w-7 h-7" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-400">Trash is completely empty</p>
            <p className="text-xs text-slate-600 max-w-sm mt-1">
              Deleted files will appear here until they are permanently removed or restored.
            </p>
          </div>
        </div>
      ) : (
        <div className="glass-card rounded-3xl border border-white/[0.07] overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/[0.07] bg-white/[0.02] text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="p-4">Item Name</th>
                <th className="p-4">Original Path</th>
                <th className="p-4">Size</th>
                <th className="p-4">Deleted Date</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {files.map((file) => (
                <tr key={file.id} className="hover:bg-white/[0.03] transition-colors text-xs text-slate-300">
                  <td className="p-4 font-semibold text-white flex items-center gap-3">
                    <FileNodeIcon file={file} />
                    <span className="truncate max-w-xs">{file.name}</span>
                  </td>
                  <td className="p-4 font-mono text-slate-500 text-[11px] truncate max-w-xs">{file.path}</td>
                  <td className="p-4 text-slate-400 font-mono">{formatBytes(file.size)}</td>
                  <td className="p-4 text-slate-500 font-mono">
                    {file.deletedAt ? new Date(file.deletedAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => restoreMutation.mutate(file.id)}
                        disabled={restoreMutation.isPending || deleteMutation.isPending}
                        className="px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                        title="Restore to original location"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Restore
                      </button>

                      <button
                        onClick={() => {
                          if (confirm(`Permanently delete "${file.name}"? This action CANNOT be undone.`)) {
                            deleteMutation.mutate(file.id);
                          }
                        }}
                        disabled={restoreMutation.isPending || deleteMutation.isPending}
                        className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors border border-rose-500/20 disabled:opacity-50"
                        title="Delete Permanently"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </button>
                    </div>
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
