import { Command } from "commander";
import { generateKeyPairSync, randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import os from "os";

const API_URL = process.env.API_URL || "http://localhost:4000";
const CONFIG_DIR = path.join(os.homedir(), ".cloudbox");
const CONFIG_FILE = path.join(CONFIG_DIR, "agent.json");

const program = new Command();

program
  .name("cloudbox-agent")
  .description("CloudBox Agent CLI")
  .version("1.0.0");

program
  .command("register")
  .description("Register this agent with the CloudBox server")
  .argument("<code>", "The 6-character claim code from the web dashboard")
  .action(async (code) => {
    try {
      console.log(`[CloudBox] Starting registration with code: ${code}`);

      if (fs.existsSync(CONFIG_FILE)) {
        console.error("Agent is already registered (found agent.json).");
        console.error("To register again, delete ~/.cloudbox/agent.json");
        process.exit(1);
      }

      console.log("[CloudBox] Generating 2048-bit RSA keypair...");
      const { publicKey, privateKey } = generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
      });

      const cloudId = randomUUID();

      console.log("[CloudBox] Registering with API...");
      const res = await fetch(`${API_URL}/agents/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimCode: code,
          cloudId,
          publicKey,
        }),
      });

      const data = await res.json() as any;
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Registration failed");
      }

      console.log("[CloudBox] API Registration successful!");

      if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
      }

      const config = {
        cloudId,
        privateKey,
        publicKey,
        agentId: data.data.agentId,
      };

      fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
      console.log(`[CloudBox] Configuration saved securely to ${CONFIG_FILE}`);
      console.log("[CloudBox] Ready! (The start command will be added in Phase 4)");
    } catch (err: any) {
      console.error(`[Error] ${err.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
