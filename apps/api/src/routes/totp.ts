import { Router } from "express";
// @ts-expect-error - otplib typings don't play well with NodeNext
import { authenticator } from "otplib";
import qrcode from "qrcode";
import argon2 from "argon2";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import type { IRouter } from "express";

export const totpRouter: IRouter = Router();

const APP_NAME = "CloudBox";

// ---- POST /auth/totp/setup ----
// Generate a new TOTP secret and return the QR code + otpauth URI
// Does NOT enable TOTP yet — user must verify first
totpRouter.post("/setup", requireAuth, async (req, res) => {
  const userId = req.authPayload!.userId;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, totpEnabled: true },
    });

    if (!user) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }

    if (user.totpEnabled) {
      res.status(400).json({ success: false, error: "2FA is already enabled. Disable it first." });
      return;
    }

    const secret = authenticator.generateSecret(20);
    const otpauthUrl = authenticator.keyuri(user.email, APP_NAME, secret);

    // Store the secret temporarily (overwrite any previous pending setup)
    await prisma.user.update({
      where: { id: userId },
      data: { totpSecret: secret },
    });

    // Generate QR code as data URL
    const qrDataUrl = await qrcode.toDataURL(otpauthUrl);

    res.json({
      success: true,
      data: {
        otpauthUrl,
        qrDataUrl,
        secret, // shown once so user can manually enter it
      },
    });
  } catch (err) {
    console.error("[TOTP] Setup error:", err);
    res.status(500).json({ success: false, error: "Failed to generate 2FA setup" });
  }
});

// ---- POST /auth/totp/verify ----
// Confirm the TOTP code from the authenticator app and enable 2FA
totpRouter.post("/verify", requireAuth, async (req, res) => {
  const userId = req.authPayload!.userId;
  const { code } = req.body as { code?: string };

  if (!code) {
    res.status(400).json({ success: false, error: "code is required" });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { totpSecret: true, totpEnabled: true },
    });

    if (!user?.totpSecret) {
      res.status(400).json({ success: false, error: "No pending 2FA setup found. Call /setup first." });
      return;
    }

    const valid = authenticator.verify({ token: code, secret: user.totpSecret });
    if (!valid) {
      res.status(400).json({ success: false, error: "Invalid or expired code" });
      return;
    }

    await prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: true },
    });

    res.json({ success: true, data: { message: "Two-factor authentication enabled." } });
  } catch (err) {
    console.error("[TOTP] Verify error:", err);
    res.status(500).json({ success: false, error: "Failed to verify 2FA code" });
  }
});

// ---- POST /auth/totp/disable ----
// Disable TOTP — requires current password for confirmation
totpRouter.post("/disable", requireAuth, async (req, res) => {
  const userId = req.authPayload!.userId;
  const { password } = req.body as { password?: string };

  if (!password) {
    res.status(400).json({ success: false, error: "password is required to disable 2FA" });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true, totpEnabled: true },
    });

    if (!user) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }

    if (!user.totpEnabled) {
      res.status(400).json({ success: false, error: "2FA is not enabled" });
      return;
    }

    // Verify password before disabling
    if (!user.passwordHash || !(await argon2.verify(user.passwordHash, password))) {
      res.status(401).json({ success: false, error: "Incorrect password" });
      return;
    }

    await prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: false, totpSecret: null },
    });

    res.json({ success: true, data: { message: "Two-factor authentication disabled." } });
  } catch (err) {
    console.error("[TOTP] Disable error:", err);
    res.status(500).json({ success: false, error: "Failed to disable 2FA" });
  }
});
