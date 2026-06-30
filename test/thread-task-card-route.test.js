"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const serverJs = fs.readFileSync(path.resolve(__dirname, "..", "server.js"), "utf8");
const routingServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "adapters", "thread-task-card-routing-service.js"), "utf8");
const threadDetailRouteServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "adapters", "thread-detail-route-service.js"), "utf8");
const appJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "app.js"), "utf8");
const indexHtml = fs.readFileSync(path.resolve(__dirname, "..", "public", "index.html"), "utf8");
const stylesCss = fs.readFileSync(path.resolve(__dirname, "..", "public", "styles.css"), "utf8");
const createThreadTaskCardScript = fs.readFileSync(path.resolve(__dirname, "..", "scripts", "create-thread-task-card.js"), "utf8");
const returnThreadTaskCardScript = fs.readFileSync(path.resolve(__dirname, "..", "scripts", "return-thread-task-card.js"), "utf8");

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
  assert.match(serverJs, /"\/api\/thread-task-cards"/);
  assert.doesNotMatch(serverJs, /"\/api\/thread-task-cards\/parse"/);
  assert.match(serverJs, /const threadTaskCardApprove = url\.pathname\.match\(/);
  assert.match(serverJs, /const threadTaskCardDelete = url\.pathname\.match\(/);
  assert.match(serverJs, /const threadTaskCardRevoke = url\.pathname\.match\(/);
  assert.match(serverJs, /const threadTaskCardReply = url\.pathname\.match\(/);
  assert.match(serverJs, /const threadTaskCardExecutionPause = url\.pathname\.match\(/);
  assert.match(serverJs, /const threadTaskCardExecutionCancel = url\.pathname\.match\(/);
  assert.match(serverJs, /function attachThreadTaskCardsToThread\(/);
  assert.match(serverJs, /thread\.threadTaskCards = threadTaskCardService\.listForThread\(thread\.id\)/);
  assert.match(serverJs, /thread\.pendingIncomingTaskCardCount = taskCardCounts\.pendingIncoming/);
  assert.match(serverJs, /function attachThreadTaskCardCountsToThreadListResult\(/);
  assert.match(serverJs, /attachThreadTaskCardsToResult\(result\)/);
  assert.match(serverJs, /await threadTaskCardService\.approve/);
  assert.match(serverJs, /await threadTaskCardService\.reply/);
});

test("server exposes a thread-callable direct task-card interface", () => {
  assert.ok(serverJs.includes('const sourceThreadTaskCardCreate = url.pathname.match(/^\\/api\\/threads\\/([^/]+)\\/task-cards$/);'));
  assert.ok(serverJs.includes('const sourceThreadWorkspaceDelegation = url.pathname.match(/^\\/api\\/threads\\/([^/]+)\\/workspace-delegation$/);'));
  const workspaceDelegationRoute = serverJs.slice(
    serverJs.indexOf('const sourceThreadWorkspaceDelegation = url.pathname.match(/^\\/api\\/threads\\/([^/]+)\\/workspace-delegation$/);'),
    serverJs.indexOf('const threadDetailMatch = url.pathname.match(/^\\/api\\/threads\\/([^/]+)$/);'),
  );
  assert.match(workspaceDelegationRoute, /disabled: true/);
  assert.match(workspaceDelegationRoute, /delegated: false/);
  assert.match(workspaceDelegationRoute, /const workspaceDelegation = workspaceDelegationPublicSettings\(\)/);
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
  assert.match(serverJs, /function workspaceDelegationPublicSettings\(/);
  assert.match(serverJs, /function workspaceDelegationDynamicToolSpec\(/);
  assert.match(serverJs, /function taskCardReturnDynamicToolSpec\(/);
  assert.match(serverJs, /function attachTaskCardRuntimeDynamicTools\(/);
  assert.match(serverJs, /function attachWorkspaceDelegationRuntimeGuidance\(/);
  assert.match(serverJs, /function taskCardReturnScriptFallbackInstruction\(/);
  assert.match(serverJs, /function workspaceDelegationScriptFallbackInstruction\(/);
  assert.doesNotMatch(functionBody(serverJs, "workspaceDelegationTargetHints"), /threadTaskCardCanonicalVisibleTargets/);
  assert.match(functionBody(serverJs, "workspaceDelegationTargetHints"), /threadTaskCardVisibleTargetThreads\(\)/);
  assert.match(serverJs, /function workspaceDelegationRpcDiagnostics\(/);
  assert.match(serverJs, /function logWorkspaceDelegationRpc\(/);
  assert.match(serverJs, /function workspaceDelegationDynamicToolCallDiagnostics\(/);
  assert.match(serverJs, /function logWorkspaceDelegationDynamicToolCall\(/);
  assert.match(serverJs, /function dynamicToolServerRequestResponsePayload\(/);
  assert.match(serverJs, /function setWorkspaceDelegationEnabled\(/);
  assert.match(serverJs, /url\.pathname === "\/api\/settings\/workspace-delegation"/);
  assert.match(functionBody(serverJs, "workspaceDelegationPublicSettings"), /failureRecovery:\s*enabled \? "source_model_tool_call_with_dynamic_source_write_guard" : "off"/);
  assert.match(functionBody(serverJs, "workspaceDelegationPublicSettings"), /serverAutoTaskCardFromFailures:\s*false/);
  assert.match(serverJs, /function buildThreadTaskCardCreatePayload\(/);
  assert.match(serverJs, /function threadTaskCardThreadCallIdempotencyKey\(/);
  assert.match(serverJs, /function normalizeThreadTaskCardReasoningEffort\(/);
  assert.match(serverJs, /function resolvedThreadTaskCardTargetIds\(/);
  assert.match(serverJs, /function threadTaskCardVisibleTargetThreads\(/);
  assert.match(serverJs, /function threadTaskCardCanonicalVisibleTargets\(/);
  assert.match(serverJs, /function threadTaskCardCanonicalTargetForCwd\(/);
  assert.match(serverJs, /createThreadTaskCardRoutingService/);
  assert.match(serverJs, /const threadTaskCardRoutingService = createThreadTaskCardRoutingService\(\{/);
  assert.match(functionBody(serverJs, "resolveThreadTaskCardTargetReference"), /threadTaskCardRoutingService\.resolveTargetReference\(value, sourceThreadId, options\)/);
  assert.match(routingServiceJs, /function createThreadTaskCardRoutingService\(/);
  assert.match(routingServiceJs, /function resolveTargetReference\(/);
  assert.match(routingServiceJs, /const visibleThreads = visibleTargetThreads\(options\)/);
  assert.match(serverJs, /function assertThreadTaskCardTargetDeliverable\(/);
  assert.match(routingServiceJs, /target_thread_self/);
  assert.match(routingServiceJs, /target_thread_archived/);
  assert.match(routingServiceJs, /target_thread_not_visible/);
  assert.doesNotMatch(routingServiceJs, /return raw;/);
  assert.match(functionBody(serverJs, "buildThreadTaskCardCreatePayload"), /if \(!targetThreadIds\.length\)/);
  assert.match(functionBody(serverJs, "buildThreadTaskCardCreatePayload"), /target_thread_required/);
  assert.match(serverJs, /thread-task-card-deploy-lane-policy-service/);
  assert.match(functionBody(serverJs, "workspaceDelegationTargetHints"), /prioritizeDelegationTargetHints/);
  assert.match(functionBody(serverJs, "normalizeThreadSummaryLiveStatus"), /normalizeHomeAiDeployLaneSummary/);
  assert.match(functionBody(serverJs, "buildThreadTaskCardCreatePayload"), /applyHomeAiDeployLaneRoutingPolicy/);
  assert.match(functionBody(serverJs, "applyHomeAiDeployLaneRoutingPolicy"), /planHomeAiDeployLaneRouting/);
  assert.match(functionBody(serverJs, "applyHomeAiDeployLaneRoutingPolicy"), /deploy_lane_required/);
  assert.match(functionBody(serverJs, "createThreadTaskCardsFromSourceThread"), /workspaceDelegationPublicSettings\(\)/);
  assert.match(functionBody(serverJs, "createThreadTaskCardsFromSourceThread"), /workspaceDelegation\.enabled[\s\S]*body\.autoApprove !== false[\s\S]*body\.direct !== false[\s\S]*body\.pending !== true/);
  assert.match(functionBody(serverJs, "threadTaskCardThreadCallIdempotencyKey"), /body\.requestId \|\| body\.request_id/);
  assert.match(functionBody(serverJs, "threadTaskCardThreadCallIdempotencyKey"), /reasoningEffort: normalizeThreadTaskCardReasoningEffort/);
  assert.doesNotMatch(functionBody(serverJs, "threadTaskCardThreadCallIdempotencyKey"), /body\.sourceTurnId \|\| body\.turnId/);
  assert.match(functionBody(serverJs, "dynamicToolTextResponse"), /success/);
  assert.match(functionBody(serverJs, "dynamicToolTextResponse"), /contentItems:\s*\[/);
  assert.match(functionBody(serverJs, "dynamicToolTextResponse"), /type: "inputText"/);
  assert.doesNotMatch(functionBody(serverJs, "dynamicToolTextResponse"), /content_items|input_text|\bcontent:\s*\[|type: "text"/);
  assert.match(functionBody(serverJs, "workspaceDelegationDynamicToolSpec"), /Mandatory boundary when this tool is available/);
  assert.match(functionBody(serverJs, "workspaceDelegationDynamicToolSpec"), /call this tool before doing that work/);
  assert.match(functionBody(serverJs, "workspaceDelegationDynamicToolSpec"), /Do not inspect, cd into, edit, patch, run commands in, test, deploy/);
  assert.match(functionBody(serverJs, "workspaceDelegationDynamicToolSpec"), /failed with sandbox, filesystem, permission denied, operation not permitted, cwd, or approval-policy errors/);
  assert.match(functionBody(serverJs, "workspaceDelegationDynamicToolSpec"), /do not retry locally or merely report blocked/);
  assert.match(functionBody(serverJs, "workspaceDelegationDynamicToolSpec"), /source model must call this tool/);
  assert.match(functionBody(serverJs, "workspaceDelegationDynamicToolSpec"), /The model must decide from the user's request whether delegation is required/);
  assert.match(functionBody(serverJs, "workspaceDelegationDynamicToolSpec"), /always creates source-direct cards/);
  assert.match(functionBody(serverJs, "workspaceDelegationDynamicToolSpec"), /Archived, deleted, hidden, subagent, or non-detail-readable targetThreadId values are rejected/);
  assert.match(functionBody(serverJs, "workspaceDelegationDynamicToolSpec"), /Several normal threads may share the same cwd\/workspace/);
  assert.match(functionBody(serverJs, "workspaceDelegationDynamicToolSpec"), /reasoningEffort/);
  assert.match(functionBody(serverJs, "workspaceDelegationDynamicToolSpec"), /REASONING_EFFORT_OPTIONS/);
  assert.match(functionBody(serverJs, "workspaceDelegationDynamicToolSpec"), /pluginId/);
  assert.match(functionBody(serverJs, "workspaceDelegationDynamicToolSpec"), /replyToThreadId/);
  assert.match(functionBody(serverJs, "workspaceDelegationDynamicToolSpec"), /multi-hop supplement/);
  assert.match(functionBody(serverJs, "applyHomeAiDeployLaneRoutingPolicy"), /expectedDeployLaneTitle/);
  assert.doesNotMatch(functionBody(serverJs, "workspaceDelegationDynamicToolSpec"), /latest visible canonical thread/);
  assert.doesNotMatch(functionBody(serverJs, "workspaceDelegationDynamicToolSpec"), /pending:\s*\{/);
  assert.match(functionBody(serverJs, "taskCardReturnDynamicToolSpec"), /A plain final answer in the target thread is not a source-thread return card/);
  assert.match(functionBody(serverJs, "taskCardReturnDynamicToolSpec"), /Task card id/);
  assert.match(functionBody(serverJs, "taskCardRuntimeDynamicTools"), /taskCardReturnDynamicToolSpec\(\)/);
  assert.match(functionBody(serverJs, "taskCardRuntimeDynamicTools"), /workspaceDelegationPublicSettings\(settings\)\.enabled/);
  assert.match(functionBody(serverJs, "workspaceDelegationDynamicToolBody"), /body\.direct = true/);
  assert.match(functionBody(serverJs, "workspaceDelegationDynamicToolBody"), /body\.autoApprove = true/);
  assert.match(functionBody(serverJs, "workspaceDelegationDynamicToolBody"), /body\.pending = false/);
  assert.doesNotMatch(functionBody(serverJs, "workspaceDelegationDynamicToolBody"), /params\.callId \|\| params\.call_id/);
  assert.match(functionBody(serverJs, "attachWorkspaceDelegationRuntimeGuidance"), /attachTaskCardRuntimeDynamicTools\(params, settings\)/);
  assert.match(functionBody(serverJs, "attachWorkspaceDelegationRuntimeGuidance"), /taskCardReturnScriptFallbackInstruction\(params\)/);
  assert.match(functionBody(serverJs, "attachWorkspaceDelegationRuntimeGuidance"), /workspaceDelegationScriptFallbackInstruction\(params\)/);
  assert.match(functionBody(serverJs, "taskCardReturnScriptFallbackInstruction"), /return-thread-task-card\.js/);
  assert.match(functionBody(serverJs, "taskCardReturnScriptFallbackInstruction"), /local final answer in the target thread is not a source-thread return card/);
  assert.match(functionBody(serverJs, "workspaceDelegationScriptFallbackInstruction"), /create-thread-task-card\.js/);
  assert.match(functionBody(serverJs, "workspaceDelegationScriptFallbackInstruction"), /deferred tool discovery such as `tool_search`/);
  assert.match(functionBody(serverJs, "workspaceDelegationScriptFallbackInstruction"), /first-class fallback path/);
  assert.match(functionBody(serverJs, "workspaceDelegationScriptFallbackInstruction"), /multi_agent_v1\.spawn_agent/);
  assert.match(functionBody(serverJs, "workspaceDelegationScriptFallbackInstruction"), /must not be used as a substitute/);
  assert.match(functionBody(serverJs, "applyStartThreadRuntimeSettings"), /attachWorkspaceDelegationRuntimeGuidance\(params\)/);
  assert.match(functionBody(serverJs, "applyTurnRuntimeSettings"), /attachWorkspaceDelegationRuntimeGuidance\(params\)/);
  assert.match(functionBody(serverJs, "sendRpc"), /const serializedPayload = JSON\.stringify\(payload\)/);
  assert.match(functionBody(serverJs, "sendRpc"), /logWorkspaceDelegationRpc\(method, params\);[\s\S]*this\.ws\.send\(serializedPayload\)/);
  assert.match(functionBody(serverJs, "handleServerRequest"), /msg\.method === "item\/tool\/call"[\s\S]*answerDynamicToolServerRequest\(request\)/);
  assert.match(functionBody(serverJs, "dynamicToolServerRequestResponsePayload"), /createThreadTaskCardsFromSourceThread\(body\.sourceThreadId, body\)/);
  assert.match(functionBody(serverJs, "dynamicToolServerRequestResponsePayload"), /threadTaskCardService\.reply\(prepared\.taskCardId, prepared\.actorThreadId, prepared\.body\)/);
  assert.match(functionBody(serverJs, "dynamicToolServerRequestResponsePayload"), /TASK_CARD_RETURN_TOOL_FULL_NAME/);
  assert.match(functionBody(serverJs, "dynamicToolServerRequestResponsePayload"), /replyCardTerminal: Boolean/);
  assert.match(functionBody(serverJs, "dynamicToolServerRequestResponsePayload"), /replyCardRequiresReturn: Boolean/);
  assert.match(functionBody(serverJs, "dynamicToolServerRequestResponsePayload"), /replyCardAckPolicy:/);
  assert.match(functionBody(serverJs, "dynamicToolServerRequestResponsePayload"), /forcedDirect: true/);
  assert.match(functionBody(serverJs, "taskCardReturnDynamicToolBody"), /returnToSource: true/);
  assert.match(functionBody(serverJs, "taskCardReturnDynamicToolBody"), /const status = normalizedTaskCardReturnStatus/);
  assert.match(functionBody(serverJs, "threadTaskCardThreadCallIdempotencyKey"), /replyToThreadId/);
  assert.match(functionBody(serverJs, "dynamicToolServerRequestResponsePayload"), /logWorkspaceDelegationDynamicToolCall\(request, params, args, \{[\s\S]*outcome: "ok"/);
  assert.match(functionBody(serverJs, "dynamicToolServerRequestResponsePayload"), /outcome: "unsupported_dynamic_tool"/);
  assert.match(functionBody(serverJs, "dynamicToolServerRequestResponsePayload"), /outcome: "source_thread_id_required"/);
  assert.match(functionBody(serverJs, "dynamicToolServerRequestResponsePayload"), /outcome: "target_thread_required"/);
  assert.match(functionBody(serverJs, "workspaceDelegationRpcDiagnostics"), /dynamicToolsCount: toolNames\.length/);
  assert.match(functionBody(serverJs, "workspaceDelegationRpcDiagnostics"), /hasWorkspaceDelegationTool: toolNames\.includes\(WORKSPACE_DELEGATION_TOOL_FULL_NAME\)/);
  assert.match(functionBody(serverJs, "workspaceDelegationRpcDiagnostics"), /hasFallbackGuidance:/);
  assert.match(functionBody(serverJs, "workspaceDelegationRpcDiagnostics"), /developerInstructionsChars:/);
  assert.doesNotMatch(functionBody(serverJs, "workspaceDelegationRpcDiagnostics"), /developerInstructions:\s/);
  assert.match(functionBody(serverJs, "workspaceDelegationDynamicToolCallDiagnostics"), /targetRefCount: threadTaskCardTargetReferences\(args\)\.length/);
  assert.match(functionBody(serverJs, "workspaceDelegationDynamicToolCallDiagnostics"), /hasBody: Boolean/);
  assert.doesNotMatch(functionBody(serverJs, "workspaceDelegationDynamicToolCallDiagnostics"), /bodyMarkdown:[\s\S]*args\.bodyMarkdown/);
  assert.match(routingServiceJs, /targetWorkspace/);
  assert.match(routingServiceJs, /targetCwd/);
  assert.match(routingServiceJs, /canonicalTargetForCwd\(rawPath, visibleThreads\)/);
  assert.match(workspaceDelegationRoute, /details: err\.details/);
  assert.match(serverJs, /"item\/tool\/call"/);
  assert.match(serverJs, /const service = options\.threadTaskCardService \|\| threadTaskCardService/);
  assert.match(serverJs, /service\.approveFromSource\(card\.id, payload\.sourceThreadId\)/);
  assert.match(serverJs, /direct: autoApprove/);
  assert.match(serverJs, /workspaceDelegationEnabled: workspaceDelegation\.enabled/);
  assert.match(serverJs, /workspaceDelegation,\s+hermesPlugin:/);
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
  assert.match(functionBody(serverJs, "taskCardReturnDynamicToolSpec"), /rejected/);
  assert.match(functionBody(serverJs, "taskCardReturnDynamicToolSpec"), /partially_completed/);
});

test("thread task card routes preserve service status codes", () => {
  const routeBlock = serverJs.slice(
    serverJs.indexOf('if (url.pathname === "/api/thread-task-cards" && req.method === "POST")'),
    serverJs.indexOf('if (url.pathname === "/api/workspaces" && req.method === "GET")'),
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
  assert.match(serverJs, /maybeAutoReplyThreadTaskCard\(msg\.method, msg\.params \|\| null\)/);
  const statusPreservingErrors = routeBlock.match(/sendJson\(res, err\.statusCode \|\| 500, \{ ok: false, error: err\.message \|\| String\(err\) \}\);/g) || [];
  assert.equal(statusPreservingErrors.length, 8);
});

test("approved task cards inherit target thread model and effort", () => {
  const setupBlock = serverJs.slice(
    serverJs.indexOf("const threadTaskCardService = createThreadTaskCardService"),
    serverJs.indexOf("const PUSH_VAPID_FILE"),
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
  assert.match(functionBody(serverJs, "applyTurnRuntimeSettings"), /if \(settings\.reasoningEffort\) params\.effort = settings\.reasoningEffort;/);
  assert.match(functionBody(serverJs, "applyTurnRuntimeSettings"), /if \(settings\.model\) params\.model = settings\.model;/);
});

test("approved task-card deploy lane runtime uses visible target metadata when stored summary is sparse", () => {
  const helperBody = functionBody(serverJs, "readThreadTaskCardExecutionTargetSummary");
  assert.match(helperBody, /const stored = readThreadTaskCardTargetSummary\(threadId\) \|\| null;/);
  assert.match(helperBody, /const visible = readThreadTaskCardVisibleTargetSummary\(threadId\) \|\| null;/);
  assert.match(helperBody, /Object\.assign\(\{\}, target, visible \|\| \{\}, stored \|\| \{\}\)/);
  assert.match(helperBody, /if \(!String\(merged\.cwd \|\| ""\)\.trim\(\) && targetWorkspace\) merged\.cwd = targetWorkspace;/);
  assert.match(helperBody, /const visibleTitle = String\(visible && \(visible\.name \|\| visible\.title/);
  assert.match(functionBody(serverJs, "readThreadTaskCardVisibleTargetSummary"), /threadTaskCardVisibleTargetThreads\(\)/);
});

test("server broadcasts lightweight thread status for background turn notifications", () => {
  const broadcastBody = functionBody(serverJs, "broadcast");
  assert.match(broadcastBody, /threadStatusChangedPayloadFromTurnNotification\(payload\)/);
  assert.match(broadcastBody, /applyThreadStatusPayloadToThreadListFallbackCache\(statusPayload\);\s*broadcast\(statusPayload\);/);

  const statusPayloadBody = functionBody(serverJs, "threadStatusChangedPayloadFromTurnNotification");
  assert.match(statusPayloadBody, /method !== "turn\/started" && method !== "turn\/completed"/);
  assert.match(statusPayloadBody, /method === "turn\/started"[\s\S]*\{ type: "active" \}/);
  assert.match(statusPayloadBody, /turn\.status \|\| payload\.params\.status \|\| \{ type: "completed" \}/);

  const eventFilterBody = functionBody(serverJs, "shouldSendEventToClient");
  assert.match(eventFilterBody, /payload\.method === "thread\/status\/changed"[\s\S]*return true;/);
  assert.match(functionBody(serverJs, "broadcastThreadStatusChanged"), /applyThreadStatusPayloadToThreadListFallbackCache\(payload\);\s*broadcast\(payload\);/);
});

test("server broadcasts active status immediately for local turn starts", () => {
  const helperBody = functionBody(serverJs, "notifyLocalTurnStarted");
  assert.match(helperBody, /const turnId = turnStartResultTurnId\(result\)/);
  assert.match(helperBody, /rememberLocalActiveThreadStatus\(id, turnId/);
  assert.match(helperBody, /threadDetailProjectionService\.applyNotification\("turn\/started"/);
  assert.match(helperBody, /broadcastThreadStatusChanged\(id, \{ type: "active" \}/);
  assert.match(helperBody, /source: String\(meta\.source \|\| "local-turn-start"\)/);

  assert.match(serverJs, /const localActiveThreadStatuses = new Map\(\);/);
  assert.match(serverJs, /function applyLocalActiveThreadStatusToSummary\(/);
  assert.match(serverJs, /function updateLocalActiveThreadStatusFromNotification\(/);
  assert.match(functionBody(serverJs, "broadcast"), /updateLocalActiveThreadStatusFromNotification\(payload\)/);
  assert.match(functionBody(serverJs, "prepareThreadDetailResponseResult"), /applyLocalActiveThreadStatusToResult/);
  assert.match(functionBody(serverJs, "normalizeThreadListResultStatuses"), /normalizeThreadSummaryLiveStatus/);

  assert.match(serverJs, /notifyLocalTurnStarted\(card\.target\.threadId, result, \{[\s\S]*source: "thread-task-card-approval"/);
  assert.match(serverJs, /notifyLocalTurnStarted\(threadId, turnResult, \{ source: "message-submit" \}\)/);
  assert.match(serverJs, /notifyLocalTurnStarted\(threadId, turnResult, \{ source: "new-thread-message" \}\)/);
  assert.match(serverJs, /notifyLocalTurnStarted\(id, result, \{ source: "auto-turn-recovery" \}\)/);
  assert.match(serverJs, /notifyLocalTurnStarted\(threadId, result, \{ source: "side-chat-apply" \}\)/);
  assert.match(serverJs, /notifyLocalTurnStarted\(threadId, result, \{ source: "continuation-source-handoff" \}\)/);
  assert.match(serverJs, /notifyLocalTurnStarted\(threadId, bootstrap, \{ source: "continuation-bootstrap" \}\)/);
});

test("server materializes structured task-card drafts from thread detail", () => {
  assert.match(serverJs, /const THREAD_TASK_CARD_DRAFT_TAG = "codex-mobile-thread-task-card-draft"/);
  assert.match(serverJs, /const THREAD_TASK_CARD_BODY_MAX_CHARS = 8_000/);
  assert.match(serverJs, /const THREAD_TASK_CARD_DRAFT_TURN_LOOKBACK = 4/);
  assert.match(serverJs, /function parseThreadTaskCardDraftText\(/);
  assert.match(serverJs, /function truncateThreadTaskCardBody\(/);
  assert.match(serverJs, /function materializeThreadTaskCardDraftsForThread\(/);
  assert.match(serverJs, /function maybeMaterializeThreadTaskCardDrafts\(/);
  assert.match(serverJs, /function prepareThreadTaskCardsToResult\(/);
  assert.match(functionBody(serverJs, "maybeMaterializeThreadTaskCardDrafts"), /method !== "turn\/completed"/);
  assert.match(functionBody(serverJs, "maybeMaterializeThreadTaskCardDrafts"), /codex\.request\("thread\/turns\/list"/);
  assert.match(functionBody(serverJs, "maybeMaterializeThreadTaskCardDrafts"), /await materializeThreadTaskCardDraftsForThread\(thread\)/);
  assert.match(functionBody(serverJs, "materializeThreadTaskCardDraftsForThread"), /const itemText = threadTaskCardItemText\(item\);/);
  assert.match(functionBody(serverJs, "materializeThreadTaskCardDraftsForThread"), /if \(!itemText\.includes\(THREAD_TASK_CARD_DRAFT_TAG\)\) continue;/);
  assert.match(functionBody(serverJs, "materializeThreadTaskCardDraftsForThread"), /const draft = parseThreadTaskCardDraftText\(itemText\);/);
  assert.match(functionBody(serverJs, "materializeThreadTaskCardDraftsForThread"), /readStateDbThread\(targetThreadId\) \|\| readStartedThread\(targetThreadId\)/);
  assert.match(functionBody(serverJs, "materializeThreadTaskCardDraftsForThread"), /const body = truncateThreadTaskCardBody\(draft\.body\)/);
  assert.match(functionBody(serverJs, "materializeThreadTaskCardDraftsForThread"), /threadTaskCardService\.createMany/);
  assert.match(functionBody(serverJs, "materializeThreadTaskCardDraftsForThread"), /threadTaskCardDraftIdempotencyKey\(sourceThreadId, turnId, draft\)/);
  assert.doesNotMatch(functionBody(serverJs, "materializeThreadTaskCardDraftsForThread"), /body: draft\.body/);
  assert.match(functionBody(serverJs, "prepareThreadTaskCardsToResult"), /await materializeThreadTaskCardDraftsForThread\(result\.thread\)/);
  assert.match(functionBody(serverJs, "prepareThreadTaskCardsToResult"), /attachThreadTaskCardsToResult\(result\)/);
  assert.match(functionBody(serverJs, "prepareThreadTaskCardsToResult"), /attachPendingServerRequestsToResult/);
  assert.doesNotMatch(functionBody(serverJs, "prepareThreadTaskCardsToResult"), /prepareThreadTaskCardsToResult\(result\)/);
  assert.match(functionBody(serverJs, "prepareThreadDetailResponseResult"), /const completionBackfilled = backfillMissingRolloutCompletionTurnsForDetailResult\(result, details\);/);
  assert.match(functionBody(serverJs, "prepareThreadDetailResponseResult"), /const usageDecorated = attachRolloutUsageSummariesToDetailResult\(completionBackfilled\);/);
  assert.match(functionBody(serverJs, "prepareThreadDetailResponseResult"), /const inputAnchored = appendRolloutUserInputAnchorsToDetailResult\(usageDecorated\);/);
  assert.match(functionBody(serverJs, "prepareThreadDetailResponseResult"), /const activeAssistantDecorated = appendRolloutActiveAssistantItemsToDetailResult\(inputAnchored\);/);
  assert.match(functionBody(serverJs, "prepareThreadDetailResponseResult"), /const detailResult = finalizeActiveAssistantProjectionDetailResult\(activeAssistantDecorated\);/);
  assert.match(functionBody(serverJs, "prepareThreadDetailResponseResult"), /await prepareThreadTaskCardsToResult\(applyLocalActiveThreadStatusToResult\(detailResult, details\)\)/);
  assert.match(functionBody(serverJs, "prepareThreadDetailResponseResult"), /finalizeThreadDetailProjectionResult/);
  assert.match(functionBody(serverJs, "turnsListThreadReadResult"), /return prepareThreadDetailResponseResult\(result/);
  assert.match(serverJs, /maybeMaterializeThreadTaskCardDrafts\(msg\.method, msg\.params \|\| null\)/);
  assert.match(serverJs, /prepareResponse: prepareThreadDetailResponseResult/);
  assert.match(serverJs, /threadDetailReadOrchestrationService\.readThreadDetail/);
  assert.match(serverJs, /handleThreadDetailReadRoute\(\{/);
  assert.match(threadDetailRouteServiceJs, /const preferRecentTurns = detailModeFromUrl\(url\) === "recent"/);
  assert.match(threadDetailRouteServiceJs, /sendJson\(status, body\)/);
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
