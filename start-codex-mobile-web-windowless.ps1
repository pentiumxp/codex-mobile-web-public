param(
    [string]$HostAddress = "0.0.0.0",
    [int]$Port = 8787,
    [string]$CodexExe = "",
    [string]$UserProfilePath = "",
    [string]$HermesPluginBaseUrl = "",
    [string]$PublicBaseUrl = "",
    [string]$HermesPluginFrameOrigins = "",
    [string]$HermesPluginNotificationBaseUrl = "",
    [string]$HermesPluginNotificationKey = "",
    [string]$HermesPluginNotificationKeyFile = "",
    [switch]$EnsureStandaloneMux,
    [switch]$RequireSharedAppServer,
    [switch]$NoAuth,
    [string]$LogPath = "",
    [switch]$NoRestartOnExit
)

$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

function Resolve-CodexHomeFromProfileStore {
    param(
        [string]$ProfilePath,
        [string]$RuntimePath
    )
    if ([string]::IsNullOrWhiteSpace($ProfilePath) -or [string]::IsNullOrWhiteSpace($RuntimePath)) {
        return ""
    }
    $storePath = Join-Path $RuntimePath "codex-profiles.json"
    if (-not (Test-Path -LiteralPath $storePath)) {
        return ""
    }
    try {
        $store = Get-Content -LiteralPath $storePath -Raw -Encoding UTF8 | ConvertFrom-Json
        $activeProfileId = [string]$store.activeProfileId
        if ([string]::IsNullOrWhiteSpace($activeProfileId) -or -not $store.profiles) {
            return ""
        }
        foreach ($profile in @($store.profiles)) {
            if ([string]$profile.id -eq $activeProfileId -and -not [string]::IsNullOrWhiteSpace([string]$profile.codexHome)) {
                return [string]$profile.codexHome
            }
        }
    } catch {
        return ""
    }
    return ""
}

