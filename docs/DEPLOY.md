# Deploy do Tribuna Brasil com custo zero

Guia para colocar o Tribuna no ar numa VM gratuita, com HTTPS, deploy automático, backups e
monitoramento. Tempo estimado: 1h30 na primeira vez.

## Arquitetura

```
 Navegador ──HTTPS──► Caddy (TLS Let's Encrypt, estáticos, proxy)
                        │
                        ├── /            → frontend (PWA, arquivos estáticos)
                        └── /api, /admin → backend (Django ASGI) ──► PostgreSQL
                                                     │            └─► Redis ◄── worker + scheduler (Celery)
                                                     └── SSE (apuração ao vivo)
 Tudo em uma VM Oracle Cloud Always Free (ARM, 2 OCPU, 12 GB), via Docker Compose.
 GitHub Actions: CI → (se tudo passar) deploy por SSH.
```

## Serviços usados (todos gratuitos)

| Para quê | Serviço | Limite gratuito relevante |
|---|---|---|
| Servidor | Oracle Cloud Always Free, VM ARM Ampere A1 | 2 OCPU, 12 GB RAM, 200 GB de disco (limites desde 15/06/2026) |
| Endereço público | DuckDNS (`tribuna.duckdns.org`) | Subdomínio gratuito |
| Certificado HTTPS | Let's Encrypt, automático pelo Caddy | Sem custo |
| Código e CI/CD | GitHub + GitHub Actions | Ilimitado em repositório público |
| E-mails de conta | Brevo (SMTP) | 300 e-mails/dia |
| Monitoramento | UptimeRobot | 50 monitores, checagem a cada 5 min |
| Cópia externa de backup | Oracle Object Storage | 20 GB |

### Riscos do plano gratuito, e como lidar

- **Recuperação de VM ociosa.** A Oracle pode desligar instâncias Always Free cujo uso de CPU fique
  abaixo de 20% (percentil 95) por 7 dias, e o Tribuna fica ocioso fora da apuração. A saída é
  **converter a conta para Pay As You Go**: os recursos Always Free continuam gratuitos e deixam de ser
  recuperados. Para ter certeza de que nada será cobrado, crie um **alerta de orçamento de US$ 1**
  (passo 2) e use só recursos marcados como "Always Free".
- **Falta de capacidade ARM.** Às vezes a criação da VM falha com "Out of capacity". Tente outro
  domínio de disponibilidade ou outro horário. Os limites podem mudar: a Oracle cortou o plano pela
  metade em junho de 2026, sem anúncio.
- **E-mail sem domínio próprio.** Sem um domínio para configurar SPF e DKIM, e-mails de confirmação
  podem cair no spam. Isso se resolve com um domínio próprio (seção "Evolução").
- **Uma única máquina.** Não há redundância. Backups diários e o deploy automatizado permitem recriar
  tudo em menos de uma hora.

---

## Passo 1 — Publicar o repositório no GitHub

1. Crie o repositório `tribuna-brasil` em https://github.com/LuizRaizen (recomendado: **público**;
   CI ilimitado e coerente com um projeto de transparência. Nenhum segredo fica no código).
2. No seu computador:
   ```bash
   git remote add origin https://github.com/LuizRaizen/tribuna-brasil.git
   git push -u origin main
   ```
3. Confirme que o CI passou na aba **Actions**.

> Repositório privado também funciona: na VM, use uma *deploy key* somente leitura
> (Settings → Deploy keys) e clone por SSH.

## Passo 2 — Conta na Oracle Cloud

1. Cadastre-se em https://signup.cloud.oracle.com. O cartão é pedido só para verificação.
2. **Região principal:** escolha **Brazil East (São Paulo)** ou **Brazil Southeast (Vinhedo)**.
   Ela não pode ser trocada depois, e os recursos Always Free só existem nela.
3. Após a ativação: **Billing → Upgrade and Manage Payment → Pay As You Go** (veja "Riscos").
4. **Billing → Budgets → Create Budget:** valor US$ 1, alerta por e-mail em 1% do valor.

## Passo 3 — Criar a VM

**Compute → Instances → Create instance:**

