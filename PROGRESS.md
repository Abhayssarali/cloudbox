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

## Phase 4 — WebSocket Gateway + Tunnel ⏳ NOT STARTED

### Planned
- `apps/gateway` scaffolded (ws server)
- Agent authenticates via signed challenge
- `cloudId → socket` map backed by Redis pub/sub
- Heartbeat / offline detection
- Full message protocol implemented

---

## Phase 5 — File Metadata + Sync ⏳ NOT STARTED
## Phase 6 — Upload / Download ⏳ NOT STARTED
## Phase 7 — Quotas, Groups, Storage Pools ⏳ NOT STARTED
## Phase 8 — Dashboard UI ⏳ NOT STARTED
## Phase 9 — Admin Dashboard ⏳ NOT STARTED
## Phase 10 — Sharing ⏳ NOT STARTED
## Phase 11 — Hardening & DevOps ⏳ NOT STARTED
## Phase 12 — Post-MVP Polish ⏳ NOT STARTED

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
