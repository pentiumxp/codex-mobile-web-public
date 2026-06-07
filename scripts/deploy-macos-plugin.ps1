param(
  [string]$HostAlias = "macos-host",
  [string]$PublicRepoPath = "",
  [string]$Commit = "HEAD",
  [string]$SudoPasswordFile = "",
  [string]$TargetPath = "/Users/hermes-host/HermesMobile/plugins/codex-mobile-web",
  [string]$ServiceLabel = "com.hermesmobile.plugin.codex-mobile",
  [string]$NodePath = "/Users/hermes-host/HermesMobile/runtime/node-current/bin/node",
  [string]$NpmPath = "/Users/hermes-host/HermesMobile/runtime/node-current/bin/npm",
  [string]$AccessKeyFile = "/Users/xuxin/.codex-mobile-web/access_key",
  [int]$Port = 8787,
  [switch]$AllowNonMain,
  [switch]$DryRun,
  [switch]$SkipRestart,
  [switch]$SkipTargetTests
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter(Mandatory = $true)][string[]]$ArgumentList
  )

  & $FilePath @ArgumentList
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed: $FilePath $($ArgumentList -join ' ')"
  }
}

function ConvertTo-ShellSingleQuoted {
  param([AllowNull()][string]$Value)

  if ($null -eq $Value) {
    return "''"
  }
  return "'" + $Value.Replace("'", "'""'""'") + "'"
}

function Assert-NoBlockedArchivePath {
  param([Parameter(Mandatory = $true)][string[]]$Paths)

  $blockedPatterns = @(
    '^\.agent-context(/|$)',
    '^\.codex(/|$)',
    '^\.codex-mobile-web(/|$)',
    '^node_modules(/|$)',
    '^logs(/|$)',
    '^data(/|$)',
    '^uploads(/|$)',
    '(^|/)\.env(\.|$)',
    '(^|/)(access_key|auth\.json)$',
    '(^|/).*secret.*',
    '\.(pem|key)$'
  )

  foreach ($entry in $Paths) {
    foreach ($pattern in $blockedPatterns) {
      if ($entry -match $pattern) {
        throw "Refusing to deploy archive containing blocked path: $entry"
      }
    }
  }
}

if (-not $PublicRepoPath) {
  $workspaceRoot = Split-Path -Parent $PSScriptRoot
  $workspaceParent = Split-Path -Parent $workspaceRoot
  $PublicRepoPath = Join-Path $workspaceParent "codex-mobile-web-public"
}

if (-not (Test-Path -LiteralPath $PublicRepoPath -PathType Container)) {
  throw "Public repo path not found: $PublicRepoPath"
}

$status = & git -C $PublicRepoPath status --short
if ($LASTEXITCODE -ne 0) {
  throw "Failed to read public repo status."
}
if ($status) {
  throw "Public repo has uncommitted changes; refusing to deploy."
}

$branch = (& git -C $PublicRepoPath rev-parse --abbrev-ref HEAD).Trim()
if ($LASTEXITCODE -ne 0) {
  throw "Failed to read public repo branch."
}
if (-not $AllowNonMain -and $branch -ne "main") {
  throw "Public repo branch is '$branch', not 'main'. Use -AllowNonMain only for an intentional test deployment."
}

$resolvedCommit = (& git -C $PublicRepoPath rev-parse $Commit).Trim()
if ($LASTEXITCODE -ne 0 -or -not $resolvedCommit) {
  throw "Failed to resolve public commit: $Commit"
}
$shortCommit = (& git -C $PublicRepoPath rev-parse --short=7 $resolvedCommit).Trim()
if ($LASTEXITCODE -ne 0 -or -not $shortCommit) {
  throw "Failed to resolve short commit: $resolvedCommit"
}

$treeFiles = & git -C $PublicRepoPath ls-tree -r --name-only $resolvedCommit
if ($LASTEXITCODE -ne 0) {
  throw "Failed to list public archive files."
}
Assert-NoBlockedArchivePath -Paths $treeFiles

