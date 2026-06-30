"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const serverJs = fs.readFileSync(path.resolve(__dirname, "..", "server.js"), "utf8");
const coreApiRouteServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "adapters", "core-api-route-service.js"), "utf8");
const continuationThreadServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "adapters", "continuation-thread-service.js"), "utf8");
const codexAppServerClientServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "adapters", "codex-app-server-client-service.js"), "utf8");
const taskCardRouteServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "adapters", "thread-task-card-route-service.js"), "utf8");
const threadMessageRouteServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "adapters", "thread-message-route-service.js"), "utf8");
const threadListFallbackSourceServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "adapters", "thread-list-fallback-source-service.js"), "utf8");
const appJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "app.js"), "utf8");
const indexHtml = fs.readFileSync(path.resolve(__dirname, "..", "public", "index.html"), "utf8");

function functionBody(source, name) {
  let start = source.indexOf(`function ${name}(`);
  if (start < 0) start = source.indexOf(`async function ${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const bodyStart = source.indexOf(") {", start) + 2;
  assert.notEqual(bodyStart, 1, `missing function body ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(bodyStart + 1, index);
  }
  throw new Error(`could not parse function ${name}`);
}

function functionSource(source, name) {
  let start = source.indexOf(`function ${name}(`);
  if (start < 0) start = source.indexOf(`async function ${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const bodyStart = source.indexOf(") {", start) + 2;
  assert.notEqual(bodyStart, 1, `missing function body ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`could not parse function ${name}`);
}

test("new-message route creates a thread before starting the first turn", () => {
  const routeIndex = threadMessageRouteServiceJs.indexOf("/api/threads/new-message");
  const fallbackIndex = threadMessageRouteServiceJs.indexOf('const resume = url.pathname.match', routeIndex);
  assert.ok(routeIndex > 0, "missing /api/threads/new-message route");
  assert.ok(fallbackIndex > routeIndex, "missing new-message route end");

  const routeBody = threadMessageRouteServiceJs.slice(routeIndex, fallbackIndex);
  const threadStartIndex = routeBody.indexOf('codex.request("thread/start"');
  const turnStartIndex = routeBody.indexOf('codex.request("turn/start"');
  assert.ok(threadStartIndex > 0, "new-message route must call thread/start");
  assert.ok(turnStartIndex > threadStartIndex, "new-message route must start the first turn after thread/start");
});

test("continuation confirm resolves tile-pane detail sources without current fallback", () => {
  const sources = [
    "threadById",
    "continuationDialogSourceThread",
    "confirmContinuationDialog",
  ].map((name) => functionSource(appJs, name));
  const harness = Function(`
const calls = { start: [], errors: [] };
const state = {
  continuationDialogThreadId: "thread-pane",
  currentThread: { id: "thread-current", name: "Current" },
  threads: [],
  threadTileDetails: new Map([["thread-pane", { id: "thread-pane", name: "Pane", cwd: "/tmp/pane" }]]),
};
function startNewThreadFromThread(thread) {
  calls.start.push(thread && thread.id || "");
  return Promise.resolve();
}
function showError(err) {
  calls.errors.push(String(err && err.message || err));
}
${sources.join("\n")}
return {
  confirm: confirmContinuationDialog,
  setThreadId(id) { state.continuationDialogThreadId = id; },
  calls,
};
`)();

  harness.confirm();
  assert.deepEqual(harness.calls.start, ["thread-pane"]);
  assert.deepEqual(harness.calls.errors, []);

  harness.setThreadId("missing-thread");
  harness.confirm();
  assert.deepEqual(harness.calls.start, ["thread-pane"]);
  assert.deepEqual(harness.calls.errors, ["Continuation source thread is no longer available"]);
});

