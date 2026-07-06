"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { readFrontendSources } = require("./frontend-source-helper");
const { createServerHttpRuntimeService } = require("../services/runtime/server-http-runtime-service");

const serverJs = fs.readFileSync(path.resolve(__dirname, "..", "server.js"), "utf8");
const serverRuntimeConfigServiceJs = fs.readFileSync(
  path.resolve(__dirname, "..", "services", "runtime", "server-runtime-config-service.js"),
  "utf8",
);
const serverRouteCompositionServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "server-routes", "server-route-composition-service.js"), "utf8");
const coreApiRouteServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "server-routes", "core-api-route-service.js"), "utf8");
const notificationRuntimeServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "services", "runtime", "notification-runtime-service.js"), "utf8");
const webPushRuntimeServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "adapters", "web-push-runtime-service.js"), "utf8");
const staticFileServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "adapters", "static-file-service.js"), "utf8");
const serverHttpRuntimeServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "services", "runtime", "server-http-runtime-service.js"), "utf8");
const appJs = readFrontendSources(path.resolve(__dirname, ".."));
const pluginEmbedJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "plugin-embed.js"), "utf8");
const indexHtml = fs.readFileSync(path.resolve(__dirname, "..", "public", "index.html"), "utf8");
const stylesCss = fs.readFileSync(path.resolve(__dirname, "..", "public", "styles.css"), "utf8");
const startScript = fs.readFileSync(path.resolve(__dirname, "..", "start-codex-mobile-web.ps1"), "utf8");
const windowlessStartScript = fs.readFileSync(path.resolve(__dirname, "..", "start-codex-mobile-web-windowless.ps1"), "utf8");
const startupInstallScript = fs.readFileSync(path.resolve(__dirname, "..", "install-codex-mobile-web-startup.ps1"), "utf8");

function functionBody(source, name) {
  let start = source.indexOf(`function ${name}(`);
  if (start === -1) start = source.indexOf(`async function ${name}(`);
  assert.notEqual(start, -1, `${name} not found`);
  const signatureEnd = source.indexOf(") {", start);
  const brace = source.indexOf("{", signatureEnd === -1 ? start : signatureEnd);
  let depth = 0;
  for (let index = brace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`${name} body not closed`);
}

test("server exposes Hermes plugin manifest, registration, origin, launch, session, and notification routes", () => {
  assert.match(serverJs, /createServerRouteCompositionService/);
  assert.match(serverRouteCompositionServiceJs, /createCoreApiRouteService/);
  assert.match(coreApiRouteServiceJs, /"\/api\/v1\/hermes\/plugin\/manifest"/);
  assert.match(coreApiRouteServiceJs, /"\/api\/v1\/hermes\/plugin\/workspaces"/);
  assert.match(coreApiRouteServiceJs, /"\/api\/v1\/hermes\/plugin\/callbacks"/);
  assert.match(coreApiRouteServiceJs, /"\/api\/v1\/hermes\/plugin\/origins"/);
  assert.match(coreApiRouteServiceJs, /"\/api\/v1\/hermes\/plugin\/launch"/);
  assert.match(coreApiRouteServiceJs, /"\/api\/v1\/hermes\/plugin\/session"/);
  assert.match(coreApiRouteServiceJs, /readPluginSessionFromRequest/);
  assert.match(coreApiRouteServiceJs, /requestAuthTokens/);
  assert.match(coreApiRouteServiceJs, /"\/api\/v1\/hermes\/plugin\/notifications"/);
  assert.match(serverJs, /createHermesNotificationDelegateService/);
  assert.match(serverJs, /createNotificationRuntimeService/);
  assert.match(notificationRuntimeServiceJs, /webPushRuntimeServiceFactory/);
  assert.match(notificationRuntimeServiceJs, /buildTurnCompletionDetailMessage/);
  assert.match(webPushRuntimeServiceJs, /detailMessage/);
  assert.match(webPushRuntimeServiceJs, /delegateTurnCompletedNotification/);
  assert.match(serverRuntimeConfigServiceJs, /CODEX_MOBILE_HERMES_PLUGIN_NOTIFICATION_BASE_URL/);
  assert.match(serverRuntimeConfigServiceJs, /CODEX_MOBILE_HERMES_PLUGIN_NOTIFICATION_KEY_FILE/);
  assert.match(coreApiRouteServiceJs, /notificationDelegateConfigured/);
  assert.match(coreApiRouteServiceJs, /isAccessKeyAuthorized\(req\)/);
  assert.match(serverHttpRuntimeServiceJs, /const tokens = requestAuthTokens\(req\);[\s\S]*tokens\.some\(\(token\) => hermesPluginService\.isSessionAuthorized\(token\)\)/);
  assert.match(coreApiRouteServiceJs, /pluginSessionCookieHeader\(req, session\)/);
  assert.match(serverHttpRuntimeServiceJs, /Authorization/);
  assert.match(serverRuntimeConfigServiceJs, /CODEX_MOBILE_HERMES_PLUGIN_BASE_URL/);
  assert.match(serverRuntimeConfigServiceJs, /CODEX_MOBILE_PUBLIC_BASE_URL/);
  assert.match(serverRuntimeConfigServiceJs, /CODEX_MOBILE_HERMES_PLUGIN_FRAME_ORIGINS/);
  assert.match(staticFileServiceJs, /Content-Security-Policy/);
  assert.match(staticFileServiceJs, /frameAncestorsHeader\(\)/);
});

