// ============================================================
// CloudBox — Shared Types
// Imported by: api, gateway, agent
// ============================================================

// ---- Enums ----

export type Role = "SUPER_ADMIN" | "ADMIN" | "USER";

export type AgentStatus = "ONLINE" | "OFFLINE";

// ---- Core Domain Types ----

export interface User {
  id: string;
  email: string;
  role: Role;
  quotaBytes: bigint;
  usedBytes: bigint;
  groupId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Agent {
  id: string;
  cloudId: string;
  userId: string;
  publicKey: string;
  status: AgentStatus;
  version: string | null;
  lastHeartbeat: Date | null;
  createdAt: Date;
}

export interface FileMeta {
  id: string;
  agentId: string;
  path: string;
  name: string;
  size: bigint;
  mimeType: string | null;
  isFolder: boolean;
  parentId: string | null;
  updatedAt: Date;
}

// ---- Auth Types ----

export interface AuthTokenPayload {
  userId: string;
  role: Role;
  type: "access" | "refresh";
}

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

// ---- Gateway WebSocket Message Protocol ----

export type GatewayMessage =
  | { type: "LIST_FILES"; path: string; requestId: string }
  | { type: "FILE_LIST_RESULT"; requestId: string; files: FileMeta[] }
  | { type: "DOWNLOAD_FILE"; path: string; requestId: string }
  | { type: "FILE_CHUNK"; requestId: string; chunk: string; final: boolean }
  | { type: "UPLOAD_FILE"; path: string; requestId: string }
  | { type: "UPLOAD_ACK"; requestId: string; success: boolean }
  | { type: "HEARTBEAT"; agentId: string; timestamp: number }
  | { type: "HEARTBEAT_ACK"; timestamp: number }
  | { type: "AUTH_CHALLENGE"; challenge: string }
  | { type: "AUTH_RESPONSE"; cloudId: string; signature: string }
  | { type: "AUTH_OK"; agentId: string }
  | { type: "AUTH_ERROR"; message: string }
  | { type: "ERROR"; requestId: string; message: string }
  | {
      type: "METADATA_SYNC";
      files: {
        path: string;
        name: string;
        size: string;
        isFolder: boolean;
        mimeType: string | null;
        updatedAt: string;
      }[];
    };

// ---- API Response Shapes ----

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface HealthResponse {
  status: "ok";
  timestamp: string;
  version: string;
  services: {
    database: "connected" | "error";
    redis: "connected" | "error";
  };
}
