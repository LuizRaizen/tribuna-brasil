# Encerra a API e o site iniciados por scripts\rodar-local.ps1.
$file = Join-Path (Split-Path -Parent $PSScriptRoot) "backend\.local\processos.txt"
if (Test-Path $file) {
    foreach ($id in (Get-Content $file) -split " ") {
        if ($id) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue }
    }
    Remove-Item $file
}
# O Vite inicia processos filhos do Node, e o python.exe do ambiente virtual inicia um segundo
# interpretador. Encerrar só o processo registrado deixaria esses filhos vivos, ocupando as portas.
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -match "tribuna-brasil" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
    Where-Object { $_.CommandLine -match "tribuna-brasil" -and $_.CommandLine -match "uvicorn" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Write-Host "Tribuna Brasil encerrado."
