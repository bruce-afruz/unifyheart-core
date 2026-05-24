#!/usr/bin/env bash
# Deploy UnifyHeart to the production server.
# Usage: ./deploy/deploy.sh
set -euo pipefail

SSH_HOST="${SSH_HOST:-unifyheart}"   # uses ~/.ssh/config alias
REMOTE_DIR="/opt/unifyheart"

cd "$(dirname "$0")/.."

echo "==> [1/6] Sync source to $SSH_HOST:$REMOTE_DIR"
ssh "$SSH_HOST" "mkdir -p $REMOTE_DIR /var/log && touch /var/log/unifyheart.log && chown -R www-data:www-data /var/log/unifyheart.log"
rsync -az --delete \
  --exclude node_modules --exclude data --exclude .git --exclude .DS_Store --exclude "*.log" --exclude .env \
  ./ "$SSH_HOST:$REMOTE_DIR/"

echo "==> [2/6] Install Node.js if missing + npm install on server"
ssh "$SSH_HOST" "bash -s" <<'EOF'
set -e
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs build-essential
fi
cd /opt/unifyheart
npm install --omit=dev --no-audit --no-fund
mkdir -p data
chown -R www-data:www-data /opt/unifyheart
EOF

echo "==> [3/6] Install systemd unit"
ssh "$SSH_HOST" "install -m 0644 /opt/unifyheart/deploy/unifyheart.service /etc/systemd/system/unifyheart.service && systemctl daemon-reload && systemctl enable unifyheart"

echo "==> [4/6] Install nginx site"
ssh "$SSH_HOST" "bash -s" <<'EOF'
set -e
install -m 0644 /opt/unifyheart/deploy/unifyheart.nginx /etc/nginx/sites-available/unifyheart
ln -sf /etc/nginx/sites-available/unifyheart /etc/nginx/sites-enabled/unifyheart
nginx -t
systemctl reload nginx
EOF

echo "==> [5/6] Start/restart app"
ssh "$SSH_HOST" "systemctl restart unifyheart && sleep 2 && systemctl is-active unifyheart && curl -fs http://127.0.0.1:3001/healthz"
echo

echo "==> [6/6] Obtain/refresh TLS cert (idempotent)"
ssh "$SSH_HOST" "certbot --nginx -n --agree-tos -m hello@unifyheart.com -d unifyheart.com -d www.unifyheart.com || true"
ssh "$SSH_HOST" "systemctl reload nginx"

echo
echo "✓ Deployed. Visit https://unifyheart.com/"
