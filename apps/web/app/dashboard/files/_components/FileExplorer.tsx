"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Folder, File as FileIcon, Upload, Download, 
  ChevronRight, HardDrive, FileImage, FileText, 
  FileArchive, Loader2, Home 
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// DTO from API
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

export default function FileExplorer() {
  const [currentFolder, setCurrentFolder] = useState("/");
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: files = [], isLoading, error } = useQuery({
    queryKey: ["files", currentFolder],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/files?folder=${encodeURIComponent(currentFolder)}`, {
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
      
      const res = await fetch(`${API_URL}/files/upload?folder=${encodeURIComponent(currentFolder)}`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files", currentFolder] });
    },
    onError: (err: Error) => {
      alert(`Upload failed: ${err.message}`);
    }
  });

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
    // reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const navigateToFolder = (path: string) => {
    setCurrentFolder(path);
    setSelectedFile(null);
  };

  const handleDownload = (file: FileNode) => {
    // Navigate to download endpoint, the browser will handle the file stream
    window.location.href = `${API_URL}/files/download/${file.id}`;
  };

  // Build breadcrumbs
  const pathParts = currentFolder === "/" ? [] : currentFolder.split("/").filter(Boolean);
  
  const renderIcon = (file: FileNode) => {
    if (file.isFolder) return <Folder className="w-10 h-10 text-indigo-400 fill-indigo-400/20" />;
    
    if (file.mimeType?.includes("image")) return <FileImage className="w-10 h-10 text-cyan-400" />;
    if (file.mimeType?.includes("text") || file.mimeType?.includes("pdf")) return <FileText className="w-10 h-10 text-gray-400" />;
    if (file.mimeType?.includes("zip") || file.mimeType?.includes("tar")) return <FileArchive className="w-10 h-10 text-orange-400" />;
    
    return <FileIcon className="w-10 h-10 text-gray-400" />;
  };

  return (
    <div className="flex h-full">
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
            <input 
              type="file" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileChange}
            />
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
              {files.map(file => (
                <div 
                  key={file.id}
                  onClick={() => {
                    if (file.isFolder) {
                      navigateToFolder(file.path);
                    } else {
                      setSelectedFile(file);
                    }
                  }}
                  className={`group relative flex flex-col items-center p-4 rounded-xl border border-transparent hover:border-[#1f2229] hover:bg-[#12141a] cursor-pointer transition-all ${
                    selectedFile?.id === file.id ? "bg-[#12141a] border-indigo-500/50 ring-1 ring-indigo-500/50" : ""
                  }`}
                >
                  <div className="mb-3">
                    {renderIcon(file)}
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
            {renderIcon(selectedFile)}
          </div>
          <div className="p-6 flex-1 flex flex-col gap-6">
            <div>
              <h3 className="text-lg font-semibold text-white break-words">{selectedFile.name}</h3>
              <p className="text-sm text-gray-400 mt-1">
                {selectedFile.mimeType || "Unknown type"}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Size</div>
                <div className="text-sm text-gray-300">
                  {formatBytes(selectedFile.size)}
                </div>
              </div>
              
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Modified</div>
                <div className="text-sm text-gray-300">
                  {new Date(selectedFile.updatedAt).toLocaleString()}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Storage Node</div>
                <div className="flex items-center gap-2 text-sm text-gray-300 font-mono">
                  <HardDrive className="w-4 h-4 text-cyan-500" />
                  {selectedFile.agentId.substring(0, 8)}...
                </div>
              </div>
            </div>

            <div className="mt-auto pt-6">
              <button 
                onClick={() => handleDownload(selectedFile)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-lg transition-colors border border-[#1f2229]"
              >
                <Download className="w-4 h-4" />
                Download File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatBytes(bytesStr: string) {
  const bytes = parseInt(bytesStr, 10);
  if (isNaN(bytes) || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
