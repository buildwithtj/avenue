#!/usr/bin/env bash
# Deploys the integration host to the client-supplied AWS Ubuntu instance. Safe to re-run. Contains NO secrets.
# Needs a DNS name for HTTPS (Stripe refuses plain-HTTP webhook URLs): DOMAIN defaults to the sslip.io name of the IP, fine for TEST MODE only; use a real domain before any live use.
# Usage: KEY=/path/to/key.pem HOST=13.207.228.174 ./deploy.sh
# Secrets (Stripe webhook signing secret) are NOT sent by this script: put them in /etc/avenue/host.env on the server yourself.
set -euo pipefail
: "${KEY:?set KEY to the ssh private key path}" ; : "${HOST:?set HOST}"
SSH=(ssh -i "$KEY" -o BatchMode=yes ubuntu@"$HOST")
DOMAIN="${DOMAIN:-$(echo "$HOST" | tr . -).sslip.io}"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
"${SSH[@]}" 'sudo apt-get update -qq && sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs rsync ufw caddy >/dev/null && node --version'
"${SSH[@]}" 'id avenue >/dev/null 2>&1 || sudo useradd --system --home /opt/avenue --shell /usr/sbin/nologin avenue; sudo mkdir -p /opt/avenue/apps /var/lib/avenue /etc/avenue; sudo chown -R ubuntu:ubuntu /opt/avenue; sudo chown avenue:avenue /var/lib/avenue; sudo chmod 700 /var/lib/avenue'
for d in integration-host billing-core sensors-core; do
  rsync -az --delete --exclude '*.test.mjs' --exclude node_modules -e "ssh -i $KEY -o BatchMode=yes" "$ROOT/apps/$d/" ubuntu@"$HOST":/opt/avenue/apps/$d/
done
"${SSH[@]}" 'sudo chown -R root:root /opt/avenue && sudo chmod -R go-w /opt/avenue
if [ ! -f /etc/avenue/host.env ]; then printf "PORT=8080\nHOST=127.0.0.1\nDB_PATH=/var/lib/avenue/host.db\nHOST_VERSION=1\nALLOWED_ACCOUNTS=\nSTRIPE_WEBHOOK_SECRET=\n" | sudo tee /etc/avenue/host.env >/dev/null; fi
for k in STRIPE_SECRET_KEY= STRIPE_ACCOUNT= BRIDGE_KEY= SP_BRIDGE_APPLICANTS= SP_BRIDGE_MEMBERS= SP_BRIDGE_INVOICES= SP_BRIDGE_LEDGER= SP_BRIDGE_GRANT= PORTAL_URL= PUBLIC_BASE_URL= JOIN_PUBLIC=1 APPLICATION_DAYS=14 SWIFT_API_KEY= SWIFT_USER= SWIFT_PASSWORD= SWIFT_BASE_URL= SP_BRIDGE_SENSORS= SP_BRIDGE_SENSOR_LATEST= SP_BRIDGE_SENSOR_HOURLY= SP_BRIDGE_EXCURSIONS= SWIFT_POLL_MINUTES=; do sudo grep -q "^${k%%=*}=" /etc/avenue/host.env || echo "$k" | sudo tee -a /etc/avenue/host.env >/dev/null; done
sudo sed -i "s/^PORT=.*/PORT=8080/" /etc/avenue/host.env; sudo grep -q "^HOST=" /etc/avenue/host.env || echo HOST=127.0.0.1 | sudo tee -a /etc/avenue/host.env >/dev/null
sudo chown root:root /etc/avenue/host.env; sudo chmod 600 /etc/avenue/host.env'
scp -q -i "$KEY" "$ROOT/apps/integration-host/deploy/avenue-host.service" ubuntu@"$HOST":/tmp/avenue-host.service
"${SSH[@]}" 'sudo mv /tmp/avenue-host.service /etc/systemd/system/avenue-host.service && sudo systemctl daemon-reload && sudo systemctl enable avenue-host >/dev/null 2>&1 && sudo systemctl restart avenue-host
sudo ufw allow 22/tcp >/dev/null && sudo ufw allow 80/tcp >/dev/null && sudo ufw allow 443/tcp >/dev/null && sudo ufw --force enable >/dev/null
printf "%s {\n  reverse_proxy 127.0.0.1:8080\n}\n" "'"$DOMAIN"'" | sudo tee /etc/caddy/Caddyfile >/dev/null; sudo systemctl enable caddy >/dev/null 2>&1; sudo systemctl restart caddy
sleep 3; systemctl is-active avenue-host caddy; curl -s localhost:8080/api/health'
echo "HTTPS: https://$DOMAIN/api/health"
