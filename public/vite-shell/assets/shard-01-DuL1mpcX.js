import { n as __toESM, t as __commonJSMin } from "./rolldown-runtime-FDOR9p9I.js";
//#region public/build-refresh-policy.js
var require_build_refresh_policy = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexBuildRefreshPolicy = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		function normalizeBuildId(value) {
			return String(value || "").trim();
		}
		function shellSequenceFromBuildId(value) {
			const match = normalizeBuildId(value).match(/\bcodex-mobile-shell-v([0-9]+)\b/);
			if (!match) return null;
			const parsed = Number.parseInt(match[1], 10);
			return Number.isSafeInteger(parsed) ? parsed : null;
		}
		function classifyServerBuildChange(serverBuildId, clientBuildId) {
			const server = normalizeBuildId(serverBuildId);
			const client = normalizeBuildId(clientBuildId);
			if (!server || !client || server === client) return "same";
			const serverSeq = shellSequenceFromBuildId(server);
			const clientSeq = shellSequenceFromBuildId(client);
			if (serverSeq !== null && clientSeq !== null) {
				if (serverSeq > clientSeq) return "server-newer";
				if (serverSeq < clientSeq) return "client-newer";
			}
			return "changed";
		}
		function shouldPromptForServerBuildChange(serverBuildId, clientBuildId) {
			const direction = classifyServerBuildChange(serverBuildId, clientBuildId);
			return direction === "server-newer" || direction === "changed";
		}
		return {
			shellSequenceFromBuildId,
			classifyServerBuildChange,
			shouldPromptForServerBuildChange
		};
	});
}));
//#endregion
//#region public/runtime-settings.js
var require_runtime_settings = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexRuntimeSettings = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		const MODEL_LABELS = {
			"gpt-5.5": "GPT-5.5",
			"gpt-5.4": "GPT-5.4",
			"gpt-5.4-mini": "GPT-5.4 Mini",
			"gpt-5.3-codex": "GPT-5.3 Codex",
			"gpt-5.3-codex-spark": "GPT-5.3 Codex Spark",
			"gpt-5.2": "GPT-5.2"
		};
		const COMPACT_MODEL_LABELS = {
			"gpt-5.5": "5.5",
			"gpt-5.4": "5.4",
			"gpt-5.4-mini": "5.4 Mini",
			"gpt-5.3-codex": "5.3 Codex",
			"gpt-5.3-codex-spark": "5.3 Spark",
			"gpt-5.2": "5.2"
		};
		const EFFORT_LABELS = {
			low: "Low",
			medium: "Medium",
			high: "High",
			xhigh: "XHigh"
		};
		const PERMISSION_LABELS = {
			default: "默认权限",
			auto: "自动审查",
			full: "完全访问权限",
			custom: "自定义 (config.toml)"
		};
		const PERMISSION_ALIASES = {
			"full-access": "full",
			"workspace-write": "auto",
			"read-only": "auto",
			"auto-review": "auto",
			"auto-reviewing": "auto",
			config: "custom",
			"config.toml": "custom",
			"custom-config": "custom"
		};
		function normalizeOptionList(values) {
			return [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))];
		}
		function labelForModel(value) {
			return MODEL_LABELS[value] || value;
		}
		function compactLabelForModel(value) {
			return COMPACT_MODEL_LABELS[value] || labelForModel(value).replace(/^GPT-/, "");
		}
		function labelForEffort(value) {
			return EFFORT_LABELS[value] || value;
		}
		function labelForPermissionMode(value) {
			return PERMISSION_LABELS[value] || value || "Perm";
		}
		function titleForPermissionMode(value) {
			return PERMISSION_LABELS[value] || "Thread permission";
		}
		function normalizePermissionModeValue(value) {
			const text = String(value || "").trim().toLowerCase();
			return PERMISSION_ALIASES[text] || text;
		}
		function firstRuntimeValue(values) {
			return normalizeOptionList(values)[0] || "";
		}
		function selectedNewThreadModel(settings) {
			return firstRuntimeValue([
				settings && settings.selected,
				settings && settings.defaultValue,
				...settings && settings.options || []
			]);
		}
		function selectedNewThreadEffort(settings) {
			return firstRuntimeValue([
				settings && settings.selected,
				settings && settings.defaultValue,
				...settings && settings.options || []
			]);
		}
		function selectedNewThreadPermission(settings) {
			const normalized = normalizePermissionModeValue(settings && settings.selected);
			if (normalized) return normalized;
			return normalizePermissionModeValue(settings && settings.defaultValue) || normalizePermissionModeValue((settings && settings.options || [])[0]) || "full";
		}
		return {
			normalizeOptionList,
			labelForModel,
			compactLabelForModel,
			labelForEffort,
			labelForPermissionMode,
			titleForPermissionMode,
			normalizePermissionModeValue,
			selectedNewThreadModel,
			selectedNewThreadEffort,
			selectedNewThreadPermission
		};
	});
}));
//#endregion
//#region public/viewport-metrics.js
var require_viewport_metrics = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexViewportMetrics = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		const DEFAULT_KEYBOARD_SHRINK_PX = 120;
		const DEFAULT_MIN_HEIGHT = 320;
		const DEFAULT_STABLE_PIXEL_EPSILON_PX = 1;
		const NON_TEXT_INPUT_TYPES = /* @__PURE__ */ new Set([
			"button",
			"checkbox",
			"color",
			"file",
			"hidden",
			"image",
			"radio",
			"range",
			"reset",
			"submit"
		]);
		function positiveNumber(value) {
			const numeric = Number(value);
			return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
		}
		function cssPixel(value) {
			const numeric = Number(value);
			return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : 0;
		}
		function stablePixelChanged(previous, next, options = {}) {
			const previousPx = cssPixel(previous);
			const nextPx = cssPixel(next);
			const configuredEpsilon = Number(options.epsilonPx);
			const epsilonPx = Math.max(0, Number.isFinite(configuredEpsilon) ? configuredEpsilon : DEFAULT_STABLE_PIXEL_EPSILON_PX);
			if (!previousPx) return Boolean(nextPx);
			if (!nextPx) return Boolean(previousPx);
			return Math.abs(nextPx - previousPx) > epsilonPx;
		}
		function isKeyboardEditable(element) {
			if (!element) return false;
			if (element.isContentEditable) return true;
			const tag = String(element.tagName || "").toLowerCase();
			if (tag === "textarea") return !element.disabled && !element.readOnly;
			if (tag !== "input") return false;
			const type = String(element.type || "text").toLowerCase();
			return !element.disabled && !element.readOnly && !NON_TEXT_INPUT_TYPES.has(type);
		}
		function measureViewport(input = {}) {
			const threshold = positiveNumber(input.keyboardShrinkPx) || DEFAULT_KEYBOARD_SHRINK_PX;
			const minHeight = positiveNumber(input.minHeight) || DEFAULT_MIN_HEIGHT;
			const visual = positiveNumber(input.visualHeight);
			const visualOffsetTop = Math.max(0, Number(input.visualOffsetTop) || 0);
			const scrollTop = Math.max(0, Number(input.scrollTop) || 0);
			const localVisibleTop = Math.max(visualOffsetTop, scrollTop);
			const visualBottom = visual ? visual + visualOffsetTop : 0;
			const layout = Math.max(positiveNumber(input.innerHeight), positiveNumber(input.clientHeight));
			const hostViewportHeight = positiveNumber(input.hostViewportHeight);
			const hostKeyboardBottomInset = Math.max(0, Number(input.hostKeyboardBottomInset) || 0);
			const hostBottomSafeArea = Math.max(0, Number(input.hostBottomSafeArea) || 0);
			const hostKeyboardVisible = Boolean(input.hostKeyboardVisible && hostKeyboardBottomInset > threshold);
			const keyboardCandidate = Boolean(visualBottom && layout && visualBottom < layout - threshold);
			const keyboardInputActive = Boolean(input.keyboardInputActive || isKeyboardEditable(input.activeElement));
			const keyboardShrunk = Boolean(keyboardInputActive && (keyboardCandidate || Boolean(keyboardInputActive && visualOffsetTop > 40) || Boolean(keyboardInputActive && scrollTop > 40) || hostKeyboardVisible));
			const hostKeyboardHeight = hostKeyboardVisible ? Math.max(minHeight, hostViewportHeight || (layout ? layout - hostKeyboardBottomInset : 0)) : 0;
			const localVisualHeight = visual || (visualBottom ? Math.max(0, visualBottom - visualOffsetTop) : 0);
			return {
				height: Math.max(minHeight, Math.round(keyboardShrunk ? hostKeyboardHeight || localVisualHeight || visualBottom || layout || 0 : Math.max(visualBottom || 0, layout || 0))),
				top: Math.round(keyboardShrunk ? localVisibleTop : 0),
				keyboardShrunk,
				keyboardCandidate,
				visualBottom: Math.round(visualBottom),
				layout: Math.round(layout),
				hostKeyboardVisible,
				hostKeyboardBottomInset: Math.round(hostKeyboardBottomInset),
				hostBottomSafeArea: Math.round(hostBottomSafeArea)
			};
		}
		return {
			cssPixel,
			isKeyboardEditable,
			measureViewport,
			stablePixelChanged
		};
	});
}));
//#endregion
//#region public/conversation-scroll.js
var require_conversation_scroll = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexConversationScroll = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		const DEFAULT_NEAR_BOTTOM_PX = 96;
		const DEFAULT_SUBMIT_FOLLOW_MS = 15e3;
		const DEFAULT_VIEWPORT_FOLLOW_MS = 3200;
		const DEFAULT_RECENT_BOTTOM_MS = 12e4;
		const DEFAULT_BOTTOM_FOLLOW_DELAYS_MS = Object.freeze([
			0,
			80,
			240,
			600,
			1200
		]);
		function numberOrZero(value) {
			const numeric = Number(value);
			return Number.isFinite(numeric) ? numeric : 0;
		}
		function isNearBottom(metrics = {}, thresholdPx = DEFAULT_NEAR_BOTTOM_PX) {
			const scrollHeight = numberOrZero(metrics.scrollHeight);
			const scrollTop = numberOrZero(metrics.scrollTop);
			const clientHeight = numberOrZero(metrics.clientHeight);
			const threshold = Math.max(0, numberOrZero(thresholdPx));
			return scrollHeight - scrollTop - clientHeight < threshold;
		}
		function createSubmittedMessageFollow(threadId, options = {}) {
			const id = String(threadId || "").trim();
			if (!id) return null;
			const nowMs = numberOrZero(options.nowMs) || Date.now();
			const ttlMs = Math.max(1e3, numberOrZero(options.ttlMs) || DEFAULT_SUBMIT_FOLLOW_MS);
			return {
				threadId: id,
				clientSubmissionId: String(options.clientSubmissionId || ""),
				untilMs: nowMs + ttlMs
			};
		}
		function shouldFollowSubmittedMessage(follow, options = {}) {
			if (!follow || !follow.threadId) return false;
			const threadId = String(options.threadId || "").trim();
			if (!threadId || String(follow.threadId) !== threadId) return false;
			return (numberOrZero(options.nowMs) || Date.now()) <= numberOrZero(follow.untilMs);
		}
		function extendSubmittedMessageFollow(follow, options = {}) {
			if (!follow || !follow.threadId) return null;
			const nowMs = numberOrZero(options.nowMs) || Date.now();
			const ttlMs = Math.max(1e3, numberOrZero(options.ttlMs) || DEFAULT_SUBMIT_FOLLOW_MS);
			return {
				...follow,
				untilMs: nowMs + ttlMs
			};
		}
		function shouldStartViewportFollow(options = {}) {
			if (options.nearBottom) return true;
			const nowMs = numberOrZero(options.nowMs) || Date.now();
			const recentBottomMs = Math.max(0, numberOrZero(options.recentBottomMs) || DEFAULT_RECENT_BOTTOM_MS);
			const lastNearBottomAtMs = numberOrZero(options.lastNearBottomAtMs);
			return Boolean(lastNearBottomAtMs && nowMs - lastNearBottomAtMs <= recentBottomMs);
		}
		function createViewportFollow(threadId, options = {}) {
			const id = String(threadId || "").trim();
			if (!id) return null;
			const nowMs = numberOrZero(options.nowMs) || Date.now();
			const ttlMs = Math.max(500, numberOrZero(options.ttlMs) || DEFAULT_VIEWPORT_FOLLOW_MS);
			return {
				threadId: id,
				reason: String(options.reason || "viewport"),
				untilMs: nowMs + ttlMs
			};
		}
		function shouldFollowViewport(follow, options = {}) {
			if (!follow || !follow.threadId) return false;
			const threadId = String(options.threadId || "").trim();
			if (!threadId || String(follow.threadId) !== threadId) return false;
			return (numberOrZero(options.nowMs) || Date.now()) <= numberOrZero(follow.untilMs);
		}
		function planBottomFollowLeaseEvaluation(options = {}) {
			if (options.userReadingCurrentTurn) return {
				shouldFollow: false,
				clearLease: true,
				reason: "user-reading-current-turn"
			};
			if (options.leaseActive) return {
				shouldFollow: true,
				clearLease: false,
				reason: "lease-active"
			};
			if (options.hasLease) return {
				shouldFollow: false,
				clearLease: true,
				reason: "lease-inactive"
			};
			return {
				shouldFollow: false,
				clearLease: false,
				reason: "no-lease"
			};
		}
		function planBottomFollowScrollSchedule() {
			return {
				clearExistingTimers: true,
				delaysMs: DEFAULT_BOTTOM_FOLLOW_DELAYS_MS.slice(),
				reason: "bottom-follow-retry"
			};
		}
		function planLocalPatchScrollCompletion(options = {}) {
			if (options.userReadingCurrentTurn) return {
				action: "update-button",
				reason: "user-reading-current-turn"
			};
			if (options.autoScrollHold) return {
				action: "update-button",
				reason: "auto-scroll-hold"
			};
			if (options.nearBottom) return {
				action: "scroll-to-bottom",
				reason: "near-bottom"
			};
			if (options.submittedMessageFollow) return {
				action: "scroll-to-bottom",
				reason: "submitted-message-follow"
			};
			if (options.viewportFollow) return {
				action: "scroll-to-bottom",
				reason: "viewport-follow"
			};
			return {
				action: "update-button",
				reason: "not-following-bottom"
			};
		}
		function planConversationJumpButtons(options = {}) {
			const canShow = Boolean(options.hasThread && !options.loading && !options.loadError && options.isScrollable);
			const showBottom = Boolean(canShow && !options.nearBottom);
			const showReply = Boolean(canShow && !showBottom && options.hasReplyTarget && options.replyTargetAbove);
			return {
				showBottom,
				showReply,
				reason: !canShow ? "not-available" : showBottom ? "bottom-available" : showReply ? "reply-available" : "hidden"
			};
		}
		function planUserReadingCurrentTurn(options = {}) {
			if (options.nearBottom) return {
				userReadingCurrentTurn: false,
				reason: "near-bottom"
			};
			if (options.autoScrollHold) return {
				userReadingCurrentTurn: true,
				reason: "auto-scroll-hold"
			};
			if (!options.recentScrollIntent) return {
				userReadingCurrentTurn: false,
				reason: "no-recent-scroll-intent"
			};
			if (options.hasCurrentTurn) return {
				userReadingCurrentTurn: true,
				reason: "current-turn-candidate"
			};
			return {
				userReadingCurrentTurn: false,
				reason: "no-current-turn"
			};
		}
		function planConversationAutoScrollHoldFromScroll(options = {}) {
			if (options.nearBottom) return {
				action: "clear-hold",
				reason: "near-bottom"
			};
			if (!options.recentScrollIntent) return {
				action: "none",
				reason: "no-recent-scroll-intent"
			};
			if (options.hasCurrentTurn) return {
				action: "remember-hold",
				reason: "current-turn-candidate"
			};
			return {
				action: "none",
				reason: "no-current-turn"
			};
		}
		function planReadingViewportPreservation(options = {}) {
			if (options.nearBottom) return {
				preserve: false,
				reason: "near-bottom"
			};
			if (options.userReadingCurrentTurn) return {
				preserve: true,
				reason: "user-reading-current-turn"
			};
			if (options.autoScrollHold) return {
				preserve: true,
				reason: "auto-scroll-hold"
			};
			if (options.userReadingAwayFromBottom) return {
				preserve: true,
				reason: "user-reading-away-from-bottom"
			};
			if (options.recentScrollIntent) return {
				preserve: true,
				reason: "recent-scroll-intent"
			};
			return {
				preserve: false,
				reason: "no-user-scroll-protection"
			};
		}
		function planAutomaticConversationRefresh(options = {}) {
			if (options.userInitiated) return {
				allowRefresh: true,
				cancelScheduled: false,
				reason: "user-initiated"
			};
			if (!options.hasThread) return {
				allowRefresh: true,
				cancelScheduled: false,
				reason: "no-current-thread"
			};
			if (options.nearBottom) return {
				allowRefresh: true,
				cancelScheduled: false,
				reason: "near-bottom"
			};
			if (options.userReadingCurrentTurn) return {
				allowRefresh: false,
				cancelScheduled: true,
				reason: "user-reading-current-turn"
			};
			if (options.autoScrollHold) return {
				allowRefresh: false,
				cancelScheduled: true,
				reason: "auto-scroll-hold"
			};
			if (options.userReadingAwayFromBottom) return {
				allowRefresh: false,
				cancelScheduled: true,
				reason: "user-reading-away-from-bottom"
			};
			if (options.recentScrollIntent) return {
				allowRefresh: false,
				cancelScheduled: true,
				reason: "recent-scroll-intent"
			};
			return {
				allowRefresh: true,
				cancelScheduled: false,
				reason: "no-user-scroll-protection"
			};
		}
		function planFullRenderScroll(options = {}) {
			if (options.stickToBottom === false || Boolean(options.scrollToTurnReceiptStart)) return {
				stickToBottom: false,
				explicitNoStickToBottom: true,
				shouldFollowBottom: false,
				reason: "explicit-no-stick"
			};
			if (options.userReadingCurrentTurn) return {
				stickToBottom: false,
				explicitNoStickToBottom: false,
				shouldFollowBottom: false,
				reason: "user-reading-current-turn"
			};
			if (options.autoScrollHold) return {
				stickToBottom: false,
				explicitNoStickToBottom: false,
				shouldFollowBottom: false,
				reason: "auto-scroll-hold"
			};
			if (Boolean(options.sustainedSubmittedFollow || options.submittedMessageFollow || options.viewportFollow)) return {
				stickToBottom: true,
				explicitNoStickToBottom: false,
				shouldFollowBottom: true,
				reason: options.sustainedSubmittedFollow ? "sustained-submitted-message-follow" : options.submittedMessageFollow ? "submitted-message-follow" : "viewport-follow"
			};
			if (options.stickToBottom === true) return {
				stickToBottom: true,
				explicitNoStickToBottom: false,
				shouldFollowBottom: false,
				reason: "requested-stick"
			};
			if (options.nearBottom) return {
				stickToBottom: true,
				explicitNoStickToBottom: false,
				shouldFollowBottom: false,
				reason: "near-bottom"
			};
			return {
				stickToBottom: false,
				explicitNoStickToBottom: false,
				shouldFollowBottom: false,
				reason: "not-following-bottom"
			};
		}
		return {
			DEFAULT_NEAR_BOTTOM_PX,
			DEFAULT_SUBMIT_FOLLOW_MS,
			DEFAULT_VIEWPORT_FOLLOW_MS,
			DEFAULT_RECENT_BOTTOM_MS,
			DEFAULT_BOTTOM_FOLLOW_DELAYS_MS,
			createSubmittedMessageFollow,
			extendSubmittedMessageFollow,
			createViewportFollow,
			isNearBottom,
			planBottomFollowLeaseEvaluation,
			planBottomFollowScrollSchedule,
			planConversationAutoScrollHoldFromScroll,
			planAutomaticConversationRefresh,
			planConversationJumpButtons,
			planFullRenderScroll,
			planLocalPatchScrollCompletion,
			planReadingViewportPreservation,
			planUserReadingCurrentTurn,
			shouldFollowViewport,
			shouldFollowSubmittedMessage,
			shouldStartViewportFollow
		};
	});
}));
//#endregion
//#region public/thread-performance-metrics.js
var require_thread_performance_metrics = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexThreadPerformanceMetrics = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		function objectOrNull(value) {
			return value && typeof value === "object" && !Array.isArray(value) ? value : null;
		}
		const MAX_TIMING_MS = 600 * 1e3;
		const CLIENT_TIMING_KEYS = [
			"elapsedMs",
			"apiElapsedMs",
			"renderElapsedMs",
			"mergeMs",
			"draftRestoreMs",
			"composerRenderMs",
			"threadListRenderMs",
			"conversationRenderMs",
			"detailPatchMs",
			"metadataUpdateMs",
			"postRenderMs"
		];
		const CLIENT_LABEL_KEYS = [
			"refreshRenderAction",
			"renderPlanReason",
			"patchRejectReason",
			"patchResult",
			"patchTimingSource",
			"patchSurfaceReason",
			"patchSurface",
			"patchExecutionReason"
		];
		const ALLOWED_DETAIL_RENDER_MODES = Object.freeze({
			"cached-current": true,
			"first-paint": true,
			"full-backfill": true,
			"full-render": true,
			"metadata-only": true,
			patch: true,
			skipped: true,
			"tile-pane": true,
			"tile-pane-metadata": true
		});
		const MAX_COUNT = 1e5;
		function threadDetailTimings(thread) {
			const diagnostics = objectOrNull(thread && thread.mobileDiagnostics);
			return objectOrNull(diagnostics && diagnostics.threadDetailTimings);
		}
		function threadListTimings(result) {
			const diagnostics = objectOrNull(result && result.mobileDiagnostics);
			return objectOrNull(diagnostics && diagnostics.threadListTimings);
		}
		function classifyThreadListPhase(timings) {
			const value = objectOrNull(timings);
			if (!value) return "unknown";
			if (value.fallbackDeferred) return "deferred-fallback";
			if (value.appServerDeferred) return "warm-fallback-initial";
			const decision = compactLabel(value.fallbackCacheDecision, 40);
			if (decision === "hit" || value.fallbackCacheHit) return "warm-fallback-cache";
			if (decision === "expired-rebuild") return "cold-fallback-expired-rebuild";
			if (decision === "miss-rebuild") return "cold-fallback-miss-build";
			if (Number(value.fallbackMs || 0) > 0) return "cold-fallback-build";
			if (Number(value.appServerMs || 0) > 0) return "app-server-only";
			return "unknown";
		}
		function classifyThreadDetailPhase(timings, input = {}) {
			const value = objectOrNull(timings);
			const source = objectOrNull(input) || {};
			if (source.cached === true) return "warm-client-current";
			if (!value) return "unknown";
			const existingPhase = compactLabel(value.phase, 80);
			if (existingPhase && existingPhase !== "unknown") return existingPhase;
			const readDecision = compactLabel(value.readDecision || source.readDecision, 80).toLowerCase();
			const readMode = compactLabel(value.readMode || source.readMode, 80).toLowerCase();
			const projectionState = compactLabel(value.projectionState, 80).toLowerCase();
			const projectionSource = compactLabel(value.projectionSource, 80).toLowerCase();
			const projectionSeedStatus = compactLabel(value.projectionSeedStatus, 80).toLowerCase();
			if (readDecision === "projection-partial-hit" || readDecision === "projection-stale-partial-hit" || /projection-v?\d*-partial|projection-partial/.test(readMode)) return "warm-projection-partial";
			if (readDecision === "projection-hit" || projectionState === "hit") {
				if (/dynamic/.test(projectionSource) || /projection-v?\d*-dynamic|projection-dynamic/.test(readMode)) return "warm-projection-dynamic";
				return "warm-projection-cache";
			}
			if (readDecision === "bounded-large-turns-list" || /turns-list-large/.test(readMode)) return "bounded-large-thread-window";
			if (readDecision === "initial-turns-list" || /turns-list-initial/.test(readMode)) return projectionSeedStatus === "seeded-partial" ? "cold-turns-list-initial-seeded-partial" : "cold-turns-list-initial";
			if (/thread-read-raw/.test(readMode)) return "cold-thread-read-raw";
			if (readDecision === "full-thread-read" || /thread-read/.test(readMode)) return "cold-thread-read";
			if (readDecision === "fallback-turns-list" || /turns-list/.test(readMode)) return "fallback-turns-list";
			if (readDecision === "summary-fallback" || /summary-timeout|unmaterialized|fallback/.test(readMode)) return "fallback-summary";
			return "unknown";
		}
		function threadDetailEventFields(thread) {
			const timings = threadDetailTimings(thread);
			return {
				serverTimings: timings,
				performancePhase: classifyThreadDetailPhase(timings, { readMode: thread && thread.mobileReadMode }),
				detailShape: threadDetailShape(thread)
			};
		}
		function boundedTiming(value) {
			const number = Number(value);
			if (!Number.isFinite(number) || number < 0) return null;
			return Math.min(MAX_TIMING_MS, Math.round(number));
		}
		function compactLabel(value, maxLength = 40) {
			return String(value || "").trim().slice(0, maxLength);
		}
		function threadDetailClientTimings(input = {}) {
			const source = objectOrNull(input) || {};
			const result = {};
			for (const key of CLIENT_TIMING_KEYS) {
				const timing = boundedTiming(source[key]);
				if (timing !== null) result[key] = timing;
			}
			const renderMode = compactLabel(source.detailRenderMode || source.renderMode);
			if (renderMode && ALLOWED_DETAIL_RENDER_MODES[renderMode]) result.detailRenderMode = renderMode;
			const sourceLabel = compactLabel(source.source);
			if (sourceLabel) result.source = sourceLabel;
			for (const key of CLIENT_LABEL_KEYS) {
				const label = compactLabel(source[key]);
				if (label) result[key] = label;
			}
			if (source.skippedDetailRender !== void 0) result.skippedDetailRender = Boolean(source.skippedDetailRender);
			if (source.locallyPatchedDetail !== void 0) result.locallyPatchedDetail = Boolean(source.locallyPatchedDetail);
			if (source.tilePanePatchedDetail !== void 0) result.tilePanePatchedDetail = Boolean(source.tilePanePatchedDetail);
			if (source.localPatchAttempted !== void 0) result.localPatchAttempted = Boolean(source.localPatchAttempted);
			if (source.tilePanePatchAttempted !== void 0) result.tilePanePatchAttempted = Boolean(source.tilePanePatchAttempted);
			return Object.keys(result).length ? result : null;
		}
		function threadDetailEventFieldsWithClient(thread, clientTimingInput = {}) {
			const fields = threadDetailEventFields(thread);
			fields.clientTimings = threadDetailClientTimings(clientTimingInput);
			return fields;
		}
		function statusText(status) {
			if (!status) return "";
			if (typeof status === "string") return compactLabel(status, 80);
			if (status && typeof status === "object") {
				const type = compactLabel(status.type, 80);
				if (type) return type;
				try {
					return compactLabel(JSON.stringify(status), 80);
				} catch (_) {
					return "";
				}
			}
			return compactLabel(status, 80);
		}
		function rolloutSizeBytes(thread) {
			const size = Number(thread && thread.rolloutSizeBytes);
			return Number.isFinite(size) && size > 0 ? Math.trunc(size) : 0;
		}
		function hasCursor(value) {
			if (!value) return false;
			if (typeof value === "string") return Boolean(value.trim());
			if (typeof value === "object") return Object.keys(value).length > 0;
			return true;
		}
		function booleanFlag(value) {
			if (value === true || value === 1) return true;
			const text = String(value || "").trim().toLowerCase();
			return text === "true" || text === "1" || text === "yes";
		}
		function threadTurnCount(thread) {
			return Array.isArray(thread && thread.turns) ? boundedCount(thread.turns.length) : 0;
		}
		function threadOmittedTurnCount(thread) {
			return boundedCount(thread && thread.mobileOmittedTurnCount);
		}
		function setTimingField(out, key, value) {
			const timing = boundedTiming(value);
			if (timing !== null) out[key] = timing;
		}
		function threadDetailRefreshEventFields(thread, input = {}) {
			const source = objectOrNull(input) || {};
			const detailPerformance = threadDetailEventFieldsWithClient(thread, source);
			const out = {
				source: compactLabel(source.source, 40),
				threadId: compactLabel(source.threadId, 220),
				requestedMode: compactLabel(source.requestedMode, 40),
				readMode: compactLabel(thread && thread.mobileReadMode, 80),
				serverTimings: detailPerformance.serverTimings,
				performancePhase: detailPerformance.performancePhase,
				clientTimings: detailPerformance.clientTimings,
				detailShape: detailPerformance.detailShape,
				status: statusText(thread && thread.status),
				turns: threadTurnCount(thread),
				omittedTurns: threadOmittedTurnCount(thread),
				rolloutSizeBytes: rolloutSizeBytes(thread),
				renderPlanReason: compactLabel(source.renderPlanReason, 80),
				refreshRenderAction: compactLabel(source.refreshRenderAction, 80),
				patchRejectReason: compactLabel(source.patchRejectReason, 80),
				patchResult: compactLabel(source.patchResult, 80),
				patchTimingSource: compactLabel(source.patchTimingSource, 80),
				patchSurfaceReason: compactLabel(source.patchSurfaceReason, 80),
				patchSurface: compactLabel(source.patchSurface, 80),
				patchExecutionReason: compactLabel(source.patchExecutionReason, 80),
				skippedDetailRender: Boolean(source.skippedDetailRender),
				locallyPatchedDetail: Boolean(source.locallyPatchedDetail),
				tilePanePatchedDetail: Boolean(source.tilePanePatchedDetail),
				localPatchAttempted: Boolean(source.localPatchAttempted),
				tilePanePatchAttempted: Boolean(source.tilePanePatchAttempted)
			};
			for (const key of [
				"elapsedMs",
				"apiElapsedMs",
				"renderElapsedMs"
			]) setTimingField(out, key, source[key]);
			return out;
		}
		function threadDetailFirstPaintEventFields(thread, input = {}) {
			const source = objectOrNull(input) || {};
			const cached = source.cached === true;
			const detailPerformance = threadDetailEventFieldsWithClient(thread, source);
			const performancePhase = classifyThreadDetailPhase(detailPerformance.serverTimings, {
				cached,
				readMode: thread && thread.mobileReadMode,
				readDecision: source.readDecision
			});
			const out = {
				source: compactLabel(source.source, 40),
				threadId: compactLabel(source.threadId, 220),
				serverTimings: detailPerformance.serverTimings,
				performancePhase,
				clientTimings: detailPerformance.clientTimings,
				detailShape: detailPerformance.detailShape,
				cached,
				readMode: compactLabel(thread && thread.mobileReadMode, 80),
				turns: threadTurnCount(thread),
				rolloutSizeBytes: rolloutSizeBytes(thread)
			};
			for (const key of [
				"elapsedMs",
				"apiElapsedMs",
				"renderElapsedMs"
			]) setTimingField(out, key, source[key]);
			if (!cached) {
				out.status = statusText(thread && thread.status);
				out.omittedTurns = threadOmittedTurnCount(thread);
			}
			return out;
		}
		function threadDetailFullReadyEventFields(thread, input = {}) {
			const source = objectOrNull(input) || {};
			const detailPerformance = threadDetailEventFieldsWithClient(thread, source);
			const out = {
				source: compactLabel(source.source, 40),
				threadId: compactLabel(source.threadId, 220),
				serverTimings: detailPerformance.serverTimings,
				performancePhase: detailPerformance.performancePhase,
				clientTimings: detailPerformance.clientTimings,
				detailShape: detailPerformance.detailShape,
				readMode: compactLabel(thread && thread.mobileReadMode, 80),
				turns: threadTurnCount(thread),
				omittedTurns: threadOmittedTurnCount(thread),
				rolloutSizeBytes: rolloutSizeBytes(thread)
			};
			for (const key of [
				"elapsedMs",
				"apiElapsedMs",
				"renderElapsedMs"
			]) setTimingField(out, key, source[key]);
			return out;
		}
		function planThreadDetailSlowPathDiagnostic(event = {}, input = {}) {
			const fields = objectOrNull(event) || {};
			const source = objectOrNull(input) || {};
			const thresholdMs = boundedTiming(source.thresholdMs) || 1500;
			const elapsedMs = boundedTiming(fields.elapsedMs || fields.clientTimings && fields.clientTimings.elapsedMs) || 0;
			const apiElapsedMs = boundedTiming(fields.apiElapsedMs || fields.clientTimings && fields.clientTimings.apiElapsedMs) || 0;
			const renderElapsedMs = boundedTiming(fields.renderElapsedMs || fields.clientTimings && fields.clientTimings.renderElapsedMs) || 0;
			const serverTimings = objectOrNull(fields.serverTimings) || {};
			const slowElapsed = elapsedMs >= thresholdMs;
			const slowApi = apiElapsedMs >= thresholdMs;
			const slowRender = renderElapsedMs >= thresholdMs;
			if (!slowElapsed && !slowApi && !slowRender) return {
				shouldReport: false,
				reason: "below-threshold",
				thresholdMs,
				elapsedMs,
				apiElapsedMs,
				renderElapsedMs
			};
			const performancePhase = compactLabel(fields.performancePhase, 80);
			const reason = slowApi ? "api-slow" : slowRender ? "render-slow" : "elapsed-slow";
			const severe = elapsedMs >= thresholdMs * 2 || apiElapsedMs >= thresholdMs * 2 || /cold-thread-read|fallback|bounded-large/.test(performancePhase);
			const detailShape = objectOrNull(fields.detailShape) || {};
			return {
				shouldReport: true,
				reason,
				severityHint: severe ? "H2" : "H3",
				thresholdMs,
				elapsedMs,
				apiElapsedMs,
				renderElapsedMs,
				readMode: compactLabel(fields.readMode, 80),
				performancePhase,
				coldPathOwner: compactLabel(fields.coldPathOwner || serverTimings.coldPathOwner, 80),
				coldPathReason: compactLabel(fields.coldPathReason || serverTimings.coldPathReason, 80),
				source: compactLabel(fields.source || source.source, 40),
				action: compactLabel(source.action || "thread-detail", 80),
				threadHash: compactLabel(source.threadHash || source.thread_hash, 80),
				durationBucket: compactLabel(source.durationBucket || source.duration_bucket, 40),
				renderMode: compactLabel(fields.clientTimings && fields.clientTimings.detailRenderMode, 40),
				rolloutSizeBytes: rolloutSizeBytes(fields),
				turns: boundedCount(fields.turns || detailShape.turns),
				visibleItems: boundedCount(detailShape.visibleItems),
				omittedTurns: boundedCount(fields.omittedTurns || detailShape.omittedTurns)
			};
		}
		function planThreadListSlowPathDiagnostic(event = {}, input = {}) {
			const fields = objectOrNull(event) || {};
			const source = objectOrNull(input) || {};
			const thresholdMs = boundedTiming(source.thresholdMs) || 1500;
			const elapsedMs = boundedTiming(fields.elapsedMs || source.elapsedMs) || 0;
			const apiElapsedMs = boundedTiming(fields.apiElapsedMs || source.apiElapsedMs) || 0;
			const renderElapsedMs = boundedTiming(fields.renderElapsedMs || source.renderElapsedMs) || 0;
			const serverTimings = objectOrNull(fields.serverTimings) || {};
			const slowElapsed = elapsedMs >= thresholdMs;
			const slowApi = apiElapsedMs >= thresholdMs;
			const slowRender = renderElapsedMs >= thresholdMs;
			if (!slowElapsed && !slowApi && !slowRender) return {
				shouldReport: false,
				reason: "below-threshold",
				thresholdMs,
				elapsedMs,
				apiElapsedMs,
				renderElapsedMs
			};
			const performancePhase = compactLabel(fields.performancePhase, 80);
			const reason = slowApi ? "api-slow" : slowRender ? "render-slow" : "elapsed-slow";
			const severe = elapsedMs >= thresholdMs * 3 || apiElapsedMs >= thresholdMs * 3 || /cold|app-server-only|fallback-build/.test(performancePhase);
			const responseBytes = Number(serverTimings.appServerResponsePayloadBytes);
			return {
				shouldReport: true,
				reason,
				severityHint: severe ? "H2" : "H3",
				thresholdMs,
				elapsedMs,
				apiElapsedMs,
				renderElapsedMs,
				action: compactLabel(source.action || "thread-list-load", 80),
				source: compactLabel(fields.source || source.source, 40),
				durationBucket: compactLabel(source.durationBucket || source.duration_bucket, 40),
				performancePhase,
				count: boundedCount(fields.count || source.count),
				silent: fields.silent === true || source.silent === true,
				hasSearch: fields.hasSearch === true || source.hasSearch === true,
				hasWorkspace: fields.hasWorkspace === true || source.hasWorkspace === true,
				mobileFallback: fields.mobileFallback === true || source.mobileFallback === true,
				coldPathOwner: compactLabel(fields.coldPathOwner || serverTimings.coldPathOwner, 80),
				coldPathReason: compactLabel(fields.coldPathReason || serverTimings.coldPathReason, 80),
				fallbackCacheDecision: compactLabel(serverTimings.fallbackCacheDecision, 80),
				fallbackDeferredReason: compactLabel(serverTimings.fallbackDeferredReason, 80),
				appServerDeferredReason: compactLabel(serverTimings.appServerDeferredReason || serverTimings.appServerDeferredInitialReason, 80),
				appServerRequestReason: compactLabel(serverTimings.appServerRequestReason, 80),
				totalMs: boundedTiming(serverTimings.totalMs),
				appServerMs: boundedTiming(serverTimings.appServerMs),
				appServerRpcMs: boundedTiming(serverTimings.appServerRpcMs),
				appServerUnattributedMs: boundedTiming(serverTimings.appServerUnattributedMs),
				fallbackMs: boundedTiming(serverTimings.fallbackMs),
				mergeMs: boundedTiming(serverTimings.mergeMs),
				summaryMergeTotalMs: boundedTiming(serverTimings.summaryMergeTotalMs),
				fallbackSourceSnapshotAgeMs: boundedTiming(serverTimings.fallbackSourceSnapshotAgeMs),
				fallbackRolloutFileStatCount: boundedCount(serverTimings.fallbackRolloutFileStatCount),
				fallbackRolloutHeadReadCount: boundedCount(serverTimings.fallbackRolloutHeadReadCount),
				fallbackRolloutSummaryReadCount: boundedCount(serverTimings.fallbackRolloutSummaryReadCount),
				appServerRequestLimit: boundedCount(serverTimings.appServerRequestLimit),
				appServerResponsePayloadKb: Number.isFinite(responseBytes) && responseBytes > 0 ? boundedCount(Math.ceil(responseBytes / 1024)) : 0
			};
		}
		function threadDetailProjectionContractFields(thread) {
			const projection = objectOrNull(thread && thread.mobileProjection) || {};
			const timings = threadDetailTimings(thread) || {};
			const responseBudget = objectOrNull(thread && thread.mobileDetailResponseBudget) || {};
			const readMode = compactLabel(thread && thread.mobileReadMode, 80);
			return {
				readMode,
				projectionSource: compactLabel(projection.source || thread && thread.mobileProjectionSource || timings.projectionSource, 80),
				projectionPartial: booleanFlag(projection.partial) || /projection-v?\d*-partial|projection-partial/.test(readMode),
				projectionPartialKind: compactLabel(projection.partialKind || timings.projectionPartialKind, 80),
				responseBudgetApplied: responseBudget.applied === true,
				responseBudgetProgressiveActiveApplied: responseBudget.progressiveActiveBudgetApplied === true,
				responseBudgetActiveTurnCount: boundedCount(responseBudget.activeTurnCount),
				responseBudgetRetainedItemCount: boundedCount(responseBudget.retainedItemCount),
				olderCursor: hasCursor(thread && thread.mobileOlderTurnsCursor),
				newerCursor: hasCursor(thread && thread.mobileNewerTurnsCursor),
				status: statusText(thread && thread.status),
				detailShape: threadDetailShape(thread),
				turns: threadTurnCount(thread),
				omittedTurns: threadOmittedTurnCount(thread),
				rolloutSizeBytes: rolloutSizeBytes(thread)
			};
		}
		function activeLikeStatus(value) {
			return /active|running|in[_-]?progress|pending|thinking|queued/.test(String(value || "").toLowerCase());
		}
		function planThreadDetailResponseContractDiagnostic(event = {}, input = {}) {
			const fields = objectOrNull(event) || {};
			const source = objectOrNull(input) || {};
			const contract = source.thread ? threadDetailProjectionContractFields(source.thread) : objectOrNull(source.contract) || {};
			const detailShape = objectOrNull(fields.detailShape) || objectOrNull(contract.detailShape) || objectOrNull(source.detailShape) || {};
			const readMode = compactLabel(fields.readMode || contract.readMode || source.readMode, 80);
			const performancePhase = compactLabel(fields.performancePhase || source.performancePhase, 80);
			const projectionSource = compactLabel(contract.projectionSource || source.projectionSource, 80);
			const projectionPartialKind = compactLabel(contract.projectionPartialKind || source.projectionPartialKind, 80);
			const projectionPartial = Boolean(contract.projectionPartial || source.projectionPartial);
			const responseBudgetApplied = Boolean(contract.responseBudgetApplied || source.responseBudgetApplied);
			const responseBudgetProgressiveActiveApplied = Boolean(contract.responseBudgetProgressiveActiveApplied || source.responseBudgetProgressiveActiveApplied);
			const responseBudgetActiveTurnCount = boundedCount(contract.responseBudgetActiveTurnCount || source.responseBudgetActiveTurnCount);
			const responseBudgetRetainedItemCount = boundedCount(contract.responseBudgetRetainedItemCount || source.responseBudgetRetainedItemCount);
			const olderCursor = Boolean(contract.olderCursor || source.olderCursor);
			const newerCursor = Boolean(contract.newerCursor || source.newerCursor);
			const turns = boundedCount(fields.turns || contract.turns || detailShape.turns);
			const items = boundedCount(detailShape.items);
			const visibleItems = boundedCount(detailShape.visibleItems);
			const activeTurns = boundedCount(detailShape.activeTurns);
			const completedTurns = boundedCount(detailShape.completedTurns);
			const omittedTurns = boundedCount(fields.omittedTurns || contract.omittedTurns || detailShape.omittedTurns);
			const status = compactLabel(fields.status || contract.status || source.status, 80);
			const activeLike = Boolean(source.expectedActiveFullRead) || activeTurns > 0 || activeLikeStatus(status);
			const windowedMode = /turns-list|projection-v?\d*-partial|projection-partial|summary-timeout|unmaterialized|fallback/.test(readMode) || /bounded-large|turns-list|partial|fallback/.test(performancePhase);
			const partialProjectionMode = projectionPartial || /projection-v?\d*-partial|projection-partial/.test(readMode);
			const hasActiveProjectionEvidence = activeTurns > 0 || responseBudgetActiveTurnCount > 0;
			const hasVisibleProjectionEvidence = visibleItems > 0 || responseBudgetRetainedItemCount > 0;
			const activePartialProjectionOk = !source.expectedActiveFullRead && partialProjectionMode && hasActiveProjectionEvidence && hasVisibleProjectionEvidence && (responseBudgetApplied || responseBudgetProgressiveActiveApplied || /warm-projection-partial|projection-partial/.test(performancePhase));
			const projectionModeMarkedFull = /projection-v?\d*-(cache|dynamic)|projection-(cache|dynamic)/.test(readMode) && !projectionPartial;
			let reason = "";
			let severityHint = "H3";
			if (projectionModeMarkedFull && newerCursor) {
				reason = "projection-window-marked-full";
				severityHint = "H2";
			} else if (turns > 0 && visibleItems === 0 && (items === 0 || projectionPartial || projectionPartialKind === "notification-shell")) {
				reason = "empty-projection-shell";
				severityHint = "H2";
			} else if (activeLike && windowedMode && !activePartialProjectionOk) {
				reason = "active-thread-window-downgrade";
				severityHint = "H2";
			}
			return {
				shouldReport: Boolean(reason),
				reason: reason || "ok",
				severityHint,
				action: compactLabel(source.action || fields.source || "thread-detail", 80),
				source: compactLabel(fields.source || source.source, 40),
				threadHash: compactLabel(source.threadHash || source.thread_hash, 80),
				durationBucket: compactLabel(source.durationBucket || source.duration_bucket, 40),
				readMode,
				renderMode: compactLabel(fields.clientTimings && fields.clientTimings.detailRenderMode || source.renderMode, 40),
				performancePhase,
				projectionSource,
				projectionPartialKind,
				projectionPartial,
				responseBudgetApplied,
				responseBudgetProgressiveActiveApplied,
				responseBudgetActiveTurnCount,
				responseBudgetRetainedItemCount,
				olderCursor,
				newerCursor,
				turns,
				items,
				visibleItems,
				activeTurns,
				completedTurns,
				omittedTurns,
				rolloutSizeBytes: rolloutSizeBytes(contract.rolloutSizeBytes ? contract : fields)
			};
		}
		function boundedCount(value) {
			const number = Number(value);
			if (!Number.isFinite(number) || number < 0) return 0;
			return Math.min(MAX_COUNT, Math.trunc(number));
		}
		function itemType(value) {
			return String(value && value.type || "").trim();
		}
		function isVisibleItem(item) {
			if (!item || typeof item !== "object") return false;
			if (item.hidden || item.mobileHidden) return false;
			const type = itemType(item);
			if (!type || type === "reasoning") return false;
			if (typeof item.text === "string" && item.text.trim()) return true;
			if (Array.isArray(item.content) && item.content.length) return true;
			if (Array.isArray(item.summary) && item.summary.length) return true;
			if (type === "imageView" || type === "generatedImage" || type === "fileChange" || type === "commandExecution") return true;
			if (type === "turnUsageSummary" || type === "taskCard" || type === "toolCall") return true;
			return false;
		}
		function itemShapeBucket(item) {
			const type = itemType(item);
			if (type === "userMessage") return "userItems";
			if (type === "agentMessage" || type === "plan") return "receiptItems";
			if (type === "imageView" || type === "generatedImage") return "imageItems";
			if (type === "commandExecution" || type === "fileChange" || type === "toolCall") return "operationItems";
			if (type === "turnUsageSummary") return "usageItems";
			if (type === "turnDiagnostic") return "diagnosticItems";
			return "";
		}
		function turnIsComplete(turn) {
			const text = String(turn && (turn.status && turn.status.type || turn.status) || "").toLowerCase();
			return /completed|success|succeeded|done|finished|failed|error|cancel|cancelled|canceled|interrupted/.test(text);
		}
		function threadDetailShape(thread) {
			const turns = Array.isArray(thread && thread.turns) ? thread.turns : [];
			const shape = {
				turns: boundedCount(turns.length),
				omittedTurns: boundedCount(thread && thread.mobileOmittedTurnCount),
				items: 0,
				visibleItems: 0,
				userItems: 0,
				receiptItems: 0,
				imageItems: 0,
				operationItems: 0,
				usageItems: 0,
				diagnosticItems: 0,
				completedTurns: 0,
				activeTurns: 0
			};
			for (const turn of turns) {
				if (turnIsComplete(turn)) shape.completedTurns += 1;
				else shape.activeTurns += 1;
				const items = Array.isArray(turn && turn.items) ? turn.items : [];
				shape.items += items.length;
				for (const item of items) {
					if (isVisibleItem(item)) shape.visibleItems += 1;
					const bucket = itemShapeBucket(item);
					if (bucket) shape[bucket] += 1;
				}
			}
			for (const key of Object.keys(shape)) shape[key] = boundedCount(shape[key]);
			return shape;
		}
		function threadListEventFields(result) {
			const timings = threadListTimings(result);
			return {
				serverTimings: timings,
				performancePhase: classifyThreadListPhase(timings)
			};
		}
		return {
			boundedTiming,
			classifyThreadDetailPhase,
			classifyThreadListPhase,
			rolloutSizeBytes,
			statusText,
			threadDetailClientTimings,
			threadDetailEventFields,
			threadDetailEventFieldsWithClient,
			threadDetailFirstPaintEventFields,
			threadDetailFullReadyEventFields,
			threadDetailRefreshEventFields,
			threadDetailShape,
			threadDetailTimings,
			planThreadDetailResponseContractDiagnostic,
			planThreadDetailSlowPathDiagnostic,
			planThreadListSlowPathDiagnostic,
			threadDetailProjectionContractFields,
			threadOmittedTurnCount,
			threadTurnCount,
			threadListEventFields,
			threadListTimings
		};
	});
}));
//#endregion
//#region public/thread-detail-state.js
var require_thread_detail_state = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexThreadDetailState = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		const DETAIL_ONLY_SUMMARY_FIELDS = Object.freeze([
			"turns",
			"runtimeSettings",
			"threadTaskCards",
			"mobileDetailLoaded",
			"mobileLoading",
			"mobileLoadError",
			"mobileReadWarning",
			"mobileReadMode",
			"mobileDiagnostics",
			"mobileProjectionVersion",
			"mobileProjection",
			"mobileProjectionRevision",
			"mobileVisibleItemKeys",
			"mobileOlderTurnsCursor",
			"mobileNewerTurnsCursor"
		]);
		function defaultVisibleWeight(item) {
			return item ? JSON.stringify(item).length : 0;
		}
		function boundedCount(value) {
			const number = Number(value);
			if (!Number.isFinite(number) || number < 0) return 0;
			return Math.trunc(number);
		}
		function shortString(value, maxLength = 80) {
			return String(value || "").slice(0, maxLength);
		}
		function objectOrEmpty(value) {
			return value && typeof value === "object" && !Array.isArray(value) ? value : {};
		}
		function threadListSummaryFromDetailThread(thread) {
			if (!thread || typeof thread !== "object" || !thread.id) return null;
			const summary = Object.assign({}, thread);
			for (const field of DETAIL_ONLY_SUMMARY_FIELDS) delete summary[field];
			return summary;
		}
		function threadHasLoadedDetailState(thread) {
			if (!thread || typeof thread !== "object") return false;
			if (thread.mobileLoading || thread.mobileLoadError) return false;
			if (!Array.isArray(thread.turns)) return false;
			if (thread.turns.length > 0) return true;
			return thread.mobileDetailLoaded === true;
		}
		function threadHasReusableLoadedDetailState(thread) {
			if (!threadHasLoadedDetailState(thread)) return false;
			if (threadHasActiveDetailEvidence(thread)) return false;
			return Array.isArray(thread.turns) && thread.turns.length > 0;
		}
		function threadHasVisualBaselineLoadedDetailState(thread) {
			if (!threadHasLoadedDetailState(thread)) return false;
			return Array.isArray(thread.turns) && thread.turns.length > 0;
		}
		function statusKind(value) {
			if (!value) return "";
			if (typeof value === "string") return value;
			if (value && typeof value === "object") return String(value.type || value.status || value.kind || "");
			return "";
		}
		function turnIsSettled(turn) {
			const kind = statusKind(turn && turn.status).toLowerCase();
			return kind === "completed" || kind === "failed" || kind === "cancelled" || kind === "canceled";
		}
		function threadHasActiveDetailEvidence(thread) {
			if (!thread || typeof thread !== "object") return false;
			if (thread.activeTurnId || thread.mobileRolloutActiveTurn) return true;
			const kind = statusKind(thread.status).toLowerCase();
			if ([
				"active",
				"running",
				"in_progress",
				"in-progress",
				"pending",
				"processing",
				"status-error"
			].includes(kind)) return true;
			if (!Array.isArray(thread.turns)) return false;
			return thread.turns.some((turn) => {
				const kind = statusKind(turn && turn.status);
				return Boolean(kind && !turnIsSettled(turn));
			});
		}
		function activeTurnIdentifier(value) {
			if (!value) return "";
			if (typeof value === "string") return value;
			if (value && typeof value === "object") return String(value.id || value.turnId || value.activeTurnId || "");
			return "";
		}
		function activeTurnIdsForThread(thread) {
			const ids = /* @__PURE__ */ new Set();
			const direct = activeTurnIdentifier(thread && thread.activeTurnId);
			const rollout = activeTurnIdentifier(thread && thread.mobileRolloutActiveTurn);
			if (direct) ids.add(direct);
			if (rollout) ids.add(rollout);
			return ids;
		}
		function turnIsActivePreviewTarget(thread, turn, index, turns) {
			if (!turn || typeof turn !== "object") return false;
			const turnId = String(turn.id || "");
			const activeIds = activeTurnIdsForThread(thread);
			if (turnId && activeIds.has(turnId)) return true;
			if (statusKind(turn.status) && !turnIsSettled(turn)) return true;
			const threadKind = statusKind(thread && thread.status).toLowerCase();
			if ([
				"active",
				"running",
				"in_progress",
				"in-progress",
				"pending",
				"processing",
				"status-error"
			].includes(threadKind)) return index === turns.length - 1;
			return false;
		}
		function activePreviewSafeItem(item) {
			if (!item || typeof item !== "object") return false;
			const type = String(item.type || "").toLowerCase();
			return type === "usermessage" || type === "taskcard" || type === "turndiagnostic" || type === "contextcompaction";
		}
		function previewUserMessageText(item) {
			if (!item || item.type !== "userMessage") return "";
			if (typeof item.text === "string") return item.text.trim();
			if (typeof item.message === "string") return item.message.trim();
			return (Array.isArray(item.content) ? item.content : []).map((part) => {
				if (typeof part === "string") return part;
				if (!part || typeof part !== "object") return "";
				if (typeof part.text === "string") return part.text;
				if (typeof part.value === "string") return part.value;
				if (typeof part.content === "string") return part.content;
				return "";
			}).join("").trim();
		}
		function previewUserMessageSubmissionIds(item) {
			if (!item || item.type !== "userMessage") return [];
			return [
				item.clientSubmissionId,
				item.submissionId,
				item.mobileSubmissionId,
				item.id && /^local-user-/.test(String(item.id)) ? String(item.id).replace(/^local-user-/, "") : ""
			].map((value) => String(value || "").trim()).filter(Boolean);
		}
		function previewUserMessageHasSubmissionId(item, submissionId) {
			if (!submissionId || !item || item.type !== "userMessage") return false;
			return previewUserMessageSubmissionIds(item).includes(submissionId);
		}
		function isPreviewOptimisticUserMessage(item) {
			if (!item || item.type !== "userMessage") return false;
			return Boolean(item.mobilePendingSubmission || item.mobileSendError || /^local-user-/.test(String(item.id || "")));
		}
		function previewDurableUserMessageMatchesOptimistic(durableItem, optimisticItem) {
			if (!durableItem || !optimisticItem) return false;
			if (durableItem.type !== "userMessage" || optimisticItem.type !== "userMessage") return false;
			if (isPreviewOptimisticUserMessage(durableItem) || !isPreviewOptimisticUserMessage(optimisticItem)) return false;
			if (previewUserMessageSubmissionIds(optimisticItem).some((submissionId) => previewUserMessageHasSubmissionId(durableItem, submissionId))) return true;
			const durableText = previewUserMessageText(durableItem);
			const optimisticText = previewUserMessageText(optimisticItem);
			return Boolean(durableText && optimisticText && durableText === optimisticText);
		}
		function threadHasDurableUserMessageMatchingPreviewEcho(thread, optimisticItem) {
			if (!thread || !Array.isArray(thread.turns) || !isPreviewOptimisticUserMessage(optimisticItem)) return false;
			return thread.turns.some((turn) => (Array.isArray(turn && turn.items) ? turn.items : []).some((candidate) => previewDurableUserMessageMatchesOptimistic(candidate, optimisticItem)));
		}
		function activePreviewItemAllowed(thread, item) {
			if (!activePreviewSafeItem(item)) return false;
			if (item && item.type === "userMessage" && threadHasDurableUserMessageMatchingPreviewEcho(thread, item)) return false;
			return true;
		}
		function cloneActivePreviewItem(item) {
			if (!item || typeof item !== "object") return item;
			const clone = Object.assign({}, item);
			if (Array.isArray(item.content)) clone.content = item.content.map((entry) => entry && typeof entry === "object" ? Object.assign({}, entry) : entry);
			return clone;
		}
		function activeDetailLoadingPreviewThread(thread) {
			if (!threadHasLoadedDetailState(thread) || !threadHasActiveDetailEvidence(thread)) return null;
			const turns = Array.isArray(thread.turns) ? thread.turns : [];
			if (!turns.length) return null;
			let previewedActiveTurn = false;
			const nextTurns = turns.map((turn, index) => {
				if (!turn || typeof turn !== "object") return turn;
				if (!turnIsActivePreviewTarget(thread, turn, index, turns)) return turn;
				previewedActiveTurn = true;
				return Object.assign({}, turn, {
					items: Array.isArray(turn.items) ? turn.items.filter((item) => activePreviewItemAllowed(thread, item)).map(cloneActivePreviewItem) : [],
					mobileActiveCachePreview: true,
					mobileLoading: true
				});
			});
			if (!previewedActiveTurn) return null;
			return Object.assign({}, thread, {
				turns: nextTurns,
				mobileLoading: true,
				mobileLoadError: "",
				mobileActiveCachePreview: true
			});
		}
		function rolloutSizeBytesFromThread(thread) {
			const size = Number(thread && thread.rolloutSizeBytes);
			return Number.isFinite(size) && size > 0 ? size : 0;
		}
		function emptyDetailHistoryEvidenceForThread(thread) {
			const rolloutSizeBytes = rolloutSizeBytesFromThread(thread);
			const omittedTurns = boundedCount(thread && thread.mobileOmittedTurnCount);
			const visibleItemKeyCount = Array.isArray(thread && thread.mobileVisibleItemKeys) ? thread.mobileVisibleItemKeys.length : 0;
			const taskCardCount = Array.isArray(thread && thread.threadTaskCards) ? thread.threadTaskCards.length : 0;
			const pendingTaskCardCount = boundedCount(thread && thread.pendingTaskCardCount);
			const hasActiveTurnEvidence = Boolean(thread && (thread.activeTurnId || thread.mobileRolloutActiveTurn));
			return {
				hasEvidence: rolloutSizeBytes > 0 || omittedTurns > 0 || visibleItemKeyCount > 0 || hasActiveTurnEvidence || taskCardCount > 0 || pendingTaskCardCount > 0,
				rolloutSizeBytes,
				omittedTurns,
				visibleItemKeyCount,
				hasActiveTurnEvidence,
				taskCardCount,
				pendingTaskCardCount
			};
		}
		function planEmptyDetailHistoryRecovery(input = {}) {
			const thread = input.thread;
			if (!thread || typeof thread !== "object") return {
				shouldRecover: false,
				reason: "missing-thread"
			};
			if (thread.mobileLoading) return {
				shouldRecover: false,
				reason: "thread-loading"
			};
			if (thread.mobileLoadError) return {
				shouldRecover: false,
				reason: "thread-load-error"
			};
			const threadId = String(input.threadId || input.currentThreadId || thread.id || "").trim();
			if (!threadId) return {
				shouldRecover: false,
				reason: "missing-thread-id"
			};
			const evidence = emptyDetailHistoryEvidenceForThread(thread);
			if (!evidence.hasEvidence) return {
				shouldRecover: false,
				reason: "no-history-evidence",
				evidence
			};
			const readMode = String(thread.mobileReadMode || "");
			const recoveryKey = [
				threadId,
				readMode,
				evidence.rolloutSizeBytes,
				evidence.omittedTurns,
				evidence.visibleItemKeyCount
			].join("|");
			const nowMs = Number.isFinite(Number(input.nowMs)) ? Number(input.nowMs) : Date.now();
			const lastRecoveredAtMs = Number(input.lastRecoveredAtMs || 0);
			const cooldownMs = Math.max(0, Number(input.cooldownMs || 0));
			if (lastRecoveredAtMs && cooldownMs && nowMs - lastRecoveredAtMs < cooldownMs) return {
				shouldRecover: false,
				reason: "cooldown",
				evidence,
				recoveryKey,
				nowMs
			};
			const details = input.details && typeof input.details === "object" ? input.details : {};
			return {
				shouldRecover: true,
				reason: "empty-detail-history-evidence",
				evidence,
				recoveryKey,
				nowMs,
				diagnosticReason: "empty_render_with_history_evidence",
				event: {
					threadId,
					readMode,
					rolloutSizeBytes: evidence.rolloutSizeBytes,
					omittedTurns: evidence.omittedTurns,
					visibleItemKeyCount: evidence.visibleItemKeyCount,
					source: String(details.source || "").slice(0, 80),
					renderMode: String(details.renderMode || "").slice(0, 80)
				}
			};
		}
		function buildThreadDetailRenderEvidence(input = {}) {
			const threadId = String(input.threadId || "").trim();
			if (!threadId) return null;
			const turnCount = boundedCount(input.turnCount);
			const visibleItemCount = boundedCount(input.visibleItemCount);
			if (!turnCount && !visibleItemCount) return null;
			return {
				atMs: Number.isFinite(Number(input.atMs)) ? Number(input.atMs) : Date.now(),
				threadId,
				threadHash: shortString(input.threadHash, 80),
				readMode: shortString(input.readMode, 80),
				sourceKind: shortString(input.sourceKind, 80),
				turnCount,
				visibleItemCount,
				itemCount: boundedCount(input.itemCount)
			};
		}
		function recentThreadDetailRenderEvidence(input = {}) {
			const evidence = input.evidence && typeof input.evidence === "object" ? input.evidence : null;
			if (!evidence || !evidence.atMs) return null;
			const nowMs = Number.isFinite(Number(input.nowMs)) ? Number(input.nowMs) : Date.now();
			const maxAgeMs = Math.max(0, Number(input.maxAgeMs || 0));
			const ageMs = Math.max(0, nowMs - Number(evidence.atMs || 0));
			if (maxAgeMs && ageMs > maxAgeMs) return null;
			return Object.assign({}, evidence, {
				ageMs,
				turnCount: boundedCount(evidence.turnCount),
				visibleItemCount: boundedCount(evidence.visibleItemCount),
				itemCount: boundedCount(evidence.itemCount)
			});
		}
		function sameThreadDetailRenderEvidence(input = {}) {
			const evidence = input.evidence && typeof input.evidence === "object" ? input.evidence : null;
			if (!evidence) return null;
			const threadId = String(input.threadId || "").trim();
			if (threadId && String(evidence.threadId || "") !== threadId) return null;
			return evidence;
		}
		function timestampMs(value) {
			if (value === null || value === void 0 || value === "") return 0;
			const numberValue = Number(value);
			if (Number.isFinite(numberValue) && numberValue > 0) return numberValue > 0xe8d4a51000 ? Math.trunc(numberValue) : Math.trunc(numberValue * 1e3);
			const parsed = Date.parse(String(value));
			return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
		}
		function threadUpdatedAtMs(thread) {
			if (!thread || typeof thread !== "object") return 0;
			return timestampMs(thread.updatedAtMs) || timestampMs(thread.updatedAt) || timestampMs(thread.updated_at_ms) || timestampMs(thread.updated_at) || timestampMs(thread.lastActivityAtMs) || timestampMs(thread.lastActivityAt) || timestampMs(thread.last_activity_at_ms) || timestampMs(thread.last_activity_at) || 0;
		}
		function summaryIsNewerThanCachedDetail(summaryThread, cachedThread, toleranceMs = 1e3) {
			const summaryMs = threadUpdatedAtMs(summaryThread);
			const cachedMs = threadUpdatedAtMs(cachedThread);
			if (!summaryMs) return false;
			if (!cachedMs) return true;
			return summaryMs > cachedMs + Math.max(0, Number(toleranceMs || 0));
		}
		function hasNonemptyThreadDetailRenderEvidence(evidence) {
			return Boolean(evidence && (boundedCount(evidence.turnCount) || boundedCount(evidence.visibleItemCount)));
		}
		function planThreadOpenCacheReuse(input = {}) {
			const requestedThreadId = String(input.requestedThreadId || input.threadId || "").trim();
			const currentThreadId = String(input.currentThreadId || "").trim();
			const thread = input.currentThread || input.thread || null;
			const summaryThread = input.summaryThread || input.summary || null;
			const threadId = String(thread && thread.id || "").trim();
			if (!requestedThreadId) return {
				shouldUseCachedCurrent: false,
				shouldReportEmptyCachedDetail: false,
				reason: "missing-requested-thread-id"
			};
			if (requestedThreadId !== currentThreadId) return {
				shouldUseCachedCurrent: false,
				shouldReportEmptyCachedDetail: false,
				reason: "different-current-thread"
			};
			if (!thread || typeof thread !== "object") return {
				shouldUseCachedCurrent: false,
				shouldReportEmptyCachedDetail: false,
				reason: "missing-current-thread"
			};
			if (threadId && threadId !== requestedThreadId) return {
				shouldUseCachedCurrent: false,
				shouldReportEmptyCachedDetail: false,
				reason: "current-thread-id-mismatch"
			};
			if (thread.mobileLoading) return {
				shouldUseCachedCurrent: false,
				shouldReportEmptyCachedDetail: false,
				reason: "current-thread-loading"
			};
			if (thread.mobileLoadError) return {
				shouldUseCachedCurrent: false,
				shouldReportEmptyCachedDetail: false,
				reason: "current-thread-load-error"
			};
			if (summaryIsNewerThanCachedDetail(summaryThread, thread)) return {
				shouldUseCachedCurrent: false,
				shouldReportEmptyCachedDetail: false,
				reason: threadHasLoadedDetailState(thread) && threadHasActiveDetailEvidence(thread) ? "summary-newer-than-active-detail" : "summary-newer-than-cached-detail"
			};
			if (threadHasVisualBaselineLoadedDetailState(thread) && threadHasActiveDetailEvidence(thread)) return {
				shouldUseCachedCurrent: true,
				shouldRefreshCurrent: true,
				shouldReportEmptyCachedDetail: false,
				reason: "active-loaded-detail-refresh-baseline"
			};
			if (threadHasReusableLoadedDetailState(thread)) return {
				shouldUseCachedCurrent: true,
				shouldReportEmptyCachedDetail: false,
				reason: "reusable-loaded-detail"
			};
			if (threadHasLoadedDetailState(thread) && threadHasActiveDetailEvidence(thread)) return {
				shouldUseCachedCurrent: false,
				shouldUseActivePreview: true,
				shouldReportEmptyCachedDetail: false,
				reason: "active-detail-cache-not-reusable"
			};
			if (threadHasLoadedDetailState(thread) && Array.isArray(thread.turns) && thread.turns.length === 0) return {
				shouldUseCachedCurrent: false,
				shouldReportEmptyCachedDetail: true,
				reason: "empty-loaded-detail-not-reusable"
			};
			return {
				shouldUseCachedCurrent: false,
				shouldReportEmptyCachedDetail: false,
				reason: "not-loaded-detail"
			};
		}
		function planThreadOpenLoadingShell(input = {}) {
			const threadId = String(input.threadId || input.requestedThreadId || "").trim();
			const summaryThread = input.summaryThread || input.summary || null;
			const summaryId = String(summaryThread && summaryThread.id || "").trim();
			if (!threadId) return {
				currentThreadId: "",
				thread: null,
				hasSummary: false,
				summaryAccepted: false,
				hadListTurnsField: false,
				reason: "missing-thread-id"
			};
			const summaryAccepted = Boolean(summaryThread && summaryId === threadId);
			const base = (summaryAccepted ? threadListSummaryFromDetailThread(summaryThread) : null) || {
				id: threadId,
				name: threadId,
				preview: threadId
			};
			return {
				currentThreadId: threadId,
				thread: Object.assign({}, base, {
					id: threadId,
					turns: [],
					mobileLoading: true,
					mobileLoadError: ""
				}),
				hasSummary: Boolean(summaryThread),
				summaryAccepted,
				hadListTurnsField: Boolean(summaryThread && Object.prototype.hasOwnProperty.call(summaryThread, "turns")),
				reason: summaryAccepted ? "summary-loading-shell" : "fallback-loading-shell"
			};
		}
		function threadIsSummaryOnlyCurrentThread(thread, currentThreadId) {
			return Boolean(thread && currentThreadId && String(thread.id || "") === String(currentThreadId || "") && !threadHasLoadedDetailState(thread) && !thread.mobileLoading && !thread.mobileLoadError);
		}
		function planSummaryOnlyCurrentThreadRecovery(input = {}) {
			const thread = input.thread;
			const currentThreadId = input.currentThreadId;
			if (!threadIsSummaryOnlyCurrentThread(thread, currentThreadId)) return {
				shouldRecover: false,
				shouldScheduleRefresh: false,
				nextThread: thread || null,
				event: null,
				reason: "not-summary-only-current-thread"
			};
			const summary = threadListSummaryFromDetailThread(thread) || Object.assign({}, thread || {});
			const nextThread = Object.assign({}, summary, {
				turns: [],
				mobileLoading: true,
				mobileLoadError: ""
			});
			return {
				shouldRecover: true,
				shouldScheduleRefresh: !input.hasThreadLoadController && !input.hasRefreshThreadController,
				nextThread,
				event: {
					threadId: String(currentThreadId || nextThread.id || ""),
					reason: "summary-only-current-thread",
					hasListTurnsField: Object.prototype.hasOwnProperty.call(thread, "turns"),
					buildId: String(input.clientBuildId || "")
				},
				reason: "summary-only-current-thread"
			};
		}
		function planSummaryOnlyCurrentThreadRecoveryEffects(plan = {}) {
			const recoveryPlan = objectOrEmpty(plan);
			const effects = [];
			if (!recoveryPlan.shouldRecover) return {
				effects,
				reason: shortString(recoveryPlan.reason || "not-recovered")
			};
			effects.push({
				type: "set-current-thread",
				thread: recoveryPlan.nextThread || null
			});
			if (recoveryPlan.event) effects.push({
				type: "post-client-event",
				name: "thread_summary_detail_recovery",
				payload: recoveryPlan.event
			});
			if (recoveryPlan.shouldScheduleRefresh) effects.push({
				type: "schedule-current-thread-refresh",
				delayMs: 0,
				reason: "summary-detail-recovery"
			});
			return {
				effects,
				reason: shortString(recoveryPlan.reason || "summary-only-current-thread")
			};
		}
		function mergeThreadSummaryIntoList(threads, thread, options = {}) {
			const summary = threadListSummaryFromDetailThread(thread);
			const currentThreads = Array.isArray(threads) ? threads : [];
			if (!summary) return {
				changed: false,
				threads: currentThreads
			};
			const id = String(summary.id);
			const index = currentThreads.findIndex((entry) => String(entry && entry.id || "") === id);
			let nextThreads;
			if (index >= 0) {
				const existingSummary = threadListSummaryFromDetailThread(currentThreads[index]) || {};
				nextThreads = currentThreads.map((entry, entryIndex) => entryIndex === index ? Object.assign({}, existingSummary, summary) : entry);
			} else nextThreads = [summary, ...currentThreads];
			return {
				changed: true,
				threads: (typeof options.visibleThreads === "function" ? options.visibleThreads : (value) => value)(nextThreads)
			};
		}
		function createThreadDetailStatePolicy(options = {}) {
			const itemVisibleWeight = typeof options.itemVisibleWeight === "function" ? options.itemVisibleWeight : defaultVisibleWeight;
			const isContextCompactionItem = typeof options.isContextCompactionItem === "function" ? options.isContextCompactionItem : () => false;
			const isOperationalItem = typeof options.isOperationalItem === "function" ? options.isOperationalItem : () => false;
			const isAssistantReceiptLikeItem = typeof options.isAssistantReceiptLikeItem === "function" ? options.isAssistantReceiptLikeItem : () => false;
			const isTurnComplete = typeof options.isTurnComplete === "function" ? options.isTurnComplete : () => false;
			const isReasoningItem = typeof options.isReasoningItem === "function" ? options.isReasoningItem : () => false;
			const visualReceiptMatchesSuppressionKeys = typeof options.visualReceiptMatchesSuppressionKeys === "function" ? options.visualReceiptMatchesSuppressionKeys : () => false;
			const comparableVisibleText = typeof options.comparableVisibleText === "function" ? options.comparableVisibleText : () => "";
			const visibleTextItemsLikelySame = typeof options.visibleTextItemsLikelySame === "function" ? options.visibleTextItemsLikelySame : () => false;
			const completedReceiptItemsLikelySame = typeof options.completedReceiptItemsLikelySame === "function" ? options.completedReceiptItemsLikelySame : () => false;
			const turnVisibleWeight = typeof options.turnVisibleWeight === "function" ? options.turnVisibleWeight : (turn) => (Array.isArray(turn && turn.items) ? turn.items : []).reduce((total, item) => total + itemVisibleWeight(item), 0);
			function completedIncomingTurnHasAuthoritativeReceipt(incomingTurn) {
				if (!incomingTurn || !isTurnComplete(incomingTurn) || !Array.isArray(incomingTurn.items)) return false;
				return incomingTurn.items.some((item) => isAssistantReceiptLikeItem(item));
			}
			function shouldDropLocalOnlyReceiptForIncomingTurn(item, incomingTurn = null) {
				return isAssistantReceiptLikeItem(item) && completedIncomingTurnHasAuthoritativeReceipt(incomingTurn);
			}
			function shouldPreserveLocalOnlyItem(item, preserveLocalVisible = false, suppressedVisualReceiptKeys = null, incomingTurn = null) {
				if (!item || itemVisibleWeight(item) <= 0) return false;
				if (visualReceiptMatchesSuppressionKeys(item, suppressedVisualReceiptKeys)) return false;
				if (shouldDropLocalOnlyReceiptForIncomingTurn(item, incomingTurn)) return false;
				if (item.type === "userMessage" && completedIncomingTurnHasAuthoritativeReceipt(incomingTurn)) return false;
				if (item.type === "userMessage" && /^mux-user-/.test(String(item.id || ""))) return true;
				return preserveLocalVisible && !isReasoningItem(item);
			}
			function shouldPreserveExistingTurnVisibleItems(existingTurn, incomingTurn, existingWeight = null) {
				if (!existingTurn || !incomingTurn) return false;
				if (String(existingTurn.id || "") !== String(incomingTurn.id || "")) return false;
				if (isTurnComplete(existingTurn)) return false;
				return (existingWeight == null ? turnVisibleWeight(existingTurn) : Number(existingWeight || 0)) > 0;
			}
			function mergeItemPreservingVisibleFields(existingItem, incomingItem) {
				if (!existingItem || !incomingItem) return incomingItem || existingItem;
				if (itemVisibleWeight(existingItem) <= itemVisibleWeight(incomingItem)) return incomingItem;
				const merged = Object.assign({}, existingItem, incomingItem);
				if (typeof existingItem.text === "string") merged.text = existingItem.text;
				if (Array.isArray(existingItem.content)) merged.content = existingItem.content;
				if (Array.isArray(existingItem.summary)) merged.summary = existingItem.summary;
				if (isContextCompactionItem(existingItem) || isContextCompactionItem(incomingItem)) {
					if (!Object.prototype.hasOwnProperty.call(incomingItem, "mobileNotice")) delete merged.mobileNotice;
					if (!Object.prototype.hasOwnProperty.call(incomingItem, "mobileCompactionStatus")) delete merged.mobileCompactionStatus;
				} else if (existingItem.mobileNotice) merged.mobileNotice = existingItem.mobileNotice;
				if (isOperationalItem(existingItem)) {
					if (existingItem.command) merged.command = existingItem.command;
					if (Array.isArray(existingItem.fileNames)) merged.fileNames = existingItem.fileNames;
					if (existingItem.tool) merged.tool = existingItem.tool;
					if (existingItem.server) merged.server = existingItem.server;
					if (existingItem.namespace) merged.namespace = existingItem.namespace;
				}
				return merged;
			}
			function visibleTextItemsCanShareRenderIdentity(existingItem, incomingItem, incomingTurn = null) {
				return visibleTextItemsLikelySame(existingItem, incomingItem) || completedReceiptItemsLikelySame(existingItem, incomingItem, incomingTurn);
			}
			function mergeVisibleTextItemPreservingRenderIdentity(existingItem, incomingItem, incomingTurn = null) {
				const merged = mergeItemPreservingVisibleFields(existingItem, incomingItem);
				if (!existingItem || !incomingItem || !merged || !visibleTextItemsCanShareRenderIdentity(existingItem, incomingItem, incomingTurn)) return merged;
				const existingText = comparableVisibleText(existingItem);
				const incomingText = comparableVisibleText(incomingItem);
				if (completedReceiptItemsLikelySame(existingItem, incomingItem, incomingTurn) && typeof existingItem.text === "string" && existingText.length > incomingText.length && existingText.startsWith(incomingText)) merged.text = existingItem.text;
				if (existingItem.id) merged.id = existingItem.id;
				if (existingItem.startedAtMs && !incomingItem.startedAtMs) merged.startedAtMs = existingItem.startedAtMs;
				return merged;
			}
			return {
				completedIncomingTurnHasAuthoritativeReceipt,
				mergeItemPreservingVisibleFields,
				mergeVisibleTextItemPreservingRenderIdentity,
				shouldDropLocalOnlyReceiptForIncomingTurn,
				shouldPreserveExistingTurnVisibleItems,
				shouldPreserveLocalOnlyItem,
				visibleTextItemsCanShareRenderIdentity
			};
		}
		return {
			buildThreadDetailRenderEvidence,
			activeDetailLoadingPreviewThread,
			createThreadDetailStatePolicy,
			emptyDetailHistoryEvidenceForThread,
			hasNonemptyThreadDetailRenderEvidence,
			mergeThreadSummaryIntoList,
			planEmptyDetailHistoryRecovery,
			planThreadOpenLoadingShell,
			planThreadOpenCacheReuse,
			planSummaryOnlyCurrentThreadRecovery,
			planSummaryOnlyCurrentThreadRecoveryEffects,
			recentThreadDetailRenderEvidence,
			rolloutSizeBytesFromThread,
			sameThreadDetailRenderEvidence,
			threadHasLoadedDetailState,
			threadHasReusableLoadedDetailState,
			threadHasVisualBaselineLoadedDetailState,
			threadIsSummaryOnlyCurrentThread,
			threadListSummaryFromDetailThread
		};
	});
}));
//#endregion
//#region public/thread-detail-render-plan.js
var require_thread_detail_render_plan = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexThreadDetailRenderPlan = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		function normalizeSignature(value) {
			return String(value || "");
		}
		function normalizedDurationMs(value) {
			const numberValue = Number(value);
			return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : 0;
		}
		function normalizedOptionalDurationMs(value) {
			if (value == null) return null;
			return normalizedDurationMs(value);
		}
		function normalizedCount(value) {
			const numberValue = Number(value);
			return Number.isFinite(numberValue) && numberValue > 0 ? Math.trunc(numberValue) : 0;
		}
		function normalizedStringList(value) {
			return Array.isArray(value) ? value.map((entry) => String(entry || "")).filter(Boolean) : [];
		}
		function turnOrderMismatch(expectedValue, renderedValue) {
			const expected = normalizedStringList(expectedValue);
			const rendered = normalizedStringList(renderedValue);
			if (!expected.length) return false;
			if (expected.length !== rendered.length) return true;
			for (let index = 0; index < expected.length; index += 1) if (expected[index] !== rendered[index]) return true;
			return false;
		}
		function compactReason(value, fallback = "", maxLength = 80) {
			return (String(value || "").trim() || fallback).slice(0, maxLength);
		}
		function objectOrEmpty(value) {
			return value && typeof value === "object" && !Array.isArray(value) ? value : {};
		}
		function textContentFromValue(value) {
			if (value == null) return "";
			if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
			if (Array.isArray(value)) return value.map(textContentFromValue).join("");
			if (typeof value !== "object") return "";
			if (typeof value.text === "string") return value.text;
			if (typeof value.markdown === "string") return value.markdown;
			if (typeof value.content === "string" || Array.isArray(value.content)) return textContentFromValue(value.content);
			if (typeof value.summary === "string" || Array.isArray(value.summary)) return textContentFromValue(value.summary);
			return "";
		}
		function itemVisibleText(item) {
			if (typeof item === "string") return item;
			const value = objectOrEmpty(item);
			return [
				textContentFromValue(value.text),
				textContentFromValue(value.markdown),
				textContentFromValue(value.content),
				textContentFromValue(value.summary)
			].join("");
		}
		function textLooksLikeWorkflowCard(value) {
			const body = String(value || "");
			return /^\s*\[Cross-thread task card/im.test(body) || /^\s*\[Codex Mobile task-card continuation\]/im.test(body) || /^\s*#\s*Continuation Bootstrap Index\b/im.test(body) || /^\s*Task card id:/im.test(body) || /^\s*Source workspace:/im.test(body) || /^\s*Source thread:/im.test(body) || /^\s*Approval:/im.test(body) || /^\s*Workflow mode:/im.test(body) || /^\s*Auto-return:/im.test(body) || /^\s*Return required:/im.test(body) || /^\s*Return policy:/im.test(body);
		}
		function analyzeThreadDetailHistoryWindow(thread) {
			const turns = Array.isArray(thread && thread.turns) ? thread.turns : [];
			const counts = {
				turnCount: turns.length,
				textItemCount: 0,
				workflowItemCount: 0,
				ordinaryUserMessageCount: 0,
				leadingAssistantOnlyWorkflowTurns: 0
			};
			let stillLeading = true;
			for (const turn of turns) {
				const items = Array.isArray(turn && turn.items) ? turn.items : [];
				let turnHasText = false;
				let turnHasWorkflow = false;
				let turnHasOrdinaryUser = false;
				for (const item of items) {
					const itemType = String(item && item.type || "");
					const textValue = itemVisibleText(item).trim();
					if (!textValue) continue;
					turnHasText = true;
					counts.textItemCount += 1;
					const workflow = textLooksLikeWorkflowCard(textValue);
					if (workflow) {
						counts.workflowItemCount += 1;
						turnHasWorkflow = true;
					}
					if (itemType === "userMessage" && !workflow) {
						counts.ordinaryUserMessageCount += 1;
						turnHasOrdinaryUser = true;
					}
				}
				if (stillLeading && turnHasText && turnHasWorkflow && !turnHasOrdinaryUser) counts.leadingAssistantOnlyWorkflowTurns += 1;
				else if (turnHasText) stillLeading = false;
			}
			return counts;
		}
		function planThreadDetailHistoryAutoBackfill(input = {}) {
			const thread = objectOrEmpty(input.thread);
			const counts = analyzeThreadDetailHistoryWindow(thread);
			const hasOlder = Boolean(input.hasOlder || thread.mobileOlderTurnsCursor);
			const base = {
				shouldLoad: false,
				reason: "",
				counts
			};
			if (!hasOlder) return Object.assign({}, base, { reason: "no-older-cursor" });
			if (input.alreadyRequested) return Object.assign({}, base, { reason: "already-requested" });
			if (input.historyBusy || input.busy) return Object.assign({}, base, { reason: "history-busy" });
			if (input.mobileHistoryExpanded || thread.mobileHistoryExpanded) return Object.assign({}, base, { reason: "history-expanded" });
			if (thread.mobileLoading) return Object.assign({}, base, { reason: "thread-loading" });
			if (counts.turnCount <= 0) return Object.assign({}, base, {
				shouldLoad: true,
				reason: "empty-recent-window"
			});
			if (counts.leadingAssistantOnlyWorkflowTurns >= 3 && counts.workflowItemCount > 0) return Object.assign({}, base, {
				shouldLoad: true,
				reason: "leading-workflow-receipts"
			});
			const workflowRatio = counts.textItemCount > 0 ? counts.workflowItemCount / counts.textItemCount : 0;
			if (counts.workflowItemCount >= 3 && workflowRatio >= .45) return Object.assign({}, base, {
				shouldLoad: true,
				reason: "workflow-dominated-window"
			});
			if (counts.ordinaryUserMessageCount < 2 && counts.workflowItemCount > 0) return Object.assign({}, base, {
				shouldLoad: true,
				reason: "sparse-conversation-context"
			});
			return Object.assign({}, base, { reason: "recent-window-has-context" });
		}
		function planThreadDetailHistoryAutoBackfillEffects(input = {}) {
			const plan = objectOrEmpty(input.plan);
			if (!plan.shouldLoad) return {
				effects: [],
				reason: compactReason(plan.reason, "not-needed")
			};
			const source = compactReason(input.source, "unknown").slice(0, 40);
			const threadId = compactReason(input.threadId, "");
			const seq = Number(input.seq);
			return {
				effects: [
					{
						type: "remember-history-auto-backfill-key",
						key: compactReason(input.key, "")
					},
					{
						type: "post-client-event",
						eventName: "thread_history_auto_backfill",
						payload: {
							source,
							reason: compactReason(plan.reason, ""),
							counts: objectOrEmpty(plan.counts),
							thread_hash: compactReason(input.threadHash, ""),
							readMode: compactReason(input.readMode, ""),
							buildId: compactReason(input.buildId, "")
						}
					},
					{
						type: "schedule-load-older-thread-turns",
						threadId,
						seq: Number.isFinite(seq) ? seq : 0,
						delayMs: normalizedDurationMs(input.delayMs),
						preserveScroll: true,
						source: "auto-context"
					}
				],
				reason: "history-auto-backfill-effects"
			};
		}
		function planThreadDetailRefreshRequest(input = {}) {
			const options = objectOrEmpty(input.options);
			const threadId = input.threadId || input.currentThreadId || "";
			const source = String(options.source || "refresh").slice(0, 40);
			if (!threadId) return {
				shouldRefresh: false,
				threadId: "",
				seq: input.threadLoadSeq,
				source: "",
				requestedMode: "",
				query: {},
				timeoutMs: 2e4,
				abortActiveRefresh: false,
				reason: "missing-thread-id"
			};
			if (input.documentHidden === true && options.force !== true) return {
				shouldRefresh: false,
				threadId,
				seq: input.threadLoadSeq,
				source,
				requestedMode: "",
				query: {},
				timeoutMs: 2e4,
				abortActiveRefresh: false,
				reason: "document-hidden"
			};
			if (input.hasActiveThreadLoadController === true && options.force !== true) return {
				shouldRefresh: false,
				threadId,
				seq: input.threadLoadSeq,
				source,
				requestedMode: "",
				query: {},
				timeoutMs: 2e4,
				abortActiveRefresh: false,
				reason: "thread-load-in-flight"
			};
			const requestedMode = options.full === true || String(options.mode || "").toLowerCase() === "full" ? "full" : "recent";
			return {
				shouldRefresh: true,
				threadId,
				seq: input.threadLoadSeq,
				source,
				requestedMode,
				query: requestedMode === "recent" ? { mode: "recent" } : {},
				timeoutMs: 2e4,
				abortActiveRefresh: Boolean(input.hasActiveRefreshController),
				reason: requestedMode === "full" ? "full-requested" : "recent-default"
			};
		}
		function planThreadDetailRefreshResponseEffects(input = {}) {
			const threadId = text(input.threadId || input.requestThreadId).trim();
			const currentThreadId = text(input.currentThreadId).trim();
			const seq = Number(input.seq ?? input.requestSeq);
			const currentSeq = Number(input.currentThreadSeq ?? input.threadLoadSeq);
			const source = compactReason(input.source, "refresh");
			const staleThread = Boolean(threadId && currentThreadId && threadId !== currentThreadId);
			if (staleThread || Boolean(Number.isFinite(seq) && Number.isFinite(currentSeq) && seq !== currentSeq)) return {
				shouldApply: false,
				effects: [],
				reason: staleThread ? "stale-thread" : "stale-seq"
			};
			return {
				shouldApply: true,
				effects: [
					{ type: "mark-thread-detail-loaded" },
					{
						type: "remember-render-evidence",
						source: `${source}-detail-api`
					},
					{ type: "merge-current-thread" }
				],
				reason: "current-thread"
			};
		}
		function planThreadDetailFirstPaintResponseEffects(input = {}) {
			return {
				shouldApply: true,
				effects: [
					{ type: "mark-thread-detail-loaded" },
					{
						type: "remember-render-evidence",
						source: `${compactReason(input.source, "unknown").slice(0, 40)}-detail-api`
					},
					{ type: "sync-pending-server-requests" },
					{ type: "merge-current-thread" }
				],
				reason: "first-paint-response"
			};
		}
		function planThreadDetailFullBackfillResponseEffects(input = {}) {
			return {
				shouldApply: true,
				effects: [
					{ type: "mark-thread-detail-loaded" },
					{
						type: "remember-render-evidence",
						source: `${compactReason(input.source, "unknown").slice(0, 40)}-detail-api`
					},
					{ type: "sync-pending-server-requests" },
					{ type: "merge-current-thread" }
				],
				reason: "full-backfill-response"
			};
		}
		function planThreadDetailRefreshConsistencyCheck(input = {}) {
			const phase = compactReason(input.projectionConsistencyPhase || input.phase, "");
			const renderMode = compactReason(input.renderMode || input.detailRenderMode, "");
			if (!phase) return {
				shouldCheck: false,
				phase: "",
				renderMode,
				reason: "no-phase"
			};
			return {
				shouldCheck: true,
				phase,
				renderMode,
				reason: "phase-present"
			};
		}
		function planThreadDetailRefreshConsistencyCheckEffects(input = {}) {
			const consistencyCheck = objectOrEmpty(input.consistencyCheck || input);
			const phase = compactReason(consistencyCheck.phase, "");
			const renderMode = compactReason(consistencyCheck.renderMode, "");
			if (!consistencyCheck.shouldCheck || !phase) return {
				effects: [],
				reason: compactReason(consistencyCheck.reason, "no-consistency-check")
			};
			return {
				effects: [{
					type: "conversation-projection-consistency-check",
					phase,
					renderMode
				}],
				reason: "consistency-check"
			};
		}
		function planThreadDetailRefreshRenderInput(input = {}) {
			const nextVisibleShape = objectOrEmpty(input.nextVisibleShape);
			const nextVisibleTurnCount = Object.prototype.hasOwnProperty.call(input, "nextVisibleTurnCount") ? input.nextVisibleTurnCount : nextVisibleShape.visibleTurnCount;
			const nextVisibleItemCount = Object.prototype.hasOwnProperty.call(input, "nextVisibleItemCount") ? input.nextVisibleItemCount : nextVisibleShape.visibleItemCount;
			return {
				previousConversationSignature: normalizeSignature(input.previousConversationSignature),
				nextConversationSignature: normalizeSignature(input.nextConversationSignature),
				renderedConversationSignature: normalizeSignature(input.renderedConversationSignature),
				previousPatchShellSignature: normalizeSignature(input.previousPatchShellSignature),
				renderedPatchShellSignature: normalizeSignature(input.renderedPatchShellSignature),
				allowPatch: input.allowPatch !== false,
				singleThreadSurfaceAvailable: input.singleThreadSurfaceAvailable === true,
				renderedDomTurnCount: normalizedCount(input.renderedDomTurnCount),
				renderedDomItemCount: normalizedCount(input.renderedDomItemCount),
				duplicateRenderKeyCount: normalizedCount(input.duplicateRenderKeyCount),
				nextVisibleTurnCount: normalizedCount(nextVisibleTurnCount),
				nextVisibleItemCount: normalizedCount(nextVisibleItemCount),
				expectedTurnIds: normalizedStringList(input.expectedTurnIds),
				renderedDomTurnIds: normalizedStringList(input.renderedDomTurnIds)
			};
		}
		function planThreadDetailRefreshRender(input = {}) {
			const renderInput = planThreadDetailRefreshRenderInput(input);
			const previousConversationSignature = renderInput.previousConversationSignature;
			const nextConversationSignature = renderInput.nextConversationSignature;
			const renderedConversationSignature = renderInput.renderedConversationSignature;
			const previousPatchShellSignature = renderInput.previousPatchShellSignature;
			const renderedPatchShellSignature = renderInput.renderedPatchShellSignature;
			const allowPatch = renderInput.allowPatch !== false;
			const singleThreadSurfaceAvailable = renderInput.singleThreadSurfaceAvailable === true;
			const renderedDomTurnCount = renderInput.renderedDomTurnCount;
			const nextVisibleTurnCount = renderInput.nextVisibleTurnCount;
			const renderedDomMissingVisibleTurns = Boolean(singleThreadSurfaceAvailable && nextVisibleTurnCount > 0 && renderedDomTurnCount < nextVisibleTurnCount);
			const renderedDomMissingVisibleItems = Boolean(singleThreadSurfaceAvailable && renderInput.nextVisibleItemCount > 0 && renderInput.renderedDomItemCount < renderInput.nextVisibleItemCount);
			const renderedDomDuplicateKeys = Boolean(singleThreadSurfaceAvailable && renderInput.duplicateRenderKeyCount > 0);
			const renderedDomTurnOrderMismatch = Boolean(singleThreadSurfaceAvailable && turnOrderMismatch(renderInput.expectedTurnIds, renderInput.renderedDomTurnIds));
			const renderedDomInvalidForNonemptyDetail = renderedDomMissingVisibleTurns || renderedDomMissingVisibleItems || renderedDomDuplicateKeys || renderedDomTurnOrderMismatch;
			if (!(renderedDomInvalidForNonemptyDetail || previousConversationSignature !== nextConversationSignature || renderedConversationSignature !== nextConversationSignature)) return {
				shouldRenderDetail: false,
				canPatch: false,
				detailRenderMode: "metadata-only",
				reason: "signature-stable"
			};
			if (renderedDomInvalidForNonemptyDetail) {
				let reason = "rendered-dom-empty";
				if (renderedDomDuplicateKeys) reason = "rendered-dom-duplicate-render-keys";
				else if (renderedDomTurnOrderMismatch) reason = "rendered-dom-turn-order-mismatch";
				else if (renderedDomMissingVisibleItems) reason = "rendered-dom-item-mismatch";
				else if (renderedDomMissingVisibleTurns && renderedDomTurnCount > 0) reason = "rendered-dom-turn-mismatch";
				return {
					shouldRenderDetail: true,
					canPatch: false,
					detailRenderMode: "full-render",
					reason
				};
			}
			const fullSignatureMatches = Boolean(previousConversationSignature && renderedConversationSignature && previousConversationSignature === renderedConversationSignature);
			const canPatch = Boolean(allowPatch && (fullSignatureMatches || Boolean(previousPatchShellSignature && renderedPatchShellSignature && previousPatchShellSignature === renderedPatchShellSignature)));
			return {
				shouldRenderDetail: true,
				canPatch,
				detailRenderMode: canPatch ? "patch" : "full-render",
				reason: canPatch ? fullSignatureMatches ? "signature-changed" : "patch-shell-stable" : "rendered-signature-stale"
			};
		}
		function planThreadDetailRefreshRenderStage(input = {}) {
			const refreshRenderInput = planThreadDetailRefreshRenderInput(input);
			const renderPlan = planThreadDetailRefreshRender(refreshRenderInput);
			return {
				refreshRenderInput,
				renderPlan,
				shouldRenderDetail: Boolean(renderPlan.shouldRenderDetail),
				detailRenderMode: compactReason(renderPlan.detailRenderMode, ""),
				reason: compactReason(renderPlan.reason, "refresh-render-stage")
			};
		}
		function planThreadDetailRefreshPatchExecution(input = {}) {
			const shouldRenderDetail = Boolean(input.shouldRenderDetail);
			const canPatch = Boolean(input.canPatch);
			const tileSurfaceRefresh = Boolean(input.tileSurfaceRefresh);
			if (!shouldRenderDetail) return {
				tryTilePanePatch: true,
				tryLocalPatch: false,
				updateMetadataOnTileMiss: true,
				fallbackAction: "metadata-update",
				localPatchBlockedReason: "signature-stable",
				reason: "metadata-only"
			};
			if (!canPatch) return {
				tryTilePanePatch: true,
				tryLocalPatch: false,
				updateMetadataOnTileMiss: false,
				fallbackAction: "full-render",
				localPatchBlockedReason: "patch-not-allowed",
				reason: "full-render-required"
			};
			if (tileSurfaceRefresh) return {
				tryTilePanePatch: true,
				tryLocalPatch: true,
				updateMetadataOnTileMiss: false,
				fallbackAction: "full-render",
				localPatchBlockedReason: "",
				reason: "tile-surface-patch-chain"
			};
			return {
				tryTilePanePatch: true,
				tryLocalPatch: true,
				updateMetadataOnTileMiss: false,
				fallbackAction: "full-render",
				localPatchBlockedReason: "",
				reason: "local-patch-eligible"
			};
		}
		function planThreadDetailRefreshPatchSurface(input = {}) {
			const shouldRenderDetail = Boolean(input.shouldRenderDetail);
			const threadTileMode = Boolean(input.threadTileMode);
			const threadTileConversationSurface = Boolean(input.threadTileConversationSurface);
			const tilePatchSurface = compactReason(input.tilePatchSurface || input.surface, "");
			const tilePatchSurfaceMatch = tilePatchSurface === "thread-tile-pane";
			const tileSurfaceRefresh = Boolean(threadTileMode || threadTileConversationSurface || tilePatchSurfaceMatch);
			let reason = "single-thread-surface";
			if (threadTileMode) reason = "tile-mode";
			else if (threadTileConversationSurface) reason = "tile-conversation-surface";
			else if (tilePatchSurfaceMatch) reason = "tile-patch-surface";
			else if (!shouldRenderDetail) reason = "metadata-only-single-thread-surface";
			return {
				shouldProbeTilePatchSurface: shouldRenderDetail,
				tileSurfaceRefresh,
				tilePatchSurface,
				reason
			};
		}
		function planThreadDetailRefreshPatchSurfaceProbeEffects(input = {}) {
			const patchSurfacePlan = objectOrEmpty(input.patchSurfacePlan || input.plan);
			if (!patchSurfacePlan.shouldProbeTilePatchSurface) return {
				effects: [],
				reason: compactReason(patchSurfacePlan.reason, "no-patch-surface-probe")
			};
			return {
				effects: [{
					type: "probe-thread-detail-dom-patch-surface",
					threadId: compactReason(input.threadId, "")
				}],
				reason: "patch-surface-probe"
			};
		}
		function planThreadDetailRefreshPatchSurfaceProbeStage(input = {}) {
			const patchSurfaceProbePlan = planThreadDetailRefreshPatchSurface({
				shouldRenderDetail: input.shouldRenderDetail,
				threadTileMode: input.threadTileMode,
				threadTileConversationSurface: input.threadTileConversationSurface
			});
			const patchSurfaceProbeEffectsPlan = planThreadDetailRefreshPatchSurfaceProbeEffects({
				patchSurfacePlan: patchSurfaceProbePlan,
				threadId: input.threadId
			});
			return {
				patchSurfaceProbePlan,
				patchSurfaceProbeEffectsPlan,
				reason: patchSurfaceProbeEffectsPlan.reason
			};
		}
		function planThreadDetailRefreshPatchSurfaceResultStage(input = {}) {
			const tilePatchPlan = objectOrEmpty(input.tilePatchPlan);
			const patchSurfacePlan = planThreadDetailRefreshPatchSurface({
				shouldRenderDetail: input.shouldRenderDetail,
				threadTileMode: input.threadTileMode,
				threadTileConversationSurface: input.threadTileConversationSurface,
				tilePatchSurface: input.tilePatchSurface || tilePatchPlan.surface
			});
			return {
				patchSurfacePlan,
				reason: patchSurfacePlan.reason
			};
		}
		function planThreadDetailRefreshPatchSurfaceExecutionStage(input = {}) {
			const renderPlan = objectOrEmpty(input.renderPlan);
			const shouldRenderDetail = Object.prototype.hasOwnProperty.call(input, "shouldRenderDetail") ? Boolean(input.shouldRenderDetail) : Boolean(renderPlan.shouldRenderDetail);
			const patchSurfaceResultStage = planThreadDetailRefreshPatchSurfaceResultStage({
				shouldRenderDetail,
				threadTileMode: input.threadTileMode,
				threadTileConversationSurface: input.threadTileConversationSurface,
				tilePatchPlan: input.tilePatchPlan,
				tilePatchSurface: input.tilePatchSurface
			});
			const patchExecutionStage = planThreadDetailRefreshPatchExecutionStage({
				renderPlan,
				shouldRenderDetail,
				patchSurfacePlan: patchSurfaceResultStage.patchSurfacePlan
			});
			return {
				patchSurfaceResultStage,
				patchSurfacePlan: patchSurfaceResultStage.patchSurfacePlan,
				patchExecutionStage,
				patchExecutionPlan: patchExecutionStage.patchExecutionPlan,
				patchAttemptEffectsPlan: patchExecutionStage.patchAttemptEffectsPlan,
				reason: patchExecutionStage.reason
			};
		}
		function planThreadDetailRefreshPostMergeEffects() {
			return {
				groups: [
					{
						timing: "merge",
						timingField: "mergeMs",
						effects: ["merge-thread-list"]
					},
					{
						timing: "composer-render",
						timingField: "composerRenderMs",
						effects: ["render-composer-settings", "sync-active-turn"]
					},
					{
						timing: "thread-list-render",
						timingField: "threadListRenderMs",
						effects: ["render-threads"]
					}
				],
				reason: "default-post-merge-effects"
			};
		}
		function planThreadDetailRefreshPostMergeTimingFields(plan = {}) {
			const groups = Array.isArray(plan && plan.groups) ? plan.groups : [];
			if (!groups.length) return {
				ok: false,
				entries: [],
				timings: {},
				reason: "missing-post-merge-groups"
			};
			const seenFields = /* @__PURE__ */ new Set();
			const entries = [];
			const timings = {};
			for (const group of groups) {
				const timing = compactReason(group && group.timing, "");
				const field = compactReason(group && group.timingField, "");
				if (!timing || !field) return {
					ok: false,
					entries: [],
					timings: {},
					reason: "missing-post-merge-timing-metadata"
				};
				if (seenFields.has(field)) return {
					ok: false,
					entries: [],
					timings: {},
					reason: "duplicate-post-merge-timing-field"
				};
				seenFields.add(field);
				entries.push({
					timing,
					field
				});
				timings[field] = 0;
			}
			return {
				ok: true,
				entries,
				timings,
				reason: "post-merge-timing-fields"
			};
		}
		function planThreadDetailFirstPaintPostMergeTimingEffects(plan = {}) {
			const timingFieldsPlan = planThreadDetailRefreshPostMergeTimingFields(plan);
			if (!timingFieldsPlan.ok) return {
				ok: false,
				beforeDraftRestore: [],
				afterDraftRestore: [],
				timings: {},
				reason: timingFieldsPlan.reason
			};
			const beforeDraftRestore = [];
			const afterDraftRestore = [];
			for (const entry of timingFieldsPlan.entries) if (entry.timing === "merge") beforeDraftRestore.push(entry);
			else afterDraftRestore.push(entry);
			if (!beforeDraftRestore.length) return {
				ok: false,
				beforeDraftRestore: [],
				afterDraftRestore: [],
				timings: {},
				reason: "missing-first-paint-merge-timing"
			};
			return {
				ok: true,
				beforeDraftRestore,
				afterDraftRestore,
				timings: Object.assign({}, timingFieldsPlan.timings),
				reason: "first-paint-post-merge-timing-effects"
			};
		}
		function planThreadDetailRefreshPatchAttemptEffects(input = {}) {
			const shouldRenderDetail = Boolean(input.shouldRenderDetail);
			const tryTilePanePatch = Boolean(input.tryTilePanePatch);
			const tryLocalPatch = Boolean(input.tryLocalPatch);
			const effects = [];
			if (tryTilePanePatch) effects.push({
				type: "tile-pane-patch",
				timingTarget: "tile-pane-patch",
				preserveScroll: true
			});
			if (shouldRenderDetail && tryLocalPatch) effects.push({
				type: "local-patch",
				timingTarget: "local-patch",
				skipWhenTilePanePatched: true
			});
			return {
				effects,
				reason: effects.length ? "patch-attempt-effects" : "no-patch-attempt-effects"
			};
		}
		function planThreadDetailRefreshPatchExecutionStage(input = {}) {
			const renderPlan = objectOrEmpty(input.renderPlan);
			const patchSurfacePlan = objectOrEmpty(input.patchSurfacePlan);
			const shouldRenderDetail = Object.prototype.hasOwnProperty.call(input, "shouldRenderDetail") ? Boolean(input.shouldRenderDetail) : Boolean(renderPlan.shouldRenderDetail);
			const patchExecutionPlan = planThreadDetailRefreshPatchExecution({
				shouldRenderDetail,
				canPatch: Object.prototype.hasOwnProperty.call(input, "canPatch") ? Boolean(input.canPatch) : Boolean(renderPlan.canPatch),
				tileSurfaceRefresh: Object.prototype.hasOwnProperty.call(input, "tileSurfaceRefresh") ? Boolean(input.tileSurfaceRefresh) : Boolean(patchSurfacePlan.tileSurfaceRefresh)
			});
			return {
				patchExecutionPlan,
				patchAttemptEffectsPlan: planThreadDetailRefreshPatchAttemptEffects({
					shouldRenderDetail,
					tryTilePanePatch: patchExecutionPlan.tryTilePanePatch,
					tryLocalPatch: patchExecutionPlan.tryLocalPatch
				}),
				reason: patchExecutionPlan.reason
			};
		}
		function emptyThreadDetailRefreshPatchAttempt() {
			return {
				tilePanePatchAttempted: false,
				tilePanePatchedDetail: false,
				localPatchAttempted: false,
				locallyPatchedDetail: false,
				tilePanePatchMs: 0,
				localPatchMs: 0,
				patchRejectReason: ""
			};
		}
		function threadDetailRefreshPatchAttemptEffectContext(context = {}, aggregate = {}) {
			return Object.assign({}, objectOrEmpty(context), { tilePanePatchedDetail: Boolean(aggregate && aggregate.tilePanePatchedDetail) });
		}
		function reduceThreadDetailRefreshPatchAttempt(aggregate = {}, attempt = {}) {
			const result = Object.assign(emptyThreadDetailRefreshPatchAttempt(), objectOrEmpty(aggregate));
			const patchAttempt = objectOrEmpty(attempt);
			if (patchAttempt.tilePanePatchAttempted) {
				result.tilePanePatchAttempted = true;
				result.tilePanePatchedDetail = Boolean(patchAttempt.tilePanePatchedDetail);
				result.tilePanePatchMs = normalizedDurationMs(result.tilePanePatchMs) + normalizedDurationMs(patchAttempt.tilePanePatchMs);
			}
			if (patchAttempt.localPatchAttempted) {
				result.localPatchAttempted = true;
				result.locallyPatchedDetail = Boolean(patchAttempt.locallyPatchedDetail);
				result.localPatchMs = normalizedDurationMs(result.localPatchMs) + normalizedDurationMs(patchAttempt.localPatchMs);
				result.patchRejectReason = compactReason(patchAttempt.patchRejectReason, "");
			}
			return result;
		}
		function planThreadDetailRefreshPatchAttemptResult(input = {}) {
			const shouldRenderDetail = Boolean(input.shouldRenderDetail);
			const tilePanePatchAttempted = Boolean(input.tilePanePatchAttempted);
			const localPatchAttempted = Boolean(input.localPatchAttempted);
			const tilePanePatchedDetail = Boolean(input.tilePanePatchedDetail);
			const locallyPatchedDetail = !tilePanePatchedDetail && Boolean(input.locallyPatchedDetail);
			const tilePanePatchMs = normalizedDurationMs(input.tilePanePatchMs);
			const localPatchMs = normalizedDurationMs(input.localPatchMs);
			let patchResult = "not-attempted";
			let detailPatchMs = 0;
			let patchTimingSource = "";
			if (tilePanePatchedDetail) {
				patchResult = shouldRenderDetail ? "tile-pane-patched" : "tile-pane-metadata-patched";
				detailPatchMs = tilePanePatchMs;
				patchTimingSource = "tile-pane";
			} else if (locallyPatchedDetail) {
				patchResult = "local-patched";
				detailPatchMs = localPatchMs;
				patchTimingSource = "local-patch";
			} else if (localPatchAttempted) {
				patchResult = "local-patch-rejected";
				detailPatchMs = localPatchMs;
				patchTimingSource = "local-patch-rejected";
			} else if (tilePanePatchAttempted) patchResult = "tile-pane-miss";
			const reportLocalPatchRejected = Boolean(shouldRenderDetail && localPatchAttempted && !locallyPatchedDetail && !tilePanePatchedDetail);
			return {
				patchResult,
				locallyPatchedDetail,
				tilePanePatchedDetail,
				detailPatchMs,
				patchTimingSource,
				patchRejectReason: reportLocalPatchRejected ? compactReason(input.patchRejectReason, "unknown") : "",
				reportLocalPatchRejected,
				localPatchAttempted,
				tilePanePatchAttempted,
				patchResult,
				patchTimingSource,
				finalizeResult: {
					locallyPatchedDetail,
					tilePanePatchedDetail
				}
			};
		}
		function visibleItemCountFromShape(shape, fallback = 0) {
			const value = objectOrEmpty(shape);
			return normalizedCount(value.visibleItemCount ?? value.visible_count ?? fallback);
		}
		function planThreadDetailRefreshPatchRejectedDiagnostic(input = {}) {
			const patchAttemptResult = objectOrEmpty(input.patchAttemptResult);
			if (!patchAttemptResult.reportLocalPatchRejected) return {
				shouldReport: false,
				diagnosticInput: null,
				reason: "not-rejected"
			};
			const renderPlan = objectOrEmpty(input.renderPlan);
			return {
				shouldReport: true,
				diagnosticInput: {
					readMode: compactReason(input.readMode || input.read_mode, ""),
					renderMode: compactReason(renderPlan.detailRenderMode || input.renderMode, ""),
					renderPlanReason: compactReason(renderPlan.reason || input.renderPlanReason, ""),
					patchRejectReason: compactReason(patchAttemptResult.patchRejectReason || input.patchRejectReason, "unknown"),
					previousVisibleItemCount: visibleItemCountFromShape(input.previousVisibleShape, input.previousVisibleItemCount),
					visibleItemCount: visibleItemCountFromShape(input.nextVisibleShape, input.visibleItemCount)
				},
				reason: "local-patch-rejected"
			};
		}
		function planThreadDetailRefreshPatchRejectedDiagnosticEffects(input = {}) {
			const diagnosticPlan = objectOrEmpty(input.diagnosticPlan || input.plan);
			if (!diagnosticPlan.shouldReport) return {
				effects: [],
				reason: compactReason(diagnosticPlan.reason, "not-rejected")
			};
			return {
				effects: [{
					type: "detail-patch-rejected-diagnostic-failure",
					diagnosticInput: objectOrEmpty(diagnosticPlan.diagnosticInput)
				}],
				reason: "local-patch-rejected-diagnostic"
			};
		}
		function hasOwnPropertyValue(object, key) {
			return Object.prototype.hasOwnProperty.call(objectOrEmpty(object), key);
		}
		function planThreadDetailRefreshPatchRejectedVisibleShapeEvidenceEffects(input = {}) {
			const stage = objectOrEmpty(input.patchAttemptResultStage || input.stage);
			if (!stage.needsPatchRejectedVisibleShapes) return {
				effects: [],
				reason: compactReason(stage.reason, "visible-shapes-not-required")
			};
			return {
				effects: [{ type: "collect-patch-rejected-visible-shapes" }],
				reason: "visible-shapes-required"
			};
		}
		function planThreadDetailRefreshPatchAttemptResultStage(input = {}) {
			const patchAttempt = objectOrEmpty(input.patchAttempt);
			const patchAttemptResult = planThreadDetailRefreshPatchAttemptResult({
				shouldRenderDetail: input.shouldRenderDetail,
				tilePanePatchAttempted: patchAttempt.tilePanePatchAttempted,
				tilePanePatchedDetail: patchAttempt.tilePanePatchedDetail,
				localPatchAttempted: patchAttempt.localPatchAttempted,
				locallyPatchedDetail: patchAttempt.locallyPatchedDetail,
				tilePanePatchMs: patchAttempt.tilePanePatchMs,
				localPatchMs: patchAttempt.localPatchMs,
				patchRejectReason: patchAttempt.patchRejectReason
			});
			if (Boolean(patchAttemptResult.reportLocalPatchRejected && (!hasOwnPropertyValue(input, "previousVisibleShape") || !hasOwnPropertyValue(input, "nextVisibleShape")))) return {
				patchAttemptResult,
				needsPatchRejectedVisibleShapes: true,
				patchRejectedDiagnosticPlan: null,
				patchRejectedDiagnosticEffectsPlan: {
					effects: [],
					reason: "visible-shapes-required"
				},
				reason: "visible-shapes-required"
			};
			const patchRejectedDiagnosticPlan = planThreadDetailRefreshPatchRejectedDiagnostic({
				readMode: input.readMode,
				renderPlan: input.renderPlan,
				patchAttemptResult,
				previousVisibleShape: input.previousVisibleShape,
				nextVisibleShape: input.nextVisibleShape
			});
			return {
				patchAttemptResult,
				needsPatchRejectedVisibleShapes: false,
				patchRejectedDiagnosticPlan,
				patchRejectedDiagnosticEffectsPlan: planThreadDetailRefreshPatchRejectedDiagnosticEffects({ diagnosticPlan: patchRejectedDiagnosticPlan }),
				reason: patchRejectedDiagnosticPlan.reason
			};
		}
		function planThreadDetailRefreshPatchAttemptResultEvidenceStage(input = {}) {
			const patchAttemptResultStage = planThreadDetailRefreshPatchAttemptResultStage(input);
			return {
				patchAttemptResultStage,
				visibleShapeEvidenceEffectsPlan: planThreadDetailRefreshPatchRejectedVisibleShapeEvidenceEffects({ patchAttemptResultStage }),
				needsPatchRejectedVisibleShapes: patchAttemptResultStage.needsPatchRejectedVisibleShapes,
				reason: patchAttemptResultStage.reason
			};
		}
		function planThreadDetailRefreshPatchAttemptResultEvidenceCompletionStage(input = {}) {
			const visibleShapeEvidence = objectOrEmpty(input.visibleShapeEvidence);
			return planThreadDetailRefreshPatchAttemptResultStage({
				shouldRenderDetail: input.shouldRenderDetail,
				patchAttempt: input.patchAttempt,
				renderPlan: input.renderPlan,
				readMode: input.readMode,
				previousVisibleShape: visibleShapeEvidence.previousVisibleShape,
				nextVisibleShape: visibleShapeEvidence.nextVisibleShape
			});
		}
		function planThreadDetailRefreshPatchAttemptResultEvidenceResolutionStage(input = {}) {
			const patchAttemptResultStage = objectOrEmpty(input.patchAttemptResultStage);
			const visibleShapeEvidence = objectOrEmpty(input.visibleShapeEvidence);
			if (!visibleShapeEvidence.collected) return {
				patchAttemptResultStage,
				resolvedFromEvidence: false,
				reason: compactReason(patchAttemptResultStage.reason, "visible-shapes-not-collected")
			};
			const completedStage = planThreadDetailRefreshPatchAttemptResultEvidenceCompletionStage({
				shouldRenderDetail: input.shouldRenderDetail,
				patchAttempt: input.patchAttempt,
				renderPlan: input.renderPlan,
				readMode: input.readMode,
				visibleShapeEvidence
			});
			return {
				patchAttemptResultStage: completedStage,
				resolvedFromEvidence: true,
				reason: completedStage.reason
			};
		}
		function finalizeThreadDetailRenderPlan(plan = {}, result = {}) {
			const tilePanePatchedDetail = Boolean(result.tilePanePatchedDetail);
			const locallyPatchedDetail = Boolean(result.locallyPatchedDetail);
			if (!plan.shouldRenderDetail) {
				if (tilePanePatchedDetail) return {
					detailRenderMode: "tile-pane-metadata",
					locallyPatchedDetail: false,
					tilePanePatchedDetail: true,
					renderAction: "tile-pane-patch",
					projectionConsistencyPhase: "refresh-metadata"
				};
				return {
					detailRenderMode: "metadata-only",
					locallyPatchedDetail: false,
					tilePanePatchedDetail: false,
					renderAction: "metadata-update",
					projectionConsistencyPhase: "refresh-metadata"
				};
			}
			if (tilePanePatchedDetail) return {
				detailRenderMode: "tile-pane",
				locallyPatchedDetail: false,
				tilePanePatchedDetail: true,
				renderAction: "tile-pane-patch",
				projectionConsistencyPhase: "refresh-local-patch"
			};
			if (locallyPatchedDetail) return {
				detailRenderMode: "patch",
				locallyPatchedDetail: true,
				tilePanePatchedDetail: false,
				renderAction: "local-patch-metadata-update",
				projectionConsistencyPhase: "refresh-local-patch"
			};
			return {
				detailRenderMode: "full-render",
				locallyPatchedDetail: false,
				tilePanePatchedDetail: false,
				renderAction: "full-render",
				projectionConsistencyPhase: ""
			};
		}
		function planThreadDetailRefreshOutcomeExecution(outcome = {}) {
			const renderAction = String(outcome.renderAction || "");
			const projectionConsistencyPhase = String(outcome.projectionConsistencyPhase || "");
			const consistencyCheck = planThreadDetailRefreshConsistencyCheck({
				projectionConsistencyPhase,
				detailRenderMode: outcome.detailRenderMode
			});
			if (renderAction === "local-patch-metadata-update") return {
				renderAction,
				metadataUpdateMode: "local-patch",
				metadataEffects: [
					"update-current-thread-header",
					"update-tick-timer",
					"publish-plugin-navigation-state"
				],
				executionAction: "metadata-effects",
				timingTarget: "metadata-update",
				runFullRender: false,
				projectionConsistencyPhase,
				consistencyCheck,
				reason: "local-patch-complete"
			};
			if (renderAction === "metadata-update") return {
				renderAction,
				metadataUpdateMode: "metadata-only",
				metadataEffects: [
					"update-current-thread-header",
					"update-live-operation-dock",
					"update-tick-timer",
					"schedule-scroll-button-update"
				],
				executionAction: "metadata-effects",
				timingTarget: "metadata-update",
				runFullRender: false,
				projectionConsistencyPhase,
				consistencyCheck,
				reason: "metadata-only"
			};
			if (renderAction === "full-render") return {
				renderAction,
				metadataUpdateMode: "",
				metadataEffects: [],
				executionAction: "full-render",
				timingTarget: "conversation-render",
				runFullRender: true,
				projectionConsistencyPhase: "refresh-full-render",
				consistencyCheck: planThreadDetailRefreshConsistencyCheck({
					projectionConsistencyPhase: "refresh-full-render",
					detailRenderMode: outcome.detailRenderMode
				}),
				reason: "full-render"
			};
			return {
				renderAction,
				metadataUpdateMode: "",
				metadataEffects: [],
				executionAction: "none",
				timingTarget: "",
				runFullRender: false,
				projectionConsistencyPhase,
				consistencyCheck,
				reason: renderAction || "none"
			};
		}
		function planThreadDetailRefreshOutcomeExecutionStage(input = {}) {
			const renderOutcome = finalizeThreadDetailRenderPlan(objectOrEmpty(input.renderPlan), objectOrEmpty(input.patchAttemptResult).finalizeResult);
			const executionPlan = planThreadDetailRefreshOutcomeExecution(renderOutcome);
			return {
				renderOutcome,
				executionPlan,
				executionEffectsPlan: planThreadDetailRefreshExecutionEffects(executionPlan),
				consistencyCheckEffectsPlan: planThreadDetailRefreshConsistencyCheckEffects(executionPlan.consistencyCheck || {}),
				reason: executionPlan.reason
			};
		}
		function planThreadDetailRefreshPerformanceInput(input = {}) {
			const renderPlan = objectOrEmpty(input.renderPlan);
			const renderOutcome = objectOrEmpty(input.renderOutcome);
			const patchAttemptResult = objectOrEmpty(input.patchAttemptResult);
			const patchSurfacePlan = objectOrEmpty(input.patchSurfacePlan);
			const patchExecutionPlan = objectOrEmpty(input.patchExecutionPlan);
			const timings = objectOrEmpty(input.timings);
			return {
				source: compactReason(input.source, ""),
				threadId: compactReason(input.threadId, ""),
				requestedMode: compactReason(input.requestedMode, ""),
				elapsedMs: normalizedDurationMs(timings.elapsedMs),
				apiElapsedMs: normalizedDurationMs(timings.apiElapsedMs),
				renderElapsedMs: normalizedDurationMs(timings.renderElapsedMs),
				mergeMs: normalizedDurationMs(timings.mergeMs),
				composerRenderMs: normalizedDurationMs(timings.composerRenderMs),
				threadListRenderMs: normalizedDurationMs(timings.threadListRenderMs),
				conversationRenderMs: normalizedDurationMs(timings.conversationRenderMs),
				detailPatchMs: normalizedDurationMs(patchAttemptResult.detailPatchMs),
				metadataUpdateMs: normalizedDurationMs(timings.metadataUpdateMs),
				detailRenderMode: compactReason(renderOutcome.detailRenderMode || renderPlan.detailRenderMode, ""),
				refreshRenderAction: compactReason(renderOutcome.renderAction, ""),
				renderPlanReason: compactReason(renderPlan.reason, ""),
				patchRejectReason: compactReason(patchAttemptResult.patchRejectReason, ""),
				patchResult: compactReason(patchAttemptResult.patchResult, ""),
				patchTimingSource: compactReason(patchAttemptResult.patchTimingSource, ""),
				patchSurfaceReason: compactReason(patchSurfacePlan.reason, ""),
				patchSurface: compactReason(patchSurfacePlan.tilePatchSurface || patchSurfacePlan.surface, ""),
				patchExecutionReason: compactReason(patchExecutionPlan.reason, ""),
				skippedDetailRender: input.shouldRenderDetail === false,
				locallyPatchedDetail: Boolean(renderOutcome.locallyPatchedDetail),
				tilePanePatchedDetail: Boolean(renderOutcome.tilePanePatchedDetail),
				localPatchAttempted: Boolean(patchAttemptResult.localPatchAttempted),
				tilePanePatchAttempted: Boolean(patchAttemptResult.tilePanePatchAttempted)
			};
		}
		function planThreadDetailRefreshReportingStage(input = {}) {
			const eventName = compactReason(input.eventName, "thread_refresh_ms");
			const threadId = compactReason(input.threadId, "");
			return {
				performanceInput: planThreadDetailRefreshPerformanceInput(input),
				telemetryConfig: {
					eventName,
					throttleKey: compactReason(input.throttleKey, eventName),
					minIntervalMs: normalizedDurationMs(input.minIntervalMs),
					action: compactReason(input.action, "thread-detail-refresh"),
					threadId
				},
				completionConfig: { threadHash: compactReason(input.threadHash, "") },
				reason: "refresh-reporting"
			};
		}
		function addOptionalTimingField(out, key, value) {
			const timing = normalizedOptionalDurationMs(value);
			if (timing !== null) out[key] = timing;
		}
		function planThreadDetailFirstPaintPerformanceInput(input = {}) {
			const timings = objectOrEmpty(input.timings);
			const cached = input.cached === true;
			const out = {
				source: compactReason(input.source, "").slice(0, 40),
				threadId: compactReason(input.threadId, ""),
				elapsedMs: normalizedDurationMs(timings.elapsedMs),
				apiElapsedMs: normalizedDurationMs(timings.apiElapsedMs),
				renderElapsedMs: normalizedDurationMs(timings.renderElapsedMs),
				detailRenderMode: compactReason(input.detailRenderMode, cached ? "cached-current" : "first-paint"),
				cached
			};
			addOptionalTimingField(out, "mergeMs", timings.mergeMs);
			addOptionalTimingField(out, "draftRestoreMs", timings.draftRestoreMs);
			addOptionalTimingField(out, "composerRenderMs", timings.composerRenderMs);
			addOptionalTimingField(out, "threadListRenderMs", timings.threadListRenderMs);
			addOptionalTimingField(out, "conversationRenderMs", timings.conversationRenderMs);
			addOptionalTimingField(out, "postRenderMs", timings.postRenderMs);
			return out;
		}
		function planThreadDetailFirstPaintReportingStage(input = {}) {
			const cached = input.cached === true;
			const performanceInput = planThreadDetailFirstPaintPerformanceInput({
				source: input.source,
				threadId: input.threadId,
				detailRenderMode: input.detailRenderMode || (cached ? "cached-current" : "first-paint"),
				cached,
				timings: objectOrEmpty(input.timings)
			});
			return {
				performanceInput,
				telemetryInput: {
					source: performanceInput.source,
					threadId: performanceInput.threadId,
					elapsedMs: performanceInput.elapsedMs,
					apiElapsedMs: performanceInput.apiElapsedMs,
					renderElapsedMs: performanceInput.renderElapsedMs,
					readMode: compactReason(input.readMode, ""),
					status: compactReason(input.status, ""),
					turns: normalizedCount(input.turns),
					omittedTurns: normalizedCount(input.omittedTurns),
					rolloutSizeBytes: normalizedCount(input.rolloutSizeBytes),
					threadHash: compactReason(input.threadHash, "")
				},
				reason: cached ? "cached-current-reporting" : "first-paint-reporting"
			};
		}
		function planThreadDetailFullBackfillPerformanceInput(input = {}) {
			const timings = objectOrEmpty(input.timings);
			return {
				source: compactReason(input.source, "").slice(0, 40),
				threadId: compactReason(input.threadId, ""),
				elapsedMs: normalizedDurationMs(timings.elapsedMs),
				apiElapsedMs: normalizedDurationMs(timings.apiElapsedMs),
				renderElapsedMs: normalizedDurationMs(timings.renderElapsedMs),
				mergeMs: normalizedDurationMs(timings.mergeMs),
				composerRenderMs: normalizedDurationMs(timings.composerRenderMs),
				threadListRenderMs: normalizedDurationMs(timings.threadListRenderMs),
				conversationRenderMs: normalizedDurationMs(timings.conversationRenderMs),
				postRenderMs: normalizedDurationMs(timings.postRenderMs),
				detailRenderMode: "full-backfill"
			};
		}
		function planThreadDetailFullBackfillReportingStage(input = {}) {
			const performanceInput = planThreadDetailFullBackfillPerformanceInput({
				source: input.source,
				threadId: input.threadId,
				timings: objectOrEmpty(input.timings)
			});
			return {
				performanceInput,
				telemetryInput: { threadId: performanceInput.threadId },
				reason: "full-backfill-reporting"
			};
		}
		function planThreadDetailRefreshTelemetryEffects(input = {}) {
			const performanceEvent = objectOrEmpty(input.performanceEvent);
			const eventName = compactReason(input.eventName, "thread_refresh_ms");
			const throttleKey = compactReason(input.throttleKey, eventName);
			const minIntervalMs = normalizedDurationMs(input.minIntervalMs);
			const action = compactReason(input.action, "thread-detail-refresh");
			const threadId = compactReason(input.threadId, "");
			return {
				effects: [{
					type: "post-performance-event",
					eventName,
					payload: performanceEvent,
					options: {
						key: throttleKey,
						minIntervalMs
					}
				}, {
					type: "record-thread-detail-response-diagnostics",
					performanceEvent,
					context: {
						action,
						threadId
					}
				}],
				reason: "refresh-telemetry"
			};
		}
		function planThreadDetailRefreshReportingEffectsStage(input = {}) {
			const telemetryConfig = objectOrEmpty(input.telemetryConfig);
			const completionConfig = objectOrEmpty(input.completionConfig);
			return {
				telemetryEffectsPlan: planThreadDetailRefreshTelemetryEffects({
					performanceEvent: input.performanceEvent,
					eventName: telemetryConfig.eventName,
					throttleKey: telemetryConfig.throttleKey,
					minIntervalMs: telemetryConfig.minIntervalMs,
					action: telemetryConfig.action,
					threadId: telemetryConfig.threadId
				}),
				completionEffectsPlan: planThreadDetailRefreshCompletionEffects(completionConfig),
				reason: "refresh-reporting-effects"
			};
		}
		function planThreadDetailRefreshFailureDiagnosticEffects(input = {}) {
			return {
				effects: [{
					type: "thread-detail-refresh-failed-diagnostic-failure",
					diagnosticInput: {
						errorCode: compactReason(input.errorCode || input.error_code, "thread_detail_refresh_failed"),
						durationBucket: compactReason(input.durationBucket || input.duration_bucket, ""),
						statusCode: compactReason(input.statusCode || input.status_code, ""),
						threadHash: compactReason(input.threadHash || input.thread_hash, "")
					}
				}],
				reason: "refresh-failed-diagnostic"
			};
		}
		function planThreadDetailRefreshExecutionEffects(input = {}) {
			const executionAction = compactReason(input.executionAction, "");
			const metadataEffects = Array.isArray(input.metadataEffects) ? input.metadataEffects.slice() : [];
			if (executionAction === "metadata-effects") return {
				effects: [{
					type: "metadata-effects",
					timingTarget: "metadata-update",
					metadataEffects,
					requireEffects: true
				}],
				reason: "metadata-effects"
			};
			if (executionAction === "full-render") return {
				effects: [{
					type: "full-render",
					timingTarget: "conversation-render",
					metadataEffects: [],
					requireEffects: false
				}],
				reason: "full-render"
			};
			if (!executionAction || executionAction === "none") return {
				effects: [],
				reason: executionAction || "none"
			};
			return {
				effects: [{
					type: executionAction,
					timingTarget: "",
					metadataEffects: [],
					requireEffects: false
				}],
				reason: "unknown-execution-action"
			};
		}
		function planThreadDetailRefreshCompletionEffects(input = {}) {
			return {
				effects: [
					{
						type: "diagnostic-success",
						payload: {
							category: "thread_session_load_failed",
							diagnostic_type: "thread_detail_refresh_failed",
							error_code: "thread_detail_refresh_failed",
							context: {
								surface: "thread-session",
								action: "thread-detail-refresh",
								thread_hash: compactReason(input.threadHash, "")
							}
						}
					},
					{ type: "schedule-usage-backfill-refresh" },
					{ type: "schedule-live-poll" }
				],
				reason: "refresh-complete"
			};
		}
		function planThreadDetailFirstPaintPostRenderEffects(input = {}) {
			const seq = Number(input.seq);
			return {
				effects: [
					{
						type: "publish-plugin-navigation-state",
						force: true
					},
					{ type: "restore-connection-state" },
					{
						type: "schedule-live-poll",
						delayMs: 1200
					},
					{ type: "update-composer-controls" },
					{ type: "close-sidebar-menu-if-overlay" },
					{
						type: "backfill-full-thread-detail-if-needed",
						threadId: compactReason(input.threadId, ""),
						seq: Number.isFinite(seq) ? seq : 0,
						source: compactReason(input.source, "").slice(0, 40)
					},
					{ type: "schedule-usage-backfill-refresh" }
				],
				reason: "first-paint-post-render"
			};
		}
		function planThreadDetailFirstPaintAfterRenderEffects(input = {}) {
			const seq = Number(input.seq);
			return {
				effects: [{
					type: "history-auto-backfill",
					seq: Number.isFinite(seq) ? seq : 0,
					source: compactReason(input.source, "first-paint").slice(0, 40)
				}],
				reason: "first-paint-after-render"
			};
		}
		function planThreadDetailFirstPaintPostTimingEffects() {
			return {
				effects: [{
					type: "check-conversation-projection-consistency",
					phase: "first-paint",
					renderMode: "first-paint"
				}],
				reason: "first-paint-post-timing"
			};
		}
		function planThreadDetailFirstPaintPreRenderEffects(input = {}) {
			const threadId = compactReason(input.threadId, "");
			const effects = [
				{
					type: "persist-current-thread-id",
					threadId
				},
				{ type: "clear-draft-target-key" },
				{
					type: "follow-thread-open-to-bottom",
					threadId
				}
			];
			if (input.hasEvents) effects.push({ type: "connect-events" });
			return {
				effects,
				reason: "first-paint-pre-render"
			};
		}
		function planThreadDetailFirstPaintDraftRestoreEffects() {
			return {
				effects: [{ type: "restore-draft-for-current-target" }],
				reason: "first-paint-draft-restore"
			};
		}
		function planThreadDetailLoadErrorEffects(input = {}) {
			return {
				effects: [
					{
						type: "set-current-thread-load-error",
						threadId: compactReason(input.threadId, ""),
						errorMessage: String(input.errorMessage || input.error || "")
					},
					{ type: "sync-active-turn-from-thread" },
					{ type: "render-thread-list" },
					{ type: "render-current-thread" },
					{ type: "update-composer-controls" }
				],
				reason: "thread-detail-load-error"
			};
		}
		function planThreadDetailLoadingShellPostStateEffects(input = {}) {
			const threadId = compactReason(input.threadId, "");
			const source = compactReason(input.source, "").slice(0, 40);
			return {
				effects: [
					{
						type: "follow-thread-open-to-bottom",
						threadId
					},
					{ type: "restore-draft-for-current-target" },
					{ type: "render-composer-settings" },
					{ type: "sync-active-turn-from-thread" },
					{ type: "render-thread-list" },
					{
						type: "render-current-thread",
						options: { stickToBottom: true }
					},
					{
						type: "publish-plugin-navigation-state",
						force: true
					},
					{ type: "update-composer-controls" },
					{
						type: "load-side-chat",
						threadId,
						silent: true
					},
					{
						type: "set-connection-state",
						removeClass: "error",
						text: "Loading thread"
					},
					{
						type: "mark-activity",
						label: "加载线程"
					},
					{
						type: "start-thread-load-watchdog",
						threadId,
						source
					}
				],
				reason: "loading-shell-post-state"
			};
		}
		function planThreadDetailCachedCurrentPostRenderEffects(input = {}) {
			const seq = Number(input.seq);
			const threadId = compactReason(input.threadId, "");
			const source = compactReason(input.source, "cached-current").slice(0, 40);
			const effects = [{
				type: "history-auto-backfill",
				seq: Number.isFinite(seq) ? seq : 0,
				source
			}];
			if (input.replacedTilePane) effects.push({ type: "restore-composer-for-replaced-tile-pane" });
			effects.push({ type: "close-sidebar-menu-if-overlay" }, {
				type: "check-conversation-projection-consistency",
				phase: "cached-current",
				renderMode: "cached-current"
			}, {
				type: "record-empty-cached-detail-reuse-healthy",
				reason: "cached-current"
			});
			if (!input.hasSideChat) effects.push({
				type: "load-side-chat",
				threadId,
				silent: true
			});
			return {
				effects,
				reason: "cached-current-post-render"
			};
		}
		function planThreadDetailFullBackfillPostRenderEffects() {
			return {
				effects: [
					{ type: "schedule-usage-backfill-refresh" },
					{ type: "schedule-live-poll" },
					{ type: "update-composer-controls" }
				],
				reason: "full-backfill-post-render"
			};
		}
		function planThreadDetailFirstPaintTelemetryEffects(input = {}) {
			const source = compactReason(input.source, "").slice(0, 40);
			const threadId = compactReason(input.threadId, "");
			const threadHash = compactReason(input.threadHash, "");
			const performanceEvent = objectOrEmpty(input.performanceEvent);
			return {
				effects: [
					{
						type: "post-performance-event",
						eventName: "thread_detail_first_paint",
						payload: performanceEvent
					},
					{
						type: "record-thread-detail-response-diagnostics",
						performanceEvent,
						context: {
							action: "thread-detail-load",
							threadId
						}
					},
					{
						type: "post-client-event",
						eventName: "thread_switch_complete",
						payload: {
							source,
							threadId,
							elapsedMs: normalizedDurationMs(input.elapsedMs),
							apiElapsedMs: normalizedDurationMs(input.apiElapsedMs),
							renderElapsedMs: normalizedDurationMs(input.renderElapsedMs),
							readMode: compactReason(input.readMode, ""),
							status: compactReason(input.status, ""),
							turns: normalizedCount(input.turns),
							omittedTurns: normalizedCount(input.omittedTurns),
							rolloutSizeBytes: normalizedCount(input.rolloutSizeBytes)
						}
					},
					{
						type: "diagnostic-success",
						payload: {
							category: "thread_session_load_failed",
							diagnostic_type: "thread_detail_load_failed",
							error_code: "thread_detail_load_failed",
							context: {
								surface: "thread-session",
								action: "thread-detail-load",
								thread_hash: threadHash
							}
						}
					}
				],
				reason: "first-paint-telemetry"
			};
		}
		function planThreadDetailFullBackfillTelemetryEffects(input = {}) {
			const threadId = compactReason(input.threadId, "");
			const performanceEvent = objectOrEmpty(input.performanceEvent);
			return {
				effects: [{
					type: "post-performance-event",
					eventName: "thread_detail_full_ready",
					payload: performanceEvent,
					options: { force: true }
				}, {
					type: "record-thread-detail-response-diagnostics",
					performanceEvent,
					context: {
						action: "thread-detail-full-backfill",
						threadId
					}
				}],
				reason: "full-backfill-telemetry"
			};
		}
		function planThreadDetailCachedCurrentTelemetryEffects(input = {}) {
			const source = compactReason(input.source, "").slice(0, 40);
			const threadId = compactReason(input.threadId, "");
			const threadHash = compactReason(input.threadHash, "");
			return {
				effects: [
					{
						type: "post-performance-event",
						eventName: "thread_detail_first_paint",
						payload: objectOrEmpty(input.performanceEvent)
					},
					{
						type: "post-client-event",
						eventName: "thread_switch_cached",
						payload: {
							source,
							threadId,
							elapsedMs: normalizedDurationMs(input.elapsedMs)
						}
					},
					{
						type: "diagnostic-success",
						payload: {
							category: "thread_session_load_failed",
							diagnostic_type: "thread_detail_load_failed",
							error_code: "thread_detail_load_failed",
							context: {
								surface: "thread-session",
								action: "thread-detail-load",
								thread_hash: threadHash
							}
						}
					}
				],
				reason: "cached-current-telemetry"
			};
		}
		function planThreadDetailSwitchCancelledClientEvent(input = {}) {
			return {
				effects: [{
					type: "post-client-event",
					eventName: "thread_switch_cancelled",
					payload: {
						source: compactReason(input.source, "").slice(0, 40),
						threadId: compactReason(input.threadId, ""),
						elapsedMs: normalizedDurationMs(input.elapsedMs),
						apiElapsedMs: normalizedDurationMs(input.apiElapsedMs)
					}
				}],
				reason: "thread-switch-cancelled"
			};
		}
		function planThreadDetailSwitchStartClientEvent(input = {}) {
			return {
				effects: [{
					type: "post-client-event",
					eventName: "thread_switch_start",
					payload: {
						source: compactReason(input.source, "").slice(0, 40),
						fromThreadId: compactReason(input.fromThreadId, ""),
						toThreadId: compactReason(input.toThreadId, ""),
						listAgeMs: normalizedOptionalDurationMs(input.listAgeMs),
						currentHadThread: Boolean(input.currentHadThread),
						eventOpen: Boolean(input.eventOpen)
					}
				}],
				reason: "thread-switch-start"
			};
		}
		function planThreadDetailSwitchErrorClientEvent(input = {}) {
			return {
				effects: [{
					type: "post-client-event",
					eventName: "thread_switch_error",
					payload: {
						source: compactReason(input.source, "").slice(0, 40),
						threadId: compactReason(input.threadId, ""),
						elapsedMs: normalizedDurationMs(input.elapsedMs),
						apiElapsedMs: normalizedDurationMs(input.apiElapsedMs),
						error: compactReason(input.error, "", 200)
					}
				}],
				reason: "thread-switch-error"
			};
		}
		function text(value) {
			return String(value ?? "");
		}
		function htmlEscaper(input = {}) {
			return typeof input.escapeHtml === "function" ? input.escapeHtml : (value) => text(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
		}
		function hasHtml(value) {
			return text(value).trim().length > 0;
		}
		function planSingleThreadFullRenderShell(input = {}) {
			const escape = htmlEscaper(input);
			const threadId = text(input.threadId || input.currentThreadId).trim();
			if (input.loadingWithoutVisibleTurns) return {
				mode: "loading",
				html: `<div class="history-note entry-animate thread-loading-note" data-render-key="${`loading-visible|${escape(threadId)}`}">正在加载最新线程状态...</div>`,
				clearLiveOperationDock: true,
				bindRetry: false,
				retryThreadId: "",
				hasPrimaryContent: false,
				emptyMessage: ""
			};
			if (input.loadError) return {
				mode: "load-error",
				html: `<div class="empty-state entry-animate">
        <div>Thread failed: ${escape(input.loadError)}</div>
        <button id="retryCurrentThread" class="retry-button" type="button">Retry</button>
      </div>`,
				clearLiveOperationDock: true,
				bindRetry: true,
				retryThreadId: threadId,
				hasPrimaryContent: false,
				emptyMessage: ""
			};
			const hasPrimaryContent = hasHtml(input.turnsHtml) || hasHtml(input.approvalsHtml) || hasHtml(input.taskCardsHtml);
			const emptyMessage = input.readWarningMessage ? "暂时没有可显示的完整消息。共享模式恢复后刷新这个页面即可继续读取。" : "No visible turns.";
			const body = hasPrimaryContent ? `${text(input.turnsHtml)}${text(input.approvalsHtml)}${text(input.taskCardsHtml)}${text(input.pluginRefreshNotice)}` : `${text(input.pluginRefreshNotice)}<div class="empty-state entry-animate">${escape(emptyMessage)}</div>`;
			return {
				mode: "detail",
				html: `${text(input.goalCard)}${text(input.rolloutWarning)}${text(input.loadingNote)}${text(input.taskToolbar)}${text(input.omittedBanner)}${text(input.readWarning)}${body}`,
				clearLiveOperationDock: false,
				bindRetry: false,
				retryThreadId: "",
				hasPrimaryContent,
				emptyMessage
			};
		}
		function planSingleThreadEarlyShellExecution(input = {}) {
			const loadingWithoutVisibleTurns = Boolean(input.loadingWithoutVisibleTurns);
			const loadError = text(input.loadError);
			if (!loadingWithoutVisibleTurns && !loadError) return {
				shouldRender: false,
				mode: "detail",
				reason: "detail-content",
				html: "",
				clearLiveOperationDock: false,
				bindRetry: false,
				retryThreadId: "",
				conversationSignature: text(input.conversationSignature),
				patchShellSignature: text(input.patchShellSignature),
				stickToBottom: Boolean(input.stickToBottom)
			};
			const shellPlan = planSingleThreadFullRenderShell({
				threadId: input.threadId || input.currentThreadId,
				currentThreadId: input.currentThreadId,
				loadingWithoutVisibleTurns,
				loadError,
				escapeHtml: input.escapeHtml
			});
			return {
				shouldRender: true,
				mode: shellPlan.mode,
				reason: shellPlan.mode,
				html: shellPlan.html,
				clearLiveOperationDock: Boolean(shellPlan.clearLiveOperationDock),
				bindRetry: Boolean(shellPlan.bindRetry),
				retryThreadId: shellPlan.retryThreadId || "",
				conversationSignature: text(input.conversationSignature),
				patchShellSignature: text(input.patchShellSignature),
				stickToBottom: Boolean(input.stickToBottom)
			};
		}
		function planSingleThreadShellConversationUpdate(input = {}) {
			const shellPlan = objectOrEmpty(input.shellPlan);
			const source = compactReason(input.source, "single-thread-render");
			return {
				html: text(shellPlan.html),
				conversationSignature: text(input.conversationSignature),
				options: {
					stickToBottom: Boolean(input.stickToBottom),
					patchShellSignature: text(input.patchShellSignature),
					expectedVisibleTurnCount: normalizedCount(input.expectedVisibleTurnCount),
					expectedVisibleItemCount: normalizedCount(input.expectedVisibleItemCount),
					renderedDomTurnCount: normalizedCount(input.renderedDomTurnCount),
					renderedDomItemCount: normalizedCount(input.renderedDomItemCount),
					duplicateRenderKeyCount: normalizedCount(input.duplicateRenderKeyCount),
					expectedTurnIds: normalizedStringList(input.expectedTurnIds),
					renderedDomTurnIds: normalizedStringList(input.renderedDomTurnIds),
					checkProjectionConsistency: input.checkProjectionConsistency === true,
					source
				},
				reason: source
			};
		}
		function planSingleThreadShellPostUpdateEffects(input = {}) {
			const shellPlan = objectOrEmpty(input.shellPlan);
			const effects = [];
			if (input.bindRetry || shellPlan.bindRetry) effects.push({
				type: "bind-retry-current-thread",
				threadId: text(input.retryThreadId || shellPlan.retryThreadId).trim()
			});
			if (input.checkEmptyVisibleDetailMismatch) effects.push({
				type: "check-empty-visible-detail-mismatch",
				source: compactReason(input.source, "single-thread-render"),
				renderMode: compactReason(input.renderMode, "full-render"),
				domCount: normalizedCount(input.domCount),
				previousCount: normalizedCount(input.previousCount)
			});
			if (input.bindCurrentThreadActions) effects.push({ type: "bind-current-thread-actions" });
			const turnId = text(input.scrollToTurnReceiptStart).trim();
			if (turnId) effects.push({
				type: "scroll-turn-receipt-start",
				turnId
			});
			if (input.applyPendingPluginRouteHintFocus) effects.push({ type: "apply-pending-plugin-route-hint-focus" });
			if (input.updateTickTimer) effects.push({ type: "update-tick-timer" });
			if (input.publishPluginNavigationState) effects.push({ type: "publish-plugin-navigation-state" });
			return {
				effects,
				reason: compactReason(input.reason, effects.length ? "single-thread-shell-post-update" : "no-post-update-effects")
			};
		}
		return {
			emptyThreadDetailRefreshPatchAttempt,
			finalizeThreadDetailRenderPlan,
			normalizeSignature,
			planThreadDetailCachedCurrentTelemetryEffects,
			planThreadDetailCachedCurrentPostRenderEffects,
			planThreadDetailFirstPaintAfterRenderEffects,
			planThreadDetailFirstPaintDraftRestoreEffects,
			planThreadDetailFirstPaintPerformanceInput,
			planThreadDetailFirstPaintReportingStage,
			planThreadDetailFirstPaintPostTimingEffects,
			planThreadDetailFirstPaintPreRenderEffects,
			planThreadDetailFirstPaintResponseEffects,
			planThreadDetailFullBackfillResponseEffects,
			planThreadDetailFullBackfillPerformanceInput,
			planThreadDetailFullBackfillReportingStage,
			planThreadDetailLoadErrorEffects,
			planThreadDetailLoadingShellPostStateEffects,
			planThreadDetailFullBackfillPostRenderEffects,
			planThreadDetailFullBackfillTelemetryEffects,
			planThreadDetailFirstPaintPostRenderEffects,
			planThreadDetailFirstPaintTelemetryEffects,
			planThreadDetailSwitchCancelledClientEvent,
			planThreadDetailSwitchStartClientEvent,
			planThreadDetailSwitchErrorClientEvent,
			planThreadDetailRefreshCompletionEffects,
			planThreadDetailRefreshConsistencyCheck,
			planThreadDetailRefreshConsistencyCheckEffects,
			planThreadDetailRefreshResponseEffects,
			planThreadDetailRefreshPatchAttemptEffects,
			planThreadDetailRefreshPatchAttemptResult,
			planThreadDetailRefreshPatchAttemptResultStage,
			planThreadDetailRefreshPatchAttemptResultEvidenceStage,
			planThreadDetailRefreshPatchAttemptResultEvidenceCompletionStage,
			planThreadDetailRefreshPatchAttemptResultEvidenceResolutionStage,
			planThreadDetailRefreshPatchRejectedVisibleShapeEvidenceEffects,
			planThreadDetailRefreshPatchRejectedDiagnostic,
			planThreadDetailRefreshPatchRejectedDiagnosticEffects,
			planThreadDetailRefreshOutcomeExecution,
			planThreadDetailRefreshOutcomeExecutionStage,
			planThreadDetailRefreshExecutionEffects,
			planThreadDetailRefreshPerformanceInput,
			planThreadDetailRefreshReportingStage,
			planThreadDetailRefreshReportingEffectsStage,
			planThreadDetailRefreshTelemetryEffects,
			planThreadDetailRefreshFailureDiagnosticEffects,
			planThreadDetailRefreshRequest,
			planThreadDetailRefreshPatchSurface,
			planThreadDetailRefreshPatchSurfaceProbeEffects,
			planThreadDetailRefreshPatchSurfaceProbeStage,
			planThreadDetailRefreshPatchSurfaceExecutionStage,
			planThreadDetailRefreshPatchSurfaceResultStage,
			planThreadDetailRefreshPostMergeEffects,
			planThreadDetailRefreshPostMergeTimingFields,
			planThreadDetailFirstPaintPostMergeTimingEffects,
			planThreadDetailRefreshPatchExecutionStage,
			planSingleThreadEarlyShellExecution,
			planSingleThreadFullRenderShell,
			planSingleThreadShellConversationUpdate,
			planSingleThreadShellPostUpdateEffects,
			planThreadDetailHistoryAutoBackfill,
			planThreadDetailHistoryAutoBackfillEffects,
			planThreadDetailRefreshPatchExecution,
			planThreadDetailRefreshRenderInput,
			planThreadDetailRefreshRender,
			planThreadDetailRefreshRenderStage,
			reduceThreadDetailRefreshPatchAttempt,
			threadDetailRefreshPatchAttemptEffectContext
		};
	});
}));
//#endregion
//#region public/thread-detail-dom-patch.js
var require_thread_detail_dom_patch = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexThreadDetailDomPatch = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		const ELEMENT_NODE = 1;
		const TEXT_NODE = 3;
		const COMMENT_NODE = 8;
		function result(ok, reason, counts = {}) {
			return Object.assign({
				ok: Boolean(ok),
				reason: String(reason || (ok ? "applied" : "unknown")),
				reused: 0,
				patched: 0,
				inserted: 0
			}, counts);
		}
		function threadDetailPatchResult(ok, reason, counts = {}) {
			const fallback = ok ? "patched" : "unknown";
			return result(ok, String(reason || fallback).slice(0, 80) || fallback, counts);
		}
		function objectOrEmpty(value) {
			return value && typeof value === "object" && !Array.isArray(value) ? value : {};
		}
		function boundedCount(value) {
			const numberValue = Number(value);
			return Number.isFinite(numberValue) && numberValue > 0 ? Math.trunc(numberValue) : 0;
		}
		function hasOwn(input, key) {
			return Object.prototype.hasOwnProperty.call(input, key);
		}
		function normalizedStringList(value) {
			return Array.isArray(value) ? value.map((entry) => String(entry || "")).filter(Boolean) : [];
		}
		function visibleTurnOrderMismatch(input = {}) {
			const expected = normalizedStringList(input.expectedTurnIds);
			const rendered = normalizedStringList(input.renderedDomTurnIds || input.domTurnIds);
			if (!expected.length) return false;
			if (expected.length !== rendered.length) return true;
			for (let index = 0; index < expected.length; index += 1) if (expected[index] !== rendered[index]) return true;
			return false;
		}
		function boundedDuration(value) {
			const numberValue = Number(value);
			return Number.isFinite(numberValue) && numberValue >= 0 ? Math.round(numberValue) : 0;
		}
		function renderKeyForNode(node) {
			return node && node.nodeType === ELEMENT_NODE && typeof node.getAttribute === "function" ? node.getAttribute("data-render-key") || "" : "";
		}
		function visibleItemRenderKeyForNode(node) {
			if (!node || node.nodeType !== ELEMENT_NODE || typeof node.getAttribute !== "function") return "";
			if (node.getAttribute("data-item") == null) return "";
			return renderKeyForNode(node);
		}
		function visibleItemRenderKeysForArticle(article) {
			return Array.from(article && article.childNodes || []).map(visibleItemRenderKeyForNode).filter(Boolean);
		}
		function visibleItemOrderMatches(article, expectedKeys) {
			const expected = normalizedStringList(expectedKeys);
			const rendered = visibleItemRenderKeysForArticle(article);
			if (!expected.length || !rendered.length) return true;
			if (expected.length !== rendered.length) return false;
			for (let index = 0; index < expected.length; index += 1) if (expected[index] !== rendered[index]) return false;
			return true;
		}
		function placeVisibleItemNode(article, node, lastPatchedNode) {
			if (!article || typeof article.insertBefore !== "function" || !node) return node;
			const anchor = lastPatchedNode ? lastPatchedNode.nextSibling : article.firstChild || null;
			if (node === anchor) return node;
			article.insertBefore(node, anchor || null);
			return node;
		}
		function canPatchNode(target, source) {
			if (!target || !source || target.nodeType !== source.nodeType) return false;
			if (target.nodeType !== ELEMENT_NODE) return true;
			return target.tagName === source.tagName;
		}
		function syncAttributes(target, source) {
			const sourceNames = new Set(Array.from(source.attributes || []).map((attr) => attr.name));
			for (const attr of Array.from(target.attributes || [])) if (!sourceNames.has(attr.name)) target.removeAttribute(attr.name);
			for (const attr of Array.from(source.attributes || [])) if (target.getAttribute(attr.name) !== attr.value) target.setAttribute(attr.name, attr.value);
		}
		function patchNode(target, source) {
			if (!canPatchNode(target, source)) {
				const replacement = source.cloneNode(true);
				target.replaceWith(replacement);
				return replacement;
			}
			if (target.nodeType === TEXT_NODE || target.nodeType === COMMENT_NODE) {
				if (target.nodeValue !== source.nodeValue) target.nodeValue = source.nodeValue;
				return target;
			}
			syncAttributes(target, source);
			patchChildNodes(target, source);
			return target;
		}
		function patchChildNodes(target, source) {
			const sourceChildren = Array.from(source.childNodes || []);
			const targetChildren = Array.from(target.childNodes || []);
			const keyedTargets = /* @__PURE__ */ new Map();
			for (const child of targetChildren) {
				const key = renderKeyForNode(child);
				if (key && !keyedTargets.has(key)) keyedTargets.set(key, child);
			}
			const used = /* @__PURE__ */ new Set();
			let cursor = target.firstChild || null;
			for (const sourceChild of sourceChildren) {
				const key = renderKeyForNode(sourceChild);
				let targetChild = key ? keyedTargets.get(key) : null;
				if (targetChild && used.has(targetChild)) targetChild = null;
				if (!targetChild && cursor && !renderKeyForNode(cursor) && canPatchNode(cursor, sourceChild)) targetChild = cursor;
				if (targetChild) {
					const patched = patchNode(targetChild, sourceChild);
					used.add(patched);
					if (patched !== cursor) target.insertBefore(patched, cursor);
					cursor = patched.nextSibling || null;
					continue;
				}
				const inserted = sourceChild.cloneNode(true);
				target.insertBefore(inserted, cursor);
				used.add(inserted);
			}
			for (const child of Array.from(target.childNodes || [])) if (!used.has(child)) child.remove();
		}
		function normalizeOperation(operation) {
			if (!operation || typeof operation !== "object") return null;
			const type = String(operation.type || "");
			const nextEntry = operation.nextEntry && typeof operation.nextEntry === "object" ? operation.nextEntry : null;
			const key = String(operation.key || nextEntry && nextEntry.key || "");
			if (!type || !key || !nextEntry) return null;
			return Object.assign({}, operation, {
				key,
				nextEntry,
				type
			});
		}
		function normalizeTurnOperation(operation) {
			if (!operation || typeof operation !== "object") return null;
			const type = String(operation.type || "");
			const key = String(operation.key || "");
			if (!type || !key) return null;
			return Object.assign({}, operation, {
				key,
				type
			});
		}
		function callbackOk(value) {
			if (!value) return false;
			if (typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "ok")) return Boolean(value.ok);
			return true;
		}
		function callbackReason(value, fallback) {
			if (value && typeof value === "object" && value.reason) return String(value.reason || fallback);
			return fallback;
		}
		function callbackTarget(value) {
			if (!value || typeof value !== "object") return null;
			return value.target || value.node || value.element || null;
		}
		function firstTurnElementFrom(input) {
			if (typeof input.firstTurnElement === "function") return input.firstTurnElement() || null;
			return input.firstTurnElement || null;
		}
		function placeTurnNode(conversation, node, lastPlacedNode, firstTurnElement) {
			if (!conversation || typeof conversation.insertBefore !== "function") return result(false, "missing-turn-order-root");
			if (!node) return result(false, "place-turn-missing-element");
			const anchor = lastPlacedNode ? lastPlacedNode.nextSibling || null : firstTurnElement || conversation.firstChild || null;
			if (node === anchor) return result(true, "turn-already-placed", {
				target: node,
				moved: false
			});
			conversation.insertBefore(node, anchor || null);
			return result(true, "turn-placed", {
				target: node,
				moved: true
			});
		}
		function documentFrom(input = {}) {
			if (input.document && typeof input.document.createElement === "function") return input.document;
			if (typeof document !== "undefined" && document && typeof document.createElement === "function") return document;
			return null;
		}
		function normalizePatchHtmlInput(input, html, options = {}) {
			if (input && typeof input === "object" && typeof input.insertBefore === "function") return Object.assign({}, options || {}, {
				target: input,
				html
			});
			return input && typeof input === "object" ? input : {};
		}
		function patchHtml(input = {}, html, options = {}) {
			const normalized = normalizePatchHtmlInput(input, html, options);
			const target = normalized.target || normalized.root || null;
			if (!target || typeof target.insertBefore !== "function") return result(false, "missing-target");
			const doc = documentFrom(normalized);
			if (!doc) return result(false, "missing-document");
			try {
				const template = doc.createElement("template");
				if (!template) return result(false, "missing-template");
				template.innerHTML = String(normalized.html || "");
				patchChildNodes(target, template.content || { childNodes: [] });
				return result(true, "patched", {
					patched: 1,
					target
				});
			} catch (_) {
				return result(false, "patch-html-failed", { target });
			}
		}
		function planConversationHtmlUpdate(input = {}) {
			const signature = String(input.signature || "");
			const renderedConversationSignature = String(input.renderedConversationSignature || "");
			const renderedConversationPatchShellSignature = String(input.renderedConversationPatchShellSignature || "");
			const patchShellSignature = String(input.patchShellSignature || "");
			const stableSignature = renderedConversationSignature === signature;
			const expectedVisibleTurnCount = Math.max(0, Number(input.expectedVisibleTurnCount || 0));
			const renderedDomTurnCount = Math.max(0, Number(input.renderedDomTurnCount || 0));
			const expectedVisibleItemCount = boundedCount(input.expectedVisibleItemCount);
			const renderedDomItemCount = boundedCount(input.renderedDomItemCount);
			const duplicateRenderKeyCount = boundedCount(input.duplicateRenderKeyCount);
			const duplicateUserMessageCount = boundedCount(input.duplicateUserMessageCount);
			const expectedDuplicateUserMessageCount = boundedCount(input.expectedDuplicateUserMessageCount);
			const excessiveDuplicateUserMessages = Math.max(0, duplicateUserMessageCount - expectedDuplicateUserMessageCount);
			const stableSignatureButMissingTurns = Boolean(stableSignature && expectedVisibleTurnCount > 0 && renderedDomTurnCount < expectedVisibleTurnCount);
			const stableSignatureButMissingItems = Boolean(stableSignature && expectedVisibleItemCount > 0 && hasOwn(input, "renderedDomItemCount") && renderedDomItemCount < expectedVisibleItemCount);
			const stableSignatureButDuplicateKeys = Boolean(stableSignature && duplicateRenderKeyCount > 0);
			const stableSignatureButDuplicateUserMessages = Boolean(stableSignature && excessiveDuplicateUserMessages > 0);
			const stableSignatureButTurnOrderMismatch = Boolean(stableSignature && visibleTurnOrderMismatch(input));
			const stableSignatureDomInvalid = stableSignatureButMissingTurns || stableSignatureButMissingItems || stableSignatureButDuplicateKeys || stableSignatureButDuplicateUserMessages || stableSignatureButTurnOrderMismatch;
			let invalidationReason = "signature-changed";
			if (stableSignatureButDuplicateKeys) invalidationReason = "stable-signature-duplicate-render-keys";
			else if (stableSignatureButDuplicateUserMessages) invalidationReason = "stable-signature-duplicate-user-messages";
			else if (stableSignatureButTurnOrderMismatch) invalidationReason = "stable-signature-turn-order-mismatch";
			else if (stableSignatureButMissingItems) invalidationReason = "stable-signature-dom-item-mismatch";
			else if (stableSignatureButMissingTurns) invalidationReason = renderedDomTurnCount <= 0 ? "stable-signature-dom-empty" : "stable-signature-dom-turn-mismatch";
			const scrollAction = input.stickToBottom ? "scroll-to-bottom" : "update-bottom-button";
			if (stableSignature && !stableSignatureDomInvalid) return {
				action: "hydrate-existing",
				changed: false,
				stableSignature: true,
				reason: "signature-stable",
				signature,
				patchShellSignature,
				updateRenderedConversationSignature: false,
				updatePatchShellSignature: Boolean(patchShellSignature),
				nextRenderedConversationSignature: renderedConversationSignature,
				nextRenderedConversationPatchShellSignature: patchShellSignature || renderedConversationPatchShellSignature,
				hydrateOptions: {
					imageScanDelays: [0, 180],
					skipRichHydration: true
				},
				scrollAction,
				performance: false
			};
			return {
				action: stableSignatureDomInvalid || !input.hasExistingChildren ? "set-inner-html" : "patch-html",
				fallbackAction: "set-inner-html",
				changed: true,
				stableSignature,
				reason: invalidationReason,
				signature,
				patchShellSignature,
				updateRenderedConversationSignature: true,
				updatePatchShellSignature: true,
				nextRenderedConversationSignature: signature,
				nextRenderedConversationPatchShellSignature: patchShellSignature,
				hydrateOptions: {},
				scrollAction,
				performance: true
			};
		}
		function scrollEffectFromAction(scrollAction) {
			if (scrollAction === "scroll-to-bottom") return { type: "schedule-conversation-to-bottom" };
			if (scrollAction === "update-bottom-button") return { type: "schedule-scroll-button-update" };
			return null;
		}
		function planConversationHtmlUpdateEffects(plan = {}) {
			const updatePlan = objectOrEmpty(plan);
			const action = String(updatePlan.action || "");
			const effects = [];
			const scrollEffect = scrollEffectFromAction(updatePlan.scrollAction);
			if (action === "hydrate-existing") {
				if (updatePlan.updatePatchShellSignature) effects.push({
					type: "set-rendered-conversation-patch-shell-signature",
					value: String(updatePlan.nextRenderedConversationPatchShellSignature || "")
				});
				effects.push({
					type: "hydrate-root",
					hydrateOptions: objectOrEmpty(updatePlan.hydrateOptions)
				});
				if (scrollEffect) effects.push(scrollEffect);
				return {
					effects,
					reason: effects.length ? "hydrate-existing-effects" : "no-update-effects"
				};
			}
			if (action !== "patch-html" && action !== "set-inner-html") return {
				effects: [],
				reason: action ? "unknown-action" : "missing-action"
			};
			effects.push({
				type: "hydrate-root",
				hydrateOptions: objectOrEmpty(updatePlan.hydrateOptions)
			});
			if (updatePlan.updateRenderedConversationSignature) effects.push({
				type: "set-rendered-conversation-signature",
				value: String(updatePlan.nextRenderedConversationSignature || "")
			});
			if (updatePlan.updatePatchShellSignature) effects.push({
				type: "set-rendered-conversation-patch-shell-signature",
				value: String(updatePlan.nextRenderedConversationPatchShellSignature || "")
			});
			if (scrollEffect) effects.push(scrollEffect);
			return {
				effects,
				reason: effects.length ? "conversation-update-effects" : "no-update-effects"
			};
		}
		function planConversationHtmlUpdateApplication(input = {}) {
			const updatePlan = objectOrEmpty(input.updatePlan || input.plan);
			const action = String(updatePlan.action || "");
			if (action === "hydrate-existing") return {
				shouldMutateDom: false,
				primaryAction: "hydrate-existing",
				finalAction: "hydrate-existing",
				patchAttempted: false,
				patchApplied: false,
				fallbackApplied: false,
				patchRejectReason: "",
				reason: "hydrate-existing"
			};
			if (action === "set-inner-html") return {
				shouldMutateDom: true,
				primaryAction: "set-inner-html",
				finalAction: "set-inner-html",
				patchAttempted: false,
				patchApplied: false,
				fallbackApplied: false,
				patchRejectReason: "",
				reason: "set-inner-html"
			};
			if (action === "patch-html") {
				const patchResult = objectOrEmpty(input.patchResult);
				const patchApplied = patchResult.ok === true;
				const patchRejectReason = patchApplied ? "" : String(patchResult.reason || "patch-html-failed").slice(0, 80);
				return {
					shouldMutateDom: true,
					primaryAction: "patch-html",
					finalAction: patchApplied ? "patch-html" : "set-inner-html",
					patchAttempted: true,
					patchApplied,
					fallbackApplied: !patchApplied,
					patchRejectReason,
					reason: patchApplied ? "patch-html" : "patch-html-failed"
				};
			}
			return {
				shouldMutateDom: false,
				primaryAction: action,
				finalAction: "",
				patchAttempted: false,
				patchApplied: false,
				fallbackApplied: false,
				patchRejectReason: "",
				reason: action ? "unknown-action" : "missing-action"
			};
		}
		function compactMismatchReason(reason) {
			return String(reason || "unknown").replace(/[^a-z0-9_-]+/gi, "_").replace(/-+/g, "_").slice(0, 80) || "unknown";
		}
		function conversationDomConsistencyReason(input = {}) {
			const expectedVisibleTurnCount = boundedCount(input.expectedVisibleTurnCount);
			const renderedDomTurnCount = boundedCount(input.renderedDomTurnCount);
			const expectedVisibleItemCount = boundedCount(input.expectedVisibleItemCount);
			const renderedDomItemCount = boundedCount(input.renderedDomItemCount);
			const duplicateRenderKeyCount = boundedCount(input.duplicateRenderKeyCount);
			const duplicateUserMessageCount = boundedCount(input.duplicateUserMessageCount);
			const expectedDuplicateUserMessageCount = boundedCount(input.expectedDuplicateUserMessageCount);
			if (Math.max(0, duplicateUserMessageCount - expectedDuplicateUserMessageCount) > 0) return "post-apply-duplicate-user-messages";
			if (duplicateRenderKeyCount > 0) return "post-apply-duplicate-render-keys";
			if (visibleTurnOrderMismatch(input)) return "post-apply-turn-order-mismatch";
			if (expectedVisibleItemCount > 0 && hasOwn(input, "renderedDomItemCount") && renderedDomItemCount < expectedVisibleItemCount) return "post-apply-dom-item-mismatch";
			if (expectedVisibleTurnCount > 0 && renderedDomTurnCount < expectedVisibleTurnCount) return renderedDomTurnCount <= 0 ? "post-apply-dom-empty" : "post-apply-dom-turn-mismatch";
			return "";
		}
		function planConversationPostApplyDomConsistency(input = {}) {
			const updatePlan = objectOrEmpty(input.updatePlan);
			const applicationPlan = objectOrEmpty(input.applicationPlan);
			const reason = conversationDomConsistencyReason(input);
			if (!reason) return {
				ok: true,
				shouldFallbackToInnerHtml: false,
				shouldReport: false,
				reason: "dom-consistent",
				diagnosticInput: null
			};
			const finalAction = String(applicationPlan.finalAction || updatePlan.action || "");
			const expectedVisibleTurnCount = boundedCount(input.expectedVisibleTurnCount);
			const renderedDomTurnCount = boundedCount(input.renderedDomTurnCount);
			const expectedVisibleItemCount = boundedCount(input.expectedVisibleItemCount);
			const renderedDomItemCount = boundedCount(input.renderedDomItemCount);
			return {
				ok: false,
				shouldFallbackToInnerHtml: finalAction !== "set-inner-html",
				shouldReport: true,
				reason,
				diagnosticInput: {
					readMode: optionalBoundedString(input, "readMode", 80) || "",
					renderMode: finalAction.slice(0, 40),
					renderPlanReason: String(updatePlan.reason || "").slice(0, 80),
					patchRejectReason: reason,
					previousVisibleItemCount: renderedDomItemCount || renderedDomTurnCount,
					visibleItemCount: expectedVisibleItemCount || expectedVisibleTurnCount
				}
			};
		}
		function planConversationHtmlPatchFallbackClientEvent(input = {}) {
			const applicationPlan = objectOrEmpty(input.applicationPlan || input.plan);
			if (!applicationPlan.fallbackApplied) return {
				shouldPost: false,
				eventName: "",
				payload: null,
				reason: "no-fallback"
			};
			const updatePlan = objectOrEmpty(input.updatePlan);
			return {
				shouldPost: true,
				eventName: "conversation_patch_html_fallback",
				payload: {
					threadId: String(input.threadId || ""),
					reason: String(applicationPlan.patchRejectReason || applicationPlan.reason || "patch-html-failed").slice(0, 80),
					updateReason: String(updatePlan.reason || "").slice(0, 80),
					expectedVisibleTurnCount: boundedCount(input.expectedVisibleTurnCount),
					renderedDomTurnCount: boundedCount(input.renderedDomTurnCount),
					action: String(applicationPlan.primaryAction || "").slice(0, 40),
					finalAction: String(applicationPlan.finalAction || "").slice(0, 40)
				},
				reason: "patch-html-fallback"
			};
		}
		function optionalBoundedString(input, key, max = 120) {
			if (!hasOwn(input, key) || input[key] === void 0 || input[key] === null) return void 0;
			return String(input[key] || "").slice(0, max) || void 0;
		}
		function planConversationDomAuthorityInvalidation(input = {}) {
			const updatePlan = objectOrEmpty(input.updatePlan || input.plan);
			const expectedVisibleTurnCount = boundedCount(input.expectedVisibleTurnCount);
			const renderedDomTurnCount = boundedCount(input.renderedDomTurnCount);
			const expectedVisibleItemCount = boundedCount(input.expectedVisibleItemCount);
			const renderedDomItemCount = boundedCount(input.renderedDomItemCount);
			const duplicateRenderKeyCount = boundedCount(input.duplicateRenderKeyCount);
			const duplicateUserMessageCount = boundedCount(input.duplicateUserMessageCount);
			const expectedDuplicateUserMessageCount = boundedCount(input.expectedDuplicateUserMessageCount);
			const reason = String(updatePlan.reason || "");
			const invalidationReasons = /* @__PURE__ */ new Set([
				"stable-signature-dom-empty",
				"stable-signature-dom-turn-mismatch",
				"stable-signature-dom-item-mismatch",
				"stable-signature-duplicate-render-keys",
				"stable-signature-duplicate-user-messages",
				"stable-signature-turn-order-mismatch"
			]);
			if (!Boolean(invalidationReasons.has(reason) && (expectedVisibleTurnCount > 0 || expectedVisibleItemCount > 0 || duplicateRenderKeyCount > 0 || duplicateUserMessageCount > expectedDuplicateUserMessageCount))) return {
				shouldRecordMismatch: false,
				mismatchReason: "",
				mismatchPayload: null,
				shouldPostClientEvent: false,
				clientEventName: "",
				clientEventPayload: null,
				reason: invalidationReasons.has(reason) ? "no-expected-visible-content" : "not-authority-invalidated"
			};
			const mismatchPayload = {
				source: String(input.source || "conversation-update").slice(0, 120),
				action: optionalBoundedString(input, "action", 80),
				routeKind: optionalBoundedString(input, "routeKind", 80),
				threadHash: optionalBoundedString(input, "threadHash", 80),
				renderMode: String(updatePlan.action || "full-render").slice(0, 40),
				currentTurns: hasOwn(input, "currentTurns") ? input.currentTurns : void 0,
				currentVisibleItems: hasOwn(input, "currentVisibleItems") ? input.currentVisibleItems : void 0,
				domCount: renderedDomTurnCount,
				domItemCount: renderedDomItemCount,
				duplicateRenderKeyCount,
				duplicateUserMessageCount,
				expectedDuplicateUserMessageCount,
				previousCount: boundedCount(input.previousChildCount)
			};
			return {
				shouldRecordMismatch: true,
				mismatchReason: compactMismatchReason(reason),
				mismatchPayload,
				shouldPostClientEvent: true,
				clientEventName: "conversation_dom_authority_invalidated",
				clientEventPayload: {
					threadId: String(input.threadId || ""),
					reason: reason.slice(0, 80),
					expectedVisibleTurnCount,
					renderedDomTurnCount,
					expectedVisibleItemCount,
					renderedDomItemCount,
					duplicateRenderKeyCount,
					duplicateUserMessageCount,
					expectedDuplicateUserMessageCount,
					action: String(updatePlan.action || "").slice(0, 40)
				},
				reason
			};
		}
		function planConversationHtmlPerformanceEvent(input = {}) {
			const updatePlan = objectOrEmpty(input.updatePlan);
			const applicationPlan = objectOrEmpty(input.applicationPlan);
			const renderElapsedMs = boundedDuration(input.renderElapsedMs);
			const slowThresholdMs = boundedDuration(input.slowThresholdMs);
			const minIntervalMs = boundedDuration(input.minIntervalMs);
			const force = slowThresholdMs > 0 && renderElapsedMs >= slowThresholdMs;
			return {
				eventName: "conversation_render_ms",
				payload: {
					renderElapsedMs,
					htmlChars: String(input.html || "").length,
					previousChildCount: boundedCount(input.previousChildCount),
					childCount: boundedCount(input.childCount),
					stickToBottom: input.stickToBottom === true,
					threadId: String(input.threadId || ""),
					currentThreadStatus: String(input.currentThreadStatus || ""),
					updateReason: String(updatePlan.reason || "").slice(0, 80),
					domUpdateAction: String(applicationPlan.finalAction || "").slice(0, 40),
					patchFallbackApplied: applicationPlan.fallbackApplied === true,
					patchRejectReason: String(applicationPlan.patchRejectReason || "").slice(0, 80)
				},
				options: {
					key: "conversation_render_ms",
					minIntervalMs: force ? 0 : minIntervalMs,
					force
				},
				reason: force ? "slow-render" : "normal-render"
			};
		}
		function planLocalConversationDomUpdateCompletionSnapshot(input = {}) {
			const tilePanePatched = Boolean(input.tilePanePatched);
			const scrollAction = input.scrollAction === "scroll-to-bottom" ? "scroll-to-bottom" : "update-bottom-button";
			return {
				tilePanePatched,
				canPatchSingleThread: tilePanePatched ? false : Boolean(input.canPatchSingleThread),
				hasRoot: Boolean(input.hasRoot),
				conversationSignature: tilePanePatched ? "" : String(input.conversationSignature || ""),
				patchShellSignature: tilePanePatched ? "" : String(input.patchShellSignature || ""),
				scrollAction: tilePanePatched ? "none" : scrollAction
			};
		}
		function planLocalConversationDomUpdateCompletion(input = {}) {
			const snapshot = planLocalConversationDomUpdateCompletionSnapshot(input);
			if (snapshot.tilePanePatched) return {
				action: "tile-pane-complete",
				complete: true,
				reason: "tile-pane-patched",
				hydrateRoot: false,
				updateRenderedConversationSignature: false,
				updatePatchShellSignature: false,
				nextRenderedConversationSignature: "",
				nextRenderedConversationPatchShellSignature: "",
				scrollAction: "none"
			};
			if (!snapshot.canPatchSingleThread) return {
				action: "blocked",
				complete: false,
				reason: "single-thread-unpatchable",
				hydrateRoot: false,
				updateRenderedConversationSignature: false,
				updatePatchShellSignature: false,
				nextRenderedConversationSignature: "",
				nextRenderedConversationPatchShellSignature: "",
				scrollAction: "none"
			};
			return {
				action: "single-thread-complete",
				complete: true,
				reason: "single-thread-patched",
				hydrateRoot: Boolean(input.hasRoot),
				hydrateOptions: {},
				updateRenderedConversationSignature: true,
				updatePatchShellSignature: true,
				nextRenderedConversationSignature: snapshot.conversationSignature,
				nextRenderedConversationPatchShellSignature: snapshot.patchShellSignature,
				scrollAction: snapshot.scrollAction
			};
		}
		function planLocalConversationDomUpdateCompletionEffects(plan = {}) {
			const completionPlan = objectOrEmpty(plan);
			if (!completionPlan.complete) return {
				effects: [],
				reason: "completion-incomplete"
			};
			const effects = [];
			if (completionPlan.hydrateRoot) effects.push({
				type: "hydrate-root",
				hydrateOptions: objectOrEmpty(completionPlan.hydrateOptions)
			});
			if (completionPlan.updateRenderedConversationSignature) effects.push({
				type: "set-rendered-conversation-signature",
				value: String(completionPlan.nextRenderedConversationSignature || "")
			});
			if (completionPlan.updatePatchShellSignature) effects.push({
				type: "set-rendered-conversation-patch-shell-signature",
				value: String(completionPlan.nextRenderedConversationPatchShellSignature || "")
			});
			const scrollEffect = scrollEffectFromAction(completionPlan.scrollAction);
			if (scrollEffect) effects.push(scrollEffect);
			return {
				effects,
				reason: effects.length ? "completion-effects" : "no-completion-effects"
			};
		}
		function planThreadDetailRefreshLocalPatchTransactionEffects(input = {}) {
			return {
				commitEffects: [{
					type: "complete-local-conversation-dom-update",
					name: "complete-local-conversation-dom-update",
					completionSnapshot: objectOrEmpty(input.completionSnapshot)
				}],
				afterSuccess: [{
					type: "update-live-operation-dock",
					name: "update-live-operation-dock"
				}, {
					type: "bind-current-thread-actions",
					name: "bind-current-thread-actions"
				}],
				reason: "refresh-local-patch-transaction-effects"
			};
		}
		function createElementFromHtml(input = {}) {
			const html = String(input.html || "");
			if (!html.trim()) return null;
			const doc = documentFrom(input);
			if (!doc) return null;
			let template = null;
			try {
				template = doc.createElement("template");
				if (!template) return null;
				template.innerHTML = html;
				return template.content && template.content.firstElementChild || null;
			} catch (_) {
				return null;
			}
		}
		function createTurnArticleElement(input = {}) {
			const turn = input.turn || null;
			const renderTurnHtml = typeof input.renderTurnHtml === "function" ? input.renderTurnHtml : null;
			if (!turn || !renderTurnHtml) return null;
			let html = "";
			try {
				html = renderTurnHtml(turn, input.previousKeys);
			} catch (_) {
				return null;
			}
			return createElementFromHtml({
				document: input.document,
				html
			});
		}
		function hydrateRenderedSurface(input = {}) {
			const root = input.root || input.surface || null;
			if (!root) return result(false, "missing-root", {
				githubHydrated: 0,
				mermaidHydrated: 0,
				imageScans: 0
			});
			const hydrateGitHubLinks = typeof input.hydrateGitHubLinks === "function" ? input.hydrateGitHubLinks : null;
			const hydrateMermaid = typeof input.hydrateMermaid === "function" ? input.hydrateMermaid : null;
			const scheduleImageScan = typeof input.scheduleImageScan === "function" ? input.scheduleImageScan : null;
			const counts = {
				githubHydrated: 0,
				mermaidHydrated: 0,
				imageScans: 0
			};
			if (hydrateGitHubLinks) {
				hydrateGitHubLinks(root);
				counts.githubHydrated += 1;
			}
			if (hydrateMermaid) {
				hydrateMermaid(root);
				counts.mermaidHydrated += 1;
			}
			if (scheduleImageScan) {
				if (hasOwn(input, "imageScanDelays")) scheduleImageScan(root, input.imageScanDelays);
				else scheduleImageScan(root);
				counts.imageScans += 1;
			}
			return result(true, "hydrated", counts);
		}
		function defaultEscapeSelectorAttr(value) {
			return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
		}
		function findElementByRenderKey(input = {}) {
			const root = input.root || input.conversation || null;
			if (!root || typeof root.querySelector !== "function") return null;
			const key = String(input.key || input.renderKey || input.turnKey || "");
			if (!key) return null;
			const escapeSelectorAttr = typeof input.escapeSelectorAttr === "function" ? input.escapeSelectorAttr : defaultEscapeSelectorAttr;
			try {
				return root.querySelector(`[data-render-key="${escapeSelectorAttr(key)}"]`) || null;
			} catch (_) {
				return null;
			}
		}
		function findTurnArticleElement(input = {}) {
			return findElementByRenderKey(input);
		}
		function resolveTurnInsertAnchor(input = {}) {
			const turn = input.turn || null;
			if (!turn) return {
				ok: false,
				reason: "missing-turn",
				anchor: null
			};
			const visibleTurns = Array.isArray(input.visibleTurns) ? input.visibleTurns : [];
			const findTurnElement = typeof input.findTurnElement === "function" ? input.findTurnElement : null;
			if (!findTurnElement) return {
				ok: false,
				reason: "missing-find-turn-element",
				anchor: null
			};
			const turnIndex = visibleTurns.indexOf(turn);
			for (let index = turnIndex - 1; index >= 0; index -= 1) {
				const previous = findTurnElement(visibleTurns[index], index);
				if (previous) return {
					ok: true,
					reason: "after-previous-turn",
					anchor: previous.nextSibling || null
				};
			}
			const firstTurn = firstTurnElementFrom(input);
			return {
				ok: true,
				reason: firstTurn ? "before-first-turn" : "append",
				anchor: firstTurn || null
			};
		}
		function insertTurnArticleElement(input = {}) {
			const conversation = input.conversation;
			if (!conversation || typeof conversation.insertBefore !== "function") return result(false, "missing-conversation");
			const source = input.source || null;
			if (!source) return result(false, "missing-source");
			const anchorPlan = resolveTurnInsertAnchor(input);
			if (!anchorPlan.ok) return result(false, anchorPlan.reason || "insert-anchor-failed");
			conversation.insertBefore(source, anchorPlan.anchor || null);
			return result(true, anchorPlan.reason || "inserted", { inserted: 1 });
		}
		function insertVisibleItemElement(input = {}) {
			const article = input.article || input.root || null;
			if (!article || typeof article.insertBefore !== "function") return result(false, "missing-article");
			const source = input.source || null;
			if (!source) return result(false, "missing-source");
			const entries = Array.isArray(input.entries) ? input.entries : [];
			const visibleIndex = Number.isInteger(input.visibleIndex) ? input.visibleIndex : -1;
			if (visibleIndex < 0 || visibleIndex >= entries.length) return result(false, "invalid-visible-index");
			const keyForEntry = typeof input.keyForEntry === "function" ? input.keyForEntry : null;
			const findElementByKey = typeof input.findElementByKey === "function" ? input.findElementByKey : null;
			if (!keyForEntry || !findElementByKey) return result(false, "missing-key-lookup");
			let anchor = null;
			let foundPrevious = false;
			for (let index = visibleIndex - 1; index >= 0; index -= 1) {
				const entry = entries[index];
				const key = String(keyForEntry(entry, index) || "");
				if (!key) continue;
				const previousNode = findElementByKey(key, entry, index);
				if (!previousNode) continue;
				foundPrevious = true;
				anchor = previousNode.nextSibling || null;
				break;
			}
			if (!foundPrevious) anchor = article.firstChild || null;
			article.insertBefore(source, anchor);
			return result(true, "inserted", {
				inserted: 1,
				target: source,
				anchor,
				anchorMode: foundPrevious ? anchor ? "after-previous-before-next" : "append-after-previous" : "before-first"
			});
		}
		function applyVisibleItemRefreshDomPatch(input = {}) {
			const patchPlan = input.patchPlan;
			if (!patchPlan || !patchPlan.canPatch || !Array.isArray(patchPlan.operations)) return result(false, "plan-not-patchable");
			const article = input.article;
			if (!article || typeof article.insertBefore !== "function") return result(false, "missing-article");
			const findElementByKey = typeof input.findElementByKey === "function" ? input.findElementByKey : null;
			const renderElement = typeof input.renderElement === "function" ? input.renderElement : null;
			const patchElement = typeof input.patchElement === "function" ? input.patchElement : null;
			if (!findElementByKey) return result(false, "missing-find-element");
			if (!renderElement) return result(false, "missing-render-element");
			if (!patchElement) return result(false, "missing-patch-element");
			let lastPatchedNode = null;
			const counts = {
				reused: 0,
				patched: 0,
				inserted: 0
			};
			for (const rawOperation of patchPlan.operations) {
				const operation = normalizeOperation(rawOperation);
				if (!operation) return result(false, "invalid-operation", counts);
				const nextEntry = operation.nextEntry;
				if (operation.type === "reuse" || operation.type === "patch") {
					const existingNode = findElementByKey(operation.key, nextEntry);
					if (!existingNode) return result(false, "missing-existing-node", counts);
					if (operation.type === "reuse") {
						lastPatchedNode = placeVisibleItemNode(article, existingNode, lastPatchedNode);
						counts.reused += 1;
						continue;
					}
					const patchedNode = patchElement(existingNode, nextEntry);
					if (!patchedNode) return result(false, "patch-existing-node-failed", counts);
					lastPatchedNode = placeVisibleItemNode(article, patchedNode, lastPatchedNode);
					counts.patched += 1;
					continue;
				}
				if (operation.type !== "insert") return result(false, "unknown-operation", counts);
				const source = renderElement(nextEntry);
				if (!source) return result(false, "render-insert-node-failed", counts);
				const anchor = lastPatchedNode ? lastPatchedNode.nextSibling : article.firstChild || null;
				article.insertBefore(source, anchor || null);
				lastPatchedNode = source;
				counts.inserted += 1;
			}
			const nextKeys = new Set(patchPlan.operations.map((operation) => normalizeOperation(operation)).filter(Boolean).map((operation) => operation.key));
			for (const child of Array.from(article.childNodes || [])) {
				const key = visibleItemRenderKeyForNode(child);
				if (!key || nextKeys.has(key)) continue;
				if (typeof child.remove === "function") child.remove();
			}
			if (!visibleItemOrderMatches(article, Array.from(nextKeys))) return result(false, "post-apply-visible-item-order-mismatch", counts);
			return result(true, "applied", counts);
		}
		function applyThreadTurnRefreshDomPatch(input = {}) {
			const patchPlan = input.patchPlan;
			if (!patchPlan || !patchPlan.canPatch || !Array.isArray(patchPlan.operations)) return result(false, "turn-patch-plan-not-patchable", {
				itemPatched: 0,
				replaced: 0
			});
			const findTurnByKey = typeof input.findTurnByKey === "function" ? input.findTurnByKey : null;
			const applyItemPatch = typeof input.applyItemPatch === "function" ? input.applyItemPatch : null;
			const renderTurnElement = typeof input.renderTurnElement === "function" ? input.renderTurnElement : null;
			const insertTurnElement = typeof input.insertTurnElement === "function" ? input.insertTurnElement : null;
			const replaceTurnElement = typeof input.replaceTurnElement === "function" ? input.replaceTurnElement : null;
			const removeTurnElement = typeof input.removeTurnElement === "function" ? input.removeTurnElement : null;
			const findTurnElementByKey = typeof input.findTurnElementByKey === "function" ? input.findTurnElementByKey : null;
			const conversation = input.conversation || input.root || null;
			const firstTurnElement = firstTurnElementFrom(input);
			if (!findTurnByKey) return result(false, "missing-find-turn", {
				itemPatched: 0,
				replaced: 0
			});
			if (!applyItemPatch) return result(false, "missing-apply-item-patch", {
				itemPatched: 0,
				replaced: 0
			});
			if (!renderTurnElement) return result(false, "missing-render-turn", {
				itemPatched: 0,
				replaced: 0
			});
			if (!insertTurnElement) return result(false, "missing-insert-turn", {
				itemPatched: 0,
				replaced: 0
			});
			if (!replaceTurnElement) return result(false, "missing-replace-turn", {
				itemPatched: 0,
				replaced: 0
			});
			const counts = {
				reused: 0,
				patched: 0,
				inserted: 0,
				itemPatched: 0,
				replaced: 0,
				removed: 0,
				reordered: 0
			};
			let lastPlacedTurnElement = null;
			function placeAppliedTurn(operation, callbackValue, fallbackNode = null) {
				const target = callbackTarget(callbackValue) || fallbackNode || (findTurnElementByKey ? findTurnElementByKey(operation.key, operation) : null);
				if (!target) return result(false, findTurnElementByKey ? "place-turn-missing-element" : "missing-find-turn-element", counts);
				const placeResult = placeTurnNode(conversation, target, lastPlacedTurnElement, firstTurnElement);
				if (!placeResult.ok) return result(false, placeResult.reason || "place-turn-failed", counts);
				lastPlacedTurnElement = callbackTarget(placeResult) || target;
				if (placeResult.moved) counts.reordered += 1;
				return null;
			}
			for (const rawOperation of patchPlan.operations) {
				const operation = normalizeTurnOperation(rawOperation);
				if (!operation) return result(false, "invalid-turn-operation", counts);
				if (operation.type === "remove-turn") {
					if (!removeTurnElement) return result(false, "missing-remove-turn", counts);
					const removeResult = removeTurnElement(operation);
					if (!callbackOk(removeResult)) return result(false, callbackReason(removeResult, "remove-turn-failed"), counts);
					counts.removed += 1;
					continue;
				}
				const turn = findTurnByKey(operation.key, operation);
				if (!turn) return result(false, "turn-patch-operation-missing-turn", counts);
				if (operation.type === "item-patch") {
					const itemPatchResult = applyItemPatch(turn, operation);
					if (!callbackOk(itemPatchResult)) return result(false, callbackReason(itemPatchResult, "item-patch-failed"), counts);
					const placeFailure = placeAppliedTurn(operation, itemPatchResult);
					if (placeFailure) return placeFailure;
					counts.itemPatched += 1;
					counts.patched += 1;
					continue;
				}
				if (operation.type !== "insert-turn" && operation.type !== "replace-turn") return result(false, "unknown-turn-patch-operation", counts);
				const source = renderTurnElement(turn, operation);
				if (!source) return result(false, "render-turn-failed", counts);
				if (operation.type === "insert-turn") {
					const insertResult = insertTurnElement(source, turn, operation);
					if (!callbackOk(insertResult)) return result(false, callbackReason(insertResult, "insert-turn-failed"), counts);
					const placeFailure = placeAppliedTurn(operation, insertResult, source);
					if (placeFailure) return placeFailure;
					counts.inserted += 1;
					continue;
				}
				const replaceResult = replaceTurnElement(source, turn, operation);
				if (!callbackOk(replaceResult)) return result(false, callbackReason(replaceResult, "replace-turn-failed"), counts);
				const placeFailure = placeAppliedTurn(operation, replaceResult);
				if (placeFailure) return placeFailure;
				counts.replaced += 1;
				counts.patched += 1;
			}
			return result(true, "applied", counts);
		}
		function resultCounts(source = {}) {
			const counts = {};
			for (const key of [
				"reused",
				"patched",
				"inserted",
				"itemPatched",
				"replaced",
				"removed",
				"reordered"
			]) if (Number.isFinite(Number(source[key]))) counts[key] = Number(source[key]);
			return counts;
		}
		function normalizeTransactionEffect(effect, index) {
			if (typeof effect === "function") return {
				name: `effect-${index}`,
				apply: effect
			};
			if (effect && typeof effect === "object" && typeof effect.apply === "function") return {
				name: String(effect.name || `effect-${index}`),
				apply: effect.apply
			};
			return null;
		}
		function applyTransactionEffects(effects, patchResult, counts, countKey) {
			const list = Array.isArray(effects) ? effects : [];
			for (let index = 0; index < list.length; index += 1) {
				const effect = normalizeTransactionEffect(list[index], index);
				if (!effect) return result(false, "invalid-transaction-effect", counts);
				let effectResult = null;
				try {
					effectResult = effect.apply(patchResult);
				} catch (_) {
					return result(false, `${effect.name || "effect"}-threw`, counts);
				}
				if (!callbackOk(effectResult)) return result(false, callbackReason(effectResult, `${effect.name || "effect"}-failed`), counts);
				counts.effectsApplied += 1;
				counts[countKey] = Number(counts[countKey] || 0) + 1;
			}
			return result(true, "effects-applied", counts);
		}
		function applyThreadDetailPatchTransaction(input = {}) {
			const applyPatch = typeof input.applyPatch === "function" ? input.applyPatch : null;
			if (!applyPatch) return result(false, "missing-apply-patch", {
				effectsApplied: 0,
				commitEffectsApplied: 0,
				postCommitEffectsApplied: 0
			});
			let patchResult = null;
			try {
				patchResult = applyPatch();
			} catch (_) {
				return result(false, "apply-patch-threw", {
					effectsApplied: 0,
					commitEffectsApplied: 0,
					postCommitEffectsApplied: 0
				});
			}
			const counts = Object.assign({
				effectsApplied: 0,
				commitEffectsApplied: 0,
				postCommitEffectsApplied: 0
			}, resultCounts(patchResult));
			if (!callbackOk(patchResult)) return result(false, callbackReason(patchResult, "patch-failed"), counts);
			const commitResult = applyTransactionEffects(input.commitEffects, patchResult, counts, "commitEffectsApplied");
			if (!commitResult.ok) return commitResult;
			const postCommitResult = applyTransactionEffects(input.afterSuccess, patchResult, counts, "postCommitEffectsApplied");
			if (!postCommitResult.ok) return postCommitResult;
			return result(true, "transaction-applied", counts);
		}
		function applyLiveTextItemDomPatch(input = {}) {
			const root = input.root || input.conversation || null;
			if (!root || typeof root.querySelector !== "function") return result(false, "missing-root");
			const key = String(input.key || input.renderKey || "");
			if (!key) return result(false, "missing-render-key");
			const renderHtml = typeof input.renderHtml === "function" ? input.renderHtml : null;
			const patchElement = typeof input.patchElement === "function" ? input.patchElement : null;
			if (!renderHtml) return result(false, "missing-render-html");
			if (!patchElement) return result(false, "missing-patch-element");
			const target = findElementByRenderKey({
				root,
				key,
				escapeSelectorAttr: input.escapeSelectorAttr
			});
			if (!target) return result(false, "missing-live-text-target");
			let html = "";
			try {
				html = renderHtml();
			} catch (_) {
				return result(false, "render-live-text-html-failed");
			}
			const source = createElementFromHtml({
				document: input.document,
				html
			});
			if (!source) return result(false, "render-live-text-node-failed");
			const patched = patchElement(target, source);
			if (!callbackOk(patched)) return result(false, callbackReason(patched, "patch-live-text-node-failed"));
			return result(true, "patched", {
				patched: 1,
				target: patched && typeof patched === "object" && patched.target ? patched.target : target
			});
		}
		return {
			applyLiveTextItemDomPatch,
			applyThreadDetailPatchTransaction,
			applyThreadTurnRefreshDomPatch,
			applyVisibleItemRefreshDomPatch,
			canPatchNode,
			createElementFromHtml,
			createTurnArticleElement,
			findElementByRenderKey,
			findTurnArticleElement,
			hydrateRenderedSurface,
			insertTurnArticleElement,
			insertVisibleItemElement,
			normalizeOperation,
			normalizeTurnOperation,
			patchChildNodes,
			patchHtml,
			patchNode,
			planConversationHtmlUpdate,
			planConversationHtmlUpdateEffects,
			planConversationHtmlUpdateApplication,
			planConversationPostApplyDomConsistency,
			planConversationDomAuthorityInvalidation,
			planConversationHtmlPatchFallbackClientEvent,
			planConversationHtmlPerformanceEvent,
			planLocalConversationDomUpdateCompletionSnapshot,
			planLocalConversationDomUpdateCompletion,
			planLocalConversationDomUpdateCompletionEffects,
			planThreadDetailRefreshLocalPatchTransactionEffects,
			renderKeyForNode,
			resolveTurnInsertAnchor,
			syncAttributes,
			threadDetailPatchResult,
			visibleTurnOrderMismatch
		};
	});
}));
//#endregion
//#region public/draft-store.js
var require_draft_store = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexDraftStore = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		const DEFAULTS = {
			draftsKey: "codexMobileDraftsV1",
			draftTargetKey: "codexMobileDraftTargetV1",
			dbName: "codex-mobile-drafts",
			dbVersion: 1,
			attachmentStore: "attachments",
			maxDrafts: 80
		};
		function defaultNormalizeFsPath(value) {
			return String(value || "").replace(/^\\\\\?\\/, "").replace(/[\\/]+/g, "\\").replace(/\\+$/, "").toLowerCase();
		}
		function safeStorage(options) {
			return options && options.storage ? options.storage : null;
		}
		function report(options, type, details) {
			if (options && typeof options.reportError === "function") options.reportError(type, details || {});
		}
		function parseDraftMap(raw) {
			try {
				const value = raw ? JSON.parse(raw) : {};
				return value && typeof value === "object" && !Array.isArray(value) ? value : {};
			} catch (_) {
				return {};
			}
		}
		function normalizeAttachmentMeta(item) {
			if (!item || !item.id || !item.file) return null;
			return {
				id: String(item.id),
				name: String(item.file.name || "upload"),
				type: String(item.file.type || ""),
				size: Number(item.file.size || 0),
				lastModified: Number(item.file.lastModified || 0)
			};
		}
		function draftHasContent(draft) {
			return Boolean(draft && (String(draft.text || "").trim() || Array.isArray(draft.attachments) && draft.attachments.length || draft.model || draft.effort || draft.permissionMode || draft.fastMode === true));
		}
		function attachmentStorageKey(draftKey, attachmentIdValue) {
			return `${encodeURIComponent(draftKey)}|${encodeURIComponent(attachmentIdValue)}`;
		}
		function createDraftStore(options = {}) {
			const config = Object.assign({}, DEFAULTS, options);
			const normalizeFsPath = typeof config.normalizeFsPath === "function" ? config.normalizeFsPath : defaultNormalizeFsPath;
			let dbPromise = null;
			function keyForThread(threadId) {
				const id = String(threadId || "").trim();
				return id ? `thread:${id}` : "";
			}
			function keyForNewThread(cwd) {
				const key = normalizeFsPath(cwd || "");
				return key ? `new:${key}` : "";
			}
			function readMap() {
				const storage = safeStorage(config);
				if (!storage) return {};
				try {
					return parseDraftMap(storage.getItem(config.draftsKey));
				} catch (_) {
					return {};
				}
			}
			function writeMap(map) {
				const storage = safeStorage(config);
				if (!storage) return;
				const entries = Object.entries(map || {}).filter(([, draft]) => draft && typeof draft === "object").sort((a, b) => Number(b[1].updatedAt || 0) - Number(a[1].updatedAt || 0)).slice(0, config.maxDrafts);
				const next = Object.fromEntries(entries);
				try {
					if (entries.length) storage.setItem(config.draftsKey, JSON.stringify(next));
					else storage.removeItem(config.draftsKey);
				} catch (err) {
					report(config, "draft_save_failed", { message: err.message || String(err) });
				}
			}
			function setTargetKey(key) {
				const storage = safeStorage(config);
				if (!storage) return;
				try {
					if (key) storage.setItem(config.draftTargetKey, key);
					else storage.removeItem(config.draftTargetKey);
				} catch (err) {
					report(config, "draft_target_save_failed", { message: err.message || String(err) });
				}
			}
			function getTargetKey() {
				const storage = safeStorage(config);
				if (!storage) return "";
				try {
					return String(storage.getItem(config.draftTargetKey) || "");
				} catch (_) {
					return "";
				}
			}
			function clearTargetKeyIfMatches(key) {
				if (getTargetKey() === String(key || "")) setTargetKey("");
			}
			function openAttachmentDb() {
				const indexedDBRef = config.indexedDB;
				if (!indexedDBRef || typeof indexedDBRef.open !== "function") return Promise.resolve(null);
				if (dbPromise) return dbPromise;
				dbPromise = new Promise((resolve) => {
					const request = indexedDBRef.open(config.dbName, config.dbVersion);
					request.onupgradeneeded = () => {
						const db = request.result;
						const store = db.objectStoreNames.contains(config.attachmentStore) ? request.transaction.objectStore(config.attachmentStore) : db.createObjectStore(config.attachmentStore, { keyPath: "key" });
						if (!store.indexNames.contains("draftKey")) store.createIndex("draftKey", "draftKey", { unique: false });
					};
					request.onsuccess = () => resolve(request.result);
					request.onerror = () => {
						report(config, "draft_db_open_failed", { message: request.error ? request.error.message : "" });
						resolve(null);
					};
					request.onblocked = () => resolve(null);
				});
				return dbPromise;
			}
			async function storeAttachment(draftKey, item) {
				if (!draftKey || !item || !item.id || !item.file) return;
				const db = await openAttachmentDb();
				if (!db) throw new Error("Draft attachment storage unavailable");
				await new Promise((resolve, reject) => {
					const tx = db.transaction(config.attachmentStore, "readwrite");
					tx.objectStore(config.attachmentStore).put({
						key: attachmentStorageKey(draftKey, item.id),
						draftKey,
						id: item.id,
						name: item.file.name || "upload",
						type: item.file.type || "",
						lastModified: item.file.lastModified || Date.now(),
						file: item.file
					});
					tx.oncomplete = resolve;
					tx.onerror = () => reject(tx.error || /* @__PURE__ */ new Error("Draft attachment save failed"));
					tx.onabort = () => reject(tx.error || /* @__PURE__ */ new Error("Draft attachment save aborted"));
				});
			}
			async function loadAttachment(draftKey, meta) {
				const db = await openAttachmentDb();
				if (!db || !draftKey || !meta || !meta.id) return null;
				const record = await new Promise((resolve, reject) => {
					const request = db.transaction(config.attachmentStore, "readonly").objectStore(config.attachmentStore).get(attachmentStorageKey(draftKey, meta.id));
					request.onsuccess = () => resolve(request.result || null);
					request.onerror = () => reject(request.error || /* @__PURE__ */ new Error("Draft attachment read failed"));
				});
				const blob = record && record.file;
				const FileCtor = config.FileCtor;
				if (!blob || typeof FileCtor !== "function") return null;
				const file = blob instanceof FileCtor ? blob : new FileCtor([blob], meta.name || record.name || "upload", {
					type: meta.type || record.type || blob.type || "",
					lastModified: meta.lastModified || record.lastModified || Date.now()
				});
				const urlApi = config.URLApi;
				const previewUrl = file.type && file.type.startsWith("image/") && urlApi && typeof urlApi.createObjectURL === "function" ? urlApi.createObjectURL(file) : "";
				return {
					id: meta.id,
					file,
					previewUrl
				};
			}
			async function deleteAttachments(draftKey, attachmentIds = null) {
				const db = await openAttachmentDb();
				const keyRange = config.IDBKeyRangeCtor;
				if (!db || !draftKey || !keyRange || typeof keyRange.only !== "function") return;
				const ids = attachmentIds ? new Set(Array.from(attachmentIds).map(String)) : null;
				await new Promise((resolve, reject) => {
					const tx = db.transaction(config.attachmentStore, "readwrite");
					const request = tx.objectStore(config.attachmentStore).index("draftKey").openCursor(keyRange.only(draftKey));
					request.onsuccess = () => {
						const cursor = request.result;
						if (!cursor) return;
						if (!ids || ids.has(String(cursor.value && cursor.value.id))) cursor.delete();
						cursor.continue();
					};
					request.onerror = () => reject(request.error || /* @__PURE__ */ new Error("Draft attachment cleanup failed"));
					tx.oncomplete = resolve;
					tx.onerror = () => reject(tx.error || /* @__PURE__ */ new Error("Draft attachment cleanup failed"));
					tx.onabort = () => reject(tx.error || /* @__PURE__ */ new Error("Draft attachment cleanup aborted"));
				});
			}
			return {
				keyForThread,
				keyForNewThread,
				readMap,
				writeMap,
				setTargetKey,
				getTargetKey,
				clearTargetKeyIfMatches,
				hasContent: draftHasContent,
				normalizeAttachmentMeta,
				attachmentStorageKey,
				openAttachmentDb,
				storeAttachment,
				loadAttachment,
				deleteAttachments
			};
		}
		return {
			DEFAULTS,
			defaultNormalizeFsPath,
			parseDraftMap,
			draftHasContent,
			normalizeAttachmentMeta,
			attachmentStorageKey,
			createDraftStore
		};
	});
}));
//#endregion
//#region public/image-compressor.js
var require_image_compressor = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function initImageCompressor(root, factory) {
		if (typeof module === "object" && module.exports) {
			module.exports = factory({});
			return;
		}
		root.CodexImageCompressor = factory(root);
	})(typeof globalThis !== "undefined" ? globalThis : window, function imageCompressorFactory(root) {
		const DEFAULT_OPTIONS = Object.freeze({
			maxEdge: 1280,
			quality: .72,
			minBytes: 256 * 1024,
			minSavingsRatio: .92,
			outputType: "image/jpeg"
		});
		const COMPRESSIBLE_TYPES = /* @__PURE__ */ new Set([
			"image/jpeg",
			"image/jpg",
			"image/png",
			"image/webp"
		]);
		function imageType(file) {
			return String(file && file.type || "").toLowerCase();
		}
		function isCompressibleImageFile(file, options = {}) {
			const settings = Object.assign({}, DEFAULT_OPTIONS, options || {});
			return Boolean(file && Number(file.size || 0) >= settings.minBytes && COMPRESSIBLE_TYPES.has(imageType(file)));
		}
		function targetDimensions(width, height, maxEdge = DEFAULT_OPTIONS.maxEdge) {
			const sourceWidth = Math.max(1, Number(width || 0));
			const sourceHeight = Math.max(1, Number(height || 0));
			const edge = Math.max(1, Number(maxEdge || DEFAULT_OPTIONS.maxEdge));
			const scale = Math.min(1, edge / Math.max(sourceWidth, sourceHeight));
			return {
				width: Math.max(1, Math.round(sourceWidth * scale)),
				height: Math.max(1, Math.round(sourceHeight * scale)),
				scaled: scale < 1
			};
		}
		function compressedImageName(name, outputType = DEFAULT_OPTIONS.outputType) {
			const fallback = "image";
			return `${String(name || fallback).replace(/[\\/]+/g, "_").replace(/\.[^.]*$/, "").trim() || fallback}.${outputType === "image/webp" ? "webp" : "jpg"}`;
		}
		function shouldUseCompressedBlob(originalFile, blob, options = {}) {
			const settings = Object.assign({}, DEFAULT_OPTIONS, options || {});
			if (!blob || !Number.isFinite(blob.size) || blob.size <= 0) return false;
			const originalSize = Number(originalFile && originalFile.size || 0);
			if (!originalSize) return true;
			return blob.size < Math.max(1, Math.floor(originalSize * settings.minSavingsRatio));
		}
		function loadImageElement(file, deps) {
			const documentRef = deps.document;
			const urlApi = deps.URL;
			if (!documentRef || !urlApi || typeof documentRef.createElement !== "function") return Promise.reject(/* @__PURE__ */ new Error("image compression is unavailable"));
			return new Promise((resolve, reject) => {
				const url = urlApi.createObjectURL(file);
				const image = documentRef.createElement("img");
				let settled = false;
				const cleanup = () => {
					try {
						urlApi.revokeObjectURL(url);
					} catch (_) {}
				};
				image.onload = () => {
					if (settled) return;
					settled = true;
					resolve({
						width: image.naturalWidth || image.width,
						height: image.naturalHeight || image.height,
						source: image,
						close: cleanup
					});
				};
				image.onerror = () => {
					if (settled) return;
					settled = true;
					cleanup();
					reject(/* @__PURE__ */ new Error("image decode failed"));
				};
				image.src = url;
			});
		}
		function canvasToBlob(canvas, outputType, quality) {
			return new Promise((resolve) => {
				if (!canvas || typeof canvas.toBlob !== "function") {
					resolve(null);
					return;
				}
				canvas.toBlob((blob) => resolve(blob), outputType, quality);
			});
		}
		async function compressImageFile(file, options = {}) {
			const settings = Object.assign({}, DEFAULT_OPTIONS, options || {});
			if (!isCompressibleImageFile(file, settings)) return file;
			const deps = {
				document: settings.document || root.document,
				URL: settings.URL || root.URL,
				File: settings.File || root.File
			};
			let image = null;
			try {
				image = await loadImageElement(file, deps);
				const dims = targetDimensions(image.width, image.height, settings.maxEdge);
				const canvas = deps.document.createElement("canvas");
				canvas.width = dims.width;
				canvas.height = dims.height;
				const ctx = canvas.getContext("2d", { alpha: false });
				if (!ctx) return file;
				ctx.fillStyle = "#ffffff";
				ctx.fillRect(0, 0, dims.width, dims.height);
				ctx.drawImage(image.source, 0, 0, dims.width, dims.height);
				const blob = await canvasToBlob(canvas, settings.outputType, settings.quality);
				if (!shouldUseCompressedBlob(file, blob, settings)) return file;
				const name = compressedImageName(file.name, settings.outputType);
				if (typeof deps.File === "function") return new deps.File([blob], name, {
					type: blob.type || settings.outputType,
					lastModified: Number(file.lastModified || Date.now())
				});
				blob.name = name;
				blob.lastModified = Number(file.lastModified || Date.now());
				return blob;
			} finally {
				if (image && typeof image.close === "function") image.close();
			}
		}
		return {
			DEFAULT_OPTIONS,
			compressedImageName,
			compressImageFile,
			isCompressibleImageFile,
			shouldUseCompressedBlob,
			targetDimensions
		};
	});
}));
//#endregion
//#region \0virtual:codex-mobile-esm-compatibility/shard/shard-01
var import_build_refresh_policy = /* @__PURE__ */ __toESM(require_build_refresh_policy());
var import_runtime_settings = /* @__PURE__ */ __toESM(require_runtime_settings());
var import_viewport_metrics = /* @__PURE__ */ __toESM(require_viewport_metrics());
var import_conversation_scroll = /* @__PURE__ */ __toESM(require_conversation_scroll());
var import_thread_performance_metrics = /* @__PURE__ */ __toESM(require_thread_performance_metrics());
var import_thread_detail_state = /* @__PURE__ */ __toESM(require_thread_detail_state());
var import_thread_detail_render_plan = /* @__PURE__ */ __toESM(require_thread_detail_render_plan());
var import_thread_detail_dom_patch = /* @__PURE__ */ __toESM(require_thread_detail_dom_patch());
var import_draft_store = /* @__PURE__ */ __toESM(require_draft_store());
var import_image_compressor = /* @__PURE__ */ __toESM(require_image_compressor());
var moduleDefinitions = [
	{
		"id": "build-refresh-policy",
		"source": "public/build-refresh-policy.js",
		"globalName": "CodexBuildRefreshPolicy",
		"expectedFunctions": [
			"shellSequenceFromBuildId",
			"classifyServerBuildChange",
			"shouldPromptForServerBuildChange"
		],
		"assetPath": "/build-refresh-policy.js",
		"classicLoaderExcluded": true,
		"bytes": 1532
	},
	{
		"id": "runtime-settings",
		"source": "public/runtime-settings.js",
		"globalName": "CodexRuntimeSettings",
		"expectedFunctions": [
			"normalizeOptionList",
			"labelForModel",
			"compactLabelForModel",
			"labelForEffort",
			"labelForPermissionMode",
			"titleForPermissionMode",
			"normalizePermissionModeValue",
			"selectedNewThreadModel",
			"selectedNewThreadEffort",
			"selectedNewThreadPermission"
		],
		"assetPath": "/runtime-settings.js",
		"classicLoaderExcluded": true,
		"bytes": 3184
	},
	{
		"id": "viewport-metrics",
		"source": "public/viewport-metrics.js",
		"globalName": "CodexViewportMetrics",
		"expectedFunctions": [
			"cssPixel",
			"isKeyboardEditable",
			"measureViewport",
			"stablePixelChanged"
		],
		"assetPath": "/viewport-metrics.js",
		"classicLoaderExcluded": true,
		"bytes": 4306
	},
	{
		"id": "conversation-scroll",
		"source": "public/conversation-scroll.js",
		"globalName": "CodexConversationScroll",
		"expectedFunctions": [
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
			"shouldStartViewportFollow"
		],
		"assetPath": "/conversation-scroll.js",
		"classicLoaderExcluded": true,
		"bytes": 11683
	},
	{
		"id": "thread-performance-metrics",
		"source": "public/thread-performance-metrics.js",
		"globalName": "CodexThreadPerformanceMetrics",
		"expectedFunctions": [
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
			"threadListTimings"
		],
		"assetPath": "/thread-performance-metrics.js",
		"classicLoaderExcluded": true,
		"bytes": 28700
	},
	{
		"id": "thread-detail-state",
		"source": "public/thread-detail-state.js",
		"globalName": "CodexThreadDetailState",
		"expectedFunctions": [
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
			"threadListSummaryFromDetailThread"
		],
		"assetPath": "/thread-detail-state.js",
		"classicLoaderExcluded": true,
		"bytes": 30743
	},
	{
		"id": "thread-detail-render-plan",
		"source": "public/thread-detail-render-plan.js",
		"globalName": "CodexThreadDetailRenderPlan",
		"expectedFunctions": [
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
			"threadDetailRefreshPatchAttemptEffectContext"
		],
		"assetPath": "/thread-detail-render-plan.js",
		"classicLoaderExcluded": true,
		"bytes": 74010
	},
	{
		"id": "thread-detail-dom-patch",
		"source": "public/thread-detail-dom-patch.js",
		"globalName": "CodexThreadDetailDomPatch",
		"expectedFunctions": [
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
			"visibleTurnOrderMismatch"
		],
		"assetPath": "/thread-detail-dom-patch.js",
		"classicLoaderExcluded": true,
		"bytes": 49597
	},
	{
		"id": "draft-store",
		"source": "public/draft-store.js",
		"globalName": "CodexDraftStore",
		"expectedFunctions": [
			"defaultNormalizeFsPath",
			"parseDraftMap",
			"draftHasContent",
			"normalizeAttachmentMeta",
			"attachmentStorageKey",
			"createDraftStore"
		],
		"assetPath": "/draft-store.js",
		"classicLoaderExcluded": true,
		"bytes": 9065
	},
	{
		"id": "image-compressor",
		"source": "public/image-compressor.js",
		"globalName": "CodexImageCompressor",
		"expectedFunctions": [
			"compressedImageName",
			"compressImageFile",
			"isCompressibleImageFile",
			"shouldUseCompressedBlob",
			"targetDimensions"
		],
		"assetPath": "/image-compressor.js",
		"classicLoaderExcluded": true,
		"bytes": 5261
	}
];
var moduleApis = {
	"build-refresh-policy": import_build_refresh_policy.default,
	"runtime-settings": import_runtime_settings.default,
	"viewport-metrics": import_viewport_metrics.default,
	"conversation-scroll": import_conversation_scroll.default,
	"thread-performance-metrics": import_thread_performance_metrics.default,
	"thread-detail-state": import_thread_detail_state.default,
	"thread-detail-render-plan": import_thread_detail_render_plan.default,
	"thread-detail-dom-patch": import_thread_detail_dom_patch.default,
	"draft-store": import_draft_store.default,
	"image-compressor": import_image_compressor.default
};
function functionReady(api, name) {
	return Boolean(api && typeof api[name] === "function");
}
function publishClassicGlobal(definition, api) {
	const globalName = String(definition && definition.globalName || "");
	if (!globalName || !api || typeof api !== "object" || typeof globalThis === "undefined") return false;
	globalThis[globalName] = api;
	return globalThis[globalName] === api;
}
function sampleModule(id, api) {
	if (id === "build-refresh-policy") {
		const classification = functionReady(api, "classifyServerBuildChange") ? api.classifyServerBuildChange("0.1.11|codex-mobile-shell-v626", "0.1.11|codex-mobile-shell-v625") : "";
		const prompt = functionReady(api, "shouldPromptForServerBuildChange") ? api.shouldPromptForServerBuildChange("0.1.11|codex-mobile-shell-v626", "0.1.11|codex-mobile-shell-v625") : false;
		return {
			ok: classification === "server-newer" && prompt === true,
			classification,
			prompt
		};
	}
	if (id === "runtime-settings") {
		const normalizedOptions = functionReady(api, "normalizeOptionList") ? api.normalizeOptionList([
			"",
			"gpt-5.5",
			" gpt-5.5 ",
			"gpt-5.4"
		]) : [];
		const modelLabel = functionReady(api, "labelForModel") ? api.labelForModel("gpt-5.3-codex-spark") : "";
		const compactModelLabel = functionReady(api, "compactLabelForModel") ? api.compactLabelForModel("gpt-5.3-codex-spark") : "";
		const effortLabel = functionReady(api, "labelForEffort") ? api.labelForEffort("xhigh") : "";
		const permissionLabel = functionReady(api, "labelForPermissionMode") ? api.labelForPermissionMode("full") : "";
		const permissionTitle = functionReady(api, "titleForPermissionMode") ? api.titleForPermissionMode("custom") : "";
		const permissionAlias = functionReady(api, "normalizePermissionModeValue") ? api.normalizePermissionModeValue("full-access") : "";
		const selectedModel = functionReady(api, "selectedNewThreadModel") ? api.selectedNewThreadModel({
			selected: "",
			defaultValue: "gpt-5.5",
			options: ["gpt-5.4"]
		}) : "";
		const selectedEffort = functionReady(api, "selectedNewThreadEffort") ? api.selectedNewThreadEffort({
			selected: " high ",
			defaultValue: "medium",
			options: ["low"]
		}) : "";
		const selectedPermission = functionReady(api, "selectedNewThreadPermission") ? api.selectedNewThreadPermission({
			selected: "workspace-write",
			defaultValue: "full",
			options: ["auto"]
		}) : "";
		return {
			ok: Array.isArray(normalizedOptions) && normalizedOptions.join(",") === "gpt-5.5,gpt-5.4" && modelLabel === "GPT-5.3 Codex Spark" && compactModelLabel === "5.3 Spark" && effortLabel === "XHigh" && permissionLabel === "完全访问权限" && permissionTitle === "自定义 (config.toml)" && permissionAlias === "full" && selectedModel === "gpt-5.5" && selectedEffort === "high" && selectedPermission === "auto",
			normalizedOptions,
			modelLabel,
			compactModelLabel,
			effortLabel,
			permissionLabel,
			permissionTitle,
			permissionAlias,
			selectedModel,
			selectedEffort,
			selectedPermission
		};
	}
	if (id === "viewport-metrics") {
		const editable = functionReady(api, "isKeyboardEditable") ? api.isKeyboardEditable({
			tagName: "INPUT",
			type: "text"
		}) : false;
		const checkboxEditable = functionReady(api, "isKeyboardEditable") ? api.isKeyboardEditable({
			tagName: "INPUT",
			type: "checkbox"
		}) : true;
		const measurement = functionReady(api, "measureViewport") ? api.measureViewport({
			visualHeight: 520,
			visualOffsetTop: 16,
			innerHeight: 1024,
			clientHeight: 1024,
			activeElement: { tagName: "TEXTAREA" }
		}) : {};
		const stableChanged = functionReady(api, "stablePixelChanged") ? api.stablePixelChanged(92, 94) : false;
		const stableNoise = functionReady(api, "stablePixelChanged") ? api.stablePixelChanged(92, 93) : true;
		const cssPixel = functionReady(api, "cssPixel") ? api.cssPixel(92.6) : 0;
		return {
			ok: editable === true && checkboxEditable === false && measurement.keyboardShrunk === true && measurement.height === 520 && measurement.top === 16 && stableChanged === true && stableNoise === false && cssPixel === 93,
			editable,
			checkboxEditable,
			keyboardShrunk: Boolean(measurement.keyboardShrunk),
			height: Number(measurement.height) || 0,
			top: Number(measurement.top) || 0,
			stableChanged,
			stableNoise,
			cssPixel
		};
	}
	if (id === "conversation-scroll") {
		const nearBottom = functionReady(api, "isNearBottom") ? api.isNearBottom({
			scrollHeight: 1800,
			scrollTop: 725,
			clientHeight: 980
		}) : false;
		const notNearBottom = functionReady(api, "isNearBottom") ? api.isNearBottom({
			scrollHeight: 1800,
			scrollTop: 640,
			clientHeight: 980
		}) : true;
		const submittedFollow = functionReady(api, "createSubmittedMessageFollow") ? api.createSubmittedMessageFollow("thread-a", {
			clientSubmissionId: "submit-1",
			nowMs: 1e3,
			ttlMs: 5e3
		}) : null;
		const submittedActive = functionReady(api, "shouldFollowSubmittedMessage") ? api.shouldFollowSubmittedMessage(submittedFollow, {
			threadId: "thread-a",
			nowMs: 5999
		}) : false;
		const submittedWrongThread = functionReady(api, "shouldFollowSubmittedMessage") ? api.shouldFollowSubmittedMessage(submittedFollow, {
			threadId: "thread-b",
			nowMs: 2e3
		}) : true;
		const viewportFollow = functionReady(api, "createViewportFollow") ? api.createViewportFollow("thread-a", {
			reason: "orientation",
			nowMs: 1e3,
			ttlMs: 3e3
		}) : null;
		const viewportActive = functionReady(api, "shouldFollowViewport") ? api.shouldFollowViewport(viewportFollow, {
			threadId: "thread-a",
			nowMs: 3999
		}) : false;
		const lease = functionReady(api, "planBottomFollowLeaseEvaluation") ? api.planBottomFollowLeaseEvaluation({
			leaseActive: true,
			hasLease: true
		}) : {};
		const schedule = functionReady(api, "planBottomFollowScrollSchedule") ? api.planBottomFollowScrollSchedule() : {};
		const refresh = functionReady(api, "planAutomaticConversationRefresh") ? api.planAutomaticConversationRefresh({
			hasThread: true,
			nearBottom: false,
			userReadingCurrentTurn: true
		}) : {};
		const fullRender = functionReady(api, "planFullRenderScroll") ? api.planFullRenderScroll({ submittedMessageFollow: true }) : {};
		return {
			ok: nearBottom === true && notNearBottom === false && submittedFollow && submittedFollow.untilMs === 6e3 && submittedActive === true && submittedWrongThread === false && viewportFollow && viewportFollow.untilMs === 4e3 && viewportActive === true && lease.reason === "lease-active" && Array.isArray(schedule.delaysMs) && schedule.delaysMs.join(",") === "0,80,240,600,1200" && refresh.allowRefresh === false && refresh.reason === "user-reading-current-turn" && fullRender.stickToBottom === true && fullRender.reason === "submitted-message-follow",
			nearBottom,
			submittedActive,
			viewportActive,
			leaseReason: String(lease.reason || ""),
			scheduleDelays: Array.isArray(schedule.delaysMs) ? schedule.delaysMs : [],
			refreshReason: String(refresh.reason || ""),
			fullRenderReason: String(fullRender.reason || "")
		};
	}
	if (id === "thread-performance-metrics") {
		const listPhase = functionReady(api, "classifyThreadListPhase") ? api.classifyThreadListPhase({
			fallbackCacheDecision: "expired-rebuild",
			fallbackMs: 25
		}) : "";
		const detailPhase = functionReady(api, "classifyThreadDetailPhase") ? api.classifyThreadDetailPhase({
			readDecision: "projection-hit",
			projectionSource: "dynamic"
		}) : "";
		const clientTimings = functionReady(api, "threadDetailClientTimings") ? api.threadDetailClientTimings({
			elapsedMs: 26.4,
			renderElapsedMs: 7.2,
			detailRenderMode: "patch"
		}) : {};
		const detailFields = functionReady(api, "threadDetailEventFields") ? api.threadDetailEventFields({
			mobileDiagnostics: { threadDetailTimings: {
				phase: "warm-projection-cache",
				totalMs: 8
			} },
			turns: [{
				status: "completed",
				items: [{
					type: "userMessage",
					text: "prompt"
				}]
			}]
		}) : {};
		const shape = functionReady(api, "threadDetailShape") ? api.threadDetailShape({
			mobileOmittedTurnCount: 2,
			turns: [{
				status: "completed",
				items: [{
					type: "userMessage",
					text: "prompt"
				}]
			}, {
				status: "running",
				items: [{
					type: "agentMessage",
					text: "reply"
				}]
			}]
		}) : {};
		const slow = functionReady(api, "planThreadDetailSlowPathDiagnostic") ? api.planThreadDetailSlowPathDiagnostic({
			elapsedMs: 1600,
			apiElapsedMs: 1550,
			renderElapsedMs: 20,
			performancePhase: "cold-turns-list-initial"
		}, {
			action: "thread-detail-load",
			threadHash: "thread_hash",
			durationBucket: "1_3s"
		}) : {};
		return {
			ok: listPhase === "cold-fallback-expired-rebuild" && detailPhase === "warm-projection-dynamic" && clientTimings.elapsedMs === 26 && clientTimings.renderElapsedMs === 7 && clientTimings.detailRenderMode === "patch" && detailFields.performancePhase === "warm-projection-cache" && shape.turns === 2 && shape.visibleItems === 2 && shape.omittedTurns === 2 && shape.completedTurns === 1 && shape.activeTurns === 1 && slow.shouldReport === true && slow.reason === "api-slow",
			listPhase,
			detailPhase,
			elapsedMs: Number(clientTimings.elapsedMs) || 0,
			detailPerformancePhase: String(detailFields.performancePhase || ""),
			visibleItems: Number(shape.visibleItems) || 0,
			slowReason: String(slow.reason || "")
		};
	}
	if (id === "thread-detail-state") {
		const loadedThread = {
			id: "thread-a",
			title: "Thread A",
			status: "completed",
			mobileDetailLoaded: true,
			mobileLoading: false,
			turns: [{
				id: "turn-a",
				status: "completed",
				items: [{
					type: "userMessage",
					text: "hello"
				}]
			}],
			mobileProjection: { source: "sample" }
		};
		const summary = functionReady(api, "threadListSummaryFromDetailThread") ? api.threadListSummaryFromDetailThread(loadedThread) : {};
		const loaded = functionReady(api, "threadHasLoadedDetailState") ? api.threadHasLoadedDetailState(loadedThread) : false;
		const reusable = functionReady(api, "threadHasReusableLoadedDetailState") ? api.threadHasReusableLoadedDetailState(loadedThread) : false;
		const visualBaseline = functionReady(api, "threadHasVisualBaselineLoadedDetailState") ? api.threadHasVisualBaselineLoadedDetailState(Object.assign({}, loadedThread, { status: "active" })) : false;
		const cacheReuse = functionReady(api, "planThreadOpenCacheReuse") ? api.planThreadOpenCacheReuse({
			currentThread: loadedThread,
			threadId: "thread-a"
		}) : {};
		return {
			ok: summary && summary.id === "thread-a" && !Object.prototype.hasOwnProperty.call(summary, "turns") && !Object.prototype.hasOwnProperty.call(summary, "mobileProjection") && loaded === true && reusable === true && visualBaseline === true && cacheReuse && typeof cacheReuse === "object",
			summaryId: String(summary && summary.id || ""),
			summaryHasTurns: Object.prototype.hasOwnProperty.call(summary || {}, "turns"),
			loaded,
			reusable,
			visualBaseline,
			cacheReuseReason: String(cacheReuse.reason || "")
		};
	}
	if (id === "thread-detail-render-plan") {
		const backfill = functionReady(api, "planThreadDetailHistoryAutoBackfill") ? api.planThreadDetailHistoryAutoBackfill({
			hasOlder: true,
			thread: {
				mobileOlderTurnsCursor: "cursor-a",
				turns: [{ items: [{
					type: "assistantMessage",
					text: "[Cross-thread task card sent by source thread]"
				}] }]
			}
		}) : {};
		const request = functionReady(api, "planThreadDetailRefreshRequest") ? api.planThreadDetailRefreshRequest({
			threadId: "thread-a",
			threadLoadSeq: 7,
			options: { source: "auto-refresh" }
		}) : {};
		const postUpdate = functionReady(api, "planSingleThreadShellPostUpdateEffects") ? api.planSingleThreadShellPostUpdateEffects({
			bindCurrentThreadActions: true,
			updateTickTimer: true,
			publishPluginNavigationState: true,
			reason: "sample"
		}) : {};
		const normalizedSignature = functionReady(api, "normalizeSignature") ? api.normalizeSignature(42) : "";
		const effects = Array.isArray(postUpdate.effects) ? postUpdate.effects : [];
		return {
			ok: normalizedSignature === "42" && backfill.shouldLoad === true && backfill.reason === "sparse-conversation-context" && request.shouldRefresh === true && request.threadId === "thread-a" && request.requestedMode === "recent" && request.query && request.query.mode === "recent" && effects.map((entry) => String(entry && entry.type || "")).join(",") === "bind-current-thread-actions,update-tick-timer,publish-plugin-navigation-state",
			normalizedSignature,
			backfillReason: String(backfill.reason || ""),
			refreshReason: String(request.reason || ""),
			effectTypes: effects.map((entry) => String(entry && entry.type || ""))
		};
	}
	if (id === "thread-detail-dom-patch") {
		const patch = functionReady(api, "threadDetailPatchResult") ? api.threadDetailPatchResult(true, "patched", { patched: 2 }) : {};
		const mismatch = functionReady(api, "visibleTurnOrderMismatch") ? api.visibleTurnOrderMismatch({
			expectedTurnIds: ["a", "b"],
			renderedDomTurnIds: ["a", "c"]
		}) : false;
		const match = functionReady(api, "visibleTurnOrderMismatch") ? api.visibleTurnOrderMismatch({
			expectedTurnIds: ["a", "b"],
			renderedDomTurnIds: ["a", "b"]
		}) : true;
		const operation = functionReady(api, "normalizeOperation") ? api.normalizeOperation({
			type: "insert",
			key: "turn-a",
			nextEntry: {
				key: "turn-a",
				html: "<article></article>"
			}
		}) : null;
		const htmlUpdate = functionReady(api, "planConversationHtmlUpdate") ? api.planConversationHtmlUpdate({
			html: "<article data-turn-id=\"a\"></article>",
			previousHtml: "<article data-turn-id=\"a\"></article>",
			conversationSignature: "sig-a",
			previousConversationSignature: "sig-a"
		}) : {};
		return {
			ok: patch.ok === true && patch.reason === "patched" && patch.patched === 2 && mismatch === true && match === false && operation && operation.key === "turn-a" && htmlUpdate.action === "hydrate-existing" && htmlUpdate.reason === "signature-stable",
			patchReason: String(patch.reason || ""),
			patched: Number(patch.patched) || 0,
			mismatch,
			match,
			operationKey: String(operation && operation.key || ""),
			htmlAction: String(htmlUpdate.action || "")
		};
	}
	if (id === "draft-store") {
		const memory = /* @__PURE__ */ new Map();
		const store = functionReady(api, "createDraftStore") ? api.createDraftStore({
			storage: {
				getItem(key) {
					return memory.has(key) ? memory.get(key) : null;
				},
				setItem(key, value) {
					memory.set(key, String(value));
				},
				removeItem(key) {
					memory.delete(key);
				}
			},
			maxDrafts: 2
		}) : null;
		if (store && typeof store.writeMap === "function") {
			store.writeMap({
				old: {
					text: "old",
					updatedAt: 1
				},
				newest: {
					text: "newest",
					updatedAt: 3
				},
				middle: {
					text: "middle",
					updatedAt: 2
				}
			});
			store.setTargetKey("new:/repo");
		}
		const draftKeys = store && typeof store.readMap === "function" ? Object.keys(store.readMap()) : [];
		const threadKey = store && typeof store.keyForThread === "function" ? store.keyForThread(" abc ") : "";
		const newThreadKey = store && typeof store.keyForNewThread === "function" ? store.keyForNewThread("C:/Users/xuefu/project/") : "";
		const targetKey = store && typeof store.getTargetKey === "function" ? store.getTargetKey() : "";
		const parsed = functionReady(api, "parseDraftMap") ? api.parseDraftMap("{\"a\":{\"text\":\"draft\"}}") : {};
		const hasContent = functionReady(api, "draftHasContent") ? api.draftHasContent({ permissionMode: "full" }) : false;
		const meta = functionReady(api, "normalizeAttachmentMeta") ? api.normalizeAttachmentMeta({
			id: 7,
			file: {
				name: "screenshot.png",
				type: "image/png",
				size: 42,
				lastModified: 123
			}
		}) : null;
		const attachmentKey = functionReady(api, "attachmentStorageKey") ? api.attachmentStorageKey("new:/a b", "x/y") : "";
		const normalizedPath = functionReady(api, "defaultNormalizeFsPath") ? api.defaultNormalizeFsPath("C:/Users/xuefu/project/") : "";
		return {
			ok: threadKey === "thread:abc" && newThreadKey === "new:c:\\users\\xuefu\\project" && targetKey === "new:/repo" && draftKeys.join(",") === "newest,middle" && parsed && parsed.a && parsed.a.text === "draft" && hasContent === true && meta && meta.id === "7" && meta.size === 42 && attachmentKey === "new%3A%2Fa%20b|x%2Fy" && normalizedPath === "c:\\users\\xuefu\\project",
			threadKey,
			newThreadKey,
			targetKey,
			draftKeys,
			hasContent,
			attachmentKey,
			normalizedPath
		};
	}
	if (id === "image-compressor") {
		const compressible = functionReady(api, "isCompressibleImageFile") ? api.isCompressibleImageFile({
			type: "image/png",
			size: 300 * 1024
		}) : false;
		const smallImage = functionReady(api, "isCompressibleImageFile") ? api.isCompressibleImageFile({
			type: "image/png",
			size: 12 * 1024
		}) : true;
		const dims = functionReady(api, "targetDimensions") ? api.targetDimensions(3e3, 1500, 1200) : {};
		const name = functionReady(api, "compressedImageName") ? api.compressedImageName("folder/screen.png", "image/webp") : "";
		const useful = functionReady(api, "shouldUseCompressedBlob") ? api.shouldUseCompressedBlob({ size: 1e3 }, { size: 800 }) : false;
		const marginal = functionReady(api, "shouldUseCompressedBlob") ? api.shouldUseCompressedBlob({ size: 1e3 }, { size: 930 }) : true;
		return {
			ok: compressible === true && smallImage === false && dims.width === 1200 && dims.height === 600 && dims.scaled === true && name === "folder_screen.webp" && useful === true && marginal === false,
			compressible,
			smallImage,
			width: Number(dims.width) || 0,
			height: Number(dims.height) || 0,
			scaled: Boolean(dims.scaled),
			name,
			useful,
			marginal
		};
	}
	if (id === "plugin-voice-input") {
		const capability = functionReady(api, "capabilityStateMessage") ? api.capabilityStateMessage({
			writable: true,
			threadId: "thread-a",
			draftId: "draft-a",
			actions: [
				"append",
				"replace",
				"submit"
			],
			maxChars: 100
		}) : {};
		const start = functionReady(api, "startRequestMessage") ? api.startRequestMessage({
			requestId: "req-1",
			voiceSessionId: "voice-1",
			capability
		}) : {};
		const insert = functionReady(api, "insertResultMessage") ? api.insertResultMessage({
			ok: false,
			action: "append_text",
			code: "composer_not_writable",
			composerId: "thread-composer"
		}) : {};
		const error = functionReady(api, "errorMessage") ? api.errorMessage({
			code: "voice_error",
			error: "Voice failed"
		}) : {};
		const action = functionReady(api, "normalizeAction") ? api.normalizeAction("append") : "";
		const actionFromType = functionReady(api, "actionFromMessageType") ? api.actionFromMessageType("voice_input.replace_draft") : "";
		const text = functionReady(api, "textFromMessage") ? api.textFromMessage({ text: "  hello\xA0world  " }, 20) : "";
		const voiceMessage = functionReady(api, "isVoiceInputMessage") ? api.isVoiceInputMessage({ type: "voice_input.append_text" }) : false;
		return {
			ok: capability.type === "voice_input.capability_state" && capability.writable === true && Array.isArray(capability.actions) && capability.actions.join(",") === "append_text,replace_draft" && start.type === "voice_input.start_request" && start.requestId === "req-1" && insert.ok === false && insert.code === "composer_not_writable" && error.code === "voice_error" && action === "append_text" && actionFromType === "replace_draft" && text === "hello world" && voiceMessage === true,
			capabilityType: String(capability.type || ""),
			actions: Array.isArray(capability.actions) ? capability.actions : [],
			startType: String(start.type || ""),
			insertCode: String(insert.code || ""),
			errorCode: String(error.code || ""),
			action,
			actionFromType,
			text,
			voiceMessage
		};
	}
	if (id === "api-client") {
		function FakeFormData() {}
		const formData = new FakeFormData();
		const isFormData = functionReady(api, "isFormDataBody") ? api.isFormDataBody(formData, FakeFormData) : false;
		const jsonBody = functionReady(api, "isFormDataBody") ? api.isFormDataBody({ ok: true }, FakeFormData) : true;
		const client = functionReady(api, "createApiClient") ? api.createApiClient({
			fetch: () => Promise.resolve({
				ok: true,
				status: 204
			}),
			AbortControllerCtor: AbortController,
			FormDataCtor: FakeFormData,
			getKey: () => ""
		}) : null;
		return {
			ok: isFormData === true && jsonBody === false && client && typeof client.request === "function",
			isFormData,
			jsonBody,
			requestReady: Boolean(client && typeof client.request === "function")
		};
	}
	if (id === "markdown-renderer") {
		const escaped = functionReady(api, "escapeHtml") ? api.escapeHtml("<tag>&\"") : "";
		const safeUrl = functionReady(api, "safeMarkdownUrl") ? api.safeMarkdownUrl("https://example.com") : "";
		const unsafeUrl = functionReady(api, "safeMarkdownUrl") ? api.safeMarkdownUrl("javascript:alert(1)") : "unsafe";
		const inline = functionReady(api, "renderInlineMarkdown") ? api.renderInlineMarkdown("**bold** <https://example.com>, `code`") : "";
		const block = functionReady(api, "renderMarkdown") ? api.renderMarkdown("# Title\n\n- item\n- **bold**") : "";
		const tableSeparator = functionReady(api, "isMarkdownTableSeparator") ? api.isMarkdownTableSeparator("|---|:---:|") : false;
		const row = functionReady(api, "splitMarkdownTableRow") ? api.splitMarkdownTableRow("| A | B |") : [];
		const list = functionReady(api, "renderMarkdownList") ? api.renderMarkdownList(["1. one", "2. two"], true) : "";
		const table = functionReady(api, "renderMarkdownTable") ? api.renderMarkdownTable([
			"A | B",
			"---|---",
			"1 | 2"
		]) : "";
		return {
			ok: escaped === "&lt;tag&gt;&amp;&quot;" && safeUrl === "https://example.com" && unsafeUrl === "" && inline.includes("<strong>bold</strong>") && inline.includes("<code>code</code>") && block.includes("<h2>Title</h2>") && tableSeparator === true && Array.isArray(row) && row.join(",") === "A,B" && list.includes("<ol>") && table.includes("<table>"),
			escaped,
			safeUrl,
			unsafeUrl,
			row,
			inlineHasStrong: inline.includes("<strong>bold</strong>"),
			blockHasHeading: block.includes("<h2>Title</h2>"),
			listHasOl: list.includes("<ol>"),
			tableHasTable: table.includes("<table>")
		};
	}
	if (id === "plugin-embed") {
		const detected = functionReady(api, "detect") ? api.detect("http://127.0.0.1/?embed=hermes&pluginId=codex-mobile&pluginRoute=thread&pluginThreadId=t1&pluginTheme=dark&pluginFontSize=large") : {};
		const navigation = functionReady(api, "navigationMessage") ? api.navigationMessage({ currentThreadId: "t1" }, {}) : {};
		const openPlan = functionReady(api, "routeHintOpenPlan") ? api.routeHintOpenPlan({
			pluginId: "codex-mobile",
			threadId: "t1",
			itemId: "i1"
		}) : {};
		const selectors = functionReady(api, "routeHintTargetSelectors") ? api.routeHintTargetSelectors({ itemId: "i1" }) : [];
		const scrubbed = functionReady(api, "scrubRouteHintPath") ? api.scrubRouteHintPath("http://127.0.0.1/thread?pluginId=codex-mobile&pluginThreadId=t1", {
			workspaceId: "ws1",
			appearance: { theme: "dark" }
		}) : "";
		const external = functionReady(api, "externalLinkMessage") ? api.externalLinkMessage({ href: "https://example.com/a" }) : {};
		const refresh = functionReady(api, "refreshRequiredMessage") ? api.refreshRequiredMessage({
			reason: "version_changed",
			route: {
				kind: "thread",
				threadId: "t1"
			},
			appearance: { theme: "light" }
		}) : {};
		return {
			ok: detected.embedded === true && detected.routeHint && detected.routeHint.threadId === "t1" && detected.appearance && detected.appearance.theme === "dark" && navigation.type === "codex-mobile.plugin.navigation" && navigation.canGoBack === true && openPlan.action === "openThread" && Array.isArray(selectors) && selectors[0] === "[data-approval-card=\"i1\"]" && scrubbed === "/thread?embed=hermes&workspaceId=ws1&pluginTheme=dark" && external.type === "codex-mobile.plugin.external_link" && refresh.type === "codex-mobile.plugin.refresh_required",
			embedded: Boolean(detected.embedded),
			routeThreadId: String(detected.routeHint && detected.routeHint.threadId || ""),
			navigationType: String(navigation.type || ""),
			canGoBack: Boolean(navigation.canGoBack),
			openAction: String(openPlan.action || ""),
			firstSelector: String(selectors[0] || ""),
			scrubbed,
			externalType: String(external.type || ""),
			refreshType: String(refresh.type || "")
		};
	}
	if (id === "frontend-runtime-health") {
		const token = functionReady(api, "compactToken") ? api.compactToken(" Home AI / Thread Detail ", "fallback", 20) : "";
		const missingEffects = functionReady(api, "submittedMessageDomProbeEffects") ? api.submittedMessageDomProbeEffects({
			elapsedMs: 300,
			currentThreadMatch: true,
			hasThreadSubmission: true,
			domHasSubmission: false,
			threadHash: "abc"
		}) : {};
		const stallEffects = functionReady(api, "threadListInteractionStallEffects") ? api.threadListInteractionStallEffects({
			threadListVisible: true,
			threadListMonitorable: true,
			maxRafDelayMs: 640,
			minDelayMs: 500
		}) : {};
		const monitor = functionReady(api, "createMonitor") ? api.createMonitor({ now: () => 1e3 }) : null;
		const monitorResult = monitor && typeof monitor.recordRender === "function" ? monitor.recordRender({
			fullRender: false,
			fallbackApplied: false,
			previousCount: 2,
			domCount: 2,
			visibleCount: 2,
			duplicateCount: 0
		}) : {};
		const dropEvent = functionReady(api, "domDropEvent") ? api.domDropEvent({
			previousCount: 3,
			domCount: 1,
			visibleCount: 3
		}) : {};
		const success = functionReady(api, "runtimeSuccess") ? api.runtimeSuccess({
			diagnosticType: "render_dom_drop",
			errorCode: "render_dom_drop"
		}) : {};
		return {
			ok: token === "Home_AI_Thread_Detai" && missingEffects.reason === "submitted-message-dom-missing" && Array.isArray(missingEffects.effects) && missingEffects.effects[0] && missingEffects.effects[0].type === "diagnostic-failure" && stallEffects.reason === "thread-list-interaction-stall" && monitorResult.renderCount === 1 && Array.isArray(monitorResult.effects) && monitorResult.effects.length === 2 && dropEvent.diagnostic_type === "render_dom_drop" && success.error_code === "render_dom_drop",
			token,
			missingReason: String(missingEffects.reason || ""),
			stallReason: String(stallEffects.reason || ""),
			monitorRenderCount: Number(monitorResult.renderCount) || 0,
			dropDiagnosticType: String(dropEvent.diagnostic_type || ""),
			successErrorCode: String(success.error_code || "")
		};
	}
	if (id === "home-ai-diagnostic-reporting") {
		const token = functionReady(api, "boundedToken") ? api.boundedToken(" Home AI / Codex Mobile ", "fallback", 16) : "";
		const duration = functionReady(api, "durationBucket") ? api.durationBucket(4200) : "";
		const hash = functionReady(api, "hashIdentifier") ? api.hashIdentifier("thread-title", "t") : "";
		const sanitized = functionReady(api, "sanitizeInput") ? api.sanitizeInput({
			diagnostic_type: "render_lag",
			error_code: "lag",
			counts: {
				ok_count: 3,
				raw_body: 4
			},
			context: {
				thread_hash: "abc",
				title: "unsafe"
			}
		}) : {};
		const reporter = functionReady(api, "createDiagnosticReporter") ? api.createDiagnosticReporter({
			threshold: 2,
			throttleMs: 0,
			now: () => 1e3
		}) : null;
		const first = reporter && typeof reporter.recordFailure === "function" ? reporter.recordFailure({
			diagnostic_type: "render_lag",
			error_code: "lag"
		}) : {};
		const second = reporter && typeof reporter.recordFailure === "function" ? reporter.recordFailure({
			diagnostic_type: "render_lag",
			error_code: "lag"
		}) : {};
		const post = functionReady(api, "postReportToHomeAi") ? api.postReportToHomeAi({
			embedded: false,
			report: second.report
		}) : {};
		const textHash = functionReady(api, "stableTextHash") ? api.stableTextHash("diagnostic") : "";
		return {
			ok: token === "Home_AI_Codex_Mo" && duration === "3_10s" && /^t_/.test(hash) && sanitized.category === "codex_runtime_failure" && sanitized.counts && sanitized.counts.ok_count === 3 && !Object.prototype.hasOwnProperty.call(sanitized.counts || {}, "raw_body") && first.eligible === false && second.eligible === true && post.reason === "not_embedded" && textHash.length > 0,
			token,
			duration,
			hashPrefix: String(hash || "").slice(0, 2),
			sanitizedCategory: String(sanitized.category || ""),
			secondEligible: Boolean(second.eligible),
			postReason: String(post.reason || ""),
			textHash
		};
	}
	if (id === "thread-diagnostic-events") {
		const snapshot = functionReady(api, "conversationProjectionDiagnosticSnapshot") ? api.conversationProjectionDiagnosticSnapshot({
			renderedConversationSignature: "old",
			currentSignature: "new",
			domShape: {
				renderKeyCount: 1,
				duplicateRenderKeyCount: 1
			},
			thread: { mobileReadMode: "thread-read" }
		}, { visibleShape: () => ({
			visibleTurnCount: 2,
			visibleItemCount: 3
		}) }) : {};
		const order = functionReady(api, "turnOrderDiagnosticSnapshot") ? api.turnOrderDiagnosticSnapshot({
			expectedTurnIds: ["a", "b"],
			domTurnIds: ["a"],
			threadHash: "thread"
		}) : {};
		const effects = functionReady(api, "conversationProjectionConsistencyEffects") ? api.conversationProjectionConsistencyEffects({
			snapshot,
			orderSnapshot: order
		}) : {};
		const renderEvent = functionReady(api, "renderSignatureMismatchDiagnosticEvent") ? api.renderSignatureMismatchDiagnosticEvent(snapshot) : {};
		const responseEffects = functionReady(api, "threadDetailResponseDiagnosticEffects") ? api.threadDetailResponseDiagnosticEffects({ contractPlan: {
			shouldReport: true,
			reason: "contract",
			turns: 2,
			items: 3,
			visibleItems: 3,
			readMode: "thread-read"
		} }) : {};
		const normalized = functionReady(api, "projectionDiagnosticSnapshot") ? api.projectionDiagnosticSnapshot(snapshot) : {};
		const count = functionReady(api, "boundedCount") ? api.boundedCount(100001) : 0;
		const token = functionReady(api, "compactToken") ? api.compactToken(" Detail / Render ", "fallback", 20) : "";
		return {
			ok: snapshot.renderedSignature === "old" && normalized.counts && normalized.counts.visible_count === 3 && order.counts && order.counts.latest_mismatch_count === 1 && Array.isArray(effects.effects) && effects.effects.length === 3 && renderEvent.diagnostic_type === "render_signature_mismatch" && Array.isArray(responseEffects.effects) && responseEffects.effects[0] && responseEffects.effects[0].type === "diagnostic-failure" && count === 1e5 && token === "Detail_Render",
			renderedSignature: String(snapshot.renderedSignature || ""),
			visibleCount: Number(normalized.counts && normalized.counts.visible_count) || 0,
			latestMismatch: Number(order.counts && order.counts.latest_mismatch_count) || 0,
			effectCount: Array.isArray(effects.effects) ? effects.effects.length : 0,
			renderDiagnosticType: String(renderEvent.diagnostic_type || ""),
			responseEffectCount: Array.isArray(responseEffects.effects) ? responseEffects.effects.length : 0,
			count,
			token
		};
	}
	if (id === "thread-tile-layout") {
		const layout = functionReady(api, "layoutForViewport") ? api.layoutForViewport({
			enabled: true,
			viewportWidth: 1500,
			viewportHeight: 900,
			sidebarWidth: 0,
			coarsePointer: true,
			orientation: "landscape",
			menuOverlay: true
		}) : null;
		const ids = functionReady(api, "selectThreadTileIds") ? api.selectThreadTileIds({
			currentThreadId: "thread-2",
			pinnedThreadIds: ["thread-3", "thread-2"],
			threadIds: [
				"thread-1",
				"thread-3",
				"thread-4"
			],
			maxPanes: 3
		}) : [];
		const pinnedIds = functionReady(api, "selectPinnedThreadTileIds") ? api.selectPinnedThreadTileIds({
			currentThreadId: "thread-current",
			pinnedThreadIds: [
				"thread-1",
				"thread-2",
				"thread-3"
			],
			threadIds: ["thread-current", "thread-4"],
			maxPanes: 3
		}) : [];
		const pairs = functionReady(api, "normalizeSplitPairs") ? api.normalizeSplitPairs([{
			anchorId: "b",
			childId: "e"
		}, {
			anchorId: "b",
			childId: "c"
		}], [
			"a",
			"b",
			"c",
			"d",
			"e"
		]) : [];
		const groups = functionReady(api, "threadTileColumnGroups") ? api.threadTileColumnGroups({
			ids: [
				"a",
				"b",
				"c",
				"d",
				"e"
			],
			columns: 4,
			splitPairs: [{
				anchorId: "b",
				childId: "e"
			}]
		}) : [];
		return {
			ok: !!layout && layout.enabled === true && layout.columns === 4 && ids.join(",") === "thread-2,thread-3,thread-1" && pinnedIds.join(",") === "thread-1,thread-2,thread-current" && pairs.length === 1 && pairs[0].anchorId === "b" && pairs[0].childId === "e" && JSON.stringify(groups) === JSON.stringify([
				["a"],
				["b", "e"],
				["c"],
				["d"]
			]),
			layout,
			ids,
			pinnedIds,
			pairs,
			groups
		};
	}
	if (id === "thread-tile-actions") {
		const paneA = {
			disabled: false,
			getAttribute(name) {
				return name === "data-thread-tile-pane" ? "thread-a" : "";
			},
			closest() {
				return null;
			}
		};
		const paneB = {
			disabled: false,
			getAttribute(name) {
				return name === "data-thread-tile-pane" ? "thread-b" : "";
			},
			closest() {
				return null;
			}
		};
		const title = {
			disabled: false,
			getAttribute(name) {
				return name === "data-thread-tile-title" ? "thread-a" : "";
			},
			closest(selector) {
				return selector === "[data-thread-tile-pane]" ? paneA : null;
			}
		};
		const handle = {
			disabled: false,
			getAttribute(name) {
				return name === "data-thread-tile-drag-handle" ? "thread-a" : "";
			},
			closest(selector) {
				return selector === "[data-thread-tile-pane]" ? paneA : null;
			}
		};
		const bottom = {
			disabled: false,
			getAttribute(name) {
				return name === "data-thread-tile-bottom" ? "thread-a" : "";
			},
			closest() {
				return null;
			}
		};
		const root = { contains(node) {
			return node === paneA || node === paneB || node === title || node === handle || node === bottom;
		} };
		const titleTarget = { closest(selector) {
			return selector === "[data-thread-tile-title]" ? title : selector === "[data-thread-tile-pane]" ? paneA : null;
		} };
		const bottomTarget = { closest(selector) {
			return selector === "[data-thread-tile-bottom]" ? bottom : null;
		} };
		const handleTarget = { closest(selector) {
			return selector === "[data-thread-tile-drag-handle]" ? handle : null;
		} };
		const paneBTarget = { closest(selector) {
			return selector === "[data-thread-tile-pane]" ? paneB : null;
		} };
		const pointer = functionReady(api, "resolveThreadTilePointerAction") ? api.resolveThreadTilePointerAction({
			root,
			target: titleTarget
		}) : {};
		const click = functionReady(api, "resolveThreadTileClickAction") ? api.resolveThreadTileClickAction({
			root,
			target: bottomTarget
		}) : {};
		const dragStart = functionReady(api, "resolveThreadTileDragStartAction") ? api.resolveThreadTileDragStartAction({
			root,
			target: handleTarget
		}) : {};
		const drop = functionReady(api, "resolveThreadTileDropAction") ? api.resolveThreadTileDropAction({
			root,
			target: paneBTarget,
			draggingId: "thread-a"
		}) : {};
		return {
			ok: pointer.action === "select-pane" && pointer.paneId === "thread-a" && click.action === "scroll-pane-bottom" && click.preventDefault === true && dragStart.action === "drag-start" && dragStart.paneId === "thread-a" && drop.action === "drop-pane" && drop.draggingId === "thread-a" && drop.targetId === "thread-b",
			pointerAction: String(pointer.action || ""),
			clickAction: String(click.action || ""),
			dragStartAction: String(dragStart.action || ""),
			dropAction: String(drop.action || "")
		};
	}
	if (id === "thread-tile-state") {
		const candidate = functionReady(api, "candidatePaneIdsPlan") ? api.candidatePaneIdsPlan({
			defaultIds: ["thread-a", "thread-b"],
			visibleIds: ["thread-a", "thread-b"],
			pinnedIds: ["thread-b"],
			currentThreadId: "thread-a",
			maxPanes: 2
		}) : {};
		const paneCount = functionReady(api, "normalizePaneCount") ? api.normalizePaneCount("3", { maxPanes: 12 }) : 0;
		const refreshDelay = functionReady(api, "refreshDelayMs") ? api.refreshDelayMs({
			visible: true,
			active: true
		}) : 0;
		const loadSuccess = functionReady(api, "detailLoadSuccessEffectsPlan") ? api.detailLoadSuccessEffectsPlan({
			threadId: "thread-a",
			hasThread: true,
			nowMs: 1234
		}) : {};
		const selected = functionReady(api, "effectiveSelectedThreadId") ? api.effectiveSelectedThreadId({
			ids: ["thread-a", "thread-b"],
			selectedThreadId: "thread-a",
			currentThreadId: "thread-b"
		}) : "";
		return {
			ok: candidate.action === "candidate-pane-ids" && candidate.ids && candidate.ids.join(",") === "thread-b,thread-a" && paneCount === 3 && refreshDelay === 500 && loadSuccess.reason === "thread-loaded" && loadSuccess.loadedAtMs === 1234 && selected === "thread-a",
			candidateIds: Array.isArray(candidate.ids) ? candidate.ids : [],
			paneCount,
			refreshDelay,
			loadSuccessReason: String(loadSuccess.reason || ""),
			selected
		};
	}
	if (id === "thread-tile-runtime") {
		const statePolicy = globalThis.CodexThreadTileState || {};
		const layoutPolicy = globalThis.CodexThreadTileLayout || {};
		const actionsApi = globalThis.CodexThreadTileActions || {};
		const runtime = functionReady(api, "createThreadTileRuntime") ? api.createThreadTileRuntime({
			state: {
				threadTileMode: true,
				threadTilePaneCount: "3",
				threadTilePinnedThreadIds: [
					"thread-b",
					"thread-a",
					"thread-b"
				],
				threadTileSplitPairs: [{
					anchorId: "thread-a",
					childId: "thread-c"
				}],
				threads: [
					{
						id: "thread-a",
						status: "running"
					},
					{
						id: "thread-b",
						status: "idle"
					},
					{
						id: "thread-c",
						status: "idle"
					}
				],
				currentThreadId: "thread-b",
				threadDisplaySettingsLoaded: true,
				threadTileViewportBaseline: null,
				threadTileComposerHeightBaselinePx: 0,
				composerHeightPx: 0
			},
			document: {
				documentElement: {
					clientWidth: 1400,
					clientHeight: 900
				},
				activeElement: null
			},
			window: {
				innerWidth: 1400,
				innerHeight: 900,
				visualViewport: {
					width: 1320,
					height: 820
				},
				matchMedia: () => ({ matches: false })
			},
			threadTileStatePolicy: statePolicy,
			threadTileLayoutPolicy: layoutPolicy,
			threadTileActionsApi: actionsApi,
			THREAD_TILE_USER_MAX_PANES: 6,
			THREAD_TILE_REFRESH_INTERVAL_MS: 5e3,
			THREAD_TILE_REFRESH_MIN_INTERVAL_MS: 500,
			STORAGE_THREAD_DISPLAY_MODE: "codex.threadDisplayMode",
			STORAGE_LEGACY_THREAD_TILE_MODE: "codex.legacyThreadTileMode",
			$: () => null,
			isKeyboardEditableElement: () => false,
			splitPaneSidebarVisible: () => false,
			isMenuOverlayMode: () => false,
			visibleThreads: (threads) => Array.isArray(threads) ? threads : [],
			isRunningStatus: (status) => status === "running" || status === "in_progress"
		}) : {};
		const viewport = runtime && typeof runtime.viewportPixelSize === "function" ? runtime.viewportPixelSize({ preferLayoutViewport: true }) : {};
		const paneCount = runtime && typeof runtime.normalizeThreadTilePaneCount === "function" ? runtime.normalizeThreadTilePaneCount("3", 1) : 0;
		const pinnedIds = runtime && typeof runtime.normalizeThreadTilePinnedIds === "function" ? runtime.normalizeThreadTilePinnedIds([
			"thread-b",
			"thread-a",
			"thread-b"
		]) : [];
		const idsEqual = runtime && typeof runtime.threadTileIdsEqual === "function" ? runtime.threadTileIdsEqual(["thread-a", "thread-b"], ["thread-a", "thread-b"]) : false;
		const payload = runtime && typeof runtime.threadDisplaySettingsPayload === "function" ? runtime.threadDisplaySettingsPayload() : {};
		const layout = runtime && typeof runtime.threadTileLayout === "function" ? runtime.threadTileLayout({ enabled: true }) : {};
		const status = runtime && typeof runtime.threadTileLayoutStatusText === "function" ? runtime.threadTileLayoutStatusText(layout) : "";
		return {
			ok: runtime && typeof runtime === "object" && viewport.width === 1400 && viewport.height === 900 && paneCount === 3 && pinnedIds.join(",") === "thread-b,thread-a" && idsEqual === true && payload.displayMode === "tile" && payload.paneCount === 3 && layout.enabled === true && status === "当前视口：平铺 3/3 窗",
			factoryType: typeof api.createThreadTileRuntime,
			viewportWidth: Number(viewport.width) || 0,
			viewportHeight: Number(viewport.height) || 0,
			paneCount,
			pinnedIds,
			idsEqual,
			displayMode: String(payload.displayMode || ""),
			layoutColumns: Number(layout.columns) || 0,
			status
		};
	}
	if (id === "app-update-runtime") {
		const runtime = functionReady(api, "createAppUpdateRuntime") ? api.createAppUpdateRuntime({
			CLIENT_BUILD_ID: "0.1.11|codex-mobile-shell-v625-a5a3d596240d",
			state: {
				appVersion: "0.1.11",
				publicReleaseEnabled: true
			},
			PAGE_SHELL_ASSETS: ["/app.js", "/sw.js"],
			escapeHtml: (value) => String(value == null ? "" : value),
			buildRefreshPolicy: { shouldPromptForServerBuildChange: () => true }
		}) : null;
		const client = runtime && typeof runtime.clientBuildVersionText === "function" ? runtime.clientBuildVersionText() : "";
		const version = runtime && typeof runtime.appVersionText === "function" ? runtime.appVersionText({ version: "0.1.11" }) : "";
		const updateLine = runtime && typeof runtime.updateStatusLine === "function" ? runtime.updateStatusLine({
			updateAvailable: true,
			canFastForward: true,
			remoteShort: "abc123"
		}) : "";
		const publicLine = runtime && typeof runtime.publicReleaseStatusLine === "function" ? runtime.publicReleaseStatusLine({
			updateAvailable: true,
			publicShort: "def456"
		}) : "";
		const serverBuild = runtime && typeof runtime.serverBuildIdFromConfig === "function" ? runtime.serverBuildIdFromConfig({
			clientBuildId: "client-a",
			shellCacheName: "cache-a"
		}) : "";
		return {
			ok: runtime && typeof runtime.refreshPageForNewBuild === "function" && client === "客户端 v625" && version === "v0.1.11 · 客户端 v625" && updateLine === "Update available: abc123" && publicLine === "Public latest: def456" && serverBuild === "client-a",
			client,
			version,
			updateLine,
			publicLine,
			serverBuild,
			refreshReady: Boolean(runtime && typeof runtime.refreshPageForNewBuild === "function")
		};
	}
	if (id === "modal-runtime") {
		const runtime = functionReady(api, "createModalRuntime") ? api.createModalRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.requestAppNativeDialog === "function" && typeof runtime.requestAppAlert === "function" && typeof runtime.requestAppConfirmation === "function" && typeof runtime.requestAppTextInput === "function" && typeof runtime.requestCodexProfileSwitchConfirmation === "function" && typeof globalThis.handleAppNativeDialogKeydown === "function" && typeof globalThis.closeAppNativeDialog === "function" && typeof globalThis.performCodexProfileSwitch === "function",
			factoryType: typeof api.createModalRuntime,
			nativeDialogType: typeof (runtime && runtime.requestAppNativeDialog),
			alertType: typeof (runtime && runtime.requestAppAlert),
			confirmationType: typeof (runtime && runtime.requestAppConfirmation),
			textInputType: typeof (runtime && runtime.requestAppTextInput),
			profileSwitchType: typeof (runtime && runtime.requestCodexProfileSwitchConfirmation),
			keydownType: typeof globalThis.handleAppNativeDialogKeydown,
			closeType: typeof globalThis.closeAppNativeDialog,
			switchType: typeof globalThis.performCodexProfileSwitch
		};
	}
	if (id === "runtime-wiring-runtime") {
		const runtime = functionReady(api, "createRuntimeWiringRuntime") ? api.createRuntimeWiringRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.initialize === "function",
			factoryType: typeof api.createRuntimeWiringRuntime,
			initializeType: typeof (runtime && runtime.initialize),
			globalType: typeof globalThis.CodexRuntimeWiringRuntime
		};
	}
	if (id === "app-shell-runtime") {
		const runtime = functionReady(api, "createAppShellRuntime") ? api.createAppShellRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.wireUi === "function" && typeof runtime.start === "function" && typeof runtime.startCodexMobileAppWithRecovery === "function",
			factoryType: typeof api.createAppShellRuntime,
			wireUiType: typeof (runtime && runtime.wireUi),
			startType: typeof (runtime && runtime.start),
			recoveryType: typeof (runtime && runtime.startCodexMobileAppWithRecovery),
			globalType: typeof globalThis.CodexAppShellRuntime
		};
	}
	if (id === "thread-list-runtime") {
		const runtime = functionReady(api, "createThreadListRuntime") ? api.createThreadListRuntime({}) : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.renderThreads === "function" && typeof runtime.loadThreads === "function",
			factoryType: typeof api.createThreadListRuntime,
			renderThreadsType: typeof (runtime && runtime.renderThreads),
			loadThreadsType: typeof (runtime && runtime.loadThreads)
		};
	}
	if (id === "side-chat-runtime") {
		const state = {
			currentThreadId: "thread-a",
			currentThread: { id: "thread-a" },
			threadSideChats: /* @__PURE__ */ new Map(),
			nowMs: Date.parse("2026-07-02T00:00:00Z")
		};
		const runtime = functionReady(api, "createSideChatRuntime") ? api.createSideChatRuntime({
			state,
			api: async () => ({ sideChat: null }),
			escapeHtml: (value) => String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
			statusText: (status) => String(status || ""),
			formatTime: () => "now",
			truncateMiddle: (value) => String(value || "")
		}) : {};
		const normalized = runtime && typeof runtime.normalizeSideChatState === "function" ? runtime.normalizeSideChatState({
			messages: [{
				role: "assistant",
				text: "hi"
			}],
			sidecar: { status: "pending" }
		}, "thread-a") : {};
		if (runtime && typeof runtime.setSideChatState === "function") runtime.setSideChatState("thread-a", normalized);
		const path = runtime && typeof runtime.sideChatApiPath === "function" ? runtime.sideChatApiPath("thread-a", "/draft") : "";
		const status = runtime && typeof runtime.sideChatStatusLabel === "function" ? runtime.sideChatStatusLabel("queued") : "";
		const queue = runtime && typeof runtime.sideChatQueueSummary === "function" ? runtime.sideChatQueueSummary({
			status: "queued",
			mode: "autoSendWhenIdle"
		}) : "";
		const pending = runtime && typeof runtime.sideChatReplyPending === "function" ? runtime.sideChatReplyPending("thread-a") : false;
		const subagentKind = runtime && typeof runtime.subagentStatusKind === "function" ? runtime.subagentStatusKind("running") : "";
		const subagentLabel = runtime && typeof runtime.subagentStatusLabel === "function" ? runtime.subagentStatusLabel("running") : "";
		const panel = runtime && typeof runtime.renderSideChatPanel === "function" ? runtime.renderSideChatPanel() : "";
		return {
			ok: runtime && typeof runtime === "object" && normalized.threadId === "thread-a" && Array.isArray(normalized.messages) && normalized.messages.length === 1 && path === "/api/threads/thread-a/side-chat/draft" && status === "已排队" && queue === "已排队 · 完成后自动发送" && pending === true && subagentKind === "running" && subagentLabel === "运行中" && String(panel || "").includes("side-chat-section"),
			factoryType: typeof api.createSideChatRuntime,
			normalizedThreadId: String(normalized.threadId || ""),
			messageCount: Array.isArray(normalized.messages) ? normalized.messages.length : 0,
			path,
			status,
			queue,
			pending,
			subagentKind,
			subagentLabel,
			panelReady: String(panel || "").includes("side-chat-section")
		};
	}
	if (id === "media-preview-runtime") {
		const element = {
			classList: {
				contains: () => false,
				add: () => {},
				remove: () => {},
				toggle: () => {}
			},
			dataset: {},
			style: {
				setProperty: () => {},
				removeProperty: () => {}
			},
			querySelector: () => null,
			querySelectorAll: () => [],
			closest: () => null,
			addEventListener: () => {},
			removeEventListener: () => {},
			appendChild: () => {},
			setAttribute: () => {},
			getAttribute: () => "",
			removeAttribute: () => {},
			textContent: "",
			innerText: id === "messageInput" ? "hello" : "",
			innerHTML: ""
		};
		const document = {
			documentElement: {
				getAttribute: () => "light",
				setAttribute: () => {}
			},
			head: element,
			createElement: () => Object.assign({}, element),
			getElementById: () => Object.assign({}, element),
			querySelector: () => null,
			querySelectorAll: () => []
		};
		const runtime = functionReady(api, "createMediaPreviewRuntime") ? api.createMediaPreviewRuntime({
			state: {
				key: "sample-key",
				currentThreadId: "thread-a",
				currentThread: { id: "thread-a" }
			},
			document,
			window: {
				location: {
					origin: "http://127.0.0.1:8787",
					pathname: "/"
				},
				CodexMarkdownRenderer: {
					renderMarkdown: (value) => `<p>${String(value == null ? "" : value)}</p>`,
					normalizeMermaidSourceForRender: (value) => String(value || "")
				},
				matchMedia: () => ({ matches: true }),
				setTimeout: (callback) => {
					if (typeof callback === "function") callback();
					return 1;
				},
				clearTimeout: () => {}
			},
			$: () => Object.assign({}, element),
			api: async () => ({}),
			escapeHtml: (value) => String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
			normalizeFsPath: (value) => String(value || ""),
			shortPath: (value) => String(value || "").split("/").pop() || "",
			compactStructuredForSignature: (value) => JSON.stringify(value),
			visibleThreadTaskCardCommandText: (value) => String(value || ""),
			rememberCopyText: (value) => String(value || ""),
			copyButtonHtml: () => "<button></button>",
			stableTextHash: (value) => `hash:${String(value || "").length}`,
			renderContextThreadId: () => "thread-a",
			publishPluginNavigationState: () => {},
			postPerformanceEvent: () => {},
			roundedDurationMs: () => 1,
			nowPerfMs: () => 1,
			isHermesEmbedMode: () => false,
			isIosWebKitBrowser: () => false,
			requestHermesPluginRefresh: () => {},
			primaryTouch: (event) => event && event.touches && event.touches[0] || null
		}) : {};
		const githubUrl = runtime && typeof runtime.normalizeGithubPreviewUrl === "function" ? runtime.normalizeGithubPreviewUrl("https://github.com/openai/codex/pull/7") : "";
		const jsonPreview = runtime && typeof runtime.renderFilePreviewContent === "function" ? runtime.renderFilePreviewContent({
			kind: "json",
			content: "{\"ok\":true}"
		}) : "";
		return {
			ok: runtime && typeof runtime === "object" && githubUrl === "https://github.com/openai/codex/pull/7" && String(jsonPreview || "").includes("file-preview-text") && typeof runtime.renderMarkdownWithAttachmentSummary === "function" && typeof runtime.openImagePreviewFromImage === "function" && typeof runtime.renderImageView === "function" && typeof runtime.scheduleVisibleImageFailureScan === "function",
			factoryType: typeof api.createMediaPreviewRuntime,
			githubUrl,
			jsonPreviewReady: String(jsonPreview || "").includes("file-preview-text"),
			markdownType: typeof (runtime && runtime.renderMarkdownWithAttachmentSummary),
			imagePreviewType: typeof (runtime && runtime.openImagePreviewFromImage),
			imageViewType: typeof (runtime && runtime.renderImageView),
			scanType: typeof (runtime && runtime.scheduleVisibleImageFailureScan)
		};
	}
	if (id === "composer-runtime") {
		const elements = /* @__PURE__ */ new Map();
		const element = (id = "") => ({
			id,
			value: id === "messageInput" ? "hello" : "",
			files: [],
			classList: {
				contains: () => false,
				add: () => {},
				remove: () => {},
				toggle: () => {}
			},
			dataset: {},
			style: {
				setProperty: () => {},
				removeProperty: () => {}
			},
			getBoundingClientRect: () => ({
				width: 120,
				height: 32,
				left: 0,
				top: 0,
				right: 120,
				bottom: 32
			}),
			focus: () => {},
			blur: () => {},
			select: () => {},
			setSelectionRange: () => {},
			querySelector: () => null,
			querySelectorAll: () => [],
			closest: () => null,
			addEventListener: () => {},
			removeEventListener: () => {},
			appendChild: () => {},
			setAttribute: () => {},
			getAttribute: () => "",
			removeAttribute: () => {},
			textContent: "",
			innerHTML: ""
		});
		function getElement(id) {
			if (!elements.has(id)) elements.set(id, element(id));
			return elements.get(id);
		}
		const runtime = functionReady(api, "createComposerRuntime") ? api.createComposerRuntime({
			state: {
				threads: [],
				pendingAttachments: [],
				composerRuntimeSelection: {},
				codexProfiles: [],
				currentThreadId: "thread-a",
				currentThread: { id: "thread-a" },
				newThreadDraft: false
			},
			document: {
				documentElement: { style: {
					setProperty: () => {},
					removeProperty: () => {}
				} },
				activeElement: null,
				addEventListener: () => {},
				removeEventListener: () => {},
				createElement: () => element(),
				getElementById: getElement,
				querySelector: () => null,
				querySelectorAll: () => []
			},
			window: {
				setTimeout: (callback) => {
					if (typeof callback === "function") callback();
					return 1;
				},
				clearTimeout: () => {},
				requestAnimationFrame: (callback) => {
					if (typeof callback === "function") callback();
					return 1;
				},
				crypto: { randomUUID: () => "sample-uuid" },
				visualViewport: {
					width: 390,
					height: 700
				},
				innerWidth: 390,
				innerHeight: 700
			},
			$: getElement,
			api: async () => ({}),
			escapeHtml: (value) => String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
			viewportMetrics: {
				cssPixel: (value) => Math.round(Number(value) || 0),
				stablePixelChanged: (left, right) => Math.abs((Number(left) || 0) - (Number(right) || 0)) >= 2
			},
			normalizeOptionList: (values) => Array.isArray(values) ? values.filter(Boolean).map((value) => String(value).trim()) : [],
			labelForModel: (value) => `Model ${String(value || "")}`.trim(),
			labelForEffort: (value) => `Effort ${String(value || "")}`.trim(),
			labelForPermissionMode: (value) => `Permission ${String(value || "")}`.trim(),
			defaultNewThreadModel: () => "gpt-5.5",
			defaultNewThreadEffort: () => "medium",
			defaultNewThreadPermissionMode: () => "auto",
			effectiveComposerPermissionMode: (value) => String(value || "").trim() || "auto",
			newThreadSelectedModel: () => "",
			newThreadSelectedEffort: () => "",
			newThreadSelectedPermissionMode: () => "",
			currentComposerThreadId: () => "thread-a",
			composerTargetThread: () => ({
				id: "thread-a",
				model: "gpt-5.5",
				effort: "medium",
				runtimeSettings: { permissionMode: "auto" }
			}),
			selectedQuotaModel: () => "gpt-5.5",
			threadDisplayName: () => "Thread A",
			isThreadTileComposerContext: () => false,
			isAndroidBrowser: () => false,
			isHermesEmbedMode: () => false,
			isKeyboardEditableElement: () => false,
			threadTileStatePolicy: { composerTargetPlaceholderPlan: () => ({ text: "Send to Thread A" }) },
			imageCompressor: {},
			homeAiDiagnosticReportingApi: {}
		}) : {};
		const model = runtime && typeof runtime.effectiveDefaultModel === "function" ? runtime.effectiveDefaultModel() : "";
		const effort = runtime && typeof runtime.effectiveDefaultEffort === "function" ? runtime.effectiveDefaultEffort() : "";
		const permission = runtime && typeof runtime.effectiveDefaultPermissionMode === "function" ? runtime.effectiveDefaultPermissionMode() : "";
		const label = runtime && typeof runtime.runtimeOptionLabel === "function" ? runtime.runtimeOptionLabel("model", "gpt-5.5") : "";
		const placeholder = runtime && typeof runtime.composerPlaceholderText === "function" ? runtime.composerPlaceholderText() : "";
		return {
			ok: runtime && typeof runtime === "object" && model === "gpt-5.5" && effort === "medium" && permission === "auto" && label === "Model gpt-5.5" && placeholder === "Send to Thread A" && typeof runtime.sendMessage === "function" && typeof runtime.sendNewThreadMessage === "function" && typeof runtime.interruptActiveTurn === "function",
			factoryType: typeof api.createComposerRuntime,
			model,
			effort,
			permission,
			label,
			placeholder,
			sendType: typeof (runtime && runtime.sendMessage),
			newThreadType: typeof (runtime && runtime.sendNewThreadMessage),
			interruptType: typeof (runtime && runtime.interruptActiveTurn)
		};
	}
	if (id === "composer-bridge-runtime") {
		const runtime = functionReady(api, "createComposerBridgeRuntime") ? api.createComposerBridgeRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.sendMessage === "function" && typeof runtime.sendNewThreadMessage === "function" && typeof runtime.answerServerRequest === "function" && typeof runtime.answerApproval === "function" && typeof runtime.declineServerRequest === "function" && typeof runtime.mutateThreadTaskCard === "function" && typeof runtime.replyTaskCard === "function" && typeof runtime.queueThreadTaskCardDraftCreation === "function" && typeof runtime.createThreadTaskCardDraft === "function" && typeof globalThis.sendMessage === "function" && typeof globalThis.answerApproval === "function" && typeof globalThis.mutateThreadTaskCard === "function" && typeof globalThis.queueThreadTaskCardDraftCreation === "function",
			factoryType: typeof api.createComposerBridgeRuntime,
			sendType: typeof (runtime && runtime.sendMessage),
			answerType: typeof (runtime && runtime.answerServerRequest),
			approvalType: typeof (runtime && runtime.answerApproval),
			mutateType: typeof (runtime && runtime.mutateThreadTaskCard),
			replyType: typeof (runtime && runtime.replyTaskCard),
			draftType: typeof (runtime && runtime.createThreadTaskCardDraft),
			globalSendType: typeof globalThis.sendMessage,
			globalApprovalType: typeof globalThis.answerApproval,
			globalMutateType: typeof globalThis.mutateThreadTaskCard,
			globalDraftQueueType: typeof globalThis.queueThreadTaskCardDraftCreation
		};
	}
	if (id === "api-client-runtime") {
		const runtime = functionReady(api, "createApiClientRuntime") ? api.createApiClientRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.api === "function" && typeof runtime.postClientEvent === "function" && typeof runtime.postPerformanceEvent === "function" && typeof runtime.recordHomeAiDiagnosticFailure === "function" && typeof runtime.recordHomeAiDiagnosticSuccess === "function" && typeof runtime.scheduleSubmittedMessageDomProbe === "function" && typeof runtime.checkConversationProjectionConsistency === "function" && typeof runtime.handlePushButtonClick === "function" && typeof globalThis.api === "function" && typeof globalThis.postClientEvent === "function" && typeof globalThis.diagnosticThreadHash === "function" && typeof globalThis.recordHomeAiDiagnosticFailure === "function" && typeof globalThis.scheduleSubmittedMessageDomProbe === "function" && typeof globalThis.checkConversationProjectionConsistency === "function" && typeof globalThis.handlePushButtonClick === "function",
			factoryType: typeof api.createApiClientRuntime,
			apiType: typeof (runtime && runtime.api),
			clientEventType: typeof (runtime && runtime.postClientEvent),
			performanceType: typeof (runtime && runtime.postPerformanceEvent),
			diagnosticFailureType: typeof (runtime && runtime.recordHomeAiDiagnosticFailure),
			diagnosticSuccessType: typeof (runtime && runtime.recordHomeAiDiagnosticSuccess),
			submittedProbeType: typeof (runtime && runtime.scheduleSubmittedMessageDomProbe),
			projectionCheckType: typeof (runtime && runtime.checkConversationProjectionConsistency),
			pushType: typeof (runtime && runtime.handlePushButtonClick),
			globalApiType: typeof globalThis.api,
			globalClientEventType: typeof globalThis.postClientEvent,
			globalThreadHashType: typeof globalThis.diagnosticThreadHash,
			globalSubmittedProbeType: typeof globalThis.scheduleSubmittedMessageDomProbe,
			globalProjectionCheckType: typeof globalThis.checkConversationProjectionConsistency,
			globalPushType: typeof globalThis.handlePushButtonClick
		};
	}
	if (id === "thread-list-load-policy") {
		const plan = functionReady(api, "planThreadListLoadRequest") ? api.planThreadListLoadRequest({
			silent: true,
			threadDetailOpening: true,
			deferFallback: true
		}) : {};
		return {
			ok: plan && plan.action === "thread-list-load-request" && plan.shouldLoad === false && plan.skipReason === "detail-in-flight" && plan.retryDelayMs === 700,
			action: String(plan && plan.action || ""),
			shouldLoad: Boolean(plan && plan.shouldLoad),
			skipReason: String(plan && plan.skipReason || ""),
			retryDelayMs: Number(plan && plan.retryDelayMs) || 0
		};
	}
	if (id === "thread-list-stable-order") {
		const scopeKey = functionReady(api, "threadListOrderScopeKey") ? api.threadListOrderScopeKey({
			selectedCwd: "/tmp/project",
			search: "Home"
		}) : "";
		const plan = functionReady(api, "planThreadListStableOrder") ? api.planThreadListStableOrder({
			threads: [
				{ id: "b" },
				{ id: "a" },
				{ id: "c" }
			],
			previousState: {
				scopeKey,
				holdUntilMs: 2e3,
				order: ["a", "b"]
			},
			scopeKey,
			nowMs: 1e3,
			holdMs: 5e3
		}) : {};
		const order = Array.isArray(plan.order) ? plan.order : [];
		return {
			ok: scopeKey === JSON.stringify({
				cwd: "/tmp/project",
				search: "home"
			}) && plan.held === true && order.join(",") === "a,b,c",
			scopeKey,
			held: Boolean(plan.held),
			order
		};
	}
	if (id === "thread-status-hints") {
		const running = functionReady(api, "isRunningStatus") ? api.isRunningStatus("in_progress") : false;
		const unread = functionReady(api, "shouldMarkThreadUnread") ? api.shouldMarkThreadUnread({
			threadId: "target-thread",
			currentThreadId: "other-thread",
			status: "completed",
			thread: { turns: [{
				status: "completed",
				completedAtMs: 2e3
			}] },
			viewedAtMs: 1e3
		}) : false;
		const expire = functionReady(api, "shouldExpireRunningThreadHint") ? api.shouldExpireRunningThreadHint({
			threadId: "target-thread",
			isRunningHinted: true,
			status: "idle",
			runningHintedAtMs: 0,
			runningHintStaleMs: 1e3,
			nowMs: 5e3,
			thread: {}
		}) : false;
		return {
			ok: running === true && unread === true && expire === true,
			running,
			unread,
			expire
		};
	}
	if (id === "thread-detail-patch-plan") {
		const surface = functionReady(api, "planThreadDetailDomPatchSurface") ? api.planThreadDetailDomPatchSurface({
			threadId: "thread-a",
			conversationPresent: true
		}) : {};
		const visiblePatch = functionReady(api, "planVisibleItemRefreshPatch") ? api.planVisibleItemRefreshPatch([{
			key: "a",
			signature: "1"
		}], [{
			key: "a",
			signature: "1"
		}, {
			key: "b",
			signature: "2"
		}]) : {};
		const turnPatch = functionReady(api, "planThreadDetailRefreshDomPatch") ? api.planThreadDetailRefreshDomPatch([{
			key: "turn-a",
			hasPreviousTurn: true,
			itemPatchable: true,
			articlePresent: true
		}]) : {};
		const visibleOperations = Array.isArray(visiblePatch.operations) ? visiblePatch.operations : [];
		const turnOperations = Array.isArray(turnPatch.operations) ? turnPatch.operations : [];
		return {
			ok: surface.canPatch === true && surface.reason === "single-thread-surface" && visiblePatch.canPatch === true && visibleOperations.map((entry) => entry.type).join(",") === "reuse,insert" && turnPatch.canPatch === true && turnOperations.length === 1 && turnOperations[0].type === "item-patch",
			surfaceReason: String(surface.reason || ""),
			visibleOperationCount: visibleOperations.length,
			turnOperationType: String(turnOperations[0] && turnOperations[0].type || "")
		};
	}
	if (id === "thread-detail-actions") {
		const node = (dataset) => ({
			dataset,
			closest(selector) {
				if (selector === "[data-thread-tile-pane]") return { dataset: { threadTilePane: "thread-pane" } };
				return null;
			}
		});
		const copyNode = node({ copyKey: "copy-1" });
		const approvalNode = node({
			approvalId: "ap-1",
			approvalThreadId: "thread-ap",
			approvalAction: "allow_once"
		});
		const responseNode = node({
			serverRequestId: "req-1",
			serverRequestThreadId: "thread-req",
			serverResponseText: "yes",
			serverQuestionId: "answer"
		});
		const rich = functionReady(api, "resolveRichContentClickAction") ? api.resolveRichContentClickAction({ target: { closest(selector) {
			return selector === "[data-copy-key]" ? copyNode : null;
		} } }) : {};
		const approval = functionReady(api, "resolveThreadDetailClickAction") ? api.resolveThreadDetailClickAction({ target: { closest(selector) {
			return selector === "[data-approval-action]" ? approvalNode : null;
		} } }) : {};
		const response = functionReady(api, "resolveThreadDetailClickAction") ? api.resolveThreadDetailClickAction({ target: { closest(selector) {
			return selector === "[data-server-response-text]" ? responseNode : null;
		} } }) : {};
		const contextThreadId = functionReady(api, "contextThreadIdFromNode") ? api.contextThreadIdFromNode(copyNode) : "";
		return {
			ok: rich.action === "copy" && rich.preventDefault === true && rich.stopPropagation === true && approval.action === "approval-answer" && approval.approvalAction === "allow_once" && approval.threadId === "thread-ap" && response.action === "server-response" && response.responseText === "yes" && contextThreadId === "thread-pane",
			richAction: String(rich.action || ""),
			approvalAction: String(approval.action || ""),
			approvalValue: String(approval.approvalAction || ""),
			responseAction: String(response.action || ""),
			contextThreadId
		};
	}
	if (id === "thread-detail-merge-state") {
		const policy = functionReady(api, "createThreadDetailMergePolicy") ? api.createThreadDetailMergePolicy({
			sortTurnsForDisplay: (turns) => Array.isArray(turns) ? turns.slice().sort((left, right) => String(left && left.id || "").localeCompare(String(right && right.id || ""))) : [],
			turnVisibleWeight: (turn) => JSON.stringify(turn && turn.items || []).length,
			mergeItemsPreservingLocalVisible: (existingItems, incomingItems, preserveLocalVisible) => preserveLocalVisible ? existingItems : incomingItems
		}) : {};
		const merged = policy && typeof policy.mergeThreadPreservingVisibleItems === "function" ? policy.mergeThreadPreservingVisibleItems({
			id: "thread-a",
			turns: [{
				id: "b",
				items: [{
					type: "assistantMessage",
					text: "full receipt"
				}]
			}]
		}, {
			id: "thread-a",
			turns: [{
				id: "b",
				items: []
			}, {
				id: "a",
				items: [{
					type: "userMessage",
					text: "hello"
				}]
			}]
		}) : {};
		const turns = Array.isArray(merged && merged.turns) ? merged.turns : [];
		const preserved = turns.find((turn) => turn && turn.id === "b");
		return {
			ok: turns.map((turn) => String(turn && turn.id || "")).join(",") === "a,b" && Array.isArray(preserved && preserved.items) && preserved.items.length === 1 && preserved.items[0].text === "full receipt",
			turnOrder: turns.map((turn) => String(turn && turn.id || "")),
			preservedItemCount: Array.isArray(preserved && preserved.items) ? preserved.items.length : 0
		};
	}
	if (id === "thread-detail-v4-merge-state") {
		const policy = functionReady(api, "createThreadDetailV4MergePolicy") ? api.createThreadDetailV4MergePolicy({
			normalizeThreadVisibleUserMessages: (thread) => thread,
			turnVisibleWeight: (turn) => Array.isArray(turn && turn.items) ? turn.items.length : 0,
			isOptimisticUserMessage: (item) => Boolean(item && item.mobilePendingSubmission),
			isRecentlySubmittedUserMessage: (item) => Boolean(item && item.mobilePendingSubmission),
			isReasoningItem: (item) => String(item && item.type || "") === "reasoning",
			userMessagesCanShadow: () => false,
			isTurnComplete: (turn) => /completed|failed|cancel|interrupted/i.test(String(turn && (turn.status && turn.status.type || turn.status) || "")),
			isRunningStatus: (status) => /running|active|inprogress|in_progress/i.test(String(status && status.type || status || "")),
			isIncompleteInterruptedTurn: () => false,
			turnHasActiveLiveItems: () => false,
			turnOrderMs: (turn) => Number(turn && turn.startedAtMs) || 0,
			sortTurnsForDisplay: (turns) => Array.isArray(turns) ? turns.slice().sort((left, right) => (Number(left && left.startedAtMs) || 0) - (Number(right && right.startedAtMs) || 0)) : [],
			maxVisibleTurnsForThread: () => 5
		}) : {};
		const merged = policy && typeof policy.mergeV4ProjectionThread === "function" ? policy.mergeV4ProjectionThread({
			id: "thread-a",
			mobileProjectionRevision: 3,
			turns: [{
				id: "active",
				startedAtMs: 100,
				status: "running",
				items: [{
					type: "agentMessage",
					text: "streaming"
				}]
			}]
		}, {
			id: "thread-a",
			mobileProjectionRevision: 2,
			turns: [{
				id: "new",
				startedAtMs: 50,
				status: "completed",
				items: [{
					type: "userMessage",
					text: "prompt"
				}]
			}]
		}) : {};
		const turns = Array.isArray(merged && merged.turns) ? merged.turns : [];
		return {
			ok: typeof policy.mergeV4ProjectionThread === "function" && typeof policy.v4ProjectionRevisionValue === "function" && policy.v4ProjectionRevisionValue(merged) === 3 && turns.map((turn) => String(turn && turn.id || "")).join(",") === "new,active",
			revision: policy && typeof policy.v4ProjectionRevisionValue === "function" ? policy.v4ProjectionRevisionValue(merged) : 0,
			turnOrder: turns.map((turn) => String(turn && turn.id || ""))
		};
	}
	if (id === "thread-detail-runtime") {
		const statePolicy = {
			completedIncomingTurnHasAuthoritativeReceipt: () => false,
			shouldDropLocalOnlyReceiptForIncomingTurn: () => false,
			shouldPreserveLocalOnlyItem: () => false,
			shouldPreserveExistingTurnVisibleItems: () => false
		};
		const runtime = functionReady(api, "createThreadDetailRuntime") ? api.createThreadDetailRuntime({
			threadDetailStateApi: {
				createThreadDetailStatePolicy: () => statePolicy,
				threadListSummaryFromDetailThread: () => ({}),
				planThreadOpenCacheReuse: () => ({ action: "skip" }),
				threadHasReusableLoadedDetailState: () => false
			},
			threadDetailMergeStateApi: { createThreadDetailMergePolicy: () => ({ mergeThreadPreservingVisibleItems: (existingThread, incomingThread) => incomingThread || existingThread }) },
			threadDetailV4MergeStateApi: { createThreadDetailV4MergePolicy: () => ({
				isV4ProjectionThread: () => false,
				mergeV4ProjectionThread: (existingThread, incomingThread) => incomingThread || existingThread
			}) },
			statusText: (status) => String(status && status.type || status || ""),
			isLiveTurn: (turn) => /active|running/i.test(String(turn && (turn.status && turn.status.type || turn.status) || "")),
			isLatestTurn: (turn, thread) => Array.isArray(thread && thread.turns) && thread.turns.at(-1) === turn,
			isReasoningItem: (item) => String(item && item.type || "") === "reasoning",
			isOperationalItem: (item) => String(item && item.type || "") === "commandExecution",
			isContextCompactionItem: () => false,
			isTurnComplete: (turn) => /completed|failed|cancel|interrupted/i.test(String(turn && (turn.status && turn.status.type || turn.status) || "")),
			isRunningStatus: (status) => /active|running|queued|processing/i.test(String(status && status.type || status || "")),
			sortTurnsForDisplay: (turns) => Array.isArray(turns) ? turns : []
		}) : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.visibleItemsForTurn === "function" && typeof runtime.mergeThreadPreservingVisibleItems === "function" && typeof runtime.normalizeThreadVisibleUserMessages === "function" && typeof runtime.threadUserMessageEntries === "function" && typeof runtime.turnOrderMs === "function" && typeof runtime.turnIsSupersededBy === "function" && typeof globalThis.CodexThreadDetailRuntime === "object" && typeof globalThis.CodexThreadDetailRuntime.createThreadDetailRuntime === "function",
			factoryType: typeof api.createThreadDetailRuntime,
			visibleItemsType: typeof (runtime && runtime.visibleItemsForTurn),
			mergeType: typeof (runtime && runtime.mergeThreadPreservingVisibleItems),
			normalizeType: typeof (runtime && runtime.normalizeThreadVisibleUserMessages),
			turnOrderType: typeof (runtime && runtime.turnOrderMs),
			globalFactoryType: typeof (globalThis.CodexThreadDetailRuntime && globalThis.CodexThreadDetailRuntime.createThreadDetailRuntime)
		};
	}
	if (id === "task-card-runtime") {
		const runtime = functionReady(api, "createTaskCardRuntime") ? api.createTaskCardRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.renderThreadTaskCard === "function" && typeof runtime.renderThreadTaskCards === "function" && typeof runtime.createThreadTaskCardFromCurrent === "function" && typeof runtime.renderApprovalRequest === "function" && typeof globalThis.CodexTaskCardRuntime === "object" && typeof globalThis.CodexTaskCardRuntime.createTaskCardRuntime === "function" && typeof globalThis.threadTaskCardCommandText === "function" && typeof globalThis.renderThreadTaskCards === "function" && typeof globalThis.renderApprovalRequest === "function",
			factoryType: typeof api.createTaskCardRuntime,
			renderType: typeof (runtime && runtime.renderThreadTaskCard),
			renderListType: typeof (runtime && runtime.renderThreadTaskCards),
			createType: typeof (runtime && runtime.createThreadTaskCardFromCurrent),
			approvalType: typeof (runtime && runtime.renderApprovalRequest),
			globalCommandType: typeof globalThis.threadTaskCardCommandText,
			globalRenderType: typeof globalThis.renderThreadTaskCards
		};
	}
	if (id === "settings-runtime") {
		const runtime = functionReady(api, "createSettingsRuntime") ? api.createSettingsRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.renderFontSizeControl === "function" && typeof runtime.renderQuotaUsage === "function" && typeof runtime.renderCodexProfileSettings === "function" && typeof runtime.renderWorkspaceDelegationSettings === "function" && typeof runtime.rememberRateLimitsFromConfig === "function" && typeof runtime.rememberCodexProfiles === "function" && typeof globalThis.CodexSettingsRuntime === "object" && typeof globalThis.CodexSettingsRuntime.createSettingsRuntime === "function",
			factoryType: typeof api.createSettingsRuntime,
			fontSizeType: typeof (runtime && runtime.renderFontSizeControl),
			quotaType: typeof (runtime && runtime.renderQuotaUsage),
			profileType: typeof (runtime && runtime.renderCodexProfileSettings),
			workspaceDelegationType: typeof (runtime && runtime.renderWorkspaceDelegationSettings),
			rateLimitsType: typeof (runtime && runtime.rememberRateLimitsFromConfig),
			profilesType: typeof (runtime && runtime.rememberCodexProfiles),
			globalFactoryType: typeof (globalThis.CodexSettingsRuntime && globalThis.CodexSettingsRuntime.createSettingsRuntime)
		};
	}
	if (id === "app-entry") {
		const runtime = functionReady(api, "createCodexMobileAppEntry") ? api.createCodexMobileAppEntry() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.startCodexMobileApp === "function" && typeof api.startCodexMobileApp === "function" && typeof globalThis.CodexMobileAppEntry === "object" && typeof globalThis.CodexMobileAppEntry.createCodexMobileAppEntry === "function" && typeof globalThis.CodexMobileAppEntry.startCodexMobileApp === "function",
			factoryType: typeof api.createCodexMobileAppEntry,
			startType: typeof api.startCodexMobileApp,
			runtimeStartType: typeof (runtime && runtime.startCodexMobileApp),
			globalFactoryType: typeof (globalThis.CodexMobileAppEntry && globalThis.CodexMobileAppEntry.createCodexMobileAppEntry),
			globalStartType: typeof (globalThis.CodexMobileAppEntry && globalThis.CodexMobileAppEntry.startCodexMobileApp)
		};
	}
	if (id === "notification-ui-runtime") {
		const runtime = functionReady(api, "createNotificationUiRuntime") ? api.createNotificationUiRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.showApp === "function" && typeof runtime.showLogin === "function" && typeof runtime.bootstrap === "function" && typeof runtime.requestHermesPluginRefresh === "function" && typeof runtime.handlePluginVoiceInputMessage === "function" && typeof globalThis.CodexNotificationUiRuntime === "object" && typeof globalThis.CodexNotificationUiRuntime.createNotificationUiRuntime === "function" && typeof globalThis.showApp === "function" && typeof globalThis.showLogin === "function" && typeof globalThis.bootstrap === "function" && typeof globalThis.sortTurnsForDisplay === "function",
			factoryType: typeof api.createNotificationUiRuntime,
			showAppType: typeof (runtime && runtime.showApp),
			showLoginType: typeof (runtime && runtime.showLogin),
			bootstrapType: typeof (runtime && runtime.bootstrap),
			refreshType: typeof (runtime && runtime.requestHermesPluginRefresh),
			globalBootstrapType: typeof globalThis.bootstrap,
			globalSortType: typeof globalThis.sortTurnsForDisplay
		};
	}
	if (id === "conversation-render-runtime") {
		const runtime = functionReady(api, "createConversationRenderRuntime") ? api.createConversationRenderRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.renderTurn === "function" && typeof runtime.renderItem === "function" && typeof runtime.renderItemBody === "function" && typeof runtime.renderUserMessageBody === "function" && typeof runtime.renderLiveOperationDock === "function" && typeof runtime.ensureTurn === "function" && typeof runtime.shouldDeferLiveFinalReceipt === "function" && typeof globalThis.CodexConversationRenderRuntime === "object" && typeof globalThis.CodexConversationRenderRuntime.createConversationRenderRuntime === "function" && typeof globalThis.renderTurn === "function" && typeof globalThis.renderItem === "function" && typeof globalThis.renderLiveOperationDock === "function" && typeof globalThis.ensureTurn === "function" && typeof globalThis.shouldDeferLiveFinalReceipt === "function" && typeof globalThis.imageUrlValue === "function" && typeof globalThis.renderMarkdownWithAttachmentSummary === "function" && typeof globalThis.renderFilePreviewContent === "function" && typeof globalThis.closeImagePreview === "function",
			factoryType: typeof api.createConversationRenderRuntime,
			renderTurnType: typeof (runtime && runtime.renderTurn),
			renderItemType: typeof (runtime && runtime.renderItem),
			liveDockType: typeof (runtime && runtime.renderLiveOperationDock),
			ensureTurnType: typeof (runtime && runtime.ensureTurn),
			globalRenderType: typeof globalThis.renderTurn,
			globalEnsureTurnType: typeof globalThis.ensureTurn,
			globalImageUrlType: typeof globalThis.imageUrlValue
		};
	}
	if (id === "event-stream-runtime") {
		const runtime = functionReady(api, "createEventStreamRuntime") ? api.createEventStreamRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.connectEvents === "function" && typeof runtime.applyNotification === "function" && typeof runtime.resumeMobileSession === "function" && typeof runtime.scrollConversationToBottom === "function" && typeof runtime.updateScrollToBottomButton === "function" && typeof globalThis.CodexEventStreamRuntime === "object" && typeof globalThis.CodexEventStreamRuntime.createEventStreamRuntime === "function" && typeof globalThis.upsertItem === "function" && typeof globalThis.connectEvents === "function" && typeof globalThis.ensureEventConnection === "function" && typeof globalThis.resumeMobileSession === "function" && typeof globalThis.followThreadOpenToBottom === "function" && typeof globalThis.scheduleBottomFollowScroll === "function" && typeof globalThis.updateScrollToBottomButton === "function",
			factoryType: typeof api.createEventStreamRuntime,
			connectType: typeof (runtime && runtime.connectEvents),
			notificationType: typeof (runtime && runtime.applyNotification),
			resumeType: typeof (runtime && runtime.resumeMobileSession),
			scrollType: typeof (runtime && runtime.scrollConversationToBottom),
			globalConnectType: typeof globalThis.connectEvents,
			globalFollowType: typeof globalThis.followThreadOpenToBottom
		};
	}
	if (id === "client-render-stability-guard") {
		const sourceTurn = {
			id: "local-turn-secret",
			items: [{
				type: "userMessage",
				clientSubmissionId: "submission-secret",
				mobilePendingSubmission: true
			}]
		};
		const targetTurn = {
			id: "server-turn-a",
			items: [{
				type: "userMessage",
				clientSubmissionId: "submission-secret"
			}]
		};
		const sourceKey = functionReady(api, "markSubmittedTurn") ? api.markSubmittedTurn(sourceTurn, "submission-secret") : "";
		const transferredKey = functionReady(api, "transferSubmittedTurnIdentity") ? api.transferSubmittedTurnIdentity(sourceTurn, targetTurn, "submission-secret") : "";
		const sourceIdentity = functionReady(api, "stableTurnIdentity") ? api.stableTurnIdentity(sourceTurn) : "";
		const targetIdentity = functionReady(api, "stableTurnIdentity") ? api.stableTurnIdentity(targetTurn) : "";
		return {
			ok: Boolean(sourceKey) && sourceKey === transferredKey && sourceIdentity === sourceKey && targetIdentity === sourceKey && !String(sourceKey).includes("submission-secret"),
			sourceKey: String(sourceKey || ""),
			transferredKey: String(transferredKey || ""),
			sourceIdentity: String(sourceIdentity || ""),
			targetIdentity: String(targetIdentity || "")
		};
	}
	if (id === "live-operation-dock-state") {
		const card = functionReady(api, "operationCardContentPlan") ? api.operationCardContentPlan({
			itemId: "op-a",
			type: "tool",
			status: "running",
			title: "Run",
			detail: "working",
			durationText: "1s"
		}) : {};
		const preserve = functionReady(api, "compactBubblePreservation") ? api.compactBubblePreservation({
			nextHtml: "",
			liveTurnActive: true,
			visibleUntilMs: 2e3,
			nowMs: 1e3,
			savedThreadId: "thread-a",
			currentThreadId: "thread-a",
			savedHtml: "<div class=\"mobile-operation-bubble\"></div>",
			dockHasBubble: false
		}) : {};
		const recall = functionReady(api, "shouldShowRecall") ? api.shouldShowRecall({
			isMobile: true,
			hasCurrentThread: true,
			newThreadDraft: false,
			liveTurnActive: true,
			recallThreadId: "thread-a",
			currentThreadId: "thread-a",
			recallHtml: "<div class=\"mobile-operation-sheet\"></div>"
		}) : false;
		const classTokens = Array.isArray(card.classTokens) ? card.classTokens : [];
		return {
			ok: card.detail === "working" && classTokens.includes("live-operation") && preserve.preserve === true && preserve.patchSavedHtml === true && recall === true,
			detail: String(card.detail || ""),
			preserve: Boolean(preserve.preserve),
			recall
		};
	}
	return { ok: false };
}
function codexMobileViteEsmCompatibility() {
	const modules = moduleDefinitions.map((definition) => {
		const api = moduleApis[definition.id] && typeof moduleApis[definition.id] === "object" ? moduleApis[definition.id] : {};
		const expectedFunctions = Array.isArray(definition.expectedFunctions) ? definition.expectedFunctions : [];
		const exportedFunctions = expectedFunctions.filter((name) => functionReady(api, name));
		const sample = sampleModule(definition.id, api);
		const globalPublished = publishClassicGlobal(definition, api);
		return {
			id: definition.id,
			source: definition.source,
			assetPath: definition.assetPath,
			globalName: definition.globalName,
			classicLoaderExcluded: definition.classicLoaderExcluded === true,
			expectedFunctions: expectedFunctions.slice(),
			exportedFunctions,
			sample,
			globalPublished,
			ready: exportedFunctions.length === expectedFunctions.length && sample.ok === true && (definition.classicLoaderExcluded !== true || globalPublished === true)
		};
	});
	return {
		schemaVersion: 1,
		owner: "vite-shell-entry",
		moduleCount: modules.length,
		readyCount: modules.filter((entry) => entry.ready === true).length,
		modules
	};
}
var codexMobileViteEsmCompatibilityModules = moduleDefinitions;
//#endregion
export { codexMobileViteEsmCompatibility, codexMobileViteEsmCompatibility as default, codexMobileViteEsmCompatibilityModules };
