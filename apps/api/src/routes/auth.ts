import { Router } from "express";
import { z } from "zod";
import argon2 from "argon2";
// @ts-expect-error - otplib typings don't play well with NodeNext
import { authenticator } from "otplib";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";
import { passport } from "../lib/passport.js";
import type { GooglePendingUser } from "../lib/passport.js";
import { setAuthCookies, clearAuthCookies, verifyRefreshToken, signAccessToken } from "../lib/jwt.js";
import { requireAuth } from "../middleware/auth.js";
import { logActivity } from "../lib/activityLog.js";
import { generateOtp, storeOtp, verifyOtp, invalidateOtp } from "../lib/emailOtp.js";
import { sendOtpEmail } from "../lib/mailer.js";
import type { IRouter } from "express";

const GOOGLE_PENDING_TTL = 10 * 60; // 10 minutes
const GOOGLE_PENDING_PREFIX = "google_pending:";

async function storeGooglePending(token: string, profile: { googleId: string; email: string; displayName: string }): Promise<void> {
  await redis.set(`${GOOGLE_PENDING_PREFIX}${token}`, JSON.stringify(profile), "EX", GOOGLE_PENDING_TTL);
}

async function getGooglePending(token: string): Promise<{ googleId: string; email: string; displayName: string } | null> {
  const raw = await redis.get(`${GOOGLE_PENDING_PREFIX}${token}`);
  if (!raw) return null;
  await redis.del(`${GOOGLE_PENDING_PREFIX}${token}`);
  return JSON.parse(raw) as { googleId: string; email: string; displayName: string };
}


export const authRouter: IRouter = Router();

// ---- Validation Schemas ----

const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password too long"),
  // Exactly one of these must be provided
  inviteCode: z.string().optional(),    // join an existing workspace
  workspaceName: z.string().min(2, "Workspace name must be at least 2 characters").max(64).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

// ---- POST /auth/signup ----
// Two flows:
//   1) workspaceName provided → create a new workspace, caller becomes ADMIN
//   2) inviteCode provided    → join an existing workspace as USER

authRouter.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: parsed.error.issues[0]?.message ?? "Validation failed",
    });
    return;
  }

  const { email, password, inviteCode, workspaceName } = parsed.data;

  // Exactly one of inviteCode / workspaceName must be provided
  if (!inviteCode && !workspaceName) {
    res.status(400).json({ success: false, error: "Provide either an invite code to join a workspace, or a workspace name to create one." });
    return;
  }
  if (inviteCode && workspaceName) {
    res.status(400).json({ success: false, error: "Provide either an invite code OR a workspace name, not both." });
    return;
  }

  // Check if email already in use
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ success: false, error: "Email already registered" });
    return;
  }

  const passwordHash = await argon2.hash(password);

  // ── Flow A: Create a new workspace, caller becomes ADMIN ─────────────────
  if (workspaceName) {
    // Check workspace name not taken
    const nameConflict = await prisma.group.findUnique({ where: { name: workspaceName } });
    if (nameConflict) {
      res.status(409).json({ success: false, error: "A workspace with that name already exists." });
      return;
    }

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: "ADMIN",
        emailVerified: false,
        ownedGroups: {
          create: {
            name: workspaceName,
            // ownerId is auto-linked via nested create
          },
        },
      },
      include: {
        ownedGroups: { select: { id: true, name: true, inviteCode: true } },
      },
    });

    // Put the admin themselves in the group they just created
    const group = user.ownedGroups[0]!;
    await prisma.user.update({
      where: { id: user.id },
      data: { groupId: group.id },
    });

    // Send email verification OTP instead of auto-login
    const otp = generateOtp();
    await storeOtp(user.id, otp);
    await sendOtpEmail(email, otp);

    await logActivity("SIGNUP", { userId: user.id, meta: { email: user.email, type: "create_workspace", workspace: workspaceName } });

    res.status(201).json({
      success: true,
      data: {
        requiresVerification: true,
        userId: user.id,
        email: user.email,
      },
    });
    return;
  }

  // ── Flow B: Join an existing workspace via invite code ───────────────────
  if (inviteCode) {
    const group = await prisma.group.findUnique({ where: { inviteCode } });
    if (!group) {
      res.status(404).json({ success: false, error: "Invalid invite code. Please check with your workspace admin." });
      return;
    }

    const user = await prisma.user.create({
      data: { email, passwordHash, role: "USER", groupId: group.id, emailVerified: false },
      select: { id: true, email: true, role: true },
    });

    // Send email verification OTP instead of auto-login
    const otp = generateOtp();
    await storeOtp(user.id, otp);
    await sendOtpEmail(email, otp);

    await logActivity("SIGNUP", { userId: user.id, meta: { email: user.email, type: "join_workspace", workspace: group.name } });

    res.status(201).json({
      success: true,
      data: {
        requiresVerification: true,
        userId: user.id,
        email: user.email,
      },
    });
    return;
  }
});

