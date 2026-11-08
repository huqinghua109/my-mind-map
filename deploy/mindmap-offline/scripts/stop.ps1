param(
  [switch]$Quiet
)

$ErrorActionPreference = 'Continue'

$root        = Split-Path -Parent $PSScriptRoot
$logDir      = Join-Path $root 'logs'
$nginxDir    = Join-Path $root 'runtimes\nginx'
$nginxExe    = Join-Path $nginxDir 'nginx.exe'
$nodeExe     = Join-Path $root 'runtimes\node\node.exe'
$runtimeConf = Join-Path $root 'nginx\nginx.runtime.conf'
$serverPid   = Join-Path $logDir 'server.pid'
$nginxPid    = Join-Path $logDir 'nginx.pid'

function Say($message, $color = 'Gray') {
  if (-not $Quiet) { Write-Host $message -ForegroundColor $color }
}

Say "Stopping Mind Map services..." 'Cyan'

# Stop nginx by its pid file; taskkill also covers the worker process.
if (Test-Path $nginxPid) {
  $oldPid = Get-Content $nginxPid -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($oldPid -and (Get-Process -Id $oldPid -ErrorAction SilentlyContinue)) {
    & taskkill.exe /PID $oldPid /T /F 2>$null | Out-Null
  }
  Remove-Item $nginxPid -Force -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 500
  Say "  nginx stopped" 'Green'
} else {
  Say "  nginx pid file not found, checking processes"
}

# Kill any nginx process launched from this package, even if the pid file is lost.
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
    Say "  backend stopped (PID $oldPid)" 'Green'
  } else {
    Say "  backend was not running"
  }
  Remove-Item $serverPid -Force -ErrorAction SilentlyContinue
} else {
  Say "  backend pid file not found, checking processes"
}

# Kill the bundled backend even if the pid file was lost.
if (Test-Path $nodeExe) {
  try {
    Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction Stop | Where-Object {
      $_.ExecutablePath -and $_.ExecutablePath.ToLower() -eq $nodeExe.ToLower() -and $_.CommandLine -match 'index\.js'
    } | ForEach-Object {
      & taskkill.exe /PID $_.ProcessId /T /F 2>$null | Out-Null
    }
  } catch {}
}

Say "Done." 'Green'
exit 0