$deployStamp = Get-Date -Format "yyyyMMdd_HHmmss"
$deployId = "codex-mobile-web-deploy-$shortCommit-$deployStamp"
$tempRoot = [System.IO.Path]::GetTempPath()
$localArchive = Join-Path $tempRoot "$deployId.tar"
$localRemoteScript = Join-Path $tempRoot "$deployId-remote.sh"
$remoteArchive = "/tmp/$deployId.tar"
$remoteScript = "/tmp/$deployId-remote.sh"

$remoteScriptText = @'
#!/usr/bin/env bash
set -Eeuo pipefail

DEPLOY_ID=__DEPLOY_ID__
ARCHIVE=__REMOTE_ARCHIVE__
TARGET=__TARGET_PATH__
SERVICE_LABEL=__SERVICE_LABEL__
NODE_PATH=__NODE_PATH__
NPM_PATH=__NPM_PATH__
ACCESS_KEY_FILE=__ACCESS_KEY_FILE__
PORT=__PORT__
SKIP_RESTART=__SKIP_RESTART__
SKIP_TARGET_TESTS=__SKIP_TARGET_TESTS__
STAGE="/tmp/${DEPLOY_ID}.stage"
BACKUP="/tmp/${DEPLOY_ID}.backup.tar.gz"
SMOKE_SCRIPT="/tmp/${DEPLOY_ID}.smoke.js"
PATH_PREFIX="$(dirname "$NODE_PATH"):/Users/xuxin/.local/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"

log() {
  printf '[macos-plugin-deploy] %s\n' "$*"
}

fail() {
  printf '[macos-plugin-deploy] ERROR: %s\n' "$*" >&2
  exit 1
}

cleanup() {
  case "${STAGE:-}" in
    /tmp/codex-mobile-web-deploy-*.stage) rm -rf "$STAGE" ;;
  esac
  case "${SMOKE_SCRIPT:-}" in
    /tmp/codex-mobile-web-deploy-*.smoke.js) rm -f "$SMOKE_SCRIPT" ;;
  esac
  unset SUDO_PASSWORD_VALUE || true
}

run_sudo() {
  [ -n "${SUDO_PASSWORD_VALUE:-}" ] || fail "sudo password is not available"
  printf '%s\n' "$SUDO_PASSWORD_VALUE" | sudo -S -p '' "$@"
}

require_safe_paths() {
  case "$STAGE" in
    /tmp/codex-mobile-web-deploy-*.stage) ;;
    *) fail "Unsafe staging path: $STAGE" ;;
  esac
  case "$TARGET" in
    */HermesMobile/plugins/codex-mobile-web) ;;
    *) fail "Unsafe target path: $TARGET" ;;
  esac
}

verify_no_private_paths() {
  local root="$1"
  local banned
  for banned in .agent-context .codex .codex-mobile-web node_modules logs data uploads; do
    if [ -e "$root/$banned" ]; then
      fail "Archive contains blocked path: $banned"
    fi
  done
  if find "$root" \( -name '*.pem' -o -name '*.key' -o -name '.env' -o -name '.env.*' -o -name 'auth.json' -o -name 'access_key' -o -iname '*secret*' \) -print -quit | grep -q .; then
    fail "Archive contains a blocked secret-like file name"
  fi
}

run_staging_checks() {
  log "running staging syntax checks"
  run_sudo env "PATH=$PATH_PREFIX" "$NPM_PATH" --prefix "$STAGE" run check
  run_sudo env "PATH=$PATH_PREFIX" "$NPM_PATH" --prefix "$STAGE" run check:macos
}

backup_target() {
  [ -d "$TARGET" ] || fail "Target directory not found: $TARGET"
  [ -f "$TARGET/server.js" ] || fail "Target does not look like Codex Mobile Web: $TARGET"
  log "creating backup: $BACKUP"
  run_sudo tar -czf "$BACKUP" \
    --exclude='./.agent-context' \
    --exclude='./node_modules' \
    --exclude='./logs' \
    --exclude='./data' \
    --exclude='./uploads' \
    -C "$TARGET" .
}

