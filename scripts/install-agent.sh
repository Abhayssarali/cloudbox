#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/cloudbox}"
SERVICE_USER="${SERVICE_USER:-cloudbox}"
API_URL="${API_URL:-https://cloudbox.com/api}"
GATEWAY_URL="${GATEWAY_URL:-wss://gateway.cloudbox.com}"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20+ is required before installing the CloudBox agent." >&2
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  npm install -g pnpm
fi

if ! id "$SERVICE_USER" >/dev/null 2>&1; then
  useradd --system --create-home --shell /usr/sbin/nologin "$SERVICE_USER"
fi

mkdir -p "$INSTALL_DIR"
rsync -a --delete \
  --exclude node_modules \
  --exclude dist \
  --exclude .git \
  ./ "$INSTALL_DIR/"

cd "$INSTALL_DIR"
pnpm install --frozen-lockfile
pnpm --filter @cloudbox/shared-types build
pnpm --filter agent build

cat >/etc/systemd/system/cloudbox-agent.service <<SERVICE
[Unit]
Description=CloudBox Agent Service
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$INSTALL_DIR/apps/agent
ExecStart=/usr/bin/node dist/index.js start
Restart=on-failure
RestartSec=5
User=$SERVICE_USER
Environment=NODE_ENV=production
Environment=API_URL=$API_URL
Environment=GATEWAY_URL=$GATEWAY_URL

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable cloudbox-agent

echo "CloudBox agent installed."
echo "Register first with: sudo -u $SERVICE_USER API_URL=$API_URL node $INSTALL_DIR/apps/agent/dist/index.js register <claim-code>"
echo "Then start it with: systemctl start cloudbox-agent"
