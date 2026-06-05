param(
    [string]$HostAddress = "0.0.0.0",
    [int]$Port = 8787,
    [string]$CodexExe = "",
    [string]$HermesPluginBaseUrl = "",
    [string]$PublicBaseUrl = "",
    [string]$HermesPluginFrameOrigins = "",
    [string]$HermesPluginNotificationBaseUrl = "",
    [string]$HermesPluginNotificationKey = "",
    [string]$HermesPluginNotificationKeyFile = "",
    [switch]$RequireSharedAppServer,
    [switch]$NoAuth
)

$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$runtimeRoot = if ($env:CODEX_MOBILE_RUNTIME_DIR) { $env:CODEX_MOBILE_RUNTIME_DIR } else { Join-Path $env:USERPROFILE ".codex-mobile-web" }
$runtimeCodexExe = Join-Path $runtimeRoot "codex.exe"

function Resolve-CodexExecutable {
    param([string]$RuntimeCodexExe)

    if (-not [string]::IsNullOrWhiteSpace($env:CODEX_MOBILE_CODEX_EXE)) {
        return $env:CODEX_MOBILE_CODEX_EXE
    }

    $candidates = @()
    $localBin = Join-Path $env:LOCALAPPDATA "OpenAI\Codex\bin"
    if (Test-Path -LiteralPath $localBin) {
        $candidates += Get-ChildItem -LiteralPath $localBin -Recurse -Filter "codex.exe" -ErrorAction SilentlyContinue
    }
    if (Test-Path -LiteralPath $RuntimeCodexExe) {
        $candidates += Get-Item -LiteralPath $RuntimeCodexExe
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

if ([string]::IsNullOrWhiteSpace($CodexExe)) {
    $CodexExe = Resolve-CodexExecutable -RuntimeCodexExe $runtimeCodexExe
}

if (($CodexExe -match '[\\/]') -and -not (Test-Path -LiteralPath $CodexExe)) {
    throw "Codex executable not found: $CodexExe"
}

$env:CODEX_MOBILE_HOST = $HostAddress
$env:CODEX_MOBILE_PORT = [string]$Port
$env:CODEX_MOBILE_CODEX_EXE = $CodexExe
if (-not [string]::IsNullOrWhiteSpace($HermesPluginBaseUrl)) {
    $env:CODEX_MOBILE_HERMES_PLUGIN_BASE_URL = $HermesPluginBaseUrl
}
if (-not [string]::IsNullOrWhiteSpace($PublicBaseUrl)) {
    $env:CODEX_MOBILE_PUBLIC_BASE_URL = $PublicBaseUrl
}
if (-not [string]::IsNullOrWhiteSpace($HermesPluginFrameOrigins)) {
    $env:CODEX_MOBILE_HERMES_PLUGIN_FRAME_ORIGINS = $HermesPluginFrameOrigins
}
if (-not [string]::IsNullOrWhiteSpace($HermesPluginNotificationBaseUrl)) {
    $env:CODEX_MOBILE_HERMES_PLUGIN_NOTIFICATION_BASE_URL = $HermesPluginNotificationBaseUrl
}
if (-not [string]::IsNullOrWhiteSpace($HermesPluginNotificationKey)) {
    $env:CODEX_MOBILE_HERMES_PLUGIN_NOTIFICATION_KEY = $HermesPluginNotificationKey
}
if (-not [string]::IsNullOrWhiteSpace($HermesPluginNotificationKeyFile)) {
    $env:CODEX_MOBILE_HERMES_PLUGIN_NOTIFICATION_KEY_FILE = $HermesPluginNotificationKeyFile
}
if ($RequireSharedAppServer) {
    $env:CODEX_MOBILE_REQUIRE_SHARED_APP_SERVER = "1"
}
if ($NoAuth) {
    $env:CODEX_MOBILE_DISABLE_AUTH = "1"
}

Write-Host "Starting Codex Mobile Web on http://$HostAddress`:$Port"
Write-Host "Codex exe: $CodexExe"
if (-not [string]::IsNullOrWhiteSpace($HermesPluginBaseUrl)) {
    Write-Host "Hermes plugin base URL: $HermesPluginBaseUrl"
} elseif (-not [string]::IsNullOrWhiteSpace($PublicBaseUrl)) {
    Write-Host "Public base URL: $PublicBaseUrl"
}
if (-not [string]::IsNullOrWhiteSpace($HermesPluginFrameOrigins)) {
    Write-Host "Hermes plugin frame origins: $HermesPluginFrameOrigins"
}
if (-not [string]::IsNullOrWhiteSpace($HermesPluginNotificationBaseUrl)) {
    Write-Host "Hermes notification base URL: $HermesPluginNotificationBaseUrl"
}
if (-not [string]::IsNullOrWhiteSpace($HermesPluginNotificationKeyFile)) {
    Write-Host "Hermes notification key file: $HermesPluginNotificationKeyFile"
}
if ($RequireSharedAppServer) {
    Write-Host "Shared app-server is required; managed fallback is disabled."
}
$oldErrorActionPreference = $ErrorActionPreference
try {
    $ErrorActionPreference = "Continue"
    node (Join-Path $scriptRoot "server.js")
} finally {
    $ErrorActionPreference = $oldErrorActionPreference
}
