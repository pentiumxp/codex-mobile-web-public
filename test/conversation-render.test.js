"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const appJs = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
const serverJs = fs.readFileSync(path.join(root, "server.js"), "utf8");
const stylesCss = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");

function functionBodyFrom(source, name) {
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

function functionSourceFrom(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const body = functionBodyFrom(source, name);
  const open = source.indexOf("{", start);
  return `${source.slice(start, open + 1)}${body}}`;
}

function functionBody(name) {
  return functionBodyFrom(appJs, name);
}

function serverFunctionBody(name) {
  return functionBodyFrom(serverJs, name);
}

function evaluatedAttachmentSummaryParser() {
  const sources = [
    "attachmentSummaryMarkerMatch",
    "stripAttachmentSummaryLinePrefix",
    "parseAttachmentLine",
    "splitAttachmentSummaryText",
  ].map((name) => functionSourceFrom(appJs, name));
  return Function(`${sources.join("\n")}\nreturn splitAttachmentSummaryText;`)();
}

function evaluatedInputContentRenderer() {
  return evaluatedInputContentRendererWithKey("");
}

function evaluatedInputContentRendererWithKey(key = "") {
  const sources = [
    "escapeHtml",
    "shortPath",
    "threadTaskCardRequestMarkerMatch",
    "visibleThreadTaskCardCommandText",
    "imageUrlValue",
    "isInputTextPart",
    "inputTextValue",
    "isTruncatedImagePayloadPart",
    "isInputImagePart",
    "attachmentSummaryMarkerMatch",
    "stripAttachmentSummaryLinePrefix",
    "parseAttachmentLine",
    "splitAttachmentSummaryText",
    "normalizeFsPath",
    "isCodexMobileUploadPath",
    "isLikelyAbsoluteLocalPath",
    "canRenderImageAttachment",
    "authenticatedApiContentUrl",
    "uploadFileUrl",
    "localFilePreviewContentUrl",
    "imageContentUrlForPath",
    "localAttachmentPreviewUrl",
    "imageSourceForPart",
    "compactStructuredForSignature",
    "renderInputText",
    "renderInputImage",
    "renderInputAttachment",
    "renderAttachmentSummary",
    "renderInputContent",
  ].map((name) => functionSourceFrom(appJs, name));
  return Function(
    "URLSearchParams",
    `const state = { key: ${JSON.stringify(String(key || ""))} };\nconst THREAD_TASK_CARD_REQUEST_TAG = "codex-mobile-thread-task-card-request";\n${sources.join("\n")}\nreturn renderInputContent;`,
  )(URLSearchParams);
}

function evaluatedImageViewRenderer() {
  const sources = [
    "escapeHtml",
    "shortPath",
    "normalizeFsPath",
    "isCodexMobileUploadPath",
    "uploadFileUrl",
    "authenticatedApiContentUrl",
    "localFilePreviewContentUrl",
    "imageContentUrlForPath",
    "imageViewPath",
    "imageViewUrl",
    "imageViewContentUrl",
    "renderImageView",
  ].map((name) => functionSourceFrom(appJs, name));
  return Function(
    "URLSearchParams",
    `const state = { key: "test-key", currentThreadId: "thread-id" };\n${sources.join("\n")}\nreturn renderImageView;`,
  )(URLSearchParams);
}

function evaluatedConversationImageErrorHandler() {
  const sources = [
    "failedAppImageContainer",
    "markFailedAppImage",
    "handleConversationImageError",
  ].map((name) => functionSourceFrom(appJs, name));
  return Function(`${sources.join("\n")}\nreturn handleConversationImageError;`)();
}

function evaluatedFailedImageScanner() {
  const sources = [
    "failedAppImageContainer",
    "markFailedAppImage",
    "scanFailedAppImages",
  ].map((name) => functionSourceFrom(appJs, name));
  return Function(`${sources.join("\n")}\nreturn scanFailedAppImages;`)();
}

function evaluatedTokenUsageSummaryText() {
  const sources = [
    "formatTokenCount",
    "formatCompactTokenCount",
    "tokenUsageSummaryText",
  ].map((name) => functionSourceFrom(appJs, name));
  return Function(`${sources.join("\n")}\nreturn tokenUsageSummaryText;`)();
}

function evaluatedUserMessagesLikelySame() {
  const sources = [
    "normalizeFsPath",
    "imageUrlValue",
    "isInputTextPart",
    "inputTextValue",
    "isTruncatedImagePayloadPart",
    "isInputImagePart",
    "attachmentSummaryMarkerMatch",
    "stripAttachmentSummaryLinePrefix",
    "parseAttachmentLine",
    "splitAttachmentSummaryText",
    "isMuxUserMessage",
    "isOptimisticUserMessage",
    "isTurnUsageSummaryItem",
    "normalizeComparableText",
    "userMessageComparableParts",
    "userMessagePathOverlap",
    "comparablePathName",
    "userMessagePathNameOverlap",
    "userMessagesLikelySame",
  ].map((name) => functionSourceFrom(appJs, name));
  return Function(`${sources.join("\n")}\nreturn userMessagesLikelySame;`)();
}

function evaluatedMergeItemsPreservingLocalVisible() {
  const sources = [
    "normalizeFsPath",
    "imageUrlValue",
    "isInputTextPart",
    "inputTextValue",
    "isTruncatedImagePayloadPart",
    "isInputImagePart",
    "attachmentSummaryMarkerMatch",
    "stripAttachmentSummaryLinePrefix",
    "parseAttachmentLine",
    "splitAttachmentSummaryText",
    "isMuxUserMessage",
    "isOptimisticUserMessage",
    "isTurnUsageSummaryItem",
    "normalizeComparableText",
    "userMessageComparableParts",
    "userMessagePathOverlap",
    "comparablePathName",
    "userMessagePathNameOverlap",
    "userMessageSpecificity",
    "userMessagesLikelySame",
    "userMessagesCanShadow",
    "hasMatchingIncomingUserMessage",
    "hasMatchingRealUserMessage",
    "removeShadowedMuxUserMessages",
    "userMessageShadowPriority",
    "mergeLikelySameUserMessage",
    "dedupeLikelySameUserMessages",
    "comparableVisibleTextItem",
    "comparableVisibleText",
    "visibleTextItemsLikelySame",
    "hasMatchingIncomingVisibleItem",
    "mergeVisibleTextItemPreservingRenderIdentity",
    "mergeItemsPreservingLocalVisible",
  ].map((name) => functionSourceFrom(appJs, name));
  return Function(`
function itemVisibleWeight(item) { return JSON.stringify(item || {}).length; }
function shouldPreserveLocalOnlyItem(item, preserveLocalVisible = false) {
  if (!item || itemVisibleWeight(item) <= 0) return false;
  if (item.type === "userMessage" && /^mux-user-/.test(String(item.id || ""))) return true;
  return preserveLocalVisible;
}
function mergeItemPreservingVisibleFields(existingItem, incomingItem) {
  return Object.assign({}, existingItem || {}, incomingItem || {});
}
function dedupeTurnUsageSummaryItems(items) { return items || []; }
${sources.join("\n")}
return mergeItemsPreservingLocalVisible;
	`)();
}

function evaluatedMergeThreadPreservingVisibleItems() {
  const sources = [
    "normalizeFsPath",
    "imageUrlValue",
    "isInputTextPart",
    "inputTextValue",
    "isTruncatedImagePayloadPart",
    "isInputImagePart",
    "attachmentSummaryMarkerMatch",
    "stripAttachmentSummaryLinePrefix",
    "parseAttachmentLine",
    "splitAttachmentSummaryText",
    "isMuxUserMessage",
    "isOptimisticUserMessage",
    "isTurnUsageSummaryItem",
    "normalizeComparableText",
    "userMessageComparableParts",
    "userMessagePathOverlap",
    "comparablePathName",
    "userMessagePathNameOverlap",
    "userMessageSpecificity",
    "userMessagesLikelySame",
    "userMessagesCanShadow",
    "hasMatchingIncomingUserMessage",
    "hasMatchingRealUserMessage",
    "removeShadowedMuxUserMessages",
    "userMessageShadowPriority",
    "mergeLikelySameUserMessage",
    "dedupeLikelySameUserMessages",
    "normalizeThreadVisibleUserMessages",
    "threadDurableUserMessages",
    "shouldDropInitialSubmissionEchoTurn",
    "threadHasInitialSubmissionEcho",
    "comparableVisibleTextItem",
    "comparableVisibleText",
    "visibleTextItemsLikelySame",
    "hasMatchingIncomingVisibleItem",
    "mergeVisibleTextItemPreservingRenderIdentity",
    "mergeItemsPreservingLocalVisible",
    "mergeTurnPreservingVisibleItems",
    "mergeThreadPreservingVisibleItems",
  ].map((name) => functionSourceFrom(appJs, name));
  return Function(`
const MAX_EXPANDED_VISIBLE_TURNS = 40;
const state = { activeTurnId: "local-start-turn" };
function isReasoningItem(item) { return Boolean(item && item.type === "reasoning"); }
function itemVisibleWeight(item) { return item ? JSON.stringify(item).length : 0; }
function shouldPreserveLocalOnlyItem(item, preserveLocalVisible = false) {
  if (!item || itemVisibleWeight(item) <= 0) return false;
  if (item.type === "userMessage" && /^mux-user-/.test(String(item.id || ""))) return true;
  return preserveLocalVisible && !isReasoningItem(item);
}
function mergeItemPreservingVisibleFields(existingItem, incomingItem) {
  return Object.assign({}, existingItem || {}, incomingItem || {});
}
function turnVisibleWeight(turn) {
  return (turn && Array.isArray(turn.items) ? turn.items : []).reduce((total, item) => total + itemVisibleWeight(item), 0);
}
function isTurnComplete(turn) {
  const text = String(turn && (turn.status && turn.status.type || turn.status) || "").toLowerCase();
  return /completed|failed|canceled|cancelled/.test(text);
}
function turnIsSupersededBy() { return false; }
function sortTurnsForDisplay(turns) { return turns || []; }
${sources.join("\n")}
return mergeThreadPreservingVisibleItems;
`)();
}

function evaluatedNormalizeThreadVisibleUserMessages() {
  const sources = [
    "normalizeFsPath",
    "imageUrlValue",
    "isInputTextPart",
    "inputTextValue",
    "isTruncatedImagePayloadPart",
    "isInputImagePart",
    "attachmentSummaryMarkerMatch",
    "stripAttachmentSummaryLinePrefix",
    "parseAttachmentLine",
    "splitAttachmentSummaryText",
    "isMuxUserMessage",
    "isOptimisticUserMessage",
    "normalizeComparableText",
    "userMessageComparableParts",
    "userMessagePathOverlap",
    "comparablePathName",
    "userMessagePathNameOverlap",
    "userMessageSpecificity",
    "userMessagesLikelySame",
    "userMessagesCanShadow",
    "hasMatchingRealUserMessage",
    "removeShadowedMuxUserMessages",
    "userMessageShadowPriority",
    "mergeLikelySameUserMessage",
    "dedupeLikelySameUserMessages",
    "normalizeThreadVisibleUserMessages",
  ].map((name) => functionSourceFrom(appJs, name));
  return Function(`
function itemVisibleWeight(item) { return JSON.stringify(item || {}).length; }
function mergeItemPreservingVisibleFields(existingItem, incomingItem) {
  return Object.assign({}, existingItem || {}, incomingItem || {});
}
${sources.join("\n")}
return normalizeThreadVisibleUserMessages;
`)();
}

function evaluatedLiveUserMessageUpsert() {
  const sources = [
    "normalizeFsPath",
    "imageUrlValue",
    "isInputTextPart",
    "inputTextValue",
    "isTruncatedImagePayloadPart",
    "isInputImagePart",
    "attachmentSummaryMarkerMatch",
    "stripAttachmentSummaryLinePrefix",
    "parseAttachmentLine",
    "splitAttachmentSummaryText",
    "isMuxUserMessage",
    "isOptimisticUserMessage",
    "isTurnUsageSummaryItem",
    "normalizeComparableText",
    "userMessageComparableParts",
    "userMessagePathOverlap",
    "comparablePathName",
    "userMessagePathNameOverlap",
    "userMessagesLikelySame",
    "userMessagesCanShadow",
    "hasMatchingRealUserMessage",
    "removeShadowedMuxUserMessages",
    "userMessageShadowPriority",
    "mergeLikelySameUserMessage",
    "dedupeLikelySameUserMessages",
    "normalizeThreadVisibleUserMessages",
    "upsertItem",
  ].map((name) => functionSourceFrom(appJs, name));
  return Function(`
const state = { currentThread: { id: "thread-1", turns: [{ id: "turn-1", items: [] }] } };
let renderCount = 0;
function ensureTurn(turnId) {
  let turn = state.currentThread.turns.find((candidate) => candidate.id === turnId);
  if (!turn) {
    turn = { id: turnId, items: [] };
    state.currentThread.turns.push(turn);
  }
  return turn;
}
function markActivity() {}
function activityLabelForItem() { return ""; }
function isReasoningItem() { return false; }
function updateTickTimer() {}
function isOperationalItem() { return false; }
function isCompletedStatus() { return false; }
function shouldRenderAfterUpsert() { return true; }
function patchVisibleItemDom() { return false; }
function insertVisibleItemDom() { return false; }
function scheduleRenderCurrentThread() { renderCount += 1; }
function visibleTextItemsLikelySame() { return false; }
function itemVisibleWeight(item) { return JSON.stringify(item || {}).length; }
function mergeItemPreservingVisibleFields(existingItem, incomingItem) {
  return Object.assign({}, existingItem || {}, incomingItem || {});
}
${sources.join("\n")}
return { state, upsertItem, renderCount: () => renderCount };
`)();
}

function evaluatedVisibleItemsForTurn() {
  const sources = [
    "normalizeFsPath",
    "imageUrlValue",
    "isInputTextPart",
    "inputTextValue",
    "isTruncatedImagePayloadPart",
    "isInputImagePart",
    "attachmentSummaryMarkerMatch",
    "stripAttachmentSummaryLinePrefix",
    "parseAttachmentLine",
    "splitAttachmentSummaryText",
    "isMuxUserMessage",
    "isOptimisticUserMessage",
    "isTurnUsageSummaryItem",
    "normalizeComparableText",
    "userMessageComparableParts",
    "userMessagePathOverlap",
    "comparablePathName",
    "userMessagePathNameOverlap",
    "userMessagesLikelySame",
    "pruneRecentSubmittedUserMessages",
    "recentSubmittedUserRecordBelongsToThread",
    "isRecentlySubmittedUserMessage",
    "liveTurnHasNonUserProgress",
    "isVisibleNonUserProgressItem",
    "liveTurnHasNonUserProgressBefore",
    "liveTurnHasNonUserProgressAfter",
    "isUserVisibleTextReplyItem",
    "liveTurnHasUserVisibleTextReplyAfter",
    "shouldHideDurableLiveUserMessage",
    "isSupersededLiveTurn",
    "shouldHideSupersededLiveUserMessage",
    "visibleItemsForTurn",
  ].map((name) => functionSourceFrom(appJs, name));
  return Function(`
const RECENT_SUBMITTED_USER_MESSAGE_TTL_MS = 6 * 60 * 60 * 1000;
const state = {
  currentThreadId: "thread-live",
  currentThread: { id: "thread-live" },
  recentSubmittedUserMessages: new Map(),
};
function isLiveTurn(turn) { return Boolean(turn && turn.live); }
function isReasoningItem(item) { return Boolean(item && item.type === "reasoning"); }
function isOperationalItem(item) { return Boolean(item && item.type === "commandExecution"); }
function isContextCompactionItem(item) { return Boolean(item && item.type === "contextCompaction"); }
function contextCompactionNotice() { return "context notice"; }
${sources.join("\n")}
return { state, visibleItemsForTurn };
`)();
}

function evaluatedLatestTurnHelpers() {
  const sources = [
    "turnHasDisplayItems",
    "latestTurn",
    "syncActiveTurnFromThread",
  ].map((name) => functionSourceFrom(appJs, name));
  return Function(`
let interruptDisabled = null;
const state = {
  currentThread: { turns: [] },
  activeTurnId: "",
};
function statusText(status) {
  if (!status) return "";
  if (typeof status === "string") return status;
  return status.type || JSON.stringify(status);
}
function isCompletedStatus(status) {
  return /completed|failed|cancel|error|interrupted/i.test(statusText(status));
}
function isTurnComplete(turn) {
  return Boolean(turn && (turn.completedAt || turn.durationMs || isCompletedStatus(turn.status)));
}
function isRunningStatus(status) {
  const text = statusText(status).toLowerCase();
  return /(running|active|queued|processing|inprogress|in_progress|in-progress)/.test(text)
    && !/(completed|failed|cancel|error|interrupted)/.test(text);
}
function $(id) {
  if (id !== "interruptTurn") return null;
  return { set disabled(value) { interruptDisabled = value; } };
}
function updateComposerControls() {}
${sources.join("\n")}
return { state, latestTurn, syncActiveTurnFromThread, interruptDisabled: () => interruptDisabled };
`)();
}

function evaluatedLocalSubmissionInserter() {
  const sources = [
    "localSubmittedTurnId",
    "currentThreadHasClientSubmission",
    "insertLocalSubmittedUserMessage",
  ].map((name) => functionSourceFrom(appJs, name));
  return Function([
    `
let mergeCount = 0;
let syncCount = 0;
const state = {
  currentThreadId: "thread-live",
  currentThread: { id: "thread-live", status: { type: "idle" }, turns: [], mobileLoading: true },
  threads: [],
};
function localUserMessageItem(text, attachments, clientSubmissionId) {
  return {
    id: "local-user-" + clientSubmissionId,
    type: "userMessage",
    mobilePendingSubmission: true,
    clientSubmissionId,
    content: [{ type: "text", text }],
    attachments,
  };
}
function isCompletedStatus(status) {
  return status && /completed|failed|cancel|error|interrupted/i.test(status.type || status);
}
function mergeThreadIntoThreadList() { mergeCount += 1; }
function syncActiveTurnFromThread() { syncCount += 1; }
`,
    sources.join("\n"),
    `
return {
  state,
  insertLocalSubmittedUserMessage,
  counters: () => ({ mergeCount, syncCount }),
};
`,
  ].join("\n"))();
}

function evaluatedThreadPendingApprovalProjection() {
  const sources = [
    "approvalThreadId",
    "approvalTurnId",
    "isApprovalActive",
    "isApprovalSettled",
    "shouldShowApprovalRequest",
    "requestBelongsToThread",
    "pendingApprovalsForThread",
    "permissionSummary",
    "approvalDetailLines",
    "isUserInputRequest",
    "renderUserInputOptions",
    "renderUserInputActions",
    "renderApprovalActions",
    "approvalTitle",
    "approvalStatusLabel",
    "renderApprovalRequest",
    "renderPendingApprovals",
    "upsertServerRequest",
    "syncThreadPendingServerRequests",
  ].map((name) => functionSourceFrom(appJs, name));
  return Function(`
const HIDDEN_SERVER_REQUEST_METHODS = new Set();
const USER_INPUT_REQUEST_METHODS = new Set(["item/tool/requestUserInput", "mcpServer/elicitation/request"]);
const state = {
  pendingApprovals: new Map(),
  currentThreadId: "thread-approval",
  currentThread: { id: "thread-approval" },
};
let activity = "";
let renderCount = 0;
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function entryAnimationClass() { return ""; }
function markActivity(value) { activity = value; }
function scheduleRenderCurrentThread() { renderCount += 1; }
${sources.join("\n")}
return { state, syncThreadPendingServerRequests, renderPendingApprovals, activity: () => activity, renderCount: () => renderCount };
`)();
}

function evaluatedTurnUsageSummaryRenderer() {
  const sources = [
    "escapeHtml",
    "formatFileSize",
    "formatTokenCount",
    "formatCompactTokenCount",
    "displayInputTokensExcludingCached",
    "tokenUsageSummaryText",
    "tokenUsageAdditiveDetail",
    "tokenUsageIncludedDetail",
    "formatUsagePercent",
    "clampPercent",
    "contextRiskLabel",
    "renderUsageMetric",
    "renderUsageBarPill",
    "renderUsageTokenCell",
    "renderUsageProgress",
    "renderUsageCompactMetric",
    "renderTurnUsageSummary",
  ].map((name) => functionSourceFrom(appJs, name));
  return Function(`${sources.join("\n")}\nreturn renderTurnUsageSummary;`)();
}

test("context compaction notices update status and collapse repeated turn notices", () => {
  assert.match(functionBody("visibleItemsForTurn"), /const contextEntryByKey = new Map\(\)/);
  assert.match(functionBody("visibleItemsForTurn"), /isContextCompactionItem\(item\)/);
  assert.match(functionBody("visibleItemsForTurn"), /const notice = contextCompactionNotice\(item, turn\)/);
  assert.match(functionBody("visibleItemsForTurn"), /if \(!notice\) return/);
  assert.match(functionBody("visibleItemsForTurn"), /visible\[existing\.visibleIndex\] = null/);
  assert.match(functionBody("visibleItemsForTurn"), /const filtered = visible\.filter\(Boolean\)/);
  assert.match(functionBody("isSupersededLiveTurn"), /mobileSupersededLive/);
  assert.match(functionBody("visibleItemsForTurn"), /shouldHideSupersededLiveUserMessage\(turn, item\)/);
  assert.match(functionBody("visibleItemsForTurn"), /filtered\.every\(\(entry\) => isTurnUsageSummaryItem\(entry\.item\)\)/);
  assert.match(functionBody("visibleItemsForTurn"), /return filtered/);
  assert.match(functionBody("visibleItemSignature"), /isContextCompactionItem\(item\)/);
  assert.match(functionBody("visibleItemSignature"), /const notice = contextCompactionNotice\(item, turn\)/);
  assert.match(functionBody("visibleItemSignature"), /if \(!notice\) return null/);
  assert.match(functionBody("visibleItemSignature"), /mobileCompactionStatus: item\.mobileCompactionStatus/);
  assert.match(functionBody("visibleItemSignature"), /notice,/);
  assert.match(functionBody("conversationRenderSignature"), /visibleItemSignature\(entry\.item, turn\)/);
});

test("context compaction notices require explicit state and do not infer pending from live turns", () => {
  assert.match(appJs, /function contextCompactionState\(/);
  assert.match(functionBody("contextCompactionState"), /itemKind === "complete"/);
  assert.match(functionBody("contextCompactionState"), /mobileKind === "complete"/);
  assert.match(functionBody("contextCompactionState"), /itemKind === "pending"/);
  assert.match(functionBody("contextCompactionState"), /canShowPendingContextCompaction\(turn\)/);
  assert.match(functionBody("contextCompactionState"), /return ""/);
  assert.match(functionBody("canShowPendingContextCompaction"), /isLatestTurn\(turn\) && isLiveTurn\(turn\)/);
  assert.doesNotMatch(functionBody("contextCompactionState"), /isContextCompactionType\(item\.type\)/);
  assert.match(functionBody("renderContextCompaction"), /const notice = contextCompactionNotice\(item, turn\)/);
  assert.match(functionBody("renderContextCompaction"), /if \(!notice\) return ""/);
});

test("visible turn items keep source order after live operations move to the dock", () => {
  const body = functionBody("renderTurn");
  assert.match(body, /const visibleEntries = visibleItemsForTurn\(turn\);/);
  assert.doesNotMatch(body, /deferLiveFollowupUser/);
  assert.doesNotMatch(body, /candidate\.sourceIndex < sourceIndex/);
  assert.match(body, /return \{ html, sourceIndex, order: 1 \};/);
  assert.match(body, /\.sort\(\(a, b\) => \(a\.sourceIndex - b\.sourceIndex\) \|\| \(a\.order - b\.order\)\)/);
  assert.match(functionBody("visibleItemsForTurn"), /if \(isOperationalItem\(item\)\) \{[\s\S]*return;/);
});

test("superseded live usage-only shells do not render as blank completed receipts", () => {
  const { visibleItemsForTurn } = evaluatedVisibleItemsForTurn();
  assert.deepEqual(
    visibleItemsForTurn({
      status: { type: "completed", mobileSupersededLive: true, previousType: "inProgress" },
      items: [{ id: "usage-only", type: "turnUsageSummary", mobileUsageSummary: { totalTokenUsage: { totalTokens: 12 } } }],
    }),
    [],
  );
  assert.deepEqual(
    visibleItemsForTurn({
      mobileSupersededLive: true,
      items: [{ id: "usage-top-level", type: "turnUsageSummary", mobileUsageSummary: { totalTokenUsage: { totalTokens: 12 } } }],
    }),
    [],
  );
  assert.deepEqual(
    visibleItemsForTurn({
      status: { type: "completed", mobileSupersededLive: true, previousType: "inProgress" },
      items: [
        { id: "old-user", type: "userMessage", text: "old steering prompt" },
        { id: "receipt", type: "agentMessage", text: "done" },
        { id: "usage-with-receipt", type: "turnUsageSummary", mobileUsageSummary: { totalTokenUsage: { totalTokens: 12 } } },
      ],
    }).map((entry) => entry.item.id),
    ["receipt", "usage-with-receipt"],
  );
  assert.deepEqual(
    visibleItemsForTurn({
      status: { type: "completed", mobileSupersededLive: true, previousType: "inProgress" },
      items: [
        { id: "old-user-only", type: "userMessage", text: "old prompt" },
        { id: "usage-after-user", type: "turnUsageSummary", mobileUsageSummary: { totalTokenUsage: { totalTokens: 12 } } },
      ],
    }),
    [],
  );
  assert.deepEqual(
    visibleItemsForTurn({
      status: "completed",
      items: [{ id: "normal-usage", type: "turnUsageSummary", mobileUsageSummary: { totalTokenUsage: { totalTokens: 12 } } }],
    }).map((entry) => entry.item.id),
    ["normal-usage"],
  );
});

test("live turn keeps prompt and responded steering messages while hiding only unanswered trailing durable user bubbles", () => {
  const { visibleItemsForTurn } = evaluatedVisibleItemsForTurn();
  const liveTurn = {
    live: true,
    items: [
      { id: "real-user-prompt", type: "userMessage", content: [{ type: "text", text: "initial prompt" }] },
      { id: "assistant-progress", type: "agentMessage", text: "working" },
      { id: "real-user-responded-steer", type: "userMessage", content: [{ type: "text", text: "follow-up steer with response" }] },
      { id: "assistant-after-steer", type: "agentMessage", text: "acknowledged steer" },
      { id: "real-user-trailing", type: "userMessage", content: [{ type: "text", text: "stale trailing steer" }] },
      { id: "local-user-new", type: "userMessage", mobilePendingSubmission: true, content: [{ type: "text", text: "new local message" }] },
      { id: "cmd-1", type: "commandExecution", status: "running" },
    ],
  };
  assert.deepEqual(
    visibleItemsForTurn(liveTurn).map((entry) => entry.item.id),
    ["real-user-prompt", "assistant-progress", "real-user-responded-steer", "assistant-after-steer", "local-user-new"],
  );

  const completedTurn = Object.assign({}, liveTurn, { live: false });
  assert.deepEqual(
    visibleItemsForTurn(completedTurn).map((entry) => entry.item.id),
    ["real-user-prompt", "assistant-progress", "real-user-responded-steer", "assistant-after-steer", "real-user-trailing", "local-user-new"],
  );
});

test("latest turn ignores empty active projection tails", () => {
  const harness = evaluatedLatestTurnHelpers();
  harness.state.currentThread.turns = [
    { id: "completed", status: "completed", completedAt: 1781141506, items: [{ id: "final", type: "agentMessage", text: "done" }] },
    { id: "active-with-items", status: "inProgress", items: [{ id: "prompt", type: "userMessage", content: [{ type: "text", text: "next prompt" }] }] },
    { id: "empty-active-tail", status: "inProgress", items: [] },
  ];
  assert.equal(harness.latestTurn().id, "active-with-items");
  harness.syncActiveTurnFromThread();
  assert.equal(harness.state.activeTurnId, "active-with-items");
  assert.equal(harness.interruptDisabled(), false);
});

test("live turn keeps this session submitted durable user message after progress starts", () => {
  const harness = evaluatedVisibleItemsForTurn();
  harness.state.recentSubmittedUserMessages.set("submit-current", {
    threadId: "thread-live",
    createdAtMs: Date.now(),
  });
  const liveTurn = {
    live: true,
    items: [
      { id: "real-user-old", type: "userMessage", content: [{ type: "text", text: "old steer" }] },
      { id: "assistant-progress", type: "agentMessage", text: "working" },
      {
        id: "real-user-current",
        type: "userMessage",
        clientSubmissionId: "submit-current",
        content: [{ type: "input_text", text: "current long user message" }],
      },
      { id: "cmd-1", type: "commandExecution", status: "running" },
    ],
  };
  assert.deepEqual(
    harness.visibleItemsForTurn(liveTurn).map((entry) => entry.item.id),
    ["real-user-old", "assistant-progress", "real-user-current"],
  );
});

test("live turn keeps current submitted durable user message when projection drops client submission id", () => {
  const harness = evaluatedVisibleItemsForTurn();
  harness.state.recentSubmittedUserMessages.set("submit-current", {
    threadId: "thread-live",
    createdAtMs: Date.now(),
    item: {
      id: "local-user-submit-current",
      type: "userMessage",
      mobilePendingSubmission: true,
      clientSubmissionId: "submit-current",
      content: [{ type: "text", text: "current long user message" }],
    },
  });
  const liveTurn = {
    live: true,
    items: [
      { id: "real-user-old", type: "userMessage", content: [{ type: "text", text: "old steer" }] },
      { id: "assistant-progress", type: "agentMessage", text: "working" },
      {
        id: "real-user-current",
        type: "userMessage",
        content: [{ type: "input_text", text: "current   long user message" }],
      },
      { id: "cmd-1", type: "commandExecution", status: "running" },
    ],
  };
  assert.deepEqual(
    harness.visibleItemsForTurn(liveTurn).map((entry) => entry.item.id),
    ["real-user-old", "assistant-progress", "real-user-current"],
  );
});

test("existing thread send inserts a local pending user turn before server projection catches up", () => {
  const harness = evaluatedLocalSubmissionInserter();
  const inserted = harness.insertLocalSubmittedUserMessage("thread-live", "continue work", [], "submit-123");
  assert.equal(inserted, true);
  assert.equal(harness.state.currentThread.status.type, "active");
  assert.equal(harness.state.currentThread.turns.length, 1);
  assert.equal(harness.state.currentThread.turns[0].id, "local-turn-submit-123");
  assert.equal(harness.state.currentThread.turns[0].status.type, "active");
  assert.equal(harness.state.currentThread.turns[0].items.length, 1);
  assert.equal(harness.state.currentThread.turns[0].items[0].clientSubmissionId, "submit-123");
  assert.equal(harness.state.currentThread.turns[0].items[0].mobilePendingSubmission, true);
  assert.deepEqual(harness.counters(), { mergeCount: 1, syncCount: 1 });
  assert.equal(harness.insertLocalSubmittedUserMessage("thread-live", "continue work", [], "submit-123"), false);
  assert.equal(harness.state.currentThread.turns[0].items.length, 1);
});

test("turn timer prefers live item activity over idle sync labels", () => {
  assert.match(appJs, /function liveActivityLabelForTurn\(/);
  assert.match(appJs, /function activeLiveOperationItemForTurn\(/);
  assert.match(functionBody("liveActivityLabelForTurn"), /const operation = activeLiveOperationItemForTurn\(turn\);/);
  assert.match(functionBody("liveActivityLabelForTurn"), /if \(operation\) return activityLabelForItem\(operation\);/);
  assert.match(appJs, /function turnHasActiveLiveItems\(/);
  assert.match(appJs, /function liveTurnStartedAtMs\(/);
  assert.match(functionBody("isLiveTurn"), /turnHasActiveLiveItems\(turn\)/);
  assert.match(functionBody("turnElapsedSeconds"), /liveTurnStartedAtMs\(turn\) \|\| state\.nowMs/);
  assert.match(functionBody("turnHasActiveLiveItems"), /item\.type === "reasoning" \|\| isOperationalItem\(item\)/);
  assert.match(functionBody("liveTurnStartedAtMs"), /numericTimestampMs\(item\.startedAtMs\)/);
  assert.match(functionBody("liveActivityLabelForTurn"), /item\.type === "reasoning"[\s\S]*return "思考"/);
  assert.match(functionBody("activeLiveOperationItemForTurn"), /isOperationalItem\(item\)[\s\S]*return item/);
  assert.match(functionBody("markIdleActivity"), /const liveTurn = currentLiveTurn\(\);/);
  assert.match(functionBody("markIdleActivity"), /if \(liveActivityLabelForTurn\(liveTurn\)\) return;/);
  assert.match(functionBody("markIdleActivity"), /if \(isIdleSyncActivityLabel\(label\) && liveTurn\) return;/);
  assert.match(functionBody("updateTurnTimer"), /liveActivityLabelForTurn\(turn\) \|\| liveTurnFallbackActivityLabel\(turn\)/);
  assert.match(functionBody("liveTurnFallbackActivityLabel"), /return "运行";/);
});

test("loading and thread-list state preserve locally visible live turns", () => {
  assert.match(appJs, /function threadIsLoadingWithoutVisibleTurns\(/);
  assert.match(functionBody("conversationRenderSignature"), /if \(threadIsLoadingWithoutVisibleTurns\(thread\)\) return `loading\\|/);
  assert.match(functionBody("conversationRootSignature"), /if \(threadIsLoadingWithoutVisibleTurns\(thread\)\) return `loading\\|/);
  assert.match(functionBody("renderCurrentThread"), /if \(threadIsLoadingWithoutVisibleTurns\(thread\)\) \{/);
  assert.match(functionBody("renderCurrentThread"), /const loadingNote = thread\.mobileLoading/);
  assert.match(functionBody("reconcileThreadStatusHints"), /id === state\.currentThreadId && currentLiveTurn\(\)/);
  assert.match(functionBody("statusIconInfo"), /state\.runningThreadIds\.has\(String\(threadId\)\)[\s\S]*currentLiveTurn\(\)/);
});

test("long agent messages keep a stable render path when a turn completes", () => {
  assert.match(functionBody("renderItemBody"), /if \(item\.type === "agentMessage"\) \{[\s\S]*renderThreadTaskCardDraftMessage\(item\.text \|\| "", item, turn\) \|\| renderMarkdownWithAttachmentSummary\(item\.text \|\| ""\);/);
  assert.doesNotMatch(functionBody("renderItemBody"), /isLiveTurn\(turn\) \? escapeHtml/);
  assert.match(appJs, /const LONG_RECEIPT_SCROLL_CHARS = 1200;/);
  assert.doesNotMatch(appJs, /function shouldDeferLiveAgentMessage/);
  assert.doesNotMatch(functionBody("visibleItemsForTurn"), /shouldDeferLiveAgentMessage/);
  assert.match(appJs, /function shouldRenderAfterAppend\(turn, itemType, field, previousValue, nextValue, options = \{\}\)/);
  assert.match(appJs, /function shouldDeferLiveFinalReceipt\(turn, itemType\)/);
  assert.match(functionBody("shouldDeferLiveFinalReceipt"), /turnHasOperationalItems\(turn\)/);
  assert.match(appJs, /function shouldRenderAfterUpsert\(turn, item\)/);
  assert.match(functionBody("shouldRenderAfterUpsert"), /shouldDeferLiveFinalReceipt\(turn, item && item\.type\)/);
  assert.match(functionBody("upsertItem"), /const canPatchExistingItem = index >= 0;/);
  assert.match(functionBody("upsertItem"), /let structureChanged = false;/);
  assert.match(functionBody("upsertItem"), /if \(structureChanged\) scheduleRenderCurrentThread\(\);[\s\S]*else if \(canPatchExistingItem\) \{[\s\S]*patchVisibleItemDom\(turn, nextItem\)[\s\S]*\} else if \(!insertVisibleItemDom\(turn, nextItem\)\)/);
  assert.match(functionBody("shouldRenderAfterAppend"), /options\.render === "defer-final-receipt" && shouldDeferLiveFinalReceipt\(turn, itemType\)/);
  assert.doesNotMatch(functionBody("shouldRenderAfterAppend"), /previousLength < LONG_RECEIPT_SCROLL_CHARS && nextLength <= LONG_RECEIPT_SCROLL_CHARS/);
  assert.match(functionBody("appendToItem"), /shouldRenderAfterAppend\(turn, itemType, field, previousValue, nextValue, options\)/);
  assert.match(functionBody("applyNotification"), /appendToItem\(params\.turnId, params\.itemId, "agentMessage", "text", params\.delta \|\| "", 0, \{ render: "defer-final-receipt" \}\)/);
  assert.match(appJs, /function shouldScrollToLongReceiptStart\(turn\)/);
  assert.match(functionBody("shouldScrollToLongReceiptStart"), /finalReceiptTextForTurn\(turn\)\.length >= LONG_RECEIPT_SCROLL_CHARS/);
  assert.doesNotMatch(functionBody("applyNotification"), /renderCurrentThread\(shouldScrollToLongReceiptStart\(turn\) \? \{ scrollToTurnReceiptStart: params\.turn\.id \} : \{\}\)/);
  assert.match(functionBody("applyNotification"), /renderCurrentThread\(\{ stickToBottom: true \}\)/);
  assert.match(appJs, /function mergeVisibleTextItemPreservingRenderIdentity\(/);
  assert.match(functionBody("mergeVisibleTextItemPreservingRenderIdentity"), /merged\.id = existingItem\.id/);
  assert.match(functionBody("mergeItemsPreservingLocalVisible"), /mergeVisibleTextItemPreservingRenderIdentity\(existingItem, incomingTextMatch\)/);
  assert.match(functionBody("mergeItemsPreservingLocalVisible"), /const addedIncomingItems = new Set\(\)/);
  assert.match(functionBody("mergeItemsPreservingLocalVisible"), /if \(addedIncomingItems\.has\(incomingItem\)\) continue/);
});

test("agent markdown can render uploaded image summaries as thumbnails", () => {
  assert.match(appJs, /function renderMarkdownWithAttachmentSummary\(value\)/);
  assert.match(functionBody("renderMarkdownWithAttachmentSummary"), /splitAttachmentSummaryText\(value \|\| ""\)/);
  assert.match(functionBody("renderMarkdownWithAttachmentSummary"), /fencedTableMode: "preview"/);
  assert.match(functionBody("renderMarkdownWithAttachmentSummary"), /renderAttachmentSummary\(split\.attachments\)/);
  assert.match(functionBody("splitAttachmentSummaryText"), /attachmentSummaryMarkerMatch/);
  assert.match(functionBody("splitAttachmentSummaryText"), /stripAttachmentSummaryLinePrefix/);
  assert.match(functionBody("splitAttachmentSummaryText"), /const visibleText = \[before, after\]/);
  assert.match(functionBody("renderAttachmentSummary"), /canRenderImageAttachment/);
  assert.match(functionBody("renderAttachmentSummary"), /renderInputImage\(\{ path: attachment\.path \}, attachment, index\)/);
  assert.match(functionBody("renderItemBody"), /item\.type === "plan"[\s\S]*renderMarkdownWithAttachmentSummary\(item\.text \|\| ""\)/);
});

test("command output can surface markdown table previews without dropping raw output", () => {
  assert.match(appJs, /function commandOutputMarkdownPreview\(/);
  assert.match(functionBody("renderOutputBlock"), /commandOutputMarkdownPreview\(outputText, item\)/);
  assert.match(functionBody("renderOutputBlock"), /class="command-output-markdown-preview"/);
  assert.match(functionBody("renderOutputBlock"), /<details class="output-details">/);
  assert.match(stylesCss, /\.command-output-markdown-preview/);
});

test("uploaded image summaries parse CRLF and markdown blockquote references", () => {
  const splitAttachmentSummaryText = evaluatedAttachmentSummaryParser();
  const uploadPath = "C:\\Users\\example\\.codex-mobile-web\\uploads\\2026-05-26\\thread-id\\1779810277313-IMG_5430.jpg";
  const line = `- IMG_5430.jpg (image, image/jpeg, 104.1 KB): ${uploadPath}`;
  for (const source of [
    `Uploaded attachments:\r\n${line}`,
    `Before\r\nUploaded attachments:\r\n${line}\r\nAfter`,
    `> Uploaded attachments:\n> ${line}`,
  ]) {
    const split = splitAttachmentSummaryText(source);
    assert.equal(split.attachments.length, 1);
    assert.equal(split.attachments[0].name, "IMG_5430.jpg");
    assert.equal(split.attachments[0].meta, "image, image/jpeg, 104.1 KB");
    assert.equal(split.attachments[0].path, uploadPath);
    assert.equal(split.attachments[0].isImage, true);
  }
});

test("raw app-server input text upload summaries render as thumbnails", () => {
  const renderInputContent = evaluatedInputContentRenderer();
  const uploadPath = "C:\\Users\\example\\.codex-mobile-web\\uploads\\2026-05-27\\thread-id\\1779843711115-IMG_5433.jpg";
  const html = renderInputContent([
    {
      type: "input_text",
      text: `Uploaded attachments:\n- IMG_5433.jpg (image, image/jpeg, 122.6 KB): ${uploadPath}`,
    },
  ]);

  assert.match(html, /class="input-image"/);
  assert.match(html, /\/api\/uploads\/file\?path=/);
  assert.match(html, /IMG_5433\.jpg/);
  assert.doesNotMatch(html, /<code>C:\\Users\\example/);
});

test("thread task card request prompts render only the original hash command in user messages", () => {
  const renderInputContent = evaluatedInputContentRenderer();
  const html = renderInputContent([
    {
      type: "input_text",
      text: [
        "# 发给 Hermes 05-26：如果需要刷新插件更新，请配合处理。",
        "",
        "<codex-mobile-thread-task-card-request>",
        "{\"version\":1,\"availableTargets\":[]}",
        "</codex-mobile-thread-task-card-request>",
        "",
        "Return only one XML block.",
      ].join("\n"),
    },
  ]);

  assert.match(html, /# 发给 Hermes 05-26/);
  assert.doesNotMatch(html, /codex-mobile-thread-task-card-request/);
  assert.doesNotMatch(html, /Return only one XML block/);
});

test("user message text before upload summaries still renders jpg thumbnails", () => {
  const renderInputContent = evaluatedInputContentRenderer();
  const uploadPath = "/Users/example/.codex-mobile-web/uploads/2026-05-27/thread-id/1779850921578-IMG_5435.jpg";
  const html = renderInputContent([
    {
      type: "input_text",
      text: `把 in 排除 cast in。\n\nUploaded attachments:\n- IMG_5435.jpg (image, image/jpeg, 101.3 KB): ${uploadPath}`,
    },
  ]);

  assert.match(html, /class="input-text"/);
  assert.match(html, /class="input-image"/);
  assert.match(html, /\/api\/uploads\/file\?path=/);
  assert.match(html, /IMG_5435\.jpg/);
  assert.doesNotMatch(html, /Uploaded attachments:/);
});

test("imageView upload screenshots use the uploads route instead of file preview", () => {
  const renderImageView = evaluatedImageViewRenderer();
  const html = renderImageView({
    type: "imageView",
    path: "/Users/example/.codex-mobile-web/uploads/2026-06-08/thread-id/1780893354486-IMG_1618.jpg",
  });

  assert.match(html, /class="image-view"/);
  assert.match(html, /\/api\/uploads\/file\?path=/);
  assert.doesNotMatch(html, /\/api\/files\/preview\/content/);
});

test("protected image auth recovery covers uploaded images", () => {
  assert.match(functionBody("protectedGeneratedImageSrc"), /"\/api\/generated-images\/file"/);
  assert.match(functionBody("protectedGeneratedImageSrc"), /"\/api\/uploads\/file"/);
  assert.match(functionBody("protectedGeneratedImageSrc"), /"\/api\/files\/preview\/content"/);
  assert.match(functionBody("uploadFileUrl"), /authenticatedApiContentUrl\(`\/api\/uploads\/file\?\$\{params\.toString\(\)\}`\)/);
});

test("generated image content urls render bounded image cards", () => {
  const renderImageView = evaluatedImageViewRenderer();
  const html = renderImageView({
    type: "imageView",
    contentUrl: "/api/generated-images/file?id=thread%2Ftool-output.png",
    fileName: "tool-output.png",
  });

  assert.match(html, /class="image-view"/);
  assert.match(html, /<img src="\/api\/generated-images\/file\?id=thread%2Ftool-output\.png&amp;key=test-key"/);
  assert.match(html, /<figcaption>tool-output\.png<\/figcaption>/);
  assert.doesNotMatch(html, /\/api\/files\/preview\/content/);
});

test("generated image content urls replace stale auth keys with the current session key", () => {
  const renderImageView = evaluatedImageViewRenderer();
  const html = renderImageView({
    type: "imageView",
    contentUrl: "/api/generated-images/file?id=thread%2Ftool-output.png&key=stale-key",
    fileName: "tool-output.png",
  });

  assert.match(html, /class="image-view"/);
  assert.match(html, /key=test-key/);
  assert.doesNotMatch(html, /stale-key/);
});

test("failed conversation images collapse into a neutral fallback", () => {
  const handleConversationImageError = evaluatedConversationImageErrorHandler();
  const addedClasses = [];
  const attributes = {};
  const figure = {
    classList: {
      add(value) {
        addedClasses.push(value);
      },
    },
  };
  const image = {
    closest(selector) {
      if (String(selector).includes(".input-image")) return figure;
      return null;
    },
    setAttribute(name, value) {
      attributes[name] = value;
    },
  };
  const target = {
    closest(selector) {
      if (selector === "img") return image;
      return null;
    },
  };

  handleConversationImageError({ target });

  assert.deepEqual(addedClasses, ["image-load-failed"]);
  assert.equal(attributes["aria-hidden"], "true");
  assert.match(appJs, /\$\("conversation"\)\.addEventListener\("error", handleConversationImageError, true\)/);
  assert.match(functionBody("updateConversationHtml"), /scheduleFailedAppImageScan\(conversation/);
  assert.match(appJs, /document\.addEventListener\("focusin", \(\) => \{[\s\S]*scheduleVisibleImageFailureScan\(\[0, 80, 240\]\);/);
  assert.match(stylesCss, /\.input-image\.image-load-failed,[\s\S]*\.markdown-image\.image-load-failed,[\s\S]*\.image-view\.image-load-failed/);
  assert.match(stylesCss, /\.input-image\.image-load-failed img,[\s\S]*display: none;/);
  assert.match(stylesCss, /\.conversation img\.image-load-failed/);
  assert.match(stylesCss, /\.attachment-chip\.image-load-failed \.attachment-thumb/);
  assert.match(stylesCss, /content: "图片无法加载";/);
});

test("already-broken rendered images are proactively marked without a new error event", () => {
  const scanFailedAppImages = evaluatedFailedImageScanner();
  const addedClasses = [];
  const attributes = {};
  const container = {
    classList: {
      add(value) {
        addedClasses.push(value);
      },
    },
  };
  const brokenImage = {
    complete: true,
    naturalWidth: 0,
    closest(selector) {
      if (selector === ".input-image, .image-view, .markdown-image, .attachment-chip, .file-preview-media, figure") return container;
      return null;
    },
    setAttribute(name, value) {
      attributes[name] = value;
    },
  };
  const loadingImage = {
    complete: false,
    naturalWidth: 0,
    closest() {
      throw new Error("loading images should not be marked");
    },
  };
  const rootNode = {
    querySelectorAll(selector) {
      assert.equal(selector, "img");
      return [brokenImage, loadingImage];
    },
  };

  assert.equal(scanFailedAppImages(rootNode), 1);
  assert.deepEqual(addedClasses, ["image-load-failed"]);
  assert.equal(attributes["aria-hidden"], "true");
});

test("raw app-server input image parts use object image urls", () => {
  const renderInputContent = evaluatedInputContentRenderer();
  const html = renderInputContent([
    {
      type: "input_text",
      text: "Uploaded attachments:\n- IMG_5882.jpg (image, image/jpeg, 101.7 KB): IMG_5882.jpg",
    },
    {
      type: "input_image",
      image_url: { url: "data:image/png;base64,abc123" },
    },
  ]);

  assert.match(html, /class="input-image"/);
  assert.match(html, /src="data:image\/png;base64,abc123"/);
  assert.doesNotMatch(html, /\/api\/uploads\/file\?path=IMG_5882/);
  assert.doesNotMatch(html, /\[object Object\]/);
});

test("raw app-server input image url local upload paths use authenticated uploads route", () => {
  const renderInputContent = evaluatedInputContentRendererWithKey("session-key");
  const uploadPath = "/Users/xuxin/.codex-mobile-web/uploads/2026-06-08/thread-id/1780936946968-IMG_5882.jpg";
  const html = renderInputContent([
    {
      type: "input_text",
      text: "see attached image",
    },
    {
      type: "input_image",
      image_url: { url: uploadPath },
    },
  ]);

  assert.match(html, /class="input-image"/);
  assert.match(html, /\/api\/uploads\/file\?path=/);
  assert.match(html, /key=session-key/);
  assert.equal(html.includes(`src="${uploadPath}"`), false);
});

test("conversation image urls rerender when the auth key version changes", () => {
  assert.match(appJs, /imageAuthVersion: 0/);
  assert.match(functionBody("setAuthKey"), /state\.imageAuthVersion = \(Number\(state\.imageAuthVersion\) \|\| 0\) \+ 1/);
  assert.match(functionBody("conversationRenderSignature"), /imageAuthVersion: Number\(state\.imageAuthVersion \|\| 0\)/);
  assert.match(functionBody("login"), /setAuthKey\(key\)/);
  assert.match(functionBody("exchangePluginLaunchSession"), /setAuthKey\(result\.session_key\)/);
});

test("image view render keys include their image source", () => {
  const body = functionBody("stableItemKey");
  assert.match(body, /item\.type === "imageView" \|\| item\.type === "imageGeneration"/);
  assert.match(body, /imageViewContentUrl\(item\)/);
  assert.match(body, /imageViewUrl\(item\)/);
  assert.match(body, /stableTextHash\(imageSource\)/);
});

test("context compaction merge does not preserve stale mobile notices", () => {
  const body = functionBody("mergeItemPreservingVisibleFields");
  assert.match(body, /isContextCompactionItem\(existingItem\) \|\| isContextCompactionItem\(incomingItem\)/);
  assert.match(body, /delete merged\.mobileNotice/);
  assert.match(body, /delete merged\.mobileCompactionStatus/);
  assert.match(body, /else if \(existingItem\.mobileNotice\)/);
});

test("server only emits context compaction notices from explicit item state", () => {
  const itemBody = serverFunctionBody("compactItem");
  const turnBody = serverFunctionBody("compactTurn");
  assert.match(serverJs, /function contextCompactionMobileState\(/);
  assert.match(serverFunctionBody("contextCompactionMobileState"), /options\.contextCompactionPending === true/);
  assert.match(serverFunctionBody("contextCompactionMobileState"), /options\.contextCompactionPending === false/);
  assert.match(serverFunctionBody("contextCompactionMobileState"), /if \(!text\) return ""/);
  assert.match(itemBody, /const compactionState = contextCompactionMobileState\(out, options\)/);
  assert.match(itemBody, /if \(!compactionState\) return compacted/);
  assert.doesNotMatch(itemBody, /options\.contextCompactionPending !== false/);
  assert.doesNotMatch(turnBody, /contextCompactionPending = isLiveTurn\(out\)/);
  assert.match(turnBody, /out\.items = out\.items\.map\(\(item\) => compactItem\(item, options\)\)/);
});

test("matching user messages keep their original turn position after final refresh", () => {
  const body = functionBody("mergeItemsPreservingLocalVisible");
  assert.match(body, /const incomingUserMatch = \(incomingItems \|\| \[\]\)\.find/);
  assert.match(body, /existingItem\.type === "userMessage"/);
  assert.match(body, /userMessagesCanShadow\(existingItem, incomingItem\)/);
  assert.match(body, /merged\.push\(mergeLikelySameUserMessage\(existingItem, incomingUserMatch\)\)/);
  assert.match(body, /addedIncomingItems\.add\(incomingUserMatch\)/);
  assert.match(body, /const incomingTextMatch = incomingUserMatch[\s\S]*visibleTextItemsLikelySame\(existingItem, incomingItem\)/);
});

test("failed submitted messages render an inline receipt", () => {
  assert.match(functionBody("renderItemBody"), /item\.type === "userMessage"\) return renderUserMessageBody\(item\)/);
  assert.match(functionBody("renderUserMessageBody"), /mobileSendError/);
  assert.match(functionBody("renderUserMessageBody"), /send-error-receipt/);
  assert.match(stylesCss, /\.send-error-receipt/);
});

test("optimistic user messages match app-server input_text messages", () => {
  const userMessagesLikelySame = evaluatedUserMessagesLikelySame();
  assert.equal(userMessagesLikelySame(
    {
      id: "local-user-submit-1",
      type: "userMessage",
      content: [{ type: "text", text: "same message" }],
    },
    {
      id: "real-user-1",
      type: "userMessage",
      content: [{ type: "input_text", text: "same   message" }],
    },
  ), true);
  assert.equal(userMessagesLikelySame(
    {
      id: "mux-user-thread-1-turn-1-submit-2",
      type: "userMessage",
      mobilePendingSubmission: true,
      content: [{ type: "text", text: "describe this" }],
    },
    {
      id: "real-user-2",
      type: "userMessage",
      content: [
        { type: "input_text", input_text: "describe this" },
        { type: "input_image", image_url: "data:image/png;base64,AAAA" },
      ],
    },
  ), true);
  assert.equal(userMessagesLikelySame(
    {
      id: "real-user-a",
      type: "userMessage",
      content: [{ type: "input_text", text: "same message" }, { type: "localImage", path: "/tmp/a.png" }],
    },
    {
      id: "real-user-b",
      type: "userMessage",
      content: [{ type: "input_text", text: "same message" }, { type: "localImage", path: "/tmp/b.png" }],
    },
  ), false);
  assert.equal(userMessagesLikelySame(
    {
      id: "local-user-submit-3",
      type: "userMessage",
      mobilePendingSubmission: true,
      content: [{ type: "text", text: "Uploaded attachments:\n- IMG_5882.jpg (image, image/jpeg, 101.7 KB): IMG_5882.jpg" }],
    },
    {
      id: "real-user-3",
      type: "userMessage",
      content: [
        {
          type: "input_text",
          text: "Uploaded attachments:\n- IMG_5882.jpg (image, image/jpeg, 101.7 KB): /Users/xuxin/.codex-mobile-web/uploads/thread/IMG_5882.jpg",
        },
        { type: "localImage", path: "/Users/xuxin/.codex-mobile-web/uploads/thread/IMG_5882.jpg" },
      ],
    },
  ), true);
});

test("optimistic user messages are shadowed by mux and durable echoes", () => {
  const mergeItemsPreservingLocalVisible = evaluatedMergeItemsPreservingLocalVisible();
  const localText = {
    id: "local-user-submit-1",
    type: "userMessage",
    mobilePendingSubmission: true,
    content: [{ type: "text", text: "same message" }],
  };
  const muxText = {
    id: "mux-user-thread-1-turn-1-submit-1",
    type: "userMessage",
    mobilePendingSubmission: true,
    content: [{ type: "input_text", text: "same message" }],
  };
  const textItems = mergeItemsPreservingLocalVisible([localText], [muxText], true);
  assert.equal(textItems.length, 1);
  assert.equal(textItems[0].id, muxText.id);

  const localImage = {
    id: "local-user-submit-2",
    type: "userMessage",
    mobilePendingSubmission: true,
    clientSubmissionId: "submit-2",
    content: [{ type: "text", text: "Uploaded attachments:\n- IMG_5882.jpg (image, image/jpeg, 101.7 KB): IMG_5882.jpg" }],
  };
  const durableImage = {
    id: "real-user-2",
    type: "userMessage",
    content: [
      {
        type: "input_text",
        text: "Uploaded attachments:\n- IMG_5882.jpg (image, image/jpeg, 101.7 KB): /Users/xuxin/.codex-mobile-web/uploads/thread/IMG_5882.jpg",
      },
      { type: "localImage", path: "/Users/xuxin/.codex-mobile-web/uploads/thread/IMG_5882.jpg" },
    ],
  };
  const imageItems = mergeItemsPreservingLocalVisible([localImage], [durableImage], true);
  assert.equal(imageItems.length, 1);
  assert.equal(imageItems[0].id, durableImage.id);
  assert.equal(imageItems[0].mobilePendingSubmission, undefined);
  assert.equal(imageItems[0].clientSubmissionId, "submit-2");
});

test("cross-turn durable user messages remove only synthetic echoes", () => {
  const normalizeThreadVisibleUserMessages = evaluatedNormalizeThreadVisibleUserMessages();
  const thread = {
    turns: [
      {
        id: "turn-1",
        items: [{
          id: "mux-user-thread-1-turn-1-submit-1",
          type: "userMessage",
          mobilePendingSubmission: true,
          content: [{ type: "text", text: "same message" }],
        }],
      },
      {
        id: "turn-2",
        items: [{
          id: "real-user-2",
          type: "userMessage",
          content: [{ type: "input_text", text: "same   message" }],
        }],
      },
      {
        id: "turn-3",
        items: [{
          id: "real-user-3",
          type: "userMessage",
          content: [{ type: "input_text", text: "same message" }],
        }],
      },
    ],
  };

  normalizeThreadVisibleUserMessages(thread);

  assert.deepEqual(thread.turns[0].items, []);
  assert.equal(thread.turns[1].items.length, 1);
  assert.equal(thread.turns[1].items[0].id, "real-user-2");
  assert.equal(thread.turns[2].items.length, 1);
  assert.equal(thread.turns[2].items[0].id, "real-user-3");
});

test("cross-turn normalization keeps synthetic repeat when matching durable message is earlier", () => {
  const normalizeThreadVisibleUserMessages = evaluatedNormalizeThreadVisibleUserMessages();
  const thread = {
    turns: [
      {
        id: "turn-1",
        items: [{
          id: "real-user-1",
          type: "userMessage",
          content: [{ type: "input_text", text: "repeat   message" }],
        }],
      },
      {
        id: "turn-2",
        items: [{
          id: "mux-user-thread-1-turn-2-submit-2",
          type: "userMessage",
          mobilePendingSubmission: true,
          content: [{ type: "text", text: "repeat message" }],
        }],
      },
    ],
  };

  normalizeThreadVisibleUserMessages(thread);

  assert.equal(thread.turns[0].items.length, 1);
  assert.equal(thread.turns[0].items[0].id, "real-user-1");
  assert.equal(thread.turns[1].items.length, 1);
  assert.equal(thread.turns[1].items[0].id, "mux-user-thread-1-turn-2-submit-2");
});

test("new-thread initial optimistic echo is dropped when durable first turn arrives with a different id", () => {
  const mergeThreadPreservingVisibleItems = evaluatedMergeThreadPreservingVisibleItems();
  const existingThread = {
    id: "thread-new",
    mobileInitialSubmissionId: "submit-first",
    turns: [{
      id: "local-start-turn",
      status: { type: "active" },
      items: [{
        id: "local-user-submit-first",
        type: "userMessage",
        mobilePendingSubmission: true,
        clientSubmissionId: "submit-first",
        content: [{ type: "text", text: "first prompt" }],
      }],
    }],
  };
  const incomingThread = {
    id: "thread-new",
    turns: [{
      id: "real-start-turn",
      status: { type: "active" },
      items: [{
        id: "item-1",
        type: "userMessage",
        content: [{ type: "text", text: "first   prompt" }],
      }],
    }],
  };

  const merged = mergeThreadPreservingVisibleItems(existingThread, incomingThread);

  assert.equal(merged.turns.length, 1);
  assert.equal(merged.turns[0].id, "real-start-turn");
  assert.deepEqual(merged.turns[0].items.map((item) => item.id), ["item-1"]);
  assert.equal(merged.mobileInitialSubmissionId, undefined);
});

test("new-thread initial echo cleanup does not remove a later repeated prompt with another submission id", () => {
  const mergeThreadPreservingVisibleItems = evaluatedMergeThreadPreservingVisibleItems();
  const existingThread = {
    id: "thread-new",
    mobileInitialSubmissionId: "submit-first",
    turns: [{
      id: "local-start-turn",
      status: { type: "active" },
      items: [{
        id: "local-user-submit-second",
        type: "userMessage",
        mobilePendingSubmission: true,
        clientSubmissionId: "submit-second",
        content: [{ type: "text", text: "repeat prompt" }],
      }],
    }],
  };
  const incomingThread = {
    id: "thread-new",
    turns: [{
      id: "real-start-turn",
      status: { type: "completed" },
      items: [{
        id: "item-1",
        type: "userMessage",
        content: [{ type: "text", text: "repeat prompt" }],
      }],
    }],
  };

  const merged = mergeThreadPreservingVisibleItems(existingThread, incomingThread);

  assert.equal(merged.turns.length, 2);
  assert.deepEqual(merged.turns.flatMap((turn) => turn.items.map((item) => item.id)), [
    "item-1",
    "local-user-submit-second",
  ]);
  assert.equal(merged.mobileInitialSubmissionId, undefined);
});

test("live user message upsert collapses mux echoes before refresh", () => {
  const harness = evaluatedLiveUserMessageUpsert();
  harness.upsertItem("turn-1", {
    id: "mux-user-thread-1-turn-1-submission-1",
    type: "userMessage",
    mobilePendingSubmission: true,
    clientSubmissionId: "submission-1",
    content: [{ type: "text", text: "same live message" }],
  });
  harness.upsertItem("turn-1", {
    id: "real-user-1",
    type: "userMessage",
    content: [{ type: "input_text", text: "same   live message" }],
  });

  const turn = harness.state.currentThread.turns[0];
  const userMessages = turn.items.filter((item) => item.type === "userMessage");
  assert.equal(userMessages.length, 1);
  assert.equal(userMessages[0].id, "real-user-1");
  assert.equal(userMessages[0].mobilePendingSubmission, undefined);
  assert.equal(userMessages[0].clientSubmissionId, "submission-1");
  assert.equal(harness.renderCount(), 2);
});

test("thread detail pending server requests render approval cards without SSE timing", () => {
  const harness = evaluatedThreadPendingApprovalProjection();
  harness.syncThreadPendingServerRequests({
    id: "thread-approval",
    pendingServerRequests: [
      {
        id: "approval-1",
        method: "item/permissions/requestApproval",
        status: "waiting",
        actionable: true,
        params: {
          threadId: "thread-approval",
          turnId: "turn-1",
          permissions: { network: { host: "api.example.test" } },
          reason: "Need network access",
        },
      },
    ],
  });

  const html = harness.renderPendingApprovals({ id: "thread-approval" });
  assert.equal(harness.state.pendingApprovals.size, 1);
  assert.equal(harness.activity(), "等待批准");
  assert.equal(harness.renderCount(), 1);
  assert.match(html, /class="approval-card/);
  assert.match(html, /权限需要批准/);
  assert.match(html, /api\.example\.test/);
  assert.match(html, /data-approval-id="approval-1"/);
});

test("active turn state follows only the latest durable turn", () => {
  const syncBody = functionBody("syncActiveTurnFromThread");
  assert.match(syncBody, /const latest = latestTurn\(\);/);
  assert.match(syncBody, /const running = latest && !isTurnComplete\(latest\) && isRunningStatus\(latest\.status\) \? latest : null/);
  assert.doesNotMatch(syncBody, /reverse\(\)\.find/);

  const liveBody = functionBody("currentLiveTurn");
  assert.match(liveBody, /const latest = latestTurn\(\);/);
  assert.match(liveBody, /const active = latest && latest\.id === state\.activeTurnId \? latest : null/);
  assert.match(liveBody, /return latest && isLiveTurn\(latest\) \? latest : null/);
  assert.doesNotMatch(liveBody, /reverse\(\)\.find/);
});

test("thread running hints survive notLoaded list refreshes", () => {
  assert.match(appJs, /function updateThreadListStatus\(/);
  assert.match(appJs, /function snapshotThreadStatus\(/);
  assert.match(appJs, /function restoreThreadStatusSnapshot\(/);
  assert.match(appJs, /function markThreadOptimisticallyActive\(/);
  assert.match(appJs, /function mergeThreadIntoThreadList\(/);
  assert.match(appJs, /const RUNNING_THREAD_HINT_STALE_MS = 20 \* 60 \* 1000;/);
  assert.match(appJs, /runningThreadHintedAtById: loadNumberMapStorage\("codexMobileRunningThreadHintedAtById", \{\}\)/);
  assert.match(functionBody("saveThreadStatusHints"), /saveNumberMapStorage\(STORAGE_RUNNING_THREAD_HINTED_AT, state\.runningThreadHintedAtById\)/);
  assert.match(appJs, /function isThreadListSettledStatus\(status\)/);
  assert.match(functionBody("isThreadListSettledStatus"), /idle\|completed\|complete\|done\|failed/);
  assert.match(appJs, /function isStaleActiveStatus\(status\)/);
  assert.match(functionBody("isStaleActiveStatus"), /mobileStaleActiveTurn/);
  assert.match(functionBody("shouldExpireRunningThreadHint"), /isStaleActiveStatus\(thread && thread\.status\)/);
  assert.match(functionBody("updateThreadStatusHints"), /const staleActive = isStaleActiveStatus\(nextStatus\)/);
  assert.match(functionBody("updateThreadStatusHints"), /if \(!staleActive && id !== state\.currentThreadId/);
  assert.match(functionBody("statusIconInfo"), /if \(isStaleActiveStatus\(status\)\) return null;/);
  assert.match(functionBody("statusIconInfo"), /state\.runningThreadIds\.has\(String\(threadId\)\)[\s\S]*currentLiveTurn\(\)/);
  assert.match(functionBody("reconcileThreadStatusHints"), /const staleActive = isStaleActiveStatus\(thread\.status\) \|\| Boolean\(thread\.mobileStaleActiveTurn\)/);
  assert.match(functionBody("reconcileThreadStatusHints"), /const isRunning = !staleActive && isRunningStatus\(thread\.status\)/);
  assert.match(functionBody("reconcileThreadStatusHints"), /else if \(wasRunning && staleActive\)/);
  assert.match(functionBody("reconcileThreadStatusHints"), /else if \(wasRunning && isThreadListSettledStatus\(thread\.status\)\)/);
  assert.match(functionBody("reconcileThreadStatusHints"), /shouldExpireRunningThreadHint\(id, thread, nowMs\)/);
  assert.doesNotMatch(functionBody("reconcileThreadStatusHints"), /else if \(!isRunning && wasRunning\)/);

  const listMergeBody = functionBody("mergeThreadIntoThreadList");
  assert.match(listMergeBody, /threadListSummaryFromDetailThread\(thread\)/);
  assert.match(listMergeBody, /Object\.assign\(\{\}, entry, summary\)/);
  const optimisticBody = functionBody("markThreadOptimisticallyActive");
  assert.match(optimisticBody, /const runningStatus = \{ type: "active" \};/);
  assert.match(optimisticBody, /updateThreadStatusHints\(id, previousStatus, runningStatus/);
  assert.match(optimisticBody, /updateThreadListStatus\(id, runningStatus\)/);
  assert.match(optimisticBody, /mergeThreadIntoThreadList\(state\.currentThread\)/);
  const restoreBody = functionBody("restoreThreadStatusSnapshot");
  assert.match(restoreBody, /updateThreadStatusHints\(id, \{ type: "active" \}, restoredStatus/);
  assert.match(restoreBody, /state\.currentThread\.status = snapshot\.currentStatus/);
  assert.match(functionBody("loadThread"), /state\.currentThread = mergeThreadPreservingVisibleItems\(state\.currentThread, result\.thread\);\s*mergeThreadIntoThreadList\(state\.currentThread\);/);
  assert.match(functionBody("refreshCurrentThread"), /state\.currentThread = mergeThreadPreservingVisibleItems\(state\.currentThread, result\.thread\);[\s\S]*mergeThreadIntoThreadList\(state\.currentThread\);/);
  assert.match(functionBody("backfillFullThreadDetail"), /state\.currentThread = mergeThreadPreservingVisibleItems\(state\.currentThread, result\.thread\);\s*mergeThreadIntoThreadList\(state\.currentThread\);/);
  const sendBody = functionBody("sendMessage");
  assert.match(sendBody, /const previousThreadStatus = snapshotThreadStatus\(state\.currentThreadId\);/);
  assert.match(sendBody, /registerSubmittedUserMessage\(state\.currentThreadId, outboundText, submittedAttachments, clientSubmissionId\);\s*const insertedLocalMessage = insertLocalSubmittedUserMessage/);
  assert.match(sendBody, /if \(insertedLocalMessage\) renderCurrentThread\(\{ stickToBottom: true \}\);/);
  assert.match(sendBody, /if \(!steering\) \{[\s\S]*restoreThreadStatusSnapshot\(previousThreadStatus\);[\s\S]*renderThreads\(\);[\s\S]*\}/);

  const expireBody = functionBody("shouldExpireRunningThreadHint");
  assert.match(expireBody, /id === state\.currentThreadId && state\.activeTurnId/);
  assert.match(expireBody, /runningThreadHintAgeMs\(id, thread, nowMs\) > RUNNING_THREAD_HINT_STALE_MS/);

  const notificationBody = functionBody("applyNotification");
  assert.match(notificationBody, /const runningStatus = \{ type: "active" \};/);
  assert.match(notificationBody, /updateThreadStatusHints\(params\.threadId, state\.currentThread\.status, runningStatus/);
  assert.match(notificationBody, /updateThreadListStatus\(params\.threadId, runningStatus\)/);
  assert.match(notificationBody, /const completedStatus = \(params\.turn && params\.turn\.status\) \|\| \{ type: "completed" \};/);
  assert.match(notificationBody, /updateThreadStatusHints\(params\.threadId, state\.currentThread\.status, completedStatus/);
  assert.match(notificationBody, /updateThreadListStatus\(params\.threadId, completedStatus\)/);
  assert.match(notificationBody, /scheduleRenderThreads\(\);[\s\S]*scheduleCurrentThreadRefresh\(500\)/);
  assert.match(notificationBody, /scheduleRenderThreads\(\);[\s\S]*schedulePostCompletionThreadRefreshes\(params\.threadId, \[700, 2400\]\)/);
});

test("thread merge drops superseded stale active turns", () => {
  assert.match(appJs, /function turnIsSupersededBy\(/);
  assert.match(functionBody("turnIsSupersededBy"), /return isTurnComplete\(newerTurn\) && !isTurnComplete\(turn\)/);
  assert.match(functionBody("mergeThreadPreservingVisibleItems"), /const latestIncoming = merged\.turns\.length \? merged\.turns\[merged\.turns\.length - 1\] : null/);
  assert.match(functionBody("mergeThreadPreservingVisibleItems"), /if \(turnIsSupersededBy\(existingTurn, latestIncoming\)\) continue/);
});

test("completed turns can render context and token usage summaries", () => {
  assert.match(serverJs, /workspaceContextStats:\s*workspaceContextStatsForCwd\(out\.cwd\)/);
  assert.match(appJs, /function renderTurnUsageSummary\(item\)/);
  assert.match(appJs, /function isTurnUsageSummaryItem\(item\)/);
  assert.match(appJs, /function dedupeTurnUsageSummaryItems\(items\)/);
  assert.match(functionBody("labelForItem"), /turnUsageSummary:\s*"Usage"/);
  assert.match(functionBody("renderItem"), /item\.type === "turnUsageSummary"[\s\S]*renderTurnUsageSummary\(item\)/);
  assert.match(functionBody("renderItemBody"), /item\.type === "turnUsageSummary"[\s\S]*renderTurnUsageSummary\(item\)/);
  assert.match(functionBody("visibleItemSignature"), /item\.type === "turnUsageSummary"/);
  assert.match(functionBody("visibleItemSignature"), /mobileUsageSummary: item\.mobileUsageSummary/);
  assert.match(functionBody("mergeItemsPreservingLocalVisible"), /dedupeTurnUsageSummaryItems\(removeShadowedMuxUserMessages\(dedupeLikelySameUserMessages\(merged\)\)\)/);
  assert.match(functionBody("upsertItem"), /isTurnUsageSummaryItem\(item\)[\s\S]*!isTurnUsageSummaryItem\(existing\)/);
  assert.match(functionBody("turnFinalReceiptNode"), /:not\(\.turnUsageSummary\)/);
});

test("completed turn usage summary renders workspace context sizes and compact action", () => {
  const renderTurnUsageSummary = evaluatedTurnUsageSummaryRenderer();
  const html = renderTurnUsageSummary({
    mobileUsageSummary: {
      contextRiskLevel: "normal",
      contextWindowUsedPercent: 25,
      contextWindowUsedTokens: 25000,
      modelContextWindow: 100000,
      lastTokenUsage: {
        inputTokens: 1000,
        cachedInputTokens: 400,
        outputTokens: 200,
        reasoningOutputTokens: 75,
        totalTokens: 1200,
      },
      totalTokenUsage: {
        inputTokens: 2000,
        cachedInputTokens: 600,
        outputTokens: 500,
        reasoningOutputTokens: 125,
        totalTokens: 2500,
      },
      rolloutSizeBytes: 1024,
      rolloutWarningThresholdBytes: 2048,
      projectContextSizeBytes: 75 * 1024,
      handoffSizeBytes: 180 * 1024,
      workspaceContextPairSizeBytes: 255 * 1024,
      workspaceContextFileThresholdBytes: 100 * 1024,
      workspaceHandoffPromptThresholdBytes: 200 * 1024,
      workspaceContextPairThresholdBytes: 200 * 1024,
    },
  });

  assert.match(html, /turn-usage-bar/);
  assert.doesNotMatch(html, /turn-usage-chevron/);
  assert.match(html, /turn-usage-top-grid/);
  assert.match(html, /turn-usage-ring/);
  assert.match(html, /turn-usage-token-grid/);
  assert.match(html, /turn-usage-rollout-card/);
  assert.match(html, /Context Window/);
  assert.match(html, /thread/);
  assert.match(html, /2\.5K thr/);
  assert.match(html, /1\.0 KB/);
  assert.doesNotMatch(html, /rollout 1\.0 KB/);
  assert.match(html, /status status-normal/);
  assert.match(html, />normal</);
  assert.doesNotMatch(html, /1\.2K last/);
  assert.match(html, /cached 400 included/);
  assert.match(html, /reasoning 75 included/);
  assert.match(html, /thread total/);
  assert.match(html, /turn-usage-compact-metric is-thread-total/);
  assert.match(html, /2\.5K/);
  assert.match(html, /input 2\.0K \+ output 500/);
  assert.match(html, /cached 600 in input/);
  assert.match(html, /reasoning 125 in output/);
  assert.match(html, /project ctx file/);
  assert.match(html, /handoff file/);
  assert.doesNotMatch(html, /last turn/);
  assert.doesNotMatch(html, /context window/);
  assert.match(html, /pair 255\.0 KB/);
  assert.match(html, /data-new-thread-from-current/);
});

test("turn usage summary keeps missing workspace context file metrics visible", () => {
  const renderTurnUsageSummary = evaluatedTurnUsageSummaryRenderer();
  const html = renderTurnUsageSummary({
    mobileUsageSummary: {
      contextRiskLevel: "normal",
      contextWindowUsedPercent: 12,
      contextWindowUsedTokens: 12000,
      modelContextWindow: 100000,
      lastTokenUsage: { inputTokens: 1000, outputTokens: 200, totalTokens: 1200 },
      totalTokenUsage: { inputTokens: 2000, outputTokens: 500, totalTokens: 2500 },
      rolloutSizeBytes: 1024,
      rolloutWarningThresholdBytes: 2048,
      projectContextSizeBytes: 0,
      handoffSizeBytes: 0,
      workspaceContextPairSizeBytes: 0,
      workspaceContextFileThresholdBytes: 100 * 1024,
      workspaceHandoffPromptThresholdBytes: 200 * 1024,
      workspaceContextPairThresholdBytes: 200 * 1024,
    },
  });

  assert.match(html, /thread total/);
  assert.match(html, /project ctx file/);
  assert.match(html, /handoff file/);
  assert.match(html, /<strong>--<\/strong>/);
  assert.doesNotMatch(html, /pair /);
  assert.doesNotMatch(html, /data-new-thread-from-current/);
});

test("handoff usage prompt waits for the 200KB handoff threshold", () => {
  const renderTurnUsageSummary = evaluatedTurnUsageSummaryRenderer();
  const below = renderTurnUsageSummary({
    mobileUsageSummary: {
      handoffSizeBytes: 180 * 1024,
      projectContextSizeBytes: 20 * 1024,
      workspaceContextPairSizeBytes: 200 * 1024 - 1,
      workspaceContextFileThresholdBytes: 100 * 1024,
      workspaceHandoffPromptThresholdBytes: 200 * 1024,
      workspaceContextPairThresholdBytes: 200 * 1024,
    },
  });
  const above = renderTurnUsageSummary({
    mobileUsageSummary: {
      handoffSizeBytes: 201 * 1024,
      projectContextSizeBytes: 20 * 1024,
      workspaceContextPairSizeBytes: 221 * 1024,
      workspaceContextFileThresholdBytes: 100 * 1024,
      workspaceHandoffPromptThresholdBytes: 200 * 1024,
      workspaceContextPairThresholdBytes: 500 * 1024,
    },
  });

  assert.doesNotMatch(below, /data-new-thread-from-current/);
  assert.match(below, /warn 200\.0 KB/);
  assert.match(above, /data-new-thread-from-current/);
});

test("turn usage text keeps cached and reasoning as included subcomponents", () => {
  const tokenUsageSummaryText = evaluatedTokenUsageSummaryText();
  const text = tokenUsageSummaryText({
    inputTokens: 159639,
    cachedInputTokens: 158080,
    outputTokens: 805,
    reasoningOutputTokens: 395,
    totalTokens: 160444,
  });

  assert.match(text, /in 160K/);
  assert.match(text, /out 805/);
  assert.match(text, /cached 158K in input/);
  assert.match(text, /reasoning 395 in output/);
  assert.doesNotMatch(text, /in 159,639/);
});
