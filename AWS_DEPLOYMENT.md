# CloudBox — AWS Deployment Guide 🚀

This guide explains how to deploy CloudBox on Amazon Web Services (AWS) using your **$100 AWS Credits**. 

To maximize the longevity of your credits while maintaining excellent performance, we will deploy the entire stack using **Docker Compose** on a single virtual server. This setup is highly cost-effective and mirrors your local development environment.

---

## 💵 Budget & Architecture Planning

With a $100 credit budget, we want to choose an option that runs stably for several months.

### Recommended Compute Options:
*   **Option A: AWS Lightsail (Recommended — Easiest & Most Predictable)**
    *   **Instance Size:** 2 GB RAM, 2 vCPUs, 60 GB SSD.
    *   **Cost:** **$10 / month** (Your $100 credits will last **10 months!**).
    *   **Why:** Includes free static IP addresses and a generous **3 TB free data transfer allowance** (AWS EC2 charges separately for bandwidth, which can eat credits fast).
*   **Option B: Amazon EC2 (Standard AWS EC2)**
    *   **Instance Type:** `t3.small` (2 GB RAM, 2 vCPUs) or `t4g.small` (ARM64 architecture, requires ARM builds).
    *   **Cost:** ~$15–$20 / month (Lasts **5–6 months**).
    *   **Why:** Useful if you want to integrate with other advanced AWS services (VPC, RDS, etc.).

---

## 🛠️ Step-by-Step Deployment Walkthrough

### Step 1: Create the Server on AWS

#### Using AWS Lightsail (Recommended):
1.  Log in to the [AWS Console](https://console.aws.amazon.com/) and search for **Lightsail**.
2.  Click **Create instance**.
3.  Choose **Linux/Unix** platform.
4.  Under "Select a blueprint", choose **OS Only** ➡️ **Ubuntu 24.04 LTS** (or Ubuntu 22.04 LTS).
5.  Select the **$10/month** instance plan (2 GB RAM, 2 vCPUs, 60 GB SSD).
6.  Identify your instance (e.g., `cloudbox-production`) and click **Create Instance**.
7.  Once created, go to the **Networking** tab of your instance:
    *   Click **Create static IP** to attach a permanent IP to your instance.
    *   Under **IPv4 Firewall**, add rules to open the following ports:
        *   `80` (HTTP) — For SSL certificate challenge and redirects.
        *   `443` (HTTPS) — Main entry point for Frontend & API.
        *   `22` (SSH) — For server administration.

---

### Step 2: Configure Your Domain (DNS)

To secure connections from your agent nodes and browser, you need a domain name (you can get a cheap one on Namecheap/GoDaddy or Route 53).

Point the following DNS records to your server's **Static IP Address**:
*   `A Record` ➡️ `yourdomain.com` ➡️ `YOUR_STATIC_IP`
*   `A Record` ➡️ `gateway.yourdomain.com` ➡️ `YOUR_STATIC_IP` (for the agent gateway)

---

### Step 3: Server Preparation & Docker Installation

SSH into your new server (using the Lightsail browser terminal or `ssh -i key.pem ubuntu@YOUR_STATIC_IP`) and run the following command to update system packages and install Docker:

```bash
# Update package lists
sudo apt update && sudo apt upgrade -y

# Install Docker & Docker Compose
sudo apt install -y docker.io docker-compose-v2 git unzip

# Add your user to the docker group so you don't need sudo
sudo usermod -aG docker $USER
newgrp docker
```

---

### Step 4: Clone CloudBox & Set Up Environment

1.  Clone your repository to the server:
    ```bash
    git clone <your-github-repo-url> cloudbox
    cd cloudbox
    ```

2.  Create your production `.env` files.
    
    For the root folder (or `apps/api/.env`):
    ```bash
    cp apps/api/.env.example apps/api/.env
    nano apps/api/.env
    ```

    Ensure the following keys are set correctly (use your domain instead of localhost):
    ```env
    PORT=4000
    DATABASE_URL=postgresql://cloudbox:your_strong_password@postgres:5432/cloudbox_db
    REDIS_URL=redis://redis:6379
    JWT_SECRET=generate_a_very_long_random_string_here
    JWT_REFRESH_SECRET=generate_another_long_random_string_here
    SESSION_SECRET=another_random_string
    CORS_ORIGIN=https://yourdomain.com
    
    # WebSocket Configuration
    NEXT_PUBLIC_API_URL=https://yourdomain.com
    ```

    Modify your `docker-compose.yml` db passwords to match `DATABASE_URL`!

---

### Step 5: Configure Reverse Proxy (Nginx) & SSL

We use Nginx to receive requests on port `80`/`443` and route them to our containers (`web` on `3000`, `api` on `4000`, and `gateway` on `4001`).

1.  Install Certbot and Nginx on the host machine:
    ```bash
    sudo apt install -y nginx certbot python3-certbot-nginx
    ```

2.  Create an Nginx configuration file:
    ```bash
    sudo nano /etc/nginx/sites-available/cloudbox
    ```

3.  Paste the following config (replace `yourdomain.com` with your actual domain):
    ```nginx
    # API & Next.js Frontend
    server {
        server_name yourdomain.com;

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

    # Agent WS Gateway
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

4.  Enable the site and restart Nginx:
    ```bash
    sudo ln -s /etc/nginx/sites-available/cloudbox /etc/nginx/sites-enabled/
    sudo rm /etc/nginx/sites-enabled/default
    sudo nginx -t
    sudo systemctl restart nginx
    ```

5.  Generate **Let's Encrypt SSL Certificates**:
    ```bash
    sudo certbot --nginx -d yourdomain.com -d gateway.yourdomain.com
    ```
    *Certbot will automatically obtain certificates and modify your Nginx file to enable SSL redirect.*

---

### Step 6: Launch CloudBox

Now, run the production build and start the containers:

```bash
# Build the production bundle images and start them in the background
docker compose up -d --build postgres redis api gateway web
```

Ensure the databases are migrated inside the running container:
```bash
docker compose exec api npx prisma migrate deploy
```

---

## ⚡ Monitoring your AWS Usage

To avoid surprise charges:
1.  Go to the **Billing Dashboard** in the AWS console.
2.  Set up a **Billing Alarm** (e.g., alert you if monthly forecasted usage exceeds $15). This is critical, as it ensures you won't accidentally drain your $100 credits.
3.  Choose **Lightsail** instead of EC2 for predictable fixed cost hosting.
