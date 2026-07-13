# CloudBox — Project Progress Tracker

> This file is updated after every development session / change.
> Last updated: **2026-07-02**

---

## Legend
- ✅ Done
- 🔄 In Progress
- ⏳ Not Started

---

## Phase 1 — Foundations ✅ COMPLETE

### Monorepo Setup
| Item | Status | Notes |
|---|---|---|
| pnpm workspace init | ✅ | `pnpm-workspace.yaml` covers `apps/*` + `packages/*` |
| Root `package.json` | ✅ | Scripts: `dev`, `build`, `lint`, `typecheck`, `format` |
| `tsconfig.base.json` | ✅ | Strict TS, NodeNext module resolution, shared by all apps |
| `.gitignore` | ✅ | Covers `node_modules`, `dist`, `.next`, `.env` |
| `README.md` | ✅ | Dev setup instructions |

### Shared Types (`packages/shared-types`)
| Item | Status | Notes |
|---|---|---|
| Package scaffolded | ✅ | `@cloudbox/shared-types` workspace package |
| `User` type | ✅ | id, email, role, quotaBytes, usedBytes, groupId |
| `Agent` type | ✅ | id, cloudId, userId, publicKey, status, version, lastHeartbeat |
| `FileMeta` type | ✅ | id, agentId, path, name, size, mimeType, isFolder, parentId |
| `GatewayMessage` protocol | ✅ | LIST_FILES, FILE_LIST_RESULT, DOWNLOAD_FILE, FILE_CHUNK, UPLOAD_FILE, UPLOAD_ACK, HEARTBEAT, AUTH_* , ERROR |
| `ApiResponse<T>` type | ✅ | Wrapper for all API responses |
| `HealthResponse` type | ✅ | Used by `/health` route |
| Build compiles clean | ✅ | `tsc` output to `dist/` |

### API (`apps/api`)
| Item | Status | Notes |
|---|---|---|
| `package.json` | ✅ | Express, Prisma, Redis, CORS, Helmet, Morgan, tsx |
| `tsconfig.json` | ✅ | Extends base, NodeNext |
| `src/index.ts` | ✅ | Entry point — connects Postgres + Redis before listening |
| `src/app.ts` | ✅ | Express app — helmet, cors, morgan, routes, 404 + error handler |
| `src/lib/prisma.ts` | ✅ | Prisma singleton (prevents hot-reload connection explosion) |
| `src/lib/redis.ts` | ✅ | ioredis client with lifecycle logging |
| `src/routes/health.ts` | ✅ | `GET /health` — probes Postgres + Redis, returns status |
| Graceful shutdown | ✅ | SIGTERM + SIGINT handlers |
| `prisma/schema.prisma` | ✅ | v1 schema: User, Agent, File + Role/AgentStatus enums |
| Prisma client generated | ✅ | `prisma generate` run |
| `.env` / `.env.example` | ✅ | DATABASE_URL, REDIS_URL, JWT vars |
| `Dockerfile` | ✅ | Multi-stage build (builder → runner) |
| Typecheck passes | ✅ | `tsc --noEmit` clean |

### Web (`apps/web`)
| Item | Status | Notes |
|---|---|---|
| Next.js 16 scaffolded | ✅ | App Router, TypeScript, Tailwind CSS |
| `app/globals.css` | ✅ | CloudBox design tokens, dark theme, custom scrollbar |
| `app/layout.tsx` | ✅ | Inter font, SEO metadata (title template, description, OG) |
| `app/page.tsx` | ✅ | Root `/` → redirects to `/login` |
| `app/(auth)/login/page.tsx` | ✅ | Glassmorphism dark login page — animated orbs, grid bg, brand panel |
| `app/(auth)/login/_components/LoginForm.tsx` | ✅ | Client form: email + password validation, loading state, error display, show/hide password, wired to `POST /auth/login` |
| `typecheck` script added | ✅ | `tsc --noEmit` |
| `@cloudbox/shared-types` dep | ✅ | Added as workspace dependency |

### Infrastructure
| Item | Status | Notes |
|---|---|---|
| `docker-compose.yml` | ✅ | Postgres 16-alpine + Redis 7-alpine with healthchecks; API + Web containers |
| GitHub Actions CI | ✅ | `.github/workflows/ci.yml` — lint + typecheck on push/PR to main |

---

## Phase 2 — Auth Module ✅ COMPLETED

