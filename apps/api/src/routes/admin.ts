import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import type { IRouter, Request, Response } from "express";

export const adminRouter: IRouter = Router();

function isKnownPrismaError(err: unknown): err is Prisma.PrismaClientKnownRequestError {
  return err instanceof Prisma.PrismaClientKnownRequestError;
}

// Apply authentication and role authorization to all routes
adminRouter.use(requireAuth);
adminRouter.use(requireRole("ADMIN", "SUPER_ADMIN"));

// ─── Helper: resolve the calling admin's groupId ───────────────────────────
// SUPER_ADMIN sees everything (no groupId filter).
// ADMIN only sees/manages their own group.
async function getAdminScope(req: Request): Promise<{ groupId: string | null; isSuperAdmin: boolean }> {
  const userId = req.authPayload!.userId;
  const role = req.authPayload!.role;

  if (role === "SUPER_ADMIN") {
    return { groupId: null, isSuperAdmin: true };
  }

  const admin = await prisma.user.findUnique({
    where: { id: userId },
    select: { groupId: true },
  });

  return { groupId: admin?.groupId ?? null, isSuperAdmin: false };
}

// ─── GET /admin/users ───────────────────────────────────────────────────────
// ADMIN: only users in their own group.
// SUPER_ADMIN: all users.
adminRouter.get("/users", async (req: Request, res: Response) => {
  try {
    const { groupId, isSuperAdmin } = await getAdminScope(req);

    const users = await prisma.user.findMany({
      where: (!isSuperAdmin && groupId) ? { groupId } : {},
      select: {
        id: true,
        email: true,
        role: true,
        quotaBytes: true,
        usedBytes: true,
        groupId: true,
        group: { select: { name: true } },
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const formatted = users.map((u) => ({
      ...u,
      quotaBytes: u.quotaBytes.toString(),
      usedBytes: u.usedBytes.toString(),
    }));

    res.json({ success: true, data: { users: formatted } });
  } catch (err) {
    console.error("[AdminRoute] Error listing users:", err);
    res.status(500).json({ success: false, error: "Failed to list users" });
  }
});

// ─── GET /admin/workspace ───────────────────────────────────────────────────
// Returns the calling Admin's workspace info including inviteCode.
adminRouter.get("/workspace", async (req: Request, res: Response) => {
  try {
    const userId = req.authPayload!.userId;
    const admin = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        groupId: true,
        group: {
          select: { id: true, name: true, inviteCode: true, ownerId: true, _count: { select: { users: true } } },
        },
      },
    });

    if (!admin?.group) {
      res.status(404).json({ success: false, error: "No workspace found for this admin" });
      return;
    }

    res.json({
      success: true,
      data: {
        workspace: {
          id: admin.group.id,
          name: admin.group.name,
          inviteCode: admin.group.inviteCode,
          memberCount: admin.group._count.users,
        },
      },
    });
  } catch (err) {
    console.error("[AdminRoute] Error fetching workspace:", err);
    res.status(500).json({ success: false, error: "Failed to fetch workspace" });
  }
});

// ─── POST /admin/workspace/regenerate-code ─────────────────────────────────
// Regenerate the invite code for the admin's workspace.
adminRouter.post("/workspace/regenerate-code", async (req: Request, res: Response) => {
  try {
    const userId = req.authPayload!.userId;
    const admin = await prisma.user.findUnique({
      where: { id: userId },
      select: { groupId: true },
    });

    if (!admin?.groupId) {
      res.status(404).json({ success: false, error: "No workspace found" });
      return;
    }

    const { randomBytes } = await import("crypto");
    const newCode = randomBytes(5).toString("hex").toUpperCase();

    const group = await prisma.group.update({
      where: { id: admin.groupId },
      data: { inviteCode: newCode },
      select: { inviteCode: true },
    });

    res.json({ success: true, data: { inviteCode: group.inviteCode } });
  } catch (err) {
    console.error("[AdminRoute] Error regenerating invite code:", err);
    res.status(500).json({ success: false, error: "Failed to regenerate invite code" });
  }
});

// ─── POST /admin/users/:id/quota ───────────────────────────────────────────
// Set a user's storage quota. Admin can only update users in their group.
adminRouter.post("/users/:id/quota", async (req: Request, res: Response) => {
  try {
    const userId = req.params["id"];
    if (!userId) {
      res.status(400).json({ success: false, error: "User ID is required" });
      return;
    }

    const { groupId, isSuperAdmin } = await getAdminScope(req);

    // Guard: ensure target user is in admin's group
    if (!isSuperAdmin) {
      const target = await prisma.user.findUnique({ where: { id: userId }, select: { groupId: true } });
      if (!target || target.groupId !== groupId) {
        res.status(403).json({ success: false, error: "Access denied — user is not in your workspace" });
        return;
      }
    }

    const { quotaBytes } = req.body as { quotaBytes?: number | string };
    if (quotaBytes === undefined) {
      res.status(400).json({ success: false, error: "quotaBytes is required" });
      return;
    }

    let parsedQuota: bigint;
    try {
      parsedQuota = BigInt(quotaBytes);
    } catch {
      res.status(400).json({ success: false, error: "Invalid quotaBytes value" });
      return;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { quotaBytes: parsedQuota },
      select: { id: true, email: true, quotaBytes: true },
    });

    res.json({
      success: true,
      data: { user: { ...user, quotaBytes: user.quotaBytes.toString() } },
    });
  } catch (err: unknown) {
    console.error("[AdminRoute] Error setting quota for user:", err);
    if (isKnownPrismaError(err) && err.code === "P2025") {
      res.status(404).json({ success: false, error: "User not found" });
    } else {
      res.status(500).json({ success: false, error: "Failed to set quota" });
    }
  }
});

