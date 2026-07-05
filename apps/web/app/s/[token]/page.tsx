"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { Download, FileIcon, FileImage, FileText, FileArchive, Loader2, AlertCircle } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type SharedFileMeta = {
  name: string;
  size: string;
  mimeType: string | null;
  updatedAt: string;
  agentStatus: "ONLINE" | "OFFLINE";
};

export default function PublicSharePage() {
  const params = useParams();
  const token = params?.token as string;

  const { data: file, isLoading, error } = useQuery<SharedFileMeta>({
    queryKey: ["publicShare", token],
    queryFn: async () => {
      if (!token) throw new Error("Invalid token");
      const res = await fetch(`${API_URL}/sharing/public/${token}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to load shared file");
      return data.data;
    },
    enabled: !!token,
    retry: false,
  });

  const formatBytes = (bytesStr: string) => {
    const bytes = parseInt(bytesStr, 10);
    if (isNaN(bytes) || bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const renderIcon = (mimeType: string | null) => {
    if (mimeType?.includes("image")) return <FileImage className="w-20 h-20 text-cyan-400" />;
    if (mimeType?.includes("text") || mimeType?.includes("pdf")) return <FileText className="w-20 h-20 text-gray-400" />;
    if (mimeType?.includes("zip") || mimeType?.includes("tar")) return <FileArchive className="w-20 h-20 text-orange-400" />;
    return <FileIcon className="w-20 h-20 text-indigo-400" />;
  };

  const handleDownload = () => {
    window.location.href = `${API_URL}/sharing/public/${token}/download`;
  };

  return (
    <div className="min-h-screen bg-[#0b0c10] text-gray-200 flex flex-col items-center justify-center p-4">
      {/* Brand logo */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white">
            <path d="M7 14c0-1.657 1.343-3 3-3a3 3 0 011.8.6A3 3 0 0115 10c1.657 0 3 1.343 3 3v1H7v-1z" fill="currentColor" />
            <circle cx="12" cy="8.5" r="2" fill="currentColor" />
          </svg>
        </div>
        <span className="font-bold text-lg tracking-tight text-white">CloudBox</span>
      </div>

      <div className="max-w-md w-full bg-[#12141a] border border-[#1f2229] rounded-2xl p-6 shadow-2xl flex flex-col items-center">
        {isLoading ? (
          <div className="flex flex-col items-center py-12 gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
            <span className="text-sm text-gray-400">Loading shared file details...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center py-8 text-center">
            <AlertCircle className="w-16 h-16 text-rose-500 mb-4" />
            <h2 className="text-lg font-bold text-white mb-2">Link Unavailable</h2>
            <p className="text-sm text-gray-400">
              {error instanceof Error ? error.message : "This link might have expired or been revoked by the owner."}
            </p>
          </div>
        ) : file ? (
          <div className="w-full flex flex-col items-center text-center">
            <div className="mb-6 p-4 bg-black/20 rounded-2xl border border-[#1f2229]">
              {renderIcon(file.mimeType)}
            </div>

            <h2 className="text-xl font-bold text-white break-all mb-2 px-2" title={file.name}>
              {file.name}
            </h2>
            <p className="text-sm text-gray-400 mb-6">
              {file.mimeType || "Binary File"} · {formatBytes(file.size)}
            </p>

            <div className="w-full space-y-3 bg-black/20 rounded-xl p-4 border border-[#1f2229] text-left text-xs text-gray-400 mb-6">
              <div className="flex justify-between">
                <span>Last Modified:</span>
                <span className="text-gray-200 font-medium">{new Date(file.updatedAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Storage Node:</span>
                <span className={`font-semibold flex items-center gap-1 ${file.agentStatus === "ONLINE" ? "text-emerald-400" : "text-rose-400"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${file.agentStatus === "ONLINE" ? "bg-emerald-400" : "bg-rose-400"}`}></span>
                  {file.agentStatus === "ONLINE" ? "Online" : "Offline"}
                </span>
              </div>
            </div>

            <button
              onClick={handleDownload}
              disabled={file.agentStatus !== "ONLINE"}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-800 disabled:text-gray-500 text-white font-medium rounded-xl transition-colors disabled:cursor-not-allowed text-base font-semibold shadow-lg shadow-indigo-500/10"
            >
              <Download className="w-5 h-5" />
              {file.agentStatus === "ONLINE" ? "Download File" : "Node Offline"}
            </button>
            {file.agentStatus !== "ONLINE" && (
              <p className="text-xs text-rose-400 mt-2">
                The storage device hosting this file is currently offline. Please try again later.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
