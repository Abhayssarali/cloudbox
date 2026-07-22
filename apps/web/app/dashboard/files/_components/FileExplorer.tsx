"use client";

import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/useAuthStore";
import type { AuthState } from "@/stores/useAuthStore";
import {
  FileIcon, Folder, FileImage, FileText, FileArchive, FileAudio, FileVideo,
  Upload, FolderPlus, Download, Trash2, Search, Link2, Share2, Info,
  MoreVertical, Grid, List, CheckCircle2, AlertCircle, X, Check, Copy, FolderOpen,
  Loader2, RefreshCw, FileCode2, Image as ImageIcon, ChevronRight, CornerDownRight
} from "lucide-react";

// API Helpers
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface FileItem {
  id: string;
  name: string;
  type: "file" | "folder";
  size?: number;
  mimeType?: string;
  parentId: string | null;
  nodeId?: string;
  createdAt: string;
  updatedAt: string;
  cid?: string;
}

// ----------------------------------------------------------------------
// FORMATTING & ICONS
// ----------------------------------------------------------------------
function formatBytes(bytes?: number) {
  if (bytes === undefined || bytes === null) return "--";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(d);
}

function getFileIcon(type: string, mimeType?: string, className: string = "w-5 h-5") {
  if (type === "folder") return <Folder className={`${className} text-indigo-400`} />;
  if (!mimeType) return <FileIcon className={`${className} text-slate-400`} />;
  if (mimeType.startsWith("image/")) return <ImageIcon className={`${className} text-blue-400`} />;
  if (mimeType.startsWith("video/")) return <FileVideo className={`${className} text-fuchsia-400`} />;
  if (mimeType.startsWith("audio/")) return <FileAudio className={`${className} text-orange-400`} />;
  if (mimeType.includes("pdf")) return <FileText className={`${className} text-rose-400`} />;
  if (mimeType.includes("zip") || mimeType.includes("tar") || mimeType.includes("rar") || mimeType.includes("gzip")) return <FileArchive className={`${className} text-amber-400`} />;
  if (mimeType.includes("json") || mimeType.includes("javascript") || mimeType.includes("html") || mimeType.includes("css")) return <FileCode2 className={`${className} text-emerald-400`} />;
  if (mimeType.includes("text/")) return <FileText className={`${className} text-slate-300`} />;
  return <FileIcon className={`${className} text-slate-400`} />;
}

