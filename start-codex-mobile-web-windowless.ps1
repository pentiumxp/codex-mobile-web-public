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
if (-not [string]::IsNullOrWhiteSpace($UserProfilePath)) {
    $env:USERPROFILE = $UserProfilePath
    $env:HOME = $UserProfilePath
    $env:HOMEDRIVE = Split-Path -Qualifier $UserProfilePath
    $env:HOMEPATH = $UserProfilePath.Substring($env:HOMEDRIVE.Length)
    if ([string]::IsNullOrWhiteSpace($env:CODEX_HOME)) {
        $env:CODEX_HOME = Join-Path $UserProfilePath ".codex"
    }
    if ([string]::IsNullOrWhiteSpace($env:CODEX_MOBILE_RUNTIME_DIR)) {
        $env:CODEX_MOBILE_RUNTIME_DIR = Join-Path $UserProfilePath ".codex-mobile-web"
    }
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

$startScript = Join-Path $scriptRoot "start-codex-mobile-web.ps1"
if (-not (Test-Path -LiteralPath $startScript)) {
    throw "Startup script not found: $startScript"
}

function Test-MuxEndpoint {
    param([string]$EndpointFile)

    try {
        if (-not (Test-Path -LiteralPath $EndpointFile)) {
            return $false
        }
        $endpoint = Get-Content -LiteralPath $EndpointFile -Raw | ConvertFrom-Json
        if (-not $endpoint.host -or -not $endpoint.port) {
            return $false
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
    if (Test-MuxEndpoint -EndpointFile $endpointFile) {
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

    $resolvedCodexExe = $RequestedCodexExe
    if ([string]::IsNullOrWhiteSpace($resolvedCodexExe)) {
        $runtimeCodexExe = Join-Path $RuntimePath "codex.exe"
        if (Test-Path -LiteralPath $runtimeCodexExe) {
            $resolvedCodexExe = $runtimeCodexExe
        } else {
            $resolvedCodexExe = "codex"
        }
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
        if (Test-MuxEndpoint -EndpointFile $endpointFile) {
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
