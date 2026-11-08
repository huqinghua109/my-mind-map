param(
  [int]$WebPort = 8080,
  [int]$ApiPort = 3000,
  [switch]$ForceSecret
)

# Version: 2026-11-08-r2 (auto-repairs legacy server.env two-line KEY=/value format)

$ErrorActionPreference = 'Stop'

$root        = Split-Path -Parent $PSScriptRoot
$serverDir   = Join-Path $root 'server'
$webDir      = Join-Path $root 'web'
$logDir      = Join-Path $root 'logs'
$configDir   = Join-Path $root 'config'
$configFile  = Join-Path $configDir 'server.env'
$nodeExe     = Join-Path $root 'runtimes\node\node.exe'
$nginxDir    = Join-Path $root 'runtimes\nginx'
$nginxExe    = Join-Path $nginxDir 'nginx.exe'
$runtimeConf = Join-Path $root 'nginx\nginx.runtime.conf'
$confRel     = '..\..\nginx\nginx.runtime.conf'
$template    = Join-Path $root 'nginx\nginx.template.conf'
$serverPid   = Join-Path $logDir 'server.pid'
$nginxPid    = Join-Path $logDir 'nginx.pid'
$stateFile   = Join-Path $logDir 'deploy-state.json'

function Write-Step($message) {
  Write-Host ""
  Write-Host "[$message]" -ForegroundColor Cyan
}

function Fail($message) {
  Write-Host "[ERROR] $message" -ForegroundColor Red
  exit 1
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

function Assert-PortFree([int]$Port, [string]$Label) {
  $owner = Get-PortOwner $Port
  if ($owner -gt 0 -and $owner -ne $PID) {
    $name = 'unknown'
    try {
      $proc = Get-Process -Id $owner -ErrorAction Stop
      $name = $proc.ProcessName
    } catch {}
    Fail "$Label port $Port is already in use by PID $owner ($name). Change the port with -WebPort / -ApiPort, or stop that process first."
  }
  if (Test-PortAccept $Port) {
    Fail "$Label port $Port is already accepting connections. Change the port with -WebPort / -ApiPort, or stop the process that owns it."
  }
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

function New-Secret {
  $bytes = New-Object byte[] 48
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $rng.GetBytes($bytes)
  $rng.Dispose()
  return (($bytes | ForEach-Object { $_.ToString('x2') }) -join '')
}

function Write-Utf8NoBom([string]$Path, [string]$Content) {
  $encoding = New-Object System.Text.UTF8Encoding -ArgumentList $false
  [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

function Get-LastLines([string]$Path, [int]$Count) {
  if (-not (Test-Path $Path)) { return '' }
  return (Get-Content $Path -Tail $Count -ErrorAction SilentlyContinue | Out-String)
}

# PowerShell 5 treats native stderr as an error record; capture it through
# Start-Process redirection instead of "2>&1" to avoid terminating the script.
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
  return @{ Code = $proc.ExitCode; Output = $text.Trim() }
}

function Invoke-BundledNode([string]$ArgLine) {
  $suffix = [guid]::NewGuid().ToString()
  $outFile = Join-Path $env:TEMP ('mm-node-' + $suffix + '.out')
  $errFile = Join-Path $env:TEMP ('mm-node-' + $suffix + '.err')
  $proc = Start-Process -FilePath $nodeExe -WorkingDirectory $root -ArgumentList $ArgLine -NoNewWindow -Wait -PassThru -RedirectStandardOutput $outFile -RedirectStandardError $errFile
  $text = ''
  if (Test-Path $outFile) { $text += (Get-Content $outFile -Raw -ErrorAction SilentlyContinue) }
  if (Test-Path $errFile) { $text += (Get-Content $errFile -Raw -ErrorAction SilentlyContinue) }
  Remove-Item $outFile -Force -ErrorAction SilentlyContinue
  Remove-Item $errFile -Force -ErrorAction SilentlyContinue
  return @{ Code = $proc.ExitCode; Output = $text.Trim() }
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
  # Clean up nginx processes launched from this package even if the pid file was lost.
  Get-Process nginx -ErrorAction SilentlyContinue | Where-Object {
    $_.Path -and $_.Path.ToLower().StartsWith($nginxDir.ToLower())
  } | ForEach-Object {
    & taskkill.exe /PID $_.Id /T /F 2>$null | Out-Null
  }
  Start-Sleep -Milliseconds 300
}

Write-Host "Mind Map one-click deploy (Windows x64)" -ForegroundColor Green
Write-Host "Package root: $root"
Write-Host "Web port: $WebPort   API port: $ApiPort"

Write-Step "1/7 Check package files and system prerequisites"
if (-not (Test-Path $nodeExe))  { Fail "Missing bundled Node.js: $nodeExe" }
if (-not (Test-Path $nginxExe)) { Fail "Missing bundled nginx: $nginxExe" }
if (-not (Test-Path $webDir))   { Fail "Missing frontend directory: $webDir" }
if (-not (Test-Path $serverDir)){ Fail "Missing backend directory: $serverDir" }
if (-not (Test-Path $template)) { Fail "Missing nginx template: $template" }

$os = $null
try { $os = Get-CimInstance Win32_OperatingSystem -ErrorAction Stop } catch {}
if ($os) {
  Write-Host ("  OS    : " + $os.Caption + " (" + $os.Version + ")")
  if ($os.Version -notlike '6.3*') {
    Write-Host "  WARN  : validated target is Windows Server 2012 R2 (6.3.9600); continuing on this OS." -ForegroundColor Yellow
  }
} else {
  Write-Host "  OS    : unable to query (Get-CimInstance unavailable)"
}

$nodeResult = Invoke-BundledNode '-v'
if ($nodeResult.Code -ne 0) {
  Fail ("bundled node.exe failed to start (exit code " + $nodeResult.Code + ").`r`n" +
    $nodeResult.Output + "`r`n" +
    "On Windows Server 2012 R2, install updates KB2919355 and KB2999226 (Universal C Runtime), " +
    "then retry. If it still fails, install the Microsoft Visual C++ 2015-2022 Redistributable (x64). " +
    "See docs/离线部署说明.md, section 7.1.")
}
$nodeVersion = $nodeResult.Output.Trim()

$nginxVersionResult = Invoke-Nginx '-v'
if ($nginxVersionResult.Code -ne 0) {
  Fail ("bundled nginx.exe failed to start.`r`n" + $nginxVersionResult.Output)
}
$nginxVersion = $nginxVersionResult.Output
Write-Host "  node  : $nodeVersion"
Write-Host "  nginx : $nginxVersion"

Write-Step "2/7 Stop previous instance (if any)"
Stop-OldServices
Write-Host "  previous instance stopped or not running"

Write-Step "3/7 Check ports"
Assert-PortFree $WebPort 'Web'
Assert-PortFree $ApiPort 'API'
Write-Host "  port $WebPort and $ApiPort are free"

Write-Step "4/7 Prepare config and directories"
New-Item -ItemType Directory -Force -Path $configDir | Out-Null
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $serverDir 'data') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $serverDir 'uploads\images') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $serverDir 'uploads\avatars') | Out-Null

