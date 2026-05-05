param(
    [string]$HostAddress = "0.0.0.0",
    [int]$Port = 8787,
    [string]$CodexExe = "",
    [string]$UserProfilePath = "",
    [switch]$EnsureStandaloneMux,
    [switch]$RequireSharedAppServer,
    [switch]$NoAuth,
    [string]$LogPath = ""
)

$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not [string]::IsNullOrWhiteSpace($UserProfilePath)) {
    $env:USERPROFILE = $UserProfilePath
    if ([string]::IsNullOrWhiteSpace($env:CODEX_HOME)) {
        $env:CODEX_HOME = Join-Path $UserProfilePath ".codex"
    }
    if ([string]::IsNullOrWhiteSpace($env:CODEX_MOBILE_RUNTIME_DIR)) {
        $env:CODEX_MOBILE_RUNTIME_DIR = Join-Path $UserProfilePath ".codex-mobile-web"
    }
}

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
if ($RequireSharedAppServer) {
    $parameters.RequireSharedAppServer = $true
}
if ($NoAuth) {
    $parameters.NoAuth = $true
}

$startedAt = Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz"
"[$startedAt] Starting Codex Mobile Web windowless launcher from $scriptRoot" | Add-Content -LiteralPath $LogPath -Encoding Unicode

try {
    if ($EnsureStandaloneMux) {
        Start-StandaloneMuxIfNeeded -ProfilePath $env:USERPROFILE -RuntimePath $runtimeRoot -RequestedCodexExe $CodexExe -LogPath $LogPath
    }
    & $startScript @parameters *>> $LogPath
} finally {
    $endedAt = Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz"
    "[$endedAt] Codex Mobile Web windowless launcher exited with code $LASTEXITCODE" | Add-Content -LiteralPath $LogPath -Encoding Unicode
}

if ($LASTEXITCODE -is [int]) {
    exit $LASTEXITCODE
}
