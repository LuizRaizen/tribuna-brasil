#!/usr/bin/env bash
# Atualiza e (re)inicia o Tribuna Brasil na VM. Usado manualmente e pelo GitHub Actions.
#   ./deploy/deploy.sh              # atualiza para o último commit de main
#   ./deploy/deploy.sh <commit>     # implanta um commit específico (rollback)
set -euo pipefail

cd "$(dirname "$0")/.."
REF="${1:-origin/main}"
COMPOSE=(docker compose -f docker-compose.prod.yml)
if grep -qE '^CLOUDFLARE_TUNNEL_TOKEN=.+' .env 2>/dev/null; then
  COMPOSE+=(--profile tunnel)
fi

[ -f .env ] || { echo "Arquivo .env ausente. Copie deploy/env.prod.example e preencha."; exit 1; }

previous="$(git rev-parse HEAD)"
echo "==> Código: $previous -> $REF"
git fetch --quiet origin
git checkout --quiet --detach "$REF"

echo "==> Build das imagens"
"${COMPOSE[@]}" build --pull

echo "==> Subindo serviços (migrações rodam antes do backend)"
"${COMPOSE[@]}" up -d --remove-orphans

echo "==> Verificando /ready"
for attempt in $(seq 1 30); do
  if "${COMPOSE[@]}" exec -T backend python -c \
      "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/ready').status==200 else 1)" \
      >/dev/null 2>&1; then
    echo "==> Online ($(git rev-parse --short HEAD))"
    docker image prune -f >/dev/null
    exit 0
  fi
  sleep 4
done

echo "!! /ready não respondeu. Voltando para $previous"
git checkout --quiet --detach "$previous"
"${COMPOSE[@]}" up -d --build --remove-orphans
exit 1