$parsedEnv = Read-EnvFile $configFile
$oldEnv = $parsedEnv['Map']
if ($parsedEnv['Repaired']) {
  Write-Host "  server.env legacy format repaired: KEY= and its value line merged (values preserved)" -ForegroundColor Yellow
}
$secret = $oldEnv['JWT_SECRET']
if ($ForceSecret -or [string]::IsNullOrWhiteSpace($secret) -or $secret -match 'CHANGE_ME') {
  $secret = New-Secret
  Write-Host "  JWT_SECRET generated (not shown)"
} else {
  Write-Host "  JWT_SECRET kept from existing config"
}

$envContent = @(
  '# Mind Map backend environment variables (generated by scripts/deploy.ps1).',
  '# Keep this file ASCII-only. Restart the service after editing.',
  ('JWT_SECRET=' + $secret),
  ('PORT=' + $ApiPort),
  ('AI_BASE_URL=' + [string]$oldEnv['AI_BASE_URL']),
  ('AI_API_KEY=' + [string]$oldEnv['AI_API_KEY']),
  ('AI_MODEL=' + [string]$oldEnv['AI_MODEL'])
) -join "`r`n"
Write-Utf8NoBom $configFile ($envContent + "`r`n")

$rootFwd = $root -replace '\\', '/'
$conf = (Get-Content $template -Raw).Replace('{{WEB_PORT}}', [string]$WebPort).Replace('{{API_PORT}}', [string]$ApiPort)
Write-Utf8NoBom $runtimeConf $conf

$nginxCheck = Invoke-Nginx ('-c "' + $confRel + '" -t')
if ($nginxCheck.Code -ne 0) {
  Fail ("nginx config test failed:`r`n" + $nginxCheck.Output)
}
Write-Host "  nginx config OK -> $runtimeConf"

