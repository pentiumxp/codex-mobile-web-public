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
const pkg = fs.readFileSync(path.join(root, "package.json"), "utf8");

test("sidebar exposes a confirmed manual restart action beside the version pill", () => {
  assert.match(indexHtml, /class="version-actions"[\s\S]*id="appUpdateStatus"[\s\S]*id="sharedRestartButton"/);
  assert.match(stylesCss, /\.version-actions/);
  assert.match(stylesCss, /\.restart-button/);
  assert.match(appJs, /function handleSharedRestartClick\(\)/);
  assert.match(appJs, /window\.confirm\(/);
  assert.match(appJs, /\/api\/restart\/shared-chain/);
  assert.match(appJs, /sharedRestartButton"\)\)\s*\$\("sharedRestartButton"\)\.addEventListener\("click"/);
});

test("manual restart route delegates to the shared-chain restart service", () => {
  assert.match(serverJs, /createSharedChainRestartService/);
  assert.match(serverJs, /sharedChainRestartService\.restart/);
  assert.match(serverJs, /\/api\/restart\/shared-chain/);
  assert.match(serverJs, /sendJson\(res,\s*202,\s*result\)/);
  assert.match(pkg, /adapters\/shared-chain-restart-service\.js/);
});
