#!/usr/bin/env node
/**
 * package-agent.js
 * -----------------
 * Builds the CloudBox agent standalone bundle and packages it into a
 * distributable tar.gz archive.
 *
 * Usage (from repo root):
 *   node scripts/package-agent.js
 *
 * Output:
 *   dist/cloudbox-agent.tar.gz
 *   Contains:
 *     cloudbox-agent.mjs   – single-file Node.js bundle (no npm install needed)
 *     install.sh           – interactive Ubuntu/Debian installer
 *     README.txt           – quick-start instructions
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const AGENT_DIR = path.join(ROOT, "apps", "agent");
const PKG_DIR = path.join(ROOT, "dist", "cloudbox-agent-pkg");
const OUT_ARCHIVE = path.join(ROOT, "dist", "cloudbox-agent.tar.gz");

function run(cmd, cwd = ROOT) {
  console.log(`\n▶ ${cmd}`);
  execSync(cmd, { cwd, stdio: "inherit" });
}

// ── 1. Install deps (in case esbuild isn't present yet) ─────────────────────
console.log("\n📦 Installing agent dependencies...");
run("pnpm install --frozen-lockfile", AGENT_DIR);

// ── 2. Build shared-types (dependency of agent) ──────────────────────────────
console.log("\n🔨 Building @cloudbox/shared-types...");
run("pnpm --filter @cloudbox/shared-types build");

// ── 3. Bundle the agent into a single JS file with esbuild ──────────────────
console.log("\n🔨 Bundling agent with esbuild...");
run("pnpm run build:standalone", AGENT_DIR);

const BUNDLE = path.join(AGENT_DIR, "dist", "standalone", "cloudbox-agent.mjs");
if (!fs.existsSync(BUNDLE)) {
  console.error("❌ Bundle not found at", BUNDLE);
  process.exit(1);
}

// ── 4. Assemble package directory ────────────────────────────────────────────
console.log("\n📁 Assembling package...");
fs.rmSync(PKG_DIR, { recursive: true, force: true });
fs.mkdirSync(PKG_DIR, { recursive: true });

// Copy bundle
fs.copyFileSync(BUNDLE, path.join(PKG_DIR, "cloudbox-agent.mjs"));

// Copy install.sh and ensure it is executable (unix mode)
const INSTALL_SH = path.join(AGENT_DIR, "standalone", "install.sh");
const destInstall = path.join(PKG_DIR, "install.sh");
fs.copyFileSync(INSTALL_SH, destInstall);
fs.chmodSync(destInstall, 0o755);

// Write README
const version = JSON.parse(fs.readFileSync(path.join(AGENT_DIR, "package.json"), "utf8")).version;
fs.writeFileSync(
  path.join(PKG_DIR, "README.txt"),
  `CloudBox Agent v${version} — Standalone Package
===============================================

Quick Install (Ubuntu / Debian):
  sudo bash install.sh

Or with custom server URLs:
  sudo bash install.sh --api-url https://your-server.com/api --gateway-url wss://your-server.com/ws

After installation, register this node from your CloudBox dashboard:
  Dashboard → Overview → Add Node → copy the 6-character claim code
  sudo -u cloudbox API_URL=<url> node /opt/cloudbox-agent/cloudbox-agent.mjs register <CODE>

Start / stop:
  sudo systemctl start  cloudbox-agent
  sudo systemctl stop   cloudbox-agent
  sudo systemctl status cloudbox-agent

View logs:
  sudo journalctl -u cloudbox-agent -f

Files:
  /opt/cloudbox-agent/cloudbox-agent.mjs  – Agent runtime
  /opt/cloudbox-agent/.env                 – Configuration (API_URL, GATEWAY_URL)
  ~/.cloudbox/storage/                     – Stored files (owned by 'cloudbox' user)
`
);

// ── 5. Create tar.gz ─────────────────────────────────────────────────────────
console.log("\n🗜️  Creating archive...");
fs.mkdirSync(path.join(ROOT, "dist"), { recursive: true });

// Use node's built-in tar via child_process (requires tar on PATH — available on Linux/macOS/WSL)
// On Windows without WSL, you can use 7-Zip or a JS tar library.
try {
  run(
    `tar -czf "${OUT_ARCHIVE}" -C "${path.dirname(PKG_DIR)}" "${path.basename(PKG_DIR)}"`,
    ROOT
  );
  console.log(`\n✅ Package created: ${OUT_ARCHIVE}`);
} catch {
  // Fallback message for Windows without tar
  console.warn("\n⚠️  tar not available. Package directory created at:", PKG_DIR);
  console.warn("    Manually compress it or run this script on Linux/macOS/WSL.");
}

// ── 6. Print summary ─────────────────────────────────────────────────────────
console.log("\n📋 Package contents:");
for (const f of fs.readdirSync(PKG_DIR)) {
  const stat = fs.statSync(path.join(PKG_DIR, f));
  console.log(`   ${f.padEnd(40)} ${(stat.size / 1024).toFixed(1)} KB`);
}
console.log("\nDone! To install on an Ubuntu server:");
console.log("  scp dist/cloudbox-agent.tar.gz user@server:~");
console.log("  ssh user@server");
console.log("  tar -xzf cloudbox-agent.tar.gz");
console.log("  sudo bash cloudbox-agent-pkg/install.sh");
