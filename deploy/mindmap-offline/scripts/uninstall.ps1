param(
  [switch]$RemoveData,
  [switch]$Quiet
)

$ErrorActionPreference = 'Continue'

$root        = Split-Path -Parent $PSScriptRoot
$logDir      = Join-Path $root 'logs'
$serverDir   = Join-Path $root 'server'
$nginxDir    = Join-Path $root 'runtimes\nginx'
$nginxExe    = Join-Path $nginxDir 'nginx.exe'
$runtimeConf = Join-Path $root 'nginx\nginx.runtime.conf'
$serverPid   = Join-Path $logDir 'server.pid'
$nginxPid    = Join-Path $logDir 'nginx.pid'
$stateFile   = Join-Path $logDir 'deploy-state.json'

function Say($message, $color = 'Gray') {
  if (-not $Quiet) { Write-Host $message -ForegroundColor $color }
}

Say "Uninstalling Mind Map deployment..." 'Cyan'

# 1. Stop services (same logic as stop.ps1, kept inline for idempotency).
if (Test-Path $nginxPid) {
  $oldPid = Get-Content $nginxPid -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($oldPid -and (Get-Process -Id $oldPid -ErrorAction SilentlyContinue)) {
    & taskkill.exe /PID $oldPid /T /F 2>$null | Out-Null
  }
  Start-Sleep -Milliseconds 300
}
if (Test-Path $nginxExe) {
  Get-Process nginx -ErrorAction SilentlyContinue | Where-Object {
    $_.Path -and $_.Path.ToLower().StartsWith($nginxDir.ToLower())
  } | ForEach-Object {
    & taskkill.exe /PID $_.Id /T /F 2>$null | Out-Null
  }
}
if (Test-Path $serverPid) {
  $oldPid = Get-Content $serverPid -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($oldPid -and (Get-Process -Id $oldPid -ErrorAction SilentlyContinue)) {
    & taskkill.exe /PID $oldPid /T /F 2>$null | Out-Null
  }
}

Say "  services stopped" 'Green'

# 2. Remove runtime-generated files. Program files and bundled runtimes stay.
Remove-Item $serverPid -Force -ErrorAction SilentlyContinue
Remove-Item $nginxPid -Force -ErrorAction SilentlyContinue
Remove-Item $runtimeConf -Force -ErrorAction SilentlyContinue
Remove-Item $stateFile -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $logDir 'server.out.log') -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $logDir 'server.err.log') -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $logDir 'server.log') -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $logDir 'nginx-error.log') -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $logDir 'nginx-access.log') -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $logDir 'nginx.out.log') -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $logDir 'nginx.err.log') -Force -ErrorAction SilentlyContinue
Say "  runtime config and logs removed" 'Green'

# 3. Remove the Windows Firewall rule created by deploy.ps1 (if any).
$firewallRules = @()
try {
  $firewallRules = @(Get-NetFirewallRule -DisplayName 'MindMap Web' -ErrorAction SilentlyContinue)
} catch {
  $firewallRules = @()
}
if ($firewallRules.Count -gt 0) {
  try {
    $firewallRules | Remove-NetFirewallRule -ErrorAction Stop
    Say "  firewall rule removed" 'Green'
  } catch {
    Say "  firewall rule not removed (run this script as administrator to remove it)" 'Yellow'
  }
}

if ($RemoveData) {
  Remove-Item (Join-Path $serverDir 'data') -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item (Join-Path $serverDir 'uploads') -Recurse -Force -ErrorAction SilentlyContinue
  Say "  data and uploads removed (-RemoveData)" 'Yellow'
} else {
  Say "  data and uploads kept (use -RemoveData to delete them)" 'Yellow'
}

Say ""
Say "Uninstall finished. This directory still contains the program files." 'Green'
Say "Delete the whole extracted directory manually if you no longer need it." 'Gray'
exit 0
