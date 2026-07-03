import type WebSocket from "ws";

interface RegistryEntry {
  ws: WebSocket;
  agentId: string;
  lastPong: number;
}

// cloudId → socket entry
const registry = new Map<string, RegistryEntry>();

export function registerSocket(cloudId: string, agentId: string, ws: WebSocket) {
  registry.set(cloudId, { ws, agentId, lastPong: Date.now() });
  console.log(`[Registry] Registered agent cloudId=${cloudId} agentId=${agentId} (total: ${registry.size})`);
}

export function unregisterSocket(cloudId: string) {
  registry.delete(cloudId);
  console.log(`[Registry] Unregistered cloudId=${cloudId} (total: ${registry.size})`);
}

export function getSocket(cloudId: string): RegistryEntry | undefined {
  return registry.get(cloudId);
}

export function updateLastPong(cloudId: string) {
  const entry = registry.get(cloudId);
  if (entry) entry.lastPong = Date.now();
}

export function getAllEntries(): Map<string, RegistryEntry> {
  return registry;
}
