import { Router } from "express";
import { randomUUID } from "crypto";
import Busboy from "busboy";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { publishCommand } from "../lib/gatewayPublisher.js";
import { requestRegistry } from "../lib/requestRegistry.js";
import { logActivity } from "../lib/activityLog.js";
import { notifyQuotaIfNeeded } from "../lib/quotaNotifier.js";
import type { IRouter, Request, Response } from "express";
import type { GatewayMessage } from "@cloudbox/shared-types";

export const filesRouter: IRouter = Router();

const CHUNK_TIMEOUT_MS = 60_000; // 60 seconds per chunk
const MAX_UPLOAD_SIZE = 500 * 1024 * 1024; // 500 MB
const CHUNK_SIZE = 64 * 1024; // 64 KB

// ---- Helper: resolve agent IDs accessible to a user ----
// Includes: owned agents + agents allocated to the user + agents allocated to user's group
async function getAccessibleAgentIds(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { groupId: true },
  });

  const agents = await prisma.agent.findMany({
    where: {
      OR: [
        { userId },
        { allocatedUserId: userId },
        ...(user?.groupId ? [{ allocatedGroupId: user.groupId }] : []),
      ],
    },
    select: { id: true },
  });

  return agents.map((a) => a.id);
}

// ---- Helper: resolve online agents accessible to a user ----
// An agent is considered "online" only if:
//  a) DB status === "ONLINE", AND
//  b) lastHeartbeat is within the last 2 minutes (guards against stale DB status
//     after a gateway restart before cleanup runs)
async function getAccessibleOnlineAgents(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { groupId: true },
  });

  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);

  return prisma.agent.findMany({
    where: {
      status: "ONLINE",
      lastHeartbeat: { gte: twoMinutesAgo }, // must have recent heartbeat
      OR: [
        { userId },
        { allocatedUserId: userId },
        ...(user?.groupId ? [{ allocatedGroupId: user.groupId }] : []),
      ],
    },
  });
}

// ---- GET /files/trash ----
// Returns soft-deleted files for the current user
filesRouter.get("/trash", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.authPayload!.userId;

    const agentIds = await getAccessibleAgentIds(userId);

    if (agentIds.length === 0) {
      res.json({ success: true, data: { files: [] } });
      return;
    }

    const files = await prisma.file.findMany({
      where: {
        agentId: { in: agentIds },
        deletedAt: { not: null },
      },
      orderBy: { deletedAt: "desc" },
    });

    const formatted = files.map((f) => ({
      id: f.id,
      agentId: f.agentId,
      path: f.path,
      name: f.name,
      size: f.size.toString(),
      isFolder: f.isFolder,
      mimeType: f.mimeType,
      parentId: f.parentId,
      updatedAt: f.updatedAt.toISOString(),
      deletedAt: f.deletedAt?.toISOString() ?? null,
    }));

    res.json({ success: true, data: { files: formatted } });
  } catch (err) {
    console.error("[FilesRoute] Error listing trash:", err);
    res.status(500).json({ success: false, error: "Failed to list trash" });
  }
});

// ---- GET /files ----
// Optional query: ?folder=/path&agentId=<id>
filesRouter.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.authPayload!.userId;
    const folder = req.query["folder"] ? String(req.query["folder"]) : "/";
    const targetAgentId = req.query["agentId"] ? String(req.query["agentId"]) : null;

    // Determine accessible agent IDs for the user
    const allAccessibleIds = await getAccessibleAgentIds(userId);
    // If a specific agent was requested, verify the user has access to it
    const agentIds = targetAgentId
      ? (allAccessibleIds.includes(targetAgentId) ? [targetAgentId] : [])
      : allAccessibleIds;

    if (agentIds.length === 0) {
      res.json({ success: true, data: { files: [] } });
      return;
    }

    let files;
    if (folder === "/") {
      files = await prisma.file.findMany({
        where: { agentId: { in: agentIds }, parentId: null, deletedAt: null },
        orderBy: [{ isFolder: "desc" }, { name: "asc" }],
      });
    } else {
      const folderRecord = await prisma.file.findFirst({
        where: { agentId: { in: agentIds }, path: folder, isFolder: true, deletedAt: null },
      });

      if (!folderRecord) {
        res.status(404).json({ success: false, error: "Folder not found" });
        return;
      }

      files = await prisma.file.findMany({
        where: { agentId: { in: agentIds }, parentId: folderRecord.id, deletedAt: null },
        orderBy: [{ isFolder: "desc" }, { name: "asc" }],
      });
    }

    const formatted = files.map((f) => ({
      id: f.id,
      agentId: f.agentId,
      path: f.path,
      name: f.name,
      size: f.size.toString(),
      isFolder: f.isFolder,
      mimeType: f.mimeType,
      parentId: f.parentId,
      updatedAt: f.updatedAt.toISOString(),
    }));

    res.json({ success: true, data: { files: formatted } });
  } catch (err) {
    console.error("[FilesRoute] Error listing files:", err);
    res.status(500).json({ success: false, error: "Failed to list files" });
  }
});