// ─── POST /admin/users/:id/role ────────────────────────────────────────────
// Change a user's role. Admin can only change users in their group.
adminRouter.post("/users/:id/role", async (req: Request, res: Response) => {
  try {
    const userId = req.params["id"];
    if (!userId) {
      res.status(400).json({ success: false, error: "User ID is required" });
      return;
    }

    const { groupId, isSuperAdmin } = await getAdminScope(req);

    if (!isSuperAdmin) {
      const target = await prisma.user.findUnique({ where: { id: userId }, select: { groupId: true } });
      if (!target || target.groupId !== groupId) {
        res.status(403).json({ success: false, error: "Access denied — user is not in your workspace" });
        return;
      }
    }

    const { role } = req.body as { role?: "USER" | "ADMIN" | "SUPER_ADMIN" };
    if (!role || !["USER", "ADMIN", "SUPER_ADMIN"].includes(role)) {
      res.status(400).json({ success: false, error: "Valid role is required" });
      return;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, email: true, role: true },
    });

    res.json({ success: true, data: { user } });
  } catch (err: unknown) {
    console.error("[AdminRoute] Error setting role for user:", err);
    if (isKnownPrismaError(err) && err.code === "P2025") {
      res.status(404).json({ success: false, error: "User not found" });
    } else {
      res.status(500).json({ success: false, error: "Failed to set role" });
    }
  }
});

// ─── DELETE /admin/users/:id ───────────────────────────────────────────────
// Remove a user from the workspace.
adminRouter.delete("/users/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.params["id"];
    if (!userId) {
      res.status(400).json({ success: false, error: "User ID is required" });
      return;
    }

    const { groupId, isSuperAdmin } = await getAdminScope(req);

    if (!isSuperAdmin) {
      const target = await prisma.user.findUnique({ where: { id: userId }, select: { groupId: true } });
      if (!target || target.groupId !== groupId) {
        res.status(403).json({ success: false, error: "Access denied — user is not in your workspace" });
        return;
      }
    }

    // Just remove from workspace, don't delete account entirely
    await prisma.user.update({
      where: { id: userId },
      data: { groupId: null },
    });

    res.json({ success: true });
  } catch (err: unknown) {
    console.error("[AdminRoute] Error removing user:", err);
    if (isKnownPrismaError(err) && err.code === "P2025") {
      res.status(404).json({ success: false, error: "User not found" });
    } else {
      res.status(500).json({ success: false, error: "Failed to remove user" });
    }
  }
});

// ─── GET /admin/agents ─────────────────────────────────────────────────────
// ADMIN: only agents owned by users in their group.
// SUPER_ADMIN: all agents.
adminRouter.get("/agents", async (req: Request, res: Response) => {
  try {
    const { groupId, isSuperAdmin } = await getAdminScope(req);

    let userIds: string[] | undefined;
    if (!isSuperAdmin && groupId) {
      const groupUsers = await prisma.user.findMany({
        where: { groupId },
        select: { id: true },
      });
      userIds = groupUsers.map((u) => u.id);
    }

    const agents = await prisma.agent.findMany({
      where: userIds ? { userId: { in: userIds } } : {},
      include: {
        user: { select: { id: true, email: true } },
        allocatedUser: { select: { id: true, email: true } },
        allocatedGroup: { select: { id: true, name: true } },
        _count: { select: { files: true } },
      },
      orderBy: { lastHeartbeat: "desc" },
    });

    const formatted = agents.map((a) => ({
      id: a.id,
      cloudId: a.cloudId,
      status: a.status,
      lastHeartbeat: a.lastHeartbeat?.toISOString() ?? null,
      version: a.version,
      createdAt: a.createdAt.toISOString(),
      user: a.user,
      fileCount: a._count.files,
      allocatedUser: a.allocatedUser,
      allocatedGroup: a.allocatedGroup,
      totalDiskBytes: a.totalDiskBytes?.toString() ?? null,
      freeDiskBytes: a.freeDiskBytes?.toString() ?? null,
    }));

    res.json({ success: true, data: { agents: formatted } });
  } catch (err) {
    console.error("[AdminRoute] Error listing agents:", err);
    res.status(500).json({ success: false, error: "Failed to list agents" });
  }
});

