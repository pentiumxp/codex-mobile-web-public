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
  assert.match(serverJs, /codexProfileService\.setActiveProfile/);
  assert.match(serverJs, /activeProfileRestartOptions\(profile\)/);
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
