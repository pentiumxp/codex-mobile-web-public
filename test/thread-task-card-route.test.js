"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const serverJs = fs.readFileSync(path.resolve(__dirname, "..", "server.js"), "utf8");
const appJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "app.js"), "utf8");

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
  const statusPreservingErrors = routeBlock.match(/sendJson\(res, err\.statusCode \|\| 500, \{ ok: false, error: err\.message \|\| String\(err\) \}\);/g) || [];
  assert.equal(statusPreservingErrors.length, 6);
});

test("conversation render includes task card signature, toolbar, and action handlers", () => {
  assert.match(appJs, /CLIENT_BUILD_ID = "0\.1\.11\|codex-mobile-shell-v142"/);
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
  assert.match(appJs, /function buildThreadTaskCardDraftRequestText\(/);
  assert.match(appJs, /targetThreadIds/);
  assert.match(appJs, /workflowMode/);
  assert.match(appJs, /Approve workflow/);
  assert.match(appJs, /function parseThreadTaskCardDraftText\(/);
  assert.match(appJs, /function renderPendingThreadTaskCardDraft\(/);
  assert.match(appJs, /function renderTurnThreadTaskCardDraft\(/);
  assert.match(appJs, /function waitForCurrentThreadTurn\(/);
  assert.match(appJs, /function renderThreadTaskCardDraft\(/);
  assert.match(appJs, /function threadTaskCardDraftKeyForDraft\(/);
  assert.match(appJs, /function threadTaskCardDraftPayloadKey\(/);
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
