import "dotenv/config";
import http from "http";
import { WebSocketServer } from "ws";
import type { GatewayMessage } from "@cloudbox/shared-types";
import { connectRedis } from "./lib/redis.js";
import { runAuthHandshake } from "./auth.js";
import { startHeartbeat } from "./heartbeat.js";
import { startRelaySubscriber, publishResponse } from "./relay.js";
import { unregisterSocket, updateLastPong, getSocket, getAllEntries } from "./registry.js";
import { prisma } from "./lib/prisma.js";
import { renderMetrics } from "./metrics.js";

const PORT = Number(process.env.GATEWAY_PORT ?? 4001);

async function main() {
  // Connect to Redis first
  await connectRedis();

  // ── Startup cleanup ──
  // On (re)start, the in-memory socket registry is empty, so any agent that
  // was previously recorded as ONLINE in the DB is actually disconnected.
  // Mark them all OFFLINE so stale status cannot block file operations.
  const resetCount = await prisma.agent.updateMany({
    where: { status: "ONLINE" },
    data: { status: "OFFLINE" },
  });
  if (resetCount.count > 0) {
    console.log(`[Gateway] Startup: reset ${resetCount.count} stale ONLINE agent(s) to OFFLINE`);
  }

  // Start Redis relay subscriber (listens for API commands)
  await startRelaySubscriber();

  // Start heartbeat manager
  startHeartbeat();

  const server = http.createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }));
      return;
    }

    if (req.url === "/metrics") {
      res.writeHead(200, { "Content-Type": "text/plain; version=0.0.4; charset=utf-8" });
      res.end(renderMetrics(getAllEntries().size));
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: "Route not found" }));
  });

  // Start WebSocket server
  const wss = new WebSocketServer({ server });
  server.listen(PORT, () => {
    console.log(`[Gateway] WebSocket server listening on ws://localhost:${PORT}`);
  });

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
            // Also refresh lastHeartbeat in DB so the dashboard shows a fresh timestamp
            prisma.agent.update({
              where: { cloudId },
              data: { lastHeartbeat: new Date() },
            }).catch(() => { /* ignore if agent was deleted */ });
            break;

          // Response messages from agent — relay back to API via Redis
          case "FILE_LIST_RESULT":
          case "FILE_CHUNK":
          case "UPLOAD_ACK":
          case "METADATA_SYNC":
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
    wss.close(() => {
      server.close(() => process.exit(0));
    });
  });
}

main().catch((err) => {
  console.error("[Gateway] Fatal error:", err);
  process.exit(1);
});
