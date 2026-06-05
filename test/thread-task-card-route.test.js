"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const serverJs = fs.readFileSync(path.resolve(__dirname, "..", "server.js"), "utf8");
const appJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "app.js"), "utf8");

function functionBody(source, name) {
  const start = source.indexOf(`function ${name}(`);
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

test("server exposes thread task card routes and enriches thread detail responses", () => {
  assert.match(serverJs, /createThreadTaskCardService/);
  assert.doesNotMatch(serverJs, /createThreadTaskCardIntentService/);
  assert.match(serverJs, /CODEX_MOBILE_THREAD_TASK_CARD_FILE/);
  assert.match(serverJs, /"\/api\/thread-task-cards"/);
  assert.doesNotMatch(serverJs, /"\/api\/thread-task-cards\/parse"/);
  assert.match(serverJs, /const threadTaskCardApprove = url\.pathname\.match\(/);
  assert.match(serverJs, /const threadTaskCardDelete = url\.pathname\.match\(/);
  assert.match(serverJs, /const threadTaskCardRevoke = url\.pathname\.match\(/);
  assert.match(serverJs, /const threadTaskCardReply = url\.pathname\.match\(/);
  assert.match(serverJs, /function attachThreadTaskCardsToThread\(/);
  assert.match(serverJs, /thread\.threadTaskCards = threadTaskCardService\.listForThread\(thread\.id\)/);
  assert.match(serverJs, /thread\.pendingIncomingTaskCardCount = taskCardCounts\.pendingIncoming/);
  assert.match(serverJs, /function attachThreadTaskCardCountsToThreadListResult\(/);
  assert.match(serverJs, /attachThreadTaskCardsToResult\(result\)/);
  assert.match(serverJs, /await threadTaskCardService\.approve/);
  assert.match(serverJs, /await threadTaskCardService\.reply/);
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
  assert.match(serverJs, /function maybeAutoReplyThreadTaskCard\(/);
  assert.match(serverJs, /threadTaskCardService\.maybeAutoReplyCompletedTurn/);
  assert.match(serverJs, /maybeAutoReplyThreadTaskCard\(msg\.method, msg\.params \|\| null\)/);
  const statusPreservingErrors = routeBlock.match(/sendJson\(res, err\.statusCode \|\| 500, \{ ok: false, error: err\.message \|\| String\(err\) \}\);/g) || [];
  assert.equal(statusPreservingErrors.length, 6);
});

test("approved task cards inherit target thread model and effort", () => {
  const setupBlock = serverJs.slice(
    serverJs.indexOf("const threadTaskCardService = createThreadTaskCardService"),
    serverJs.indexOf("const PUSH_VAPID_FILE"),
  );
  assert.match(setupBlock, /const runtimeSettings = await resolveThreadRuntimeSettings\(card\.target\.threadId\);/);
  assert.match(setupBlock, /thread\/resume", applyResumeRuntimeSettings\(/);
  assert.match(setupBlock, /const turnParams = applyTurnRuntimeSettings\(/);
  assert.match(setupBlock, /codex\.request\("turn\/start", turnParams/);
  assert.match(functionBody(serverJs, "applyTurnRuntimeSettings"), /if \(settings\.reasoningEffort\) params\.effort = settings\.reasoningEffort;/);
  assert.match(functionBody(serverJs, "applyTurnRuntimeSettings"), /if \(settings\.model\) params\.model = settings\.model;/);
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
  assert.match(functionBody(serverJs, "materializeThreadTaskCardDraftsForThread"), /parseThreadTaskCardDraftText\(threadTaskCardItemText\(item\)\)/);
  assert.match(functionBody(serverJs, "materializeThreadTaskCardDraftsForThread"), /readStateDbThread\(targetThreadId\) \|\| readStartedThread\(targetThreadId\)/);
  assert.match(functionBody(serverJs, "materializeThreadTaskCardDraftsForThread"), /const body = truncateThreadTaskCardBody\(draft\.body\)/);
  assert.match(functionBody(serverJs, "materializeThreadTaskCardDraftsForThread"), /threadTaskCardService\.createMany/);
  assert.match(functionBody(serverJs, "materializeThreadTaskCardDraftsForThread"), /threadTaskCardDraftIdempotencyKey\(sourceThreadId, turnId, draft\)/);
  assert.doesNotMatch(functionBody(serverJs, "materializeThreadTaskCardDraftsForThread"), /body: draft\.body/);
  assert.match(functionBody(serverJs, "prepareThreadTaskCardsToResult"), /await materializeThreadTaskCardDraftsForThread\(result\.thread\)/);
  assert.match(functionBody(serverJs, "prepareThreadTaskCardsToResult"), /return attachThreadTaskCardsToResult\(result\)/);
  assert.doesNotMatch(functionBody(serverJs, "prepareThreadTaskCardsToResult"), /prepareThreadTaskCardsToResult\(result\)/);
  assert.match(functionBody(serverJs, "turnsListThreadReadResult"), /return prepareThreadTaskCardsToResult\(result\)/);
  assert.match(serverJs, /maybeMaterializeThreadTaskCardDrafts\(msg\.method, msg\.params \|\| null\)/);
  assert.match(serverJs, /sendJson\(res, 200, await prepareThreadTaskCardsToResult\(result\)\)/);
});

test("conversation render includes task card signature, toolbar, and action handlers", () => {
  assert.match(appJs, /CLIENT_BUILD_ID = "0\.1\.11\|codex-mobile-shell-v186"/);
  assert.match(appJs, /function threadTaskCardsForThread\(/);
  assert.match(appJs, /filter\(\(card\) => String\(card && card\.status \|\| ""\) === "pending"\)/);
  assert.match(appJs, /filter\(\(card\) => String\(card && card\.threadRole \|\| ""\) === "target"\)/);
  assert.match(appJs, /function settleCurrentThreadTaskCard\(/);
  assert.match(appJs, /settledCard\.threadRole === "target"/);
  assert.match(appJs, /settledCard\.threadRole === "source"/);
  assert.match(appJs, /settleCurrentThreadTaskCard\(id, action === "approve" \? "approved" : action === "delete" \? "deleted" : action === "revoke" \? "revoked" : "replied"/);
  assert.match(appJs, /function threadTaskCardsSignature\(/);
  assert.match(appJs, /taskCards: threadTaskCardsSignature\(thread\)/);
  assert.match(appJs, /thread-card-task-badge/);
  assert.match(appJs, /function renderThreadTaskToolbar\(/);
  assert.match(appJs, /data-create-thread-task-card/);
  assert.match(appJs, /function openContinuationDialog\(/);
  assert.match(appJs, /function closeContinuationDialog\(/);
  assert.match(appJs, /if \(\$\("continuationDialog"\)\) \$\("continuationDialog"\)\.addEventListener\("click"/);
  assert.match(appJs, /function renderThreadTaskCards\(/);
  assert.match(appJs, /data-task-card=/);
  assert.match(appJs, /data-task-card-action="approve"/);
  assert.match(appJs, /data-task-card-action="reply"/);
  assert.match(appJs, /data-task-card-action="delete"/);
  assert.match(appJs, /data-task-card-action="revoke"/);
  assert.match(appJs, /function createThreadTaskCardFromCurrent\(/);
  assert.match(appJs, /function mutateThreadTaskCard\(/);
  assert.match(appJs, /function replyTaskCard\(/);
  assert.match(appJs, /function isThreadTaskCardCommandText\(/);
  assert.match(functionBody(appJs, "sendMessage"), /const steering = Boolean\(!threadTaskCardCommand && state\.activeTurnId && hasContent\);/);
  assert.match(appJs, /const THREAD_TASK_CARD_COMMAND_PREFIX = "#自由协作"/);
  assert.match(functionBody(appJs, "isThreadTaskCardCommandText"), /startsWith\(THREAD_TASK_CARD_COMMAND_PREFIX\)/);
  assert.doesNotMatch(functionBody(appJs, "isThreadTaskCardCommandText"), /startsWith\("#"\)/);
  assert.match(functionBody(appJs, "threadTaskCardCommandText"), /text\.slice\(THREAD_TASK_CARD_COMMAND_PREFIX\.length\)/);
  assert.match(appJs, /function buildThreadTaskCardDraftRequestText\(/);
  assert.match(appJs, /targetThreadIds/);
  assert.match(appJs, /workflowMode/);
  assert.match(appJs, /Approve workflow/);
  assert.match(functionBody(appJs, "buildThreadTaskCardDraftRequestText"), /#自由协作 command/);
  assert.match(functionBody(appJs, "buildThreadTaskCardDraftRequestText"), /Default workflowMode to autonomous for #自由协作/);
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
  assert.match(appJs, /matchingThreadTaskCardsForDraft\(draft, turn\)/);
  assert.match(appJs, /function renderThreadTaskCardExpandable\(/);
  assert.match(appJs, /const STORAGE_TASK_CARD_DRAFT_STATES = "codexMobileThreadTaskCardDraftStates"/);
  assert.match(appJs, /THREAD_TASK_CARD_DRAFT_CREATE_STALE_MS/);
  assert.match(appJs, /THREAD_TASK_CARD_DRAFT_CREATE_MAX_ATTEMPTS/);
  assert.match(appJs, /activeThreadTaskCardDraftCreations: new Set\(\)/);
  assert.match(appJs, /function isThreadTaskCardDraftCreationStale\(/);
  assert.match(appJs, /function saveThreadTaskCardDraftStates\(\)/);
  assert.match(appJs, /function queueThreadTaskCardDraftCreation\(/);
  assert.match(appJs, /state\.activeThreadTaskCardDraftCreations\.has\(key\)/);
  assert.match(appJs, /function createThreadTaskCardDraft\(/);
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
  assert.match(appJs, /idempotencyKey: `task-card-draft:\$\{state\.currentThreadId\}:\$\{draftKey\}`/);
  assert.match(appJs, /Task card created; opening target thread/);
  assert.match(appJs, /Task cards created: \$\{createdCards\.length\}/);
  assert.match(appJs, /state\.pendingPluginRouteHint = createdCards\.length === 1 \? normalizePluginRouteHint\(\{/);
  assert.match(appJs, /taskId: createdCards\[0\]\.id/);
  assert.match(appJs, /if \(createdCards\.length === 1\) \{/);
  assert.match(appJs, /if \(draftState\.status === "created" \|\| draftState\.status === "dismissed"\) return "";/);
  assert.match(appJs, /conversation\.querySelector\(`\[data-turn="\$\{escapeSelectorAttr\(targetId\)\}"\]`\)/);
  assert.match(appJs, /Task card approved; starting target turn/);
  assert.match(appJs, /\$\{items\}\$\{approvalsHtml\}[\s\S]*\$\{showStatusLine \? [\s\S]*: ""\}[\s\S]*\$\{draftHtml\}\$\{pendingDraftHtml\}/);
  assert.match(appJs, /\$\{turnsHtml\}\$\{approvalsHtml\}\$\{taskCardsHtml\}/);
  assert.match(appJs, /Task card draft request/);
});
