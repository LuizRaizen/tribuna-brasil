#!/usr/bin/env bash
# Prepara uma VM Ubuntu 24.04 (ARM ou x86) para rodar o Tribuna Brasil. Execute UMA vez, como root:
#   curl -fsSL https://raw.githubusercontent.com/LuizRaizen/tribuna-brasil/main/deploy/bootstrap.sh | sudo bash
# ou, com o repositório já clonado:  sudo bash deploy/bootstrap.sh
set -euo pipefail

APP_USER="${APP_USER:-tribuna}"
APP_DIR="${APP_DIR:-/opt/tribuna}"
REPO_URL="${REPO_URL:-https://github.com/LuizRaizen/tribuna-brasil.git}"

echo "==> Atualizando o sistema"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get upgrade -yq
apt-get install -yq ca-certificates curl git ufw fail2ban unattended-upgrades

echo "==> Atualizações de segurança automáticas"
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "==> Docker Engine (repositório oficial)"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  # shellcheck disable=SC1091  # /etc/os-release só existe na VM de destino
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get install -yq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker

echo "==> Usuário de deploy sem senha, só com chave SSH"
if ! id "$APP_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$APP_USER"
fi
usermod -aG docker "$APP_USER"
install -d -m 700 -o "$APP_USER" -g "$APP_USER" "/home/$APP_USER/.ssh"
# Reaproveita as chaves autorizadas do usuário padrão da imagem (ubuntu/opc), se houver.
for src in /home/ubuntu/.ssh/authorized_keys /home/opc/.ssh/authorized_keys; do
  if [ -f "$src" ] && [ ! -s "/home/$APP_USER/.ssh/authorized_keys" ]; then
    install -m 600 -o "$APP_USER" -g "$APP_USER" "$src" "/home/$APP_USER/.ssh/authorized_keys"
  fi
done

echo "==> SSH: sem senha e sem login de root"
cat > /etc/ssh/sshd_config.d/90-tribuna.conf <<'EOF'
PasswordAuthentication no
PermitRootLogin no
KbdInteractiveAuthentication no
EOF
systemctl reload ssh || systemctl reload sshd || true

echo "==> Firewall"
# As imagens Ubuntu da Oracle trazem regras iptables que bloqueiam 80/443; o UFW as substitui.
if [ -f /etc/iptables/rules.v4 ]; then
  iptables -F INPUT || true
  rm -f /etc/iptables/rules.v4 /etc/iptables/rules.v6
fi
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

echo "==> Swap de 2 GB (folga para builds)"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo "/swapfile none swap sw 0 0" >> /etc/fstab
fi

echo "==> Código da aplicação em $APP_DIR"
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR"
fi
install -d -o "$APP_USER" -g "$APP_USER" "$APP_DIR/backups"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

echo "==> Backup diário do banco às 03:30"
cat > /etc/cron.d/tribuna-backup <<EOF
30 3 * * * $APP_USER cd $APP_DIR && ./deploy/backup.sh >> $APP_DIR/backups/backup.log 2>&1
EOF

cat <<EOF

Pronto. Próximos passos (como $APP_USER):
  sudo -iu $APP_USER
  cd $APP_DIR
  cp deploy/env.prod.example .env && nano .env     # preencha os valores
  ./deploy/deploy.sh
EOF
