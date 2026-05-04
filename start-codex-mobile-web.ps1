param(
    [string]$HostAddress = "0.0.0.0",
    [int]$Port = 8787,
    [string]$CodexExe = "",
    [switch]$RequireSharedAppServer,
    [switch]$NoAuth
)

$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$runtimeRoot = if ($env:CODEX_MOBILE_RUNTIME_DIR) { $env:CODEX_MOBILE_RUNTIME_DIR } else { Join-Path $env:USERPROFILE ".codex-mobile-web" }
$runtimeCodexExe = Join-Path $runtimeRoot "codex.exe"

if ([string]::IsNullOrWhiteSpace($CodexExe)) {
    if (Test-Path -LiteralPath $runtimeCodexExe) {
        $CodexExe = $runtimeCodexExe
    } else {
        $CodexExe = "codex"
    }
}

if (($CodexExe -match '[\\/]') -and -not (Test-Path -LiteralPath $CodexExe)) {
    throw "Codex executable not found: $CodexExe"
}

$env:CODEX_MOBILE_HOST = $HostAddress
$env:CODEX_MOBILE_PORT = [string]$Port
$env:CODEX_MOBILE_CODEX_EXE = $CodexExe
if ($RequireSharedAppServer) {
    $env:CODEX_MOBILE_REQUIRE_SHARED_APP_SERVER = "1"
}
if ($NoAuth) {
    $env:CODEX_MOBILE_DISABLE_AUTH = "1"
}

Write-Host "Starting Codex Mobile Web on http://$HostAddress`:$Port"
Write-Host "Codex exe: $CodexExe"
if ($RequireSharedAppServer) {
    Write-Host "Shared app-server is required; managed fallback is disabled."
}
node (Join-Path $scriptRoot "server.js")
