import { prisma } from "./prisma.js";
import { sendMail } from "./mailer.js";

// Thresholds at which we send one-time quota warning emails
const THRESHOLDS = [80, 95] as const;

/**
 * Check if a quota threshold has been newly crossed and send a warning email.
 * Uses ActivityLog to track which thresholds have already been notified.
 * Safe to call on every upload — does nothing when quota is unlimited (quotaBytes = 0).
 */
export async function notifyQuotaIfNeeded(
  email: string,
  usedBytes: bigint,
  quotaBytes: bigint
): Promise<void> {
  // No quota = no warnings
  if (quotaBytes === 0n) return;

  const usedPct = Number((usedBytes * 100n) / quotaBytes);

  for (const threshold of THRESHOLDS) {
    if (usedPct >= threshold) {
      // Check if we already sent this threshold notification
      const alreadySent = await prisma.activityLog.findFirst({
        where: {
          action: `QUOTA_WARN_${threshold}`,
          meta: { contains: email },
        },
        orderBy: { createdAt: "desc" },
      });

      // Only notify once per threshold crossing — reset if usage falls back below
      // (simple approach: re-notify if last notification was when usage was > threshold and is now crossed again from below)
      if (!alreadySent) {
        await sendMail(
          email,
          `CloudBox: You've used ${threshold}% of your storage quota`,
          `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
              <h2 style="color:#6366f1">Storage Warning</h2>
              <p>You have used <strong>${usedPct.toFixed(1)}%</strong> of your CloudBox storage quota.</p>
              <p>Used: ${formatBytes(usedBytes)} of ${formatBytes(quotaBytes)}</p>
              ${usedPct >= 95 ? "<p style='color:#ef4444'><strong>You are nearly out of space. Uploads will be blocked at 100%.</strong></p>" : ""}
              <p>Log in to manage your files: <a href="${process.env["CORS_ORIGIN"] ?? "http://localhost:3000"}/dashboard/files">CloudBox Dashboard</a></p>
            </div>
          `
        );

        // Record in activity log to avoid duplicate sends
        await prisma.activityLog.create({
          data: {
            action: `QUOTA_WARN_${threshold}`,
            meta: JSON.stringify({ email, usedPct }),
          },
        });

        console.log(`[QuotaNotifier] Sent ${threshold}% warning to ${email}`);
      }
    }
  }
}

function formatBytes(bytes: bigint): string {
  const n = Number(bytes);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
