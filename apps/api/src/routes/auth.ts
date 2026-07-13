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
import type { IRouter } from "express";


export const authRouter: IRouter = Router();

// ---- Validation Schemas ----

const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password too long"),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

// ---- POST /auth/signup ----

authRouter.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: parsed.error.issues[0]?.message ?? "Validation failed",
    });
    return;
  }

  const { email, password } = parsed.data;

  // Check if email already in use
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ success: false, error: "Email already registered" });
    return;
  }

  const passwordHash = await argon2.hash(password);

  const user = await prisma.user.create({
    data: { email, passwordHash, role: "USER" },
    select: { id: true, email: true, role: true, createdAt: true },
  });

  setAuthCookies(res, user.id, user.role);
  await logActivity("SIGNUP", { userId: user.id, meta: { email: user.email } });

  res.status(201).json({
    success: true,
    data: { user },
  });
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
    },
  });

  if (!user) {
    res.status(404).json({ success: false, error: "User not found" });
    return;
  }

  res.json({ success: true, data: { user } });
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
