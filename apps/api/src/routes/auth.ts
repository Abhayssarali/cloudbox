import { Router } from "express";
import { z } from "zod";
import argon2 from "argon2";
// @ts-expect-error - otplib typings don't play well with NodeNext
import { authenticator } from "otplib";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { passport } from "../lib/passport.js";
import { setAuthCookies, clearAuthCookies, verifyRefreshToken, signAccessToken } from "../lib/jwt.js";
import { requireAuth } from "../middleware/auth.js";
import { logActivity } from "../lib/activityLog.js";
import { generateOtp, storeOtp, verifyOtp, invalidateOtp } from "../lib/emailOtp.js";
import { sendOtpEmail } from "../lib/mailer.js";
import type { IRouter } from "express";


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

  // Guard: user doesn't exist, or is a Google-only account (no password set)
  if (!user || !user.passwordHash) {
    res.status(401).json({ success: false, error: "Invalid credentials" });
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
      group: {
        select: { id: true, name: true, inviteCode: true, ownerId: true },
      },
    },
  });

  if (!user) {
    res.status(404).json({ success: false, error: "User not found" });
    return;
  }

  // Only expose inviteCode to the workspace owner / admins
  const isOwner = user.group?.ownerId === user.id;
  const workspace = user.group
    ? {
        id: user.group.id,
        name: user.group.name,
        inviteCode: (user.role === "ADMIN" || user.role === "SUPER_ADMIN") && isOwner
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
        role: user.role,
        quotaBytes: user.quotaBytes.toString(),
        usedBytes: user.usedBytes.toString(),
        createdAt: user.createdAt.toISOString(),
      },
      workspace,
    },
  });
});

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
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${process.env["CORS_ORIGIN"] ?? "http://localhost:3000"}/login?error=google_failed`,
  }),
  (req, res) => {
    const user = req.user as { id: string; role: "SUPER_ADMIN" | "ADMIN" | "USER" } | undefined;
    if (!user) {
      res.redirect(
        `${process.env["CORS_ORIGIN"] ?? "http://localhost:3000"}/login?error=google_failed`
      );
      return;
    }

    setAuthCookies(res, user.id, user.role);
    res.redirect(`${process.env["CORS_ORIGIN"] ?? "http://localhost:3000"}/dashboard`);
  }
);
