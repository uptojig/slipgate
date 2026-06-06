#!/bin/bash
# Generic VPS deployer — works with any Docker Compose project.
#
# Usage:
#   ./deploy-any.sh <IP> <ROOT_PASS> <GIT_URL> <DOMAIN> <APP_PORT> [ENV_FILE]
#
# Examples:
#   # Next.js
#   ./deploy-any.sh 1.2.3.4 'pass' https://github.com/me/mynextapp.git my.com 3000
#
#   # WordPress (image, no repo)
#   ./deploy-any.sh 1.2.3.4 'pass' wordpress:latest blog.com 80
#
#   # n8n (image)
#   ./deploy-any.sh 1.2.3.4 'pass' n8nio/n8n n8n.me 5678
#
#   # Ghost
#   ./deploy-any.sh 1.2.3.4 'pass' ghost:alpine blog.com 2368
#
# Provide ENV_FILE (local path) to copy app secrets into the deploy.

set -euo pipefail

IP="${1:?Usage: $0 <IP> <ROOT_PASS> <GIT_OR_IMAGE> <DOMAIN> <APP_PORT> [ENV_FILE]}"
PASS="${2:?root pass}"
SRC="${3:?git URL or docker image}"
DOMAIN="${4:?domain — use <ip-dashed>.sslip.io for free DNS}"
APP_PORT="${5:?internal port the app listens on}"
ENV_FILE="${6:-}"

command -v sshpass >/dev/null || { echo "brew install hudochenkov/sshpass/sshpass" >&2; exit 1; }
export SSHPASS="$PASS"
SSH_OPTS=(-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR)

# Decide: clone from git OR pull docker image
if [[ "$SRC" == *.git ]] || [[ "$SRC" == https://github.com/* ]] || [[ "$SRC" == git@* ]]; then
  MODE="git"
else
  MODE="image"
fi

echo "→ Target: $IP  domain: $DOMAIN  port: $APP_PORT  mode: $MODE  src: $SRC"

# Bootstrap script
cat > /tmp/sg-bootstrap.sh <<BOOT
#!/bin/bash
set -e

# 1. Swap
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile
  mkswap /swapfile && swapon /swapfile
  echo "/swapfile none swap sw 0 0" >> /etc/fstab
fi

# 2. Apt + Docker
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq curl ca-certificates git ufw fail2ban
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh || true
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin docker-buildx-plugin || true
fi

# 3. Firewall
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp
echo y | ufw enable
systemctl enable --now fail2ban

# 4. Project dir
mkdir -p /opt/app
cd /opt/app

# 5. Source: git clone OR pull image
MODE="$MODE"
if [ "\$MODE" = "git" ]; then
  rm -rf code && git clone "$SRC" code
  # If repo has docker-compose.yml use it; otherwise we'll write a minimal one
fi

# 6. Caddyfile
cat > Caddyfile <<CADDY
${DOMAIN} {
  reverse_proxy app:${APP_PORT}
  encode gzip
}
CADDY

# 7. docker-compose.yml — minimal, Caddy in front of whatever app
if [ "\$MODE" = "image" ]; then
  cat > docker-compose.yml <<COMPOSE
services:
  app:
    image: ${SRC}
    restart: unless-stopped
    expose: ["${APP_PORT}"]
    env_file: [.env]
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    depends_on: [app]
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
volumes:
  caddy_data:
  caddy_config:
COMPOSE
else
  # Git mode: assume repo has its own docker-compose.yml; add a Caddy override
  cd code
  cat > docker-compose.override.yml <<COMPOSE
services:
  app:
    ports: []
    expose: ["${APP_PORT}"]
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    depends_on: [app]
    ports: ["80:80", "443:443"]
    volumes:
      - ../Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
volumes:
  caddy_data:
  caddy_config:
COMPOSE
fi
BOOT

# Upload env file if provided
sshpass -e ssh "${SSH_OPTS[@]}" root@"${IP}" 'mkdir -p /opt/app'
if [ -n "$ENV_FILE" ] && [ -f "$ENV_FILE" ]; then
  if [ "$MODE" = "git" ]; then
    sshpass -e scp "${SSH_OPTS[@]}" "$ENV_FILE" root@"${IP}":/opt/app/code/.env
  else
    sshpass -e scp "${SSH_OPTS[@]}" "$ENV_FILE" root@"${IP}":/opt/app/.env
  fi
else
  # Create empty .env so docker compose doesn't complain
  sshpass -e ssh "${SSH_OPTS[@]}" root@"${IP}" 'touch /opt/app/.env /opt/app/code/.env 2>/dev/null || true'
fi

# Run bootstrap
sshpass -e scp "${SSH_OPTS[@]}" /tmp/sg-bootstrap.sh root@"${IP}":/tmp/bootstrap.sh
sshpass -e ssh "${SSH_OPTS[@]}" root@"${IP}" 'bash /tmp/bootstrap.sh'

# Start it
if [ "$MODE" = "git" ]; then
  sshpass -e ssh "${SSH_OPTS[@]}" root@"${IP}" 'cd /opt/app/code && docker compose up -d --build'
else
  sshpass -e ssh "${SSH_OPTS[@]}" root@"${IP}" 'cd /opt/app && docker compose up -d'
fi

echo
echo "✅ Deployed. https://${DOMAIN} (SSL อาจรอ 30s ขอ Let's Encrypt)"
