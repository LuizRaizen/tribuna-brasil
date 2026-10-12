# Roda o Tribuna Brasil no seu computador, sem Docker, com os dados reais do TSE.
#
#   powershell -ExecutionPolicy Bypass -File scripts\rodar-local.ps1
#
# Na primeira execucao: cria o ambiente, instala dependencias e baixa os dados do TSE (alguns
# minutos). Nas seguintes: so sobe o app. Use -Recarregar para baixar os dados de novo.
#
# Modo leve: SQLite em vez de PostgreSQL e cache em memoria em vez de Redis. Serve para ver e
# testar o app; producao usa a stack completa (docker-compose.prod.yml).
param(
    [switch]$Recarregar,
    [switch]$SemNavegador,
    [switch]$Oculto
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"
$local = Join-Path $backend ".local"
New-Item -ItemType Directory -Force $local | Out-Null

function Step($text) { Write-Host "`n==> $text" -ForegroundColor Cyan }

# --- Configuração do modo leve (vale para este processo e para as janelas que ele abrir) ----------
$env:DJANGO_SETTINGS_MODULE = "config.settings.dev"
$env:DJANGO_SECRET_KEY = "somente-para-uso-local-nao-use-em-producao-0123456789abcdefghij"
$env:IDENTITY_HASH_KEY = "chave-local-de-identidade-nao-use-em-producao"
$env:DATABASE_URL = "sqlite:///" + ((Join-Path $local "tribuna.sqlite3") -replace "\\", "/")
$env:MEDIA_ROOT = (Join-Path $local "media")
$env:CACHE_BACKEND = "locmem"
$env:RESULTS_BUS = "memory"
$env:EMAIL_URL = "consolemail://"
$env:FRONTEND_URL = "http://localhost:5173"
$env:CSRF_TRUSTED_ORIGINS = "http://localhost:5173"
$env:DJANGO_ALLOWED_HOSTS = "localhost,127.0.0.1"
$env:LOG_LEVEL = "WARNING"
$env:PYTHONIOENCODING = "utf-8"
$python = Join-Path $backend ".venv\Scripts\python.exe"

# --- Dependências -------------------------------------------------------------------------------
if (-not (Test-Path $python)) {
    Step "Criando o ambiente Python (uma vez só)"
    python -m venv (Join-Path $backend ".venv")
    & $python -m pip install -q --upgrade pip
    & $python -m pip install -q -e "$backend[dev]"
}
if (-not (Test-Path (Join-Path $frontend "node_modules"))) {
    Step "Instalando as dependências do frontend (uma vez só)"
    Push-Location $frontend; npm install --no-fund --no-audit; Pop-Location
}

# --- Banco e dados -------------------------------------------------------------------------------
Push-Location $backend
try {
    Step "Preparando o banco de dados"
    & $python manage.py migrate -v 0

    $marker = Join-Path $local "dados-carregados.txt"
    if ($Recarregar -or -not (Test-Path $marker)) {
        Step "Carregando as Eleições 2026 a partir do índice oficial do TSE"
        & $python manage.py carregar_eleicoes_2026
        Step "Baixando os resultados do 1º turno (presidente e governadores)"
        & $python manage.py coletar_resultados --turno 1 | Select-Object -Last 3
        Step "Importando candidaturas, bens declarados e histórico (Portal de Dados Abertos do TSE)"
        & $python manage.py importar_candidaturas --ano 2026
        Step "Baixando propostas de governo (presidente e São Paulo; outras UFs: importar_propostas --uf RJ,MG)"
        & $python manage.py importar_propostas --ano 2026 --uf BR,SP
        Step "Baixando a prestação de contas de campanha (arquivo de ~190 MB; leva alguns minutos)"
        & $python manage.py importar_contas --ano 2026
        Step "Importando deputados, votos, proposições e cota parlamentar (Câmara; na primeira vez leva uns 15 minutos)"
        & $python manage.py importar_camara --anos 2026
        Set-Content -Path $marker -Value (Get-Date -Format s)
    } else {
        Write-Host "Dados já carregados. Use -Recarregar para baixar de novo."
    }
} finally {
    Pop-Location
}

# --- Subir os servidores --------------------------------------------------------------------------
$style = if ($Oculto) { "Hidden" } else { "Normal" }
# Uma execução anterior ainda aberta seguraria as portas e serviria código antigo: encerra antes.
& (Join-Path $PSScriptRoot "parar-local.ps1") | Out-Null
foreach ($port in 8000, 5173) {
    $busy = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($busy) {
        $owner = (Get-Process -Id $busy[0].OwningProcess -ErrorAction SilentlyContinue).ProcessName
        throw "A porta $port está em uso por outro programa ($owner). Feche-o e rode o script de novo."
    }
}
Step "Subindo a API (http://localhost:8000) e o site (http://localhost:5173)"
$api = Start-Process -FilePath $python -WorkingDirectory $backend -WindowStyle $style -PassThru `
    -ArgumentList "-m", "uvicorn", "config.asgi:application", "--host", "127.0.0.1", "--port", "8000"
$web = Start-Process -FilePath "npm.cmd" -WorkingDirectory $frontend -WindowStyle $style -PassThru `
    -ArgumentList "run", "dev", "--", "--port", "5173", "--strictPort"
Set-Content -Path (Join-Path $local "processos.txt") -Value "$($api.Id) $($web.Id)"

# Aguarda o site responder.
$ready = $false
foreach ($i in 1..40) {
    try {
        Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 "http://127.0.0.1:5173/" | Out-Null
        Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 "http://127.0.0.1:8000/health" | Out-Null
        $ready = $true; break
    } catch { Start-Sleep -Seconds 1 }
}
if (-not $ready) { Write-Host "Os servidores demoraram a responder; veja as janelas abertas." -ForegroundColor Yellow }

Write-Host @"

Tribuna Brasil rodando em http://localhost:5173

  Apuração ............ http://localhost:5173/apuracao
  Busca ............... http://localhost:5173/busca
  Candidaturas ........ http://localhost:5173/candidaturas
  Admin ............... http://localhost:8000/admin/
  Documentação da API . http://localhost:8000/api/v1/docs/

E-mails (confirmação de conta, senha) aparecem na janela da API.
Para criar um administrador:  scripts\criar-admin.ps1
Para parar:                   scripts\parar-local.ps1  (ou feche as duas janelas)
"@ -ForegroundColor Green

if (-not $SemNavegador) { Start-Process "http://localhost:5173" }