test("HTTP runtime accepts Hermes plugin session cookies as auth tokens", () => {
  const httpRuntime = createServerHttpRuntimeService({
    disableAuth: false,
    getAuthKey: () => "mobile-access-key",
    getHermesPluginService: () => ({
      isSessionAuthorized: (token) => token === "plugin-session-key",
      isLaunchTokenAuthorized: () => false,
    }),
  });
  const req = {
    url: "/api/threads",
    headers: {
      host: "127.0.0.1:8787",
      cookie: "codex_mobile_plugin_session=plugin-session-key",
    },
  };
  assert.deepEqual(httpRuntime.requestAuthTokens(req), ["plugin-session-key"]);
  assert.equal(httpRuntime.isAccessKeyAuthorized(req), false);
  assert.equal(httpRuntime.isAuthorized(req), true);
});

test("Hermes plugin launch token is a browser-session key, not local storage login state", () => {
  assert.match(appJs, /codexPluginLaunch/);
  assert.match(appJs, /INITIAL_PLUGIN_EMBED\.embedded \? "" : localStorage\.getItem\("codexMobileKey"\)/);
  assert.match(appJs, /pluginLaunchSession: Boolean\(INITIAL_PLUGIN_LAUNCH_KEY\)/);
  assert.match(appJs, /pluginLaunchTarget: null/);
  assert.match(appJs, /pluginAppearance: INITIAL_PLUGIN_EMBED\.appearance \|\| null/);
  assert.match(appJs, /queuedPluginRouteHint: INITIAL_PLUGIN_EMBED\.routeHint \|\| null/);
  assert.match(appJs, /\/api\/v1\/hermes\/plugin\/session/);
  assert.match(appJs, /pluginLaunchExchangePromise/);
  assert.match(appJs, /pluginLaunchExchangeCompletedKey/);
  assert.match(appJs, /state\.pluginLaunchTarget = result && result\.target/);
  assert.match(appJs, /applyPluginAppearancePreference\(result && result\.appearance\)/);
  assert.match(appJs, /function applyPluginAppearancePreference\(value\)/);
  assert.match(appJs, /function currentPluginAppearanceForHost\(\)/);
  assert.match(appJs, /syncPluginAppearanceStateFromPreferences\(\)/);
  assert.match(appJs, /pluginTheme/);
  assert.match(appJs, /pluginFontSize/);
  assert.match(appJs, /async function applyPluginLaunchTarget\(\)/);
  assert.match(appJs, /function normalizePluginRouteHint\(value\)/);
  assert.match(appJs, /function applyUrlPluginRouteHint\(options = \{\}\)/);
  assert.match(appJs, /async function openHermesPluginRouteHint\(hint\)/);
  assert.match(appJs, /openExternalThreadSelection\(plan\.threadId, \{[\s\S]*source: "route-hint",[\s\S]*suppressLoadFailureDiagnostic: true,[\s\S]*\}\)/);
  assert.match(appJs, /pluginRouteHintFromUrl\(window\.location\.href\)/);
  assert.match(appJs, /pluginEmbedApi\.routeHintOpenPlan\(hint\)/);
  assert.match(appJs, /pluginEmbedApi\.routeHintFocusPlan\(hint/);
  assert.match(pluginEmbedJs, /Notification target is unavailable/);
  assert.match(pluginEmbedJs, /Notification target is no longer available/);
  assert.match(pluginEmbedJs, /Opened notification target/);
  assert.match(appJs, /scrubPluginLaunchUrl\(\)/);
});

test("embedded plugin mode hides standalone chrome and installs navigation/windowing hooks", () => {
  assert.match(indexHtml, /params\.get\("embed"\) === "hermes"/);
  assert.match(indexHtml, /function readPluginAppearance\(\)/);
  assert.match(indexHtml, /params\.get\("pluginTheme"\)/);
  assert.match(indexHtml, /params\.get\("pluginFontSize"\)/);
  assert.match(indexHtml, /localStorage\.getItem\("codexMobileFontSize"\)[\s\S]*if \(allowedFontSizes\[value\]\) return value;[\s\S]*var pluginAppearance = readPluginAppearance\(\);/);
  assert.match(appJs, /fontSize: localStorage\.getItem\("codexMobileFontSize"\)[\s\S]*INITIAL_PLUGIN_EMBED\.appearance && INITIAL_PLUGIN_EMBED\.appearance\.fontSize/);
  assert.match(appJs, /function storedFontSizePreference\(\)/);
  assert.match(appJs, /(?:const|var) storedFontSize = storedFontSizePreference\(\);[\s\S]*if \(appearance\.fontSize && !storedFontSize\)/);
  assert.match(appJs, /if \(storedFontSize\) \{[\s\S]*state\.pluginAppearance = Object\.assign\([\s\S]*fontSize: storedFontSize/);
  assert.match(appJs, /if \(isHermesEmbedMode\(\)\) \{[\s\S]*syncPluginAppearanceStateFromPreferences\(\);[\s\S]*scrubPluginLaunchUrl\(\);[\s\S]*publishPluginNavigationState\(\{ force: true \}\);/);
  assert.match(indexHtml, /document\.documentElement\.setAttribute\("data-font-size", initialFontSize\)/);
  assert.match(indexHtml, /documentElement\.classList\.add\("embed-hermes"\)/);
  assert.match(indexHtml, /<script src="\/plugin-embed\.js"><\/script>/);
  assert.doesNotMatch(indexHtml, /id="embedSettingsToggle"/);
  assert.doesNotMatch(stylesCss, /html\.embed-hermes \.sidebar,\s*\nhtml\.embed-hermes #openMenu/);
  assert.match(stylesCss, /html\.embed-hermes \.sidebar\s*{[\s\S]*position:\s*fixed;[\s\S]*transform:\s*translateX\(-105%\);/);
  assert.match(stylesCss, /html\.embed-hermes \.sidebar\.open\s*{[\s\S]*transform:\s*translateX\(0\);/);
  assert.match(stylesCss, /html\.embed-hermes \.sidebar\.edge-dragging\s*{[\s\S]*translateX\(calc\(-100% \+ var\(--sidebar-edge-x, 0px\)\)\)/);
  assert.match(stylesCss, /html\.embed-hermes\.embed-hermes-primary \.sidebar\s*{[\s\S]*position:\s*relative;[\s\S]*transform:\s*none !important;/);
  assert.match(stylesCss, /html\.embed-hermes\.embed-hermes-primary \.main\s*{[\s\S]*display:\s*none;/);
  assert.match(stylesCss, /html\.embed-hermes\.embed-hermes-primary #closeMenu\s*{[\s\S]*display:\s*none !important;/);
  assert.match(stylesCss, /html\.embed-hermes \.app[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(appJs, /codex-mobile\.plugin\.navigation|pluginEmbedApi\.navigationMessage/);
  assert.match(appJs, /codex-mobile\.plugin\.back_result|postPluginBackResult|pluginEmbedApi\.postBackResult/);
  assert.match(appJs, /hermes\.plugin\.back|pluginEmbedApi\.isBackMessage/);
  assert.match(appJs, /handlePluginBack\(event, \{ source: "plugin-back-message" \}\)/);
  assert.doesNotMatch(appJs, /openEmbedSettingsPanel/);
  assert.doesNotMatch(appJs, /function isPluginRootSwipeTarget/);
  assert.match(appJs, /function isHermesPluginPrimaryPage\(\)/);
  assert.match(appJs, /function showHermesPluginPrimaryPage\(options = \{\}\)/);
  assert.match(appJs, /function handlePluginBack\(event, options = \{\}\) \{[\s\S]*if \(shouldSuppressPluginBackForRecentConversationScroll\(source\)\) return true;/);
  assert.match(appJs, /function beginSidebarEdgeSwipe\(event\) \{\s*if \(!isMobileViewport\(\) \|\| isHermesEmbedMode\(\)/);
  assert.match(appJs, /else if \(state\.currentThreadId \|\| state\.newThreadDraft \|\| state\.selectedCwd\) \{[\s\S]*handled = showHermesPluginPrimaryPage\(\{ force: true, source \}\);/);
  assert.doesNotMatch(appJs, /host_back_from_settings/);
  assert.doesNotMatch(appJs, /host_back_from_sidebar/);
  assert.doesNotMatch(appJs, /else if \(\$\("themeSettingsPanel"\)[\s\S]{0,180}closeSidebarMenu\(\);[\s\S]{0,80}handled = true;/);
  assert.doesNotMatch(appJs, /function returnPluginRootStep/);
  assert.doesNotMatch(appJs, /function openPluginNavigationSurface/);
  assert.match(appJs, /addEventListener\("touchstart", beginSidebarEdgeSwipe, \{ passive: false \}\)/);
  assert.match(appJs, /function pushBrowserAvailable\(\) \{\s*if \(isHermesEmbedMode\(\)\) return false;/);
  assert.match(appJs, /function showCompletionAlert\(threadId, threadName\) \{\s*if \(isHermesEmbedMode\(\)\) return;/);
  assert.match(appJs, /installPluginWindowingGuards\(\)/);
  assert.match(appJs, /window\.open = function guardedPluginOpen/);
  assert.match(appJs, /function openPluginExternalBrowserLink\(rawHref, options = \{\}\)/);
  assert.match(appJs, /pluginEmbedApi\.postExternalLink\(window\.parent, \{/);
  assert.match(appJs, /plugin_external_link_opened/);
  assert.doesNotMatch(appJs, /plugin_external_link_blocked", \{ href:/);
  assert.match(appJs, /function requestHermesPluginRefresh\(reason, options = \{\}\)/);
  assert.match(appJs, /if \(!isHermesEmbedMode\(\) \|\| !pluginEmbedApi\.postRefreshRequired\) return false;/);
  assert.match(appJs, /appearance: currentPluginAppearanceForHost\(\)/);
  assert.match(appJs, /pluginRefreshPendingNotice:\s*""/);
  assert.match(appJs, /function pluginRefreshPendingMessage\(reason\)/);
  assert.match(appJs, /state\.pluginRefreshPendingNotice = pluginRefreshPendingMessage\(normalizedReason\);/);
  assert.match(appJs, /Refreshing plugin page from Hermes Mobile\.\.\./);
  assert.match(appJs, /Refreshing plugin page for a new Mobile Web build\.\.\./);
  assert.match(appJs, /function renderPluginRefreshPendingNotice\(previousKeys = new Set\(\)\)/);
  assert.match(appJs, /plugin-refresh-pending/);
  assert.match(stylesCss, /\.plugin-refresh-pending/);
  assert.match(appJs, /pluginEmbedApi\.postRefreshRequired\(window\.parent, \{/);
  assert.match(appJs, /requestHermesPluginRefresh\("server_build_changed"/);
  assert.match(appJs, /requestHermesPluginRefresh\("auth_state_changed"/);
  assert.match(appJs, /function showPluginEmbedRecovering\(message = ""\)/);
  assert.match(appJs, /showPluginEmbedRecovering\("Refreshing Codex Mobile plugin session\.\.\."\)/);
  assert.match(appJs, /showPluginEmbedRecovering\("Refreshing Codex Mobile plugin launch\.\.\."\)/);
  assert.match(appJs, /targetOrigin:\s*targetOrigin \|\| "\*"/);
  assert.match(appJs, /function currentPluginParentWindowOrigin\(\)/);
  assert.match(appJs, /!window\.parent \|\| window\.parent === window \|\| !window\.parent\.location/);
  assert.match(appJs, /function normalizePluginParentOrigin\(value\) \{\s*const liveParentOrigin = currentPluginParentWindowOrigin\(\);/);
  assert.match(appJs, /function publishPluginNavigationState\(options = \{\}\) \{[\s\S]*const targetOrigin = normalizePluginParentOrigin\(state\.pluginParentOrigin\);[\s\S]*targetOrigin: targetOrigin \|\| "\*"/);
  assert.match(appJs, /function postPluginBackResult\(handled, reason\) \{[\s\S]*const targetOrigin = normalizePluginParentOrigin\(state\.pluginParentOrigin\);[\s\S]*targetOrigin: targetOrigin \|\| "\*"/);
  assert.match(appJs, /(?:const|var) hermesOrigin = normalizePluginParentOrigin\(result && result\.hermes_origin\)/);
  assert.match(appJs, /state\.pluginParentOrigin = hermesOrigin/);
  assert.match(appJs, /if \(assetsChanged && !serverBuildNeedsRefresh\) \{[\s\S]*state\.serverAssetBuildId = nextAssetBuildId;[\s\S]*return;/);
  assert.match(appJs, /if \(serverBuildNeedsRefresh\) \{\s*if \(isHermesEmbedMode\(\)\) \{[\s\S]*requestHermesPluginRefresh\("server_build_changed"\);[\s\S]*return;/);
  assert.match(functionBody(appJs, "initializePageBuildState"), /state\.pageRefreshPreparedConfig = config \|\| null;[\s\S]*if \(isHermesEmbedMode\(\)\) \{[\s\S]*requestHermesPluginRefresh\("server_build_changed", \{ force: true \}\);[\s\S]*return;/);
});

test("Windows startup scripts can persist HTTPS Hermes plugin deployment settings", () => {
  assert.match(startScript, /\[string\]\$HermesPluginBaseUrl/);
  assert.match(startScript, /\$env:CODEX_MOBILE_HERMES_PLUGIN_BASE_URL = \$HermesPluginBaseUrl/);
  assert.match(startScript, /\[string\]\$PublicBaseUrl/);
  assert.match(startScript, /\$env:CODEX_MOBILE_PUBLIC_BASE_URL = \$PublicBaseUrl/);
  assert.match(startScript, /\[string\]\$HermesPluginFrameOrigins/);
  assert.match(startScript, /\$env:CODEX_MOBILE_HERMES_PLUGIN_FRAME_ORIGINS = \$HermesPluginFrameOrigins/);
  assert.match(startScript, /\[string\]\$HermesPluginNotificationBaseUrl/);
  assert.match(startScript, /\$env:CODEX_MOBILE_HERMES_PLUGIN_NOTIFICATION_BASE_URL = \$HermesPluginNotificationBaseUrl/);
  assert.match(startScript, /\[string\]\$HermesPluginNotificationKeyFile/);
  assert.match(startScript, /\$env:CODEX_MOBILE_HERMES_PLUGIN_NOTIFICATION_KEY_FILE = \$HermesPluginNotificationKeyFile/);

  assert.match(windowlessStartScript, /\[string\]\$HermesPluginBaseUrl/);
  assert.match(windowlessStartScript, /\$parameters\.HermesPluginBaseUrl = \$HermesPluginBaseUrl/);
  assert.match(windowlessStartScript, /\$parameters\.HermesPluginFrameOrigins = \$HermesPluginFrameOrigins/);
  assert.match(windowlessStartScript, /\$parameters\.HermesPluginNotificationBaseUrl = \$HermesPluginNotificationBaseUrl/);
  assert.match(windowlessStartScript, /\$parameters\.HermesPluginNotificationKeyFile = \$HermesPluginNotificationKeyFile/);

  assert.match(startupInstallScript, /\[string\]\$HermesPluginBaseUrl/);
  assert.match(startupInstallScript, /"-HermesPluginBaseUrl", \(Quote-TaskArgument \$HermesPluginBaseUrl\)/);
  assert.match(startupInstallScript, /"-HermesPluginFrameOrigins", \(Quote-TaskArgument \$HermesPluginFrameOrigins\)/);
  assert.match(startupInstallScript, /"-HermesPluginNotificationBaseUrl", \(Quote-TaskArgument \$HermesPluginNotificationBaseUrl\)/);
  assert.match(startupInstallScript, /"-HermesPluginNotificationKeyFile", \(Quote-TaskArgument \$HermesPluginNotificationKeyFile\)/);
});

test("Windows startup installer supports system boot without losing target user profile", () => {
  assert.match(startupInstallScript, /\[switch\]\$RunAsSystem/);
  assert.match(startupInstallScript, /Installing with -RunAsSystem requires an elevated PowerShell session/);
  assert.match(startupInstallScript, /New-ScheduledTaskTrigger -AtStartup/);
  assert.match(startupInstallScript, /New-ScheduledTaskTrigger -AtLogOn -User \$UserId/);
  assert.match(startupInstallScript, /-UserId "SYSTEM"/);
  assert.match(startupInstallScript, /-LogonType ServiceAccount/);
  assert.match(startupInstallScript, /-RunLevel Highest/);
  assert.match(startupInstallScript, /"-UserProfilePath", \(Quote-TaskArgument \$installingUserProfile\)/);
  assert.match(startupInstallScript, /\$arguments \+= "-RunAsSystemTask"/);
  assert.match(windowlessStartScript, /\[switch\]\$RunAsSystemTask/);
  assert.match(windowlessStartScript, /\$env:CODEX_MOBILE_WINDOWS_SYSTEM_TASK = "1"/);
  assert.match(startupInstallScript, /at Windows startup as LocalSystem/);
});
