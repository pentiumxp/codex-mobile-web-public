param(
  [string]$TaskName = "Codex Mobile Web",
  [string]$WorkspacePath = (Split-Path -Parent $MyInvocation.MyCommand.Path),
  [string]$UserProfilePath = $env:USERPROFILE,
  [string]$ProfileId = "",
  [string]$CodexHome = "",
  [int]$Port = 8787,
  [int]$MaxWaitSeconds = 45,
  [switch]$NoStart,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Resolve-ExistingPath {
  param([string]$Path)
  if ([string]::IsNullOrWhiteSpace($Path)) {
    return $null
  }
  try {
    return (Resolve-Path -LiteralPath $Path -ErrorAction Stop).Path
  } catch {
    return [System.IO.Path]::GetFullPath($Path)
  }
}

function Test-ContainsPath {
  param(
    [string]$CommandLine,
    [string]$Path
  )
  if ([string]::IsNullOrWhiteSpace($CommandLine) -or [string]::IsNullOrWhiteSpace($Path)) {
    return $false
  }
  return $CommandLine.IndexOf($Path, [System.StringComparison]::OrdinalIgnoreCase) -ge 0
}

function Resolve-CodexHomeFromProfile {
  param(
    [string]$RequestedProfileId,
    [string]$RequestedCodexHome,
    [string]$RuntimePath,
    [string]$ProfilePath
  )

  if (-not [string]::IsNullOrWhiteSpace($RequestedCodexHome)) {
    return [System.IO.Path]::GetFullPath($RequestedCodexHome)
  }

  $storePath = Join-Path $RuntimePath "codex-profiles.json"
  $profile = if ([string]::IsNullOrWhiteSpace($RequestedProfileId)) { "" } else { $RequestedProfileId.Trim().ToLowerInvariant() }

  if ([string]::IsNullOrWhiteSpace($profile) -and (Test-Path -LiteralPath $storePath)) {
    try {
      $store = Get-Content -LiteralPath $storePath -Raw -Encoding UTF8 | ConvertFrom-Json
      $profile = ([string]$store.activeProfileId).Trim().ToLowerInvariant()
    } catch {
      $profile = ""
    }
  }

  if ([string]::IsNullOrWhiteSpace($profile) -or $profile -eq "default") {
    return (Join-Path $ProfilePath ".codex")
  }
  if ($profile -eq "current" -or $profile -eq "previous") {
    return (Join-Path (Join-Path $ProfilePath ".codex-homes") $profile)
  }

  if (Test-Path -LiteralPath $storePath) {
    try {
      $store = Get-Content -LiteralPath $storePath -Raw -Encoding UTF8 | ConvertFrom-Json
      foreach ($item in @($store.profiles)) {
        if ([string]$item.id -eq $profile -and -not [string]::IsNullOrWhiteSpace([string]$item.codexHome)) {
          return [System.IO.Path]::GetFullPath([string]$item.codexHome)
        }
      }
    } catch {
      throw "Failed to read Codex profile store ${storePath}: $($_.Exception.Message)"
    }
  }

  throw "Unknown Codex profile '$RequestedProfileId'. Use default/current/previous or pass -CodexHome."
}

$WorkspacePath = Resolve-ExistingPath $WorkspacePath
$UserProfilePath = Resolve-ExistingPath $UserProfilePath
$RuntimeRoot = Join-Path $UserProfilePath ".codex-mobile-web"
$CodexHome = Resolve-CodexHomeFromProfile -RequestedProfileId $ProfileId -RequestedCodexHome $CodexHome -RuntimePath $RuntimeRoot -ProfilePath $UserProfilePath
$EndpointFile = Join-Path $CodexHome "app-server-mux\endpoint.json"
$LogPath = Join-Path $RuntimeRoot "shared-chain-restart.log"

$ServerPath = Join-Path $WorkspacePath "server.js"
$MuxScriptPath = Join-Path $WorkspacePath "codex-app-server-mux.js"
$MuxExePath = Join-Path $WorkspacePath "codex-app-server-mux.exe"
$WindowlessLauncherPath = Join-Path $WorkspacePath "start-codex-mobile-web-windowless.ps1"
$HiddenLauncherPath = Join-Path $WorkspacePath "start-codex-mobile-web-hidden.vbs"
$RuntimeCodexExePath = Join-Path $RuntimeRoot "codex.exe"

if (-not (Test-Path -LiteralPath $RuntimeRoot)) {
  if (-not $DryRun) {
    New-Item -ItemType Directory -Path $RuntimeRoot -Force | Out-Null
  }
}

function Write-RestartLog {
  param([string]$Message)
  $line = "{0} {1}" -f (Get-Date).ToString("yyyy-MM-dd HH:mm:ss.fff"), $Message
  Write-Host $line
  if (-not $DryRun) {
    Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8
  }
}

function Get-EndpointProcessIds {
  if (-not (Test-Path -LiteralPath $EndpointFile)) {
    return @()
  }

  try {
    $endpoint = Get-Content -LiteralPath $EndpointFile -Raw | ConvertFrom-Json
    $ids = @()
    foreach ($value in @($endpoint.pid, $endpoint.childPid)) {
      if ($value -and [int]$value -gt 0) {
        $ids += [int]$value
      }
    }
    return @($ids | Select-Object -Unique)
  } catch {
    Write-RestartLog "Failed to read endpoint process ids from '$EndpointFile': $($_.Exception.Message)"
    return @()
  }
}

function Get-TargetProcesses {
  $endpointProcessIds = Get-EndpointProcessIds
  $processes = Get-CimInstance Win32_Process | Where-Object {
    $name = $_.Name
    $cmd = $_.CommandLine
    if ($_.ProcessId -eq $PID -or [string]::IsNullOrWhiteSpace($cmd)) {
      return $false
    }

    if ($name -ieq "wscript.exe" -and (Test-ContainsPath $cmd $HiddenLauncherPath)) {
      return $true
    }
    if ($name -ieq "powershell.exe" -and (Test-ContainsPath $cmd $WindowlessLauncherPath)) {
      return $true
    }
    if ($name -ieq "node.exe" -and (Test-ContainsPath $cmd $ServerPath)) {
      return $true
    }
    if ($endpointProcessIds -contains [int]$_.ProcessId) {
      if ($name -ieq "node.exe" -and (Test-ContainsPath $cmd $MuxScriptPath)) {
        return $true
      }
      if ($name -ieq "codex-app-server-mux.exe" -and (Test-ContainsPath $cmd $MuxExePath)) {
        return $true
      }
      if ($name -ieq "codex.exe" -and (Test-ContainsPath $cmd $RuntimeCodexExePath) -and ($cmd -match "(^|\s)app-server(\s|$)")) {
        return $true
      }
    }
    return $false
  }

  return @($processes | Sort-Object ProcessId)
}

function Stop-MobileTask {
  try {
    $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
  } catch {
    Write-RestartLog "Scheduled task '$TaskName' was not found; continuing with process cleanup."
    return
  }

  if ($DryRun) {
    Write-RestartLog "Dry run: would stop scheduled task '$TaskName' (state: $($task.State))."
    return
  }

  if ($task.State -eq "Running") {
    Write-RestartLog "Stopping scheduled task '$TaskName'."
    Stop-ScheduledTask -TaskName $TaskName
    Start-Sleep -Seconds 2
  } else {
    Write-RestartLog "Scheduled task '$TaskName' is $($task.State); no task stop needed."
  }
}

function Stop-TargetProcesses {
  $targets = Get-TargetProcesses
  if ($targets.Count -eq 0) {
    Write-RestartLog "No matching Codex Mobile Web shared-chain processes found."
    return
  }

  foreach ($proc in $targets) {
    $summary = "{0} pid={1}" -f $proc.Name, $proc.ProcessId
    if ($DryRun) {
      Write-RestartLog "Dry run: would stop $summary."
      continue
    }

    try {
      Write-RestartLog "Stopping $summary."
      Stop-Process -Id $proc.ProcessId -Force -ErrorAction Stop
    } catch {
      Write-RestartLog "Failed to stop ${summary}: $($_.Exception.Message)"
    }
  }
}

function Remove-EndpointFile {
  if (-not (Test-Path -LiteralPath $EndpointFile)) {
    Write-RestartLog "Mux endpoint file is already absent."
    return
  }

  if ($DryRun) {
    Write-RestartLog "Dry run: would remove mux endpoint file '$EndpointFile'."
    return
  }

  try {
    Remove-Item -LiteralPath $EndpointFile -Force
    Write-RestartLog "Removed mux endpoint file '$EndpointFile'."
  } catch {
    Write-RestartLog "Failed to remove endpoint file '$EndpointFile': $($_.Exception.Message)"
  }
}

function Start-MobileTask {
  if ($NoStart) {
    Write-RestartLog "NoStart was set; startup skipped."
    return
  }

  if ($DryRun) {
    Write-RestartLog "Dry run: would start scheduled task '$TaskName'."
    return
  }

  Write-RestartLog "Starting scheduled task '$TaskName'."
  Start-ScheduledTask -TaskName $TaskName
}

function Test-HttpReady {
  try {
    $response = Invoke-WebRequest -Uri ("http://127.0.0.1:{0}/" -f $Port) -UseBasicParsing -TimeoutSec 3
    return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500)
  } catch {
    return $false
  }
}