// ---- POST /auth/login ----

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: "Invalid email or password",
    });
    return;
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });

  // Guard: user doesn't exist — return specific error code so frontend can prompt signup
  if (!user) {
    res.status(401).json({ success: false, error: "No account found with this email.", errorCode: "ACCOUNT_NOT_FOUND" });
    return;
  }

  // Guard: Google-only account (no password set)
  if (!user.passwordHash) {
    res.status(401).json({ success: false, error: "This account uses Google Sign-In. Please use the Google button to log in." });
    return;
  }

  const valid = await argon2.verify(user.passwordHash, password);
  if (!valid) {
    res.status(401).json({ success: false, error: "Invalid credentials" });
    return;
  }

  // Block login if email not verified — offer to resend OTP
  if (!user.emailVerified) {
    // Send a fresh OTP so the user can verify
    const otp = generateOtp();
    await storeOtp(user.id, otp);
    await sendOtpEmail(user.email, otp);

    res.status(403).json({
      success: false,
      error: "Please verify your email before logging in. A new code has been sent.",
      data: { requiresVerification: true, userId: user.id, email: user.email },
    });
    return;
  }

  // If TOTP is enabled, issue a short-lived temp token and require second factor
  if (user.totpEnabled) {
    const jwtSecret = process.env["JWT_ACCESS_SECRET"] ?? "change-me";
    const tempToken = jwt.sign(
      { userId: user.id, role: user.role, purpose: "totp" },
      jwtSecret,
      { expiresIn: "5m" }
    );
    res.json({ success: true, data: { requiresTotp: true, tempToken } });
    return;
  }

  setAuthCookies(res, user.id, user.role);
  await logActivity("LOGIN", { userId: user.id, meta: { email: user.email } });

  res.json({
    success: true,
    data: {
      user: { id: user.id, email: user.email, role: user.role },
    },
  });
});

// ---- POST /auth/login/totp ----
// Complete login when TOTP is enabled
authRouter.post("/login/totp", async (req, res) => {
  const { tempToken, code } = req.body as { tempToken?: string; code?: string };

  if (!tempToken || !code) {
    res.status(400).json({ success: false, error: "tempToken and code are required" });
    return;
  }

  try {
    const jwtSecret = process.env["JWT_ACCESS_SECRET"] ?? "change-me";
    const payload = jwt.verify(tempToken, jwtSecret) as { userId: string; role: string; purpose: string };

    if (payload.purpose !== "totp") {
      res.status(401).json({ success: false, error: "Invalid token" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, role: true, totpSecret: true, totpEnabled: true },
    });

    if (!user || !user.totpEnabled || !user.totpSecret) {
      res.status(401).json({ success: false, error: "Invalid session" });
      return;
    }

    const valid = authenticator.verify({ token: code, secret: user.totpSecret });
    if (!valid) {
      res.status(401).json({ success: false, error: "Invalid or expired 2FA code" });
      return;
    }

    setAuthCookies(res, user.id, user.role as "SUPER_ADMIN" | "ADMIN" | "USER");
    await logActivity("LOGIN", { userId: user.id, meta: { email: user.email, method: "totp" } });

    res.json({
      success: true,
      data: { user: { id: user.id, email: user.email, role: user.role } },
    });
  } catch {
    res.status(401).json({ success: false, error: "Invalid or expired token" });
  }
});


// ---- POST /auth/verify-email ----
// Validate the 6-digit OTP sent during signup to mark the user's email as verified.

authRouter.post("/verify-email", async (req, res) => {
  const { userId, code } = req.body as { userId?: string; code?: string };

  if (!userId || !code) {
    res.status(400).json({ success: false, error: "userId and code are required" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, emailVerified: true },
  });

  if (!user) {
    res.status(404).json({ success: false, error: "User not found" });
    return;
  }

  if (user.emailVerified) {
    res.json({ success: true, data: { alreadyVerified: true } });
    return;
  }

  const valid = await verifyOtp(userId, code);
  if (!valid) {
    res.status(401).json({ success: false, error: "Invalid or expired code. Please request a new one." });
    return;
  }

  // Mark email as verified
  await prisma.user.update({
    where: { id: userId },
    data: { emailVerified: true },
  });

  // Auto-login after verification
  setAuthCookies(res, user.id, user.role as "SUPER_ADMIN" | "ADMIN" | "USER");
  await logActivity("EMAIL_VERIFIED", { userId: user.id, meta: { email: user.email } });

  res.json({
    success: true,
    data: {
      user: { id: user.id, email: user.email, role: user.role },
    },
  });
});

