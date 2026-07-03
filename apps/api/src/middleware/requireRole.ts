import type { Request, Response, NextFunction } from "express";
import type { Role } from "@prisma/client";

/**
 * Middleware to restrict route access to specific roles.
 * Must be used AFTER `requireAuth`.
 */
export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.authPayload) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }

    if (!allowedRoles.includes(req.authPayload.role as Role)) {
      res.status(403).json({ success: false, error: "Forbidden: insufficient permissions" });
      return;
    }

    next();
  };
}