test("continuation dialog exposes in-modal progress and diagnostics", () => {
  assert.match(indexHtml, /id="continuationStatus"[\s\S]*aria-live="polite"/);
  assert.match(appJs, /function setContinuationDialogStatus\(/);
  assert.match(appJs, /function setContinuationDialogBusy\(/);

  const openBody = functionBody(appJs, "openContinuationDialog");
  assert.match(openBody, /setContinuationDialogBusy\(false\)/);
  assert.match(openBody, /postClientEvent\("continuation_dialog_opened"/);

  const closeBody = functionBody(appJs, "closeContinuationDialog");
  assert.match(closeBody, /state\.continuationBusy && !options\.force/);
  assert.match(closeBody, /postClientEvent\("continuation_dialog_close_blocked"/);

  const startBody = functionBody(appJs, "startNewThreadFromThread");
  assert.match(startBody, /if \(state\.continuationBusy\) \{/);
  assert.match(startBody, /setContinuationDialogStatus\("续接任务已经在运行，请稍等。"\)/);
  assert.match(startBody, /postClientEvent\("continuation_start_ignored_busy"/);
  assert.match(startBody, /setContinuationDialogBusy\(true, "正在创建续接任务。"\)/);
  assert.match(startBody, /postClientEvent\("continuation_start_requested"/);
  assert.match(startBody, /postClientEvent\("continuation_job_created"/);
  assert.match(startBody, /closeContinuationDialog\(\{ force: true \}\)/);

  const waitBody = functionBody(appJs, "waitForContinuationJob");
  assert.match(waitBody, /setContinuationDialogStatus\(continuationJobStatusText\(job\)/);
  assert.match(waitBody, /postClientEvent\("continuation_job_poll"/);
  assert.match(waitBody, /postClientEvent\("continuation_job_done"/);
  assert.match(waitBody, /postClientEvent\("continuation_job_failed"/);
});

test("new-message route allows Codex App style projectless threads", () => {
  const routeIndex = threadMessageRouteServiceJs.indexOf("/api/threads/new-message");
  const fallbackIndex = threadMessageRouteServiceJs.indexOf('const resume = url.pathname.match', routeIndex);
  const routeBody = threadMessageRouteServiceJs.slice(routeIndex, fallbackIndex);

  assert.doesNotMatch(routeBody, /Workspace is required to start a new thread/);
  assert.match(routeBody, /if \(cwd\) startParamsBase\.cwd = cwd;/);
  assert.match(routeBody, /\.\.\.\(cwd \? \{ cwd \} : \{\}\)/);
  assert.match(routeBody, /const projectlessThreadRegistered = cwd \? false : rememberProjectlessThreadId\(threadId\);/);
  assert.match(routeBody, /projectlessThreadRegistered,/);
  assert.match(serverJs, /function rememberProjectlessThreadId\(threadId\)/);
  assert.match(serverJs, /state\["projectless-thread-ids"\] = existing\.concat\(\[id\]\);/);
});

test("new-message route forwards new-thread runtime settings", () => {
  const routeIndex = threadMessageRouteServiceJs.indexOf("/api/threads/new-message");
  const fallbackIndex = threadMessageRouteServiceJs.indexOf('const resume = url.pathname.match', routeIndex);
  const routeBody = threadMessageRouteServiceJs.slice(routeIndex, fallbackIndex);

  assert.match(routeBody, /const requestedModel\s*=/, "new-thread route should read requested model");
  assert.match(routeBody, /const requestedEffort\s*=/, "new-thread route should read requested reasoning effort");
  assert.match(routeBody, /const requestedFastMode = requestedCodexFastMode\(body\.fastMode\);/, "new-thread route should read requested Fast service tier");
  assert.match(routeBody, /if \(requestedModel\) startParams\.model = requestedModel;/, "thread/start should receive requested model");
  assert.match(routeBody, /applyCodexFastServiceTier\(applyTurnRuntimeSettings\(/, "turn/start should apply requested Fast service tier");
  assert.match(routeBody, /if \(requestedModel\) turnParams\.model = requestedModel;/, "turn/start should receive requested model");
  assert.match(routeBody, /if \(requestedEffort\) turnParams\.effort = requestedEffort;/, "turn/start should receive requested reasoning effort");
});

test("new-message route can persist an explicit initial thread title", () => {
  const routeIndex = threadMessageRouteServiceJs.indexOf("/api/threads/new-message");
  const fallbackIndex = threadMessageRouteServiceJs.indexOf('const resume = url.pathname.match', routeIndex);
  const routeBody = threadMessageRouteServiceJs.slice(routeIndex, fallbackIndex);

  assert.match(routeBody, /const requestedTitle = truncateSingleLine\(String\(body\.title \|\| body\.name \|\| ""\)\.trim\(\), 120\);/);
  assert.match(routeBody, /titleIndexed = persistThreadTitleToSessionIndex\(threadId, requestedTitle\);/);
  assert.match(routeBody, /titleUpdated = await tryUpdateThreadTitle\(threadId, requestedTitle\);/);
  assert.match(routeBody, /name: requestedTitle \|\| undefined/);
  assert.match(routeBody, /preview: requestedTitle \|\| text \|\| \(cwd \? path\.basename\(cwd\) : ""\) \|\| "新建对话"/);
  assert.match(routeBody, /titleUpdated,/);
  assert.match(routeBody, /titleIndexed,/);
});

test("server default model falls back to GPT-5.5", () => {
  assert.match(serverJs, /const MODEL_OPTIONS = optionListFromEnv\("CODEX_MOBILE_MODEL_OPTIONS", \[\s*"gpt-5\.5"/);
  assert.match(serverJs, /const DEFAULT_MODEL = MODEL_OPTIONS\[0\] \|\| "gpt-5\.5";/);
  assert.match(coreApiRouteServiceJs, /defaultModel: codexConfigDefaults\.model \|\| defaultModel/);
  assert.match(coreApiRouteServiceJs, /defaultPermissionMode: defaultPermissionModeFromConfigDefaults\(\)/);
  assert.match(serverJs, /function defaultPermissionModeFromConfigDefaults\(\)[\s\S]*dangerFullAccess[\s\S]*return "full"/);
  assert.match(serverJs, /disabled:\s*"dangerFullAccess"/);
  assert.match(serverJs, /"no-sandbox":\s*"dangerFullAccess"/);
});

test("server resolves the default Codex executable from macOS install paths", () => {
  assert.match(serverJs, /const CODEX_EXE = resolveDefaultCodexExecutable\(\);/);
  assert.match(serverJs, /function resolveDefaultCodexExecutable\(/);
  assert.match(serverJs, /process\.env\.CODEX_MOBILE_CODEX_EXE/);
  assert.match(serverJs, /function pathEntriesFromEnvPath\(/);
  assert.match(serverJs, /path\.delimiter/);
  assert.match(serverJs, /\/opt\/homebrew\/bin/);
  assert.match(serverJs, /path\.join\(USER_HOME, "\.local", "bin"\)/);
  assert.match(serverJs, /findExecutableInDirs\("codex", commonCodexExecutableDirs\(\)\)/);
});

test("server maps quota groups to shared Codex and independent Spark models", () => {
  const start = serverJs.indexOf("function rateLimitModelKeys(");
  const end = serverJs.indexOf("function recordRateLimits(", start);
  assert.ok(start > 0 && end > start, "missing server quota mapping function");
  const body = serverJs.slice(start, end);

  assert.match(body, /limitId === "codex-bengalfox"[\s\S]*gpt-5\.3-codex-spark/, "Spark quota should map to Spark only");
  assert.match(body, /limitId === "codex"[\s\S]*!isSparkModelKey\(modelKey\)/, "Codex quota should map to non-Spark models");
});

test("server hydrates rollout quota snapshots without overwriting live quota", () => {
  assert.match(serverJs, /function loadRecentRateLimitsFromRollouts\(/, "server should scan local rollout evidence");
  assert.match(serverJs, /isRateLimitRolloutSourceAccountScoped\(CODEX_HOME\)/, "server should only scan account-scoped rollout quota evidence");
  assert.match(serverJs, /entry && entry\.payload && entry\.payload\.rate_limits/, "server should read native rollout rate_limits");
  assert.match(serverJs, /recordRateLimits\(entry\.rateLimits,\s*\{\s*source:\s*"rollout"\s*\}\)/, "rollout scan should write snapshot quota");
  assert.match(serverJs, /function canExposeRateLimitsForActiveHome\(\)[\s\S]*isRateLimitRolloutSourceAccountScoped\(CODEX_HOME\)/, "server should gate quota exposure to account-scoped homes");
  assert.match(serverJs, /function isTrustedLiveRateLimitSource\([\s\S]*managed-child-live[\s\S]*profile-mux-live/, "owned live quota should be exposable for shared profile homes");
  assert.match(serverJs, /function recordRateLimits\([\s\S]*!isRateLimitRolloutSourceAccountScoped\(CODEX_HOME\)[\s\S]*latestLiveRateLimits = null/, "source-less live quota should be ignored for shared profile homes");
  assert.match(serverJs, /function recordRateLimitReadResult\([\s\S]*rateLimitsByLimitId[\s\S]*latestLiveRateLimitsSource = source/, "rate-limit read RPC should hydrate model quota snapshots");
  assert.match(codexAppServerClientServiceJs, /await this\.refreshRateLimits\(\);[\s\S]*this\.ready = true/, "initialize should refresh quota before broadcasting ready status");
  assert.match(codexAppServerClientServiceJs, /async refreshRateLimitsIfMissing\(\)[\s\S]*LIVE_RATE_LIMIT_REFRESH_MIN_INTERVAL_MS/, "server should rehydrate missing live quota after app-server startup");
  assert.match(codexAppServerClientServiceJs, /this\.sendRpc\("account\/rateLimits\/read"[\s\S]*resetOnTimeout:\s*false/, "quota refresh should call the official app-server read RPC without resetting the transport on timeout");
  assert.match(codexAppServerClientServiceJs, /rateLimitSource\(\)[\s\S]*this\.isMuxEndpoint\(\)[\s\S]*"profile-mux-live"/, "profile mux quota should be marked as owned by the active profile endpoint");
  assert.match(codexAppServerClientServiceJs, /recordRateLimits\(msg\.params\.rateLimits,\s*\{[\s\S]*source:\s*this\.rateLimitSource\(\)/, "quota notifications should use the same trusted source classifier as quota reads");
  assert.match(serverJs, /function codexAppServerChildEnv\([\s\S]*CODEX_CLI_PATH[\s\S]*CODEX_MUX_/, "managed child app-server env should drop desktop bridge variables");
  assert.match(serverJs, /if \(CODEX_HOME\) env\.CODEX_HOME = CODEX_HOME;[\s\S]*Object\.assign\(env, extra\);/, "explicit child env should be able to override the active CODEX_HOME for profile preflight");
  assert.match(codexAppServerClientServiceJs, /spawn\(CODEX_EXE,[\s\S]*\{\s*cwd: APP_ROOT,[\s\S]*env: codexAppServerChildEnv\(\{ CODEX_HOME \}\)/, "managed child app-server should inherit the resolved active CODEX_HOME without desktop bridge env");
  assert.match(codexAppServerClientServiceJs, /async startOwnedMuxAndConnect\(\)/, "Mobile Web should be able to own a shared mux instead of depending on Desktop");
  assert.match(codexAppServerClientServiceJs, /CODEX_MUX_STANDALONE:\s*"1"[\s\S]*CODEX_MUX_KEEP_ALIVE:\s*"1"[\s\S]*CODEX_MUX_PUBLISH_ENDPOINT:\s*"1"/, "Mobile-owned mux should stay alive after Desktop exits and publish the active profile endpoint");
  assert.match(codexAppServerClientServiceJs, /shared endpoint missing; starting Mobile-owned mux/, "required shared mode should start a Mobile-owned mux when the profile endpoint is absent");
  assert.match(codexAppServerClientServiceJs, /profile mux endpoint unavailable; starting Mobile-owned mux/, "stale profile endpoints should be replaced by a Mobile-owned mux");
  assert.match(serverJs, /const PERSIST_MOBILE_OWNED_MUX =/, "server should expose a persistent owned mux mode for Listener restarts");
  assert.match(codexAppServerClientServiceJs, /detached:\s*PERSIST_MOBILE_OWNED_MUX/, "persistent owned mux should detach from the Listener process group");
  assert.match(codexAppServerClientServiceJs, /child\.unref\(\)/, "persistent owned mux should not keep the Listener process alive");
  assert.match(codexAppServerClientServiceJs, /persistentOwnedMux:\s*PERSIST_MOBILE_OWNED_MUX/, "status should expose persistent owned mux mode");
  assert.match(codexAppServerClientServiceJs, /mobileOwnedMux:\s*this\.muxChild \? \{[\s\S]*pid:[\s\S]*running:/, "status should expose bounded Mobile-owned mux runtime evidence");
  assert.match(serverJs, /if \(!PERSIST_MOBILE_OWNED_MUX && codex\.muxChild && codex\.muxChild\.exitCode === null\) codex\.muxChild\.kill\(\)/, "server shutdown should preserve persistent owned mux children");
  assert.match(serverJs, /function activeRateLimits\(\)[\s\S]*latestLiveRateLimits \|\| latestSnapshotRateLimits/, "live quota should win over rollout snapshots");
  assert.match(coreApiRouteServiceJs, /\/api\/public-config"[\s\S]*await codex\.refreshRateLimitsIfMissing\(\);[\s\S]*rateLimits: activeRateLimits\(\)/, "public config should refresh and include active quota");
  assert.match(coreApiRouteServiceJs, /\/api\/status"[\s\S]*await codex\.refreshRateLimitsIfMissing\(\);[\s\S]*const status = codex\.status\(\);[\s\S]*sendJson\(200, status\)/, "status should refresh and include hydrated quota snapshots");
});

test("server runtime inheritance includes model and reasoning effort", () => {
  const settingsBody = functionBody(serverJs, "threadRuntimeSettings");
  assert.match(settingsBody, /lastString\(context\.model, thread && thread\.model, CODEX_CONFIG_DEFAULTS\.model\)/, "runtime settings should inherit model from rollout, state DB, or config");
  assert.match(settingsBody, /lastString\(context\.effort, context\.reasoning_effort, context\.model_reasoning_effort, thread && thread\.effort, CODEX_CONFIG_DEFAULTS\.reasoningEffort\)/, "runtime settings should inherit reasoning effort from rollout, state DB, or config");
  assert.match(settingsBody, /model,\s*reasoningEffort,/, "runtime settings response should expose inherited model and effort");

  const startBody = functionBody(serverJs, "applyStartThreadRuntimeSettings");
  assert.match(startBody, /attachWorkspaceDelegationRuntimeGuidance\(params\)/, "thread/start should receive workspace delegation dynamic tools and script fallback guidance when enabled");
  assert.match(startBody, /if \(settings\.model\) params\.model = settings\.model;/, "thread/start should inherit model");
  assert.match(startBody, /applyWorkspaceDelegationRuntimeGuard\(params, settings, \{ useSandboxPolicy: false \}\)/, "thread/start should enforce workspace delegation write guard");

  const turnBody = functionBody(serverJs, "applyTurnRuntimeSettings");
  assert.match(turnBody, /attachWorkspaceDelegationRuntimeGuidance\(params\)/, "turn/start should receive workspace delegation dynamic tools and script fallback guidance when enabled");
  assert.match(turnBody, /if \(settings\.model\) params\.model = settings\.model;/, "turn/start should inherit model");
  assert.match(turnBody, /if \(settings\.reasoningEffort\) params\.effort = settings\.reasoningEffort;/, "turn/start should inherit reasoning effort");
  assert.match(turnBody, /applyWorkspaceDelegationRuntimeGuard\(params, settings, \{ useSandboxPolicy: true \}\)/, "turn/start should enforce workspace delegation write guard");

  const resumeBody = functionBody(serverJs, "applyResumeRuntimeSettings");
  assert.match(resumeBody, /applyWorkspaceDelegationRuntimeGuard\(params, settings, \{ useSandboxPolicy: false \}\)/, "thread/resume should enforce workspace delegation write guard");

  const guardBody = functionBody(serverJs, "applyWorkspaceDelegationRuntimeGuard");
  assert.match(guardBody, /workspaceDelegationPublicSettings\(\)\.enabled/, "write guard should only run when workspace delegation is enabled");
  assert.match(guardBody, /WORKSPACE_DELEGATION_WRITE_GUARD_DISABLED/, "write guard should have an emergency server-side disable gate");
  assert.match(guardBody, /runtimeCwdForParams\(params\)/, "write guard should resolve cwd from params or thread id");
  assert.match(guardBody, /workspaceDelegationGuardExemptCwd\(cwd\)/, "write guard should preserve trusted maintenance/deploy permissions");
  assert.ok(
    guardBody.indexOf("workspaceDelegationGuardExemptCwd(cwd)") < guardBody.indexOf("applyWorkspaceDelegationFullAccessCompatRuntime(params, options)"),
    "maintenance/deploy exemptions must run before runtime compatibility overrides",
  );
  assert.match(guardBody, /WORKSPACE_DELEGATION_APPROVAL_PROXY_ONLY/, "old full-access approval-proxy mode should require explicit operator opt-in");
  assert.match(guardBody, /WORKSPACE_DELEGATION_ENFORCE_SANDBOX_GUARD/, "explicit hard sandbox env should override approval-proxy-only compatibility");
  assert.match(guardBody, /params\.approvalPolicy = "on-request"/, "default guard should keep approval events available for current .git auto-allow and foreign-source denials");
  assert.match(guardBody, /params\.sandboxPolicy = workspaceDelegationWriteGuardSandboxPolicy\(cwd, settings && settings\.sandboxPolicy\)/, "turn/start should receive a real workspace-write sandbox policy by default");
  assert.match(guardBody, /workspaceDelegationWriteGuardPermissionProfile\(cwd, settings && settings\.sandboxPolicy\)/, "opt-in hard guard should still use a bounded managed permission profile");
  assert.match(guardBody, /delete params\.sandboxPolicy/, "guard should be able to clear stale workspace-write sandbox policy");
  assert.match(guardBody, /params\.sandbox = "workspace-write"/, "thread/start and thread/resume should still support workspace-write sandbox mode");

  const compatBody = functionBody(serverJs, "applyWorkspaceDelegationFullAccessCompatRuntime");
  assert.match(compatBody, /params\.approvalPolicy = "on-request"/, "compat runtime should keep app-server approval events available for dynamic source-write decisions");
  assert.match(compatBody, /params\.sandboxPolicy = \{ type: "dangerFullAccess" \}/, "turn/start compatibility should override inherited workspace-write sandbox policy");
  assert.match(compatBody, /params\.sandbox = "danger-full-access"/, "thread/start and thread/resume compatibility should restore full access sandbox mode");
  assert.match(compatBody, /delete params\.permissionProfile/, "compat runtime should clear stale managed profiles that made .git read-only");

  const guardSandboxPolicyBody = functionBody(serverJs, "workspaceDelegationWriteGuardSandboxPolicy");
  assert.match(guardSandboxPolicyBody, /path\.join\(root, "\.git"\)/, "guard sandbox policy should include current .git as an explicit writable root");
  assert.match(guardSandboxPolicyBody, /policy\.writableRoots = writableRoots/, "guard sandbox policy should publish expanded writable roots to app-server");

  assert.match(codexAppServerClientServiceJs, /handleServerRequest\(msg\)[\s\S]*answerWorkspaceSourceWriteGuardRequest\(request\)/, "app-server approval requests should pass through the dynamic source-write guard");
  const approvalGuardBody = functionBody(serverJs, "workspaceSourceWriteGuardDecisionForRequest");
  assert.match(approvalGuardBody, /ACTIONABLE_APPROVAL_METHODS\.has\(request\.method\)/, "dynamic guard should only auto-answer app-server approval requests");
  assert.match(approvalGuardBody, /workspaceSourceWriteGuardThreadCwdForRequest\(request\)/, "approval guard should base exemptions on the source thread cwd, not the command cwd");
  assert.match(approvalGuardBody, /const cwd = sourceCwd \|\| workspaceSourceWriteGuardCwdForRequest\(request\)/, "approval guard should fall back to request cwd only when thread cwd is unavailable");
  assert.match(approvalGuardBody, /workspaceSourceWriteGuardService\.classify\(request\)/, "dynamic guard should delegate source-write policy to the adapter service");

  const sourceCwdBody = functionBody(serverJs, "workspaceSourceWriteGuardThreadCwdForRequest");
  assert.doesNotMatch(sourceCwdBody, /params\.cwd/, "source-thread cwd resolution must not treat command cwd as the source workspace");
  const requestCwdBody = functionBody(serverJs, "workspaceSourceWriteGuardCwdForRequest");
  assert.ok(
    requestCwdBody.indexOf("workspaceSourceWriteGuardThreadCwdForRequest(request)") < requestCwdBody.indexOf("params.cwd"),
    "request cwd fallback should only run after source-thread cwd lookup",
  );

  const guardProfileBody = functionBody(serverJs, "workspaceDelegationWriteGuardPermissionProfile");
  assert.match(guardProfileBody, /kind: "root"[\s\S]*access: "read"/, "guard profile should keep root read-only");
  assert.match(guardProfileBody, /path\.join\(root, "\.git"\)[\s\S]*access: "write"/, "guard profile should allow git metadata writes inside the current workspace");
  assert.match(guardProfileBody, /path\.join\(root, "\.codex"\)[\s\S]*access: "read"/, "guard profile should keep workspace .codex metadata read-only");
  assert.match(guardProfileBody, /path\.join\(root, "\.agents"\)[\s\S]*access: "read"/, "guard profile should keep workspace .agents metadata read-only");

  const normalizeProfileBody = functionBody(serverJs, "normalizePermissionProfile");
  assert.match(normalizeProfileBody, /type: profile\.type \|\| profile\.kind \|\| null/, "runtime inheritance should preserve permission profile type");
  assert.match(normalizeProfileBody, /type: fileSystem\.type \|\| null/, "runtime inheritance should preserve permission profile file-system type");

  assert.match(serverJs, /CODEX_MOBILE_WORKSPACE_DELEGATION_WRITE_GUARD/, "server should expose an emergency write-guard disable env");
  assert.match(serverJs, /CODEX_MOBILE_WORKSPACE_DELEGATION_DISABLE_WRITE_GUARD/, "server should expose a positive emergency write-guard disable env");
  assert.match(serverJs, /CODEX_MOBILE_WORKSPACE_DELEGATION_APPROVAL_PROXY_ONLY/, "server should expose an emergency opt-in for the old approval-proxy-only mode");
  assert.match(serverJs, /CODEX_MOBILE_WORKSPACE_DELEGATION_ENFORCE_SANDBOX_GUARD/, "server should preserve the explicit hard-sandbox env as an override");
  assert.match(serverJs, /CODEX_MOBILE_WORKSPACE_DELEGATION_GUARD_EXEMPT_CWDS/, "server should expose explicit cwd allowlist env");
  assert.match(serverJs, /CODEX_MOBILE_WORKSPACE_DELEGATION_GUARD_DISABLE_SELF_EXEMPTION/, "self-maintenance exemption should be explicitly disableable");
  assert.match(serverJs, /CODEX_MOBILE_WORKSPACE_DELEGATION_GUARD_DISABLE_PLATFORM_EXEMPTION/, "platform-control exemption should be explicitly disableable");

  const guidanceBody = functionBody(taskCardRouteServiceJs, "attachWorkspaceDelegationRuntimeGuidance");
  assert.match(guidanceBody, /attachTaskCardRuntimeDynamicTools\(params, settings\)/, "runtime guidance should preserve dynamic tool injection");
  assert.match(guidanceBody, /appendDeveloperInstructions\(/, "runtime guidance should add model-visible fallback instructions");
  assert.match(guidanceBody, /taskCardReturnScriptFallbackInstruction\(params\)/, "runtime guidance should include the local return-card script fallback");
  assert.match(guidanceBody, /workspaceDelegationScriptFallbackInstruction\(params\)/, "runtime guidance should include the local task-card script fallback");

  const fallbackBody = functionBody(taskCardRouteServiceJs, "workspaceDelegationScriptFallbackInstruction");
  assert.match(fallbackBody, /create-thread-task-card\.js/, "fallback guidance should point to the local task-card script");
  assert.match(fallbackBody, /multi_agent_v1\.spawn_agent/, "fallback guidance should tell models not to substitute multi-agent tools for task cards");
  assert.match(fallbackBody, /--source-thread/, "fallback script command should include the source-thread argument");
  assert.match(fallbackBody, /--body-file/, "fallback script command should support long Markdown bodies");

  const exemptBody = functionBody(serverJs, "workspaceDelegationGuardExemptCwd");
  assert.match(exemptBody, /workspaceDelegationGuardExemptCwds\(\)/, "exemption should honor explicit cwd allowlist");
  assert.match(exemptBody, /isCodexMobileMaintenanceCwd\(cwd\)/, "exemption should preserve Codex Mobile self-maintenance permissions");
  assert.match(exemptBody, /isHomeAiControlPlaneCwd\(cwd\)/, "exemption should preserve Home AI central deploy/control-plane permissions");

  const selfBody = functionBody(serverJs, "isCodexMobileMaintenanceCwd");
  assert.match(selfBody, /workspaceDelegationGuardPackageName\(cwd\) === "codex-mobile-web"/, "self-maintenance should be limited to the Codex Mobile package");
  assert.match(selfBody, /workspaceDelegationGuardHasFile\(cwd, "server\.js"\)/, "self-maintenance should require the server entrypoint");

  const platformBody = functionBody(serverJs, "isHomeAiControlPlaneCwd");
  assert.match(platformBody, /scripts", "ai-ops-control-plane\.js"/, "platform exemption should require the central intake script");
  assert.match(platformBody, /scripts", "deploy-macos-production\.js"/, "platform exemption should require the central deploy script");
  assert.match(platformBody, /docs", "PLATFORM_CONTRACTS", "plugin-workspace-platform-contract\.md"/, "platform exemption should require central platform contracts");

  const cwdBody = functionBody(serverJs, "runtimeCwdForParams");
  assert.match(cwdBody, /params && params\.cwd/, "cwd resolver should prefer explicit cwd");
  assert.match(cwdBody, /readStateDbThread\(threadId\)[\s\S]*readStartedThread\(threadId\)[\s\S]*readRolloutSessionFallbackThread\(threadId\)/, "cwd resolver should fall back through thread summaries");
});

test("continuation paths apply inherited model and effort", () => {
  const sourceHandoffBody = functionBody(continuationThreadServiceJs, "createSourceContinuationHandoff");
  assert.match(sourceHandoffBody, /const params = applyTurnRuntimeSettings\(/, "source handoff generation should use inherited runtime settings");
  assert.match(sourceHandoffBody, /codex\.request\("turn\/start", params/, "source handoff turn should send inherited runtime settings");

  const startContinuationBody = functionBody(continuationThreadServiceJs, "startThreadFromRequestBody");
  assert.match(startContinuationBody, /const runtimeSettings = applyPermissionModeOverride\(sourceSnapshot\.runtimeSettings \|\| \{\}, body\.permissionMode, cwd\);/);
  assert.match(startContinuationBody, /const params = applyStartThreadRuntimeSettings\(/, "continuation thread/start should inherit model");
  assert.match(startContinuationBody, /const bootstrapParams = applyTurnRuntimeSettings\(/, "continuation bootstrap turn should inherit model and effort");
});

test("embedded plugin continuations carry plugin mode into the bootstrap", () => {
  const requestBody = functionBody(appJs, "startThreadRequestBody");
  assert.match(requestBody, /const pluginMode = isHermesEmbedMode\(\) \? "hermes" : ""/);
  assert.match(requestBody, /pluginMode,/);
  assert.match(requestBody, /hermesPluginMode: Boolean\(pluginMode\)/);
  assert.match(requestBody, /pluginId: pluginMode \? "codex-mobile" : ""/);

  const directStartBody = functionBody(appJs, "startNewThreadFromThread");
  assert.match(directStartBody, /pluginMode: isHermesEmbedMode\(\) \? "hermes" : ""/);
  assert.match(directStartBody, /hermesPluginMode: isHermesEmbedMode\(\)/);
  assert.match(directStartBody, /pluginId: isHermesEmbedMode\(\) \? "codex-mobile" : ""/);

  const pluginModeBody = functionBody(continuationThreadServiceJs, "continuationPluginMode");
  assert.match(pluginModeBody, /mode === "hermes" \|\| mode === "homeai" \|\| mode === "plugin"/);
  assert.match(pluginModeBody, /body\.hermesPluginMode === true/);
  assert.match(pluginModeBody, /pluginId \? "hermes" : ""/);

  const sourceKeyBody = functionBody(continuationThreadServiceJs, "continuationJobSourceKey");
  assert.match(sourceKeyBody, /continuationPluginMode\(body\)/);
  const startContinuationBody = functionBody(continuationThreadServiceJs, "startThreadFromRequestBody");
  assert.match(startContinuationBody, /const pluginMode = continuationPluginMode\(body\)/);
  assert.match(startContinuationBody, /newThreadBootstrapInput\(\{ cwd, sourceThreadId, sourceThreadTitle, desiredTitle, sourceSnapshot, runtimeSettings, sourceHandoff, pluginMode \}\)/);
  assert.match(functionBody(continuationThreadServiceJs, "createContinuationJob"), /pluginMode: continuationPluginMode\(body\)/);
  assert.match(functionBody(continuationThreadServiceJs, "publicContinuationJob"), /pluginMode: job\.pluginMode \|\| ""/);
});

test("continuation can fall back when source thread cannot write a handoff", () => {
  const sourceHandoffBody = functionBody(continuationThreadServiceJs, "createSourceContinuationHandoff");
  assert.match(sourceHandoffBody, /sourceSnapshot/, "source handoff generation should receive the source snapshot for fallback");
  assert.match(sourceHandoffBody, /writeFallbackSourceContinuationHandoff\(/, "source handoff generation should have a server fallback path");
  assert.match(sourceHandoffBody, /handoff-fallback/, "continuation progress should expose fallback handoff generation");
  assert.match(sourceHandoffBody, /readContinuationTurnStatus\(threadId, turnId\)/, "completed source turns without a file should not wait for the long timeout");

  const fallbackBody = functionBody(continuationThreadServiceJs, "writeFallbackSourceContinuationHandoff");
  assert.match(fallbackBody, /Fallback Continuation Handoff/, "fallback handoff should identify itself");
  assert.match(fallbackBody, /not a source-thread model summary/, "fallback handoff should not pretend the source thread summarized itself");
  assert.match(fallbackBody, /continuationSourceThreadSection\(snapshot\)/, "fallback handoff should include bounded source metadata");
  assert.match(fallbackBody, /continuationTurnSummaries\(snapshot\.turns \|\| \[\]\)/, "fallback handoff should include bounded recent visible turns");
  assert.match(fallbackBody, /workspaceContextReference\(cwd\)/, "fallback handoff should point the new thread to durable context files");
  assert.match(fallbackBody, /fallback:\s*true/, "fallback handoff result should be marked for bootstrap display");

  const startContinuationBody = functionBody(continuationThreadServiceJs, "startThreadFromRequestBody");
  assert.match(startContinuationBody, /sourceSnapshot,\s*\n\s*onProgress: progress/, "continuation start should pass the source snapshot into handoff generation");

  const handoffSectionBody = functionBody(continuationThreadServiceJs, "sourceHandoffSection");
  assert.match(handoffSectionBody, /sourceHandoff\.fallback/, "bootstrap should disclose fallback handoff mode");
  assert.match(handoffSectionBody, /fallbackReason/, "bootstrap should include a bounded fallback reason");
});

test("continuation titles survive app-server rename gaps", () => {
  const titleBody = functionBody(continuationThreadServiceJs, "sourceTitleForContinuation");
  assert.match(titleBody, /requestedTitle, summary\.name, summary\.title, summary\.preview/, "source title should prefer the current visible title before app-server fallbacks");

  const indexBody = functionBody(threadListFallbackSourceServiceJs, "persistThreadTitleToSessionIndex");
  assert.match(indexBody, /session_index\.jsonl/, "fallback title persistence should use Codex session index");
  assert.match(indexBody, /thread_name: name/, "session index entry should persist display title");
  assert.match(indexBody, /updated_at: timestamp/, "session index entry should include update timestamp");

  const startContinuationBody = functionBody(continuationThreadServiceJs, "startThreadFromRequestBody");
  assert.match(startContinuationBody, /sourceTitleForContinuation\(sourceSnapshot, requestedSourceThreadTitle, cwd\)/, "continuation should reselect source title after reading source snapshot");
  assert.match(startContinuationBody, /persistThreadTitleToSessionIndex\(threadId, desiredTitle\)/, "continuation should persist desired title before bootstrap can fail or restart");
  assert.match(startContinuationBody, /titleIndexed,/, "continuation response should expose title index persistence");
  assert.match(startContinuationBody, /sourceThreadTitle: sourceThreadTitle \|\| \(sourceSummary && \(sourceSummary\.name \|\| sourceSummary\.preview\)\) \|\| ""/, "lineage should keep the selected continuation source title");
});

test("manual rename falls back to Mobile title index when app-server metadata is unavailable", () => {
  const helperBody = functionBody(serverJs, "isRecoverableThreadTitleUpdateError");
  assert.match(helperBody, /thread metadata unavailable before name update/, "metadata-unavailable rename error should be recognized");
  assert.match(helperBody, /database disk image is malformed/, "malformed state db rename error should be recognized");

  const routeIndex = serverJs.indexOf('const threadRename = url.pathname.match');
  const routeEnd = serverJs.indexOf('const threadRead = url.pathname.match', routeIndex);
  assert.ok(routeIndex > 0 && routeEnd > routeIndex, "missing thread rename route");
  const routeBody = serverJs.slice(routeIndex, routeEnd);

  assert.match(routeBody, /persistThreadTitleToSessionIndex\(threadId, name\)/, "manual rename should persist fallback title");
  assert.match(routeBody, /titleUpdated: updated/, "manual rename response should expose app-server update status");
  assert.match(routeBody, /titleUpdated: false/, "metadata-unavailable fallback should report app-server update did not happen");
  assert.match(routeBody, /isRecoverableThreadTitleUpdateError\(err\)/, "manual rename should recover transient app-server title errors");
  assert.match(routeBody, /rememberStartedThread\(Object\.assign/, "manual rename should update the in-memory summary cache");
});

test("server does not broadcast source-less quota notifications to clients", () => {
  const start = serverJs.indexOf("function shouldSendEventToClient(");
  const end = serverJs.indexOf("function removeEventClient(", start);
  assert.ok(start > 0 && end > start, "missing event filtering function");
  const body = serverJs.slice(start, end);

  assert.match(body, /payload\.method === "account\/rateLimits\/updated"[\s\S]*return false;/);
});

test("existing-message route forwards runtime settings on next turn", () => {
  const routeIndex = threadMessageRouteServiceJs.indexOf('const messages = url.pathname.match(/^\\/api\\/threads\\/([^/]+)\\/messages$/);');
  const fallbackIndex = threadMessageRouteServiceJs.indexOf('const interrupt = url.pathname.match', routeIndex);
  assert.ok(routeIndex > 0, "missing existing message route");
  assert.ok(fallbackIndex > routeIndex, "missing message route end");
  const routeBody = threadMessageRouteServiceJs.slice(routeIndex, fallbackIndex);

  assert.match(routeBody, /const requestedModel\s*=/, "message route should read requested model");
  assert.match(routeBody, /const requestedEffort\s*=/, "message route should read requested reasoning effort");
  assert.match(routeBody, /const requestedFastMode = requestedCodexFastMode\(body\.fastMode\);/, "message route should read requested Fast service tier");
  assert.match(routeBody, /applyCodexFastServiceTier\(applyTurnRuntimeSettings\(/, "turn/start should apply requested Fast service tier");
  assert.match(routeBody, /if \(requestedModel\) params\.model = requestedModel;/, "turn/start should receive requested model");
  assert.match(routeBody, /if \(requestedEffort\) params\.effort = requestedEffort;/, "turn/start should receive requested reasoning effort");
  assert.ok(
    routeBody.indexOf("const params = applyCodexFastServiceTier(applyTurnRuntimeSettings(") < routeBody.indexOf("if (requestedModel) params.model = requestedModel;"),
    "explicit requested model should override inherited runtime model",
  );
  assert.ok(
    routeBody.indexOf("const params = applyCodexFastServiceTier(applyTurnRuntimeSettings(") < routeBody.indexOf("if (requestedEffort) params.effort = requestedEffort;"),
    "explicit requested effort should override inherited runtime effort",
  );
});

test("existing-thread message send refreshes the sidebar thread list", () => {
  const start = appJs.indexOf("async function sendMessage(");
  const end = appJs.indexOf("async function sendNewThreadMessage(", start);
  assert.ok(start > 0 && end > start, "missing sendMessage body");
  const body = appJs.slice(start, end);

  assert.match(body, /scheduleComposerTargetRefresh\(targetThreadId, 600, "message-submit"\);[\s\S]*scheduleLivePollIfNeeded\(1200\);[\s\S]*loadThreads\(\{ silent: true \}\)\.catch\(showError\);/);
});

test("send auth failures return stable codes and render message receipts", () => {
  assert.match(serverJs, /function isCodexAccountAuthError\(/);
  assert.match(serverJs, /code:\s*"codex_account_auth_invalid"/);
  assert.match(threadMessageRouteServiceJs, /sendJson\(409,\s*codexAccountAuthErrorPayload\(err\)\)/);

  const sendStart = appJs.indexOf("async function sendMessage(");
  const sendEnd = appJs.indexOf("async function sendNewThreadMessage(", sendStart);
  const sendBody = appJs.slice(sendStart, sendEnd);
  assert.match(sendBody, /markSubmittedUserMessageFailed\(targetThreadId,\s*outboundText,\s*submittedAttachments,\s*clientSubmissionId,\s*message\)/);
  assert.match(sendBody, /发送失败，详情见消息回执/);
  assert.match(appJs, /function renderUserMessageBody\(/);
  assert.match(appJs, /send-error-receipt/);
});

test("workspace creation route stores mobile-visible workspaces outside Codex global state", () => {
  const routeIndex = serverJs.indexOf('url.pathname === "/api/workspaces" && req.method === "POST"');
  const newMessageIndex = serverJs.indexOf("threadMessageRouteService.handleRoute");
  assert.ok(routeIndex > 0, "missing POST /api/workspaces route");
  assert.ok(routeIndex < newMessageIndex, "workspace creation should be available before new-thread submission");
  assert.match(serverJs, /createWorkspaceRegistryService/, "server should use the workspace registry service");
  assert.match(serverJs, /CODEX_MOBILE_WORKSPACE_REGISTRY_FILE/, "workspace registry storage should be configurable");
  assert.match(serverJs, /CODEX_MOBILE_WORKSPACE_CREATE_ROOTS/, "workspace creation roots should be configurable");
  assert.match(serverJs, /CODEX_MOBILE_WORKSPACE_DEFAULT_CREATE_ROOT/, "workspace default creation root should be configurable");
  assert.match(serverJs, /detectDevelopmentWorkspaceRoot\(APP_ROOT\)/, "workspace creation should default to the development root when available");
  assert.match(serverJs, /process\.env\.HERMES_MOBILE_DEV_ROOT/, "workspace default should allow a central Hermes dev root override");
  assert.match(serverJs, /"\/Users\/hermes-dev\/HermesMobileDev"/, "Mac production should fall back to the shared Hermes development root when it exists");
  assert.match(serverJs, /fs\.statSync\(resolved\)\.isDirectory\(\)/, "development root fallback should be existence-checked");
  assert.match(serverJs, /defaultCreateRoot:\s*WORKSPACE_DEFAULT_CREATE_ROOT/, "server should pass the default root to the registry service");
  assert.match(serverJs, /workspaceRegistryService\.create\(body\)/, "POST route should delegate creation to the registry service");
  assert.match(serverJs, /syncRegisteredWorkspaceTrust\(CODEX_HOME\)/, "workspace creation should trust the new workspace for the active Codex profile");
  assert.match(serverJs, /workspaceRegistryService\.list\(\)[\s\S]*roots\.add\(workspace\.cwd\)/, "registered workspaces should become visible to thread routes");
});

test("existing-message route falls back when active turn steering is stale", () => {
  const helperIndex = serverJs.indexOf("function isTurnSteerUnsupportedError(");
  const staleHelperIndex = serverJs.indexOf("function isStaleActiveTurnError(");
  const preflightIndex = serverJs.indexOf("async function staleActiveTurnPreflight(");
  assert.ok(helperIndex > 0, "missing turn/steer unsupported helper");
  assert.ok(staleHelperIndex > helperIndex, "missing stale active-turn helper");
  assert.ok(preflightIndex > staleHelperIndex, "missing stale active-turn preflight helper");

  const helperBody = serverJs.slice(helperIndex, serverJs.indexOf("function logClientEvent", helperIndex));
  assert.match(helperBody, /method not found\|unknown method/, "unsupported helper should only match method support errors");
  assert.doesNotMatch(helperBody, /method not found\|unknown method\|not found/, "generic not found must not be treated as unsupported turn/steer");
  assert.match(helperBody, /not found\|not active\|inactive\|completed\|interrupted\|expected turn\|expected active turn id\|no active turn/, "stale helper should catch stale active-turn errors");
  assert.match(helperBody, /detectStaleActiveTurnForSubmission/, "preflight should use service-owned stale-turn detection");
  assert.match(helperBody, /thread\/turns\/list/, "preflight should inspect latest durable turn state");
  assert.match(helperBody, /limit:\s*20/, "preflight should inspect enough recent turns to detect superseded active turns");

  const routeIndex = threadMessageRouteServiceJs.indexOf('const messages = url.pathname.match(/^\\/api\\/threads\\/([^/]+)\\/messages$/);');
  const fallbackIndex = threadMessageRouteServiceJs.indexOf('const interrupt = url.pathname.match', routeIndex);
  const routeBody = threadMessageRouteServiceJs.slice(routeIndex, fallbackIndex);
  const preflightCallIndex = routeBody.indexOf("staleActiveTurnPreflight(");
  const preflightLogIndex = routeBody.indexOf('logMessageSubmit("active-turn-stale-preflight"');
  const interruptIndex = routeBody.indexOf('codex.request("turn/interrupt"', preflightLogIndex);
  const steerIndex = routeBody.indexOf('codex.request("turn/steer"', interruptIndex);
  const pendingEchoIndex = routeBody.indexOf("pendingSteerEchoStore.remember", interruptIndex);
  const forgetEchoIndex = routeBody.indexOf("pendingSteerEchoStore.forget", pendingEchoIndex);
  const staleLogIndex = routeBody.indexOf('logMessageSubmit("active-turn-stale"');
  const resumeIndex = routeBody.indexOf('codex.request("thread/resume"', staleLogIndex);
  const turnStartIndex = routeBody.indexOf('codex.request("turn/start"', resumeIndex);
  assert.ok(preflightCallIndex > 0, "message route should preflight stale active turns before steering");
  assert.ok(preflightLogIndex > preflightCallIndex, "message route should log stale active-turn preflight");
  assert.ok(interruptIndex > preflightLogIndex, "stale active turn should be interrupted before starting a new turn");
  assert.ok(steerIndex > interruptIndex, "normal turn/steer path should remain after preflight");
  assert.ok(pendingEchoIndex > interruptIndex && pendingEchoIndex < steerIndex, "pending steer echo should be remembered before turn/steer can block");
  assert.ok(forgetEchoIndex > steerIndex, "pending steer echo should be forgotten when turn/steer falls through as stale");
  assert.match(routeBody, /if \(body\.activeTurnId && !skipTurnSteer\)/, "stale preflight should skip turn/steer");
  assert.ok(staleLogIndex > 0, "message route should log stale active turn steering");
  assert.ok(resumeIndex > staleLogIndex, "stale active turn should fall through to thread/resume");
  assert.ok(turnStartIndex > resumeIndex, "stale active turn should fall through to turn/start");
});

test("auto-recover route steers live turns before starting a replacement turn", () => {
  const helperIndex = serverJs.indexOf("async function autoRecoverThreadTurn(");
  assert.ok(helperIndex > 0, "missing automatic turn recovery helper");
  const helperEnd = serverJs.indexOf("let threadDetailProjectionService", helperIndex);
  const helperBody = serverJs.slice(helperIndex, helperEnd);
  assert.match(helperBody, /thread\/turns\/list/, "auto recovery should inspect latest turn state first");
  assert.match(helperBody, /turn\/steer/, "auto recovery should try to steer a still-live turn");
  assert.match(helperBody, /thread\/resume/, "auto recovery should resume the thread before fallback start");
  assert.match(helperBody, /turn\/start/, "auto recovery should start a replacement turn when steering is unavailable");
  assert.match(helperBody, /AUTO_TURN_RECOVERY_COOLDOWN_MS/, "auto recovery should be cooldown guarded");

  const routeIndex = threadMessageRouteServiceJs.indexOf('const autoRecover = url.pathname.match(/^\\/api\\/threads\\/([^/]+)\\/auto-recover$/);');
  const messagesIndex = threadMessageRouteServiceJs.indexOf('const messages = url.pathname.match(/^\\/api\\/threads\\/([^/]+)\\/messages$/);');
  assert.ok(routeIndex > 0, "missing /api/threads/:id/auto-recover route");
  assert.ok(routeIndex < messagesIndex, "auto-recover route should be registered before message submit route");
  const routeBody = threadMessageRouteServiceJs.slice(routeIndex, messagesIndex);
  assert.match(routeBody, /autoRecoverThreadTurn/, "route should delegate recovery policy to helper");
});
