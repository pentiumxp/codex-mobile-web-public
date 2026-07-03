//#region \0virtual:codex-mobile-shell-entry-group/bootstrap-state
var codexMobileViteEntryGroup = {
	"id": "bootstrap-state",
	"phase": "startup-critical",
	"startupCritical": true,
	"chunkTarget": "startup-bootstrap",
	"assets": ["/app-bootstrap.js"],
	"assetCount": 1,
	"classicAssetRecords": [{
		"path": "/app-bootstrap.js",
		"sourcePath": "public/app-bootstrap.js",
		"bytes": 49762,
		"sha256": "8b3845b1a3b8232aa987c68ab9469e9a6313edb6d74d9d0e229cdd7d4bc74e5e"
	}],
	"classicAssetHashCount": 1,
	"classicAssetBytes": 49762,
	"classicGlobalExports": [{
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
	}],
	"classicGlobalExportAssetCount": 1,
	"classicGlobalExportCount": 179,
	"startupGlobalContracts": [
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
	"shellCacheName": "codex-mobile-shell-v625-37a9d4e2700b",
	"clientBuildId": "0.1.11|codex-mobile-shell-v625-37a9d4e2700b"
};
var codexMobileViteEntryGroupRegistry = globalThis.__CODEX_MOBILE_VITE_ENTRY_GROUP_CHUNKS__ || {};
codexMobileViteEntryGroupRegistry[codexMobileViteEntryGroup.id] = codexMobileViteEntryGroup;
globalThis.__CODEX_MOBILE_VITE_ENTRY_GROUP_CHUNKS__ = codexMobileViteEntryGroupRegistry;
//#endregion
export { codexMobileViteEntryGroup, codexMobileViteEntryGroup as default };