sync_target() {
  log "syncing public archive into target"
  run_sudo /usr/bin/rsync -a --delete --no-owner --no-group \
    --exclude='.agent-context/' \
    --exclude='.codex/' \
    --exclude='.codex-mobile-web/' \
    --exclude='node_modules/' \
    --exclude='logs/' \
    --exclude='data/' \
    --exclude='uploads/' \
    --exclude='.git/' \
    --exclude='AGENTS.md' \
    "$STAGE"/ "$TARGET"/
  run_sudo /usr/sbin/chown -R hermes-host:staff "$TARGET"
}

run_target_checks() {
  if [ "$SKIP_TARGET_TESTS" = "1" ]; then
    log "target tests skipped by request"
    return
  fi

  log "running target checks before restart"
  (
    cd "$TARGET"
    run_sudo env "PATH=$PATH_PREFIX" "$NPM_PATH" run check
    run_sudo env "PATH=$PATH_PREFIX" "$NPM_PATH" run check:macos
    run_sudo env "PATH=$PATH_PREFIX" "$NODE_PATH" --test \
      test/thread-detail-projection-service.test.js \
      test/turn-usage-summary-service.test.js \
      test/thread-item-timestamp-enrichment.test.js \
      test/turn-scroll-controls.test.js
  )
}

restart_service() {
  if [ "$SKIP_RESTART" = "1" ]; then
    log "service restart skipped by request"
    return
  fi
  log "restarting system/$SERVICE_LABEL"
  run_sudo /bin/launchctl kickstart -k "system/$SERVICE_LABEL"
}

wait_for_public_config() {
  local deadline
  deadline=$((SECONDS + 45))
  until /usr/bin/curl -fsS "http://127.0.0.1:${PORT}/api/public-config" >/dev/null 2>/dev/null; do
    if [ "$SECONDS" -ge "$deadline" ]; then
      fail "Timed out waiting for /api/public-config"
    fi
    sleep 1
  done
}

