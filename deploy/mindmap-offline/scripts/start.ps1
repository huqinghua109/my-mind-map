param(
  [int]$WebPort = 0,
  [int]$ApiPort = 0
)

# Start services without redeploying: reuse config\server.env (JWT_SECRET untouched),
# resolve ports from deploy-state.json / parameters, regenerate nginx runtime config
# only when the resolved ports differ, then run the self-check.
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\start.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\start.ps1 -WebPort 8081 -ApiPort 3001

# Version: 2026-11-08-r2 (auto-repairs legacy server.env two-line KEY=/value format)

$ErrorActionPreference = 'Continue'

$root        = Split-Path -Parent $PSScriptRoot
$logDir      = Join-Path $root 'logs'
$configDir   = Join-Path $root 'config'
$configFile  = Join-Path $configDir 'server.env'
$serverDir   = Join-Path $root 'server'
$webDir      = Join-Path $root 'web'
$nodeExe     = Join-Path $root 'runtimes\node\node.exe'
$nginxDir    = Join-Path $root 'runtimes\nginx'
$nginxExe    = Join-Path $nginxDir 'nginx.exe'
$template    = Join-Path $root 'nginx\nginx.template.conf'
$runtimeConf = Join-Path $root 'nginx\nginx.runtime.conf'
$confRel     = '..\..\nginx\nginx.runtime.conf'
$serverPid   = Join-Path $logDir 'server.pid'
$nginxPid    = Join-Path $logDir 'nginx.pid'
$stateFile   = Join-Path $logDir 'deploy-state.json'

function Say($message, $color = 'Gray') {
  Write-Host $message -ForegroundColor $color
}

function Fail($message) {
  Write-Host ""
  Write-Host "[ERROR] $message" -ForegroundColor Red
  exit 1
}

# Returns a hashtable: Map (KEY -> value), Repaired (legacy format found), Lines (merged lines).
# Legacy format: "KEY=" on one line and the raw value on the next line. Merge them so a
# value is never silently read as empty, and let callers rewrite the file.
function Read-EnvFile([string]$Path) {
  $result = @{ Map = @{}; Repaired = $false; Lines = @() }
  if (-not (Test-Path $Path)) { return $result }

  $lines = @(Get-Content $Path -ErrorAction SilentlyContinue)
  $merged = New-Object System.Collections.ArrayList
  $i = 0
  while ($i -lt $lines.Count) {
    $line = [string]$lines[$i]
    $trim = $line.Trim()
    if ($trim -match '^[A-Za-z_][A-Za-z0-9_]*=$' -and ($i + 1) -lt $lines.Count) {
      $nextTrim = ([string]$lines[$i + 1]).Trim()
      $looksLikeAssignment = $nextTrim -match '^[A-Za-z_][A-Za-z0-9_]*='
      if (-not [string]::IsNullOrWhiteSpace($nextTrim) -and -not $nextTrim.StartsWith('#') -and -not $looksLikeAssignment) {
        [void]$merged.Add($trim + $nextTrim)
        $result.Repaired = $true
        $i += 2
        continue
      }
    }
    [void]$merged.Add($line)
    $i++
  }

  foreach ($line in $merged) {
    $trim = $line.Trim()
    if ([string]::IsNullOrWhiteSpace($trim) -or $trim.StartsWith('#')) { continue }
    $index = $trim.IndexOf('=')
    if ($index -lt 1) { continue }
    $key = $trim.Substring(0, $index).Trim()
    $value = $trim.Substring($index + 1).Trim()
    if ($value.Length -ge 2) {
      $first = $value.Substring(0, 1)
      $last = $value.Substring($value.Length - 1, 1)
      if (($first -eq '"' -and $last -eq '"') -or ($first -eq "'" -and $last -eq "'")) {
        $value = $value.Substring(1, $value.Length - 2)
      }
    }
    $result.Map[$key] = $value
  }
  $result.Lines = @($merged)
  return $result
}

function Read-State([string]$Path) {
  if (-not (Test-Path $Path)) { return $null }
  try {
    $raw = (Get-Content $Path -Raw -ErrorAction Stop).Replace([string][char]0xFEFF, '')
    return ($raw | ConvertFrom-Json)
  } catch {
    return $null
  }
}

