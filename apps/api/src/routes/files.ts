import { Router } from "express";
import { randomUUID } from "crypto";
import Busboy from "busboy";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { publishCommand } from "../lib/gatewayPublisher.js";
import { requestRegistry } from "../lib/requestRegistry.js";
import type { IRouter, Request, Response } from "express";
import type { GatewayMessage } from "@cloudbox/shared-types";

export const filesRouter: IRouter = Router();

const CHUNK_TIMEOUT_MS = 60_000; // 60 seconds per chunk
const MAX_UPLOAD_SIZE = 500 * 1024 * 1024; // 500 MB
const CHUNK_SIZE = 64 * 1024; // 64 KB

// ---- GET /files ----
// Optional query: ?folder=/path
filesRouter.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.authPayload!.userId;
    const folder = req.query["folder"] ? String(req.query["folder"]) : "/";

    const agent = await prisma.agent.findFirst({ where: { userId } });

    if (!agent) {
      res.json({ success: true, data: { files: [] } });
      return;
    }

    let files;
    if (folder === "/") {
      files = await prisma.file.findMany({
        where: { agentId: agent.id, parentId: null },
        orderBy: [{ isFolder: "desc" }, { name: "asc" }],
      });
    } else {
      const folderRecord = await prisma.file.findFirst({
        where: { agentId: agent.id, path: folder, isFolder: true },
      });

      if (!folderRecord) {
        res.status(404).json({ success: false, error: "Folder not found" });
        return;
      }

      files = await prisma.file.findMany({
        where: { agentId: agent.id, parentId: folderRecord.id },
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

    if (file.isFolder) {
      res.status(400).json({ success: false, error: "Cannot download a folder" });
      return;
    }

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

// ---- POST /files/upload?folder=/path ----
// Upload a file from browser → API → Gateway → Agent disk
filesRouter.post("/upload", requireAuth, async (req: Request, res: Response) => {
  const userId = req.authPayload!.userId;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { agents: true },
    });

    if (!user) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }

    const agent = user.agents[0]; // Assuming 1 agent per user for now

    if (!agent) {
      res.status(404).json({ success: false, error: "No agent registered" });
      return;
    }

    if (agent.status === "OFFLINE") {
      res.status(503).json({ success: false, error: "Agent is offline — cannot upload" });
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
          
          // Update usedBytes
          await prisma.user.update({
            where: { id: userId },
            data: { usedBytes: { increment: expectedSize } },
          });

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
