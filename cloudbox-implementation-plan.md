# CloudBox — Full Project Specification & Implementation Plan

---

# PART 1: PROJECT OVERVIEW

## 1.1 What This Product Is

CloudBox lets anyone turn an old laptop into a personal cloud storage server. The customer installs a lightweight **Agent** on an Ubuntu machine (e.g. an old laptop sitting at home). All file storage, sharing, and browsing happens through **one central website** (`cloudbox.com`) — the customer never manages their own server UI, domain, or SSL certificate.

Think: **Dropbox's UI/UX, but the actual disk is a random old laptop in someone's house instead of Dropbox's data centers.**

## 1.2 The Core Problem This Solves

A home laptop sits behind a router doing NAT — it has no public IP and cannot be reached directly from the internet. Most self-hosted cloud storage projects (Nextcloud, ownCloud, etc.) push this problem onto the user ("forward port 443 on your router," "get a domain," "set up SSL yourself"). Non-technical users can't or won't do this.

CloudBox solves it the way Dropbox, Plex, Tailscale, and ngrok all solve equivalent problems: **the laptop connects outward to the central server and keeps that connection open.** The central server never has to "reach" the laptop — the laptop reaches it first, and the resulting open channel is used in both directions afterward.

## 1.3 High-Level Architecture

```
                     ┌────────────────────┐
                     │   User's Browser    │
                     └──────────┬───────────┘
                                │  HTTPS
                                ▼
                     ┌────────────────────┐
                     │   Web (Next.js)     │  ← only UI, hosted centrally
                     └──────────┬───────────┘
                                │
                                ▼
                     ┌────────────────────┐
                     │   API (Express)     │  ← auth, metadata, quotas, orchestration
                     └──────────┬───────────┘
                                │  Redis pub/sub
                                ▼
                     ┌────────────────────┐
                     │   Gateway (ws)      │  ← holds persistent WebSocket connections
                     └──────────┬───────────┘
                                │  outbound connection initiated BY the agent
                                ▼
                     ┌────────────────────┐
                     │  Agent (Ubuntu box) │  ← customer's old laptop, actual file storage
                     └────────────────────┘
```

**Critical rule:** file bytes are never persisted on the central server. They pass through the API/Gateway as a stream (proxy-through) and land only on the customer's disk. The central Postgres database stores only **metadata** (filenames, folder structure, sizes, timestamps) — never file contents.

## 1.4 User Roles

- **Super Admin** — the person who installs the Agent (owns the physical machine/storage).
- **Admin** — can be delegated by Super Admin; manages users, groups, approvals.
- **User** — regular account, sees only their allocated storage.

## 1.5 Storage Model

```
Ubuntu Machine's Disk (e.g. 1TB)
│
├── Storage Pool
│     ├── Admin (Unlimited)
│     ├── Group: Family
│     │     ├── Alice — 100 GB quota
│     │     ├── Bob — 50 GB quota
│     │     └── Charlie — 150 GB quota
│     ├── Group: Friends
│     │     ├── David — 25 GB quota
│     │     └── Emma — 40 GB quota
│     └── Shared Folder
```

Backend enforces quota + isolation — a user can never read/write outside their allocated space.

## 1.6 Authentication Flow (final, centralized version)

```
User visits cloudbox.com
        ↓
Login (email + password)
        ↓
JWT issued by central API
        ↓
Dashboard loads — API checks which Agent(s) this user is linked to
        ↓
File metadata comes from Postgres (fast, always available)
        ↓
Actual file read/write goes through Gateway → Agent (only when live data is needed)
```

Note: this superseded an earlier "Cloud ID redirect to your own server" idea — that approach was rejected because home laptops behind NAT can't be reached directly. See Part 1.2.

---

# PART 2: FULL TECH STACK

## 2.1 Frontend — `apps/web`

