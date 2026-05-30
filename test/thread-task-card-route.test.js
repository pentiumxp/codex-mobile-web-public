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

test("conversation render includes task card signature, toolbar, and action handlers", () => {
  assert.match(appJs, /CLIENT_BUILD_ID = "0\.1\.11\|codex-mobile-shell-v122"/);
  assert.match(appJs, /function threadTaskCardsForThread\(/);
  assert.match(appJs, /filter\(\(card\) => String\(card && card\.status \|\| ""\) === "pending"\)/);
  assert.match(appJs, /function settleCurrentThreadTaskCard\(/);
  assert.match(appJs, /settleCurrentThreadTaskCard\(id, action === "approve" \? "approved" : action === "delete" \? "deleted" : action === "revoke" \? "revoked" : "replied"/);
  assert.match(appJs, /function threadTaskCardsSignature\(/);
  assert.match(appJs, /taskCards: threadTaskCardsSignature\(thread\)/);
  assert.match(appJs, /thread-card-task-badge/);
  assert.match(appJs, /function renderThreadTaskToolbar\(/);
  assert.match(appJs, /data-create-thread-task-card/);
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
  assert.match(appJs, /function parseThreadTaskCardDraftText\(/);
  assert.match(appJs, /function renderThreadTaskCardDraft\(/);
  assert.match(appJs, /data-task-card-draft-action="approve"/);
  assert.match(appJs, /data-task-card-draft-action="dismiss"/);
  assert.match(appJs, /idempotencyKey: `task-card-draft:\$\{state\.currentThreadId\}:\$\{draftKey\}`/);
  assert.match(appJs, /Task card created; opening target thread/);
  assert.match(appJs, /state\.pendingPluginRouteHint = createdCard \? normalizePluginRouteHint\(\{/);
  assert.match(appJs, /taskId: createdCard\.id/);
  assert.match(appJs, /await loadThread\(draft\.targetThreadId, \{ source: "task-card-created" \}\)/);
  assert.match(appJs, /\$\{turnsHtml\}\$\{approvalsHtml\}\$\{taskCardsHtml\}/);
  assert.match(appJs, /Task card draft request/);
});