// ---- GET /files/:id/versions ----
// Returns version history for a file
filesRouter.get("/:id/versions", requireAuth, async (req: Request, res: Response) => {
  const fileId = req.params["id"];
  const userId = req.authPayload!.userId;

  try {
    if (!fileId) {
      res.status(400).json({ success: false, error: "Missing file id" });
      return;
    }

    const file = await prisma.file.findFirst({
      where: { id: fileId },
      include: { agent: true },
    });

    if (!file) {
      res.status(404).json({ success: false, error: "File not found" });
      return;
    }

    if (file.agent.userId !== userId) {
      res.status(403).json({ success: false, error: "Access denied" });
      return;
    }

    const versions = await prisma.fileVersion.findMany({
      where: { fileId },
      orderBy: { versionNumber: "desc" },
    });

    const formatted = versions.map((v) => ({
      id: v.id,
      versionNumber: v.versionNumber,
      size: v.size.toString(),
      storagePath: v.storagePath,
      createdAt: v.createdAt.toISOString(),
    }));

    res.json({ success: true, data: { versions: formatted } });
  } catch (err) {
    console.error("[FilesRoute] Error listing versions:", err);
    res.status(500).json({ success: false, error: "Failed to list versions" });
  }
});

// ---- GET /files/download/:id ----
// Stream a file from the Agent through the Gateway tunnel to the browser
filesRouter.get("/download/:id", requireAuth, async (req: Request, res: Response) => {
  const fileId = req.params["id"];
  const userId = req.authPayload!.userId;

  try {
    if (!fileId) {
      res.status(400).json({ success: false, error: "Missing file id" });
      return;
    }

    const file = await prisma.file.findFirst({
      where: { id: fileId, deletedAt: null },
      include: { agent: true },
    });

    if (!file) {
      res.status(404).json({ success: false, error: "File not found" });
      return;
    }

    if (file.agent.userId !== userId) {
      // Also allow access if this agent is allocated to the user or their group
      const accessibleIds = await getAccessibleAgentIds(userId);
      if (!accessibleIds.includes(file.agentId)) {
        res.status(403).json({ success: false, error: "Access denied" });
        return;
      }
    }

    if (file.isFolder) {
      res.status(400).json({ success: false, error: "Cannot download a folder" });
      return;
    }

    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const agentIsStale = file.agent.status === "OFFLINE" ||
      !file.agent.lastHeartbeat ||
      file.agent.lastHeartbeat < twoMinutesAgo;

    if (agentIsStale) {
      res.status(503).json({ success: false, error: "Storage node is offline or unreachable. Please ensure your CloudBox agent is running." });
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

    console.log(`[Download] Streaming "${file.name}" from agent ${file.agent.cloudId} requestId=${requestId}`);

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
    console.log(`[Download] Completed "${file.name}" requestId=${requestId}`);
  } catch (err) {
    console.error("[Download] Error:", err);
    if (!res.headersSent) res.status(500).json({ success: false, error: "Download failed" });
    else res.destroy();
  }
});

// ---- DELETE /files/:id ----
// Soft-delete (move to trash)
filesRouter.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  const fileId = req.params["id"];
  const userId = req.authPayload!.userId;

  try {
    if (!fileId) {
      res.status(400).json({ success: false, error: "Missing file id" });
      return;
    }

    const file = await prisma.file.findFirst({
      where: { id: fileId, deletedAt: null },
      include: { agent: true },
    });

    if (!file) {
      res.status(404).json({ success: false, error: "File not found" });
      return;
    }

    if (file.agent.userId !== userId) {
      // Allow access if agent is allocated to this user or their group
      const accessibleIds = await getAccessibleAgentIds(userId);
      if (!accessibleIds.includes(file.agentId)) {
        res.status(403).json({ success: false, error: "Access denied" });
        return;
      }
    }

    await prisma.file.update({
      where: { id: fileId },
      data: { deletedAt: new Date() },
    });

    await logActivity("DELETE", { userId, meta: { name: file.name, path: file.path } });

    res.json({ success: true });
  } catch (err) {
    console.error("[FilesRoute] Error soft-deleting file:", err);
    res.status(500).json({ success: false, error: "Failed to delete file" });
  }
});