| Tool | What it does |
|---|---|
| **Next.js** | React framework — routing, server-side rendering, the actual website |
| **React** | UI component library |
| **TypeScript** | Adds static types on top of JavaScript — catches bugs at compile time, enables shared type contracts between web/api/gateway/agent |
| **Tailwind CSS** | Utility-first CSS framework for styling without writing custom CSS files |
| **Zustand** | Lightweight global state management (e.g. current logged-in user, active device status) |
| **React Query** | Manages server-state fetching/caching (file lists, quota usage, agent status) with automatic refetching |
| **React Hook Form** | Handles form state/validation (login, signup, admin forms) |
| **Zod** | Schema validation — validates form inputs and API responses against defined shapes |

## 2.2 Backend API — `apps/api`

| Tool | What it does |
|---|---|
| **Node.js** | JavaScript runtime the backend runs on |
| **Express.js** | Web framework for building REST API routes |
| **TypeScript** | Same as above — type safety on the backend |
| **Prisma** | ORM — type-safe database access + migration management for PostgreSQL |
| **PostgreSQL** | Main relational database — users, agents, file metadata, quotas |
| **Redis** | Used for 3 things: (1) BullMQ's backing store, (2) pub/sub bridge so the API can send commands to the Gateway process, (3) general caching (e.g. agent online/offline status) |
| **BullMQ** | Background job queue (built on Redis) — heartbeat checks, thumbnail generation, cleanup jobs |
| **jsonwebtoken (JWT)** | Issues and verifies authentication tokens |
| **bcrypt / argon2** | Hashes user passwords before storing them |
| **busboy / multer** | Parses incoming file upload streams from the browser |

## 2.3 Gateway — `apps/gateway`

| Tool | What it does |
|---|---|
| **Node.js + TypeScript** | Same runtime/language as the API |
| **ws** | WebSocket server library — holds persistent connections from every connected Agent |
| **Redis (pub/sub)** | Lets the API (a separate process) send a message that reaches the correct Agent connection, even if there are multiple Gateway instances running |

This runs as its **own process** (separate container) from the API, because it holds long-lived stateful connections instead of stateless request/response — different scaling behavior, so it's kept separate from day one even though it lives in the same codebase.

## 2.4 Agent — `apps/agent` (installed on customer's Ubuntu machine)

| Tool | What it does |
|---|---|
| **Node.js** | Runtime for the agent service |
| **ws** (client mode) | Opens and maintains the outbound WebSocket connection to the Gateway |
| **chokidar** | Watches the local storage folder for file changes, triggers metadata sync |
| **systemd** | Runs the agent as a background service on Ubuntu; restarts it automatically on crash or reboot |

## 2.5 Monorepo Tooling

| Tool | What it does |
|---|---|
| **pnpm** | Package manager (alternative to npm/yarn) — faster installs, less disk usage via a shared global package store |
| **pnpm workspaces** | Lets `web`, `api`, `gateway`, `agent`, and `shared-types` live in one repo, share dependencies, and import from each other directly without publishing packages |
| **shared-types package** | A internal package (`packages/shared-types`) holding TypeScript interfaces (User, Agent, FileMeta, WebSocket message shapes) that API, Gateway, and Agent all import — keeps the tunnel protocol consistent everywhere |

## 2.6 DevOps & Infrastructure

| Tool | What it does |
|---|---|
| **Docker** | Packages each app (web, api, gateway) into a portable, isolated container |
| **Docker Compose** | Runs Postgres, Redis, API, Gateway, Web together with a single command, in dev and prod |
| **Nginx** | Reverse proxy — routes incoming traffic to the right container, terminates SSL, handles `wss://` upgrade for the Gateway's WebSocket traffic |
| **Let's Encrypt (Certbot)** | Free, auto-renewing SSL certificate for your domain |
| **GitHub Actions** | CI/CD — runs lint/typecheck/tests on every push, deploys automatically on merge to main |
| **Prometheus** | Collects system metrics over time (connected agents, request latency, active transfers) |
| **Grafana** | Visual dashboards built on top of Prometheus metrics |
| **Loki** | Centralized storage for logs from all containers |
| **Promtail** | Ships container logs into Loki |

## 2.7 Where Everything Runs

| Component | Hosting location |
|---|---|
| Web, API, Gateway, Postgres, Redis, Nginx, Prometheus, Grafana, Loki | Your central VPS/cloud (e.g. Hetzner, DigitalOcean, AWS) |
| GitHub Actions | GitHub's own servers, deploys to your VPS |
| Agent + systemd | Each customer's own Ubuntu machine — no hosting cost to you |

