import { Router } from "express";
import { randomBytes, randomUUID } from "crypto";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { publishCommand } from "../lib/gatewayPublisher.js";
import { requestRegistry } from "../lib/requestRegistry.js";
import type { IRouter, Request, Response } from "express";
import type { GatewayMessage } from "@cloudbox/shared-types";

export const sharingRouter: IRouter = Router();

const CHUNK_TIMEOUT_MS = 60_000;

// ---- POST /sharing ----
// Create a new share link for a file
sharingRouter.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.authPayload!.userId;
    const { fileId, expiresAt } = req.body as { fileId?: string; expiresAt?: string };

    if (!fileId) {
      res.status(400).json({ success: false, error: "fileId is required" });
      return;
    }

    // Verify file exists, belongs to user's agent, and is not a folder
    const file = await prisma.file.findFirst({
      where: {
        id: fileId,
        agent: { userId },
      },
    });

    if (!file) {
      res.status(404).json({ success: false, error: "File not found or access denied" });
      return;
    }

    if (file.isFolder) {
      res.status(400).json({ success: false, error: "Folders cannot be shared" });
      return;
    }

    // Generate unique secure token
    const token = randomBytes(16).toString("hex");
    const expiry = expiresAt ? new Date(expiresAt) : null;

    const shareLink = await prisma.shareLink.create({
      data: {
        fileId,
        token,
        expiresAt: expiry,
      },
      include: {
        file: {
          select: { name: true },
        },
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: shareLink.id,
        token: shareLink.token,
        fileName: shareLink.file.name,
        expiresAt: shareLink.expiresAt?.toISOString() ?? null,
        createdAt: shareLink.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("[SharingRoute] Error creating share link:", err);
    res.status(500).json({ success: false, error: "Failed to create share link" });
  }
});

// ---- GET /sharing ----
// List all active share links created by the authenticated user
sharingRouter.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.authPayload!.userId;

    const links = await prisma.shareLink.findMany({
      where: {
        file: {
          agent: { userId },
        },
      },
      include: {
        file: {
          select: { name: true, size: true, mimeType: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formatted = links.map((link) => ({
      id: link.id,
      token: link.token,
      fileId: link.fileId,
      fileName: link.file.name,
      fileSize: link.file.size.toString(),
      mimeType: link.file.mimeType,
      expiresAt: link.expiresAt?.toISOString() ?? null,
      createdAt: link.createdAt.toISOString(),
    }));

    res.json({ success: true, data: { shareLinks: formatted } });
  } catch (err) {
    console.error("[SharingRoute] Error listing share links:", err);
    res.status(500).json({ success: false, error: "Failed to list share links" });
  }
});

// ---- DELETE /sharing/:id ----
// Revoke a share link
sharingRouter.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.authPayload!.userId;
    const linkId = req.params["id"];

    if (!linkId) {
      res.status(400).json({ success: false, error: "Link ID is required" });
      return;
    }

    // Verify ownership before deleting
    const link = await prisma.shareLink.findFirst({
      where: {
        id: linkId,
        file: {
          agent: { userId },
        },
      },
    });

    if (!link) {
      res.status(404).json({ success: false, error: "Share link not found or access denied" });
      return;
    }

    await prisma.shareLink.delete({
      where: { id: linkId },
    });

    res.json({ success: true, data: { message: "Share link revoked" } });
  } catch (err) {
    console.error("[SharingRoute] Error deleting share link:", err);
    res.status(500).json({ success: false, error: "Failed to revoke share link" });
  }
});

// ---- GET /s/:token ----
// Public metadata for a shared file
sharingRouter.get("/public/:token", async (req: Request, res: Response) => {
  try {
    const token = req.params["token"];

    if (!token) {
      res.status(400).json({ success: false, error: "Token is required" });
      return;
    }

    const link = await prisma.shareLink.findUnique({
      where: { token },
      include: {
        file: {
          include: {
            agent: {
              select: { status: true },
            },
          },
        },
      },
    });

    if (!link) {
      res.status(404).json({ success: false, error: "Share link not found or invalid" });
      return;
    }

    // Check expiration
    if (link.expiresAt && link.expiresAt < new Date()) {
      res.status(410).json({ success: false, error: "Share link has expired" });
      return;
    }

    res.json({
      success: true,
      data: {
        name: link.file.name,
        size: link.file.size.toString(),
        mimeType: link.file.mimeType,
        updatedAt: link.file.updatedAt.toISOString(),
        agentStatus: link.file.agent.status,
      },
    });
  } catch (err) {
    console.error("[SharingRoute] Error fetching public metadata:", err);
    res.status(500).json({ success: false, error: "Failed to fetch file details" });
  }
});

// ---- GET /s/:token/download ----
// Public download stream via token
sharingRouter.get("/public/:token/download", async (req: Request, res: Response) => {
  try {
    const token = req.params["token"];

    if (!token) {
      res.status(400).json({ success: false, error: "Token is required" });
      return;
    }

    const link = await prisma.shareLink.findUnique({
      where: { token },
      include: {
        file: {
          include: {
            agent: true,
          },
        },
      },
    });

    if (!link) {
      res.status(404).json({ success: false, error: "Share link not found or invalid" });
      return;
    }

    // Check expiration
    if (link.expiresAt && link.expiresAt < new Date()) {
      res.status(410).json({ success: false, error: "Share link has expired" });
      return;
    }

    const file = link.file;

    if (file.agent.status === "OFFLINE") {
      res.status(503).json({ success: false, error: "Agent is offline — cannot download" });
      return;
    }

    const requestId = randomUUID();

    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(file.name)}"`);
    res.setHeader("Content-Type", file.mimeType ?? "application/octet-stream");
    if (file.size > 0n) {
      res.setHeader("Content-Length", file.size.toString());
    }

    await publishCommand(file.agent.cloudId, {
      type: "DOWNLOAD_FILE",
      path: file.path,
      requestId,
    });

    console.log(`[Public Download] Streaming "${file.name}" from agent ${file.agent.cloudId} requestId=${requestId}`);

    let done = false;
    while (!done) {
      let chunk: GatewayMessage;
      try {
        chunk = await requestRegistry.waitFor<GatewayMessage>(requestId, CHUNK_TIMEOUT_MS);
      } catch {
        if (!res.headersSent) res.status(504).json({ success: false, error: "Transfer timed out" });
        else res.destroy();
        return;
      }

      if (chunk.type === "ERROR") {
        const errMsg = (chunk as { message: string }).message;
        if (!res.headersSent) res.status(500).json({ success: false, error: errMsg });
        else res.destroy();
        return;
      }

      if (chunk.type === "FILE_CHUNK") {
        const buffer = Buffer.from(chunk.chunk, "base64");
        res.write(buffer);
        if (chunk.final) done = true;
      }
    }

    res.end();
    console.log(`[Public Download] Completed "${file.name}" requestId=${requestId}`);
  } catch (err) {
    console.error("[Public Download] Error:", err);
    if (!res.headersSent) res.status(500).json({ success: false, error: "Download failed" });
    else res.destroy();
  }
});
