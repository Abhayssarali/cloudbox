import { PrismaClient } from "@prisma/client";

declare global {
  // Allow global `prisma` in development to prevent too many connections
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__prisma ??
  new PrismaClient({
    log:
      process.env["NODE_ENV"] === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env["NODE_ENV"] !== "production") {
  globalThis.__prisma = prisma;
}