// ----------------------------------------------------------------------
// SHARE MODAL COMPONENT
// ----------------------------------------------------------------------
function ShareModal({ file, onClose }: { file: FileItem; onClose: () => void }) {
  const user = useAuthStore((s: AuthState) => s.user);
  const [copied, setCopied] = useState(false);
  
  const createShareLink = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_URL}/api/sharing/links`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          fileId: file.id,
          expiresInDays: 7
        })
      });
      if (!res.ok) throw new Error("Failed to create share link");
      return res.json();
    }
  });

  const handleCreateAndCopy = async () => {
    try {
      const data = await createShareLink.mutateAsync();
      const shareUrl = `${window.location.origin}/s/${data.token}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
      alert("Failed to share file");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-cb-surface border border-cb-border w-full max-w-md rounded-2xl shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-200">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center">
            {getFileIcon(file.type, file.mimeType, "w-6 h-6")}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Share File</h3>
            <p className="text-sm text-slate-400 truncate max-w-[250px]">{file.name}</p>
          </div>
        </div>
        
        <p className="text-slate-300 text-sm mb-6">
          Create a secure, public link to share this file. Anyone with the link will be able to download it. The link will expire in 7 days.
        </p>

        <button
          onClick={handleCreateAndCopy}
          disabled={createShareLink.isPending}
          className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
        >
          {createShareLink.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : copied ? (
            <>
              <Check className="w-4 h-4" />
              Link Copied!
            </>
          ) : (
            <>
              <Link2 className="w-4 h-4" />
              Create & Copy Link
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// MAIN COMPONENT
// ----------------------------------------------------------------------
export default function FileExplorer() {
  const user = useAuthStore((s: AuthState) => s.user);
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderHistory, setFolderHistory] = useState<{id: string | null, name: string}[]>([{id: null, name: "My Files"}]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modals
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Queries
  const { data: files = [], isLoading, error, refetch } = useQuery({
    queryKey: ["files", currentFolderId],
    queryFn: async () => {
      const url = currentFolderId 
        ? `${API_URL}/api/files?parentId=${currentFolderId}`
        : `${API_URL}/api/files`;
      
      const res = await fetch(url, {
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to fetch files");
      return res.json() as Promise<FileItem[]>;
    },
    enabled: !!user
  });

  const { data: activeNodes = [] } = useQuery({
    queryKey: ["nodes", "active"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/nodes`, {
        credentials: "include"
      });
      if (!res.ok) return [];
      const allNodes = await res.json();
      return allNodes.filter((n: any) => n.status === "online");
    },
    enabled: !!user
  });

  const hasNodes = activeNodes.length > 0;

  // Mutations
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      if (currentFolderId) {
        formData.append("parentId", currentFolderId);
      }
      
      const res = await fetch(`${API_URL}/api/files/upload`, {
        method: "POST",
        credentials: "include",
        body: formData
      });
      if (!res.ok) {
        const errData = await res.json().catch(()=>({}));
        throw new Error(errData.error || "Upload failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files", currentFolderId] });
      queryClient.invalidateQueries({ queryKey: ["quota"] });
    },
    onError: (err: any) => {
      alert(`Upload failed: ${err.message}`);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_URL}/api/files/${id}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files", currentFolderId] });
      setSelectedFileId(null);
    }
  });

  const createFolderMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch(`${API_URL}/api/files/folder`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          name,
          parentId: currentFolderId
        })
      });
      if (!res.ok) throw new Error("Failed to create folder");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files", currentFolderId] });
    }
  });

  // Handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      if (!hasNodes) {
        alert("No active storage nodes available. Please add a node first.");
        return;
      }
      const file = e.target.files[0];
      uploadMutation.mutate(file);
    }
  };

  const handleCreateFolder = () => {
    const name = prompt("Folder name:");
    if (name && name.trim()) {
      createFolderMutation.mutate(name.trim());
    }
  };

  const navigateToFolder = (folder: FileItem) => {
    setCurrentFolderId(folder.id);
    setFolderHistory(prev => [...prev, { id: folder.id, name: folder.name }]);
    setSelectedFileId(null);
  };

  const navigateUpTo = (index: number) => {
    const target = folderHistory[index];
    setCurrentFolderId(target.id);
    setFolderHistory(prev => prev.slice(0, index + 1));
    setSelectedFileId(null);
  };

  const handleDownload = async (file: FileItem) => {
    try {
      const res = await fetch(`${API_URL}/api/files/${file.id}/download`, {
        credentials: "include"
      });
      if (!res.ok) throw new Error("Download failed");
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error(err);
      alert("Failed to download file");
    }
  };

  // Filter & Sort
  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const sortedFiles = [...filteredFiles].sort((a, b) => {
    if (a.type === "folder" && b.type !== "folder") return -1;
    if (a.type !== "folder" && b.type === "folder") return 1;
    return a.name.localeCompare(b.name);
  });

  const selectedFile = files.find(f => f.id === selectedFileId);

  // ----------------------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------------------
  return (
    <div className="flex h-full bg-cb-bg text-white">
      
      {/* LEFT CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden border-r border-cb-border">
        
        {/* TOP TOOLBAR */}
        <div className="h-16 border-b border-cb-border flex items-center justify-between px-6 bg-cb-bg/50 backdrop-blur-md">
          
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mask-fade-right">
            {folderHistory.map((hist, i) => (
              <div key={hist.id || 'root'} className="flex items-center shrink-0">
                {i > 0 && <ChevronRight className="w-4 h-4 text-slate-500 mx-2" />}
                <button
                  onClick={() => navigateUpTo(i)}
                  className={`text-sm font-medium transition-colors hover:text-white ${
                    i === folderHistory.length - 1 ? "text-white" : "text-slate-400"
                  }`}
                >
                  {hist.name}
                </button>
              </div>
            ))}
          </div>

          {/* Right Toolbar Actions */}
          <div className="flex items-center gap-3">
            
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-cb-surface border border-cb-border rounded-lg pl-9 pr-4 py-1.5 text-sm w-48 focus:w-64 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all outline-none"
              />
            </div>

            <div className="h-6 w-px bg-cb-border mx-1"></div>

            <div className="flex items-center bg-cb-surface rounded-lg p-0.5 border border-cb-border">
              <button 
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"}`}
              >
                <List className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"}`}
              >
                <Grid className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={handleCreateFolder}
              className="p-2 text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors border border-transparent hover:border-white/10"
              title="New Folder"
            >
              <FolderPlus className="w-4 h-4" />
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending || !hasNodes}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                hasNodes 
                  ? "bg-indigo-600 hover:bg-indigo-500 text-white" 
                  : "bg-slate-800 text-slate-500 cursor-not-allowed"
              }`}
            >
              {uploadMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Upload
            </button>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        </div>

        {/* NODE STATUS WARNING */}
        {!hasNodes && (
          <div className="bg-rose-500/10 border-b border-rose-500/20 px-6 py-3 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400" />
            <p className="text-sm text-rose-200">
              You don't have any active storage nodes. Uploads are disabled until a node is connected and online.
            </p>
          </div>
        )}

        {/* FILE LISTING AREA */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-custom">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
              <p>Loading files...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 text-rose-400">
              <AlertCircle className="w-8 h-8 mb-4" />
              <p>Failed to load files.</p>
              <button onClick={() => refetch()} className="mt-4 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-white">Retry</button>
            </div>
          ) : sortedFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                <FolderOpen className="w-8 h-8 text-slate-500" />
              </div>
              <p className="text-lg font-medium text-white mb-1">Folder is empty</p>
              <p className="text-sm">Upload files or create folders to get started.</p>
            </div>
          ) : viewMode === "grid" ? (
            // GRID VIEW
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {sortedFiles.map(file => {
                const isSelected = selectedFileId === file.id;
                return (
                  <div
                    key={file.id}
                    onClick={() => setSelectedFileId(file.id)}
                    onDoubleClick={() => file.type === "folder" && navigateToFolder(file)}
                    className={`group relative p-4 rounded-2xl cursor-pointer transition-all duration-200 border ${
                      isSelected 
                        ? "bg-indigo-500/10 border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.15)]" 
                        : "bg-cb-surface border-cb-border hover:bg-cb-surface-2 hover:border-white/10"
                    }`}
                  >
                    <div className="flex items-center justify-center h-24 mb-3">
                      <div className="transition-transform duration-200 group-hover:scale-110">
                        {getFileIcon(file.type, file.mimeType, "w-12 h-12")}
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-slate-200 truncate">{file.name}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {file.type === "folder" ? "Folder" : formatBytes(file.size)}
                      </p>
                    </div>
                    {isSelected && (
                      <div className="absolute top-3 right-3 text-indigo-400 bg-cb-bg rounded-full p-0.5">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            // LIST VIEW
            <div className="w-full">
              <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-cb-border text-xs font-semibold text-slate-400 uppercase tracking-wider sticky top-0 bg-cb-bg/95 backdrop-blur-sm z-10">
                <div className="col-span-6 md:col-span-5">Name</div>
                <div className="col-span-3 hidden md:block">Date Modified</div>
                <div className="col-span-3 md:col-span-2 text-right">Size</div>
                <div className="col-span-3 md:col-span-2 text-right">Kind</div>
              </div>
              
              <div className="flex flex-col gap-1 mt-2">
                {sortedFiles.map(file => {
                  const isSelected = selectedFileId === file.id;
                  return (
                    <div
                      key={file.id}
                      onClick={() => setSelectedFileId(file.id)}
                      onDoubleClick={() => file.type === "folder" && navigateToFolder(file)}
                      className={`grid grid-cols-12 gap-4 px-4 py-3 rounded-xl cursor-pointer items-center transition-colors border ${
                        isSelected 
                          ? "bg-indigo-500/10 border-indigo-500/30" 
                          : "bg-transparent border-transparent hover:bg-cb-surface"
                      }`}
                    >
                      <div className="col-span-6 md:col-span-5 flex items-center gap-3 overflow-hidden">
                        {getFileIcon(file.type, file.mimeType)}
                        <span className="text-sm font-medium text-slate-200 truncate">{file.name}</span>
                      </div>
                      <div className="col-span-3 hidden md:block text-xs text-slate-500">
                        {formatDate(file.updatedAt)}
                      </div>
                      <div className="col-span-3 md:col-span-2 text-xs text-slate-500 text-right">
                        {file.type === "folder" ? "--" : formatBytes(file.size)}
                      </div>
                      <div className="col-span-3 md:col-span-2 text-xs text-slate-500 text-right truncate">
                        {file.type === "folder" ? "Folder" : file.mimeType || "File"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT SIDEBAR - DETAILS PANEL */}
      <div className={`w-80 bg-cb-surface flex flex-col transition-all duration-300 ease-in-out ${
        selectedFile ? "translate-x-0 border-l border-cb-border" : "w-0 overflow-hidden opacity-0"
      }`}>
        {selectedFile && (
          <>
            <div className="h-16 border-b border-cb-border flex items-center justify-between px-5 shrink-0">
              <h3 className="font-semibold text-white">Details</h3>
              <button 
                onClick={() => setSelectedFileId(null)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 scrollbar-custom">
              
              {/* File Preview Icon Block */}
              <div className="bg-cb-bg rounded-2xl p-8 flex flex-col items-center justify-center mb-6 border border-cb-border relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                {getFileIcon(selectedFile.type, selectedFile.mimeType, "w-16 h-16 mb-4 relative z-10")}
                <p className="text-sm font-medium text-white text-center break-words w-full truncate relative z-10">{selectedFile.name}</p>
                {selectedFile.type !== "folder" && (
                  <p className="text-xs text-slate-500 mt-1 relative z-10">{formatBytes(selectedFile.size)}</p>
                )}
              </div>
              
              {/* Actions Grid */}
              <div className="grid grid-cols-2 gap-2 mb-6">
                {selectedFile.type !== "folder" && (
                  <button
                    onClick={() => handleDownload(selectedFile)}
                    className="flex flex-col items-center justify-center gap-2 bg-cb-bg hover:bg-white/5 border border-cb-border hover:border-white/10 p-3 rounded-xl transition-colors text-slate-300 hover:text-white"
                  >
                    <Download className="w-4 h-4" />
                    <span className="text-xs font-medium">Download</span>
                  </button>
                )}
                
                {selectedFile.type !== "folder" && (
                  <button
                    onClick={() => setIsShareModalOpen(true)}
                    className="flex flex-col items-center justify-center gap-2 bg-cb-bg hover:bg-white/5 border border-cb-border hover:border-white/10 p-3 rounded-xl transition-colors text-slate-300 hover:text-white"
                  >
                    <Share2 className="w-4 h-4" />
                    <span className="text-xs font-medium">Share Link</span>
                  </button>
                )}
                
                <button
                  onClick={() => {
                    if (confirm("Are you sure you want to move this to trash?")) {
                      deleteMutation.mutate(selectedFile.id);
                    }
                  }}
                  className={`flex flex-col items-center justify-center gap-2 bg-cb-bg hover:bg-rose-500/10 border border-cb-border hover:border-rose-500/20 p-3 rounded-xl transition-colors text-rose-400 ${selectedFile.type === 'folder' ? 'col-span-2' : ''}`}
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="text-xs font-medium">Delete</span>
                </button>
              </div>
              
              {/* Information List */}
              <div className="space-y-4 text-sm">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Information</h4>
                
                <div className="flex justify-between border-b border-cb-border/50 pb-2">
                  <span className="text-slate-400">Type</span>
                  <span className="text-slate-200">{selectedFile.type === "folder" ? "Folder" : selectedFile.mimeType || "File"}</span>
                </div>
                
                {selectedFile.type !== "folder" && (
                  <div className="flex justify-between border-b border-cb-border/50 pb-2">
                    <span className="text-slate-400">Size</span>
                    <span className="text-slate-200">{formatBytes(selectedFile.size)}</span>
                  </div>
                )}
                
                <div className="flex justify-between border-b border-cb-border/50 pb-2">
                  <span className="text-slate-400">Modified</span>
                  <span className="text-slate-200">{formatDate(selectedFile.updatedAt)}</span>
                </div>
                
                <div className="flex justify-between border-b border-cb-border/50 pb-2">
                  <span className="text-slate-400">Created</span>
                  <span className="text-slate-200">{formatDate(selectedFile.createdAt)}</span>
                </div>
                
                {selectedFile.cid && (
                  <div className="flex flex-col gap-1 border-b border-cb-border/50 pb-2">
                    <span className="text-slate-400">IPFS CID</span>
                    <span className="text-slate-200 text-xs font-mono break-all">{selectedFile.cid}</span>
                  </div>
                )}
                
                {selectedFile.nodeId && (
                  <div className="flex justify-between border-b border-cb-border/50 pb-2">
                    <span className="text-slate-400">Storage Node</span>
                    <span className="text-slate-200 truncate ml-4">{selectedFile.nodeId}</span>
                  </div>
                )}
              </div>
              
            </div>
          </>
        )}
      </div>
      
      {/* Modals */}
      {isShareModalOpen && selectedFile && (
        <ShareModal 
          file={selectedFile} 
          onClose={() => setIsShareModalOpen(false)} 
        />
      )}
      
    </div>
  );
}