// ---- POST /auth/resend-otp ----
// Regenerate and resend the email verification OTP.

authRouter.post("/resend-otp", async (req, res) => {
  const { userId } = req.body as { userId?: string };

  if (!userId) {
    res.status(400).json({ success: false, error: "userId is required" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, emailVerified: true },
  });

  if (!user) {
    res.status(404).json({ success: false, error: "User not found" });
    return;
  }

  if (user.emailVerified) {
    res.json({ success: true, data: { alreadyVerified: true } });
    return;
  }

  // Invalidate any existing OTP and generate a new one
  await invalidateOtp(userId);
  const otp = generateOtp();
  await storeOtp(userId, otp);
  await sendOtpEmail(user.email, otp);

  res.json({ success: true, data: { message: "A new verification code has been sent to your email." } });
});

// ---- POST /auth/logout ----

authRouter.post("/logout", (req, res) => {
  clearAuthCookies(res);
  res.json({ success: true });
});

// ---- POST /auth/refresh ----

authRouter.post("/refresh", (req, res) => {
  const token = req.cookies?.cb_refresh as string | undefined;
  if (!token) {
    res.status(401).json({ success: false, error: "No refresh token" });
    return;
  }

  try {
    const payload = verifyRefreshToken(token);
    const newAccessToken = signAccessToken({ userId: payload.userId, role: payload.role });

    const isProd = process.env["NODE_ENV"] === "production";
    res.cookie("cb_access", newAccessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      maxAge: 15 * 60 * 1000,
    });

    res.json({ success: true });
  } catch {
    res.status(401).json({ success: false, error: "Invalid or expired refresh token" });
  }
});

// ---- GET /auth/me ----

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.authPayload!.userId },
    select: {
      id: true,
      email: true,
      role: true,
      quotaBytes: true,
      usedBytes: true,
      createdAt: true,
      ownedGroups: { select: { id: true } },
      group: {
        select: { id: true, name: true, inviteCode: true, ownerId: true },
      },
    },
  });

  if (!user) {
    res.status(404).json({ success: false, error: "User not found" });
    return;
  }

  // Auto-heal: If user is the owner of a workspace but role is USER, promote to ADMIN
  let effectiveRole = user.role;
  const isOwner = user.group?.ownerId === user.id || user.ownedGroups.length > 0;
  if (isOwner && effectiveRole === "USER") {
    await prisma.user.update({
      where: { id: user.id },
      data: { role: "ADMIN" },
    });
    effectiveRole = "ADMIN";
  }

  // Only expose inviteCode to the workspace owner / admins
  const workspace = user.group
    ? {
        id: user.group.id,
        name: user.group.name,
        inviteCode: (effectiveRole === "ADMIN" || effectiveRole === "SUPER_ADMIN") && isOwner
          ? user.group.inviteCode
          : undefined,
      }
    : null;

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        role: effectiveRole,
        quotaBytes: user.quotaBytes.toString(),
        usedBytes: user.usedBytes.toString(),
        createdAt: user.createdAt.toISOString(),
      },
      workspace,
    },
  });
});

function getFrontendUrl(): string {
  const origin = process.env["CORS_ORIGIN"] ?? "http://localhost:3000";
  if (origin.startsWith("http://") || origin.startsWith("https://")) {
    return origin;
  }
  return `https://${origin}`;
}

// ---- GET /auth/google ----

authRouter.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  })
);

// ---- GET /auth/google/callback ----