function Normalize-PathKey {
    param([string]$Path)
    if ([string]::IsNullOrWhiteSpace($Path)) {
        return ""
    }
    return ([System.IO.Path]::GetFullPath($Path).TrimEnd("\")).ToLowerInvariant()
}

function Backup-ProfileAuthFiles {
    param(
        [string]$CodexHome,
        [string]$RuntimePath
    )
    if ([string]::IsNullOrWhiteSpace($CodexHome) -or [string]::IsNullOrWhiteSpace($RuntimePath)) {
        return
    }
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $profileName = Split-Path -Leaf ([System.IO.Path]::GetFullPath($CodexHome))
    if ([string]::IsNullOrWhiteSpace($profileName)) {
        $profileName = "default"
    }
    $backupRoot = Join-Path (Join-Path $RuntimePath "profile-auth-backups") $profileName
    $backupDir = Join-Path $backupRoot $timestamp
    foreach ($name in @("auth.json", "config.toml")) {
        $source = Join-Path $CodexHome $name
        if (Test-Path -LiteralPath $source) {
            New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
            Copy-Item -LiteralPath $source -Destination (Join-Path $backupDir $name) -Force
        }
    }
}

function Backup-AndRemove-StatePath {
    param(
        [string]$Path,
        [string]$BackupRoot
    )
    if (-not (Test-Path -LiteralPath $Path)) {
        return
    }
    New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null
    $name = Split-Path -Leaf $Path
    $destination = Join-Path $BackupRoot $name
    if (Test-Path -LiteralPath $destination) {
        $destination = Join-Path $BackupRoot ("{0}-{1}" -f $name, (Get-Date -Format "HHmmssfff"))
    }
    Move-Item -LiteralPath $Path -Destination $destination -Force
}

function Ensure-LinkedStatePath {
    param(
        [string]$Source,
        [string]$Target,
        [string]$Kind,
        [string]$BackupRoot
    )
    if (-not (Test-Path -LiteralPath $Source)) {
        return
    }
    Backup-AndRemove-StatePath -Path $Target -BackupRoot $BackupRoot
    if ($Kind -eq "Directory") {
        New-Item -ItemType Junction -Path $Target -Target $Source | Out-Null
    } else {
        New-Item -ItemType HardLink -Path $Target -Target $Source | Out-Null
    }
}

function Ensure-SharedProfileState {
    param(
        [string]$ProfilePath,
        [string]$CodexHome,
        [string]$RuntimePath
    )
    if ([string]::IsNullOrWhiteSpace($ProfilePath) -or [string]::IsNullOrWhiteSpace($CodexHome)) {
        return
    }
    $defaultHome = Join-Path $ProfilePath ".codex"
    if ((Normalize-PathKey $CodexHome) -eq (Normalize-PathKey $defaultHome)) {
        return
    }
    if (-not (Test-Path -LiteralPath $defaultHome)) {
        return
    }
    New-Item -ItemType Directory -Force -Path $CodexHome | Out-Null
    Backup-ProfileAuthFiles -CodexHome $CodexHome -RuntimePath $RuntimePath

    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $profileName = Split-Path -Leaf ([System.IO.Path]::GetFullPath($CodexHome))
    $backupRoot = Join-Path (Join-Path $RuntimePath "profile-state-backups") (Join-Path $profileName $timestamp)
    foreach ($item in @(
        @{ Name = ".codex-global-state.json"; Kind = "File" },
        @{ Name = "state_5.sqlite"; Kind = "File" },
        @{ Name = "state_5.sqlite-wal"; Kind = "File" },
        @{ Name = "state_5.sqlite-shm"; Kind = "File" },
        @{ Name = "goals_1.sqlite"; Kind = "File" },
        @{ Name = "goals_1.sqlite-wal"; Kind = "File" },
        @{ Name = "goals_1.sqlite-shm"; Kind = "File" },
        @{ Name = "session_index.jsonl"; Kind = "File" },
        @{ Name = "sessions"; Kind = "Directory" },
        @{ Name = "archived_sessions"; Kind = "Directory" }
    )) {
        Ensure-LinkedStatePath `
            -Source (Join-Path $defaultHome $item.Name) `
            -Target (Join-Path $CodexHome $item.Name) `
            -Kind $item.Kind `
            -BackupRoot $backupRoot
    }
}

if (-not [string]::IsNullOrWhiteSpace($UserProfilePath)) {
    $env:USERPROFILE = $UserProfilePath
    $env:HOME = $UserProfilePath
    $env:HOMEDRIVE = Split-Path -Qualifier $UserProfilePath
    $env:HOMEPATH = $UserProfilePath.Substring($env:HOMEDRIVE.Length)
    if ([string]::IsNullOrWhiteSpace($env:CODEX_MOBILE_RUNTIME_DIR)) {
        $env:CODEX_MOBILE_RUNTIME_DIR = Join-Path $UserProfilePath ".codex-mobile-web"
    }
    $profileCodexHome = Resolve-CodexHomeFromProfileStore -ProfilePath $UserProfilePath -RuntimePath $env:CODEX_MOBILE_RUNTIME_DIR
    if (-not [string]::IsNullOrWhiteSpace($profileCodexHome)) {
        $env:CODEX_HOME = $profileCodexHome
    } elseif ([string]::IsNullOrWhiteSpace($env:CODEX_HOME)) {
        $env:CODEX_HOME = Join-Path $UserProfilePath ".codex"
    }
    Ensure-SharedProfileState -ProfilePath $UserProfilePath -CodexHome $env:CODEX_HOME -RuntimePath $env:CODEX_MOBILE_RUNTIME_DIR
}

function Add-GitSafeDirectoryEnv {
    param([string[]]$Directories)

    $items = @()
    foreach ($item in $Directories) {
        if ([string]::IsNullOrWhiteSpace($item)) {
            continue
        }
        $items += ($item -replace "\\", "/")
    }
    if ($items.Count -eq 0) {
        return
    }

    $count = 0
    if ($env:GIT_CONFIG_COUNT -match "^\d+$") {
        $count = [int]$env:GIT_CONFIG_COUNT
    }
    foreach ($item in $items) {
        [Environment]::SetEnvironmentVariable("GIT_CONFIG_KEY_$count", "safe.directory", "Process")
        [Environment]::SetEnvironmentVariable("GIT_CONFIG_VALUE_$count", $item, "Process")
        $count += 1
    }
    $env:GIT_CONFIG_COUNT = [string]$count
}

$configuredSafeDirs = @()
if (-not [string]::IsNullOrWhiteSpace($env:CODEX_MOBILE_GIT_SAFE_DIRECTORIES)) {
    $configuredSafeDirs = $env:CODEX_MOBILE_GIT_SAFE_DIRECTORIES -split "[;`n`r]" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
} elseif (-not [string]::IsNullOrWhiteSpace($UserProfilePath)) {
    $configuredSafeDirs = @(
        (Join-Path (Join-Path $UserProfilePath "Documents") "*"),
        (Join-Path $UserProfilePath ".codex"),
        (Join-Path $UserProfilePath ".codex-mobile-web")
    )
}
Add-GitSafeDirectoryEnv -Directories $configuredSafeDirs

$runtimeRoot = if ($env:CODEX_MOBILE_RUNTIME_DIR) { $env:CODEX_MOBILE_RUNTIME_DIR } else { Join-Path $env:USERPROFILE ".codex-mobile-web" }
New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null

if ([string]::IsNullOrWhiteSpace($LogPath)) {
    $LogPath = Join-Path $runtimeRoot "codex-mobile-web.startup.log"
}

function Resolve-CodexExecutable {
    param(
        [string]$RuntimePath,
        [string]$RequestedCodexExe
    )

    if (-not [string]::IsNullOrWhiteSpace($RequestedCodexExe)) {
        return $RequestedCodexExe
    }
    if (-not [string]::IsNullOrWhiteSpace($env:CODEX_MOBILE_CODEX_EXE)) {
        return $env:CODEX_MOBILE_CODEX_EXE
    }

    $candidates = @()
    $localBin = Join-Path $env:LOCALAPPDATA "OpenAI\Codex\bin"
    if (Test-Path -LiteralPath $localBin) {
        $candidates += Get-ChildItem -LiteralPath $localBin -Recurse -Filter "codex.exe" -ErrorAction SilentlyContinue
    }
    $runtimeCodexExe = Join-Path $RuntimePath "codex.exe"
    if (Test-Path -LiteralPath $runtimeCodexExe) {
        $candidates += Get-Item -LiteralPath $runtimeCodexExe
    }
    $selected = $candidates |
        Where-Object { $_ -and $_.FullName -and (Test-Path -LiteralPath $_.FullName) } |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    if ($selected -and $selected.FullName) {
        return $selected.FullName
    }
    return "codex"
}

$CodexExe = Resolve-CodexExecutable -RuntimePath $runtimeRoot -RequestedCodexExe $CodexExe

$startScript = Join-Path $scriptRoot "start-codex-mobile-web.ps1"
if (-not (Test-Path -LiteralPath $startScript)) {
    throw "Startup script not found: $startScript"
}

function Test-MuxEndpoint {
    param(
        [string]$EndpointFile,
        [string]$ExpectedCodexExe = ""
    )

    try {
        if (-not (Test-Path -LiteralPath $EndpointFile)) {
            return $false
        }
        $endpoint = Get-Content -LiteralPath $EndpointFile -Raw | ConvertFrom-Json
        if (-not $endpoint.host -or -not $endpoint.port) {
            return $false
        }
        if (-not [string]::IsNullOrWhiteSpace($ExpectedCodexExe)) {
            if (-not $endpoint.codexExe) {
                return $false
            }
            try {
                $expectedPath = (Get-Item -LiteralPath $ExpectedCodexExe -ErrorAction Stop).FullName
            } catch {
                $expectedPath = $ExpectedCodexExe
            }
            try {
                $actualPath = (Get-Item -LiteralPath ([string]$endpoint.codexExe) -ErrorAction Stop).FullName
            } catch {
                $actualPath = [string]$endpoint.codexExe
            }
            if (-not [string]::Equals($actualPath, $expectedPath, [System.StringComparison]::OrdinalIgnoreCase)) {
                return $false
            }
        }
        $client = [System.Net.Sockets.TcpClient]::new()
        try {
            $connect = $client.BeginConnect([string]$endpoint.host, [int]$endpoint.port, $null, $null)
            if (-not $connect.AsyncWaitHandle.WaitOne(1000, $false)) {
                return $false
            }
            $client.EndConnect($connect)
            return $true
        } finally {
            $client.Close()
        }
    } catch {
        return $false
    }
}

function Start-StandaloneMuxIfNeeded {
    param(
        [string]$ProfilePath,
        [string]$RuntimePath,
        [string]$RequestedCodexExe,
        [string]$LogPath
    )

    $codexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $ProfilePath ".codex" }
    $muxRuntimeDir = Join-Path $codexHome "app-server-mux"
    $endpointFile = Join-Path $muxRuntimeDir "endpoint.json"
    $resolvedCodexExe = Resolve-CodexExecutable -RuntimePath $RuntimePath -RequestedCodexExe $RequestedCodexExe
    if (Test-MuxEndpoint -EndpointFile $endpointFile -ExpectedCodexExe $resolvedCodexExe) {
        "[$(Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz")] Reusing existing mux endpoint: $endpointFile" | Add-Content -LiteralPath $LogPath -Encoding Unicode
        return
    }

    Remove-Item -LiteralPath $endpointFile -Force -ErrorAction SilentlyContinue

    $muxScript = Join-Path $scriptRoot "codex-app-server-mux.js"
    if (-not (Test-Path -LiteralPath $muxScript)) {
        throw "Mux script not found: $muxScript"
    }

    $nodeCommand = Get-Command "node.exe" -ErrorAction SilentlyContinue
    if (-not $nodeCommand -or -not $nodeCommand.Source) {
        throw "node.exe not found in PATH"
    }

    $oldMuxStandalone = $env:CODEX_MUX_STANDALONE
    $oldMuxKeepAlive = $env:CODEX_MUX_KEEP_ALIVE
    $oldMuxCodexExe = $env:CODEX_MUX_CODEX_EXE
    $oldCodeHome = $env:CODEX_HOME
    $oldRuntimeDir = $env:CODEX_MOBILE_RUNTIME_DIR
    try {
        $env:CODEX_HOME = $codexHome
        $env:CODEX_MOBILE_RUNTIME_DIR = $RuntimePath
        $env:CODEX_MUX_STANDALONE = "1"
        $env:CODEX_MUX_KEEP_ALIVE = "1"
        $env:CODEX_MUX_CODEX_EXE = $resolvedCodexExe
        $proc = Start-Process `
            -FilePath $nodeCommand.Source `
            -ArgumentList @($muxScript, "app-server", "--analytics-default-enabled") `
            -WorkingDirectory $scriptRoot `
            -WindowStyle Hidden `
            -PassThru
        "[$(Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz")] Started standalone mux PID $($proc.Id)" | Add-Content -LiteralPath $LogPath -Encoding Unicode
    } finally {
        $env:CODEX_MUX_STANDALONE = $oldMuxStandalone
        $env:CODEX_MUX_KEEP_ALIVE = $oldMuxKeepAlive
        $env:CODEX_MUX_CODEX_EXE = $oldMuxCodexExe
        $env:CODEX_HOME = $oldCodeHome
        $env:CODEX_MOBILE_RUNTIME_DIR = $oldRuntimeDir
    }

    $deadline = (Get-Date).AddSeconds(12)
    while ((Get-Date) -lt $deadline) {
        if (Test-MuxEndpoint -EndpointFile $endpointFile -ExpectedCodexExe $resolvedCodexExe) {
            "[$(Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz")] Standalone mux endpoint is ready: $endpointFile" | Add-Content -LiteralPath $LogPath -Encoding Unicode
            return
        }
        Start-Sleep -Milliseconds 400
    }

    throw "Standalone mux endpoint did not become ready: $endpointFile"
}

$parameters = @{
    HostAddress = $HostAddress
    Port = $Port
}

if (-not [string]::IsNullOrWhiteSpace($CodexExe)) {
    $parameters.CodexExe = $CodexExe
}
if (-not [string]::IsNullOrWhiteSpace($HermesPluginBaseUrl)) {
    $parameters.HermesPluginBaseUrl = $HermesPluginBaseUrl
}
if (-not [string]::IsNullOrWhiteSpace($PublicBaseUrl)) {
    $parameters.PublicBaseUrl = $PublicBaseUrl
}
if (-not [string]::IsNullOrWhiteSpace($HermesPluginFrameOrigins)) {
    $parameters.HermesPluginFrameOrigins = $HermesPluginFrameOrigins
}
if (-not [string]::IsNullOrWhiteSpace($HermesPluginNotificationBaseUrl)) {
    $parameters.HermesPluginNotificationBaseUrl = $HermesPluginNotificationBaseUrl
}
if (-not [string]::IsNullOrWhiteSpace($HermesPluginNotificationKey)) {
    $parameters.HermesPluginNotificationKey = $HermesPluginNotificationKey
}
if (-not [string]::IsNullOrWhiteSpace($HermesPluginNotificationKeyFile)) {
    $parameters.HermesPluginNotificationKeyFile = $HermesPluginNotificationKeyFile
}
if ($RequireSharedAppServer) {
    $parameters.RequireSharedAppServer = $true
}
if ($NoAuth) {
    $parameters.NoAuth = $true
}

$startedAt = Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz"
"[$startedAt] Starting Codex Mobile Web windowless launcher from $scriptRoot" | Add-Content -LiteralPath $LogPath -Encoding Unicode

do {
    $exitCode = 0
    try {
        if ($EnsureStandaloneMux) {
            Start-StandaloneMuxIfNeeded -ProfilePath $env:USERPROFILE -RuntimePath $runtimeRoot -RequestedCodexExe $CodexExe -LogPath $LogPath
        }
        $oldErrorActionPreference = $ErrorActionPreference
        try {
            $ErrorActionPreference = "Continue"
            & $startScript @parameters *>> $LogPath
            if ($LASTEXITCODE -is [int]) {
                $exitCode = $LASTEXITCODE
            }
        } finally {
            $ErrorActionPreference = $oldErrorActionPreference
        }
    } catch {
        $exitCode = -1
        "[$(Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz")] Codex Mobile Web launcher error: $($_.Exception.Message)" | Add-Content -LiteralPath $LogPath -Encoding Unicode
    } finally {
        $endedAt = Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz"
        "[$endedAt] Codex Mobile Web listener exited with code $exitCode" | Add-Content -LiteralPath $LogPath -Encoding Unicode
    }

    if ($NoRestartOnExit) {
        exit $exitCode
    }

    Start-Sleep -Seconds 3
    "[$(Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz")] Restarting Codex Mobile Web listener after exit" | Add-Content -LiteralPath $LogPath -Encoding Unicode
} while ($true)