## 2.8 Backend Architecture Style

**Modular Monolith** — one Express codebase, internally split into isolated modules (`auth`, `users`, `agents`, `gateway-bridge`, `files`, `admin`, `sharing`), each with its own routes → controller → service → repository layers. Chosen over microservices because the team size (currently 1 person) doesn't justify the operational overhead of distributed services yet. The Gateway is the one piece already split into its own deployable process, since its connection-holding behavior is fundamentally different from the API's stateless request/response pattern — this is the natural first seam if the project ever needs to scale further later.

---

# PART 3: DATABASE SCHEMA (v1, Prisma)

```prisma
model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  role         Role     @default(USER)
  quotaBytes   BigInt   @default(0)
  usedBytes    BigInt   @default(0)
  groupId      String?
  createdAt    DateTime @default(now())
  agents       Agent[]
}

model Agent {
  id             String   @id @default(uuid())
  cloudId        String   @unique
  userId         String
  publicKey      String
  status         AgentStatus @default(OFFLINE)
  version        String?
  lastHeartbeat  DateTime?
  createdAt      DateTime @default(now())
  user           User     @relation(fields: [userId], references: [id])
  files          File[]
}

model File {
  id        String   @id @default(uuid())
  agentId   String
  path      String
  name      String
  size      BigInt
  mimeType  String?
  isFolder  Boolean  @default(false)
  parentId  String?
  updatedAt DateTime @updatedAt
  agent     Agent    @relation(fields: [agentId], references: [id])
}

enum Role {
  SUPER_ADMIN
  ADMIN
  USER
}

enum AgentStatus {
  ONLINE
  OFFLINE
}
```

Storage pools, groups, quotas-per-group, and share_links are added in later phases (kept out of v1 to avoid over-building before the core tunnel works).

---

# PART 4: GATEWAY MESSAGE PROTOCOL (v1 sketch)

Shared types live in `packages/shared-types`, imported by API, Gateway, and Agent so all three always agree on message shapes.

```ts
type GatewayMessage =
  | { type: "LIST_FILES"; path: string; requestId: string }
  | { type: "FILE_LIST_RESULT"; requestId: string; files: FileMeta[] }
  | { type: "DOWNLOAD_FILE"; path: string; requestId: string }
  | { type: "FILE_CHUNK"; requestId: string; chunk: string; final: boolean }
  | { type: "UPLOAD_FILE"; path: string; requestId: string }
  | { type: "UPLOAD_ACK"; requestId: string; success: boolean };
```

Agents authenticate to the Gateway using a signed challenge (not just sending their cloud_id in plaintext) to prevent spoofing.

---

# PART 5: PHASE-BY-PHASE IMPLEMENTATION PLAN

## Guiding Principles
- Build in vertical slices — each phase ends with something runnable/testable, not just files written.
- The Gateway/tunnel (Phase 4) is the true differentiator of this product — prioritize getting it rock solid before UI polish.
- Feed this plan to an AI coding agent **one phase at a time**, always re-pasting the shared-types/protocol section so it stays consistent.

## Phase 1 — Foundations
1. Init pnpm workspace monorepo, shared TS config.
2. Docker Compose for Postgres + Redis (local dev).
3. Prisma set up in `apps/api` with the v1 schema.
4. Barebones Express app with `/health` route.
5. Barebones Next.js app with a login page shell.
6. GitHub Actions: lint + typecheck on push.

**End state:** `docker-compose up` boots Postgres, Redis, API, Web. `/health` responds.

## Phase 2 — Auth Module
1. `users` table + Prisma model.
2. `/auth/signup`, `/auth/login` issuing JWT (access + refresh).
3. Password hashing (bcrypt/argon2).
4. Auth middleware for protected routes.
5. Frontend login/signup forms (React Hook Form + Zod), JWT in httpOnly cookie.
6. Zustand store for session state.

**End state:** User can sign up, log in, and hit a protected `/me` route from the frontend.

