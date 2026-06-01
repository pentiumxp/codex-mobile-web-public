param(
    [string]$CodexDesktopExe = "",
    [string]$MuxCommand = "",
    [string]$MuxScript = "",
    [string]$RealCodexExe = "",
    [string]$ProfileId = "",
    [string]$CodexHome = "",
    [switch]$ForceRestartMux,
    [switch]$NoMuxKeepAlive,
    [switch]$PrintOnly
)

$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$runtimeRoot = if ($env:CODEX_MOBILE_RUNTIME_DIR) { $env:CODEX_MOBILE_RUNTIME_DIR } else { Join-Path $env:USERPROFILE ".codex-mobile-web" }
$runtimeCodexExe = Join-Path $runtimeRoot "codex.exe"

function Resolve-CodexHomeFromProfile {
    param(
        [string]$RequestedProfileId,
        [string]$RequestedCodexHome,
        [string]$RuntimePath,
        [string]$UserProfilePath
    )

    if (-not [string]::IsNullOrWhiteSpace($RequestedCodexHome)) {
        return [System.IO.Path]::GetFullPath($RequestedCodexHome)
    }

    $profile = if ([string]::IsNullOrWhiteSpace($RequestedProfileId)) { "default" } else { $RequestedProfileId.Trim().ToLowerInvariant() }
    if ($profile -eq "default") {
        return (Join-Path $UserProfilePath ".codex")
    }
    if ($profile -eq "current" -or $profile -eq "previous") {
        return (Join-Path (Join-Path $UserProfilePath ".codex-homes") $profile)
    }

    $storePath = Join-Path $RuntimePath "codex-profiles.json"
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

function Find-CSharpCompiler {
    $candidates = @(
        (Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"),
        (Join-Path $env:WINDIR "Microsoft.NET\Framework\v4.0.30319\csc.exe")
    )

    $pathCompiler = Get-Command "csc.exe" -ErrorAction SilentlyContinue
    if ($pathCompiler -and $pathCompiler.Source) {
        $candidates += $pathCompiler.Source
    }

    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path -LiteralPath $candidate)) {
            return $candidate
        }
    }

    return $null
}

function Ensure-MuxShim {
    param(
        [Parameter(Mandatory = $true)][string]$SourcePath,
        [Parameter(Mandatory = $true)][string]$OutputPath
    )

    if (-not (Test-Path -LiteralPath $SourcePath)) {
        throw "Mux shim source not found: $SourcePath"
    }

    $needsBuild = -not (Test-Path -LiteralPath $OutputPath)
    if (-not $needsBuild) {
        $sourceInfo = Get-Item -LiteralPath $SourcePath
        $outputInfo = Get-Item -LiteralPath $OutputPath
        $needsBuild = $sourceInfo.LastWriteTimeUtc -gt $outputInfo.LastWriteTimeUtc
    }

    if (-not $needsBuild) {
        return
    }

    $compiler = Find-CSharpCompiler
    if (-not $compiler) {
        throw "C# compiler not found. Cannot build mux shim exe for CODEX_CLI_PATH."
    }

    & $compiler /nologo /target:exe /optimize+ "/out:$OutputPath" $SourcePath
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to build mux shim exe: $OutputPath"
    }
}

if ([string]::IsNullOrWhiteSpace($MuxScript)) {
    $MuxScript = Join-Path $scriptRoot "codex-app-server-mux.js"
}

if (-not (Test-Path -LiteralPath $MuxScript)) {
    throw "Mux script not found: $MuxScript"
}

if ([string]::IsNullOrWhiteSpace($MuxCommand)) {
    $MuxCommand = Join-Path $scriptRoot "codex-app-server-mux.exe"
}

$muxExtension = [System.IO.Path]::GetExtension($MuxCommand).ToLowerInvariant()
if ($muxExtension -eq ".cmd" -or $muxExtension -eq ".bat") {
    throw "Codex Desktop requires CODEX_CLI_PATH to be a real .exe; use codex-app-server-mux.exe instead of $muxExtension."
}

if ($muxExtension -eq ".exe") {
    Ensure-MuxShim -SourcePath (Join-Path $scriptRoot "codex-app-server-mux-shim.cs") -OutputPath $MuxCommand
}

