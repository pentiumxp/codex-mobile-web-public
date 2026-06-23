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
  let start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  if (source.slice(Math.max(0, start - 6), start) === "async ") start -= 6;
  const body = functionBodyFrom(source, name);
  const open = source.indexOf(") {", start) + 2;
  assert.notEqual(open, 1, `missing function body ${name}`);
  return `${source.slice(start, open + 1)}${body}}`;
}

function functionBody(name) {
  return functionBodyFrom(appJs, name);
}

function serverFunctionBody(name) {
  return functionBodyFrom(serverJs, name);
}

function evaluatedServerSupersededLivePruner() {
  const sources = [
    "isSupersededLiveTurn",
    "isUserQuestionItem",
    "userMessageContentParts",
    "imageUrlValueForUserMessagePart",
    "textValueForUserMessagePart",
    "isImageUserMessagePart",
    "textContainsRenderableUploadSummary",
    "userMessageHasVisualAttachment",
    "isMeaningfulSupersededLiveItem",
    "pruneSupersededLiveShellTurns",
  ].map((name) => functionSourceFrom(serverJs, name));
  return Function(`
function isReasoningOnlyItem(item) { return Boolean(item && item.type === "reasoning"); }
function isTurnUsageSummaryItem(item) { return Boolean(item && item.type === "turnUsageSummary"); }
function isOperationalItem(item) { return Boolean(item && item.type === "commandExecution"); }
function isAssistantReceiptItem(item) { return Boolean(item && item.type === "agentMessage"); }
function isVisualReceiptItem(item) { return Boolean(item && (item.type === "imageView" || item.type === "imageGeneration")); }
function isContextCompactionType(type) { return /context/i.test(String(type || "")); }
${sources.join("\n")}
return pruneSupersededLiveShellTurns;
`)();
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

function evaluatedInputContentRendererWithKey(key = "", options = {}) {
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
    "hermesPluginProxyPrefixFromPathname",
    "hermesPluginProxyPrefix",
    "protectedImageUpstreamPathname",
    "browserApiContentUrl",
    "authenticatedApiContentUrl",
    "protectedGeneratedImageSrc",
    "isHermesEmbedMode",
    "imageDiagnosticSourceKind",
    "shouldRenderProtectedImageDirectly",
    "protectedImageDisplaySrc",
    "imageLoadingModeForSource",
    "protectedImageSourceAttribute",
    "codexMobileUploadIdForPath",
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
  const pluginEmbed = options.embedded ? { embedded: true } : null;
  const pathname = options.pathname || "/";
  return Function(
    "URLSearchParams",
    `const state = { key: ${JSON.stringify(String(key || ""))}, pluginEmbed: ${JSON.stringify(pluginEmbed)} };\nconst window = { location: { origin: "http://127.0.0.1:8787", pathname: ${JSON.stringify(pathname)} } };\nconst THREAD_TASK_CARD_REQUEST_TAG = "codex-mobile-thread-task-card-request";\nconst PROTECTED_IMAGE_PLACEHOLDER_SRC = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";\n${sources.join("\n")}\nreturn renderInputContent;`,
  )(URLSearchParams);
}

function evaluatedLocalUserMessageItem() {
  const sources = [
    "formatFileSize",
    "localAttachmentPreviewUrl",
    "appendLocalAttachmentSummary",
    "localImageInputPartsForAttachments",
    "localUserMessageItem",
  ].map((name) => functionSourceFrom(appJs, name));
  return Function(`${sources.join("\n")}\nreturn localUserMessageItem;`)();
}

function evaluatedActiveRuntimeHarness() {
  const sources = [
    "statusText",
    "isStaleActiveStatus",
    "isRunningStatus",
    "isCompletedStatus",
    "isTurnComplete",
    "turnHasDisplayItems",
    "latestTurn",
    "latestRawTurn",
    "currentThreadHasActiveRuntimeStatus",
    "latestLiveTurnCandidate",
    "isLiveTurn",
    "shouldPollCurrentThread",
  ].map((name) => functionSourceFrom(appJs, name));
  return Function(`
const document = { visibilityState: "visible" };
const state = {
  activeTurnId: "",
  currentThreadId: "thread-1",
  currentThread: {
    id: "thread-1",
    status: { type: "active" },
    turns: [
      {
        id: "turn-old",
        status: { type: "completed" },
        startedAt: 1000,
        completedAt: 1010,
        durationMs: 10000,
        items: [{ id: "item-1", type: "userMessage" }],
      },
    ],
  },
};
function turnHasActiveLiveItems() { return false; }
function isIncompleteInterruptedTurn() { return false; }
function isLatestTurn(turn) { return Boolean(turn && latestTurn() === turn); }
${sources.join("\n")}
return {
  state,
  currentThreadHasActiveRuntimeStatus,
  shouldPollCurrentThread,
  currentLiveCandidate: () => latestLiveTurnCandidate(),
  latestIsLive: () => isLiveTurn(latestTurn()),
};
`)();
}

function evaluatedLiveOperationDockEntryHarness() {
  const sources = [
    "liveTurnStatusDockItem",
    "currentLiveOperationEntry",
  ].map((name) => functionSourceFrom(appJs, name));
  return Function(`
const state = {
  nowMs: 2000,
  activityAtMs: 0,
  currentThread: null,
};
function isLatestTurn(turn) {
  return Boolean(state.currentThread && Array.isArray(state.currentThread.turns)
    && state.currentThread.turns[state.currentThread.turns.length - 1] === turn);
}
function isLiveTurn(turn) { return Boolean(turn && turn.live); }
function isActiveOperationalItem(item) { return Boolean(item && item.activeOperation); }
function liveActivityLabelForTurn(turn) { return String(turn && turn.activityLabel || ""); }
function liveTurnFallbackActivityLabel() { return "运行"; }
function liveTurnStartedAtMs(turn) { return Number(turn && turn.startedAtMs || 0); }
function turnStartedAtMs() { return 0; }
${sources.join("\n")}
return { state, currentLiveOperationEntry };
`)();
}

function evaluatedOperationCommandHarness() {
  const sources = [
    "truncateSingleLine",
    "stripMatchingOuterQuotes",
    "operationArgumentsObject",
    "operationCommandText",
    "operationCommandSummary",
    "operationCommandName",
    "operationCommandGroupText",
    "operationSummaryLines",
  ].map((name) => functionSourceFrom(appJs, name));
  return Function(`
function shortPath(value) {
  if (!value) return "";
  return String(value).replace(/^\\\\\\\\\\?\\\\/, "").replace(/^.*[\\\\/]/, "");
}
${sources.join("\n")}
return { operationCommandText, operationCommandSummary, operationSummaryLines };
`)();
}

function evaluatedPendingAttachmentClearHarness() {
  const sources = [
    "revokeAttachmentPreviewUrls",
    "scheduleAttachmentPreviewUrlRevoke",
    "replacePendingAttachments",
    "clearPendingAttachments",
  ].map((name) => functionSourceFrom(appJs, name));
  const harness = Function(`
const revoked = [];
const timers = [];
const URL = { revokeObjectURL(value) { revoked.push(value); } };
const state = { pendingAttachments: [] };
function renderAttachmentList() {}
function scheduleCurrentDraftSave() {}
function currentDraftKey() { return "thread-draft"; }
function deleteDraftAttachments() { return Promise.resolve(); }
function postClientEvent() {}
function setTimeout(fn, delayMs) {
  timers.push({ fn, delayMs });
  return timers.length;
}
${sources.join("\n")}
return {
  state,
  revoked,
  timers,
  replacePendingAttachments,
  clearPendingAttachments,
};
  `)();
  return harness;
}

function evaluatedImageViewRenderer(options = {}) {
  const sources = [
    "escapeHtml",
    "shortPath",
    "normalizeFsPath",
    "isCodexMobileUploadPath",
    "hermesPluginProxyPrefixFromPathname",
    "hermesPluginProxyPrefix",
    "protectedImageUpstreamPathname",
    "browserApiContentUrl",
    "protectedGeneratedImageSrc",
    "isHermesEmbedMode",
    "imageDiagnosticSourceKind",
    "shouldRenderProtectedImageDirectly",
    "protectedImageDisplaySrc",
    "imageLoadingModeForSource",
    "protectedImageSourceAttribute",
    "codexMobileUploadIdForPath",
    "uploadFileUrl",
    "authenticatedApiContentUrl",
    "localFilePreviewContentUrl",
    "imageContentUrlForPath",
    "imageViewPath",
    "imageViewUrl",
    "imageViewContentUrl",
    "isImageViewUnavailable",
    "renderImageView",
  ].map((name) => functionSourceFrom(appJs, name));
  const pluginEmbed = options.embedded ? { embedded: true } : null;
  const pathname = options.pathname || "/";
  return Function(
    "URLSearchParams",
    `const state = { key: "test-key", currentThreadId: "thread-id", pluginEmbed: ${JSON.stringify(pluginEmbed)} };\nconst window = { location: { origin: "http://127.0.0.1:8787", pathname: ${JSON.stringify(pathname)} } };\nconst PROTECTED_IMAGE_PLACEHOLDER_SRC = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";\n${sources.join("\n")}\nreturn renderImageView;`,
  )(URLSearchParams);
}

function evaluatedConversationImageErrorHandler(options = {}) {
  const sources = [
    "failedAppImageContainer",
    "setRetryingAppImage",
    "markFailedAppImage",
    "clearFailedAppImage",
    "protectedImageUpstreamPathname",
    "protectedAppImageElementSrc",
    "protectedGeneratedImageSrc",
    "imageStillConnected",
    "protectedAppImageUrlApi",
    "revokeProtectedAppImageObjectUrl",
    "retryProtectedAppImageSource",
    "cacheBustedProtectedImageSrc",
    "shouldRecoverProtectedImageAsDirectUrl",
    "blobToDataUrl",
    "protectedAppImageRecoveredUrl",
    "applyProtectedAppImageRecoveredUrl",
    "handleProtectedAppImageError",
    "probeFailedAuthenticatedImage",
    "handleConversationImageError",
  ].map((name) => functionSourceFrom(appJs, name));
  return Function(
    "deps",
    `const window = deps.window;
const state = deps.state;
const fetch = deps.fetch;
const FileReader = deps.FileReader;
const isHermesEmbedMode = deps.isHermesEmbedMode;
const requestHermesPluginRefresh = deps.requestHermesPluginRefresh;
${sources.join("\n")}
return handleConversationImageError;`,
  )(Object.assign({
    window: { location: { origin: "http://127.0.0.1:8787" } },
    state: { key: "session-key", imageAuthRefreshRequested: false },
    fetch: () => Promise.reject(new Error("unexpected fetch")),
    FileReader: undefined,
    isHermesEmbedMode: () => false,
    requestHermesPluginRefresh: () => {},
  }, options));
}

function evaluatedConversationImageLoadHandler() {
  const sources = [
    "failedAppImageContainer",
    "setRetryingAppImage",
    "clearFailedAppImage",
    "handleConversationImageLoad",
  ].map((name) => functionSourceFrom(appJs, name));
  return Function(`${sources.join("\n")}\nreturn handleConversationImageLoad;`)();
}

function evaluatedFailedImageScanner(options = {}) {
  const sources = [
    "failedAppImageContainer",
    "setRetryingAppImage",
    "markFailedAppImage",
    "clearFailedAppImage",
    "imageHadExplicitLoadError",
    "isLazyAppImage",
    "protectedImageUpstreamPathname",
    "protectedGeneratedImageSrc",
    "imageDiagnosticSourceKind",
    "protectedAppImageElementSrc",
    "shouldRenderProtectedImageDirectly",
    "shouldProactivelyMarkFailedImage",
    "imageStillConnected",
    "protectedAppImageUrlApi",
    "revokeProtectedAppImageObjectUrl",
    "retryProtectedAppImageSource",
    "cacheBustedProtectedImageSrc",
    "shouldRecoverProtectedImageAsDirectUrl",
    "blobToDataUrl",
    "protectedAppImageRecoveredUrl",
    "applyProtectedAppImageRecoveredUrl",
    "handleProtectedAppImageError",
    "scanFailedAppImages",
  ].map((name) => functionSourceFrom(appJs, name));
  return Function(
    "deps",
    `const window = deps.window;
const state = deps.state;
const fetch = deps.fetch;
const FileReader = deps.FileReader;
const isHermesEmbedMode = deps.isHermesEmbedMode;
const requestHermesPluginRefresh = deps.requestHermesPluginRefresh;
${sources.join("\n")}
return scanFailedAppImages;`,
  )(Object.assign({
    window: { location: { origin: "http://127.0.0.1:8787" } },
    state: { key: "session-key", imageAuthRefreshRequested: false },
    fetch: () => Promise.reject(new Error("unexpected fetch")),
    FileReader: undefined,
    isHermesEmbedMode: () => false,
    requestHermesPluginRefresh: () => {},
  }, options));
}

function evaluatedProtectedImageHydrator(options = {}) {
  const sources = [
    "protectedGeneratedImageSrc",
    "protectedImageUpstreamPathname",
    "imageDiagnosticSourceKind",
    "shouldRenderProtectedImageDirectly",
    "imageStillConnected",
    "protectedAppImageElementSrc",
    "protectedAppImageUrlApi",
    "revokeProtectedAppImageObjectUrl",
    "cacheBustedProtectedImageSrc",
    "shouldRecoverProtectedImageAsDirectUrl",
    "blobToDataUrl",
    "protectedAppImageRecoveredUrl",
    "applyProtectedAppImageRecoveredUrl",
    "failedAppImageContainer",
    "setRetryingAppImage",
    "clearFailedAppImage",
    "isIosWebKitBrowser",
    "shouldHydrateProtectedAppImage",
    "hydrateProtectedAppImage",
    "hydrateProtectedAppImages",
  ].map((name) => functionSourceFrom(appJs, name));
  return Function(
    "deps",
    `const window = deps.window;
const state = deps.state;
const fetch = deps.fetch;
const FileReader = deps.FileReader;
const navigator = deps.navigator;
const isHermesEmbedMode = deps.isHermesEmbedMode;
const PROTECTED_IMAGE_PLACEHOLDER_SRC = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
${sources.join("\n")}
return hydrateProtectedAppImages;`,
  )(Object.assign({
    window: { location: { origin: "http://127.0.0.1:8787" } },
    state: { key: "session-key" },
    fetch: () => Promise.reject(new Error("unexpected fetch")),
    FileReader: undefined,
    navigator: { userAgent: "", vendor: "", platform: "", maxTouchPoints: 0 },
    isHermesEmbedMode: () => false,
  }, options));
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
    "isLikelyAbsoluteLocalPath",
    "canRenderImageAttachment",
    "isMuxUserMessage",
    "isOptimisticUserMessage",
    "isTurnUsageSummaryItem",
    "dedupeTurnUsageSummaryItems",
    "normalizeComparableText",
    "userMessageComparableParts",
    "userMessagePathOverlap",
    "comparablePathName",
    "comparablePathNamesLikelySame",
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
    "isLikelyAbsoluteLocalPath",
    "canRenderImageAttachment",
    "isMuxUserMessage",
    "isOptimisticUserMessage",
    "isTurnUsageSummaryItem",
    "dedupeTurnUsageSummaryItems",
    "normalizeComparableText",
    "userMessageComparableParts",
    "userMessagePathOverlap",
    "comparablePathName",
    "comparablePathNamesLikelySame",
    "imageViewPath",
    "imageViewContentUrl",
    "imageViewUrl",
    "isVisualReceiptItem",
    "visualReceiptComparableNames",
    "visualReceiptCallId",
    "visualReceiptSuppressionKeys",
    "suppressedVisualReceiptKeySet",
    "visualReceiptMatchesSuppressionKeys",
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
    "visibleTextItemsHaveStableSharedPrefix",
    "isAssistantReceiptLikeItem",
    "completedIncomingTurnHasAuthoritativeReceipt",
    "completedReceiptItemsLikelySame",
    "visibleTextItemsCanShareRenderIdentity",
    "shouldDropLocalOnlyReceiptForIncomingTurn",
    "shouldPreserveLocalOnlyItem",
    "findUnusedExistingItemIndexForIncoming",
    "mergeIncomingOrderedItem",
    "mergeVisibleTextItemPreservingRenderIdentity",
    "insertLocalOnlyItemByExistingOrder",
    "mergeItemsPreservingLocalVisible",
  ].map((name) => functionSourceFrom(appJs, name));
  return Function(`
function itemVisibleWeight(item) { return JSON.stringify(item || {}).length; }
function mergeItemPreservingVisibleFields(existingItem, incomingItem) {
  return Object.assign({}, existingItem || {}, incomingItem || {});
}
function dedupeTurnUsageSummaryItems(items) { return items || []; }
${sources.join("\n")}
return mergeItemsPreservingLocalVisible;
	`)();
}

