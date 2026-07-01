import "dotenv/config";
import app from "./app.js";
import { prisma } from "./lib/prisma.js";
import { redis } from "./lib/redis.js";

const PORT = parseInt(process.env["PORT"] ?? "4000", 10);

async function main() {
  // Verify DB connection
  try {
    await prisma.$connect();
    console.log("✅ PostgreSQL connected");
  } catch (err) {
    console.error("❌ PostgreSQL connection failed:", err);
    process.exit(1);
  }

  // Verify Redis connection
  try {
    await redis.ping();
    console.log("✅ Redis connected");
  } catch (err) {
    console.error("❌ Redis connection failed:", err);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`🚀 CloudBox API running on http://localhost:${PORT}`);
    console.log(`   Environment: ${process.env["NODE_ENV"] ?? "development"}`);
  });
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received — shutting down gracefully…");
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received — shutting down gracefully…");
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
});

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
