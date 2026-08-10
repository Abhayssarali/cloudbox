# CloudBox — Render.com 1-Click Deployment Guide 🚀

Deploying CloudBox on **[Render.com](https://render.com)** is **extremely quick, easy, and fully automated** using our pre-configured `render.yaml` Blueprint file!

---

## ⚡ Why Render?

* **Free / Cheap Managed Infrastructure:** Render provides managed PostgreSQL, Redis, and Web Services with zero maintenance.
* **Native WebSockets Support:** Render Web Services support WebSockets (WSS) out of the box with zero custom proxy configuration required!
* **Automated SSL/TLS:** Every service gets free, automatic HTTPS/WSS certificates (`*.onrender.com`).
* **1-Click Infrastructure as Code:** Provision PostgreSQL, Redis, API, Gateway, and Web Dashboard in one single step.

---

## 🛠️ Step-by-Step Deployment Instructions

### Step 1: Push Code to GitHub / GitLab
Make sure your repository containing `render.yaml` is pushed to your GitHub or GitLab account.

---

### Step 2: Create New Blueprint on Render
1. Log in to [dashboard.render.com](https://dashboard.render.com).
2. Click **New +** in the top right corner ➡️ Select **Blueprint**.
3. Connect your GitHub/GitLab repository.
4. Render will automatically detect the [`render.yaml`](file:///d:/Downloads/cloudbox/render.yaml) file in the root directory.
5. Give your Blueprint instance a name (e.g., `cloudbox-production`) and click **Apply**.

---

### Step 3: Enter SMTP Credentials (Brevo Email Verification)
Render will automatically provision PostgreSQL, Redis, and generate random JWT secrets for you!

During setup, Render will prompt you for 2 environment variable inputs:
* **`SMTP_USER`**: Your Brevo SMTP email user (e.g. `86d7e6001@smtp-brevo.com`).
* **`SMTP_PASS`**: Your Brevo SMTP key (`xsmtpsib-...`).

---

### Step 4: Access Your Deployed Services!
Once Render finishes building the containers (approx 3-5 minutes), your platform will be live:

| Service | Render URL Pattern | Purpose |
| :--- | :--- | :--- |
| **Web Dashboard** | `https://cloudbox-web.onrender.com` | User UI Dashboard |
| **Main API** | `https://cloudbox-api.onrender.com` | REST API Backend |
| **WebSocket Gateway** | `wss://cloudbox-gateway.onrender.com` | Real-Time Agent Gateway |

---

## ⚡ Connecting Your Storage Node Agent to Render

Once deployed, connect your local PC, Home Server, or Raspberry Pi to your Render instance:

```bash
# 1. Register your local Agent using claim code from Web Dashboard
cloudbox-agent register <CLAIM_CODE>

# 2. Start the Agent connecting to your Render Gateway WSS URL
GATEWAY_URL="wss://cloudbox-gateway.onrender.com" cloudbox-agent start
```

---

## ⚙️ How render.yaml Works Under the Hood

The included `render.yaml` Blueprint automatically orchestrates:
1. **Managed PostgreSQL:** Creates database `cloudbox_db` and links connection string to API & Gateway.
2. **Managed Redis:** Creates Redis store and links connection URL to API & Gateway.
3. **Automated Schema Migration:** The API container automatically executes `npx prisma db push` on startup.
4. **Environment Variable Linking:** Links API URL directly to Next.js Web frontend, and Web URL directly to API CORS origins.
