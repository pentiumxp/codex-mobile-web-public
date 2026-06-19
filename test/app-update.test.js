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
  ].map((name) => functionBody(appJs, name));
  return (state) => Function("state", `${sources.join("\n")}\nreturn publicPrReviewWorkspacePath();`)(state);
}

test("self-update UI explains supervisor-dependent restart", () => {
  assert.match(appJs, /等待重启…/);
  assert.match(appJs, /服务会退出并等待启动任务或守护脚本拉起/);
  assert.match(appJs, /手动启动的部署需要在服务停止后手动重启/);
  assert.match(appJs, /手动运行 node\/npm start 的部署需要手动重启/);
  assert.match(appJs, /如连接断开且未自动恢复，请在部署机手动重启/);
});

test("page prompts for refresh when server client build changes", () => {
  assert.match(serverJs, /function clientBuildId\(/);
  assert.match(serverJs, /function currentPublicBuildConfig\(\)/);
  assert.match(serverJs, /const shellCacheName = readServiceWorkerCacheName\(\);/);
  assert.match(serverJs, /const buildId = appShellBuildId\(shellCacheName\);/);
  assert.match(serverJs, /clientBuildId:\s*clientBuildId\(shellCacheName, buildId\)/);
  assert.match(serverJs, /const buildConfig = currentPublicBuildConfig\(\);/);
  assert.match(serverJs, /buildId:\s*buildConfig\.buildId/);
  assert.match(serverJs, /clientBuildId:\s*buildConfig\.clientBuildId/);
  assert.match(serverJs, /shellCacheName:\s*buildConfig\.shellCacheName/);
  assert.match(indexHtml, /id="pageRefreshPrompt"/);
  assert.match(appJs, /const PAGE_SHELL_ASSETS = Object\.freeze\(\[/);
  assert.match(appJs, /"\/styles\.css"/);
  assert.match(appJs, /"\/api-client\.js"/);
  assert.match(appJs, /"\/runtime-settings\.js"/);
  assert.match(appJs, /"\/draft-store\.js"/);
  assert.match(appJs, /"\/markdown-renderer\.js"/);
  assert.match(appJs, /"\/viewport-metrics\.js"/);
  assert.match(appJs, /"\/conversation-scroll\.js"/);
  assert.match(appJs, /"\/image-compressor\.js"/);
  assert.match(appJs, /"\/plugin-embed\.js"/);
  assert.match(appJs, /"\/build-refresh-policy\.js"/);
  assert.match(indexHtml, /<script src="\/build-refresh-policy\.js"><\/script>\s*\n\s*<script src="\/app\.js"><\/script>/);
  assert.match(serverJs, /"viewport-metrics\.js"/);
  assert.match(serverJs, /"conversation-scroll\.js"/);
  assert.match(serverJs, /"build-refresh-policy\.js"/);
  assert.match(indexHtml, /id="hardRefreshButton"/);
  assert.match(appJs, /function checkPageRefreshAvailability\(/);
  assert.match(appJs, /function refreshPageForNewBuild\(/);
  assert.match(appJs, /function renderHardRefreshButton\(/);
  assert.match(appJs, /function handleHardRefreshClick\(/);
  assert.match(appJs, /const buildRefreshPolicy = window\.CodexBuildRefreshPolicy/);
  assert.match(appJs, /function shouldPromptForServerBuildChange\(/);
  assert.match(appJs, /function rememberRateLimitsFromConfig\(config\)/);
  assert.match(appJs, /function preparePageShellAssets\(config, options = \{\}\)/);
  assert.match(appJs, /function clearAllShellCaches\(\)/);
  assert.match(appJs, /function resetPageShellServiceWorker\(\)/);
  assert.match(appJs, /function pageReloadUrlWithBust\(\)/);
  assert.match(appJs, /rememberRateLimitsFromConfig\(config\);[\s\S]*await preparePageShellAssets\(config, \{ populateCache: true \}\)/);
  assert.match(functionBody(appJs, "refreshPageForNewBuild"), /await clearAllShellCaches\(\);[\s\S]*await preparePageShellAssets\(config, \{ populateCache: true \}\);[\s\S]*await resetPageShellServiceWorker\(\);[\s\S]*window\.location\.replace\(pageReloadUrlWithBust\(\)\);/);
  assert.doesNotMatch(functionBody(appJs, "checkPageRefreshAvailability"), /preparePageShellAssets\(config, \{ populateCache: true \}\)/);
  assert.match(functionBody(appJs, "initializePageBuildState"), /shouldPromptForServerBuildChange\(currentServerBuildId, state\.serverBuildId\)/);
  assert.match(functionBody(appJs, "checkPageRefreshAvailability"), /const serverBuildNeedsRefresh = serverBuildChanged && shouldPromptForServerBuildChange\(nextBuildId, state\.serverBuildId\)/);
  assert.match(functionBody(appJs, "checkPageRefreshAvailability"), /if \(serverBuildNeedsRefresh\) \{[\s\S]*if \(isHermesEmbedMode\(\)\) \{[\s\S]*requestHermesPluginRefresh\("server_build_changed"\);/);
  assert.match(functionBody(appJs, "checkPageRefreshAvailability"), /if \(assetsChanged && !serverBuildNeedsRefresh\) \{[\s\S]*state\.serverAssetBuildId = nextAssetBuildId;[\s\S]*return;/);
  assert.doesNotMatch(functionBody(appJs, "checkPageRefreshAvailability"), /if \(serverBuildNeedsRefresh \|\| assetsChanged\)/);
  assert.match(functionBody(appJs, "renderPageRefreshPrompt"), /New version available\. Tap to refresh\./);
  assert.match(functionBody(appJs, "renderPageRefreshPrompt"), /Manual refresh only/);
  assert.match(appJs, /cache:\s*"no-store"/);
  assert.match(appJs, /function pruneOldShellCaches\(expectedCacheName\)/);
  assert.match(appJs, /key !== expectedCacheName/);
  assert.match(appJs, /window\.location\.replace\(pageReloadUrlWithBust\(\)\)/);
  assert.match(functionBody(appJs, "renderPageRefreshPrompt"), /renderHardRefreshButton\(\)/);
  assert.match(functionBody(appJs, "handleHardRefreshClick"), /state\.pageRefreshPreparedConfig = null;[\s\S]*state\.pageRefreshReason = "build";[\s\S]*state\.pageRefreshAvailable = true;[\s\S]*await refreshPageForNewBuild\(\);/);
  assert.match(appJs, /hardRefreshButton"\)\.addEventListener\("click", \(\) => handleHardRefreshClick\(\)\.catch\(showError\)\)/);
  assert.match(appJs, /addEventListener\("click", refreshPageForNewBuild\)/);
  assert.doesNotMatch(stylesCss, /html\.embed-hermes #pageRefreshPrompt/);
  assert.match(stylesCss, /html\.embed-hermes #refreshThreads\s*\{[\s\S]*display:\s*none;/);
  assert.match(stylesCss, /html\.embed-hermes #connectionState\s*\{[\s\S]*display:\s*none;/);
  assert.match(stylesCss, /\.page-refresh-prompt/);
  assert.match(stylesCss, /\.hard-refresh-button/);
});

test("page refresh prompt also handles server restart reconnects", () => {
  assert.match(appJs, /pageRefreshReason:\s*""/);
  assert.match(appJs, /function showReconnectRefreshPrompt\(reason = "reconnect"\)/);
  assert.match(appJs, /state\.pageRefreshReason = reason === "restart" \? "restart" : "reconnect"/);
  assert.match(appJs, /function clearReconnectRefreshPrompt\(\)/);
  assert.match(functionBody(appJs, "clearReconnectRefreshPrompt"), /state\.pageRefreshReason === "reconnect" \|\| state\.pageRefreshReason === "restart"/);
  assert.match(functionBody(appJs, "clearReconnectRefreshPrompt"), /finishRestartingUiIfReady\(\)/);
  assert.match(appJs, /function recoverEventStreamWithApiFallback\(options = \{\}\)/);
  assert.match(appJs, /function scheduleEventFallbackPoll\(delayMs = 8000\)/);
  assert.match(appJs, /function scheduleEventReconnectRetry\(\)/);
  assert.match(appJs, /function scheduleVisiblePageRefreshCheck\(delayMs = 0, options = \{\}\)/);
  assert.match(appJs, /state\.events\.onopen = \(\) => \{[\s\S]*scheduleVisiblePageRefreshCheck\(200, \{ force: true \}\)/);
  assert.match(appJs, /payload\.type === "status"[\s\S]*scheduleVisiblePageRefreshCheck\(1200\)/);
  assert.match(appJs, /renderThreads\(result\);[\s\S]*scheduleVisiblePageRefreshCheck\(500\)/);
  assert.match(appJs, /Service restarted\. Tap to refresh\./);
  assert.match(appJs, /Connection changed\. Tap to refresh\./);
  assert.match(appJs, /Refreshing and reconnecting\.\.\./);
  assert.match(functionBody(appJs, "showReconnectRefreshPrompt"), /if \(isHermesEmbedMode\(\) && reason !== "restart"\) return;/);
  assert.match(appJs, /async function waitForPageBuildConfig\(timeoutMs = 18000\)/);
  assert.match(appJs, /state\.pageRefreshReason === "reconnect" \|\| state\.pageRefreshReason === "restart"[\s\S]*await waitForPageBuildConfig\(\)/);
  assert.match(functionBody(appJs, "refreshPageForNewBuild"), /if \(reconnectRefresh && !shouldPromptForServerBuildChange\(nextBuildId, currentBuildId\)\) \{[\s\S]*state\.pageRefreshAvailable = false;[\s\S]*finishRestartingUiIfReady\(\);[\s\S]*return;/);
  assert.match(appJs, /showReconnectRefreshPrompt\("reconnect"\);[\s\S]*if \(!isHermesEmbedMode\(\)\) showError\(err\)/);
  assert.match(appJs, /showReconnectRefreshPrompt\("restart"\)/);
  assert.match(appJs, /function shouldRefreshThreadListDuringEventRecovery\(options = \{\}\)/);
  assert.match(functionBody(appJs, "shouldRefreshThreadListDuringEventRecovery"), /return Boolean\(options\.force\) \|\| !isHermesEmbedMode\(\) \|\| !state\.threads\.length;/);
  assert.match(functionBody(appJs, "refreshThreadListDuringEventRecovery"), /if \(!shouldRefreshThreadListDuringEventRecovery\(options\)\) return false;/);
  assert.match(functionBody(appJs, "refreshThreadListDuringEventRecovery"), /await loadThreads\(\{ silent: isHermesEmbedMode\(\) \|\| Boolean\(state\.threads\.length\) \}\);/);
  assert.match(functionBody(appJs, "scheduleEventFallbackPoll"), /await refreshThreadListDuringEventRecovery\(\);/);
  assert.doesNotMatch(functionBody(appJs, "scheduleEventFallbackPoll"), /await loadThreads\(/);
  assert.match(functionBody(appJs, "scheduleEventFallbackPoll"), /if \(state\.currentThreadId\) await refreshCurrentThread\(\{ source: "event-fallback-poll" \}\);/);
  assert.match(functionBody(appJs, "recoverEventStreamWithApiFallback"), /Boolean\(options\.afterEventReconnect\)/);
  assert.match(functionBody(appJs, "recoverEventStreamWithApiFallback"), /await refreshThreadListDuringEventRecovery\(\{ force: Boolean\(options\.afterEventReconnect\) \}\);/);
  assert.doesNotMatch(functionBody(appJs, "recoverEventStreamWithApiFallback"), /await loadThreads\(/);
  assert.match(functionBody(appJs, "connectEvents"), /const hadReconnectFailure = state\.eventReconnectFailures > 0 \|\| state\.eventFallbackMode;/);
  assert.match(functionBody(appJs, "connectEvents"), /if \(hadReconnectFailure\) \{[\s\S]*recoverEventStreamWithApiFallback\(\{ afterEventReconnect: true \}\)/);
  assert.match(functionBody(appJs, "recoverEventStreamWithApiFallback"), /if \(isHermesEmbedMode\(\)\) \{[\s\S]*scheduleEventFallbackPoll\(\);[\s\S]*scheduleEventReconnectRetry\(\);/);
  assert.match(functionBody(appJs, "connectEvents"), /if \(!isHermesEmbedMode\(\)\) \{[\s\S]*markActivity\("重连"\);[\s\S]*updateConnectionState\(null, "Reconnecting"\);[\s\S]*\}/);
  assert.doesNotMatch(appJs, /updateConnectionState\(null, "Reconnecting"\);\s*showReconnectRefreshPrompt/);
  assert.match(appJs, /pageRefreshPrompt\.addEventListener\("click", refreshPageForNewBuild\)/);
  assert.doesNotMatch(functionBody(appJs, "handleSharedRestartClick"), /refreshPageForNewBuild\(\)\.catch\(showError\)/);
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
  assert.match(indexHtml, /setTimeout\(function \(\) \{ showRecovery\("startup-timeout"\); \}, 4500\)/);
  assert.match(appJs, /function markBootReady\(\)/);
  assert.match(appJs, /window\.codexMobileBoot/);
  assert.match(appJs, /markBootReady\(\);[\s\S]*if \(state\.startupThreadOpenPending\) renderCurrentThread\(\);/);
  assert.match(appJs, /start\(\)\.catch\(\(err\) => \{/);
  assert.match(functionBody(appJs, "refreshPageForNewBuild"), /await clearAllShellCaches\(\);[\s\S]*await resetPageShellServiceWorker\(\);/);
});

test("public pull request check prompts before public publishing work", () => {
  assert.match(indexHtml, /id="publicPrStatus"/);
  assert.match(indexHtml, /id="appNativeDialog"/);
  assert.match(stylesCss, /\.public-pr-status/);
  assert.match(stylesCss, /\.app-native-dialog/);
  assert.match(serverJs, /workspacePath:\s*APP_ROOT/);
  assert.match(serverJs, /publicPullRequests:/);
  assert.match(serverJs, /\/api\/public-pull-requests\/status/);
  assert.match(serverJs, /publicPullRequestApiUrl\(PUBLIC_PR_REPOSITORY\)/);
  assert.match(appJs, /function renderPublicPrStatus\(\)/);
  assert.match(appJs, /function maybePromptPublicPrMerge\(status\)/);
  assert.match(appJs, /function publicPrMergeConfirmationMessage\(status\)/);
  assert.match(appJs, /function publicPrMergeInstruction\(status\)/);
  assert.match(appJs, /const PUBLIC_PR_REVIEW_THREAD_TITLE = "Codex Mobile Public PR";/);
  assert.match(appJs, /function findPublicPrReviewThread\(workspacePath = ""\)/);
  assert.match(appJs, /function publicPrReviewWorkspacePath\(\)/);
  assert.match(appJs, /async function openPublicPrReviewThreadIfAvailable\(workspacePath, text\)/);
  assert.match(appJs, /await loadThread\(target\.id, \{ source: "public-pr" \}\);/);
  assert.match(appJs, /state\.appWorkspacePath = String\(config\.workspacePath \|\| state\.appWorkspacePath \|\| ""\)\.trim\(\);/);
  assert.match(functionBody(appJs, "preparePublicPrMergePrompt"), /const workspacePath = publicPrReviewWorkspacePath\(\);/);
  assert.match(functionBody(appJs, "preparePublicPrMergePrompt"), /await loadWorkspaces\(\)\.catch/);
  assert.match(appJs, /if \(await openPublicPrReviewThreadIfAvailable\(workspacePath, text\)\) \{[\s\S]*return;[\s\S]*\}/);
  assert.match(appJs, /state\.newThreadTitle = publicPrReviewThreadTitle\(\);[\s\S]*state\.newThreadDraft = true;|state\.newThreadDraft = true;[\s\S]*state\.newThreadTitle = publicPrReviewThreadTitle\(\);/);
  assert.match(appJs, /body\.append\("title", submittedTitle\);/);
  assert.match(appJs, /scheduleStartupPublicPrCheck\(\)/);
  assert.match(appJs, /handlePublicPrStatusClick\(\)\.catch\(showError\)/);
  assert.match(functionBody(appJs, "maybePromptPublicPrMerge"), /requestAppConfirmation\(publicPrMergeConfirmationMessage\(status\)/);
  assert.match(functionBody(appJs, "handlePublicPrStatusClick"), /await requestAppConfirmation\(publicPrMergeConfirmationMessage\(status\)/);
});

test("mobile shell action dialogs do not depend on native browser modals", () => {
  assert.match(indexHtml, /id="appNativeDialog"/);
  assert.match(indexHtml, /id="appNativeDialogInput"/);
  assert.match(stylesCss, /\.app-native-dialog/);
  assert.match(appJs, /function requestAppAlert\(message, options = \{\}\)/);
  assert.match(appJs, /function requestAppConfirmation\(message, options = \{\}\)/);
  assert.match(appJs, /function requestAppTextInput\(message, value = "", options = \{\}\)/);
  assert.doesNotMatch(appJs, /window\.(alert|confirm|prompt)\(/);
  assert.doesNotMatch(appJs, /\balert\(/);
  assert.doesNotMatch(appJs, /\bconfirm\(/);
  assert.doesNotMatch(appJs, /\bprompt\(/);
  assert.match(functionBody(appJs, "handleAppUpdateClick"), /await requestAppConfirmation\(/);
  assert.match(functionBody(appJs, "clearSideChat"), /await requestAppConfirmation\(/);
  assert.match(functionBody(appJs, "createThreadTaskCardFromCurrent"), /await requestAppTextInput\(/);
  assert.match(functionBody(appJs, "replyTaskCard"), /await requestAppTextInput\(/);
  assert.doesNotMatch(functionBody(appJs, "requestCodexProfileSwitchConfirmation"), /window\.confirm/);
  assert.doesNotMatch(functionBody(appJs, "requestThreadArchiveConfirmation"), /window\.confirm/);
});

test("public pull request prompt clears stale merged PR state", () => {
  assert.match(appJs, /function publicPrHasOpenPullRequests\(status\)/);
  assert.match(functionBody(appJs, "handlePublicPrStatusClick"), /refreshPublicPrStatus\(\{ force: true, skipPrompt: true \}\)/);
  assert.match(functionBody(appJs, "handlePublicPrStatusClick"), /!publicPrHasOpenPullRequests\(status\)/);
  assert.match(functionBody(appJs, "renderPublicPrStatus"), /el\.classList\.toggle\("hidden", !checking && !hasPrs && !blocked\)/);
  assert.match(functionBody(appJs, "refreshPublicPrStatus"), /hasOpenPullRequests: false/);
  assert.match(functionBody(appJs, "refreshPublicPrStatus"), /openPullRequestCount: 0/);
  assert.match(functionBody(appJs, "refreshPublicPrStatus"), /pullRequests: \[\]/);
  assert.match(functionBody(appJs, "renderUpdatePanel"), /hasPublicPrs\s*\?\s*"Review Public PR"\s*:\s*"Check PR"/);
  assert.match(functionBody(appJs, "renderUpdatePanel"), /primary: hasPublicPrs/);
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
  assert.match(serverJs, /publicRelease:/);
  assert.match(serverJs, /\/api\/public-release\/status/);
  assert.match(serverJs, /function publicRepositoryCommitApiUrl\(/);
  assert.match(serverJs, /currentCheckoutUsesPublicRelease/);
  assert.match(appJs, /function renderUpdatePanel\(\)/);
  assert.match(appJs, /function refreshPublicReleaseStatus\(options = \{\}\)/);
  assert.match(appJs, /function currentUpdateUsesPublicRelease\(/);
  assert.match(appJs, /function clientBuildVersionText\(buildId = CLIENT_BUILD_ID\)/);
  assert.match(appJs, /v\$\{version\} · \$\{client\}/);
  assert.match(appJs, /当前客户端 \$\{CLIENT_BUILD_ID\}/);
  assert.match(appJs, /appUpdateStatus"\)\.addEventListener\("click", openUpdatePanel\)/);
  assert.match(appJs, /updateActionButton\("apply-current"/);
});

test("README documents manual-start update restart requirement", () => {
  assert.match(readme, /直接手动运行 `node server\.js`、`npm start` 或一次性 shell 命令/);
  assert.match(readme, /自更新会完成文件更新并停止旧服务/);
  assert.match(readme, /需要在部署机重新执行启动命令/);
});