// ---- POST /files/:id/restore ----
// Restore a file from trash
filesRouter.post("/:id/restore", requireAuth, async (req: Request, res: Response) => {
  const fileId = req.params["id"];
  const userId = req.authPayload!.userId;

  try {
    if (!fileId) {
      res.status(400).json({ success: false, error: "Missing file id" });
      return;
    }

    const file = await prisma.file.findFirst({
      where: { id: fileId, deletedAt: { not: null } },
      include: { agent: true },
    });

    if (!file) {
      res.status(404).json({ success: false, error: "File not found in trash" });
      return;
    }

    if (file.agent.userId !== userId) {
      // Allow access if agent is allocated to this user or their group
      const accessibleIds = await getAccessibleAgentIds(userId);
      if (!accessibleIds.includes(file.agentId)) {
        res.status(403).json({ success: false, error: "Access denied" });
        return;
      }
    }

    await prisma.file.update({
      where: { id: fileId },
      data: { deletedAt: null },
    });

    await logActivity("RESTORE", { userId, meta: { name: file.name, path: file.path } });

    res.json({ success: true });
  } catch (err) {
    console.error("[FilesRoute] Error restoring file:", err);
    res.status(500).json({ success: false, error: "Failed to restore file" });
  }
});

// ---- DELETE /files/:id/permanent ----
// Permanently delete from DB and instruct agent to remove from disk
filesRouter.delete("/:id/permanent", requireAuth, async (req: Request, res: Response) => {
  const fileId = req.params["id"];
  const userId = req.authPayload!.userId;

  try {
    if (!fileId) {
      res.status(400).json({ success: false, error: "Missing file id" });
      return;
    }

    const file = await prisma.file.findFirst({
      where: { id: fileId },
      include: { agent: true },
    });

    if (!file) {
      res.status(404).json({ success: false, error: "File not found" });
      return;
    }

    if (file.agent.userId !== userId) {
      // Allow access if agent is allocated to this user or their group
      const accessibleIds = await getAccessibleAgentIds(userId);
      if (!accessibleIds.includes(file.agentId)) {
        res.status(403).json({ success: false, error: "Access denied" });
        return;
      }
    }

    // If agent is online, tell it to delete the file from disk
    if (file.agent.status === "ONLINE" && !file.isFolder) {
      const requestId = randomUUID();
      try {
        await publishCommand(file.agent.cloudId, {
          type: "DELETE_FILE",
          path: file.path,
          requestId,
        });
        // Wait for ack with short timeout — not fatal if it fails
        await requestRegistry.waitFor<GatewayMessage>(requestId, 10_000);
      } catch {
        console.warn(`[Delete] Agent DELETE_FILE timed out for "${file.path}" — removing from DB anyway`);
      }
    }

    // Decrement usedBytes
    if (!file.isFolder && file.size > 0n) {
      await prisma.user.update({
        where: { id: userId },
        data: { usedBytes: { decrement: file.size } },
      });
    }

    // Remove from DB (cascades shareLinks, versions)
    await prisma.file.delete({ where: { id: fileId } });
    await logActivity("PERMANENT_DELETE", { userId, meta: { name: file.name, path: file.path } });

    res.json({ success: true });
  } catch (err) {
    console.error("[FilesRoute] Error permanently deleting file:", err);
    res.status(500).json({ success: false, error: "Failed to permanently delete file" });
  }
});

