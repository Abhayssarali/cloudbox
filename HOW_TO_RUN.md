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
Start both the Frontend (Next.js) and Backend (Express API) concurrently:
```bash
pnpm dev
```

---

### Accessing the App
- **Web App (Frontend)**: [http://localhost:3000](http://localhost:3000)
- **API Server (Backend)**: [http://localhost:4000](http://localhost:4000)
- **API Health Check**: [http://localhost:4000/health](http://localhost:4000/health)
- **Database Studio**: `pnpm --filter api run prisma:studio` (Opens at http://localhost:5555)

> **Note**: I will update this file as we add more moving parts (like the Gateway or Agent) in future phases!