## Phase 3 — Agent Registration + Cloud Registry
1. `agents` table (as in schema).
2. `POST /agents/register` — agent sends cloud_id + public key, linked to a user via a claim code shown in the dashboard.
3. Build the Agent app: generates keypair + cloud_id on first run, prompts for claim code, calls `/agents/register` over HTTPS.
4. Package agent as a `systemd` service.

**End state:** Running the agent installer on a test Ubuntu VM registers it and links it to a real user account.

## Phase 4 — WebSocket Gateway + Tunnel
1. Build `apps/gateway` as its own process using `ws`.
2. Agent connects to `wss://gateway.cloudbox.com`, authenticates via signed challenge.
3. Gateway keeps `cloud_id → active socket` map, backed by Redis pub/sub for multi-instance support.
4. Heartbeat every 30s; mark agent offline in DB on missed heartbeats.
5. Implement the message protocol from Part 4.
6. API publishes to Redis → Gateway routes to the right agent socket → response flows back.

**End state:** From a test script, the API can ask a connected agent to list files and get a real response through the tunnel.

## Phase 5 — File Metadata + Sync
1. `files` table.
2. Agent uses `chokidar` to watch its storage folder, sends metadata diffs to API via the tunnel.
3. `GET /files?folder=...` reads from Postgres (fast, works even if agent briefly offline).

**End state:** Dashboard can show a live-updating file tree without blocking on the agent being online.

## Phase 6 — Upload / Download
1. **Download:** API resolves file → agent → sends `DOWNLOAD_FILE` → agent streams `FILE_CHUNK`s → API pipes straight to HTTP response (no disk buffering).
2. **Upload:** Browser → API (busboy) → Gateway → Agent writes to disk → `UPLOAD_ACK`.
3. Chunk size limits + backpressure handling for large files.
4. Graceful error handling when agent is offline.

**End state:** A real multi-hundred-MB file can be uploaded and downloaded through the full path.

## Phase 7 — Quotas, Groups, Storage Pools
1. `storage_pools`, `groups`, `quotas` tables.
2. Quota enforcement before accepting uploads.
3. Admin endpoints: create group, assign quota, approve pending user.

**End state:** Admin creates a group, adds a user with a quota, uploads over the limit get rejected.

## Phase 8 — Dashboard UI
1. Sidebar: Dashboard, My Files, Shared, Recent, Favorites, Trash, Storage Usage, Settings.
2. Main area: folder grid/list, breadcrumbs, drag-and-drop upload, file preview.
3. Right panel: file details, sharing, version history (stub for now).
4. React Query for file list/status with live cache invalidation.

## Phase 9 — Admin Dashboard
1. Users list + pending approvals.
2. Storage allocation view.
3. Agent health (online/offline, last heartbeat, version).
4. Activity logs (audit table: action, user_id, timestamp, meta).

## Phase 10 — Sharing
1. `share_links` table: file_id, token, permission, expires_at.
2. Public share endpoint through the same gateway tunnel path, gated by token instead of JWT.

## Phase 11 — Hardening & DevOps
1. Dockerize `api`, `gateway`, `web`; installer script for `agent`.
2. Nginx + Let's Encrypt for `cloudbox.com` and `gateway.cloudbox.com` (wss).
3. Prometheus metrics: connected agents, active transfers, latency.
4. Grafana dashboards + Loki/Promtail log aggregation.
5. GitHub Actions: build → test → deploy on merge to main.

## Phase 12 — Post-MVP Polish
- File versioning
- Thumbnails/previews (BullMQ job)
- Trash/restore
- Two-factor auth
- Email notifications (approvals, quota warnings)
- Multiple agents per user (more than one old laptop contributing storage)

---

# PART 6: FASTEST PATH TO A DEMO

If time is limited, prioritize in this order:
1. Phase 1–2 (foundations + auth)
2. Phase 3–4 (agent registration + gateway tunnel) — **the actual differentiator, don't skip or rush this**
3. Phase 6 (upload/download working end-to-end, UI can be ugly)
4. Phase 8 (make it look good)

Quotas, admin dashboard, and sharing are standard SaaS CRUD that can be built any time — the tunnel is what makes this project worth demoing.
