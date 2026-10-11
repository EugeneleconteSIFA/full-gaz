#!/usr/bin/env bash
# Publie La Traverse sur https://latraverse.kernse.fr (VPS partagé).
# Page : /srv/latraverse/site ; API du classement : service latraverse-api (/srv/latraverse/api).
#   ./deploy.sh            → tests du générateur, puis envoi de la page et du serveur, redémarrage de l'API
#   ./deploy.sh --server   → en plus : service systemd et config nginx (première installation)
set -euo pipefail
cd "$(dirname "$0")"

HOST="${DEPLOY_HOST:-root@168.231.85.64}"
KEY="${DEPLOY_KEY:-$HOME/.ssh/id_tloc_vps}"
SSH="ssh -i $KEY -o IdentitiesOnly=yes"

node tests/generator.test.js 120 >/dev/null
node tests/server.test.mjs >/dev/null

$SSH "$HOST" 'mkdir -p /srv/latraverse/site /srv/latraverse/api/server'
rsync -az -e "$SSH" correspondance.html "$HOST:/srv/latraverse/site/"
rsync -az -e "$SSH" server/server.mjs "$HOST:/srv/latraverse/api/server/"

if [[ "${1:-}" == "--server" ]]; then
  rsync -az -e "$SSH" server/latraverse-api.service "$HOST:/etc/systemd/system/"
  rsync -az -e "$SSH" server/nginx.conf "$HOST:/etc/nginx/sites-available/latraverse.kernse.fr"
  $SSH "$HOST" 'ln -sf /etc/nginx/sites-available/latraverse.kernse.fr /etc/nginx/sites-enabled/ \
    && systemctl daemon-reload && systemctl enable --now latraverse-api && nginx -t && systemctl reload nginx'
fi
$SSH "$HOST" 'systemctl restart latraverse-api && systemctl is-active latraverse-api'
echo "En ligne : https://latraverse.kernse.fr"
