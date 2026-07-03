import { Command } from "commander";
import { generateKeyPairSync, randomUUID, createSign } from "crypto";
import fs from "fs";
import path from "path";
import os from "os";
import { WebSocket } from "ws";
import type { GatewayMessage } from "@cloudbox/shared-types";
import { watchStorage, scanDirectory } from "./watcher.js";

const DOWNLOAD_CHUNK_SIZE = 64 * 1024; // 64 KB

const API_URL = process.env.API_URL || "http://localhost:4000";
const GATEWAY_URL = process.env.GATEWAY_URL || "ws://localhost:4001";
const CONFIG_DIR = path.join(os.homedir(), ".cloudbox");
const CONFIG_FILE = path.join(CONFIG_DIR, "agent.json");

interface AgentConfig {
  cloudId: string;
  privateKey: string;
  publicKey: string;
  agentId: string;
}

function loadConfig(): AgentConfig {
  if (!fs.existsSync(CONFIG_FILE)) {
    console.error("[Error] Agent is not registered. Run: cloudbox-agent register <code>");
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8")) as AgentConfig;
}

function send(ws: WebSocket, msg: GatewayMessage) {
  ws.send(JSON.stringify(msg));
}

const program = new Command();

program
  .name("cloudbox-agent")
  .description("CloudBox Agent CLI")
  .version("1.0.0");

// ---- REGISTER command ----
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
        body: JSON.stringify({ claimCode: code, cloudId, publicKey }),
      });

      const data = await res.json() as any;
      if (!res.ok || !data.success) throw new Error(data.error || "Registration failed");

      console.log("[CloudBox] API Registration successful!");

      if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });

      const config: AgentConfig = { cloudId, privateKey, publicKey, agentId: data.data.agentId };
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });

      console.log(`[CloudBox] Configuration saved securely to ${CONFIG_FILE}`);
      console.log("[CloudBox] Done! Run: cloudbox-agent start");
    } catch (err: any) {
      console.error(`[Error] ${err.message}`);
      process.exit(1);
    }
  });

// ---- START command ----
program
  .command("start")
  .description("Start the agent and connect to the CloudBox gateway")
  .action(() => {
    const config = loadConfig();
    let reconnectDelay = 1000;
    const MAX_DELAY = 30_000;
    let activeWatcher: ReturnType<typeof watchStorage> | null = null;
    // Track active upload write streams: requestId → WriteStream
    const activeUploads = new Map<string, fs.WriteStream>();

    function connect() {
      console.log(`[Agent] Connecting to Gateway: ${GATEWAY_URL}`);
      const ws = new WebSocket(GATEWAY_URL);

      ws.on("open", () => {
        console.log("[Agent] Connected to Gateway. Waiting for auth challenge...");
        reconnectDelay = 1000; // reset backoff on successful connect
      });

      ws.on("message", (raw) => {
        try {
          const msg: GatewayMessage = JSON.parse(raw.toString());

          switch (msg.type) {
            case "AUTH_CHALLENGE": {
              console.log("[Agent] Received auth challenge — signing...");
              const signer = createSign("SHA256");
              signer.update(msg.challenge);
              const signature = signer.sign(config.privateKey, "base64");
              send(ws, { type: "AUTH_RESPONSE", cloudId: config.cloudId, signature });
              break;
            }

            case "AUTH_OK":
              console.log("[Agent] ✅ Authenticated! Agent is now ONLINE.");
              
              if (activeWatcher) {
                activeWatcher.close();
              }

              const storageDir = path.join(CONFIG_DIR, "storage");
              activeWatcher = watchStorage(storageDir, (files) => {
                send(ws, {
                  type: "METADATA_SYNC",
                  files,
                });
              });
              break;

            case "AUTH_ERROR":
              console.error(`[Agent] Auth failed: ${msg.message}`);
              ws.close();
              break;

            case "HEARTBEAT":
              send(ws, { type: "HEARTBEAT_ACK", timestamp: Date.now() });
              break;

            case "DOWNLOAD_FILE": {
              const dlPath = path.join(CONFIG_DIR, "storage", msg.path);
              console.log(`[Agent] DOWNLOAD_FILE: ${dlPath}`);
              if (!fs.existsSync(dlPath)) {
                send(ws, { type: "ERROR", requestId: msg.requestId, message: "File not found on agent" });
                break;
              }
              // Stream in chunks
              (async () => {
                const stream = fs.createReadStream(dlPath, { highWaterMark: DOWNLOAD_CHUNK_SIZE });
                for await (const chunk of stream) {
                  send(ws, {
                    type: "FILE_CHUNK",
                    requestId: msg.requestId,
                    chunk: (chunk as Buffer).toString("base64"),
                    final: false,
                  });
                }
                send(ws, { type: "FILE_CHUNK", requestId: msg.requestId, chunk: "", final: true });
                console.log(`[Agent] DOWNLOAD_FILE complete: ${dlPath}`);
              })().catch((err) => {
                console.error("[Agent] DOWNLOAD_FILE error:", err);
                send(ws, { type: "ERROR", requestId: msg.requestId, message: String(err) });
              });
              break;
            }

            case "UPLOAD_FILE": {
              const ulPath = path.join(CONFIG_DIR, "storage", msg.path);
              console.log(`[Agent] UPLOAD_FILE: ${ulPath}`);
              const ulDir = path.dirname(ulPath);
              if (!fs.existsSync(ulDir)) fs.mkdirSync(ulDir, { recursive: true });
              const writeStream = fs.createWriteStream(ulPath);
              activeUploads.set(msg.requestId, writeStream);
              break;
            }

            case "FILE_CHUNK": {
              const stream = activeUploads.get(msg.requestId);
              if (!stream) {
                console.warn(`[Agent] FILE_CHUNK for unknown requestId: ${msg.requestId}`);
                break;
              }
              if (msg.chunk) {
                stream.write(Buffer.from(msg.chunk, "base64"));
              }
              if (msg.final) {
                stream.end(() => {
                  activeUploads.delete(msg.requestId);
                  send(ws, { type: "UPLOAD_ACK", requestId: msg.requestId, success: true });
                  console.log(`[Agent] UPLOAD complete for requestId: ${msg.requestId}`);

                  // Trigger manual metadata sync to ensure the DB has the fully written file info
                  try {
                    const storageDir = path.join(CONFIG_DIR, "storage");
                    const files = scanDirectory(storageDir);
                    send(ws, {
                      type: "METADATA_SYNC",
                      files,
                    });
                    console.log(`[Agent] Triggered manual sync for ${files.length} items after upload`);
                  } catch (syncErr) {
                    console.error("[Agent] Error during manual sync after upload:", syncErr);
                  }
                });
              }
              break;
            }

            default:
              console.log(`[Agent] Received message: ${msg.type}`);
          }
        } catch (err) {
          console.error("[Agent] Failed to parse message:", err);
        }
      });

      ws.on("close", () => {
        console.log(`[Agent] Disconnected. Reconnecting in ${reconnectDelay / 1000}s...`);
        if (activeWatcher) {
          activeWatcher.close();
          activeWatcher = null;
        }
        setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, MAX_DELAY); // exponential backoff
      });

      ws.on("error", (err) => {
        console.error("[Agent] WebSocket error:", err.message);
      });
    }

    connect();

    // Keep process alive
    process.on("SIGINT", () => {
      console.log("\n[Agent] Shutting down...");
      if (activeWatcher) {
        activeWatcher.close();
      }
      process.exit(0);
    });
  });

program.parse(process.argv);
