"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const serverJs = fs.readFileSync(path.resolve(__dirname, "..", "server.js"), "utf8");
const appJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "app.js"), "utf8");

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

test("new-message route creates a thread before starting the first turn", () => {
  const routeIndex = serverJs.indexOf("/api/threads/new-message");
  const fallbackIndex = serverJs.indexOf('sendJson(res, 404, { error: "Not found" })');
  assert.ok(routeIndex > 0, "missing /api/threads/new-message route");
  assert.ok(routeIndex < fallbackIndex, "new-message route must run before 404 fallback");

  const routeBody = serverJs.slice(routeIndex, fallbackIndex);
  const threadStartIndex = routeBody.indexOf('codex.request("thread/start"');
  const turnStartIndex = routeBody.indexOf('codex.request("turn/start"');
  assert.ok(threadStartIndex > 0, "new-message route must call thread/start");
  assert.ok(turnStartIndex > threadStartIndex, "new-message route must start the first turn after thread/start");
});

test("new-message route allows Codex App style projectless threads", () => {
  const routeIndex = serverJs.indexOf("/api/threads/new-message");
  const fallbackIndex = serverJs.indexOf('sendJson(res, 404, { error: "Not found" })');
  const routeBody = serverJs.slice(routeIndex, fallbackIndex);

  assert.doesNotMatch(routeBody, /Workspace is required to start a new thread/);
  assert.match(routeBody, /if \(cwd\) startParamsBase\.cwd = cwd;/);
  assert.match(routeBody, /\.\.\.\(cwd \? \{ cwd \} : \{\}\)/);
  assert.match(routeBody, /const projectlessThreadRegistered = cwd \? false : rememberProjectlessThreadId\(threadId\);/);
  assert.match(routeBody, /projectlessThreadRegistered,/);
  assert.match(serverJs, /function rememberProjectlessThreadId\(threadId\)/);
  assert.match(serverJs, /state\["projectless-thread-ids"\] = existing\.concat\(\[id\]\);/);
});

