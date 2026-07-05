import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  SHELL_SCRIPT_BLOCK_END,
  SHELL_SCRIPT_BLOCK_START,
  buildPublicShellManifest,
  renderShellScriptBlock,
} from "./generate-frontend-shell-manifest.mjs";

export const SHELL_MANIFEST_SCHEMA_VERSION = 1;
export const VITE_SHELL_BUILD_CONTRACT_SCHEMA_VERSION = 1;
export const VITE_SHELL_ENTRY_SOURCE = "frontend/vite-shell-entry.mjs";
export const VITE_DEFERRED_ENTRY_SOURCE = "frontend/vite-deferred-entry-topology.mjs";
export const VITE_ENTRY_GROUP_SOURCE_PREFIX = "virtual:codex-mobile-shell-entry-group/";
export const VITE_ENTRY_GROUP_LOADER_SOURCE = "virtual:codex-mobile-shell-entry-group-loader";
export const VITE_ESM_COMPATIBILITY_SOURCE = "virtual:codex-mobile-esm-compatibility";
export const VITE_ESM_COMPATIBILITY_SHARD_SOURCE_PREFIX = `${VITE_ESM_COMPATIBILITY_SOURCE}/shard/`;
const VITE_ESM_COMPATIBILITY_SHARD_TARGET_BYTES = 220 * 1024;
const VITE_APP_PREVIEW_OWNED_CLASSIC_SCRIPTS = [
  {
    path: "/shell-asset-manifest.js",
    ownerId: "shell-manifest",
    globalName: "CODEX_MOBILE_SHELL_MANIFEST",
  },
  {
    path: "/app-bootstrap.js",
    ownerId: "vite-app-bootstrap",
    globalName: "CodexAppBootstrap",
  },
];
const VITE_ESM_COMPATIBILITY_MODULE_CANDIDATES = [
  {
    id: "build-refresh-policy",
    source: "public/build-refresh-policy.js",
    nativeSource: "frontend/native/build-refresh-policy.mjs",
    globalName: "CodexBuildRefreshPolicy",
    expectedFunctions: [
      "shellSequenceFromBuildId",
      "classifyServerBuildChange",
      "shouldPromptForServerBuildChange",
    ],
  },
  {
    id: "runtime-settings",
    source: "public/runtime-settings.js",
    nativeSource: "frontend/native/runtime-settings.mjs",
    globalName: "CodexRuntimeSettings",
    expectedFunctions: [
      "normalizeOptionList",
      "labelForModel",
      "compactLabelForModel",
      "labelForEffort",
      "labelForPermissionMode",
      "titleForPermissionMode",
      "normalizePermissionModeValue",
      "selectedNewThreadModel",
      "selectedNewThreadEffort",
      "selectedNewThreadPermission",
    ],
  },
  {
    id: "viewport-metrics",
    source: "public/viewport-metrics.js",
    nativeSource: "frontend/native/viewport-metrics.mjs",
    globalName: "CodexViewportMetrics",
    expectedFunctions: [
      "cssPixel",
      "isKeyboardEditable",
      "measureViewport",
      "stablePixelChanged",
    ],
  },
  {
    id: "conversation-scroll",
    source: "public/conversation-scroll.js",
    nativeSource: "frontend/native/conversation-scroll.mjs",
    globalName: "CodexConversationScroll",
    expectedFunctions: [
      "createSubmittedMessageFollow",
      "extendSubmittedMessageFollow",
      "createViewportFollow",
      "isNearBottom",
      "planBottomFollowLeaseEvaluation",
      "planBottomFollowScrollSchedule",
      "planConversationAutoScrollHoldFromScroll",
      "planAutomaticConversationRefresh",
      "planConversationJumpButtons",
      "planFullRenderScroll",
      "planLocalPatchScrollCompletion",
      "planReadingViewportPreservation",
      "planUserReadingCurrentTurn",
      "shouldFollowViewport",
      "shouldFollowSubmittedMessage",
      "shouldStartViewportFollow",
    ],
  },
  {
    id: "thread-performance-metrics",
    source: "public/thread-performance-metrics.js",
    nativeSource: "frontend/native/thread-performance-metrics.mjs",
    globalName: "CodexThreadPerformanceMetrics",
    expectedFunctions: [
      "boundedTiming",
      "classifyThreadDetailPhase",
      "classifyThreadListPhase",
      "rolloutSizeBytes",
      "statusText",
      "threadDetailClientTimings",
      "threadDetailEventFields",
      "threadDetailEventFieldsWithClient",
      "threadDetailFirstPaintEventFields",
      "threadDetailFullReadyEventFields",
      "threadDetailRefreshEventFields",
      "threadDetailShape",
      "threadDetailTimings",
      "planThreadDetailResponseContractDiagnostic",
      "planThreadDetailSlowPathDiagnostic",
      "planThreadListSlowPathDiagnostic",
      "threadDetailProjectionContractFields",
      "threadOmittedTurnCount",
      "threadTurnCount",
      "threadListEventFields",
      "threadListTimings",
    ],
  },
  {
    id: "thread-detail-state",
    source: "public/thread-detail-state.js",
    nativeSource: "frontend/native/thread-detail-state.mjs",
    globalName: "CodexThreadDetailState",
    expectedFunctions: [
      "buildThreadDetailRenderEvidence",
      "activeDetailLoadingPreviewThread",
      "createThreadDetailStatePolicy",
      "emptyDetailHistoryEvidenceForThread",
      "hasNonemptyThreadDetailRenderEvidence",
      "mergeThreadSummaryIntoList",
      "planEmptyDetailHistoryRecovery",
      "planThreadOpenLoadingShell",
      "planThreadOpenCacheReuse",
      "planSummaryOnlyCurrentThreadRecovery",
      "planSummaryOnlyCurrentThreadRecoveryEffects",
      "recentThreadDetailRenderEvidence",
      "rolloutSizeBytesFromThread",
      "sameThreadDetailRenderEvidence",
      "threadHasLoadedDetailState",
      "threadHasReusableLoadedDetailState",
      "threadHasVisualBaselineLoadedDetailState",
      "threadIsSummaryOnlyCurrentThread",
      "threadListSummaryFromDetailThread",
    ],
  },
  {
    id: "thread-detail-render-plan",
    source: "public/thread-detail-render-plan.js",
    nativeSource: "frontend/native/thread-detail-render-plan.mjs",
    globalName: "CodexThreadDetailRenderPlan",
    expectedFunctions: [
      "emptyThreadDetailRefreshPatchAttempt",
      "finalizeThreadDetailRenderPlan",
      "normalizeSignature",
      "planThreadDetailCachedCurrentTelemetryEffects",
      "planThreadDetailCachedCurrentPostRenderEffects",
      "planThreadDetailFirstPaintAfterRenderEffects",
      "planThreadDetailFirstPaintDraftRestoreEffects",
      "planThreadDetailFirstPaintPerformanceInput",
      "planThreadDetailFirstPaintReportingStage",
      "planThreadDetailFirstPaintPostTimingEffects",
      "planThreadDetailFirstPaintPreRenderEffects",
      "planThreadDetailFirstPaintResponseEffects",
      "planThreadDetailFullBackfillResponseEffects",
      "planThreadDetailFullBackfillPerformanceInput",
      "planThreadDetailFullBackfillReportingStage",
      "planThreadDetailLoadErrorEffects",
      "planThreadDetailLoadingShellPostStateEffects",
      "planThreadDetailFullBackfillPostRenderEffects",
      "planThreadDetailFullBackfillTelemetryEffects",
      "planThreadDetailFirstPaintPostRenderEffects",
      "planThreadDetailFirstPaintTelemetryEffects",
      "planThreadDetailSwitchCancelledClientEvent",
      "planThreadDetailSwitchStartClientEvent",
      "planThreadDetailSwitchErrorClientEvent",
      "planThreadDetailRefreshCompletionEffects",
      "planThreadDetailRefreshConsistencyCheck",
      "planThreadDetailRefreshConsistencyCheckEffects",
      "planThreadDetailRefreshResponseEffects",
      "planThreadDetailRefreshPatchAttemptEffects",
      "planThreadDetailRefreshPatchAttemptResult",
      "planThreadDetailRefreshPatchAttemptResultStage",
      "planThreadDetailRefreshPatchAttemptResultEvidenceStage",
      "planThreadDetailRefreshPatchAttemptResultEvidenceCompletionStage",
      "planThreadDetailRefreshPatchAttemptResultEvidenceResolutionStage",
      "planThreadDetailRefreshPatchRejectedVisibleShapeEvidenceEffects",
      "planThreadDetailRefreshPatchRejectedDiagnostic",
      "planThreadDetailRefreshPatchRejectedDiagnosticEffects",
      "planThreadDetailRefreshOutcomeExecution",
      "planThreadDetailRefreshOutcomeExecutionStage",
      "planThreadDetailRefreshExecutionEffects",
      "planThreadDetailRefreshPerformanceInput",
      "planThreadDetailRefreshReportingStage",
      "planThreadDetailRefreshReportingEffectsStage",
      "planThreadDetailRefreshTelemetryEffects",
      "planThreadDetailRefreshFailureDiagnosticEffects",
      "planThreadDetailRefreshRequest",
      "planThreadDetailRefreshPatchSurface",
      "planThreadDetailRefreshPatchSurfaceProbeEffects",
      "planThreadDetailRefreshPatchSurfaceProbeStage",
      "planThreadDetailRefreshPatchSurfaceExecutionStage",
      "planThreadDetailRefreshPatchSurfaceResultStage",
      "planThreadDetailRefreshPostMergeEffects",
      "planThreadDetailRefreshPostMergeTimingFields",
      "planThreadDetailFirstPaintPostMergeTimingEffects",
      "planThreadDetailRefreshPatchExecutionStage",
      "planSingleThreadEarlyShellExecution",
      "planSingleThreadFullRenderShell",
      "planSingleThreadShellConversationUpdate",
      "planSingleThreadShellPostUpdateEffects",
      "planThreadDetailHistoryAutoBackfill",
      "planThreadDetailHistoryAutoBackfillEffects",
      "planThreadDetailRefreshPatchExecution",
      "planThreadDetailRefreshRenderInput",
      "planThreadDetailRefreshRender",
      "planThreadDetailRefreshRenderStage",
      "reduceThreadDetailRefreshPatchAttempt",
      "threadDetailRefreshPatchAttemptEffectContext",
    ],
  },
  {
    id: "thread-detail-dom-patch",
    source: "public/thread-detail-dom-patch.js",
    nativeSource: "frontend/native/thread-detail-dom-patch.mjs",
    globalName: "CodexThreadDetailDomPatch",
    expectedFunctions: [
      "applyLiveTextItemDomPatch",
      "applyThreadDetailPatchTransaction",
      "applyThreadTurnRefreshDomPatch",
      "applyVisibleItemRefreshDomPatch",
      "canPatchNode",
      "createElementFromHtml",
      "createTurnArticleElement",
      "findElementByRenderKey",
      "findTurnArticleElement",
      "hydrateRenderedSurface",
      "insertTurnArticleElement",
      "insertVisibleItemElement",
      "normalizeOperation",
      "normalizeTurnOperation",
      "patchChildNodes",
      "patchHtml",
      "patchNode",
      "planConversationHtmlUpdate",
      "planConversationHtmlUpdateEffects",
      "planConversationHtmlUpdateApplication",
      "planConversationPostApplyDomConsistency",
      "planConversationDomAuthorityInvalidation",
      "planConversationHtmlPatchFallbackClientEvent",
      "planConversationHtmlPerformanceEvent",
      "planLocalConversationDomUpdateCompletionSnapshot",
      "planLocalConversationDomUpdateCompletion",
      "planLocalConversationDomUpdateCompletionEffects",
      "planThreadDetailRefreshLocalPatchTransactionEffects",
      "renderKeyForNode",
      "resolveTurnInsertAnchor",
      "syncAttributes",
      "threadDetailPatchResult",
      "visibleTurnOrderMismatch",
    ],
  },
  {
    id: "draft-store",
    source: "public/draft-store.js",
    nativeSource: "frontend/native/draft-store.mjs",
    globalName: "CodexDraftStore",
    expectedFunctions: [
      "defaultNormalizeFsPath",
      "parseDraftMap",
      "draftHasContent",
      "normalizeAttachmentMeta",
      "attachmentStorageKey",
      "createDraftStore",
    ],
  },
  {
    id: "image-compressor",
    source: "public/image-compressor.js",
    nativeSource: "frontend/native/image-compressor.mjs",
    globalName: "CodexImageCompressor",
    expectedFunctions: [
      "compressedImageName",
      "compressImageFile",
      "isCompressibleImageFile",
      "shouldUseCompressedBlob",
      "targetDimensions",
    ],
  },
  {
    id: "plugin-voice-input",
    source: "public/plugin-voice-input.js",
    nativeSource: "frontend/native/plugin-voice-input.mjs",
    globalName: "CodexPluginVoiceInput",
    expectedFunctions: [
      "actionFromMessageType",
      "capabilityStateMessage",
      "errorMessage",
      "insertResultMessage",
      "isVoiceInputMessage",
      "normalizeAction",
      "startRequestMessage",
      "textFromMessage",
    ],
  },
  {
    id: "api-client",
    source: "public/api-client.js",
    nativeSource: "frontend/native/api-client.mjs",
    globalName: "CodexApiClient",
    expectedFunctions: [
      "createApiClient",
      "isFormDataBody",
    ],
  },
  {
    id: "markdown-renderer",
    source: "public/markdown-renderer.js",
    nativeSource: "frontend/native/markdown-renderer.mjs",
    globalName: "CodexMarkdownRenderer",
    expectedFunctions: [
      "escapeHtml",
      "safeMarkdownUrl",
      "renderInlineMarkdown",
      "renderMarkdown",
      "renderMarkdownList",
      "renderMarkdownTable",
      "splitMarkdownTableRow",
      "isMarkdownTableSeparator",
    ],
  },
  {
    id: "plugin-embed",
    source: "public/plugin-embed.js",
    nativeSource: "frontend/native/plugin-embed.mjs",
    globalName: "CodexPluginEmbed",
    expectedFunctions: [
      "detect",
      "navigationMessage",
      "routeHintOpenPlan",
      "routeHintTargetSelectors",
      "scrubRouteHintPath",
      "externalLinkMessage",
      "refreshRequiredMessage",
    ],
  },
  {
    id: "frontend-runtime-health",
    source: "public/frontend-runtime-health.js",
    nativeSource: "frontend/native/frontend-runtime-health.mjs",
    globalName: "CodexFrontendRuntimeHealth",
    expectedFunctions: [
      "compactToken",
      "createMonitor",
      "submittedMessageDomProbeEffects",
      "threadListInteractionStallEffects",
      "renderChurnEvent",
      "domDropEvent",
      "runtimeSuccess",
    ],
  },
  {
    id: "home-ai-diagnostic-reporting",
    source: "public/home-ai-diagnostic-reporting.js",
    nativeSource: "frontend/native/home-ai-diagnostic-reporting.mjs",
    globalName: "CodexHomeAiDiagnosticReporting",
    expectedFunctions: [
      "boundedToken",
      "createDiagnosticReporter",
      "durationBucket",
      "hashIdentifier",
      "postReportToHomeAi",
      "sanitizeInput",
      "stableTextHash",
    ],
  },
  {
    id: "thread-diagnostic-events",
    source: "public/thread-diagnostic-events.js",
    nativeSource: "frontend/native/thread-diagnostic-events.mjs",
    globalName: "CodexThreadDiagnosticEvents",
    expectedFunctions: [
      "boundedCount",
      "compactToken",
      "conversationProjectionDiagnosticSnapshot",
      "conversationProjectionConsistencyEffects",
      "projectionDiagnosticSnapshot",
      "renderSignatureMismatchDiagnosticEvent",
      "threadDetailResponseDiagnosticEffects",
      "turnOrderDiagnosticSnapshot",
    ],
  },
  {
    id: "thread-tile-layout",
    source: "public/thread-tile-layout.js",
    nativeSource: "frontend/native/thread-tile-layout.mjs",
    globalName: "CodexThreadTileLayout",
    expectedFunctions: [
      "layoutForViewport",
      "normalizeSplitPairs",
      "selectPinnedThreadTileIds",
      "selectThreadTileIds",
      "threadTileColumnGroups",
    ],
  },
  {
    id: "thread-tile-actions",
    source: "public/thread-tile-actions.js",
    nativeSource: "frontend/native/thread-tile-actions.mjs",
    globalName: "CodexThreadTileActions",
    expectedFunctions: [
      "closestWithin",
      "resolveThreadTilePointerAction",
      "resolveThreadTileFocusAction",
      "resolveThreadTileClickAction",
      "resolveThreadTileScrollAction",
      "resolveThreadTileDragStartAction",
      "resolveThreadTileDragOverAction",
      "resolveThreadTileDragLeaveAction",
      "resolveThreadTileDropAction",
    ],
  },
  {
    id: "thread-tile-state",
    source: "public/thread-tile-state.js",
    nativeSource: "frontend/native/thread-tile-state.mjs",
    globalName: "CodexThreadTileState",
    expectedFunctions: [
      "activePaneSyncPlan",
      "candidatePaneIdsPlan",
      "closePanePlan",
      "composerActionControlPlan",
      "composerDraftRuntimeSelectionPlan",
      "composerTargetPlaceholderPlan",
      "composerTargetPlan",
      "displaySettingsPayload",
      "displaySettingsLoadPlan",
      "dropPaneIntent",
      "effectiveSelectedThreadId",
      "idsEqual",
      "layoutCapacity",
      "normalizeDisplaySettings",
      "normalizeOperationMode",
      "normalizePaneCount",
      "normalizePinnedIds",
      "normalizeSplitPairs",
      "operationModeTogglePlan",
      "operationBubbleRecord",
      "operationBubbleSnapshot",
      "operationDockPlan",
      "operationMinimumRefreshPlan",
      "operationSignature",
      "paneBottomButtonPlan",
      "paneCountChangePlan",
      "paneCountStatePlan",
      "paneDisplayLayoutPlan",
      "panePatchCompletionPlan",
      "panePatchPreflightPlan",
      "paneRenderFramePlan",
      "paneRenderSignaturePlan",
      "paneSelectionPlan",
      "paneSlotMutationEffectsPlan",
      "paneScrollHoldPlan",
      "paneScrollMetrics",
      "paneScrollRestorePlan",
      "prependSplitPair",
      "detailLoadPlan",
      "detailLoadErrorEffectsPlan",
      "detailLoadFinallyEffectsPlan",
      "detailLoadConcurrencyPlan",
      "detailLoadQueueDrainPlan",
      "detailLoadQueuePlan",
      "detailLoadStartEffectsPlan",
      "detailLoadSuccessEffectsPlan",
      "refreshDelayMs",
      "refreshSchedulePlan",
      "refreshTargetIds",
      "replaceLastPaneForThreadListOpenPlan",
      "replacePaneThreadPlan",
      "removeSplitPairsForIds",
      "movePaneRelativePlan",
      "selectPanePlan",
      "selectedPaneEffectsPlan",
      "splitPaneWithTargetPlan",
      "switchMenuOptionsPlan",
      "switchMenuPlan",
      "syncPinnedIdsFromActiveIds",
      "threadTileVerticalChromePlan",
      "threadTileViewportBaselinePlan",
      "toggleOperationMode",
      "uniqueIds",
    ],
  },
  {
    id: "thread-tile-runtime",
    source: "public/thread-tile-runtime.js",
    nativeSource: "frontend/native/thread-tile-runtime.mjs",
    globalName: "CodexThreadTileRuntime",
    expectedFunctions: [
      "createThreadTileRuntime",
    ],
  },
  {
    id: "app-update-runtime",
    source: "public/app-update-runtime.js",
    nativeSource: "frontend/native/app-update-runtime.mjs",
    globalName: "CodexAppUpdateRuntime",
    expectedFunctions: [
      "createAppUpdateRuntime",
    ],
  },
  {
    id: "settings-runtime",
    source: "public/settings-runtime.js",
    nativeSource: "frontend/native/settings-runtime.mjs",
    globalName: "CodexSettingsRuntime",
    expectedFunctions: [
      "createSettingsRuntime",
    ],
  },
  {
    id: "modal-runtime",
    source: "public/modal-runtime.js",
    nativeSource: "frontend/native/modal-runtime.mjs",
    globalName: "CodexModalRuntime",
    expectedFunctions: [
      "createModalRuntime",
    ],
  },
  {
    id: "navigation-runtime",
    source: "public/navigation-runtime.js",
    nativeSource: "frontend/native/navigation-runtime.mjs",
    globalName: "CodexNavigationRuntime",
    expectedFunctions: [
      "createNavigationRuntime",
    ],
  },
  {
    id: "runtime-wiring-runtime",
    source: "public/runtime-wiring-runtime.js",
    nativeSource: "frontend/native/runtime-wiring-runtime.mjs",
    globalName: "CodexRuntimeWiringRuntime",
    expectedFunctions: [
      "createRuntimeWiringRuntime",
    ],
  },
  {
    id: "app-shell-runtime",
    source: "public/app-shell-runtime.js",
    nativeSource: "frontend/native/app-shell-runtime.mjs",
    globalName: "CodexAppShellRuntime",
    expectedFunctions: [
      "createAppShellRuntime",
    ],
  },
  {
    id: "pane-layout-runtime",
    source: "public/pane-layout-runtime.js",
    nativeSource: "frontend/native/pane-layout-runtime.mjs",
    globalName: "CodexPaneLayoutRuntime",
    expectedFunctions: [
      "createPaneLayoutRuntime",
    ],
  },
  {
    id: "app-entry",
    source: "public/app.js",
    nativeSource: "frontend/native/app-entry.mjs",
    globalName: "CodexMobileAppEntry",
    expectedFunctions: [
      "createCodexMobileAppEntry",
      "startCodexMobileApp",
    ],
  },
  {
    id: "thread-list-runtime",
    source: "public/thread-list-runtime.js",
    nativeSource: "frontend/native/thread-list-runtime.mjs",
    globalName: "CodexThreadListRuntime",
    expectedFunctions: [
      "createThreadListRuntime",
    ],
  },
  {
    id: "side-chat-runtime",
    source: "public/side-chat-runtime.js",
    nativeSource: "frontend/native/side-chat-runtime.mjs",
    globalName: "CodexSideChatRuntime",
    expectedFunctions: [
      "createSideChatRuntime",
    ],
  },
  {
    id: "media-preview-runtime",
    source: "public/media-preview-runtime.js",
    nativeSource: "frontend/native/media-preview-runtime.mjs",
    globalName: "CodexMediaPreviewRuntime",
    expectedFunctions: [
      "createMediaPreviewRuntime",
    ],
  },
  {
    id: "composer-runtime",
    source: "public/composer-runtime.js",
    globalName: "CodexComposerRuntime",
    expectedFunctions: [
      "createComposerRuntime",
    ],
  },
  {
    id: "composer-bridge-runtime",
    source: "public/composer-bridge-runtime.js",
    nativeSource: "frontend/native/composer-bridge-runtime.mjs",
    globalName: "CodexComposerBridgeRuntime",
    expectedFunctions: [
      "createComposerBridgeRuntime",
    ],
  },
  {
    id: "api-client-runtime",
    source: "public/api-client-runtime.js",
    nativeSource: "frontend/native/api-client-runtime.mjs",
    globalName: "CodexApiClientRuntime",
    expectedFunctions: [
      "createApiClientRuntime",
    ],
  },
  {
    id: "thread-list-load-policy",
    source: "public/thread-list-load-policy.js",
    nativeSource: "frontend/native/thread-list-load-policy.mjs",
    globalName: "CodexThreadListLoadPolicy",
    expectedFunctions: [
      "planThreadListLoadRequest",
    ],
  },
  {
    id: "thread-list-stable-order",
    source: "public/thread-list-stable-order.js",
    nativeSource: "frontend/native/thread-list-stable-order.mjs",
    globalName: "CodexThreadListStableOrder",
    expectedFunctions: [
      "threadListOrderScopeKey",
      "planThreadListStableOrder",
    ],
  },
  {
    id: "thread-status-hints",
    source: "public/thread-status-hints.js",
    nativeSource: "frontend/native/thread-status-hints.mjs",
    globalName: "CodexThreadStatusHints",
    expectedFunctions: [
      "isRunningStatus",
      "shouldExpireRunningThreadHint",
      "shouldMarkThreadUnread",
    ],
  },
  {
    id: "thread-detail-patch-plan",
    source: "public/thread-detail-patch-plan.js",
    nativeSource: "frontend/native/thread-detail-patch-plan.mjs",
    globalName: "CodexThreadDetailPatchPlan",
    expectedFunctions: [
      "planThreadDetailDomPatchSurface",
      "planThreadDetailRefreshDomPatch",
      "planVisibleItemRefreshPatch",
    ],
  },
  {
    id: "thread-detail-actions",
    source: "public/thread-detail-actions.js",
    nativeSource: "frontend/native/thread-detail-actions.mjs",
    globalName: "CodexThreadDetailActions",
    expectedFunctions: [
      "closestWithin",
      "contextThreadIdFromNode",
      "previewableImageFromTarget",
      "resolveRichContentClickAction",
      "resolveThreadDetailClickAction",
    ],
  },
  {
    id: "thread-detail-merge-state",
    source: "public/thread-detail-merge-state.js",
    nativeSource: "frontend/native/thread-detail-merge-state.mjs",
    globalName: "CodexThreadDetailMergeState",
    expectedFunctions: [
      "createThreadDetailMergePolicy",
    ],
  },
  {
    id: "thread-detail-v4-merge-state",
    source: "public/thread-detail-v4-merge-state.js",
    nativeSource: "frontend/native/thread-detail-v4-merge-state.mjs",
    globalName: "CodexThreadDetailV4MergeState",
    expectedFunctions: [
      "createThreadDetailV4MergePolicy",
    ],
  },
  {
    id: "thread-detail-runtime",
    source: "public/thread-detail-runtime.js",
    globalName: "CodexThreadDetailRuntime",
    expectedFunctions: [
      "createThreadDetailRuntime",
    ],
  },
  {
    id: "task-card-runtime",
    source: "public/task-card-runtime.js",
    nativeSource: "frontend/native/task-card-runtime.mjs",
    globalName: "CodexTaskCardRuntime",
    expectedFunctions: [
      "createTaskCardRuntime",
    ],
  },
  {
    id: "notification-ui-runtime",
    source: "public/notification-ui-runtime.js",
    nativeSource: "frontend/native/notification-ui-runtime.mjs",
    globalName: "CodexNotificationUiRuntime",
    expectedFunctions: [
      "createNotificationUiRuntime",
    ],
  },
  {
    id: "conversation-render-runtime",
    source: "public/conversation-render-runtime.js",
    globalName: "CodexConversationRenderRuntime",
    expectedFunctions: [
      "createConversationRenderRuntime",
    ],
  },
  {
    id: "event-stream-runtime",
    source: "public/event-stream-runtime.js",
    globalName: "CodexEventStreamRuntime",
    expectedFunctions: [
      "createEventStreamRuntime",
    ],
  },
  {
    id: "client-render-stability-guard",
    source: "public/client-render-stability-guard.js",
    nativeSource: "frontend/native/client-render-stability-guard.mjs",
    globalName: "CodexClientRenderStabilityGuard",
    expectedFunctions: [
      "firstSubmittedUserMessageClientSubmissionId",
      "localSubmissionRenderKey",
      "markSubmittedTurn",
      "shortHash",
      "stableTurnIdentity",
      "submittedTurnRenderKey",
      "transferSubmittedTurnIdentity",
    ],
  },
  {
    id: "live-operation-dock-state",
    source: "public/live-operation-dock-state.js",
    nativeSource: "frontend/native/live-operation-dock-state.mjs",
    globalName: "CodexLiveOperationDockState",
    expectedFunctions: [
      "compactBubblePreservation",
      "operationCardContentPlan",
      "shouldShowRecall",
    ],
  },
];
const VITE_APP_PREVIEW_CLASSIC_LOADER_EXCLUDED_MODULE_IDS = new Set([
  "api-client",
  "markdown-renderer",
  "build-refresh-policy",
  "runtime-settings",
  "viewport-metrics",
  "conversation-scroll",
  "thread-performance-metrics",
  "thread-detail-state",
  "thread-detail-render-plan",
  "thread-detail-dom-patch",
  "frontend-runtime-health",
  "home-ai-diagnostic-reporting",
  "thread-diagnostic-events",
  "draft-store",
  "image-compressor",
  "plugin-voice-input",
  "plugin-embed",
  "thread-tile-layout",
  "thread-tile-actions",
  "thread-tile-state",
  "thread-tile-runtime",
  "app-update-runtime",
  "settings-runtime",
  "modal-runtime",
  "navigation-runtime",
  "runtime-wiring-runtime",
  "app-shell-runtime",
  "pane-layout-runtime",
  "app-entry",
  "thread-list-runtime",
  "side-chat-runtime",
  "media-preview-runtime",
  "composer-runtime",
  "composer-bridge-runtime",
  "api-client-runtime",
  "thread-list-load-policy",
  "thread-list-stable-order",
  "thread-status-hints",
  "thread-detail-patch-plan",
  "thread-detail-actions",
  "thread-detail-merge-state",
  "thread-detail-v4-merge-state",
  "thread-detail-runtime",
  "task-card-runtime",
  "notification-ui-runtime",
  "conversation-render-runtime",
  "event-stream-runtime",
  "client-render-stability-guard",
  "live-operation-dock-state",
]);
export const VITE_ESM_COMPATIBILITY_MODULES = VITE_ESM_COMPATIBILITY_MODULE_CANDIDATES
  .filter((moduleRecord) => VITE_APP_PREVIEW_CLASSIC_LOADER_EXCLUDED_MODULE_IDS.has(moduleRecord.id));