function Get-ConfPorts([string]$Path) {
  $result = @{ web = 0; api = 0 }
  if (-not (Test-Path $Path)) { return $result }
  $text = Get-Content $Path -Raw -ErrorAction SilentlyContinue
  $webMatch = [regex]::Match([string]$text, 'listen\s+(?:[0-9.]+\:)?(\d+)')
  if ($webMatch.Success) { $result.web = [int]$webMatch.Groups[1].Value }
  $apiMatch = [regex]::Match([string]$text, 'proxy_pass\s+http://127\.0\.0\.1:(\d+)')
  if ($apiMatch.Success) { $result.api = [int]$apiMatch.Groups[1].Value }
  return $result
}

function Get-PortOwner([int]$Port) {
  try {
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop | Select-Object -First 1
    if ($conn -and $conn.OwningProcess) { return [int]$conn.OwningProcess }
  } catch {}
  try {
    $lines = netstat -ano | Select-String 'LISTENING' | Select-String (':' + $Port + '\s')
    foreach ($line in $lines) {
      $parts = ($line.Line -replace '\s+', ' ').Trim().Split(' ')
      $last = $parts[$parts.Length - 1]
      if ($last -match '^\d+$') { return [int]$last }
    }
  } catch {}
  return 0
}

function Test-PortAccept([int]$Port) {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $async = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
    if (-not $async.AsyncWaitHandle.WaitOne(500)) { return $false }
    $client.EndConnect($async)
    return $true
  } catch {
    return $false
  } finally {
    try { $client.Close() } catch {}
  }
}

function Invoke-Nginx([string]$ArgLine) {
  $suffix = [guid]::NewGuid().ToString()
  $outFile = Join-Path $env:TEMP ('mm-nginx-' + $suffix + '.out')
  $errFile = Join-Path $env:TEMP ('mm-nginx-' + $suffix + '.err')
  $proc = Start-Process -FilePath $nginxExe -WorkingDirectory $nginxDir -ArgumentList $ArgLine -NoNewWindow -Wait -PassThru -RedirectStandardOutput $outFile -RedirectStandardError $errFile
  $text = ''
  if (Test-Path $outFile) { $text += (Get-Content $outFile -Raw -ErrorAction SilentlyContinue) }
  if (Test-Path $errFile) { $text += (Get-Content $errFile -Raw -ErrorAction SilentlyContinue) }
  Remove-Item $outFile -Force -ErrorAction SilentlyContinue
  Remove-Item $errFile -Force -ErrorAction SilentlyContinue
  return @{ Code = $proc.ExitCode; Output = [string]$text.Trim() }
}

function Stop-OldServices {
  if (Test-Path $nginxPid) {
    $oldPid = Get-Content $nginxPid -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($oldPid -and (Get-Process -Id $oldPid -ErrorAction SilentlyContinue)) {
      & taskkill.exe /PID $oldPid /T /F 2>$null | Out-Null
    }
    Remove-Item $nginxPid -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 300
  }
  if (Test-Path $serverPid) {
    $oldPid = Get-Content $serverPid -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($oldPid -and (Get-Process -Id $oldPid -ErrorAction SilentlyContinue)) {
      & taskkill.exe /PID $oldPid /T /F 2>$null | Out-Null
    }
    Remove-Item $serverPid -Force -ErrorAction SilentlyContinue
  }
  if (Test-Path $nginxExe) {
    Get-Process nginx -ErrorAction SilentlyContinue | Where-Object {
      $_.Path -and $_.Path.ToLower().StartsWith($nginxDir.ToLower())
    } | ForEach-Object {
      & taskkill.exe /PID $_.Id /T /F 2>$null | Out-Null
    }
  }
  Start-Sleep -Milliseconds 300
}

