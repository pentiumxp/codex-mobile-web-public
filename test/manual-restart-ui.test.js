"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const appJs = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const stylesCss = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");
const serverJs = fs.readFileSync(path.join(root, "server.js"), "utf8");
const restartScript = fs.readFileSync(path.join(root, "restart-codex-mobile-shared-chain.ps1"), "utf8");
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const pkg = fs.readFileSync(path.join(root, "package.json"), "utf8");

test("sidebar exposes a confirmed manual restart action beside the version pill", () => {
  assert.match(indexHtml, /class="version-actions"[\s\S]*id="appUpdateStatus"[\s\S]*id="sharedRestartButton"/);
  assert.match(indexHtml, /id="restartConfirmDialog"[\s\S]*id="restartConfirmProceed"/);
  assert.match(stylesCss, /\.version-actions/);
  assert.match(stylesCss, /html\.embed-hermes \.main \.version-actions/);
  assert.match(stylesCss, /\.restart-button/);
  assert.match(stylesCss, /\.restart-confirm-dialog/);
  assert.match(stylesCss, /\.restart-confirm-panel/);
  assert.match(appJs, /function handleSharedRestartClick\(\)/);
  const restartBody = appJs.slice(appJs.indexOf("async function handleSharedRestartClick()"), appJs.indexOf("function serverBuildIdFromConfig"));
  assert.doesNotMatch(restartBody, /window\.confirm\(/);
  assert.match(restartBody, /fetchRestartRiskThreads\(\)/);
  assert.match(restartBody, /requestSharedRestartConfirmation/);
  assert.match(restartBody, /saveRestartAutoRecoverThreads\(riskThreads\)/);
  assert.match(restartBody, /state\.appServerWasUnavailable = true/);
  assert.match(appJs, /\/api\/restart\/shared-chain/);
  assert.match(appJs, /sharedRestartButton"\)\)\s*\$\("sharedRestartButton"\)\.addEventListener\("click"/);
  assert.match(appJs, /restartConfirmProceed"\)\)\s*\$\("restartConfirmProceed"\)\.addEventListener\("click"/);
});

test("manual restart route delegates to the shared-chain restart service", () => {
  assert.match(serverJs, /createSharedChainRestartService/);
  assert.match(serverJs, /sharedChainRestartService\.restart/);
  assert.match(serverJs, /\/api\/restart\/shared-chain/);
  assert.match(serverJs, /activeProfileRestartOptions\(\)/);
  assert.match(serverJs, /sendJson\(res,\s*202,\s*result\)/);
  assert.match(pkg, /adapters\/shared-chain-restart-service\.js/);
});

test("profile switch restart passes the selected profile to the shared-chain script", () => {
  assert.match(serverJs, /function activeProfileRestartOptions\(profile = null\)/);
  assert.match(serverJs, /profileId:\s*selected\.id/);
  assert.match(serverJs, /codexHome:\s*selected\.codexHome/);
  assert.match(serverJs, /const preflight = await preflightCodexProfileSwitch\(targetProfile,\s*\{/);
  assert.match(serverJs, /syncRegisteredWorkspaceTrust\(targetProfile\.codexHome\)/);
  assert.match(serverJs, /syncCodexMobileMcpToolset\(targetProfile\.codexHome\)/);
  assert.match(serverJs, /codexProfileService\.setActiveProfile/);
  assert.ok(
    serverJs.indexOf("const preflight = await preflightCodexProfileSwitch(targetProfile, {") < serverJs.indexOf("const profile = codexProfileService.setActiveProfile(targetProfile.id)"),
    "profile switch must preflight the target account before writing active profile state",
  );
  assert.ok(
    serverJs.indexOf("syncRegisteredWorkspaceTrust(targetProfile.codexHome)") < serverJs.indexOf("const profile = codexProfileService.setActiveProfile(targetProfile.id)"),
    "profile switch should trust registered workspaces in the target profile before restart",
  );
  assert.ok(
    serverJs.indexOf("syncCodexMobileMcpToolset(targetProfile.codexHome)") < serverJs.indexOf("const preflight = await preflightCodexProfileSwitch(targetProfile, {"),
    "profile switch should register the Codex Mobile MCP toolset before target preflight",
  );
  assert.ok(
    serverJs.indexOf("const profile = codexProfileService.setActiveProfile(targetProfile.id)") < serverJs.indexOf("sharedChainRestartService.restart(Object.assign({"),
    "profile switch must not restart before the active profile is written",
  );
  assert.match(serverJs, /activeProfileRestartOptions\(profile\)/);
  assert.match(serverJs, /sendJson\(res,\s*err\.statusCode \|\| 500,[\s\S]*code:\s*err\.code \|\| undefined/);
  assert.match(serverJs, /target_profile_auth_invalid/);
  assert.match(serverJs, /profileSwitchProgress/);
  assert.match(serverJs, /\/api\/codex-profiles\/switch-progress/);
  assert.match(serverJs, /preflight_rate_limits/);
  const connectBody = serverJs.slice(
    serverJs.indexOf("function connectPreflightWebSocket"),
    serverJs.indexOf("function preflightRpc"),
  );
  assert.match(connectBody, /setTimeout\(attempt,\s*200\)/);
  assert.match(connectBody, /profile switch preflight websocket timeout/);
  assert.match(appJs, /codexProfileSwitchTargetId/);
  assert.match(appJs, /codex-profile-progress/);
  assert.match(appJs, /startCodexProfileSwitchProgressPolling/);
  assert.match(appJs, /正在读取目标 Profile/);
  assert.match(appJs, /正在读取目标账号额度并确认登录/);
  assert.match(appJs, /timeoutMs:\s*90000/);
  assert.match(stylesCss, /\.codex-profile-main \.codex-profile-progress/);
  assert.match(serverJs, /function syncCodexMobileMcpToolset\(codexHome = CODEX_HOME\)/);
  assert.match(serverJs, /function syncKnownCodexMobileMcpToolsets\(profileOptions = \{\}\)/);
  assert.match(serverJs, /codexProfileService\.profiles\(profileOptions\)/);
  assert.match(serverJs, /syncKnownCodexMobileMcpToolsets\(\)/);
  assert.match(serverJs, /syncKnownCodexMobileMcpToolsets\(\{ activeQuota \}\)/);
});

test("shared-chain restart cleans stale bare node server listener on the selected port", () => {
  assert.match(restartScript, /function Get-PortListenerProcessIds/);
  assert.match(restartScript, /Get-NetTCPConnection -LocalPort \$Port -State Listen/);
  assert.match(restartScript, /\$portListenerProcessIds = Get-PortListenerProcessIds/);
  assert.match(restartScript, /\$portListenerProcessIds -contains \[int\]\$_\.ProcessId/);
  assert.match(restartScript, /\$name -ieq "node\.exe"[\s\S]*server\\\.js/);
});

test("manual restart distinguishes macOS Mobile Web restart scope", () => {
  assert.match(serverJs, /platform:\s*process\.platform/);
  assert.match(appJs, /serverPlatform:\s*""/);
  assert.match(appJs, /state\.serverPlatform = String\(config\.platform \|\| ""\)/);
  assert.match(appJs, /state\.serverPlatform === "darwin"/);
  assert.match(appJs, /重启这台 Mac 上的 Mobile Web 服务/);
  assert.match(appJs, /不会重启 Codex Desktop、shared mux 或其它本机服务/);
  assert.match(readme, /On macOS, the same endpoint restarts only the current Mobile Web listener/);
  assert.match(readme, /without triggering the macOS `Quit Codex\?` confirmation/);
});
