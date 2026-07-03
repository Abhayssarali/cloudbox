import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import type { IRouter } from "express";

export const filesRouter: IRouter = Router();

// ---- GET /files ----
// Optional query: ?folder=/path
filesRouter.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.authPayload!.userId;
    const folder = req.query["folder"] ? String(req.query["folder"]) : "/";

    // 1. Resolve the user's agent
    const agent = await prisma.agent.findFirst({
      where: { userId },
    });

    if (!agent) {
      res.json({ success: true, data: { files: [] } });
      return;
    }

    // 2. Query files based on parent folder
    let files;
    if (folder === "/") {
      files = await prisma.file.findMany({
        where: {
          agentId: agent.id,
          parentId: null,
        },
        orderBy: [{ isFolder: "desc" }, { name: "asc" }],
      });
    } else {
      // Find the folder record first
      const folderRecord = await prisma.file.findFirst({
        where: {
          agentId: agent.id,
          path: folder,
          isFolder: true,
        },
      });

      if (!folderRecord) {
        res.status(404).json({ success: false, error: "Folder not found" });
        return;
      }

      files = await prisma.file.findMany({
        where: {
          agentId: agent.id,
          parentId: folderRecord.id,
        },
        orderBy: [{ isFolder: "desc" }, { name: "asc" }],
      });
    }

    // 3. Format to handle BigInt serialization
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
