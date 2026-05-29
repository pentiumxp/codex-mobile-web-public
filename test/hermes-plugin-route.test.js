"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const serverJs = fs.readFileSync(path.resolve(__dirname, "..", "server.js"), "utf8");
const appJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "app.js"), "utf8");
const indexHtml = fs.readFileSync(path.resolve(__dirname, "..", "public", "index.html"), "utf8");
const stylesCss = fs.readFileSync(path.resolve(__dirname, "..", "public", "styles.css"), "utf8");
const startScript = fs.readFileSync(path.resolve(__dirname, "..", "start-codex-mobile-web.ps1"), "utf8");
const windowlessStartScript = fs.readFileSync(path.resolve(__dirname, "..", "start-codex-mobile-web-windowless.ps1"), "utf8");
const startupInstallScript = fs.readFileSync(path.resolve(__dirname, "..", "install-codex-mobile-web-startup.ps1"), "utf8");

test("server exposes Hermes plugin manifest, registration, origin, launch, and session routes", () => {
  assert.match(serverJs, /"\/api\/v1\/hermes\/plugin\/manifest"/);
  assert.match(serverJs, /"\/api\/v1\/hermes\/plugin\/workspaces"/);
  assert.match(serverJs, /"\/api\/v1\/hermes\/plugin\/callbacks"/);
  assert.match(serverJs, /"\/api\/v1\/hermes\/plugin\/origins"/);
  assert.match(serverJs, /"\/api\/v1\/hermes\/plugin\/launch"/);
  assert.match(serverJs, /"\/api\/v1\/hermes\/plugin\/session"/);
  assert.match(serverJs, /isAccessKeyAuthorized\(req\)/);
  assert.match(serverJs, /isSessionAuthorized\(requestAuthToken\(req\)\)/);
  assert.match(serverJs, /Authorization/);
  assert.match(serverJs, /CODEX_MOBILE_HERMES_PLUGIN_BASE_URL/);
  assert.match(serverJs, /CODEX_MOBILE_PUBLIC_BASE_URL/);
  assert.match(serverJs, /CODEX_MOBILE_HERMES_PLUGIN_FRAME_ORIGINS/);
  assert.match(serverJs, /Content-Security-Policy/);
  assert.match(serverJs, /frameAncestorsHeader\(\)/);
});

test("Hermes plugin launch token is a browser-session key, not local storage login state", () => {
  assert.match(appJs, /codexPluginLaunch/);
  assert.match(appJs, /INITIAL_PLUGIN_EMBED\.embedded \? "" : localStorage\.getItem\("codexMobileKey"\)/);
  assert.match(appJs, /pluginLaunchSession: Boolean\(INITIAL_PLUGIN_LAUNCH_KEY\)/);
  assert.match(appJs, /\/api\/v1\/hermes\/plugin\/session/);
  assert.match(appJs, /scrubPluginLaunchUrl\(\)/);
});

test("embedded plugin mode hides standalone chrome and installs navigation/windowing hooks", () => {
  assert.match(indexHtml, /params\.get\("embed"\) === "hermes"/);
  assert.match(indexHtml, /documentElement\.classList\.add\("embed-hermes"\)/);
  assert.match(indexHtml, /<script src="\/plugin-embed\.js"><\/script>/);
  assert.match(stylesCss, /html\.embed-hermes \.sidebar[\s\S]*display:\s*none !important;/);
  assert.match(stylesCss, /html\.embed-hermes \.app[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(appJs, /codex-mobile\.plugin\.navigation|pluginEmbedApi\.navigationMessage/);
  assert.match(appJs, /hermes\.plugin\.back|pluginEmbedApi\.isBackMessage/);
  assert.match(appJs, /installPluginWindowingGuards\(\)/);
  assert.match(appJs, /window\.open = function guardedPluginOpen/);
});

test("Windows startup scripts can persist HTTPS Hermes plugin deployment settings", () => {
  assert.match(startScript, /\[string\]\$HermesPluginBaseUrl/);
  assert.match(startScript, /\$env:CODEX_MOBILE_HERMES_PLUGIN_BASE_URL = \$HermesPluginBaseUrl/);
  assert.match(startScript, /\[string\]\$PublicBaseUrl/);
  assert.match(startScript, /\$env:CODEX_MOBILE_PUBLIC_BASE_URL = \$PublicBaseUrl/);
  assert.match(startScript, /\[string\]\$HermesPluginFrameOrigins/);
  assert.match(startScript, /\$env:CODEX_MOBILE_HERMES_PLUGIN_FRAME_ORIGINS = \$HermesPluginFrameOrigins/);

  assert.match(windowlessStartScript, /\[string\]\$HermesPluginBaseUrl/);
  assert.match(windowlessStartScript, /\$parameters\.HermesPluginBaseUrl = \$HermesPluginBaseUrl/);
  assert.match(windowlessStartScript, /\$parameters\.HermesPluginFrameOrigins = \$HermesPluginFrameOrigins/);

  assert.match(startupInstallScript, /\[string\]\$HermesPluginBaseUrl/);
  assert.match(startupInstallScript, /"-HermesPluginBaseUrl", \(Quote-TaskArgument \$HermesPluginBaseUrl\)/);
  assert.match(startupInstallScript, /"-HermesPluginFrameOrigins", \(Quote-TaskArgument \$HermesPluginFrameOrigins\)/);
});