test("new-message route forwards new-thread runtime settings", () => {
  const routeIndex = serverJs.indexOf("/api/threads/new-message");
  const fallbackIndex = serverJs.indexOf('sendJson(res, 404, { error: "Not found" })');
  const routeBody = serverJs.slice(routeIndex, fallbackIndex);

  assert.match(routeBody, /const requestedModel\s*=/, "new-thread route should read requested model");
  assert.match(routeBody, /const requestedEffort\s*=/, "new-thread route should read requested reasoning effort");
  assert.match(routeBody, /const requestedFastMode = requestedCodexFastMode\(body\.fastMode\);/, "new-thread route should read requested Fast service tier");
  assert.match(routeBody, /if \(requestedModel\) startParams\.model = requestedModel;/, "thread/start should receive requested model");
  assert.match(routeBody, /applyCodexFastServiceTier\(applyTurnRuntimeSettings\(/, "turn/start should apply requested Fast service tier");
  assert.match(routeBody, /if \(requestedModel\) turnParams\.model = requestedModel;/, "turn/start should receive requested model");
  assert.match(routeBody, /if \(requestedEffort\) turnParams\.effort = requestedEffort;/, "turn/start should receive requested reasoning effort");
});

test("new-message route can persist an explicit initial thread title", () => {
  const routeIndex = serverJs.indexOf("/api/threads/new-message");
  const fallbackIndex = serverJs.indexOf('sendJson(res, 404, { error: "Not found" })');
  const routeBody = serverJs.slice(routeIndex, fallbackIndex);

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
  assert.match(serverJs, /defaultModel: CODEX_CONFIG_DEFAULTS\.model \|\| DEFAULT_MODEL/);
  assert.match(serverJs, /defaultPermissionMode: defaultPermissionModeFromConfigDefaults\(\)/);
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
  assert.match(serverJs, /await this\.refreshRateLimits\(\);[\s\S]*this\.ready = true/, "initialize should refresh quota before broadcasting ready status");
  assert.match(serverJs, /async refreshRateLimitsIfMissing\(\)[\s\S]*LIVE_RATE_LIMIT_REFRESH_MIN_INTERVAL_MS/, "server should rehydrate missing live quota after app-server startup");
  assert.match(serverJs, /this\.sendRpc\("account\/rateLimits\/read"[\s\S]*resetOnTimeout:\s*false/, "quota refresh should call the official app-server read RPC without resetting the transport on timeout");
  assert.match(serverJs, /rateLimitSource\(\)[\s\S]*this\.isMuxEndpoint\(\)[\s\S]*"profile-mux-live"/, "profile mux quota should be marked as owned by the active profile endpoint");
  assert.match(serverJs, /recordRateLimits\(msg\.params\.rateLimits,\s*\{[\s\S]*source:\s*this\.rateLimitSource\(\)/, "quota notifications should use the same trusted source classifier as quota reads");
  assert.match(serverJs, /function codexAppServerChildEnv\([\s\S]*CODEX_CLI_PATH[\s\S]*CODEX_MUX_/, "managed child app-server env should drop desktop bridge variables");
  assert.match(serverJs, /if \(CODEX_HOME\) env\.CODEX_HOME = CODEX_HOME;[\s\S]*Object\.assign\(env, extra\);/, "explicit child env should be able to override the active CODEX_HOME for profile preflight");
  assert.match(serverJs, /spawn\(CODEX_EXE,[\s\S]*\{\s*cwd: APP_ROOT,[\s\S]*env: codexAppServerChildEnv\(\{ CODEX_HOME \}\)/, "managed child app-server should inherit the resolved active CODEX_HOME without desktop bridge env");
  assert.match(serverJs, /async startOwnedMuxAndConnect\(\)/, "Mobile Web should be able to own a shared mux instead of depending on Desktop");
  assert.match(serverJs, /CODEX_MUX_STANDALONE:\s*"1"[\s\S]*CODEX_MUX_KEEP_ALIVE:\s*"1"[\s\S]*CODEX_MUX_PUBLISH_ENDPOINT:\s*"1"/, "Mobile-owned mux should stay alive after Desktop exits and publish the active profile endpoint");
  assert.match(serverJs, /shared endpoint missing; starting Mobile-owned mux/, "required shared mode should start a Mobile-owned mux when the profile endpoint is absent");
  assert.match(serverJs, /profile mux endpoint unavailable; starting Mobile-owned mux/, "stale profile endpoints should be replaced by a Mobile-owned mux");
  assert.match(serverJs, /mobileOwnedMux:\s*this\.muxChild \? \{[\s\S]*pid:[\s\S]*running:/, "status should expose bounded Mobile-owned mux runtime evidence");
  assert.match(serverJs, /if \(codex\.muxChild && codex\.muxChild\.exitCode === null\) codex\.muxChild\.kill\(\)/, "server shutdown should stop the Mobile-owned mux child");
  assert.match(serverJs, /function activeRateLimits\(\)[\s\S]*latestLiveRateLimits \|\| latestSnapshotRateLimits/, "live quota should win over rollout snapshots");
  assert.match(serverJs, /\/api\/public-config"[\s\S]*await codex\.refreshRateLimitsIfMissing\(\);[\s\S]*rateLimits: activeRateLimits\(\)/, "public config should refresh and include active quota");
  assert.match(serverJs, /\/api\/status"[\s\S]*await codex\.refreshRateLimitsIfMissing\(\);[\s\S]*sendJson\(res, 200, codex\.status\(\)\)/, "status should refresh and include hydrated quota snapshots");
});

test("server runtime inheritance includes model and reasoning effort", () => {
  const settingsBody = functionBody(serverJs, "threadRuntimeSettings");
  assert.match(settingsBody, /lastString\(context\.model, thread && thread\.model, CODEX_CONFIG_DEFAULTS\.model\)/, "runtime settings should inherit model from rollout, state DB, or config");
  assert.match(settingsBody, /lastString\(context\.effort, context\.reasoning_effort, context\.model_reasoning_effort, thread && thread\.effort, CODEX_CONFIG_DEFAULTS\.reasoningEffort\)/, "runtime settings should inherit reasoning effort from rollout, state DB, or config");
  assert.match(settingsBody, /model,\s*reasoningEffort,/, "runtime settings response should expose inherited model and effort");

  const startBody = functionBody(serverJs, "applyStartThreadRuntimeSettings");
  assert.match(startBody, /attachWorkspaceDelegationDynamicTools\(params\)/, "thread/start should receive workspace delegation dynamic tools when enabled");
  assert.match(startBody, /if \(settings\.model\) params\.model = settings\.model;/, "thread/start should inherit model");
  assert.match(startBody, /applyWorkspaceDelegationRuntimeGuard\(params, settings, \{ useSandboxPolicy: false \}\)/, "thread/start should enforce workspace delegation write guard");

  const turnBody = functionBody(serverJs, "applyTurnRuntimeSettings");
  assert.match(turnBody, /attachWorkspaceDelegationDynamicTools\(params\)/, "turn/start should receive workspace delegation dynamic tools when enabled");
  assert.match(turnBody, /if \(settings\.model\) params\.model = settings\.model;/, "turn/start should inherit model");
  assert.match(turnBody, /if \(settings\.reasoningEffort\) params\.effort = settings\.reasoningEffort;/, "turn/start should inherit reasoning effort");
  assert.match(turnBody, /applyWorkspaceDelegationRuntimeGuard\(params, settings, \{ useSandboxPolicy: true \}\)/, "turn/start should enforce workspace delegation write guard");

  const resumeBody = functionBody(serverJs, "applyResumeRuntimeSettings");
  assert.match(resumeBody, /applyWorkspaceDelegationRuntimeGuard\(params, settings, \{ useSandboxPolicy: false \}\)/, "thread/resume should enforce workspace delegation write guard");

  const guardBody = functionBody(serverJs, "applyWorkspaceDelegationRuntimeGuard");
  assert.match(guardBody, /workspaceDelegationPublicSettings\(\)\.enabled/, "write guard should only run when workspace delegation is enabled");
  assert.match(guardBody, /runtimeCwdForParams\(params\)/, "write guard should resolve cwd from params or thread id");
  assert.match(guardBody, /params\.approvalPolicy = "never"/, "write guard should prevent approval bypass for cross-workspace writes");
  assert.match(guardBody, /delete params\.permissionProfile/, "write guard should remove full-access permission profiles");
  assert.match(guardBody, /params\.sandboxPolicy = policy/, "turn/start should receive structured workspace-write sandbox policy");
  assert.match(guardBody, /params\.sandbox = "workspace-write"/, "thread/start and thread/resume should receive workspace-write sandbox mode");

  const cwdBody = functionBody(serverJs, "runtimeCwdForParams");
  assert.match(cwdBody, /params && params\.cwd/, "cwd resolver should prefer explicit cwd");
  assert.match(cwdBody, /readStateDbThread\(threadId\)[\s\S]*readStartedThread\(threadId\)[\s\S]*readRolloutSessionFallbackThread\(threadId\)/, "cwd resolver should fall back through thread summaries");
});

test("continuation paths apply inherited model and effort", () => {
  const sourceHandoffBody = functionBody(serverJs, "createSourceContinuationHandoff");
  assert.match(sourceHandoffBody, /const params = applyTurnRuntimeSettings\(/, "source handoff generation should use inherited runtime settings");
  assert.match(sourceHandoffBody, /codex\.request\("turn\/start", params/, "source handoff turn should send inherited runtime settings");

  const startContinuationBody = functionBody(serverJs, "startThreadFromRequestBody");
  assert.match(startContinuationBody, /const runtimeSettings = applyPermissionModeOverride\(sourceSnapshot\.runtimeSettings \|\| \{\}, body\.permissionMode, cwd\);/);
  assert.match(startContinuationBody, /const params = applyStartThreadRuntimeSettings\(/, "continuation thread/start should inherit model");
  assert.match(startContinuationBody, /const bootstrapParams = applyTurnRuntimeSettings\(/, "continuation bootstrap turn should inherit model and effort");
});

test("continuation titles survive app-server rename gaps", () => {
  const titleBody = functionBody(serverJs, "sourceTitleForContinuation");
  assert.match(titleBody, /requestedTitle, summary\.name, summary\.title, summary\.preview/, "source title should prefer the current visible title before app-server fallbacks");

  const indexBody = functionBody(serverJs, "persistThreadTitleToSessionIndex");
  assert.match(indexBody, /session_index\.jsonl/, "fallback title persistence should use Codex session index");
  assert.match(indexBody, /thread_name: name/, "session index entry should persist display title");
  assert.match(indexBody, /updated_at: timestamp/, "session index entry should include update timestamp");

  const startContinuationBody = functionBody(serverJs, "startThreadFromRequestBody");
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
  const routeIndex = serverJs.indexOf('const messages = url.pathname.match(/^\\/api\\/threads\\/([^/]+)\\/messages$/);');
  const fallbackIndex = serverJs.indexOf('const interrupt = url.pathname.match', routeIndex);
  assert.ok(routeIndex > 0, "missing existing message route");
  assert.ok(fallbackIndex > routeIndex, "missing message route end");
  const routeBody = serverJs.slice(routeIndex, fallbackIndex);

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

  assert.match(body, /scheduleCurrentThreadRefresh\(600\);[\s\S]*scheduleLivePollIfNeeded\(1200\);[\s\S]*loadThreads\(\{ silent: true \}\)\.catch\(showError\);/);
});

test("send auth failures return stable codes and render message receipts", () => {
  assert.match(serverJs, /function isCodexAccountAuthError\(/);
  assert.match(serverJs, /code:\s*"codex_account_auth_invalid"/);
  assert.match(serverJs, /sendJson\(res,\s*409,\s*codexAccountAuthErrorPayload\(err\)\)/);

  const sendStart = appJs.indexOf("async function sendMessage(");
  const sendEnd = appJs.indexOf("async function sendNewThreadMessage(", sendStart);
  const sendBody = appJs.slice(sendStart, sendEnd);
  assert.match(sendBody, /markSubmittedUserMessageFailed\(state\.currentThreadId,\s*outboundText,\s*submittedAttachments,\s*clientSubmissionId,\s*message\)/);
  assert.match(sendBody, /发送失败，详情见消息回执/);
  assert.match(appJs, /function renderUserMessageBody\(/);
  assert.match(appJs, /send-error-receipt/);
});

test("workspace creation route stores mobile-visible workspaces outside Codex global state", () => {
  const routeIndex = serverJs.indexOf('url.pathname === "/api/workspaces" && req.method === "POST"');
  const newMessageIndex = serverJs.indexOf("/api/threads/new-message");
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

  const routeIndex = serverJs.indexOf('const messages = url.pathname.match(/^\\/api\\/threads\\/([^/]+)\\/messages$/);');
  const fallbackIndex = serverJs.indexOf('const interrupt = url.pathname.match', routeIndex);
  const routeBody = serverJs.slice(routeIndex, fallbackIndex);
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

  const routeIndex = serverJs.indexOf('const autoRecover = url.pathname.match(/^\\/api\\/threads\\/([^/]+)\\/auto-recover$/);');
  const messagesIndex = serverJs.indexOf('const messages = url.pathname.match(/^\\/api\\/threads\\/([^/]+)\\/messages$/);');
  assert.ok(routeIndex > 0, "missing /api/threads/:id/auto-recover route");
  assert.ok(routeIndex < messagesIndex, "auto-recover route should be registered before message submit route");
  const routeBody = serverJs.slice(routeIndex, messagesIndex);
  assert.match(routeBody, /autoRecoverThreadTurn/, "route should delegate recovery policy to helper");
});
