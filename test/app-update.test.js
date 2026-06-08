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
  assert.match(appJs, /function recoverEventStreamWithApiFallback\(\)/);
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
  assert.match(appJs, /showReconnectRefreshPrompt\("reconnect"\);[\s\S]*if \(!isHermesEmbedMode\(\)\) showError\(err\)/);
  assert.match(appJs, /showReconnectRefreshPrompt\("restart"\)/);
  assert.match(appJs, /function shouldRefreshThreadListDuringEventRecovery\(\)/);
  assert.match(functionBody(appJs, "shouldRefreshThreadListDuringEventRecovery"), /return !isHermesEmbedMode\(\) \|\| !state\.threads\.length;/);
  assert.match(functionBody(appJs, "refreshThreadListDuringEventRecovery"), /if \(!shouldRefreshThreadListDuringEventRecovery\(\)\) return false;/);
  assert.match(functionBody(appJs, "refreshThreadListDuringEventRecovery"), /await loadThreads\(\{ silent: isHermesEmbedMode\(\) \|\| Boolean\(state\.threads\.length\) \}\);/);
  assert.match(functionBody(appJs, "scheduleEventFallbackPoll"), /await refreshThreadListDuringEventRecovery\(\);/);
  assert.doesNotMatch(functionBody(appJs, "scheduleEventFallbackPoll"), /await loadThreads\(/);
  assert.match(functionBody(appJs, "scheduleEventFallbackPoll"), /if \(state\.currentThreadId\) await refreshCurrentThread\(\);/);
  assert.match(functionBody(appJs, "recoverEventStreamWithApiFallback"), /await refreshThreadListDuringEventRecovery\(\);/);
  assert.doesNotMatch(functionBody(appJs, "recoverEventStreamWithApiFallback"), /await loadThreads\(/);
  assert.match(functionBody(appJs, "recoverEventStreamWithApiFallback"), /if \(isHermesEmbedMode\(\)\) \{[\s\S]*scheduleEventFallbackPoll\(\);[\s\S]*scheduleEventReconnectRetry\(\);/);
  assert.match(functionBody(appJs, "connectEvents"), /if \(!isHermesEmbedMode\(\)\) \{[\s\S]*markActivity\("重连"\);[\s\S]*updateConnectionState\(null, "Reconnecting"\);[\s\S]*\}/);
  assert.doesNotMatch(appJs, /updateConnectionState\(null, "Reconnecting"\);\s*showReconnectRefreshPrompt/);
  assert.match(appJs, /pageRefreshPrompt\.addEventListener\("click", refreshPageForNewBuild\)/);
  assert.doesNotMatch(functionBody(appJs, "handleSharedRestartClick"), /refreshPageForNewBuild\(\)\.catch\(showError\)/);
});

test("public pull request check prompts before public publishing work", () => {
  assert.match(indexHtml, /id="publicPrStatus"/);
  assert.match(stylesCss, /\.public-pr-status/);
  assert.match(serverJs, /workspacePath:\s*APP_ROOT/);
  assert.match(serverJs, /publicPullRequests:/);
  assert.match(serverJs, /\/api\/public-pull-requests\/status/);
  assert.match(serverJs, /publicPullRequestApiUrl\(PUBLIC_PR_REPOSITORY\)/);
  assert.match(appJs, /function renderPublicPrStatus\(\)/);
  assert.match(appJs, /function maybePromptPublicPrMerge\(status\)/);
  assert.match(appJs, /function publicPrMergeInstruction\(status\)/);
  assert.match(appJs, /const PUBLIC_PR_REVIEW_THREAD_TITLE = "Codex Mobile Public PR";/);
  assert.match(appJs, /function findPublicPrReviewThread\(workspacePath = ""\)/);
  assert.match(appJs, /async function openPublicPrReviewThreadIfAvailable\(workspacePath, text\)/);
  assert.match(appJs, /await loadThread\(target\.id, \{ source: "public-pr" \}\);/);
  assert.match(appJs, /state\.appWorkspacePath = String\(config\.workspacePath \|\| state\.appWorkspacePath \|\| ""\)\.trim\(\);/);
  assert.match(appJs, /if \(await openPublicPrReviewThreadIfAvailable\(workspacePath, text\)\) \{[\s\S]*return;[\s\S]*\}/);
  assert.match(appJs, /state\.newThreadTitle = publicPrReviewThreadTitle\(\);[\s\S]*state\.newThreadDraft = true;|state\.newThreadDraft = true;[\s\S]*state\.newThreadTitle = publicPrReviewThreadTitle\(\);/);
  assert.match(appJs, /body\.append\("title", submittedTitle\);/);
  assert.match(appJs, /scheduleStartupPublicPrCheck\(\)/);
  assert.match(appJs, /handlePublicPrStatusClick\(\)\.catch\(showError\)/);
});

test("version button opens an update panel with Public release status", () => {
  assert.match(indexHtml, /id="updateDialog"/);
  assert.match(stylesCss, /\.update-dialog/);
  assert.match(serverJs, /publicRelease:/);
  assert.match(serverJs, /\/api\/public-release\/status/);
  assert.match(serverJs, /function publicRepositoryCommitApiUrl\(/);
  assert.match(serverJs, /currentCheckoutUsesPublicRelease/);
  assert.match(appJs, /function renderUpdatePanel\(\)/);
  assert.match(appJs, /function refreshPublicReleaseStatus\(options = \{\}\)/);
  assert.match(appJs, /function currentUpdateUsesPublicRelease\(/);
  assert.match(appJs, /appUpdateStatus"\)\.addEventListener\("click", openUpdatePanel\)/);
  assert.match(appJs, /updateActionButton\("apply-current"/);
});

test("README documents manual-start update restart requirement", () => {
  assert.match(readme, /直接手动运行 `node server\.js`、`npm start` 或一次性 shell 命令/);
  assert.match(readme, /自更新会完成文件更新并停止旧服务/);
  assert.match(readme, /需要在部署机重新执行启动命令/);
});
