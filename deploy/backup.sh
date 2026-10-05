#!/usr/bin/env bash
# Backup do PostgreSQL: dump comprimido e rotação (7 diários + 4 semanais).
# Restauração: gunzip -c backups/<arquivo>.sql.gz | docker compose -f docker-compose.prod.yml exec -T postgres psql -U tribuna tribuna
# Cópia externa (recomendado): defina BACKUP_RCLONE_REMOTE no .env (ex.: "oci:tribuna-backups")
# e configure o rclone para o Object Storage gratuito da Oracle, Google Drive etc.
set -euo pipefail

cd "$(dirname "$0")/.."
# Lê só o necessário (o .env tem valores com espaços que não podem ser "sourced" pelo shell).
env_value() { grep -E "^$1=" .env | tail -n1 | cut -d= -f2-; }
POSTGRES_USER="$(env_value POSTGRES_USER)"
POSTGRES_DB="$(env_value POSTGRES_DB)"
BACKUP_RCLONE_REMOTE="$(env_value BACKUP_RCLONE_REMOTE)"
mkdir -p backups/daily backups/weekly

stamp="$(date +%Y-%m-%d_%H%M)"
file="backups/daily/tribuna_${stamp}.sql.gz"
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-tribuna}" --no-owner --clean --if-exists "${POSTGRES_DB:-tribuna}" \
  | gzip -9 > "$file"

# Domingo: guarda também uma cópia semanal.
if [ "$(date +%u)" = "7" ]; then cp "$file" backups/weekly/; fi

# Mantém os N mais recentes de cada pasta (ordenados pela data de modificação).
prune() {
  find "$1" -maxdepth 1 -name '*.sql.gz' -printf '%T@ %p\n' \
    | sort -rn | tail -n +"$(($2 + 1))" | cut -d' ' -f2- | xargs -r rm --
}
prune backups/daily 7
prune backups/weekly 4

if [ -n "${BACKUP_RCLONE_REMOTE:-}" ] && command -v rclone >/dev/null; then
  rclone copy backups "$BACKUP_RCLONE_REMOTE" --include "*.sql.gz"
fi
echo "$(date -Is) backup ok: $file ($(du -h "$file" | cut -f1))"
