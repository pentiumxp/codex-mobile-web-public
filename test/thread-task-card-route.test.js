"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const serverJs = fs.readFileSync(path.resolve(__dirname, "..", "server.js"), "utf8");
const apiDispatchRouteServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "server-routes", "api-dispatch-route-service.js"), "utf8");
const apiDispatchRouteAdapterJs = fs.readFileSync(path.resolve(__dirname, "..", "adapters", "api-dispatch-route-service.js"), "utf8");
const autoTurnRecoveryServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "adapters", "auto-turn-recovery-service.js"), "utf8");
const coreApiRouteServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "server-routes", "core-api-route-service.js"), "utf8");
const continuationThreadServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "adapters", "continuation-thread-service.js"), "utf8");
const codexAppServerClientServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "adapters", "codex-app-server-client-service.js"), "utf8");
const appServerRequestPolicyServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "adapters", "app-server-request-policy-service.js"), "utf8");
const taskCardRouteServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "server-routes", "thread-task-card-route-service.js"), "utf8");
const taskCardRouteAdapterJs = fs.readFileSync(path.resolve(__dirname, "..", "adapters", "thread-task-card-route-service.js"), "utf8");
const threadMessageRouteServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "server-routes", "thread-message-route-service.js"), "utf8");
const threadSummaryStateServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "adapters", "thread-summary-state-service.js"), "utf8");
const threadEventNotificationServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "adapters", "thread-event-notification-service.js"), "utf8");
const routingServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "adapters", "thread-task-card-routing-service.js"), "utf8");
const threadDetailRouteServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "server-routes", "thread-detail-route-service.js"), "utf8");
const threadDetailRouteAdapterJs = fs.readFileSync(path.resolve(__dirname, "..", "adapters", "thread-detail-route-service.js"), "utf8");
const threadDetailResponsePreparationServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "services", "thread-detail", "thread-detail-response-preparation-service.js"), "utf8");
const webPushRuntimeServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "adapters", "web-push-runtime-service.js"), "utf8");
const runtimeSettingsServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "adapters", "runtime-settings-service.js"), "utf8");
const taskCardIdempotencyServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "services", "task-cards", "task-card-idempotency-service.js"), "utf8");
const taskCardRuntimePolicyServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "services", "task-cards", "task-card-runtime-policy-service.js"), "utf8");
const appJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "app.js"), "utf8");
const indexHtml = fs.readFileSync(path.resolve(__dirname, "..", "public", "index.html"), "utf8");
const stylesCss = fs.readFileSync(path.resolve(__dirname, "..", "public", "styles.css"), "utf8");
const createThreadTaskCardScript = fs.readFileSync(path.resolve(__dirname, "..", "scripts", "create-thread-task-card.js"), "utf8");
const returnThreadTaskCardScript = fs.readFileSync(path.resolve(__dirname, "..", "scripts", "return-thread-task-card.js"), "utf8");
const { createThreadTaskCardRouteService } = require("../server-routes/thread-task-card-route-service");
const threadTaskCardRouteAdapter = require("../adapters/thread-task-card-route-service");

function stableTextHash(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, 16);
}

