$ErrorActionPreference = "Stop"

$InstallDirectory = Join-Path $env:LOCALAPPDATA "SistemaChamadosKiosk"
$ControllerSource = Join-Path $PSScriptRoot "kiosk-controller.ps1"
$ControllerTarget = Join-Path $InstallDirectory "kiosk-controller.ps1"

if (!(Test-Path $ControllerSource)) {
  throw "O arquivo kiosk-controller.ps1 deve permanecer ao lado deste instalador."
}

Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" |
  Where-Object { $_.CommandLine -and $_.CommandLine.Contains($ControllerTarget) } |
  ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }

New-Item -ItemType Directory -Path $InstallDirectory -Force | Out-Null
Copy-Item -Path $ControllerSource -Destination $ControllerTarget -Force

Start-Process `
  -FilePath "powershell.exe" `
  -ArgumentList "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ControllerTarget`"" `
  -WindowStyle Hidden

Write-Host "Controlador instalado e iniciado com sucesso."
Write-Host "Execute este instalador novamente após reiniciar o Windows."
Write-Host "Mantenha o perfil do Chrome vertical com o nome RetiradaSenha."