### Planned
| Item | Status | Notes |
|---|---|---|
| Prisma schema update | ✅ | Added `googleId String?`, made `passwordHash String?` (nullable for Google-only accounts). **Requires `pnpm --filter api run prisma:migrate` when Docker is running.** |
| `POST /auth/signup` | ✅ | Create user, hash password (argon2), return JWT access + refresh in httpOnly cookies |
| `POST /auth/login` | ✅ | Verify credentials, issue JWT |
| `POST /auth/refresh` | ✅ | Rotate refresh token, issue new access token |
| `POST /auth/logout` | ✅ | Clear httpOnly cookies |
| `GET /me` | ✅ | Protected route — returns current user from token |
| Auth middleware | ✅ | `requireAuth` Express middleware — verifies JWT, attaches `req.authPayload` |
| Password hashing | ✅ | argon2 (preferred over bcrypt for new projects) |
| **Google OAuth — Backend** | ✅ | `passport` + `passport-google-oauth20` + `express-session` |
| `GET /auth/google` | ✅ | Redirects to Google consent screen |
| `GET /auth/google/callback` | ✅ | Handles Google redirect — creates/finds user, issues JWT, redirects to `/dashboard` |
| **Google OAuth — Frontend** | ✅ | "Continue with Google" button on login + signup pages |
| Zustand session store | ✅ | `useAuthStore` — holds user object, login/logout actions |
| Signup page | ✅ | `/signup` — email+password form + Google button |
| Login page wired to API | ✅ | `LoginForm.tsx` hits real endpoint. |

**New env vars needed:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `SESSION_SECRET`

**New dependencies:** `passport`, `passport-google-oauth20`, `express-session`, `argon2`, `jsonwebtoken`, `cookie-parser`, `zustand`, and their `@types/*`


---

## Phase 3 — Agent Registration + Cloud Registry ✅ COMPLETED

### Planned
| Item | Status | Notes |
|---|---|---|
| `agents` table | ✅ | Already exists in schema. |
| `POST /agents/claim` | ✅ | Generates short-lived 6-char hex claim code stored in Redis. |
| `POST /agents/register` | ✅ | Verifies code, generates DB record for the new Agent linked to the user. |
| Dashboard UI | ✅ | "Add New Node" button generating and displaying the claim code modal. |
| Agent App scaffolding | ✅ | Created `apps/agent` in monorepo with `commander` CLI. |
| Agent `register` flow | ✅ | Prompts for claim code, generates RSA-2048 keys & UUID, calls API, saves to `~/.cloudbox/agent.json`. |
| Packaging / systemd | ✅ | Added `cloudbox-agent.service` template file. |

---

## Phase 4 — WebSocket Gateway + Tunnel ✅ COMPLETED

### Planned
| Item | Status | Notes |
|---|---|---|
| `apps/gateway` | ✅ | Created WebSocket server using `ws`. |
| Cryptographic Auth | ✅ | Agent signs challenge, gateway verifies with public key from DB. |
| In-memory Registry | ✅ | Maps `cloudId` to active WebSocket. |
| Heartbeats | ✅ | 30s ping, drops agents after 65s of silence. |
| Redis Relay | ✅ | API <-> Gateway <-> Agent pub/sub bridge. |
| Live Dashboard UI | ✅ | Frontend polls API and shows ONLINE/OFFLINE dots. |

---

## Phase 5 — File Metadata + Sync ✅ COMPLETED

### Planned
| Item | Status | Notes |
|---|---|---|
| File watch & metadata scan | ✅ | Agent uses `chokidar` + `mime-types` to scan `~/.cloudbox/storage` and watch for changes. |
| Tunnel Sync Message | ✅ | Debounced state-based `METADATA_SYNC` message sent from agent to Gateway. |
| Redis Relay for Sync | ✅ | Gateway forwards `METADATA_SYNC` to Redis channel `gateway:responses`. |
| DB Sync Service | ✅ | API subscribes to Redis, reconciles DB `files` table, and resolves hierarchy. |
| `/files` API Route | ✅ | `GET /files?folder=...` returns DB state, formatting BigInt fields to safe strings. |

## Phase 6 — Upload / Download ✅ COMPLETED

### Planned
| Item | Status | Notes |
|---|---|---|
| `requestRegistry.ts` | ✅ | EventEmitter bridge from async WebSocket agent responses to sync HTTP handlers. |
| `gatewayPublisher.ts` | ✅ | Publishes commands from API to Gateway via Redis `gateway:commands`. |
| `gatewaySubscriber.ts` routing | ✅ | Routes `FILE_CHUNK`, `UPLOAD_ACK`, `ERROR` to `requestRegistry`. |
| `GET /files/download/:id` | ✅ | Streams file from Agent → Gateway → HTTP response in 64KB base64 chunks. |
| `POST /files/upload?folder=` | ✅ | Streams browser upload → Gateway → Agent disk via busboy + chunked `FILE_CHUNK` messages. |
| Agent `DOWNLOAD_FILE` handler | ✅ | Reads file from disk, streams as `FILE_CHUNK` messages with `final: true` sentinel. |
| Agent `UPLOAD_FILE` + `FILE_CHUNK` handler | ✅ | Opens write stream per requestId, writes decoded chunks, closes and sends `UPLOAD_ACK`. |