function functionBody(source, name) {
  let start = source.indexOf(`function ${name}(`);
  if (start < 0) start = source.indexOf(`async function ${name}(`);
  if (start < 0) start = source.indexOf(`\n  ${name}(`);
  if (start < 0) start = source.indexOf(`\n  async ${name}(`);
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
  let start = source.indexOf(`async function ${name}(`);
  if (start < 0) start = source.indexOf(`function ${name}(`);
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

test("server exposes thread task card routes and enriches thread detail responses", () => {
  assert.match(serverJs, /createThreadTaskCardService/);
  assert.match(serverJs, /createHomeAiAutonomousDeliveryReturnService/);
  assert.match(serverJs, /const homeAiAutonomousDeliveryReturnService = createHomeAiAutonomousDeliveryReturnService/);
  assert.match(serverJs, /onTerminalReturnCard: async \(event\) => homeAiAutonomousDeliveryReturnService\.send\(event, \{ workspaceId: "owner" \}\)/);
  assert.doesNotMatch(serverJs, /createThreadTaskCardIntentService/);
  assert.match(serverJs, /CODEX_MOBILE_THREAD_TASK_CARD_FILE/);
  assert.match(serverJs, /createThreadTaskCardRouteService/);
  assert.match(apiDispatchRouteServiceJs, /threadTaskCardRouteService\.handleRoute/);
  assert.match(taskCardRouteServiceJs, /"\/api\/thread-task-cards"/);
  assert.doesNotMatch(taskCardRouteServiceJs, /"\/api\/thread-task-cards\/parse"/);
  assert.match(taskCardRouteServiceJs, /const threadTaskCardApprove = url\.pathname\.match\(/);
  assert.match(taskCardRouteServiceJs, /const threadTaskCardDelete = url\.pathname\.match\(/);
  assert.match(taskCardRouteServiceJs, /const threadTaskCardRevoke = url\.pathname\.match\(/);
  assert.match(taskCardRouteServiceJs, /const threadTaskCardReply = url\.pathname\.match\(/);
  assert.match(taskCardRouteServiceJs, /const threadTaskCardExecutionPause = url\.pathname\.match\(/);
  assert.match(taskCardRouteServiceJs, /const threadTaskCardExecutionCancel = url\.pathname\.match\(/);
  assert.match(serverJs, /function attachThreadTaskCardsToThread\(/);
  assert.match(serverJs, /thread\.threadTaskCards = threadTaskCardService\.listForThread\(thread\.id\)/);
  assert.match(serverJs, /thread\.pendingIncomingTaskCardCount = taskCardCounts\.pendingIncoming/);
  assert.match(serverJs, /function attachThreadTaskCardCountsToThreadListResult\(/);
  assert.match(serverJs, /attachThreadTaskCardsToResult\(result\)/);
  assert.match(taskCardRouteServiceJs, /await threadTaskCardService\.approve/);
  assert.match(taskCardRouteServiceJs, /await threadTaskCardService\.reply/);
});

test("thread task card route adapter re-exports the canonical server route", () => {
  assert.match(taskCardRouteAdapterJs, /require\("\.\.\/server-routes\/thread-task-card-route-service"\)/);
  assert.equal(threadTaskCardRouteAdapter.createThreadTaskCardRouteService, createThreadTaskCardRouteService);
  assert.doesNotMatch(taskCardRouteAdapterJs, /threadTaskCardService\.createMany/);
});

test("server exposes a thread-callable direct task-card interface", () => {
  assert.ok(taskCardRouteServiceJs.includes('const sourceThreadTaskCardCreate = url.pathname.match(/^\\/api\\/threads\\/([^/]+)\\/task-cards$/);'));
  assert.ok(taskCardRouteServiceJs.includes('const sourceThreadWorkspaceDelegation = url.pathname.match(/^\\/api\\/threads\\/([^/]+)\\/workspace-delegation$/);'));
  const workspaceDelegationRoute = taskCardRouteServiceJs.slice(
    taskCardRouteServiceJs.indexOf('const sourceThreadWorkspaceDelegation = url.pathname.match(/^\\/api\\/threads\\/([^/]+)\\/workspace-delegation$/);'),
    taskCardRouteServiceJs.indexOf('const sourceThreadTaskCardCreate = url.pathname.match(/^\\/api\\/threads\\/([^/]+)\\/task-cards$/);'),
  );
  assert.match(workspaceDelegationRoute, /disabled: true/);
  assert.match(workspaceDelegationRoute, /delegated: false/);
  assert.match(workspaceDelegationRoute, /const workspaceDelegation = workspaceDelegationSettings\(\)/);
  assert.match(workspaceDelegationRoute, /enabled: workspaceDelegation\.enabled/);
  assert.match(workspaceDelegationRoute, /reason: workspaceDelegation\.enabled/);
  assert.match(workspaceDelegationRoute, /workspace_delegation_disabled/);
  assert.match(workspaceDelegationRoute, /model_driven_delegation_requires_explicit_task_card/);
  assert.doesNotMatch(serverJs, /function runWorkspaceDelegationFromSourceThread\(/);
  assert.doesNotMatch(serverJs, /analyzeWorkspaceDelegation\(/);
  assert.doesNotMatch(serverJs, /buildWorkspaceDelegationTaskCardPayload\(/);
  assert.match(serverJs, /const RUNTIME_SETTINGS_FILE =/);
  assert.match(serverJs, /const WORKSPACE_DELEGATION_ENV_DEFAULT =/);
  assert.match(serverJs, /const WORKSPACE_DELEGATION_TOOL_NAMESPACE = "codex_mobile"/);
  assert.match(serverJs, /const WORKSPACE_DELEGATION_TOOL_NAME = "delegate_to_thread"/);
  assert.match(serverJs, /const TASK_CARD_RETURN_TOOL_NAME = "return_to_source"/);
  assert.match(serverJs, /CODEX_MOBILE_ALLOW_WORKSPACE_DELEGATION/);
  assert.match(serverJs, /CODEX_MOBILE_WORKSPACE_DELEGATION_ENABLED/);
  assert.match(runtimeSettingsServiceJs, /function workspaceDelegationPublicSettings\(/);
  assert.match(taskCardRouteServiceJs, /function workspaceDelegationDynamicToolSpec\(/);
  assert.match(taskCardRouteServiceJs, /function taskCardReturnDynamicToolSpec\(/);
  assert.match(taskCardRouteServiceJs, /function attachTaskCardRuntimeDynamicTools\(/);
  assert.match(taskCardRouteServiceJs, /function attachWorkspaceDelegationRuntimeGuidance\(/);
  assert.match(taskCardRouteServiceJs, /function taskCardReturnScriptFallbackInstruction\(/);
  assert.match(taskCardRouteServiceJs, /function workspaceDelegationScriptFallbackInstruction\(/);
  assert.doesNotMatch(functionBody(taskCardRouteServiceJs, "workspaceDelegationTargetHints"), /threadTaskCardCanonicalVisibleTargets/);
  assert.match(functionBody(taskCardRouteServiceJs, "workspaceDelegationTargetHints"), /threadTaskCardVisibleTargetThreads\(\)/);
  assert.match(serverJs, /function workspaceDelegationRpcDiagnostics\(/);
  assert.match(serverJs, /function logWorkspaceDelegationRpc\(/);
  assert.match(taskCardRouteServiceJs, /function workspaceDelegationDynamicToolCallDiagnostics\(/);
  assert.match(taskCardRouteServiceJs, /function logWorkspaceDelegationDynamicToolCall\(/);
  assert.match(taskCardRouteServiceJs, /function dynamicToolServerRequestResponsePayload\(/);
  assert.match(runtimeSettingsServiceJs, /function setWorkspaceDelegationEnabled\(/);
  assert.match(coreApiRouteServiceJs, /url\.pathname === "\/api\/settings\/workspace-delegation"/);
  assert.match(functionBody(runtimeSettingsServiceJs, "workspaceDelegationPublicSettings"), /failureRecovery:\s*enabled \? "source_model_tool_call_with_dynamic_source_write_guard" : "off"/);
  assert.match(functionBody(runtimeSettingsServiceJs, "workspaceDelegationPublicSettings"), /serverAutoTaskCardFromFailures:\s*false/);
  assert.match(taskCardRouteServiceJs, /function buildThreadTaskCardCreatePayload\(/);
  assert.match(taskCardRouteServiceJs, /function threadTaskCardThreadCallIdempotencyKey\(/);
  assert.match(taskCardRouteServiceJs, /function normalizeThreadTaskCardReasoningEffort\(/);
  assert.match(taskCardRouteServiceJs, /function resolvedThreadTaskCardTargetIds\(/);
  assert.match(taskCardRouteServiceJs, /function threadTaskCardVisibleTargetThreads\(/);
  assert.match(taskCardRouteServiceJs, /function threadTaskCardCanonicalVisibleTargets\(/);
  assert.match(taskCardRouteServiceJs, /function threadTaskCardCanonicalTargetForCwd\(/);
  assert.match(taskCardRouteServiceJs, /createThreadTaskCardRoutingService/);
  assert.match(taskCardRouteServiceJs, /const threadTaskCardRoutingService = createThreadTaskCardRoutingService\(\{/);
  assert.match(functionBody(taskCardRouteServiceJs, "resolveThreadTaskCardTargetReference"), /threadTaskCardRoutingService\.resolveTargetReference\(value, sourceThreadId, options\)/);
  assert.match(routingServiceJs, /function createThreadTaskCardRoutingService\(/);
  assert.match(routingServiceJs, /function resolveTargetReference\(/);
  assert.match(routingServiceJs, /const visibleThreads = visibleTargetThreads\(options\)/);
  assert.match(taskCardRouteServiceJs, /function assertThreadTaskCardTargetDeliverable\(/);
  assert.match(routingServiceJs, /target_thread_self/);
  assert.match(routingServiceJs, /target_thread_archived/);
  assert.match(routingServiceJs, /target_thread_not_visible/);
  assert.doesNotMatch(routingServiceJs, /return raw;/);
  assert.match(functionBody(taskCardRouteServiceJs, "buildThreadTaskCardCreatePayload"), /if \(!targetThreadIds\.length\)/);
  assert.match(functionBody(taskCardRouteServiceJs, "buildThreadTaskCardCreatePayload"), /target_thread_required/);
  assert.match(serverJs, /thread-task-card-deploy-lane-policy-service/);
  assert.match(functionBody(taskCardRouteServiceJs, "workspaceDelegationTargetHints"), /prioritizeDelegationTargetHints/);
  assert.match(functionBody(serverJs, "normalizeThreadSummaryLiveStatus"), /threadSummaryStateService\.normalizeThreadSummaryLiveStatus/);
  assert.match(functionBody(threadSummaryStateServiceJs, "normalizeThreadSummaryLiveStatus"), /normalizeHomeAiDeployLaneSummary/);
  assert.match(functionBody(taskCardRouteServiceJs, "buildThreadTaskCardCreatePayload"), /applyHomeAiDeployLaneRoutingPolicy/);
  assert.match(functionBody(taskCardRouteServiceJs, "applyHomeAiDeployLaneRoutingPolicy"), /planHomeAiDeployLaneRouting/);
  assert.match(functionBody(taskCardRouteServiceJs, "applyHomeAiDeployLaneRoutingPolicy"), /deploy_lane_required/);
  assert.match(functionBody(taskCardRouteServiceJs, "createThreadTaskCardsFromSourceThread"), /workspaceDelegationSettings\(\)/);
  assert.match(functionBody(taskCardRouteServiceJs, "createThreadTaskCardsFromSourceThread"), /workspaceDelegation\.enabled[\s\S]*body\.autoApprove !== false[\s\S]*body\.direct !== false[\s\S]*body\.pending !== true/);
  assert.match(taskCardRouteServiceJs, /task-card-idempotency-service/);
  assert.match(taskCardIdempotencyServiceJs, /function threadTaskCardThreadCallIdempotencyKey/);
  assert.match(functionBody(taskCardRouteServiceJs, "threadTaskCardThreadCallIdempotencyKey"), /canonicalThreadTaskCardThreadCallIdempotencyKey/);
  assert.match(functionBody(taskCardRouteServiceJs, "threadTaskCardThreadCallIdempotencyKey"), /normalizeReasoningEffort: normalizeThreadTaskCardReasoningEffort/);
  assert.match(taskCardIdempotencyServiceJs, /isSemanticPluginDeployment/);
  assert.match(taskCardIdempotencyServiceJs, /!semanticPluginDeployment && requestId/);
  assert.doesNotMatch(functionBody(taskCardRouteServiceJs, "threadTaskCardThreadCallIdempotencyKey"), /body\.sourceTurnId \|\| body\.turnId/);
  assert.match(functionBody(taskCardRouteServiceJs, "dynamicToolTextResponse"), /success/);
  assert.match(functionBody(taskCardRouteServiceJs, "dynamicToolTextResponse"), /contentItems:\s*\[/);
  assert.match(functionBody(taskCardRouteServiceJs, "dynamicToolTextResponse"), /type: "inputText"/);
  assert.doesNotMatch(functionBody(taskCardRouteServiceJs, "dynamicToolTextResponse"), /content_items|input_text|\bcontent:\s*\[|type: "text"/);
  assert.match(functionBody(taskCardRouteServiceJs, "workspaceDelegationDynamicToolSpec"), /Mandatory boundary when this tool is available/);
  assert.match(functionBody(taskCardRouteServiceJs, "workspaceDelegationDynamicToolSpec"), /call this tool before doing that work/);
  assert.match(functionBody(taskCardRouteServiceJs, "workspaceDelegationDynamicToolSpec"), /Do not inspect, cd into, edit, patch, run commands in, test, deploy/);
  assert.match(functionBody(taskCardRouteServiceJs, "workspaceDelegationDynamicToolSpec"), /failed with sandbox, filesystem, permission denied, operation not permitted, cwd, or approval-policy errors/);
  assert.match(functionBody(taskCardRouteServiceJs, "workspaceDelegationDynamicToolSpec"), /do not retry locally or merely report blocked/);
  assert.match(functionBody(taskCardRouteServiceJs, "workspaceDelegationDynamicToolSpec"), /source model must call this tool/);
  assert.match(functionBody(taskCardRouteServiceJs, "workspaceDelegationDynamicToolSpec"), /The model must decide from the user's request whether delegation is required/);
  assert.match(functionBody(taskCardRouteServiceJs, "workspaceDelegationDynamicToolSpec"), /always creates source-direct cards/);
  assert.match(functionBody(taskCardRouteServiceJs, "workspaceDelegationDynamicToolSpec"), /Archived, deleted, hidden, subagent, or non-detail-readable targetThreadId values are rejected/);
  assert.match(functionBody(taskCardRouteServiceJs, "workspaceDelegationDynamicToolSpec"), /Several normal threads may share the same cwd\/workspace/);
  assert.match(functionBody(taskCardRouteServiceJs, "workspaceDelegationDynamicToolSpec"), /reasoningEffort/);
  assert.match(functionBody(taskCardRouteServiceJs, "workspaceDelegationDynamicToolSpec"), /effortOptions/);
  assert.match(functionBody(taskCardRouteServiceJs, "workspaceDelegationDynamicToolSpec"), /pluginId/);
  assert.match(functionBody(taskCardRouteServiceJs, "workspaceDelegationDynamicToolSpec"), /replyToThreadId/);
  assert.match(functionBody(taskCardRouteServiceJs, "workspaceDelegationDynamicToolSpec"), /multi-hop supplement/);
  assert.match(functionBody(taskCardRouteServiceJs, "applyHomeAiDeployLaneRoutingPolicy"), /expectedDeployLaneTitle/);
  assert.doesNotMatch(functionBody(taskCardRouteServiceJs, "workspaceDelegationDynamicToolSpec"), /latest visible canonical thread/);
  assert.doesNotMatch(functionBody(taskCardRouteServiceJs, "workspaceDelegationDynamicToolSpec"), /pending:\s*\{/);
  assert.match(functionBody(taskCardRouteServiceJs, "taskCardReturnDynamicToolSpec"), /A plain final answer in the target thread is not a source-thread return card/);
  assert.match(functionBody(taskCardRouteServiceJs, "taskCardReturnDynamicToolSpec"), /Task card id/);
  assert.match(functionBody(taskCardRouteServiceJs, "taskCardRuntimeDynamicTools"), /taskCardReturnDynamicToolSpec\(\)/);
  assert.match(functionBody(taskCardRouteServiceJs, "taskCardRuntimeDynamicTools"), /workspaceDelegationSettings\(settings\)\.enabled/);
  assert.match(functionBody(taskCardRouteServiceJs, "workspaceDelegationDynamicToolBody"), /body\.direct = true/);
  assert.match(functionBody(taskCardRouteServiceJs, "workspaceDelegationDynamicToolBody"), /body\.autoApprove = true/);
  assert.match(functionBody(taskCardRouteServiceJs, "workspaceDelegationDynamicToolBody"), /body\.pending = false/);
  assert.doesNotMatch(functionBody(taskCardRouteServiceJs, "workspaceDelegationDynamicToolBody"), /params\.callId \|\| params\.call_id/);
  assert.match(functionBody(taskCardRouteServiceJs, "attachWorkspaceDelegationRuntimeGuidance"), /attachTaskCardRuntimeDynamicTools\(params, settings\)/);
  assert.match(functionBody(taskCardRouteServiceJs, "attachWorkspaceDelegationRuntimeGuidance"), /taskCardReturnScriptFallbackInstruction\(params\)/);
  assert.match(functionBody(taskCardRouteServiceJs, "attachWorkspaceDelegationRuntimeGuidance"), /workspaceDelegationScriptFallbackInstruction\(params\)/);
  assert.match(functionBody(taskCardRouteServiceJs, "taskCardReturnScriptFallbackInstruction"), /return-thread-task-card\.js/);
  assert.match(functionBody(taskCardRouteServiceJs, "taskCardReturnScriptFallbackInstruction"), /local final answer in the target thread is not a source-thread return card/);
  assert.match(functionBody(taskCardRouteServiceJs, "workspaceDelegationScriptFallbackInstruction"), /create-thread-task-card\.js/);
  assert.match(functionBody(taskCardRouteServiceJs, "workspaceDelegationScriptFallbackInstruction"), /deferred tool discovery such as `tool_search`/);
  assert.match(functionBody(taskCardRouteServiceJs, "workspaceDelegationScriptFallbackInstruction"), /first-class fallback path/);
  assert.match(functionBody(taskCardRouteServiceJs, "workspaceDelegationScriptFallbackInstruction"), /multi_agent_v1\.spawn_agent/);
  assert.match(functionBody(taskCardRouteServiceJs, "workspaceDelegationScriptFallbackInstruction"), /must not be used as a substitute/);
  assert.match(functionBody(taskCardRuntimePolicyServiceJs, "applyStartThreadRuntimeSettings"), /attachWorkspaceDelegationRuntimeGuidance\(params\)/);
  assert.match(functionBody(taskCardRuntimePolicyServiceJs, "applyTurnRuntimeSettings"), /attachWorkspaceDelegationRuntimeGuidance\(params\)/);
  assert.match(functionBody(codexAppServerClientServiceJs, "sendRpc"), /const serializedPayload = JSON\.stringify\(payload\)/);
  assert.match(functionBody(codexAppServerClientServiceJs, "sendRpc"), /logWorkspaceDelegationRpc\(method, params\);[\s\S]*this\.ws\.send\(serializedPayload\)/);
  assert.match(functionBody(codexAppServerClientServiceJs, "handleServerRequest"), /msg\.method === "item\/tool\/call"[\s\S]*answerDynamicToolServerRequest\(request\)/);
  assert.match(functionBody(taskCardRouteServiceJs, "dynamicToolServerRequestResponsePayload"), /createThreadTaskCardsFromSourceThread\(body\.sourceThreadId, body\)/);
  assert.match(functionBody(taskCardRouteServiceJs, "dynamicToolServerRequestResponsePayload"), /threadTaskCardService\.reply\(prepared\.taskCardId, prepared\.actorThreadId, prepared\.body\)/);
  assert.match(functionBody(taskCardRouteServiceJs, "dynamicToolServerRequestResponsePayload"), /taskCardReturnToolFullName/);
  assert.match(functionBody(taskCardRouteServiceJs, "dynamicToolServerRequestResponsePayload"), /replyCardTerminal: Boolean/);
  assert.match(functionBody(taskCardRouteServiceJs, "dynamicToolServerRequestResponsePayload"), /replyCardRequiresReturn: Boolean/);
  assert.match(functionBody(taskCardRouteServiceJs, "dynamicToolServerRequestResponsePayload"), /replyCardAckPolicy:/);
  assert.match(functionBody(taskCardRouteServiceJs, "dynamicToolServerRequestResponsePayload"), /forcedDirect: true/);
  assert.match(functionBody(taskCardRouteServiceJs, "taskCardReturnDynamicToolBody"), /returnToSource: true/);
  assert.match(functionBody(taskCardRouteServiceJs, "taskCardReturnDynamicToolBody"), /const status = normalizedTaskCardReturnStatus/);
  assert.match(taskCardIdempotencyServiceJs, /replyToThreadId/);
  assert.match(functionBody(taskCardRouteServiceJs, "dynamicToolServerRequestResponsePayload"), /logWorkspaceDelegationDynamicToolCall\(request, params, args, \{[\s\S]*outcome: "ok"/);
  assert.match(functionBody(taskCardRouteServiceJs, "dynamicToolServerRequestResponsePayload"), /outcome: "unsupported_dynamic_tool"/);
  assert.match(functionBody(taskCardRouteServiceJs, "dynamicToolServerRequestResponsePayload"), /outcome: "source_thread_id_required"/);
  assert.match(functionBody(taskCardRouteServiceJs, "dynamicToolServerRequestResponsePayload"), /outcome: "target_thread_required"/);
  assert.match(functionBody(serverJs, "workspaceDelegationRpcDiagnostics"), /dynamicToolsCount: toolNames\.length/);
  assert.match(functionBody(serverJs, "workspaceDelegationRpcDiagnostics"), /hasWorkspaceDelegationTool: toolNames\.includes\(WORKSPACE_DELEGATION_TOOL_FULL_NAME\)/);
  assert.match(functionBody(serverJs, "workspaceDelegationRpcDiagnostics"), /hasFallbackGuidance:/);
  assert.match(functionBody(serverJs, "workspaceDelegationRpcDiagnostics"), /developerInstructionsChars:/);
  assert.doesNotMatch(functionBody(serverJs, "workspaceDelegationRpcDiagnostics"), /developerInstructions:\s/);
  assert.match(functionBody(taskCardRouteServiceJs, "workspaceDelegationDynamicToolCallDiagnostics"), /targetRefCount: threadTaskCardTargetReferences\(args\)\.length/);
  assert.match(functionBody(taskCardRouteServiceJs, "workspaceDelegationDynamicToolCallDiagnostics"), /hasBody: Boolean/);
  assert.doesNotMatch(functionBody(taskCardRouteServiceJs, "workspaceDelegationDynamicToolCallDiagnostics"), /bodyMarkdown:[\s\S]*args\.bodyMarkdown/);
  assert.match(routingServiceJs, /targetWorkspace/);
  assert.match(routingServiceJs, /targetCwd/);
  assert.match(routingServiceJs, /visibleTargetsForCwd\(rawPath, visibleThreads, sourceThreadId\)/);
  assert.match(routingServiceJs, /target_workspace_ambiguous/);
  assert.match(functionBody(taskCardRouteServiceJs, "workspaceDelegationDynamicToolSpec"), /Thread identity is the exact targetThreadId/);
  const sourceThreadTaskCardCreateRoute = taskCardRouteServiceJs.slice(
    taskCardRouteServiceJs.indexOf('const sourceThreadTaskCardCreate = url.pathname.match(/^\\/api\\/threads\\/([^/]+)\\/task-cards$/);'),
    taskCardRouteServiceJs.indexOf('if (url.pathname === "/api/thread-task-cards" && method === "POST")'),
  );
  assert.match(sourceThreadTaskCardCreateRoute, /details: err\.details/);
  assert.match(appServerRequestPolicyServiceJs, /"item\/tool\/call"/);
  assert.match(taskCardRouteServiceJs, /const service = options\.threadTaskCardService \|\| threadTaskCardService/);
  assert.match(taskCardRouteServiceJs, /service\.approveFromSource\(card\.id, payload\.sourceThreadId\)/);
  assert.match(taskCardRouteServiceJs, /direct: autoApprove/);
  assert.match(taskCardRouteServiceJs, /workspaceDelegationEnabled: workspaceDelegation\.enabled/);
  assert.match(coreApiRouteServiceJs, /workspaceDelegation,\s+hermesPlugin:/);
  assert.match(createThreadTaskCardScript, /\/api\/threads\/\$\{encodeURIComponent\(sourceThreadId\)\}\/task-cards/);
  assert.match(createThreadTaskCardScript, /CODEX_MOBILE_KEY_FILE/);
  assert.match(createThreadTaskCardScript, /--pending/);
  assert.match(createThreadTaskCardScript, /--reasoning-effort <value>/);
  assert.match(createThreadTaskCardScript, /--reply-to-thread <id>/);
  assert.match(createThreadTaskCardScript, /replyToThreadId/);
  assert.match(createThreadTaskCardScript, /Settings -> 跨工作区委派/);
  assert.match(returnThreadTaskCardScript, /\/api\/thread-task-cards\/\$\{encodeURIComponent\(taskCardId\)\}\/reply/);
  assert.match(returnThreadTaskCardScript, /CODEX_MOBILE_KEY_FILE/);
  assert.match(returnThreadTaskCardScript, /--status <value>/);
  assert.match(returnThreadTaskCardScript, /rejected/);
  assert.match(returnThreadTaskCardScript, /partially_completed/);
  assert.match(returnThreadTaskCardScript, /returnToSource = true/);
  assert.match(returnThreadTaskCardScript, /task-card-return:/);
  assert.match(functionBody(taskCardRouteServiceJs, "taskCardReturnDynamicToolSpec"), /rejected/);
  assert.match(functionBody(taskCardRouteServiceJs, "taskCardReturnDynamicToolSpec"), /partially_completed/);
});

test("thread task card routes preserve service status codes", () => {
  const routeStart = taskCardRouteServiceJs.indexOf('if (url.pathname === "/api/thread-task-cards" && method === "POST")');
  const routeBlock = taskCardRouteServiceJs.slice(
    routeStart,
    taskCardRouteServiceJs.indexOf('return { handled: false };', routeStart),
  );
  assert.match(routeBlock, /threadTaskCardService\.createMany/);
  assert.match(routeBlock, /threadTaskCardService\.get/);
  assert.match(routeBlock, /threadTaskCardService\.approve/);
  assert.match(routeBlock, /threadTaskCardService\.deleteCard/);
  assert.match(routeBlock, /threadTaskCardService\.revoke/);
  assert.match(routeBlock, /threadTaskCardService\.reply/);
  assert.match(routeBlock, /threadTaskCardService\.pauseExecution/);
  assert.match(routeBlock, /threadTaskCardService\.cancelExecution/);
  assert.match(serverJs, /function maybeAutoReplyThreadTaskCard\(/);
  assert.match(serverJs, /threadTaskCardService\.maybeAutoReplyCompletedTurn/);
  assert.match(serverJs, /threadTaskCardService\.maybeResumeInterruptedTaskCard/);
  assert.match(serverJs, /maybeAutoReplyThreadTaskCard,\s+maybeApplyQueuedThreadSideChat,/);
  assert.match(codexAppServerClientServiceJs, /maybeAutoReplyThreadTaskCard\(msg\.method, msg\.params \|\| null\)/);
  const statusPreservingErrors = routeBlock.match(/sendJson\(err\.statusCode \|\| 500, \{ ok: false, error: err\.message \|\| String\(err\) \}\);/g) || [];
  assert.equal(statusPreservingErrors.length, 8);
});

test("approved task cards inherit target thread model and effort", () => {
  const setupBlock = serverJs.slice(
    serverJs.indexOf("const threadTaskCardService = createThreadTaskCardService"),
    serverJs.indexOf("threadTaskCardRouteService = createThreadTaskCardRouteService"),
  );
  assert.match(setupBlock, /const requestedReasoningEffort = String\(card && card\.delivery && card\.delivery\.reasoningEffort/);
  assert.match(setupBlock, /const inheritedRuntimeSettings = await resolveThreadRuntimeSettings\(card\.target\.threadId\);/);
  assert.match(setupBlock, /const targetThread = readThreadTaskCardExecutionTargetSummary\(card\);/);
  assert.match(setupBlock, /const targetIsDeployLane = isHomeAiDeployLaneThread\(targetThread\);/);
  assert.match(setupBlock, /const baseRuntimeSettings = targetIsDeployLane/);
  assert.match(setupBlock, /applyPermissionModeOverride\(inheritedRuntimeSettings, "full", targetThread && targetThread\.cwd \|\| null\)/);
  assert.match(setupBlock, /Object\.assign\(\{\}, baseRuntimeSettings, \{ reasoningEffort: requestedReasoningEffort \}\)/);
  assert.match(setupBlock, /thread\/resume", applyResumeRuntimeSettings\(/);
  assert.match(setupBlock, /const turnParams = applyTurnRuntimeSettings\(/);
  assert.match(setupBlock, /codex\.request\("turn\/start", turnParams/);
  assert.match(setupBlock, /requestedReasoningEffort/);
  assert.match(setupBlock, /runtime:\s*\{[\s\S]*reasoningEffort: runtimeSettings\.reasoningEffort \|\| ""/);
  assert.match(setupBlock, /approvalPolicy: runtimeSettings\.approvalPolicy \|\| ""/);
  assert.match(setupBlock, /sandboxPolicyType: runtimeSettings\.sandboxPolicy && runtimeSettings\.sandboxPolicy\.type \|\| ""/);
  assert.match(setupBlock, /deployLaneNoApproval: targetIsDeployLane/);
  assert.match(setupBlock, /notifyLocalTurnStarted\(card\.target\.threadId, result, \{/);
  assert.match(setupBlock, /source: "thread-task-card-approval"/);
  assert.match(serverJs, /const webPushRuntimeService = createWebPushRuntimeService/);
  assert.match(webPushRuntimeServiceJs, /function maybeSendTurnCompletedPush\(method, params\)/);
  assert.match(functionBody(taskCardRuntimePolicyServiceJs, "applyTurnRuntimeSettings"), /if \(settings\.reasoningEffort\) params\.effort = settings\.reasoningEffort;/);
  assert.match(functionBody(taskCardRuntimePolicyServiceJs, "applyTurnRuntimeSettings"), /if \(settings\.model\) params\.model = settings\.model;/);
});

test("approved task-card deploy lane runtime uses visible target metadata when stored summary is sparse", () => {
  const helperBody = functionBody(taskCardRouteServiceJs, "readThreadTaskCardExecutionTargetSummary");
  assert.match(helperBody, /const stored = readThreadTaskCardTargetSummary\(threadId\) \|\| null;/);
  assert.match(helperBody, /const visible = readThreadTaskCardVisibleTargetSummary\(threadId\) \|\| null;/);
  assert.match(helperBody, /Object\.assign\(\{\}, stored \|\| \{\}, target, visible \|\| \{\}\)/);
  assert.match(helperBody, /if \(!String\(merged\.cwd \|\| ""\)\.trim\(\) && targetWorkspace\) merged\.cwd = targetWorkspace;/);
  assert.match(helperBody, /const visibleTitle = String\(visible && \(visible\.name \|\| visible\.title/);
  assert.match(helperBody, /const title = visibleTitle \|\| storedTitle \|\| targetTitle;/);
  const visibleHelperBody = functionBody(taskCardRouteServiceJs, "readThreadTaskCardVisibleTargetSummary");
  assert.match(visibleHelperBody, /threadTaskCardVisibleTargetThreads\(\)/);
  assert.match(visibleHelperBody, /Array\.isArray\(visibleThreads\) \? visibleThreads : \[\]/);
});

test("approved task-card deploy lane runtime prefers live visible lane title over sparse stored summary", () => {
  const service = createThreadTaskCardRouteService({
    threadTaskCardService: {},
    readStateDbThread: () => ({ id: "thread-movie", title: "019f16e6-9b3d-7ec1-b593-3a6a41a24fb1" }),
    readStartedThread: () => null,
    readRolloutSessionFallbackThread: () => null,
    readThreadListFallback: () => [
      { id: "thread-movie", name: "Movie Deploy Lane", cwd: "/Users/hermes-dev/HermesMobileDev/app" },
    ],
    threadDisplayTitle: (thread) => thread && (thread.name || thread.title || thread.preview || thread.id) || "",
  });

  const summary = service.readThreadTaskCardExecutionTargetSummary({
    target: {
      threadId: "thread-movie",
      workspaceId: "/Users/hermes-dev/HermesMobileDev/app",
      title: "Home AI Deploy",
    },
  });

  assert.equal(summary.name, "Movie Deploy Lane");
  assert.equal(summary.title, "Movie Deploy Lane");
  assert.equal(summary.preview, "Movie Deploy Lane");
  assert.equal(summary.cwd, "/Users/hermes-dev/HermesMobileDev/app");
});

test("approved task-card visible target summary helper is runtime executable", () => {
  const service = createThreadTaskCardRouteService({
    threadTaskCardService: {},
    readThreadListFallback: () => [
      { id: "thread-other", name: "Other" },
      { id: "thread-movie", name: "Movie Deploy Lane", cwd: "/Users/hermes-dev/HermesMobileDev/app" },
    ],
  });

  assert.equal(service.readThreadTaskCardVisibleTargetSummary("thread-movie").name, "Movie Deploy Lane");

  const emptyService = createThreadTaskCardRouteService({
    threadTaskCardService: {},
    readThreadListFallback: () => null,
  });

  assert.equal(emptyService.readThreadTaskCardVisibleTargetSummary("thread-movie"), null);
});

test("source-thread task-card route uses semantic idempotency for routine plugin deployments", () => {
  const service = createThreadTaskCardRouteService({
    threadTaskCardService: {},
    stableTextHash,
    readThreadListFallback: () => [
      { id: "source-thread", name: "Codex Mobile Implementation", cwd: "/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web" },
      { id: "deploy-lane", name: "Codex Mobile Deploy Lane", cwd: "/Users/hermes-dev/HermesMobileDev/app" },
    ],
    readStateDbThread: (threadId) => {
      if (threadId === "source-thread") return { id: "source-thread", title: "Codex Mobile Implementation", cwd: "/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web" };
      if (threadId === "deploy-lane") return { id: "deploy-lane", title: "deploy-lane" };
      return null;
    },
    threadDisplayTitle: (thread) => thread && (thread.name || thread.title || thread.preview || thread.id) || "",
  });
  const deployBody = {
    targetThreadId: "deploy-lane",
    cardKind: "plugin_deployment",
    pluginId: "codex-mobile-web",
    title: "Deploy Codex Mobile",
    body: "Deploy source ref fd39e541 for reason runtime-boundary-fix",
    workflowMode: "autonomous",
  };
  const firstDeploy = service.buildThreadTaskCardCreatePayload(Object.assign({}, deployBody, { requestId: "dynamic-tool-call" }), "source-thread");
  const retryDeploy = service.buildThreadTaskCardCreatePayload(Object.assign({}, deployBody, { requestId: "fallback-script-retry" }), "source-thread");
  assert.equal(firstDeploy.idempotencyKey, retryDeploy.idempotencyKey);

  const ordinaryBody = {
    targetThreadId: "deploy-lane",
    title: "Repair Codex Mobile",
    body: "Investigate an implementation issue",
    workflowMode: "autonomous",
  };
  const firstOrdinary = service.buildThreadTaskCardCreatePayload(Object.assign({}, ordinaryBody, { requestId: "dynamic-tool-call" }), "source-thread");
  const retryOrdinary = service.buildThreadTaskCardCreatePayload(Object.assign({}, ordinaryBody, { requestId: "fallback-script-retry" }), "source-thread");
  assert.notEqual(firstOrdinary.idempotencyKey, retryOrdinary.idempotencyKey);
});

test("server broadcasts lightweight thread status for background turn notifications", () => {
  const broadcastBody = functionBody(threadEventNotificationServiceJs, "broadcast");
  assert.match(broadcastBody, /threadStatusChangedPayloadFromTurnNotification\(payload\)/);
  assert.match(broadcastBody, /applyThreadStatusPayloadToThreadListFallbackCache\(statusPayload\);\s*broadcast\(statusPayload\);/);

  const statusPayloadBody = functionBody(threadEventNotificationServiceJs, "threadStatusChangedPayloadFromTurnNotification");
  assert.match(statusPayloadBody, /method !== "turn\/started" && method !== "turn\/completed"/);
  assert.match(statusPayloadBody, /method === "turn\/started"[\s\S]*\{ type: "active" \}/);
  assert.match(statusPayloadBody, /turn\.status \|\| payload\.params\.status \|\| \{ type: "completed" \}/);

  const eventFilterBody = functionBody(threadEventNotificationServiceJs, "shouldSendEventToClient");
  assert.match(eventFilterBody, /payload\.method === "thread\/status\/changed"[\s\S]*return true;/);
  assert.match(functionBody(threadEventNotificationServiceJs, "broadcastThreadStatusChanged"), /applyThreadStatusPayloadToThreadListFallbackCache\(payload\);\s*broadcast\(payload\);/);
});

test("server broadcasts active status immediately for local turn starts", () => {
  const helperBody = functionBody(threadEventNotificationServiceJs, "notifyLocalTurnStarted");
  assert.match(helperBody, /const turnId = turnStartResultTurnId\(result\)/);
  assert.match(helperBody, /rememberLocalActiveThreadStatus\(id, turnId/);
  assert.match(helperBody, /threadDetailProjectionService\.applyNotification\("turn\/started"/);
  assert.match(helperBody, /broadcastThreadStatusChanged\(id, \{ type: "active" \}/);
  assert.match(helperBody, /source: String\(meta\.source \|\| "local-turn-start"\)/);

  assert.match(threadSummaryStateServiceJs, /const localActiveThreadStatuses = dependencies\.localActiveThreadStatuses instanceof Map/);
  assert.match(serverJs, /function applyLocalActiveThreadStatusToSummary\(/);
  assert.match(functionBody(serverJs, "applyLocalActiveThreadStatusToSummary"), /threadSummaryStateService\.applyLocalActiveThreadStatusToSummary/);
  assert.match(threadEventNotificationServiceJs, /function updateLocalActiveThreadStatusFromNotification\(/);
  assert.match(functionBody(threadEventNotificationServiceJs, "broadcast"), /updateLocalActiveThreadStatusFromNotification\(payload\)/);
  assert.match(functionBody(serverJs, "prepareThreadDetailResponseResult"), /threadDetailResponsePreparationService\.prepareThreadDetailResponseResult/);
  assert.match(functionBody(threadDetailResponsePreparationServiceJs, "prepareThreadDetailResponseResult"), /applyLocalActiveThreadStatusToResult/);
  assert.match(functionBody(serverJs, "normalizeThreadListResultStatuses"), /normalizeThreadSummaryLiveStatus/);

  assert.match(serverJs, /notifyLocalTurnStarted\(card\.target\.threadId, result, \{[\s\S]*source: "thread-task-card-approval"/);
  assert.match(threadMessageRouteServiceJs, /notifyLocalTurnStarted\(threadId, turnResult, \{ source: "message-submit" \}\)/);
  assert.match(threadMessageRouteServiceJs, /notifyLocalTurnStarted\(threadId, turnResult, \{ source: "new-thread-message" \}\)/);
  assert.match(autoTurnRecoveryServiceJs, /notifyLocalTurnStarted\(id, result, \{ source: "auto-turn-recovery" \}\)/);
  assert.match(serverJs, /notifyLocalTurnStarted\(threadId, result, \{ source: "side-chat-apply" \}\)/);
  assert.match(continuationThreadServiceJs, /notifyLocalTurnStarted\(threadId, result, \{ source: "continuation-source-handoff" \}\)/);
  assert.match(continuationThreadServiceJs, /notifyLocalTurnStarted\(threadId, bootstrap, \{ source: "continuation-bootstrap" \}\)/);
});

test("server materializes structured task-card drafts from thread detail", () => {
  assert.match(serverJs, /const THREAD_TASK_CARD_DRAFT_TAG = "codex-mobile-thread-task-card-draft"/);
  assert.match(serverJs, /const THREAD_TASK_CARD_BODY_MAX_CHARS = 8_000/);
  assert.match(serverJs, /const THREAD_TASK_CARD_DRAFT_TURN_LOOKBACK = 4/);
  assert.match(taskCardRouteServiceJs, /function parseThreadTaskCardDraftText\(/);
  assert.match(taskCardRouteServiceJs, /function truncateThreadTaskCardBody\(/);
  assert.match(taskCardRouteServiceJs, /function materializeThreadTaskCardDraftsForThread\(/);
  assert.match(serverJs, /function maybeMaterializeThreadTaskCardDrafts\(/);
  assert.match(taskCardRouteServiceJs, /function prepareThreadTaskCardsToResult\(/);
  assert.match(functionBody(serverJs, "maybeMaterializeThreadTaskCardDrafts"), /method !== "turn\/completed"/);
  assert.match(functionBody(serverJs, "maybeMaterializeThreadTaskCardDrafts"), /codex\.request\("thread\/turns\/list"/);
  assert.match(functionBody(serverJs, "maybeMaterializeThreadTaskCardDrafts"), /await materializeThreadTaskCardDraftsForThread\(thread\)/);
  assert.match(functionBody(taskCardRouteServiceJs, "materializeThreadTaskCardDraftsForThread"), /const itemText = threadTaskCardItemText\(item\);/);
  assert.match(functionBody(taskCardRouteServiceJs, "materializeThreadTaskCardDraftsForThread"), /if \(!itemText\.includes\(threadTaskCardDraftTag\)\) continue;/);
  assert.match(functionBody(taskCardRouteServiceJs, "materializeThreadTaskCardDraftsForThread"), /const draft = parseThreadTaskCardDraftText\(itemText\);/);
  assert.match(functionBody(taskCardRouteServiceJs, "materializeThreadTaskCardDraftsForThread"), /readStateDbThread\(targetThreadId\) \|\| readStartedThread\(targetThreadId\)/);
  assert.match(functionBody(taskCardRouteServiceJs, "materializeThreadTaskCardDraftsForThread"), /const body = truncateThreadTaskCardBody\(draft\.body\)/);
  assert.match(functionBody(taskCardRouteServiceJs, "materializeThreadTaskCardDraftsForThread"), /threadTaskCardService\.createMany/);
  assert.match(functionBody(taskCardRouteServiceJs, "materializeThreadTaskCardDraftsForThread"), /threadTaskCardDraftIdempotencyKey\(sourceThreadId, turnId, draft\)/);
  assert.doesNotMatch(functionBody(taskCardRouteServiceJs, "materializeThreadTaskCardDraftsForThread"), /body: draft\.body/);
  assert.match(functionBody(taskCardRouteServiceJs, "prepareThreadTaskCardsToResult"), /await materializeThreadTaskCardDraftsForThread\(result\.thread\)/);
  assert.match(functionBody(taskCardRouteServiceJs, "prepareThreadTaskCardsToResult"), /attachThreadTaskCardsToResult\(result\)/);
  assert.match(functionBody(taskCardRouteServiceJs, "prepareThreadTaskCardsToResult"), /attachPendingServerRequestsToResult/);
  assert.doesNotMatch(functionBody(taskCardRouteServiceJs, "prepareThreadTaskCardsToResult"), /prepareThreadTaskCardsToResult\(result\)/);
  const prepareDetailBody = functionBody(threadDetailResponsePreparationServiceJs, "prepareThreadDetailResponseResult");
  assert.match(functionBody(serverJs, "prepareThreadDetailResponseResult"), /threadDetailResponsePreparationService\.prepareThreadDetailResponseResult/);
  assert.match(prepareDetailBody, /const completionBackfilled = backfillMissingRolloutCompletionTurnsForDetailResult\(result, details\);/);
  assert.match(prepareDetailBody, /const usageDecorated = attachRolloutUsageSummariesToDetailResult\(completionBackfilled\);/);
  assert.match(prepareDetailBody, /const inputAnchored = appendRolloutUserInputAnchorsToDetailResult\(usageDecorated\);/);
  assert.match(prepareDetailBody, /const activeAssistantDecorated = appendRolloutActiveAssistantItemsToDetailResult\(inputAnchored\);/);
  assert.match(prepareDetailBody, /const detailResult = finalizeActiveAssistantProjectionDetailResult\(activeAssistantDecorated\);/);
  assert.match(prepareDetailBody, /await prepareThreadTaskCardsToResult\(applyLocalActiveThreadStatusToResult\(detailResult, details\)\)/);
  assert.match(prepareDetailBody, /finalizeThreadDetailProjectionResult/);
  assert.match(prepareDetailBody, /const budgetOptions = Object\.assign\(\{\}, responseBudgetOptions\(\) \|\| \{\}, \{/);
  assert.doesNotMatch(prepareDetailBody, /THREAD_DETAIL_|MAX_LIVE_OPERATION_ITEMS/);
  assert.match(functionBody(serverJs, "turnsListThreadReadResult"), /threadDetailResponsePreparationService\.turnsListThreadReadResult/);
  assert.match(functionBody(threadDetailResponsePreparationServiceJs, "turnsListThreadReadResult"), /return prepareThreadDetailResponseResult\(result/);
  assert.match(serverJs, /maybeMaterializeThreadTaskCardDrafts,\s+maybeAutoReplyThreadTaskCard,/);
  assert.match(codexAppServerClientServiceJs, /maybeMaterializeThreadTaskCardDrafts\(msg\.method, msg\.params \|\| null\)/);
  assert.match(serverJs, /prepareResponse: prepareThreadDetailResponseResult/);
  assert.match(apiDispatchRouteServiceJs, /threadDetailReadOrchestrationService\.readThreadDetail/);
  assert.match(apiDispatchRouteServiceJs, /handleThreadDetailReadRoute\(\{/);
  assert.match(threadDetailRouteServiceJs, /const preferRecentTurns = detailModeFromUrl\(url\) === "recent"/);
  assert.match(threadDetailRouteServiceJs, /sendJson\(status, body\)/);
  assert.match(serverJs, /require\("\.\/server-routes\/api-dispatch-route-service"\)/);
  assert.match(apiDispatchRouteAdapterJs, /require\("\.\.\/server-routes\/api-dispatch-route-service"\)/);
  assert.match(serverJs, /require\("\.\/server-routes\/thread-detail-route-service"\)/);
  assert.match(threadDetailRouteAdapterJs, /require\("\.\.\/server-routes\/thread-detail-route-service"\)/);
});

test("conversation render includes task card signature, toolbar, and action handlers", () => {
  assert.match(appJs, /CLIENT_BUILD_ID = "0\.1\.11\|codex-mobile-shell-v\d+"/);
  assert.match(appJs, /function threadTaskCardsForThread\(/);
  assert.match(appJs, /filter\(\(card\) => String\(card && card\.status \|\| ""\) === "pending"\)/);
  assert.match(appJs, /filter\(\(card\) => String\(card && card\.threadRole \|\| ""\) === "target"\)/);
  assert.match(appJs, /function settleCurrentThreadTaskCard\(/);
  assert.match(appJs, /settledCard\.threadRole === "target"/);
  assert.match(appJs, /settledCard\.threadRole === "source"/);
  assert.match(appJs, /settleThreadTaskCardForThread\(threadId, id, action === "approve" \? "approved" : action === "delete" \? "deleted" : action === "revoke" \? "revoked" : "replied"/);
  assert.match(appJs, /function threadTaskCardsSignature\(/);
  assert.match(appJs, /taskCards: threadTaskCardsSignature\(thread\)/);
  assert.match(appJs, /thread-card-task-badge/);
  assert.match(appJs, /function renderThreadTaskToolbar\(/);
  assert.match(appJs, /data-create-thread-task-card/);
  assert.match(functionBody(appJs, "renderThreadTaskToolbar"), /data-thread-action-thread-id/);
  assert.match(functionBody(appJs, "renderRolloutWarning"), /data-thread-action-thread-id/);
  assert.match(appJs, /function openContinuationDialog\(/);
  assert.match(appJs, /function closeContinuationDialog\(/);
  assert.match(appJs, /if \(\$\("continuationDialog"\)\) \$\("continuationDialog"\)\.addEventListener\("click"/);
  assert.match(appJs, /function renderThreadTaskCards\(/);
  assert.match(appJs, /data-task-card=/);
  assert.match(appJs, /data-task-card-action="approve"/);
  assert.match(appJs, /data-task-card-action="reply"/);
  assert.match(appJs, /data-task-card-action="delete"/);
  assert.match(appJs, /data-task-card-action="revoke"/);
  assert.match(appJs, /data-task-card-thread-id/);
  assert.match(appJs, /data-task-card-body-placeholder/);
  assert.match(appJs, /function loadThreadTaskCardBody\(/);
  assert.match(functionBody(appJs, "loadThreadTaskCardBody"), /\/api\/thread-task-cards\/\$\{encodeURIComponent\(id\)\}\?threadId=\$\{encodeURIComponent\(ownerThreadId\)\}/);
  assert.match(appJs, /handleThreadTaskCardDetailsToggle/);
  assert.match(appJs, /const threadDetailActionsApi = window\.CodexThreadDetailActions/);
  assert.match(appJs, /threadDetailActionsApi\.resolveThreadDetailClickAction/);
  assert.match(appJs, /function createThreadTaskCardFromCurrent\(/);
  assert.match(appJs, /function createThreadTaskCardFromThread\(/);
  assert.match(functionBody(appJs, "createThreadTaskCardFromThread"), /sourceTurnId: activeTurnIdForThread\(thread\)/);
  assert.match(functionBody(appJs, "createThreadTaskCardFromThread"), /await refreshThreadAfterTaskCard\(thread\.id\)/);
  assert.doesNotMatch(functionBody(appJs, "createThreadTaskCardFromThread"), /currentLiveTurn\(\)/);
  assert.match(appJs, /function mutateThreadTaskCard\(/);
  assert.match(appJs, /function replyTaskCard\(/);
  assert.match(functionBody(appJs, "mutateThreadTaskCard"), /const threadId = String\(options\.threadId \|\| body\.threadId \|\| state\.currentThreadId \|\| ""\)\.trim\(\)/);
  assert.match(functionBody(appJs, "mutateThreadTaskCard"), /Object\.assign\(\{\}, body, \{ threadId \}\)/);
  assert.match(functionBody(appJs, "mutateThreadTaskCard"), /settleThreadTaskCardForThread\(threadId, id,/);
  assert.match(functionBody(appJs, "replyTaskCard"), /findThreadTaskCard\(cardId, threadId\)/);
  assert.match(appJs, /replyTaskCard\(actionPlan\.cardId, \{ threadId: actionPlan\.threadId \}\)/);
  assert.match(appJs, /mutateThreadTaskCard\(actionPlan\.cardId, actionPlan\.taskCardAction, \{\}, \{ threadId: actionPlan\.threadId \}\)/);
  assert.match(functionBody(appJs, "bindCurrentThreadActions"), /threadActionContextFromElement\(button\)/);
  assert.match(appJs, /function isThreadTaskCardCommandText\(/);
  assert.match(appJs, /function sendThreadTaskCardCommand\(/);
  assert.match(functionBody(appJs, "sendMessage"), /await sendThreadTaskCardCommand\(text\)/);
  assert.match(appJs, /const THREAD_TASK_CARD_COMMAND_PREFIX = "#"/);
  assert.match(appJs, /const THREAD_TASK_CARD_LEGACY_COMMAND_PREFIX = "#自由协作"/);
  assert.match(appJs, /const THREAD_TASK_CARD_MENTION_PATTERN = \/\^@\(任务卡片\|Task\\s\*Card\|TaskCard\)/);
  assert.match(appJs, /const THREAD_TASK_CARD_AUTONOMOUS_MENTION_PATTERN = \/\^@\(自由协作\|Autonomous\|Auto\\s\*Task\\s\*Card\|AutoTaskCard\)/);
  assert.match(functionBody(appJs, "isThreadTaskCardCommandText"), /startsWith\(THREAD_TASK_CARD_COMMAND_PREFIX\)/);
  assert.match(functionBody(appJs, "isThreadTaskCardCommandText"), /THREAD_TASK_CARD_MENTION_PATTERN\.test\(text\)/);
  assert.match(functionBody(appJs, "isThreadTaskCardCommandText"), /THREAD_TASK_CARD_AUTONOMOUS_MENTION_PATTERN\.test\(text\)/);
  assert.match(functionBody(appJs, "isThreadTaskCardCommandText"), /threadTaskCardCommandText\(text\)\.length > 0/);
  assert.match(functionBody(appJs, "threadTaskCardCommandText"), /text\.startsWith\(THREAD_TASK_CARD_LEGACY_COMMAND_PREFIX\)/);
  assert.match(functionBody(appJs, "threadTaskCardCommandText"), /text\.slice\(THREAD_TASK_CARD_LEGACY_COMMAND_PREFIX\.length\)/);
  assert.match(functionBody(appJs, "threadTaskCardCommandText"), /THREAD_TASK_CARD_AUTONOMOUS_MENTION_PATTERN\.test\(text\)/);
  assert.match(functionBody(appJs, "threadTaskCardCommandText"), /THREAD_TASK_CARD_MENTION_PATTERN\.test\(text\)/);
  assert.match(functionBody(appJs, "threadTaskCardCommandText"), /text\.slice\(THREAD_TASK_CARD_COMMAND_PREFIX\.length\)/);
  assert.match(appJs, /function buildThreadTaskCardDraftRequestText\(/);
  assert.match(appJs, /targetThreadIds/);
  assert.match(appJs, /workflowMode/);
  assert.match(appJs, /Approve workflow/);
  assert.match(functionBody(appJs, "buildThreadTaskCardDraftRequestText"), /Interpret the command above/);
  assert.match(functionBody(appJs, "buildThreadTaskCardDraftRequestText"), /@任务卡片/);
  assert.match(functionBody(appJs, "buildThreadTaskCardDraftRequestText"), /@自由协作/);
  assert.match(functionBody(appJs, "buildThreadTaskCardDraftRequestText"), /Default workflowMode to manual for plain # or @任务卡片 single-card commands/);
  assert.match(functionBody(appJs, "buildThreadTaskCardDraftRequestText"), /Use autonomous only when the command uses #自由协作, @自由协作/);
  assert.match(indexHtml, /id="composerIntentMenu"/);
  assert.match(indexHtml, /id="composerIntentDialog"/);
  assert.match(indexHtml, /id="composerIntentBodyInput"[\s\S]*maxlength="12000"/);
  assert.match(appJs, /function composerIntentOptions\(/);
  assert.match(appJs, /@任务卡片/);
  assert.match(appJs, /@自由协作/);
  assert.match(appJs, /function normalizedComposerIntentText\(/);
  assert.match(functionBody(appJs, "normalizedComposerIntentText"), /\\u200B-\\u200D\\uFEFF/);
  assert.match(functionBody(appJs, "shouldShowComposerIntentMenu"), /normalizedComposerIntentText\(composerText\(\)\) === "@"/);
  assert.match(appJs, /function queueComposerIntentMenuUpdate\(/);
  assert.match(appJs, /addEventListener\("keyup", queueComposerIntentMenuUpdate\)/);
  assert.match(appJs, /addEventListener\("focus", queueComposerIntentMenuUpdate\)/);
  assert.match(appJs, /addEventListener\("compositionstart", \(\) => \{[\s\S]*state\.composerComposing = true;/);
  assert.match(appJs, /addEventListener\("compositionend", \(event\) => \{[\s\S]*state\.composerComposing = false;/);
  assert.match(appJs, /addEventListener\("compositionend", \(event\) => \{[\s\S]*queueComposerIntentMenuUpdate\(\);/);
  assert.match(functionBody(appJs, "positionComposerIntentMenu"), /const anchor = \$\("messageInput"\) \|\| \$\("composer"\)/);
  assert.match(functionBody(appJs, "positionComposerIntentMenu"), /fitComposerPopupToAnchor\(menu, anchor, \{ minWidth: 280, maxWidth: 420 \}\)/);
  assert.match(functionBody(appJs, "sendMessage"), /const normalizedIntentText = normalizedComposerIntentText\(text\)/);
  assert.match(functionBody(appJs, "sendMessage"), /if \(normalizedIntentText === "@"\)/);
  assert.match(appJs, /function openComposerIntentDialog\(/);
  assert.match(appJs, /function saveComposerIntentDialogDraft\(/);
  assert.ok(indexHtml.indexOf('id="composerIntentMenu"') > indexHtml.indexOf('</form>\n    </main>'), "intent menu should be a page-level overlay, not a composer child");
  assert.match(stylesCss, /\.composer-intent-menu/);
  assert.match(stylesCss, /\.composer-intent-menu\s*{[\s\S]*position:\s*fixed;[\s\S]*left:\s*var\(--composer-popup-left/);
  assert.match(stylesCss, /\.composer-intent-menu\s*{[\s\S]*width:\s*var\(--composer-popup-width/);
  assert.match(stylesCss, /\.composer-intent-menu\s*{[\s\S]*max-height:\s*min\(var\(--composer-popup-max-height/);
  assert.match(stylesCss, /\.composer-intent-option/);
  assert.match(appJs, /function parseThreadTaskCardDraftText\(/);
  assert.match(appJs, /const THREAD_TASK_CARD_BODY_MAX_CHARS = 8000/);
  assert.match(appJs, /function truncateThreadTaskCardBody\(/);
  assert.match(appJs, /function renderPendingThreadTaskCardDraft\(/);
  assert.match(appJs, /function renderTurnThreadTaskCardDraft\(/);
  assert.match(appJs, /function waitForCurrentThreadTurn\(/);
  assert.match(appJs, /function renderThreadTaskCardDraft\(/);
  assert.match(appJs, /function threadTaskCardDraftKeyForDraft\(/);
  assert.match(appJs, /function threadTaskCardDraftPayloadKey\(/);
  assert.match(appJs, /function recoverVisibleThreadForDraftTargetId\(/);
  assert.match(appJs, /function canRecoverFailedThreadTaskCardDraft\(/);
  assert.match(appJs, /commonPrefixLength\(id, thread\.id\)/);
  assert.match(appJs, /entry\.prefix >= 14/);
  assert.match(appJs, /function matchingThreadTaskCardsForDraft\(/);
  assert.match(appJs, /matchingThreadTaskCardsForDraft\(draft, turn, contextThread\)/);
  assert.match(functionBody(appJs, "matchingThreadTaskCardsForDraft"), /const contextThread = renderContextThread\(thread\)/);
  assert.match(appJs, /function renderThreadTaskCardExpandable\(/);
  assert.match(appJs, /const STORAGE_TASK_CARD_DRAFT_STATES = "codexMobileThreadTaskCardDraftStates"/);
  assert.match(appJs, /THREAD_TASK_CARD_DRAFT_CREATE_STALE_MS/);
  assert.match(appJs, /THREAD_TASK_CARD_DRAFT_CREATE_MAX_ATTEMPTS/);
  assert.match(appJs, /activeThreadTaskCardDraftCreations: new Set\(\)/);
  assert.match(appJs, /function isThreadTaskCardDraftCreationStale\(/);
  assert.match(appJs, /function saveThreadTaskCardDraftStates\(\)/);
  assert.match(appJs, /function queueThreadTaskCardDraftCreation\(/);
  assert.match(appJs, /state\.activeThreadTaskCardDraftCreations\.has\(key\)/);
  assert.match(functionBody(appJs, "queueThreadTaskCardDraftCreation"), /const sourceThreadId = renderContextThreadId\(thread\)/);
  assert.match(functionBody(appJs, "queueThreadTaskCardDraftCreation"), /createThreadTaskCardDraft\(key, \{ threadId: sourceThreadId \}\)/);
  assert.match(appJs, /function createThreadTaskCardDraft\(/);
  assert.match(functionBody(appJs, "createThreadTaskCardDraft"), /const requestedThread = taskCardActionThread\(requestedThreadId\)/);
  assert.match(functionBody(appJs, "createThreadTaskCardDraft"), /const resolved = findThreadTaskCardDraftByKey\(draftKey, requestedThread\)/);
  assert.match(functionBody(appJs, "createThreadTaskCardDraft"), /const targetRefs = threadTaskCardDraftTargetThreads\(draft\);/);
  assert.match(functionBody(appJs, "createThreadTaskCardDraft"), /const targetThreadIds = threadTaskCardDraftTargetIds\(draft\);/);
  assert.match(functionBody(appJs, "createThreadTaskCardDraft"), /const body = truncateThreadTaskCardBody\(draft\.body\);/);
  assert.doesNotMatch(functionBody(appJs, "createThreadTaskCardDraft"), /Target thread is missing from the visible thread list/);
  assert.doesNotMatch(functionBody(appJs, "createThreadTaskCardDraft"), /missingTargets/);
  assert.doesNotMatch(functionBody(appJs, "createThreadTaskCardDraft"), /body: draft\.body/);
  assert.match(functionBody(appJs, "createThreadTaskCardDraft"), /targetWorkspaceIds/);
  assert.match(functionBody(appJs, "createThreadTaskCardDraft"), /if \(entry\.thread\) targetWorkspaceIds\[entry\.threadId\] = String\(entry\.thread\.cwd \|\| ""\);/);
  assert.match(appJs, /if \(!draft\) continue;/);
  assert.doesNotMatch(appJs, /if \(!draft\) return null;/);
  assert.match(appJs, /Task card creation timed out before the server stored a card/);
  assert.match(appJs, /Task card creation returned no cards/);
  assert.match(appJs, /if \(draftState\.status === "creating"\) return "";/);
  assert.doesNotMatch(appJs, /Sending cross-thread task card/);
  assert.doesNotMatch(appJs, /data-task-card-draft-action="approve"/);
  assert.doesNotMatch(appJs, /approveThreadTaskCardDraft/);
  assert.match(appJs, /data-task-card-draft-action="dismiss"/);
  assert.match(appJs, /data-task-card-draft-thread-id/);
  assert.match(appJs, /function scheduleThreadTaskCardDraftStateRender\(/);
  assert.match(appJs, /dismissThreadTaskCardDraft\(actionPlan\.draftKey, \{ threadId: actionPlan\.threadId \}\)/);
  assert.match(appJs, /idempotencyKey: `task-card-draft:\$\{sourceThreadId\}:\$\{draftKey\}`/);
  assert.match(appJs, /Task card created; opening target thread/);
  assert.match(appJs, /Task cards created: \$\{createdCards\.length\}/);
  assert.match(appJs, /state\.pendingPluginRouteHint = createdCards\.length === 1 \? normalizePluginRouteHint\(\{/);
  assert.match(appJs, /taskId: createdCards\[0\]\.id/);
  assert.match(appJs, /if \(createdCards\.length === 1\) \{/);
  assert.match(appJs, /if \(draftState\.status === "created" \|\| draftState\.status === "dismissed"\) return "";/);
  assert.match(appJs, /pluginEmbedApi\.findRouteHintTargetNode\(conversation, hint, \{ escapeSelector: escapeSelectorAttr \}\)/);
  assert.match(appJs, /Task card approved; starting target turn/);
  assert.match(appJs, /\$\{items\}\$\{approvalsHtml\}[\s\S]*\$\{showStatusLine \? [\s\S]*: ""\}[\s\S]*\$\{draftHtml\}\$\{pendingDraftHtml\}/);
  assert.match(functionBody(appJs, "renderCurrentThread"), /threadDetailRenderPlanApi\.planSingleThreadFullRenderShell/);
  assert.match(functionBody(appJs, "renderCurrentThread"), /taskCardsHtml/);
  assert.match(appJs, /Task card draft request/);
  assert.match(indexHtml, /id="workspaceDelegationSettings"/);
  assert.match(stylesCss, /\.workspace-delegation-row/);
  assert.match(appJs, /function renderWorkspaceDelegationSettings\(/);
  assert.match(appJs, /function handleWorkspaceDelegationSettingsClick\(/);
  assert.match(appJs, /\/api\/settings\/workspace-delegation/);
  assert.match(appJs, /data-workspace-delegation-toggle/);
  assert.doesNotMatch(appJs, /function shouldPreflightWorkspaceDelegation\(/);
  assert.doesNotMatch(appJs, /function maybeDelegateCrossWorkspaceMessage\(/);
  assert.doesNotMatch(functionBody(appJs, "sendMessage"), /maybeDelegateCrossWorkspaceMessage/);
  assert.doesNotMatch(functionBody(appJs, "sendMessage"), /workspaceDelegation/);
});

test("client pane toolbar actions use the owning pane thread", async () => {
  const sources = [
    "findThreadById",
    "threadActionElementThreadId",
    "threadActionContextFromElement",
    "bindCurrentThreadActions",
  ].map((name) => functionSource(appJs, name));
  const harness = Function(`
const calls = { start: [], task: [], dismiss: [], older: [], errors: [] };
function button(dataset = {}) {
  return {
    dataset,
    listeners: {},
    addEventListener(type, listener) {
      this.listeners[type] = listener;
    },
    closest() {
      return null;
    },
  };
}
const newThreadButton = button({ threadActionThreadId: "thread-pane" });
const taskButton = button({ threadActionThreadId: "thread-pane" });
const dismissButton = button({ threadActionThreadId: "thread-pane" });
const olderButton = button({ threadActionThreadId: "thread-pane" });
const paneThread = { id: "thread-pane", name: "Pane" };
const currentThread = { id: "thread-current", name: "Current" };
const state = {
  currentThreadId: "thread-current",
  currentThread,
  threads: [{ id: "thread-list", name: "List" }],
  threadTileDetails: new Map([["thread-pane", paneThread]]),
};
const conversation = {
  querySelectorAll(selector) {
    if (selector === "[data-new-thread-from-current]") return [newThreadButton];
    if (selector === "[data-create-thread-task-card]") return [taskButton];
    if (selector === "[data-dismiss-rollout-warning]") return [dismissButton];
    if (selector === "[data-load-older-turns]") return [olderButton];
    return [];
  },
};
function $(id) {
  if (id === "conversation") return conversation;
  return null;
}
function startNewThreadFromThread(thread) {
  calls.start.push(thread && thread.id || "");
  return Promise.resolve();
}
function createThreadTaskCardFromThread(thread) {
  calls.task.push(thread && thread.id || "");
  return Promise.resolve();
}
function dismissRolloutWarning(thread) {
  calls.dismiss.push(thread && thread.id || "");
}
function loadOlderThreadTurns(options) {
  calls.older.push({
    threadId: options && options.threadId || "",
    thread: options && options.thread && options.thread.id || "",
    preserveScroll: Boolean(options && options.preserveScroll),
    source: options && options.source || "",
  });
  return Promise.resolve();
}
function showError(err) { calls.errors.push(String(err && err.message || err)); }
${sources.join("\n")}
return {
  bind: bindCurrentThreadActions,
  async clickAll() {
    newThreadButton.listeners.click({});
    taskButton.listeners.click({});
    dismissButton.listeners.click({});
    olderButton.listeners.click({});
    await Promise.resolve();
  },
  calls,
};
`)();

  harness.bind();
  await harness.clickAll();

  assert.deepEqual(harness.calls.start, ["thread-pane"]);
  assert.deepEqual(harness.calls.task, ["thread-pane"]);
  assert.deepEqual(harness.calls.dismiss, ["thread-pane"]);
  assert.deepEqual(harness.calls.older, [{
    threadId: "thread-pane",
    thread: "thread-pane",
    preserveScroll: true,
    source: "button",
  }]);
  assert.deepEqual(harness.calls.errors, []);
});

test("client manual task-card creation uses pane source turn and refresh", async () => {
  const createSource = functionSource(appJs, "createThreadTaskCardFromThread");
  const harness = Function(`
const calls = { textInputs: [], activeTurnThreads: [], refreshes: [], successes: [], failures: [], errors: [] };
const paneThread = { id: "thread-pane", cwd: "/work/pane", name: "Pane Thread" };
const state = {
  currentThreadId: "thread-current",
  currentThread: { id: "thread-current", cwd: "/work/current", name: "Current Thread" },
  selectedCwd: "/work/fallback",
};
let apiBody = null;
const textInputResponses = ["thread-target", "Repair title", "Repair body"];
function requestAppTextInput(message, value, options) {
  calls.textInputs.push({ message, value, title: options && options.title || "" });
  return Promise.resolve(textInputResponses.shift());
}
function resolveTargetThreadReferences(input) {
  return [{ threadId: String(input || ""), thread: { id: String(input || ""), cwd: "/work/target" } }];
}
function threadTitleForDisplay(thread) { return thread && thread.name || ""; }
function summarizeTaskCardText(value) { return String(value || "").slice(0, 80); }
function activeTurnIdForThread(thread) {
  calls.activeTurnThreads.push(thread && thread.id || "");
  return thread && thread.id === "thread-pane" ? "turn-pane-live" : "turn-current-live";
}
function refreshThreadAfterTaskCard(threadId) {
  calls.refreshes.push(String(threadId || ""));
  return Promise.resolve();
}
function recordHomeAiDiagnosticSuccess(input) { calls.successes.push(input); }
function recordHomeAiDiagnosticFailure(input) { calls.failures.push(input); }
function diagnosticThreadHash(value) { return "hash:" + value; }
function diagnosticErrorCode() { return "error"; }
function diagnosticErrorStatus() { return 0; }
function showError(err) { calls.errors.push(String(err && err.message || err)); }
function $(id) { return { classList: { remove() {}, add() {} }, textContent: "" }; }
async function api(url, options) {
  apiBody = JSON.parse(options.body);
  return { ok: true };
}
${createSource}
return {
  run: () => createThreadTaskCardFromThread(paneThread, { preventDefault() {}, stopPropagation() {} }),
  result: () => ({ apiBody, calls }),
};
`)();

  await harness.run();
  const result = harness.result();

  assert.equal(result.apiBody.sourceThreadId, "thread-pane");
  assert.equal(result.apiBody.sourceWorkspaceId, "/work/pane");
  assert.equal(result.apiBody.sourceThreadTitle, "Pane Thread");
  assert.equal(result.apiBody.sourceTurnId, "turn-pane-live");
  assert.deepEqual(result.apiBody.targetThreadIds, ["thread-target"]);
  assert.deepEqual(result.apiBody.targetWorkspaceIds, { "thread-target": "/work/target" });
  assert.deepEqual(result.calls.activeTurnThreads, ["thread-pane"]);
  assert.deepEqual(result.calls.refreshes, ["thread-pane"]);
  assert.equal(result.calls.successes.length, 1);
  assert.deepEqual(result.calls.failures, []);
  assert.deepEqual(result.calls.errors, []);
});

test("client older-turn loading updates the owning tile pane thread", async () => {
  const sources = [
    "findThreadById",
    "threadTurnsCursorParam",
    "turnsArrayFromListResult",
    "threadHistoryLoadTarget",
    "renderThreadHistoryLoadTarget",
    "loadOlderThreadTurns",
  ].map((name) => functionSource(appJs, name));
  const harness = Function(`
const calls = { api: [], currentRender: 0, tileRender: [], idle: [], errors: [] };
const MAX_VISIBLE_TURNS = 10;
const MAX_EXPANDED_VISIBLE_TURNS = 200;
const currentThread = {
  id: "thread-current",
  turns: [{ id: "current-only" }],
  mobileOlderTurnsCursor: "current-cursor",
  mobileOmittedTurnCount: 1,
};
const paneThread = {
  id: "thread-pane",
  turns: [{ id: "existing" }],
  mobileOlderTurnsCursor: "pane-cursor",
  mobileOmittedTurnCount: 3,
};
const state = {
  currentThreadId: "thread-current",
  currentThread,
  threadTileMode: true,
  threadTileDetails: new Map([["thread-pane", paneThread]]),
  threadHistoryBusy: false,
  threadHistoryError: "",
  threads: [],
};
function threadTilePaneIsVisible(id) { return id === "thread-pane"; }
function renderCurrentThread() { calls.currentRender += 1; }
function scheduleRenderThreadTilePane(id, options) {
  calls.tileRender.push({ id, preserveScroll: Boolean(options && options.preserveScroll) });
  return true;
}
function $(id) {
  if (id !== "conversation") return null;
  return { scrollTop: 0, scrollHeight: 100 };
}
function sortTurnsForDisplay(turns) { return Array.isArray(turns) ? turns.slice() : []; }
function mergeTurnPreservingVisibleItems(existingTurn, incomingTurn) {
  return Object.assign({}, existingTurn || {}, incomingTurn || {}, { merged: true });
}
async function api(url, options) {
  calls.api.push({ url, timeoutMs: options && options.timeoutMs });
  return {
    data: [{ id: "older" }, { id: "existing", text: "updated" }],
    nextCursor: "next-cursor",
    backwardsCursor: "newer-cursor",
  };
}
function markIdleActivity(value) { calls.idle.push(value); }
function normalizeClientErrorMessage(value) { return String(value || ""); }
function showError(err) { calls.errors.push(String(err && err.message || err)); }
function preserveConversationScrollAfterPrepend() { calls.errors.push("unexpected-current-scroll-preserve"); }
${sources.join("\n")}
return {
  run: () => loadOlderThreadTurns({ threadId: "thread-pane", preserveScroll: true, source: "test" }),
  result: () => ({
    currentThread,
    paneThread: state.threadTileDetails.get("thread-pane"),
    busy: state.threadHistoryBusy,
    error: state.threadHistoryError,
    calls,
  }),
};
`)();

  await harness.run();
  const result = harness.result();

  assert.deepEqual(result.calls.api, [{
    url: "/api/threads/thread-pane/turns?limit=10&sortDirection=desc&cursor=pane-cursor",
    timeoutMs: 30000,
  }]);
  assert.equal(result.currentThread.turns.length, 1);
  assert.equal(result.currentThread.turns[0].id, "current-only");
  assert.deepEqual(result.paneThread.turns.map((turn) => turn.id), ["older", "existing"]);
  assert.equal(result.paneThread.turns[1].merged, true);
  assert.equal(result.paneThread.mobileHistoryExpanded, true);
  assert.equal(result.paneThread.mobileOmittedTurnCount, 2);
  assert.equal(result.paneThread.mobileOlderTurnsCursor, "next-cursor");
  assert.equal(result.paneThread.mobileNewerTurnsCursor, "newer-cursor");
  assert.equal(result.busy, false);
  assert.equal(result.error, "");
  assert.equal(result.calls.currentRender, 0);
  assert.deepEqual(result.calls.tileRender, [
    { id: "thread-pane", preserveScroll: true },
    { id: "thread-pane", preserveScroll: true },
  ]);
  assert.deepEqual(result.calls.idle, ["History loaded"]);
  assert.deepEqual(result.calls.errors, []);
});

test("client task-card draft matching uses the explicit render context thread", () => {
  const sources = [
    "renderContextThreadId",
    "renderContextThread",
    "uniqueThreadTaskCardTargetIds",
    "threadTaskCardDraftTargetIds",
    "matchingThreadTaskCardsForDraft",
  ].map((name) => functionSource(appJs, name));
  const harness = Function(`
const state = {
  currentThreadId: "thread-current",
  currentThread: {
    id: "thread-current",
    threadTaskCards: [
      {
        id: "card-current",
        source: { threadId: "thread-current", turnId: "turn-draft" },
        target: { threadId: "thread-target" },
        message: { title: "Repair", body: "Do the work" },
      },
    ],
  },
  renderContextThreadId: "",
  renderContextThread: null,
};
${sources.join("\n")}
return { matchingThreadTaskCardsForDraft };
`)();
  const paneThread = {
    id: "thread-pane",
    threadTaskCards: [
      {
        id: "card-pane",
        source: { threadId: "thread-pane", turnId: "turn-draft" },
        target: { threadId: "thread-target" },
        message: { title: "Repair", body: "Do the work" },
      },
    ],
  };
  const draft = {
    targetThreadIds: ["thread-target"],
    title: "Repair",
    body: "Do the work",
  };
  const turn = { id: "turn-draft" };

  assert.equal(harness.matchingThreadTaskCardsForDraft(draft, turn)[0].id, "card-current");
  assert.equal(harness.matchingThreadTaskCardsForDraft(draft, turn, paneThread)[0].id, "card-pane");
});

test("client task-card draft creation uses queued source thread context", async () => {
  const createSource = functionSource(appJs, "createThreadTaskCardDraft");
  const harness = Function(`
const paneThread = { id: "thread-pane", cwd: "/work/pane", name: "Pane Thread", threadTaskCards: [] };
const state = {
  activeThreadTaskCardDraftCreations: new Set(),
  threadTileDetails: new Map([["thread-pane", paneThread]]),
  currentThreadId: "thread-current",
  currentThread: { id: "thread-current", cwd: "/work/current", name: "Current Thread", threadTaskCards: [] },
  selectedCwd: "/work/fallback",
  pendingPluginRouteHint: null,
  threadTileMode: true,
};
const draftStates = [];
const outgoingCounts = [];
const incomingCounts = [];
let apiBody = null;
let findThreadArg = null;
let loadedThreadId = "";
function taskCardActionThread(threadId) {
  const id = String(threadId || "").trim();
  if (id === "thread-pane") return paneThread;
  if (id === "thread-current") return state.currentThread;
  return state.currentThread;
}
function findThreadTaskCardDraftByKey(draftKey, thread) {
  findThreadArg = thread;
  return {
    key: String(draftKey || ""),
    sourceThread: thread,
    turn: { id: "turn-pane" },
    draft: {
      targetThreadIds: ["thread-target"],
      title: "Repair target",
      summary: "Repair summary",
      body: "Repair body",
      workflowMode: "manual",
      workflowId: "",
    },
  };
}
function setThreadTaskCardDraftState(key, value) { draftStates.push({ key, value }); }
function threadTaskCardDraftTargetThreads(draft) { return [{ threadId: "thread-target", thread: { id: "thread-target", cwd: "/work/target" } }]; }
function threadTaskCardDraftTargetIds(draft) { return draft.targetThreadIds || []; }
function truncateThreadTaskCardBody(value) { return String(value || ""); }
function threadTitleForDisplay(thread) { return thread && thread.name || ""; }
function summarizeTaskCardText(value) { return String(value || "").slice(0, 80); }
function upsertThreadTaskCardOnThread(thread, card) { thread.threadTaskCards = [card]; }
function incrementPendingOutgoingTaskCardCount(threadId, delta) { outgoingCounts.push({ threadId, delta }); }
function incrementPendingIncomingTaskCardCount(threadId, delta) { incomingCounts.push({ threadId, delta }); }
function normalizePluginRouteHint(value) { return value; }
function diagnosticThreadHash(value) { return "hash:" + value; }
function diagnosticItemHash(value) { return "item:" + value; }
function recordHomeAiDiagnosticSuccess() {}
function recordHomeAiDiagnosticFailure() {}
function diagnosticErrorCode() { return "error"; }
function diagnosticErrorStatus() { return 0; }
function normalizeClientErrorMessage(value) { return String(value || ""); }
function renderThreads() {}
function renderCurrentThread() {}
function threadTilePaneIsVisible() { return true; }
function scheduleRenderThreadTilePane() {}
function showError(err) { throw err; }
function loadThreads() { return Promise.resolve(); }
function loadThread(threadId) { loadedThreadId = String(threadId || ""); return Promise.resolve(); }
function $(id) { return { classList: { remove() {}, add() {} }, textContent: "" }; }
async function api(url, options) {
  apiBody = JSON.parse(options.body);
  return {
    cards: [{
      id: "card-created",
      status: "pending",
      source: { threadId: apiBody.sourceThreadId, turnId: apiBody.sourceTurnId },
      target: { threadId: "thread-target" },
      message: { title: apiBody.title, body: apiBody.body },
      threadRole: "source",
    }],
  };
}
${createSource}
return {
  run: () => createThreadTaskCardDraft("draft-key", { threadId: "thread-pane" }),
  result: () => ({ apiBody, findThreadArg, paneThread, draftStates, outgoingCounts, incomingCounts, loadedThreadId }),
};
`)();

  await harness.run();
  const result = harness.result();
  assert.equal(result.findThreadArg.id, "thread-pane");
  assert.equal(result.apiBody.sourceThreadId, "thread-pane");
  assert.equal(result.apiBody.sourceWorkspaceId, "/work/pane");
  assert.equal(result.apiBody.sourceThreadTitle, "Pane Thread");
  assert.equal(result.apiBody.idempotencyKey, "task-card-draft:thread-pane:draft-key");
  assert.equal(result.apiBody.sourceTurnId, "turn-pane");
  assert.equal(result.paneThread.threadTaskCards[0].id, "card-created");
  assert.deepEqual(result.outgoingCounts, [{ threadId: "thread-pane", delta: 1 }]);
  assert.deepEqual(result.incomingCounts, [{ threadId: "thread-target", delta: 1 }]);
  assert.equal(result.loadedThreadId, "thread-target");
});

test("client task-card draft state updates render the owning pane thread", () => {
  const sources = [
    "scheduleThreadTaskCardDraftStateRender",
    "setThreadTaskCardDraftState",
    "dismissThreadTaskCardDraft",
  ].map((name) => functionSource(appJs, name));
  const harness = Function(`
const state = {
  currentThreadId: "thread-current",
  threadTileMode: true,
  threadTaskCardDraftStates: new Map(),
};
const currentRenders = [];
const tileRenders = [];
function threadTaskCardDraftState(key) {
  return state.threadTaskCardDraftStates.get(String(key || "")) || {};
}
function saveThreadTaskCardDraftStates() {}
function renderCurrentThread() { currentRenders.push("current"); }
function threadTilePaneIsVisible(threadId) { return String(threadId || "") === "thread-pane"; }
function scheduleRenderThreadTilePane(threadId, options) {
  tileRenders.push({ threadId: String(threadId || ""), preserveScroll: Boolean(options && options.preserveScroll) });
  return true;
}
${sources.join("\n")}
return {
  dismiss: (key, options) => dismissThreadTaskCardDraft(key, options),
  setState: (key, value, options) => setThreadTaskCardDraftState(key, value, options),
  result: () => ({
    currentRenders,
    tileRenders,
    paneState: state.threadTaskCardDraftStates.get("draft-pane"),
    currentState: state.threadTaskCardDraftStates.get("draft-current"),
  }),
};
`)();

  harness.dismiss("draft-pane", { threadId: "thread-pane" });
  let result = harness.result();
  assert.deepEqual(result.currentRenders, []);
  assert.deepEqual(result.tileRenders, [{ threadId: "thread-pane", preserveScroll: true }]);
  assert.equal(result.paneState.status, "dismissed");

  harness.setState("draft-current", { status: "dismissed" }, { threadId: "thread-current" });
  result = harness.result();
  assert.deepEqual(result.currentRenders, ["current"]);
  assert.equal(result.currentState.status, "dismissed");
});

test("client task-card pending counts update the owning tile pane detail", () => {
  const sources = [
    "findThreadById",
    "taskCardCountThreadsForId",
    "incrementPendingIncomingTaskCardCount",
    "incrementPendingOutgoingTaskCardCount",
  ].map((name) => functionSource(appJs, name));
  const harness = Function(`
const listThread = {
  id: "thread-pane",
  pendingIncomingTaskCardCount: 5,
  pendingOutgoingTaskCardCount: 2,
  pendingTaskCardCount: 7,
};
const tileThread = {
  id: "thread-pane",
  pendingIncomingTaskCardCount: 3,
  pendingOutgoingTaskCardCount: 4,
  pendingTaskCardCount: 7,
};
const currentThread = {
  id: "thread-current",
  pendingIncomingTaskCardCount: 1,
  pendingOutgoingTaskCardCount: 1,
  pendingTaskCardCount: 2,
};
const state = {
  currentThreadId: "thread-current",
  currentThread,
  threads: [listThread],
  threadTileDetails: new Map([["thread-pane", tileThread]]),
};
${sources.join("\n")}
return {
  listThread,
  tileThread,
  currentThread,
  incrementIncoming: () => incrementPendingIncomingTaskCardCount("thread-pane", -1),
  incrementOutgoing: () => incrementPendingOutgoingTaskCardCount("thread-pane", -2),
};
`)();

  harness.incrementIncoming();
  assert.equal(harness.tileThread.pendingIncomingTaskCardCount, 2);
  assert.equal(harness.tileThread.pendingOutgoingTaskCardCount, 4);
  assert.equal(harness.tileThread.pendingTaskCardCount, 6);
  assert.equal(harness.listThread.pendingIncomingTaskCardCount, 2);
  assert.equal(harness.listThread.pendingOutgoingTaskCardCount, 4);
  assert.equal(harness.listThread.pendingTaskCardCount, 6);
  assert.equal(harness.currentThread.pendingTaskCardCount, 2);

  harness.incrementOutgoing();
  assert.equal(harness.tileThread.pendingIncomingTaskCardCount, 2);
  assert.equal(harness.tileThread.pendingOutgoingTaskCardCount, 2);
  assert.equal(harness.tileThread.pendingTaskCardCount, 4);
  assert.equal(harness.listThread.pendingIncomingTaskCardCount, 2);
  assert.equal(harness.listThread.pendingOutgoingTaskCardCount, 2);
  assert.equal(harness.listThread.pendingTaskCardCount, 4);
  assert.equal(harness.currentThread.pendingTaskCardCount, 2);
});
