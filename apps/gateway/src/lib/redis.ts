import { Redis } from "ioredis";
import "dotenv/config";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

export const pubClient = new Redis(REDIS_URL, { lazyConnect: true });
export const subClient = new Redis(REDIS_URL, { lazyConnect: true });

pubClient.on("error", (err: Error) => console.error("[Redis:pub] error:", err.message));
subClient.on("error", (err: Error) => console.error("[Redis:sub] error:", err.message));

export async function connectRedis() {
  await pubClient.connect();
  await subClient.connect();
  console.log("[Redis] pub + sub clients connected");
}
