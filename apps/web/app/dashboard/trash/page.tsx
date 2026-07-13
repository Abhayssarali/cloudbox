"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2, RotateCcw, AlertTriangle, File as FileIcon, Folder, FileImage, FileText, FileArchive } from "lucide-react";

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
  if (isNaN(bytes) || bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function FileNodeIcon({ file, size = "w-10 h-10" }: { file: FileNode; size?: string }) {
  if (file.isFolder) return <Folder className={`${size} text-indigo-400 fill-indigo-400/20`} />;
  if (file.mimeType?.includes("image")) return <FileImage className={`${size} text-cyan-400`} />;
  if (file.mimeType?.includes("text") || file.mimeType?.includes("pdf")) return <FileText className={`${size} text-gray-400`} />;
  if (file.mimeType?.includes("zip") || file.mimeType?.includes("tar")) return <FileArchive className={`${size} text-orange-400`} />;
  if (file.mimeType?.includes("video") || file.mimeType?.includes("audio")) return <FileImage className={`${size} text-purple-400`} />;
  return <FileIcon className={`${size} text-gray-400`} />;
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
    onError: (err: Error) => { alert(`Delete failed: ${err.message}`); },
  });

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#0b0c10] h-full">
      <div className="h-16 flex items-center justify-between px-6 border-b border-[#1f2229] bg-[#12141a]">
        <div className="flex items-center gap-3">
          <Trash2 className="w-5 h-5 text-gray-400" />
          <h1 className="text-lg font-semibold text-white">Trash</h1>
        </div>
        <div className="text-sm text-gray-400">
          Files are kept for 30 days before permanent deletion.
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {error ? (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg">
            Failed to load trash: {(error as Error).message}
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center h-full text-gray-500 gap-3">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Loading trash...</span>
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Trash2 className="w-16 h-16 text-[#1f2229] mb-4" />
            <p>Trash is empty</p>
          </div>
        ) : (
          <div className="bg-[#12141a] rounded-xl border border-[#1f2229] overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#1a1c23] border-b border-[#1f2229] text-xs uppercase tracking-wider text-gray-500">
                  <th className="px-6 py-4 font-medium">Name</th>
                  <th className="px-6 py-4 font-medium">Size</th>
                  <th className="px-6 py-4 font-medium">Deleted</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f2229]">
                {files.map((file) => (
                  <tr key={file.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 flex items-center gap-3">
                      <FileNodeIcon file={file} size="w-6 h-6" />
                      <div>
                        <div className="text-sm font-medium text-gray-200">{file.name}</div>
                        <div className="text-xs text-gray-500 font-mono">{file.path}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400">
                      {formatBytes(file.size)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400">
                      {file.deletedAt ? new Date(file.deletedAt).toLocaleDateString() : ""}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => restoreMutation.mutate(file.id)}
                          disabled={restoreMutation.isPending || deleteMutation.isPending}
                          className="p-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg transition-colors"
                          title="Restore"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Permanently delete "${file.name}"? This cannot be undone.`)) {
                              deleteMutation.mutate(file.id);
                            }
                          }}
                          disabled={restoreMutation.isPending || deleteMutation.isPending}
                          className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors"
                          title="Delete Permanently"
                        >
                          <AlertTriangle className="w-4 h-4" />
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
    </div>
  );
}
