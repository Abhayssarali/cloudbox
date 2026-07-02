import jwt from "jsonwebtoken";
import type { AuthTokenPayload } from "@cloudbox/shared-types";

const JWT_SECRET = process.env["JWT_SECRET"] ?? "dev-secret";
const JWT_REFRESH_SECRET = process.env["JWT_REFRESH_SECRET"] ?? "dev-refresh-secret";
const JWT_EXPIRES_IN = process.env["JWT_EXPIRES_IN"] ?? "15m";
const JWT_REFRESH_EXPIRES_IN = process.env["JWT_REFRESH_EXPIRES_IN"] ?? "7d";

export function signAccessToken(payload: Omit<AuthTokenPayload, "type">): string {
  return jwt.sign({ ...payload, type: "access" }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function signRefreshToken(payload: Omit<AuthTokenPayload, "type">): string {
  return jwt.sign({ ...payload, type: "refresh" }, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AuthTokenPayload {
  return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
}

export function verifyRefreshToken(token: string): AuthTokenPayload {
  return jwt.verify(token, JWT_REFRESH_SECRET) as AuthTokenPayload;
}

/** Set both access + refresh tokens as httpOnly cookies on the response */
export function setAuthCookies(
  res: import("express").Response,
  userId: string,
  role: import("@cloudbox/shared-types").Role
): void {
  const accessToken = signAccessToken({ userId, role });
  const refreshToken = signRefreshToken({ userId, role });

  const isProd = process.env["NODE_ENV"] === "production";

  res.cookie("cb_access", accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  res.cookie("cb_refresh", refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/auth/refresh",
  });
}

/** Clear both auth cookies */
export function clearAuthCookies(res: import("express").Response): void {
  const isProd = process.env["NODE_ENV"] === "production";
  const opts = { httpOnly: true, secure: isProd, sameSite: isProd ? ("none" as const) : ("lax" as const) };
  res.clearCookie("cb_access", opts);
  res.clearCookie("cb_refresh", { ...opts, path: "/auth/refresh" });
}
