import { Router } from "express";
import { z } from "zod";
import { randomBytes } from "crypto";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";
import { requireAuth } from "../middleware/auth.js";
import type { IRouter } from "express";

export const agentsRouter: IRouter = Router();

// ---- GET /agents ----
agentsRouter.get("/", requireAuth, async (req, res) => {
  const agents = await prisma.agent.findMany({
    where: { userId: req.authPayload!.userId },
    orderBy: { createdAt: "desc" },
  });
  res.json({ success: true, data: { agents } });
});

// ---- POST /agents/claim ----
agentsRouter.post("/claim", requireAuth, async (req, res) => {
  // Generate a random 6-character hex code
  const code = randomBytes(3).toString("hex").toUpperCase();
  
  // Store in Redis: key="claim:{code}", value="userId", EX=600 (10 mins)
  await redis.setex(`claim:${code}`, 600, req.authPayload!.userId);

  res.json({ success: true, data: { code, expiresIn: 600 } });
});

// ---- POST /agents/register ----
const registerSchema = z.object({
  claimCode: z.string().length(6),
  cloudId: z.string().uuid(),
  publicKey: z.string().min(1),
});

agentsRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const { claimCode, cloudId, publicKey } = parsed.data;

  // Validate claim code
  const userId = await redis.get(`claim:${claimCode}`);
  if (!userId) {
    res.status(400).json({ success: false, error: "Invalid or expired claim code" });
    return;
  }

  // Check if cloudId already exists
  const existing = await prisma.agent.findUnique({ where: { cloudId } });
  if (existing) {
    res.status(409).json({ success: false, error: "Cloud ID already registered" });
    return;
  }

  // Create agent
  const agent = await prisma.agent.create({
    data: {
      cloudId,
      publicKey,
      userId,
      status: "OFFLINE",
    },
  });

  // Invalidate claim code
  await redis.del(`claim:${claimCode}`);

  res.json({ success: true, data: { agentId: agent.id } });
});
