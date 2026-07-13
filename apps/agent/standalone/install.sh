#!/usr/bin/env bash
# =============================================================================
# CloudBox Agent — Ubuntu/Debian Standalone Installer
# =============================================================================
# Usage:
#   sudo bash install.sh [--api-url URL] [--gateway-url URL]
#
# Environment variables (can also be set before running):
#   API_URL       CloudBox API base URL   (default: https://api.cloudbox.app)
#   GATEWAY_URL   CloudBox Gateway WS URL (default: wss://gateway.cloudbox.app)
# =============================================================================
set -euo pipefail

# ---- Defaults ----------------------------------------------------------------
INSTALL_DIR="/opt/cloudbox-agent"
SERVICE_USER="cloudbox"
API_URL="${API_URL:-https://api.cloudbox.app}"
GATEWAY_URL="${GATEWAY_URL:-wss://gateway.cloudbox.app}"
NODE_REQUIRED_MAJOR=20

# ---- Colours -----------------------------------------------------------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; exit 1; }

# ---- Root check --------------------------------------------------------------
if [[ $EUID -ne 0 ]]; then
  error "This installer must be run as root. Try: sudo bash install.sh"
fi

# ---- Parse arguments ---------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case $1 in
    --api-url)      API_URL="$2";     shift 2 ;;
    --gateway-url)  GATEWAY_URL="$2"; shift 2 ;;
    *)              warn "Unknown argument: $1"; shift ;;
  esac
done

echo -e "\n${BOLD}╔══════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║    CloudBox Agent Installer v1.0     ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════╝${RESET}\n"

# ---- Step 1: Install Node.js -------------------------------------------------
info "Checking for Node.js ${NODE_REQUIRED_MAJOR}+..."

INSTALL_NODE=false
if command -v node &>/dev/null; then
  NODE_VER=$(node -e "process.stdout.write(process.version.slice(1).split('.')[0])")
  if [[ "$NODE_VER" -lt "$NODE_REQUIRED_MAJOR" ]]; then
    warn "Node.js ${NODE_VER} found, but ${NODE_REQUIRED_MAJOR}+ is required. Upgrading..."
    INSTALL_NODE=true
  else
    success "Node.js ${NODE_VER} found."
  fi
else
  info "Node.js not found. Installing via NodeSource..."
  INSTALL_NODE=true
fi

if [[ "$INSTALL_NODE" == "true" ]]; then
  if ! command -v curl &>/dev/null; then
    apt-get update -qq && apt-get install -y curl
  fi
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_REQUIRED_MAJOR}.x" | bash -
  apt-get install -y nodejs
  success "Node.js $(node -v) installed."
fi

# ---- Step 2: Create service user ---------------------------------------------
info "Setting up service user '${SERVICE_USER}'..."
if ! id "$SERVICE_USER" &>/dev/null; then
  useradd --system --create-home --shell /usr/sbin/nologin "$SERVICE_USER"
  success "User '${SERVICE_USER}' created."
else
  success "User '${SERVICE_USER}' already exists."
fi

# ---- Step 3: Install agent files ---------------------------------------------
info "Installing agent to ${INSTALL_DIR}..."
mkdir -p "${INSTALL_DIR}"

# Copy the bundled agent JS (located next to this script)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ ! -f "${SCRIPT_DIR}/cloudbox-agent.mjs" ]]; then
  error "cloudbox-agent.mjs not found next to install.sh. Make sure you extracted the full archive."
fi
cp "${SCRIPT_DIR}/cloudbox-agent.mjs" "${INSTALL_DIR}/cloudbox-agent.mjs"

# Write the environment file (readable only by root + the service user)
cat > "${INSTALL_DIR}/.env" <<ENV
API_URL=${API_URL}
GATEWAY_URL=${GATEWAY_URL}
NODE_ENV=production
ENV
chmod 640 "${INSTALL_DIR}/.env"
chown root:"${SERVICE_USER}" "${INSTALL_DIR}/.env"

# Create storage directory owned by service user
mkdir -p "/home/${SERVICE_USER}/.cloudbox/storage"
chown -R "${SERVICE_USER}:${SERVICE_USER}" "/home/${SERVICE_USER}/.cloudbox"

# Set ownership of install dir
chown -R root:"${SERVICE_USER}" "${INSTALL_DIR}"
chmod -R 750 "${INSTALL_DIR}"

success "Agent files installed."

# ---- Step 4: Install systemd service -----------------------------------------
info "Installing systemd service..."
cat > /etc/systemd/system/cloudbox-agent.service <<SERVICE
[Unit]
Description=CloudBox Storage Agent
Documentation=https://github.com/cloudbox/cloudbox
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${INSTALL_DIR}
EnvironmentFile=${INSTALL_DIR}/.env
ExecStart=/usr/bin/node ${INSTALL_DIR}/cloudbox-agent.mjs start
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=cloudbox-agent
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/home/${SERVICE_USER}/.cloudbox

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable cloudbox-agent
success "cloudbox-agent.service installed and enabled."

# ---- Step 5: Offer to register -----------------------------------------------
echo ""
echo -e "${BOLD}Installation complete!${RESET}"
echo ""
echo -e "Before starting the agent, you need to register it with your CloudBox account:"
echo ""
echo -e "  ${CYAN}1.${RESET} Log in to your CloudBox dashboard"
echo -e "  ${CYAN}2.${RESET} Go to ${BOLD}Overview → Add Node${RESET}"
echo -e "  ${CYAN}3.${RESET} Copy the 6-character claim code"
echo -e "  ${CYAN}4.${RESET} Run the registration command below:"
echo ""
echo -e "  ${BOLD}sudo -u ${SERVICE_USER} API_URL=${API_URL} node ${INSTALL_DIR}/cloudbox-agent.mjs register <CLAIM_CODE>${RESET}"
echo ""

read -rp "Do you have a claim code to register right now? [y/N] " REGISTER_NOW
if [[ "${REGISTER_NOW,,}" == "y" ]]; then
  read -rp "Enter your claim code: " CLAIM_CODE
  if [[ -z "$CLAIM_CODE" ]]; then
    warn "No claim code entered. Skipping registration."
  else
    sudo -u "$SERVICE_USER" API_URL="$API_URL" GATEWAY_URL="$GATEWAY_URL" \
      node "${INSTALL_DIR}/cloudbox-agent.mjs" register "$CLAIM_CODE"
    if [[ $? -eq 0 ]]; then
      success "Agent registered! Starting service..."
      systemctl start cloudbox-agent
      systemctl status cloudbox-agent --no-pager
    fi
  fi
else
  echo ""
  echo -e "Once registered, start the agent with:"
  echo -e "  ${BOLD}sudo systemctl start cloudbox-agent${RESET}"
fi

echo ""
echo -e "View logs with: ${BOLD}sudo journalctl -u cloudbox-agent -f${RESET}"
echo ""
