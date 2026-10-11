# Encerra a API e o site iniciados por scripts\rodar-local.ps1.
$file = Join-Path (Split-Path -Parent $PSScriptRoot) "backend\.local\processos.txt"
if (Test-Path $file) {
    foreach ($id in (Get-Content $file) -split " ") {
        if ($id) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue }
    }
    Remove-Item $file
}
# O Vite inicia processos filhos do Node; encerra os que pertencem a este projeto.
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -match "tribuna-brasil" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Write-Host "Tribuna Brasil encerrado."
