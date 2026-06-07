"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const scriptPath = path.resolve(__dirname, "..", "scripts", "deploy-macos-plugin.ps1");
const script = fs.readFileSync(scriptPath, "utf8");

function assertBefore(left, right, message) {
  const leftIndex = script.indexOf(left);
  const rightIndex = script.indexOf(right);
  assert.notEqual(leftIndex, -1, `${left} is missing`);
  assert.notEqual(rightIndex, -1, `${right} is missing`);
  assert.ok(leftIndex < rightIndex, message || `${left} must appear before ${right}`);
}

test("macOS plugin deployment uses a clean public git archive as the only source", () => {
  assert.match(script, /\$PublicRepoPath = ""/);
  assert.match(script, /Join-Path \$workspaceParent "codex-mobile-web-public"/);
  assert.match(script, /git -C \$PublicRepoPath status --short/);
  assert.match(script, /git -C \$PublicRepoPath rev-parse --abbrev-ref HEAD/);
  assert.match(script, /git -C \$PublicRepoPath ls-tree -r --name-only \$resolvedCommit/);
  assert.match(script, /Assert-NoBlockedArchivePath -Paths \$treeFiles/);
  assert.match(script, /Invoke-Checked "git" @\("-C", \$PublicRepoPath, "archive"/);
  assert.match(script, /"--format=tar"/);
  assert.match(script, /"--output=\$localArchive"/);
  assert.doesNotMatch(script, /Compress-Archive/);
  assert.doesNotMatch(script, /Copy-Item .*codex-mobile-web/s);
});

test("macOS plugin deployment rejects private, runtime, and secret-like archive paths", () => {
  for (const name of [
    ".agent-context",
    ".codex-mobile-web",
    "node_modules",
    "logs",
    "data",
    "uploads",
    "access_key",
    "auth\\.json",
    ".*secret.*",
    "\\.(pem|key)",
  ]) {
    assert.match(script, new RegExp(name));
  }

  assert.match(script, /verify_no_private_paths/);
  assert.match(script, /-name 'auth\.json'/);
  assert.match(script, /-name 'access_key'/);
  assert.match(script, /-iname '\*secret\*'/);
});

test("macOS plugin deployment validates staging before any production backup or sync", () => {
  assertBefore("run_staging_checks", "backup_target", "staging checks must precede backup");
  assertBefore("backup_target", "sync_target", "backup must precede target sync");

  const stagingFunction = script.slice(script.indexOf("run_staging_checks"), script.indexOf("backup_target"));
  assert.match(stagingFunction, /run check/);
  assert.match(stagingFunction, /run check:macos/);
  assert.doesNotMatch(stagingFunction, /--test/);
});

test("macOS plugin deployment preserves local production state while syncing product files", () => {
  assert.match(script, /run_sudo \/usr\/bin\/rsync -a --delete --no-owner --no-group/);
  for (const excluded of [
    ".agent-context/",
    ".codex/",
    ".codex-mobile-web/",
    "node_modules/",
    "logs/",
    "data/",
    "uploads/",
    ".git/",
    "AGENTS.md",
  ]) {
    assert.match(script, new RegExp(`--exclude='${excluded.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}'`));
  }
  assert.doesNotMatch(script, /--delete-excluded/);
});

test("macOS plugin deployment runs target tests before restarting LaunchDaemon", () => {
  assertBefore("sync_target", "run_target_checks", "target tests must run after sync");
  assertBefore("run_target_checks", "restart_service", "target tests must run before restart");
  assert.match(script, /test\/thread-detail-projection-service\.test\.js/);
  assert.match(script, /test\/turn-usage-summary-service\.test\.js/);
  assert.match(script, /test\/thread-item-timestamp-enrichment\.test\.js/);
  assert.match(script, /test\/turn-scroll-controls\.test\.js/);
  assert.match(script, /launchctl kickstart -k "system\/\$SERVICE_LABEL"/);
});

test("macOS plugin deployment reads sudo and access keys without printing key material", () => {
  assert.match(script, /run_sudo\(\) \{/);
  assert.match(script, /IFS= read -r SUDO_PASSWORD_VALUE/);
  assert.match(script, /printf '%s\\n' "\$SUDO_PASSWORD_VALUE" \| sudo -S -p '' "\$@"/);
  assert.match(script, /unset SUDO_PASSWORD_VALUE/);
  assert.doesNotMatch(script, /sudo -n/);
  assert.match(script, /fs\.readFileSync\(keyFile, "utf8"\)\.trim\(\)/);
  assert.match(script, /"x-codex-mobile-key": key/);
  assert.match(script, /SMOKE_SCRIPT="\/tmp\/\$\{DEPLOY_ID\}\.smoke\.js"/);
  assert.match(script, /cat > "\$SMOKE_SCRIPT" <<'NODE'/);
  assert.match(script, /run_sudo env "PATH=\$PATH_PREFIX" "\$NODE_PATH" "\$SMOKE_SCRIPT" "\$PORT" "\$ACCESS_KEY_FILE"/);
  assert.doesNotMatch(script, /cat "\$ACCESS_KEY_FILE"/);
  assert.doesNotMatch(script, /console\.log\(key\)/);
  assert.doesNotMatch(script, /Write-Host .*sudoPassword/i);
});
