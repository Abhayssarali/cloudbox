import { redis } from "./redis.js";
import type { GatewayMessage } from "@cloudbox/shared-types";

const CMD_CHANNEL = "gateway:commands";

/**
 * Publish a command to the Gateway for a specific connected agent.
 * The Gateway is subscribed to this channel and will route the message
 * to the correct WebSocket based on cloudId.
 */
export async function publishCommand(cloudId: string, message: GatewayMessage): Promise<void> {
  await redis.publish(CMD_CHANNEL, JSON.stringify({ cloudId, message }));
}