// ---- POST /files/upload?folder=&agentId= ----
// Upload a file from browser → API → Gateway → Agent disk
filesRouter.post("/upload", requireAuth, async (req: Request, res: Response) => {
  const userId = req.authPayload!.userId;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { quotaBytes: true, usedBytes: true },
    });

    if (!user) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }

    // Respect optional agentId query param for multi-agent setups
    const targetAgentId = req.query["agentId"] ? String(req.query["agentId"]) : null;
    const onlineAgents = await getAccessibleOnlineAgents(userId);

    const agent = targetAgentId
      ? onlineAgents.find((a) => a.id === targetAgentId) ?? null
      : onlineAgents[0] ?? null;

    if (!agent) {
      res.status(503).json({ success: false, error: "No online agent found. An admin may need to allocate a storage node to your account." });
      return;
    }

    // Check quota
    const contentLength = req.headers["content-length"];
    const expectedSize = contentLength ? parseInt(contentLength, 10) : 0;
    
    if (user.quotaBytes > 0n) {
      if (user.usedBytes + BigInt(expectedSize) > user.quotaBytes) {
        res.status(413).json({ success: false, error: "Storage quota exceeded" });
        return;
      }
    }

    const uploadFolder = req.query["folder"] ? String(req.query["folder"]) : "/";

    const busboy = Busboy({
      headers: req.headers,
      limits: { fileSize: MAX_UPLOAD_SIZE },
    });

    let responded = false;

    busboy.on("file", async (_fieldname, fileStream, info) => {
      const { filename } = info;
      const targetPath = uploadFolder === "/" ? `/${filename}` : `${uploadFolder}/${filename}`;
      const requestId = randomUUID();

      console.log(`[Upload] Starting "${filename}" → "${targetPath}" requestId=${requestId}`);

      try {
        // Check for existing file to snapshot a version
        const existingFile = await prisma.file.findFirst({
          where: { agentId: agent.id, path: targetPath },
          include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
        });

        // Tell agent to prepare for the upload
        await publishCommand(agent.cloudId, {
          type: "UPLOAD_FILE",
          path: targetPath,
          requestId,
        });

        // Stream incoming browser data as base64 FILE_CHUNK messages
        for await (const chunk of fileStream) {
          const buf = chunk as Buffer;
          for (let offset = 0; offset < buf.length; offset += CHUNK_SIZE) {
            const slice = buf.slice(offset, offset + CHUNK_SIZE);
            await publishCommand(agent.cloudId, {
              type: "FILE_CHUNK",
              requestId,
              chunk: slice.toString("base64"),
              final: false,
            });
          }
        }

        // Signal end of file
        await publishCommand(agent.cloudId, {
          type: "FILE_CHUNK",
          requestId,
          chunk: "",
          final: true,
        });

        // Wait for UPLOAD_ACK from agent
        const ack = await requestRegistry.waitFor<GatewayMessage>(requestId, 30_000);

        if (ack.type === "UPLOAD_ACK" && ack.success) {
          console.log(`[Upload] Completed "${filename}" requestId=${requestId}`);

          // Snapshot old version before the metadata sync overwrites the size
          if (existingFile) {
            const lastVersionNumber = existingFile.versions[0]?.versionNumber ?? 0;
            await prisma.fileVersion.create({
              data: {
                fileId: existingFile.id,
                versionNumber: lastVersionNumber + 1,
                size: existingFile.size,
                storagePath: existingFile.path,
              },
            });
          }

          // Update usedBytes
          await prisma.user.update({
            where: { id: userId },
            data: { usedBytes: { increment: expectedSize } },
          });
          await logActivity("UPLOAD", { userId, meta: { name: filename, path: targetPath, size: expectedSize } });

          // Quota notification check (80% / 95%)
          const updatedUser = await prisma.user.findUnique({ where: { id: userId }, select: { usedBytes: true, quotaBytes: true, email: true } });
          if (updatedUser) {
            await notifyQuotaIfNeeded(updatedUser.email, updatedUser.usedBytes, updatedUser.quotaBytes);
          }

          if (!responded) {
            responded = true;
            res.json({ success: true, data: { path: targetPath, name: filename } });
          }
        } else {
          throw new Error("Agent reported upload failure");
        }
      } catch (err: unknown) {
        fileStream.resume(); // drain
        const msg = err instanceof Error ? err.message : "Upload failed";
        console.error("[Upload] Error:", msg);
        if (!responded) {
          responded = true;
          res.status(500).json({ success: false, error: msg });
        }
      }
    });

    busboy.on("error", (err) => {
      console.error("[Upload] Busboy error:", err);
      if (!responded) {
        responded = true;
        res.status(500).json({ success: false, error: "Upload parsing failed" });
      }
    });

    req.pipe(busboy);
  } catch (err) {
    console.error("[Upload] Unexpected error:", err);
    if (!res.headersSent) res.status(500).json({ success: false, error: "Upload failed" });
  }
});
