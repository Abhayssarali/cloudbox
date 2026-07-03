import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import type { IRouter, Request, Response } from "express";

export const adminRouter: IRouter = Router();

// Apply authentication and role authorization to all routes in this router
adminRouter.use(requireAuth);
adminRouter.use(requireRole("ADMIN", "SUPER_ADMIN"));

// ---- GET /admin/users ----
// List all users with their group and quota info
adminRouter.get("/users", async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
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

// ---- GET /admin/groups ----
// List all groups
adminRouter.get("/groups", async (_req: Request, res: Response) => {
  try {
    const groups = await prisma.group.findMany({
      include: {
        _count: {
          select: { users: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: { groups } });
  } catch (err) {
    console.error("[AdminRoute] Error listing groups:", err);
    res.status(500).json({ success: false, error: "Failed to list groups" });
  }
});

// ---- POST /admin/groups ----
// Create a new group
adminRouter.post("/groups", async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body as { name?: string; description?: string };

    if (!name) {
      res.status(400).json({ success: false, error: "Group name is required" });
      return;
    }

    const group = await prisma.group.create({
      data: { name, description: description || null },
    });

    res.status(201).json({ success: true, data: { group } });
  } catch (err: any) {
    console.error("[AdminRoute] Error creating group:", err);
    if (err.code === "P2002") {
      res.status(409).json({ success: false, error: "Group name already exists" });
    } else {
      res.status(500).json({ success: false, error: "Failed to create group" });
    }
  }
});

// ---- DELETE /admin/groups/:id ----
// Delete a group
adminRouter.delete("/groups/:id", async (req: Request, res: Response) => {
  try {
    const groupId = req.params["id"];

    if (!groupId) {
      res.status(400).json({ success: false, error: "Group ID is required" });
      return;
    }

    // Update users to have no group before deleting the group
    await prisma.user.updateMany({
      where: { groupId },
      data: { groupId: null },
    });

    await prisma.group.delete({
      where: { id: groupId },
    });

    res.json({ success: true, data: { message: "Group deleted" } });
  } catch (err: any) {
    console.error("[AdminRoute] Error deleting group:", err);
    if (err.code === "P2025") {
      res.status(404).json({ success: false, error: "Group not found" });
    } else {
      res.status(500).json({ success: false, error: "Failed to delete group" });
    }
  }
});

// ---- POST /admin/users/:id/group ----
// Assign a user to a group
adminRouter.post("/users/:id/group", async (req: Request, res: Response) => {
  try {
    const userId = req.params["id"];
    
    if (!userId) {
      res.status(400).json({ success: false, error: "User ID is required" });
      return;
    }
    
    const { groupId } = req.body as { groupId?: string | null };

    const user = await prisma.user.update({
      where: { id: userId },
      data: { groupId: groupId || null },
      select: { id: true, email: true, groupId: true },
    });

    res.json({ success: true, data: { user } });
  } catch (err: any) {
    console.error("[AdminRoute] Error assigning group to user:", err);
    if (err.code === "P2025") {
      res.status(404).json({ success: false, error: "User not found" });
    } else {
      res.status(500).json({ success: false, error: "Failed to assign group" });
    }
  }
});

// ---- POST /admin/users/:id/quota ----
// Set a user's storage quota
adminRouter.post("/users/:id/quota", async (req: Request, res: Response) => {
  try {
    const userId = req.params["id"];
    
    if (!userId) {
      res.status(400).json({ success: false, error: "User ID is required" });
      return;
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
      data: {
        user: { ...user, quotaBytes: user.quotaBytes.toString() },
      },
    });
  } catch (err: any) {
    console.error("[AdminRoute] Error setting quota for user:", err);
    if (err.code === "P2025") {
      res.status(404).json({ success: false, error: "User not found" });
    } else {
      res.status(500).json({ success: false, error: "Failed to set quota" });
    }
  }
});