function Test-EndpointReady {
  if (-not (Test-Path -LiteralPath $EndpointFile)) {
    return $false
  }
  try {
    $endpoint = Get-Content -LiteralPath $EndpointFile -Raw | ConvertFrom-Json
    if (-not $endpoint.port) {
      return $false
    }
    $client = [System.Net.Sockets.TcpClient]::new()
    try {
      $async = $client.BeginConnect("127.0.0.1", [int]$endpoint.port, $null, $null)
      if (-not $async.AsyncWaitHandle.WaitOne(1000)) {
        return $false
      }
      $client.EndConnect($async)
      return $client.Connected
    } finally {
      $client.Close()
    }
  } catch {
    return $false
  }
}

function Wait-Ready {
  if ($NoStart -or $DryRun) {
    return
  }

  $deadline = (Get-Date).AddSeconds($MaxWaitSeconds)
  while ((Get-Date) -lt $deadline) {
    $httpReady = Test-HttpReady
    $endpointReady = Test-EndpointReady
    if ($httpReady -and $endpointReady) {
      Write-RestartLog "Codex Mobile Web shared chain is ready."
      return
    }
    Start-Sleep -Seconds 1
  }

  throw "Timed out waiting for Codex Mobile Web shared chain to become ready."
}

Write-RestartLog "Starting shared-chain restart. workspace='$WorkspacePath' task='$TaskName' codexHome='$CodexHome' dryRun=$DryRun noStart=$NoStart"
Stop-MobileTask
Stop-TargetProcesses
Remove-EndpointFile
Start-MobileTask
Wait-Ready
Write-RestartLog "Shared-chain restart finished."
