import { Redis } from "ioredis";
import { prisma } from "./prisma.js";
import { requestRegistry } from "./requestRegistry.js";
import { sendMail } from "./mailer.js";

const REDIS_URL = process.env["REDIS_URL"] ?? "redis://localhost:6379";
const RESP_CHANNEL = "gateway:responses";

let subClient: Redis | null = null;

export async function syncAgentFiles(
  agentId: string,
  filesList: {
    path: string;
    name: string;
    size: string;
    isFolder: boolean;
    mimeType: string | null;
    updatedAt: string;
  }[]
) {
  try {
    // 1. Synthesize missing directories to guarantee parent hierarchy exists
    const pathSet = new Set(filesList.map((f) => f.path));
    const listCopy = [...filesList];

    for (const file of listCopy) {
      let currentPath = file.path;
      while (currentPath !== "/" && currentPath.includes("/")) {
        const parentDir = currentPath.substring(0, currentPath.lastIndexOf("/"));
        const parentPath = parentDir === "" ? "/" : parentDir;
        if (parentPath !== "/" && !pathSet.has(parentPath)) {
          pathSet.add(parentPath);
          const dirName = parentPath.substring(parentPath.lastIndexOf("/") + 1);
          filesList.push({
            path: parentPath,
            name: dirName,
            size: "0",
            isFolder: true,
            mimeType: null,
            updatedAt: new Date().toISOString(),
          });
        }
        currentPath = parentPath;
      }
    }

    // 2. Fetch existing files from DB
    const existingFiles = await prisma.file.findMany({
      where: { agentId },
    });
    const existingFilesMap = new Map(existingFiles.map((f) => [f.path, f]));

    // 3. Determine deletes and upserts
    const incomingPaths = new Set(filesList.map((f) => f.path));
    const toDelete = existingFiles.filter((f) => !incomingPaths.has(f.path));

    if (toDelete.length > 0) {
      await prisma.file.deleteMany({
        where: {
          id: { in: toDelete.map((f) => f.id) },
        },
      });
      console.log(`[Sync] Deleted ${toDelete.length} obsolete files/dirs for agent ${agentId}`);
    }

    // Perform upserts
    for (const item of filesList) {
      const existing = existingFilesMap.get(item.path);
      const sizeBigInt = BigInt(item.size);
      const updatedAtDate = new Date(item.updatedAt);

      if (existing) {
        const sizeChanged = existing.size !== sizeBigInt;
        const mtimeChanged = existing.updatedAt.getTime() !== updatedAtDate.getTime();
        const folderChanged = existing.isFolder !== item.isFolder;
        const mimeChanged = existing.mimeType !== item.mimeType;

        if (sizeChanged || mtimeChanged || folderChanged || mimeChanged) {
          await prisma.file.update({
            where: { id: existing.id },
            data: {
              size: sizeBigInt,
              isFolder: item.isFolder,
              mimeType: item.mimeType,
              updatedAt: updatedAtDate,
            },
          });
        }
      } else {
        await prisma.file.create({
          data: {
            agentId,
            path: item.path,
            name: item.name,
            size: sizeBigInt,
            isFolder: item.isFolder,
            mimeType: item.mimeType,
            updatedAt: updatedAtDate,
            parentId: null,
          },
        });
      }
    }

    // 4. Second Pass: Rebuild parentId links
    const allCurrentFiles = await prisma.file.findMany({
      where: { agentId },
    });
    const fileMap = new Map(allCurrentFiles.map((f) => [f.path, f]));

    for (const file of allCurrentFiles) {
      if (file.path === "/") continue;

      const lastSlash = file.path.lastIndexOf("/");
      const parentPath = lastSlash === 0 ? "/" : file.path.substring(0, lastSlash);

      let calculatedParentId: string | null = null;
      if (parentPath !== "/") {
        const parentRecord = fileMap.get(parentPath);
        if (parentRecord && parentRecord.isFolder) {
          calculatedParentId = parentRecord.id;
        }
      }

      if (file.parentId !== calculatedParentId) {
        await prisma.file.update({
          where: { id: file.id },
          data: { parentId: calculatedParentId },
        });
      }
    }

    console.log(`[Sync] Reconciled ${filesList.length} files for agent ${agentId}`);
  } catch (err) {
    console.error(`[Sync] Error syncing agent ${agentId} files:`, err);
  }
}

export async function initGatewaySubscriber() {
  subClient = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  subClient.on("error", (err) => console.error("[Redis:sub] GatewaySubscriber error:", err));

  await subClient.connect();
  await subClient.subscribe(RESP_CHANNEL);
  console.log(`[GatewaySubscriber] Subscribed to Redis channel: ${RESP_CHANNEL}`);

  subClient.on("message", async (_channel, rawPayload) => {
    try {
      const { cloudId, message } = JSON.parse(rawPayload) as {
        cloudId: string;
        message: {
          type: string;
          files?: {
            path: string;
            name: string;
            size: string;
            isFolder: boolean;
            mimeType: string | null;
            updatedAt: string;
          }[];
        };
      };

      // Route transfer messages to waiting HTTP handlers
      if (
        message.type === "FILE_CHUNK" ||
        message.type === "UPLOAD_ACK" ||
        message.type === "DELETE_ACK" ||
        message.type === "ERROR"
      ) {
        const requestId = (message as unknown as { requestId: string }).requestId;
        if (requestId) {
          requestRegistry.emit(requestId, message);
          return;
        }
      }

      if (message.type === "METADATA_SYNC" && message.files) {
        // Find agent in DB
        const agent = await prisma.agent.findUnique({
          where: { cloudId },
          include: { user: { select: { email: true } } },
        });

        if (!agent) {
          console.warn(`[GatewaySubscriber] Received METADATA_SYNC for unregistered cloudId: ${cloudId}`);
          return;
        }

        console.log(`[GatewaySubscriber] Received METADATA_SYNC for agent ${agent.id} (cloudId: ${cloudId})`);
        await syncAgentFiles(agent.id, message.files);
      }

      // Agent offline notification
      if ((message as unknown as { type: string; event?: string }).event === "AGENT_OFFLINE") {
        const agent = await prisma.agent.findUnique({
          where: { cloudId },
          include: { user: { select: { email: true } } },
        });
        if (agent?.user?.email) {
          await sendMail(
            agent.user.email,
            "CloudBox: Your storage node went offline",
            `
              <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
                <h2 style="color:#6366f1">Storage Node Offline</h2>
                <p>Your CloudBox storage node <strong>${cloudId.substring(0, 8)}…</strong> has gone offline.</p>
                <p>Files stored on this node will be unavailable until the node reconnects.</p>
                <p>To reconnect, ensure the agent is running on your machine: <code>cloudbox-agent start</code></p>
                <p><a href="${process.env["CORS_ORIGIN"] ?? "http://localhost:3000"}/dashboard">View Dashboard</a></p>
              </div>
            `
          );
        }
      }
    } catch (err) {
      console.error("[GatewaySubscriber] Error processing message:", err);
    }
  });
}