## Phase 7 — Quotas, Groups, Storage Pools ✅ COMPLETED

### Planned
| Item | Status | Notes |
|---|---|---|
| `Group` model in `schema.prisma` | ✅ | Created model and relation to User, ran migration |
| `requireRole.ts` middleware | ✅ | Restricts endpoints to specified roles (e.g. `ADMIN`) |
| `/admin` API Routes | ✅ | Full CRUD for groups, endpoints for assigning users to groups, and setting per-user quotas |
| Quota enforcement | ✅ | Modified `POST /files/upload` to block uploads that exceed user quota (`413 Payload Too Large`) |
| Used Bytes tracking | ✅ | Modified `POST /files/upload` to increment `usedBytes` upon successful `UPLOAD_ACK` |

## Phase 8 — Dashboard UI ✅ COMPLETED

### Planned
| Item | Status | Notes |
|---|---|---|
| Dependencies | ✅ | Added `@tanstack/react-query`, `@tanstack/react-query-devtools`, and `lucide-react` to `apps/web`. |
| Layout & Sidebar | ✅ | Created `app/dashboard/layout.tsx` with a persistent sidebar (Overview, My Files, Settings) and refactored the old dashboard view into an "Overview". |
| File Explorer (`/dashboard/files`) | ✅ | Built `FileExplorer.tsx` with breadcrumbs, grid view for files/folders, and responsive UI. |
| React Query Integration | ✅ | Added `Providers` in `layout.tsx`. Implemented `useQuery` for fetching files and `useMutation` for uploading files, including automatic cache invalidation on success. |
| Right Panel | ✅ | Added a slide-out details panel displaying file name, size, type, modified date, and storage node ID, along with a Download button. |

## Phase 9 — Admin Dashboard ✅ COMPLETED

### Implemented
| Item | Status | Notes |
|---|---|---|
| ActivityLog DB model | ✅ | New `activity_logs` table with `userId`, `action`, `meta` (JSON string), migration applied. |
| `activityLog.ts` helper | ✅ | `logActivity()` utility used throughout routes — non-fatal, never breaks primary flow. |
| Auth logging | ✅ | `SIGNUP` and `LOGIN` events recorded in `auth.ts`. |
| Upload logging | ✅ | `UPLOAD` event recorded after successful `UPLOAD_ACK` in `files.ts`. |
| `GET /admin/agents` | ✅ | Lists all agents with owner email, status, heartbeat, file count. |
| `GET /admin/stats` | ✅ | Returns user count, agent count (total + online), file count, total used bytes. |
| `GET /admin/activity` | ✅ | Last N activity log entries (default 50, max 200). |
| `POST /admin/users/:id/role` | ✅ | Set a user's role (USER/ADMIN/SUPER_ADMIN). |
| Sidebar Admin link | ✅ | "Admin" nav item appears in sidebar only for ADMIN/SUPER_ADMIN roles. |
| Admin sub-layout with tabs | ✅ | `/dashboard/admin` has a tabbed sub-layout (Overview, Users, Agents, Activity). |
| Overview stats page | ✅ | 4-card grid (users, nodes, files, storage), quick agent status list. |
| Users page | ✅ | Table with inline quota editor (GB input) and role selector per user. |
| Agents health page | ✅ | Cards per agent showing status, last heartbeat, file count, version. Auto-refreshes every 15s. |
| Activity log page | ✅ | Scrollable audit feed with color-coded action icons. Auto-refreshes every 15s. |

## Phase 10 — Sharing ✅ COMPLETED

### Implemented
| Item | Status | Notes |
|---|---|---|
| ShareLink DB model | ✅ | Created table for link tokens, mapped relations to `File` (onDelete: Cascade). |
| Creation & Revocation APIs | ✅ | `POST /sharing` (generates 16-byte hex secure token), `DELETE /sharing/:id` (revoke link). |
| List Sharing API | ✅ | `GET /sharing` (returns active share links, name, size, type). |
| Public APIs | ✅ | `GET /sharing/public/:token` (resolves metadata), `GET /sharing/public/:token/download` (initiates WebSocket chunk stream). |
| UI Share trigger | ✅ | "Share File" button in details panel, showing copyable link dialog on success. |
| Dashboard Shared page | ✅ | Managed list of links with file info, copy buttons, direct view button, and revocation buttons. |
| Public Download page | ✅ | `/s/[token]` route with folder metadata display, dynamic file icons, and big download button with live Agent status check. |

