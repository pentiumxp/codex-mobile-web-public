//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports);
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
var shell_asset_manifest_default = {
	schemaVersion: 4,
	generatedBy: "generate-frontend-shell-manifest",
	shellCacheName: "codex-mobile-shell-v625-ebf0a8218576",
	clientBuildId: "0.1.11|codex-mobile-shell-v625-ebf0a8218576",
	scriptAssets: [
		"/shell-asset-manifest.js",
		"/api-client.js",
		"/runtime-settings.js",
		"/draft-store.js",
		"/composer-runtime.js",
		"/markdown-renderer.js",
		"/viewport-metrics.js",
		"/conversation-scroll.js",
		"/image-compressor.js",
		"/plugin-embed.js",
		"/plugin-voice-input.js",
		"/home-ai-diagnostic-reporting.js",
		"/thread-diagnostic-events.js",
		"/frontend-runtime-health.js",
		"/thread-status-hints.js",
		"/thread-performance-metrics.js",
		"/thread-list-load-policy.js",
		"/thread-list-stable-order.js",
		"/thread-list-runtime.js",
		"/client-render-stability-guard.js",
		"/live-operation-dock-state.js",
		"/thread-detail-state.js",
		"/thread-detail-render-plan.js",
		"/thread-detail-merge-state.js",
		"/thread-detail-v4-merge-state.js",
		"/thread-detail-runtime.js",
		"/thread-detail-patch-plan.js",
		"/thread-detail-dom-patch.js",
		"/thread-detail-actions.js",
		"/thread-tile-actions.js",
		"/thread-tile-state.js",
		"/thread-tile-layout.js",
		"/thread-tile-runtime.js",
		"/build-refresh-policy.js",
		"/app-update-runtime.js",
		"/side-chat-runtime.js",
		"/media-preview-runtime.js",
		"/app-bootstrap.js",
		"/settings-runtime.js",
		"/modal-runtime.js",
		"/navigation-runtime.js",
		"/api-client-runtime.js",
		"/notification-ui-runtime.js",
		"/pane-layout-runtime.js",
		"/task-card-runtime.js",
		"/conversation-render-runtime.js",
		"/event-stream-runtime.js",
		"/composer-bridge-runtime.js",
		"/runtime-wiring-runtime.js",
		"/app-shell-runtime.js",
		"/app.js"
	],
	entryGroups: [
		{
			"id": "manifest",
			"phase": "startup-manifest",
			"startupCritical": true,
			"chunkTarget": "startup-manifest",
			"assets": ["/shell-asset-manifest.js"]
		},
		{
			"id": "foundation",
			"phase": "startup-prerequisite",
			"startupCritical": true,
			"chunkTarget": "startup-foundation",
			"assets": [
				"/api-client.js",
				"/runtime-settings.js",
				"/draft-store.js",
				"/composer-runtime.js",
				"/markdown-renderer.js",
				"/viewport-metrics.js",
				"/conversation-scroll.js",
				"/image-compressor.js",
				"/plugin-embed.js",
				"/plugin-voice-input.js",
				"/home-ai-diagnostic-reporting.js",
				"/thread-diagnostic-events.js",
				"/frontend-runtime-health.js",
				"/thread-status-hints.js",
				"/thread-performance-metrics.js",
				"/thread-list-load-policy.js",
				"/thread-list-stable-order.js"
			]
		},
		{
			"id": "feature-runtimes",
			"phase": "classic-runtime",
			"startupCritical": false,
			"chunkTarget": "deferred-feature-runtimes",
			"assets": [
				"/thread-list-runtime.js",
				"/client-render-stability-guard.js",
				"/live-operation-dock-state.js",
				"/thread-detail-state.js",
				"/thread-detail-render-plan.js",
				"/thread-detail-merge-state.js",
				"/thread-detail-v4-merge-state.js",
				"/thread-detail-runtime.js",
				"/thread-detail-patch-plan.js",
				"/thread-detail-dom-patch.js",
				"/thread-detail-actions.js",
				"/thread-tile-actions.js",
				"/thread-tile-state.js",
				"/thread-tile-layout.js",
				"/thread-tile-runtime.js",
				"/build-refresh-policy.js",
				"/app-update-runtime.js",
				"/side-chat-runtime.js",
				"/media-preview-runtime.js"
			]
		},
		{
			"id": "bootstrap-state",
			"phase": "startup-critical",
			"startupCritical": true,
			"chunkTarget": "startup-bootstrap",
			"assets": ["/app-bootstrap.js"]
		},
		{
			"id": "shell-services",
			"phase": "classic-runtime",
			"startupCritical": false,
			"chunkTarget": "deferred-shell-services",
			"assets": [
				"/settings-runtime.js",
				"/modal-runtime.js",
				"/navigation-runtime.js",
				"/api-client-runtime.js",
				"/notification-ui-runtime.js",
				"/pane-layout-runtime.js",
				"/task-card-runtime.js",
				"/conversation-render-runtime.js",
				"/event-stream-runtime.js",
				"/composer-bridge-runtime.js"
			]
		},
		{
			"id": "app-entry",
			"phase": "startup-critical",
			"startupCritical": true,
			"chunkTarget": "startup-app-shell",
			"assets": [
				"/runtime-wiring-runtime.js",
				"/app-shell-runtime.js",
				"/app.js"
			]
		}
	],
	classicGlobalExports: [
		{
			"asset": "/api-client.js",
			"globals": ["CodexApiClient"]
		},
		{
			"asset": "/runtime-settings.js",
			"globals": ["CodexRuntimeSettings"]
		},
		{
			"asset": "/draft-store.js",
			"globals": ["CodexDraftStore"]
		},
		{
			"asset": "/composer-runtime.js",
			"globals": ["CodexComposerRuntime"]
		},
		{
			"asset": "/markdown-renderer.js",
			"globals": ["CodexMarkdownRenderer"]
		},
		{
			"asset": "/viewport-metrics.js",
			"globals": ["CodexViewportMetrics"]
		},
		{
			"asset": "/conversation-scroll.js",
			"globals": ["CodexConversationScroll"]
		},
		{
			"asset": "/image-compressor.js",
			"globals": ["CodexImageCompressor"]
		},
		{
			"asset": "/plugin-embed.js",
			"globals": ["CodexPluginEmbed"]
		},
		{
			"asset": "/plugin-voice-input.js",
			"globals": ["CodexPluginVoiceInput"]
		},
		{
			"asset": "/home-ai-diagnostic-reporting.js",
			"globals": ["CodexHomeAiDiagnosticReporting"]
		},
		{
			"asset": "/thread-diagnostic-events.js",
			"globals": ["CodexThreadDiagnosticEvents"]
		},
		{
			"asset": "/frontend-runtime-health.js",
			"globals": ["CodexFrontendRuntimeHealth"]
		},
		{
			"asset": "/thread-status-hints.js",
			"globals": ["CodexThreadStatusHints"]
		},
		{
			"asset": "/thread-performance-metrics.js",
			"globals": ["CodexThreadPerformanceMetrics"]
		},
		{
			"asset": "/thread-list-load-policy.js",
			"globals": ["CodexThreadListLoadPolicy"]
		},
		{
			"asset": "/thread-list-stable-order.js",
			"globals": ["CodexThreadListStableOrder"]
		},
		{
			"asset": "/thread-list-runtime.js",
			"globals": ["CodexThreadListRuntime"]
		},
		{
			"asset": "/client-render-stability-guard.js",
			"globals": ["CodexClientRenderStabilityGuard"]
		},
		{
			"asset": "/live-operation-dock-state.js",
			"globals": ["CodexLiveOperationDockState"]
		},
		{
			"asset": "/thread-detail-state.js",
			"globals": ["CodexThreadDetailState"]
		},
		{
			"asset": "/thread-detail-render-plan.js",
			"globals": ["CodexThreadDetailRenderPlan"]
		},
		{
			"asset": "/thread-detail-merge-state.js",
			"globals": ["CodexThreadDetailMergeState"]
		},
		{
			"asset": "/thread-detail-v4-merge-state.js",
			"globals": ["CodexThreadDetailV4MergeState"]
		},
		{
			"asset": "/thread-detail-runtime.js",
			"globals": ["CodexThreadDetailRuntime"]
		},
		{
			"asset": "/thread-detail-patch-plan.js",
			"globals": ["CodexThreadDetailPatchPlan"]
		},
		{
			"asset": "/thread-detail-dom-patch.js",
			"globals": ["CodexThreadDetailDomPatch"]
		},
		{
			"asset": "/thread-detail-actions.js",
			"globals": ["CodexThreadDetailActions"]
		},
		{
			"asset": "/thread-tile-actions.js",
			"globals": ["CodexThreadTileActions"]
		},
		{
			"asset": "/thread-tile-state.js",
			"globals": ["CodexThreadTileState"]
		},
		{
			"asset": "/thread-tile-layout.js",
			"globals": ["CodexThreadTileLayout"]
		},
		{
			"asset": "/thread-tile-runtime.js",
			"globals": ["CodexThreadTileRuntime"]
		},
		{
			"asset": "/build-refresh-policy.js",
			"globals": ["CodexBuildRefreshPolicy"]
		},
		{
			"asset": "/app-update-runtime.js",
			"globals": ["CodexAppUpdateRuntime"]
		},
		{
			"asset": "/side-chat-runtime.js",
			"globals": ["CodexSideChatRuntime"]
		},
		{
			"asset": "/media-preview-runtime.js",
			"globals": ["CodexMediaPreviewRuntime"]
		},
		{
			"asset": "/app-bootstrap.js",
			"globals": [
				"$",
				"ANDROID_BACK_SIDEBAR_BASE",
				"ANDROID_BACK_SIDEBAR_STATE",
				"ANDROID_BACK_SIDEBAR_TOP",
				"ANDROID_SIDEBAR_EDGE_SWIPE_PX",
				"AUTOMATIC_CONVERSATION_REFRESH_SOURCES",
				"AUTO_TURN_RECOVERY_COOLDOWN_MS",
				"CLIENT_BUILD_ID",
				"CODEX_PROFILE_SWITCH_STAGES",
				"COMPOSER_INTENT_BODY_MAX_CHARS",
				"CONTEXT_COMPACTION_COMPLETE_NOTICE",
				"CONTEXT_COMPACTION_PENDING_NOTICE",
				"CONVERSATION_SCROLL_INTENT_MS",
				"CodexAppBootstrap",
				"DRAFT_SAVE_DEBOUNCE_MS",
				"EMPTY_DETAIL_HISTORY_RECOVERY_COOLDOWN_MS",
				"FILE_PREVIEW_SWIPE_CLOSE_MIN_PX",
				"FONT_SIZE_VALUES",
				"GITHUB_LINK_PREVIEW_TIMEOUT_MS",
				"HEAVY_VISUAL_RECOVERY_MIN_INTERVAL_MS",
				"HIDDEN_SERVER_REQUEST_METHODS",
				"HOST_EMBED_SPLIT_FRAME_MIN_PX",
				"HOST_EMBED_SPLIT_LEFT_MIN_PX",
				"HOST_EMBED_SPLIT_VIEWPORT_MIN_PX",
				"IMAGE_DIAGNOSTICS_ENABLED",
				"IMAGE_PREVIEW_MAX_SCALE",
				"IMAGE_PREVIEW_MIN_SCALE",
				"IMAGE_PREVIEW_ZOOM_STEP",
				"INITIAL_PLUGIN_EMBED",
				"INITIAL_PLUGIN_LAUNCH_KEY",
				"LIVE_OPERATION_BUBBLE_MIN_VISIBLE_MS",
				"LONG_RECEIPT_SCROLL_CHARS",
				"MAX_COMMAND_OUTPUT_CHARS",
				"MAX_EXPANDED_VISIBLE_TURNS",
				"MAX_LIVE_TEXT_CHARS",
				"MAX_RAW_THREAD_VISIBLE_ITEMS_PER_TURN",
				"MAX_RAW_THREAD_VISIBLE_TURNS",
				"MAX_VISIBLE_TURNS",
				"MENU_OVERLAY_MEDIA",
				"MERMAID_MAX_SCALE",
				"MERMAID_MIN_SCALE",
				"MERMAID_SCRIPT_URL",
				"MERMAID_ZOOM_STEP",
				"OPERATIONAL_ITEM_TYPES",
				"PAGE_REFRESH_CHECK_INTERVAL_MS",
				"PAGE_REFRESH_MIN_CHECK_INTERVAL_MS",
				"PAGE_SHELL_ASSETS",
				"PERF_EVENT_THROTTLE_MS",
				"PERF_RENDER_REPORT_MIN_MS",
				"PERF_SLOW_RENDER_REPORT_MS",
				"PLUGIN_EMBED_BACK_EDGE_SWIPE_PX",
				"PLUGIN_EMBED_BACK_RECENT_SCROLL_SUPPRESS_MS",
				"PLUGIN_EMBED_BACK_SWIPE_HORIZONTAL_RATIO",
				"PLUGIN_EMBED_BACK_SWIPE_MIN_PX",
				"PLUGIN_VOICE_INPUT_LONG_PRESS_MS",
				"PRIMARY_SHELL_CONFLICT_EVIDENCE_MS",
				"PROTECTED_IMAGE_PLACEHOLDER_SRC",
				"PUBLIC_CONFIG_RETRY_DELAYS_MS",
				"PUBLIC_CONFIG_TIMEOUT_MS",
				"PUBLIC_PR_REVIEW_THREAD_TITLE",
				"RUNNING_THREAD_HINT_STALE_MS",
				"SIDEBAR_EDGE_OPEN_MIN_PX",
				"SIDEBAR_EDGE_OPEN_RATIO",
				"SIDEBAR_EDGE_SWIPE_PX",
				"SIDE_CHAT_DRAFT_MAX_CHARS",
				"SIDE_CHAT_DRAFT_SAVE_DEBOUNCE_MS",
				"STATUS_EVENT_FRESHNESS_TOLERANCE_MS",
				"STORAGE_CODEX_FAST_MODE",
				"STORAGE_COMPOSER_INTENT_DRAFTS",
				"STORAGE_CONTINUATION_JOB",
				"STORAGE_DISMISSED_ROLLOUT_WARNINGS",
				"STORAGE_FONT_SIZE",
				"STORAGE_LEGACY_THREAD_TILE_MODE",
				"STORAGE_PUBLIC_PR_PROMPT",
				"STORAGE_RATE_LIMITS",
				"STORAGE_RATE_LIMITS_BY_MODEL",
				"STORAGE_RESTART_AUTO_RECOVER_THREADS",
				"STORAGE_RUNNING_THREAD_HINTED_AT",
				"STORAGE_RUNNING_THREAD_IDS",
				"STORAGE_TASK_CARD_DRAFT_STATES",
				"STORAGE_THREAD_DISPLAY_MODE",
				"STORAGE_THREAD_ID",
				"STORAGE_THREAD_VIEWED_AT",
				"STORAGE_UNREAD_THREAD_IDS",
				"SUBAGENT_EDGE_SWIPE_MAX_PX",
				"SUBAGENT_EDGE_SWIPE_PX",
				"SUBAGENT_EDGE_SWIPE_RATIO",
				"SUBAGENT_SWIPE_MIN_PX",
				"SUBAGENT_WHEEL_SWIPE_MIN_PX",
				"SUBMITTED_PROCESSING_HINT_STALE_MS",
				"TABLET_SPLIT_MEDIA",
				"THEME_VALUES",
				"THREAD_GOAL_COMMAND_PREFIX",
				"THREAD_GOAL_MENTION_PATTERN",
				"THREAD_HISTORY_TOP_LOAD_PX",
				"THREAD_LIST_DEFERRED_FALLBACK_DELAY_MS",
				"THREAD_LIST_DEFERRED_FALLBACK_RETRY_MS",
				"THREAD_LIST_PAGE_LIMIT",
				"THREAD_LIST_RUNTIME_STALL_H2_MS",
				"THREAD_LIST_RUNTIME_STALL_MIN_MS",
				"THREAD_LIST_RUNTIME_STALL_REPORT_INTERVAL_MS",
				"THREAD_LIST_SLOW_PATH_MS",
				"THREAD_LOAD_STALL_MS",
				"THREAD_TASK_CARD_AUTONOMOUS_MENTION_PATTERN",
				"THREAD_TASK_CARD_BODY_MAX_CHARS",
				"THREAD_TASK_CARD_COMMAND_PREFIX",
				"THREAD_TASK_CARD_DRAFT_CREATE_MAX_ATTEMPTS",
				"THREAD_TASK_CARD_DRAFT_CREATE_STALE_MS",
				"THREAD_TASK_CARD_DRAFT_TAG",
				"THREAD_TASK_CARD_LEGACY_COMMAND_PREFIX",
				"THREAD_TASK_CARD_MENTION_PATTERN",
				"THREAD_TASK_CARD_REQUEST_TAG",
				"THREAD_TILE_DETAIL_LOAD_QUEUE_DRAIN_MS",
				"THREAD_TILE_REFRESH_INTERVAL_MS",
				"THREAD_TILE_REFRESH_MIN_INTERVAL_MS",
				"THREAD_TILE_SETTINGS_SAVE_DEBOUNCE_MS",
				"THREAD_TILE_USER_MAX_PANES",
				"USER_INPUT_REQUEST_METHODS",
				"apiClient",
				"appBootstrapGlobalRoot",
				"appUpdateRuntime",
				"appUpdateRuntimeApi",
				"buildRefreshPolicy",
				"classicGlobalBindingNamesFromManifest",
				"clientRenderStabilityGuard",
				"composerRuntime",
				"composerRuntimeApi",
				"conversationScroll",
				"createAppBootstrapRuntime",
				"draftStore",
				"fetchJsonWithTimeout",
				"fetchPublicConfigWithRetry",
				"frontendRuntimeHealthApi",
				"hasStartupThreadOpenIntent",
				"homeAiDiagnosticReportingApi",
				"imageCompressor",
				"initialPluginLaunchKeyFromUrl",
				"installClassicGlobalBindings",
				"liveOperationDockPolicy",
				"loadJsonStorage",
				"loadNumberMapStorage",
				"loadStringSetStorage",
				"mediaPreviewRuntimeApi",
				"normalizeFsPath",
				"planThreadOpenCacheReuse",
				"pluginEmbedApi",
				"pluginVoiceInputApi",
				"postStartupStage",
				"readShellManifest",
				"requireAppUpdateRuntime",
				"requireThreadDetailRuntime",
				"runtimeSettings",
				"setAuthKey",
				"shellManifestList",
				"sideChatRuntimeApi",
				"state",
				"threadDetailActionsApi",
				"threadDetailDomPatchApi",
				"threadDetailMergeStateApi",
				"threadDetailPatchPlanApi",
				"threadDetailRenderPlanApi",
				"threadDetailRuntime",
				"threadDetailRuntimeApi",
				"threadDetailStateApi",
				"threadDetailV4MergeStateApi",
				"threadDiagnosticEventsApi",
				"threadHasReusableLoadedDetailState",
				"threadListLoadPolicy",
				"threadListRuntime",
				"threadListStableOrderPolicy",
				"threadListSummaryFromDetailThread",
				"threadPerformanceMetrics",
				"threadStatusHintPolicy",
				"threadTileActionsApi",
				"threadTileLayoutPolicy",
				"threadTileRuntime",
				"threadTileRuntimeApi",
				"threadTileStatePolicy",
				"viewportMetrics"
			]
		},
		{
			"asset": "/settings-runtime.js",
			"globals": ["CodexSettingsRuntime"]
		},
		{
			"asset": "/modal-runtime.js",
			"globals": ["CodexModalRuntime"]
		},
		{
			"asset": "/navigation-runtime.js",
			"globals": ["CodexNavigationRuntime"]
		},
		{
			"asset": "/api-client-runtime.js",
			"globals": ["CodexApiClientRuntime", "CodexFrontendLog"]
		},
		{
			"asset": "/notification-ui-runtime.js",
			"globals": ["CodexNotificationUiRuntime"]
		},
		{
			"asset": "/pane-layout-runtime.js",
			"globals": ["CodexPaneLayoutRuntime"]
		},
		{
			"asset": "/task-card-runtime.js",
			"globals": ["CodexTaskCardRuntime"]
		},
		{
			"asset": "/conversation-render-runtime.js",
			"globals": ["CodexConversationRenderRuntime"]
		},
		{
			"asset": "/event-stream-runtime.js",
			"globals": ["CodexEventStreamRuntime"]
		},
		{
			"asset": "/composer-bridge-runtime.js",
			"globals": ["CodexComposerBridgeRuntime"]
		},
		{
			"asset": "/runtime-wiring-runtime.js",
			"globals": ["CodexRuntimeWiringRuntime"]
		},
		{
			"asset": "/app-shell-runtime.js",
			"globals": ["CodexAppShellRuntime"]
		},
		{
			"asset": "/app.js",
			"globals": ["CodexMobileAppEntry"]
		}
	],
	startupGlobalContracts: [
		{
			"name": "$",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "ANDROID_BACK_SIDEBAR_BASE",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "ANDROID_BACK_SIDEBAR_STATE",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "ANDROID_BACK_SIDEBAR_TOP",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "ANDROID_SIDEBAR_EDGE_SWIPE_PX",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "apiClient",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "appBootstrapGlobalRoot",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "appUpdateRuntime",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "appUpdateRuntimeApi",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "AUTO_TURN_RECOVERY_COOLDOWN_MS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "AUTOMATIC_CONVERSATION_REFRESH_SOURCES",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "buildRefreshPolicy",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "classicGlobalBindingNamesFromManifest",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "CLIENT_BUILD_ID",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "clientRenderStabilityGuard",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "CODEX_PROFILE_SWITCH_STAGES",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "CodexApiClient",
			"asset": "/api-client.js",
			"groupId": "foundation",
			"startupCritical": true,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexAppShellRuntime",
			"asset": "/app-shell-runtime.js",
			"groupId": "app-entry",
			"startupCritical": true,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexAppUpdateRuntime",
			"asset": "/app-update-runtime.js",
			"groupId": "feature-runtimes",
			"startupCritical": false,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexClientRenderStabilityGuard",
			"asset": "/client-render-stability-guard.js",
			"groupId": "feature-runtimes",
			"startupCritical": false,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexComposerRuntime",
			"asset": "/composer-runtime.js",
			"groupId": "foundation",
			"startupCritical": true,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexDraftStore",
			"asset": "/draft-store.js",
			"groupId": "foundation",
			"startupCritical": true,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexFrontendRuntimeHealth",
			"asset": "/frontend-runtime-health.js",
			"groupId": "foundation",
			"startupCritical": true,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexHomeAiDiagnosticReporting",
			"asset": "/home-ai-diagnostic-reporting.js",
			"groupId": "foundation",
			"startupCritical": true,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexLiveOperationDockState",
			"asset": "/live-operation-dock-state.js",
			"groupId": "feature-runtimes",
			"startupCritical": false,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexMediaPreviewRuntime",
			"asset": "/media-preview-runtime.js",
			"groupId": "feature-runtimes",
			"startupCritical": false,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexRuntimeWiringRuntime",
			"asset": "/runtime-wiring-runtime.js",
			"groupId": "app-entry",
			"startupCritical": true,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexSideChatRuntime",
			"asset": "/side-chat-runtime.js",
			"groupId": "feature-runtimes",
			"startupCritical": false,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexThreadDetailActions",
			"asset": "/thread-detail-actions.js",
			"groupId": "feature-runtimes",
			"startupCritical": false,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexThreadDetailDomPatch",
			"asset": "/thread-detail-dom-patch.js",
			"groupId": "feature-runtimes",
			"startupCritical": false,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexThreadDetailMergeState",
			"asset": "/thread-detail-merge-state.js",
			"groupId": "feature-runtimes",
			"startupCritical": false,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexThreadDetailPatchPlan",
			"asset": "/thread-detail-patch-plan.js",
			"groupId": "feature-runtimes",
			"startupCritical": false,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexThreadDetailRenderPlan",
			"asset": "/thread-detail-render-plan.js",
			"groupId": "feature-runtimes",
			"startupCritical": false,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexThreadDetailRuntime",
			"asset": "/thread-detail-runtime.js",
			"groupId": "feature-runtimes",
			"startupCritical": false,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexThreadDetailState",
			"asset": "/thread-detail-state.js",
			"groupId": "feature-runtimes",
			"startupCritical": false,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexThreadDetailV4MergeState",
			"asset": "/thread-detail-v4-merge-state.js",
			"groupId": "feature-runtimes",
			"startupCritical": false,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexThreadDiagnosticEvents",
			"asset": "/thread-diagnostic-events.js",
			"groupId": "foundation",
			"startupCritical": true,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexThreadListLoadPolicy",
			"asset": "/thread-list-load-policy.js",
			"groupId": "foundation",
			"startupCritical": true,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexThreadListRuntime",
			"asset": "/thread-list-runtime.js",
			"groupId": "feature-runtimes",
			"startupCritical": false,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexThreadListStableOrder",
			"asset": "/thread-list-stable-order.js",
			"groupId": "foundation",
			"startupCritical": true,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexThreadPerformanceMetrics",
			"asset": "/thread-performance-metrics.js",
			"groupId": "foundation",
			"startupCritical": true,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexThreadStatusHints",
			"asset": "/thread-status-hints.js",
			"groupId": "foundation",
			"startupCritical": true,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexThreadTileActions",
			"asset": "/thread-tile-actions.js",
			"groupId": "feature-runtimes",
			"startupCritical": false,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexThreadTileLayout",
			"asset": "/thread-tile-layout.js",
			"groupId": "feature-runtimes",
			"startupCritical": false,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexThreadTileRuntime",
			"asset": "/thread-tile-runtime.js",
			"groupId": "feature-runtimes",
			"startupCritical": false,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "CodexThreadTileState",
			"asset": "/thread-tile-state.js",
			"groupId": "feature-runtimes",
			"startupCritical": false,
			"source": "startup-window-guard",
			"present": true
		},
		{
			"name": "COMPOSER_INTENT_BODY_MAX_CHARS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "composerRuntime",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "composerRuntimeApi",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "CONTEXT_COMPACTION_COMPLETE_NOTICE",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "CONTEXT_COMPACTION_PENDING_NOTICE",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "CONVERSATION_SCROLL_INTENT_MS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "conversationScroll",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "createAppBootstrapRuntime",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "DRAFT_SAVE_DEBOUNCE_MS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "draftStore",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "EMPTY_DETAIL_HISTORY_RECOVERY_COOLDOWN_MS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "fetchJsonWithTimeout",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "fetchPublicConfigWithRetry",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "FILE_PREVIEW_SWIPE_CLOSE_MIN_PX",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "FONT_SIZE_VALUES",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "frontendRuntimeHealthApi",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "GITHUB_LINK_PREVIEW_TIMEOUT_MS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "hasStartupThreadOpenIntent",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "HEAVY_VISUAL_RECOVERY_MIN_INTERVAL_MS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "HIDDEN_SERVER_REQUEST_METHODS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "homeAiDiagnosticReportingApi",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "HOST_EMBED_SPLIT_FRAME_MIN_PX",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "HOST_EMBED_SPLIT_LEFT_MIN_PX",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "HOST_EMBED_SPLIT_VIEWPORT_MIN_PX",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "IMAGE_DIAGNOSTICS_ENABLED",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "IMAGE_PREVIEW_MAX_SCALE",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "IMAGE_PREVIEW_MIN_SCALE",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "IMAGE_PREVIEW_ZOOM_STEP",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "imageCompressor",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "INITIAL_PLUGIN_EMBED",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "INITIAL_PLUGIN_LAUNCH_KEY",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "initialPluginLaunchKeyFromUrl",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "installClassicGlobalBindings",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "LIVE_OPERATION_BUBBLE_MIN_VISIBLE_MS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "liveOperationDockPolicy",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "loadJsonStorage",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "loadNumberMapStorage",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "loadStringSetStorage",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "LONG_RECEIPT_SCROLL_CHARS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "MAX_COMMAND_OUTPUT_CHARS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "MAX_EXPANDED_VISIBLE_TURNS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "MAX_LIVE_TEXT_CHARS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "MAX_RAW_THREAD_VISIBLE_ITEMS_PER_TURN",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "MAX_RAW_THREAD_VISIBLE_TURNS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "MAX_VISIBLE_TURNS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "mediaPreviewRuntimeApi",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "MENU_OVERLAY_MEDIA",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "MERMAID_MAX_SCALE",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "MERMAID_MIN_SCALE",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "MERMAID_SCRIPT_URL",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "MERMAID_ZOOM_STEP",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "normalizeFsPath",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "OPERATIONAL_ITEM_TYPES",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "PAGE_REFRESH_CHECK_INTERVAL_MS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "PAGE_REFRESH_MIN_CHECK_INTERVAL_MS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "PAGE_SHELL_ASSETS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "PERF_EVENT_THROTTLE_MS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "PERF_RENDER_REPORT_MIN_MS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "PERF_SLOW_RENDER_REPORT_MS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "planThreadOpenCacheReuse",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "PLUGIN_EMBED_BACK_EDGE_SWIPE_PX",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "PLUGIN_EMBED_BACK_RECENT_SCROLL_SUPPRESS_MS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "PLUGIN_EMBED_BACK_SWIPE_HORIZONTAL_RATIO",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "PLUGIN_EMBED_BACK_SWIPE_MIN_PX",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "PLUGIN_VOICE_INPUT_LONG_PRESS_MS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "pluginEmbedApi",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "pluginVoiceInputApi",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "postStartupStage",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "PRIMARY_SHELL_CONFLICT_EVIDENCE_MS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "PROTECTED_IMAGE_PLACEHOLDER_SRC",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "PUBLIC_CONFIG_RETRY_DELAYS_MS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "PUBLIC_CONFIG_TIMEOUT_MS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "PUBLIC_PR_REVIEW_THREAD_TITLE",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "readShellManifest",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "requireAppUpdateRuntime",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "requireThreadDetailRuntime",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "RUNNING_THREAD_HINT_STALE_MS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "runtimeSettings",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "setAuthKey",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "shellManifestList",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "SIDE_CHAT_DRAFT_MAX_CHARS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "SIDE_CHAT_DRAFT_SAVE_DEBOUNCE_MS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "SIDEBAR_EDGE_OPEN_MIN_PX",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "SIDEBAR_EDGE_OPEN_RATIO",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "SIDEBAR_EDGE_SWIPE_PX",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "sideChatRuntimeApi",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "state",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "STATUS_EVENT_FRESHNESS_TOLERANCE_MS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "STORAGE_CODEX_FAST_MODE",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "STORAGE_COMPOSER_INTENT_DRAFTS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "STORAGE_CONTINUATION_JOB",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "STORAGE_DISMISSED_ROLLOUT_WARNINGS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "STORAGE_FONT_SIZE",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "STORAGE_LEGACY_THREAD_TILE_MODE",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "STORAGE_PUBLIC_PR_PROMPT",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "STORAGE_RATE_LIMITS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "STORAGE_RATE_LIMITS_BY_MODEL",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "STORAGE_RESTART_AUTO_RECOVER_THREADS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "STORAGE_RUNNING_THREAD_HINTED_AT",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "STORAGE_RUNNING_THREAD_IDS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "STORAGE_TASK_CARD_DRAFT_STATES",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "STORAGE_THREAD_DISPLAY_MODE",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "STORAGE_THREAD_ID",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "STORAGE_THREAD_VIEWED_AT",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "STORAGE_UNREAD_THREAD_IDS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "SUBAGENT_EDGE_SWIPE_MAX_PX",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "SUBAGENT_EDGE_SWIPE_PX",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "SUBAGENT_EDGE_SWIPE_RATIO",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "SUBAGENT_SWIPE_MIN_PX",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "SUBAGENT_WHEEL_SWIPE_MIN_PX",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "SUBMITTED_PROCESSING_HINT_STALE_MS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "TABLET_SPLIT_MEDIA",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "THEME_VALUES",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "THREAD_GOAL_COMMAND_PREFIX",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "THREAD_GOAL_MENTION_PATTERN",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "THREAD_HISTORY_TOP_LOAD_PX",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "THREAD_LIST_DEFERRED_FALLBACK_DELAY_MS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "THREAD_LIST_DEFERRED_FALLBACK_RETRY_MS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "THREAD_LIST_PAGE_LIMIT",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "THREAD_LIST_RUNTIME_STALL_H2_MS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "THREAD_LIST_RUNTIME_STALL_MIN_MS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "THREAD_LIST_RUNTIME_STALL_REPORT_INTERVAL_MS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "THREAD_LIST_SLOW_PATH_MS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "THREAD_LOAD_STALL_MS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "THREAD_TASK_CARD_AUTONOMOUS_MENTION_PATTERN",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "THREAD_TASK_CARD_BODY_MAX_CHARS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "THREAD_TASK_CARD_COMMAND_PREFIX",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "THREAD_TASK_CARD_DRAFT_CREATE_MAX_ATTEMPTS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "THREAD_TASK_CARD_DRAFT_CREATE_STALE_MS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "THREAD_TASK_CARD_DRAFT_TAG",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "THREAD_TASK_CARD_LEGACY_COMMAND_PREFIX",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "THREAD_TASK_CARD_MENTION_PATTERN",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "THREAD_TASK_CARD_REQUEST_TAG",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "THREAD_TILE_DETAIL_LOAD_QUEUE_DRAIN_MS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "THREAD_TILE_REFRESH_INTERVAL_MS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "THREAD_TILE_REFRESH_MIN_INTERVAL_MS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "THREAD_TILE_SETTINGS_SAVE_DEBOUNCE_MS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "THREAD_TILE_USER_MAX_PANES",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "threadDetailActionsApi",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "threadDetailDomPatchApi",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "threadDetailMergeStateApi",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "threadDetailPatchPlanApi",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "threadDetailRenderPlanApi",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "threadDetailRuntime",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "threadDetailRuntimeApi",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "threadDetailStateApi",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "threadDetailV4MergeStateApi",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "threadDiagnosticEventsApi",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "threadHasReusableLoadedDetailState",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "threadListLoadPolicy",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "threadListRuntime",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "threadListStableOrderPolicy",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "threadListSummaryFromDetailThread",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "threadPerformanceMetrics",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "threadStatusHintPolicy",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "threadTileActionsApi",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "threadTileLayoutPolicy",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "threadTileRuntime",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "threadTileRuntimeApi",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "threadTileStatePolicy",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "USER_INPUT_REQUEST_METHODS",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		},
		{
			"name": "viewportMetrics",
			"asset": "/app-bootstrap.js",
			"groupId": "bootstrap-state",
			"startupCritical": true,
			"source": "app-bootstrap-script-global",
			"present": true
		}
	],
	linkAssets: [
		"/manifest.json",
		"/icons/icon.svg",
		"/icons/apple-touch-icon.png",
		"/styles.css"
	],
	iconAssets: [
		"/icons/icon.svg",
		"/icons/apple-touch-icon.png",
		"/icons/icon-192.png",
		"/icons/icon-512.png"
	],
	precacheAssets: [
		"/",
		"/index.html",
		"/manifest.json",
		"/icons/icon.svg",
		"/icons/apple-touch-icon.png",
		"/styles.css",
		"/icons/icon-192.png",
		"/icons/icon-512.png",
		"/shell-asset-manifest.js",
		"/api-client.js",
		"/runtime-settings.js",
		"/draft-store.js",
		"/composer-runtime.js",
		"/markdown-renderer.js",
		"/viewport-metrics.js",
		"/conversation-scroll.js",
		"/image-compressor.js",
		"/plugin-embed.js",
		"/plugin-voice-input.js",
		"/home-ai-diagnostic-reporting.js",
		"/thread-diagnostic-events.js",
		"/frontend-runtime-health.js",
		"/thread-status-hints.js",
		"/thread-performance-metrics.js",
		"/thread-list-load-policy.js",
		"/thread-list-stable-order.js",
		"/thread-list-runtime.js",
		"/client-render-stability-guard.js",
		"/live-operation-dock-state.js",
		"/thread-detail-state.js",
		"/thread-detail-render-plan.js",
		"/thread-detail-merge-state.js",
		"/thread-detail-v4-merge-state.js",
		"/thread-detail-runtime.js",
		"/thread-detail-patch-plan.js",
		"/thread-detail-dom-patch.js",
		"/thread-detail-actions.js",
		"/thread-tile-actions.js",
		"/thread-tile-state.js",
		"/thread-tile-layout.js",
		"/thread-tile-runtime.js",
		"/build-refresh-policy.js",
		"/app-update-runtime.js",
		"/side-chat-runtime.js",
		"/media-preview-runtime.js",
		"/app-bootstrap.js",
		"/settings-runtime.js",
		"/modal-runtime.js",
		"/navigation-runtime.js",
		"/api-client-runtime.js",
		"/notification-ui-runtime.js",
		"/pane-layout-runtime.js",
		"/task-card-runtime.js",
		"/conversation-render-runtime.js",
		"/event-stream-runtime.js",
		"/composer-bridge-runtime.js",
		"/runtime-wiring-runtime.js",
		"/app-shell-runtime.js",
		"/app.js",
		"/shell-asset-manifest.json"
	],
	pageShellAssets: [
		"/",
		"/index.html",
		"/manifest.json",
		"/icons/icon.svg",
		"/icons/apple-touch-icon.png",
		"/styles.css",
		"/icons/icon-192.png",
		"/icons/icon-512.png",
		"/shell-asset-manifest.js",
		"/api-client.js",
		"/runtime-settings.js",
		"/draft-store.js",
		"/composer-runtime.js",
		"/markdown-renderer.js",
		"/viewport-metrics.js",
		"/conversation-scroll.js",
		"/image-compressor.js",
		"/plugin-embed.js",
		"/plugin-voice-input.js",
		"/home-ai-diagnostic-reporting.js",
		"/thread-diagnostic-events.js",
		"/frontend-runtime-health.js",
		"/thread-status-hints.js",
		"/thread-performance-metrics.js",
		"/thread-list-load-policy.js",
		"/thread-list-stable-order.js",
		"/thread-list-runtime.js",
		"/client-render-stability-guard.js",
		"/live-operation-dock-state.js",
		"/thread-detail-state.js",
		"/thread-detail-render-plan.js",
		"/thread-detail-merge-state.js",
		"/thread-detail-v4-merge-state.js",
		"/thread-detail-runtime.js",
		"/thread-detail-patch-plan.js",
		"/thread-detail-dom-patch.js",
		"/thread-detail-actions.js",
		"/thread-tile-actions.js",
		"/thread-tile-state.js",
		"/thread-tile-layout.js",
		"/thread-tile-runtime.js",
		"/build-refresh-policy.js",
		"/app-update-runtime.js",
		"/side-chat-runtime.js",
		"/media-preview-runtime.js",
		"/app-bootstrap.js",
		"/settings-runtime.js",
		"/modal-runtime.js",
		"/navigation-runtime.js",
		"/api-client-runtime.js",
		"/notification-ui-runtime.js",
		"/pane-layout-runtime.js",
		"/task-card-runtime.js",
		"/conversation-render-runtime.js",
		"/event-stream-runtime.js",
		"/composer-bridge-runtime.js",
		"/runtime-wiring-runtime.js",
		"/app-shell-runtime.js",
		"/app.js",
		"/shell-asset-manifest.json",
		"/sw.js"
	],
	hashAssets: [
		"/index.html",
		"/manifest.json",
		"/icons/icon.svg",
		"/icons/apple-touch-icon.png",
		"/styles.css",
		"/icons/icon-192.png",
		"/icons/icon-512.png",
		"/shell-asset-manifest.js",
		"/api-client.js",
		"/runtime-settings.js",
		"/draft-store.js",
		"/composer-runtime.js",
		"/markdown-renderer.js",
		"/viewport-metrics.js",
		"/conversation-scroll.js",
		"/image-compressor.js",
		"/plugin-embed.js",
		"/plugin-voice-input.js",
		"/home-ai-diagnostic-reporting.js",
		"/thread-diagnostic-events.js",
		"/frontend-runtime-health.js",
		"/thread-status-hints.js",
		"/thread-performance-metrics.js",
		"/thread-list-load-policy.js",
		"/thread-list-stable-order.js",
		"/thread-list-runtime.js",
		"/client-render-stability-guard.js",
		"/live-operation-dock-state.js",
		"/thread-detail-state.js",
		"/thread-detail-render-plan.js",
		"/thread-detail-merge-state.js",
		"/thread-detail-v4-merge-state.js",
		"/thread-detail-runtime.js",
		"/thread-detail-patch-plan.js",
		"/thread-detail-dom-patch.js",
		"/thread-detail-actions.js",
		"/thread-tile-actions.js",
		"/thread-tile-state.js",
		"/thread-tile-layout.js",
		"/thread-tile-runtime.js",
		"/build-refresh-policy.js",
		"/app-update-runtime.js",
		"/side-chat-runtime.js",
		"/media-preview-runtime.js",
		"/app-bootstrap.js",
		"/settings-runtime.js",
		"/modal-runtime.js",
		"/navigation-runtime.js",
		"/api-client-runtime.js",
		"/notification-ui-runtime.js",
		"/pane-layout-runtime.js",
		"/task-card-runtime.js",
		"/conversation-render-runtime.js",
		"/event-stream-runtime.js",
		"/composer-bridge-runtime.js",
		"/runtime-wiring-runtime.js",
		"/app-shell-runtime.js",
		"/app.js",
		"/shell-asset-manifest.json",
		"/sw.js"
	],
	counts: {
		"scriptAssets": 51,
		"entryGroups": 6,
		"classicGlobalExportAssets": 50,
		"classicGlobalExports": 229,
		"startupGlobalContracts": 208,
		"linkAssets": 4,
		"iconAssets": 4,
		"precacheAssets": 60,
		"pageShellAssets": 61,
		"hashAssets": 60
	}
};
//#endregion
//#region \0vite/preload-helper.js
var scriptRel = "modulepreload";
var assetsURL = function(dep) {
	return "/" + dep;
};
var seen = {};
var __vitePreload = function preload(baseModule, deps, importerUrl) {
	let promise = Promise.resolve();
	if (deps && deps.length > 0) {
		const links = document.getElementsByTagName("link");
		const cspNonceMeta = document.querySelector("meta[property=csp-nonce]");
		const cspNonce = cspNonceMeta?.nonce || cspNonceMeta?.getAttribute("nonce");
		function allSettled(promises) {
			return Promise.all(promises.map((p) => Promise.resolve(p).then((value) => ({
				status: "fulfilled",
				value
			}), (reason) => ({
				status: "rejected",
				reason
			}))));
		}
		function importMetaResolve(specifier) {
			if (import.meta.resolve) return import.meta.resolve(specifier);
			return new URL(specifier, new URL("../../../src/node/plugins/importAnalysisBuild.ts", import.meta.url)).href;
		}
		promise = allSettled(deps.map((dep) => {
			dep = assetsURL(dep, importerUrl);
			dep = importMetaResolve(dep);
			if (dep in seen) return;
			seen[dep] = true;
			const isCss = dep.endsWith(".css");
			for (let i = links.length - 1; i >= 0; i--) {
				const link = links[i];
				if (link.href === dep && (!isCss || link.rel === "stylesheet")) return;
			}
			const link = document.createElement("link");
			link.rel = isCss ? "stylesheet" : scriptRel;
			if (!isCss) link.as = "script";
			link.crossOrigin = "";
			link.href = dep;
			if (cspNonce) link.setAttribute("nonce", cspNonce);
			document.head.appendChild(link);
			if (isCss) return new Promise((res, rej) => {
				link.addEventListener("load", res);
				link.addEventListener("error", () => rej(/* @__PURE__ */ new Error(`Unable to preload CSS for ${dep}`)));
			});
		}));
	}
	function handlePreloadError(err) {
		const e = new Event("vite:preloadError", { cancelable: true });
		e.payload = err;
		window.dispatchEvent(e);
		if (!e.defaultPrevented) throw err;
	}
	return promise.then((res) => {
		for (const item of res || []) {
			if (item.status !== "rejected") continue;
			handlePreloadError(item.reason);
		}
		return baseModule().catch(handlePreloadError);
	});
};
//#endregion
//#region \0virtual:codex-mobile-shell-entry-group-loader
var codexMobileViteEntryGroupIds = [
	"manifest",
	"foundation",
	"feature-runtimes",
	"bootstrap-state",
	"shell-services",
	"app-entry"
];
var codexMobileViteEntryGroupLoaders = {
	"manifest": () => __vitePreload(() => import("./vite-entry-group-manifest-BMoPj2_9.js"), []),
	"foundation": () => __vitePreload(() => import("./vite-entry-group-foundation-Ch8Ty-Zj.js"), []),
	"feature-runtimes": () => __vitePreload(() => import("./vite-entry-group-feature-runtimes-Csk_28IM.js"), []),
	"bootstrap-state": () => __vitePreload(() => import("./vite-entry-group-bootstrap-state-DHih1wQN.js"), []),
	"shell-services": () => __vitePreload(() => import("./vite-entry-group-shell-services-DuMpakad.js"), []),
	"app-entry": () => __vitePreload(() => import("./vite-entry-group-app-entry-BgyKC0hH.js"), [])
};
function loadCodexMobileViteEntryGroups() {
	const status = {
		expectedCount: codexMobileViteEntryGroupIds.length,
		imported: [],
		failed: [],
		ok: false
	};
	globalThis.__CODEX_MOBILE_VITE_ENTRY_GROUP_IMPORT_STATUS__ = status;
	const promise = Promise.all(codexMobileViteEntryGroupIds.map(async (groupId) => {
		const load = codexMobileViteEntryGroupLoaders[groupId];
		try {
			const module = await load();
			const payload = module && (module.codexMobileViteEntryGroup || module.default) || {};
			status.imported.push(String(payload.id || groupId));
		} catch (_) {
			status.failed.push(groupId);
		}
	})).then(() => {
		const registry = globalThis.__CODEX_MOBILE_VITE_ENTRY_GROUP_CHUNKS__ || {};
		status.registryCount = Object.keys(registry).length;
		status.ok = status.failed.length === 0 && status.imported.length === status.expectedCount && status.registryCount === status.expectedCount;
		return status;
	});
	globalThis.__CODEX_MOBILE_VITE_ENTRY_GROUP_IMPORT_PROMISE__ = promise;
	return promise;
}
//#endregion
//#region frontend/vite-shell-entry.mjs
globalThis.CODEX_MOBILE_SHELL_MANIFEST = shell_asset_manifest_default;
function compactEntryGroup(group) {
	return {
		id: group.id,
		phase: group.phase,
		startupCritical: Boolean(group.startupCritical),
		chunkTarget: group.chunkTarget,
		assets: Array.isArray(group.assets) ? group.assets.slice() : []
	};
}
var entryGroups = Array.isArray(shell_asset_manifest_default.entryGroups) ? shell_asset_manifest_default.entryGroups.map(compactEntryGroup) : [];
var entryTopology = {
	shellCacheName: shell_asset_manifest_default.shellCacheName,
	clientBuildId: shell_asset_manifest_default.clientBuildId,
	startupGroups: entryGroups.filter((group) => group.startupCritical),
	deferredGroups: entryGroups.filter((group) => !group.startupCritical)
};
var classicGlobalExports = Array.isArray(shell_asset_manifest_default.classicGlobalExports) ? shell_asset_manifest_default.classicGlobalExports.map((entry) => ({
	asset: entry.asset,
	globals: Array.isArray(entry.globals) ? entry.globals.slice() : []
})) : [];
var startupGlobalContracts = Array.isArray(shell_asset_manifest_default.startupGlobalContracts) ? shell_asset_manifest_default.startupGlobalContracts.map((entry) => ({
	name: entry.name,
	asset: entry.asset,
	groupId: entry.groupId,
	startupCritical: Boolean(entry.startupCritical),
	source: entry.source
})) : [];
var classicGlobalNames = [...new Set(classicGlobalExports.flatMap((entry) => entry.globals))].sort();
var classicCompatibility = {
	schemaVersion: shell_asset_manifest_default.schemaVersion,
	shellCacheName: shell_asset_manifest_default.shellCacheName,
	clientBuildId: shell_asset_manifest_default.clientBuildId,
	assetCount: classicGlobalExports.length,
	globalCount: classicGlobalNames.length,
	requiredStartupGlobals: startupGlobalContracts.map((entry) => entry.name),
	startupGlobalContracts,
	classicGlobalExports
};
var pendingEsmCompatibility = {
	schemaVersion: 1,
	owner: "vite-shell-entry",
	moduleCount: 0,
	readyCount: 0,
	modules: [],
	loading: true
};
var esmCompatibility = pendingEsmCompatibility;
var viteAppPreviewPage = isAppPreviewPage();
globalThis.__CODEX_MOBILE_VITE_APP_PREVIEW_PAGE__ = viteAppPreviewPage;
var esmCompatibilityImportPromise = __vitePreload(() => import("./_virtual_codex-mobile-esm-compatibility--k8asiKr.js").then(async (module) => {
	const createCompatibility = module && typeof module.codexMobileViteEsmCompatibility === "function" ? module.codexMobileViteEsmCompatibility : null;
	if (!createCompatibility) throw new Error("codex_mobile_vite_esm_compatibility_factory_missing");
	esmCompatibility = await createCompatibility();
	globalThis.__CODEX_MOBILE_VITE_ESM_COMPATIBILITY__ = esmCompatibility;
	return esmCompatibility;
}), []).catch((error) => {
	esmCompatibility = {
		...pendingEsmCompatibility,
		loading: false,
		failed: true,
		errorCode: String(error && error.message || error || "codex_mobile_vite_esm_compatibility_failed").slice(0, 160)
	};
	globalThis.__CODEX_MOBILE_VITE_ESM_COMPATIBILITY__ = esmCompatibility;
	throw error;
});
function shellManifestScriptAssets() {
	return entryGroups.flatMap((group) => Array.isArray(group.assets) ? group.assets : []).filter((asset) => String(asset || "").startsWith("/"));
}
function readAppPreviewClassicLoaderPlan() {
	if (globalThis.document == null) return null;
	const node = globalThis.document.getElementById("codex-vite-app-preview-loader-plan");
	if (!node) return null;
	try {
		const plan = JSON.parse(node.textContent || "{}");
		const scripts = (Array.isArray(plan.scripts) ? plan.scripts : []).map((entry) => ({
			index: Number(entry && entry.index) || 0,
			path: String(entry && entry.path || ""),
			groupId: String(entry && entry.groupId || ""),
			startupCritical: Boolean(entry && entry.startupCritical),
			bytes: Number(entry && entry.bytes) || 0,
			sha256: String(entry && entry.sha256 || "")
		})).filter((entry) => entry.path.startsWith("/"));
		return {
			schemaVersion: Number(plan.schemaVersion) || 1,
			source: String(plan.source || ""),
			owner: String(plan.owner || ""),
			sourceScriptCount: Number(plan.sourceScriptCount) || 0,
			scriptCount: Number(plan.scriptCount) || scripts.length,
			firstScript: String(plan.firstScript || ""),
			lastScript: String(plan.lastScript || ""),
			hashCount: Number(plan.hashCount) || scripts.filter((entry) => entry.sha256).length,
			byteCount: Number(plan.byteCount) || scripts.reduce((total, entry) => total + entry.bytes, 0),
			excludedEsmScriptCount: Number(plan.excludedEsmScriptCount) || 0,
			excludedEsmHashCount: Number(plan.excludedEsmHashCount) || 0,
			excludedEsmByteCount: Number(plan.excludedEsmByteCount) || 0,
			excludedViteOwnedScriptCount: Number(plan.excludedViteOwnedScriptCount) || 0,
			excludedViteOwnedHashCount: Number(plan.excludedViteOwnedHashCount) || 0,
			excludedViteOwnedByteCount: Number(plan.excludedViteOwnedByteCount) || 0,
			excludedEsmScripts: (Array.isArray(plan.excludedEsmScripts) ? plan.excludedEsmScripts : []).map((entry) => ({
				index: Number(entry && entry.index) || 0,
				sourceIndex: Number(entry && entry.sourceIndex) || 0,
				path: String(entry && entry.path || ""),
				groupId: String(entry && entry.groupId || ""),
				phase: String(entry && entry.phase || ""),
				startupCritical: Boolean(entry && entry.startupCritical),
				chunkTarget: String(entry && entry.chunkTarget || ""),
				sourcePath: String(entry && entry.sourcePath || ""),
				bytes: Number(entry && entry.bytes) || 0,
				sha256: String(entry && entry.sha256 || ""),
				esmModuleId: String(entry && entry.esmModuleId || ""),
				globalName: String(entry && entry.globalName || "")
			})).filter((entry) => entry.path.startsWith("/")),
			excludedViteOwnedScripts: (Array.isArray(plan.excludedViteOwnedScripts) ? plan.excludedViteOwnedScripts : []).map((entry) => ({
				index: Number(entry && entry.index) || 0,
				sourceIndex: Number(entry && entry.sourceIndex) || 0,
				path: String(entry && entry.path || ""),
				groupId: String(entry && entry.groupId || ""),
				phase: String(entry && entry.phase || ""),
				startupCritical: Boolean(entry && entry.startupCritical),
				chunkTarget: String(entry && entry.chunkTarget || ""),
				sourcePath: String(entry && entry.sourcePath || ""),
				bytes: Number(entry && entry.bytes) || 0,
				sha256: String(entry && entry.sha256 || ""),
				ownerId: String(entry && entry.ownerId || ""),
				globalName: String(entry && entry.globalName || "")
			})).filter((entry) => entry.path.startsWith("/")),
			sha256: String(plan.sha256 || ""),
			scripts
		};
	} catch (_) {
		return null;
	}
}
function isAppPreviewPage() {
	if (globalThis.document == null) return false;
	const documentElement = globalThis.document.documentElement;
	if (documentElement && documentElement.dataset && documentElement.dataset.codexViteAppPreview === "true") return true;
	return Boolean(globalThis.document.querySelector("meta[name='codex-vite-app-preview']"));
}
function loadClassicScript(assetPath) {
	return new Promise((resolve, reject) => {
		const document = globalThis.document;
		if (!document || !document.createElement) {
			reject(/* @__PURE__ */ new Error("codex_mobile_vite_app_preview_document_missing"));
			return;
		}
		const script = document.createElement("script");
		script.src = assetPath;
		script.async = false;
		script.dataset.codexViteAppPreviewClassicScript = "true";
		script.onload = () => resolve(assetPath);
		script.onerror = () => reject(/* @__PURE__ */ new Error(`codex_mobile_vite_app_preview_script_failed:${assetPath}`));
		(document.head || document.documentElement).appendChild(script);
	});
}
async function loadViteOwnedAppBootstrap(loaderPlan) {
	if (!(loaderPlan && Array.isArray(loaderPlan.excludedViteOwnedScripts) ? loaderPlan.excludedViteOwnedScripts : []).some((entry) => String(entry && entry.path || "") === "/app-bootstrap.js")) return null;
	if (!globalThis.CodexAppBootstrap || typeof globalThis.CodexAppBootstrap.createAppBootstrapRuntime !== "function") await __vitePreload(() => import("./app-bootstrap-Dp0enEss.js").then((m) => /* @__PURE__ */ __toESM(m.default, 1)), []);
	const api = globalThis.CodexAppBootstrap;
	if (!api || typeof api.createAppBootstrapRuntime !== "function") throw new Error("codex_mobile_vite_app_preview_app_bootstrap_missing");
	return api.createAppBootstrapRuntime();
}
function boundedViteAppPreviewErrorCode(error, fallback = "codex_mobile_vite_app_preview_error") {
	return String(error && error.message || error || fallback).slice(0, 160);
}
function startViteAppPreviewApp(status, appEntry) {
	status.appStartAttempted = true;
	status.appStartStartedAt = Date.now();
	status.appStartCompletedAt = 0;
	status.appStartPending = true;
	status.appStartOk = false;
	status.appStartErrorCode = "";
	const appStartPromise = Promise.resolve().then(() => appEntry.startCodexMobileApp()).then(() => {
		status.appStartOk = true;
		return { ok: true };
	}).catch((error) => {
		status.appStartOk = false;
		status.appStartErrorCode = boundedViteAppPreviewErrorCode(error, "codex_mobile_vite_app_preview_app_start_failed");
		return {
			ok: false,
			errorCode: status.appStartErrorCode
		};
	}).finally(() => {
		status.appStartPending = false;
		status.appStartCompletedAt = Date.now();
	});
	globalThis.__CODEX_MOBILE_VITE_APP_PREVIEW_APP_START_PROMISE__ = appStartPromise;
	return appStartPromise;
}
async function startCodexMobileViteAppPreview() {
	const loaderPlan = readAppPreviewClassicLoaderPlan();
	const manifestAssets = shellManifestScriptAssets();
	const assets = loaderPlan && Array.isArray(loaderPlan.scripts) ? loaderPlan.scripts.map((entry) => entry.path) : [];
	const excludedEsmAssets = loaderPlan && Array.isArray(loaderPlan.excludedEsmScripts) ? loaderPlan.excludedEsmScripts.map((entry) => entry.path) : [];
	const excludedViteOwnedAssets = loaderPlan && Array.isArray(loaderPlan.excludedViteOwnedScripts) ? loaderPlan.excludedViteOwnedScripts.map((entry) => entry.path) : [];
	const coveredAssets = /* @__PURE__ */ new Set([
		...assets,
		...excludedEsmAssets,
		...excludedViteOwnedAssets
	]);
	const manifestCoverageMatches = manifestAssets.length > 0 && coveredAssets.size === manifestAssets.length && JSON.stringify(manifestAssets.filter((asset) => coveredAssets.has(asset))) === JSON.stringify(manifestAssets);
	const status = {
		ok: false,
		mode: "vite-app-preview",
		owner: "vite-shell-entry",
		loaderPlanPresent: Boolean(loaderPlan),
		loaderPlanOwner: loaderPlan ? loaderPlan.owner : "",
		loaderPlanSource: loaderPlan ? loaderPlan.source : "",
		loaderPlanScriptCount: loaderPlan ? loaderPlan.scriptCount : 0,
		loaderPlanHashCount: loaderPlan ? loaderPlan.hashCount : 0,
		loaderPlanSourceScriptCount: loaderPlan ? loaderPlan.sourceScriptCount : 0,
		loaderPlanExcludedEsmScriptCount: loaderPlan ? loaderPlan.excludedEsmScriptCount : 0,
		loaderPlanExcludedEsmHashCount: loaderPlan ? loaderPlan.excludedEsmHashCount : 0,
		loaderPlanExcludedViteOwnedScriptCount: loaderPlan ? loaderPlan.excludedViteOwnedScriptCount : 0,
		loaderPlanExcludedViteOwnedHashCount: loaderPlan ? loaderPlan.excludedViteOwnedHashCount : 0,
		loaderPlanSha256: loaderPlan ? loaderPlan.sha256 : "",
		loaderPlanMatchesShellManifest: Boolean(loaderPlan) && manifestCoverageMatches,
		esmCompatibilityReady: false,
		viteOwnedAppBootstrapReady: false,
		excludedEsmGlobalMissing: [],
		excludedViteOwnedGlobalMissing: [],
		scriptCount: assets.length,
		loaded: [],
		failed: [],
		startedAt: Date.now(),
		completedAt: 0,
		appStartAttempted: false,
		appStartStartedAt: 0,
		appStartCompletedAt: 0,
		appStartPending: false,
		appStartOk: false,
		appStartErrorCode: ""
	};
	globalThis.__CODEX_MOBILE_VITE_APP_PREVIEW__ = status;
	globalThis.__CODEX_MOBILE_VITE_APP_PREVIEW_LOADER_PLAN__ = loaderPlan;
	try {
		if (!loaderPlan) throw new Error("codex_mobile_vite_app_preview_loader_plan_missing");
		if (loaderPlan.owner !== "vite-shell-entry" || !loaderPlan.sha256 || Number(loaderPlan.sourceScriptCount) !== manifestAssets.length || Number(loaderPlan.scriptCount) !== assets.length || Number(loaderPlan.hashCount) !== assets.length || Number(loaderPlan.excludedEsmScriptCount) !== excludedEsmAssets.length || Number(loaderPlan.excludedEsmHashCount) !== excludedEsmAssets.length || Number(loaderPlan.excludedViteOwnedScriptCount || 0) !== excludedViteOwnedAssets.length || Number(loaderPlan.excludedViteOwnedHashCount || 0) !== excludedViteOwnedAssets.length || !manifestCoverageMatches) throw new Error("codex_mobile_vite_app_preview_loader_plan_invalid");
		const loadedEsmCompatibility = await esmCompatibilityImportPromise;
		status.esmCompatibilityReady = Boolean(loadedEsmCompatibility) && loadedEsmCompatibility.owner === "vite-shell-entry" && Number(loadedEsmCompatibility.moduleCount) === Number(loadedEsmCompatibility.readyCount);
		const missingExcludedGlobals = loaderPlan && Array.isArray(loaderPlan.excludedEsmScripts) ? loaderPlan.excludedEsmScripts.filter((entry) => !entry.globalName || !globalThis[entry.globalName]).map((entry) => entry.globalName || entry.path) : [];
		status.excludedEsmGlobalMissing = missingExcludedGlobals;
		if (missingExcludedGlobals.length) throw new Error("codex_mobile_vite_app_preview_esm_globals_missing");
		const appBootstrapRuntime = await loadViteOwnedAppBootstrap(loaderPlan);
		status.viteOwnedAppBootstrapReady = Boolean(appBootstrapRuntime);
		const missingExcludedViteOwnedGlobals = loaderPlan && Array.isArray(loaderPlan.excludedViteOwnedScripts) ? loaderPlan.excludedViteOwnedScripts.filter((entry) => !entry.globalName || !globalThis[entry.globalName]).map((entry) => entry.globalName || entry.path) : [];
		status.excludedViteOwnedGlobalMissing = missingExcludedViteOwnedGlobals;
		if (missingExcludedViteOwnedGlobals.length) throw new Error("codex_mobile_vite_app_preview_vite_owned_globals_missing");
		for (const asset of assets) {
			await loadClassicScript(asset);
			status.loaded.push(asset);
		}
		let appEntry = null;
		if (excludedEsmAssets.includes("/app.js")) {
			appEntry = globalThis.CodexMobileAppEntry;
			if (!appEntry || typeof appEntry.startCodexMobileApp !== "function") throw new Error("codex_mobile_vite_app_preview_app_entry_missing");
		}
		status.ok = true;
		status.completedAt = Date.now();
		if (appEntry) startViteAppPreviewApp(status, appEntry);
	} catch (error) {
		status.ok = false;
		status.failed.push(boundedViteAppPreviewErrorCode(error, "script_failed"));
		if (!status.completedAt) status.completedAt = Date.now();
		throw error;
	}
	return {
		ok: status.ok,
		mode: status.mode,
		owner: status.owner,
		loaderPlanPresent: status.loaderPlanPresent,
		loaderPlanScriptCount: status.loaderPlanScriptCount,
		loaderPlanHashCount: status.loaderPlanHashCount,
		loaderPlanSourceScriptCount: status.loaderPlanSourceScriptCount,
		loaderPlanExcludedEsmScriptCount: status.loaderPlanExcludedEsmScriptCount,
		loaderPlanExcludedEsmHashCount: status.loaderPlanExcludedEsmHashCount,
		loaderPlanExcludedViteOwnedScriptCount: status.loaderPlanExcludedViteOwnedScriptCount,
		loaderPlanExcludedViteOwnedHashCount: status.loaderPlanExcludedViteOwnedHashCount,
		loaderPlanSha256: status.loaderPlanSha256,
		loaderPlanMatchesShellManifest: status.loaderPlanMatchesShellManifest,
		esmCompatibilityReady: status.esmCompatibilityReady,
		viteOwnedAppBootstrapReady: status.viteOwnedAppBootstrapReady,
		excludedEsmGlobalMissingCount: status.excludedEsmGlobalMissing.length,
		excludedViteOwnedGlobalMissingCount: status.excludedViteOwnedGlobalMissing.length,
		scriptCount: status.scriptCount,
		loadedCount: status.loaded.length,
		failedCount: status.failed.length,
		appStartAttempted: status.appStartAttempted,
		appStartPending: status.appStartPending,
		appStartOk: status.appStartOk,
		appStartCompletedAt: status.appStartCompletedAt,
		appStartErrorCode: status.appStartErrorCode
	};
}
var deferredEntryTopologyPromise = __vitePreload(() => import("./vite-deferred-entry-topology-TDCLN_ha.js"), []);
loadCodexMobileViteEntryGroups();
var entryDynamicImportGraph = {
	owner: "vite-shell-entry",
	esmCompatibilitySources: ["virtual:codex-mobile-esm-compatibility"],
	viteOwnedSources: ["public/app-bootstrap.js"],
	deferredSources: ["frontend/vite-deferred-entry-topology.mjs"],
	entryGroupSources: codexMobileViteEntryGroupIds.map((groupId) => `virtual:codex-mobile-shell-entry-group/${groupId}`),
	expectedImportCount: 3 + codexMobileViteEntryGroupIds.length
};
var appPreviewPromise = viteAppPreviewPage ? startCodexMobileViteAppPreview() : Promise.resolve(null);
globalThis.__CODEX_MOBILE_VITE_SHELL_BUILD_STAGE__ = "entry-topology-v1";
globalThis.__CODEX_MOBILE_VITE_SHELL_ENTRY_TOPOLOGY__ = entryTopology;
globalThis.__CODEX_MOBILE_VITE_CLASSIC_COMPATIBILITY__ = classicCompatibility;
globalThis.__CODEX_MOBILE_VITE_ESM_COMPATIBILITY__ = esmCompatibility;
globalThis.__CODEX_MOBILE_VITE_ESM_COMPATIBILITY_PROMISE__ = esmCompatibilityImportPromise;
globalThis.__CODEX_MOBILE_VITE_DEFERRED_ENTRY_TOPOLOGY__ = deferredEntryTopologyPromise;
globalThis.__CODEX_MOBILE_VITE_ENTRY_GROUP_IMPORT_OWNER__ = "vite-shell-entry";
globalThis.__CODEX_MOBILE_VITE_ENTRY_DYNAMIC_IMPORT_GRAPH__ = entryDynamicImportGraph;
globalThis.__CODEX_MOBILE_VITE_APP_PREVIEW_PROMISE__ = appPreviewPromise;
//#endregion
export { shell_asset_manifest_default as n, __commonJSMin as r, __vitePreload as t };