| Campo | Valor |
|---|---|
| Image | Canonical **Ubuntu 24.04** (aarch64) |
| Shape | **VM.Standard.A1.Flex**: 2 OCPU, 12 GB (aparece como "Always Free-eligible") |
| Networking | crie uma VCN nova com sub-rede pública; marque **Assign a public IPv4 address** |
| SSH keys | envie sua chave pública (`ssh-keygen -t ed25519` se ainda não tiver) |
| Boot volume | 100 GB |

Depois: **Networking → Virtual Cloud Networks → (sua VCN) → Security Lists → Default → Add Ingress
Rules**, com origem `0.0.0.0/0`:
- TCP, porta de destino 80
- TCP, porta de destino 443
- UDP, porta de destino 443

Anote o **IP público** da VM. Para que ele não mude, use **Reserved Public IP**, que também é gratuito.

## Passo 4 — Endereço público (DuckDNS)

1. Entre em https://www.duckdns.org com sua conta GitHub.
2. Crie o subdomínio (ex.: `tribuna`) e preencha o IP público da VM.
3. Teste: `ping tribuna.duckdns.org` deve responder com o IP da VM.

## Passo 5 — Preparar a VM

```bash
ssh ubuntu@IP_DA_VM
curl -fsSL https://raw.githubusercontent.com/LuizRaizen/tribuna-brasil/main/deploy/bootstrap.sh | sudo bash
```

O script instala o Docker, configura o firewall (UFW), as atualizações automáticas de segurança, o
fail2ban e 2 GB de swap, desativa o login por senha, cria o usuário `tribuna`, clona o projeto em
`/opt/tribuna` e agenda o backup diário.

## Passo 6 — E-mail (Brevo)

1. Crie a conta em https://www.brevo.com e verifique o e-mail remetente (**Senders**).
2. **SMTP & API → SMTP:** gere uma chave SMTP.
3. No `.env` (próximo passo):
   `EMAIL_URL=smtp+tls://SEU_LOGIN:SUA_CHAVE@smtp-relay.brevo.com:587`
   `DEFAULT_FROM_EMAIL=Tribuna Brasil <o-remetente-que-voce-verificou@...>`
   - O login é o que aparece na tela **SMTP** do Brevo (algo como `8a1b2c001@smtp-brevo.com`), não o
     e-mail da conta. A senha é a **chave SMTP**, não a chave de API.
   - Dentro da URL, `@` no login vira `%40` (ex.: `8a1b2c001%40smtp-brevo.com`). Na chave, `/` vira
     `%2F` e `:` vira `%3A`.
   - O remetente precisa ser exatamente o verificado em **Senders**; outro endereço é recusado.

### Se o e-mail de confirmação não chegar

O deploy já avisa (`!! ATENÇÃO`) quando o e-mail não está configurado para envio real: sem
`EMAIL_URL`, o Django só imprime as mensagens no log (`tribuna.E001`); com remetente de exemplo, o
envio é recusado (`tribuna.E002`). Para diagnosticar:

```bash
cd /opt/tribuna
docker compose -f docker-compose.prod.yml exec backend python manage.py check --deploy
docker compose -f docker-compose.prod.yml exec backend python manage.py enviar_email_teste seu@email.com
docker compose -f docker-compose.prod.yml logs backend | grep email.send_failed
```

`enviar_email_teste` mostra o servidor e o remetente em uso e, se falhar, o erro exato do SMTP (login
recusado, remetente não verificado, porta bloqueada). Depois de corrigir o `.env`, recrie os
contêineres com `./deploy/deploy.sh`, porque `restart` não relê o arquivo. Se o teste diz "enviado" mas
nada chega, olhe a caixa de spam e o histórico em **Brevo → Transactional → Logs**.

## Passo 7 — Configurar e subir

```bash
sudo -iu tribuna
cd /opt/tribuna
cp deploy/env.prod.example .env
python3 -c "import secrets; print(secrets.token_urlsafe(50))"   # use para DJANGO_SECRET_KEY
python3 -c "import secrets; print(secrets.token_urlsafe(32))"   # use para POSTGRES_PASSWORD
nano .env                                                        # preencha tudo
./deploy/deploy.sh
```

