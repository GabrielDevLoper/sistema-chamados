$InstallDirectory = Join-Path $env:LOCALAPPDATA "SistemaChamadosKiosk"
$ControllerTarget = Join-Path $InstallDirectory "kiosk-controller.ps1"
$StartupFile = Join-Path ([Environment]::GetFolderPath("Startup")) "SistemaChamadosKiosk.cmd"

Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" |
  Where-Object { $_.CommandLine -and $_.CommandLine.Contains($ControllerTarget) } |
  ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }

Remove-Item -Path $StartupFile -Force -ErrorAction SilentlyContinue
Remove-Item -Path $InstallDirectory -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Controlador local removido."