// ─── POST /admin/agents/:id/allocate ──────────────────────────────────────
// Allocate an agent to a user (within admin's group) or the group itself.
adminRouter.post("/agents/:id/allocate", async (req: Request, res: Response) => {
  try {
    const agentId = req.params["id"];
    if (!agentId) {
      res.status(400).json({ success: false, error: "Agent ID is required" });
      return;
    }

    const { groupId, isSuperAdmin } = await getAdminScope(req);

    // Ensure admin owns this agent (via their group's users)
    if (!isSuperAdmin && groupId) {
      const groupUsers = await prisma.user.findMany({ where: { groupId }, select: { id: true } });
      const userIds = groupUsers.map((u) => u.id);
      const agentCheck = await prisma.agent.findFirst({ where: { id: agentId, userId: { in: userIds } } });
      if (!agentCheck) {
        res.status(403).json({ success: false, error: "Access denied — agent not in your workspace" });
        return;
      }
    }

    const { userId, groupId: targetGroupId } = req.body as {
      userId?: string | null;
      groupId?: string | null;
    };

    const agent = await prisma.agent.update({
      where: { id: agentId },
      data: {
        allocatedUserId: userId ?? null,
        allocatedGroupId: targetGroupId ?? null,
      },
      include: {
        allocatedUser: { select: { id: true, email: true } },
        allocatedGroup: { select: { id: true, name: true } },
      },
    });

    res.json({
      success: true,
      data: {
        agent: {
          id: agent.id,
          allocatedUser: agent.allocatedUser,
          allocatedGroup: agent.allocatedGroup,
        },
      },
    });
  } catch (err: unknown) {
    console.error("[AdminRoute] Error allocating agent:", err);
    if (isKnownPrismaError(err) && err.code === "P2025") {
      res.status(404).json({ success: false, error: "Agent not found" });
    } else {
      res.status(500).json({ success: false, error: "Failed to allocate agent" });
    }
  }
});

// ─── GET /admin/stats ──────────────────────────────────────────────────────
// ADMIN: stats scoped to their group. SUPER_ADMIN: platform-wide.
adminRouter.get("/stats", async (req: Request, res: Response) => {
  try {
    const { groupId, isSuperAdmin } = await getAdminScope(req);

    let userIds: string[] | undefined;
    if (!isSuperAdmin && groupId) {
      const groupUsers = await prisma.user.findMany({ where: { groupId }, select: { id: true } });
      userIds = groupUsers.map((u) => u.id);
    }

    const [userCount, agentCount, onlineCount, fileCount, storageAgg] = await Promise.all([
      prisma.user.count({
        where: userIds ? { id: { in: userIds } } : {},
      }),
      prisma.agent.count({
        where: userIds ? { userId: { in: userIds } } : {},
      }),
      prisma.agent.count({
        where: userIds ? { status: "ONLINE", userId: { in: userIds } } : { status: "ONLINE" },
      }),
      prisma.file.count({
        where: userIds ? { isFolder: false, agent: { userId: { in: userIds } } } : { isFolder: false },
      }),
      prisma.user.aggregate({
        where: userIds ? { id: { in: userIds } } : {},
        _sum: { usedBytes: true },
      }),
    ]);

    res.json({
      success: true,
      data: {
        userCount,
        agentCount,
        onlineAgentCount: onlineCount,
        fileCount,
        totalUsedBytes: (storageAgg._sum?.usedBytes ?? 0n).toString(),
      },
    });
  } catch (err) {
    console.error("[AdminRoute] Error fetching stats:", err);
    res.status(500).json({ success: false, error: "Failed to fetch stats" });
  }
});

// ─── GET /admin/activity ───────────────────────────────────────────────────
adminRouter.get("/activity", async (req: Request, res: Response) => {
  try {
    const { groupId, isSuperAdmin } = await getAdminScope(req);
    const limit = Math.min(parseInt(String(req.query["limit"] ?? "50"), 10), 200);

    let userIds: string[] | undefined;
    if (!isSuperAdmin && groupId) {
      const groupUsers = await prisma.user.findMany({ where: { groupId }, select: { id: true } });
      userIds = groupUsers.map((u) => u.id);
    }

    const logs = await prisma.activityLog.findMany({
      where: userIds ? { userId: { in: userIds } } : {},
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { email: true } } },
    });

    const formatted = logs.map((l) => ({
      id: l.id,
      action: l.action,
      userEmail: l.user?.email ?? null,
      meta: l.meta ? (JSON.parse(l.meta) as unknown) : null,
      createdAt: l.createdAt.toISOString(),
    }));

    res.json({ success: true, data: { logs: formatted } });
  } catch (err) {
    console.error("[AdminRoute] Error fetching activity logs:", err);
    res.status(500).json({ success: false, error: "Failed to fetch activity logs" });
  }
});