if (-not (Test-Path -LiteralPath $MuxCommand)) {
    throw "Mux command not found: $MuxCommand"
}

$selectedCodexHome = Resolve-CodexHomeFromProfile -RequestedProfileId $ProfileId -RequestedCodexHome $CodexHome -RuntimePath $runtimeRoot -UserProfilePath $env:USERPROFILE
if (-not (Test-Path -LiteralPath $selectedCodexHome)) {
    New-Item -ItemType Directory -Force -Path $selectedCodexHome | Out-Null
}

if ([string]::IsNullOrWhiteSpace($RealCodexExe)) {
    if (Test-Path -LiteralPath $runtimeCodexExe) {
        $RealCodexExe = $runtimeCodexExe
    } else {
        $RealCodexExe = "codex"
    }
}

if (($RealCodexExe -match '[\\/]') -and -not (Test-Path -LiteralPath $RealCodexExe)) {
    throw "Real Codex executable not found: $RealCodexExe"
}

$endpointFile = Join-Path $selectedCodexHome "app-server-mux\endpoint.json"
if ($ForceRestartMux) {
    if (Test-Path -LiteralPath $endpointFile) {
        try {
            $endpoint = Get-Content -LiteralPath $endpointFile -Raw | ConvertFrom-Json
            $muxPid = [int]($endpoint.pid)
            if ($muxPid -gt 0) {
                $muxProcess = Get-Process -Id $muxPid -ErrorAction SilentlyContinue
                if ($muxProcess) {
                    Write-Host "Stopping existing mux PID $muxPid before launch."
                    Stop-Process -Id $muxPid -Force
                    Start-Sleep -Milliseconds 800
                }
            }
        } catch {
            Write-Warning "Failed to stop existing mux from endpoint file: $($_.Exception.Message)"
        }
        Remove-Item -LiteralPath $endpointFile -Force -ErrorAction SilentlyContinue
    }
}

if ([string]::IsNullOrWhiteSpace($CodexDesktopExe)) {
    $package = Get-AppxPackage -Name "OpenAI.Codex" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($package -and $package.InstallLocation) {
        $candidate = Join-Path $package.InstallLocation "app\Codex.exe"
        if (Test-Path -LiteralPath $candidate) {
            $CodexDesktopExe = $candidate
        }
    }
}

if ([string]::IsNullOrWhiteSpace($CodexDesktopExe) -or -not (Test-Path -LiteralPath $CodexDesktopExe)) {
    throw "Codex Desktop executable not found. Pass -CodexDesktopExe explicitly."
}

$env:CODEX_CLI_PATH = $MuxCommand
$env:CODEX_MUX_SCRIPT_PATH = $MuxScript
$env:CODEX_MUX_CODEX_EXE = $RealCodexExe
$env:CODEX_HOME = $selectedCodexHome
if ($NoMuxKeepAlive) {
    Remove-Item Env:\CODEX_MUX_KEEP_ALIVE -ErrorAction SilentlyContinue
} else {
    $env:CODEX_MUX_KEEP_ALIVE = "1"
}
$nodeCommand = Get-Command "node.exe" -ErrorAction SilentlyContinue
if ($nodeCommand -and $nodeCommand.Source) {
    $env:CODEX_MUX_NODE_EXE = $nodeCommand.Source
}

Write-Host "Codex Desktop shared app-server launch environment:"
Write-Host "  CODEX_CLI_PATH=$env:CODEX_CLI_PATH"
Write-Host "  CODEX_MUX_SCRIPT_PATH=$env:CODEX_MUX_SCRIPT_PATH"
Write-Host "  CODEX_MUX_CODEX_EXE=$env:CODEX_MUX_CODEX_EXE"
Write-Host "  CODEX_HOME=$env:CODEX_HOME"
if ($env:CODEX_MUX_NODE_EXE) {
    Write-Host "  CODEX_MUX_NODE_EXE=$env:CODEX_MUX_NODE_EXE"
}
Write-Host "  CODEX_MUX_KEEP_ALIVE=$env:CODEX_MUX_KEEP_ALIVE"
Write-Host "  Endpoint file: $endpointFile"

if ($PrintOnly) {
    return
}

Start-Process -FilePath $CodexDesktopExe -WorkingDirectory (Split-Path -Parent $CodexDesktopExe)
