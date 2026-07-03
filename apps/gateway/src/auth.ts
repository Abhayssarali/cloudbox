import { randomBytes, createVerify } from "crypto";
import type WebSocket from "ws";
import type { GatewayMessage } from "@cloudbox/shared-types";
import { prisma } from "./lib/prisma.js";
import { registerSocket } from "./registry.js";

function send(ws: WebSocket, msg: GatewayMessage) {
  ws.send(JSON.stringify(msg));
}

/**
 * Handles the 3-step authentication handshake for a newly connected agent.
 *
 * Flow:
 *  1. Gateway  →  Agent : AUTH_CHALLENGE { challenge }
 *  2. Agent    →  Gateway : AUTH_RESPONSE { cloudId, signature }
 *  3. Gateway verifies signature with stored public key
 *  4. Gateway  →  Agent : AUTH_OK  (or AUTH_ERROR)
 *
 * Returns the authenticated cloudId on success, or null on failure.
 */
export async function runAuthHandshake(ws: WebSocket): Promise<string | null> {
  return new Promise((resolve) => {
    // Step 1: send challenge
    const challenge = randomBytes(32).toString("hex");
    send(ws, { type: "AUTH_CHALLENGE", challenge });

    // 10 second timeout for the handshake
    const timeout = setTimeout(() => {
      send(ws, { type: "AUTH_ERROR", message: "Authentication timeout" });
      ws.close();
      resolve(null);
    }, 10_000);

    // Step 2: wait for AUTH_RESPONSE
    const handler = async (raw: Buffer | string) => {
      try {
        const msg: GatewayMessage = JSON.parse(raw.toString());
        if (msg.type !== "AUTH_RESPONSE") return; // ignore other messages during handshake

        clearTimeout(timeout);
        ws.off("message", handler);

        const { cloudId, signature } = msg;

        // Look up agent in DB
        const agent = await prisma.agent.findUnique({ where: { cloudId } });
        if (!agent) {
          send(ws, { type: "AUTH_ERROR", message: "Unknown cloudId" });
          ws.close();
          return resolve(null);
        }

        // Step 3: verify signature
        const verify = createVerify("SHA256");
        verify.update(challenge);
        const isValid = verify.verify(agent.publicKey, signature, "base64");

        if (!isValid) {
          send(ws, { type: "AUTH_ERROR", message: "Invalid signature" });
          ws.close();
          return resolve(null);
        }

        // Step 4: mark ONLINE in DB
        await prisma.agent.update({
          where: { cloudId },
          data: { status: "ONLINE", lastHeartbeat: new Date() },
        });

        // Register socket
        registerSocket(cloudId, agent.id, ws);
        send(ws, { type: "AUTH_OK", agentId: agent.id });
        console.log(`[Auth] Agent authenticated: cloudId=${cloudId}`);
        resolve(cloudId);
      } catch (err) {
        console.error("[Auth] Error during handshake:", err);
        ws.close();
        resolve(null);
      }
    };

    ws.on("message", handler);
  });
}