function readText(root, relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function readJson(root, relativePath) {
  return JSON.parse(readText(root, relativePath));
}

function uniqueValues(values) {
  const seen = new Set();
  const result = [];
  for (const value of values || []) {
    const text = String(value || "").trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  return result;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractQuotedStrings(source) {
  const values = [];
  const pattern = /"([^"]*)"|'([^']*)'/g;
  let match;
  while ((match = pattern.exec(source))) {
    values.push(match[1] ?? match[2] ?? "");
  }
  return values;
}

export function extractExternalScriptSrcs(indexHtml) {
  const values = [];
  const pattern = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/gi;
  let match;
  while ((match = pattern.exec(indexHtml))) {
    const src = String(match[1] || "").trim();
    if (src) values.push(src);
  }
  return values;
}

export function extractLinkHrefs(indexHtml) {
  const values = [];
  const pattern = /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = pattern.exec(indexHtml))) {
    const href = String(match[1] || "").trim();
    if (href && href.startsWith("/")) values.push(href);
  }
  return uniqueValues(values);
}

export function extractArrayDeclarationStrings(source, declarationName) {
  const pattern = new RegExp(
    `${escapeRegExp(declarationName)}\\s*=\\s*(?:Object\\.freeze\\(\\s*)?\\[([\\s\\S]*?)\\]\\s*\\)?`,
    "m"
  );
  const match = source.match(pattern);
  return match ? extractQuotedStrings(match[1]) : [];
}