smoke_status() {
  log "running post-restart smoke without printing key material"
  cat > "$SMOKE_SCRIPT" <<'NODE'
const fs = require("node:fs");
const http = require("node:http");

const port = Number(process.argv[2]);
const keyFile = process.argv[3];

function getJson(pathname, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: "127.0.0.1",
      port,
      path: pathname,
      method: "GET",
      headers,
      timeout: 8000,
    }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`${pathname} returned HTTP ${res.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on("timeout", () => req.destroy(new Error(`${pathname} timed out`)));
    req.on("error", reject);
    req.end();
  });
}

(async () => {
  const publicConfig = await getJson("/api/public-config");
  const key = fs.readFileSync(keyFile, "utf8").trim();
  const status = await getJson("/api/status", { "x-codex-mobile-key": key });
  const safe = {
    publicConfig: {
      version: publicConfig.version,
      clientBuildId: publicConfig.clientBuildId,
      shellCacheName: publicConfig.shellCacheName,
      platform: publicConfig.platform,
      authRequired: publicConfig.authRequired,
    },
    status: {
      ok: status.ok,
      activeProfileId: status.codexProfiles && status.codexProfiles.activeProfileId,
      activeCodexHomeSource: status.codexProfiles && status.codexProfiles.activeCodexHomeSource,
      threadCount: Array.isArray(status.threads) ? status.threads.length : undefined,
    },
  };
  console.log(JSON.stringify(safe, null, 2));
})().catch((error) => {
  console.error(error && error.message ? error.message : String(error));
  process.exit(1);
});
NODE
  run_sudo env "PATH=$PATH_PREFIX" "$NODE_PATH" "$SMOKE_SCRIPT" "$PORT" "$ACCESS_KEY_FILE"
}

require_safe_paths
trap cleanup EXIT

IFS= read -r SUDO_PASSWORD_VALUE || true
[ -n "${SUDO_PASSWORD_VALUE:-}" ] || fail "sudo password was not provided on stdin"
run_sudo -v >/dev/null

log "deploy id: $DEPLOY_ID"
log "target: $TARGET"
rm -rf "$STAGE"
mkdir -p "$STAGE"
tar -xf "$ARCHIVE" -C "$STAGE"
verify_no_private_paths "$STAGE"
run_staging_checks
backup_target
sync_target
run_target_checks
restart_service
wait_for_public_config
smoke_status
log "deployment complete"
'@

$replacementMap = @{
  "__DEPLOY_ID__" = (ConvertTo-ShellSingleQuoted $deployId)
  "__REMOTE_ARCHIVE__" = (ConvertTo-ShellSingleQuoted $remoteArchive)
  "__TARGET_PATH__" = (ConvertTo-ShellSingleQuoted $TargetPath)
  "__SERVICE_LABEL__" = (ConvertTo-ShellSingleQuoted $ServiceLabel)
  "__NODE_PATH__" = (ConvertTo-ShellSingleQuoted $NodePath)
  "__NPM_PATH__" = (ConvertTo-ShellSingleQuoted $NpmPath)
  "__ACCESS_KEY_FILE__" = (ConvertTo-ShellSingleQuoted $AccessKeyFile)
  "__PORT__" = "$Port"
  "__SKIP_RESTART__" = $(if ($SkipRestart) { "1" } else { "0" })
  "__SKIP_TARGET_TESTS__" = $(if ($SkipTargetTests) { "1" } else { "0" })
}

foreach ($key in $replacementMap.Keys) {
  $remoteScriptText = $remoteScriptText.Replace($key, $replacementMap[$key])
}

try {
  Invoke-Checked "git" @("-C", $PublicRepoPath, "archive", "--format=tar", "--output=$localArchive", $resolvedCommit)
  [System.IO.File]::WriteAllText($localRemoteScript, $remoteScriptText, [System.Text.UTF8Encoding]::new($false))

  Write-Host "[macos-plugin-deploy] public repo: $PublicRepoPath"
  Write-Host "[macos-plugin-deploy] commit: $shortCommit ($resolvedCommit)"
  Write-Host "[macos-plugin-deploy] archive: $localArchive"
  Write-Host "[macos-plugin-deploy] target: $HostAlias`:$TargetPath"

  if ($DryRun) {
    Write-Host "[macos-plugin-deploy] dry run complete; no files copied to remote host."
    return
  }

  if (-not $SudoPasswordFile) {
    throw "SudoPasswordFile is required for remote staging, target sync, restart, and smoke validation."
  }
  if (-not (Test-Path -LiteralPath $SudoPasswordFile -PathType Leaf)) {
    throw "Sudo password file not found: $SudoPasswordFile"
  }

  Invoke-Checked "scp" @($localArchive, "${HostAlias}:$remoteArchive")
  Invoke-Checked "scp" @($localRemoteScript, "${HostAlias}:$remoteScript")
  Invoke-Checked "ssh" @($HostAlias, "chmod 700 $(ConvertTo-ShellSingleQuoted $remoteScript)")

  $sudoPassword = (Get-Content -Raw -LiteralPath $SudoPasswordFile).TrimEnd([char[]]"`r`n")
  if ([string]::IsNullOrEmpty($sudoPassword)) {
    throw "Sudo password file is empty."
  }

  $remoteCommand = "bash $(ConvertTo-ShellSingleQuoted $remoteScript)"
  ($sudoPassword + "`n") | & ssh $HostAlias $remoteCommand
  if ($LASTEXITCODE -ne 0) {
    throw "Remote macOS plugin deployment failed."
  }
} finally {
  Remove-Item -LiteralPath $localArchive -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $localRemoteScript -Force -ErrorAction SilentlyContinue
}