O primeiro build leva de 5 a 10 minutos. Depois:

```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py createsuperuser
docker compose -f docker-compose.prod.yml exec backend python manage.py carregar_eleicoes_2026
```

Abra `https://tribuna.duckdns.org`. O Admin fica em `https://tribuna.duckdns.org/<DJANGO_ADMIN_URL>`.

## Passo 8 — Deploy automático pelo GitHub Actions

Na VM, crie uma chave só para o deploy:

```bash
ssh-keygen -t ed25519 -N "" -f ~/.ssh/deploy_actions
cat ~/.ssh/deploy_actions.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/deploy_actions        # conteúdo para DEPLOY_SSH_KEY
```

No seu computador: `ssh-keyscan IP_DA_VM` (conteúdo para `DEPLOY_KNOWN_HOSTS`).

No GitHub: **Settings → Environments → New environment → `production`**. Em **Secrets**, cadastre:

| Nome | Valor |
|---|---|
| `DEPLOY_HOST` | IP público da VM |
| `DEPLOY_USER` | `tribuna` |
| `DEPLOY_SSH_KEY` | chave privada `deploy_actions` |
| `DEPLOY_KNOWN_HOSTS` | saída do `ssh-keyscan` |

Em **Variables**, cadastre `SITE_URL` = `https://tribuna.duckdns.org`.

A partir daí, cada push na `main` roda o CI completo e, **só se tudo passar**, implanta. Se o
`/ready` não responder após o deploy, o script volta sozinho para a versão anterior.

## Passo 9 — Monitoramento

Em https://uptimerobot.com, crie um monitor HTTP(s) para `https://tribuna.duckdns.org/ready`
(intervalo de 5 minutos, alerta por e-mail). Ele avisa se o banco, o cache ou o site caírem.

## Passo 10 — Backup externo (recomendado)

O backup diário já fica em `/opt/tribuna/backups` (7 diários e 4 semanais). Para ter uma cópia fora da
VM:

1. Na Oracle: **Storage → Buckets → Create Bucket** (`tribuna-backups`) e **Customer Secret Keys**
   no seu perfil (compatível com S3).
2. Na VM: `sudo apt install rclone && rclone config`, criando um remoto S3 do provedor "Oracle Cloud
   Infrastructure Object Storage" chamado `oci`.
3. No `.env`: `BACKUP_RCLONE_REMOTE=oci:tribuna-backups`.

---

## Operação no dia a dia

| Tarefa | Comando (em `/opt/tribuna`, usuário `tribuna`) |
|---|---|
| Ver logs | `docker compose -f docker-compose.prod.yml logs -f --tail=100 backend worker` |
| Status dos serviços | `docker compose -f docker-compose.prod.yml ps` |
| Coletar resultados agora | `docker compose -f docker-compose.prod.yml exec backend python manage.py coletar_resultados` |
| Voltar para uma versão | `./deploy/deploy.sh <hash-do-commit>` |
| Backup manual | `./deploy/backup.sh` |
| Restaurar backup | `gunzip -c backups/daily/<arquivo>.sql.gz \| docker compose -f docker-compose.prod.yml exec -T postgres psql -U tribuna tribuna` |

## Evolução: domínio próprio + Cloudflare (~R$ 40/ano)

Quando houver orçamento para um domínio (ex.: `tribunabrasil.com.br` no Registro.br):

1. Coloque o domínio no Cloudflare (plano Free) e configure SPF/DKIM do Brevo no DNS. Os e-mails
   deixam de cair no spam.
2. **Zero Trust → Networks → Tunnels:** crie um túnel apontando para `http://caddy:80`.
3. No `.env`: `SITE_ADDRESS=":80"`, `TRUSTED_PROXY_COUNT=2`, `CLOUDFLARE_TUNNEL_TOKEN=<token>` e o
   domínio novo em `DJANGO_ALLOWED_HOSTS`, `FRONTEND_URL` e `CSRF_TRUSTED_ORIGINS`.
4. Feche as portas 80/443 na Security List: o tráfego entra só pelo túnel, com CDN e proteção
   contra DDoS do Cloudflare, e o IP do servidor deixa de ficar exposto.
