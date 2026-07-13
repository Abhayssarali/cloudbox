"use client";

import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/useAuthStore";
import type { AuthState } from "@/stores/useAuthStore";
import {
  Folder, File as FileIcon, Upload, Download,
  ChevronRight, HardDrive, FileImage, FileText,
  FileArchive, Loader2, Home, Share2, Trash2,
  Eye, RotateCcw, History, X, Server, ChevronDown
} from "lucide-react";

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
};

type AgentNode = {
  id: string;
  cloudId: string;
  status: "ONLINE" | "OFFLINE";
  version: string | null;
  lastHeartbeat: string | null;
  createdAt: string;
};

type FileVersion = {
  id: string;
  versionNumber: number;
  size: string;
  storagePath: string;
  createdAt: string;
};

// ---- Helpers ----
function formatBytes(bytesStr: string) {
  const bytes = parseInt(bytesStr, 10);
  if (isNaN(bytes) || bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function isPreviewable(file: FileNode): boolean {
  const mime = file.mimeType ?? "";
  return (
    mime.startsWith("image/") ||
    mime.startsWith("video/") ||
    mime.startsWith("audio/") ||
    mime === "application/pdf" ||
    mime.startsWith("text/")
  );
}

// ---- File Icon ----
function FileNodeIcon({ file, size = "w-10 h-10" }: { file: FileNode; size?: string }) {
  if (file.isFolder) return <Folder className={`${size} text-indigo-400 fill-indigo-400/20`} />;
  if (file.mimeType?.includes("image")) return <FileImage className={`${size} text-cyan-400`} />;
  if (file.mimeType?.includes("text") || file.mimeType?.includes("pdf")) return <FileText className={`${size} text-gray-400`} />;
  if (file.mimeType?.includes("zip") || file.mimeType?.includes("tar")) return <FileArchive className={`${size} text-orange-400`} />;
  if (file.mimeType?.includes("video") || file.mimeType?.includes("audio")) return <FileImage className={`${size} text-purple-400`} />;
  return <FileIcon className={`${size} text-gray-400`} />;
}

// ---- Preview Modal ----
function FilePreviewModal({ file, onClose }: { file: FileNode; onClose: () => void }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPreview = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/files/download/${file.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch file");

      const mime = file.mimeType ?? "application/octet-stream";

      if (mime.startsWith("text/")) {
        const t = await res.text();
        setText(t);
      } else {
        const blob = await res.blob();
        setBlobUrl(URL.createObjectURL(blob));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setLoading(false);
    }
  }, [file.id, file.mimeType]);

  // Fetch on mount
  useState(() => { fetchPreview(); });

  const mime = file.mimeType ?? "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#12141a] border border-[#1f2229] rounded-2xl flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1f2229]">
          <div className="flex items-center gap-3">
            <FileNodeIcon file={file} size="w-5 h-5" />
            <span className="text-white font-semibold truncate max-w-md">{file.name}</span>
            <span className="text-xs text-gray-500 bg-[#1f2229] px-2 py-0.5 rounded-full">{formatBytes(file.size)}</span>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto flex items-center justify-center bg-[#0b0c10] p-4">
          {loading && (
            <div className="flex items-center gap-3 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>Loading preview...</span>
            </div>
          )}
          {error && <p className="text-rose-400">{error}</p>}
          {!loading && !error && blobUrl && mime.startsWith("image/") && (
            <img src={blobUrl} alt={file.name} className="max-w-full max-h-full object-contain rounded-lg" />
          )}
          {!loading && !error && blobUrl && (mime.startsWith("video/")) && (
            <video src={blobUrl} controls className="max-w-full max-h-full rounded-lg" />
          )}
          {!loading && !error && blobUrl && (mime.startsWith("audio/")) && (
            <audio src={blobUrl} controls className="w-full" />
          )}
          {!loading && !error && blobUrl && mime === "application/pdf" && (
            <iframe src={blobUrl} className="w-full h-[70vh] rounded-lg" title={file.name} />
          )}
          {!loading && !error && text !== null && (
            <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono w-full max-h-[60vh] overflow-auto p-4 bg-[#0b0c10] rounded-lg">
              {text}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Version History Panel ----
function VersionHistory({ file, onClose }: { file: FileNode; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["versions", file.id],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/files/${file.id}/versions`, { credentials: "include" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data.versions as FileVersion[];
    },
  });

  return (
    <div className="border-t border-[#1f2229] pt-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Version History</span>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {isLoading ? (
        <div className="flex items-center gap-2 text-gray-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-gray-500">No previous versions.</p>
      ) : (
        <div className="space-y-2">
          {data.map((v) => (
            <div key={v.id} className="flex items-center justify-between text-xs text-gray-400 bg-[#0b0c10] px-3 py-2 rounded-lg">
              <span className="font-medium text-gray-300">v{v.versionNumber}</span>
              <span>{formatBytes(v.size)}</span>
              <span>{new Date(v.createdAt).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Main Component ----
export default function FileExplorer() {
  const [currentFolder, setCurrentFolder] = useState("/");
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [createdShareLink, setCreatedShareLink] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<FileNode | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [showAgentDropdown, setShowAgentDropdown] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const user = useAuthStore((s: AuthState) => s.user);
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  // Fetch user's agents for multi-agent selector
  const { data: agents = [] } = useQuery({
    queryKey: ["my-agents"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/agents/mine`, { credentials: "include" });
      const data = await res.json();
      if (!data.success) return [] as AgentNode[];
      return data.data.agents as AgentNode[];
    },
  });

  const onlineAgents = agents.filter((a) => a.status === "ONLINE");
  const selectedAgent = agents.find((a) => a.id === selectedAgentId) ?? onlineAgents[0] ?? null;

  const shareMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const res = await fetch(`${API_URL}/sharing`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data.token as string;
    },
    onSuccess: (token) => {
      const shareUrl = `${window.location.origin}/s/${token}`;
      setCreatedShareLink(shareUrl);
    },
    onError: (err: Error) => { alert(`Sharing failed: ${err.message}`); },
  });

  const trashMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const res = await fetch(`${API_URL}/files/${fileId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files", currentFolder] });
      setSelectedFile(null);
    },
    onError: (err: Error) => { alert(`Delete failed: ${err.message}`); },
  });

  const { data: files = [], isLoading, error } = useQuery({
    queryKey: ["files", currentFolder, selectedAgentId],
    queryFn: async () => {
      const agentParam = selectedAgentId ? `&agentId=${selectedAgentId}` : "";
      const res = await fetch(`${API_URL}/files?folder=${encodeURIComponent(currentFolder)}${agentParam}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data.files as FileNode[];
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const agentParam = selectedAgent ? `&agentId=${selectedAgent.id}` : "";
      const res = await fetch(
        `${API_URL}/files/upload?folder=${encodeURIComponent(currentFolder)}${agentParam}`,
        { method: "POST", credentials: "include", body: formData }
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["files", currentFolder] }); },
    onError: (err: Error) => { alert(`Upload failed: ${err.message}`); },
  });

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const navigateToFolder = (path: string) => {
    setCurrentFolder(path);
    setSelectedFile(null);
  };

  const handleDownload = (file: FileNode) => {
    window.location.href = `${API_URL}/files/download/${file.id}`;
  };

  const pathParts = currentFolder === "/" ? [] : currentFolder.split("/").filter(Boolean);

  return (
    <div className="flex h-full">
      {/* Preview Modal */}
      {previewFile && (
        <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
      )}

      {/* Main File Area */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Topbar / Toolbar */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-[#1f2229] bg-[#12141a]">
          {/* Breadcrumbs */}
          <div className="flex items-center text-sm">
            <button
              onClick={() => navigateToFolder("/")}
              className="p-1.5 rounded-md text-gray-400 hover:bg-white/10 hover:text-gray-200 transition-colors"
            >
              <Home className="w-4 h-4" />
            </button>
            {pathParts.map((part, idx) => {
              const fullPath = "/" + pathParts.slice(0, idx + 1).join("/");
              return (
                <div key={fullPath} className="flex items-center">
                  <ChevronRight className="w-4 h-4 mx-1 text-gray-600" />
                  <button
                    onClick={() => navigateToFolder(fullPath)}
                    className="px-2 py-1 rounded-md text-gray-300 hover:bg-white/10 hover:text-gray-100 transition-colors"
                  >
                    {part}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            {/* Multi-agent selector — only shown to admins */}
            {isAdmin && agents.length > 1 && (
              <div className="relative">
                <button
                  onClick={() => setShowAgentDropdown(!showAgentDropdown)}
                  className="flex items-center gap-2 px-3 py-2 bg-[#1f2229] hover:bg-white/10 text-gray-300 text-sm rounded-lg transition-colors border border-[#2a2d38]"
                >
                  <Server className="w-3.5 h-3.5" />
                  <span className="max-w-[80px] truncate">
                    {selectedAgent ? selectedAgent.cloudId.substring(0, 8) + "…" : "All nodes"}
                  </span>
                  <ChevronDown className="w-3 h-3 text-gray-500" />
                </button>
                {showAgentDropdown && (
                  <div className="absolute right-0 top-10 z-20 bg-[#12141a] border border-[#1f2229] rounded-xl shadow-2xl min-w-[200px] py-1">
                    <button
                      onClick={() => { setSelectedAgentId(null); setShowAgentDropdown(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 transition-colors"
                    >
                      All nodes
                    </button>
                    {agents.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => { setSelectedAgentId(a.id); setShowAgentDropdown(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors flex items-center gap-2"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${a.status === "ONLINE" ? "bg-emerald-400" : "bg-gray-600"}`} />
                        <span className="text-gray-300 font-mono text-xs">{a.cloudId.substring(0, 12)}…</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
            <button
              onClick={handleUploadClick}
              disabled={uploadMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {uploadMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploadMutation.isPending ? "Uploading..." : "Upload File"}
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#0b0c10]">
          {error ? (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg">
              Failed to load files: {(error as Error).message}
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center h-full text-gray-500 gap-3">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>Loading files...</span>
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Folder className="w-16 h-16 text-[#1f2229] mb-4" />
              <p>This folder is empty</p>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4">
              {files.map((file) => (
                <div
                  key={file.id}
                  onClick={() => {
                    if (file.isFolder) { navigateToFolder(file.path); }
                    else { setSelectedFile(file); setShowVersions(false); }
                  }}
                  onDoubleClick={() => { if (!file.isFolder && isPreviewable(file)) setPreviewFile(file); }}
                  className={`group relative flex flex-col items-center p-4 rounded-xl border border-transparent hover:border-[#1f2229] hover:bg-[#12141a] cursor-pointer transition-all ${
                    selectedFile?.id === file.id ? "bg-[#12141a] border-indigo-500/50 ring-1 ring-indigo-500/50" : ""
                  }`}
                >
                  <div className="mb-3">
                    <FileNodeIcon file={file} />
                  </div>
                  <div className="w-full text-center">
                    <div className="text-sm font-medium text-gray-200 truncate group-hover:text-white" title={file.name}>
                      {file.name}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Details Panel */}
      {selectedFile && !selectedFile.isFolder && (
        <div className="w-80 bg-[#12141a] border-l border-[#1f2229] flex flex-col">
          <div className="p-6 border-b border-[#1f2229] flex justify-center">
            <FileNodeIcon file={selectedFile} />
          </div>
          <div className="p-6 flex-1 flex flex-col gap-5 overflow-y-auto">
            <div>
              <h3 className="text-lg font-semibold text-white break-words">{selectedFile.name}</h3>
              <p className="text-sm text-gray-400 mt-1">{selectedFile.mimeType || "Unknown type"}</p>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Size</div>
                <div className="text-sm text-gray-300">{formatBytes(selectedFile.size)}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Modified</div>
                <div className="text-sm text-gray-300">{new Date(selectedFile.updatedAt).toLocaleString()}</div>
              </div>
              {/* Only show storage node ID to admins */}
              {isAdmin && (
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Storage Node</div>
                  <div className="flex items-center gap-2 text-sm text-gray-300 font-mono">
                    <HardDrive className="w-4 h-4 text-cyan-500" />
                    {selectedFile.agentId.substring(0, 8)}...
                  </div>
                </div>
              )}
            </div>

            {/* Version History toggle */}
            {showVersions && (
              <VersionHistory file={selectedFile} onClose={() => setShowVersions(false)} />
            )}

            <div className="mt-auto pt-4 space-y-2">
              {isPreviewable(selectedFile) && (
                <button
                  onClick={() => setPreviewFile(selectedFile)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-lg transition-colors border border-[#1f2229]"
                >
                  <Eye className="w-4 h-4" />
                  Preview
                </button>
              )}
              <button
                onClick={() => handleDownload(selectedFile)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-lg transition-colors border border-[#1f2229]"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
              <button
                onClick={() => setShowVersions(!showVersions)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-medium rounded-lg transition-colors border border-[#1f2229]"
              >
                <History className="w-4 h-4" />
                Version History
              </button>
              <button
                onClick={() => shareMutation.mutate(selectedFile.id)}
                disabled={shareMutation.isPending}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {shareMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                {shareMutation.isPending ? "Generating..." : "Share File"}
              </button>
              <button
                onClick={() => {
                  if (confirm(`Move "${selectedFile.name}" to trash?`)) trashMutation.mutate(selectedFile.id);
                }}
                disabled={trashMutation.isPending}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-sm font-medium rounded-lg transition-colors border border-rose-500/20 disabled:opacity-50"
              >
                {trashMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Move to Trash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Link Modal */}
      {createdShareLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#12141a] border border-[#1f2229] rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Share Link Generated</h3>
            <p className="text-sm text-gray-400 mb-4">Anyone with this link can view and download this file.</p>
            <div className="flex items-center gap-2 bg-black border border-[#1f2229] p-2 rounded-lg mb-4">
              <input
                type="text"
                readOnly
                value={createdShareLink}
                className="flex-1 bg-transparent text-sm text-gray-200 focus:outline-none overflow-x-auto select-all"
                id="share-link-input"
              />
              <button
                onClick={() => { navigator.clipboard.writeText(createdShareLink); alert("Copied!"); }}
                className="px-3 py-1 bg-indigo-500 hover:bg-indigo-600 text-xs font-semibold rounded text-white"
              >
                Copy
              </button>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setCreatedShareLink(null)}
                className="px-4 py-2 bg-[#1f2229] hover:bg-white/10 text-sm font-medium rounded-lg transition-colors border border-[#1f2229] text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
