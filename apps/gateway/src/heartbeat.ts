import type { GatewayMessage } from "@cloudbox/shared-types";
import { prisma } from "./lib/prisma.js";
import { getAllEntries, unregisterSocket } from "./registry.js";

const HEARTBEAT_INTERVAL_MS = 30_000; // 30 seconds
const OFFLINE_THRESHOLD_MS = 65_000;  // 65 seconds (misses ~2 heartbeats)

export function startHeartbeat() {
  setInterval(async () => {
    const now = Date.now();
    const entries = getAllEntries();

    for (const [cloudId, entry] of entries) {
      const elapsed = now - entry.lastPong;

      if (elapsed > OFFLINE_THRESHOLD_MS) {
        // Agent has missed 2 heartbeats — mark offline
        console.log(`[Heartbeat] Agent timed out: cloudId=${cloudId} (${Math.round(elapsed / 1000)}s silent)`);
        unregisterSocket(cloudId);

        try {
          await prisma.agent.update({
            where: { cloudId },
            data: { status: "OFFLINE" },
          });
        } catch {
          // Agent may have been deleted from DB
        }
        entry.ws.terminate();
      } else {
        // Send heartbeat ping
        const msg: GatewayMessage = { type: "HEARTBEAT", agentId: entry.agentId, timestamp: now };
        try {
          entry.ws.send(JSON.stringify(msg));
        } catch {
          unregisterSocket(cloudId);
        }
      }
    }
  }, HEARTBEAT_INTERVAL_MS);

  console.log("[Heartbeat] Started — interval 30s, timeout 65s");
}