function Write-Utf8NoBom([string]$Path, [string]$Content) {
  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

function Test-IsAdmin {
  try {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  } catch {
    return $false
  }
}

function Ensure-FirewallRule([int]$Port) {
  $ruleName = 'MindMap Web'
  if (-not (Test-IsAdmin)) {
    Write-Host "  firewall rule skipped: not running as administrator" -ForegroundColor Yellow
    Write-Host ("  run as admin: New-NetFirewallRule -DisplayName ""$ruleName"" -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Any")
    return $false
  }
  try {
    $rules = @(Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue)
    $alreadyOk = $false
    foreach ($rule in $rules) {
      $ports = @(Get-NetFirewallPortFilter -AssociatedNetFirewallRule $rule -ErrorAction SilentlyContinue |
        ForEach-Object { [string]$_.LocalPort })
      if ($ports -contains ([string]$Port) -and $rule.Enabled -eq 'True' -and $rule.Action -eq 'Allow') {
        $alreadyOk = $true
      } else {
        Remove-NetFirewallRule -InputObject $rule -ErrorAction SilentlyContinue
      }
    }
    if (-not $alreadyOk) {
      New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Any | Out-Null
    }
    return $true
  } catch {
    Write-Host ("  firewall rule not applied: " + $_.Exception.Message) -ForegroundColor Yellow
    Write-Host ("  run as admin: New-NetFirewallRule -DisplayName ""$ruleName"" -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Any")
    return $false
  }
}

Say "Starting Mind Map services..." 'Cyan'
Say "Package root: $root"

Say ""
Say "[1/5 Check package files]"
if (-not (Test-Path $nodeExe))  { Fail "Missing bundled Node.js: $nodeExe" }
if (-not (Test-Path $nginxExe)) { Fail "Missing bundled nginx: $nginxExe" }
if (-not (Test-Path $webDir))   { Fail "Missing frontend directory: $webDir" }
if (-not (Test-Path $serverDir)){ Fail "Missing backend directory: $serverDir" }
if (-not (Test-Path $configFile)) {
  Fail "Missing config\server.env. Run scripts\deploy.ps1 once to generate it (JWT_SECRET is not regenerated by start.ps1)."
}
Say "  package files OK"

Say ""
Say "[2/5 Stop previous instance (if any)]"
Stop-OldServices
Say "  previous instance stopped or not running"

Say ""
Say "[3/5 Resolve ports and nginx config]"
$state = Read-State $stateFile
$parsedEnv = Read-EnvFile $configFile
$envMap = $parsedEnv['Map']
if ($parsedEnv['Repaired']) {
  Write-Utf8NoBom $configFile (((@($parsedEnv['Lines'])) -join "`r`n") + "`r`n")
  Say "  server.env legacy format repaired: KEY= and its value line merged (values preserved)" 'Yellow'
}
$confPorts = Get-ConfPorts $runtimeConf

$webPort = $WebPort
$webSource = 'parameter'
if ($webPort -le 0 -and $state -and $state.webPort) {
  $webPort = [int]$state.webPort
  $webSource = 'logs\deploy-state.json'
}
if ($webPort -le 0 -and $confPorts.web -gt 0) {
  $webPort = $confPorts.web
  $webSource = 'nginx.runtime.conf'
}
if ($webPort -le 0) {
  $webPort = 8080
  $webSource = 'default'
}

$apiPort = $ApiPort
$apiSource = 'parameter'
if ($apiPort -le 0 -and $envMap['PORT']) {
  $apiPort = [int]$envMap['PORT']
  $apiSource = 'config\server.env'
}
if ($apiPort -le 0 -and $state -and $state.apiPort) {
  $apiPort = [int]$state.apiPort
  $apiSource = 'logs\deploy-state.json'
}
if ($apiPort -le 0 -and $confPorts.api -gt 0) {
  $apiPort = $confPorts.api
  $apiSource = 'nginx.runtime.conf'
}
if ($apiPort -le 0) {
  $apiPort = 3000
  $apiSource = 'default'
}

Say ("  Web port: $webPort (from $webSource)")
Say ("  API port: $apiPort (from $apiSource)")

if ($webPort -eq $apiPort) {
  Fail "Web and API ports must differ (both $webPort)."
}

$needWrite = $true
if ((Test-Path $runtimeConf) -and $confPorts.web -eq $webPort -and $confPorts.api -eq $apiPort) {
  $needWrite = $false
}
if ($needWrite) {
  if (-not (Test-Path $template)) {
    Fail "Missing nginx template: $template. Cannot regenerate nginx.runtime.conf for port(s) $webPort/$apiPort. Run scripts\deploy.ps1 instead."
  }
  $conf = (Get-Content $template -Raw).Replace('{{WEB_PORT}}', [string]$webPort).Replace('{{API_PORT}}', [string]$apiPort)
  Write-Utf8NoBom $runtimeConf $conf
  Say "  nginx.runtime.conf regenerated for $webPort/$apiPort"
} else {
  Say "  nginx.runtime.conf reused"
}

$nginxCheck = Invoke-Nginx ('-c "' + $confRel + '" -t')
if ($nginxCheck.Code -ne 0) {
  Fail ("nginx config test failed:`r`n" + $nginxCheck.Output)
}
Say "  nginx config OK"

$owner = Get-PortOwner $webPort
if ($owner -gt 0) { Fail "Web port $webPort is still in use by PID $owner. Run scripts\stop.ps1 or stop that process first." }
$owner = Get-PortOwner $apiPort
if ($owner -gt 0) { Fail "API port $apiPort is still in use by PID $owner. Run scripts\stop.ps1 or stop that process first." }

New-Item -ItemType Directory -Force -Path (Join-Path $serverDir 'data') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $serverDir 'uploads\images') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $serverDir 'uploads\avatars') | Out-Null
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$secret = $envMap['JWT_SECRET']
if ([string]::IsNullOrWhiteSpace($secret) -or $secret -match 'CHANGE_ME') {
  Write-Host "  WARN  : JWT_SECRET is empty or CHANGE_ME; run scripts\deploy.ps1 to generate one." -ForegroundColor Yellow
} else {
  Say "  JWT_SECRET kept from config\server.env (not regenerated)"
}

