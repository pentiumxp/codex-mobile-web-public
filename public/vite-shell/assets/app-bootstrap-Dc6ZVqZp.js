import { r as __commonJSMin } from "./vite-shell-entry-D8dyY47-.js";
//#region public/app-bootstrap.js
var require_app_bootstrap = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	function readShellManifest() {
		const manifest = window.CODEX_MOBILE_SHELL_MANIFEST;
		return manifest && typeof manifest === "object" ? manifest : {};
	}
	function shellManifestList(name, fallback = []) {
		const value = readShellManifest()[name];
		return Array.isArray(value) && value.length ? value.slice() : fallback.slice();
	}
	function initialPluginLaunchKeyFromUrl() {
		try {
			const params = new URL(window.location.href, window.location.origin).searchParams;
			return String(params.get("codexPluginLaunch") || params.get("pluginLaunch") || "").trim();
		} catch (_) {
			return "";
		}
	}
	var pluginEmbedApi = window.CodexPluginEmbed || {
		detect: () => ({
			embedded: false,
			launchKey: initialPluginLaunchKeyFromUrl(),
			workspaceId: "",
			routeHint: null,
			appearance: {}
		}),
		externalBrowserUrl: () => "",
		externalLinkMessage: () => null,
		findRouteHintTargetNode: () => null,
		isBackMessage: () => false,
		navigationMessage: () => null,
		normalizeRouteHint: () => null,
		parentOriginFromReferrer: () => "",
		postBackResult: () => null,
		postExternalLink: () => null,
		postNavigation: () => null,
		routeHintFocusPlan: () => ({ action: "ignore" }),
		routeHintFromUrl: () => null,
		routeHintOpenPlan: () => ({ action: "ignore" }),
		routeHintTargetId: () => "",
		scrubRouteHintPath: () => ""
	};
	var pluginVoiceInputApi = window.CodexPluginVoiceInput || {
		MAX_TEXT_CHARS: 12e3,
		TYPES: {
			CAPABILITY_QUERY: "voice_input.capability_query",
			APPEND_TEXT: "voice_input.append_text",
			INSERT_TEXT: "voice_input.insert_text",
			REPLACE_DRAFT: "voice_input.replace_draft",
			PROVISIONAL_TEXT: "voice_input.provisional_text",
			SUBMIT: "voice_input.submit"
		},
		actionFromMessageType(type) {
			if (type === "voice_input.append_text") return "append_text";
			if (type === "voice_input.insert_text") return "insert_text";
			if (type === "voice_input.replace_draft") return "replace_draft";
			if (type === "voice_input.provisional_text") return "provisional_text";
			if (type === "voice_input.submit") return "submit";
			return "";
		},
		capabilityStateMessage: (input = {}) => Object.assign({
			type: "voice_input.capability_state",
			version: 1,
			pluginId: "codex-mobile"
		}, input),
		commitResultMessage: (input = {}) => Object.assign({
			type: "voice_input.commit_result",
			version: 1,
			pluginId: "codex-mobile"
		}, input),
		errorMessage: (input = {}) => Object.assign({
			type: "voice_input.error",
			version: 1,
			pluginId: "codex-mobile"
		}, input),
		insertResultMessage: (input = {}) => Object.assign({
			type: "voice_input.insert_result",
			version: 1,
			pluginId: "codex-mobile",
			code: input.ok === false ? String(input.code || input.errorCode || input.error_code || "").trim().slice(0, 80) : ""
		}, input),
		isVoiceInputMessage: (value) => Boolean(value && typeof value === "object" && String(value.type || "").startsWith("voice_input.")),
		postToParent(parentWindow, message, targetOrigin) {
			if (!parentWindow || parentWindow === window) return false;
			parentWindow.postMessage(message, targetOrigin || "*");
			return true;
		},
		requestIdFrom: (input = {}) => String(input.requestId || input.request_id || "").trim(),
		startRequestMessage: (input = {}) => Object.assign({
			type: "voice_input.start_request",
			version: 1,
			pluginId: "codex-mobile"
		}, input),
		stopRequestMessage: (input = {}) => Object.assign({
			type: "voice_input.stop_request",
			version: 1,
			pluginId: "codex-mobile"
		}, input),
		cancelRequestMessage: (input = {}) => Object.assign({
			type: "voice_input.cancel_request",
			version: 1,
			pluginId: "codex-mobile"
		}, input),
		textFromMessage: (input = {}) => String(input.text || "").trim().slice(0, 12e3),
		voiceSessionIdFrom: (input = {}) => String(input.voiceSessionId || input.voice_session_id || "").trim()
	};
	var homeAiDiagnosticReportingApi = window.CodexHomeAiDiagnosticReporting;
	if (!homeAiDiagnosticReportingApi) throw new Error("CodexHomeAiDiagnosticReporting script failed to load");
	var threadDiagnosticEventsApi = window.CodexThreadDiagnosticEvents;
	if (!threadDiagnosticEventsApi) throw new Error("CodexThreadDiagnosticEvents script failed to load");
	var frontendRuntimeHealthApi = window.CodexFrontendRuntimeHealth;
	if (!frontendRuntimeHealthApi) throw new Error("CodexFrontendRuntimeHealth script failed to load");
	var buildRefreshPolicy = window.CodexBuildRefreshPolicy || { shouldPromptForServerBuildChange(serverBuildId, clientBuildId) {
		const server = String(serverBuildId || "").trim();
		const client = String(clientBuildId || "").trim();
		if (!server || !client || server === client) return false;
		const serverSeq = server.match(/\bcodex-mobile-shell-v([0-9]+)\b/);
		const clientSeq = client.match(/\bcodex-mobile-shell-v([0-9]+)\b/);
		if (serverSeq && clientSeq && Number(serverSeq[1]) < Number(clientSeq[1])) return false;
		return true;
	} };
	var appUpdateRuntimeApi = window.CodexAppUpdateRuntime;
	if (!appUpdateRuntimeApi || typeof appUpdateRuntimeApi.createAppUpdateRuntime !== "function") throw new Error("CodexAppUpdateRuntime script failed to load");
	var sideChatRuntimeApi = window.CodexSideChatRuntime;
	if (!sideChatRuntimeApi || typeof sideChatRuntimeApi.createSideChatRuntime !== "function") throw new Error("CodexSideChatRuntime script failed to load");
	var mediaPreviewRuntimeApi = window.CodexMediaPreviewRuntime;
	if (!mediaPreviewRuntimeApi || typeof mediaPreviewRuntimeApi.createMediaPreviewRuntime !== "function") throw new Error("CodexMediaPreviewRuntime script failed to load");
	var threadStatusHintPolicy = window.CodexThreadStatusHints;
	if (!threadStatusHintPolicy) throw new Error("CodexThreadStatusHints policy script failed to load");
	var threadPerformanceMetrics = window.CodexThreadPerformanceMetrics;
	if (!threadPerformanceMetrics) throw new Error("CodexThreadPerformanceMetrics script failed to load");
	var threadListLoadPolicy = window.CodexThreadListLoadPolicy;
	if (!threadListLoadPolicy) throw new Error("CodexThreadListLoadPolicy script failed to load");
	var threadListStableOrderPolicy = window.CodexThreadListStableOrder;
	if (!threadListStableOrderPolicy) throw new Error("CodexThreadListStableOrder script failed to load");
	var clientRenderStabilityGuard = window.CodexClientRenderStabilityGuard;
	if (!clientRenderStabilityGuard) throw new Error("CodexClientRenderStabilityGuard script failed to load");
	var liveOperationDockPolicy = window.CodexLiveOperationDockState;
	if (!liveOperationDockPolicy) throw new Error("CodexLiveOperationDockState script failed to load");
	var threadDetailStateApi = window.CodexThreadDetailState;
	if (!threadDetailStateApi) throw new Error("CodexThreadDetailState policy script failed to load");
	var threadDetailRenderPlanApi = window.CodexThreadDetailRenderPlan;
	if (!threadDetailRenderPlanApi) throw new Error("CodexThreadDetailRenderPlan script failed to load");
	var threadDetailMergeStateApi = window.CodexThreadDetailMergeState;
	if (!threadDetailMergeStateApi) throw new Error("CodexThreadDetailMergeState script failed to load");
	var threadDetailV4MergeStateApi = window.CodexThreadDetailV4MergeState;
	if (!threadDetailV4MergeStateApi) throw new Error("CodexThreadDetailV4MergeState script failed to load");
	var threadDetailRuntimeApi = window.CodexThreadDetailRuntime;
	if (!threadDetailRuntimeApi || typeof threadDetailRuntimeApi.createThreadDetailRuntime !== "function") throw new Error("CodexThreadDetailRuntime script failed to load");
	var threadDetailPatchPlanApi = window.CodexThreadDetailPatchPlan;
	if (!threadDetailPatchPlanApi) throw new Error("CodexThreadDetailPatchPlan script failed to load");
	var threadDetailDomPatchApi = window.CodexThreadDetailDomPatch;
	if (!threadDetailDomPatchApi) throw new Error("CodexThreadDetailDomPatch script failed to load");
	var threadDetailActionsApi = window.CodexThreadDetailActions;
	if (!threadDetailActionsApi) throw new Error("CodexThreadDetailActions script failed to load");
	var threadTileActionsApi = window.CodexThreadTileActions;
	if (!threadTileActionsApi) throw new Error("CodexThreadTileActions script failed to load");
	var threadTileStatePolicy = window.CodexThreadTileState;
	if (!threadTileStatePolicy) throw new Error("CodexThreadTileState script failed to load");
	var threadTileLayoutPolicy = window.CodexThreadTileLayout;
	if (!threadTileLayoutPolicy) throw new Error("CodexThreadTileLayout policy script failed to load");
	var threadTileRuntimeApi = window.CodexThreadTileRuntime;
	if (!threadTileRuntimeApi) throw new Error("CodexThreadTileRuntime script failed to load");
	var composerRuntimeApi = window.CodexComposerRuntime;
	if (!composerRuntimeApi) throw new Error("CodexComposerRuntime script failed to load");
	var INITIAL_PLUGIN_EMBED = pluginEmbedApi.detect(window.location.href);
	var INITIAL_PLUGIN_LAUNCH_KEY = INITIAL_PLUGIN_EMBED.launchKey || initialPluginLaunchKeyFromUrl();
	function loadJsonStorage(key, fallback) {
		try {
			const value = JSON.parse(localStorage.getItem(key) || "");
			return value && typeof value === "object" ? value : fallback;
		} catch (_) {
			return fallback;
		}
	}
	function loadStringSetStorage(key) {
		try {
			const value = JSON.parse(localStorage.getItem(key) || "[]");
			return new Set(Array.isArray(value) ? value.map((item) => String(item || "")).filter(Boolean) : []);
		} catch (_) {
			return /* @__PURE__ */ new Set();
		}
	}
	function loadNumberMapStorage(key, fallback = {}) {
		try {
			const value = JSON.parse(localStorage.getItem(key) || "{}");
			if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
			const out = {};
			for (const [id, timestamp] of Object.entries(value)) {
				const keyId = String(id || "").trim();
				const number = Number(timestamp || 0);
				if (keyId && Number.isFinite(number) && number > 0) out[keyId] = number;
			}
			return out;
		} catch (_) {
			return fallback;
		}
	}
	function normalizeFsPath(value) {
		return String(value || "").replace(/^\\\\\?\\/, "").replace(/[\\/]+/g, "\\").replace(/\\+$/, "").toLowerCase();
	}
	var state = {
		key: INITIAL_PLUGIN_LAUNCH_KEY || (INITIAL_PLUGIN_EMBED.embedded ? "" : localStorage.getItem("codexMobileKey")) || "",
		imageAuthVersion: 0,
		pluginEmbed: INITIAL_PLUGIN_EMBED,
		pluginLaunchSession: Boolean(INITIAL_PLUGIN_LAUNCH_KEY),
		pluginSessionActive: false,
		pluginLaunchTarget: null,
		pluginAppearance: INITIAL_PLUGIN_EMBED.appearance || null,
		queuedPluginRouteHint: INITIAL_PLUGIN_EMBED.routeHint || null,
		pendingPluginRouteHint: null,
		pluginParentOrigin: pluginEmbedApi.parentOriginFromReferrer(document.referrer) || "*",
		pluginHostViewport: null,
		viewportAppHeightPx: 0,
		viewportAppTopPx: 0,
		hostTopSafeAreaPx: 0,
		hostBottomSafeAreaPx: 0,
		pluginNavigationSignature: "",
		pluginVoiceInputCapabilitySignature: "",
		pluginVoiceInputPress: null,
		pluginVoiceInputProvisional: null,
		pluginVoiceInputSessionsByDraftKey: {},
		pluginRefreshRequestSignature: "",
		pluginRefreshPendingNotice: "",
		pluginRefreshPendingTimer: null,
		pluginStartupLoading: Boolean(INITIAL_PLUGIN_EMBED.embedded),
		pluginStartupMessage: "",
		startupThreadOpenPending: false,
		workspaces: [],
		workspaceCreateEnabled: true,
		workspaceCreateRoot: "",
		workspaceCreateRoots: [],
		workspaceCreateBusy: false,
		workspaceDelegation: {
			enabled: false,
			mode: "off",
			directTaskCardAutoApproval: false,
			ordinarySendPreflight: false,
			localHeuristics: false,
			source: "default",
			updatedAt: ""
		},
		workspaceDelegationBusy: false,
		selectedCwd: "",
		workspaceTokenUsage: null,
		workspaceTokenUsageDetailsOpen: false,
		workspaceTokenStatsOpen: false,
		threads: [],
		threadListStableOrder: null,
		currentThread: null,
		currentThreadId: "",
		threadTileMode: false,
		threadDisplaySettingsLoaded: false,
		threadDisplaySettingsSaveTimer: null,
		threadDisplaySettingsSaveInFlight: false,
		threadTileDetails: /* @__PURE__ */ new Map(),
		threadTileLoadingIds: /* @__PURE__ */ new Set(),
		threadTileErrors: /* @__PURE__ */ new Map(),
		threadTileControllers: /* @__PURE__ */ new Map(),
		threadTileLoadedAtById: /* @__PURE__ */ new Map(),
		threadTileActiveIds: [],
		threadTilePinnedIds: [],
		threadTileSplitPairs: [],
		threadTileDraggingThreadId: "",
		threadTilePaneCount: 0,
		threadTileSelectedThreadId: "",
		threadTileSwitchMenuPaneId: "",
		threadTileRefreshTimer: null,
		threadTileDetailLoadQueueTimer: null,
		threadTilePaneRenderFramesById: /* @__PURE__ */ new Map(),
		threadTilePaneScrollHoldById: /* @__PURE__ */ new Map(),
		threadTileOperationModesById: /* @__PURE__ */ new Map(),
		threadTileOperationBubblesById: /* @__PURE__ */ new Map(),
		threadTaskCardBodyLoads: /* @__PURE__ */ new Set(),
		threadTileOperationRefreshTimer: null,
		threadTileViewportBaseline: null,
		threadTileComposerHeightBaselinePx: 0,
		newThreadDraft: false,
		newThreadTitle: "",
		activeTurnId: "",
		events: null,
		connectionStatus: null,
		appServerWasUnavailable: false,
		autoTurnRecoveryInFlight: /* @__PURE__ */ new Set(),
		autoTurnRecoveryRecent: {},
		renderScheduled: false,
		renderFrame: null,
		bottomScrollFrame: null,
		bottomFollowTimers: [],
		scrollToBottomFrame: null,
		recentCompletedReplyAnchor: null,
		conversationScrollIntentAtMs: 0,
		conversationUserScrollAwayThreadId: "",
		conversationLastScrollTop: 0,
		conversationNearBottomAtMs: 0,
		conversationNearBottomThreadId: "",
		programmaticScrollUntilMs: 0,
		autoScrollHold: null,
		submittedMessageBottomFollow: null,
		viewportBottomFollow: null,
		threadListRenderScheduled: false,
		threadListRenderFrame: null,
		threadNotificationThrottle: /* @__PURE__ */ new Map(),
		recentSubmittedUserMessages: /* @__PURE__ */ new Map(),
		renderContextThreadId: "",
		renderContextThread: null,
		submittedProcessingThreadHintedAtById: {},
		sendProgressWatchdog: null,
		sendProgressStartAt: 0,
		sendProgressWarned: false,
		refreshTimer: null,
		postCompletionRefreshTimers: [],
		usageBackfillTimer: null,
		usageBackfillKey: "",
		usageBackfillAttempts: 0,
		recoveryTimer: null,
		reconnectNoticeTimer: null,
		eventRetryTimer: null,
		eventFallbackPollTimer: null,
		eventReconnectFailures: 0,
		eventReconnectDelayMs: 5e3,
		eventFallbackMode: false,
		resumeTimer: null,
		resumeVisualTimers: [],
		resumeRetryTimer: null,
		resumeSeq: 0,
		startupInProgress: false,
		draftSaveTimer: null,
		draftRestoreSeq: 0,
		draftAttachmentWarningShown: false,
		visualRecoveryTimers: [],
		visualRecoverySeq: 0,
		lastHeavyVisualRecoveryAt: 0,
		pollTimer: null,
		pollStableCount: 0,
		lastThreadSignature: "",
		renderedConversationSignature: "",
		renderedConversationPatchShellSignature: "",
		renderedThreadListSignature: "",
		tickTimer: null,
		relativeTimeTimer: null,
		nowMs: Date.now(),
		threadLoadSeq: 0,
		threadLoadController: null,
		threadLoadWatchdogTimer: null,
		refreshThreadController: null,
		threadListLoadSeq: 0,
		threadListLoadController: null,
		threadListLoadedAtMs: 0,
		threadListDeferredFallbackTimer: null,
		threadListDeferredSilentTimer: null,
		threadListRuntimeHeartbeatFrame: null,
		threadListRuntimeLastFrameAt: 0,
		threadListRuntimeLastReportAt: 0,
		threadListRuntimeLongTaskObserver: null,
		threadActionMenuId: "",
		threadLongPress: null,
		renameThreadId: "",
		continuationDialogThreadId: "",
		renameBusy: false,
		sidebarEdgeSwipe: null,
		androidBackSidebarSentinelReady: false,
		subagentSwipe: null,
		subagentPanelOpen: false,
		liveOperationDockMode: "compact",
		liveOperationDockGesture: null,
		liveOperationDockPinned: false,
		liveOperationDockPinnedThreadId: "",
		liveOperationDockCompactVisibleUntilMs: 0,
		liveOperationDockCompactHtml: "",
		liveOperationDockCompactThreadId: "",
		liveOperationDockCompactTimer: null,
		liveOperationDockRecallHtml: "",
		liveOperationDockRecallThreadId: "",
		liveOperationDockRecallAtMs: 0,
		threadSideChats: /* @__PURE__ */ new Map(),
		sideChatLoadingThreadId: "",
		sideChatError: "",
		sideChatBusyKey: "",
		sideChatDraftSaveTimer: null,
		sideChatDraftSaveSeq: 0,
		sideChatPollTimer: null,
		sideChatRenderSignature: "",
		sideChatNotice: null,
		suppressThreadClickUntil: 0,
		suppressThreadClickThreadId: "",
		continuationSourceThreadId: "",
		continuationNewThreadId: "",
		continuationJobId: "",
		goalDialogThreadId: "",
		goalDialogExistingGoal: null,
		goalDialogBusyText: "",
		goalSubmitBusy: false,
		lastGoalButtonSubmitAt: 0,
		pendingAttachments: [],
		composerBusy: false,
		composerComposing: false,
		messageInputPointerWasFocused: false,
		messageInputKeyboardRecoveryAt: 0,
		lastAttachmentPickerAt: 0,
		composerHeightPx: 0,
		messageInputHeightPx: 0,
		messageInputTextLength: 0,
		sendButtonHint: "",
		completionSoundEnabled: true,
		continuationBusy: false,
		maxUploadBytes: 64 * 1024 * 1024,
		maxUploadFiles: 12,
		rolloutWarningThresholdBytes: 100 * 1024 * 1024,
		appVersion: "",
		serverPlatform: "",
		appUpdateStatus: null,
		appUpdateBusy: false,
		appUpdateError: "",
		appUpdateRestarting: false,
		updatePanelOpen: false,
		publicReleaseStatus: null,
		publicReleaseBusy: false,
		publicReleaseEnabled: false,
		publicReleaseRepository: "",
		publicReleaseBranch: "main",
		publicPrStatus: null,
		publicPrBusy: false,
		publicPrError: "",
		publicPrEnabled: false,
		publicPrRepository: "",
		publicPrPromptedKey: localStorage.getItem("codexMobilePublicPrPromptKey") || "",
		appWorkspacePath: "",
		sharedRestartBusy: false,
		sharedRestarting: false,
		sharedRestartDialogOpen: false,
		sharedRestartRiskThreads: [],
		sharedRestartScopeLines: [],
		sharedRestartConfirmResolve: null,
		profileSwitchConfirmOpen: false,
		profileSwitchConfirmTargetId: "",
		profileSwitchConfirmLabel: "",
		profileSwitchConfirmResolve: null,
		threadArchiveConfirmOpen: false,
		threadArchiveConfirmTargetId: "",
		threadArchiveConfirmTitle: "",
		threadArchiveConfirmResolve: null,
		appNativeDialogOpen: false,
		appNativeDialogMode: "alert",
		appNativeDialogTitle: "提示",
		appNativeDialogMessage: "",
		appNativeDialogValue: "",
		appNativeDialogPlaceholder: "",
		appNativeDialogConfirmLabel: "确定",
		appNativeDialogCancelLabel: "取消",
		appNativeDialogRows: 4,
		appNativeDialogResolve: null,
		restartAutoRecoverThreads: [],
		serverBuildId: "",
		serverAssetBuildId: "",
		pageRefreshAvailable: false,
		pageRefreshBuildId: "",
		pageRefreshReason: "",
		pageRefreshPreparedConfig: null,
		pageRefreshBusy: false,
		pageRefreshReloading: false,
		pageRefreshTimer: null,
		pageRefreshLastCheckAt: 0,
		modelOptions: [],
		reasoningEffortOptions: [],
		permissionModeOptions: [
			"default",
			"auto",
			"full",
			"custom"
		],
		defaultModel: "",
		defaultReasoningEffort: "",
		defaultPermissionMode: "full",
		composerModel: "",
		composerEffort: "",
		composerPermissionMode: "",
		composerMenuKind: "",
		lastComposerRuntimePointerAt: 0,
		lastComposerRuntimePointerKind: "",
		lastComposerRuntimePointerTarget: null,
		composerIntentMenuOpen: false,
		composerIntentDialogKind: "",
		composerIntentDialogBusy: false,
		quotaDetailsOpen: false,
		newThreadModel: "",
		newThreadEffort: "",
		newThreadPermissionMode: "full",
		rateLimits: loadJsonStorage("codexMobileRateLimits", null),
		rateLimitsByModel: loadJsonStorage("codexMobileRateLimitsByModel", {}),
		codexProfiles: [],
		activeCodexProfileId: "",
		codexProfileSwitchSupported: false,
		codexProfileSwitchBusy: false,
		codexProfileRestarting: false,
		codexProfileSwitchTargetId: "",
		codexProfileSwitchStage: "",
		codexProfileSwitchStageTimers: [],
		codexProfileSwitchRequestId: "",
		codexProfileSwitchProgressTimer: null,
		pushServerSupported: false,
		pushSubscribed: false,
		pushBusy: false,
		pushError: "",
		serviceWorkerRegistration: null,
		mermaidLoadPromise: null,
		mermaidTheme: "",
		mermaidRenderSeq: 0,
		mermaidThemeObserver: null,
		pendingApprovals: /* @__PURE__ */ new Map(),
		threadTaskCardDraftStates: new Map(Object.entries(loadJsonStorage("codexMobileThreadTaskCardDraftStates", {}))),
		scheduledThreadTaskCardDraftCreations: /* @__PURE__ */ new Set(),
		activeThreadTaskCardDraftCreations: /* @__PURE__ */ new Set(),
		runningThreadIds: loadStringSetStorage("codexMobileRunningThreadIds"),
		runningThreadHintedAtById: loadNumberMapStorage("codexMobileRunningThreadHintedAtById", {}),
		unreadThreadIds: loadStringSetStorage("codexMobileUnreadThreadIds"),
		threadViewedAtById: loadNumberMapStorage("codexMobileThreadViewedAtById", {}),
		rolloutWarningDismissals: loadStringSetStorage("codexMobileDismissedRolloutWarnings"),
		codexFastMode: false,
		fontSize: localStorage.getItem("codexMobileFontSize") || INITIAL_PLUGIN_EMBED.appearance && INITIAL_PLUGIN_EMBED.appearance.fontSize || "default",
		activityLabel: "",
		activityAtMs: 0,
		lastSendButtonSubmitAt: 0,
		lastSendSubmitStartedAt: 0,
		uiWatchdogTimer: null,
		lastUiWatchdogTickAt: 0,
		lastUiStallReportedAt: 0,
		lastCompletionSoundAt: 0,
		completionAudioContext: null,
		completionAudioUnlocked: false,
		copyTextStore: /* @__PURE__ */ new Map(),
		copySeq: 0,
		copyFeedbackTimers: /* @__PURE__ */ new Map(),
		steerFeedback: null,
		steerFeedbackTimer: null,
		composerFastHintTimer: null,
		attachmentProcessingCount: 0,
		filePreviewSwipe: null,
		filePreviewThreadId: "",
		mermaidPinch: null,
		imagePreviewPinch: null,
		imagePreviewScale: 1,
		imageAuthRefreshRequested: false,
		threadHistoryBusy: false,
		threadHistoryError: "",
		threadHistoryAutoBackfillKeys: /* @__PURE__ */ new Set(),
		emptyDetailHistoryRecoveryAtByKey: /* @__PURE__ */ new Map(),
		perfEventLastReportedAt: {},
		homeAiDiagnosticReporter: homeAiDiagnosticReportingApi.createDiagnosticReporter({
			threshold: homeAiDiagnosticReportingApi.DEFAULT_THRESHOLD,
			throttleMs: homeAiDiagnosticReportingApi.DEFAULT_THROTTLE_MS
		}),
		frontendRuntimeHealthMonitor: frontendRuntimeHealthApi.createMonitor(),
		lastThreadDetailRenderEvidence: null,
		shellLoadedReported: false
	};
	if (typeof initializeRestartAutoRecoverThreads === "function") initializeRestartAutoRecoverThreads();
	var threadDetailRuntime = null;
	var appUpdateRuntime = null;
	function requireThreadDetailRuntime() {
		if (!threadDetailRuntime) throw new Error("CodexThreadDetailRuntime is not initialized");
		return threadDetailRuntime;
	}
	function requireAppUpdateRuntime() {
		if (!appUpdateRuntime) appUpdateRuntime = appUpdateRuntimeApi.createAppUpdateRuntime({
			state,
			CLIENT_BUILD_ID,
			PAGE_REFRESH_CHECK_INTERVAL_MS,
			PAGE_REFRESH_MIN_CHECK_INTERVAL_MS,
			PAGE_SHELL_ASSETS,
			STORAGE_PUBLIC_PR_PROMPT,
			PUBLIC_PR_REVIEW_THREAD_TITLE,
			buildRefreshPolicy,
			$,
			api,
			escapeHtml,
			normalizeFsPath,
			threadMatchesWorkspaceCwd,
			loadThreads,
			loadThread,
			setComposerText,
			scheduleCurrentDraftSave,
			updateComposerControls,
			composerHasContent,
			requestAppAlert,
			requestAppConfirmation,
			loadWorkspaces,
			postClientEvent,
			saveCurrentDraftNow,
			syncSidebarWorkspaceSelect,
			updateWorkspacePath,
			renderWorkspaceTokenUsage,
			isMenuOverlayMode,
			closeSidebarMenu,
			clearCurrentThreadSelection,
			restoreDraftForCurrentTarget,
			renderThreads,
			renderCurrentThread,
			showError,
			isRunningStatus,
			visibleThreads,
			threadById,
			shortPath,
			statusText,
			saveRestartAutoRecoverThreads,
			postPerformanceEvent,
			roundedDurationMs,
			isHermesEmbedMode,
			requestHermesPluginRefresh,
			rememberRateLimitsFromConfig,
			rememberCodexProfiles,
			renderCodexProfileSettings,
			stopCodexProfileSwitchProgressPolling,
			publishPluginNavigationState
		});
		return appUpdateRuntime;
	}
	var threadListSummaryFromDetailThread = (...args) => requireThreadDetailRuntime().threadListSummaryFromDetailThread(...args);
	var planThreadOpenCacheReuse = (...args) => requireThreadDetailRuntime().planThreadOpenCacheReuse(...args);
	var threadHasReusableLoadedDetailState = (...args) => requireThreadDetailRuntime().threadHasReusableLoadedDetailState(...args);
	function setAuthKey(value) {
		const next = String(value || "");
		if (state.key !== next) {
			state.key = next;
			state.imageAuthVersion = (Number(state.imageAuthVersion) || 0) + 1;
		}
		return state.key;
	}
	var MAX_COMMAND_OUTPUT_CHARS = 16e3;
	var MAX_LIVE_TEXT_CHARS = 6e4;
	var MAX_VISIBLE_TURNS = 10;
	var MAX_EXPANDED_VISIBLE_TURNS = 200;
	var MAX_RAW_THREAD_VISIBLE_TURNS = 4;
	var MAX_RAW_THREAD_VISIBLE_ITEMS_PER_TURN = 24;
	var PROTECTED_IMAGE_PLACEHOLDER_SRC = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
	var IMAGE_DIAGNOSTICS_ENABLED = false;
	var THREAD_LIST_PAGE_LIMIT = 200;
	var THREAD_LIST_DEFERRED_FALLBACK_DELAY_MS = 8e3;
	var THREAD_LIST_DEFERRED_FALLBACK_RETRY_MS = 2500;
	var LIVE_OPERATION_BUBBLE_MIN_VISIBLE_MS = liveOperationDockPolicy.DEFAULT_MIN_VISIBLE_MS;
	var CLIENT_BUILD_ID = String(readShellManifest().clientBuildId || "0.1.11|codex-mobile-shell-v625");
	var CODEX_PROFILE_SWITCH_STAGES = Object.freeze([
		{
			id: "profile_lookup",
			label: "正在读取目标 Profile"
		},
		{
			id: "workspace_trust",
			label: "正在同步目标账号的工作区信任"
		},
		{
			id: "mcp_toolset",
			label: "正在注册 Codex Mobile 工具"
		},
		{
			id: "preflight_spawn",
			label: "正在启动目标账号 app-server"
		},
		{
			id: "preflight_connect",
			label: "正在连接目标账号 app-server"
		},
		{
			id: "preflight_initialize",
			label: "正在初始化目标账号会话"
		},
		{
			id: "preflight_rate_limits",
			label: "正在读取目标账号额度"
		},
		{
			id: "preflight_done",
			label: "目标账号预检通过"
		},
		{
			id: "write_active_profile",
			label: "正在写入 active Profile 配置"
		},
		{
			id: "schedule_restart",
			label: "正在安排 Mobile Web 重启"
		},
		{
			id: "waiting_for_restart",
			label: "切换已写入，正在等待服务恢复"
		}
	]);
	var PLUGIN_VOICE_INPUT_LONG_PRESS_MS = 560;
	var LONG_RECEIPT_SCROLL_CHARS = 1200;
	var THREAD_HISTORY_TOP_LOAD_PX = 64;
	var HOST_EMBED_SPLIT_LEFT_MIN_PX = 160;
	var HOST_EMBED_SPLIT_VIEWPORT_MIN_PX = 900;
	var HOST_EMBED_SPLIT_FRAME_MIN_PX = 320;
	var PAGE_REFRESH_CHECK_INTERVAL_MS = 6e4;
	var PAGE_REFRESH_MIN_CHECK_INTERVAL_MS = 12e3;
	var HEAVY_VISUAL_RECOVERY_MIN_INTERVAL_MS = 4e3;
	var PUBLIC_CONFIG_TIMEOUT_MS = 8e3;
	var PUBLIC_CONFIG_RETRY_DELAYS_MS = [
		0,
		300,
		1200
	];
	var THREAD_LOAD_STALL_MS = 12e3;
	var THREAD_LIST_SLOW_PATH_MS = 1500;
	var THREAD_LIST_RUNTIME_STALL_MIN_MS = 1e3;
	var THREAD_LIST_RUNTIME_STALL_H2_MS = 3e3;
	var THREAD_LIST_RUNTIME_STALL_REPORT_INTERVAL_MS = 15e3;
	var PERF_EVENT_THROTTLE_MS = 2e3;
	var PERF_RENDER_REPORT_MIN_MS = 16;
	var PERF_SLOW_RENDER_REPORT_MS = 50;
	var PRIMARY_SHELL_CONFLICT_EVIDENCE_MS = 3e4;
	var EMPTY_DETAIL_HISTORY_RECOVERY_COOLDOWN_MS = 3e4;
	var RUNNING_THREAD_HINT_STALE_MS = 1200 * 1e3;
	var SUBMITTED_PROCESSING_HINT_STALE_MS = threadStatusHintPolicy.DEFAULT_SUBMITTED_PROCESSING_HINT_STALE_MS;
	var STATUS_EVENT_FRESHNESS_TOLERANCE_MS = threadStatusHintPolicy.DEFAULT_STATUS_EVENT_FRESHNESS_TOLERANCE_MS;
	var AUTO_TURN_RECOVERY_COOLDOWN_MS = 12e4;
	var GITHUB_LINK_PREVIEW_TIMEOUT_MS = 12e3;
	var PAGE_SHELL_ASSETS = Object.freeze(shellManifestList("pageShellAssets", [
		"/",
		"/index.html",
		"/styles.css",
		"/shell-asset-manifest.js",
		"/app-bootstrap.js",
		"/app.js",
		"/manifest.json",
		"/sw.js"
	]));
	var composerRuntime = null;
	var threadListRuntime = null;
	var threadTileRuntime = null;
	var CONVERSATION_SCROLL_INTENT_MS = 4e3;
	var AUTOMATIC_CONVERSATION_REFRESH_SOURCES = /* @__PURE__ */ new Set([
		"scheduled",
		"deferred-refresh",
		"summary-detail-recovery",
		"post-completion",
		"usage-backfill",
		"live-poll",
		"event-fallback-poll",
		"event-recovery",
		"resume"
	]);
	var STORAGE_THREAD_ID = "codexMobileCurrentThreadId";
	var STORAGE_CONTINUATION_JOB = "codexMobileContinuationJobId";
	var STORAGE_RUNNING_THREAD_IDS = "codexMobileRunningThreadIds";
	var STORAGE_RUNNING_THREAD_HINTED_AT = "codexMobileRunningThreadHintedAtById";
	var STORAGE_UNREAD_THREAD_IDS = "codexMobileUnreadThreadIds";
	var STORAGE_THREAD_VIEWED_AT = "codexMobileThreadViewedAtById";
	var STORAGE_DISMISSED_ROLLOUT_WARNINGS = "codexMobileDismissedRolloutWarnings";
	var STORAGE_FONT_SIZE = "codexMobileFontSize";
	var STORAGE_CODEX_FAST_MODE = "codexMobileCodexFastMode";
	var STORAGE_RATE_LIMITS = "codexMobileRateLimits";
	var STORAGE_RATE_LIMITS_BY_MODEL = "codexMobileRateLimitsByModel";
	var STORAGE_PUBLIC_PR_PROMPT = "codexMobilePublicPrPromptKey";
	var STORAGE_TASK_CARD_DRAFT_STATES = "codexMobileThreadTaskCardDraftStates";
	var STORAGE_RESTART_AUTO_RECOVER_THREADS = "codexMobileRestartAutoRecoverThreads";
	var STORAGE_COMPOSER_INTENT_DRAFTS = "codexMobileComposerIntentDrafts";
	var STORAGE_THREAD_DISPLAY_MODE = "codexMobileThreadDisplayMode";
	var STORAGE_LEGACY_THREAD_TILE_MODE = "codexMobileThreadTileMode";
	var PUBLIC_PR_REVIEW_THREAD_TITLE = "Codex Mobile Public PR";
	var MERMAID_SCRIPT_URL = "/vendor/mermaid.min.js";
	var MERMAID_MIN_SCALE = .65;
	var MERMAID_MAX_SCALE = 3.2;
	var MERMAID_ZOOM_STEP = .2;
	var SIDE_CHAT_DRAFT_SAVE_DEBOUNCE_MS = 450;
	var SIDE_CHAT_DRAFT_MAX_CHARS = 8e3;
	var COMPOSER_INTENT_BODY_MAX_CHARS = 12e3;
	function hasStartupThreadOpenIntent() {
		if (threadIdFromUrlValue(window.location.href)) return true;
		if (isHermesEmbedMode()) {
			const routeHint = pluginRouteHintFromUrl(window.location.href) || normalizePluginRouteHint(state.queuedPluginRouteHint);
			return Boolean(routeHint && routeHint.threadId);
		}
		return Boolean(localStorage.getItem(STORAGE_THREAD_ID) || "");
	}
	function postStartupStage(stage, startedAt, details = {}) {
		postClientEvent("startup_stage", Object.assign({
			stage,
			elapsedMs: roundedDurationMs(startedAt),
			hasThreadOpenIntent: Boolean(state.startupThreadOpenPending),
			currentThreadId: state.currentThreadId || "",
			threadListCount: Array.isArray(state.threads) ? state.threads.length : 0
		}, details || {}));
	}
	async function fetchJsonWithTimeout(path, options = {}) {
		const timeoutMs = Math.max(1, Number(options.timeoutMs || 3e4));
		const controller = new AbortController();
		let timedOut = false;
		const timer = setTimeout(() => {
			timedOut = true;
			controller.abort();
		}, timeoutMs);
		try {
			const response = await fetch(path, {
				signal: controller.signal,
				cache: options.cache || "no-store"
			});
			if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
			return await response.json();
		} catch (err) {
			if (err && err.name === "AbortError" && timedOut) throw new Error(`Request timed out: ${path}`);
			throw err;
		} finally {
			clearTimeout(timer);
		}
	}
	async function fetchPublicConfigWithRetry(startedAt) {
		let lastError = null;
		for (let index = 0; index < PUBLIC_CONFIG_RETRY_DELAYS_MS.length; index += 1) {
			const delay = PUBLIC_CONFIG_RETRY_DELAYS_MS[index];
			if (delay > 0) await sleep(delay);
			try {
				const configStartedAt = nowPerfMs();
				const config = await fetchJsonWithTimeout("/api/public-config", { timeoutMs: PUBLIC_CONFIG_TIMEOUT_MS });
				postStartupStage("public_config_done", startedAt, {
					durationMs: roundedDurationMs(configStartedAt),
					attempts: index + 1
				});
				return config;
			} catch (err) {
				lastError = err;
				postStartupStage("public_config_retry", startedAt, {
					attempt: index + 1,
					remainingAttempts: Math.max(0, PUBLIC_CONFIG_RETRY_DELAYS_MS.length - index - 1),
					error: err && err.message ? err.message : String(err)
				});
				if (isHermesEmbedMode()) showPluginEmbedRecovering("Loading Codex Mobile...");
				else if (state.key) showApp();
			}
		}
		throw lastError || /* @__PURE__ */ new Error("Failed to load public config");
	}
	var DRAFT_SAVE_DEBOUNCE_MS = 250;
	var THREAD_TASK_CARD_DRAFT_CREATE_STALE_MS = 45e3;
	var THREAD_TASK_CARD_DRAFT_CREATE_MAX_ATTEMPTS = 3;
	var THREAD_TASK_CARD_BODY_MAX_CHARS = 8e3;
	var THREAD_TASK_CARD_COMMAND_PREFIX = "#";
	var THREAD_TASK_CARD_LEGACY_COMMAND_PREFIX = "#自由协作";
	var THREAD_GOAL_COMMAND_PREFIX = "/g";
	var THREAD_GOAL_MENTION_PATTERN = /^@(目标任务|目标|Goal|Thread\s*Goal|g)$/i;
	var THREAD_TASK_CARD_MENTION_PATTERN = /^@(任务卡片|Task\s*Card|TaskCard)(?:\s|$)/i;
	var THREAD_TASK_CARD_AUTONOMOUS_MENTION_PATTERN = /^@(自由协作|Autonomous|Auto\s*Task\s*Card|AutoTaskCard)(?:\s|$)/i;
	var THREAD_TASK_CARD_REQUEST_TAG = "codex-mobile-thread-task-card-request";
	var THREAD_TASK_CARD_DRAFT_TAG = "codex-mobile-thread-task-card-draft";
	var THREAD_TILE_REFRESH_INTERVAL_MS = 2400;
	var THREAD_TILE_REFRESH_MIN_INTERVAL_MS = 1100;
	var THREAD_TILE_SETTINGS_SAVE_DEBOUNCE_MS = 500;
	var THREAD_TILE_USER_MAX_PANES = Math.max(1, Math.floor(Number(threadTileLayoutPolicy.DEFAULT_USER_MAX_PANES || threadTileLayoutPolicy.DEFAULT_MAX_PANES || 6)) || 6);
	var THREAD_TILE_DETAIL_LOAD_QUEUE_DRAIN_MS = 120;
	var THEME_VALUES = /* @__PURE__ */ new Set([
		"system",
		"dark",
		"light"
	]);
	var FONT_SIZE_VALUES = /* @__PURE__ */ new Set([
		"small",
		"default",
		"large",
		"xlarge",
		"xxlarge"
	]);
	var MENU_OVERLAY_MEDIA = "(max-width: 1180px), (pointer: coarse) and (max-width: 1400px)";
	var TABLET_SPLIT_MEDIA = "(pointer: coarse) and (orientation: landscape) and (min-width: 900px) and (min-height: 600px)";
	var SIDEBAR_EDGE_SWIPE_PX = 34;
	var ANDROID_SIDEBAR_EDGE_SWIPE_PX = 44;
	var PLUGIN_EMBED_BACK_EDGE_SWIPE_PX = 44;
	var PLUGIN_EMBED_BACK_SWIPE_MIN_PX = 58;
	var PLUGIN_EMBED_BACK_SWIPE_HORIZONTAL_RATIO = 2.2;
	var PLUGIN_EMBED_BACK_RECENT_SCROLL_SUPPRESS_MS = 1200;
	var ANDROID_BACK_SIDEBAR_STATE = "codexMobileAndroidBackSidebar";
	var ANDROID_BACK_SIDEBAR_BASE = "base";
	var ANDROID_BACK_SIDEBAR_TOP = "top";
	var SIDEBAR_EDGE_OPEN_MIN_PX = 76;
	var SIDEBAR_EDGE_OPEN_RATIO = .22;
	var SUBAGENT_EDGE_SWIPE_PX = 56;
	var SUBAGENT_EDGE_SWIPE_MAX_PX = 88;
	var SUBAGENT_EDGE_SWIPE_RATIO = .08;
	var SUBAGENT_SWIPE_MIN_PX = 70;
	var SUBAGENT_WHEEL_SWIPE_MIN_PX = 48;
	var FILE_PREVIEW_SWIPE_CLOSE_MIN_PX = 62;
	var IMAGE_PREVIEW_ZOOM_STEP = .25;
	var IMAGE_PREVIEW_MIN_SCALE = .5;
	var IMAGE_PREVIEW_MAX_SCALE = 4;
	var OPERATIONAL_ITEM_TYPES = /* @__PURE__ */ new Set([
		"commandExecution",
		"collabAgentToolCall",
		"fileChange",
		"dynamicToolCall",
		"mcpToolCall"
	]);
	var HIDDEN_SERVER_REQUEST_METHODS = /* @__PURE__ */ new Set(["item/tool/call"]);
	var USER_INPUT_REQUEST_METHODS = /* @__PURE__ */ new Set(["item/tool/requestUserInput", "mcpServer/elicitation/request"]);
	var CONTEXT_COMPACTION_PENDING_NOTICE = "历史上下文正在压缩";
	var CONTEXT_COMPACTION_COMPLETE_NOTICE = "历史上下文已压缩";
	var $ = (id) => document.getElementById(id);
	var apiClient = window.CodexApiClient.createApiClient({
		fetch: window.fetch.bind(window),
		AbortControllerCtor: AbortController,
		FormDataCtor: window.FormData,
		getKey() {
			return state.key;
		},
		onUnauthorized() {
			if (isHermesEmbedMode()) {
				requestHermesPluginRefresh("auth_state_changed");
				showPluginEmbedRecovering("Refreshing Codex Mobile plugin session...");
			} else showLogin();
		},
		onResponseError(details) {
			if (!isHermesEmbedMode()) return;
			const reason = pluginRefreshReasonForApiError(details);
			if (!reason) return;
			requestHermesPluginRefresh(reason);
		}
	});
	var runtimeSettings = window.CodexRuntimeSettings;
	var viewportMetrics = window.CodexViewportMetrics;
	var conversationScroll = window.CodexConversationScroll;
	var imageCompressor = window.CodexImageCompressor;
	var draftStore = window.CodexDraftStore.createDraftStore({
		storage: localStorage,
		indexedDB: window.indexedDB,
		FileCtor: window.File,
		URLApi: URL,
		IDBKeyRangeCtor: window.IDBKeyRange,
		normalizeFsPath,
		reportError(type, details) {
			postClientEvent(type, details || {});
		}
	});
	function createAppBootstrapRuntime() {
		return {
			state,
			apiClient,
			draftStore,
			clientBuildId: CLIENT_BUILD_ID,
			pageShellAssets: PAGE_SHELL_ASSETS
		};
	}
	function installClassicGlobalBindings(root, names) {
		if (!root || typeof root.eval !== "function") return;
		const validIdentifier = /^[A-Za-z_$][0-9A-Za-z_$]*$/;
		const uniqueNames = Array.from(new Set((names || []).filter((name) => validIdentifier.test(String(name || "")))));
		for (const name of uniqueNames) try {
			(0, root.eval)(`var ${name} = globalThis[${JSON.stringify(name)}];`);
		} catch (_) {}
	}
	function classicGlobalBindingNamesFromManifest() {
		const manifest = readShellManifest();
		return (manifest && Array.isArray(manifest.classicGlobalExports) ? manifest.classicGlobalExports : []).flatMap((entry) => Array.isArray(entry && entry.globals) ? entry.globals : []);
	}
	(function exposeCodexAppBootstrap(root) {
		const appBootstrapApi = { createAppBootstrapRuntime };
		if (typeof module === "object" && module.exports) module.exports = appBootstrapApi;
		Object.assign(root, {
			"readShellManifest": readShellManifest,
			"shellManifestList": shellManifestList,
			"initialPluginLaunchKeyFromUrl": initialPluginLaunchKeyFromUrl,
			"pluginEmbedApi": pluginEmbedApi,
			"pluginVoiceInputApi": pluginVoiceInputApi,
			"homeAiDiagnosticReportingApi": homeAiDiagnosticReportingApi,
			"threadDiagnosticEventsApi": threadDiagnosticEventsApi,
			"frontendRuntimeHealthApi": frontendRuntimeHealthApi,
			"buildRefreshPolicy": buildRefreshPolicy,
			"appUpdateRuntimeApi": appUpdateRuntimeApi,
			"sideChatRuntimeApi": sideChatRuntimeApi,
			"mediaPreviewRuntimeApi": mediaPreviewRuntimeApi,
			"threadStatusHintPolicy": threadStatusHintPolicy,
			"threadPerformanceMetrics": threadPerformanceMetrics,
			"threadListLoadPolicy": threadListLoadPolicy,
			"threadListStableOrderPolicy": threadListStableOrderPolicy,
			"clientRenderStabilityGuard": clientRenderStabilityGuard,
			"liveOperationDockPolicy": liveOperationDockPolicy,
			"threadDetailStateApi": threadDetailStateApi,
			"threadDetailRenderPlanApi": threadDetailRenderPlanApi,
			"threadDetailMergeStateApi": threadDetailMergeStateApi,
			"threadDetailV4MergeStateApi": threadDetailV4MergeStateApi,
			"threadDetailRuntimeApi": threadDetailRuntimeApi,
			"threadDetailPatchPlanApi": threadDetailPatchPlanApi,
			"threadDetailDomPatchApi": threadDetailDomPatchApi,
			"threadDetailActionsApi": threadDetailActionsApi,
			"threadTileActionsApi": threadTileActionsApi,
			"threadTileStatePolicy": threadTileStatePolicy,
			"threadTileLayoutPolicy": threadTileLayoutPolicy,
			"threadTileRuntimeApi": threadTileRuntimeApi,
			"composerRuntimeApi": composerRuntimeApi,
			"INITIAL_PLUGIN_EMBED": INITIAL_PLUGIN_EMBED,
			"INITIAL_PLUGIN_LAUNCH_KEY": INITIAL_PLUGIN_LAUNCH_KEY,
			"loadJsonStorage": loadJsonStorage,
			"loadStringSetStorage": loadStringSetStorage,
			"loadNumberMapStorage": loadNumberMapStorage,
			"normalizeFsPath": normalizeFsPath,
			"state": state,
			"threadDetailRuntime": threadDetailRuntime,
			"appUpdateRuntime": appUpdateRuntime,
			"requireThreadDetailRuntime": requireThreadDetailRuntime,
			"requireAppUpdateRuntime": requireAppUpdateRuntime,
			"threadListSummaryFromDetailThread": threadListSummaryFromDetailThread,
			"planThreadOpenCacheReuse": planThreadOpenCacheReuse,
			"threadHasReusableLoadedDetailState": threadHasReusableLoadedDetailState,
			"setAuthKey": setAuthKey,
			"MAX_COMMAND_OUTPUT_CHARS": MAX_COMMAND_OUTPUT_CHARS,
			"MAX_LIVE_TEXT_CHARS": MAX_LIVE_TEXT_CHARS,
			"MAX_VISIBLE_TURNS": MAX_VISIBLE_TURNS,
			"MAX_EXPANDED_VISIBLE_TURNS": MAX_EXPANDED_VISIBLE_TURNS,
			"MAX_RAW_THREAD_VISIBLE_TURNS": MAX_RAW_THREAD_VISIBLE_TURNS,
			"MAX_RAW_THREAD_VISIBLE_ITEMS_PER_TURN": MAX_RAW_THREAD_VISIBLE_ITEMS_PER_TURN,
			"PROTECTED_IMAGE_PLACEHOLDER_SRC": PROTECTED_IMAGE_PLACEHOLDER_SRC,
			"IMAGE_DIAGNOSTICS_ENABLED": IMAGE_DIAGNOSTICS_ENABLED,
			"THREAD_LIST_PAGE_LIMIT": THREAD_LIST_PAGE_LIMIT,
			"THREAD_LIST_DEFERRED_FALLBACK_DELAY_MS": THREAD_LIST_DEFERRED_FALLBACK_DELAY_MS,
			"THREAD_LIST_DEFERRED_FALLBACK_RETRY_MS": THREAD_LIST_DEFERRED_FALLBACK_RETRY_MS,
			"LIVE_OPERATION_BUBBLE_MIN_VISIBLE_MS": LIVE_OPERATION_BUBBLE_MIN_VISIBLE_MS,
			"CLIENT_BUILD_ID": CLIENT_BUILD_ID,
			"CODEX_PROFILE_SWITCH_STAGES": CODEX_PROFILE_SWITCH_STAGES,
			"PLUGIN_VOICE_INPUT_LONG_PRESS_MS": PLUGIN_VOICE_INPUT_LONG_PRESS_MS,
			"LONG_RECEIPT_SCROLL_CHARS": LONG_RECEIPT_SCROLL_CHARS,
			"THREAD_HISTORY_TOP_LOAD_PX": THREAD_HISTORY_TOP_LOAD_PX,
			"HOST_EMBED_SPLIT_LEFT_MIN_PX": HOST_EMBED_SPLIT_LEFT_MIN_PX,
			"HOST_EMBED_SPLIT_VIEWPORT_MIN_PX": HOST_EMBED_SPLIT_VIEWPORT_MIN_PX,
			"HOST_EMBED_SPLIT_FRAME_MIN_PX": HOST_EMBED_SPLIT_FRAME_MIN_PX,
			"PAGE_REFRESH_CHECK_INTERVAL_MS": PAGE_REFRESH_CHECK_INTERVAL_MS,
			"PAGE_REFRESH_MIN_CHECK_INTERVAL_MS": PAGE_REFRESH_MIN_CHECK_INTERVAL_MS,
			"HEAVY_VISUAL_RECOVERY_MIN_INTERVAL_MS": HEAVY_VISUAL_RECOVERY_MIN_INTERVAL_MS,
			"PUBLIC_CONFIG_TIMEOUT_MS": PUBLIC_CONFIG_TIMEOUT_MS,
			"PUBLIC_CONFIG_RETRY_DELAYS_MS": PUBLIC_CONFIG_RETRY_DELAYS_MS,
			"THREAD_LOAD_STALL_MS": THREAD_LOAD_STALL_MS,
			"THREAD_LIST_SLOW_PATH_MS": THREAD_LIST_SLOW_PATH_MS,
			"THREAD_LIST_RUNTIME_STALL_MIN_MS": THREAD_LIST_RUNTIME_STALL_MIN_MS,
			"THREAD_LIST_RUNTIME_STALL_H2_MS": THREAD_LIST_RUNTIME_STALL_H2_MS,
			"THREAD_LIST_RUNTIME_STALL_REPORT_INTERVAL_MS": THREAD_LIST_RUNTIME_STALL_REPORT_INTERVAL_MS,
			"PERF_EVENT_THROTTLE_MS": PERF_EVENT_THROTTLE_MS,
			"PERF_RENDER_REPORT_MIN_MS": PERF_RENDER_REPORT_MIN_MS,
			"PERF_SLOW_RENDER_REPORT_MS": PERF_SLOW_RENDER_REPORT_MS,
			"PRIMARY_SHELL_CONFLICT_EVIDENCE_MS": PRIMARY_SHELL_CONFLICT_EVIDENCE_MS,
			"EMPTY_DETAIL_HISTORY_RECOVERY_COOLDOWN_MS": EMPTY_DETAIL_HISTORY_RECOVERY_COOLDOWN_MS,
			"RUNNING_THREAD_HINT_STALE_MS": RUNNING_THREAD_HINT_STALE_MS,
			"SUBMITTED_PROCESSING_HINT_STALE_MS": SUBMITTED_PROCESSING_HINT_STALE_MS,
			"STATUS_EVENT_FRESHNESS_TOLERANCE_MS": STATUS_EVENT_FRESHNESS_TOLERANCE_MS,
			"AUTO_TURN_RECOVERY_COOLDOWN_MS": AUTO_TURN_RECOVERY_COOLDOWN_MS,
			"GITHUB_LINK_PREVIEW_TIMEOUT_MS": GITHUB_LINK_PREVIEW_TIMEOUT_MS,
			"PAGE_SHELL_ASSETS": PAGE_SHELL_ASSETS,
			"composerRuntime": composerRuntime,
			"threadListRuntime": threadListRuntime,
			"threadTileRuntime": threadTileRuntime,
			"CONVERSATION_SCROLL_INTENT_MS": CONVERSATION_SCROLL_INTENT_MS,
			"AUTOMATIC_CONVERSATION_REFRESH_SOURCES": AUTOMATIC_CONVERSATION_REFRESH_SOURCES,
			"STORAGE_THREAD_ID": STORAGE_THREAD_ID,
			"STORAGE_CONTINUATION_JOB": STORAGE_CONTINUATION_JOB,
			"STORAGE_RUNNING_THREAD_IDS": STORAGE_RUNNING_THREAD_IDS,
			"STORAGE_RUNNING_THREAD_HINTED_AT": STORAGE_RUNNING_THREAD_HINTED_AT,
			"STORAGE_UNREAD_THREAD_IDS": STORAGE_UNREAD_THREAD_IDS,
			"STORAGE_THREAD_VIEWED_AT": STORAGE_THREAD_VIEWED_AT,
			"STORAGE_DISMISSED_ROLLOUT_WARNINGS": STORAGE_DISMISSED_ROLLOUT_WARNINGS,
			"STORAGE_FONT_SIZE": STORAGE_FONT_SIZE,
			"STORAGE_CODEX_FAST_MODE": STORAGE_CODEX_FAST_MODE,
			"STORAGE_RATE_LIMITS": STORAGE_RATE_LIMITS,
			"STORAGE_RATE_LIMITS_BY_MODEL": STORAGE_RATE_LIMITS_BY_MODEL,
			"STORAGE_PUBLIC_PR_PROMPT": STORAGE_PUBLIC_PR_PROMPT,
			"STORAGE_TASK_CARD_DRAFT_STATES": STORAGE_TASK_CARD_DRAFT_STATES,
			"STORAGE_RESTART_AUTO_RECOVER_THREADS": STORAGE_RESTART_AUTO_RECOVER_THREADS,
			"STORAGE_COMPOSER_INTENT_DRAFTS": STORAGE_COMPOSER_INTENT_DRAFTS,
			"STORAGE_THREAD_DISPLAY_MODE": STORAGE_THREAD_DISPLAY_MODE,
			"STORAGE_LEGACY_THREAD_TILE_MODE": STORAGE_LEGACY_THREAD_TILE_MODE,
			"PUBLIC_PR_REVIEW_THREAD_TITLE": PUBLIC_PR_REVIEW_THREAD_TITLE,
			"MERMAID_SCRIPT_URL": MERMAID_SCRIPT_URL,
			"MERMAID_MIN_SCALE": MERMAID_MIN_SCALE,
			"MERMAID_MAX_SCALE": MERMAID_MAX_SCALE,
			"MERMAID_ZOOM_STEP": MERMAID_ZOOM_STEP,
			"SIDE_CHAT_DRAFT_SAVE_DEBOUNCE_MS": SIDE_CHAT_DRAFT_SAVE_DEBOUNCE_MS,
			"SIDE_CHAT_DRAFT_MAX_CHARS": SIDE_CHAT_DRAFT_MAX_CHARS,
			"COMPOSER_INTENT_BODY_MAX_CHARS": COMPOSER_INTENT_BODY_MAX_CHARS,
			"hasStartupThreadOpenIntent": hasStartupThreadOpenIntent,
			"postStartupStage": postStartupStage,
			"fetchPublicConfigWithRetry": fetchPublicConfigWithRetry,
			"DRAFT_SAVE_DEBOUNCE_MS": DRAFT_SAVE_DEBOUNCE_MS,
			"THREAD_TASK_CARD_DRAFT_CREATE_STALE_MS": THREAD_TASK_CARD_DRAFT_CREATE_STALE_MS,
			"THREAD_TASK_CARD_DRAFT_CREATE_MAX_ATTEMPTS": THREAD_TASK_CARD_DRAFT_CREATE_MAX_ATTEMPTS,
			"THREAD_TASK_CARD_BODY_MAX_CHARS": THREAD_TASK_CARD_BODY_MAX_CHARS,
			"THREAD_TASK_CARD_COMMAND_PREFIX": THREAD_TASK_CARD_COMMAND_PREFIX,
			"THREAD_TASK_CARD_LEGACY_COMMAND_PREFIX": THREAD_TASK_CARD_LEGACY_COMMAND_PREFIX,
			"THREAD_GOAL_COMMAND_PREFIX": THREAD_GOAL_COMMAND_PREFIX,
			"THREAD_GOAL_MENTION_PATTERN": THREAD_GOAL_MENTION_PATTERN,
			"THREAD_TASK_CARD_MENTION_PATTERN": THREAD_TASK_CARD_MENTION_PATTERN,
			"THREAD_TASK_CARD_AUTONOMOUS_MENTION_PATTERN": THREAD_TASK_CARD_AUTONOMOUS_MENTION_PATTERN,
			"THREAD_TASK_CARD_REQUEST_TAG": THREAD_TASK_CARD_REQUEST_TAG,
			"THREAD_TASK_CARD_DRAFT_TAG": THREAD_TASK_CARD_DRAFT_TAG,
			"THREAD_TILE_REFRESH_INTERVAL_MS": THREAD_TILE_REFRESH_INTERVAL_MS,
			"THREAD_TILE_REFRESH_MIN_INTERVAL_MS": THREAD_TILE_REFRESH_MIN_INTERVAL_MS,
			"THREAD_TILE_SETTINGS_SAVE_DEBOUNCE_MS": THREAD_TILE_SETTINGS_SAVE_DEBOUNCE_MS,
			"THREAD_TILE_USER_MAX_PANES": THREAD_TILE_USER_MAX_PANES,
			"THREAD_TILE_DETAIL_LOAD_QUEUE_DRAIN_MS": THREAD_TILE_DETAIL_LOAD_QUEUE_DRAIN_MS,
			"THEME_VALUES": THEME_VALUES,
			"FONT_SIZE_VALUES": FONT_SIZE_VALUES,
			"MENU_OVERLAY_MEDIA": MENU_OVERLAY_MEDIA,
			"TABLET_SPLIT_MEDIA": TABLET_SPLIT_MEDIA,
			"SIDEBAR_EDGE_SWIPE_PX": SIDEBAR_EDGE_SWIPE_PX,
			"ANDROID_SIDEBAR_EDGE_SWIPE_PX": ANDROID_SIDEBAR_EDGE_SWIPE_PX,
			"PLUGIN_EMBED_BACK_EDGE_SWIPE_PX": PLUGIN_EMBED_BACK_EDGE_SWIPE_PX,
			"PLUGIN_EMBED_BACK_SWIPE_MIN_PX": PLUGIN_EMBED_BACK_SWIPE_MIN_PX,
			"PLUGIN_EMBED_BACK_SWIPE_HORIZONTAL_RATIO": PLUGIN_EMBED_BACK_SWIPE_HORIZONTAL_RATIO,
			"PLUGIN_EMBED_BACK_RECENT_SCROLL_SUPPRESS_MS": PLUGIN_EMBED_BACK_RECENT_SCROLL_SUPPRESS_MS,
			"ANDROID_BACK_SIDEBAR_STATE": ANDROID_BACK_SIDEBAR_STATE,
			"ANDROID_BACK_SIDEBAR_BASE": ANDROID_BACK_SIDEBAR_BASE,
			"ANDROID_BACK_SIDEBAR_TOP": ANDROID_BACK_SIDEBAR_TOP,
			"SIDEBAR_EDGE_OPEN_MIN_PX": SIDEBAR_EDGE_OPEN_MIN_PX,
			"SIDEBAR_EDGE_OPEN_RATIO": SIDEBAR_EDGE_OPEN_RATIO,
			"SUBAGENT_EDGE_SWIPE_PX": SUBAGENT_EDGE_SWIPE_PX,
			"SUBAGENT_EDGE_SWIPE_MAX_PX": SUBAGENT_EDGE_SWIPE_MAX_PX,
			"SUBAGENT_EDGE_SWIPE_RATIO": SUBAGENT_EDGE_SWIPE_RATIO,
			"SUBAGENT_SWIPE_MIN_PX": SUBAGENT_SWIPE_MIN_PX,
			"SUBAGENT_WHEEL_SWIPE_MIN_PX": SUBAGENT_WHEEL_SWIPE_MIN_PX,
			"FILE_PREVIEW_SWIPE_CLOSE_MIN_PX": FILE_PREVIEW_SWIPE_CLOSE_MIN_PX,
			"IMAGE_PREVIEW_ZOOM_STEP": IMAGE_PREVIEW_ZOOM_STEP,
			"IMAGE_PREVIEW_MIN_SCALE": IMAGE_PREVIEW_MIN_SCALE,
			"IMAGE_PREVIEW_MAX_SCALE": IMAGE_PREVIEW_MAX_SCALE,
			"OPERATIONAL_ITEM_TYPES": OPERATIONAL_ITEM_TYPES,
			"HIDDEN_SERVER_REQUEST_METHODS": HIDDEN_SERVER_REQUEST_METHODS,
			"USER_INPUT_REQUEST_METHODS": USER_INPUT_REQUEST_METHODS,
			"CONTEXT_COMPACTION_PENDING_NOTICE": CONTEXT_COMPACTION_PENDING_NOTICE,
			"CONTEXT_COMPACTION_COMPLETE_NOTICE": CONTEXT_COMPACTION_COMPLETE_NOTICE,
			"$": $,
			"apiClient": apiClient,
			"runtimeSettings": runtimeSettings,
			"viewportMetrics": viewportMetrics,
			"conversationScroll": conversationScroll,
			"imageCompressor": imageCompressor,
			"draftStore": draftStore,
			"createAppBootstrapRuntime": createAppBootstrapRuntime
		});
		installClassicGlobalBindings(root, classicGlobalBindingNamesFromManifest().concat([
			"readShellManifest",
			"shellManifestList",
			"initialPluginLaunchKeyFromUrl",
			"pluginEmbedApi",
			"pluginVoiceInputApi",
			"homeAiDiagnosticReportingApi",
			"threadDiagnosticEventsApi",
			"frontendRuntimeHealthApi",
			"buildRefreshPolicy",
			"appUpdateRuntimeApi",
			"sideChatRuntimeApi",
			"mediaPreviewRuntimeApi",
			"threadStatusHintPolicy",
			"threadPerformanceMetrics",
			"threadListLoadPolicy",
			"threadListStableOrderPolicy",
			"clientRenderStabilityGuard",
			"liveOperationDockPolicy",
			"threadDetailStateApi",
			"threadDetailRenderPlanApi",
			"threadDetailMergeStateApi",
			"threadDetailV4MergeStateApi",
			"threadDetailRuntimeApi",
			"threadDetailPatchPlanApi",
			"threadDetailDomPatchApi",
			"threadDetailActionsApi",
			"threadTileActionsApi",
			"threadTileStatePolicy",
			"threadTileLayoutPolicy",
			"threadTileRuntimeApi",
			"composerRuntimeApi",
			"INITIAL_PLUGIN_EMBED",
			"INITIAL_PLUGIN_LAUNCH_KEY",
			"state",
			"threadDetailRuntime",
			"appUpdateRuntime",
			"apiClient",
			"runtimeSettings",
			"viewportMetrics",
			"conversationScroll",
			"imageCompressor",
			"draftStore",
			"isHermesEmbedMode",
			"exchangePluginLaunchSession",
			"requestHermesPluginRefresh",
			"pluginRefreshReasonForApiError",
			"showPluginEmbedRecovering",
			"hidePluginStartupLoading",
			"showLogin",
			"showApp",
			"bootstrap",
			"createAppBootstrapRuntime"
		]));
		root.CodexAppBootstrap = appBootstrapApi;
	})(typeof globalThis !== "undefined" ? globalThis : window);
}));
//#endregion
export default require_app_bootstrap();