## Phase 11 — Hardening & DevOps ✅ COMPLETED

### Implemented
| Item | Status | Notes |
|---|---|---|
| Production Dockerfiles | ✅ | Added root-context Dockerfiles for API, Gateway, and Web so workspace packages and `pnpm-lock.yaml` are available during image builds. |
| Compose hardening | ✅ | `docker-compose.yml` now runs Postgres, Redis, API, Gateway, and Web; optional `observability` profile adds Prometheus, Grafana, Loki, and Promtail. |
| Agent installer | ✅ | Added `scripts/install-agent.sh` for Ubuntu installs and updated the systemd service template with production API/Gateway URLs. |
| Nginx + TLS config | ✅ | Added `deploy/nginx/cloudbox.conf` with HTTP-to-HTTPS redirects, API/Web proxying, and WebSocket upgrade support for `gateway.cloudbox.com`. |
| Prometheus metrics | ✅ | API exposes `/metrics` for request counts, active requests, errors, and latency totals; Gateway exposes `/metrics` for connected agents, relay counts, active transfers, and transfer timing. |
| Grafana/Loki/Promtail | ✅ | Added datasource provisioning plus Loki and Promtail configs for CloudBox container logs. |
| GitHub Actions | ✅ | CI now installs, builds shared packages, typechecks, lints, builds all packages, builds Docker images, and conditionally deploys on pushes to `main` when deploy secrets are configured. |
| Local startup docs | ✅ | `start.bat`, `README.md`, and `HOW_TO_RUN.md` updated with Gateway metrics and observability commands. |

## Phase 12 — Post-MVP Polish ✅ COMPLETED

### Implemented
| Item | Status | Notes |
|---|---|---|
| Trash / Restore | ✅ | Soft-deletes `deletedAt` logic, API endpoints `/trash` and `/restore`, Trash UI page. |
| File Versioning | ✅ | Snapshot previous versions on file replacement, UI to view history. |
| Previews | ✅ | In-browser preview modal for images, PDF, text, audio, and video. |
| Multi-Agent | ✅ | Backend agent querying and selector dropdown on the frontend for multi-node setups. |
| Quotas / Email | ✅ | Nodemailer integrated, 80%/95% warnings, email on agent offline. |
| TOTP / 2FA | ✅ | Authenticator app setup and verify route, login flow update, Settings page. |

---

## Change Log

| Date | Phase | What Changed |
|---|---|---|
| 2026-07-02 | 1 | Initial monorepo setup — pnpm workspaces, tsconfig.base.json, .gitignore, README |
| 2026-07-02 | 1 | `packages/shared-types` — all domain types + full GatewayMessage protocol |
| 2026-07-02 | 1 | `apps/api` — Express app, `/health` route, Prisma v1 schema, Redis client, Dockerfile |
| 2026-07-02 | 1 | `apps/web` — Next.js 16 scaffolded, dark glassmorphism login page + LoginForm component |
| 2026-07-02 | 1 | `docker-compose.yml` — Postgres + Redis + API + Web with healthchecks |
| 2026-07-02 | 1 | `.github/workflows/ci.yml` — GitHub Actions lint + typecheck CI |
| 2026-07-02 | 1 | Fixed TS2742 portability errors in `app.ts` and `health.ts` |
| 2026-07-02 | 1 | Removed deprecated `version:` key from docker-compose.yml |
| 2026-07-02 | 1 | All packages typecheck clean ✅ |
| 2026-07-07 | 11 | Added production Dockerfiles for API, Gateway, and Web; fixed compose build context for workspace packages. |
| 2026-07-07 | 11 | Added Gateway `/health` and Prometheus `/metrics`; added API `/metrics` middleware/route. |
| 2026-07-07 | 11 | Added Prometheus, Grafana, Loki, Promtail, and Nginx deployment configs. |
| 2026-07-07 | 11 | Added Ubuntu agent installer script and refreshed systemd environment URLs. |
| 2026-07-07 | 11 | Expanded GitHub Actions to build, lint, typecheck, Docker-build, and conditionally deploy on `main`. |
| 2026-07-11 | 12 | Implemented Trash/Restore, TOTP (2FA), File Versioning, Email Alerts, Previews, Multi-Agent UI. |
