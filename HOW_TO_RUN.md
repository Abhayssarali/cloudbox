# How to Run CloudBox Locally

This guide explains how to start the CloudBox development environment from scratch. 

## Prerequisites
- **Node.js**: v20 or higher
- **pnpm**: v9 or higher (`npm install -g pnpm`)
- **Docker Desktop**: Must be running (needed for Postgres and Redis)

---

## 1. Start Infrastructure (Docker)
Before starting the backend, you must have the database (PostgreSQL) and cache (Redis) running.
Open a terminal in the root of the project and run:
```bash
docker compose up -d postgres redis
```
*(This starts the containers in the background. You only need to do this once per session or after a system restart.)*

## 2. Environment Variables
Make sure your API environment variables are set up.
Copy `apps/api/.env.example` to `apps/api/.env`:
```bash
# On Windows (PowerShell):
Copy-Item apps/api/.env.example apps/api/.env
```
*(Edit `apps/api/.env` to add your Google OAuth Client ID and Secret if you want to test Google Login).*

## 3. Install Dependencies
If you haven't already, install all mono-repo packages:
```bash
pnpm install
```

## 4. Database Setup & Migrations
You need to apply the Prisma schema to your running PostgreSQL database. 
Run this command anytime the schema changes:
```bash
pnpm --filter api run prisma:migrate
```

## 5. Start Development Servers
Start the Web App, API Server, and Gateway Server concurrently:
```bash
pnpm dev
```
- **Web App (Frontend)**: [http://localhost:3000](http://localhost:3000)
- **API Server (Backend)**: [http://localhost:4000](http://localhost:4000)
- **Gateway Server (WebSocket)**: [ws://localhost:4001](ws://localhost:4001)
- **Gateway Health**: [http://localhost:4001/health](http://localhost:4001/health)
- **API Metrics**: [http://localhost:4000/metrics](http://localhost:4000/metrics)
- **Gateway Metrics**: [http://localhost:4001/metrics](http://localhost:4001/metrics)

## 6. Start the Agent
To start your storage node Agent, open a new terminal and run:
```bash
pnpm --filter cloudbox-agent run dev start
```
*(On first run, this connects to the Gateway, performs authentication, and creates your local storage folder at `~/.cloudbox/storage`)*

## 7. Verifying File Sync (Phase 5)
1. Add some files/directories inside the agent's storage folder (`~/.cloudbox/storage`).
2. The agent automatically detects changes via `chokidar` and reconciles metadata with the backend.
3. Verify by making an authorized request to `/files?folder=/` or checking the dashboard.

## 8. Running the Docker Stack
To run the production-style containers locally:
```bash
docker compose up -d --build
```

To include Prometheus, Grafana, Loki, and Promtail:
```bash
docker compose --profile observability up -d --build
```

Observability endpoints:
- Prometheus: [http://localhost:9090](http://localhost:9090)
- Grafana: [http://localhost:3001](http://localhost:3001) (`admin` / `cloudbox` by default)
- Loki: [http://localhost:3100](http://localhost:3100)

## 9. Production Deployment Notes
- Use `deploy/nginx/cloudbox.conf` as the Nginx reverse proxy template for `cloudbox.com` and `gateway.cloudbox.com`.
- Issue certificates with Certbot/Let's Encrypt, then mount them at the paths referenced in the Nginx config.
- Configure GitHub Actions deploy secrets (`DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, optional `DEPLOY_PATH`) to enable deploy-on-main.
- On Ubuntu storage nodes, run `scripts/install-agent.sh` from a checked-out release to install the agent and systemd service.

---

## 10. Clearing / Resetting the Database

### Option A — Quick Truncate (wipes all user data, keeps schema) ⚡
Instantly deletes all users, workspaces, files, agents, and activity logs:
```bash
docker compose exec postgres psql -U cloudbox -d cloudbox_db -c "TRUNCATE users, groups, files, agents, activity_logs CASCADE;"
```

### Option B — Full Schema Reset via Prisma
Drops and re-applies the entire database schema (all data is lost):
```bash
docker compose exec -w /app/apps/api api npx prisma@5.17.0 db push --force-reset
```

### Option C — Complete Fresh Start (wipes DB + Redis volumes entirely)
Destroys all Docker volumes and restarts all containers from scratch:
```bash
docker compose down -v
docker compose up -d
```
*(After this, re-run `pnpm --filter api run prisma:migrate` to re-apply the schema)*

### Clearing Redis Only
Flushes all cached OTPs, claim codes, and session tokens from Redis:
```bash
docker compose exec redis redis-cli FLUSHALL
```

