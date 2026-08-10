import crypto from "crypto";
import { redis } from "./redis.js";

const OTP_TTL_SECONDS = 10 * 60; // 10 minutes
const OTP_PREFIX = "email_otp:";

/**
 * Generate a cryptographically random 6-digit OTP.
 */
export function generateOtp(): string {
  // Generate a number between 100000 and 999999
  const num = crypto.randomInt(100_000, 1_000_000);
  return num.toString();
}

/**
 * Store an OTP in Redis with a 10-minute TTL.
 * Key pattern: email_otp:<userId>
 */
export async function storeOtp(userId: string, otp: string): Promise<void> {
  const key = `${OTP_PREFIX}${userId}`;
  await redis.set(key, otp, "EX", OTP_TTL_SECONDS);
}

/**
 * Verify and consume an OTP.
 * Returns true if the OTP matches; deletes the key on success (one-time use).
 */
export async function verifyOtp(userId: string, code: string): Promise<boolean> {
  const key = `${OTP_PREFIX}${userId}`;
  const stored = await redis.get(key);

  if (!stored || stored !== code) {
    return false;
  }

  // Delete after successful verification (one-time use)
  await redis.del(key);
  return true;
}

/**
 * Delete any pending OTP for a user (e.g., when resending).
 */
export async function invalidateOtp(userId: string): Promise<void> {
  await redis.del(`${OTP_PREFIX}${userId}`);
}