Say ""
Say "[4/5 Start backend and nginx]"
foreach ($key in $envMap.Keys) {
  Set-Item -Path ("Env:" + $key) -Value $envMap[$key]
}
Set-Item -Path 'Env:PORT' -Value ([string]$apiPort)

$serverOut = Join-Path $logDir 'server.out.log'
$serverErr = Join-Path $logDir 'server.err.log'
$serverProc = Start-Process -FilePath $nodeExe -ArgumentList 'index.js' -WorkingDirectory $serverDir -WindowStyle Hidden -RedirectStandardOutput $serverOut -RedirectStandardError $serverErr -PassThru
Set-Content -Path $serverPid -Value $serverProc.Id -Encoding ASCII

$healthy = $false
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Milliseconds 500
  try {
    $response = Invoke-RestMethod -Uri ("http://127.0.0.1:" + $apiPort + "/api/health") -TimeoutSec 2
    if ($response -and $response.code -eq 0) { $healthy = $true; break }
  } catch {}
  if (-not (Get-Process -Id $serverProc.Id -ErrorAction SilentlyContinue)) { break }
}
if (-not $healthy) {
  $tail = (Get-Content $serverErr -Tail 30 -ErrorAction SilentlyContinue) + (Get-Content $serverOut -Tail 30 -ErrorAction SilentlyContinue)
  Fail ("Backend did not become healthy on port $apiPort.`r`n" + ($tail -join "`r`n"))
}
Say "  backend healthy on http://127.0.0.1:$apiPort (PID $($serverProc.Id))"

$nginxArgs = '-c "' + $confRel + '"'
$nginxOut = Join-Path $logDir 'nginx.out.log'
$nginxErr = Join-Path $logDir 'nginx.err.log'
Start-Process -FilePath $nginxExe -WorkingDirectory $nginxDir -ArgumentList $nginxArgs -WindowStyle Hidden -RedirectStandardOutput $nginxOut -RedirectStandardError $nginxErr | Out-Null

$nginxUp = $false
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Milliseconds 500
  if ((Get-PortOwner $webPort) -gt 0 -or (Test-PortAccept $webPort)) { $nginxUp = $true; break }
}
if (-not $nginxUp) {
  $tail = Get-Content (Join-Path $logDir 'nginx-error.log') -Tail 30 -ErrorAction SilentlyContinue
  Fail ("nginx did not listen on port $webPort in time.`r`n" + ($tail -join "`r`n"))
}
Say "  nginx listening on port $webPort"

if (Ensure-FirewallRule $webPort) {
  Say "  firewall: inbound TCP $webPort allowed (all profiles)"
}

Say ""
Say "[5/5 Self-check]"
& $nodeExe (Join-Path $PSScriptRoot 'check-deploy.js') ("http://127.0.0.1:" + $webPort)
$checkCode = $LASTEXITCODE

Say ""
if ($checkCode -eq 0) {
  Say "Services started successfully." 'Green'
} else {
  Say "Services are running, but some self-check items failed. See logs." 'Yellow'
}

Say ""
Say "Access URLs:"
Say ("  local: http://127.0.0.1:" + $webPort)
$ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.)' } |
  Select-Object -ExpandProperty IPAddress -Unique
foreach ($ip in $ips) {
  Say ("  LAN  : http://" + $ip + ":" + $webPort)
}
Say ""
Say ("Stop  : powershell -ExecutionPolicy Bypass -File " + (Join-Path $PSScriptRoot 'stop.ps1'))
Say ("Logs  : " + $logDir)

if ($checkCode -ne 0) { exit 1 }
exit 0
