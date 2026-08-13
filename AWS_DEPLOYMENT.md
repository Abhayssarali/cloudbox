# CloudBox — AWS EC2 & GoDaddy Deployment Guide 🚀

This guide explains how to deploy CloudBox on an **Amazon Web Services (AWS) EC2** instance using your domain **`cloudboxes.in`** (registered on GoDaddy) and **Brevo Email OTP** for signup verification.

---

## 💵 Architecture & Server Sizing

* **Server:** AWS EC2 Instance (`t3.micro` - 1 GB RAM, 2 vCPUs, 20 GB SSD) running **Ubuntu 24.04 LTS**.
* **Domain:** `cloudboxes.in` (GoDaddy DNS)
* **Subdomain:** `gateway.cloudboxes.com` (for Node Agent WebSocket connection)
* **Reverse Proxy:** Nginx with free **Let's Encrypt SSL** certificates.
* **Database & Services:** Run via Docker Compose (`postgres`, `redis`, `api`, `gateway`, `web`).
* **Email Service:** **Brevo** SMTP for 6-digit email OTP signup verification.

---

## 🛠️ Step-by-Step Deployment Walkthrough

### Step 1: Launch your AWS EC2 Instance

1. Log in to the [AWS EC2 Console](https://console.aws.amazon.com/ec2/).
2. Click **Launch Instance**:
   * **Name:** `cloudbox-server`
   * **AMI:** **Ubuntu 24.04 LTS** (64-bit x86)
   * **Instance Type:** `t3.micro` (2 vCPU, 1 GB RAM)
   * **Key Pair:** Select or create a `.pem` SSH key pair (e.g. `cloudbox-key.pem`).
3. **Network Settings (Security Group)**:
   * Allow **SSH** (`22`) from Anywhere (or your IP).
   * Allow **HTTP** (`80`) from Anywhere.
   * Allow **HTTPS** (`443`) from Anywhere.
4. **Storage:** 20 GB GP3 SSD.
5. Click **Launch Instance**.
6. **Attach Elastic IP**:
   * Go to **EC2 ➡️ Elastic IPs** ➡️ **Allocate Elastic IP address**.
   * Select your Elastic IP and click **Actions ➡️ Associate Elastic IP address** to attach it to your running `cloudbox-server` instance. Note down this Public IP (e.g., `54.x.x.x`).

---

### Step 2: Configure GoDaddy DNS Records

Log in to your **GoDaddy Control Panel** ➡️ **My Products** ➡️ **cloudboxes.com** ➡️ **DNS Management**, and add the following `A` records pointing to your AWS Elastic IP:

| Type | Name | Value | TTL |
| :--- | :--- | :--- | :--- |
| **A** | `@` | `YOUR_AWS_ELASTIC_IP` | 1/2 Hour |
| **A** | `www` | `YOUR_AWS_ELASTIC_IP` | 1/2 Hour |
| **A** | `gateway` | `YOUR_AWS_ELASTIC_IP` | 1/2 Hour |

*Note: DNS propagation can take 2–15 minutes.*

---

### Step 3: Connect to EC2 & Install Docker

Run from your terminal (or PowerShell):

```bash
# Connect to EC2
ssh -i cloudbox-key.pem ubuntu@YOUR_AWS_ELASTIC_IP

# Update packages
sudo apt update && sudo apt upgrade -y

# Install Docker, Docker Compose, Git, Nginx & Certbot
sudo apt install -y docker.io docker-compose-v2 git nginx certbot python3-certbot-nginx

# Allow docker usage without sudo
sudo usermod -aG docker $USER
newgrp docker
```

---

### Step 4: Clone Repository & Configure Environment

```bash
# Clone repository
git clone https://github.com/YourUsername/cloudbox.git
cd cloudbox

# Create production .env file
nano .env
```

Paste the following environment configuration into `.env`:

```env
# Domain & Server Config
CORS_ORIGIN=https://cloudboxes.in
NEXT_PUBLIC_API_URL=https://cloudboxes.in/api

# Secrets (Generate random strings for production)
JWT_SECRET=production-super-secret-jwt-key-cloudbox-2026
JWT_REFRESH_SECRET=production-super-secret-refresh-key-cloudbox-2026
SESSION_SECRET=production-super-secret-session-key-cloudbox-2026

# Google OAuth (Optional - add from Google Cloud Console if needed)
GOOGLE_CLIENT_ID=771896839098-01pti1o5m9dgjus0nmeckgok6fp7qec8.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
GOOGLE_CALLBACK_URL=https://cloudboxes.in/auth/google/callback

# Brevo SMTP Email Verification (Configured & Ready)
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=86d7e6001@smtp-brevo.com
SMTP_PASS=xsmtpsib-c7c37e57855b496e37ae3d288b002d83a1289130825fe23b9a79a123af324c8c-DuBoIQgjodUscYMG
SMTP_FROM=CloudBox <noreply@cloudboxes.in>
```

---

### Step 5: Configure Nginx Reverse Proxy & SSL Certificates

1. Create Nginx config file:
   ```bash
   sudo nano /etc/nginx/sites-available/cloudboxes.com
   ```

2. Paste the following Nginx routing rules:
   ```nginx
   # Web Frontend & API
   server {
       server_name cloudboxes.com www.cloudboxes.com;

       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }

       location /api/ {
           proxy_pass http://127.0.0.1:4000/;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }

   # WebSocket Agent Gateway
   server {
       server_name gateway.cloudboxes.com;

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

3. Enable configuration & test Nginx:
   ```bash
   sudo ln -s /etc/nginx/sites-available/cloudboxes.com /etc/nginx/sites-enabled/
   sudo rm -f /etc/nginx/sites-enabled/default
   sudo nginx -t
   sudo systemctl restart nginx
   ```

4. Generate **Let's Encrypt HTTPS Certificates**:
   ```bash
   sudo certbot --nginx -d cloudboxes.com -d www.cloudboxes.com -d gateway.cloudboxes.com
   ```
   *Certbot will obtain SSL certs and auto-configure HTTPS redirects!*

---

### Step 6: Launch Docker Containers & Run Migrations

```bash
# Start all containers in production mode
docker compose up -d --build postgres redis api gateway web

# Apply Prisma database migrations inside the API container
docker compose exec -w /app/apps/api api npx prisma@5.17.0 db push
```
*(Note: The `api` container also runs database synchronization automatically when it boots up!)*

---

## ✉️ Verifying Brevo Email OTP Signup Flow

1. Open **`https://cloudboxes.com/signup`** in your browser.
2. Fill out the signup form with your workspace name and email.
3. Upon clicking **Create workspace**, a **6-digit verification code** will be dispatched immediately via Brevo SMTP to your inbox.
4. Enter the code in the interactive OTP verification screen to activate your account and log into the dashboard!

---

## ⚡ Connecting Storage Nodes to Production

Storage nodes running on Ubuntu servers or Windows PCs connect to your production instance via:
```bash
npx cloudbox-agent start --gateway wss://gateway.cloudboxes.com
```