Write-Step "5/7 Start backend"
$parsedEnv2 = Read-EnvFile $configFile
$envVars = $parsedEnv2['Map']
foreach ($key in $envVars.Keys) {
  Set-Item -Path ("Env:" + $key) -Value $envVars[$key]
}
if (-not $env:PORT) { $env:PORT = [string]$ApiPort }

$serverOut = Join-Path $logDir 'server.out.log'
$serverErr = Join-Path $logDir 'server.err.log'
$serverProc = Start-Process -FilePath $nodeExe -ArgumentList 'index.js' -WorkingDirectory $serverDir -WindowStyle Hidden -RedirectStandardOutput $serverOut -RedirectStandardError $serverErr -PassThru
Set-Content -Path $serverPid -Value $serverProc.Id -Encoding ASCII

$healthy = $false
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Milliseconds 500
  try {
    $response = Invoke-RestMethod -Uri ("http://127.0.0.1:" + $ApiPort + "/api/health") -TimeoutSec 2
    if ($response -and $response.code -eq 0) { $healthy = $true; break }
  } catch {}
  if (-not (Get-Process -Id $serverProc.Id -ErrorAction SilentlyContinue)) { break }
}
if (-not $healthy) {
  $tail = (Get-LastLines $serverErr 30) + (Get-LastLines $serverOut 30)
  Fail "Backend did not become healthy on port $ApiPort.`r`n$tail"
}
Write-Host "  backend healthy on http://127.0.0.1:$ApiPort (PID $($serverProc.Id))"

Write-Step "6/7 Start nginx"
$nginxArgs = '-c "' + $confRel + '"'
$nginxOut = Join-Path $logDir 'nginx.out.log'
$nginxErr = Join-Path $logDir 'nginx.err.log'
Start-Process -FilePath $nginxExe -WorkingDirectory $nginxDir -ArgumentList $nginxArgs -WindowStyle Hidden -RedirectStandardOutput $nginxOut -RedirectStandardError $nginxErr | Out-Null
$nginxUp = $false
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Milliseconds 500
  if ((Get-PortOwner $WebPort) -gt 0 -or (Test-PortAccept $WebPort)) { $nginxUp = $true; break }
}
if (-not $nginxUp) {
  $tail = Get-LastLines (Join-Path $logDir 'nginx-error.log') 30
  Fail ("nginx did not listen on port $WebPort in time.`r`n" + $tail)
}
Write-Host "  nginx listening on port $WebPort"

if (Ensure-FirewallRule $WebPort) {
  Write-Host "  firewall: inbound TCP $WebPort allowed (all profiles)"
}

Write-Step "7/7 Self-check"
& $nodeExe (Join-Path $PSScriptRoot 'check-deploy.js') ("http://127.0.0.1:" + $WebPort)
$checkCode = $LASTEXITCODE

$state = [ordered]@{
  root        = $root
  webPort     = $WebPort
  apiPort     = $ApiPort
  deployedAt  = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
  nodeVersion = $nodeVersion
  nginxVersion = $nginxVersion
}
Write-Utf8NoBom $stateFile ($state | ConvertTo-Json)

Write-Host ""
if ($checkCode -eq 0) {
  Write-Host "Deployment succeeded." -ForegroundColor Green
} else {
  Write-Host "Services are running, but some self-check items failed. See logs." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Access URLs:"
Write-Host ("  local: http://127.0.0.1:" + $WebPort)
$ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.)' } |
  Select-Object -ExpandProperty IPAddress -Unique
foreach ($ip in $ips) {
  Write-Host ("  LAN  : http://" + $ip + ":" + $WebPort)
}
Write-Host ""
Write-Host "Files:"
Write-Host "  config : $configFile"
Write-Host "  data   : $(Join-Path $serverDir 'data')"
Write-Host "  uploads: $(Join-Path $serverDir 'uploads')"
Write-Host "  logs   : $logDir"
Write-Host ""
Write-Host "Stop   : powershell -ExecutionPolicy Bypass -File scripts\stop.ps1"
Write-Host "Remove : powershell -ExecutionPolicy Bypass -File scripts\uninstall.ps1"
Write-Host ""
Write-Host "If LAN clients still cannot connect, check the 'MindMap Web' firewall rule (add it as admin):"
Write-Host ("  New-NetFirewallRule -DisplayName ""MindMap Web"" -Direction Inbound -Protocol TCP -LocalPort " + $WebPort + " -Action Allow -Profile Any")

if ($checkCode -ne 0) { exit 1 }
exit 0