authRouter.get(
  "/google/callback",
  (req, res, next) => {
    passport.authenticate("google", {
      session: false,
      failureRedirect: `${getFrontendUrl()}/login?error=google_failed`,
    })(req, res, next);
  },
  async (req, res) => {
    const raw = req.user as (GooglePendingUser | { id: string; role: "SUPER_ADMIN" | "ADMIN" | "USER" }) | undefined;
    if (!raw) {
      res.redirect(`${getFrontendUrl()}/login?error=google_failed`);
      return;
    }

    // New Google user — redirect to workspace-setup page
    if ((raw as GooglePendingUser).googlePending === true) {
      const pending = raw as GooglePendingUser;
      const token = crypto.randomUUID();
      await storeGooglePending(token, { googleId: pending.googleId, email: pending.email, displayName: pending.displayName });
      res.redirect(`${getFrontendUrl()}/signup/google-setup?token=${token}`);
      return;
    }

    // Existing user — log in directly
    const user = raw as { id: string; role: "SUPER_ADMIN" | "ADMIN" | "USER" };
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { ownedGroups: true, group: true },
    });
    let effectiveRole = dbUser?.role ?? user.role;
    const isOwner = dbUser?.group?.ownerId === user.id || (dbUser?.ownedGroups && dbUser.ownedGroups.length > 0);
    if (isOwner && effectiveRole === "USER") {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: "ADMIN" },
      });
      effectiveRole = "ADMIN";
    }

    setAuthCookies(res, user.id, effectiveRole);
    res.redirect(`${getFrontendUrl()}/dashboard`);
  }
);

// ---- POST /auth/google/complete ----
// Called by the google-setup page after the user picks a workspace type.

authRouter.post("/google/complete", async (req, res) => {
  const { token, mode, workspaceName, inviteCode } = req.body as {
    token?: string;
    mode?: "create" | "join";
    workspaceName?: string;
    inviteCode?: string;
  };

  if (!token || !mode) {
    res.status(400).json({ success: false, error: "token and mode are required" });
    return;
  }
  if (mode === "create" && !workspaceName) {
    res.status(400).json({ success: false, error: "workspaceName is required when creating a workspace" });
    return;
  }
  if (mode === "join" && !inviteCode) {
    res.status(400).json({ success: false, error: "inviteCode is required when joining a workspace" });
    return;
  }

  // Look up pending Google profile from Redis (one-time use)
  const pending = await getGooglePending(token);
  if (!pending) {
    res.status(400).json({ success: false, error: "Your setup link has expired. Please sign in with Google again.", errorCode: "TOKEN_EXPIRED" });
    return;
  }

  // Guard: account might have been created between steps (race)
  const existing = await prisma.user.findFirst({
    where: { OR: [{ googleId: pending.googleId }, { email: pending.email }] },
  });
  if (existing) {
    // Just log them in
    setAuthCookies(res, existing.id, existing.role);
    res.json({ success: true, data: { user: { id: existing.id, email: existing.email, role: existing.role } } });
    return;
  }

  // ── Mode A: Create workspace → ADMIN ──────────────────────────────────────
  if (mode === "create" && workspaceName) {
    const nameConflict = await prisma.group.findUnique({ where: { name: workspaceName } });
    if (nameConflict) {
      res.status(409).json({ success: false, error: "A workspace with that name already exists." });
      return;
    }

    const user = await prisma.user.create({
      data: {
        email: pending.email,
        googleId: pending.googleId,
        role: "ADMIN",
        emailVerified: true, // Google already verified the email
        ownedGroups: { create: { name: workspaceName } },
      },
      include: { ownedGroups: { select: { id: true, name: true, inviteCode: true } } },
    });

    const group = user.ownedGroups[0]!;
    await prisma.user.update({ where: { id: user.id }, data: { groupId: group.id } });
    await logActivity("SIGNUP", { userId: user.id, meta: { email: user.email, type: "google_create_workspace", workspace: workspaceName } });

    setAuthCookies(res, user.id, user.role);
    res.json({ success: true, data: { user: { id: user.id, email: user.email, role: user.role } } });
    return;
  }

  // ── Mode B: Join workspace → USER ─────────────────────────────────────────
  if (mode === "join" && inviteCode) {
    const group = await prisma.group.findUnique({ where: { inviteCode } });
    if (!group) {
      res.status(404).json({ success: false, error: "Invalid invite code. Please check with your workspace admin." });
      return;
    }

    const user = await prisma.user.create({
      data: {
        email: pending.email,
        googleId: pending.googleId,
        role: "USER",
        emailVerified: true, // Google already verified the email
        groupId: group.id,
      },
    });

    await logActivity("SIGNUP", { userId: user.id, meta: { email: user.email, type: "google_join_workspace", workspace: group.name } });

    setAuthCookies(res, user.id, user.role);
    res.json({ success: true, data: { user: { id: user.id, email: user.email, role: user.role } } });
    return;
  }

  res.status(400).json({ success: false, error: "Invalid request" });
});
