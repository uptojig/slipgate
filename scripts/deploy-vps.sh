#!/bin/bash
# Usage: ./deploy-vps.sh <IP> <ROOT_PASSWORD> [DOMAIN]
#
# Deploys SlipGate to a fresh Ubuntu/Debian VPS in one shot:
#   • adds 2GB swap
#   • installs Docker + UFW + fail2ban
#   • clones the repo, configures .env, runs migrations
#   • puts Caddy in front for automatic Let's Encrypt SSL
#
# DOMAIN defaults to <IP-dashed>.sslip.io (free public DNS) so you can
# launch sites without buying a domain. Provide your own when ready.

set -euo pipefail

IP="${1:?Usage: $0 <IP> <ROOT_PASSWORD> [DOMAIN] [TMN_PHONE]}"
PASS="${2:?root password required}"
DEFAULT_DOMAIN="${IP//./-}.sslip.io"
DOMAIN="${3:-$DEFAULT_DOMAIN}"
TMN_PHONE="${4:-0800000000}"

PG_PASS="pg_$(openssl rand -hex 12)"
AUTH_SECRET="$(openssl rand -hex 32)"

command -v sshpass >/dev/null || {
  echo "Need sshpass. Install: brew install hudochenkov/sshpass/sshpass" >&2
  exit 1
}

SSH_OPTS=(-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -o ConnectTimeout=10)
SSH="sshpass -e ssh ${SSH_OPTS[*]} root@${IP}"
SCP="sshpass -e scp ${SSH_OPTS[*]}"
export SSHPASS="$PASS"

echo "→ Target: ${IP}  domain: ${DOMAIN}"

cat > /tmp/sg-bootstrap.sh <<BOOT
#!/bin/bash
set -e

if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile
  mkswap /swapfile && swapon /swapfile
  echo "/swapfile none swap sw 0 0" >> /etc/fstab
fi

apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq curl ca-certificates git ufw fail2ban

if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
  # bionic skips docker-model-plugin; install core packages only if script
  # failed before binaries landed
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin docker-buildx-plugin || true
fi

ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
echo y | ufw enable
systemctl enable --now fail2ban

rm -rf /opt/slipgate
git clone https://github.com/uptojig/slipgate.git /opt/slipgate
cd /opt/slipgate

cat > .env <<ENV
DATABASE_URL=postgres://postgres:${PG_PASS}@postgres:5432/slipgate
AUTH_SECRET=${AUTH_SECRET}
AUTH_URL=https://${DOMAIN}
NEXT_PUBLIC_APP_URL=https://${DOMAIN}
NEXT_PUBLIC_ADMIN_TMN_PHONE=${TMN_PHONE}
SLIP_OCR_MODEL=anthropic/claude-haiku-4-5

# Fill these in after deploy from EasyPanel dashboard or .env edit
TMN_WEBHOOK_AUTH_KEY=
TMN_WEBHOOK_JWT_SECRET=
TMN_P2P_VALIDATE_TOKEN=
TMN_LAST_RECEIVE_TOKEN=
TMN_BALANCE_TOKEN=
TMN_TRANSFER_LINK_TOKEN=
TMN_QR_INFO_TOKEN=
AI_GATEWAY_API_KEY=

POSTGRES_PASSWORD=${PG_PASS}
ENV

cat > docker-compose.override.yml <<COMPOSE
services:
  postgres:
    environment:
      POSTGRES_PASSWORD: \\\${POSTGRES_PASSWORD}
    ports: []
  app:
    environment:
      DATABASE_URL: postgres://postgres:\\\${POSTGRES_PASSWORD}@postgres:5432/slipgate
    ports: []
    expose: ["3000"]
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

cat > Caddyfile <<CADDY
${DOMAIN} {
  reverse_proxy app:3000
  encode gzip
}
CADDY

docker compose up -d --build

# DB migration via one-shot container
sleep 5
. .env
docker run --rm --network slipgate_default \
  -v /opt/slipgate:/app:ro -v /tmp/sg-work:/work -w /work \
  -e DATABASE_URL="postgres://postgres:\${POSTGRES_PASSWORD}@postgres:5432/slipgate" \
  node:20-slim bash -c "
    cp -r /app/src /app/drizzle.config.ts /app/package.json /app/package-lock.json /work/
    cd /work
    npm install --silent drizzle-kit drizzle-orm postgres tsx
    npx drizzle-kit push --config=./drizzle.config.ts
  "
BOOT

$SCP /tmp/sg-bootstrap.sh "root@${IP}:/tmp/sg-bootstrap.sh"
$SSH 'bash /tmp/sg-bootstrap.sh'

echo
echo "✅ Done. Visit: https://${DOMAIN}"
echo "   .env saved on VPS: /opt/slipgate/.env"
echo "   PG_PASS=${PG_PASS}"
echo "   AUTH_SECRET=${AUTH_SECRET}"
echo
echo "Fill in TMN_* tokens in /opt/slipgate/.env then:"
echo "   ssh root@${IP} 'cd /opt/slipgate && docker compose restart app'"
