# CloudBox — Split-Tier Deployment Guide (Vercel + AWS) 🚀

This guide explains how to host the Next.js frontend on **Vercel** (completely free) and host the backend (API, Gateway, DB, Redis) on **AWS Lightsail** (predictable $10/month using your AWS credits). 

Hosting them separately keeps your Next.js deployments fast and automatic via Vercel's Git integrations, while reserving your AWS credits for API execution and DB storage.

---

## 🗂️ High-Level Architecture

```mermaid
graph TD
    User([Browser User]) -->|Loads HTML/JS| Vercel[Vercel Frontend: cloudbox.vercel.app]
    User -->|Sends API/Auth Cookies| AWS_API[AWS Lightsail: api.yourdomain.com:443]
    Agent[Ubuntu Agent Node] -->|WS Tunnel| AWS_GW[AWS Lightsail: gateway.yourdomain.com:443]
    
    subgraph AWS Lightsail VM
        AWS_API -->|Auth/Data| DB[(PostgreSQL DB)]
        AWS_API <-->|Pub/Sub Relay| Redis[(Redis)]
        AWS_GW <-->|Pub/Sub Relay| Redis
        AWS_GW -->|Device Auth| DB
    end
```

---

## 💻 Part 1: AWS Setup (Backend ONLY)

We will use your AWS Lightsail instance to run **only** the API, Gateway, Postgres, and Redis.

### 1. Update `docker-compose.yml` for Backend Only
In your project directory on the AWS server, you can modify `docker-compose.yml` to remove the `web` service since Vercel is serving the frontend. 

Run the database and gateway services:
```bash
docker compose up -d postgres redis api gateway
```

### 2. Configure AWS Backend Environment Variables
In your `apps/api/.env` on the AWS instance, set:
```env
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://cloudbox:your_strong_password@postgres:5432/cloudbox_db
REDIS_URL=redis://redis:6379

# JWT and Sessions
JWT_SECRET=super_long_random_jwt_secret
JWT_REFRESH_SECRET=super_long_random_refresh_secret
SESSION_SECRET=super_long_random_session_secret

# CORS must match the exact Vercel frontend URL
CORS_ORIGIN=https://cloudbox-yourname.vercel.app
```
*(If you attach a custom domain to Vercel later, change `CORS_ORIGIN` to `https://yourdomain.com`).*

### 3. Nginx Reverse Proxy on AWS
Since you don't need to route domain traffic to Next.js on port `3000` anymore, your Nginx config on the AWS host machine is simplified.

Create Nginx site: `/etc/nginx/sites-available/cloudbox`
```nginx
# API Backend Server
server {
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# WebSocket Gateway Server (For Agents)
server {
    server_name gateway.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:4001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

Enable the Nginx site and generate certificates using certbot:
```bash
sudo ln -s /etc/nginx/sites-available/cloudbox /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
sudo certbot --nginx -d api.yourdomain.com -d gateway.yourdomain.com
```

---

## ⚡ Part 2: Vercel Setup (Frontend ONLY)

Vercel natively supports **pnpm monorepos** and automatically builds your Next.js frontend while importing dependencies from packages in the root.

### 1. Import Project to Vercel
1. Push your monorepo code to a private GitHub repository.
2. Sign in to [Vercel](https://vercel.com/) using GitHub.
3. Click **Add New** ➡️ **Project**.
4. Import your `cloudbox` repository.

### 2. Configure Monorepo Settings
Vercel will detect it's a monorepo. In the project import screen, modify these parameters:
*   **Framework Preset:** `Next.js`
*   **Root Directory:** `apps/web`
*   **Build & Development Settings:** 
    *   *Leave default* (Vercel will automatically run `next build` inside the workspace).
*   **Environment Variables:** Add a single production environment variable:
    *   **Name:** `NEXT_PUBLIC_API_URL`
    *   **Value:** `https://api.yourdomain.com` *(Notice: no trailing slash)*

Click **Deploy**! Vercel will install dependencies from the root `pnpm-workspace.yaml`, build the Next.js app, and publish it.

---

## 🎯 How Cookie-Based Authentication Works in Split-Tier

Because Vercel serves the page on `cloudbox-yourname.vercel.app` (or `yourdomain.com`) and requests go to `api.yourdomain.com`, they are cross-domain. 

The application uses **cross-origin secure cookies** to maintain your login session:

1. When you type credentials on Vercel, Next.js sends a request to `https://api.yourdomain.com/auth/login`.
2. The AWS backend authenticates you and appends the access cookie with options:
   * `httpOnly: true` (Prevents script stealing)
   * `secure: true` (Ensures it is only transmitted over HTTPS)
   * `sameSite: "none"` (Permits the browser to send it back when the origin is `vercel.app`)
3. The browser receives the cookie and automatically attaches it to subsequent file download or upload requests.

---

## 📋 Pre-Flight Checklist

1. **Prisma DB Migration:** Once AWS containers are online, run the database migrations:
   ```bash
   docker compose exec api npx prisma migrate deploy
   ```
2. **Double check CORS:** If you get a "CORS error" in the browser console when logging in, make sure `CORS_ORIGIN` in `apps/api/.env` matches your Vercel URL **exactly** (e.g., `https://cloudbox-abc.vercel.app`, with no trailing slash).
3. **Agent Registration:** When setting up Ubuntu agents, register them with the gateway domain:
   ```bash
   sudo -u cloudbox API_URL=https://api.yourdomain.com GATEWAY_URL=wss://gateway.yourdomain.com node /opt/cloudbox-agent/cloudbox-agent.mjs register <CLAIM_CODE>
   ```
