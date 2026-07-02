import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../lib/jwt.js";
import type { AuthTokenPayload } from "@cloudbox/shared-types";

// Augment Express to carry authenticated user info
declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      role: "SUPER_ADMIN" | "ADMIN" | "USER";
    }
    interface Request {
      authPayload?: AuthTokenPayload;
    }
  }
}

/**
 * requireAuth — verifies the cb_access httpOnly cookie.
 * Attaches decoded payload to req.user.
 * Returns 401 if token is missing or invalid.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.cb_access as string | undefined;

  if (!token) {
    res.status(401).json({ success: false, error: "Authentication required" });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.authPayload = payload;
    next();
  } catch {
    res.status(401).json({ success: false, error: "Invalid or expired token" });
  }
}

/**
 * requireRole — must be used after requireAuth.
 * Returns 403 if user doesn't have one of the allowed roles.
 */
export function requireRole(...roles: AuthTokenPayload["role"][]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.authPayload) {
      res.status(401).json({ success: false, error: "Authentication required" });
      return;
    }
    if (!roles.includes(req.authPayload.role)) {
      res.status(403).json({ success: false, error: "Insufficient permissions" });
      return;
    }
    next();
  };
}
