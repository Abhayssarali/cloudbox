import { prisma } from "../lib/prisma.js";

/**
 * Record an activity event to the audit log.
 */
export async function logActivity(
  action: string,
  opts: { userId?: string; meta?: Record<string, unknown> } = {}
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        action,
        userId: opts.userId ?? null,
        meta: opts.meta ? JSON.stringify(opts.meta) : null,
      },
    });
  } catch (err) {
    // Non-fatal — never break main flow if audit logging fails
    console.error("[ActivityLog] Failed to write log entry:", err);
  }
}