function evaluatedMergeItemsPreservingLocalVisibleWithRealVisibleWeight() {
  const sources = [
    "statusText",
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
    "isLikelyAbsoluteLocalPath",
    "canRenderImageAttachment",
    "isMuxUserMessage",
    "isOptimisticUserMessage",
    "isTurnUsageSummaryItem",
    "dedupeTurnUsageSummaryItems",
    "normalizeComparableText",
    "userMessageComparableParts",
    "userMessagePathOverlap",
    "comparablePathName",
    "comparablePathNamesLikelySame",
    "imageViewPath",
    "imageViewContentUrl",
    "imageViewUrl",
    "isVisualReceiptItem",
    "visualReceiptComparableNames",
    "visualReceiptCallId",
    "visualReceiptSuppressionKeys",
    "suppressedVisualReceiptKeySet",
    "visualReceiptMatchesSuppressionKeys",
    "userMessagePathNameOverlap",
    "userMessageSpecificity",
    "userMessagesLikelySame",
    "userMessagesCanShadow",
    "hasMatchingIncomingUserMessage",
    "hasMatchingRealUserMessage",
    "removeShadowedMuxUserMessages",
    "imageSourceSignature",
    "compactStructuredForSignature",
    "inputContentSignature",
    "visibleItemSignature",
    "itemVisibleWeight",
    "userMessageShadowPriority",
    "mergeItemPreservingVisibleFields",
    "mergeLikelySameUserMessage",
    "dedupeLikelySameUserMessages",
    "comparableVisibleTextItem",
    "comparableVisibleText",
    "visibleTextItemsLikelySame",
    "visibleTextItemsHaveStableSharedPrefix",
    "isAssistantReceiptLikeItem",
    "completedIncomingTurnHasAuthoritativeReceipt",
    "completedReceiptItemsLikelySame",
    "visibleTextItemsCanShareRenderIdentity",
    "shouldDropLocalOnlyReceiptForIncomingTurn",
    "shouldPreserveLocalOnlyItem",
    "findUnusedExistingItemIndexForIncoming",
    "mergeIncomingOrderedItem",
    "mergeVisibleTextItemPreservingRenderIdentity",
    "insertLocalOnlyItemByExistingOrder",
    "mergeItemsPreservingLocalVisible",
  ].map((name) => functionSourceFrom(appJs, name));
  return Function(`
function truncateMiddle(value) { return String(value || ""); }
function isReasoningItem(item) { return Boolean(item && item.type === "reasoning"); }
function isContextCompactionItem() { return false; }
function contextCompactionNotice() { return null; }
function isOperationalItem() { return false; }
function operationDetailText() { return ""; }
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
    "isLikelyAbsoluteLocalPath",
    "canRenderImageAttachment",
    "isMuxUserMessage",
    "isOptimisticUserMessage",
    "isTurnUsageSummaryItem",
    "normalizeComparableText",
    "userMessageComparableParts",
    "userMessagePathOverlap",
    "comparablePathName",
    "comparablePathNamesLikelySame",
    "imageViewPath",
    "imageViewContentUrl",
    "imageViewUrl",
    "isVisualReceiptItem",
    "visualReceiptComparableNames",
    "visualReceiptCallId",
    "visualReceiptSuppressionKeys",
    "suppressedVisualReceiptKeySet",
    "visualReceiptMatchesSuppressionKeys",
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
    "userMessageHasVisualAttachment",
    "normalizeThreadVisibleUserMessages",
    "shouldDropOptimisticUserMessageForDurable",
    "threadDurableUserMessages",
    "shouldDropInitialSubmissionEchoTurn",
    "threadHasInitialSubmissionEcho",
    "isV4ProjectionThread",
    "shouldPreserveV4PendingOverlayItem",
    "v4ThreadHasPendingMatch",
    "appendV4PendingOverlayItem",
    "copyTurnWithOnlyItems",
    "applyV4PendingOverlay",
    "v4ProjectionRevisionValue",
    "isV4ProjectionRefreshRegressive",
    "isActiveLikeProjectionTurn",
    "incomingTurnsClearlySupersedeExistingTurn",
    "existingV4TurnHasOnlyMatchedPendingItems",
    "shouldPreserveExistingV4ProjectionTurn",
    "mergeV4ProjectionThread",
    "comparableVisibleTextItem",
    "comparableVisibleText",
    "visibleTextItemsLikelySame",
    "visibleTextItemsHaveStableSharedPrefix",
    "isAssistantReceiptLikeItem",
    "completedIncomingTurnHasAuthoritativeReceipt",
    "completedReceiptItemsLikelySame",
    "visibleTextItemsCanShareRenderIdentity",
    "shouldDropLocalOnlyReceiptForIncomingTurn",
    "shouldPreserveLocalOnlyItem",
    "findUnusedExistingItemIndexForIncoming",
    "mergeIncomingOrderedItem",
    "mergeItemPreservingVisibleFields",
    "mergeVisibleTextItemPreservingRenderIdentity",
    "insertLocalOnlyItemByExistingOrder",
    "mergeItemsPreservingLocalVisible",
    "shouldPreserveLiveTurnLocalVisibleItems",
    "mergeTurnPreservingVisibleItems",
    "mergeThreadPreservingVisibleItems",
  ].map((name) => functionSourceFrom(appJs, name));
  return Function(`
const MAX_EXPANDED_VISIBLE_TURNS = 40;
const state = { activeTurnId: "local-start-turn", currentThreadId: "thread-new" };
function isReasoningItem(item) { return Boolean(item && item.type === "reasoning"); }
function isContextCompactionItem() { return false; }
function isOperationalItem() { return false; }
function isRecentlySubmittedUserMessage(item) { return Boolean(item && item.mobilePendingSubmission); }
function itemVisibleWeight(item) { return item ? JSON.stringify(item).length : 0; }
function dedupeTurnUsageSummaryItems(items) { return items || []; }
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
function isRunningStatus(status) {
  const text = String(status && status.type || status || "").toLowerCase();
  return /active|running|queued|processing|inprogress|in_progress|in-progress|pending|started/.test(text);
}
function isIncompleteInterruptedTurn() { return false; }
function turnHasActiveLiveItems(turn) {
  return (turn && Array.isArray(turn.items) ? turn.items : []).some((item) => item && item.status && !/completed|failed|canceled|cancelled/.test(String(item.status.type || item.status).toLowerCase()));
}
function turnOrderMs(turn) {
  return Number(turn && (turn.completedAtMs || turn.completedAt || turn.startedAtMs || turn.startedAt || 0)) || 0;
}
function turnIsSupersededBy() { return false; }
function sortTurnsForDisplay(turns) { return turns || []; }
function maxVisibleTurnsForThread() { return 10; }
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
    "isLikelyAbsoluteLocalPath",
    "canRenderImageAttachment",
    "isMuxUserMessage",
    "isOptimisticUserMessage",
    "normalizeComparableText",
    "userMessageComparableParts",
    "userMessagePathOverlap",
    "comparablePathName",
    "comparablePathNamesLikelySame",
    "userMessagePathNameOverlap",
    "userMessageSpecificity",
    "userMessagesLikelySame",
    "userMessagesCanShadow",
    "hasMatchingRealUserMessage",
    "removeShadowedMuxUserMessages",
    "userMessageShadowPriority",
    "mergeLikelySameUserMessage",
    "dedupeLikelySameUserMessages",
    "userMessageHasVisualAttachment",
    "normalizeThreadVisibleUserMessages",
    "shouldDropOptimisticUserMessageForDurable",
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
    "isLikelyAbsoluteLocalPath",
    "canRenderImageAttachment",
    "isMuxUserMessage",
    "isOptimisticUserMessage",
    "isTurnUsageSummaryItem",
    "normalizeComparableText",
    "userMessageComparableParts",
    "userMessagePathOverlap",
    "comparablePathName",
    "comparablePathNamesLikelySame",
    "userMessagePathNameOverlap",
    "userMessagesLikelySame",
    "userMessagesCanShadow",
    "hasMatchingRealUserMessage",
    "removeShadowedMuxUserMessages",
    "userMessageShadowPriority",
    "mergeLikelySameUserMessage",
    "dedupeLikelySameUserMessages",
    "userMessageHasVisualAttachment",
    "normalizeThreadVisibleUserMessages",
    "shouldDropOptimisticUserMessageForDurable",
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
    "isLikelyAbsoluteLocalPath",
    "canRenderImageAttachment",
    "isMuxUserMessage",
    "isOptimisticUserMessage",
    "isTurnUsageSummaryItem",
    "normalizeComparableText",
    "userMessageComparableParts",
    "userMessagePathOverlap",
    "comparablePathName",
    "comparablePathNamesLikelySame",
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
    "userMessageHasVisualAttachment",
    "shouldHideDurableLiveUserMessage",
    "isSupersededLiveTurn",
    "shouldHideSupersededLiveUserMessage",
    "isRawThreadReadMode",
    "shouldPreserveRawThreadVisibleEntry",
    "limitRawThreadVisibleEntries",
    "visibleItemsForTurn",
  ].map((name) => functionSourceFrom(appJs, name));
  return Function(`
const RECENT_SUBMITTED_USER_MESSAGE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_RAW_THREAD_VISIBLE_ITEMS_PER_TURN = 24;
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
    "latestRawTurn",
    "latestLiveTurnCandidate",
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
    "isLikelyAbsoluteLocalPath",
    "canRenderImageAttachment",
    "localSubmittedTurnId",
    "currentThreadHasClientSubmission",
    "insertLocalSubmittedUserMessage",
    "isMuxUserMessage",
    "isOptimisticUserMessage",
    "isTurnUsageSummaryItem",
    "dedupeTurnUsageSummaryItems",
    "normalizeComparableText",
    "userMessageComparableParts",
    "userMessagePathOverlap",
    "comparablePathName",
    "comparablePathNamesLikelySame",
    "userMessagePathNameOverlap",
    "userMessageSpecificity",
    "userMessagesLikelySame",
    "userMessagesCanShadow",
    "hasMatchingRealUserMessage",
    "removeShadowedMuxUserMessages",
    "userMessageShadowPriority",
    "mergeLikelySameUserMessage",
    "dedupeLikelySameUserMessages",
    "userMessageHasVisualAttachment",
    "normalizeThreadVisibleUserMessages",
    "shouldDropOptimisticUserMessageForDurable",
    "mergeSubmittedUserItemIntoTurn",
    "reconcileSubmittedUserMessageTurn",
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
function isReasoningItem() { return false; }
function itemVisibleWeight(item) { return JSON.stringify(item || {}).length; }
`,
    sources.join("\n"),
    `
return {
  state,
  insertLocalSubmittedUserMessage,
  reconcileSubmittedUserMessageTurn,
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
  assert.match(functionBody("visibleItemsForTurn"), /return limitRawThreadVisibleEntries\(filtered\)/);
  assert.match(functionBody("visibleItemSignature"), /isContextCompactionItem\(item\)/);
  assert.match(functionBody("visibleItemSignature"), /const notice = contextCompactionNotice\(item, turn\)/);
  assert.match(functionBody("visibleItemSignature"), /if \(!notice\) return null/);
  assert.match(functionBody("visibleItemSignature"), /mobileCompactionStatus: item\.mobileCompactionStatus/);
  assert.match(functionBody("visibleItemSignature"), /notice,/);
  assert.match(functionBody("conversationRenderSignature"), /visibleItemSignature\(entry\.item, turn\)/);
});

test("raw thread read mode limits visible items per turn while preserving user images", () => {
  const helpers = evaluatedVisibleItemsForTurn();
  helpers.state.currentThread.mobileRawThreadRead = true;
  const turn = {
    id: "raw-turn",
    status: "completed",
    items: [
      { type: "agentMessage", id: "old-1", text: "old" },
      { type: "userMessage", id: "user-image", content: [{ type: "input_image", image_url: "/api/uploads/file?path=/tmp/a.jpg" }] },
      ...Array.from({ length: 40 }, (_, index) => ({ type: "agentMessage", id: `agent-${index}`, text: `message ${index}` })),
    ],
  };
  const visible = helpers.visibleItemsForTurn(turn).map((entry) => entry.item.id);
  assert.ok(visible.length < turn.items.length);
  assert.ok(visible.includes("user-image"));
  assert.ok(visible.includes("agent-39"));
  assert.equal(visible.includes("old-1"), false);
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

test("live operation dock keeps a status row while active turn is reasoning only", () => {
  assert.match(appJs, /function liveTurnStatusDockItem\(turn\)/);
  assert.match(functionBody("currentLiveOperationEntry"), /liveTurnStatusDockItem\(turn\)/);
  assert.match(functionBody("liveTurnStatusDockItem"), /title: "Command"/);
  assert.doesNotMatch(functionBody("liveTurnStatusDockItem"), /liveActivityLabelForTurn/);
  assert.match(functionBody("operationTitle"), /if \(item && item\.title\) return item\.title;/);
  assert.match(functionBody("operationSummaryLines"), /item\.type === "liveTurnStatus"/);
  assert.match(functionBody("renderLiveOperation"), /item && item\.type === "liveTurnStatus"[\s\S]*\? ""/);

  const harness = evaluatedLiveOperationDockEntryHarness();
  const turn = {
    id: "turn-reasoning",
    live: true,
    activityLabel: "思考",
    startedAtMs: 1000,
    items: [{ id: "reasoning-1", type: "reasoning" }],
  };
  harness.state.currentThread = { id: "thread-1", turns: [turn] };

  const statusEntry = harness.currentLiveOperationEntry(harness.state.currentThread);
  assert.equal(statusEntry.turn, turn);
  assert.equal(statusEntry.sourceIndex, -1);
  assert.equal(statusEntry.item.type, "liveTurnStatus");
  assert.equal(statusEntry.item.title, "Command");
  assert.equal(statusEntry.item.status, "");
  assert.equal(statusEntry.item.startedAtMs, undefined);

  const command = { id: "cmd-1", type: "commandExecution", activeOperation: true };
  turn.items.push(command);
  const commandEntry = harness.currentLiveOperationEntry(harness.state.currentThread);
  assert.equal(commandEntry.item, command);
  assert.equal(commandEntry.sourceIndex, 1);
});

test("command operation detail reads command from serialized arguments on macOS", () => {
  assert.match(appJs, /function operationCommandText\(item\)/);
  assert.match(functionBody("operationCommandText"), /args\.command \|\| args\.cmd \|\| args\.shellCommand \|\| args\.shell_command/);
  assert.match(functionBody("operationCommandSummary"), /operationCommandText\(item\)/);
  assert.match(functionBody("operationCommandName"), /operationCommandText\(item\)/);
  assert.match(functionBody("operationSummaryLines"), /operationCommandText\(item\)/);
  assert.match(functionBody("visibleItemSignature"), /command: operationCommandText\(item\)/);

  const harness = evaluatedOperationCommandHarness();
  const item = {
    type: "commandExecution",
    arguments: JSON.stringify({ cmd: "npm run check" }),
  };
  assert.equal(harness.operationCommandText(item), "npm run check");
  assert.equal(harness.operationCommandSummary(item), "npm run check");
  assert.deepEqual(harness.operationSummaryLines(item), ["npm run check"]);
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

test("superseded live turns keep uploaded image user messages while hiding stale text steering", () => {
  const { visibleItemsForTurn } = evaluatedVisibleItemsForTurn();
  const uploadPath = "/Users/xuxin/.codex-mobile-web/uploads/2026-06-20/thread-id/1781938485528-homeai-upload-080D5F0E.jpg";
  const turn = {
    status: { type: "completed", mobileSupersededLive: true, previousType: "inProgress" },
    items: [
      { id: "old-user-text", type: "userMessage", content: [{ type: "input_text", text: "old steering prompt" }] },
      {
        id: "old-user-image",
        type: "userMessage",
        content: [{
          type: "input_text",
          text: `Uploaded attachments:\n- homeai-upload-080D5F0E.jpg (image, image/jpeg, 125.6 KB): ${uploadPath}`,
        }],
      },
      { id: "receipt", type: "agentMessage", text: "done" },
    ],
  };

  assert.deepEqual(
    visibleItemsForTurn(turn).map((entry) => entry.item.id),
    ["old-user-image", "receipt"],
  );
});

test("server projection pruning keeps uploaded image user messages in superseded live turns", () => {
  const pruneSupersededLiveShellTurns = evaluatedServerSupersededLivePruner();
  const uploadPath = "/Users/xuxin/.codex-mobile-web/uploads/2026-06-20/thread-id/1781938485528-homeai-upload-080D5F0E.jpg";
  const thread = {
    turns: [
      {
        id: "superseded-with-image",
        status: { type: "completed", mobileSupersededLive: true, previousType: "inProgress" },
        items: [
          { id: "plain-user", type: "userMessage", content: [{ type: "input_text", text: "old prompt" }] },
          {
            id: "image-user",
            type: "userMessage",
            content: [{
              type: "input_text",
              text: `Uploaded attachments:\n- homeai-upload-080D5F0E.jpg (image, image/jpeg, 125.6 KB): ${uploadPath}`,
            }],
          },
          { id: "reasoning", type: "reasoning", text: "hidden" },
          { id: "receipt", type: "agentMessage", text: "done" },
        ],
      },
      {
        id: "superseded-user-only",
        mobileSupersededLive: true,
        items: [
          {
            id: "image-user-only",
            type: "userMessage",
            content: [{ type: "input_image", image_url: { url: "data:image/png;base64,AAAA" } }],
          },
        ],
      },
      {
        id: "superseded-text-only",
        mobileSupersededLive: true,
        items: [{ id: "plain-only", type: "userMessage", text: "old prompt" }],
      },
    ],
  };

  pruneSupersededLiveShellTurns(thread);

  assert.deepEqual(
    thread.turns.map((turn) => [turn.id, turn.items.map((item) => item.id)]),
    [
      ["superseded-with-image", ["image-user", "receipt"]],
      ["superseded-user-only", ["image-user-only"]],
    ],
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

test("live turn keeps uploaded image user messages after progress starts", () => {
  const harness = evaluatedVisibleItemsForTurn();
  const uploadPath = "/Users/xuxin/.codex-mobile-web/uploads/2026-06-20/thread-id/1781938485528-homeai-upload-080D5F0E.jpg";
  const liveTurn = {
    live: true,
    items: [
      { id: "real-user-old", type: "userMessage", content: [{ type: "text", text: "old steer" }] },
      { id: "assistant-progress", type: "agentMessage", text: "working" },
      {
        id: "real-user-image",
        type: "userMessage",
        content: [{
          type: "input_text",
          text: `Uploaded attachments:\n- homeai-upload-080D5F0E.jpg (image, image/jpeg, 125.6 KB): ${uploadPath}`,
        }],
      },
      { id: "real-user-trailing", type: "userMessage", content: [{ type: "input_text", text: "stale trailing steer" }] },
      { id: "cmd-1", type: "commandExecution", status: "running" },
    ],
  };

  assert.deepEqual(
    harness.visibleItemsForTurn(liveTurn).map((entry) => entry.item.id),
    ["real-user-old", "assistant-progress", "real-user-image"],
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

test("active timer can follow an empty active tail when no display live turn exists", () => {
  const harness = evaluatedLatestTurnHelpers();
  harness.state.currentThread.turns = [
    { id: "completed", status: "completed", completedAt: 1781141506, items: [{ id: "final", type: "agentMessage", text: "done" }] },
    { id: "empty-active-tail", status: "inProgress", itemsView: "notLoaded", items: [] },
  ];
  assert.equal(harness.latestTurn().id, "completed");
  assert.equal(harness.syncActiveTurnFromThread(), undefined);
  assert.equal(harness.state.activeTurnId, "empty-active-tail");
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

test("existing thread send reconciles local pending turn to returned server turn id", () => {
  const harness = evaluatedLocalSubmissionInserter();
  harness.insertLocalSubmittedUserMessage("thread-live", "推送Public", [], "submit-public");

  const reconciled = harness.reconcileSubmittedUserMessageTurn("thread-live", "submit-public", "server-turn-public");

  assert.equal(reconciled, true);
  assert.equal(harness.state.currentThread.turns.length, 1);
  assert.equal(harness.state.currentThread.turns[0].id, "server-turn-public");
  assert.equal(harness.state.currentThread.turns[0].items.length, 1);
  assert.equal(harness.state.currentThread.turns[0].items[0].clientSubmissionId, "submit-public");
  assert.equal(harness.state.currentThread.turns[0].items[0].mobilePendingSubmission, true);
  assert.deepEqual(harness.counters(), { mergeCount: 2, syncCount: 2 });
});

test("local pending image attachments render browser previews before upload projection catches up", () => {
  const localUserMessageItem = evaluatedLocalUserMessageItem();
  const renderInputContent = evaluatedInputContentRenderer();
  const item = localUserMessageItem("看一下", [{
    previewUrl: "blob:http://127.0.0.1:8787/local-preview",
    file: {
      name: "homeai-upload-AFF20AEE-D062-4735-9F77-8ABB86CC9277.jpg",
      type: "image/jpeg",
      size: 121010,
    },
  }], "submit-image");

  assert.equal(item.content.length, 2);
  assert.equal(item.content[1].type, "input_image");
  assert.equal(item.content[1].image_url.url, "blob:http://127.0.0.1:8787/local-preview");

  const html = renderInputContent(item.content);
  assert.match(html, /class="input-image"/);
  assert.match(html, /src="blob:http:\/\/127\.0\.0\.1:8787\/local-preview"/);
  assert.doesNotMatch(html, /class="input-attachment"[\s\S]*homeai-upload-AFF20AEE/);
  assert.doesNotMatch(html, /\/api\/uploads\/file\?path=homeai-upload-AFF20AEE/);
});

test("successful sends keep local pending image blob previews alive until durable projection can replace them", () => {
  const harness = evaluatedPendingAttachmentClearHarness();
  harness.state.pendingAttachments = [
    { previewUrl: "blob:http://127.0.0.1:8787/pending-image" },
  ];

  harness.clearPendingAttachments({ revokePreviewUrls: false });

  assert.equal(harness.state.pendingAttachments.length, 0);
  assert.deepEqual(harness.revoked, []);
  assert.equal(harness.timers.length, 1);
  assert.ok(harness.timers[0].delayMs >= 1000);
  harness.timers[0].fn();
  assert.deepEqual(harness.revoked, ["blob:http://127.0.0.1:8787/pending-image"]);
});

test("replacing unsent attachments still revokes stale local image blobs immediately", () => {
  const harness = evaluatedPendingAttachmentClearHarness();
  harness.state.pendingAttachments = [
    { previewUrl: "blob:http://127.0.0.1:8787/old-image" },
  ];

  harness.replacePendingAttachments([
    { previewUrl: "blob:http://127.0.0.1:8787/new-image" },
  ]);

  assert.deepEqual(harness.revoked, ["blob:http://127.0.0.1:8787/old-image"]);
  assert.equal(harness.state.pendingAttachments.length, 1);
  assert.equal(harness.state.pendingAttachments[0].previewUrl, "blob:http://127.0.0.1:8787/new-image");
});

test("live detail refresh can patch changed visible items without replacing the whole turn", () => {
  assert.match(appJs, /function patchVisibleItemDomNode\(/);
  assert.match(appJs, /function visibleItemPatchEntries\(/);
  assert.match(appJs, /function visibleItemPatchShapePreservesExisting\(/);
  assert.match(appJs, /function patchVisibleItemsOnlyFromRefresh\(/);
  assert.match(functionBody("patchVisibleItemsOnlyFromRefresh"), /!isLatestTurn\(nextTurn\)/);
  assert.doesNotMatch(functionBody("patchVisibleItemsOnlyFromRefresh"), /!isLiveTurn\(nextTurn\)/);
  assert.match(functionBody("patchVisibleItemsOnlyFromRefresh"), /visibleItemPatchShapePreservesExisting\(previousEntries, nextEntries\)/);
  assert.match(functionBody("patchVisibleItemsOnlyFromRefresh"), /article\.insertBefore\(source, lastPatchedNode \? lastPatchedNode\.nextSibling : article\.firstChild\)/);
  assert.match(functionBody("patchVisibleItemsOnlyFromRefresh"), /patchVisibleItemDomNode\(nextTurn, nextEntry\.item, previousKeys, nextEntry\.sourceIndex\)/);
  assert.match(functionBody("patchCurrentThreadDetailFromRefresh"), /patchVisibleItemsOnlyFromRefresh\(previousTurn, turn, previousKeys\)/);
});

test("visible item refresh patch shape preserves existing keys while appending usage", () => {
  const preservesExisting = Function(`${functionSourceFrom(appJs, "visibleItemPatchShapePreservesExisting")}\nreturn visibleItemPatchShapePreservesExisting;`)();

  assert.equal(
    preservesExisting(
      [{ key: "turn-current:user" }, { key: "turn-current:receipt" }],
      [{ key: "turn-current:user" }, { key: "turn-current:receipt" }, { key: "turn-current:usage" }],
    ),
    true,
  );
  assert.equal(
    preservesExisting(
      [{ key: "turn-current:user" }, { key: "turn-current:receipt" }],
      [{ key: "turn-current:receipt" }, { key: "turn-current:user" }, { key: "turn-current:usage" }],
    ),
    false,
  );
  assert.equal(
    preservesExisting(
      [{ key: "turn-current:user" }, { key: "turn-current:receipt" }],
      [{ key: "turn-current:user" }, { key: "turn-current:usage" }],
    ),
    false,
  );
});

test("turn timer prefers live item activity over idle sync labels", () => {
  assert.match(appJs, /function liveActivityLabelForTurn\(/);
  assert.match(appJs, /function activeLiveOperationItemForTurn\(/);
  assert.match(appJs, /function currentThreadHasActiveRuntimeStatus\(/);
  assert.match(appJs, /function activeThreadFallbackElapsedSeconds\(/);
  assert.match(appJs, /function activeThreadFallbackActivityLabel\(/);
  assert.match(functionBody("liveActivityLabelForTurn"), /const operation = activeLiveOperationItemForTurn\(turn\);/);
  assert.match(functionBody("liveActivityLabelForTurn"), /if \(operation\) return activityLabelForItem\(operation\);/);
  assert.match(appJs, /function turnHasActiveLiveItems\(/);
  assert.match(appJs, /function liveTurnStartedAtMs\(/);
  assert.match(functionBody("isLiveTurn"), /turnHasActiveLiveItems\(turn\)/);
  assert.match(functionBody("isLiveTurn"), /isLatestTurn\(turn\) && currentThreadHasActiveRuntimeStatus\(\)/);
  assert.match(functionBody("turnElapsedSeconds"), /liveTurnStartedAtMs\(turn\) \|\| state\.nowMs/);
  assert.match(functionBody("turnHasActiveLiveItems"), /isActiveOperationalItem\(item\)/);
  assert.match(functionBody("liveTurnStartedAtMs"), /numericTimestampMs\(item\.startedAtMs\)/);
  assert.match(functionBody("liveActivityLabelForTurn"), /item\.type === "reasoning"[\s\S]*return "思考"/);
  assert.match(functionBody("activeLiveOperationItemForTurn"), /isActiveOperationalItem\(item\)[\s\S]*return item/);
  assert.match(functionBody("markIdleActivity"), /const liveTurn = currentLiveTurn\(\);/);
  assert.match(functionBody("markIdleActivity"), /if \(liveActivityLabelForTurn\(liveTurn\)\) return;/);
  assert.match(functionBody("markIdleActivity"), /if \(isIdleSyncActivityLabel\(label\) && liveTurn\) return;/);
  assert.match(functionBody("updateTurnTimer"), /liveActivityLabelForTurn\(turn\) \|\| liveTurnFallbackActivityLabel\(turn\)/);
  assert.match(functionBody("updateTurnTimer"), /if \(currentThreadHasActiveRuntimeStatus\(\)\) \{[\s\S]*activeThreadFallbackElapsedSeconds\(latest\)[\s\S]*activeThreadFallbackActivityLabel\(\)/);
  assert.match(functionBody("updateTickTimer"), /if \(!currentLiveTurn\(\) && !currentThreadHasActiveRuntimeStatus\(\)\) return;/);
  assert.match(functionBody("liveTurnFallbackActivityLabel"), /return "运行";/);
});

test("thread-level active status keeps polling through stale completed latest turn rows", () => {
  const harness = evaluatedActiveRuntimeHarness();
  assert.equal(harness.currentThreadHasActiveRuntimeStatus(), true);
  assert.equal(harness.currentLiveCandidate(), null);
  assert.equal(harness.latestIsLive(), false);
  assert.equal(harness.shouldPollCurrentThread(), true);

  harness.state.currentThread.status = { type: "active", mobileStaleActiveTurn: true };
  assert.equal(harness.currentThreadHasActiveRuntimeStatus(), false);
  assert.equal(harness.shouldPollCurrentThread(), false);
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
  assert.match(appJs, /function findUnusedExistingItemIndexForIncoming\(/);
  assert.match(appJs, /function mergeIncomingOrderedItem\(/);
  assert.match(functionBody("mergeItemsPreservingLocalVisible"), /for \(const incomingItem of incomingItems \|\| \[\]\)/);
  assert.match(functionBody("mergeItemsPreservingLocalVisible"), /findUnusedExistingItemIndexForIncoming\(incomingItem, existingItems \|\| \[\], usedExistingIndexes, incomingTurn\)/);
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
  assert.match(html, /src="data:image\/gif;base64,R0lGODlhAQABAIAAAAAAAP\/\/\/ywAAAAAAQABAAACAUwAOw=="/);
  assert.match(html, /data-protected-image-src="\/api\/uploads\/file\?id=/);
  assert.doesNotMatch(html, /data-protected-image-src="[^"]*path=/);
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
  assert.match(html, /src="data:image\/gif;base64,R0lGODlhAQABAIAAAAAAAP\/\/\/ywAAAAAAQABAAACAUwAOw=="/);
  assert.match(html, /data-protected-image-src="\/api\/uploads\/file\?id=/);
  assert.doesNotMatch(html, /data-protected-image-src="[^"]*path=/);
  assert.match(html, /IMG_5435\.jpg/);
  assert.doesNotMatch(html, /Uploaded attachments:/);
});

test("Hermes embedded upload summaries render direct image sources with hydrate fallback", () => {
  const renderInputContent = evaluatedInputContentRendererWithKey("test-key", { embedded: true });
  const uploadPath = "/Users/example/.codex-mobile-web/uploads/2026-06-20/thread/1781956411989-photo.jpg";
  const html = renderInputContent([
    {
      type: "input_text",
      text: `Uploaded attachments:\n- IMG_6086.jpg (image, image/jpeg, 110.6 KB): ${uploadPath}`,
    },
  ]);

  assert.match(html, /class="input-image"/);
  assert.match(html, /<img src="\/api\/uploads\/file\?id=2026-06-20%2Fthread%2F1781956411989-photo\.jpg&amp;key=test-key"/);
  assert.doesNotMatch(html, /src="data:image\/gif;base64/);
  assert.match(html, /data-protected-image-src="\/api\/uploads\/file\?id=2026-06-20%2Fthread%2F1781956411989-photo\.jpg&amp;key=test-key"/);
  assert.doesNotMatch(html, /<img src="[^"]*(?:\/Users|%2FUsers|\.codex-mobile-web|path=)/);
});

test("Hermes proxy embedded upload summaries render proxy-scoped image sources", () => {
  const renderInputContent = evaluatedInputContentRendererWithKey("test-key", {
    embedded: true,
    pathname: "/api/hermes-plugins/codex-mobile/proxy/",
  });
  const uploadPath = "/Users/example/.codex-mobile-web/uploads/2026-06-23/thread/1782214683627-photo.jpg";
  const html = renderInputContent([
    {
      type: "input_text",
      text: `Uploaded attachments:\n- homeai-upload.jpg (image, image/jpeg, 157.2 KB): ${uploadPath}`,
    },
  ]);

  assert.match(html, /class="input-image"/);
  assert.match(html, /<img src="\/api\/hermes-plugins\/codex-mobile\/proxy\/api\/uploads\/file\?id=2026-06-23%2Fthread%2F1782214683627-photo\.jpg&amp;key=test-key"/);
  assert.match(html, /data-protected-image-src="\/api\/hermes-plugins\/codex-mobile\/proxy\/api\/uploads\/file\?id=2026-06-23%2Fthread%2F1782214683627-photo\.jpg&amp;key=test-key"/);
  assert.doesNotMatch(html, /<img src="\/api\/uploads\/file/);
  assert.doesNotMatch(html, /(?:\/Users|%2FUsers|\.codex-mobile-web|path=)/);
});

test("imageView upload screenshots use opaque uploads route instead of file preview", () => {
  const renderImageView = evaluatedImageViewRenderer();
  const html = renderImageView({
    type: "imageView",
    path: "/Users/xuxin/.codex-mobile-web/uploads/2026-06-08/thread-id/1780893354486-IMG_1618.jpg",
  });

  assert.match(html, /class="image-view"/);
  assert.match(html, /src="data:image\/gif;base64,R0lGODlhAQABAIAAAAAAAP\/\/\/ywAAAAAAQABAAACAUwAOw=="/);
  assert.match(html, /data-protected-image-src="\/api\/uploads\/file\?id=2026-06-08%2Fthread-id%2F1780893354486-IMG_1618\.jpg&amp;key=test-key"/);
  assert.doesNotMatch(html, /data-protected-image-src="[^"]*(?:\/Users|%2FUsers|\.codex-mobile-web|path=)/);
  assert.doesNotMatch(html, /\/api\/files\/preview\/content/);
});

test("protected image auth recovery covers uploaded images", () => {
  assert.match(functionBody("protectedImageUpstreamPathname"), /"\/api\/generated-images\/file"/);
  assert.match(functionBody("protectedImageUpstreamPathname"), /"\/api\/uploads\/file"/);
  assert.match(functionBody("protectedImageUpstreamPathname"), /"\/api\/files\/preview\/content"/);
  assert.match(functionBody("protectedGeneratedImageSrc"), /protectedImageUpstreamPathname\(parsed\.pathname\)/);
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
  assert.match(html, /<img src="data:image\/gif;base64,R0lGODlhAQABAIAAAAAAAP\/\/\/ywAAAAAAQABAAACAUwAOw=="/);
  assert.match(html, /data-protected-image-src="\/api\/generated-images\/file\?id=thread%2Ftool-output\.png&amp;key=test-key"/);
  assert.match(html, /<figcaption>tool-output\.png<\/figcaption>/);
  assert.doesNotMatch(html, /\/api\/files\/preview\/content/);
});

test("Hermes embedded generated image content urls render directly with hydrate fallback", () => {
  const renderImageView = evaluatedImageViewRenderer({ embedded: true });
  const html = renderImageView({
    type: "imageView",
    contentUrl: "/api/generated-images/file?id=thread%2Fview-image-output.png",
    fileName: "view_image_output",
  });

  assert.match(html, /class="image-view"/);
  assert.match(html, /<img src="\/api\/generated-images\/file\?id=thread%2Fview-image-output\.png&amp;key=test-key"/);
  assert.doesNotMatch(html, /src="data:image\/gif;base64/);
  assert.match(html, /data-protected-image-src="\/api\/generated-images\/file\?id=thread%2Fview-image-output\.png&amp;key=test-key"/);
});

test("Hermes proxy embedded generated image urls render through the plugin proxy", () => {
  const renderImageView = evaluatedImageViewRenderer({
    embedded: true,
    pathname: "/api/hermes-plugins/codex-mobile/proxy/",
  });
  const html = renderImageView({
    type: "imageView",
    contentUrl: "/api/generated-images/file?id=thread%2Fview-image-output.png",
    fileName: "view_image_output",
  });

  assert.match(html, /class="image-view"/);
  assert.match(html, /<img src="\/api\/hermes-plugins\/codex-mobile\/proxy\/api\/generated-images\/file\?id=thread%2Fview-image-output\.png&amp;key=test-key"/);
  assert.match(html, /data-protected-image-src="\/api\/hermes-plugins\/codex-mobile\/proxy\/api\/generated-images\/file\?id=thread%2Fview-image-output\.png&amp;key=test-key"/);
  assert.doesNotMatch(html, /<img src="\/api\/generated-images\/file/);
});

test("Hermes embedded protected images are not proactively converted into data urls", () => {
  const hydrateProtectedAppImages = evaluatedProtectedImageHydrator({
    isHermesEmbedMode: () => true,
    fetch: () => {
      throw new Error("embedded direct images should not be proactively hydrated");
    },
  });
  let uploadSrc = "/api/uploads/file?id=2026-06-23%2Fthread-id%2Fhomeai-upload.jpg&key=session-key";
  let generatedSrc = "/api/generated-images/file?id=thread%2Fview-image-output.jpg&key=session-key";
  const uploadImage = {
    dataset: { protectedImageSrc: uploadSrc },
    complete: false,
    naturalWidth: 0,
    currentSrc: uploadSrc,
    get src() {
      return uploadSrc;
    },
    set src(value) {
      uploadSrc = value;
      this.currentSrc = value;
    },
  };
  const generatedImage = {
    dataset: { protectedImageSrc: generatedSrc },
    complete: false,
    naturalWidth: 0,
    currentSrc: generatedSrc,
    get src() {
      return generatedSrc;
    },
    set src(value) {
      generatedSrc = value;
      this.currentSrc = value;
    },
  };
  const rootNode = {
    querySelectorAll(selector) {
      assert.equal(selector, "img");
      return [uploadImage, generatedImage];
    },
  };

  assert.equal(hydrateProtectedAppImages(rootNode, "scheduled-scan"), 0);
  assert.equal(uploadSrc, "/api/uploads/file?id=2026-06-23%2Fthread-id%2Fhomeai-upload.jpg&key=session-key");
  assert.equal(generatedSrc, "/api/generated-images/file?id=thread%2Fview-image-output.jpg&key=session-key");
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

test("unavailable generated images render a bounded failure card without img src", () => {
  const renderImageView = evaluatedImageViewRenderer();
  const html = renderImageView({
    type: "imageView",
    fileName: "1782210953458-homeai-upload.jpg",
    generatedImage: {
      unavailable: true,
      reason: "source_unavailable",
    },
  });

  assert.match(html, /class="image-view image-load-failed"/);
  assert.match(html, /1782210953458-homeai-upload\.jpg/);
  assert.doesNotMatch(html, /<img\b/);
  assert.doesNotMatch(html, /src=/);
});

test("failed conversation images collapse into a neutral fallback", () => {
  const handleConversationImageError = evaluatedConversationImageErrorHandler();
  const addedClasses = [];
  const toggledClasses = [];
  const attributes = {};
  const figure = {
    classList: {
      add(value) {
        addedClasses.push(value);
      },
      toggle(value, active) {
        toggledClasses.push([value, active]);
      },
    },
  };
  const image = {
    dataset: {},
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
  assert.deepEqual(toggledClasses, [["image-load-retrying", false]]);
  assert.equal(attributes["aria-hidden"], "true");
  assert.equal(image.dataset.imageLoadError, "1");
  assert.match(appJs, /\$\("conversation"\)\.addEventListener\("error", handleConversationImageError, true\)/);
  assert.match(appJs, /\$\("conversation"\)\.addEventListener\("load", handleConversationImageLoad, true\)/);
  assert.match(functionBody("updateConversationHtml"), /scheduleFailedAppImageScan\(conversation/);
  assert.match(functionBody("scheduleFailedAppImageScan"), /hydrateProtectedAppImages\(root, "scheduled-scan"\)/);
  assert.match(functionBody("handleConversationImageError"), /handleProtectedAppImageError\(image\)/);
  assert.match(functionBody("shouldHydrateProtectedAppImage"), /isIosWebKitBrowser\(\) \|\| imageDiagnosticSourceKind\(src\) === "upload" \|\| shouldRenderProtectedImageDirectly\(src\)/);
  assert.match(functionBody("hydrateProtectedAppImage"), /protectedAppImageRecoveredUrl\(response, src\)/);
  assert.match(functionBody("hydrateProtectedAppImage"), /applyProtectedAppImageRecoveredUrl\(image, recovered\)/);
  assert.match(functionBody("hydrateProtectedAppImage"), /protectedImageHydrated = "1"/);
  assert.match(appJs, /const IMAGE_DIAGNOSTICS_ENABLED = false;/);
  assert.match(functionBody("postImageDiagnosticEvent"), /if \(!IMAGE_DIAGNOSTICS_ENABLED\) return false;/);
  assert.match(appJs, /document\.addEventListener\("focusin", \(\) => \{[\s\S]*scheduleVisibleImageFailureScan\(\[0, 80, 240\]\);/);
  assert.match(stylesCss, /\.input-image\.image-load-failed,[\s\S]*\.markdown-image\.image-load-failed,[\s\S]*\.image-view\.image-load-failed/);
  assert.match(stylesCss, /\.input-image\.image-load-retrying img,[\s\S]*visibility: hidden;/);
  assert.match(stylesCss, /\.input-image\.image-load-failed img,[\s\S]*display: none;/);
  assert.match(stylesCss, /\.conversation img\.image-load-failed/);
  assert.match(stylesCss, /\.attachment-chip\.image-load-failed \.attachment-thumb/);
  assert.match(stylesCss, /content: "图片无法加载";/);
});

test("protected upload image errors are probed before showing failed fallback", async () => {
  const fetchCalls = [];
  const handleConversationImageError = evaluatedConversationImageErrorHandler({
    window: {
      location: { origin: "http://127.0.0.1:8787" },
    },
    FileReader: class {
      readAsDataURL(blob) {
        this.result = `data:${blob.type};base64,ZmFrZS1qcGVn`;
        setTimeout(() => this.onload && this.onload(), 0);
      }
    },
    fetch: (src, options) => {
      fetchCalls.push({ src, options });
      return Promise.resolve({
        ok: true,
        status: 200,
        blob: () => Promise.resolve({ type: "image/jpeg", size: 128000 }),
      });
    },
  });
  const addedClasses = [];
  const removedClasses = [];
  const toggledClasses = [];
  const attributes = {};
  let imageSrc = "/api/uploads/file?path=%2FUsers%2Fxuxin%2F.codex-mobile-web%2Fuploads%2Fthread%2Fhomeai-upload.jpg&key=stale";
  const figure = {
    classList: {
      add(value) {
        addedClasses.push(value);
      },
      remove(value) {
        removedClasses.push(value);
      },
      toggle(value, active) {
        toggledClasses.push([value, active]);
      },
    },
  };
  const image = {
    dataset: {},
    currentSrc: imageSrc,
    naturalWidth: 0,
    isConnected: true,
    get src() {
      return imageSrc;
    },
    set src(value) {
      imageSrc = value;
      this.currentSrc = value;
    },
    closest(selector) {
      if (String(selector).includes(".input-image")) return figure;
      return null;
    },
    getAttribute(name) {
      if (name === "src") return imageSrc;
      if (name === "aria-hidden") return "";
      return "";
    },
    setAttribute(name, value) {
      attributes[name] = value;
    },
    removeAttribute() {},
  };
  const target = {
    closest(selector) {
      if (selector === "img") return image;
      return null;
    },
  };

  handleConversationImageError({ target });
  assert.deepEqual(addedClasses, []);
  assert.equal(attributes["aria-hidden"], undefined);
  assert.equal(image.dataset.imageLoadProbe, "1");
  assert.deepEqual(toggledClasses, [["image-load-retrying", true]]);
  assert.equal(fetchCalls.length, 1);

  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.deepEqual(addedClasses, []);
  assert.deepEqual(removedClasses, ["image-load-failed"]);
  assert.equal(image.dataset.imageLoadProbe, undefined);
  assert.equal(imageSrc, "data:image/jpeg;base64,ZmFrZS1qcGVn");
  assert.equal(image.dataset.protectedImageObjectUrl, undefined);
  assert.deepEqual(toggledClasses, [
    ["image-load-retrying", true],
    ["image-load-retrying", false],
  ]);
});

test("Hermes embedded protected image recovery keeps proxy-safe file urls", async () => {
  const fetchCalls = [];
  const handleConversationImageError = evaluatedConversationImageErrorHandler({
    isHermesEmbedMode: () => true,
    FileReader: class {
      readAsDataURL(blob) {
        this.result = `data:${blob.type};base64,ZmFrZS1qcGVn`;
        setTimeout(() => this.onload && this.onload(), 0);
      }
    },
    fetch: (src, options) => {
      fetchCalls.push({ src, options });
      return Promise.resolve({
        ok: true,
        status: 200,
        blob: () => Promise.resolve({ type: "image/jpeg", size: 164771 }),
      });
    },
  });
  let imageSrc = "/api/uploads/file?id=2026-06-23%2Fthread-id%2Fhomeai-upload.jpg&key=session-key";
  const figure = {
    classList: {
      remove() {},
      toggle() {},
    },
  };
  const image = {
    dataset: { protectedImageSrc: imageSrc },
    currentSrc: imageSrc,
    naturalWidth: 0,
    isConnected: true,
    get src() {
      return imageSrc;
    },
    set src(value) {
      imageSrc = value;
      this.currentSrc = value;
    },
    closest(selector) {
      if (String(selector).includes(".image-view")) return figure;
      return null;
    },
    getAttribute(name) {
      if (name === "src") return imageSrc;
      if (name === "aria-hidden") return "";
      return "";
    },
    removeAttribute() {},
  };

  handleConversationImageError({ target: { closest: () => image } });
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.equal(fetchCalls.length, 1);
  assert.match(fetchCalls[0].src, /^\/api\/uploads\/file\?id=2026-06-23%2Fthread-id%2Fhomeai-upload\.jpg/);
  assert.match(imageSrc, /^\/api\/uploads\/file\?id=2026-06-23%2Fthread-id%2Fhomeai-upload\.jpg/);
  assert.match(imageSrc, /_imgRecover=/);
  assert.doesNotMatch(imageSrc, /^data:image\//);
  assert.doesNotMatch(imageSrc, /(?:\/Users|%2FUsers|\.codex-mobile-web|path=)/);
});

test("Hermes proxy embedded protected image recovery stays under plugin proxy", async () => {
  const fetchCalls = [];
  const handleConversationImageError = evaluatedConversationImageErrorHandler({
    window: {
      location: {
        origin: "http://127.0.0.1:8797",
        pathname: "/api/hermes-plugins/codex-mobile/proxy/",
      },
    },
    isHermesEmbedMode: () => true,
    fetch: (src, options) => {
      fetchCalls.push({ src, options });
      return Promise.resolve({
        ok: true,
        status: 200,
        blob: () => Promise.resolve({ type: "image/jpeg", size: 160931 }),
      });
    },
  });
  let imageSrc = "/api/hermes-plugins/codex-mobile/proxy/api/uploads/file?id=2026-06-23%2Fthread-id%2Fhomeai-upload.jpg&key=session-key";
  const figure = {
    classList: {
      remove() {},
      toggle() {},
    },
  };
  const image = {
    dataset: { protectedImageSrc: imageSrc },
    currentSrc: imageSrc,
    naturalWidth: 0,
    isConnected: true,
    get src() {
      return imageSrc;
    },
    set src(value) {
      imageSrc = value;
      this.currentSrc = value;
    },
    closest(selector) {
      if (String(selector).includes(".image-view")) return figure;
      return null;
    },
    getAttribute(name) {
      if (name === "src") return imageSrc;
      if (name === "aria-hidden") return "";
      return "";
    },
    removeAttribute() {},
  };

  handleConversationImageError({ target: { closest: () => image } });
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.equal(fetchCalls.length, 1);
  assert.match(fetchCalls[0].src, /^\/api\/hermes-plugins\/codex-mobile\/proxy\/api\/uploads\/file\?id=2026-06-23%2Fthread-id%2Fhomeai-upload\.jpg/);
  assert.match(imageSrc, /^\/api\/hermes-plugins\/codex-mobile\/proxy\/api\/uploads\/file\?id=2026-06-23%2Fthread-id%2Fhomeai-upload\.jpg/);
  assert.match(imageSrc, /_imgRecover=/);
  assert.doesNotMatch(imageSrc, /^\/api\/uploads\/file/);
  assert.doesNotMatch(imageSrc, /^data:image\//);
});

test("protected upload image errors fall back to cache-busted src retry without blob support", async () => {
  const handleConversationImageError = evaluatedConversationImageErrorHandler({
    fetch: () => Promise.resolve({ ok: true, status: 200 }),
  });
  let imageSrc = "/api/uploads/file?path=%2FUsers%2Fxuxin%2F.codex-mobile-web%2Fuploads%2Fthread%2Fhomeai-upload.jpg&key=stale";
  const figure = {
    classList: {
      remove() {},
      toggle() {},
    },
  };
  const image = {
    dataset: {},
    currentSrc: imageSrc,
    naturalWidth: 0,
    isConnected: true,
    get src() {
      return imageSrc;
    },
    set src(value) {
      imageSrc = value;
      this.currentSrc = value;
    },
    closest(selector) {
      if (String(selector).includes(".input-image")) return figure;
      return null;
    },
    getAttribute(name) {
      if (name === "src") return imageSrc;
      return "";
    },
    removeAttribute() {},
  };

  handleConversationImageError({ target: { closest: () => image } });
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.match(imageSrc, /_imgRetry=/);
});

test("loaded conversation images clear stale failed-image state", () => {
  const handleConversationImageLoad = evaluatedConversationImageLoadHandler();
  const removedContainerClasses = [];
  const removedImageClasses = [];
  const removedAttributes = [];
  const figure = {
    classList: {
      remove(value) {
        removedContainerClasses.push(value);
      },
    },
  };
  const image = {
    dataset: { imageLoadError: "1" },
    classList: {
      remove(value) {
        removedImageClasses.push(value);
      },
    },
    closest(selector) {
      if (String(selector).includes(".input-image")) return figure;
      return null;
    },
    getAttribute(name) {
      return name === "aria-hidden" ? "true" : "";
    },
    removeAttribute(name) {
      removedAttributes.push(name);
    },
  };
  const target = {
    closest(selector) {
      if (selector === "img") return image;
      return null;
    },
  };

  handleConversationImageLoad({ target });

  assert.deepEqual(removedContainerClasses, ["image-load-failed"]);
  assert.deepEqual(removedImageClasses, ["image-load-failed"]);
  assert.deepEqual(removedAttributes, ["aria-hidden"]);
  assert.equal(image.dataset.imageLoadError, undefined);
});

test("already-broken rendered images are proactively marked without a new error event", () => {
  const scanFailedAppImages = evaluatedFailedImageScanner();
  const addedClasses = [];
  const removedClasses = [];
  const removedAttributes = [];
  const attributes = {};
  const container = {
    classList: {
      add(value) {
        addedClasses.push(value);
      },
      remove(value) {
        removedClasses.push(value);
      },
    },
  };
  const brokenImage = {
    complete: true,
    naturalWidth: 0,
    loading: "eager",
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
  const recoveredImage = {
    complete: true,
    naturalWidth: 120,
    dataset: { imageLoadError: "1" },
    closest(selector) {
      if (selector === ".input-image, .image-view, .markdown-image, .attachment-chip, .file-preview-media, figure") return container;
      return null;
    },
    classList: {
      remove(value) {
        removedClasses.push(value);
      },
    },
    getAttribute(name) {
      return name === "aria-hidden" ? "true" : "";
    },
    removeAttribute(name) {
      removedAttributes.push(name);
    },
  };
  const rootNode = {
    querySelectorAll(selector) {
      assert.equal(selector, "img");
      return [brokenImage, loadingImage, recoveredImage];
    },
  };

  assert.equal(scanFailedAppImages(rootNode), 1);
  assert.deepEqual(addedClasses, ["image-load-failed"]);
  assert.equal(attributes["aria-hidden"], "true");
  assert.deepEqual(removedClasses, ["image-load-failed", "image-load-failed"]);
  assert.deepEqual(removedAttributes, ["aria-hidden"]);
});

test("lazy images are not marked failed before the browser attempts loading them", () => {
  const scanFailedAppImages = evaluatedFailedImageScanner();
  const addedClasses = [];
  const removedClasses = [];
  const removedAttributes = [];
  const container = {
    classList: {
      add(value) {
        addedClasses.push(value);
      },
      remove(value) {
        removedClasses.push(value);
      },
    },
  };
  const lazyPendingImage = {
    complete: true,
    naturalWidth: 0,
    loading: "lazy",
    dataset: {},
    closest(selector) {
      if (selector === ".input-image, .image-view, .markdown-image, .attachment-chip, .file-preview-media, figure") return container;
      return null;
    },
    getAttribute(name) {
      if (name === "loading") return "lazy";
      if (name === "aria-hidden") return "true";
      return "";
    },
    removeAttribute(name) {
      removedAttributes.push(name);
    },
  };
  const explicitLazyErrorImage = {
    complete: true,
    naturalWidth: 0,
    loading: "lazy",
    dataset: { imageLoadError: "1" },
    closest(selector) {
      if (selector === ".input-image, .image-view, .markdown-image, .attachment-chip, .file-preview-media, figure") return container;
      return null;
    },
    getAttribute(name) {
      return name === "loading" ? "lazy" : "";
    },
    setAttribute() {},
  };
  const rootNode = {
    querySelectorAll(selector) {
      assert.equal(selector, "img");
      return [lazyPendingImage, explicitLazyErrorImage];
    },
  };

  assert.equal(scanFailedAppImages(rootNode), 1);
  assert.deepEqual(addedClasses, ["image-load-failed"]);
  assert.deepEqual(removedClasses, ["image-load-failed"]);
  assert.deepEqual(removedAttributes, ["aria-hidden"]);
});

test("protected zero-size upload images are probed by scanner instead of marked failed", async () => {
  const fetchCalls = [];
  const scanFailedAppImages = evaluatedFailedImageScanner({
    window: {
      location: { origin: "http://127.0.0.1:8787" },
    },
    FileReader: class {
      readAsDataURL(blob) {
        this.result = `data:${blob.type};base64,c2Nhbm5lZC1qcGVn`;
        setTimeout(() => this.onload && this.onload(), 0);
      }
    },
    fetch: (src, options) => {
      fetchCalls.push({ src, options });
      return Promise.resolve({
        ok: true,
        status: 200,
        blob: () => Promise.resolve({ type: "image/jpeg", size: 128000 }),
      });
    },
  });
  const addedClasses = [];
  const toggledClasses = [];
  let imageSrc = "/api/uploads/file?path=%2FUsers%2Fxuxin%2F.codex-mobile-web%2Fuploads%2Fthread%2Fhomeai-upload.jpg&key=stale";
  const container = {
    classList: {
      add(value) {
        addedClasses.push(value);
      },
      remove() {},
      toggle(value, active) {
        toggledClasses.push([value, active]);
      },
    },
  };
  const protectedImage = {
    complete: true,
    naturalWidth: 0,
    dataset: {},
    currentSrc: imageSrc,
    isConnected: true,
    get src() {
      return imageSrc;
    },
    set src(value) {
      imageSrc = value;
      this.currentSrc = value;
    },
    closest(selector) {
      if (selector === ".input-image, .image-view, .markdown-image, .attachment-chip, .file-preview-media, figure") return container;
      return null;
    },
    getAttribute(name) {
      if (name === "src") return imageSrc;
      return "";
    },
    removeAttribute() {},
  };
  const rootNode = {
    querySelectorAll(selector) {
      assert.equal(selector, "img");
      return [protectedImage];
    },
  };

  assert.equal(scanFailedAppImages(rootNode), 0);
  assert.equal(fetchCalls.length, 1);
  assert.deepEqual(addedClasses, []);
  assert.deepEqual(toggledClasses, [["image-load-retrying", true]]);

  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.equal(imageSrc, "data:image/jpeg;base64,c2Nhbm5lZC1qcGVn");
  assert.equal(protectedImage.dataset.protectedImageObjectUrl, undefined);
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
  assert.match(html, /\/api\/uploads\/file\?id=2026-06-08%2Fthread-id%2F1780936946968-IMG_5882\.jpg/);
  assert.match(html, /key=session-key/);
  assert.doesNotMatch(html, /<img src="[^"]*(?:\/Users|%2FUsers|\.codex-mobile-web|path=)/);
  assert.equal(html.includes(`src="${uploadPath}"`), false);
});

test("durable upload summaries take precedence over stale blob image parts", () => {
  const renderInputContent = evaluatedInputContentRendererWithKey("session-key");
  const uploadPath = "/Users/xuxin/.codex-mobile-web/uploads/2026-06-20/thread-id/1781947353793-homeai-upload-2B62320E.jpg";
  const html = renderInputContent([
    {
      type: "input_text",
      text: `Uploaded attachments:\n- homeai-upload-2B62320E.jpg (image, image/jpeg, 116.9 KB): ${uploadPath}`,
    },
    {
      type: "input_image",
      image_url: { url: "blob:http://127.0.0.1:8787/local-preview" },
      fileName: "homeai-upload-2B62320E.jpg",
    },
  ]);

  assert.match(html, /class="input-image"/);
  assert.match(html, /\/api\/uploads\/file\?id=2026-06-20%2Fthread-id%2F1781947353793-homeai-upload-2B62320E\.jpg/);
  assert.match(html, /key=session-key/);
  assert.match(html, /homeai-upload-2B62320E\.jpg/);
  assert.doesNotMatch(html, /<img src="[^"]*(?:\/Users|%2FUsers|\.codex-mobile-web|path=)/);
  assert.doesNotMatch(html, /blob:http:\/\/127\.0\.0\.1:8787\/local-preview/);
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
  assert.match(turnBody, /const sourceItems = filterDuplicateUploadImageViewsInTurnItems\(out\.items, options\)/);
  assert.match(turnBody, /out\.items = sourceItems\.map\(\(item\) => compactItem\(item, options\)\)/);
});

test("refresh merge uses incoming item order for durable user messages appended locally", () => {
  const mergeItemsPreservingLocalVisible = evaluatedMergeItemsPreservingLocalVisibleWithRealVisibleWeight();
  const existingItems = [
    { id: "agent-progress", type: "agentMessage", text: "working\nwith more detail" },
    { id: "real-user-prompt", type: "userMessage", content: [{ type: "text", text: "initial prompt" }] },
  ];
  const incomingItems = [
    { id: "real-user-prompt", type: "userMessage", content: [{ type: "input_text", text: "initial prompt" }] },
    { id: "agent-progress", type: "agentMessage", text: "working" },
  ];

  const merged = mergeItemsPreservingLocalVisible(existingItems, incomingItems, true);

  assert.deepEqual(merged.map((item) => item.id), ["real-user-prompt", "agent-progress"]);
  assert.equal(merged[1].text, "working\nwith more detail");
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

test("durable uploaded image messages replace revoked optimistic blob previews", () => {
  const mergeItemsPreservingLocalVisible = evaluatedMergeItemsPreservingLocalVisibleWithRealVisibleWeight();
  const renderInputContent = evaluatedInputContentRendererWithKey("test-key");
  const uploadPath = "/Users/xuxin/.codex-mobile-web/uploads/2026-06-20/thread/homeai-upload-54FE12C6.jpg";
  const localImage = {
    id: "local-user-submit-image",
    type: "userMessage",
    mobilePendingSubmission: true,
    clientSubmissionId: "submit-image",
    content: [
      {
        type: "text",
        text: "Uploaded attachments:\n- homeai-upload-54FE12C6.jpg (image, image/jpeg, 128.4 KB): homeai-upload-54FE12C6.jpg",
      },
      {
        type: "input_image",
        image_url: { url: "blob:http://127.0.0.1:8787/local-preview" },
        fileName: "homeai-upload-54FE12C6.jpg",
      },
    ],
  };
  const durableImage = {
    id: "real-user-submit-image",
    type: "userMessage",
    content: [
      {
        type: "input_text",
        text: `Uploaded attachments:\n- homeai-upload-54FE12C6.jpg (image, image/jpeg, 128.4 KB): ${uploadPath}`,
      },
      { type: "localImage", path: uploadPath },
    ],
  };

  const imageItems = mergeItemsPreservingLocalVisible([localImage], [durableImage], true);
  assert.equal(imageItems.length, 1);
  assert.equal(imageItems[0].id, durableImage.id);
  assert.equal(imageItems[0].mobilePendingSubmission, undefined);
  assert.equal(imageItems[0].clientSubmissionId, "submit-image");
  assert.deepEqual(imageItems[0].content, durableImage.content);
  assert.doesNotMatch(JSON.stringify(imageItems[0].content), /blob:/);

  const html = renderInputContent(imageItems[0].content);
  assert.match(html, /\/api\/uploads\/file\?id=2026-06-20%2Fthread%2Fhomeai-upload-54FE12C6\.jpg/);
  assert.match(html, /key=test-key/);
  assert.match(html, /homeai-upload-54FE12C6\.jpg/);
  assert.doesNotMatch(html, /<img src="[^"]*(?:\/Users|%2FUsers|\.codex-mobile-web|path=)/);
  assert.doesNotMatch(html, /blob:/);
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

test("cross-turn normalization drops later optimistic upload image echoes after durable image appears", () => {
  const normalizeThreadVisibleUserMessages = evaluatedNormalizeThreadVisibleUserMessages();
  const uploadPath = "/Users/xuxin/.codex-mobile-web/uploads/2026-06-20/thread/1781940095858-homeai-upload-49DBCECD.jpg";
  const thread = {
    turns: [
      {
        id: "durable-turn",
        status: { type: "completed", mobileSupersededLive: true },
        items: [{
          id: "real-user-image",
          type: "userMessage",
          content: [{
            type: "input_text",
            text: `Uploaded attachments:\n- homeai-upload-49DBCECD.jpg (image, image/jpeg, 125.6 KB): ${uploadPath}`,
          }],
        }],
      },
      {
        id: "local-live-turn",
        status: "inProgress",
        items: [{
          id: "local-user-submit-image",
          type: "userMessage",
          mobilePendingSubmission: true,
          clientSubmissionId: "submit-image",
          content: [
            {
              type: "text",
              text: "Uploaded attachments:\n- homeai-upload-49DBCECD.jpg (image, image/jpeg, 125.6 KB): homeai-upload-49DBCECD.jpg",
            },
            {
              type: "input_image",
              image_url: { url: "blob:http://127.0.0.1:8787/local-preview" },
              fileName: "homeai-upload-49DBCECD.jpg",
            },
          ],
        }],
      },
    ],
  };

  normalizeThreadVisibleUserMessages(thread);

  assert.equal(thread.turns[0].items.length, 1);
  assert.equal(thread.turns[0].items[0].id, "real-user-image");
  assert.equal(thread.turns[1].items.length, 0);
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

test("v4 projection merge preserves local pending message when server refresh has no durable match yet", () => {
  const mergeThreadPreservingVisibleItems = evaluatedMergeThreadPreservingVisibleItems();
  const existingThread = {
    id: "thread-new",
    turns: [{
      id: "local-turn-submit-current",
      status: { type: "active" },
      items: [{
        id: "local-user-submit-current",
        type: "userMessage",
        mobilePendingSubmission: true,
        clientSubmissionId: "submit-current",
        content: [{ type: "text", text: "current guidance" }],
      }],
    }],
  };
  const incomingThread = {
    id: "thread-new",
    mobileProjectionVersion: "v4",
    mobileProjectionRevision: 2,
    turns: [{
      id: "real-active-turn",
      status: { type: "active" },
      items: [
        { id: "agent-progress", type: "agentMessage", text: "working" },
      ],
    }],
  };

  const merged = mergeThreadPreservingVisibleItems(existingThread, incomingThread);

  assert.deepEqual(merged.turns.map((turn) => turn.id), ["real-active-turn", "local-turn-submit-current"]);
  assert.deepEqual(merged.turns.flatMap((turn) => turn.items.map((item) => item.id)), [
    "agent-progress",
    "local-user-submit-current",
  ]);
  assert.equal(merged.mobileProjectionVersion, "v4");
});

test("live turn merge keeps displayed assistant receipt when backfill has more stale items", () => {
  const mergeThreadPreservingVisibleItems = evaluatedMergeThreadPreservingVisibleItems();
  const existingThread = {
    id: "thread-new",
    turns: [{
      id: "turn-current",
      status: { type: "active" },
      items: [
        { id: "user-current", type: "userMessage", content: [{ type: "text", text: "push public" }] },
        { id: "agent-live-receipt", type: "agentMessage", text: "pausing public push" },
      ],
    }],
  };
  const incomingThread = {
    id: "thread-new",
    mobileReadMode: "thread-read",
    turns: [{
      id: "turn-current",
      status: { type: "active" },
      items: [
        { id: "user-current", type: "userMessage", content: [{ type: "input_text", text: "push public" }] },
        {
          id: "older-command-output",
          type: "commandExecution",
          status: "completed",
          command: "npm test",
          output: "older backfill output ".repeat(40),
        },
      ],
    }],
  };

  const merged = mergeThreadPreservingVisibleItems(existingThread, incomingThread);

  assert.deepEqual(merged.turns[0].items.map((item) => item.id), [
    "user-current",
    "agent-live-receipt",
    "older-command-output",
  ]);
  assert.equal(
    merged.turns[0].items.find((item) => item.id === "agent-live-receipt").text,
    "pausing public push",
  );
});

test("completed projection merge drops local-only live receipts when server receipt and usage arrive", () => {
  const mergeThreadPreservingVisibleItems = evaluatedMergeThreadPreservingVisibleItems();
  const existingThread = {
    id: "thread-new",
    mobileProjectionVersion: "v4",
    mobileProjectionRevision: 12,
    turns: [{
      id: "turn-current",
      status: { type: "active" },
      items: [
        { id: "user-current", type: "userMessage", content: [{ type: "text", text: "fix it" }] },
        {
          id: "local-operation",
          type: "commandExecution",
          status: "completed",
          command: "npm test",
          output: "local operation detail ".repeat(80),
        },
        { id: "local-live-receipt", type: "agentMessage", text: "I am still checking this." },
      ],
    }],
  };
  const incomingThread = {
    id: "thread-new",
    mobileProjectionVersion: "v4",
    mobileProjectionRevision: 13,
    turns: [{
      id: "turn-current",
      status: { type: "completed" },
      completedAtMs: 1782221000000,
      items: [
        { id: "user-current", type: "userMessage", content: [{ type: "input_text", text: "fix it" }] },
        { id: "server-final-receipt", type: "agentMessage", text: "Fixed and verified." },
        {
          id: "mobile-turn-usage-turn-current",
          type: "turnUsageSummary",
          mobileUsageSummary: { totalTokenUsage: { totalTokens: 42 } },
        },
      ],
    }],
  };

  const merged = mergeThreadPreservingVisibleItems(existingThread, incomingThread);
  const mergedItems = merged.turns[0].items;

  assert.deepEqual(mergedItems.map((item) => item.id), [
    "user-current",
    "local-operation",
    "server-final-receipt",
    "mobile-turn-usage-turn-current",
  ]);
  assert.deepEqual(
    mergedItems.filter((item) => item.type === "agentMessage").map((item) => item.id),
    ["server-final-receipt"],
  );
  assert.equal(mergedItems.filter((item) => item.type === "turnUsageSummary").length, 1);
});

test("completed projection merge adopts shorter final receipt without repainting live receipt", () => {
  const mergeThreadPreservingVisibleItems = evaluatedMergeThreadPreservingVisibleItems();
  const existingThread = {
    id: "thread-new",
    mobileProjectionVersion: "v4",
    mobileProjectionRevision: 20,
    turns: [{
      id: "turn-current",
      status: { type: "active" },
      items: [
        { id: "user-current", type: "userMessage", content: [{ type: "text", text: "stabilize receipt" }] },
        {
          id: "local-live-receipt",
          type: "agentMessage",
          text: "Root cause isolated.\nPatch applied.\nValidation is still running.",
        },
      ],
    }],
  };
  const incomingThread = {
    id: "thread-new",
    mobileProjectionVersion: "v4",
    mobileProjectionRevision: 21,
    turns: [{
      id: "turn-current",
      status: { type: "completed" },
      completedAtMs: 1782222000000,
      items: [
        { id: "user-current", type: "userMessage", content: [{ type: "input_text", text: "stabilize receipt" }] },
        {
          id: "server-final-receipt",
          type: "agentMessage",
          text: "Root cause isolated.\nPatch applied.",
        },
        {
          id: "mobile-turn-usage-turn-current",
          type: "turnUsageSummary",
          mobileUsageSummary: { totalTokenUsage: { totalTokens: 128 } },
        },
      ],
    }],
  };

  const merged = mergeThreadPreservingVisibleItems(existingThread, incomingThread);
  const mergedItems = merged.turns[0].items;
  const receipts = mergedItems.filter((item) => item.type === "agentMessage");

  assert.deepEqual(mergedItems.map((item) => item.id), [
    "user-current",
    "local-live-receipt",
    "mobile-turn-usage-turn-current",
  ]);
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].text, "Root cause isolated.\nPatch applied.\nValidation is still running.");
  assert.equal(mergedItems.filter((item) => item.type === "turnUsageSummary").length, 1);
});

test("v4 projection merge removes local pending message after durable user match arrives", () => {
  const mergeThreadPreservingVisibleItems = evaluatedMergeThreadPreservingVisibleItems();
  const existingThread = {
    id: "thread-new",
    turns: [{
      id: "local-turn-submit-current",
      status: { type: "active" },
      items: [{
        id: "local-user-submit-current",
        type: "userMessage",
        mobilePendingSubmission: true,
        clientSubmissionId: "submit-current",
        content: [{ type: "text", text: "current guidance" }],
      }],
    }],
  };
  const incomingThread = {
    id: "thread-new",
    mobileProjectionVersion: "v4",
    mobileProjectionRevision: 3,
    turns: [{
      id: "real-active-turn",
      status: { type: "active" },
      items: [
        {
          id: "durable-user-current",
          type: "userMessage",
          clientSubmissionId: "submit-current",
          content: [{ type: "input_text", text: "current guidance" }],
        },
        { id: "agent-progress", type: "agentMessage", text: "working" },
      ],
    }],
  };

  const merged = mergeThreadPreservingVisibleItems(existingThread, incomingThread);

  assert.deepEqual(merged.turns.map((turn) => turn.id), ["real-active-turn"]);
  assert.deepEqual(merged.turns[0].items.map((item) => item.id), [
    "durable-user-current",
    "agent-progress",
  ]);
});

test("v4 projection merge corrects local SSE user message order from refresh", () => {
  const mergeThreadPreservingVisibleItems = evaluatedMergeThreadPreservingVisibleItems();
  const existingThread = {
    id: "thread-new",
    mobileProjectionVersion: "v4",
    mobileProjectionRevision: 8,
    turns: [{
      id: "turn-current",
      status: { type: "active" },
      items: [
        { id: "agent-progress", type: "agentMessage", text: "working\nwith more detail" },
        { id: "durable-user-current", type: "userMessage", content: [{ type: "text", text: "current prompt" }] },
      ],
    }],
  };
  const incomingThread = {
    id: "thread-new",
    mobileProjectionVersion: "v4",
    mobileProjectionRevision: 9,
    turns: [{
      id: "turn-current",
      status: { type: "active" },
      items: [
        { id: "durable-user-current", type: "userMessage", content: [{ type: "input_text", text: "current prompt" }] },
        { id: "agent-progress", type: "agentMessage", text: "working" },
      ],
    }],
  };

  const merged = mergeThreadPreservingVisibleItems(existingThread, incomingThread);

  assert.deepEqual(merged.turns[0].items.map((item) => item.id), [
    "durable-user-current",
    "agent-progress",
  ]);
  assert.equal(merged.turns[0].items[1].text, "working\nwith more detail");
});

test("v4 projection merge keeps longer live receipt when refresh returns an older same-turn item", () => {
  const mergeThreadPreservingVisibleItems = evaluatedMergeThreadPreservingVisibleItems();
  const existingThread = {
    id: "thread-new",
    mobileProjectionVersion: "v4",
    mobileProjectionRevision: 6,
    turns: [{
      id: "turn-current",
      status: { type: "active" },
      items: [
        { id: "user-current", type: "userMessage", content: [{ type: "text", text: "continue" }] },
        { id: "agent-current", type: "agentMessage", text: "first paragraph\nsecond paragraph" },
      ],
    }],
  };
  const incomingThread = {
    id: "thread-new",
    mobileProjectionVersion: "v4",
    mobileProjectionRevision: 5,
    turns: [{
      id: "turn-current",
      status: { type: "active" },
      items: [
        { id: "user-current", type: "userMessage", content: [{ type: "text", text: "continue" }] },
        { id: "agent-current", type: "agentMessage", text: "first paragraph" },
      ],
    }],
  };

  const merged = mergeThreadPreservingVisibleItems(existingThread, incomingThread);

  assert.equal(merged.mobileProjectionRevision, 6);
  assert.equal(merged.turns.length, 1);
  assert.equal(
    merged.turns[0].items.find((item) => item.id === "agent-current").text,
    "first paragraph\nsecond paragraph",
  );
});

test("v4 projection merge does not preserve server-suppressed upload image echoes", () => {
  const mergeThreadPreservingVisibleItems = evaluatedMergeThreadPreservingVisibleItems();
  const uploadPath = "/Users/xuxin/.codex-mobile-web/uploads/2026-06-23/thread/1782217099872-Screenshot_20260623_201803_Home AI.jpg";
  const existingThread = {
    id: "thread-new",
    mobileProjectionVersion: "v4",
    mobileProjectionRevision: 10,
    turns: [{
      id: "turn-current",
      status: { type: "active" },
      items: [
        {
          id: "user-upload",
          type: "userMessage",
          content: [{
            type: "input_text",
            text: `Uploaded attachments:\n- 1782217099872-Screenshot_20260623_201803_Home AI.jpg (image, image/jpeg, 109.3 KB): ${uploadPath}`,
          }],
        },
        {
          id: "stale-upload-echo",
          type: "imageView",
          fileName: "1782217099872-Screenshot_20260623_201803_Home AI.jpg",
          contentUrl: "/api/generated-images/file?id=thread%2Fstale-upload-echo.jpg",
        },
        {
          id: "real-generated-image",
          type: "imageView",
          fileName: "visual-check-output.png",
          contentUrl: "/api/generated-images/file?id=thread%2Fvisual-check-output.png",
        },
        { id: "agent-live-receipt", type: "agentMessage", text: "working\nwith more detail" },
      ],
    }],
  };
  const incomingThread = {
    id: "thread-new",
    mobileProjectionVersion: "v4",
    mobileProjectionRevision: 11,
    turns: [{
      id: "turn-current",
      status: { type: "active" },
      mobileSuppressedVisualReceiptKeys: [
        "id:stale-upload-echo",
        "name:1782217099872-screenshot_20260623_201803_home ai.jpg",
      ],
      items: [
        {
          id: "user-upload",
          type: "userMessage",
          content: [{
            type: "input_text",
            text: `Uploaded attachments:\n- 1782217099872-Screenshot_20260623_201803_Home AI.jpg (image, image/jpeg, 109.3 KB): ${uploadPath}`,
          }],
        },
        { id: "agent-live-receipt", type: "agentMessage", text: "working" },
      ],
    }],
  };

  const merged = mergeThreadPreservingVisibleItems(existingThread, incomingThread);

  assert.deepEqual(merged.turns[0].items.map((item) => item.id), [
    "user-upload",
    "real-generated-image",
    "agent-live-receipt",
  ]);
  assert.equal(
    merged.turns[0].items.find((item) => item.id === "agent-live-receipt").text,
    "working\nwith more detail",
  );
});

test("v4 projection merge preserves current live turn when stale refresh only has older content", () => {
  const mergeThreadPreservingVisibleItems = evaluatedMergeThreadPreservingVisibleItems();
  const existingThread = {
    id: "thread-new",
    mobileProjectionVersion: "v4",
    mobileProjectionRevision: 8,
    turns: [{
      id: "turn-current",
      status: { type: "active" },
      startedAtMs: 3000,
      items: [
        { id: "user-current", type: "userMessage", content: [{ type: "text", text: "new instruction" }] },
        { id: "agent-current", type: "agentMessage", text: "new reply in progress" },
      ],
    }],
  };
  const incomingThread = {
    id: "thread-new",
    mobileProjectionVersion: "v4",
    mobileProjectionRevision: 7,
    turns: [{
      id: "turn-previous",
      status: { type: "completed" },
      startedAtMs: 1000,
      completedAtMs: 2000,
      items: [
        { id: "user-previous", type: "userMessage", content: [{ type: "text", text: "old instruction" }] },
        { id: "agent-previous", type: "agentMessage", text: "old reply" },
      ],
    }],
  };

  const merged = mergeThreadPreservingVisibleItems(existingThread, incomingThread);

  assert.equal(merged.mobileProjectionRevision, 8);
  assert.deepEqual(merged.turns.map((turn) => turn.id), ["turn-previous", "turn-current"]);
  assert.deepEqual(merged.turns[1].items.map((item) => item.id), ["user-current", "agent-current"]);
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
  assert.match(syncBody, /const running = latestLiveTurnCandidate\(\);/);
  assert.doesNotMatch(syncBody, /reverse\(\)\.find/);

  const candidateBody = functionBody("latestLiveTurnCandidate");
  assert.match(candidateBody, /const displayLatest = latestTurn\(\);/);
  assert.match(candidateBody, /const rawLatest = latestRawTurn\(\);/);
  assert.match(candidateBody, /isRunningStatus\(displayLatest\.status\)/);
  assert.match(candidateBody, /isRunningStatus\(rawLatest\.status\)/);
  assert.doesNotMatch(candidateBody, /reverse\(\)\.find/);

  const liveBody = functionBody("currentLiveTurn");
  assert.match(liveBody, /const latest = latestLiveTurnCandidate\(\) \|\| latestTurn\(\);/);
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
  assert.match(sendBody, /const result = await api\(`\/api\/threads\/\$\{encodeURIComponent\(state\.currentThreadId\)\}\/messages`/);
  assert.match(sendBody, /const serverTurnId = startedTurnId\(result\);/);
  assert.match(sendBody, /if \(!steering && serverTurnId && reconcileSubmittedUserMessageTurn\(state\.currentThreadId, clientSubmissionId, serverTurnId\)\)/);
  assert.match(sendBody, /if \(!steering\) \{[\s\S]*restoreThreadStatusSnapshot\(previousThreadStatus\);[\s\S]*renderThreads\(\);[\s\S]*\}/);

  const taskCardSendBody = functionBody("sendThreadTaskCardCommand");
  assert.match(taskCardSendBody, /const result = await api\(`\/api\/threads\/\$\{encodeURIComponent\(state\.currentThreadId\)\}\/messages`/);
  assert.match(taskCardSendBody, /const serverTurnId = startedTurnId\(result\);/);
  assert.match(taskCardSendBody, /if \(serverTurnId && reconcileSubmittedUserMessageTurn\(state\.currentThreadId, clientSubmissionId, serverTurnId\)\)/);
  assert.doesNotMatch(taskCardSendBody, /!steering/);

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