export function extractServerRuntimeHashAssets(source) {
  const match = source.match(/for\s*\(\s*const\s+file\s+of\s+\[([\s\S]*?)\]\s*\)\s*\{/m);
  return match ? extractQuotedStrings(match[1]).map((value) => `/${value}`) : [];
}

export function extractShellCacheName(source) {
  const match = source.match(/CACHE_NAME\s*=\s*["']([^"']+)["']/);
  return match ? String(match[1] || "") : "";
}

export function extractClientBuildId(source) {
  const match = source.match(/CLIENT_BUILD_ID\s*=\s*["']([^"']+)["']/);
  return match ? String(match[1] || "") : "";
}

function sourcePathForAsset(assetPath) {
  if (assetPath === "/") return "public/index.html";
  const normalized = String(assetPath || "").replace(/^\/+/, "");
  return normalized ? `public/${normalized}` : "";
}

function sha256Hex(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function assetRecord(root, assetPath, role) {
  const sourcePath = sourcePathForAsset(assetPath);
  const absolutePath = sourcePath ? path.join(root, sourcePath) : "";
  let bytes = 0;
  let sha256 = "";
  let exists = false;
  try {
    const buffer = fs.readFileSync(absolutePath);
    bytes = buffer.length;
    sha256 = sha256Hex(buffer);
    exists = true;
  } catch (_) {}
  return {
    path: assetPath,
    role,
    sourcePath,
    exists,
    bytes,
    sha256,
  };
}

function orderedSubset(orderSource, values) {
  const wanted = new Set(values);
  return orderSource.filter((value) => wanted.has(value));
}

export function collectShellAssetGraph(root = process.cwd()) {
  const indexHtml = readText(root, "public/index.html");
  const swSource = readText(root, "public/sw.js");
  const bootstrapSource = readText(root, "public/app-bootstrap.js");
  const serverRuntimeUtilsSource = readText(root, "services/runtime/server-runtime-utils.js");
  const publicManifest = readJson(root, "public/shell-asset-manifest.json");
  const expectedManifest = buildPublicShellManifest(root);
  const indexScriptAssets = extractExternalScriptSrcs(indexHtml);
  const indexLinkAssets = extractLinkHrefs(indexHtml);
  return {
    root,
    shellCacheName: String(publicManifest.shellCacheName || ""),
    clientBuildId: String(publicManifest.clientBuildId || ""),
    indexScriptAssets,
    indexLinkAssets,
    swStaticAssets: Array.isArray(publicManifest.precacheAssets) ? publicManifest.precacheAssets : [],
    pageShellAssets: Array.isArray(publicManifest.pageShellAssets) ? publicManifest.pageShellAssets : [],
    serverHashAssets: Array.isArray(publicManifest.hashAssets) ? publicManifest.hashAssets : [],
    entryGroups: Array.isArray(publicManifest.entryGroups) ? publicManifest.entryGroups : [],
    classicGlobalExports: Array.isArray(publicManifest.classicGlobalExports) ? publicManifest.classicGlobalExports : [],
    startupGlobalContracts: startupGlobalContracts(publicManifest),
    publicManifest,
    expectedManifest,
    swSource,
    bootstrapSource,
    serverRuntimeUtilsSource,
  };
}

export function validateShellAssetGraph(graph) {
  const issues = [];
  const indexScriptSet = new Set(graph.indexScriptAssets);
  const swStaticSet = new Set(graph.swStaticAssets);
  const pageShellSet = new Set(graph.pageShellAssets);
  const serverHashSet = new Set(graph.serverHashAssets);
  const entryGroupAssets = graph.entryGroups.flatMap((group) => Array.isArray(group.assets) ? group.assets : []);
  const expectedClassicGlobalExports = Array.isArray(graph.expectedManifest.classicGlobalExports)
    ? graph.expectedManifest.classicGlobalExports
    : [];
  const expectedStartupGlobalContracts = startupGlobalContracts(graph.expectedManifest);
  const startupCriticalAssets = new Set(graph.entryGroups
    .filter((group) => group && group.startupCritical)
    .flatMap((group) => Array.isArray(group.assets) ? group.assets : []));
  const generatedManifestMatches = JSON.stringify(graph.publicManifest) === JSON.stringify(graph.expectedManifest);

  if (!generatedManifestMatches) issues.push({ code: "public_shell_manifest_out_of_date" });
  if (!graph.entryGroups.length) issues.push({ code: "missing_entry_groups" });
  if (!graph.classicGlobalExports.length) issues.push({ code: "classic_global_exports_missing" });
  if (JSON.stringify(graph.classicGlobalExports) !== JSON.stringify(expectedClassicGlobalExports)) {
    issues.push({ code: "classic_global_exports_mismatch" });
  }
  if (!graph.startupGlobalContracts.length) {
    issues.push({ code: "startup_global_contracts_missing" });
  }
  if (JSON.stringify(graph.startupGlobalContracts) !== JSON.stringify(expectedStartupGlobalContracts)) {
    issues.push({ code: "startup_global_contracts_mismatch" });
  }
  if (JSON.stringify(entryGroupAssets) !== JSON.stringify(graph.indexScriptAssets)) {
    issues.push({ code: "entry_group_order_mismatch" });
  }
  for (const asset of ["/app-bootstrap.js", "/runtime-wiring-runtime.js", "/app-shell-runtime.js", "/app.js"]) {
    if (!startupCriticalAssets.has(asset)) issues.push({ code: "startup_critical_asset_missing", asset });
  }
  if (!indexScriptSet.has("/shell-asset-manifest.js")) {
    issues.push({ code: "index_missing_shell_asset_manifest_script" });
  }
  if (!String(graph.swSource || "").includes('importScripts("/shell-asset-manifest.js")')) {
    issues.push({ code: "sw_not_manifest_owned" });
  }
  if (/const\s+STATIC_ASSETS\s*=\s*\[/.test(String(graph.swSource || ""))) {
    issues.push({ code: "sw_static_assets_manual_list" });
  }
  if (/PAGE_SHELL_ASSETS\s*=\s*Object\.freeze\(\s*\[/.test(String(graph.bootstrapSource || ""))) {
    issues.push({ code: "page_shell_assets_manual_list" });
  }
  if (!String(graph.serverRuntimeUtilsSource || "").includes("shell-asset-manifest.json")) {
    issues.push({ code: "server_hash_not_manifest_owned" });
  }

  for (const asset of graph.indexScriptAssets) {
    if (!swStaticSet.has(asset)) issues.push({ code: "sw_missing_index_script", asset });
    if (!pageShellSet.has(asset)) issues.push({ code: "page_shell_missing_index_script", asset });
    if (!serverHashSet.has(asset)) issues.push({ code: "server_hash_missing_index_script", asset });
  }

  for (const asset of graph.swStaticAssets) {
    if (asset.endsWith(".js") && asset !== "/sw.js" && !indexScriptSet.has(asset)) {
      issues.push({ code: "sw_script_not_loaded_by_index", asset });
    }
  }

  for (const asset of graph.pageShellAssets) {
    if (asset.endsWith(".js") && asset !== "/sw.js" && !indexScriptSet.has(asset)) {
      issues.push({ code: "page_shell_script_not_loaded_by_index", asset });
    }
  }

  const swScriptOrder = orderedSubset(graph.swStaticAssets, graph.indexScriptAssets);
  if (swScriptOrder.join("\n") !== graph.indexScriptAssets.join("\n")) {
    issues.push({ code: "sw_script_order_mismatch" });
  }

  const pageShellScriptOrder = orderedSubset(graph.pageShellAssets, graph.indexScriptAssets);
  if (pageShellScriptOrder.join("\n") !== graph.indexScriptAssets.join("\n")) {
    issues.push({ code: "page_shell_script_order_mismatch" });
  }

  if (!graph.shellCacheName) issues.push({ code: "missing_shell_cache_name" });
  if (!graph.clientBuildId) issues.push({ code: "missing_client_build_id" });
  if (graph.shellCacheName && graph.clientBuildId && !graph.clientBuildId.endsWith(`|${graph.shellCacheName}`)) {
    issues.push({
      code: "client_build_shell_cache_mismatch",
      clientBuildId: graph.clientBuildId,
      shellCacheName: graph.shellCacheName,
    });
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}

export function buildShellAssetManifest(root = process.cwd()) {
  const graph = collectShellAssetGraph(root);
  const validation = validateShellAssetGraph(graph);
  const allAssets = uniqueValues([
    ...graph.swStaticAssets,
    "/sw.js",
    ...graph.pageShellAssets,
    ...graph.indexLinkAssets,
  ]);
  const assetRecords = allAssets.map((assetPath) => {
    const role = graph.indexScriptAssets.includes(assetPath)
      ? "script"
      : assetPath === "/sw.js"
        ? "service-worker"
        : "static";
    return assetRecord(root, assetPath, role);
  });
  for (const asset of assetRecords) {
    if (!asset.exists) validation.issues.push({ code: "asset_file_missing", asset: asset.path });
  }
  validation.ok = validation.issues.length === 0;
  const startupCriticalAssets = uniqueValues(graph.entryGroups
    .filter((group) => group && group.startupCritical)
    .flatMap((group) => Array.isArray(group.assets) ? group.assets : []));
  return {
    schemaVersion: SHELL_MANIFEST_SCHEMA_VERSION,
    generatedBy: "vite-codex-mobile-shell-asset-graph",
    shellCacheName: graph.shellCacheName,
    clientBuildId: graph.clientBuildId,
    counts: {
      indexScripts: graph.indexScriptAssets.length,
      swStaticAssets: graph.swStaticAssets.length,
      pageShellAssets: graph.pageShellAssets.length,
      serverHashAssets: graph.serverHashAssets.length,
      startupCriticalAssets: startupCriticalAssets.length,
      classicGlobalExportAssets: graph.classicGlobalExports.length,
      classicGlobalExports: graph.classicGlobalExports.reduce((total, entry) => (
        total + (Array.isArray(entry && entry.globals) ? entry.globals.length : 0)
      ), 0),
      startupGlobalContracts: graph.startupGlobalContracts.length,
      emittedAssets: assetRecords.length,
    },
    indexScriptAssets: graph.indexScriptAssets,
    indexLinkAssets: graph.indexLinkAssets,
    swStaticAssets: graph.swStaticAssets,
    pageShellAssets: graph.pageShellAssets,
    serverHashAssets: graph.serverHashAssets,
    entryGroups: graph.entryGroups,
    classicGlobalExports: graph.classicGlobalExports,
    startupGlobalContracts: graph.startupGlobalContracts,
    assets: assetRecords,
    validation,
  };
}

function outputPathForAsset(assetPath) {
  if (assetPath === "/") return "shell-assets/index.html";
  return `shell-assets/${String(assetPath || "").replace(/^\/+/, "")}`;
}

function esmCompatibilityImportName(id) {
  return `module_${String(id || "").replace(/[^a-zA-Z0-9]+/g, "_")}`;
}

function esmCompatibilityModuleSource(root, moduleRecord) {
  const sourcePath = String(moduleRecord && (moduleRecord.importSource || moduleRecord.nativeSource || moduleRecord.source) || "");
  return pathToFileURL(path.join(root, sourcePath)).href;
}

function publicAssetPathFromSourcePath(sourcePath) {
  const text = String(sourcePath || "").trim().replace(/\\/g, "/");
  if (!text.startsWith("public/")) return "";
  const relative = text.slice("public".length);
  return relative.startsWith("/") ? relative : `/${relative}`;
}

function esmCompatibilityModuleDefinitions() {
  return VITE_ESM_COMPATIBILITY_MODULES
    .map((moduleRecord) => ({
      ...moduleRecord,
      assetPath: publicAssetPathFromSourcePath(moduleRecord.source),
      importSource: String(moduleRecord.nativeSource || moduleRecord.source || ""),
      compatibilityMode: moduleRecord.nativeSource ? "native-esm" : "classic-global-compat",
      classicLoaderExcluded: true,
    }));
}

function sourceBytes(root, sourcePath) {
  try {
    return fs.statSync(path.join(root, String(sourcePath || ""))).size;
  } catch (_) {
    return 0;
  }
}

function esmCompatibilityShardId(index) {
  return `shard-${String(index + 1).padStart(2, "0")}`;
}

export function buildViteEsmCompatibilityShards(root = process.cwd()) {
  const moduleDefinitions = esmCompatibilityModuleDefinitions().map((moduleRecord) => ({
    ...moduleRecord,
    bytes: sourceBytes(root, moduleRecord.source),
  }));
  const shards = [];
  let current = [];
  let byteCount = 0;
  for (const moduleRecord of moduleDefinitions) {
    const moduleBytes = Number(moduleRecord.bytes) || 0;
    if (current.length && byteCount + moduleBytes > VITE_ESM_COMPATIBILITY_SHARD_TARGET_BYTES) {
      const index = shards.length;
      const id = esmCompatibilityShardId(index);
      shards.push({
        id,
        index,
        source: `${VITE_ESM_COMPATIBILITY_SHARD_SOURCE_PREFIX}${id}`,
        moduleDefinitions: current,
        moduleCount: current.length,
        moduleIds: current.map((entry) => entry.id),
        byteCount,
      });
      current = [];
      byteCount = 0;
    }
    current.push(moduleRecord);
    byteCount += moduleBytes;
  }
  if (current.length) {
    const index = shards.length;
    const id = esmCompatibilityShardId(index);
    shards.push({
      id,
      index,
      source: `${VITE_ESM_COMPATIBILITY_SHARD_SOURCE_PREFIX}${id}`,
      moduleDefinitions: current,
      moduleCount: current.length,
      moduleIds: current.map((entry) => entry.id),
      byteCount,
    });
  }
  return shards;
}

function createEsmCompatibilityShardVirtualModuleSource(root, moduleDefinitions) {
  const importLines = moduleDefinitions.map((moduleRecord) => (
    `import ${esmCompatibilityImportName(moduleRecord.id)} from ${JSON.stringify(esmCompatibilityModuleSource(root, moduleRecord))};`
  ));
  const apiEntries = moduleDefinitions.map((moduleRecord) => (
    `  ${JSON.stringify(moduleRecord.id)}: ${esmCompatibilityImportName(moduleRecord.id)},`
  ));
  return [
    ...importLines,
    "",
    `const moduleDefinitions = ${JSON.stringify(moduleDefinitions, null, 2)};`,
    "const moduleApis = {",
    ...apiEntries,
    "};",
    "",
    "function functionReady(api, name) {",
    "  return Boolean(api && typeof api[name] === \"function\");",
    "}",
    "",
    "function publishClassicGlobal(definition, api) {",
    "  const globalName = String(definition && definition.globalName || \"\");",
    "  if (!globalName || !api || typeof api !== \"object\" || typeof globalThis === \"undefined\") return false;",
    "  globalThis[globalName] = api;",
    "  return globalThis[globalName] === api;",
    "}",
    "",
    "function sampleModule(id, api) {",
    "  if (id === \"build-refresh-policy\") {",
    "    const classification = functionReady(api, \"classifyServerBuildChange\")",
    "      ? api.classifyServerBuildChange(\"0.1.11|codex-mobile-shell-v626\", \"0.1.11|codex-mobile-shell-v625\")",
    "      : \"\";",
    "    const prompt = functionReady(api, \"shouldPromptForServerBuildChange\")",
    "      ? api.shouldPromptForServerBuildChange(\"0.1.11|codex-mobile-shell-v626\", \"0.1.11|codex-mobile-shell-v625\")",
    "      : false;",
    "    return {",
    "      ok: classification === \"server-newer\" && prompt === true,",
    "      classification,",
    "      prompt,",
    "    };",
    "  }",
    "  if (id === \"runtime-settings\") {",
    "    const normalizedOptions = functionReady(api, \"normalizeOptionList\")",
    "      ? api.normalizeOptionList([\"\", \"gpt-5.5\", \" gpt-5.5 \", \"gpt-5.4\"])",
    "      : [];",
    "    const modelLabel = functionReady(api, \"labelForModel\")",
    "      ? api.labelForModel(\"gpt-5.3-codex-spark\")",
    "      : \"\";",
    "    const compactModelLabel = functionReady(api, \"compactLabelForModel\")",
    "      ? api.compactLabelForModel(\"gpt-5.3-codex-spark\")",
    "      : \"\";",
    "    const effortLabel = functionReady(api, \"labelForEffort\")",
    "      ? api.labelForEffort(\"xhigh\")",
    "      : \"\";",
    "    const permissionLabel = functionReady(api, \"labelForPermissionMode\")",
    "      ? api.labelForPermissionMode(\"full\")",
    "      : \"\";",
    "    const permissionTitle = functionReady(api, \"titleForPermissionMode\")",
    "      ? api.titleForPermissionMode(\"custom\")",
    "      : \"\";",
    "    const permissionAlias = functionReady(api, \"normalizePermissionModeValue\")",
    "      ? api.normalizePermissionModeValue(\"full-access\")",
    "      : \"\";",
    "    const selectedModel = functionReady(api, \"selectedNewThreadModel\")",
    "      ? api.selectedNewThreadModel({ selected: \"\", defaultValue: \"gpt-5.5\", options: [\"gpt-5.4\"] })",
    "      : \"\";",
    "    const selectedEffort = functionReady(api, \"selectedNewThreadEffort\")",
    "      ? api.selectedNewThreadEffort({ selected: \" high \", defaultValue: \"medium\", options: [\"low\"] })",
    "      : \"\";",
    "    const selectedPermission = functionReady(api, \"selectedNewThreadPermission\")",
    "      ? api.selectedNewThreadPermission({ selected: \"workspace-write\", defaultValue: \"full\", options: [\"auto\"] })",
    "      : \"\";",
    "    return {",
    "      ok: Array.isArray(normalizedOptions)",
    "        && normalizedOptions.join(\",\") === \"gpt-5.5,gpt-5.4\"",
    "        && modelLabel === \"GPT-5.3 Codex Spark\"",
    "        && compactModelLabel === \"5.3 Spark\"",
    "        && effortLabel === \"XHigh\"",
    "        && permissionLabel === \"完全访问权限\"",
    "        && permissionTitle === \"自定义 (config.toml)\"",
    "        && permissionAlias === \"full\"",
    "        && selectedModel === \"gpt-5.5\"",
    "        && selectedEffort === \"high\"",
    "        && selectedPermission === \"auto\",",
    "      normalizedOptions,",
    "      modelLabel,",
    "      compactModelLabel,",
    "      effortLabel,",
    "      permissionLabel,",
    "      permissionTitle,",
    "      permissionAlias,",
    "      selectedModel,",
    "      selectedEffort,",
    "      selectedPermission,",
    "    };",
    "  }",
    "  if (id === \"viewport-metrics\") {",
    "    const editable = functionReady(api, \"isKeyboardEditable\")",
    "      ? api.isKeyboardEditable({ tagName: \"INPUT\", type: \"text\" })",
    "      : false;",
    "    const checkboxEditable = functionReady(api, \"isKeyboardEditable\")",
    "      ? api.isKeyboardEditable({ tagName: \"INPUT\", type: \"checkbox\" })",
    "      : true;",
    "    const measurement = functionReady(api, \"measureViewport\")",
    "      ? api.measureViewport({",
    "        visualHeight: 520,",
    "        visualOffsetTop: 16,",
    "        innerHeight: 1024,",
    "        clientHeight: 1024,",
    "        activeElement: { tagName: \"TEXTAREA\" },",
    "      })",
    "      : {};",
    "    const stableChanged = functionReady(api, \"stablePixelChanged\")",
    "      ? api.stablePixelChanged(92, 94)",
    "      : false;",
    "    const stableNoise = functionReady(api, \"stablePixelChanged\")",
    "      ? api.stablePixelChanged(92, 93)",
    "      : true;",
    "    const cssPixel = functionReady(api, \"cssPixel\")",
    "      ? api.cssPixel(92.6)",
    "      : 0;",
    "    return {",
    "      ok: editable === true",
    "        && checkboxEditable === false",
    "        && measurement.keyboardShrunk === true",
    "        && measurement.height === 520",
    "        && measurement.top === 16",
    "        && stableChanged === true",
    "        && stableNoise === false",
    "        && cssPixel === 93,",
    "      editable,",
    "      checkboxEditable,",
    "      keyboardShrunk: Boolean(measurement.keyboardShrunk),",
    "      height: Number(measurement.height) || 0,",
    "      top: Number(measurement.top) || 0,",
    "      stableChanged,",
    "      stableNoise,",
    "      cssPixel,",
    "    };",
    "  }",
    "  if (id === \"conversation-scroll\") {",
    "    const nearBottom = functionReady(api, \"isNearBottom\")",
    "      ? api.isNearBottom({ scrollHeight: 1800, scrollTop: 725, clientHeight: 980 })",
    "      : false;",
    "    const notNearBottom = functionReady(api, \"isNearBottom\")",
    "      ? api.isNearBottom({ scrollHeight: 1800, scrollTop: 640, clientHeight: 980 })",
    "      : true;",
    "    const submittedFollow = functionReady(api, \"createSubmittedMessageFollow\")",
    "      ? api.createSubmittedMessageFollow(\"thread-a\", { clientSubmissionId: \"submit-1\", nowMs: 1000, ttlMs: 5000 })",
    "      : null;",
    "    const submittedActive = functionReady(api, \"shouldFollowSubmittedMessage\")",
    "      ? api.shouldFollowSubmittedMessage(submittedFollow, { threadId: \"thread-a\", nowMs: 5999 })",
    "      : false;",
    "    const submittedWrongThread = functionReady(api, \"shouldFollowSubmittedMessage\")",
    "      ? api.shouldFollowSubmittedMessage(submittedFollow, { threadId: \"thread-b\", nowMs: 2000 })",
    "      : true;",
    "    const viewportFollow = functionReady(api, \"createViewportFollow\")",
    "      ? api.createViewportFollow(\"thread-a\", { reason: \"orientation\", nowMs: 1000, ttlMs: 3000 })",
    "      : null;",
    "    const viewportActive = functionReady(api, \"shouldFollowViewport\")",
    "      ? api.shouldFollowViewport(viewportFollow, { threadId: \"thread-a\", nowMs: 3999 })",
    "      : false;",
    "    const lease = functionReady(api, \"planBottomFollowLeaseEvaluation\")",
    "      ? api.planBottomFollowLeaseEvaluation({ leaseActive: true, hasLease: true })",
    "      : {};",
    "    const schedule = functionReady(api, \"planBottomFollowScrollSchedule\")",
    "      ? api.planBottomFollowScrollSchedule()",
    "      : {};",
    "    const refresh = functionReady(api, \"planAutomaticConversationRefresh\")",
    "      ? api.planAutomaticConversationRefresh({ hasThread: true, nearBottom: false, userReadingCurrentTurn: true })",
    "      : {};",
    "    const fullRender = functionReady(api, \"planFullRenderScroll\")",
    "      ? api.planFullRenderScroll({ submittedMessageFollow: true })",
    "      : {};",
    "    return {",
    "      ok: nearBottom === true",
    "        && notNearBottom === false",
    "        && submittedFollow && submittedFollow.untilMs === 6000",
    "        && submittedActive === true",
    "        && submittedWrongThread === false",
    "        && viewportFollow && viewportFollow.untilMs === 4000",
    "        && viewportActive === true",
    "        && lease.reason === \"lease-active\"",
    "        && Array.isArray(schedule.delaysMs)",
    "        && schedule.delaysMs.join(\",\") === \"0,80,240,600,1200\"",
    "        && refresh.allowRefresh === false",
    "        && refresh.reason === \"user-reading-current-turn\"",
    "        && fullRender.stickToBottom === true",
    "        && fullRender.reason === \"submitted-message-follow\",",
    "      nearBottom,",
    "      submittedActive,",
    "      viewportActive,",
    "      leaseReason: String(lease.reason || \"\"),",
    "      scheduleDelays: Array.isArray(schedule.delaysMs) ? schedule.delaysMs : [],",
    "      refreshReason: String(refresh.reason || \"\"),",
    "      fullRenderReason: String(fullRender.reason || \"\"),",
    "    };",
    "  }",
    "  if (id === \"thread-performance-metrics\") {",
    "    const listPhase = functionReady(api, \"classifyThreadListPhase\")",
    "      ? api.classifyThreadListPhase({ fallbackCacheDecision: \"expired-rebuild\", fallbackMs: 25 })",
    "      : \"\";",
    "    const detailPhase = functionReady(api, \"classifyThreadDetailPhase\")",
    "      ? api.classifyThreadDetailPhase({ readDecision: \"projection-hit\", projectionSource: \"dynamic\" })",
    "      : \"\";",
    "    const clientTimings = functionReady(api, \"threadDetailClientTimings\")",
    "      ? api.threadDetailClientTimings({ elapsedMs: 26.4, renderElapsedMs: 7.2, detailRenderMode: \"patch\" })",
    "      : {};",
    "    const detailFields = functionReady(api, \"threadDetailEventFields\")",
    "      ? api.threadDetailEventFields({",
    "        mobileDiagnostics: { threadDetailTimings: { phase: \"warm-projection-cache\", totalMs: 8 } },",
    "        turns: [{ status: \"completed\", items: [{ type: \"userMessage\", text: \"prompt\" }] }],",
    "      })",
    "      : {};",
    "    const shape = functionReady(api, \"threadDetailShape\")",
    "      ? api.threadDetailShape({",
    "        mobileOmittedTurnCount: 2,",
    "        turns: [",
    "          { status: \"completed\", items: [{ type: \"userMessage\", text: \"prompt\" }] },",
    "          { status: \"running\", items: [{ type: \"agentMessage\", text: \"reply\" }] },",
    "        ],",
    "      })",
    "      : {};",
    "    const slow = functionReady(api, \"planThreadDetailSlowPathDiagnostic\")",
    "      ? api.planThreadDetailSlowPathDiagnostic({",
    "        elapsedMs: 1600,",
    "        apiElapsedMs: 1550,",
    "        renderElapsedMs: 20,",
    "        performancePhase: \"cold-turns-list-initial\",",
    "      }, { action: \"thread-detail-load\", threadHash: \"thread_hash\", durationBucket: \"1_3s\" })",
    "      : {};",
    "    return {",
    "      ok: listPhase === \"cold-fallback-expired-rebuild\"",
    "        && detailPhase === \"warm-projection-dynamic\"",
    "        && clientTimings.elapsedMs === 26",
    "        && clientTimings.renderElapsedMs === 7",
    "        && clientTimings.detailRenderMode === \"patch\"",
    "        && detailFields.performancePhase === \"warm-projection-cache\"",
    "        && shape.turns === 2",
    "        && shape.visibleItems === 2",
    "        && shape.omittedTurns === 2",
    "        && shape.completedTurns === 1",
    "        && shape.activeTurns === 1",
    "        && slow.shouldReport === true",
    "        && slow.reason === \"api-slow\",",
    "      listPhase,",
    "      detailPhase,",
    "      elapsedMs: Number(clientTimings.elapsedMs) || 0,",
    "      detailPerformancePhase: String(detailFields.performancePhase || \"\"),",
    "      visibleItems: Number(shape.visibleItems) || 0,",
    "      slowReason: String(slow.reason || \"\"),",
    "    };",
    "  }",
    "  if (id === \"thread-detail-state\") {",
    "    const loadedThread = {",
    "      id: \"thread-a\",",
    "      title: \"Thread A\",",
    "      status: \"completed\",",
    "      mobileDetailLoaded: true,",
    "      mobileLoading: false,",
    "      turns: [",
    "        { id: \"turn-a\", status: \"completed\", items: [{ type: \"userMessage\", text: \"hello\" }] },",
    "      ],",
    "      mobileProjection: { source: \"sample\" },",
    "    };",
    "    const summary = functionReady(api, \"threadListSummaryFromDetailThread\")",
    "      ? api.threadListSummaryFromDetailThread(loadedThread)",
    "      : {};",
    "    const loaded = functionReady(api, \"threadHasLoadedDetailState\")",
    "      ? api.threadHasLoadedDetailState(loadedThread)",
    "      : false;",
    "    const reusable = functionReady(api, \"threadHasReusableLoadedDetailState\")",
    "      ? api.threadHasReusableLoadedDetailState(loadedThread)",
    "      : false;",
    "    const visualBaseline = functionReady(api, \"threadHasVisualBaselineLoadedDetailState\")",
    "      ? api.threadHasVisualBaselineLoadedDetailState(Object.assign({}, loadedThread, { status: \"active\" }))",
    "      : false;",
    "    const cacheReuse = functionReady(api, \"planThreadOpenCacheReuse\")",
    "      ? api.planThreadOpenCacheReuse({ currentThread: loadedThread, threadId: \"thread-a\" })",
    "      : {};",
    "    return {",
    "      ok: summary && summary.id === \"thread-a\"",
    "        && !Object.prototype.hasOwnProperty.call(summary, \"turns\")",
    "        && !Object.prototype.hasOwnProperty.call(summary, \"mobileProjection\")",
    "        && loaded === true",
    "        && reusable === true",
    "        && visualBaseline === true",
    "        && cacheReuse && typeof cacheReuse === \"object\",",
    "      summaryId: String(summary && summary.id || \"\"),",
    "      summaryHasTurns: Object.prototype.hasOwnProperty.call(summary || {}, \"turns\"),",
    "      loaded,",
    "      reusable,",
    "      visualBaseline,",
    "      cacheReuseReason: String(cacheReuse.reason || \"\"),",
    "    };",
    "  }",
    "  if (id === \"thread-detail-render-plan\") {",
    "    const backfill = functionReady(api, \"planThreadDetailHistoryAutoBackfill\")",
    "      ? api.planThreadDetailHistoryAutoBackfill({",
    "        hasOlder: true,",
    "        thread: {",
    "          mobileOlderTurnsCursor: \"cursor-a\",",
    "          turns: [",
    "            { items: [{ type: \"assistantMessage\", text: \"[Cross-thread task card sent by source thread]\" }] },",
    "          ],",
    "        },",
    "      })",
    "      : {};",
    "    const request = functionReady(api, \"planThreadDetailRefreshRequest\")",
    "      ? api.planThreadDetailRefreshRequest({",
    "        threadId: \"thread-a\",",
    "        threadLoadSeq: 7,",
    "        options: { source: \"auto-refresh\" },",
    "      })",
    "      : {};",
    "    const postUpdate = functionReady(api, \"planSingleThreadShellPostUpdateEffects\")",
    "      ? api.planSingleThreadShellPostUpdateEffects({",
    "        bindCurrentThreadActions: true,",
    "        updateTickTimer: true,",
    "        publishPluginNavigationState: true,",
    "        reason: \"sample\",",
    "      })",
    "      : {};",
    "    const normalizedSignature = functionReady(api, \"normalizeSignature\")",
    "      ? api.normalizeSignature(42)",
    "      : \"\";",
    "    const effects = Array.isArray(postUpdate.effects) ? postUpdate.effects : [];",
    "    return {",
    "      ok: normalizedSignature === \"42\"",
    "        && backfill.shouldLoad === true",
    "        && backfill.reason === \"sparse-conversation-context\"",
    "        && request.shouldRefresh === true",
    "        && request.threadId === \"thread-a\"",
    "        && request.requestedMode === \"recent\"",
    "        && request.query && request.query.mode === \"recent\"",
    "        && effects.map((entry) => String(entry && entry.type || \"\")).join(\",\") === \"bind-current-thread-actions,update-tick-timer,publish-plugin-navigation-state\",",
    "      normalizedSignature,",
    "      backfillReason: String(backfill.reason || \"\"),",
    "      refreshReason: String(request.reason || \"\"),",
    "      effectTypes: effects.map((entry) => String(entry && entry.type || \"\")),",
    "    };",
    "  }",
    "  if (id === \"thread-detail-dom-patch\") {",
    "    const patch = functionReady(api, \"threadDetailPatchResult\")",
    "      ? api.threadDetailPatchResult(true, \"patched\", { patched: 2 })",
    "      : {};",
    "    const mismatch = functionReady(api, \"visibleTurnOrderMismatch\")",
    "      ? api.visibleTurnOrderMismatch({ expectedTurnIds: [\"a\", \"b\"], renderedDomTurnIds: [\"a\", \"c\"] })",
    "      : false;",
    "    const match = functionReady(api, \"visibleTurnOrderMismatch\")",
    "      ? api.visibleTurnOrderMismatch({ expectedTurnIds: [\"a\", \"b\"], renderedDomTurnIds: [\"a\", \"b\"] })",
    "      : true;",
    "    const operation = functionReady(api, \"normalizeOperation\")",
    "      ? api.normalizeOperation({ type: \"insert\", key: \"turn-a\", nextEntry: { key: \"turn-a\", html: \"<article></article>\" } })",
    "      : null;",
    "    const htmlUpdate = functionReady(api, \"planConversationHtmlUpdate\")",
    "      ? api.planConversationHtmlUpdate({",
    "        html: \"<article data-turn-id=\\\"a\\\"></article>\",",
    "        previousHtml: \"<article data-turn-id=\\\"a\\\"></article>\",",
    "        conversationSignature: \"sig-a\",",
    "        previousConversationSignature: \"sig-a\",",
    "      })",
    "      : {};",
    "    return {",
    "      ok: patch.ok === true",
    "        && patch.reason === \"patched\"",
    "        && patch.patched === 2",
    "        && mismatch === true",
    "        && match === false",
    "        && operation && operation.key === \"turn-a\"",
    "        && htmlUpdate.action === \"hydrate-existing\"",
    "        && htmlUpdate.reason === \"signature-stable\",",
    "      patchReason: String(patch.reason || \"\"),",
    "      patched: Number(patch.patched) || 0,",
    "      mismatch,",
    "      match,",
    "      operationKey: String(operation && operation.key || \"\"),",
    "      htmlAction: String(htmlUpdate.action || \"\"),",
    "    };",
    "  }",
    "  if (id === \"draft-store\") {",
    "    const memory = new Map();",
    "    const storage = {",
    "      getItem(key) { return memory.has(key) ? memory.get(key) : null; },",
    "      setItem(key, value) { memory.set(key, String(value)); },",
    "      removeItem(key) { memory.delete(key); },",
    "    };",
    "    const store = functionReady(api, \"createDraftStore\")",
    "      ? api.createDraftStore({ storage, maxDrafts: 2 })",
    "      : null;",
    "    if (store && typeof store.writeMap === \"function\") {",
    "      store.writeMap({",
    "        old: { text: \"old\", updatedAt: 1 },",
    "        newest: { text: \"newest\", updatedAt: 3 },",
    "        middle: { text: \"middle\", updatedAt: 2 },",
    "      });",
    "      store.setTargetKey(\"new:/repo\");",
    "    }",
    "    const draftKeys = store && typeof store.readMap === \"function\"",
    "      ? Object.keys(store.readMap())",
    "      : [];",
    "    const threadKey = store && typeof store.keyForThread === \"function\"",
    "      ? store.keyForThread(\" abc \")",
    "      : \"\";",
    "    const newThreadKey = store && typeof store.keyForNewThread === \"function\"",
    "      ? store.keyForNewThread(\"C:/Users/xuefu/project/\")",
    "      : \"\";",
    "    const targetKey = store && typeof store.getTargetKey === \"function\"",
    "      ? store.getTargetKey()",
    "      : \"\";",
    "    const parsed = functionReady(api, \"parseDraftMap\")",
    "      ? api.parseDraftMap(\"{\\\"a\\\":{\\\"text\\\":\\\"draft\\\"}}\")",
    "      : {};",
    "    const hasContent = functionReady(api, \"draftHasContent\")",
    "      ? api.draftHasContent({ permissionMode: \"full\" })",
    "      : false;",
    "    const meta = functionReady(api, \"normalizeAttachmentMeta\")",
    "      ? api.normalizeAttachmentMeta({ id: 7, file: { name: \"screenshot.png\", type: \"image/png\", size: 42, lastModified: 123 } })",
    "      : null;",
    "    const attachmentKey = functionReady(api, \"attachmentStorageKey\")",
    "      ? api.attachmentStorageKey(\"new:/a b\", \"x/y\")",
    "      : \"\";",
    "    const normalizedPath = functionReady(api, \"defaultNormalizeFsPath\")",
    "      ? api.defaultNormalizeFsPath(\"C:/Users/xuefu/project/\")",
    "      : \"\";",
    "    return {",
    "      ok: threadKey === \"thread:abc\"",
    "        && newThreadKey === \"new:c:\\\\users\\\\xuefu\\\\project\"",
    "        && targetKey === \"new:/repo\"",
    "        && draftKeys.join(\",\") === \"newest,middle\"",
    "        && parsed && parsed.a && parsed.a.text === \"draft\"",
    "        && hasContent === true",
    "        && meta && meta.id === \"7\" && meta.size === 42",
    "        && attachmentKey === \"new%3A%2Fa%20b|x%2Fy\"",
    "        && normalizedPath === \"c:\\\\users\\\\xuefu\\\\project\",",
    "      threadKey,",
    "      newThreadKey,",
    "      targetKey,",
    "      draftKeys,",
    "      hasContent,",
    "      attachmentKey,",
    "      normalizedPath,",
    "    };",
    "  }",
    "  if (id === \"image-compressor\") {",
    "    const compressible = functionReady(api, \"isCompressibleImageFile\")",
    "      ? api.isCompressibleImageFile({ type: \"image/png\", size: 300 * 1024 })",
    "      : false;",
    "    const smallImage = functionReady(api, \"isCompressibleImageFile\")",
    "      ? api.isCompressibleImageFile({ type: \"image/png\", size: 12 * 1024 })",
    "      : true;",
    "    const dims = functionReady(api, \"targetDimensions\")",
    "      ? api.targetDimensions(3000, 1500, 1200)",
    "      : {};",
    "    const name = functionReady(api, \"compressedImageName\")",
    "      ? api.compressedImageName(\"folder/screen.png\", \"image/webp\")",
    "      : \"\";",
    "    const useful = functionReady(api, \"shouldUseCompressedBlob\")",
    "      ? api.shouldUseCompressedBlob({ size: 1000 }, { size: 800 })",
    "      : false;",
    "    const marginal = functionReady(api, \"shouldUseCompressedBlob\")",
    "      ? api.shouldUseCompressedBlob({ size: 1000 }, { size: 930 })",
    "      : true;",
    "    return {",
    "      ok: compressible === true",
    "        && smallImage === false",
    "        && dims.width === 1200",
    "        && dims.height === 600",
    "        && dims.scaled === true",
    "        && name === \"folder_screen.webp\"",
    "        && useful === true",
    "        && marginal === false,",
    "      compressible,",
    "      smallImage,",
    "      width: Number(dims.width) || 0,",
    "      height: Number(dims.height) || 0,",
    "      scaled: Boolean(dims.scaled),",
    "      name,",
    "      useful,",
    "      marginal,",
    "    };",
    "  }",
    "  if (id === \"plugin-voice-input\") {",
    "    const capability = functionReady(api, \"capabilityStateMessage\")",
    "      ? api.capabilityStateMessage({ writable: true, threadId: \"thread-a\", draftId: \"draft-a\", actions: [\"append\", \"replace\", \"submit\"], maxChars: 100 })",
    "      : {};",
    "    const start = functionReady(api, \"startRequestMessage\")",
    "      ? api.startRequestMessage({ requestId: \"req-1\", voiceSessionId: \"voice-1\", capability })",
    "      : {};",
    "    const insert = functionReady(api, \"insertResultMessage\")",
    "      ? api.insertResultMessage({ ok: false, action: \"append_text\", code: \"composer_not_writable\", composerId: \"thread-composer\" })",
    "      : {};",
    "    const error = functionReady(api, \"errorMessage\")",
    "      ? api.errorMessage({ code: \"voice_error\", error: \"Voice failed\" })",
    "      : {};",
    "    const action = functionReady(api, \"normalizeAction\")",
    "      ? api.normalizeAction(\"append\")",
    "      : \"\";",
    "    const actionFromType = functionReady(api, \"actionFromMessageType\")",
    "      ? api.actionFromMessageType(\"voice_input.replace_draft\")",
    "      : \"\";",
    "    const text = functionReady(api, \"textFromMessage\")",
    "      ? api.textFromMessage({ text: \"  hello\\u00a0world  \" }, 20)",
    "      : \"\";",
    "    const voiceMessage = functionReady(api, \"isVoiceInputMessage\")",
    "      ? api.isVoiceInputMessage({ type: \"voice_input.append_text\" })",
    "      : false;",
    "    return {",
    "      ok: capability.type === \"voice_input.capability_state\"",
    "        && capability.writable === true",
    "        && Array.isArray(capability.actions)",
    "        && capability.actions.join(\",\") === \"append_text,replace_draft\"",
    "        && start.type === \"voice_input.start_request\"",
    "        && start.requestId === \"req-1\"",
    "        && insert.ok === false",
    "        && insert.code === \"composer_not_writable\"",
    "        && error.code === \"voice_error\"",
    "        && action === \"append_text\"",
    "        && actionFromType === \"replace_draft\"",
    "        && text === \"hello world\"",
    "        && voiceMessage === true,",
    "      capabilityType: String(capability.type || \"\"),",
    "      actions: Array.isArray(capability.actions) ? capability.actions : [],",
    "      startType: String(start.type || \"\"),",
    "      insertCode: String(insert.code || \"\"),",
    "      errorCode: String(error.code || \"\"),",
    "      action,",
    "      actionFromType,",
    "      text,",
    "      voiceMessage,",
    "    };",
    "  }",
    "  if (id === \"api-client\") {",
    "    function FakeFormData() {}",
    "    const formData = new FakeFormData();",
    "    const isFormData = functionReady(api, \"isFormDataBody\")",
    "      ? api.isFormDataBody(formData, FakeFormData)",
    "      : false;",
    "    const jsonBody = functionReady(api, \"isFormDataBody\")",
    "      ? api.isFormDataBody({ ok: true }, FakeFormData)",
    "      : true;",
    "    const client = functionReady(api, \"createApiClient\")",
    "      ? api.createApiClient({ fetch: () => Promise.resolve({ ok: true, status: 204 }), AbortControllerCtor: AbortController, FormDataCtor: FakeFormData, getKey: () => \"\" })",
    "      : null;",
    "    return {",
    "      ok: isFormData === true",
    "        && jsonBody === false",
    "        && client && typeof client.request === \"function\",",
    "      isFormData,",
    "      jsonBody,",
    "      requestReady: Boolean(client && typeof client.request === \"function\"),",
    "    };",
    "  }",
    "  if (id === \"markdown-renderer\") {",
    "    const escaped = functionReady(api, \"escapeHtml\")",
    "      ? api.escapeHtml(\"<tag>&\\\"\")",
    "      : \"\";",
    "    const safeUrl = functionReady(api, \"safeMarkdownUrl\")",
    "      ? api.safeMarkdownUrl(\"https://example.com\")",
    "      : \"\";",
    "    const unsafeUrl = functionReady(api, \"safeMarkdownUrl\")",
    "      ? api.safeMarkdownUrl(\"javascript:alert(1)\")",
    "      : \"unsafe\";",
    "    const inline = functionReady(api, \"renderInlineMarkdown\")",
    "      ? api.renderInlineMarkdown(\"**bold** <https://example.com>, `code`\")",
    "      : \"\";",
    "    const block = functionReady(api, \"renderMarkdown\")",
    "      ? api.renderMarkdown(\"# Title\\n\\n- item\\n- **bold**\")",
    "      : \"\";",
    "    const tableSeparator = functionReady(api, \"isMarkdownTableSeparator\")",
    "      ? api.isMarkdownTableSeparator(\"|---|:---:|\")",
    "      : false;",
    "    const row = functionReady(api, \"splitMarkdownTableRow\")",
    "      ? api.splitMarkdownTableRow(\"| A | B |\")",
    "      : [];",
    "    const list = functionReady(api, \"renderMarkdownList\")",
    "      ? api.renderMarkdownList([\"1. one\", \"2. two\"], true)",
    "      : \"\";",
    "    const table = functionReady(api, \"renderMarkdownTable\")",
    "      ? api.renderMarkdownTable([\"A | B\", \"---|---\", \"1 | 2\"])",
    "      : \"\";",
    "    return {",
    "      ok: escaped === \"&lt;tag&gt;&amp;&quot;\"",
    "        && safeUrl === \"https://example.com\"",
    "        && unsafeUrl === \"\"",
    "        && inline.includes(\"<strong>bold</strong>\")",
    "        && inline.includes(\"<code>code</code>\")",
    "        && block.includes(\"<h2>Title</h2>\")",
    "        && tableSeparator === true",
    "        && Array.isArray(row) && row.join(\",\") === \"A,B\"",
    "        && list.includes(\"<ol>\")",
    "        && table.includes(\"<table>\"),",
    "      escaped,",
    "      safeUrl,",
    "      unsafeUrl,",
    "      row,",
    "      inlineHasStrong: inline.includes(\"<strong>bold</strong>\"),",
    "      blockHasHeading: block.includes(\"<h2>Title</h2>\"),",
    "      listHasOl: list.includes(\"<ol>\"),",
    "      tableHasTable: table.includes(\"<table>\"),",
    "    };",
    "  }",
    "  if (id === \"plugin-embed\") {",
    "    const detected = functionReady(api, \"detect\")",
    "      ? api.detect(\"http://127.0.0.1/?embed=hermes&pluginId=codex-mobile&pluginRoute=thread&pluginThreadId=t1&pluginTheme=dark&pluginFontSize=large\")",
    "      : {};",
    "    const navigation = functionReady(api, \"navigationMessage\")",
    "      ? api.navigationMessage({ currentThreadId: \"t1\" }, {})",
    "      : {};",
    "    const openPlan = functionReady(api, \"routeHintOpenPlan\")",
    "      ? api.routeHintOpenPlan({ pluginId: \"codex-mobile\", threadId: \"t1\", itemId: \"i1\" })",
    "      : {};",
    "    const selectors = functionReady(api, \"routeHintTargetSelectors\")",
    "      ? api.routeHintTargetSelectors({ itemId: \"i1\" })",
    "      : [];",
    "    const scrubbed = functionReady(api, \"scrubRouteHintPath\")",
    "      ? api.scrubRouteHintPath(\"http://127.0.0.1/thread?pluginId=codex-mobile&pluginThreadId=t1\", { workspaceId: \"ws1\", appearance: { theme: \"dark\" } })",
    "      : \"\";",
    "    const external = functionReady(api, \"externalLinkMessage\")",
    "      ? api.externalLinkMessage({ href: \"https://example.com/a\" })",
    "      : {};",
    "    const refresh = functionReady(api, \"refreshRequiredMessage\")",
    "      ? api.refreshRequiredMessage({ reason: \"version_changed\", route: { kind: \"thread\", threadId: \"t1\" }, appearance: { theme: \"light\" } })",
    "      : {};",
    "    return {",
    "      ok: detected.embedded === true",
    "        && detected.routeHint && detected.routeHint.threadId === \"t1\"",
    "        && detected.appearance && detected.appearance.theme === \"dark\"",
    "        && navigation.type === \"codex-mobile.plugin.navigation\"",
    "        && navigation.canGoBack === true",
    "        && openPlan.action === \"openThread\"",
    "        && Array.isArray(selectors) && selectors[0] === \"[data-approval-card=\\\"i1\\\"]\"",
    "        && scrubbed === \"/thread?embed=hermes&workspaceId=ws1&pluginTheme=dark\"",
    "        && external.type === \"codex-mobile.plugin.external_link\"",
    "        && refresh.type === \"codex-mobile.plugin.refresh_required\",",
    "      embedded: Boolean(detected.embedded),",
    "      routeThreadId: String(detected.routeHint && detected.routeHint.threadId || \"\"),",
    "      navigationType: String(navigation.type || \"\"),",
    "      canGoBack: Boolean(navigation.canGoBack),",
    "      openAction: String(openPlan.action || \"\"),",
    "      firstSelector: String(selectors[0] || \"\"),",
    "      scrubbed,",
    "      externalType: String(external.type || \"\"),",
    "      refreshType: String(refresh.type || \"\"),",
    "    };",
    "  }",
    "  if (id === \"frontend-runtime-health\") {",
    "    const token = functionReady(api, \"compactToken\")",
    "      ? api.compactToken(\" Home AI / Thread Detail \", \"fallback\", 20)",
    "      : \"\";",
    "    const missingEffects = functionReady(api, \"submittedMessageDomProbeEffects\")",
    "      ? api.submittedMessageDomProbeEffects({ elapsedMs: 300, currentThreadMatch: true, hasThreadSubmission: true, domHasSubmission: false, threadHash: \"abc\" })",
    "      : {};",
    "    const stallEffects = functionReady(api, \"threadListInteractionStallEffects\")",
    "      ? api.threadListInteractionStallEffects({ threadListVisible: true, threadListMonitorable: true, maxRafDelayMs: 640, minDelayMs: 500 })",
    "      : {};",
    "    const monitor = functionReady(api, \"createMonitor\")",
    "      ? api.createMonitor({ now: () => 1000 })",
    "      : null;",
    "    const monitorResult = monitor && typeof monitor.recordRender === \"function\"",
    "      ? monitor.recordRender({ fullRender: false, fallbackApplied: false, previousCount: 2, domCount: 2, visibleCount: 2, duplicateCount: 0 })",
    "      : {};",
    "    const dropEvent = functionReady(api, \"domDropEvent\")",
    "      ? api.domDropEvent({ previousCount: 3, domCount: 1, visibleCount: 3 })",
    "      : {};",
    "    const success = functionReady(api, \"runtimeSuccess\")",
    "      ? api.runtimeSuccess({ diagnosticType: \"render_dom_drop\", errorCode: \"render_dom_drop\" })",
    "      : {};",
    "    return {",
    "      ok: token === \"Home_AI_Thread_Detai\"",
    "        && missingEffects.reason === \"submitted-message-dom-missing\"",
    "        && Array.isArray(missingEffects.effects)",
    "        && missingEffects.effects[0] && missingEffects.effects[0].type === \"diagnostic-failure\"",
    "        && stallEffects.reason === \"thread-list-interaction-stall\"",
    "        && monitorResult.renderCount === 1",
    "        && Array.isArray(monitorResult.effects)",
    "        && monitorResult.effects.length === 2",
    "        && dropEvent.diagnostic_type === \"render_dom_drop\"",
    "        && success.error_code === \"render_dom_drop\",",
    "      token,",
    "      missingReason: String(missingEffects.reason || \"\"),",
    "      stallReason: String(stallEffects.reason || \"\"),",
    "      monitorRenderCount: Number(monitorResult.renderCount) || 0,",
    "      dropDiagnosticType: String(dropEvent.diagnostic_type || \"\"),",
    "      successErrorCode: String(success.error_code || \"\"),",
    "    };",
    "  }",
    "  if (id === \"home-ai-diagnostic-reporting\") {",
    "    const token = functionReady(api, \"boundedToken\")",
    "      ? api.boundedToken(\" Home AI / Codex Mobile \", \"fallback\", 16)",
    "      : \"\";",
    "    const duration = functionReady(api, \"durationBucket\")",
    "      ? api.durationBucket(4200)",
    "      : \"\";",
    "    const hash = functionReady(api, \"hashIdentifier\")",
    "      ? api.hashIdentifier(\"thread-title\", \"t\")",
    "      : \"\";",
    "    const sanitized = functionReady(api, \"sanitizeInput\")",
    "      ? api.sanitizeInput({ diagnostic_type: \"render_lag\", error_code: \"lag\", counts: { ok_count: 3, raw_body: 4 }, context: { thread_hash: \"abc\", title: \"unsafe\" } })",
    "      : {};",
    "    const reporter = functionReady(api, \"createDiagnosticReporter\")",
    "      ? api.createDiagnosticReporter({ threshold: 2, throttleMs: 0, now: () => 1000 })",
    "      : null;",
    "    const first = reporter && typeof reporter.recordFailure === \"function\"",
    "      ? reporter.recordFailure({ diagnostic_type: \"render_lag\", error_code: \"lag\" })",
    "      : {};",
    "    const second = reporter && typeof reporter.recordFailure === \"function\"",
    "      ? reporter.recordFailure({ diagnostic_type: \"render_lag\", error_code: \"lag\" })",
    "      : {};",
    "    const post = functionReady(api, \"postReportToHomeAi\")",
    "      ? api.postReportToHomeAi({ embedded: false, report: second.report })",
    "      : {};",
    "    const textHash = functionReady(api, \"stableTextHash\")",
    "      ? api.stableTextHash(\"diagnostic\")",
    "      : \"\";",
    "    return {",
    "      ok: token === \"Home_AI_Codex_Mo\"",
    "        && duration === \"3_10s\"",
    "        && /^t_/.test(hash)",
    "        && sanitized.category === \"codex_runtime_failure\"",
    "        && sanitized.counts && sanitized.counts.ok_count === 3",
    "        && !Object.prototype.hasOwnProperty.call(sanitized.counts || {}, \"raw_body\")",
    "        && first.eligible === false",
    "        && second.eligible === true",
    "        && post.reason === \"not_embedded\"",
    "        && textHash.length > 0,",
    "      token,",
    "      duration,",
    "      hashPrefix: String(hash || \"\").slice(0, 2),",
    "      sanitizedCategory: String(sanitized.category || \"\"),",
    "      secondEligible: Boolean(second.eligible),",
    "      postReason: String(post.reason || \"\"),",
    "      textHash,",
    "    };",
    "  }",
    "  if (id === \"thread-diagnostic-events\") {",
    "    const snapshot = functionReady(api, \"conversationProjectionDiagnosticSnapshot\")",
    "      ? api.conversationProjectionDiagnosticSnapshot({ renderedConversationSignature: \"old\", currentSignature: \"new\", domShape: { renderKeyCount: 1, duplicateRenderKeyCount: 1 }, thread: { mobileReadMode: \"thread-read\" } }, { visibleShape: () => ({ visibleTurnCount: 2, visibleItemCount: 3 }) })",
    "      : {};",
    "    const order = functionReady(api, \"turnOrderDiagnosticSnapshot\")",
    "      ? api.turnOrderDiagnosticSnapshot({ expectedTurnIds: [\"a\", \"b\"], domTurnIds: [\"a\"], threadHash: \"thread\" })",
    "      : {};",
    "    const effects = functionReady(api, \"conversationProjectionConsistencyEffects\")",
    "      ? api.conversationProjectionConsistencyEffects({ snapshot, orderSnapshot: order })",
    "      : {};",
    "    const renderEvent = functionReady(api, \"renderSignatureMismatchDiagnosticEvent\")",
    "      ? api.renderSignatureMismatchDiagnosticEvent(snapshot)",
    "      : {};",
    "    const responseEffects = functionReady(api, \"threadDetailResponseDiagnosticEffects\")",
    "      ? api.threadDetailResponseDiagnosticEffects({ contractPlan: { shouldReport: true, reason: \"contract\", turns: 2, items: 3, visibleItems: 3, readMode: \"thread-read\" } })",
    "      : {};",
    "    const normalized = functionReady(api, \"projectionDiagnosticSnapshot\")",
    "      ? api.projectionDiagnosticSnapshot(snapshot)",
    "      : {};",
    "    const count = functionReady(api, \"boundedCount\")",
    "      ? api.boundedCount(100001)",
    "      : 0;",
    "    const token = functionReady(api, \"compactToken\")",
    "      ? api.compactToken(\" Detail / Render \", \"fallback\", 20)",
    "      : \"\";",
    "    return {",
    "      ok: snapshot.renderedSignature === \"old\"",
    "        && normalized.counts && normalized.counts.visible_count === 3",
    "        && order.counts && order.counts.latest_mismatch_count === 1",
    "        && Array.isArray(effects.effects)",
    "        && effects.effects.length === 3",
    "        && renderEvent.diagnostic_type === \"render_signature_mismatch\"",
    "        && Array.isArray(responseEffects.effects)",
    "        && responseEffects.effects[0] && responseEffects.effects[0].type === \"diagnostic-failure\"",
    "        && count === 100000",
    "        && token === \"Detail_Render\",",
    "      renderedSignature: String(snapshot.renderedSignature || \"\"),",
    "      visibleCount: Number(normalized.counts && normalized.counts.visible_count) || 0,",
    "      latestMismatch: Number(order.counts && order.counts.latest_mismatch_count) || 0,",
    "      effectCount: Array.isArray(effects.effects) ? effects.effects.length : 0,",
    "      renderDiagnosticType: String(renderEvent.diagnostic_type || \"\"),",
    "      responseEffectCount: Array.isArray(responseEffects.effects) ? responseEffects.effects.length : 0,",
    "      count,",
    "      token,",
    "    };",
    "  }",
    "  if (id === \"thread-tile-layout\") {",
    "    const layout = functionReady(api, \"layoutForViewport\")",
    "      ? api.layoutForViewport({ enabled: true, viewportWidth: 1500, viewportHeight: 900, sidebarWidth: 0, coarsePointer: true, orientation: \"landscape\", menuOverlay: true })",
    "      : null;",
    "    const ids = functionReady(api, \"selectThreadTileIds\")",
    "      ? api.selectThreadTileIds({ currentThreadId: \"thread-2\", pinnedThreadIds: [\"thread-3\", \"thread-2\"], threadIds: [\"thread-1\", \"thread-3\", \"thread-4\"], maxPanes: 3 })",
    "      : [];",
    "    const pinnedIds = functionReady(api, \"selectPinnedThreadTileIds\")",
    "      ? api.selectPinnedThreadTileIds({ currentThreadId: \"thread-current\", pinnedThreadIds: [\"thread-1\", \"thread-2\", \"thread-3\"], threadIds: [\"thread-current\", \"thread-4\"], maxPanes: 3 })",
    "      : [];",
    "    const pairs = functionReady(api, \"normalizeSplitPairs\")",
    "      ? api.normalizeSplitPairs([{ anchorId: \"b\", childId: \"e\" }, { anchorId: \"b\", childId: \"c\" }], [\"a\", \"b\", \"c\", \"d\", \"e\"])",
    "      : [];",
    "    const groups = functionReady(api, \"threadTileColumnGroups\")",
    "      ? api.threadTileColumnGroups({ ids: [\"a\", \"b\", \"c\", \"d\", \"e\"], columns: 4, splitPairs: [{ anchorId: \"b\", childId: \"e\" }] })",
    "      : [];",
    "    return {",
    "      ok: !!layout && layout.enabled === true && layout.columns === 4",
    "        && ids.join(\",\") === \"thread-2,thread-3,thread-1\"",
    "        && pinnedIds.join(\",\") === \"thread-1,thread-2,thread-current\"",
    "        && pairs.length === 1 && pairs[0].anchorId === \"b\" && pairs[0].childId === \"e\"",
    "        && JSON.stringify(groups) === JSON.stringify([[\"a\"], [\"b\", \"e\"], [\"c\"], [\"d\"]]),",
    "      layout,",
    "      ids,",
    "      pinnedIds,",
    "      pairs,",
    "      groups,",
    "    };",
    "  }",
    "  if (id === \"thread-tile-actions\") {",
    "    const paneA = {",
    "      disabled: false,",
    "      getAttribute(name) { return name === \"data-thread-tile-pane\" ? \"thread-a\" : \"\"; },",
    "      closest() { return null; },",
    "    };",
    "    const paneB = {",
    "      disabled: false,",
    "      getAttribute(name) { return name === \"data-thread-tile-pane\" ? \"thread-b\" : \"\"; },",
    "      closest() { return null; },",
    "    };",
    "    const title = {",
    "      disabled: false,",
    "      getAttribute(name) { return name === \"data-thread-tile-title\" ? \"thread-a\" : \"\"; },",
    "      closest(selector) { return selector === \"[data-thread-tile-pane]\" ? paneA : null; },",
    "    };",
    "    const handle = {",
    "      disabled: false,",
    "      getAttribute(name) { return name === \"data-thread-tile-drag-handle\" ? \"thread-a\" : \"\"; },",
    "      closest(selector) { return selector === \"[data-thread-tile-pane]\" ? paneA : null; },",
    "    };",
    "    const bottom = {",
    "      disabled: false,",
    "      getAttribute(name) { return name === \"data-thread-tile-bottom\" ? \"thread-a\" : \"\"; },",
    "      closest() { return null; },",
    "    };",
    "    const root = { contains(node) { return node === paneA || node === paneB || node === title || node === handle || node === bottom; } };",
    "    const titleTarget = { closest(selector) { return selector === \"[data-thread-tile-title]\" ? title : selector === \"[data-thread-tile-pane]\" ? paneA : null; } };",
    "    const bottomTarget = { closest(selector) { return selector === \"[data-thread-tile-bottom]\" ? bottom : null; } };",
    "    const handleTarget = { closest(selector) { return selector === \"[data-thread-tile-drag-handle]\" ? handle : null; } };",
    "    const paneBTarget = { closest(selector) { return selector === \"[data-thread-tile-pane]\" ? paneB : null; } };",
    "    const pointer = functionReady(api, \"resolveThreadTilePointerAction\")",
    "      ? api.resolveThreadTilePointerAction({ root, target: titleTarget })",
    "      : {};",
    "    const click = functionReady(api, \"resolveThreadTileClickAction\")",
    "      ? api.resolveThreadTileClickAction({ root, target: bottomTarget })",
    "      : {};",
    "    const dragStart = functionReady(api, \"resolveThreadTileDragStartAction\")",
    "      ? api.resolveThreadTileDragStartAction({ root, target: handleTarget })",
    "      : {};",
    "    const drop = functionReady(api, \"resolveThreadTileDropAction\")",
    "      ? api.resolveThreadTileDropAction({ root, target: paneBTarget, draggingId: \"thread-a\" })",
    "      : {};",
    "    return {",
    "      ok: pointer.action === \"select-pane\"",
    "        && pointer.paneId === \"thread-a\"",
    "        && click.action === \"scroll-pane-bottom\"",
    "        && click.preventDefault === true",
    "        && dragStart.action === \"drag-start\"",
    "        && dragStart.paneId === \"thread-a\"",
    "        && drop.action === \"drop-pane\"",
    "        && drop.draggingId === \"thread-a\"",
    "        && drop.targetId === \"thread-b\",",
    "      pointerAction: String(pointer.action || \"\"),",
    "      clickAction: String(click.action || \"\"),",
    "      dragStartAction: String(dragStart.action || \"\"),",
    "      dropAction: String(drop.action || \"\"),",
    "    };",
    "  }",
    "  if (id === \"thread-tile-state\") {",
    "    const candidate = functionReady(api, \"candidatePaneIdsPlan\")",
    "      ? api.candidatePaneIdsPlan({",
    "        defaultIds: [\"thread-a\", \"thread-b\"],",
    "        visibleIds: [\"thread-a\", \"thread-b\"],",
    "        pinnedIds: [\"thread-b\"],",
    "        currentThreadId: \"thread-a\",",
    "        maxPanes: 2,",
    "      })",
    "      : {};",
    "    const paneCount = functionReady(api, \"normalizePaneCount\")",
    "      ? api.normalizePaneCount(\"3\", { maxPanes: 12 })",
    "      : 0;",
    "    const refreshDelay = functionReady(api, \"refreshDelayMs\")",
    "      ? api.refreshDelayMs({ visible: true, active: true })",
    "      : 0;",
    "    const loadSuccess = functionReady(api, \"detailLoadSuccessEffectsPlan\")",
    "      ? api.detailLoadSuccessEffectsPlan({ threadId: \"thread-a\", hasThread: true, nowMs: 1234 })",
    "      : {};",
    "    const selected = functionReady(api, \"effectiveSelectedThreadId\")",
    "      ? api.effectiveSelectedThreadId({ ids: [\"thread-a\", \"thread-b\"], selectedThreadId: \"thread-a\", currentThreadId: \"thread-b\" })",
    "      : \"\";",
    "    return {",
    "      ok: candidate.action === \"candidate-pane-ids\"",
    "        && candidate.ids && candidate.ids.join(\",\") === \"thread-b,thread-a\"",
    "        && paneCount === 3",
    "        && refreshDelay === 500",
    "        && loadSuccess.reason === \"thread-loaded\"",
    "        && loadSuccess.loadedAtMs === 1234",
    "        && selected === \"thread-a\",",
    "      candidateIds: Array.isArray(candidate.ids) ? candidate.ids : [],",
    "      paneCount,",
    "      refreshDelay,",
    "      loadSuccessReason: String(loadSuccess.reason || \"\"),",
    "      selected,",
    "    };",
    "  }",
    "  if (id === \"thread-tile-runtime\") {",
    "    const statePolicy = globalThis.CodexThreadTileState || {};",
    "    const layoutPolicy = globalThis.CodexThreadTileLayout || {};",
    "    const actionsApi = globalThis.CodexThreadTileActions || {};",
    "    const state = {",
    "      threadTileMode: true,",
    "      threadTilePaneCount: \"3\",",
    "      threadTilePinnedThreadIds: [\"thread-b\", \"thread-a\", \"thread-b\"],",
    "      threadTileSplitPairs: [{ anchorId: \"thread-a\", childId: \"thread-c\" }],",
    "      threads: [{ id: \"thread-a\", status: \"running\" }, { id: \"thread-b\", status: \"idle\" }, { id: \"thread-c\", status: \"idle\" }],",
    "      currentThreadId: \"thread-b\",",
    "      threadDisplaySettingsLoaded: true,",
    "      threadTileViewportBaseline: null,",
    "      threadTileComposerHeightBaselinePx: 0,",
    "      composerHeightPx: 0,",
    "    };",
    "    const runtime = functionReady(api, \"createThreadTileRuntime\")",
    "      ? api.createThreadTileRuntime({",
    "        state,",
    "        document: { documentElement: { clientWidth: 1400, clientHeight: 900 }, activeElement: null },",
    "        window: { innerWidth: 1400, innerHeight: 900, visualViewport: { width: 1320, height: 820 }, matchMedia: () => ({ matches: false }) },",
    "        threadTileStatePolicy: statePolicy,",
    "        threadTileLayoutPolicy: layoutPolicy,",
    "        threadTileActionsApi: actionsApi,",
    "        THREAD_TILE_USER_MAX_PANES: 6,",
    "        THREAD_TILE_REFRESH_INTERVAL_MS: 5000,",
    "        THREAD_TILE_REFRESH_MIN_INTERVAL_MS: 500,",
    "        STORAGE_THREAD_DISPLAY_MODE: \"codex.threadDisplayMode\",",
    "        STORAGE_LEGACY_THREAD_TILE_MODE: \"codex.legacyThreadTileMode\",",
    "        $: () => null,",
    "        isKeyboardEditableElement: () => false,",
    "        splitPaneSidebarVisible: () => false,",
    "        isMenuOverlayMode: () => false,",
    "        visibleThreads: (threads) => Array.isArray(threads) ? threads : [],",
    "        isRunningStatus: (status) => status === \"running\" || status === \"in_progress\",",
    "      })",
    "      : {};",
    "    const viewport = runtime && typeof runtime.viewportPixelSize === \"function\"",
    "      ? runtime.viewportPixelSize({ preferLayoutViewport: true })",
    "      : {};",
    "    const paneCount = runtime && typeof runtime.normalizeThreadTilePaneCount === \"function\"",
    "      ? runtime.normalizeThreadTilePaneCount(\"3\", 1)",
    "      : 0;",
    "    const pinnedIds = runtime && typeof runtime.normalizeThreadTilePinnedIds === \"function\"",
    "      ? runtime.normalizeThreadTilePinnedIds([\"thread-b\", \"thread-a\", \"thread-b\"])",
    "      : [];",
    "    const idsEqual = runtime && typeof runtime.threadTileIdsEqual === \"function\"",
    "      ? runtime.threadTileIdsEqual([\"thread-a\", \"thread-b\"], [\"thread-a\", \"thread-b\"])",
    "      : false;",
    "    const payload = runtime && typeof runtime.threadDisplaySettingsPayload === \"function\"",
    "      ? runtime.threadDisplaySettingsPayload()",
    "      : {};",
    "    const layout = runtime && typeof runtime.threadTileLayout === \"function\"",
    "      ? runtime.threadTileLayout({ enabled: true })",
    "      : {};",
    "    const status = runtime && typeof runtime.threadTileLayoutStatusText === \"function\"",
    "      ? runtime.threadTileLayoutStatusText(layout)",
    "      : \"\";",
    "    return {",
    "      ok: runtime && typeof runtime === \"object\"",
    "        && viewport.width === 1400",
    "        && viewport.height === 900",
    "        && paneCount === 3",
    "        && pinnedIds.join(\",\") === \"thread-b,thread-a\"",
    "        && idsEqual === true",
    "        && payload.displayMode === \"tile\"",
    "        && payload.paneCount === 3",
    "        && layout.enabled === true",
    "        && status === \"当前视口：平铺 3/3 窗\",",
    "      factoryType: typeof api.createThreadTileRuntime,",
    "      viewportWidth: Number(viewport.width) || 0,",
    "      viewportHeight: Number(viewport.height) || 0,",
    "      paneCount,",
    "      pinnedIds,",
    "      idsEqual,",
    "      displayMode: String(payload.displayMode || \"\"),",
    "      layoutColumns: Number(layout.columns) || 0,",
    "      status,",
    "    };",
    "  }",
    "  if (id === \"app-update-runtime\") {",
    "    const runtime = functionReady(api, \"createAppUpdateRuntime\")",
    "      ? api.createAppUpdateRuntime({",
    "        CLIENT_BUILD_ID: \"0.1.11|codex-mobile-shell-v625-a5a3d596240d\",",
    "        state: { appVersion: \"0.1.11\", publicReleaseEnabled: true },",
    "        PAGE_SHELL_ASSETS: [\"/app.js\", \"/sw.js\"],",
    "        escapeHtml: (value) => String(value == null ? \"\" : value),",
    "        buildRefreshPolicy: { shouldPromptForServerBuildChange: () => true },",
    "      })",
    "      : null;",
    "    const client = runtime && typeof runtime.clientBuildVersionText === \"function\"",
    "      ? runtime.clientBuildVersionText()",
    "      : \"\";",
    "    const version = runtime && typeof runtime.appVersionText === \"function\"",
    "      ? runtime.appVersionText({ version: \"0.1.11\" })",
    "      : \"\";",
    "    const updateLine = runtime && typeof runtime.updateStatusLine === \"function\"",
    "      ? runtime.updateStatusLine({ updateAvailable: true, canFastForward: true, remoteShort: \"abc123\" })",
    "      : \"\";",
    "    const publicLine = runtime && typeof runtime.publicReleaseStatusLine === \"function\"",
    "      ? runtime.publicReleaseStatusLine({ updateAvailable: true, publicShort: \"def456\" })",
    "      : \"\";",
    "    const serverBuild = runtime && typeof runtime.serverBuildIdFromConfig === \"function\"",
    "      ? runtime.serverBuildIdFromConfig({ clientBuildId: \"client-a\", shellCacheName: \"cache-a\" })",
    "      : \"\";",
    "    return {",
    "      ok: runtime && typeof runtime.refreshPageForNewBuild === \"function\"",
    "        && client === \"客户端 v625\"",
    "        && version === \"v0.1.11 · 客户端 v625\"",
    "        && updateLine === \"Update available: abc123\"",
    "        && publicLine === \"Public latest: def456\"",
    "        && serverBuild === \"client-a\",",
    "      client,",
    "      version,",
    "      updateLine,",
    "      publicLine,",
    "      serverBuild,",
    "      refreshReady: Boolean(runtime && typeof runtime.refreshPageForNewBuild === \"function\"),",
    "    };",
    "  }",
    "  if (id === \"modal-runtime\") {",
    "    const runtime = functionReady(api, \"createModalRuntime\")",
    "      ? api.createModalRuntime()",
    "      : {};",
    "    return {",
    "      ok: runtime && typeof runtime === \"object\"",
    "        && typeof runtime.requestAppNativeDialog === \"function\"",
    "        && typeof runtime.requestAppAlert === \"function\"",
    "        && typeof runtime.requestAppConfirmation === \"function\"",
    "        && typeof runtime.requestAppTextInput === \"function\"",
    "        && typeof runtime.requestCodexProfileSwitchConfirmation === \"function\"",
    "        && typeof globalThis.handleAppNativeDialogKeydown === \"function\"",
    "        && typeof globalThis.closeAppNativeDialog === \"function\"",
    "        && typeof globalThis.performCodexProfileSwitch === \"function\",",
    "      factoryType: typeof api.createModalRuntime,",
    "      nativeDialogType: typeof (runtime && runtime.requestAppNativeDialog),",
    "      alertType: typeof (runtime && runtime.requestAppAlert),",
    "      confirmationType: typeof (runtime && runtime.requestAppConfirmation),",
    "      textInputType: typeof (runtime && runtime.requestAppTextInput),",
    "      profileSwitchType: typeof (runtime && runtime.requestCodexProfileSwitchConfirmation),",
    "      keydownType: typeof globalThis.handleAppNativeDialogKeydown,",
    "      closeType: typeof globalThis.closeAppNativeDialog,",
    "      switchType: typeof globalThis.performCodexProfileSwitch,",
    "    };",
    "  }",
    "  if (id === \"navigation-runtime\") {",
    "    const runtime = functionReady(api, \"createNavigationRuntime\")",
    "      ? api.createNavigationRuntime()",
    "      : {};",
    "    return {",
    "      ok: runtime && typeof runtime === \"object\"",
    "        && typeof runtime.updateConnectionState === \"function\"",
    "        && typeof runtime.restoreConnectionState === \"function\"",
    "        && typeof runtime.markActivity === \"function\"",
    "        && typeof runtime.composerTargetPlan === \"function\"",
    "        && typeof runtime.visibleTurnsForConversation === \"function\"",
    "        && typeof runtime.conversationRenderSignature === \"function\"",
    "        && typeof runtime.updateTurnTimer === \"function\"",
    "        && typeof globalThis.updateConnectionState === \"function\"",
    "        && typeof globalThis.composerTargetPlan === \"function\"",
    "        && typeof globalThis.visibleTurnsForConversation === \"function\",",
    "      factoryType: typeof api.createNavigationRuntime,",
    "      updateType: typeof (runtime && runtime.updateConnectionState),",
    "      restoreType: typeof (runtime && runtime.restoreConnectionState),",
    "      activityType: typeof (runtime && runtime.markActivity),",
    "      composerPlanType: typeof (runtime && runtime.composerTargetPlan),",
    "      visibleTurnsType: typeof (runtime && runtime.visibleTurnsForConversation),",
    "      signatureType: typeof (runtime && runtime.conversationRenderSignature),",
    "      timerType: typeof (runtime && runtime.updateTurnTimer),",
    "      globalUpdateType: typeof globalThis.updateConnectionState,",
    "      globalComposerPlanType: typeof globalThis.composerTargetPlan,",
    "      globalVisibleTurnsType: typeof globalThis.visibleTurnsForConversation,",
    "    };",
    "  }",
    "  if (id === \"runtime-wiring-runtime\") {",
    "    const runtime = functionReady(api, \"createRuntimeWiringRuntime\")",
    "      ? api.createRuntimeWiringRuntime()",
    "      : {};",
    "    return {",
    "      ok: runtime && typeof runtime === \"object\"",
    "        && typeof runtime.initialize === \"function\",",
    "      factoryType: typeof api.createRuntimeWiringRuntime,",
    "      initializeType: typeof (runtime && runtime.initialize),",
    "      globalType: typeof globalThis.CodexRuntimeWiringRuntime,",
    "    };",
    "  }",
    "  if (id === \"app-shell-runtime\") {",
    "    const runtime = functionReady(api, \"createAppShellRuntime\")",
    "      ? api.createAppShellRuntime()",
    "      : {};",
    "    return {",
    "      ok: runtime && typeof runtime === \"object\"",
    "        && typeof runtime.wireUi === \"function\"",
    "        && typeof runtime.start === \"function\"",
    "        && typeof runtime.startCodexMobileAppWithRecovery === \"function\",",
    "      factoryType: typeof api.createAppShellRuntime,",
    "      wireUiType: typeof (runtime && runtime.wireUi),",
    "      startType: typeof (runtime && runtime.start),",
    "      recoveryType: typeof (runtime && runtime.startCodexMobileAppWithRecovery),",
    "      globalType: typeof globalThis.CodexAppShellRuntime,",
    "    };",
    "  }",
    "  if (id === \"pane-layout-runtime\") {",
    "    const runtime = functionReady(api, \"createPaneLayoutRuntime\")",
    "      ? api.createPaneLayoutRuntime()",
    "      : {};",
    "    return {",
    "      ok: runtime && typeof runtime === \"object\"",
    "        && typeof runtime.renderCurrentThread === \"function\"",
    "        && typeof runtime.updateConversationHtml === \"function\"",
    "        && typeof runtime.patchCurrentThreadDetailFromRefresh === \"function\"",
    "        && typeof runtime.syncThreadTileToggle === \"function\"",
    "        && typeof runtime.setThreadTileMode === \"function\"",
    "        && typeof runtime.renderHome === \"function\"",
    "        && typeof runtime.loadThread === \"function\"",
    "        && typeof runtime.loadThreads === \"function\"",
    "        && typeof runtime.enterNewThreadDraft === \"function\"",
    "        && typeof runtime.handleThreadCardClick === \"function\"",
    "        && typeof runtime.showHermesPluginPrimaryPage === \"function\"",
    "        && typeof runtime.returnToThreadListFromDetail === \"function\"",
    "        && typeof globalThis.loadThread === \"function\"",
    "        && typeof globalThis.loadThreads === \"function\"",
    "        && typeof globalThis.renderCurrentThread === \"function\",",
    "      factoryType: typeof api.createPaneLayoutRuntime,",
    "      renderType: typeof (runtime && runtime.renderCurrentThread),",
    "      updateHtmlType: typeof (runtime && runtime.updateConversationHtml),",
    "      patchType: typeof (runtime && runtime.patchCurrentThreadDetailFromRefresh),",
    "      tileToggleType: typeof (runtime && runtime.syncThreadTileToggle),",
    "      tileModeType: typeof (runtime && runtime.setThreadTileMode),",
    "      homeType: typeof (runtime && runtime.renderHome),",
    "      loadThreadType: typeof (runtime && runtime.loadThread),",
    "      loadThreadsType: typeof (runtime && runtime.loadThreads),",
    "      newThreadType: typeof (runtime && runtime.enterNewThreadDraft),",
    "      cardClickType: typeof (runtime && runtime.handleThreadCardClick),",
    "      pluginPrimaryType: typeof (runtime && runtime.showHermesPluginPrimaryPage),",
    "      returnType: typeof (runtime && runtime.returnToThreadListFromDetail),",
    "      globalLoadThreadType: typeof globalThis.loadThread,",
    "      globalLoadThreadsType: typeof globalThis.loadThreads,",
    "      globalRenderType: typeof globalThis.renderCurrentThread,",
    "    };",
    "  }",
    "  if (id === \"thread-list-runtime\") {",
    "    const runtime = functionReady(api, \"createThreadListRuntime\")",
    "      ? api.createThreadListRuntime({})",
    "      : {};",
    "    return {",
    "      ok: runtime && typeof runtime === \"object\"",
    "        && typeof runtime.renderThreads === \"function\"",
    "        && typeof runtime.loadThreads === \"function\",",
    "      factoryType: typeof api.createThreadListRuntime,",
    "      renderThreadsType: typeof (runtime && runtime.renderThreads),",
    "      loadThreadsType: typeof (runtime && runtime.loadThreads),",
    "    };",
  "  }",
    "  if (id === \"side-chat-runtime\") {",
    "    const state = {",
    "      currentThreadId: \"thread-a\",",
    "      currentThread: { id: \"thread-a\" },",
    "      threadSideChats: new Map(),",
    "      nowMs: Date.parse(\"2026-07-02T00:00:00Z\"),",
    "    };",
    "    const runtime = functionReady(api, \"createSideChatRuntime\")",
    "      ? api.createSideChatRuntime({",
    "        state,",
    "        api: async () => ({ sideChat: null }),",
    "        escapeHtml: (value) => String(value == null ? \"\" : value)",
    "          .replace(/&/g, \"&amp;\")",
    "          .replace(/</g, \"&lt;\")",
    "          .replace(/>/g, \"&gt;\")",
    "          .replace(/\"/g, \"&quot;\"),",
    "        statusText: (status) => String(status || \"\"),",
    "        formatTime: () => \"now\",",
    "        truncateMiddle: (value) => String(value || \"\"),",
    "      })",
    "      : {};",
    "    const normalized = runtime && typeof runtime.normalizeSideChatState === \"function\"",
    "      ? runtime.normalizeSideChatState({",
    "        messages: [{ role: \"assistant\", text: \"hi\" }],",
    "        sidecar: { status: \"pending\" },",
    "      }, \"thread-a\")",
    "      : {};",
    "    if (runtime && typeof runtime.setSideChatState === \"function\") {",
    "      runtime.setSideChatState(\"thread-a\", normalized);",
    "    }",
    "    const path = runtime && typeof runtime.sideChatApiPath === \"function\"",
    "      ? runtime.sideChatApiPath(\"thread-a\", \"/draft\")",
    "      : \"\";",
    "    const status = runtime && typeof runtime.sideChatStatusLabel === \"function\"",
    "      ? runtime.sideChatStatusLabel(\"queued\")",
    "      : \"\";",
    "    const queue = runtime && typeof runtime.sideChatQueueSummary === \"function\"",
    "      ? runtime.sideChatQueueSummary({ status: \"queued\", mode: \"autoSendWhenIdle\" })",
    "      : \"\";",
    "    const pending = runtime && typeof runtime.sideChatReplyPending === \"function\"",
    "      ? runtime.sideChatReplyPending(\"thread-a\")",
    "      : false;",
    "    const subagentKind = runtime && typeof runtime.subagentStatusKind === \"function\"",
    "      ? runtime.subagentStatusKind(\"running\")",
    "      : \"\";",
    "    const subagentLabel = runtime && typeof runtime.subagentStatusLabel === \"function\"",
    "      ? runtime.subagentStatusLabel(\"running\")",
    "      : \"\";",
    "    const panel = runtime && typeof runtime.renderSideChatPanel === \"function\"",
    "      ? runtime.renderSideChatPanel()",
    "      : \"\";",
    "    return {",
    "      ok: runtime && typeof runtime === \"object\"",
    "        && normalized.threadId === \"thread-a\"",
    "        && Array.isArray(normalized.messages)",
    "        && normalized.messages.length === 1",
    "        && path === \"/api/threads/thread-a/side-chat/draft\"",
    "        && status === \"已排队\"",
    "        && queue === \"已排队 · 完成后自动发送\"",
    "        && pending === true",
    "        && subagentKind === \"running\"",
    "        && subagentLabel === \"运行中\"",
    "        && String(panel || \"\").includes(\"side-chat-section\"),",
    "      factoryType: typeof api.createSideChatRuntime,",
    "      normalizedThreadId: String(normalized.threadId || \"\"),",
    "      messageCount: Array.isArray(normalized.messages) ? normalized.messages.length : 0,",
    "      path,",
    "      status,",
    "      queue,",
    "      pending,",
    "      subagentKind,",
    "      subagentLabel,",
    "      panelReady: String(panel || \"\").includes(\"side-chat-section\"),",
    "    };",
    "  }",
    "  if (id === \"media-preview-runtime\") {",
    "    const element = {",
    "      classList: { contains: () => false, add: () => {}, remove: () => {}, toggle: () => {} },",
    "      dataset: {},",
    "      style: { setProperty: () => {}, removeProperty: () => {} },",
    "      querySelector: () => null,",
    "      querySelectorAll: () => [],",
    "      closest: () => null,",
    "      addEventListener: () => {},",
    "      removeEventListener: () => {},",
    "      appendChild: () => {},",
    "      setAttribute: () => {},",
    "      getAttribute: () => \"\",",
    "      removeAttribute: () => {},",
    "      textContent: \"\",",
    "      innerText: id === \"messageInput\" ? \"hello\" : \"\",",
    "      innerHTML: \"\",",
    "    };",
    "    const document = {",
    "      documentElement: { getAttribute: () => \"light\", setAttribute: () => {} },",
    "      head: element,",
    "      createElement: () => Object.assign({}, element),",
    "      getElementById: () => Object.assign({}, element),",
    "      querySelector: () => null,",
    "      querySelectorAll: () => [],",
    "    };",
    "    const markdownRenderer = {",
    "      renderMarkdown: (value) => `<p>${String(value == null ? \"\" : value)}</p>`,",
    "      normalizeMermaidSourceForRender: (value) => String(value || \"\"),",
    "    };",
    "    const runtime = functionReady(api, \"createMediaPreviewRuntime\")",
    "      ? api.createMediaPreviewRuntime({",
    "        state: { key: \"sample-key\", currentThreadId: \"thread-a\", currentThread: { id: \"thread-a\" } },",
    "        document,",
    "        window: {",
    "          location: { origin: \"http://127.0.0.1:8787\", pathname: \"/\" },",
    "          CodexMarkdownRenderer: markdownRenderer,",
    "          matchMedia: () => ({ matches: true }),",
    "          setTimeout: (callback) => {",
    "            if (typeof callback === \"function\") callback();",
    "            return 1;",
    "          },",
    "          clearTimeout: () => {},",
    "        },",
    "        $: () => Object.assign({}, element),",
    "        api: async () => ({}),",
    "        escapeHtml: (value) => String(value == null ? \"\" : value)",
    "          .replace(/&/g, \"&amp;\")",
    "          .replace(/</g, \"&lt;\")",
    "          .replace(/>/g, \"&gt;\")",
    "          .replace(/\"/g, \"&quot;\"),",
    "        normalizeFsPath: (value) => String(value || \"\"),",
    "        shortPath: (value) => String(value || \"\").split(\"/\").pop() || \"\",",
    "        compactStructuredForSignature: (value) => JSON.stringify(value),",
    "        visibleThreadTaskCardCommandText: (value) => String(value || \"\"),",
    "        rememberCopyText: (value) => String(value || \"\"),",
    "        copyButtonHtml: () => \"<button></button>\",",
    "        stableTextHash: (value) => `hash:${String(value || \"\").length}`,",
    "        renderContextThreadId: () => \"thread-a\",",
    "        publishPluginNavigationState: () => {},",
    "        postPerformanceEvent: () => {},",
    "        roundedDurationMs: () => 1,",
    "        nowPerfMs: () => 1,",
    "        isHermesEmbedMode: () => false,",
    "        isIosWebKitBrowser: () => false,",
    "        requestHermesPluginRefresh: () => {},",
    "        primaryTouch: (event) => event && event.touches && event.touches[0] || null,",
    "      })",
    "      : {};",
    "    const githubUrl = runtime && typeof runtime.normalizeGithubPreviewUrl === \"function\"",
    "      ? runtime.normalizeGithubPreviewUrl(\"https://github.com/openai/codex/pull/7\")",
    "      : \"\";",
    "    const jsonPreview = runtime && typeof runtime.renderFilePreviewContent === \"function\"",
    "      ? runtime.renderFilePreviewContent({ kind: \"json\", content: \"{\\\"ok\\\":true}\" })",
    "      : \"\";",
    "    return {",
    "      ok: runtime && typeof runtime === \"object\"",
    "        && githubUrl === \"https://github.com/openai/codex/pull/7\"",
    "        && String(jsonPreview || \"\").includes(\"file-preview-text\")",
    "        && typeof runtime.renderMarkdownWithAttachmentSummary === \"function\"",
    "        && typeof runtime.openImagePreviewFromImage === \"function\"",
    "        && typeof runtime.renderImageView === \"function\"",
    "        && typeof runtime.scheduleVisibleImageFailureScan === \"function\",",
    "      factoryType: typeof api.createMediaPreviewRuntime,",
    "      githubUrl,",
    "      jsonPreviewReady: String(jsonPreview || \"\").includes(\"file-preview-text\"),",
    "      markdownType: typeof (runtime && runtime.renderMarkdownWithAttachmentSummary),",
    "      imagePreviewType: typeof (runtime && runtime.openImagePreviewFromImage),",
    "      imageViewType: typeof (runtime && runtime.renderImageView),",
    "      scanType: typeof (runtime && runtime.scheduleVisibleImageFailureScan),",
    "    };",
    "  }",
    "  if (id === \"composer-runtime\") {",
    "    const elements = new Map();",
    "    const element = (id = \"\") => ({",
    "      id,",
    "      value: id === \"messageInput\" ? \"hello\" : \"\",",
    "      files: [],",
    "      classList: { contains: () => false, add: () => {}, remove: () => {}, toggle: () => {} },",
    "      dataset: {},",
    "      style: { setProperty: () => {}, removeProperty: () => {} },",
    "      getBoundingClientRect: () => ({ width: 120, height: 32, left: 0, top: 0, right: 120, bottom: 32 }),",
    "      focus: () => {},",
    "      blur: () => {},",
    "      select: () => {},",
    "      setSelectionRange: () => {},",
    "      querySelector: () => null,",
    "      querySelectorAll: () => [],",
    "      closest: () => null,",
    "      addEventListener: () => {},",
    "      removeEventListener: () => {},",
    "      appendChild: () => {},",
    "      setAttribute: () => {},",
    "      getAttribute: () => \"\",",
    "      removeAttribute: () => {},",
    "      textContent: \"\",",
    "      innerHTML: \"\",",
    "    });",
    "    function getElement(id) {",
    "      if (!elements.has(id)) elements.set(id, element(id));",
    "      return elements.get(id);",
    "    }",
    "    const state = {",
    "      threads: [],",
    "      pendingAttachments: [],",
    "      composerRuntimeSelection: {},",
    "      codexProfiles: [],",
    "      currentThreadId: \"thread-a\",",
    "      currentThread: { id: \"thread-a\" },",
    "      newThreadDraft: false,",
    "    };",
    "    const runtime = functionReady(api, \"createComposerRuntime\")",
    "      ? api.createComposerRuntime({",
    "        state,",
    "        document: {",
    "          documentElement: { style: { setProperty: () => {}, removeProperty: () => {} } },",
    "          activeElement: null,",
    "          addEventListener: () => {},",
    "          removeEventListener: () => {},",
    "          createElement: () => element(),",
    "          getElementById: getElement,",
    "          querySelector: () => null,",
    "          querySelectorAll: () => [],",
    "        },",
    "        window: {",
    "          setTimeout: (callback) => { if (typeof callback === \"function\") callback(); return 1; },",
    "          clearTimeout: () => {},",
    "          requestAnimationFrame: (callback) => { if (typeof callback === \"function\") callback(); return 1; },",
    "          crypto: { randomUUID: () => \"sample-uuid\" },",
    "          visualViewport: { width: 390, height: 700 },",
    "          innerWidth: 390,",
    "          innerHeight: 700,",
    "        },",
    "        $: getElement,",
    "        api: async () => ({}),",
    "        escapeHtml: (value) => String(value == null ? \"\" : value)",
    "          .replace(/&/g, \"&amp;\")",
    "          .replace(/</g, \"&lt;\")",
    "          .replace(/>/g, \"&gt;\")",
    "          .replace(/\"/g, \"&quot;\"),",
    "        viewportMetrics: {",
    "          cssPixel: (value) => Math.round(Number(value) || 0),",
    "          stablePixelChanged: (left, right) => Math.abs((Number(left) || 0) - (Number(right) || 0)) >= 2,",
    "        },",
    "        normalizeOptionList: (values) => Array.isArray(values) ? values.filter(Boolean).map((value) => String(value).trim()) : [],",
    "        labelForModel: (value) => `Model ${String(value || \"\")}`.trim(),",
    "        labelForEffort: (value) => `Effort ${String(value || \"\")}`.trim(),",
    "        labelForPermissionMode: (value) => `Permission ${String(value || \"\")}`.trim(),",
    "        defaultNewThreadModel: () => \"gpt-5.5\",",
    "        defaultNewThreadEffort: () => \"medium\",",
    "        defaultNewThreadPermissionMode: () => \"auto\",",
    "        effectiveComposerPermissionMode: (value) => String(value || \"\").trim() || \"auto\",",
    "        newThreadSelectedModel: () => \"\",",
    "        newThreadSelectedEffort: () => \"\",",
    "        newThreadSelectedPermissionMode: () => \"\",",
    "        currentComposerThreadId: () => \"thread-a\",",
    "        composerTargetThread: () => ({ id: \"thread-a\", model: \"gpt-5.5\", effort: \"medium\", runtimeSettings: { permissionMode: \"auto\" } }),",
    "        selectedQuotaModel: () => \"gpt-5.5\",",
    "        threadDisplayName: () => \"Thread A\",",
    "        isThreadTileComposerContext: () => false,",
    "        isAndroidBrowser: () => false,",
    "        isHermesEmbedMode: () => false,",
    "        isKeyboardEditableElement: () => false,",
    "        threadTileStatePolicy: { composerTargetPlaceholderPlan: () => ({ text: \"Send to Thread A\" }) },",
    "        imageCompressor: {},",
    "        homeAiDiagnosticReportingApi: {},",
    "      })",
    "      : {};",
    "    const model = runtime && typeof runtime.effectiveDefaultModel === \"function\"",
    "      ? runtime.effectiveDefaultModel()",
    "      : \"\";",
    "    const effort = runtime && typeof runtime.effectiveDefaultEffort === \"function\"",
    "      ? runtime.effectiveDefaultEffort()",
    "      : \"\";",
    "    const permission = runtime && typeof runtime.effectiveDefaultPermissionMode === \"function\"",
    "      ? runtime.effectiveDefaultPermissionMode()",
    "      : \"\";",
    "    const label = runtime && typeof runtime.runtimeOptionLabel === \"function\"",
    "      ? runtime.runtimeOptionLabel(\"model\", \"gpt-5.5\")",
    "      : \"\";",
    "    const placeholder = runtime && typeof runtime.composerPlaceholderText === \"function\"",
    "      ? runtime.composerPlaceholderText()",
    "      : \"\";",
    "    return {",
    "      ok: runtime && typeof runtime === \"object\"",
    "        && model === \"gpt-5.5\"",
    "        && effort === \"medium\"",
    "        && permission === \"auto\"",
    "        && label === \"Model gpt-5.5\"",
    "        && placeholder === \"Send to Thread A\"",
    "        && typeof runtime.sendMessage === \"function\"",
    "        && typeof runtime.sendNewThreadMessage === \"function\"",
    "        && typeof runtime.interruptActiveTurn === \"function\",",
    "      factoryType: typeof api.createComposerRuntime,",
    "      model,",
    "      effort,",
    "      permission,",
    "      label,",
    "      placeholder,",
    "      sendType: typeof (runtime && runtime.sendMessage),",
    "      newThreadType: typeof (runtime && runtime.sendNewThreadMessage),",
    "      interruptType: typeof (runtime && runtime.interruptActiveTurn),",
    "    };",
    "  }",
    "  if (id === \"composer-bridge-runtime\") {",
    "    const runtime = functionReady(api, \"createComposerBridgeRuntime\")",
    "      ? api.createComposerBridgeRuntime()",
    "      : {};",
    "    return {",
    "      ok: runtime && typeof runtime === \"object\"",
    "        && typeof runtime.sendMessage === \"function\"",
    "        && typeof runtime.sendNewThreadMessage === \"function\"",
    "        && typeof runtime.answerServerRequest === \"function\"",
    "        && typeof runtime.answerApproval === \"function\"",
    "        && typeof runtime.declineServerRequest === \"function\"",
    "        && typeof runtime.mutateThreadTaskCard === \"function\"",
    "        && typeof runtime.replyTaskCard === \"function\"",
    "        && typeof runtime.queueThreadTaskCardDraftCreation === \"function\"",
    "        && typeof runtime.createThreadTaskCardDraft === \"function\"",
    "        && typeof globalThis.sendMessage === \"function\"",
    "        && typeof globalThis.answerApproval === \"function\"",
    "        && typeof globalThis.mutateThreadTaskCard === \"function\"",
    "        && typeof globalThis.queueThreadTaskCardDraftCreation === \"function\",",
    "      factoryType: typeof api.createComposerBridgeRuntime,",
    "      sendType: typeof (runtime && runtime.sendMessage),",
    "      answerType: typeof (runtime && runtime.answerServerRequest),",
    "      approvalType: typeof (runtime && runtime.answerApproval),",
    "      mutateType: typeof (runtime && runtime.mutateThreadTaskCard),",
    "      replyType: typeof (runtime && runtime.replyTaskCard),",
    "      draftType: typeof (runtime && runtime.createThreadTaskCardDraft),",
    "      globalSendType: typeof globalThis.sendMessage,",
    "      globalApprovalType: typeof globalThis.answerApproval,",
    "      globalMutateType: typeof globalThis.mutateThreadTaskCard,",
    "      globalDraftQueueType: typeof globalThis.queueThreadTaskCardDraftCreation,",
    "    };",
    "  }",
    "  if (id === \"api-client-runtime\") {",
    "    const runtime = functionReady(api, \"createApiClientRuntime\")",
    "      ? api.createApiClientRuntime()",
    "      : {};",
    "    return {",
    "      ok: runtime && typeof runtime === \"object\"",
    "        && typeof runtime.api === \"function\"",
    "        && typeof runtime.postClientEvent === \"function\"",
    "        && typeof runtime.postPerformanceEvent === \"function\"",
    "        && typeof runtime.recordHomeAiDiagnosticFailure === \"function\"",
    "        && typeof runtime.recordHomeAiDiagnosticSuccess === \"function\"",
    "        && typeof runtime.scheduleSubmittedMessageDomProbe === \"function\"",
    "        && typeof runtime.checkConversationProjectionConsistency === \"function\"",
    "        && typeof runtime.handlePushButtonClick === \"function\"",
    "        && typeof globalThis.api === \"function\"",
    "        && typeof globalThis.postClientEvent === \"function\"",
    "        && typeof globalThis.diagnosticThreadHash === \"function\"",
    "        && typeof globalThis.recordHomeAiDiagnosticFailure === \"function\"",
    "        && typeof globalThis.scheduleSubmittedMessageDomProbe === \"function\"",
    "        && typeof globalThis.checkConversationProjectionConsistency === \"function\"",
    "        && typeof globalThis.handlePushButtonClick === \"function\",",
    "      factoryType: typeof api.createApiClientRuntime,",
    "      apiType: typeof (runtime && runtime.api),",
    "      clientEventType: typeof (runtime && runtime.postClientEvent),",
    "      performanceType: typeof (runtime && runtime.postPerformanceEvent),",
    "      diagnosticFailureType: typeof (runtime && runtime.recordHomeAiDiagnosticFailure),",
    "      diagnosticSuccessType: typeof (runtime && runtime.recordHomeAiDiagnosticSuccess),",
    "      submittedProbeType: typeof (runtime && runtime.scheduleSubmittedMessageDomProbe),",
    "      projectionCheckType: typeof (runtime && runtime.checkConversationProjectionConsistency),",
    "      pushType: typeof (runtime && runtime.handlePushButtonClick),",
    "      globalApiType: typeof globalThis.api,",
    "      globalClientEventType: typeof globalThis.postClientEvent,",
    "      globalThreadHashType: typeof globalThis.diagnosticThreadHash,",
    "      globalSubmittedProbeType: typeof globalThis.scheduleSubmittedMessageDomProbe,",
    "      globalProjectionCheckType: typeof globalThis.checkConversationProjectionConsistency,",
    "      globalPushType: typeof globalThis.handlePushButtonClick,",
    "    };",
    "  }",
    "  if (id === \"thread-list-load-policy\") {",
    "    const plan = functionReady(api, \"planThreadListLoadRequest\")",
    "      ? api.planThreadListLoadRequest({ silent: true, threadDetailOpening: true, deferFallback: true })",
    "      : {};",
    "    return {",
    "      ok: plan && plan.action === \"thread-list-load-request\"",
    "        && plan.shouldLoad === false",
    "        && plan.skipReason === \"detail-in-flight\"",
    "        && plan.retryDelayMs === 700,",
    "      action: String(plan && plan.action || \"\"),",
    "      shouldLoad: Boolean(plan && plan.shouldLoad),",
    "      skipReason: String(plan && plan.skipReason || \"\"),",
    "      retryDelayMs: Number(plan && plan.retryDelayMs) || 0,",
    "    };",
    "  }",
    "  if (id === \"thread-list-stable-order\") {",
    "    const scopeKey = functionReady(api, \"threadListOrderScopeKey\")",
    "      ? api.threadListOrderScopeKey({ selectedCwd: \"/tmp/project\", search: \"Home\" })",
    "      : \"\";",
    "    const plan = functionReady(api, \"planThreadListStableOrder\")",
    "      ? api.planThreadListStableOrder({",
    "        threads: [{ id: \"b\" }, { id: \"a\" }, { id: \"c\" }],",
    "        previousState: { scopeKey, holdUntilMs: 2000, order: [\"a\", \"b\"] },",
    "        scopeKey,",
    "        nowMs: 1000,",
    "        holdMs: 5000,",
    "      })",
    "      : {};",
    "    const order = Array.isArray(plan.order) ? plan.order : [];",
    "    return {",
    "      ok: scopeKey === JSON.stringify({ cwd: \"/tmp/project\", search: \"home\" })",
    "        && plan.held === true",
    "        && order.join(\",\") === \"a,b,c\",",
    "      scopeKey,",
    "      held: Boolean(plan.held),",
    "      order,",
    "    };",
    "  }",
    "  if (id === \"thread-status-hints\") {",
    "    const running = functionReady(api, \"isRunningStatus\")",
    "      ? api.isRunningStatus(\"in_progress\")",
    "      : false;",
    "    const unread = functionReady(api, \"shouldMarkThreadUnread\")",
    "      ? api.shouldMarkThreadUnread({",
    "        threadId: \"target-thread\",",
    "        currentThreadId: \"other-thread\",",
    "        status: \"completed\",",
    "        thread: { turns: [{ status: \"completed\", completedAtMs: 2000 }] },",
    "        viewedAtMs: 1000,",
    "      })",
    "      : false;",
    "    const expire = functionReady(api, \"shouldExpireRunningThreadHint\")",
    "      ? api.shouldExpireRunningThreadHint({",
    "        threadId: \"target-thread\",",
    "        isRunningHinted: true,",
    "        status: \"idle\",",
    "        runningHintedAtMs: 0,",
    "        runningHintStaleMs: 1000,",
    "        nowMs: 5000,",
    "        thread: {},",
    "      })",
    "      : false;",
    "    return {",
    "      ok: running === true && unread === true && expire === true,",
    "      running,",
    "      unread,",
    "      expire,",
    "    };",
    "  }",
    "  if (id === \"thread-detail-patch-plan\") {",
    "    const surface = functionReady(api, \"planThreadDetailDomPatchSurface\")",
    "      ? api.planThreadDetailDomPatchSurface({ threadId: \"thread-a\", conversationPresent: true })",
    "      : {};",
    "    const visiblePatch = functionReady(api, \"planVisibleItemRefreshPatch\")",
    "      ? api.planVisibleItemRefreshPatch([{ key: \"a\", signature: \"1\" }], [{ key: \"a\", signature: \"1\" }, { key: \"b\", signature: \"2\" }])",
    "      : {};",
    "    const turnPatch = functionReady(api, \"planThreadDetailRefreshDomPatch\")",
    "      ? api.planThreadDetailRefreshDomPatch([{ key: \"turn-a\", hasPreviousTurn: true, itemPatchable: true, articlePresent: true }])",
    "      : {};",
    "    const visibleOperations = Array.isArray(visiblePatch.operations) ? visiblePatch.operations : [];",
    "    const turnOperations = Array.isArray(turnPatch.operations) ? turnPatch.operations : [];",
    "    return {",
    "      ok: surface.canPatch === true",
    "        && surface.reason === \"single-thread-surface\"",
    "        && visiblePatch.canPatch === true",
    "        && visibleOperations.map((entry) => entry.type).join(\",\") === \"reuse,insert\"",
    "        && turnPatch.canPatch === true",
    "        && turnOperations.length === 1",
    "        && turnOperations[0].type === \"item-patch\",",
    "      surfaceReason: String(surface.reason || \"\"),",
    "      visibleOperationCount: visibleOperations.length,",
    "      turnOperationType: String(turnOperations[0] && turnOperations[0].type || \"\"),",
    "    };",
    "  }",
    "  if (id === \"thread-detail-actions\") {",
    "    const node = (dataset) => ({",
    "      dataset,",
    "      closest(selector) {",
    "        if (selector === \"[data-thread-tile-pane]\") return { dataset: { threadTilePane: \"thread-pane\" } };",
    "        return null;",
    "      },",
    "    });",
    "    const copyNode = node({ copyKey: \"copy-1\" });",
    "    const approvalNode = node({ approvalId: \"ap-1\", approvalThreadId: \"thread-ap\", approvalAction: \"allow_once\" });",
    "    const responseNode = node({ serverRequestId: \"req-1\", serverRequestThreadId: \"thread-req\", serverResponseText: \"yes\", serverQuestionId: \"answer\" });",
    "    const rich = functionReady(api, \"resolveRichContentClickAction\")",
    "      ? api.resolveRichContentClickAction({ target: { closest(selector) { return selector === \"[data-copy-key]\" ? copyNode : null; } } })",
    "      : {};",
    "    const approval = functionReady(api, \"resolveThreadDetailClickAction\")",
    "      ? api.resolveThreadDetailClickAction({ target: { closest(selector) { return selector === \"[data-approval-action]\" ? approvalNode : null; } } })",
    "      : {};",
    "    const response = functionReady(api, \"resolveThreadDetailClickAction\")",
    "      ? api.resolveThreadDetailClickAction({ target: { closest(selector) { return selector === \"[data-server-response-text]\" ? responseNode : null; } } })",
    "      : {};",
    "    const contextThreadId = functionReady(api, \"contextThreadIdFromNode\")",
    "      ? api.contextThreadIdFromNode(copyNode)",
    "      : \"\";",
    "    return {",
    "      ok: rich.action === \"copy\"",
    "        && rich.preventDefault === true",
    "        && rich.stopPropagation === true",
    "        && approval.action === \"approval-answer\"",
    "        && approval.approvalAction === \"allow_once\"",
    "        && approval.threadId === \"thread-ap\"",
    "        && response.action === \"server-response\"",
    "        && response.responseText === \"yes\"",
    "        && contextThreadId === \"thread-pane\",",
    "      richAction: String(rich.action || \"\"),",
    "      approvalAction: String(approval.action || \"\"),",
    "      approvalValue: String(approval.approvalAction || \"\"),",
    "      responseAction: String(response.action || \"\"),",
    "      contextThreadId,",
    "    };",
    "  }",
    "  if (id === \"thread-detail-merge-state\") {",
    "    const policy = functionReady(api, \"createThreadDetailMergePolicy\")",
    "      ? api.createThreadDetailMergePolicy({",
    "        sortTurnsForDisplay: (turns) => Array.isArray(turns)",
    "          ? turns.slice().sort((left, right) => String(left && left.id || \"\").localeCompare(String(right && right.id || \"\")))",
    "          : [],",
    "        turnVisibleWeight: (turn) => JSON.stringify(turn && turn.items || []).length,",
    "        mergeItemsPreservingLocalVisible: (existingItems, incomingItems, preserveLocalVisible) => (",
    "          preserveLocalVisible ? existingItems : incomingItems",
    "        ),",
    "      })",
    "      : {};",
    "    const merged = policy && typeof policy.mergeThreadPreservingVisibleItems === \"function\"",
    "      ? policy.mergeThreadPreservingVisibleItems(",
    "        {",
    "          id: \"thread-a\",",
    "          turns: [",
    "            { id: \"b\", items: [{ type: \"assistantMessage\", text: \"full receipt\" }] },",
    "          ],",
    "        },",
    "        {",
    "          id: \"thread-a\",",
    "          turns: [",
    "            { id: \"b\", items: [] },",
    "            { id: \"a\", items: [{ type: \"userMessage\", text: \"hello\" }] },",
    "          ],",
    "        }",
    "      )",
    "      : {};",
    "    const turns = Array.isArray(merged && merged.turns) ? merged.turns : [];",
    "    const preserved = turns.find((turn) => turn && turn.id === \"b\");",
    "    return {",
    "      ok: turns.map((turn) => String(turn && turn.id || \"\")).join(\",\") === \"a,b\"",
    "        && Array.isArray(preserved && preserved.items)",
    "        && preserved.items.length === 1",
    "        && preserved.items[0].text === \"full receipt\",",
    "      turnOrder: turns.map((turn) => String(turn && turn.id || \"\")),",
    "      preservedItemCount: Array.isArray(preserved && preserved.items) ? preserved.items.length : 0,",
    "    };",
    "  }",
    "  if (id === \"thread-detail-v4-merge-state\") {",
    "    const policy = functionReady(api, \"createThreadDetailV4MergePolicy\")",
    "      ? api.createThreadDetailV4MergePolicy({",
    "        normalizeThreadVisibleUserMessages: (thread) => thread,",
    "        turnVisibleWeight: (turn) => Array.isArray(turn && turn.items) ? turn.items.length : 0,",
    "        isOptimisticUserMessage: (item) => Boolean(item && item.mobilePendingSubmission),",
    "        isRecentlySubmittedUserMessage: (item) => Boolean(item && item.mobilePendingSubmission),",
    "        isReasoningItem: (item) => String(item && item.type || \"\") === \"reasoning\",",
    "        userMessagesCanShadow: () => false,",
    "        isTurnComplete: (turn) => /completed|failed|cancel|interrupted/i.test(String(turn && (turn.status && turn.status.type || turn.status) || \"\")),",
    "        isRunningStatus: (status) => /running|active|inprogress|in_progress/i.test(String(status && status.type || status || \"\")),",
    "        isIncompleteInterruptedTurn: () => false,",
    "        turnHasActiveLiveItems: () => false,",
    "        turnOrderMs: (turn) => Number(turn && turn.startedAtMs) || 0,",
    "        sortTurnsForDisplay: (turns) => Array.isArray(turns)",
    "          ? turns.slice().sort((left, right) => (Number(left && left.startedAtMs) || 0) - (Number(right && right.startedAtMs) || 0))",
    "          : [],",
    "        maxVisibleTurnsForThread: () => 5,",
    "      })",
    "      : {};",
    "    const merged = policy && typeof policy.mergeV4ProjectionThread === \"function\"",
    "      ? policy.mergeV4ProjectionThread(",
    "        {",
    "          id: \"thread-a\",",
    "          mobileProjectionRevision: 3,",
    "          turns: [",
    "            { id: \"active\", startedAtMs: 100, status: \"running\", items: [{ type: \"agentMessage\", text: \"streaming\" }] },",
    "          ],",
    "        },",
    "        {",
    "          id: \"thread-a\",",
    "          mobileProjectionRevision: 2,",
    "          turns: [",
    "            { id: \"new\", startedAtMs: 50, status: \"completed\", items: [{ type: \"userMessage\", text: \"prompt\" }] },",
    "          ],",
    "        }",
    "      )",
    "      : {};",
    "    const turns = Array.isArray(merged && merged.turns) ? merged.turns : [];",
    "    return {",
    "      ok: typeof policy.mergeV4ProjectionThread === \"function\"",
    "        && typeof policy.v4ProjectionRevisionValue === \"function\"",
    "        && policy.v4ProjectionRevisionValue(merged) === 3",
    "        && turns.map((turn) => String(turn && turn.id || \"\")).join(\",\") === \"new,active\",",
    "      revision: policy && typeof policy.v4ProjectionRevisionValue === \"function\"",
    "        ? policy.v4ProjectionRevisionValue(merged)",
    "        : 0,",
    "      turnOrder: turns.map((turn) => String(turn && turn.id || \"\")),",
    "    };",
    "  }",
    "  if (id === \"thread-detail-runtime\") {",
    "    const statePolicy = {",
    "      completedIncomingTurnHasAuthoritativeReceipt: () => false,",
    "      shouldDropLocalOnlyReceiptForIncomingTurn: () => false,",
    "      shouldPreserveLocalOnlyItem: () => false,",
    "      shouldPreserveExistingTurnVisibleItems: () => false,",
    "    };",
    "    const runtime = functionReady(api, \"createThreadDetailRuntime\")",
    "      ? api.createThreadDetailRuntime({",
    "        threadDetailStateApi: {",
    "          createThreadDetailStatePolicy: () => statePolicy,",
    "          threadListSummaryFromDetailThread: () => ({}),",
    "          planThreadOpenCacheReuse: () => ({ action: \"skip\" }),",
    "          threadHasReusableLoadedDetailState: () => false,",
    "        },",
    "        threadDetailMergeStateApi: {",
    "          createThreadDetailMergePolicy: () => ({",
    "            mergeThreadPreservingVisibleItems: (existingThread, incomingThread) => incomingThread || existingThread,",
    "          }),",
    "        },",
    "        threadDetailV4MergeStateApi: {",
    "          createThreadDetailV4MergePolicy: () => ({",
    "            isV4ProjectionThread: () => false,",
    "            mergeV4ProjectionThread: (existingThread, incomingThread) => incomingThread || existingThread,",
    "          }),",
    "        },",
    "        statusText: (status) => String(status && status.type || status || \"\"),",
    "        isLiveTurn: (turn) => /active|running/i.test(String(turn && (turn.status && turn.status.type || turn.status) || \"\")),",
    "        isLatestTurn: (turn, thread) => Array.isArray(thread && thread.turns) && thread.turns.at(-1) === turn,",
    "        isReasoningItem: (item) => String(item && item.type || \"\") === \"reasoning\",",
    "        isOperationalItem: (item) => String(item && item.type || \"\") === \"commandExecution\",",
    "        isContextCompactionItem: () => false,",
    "        isTurnComplete: (turn) => /completed|failed|cancel|interrupted/i.test(String(turn && (turn.status && turn.status.type || turn.status) || \"\")),",
    "        isRunningStatus: (status) => /active|running|queued|processing/i.test(String(status && status.type || status || \"\")),",
    "        sortTurnsForDisplay: (turns) => Array.isArray(turns) ? turns : [],",
    "      })",
    "      : {};",
    "    return {",
    "      ok: runtime && typeof runtime === \"object\"",
    "        && typeof runtime.visibleItemsForTurn === \"function\"",
    "        && typeof runtime.mergeThreadPreservingVisibleItems === \"function\"",
    "        && typeof runtime.normalizeThreadVisibleUserMessages === \"function\"",
    "        && typeof runtime.threadUserMessageEntries === \"function\"",
    "        && typeof runtime.turnOrderMs === \"function\"",
    "        && typeof runtime.turnIsSupersededBy === \"function\"",
    "        && typeof globalThis.CodexThreadDetailRuntime === \"object\"",
    "        && typeof globalThis.CodexThreadDetailRuntime.createThreadDetailRuntime === \"function\",",
    "      factoryType: typeof api.createThreadDetailRuntime,",
    "      visibleItemsType: typeof (runtime && runtime.visibleItemsForTurn),",
    "      mergeType: typeof (runtime && runtime.mergeThreadPreservingVisibleItems),",
    "      normalizeType: typeof (runtime && runtime.normalizeThreadVisibleUserMessages),",
    "      turnOrderType: typeof (runtime && runtime.turnOrderMs),",
    "      globalFactoryType: typeof (globalThis.CodexThreadDetailRuntime && globalThis.CodexThreadDetailRuntime.createThreadDetailRuntime),",
    "    };",
    "  }",
    "  if (id === \"task-card-runtime\") {",
    "    const runtime = functionReady(api, \"createTaskCardRuntime\")",
    "      ? api.createTaskCardRuntime()",
    "      : {};",
    "    return {",
    "      ok: runtime && typeof runtime === \"object\"",
    "        && typeof runtime.renderThreadTaskCard === \"function\"",
    "        && typeof runtime.renderThreadTaskCards === \"function\"",
    "        && typeof runtime.createThreadTaskCardFromCurrent === \"function\"",
    "        && typeof runtime.renderApprovalRequest === \"function\"",
    "        && typeof globalThis.CodexTaskCardRuntime === \"object\"",
    "        && typeof globalThis.CodexTaskCardRuntime.createTaskCardRuntime === \"function\"",
    "        && typeof globalThis.threadTaskCardCommandText === \"function\"",
    "        && typeof globalThis.renderThreadTaskCards === \"function\"",
    "        && typeof globalThis.renderApprovalRequest === \"function\",",
    "      factoryType: typeof api.createTaskCardRuntime,",
    "      renderType: typeof (runtime && runtime.renderThreadTaskCard),",
    "      renderListType: typeof (runtime && runtime.renderThreadTaskCards),",
    "      createType: typeof (runtime && runtime.createThreadTaskCardFromCurrent),",
    "      approvalType: typeof (runtime && runtime.renderApprovalRequest),",
    "      globalCommandType: typeof globalThis.threadTaskCardCommandText,",
    "      globalRenderType: typeof globalThis.renderThreadTaskCards,",
    "    };",
    "  }",
    "  if (id === \"settings-runtime\") {",
    "    const runtime = functionReady(api, \"createSettingsRuntime\")",
    "      ? api.createSettingsRuntime()",
    "      : {};",
    "    return {",
    "      ok: runtime && typeof runtime === \"object\"",
    "        && typeof runtime.renderFontSizeControl === \"function\"",
    "        && typeof runtime.renderQuotaUsage === \"function\"",
    "        && typeof runtime.renderCodexProfileSettings === \"function\"",
    "        && typeof runtime.renderWorkspaceDelegationSettings === \"function\"",
    "        && typeof runtime.rememberRateLimitsFromConfig === \"function\"",
    "        && typeof runtime.rememberCodexProfiles === \"function\"",
    "        && typeof globalThis.CodexSettingsRuntime === \"object\"",
    "        && typeof globalThis.CodexSettingsRuntime.createSettingsRuntime === \"function\",",
    "      factoryType: typeof api.createSettingsRuntime,",
    "      fontSizeType: typeof (runtime && runtime.renderFontSizeControl),",
    "      quotaType: typeof (runtime && runtime.renderQuotaUsage),",
    "      profileType: typeof (runtime && runtime.renderCodexProfileSettings),",
    "      workspaceDelegationType: typeof (runtime && runtime.renderWorkspaceDelegationSettings),",
    "      rateLimitsType: typeof (runtime && runtime.rememberRateLimitsFromConfig),",
    "      profilesType: typeof (runtime && runtime.rememberCodexProfiles),",
    "      globalFactoryType: typeof (globalThis.CodexSettingsRuntime && globalThis.CodexSettingsRuntime.createSettingsRuntime),",
    "    };",
    "  }",
    "  if (id === \"app-entry\") {",
    "    const runtime = functionReady(api, \"createCodexMobileAppEntry\")",
    "      ? api.createCodexMobileAppEntry()",
    "      : {};",
    "    return {",
    "      ok: runtime && typeof runtime === \"object\"",
    "        && typeof runtime.startCodexMobileApp === \"function\"",
    "        && typeof api.startCodexMobileApp === \"function\"",
    "        && typeof globalThis.CodexMobileAppEntry === \"object\"",
    "        && typeof globalThis.CodexMobileAppEntry.createCodexMobileAppEntry === \"function\"",
    "        && typeof globalThis.CodexMobileAppEntry.startCodexMobileApp === \"function\",",
    "      factoryType: typeof api.createCodexMobileAppEntry,",
    "      startType: typeof api.startCodexMobileApp,",
    "      runtimeStartType: typeof (runtime && runtime.startCodexMobileApp),",
    "      globalFactoryType: typeof (globalThis.CodexMobileAppEntry && globalThis.CodexMobileAppEntry.createCodexMobileAppEntry),",
    "      globalStartType: typeof (globalThis.CodexMobileAppEntry && globalThis.CodexMobileAppEntry.startCodexMobileApp),",
    "    };",
    "  }",
    "  if (id === \"notification-ui-runtime\") {",
    "    const runtime = functionReady(api, \"createNotificationUiRuntime\")",
    "      ? api.createNotificationUiRuntime()",
    "      : {};",
    "    return {",
    "      ok: runtime && typeof runtime === \"object\"",
    "        && typeof runtime.showApp === \"function\"",
    "        && typeof runtime.showLogin === \"function\"",
    "        && typeof runtime.bootstrap === \"function\"",
    "        && typeof runtime.requestHermesPluginRefresh === \"function\"",
    "        && typeof runtime.handlePluginVoiceInputMessage === \"function\"",
    "        && typeof globalThis.CodexNotificationUiRuntime === \"object\"",
    "        && typeof globalThis.CodexNotificationUiRuntime.createNotificationUiRuntime === \"function\"",
    "        && typeof globalThis.showApp === \"function\"",
    "        && typeof globalThis.showLogin === \"function\"",
    "        && typeof globalThis.bootstrap === \"function\"",
    "        && typeof globalThis.sortTurnsForDisplay === \"function\",",
    "      factoryType: typeof api.createNotificationUiRuntime,",
    "      showAppType: typeof (runtime && runtime.showApp),",
    "      showLoginType: typeof (runtime && runtime.showLogin),",
    "      bootstrapType: typeof (runtime && runtime.bootstrap),",
    "      refreshType: typeof (runtime && runtime.requestHermesPluginRefresh),",
    "      globalBootstrapType: typeof globalThis.bootstrap,",
    "      globalSortType: typeof globalThis.sortTurnsForDisplay,",
    "    };",
    "  }",
    "  if (id === \"conversation-render-runtime\") {",
    "    const runtime = functionReady(api, \"createConversationRenderRuntime\")",
    "      ? api.createConversationRenderRuntime()",
    "      : {};",
    "    return {",
    "      ok: runtime && typeof runtime === \"object\"",
    "        && typeof runtime.renderTurn === \"function\"",
    "        && typeof runtime.renderItem === \"function\"",
    "        && typeof runtime.renderItemBody === \"function\"",
    "        && typeof runtime.renderUserMessageBody === \"function\"",
    "        && typeof runtime.renderLiveOperationDock === \"function\"",
    "        && typeof runtime.ensureTurn === \"function\"",
    "        && typeof runtime.shouldDeferLiveFinalReceipt === \"function\"",
    "        && typeof globalThis.CodexConversationRenderRuntime === \"object\"",
    "        && typeof globalThis.CodexConversationRenderRuntime.createConversationRenderRuntime === \"function\"",
    "        && typeof globalThis.renderTurn === \"function\"",
    "        && typeof globalThis.renderItem === \"function\"",
    "        && typeof globalThis.renderLiveOperationDock === \"function\"",
    "        && typeof globalThis.ensureTurn === \"function\"",
    "        && typeof globalThis.shouldDeferLiveFinalReceipt === \"function\"",
    "        && typeof globalThis.imageUrlValue === \"function\"",
    "        && typeof globalThis.renderMarkdownWithAttachmentSummary === \"function\"",
    "        && typeof globalThis.renderFilePreviewContent === \"function\"",
    "        && typeof globalThis.closeImagePreview === \"function\",",
    "      factoryType: typeof api.createConversationRenderRuntime,",
    "      renderTurnType: typeof (runtime && runtime.renderTurn),",
    "      renderItemType: typeof (runtime && runtime.renderItem),",
    "      liveDockType: typeof (runtime && runtime.renderLiveOperationDock),",
    "      ensureTurnType: typeof (runtime && runtime.ensureTurn),",
    "      globalRenderType: typeof globalThis.renderTurn,",
    "      globalEnsureTurnType: typeof globalThis.ensureTurn,",
    "      globalImageUrlType: typeof globalThis.imageUrlValue,",
    "    };",
    "  }",
    "  if (id === \"event-stream-runtime\") {",
    "    const runtime = functionReady(api, \"createEventStreamRuntime\")",
    "      ? api.createEventStreamRuntime()",
    "      : {};",
    "    return {",
    "      ok: runtime && typeof runtime === \"object\"",
    "        && typeof runtime.connectEvents === \"function\"",
    "        && typeof runtime.applyNotification === \"function\"",
    "        && typeof runtime.resumeMobileSession === \"function\"",
    "        && typeof runtime.scrollConversationToBottom === \"function\"",
    "        && typeof runtime.updateScrollToBottomButton === \"function\"",
    "        && typeof globalThis.CodexEventStreamRuntime === \"object\"",
    "        && typeof globalThis.CodexEventStreamRuntime.createEventStreamRuntime === \"function\"",
    "        && typeof globalThis.upsertItem === \"function\"",
    "        && typeof globalThis.connectEvents === \"function\"",
    "        && typeof globalThis.ensureEventConnection === \"function\"",
    "        && typeof globalThis.resumeMobileSession === \"function\"",
    "        && typeof globalThis.followThreadOpenToBottom === \"function\"",
    "        && typeof globalThis.scheduleBottomFollowScroll === \"function\"",
    "        && typeof globalThis.updateScrollToBottomButton === \"function\",",
    "      factoryType: typeof api.createEventStreamRuntime,",
    "      connectType: typeof (runtime && runtime.connectEvents),",
    "      notificationType: typeof (runtime && runtime.applyNotification),",
    "      resumeType: typeof (runtime && runtime.resumeMobileSession),",
    "      scrollType: typeof (runtime && runtime.scrollConversationToBottom),",
    "      globalConnectType: typeof globalThis.connectEvents,",
    "      globalFollowType: typeof globalThis.followThreadOpenToBottom,",
    "    };",
    "  }",
    "  if (id === \"client-render-stability-guard\") {",
    "    const sourceTurn = {",
    "      id: \"local-turn-secret\",",
    "      items: [{ type: \"userMessage\", clientSubmissionId: \"submission-secret\", mobilePendingSubmission: true }],",
    "    };",
    "    const targetTurn = {",
    "      id: \"server-turn-a\",",
    "      items: [{ type: \"userMessage\", clientSubmissionId: \"submission-secret\" }],",
    "    };",
    "    const sourceKey = functionReady(api, \"markSubmittedTurn\")",
    "      ? api.markSubmittedTurn(sourceTurn, \"submission-secret\")",
    "      : \"\";",
    "    const transferredKey = functionReady(api, \"transferSubmittedTurnIdentity\")",
    "      ? api.transferSubmittedTurnIdentity(sourceTurn, targetTurn, \"submission-secret\")",
    "      : \"\";",
    "    const sourceIdentity = functionReady(api, \"stableTurnIdentity\")",
    "      ? api.stableTurnIdentity(sourceTurn)",
    "      : \"\";",
    "    const targetIdentity = functionReady(api, \"stableTurnIdentity\")",
    "      ? api.stableTurnIdentity(targetTurn)",
    "      : \"\";",
    "    return {",
    "      ok: Boolean(sourceKey)",
    "        && sourceKey === transferredKey",
    "        && sourceIdentity === sourceKey",
    "        && targetIdentity === sourceKey",
    "        && !String(sourceKey).includes(\"submission-secret\"),",
    "      sourceKey: String(sourceKey || \"\"),",
    "      transferredKey: String(transferredKey || \"\"),",
    "      sourceIdentity: String(sourceIdentity || \"\"),",
    "      targetIdentity: String(targetIdentity || \"\"),",
    "    };",
    "  }",
    "  if (id === \"live-operation-dock-state\") {",
    "    const card = functionReady(api, \"operationCardContentPlan\")",
    "      ? api.operationCardContentPlan({ itemId: \"op-a\", type: \"tool\", status: \"running\", title: \"Run\", detail: \"working\", durationText: \"1s\" })",
    "      : {};",
    "    const preserve = functionReady(api, \"compactBubblePreservation\")",
    "      ? api.compactBubblePreservation({",
    "        nextHtml: \"\",",
    "        liveTurnActive: true,",
    "        visibleUntilMs: 2000,",
    "        nowMs: 1000,",
    "        savedThreadId: \"thread-a\",",
    "        currentThreadId: \"thread-a\",",
    "        savedHtml: \"<div class=\\\"mobile-operation-bubble\\\"></div>\",",
    "        dockHasBubble: false,",
    "      })",
    "      : {};",
    "    const recall = functionReady(api, \"shouldShowRecall\")",
    "      ? api.shouldShowRecall({",
    "        isMobile: true,",
    "        hasCurrentThread: true,",
    "        newThreadDraft: false,",
    "        liveTurnActive: true,",
    "        recallThreadId: \"thread-a\",",
    "        currentThreadId: \"thread-a\",",
    "        recallHtml: \"<div class=\\\"mobile-operation-sheet\\\"></div>\",",
    "      })",
    "      : false;",
    "    const classTokens = Array.isArray(card.classTokens) ? card.classTokens : [];",
    "    return {",
    "      ok: card.detail === \"working\"",
    "        && classTokens.includes(\"live-operation\")",
    "        && preserve.preserve === true",
    "        && preserve.patchSavedHtml === true",
    "        && recall === true,",
    "      detail: String(card.detail || \"\"),",
    "      preserve: Boolean(preserve.preserve),",
    "      recall,",
    "    };",
    "  }",
    "  return { ok: false };",
    "}",
    "",
    "export function codexMobileViteEsmCompatibility() {",
    "  const modules = moduleDefinitions.map((definition) => {",
    "    const api = moduleApis[definition.id] && typeof moduleApis[definition.id] === \"object\"",
    "      ? moduleApis[definition.id]",
    "      : {};",
    "    const expectedFunctions = Array.isArray(definition.expectedFunctions) ? definition.expectedFunctions : [];",
    "    const exportedFunctions = expectedFunctions.filter((name) => functionReady(api, name));",
    "    const sample = sampleModule(definition.id, api);",
    "    const globalPublished = publishClassicGlobal(definition, api);",
    "    return {",
    "      id: definition.id,",
    "      source: definition.source,",
    "      assetPath: definition.assetPath,",
    "      nativeSource: definition.nativeSource || \"\",",
    "      importSource: definition.importSource || definition.source,",
    "      compatibilityMode: definition.compatibilityMode || \"classic-global-compat\",",
    "      globalName: definition.globalName,",
    "      classicLoaderExcluded: definition.classicLoaderExcluded === true,",
    "      expectedFunctions: expectedFunctions.slice(),",
    "      exportedFunctions,",
    "      sample,",
    "      globalPublished,",
    "      ready: exportedFunctions.length === expectedFunctions.length",
    "        && sample.ok === true",
    "        && (definition.classicLoaderExcluded !== true || globalPublished === true),",
    "    };",
  "  });",
    "  return {",
    "    schemaVersion: 1,",
    "    owner: \"vite-shell-entry\",",
    "    moduleCount: modules.length,",
    "    nativeEsmModuleCount: modules.filter((entry) => entry.compatibilityMode === \"native-esm\").length,",
    "    classicGlobalCompatibilityModuleCount: modules.filter((entry) => entry.compatibilityMode !== \"native-esm\").length,",
    "    readyCount: modules.filter((entry) => entry.ready === true).length,",
    "    modules,",
    "  };",
    "}",
    "",
    "export const codexMobileViteEsmCompatibilityModules = moduleDefinitions;",
    "export default codexMobileViteEsmCompatibility;",
    "",
  ].join("\n");
}

function createEsmCompatibilityVirtualModuleSource(root) {
  const shards = buildViteEsmCompatibilityShards(root);
  const shardDescriptors = shards.map((shard) => ({
    id: shard.id,
    index: shard.index,
    source: shard.source,
    moduleCount: shard.moduleCount,
    moduleIds: shard.moduleIds,
    byteCount: shard.byteCount,
  }));
  const loaderEntries = shardDescriptors.map((shard) => (
    `  ${JSON.stringify(shard.id)}: () => import(${JSON.stringify(shard.source)}),`
  ));
  return [
    `export const codexMobileViteEsmCompatibilityShardSources = ${JSON.stringify(shardDescriptors, null, 2)};`,
    "const shardLoaders = {",
    ...loaderEntries,
    "};",
    "let compatibilityPromise = null;",
    "",
    "async function loadCompatibilityShard(descriptor) {",
    "  const load = shardLoaders[descriptor.id];",
    "  if (typeof load !== \"function\") {",
    "    throw new Error(`codex_mobile_vite_esm_compatibility_shard_loader_missing:${descriptor.id}`);",
    "  }",
    "  const module = await load();",
    "  const createCompatibility = module && typeof module.codexMobileViteEsmCompatibility === \"function\"",
    "    ? module.codexMobileViteEsmCompatibility",
    "    : module && typeof module.default === \"function\" ? module.default : null;",
    "  if (!createCompatibility) {",
    "    throw new Error(`codex_mobile_vite_esm_compatibility_shard_factory_missing:${descriptor.id}`);",
    "  }",
    "  const payload = await createCompatibility();",
    "  return { descriptor, payload: payload && typeof payload === \"object\" ? payload : {} };",
    "}",
    "",
    "export async function codexMobileViteEsmCompatibility() {",
    "  if (!compatibilityPromise) {",
    "    compatibilityPromise = Promise.all(codexMobileViteEsmCompatibilityShardSources.map(loadCompatibilityShard))",
    "      .then((records) => {",
    "        const orderedRecords = records.slice().sort((left, right) => left.descriptor.index - right.descriptor.index);",
    "        const modules = orderedRecords.flatMap((record) => (",
    "          Array.isArray(record.payload.modules) ? record.payload.modules : []",
    "        ));",
    "        const shardSummaries = orderedRecords.map((record) => ({",
    "          id: record.descriptor.id,",
    "          index: record.descriptor.index,",
    "          source: record.descriptor.source,",
    "          moduleCount: Number(record.payload.moduleCount) || 0,",
    "          readyCount: Number(record.payload.readyCount) || 0,",
    "          moduleIds: Array.isArray(record.descriptor.moduleIds) ? record.descriptor.moduleIds.slice() : [],",
    "          byteCount: Number(record.descriptor.byteCount) || 0,",
    "        }));",
    "        const compatibility = {",
    "          schemaVersion: 1,",
    "          owner: \"vite-shell-entry\",",
    "          loading: false,",
    "          shardCount: shardSummaries.length,",
    "          shards: shardSummaries,",
    "          moduleCount: modules.length,",
    "          nativeEsmModuleCount: modules.filter((entry) => entry && entry.compatibilityMode === \"native-esm\").length,",
    "          classicGlobalCompatibilityModuleCount: modules.filter((entry) => entry && entry.compatibilityMode !== \"native-esm\").length,",
    "          readyCount: modules.filter((entry) => entry && entry.ready === true).length,",
    "          modules,",
    "        };",
    "        if (typeof globalThis !== \"undefined\") {",
    "          globalThis.__CODEX_MOBILE_VITE_ESM_COMPATIBILITY_SHARDS__ = shardSummaries;",
    "        }",
    "        return compatibility;",
    "      });",
    "  }",
    "  return compatibilityPromise;",
    "}",
    "",
    "export default codexMobileViteEsmCompatibility;",
    "",
  ].join("\n");
}

function normalizePath(value) {
  return String(value || "").replace(/\\/g, "/");
}

function sanitizeEntryGroupId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function classicGlobalExportsForAssets(manifest, assets) {
  const assetSet = new Set(Array.isArray(assets) ? assets : []);
  return (Array.isArray(manifest && manifest.classicGlobalExports) ? manifest.classicGlobalExports : [])
    .filter((entry) => assetSet.has(entry && entry.asset))
    .map((entry) => ({
      asset: entry.asset,
      globals: Array.isArray(entry.globals) ? entry.globals.slice() : [],
    }));
}

function classicAssetRecordsForAssets(manifest, assets) {
  const assetSet = new Set(Array.isArray(assets) ? assets : []);
  return (Array.isArray(manifest && manifest.assets) ? manifest.assets : [])
    .filter((entry) => assetSet.has(entry && entry.path))
    .map((entry) => ({
      path: entry.path,
      sourcePath: entry.sourcePath,
      bytes: Number(entry.bytes) || 0,
      sha256: String(entry.sha256 || ""),
    }));
}

function startupGlobalContracts(manifest) {
  return (Array.isArray(manifest && manifest.startupGlobalContracts) ? manifest.startupGlobalContracts : [])
    .map((entry) => ({
      name: String(entry && entry.name || ""),
      asset: String(entry && entry.asset || ""),
      groupId: String(entry && entry.groupId || ""),
      startupCritical: Boolean(entry && entry.startupCritical),
      source: String(entry && entry.source || "startup-window-guard"),
      present: entry && entry.present !== false,
    }))
    .filter((entry) => entry.name);
}

function viteEntryGroupSourceId(groupId) {
  return `${VITE_ENTRY_GROUP_SOURCE_PREFIX}${sanitizeEntryGroupId(groupId)}`;
}

export function buildViteEntryGroupInputs(root = process.cwd()) {
  const manifest = buildPublicShellManifest(root);
  const inputs = {};
  for (const group of Array.isArray(manifest.entryGroups) ? manifest.entryGroups : []) {
    const groupId = sanitizeEntryGroupId(group && group.id);
    if (!groupId) continue;
    inputs[`vite-entry-group-${groupId}`] = viteEntryGroupSourceId(groupId);
  }
  return inputs;
}

function bundleValues(bundle) {
  return Object.values(bundle || {});
}

function sourceForFacadeModule(facadeModuleId, root) {
  const value = normalizePath(facadeModuleId);
  if (!value) return "";
  if (value.includes(VITE_ESM_COMPATIBILITY_SOURCE)) {
    return value.slice(value.indexOf(VITE_ESM_COMPATIBILITY_SOURCE));
  }
  const virtualIndex = value.indexOf(VITE_ENTRY_GROUP_SOURCE_PREFIX);
  if (virtualIndex >= 0) {
    return value.slice(virtualIndex);
  }
  const rootPath = normalizePath(root || process.cwd());
  if (value === rootPath || value.startsWith(`${rootPath}/`)) {
    return normalizePath(path.relative(rootPath, value));
  }
  return value;
}

function chunkRecords(bundle, root = process.cwd()) {
  return bundleValues(bundle)
    .filter((item) => item && item.type === "chunk")
    .map((chunk) => ({
      fileName: normalizePath(chunk.fileName),
      name: String(chunk.name || ""),
      source: sourceForFacadeModule(chunk.facadeModuleId, root),
      isEntry: Boolean(chunk.isEntry),
      isDynamicEntry: Boolean(chunk.isDynamicEntry),
      imports: Array.isArray(chunk.imports) ? chunk.imports.map(normalizePath) : [],
      dynamicImports: Array.isArray(chunk.dynamicImports) ? chunk.dynamicImports.map(normalizePath) : [],
    }))
    .sort((a, b) => a.fileName.localeCompare(b.fileName));
}

function importedChunkClosure(chunks, seedChunks) {
  const byFileName = new Map((chunks || []).map((chunk) => [chunk.fileName, chunk]));
  const seedFileNames = new Set((seedChunks || []).map((chunk) => chunk && chunk.fileName).filter(Boolean));
  const visited = new Set();
  const result = [];
  const pending = (seedChunks || [])
    .flatMap((chunk) => Array.isArray(chunk && chunk.imports) ? chunk.imports : [])
    .filter(Boolean);
  while (pending.length) {
    const fileName = pending.shift();
    if (!fileName || visited.has(fileName) || seedFileNames.has(fileName)) continue;
    visited.add(fileName);
    const chunk = byFileName.get(fileName);
    if (!chunk) continue;
    result.push(chunk);
    for (const importedFile of Array.isArray(chunk.imports) ? chunk.imports : []) {
      if (importedFile && !visited.has(importedFile)) pending.push(importedFile);
    }
  }
  return result.sort((a, b) => a.fileName.localeCompare(b.fileName));
}

function assetOutputRecords(manifest) {
  return (manifest.assets || []).map((asset) => ({
    path: asset.path,
    sourcePath: asset.sourcePath,
    fileName: outputPathForAsset(asset.path),
    bytes: asset.bytes,
    sha256: asset.sha256,
  }));
}

function classicShellScriptBlockContract(manifest) {
  const scriptAssets = Array.isArray(manifest && manifest.indexScriptAssets)
    ? manifest.indexScriptAssets
    : [];
  const source = renderShellScriptBlock(scriptAssets);
  return {
    schemaVersion: 1,
    source: "generated-classic-index-script-block",
    startMarker: SHELL_SCRIPT_BLOCK_START,
    endMarker: SHELL_SCRIPT_BLOCK_END,
    scriptCount: scriptAssets.length,
    firstScript: scriptAssets[0] || "",
    lastScript: scriptAssets.length ? scriptAssets[scriptAssets.length - 1] : "",
    sha256: sha256Hex(Buffer.from(source, "utf8")),
  };
}

function startupCompatibilityContract(manifest) {
  const contracts = startupGlobalContracts(manifest);
  const classicExports = Array.isArray(manifest && manifest.classicGlobalExports)
    ? manifest.classicGlobalExports
    : [];
  const assetRecords = new Map((Array.isArray(manifest && manifest.assets) ? manifest.assets : [])
    .map((entry) => [String(entry && entry.path || ""), entry]));
  const exportedAssetByGlobal = new Map();
  for (const entry of classicExports) {
    for (const name of Array.isArray(entry && entry.globals) ? entry.globals : []) {
      exportedAssetByGlobal.set(String(name || ""), String(entry && entry.asset || ""));
    }
  }
  const requiredGlobals = contracts.map((entry) => {
    const assetRecord = assetRecords.get(entry.asset) || {};
    return {
      ...entry,
      exportedAsset: exportedAssetByGlobal.get(entry.name) || "",
      hashPresent: Boolean(assetRecord && assetRecord.sha256),
      bytes: Number(assetRecord && assetRecord.bytes) || 0,
      sha256: String(assetRecord && assetRecord.sha256 || ""),
    };
  });
  return {
    schemaVersion: 1,
    source: "generated-startup-window-guards",
    requiredGlobals,
    requiredGlobalNames: requiredGlobals.map((entry) => entry.name),
    requiredGlobalCount: requiredGlobals.length,
    assetCount: new Set(requiredGlobals.map((entry) => entry.asset).filter(Boolean)).size,
    hashCount: requiredGlobals.filter((entry) => entry.hashPresent).length,
    byteCount: requiredGlobals.reduce((total, entry) => total + (Number(entry.bytes) || 0), 0),
  };
}

function appPreviewClassicLoaderPlanContract(manifest) {
  const scriptAssets = Array.isArray(manifest && manifest.indexScriptAssets)
    ? manifest.indexScriptAssets
    : [];
  const assetRecords = new Map((Array.isArray(manifest && manifest.assets) ? manifest.assets : [])
    .map((entry) => [String(entry && entry.path || ""), entry]));
  const esmModuleByAssetPath = new Map(esmCompatibilityModuleDefinitions()
    .filter((entry) => entry.classicLoaderExcluded && entry.assetPath)
    .map((entry) => [entry.assetPath, entry]));
  const viteOwnedByAssetPath = new Map(VITE_APP_PREVIEW_OWNED_CLASSIC_SCRIPTS
    .map((entry) => [entry.path, entry]));
  const groupByAsset = new Map();
  for (const group of Array.isArray(manifest && manifest.entryGroups) ? manifest.entryGroups : []) {
    for (const asset of Array.isArray(group && group.assets) ? group.assets : []) {
      groupByAsset.set(String(asset || ""), {
        groupId: String(group && group.id || ""),
        phase: String(group && group.phase || ""),
        startupCritical: Boolean(group && group.startupCritical),
        chunkTarget: String(group && group.chunkTarget || ""),
      });
    }
  }
  function scriptRecord(assetPath, sourceIndex, index) {
    const assetRecord = assetRecords.get(assetPath) || {};
    const group = groupByAsset.get(assetPath) || {};
    return {
      index,
      sourceIndex,
      path: assetPath,
      groupId: String(group.groupId || ""),
      phase: String(group.phase || ""),
      startupCritical: Boolean(group.startupCritical),
      chunkTarget: String(group.chunkTarget || ""),
      sourcePath: String(assetRecord.sourcePath || ""),
      bytes: Number(assetRecord.bytes) || 0,
      sha256: String(assetRecord.sha256 || ""),
    };
  }
  const scripts = [];
  const excludedEsmScripts = [];
  const excludedViteOwnedScripts = [];
  scriptAssets.forEach((assetPath, sourceIndex) => {
    const esmModule = esmModuleByAssetPath.get(assetPath);
    if (esmModule) {
      excludedEsmScripts.push({
        ...scriptRecord(assetPath, sourceIndex, sourceIndex),
        esmModuleId: String(esmModule.id || ""),
        globalName: String(esmModule.globalName || ""),
      });
      return;
    }
    const viteOwnedScript = viteOwnedByAssetPath.get(assetPath);
    if (viteOwnedScript) {
      excludedViteOwnedScripts.push({
        ...scriptRecord(assetPath, sourceIndex, sourceIndex),
        ownerId: String(viteOwnedScript.ownerId || ""),
        globalName: String(viteOwnedScript.globalName || ""),
      });
      return;
    }
    scripts.push(scriptRecord(assetPath, sourceIndex, scripts.length));
  });
  const contract = {
    schemaVersion: 1,
    source: "generated-vite-app-preview-classic-loader-plan",
    owner: "vite-shell-entry",
    sourceScriptCount: scriptAssets.length,
    scriptCount: scripts.length,
    firstScript: scripts[0] ? scripts[0].path : "",
    lastScript: scripts.length ? scripts[scripts.length - 1].path : "",
    hashCount: scripts.filter((entry) => entry.sha256).length,
    byteCount: scripts.reduce((total, entry) => total + (Number(entry.bytes) || 0), 0),
    excludedEsmScriptCount: excludedEsmScripts.length,
    excludedEsmHashCount: excludedEsmScripts.filter((entry) => entry.sha256).length,
    excludedEsmByteCount: excludedEsmScripts.reduce((total, entry) => total + (Number(entry.bytes) || 0), 0),
    excludedEsmScripts,
    excludedViteOwnedScriptCount: excludedViteOwnedScripts.length,
    excludedViteOwnedHashCount: excludedViteOwnedScripts.filter((entry) => entry.sha256).length,
    excludedViteOwnedByteCount: excludedViteOwnedScripts.reduce((total, entry) => total + (Number(entry.bytes) || 0), 0),
    excludedViteOwnedScripts,
    scripts,
  };
  return {
    ...contract,
    sha256: sha256Hex(Buffer.from(JSON.stringify(contract), "utf8")),
  };
}

function esmCompatibilityContract(root = process.cwd()) {
  const shards = buildViteEsmCompatibilityShards(root).map((shard) => ({
    id: shard.id,
    index: shard.index,
    source: shard.source,
    moduleCount: shard.moduleCount,
    moduleIds: shard.moduleIds,
    byteCount: shard.byteCount,
  }));
  const modules = esmCompatibilityModuleDefinitions().map((moduleRecord, index) => {
    const sourcePath = String(moduleRecord && moduleRecord.source || "");
    let bytes = 0;
    let sha256 = "";
    try {
      const buffer = fs.readFileSync(path.join(root, sourcePath));
      bytes = buffer.length;
      sha256 = sha256Hex(buffer);
    } catch (_) {
      // Validation reports missing hashes without masking the build-contract shape.
    }
    const expectedFunctions = Array.isArray(moduleRecord && moduleRecord.expectedFunctions)
      ? moduleRecord.expectedFunctions.slice()
      : [];
    return {
      index,
      id: String(moduleRecord && moduleRecord.id || ""),
      source: sourcePath,
      assetPath: String(moduleRecord && moduleRecord.assetPath || ""),
      nativeSource: String(moduleRecord && moduleRecord.nativeSource || ""),
      importSource: String(moduleRecord && moduleRecord.importSource || moduleRecord.source || ""),
      compatibilityMode: String(moduleRecord && moduleRecord.compatibilityMode || "classic-global-compat"),
      globalName: String(moduleRecord && moduleRecord.globalName || ""),
      classicLoaderExcluded: moduleRecord && moduleRecord.classicLoaderExcluded === true,
      expectedFunctions,
      expectedFunctionCount: expectedFunctions.length,
      bytes,
      sha256,
      hashPresent: Boolean(sha256),
    };
  });
  return {
    schemaVersion: 1,
    source: "generated-vite-esm-compatibility-contract",
    owner: "vite-shell-entry",
    virtualModuleSource: VITE_ESM_COMPATIBILITY_SOURCE,
    virtualShardSourcePrefix: VITE_ESM_COMPATIBILITY_SHARD_SOURCE_PREFIX,
    shardCount: shards.length,
    shards,
    moduleCount: modules.length,
    nativeEsmModuleCount: modules.filter((entry) => entry.compatibilityMode === "native-esm").length,
    classicGlobalCompatibilityModuleCount: modules.filter((entry) => entry.compatibilityMode !== "native-esm").length,
    expectedFunctionCount: modules.reduce((total, entry) => total + entry.expectedFunctionCount, 0),
    hashCount: modules.filter((entry) => entry.hashPresent).length,
    byteCount: modules.reduce((total, entry) => total + (Number(entry.bytes) || 0), 0),
    modules,
  };
}

function validateViteShellBuildContract(contract, manifest) {
  const issues = [];
  const entry = contract.viteEntry;
  const deferredChunks = contract.viteDeferredChunks || [];
  const entryGroupChunks = contract.viteEntryGroupChunks || [];
  const esmCompatibilityChunks = contract.viteEsmCompatibilityChunks || [];
  const entryDynamicImportGraph = contract.entryDynamicImportGraph || {};
  const classicFallback = contract.classicFallback || {};
  const classicScriptBlock = classicFallback.scriptBlock || null;
  const startupCompatibility = contract.startupCompatibility || {};
  const appPreviewClassicLoaderPlan = contract.appPreviewClassicLoaderPlan || null;
  const esmCompatibility = contract.esmCompatibility || null;
  const expectedClassicScriptBlock = classicShellScriptBlockContract(manifest);
  const expectedAppPreviewClassicLoaderPlan = appPreviewClassicLoaderPlanContract(manifest);
  const outputFiles = new Set(contract.outputFiles || []);
  const classicOutputFiles = new Set((contract.classicShellAssets || []).map((asset) => asset.fileName));
  const requiredGroupIds = (Array.isArray(manifest.entryGroups) ? manifest.entryGroups : [])
    .map((group) => sanitizeEntryGroupId(group && group.id))
    .filter(Boolean);
  const entryChunkIds = new Set(entryGroupChunks.map((chunk) => sanitizeEntryGroupId(chunk.groupId)));

  if (contract.productionExecution !== "classic-script-fallback") {
    issues.push({ code: "vite_build_contract_not_classic_fallback" });
  }
  if (contract.entryGroupImportOwner !== "vite-shell-entry") {
    issues.push({ code: "vite_entry_group_import_owner_mismatch" });
  }
  if (!entry || entry.source !== VITE_SHELL_ENTRY_SOURCE || !entry.fileName) {
    issues.push({ code: "vite_shell_entry_missing" });
  }
  if (!entry || !Array.isArray(entry.dynamicImports) || !entry.dynamicImports.length) {
    issues.push({ code: "vite_shell_entry_missing_dynamic_import" });
  }
  if (!deferredChunks.length) {
    issues.push({ code: "vite_deferred_chunk_missing" });
  }
  if (deferredChunks.some((chunk) => String(chunk && chunk.source || "").startsWith(VITE_ENTRY_GROUP_SOURCE_PREFIX))) {
    issues.push({ code: "vite_deferred_chunk_contains_entry_group" });
  }
  if (!deferredChunks.some((chunk) => chunk.source === VITE_DEFERRED_ENTRY_SOURCE || chunk.name === "vite-deferred-entry-topology")) {
    issues.push({ code: "vite_deferred_entry_topology_missing" });
  }
  if (!esmCompatibilityChunks.some((chunk) => chunk.source === VITE_ESM_COMPATIBILITY_SOURCE)) {
    issues.push({ code: "vite_esm_compatibility_entry_chunk_missing" });
  }
  for (const groupId of requiredGroupIds) {
    if (!entryChunkIds.has(groupId)) {
      issues.push({ code: "vite_entry_group_chunk_missing", groupId });
    }
  }
  for (const chunk of entryGroupChunks) {
    if (Number(chunk.classicAssetHashCount) !== Number(chunk.assetCount)) {
      issues.push({ code: "vite_entry_group_classic_asset_hash_count_mismatch", groupId: chunk.groupId });
      break;
    }
    if (!Array.isArray(chunk.classicAssetRecords) || chunk.classicAssetRecords.length !== Number(chunk.assetCount)) {
      issues.push({ code: "vite_entry_group_classic_asset_records_missing", groupId: chunk.groupId });
      break;
    }
  }
  if (entryDynamicImportGraph.owner !== "vite-shell-entry") {
    issues.push({ code: "vite_entry_dynamic_import_owner_mismatch" });
  }
  if ((entryDynamicImportGraph.missingFiles || []).length) {
    issues.push({ code: "vite_entry_dynamic_import_missing" });
  }
  if ((entryDynamicImportGraph.extraFiles || []).length) {
    issues.push({ code: "vite_entry_dynamic_import_extra" });
  }
  if (Number(entryDynamicImportGraph.entryGroupFileCount) !== requiredGroupIds.length) {
    issues.push({ code: "vite_entry_dynamic_import_entry_group_count_mismatch" });
  }
  if (Number(entryDynamicImportGraph.esmCompatibilityFileCount) !== 1) {
    issues.push({ code: "vite_entry_dynamic_import_esm_compatibility_count_mismatch" });
  }
  if (Number(entryDynamicImportGraph.deferredFileCount) < 1) {
    issues.push({ code: "vite_entry_dynamic_import_deferred_missing" });
  }
  if (!classicScriptBlock) {
    issues.push({ code: "classic_shell_script_block_contract_missing" });
  } else {
    if (classicScriptBlock.sha256 !== expectedClassicScriptBlock.sha256) {
      issues.push({ code: "classic_shell_script_block_hash_mismatch" });
    }
    if (Number(classicScriptBlock.scriptCount) !== expectedClassicScriptBlock.scriptCount) {
      issues.push({ code: "classic_shell_script_block_count_mismatch" });
    }
    if (String(classicScriptBlock.firstScript || "") !== expectedClassicScriptBlock.firstScript
      || String(classicScriptBlock.lastScript || "") !== expectedClassicScriptBlock.lastScript) {
      issues.push({ code: "classic_shell_script_block_boundary_mismatch" });
    }
  }
  if (!Array.isArray(startupCompatibility.requiredGlobals) || !startupCompatibility.requiredGlobals.length) {
    issues.push({ code: "startup_global_contract_missing" });
  } else {
    for (const entry of startupCompatibility.requiredGlobals) {
      if (!entry || !entry.name || !entry.asset || entry.exportedAsset !== entry.asset || entry.hashPresent !== true) {
        issues.push({ code: "startup_global_contract_invalid", global: entry && entry.name });
        break;
      }
    }
    if (Number(startupCompatibility.hashCount) !== Number(startupCompatibility.requiredGlobalCount)) {
      issues.push({ code: "startup_global_contract_hash_count_mismatch" });
    }
  }
  if (!appPreviewClassicLoaderPlan) {
    issues.push({ code: "vite_app_preview_classic_loader_plan_missing" });
  } else {
    const planScripts = Array.isArray(appPreviewClassicLoaderPlan.scripts)
      ? appPreviewClassicLoaderPlan.scripts
      : [];
    const excludedEsmScripts = Array.isArray(appPreviewClassicLoaderPlan.excludedEsmScripts)
      ? appPreviewClassicLoaderPlan.excludedEsmScripts
      : [];
    const excludedViteOwnedScripts = Array.isArray(appPreviewClassicLoaderPlan.excludedViteOwnedScripts)
      ? appPreviewClassicLoaderPlan.excludedViteOwnedScripts
      : [];
    const planPaths = planScripts.map((entry) => entry && entry.path).filter(Boolean);
    const excludedPaths = excludedEsmScripts.map((entry) => entry && entry.path).filter(Boolean);
    const excludedViteOwnedPaths = excludedViteOwnedScripts.map((entry) => entry && entry.path).filter(Boolean);
    const sourceScriptAssets = Array.isArray(manifest.indexScriptAssets) ? manifest.indexScriptAssets : [];
    const coveredPaths = new Set([...planPaths, ...excludedPaths, ...excludedViteOwnedPaths]);
    const reconstructedSourcePaths = sourceScriptAssets.filter((asset) => coveredPaths.has(asset));
    if (appPreviewClassicLoaderPlan.owner !== "vite-shell-entry") {
      issues.push({ code: "vite_app_preview_classic_loader_plan_owner_mismatch" });
    }
    if (appPreviewClassicLoaderPlan.sha256 !== expectedAppPreviewClassicLoaderPlan.sha256) {
      issues.push({ code: "vite_app_preview_classic_loader_plan_hash_mismatch" });
    }
    if (Number(appPreviewClassicLoaderPlan.sourceScriptCount) !== sourceScriptAssets.length
      || Number(appPreviewClassicLoaderPlan.scriptCount) !== expectedAppPreviewClassicLoaderPlan.scriptCount
      || Number(appPreviewClassicLoaderPlan.hashCount) !== expectedAppPreviewClassicLoaderPlan.hashCount
      || Number(appPreviewClassicLoaderPlan.hashCount) !== Number(appPreviewClassicLoaderPlan.scriptCount)
      || Number(appPreviewClassicLoaderPlan.excludedEsmScriptCount) !== expectedAppPreviewClassicLoaderPlan.excludedEsmScriptCount
      || Number(appPreviewClassicLoaderPlan.excludedEsmHashCount) !== expectedAppPreviewClassicLoaderPlan.excludedEsmHashCount
      || Number(appPreviewClassicLoaderPlan.excludedViteOwnedScriptCount || 0) !== expectedAppPreviewClassicLoaderPlan.excludedViteOwnedScriptCount
      || Number(appPreviewClassicLoaderPlan.excludedViteOwnedHashCount || 0) !== expectedAppPreviewClassicLoaderPlan.excludedViteOwnedHashCount) {
      issues.push({ code: "vite_app_preview_classic_loader_plan_count_mismatch" });
    }
    if (String(appPreviewClassicLoaderPlan.firstScript || "") !== expectedAppPreviewClassicLoaderPlan.firstScript
      || String(appPreviewClassicLoaderPlan.lastScript || "") !== expectedAppPreviewClassicLoaderPlan.lastScript) {
      issues.push({ code: "vite_app_preview_classic_loader_plan_boundary_mismatch" });
    }
    if (JSON.stringify(planPaths) !== JSON.stringify(expectedAppPreviewClassicLoaderPlan.scripts.map((entry) => entry.path))
      || JSON.stringify(excludedPaths) !== JSON.stringify(expectedAppPreviewClassicLoaderPlan.excludedEsmScripts.map((entry) => entry.path))
      || JSON.stringify(excludedViteOwnedPaths) !== JSON.stringify(expectedAppPreviewClassicLoaderPlan.excludedViteOwnedScripts.map((entry) => entry.path))
      || JSON.stringify(reconstructedSourcePaths) !== JSON.stringify(sourceScriptAssets)
      || coveredPaths.size !== sourceScriptAssets.length) {
      issues.push({ code: "vite_app_preview_classic_loader_plan_order_mismatch" });
    }
    if (planScripts.some((entry) => !entry || !entry.groupId || !entry.sha256 || !Number(entry.bytes))) {
      issues.push({ code: "vite_app_preview_classic_loader_plan_record_missing" });
    }
    if (excludedEsmScripts.some((entry) => !entry || !entry.groupId || !entry.esmModuleId || !entry.globalName || !entry.sha256 || !Number(entry.bytes))) {
      issues.push({ code: "vite_app_preview_classic_loader_plan_exclusion_record_missing" });
    }
    if (excludedViteOwnedScripts.some((entry) => !entry || !entry.groupId || !entry.ownerId || !entry.globalName || !entry.sha256 || !Number(entry.bytes))) {
      issues.push({ code: "vite_app_preview_classic_loader_plan_vite_owned_record_missing" });
    }
  }
  if (!esmCompatibility) {
    issues.push({ code: "vite_esm_compatibility_contract_missing" });
  } else {
    const modules = Array.isArray(esmCompatibility.modules) ? esmCompatibility.modules : [];
    const expectedModules = esmCompatibilityModuleDefinitions();
    const expectedIds = expectedModules.map((entry) => entry.id);
    const expectedFunctionCount = expectedModules.reduce((total, entry) => (
      total + (Array.isArray(entry && entry.expectedFunctions) ? entry.expectedFunctions.length : 0)
    ), 0);
    if (esmCompatibility.owner !== "vite-shell-entry"
      || esmCompatibility.virtualModuleSource !== VITE_ESM_COMPATIBILITY_SOURCE) {
      issues.push({ code: "vite_esm_compatibility_owner_mismatch" });
    }
    if (Number(esmCompatibility.moduleCount) !== expectedIds.length
      || modules.length !== expectedIds.length
      || Number(esmCompatibility.expectedFunctionCount) !== expectedFunctionCount) {
      issues.push({ code: "vite_esm_compatibility_count_mismatch" });
    }
    if (JSON.stringify(modules.map((entry) => entry && entry.id)) !== JSON.stringify(expectedIds)) {
      issues.push({ code: "vite_esm_compatibility_order_mismatch" });
    }
    for (let index = 0; index < expectedModules.length; index += 1) {
      const expected = expectedModules[index];
      const actual = modules[index] || {};
      if (actual.source !== expected.source
        || actual.assetPath !== publicAssetPathFromSourcePath(expected.source)
        || String(actual.nativeSource || "") !== String(expected.nativeSource || "")
        || String(actual.importSource || "") !== String(expected.importSource || expected.source || "")
        || String(actual.compatibilityMode || "") !== String(expected.compatibilityMode || "classic-global-compat")
        || actual.globalName !== expected.globalName
        || actual.classicLoaderExcluded !== true
        || JSON.stringify(actual.expectedFunctions || []) !== JSON.stringify(expected.expectedFunctions || [])) {
        issues.push({ code: "vite_esm_compatibility_module_mismatch", id: expected.id });
        break;
      }
      if (!actual.hashPresent || !actual.sha256 || !Number(actual.bytes)) {
        issues.push({ code: "vite_esm_compatibility_module_hash_missing", id: expected.id });
        break;
      }
    }
    if (Number(esmCompatibility.hashCount) !== expectedIds.length) {
      issues.push({ code: "vite_esm_compatibility_hash_count_mismatch" });
    }
    const shardSources = Array.isArray(esmCompatibility.shards)
      ? esmCompatibility.shards.map((entry) => String(entry && entry.source || "")).filter(Boolean)
      : [];
    const shardChunkSources = esmCompatibilityChunks
      .map((chunk) => String(chunk && chunk.source || ""))
      .filter((source) => source.startsWith(VITE_ESM_COMPATIBILITY_SHARD_SOURCE_PREFIX));
    if (Number(esmCompatibility.shardCount) !== shardSources.length
      || !shardSources.length
      || JSON.stringify(shardChunkSources.slice().sort()) !== JSON.stringify(shardSources.slice().sort())) {
      issues.push({ code: "vite_esm_compatibility_shard_chunk_mismatch" });
    }
  }
  for (const asset of manifest.assets || []) {
    const fileName = outputPathForAsset(asset.path);
    if (!classicOutputFiles.has(fileName)) {
      issues.push({ code: "classic_shell_output_missing", asset: asset.path });
    }
  }
  for (const requiredFile of ["codex-mobile-shell-manifest.json"]) {
    if (!outputFiles.has(requiredFile)) issues.push({ code: "vite_output_file_missing", fileName: requiredFile });
  }
  for (const fileName of [entry && entry.fileName, ...deferredChunks.map((chunk) => chunk.fileName)].filter(Boolean)) {
    if (!outputFiles.has(fileName)) issues.push({ code: "vite_output_file_missing", fileName });
  }
  for (const fileName of (contract.viteEsmCompatibilityChunks || []).map((chunk) => chunk && chunk.fileName).filter(Boolean)) {
    if (!outputFiles.has(fileName)) issues.push({ code: "vite_output_file_missing", fileName });
  }
  for (const fileName of entryGroupChunks.map((chunk) => chunk.fileName).filter(Boolean)) {
    if (!outputFiles.has(fileName)) issues.push({ code: "vite_output_file_missing", fileName });
  }
  for (const fileName of (contract.viteSharedChunks || []).map((chunk) => chunk && chunk.fileName).filter(Boolean)) {
    if (!outputFiles.has(fileName)) issues.push({ code: "vite_output_file_missing", fileName });
  }
  return {
    ok: issues.length === 0,
    issues,
  };
}

export function buildViteShellBuildContract(manifest, bundle = {}, root = process.cwd()) {
  const chunks = chunkRecords(bundle, root);
  const viteEntry = chunks.find((chunk) => chunk.source === VITE_SHELL_ENTRY_SOURCE)
    || chunks.find((chunk) => chunk.isEntry && chunk.name === "vite-shell-entry")
    || chunks.find((chunk) => chunk.isEntry);
  const deferredChunks = chunks.filter((chunk) => chunk.source === VITE_DEFERRED_ENTRY_SOURCE);
  const esmCompatibilityEntryChunks = chunks.filter((chunk) => chunk.source === VITE_ESM_COMPATIBILITY_SOURCE);
  const viteOwnedAppBootstrapChunks = chunks.filter((chunk) => chunk.source === "public/app-bootstrap.js");
  const esmCompatibilityChunks = chunks.filter((chunk) => (
    chunk.source === VITE_ESM_COMPATIBILITY_SOURCE
      || String(chunk.source || "").startsWith(VITE_ESM_COMPATIBILITY_SHARD_SOURCE_PREFIX)
  ));
  const entryGroupChunks = chunks
    .filter((chunk) => String(chunk.source || "").startsWith(VITE_ENTRY_GROUP_SOURCE_PREFIX))
    .map((chunk) => {
      const groupId = sanitizeEntryGroupId(String(chunk.source || "").slice(VITE_ENTRY_GROUP_SOURCE_PREFIX.length));
      const group = (Array.isArray(manifest.entryGroups) ? manifest.entryGroups : [])
        .find((entryGroup) => sanitizeEntryGroupId(entryGroup && entryGroup.id) === groupId) || {};
      const assets = Array.isArray(group.assets) ? group.assets.slice() : [];
      const classicGlobalExports = classicGlobalExportsForAssets(manifest, assets);
      const classicAssetRecords = classicAssetRecordsForAssets(manifest, assets);
      const groupStartupGlobalContracts = startupGlobalContracts(manifest)
        .filter((entry) => assets.includes(entry.asset));
      return {
        ...chunk,
        groupId,
        phase: String(group.phase || ""),
        startupCritical: Boolean(group.startupCritical),
        chunkTarget: String(group.chunkTarget || ""),
        assets,
        assetCount: assets.length,
        classicAssetRecords,
        classicAssetHashCount: classicAssetRecords.filter((entry) => entry.sha256).length,
        classicAssetBytes: classicAssetRecords.reduce((total, entry) => total + (Number(entry.bytes) || 0), 0),
        classicGlobalExports,
        classicGlobalExportAssetCount: classicGlobalExports.length,
        classicGlobalExportCount: classicGlobalExports.reduce((total, entry) => (
          total + (Array.isArray(entry && entry.globals) ? entry.globals.length : 0)
        ), 0),
        startupGlobalContracts: groupStartupGlobalContracts,
      };
    })
    .sort((a, b) => a.groupId.localeCompare(b.groupId));
  const viteSharedChunks = importedChunkClosure(chunks, [
    viteEntry,
    ...esmCompatibilityChunks,
    ...deferredChunks,
    ...entryGroupChunks,
  ].filter(Boolean));
  const expectedEntryDynamicImportFiles = uniqueValues([
    ...esmCompatibilityEntryChunks.map((chunk) => chunk.fileName),
    ...viteOwnedAppBootstrapChunks.map((chunk) => chunk.fileName),
    ...deferredChunks.map((chunk) => chunk.fileName),
    ...entryGroupChunks.map((chunk) => chunk.fileName),
  ]);
  const actualEntryDynamicImportFiles = uniqueValues(viteEntry && Array.isArray(viteEntry.dynamicImports)
    ? viteEntry.dynamicImports
    : []);
  const expectedDynamicImportSet = new Set(expectedEntryDynamicImportFiles);
  const actualDynamicImportSet = new Set(actualEntryDynamicImportFiles);
  const entryDynamicImportGraph = {
    owner: "vite-shell-entry",
    actualFiles: actualEntryDynamicImportFiles,
    expectedFiles: expectedEntryDynamicImportFiles,
    missingFiles: expectedEntryDynamicImportFiles.filter((fileName) => !actualDynamicImportSet.has(fileName)),
    extraFiles: actualEntryDynamicImportFiles.filter((fileName) => !expectedDynamicImportSet.has(fileName)),
    esmCompatibilityFileCount: esmCompatibilityEntryChunks.length,
    viteOwnedFileCount: viteOwnedAppBootstrapChunks.length,
    deferredFileCount: deferredChunks.length,
    entryGroupFileCount: entryGroupChunks.length,
  };
  const classicShellAssets = assetOutputRecords(manifest);
  const classicShellScriptBlock = classicShellScriptBlockContract(manifest);
  const startupCompatibility = startupCompatibilityContract(manifest);
  const appPreviewClassicLoaderPlan = appPreviewClassicLoaderPlanContract(manifest);
  const esmCompatibility = esmCompatibilityContract(root);
  const outputFiles = [
    ...chunks.map((chunk) => chunk.fileName),
    ...classicShellAssets.map((asset) => asset.fileName),
    "codex-mobile-shell-manifest.json",
  ];
  const contract = {
    schemaVersion: VITE_SHELL_BUILD_CONTRACT_SCHEMA_VERSION,
    stage: "vite-shell-artifact-contract-v1",
    productionExecution: "classic-script-fallback",
    entryGroupImportOwner: "vite-shell-entry",
    entryDynamicImportGraph,
    entrySource: VITE_SHELL_ENTRY_SOURCE,
    deferredEntrySource: VITE_DEFERRED_ENTRY_SOURCE,
    classicFallback: {
      indexHtmlAsset: "/index.html",
      outputRoot: "shell-assets",
      indexScriptAssets: manifest.indexScriptAssets,
      entryGroups: manifest.entryGroups,
      classicGlobalExports: manifest.classicGlobalExports,
      startupGlobalContracts: manifest.startupGlobalContracts,
      scriptBlock: classicShellScriptBlock,
    },
    startupCompatibility,
    appPreviewClassicLoaderPlan,
    esmCompatibility,
    viteEntry: viteEntry || null,
    viteEsmCompatibilityChunks: esmCompatibilityChunks,
    viteOwnedAppBootstrapChunks,
    viteDeferredChunks: deferredChunks,
    viteEntryGroupChunks: entryGroupChunks,
    viteSharedChunks,
    classicShellAssets,
    outputFiles: [...new Set(outputFiles)].sort(),
  };
  contract.validation = validateViteShellBuildContract(contract, manifest);
  return contract;
}

export function createShellAssetGraphPlugin(options = {}) {
  const root = options.root || process.cwd();
  return {
    name: "codex-mobile-shell-asset-graph",
    generateBundle(_outputOptions, bundle) {
      const manifest = buildShellAssetManifest(root);
      if (!manifest.validation.ok) {
        const codes = manifest.validation.issues.map((issue) => issue.code).join(", ");
        throw new Error(`codex_mobile_shell_asset_graph_invalid: ${codes}`);
      }
      const viteBuild = buildViteShellBuildContract(manifest, bundle, root);
      if (!viteBuild.validation.ok) {
        const codes = viteBuild.validation.issues.map((issue) => issue.code).join(", ");
        throw new Error(`codex_mobile_vite_shell_build_contract_invalid: ${codes}`);
      }
      const outputManifest = {
        ...manifest,
        viteBuild,
      };
      for (const asset of manifest.assets) {
        const absolutePath = path.join(root, asset.sourcePath);
        const source = fs.readFileSync(absolutePath);
        this.emitFile({
          type: "asset",
          fileName: outputPathForAsset(asset.path),
          source,
        });
      }
      this.emitFile({
        type: "asset",
        fileName: "codex-mobile-shell-manifest.json",
        source: `${JSON.stringify(outputManifest, null, 2)}\n`,
      });
    },
  };
}

export function createShellEntryGroupVirtualModulePlugin(options = {}) {
  const root = options.root || process.cwd();
  return {
    name: "codex-mobile-shell-entry-group-virtual-modules",
    resolveId(id) {
      if (String(id || "") === VITE_ESM_COMPATIBILITY_SOURCE) {
        return `\0${VITE_ESM_COMPATIBILITY_SOURCE}`;
      }
      if (String(id || "").startsWith(VITE_ESM_COMPATIBILITY_SHARD_SOURCE_PREFIX)) {
        return `\0${id}`;
      }
      if (String(id || "") === VITE_ENTRY_GROUP_LOADER_SOURCE) {
        return `\0${VITE_ENTRY_GROUP_LOADER_SOURCE}`;
      }
      if (String(id || "").startsWith(VITE_ENTRY_GROUP_SOURCE_PREFIX)) {
        return `\0${id}`;
      }
      return null;
    },
    load(id) {
      const value = String(id || "");
      if (value === `\0${VITE_ESM_COMPATIBILITY_SOURCE}`) {
        return createEsmCompatibilityVirtualModuleSource(root);
      }
      const esmShardPrefix = `\0${VITE_ESM_COMPATIBILITY_SHARD_SOURCE_PREFIX}`;
      if (value.startsWith(esmShardPrefix)) {
        const source = value.slice(1);
        const shard = buildViteEsmCompatibilityShards(root)
          .find((entry) => entry.source === source);
        if (!shard) {
          throw new Error(`codex_mobile_vite_esm_compatibility_shard_missing:${source}`);
        }
        return createEsmCompatibilityShardVirtualModuleSource(root, shard.moduleDefinitions);
      }
      if (value === `\0${VITE_ENTRY_GROUP_LOADER_SOURCE}`) {
        const manifest = buildPublicShellManifest(root);
        const groups = (Array.isArray(manifest.entryGroups) ? manifest.entryGroups : [])
          .map((group) => sanitizeEntryGroupId(group && group.id))
          .filter(Boolean);
        const importLines = groups.map((groupId) => (
          `  ${JSON.stringify(groupId)}: () => import(${JSON.stringify(viteEntryGroupSourceId(groupId))}),`
        ));
        return [
          `export const codexMobileViteEntryGroupIds = ${JSON.stringify(groups, null, 2)};`,
          "const codexMobileViteEntryGroupLoaders = {",
          ...importLines,
          "};",
          "export function loadCodexMobileViteEntryGroups() {",
          "  const status = { expectedCount: codexMobileViteEntryGroupIds.length, imported: [], failed: [], ok: false };",
          "  globalThis.__CODEX_MOBILE_VITE_ENTRY_GROUP_IMPORT_STATUS__ = status;",
          "  const promise = Promise.all(codexMobileViteEntryGroupIds.map(async (groupId) => {",
          "    const load = codexMobileViteEntryGroupLoaders[groupId];",
          "    try {",
          "      const module = await load();",
          "      const payload = module && (module.codexMobileViteEntryGroup || module.default) || {};",
          "      status.imported.push(String(payload.id || groupId));",
          "    } catch (_) {",
          "      status.failed.push(groupId);",
          "    }",
          "  })).then(() => {",
          "    const registry = globalThis.__CODEX_MOBILE_VITE_ENTRY_GROUP_CHUNKS__ || {};",
          "    status.registryCount = Object.keys(registry).length;",
          "    status.ok = status.failed.length === 0",
          "      && status.imported.length === status.expectedCount",
          "      && status.registryCount === status.expectedCount;",
          "    return status;",
          "  });",
          "  globalThis.__CODEX_MOBILE_VITE_ENTRY_GROUP_IMPORT_PROMISE__ = promise;",
          "  return promise;",
          "}",
          "",
        ].join("\n");
      }
      const prefix = `\0${VITE_ENTRY_GROUP_SOURCE_PREFIX}`;
      if (!value.startsWith(prefix)) return null;
      const groupId = sanitizeEntryGroupId(value.slice(prefix.length));
      const manifest = buildPublicShellManifest(root);
      const group = (Array.isArray(manifest.entryGroups) ? manifest.entryGroups : [])
        .find((entry) => sanitizeEntryGroupId(entry && entry.id) === groupId);
      if (!group) {
        throw new Error(`codex_mobile_vite_entry_group_missing:${groupId}`);
      }
      const assets = Array.isArray(group.assets) ? group.assets.slice() : [];
      const classicGlobalExports = classicGlobalExportsForAssets(manifest, assets);
      const fullManifest = buildShellAssetManifest(root);
      const classicAssetRecords = classicAssetRecordsForAssets(fullManifest, assets);
      const payload = {
        id: group.id,
        phase: group.phase,
        startupCritical: Boolean(group.startupCritical),
        chunkTarget: group.chunkTarget,
        assets,
        assetCount: assets.length,
        classicAssetRecords,
        classicAssetHashCount: classicAssetRecords.filter((entry) => entry.sha256).length,
        classicAssetBytes: classicAssetRecords.reduce((total, entry) => total + (Number(entry.bytes) || 0), 0),
        classicGlobalExports,
        classicGlobalExportAssetCount: classicGlobalExports.length,
        classicGlobalExportCount: classicGlobalExports.reduce((total, entry) => (
          total + (Array.isArray(entry && entry.globals) ? entry.globals.length : 0)
        ), 0),
        startupGlobalContracts: startupGlobalContracts(manifest).filter((entry) => assets.includes(entry.asset)),
        shellCacheName: manifest.shellCacheName,
        clientBuildId: manifest.clientBuildId,
      };
      return [
        `export const codexMobileViteEntryGroup = ${JSON.stringify(payload, null, 2)};`,
        "const codexMobileViteEntryGroupRegistry = globalThis.__CODEX_MOBILE_VITE_ENTRY_GROUP_CHUNKS__ || {};",
        "codexMobileViteEntryGroupRegistry[codexMobileViteEntryGroup.id] = codexMobileViteEntryGroup;",
        "globalThis.__CODEX_MOBILE_VITE_ENTRY_GROUP_CHUNKS__ = codexMobileViteEntryGroupRegistry;",
        "export default codexMobileViteEntryGroup;",
        "",
      ].join("\n");
    },
  };
}
