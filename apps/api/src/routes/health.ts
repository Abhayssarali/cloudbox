import { Router, type IRouter } from "express";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";
import type { HealthResponse } from "@cloudbox/shared-types";

export const healthRouter: IRouter = Router();

healthRouter.get("/", async (_req, res) => {
  let dbStatus: "connected" | "error" = "error";
  let redisStatus: "connected" | "error" = "error";

  // Check Postgres
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = "connected";
  } catch {
    // dbStatus stays "error"
  }

  // Check Redis
  try {
    const pong = await redis.ping();
    if (pong === "PONG") redisStatus = "connected";
  } catch {
    // redisStatus stays "error"
  }

  const body: HealthResponse = {
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    services: {
      database: dbStatus,
      redis: redisStatus,
    },
  };

  const httpStatus = dbStatus === "connected" && redisStatus === "connected" ? 200 : 503;
  res.status(httpStatus).json(body);
});
