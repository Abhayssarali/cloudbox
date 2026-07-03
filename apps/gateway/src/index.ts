import "dotenv/config";
import { WebSocketServer } from "ws";
import type { GatewayMessage } from "@cloudbox/shared-types";
import { connectRedis } from "./lib/redis.js";
import { runAuthHandshake } from "./auth.js";
import { startHeartbeat } from "./heartbeat.js";
import { startRelaySubscriber, publishResponse } from "./relay.js";
import { unregisterSocket, updateLastPong, getSocket } from "./registry.js";
import { prisma } from "./lib/prisma.js";

const PORT = Number(process.env.GATEWAY_PORT ?? 4001);

async function main() {
  // Connect to Redis first
  await connectRedis();

  // Start Redis relay subscriber (listens for API commands)
  await startRelaySubscriber();

  // Start heartbeat manager
  startHeartbeat();

  // Start WebSocket server
  const wss = new WebSocketServer({ port: PORT });
  console.log(`[Gateway] WebSocket server listening on ws://localhost:${PORT}`);

  wss.on("connection", async (ws) => {
    console.log("[Gateway] New connection — starting auth handshake...");

    // Run cryptographic auth handshake
    const cloudId = await runAuthHandshake(ws);
    if (!cloudId) {
      // Auth failed — socket already closed in runAuthHandshake
      return;
    }

    // Handle ongoing messages from the authenticated agent
    ws.on("message", async (raw) => {
      try {
        const msg: GatewayMessage = JSON.parse(raw.toString());

        switch (msg.type) {
          case "HEARTBEAT_ACK":
            updateLastPong(cloudId);
            break;

          // Response messages from agent — relay back to API via Redis
          case "FILE_LIST_RESULT":
          case "FILE_CHUNK":
          case "UPLOAD_ACK":
          case "ERROR":
            await publishResponse(cloudId, msg);
            break;

          default:
            console.warn(`[Gateway] Unhandled message type from agent: ${msg.type}`);
        }
      } catch (err) {
        console.error("[Gateway] Failed to parse agent message:", err);
      }
    });

    // Handle disconnect
    ws.on("close", async () => {
      const entry = getSocket(cloudId);
      if (!entry) return; // already cleaned up by heartbeat

      console.log(`[Gateway] Agent disconnected: cloudId=${cloudId}`);
      unregisterSocket(cloudId);

      try {
        await prisma.agent.update({
          where: { cloudId },
          data: { status: "OFFLINE" },
        });
      } catch {
        // Agent may have been deleted
      }
    });

    ws.on("error", (err) => {
      console.error(`[Gateway] Socket error for cloudId=${cloudId}:`, err.message);
    });
  });

  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.log("[Gateway] SIGTERM received — shutting down...");
    wss.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[Gateway] Fatal error:", err);
  process.exit(1);
});
