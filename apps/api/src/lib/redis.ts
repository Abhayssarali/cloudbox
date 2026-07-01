import Redis from "ioredis";

const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  enableReadyCheck: true,
});

redis.on("connect", () => console.log("Redis: connecting…"));
redis.on("ready", () => console.log("Redis: ready"));
redis.on("error", (err) => console.error("Redis error:", err));
redis.on("reconnecting", () => console.log("Redis: reconnecting…"));
