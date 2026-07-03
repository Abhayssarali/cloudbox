import type { GatewayMessage } from "@cloudbox/shared-types";
import { pubClient, subClient } from "./lib/redis.js";
import { getSocket } from "./registry.js";

// Channel names
const CMD_CHANNEL = "gateway:commands";    // API → Gateway → Agent
const RESP_CHANNEL = "gateway:responses";  // Agent → Gateway → API

/**
 * Start the Redis subscriber that listens for commands from the API
 * and routes them to the correct connected agent socket.
 *
 * Command payload: { cloudId: string, message: GatewayMessage }
 */
export async function startRelaySubscriber() {
  await subClient.subscribe(CMD_CHANNEL, (err: Error | null | undefined) => {
    if (err) console.error("[Relay] Failed to subscribe:", err.message);
    else console.log(`[Relay] Subscribed to channel: ${CMD_CHANNEL}`);
  });

  subClient.on("message", (_channel: string, rawPayload: string) => {
    try {
      const { cloudId, message } = JSON.parse(rawPayload) as {
        cloudId: string;
        message: GatewayMessage;
      };

      const entry = getSocket(cloudId);
      if (!entry) {
        console.warn(`[Relay] No active socket for cloudId=${cloudId}`);
        return;
      }

      entry.ws.send(JSON.stringify(message));
    } catch (err) {
      console.error("[Relay] Error routing command:", err);
    }
  });
}

/**
 * Called by the message handler when an agent sends a response message.
 * Publishes the response to Redis so the API can pick it up.
 */
export async function publishResponse(cloudId: string, message: GatewayMessage) {
  await pubClient.publish(RESP_CHANNEL, JSON.stringify({ cloudId, message }));
}
