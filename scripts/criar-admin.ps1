# Cria um usuário administrador no banco local (modo leve de scripts\rodar-local.ps1).
$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root "backend"
$env:DJANGO_SETTINGS_MODULE = "config.settings.dev"
$env:DJANGO_SECRET_KEY = "somente-para-uso-local-nao-use-em-producao-0123456789abcdefghij"
$env:DATABASE_URL = "sqlite:///" + ((Join-Path $backend ".local\tribuna.sqlite3") -replace "\\", "/")
$env:CACHE_BACKEND = "locmem"
$env:RESULTS_BUS = "memory"
Push-Location $backend
& (Join-Path $backend ".venv\Scripts\python.exe") manage.py createsuperuser
Pop-Location
Write-Host "Entre em http://localhost:8000/admin/ com o e-mail e a senha que você definiu."
