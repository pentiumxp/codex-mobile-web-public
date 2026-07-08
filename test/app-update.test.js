"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");
const { readFrontendSources } = require("./frontend-source-helper");

const root = path.resolve(__dirname, "..");
const appJs = readFrontendSources(root);
const appUpdateRuntimeJs = fs.readFileSync(path.join(root, "public", "app-update-runtime.js"), "utf8");
const appUpdateSource = `${appUpdateRuntimeJs}\n${appJs}`;
const composerRuntimeJs = fs.readFileSync(path.join(root, "public", "composer-runtime.js"), "utf8");
const sideChatRuntimeJs = fs.readFileSync(path.join(root, "public", "side-chat-runtime.js"), "utf8");
const mediaPreviewRuntimeJs = fs.readFileSync(path.join(root, "public", "media-preview-runtime.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const appPreviewHtml = fs.readFileSync(path.join(root, "public", "vite-shell", "app-preview.html"), "utf8");
const swJs = fs.readFileSync(path.join(root, "public", "sw.js"), "utf8");
const stylesCss = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");
const shellManifest = JSON.parse(fs.readFileSync(path.join(root, "public", "shell-asset-manifest.json"), "utf8"));
const serverJs = fs.readFileSync(path.join(root, "server.js"), "utf8");
const threadListRuntimeJs = fs.readFileSync(path.join(root, "public", "thread-list-runtime.js"), "utf8");
const serverRuntimeUtilsJs = fs.readFileSync(path.join(root, "services", "runtime", "server-runtime-utils.js"), "utf8");
const serverSupportRuntimeServiceJs = fs.readFileSync(path.join(root, "services", "runtime", "server-support-runtime-service.js"), "utf8");
const serverRouteCompositionServiceJs = fs.readFileSync(path.join(root, "server-routes", "server-route-composition-service.js"), "utf8");
const coreApiRouteServiceJs = fs.readFileSync(path.join(root, "server-routes", "core-api-route-service.js"), "utf8");
const appMaintenanceServiceJs = fs.readFileSync(path.join(root, "adapters", "app-maintenance-service.js"), "utf8");
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");

function functionBody(source, name) {
  let start = source.indexOf(`function ${name}(`);
  if (start === -1) start = source.indexOf(`async function ${name}(`);
  assert.notEqual(start, -1, `${name} not found`);
  const signatureEnd = source.indexOf(") {", start);
  const brace = source.indexOf("{", signatureEnd === -1 ? start : signatureEnd);
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`${name} body not closed`);
}

function evaluatedPublicPrReviewWorkspacePath() {
  const sources = [
    "normalizeFsPath",
    "workspacePathBaseName",
    "workspacePathIsVisible",
    "visibleWorkspaceWithBaseName",
    "publicPrReviewWorkspacePath",
  ].map((name) => functionBody(appUpdateSource, name));
  return (state) => Function("state", `${sources.join("\n")}\nreturn publicPrReviewWorkspacePath();`)(state);
}

function createServiceWorkerHarness() {
  const listeners = {};
  const cache = new Map();
  const putCalls = [];
  const networkCalls = [];
  const context = {
    URL,
    Request,
    Response,
    console,
    setTimeout,
    importScripts: () => {},
    fetch: async (request, init = {}) => {
      networkCalls.push({
        url: typeof request === "string" ? request : request.url,
        cache: init.cache || "",
      });
      return new Response("network-stable-entry", { status: 200 });
    },
    caches: {
      async match(key) {
        const cacheKey = typeof key === "string" ? key : key.url;
        return cache.get(cacheKey) || null;
      },
      async keys() {
        return ["codex-mobile-shell-v625-test"];
      },
      async delete() {
        return true;
      },
      async open() {
        return {
          async addAll() {},
          async put(key, response) {
            const cacheKey = typeof key === "string" ? key : key.url;
            putCalls.push(cacheKey);
            cache.set(cacheKey, response.clone ? response.clone() : response);
          },
        };
      },
    },
  };
  context.self = {
    location: { origin: "https://codex.example.test" },
    CODEX_MOBILE_SHELL_MANIFEST: {
      shellCacheName: "codex-mobile-shell-v625-test",
      precacheAssets: [],
    },
    skipWaiting: () => Promise.resolve(),
    clients: {
      claim: () => Promise.resolve(),
      matchAll: () => Promise.resolve([]),
      openWindow: () => Promise.resolve(null),
    },
    registration: {
      showNotification: () => Promise.resolve(),
    },
    addEventListener(type, handler) {
      listeners[type] = handler;
    },
  };
  vm.runInNewContext(swJs, context, { filename: "sw.js" });
  return { listeners, cache, networkCalls, putCalls };
}

async function runServiceWorkerFetch(harness, request) {
  let responsePromise = null;
  harness.listeners.fetch({
    request,
    respondWith(promise) {
      responsePromise = Promise.resolve(promise);
    },
  });
  assert.ok(responsePromise, "fetch handler should respond");
  return responsePromise;
}

test("self-update UI explains supervisor-dependent restart", () => {
  assert.match(appUpdateSource, /等待重启…/);
  assert.match(appUpdateSource, /服务会退出并等待启动任务或守护脚本拉起/);
  assert.match(appUpdateSource, /手动启动的部署需要在服务停止后手动重启/);
  assert.match(appUpdateSource, /手动运行 node\/npm start 的部署需要手动重启/);
  assert.match(appUpdateSource, /如连接断开且未自动恢复，请在部署机手动重启/);
});

test("app update runtime is wired into the static shell", () => {
  assert.match(indexHtml, /<script src="\/app-update-runtime\.js"><\/script>/);
  assert.ok(shellManifest.precacheAssets.includes("/app-update-runtime.js"));
  assert.match(appJs, /"\/app-update-runtime\.js"/);
  assert.ok(shellManifest.hashAssets.includes("/app-update-runtime.js"));
  assert.match(swJs, /shell-asset-manifest\.js/);
  assert.match(serverRuntimeUtilsJs, /shell-asset-manifest\.json/);
  assert.match(appJs, /(?:const|var) appUpdateRuntimeApi = window\.CodexAppUpdateRuntime/);
  const requireRuntimeBody = functionBody(appJs, "requireAppUpdateRuntime");
  assert.match(requireRuntimeBody, /if \(!appUpdateRuntime\) \{/);
  assert.match(requireRuntimeBody, /appUpdateRuntimeApi\.createAppUpdateRuntime\(\{/);
  const earlyConstantsEnd = appJs.indexOf("function hasStartupThreadOpenIntent");
  const earlyConstantsBlock = appJs.slice(appJs.indexOf("var COMPOSER_INTENT_BODY_MAX_CHARS"), earlyConstantsEnd);
  assert.doesNotMatch(earlyConstantsBlock, /appUpdateRuntimeApi\.createAppUpdateRuntime\(\{/);
  assert.match(appJs, /function requireAppUpdateRuntime\(\)/);
  assert.match(appUpdateRuntimeJs, /function createAppUpdateRuntime\(deps = \{\}\)/);
  assert.match(appUpdateRuntimeJs, /root\.CodexAppUpdateRuntime/);
});

test("page prompts for refresh when server client build changes", () => {
  assert.match(serverRuntimeUtilsJs, /function clientBuildId\(/);
  assert.match(serverRuntimeUtilsJs, /function currentPublicBuildConfig\(\)/);
  assert.match(serverRuntimeUtilsJs, /const shellCacheName = readServiceWorkerCacheName\(\);/);
  assert.match(serverRuntimeUtilsJs, /const buildId = appShellBuildId\(shellCacheName\);/);
  assert.match(serverRuntimeUtilsJs, /clientBuildId:\s*clientBuildId\(shellCacheName, buildId\)/);
  assert.match(serverJs, /currentPublicBuildConfig/);
  assert.match(coreApiRouteServiceJs, /const buildConfig = deps\.currentPublicBuildConfig\(\);/);
  assert.match(coreApiRouteServiceJs, /buildId:\s*buildConfig\.buildId/);
  assert.match(coreApiRouteServiceJs, /clientBuildId:\s*buildConfig\.clientBuildId/);
  assert.match(coreApiRouteServiceJs, /shellCacheName:\s*buildConfig\.shellCacheName/);
  assert.match(indexHtml, /id="pageRefreshPrompt"/);
  assert.match(shellManifest.shellCacheName, /^codex-mobile-shell-v625-[a-f0-9]{12}$/);
  assert.match(shellManifest.clientBuildId, /^0\.1\.11\|codex-mobile-shell-v625-[a-f0-9]{12}$/);
  assert.ok(shellManifest.pageShellAssets.includes("/sw.js"));
  assert.ok(shellManifest.pageShellAssets.includes("/shell-asset-manifest.js"));
  assert.ok(shellManifest.pageShellAssets.includes("/shell-asset-manifest.json"));
  assert.ok(shellManifest.pageShellAssets.includes("/app-update-runtime.js"));
  assert.ok(shellManifest.pageShellAssets.includes("/app-shell-runtime.js"));
  assert.match(appUpdateSource, /shellManifestList\("pageShellAssets"/);
  assert.doesNotMatch(appUpdateSource, /PAGE_SHELL_ASSETS\s*=\s*Object\.freeze\(\s*\[/);
  const scriptOrder = [
    "/shell-asset-manifest.js",
    "/thread-diagnostic-events.js",
    "/frontend-runtime-health.js",
    "/thread-status-hints.js",
    "/thread-performance-metrics.js",
    "/thread-list-load-policy.js",
    "/thread-list-stable-order.js",
    "/thread-list-runtime.js",
    "/client-render-stability-guard.js",
    "/live-operation-dock-state.js",
    "/thread-detail-state.js",
    "/thread-detail-render-plan.js",
    "/thread-detail-merge-state.js",
    "/thread-detail-v4-merge-state.js",
    "/thread-detail-runtime.js",
    "/thread-detail-patch-plan.js",
    "/thread-detail-dom-patch.js",
    "/thread-detail-actions.js",
    "/thread-tile-actions.js",
    "/thread-tile-state.js",
    "/thread-tile-layout.js",
    "/thread-tile-runtime.js",
    "/build-refresh-policy.js",
    "/app-update-runtime.js",
    "/side-chat-runtime.js",
    "/media-preview-runtime.js",
    "/app-bootstrap.js",
    "/settings-runtime.js",
    "/modal-runtime.js",
    "/navigation-runtime.js",
    "/api-client-runtime.js",
    "/notification-ui-runtime.js",
    "/pane-layout-runtime.js",
    "/task-card-runtime.js",
    "/conversation-render-runtime.js",
    "/event-stream-runtime.js",
    "/composer-bridge-runtime.js",
    "/runtime-wiring-runtime.js",
    "/app-shell-runtime.js",
    "/app.js",
  ];
  let previousScriptIndex = -1;
  for (const asset of scriptOrder) {
    const scriptIndex = indexHtml.indexOf(`<script src="${asset}"></script>`);
    assert.notEqual(scriptIndex, -1, `missing shell script ${asset}`);
    assert.ok(scriptIndex > previousScriptIndex, `${asset} should load after the prior runtime asset`);
    previousScriptIndex = scriptIndex;
  }
  assert.match(serverRuntimeUtilsJs, /shell-asset-manifest\.json/);
  assert.match(serverRuntimeUtilsJs, /manifestAssetFiles\("hashAssets"/);
  assert.match(indexHtml, /id="hardRefreshButton"/);
  assert.match(appUpdateSource, /function checkPageRefreshAvailability\(/);
  assert.match(appUpdateSource, /function refreshPageForNewBuild\(/);
  assert.match(appUpdateSource, /function renderHardRefreshButton\(/);
  assert.match(appUpdateSource, /function handleHardRefreshClick\(/);
  assert.match(appUpdateSource, /(?:const|var) buildRefreshPolicy = window\.CodexBuildRefreshPolicy/);
  assert.match(appUpdateSource, /function shouldPromptForServerBuildChange\(/);
  assert.match(appUpdateSource, /function serverBuildMatchesLoadedClient\(config\)/);
  assert.match(appUpdateSource, /function acceptLoadedClientBuild\(config\)/);
  assert.match(appUpdateSource, /function rememberRateLimitsFromConfig\(config\)/);
  assert.match(appUpdateSource, /function preparePageShellAssets\(config, options = \{\}\)/);
  assert.match(appUpdateSource, /function clearAllShellCaches\(\)/);
  assert.match(appUpdateSource, /function resetPageShellServiceWorker\(\)/);
  assert.match(appUpdateSource, /function pageReloadUrlWithBust\(\)/);
  assert.match(appUpdateSource, /function recordPageRefreshFailure\(err, phase = "refresh"\)/);
  assert.match(appUpdateSource, /function forcePageShellReload\(options = \{\}\)/);
  assert.match(appUpdateSource, /rememberRateLimitsFromConfig\(config\);[\s\S]*await preparePageShellAssets\(config, \{ populateCache: true \}\)/);
  assert.match(functionBody(appUpdateSource, "validatePageShellAsset"), /asset === "\/app\.js"[\s\S]*function startCodexMobileApp\(\)[\s\S]*CodexRuntimeWiringRuntime[\s\S]*CodexAppShellRuntime[\s\S]*CodexMobileAppEntry/);
  assert.doesNotMatch(functionBody(appUpdateSource, "validatePageShellAsset"), /asset === "\/app\.js"[\s\S]*text\.includes\(buildId\)/);
  assert.match(functionBody(appUpdateSource, "refreshPageForNewBuild"), /await clearAllShellCaches\(\);[\s\S]*await preparePageShellAssets\(config, \{ populateCache: true \}\);[\s\S]*await resetPageShellServiceWorker\(\);[\s\S]*window\.location\.replace\(pageReloadUrlWithBust\(\)\);/);
  assert.match(functionBody(appUpdateSource, "refreshPageForNewBuild"), /catch \(err\) \{[\s\S]*recordPageRefreshFailure\(err, "new-build-refresh"\);[\s\S]*await forcePageShellReload\(\{[\s\S]*reason: "build",[\s\S]*allowWhileReloading: true,[\s\S]*new-build-refresh-hard-cache-reset/);
  assert.match(functionBody(appUpdateSource, "forcePageShellReload"), /await clearAllShellCaches\(\);[\s\S]*await resetPageShellServiceWorker\(\);[\s\S]*window\.location\.replace\(pageReloadUrlWithBust\(\)\);/);
  assert.doesNotMatch(functionBody(appUpdateSource, "forcePageShellReload"), /preparePageShellAssets/);
  assert.doesNotMatch(functionBody(appUpdateSource, "checkPageRefreshAvailability"), /preparePageShellAssets\(config, \{ populateCache: true \}\)/);
  assert.match(functionBody(appUpdateSource, "initializePageBuildState"), /shouldPromptForServerBuildChange\(currentServerBuildId, state\.serverBuildId\)/);
  assert.match(functionBody(appUpdateSource, "checkPageRefreshAvailability"), /if \(serverBuildMatchesLoadedClient\(config\)\) \{[\s\S]*acceptLoadedClientBuild\(config\);[\s\S]*return;/);
  assert.match(functionBody(appUpdateSource, "checkPageRefreshAvailability"), /const serverBuildNeedsRefresh = serverBuildChanged && shouldPromptForServerBuildChange\(nextBuildId, state\.serverBuildId\)/);
  assert.match(functionBody(appUpdateSource, "checkPageRefreshAvailability"), /if \(serverBuildNeedsRefresh\) \{[\s\S]*if \(isHermesEmbedMode\(\)\) \{[\s\S]*requestHermesPluginRefresh\("server_build_changed"\);/);
  assert.match(functionBody(appUpdateSource, "checkPageRefreshAvailability"), /if \(assetsChanged && !serverBuildNeedsRefresh\) \{[\s\S]*state\.serverAssetBuildId = nextAssetBuildId;[\s\S]*return;/);
  assert.doesNotMatch(functionBody(appUpdateSource, "checkPageRefreshAvailability"), /if \(serverBuildNeedsRefresh \|\| assetsChanged\)/);
  assert.match(functionBody(appUpdateSource, "renderPageRefreshPrompt"), /New version available\. Tap to refresh\./);
  assert.match(functionBody(appUpdateSource, "renderPageRefreshPrompt"), /Manual refresh only/);
  assert.match(appUpdateSource, /cache:\s*"no-store"/);
  assert.match(appUpdateSource, /function pruneOldShellCaches\(expectedCacheName\)/);
  assert.match(appUpdateSource, /key !== expectedCacheName/);
  assert.match(appUpdateSource, /window\.location\.replace\(pageReloadUrlWithBust\(\)\)/);
  assert.match(functionBody(appUpdateSource, "renderPageRefreshPrompt"), /renderHardRefreshButton\(\)/);
  assert.match(functionBody(appUpdateSource, "handleHardRefreshClick"), /state\.pageRefreshPreparedConfig = null;[\s\S]*state\.pageRefreshReason = "build";[\s\S]*state\.pageRefreshAvailable = true;[\s\S]*await forcePageShellReload\(\{ reason: "build" \}\);/);
  assert.doesNotMatch(functionBody(appUpdateSource, "handleHardRefreshClick"), /refreshPageForNewBuild/);
  assert.match(functionBody(appUpdateSource, "refreshPageForNewBuild"), /if \(serverBuildMatchesLoadedClient\(config\)\) \{[\s\S]*acceptLoadedClientBuild\(config\);[\s\S]*state\.pageRefreshReloading = false;[\s\S]*renderPageRefreshPrompt\(\);[\s\S]*return;/);
  assert.match(appUpdateSource, /hardRefreshButton"\)\.addEventListener\("click", \(\) => handleHardRefreshClick\(\)\.catch\(showError\)\)/);
  assert.match(appUpdateSource, /addEventListener\("click", refreshPageForNewBuild\)/);
  assert.doesNotMatch(stylesCss, /html\.embed-hermes #pageRefreshPrompt/);
  assert.match(stylesCss, /html\.embed-hermes #refreshThreads\s*\{[\s\S]*display:\s*none;/);
  assert.match(stylesCss, /html\.embed-hermes #connectionState\s*\{[\s\S]*display:\s*none;/);
  assert.match(stylesCss, /\.page-refresh-prompt/);
  assert.match(stylesCss, /\.hard-refresh-button/);
});

test("page shell app entry validation accepts the stable app shim without a build id literal", () => {
  const validatePageShellAsset = Function(
    `${functionBody(appUpdateSource, "serverBuildIdFromConfig")}\n`
    + `${functionBody(appUpdateSource, "validatePageShellAsset")}\n`
    + "return validatePageShellAsset;"
  )();
  const config = {
    clientBuildId: "0.1.11|codex-mobile-shell-v625-target",
    shellCacheName: "codex-mobile-shell-v625-target",
  };
  assert.equal(validatePageShellAsset("/app.js", appJs, config), true);
  assert.equal(validatePageShellAsset("/app.js", "\"use strict\";\nconsole.log(\"not the app entry\");", config), false);
});

test("page refresh prompt also handles server restart reconnects", () => {
  assert.match(appUpdateSource, /pageRefreshReason:\s*""/);
  assert.match(appUpdateSource, /function showReconnectRefreshPrompt\(reason = "reconnect"\)/);
  assert.match(appUpdateSource, /state\.pageRefreshReason = reason === "restart" \? "restart" : "reconnect"/);
  assert.match(appUpdateSource, /function clearReconnectRefreshPrompt\(\)/);
  assert.match(functionBody(appUpdateSource, "clearReconnectRefreshPrompt"), /state\.pageRefreshReason === "reconnect" \|\| state\.pageRefreshReason === "restart"/);
  assert.match(functionBody(appUpdateSource, "clearReconnectRefreshPrompt"), /finishRestartingUiIfReady\(\)/);
  assert.match(appUpdateSource, /function recoverEventStreamWithApiFallback\(options = \{\}\)/);
  assert.match(appUpdateSource, /function scheduleEventFallbackPoll\(delayMs = 8000\)/);
  assert.match(appUpdateSource, /function scheduleEventReconnectRetry\(\)/);
  assert.match(appUpdateSource, /function scheduleVisiblePageRefreshCheck\(delayMs = 0, options = \{\}\)/);
  assert.match(appUpdateSource, /state\.events\.onopen = \(\) => \{[\s\S]*scheduleVisiblePageRefreshCheck\(200, \{ force: true \}\)/);
  assert.match(appUpdateSource, /payload\.type === "status"[\s\S]*scheduleVisiblePageRefreshCheck\(1200\)/);
  assert.match(threadListRuntimeJs, /renderThreads\(result\);[\s\S]*scheduleVisiblePageRefreshCheck\(500\)/);
  assert.match(appUpdateSource, /Service restarted\. Tap to refresh\./);
  assert.match(appUpdateSource, /Connection changed\. Tap to refresh\./);
  assert.match(appUpdateSource, /Refreshing and reconnecting\.\.\./);
  assert.match(functionBody(appUpdateSource, "showReconnectRefreshPrompt"), /if \(isHermesEmbedMode\(\) && reason !== "restart"\) return;/);
  assert.match(appUpdateSource, /rememberCodexProfiles = \(\) => \{\}/);
  assert.match(appUpdateSource, /function codexProfileRestartReadyForCompletion\(\)/);
  assert.match(functionBody(appUpdateSource, "codexProfileRestartReadyForCompletion"), /服务已恢复，正在等待目标账号额度刷新/);
  assert.match(appUpdateSource, /async function waitForPageBuildConfig\(timeoutMs = 18000\)/);
  assert.match(appUpdateSource, /state\.pageRefreshReason === "reconnect" \|\| state\.pageRefreshReason === "restart"[\s\S]*await waitForPageBuildConfig\(\)/);
  assert.match(functionBody(appUpdateSource, "refreshPageForNewBuild"), /if \(reconnectRefresh && !shouldPromptForServerBuildChange\(nextBuildId, currentBuildId\)\) \{[\s\S]*rememberCodexProfiles\(config && config\.codexProfiles \|\| null\);[\s\S]*const restartFinished = finishRestartingUiIfReady\(\);[\s\S]*state\.pageRefreshAvailable = !restartFinished && state\.codexProfileRestarting;[\s\S]*return;/);
  assert.match(appUpdateSource, /showReconnectRefreshPrompt\("reconnect"\);[\s\S]*if \(!isHermesEmbedMode\(\)\) showError\(err\)/);
  assert.match(appUpdateSource, /showReconnectRefreshPrompt\("restart"\)/);
  assert.match(appUpdateSource, /function shouldRefreshThreadListDuringEventRecovery\(options = \{\}\)/);
  assert.match(functionBody(appUpdateSource, "shouldRefreshThreadListDuringEventRecovery"), /return Boolean\(options\.force\) \|\| !isHermesEmbedMode\(\) \|\| !state\.threads\.length;/);
  assert.match(functionBody(appUpdateSource, "refreshThreadListDuringEventRecovery"), /if \(!shouldRefreshThreadListDuringEventRecovery\(options\)\) return false;/);
  assert.match(functionBody(appUpdateSource, "refreshThreadListDuringEventRecovery"), /await loadThreads\(\{ silent: isHermesEmbedMode\(\) \|\| Boolean\(state\.threads\.length\) \}\);/);
  assert.match(functionBody(appUpdateSource, "scheduleEventFallbackPoll"), /await refreshThreadListDuringEventRecovery\(\);/);
  assert.doesNotMatch(functionBody(appUpdateSource, "scheduleEventFallbackPoll"), /await loadThreads\(/);
  assert.match(functionBody(appUpdateSource, "scheduleEventFallbackPoll"), /if \(state\.currentThreadId\) await refreshCurrentThread\(\{ source: "event-fallback-poll" \}\);/);
  assert.match(functionBody(appUpdateSource, "recoverEventStreamWithApiFallback"), /Boolean\(options\.afterEventReconnect\)/);
  assert.match(functionBody(appUpdateSource, "recoverEventStreamWithApiFallback"), /await refreshThreadListDuringEventRecovery\(\{ force: Boolean\(options\.afterEventReconnect\) \}\);/);
  assert.doesNotMatch(functionBody(appUpdateSource, "recoverEventStreamWithApiFallback"), /await loadThreads\(/);
  assert.match(functionBody(appUpdateSource, "connectEvents"), /const hadReconnectFailure = state\.eventReconnectFailures > 0 \|\| state\.eventFallbackMode;/);
  assert.match(functionBody(appUpdateSource, "connectEvents"), /if \(hadReconnectFailure\) \{[\s\S]*recoverEventStreamWithApiFallback\(\{ afterEventReconnect: true \}\)/);
  assert.match(functionBody(appUpdateSource, "recoverEventStreamWithApiFallback"), /if \(isHermesEmbedMode\(\)\) \{[\s\S]*scheduleEventFallbackPoll\(\);[\s\S]*scheduleEventReconnectRetry\(\);/);
  assert.match(functionBody(appUpdateSource, "connectEvents"), /if \(!isHermesEmbedMode\(\)\) \{[\s\S]*markActivity\("重连"\);[\s\S]*updateConnectionState\(null, "Reconnecting"\);[\s\S]*\}/);
  assert.doesNotMatch(appUpdateSource, /updateConnectionState\(null, "Reconnecting"\);\s*showReconnectRefreshPrompt/);
  assert.match(appUpdateSource, /pageRefreshPrompt\.addEventListener\("click", refreshPageForNewBuild\)/);
  assert.doesNotMatch(functionBody(appUpdateSource, "handleSharedRestartClick"), /refreshPageForNewBuild\(\)\.catch\(showError\)/);
});

test("boot recovery UI can clear PWA shell state before app.js starts", () => {
  assert.match(indexHtml, /id="bootRecovery"/);
  assert.match(indexHtml, /id="bootRecoveryRecover"/);
  assert.match(indexHtml, /id="bootRecoveryReload"/);
  assert.ok(indexHtml.indexOf('id="bootRecovery"') < indexHtml.indexOf('id="app"'), "boot recovery should render before the hidden app shell");
  assert.ok(indexHtml.indexOf("window.codexMobileBoot") < indexHtml.indexOf('<script src="/app.js"></script>'), "boot recovery must not depend on app.js");
  assert.match(indexHtml, /codex-mobile-shell-/);
  assert.match(indexHtml, /window\.caches\.keys\(\)/);
  assert.match(indexHtml, /navigator\.serviceWorker\.getRegistrations\(\)/);
  assert.match(indexHtml, /registration\.unregister\(\)/);
  assert.match(indexHtml, /shellReload/);
  assert.match(indexHtml, /window\.addEventListener\("error"/);
  assert.match(indexHtml, /window\.addEventListener\("unhandledrejection"/);
  assert.match(indexHtml, /function isScriptStartupError\(event\)/);
  assert.match(indexHtml, /tagName === "SCRIPT"/);
  assert.match(indexHtml, /function scheduleScriptRecovery\(\)/);
  assert.match(indexHtml, /function autoReloadForScriptStartupError\(\)/);
  assert.match(indexHtml, /SCRIPT_AUTO_RELOAD_STORAGE_KEY/);
  assert.match(indexHtml, /window\.sessionStorage\.setItem\(scriptAutoReloadKey\(\), "1"\)/);
  assert.match(indexHtml, /window\.location\.replace\(cacheBustUrl\(\)\)/);
  assert.match(indexHtml, /if \(autoReloadForScriptStartupError\(\)\) return;/);
  assert.match(indexHtml, /clearScriptAutoReloadAttempt\(\);/);
  assert.doesNotMatch(indexHtml, /showRecovery\("script-error"\); \}, 0\)/);
  assert.match(appPreviewHtml, /function isScriptStartupError\(event\)/);
  assert.match(appPreviewHtml, /tagName === "SCRIPT"/);
  assert.match(appPreviewHtml, /function scheduleScriptRecovery\(\)/);
  assert.match(appPreviewHtml, /function autoReloadForScriptStartupError\(\)/);
  assert.match(indexHtml, /var APP_PREVIEW_STARTUP_RECOVERY_TIMEOUT_MS = 12000;/);
  assert.match(indexHtml, /var APP_PREVIEW_STARTUP_RECOVERY_HARD_LIMIT_MS = 30000;/);
  assert.match(indexHtml, /function appPreviewStartupStillPending\(\)/);
  assert.match(indexHtml, /status\.appStartPending === true/);
  assert.match(indexHtml, /scheduleStartupRecovery\(APP_PREVIEW_STARTUP_RECOVERY_POLL_MS\)/);
  assert.match(indexHtml, /scheduleStartupRecovery\(isViteAppPreviewPage\(\)[\s\S]*APP_PREVIEW_STARTUP_RECOVERY_TIMEOUT_MS[\s\S]*STARTUP_RECOVERY_TIMEOUT_MS\)/);
  assert.match(appPreviewHtml, /var APP_PREVIEW_STARTUP_RECOVERY_TIMEOUT_MS = 12000;/);
  assert.match(appPreviewHtml, /function appPreviewStartupStillPending\(\)/);
  assert.match(appUpdateSource, /function markBootReady\(\)/);
  assert.match(appUpdateSource, /window\.codexMobileBoot/);
  assert.match(appUpdateSource, /markBootReady\(\);[\s\S]*if \(state\.startupThreadOpenPending\) renderCurrentThread\(\);/);
  assert.match(appUpdateSource, /function isRecoverablePluginStartupError\(err\)/);
  assert.match(appUpdateSource, /function recordViteAppPreviewStartFailure\(err\)/);
  assert.match(appUpdateSource, /status\.appStartErrorCode = appShellStartupErrorCode\(err\)/);
  assert.match(appUpdateSource, /start\(\)\.catch\(\(err\) => \{/);
  assert.match(appUpdateSource, /requestHermesPluginRefresh\(pluginRefreshReasonForApiError/);
  assert.match(appUpdateSource, /boot\.fail\("app-start-error"\)/);
  assert.match(appUpdateSource, /if \(isViteAppPreview\) throw err;/);
  assert.match(functionBody(appUpdateSource, "refreshPageForNewBuild"), /await clearAllShellCaches\(\);[\s\S]*await resetPageShellServiceWorker\(\);/);
});

test("service worker refreshes mutable Vite shell startup assets network-first", () => {
  assert.match(swJs, /function isShellReloadNavigation\(url\)/);
  assert.match(swJs, /url\.searchParams\.has\("shellReload"\)/);
  assert.match(swJs, /url\.searchParams\.has\("codexMobileBuild"\)/);
  assert.match(swJs, /url\.searchParams\.has\("codexViteShell"\)/);
  assert.match(swJs, /function shouldNetworkFirstShellAsset\(url\)/);
  assert.ok(swJs.includes('path === "/vite-shell/app-preview-entry.js"'));
  assert.ok(swJs.includes('/^\\/vite-shell\\/assets\\/vite-shell-entry-[^/]+\\.js$/.test(path)'));
  assert.match(swJs, /function networkFirst\(request, cacheKey = request\)/);
  assert.match(swJs, /fetch\(request, \{ cache: "reload" \}\)/);
  assert.match(swJs, /if \(isShellReloadNavigation\(url\)\) \{[\s\S]*return networkFirst\(request, "\/index\.html"\);/);
  assert.match(swJs, /if \(shouldNetworkFirstShellAsset\(url\)\) \{[\s\S]*event\.respondWith\(networkFirst\(request\)\);/);
});

test("service worker does not serve cached stale Vite entry before network", async () => {
  const harness = createServiceWorkerHarness();
  const staleEntryUrl = "https://codex.example.test/vite-shell/assets/vite-shell-entry-old.js";
  harness.cache.set(staleEntryUrl, new Response("cached-stale-entry", { status: 200 }));

  const response = await runServiceWorkerFetch(harness, {
    method: "GET",
    mode: "same-origin",
    url: staleEntryUrl,
  });

  assert.equal(await response.text(), "network-stable-entry");
  assert.deepEqual(harness.networkCalls, [{ url: staleEntryUrl, cache: "reload" }]);
  assert.deepEqual(harness.putCalls, [staleEntryUrl]);
});

test("service worker shellReload navigation bypasses cached index first", async () => {
  const harness = createServiceWorkerHarness();
  harness.cache.set("/index.html", new Response("cached-index", { status: 200 }));

  const response = await runServiceWorkerFetch(harness, {
    method: "GET",
    mode: "navigate",
    url: "https://codex.example.test/?shellReload=123",
  });

  assert.equal(await response.text(), "network-stable-entry");
  assert.deepEqual(harness.networkCalls, [{ url: "https://codex.example.test/?shellReload=123", cache: "reload" }]);
  assert.deepEqual(harness.putCalls, ["/index.html"]);
});

test("public pull request check prompts before public publishing work", () => {
  assert.match(indexHtml, /id="publicPrStatus"/);
  assert.match(indexHtml, /id="appNativeDialog"/);
  assert.match(stylesCss, /\.public-pr-status/);
  assert.match(stylesCss, /\.app-native-dialog/);
  assert.match(serverJs, /createServerRouteCompositionService/);
  assert.match(serverRouteCompositionServiceJs, /createCoreApiRouteService/);
  assert.match(serverJs, /appRoot:\s*APP_ROOT/);
  assert.match(coreApiRouteServiceJs, /workspacePath:\s*appRoot/);
  assert.match(coreApiRouteServiceJs, /publicPullRequests:/);
  assert.match(coreApiRouteServiceJs, /\/api\/public-pull-requests\/status/);
  assert.match(serverJs, /createServerSupportRuntimeService/);
  assert.match(serverSupportRuntimeServiceJs, /createAppMaintenanceService/);
  assert.match(serverJs, /publicPrRepository:\s*PUBLIC_PR_REPOSITORY/);
  assert.match(appMaintenanceServiceJs, /publicPullRequestApiUrl\(publicPrRepository\)/);
  assert.match(appUpdateSource, /function renderPublicPrStatus\(\)/);
  assert.match(appUpdateSource, /function maybePromptPublicPrMerge\(status\)/);
  assert.match(appUpdateSource, /function publicPrMergeConfirmationMessage\(status\)/);
  assert.match(appUpdateSource, /function publicPrMergeInstruction\(status\)/);
  assert.match(appUpdateSource, /(?:const|var) PUBLIC_PR_REVIEW_THREAD_TITLE = "Codex Mobile Public PR";/);
  assert.match(appUpdateSource, /function findPublicPrReviewThread\(workspacePath = ""\)/);
  assert.match(appUpdateSource, /function publicPrReviewWorkspacePath\(\)/);
  assert.match(appUpdateSource, /async function openPublicPrReviewThreadIfAvailable\(workspacePath, text\)/);
  assert.match(appUpdateSource, /await loadThread\(target\.id, \{ source: "public-pr" \}\);/);
  assert.match(appUpdateSource, /state\.appWorkspacePath = String\(config\.workspacePath \|\| state\.appWorkspacePath \|\| ""\)\.trim\(\);/);
  assert.match(functionBody(appUpdateSource, "preparePublicPrMergePrompt"), /const workspacePath = publicPrReviewWorkspacePath\(\);/);
  assert.match(functionBody(appUpdateSource, "preparePublicPrMergePrompt"), /await loadWorkspaces\(\)\.catch/);
  assert.match(appUpdateSource, /if \(await openPublicPrReviewThreadIfAvailable\(workspacePath, text\)\) \{[\s\S]*return;[\s\S]*\}/);
  assert.match(appUpdateSource, /state\.newThreadTitle = publicPrReviewThreadTitle\(\);[\s\S]*state\.newThreadDraft = true;|state\.newThreadDraft = true;[\s\S]*state\.newThreadTitle = publicPrReviewThreadTitle\(\);/);
  assert.match(composerRuntimeJs, /body\.append\("title", submittedTitle\);/);
  assert.match(appUpdateSource, /scheduleStartupPublicPrCheck\(\)/);
  assert.match(appUpdateSource, /handlePublicPrStatusClick\(\)\.catch\(showError\)/);
  assert.match(functionBody(appUpdateSource, "maybePromptPublicPrMerge"), /requestAppConfirmation\(publicPrMergeConfirmationMessage\(status\)/);
  assert.match(functionBody(appUpdateSource, "handlePublicPrStatusClick"), /await requestAppConfirmation\(publicPrMergeConfirmationMessage\(status\)/);
});

test("mobile shell action dialogs do not depend on native browser modals", () => {
  assert.match(indexHtml, /id="appNativeDialog"/);
  assert.match(indexHtml, /id="appNativeDialogInput"/);
  assert.match(stylesCss, /\.app-native-dialog/);
  assert.match(appUpdateSource, /function requestAppAlert\(message, options = \{\}\)/);
  assert.match(appUpdateSource, /function requestAppConfirmation\(message, options = \{\}\)/);
  assert.match(appUpdateSource, /function requestAppTextInput\(message, value = "", options = \{\}\)/);
  assert.doesNotMatch(appUpdateSource, /window\.(alert|confirm|prompt)\(/);
  assert.doesNotMatch(appUpdateSource, /\balert\(/);
  assert.doesNotMatch(appUpdateSource, /\bconfirm\(/);
  assert.doesNotMatch(appUpdateSource, /\bprompt\(/);
  assert.match(functionBody(appUpdateSource, "handleAppUpdateClick"), /await requestAppConfirmation\(/);
  assert.match(functionBody(sideChatRuntimeJs, "clearSideChat"), /await requestAppConfirmation\(/);
  assert.match(functionBody(appUpdateSource, "createThreadTaskCardFromThread"), /await requestAppTextInput\(/);
  assert.match(functionBody(appUpdateSource, "replyTaskCard"), /await requestAppTextInput\(/);
  assert.doesNotMatch(functionBody(appUpdateSource, "requestCodexProfileSwitchConfirmation"), /window\.confirm/);
  assert.doesNotMatch(functionBody(appUpdateSource, "requestThreadArchiveConfirmation"), /window\.confirm/);
});

test("public pull request prompt clears stale merged PR state", () => {
  assert.match(appUpdateSource, /function publicPrHasOpenPullRequests\(status\)/);
  assert.match(functionBody(appUpdateSource, "handlePublicPrStatusClick"), /refreshPublicPrStatus\(\{ force: true, skipPrompt: true \}\)/);
  assert.match(functionBody(appUpdateSource, "handlePublicPrStatusClick"), /!publicPrHasOpenPullRequests\(status\)/);
  assert.match(functionBody(appUpdateSource, "renderPublicPrStatus"), /el\.classList\.toggle\("hidden", !checking && !hasPrs && !blocked\)/);
  assert.match(functionBody(appUpdateSource, "refreshPublicPrStatus"), /hasOpenPullRequests: false/);
  assert.match(functionBody(appUpdateSource, "refreshPublicPrStatus"), /openPullRequestCount: 0/);
  assert.match(functionBody(appUpdateSource, "refreshPublicPrStatus"), /pullRequests: \[\]/);
  assert.match(functionBody(appUpdateSource, "renderUpdatePanel"), /hasPublicPrs\s*\?\s*"Review Public PR"\s*:\s*"Check PR"/);
  assert.match(functionBody(appUpdateSource, "renderUpdatePanel"), /primary: hasPublicPrs/);
});

test("public pull request prompt targets visible source workspace when production path is not visible", () => {
  const publicPrReviewWorkspacePath = evaluatedPublicPrReviewWorkspacePath();
  assert.equal(publicPrReviewWorkspacePath({
    appWorkspacePath: "/Users/hermes-host/HermesMobile/plugins/codex-mobile-web",
    selectedCwd: "",
    currentThread: null,
    workspaces: [
      { cwd: "/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web" },
      { cwd: "/Users/hermes-dev/HermesMobileDev/public-mirrors/codex-mobile-web-public" },
    ],
  }), "/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web");
  assert.equal(publicPrReviewWorkspacePath({
    appWorkspacePath: "/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web",
    selectedCwd: "/Users/other/current",
    currentThread: { cwd: "/Users/other/thread" },
    workspaces: [
      { cwd: "/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web" },
    ],
  }), "/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web");
  assert.equal(publicPrReviewWorkspacePath({
    appWorkspacePath: "/unregistered/deploy/plugin",
    selectedCwd: "/Users/hermes-dev/HermesMobileDev/app",
    currentThread: null,
    workspaces: [
      { cwd: "/Users/hermes-dev/HermesMobileDev/app" },
    ],
  }), "/Users/hermes-dev/HermesMobileDev/app");
});

test("version button opens an update panel with Public release status", () => {
  assert.match(indexHtml, /id="updateDialog"/);
  assert.match(indexHtml, /id="appUpdateStatus"/);
  assert.match(stylesCss, /\.update-dialog/);
  assert.match(coreApiRouteServiceJs, /publicRelease:/);
  assert.match(coreApiRouteServiceJs, /\/api\/public-release\/status/);
  assert.match(appMaintenanceServiceJs, /function publicRepositoryCommitApiUrl\(/);
  assert.match(appMaintenanceServiceJs, /currentCheckoutUsesPublicRelease/);
  assert.match(appUpdateSource, /function renderUpdatePanel\(\)/);
  assert.match(appUpdateSource, /function refreshPublicReleaseStatus\(options = \{\}\)/);
  assert.match(appUpdateSource, /function currentUpdateUsesPublicRelease\(/);
  assert.match(appUpdateSource, /function clientBuildVersionText\(buildId = CLIENT_BUILD_ID\)/);
  assert.match(appUpdateSource, /function fullClientBuildVersionText\(status = state\.appUpdateStatus\)/);
  assert.match(appUpdateSource, /v\$\{version\} · \$\{client\}/);
  assert.match(appUpdateSource, /完整客户端版本/);
  assert.match(appUpdateSource, /fullClientBuildVersionText\(current\)/);
  assert.match(appUpdateSource, /当前客户端 \$\{CLIENT_BUILD_ID\}/);
  assert.match(appUpdateSource, /appUpdateStatus"\)\.addEventListener\("click", openUpdatePanel\)/);
  assert.match(appUpdateSource, /updateActionButton\("apply-current"/);
});

test("README documents manual-start update restart requirement", () => {
  assert.match(readme, /直接手动运行 `node server\.js`、`npm start` 或一次性 shell 命令/);
  assert.match(readme, /自更新会完成文件更新并停止旧服务/);
  assert.match(readme, /需要在部署机重新执行启动命令/);
});
