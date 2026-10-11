#!/usr/bin/env bash
# Publie Correspondance sur https://correspondance.kernse.fr (VPS partagé).
# Page : /srv/correspondance/site ; API du classement : service correspondance-api (/srv/correspondance/api).
#   ./deploy.sh            → tests du générateur, puis envoi de la page et du serveur, redémarrage de l'API
#   ./deploy.sh --server   → en plus : service systemd et config nginx (première installation)
set -euo pipefail
cd "$(dirname "$0")"

HOST="${DEPLOY_HOST:-root@168.231.85.64}"
KEY="${DEPLOY_KEY:-$HOME/.ssh/id_tloc_vps}"
SSH="ssh -i $KEY -o IdentitiesOnly=yes"

node tests/generator.test.js 120 >/dev/null
node tests/server.test.mjs >/dev/null

$SSH "$HOST" 'mkdir -p /srv/correspondance/site /srv/correspondance/api/server'
rsync -az -e "$SSH" correspondance.html "$HOST:/srv/correspondance/site/"
rsync -az -e "$SSH" server/server.mjs "$HOST:/srv/correspondance/api/server/"

if [[ "${1:-}" == "--server" ]]; then
  rsync -az -e "$SSH" server/correspondance-api.service "$HOST:/etc/systemd/system/"
  rsync -az -e "$SSH" server/nginx.conf "$HOST:/etc/nginx/sites-available/correspondance.kernse.fr"
  $SSH "$HOST" 'ln -sf /etc/nginx/sites-available/correspondance.kernse.fr /etc/nginx/sites-enabled/ \
    && systemctl daemon-reload && systemctl enable --now correspondance-api && nginx -t && systemctl reload nginx'
fi
$SSH "$HOST" 'systemctl restart correspondance-api && systemctl is-active correspondance-api'
echo "En ligne : https://correspondance.kernse.fr"
