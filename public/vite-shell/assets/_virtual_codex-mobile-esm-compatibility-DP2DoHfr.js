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
//#endregion
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
//#region public/plugin-voice-input.js
var require_plugin_voice_input = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory(root || {});
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexPluginVoiceInput = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function(root) {
		const PLUGIN_ID = "codex-mobile";
		const VERSION = 1;
		const MAX_TEXT_CHARS = 12e3;
		const TYPES = Object.freeze({
			CAPABILITY_QUERY: "voice_input.capability_query",
			CAPABILITY_STATE: "voice_input.capability_state",
			INSERT_TEXT: "voice_input.insert_text",
			APPEND_TEXT: "voice_input.append_text",
			REPLACE_DRAFT: "voice_input.replace_draft",
			PROVISIONAL_TEXT: "voice_input.provisional_text",
			SUBMIT: "voice_input.submit",
			START_REQUEST: "voice_input.start_request",
			STOP_REQUEST: "voice_input.stop_request",
			CANCEL_REQUEST: "voice_input.cancel_request",
			INSERT_RESULT: "voice_input.insert_result",
			COMMIT_RESULT: "voice_input.commit_result",
			ERROR: "voice_input.error"
		});
		const ACTION_TYPES = Object.freeze({
			insert_text: TYPES.INSERT_TEXT,
			append_text: TYPES.APPEND_TEXT,
			replace_draft: TYPES.REPLACE_DRAFT,
			provisional_text: TYPES.PROVISIONAL_TEXT,
			submit: TYPES.SUBMIT
		});
		const ACTIONS_BY_TYPE = Object.freeze(Object.fromEntries(Object.entries(ACTION_TYPES).map(([action, type]) => [type, action])));
		function stringValue(value) {
			return String(value || "").trim();
		}
		function boundedString(value, maxLength) {
			const text = stringValue(value);
			const limit = Math.max(0, Number(maxLength) || 0);
			return text ? text.slice(0, limit) : "";
		}
		function boundedText(value, maxLength = MAX_TEXT_CHARS) {
			const text = String(value || "").replace(/\u00a0/g, " ");
			const limit = Math.max(1, Number(maxLength) || MAX_TEXT_CHARS);
			return text.slice(0, limit);
		}
		function normalizeAction(action) {
			const value = stringValue(action).toLowerCase();
			if (value === "append") return "append_text";
			if (value === "insert") return "insert_text";
			if (value === "replace") return "replace_draft";
			if (value === "provisional") return "provisional_text";
			return ACTION_TYPES[value] ? value : "";
		}
		function normalizeActions(actions) {
			const normalized = (Array.isArray(actions) ? actions : actions && typeof actions === "object" ? Object.keys(actions).filter((key) => actions[key]) : []).map(normalizeAction).filter(Boolean);
			return [...new Set(normalized)];
		}
		function requestIdFrom(payload = {}) {
			return boundedString(payload.requestId || payload.request_id, 160);
		}
		function voiceSessionIdFrom(payload = {}) {
			return boundedString(payload.voiceSessionId || payload.voice_session_id, 160);
		}
		function pluginIdFrom(payload = {}) {
			return boundedString(payload.pluginId || payload.plugin_id || PLUGIN_ID, 80) || PLUGIN_ID;
		}
		function baseMessage(type, input = {}) {
			const message = {
				type,
				version: VERSION,
				pluginId: pluginIdFrom(input)
			};
			const requestId = requestIdFrom(input);
			const voiceSessionId = voiceSessionIdFrom(input);
			if (requestId) message.requestId = requestId;
			if (voiceSessionId) message.voiceSessionId = voiceSessionId;
			return message;
		}
		function capabilityStateMessage(input = {}) {
			const actions = normalizeActions(input.actions).filter((action) => action !== "submit");
			const composerId = boundedString(input.composerId || input.composer_id || "thread-composer", 120) || "thread-composer";
			const threadId = boundedString(input.threadId || input.thread_id, 160);
			const draftId = boundedString(input.draftId || input.draft_id, 220);
			const maxChars = Math.max(1, Math.min(Number(input.maxChars || input.max_chars || MAX_TEXT_CHARS) || MAX_TEXT_CHARS, MAX_TEXT_CHARS));
			const message = Object.assign(baseMessage(TYPES.CAPABILITY_STATE, input), {
				writable: Boolean(input.writable || input.composerWritable),
				composerId,
				threadId,
				draftId,
				maxChars,
				actions: actions.length ? actions : ["append_text", "replace_draft"]
			});
			message.composer = {
				writable: message.writable,
				composerId,
				threadId,
				draftId,
				maxChars
			};
			return message;
		}
		function startRequestMessage(input = {}) {
			const capability = capabilityStateMessage(input.capability || input);
			return Object.assign(baseMessage(TYPES.START_REQUEST, input), {
				composerId: capability.composerId,
				threadId: capability.threadId,
				draftId: capability.draftId,
				writable: capability.writable,
				maxChars: capability.maxChars,
				actions: capability.actions,
				capability
			});
		}
		function stopRequestMessage(input = {}) {
			return Object.assign(baseMessage(TYPES.STOP_REQUEST, input), {
				composerId: boundedString(input.composerId || input.composer_id || "thread-composer", 120) || "thread-composer",
				threadId: boundedString(input.threadId || input.thread_id, 160)
			});
		}
		function cancelRequestMessage(input = {}) {
			return Object.assign(baseMessage(TYPES.CANCEL_REQUEST, input), {
				composerId: boundedString(input.composerId || input.composer_id || "thread-composer", 120) || "thread-composer",
				threadId: boundedString(input.threadId || input.thread_id, 160)
			});
		}
		function insertResultMessage(input = {}) {
			return Object.assign(baseMessage(TYPES.INSERT_RESULT, input), {
				ok: input.ok !== false,
				action: boundedString(input.action || input.insertAction || input.insert_action, 40),
				code: input.ok === false ? boundedString(input.code || input.errorCode || input.error_code, 80) : "",
				composerId: boundedString(input.composerId || input.composer_id || "thread-composer", 120) || "thread-composer",
				draftId: boundedString(input.draftId || input.draft_id, 220),
				error: input.ok === false ? boundedString(input.error || input.message, 240) : ""
			});
		}
		function commitResultMessage(input = {}) {
			return Object.assign(baseMessage(TYPES.COMMIT_RESULT, input), {
				ok: input.ok !== false,
				action: boundedString(input.action || "submitted", 40) || "submitted",
				composerId: boundedString(input.composerId || input.composer_id || "thread-composer", 120) || "thread-composer",
				threadId: boundedString(input.threadId || input.thread_id, 160),
				messageId: boundedString(input.messageId || input.message_id, 180),
				finalText: boundedText(input.finalText || input.final_text || input.text, input.maxChars || MAX_TEXT_CHARS).trim()
			});
		}
		function errorMessage(input = {}) {
			return Object.assign(baseMessage(TYPES.ERROR, input), {
				code: boundedString(input.code || "plugin_voice_input_error", 80) || "plugin_voice_input_error",
				error: boundedString(input.error || input.message || "Plugin voice input error", 240),
				composerId: boundedString(input.composerId || input.composer_id || "thread-composer", 120) || "thread-composer"
			});
		}
		function isVoiceInputMessage(value) {
			return Boolean(value && typeof value === "object" && stringValue(value.type).startsWith("voice_input."));
		}
		function actionFromMessageType(type) {
			return ACTIONS_BY_TYPE[stringValue(type)] || "";
		}
		function textFromMessage(payload = {}, maxChars = MAX_TEXT_CHARS) {
			return boundedText(payload.text || payload.finalText || payload.final_text, maxChars).trim();
		}
		function postToParent(parentWindow, message, targetOrigin) {
			if (!parentWindow || parentWindow === root || !message) return false;
			parentWindow.postMessage(message, targetOrigin || "*");
			return true;
		}
		return {
			ACTION_TYPES,
			MAX_TEXT_CHARS,
			PLUGIN_ID,
			TYPES,
			VERSION,
			actionFromMessageType,
			boundedString,
			boundedText,
			cancelRequestMessage,
			capabilityStateMessage,
			commitResultMessage,
			errorMessage,
			insertResultMessage,
			isVoiceInputMessage,
			normalizeAction,
			normalizeActions,
			pluginIdFrom,
			postToParent,
			requestIdFrom,
			startRequestMessage,
			stopRequestMessage,
			textFromMessage,
			voiceSessionIdFrom
		};
	});
}));
//#endregion
//#region public/api-client.js
var require_api_client = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexApiClient = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		function isFormDataBody(body, FormDataCtor) {
			return typeof FormDataCtor === "function" && body instanceof FormDataCtor;
		}
		function createApiClient(options = {}) {
			const fetchRef = options.fetch || (typeof fetch === "function" ? fetch : null);
			const AbortControllerCtor = options.AbortControllerCtor || (typeof AbortController === "function" ? AbortController : null);
			const FormDataCtor = options.FormDataCtor || (typeof FormData === "function" ? FormData : null);
			const getKey = typeof options.getKey === "function" ? options.getKey : () => "";
			const onUnauthorized = typeof options.onUnauthorized === "function" ? options.onUnauthorized : () => {};
			const onResponseError = typeof options.onResponseError === "function" ? options.onResponseError : () => {};
			async function request(path, requestOptions = {}) {
				if (!fetchRef) throw new Error("Fetch is unavailable");
				if (!AbortControllerCtor) throw new Error("AbortController is unavailable");
				const headers = Object.assign({}, requestOptions.headers || {});
				const timeoutMs = requestOptions.timeoutMs || 3e4;
				const controller = new AbortControllerCtor();
				let timedOut = false;
				const timer = setTimeout(() => {
					timedOut = true;
					controller.abort();
				}, timeoutMs);
				const externalSignal = requestOptions.signal;
				const abortFromExternal = () => controller.abort();
				if (externalSignal) if (externalSignal.aborted) controller.abort();
				else externalSignal.addEventListener("abort", abortFromExternal, { once: true });
				const fetchOptions = Object.assign({}, requestOptions, {
					headers,
					signal: controller.signal
				});
				delete fetchOptions.timeoutMs;
				const key = getKey();
				if (key) headers["X-Codex-Mobile-Key"] = key;
				if (requestOptions.body && !isFormDataBody(requestOptions.body, FormDataCtor) && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
				try {
					const res = await fetchRef(path, fetchOptions);
					if (!res.ok) {
						let message = `${res.status} ${res.statusText}`;
						let code = "";
						let detail = "";
						let requestId = "";
						let progress = null;
						let responseBody = null;
						try {
							const body = await res.json();
							responseBody = body;
							if (body.error) message = body.error;
							if (body.code) code = String(body.code);
							if (body.detail) detail = String(body.detail);
							if (body.requestId) requestId = String(body.requestId);
							if (body.progress && typeof body.progress === "object") progress = body.progress;
						} catch (_) {}
						onResponseError({
							status: res.status,
							message,
							code,
							detail,
							requestId,
							path
						});
						if (res.status === 401) onUnauthorized();
						const err = new Error(message);
						err.status = res.status;
						err.code = code;
						err.detail = detail;
						err.requestId = requestId;
						err.progress = progress;
						err.responseBody = responseBody;
						throw err;
					}
					if (res.status === 204) return null;
					return res.json();
				} catch (err) {
					if (err && err.name === "AbortError") {
						if (timedOut) throw new Error(`Request timed out: ${path}`);
						throw new Error(`Request cancelled: ${path}`);
					}
					throw err;
				} finally {
					clearTimeout(timer);
					if (externalSignal) externalSignal.removeEventListener("abort", abortFromExternal);
				}
			}
			return { request };
		}
		return {
			createApiClient,
			isFormDataBody
		};
	});
}));
//#endregion
//#region public/markdown-renderer.js
var require_markdown_renderer = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexMarkdownRenderer = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		function escapeHtml(value) {
			return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
				"&": "&amp;",
				"<": "&lt;",
				">": "&gt;",
				"\"": "&quot;",
				"'": "&#39;"
			})[ch]);
		}
		function isMarkdownTableSeparator(line) {
			const cells = String(line || "").trim().replace(/^\||\|$/g, "").split("|");
			return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
		}
		function splitMarkdownTableRow(line) {
			return String(line || "").trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
		}
		function isMarkdownBlockStart(line, nextLine = "") {
			return /^```/.test(line) || /^(#{1,6})\s+\S/.test(line) || /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line) || /^>\s?/.test(line) || /^\s*[-*+]\s+\S/.test(line) || /^\s*\d+[.)]\s+\S/.test(line) || line.includes("|") && isMarkdownTableSeparator(nextLine);
		}
		function safeMarkdownUrl(value) {
			const url = String(value || "").trim();
			if (/^(https?:|mailto:)/i.test(url)) return url;
			return "";
		}
		function safeMarkdownImageUrl(value) {
			const url = String(value || "").trim();
			if (/^https?:/i.test(url)) return url;
			return safeMarkdownDataImageUrl(url);
		}
		function safeMarkdownDataImageUrl(value) {
			const url = String(value || "").trim();
			if (/^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i.test(url)) return url.replace(/\s+/g, "");
			return "";
		}
		function stripMarkdownLinkTarget(value) {
			const target = String(value || "").trim();
			if (target.startsWith("<") && target.endsWith(">")) return target.slice(1, -1).trim();
			return target;
		}
		function decodeMarkdownLinkTarget(value) {
			const target = stripMarkdownLinkTarget(value);
			if (/^file:\/\//i.test(target)) try {
				return decodeURIComponent(new URL(target).pathname);
			} catch (_) {
				return target.replace(/^file:\/\//i, "");
			}
			try {
				return decodeURIComponent(target);
			} catch (_) {
				return target;
			}
		}
		function isLocalFileTarget(value) {
			const target = stripMarkdownLinkTarget(value);
			return target.startsWith("/") || /^file:\/\//i.test(target) || /^[A-Za-z]:[\\/]/.test(target) || /^\\\\/.test(target);
		}
		function autolinkUrlParts(rawUrl) {
			let href = String(rawUrl || "");
			let suffix = "";
			while (/[.,;:!?]$/.test(href)) {
				suffix = href.slice(-1) + suffix;
				href = href.slice(0, -1);
			}
			while (href.endsWith(")") && href.split("(").length <= href.split(")").length) {
				suffix = ")" + suffix;
				href = href.slice(0, -1);
			}
			return {
				href,
				suffix
			};
		}
		function renderMarkdownLink(rawLabel, rawUrl) {
			const label = escapeHtml(rawLabel);
			const target = stripMarkdownLinkTarget(rawUrl);
			if (isLocalFileTarget(target)) return `<button class="local-file-preview-link" type="button" data-local-file-path="${escapeHtml(decodeMarkdownLinkTarget(target))}" data-local-file-label="${escapeHtml(rawLabel)}" title="预览查看这个文件">${label}</button>`;
			const safeUrl = safeMarkdownUrl(String(target || "").replaceAll("&amp;", "&"));
			if (!safeUrl) return null;
			return `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noreferrer">${label}</a>`;
		}
		function renderMarkdownImage(rawLabel, rawUrl) {
			const target = stripMarkdownLinkTarget(rawUrl);
			const safeUrl = safeMarkdownImageUrl(String(target || "").replaceAll("&amp;", "&"));
			if (!safeUrl) return null;
			return `<figure class="markdown-image"><img src="${escapeHtml(safeUrl)}" alt="Image" loading="lazy"></figure>`;
		}
		function renderAutolinkUrl(rawUrl) {
			const parts = autolinkUrlParts(rawUrl);
			const safeUrl = safeMarkdownUrl((parts.href.startsWith("www.") ? `https://${parts.href}` : parts.href).replaceAll("&amp;", "&"));
			if (!safeUrl) return rawUrl;
			return `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noreferrer">${parts.href}</a>${parts.suffix}`;
		}
		function renderAngleAutolink(rawUrl) {
			const safeUrl = safeMarkdownUrl(String(rawUrl || "").replaceAll("&amp;", "&"));
			if (!safeUrl) return null;
			return `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noreferrer">${escapeHtml(rawUrl)}</a>`;
		}
		function renderInlineMarkdown(value) {
			const placeholders = [];
			const tokenPrefix = "MDTOKEN";
			let text = String(value || "").replace(/`([^`\n]+)`/g, (_match, code) => {
				const token = `${tokenPrefix}${placeholders.length}END`;
				placeholders.push(`<code>${escapeHtml(code)}</code>`);
				return token;
			});
			text = text.replace(/!\[([^\]\n]*)\]\((<[^>\n]+>|[^)\s]+)\)/g, (match, label, url) => {
				const rendered = renderMarkdownImage(label, url);
				if (!rendered) return match;
				const token = `${tokenPrefix}${placeholders.length}END`;
				placeholders.push(rendered);
				return token;
			});
			text = text.replace(/\[([^\]\n]+)\]\((<[^>\n]+>|[^)\s]+)\)/g, (match, label, url) => {
				const rendered = renderMarkdownLink(label, url);
				if (!rendered) return match;
				const token = `${tokenPrefix}${placeholders.length}END`;
				placeholders.push(rendered);
				return token;
			});
			text = text.replace(/<((?:https?:\/\/|mailto:)[^<>\s]+)>/gi, (match, url) => {
				const rendered = renderAngleAutolink(url);
				if (!rendered) return match;
				const token = `${tokenPrefix}${placeholders.length}END`;
				placeholders.push(rendered);
				return token;
			});
			text = escapeHtml(text);
			text = text.replace(/(^|[\s([{"'“‘:：])((?:https?:\/\/|www\.)[^\s<]+)/gi, (_match, prefix, url) => `${prefix}${renderAutolinkUrl(url)}`);
			text = text.replace(/\*\*([^*\n][^*\n]*?)\*\*/g, "<strong>$1</strong>").replace(/__([^_\n][^_\n]*?)__/g, "<strong>$1</strong>").replace(/(^|[\s(])\*([^*\n][^*\n]*?)\*/g, "$1<em>$2</em>").replace(/(^|[\s(])_([^_\n][^_\n]*?)_/g, "$1<em>$2</em>");
			placeholders.forEach((html, index) => {
				text = text.replaceAll(`${tokenPrefix}${index}END`, html);
			});
			return text;
		}
		function renderMarkdownTable(lines) {
			const header = splitMarkdownTableRow(lines[0]);
			const rows = lines.slice(2).map(splitMarkdownTableRow);
			return `<div class="markdown-table-wrap"><table>
    <thead><tr>${header.map((cell) => `<th>${renderInlineMarkdown(cell)}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((row) => `<tr>${header.map((_cell, index) => `<td>${renderInlineMarkdown(row[index] || "")}</td>`).join("")}</tr>`).join("")}</tbody>
  </table></div>`;
		}
		function orderedListStart(lines, options) {
			const first = lines.map((line) => /^\s*(\d+)[.)]\s+/.exec(line)).filter(Boolean).map((match) => Number(match[1]) || 1)[0] || 1;
			if (options && options.orderedListMode === "source") return first;
			return lines.length <= 1 ? first : 1;
		}
		function renderMarkdownList(lines, ordered, options) {
			const tag = ordered ? "ol" : "ul";
			const itemPattern = ordered ? /^\s*(\d+)[.)]\s+(.+)$/ : /^\s*[-*+]\s+(.+)$/;
			const start = ordered ? orderedListStart(lines, options) : 1;
			const items = lines.map((line) => {
				const match = itemPattern.exec(line);
				return `<li>${renderInlineMarkdown(match ? match[ordered ? 2 : 1] : line.trim())}</li>`;
			});
			return `<${tag}${ordered && start > 1 ? ` start="${start}"` : ""}>${items.join("")}</${tag}>`;
		}
		function codeBlockTableLines(codeText) {
			const lines = String(codeText || "").replace(/\r\n?/g, "\n").split("\n");
			for (let index = 0; index < lines.length - 1; index += 1) {
				if (!lines[index].includes("|") || !isMarkdownTableSeparator(lines[index + 1])) continue;
				const tableLines = [lines[index], lines[index + 1]];
				index += 2;
				while (index < lines.length && lines[index].trim() && lines[index].includes("|")) {
					tableLines.push(lines[index]);
					index += 1;
				}
				return tableLines.length >= 3 ? tableLines : [];
			}
			return [];
		}
		function renderCodeBlock(codeText, lang, options) {
			const langLabel = `<span class="markdown-code-lang">${escapeHtml(lang || "代码")}</span>`;
			let copyButton = "";
			if (options && typeof options.rememberCopyText === "function" && typeof options.copyButtonHtml === "function") copyButton = options.copyButtonHtml(options.rememberCopyText(codeText), options.copyLabel || "复制", "markdown-copy-button");
			const normalizedLang = String(lang || "").trim().toLowerCase();
			const tableLines = Boolean(options && options.fencedTableMode === "preview") && (!normalizedLang || normalizedLang === "text" || normalizedLang === "txt" || normalizedLang === "plain" || normalizedLang === "plaintext") ? codeBlockTableLines(codeText) : [];
			if (tableLines.length) return `<div class="markdown-code-table-preview">${renderMarkdownTable(tableLines)}</div>
      <details class="markdown-code-table-source-details">
        <summary>查看源码表格</summary>
        <div class="markdown-code-block"><div class="markdown-code-head">${langLabel}${copyButton}</div><pre><code>${escapeHtml(codeText)}</code></pre></div>
      </details>`;
			return `<div class="markdown-code-block"><div class="markdown-code-head">${langLabel}${copyButton}</div><pre><code>${escapeHtml(codeText)}</code></pre></div>`;
		}
		function escapeMermaidQuotedLabel(value) {
			return String(value || "").trim().replace(/"/g, "&quot;");
		}
		function mermaidGeneratedSubgraphId(index) {
			return `codex_mobile_subgraph_${index + 1}`;
		}
		function normalizeMermaidSubgraphLine(line, index) {
			const match = /^(\s*)subgraph\s+(.+?)\s*$/i.exec(String(line || ""));
			if (!match) return line;
			const indent = match[1] || "";
			const body = String(match[2] || "").trim();
			if (!body || /^end$/i.test(body)) return line;
			const bracketMatch = /^([A-Za-z][\w-]*)\s*\[(.*)\]$/.exec(body);
			if (bracketMatch) {
				const label = String(bracketMatch[2] || "").trim();
				if (!label || /^".*"$/.test(label)) return line;
				return `${indent}subgraph ${bracketMatch[1]}["${escapeMermaidQuotedLabel(label)}"]`;
			}
			const idTitleMatch = /^([A-Za-z][\w-]*)\s+(.+)$/.exec(body);
			if (idTitleMatch) {
				const title = String(idTitleMatch[2] || "").trim();
				if (!title || /^".*"$/.test(title)) return line;
				return `${indent}subgraph ${idTitleMatch[1]}["${escapeMermaidQuotedLabel(title)}"]`;
			}
			if (/^[A-Za-z][\w-]*$/.test(body) || /^".*"$/.test(body)) return line;
			return `${indent}subgraph ${mermaidGeneratedSubgraphId(index)}["${escapeMermaidQuotedLabel(body)}"]`;
		}
		function normalizeMermaidDetachedSoftBreakLabels(source) {
			return String(source || "").replace(/(^|[\s;])([A-Za-z][\w-]*)\[([^\]\n]+)\]<br\/>\(([^()\n]+)\)/gm, (match, prefix, nodeId, label, continuation) => {
				return `${prefix}${nodeId}["${escapeMermaidQuotedLabel(`${String(label || "").trim()}<br/>(${String(continuation || "").trim()})`)}"]`;
			});
		}
		function normalizeMermaidSourceForRender(value) {
			const withSoftBreaks = String(value || "").replace(/\\n/g, "<br/>");
			const firstLine = withSoftBreaks.split(/\r?\n/, 1)[0].trim();
			if (!/^(?:flowchart|graph)\b/i.test(firstLine)) return withSoftBreaks;
			return normalizeMermaidDetachedSoftBreakLabels(withSoftBreaks.split(/\r?\n/).map((line, index) => normalizeMermaidSubgraphLine(line, index)).join("\n")).replace(/(^|[\s;])([A-Za-z][\w-]*)\[([^\]\n]*)\]/gm, (match, prefix, nodeId, label) => {
				const trimmed = String(label || "").trim();
				if (!trimmed || /^".*"$/.test(trimmed)) return match;
				if (!/[()（）]|<br\/>/.test(trimmed)) return match;
				return `${prefix}${nodeId}["${trimmed.replace(/"/g, "&quot;")}"]`;
			}).replace(/\|([^|\n]*[()]+[^|\n]*)\|/g, (match, label) => {
				return `|${String(label || "").replace(/\(/g, "（").replace(/\)/g, "）")}|`;
			});
		}
		function renderMermaidBlock(codeText) {
			return `<div class="markdown-mermaid-block" data-mermaid-block="true">
      <div class="markdown-mermaid-head">
        <span class="markdown-mermaid-label">Mermaid</span>
        <div class="markdown-mermaid-toolbar">
          <button class="markdown-mermaid-tool" type="button" data-mermaid-action="zoom-out" aria-label="缩小 Mermaid 图" title="缩小">-</button>
          <button class="markdown-mermaid-tool markdown-mermaid-tool-reset" type="button" data-mermaid-action="reset" aria-label="重置 Mermaid 图缩放" title="重置">100%</button>
          <button class="markdown-mermaid-tool" type="button" data-mermaid-action="zoom-in" aria-label="放大 Mermaid 图" title="放大">+</button>
          <button class="markdown-mermaid-tool" type="button" data-mermaid-action="expand" aria-label="放大查看 Mermaid 图" title="放大查看">展开</button>
        </div>
      </div>
      <div class="markdown-mermaid-viewer" data-mermaid-viewer="inline">
        <div class="markdown-mermaid-canvas" data-mermaid-canvas>
          <div class="markdown-mermaid-loading">正在渲染 Mermaid 图...</div>
        </div>
      </div>
      <details class="markdown-mermaid-source-details">
        <summary>查看 Mermaid 源码</summary>
        <pre><code class="language-mermaid">${escapeHtml(codeText)}</code></pre>
      </details>
      <pre class="markdown-mermaid-source" hidden>${escapeHtml(codeText)}</pre>
    </div>`;
		}
		function renderBareDataImage(value) {
			const safeUrl = safeMarkdownDataImageUrl(value);
			if (!safeUrl) return "";
			return `<figure class="markdown-image"><img src="${escapeHtml(safeUrl)}" alt="Image" loading="lazy"></figure>`;
		}
		function renderMarkdown(value, options = {}) {
			const source = String(value || "");
			if (!source.trim()) return "";
			const lines = source.replace(/\r\n?/g, "\n").split("\n");
			const blocks = [];
			let i = 0;
			while (i < lines.length) {
				const line = lines[i];
				if (!line.trim()) {
					i += 1;
					continue;
				}
				const bareDataImage = renderBareDataImage(line.trim());
				if (bareDataImage) {
					blocks.push(bareDataImage);
					i += 1;
					continue;
				}
				const fence = /^```([A-Za-z0-9_.+-]*)\s*$/.exec(line);
				if (fence) {
					const lang = fence[1] || "";
					const code = [];
					i += 1;
					while (i < lines.length && !/^```\s*$/.test(lines[i])) {
						code.push(lines[i]);
						i += 1;
					}
					if (i < lines.length) i += 1;
					const codeText = code.join("\n");
					blocks.push(/^mermaid$/i.test(lang) ? renderMermaidBlock(codeText) : renderCodeBlock(codeText, lang, options));
					continue;
				}
				const heading = /^(#{1,6})\s+(.+)$/.exec(line);
				if (heading) {
					const level = Math.min(6, heading[1].length + 1);
					blocks.push(`<h${level}>${renderInlineMarkdown(heading[2].trim())}</h${level}>`);
					i += 1;
					continue;
				}
				if (/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
					blocks.push("<hr>");
					i += 1;
					continue;
				}
				if (/^>\s?/.test(line)) {
					const quote = [];
					while (i < lines.length && /^>\s?/.test(lines[i])) {
						quote.push(lines[i].replace(/^>\s?/, ""));
						i += 1;
					}
					blocks.push(`<blockquote>${renderMarkdown(quote.join("\n"), options)}</blockquote>`);
					continue;
				}
				if (line.includes("|") && isMarkdownTableSeparator(lines[i + 1])) {
					const tableLines = [line, lines[i + 1]];
					i += 2;
					while (i < lines.length && lines[i].trim() && lines[i].includes("|")) {
						tableLines.push(lines[i]);
						i += 1;
					}
					blocks.push(renderMarkdownTable(tableLines));
					continue;
				}
				if (/^\s*[-*+]\s+\S/.test(line)) {
					const list = [];
					while (i < lines.length && /^\s*[-*+]\s+\S/.test(lines[i])) {
						list.push(lines[i]);
						i += 1;
					}
					blocks.push(renderMarkdownList(list, false, options));
					continue;
				}
				if (/^\s*\d+[.)]\s+\S/.test(line)) {
					const list = [];
					while (i < lines.length && /^\s*\d+[.)]\s+\S/.test(lines[i])) {
						list.push(lines[i]);
						i += 1;
					}
					blocks.push(renderMarkdownList(list, true, options));
					continue;
				}
				const paragraph = [line.trim()];
				i += 1;
				while (i < lines.length && lines[i].trim() && !isMarkdownBlockStart(lines[i], lines[i + 1] || "")) {
					paragraph.push(lines[i].trim());
					i += 1;
				}
				blocks.push(`<p>${paragraph.map(renderInlineMarkdown).join("<br>")}</p>`);
			}
			return `<div class="markdown-body">${blocks.join("")}</div>`;
		}
		return {
			escapeHtml,
			safeMarkdownUrl,
			autolinkUrlParts,
			renderMarkdownLink,
			renderMarkdownImage,
			renderAutolinkUrl,
			renderInlineMarkdown,
			safeMarkdownImageUrl,
			normalizeMermaidSourceForRender,
			isMarkdownTableSeparator,
			splitMarkdownTableRow,
			isMarkdownBlockStart,
			renderMarkdownTable,
			renderMarkdownList,
			renderMarkdown
		};
	});
}));
//#endregion
//#region public/plugin-embed.js
var require_plugin_embed = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory(root || {});
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexPluginEmbed = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function(root) {
		const NAVIGATION_TYPE = "codex-mobile.plugin.navigation";
		const BACK_RESULT_TYPE = "codex-mobile.plugin.back_result";
		const REFRESH_REQUIRED_TYPE = "codex-mobile.plugin.refresh_required";
		const EXTERNAL_LINK_TYPE = "codex-mobile.plugin.external_link";
		const BACK_TYPE = "hermes.plugin.back";
		const THEME_VALUES = /* @__PURE__ */ new Set([
			"system",
			"dark",
			"light"
		]);
		const FONT_SIZE_VALUES = /* @__PURE__ */ new Set([
			"small",
			"default",
			"large",
			"xlarge",
			"xxlarge"
		]);
		function stringValue(value) {
			return String(value || "").trim();
		}
		function boundedString(value, maxLength) {
			const text = stringValue(value);
			return text ? text.slice(0, Math.max(0, Number(maxLength) || 0)) : "";
		}
		function normalizedEnum(value, allowedValues) {
			const text = stringValue(value).toLowerCase();
			return allowedValues.has(text) ? text : "";
		}
		function urlFrom(value) {
			try {
				const location = root.location || {};
				return new URL(value || location.href || "/", location.origin || "http://127.0.0.1");
			} catch (_) {
				return null;
			}
		}
		function detect(value) {
			const url = urlFrom(value);
			const params = url ? url.searchParams : new URLSearchParams();
			const routeHint = normalizeRouteHint({
				pluginId: boundedString(params.get("pluginId"), 80),
				route: boundedString(params.get("pluginRoute"), 80),
				itemId: boundedString(params.get("pluginItemId"), 160),
				threadId: boundedString(params.get("pluginThreadId"), 160),
				taskId: boundedString(params.get("pluginTaskId"), 160)
			}) || {
				pluginId: "",
				route: "",
				itemId: "",
				threadId: "",
				taskId: ""
			};
			const appearance = {};
			const theme = normalizedEnum(params.get("pluginTheme") || params.get("theme"), THEME_VALUES);
			const fontSize = normalizedEnum(params.get("pluginFontSize") || params.get("fontSize"), FONT_SIZE_VALUES);
			if (theme) appearance.theme = theme;
			if (fontSize) appearance.fontSize = fontSize;
			return {
				embedded: params.get("embed") === "hermes",
				launchKey: stringValue(params.get("codexPluginLaunch") || params.get("pluginLaunch")),
				workspaceId: stringValue(params.get("workspaceId") || params.get("workspace_id")),
				routeHint,
				appearance
			};
		}
		function normalizeRouteHint(value) {
			if (!value || typeof value !== "object") return null;
			const pluginId = boundedString(value.pluginId, 80);
			const route = boundedString(value.route, 80);
			const itemId = boundedString(value.itemId, 160);
			const threadId = boundedString(value.threadId, 160);
			const taskId = boundedString(value.taskId, 160);
			if (!(pluginId || route || itemId || threadId || taskId)) return null;
			return {
				pluginId,
				route,
				itemId,
				threadId,
				taskId
			};
		}
		function routeHintFromUrl(value) {
			return normalizeRouteHint(detect(value).routeHint);
		}
		function routeHintTargetId(hint) {
			const normalized = normalizeRouteHint(hint);
			return normalized ? stringValue(normalized.taskId || normalized.itemId) : "";
		}
		function routeHintOpenPlan(hint) {
			const normalized = normalizeRouteHint(hint);
			if (!normalized || normalized.pluginId !== "codex-mobile") return { action: "ignore" };
			const threadId = stringValue(normalized.threadId);
			const targetId = routeHintTargetId(normalized);
			if (!threadId && !targetId) return {
				action: "primary",
				diagnostic: normalized.route && normalized.route !== "root" ? {
					message: "Notification target is unavailable",
					error: true
				} : null
			};
			if (!threadId) return {
				action: "primary",
				diagnostic: {
					message: "Notification thread is unavailable",
					error: true
				}
			};
			return {
				action: "openThread",
				hint: normalized,
				threadId,
				targetId,
				pendingHint: targetId ? normalized : null,
				statusMessage: targetId ? "Opening notification target" : "Opening notification thread"
			};
		}
		function routeHintFocusPlan(hint, state = {}) {
			const normalized = normalizeRouteHint(hint);
			if (!normalized) return { action: "ignore" };
			const currentThreadId = stringValue(state.currentThreadId);
			if (!currentThreadId || normalized.threadId !== currentThreadId) return { action: "wait" };
			if (!routeHintTargetId(normalized)) return { action: "clear" };
			if (state.targetFound === true) return {
				action: "focused",
				diagnostic: {
					message: "Opened notification target",
					error: false
				}
			};
			return {
				action: "primary",
				diagnostic: {
					message: "Notification target is no longer available",
					error: true
				}
			};
		}
		function routeHintTargetSelectors(hint, options = {}) {
			const targetId = routeHintTargetId(hint);
			if (!targetId) return [];
			const escaped = (typeof options.escapeSelector === "function" ? options.escapeSelector : (value) => stringValue(value).replace(/["\\]/g, "\\$&"))(targetId);
			return [
				`[data-approval-card="${escaped}"]`,
				`[data-task-card="${escaped}"]`,
				`[data-turn="${escaped}"]`,
				`[data-item="${escaped}"]`
			];
		}
		function findRouteHintTargetNode(rootNode, hint, options = {}) {
			if (!rootNode || typeof rootNode.querySelector !== "function") return null;
			for (const selector of routeHintTargetSelectors(hint, options)) {
				const node = rootNode.querySelector(selector);
				if (node) return node;
			}
			return null;
		}
		function scrubRouteHintPath(value, options = {}) {
			const url = urlFrom(value);
			if (!url) return "";
			url.search = "";
			url.searchParams.set("embed", "hermes");
			const workspaceId = boundedString(options.workspaceId, 120);
			if (workspaceId) url.searchParams.set("workspaceId", workspaceId);
			const appearance = appearanceFromState(options.appearance || {});
			if (appearance.theme) url.searchParams.set("pluginTheme", appearance.theme);
			if (appearance.fontSize) url.searchParams.set("pluginFontSize", appearance.fontSize);
			return `${url.pathname || "/"}?${url.searchParams.toString()}${url.hash || ""}`;
		}
		function parentOriginFromReferrer(referrer) {
			try {
				return referrer ? new URL(referrer).origin : "";
			} catch (_) {
				return "";
			}
		}
		function routeFromState(state = {}, ui = {}) {
			if (ui.imagePreviewOpen) return {
				kind: "modal",
				modal: "imagePreview",
				threadId: stringValue(state.currentThreadId)
			};
			if (ui.mermaidPreviewOpen) return {
				kind: "modal",
				modal: "mermaidPreview",
				threadId: stringValue(state.currentThreadId)
			};
			if (ui.filePreviewOpen) return {
				kind: "modal",
				modal: "filePreview",
				threadId: stringValue(state.currentThreadId)
			};
			if (state.renameThreadId) return {
				kind: "modal",
				modal: "renameThread",
				threadId: stringValue(state.renameThreadId)
			};
			if (state.threadActionMenuId) return {
				kind: "modal",
				modal: "threadActions",
				threadId: stringValue(state.threadActionMenuId)
			};
			if (state.subagentPanelOpen) return {
				kind: "panel",
				panel: "subagent",
				threadId: stringValue(state.currentThreadId)
			};
			if (ui.primaryPage) return {
				kind: "root",
				workspace: stringValue(state.selectedCwd),
				settingsOpen: Boolean(ui.settingsOpen)
			};
			if (ui.settingsOpen) return {
				kind: "panel",
				panel: "settings",
				threadId: stringValue(state.currentThreadId)
			};
			if (ui.sidebarOpen) return {
				kind: "drawer",
				drawer: "threadList",
				threadId: stringValue(state.currentThreadId)
			};
			if (state.newThreadDraft) return {
				kind: "new_thread",
				workspace: stringValue(state.selectedCwd)
			};
			if (state.currentThreadId) return {
				kind: "thread",
				threadId: stringValue(state.currentThreadId)
			};
			if (state.selectedCwd) return {
				kind: "workspace",
				workspace: stringValue(state.selectedCwd)
			};
			return { kind: "root" };
		}
		function canGoBack(state = {}, ui = {}) {
			if (ui.primaryPage) return false;
			return Boolean(ui.imagePreviewOpen || ui.mermaidPreviewOpen || ui.filePreviewOpen || ui.createWorkspaceOpen || ui.updatePanelOpen || ui.settingsOpen || ui.sidebarOpen || state.renameThreadId || state.threadActionMenuId || state.subagentPanelOpen || state.newThreadDraft || state.currentThreadId);
		}
		function appearanceFromState(state = {}) {
			const source = state.pluginAppearance && typeof state.pluginAppearance === "object" ? state.pluginAppearance : {};
			const appearance = {};
			const theme = normalizedEnum(source.theme || state.theme, THEME_VALUES);
			const fontSize = normalizedEnum(state.fontSize || source.fontSize || source.pluginFontSize, FONT_SIZE_VALUES);
			if (theme) appearance.theme = theme;
			if (fontSize) appearance.fontSize = fontSize;
			return appearance;
		}
		function navigationMessage(state = {}, ui = {}) {
			const message = {
				type: NAVIGATION_TYPE,
				version: 1,
				canGoBack: canGoBack(state, ui),
				route: routeFromState(state, ui)
			};
			const appearance = appearanceFromState(state);
			if (Object.keys(appearance).length > 0) message.appearance = appearance;
			return message;
		}
		function postNavigation(parentWindow, state = {}, options = {}) {
			if (!parentWindow || parentWindow === root) return null;
			const message = navigationMessage(state, options.ui || {});
			parentWindow.postMessage(message, options.targetOrigin || "*");
			return message;
		}
		function backResultMessage(state = {}, options = {}) {
			const message = {
				type: BACK_RESULT_TYPE,
				version: 1,
				handled: Boolean(options.handled),
				route: routeFromState(state, options.ui || {})
			};
			const reason = stringValue(options.reason);
			if (reason) message.reason = reason;
			return message;
		}
		function postBackResult(parentWindow, state = {}, options = {}) {
			if (!parentWindow || parentWindow === root) return null;
			const message = backResultMessage(state, options);
			parentWindow.postMessage(message, options.targetOrigin || "*");
			return message;
		}
		function refreshRequiredRoute(route = {}) {
			const next = {};
			const name = boundedString(route.name || route.kind || "", 48);
			const threadId = boundedString(route.threadId || "", 160);
			const itemId = boundedString(route.itemId || "", 160);
			const pluginRoute = boundedString(route.pluginRoute || route.route || "", 80);
			const pluginThreadId = boundedString(route.pluginThreadId || threadId || "", 160);
			const pluginTaskId = boundedString(route.pluginTaskId || route.taskId || "", 160);
			const pluginItemId = boundedString(route.pluginItemId || itemId || "", 160);
			if (name) next.name = name;
			if (threadId) next.threadId = threadId;
			if (itemId) next.itemId = itemId;
			if (pluginRoute) next.pluginRoute = pluginRoute;
			if (pluginThreadId) next.pluginThreadId = pluginThreadId;
			if (pluginTaskId) next.pluginTaskId = pluginTaskId;
			if (pluginItemId) next.pluginItemId = pluginItemId;
			return next;
		}
		function refreshRequiredMessage(input = {}) {
			const message = {
				type: REFRESH_REQUIRED_TYPE,
				version: 1,
				reason: boundedString(input.reason || "refresh_required", 80) || "refresh_required"
			};
			const route = refreshRequiredRoute(input.route || {});
			if (Object.keys(route).length > 0) message.route = route;
			const appearance = appearanceFromState(input.appearance || {});
			if (Object.keys(appearance).length > 0) message.appearance = appearance;
			return message;
		}
		function postRefreshRequired(parentWindow, input = {}, options = {}) {
			if (!parentWindow || parentWindow === root) return null;
			const message = refreshRequiredMessage(input);
			parentWindow.postMessage(message, options.targetOrigin || "*");
			return message;
		}
		function externalBrowserUrl(value, origin) {
			const text = stringValue(value);
			if (!text) return "";
			if (!/^(https?:|mailto:)/i.test(text)) return "";
			try {
				const baseOrigin = origin || root.location && root.location.origin || "http://127.0.0.1";
				const url = new URL(text, baseOrigin);
				if (url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:") return url.toString();
			} catch (_) {}
			return "";
		}
		function externalLinkMessage(input = {}) {
			const href = externalBrowserUrl(input.href || input.url || "", input.origin || "");
			if (!href) return null;
			return {
				type: EXTERNAL_LINK_TYPE,
				version: 1,
				href: boundedString(href, 2e3),
				source: boundedString(input.source || "receipt-link", 80) || "receipt-link"
			};
		}
		function postExternalLink(parentWindow, input = {}, options = {}) {
			if (!parentWindow || parentWindow === root) return null;
			const message = externalLinkMessage(input);
			if (!message) return null;
			parentWindow.postMessage(message, options.targetOrigin || "*");
			return message;
		}
		function isBackMessage(event) {
			const data = event && event.data;
			return Boolean(data && data.type === BACK_TYPE && data.version === 1);
		}
		function isInternalUrl(value, origin) {
			const text = stringValue(value);
			if (text.startsWith("/") && !text.startsWith("//")) return true;
			try {
				const baseOrigin = origin || root.location && root.location.origin || "";
				const url = new URL(text, baseOrigin || "http://127.0.0.1");
				return !baseOrigin || url.origin === baseOrigin;
			} catch (_) {
				return false;
			}
		}
		return {
			BACK_TYPE,
			BACK_RESULT_TYPE,
			EXTERNAL_LINK_TYPE,
			REFRESH_REQUIRED_TYPE,
			NAVIGATION_TYPE,
			appearanceFromState,
			backResultMessage,
			canGoBack,
			detect,
			externalBrowserUrl,
			externalLinkMessage,
			findRouteHintTargetNode,
			isBackMessage,
			isInternalUrl,
			navigationMessage,
			normalizeRouteHint,
			parentOriginFromReferrer,
			postBackResult,
			postExternalLink,
			postRefreshRequired,
			postNavigation,
			refreshRequiredMessage,
			routeHintFocusPlan,
			routeHintFromUrl,
			routeHintOpenPlan,
			routeHintTargetId,
			routeHintTargetSelectors,
			routeFromState,
			scrubRouteHintPath
		};
	});
}));
//#endregion
//#region public/frontend-runtime-health.js
var require_frontend_runtime_health = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexFrontendRuntimeHealth = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		const DEFAULT_WINDOW_MS = 5e3;
		const DEFAULT_SUBMISSION_PROBE_MIN_MS = 250;
		const MAX_COUNT = 1e5;
		function compactToken(value, fallback = "", maxLength = 80) {
			return String(value || "").trim().replace(/[^a-zA-Z0-9_.:-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, maxLength) || fallback;
		}
		function boundedCount(value) {
			const number = Number(value);
			if (!Number.isFinite(number) || number < 0) return 0;
			return Math.min(MAX_COUNT, Math.trunc(number));
		}
		function boolCount(value) {
			return value ? 1 : 0;
		}
		function boundedConfidence(value, fallback = .74) {
			const number = Number(value);
			if (!Number.isFinite(number)) return fallback;
			return Math.max(0, Math.min(1, number));
		}
		function baseContext(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			const context = {
				surface: compactToken(source.surface, "frontend-runtime", 80),
				action: compactToken(source.action, "render", 80)
			};
			const routeKind = compactToken(source.routeKind || source.route_kind, "", 80);
			const readMode = compactToken(source.readMode || source.read_mode, "", 80);
			const renderMode = compactToken(source.renderMode || source.render_mode, "", 80);
			const threadHash = compactToken(source.threadHash || source.thread_hash, "", 80);
			const itemHash = compactToken(source.itemHash || source.item_hash, "", 80);
			const renderPlanReason = compactToken(source.renderPlanReason || source.render_plan_reason, "", 80);
			const patchRejectReason = compactToken(source.patchRejectReason || source.patch_reject_reason, "", 80);
			if (routeKind) context.route_kind = routeKind;
			if (readMode) context.read_mode = readMode;
			if (renderMode) context.render_mode = renderMode;
			if (threadHash) context.thread_hash = threadHash;
			if (itemHash) context.item_hash = itemHash;
			if (renderPlanReason) context.render_plan_reason = renderPlanReason;
			if (patchRejectReason) context.patch_reject_reason = patchRejectReason;
			return context;
		}
		function runtimeEvent(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			return {
				category: "frontend_runtime_mismatch",
				diagnostic_type: compactToken(source.diagnosticType || source.diagnostic_type, "frontend_runtime_mismatch", 80),
				severity_hint: compactToken(source.severityHint || source.severity_hint, "H2", 8),
				evidence_confidence: boundedConfidence(source.evidenceConfidence || source.evidence_confidence, .74),
				error_code: compactToken(source.errorCode || source.error_code, "frontend_runtime_mismatch", 100),
				context: baseContext(source.context || source),
				counts: source.counts && typeof source.counts === "object" ? source.counts : {},
				breadcrumbs: Array.isArray(source.breadcrumbs) ? source.breadcrumbs.slice(0, 6) : []
			};
		}
		function runtimeSuccess(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			return {
				category: "frontend_runtime_mismatch",
				diagnostic_type: compactToken(source.diagnosticType || source.diagnostic_type, "frontend_runtime_mismatch", 80),
				error_code: compactToken(source.errorCode || source.error_code || source.diagnosticType || source.diagnostic_type, "frontend_runtime_mismatch", 100),
				context: baseContext(source.context || source)
			};
		}
		function submittedMessageDomMissingEvent(input = {}) {
			const elapsedMs = boundedCount(input.elapsedMs || input.elapsed_ms);
			const domCount = boundedCount(input.domCount || input.dom_count);
			const visibleCount = boundedCount(input.visibleCount || input.visible_count);
			const context = baseContext(Object.assign({}, input, {
				surface: "user-operation",
				action: input.action || "message-submit"
			}));
			return runtimeEvent({
				diagnosticType: "submitted_message_dom_missing",
				severityHint: "H2",
				evidenceConfidence: .82,
				errorCode: "submitted_message_dom_missing",
				context,
				counts: {
					elapsed_ms: elapsedMs,
					dom_count: domCount,
					visible_count: visibleCount,
					current_thread_match: boolCount(input.currentThreadMatch),
					has_thread_submission: boolCount(input.hasThreadSubmission),
					dom_has_submission: boolCount(input.domHasSubmission),
					composer_busy: boolCount(input.composerBusy)
				},
				breadcrumbs: [{
					kind: "user-operation",
					code: "submitted-message-dom-probe",
					status: "failed",
					fields: {
						elapsed_ms: elapsedMs,
						dom_count: domCount,
						visible_count: visibleCount,
						thread_hash: context.thread_hash || "",
						item_hash: context.item_hash || ""
					}
				}]
			});
		}
		function submittedMessageDomSuccess(input = {}) {
			return runtimeSuccess(Object.assign({}, input, {
				diagnosticType: "submitted_message_dom_missing",
				errorCode: "submitted_message_dom_missing",
				surface: "user-operation",
				action: input.action || "message-submit"
			}));
		}
		function submittedMessageDomProbeEffects(input = {}) {
			if (boundedCount(input.elapsedMs || input.elapsed_ms) < boundedCount(input.minElapsedMs || input.min_elapsed_ms || DEFAULT_SUBMISSION_PROBE_MIN_MS)) return {
				effects: [],
				reason: "too-early"
			};
			if (!input.currentThreadMatch) return {
				effects: [],
				reason: "different-thread"
			};
			if (!input.hasThreadSubmission) return {
				effects: [],
				reason: "no-thread-submission"
			};
			const missing = !input.domHasSubmission;
			return {
				effects: [{
					type: missing ? "diagnostic-failure" : "diagnostic-success",
					diagnostic: missing ? submittedMessageDomMissingEvent(input) : submittedMessageDomSuccess(input),
					diagnosticType: "submitted_message_dom_missing",
					reason: missing ? "submitted-message-dom-missing" : "submitted-message-dom-present"
				}],
				reason: missing ? "submitted-message-dom-missing" : "submitted-message-dom-present"
			};
		}
		function renderChurnEvent(input = {}) {
			const context = baseContext(Object.assign({}, input, {
				surface: "conversation-render",
				action: input.action || "render"
			}));
			const fullRenderCount = boundedCount(input.fullRenderCount || input.full_render_count);
			const fallbackCount = boundedCount(input.fallbackCount || input.fallback_count);
			const renderCount = boundedCount(input.renderCount || input.render_count);
			const domCount = boundedCount(input.domCount || input.dom_count);
			const visibleCount = boundedCount(input.visibleCount || input.visible_count);
			const previousCount = boundedCount(input.previousCount || input.previous_count);
			return runtimeEvent({
				diagnosticType: "render_churn",
				severityHint: "H3",
				evidenceConfidence: .72,
				errorCode: fallbackCount ? "render_patch_fallback_churn" : "render_full_render_churn",
				context,
				counts: {
					render_count: renderCount,
					full_render_count: fullRenderCount,
					fallback_count: fallbackCount,
					previous_count: previousCount,
					dom_count: domCount,
					visible_count: visibleCount,
					render_elapsed_ms: boundedCount(input.renderElapsedMs || input.render_elapsed_ms),
					duplicate_count: boundedCount(input.duplicateCount || input.duplicate_count)
				},
				breadcrumbs: [{
					kind: "conversation-render",
					code: fallbackCount ? "patch-fallback-churn" : "full-render-churn",
					status: "unstable",
					fields: {
						render_mode: context.render_mode || "",
						render_plan_reason: context.render_plan_reason || "",
						patch_reject_reason: context.patch_reject_reason || "",
						previous_count: previousCount,
						dom_count: domCount,
						visible_count: visibleCount
					}
				}]
			});
		}
		function domDropEvent(input = {}) {
			const context = baseContext(Object.assign({}, input, {
				surface: "conversation-render",
				action: input.action || "render"
			}));
			return runtimeEvent({
				diagnosticType: "render_dom_drop",
				severityHint: "H2",
				evidenceConfidence: .8,
				errorCode: "render_dom_drop",
				context,
				counts: {
					previous_count: boundedCount(input.previousCount || input.previous_count),
					dom_count: boundedCount(input.domCount || input.dom_count),
					visible_count: boundedCount(input.visibleCount || input.visible_count),
					duplicate_count: boundedCount(input.duplicateCount || input.duplicate_count),
					render_elapsed_ms: boundedCount(input.renderElapsedMs || input.render_elapsed_ms)
				},
				breadcrumbs: [{
					kind: "conversation-render",
					code: "dom-drop",
					status: "failed",
					fields: {
						previous_count: boundedCount(input.previousCount || input.previous_count),
						dom_count: boundedCount(input.domCount || input.dom_count),
						visible_count: boundedCount(input.visibleCount || input.visible_count),
						render_mode: context.render_mode || ""
					}
				}]
			});
		}
		function renderSuccess(input = {}, diagnosticType = "render_churn") {
			return runtimeSuccess(Object.assign({}, input, {
				diagnosticType,
				errorCode: diagnosticType,
				surface: "conversation-render",
				action: input.action || "render"
			}));
		}
		function threadListInteractionStallEvent(input = {}) {
			const maxRafDelayMs = boundedCount(input.maxRafDelayMs || input.max_raf_delay_ms);
			const maxScrollApplyMs = boundedCount(input.maxScrollApplyMs || input.max_scroll_apply_ms);
			const maxLongTaskMs = boundedCount(input.maxLongTaskMs || input.max_long_task_ms);
			const elapsedMs = boundedCount(input.elapsedMs || input.elapsed_ms);
			const maxDelayMs = Math.max(maxRafDelayMs, maxScrollApplyMs, maxLongTaskMs, elapsedMs);
			const context = baseContext(Object.assign({}, input, {
				surface: "thread-list-runtime",
				action: input.action || "thread-list-interaction"
			}));
			const errorCode = maxLongTaskMs >= Math.max(maxRafDelayMs, maxScrollApplyMs) ? "browser_main_thread_long_task" : "browser_thread_list_interaction_blocked";
			return runtimeEvent({
				diagnosticType: "thread_list_interaction_stall",
				severityHint: maxDelayMs >= boundedCount(input.h2ThresholdMs || input.h2_threshold_ms || 3e3) ? "H2" : "H3",
				evidenceConfidence: maxDelayMs >= 3e3 ? .86 : .74,
				errorCode,
				context,
				counts: {
					elapsed_ms: elapsedMs,
					raf_delay_ms: maxRafDelayMs,
					scroll_apply_ms: maxScrollApplyMs,
					long_task_ms: maxLongTaskMs,
					long_task_count: boundedCount(input.longTaskCount || input.long_task_count),
					thread_list_count: boundedCount(input.threadListCount || input.thread_list_count),
					thread_list_visible: boolCount(input.threadListVisible || input.thread_list_visible),
					thread_list_monitorable: boolCount(input.threadListMonitorable || input.thread_list_monitorable),
					scroll_top: boundedCount(input.scrollTop || input.scroll_top),
					scroll_height: boundedCount(input.scrollHeight || input.scroll_height)
				},
				breadcrumbs: [{
					kind: "thread-list-runtime",
					code: errorCode,
					status: "blocked",
					fields: {
						elapsed_ms: elapsedMs,
						raf_delay_ms: maxRafDelayMs,
						scroll_apply_ms: maxScrollApplyMs,
						long_task_ms: maxLongTaskMs,
						long_task_count: boundedCount(input.longTaskCount || input.long_task_count),
						thread_list_count: boundedCount(input.threadListCount || input.thread_list_count)
					}
				}]
			});
		}
		function threadListInteractionStallEffects(input = {}) {
			const minDelayMs = boundedCount(input.minDelayMs || input.min_delay_ms || 1e3) || 1e3;
			const maxDelayMs = Math.max(boundedCount(input.maxRafDelayMs || input.max_raf_delay_ms), boundedCount(input.maxScrollApplyMs || input.max_scroll_apply_ms), boundedCount(input.maxLongTaskMs || input.max_long_task_ms), boundedCount(input.elapsedMs || input.elapsed_ms));
			if (!input.threadListVisible && !input.threadListMonitorable) return {
				effects: [],
				reason: "thread-list-not-visible"
			};
			if (maxDelayMs < minDelayMs) return {
				effects: [],
				reason: "below-threshold"
			};
			return {
				effects: [{
					type: "diagnostic-failure",
					diagnostic: threadListInteractionStallEvent(input),
					diagnosticType: "thread_list_interaction_stall",
					reason: "thread-list-interaction-stall"
				}],
				reason: "thread-list-interaction-stall"
			};
		}
		function createMonitor(options = {}) {
			const now = typeof options.now === "function" ? options.now : () => Date.now();
			const windowMs = boundedCount(options.windowMs || DEFAULT_WINDOW_MS) || DEFAULT_WINDOW_MS;
			const fullRenderThreshold = boundedCount(options.fullRenderThreshold || 3) || 3;
			const fallbackThreshold = boundedCount(options.fallbackThreshold || 2) || 2;
			let samples = [];
			function trim(currentTime) {
				samples = samples.filter((entry) => currentTime - entry.at <= windowMs);
				return samples;
			}
			function recordRender(input = {}) {
				const currentTime = now();
				const source = input && typeof input === "object" ? input : {};
				const renderMode = compactToken(source.renderMode || source.render_mode, "", 80);
				const finalAction = compactToken(source.finalAction || source.final_action || renderMode, "", 80);
				const sample = {
					at: currentTime,
					fullRender: Boolean(source.fullRender || finalAction === "set-inner-html" || finalAction === "full-render"),
					fallbackApplied: Boolean(source.fallbackApplied || source.fallback_applied)
				};
				samples.push(sample);
				trim(currentTime);
				const renderCount = samples.length;
				const fullRenderCount = samples.filter((entry) => entry.fullRender).length;
				const fallbackCount = samples.filter((entry) => entry.fallbackApplied).length;
				const previousCount = boundedCount(source.previousCount || source.previous_count);
				const domCount = boundedCount(source.domCount || source.dom_count);
				const visibleCount = boundedCount(source.visibleCount || source.visible_count);
				const duplicateCount = boundedCount(source.duplicateCount || source.duplicate_count);
				const effects = [];
				if (previousCount >= 2 && visibleCount >= 2 && domCount <= 1 && domCount < previousCount) effects.push({
					type: "diagnostic-failure",
					diagnostic: domDropEvent(Object.assign({}, source, {
						renderCount,
						fullRenderCount,
						fallbackCount
					})),
					diagnosticType: "render_dom_drop",
					reason: "render-dom-drop"
				});
				else if (domCount >= Math.min(visibleCount || domCount, 2)) effects.push({
					type: "diagnostic-success",
					diagnostic: renderSuccess(source, "render_dom_drop"),
					diagnosticType: "render_dom_drop",
					reason: "render-dom-stable"
				});
				if (fullRenderCount >= fullRenderThreshold || fallbackCount >= fallbackThreshold) effects.push({
					type: "diagnostic-failure",
					diagnostic: renderChurnEvent(Object.assign({}, source, {
						renderCount,
						fullRenderCount,
						fallbackCount,
						previousCount,
						domCount,
						visibleCount,
						duplicateCount
					})),
					diagnosticType: "render_churn",
					reason: "render-churn"
				});
				else if (!sample.fullRender && !sample.fallbackApplied && duplicateCount === 0) effects.push({
					type: "diagnostic-success",
					diagnostic: renderSuccess(source, "render_churn"),
					diagnosticType: "render_churn",
					reason: "render-churn-stable"
				});
				return {
					effects,
					reason: effects.length ? "frontend-render-health-effects" : "render-observed",
					renderCount,
					fullRenderCount,
					fallbackCount
				};
			}
			function reset() {
				samples = [];
			}
			return {
				recordRender,
				reset,
				windowMs
			};
		}
		return {
			compactToken,
			createMonitor,
			submittedMessageDomMissingEvent,
			submittedMessageDomProbeEffects,
			submittedMessageDomSuccess,
			threadListInteractionStallEvent,
			threadListInteractionStallEffects,
			renderChurnEvent,
			domDropEvent,
			runtimeSuccess
		};
	});
}));
//#endregion
//#region public/home-ai-diagnostic-reporting.js
var require_home_ai_diagnostic_reporting = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexHomeAiDiagnosticReporting = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		const DEFAULT_THRESHOLD = 3;
		const DEFAULT_THROTTLE_MS = 300 * 1e3;
		const DEFAULT_SLOW_PATH_REPORT_MODE = "observe";
		const MAX_BREADCRUMBS = 6;
		const PLUGIN_ID = "codex-mobile";
		const SAFE_CONTEXT_KEYS = /* @__PURE__ */ new Set([
			"action",
			"app_server_deferred_reason",
			"app_server_request_reason",
			"build_id",
			"cache_id",
			"client_visibility",
			"cold_path_owner",
			"cold_path_reason",
			"diagnostic_source",
			"embedded",
			"fallback_cache_decision",
			"fallback_deferred_reason",
			"item_hash",
			"pluginId",
			"pwa",
			"read_mode",
			"render_mode",
			"render_plan_reason",
			"route_kind",
			"shell_cache",
			"sourceSurface",
			"source_kind",
			"patch_reject_reason",
			"performance_phase",
			"projection_partial_kind",
			"projection_source",
			"surface",
			"task_hash",
			"thread_hash",
			"turn_hash",
			"workspaceId"
		]);
		const SAFE_FIELD_KEYS = /* @__PURE__ */ new Set([
			"action",
			"app_server_deferred_reason",
			"app_server_request_reason",
			"api_status",
			"cold_path_owner",
			"cold_path_reason",
			"dom_count",
			"duplicate_count",
			"elapsed_ms",
			"api_elapsed_ms",
			"active_turn_count",
			"completed_turn_count",
			"raf_delay_ms",
			"item_hash",
			"item_kind",
			"item_count",
			"latest_mismatch_count",
			"long_task_count",
			"long_task_ms",
			"missing_count",
			"order_mismatch_count",
			"patch_reject_reason",
			"previous_count",
			"projection_partial",
			"projection_partial_kind",
			"projection_source",
			"read_mode",
			"render_elapsed_ms",
			"render_mode",
			"render_plan_reason",
			"fallback_cache_decision",
			"fallback_deferred_reason",
			"repeated_failures",
			"route_kind",
			"server_count",
			"source_kind",
			"status_code",
			"scroll_apply_ms",
			"scroll_height",
			"scroll_top",
			"task_hash",
			"threshold_ms",
			"thread_list_count",
			"thread_hash",
			"turn_count",
			"turn_hash",
			"older_cursor",
			"newer_cursor",
			"omitted_turns",
			"visible_count"
		]);
		const SAFE_PATH_LABEL_KEYS = /* @__PURE__ */ new Set(["cold_path_owner", "cold_path_reason"]);
		const UNSAFE_KEY_PATTERN = /(body|content|cookie|file|href|key|launch|log|message|path|payload|prompt|raw|secret|text|title|token|url)/i;
		function stableTextHash(value) {
			const text = String(value || "");
			let hash = 2166136261;
			for (let index = 0; index < text.length; index += 1) {
				hash ^= text.charCodeAt(index);
				hash = Math.imul(hash, 16777619);
			}
			return (hash >>> 0).toString(36);
		}
		function hashIdentifier(value, prefix = "h") {
			const text = String(value || "").trim();
			return text ? `${prefix}_${stableTextHash(text)}` : "";
		}
		function boundedToken(value, fallback = "unknown", maxLength = 80) {
			return String(value || "").trim().replace(/[^a-zA-Z0-9_.:-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, maxLength) || fallback;
		}
		function boundedNumber(value, fallback = 0) {
			const number = Number(value);
			if (!Number.isFinite(number)) return fallback;
			return Math.max(0, Math.round(number));
		}
		function durationBucket(value) {
			const ms = Number(value || 0);
			if (!Number.isFinite(ms) || ms <= 0) return "";
			if (ms < 1e3) return "lt_1s";
			if (ms < 3e3) return "1_3s";
			if (ms < 1e4) return "3_10s";
			if (ms < 3e4) return "10_30s";
			return "30s_plus";
		}
		function safeCounts(counts) {
			const out = {};
			if (!counts || typeof counts !== "object" || Array.isArray(counts)) return out;
			for (const [key, value] of Object.entries(counts)) {
				if (UNSAFE_KEY_PATTERN.test(key)) continue;
				const safeKey = boundedToken(key, "", 60);
				if (!safeKey) continue;
				if (typeof value === "boolean") out[safeKey] = value ? 1 : 0;
				else if (Number.isFinite(Number(value))) out[safeKey] = boundedNumber(value);
			}
			return out;
		}
		function safeFields(fields, allowedKeys = SAFE_FIELD_KEYS) {
			const out = {};
			if (!fields || typeof fields !== "object" || Array.isArray(fields)) return out;
			for (const [key, value] of Object.entries(fields)) {
				if (!allowedKeys.has(key) || UNSAFE_KEY_PATTERN.test(key) && !SAFE_PATH_LABEL_KEYS.has(key)) continue;
				if (typeof value === "boolean") out[key] = value;
				else if (Number.isFinite(Number(value)) && !/_hash$/.test(key)) out[key] = boundedNumber(value);
				else {
					const safe = boundedToken(value, "", 120);
					if (safe) out[key] = safe;
				}
			}
			return out;
		}
		function safeContext(context) {
			const out = Object.assign({}, {
				pluginId: PLUGIN_ID,
				sourceSurface: "embedded-plugin"
			});
			const input = context && typeof context === "object" && !Array.isArray(context) ? context : {};
			for (const [key, value] of Object.entries(input)) {
				if (!SAFE_CONTEXT_KEYS.has(key) || UNSAFE_KEY_PATTERN.test(key) && !SAFE_PATH_LABEL_KEYS.has(key)) continue;
				if (typeof value === "boolean") out[key] = value;
				else if (Number.isFinite(Number(value)) && !/_hash$/.test(key)) out[key] = boundedNumber(value);
				else {
					const safe = boundedToken(value, "", 160);
					if (safe) out[key] = safe;
				}
			}
			out.pluginId = PLUGIN_ID;
			out.sourceSurface = "embedded-plugin";
			return out;
		}
		function safeBreadcrumbs(breadcrumbs) {
			if (!Array.isArray(breadcrumbs)) return [];
			return breadcrumbs.slice(0, MAX_BREADCRUMBS).map((entry) => {
				const input = entry && typeof entry === "object" ? entry : {};
				const out = {
					kind: boundedToken(input.kind, "runtime", 80),
					code: boundedToken(input.code, "unknown", 80),
					status: boundedToken(input.status, "failed", 40)
				};
				const bucket = boundedToken(input.duration_bucket || input.durationBucket || "", "", 40);
				if (bucket) out.duration_bucket = bucket;
				const fields = safeFields(input.fields || {});
				if (Object.keys(fields).length) out.fields = fields;
				return out;
			});
		}
		function safeSeverity(value) {
			const text = String(value || "").trim().toUpperCase();
			return text === "H1" || text === "H2" || text === "H3" ? text : "H2";
		}
		function safeConfidence(value) {
			const number = Number(value);
			if (!Number.isFinite(number)) return .7;
			return Math.max(0, Math.min(1, Math.round(number * 100) / 100));
		}
		function sanitizeInput(input = {}) {
			const category = boundedToken(input.category, "codex_runtime_failure", 80);
			const diagnosticType = boundedToken(input.diagnostic_type || input.diagnosticType, category, 80);
			const errorCode = boundedToken(input.error_code || input.errorCode, `${diagnosticType}_failed`, 100);
			const context = safeContext(input.context || {});
			const counts = safeCounts(input.counts || {});
			const breadcrumbs = safeBreadcrumbs(input.breadcrumbs || []);
			const bucket = boundedToken(input.duration_bucket || input.durationBucket || durationBucket(input.durationMs), "", 40);
			return {
				category,
				diagnostic_type: diagnosticType,
				severity_hint: safeSeverity(input.severity_hint || input.severityHint),
				evidence_confidence: safeConfidence(input.evidence_confidence || input.evidenceConfidence),
				error_code: errorCode,
				duration_bucket: bucket,
				counts,
				context,
				breadcrumbs
			};
		}
		function isSlowPathEvent(event) {
			return event && event.category === "thread_session_slow_path" && /_slow_path$/.test(event.diagnostic_type || "");
		}
		function clearKeyFor(event) {
			if (isSlowPathEvent(event)) return [
				event.category,
				event.diagnostic_type,
				event.context.surface || "",
				event.context.route_kind || ""
			].join("|");
			return [
				event.category,
				event.diagnostic_type,
				event.context.surface || "",
				event.context.action || "",
				event.context.route_kind || "",
				event.context.thread_hash || "",
				event.context.task_hash || "",
				event.context.item_hash || ""
			].join("|");
		}
		function signatureFor(event) {
			if (isSlowPathEvent(event)) return [clearKeyFor(event), event.error_code].join("|");
			return [
				clearKeyFor(event),
				event.error_code,
				event.context.build_id || "",
				event.context.read_mode || "",
				event.context.render_mode || "",
				event.context.source_kind || ""
			].join("|");
		}
		function reportFor(event, repeatedFailures) {
			const counts = Object.assign({}, event.counts, { repeated_failures: boundedNumber(repeatedFailures, 1) });
			const breadcrumbs = event.breadcrumbs.length ? event.breadcrumbs : [{
				kind: event.context.surface || event.category,
				code: event.error_code,
				status: "failed",
				fields: safeFields({
					repeated_failures: repeatedFailures,
					thread_hash: event.context.thread_hash || "",
					task_hash: event.context.task_hash || "",
					item_hash: event.context.item_hash || ""
				})
			}];
			return {
				type: "homeai.diagnostic.report",
				version: 1,
				pluginId: PLUGIN_ID,
				category: event.category,
				diagnostic_type: event.diagnostic_type,
				severity_hint: event.severity_hint,
				evidence_confidence: event.evidence_confidence,
				error_code: event.error_code,
				duration_bucket: event.duration_bucket || void 0,
				counts,
				context: event.context,
				breadcrumbs
			};
		}
		function normalizeSlowPathReportMode(options = {}) {
			const mode = String(options.slowPathReportMode || "").trim().toLowerCase();
			if (mode === "report" || mode === "post") return "report";
			if (mode === "observe" || mode === "local" || mode === "off") return "observe";
			if (options.reportSlowPath === true || options.allowSlowPathReports === true) return "report";
			return DEFAULT_SLOW_PATH_REPORT_MODE;
		}
		function createDiagnosticReporter(options = {}) {
			const threshold = Math.max(1, Number(options.threshold || DEFAULT_THRESHOLD) || DEFAULT_THRESHOLD);
			const throttleMs = Math.max(0, Number(options.throttleMs || DEFAULT_THROTTLE_MS) || DEFAULT_THROTTLE_MS);
			const slowPathReportMode = normalizeSlowPathReportMode(options);
			const now = typeof options.now === "function" ? options.now : () => Date.now();
			const failures = /* @__PURE__ */ new Map();
			const lastReportedAt = /* @__PURE__ */ new Map();
			function recordFailure(input) {
				const event = sanitizeInput(input || {});
				const signature = signatureFor(event);
				const clearKey = clearKeyFor(event);
				const previous = failures.get(signature);
				const count = (previous && previous.count ? previous.count : 0) + 1;
				failures.set(signature, {
					count,
					clearKey,
					lastAt: now()
				});
				if (isSlowPathEvent(event) && slowPathReportMode !== "report") return {
					eligible: false,
					report: null,
					repeatedFailures: count,
					signature,
					clearKey,
					threshold,
					observeOnly: true,
					reason: "slow_path_observe_only"
				};
				const lastReportAt = Number(lastReportedAt.get(signature) || 0);
				if (!(count >= threshold && (!lastReportAt || now() - lastReportAt >= throttleMs))) return {
					eligible: false,
					report: null,
					repeatedFailures: count,
					signature,
					clearKey,
					threshold,
					observeOnly: false,
					reason: "below_threshold_or_throttled"
				};
				lastReportedAt.set(signature, now());
				return {
					eligible: true,
					report: reportFor(event, count),
					repeatedFailures: count,
					signature,
					clearKey,
					threshold,
					observeOnly: false,
					reason: "eligible"
				};
			}
			function recordSuccess(input) {
				const event = sanitizeInput(input || {});
				if (isSlowPathEvent(event)) return {
					cleared: 0,
					clearKey: clearKeyFor(event),
					reason: "slow-path-rolling-window"
				};
				const clearKey = clearKeyFor(event);
				let cleared = 0;
				for (const [signature, entry] of failures.entries()) if (entry && entry.clearKey === clearKey) {
					failures.delete(signature);
					cleared += 1;
				}
				return {
					cleared,
					clearKey
				};
			}
			function failureCount(input) {
				const signature = signatureFor(sanitizeInput(input || {}));
				const entry = failures.get(signature);
				return entry ? entry.count : 0;
			}
			return {
				failureCount,
				recordFailure,
				recordSuccess,
				threshold,
				throttleMs,
				slowPathReportMode
			};
		}
		function postReportToHomeAi(options = {}) {
			const report = options.report;
			const parentWindow = options.parentWindow;
			const selfWindow = options.selfWindow || null;
			if (!options.embedded) return {
				ok: false,
				reason: "not_embedded"
			};
			if (!report || report.type !== "homeai.diagnostic.report") return {
				ok: false,
				reason: "invalid_report"
			};
			if (!parentWindow || selfWindow && parentWindow === selfWindow) return {
				ok: false,
				reason: "missing_parent"
			};
			try {
				parentWindow.postMessage(report, options.targetOrigin || "*");
				return {
					ok: true,
					reason: "posted"
				};
			} catch (_) {
				return {
					ok: false,
					reason: "post_failed"
				};
			}
		}
		return {
			DEFAULT_THRESHOLD,
			DEFAULT_THROTTLE_MS,
			DEFAULT_SLOW_PATH_REPORT_MODE,
			boundedToken,
			createDiagnosticReporter,
			durationBucket,
			hashIdentifier,
			postReportToHomeAi,
			sanitizeInput,
			stableTextHash
		};
	});
}));
//#endregion
//#region public/thread-diagnostic-events.js
var require_thread_diagnostic_events = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexThreadDiagnosticEvents = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		const MAX_COUNT = 1e5;
		function compactToken(value, fallback = "", maxLength = 80) {
			return String(value || "").trim().replace(/[^a-zA-Z0-9_.:-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, maxLength) || fallback;
		}
		function boundedCount(value) {
			const number = Number(value);
			if (!Number.isFinite(number) || number < 0) return 0;
			return Math.min(MAX_COUNT, Math.trunc(number));
		}
		function boundedRolloutMb(value) {
			const number = Number(value);
			if (!Number.isFinite(number) || number <= 0) return 0;
			return boundedCount(Math.ceil(number / (1024 * 1024)));
		}
		function boundedPayloadKb(value) {
			const number = Number(value);
			if (!Number.isFinite(number) || number <= 0) return 0;
			return boundedCount(Math.ceil(number / 1024));
		}
		function projectionDiagnosticContext(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			const out = {
				surface: compactToken(source.surface, "conversation-render", 80),
				action: compactToken(source.action, "render", 80)
			};
			const routeKind = compactToken(source.route_kind || source.routeKind, "", 80);
			const readMode = compactToken(source.read_mode || source.readMode, "", 80);
			const renderMode = compactToken(source.render_mode || source.renderMode, "", 80);
			const threadHash = compactToken(source.thread_hash || source.threadHash, "", 80);
			const turnHash = compactToken(source.turn_hash || source.turnHash, "", 80);
			if (routeKind) out.route_kind = routeKind;
			if (readMode) out.read_mode = readMode;
			if (renderMode) out.render_mode = renderMode;
			if (threadHash) out.thread_hash = threadHash;
			if (turnHash) out.turn_hash = turnHash;
			return out;
		}
		function projectionDiagnosticCounts(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			const out = {
				dom_count: boundedCount(source.dom_count || source.domCount),
				duplicate_count: boundedCount(source.duplicate_count || source.duplicateCount),
				visible_count: boundedCount(source.visible_count || source.visibleCount),
				turn_count: boundedCount(source.turn_count || source.turnCount)
			};
			const paneCount = boundedCount(source.pane_count || source.paneCount);
			if (paneCount) out.pane_count = paneCount;
			const orderMismatchCount = boundedCount(source.order_mismatch_count || source.orderMismatchCount);
			if (orderMismatchCount) out.order_mismatch_count = orderMismatchCount;
			const latestMismatchCount = boundedCount(source.latest_mismatch_count || source.latestMismatchCount);
			if (latestMismatchCount) out.latest_mismatch_count = latestMismatchCount;
			const missingDomTurnCount = boundedCount(source.missing_dom_turn_count || source.missingDomTurnCount);
			if (missingDomTurnCount) out.missing_dom_turn_count = missingDomTurnCount;
			return out;
		}
		function projectionDiagnosticSnapshot(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			return {
				renderedSignature: String(source.renderedSignature || ""),
				currentSignature: String(source.currentSignature || ""),
				context: projectionDiagnosticContext(source.context || {}),
				counts: projectionDiagnosticCounts(source.counts || {})
			};
		}
		function visibleShapeFrom(deps, thread) {
			if (typeof deps.visibleShape === "function") {
				const shape = deps.visibleShape(thread);
				if (shape && typeof shape === "object") return shape;
			}
			return {
				visibleTurnCount: 0,
				visibleItemCount: 0
			};
		}
		function domCountsFromShape(domShape = {}) {
			return {
				dom_count: domShape.renderKeyCount || domShape.dom_count || domShape.domCount,
				duplicate_count: domShape.duplicateRenderKeyCount || domShape.duplicate_count || domShape.duplicateCount
			};
		}
		function conversationProjectionDiagnosticSnapshot(input = {}, deps = {}) {
			const source = input && typeof input === "object" ? input : {};
			const action = compactToken(source.source || source.action, "render", 80);
			const renderMode = compactToken(source.renderMode || source.render_mode, "", 80);
			const renderedSignature = String(source.renderedConversationSignature || source.renderedSignature || "");
			const baseCounts = domCountsFromShape(source.domShape && typeof source.domShape === "object" ? source.domShape : {});
			const tileMode = source.threadTileMode === true;
			const tileDomActive = source.tileDomActive === true;
			if (tileMode) {
				if (!tileDomActive) return null;
				const layout = source.tileLayout || (typeof deps.tileLayout === "function" ? deps.tileLayout() : null);
				if (!layout || !layout.enabled) return null;
				const ids = Array.isArray(source.tileIds) ? source.tileIds : typeof deps.tileCandidateIds === "function" ? deps.tileCandidateIds(layout) : [];
				if (!ids.length) return null;
				const displayLayout = source.tileDisplayLayout || (typeof deps.tileDisplayLayout === "function" ? deps.tileDisplayLayout(layout, ids) : layout);
				const currentSignature = source.tileSignature || source.currentSignature || (typeof deps.tileRenderSignature === "function" ? deps.tileRenderSignature(displayLayout, ids) : "");
				const visibleShape = ids.reduce((acc, id) => {
					const shape = visibleShapeFrom(deps, typeof deps.tileThreadForId === "function" ? deps.tileThreadForId(id) : null);
					acc.visibleTurnCount += boundedCount(shape.visibleTurnCount);
					acc.visibleItemCount += boundedCount(shape.visibleItemCount);
					return acc;
				}, {
					visibleTurnCount: 0,
					visibleItemCount: 0
				});
				return projectionDiagnosticSnapshot({
					renderedSignature,
					currentSignature,
					context: {
						surface: "conversation-render",
						action,
						route_kind: "thread-tile",
						read_mode: "mixed",
						render_mode: renderMode
					},
					counts: Object.assign({}, baseCounts, {
						visible_count: visibleShape.visibleItemCount,
						turn_count: visibleShape.visibleTurnCount,
						pane_count: ids.length
					})
				});
			}
			if (tileDomActive) return null;
			const thread = source.thread || null;
			const visibleShape = visibleShapeFrom(deps, thread);
			return projectionDiagnosticSnapshot({
				renderedSignature,
				currentSignature: source.currentSignature || (typeof deps.singleSignature === "function" ? deps.singleSignature(thread) : ""),
				context: {
					surface: "conversation-render",
					action,
					read_mode: thread && thread.mobileReadMode || "",
					render_mode: renderMode
				},
				counts: Object.assign({}, baseCounts, {
					visible_count: visibleShape.visibleItemCount,
					turn_count: visibleShape.visibleTurnCount
				})
			});
		}
		function turnOrderDiagnosticSnapshot(input = {}, deps = {}) {
			const source = input && typeof input === "object" ? input : {};
			const expectedIds = Array.isArray(source.expectedTurnIds) ? source.expectedTurnIds.map((id) => String(id || "")).filter(Boolean) : [];
			const domIds = Array.isArray(source.domTurnIds) ? source.domTurnIds.map((id) => String(id || "")).filter(Boolean) : [];
			if (!expectedIds.length) return null;
			const comparableCount = Math.min(expectedIds.length, domIds.length);
			let orderMismatchCount = Math.abs(expectedIds.length - domIds.length);
			for (let index = 0; index < comparableCount; index += 1) if (expectedIds[index] !== domIds[index]) orderMismatchCount += 1;
			const expectedLatestId = expectedIds[expectedIds.length - 1] || "";
			const domLatestId = domIds[domIds.length - 1] || "";
			const latestMismatch = Boolean(expectedLatestId && (!domLatestId || expectedLatestId !== domLatestId));
			const turnHash = compactToken(source.turnHash || (typeof deps.turnHash === "function" ? deps.turnHash(expectedLatestId) : ""), "", 80);
			return projectionDiagnosticSnapshot({
				context: {
					surface: "conversation-render",
					action: source.source || source.action,
					read_mode: source.readMode || source.read_mode,
					render_mode: source.renderMode || source.render_mode,
					thread_hash: source.threadHash || source.thread_hash,
					turn_hash: turnHash
				},
				counts: {
					dom_count: domIds.length,
					visible_count: expectedIds.length,
					turn_count: expectedIds.length,
					order_mismatch_count: orderMismatchCount,
					latest_mismatch_count: latestMismatch ? 1 : 0,
					missing_dom_turn_count: !domIds.length ? expectedIds.length : 0
				}
			});
		}
		function hasRenderSignatureMismatch(snapshot) {
			const normalized = projectionDiagnosticSnapshot(snapshot);
			return Boolean(normalized.renderedSignature && normalized.renderedSignature !== normalized.currentSignature);
		}
		function hasDuplicateRenderKeys(snapshot) {
			return projectionDiagnosticSnapshot(snapshot).counts.duplicate_count > 0;
		}
		function hasTurnOrderMismatch(snapshot) {
			const counts = projectionDiagnosticSnapshot(snapshot).counts;
			return counts.order_mismatch_count > 0 || counts.latest_mismatch_count > 0 || counts.missing_dom_turn_count > 0;
		}
		function renderSignatureMismatchDiagnosticEvent(snapshot = {}) {
			const normalized = projectionDiagnosticSnapshot(snapshot);
			const context = normalized.context;
			const counts = normalized.counts;
			return {
				category: "conversation_projection_mismatch",
				diagnostic_type: "render_signature_mismatch",
				severity_hint: "H2",
				evidence_confidence: .74,
				error_code: "render_signature_mismatch",
				context,
				counts,
				breadcrumbs: [{
					kind: "conversation-render",
					code: "signature-check",
					status: "failed",
					fields: {
						read_mode: context.read_mode || "",
						render_mode: context.render_mode || "",
						dom_count: counts.dom_count,
						visible_count: counts.visible_count
					}
				}]
			};
		}
		function renderSignatureMismatchDiagnosticSuccess(snapshot = {}) {
			return {
				category: "conversation_projection_mismatch",
				diagnostic_type: "render_signature_mismatch",
				error_code: "render_signature_mismatch",
				context: projectionDiagnosticSnapshot(snapshot).context
			};
		}
		function duplicateRenderKeysDiagnosticEvent(snapshot = {}) {
			const normalized = projectionDiagnosticSnapshot(snapshot);
			const counts = normalized.counts;
			return {
				category: "conversation_projection_mismatch",
				diagnostic_type: "duplicate_render_keys",
				severity_hint: "H2",
				evidence_confidence: .78,
				error_code: "duplicate_render_keys",
				context: normalized.context,
				counts,
				breadcrumbs: [{
					kind: "conversation-render",
					code: "render-key-check",
					status: "failed",
					fields: {
						duplicate_count: counts.duplicate_count,
						dom_count: counts.dom_count,
						visible_count: counts.visible_count
					}
				}]
			};
		}
		function duplicateRenderKeysDiagnosticSuccess(snapshot = {}) {
			return {
				category: "conversation_projection_mismatch",
				diagnostic_type: "duplicate_render_keys",
				error_code: "duplicate_render_keys",
				context: projectionDiagnosticSnapshot(snapshot).context
			};
		}
		function turnOrderMismatchDiagnosticEvent(snapshot = {}) {
			const normalized = projectionDiagnosticSnapshot(snapshot);
			const counts = normalized.counts;
			const context = normalized.context;
			return {
				category: "conversation_projection_mismatch",
				diagnostic_type: "turn_order_mismatch",
				severity_hint: "H2",
				evidence_confidence: .82,
				error_code: "turn_order_mismatch",
				context,
				counts,
				breadcrumbs: [{
					kind: "conversation-render",
					code: "turn-order-check",
					status: "failed",
					fields: {
						read_mode: context.read_mode || "",
						render_mode: context.render_mode || "",
						dom_count: counts.dom_count,
						visible_count: counts.visible_count,
						turn_hash: context.turn_hash || "",
						order_mismatch_count: counts.order_mismatch_count || 0,
						latest_mismatch_count: counts.latest_mismatch_count || 0,
						missing_dom_turn_count: counts.missing_dom_turn_count || 0
					}
				}]
			};
		}
		function turnOrderMismatchDiagnosticSuccess(snapshot = {}) {
			return {
				category: "conversation_projection_mismatch",
				diagnostic_type: "turn_order_mismatch",
				error_code: "turn_order_mismatch",
				context: projectionDiagnosticSnapshot(snapshot).context
			};
		}
		function conversationProjectionConsistencyEffects(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			const snapshot = source.snapshot || null;
			const orderSnapshot = source.orderSnapshot || null;
			const effects = [];
			if (snapshot) {
				const normalized = projectionDiagnosticSnapshot(snapshot);
				const signatureMismatch = hasRenderSignatureMismatch(normalized);
				effects.push({
					type: signatureMismatch ? "diagnostic-failure" : "diagnostic-success",
					diagnostic: signatureMismatch ? renderSignatureMismatchDiagnosticEvent(normalized) : renderSignatureMismatchDiagnosticSuccess(normalized),
					diagnosticType: "render_signature_mismatch",
					reason: signatureMismatch ? "render-signature-mismatch" : "render-signature-match"
				});
				const duplicateKeys = hasDuplicateRenderKeys(normalized);
				effects.push({
					type: duplicateKeys ? "diagnostic-failure" : "diagnostic-success",
					diagnostic: duplicateKeys ? duplicateRenderKeysDiagnosticEvent(normalized) : duplicateRenderKeysDiagnosticSuccess(normalized),
					diagnosticType: "duplicate_render_keys",
					reason: duplicateKeys ? "duplicate-render-keys" : "no-duplicate-render-keys"
				});
			}
			if (orderSnapshot) {
				const normalizedOrder = projectionDiagnosticSnapshot(orderSnapshot);
				const turnOrderMismatch = hasTurnOrderMismatch(normalizedOrder);
				effects.push({
					type: turnOrderMismatch ? "diagnostic-failure" : "diagnostic-success",
					diagnostic: turnOrderMismatch ? turnOrderMismatchDiagnosticEvent(normalizedOrder) : turnOrderMismatchDiagnosticSuccess(normalizedOrder),
					diagnosticType: "turn_order_mismatch",
					reason: turnOrderMismatch ? "turn-order-mismatch" : "turn-order-match"
				});
			}
			return {
				effects,
				reason: effects.length ? "projection-consistency-effects" : "no-snapshot"
			};
		}
		function primaryShellSelectionConflictContext(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			const context = {
				surface: "conversation-render",
				action: compactToken(source.action, "primary-shell-selection", 80),
				route_kind: compactToken(source.routeKind || source.route_kind, "embedded-primary", 80)
			};
			const readMode = compactToken(source.readMode || source.read_mode, "", 80);
			const renderMode = compactToken(source.renderMode || source.render_mode, "", 80);
			const sourceKind = compactToken(source.sourceKind || source.source_kind, "", 80);
			const threadHash = compactToken(source.threadHash || source.thread_hash, "", 80);
			if (readMode) context.read_mode = readMode;
			if (renderMode) context.render_mode = renderMode;
			if (sourceKind) context.source_kind = sourceKind;
			if (threadHash) context.thread_hash = threadHash;
			return context;
		}
		function primaryShellSelectionConflictCounts(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			return {
				visible_count: boundedCount(source.visibleItems || source.visible_count),
				turn_count: boundedCount(source.turns || source.turn_count),
				item_count: boundedCount(source.items || source.item_count),
				dom_count: boundedCount(source.domCount || source.dom_count),
				previous_count: boundedCount(source.previousCount || source.previous_count),
				has_current_thread: source.hasCurrentThread || source.has_current_thread ? 1 : 0,
				has_current_thread_id: source.hasCurrentThreadId || source.has_current_thread_id ? 1 : 0,
				has_thread_load_controller: source.hasThreadLoadController || source.has_thread_load_controller ? 1 : 0,
				startup_thread_open_pending: source.startupThreadOpenPending || source.startup_thread_open_pending ? 1 : 0,
				mobile_loading: source.mobileLoading || source.mobile_loading ? 1 : 0,
				recent_detail_age_ms: boundedCount(source.recentDetailAgeMs || source.recent_detail_age_ms)
			};
		}
		function primaryShellSelectionConflictDiagnosticEvent(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			const context = primaryShellSelectionConflictContext(source);
			const counts = primaryShellSelectionConflictCounts(source);
			return {
				category: "conversation_projection_mismatch",
				diagnostic_type: "primary_shell_selection_conflict",
				severity_hint: "H2",
				evidence_confidence: .82,
				error_code: compactToken(source.reason, "primary_shell_selection_conflict", 80),
				context,
				counts,
				breadcrumbs: [{
					kind: "conversation-render",
					code: "primary-shell-selection",
					status: "failed",
					fields: {
						read_mode: context.read_mode || "",
						render_mode: context.render_mode || "",
						source_kind: context.source_kind || "",
						thread_hash: context.thread_hash || "",
						dom_count: counts.dom_count,
						visible_count: counts.visible_count,
						turn_count: counts.turn_count,
						item_count: counts.item_count,
						previous_count: counts.previous_count
					}
				}]
			};
		}
		function primaryShellSelectionConflictDiagnosticSuccess(input = {}) {
			return {
				category: "conversation_projection_mismatch",
				diagnostic_type: "primary_shell_selection_conflict",
				error_code: "primary_shell_selection_conflict",
				context: primaryShellSelectionConflictContext(input)
			};
		}
		function emptyVisibleDetailMismatchContext(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			const context = {
				surface: "conversation-render",
				action: compactToken(source.action, "single-thread-empty-state", 80),
				route_kind: compactToken(source.routeKind || source.route_kind, "single-thread", 80)
			};
			const readMode = compactToken(source.readMode || source.read_mode, "", 80);
			const renderMode = compactToken(source.renderMode || source.render_mode, "", 80);
			const sourceKind = compactToken(source.sourceKind || source.source_kind, "", 80);
			const threadHash = compactToken(source.threadHash || source.thread_hash, "", 80);
			if (readMode) context.read_mode = readMode;
			if (renderMode) context.render_mode = renderMode;
			if (sourceKind) context.source_kind = sourceKind;
			if (threadHash) context.thread_hash = threadHash;
			return context;
		}
		function emptyVisibleDetailMismatchCounts(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			return {
				visible_count: boundedCount(source.visibleItems || source.visible_count),
				turn_count: boundedCount(source.turns || source.turn_count),
				item_count: boundedCount(source.items || source.item_count),
				current_visible_count: boundedCount(source.currentVisibleItems || source.current_visible_count),
				current_turn_count: boundedCount(source.currentTurns || source.current_turn_count),
				dom_count: boundedCount(source.domCount || source.dom_count),
				previous_count: boundedCount(source.previousCount || source.previous_count),
				detail_loaded: source.detailLoaded || source.detail_loaded ? 1 : 0,
				mobile_loading: source.mobileLoading || source.mobile_loading ? 1 : 0,
				recent_detail_age_ms: boundedCount(source.recentDetailAgeMs || source.recent_detail_age_ms)
			};
		}
		function emptyVisibleDetailMismatchDiagnosticEvent(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			const context = emptyVisibleDetailMismatchContext(source);
			const counts = emptyVisibleDetailMismatchCounts(source);
			return {
				category: "conversation_projection_mismatch",
				diagnostic_type: "empty_visible_detail_mismatch",
				severity_hint: "H2",
				evidence_confidence: .84,
				error_code: compactToken(source.reason, "empty_visible_detail_mismatch", 80),
				context,
				counts,
				breadcrumbs: [{
					kind: "conversation-render",
					code: "empty-state-contract",
					status: "failed",
					fields: {
						read_mode: context.read_mode || "",
						render_mode: context.render_mode || "",
						source_kind: context.source_kind || "",
						thread_hash: context.thread_hash || "",
						visible_count: counts.visible_count,
						turn_count: counts.turn_count,
						item_count: counts.item_count,
						dom_count: counts.dom_count,
						previous_count: counts.previous_count
					}
				}]
			};
		}
		function emptyVisibleDetailMismatchDiagnosticSuccess(input = {}) {
			return {
				category: "conversation_projection_mismatch",
				diagnostic_type: "empty_visible_detail_mismatch",
				error_code: "empty_visible_detail_mismatch",
				context: emptyVisibleDetailMismatchContext(input)
			};
		}
		function emptyCachedDetailReuseContext(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			const context = {
				surface: "thread-session",
				action: compactToken(source.action, "thread-open-cache-reuse", 80),
				route_kind: compactToken(source.routeKind || source.route_kind, "single-thread", 80)
			};
			const readMode = compactToken(source.readMode || source.read_mode, "", 80);
			const sourceKind = compactToken(source.sourceKind || source.source_kind, "", 80);
			const threadHash = compactToken(source.threadHash || source.thread_hash, "", 80);
			if (readMode) context.read_mode = readMode;
			if (sourceKind) context.source_kind = sourceKind;
			if (threadHash) context.thread_hash = threadHash;
			return context;
		}
		function emptyCachedDetailReuseCounts(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			return {
				current_turn_count: boundedCount(source.currentTurns || source.current_turn_count),
				current_visible_count: boundedCount(source.currentVisibleItems || source.current_visible_count),
				item_count: boundedCount(source.items || source.item_count),
				detail_loaded: source.detailLoaded || source.detail_loaded ? 1 : 0,
				reusable_detail: source.reusableDetail || source.reusable_detail ? 1 : 0,
				mobile_loading: source.mobileLoading || source.mobile_loading ? 1 : 0,
				thread_task_card_count: boundedCount(source.threadTaskCardCount || source.thread_task_card_count)
			};
		}
		function emptyCachedDetailReuseBlockedDiagnosticEvent(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			const context = emptyCachedDetailReuseContext(source);
			const counts = emptyCachedDetailReuseCounts(source);
			return {
				category: "conversation_projection_mismatch",
				diagnostic_type: "empty_cached_detail_reuse_blocked",
				severity_hint: "H2",
				evidence_confidence: .8,
				error_code: compactToken(source.reason, "empty_cached_detail_reuse_blocked", 80),
				context,
				counts,
				breadcrumbs: [{
					kind: "thread-session",
					code: "thread-open-cache-reuse",
					status: "blocked",
					fields: {
						read_mode: context.read_mode || "",
						source_kind: context.source_kind || "",
						thread_hash: context.thread_hash || "",
						current_turn_count: counts.current_turn_count,
						current_visible_count: counts.current_visible_count,
						item_count: counts.item_count,
						detail_loaded: counts.detail_loaded,
						reusable_detail: counts.reusable_detail
					}
				}]
			};
		}
		function emptyCachedDetailReuseDiagnosticSuccess(input = {}) {
			return {
				category: "conversation_projection_mismatch",
				diagnostic_type: "empty_cached_detail_reuse_blocked",
				error_code: "empty_cached_detail_reuse_blocked",
				context: emptyCachedDetailReuseContext(input)
			};
		}
		function detailPatchRejectedDiagnosticEvent(input = {}) {
			const readMode = compactToken(input.readMode, "", 80);
			const renderMode = compactToken(input.renderMode, "", 80);
			const renderPlanReason = compactToken(input.renderPlanReason, "", 80);
			const patchRejectReason = compactToken(input.patchRejectReason, "unknown", 80);
			const previousCount = boundedCount(input.previousVisibleItemCount);
			const visibleCount = boundedCount(input.visibleItemCount);
			return {
				category: "conversation_projection_mismatch",
				diagnostic_type: "detail_patch_rejected",
				severity_hint: "H3",
				evidence_confidence: .7,
				error_code: "detail_patch_rejected",
				context: {
					surface: "conversation-render",
					action: "thread-detail-refresh",
					read_mode: readMode,
					render_mode: renderMode,
					render_plan_reason: renderPlanReason,
					patch_reject_reason: patchRejectReason
				},
				counts: {
					previous_count: previousCount,
					visible_count: visibleCount
				},
				breadcrumbs: [{
					kind: "conversation-render",
					code: "detail-patch",
					status: "rejected",
					fields: {
						read_mode: readMode,
						render_mode: renderMode,
						render_plan_reason: renderPlanReason,
						patch_reject_reason: patchRejectReason,
						visible_count: visibleCount
					}
				}]
			};
		}
		function threadDetailRefreshFailedDiagnosticEvent(input = {}) {
			const threadHash = compactToken(input.threadHash, "", 80);
			const errorCode = compactToken(input.errorCode, "thread_detail_refresh_failed", 80);
			const durationBucket = compactToken(input.durationBucket, "", 80);
			const statusCode = boundedCount(input.statusCode);
			return {
				category: "thread_session_load_failed",
				diagnostic_type: "thread_detail_refresh_failed",
				severity_hint: "H2",
				evidence_confidence: .74,
				error_code: errorCode,
				duration_bucket: durationBucket,
				context: {
					surface: "thread-session",
					action: "thread-detail-refresh",
					thread_hash: threadHash
				},
				counts: { status_code: statusCode },
				breadcrumbs: [{
					kind: "thread-session",
					code: "thread-detail-refresh",
					status: "failed",
					duration_bucket: durationBucket,
					fields: {
						status_code: statusCode,
						thread_hash: threadHash
					}
				}]
			};
		}
		function threadDetailLoadFailedDiagnosticEvent(input = {}) {
			const threadHash = compactToken(input.threadHash, "", 80);
			const errorCode = compactToken(input.errorCode, "thread_detail_load_failed", 80);
			const durationBucket = compactToken(input.durationBucket, "", 80);
			const statusCode = boundedCount(input.statusCode);
			return {
				category: "thread_session_load_failed",
				diagnostic_type: "thread_detail_load_failed",
				severity_hint: "H2",
				evidence_confidence: .76,
				error_code: errorCode,
				duration_bucket: durationBucket,
				context: {
					surface: "thread-session",
					action: "thread-detail-load",
					thread_hash: threadHash
				},
				counts: { status_code: statusCode },
				breadcrumbs: [{
					kind: "thread-session",
					code: "thread-detail-load",
					status: "failed",
					duration_bucket: durationBucket,
					fields: {
						status_code: statusCode,
						thread_hash: threadHash
					}
				}]
			};
		}
		function threadDetailSlowPathDiagnosticEvent(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			const action = compactToken(source.action, "thread-detail", 80);
			const reason = compactToken(source.reason, "elapsed-slow", 80);
			const readMode = compactToken(source.readMode || source.read_mode, "", 80);
			const renderMode = compactToken(source.renderMode || source.render_mode, "", 80);
			const performancePhase = compactToken(source.performancePhase || source.performance_phase, "", 80);
			const coldPathOwner = compactToken(source.coldPathOwner || source.cold_path_owner, "", 80);
			const coldPathReason = compactToken(source.coldPathReason || source.cold_path_reason, "", 80);
			const threadHash = compactToken(source.threadHash || source.thread_hash, "", 80);
			const durationBucket = compactToken(source.durationBucket || source.duration_bucket, "", 80);
			const counts = {
				elapsed_ms: boundedCount(source.elapsedMs || source.elapsed_ms),
				api_elapsed_ms: boundedCount(source.apiElapsedMs || source.api_elapsed_ms),
				render_elapsed_ms: boundedCount(source.renderElapsedMs || source.render_elapsed_ms),
				threshold_ms: boundedCount(source.thresholdMs || source.threshold_ms),
				turn_count: boundedCount(source.turns || source.turn_count),
				visible_count: boundedCount(source.visibleItems || source.visible_count),
				omitted_turns: boundedCount(source.omittedTurns || source.omitted_turns)
			};
			const rolloutMb = boundedRolloutMb(source.rolloutSizeBytes || source.rollout_size_bytes);
			if (rolloutMb) counts.rollout_mb = rolloutMb;
			const context = {
				surface: "thread-session",
				action
			};
			if (threadHash) context.thread_hash = threadHash;
			if (readMode) context.read_mode = readMode;
			if (renderMode) context.render_mode = renderMode;
			if (performancePhase) context.performance_phase = performancePhase;
			if (coldPathOwner) context.cold_path_owner = coldPathOwner;
			if (coldPathReason) context.cold_path_reason = coldPathReason;
			return {
				category: "thread_session_slow_path",
				diagnostic_type: "thread_detail_slow_path",
				severity_hint: compactToken(source.severityHint || source.severity_hint, "H3", 8),
				evidence_confidence: .7,
				error_code: reason,
				duration_bucket: durationBucket,
				context,
				counts,
				breadcrumbs: [{
					kind: "thread-session",
					code: "thread-detail-slow-path",
					status: "slow",
					duration_bucket: durationBucket,
					fields: {
						read_mode: readMode,
						render_mode: renderMode,
						performance_phase: performancePhase,
						cold_path_owner: coldPathOwner,
						cold_path_reason: coldPathReason,
						elapsed_ms: counts.elapsed_ms,
						api_elapsed_ms: counts.api_elapsed_ms,
						render_elapsed_ms: counts.render_elapsed_ms,
						threshold_ms: counts.threshold_ms,
						thread_hash: threadHash
					}
				}]
			};
		}
		function threadDetailSlowPathDiagnosticSuccess(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			const context = {
				surface: "thread-session",
				action: compactToken(source.action, "thread-detail", 80)
			};
			const threadHash = compactToken(source.threadHash || source.thread_hash, "", 80);
			if (threadHash) context.thread_hash = threadHash;
			const readMode = compactToken(source.readMode || source.read_mode, "", 80);
			if (readMode) context.read_mode = readMode;
			const renderMode = compactToken(source.renderMode || source.render_mode, "", 80);
			if (renderMode) context.render_mode = renderMode;
			return {
				category: "thread_session_slow_path",
				diagnostic_type: "thread_detail_slow_path",
				error_code: "thread_detail_slow_path",
				context
			};
		}
		function threadListSlowPathDiagnosticEvent(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			const action = compactToken(source.action, "thread-list-load", 80);
			const reason = compactToken(source.reason, "elapsed-slow", 80);
			const performancePhase = compactToken(source.performancePhase || source.performance_phase, "", 80);
			const coldPathOwner = compactToken(source.coldPathOwner || source.cold_path_owner, "", 80);
			const coldPathReason = compactToken(source.coldPathReason || source.cold_path_reason, "", 80);
			const fallbackCacheDecision = compactToken(source.fallbackCacheDecision || source.fallback_cache_decision, "", 80);
			const fallbackDeferredReason = compactToken(source.fallbackDeferredReason || source.fallback_deferred_reason, "", 80);
			const appServerDeferredReason = compactToken(source.appServerDeferredReason || source.app_server_deferred_reason, "", 80);
			const appServerRequestReason = compactToken(source.appServerRequestReason || source.app_server_request_reason, "", 80);
			const durationBucket = compactToken(source.durationBucket || source.duration_bucket, "", 80);
			const counts = {
				elapsed_ms: boundedCount(source.elapsedMs || source.elapsed_ms),
				api_elapsed_ms: boundedCount(source.apiElapsedMs || source.api_elapsed_ms),
				render_elapsed_ms: boundedCount(source.renderElapsedMs || source.render_elapsed_ms),
				threshold_ms: boundedCount(source.thresholdMs || source.threshold_ms),
				result_count: boundedCount(source.count || source.result_count),
				server_total_ms: boundedCount(source.totalMs || source.total_ms),
				app_server_ms: boundedCount(source.appServerMs || source.app_server_ms),
				app_server_rpc_ms: boundedCount(source.appServerRpcMs || source.app_server_rpc_ms),
				app_server_unattributed_ms: boundedCount(source.appServerUnattributedMs || source.app_server_unattributed_ms),
				fallback_ms: boundedCount(source.fallbackMs || source.fallback_ms),
				merge_ms: boundedCount(source.mergeMs || source.merge_ms),
				summary_merge_ms: boundedCount(source.summaryMergeTotalMs || source.summary_merge_ms),
				fallback_snapshot_age_ms: boundedCount(source.fallbackSourceSnapshotAgeMs || source.fallback_snapshot_age_ms),
				fallback_rollout_stat_count: boundedCount(source.fallbackRolloutFileStatCount || source.fallback_rollout_stat_count),
				fallback_rollout_head_read_count: boundedCount(source.fallbackRolloutHeadReadCount || source.fallback_rollout_head_read_count),
				fallback_rollout_summary_read_count: boundedCount(source.fallbackRolloutSummaryReadCount || source.fallback_rollout_summary_read_count),
				app_server_request_limit: boundedCount(source.appServerRequestLimit || source.app_server_request_limit),
				app_server_response_kb: boundedCount(source.appServerResponsePayloadKb || source.app_server_response_kb) || boundedPayloadKb(source.appServerResponsePayloadBytes || source.app_server_response_bytes),
				silent: source.silent || source.is_silent ? 1 : 0,
				has_search: source.hasSearch || source.has_search ? 1 : 0,
				has_workspace: source.hasWorkspace || source.has_workspace ? 1 : 0,
				mobile_fallback: source.mobileFallback || source.mobile_fallback ? 1 : 0
			};
			const context = {
				surface: "thread-session",
				action
			};
			if (performancePhase) context.performance_phase = performancePhase;
			if (coldPathOwner) context.cold_path_owner = coldPathOwner;
			if (coldPathReason) context.cold_path_reason = coldPathReason;
			if (fallbackCacheDecision) context.fallback_cache_decision = fallbackCacheDecision;
			if (fallbackDeferredReason) context.fallback_deferred_reason = fallbackDeferredReason;
			if (appServerDeferredReason) context.app_server_deferred_reason = appServerDeferredReason;
			if (appServerRequestReason) context.app_server_request_reason = appServerRequestReason;
			return {
				category: "thread_session_slow_path",
				diagnostic_type: "thread_list_slow_path",
				severity_hint: compactToken(source.severityHint || source.severity_hint, "H3", 8),
				evidence_confidence: .7,
				error_code: reason,
				duration_bucket: durationBucket,
				context,
				counts,
				breadcrumbs: [{
					kind: "thread-session",
					code: "thread-list-slow-path",
					status: "slow",
					duration_bucket: durationBucket,
					fields: {
						performance_phase: performancePhase,
						cold_path_owner: coldPathOwner,
						cold_path_reason: coldPathReason,
						fallback_cache_decision: fallbackCacheDecision,
						app_server_request_reason: appServerRequestReason,
						elapsed_ms: counts.elapsed_ms,
						api_elapsed_ms: counts.api_elapsed_ms,
						render_elapsed_ms: counts.render_elapsed_ms,
						threshold_ms: counts.threshold_ms,
						result_count: counts.result_count
					}
				}]
			};
		}
		function threadListSlowPathDiagnosticSuccess(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			const context = {
				surface: "thread-session",
				action: compactToken(source.action, "thread-list-load", 80)
			};
			const performancePhase = compactToken(source.performancePhase || source.performance_phase, "", 80);
			if (performancePhase) context.performance_phase = performancePhase;
			return {
				category: "thread_session_slow_path",
				diagnostic_type: "thread_list_slow_path",
				error_code: "thread_list_slow_path",
				context
			};
		}
		function threadDetailResponseContractDiagnosticContext(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			const context = {
				surface: "thread-session",
				action: compactToken(source.action, "thread-detail", 80)
			};
			const threadHash = compactToken(source.threadHash || source.thread_hash, "", 80);
			const readMode = compactToken(source.readMode || source.read_mode, "", 80);
			const renderMode = compactToken(source.renderMode || source.render_mode, "", 80);
			const performancePhase = compactToken(source.performancePhase || source.performance_phase, "", 80);
			const projectionSource = compactToken(source.projectionSource || source.projection_source, "", 80);
			const projectionPartialKind = compactToken(source.projectionPartialKind || source.projection_partial_kind, "", 80);
			if (threadHash) context.thread_hash = threadHash;
			if (readMode) context.read_mode = readMode;
			if (renderMode) context.render_mode = renderMode;
			if (performancePhase) context.performance_phase = performancePhase;
			if (projectionSource) context.projection_source = projectionSource;
			if (projectionPartialKind) context.projection_partial_kind = projectionPartialKind;
			return context;
		}
		function threadDetailResponseContractCounts(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			const out = {
				turn_count: boundedCount(source.turns || source.turn_count),
				item_count: boundedCount(source.items || source.item_count),
				visible_count: boundedCount(source.visibleItems || source.visible_count),
				active_turn_count: boundedCount(source.activeTurns || source.active_turn_count),
				completed_turn_count: boundedCount(source.completedTurns || source.completed_turn_count),
				omitted_turns: boundedCount(source.omittedTurns || source.omitted_turns),
				older_cursor: source.olderCursor || source.older_cursor ? 1 : 0,
				newer_cursor: source.newerCursor || source.newer_cursor ? 1 : 0,
				projection_partial: source.projectionPartial || source.projection_partial ? 1 : 0,
				response_budget_applied: source.responseBudgetApplied || source.response_budget_applied ? 1 : 0,
				response_budget_progressive_active: source.responseBudgetProgressiveActiveApplied || source.response_budget_progressive_active ? 1 : 0,
				response_budget_active_turn_count: boundedCount(source.responseBudgetActiveTurnCount || source.response_budget_active_turn_count),
				response_budget_retained_item_count: boundedCount(source.responseBudgetRetainedItemCount || source.response_budget_retained_item_count)
			};
			const rolloutMb = boundedRolloutMb(source.rolloutSizeBytes || source.rollout_size_bytes);
			if (rolloutMb) out.rollout_mb = rolloutMb;
			return out;
		}
		function threadDetailResponseContractDiagnosticEvent(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			const reason = compactToken(source.reason, "thread-detail-response-contract", 80);
			const context = threadDetailResponseContractDiagnosticContext(source);
			const counts = threadDetailResponseContractCounts(source);
			return {
				category: "conversation_projection_mismatch",
				diagnostic_type: "thread_detail_response_contract_mismatch",
				severity_hint: compactToken(source.severityHint || source.severity_hint, "H2", 8),
				evidence_confidence: .82,
				error_code: reason,
				duration_bucket: compactToken(source.durationBucket || source.duration_bucket, "", 80),
				context,
				counts,
				breadcrumbs: [{
					kind: "thread-session",
					code: "thread-detail-response-contract",
					status: "failed",
					fields: {
						read_mode: context.read_mode || "",
						render_mode: context.render_mode || "",
						performance_phase: context.performance_phase || "",
						projection_source: context.projection_source || "",
						projection_partial_kind: context.projection_partial_kind || "",
						turn_count: counts.turn_count,
						item_count: counts.item_count,
						visible_count: counts.visible_count,
						active_turn_count: counts.active_turn_count,
						older_cursor: counts.older_cursor,
						newer_cursor: counts.newer_cursor,
						projection_partial: counts.projection_partial,
						response_budget_applied: counts.response_budget_applied,
						response_budget_progressive_active: counts.response_budget_progressive_active,
						response_budget_active_turn_count: counts.response_budget_active_turn_count,
						response_budget_retained_item_count: counts.response_budget_retained_item_count,
						thread_hash: context.thread_hash || ""
					}
				}]
			};
		}
		function threadDetailResponseContractDiagnosticSuccess(input = {}) {
			return {
				category: "conversation_projection_mismatch",
				diagnostic_type: "thread_detail_response_contract_mismatch",
				error_code: "thread_detail_response_contract_mismatch",
				context: threadDetailResponseContractDiagnosticContext(input)
			};
		}
		function threadDetailResponseDiagnosticEffects(input = {}) {
			const source = input && typeof input === "object" ? input : {};
			const effects = [];
			const slowPlan = source.slowPlan && typeof source.slowPlan === "object" ? source.slowPlan : null;
			if (slowPlan) {
				const shouldReport = slowPlan.shouldReport === true;
				effects.push({
					type: shouldReport ? "diagnostic-failure" : "diagnostic-success",
					diagnostic: shouldReport ? threadDetailSlowPathDiagnosticEvent(slowPlan) : threadDetailSlowPathDiagnosticSuccess(source.slowSuccessInput || {}),
					diagnosticType: "thread_detail_slow_path",
					reason: shouldReport ? compactToken(slowPlan.reason, "thread-detail-slow-path", 80) : "thread-detail-slow-path-ok"
				});
			}
			const contractPlan = source.contractPlan && typeof source.contractPlan === "object" ? source.contractPlan : null;
			if (contractPlan) {
				const shouldReport = contractPlan.shouldReport === true;
				effects.push({
					type: shouldReport ? "diagnostic-failure" : "diagnostic-success",
					diagnostic: shouldReport ? threadDetailResponseContractDiagnosticEvent(contractPlan) : threadDetailResponseContractDiagnosticSuccess(contractPlan),
					diagnosticType: "thread_detail_response_contract_mismatch",
					reason: shouldReport ? compactToken(contractPlan.reason, "thread-detail-response-contract", 80) : "thread-detail-response-contract-ok"
				});
			}
			return {
				effects,
				reason: effects.length ? "thread-detail-response-diagnostic-effects" : "no-diagnostic-plans"
			};
		}
		return {
			boundedCount,
			compactToken,
			detailPatchRejectedDiagnosticEvent,
			duplicateRenderKeysDiagnosticEvent,
			duplicateRenderKeysDiagnosticSuccess,
			emptyCachedDetailReuseBlockedDiagnosticEvent,
			emptyCachedDetailReuseDiagnosticSuccess,
			emptyVisibleDetailMismatchDiagnosticEvent,
			emptyVisibleDetailMismatchDiagnosticSuccess,
			hasDuplicateRenderKeys,
			hasRenderSignatureMismatch,
			hasTurnOrderMismatch,
			conversationProjectionDiagnosticSnapshot,
			conversationProjectionConsistencyEffects,
			primaryShellSelectionConflictDiagnosticEvent,
			primaryShellSelectionConflictDiagnosticSuccess,
			projectionDiagnosticContext,
			projectionDiagnosticCounts,
			projectionDiagnosticSnapshot,
			renderSignatureMismatchDiagnosticEvent,
			renderSignatureMismatchDiagnosticSuccess,
			threadDetailResponseContractDiagnosticEvent,
			threadDetailResponseDiagnosticEffects,
			threadDetailResponseContractDiagnosticSuccess,
			threadDetailLoadFailedDiagnosticEvent,
			threadDetailSlowPathDiagnosticEvent,
			threadDetailSlowPathDiagnosticSuccess,
			threadListSlowPathDiagnosticEvent,
			threadListSlowPathDiagnosticSuccess,
			turnOrderDiagnosticSnapshot,
			threadDetailRefreshFailedDiagnosticEvent,
			turnOrderMismatchDiagnosticEvent,
			turnOrderMismatchDiagnosticSuccess
		};
	});
}));
//#endregion
//#region public/thread-tile-layout.js
var require_thread_tile_layout = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexThreadTileLayout = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		const DEFAULT_MIN_DESKTOP_PANE_WIDTH = 420;
		const DEFAULT_MIN_DESKTOP_MANUAL_PANE_WIDTH = 300;
		const DEFAULT_MIN_TABLET_PANE_WIDTH = 260;
		const DEFAULT_MIN_LANDSCAPE_VIEWPORT_WIDTH = 760;
		const DEFAULT_MIN_PANE_HEIGHT = 360;
		const DEFAULT_MIN_LANDSCAPE_VIEWPORT_HEIGHT = 480;
		const DEFAULT_MAX_PANES = 6;
		const DEFAULT_USER_MAX_PANES = 12;
		function positiveNumber(value, fallback = 0) {
			const parsed = Number(value);
			return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
		}
		function clampInteger(value, min, max) {
			const parsed = Math.floor(positiveNumber(value, min));
			return Math.max(min, Math.min(max, parsed));
		}
		function viewportOrientation(width, height) {
			return positiveNumber(width) >= positiveNumber(height) ? "landscape" : "portrait";
		}
		function layoutForViewport(input = {}) {
			const enabled = input.enabled === true;
			const viewportWidth = positiveNumber(input.viewportWidth);
			const viewportHeight = positiveNumber(input.viewportHeight);
			const sidebarWidth = Math.max(0, Number(input.sidebarWidth || 0) || 0);
			const coarsePointer = input.coarsePointer === true;
			const orientation = String(input.orientation || viewportOrientation(viewportWidth, viewportHeight));
			const minLandscapeViewportWidth = positiveNumber(input.minLandscapeViewportWidth, DEFAULT_MIN_LANDSCAPE_VIEWPORT_WIDTH);
			const minLandscapeViewportHeight = positiveNumber(input.minLandscapeViewportHeight, DEFAULT_MIN_LANDSCAPE_VIEWPORT_HEIGHT);
			const landscapeTile = orientation === "landscape" && viewportWidth >= minLandscapeViewportWidth && viewportHeight >= minLandscapeViewportHeight;
			const menuOverlay = input.menuOverlay === true;
			const tabletLandscape = landscapeTile && (coarsePointer || menuOverlay);
			const maxPanes = clampInteger(input.maxPanes || DEFAULT_MAX_PANES, 1, DEFAULT_USER_MAX_PANES);
			const recommendedMaxPanes = clampInteger(input.recommendedMaxPanes || DEFAULT_MAX_PANES, 1, maxPanes);
			const desiredPaneCount = Math.max(0, Math.min(maxPanes, Math.floor(Number(input.desiredPaneCount || 0)) || 0));
			if (!enabled || viewportWidth <= 0 || viewportHeight <= 0) return {
				enabled: false,
				reason: "disabled",
				columns: 1,
				rows: 1,
				maxPanes: 1,
				recommendedMaxPanes: 1
			};
			if (coarsePointer && orientation !== "landscape") return {
				enabled: false,
				reason: "tablet-portrait",
				columns: 1,
				rows: 1,
				maxPanes: 1,
				recommendedMaxPanes: 1
			};
			if (menuOverlay && !tabletLandscape) return {
				enabled: false,
				reason: "narrow",
				columns: 1,
				rows: 1,
				maxPanes: 1,
				recommendedMaxPanes: 1
			};
			const availableWidth = Math.max(0, viewportWidth - (menuOverlay ? 0 : sidebarWidth));
			const availableHeight = Math.max(0, viewportHeight - Math.max(0, Number(input.verticalChromePx || 0) || 0));
			const manualTargetWidth = desiredPaneCount > 0 && availableWidth > 0 ? Math.floor(availableWidth / desiredPaneCount) : 0;
			const defaultMinPaneWidth = tabletLandscape ? DEFAULT_MIN_TABLET_PANE_WIDTH : desiredPaneCount > 0 ? Math.min(DEFAULT_MIN_DESKTOP_PANE_WIDTH, Math.max(DEFAULT_MIN_DESKTOP_MANUAL_PANE_WIDTH, manualTargetWidth)) : DEFAULT_MIN_DESKTOP_PANE_WIDTH;
			const minPaneWidth = positiveNumber(input.minPaneWidth, defaultMinPaneWidth);
			const minPaneHeight = positiveNumber(input.minPaneHeight, DEFAULT_MIN_PANE_HEIGHT);
			const rawColumns = Math.floor(availableWidth / minPaneWidth);
			const rawRows = Math.floor(availableHeight / minPaneHeight);
			const minimumColumns = tabletLandscape ? 2 : 2;
			const columns = Math.max(minimumColumns, Math.min(tabletLandscape ? Math.min(4, maxPanes) : maxPanes, rawColumns || 0));
			if (columns < minimumColumns || availableWidth < minPaneWidth * minimumColumns * .86) return {
				enabled: false,
				reason: "insufficient-width",
				columns: 1,
				rows: 1,
				maxPanes: 1,
				recommendedMaxPanes: 1,
				availableWidth,
				availableHeight
			};
			const rows = Math.max(1, Math.min(tabletLandscape ? 1 : 2, rawRows || 1));
			return {
				enabled: true,
				reason: tabletLandscape ? "tablet-landscape" : "wide",
				columns,
				rows,
				maxPanes: Math.max(1, Math.min(maxPanes, columns * rows)),
				recommendedMaxPanes: Math.max(1, Math.min(recommendedMaxPanes, columns * rows)),
				availableWidth,
				availableHeight,
				minPaneWidth,
				minPaneHeight
			};
		}
		function uniqueThreadIds(values = []) {
			const seen = /* @__PURE__ */ new Set();
			const ids = [];
			for (const value of values || []) {
				const id = String(value || "").trim();
				if (!id || seen.has(id)) continue;
				seen.add(id);
				ids.push(id);
			}
			return ids;
		}
		function selectThreadTileIds(input = {}) {
			const maxPanes = clampInteger(input.maxPanes || 1, 1, 12);
			return uniqueThreadIds([
				input.currentThreadId,
				...Array.isArray(input.pinnedThreadIds) ? input.pinnedThreadIds : [],
				...Array.isArray(input.threadIds) ? input.threadIds : []
			]).slice(0, maxPanes);
		}
		function selectPinnedThreadTileIds(input = {}) {
			const maxPanes = clampInteger(input.maxPanes || 1, 1, 12);
			const currentThreadId = String(input.currentThreadId || "").trim();
			const ids = uniqueThreadIds([...Array.isArray(input.pinnedThreadIds) ? input.pinnedThreadIds : [], ...Array.isArray(input.threadIds) ? input.threadIds : []]).slice(0, maxPanes);
			if (!currentThreadId || ids.includes(currentThreadId)) return ids;
			if (ids.length >= maxPanes) ids[Math.max(0, maxPanes - 1)] = currentThreadId;
			else ids.push(currentThreadId);
			return uniqueThreadIds(ids).slice(0, maxPanes);
		}
		function normalizeSplitPairs(values = [], ids = []) {
			const idSet = new Set(uniqueThreadIds(ids));
			const used = /* @__PURE__ */ new Set();
			const pairs = [];
			for (const value of Array.isArray(values) ? values : []) {
				const anchorId = String(Array.isArray(value) ? value[0] : value && (value.anchorId || value.topId || value.primaryId) || "").trim();
				const childId = String(Array.isArray(value) ? value[1] : value && (value.childId || value.bottomId || value.secondaryId) || "").trim();
				if (!anchorId || !childId || anchorId === childId) continue;
				if (idSet.size && (!idSet.has(anchorId) || !idSet.has(childId))) continue;
				if (used.has(anchorId) || used.has(childId)) continue;
				used.add(anchorId);
				used.add(childId);
				pairs.push({
					anchorId,
					childId
				});
			}
			return pairs;
		}
		function threadTileColumnGroups(input = {}) {
			const ids = uniqueThreadIds(input.ids || input.threadIds || []);
			const columns = clampInteger(input.columns || 1, 1, DEFAULT_USER_MAX_PANES);
			if (!ids.length) return [];
			const pairs = normalizeSplitPairs(input.splitPairs || input.paneSplitPairs || [], ids);
			const pairByAnchor = new Map(pairs.map((pair) => [pair.anchorId, pair.childId]));
			const childIds = new Set(pairs.map((pair) => pair.childId));
			const atomicGroups = [];
			for (const id of ids) {
				if (childIds.has(id)) continue;
				const childId = pairByAnchor.get(id);
				atomicGroups.push(childId ? [id, childId] : [id]);
			}
			const targetColumns = Math.max(1, Math.min(columns, atomicGroups.length));
			const groups = atomicGroups.slice(0, targetColumns).map((group) => group.slice());
			atomicGroups.slice(targetColumns).forEach((group, index) => {
				const targetIndex = Math.max(0, targetColumns - 1 - index % targetColumns);
				groups[targetIndex].push(...group);
			});
			return groups.filter((group) => group.length);
		}
		return {
			DEFAULT_MAX_PANES,
			DEFAULT_USER_MAX_PANES,
			DEFAULT_MIN_DESKTOP_MANUAL_PANE_WIDTH,
			DEFAULT_MIN_DESKTOP_PANE_WIDTH,
			DEFAULT_MIN_LANDSCAPE_VIEWPORT_WIDTH,
			DEFAULT_MIN_LANDSCAPE_VIEWPORT_HEIGHT,
			DEFAULT_MIN_PANE_HEIGHT,
			DEFAULT_MIN_TABLET_PANE_WIDTH,
			layoutForViewport,
			normalizeSplitPairs,
			selectPinnedThreadTileIds,
			selectThreadTileIds,
			threadTileColumnGroups
		};
	});
}));
//#endregion
//#region public/thread-tile-actions.js
var require_thread_tile_actions = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexThreadTileActions = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		const TILE_CONTROL_SELECTOR = [
			"[data-thread-tile-switch-target]",
			".thread-tile-switch-menu",
			"[data-thread-tile-bottom]",
			"[data-thread-tile-operation-toggle]",
			"[data-thread-tile-pane-count]",
			"[data-thread-tile-close-pane]"
		].join(", ");
		function withinRoot(root, node) {
			if (!root || !node || typeof root.contains !== "function") return true;
			return root.contains(node);
		}
		function closestWithin(target, selector, root = null) {
			if (!target || typeof target.closest !== "function") return null;
			const node = target.closest(selector);
			if (!node || !withinRoot(root, node)) return null;
			return node;
		}
		function attr(node, name) {
			if (!node || typeof node.getAttribute !== "function") return "";
			return String(node.getAttribute(name) || "");
		}
		function paneFor(node, root = null) {
			return closestWithin(node, "[data-thread-tile-pane]", root);
		}
		function paneIdFor(node, root = null) {
			return attr(paneFor(node, root), "data-thread-tile-pane");
		}
		function action(type, target, fields = {}) {
			return Object.assign({
				action: String(type || "none"),
				target: target || null,
				preventDefault: false,
				stopPropagation: false
			}, fields);
		}
		function resolveThreadTilePointerAction(input = {}) {
			const target = input.target || null;
			const root = input.root || null;
			const title = closestWithin(target, "[data-thread-tile-title]", root);
			if (title) return action("select-pane", title, {
				paneId: paneIdFor(title, root),
				source: "title"
			});
			const control = closestWithin(target, TILE_CONTROL_SELECTOR, root);
			if (control) return action("stop-control", control, { stopPropagation: true });
			const pane = closestWithin(target, "[data-thread-tile-pane]", root);
			if (pane) return action("select-pane", pane, {
				paneId: attr(pane, "data-thread-tile-pane"),
				source: "pane"
			});
			return action("none", null, { reason: "no-match" });
		}
		function resolveThreadTileFocusAction(input = {}) {
			const target = input.target || null;
			const root = input.root || null;
			const ignored = closestWithin(target, "[data-thread-tile-title], [data-thread-tile-switch-target], .thread-tile-switch-menu", root);
			if (ignored) return action("none", ignored, { reason: "ignored-control" });
			const pane = closestWithin(target, "[data-thread-tile-pane]", root);
			if (pane) return action("select-pane", pane, {
				paneId: attr(pane, "data-thread-tile-pane"),
				source: "focus"
			});
			return action("none", null, { reason: "no-match" });
		}
		function resolveThreadTileClickAction(input = {}) {
			const target = input.target || null;
			const root = input.root || null;
			let node = closestWithin(target, "[data-thread-tile-title]", root);
			if (node) return action("toggle-switch-menu", node, {
				paneId: attr(node, "data-thread-tile-title"),
				preventDefault: true,
				stopPropagation: true
			});
			node = closestWithin(target, "[data-thread-tile-switch-target]", root);
			if (node) return action("switch-pane-thread", node, {
				fromId: paneIdFor(node, root),
				toId: attr(node, "data-thread-tile-switch-target"),
				preventDefault: true,
				stopPropagation: true
			});
			node = closestWithin(target, "[data-thread-tile-pane-count]", root);
			if (node) return action("change-pane-count", node, {
				delta: Number(attr(node, "data-thread-tile-pane-count") || 0),
				disabled: Boolean(node.disabled),
				preventDefault: true,
				stopPropagation: true
			});
			node = closestWithin(target, "[data-thread-tile-close-pane]", root);
			if (node) return action("close-pane", node, {
				paneId: attr(node, "data-thread-tile-close-pane"),
				disabled: Boolean(node.disabled),
				preventDefault: true,
				stopPropagation: true
			});
			node = closestWithin(target, "[data-thread-tile-bottom]", root);
			if (node) return action("scroll-pane-bottom", node, {
				paneId: attr(node, "data-thread-tile-bottom"),
				preventDefault: true
			});
			node = closestWithin(target, "[data-thread-tile-operation-toggle]", root);
			if (node) return action("toggle-operation", node, {
				paneId: attr(node, "data-thread-tile-operation-toggle"),
				preventDefault: true,
				stopPropagation: true
			});
			return action("none", null, { reason: "no-match" });
		}
		function resolveThreadTileScrollAction(input = {}) {
			const body = closestWithin(input.target || null, ".thread-tile-pane-body", input.root || null);
			if (body) return action("pane-scroll", body, { body });
			return action("none", null, { reason: "no-match" });
		}
		function resolveThreadTileDragStartAction(input = {}) {
			const handle = closestWithin(input.target || null, "[data-thread-tile-drag-handle]", input.root || null);
			if (!handle) return action("none", null, { reason: "no-handle" });
			const paneId = attr(handle, "data-thread-tile-drag-handle");
			if (!paneId) return action("none", handle, { reason: "missing-pane-id" });
			return action("drag-start", handle, {
				handle,
				paneId,
				pane: paneFor(handle, input.root || null)
			});
		}
		function resolveThreadTileDragOverAction(input = {}) {
			const root = input.root || null;
			const pane = closestWithin(input.target || null, "[data-thread-tile-pane]", root);
			const dragging = String(input.draggingId || "");
			const targetId = attr(pane, "data-thread-tile-pane");
			if (!dragging || !targetId || dragging === targetId || !pane) return action("none", pane, { reason: "invalid-drag-target" });
			return action("drag-over", pane, {
				pane,
				targetId,
				preventDefault: true
			});
		}
		function resolveThreadTileDragLeaveAction(input = {}) {
			const pane = closestWithin(input.target || null, "[data-thread-tile-pane]", input.root || null);
			if (pane) return action("drag-leave", pane, { pane });
			return action("none", null, { reason: "no-match" });
		}
		function resolveThreadTileDropAction(input = {}) {
			const root = input.root || null;
			const pane = closestWithin(input.target || null, "[data-thread-tile-pane]", root);
			const dragging = String(input.draggingId || input.transferId || "");
			const targetId = attr(pane, "data-thread-tile-pane");
			if (!dragging || !targetId || dragging === targetId || !pane) return action("none", pane, { reason: "invalid-drop-target" });
			return action("drop-pane", pane, {
				pane,
				draggingId: dragging,
				targetId,
				preventDefault: true,
				stopPropagation: true
			});
		}
		return {
			closestWithin,
			resolveThreadTilePointerAction,
			resolveThreadTileFocusAction,
			resolveThreadTileClickAction,
			resolveThreadTileScrollAction,
			resolveThreadTileDragStartAction,
			resolveThreadTileDragOverAction,
			resolveThreadTileDragLeaveAction,
			resolveThreadTileDropAction
		};
	});
}));
//#endregion
//#region public/thread-tile-state.js
var require_thread_tile_state = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexThreadTileState = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		const DEFAULT_USER_MAX_PANES = 12;
		const DEFAULT_DETAIL_LOAD_MAX_CONCURRENT = 4;
		const DEFAULT_OPERATION_BUBBLE_MIN_VISIBLE_MS = 500;
		const DEFAULT_PANE_NEAR_BOTTOM_PX = 48;
		const DEFAULT_PANE_SCROLLABLE_DELTA_PX = 96;
		function text(value) {
			return String(value || "");
		}
		function nowValue(value) {
			const parsed = Number(value);
			return Number.isFinite(parsed) ? parsed : Date.now();
		}
		function nonNegativeNumber(value, fallback = 0) {
			const parsed = Number(value);
			return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
		}
		function maxPaneLimit(maxPanes = DEFAULT_USER_MAX_PANES) {
			const parsed = Math.floor(Number(maxPanes));
			return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_USER_MAX_PANES;
		}
		function normalizePaneCount(value, options = {}) {
			const fallback = Number.isFinite(Number(options.fallback)) ? Math.floor(Number(options.fallback)) : 0;
			const parsed = Math.floor(Number(value));
			if (!Number.isFinite(parsed)) return fallback;
			return Math.max(0, Math.min(maxPaneLimit(options.maxPanes), parsed));
		}
		function normalizePinnedIds(values = [], options = {}) {
			const seen = /* @__PURE__ */ new Set();
			const ids = [];
			const limit = Math.max(1, maxPaneLimit(options.maxPanes) * Math.max(1, Number(options.overflowMultiplier || 2) || 2));
			for (const value of Array.isArray(values) ? values : []) {
				const id = String(value || "").trim();
				if (!id || seen.has(id)) continue;
				seen.add(id);
				ids.push(id);
				if (ids.length >= limit) break;
			}
			return ids;
		}
		function uniqueIds(values = []) {
			const seen = /* @__PURE__ */ new Set();
			const ids = [];
			for (const value of Array.isArray(values) ? values : []) {
				const id = text(value).trim();
				if (!id || seen.has(id)) continue;
				seen.add(id);
				ids.push(id);
			}
			return ids;
		}
		function idsEqual(a = [], b = []) {
			if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
			return a.every((id, index) => String(id || "") === String(b[index] || ""));
		}
		function candidatePaneIdsPlan(input = {}, options = {}) {
			const maxPanes = Math.max(1, normalizePaneCount(input.maxPanes, {
				fallback: 1,
				maxPanes: options.maxPanes || DEFAULT_USER_MAX_PANES
			}) || 1);
			const defaultIds = uniqueIds(input.defaultIds || input.threadIds || []).slice(0, maxPanes);
			const visibleIds = new Set(uniqueIds(input.visibleIds || []));
			const pinnedIds = normalizePinnedIds(input.pinnedIds || input.threadTilePinnedIds || [], { maxPanes: options.maxPanes || DEFAULT_USER_MAX_PANES }).filter((id) => visibleIds.has(id));
			const currentThreadId = text(input.currentThreadId).trim();
			if (!pinnedIds.length) return {
				action: "candidate-pane-ids",
				reason: "defaults",
				ids: defaultIds,
				pinnedIds,
				defaultIds,
				maxPanes
			};
			if (typeof options.selectPinnedThreadTileIds === "function") return {
				action: "candidate-pane-ids",
				reason: "selector",
				ids: uniqueIds(options.selectPinnedThreadTileIds({
					currentThreadId,
					pinnedThreadIds: pinnedIds,
					threadIds: defaultIds,
					maxPanes
				})).slice(0, maxPanes),
				pinnedIds,
				defaultIds,
				maxPanes
			};
			const ids = uniqueIds([...pinnedIds, ...defaultIds]).slice(0, maxPanes);
			if (currentThreadId && !ids.includes(currentThreadId)) ids[Math.max(0, ids.length - 1)] = currentThreadId;
			return {
				action: "candidate-pane-ids",
				reason: "fallback",
				ids: uniqueIds(ids).slice(0, maxPanes),
				pinnedIds,
				defaultIds,
				maxPanes
			};
		}
		function paneCountStatePlan(input = {}, options = {}) {
			const maxPanes = maxPaneLimit(options.maxPanes || input.maxPanes || DEFAULT_USER_MAX_PANES);
			const capacity = Math.max(1, normalizePaneCount(input.capacity || input.layoutCapacity, {
				fallback: 1,
				maxPanes
			}) || 1);
			const candidateIds = uniqueIds(input.candidateIds || input.defaultIds || []).slice(0, capacity);
			const candidateCount = candidateIds.length;
			const maxCandidateIds = uniqueIds(input.maxCandidateIds || input.maximumCandidateIds || input.allCandidateIds || candidateIds);
			const maxCandidateCount = Math.max(1, Math.min(maxPanes, maxCandidateIds.length || candidateCount || 1));
			const runningSet = new Set(uniqueIds(input.runningIds || []));
			const currentThreadId = text(input.currentThreadId).trim();
			if (currentThreadId) runningSet.add(currentThreadId);
			const runningCount = runningSet.size;
			const explicitPaneCount = normalizePaneCount(Object.prototype.hasOwnProperty.call(input, "explicitPaneCount") ? input.explicitPaneCount : Object.prototype.hasOwnProperty.call(input, "paneCount") ? input.paneCount : input.threadTilePaneCount, {
				fallback: 0,
				maxPanes
			});
			let autoPaneCount = 1;
			if (candidateCount > 0) autoPaneCount = Math.max(1, Math.min(capacity, candidateCount, Math.max(capacity > 1 ? Math.min(2, candidateCount, capacity) : 1, runningCount)));
			return {
				action: "pane-count-state",
				reason: explicitPaneCount > 0 ? "explicit" : "auto",
				capacity,
				candidateIds,
				candidateCount,
				maxCandidateIds,
				maxCandidateCount,
				runningCount,
				explicitPaneCount,
				autoPaneCount,
				effectivePaneCount: explicitPaneCount > 0 ? Math.max(1, Math.min(maxCandidateCount, explicitPaneCount)) : Math.max(1, Math.min(capacity, candidateCount || 1, autoPaneCount)),
				minPaneCount: Math.min(capacity, candidateCount || 1) >= 2 ? 2 : 1,
				maxPaneCount: maxCandidateCount
			};
		}
		function layoutCapacity(input = {}, options = {}) {
			const maxPanes = maxPaneLimit(options.capacityMaxPanes || options.maxPanes || DEFAULT_USER_MAX_PANES);
			const value = Object.prototype.hasOwnProperty.call(input, "recommendedMaxPanes") ? input.recommendedMaxPanes : input.maxPanes;
			const parsed = Math.floor(Number(value || 1));
			return Math.max(1, Math.min(maxPanes, Number.isFinite(parsed) && parsed > 0 ? parsed : 1));
		}
		function viewportSize(value = {}) {
			return {
				width: Math.round(nonNegativeNumber(value && value.width, 0)),
				height: Math.round(nonNegativeNumber(value && value.height, 0))
			};
		}
		function threadTileViewportBaselinePlan(input = {}) {
			const layoutViewport = viewportSize(input.layoutViewport || input.viewport || {});
			const baseline = viewportSize(input.baseline || input.previousBaseline || {});
			const keyboardActive = input.keyboardActive === true;
			const hasBaseline = baseline.width > 0 && baseline.height > 0;
			if (!keyboardActive) return {
				action: "thread-tile-viewport-baseline",
				reason: "layout-viewport",
				keyboardActive,
				viewport: layoutViewport,
				nextBaseline: layoutViewport,
				updateBaseline: true
			};
			return {
				action: "thread-tile-viewport-baseline",
				reason: hasBaseline ? "keyboard-baseline" : "keyboard-layout-viewport",
				keyboardActive,
				viewport: hasBaseline ? baseline : layoutViewport,
				nextBaseline: hasBaseline ? baseline : layoutViewport,
				updateBaseline: false
			};
		}
		function threadTileVerticalChromePlan(input = {}, options = {}) {
			const keyboardActive = input.keyboardActive === true;
			const composerHeightPx = nonNegativeNumber(input.composerHeightPx, 0);
			const baselineComposerHeightPx = nonNegativeNumber(input.baselineComposerHeightPx, 0);
			const minChromePx = nonNegativeNumber(Object.prototype.hasOwnProperty.call(options, "minChromePx") ? options.minChromePx : input.minChromePx, 120);
			const extraChromePx = nonNegativeNumber(Object.prototype.hasOwnProperty.call(options, "extraChromePx") ? options.extraChromePx : input.extraChromePx, 64);
			const effectiveComposerHeightPx = keyboardActive && baselineComposerHeightPx ? baselineComposerHeightPx : composerHeightPx;
			return {
				action: "thread-tile-vertical-chrome",
				reason: keyboardActive ? baselineComposerHeightPx ? "keyboard-baseline" : "keyboard-composer" : "composer-baseline",
				keyboardActive,
				composerHeightPx: effectiveComposerHeightPx,
				nextComposerHeightBaselinePx: keyboardActive ? baselineComposerHeightPx : composerHeightPx || baselineComposerHeightPx || 0,
				updateBaseline: !keyboardActive,
				verticalChromePx: Math.max(minChromePx, effectiveComposerHeightPx + extraChromePx)
			};
		}
		function normalizeColumnGroups(values = []) {
			return (Array.isArray(values) ? values : []).map((group) => uniqueIds(Array.isArray(group) ? group : [])).filter((group) => group.length);
		}
		function paneDisplayLayoutPlan(input = {}, options = {}) {
			const layout = input.layout && typeof input.layout === "object" ? input.layout : input;
			const ids = uniqueIds(input.ids || input.threadIds || []);
			const effectivePaneCount = normalizePaneCount(Object.prototype.hasOwnProperty.call(input, "effectivePaneCount") ? input.effectivePaneCount : input.count, {
				fallback: 0,
				maxPanes: options.maxPanes
			});
			const count = Math.max(1, ids.length ? ids.length : effectivePaneCount || 1);
			const capacityColumns = Math.max(1, Math.floor(Number(layout && layout.columns || 1)) || 1);
			const columns = Math.max(1, Math.min(capacityColumns, count));
			const splitPairs = Array.isArray(input.splitPairs || input.paneSplitPairs) ? input.splitPairs || input.paneSplitPairs : [];
			const groupFn = typeof options.threadTileColumnGroups === "function" ? options.threadTileColumnGroups : null;
			const columnGroups = normalizeColumnGroups(groupFn ? groupFn({
				ids,
				columns,
				splitPairs
			}) : ids.slice(0, count).map((id) => [id]));
			const rows = Math.max(1, ...columnGroups.map((group) => group.length || 1));
			const displayLayout = Object.assign({}, layout, {
				capacityPanes: layoutCapacity(layout, options),
				visiblePanes: count,
				columns: Math.max(1, columnGroups.length || columns),
				rows,
				columnGroups
			});
			return {
				action: "pane-display-layout",
				reason: ids.length ? "thread-ids" : "count-only",
				count,
				capacityColumns,
				columns,
				rows,
				columnGroups,
				displayLayout
			};
		}
		function normalizeIdValuePairs(values = [], ids = []) {
			const idSet = new Set(uniqueIds(ids));
			return (Array.isArray(values) ? values : []).map((entry) => {
				if (Array.isArray(entry)) return [text(entry[0]).trim(), entry.length > 1 ? entry[1] : ""];
				if (entry && typeof entry === "object") return [text(entry.id || entry.threadId || entry.paneId).trim(), Object.prototype.hasOwnProperty.call(entry, "value") ? entry.value : Object.prototype.hasOwnProperty.call(entry, "signature") ? entry.signature : Object.prototype.hasOwnProperty.call(entry, "error") ? entry.error : ""];
				return ["", ""];
			}).filter((entry) => entry[0] && (!idSet.size || idSet.has(entry[0])));
		}
		function paneRenderSignaturePlan(input = {}, options = {}) {
			const layout = input.layout && typeof input.layout === "object" ? input.layout : {};
			const ids = uniqueIds(input.ids || input.threadIds || []);
			const idSet = new Set(ids);
			const signatureObject = {
				view: "thread-tiles",
				columns: layout.columns,
				rows: layout.rows,
				visiblePanes: layout.visiblePanes || ids.length,
				capacityPanes: layout.capacityPanes || layout.maxPanes,
				desiredPaneCount: normalizePaneCount(Object.prototype.hasOwnProperty.call(input, "desiredPaneCount") ? input.desiredPaneCount : input.paneCount, {
					fallback: 0,
					maxPanes: options.maxPanes
				}),
				columnGroups: normalizeColumnGroups(input.columnGroups || layout.columnGroups || []),
				splitPairs: Array.isArray(input.splitPairs || input.paneSplitPairs) ? input.splitPairs || input.paneSplitPairs : [],
				ids,
				selected: text(input.selectedThreadId || input.selected).trim(),
				loading: uniqueIds(input.loadingIds || input.loading || []).filter((id) => !idSet.size || idSet.has(id)),
				switchMenuPaneId: text(input.switchMenuPaneId).trim(),
				errors: normalizeIdValuePairs(input.errors || input.errorPairs || [], ids),
				operations: normalizeIdValuePairs(input.operations || input.operationSignatures || [], ids),
				threads: (Array.isArray(input.threadSignatures || input.threads) ? input.threadSignatures || input.threads : []).map((value) => String(value || ""))
			};
			return {
				action: "pane-render-signature",
				reason: ids.length ? "thread-ids" : "empty",
				ids,
				signatureObject,
				signature: JSON.stringify(signatureObject)
			};
		}
		function paneScrollMetrics(input = {}, options = {}) {
			const scrollHeight = nonNegativeNumber(input.scrollHeight);
			const clientHeight = nonNegativeNumber(input.clientHeight);
			const scrollTop = nonNegativeNumber(input.scrollTop);
			const nearBottomPx = nonNegativeNumber(options.nearBottomPx || input.nearBottomPx, DEFAULT_PANE_NEAR_BOTTOM_PX);
			const distanceFromBottom = Math.max(0, scrollHeight - clientHeight - scrollTop);
			return {
				action: "pane-scroll-metrics",
				distanceFromBottom,
				nearBottom: distanceFromBottom <= nearBottomPx,
				hold: input.hold === true,
				scrollHeight,
				clientHeight,
				scrollTop,
				nearBottomPx
			};
		}
		function paneScrollHoldPlan(input = {}, options = {}) {
			const metrics = input.action === "pane-scroll-metrics" ? input : paneScrollMetrics(input, options);
			return {
				action: "pane-scroll-hold",
				reason: metrics.nearBottom ? "near-bottom" : "away-from-bottom",
				rememberHold: metrics.nearBottom !== true,
				clearHold: metrics.nearBottom === true,
				metrics
			};
		}
		function paneBottomButtonPlan(input = {}, options = {}) {
			const metrics = input.metrics && input.metrics.action === "pane-scroll-metrics" ? input.metrics : paneScrollMetrics(input, options);
			const scrollableDeltaPx = nonNegativeNumber(options.scrollableDeltaPx || input.scrollableDeltaPx, DEFAULT_PANE_SCROLLABLE_DELTA_PX);
			const scrollable = Math.max(0, metrics.scrollHeight - metrics.clientHeight) > scrollableDeltaPx;
			const shouldShow = Boolean(scrollable && !metrics.nearBottom);
			return {
				action: "pane-bottom-button",
				reason: shouldShow ? "show" : scrollable ? "near-bottom" : "not-scrollable",
				shouldShow,
				scrollable,
				scrollableDeltaPx,
				metrics
			};
		}
		function paneScrollRestorePlan(input = {}, options = {}) {
			const previous = input.previous && typeof input.previous === "object" ? input.previous : null;
			const rememberedHold = input.rememberedHold === true;
			const hold = Boolean(previous && previous.hold === true) || rememberedHold;
			const scrollHeight = nonNegativeNumber(input.scrollHeight);
			const clientHeight = nonNegativeNumber(input.clientHeight);
			const distanceFromBottom = nonNegativeNumber(previous && previous.distanceFromBottom);
			if (input.stickToBottom === true || !previous || !hold || previous.nearBottom === true) return {
				action: "pane-scroll-restore",
				reason: input.stickToBottom === true ? "stick-to-bottom" : !previous ? "missing-previous" : !hold ? "no-hold" : "previous-near-bottom",
				mode: "bottom",
				top: Math.max(0, scrollHeight),
				hold
			};
			return {
				action: "pane-scroll-restore",
				reason: "restore-distance",
				mode: "restore-distance",
				top: Math.max(0, scrollHeight - clientHeight - distanceFromBottom),
				hold
			};
		}
		function switchMenuOptionsPlan(input = {}) {
			return uniqueIds([
				text(input.currentId || input.currentThreadId || input.threadId).trim(),
				...Array.isArray(input.activeIds) ? input.activeIds : [],
				...Array.isArray(input.runningIds) ? input.runningIds : [],
				...Array.isArray(input.visibleIds) ? input.visibleIds : []
			]);
		}
		function switchMenuPlan(input = {}) {
			const currentId = text(input.currentId || input.threadId).trim();
			const switchMenuPaneId = text(input.switchMenuPaneId || input.openPaneId).trim();
			const options = uniqueIds(input.options || switchMenuOptionsPlan(input));
			const activeIds = uniqueIds(input.activeIds || []);
			const countInput = Number(input.count);
			const count = Math.max(0, Math.floor(Number.isFinite(countInput) ? countInput : activeIds.length));
			const minCount = Math.max(0, Math.floor(Number(input.minCount || 0)) || 0);
			const maxCount = Math.max(minCount, Math.floor(Number(input.maxCount || 0)) || 0);
			if (!currentId) return {
				action: "skip",
				reason: "missing-id",
				currentId,
				options,
				activeIds,
				count,
				minCount,
				maxCount,
				canClose: false,
				canAdd: false
			};
			if (switchMenuPaneId !== currentId) return {
				action: "skip",
				reason: "closed",
				currentId,
				options,
				activeIds,
				count,
				minCount,
				maxCount,
				canClose: false,
				canAdd: false
			};
			if (!options.length) return {
				action: "skip",
				reason: "no-options",
				currentId,
				options,
				activeIds,
				count,
				minCount,
				maxCount,
				canClose: false,
				canAdd: false
			};
			return {
				action: "render-switch-menu",
				reason: "open",
				currentId,
				options,
				activeIds,
				count,
				minCount,
				maxCount,
				canClose: activeIds.includes(currentId) && count > minCount,
				canAdd: count < maxCount
			};
		}
		function normalizeSplitPairs(values = [], ids = [], options = {}) {
			const visibleIds = normalizePinnedIds(ids, { maxPanes: options.maxPanes });
			const normalize = typeof options.normalizeSplitPairs === "function" ? options.normalizeSplitPairs : null;
			return (normalize ? normalize(values, visibleIds) : []).map((pair) => ({
				anchorId: String(pair && pair.anchorId || ""),
				childId: String(pair && pair.childId || "")
			})).filter((pair) => pair.anchorId && pair.childId);
		}
		function removeSplitPairsForIds(splitPairs = [], ids = []) {
			const remove = new Set((ids || []).map((id) => String(id || "").trim()).filter(Boolean));
			if (!remove.size) return {
				changed: false,
				splitPairs: Array.isArray(splitPairs) ? splitPairs : []
			};
			const current = Array.isArray(splitPairs) ? splitPairs : [];
			const next = current.filter((pair) => pair && !remove.has(String(pair.anchorId || "")) && !remove.has(String(pair.childId || "")));
			return {
				changed: JSON.stringify(next) !== JSON.stringify(current),
				splitPairs: next
			};
		}
		function prependSplitPair(splitPairs = [], anchorId, childId, options = {}) {
			const anchor = String(anchorId || "").trim();
			const child = String(childId || "").trim();
			if (!anchor || !child || anchor === child) return {
				changed: false,
				splitPairs: Array.isArray(splitPairs) ? splitPairs : []
			};
			const next = (Array.isArray(splitPairs) ? splitPairs : []).filter((pair) => pair && ![anchor, child].includes(String(pair.anchorId || "")) && ![anchor, child].includes(String(pair.childId || "")));
			next.unshift({
				anchorId: anchor,
				childId: child
			});
			return {
				changed: true,
				splitPairs: normalizeSplitPairs(next, options.ids || [], options)
			};
		}
		function paneSlotBase(input = {}, options = {}) {
			return {
				ids: uniqueIds(input.ids || input.activeIds || []),
				pinnedIds: normalizePinnedIds(input.pinnedIds || input.threadTilePinnedIds || [], options),
				splitPairs: Array.isArray(input.splitPairs || input.threadTileSplitPairs) ? input.splitPairs || input.threadTileSplitPairs : []
			};
		}
		function fillPaneSlotIds(pinnedIds = [], ids = []) {
			const nextIds = Array.isArray(pinnedIds) && pinnedIds.length ? pinnedIds.slice() : (ids || []).slice();
			while (nextIds.length < ids.length) {
				const fillId = ids[nextIds.length];
				if (!fillId) break;
				nextIds.push(fillId);
			}
			return nextIds;
		}
		function skipPaneSlot(reason, extra = {}) {
			return Object.assign({
				action: "skip",
				reason
			}, extra);
		}
		function replacePaneThreadPlan(input = {}, options = {}) {
			const from = text(input.fromThreadId || input.fromId).trim();
			const to = text(input.toThreadId || input.toId || input.threadId).trim();
			const { ids, pinnedIds } = paneSlotBase(input, options);
			if (input.enabled !== true) return skipPaneSlot("disabled", {
				from,
				to,
				ids
			});
			if (!from || !to) return skipPaneSlot("missing-id", {
				from,
				to,
				ids
			});
			const index = ids.indexOf(from);
			if (index < 0) return skipPaneSlot("source-not-visible", {
				from,
				to,
				ids
			});
			if (from === to) return {
				action: "select",
				reason: "same-thread",
				from,
				to,
				index,
				duplicateIndex: index,
				paneThreadIds: pinnedIds.length ? pinnedIds : ids,
				selectedThreadId: to,
				switchMenuPaneId: "",
				scrollResetIds: [],
				renderMode: "patch",
				loadThreadId: ""
			};
			const nextIds = fillPaneSlotIds(pinnedIds, ids);
			const duplicateIndex = nextIds.indexOf(to);
			if (duplicateIndex >= 0 && duplicateIndex !== index) nextIds[duplicateIndex] = from;
			nextIds[index] = to;
			return {
				action: "replace",
				reason: "replace-pane-thread",
				from,
				to,
				index,
				duplicateIndex,
				paneThreadIds: normalizePinnedIds(nextIds, options),
				selectedThreadId: to,
				switchMenuPaneId: "",
				scrollResetIds: [from, to],
				renderMode: duplicateIndex >= 0 && duplicateIndex !== index ? "full" : "patch-source-pane",
				loadThreadId: to
			};
		}
		function movePaneRelativePlan(input = {}, options = {}) {
			const from = text(input.fromThreadId || input.fromId).trim();
			const to = text(input.toThreadId || input.toId).trim();
			const placement = text(input.placement) === "before" ? "before" : "after";
			const { ids, splitPairs } = paneSlotBase(input, options);
			if (input.enabled !== true) return skipPaneSlot("disabled", {
				from,
				to,
				ids,
				placement
			});
			if (!from || !to) return skipPaneSlot("missing-id", {
				from,
				to,
				ids,
				placement
			});
			if (from === to) return skipPaneSlot("same-thread", {
				from,
				to,
				ids,
				placement
			});
			if (!ids.includes(from) || !ids.includes(to)) return skipPaneSlot("pane-not-visible", {
				from,
				to,
				ids,
				placement
			});
			const withoutFrom = ids.filter((id) => id !== from);
			const targetIndex = withoutFrom.indexOf(to);
			if (targetIndex < 0) return skipPaneSlot("target-not-visible", {
				from,
				to,
				ids,
				placement
			});
			withoutFrom.splice(placement === "before" ? targetIndex : targetIndex + 1, 0, from);
			const paneThreadIds = normalizePinnedIds(withoutFrom, options);
			const withoutSplit = removeSplitPairsForIds(splitPairs, [from]).splitPairs;
			return {
				action: "move",
				reason: "move-pane",
				from,
				to,
				placement,
				paneThreadIds,
				paneSplitPairs: normalizeSplitPairs(withoutSplit, paneThreadIds, options),
				selectedThreadId: from,
				switchMenuPaneId: ""
			};
		}
		function splitPaneWithTargetPlan(input = {}, options = {}) {
			const from = text(input.fromThreadId || input.fromId).trim();
			const to = text(input.toThreadId || input.toId).trim();
			const placement = text(input.placement) === "above" ? "above" : "below";
			const { ids, splitPairs } = paneSlotBase(input, options);
			if (input.enabled !== true) return skipPaneSlot("disabled", {
				from,
				to,
				ids,
				placement
			});
			if (!from || !to) return skipPaneSlot("missing-id", {
				from,
				to,
				ids,
				placement
			});
			if (from === to) return skipPaneSlot("same-thread", {
				from,
				to,
				ids,
				placement
			});
			if (!ids.includes(from) || !ids.includes(to)) return skipPaneSlot("pane-not-visible", {
				from,
				to,
				ids,
				placement
			});
			const targetIndex = ids.indexOf(to);
			const nextIds = ids.filter((id) => id !== from && id !== to);
			nextIds.splice(Math.max(0, targetIndex), 0, ...placement === "above" ? [from, to] : [to, from]);
			const paneThreadIds = normalizePinnedIds(nextIds, options);
			const pair = placement === "above" ? {
				anchorId: from,
				childId: to
			} : {
				anchorId: to,
				childId: from
			};
			return {
				action: "split",
				reason: "split-pane",
				from,
				to,
				placement,
				paneThreadIds,
				paneSplitPairs: prependSplitPair(splitPairs, pair.anchorId, pair.childId, Object.assign({}, options, { ids: paneThreadIds })).splitPairs,
				selectedThreadId: from,
				switchMenuPaneId: ""
			};
		}
		function replaceLastPaneForThreadListOpenPlan(input = {}, options = {}) {
			const id = text(input.threadId || input.toThreadId || input.toId).trim();
			const source = text(input.source).trim();
			const { ids, pinnedIds } = paneSlotBase(input, options);
			if (input.enabled !== true) return skipPaneSlot("disabled", {
				id,
				ids,
				source
			});
			if (source !== "thread-list") return skipPaneSlot("unsupported-source", {
				id,
				ids,
				source
			});
			if (!id) return skipPaneSlot("missing-id", {
				id,
				ids,
				source
			});
			if (!ids.length) return skipPaneSlot("no-panes", {
				id,
				ids,
				source
			});
			if (ids.includes(id)) return skipPaneSlot("already-visible", {
				id,
				ids,
				source
			});
			const index = ids.length - 1;
			const from = ids[index] || "";
			if (!from || from === id) return skipPaneSlot("missing-source-pane", {
				id,
				ids,
				source
			});
			const nextIds = fillPaneSlotIds(pinnedIds, ids);
			const duplicateIndex = nextIds.indexOf(id);
			if (duplicateIndex >= 0 && duplicateIndex !== index) nextIds[duplicateIndex] = from;
			nextIds[index] = id;
			const paneThreadIds = normalizePinnedIds(nextIds, options);
			if (idsEqual(pinnedIds, paneThreadIds)) return skipPaneSlot("unchanged", {
				id,
				ids,
				source
			});
			return {
				action: "replace-last",
				reason: "thread-list-open",
				from,
				to: id,
				index,
				duplicateIndex,
				paneThreadIds,
				selectedThreadId: id,
				switchMenuPaneId: "",
				scrollResetIds: [from, id]
			};
		}
		function paneSlotMutationEffectsPlan(plan = {}, options = {}) {
			const sourceAction = text(plan.action).trim();
			if (!sourceAction || sourceAction === "skip") return skipPaneSlot("no-mutation-plan", { sourceAction });
			const paneThreadIds = Array.isArray(plan.paneThreadIds) ? normalizePinnedIds(plan.paneThreadIds, options) : null;
			const base = {
				action: "pane-slot-effects",
				reason: text(plan.reason || sourceAction).trim() || sourceAction,
				sourceAction,
				paneThreadIds,
				paneSplitPairs: Array.isArray(plan.paneSplitPairs) ? plan.paneSplitPairs : null,
				paneCount: Number.isFinite(Number(plan.paneCount)) ? Math.max(0, Math.floor(Number(plan.paneCount))) : null,
				selectedThreadId: text(plan.selectedThreadId).trim(),
				switchMenuPaneId: text(plan.switchMenuPaneId).trim(),
				scrollResetIds: uniqueIds(plan.scrollResetIds || []),
				saveDraft: false,
				restoreDraft: false,
				updateComposer: false,
				scheduleSettingsSave: true,
				refreshActiveIds: false,
				selectionPolicy: "none",
				selectionEmptyFallback: false,
				loadThreadId: text(plan.loadThreadId).trim(),
				loadSource: "tile-switch",
				renderMode: "none",
				renderStickToBottom: false,
				patchThreadId: "",
				patchSourceThreadId: "",
				patchStickToBottom: false,
				scheduleFullRenderOnPatchMiss: false
			};
			if (sourceAction === "select" || sourceAction === "replace") return Object.assign(base, {
				saveDraft: true,
				restoreDraft: true,
				updateComposer: true,
				refreshActiveIds: true,
				renderMode: text(plan.renderMode) === "full" ? "schedule-full" : "patch-pane",
				patchThreadId: text(plan.to || plan.threadId).trim(),
				patchSourceThreadId: text(plan.from || plan.threadId).trim(),
				patchStickToBottom: true,
				scheduleFullRenderOnPatchMiss: true
			});
			if (sourceAction === "move" || sourceAction === "split") return Object.assign(base, {
				saveDraft: true,
				restoreDraft: true,
				updateComposer: true,
				renderMode: "full",
				renderStickToBottom: true
			});
			if (sourceAction === "replace-last") return Object.assign(base, { refreshActiveIds: true });
			if (sourceAction === "set-pane-count") return Object.assign(base, {
				selectionPolicy: "pane-selection",
				selectionEmptyFallback: false,
				renderMode: options.render === false ? "none" : "full",
				renderStickToBottom: options.render !== false
			});
			if (sourceAction === "close-pane") return Object.assign(base, {
				saveDraft: true,
				restoreDraft: true,
				updateComposer: true,
				selectionPolicy: "pane-selection",
				selectionEmptyFallback: true,
				renderMode: "full",
				renderStickToBottom: true
			});
			return skipPaneSlot("unsupported-mutation-plan", { sourceAction });
		}
		function dropPaneIntent(input = {}, options = {}) {
			const from = text(input.fromThreadId || input.fromId || input.draggingId).trim();
			const to = text(input.toThreadId || input.toId || input.targetId).trim();
			if (!from || !to) return skipPaneSlot("missing-id", {
				from,
				to
			});
			if (from === to) return skipPaneSlot("same-thread", {
				from,
				to
			});
			const left = Number(input.left || 0);
			const top = Number(input.top || 0);
			const width = Math.max(1, Number(input.width || 1));
			const height = Math.max(1, Number(input.height || 1));
			const x = (Number(input.clientX || 0) - left) / width;
			const y = (Number(input.clientY || 0) - top) / height;
			const beforeThreshold = Number.isFinite(Number(options.beforeThreshold)) ? Number(options.beforeThreshold) : .24;
			const afterThreshold = Number.isFinite(Number(options.afterThreshold)) ? Number(options.afterThreshold) : .76;
			return x < beforeThreshold ? {
				action: "move-relative",
				from,
				to,
				placement: "before",
				x,
				y
			} : x > afterThreshold ? {
				action: "move-relative",
				from,
				to,
				placement: "after",
				x,
				y
			} : {
				action: "split-with-target",
				from,
				to,
				placement: y < .5 ? "above" : "below",
				x,
				y
			};
		}
		function paneSelectionPlan(input = {}) {
			const ids = uniqueIds(input.ids || input.activeIds || []);
			const selectedThreadId = text(input.selectedThreadId).trim();
			if (selectedThreadId && ids.includes(selectedThreadId)) return {
				selectedThreadId,
				changed: false,
				reason: "selected-visible"
			};
			if (!selectedThreadId && input.emptyFallback !== true) return {
				selectedThreadId: "",
				changed: false,
				reason: "empty-selection"
			};
			return {
				selectedThreadId: ids[0] || "",
				changed: selectedThreadId !== (ids[0] || ""),
				reason: selectedThreadId ? "selected-missing" : "empty-fallback"
			};
		}
		function selectPanePlan(input = {}) {
			const id = text(input.threadId || input.paneId).trim();
			const activeIds = uniqueIds(input.activeIds || input.ids || []);
			const selectedThreadId = text(input.selectedThreadId).trim();
			if (input.enabled !== true) return skipPaneSlot("disabled", {
				id,
				activeIds
			});
			if (!id) return skipPaneSlot("missing-id", {
				id,
				activeIds
			});
			if (!activeIds.includes(id)) return skipPaneSlot("pane-not-active", {
				id,
				activeIds
			});
			if (selectedThreadId === id) return skipPaneSlot("unchanged", {
				id,
				activeIds,
				selectedThreadId
			});
			return {
				action: "select-pane",
				reason: "select-pane",
				threadId: id,
				previousThreadId: selectedThreadId,
				selectedThreadId: id,
				patchThreadIds: uniqueIds([id, selectedThreadId])
			};
		}
		function selectedPaneEffectsPlan(plan = {}, options = {}) {
			const sourceAction = text(plan.action).trim();
			if (sourceAction !== "select-pane") return skipPaneSlot("unsupported-select-pane-plan", { sourceAction });
			const selectedThreadId = text(plan.selectedThreadId || plan.threadId).trim();
			if (!selectedThreadId) return skipPaneSlot("missing-id", { selectedThreadId });
			return {
				action: "selected-pane-effects",
				reason: text(plan.reason || sourceAction).trim() || sourceAction,
				sourceAction,
				selectedThreadId,
				patchThreadIds: uniqueIds(plan.patchThreadIds || [selectedThreadId]),
				saveDraft: true,
				restoreDraft: true,
				updateComposer: true,
				renderMode: options.render === false ? "none" : "patch-panes",
				patchPreserveScroll: true,
				scheduleFullRenderOnPatchMiss: true
			};
		}
		function paneCountChangePlan(input = {}, options = {}) {
			if (input.enabled !== true) return skipPaneSlot("disabled");
			if (input.layoutEnabled !== true) return skipPaneSlot("layout-disabled");
			const minCount = Math.max(1, Math.floor(Number(input.minCount || 1)) || 1);
			const maxCount = Math.max(minCount, Math.floor(Number(input.maxCount || minCount)) || minCount);
			const currentCount = Math.max(minCount, Math.floor(Number(input.currentCount || minCount)) || minCount);
			const storedPaneCount = normalizePaneCount(input.storedPaneCount, {
				fallback: 0,
				maxPanes: options.maxPanes
			});
			const requested = normalizePaneCount(input.nextCount, {
				fallback: currentCount,
				maxPanes: options.maxPanes
			});
			const paneCount = Math.max(minCount, Math.min(maxCount, requested));
			if (paneCount === currentCount && storedPaneCount === paneCount) return skipPaneSlot("unchanged", {
				paneCount,
				currentCount,
				minCount,
				maxCount
			});
			return {
				action: "set-pane-count",
				reason: "set-pane-count",
				paneCount,
				currentCount,
				minCount,
				maxCount,
				switchMenuPaneId: ""
			};
		}
		function closePanePlan(input = {}, options = {}) {
			const id = text(input.threadId || input.paneId).trim();
			const ids = uniqueIds(input.ids || input.activeIds || []);
			if (input.enabled !== true) return skipPaneSlot("disabled", {
				id,
				ids
			});
			if (input.layoutEnabled !== true) return skipPaneSlot("layout-disabled", {
				id,
				ids
			});
			if (!id) return skipPaneSlot("missing-id", {
				id,
				ids
			});
			if (!ids.includes(id)) return skipPaneSlot("pane-not-visible", {
				id,
				ids
			});
			const minCount = Math.max(1, Math.floor(Number(input.minCount || 1)) || 1);
			if (ids.length <= minCount) return skipPaneSlot("min-pane-count", {
				id,
				ids,
				minCount
			});
			const nextCount = Math.max(minCount, ids.length - 1);
			const pinnedIds = normalizePinnedIds(input.pinnedIds || [], options);
			const sourceIds = pinnedIds.length ? pinnedIds : ids;
			const defaultIds = uniqueIds(input.defaultIds || input.fillIds || []);
			const remaining = sourceIds.filter((candidateId) => candidateId !== id);
			const fillIds = defaultIds.filter((candidateId) => candidateId !== id);
			return {
				action: "close-pane",
				reason: "close-pane",
				threadId: id,
				paneCount: nextCount,
				paneThreadIds: normalizePinnedIds([...remaining, ...fillIds], options),
				switchMenuPaneId: "",
				scrollResetIds: [id]
			};
		}
		function effectiveSelectedThreadId(input = {}) {
			const activeIds = normalizePinnedIds(input.activeIds || input.ids || [], { maxPanes: input.maxPanes });
			if (input.enabled === false || !activeIds.length) return "";
			const selected = String(input.selectedThreadId || "").trim();
			if (selected && activeIds.includes(selected)) return selected;
			const current = String(input.currentThreadId || "").trim();
			if (current && activeIds.includes(current)) return current;
			return activeIds[0] || "";
		}
		function composerTargetPlan(input = {}, options = {}) {
			const newThreadDraft = input.newThreadDraft === true;
			const activeIds = normalizePinnedIds(input.activeIds || input.ids || [], { maxPanes: options.maxPanes || input.maxPanes });
			const tileContext = Boolean(input.threadTileMode === true && input.tileSurfaceActive === true && activeIds.length);
			const selectedThreadId = effectiveSelectedThreadId({
				enabled: input.threadTileMode === true,
				activeIds,
				selectedThreadId: input.selectedThreadId,
				currentThreadId: input.currentThreadId,
				maxPanes: options.maxPanes || input.maxPanes
			});
			const currentThreadId = text(input.currentThreadId).trim();
			return {
				action: "composer-target",
				reason: newThreadDraft ? "new-thread" : selectedThreadId ? "selected-pane" : currentThreadId ? "current-thread" : "missing-thread",
				mode: newThreadDraft ? "new-thread" : "thread",
				newThreadDraft,
				tileContext,
				activeIds,
				selectedThreadId,
				currentThreadId,
				targetThreadId: newThreadDraft ? "" : selectedThreadId || currentThreadId || ""
			};
		}
		function composerTargetPlaceholderPlan(input = {}) {
			if (input.newThreadDraft === true || String(input.mode || "") === "new-thread") return {
				action: "composer-target-placeholder",
				reason: "new-thread",
				showTargetPlaceholder: false,
				text: text(input.newThreadPlaceholder || "输入第一条消息")
			};
			const targetThreadId = text(input.targetThreadId).trim();
			const targetTitle = text(input.targetTitle || targetThreadId).trim();
			const showTargetPlaceholder = Boolean(input.tileContext === true && targetThreadId && input.hasTargetThread === true);
			return {
				action: "composer-target-placeholder",
				reason: showTargetPlaceholder ? "tile-target" : "default",
				showTargetPlaceholder,
				text: showTargetPlaceholder ? `发送到：${targetTitle || targetThreadId}` : text(input.defaultPlaceholder || "Message Codex")
			};
		}
		function composerActionControlPlan(input = {}) {
			const newThreadDraft = input.newThreadDraft === true || input.hasNewThreadDraft === true;
			const hasThread = input.hasThread === true;
			const composerBusy = input.composerBusy === true;
			const attachmentProcessingCount = Math.max(0, Math.floor(Number(input.attachmentProcessingCount || 0)) || 0);
			const hasContent = input.hasContent === true;
			const hasActiveTurn = Boolean(!newThreadDraft && text(input.targetActiveTurnId || input.activeTurnId).trim());
			const disabled = !(hasThread || newThreadDraft) || composerBusy || attachmentProcessingCount > 0;
			const interruptMode = hasActiveTurn && !hasContent;
			const steerMode = hasActiveTurn && hasContent;
			const retryMode = Boolean(text(input.sendButtonHint).trim() || input.showRetryHint === true);
			const goalCommandMode = input.goalCommandMode === true;
			const bareIntentKind = text(input.bareIntentKind).trim();
			const commandMode = input.commandMode === true;
			const steeringBusy = Boolean(input.steeringBusy === true || input.steering === true);
			const voiceGestureAvailable = input.voiceGestureAvailable === true;
			const hermesEmbedMode = input.hermesEmbedMode === true;
			const bareIntentTitle = text(input.bareIntentTitle || input.intentTitle).trim();
			let mode = "send";
			let reason = "send";
			let label = "Send";
			let title = newThreadDraft ? "Create new chat" : "Send message";
			let labelProxy = false;
			if (interruptMode) {
				mode = "interrupt";
				reason = "active-turn-interrupt";
				label = "Stop";
				title = "Interrupt current turn";
				labelProxy = hermesEmbedMode;
			} else if (composerBusy) {
				mode = "busy";
				reason = steeringBusy ? "steering-sending" : "message-sending";
				label = steeringBusy ? "引导中…" : "发送中…";
				title = steeringBusy ? "Steering current turn" : "Message is sending";
			} else if (retryMode) {
				mode = "retry";
				reason = "retry";
				label = "重试";
				title = "Retry sending message";
			} else if (goalCommandMode) {
				mode = "goal";
				reason = "goal-command";
				label = "Goal";
				title = "Open goal dialog";
			} else if (bareIntentKind) {
				mode = "intent";
				reason = "bare-intent";
				label = "Open";
				title = bareIntentTitle || "Open composer action";
			} else if (commandMode) {
				mode = "task-card";
				reason = "task-card-command";
				label = "Task card";
				title = "Ask Codex to draft a cross-thread task card";
			} else if (steerMode) {
				mode = "steer";
				reason = "active-turn-steer";
				label = "引导";
				title = "Guide the current running turn";
			}
			if (voiceGestureAvailable && !composerBusy && !interruptMode) title = `${title || "Send"}；按住录音，松开转写`;
			const ariaLabel = voiceGestureAvailable && !composerBusy && !interruptMode ? `${label || "Send"}。按住可语音输入` : interruptMode && hermesEmbedMode ? "Stop。按住可语音输入，轻点可中断当前任务" : "";
			return {
				action: "composer-action-control",
				reason,
				mode,
				disabled,
				sendButtonDisabled: disabled || !interruptMode && !hasContent && !voiceGestureAvailable,
				interruptMode,
				steerMode,
				hasContent,
				voiceGestureAvailable,
				label,
				labelProxy,
				title,
				ariaLabel,
				classState: {
					interruptMode,
					sending: mode === "busy",
					sendFailed: mode === "retry",
					steerMode: mode === "steer" || mode === "busy" && steeringBusy,
					pluginVoiceInputGesture: voiceGestureAvailable
				}
			};
		}
		function composerDraftRuntimeSelectionPlan(input = {}) {
			const draft = input.draft && typeof input.draft === "object" ? input.draft : null;
			const hasDraft = Boolean(draft);
			const newThreadDraft = input.newThreadDraft === true;
			const model = text(draft && draft.model).trim();
			const effort = text(draft && draft.effort).trim();
			const permissionMode = text(input.effectivePermissionMode || input.permissionMode).trim();
			const modelOptions = new Set((Array.isArray(input.modelOptions) ? input.modelOptions : []).map((value) => text(value).trim()).filter(Boolean));
			const effortOptions = new Set((Array.isArray(input.reasoningEffortOptions || input.effortOptions) ? input.reasoningEffortOptions || input.effortOptions : []).map((value) => text(value).trim()).filter(Boolean));
			const permissionOptions = new Set((Array.isArray(input.permissionModeOptions) ? input.permissionModeOptions : []).map((value) => text(value).trim()).filter(Boolean));
			const resetRuntimeWhenMissingDraft = input.resetRuntimeWhenMissingDraft === true;
			const defaultNewThreadModel = text(input.defaultNewThreadModel).trim();
			const defaultNewThreadEffort = text(input.defaultNewThreadEffort).trim();
			const defaultNewThreadPermissionMode = text(input.defaultNewThreadPermissionMode).trim();
			const plan = {
				action: "composer-draft-runtime-selection",
				reason: newThreadDraft ? hasDraft ? "new-thread-draft" : "new-thread-defaults" : hasDraft ? "thread-draft" : resetRuntimeWhenMissingDraft ? "missing-draft-reset" : "missing-draft-keep",
				mode: newThreadDraft ? "new-thread" : "thread",
				hasDraft,
				newThreadDraft,
				fastMode: Boolean(draft && draft.fastMode === true),
				clearNewThreadTitle: !newThreadDraft,
				setNewThreadRuntime: newThreadDraft,
				setThreadRuntime: !newThreadDraft && (hasDraft || resetRuntimeWhenMissingDraft),
				newThreadTitle: "",
				newThreadModel: "",
				newThreadEffort: "",
				newThreadPermissionMode: "",
				composerModel: "",
				composerEffort: "",
				composerPermissionMode: ""
			};
			if (newThreadDraft) {
				plan.newThreadTitle = text(draft && draft.threadTitle).trim();
				plan.newThreadModel = model && modelOptions.has(model) ? model : defaultNewThreadModel;
				plan.newThreadEffort = effort && effortOptions.has(effort) ? effort : defaultNewThreadEffort;
				plan.newThreadPermissionMode = permissionMode || defaultNewThreadPermissionMode;
				return plan;
			}
			if (!hasDraft && !resetRuntimeWhenMissingDraft) return plan;
			plan.composerModel = model && modelOptions.has(model) ? model : "";
			plan.composerEffort = effort && effortOptions.has(effort) ? effort : "";
			plan.composerPermissionMode = permissionMode && permissionOptions.has(permissionMode) ? permissionMode : "";
			return plan;
		}
		function displaySettingsPayload(input = {}, options = {}) {
			const paneThreadIds = normalizePinnedIds(input.paneThreadIds || input.threadTilePinnedIds || [], options);
			const paneCountInput = Object.prototype.hasOwnProperty.call(input, "paneCount") ? input.paneCount : input.threadTilePaneCount;
			return {
				displayMode: Boolean(input.threadTileMode) || String(input.displayMode || "").toLowerCase() === "tile" ? "tile" : "single",
				paneThreadIds,
				paneCount: normalizePaneCount(paneCountInput, {
					fallback: 0,
					maxPanes: options.maxPanes
				}),
				paneSplitPairs: normalizeSplitPairs(input.paneSplitPairs || input.threadTileSplitPairs || [], paneThreadIds, options),
				selectedThreadId: String(input.selectedThreadId || input.threadTileSelectedThreadId || "")
			};
		}
		function normalizeDisplaySettings(settings = {}, options = {}) {
			const displayMode = String(settings.displayMode || (settings.threadTileMode ? "tile" : "single")).toLowerCase() === "tile" ? "tile" : "single";
			const paneThreadIds = normalizePinnedIds(settings.paneThreadIds || settings.threadTilePinnedIds || [], options);
			const paneSplitPairs = normalizeSplitPairs(settings.paneSplitPairs || settings.threadTileSplitPairs || settings.splitPairs || [], paneThreadIds, options);
			const paneCountInput = Object.prototype.hasOwnProperty.call(settings, "paneCount") ? settings.paneCount : Object.prototype.hasOwnProperty.call(settings, "threadTilePaneCount") ? settings.threadTilePaneCount : settings.tilePaneCount;
			const selected = String(settings.selectedThreadId || "").trim();
			return {
				displayMode,
				threadTileMode: displayMode === "tile",
				paneThreadIds,
				paneSplitPairs,
				paneCount: normalizePaneCount(paneCountInput, {
					fallback: 0,
					maxPanes: options.maxPanes
				}),
				selectedThreadId: selected && paneThreadIds.includes(selected) ? selected : ""
			};
		}
		function displaySettingsLoadPlan(input = {}) {
			const localDisplayMode = text(input.localDisplayMode).trim().toLowerCase() === "tile" ? "tile" : "single";
			const settings = input.settings && typeof input.settings === "object" ? input.settings : {};
			if (input.loadFailed === true) return {
				action: localDisplayMode === "tile" ? "apply-display-settings" : "skip",
				reason: localDisplayMode === "tile" ? "load-error-local-tile" : "load-error-no-local-tile",
				settings: localDisplayMode === "tile" ? { displayMode: "tile" } : null,
				saveAfterApply: false,
				rethrow: true
			};
			const source = text(settings.source || input.source).trim();
			if (source !== "runtime" && localDisplayMode === "tile") return {
				action: "apply-display-settings",
				reason: "legacy-local-tile-migration",
				settings: {
					displayMode: "tile",
					paneThreadIds: [],
					selectedThreadId: ""
				},
				saveAfterApply: true,
				rethrow: false
			};
			return {
				action: "apply-display-settings",
				reason: source === "runtime" ? "runtime-settings" : "default-settings",
				settings,
				saveAfterApply: false,
				rethrow: false
			};
		}
		function syncPinnedIdsFromActiveIds(input = {}, options = {}) {
			const activeIds = normalizePinnedIds(input.activeIds || [], options);
			const currentPinnedIds = normalizePinnedIds(input.pinnedIds || input.threadTilePinnedIds || [], options);
			if (input.enabled === false || !activeIds.length) return {
				changed: false,
				paneThreadIds: currentPinnedIds,
				paneSplitPairs: input.splitPairs || []
			};
			const visibleIds = new Set((input.visibleIds || []).map((id) => String(id || "").trim()).filter(Boolean));
			if (idsEqual(currentPinnedIds.filter((id) => visibleIds.has(id)).slice(0, activeIds.length), activeIds)) return {
				changed: false,
				paneThreadIds: currentPinnedIds,
				paneSplitPairs: input.splitPairs || []
			};
			const remaining = currentPinnedIds.filter((id) => !activeIds.includes(id));
			const paneThreadIds = normalizePinnedIds([...activeIds, ...remaining], options);
			return {
				changed: true,
				paneThreadIds,
				paneSplitPairs: normalizeSplitPairs(input.splitPairs || [], paneThreadIds, options)
			};
		}
		function activePaneSyncPlan(input = {}, options = {}) {
			const activeIds = normalizePinnedIds(input.activeIds || [], options);
			const selectedThreadId = text(input.selectedThreadId).trim();
			const currentPinnedIds = normalizePinnedIds(input.pinnedIds || input.threadTilePinnedIds || [], options);
			const splitPairs = Array.isArray(input.splitPairs || input.threadTileSplitPairs) ? input.splitPairs || input.threadTileSplitPairs : [];
			if (input.enabled !== true || !activeIds.length) return {
				action: "sync-active-panes",
				reason: input.enabled === true ? "no-active-panes" : "disabled",
				changed: Boolean(selectedThreadId),
				settingsChanged: false,
				pinnedChanged: false,
				selectedChanged: Boolean(selectedThreadId),
				activeIds,
				paneThreadIds: currentPinnedIds,
				paneSplitPairs: splitPairs,
				selectedThreadId: ""
			};
			const pinned = syncPinnedIdsFromActiveIds({
				enabled: true,
				activeIds,
				pinnedIds: currentPinnedIds,
				visibleIds: input.visibleIds,
				splitPairs
			}, options);
			const nextSelectedThreadId = effectiveSelectedThreadId({
				enabled: true,
				activeIds,
				selectedThreadId,
				currentThreadId: input.currentThreadId,
				maxPanes: options.maxPanes
			});
			const selectedChanged = selectedThreadId !== nextSelectedThreadId;
			return {
				action: "sync-active-panes",
				reason: pinned.changed || selectedChanged ? "sync" : "unchanged",
				changed: pinned.changed || selectedChanged,
				settingsChanged: pinned.changed,
				pinnedChanged: pinned.changed,
				selectedChanged,
				activeIds,
				paneThreadIds: pinned.paneThreadIds,
				paneSplitPairs: pinned.paneSplitPairs,
				selectedThreadId: nextSelectedThreadId
			};
		}
		function normalizeOperationMode(mode) {
			return text(mode) === "expanded" ? "expanded" : "compact";
		}
		function toggleOperationMode(mode) {
			return normalizeOperationMode(mode) === "expanded" ? "compact" : "expanded";
		}
		function operationModeTogglePlan(input = {}) {
			const id = text(input.threadId || input.paneId).trim();
			if (input.enabled !== true) return skipPaneSlot("disabled", { id });
			if (!id) return skipPaneSlot("missing-id", { id });
			const previousMode = normalizeOperationMode(input.mode || input.currentMode);
			return {
				action: "operation-mode-toggle-effects",
				reason: "toggle-operation-mode",
				id,
				previousMode,
				mode: toggleOperationMode(previousMode),
				selectPane: true,
				selectPaneRender: false,
				patchThreadId: id,
				patchPreserveScroll: true,
				scheduleFullRenderOnPatchMiss: true
			};
		}
		function operationBubbleRecord(input = {}) {
			const id = text(input.threadId).trim();
			const html = text(input.html);
			const marker = text(input.bubbleMarker || "mobile-operation-bubble");
			if (!id || !html || !html.includes(marker)) return null;
			const minVisibleMs = Math.max(0, Number(input.minVisibleMs || DEFAULT_OPERATION_BUBBLE_MIN_VISIBLE_MS));
			return {
				html,
				visibleUntilMs: nowValue(input.nowMs) + minVisibleMs
			};
		}
		function operationBubbleSnapshot(record, input = {}) {
			if (!record) return {
				visible: false,
				html: "",
				remainingMs: 0,
				expired: false
			};
			const remainingMs = Number(record.visibleUntilMs || 0) - nowValue(input.nowMs);
			if (remainingMs <= 0) return {
				visible: false,
				html: "",
				remainingMs: 0,
				expired: true
			};
			return {
				visible: true,
				html: text(record.html),
				remainingMs,
				expired: false
			};
		}
		function operationDockPlan(input = {}) {
			const id = text(input.threadId || input.id).trim();
			const mode = normalizeOperationMode(input.mode);
			const expanded = mode === "expanded";
			if (!id) return {
				action: "none",
				reason: "missing-id",
				id: "",
				mode,
				expanded
			};
			const entryType = text(input.entryType || input.operationType);
			if (input.hasOperation === true || Boolean(entryType && entryType !== "liveTurnStatus")) return {
				action: "render-live-operation",
				reason: "active-operation",
				id,
				mode,
				expanded,
				remember: true
			};
			if (input.hasLiveTurn !== true) return {
				action: "none",
				reason: "no-live-turn",
				id,
				mode,
				expanded
			};
			const remembered = operationBubbleSnapshot(input.remembered, { nowMs: input.nowMs });
			if (remembered.visible) return {
				action: "render-remembered-operation",
				reason: "remembered-visible",
				id,
				mode,
				expanded,
				html: remembered.html,
				remainingMs: remembered.remainingMs,
				scheduleMinimumRefresh: true
			};
			if (remembered.expired) return {
				action: "clear-remembered-operation",
				reason: "remembered-expired",
				id,
				mode,
				expanded,
				clearRemembered: true
			};
			return {
				action: "none",
				reason: "no-remembered-operation",
				id,
				mode,
				expanded
			};
		}
		function operationSignature(input = {}) {
			const remembered = operationBubbleSnapshot(input.remembered, { nowMs: input.nowMs });
			return {
				mode: normalizeOperationMode(input.mode),
				rememberedVisible: remembered.visible,
				entry: input.entrySignature || null
			};
		}
		function operationMinimumRefreshPlan(input = {}) {
			const activeIds = uniqueIds(input.activeIds || input.ids || []);
			if (input.enabled !== true) return {
				action: "operation-minimum-refresh",
				reason: "disabled",
				patchThreadIds: [],
				fullRenderOnPatchMiss: false
			};
			return {
				action: "operation-minimum-refresh",
				reason: activeIds.length ? "patch-active-panes" : "no-active-panes",
				patchThreadIds: activeIds,
				fullRenderOnPatchMiss: true
			};
		}
		function paneRenderFramePlan(input = {}) {
			const id = text(input.threadId || input.paneId).trim();
			if (!id) return {
				action: "skip",
				reason: "missing-id",
				id: "",
				scheduleFrame: false,
				returnValue: false,
				fullRenderOnPatchMiss: false
			};
			if (input.enabled !== true) return {
				action: "skip",
				reason: "disabled",
				id,
				scheduleFrame: false,
				returnValue: false,
				fullRenderOnPatchMiss: false
			};
			if (input.visible !== true) return {
				action: "skip",
				reason: "pane-not-visible",
				id,
				scheduleFrame: false,
				returnValue: false,
				fullRenderOnPatchMiss: false
			};
			if (input.hasFrame === true) return {
				action: "already-scheduled",
				reason: "frame-active",
				id,
				scheduleFrame: false,
				returnValue: true,
				fullRenderOnPatchMiss: false
			};
			return {
				action: "schedule-pane-render",
				reason: "ready",
				id,
				scheduleFrame: true,
				returnValue: true,
				fullRenderOnPatchMiss: input.fullRenderOnPatchMiss !== false
			};
		}
		function booleanFact(input = {}, key) {
			return Object.prototype.hasOwnProperty.call(input, key) ? input[key] === true : null;
		}
		function panePatchPreflightSkip(reason, details = {}) {
			return Object.assign({
				action: "skip",
				reason,
				canPatch: false,
				shouldContinue: false,
				id: "",
				ids: []
			}, details);
		}
		function panePatchPreflightPlan(input = {}) {
			const id = text(input.threadId || input.paneId).trim();
			const hasIds = Array.isArray(input.ids || input.activeIds);
			const ids = uniqueIds(input.ids || input.activeIds || []);
			if (!id) return panePatchPreflightSkip("missing-id", {
				id: "",
				ids
			});
			if (input.enabled !== true) return panePatchPreflightSkip("disabled", {
				id,
				ids
			});
			if (input.visible !== true) return panePatchPreflightSkip("pane-not-visible", {
				id,
				ids
			});
			const conversationPresent = booleanFact(input, "conversationPresent");
			if (conversationPresent === false) return panePatchPreflightSkip("missing-conversation", {
				id,
				ids
			});
			const tileSurface = booleanFact(input, "tileSurface");
			if (tileSurface === false) return panePatchPreflightSkip("not-tile-surface", {
				id,
				ids
			});
			const boardPresent = booleanFact(input, "boardPresent");
			if (boardPresent === false) return panePatchPreflightSkip("missing-board", {
				id,
				ids
			});
			const layoutEnabled = booleanFact(input, "layoutEnabled");
			if (layoutEnabled === false) return panePatchPreflightSkip("layout-disabled", {
				id,
				ids
			});
			if (hasIds && !ids.includes(id)) return panePatchPreflightSkip("pane-not-candidate", {
				id,
				ids
			});
			const panePresent = booleanFact(input, "panePresent");
			if (panePresent === false) return panePatchPreflightSkip("missing-pane", {
				id,
				ids
			});
			const factsComplete = conversationPresent === true && tileSurface === true && boardPresent === true && layoutEnabled === true && panePresent === true && hasIds;
			return {
				action: factsComplete ? "patch-pane" : "continue",
				reason: factsComplete ? "ready" : "pending-facts",
				canPatch: factsComplete,
				shouldContinue: true,
				id,
				ids
			};
		}
		function panePatchCompletionSkip(reason, details = {}) {
			return Object.assign({
				action: "skip",
				reason,
				id: "",
				returnValue: false,
				hydrate: false,
				restoreScroll: false,
				updateBottomButton: false,
				updateBottomButtonMode: "none",
				writeRenderSignature: false,
				clearPatchShellSignature: false,
				bindActions: false
			}, details);
		}
		function panePatchCompletionPlan(input = {}) {
			const id = text(input.threadId || input.paneId).trim();
			if (!id) return panePatchCompletionSkip("missing-id");
			if (input.sourcePanePresent !== true) return panePatchCompletionSkip("missing-source-pane", { id });
			if (!Object.prototype.hasOwnProperty.call(input, "patchedPanePresent")) return Object.assign(panePatchCompletionSkip("source-pane-ready", { id }), {
				action: "continue",
				returnValue: true
			});
			if (input.patchedPanePresent === false) return panePatchCompletionSkip("missing-patched-pane", { id });
			return {
				action: "complete-pane-patch",
				reason: "ready",
				id,
				returnValue: true,
				hydrate: true,
				restoreScroll: true,
				updateBottomButton: true,
				updateBottomButtonMode: input.requestAnimationFrameAvailable === true ? "animation-frame" : "sync",
				writeRenderSignature: true,
				clearPatchShellSignature: true,
				bindActions: true
			};
		}
		function refreshDelayMs(value, options = {}) {
			const defaultDelayMs = Math.max(0, Number(options.defaultDelayMs || 0));
			const minDelayMs = Math.max(0, Number(options.minDelayMs || 500));
			const parsed = Number(value);
			return Math.max(minDelayMs, Number.isFinite(parsed) ? parsed : defaultDelayMs);
		}
		function refreshSchedulePlan(input = {}, options = {}) {
			const activeIds = uniqueIds(input.activeIds || []);
			const hiddenValue = text(options.hiddenVisibilityState || "hidden");
			if (input.enabled !== true) return {
				schedule: false,
				clearTimer: true,
				reason: "disabled",
				activeIds,
				delayMs: 0
			};
			if (text(input.visibilityState) === hiddenValue) return {
				schedule: false,
				clearTimer: true,
				reason: "hidden",
				activeIds,
				delayMs: 0
			};
			if (!activeIds.length) return {
				schedule: false,
				clearTimer: false,
				reason: "no-active-panes",
				activeIds,
				delayMs: 0
			};
			if (input.hasTimer === true) return {
				schedule: false,
				clearTimer: false,
				reason: "timer-active",
				activeIds,
				delayMs: 0
			};
			return {
				schedule: true,
				clearTimer: false,
				reason: "schedule",
				activeIds,
				delayMs: refreshDelayMs(input.delayMs, options)
			};
		}
		function refreshTargetIds(input = {}) {
			if (input.enabled !== true) return [];
			const ids = uniqueIds(input.ids || input.activeIds || []);
			const visibleInput = input.visibleIds;
			const visibleIds = Array.isArray(visibleInput) ? new Set(uniqueIds(visibleInput)) : null;
			const currentThreadId = text(input.currentThreadId).trim();
			return ids.filter((id) => {
				if (visibleIds && !visibleIds.has(id)) return false;
				return !currentThreadId || id !== currentThreadId;
			});
		}
		function detailLoadQueuePlan(input = {}) {
			const activeIds = uniqueIds(input.activeIds || input.ids || []);
			const controllerIds = uniqueIds(input.controllerIds || []);
			const loadingIds = uniqueIds(input.loadingIds || []);
			const readyIds = uniqueIds(input.readyIds || []);
			if (input.enabled !== true) return {
				action: "skip",
				reason: "disabled",
				activeIds,
				controllerIds,
				loadingIds,
				readyIds,
				abortIds: [],
				loadIds: [],
				deferredIds: [],
				busyIds: [],
				maxConcurrentLoads: 0,
				availableSlots: 0,
				scheduleDrainAfterLoad: false
			};
			const activeSet = new Set(activeIds);
			const controllerSet = new Set(controllerIds);
			const loadingSet = new Set(loadingIds);
			const readySet = new Set(readyIds);
			const abortIds = controllerIds.filter((id) => !activeSet.has(id));
			const busyIds = uniqueIds([...controllerIds.filter((id) => activeSet.has(id)), ...loadingIds.filter((id) => activeSet.has(id))]);
			const parsedMax = Math.floor(Number(input.maxConcurrentLoads));
			const maxConcurrentLoads = Number.isFinite(parsedMax) && parsedMax > 0 ? parsedMax : Math.max(1, activeIds.length || DEFAULT_USER_MAX_PANES);
			const availableSlots = Math.max(0, maxConcurrentLoads - busyIds.length);
			const candidates = activeIds.filter((id) => !controllerSet.has(id) && !loadingSet.has(id) && !readySet.has(id));
			const loadIds = candidates.slice(0, availableSlots);
			const deferredIds = candidates.slice(availableSlots);
			const scheduleDrainAfterLoad = deferredIds.length > 0 && loadIds.length > 0;
			return {
				action: "detail-load-queue",
				reason: !activeIds.length ? "no-active-panes" : deferredIds.length ? "max-concurrency" : "queue",
				activeIds,
				controllerIds,
				loadingIds,
				readyIds,
				abortIds,
				loadIds,
				deferredIds,
				busyIds,
				maxConcurrentLoads,
				availableSlots,
				scheduleDrainAfterLoad
			};
		}
		function detailLoadConcurrencyPlan(input = {}, options = {}) {
			const activeIds = uniqueIds(input.activeIds || input.ids || []);
			const maxPanes = maxPaneLimit(input.maxPanes || options.maxPanes || DEFAULT_USER_MAX_PANES);
			const configuredInput = Object.prototype.hasOwnProperty.call(input, "maxConcurrentLoads") ? input.maxConcurrentLoads : Object.prototype.hasOwnProperty.call(input, "configuredMaxConcurrentLoads") ? input.configuredMaxConcurrentLoads : options.defaultMaxConcurrentLoads;
			const parsed = Math.floor(Number(configuredInput));
			const boundedConfiguredMax = Math.max(1, Math.min(maxPanes, Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DETAIL_LOAD_MAX_CONCURRENT));
			const maxConcurrentLoads = activeIds.length ? Math.max(1, Math.min(activeIds.length, boundedConfiguredMax)) : boundedConfiguredMax;
			return {
				action: "detail-load-concurrency",
				reason: activeIds.length ? "active-panes" : "no-active-panes",
				activeIds,
				activeCount: activeIds.length,
				configuredMaxConcurrentLoads: boundedConfiguredMax,
				maxConcurrentLoads
			};
		}
		function detailLoadQueueDrainPlan(input = {}, options = {}) {
			const activeIds = uniqueIds(input.activeIds || input.ids || []);
			const delayMs = Math.max(0, Number(input.delayMs || options.defaultDelayMs || 0));
			if (input.enabled !== true) return {
				schedule: false,
				clearTimer: true,
				reason: "disabled",
				activeIds,
				delayMs: 0
			};
			if (!activeIds.length) return {
				schedule: false,
				clearTimer: true,
				reason: "no-active-panes",
				activeIds,
				delayMs: 0
			};
			if (input.hasTimer === true) return {
				schedule: false,
				clearTimer: false,
				reason: "timer-active",
				activeIds,
				delayMs: 0
			};
			if (input.pending !== true && input.force !== true) return {
				schedule: false,
				clearTimer: false,
				reason: "no-pending-loads",
				activeIds,
				delayMs: 0
			};
			return {
				schedule: true,
				clearTimer: false,
				reason: input.force === true ? "load-settled" : "deferred-loads",
				activeIds,
				delayMs
			};
		}
		function detailLoadPlan(input = {}) {
			const id = text(input.threadId).trim();
			if (!id) return {
				action: "skip",
				reason: "missing-id",
				id: ""
			};
			if (text(input.currentThreadId).trim() === id && input.currentThreadLoaded === true) return {
				action: "skip",
				reason: "current-thread-loaded",
				id
			};
			if (input.controllerActive === true) return {
				action: "skip",
				reason: "controller-active",
				id
			};
			if (input.loadingActive === true) return {
				action: "skip",
				reason: "loading-active",
				id
			};
			const cachedReady = input.cachedReady === true;
			const force = input.force === true;
			const nowMs = nowValue(input.nowMs);
			const lastLoadedAt = Number(input.lastLoadedAt || 0);
			const minIntervalMs = Math.max(0, Number(input.minIntervalMs || 0));
			if (!force && cachedReady) return {
				action: "skip",
				reason: "cached-ready",
				id
			};
			if (force && lastLoadedAt && nowMs - lastLoadedAt < minIntervalMs) return {
				action: "skip",
				reason: "min-refresh-interval",
				id
			};
			const background = Boolean(input.backgroundRequested === true && cachedReady);
			return {
				action: "load",
				reason: background ? "background-refresh" : "load",
				id,
				background,
				markLoading: !background,
				clearError: !background
			};
		}
		function detailLoadStartEffectsPlan(plan = {}) {
			const sourceAction = text(plan.action).trim();
			const id = text(plan.id || plan.threadId).trim();
			if (sourceAction !== "load") return skipPaneSlot("unsupported-detail-load-plan", {
				sourceAction,
				id
			});
			if (!id) return skipPaneSlot("missing-id", { id });
			return {
				action: "detail-load-start-effects",
				reason: text(plan.reason || sourceAction).trim() || sourceAction,
				id,
				background: plan.background === true,
				setController: true,
				markLoading: plan.markLoading === true,
				clearError: plan.clearError === true,
				renderPane: plan.markLoading === true,
				preserveScroll: true
			};
		}
		function detailLoadSuccessEffectsPlan(input = {}) {
			const id = text(input.id || input.threadId).trim();
			if (!id) return skipPaneSlot("missing-id", { id });
			if (input.hasThread !== true) return skipPaneSlot("missing-thread", { id });
			return {
				action: "detail-load-success-effects",
				reason: "thread-loaded",
				id,
				setDetail: true,
				setLoadedAt: true,
				loadedAtMs: nowValue(input.nowMs),
				clearError: true,
				mergeThread: true
			};
		}
		function detailLoadErrorEffectsPlan(input = {}) {
			const id = text(input.id || input.threadId).trim();
			if (!id) return skipPaneSlot("missing-id", { id });
			if (input.aborted === true) return skipPaneSlot("aborted", { id });
			if (input.background === true) return skipPaneSlot("background-refresh", { id });
			return {
				action: "detail-load-error-effects",
				reason: "foreground-error",
				id,
				errorMessage: text(input.errorMessage || input.message || input.error).trim()
			};
		}
		function detailLoadFinallyEffectsPlan(input = {}) {
			const id = text(input.id || input.threadId).trim();
			if (!id) return skipPaneSlot("missing-id", { id });
			return {
				action: "detail-load-finally-effects",
				reason: "settle",
				id,
				clearController: input.controllerMatches === true,
				clearLoading: true,
				renderPane: input.visible === true,
				preserveScroll: true,
				scheduleQueueDrain: true
			};
		}
		return {
			DEFAULT_DETAIL_LOAD_MAX_CONCURRENT,
			DEFAULT_OPERATION_BUBBLE_MIN_VISIBLE_MS,
			DEFAULT_USER_MAX_PANES,
			activePaneSyncPlan,
			candidatePaneIdsPlan,
			closePanePlan,
			composerActionControlPlan,
			composerDraftRuntimeSelectionPlan,
			composerTargetPlaceholderPlan,
			composerTargetPlan,
			displaySettingsPayload,
			displaySettingsLoadPlan,
			dropPaneIntent,
			effectiveSelectedThreadId,
			idsEqual,
			layoutCapacity,
			normalizeDisplaySettings,
			normalizeOperationMode,
			normalizePaneCount,
			normalizePinnedIds,
			normalizeSplitPairs,
			operationModeTogglePlan,
			operationBubbleRecord,
			operationBubbleSnapshot,
			operationDockPlan,
			operationMinimumRefreshPlan,
			operationSignature,
			paneBottomButtonPlan,
			paneCountChangePlan,
			paneCountStatePlan,
			paneDisplayLayoutPlan,
			panePatchCompletionPlan,
			panePatchPreflightPlan,
			paneRenderFramePlan,
			paneRenderSignaturePlan,
			paneSelectionPlan,
			paneSlotMutationEffectsPlan,
			paneScrollHoldPlan,
			paneScrollMetrics,
			paneScrollRestorePlan,
			prependSplitPair,
			detailLoadPlan,
			detailLoadErrorEffectsPlan,
			detailLoadFinallyEffectsPlan,
			detailLoadConcurrencyPlan,
			detailLoadQueueDrainPlan,
			detailLoadQueuePlan,
			detailLoadStartEffectsPlan,
			detailLoadSuccessEffectsPlan,
			refreshDelayMs,
			refreshSchedulePlan,
			refreshTargetIds,
			replaceLastPaneForThreadListOpenPlan,
			replacePaneThreadPlan,
			removeSplitPairsForIds,
			movePaneRelativePlan,
			selectPanePlan,
			selectedPaneEffectsPlan,
			splitPaneWithTargetPlan,
			switchMenuOptionsPlan,
			switchMenuPlan,
			syncPinnedIdsFromActiveIds,
			threadTileVerticalChromePlan,
			threadTileViewportBaselinePlan,
			toggleOperationMode,
			uniqueIds
		};
	});
}));
//#endregion
//#region public/thread-tile-runtime.js
var require_thread_tile_runtime = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function attachThreadTileRuntime(root) {
		function createThreadTileRuntime(deps = {}) {
			const { state, $, api, document, window, localStorage, setTimeout, clearTimeout, AbortController, THREAD_TILE_USER_MAX_PANES, THREAD_TILE_DETAIL_LOAD_QUEUE_DRAIN_MS, THREAD_TILE_REFRESH_INTERVAL_MS, THREAD_TILE_REFRESH_MIN_INTERVAL_MS, THREAD_TILE_SETTINGS_SAVE_DEBOUNCE_MS, STORAGE_THREAD_DISPLAY_MODE, STORAGE_LEGACY_THREAD_TILE_MODE, LIVE_OPERATION_BUBBLE_MIN_VISIBLE_MS, threadTileActionsApi, threadTileStatePolicy, threadTileLayoutPolicy, threadDetailPatchPlanApi, isKeyboardEditableElement, splitPaneSidebarVisible, isMenuOverlayMode, visibleThreads, isRunningStatus, saveCurrentDraftNow, restoreDraftForCurrentTarget, renderComposerSettings, updateComposerControls, scheduleRenderCurrentThread, renderCurrentThread, showError, threadById, threadDisplayName, shortPath, formatTime, statusIconHtml, threadDetailApiPath, mergeThreadPreservingVisibleItems, mergeThreadIntoThreadList, withRenderContextThread, visibleItemsForTurn, renderVisibleItemPatchHtml, renderTurnVisibleItemBudgetNotice, approvalsForTurn, renderApprovalRequest, approvalTurnId, isApprovalActive, currentLiveOperationEntry, latestLiveTurnForThread, renderMobileOperationStack, visibleItemSignature, threadTitleForDisplay, turnTimerStateHtml, threadTilePaneTimerState, threadHasVisibleConversationTurns, threadReadWarningMessage, visibleTurnsForConversation, renderThreadHistoryNote, renderPendingApprovals, effectiveThreadTileSelectedThreadId, conversationRenderSignature, existingConversationRenderKeys, patchNode, hydrateThreadDetailSurface, clearGlobalLiveOperationDockForThreadTiles, updateConversationHtml, threadTileVisibleShape, threadTileDomTurnCount, conversationDomShape, diagnosticHash, publishPluginNavigationState, escapeHtml } = Object.assign({
				document: root.document || {},
				window: root.window || root,
				localStorage: root.localStorage || {
					getItem: () => null,
					setItem: () => {},
					removeItem: () => {}
				},
				setTimeout: typeof root.setTimeout === "function" ? root.setTimeout.bind(root) : () => 0,
				clearTimeout: typeof root.clearTimeout === "function" ? root.clearTimeout.bind(root) : () => {},
				AbortController: root.AbortController
			}, deps);
			function updateThreadTileGlobalHeader(layout = null, ids = []) {
				const titleEl = $("threadTitle");
				const metaEl = $("threadMeta");
				if (titleEl) titleEl.textContent = "";
				if (metaEl) metaEl.textContent = "";
			}
			function viewportPixelSize(options = {}) {
				const visualViewport = window.visualViewport;
				const visualWidth = Math.round(visualViewport && visualViewport.width || 0);
				const visualHeight = Math.round(visualViewport && visualViewport.height || 0);
				const layoutWidth = Math.round(window.innerWidth || document.documentElement.clientWidth || 0);
				const layoutHeight = Math.round(window.innerHeight || document.documentElement.clientHeight || 0);
				if (options.preferLayoutViewport) return {
					width: Math.max(layoutWidth, visualWidth),
					height: Math.max(layoutHeight, visualHeight)
				};
				return {
					width: Math.round(visualWidth || layoutWidth || 0),
					height: Math.round(visualHeight || layoutHeight || 0)
				};
			}
			function isCoarsePointerViewport() {
				return Boolean(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
			}
			function isThreadTileKeyboardFocusActive() {
				return Boolean(state.threadTileMode && isKeyboardEditableElement(document.activeElement));
			}
			function threadTileViewportSize() {
				const layoutViewport = viewportPixelSize({ preferLayoutViewport: true });
				const plan = threadTileStatePolicy.threadTileViewportBaselinePlan({
					keyboardActive: isThreadTileKeyboardFocusActive(),
					layoutViewport,
					baseline: state.threadTileViewportBaseline
				});
				if (plan.updateBaseline) state.threadTileViewportBaseline = plan.nextBaseline;
				return plan.viewport;
			}
			function threadTileVerticalChromePx() {
				const plan = threadTileStatePolicy.threadTileVerticalChromePlan({
					keyboardActive: isThreadTileKeyboardFocusActive(),
					composerHeightPx: state.composerHeightPx,
					baselineComposerHeightPx: state.threadTileComposerHeightBaselinePx
				});
				if (plan.updateBaseline) state.threadTileComposerHeightBaselinePx = plan.nextComposerHeightBaselinePx;
				return plan.verticalChromePx;
			}
			function threadTileLayout(options = {}) {
				const viewport = threadTileViewportSize();
				const sidebar = $("sidebar");
				const sidebarSplitVisible = splitPaneSidebarVisible();
				const menuOverlay = isMenuOverlayMode() || !sidebarSplitVisible;
				const sidebarWidth = sidebar && sidebarSplitVisible ? Math.round(sidebar.getBoundingClientRect().width || 0) : 0;
				return threadTileLayoutPolicy.layoutForViewport({
					enabled: Object.prototype.hasOwnProperty.call(options, "enabled") ? options.enabled === true : state.threadTileMode,
					viewportWidth: viewport.width,
					viewportHeight: viewport.height,
					sidebarWidth,
					coarsePointer: isCoarsePointerViewport(),
					menuOverlay,
					maxPanes: THREAD_TILE_USER_MAX_PANES,
					recommendedMaxPanes: threadTileLayoutPolicy.DEFAULT_MAX_PANES,
					desiredPaneCount: normalizeThreadTilePaneCount(state.threadTilePaneCount, 0),
					verticalChromePx: threadTileVerticalChromePx()
				});
			}
			function normalizeThreadTilePaneCount(value, fallback = 0) {
				return threadTileStatePolicy.normalizePaneCount(value, {
					fallback,
					maxPanes: THREAD_TILE_USER_MAX_PANES
				});
			}
			function threadTileLayoutCapacity(layout = threadTileLayout()) {
				return threadTileStatePolicy.layoutCapacity(layout, {
					capacityMaxPanes: threadTileLayoutPolicy.DEFAULT_MAX_PANES,
					maxPanes: THREAD_TILE_USER_MAX_PANES
				});
			}
			function defaultThreadTileCandidateIds(layout = threadTileLayout(), options = {}) {
				const maxPanes = Math.max(1, Math.min(THREAD_TILE_USER_MAX_PANES, Math.floor(Number(options.maxPanes || layout && layout.maxPanes || 1)) || 1));
				const threadIds = visibleThreads(state.threads).map((thread) => thread && thread.id).filter(Boolean);
				return threadTileLayoutPolicy.selectThreadTileIds({
					currentThreadId: state.currentThreadId,
					threadIds,
					maxPanes
				});
			}
			function threadTileRunningPaneIds() {
				const runningIds = [];
				visibleThreads(state.threads).forEach((thread) => {
					const id = String(thread && thread.id || "");
					if (id && isRunningStatus(thread && thread.status)) runningIds.push(id);
				});
				if (state.currentThreadId) runningIds.push(String(state.currentThreadId));
				return threadTileStatePolicy.uniqueIds(runningIds);
			}
			function threadTilePaneCountState(layout = threadTileLayout()) {
				const capacity = threadTileLayoutCapacity(layout);
				return threadTileStatePolicy.paneCountStatePlan({
					capacity,
					candidateIds: defaultThreadTileCandidateIds(layout, { maxPanes: capacity }),
					maxCandidateIds: defaultThreadTileCandidateIds(layout, { maxPanes: THREAD_TILE_USER_MAX_PANES }),
					runningIds: threadTileRunningPaneIds(),
					currentThreadId: state.currentThreadId,
					explicitPaneCount: state.threadTilePaneCount
				}, { maxPanes: THREAD_TILE_USER_MAX_PANES });
			}
			function autoThreadTilePaneCount(layout = threadTileLayout()) {
				return threadTilePaneCountState(layout).autoPaneCount;
			}
			function effectiveThreadTilePaneCount(layout = threadTileLayout()) {
				return threadTilePaneCountState(layout).effectivePaneCount;
			}
			function threadTileDisplayLayout(layout = threadTileLayout(), ids = []) {
				return threadTileStatePolicy.paneDisplayLayoutPlan({
					layout,
					ids,
					effectivePaneCount: effectiveThreadTilePaneCount(layout),
					splitPairs: threadTilePrunedSplitPairs(ids)
				}, {
					capacityMaxPanes: threadTileLayoutPolicy.DEFAULT_MAX_PANES,
					maxPanes: THREAD_TILE_USER_MAX_PANES,
					threadTileColumnGroups: threadTileLayoutPolicy.threadTileColumnGroups
				}).displayLayout;
			}
			function normalizeThreadTilePinnedIds(values = []) {
				return threadTileStatePolicy.normalizePinnedIds(values, { maxPanes: THREAD_TILE_USER_MAX_PANES });
			}
			function normalizeThreadTileSplitPairs(values = [], ids = []) {
				return threadTileStatePolicy.normalizeSplitPairs(values, ids, {
					maxPanes: THREAD_TILE_USER_MAX_PANES,
					normalizeSplitPairs: threadTileLayoutPolicy.normalizeSplitPairs
				});
			}
			function threadTilePrunedSplitPairs(ids = threadTileCandidateIds()) {
				return normalizeThreadTileSplitPairs(state.threadTileSplitPairs, ids);
			}
			function threadTileVisibleIdSet() {
				const visibleIds = new Set(visibleThreads(state.threads).map((thread) => String(thread && thread.id || "")).filter(Boolean));
				if (state.currentThreadId) visibleIds.add(String(state.currentThreadId));
				return visibleIds;
			}
			function threadTileIdsEqual(a = [], b = []) {
				return threadTileStatePolicy.idsEqual(a, b);
			}
			function threadTileCandidateIds(layout = threadTileLayout()) {
				const maxPanes = effectiveThreadTilePaneCount(layout);
				return threadTileStatePolicy.candidatePaneIdsPlan({
					pinnedIds: state.threadTilePinnedIds,
					defaultIds: defaultThreadTileCandidateIds(layout, { maxPanes }),
					visibleIds: Array.from(threadTileVisibleIdSet()),
					currentThreadId: state.currentThreadId,
					maxPanes
				}, {
					maxPanes: THREAD_TILE_USER_MAX_PANES,
					selectPinnedThreadTileIds: threadTileLayoutPolicy.selectPinnedThreadTileIds
				}).ids;
			}
			function threadDisplaySettingsPayload() {
				return threadTileStatePolicy.displaySettingsPayload({
					threadTileMode: state.threadTileMode,
					threadTilePinnedIds: state.threadTilePinnedIds,
					threadTilePaneCount: state.threadTilePaneCount,
					threadTileSplitPairs: state.threadTileSplitPairs,
					threadTileSelectedThreadId: state.threadTileSelectedThreadId
				}, {
					maxPanes: THREAD_TILE_USER_MAX_PANES,
					normalizeSplitPairs: threadTileLayoutPolicy.normalizeSplitPairs
				});
			}
			function localThreadDisplayMode() {
				try {
					return localStorage.getItem(STORAGE_THREAD_DISPLAY_MODE) === "tile" || localStorage.getItem(STORAGE_LEGACY_THREAD_TILE_MODE) === "true" ? "tile" : "single";
				} catch (_) {
					return "single";
				}
			}
			function mirrorThreadDisplayModeToLocalStorage() {
				try {
					localStorage.removeItem(STORAGE_LEGACY_THREAD_TILE_MODE);
					if (state.threadTileMode) localStorage.setItem(STORAGE_THREAD_DISPLAY_MODE, "tile");
					else localStorage.removeItem(STORAGE_THREAD_DISPLAY_MODE);
				} catch (_) {}
			}
			function applyThreadDisplaySettings(settings = {}, options = {}) {
				const normalized = threadTileStatePolicy.normalizeDisplaySettings(settings, {
					maxPanes: THREAD_TILE_USER_MAX_PANES,
					normalizeSplitPairs: threadTileLayoutPolicy.normalizeSplitPairs
				});
				state.threadTileMode = normalized.threadTileMode;
				state.threadTilePinnedIds = normalized.paneThreadIds;
				state.threadTileSplitPairs = normalized.paneSplitPairs;
				state.threadTilePaneCount = normalized.paneCount;
				state.threadTileSelectedThreadId = normalized.selectedThreadId;
				mirrorThreadDisplayModeToLocalStorage();
				syncThreadTileToggle();
				if (options.render === true) renderCurrentThread({ stickToBottom: true });
			}
			async function loadThreadDisplaySettings(options = {}) {
				try {
					const result = await api("/api/settings/thread-display");
					const settings = result && result.threadDisplay && typeof result.threadDisplay === "object" ? result.threadDisplay : {};
					state.threadDisplaySettingsLoaded = true;
					const plan = threadTileStatePolicy.displaySettingsLoadPlan({
						settings,
						localDisplayMode: localThreadDisplayMode()
					});
					if (plan.action === "apply-display-settings") applyThreadDisplaySettings(plan.settings || {}, { render: options.render === true });
					if (plan.saveAfterApply) await saveThreadDisplaySettingsNow();
				} catch (err) {
					state.threadDisplaySettingsLoaded = true;
					const plan = threadTileStatePolicy.displaySettingsLoadPlan({
						loadFailed: true,
						localDisplayMode: localThreadDisplayMode()
					});
					if (plan.action === "apply-display-settings") applyThreadDisplaySettings(plan.settings || {}, { render: options.render === true });
					if (plan.rethrow) throw err;
				}
			}
			async function saveThreadDisplaySettingsNow() {
				if (state.threadDisplaySettingsSaveTimer) {
					clearTimeout(state.threadDisplaySettingsSaveTimer);
					state.threadDisplaySettingsSaveTimer = null;
				}
				if (state.threadDisplaySettingsSaveInFlight) return null;
				state.threadDisplaySettingsSaveInFlight = true;
				try {
					const result = await api("/api/settings/thread-display", {
						method: "POST",
						body: JSON.stringify(threadDisplaySettingsPayload())
					});
					const settings = result && result.threadDisplay && typeof result.threadDisplay === "object" ? result.threadDisplay : null;
					if (settings) applyThreadDisplaySettings(settings, { render: false });
					return result;
				} finally {
					state.threadDisplaySettingsSaveInFlight = false;
				}
			}
			function scheduleThreadDisplaySettingsSave() {
				if (!state.threadDisplaySettingsLoaded) return;
				if (state.threadDisplaySettingsSaveTimer) clearTimeout(state.threadDisplaySettingsSaveTimer);
				state.threadDisplaySettingsSaveTimer = setTimeout(() => {
					state.threadDisplaySettingsSaveTimer = null;
					saveThreadDisplaySettingsNow().catch(showError);
				}, THREAD_TILE_SETTINGS_SAVE_DEBOUNCE_MS);
			}
			function syncThreadTileActivePaneState(activeIds = []) {
				const plan = threadTileStatePolicy.activePaneSyncPlan({
					enabled: state.threadTileMode,
					activeIds,
					pinnedIds: state.threadTilePinnedIds,
					visibleIds: Array.from(threadTileVisibleIdSet()),
					splitPairs: state.threadTileSplitPairs,
					selectedThreadId: state.threadTileSelectedThreadId,
					currentThreadId: state.currentThreadId
				}, {
					maxPanes: THREAD_TILE_USER_MAX_PANES,
					normalizeSplitPairs: threadTileLayoutPolicy.normalizeSplitPairs
				});
				state.threadTileActiveIds = plan.activeIds;
				if (plan.pinnedChanged) {
					state.threadTilePinnedIds = normalizeThreadTilePinnedIds(plan.paneThreadIds);
					state.threadTileSplitPairs = normalizeThreadTileSplitPairs(plan.paneSplitPairs, state.threadTilePinnedIds);
				}
				if (plan.selectedChanged) state.threadTileSelectedThreadId = plan.selectedThreadId;
				if (plan.settingsChanged) scheduleThreadDisplaySettingsSave();
				return Boolean(plan.changed);
			}
			function threadTileSummary(threadId) {
				return threadById(threadId) || (state.currentThread && String(state.currentThread.id || "") === String(threadId || "") ? state.currentThread : null);
			}
			function threadTileDisplayThread(threadId) {
				const id = String(threadId || "");
				if (state.currentThread && String(state.currentThread.id || "") === id) return state.currentThread;
				return state.threadTileDetails.get(id) || threadTileSummary(id) || {
					id,
					name: id,
					preview: id,
					turns: []
				};
			}
			function setThreadTileSelectedThread(threadId, options = {}) {
				const plan = threadTileStatePolicy.selectPanePlan({
					enabled: state.threadTileMode,
					threadId,
					activeIds: state.threadTileActiveIds,
					selectedThreadId: state.threadTileSelectedThreadId
				});
				if (plan.action !== "select-pane") return false;
				return applyThreadTileSelectedPaneEffects(threadTileStatePolicy.selectedPaneEffectsPlan(plan, { render: options.render !== false }));
			}
			function applyThreadTileSelectedPaneEffects(effect) {
				if (!effect || effect.action !== "selected-pane-effects") return false;
				if (effect.saveDraft) saveCurrentDraftNow();
				state.threadTileSelectedThreadId = effect.selectedThreadId;
				if (effect.restoreDraft) restoreDraftForCurrentTarget({ resetRuntimeWhenMissingDraft: true });
				if (effect.updateComposer) {
					renderComposerSettings();
					updateComposerControls();
				}
				if (effect.renderMode === "patch-panes") {
					let patchedAll = true;
					(Array.isArray(effect.patchThreadIds) ? effect.patchThreadIds : []).filter(Boolean).forEach((id) => {
						patchedAll = patchThreadTilePane(id, { preserveScroll: effect.patchPreserveScroll !== false }) && patchedAll;
					});
					if (!patchedAll && effect.scheduleFullRenderOnPatchMiss) scheduleRenderCurrentThread();
				}
				return true;
			}
			function threadTileVisibleThreadOptions(currentId = "") {
				const visible = visibleThreads(state.threads);
				const runningIds = visible.filter((thread) => thread && isRunningStatus(thread.status)).map((thread) => String(thread.id || "")).filter(Boolean);
				return threadTileStatePolicy.switchMenuOptionsPlan({
					currentId,
					activeIds: state.threadTileActiveIds,
					runningIds,
					visibleIds: visible.map((thread) => String(thread && thread.id || "")).filter(Boolean)
				});
			}
			function renderThreadTileSwitchMenu(currentId) {
				const current = String(currentId || "");
				const options = threadTileVisibleThreadOptions(current);
				const layout = threadTileLayout({ enabled: true });
				const activeIds = threadTileCandidateIds(layout);
				const count = activeIds.length || effectiveThreadTilePaneCount(layout);
				const minCount = threadTileMinimumPaneCount(layout);
				const maxCount = threadTileMaximumPaneCount(layout);
				const plan = threadTileStatePolicy.switchMenuPlan({
					currentId: current,
					switchMenuPaneId: state.threadTileSwitchMenuPaneId,
					options,
					activeIds,
					count,
					minCount,
					maxCount
				});
				if (plan.action !== "render-switch-menu") return "";
				return `<div class="thread-tile-switch-menu" role="listbox" aria-label="切换此窗口线程">
    <div class="thread-tile-switch-actions">
      <button class="thread-tile-switch-action" type="button" data-thread-tile-close-pane="${escapeHtml(plan.currentId)}"${plan.canClose ? "" : " disabled"}>关闭窗口</button>
      <span class="thread-tile-switch-count">${escapeHtml(String(plan.count))}/${escapeHtml(String(plan.maxCount))}</span>
      <button class="thread-tile-switch-action" type="button" data-thread-tile-pane-count="1"${plan.canAdd ? "" : " disabled"}>新增窗口</button>
    </div>
    ${plan.options.map((threadId) => {
					const thread = threadTileDisplayThread(threadId);
					const title = threadDisplayName(thread) || threadId;
					const summary = threadTileSummary(threadId) || thread;
					const pathText = shortPath(thread && thread.cwd || summary && summary.cwd || "") || "聊天";
					const timeText = formatTime(thread && thread.updatedAt || summary && summary.updatedAt, state.nowMs);
					const status = statusIconHtml(thread && thread.status, "thread-tile-switch-status", threadId);
					const selected = threadId === plan.currentId;
					return `<button class="thread-tile-switch-option${selected ? " selected" : ""}" type="button" role="option" aria-selected="${selected ? "true" : "false"}" data-thread-tile-switch-target="${escapeHtml(threadId)}">
        <span class="thread-tile-switch-main"><span class="thread-tile-switch-title">${escapeHtml(title)}</span><span class="thread-tile-switch-meta">${escapeHtml([pathText, timeText].filter(Boolean).join(" | "))}</span></span>
        ${status}
      </button>`;
				}).join("")}
  </div>`;
			}
			function applyThreadTilePaneSlotEffects(effect, layout = threadTileLayout()) {
				if (!effect || effect.action !== "pane-slot-effects") return false;
				const sourcePane = effect.patchSourceThreadId ? threadTilePaneElement(effect.patchSourceThreadId) : null;
				if (effect.saveDraft) saveCurrentDraftNow();
				if (Array.isArray(effect.paneThreadIds)) state.threadTilePinnedIds = normalizeThreadTilePinnedIds(effect.paneThreadIds);
				if (Array.isArray(effect.paneSplitPairs)) state.threadTileSplitPairs = normalizeThreadTileSplitPairs(effect.paneSplitPairs, state.threadTilePinnedIds);
				if (effect.paneCount !== null && effect.paneCount !== void 0) state.threadTilePaneCount = effect.paneCount;
				if (effect.refreshActiveIds) state.threadTileActiveIds = threadTileCandidateIds(layout);
				if (effect.selectedThreadId) state.threadTileSelectedThreadId = effect.selectedThreadId;
				if (effect.selectionPolicy === "pane-selection") state.threadTileSelectedThreadId = threadTileStatePolicy.paneSelectionPlan({
					selectedThreadId: state.threadTileSelectedThreadId,
					ids: threadTileCandidateIds(layout),
					emptyFallback: effect.selectionEmptyFallback === true
				}).selectedThreadId;
				state.threadTileSwitchMenuPaneId = effect.switchMenuPaneId || "";
				(effect.scrollResetIds || []).forEach((id) => state.threadTilePaneScrollHoldById.delete(id));
				if (effect.scheduleSettingsSave) scheduleThreadDisplaySettingsSave();
				if (effect.restoreDraft) restoreDraftForCurrentTarget({ resetRuntimeWhenMissingDraft: true });
				if (effect.updateComposer) {
					renderComposerSettings();
					updateComposerControls();
				}
				if (effect.loadThreadId) loadThreadTileDetail(effect.loadThreadId, {
					force: true,
					source: effect.loadSource || "tile-switch"
				}).catch(showError);
				if (effect.renderMode === "schedule-full") scheduleRenderCurrentThread();
				else if (effect.renderMode === "full") renderCurrentThread({ stickToBottom: Boolean(effect.renderStickToBottom) });
				else if (effect.renderMode === "patch-pane" && effect.patchThreadId) {
					if (!patchThreadTilePane(effect.patchThreadId, {
						paneElement: sourcePane,
						stickToBottom: Boolean(effect.patchStickToBottom)
					}) && effect.scheduleFullRenderOnPatchMiss) scheduleRenderCurrentThread();
				}
				return true;
			}
			function replaceThreadTilePaneThread(fromThreadId, toThreadId) {
				const from = String(fromThreadId || "").trim();
				const to = String(toThreadId || "").trim();
				if (!from || !to || !state.threadTileMode) return false;
				const layout = threadTileLayout();
				const ids = threadTileCandidateIds(layout);
				const plan = threadTileStatePolicy.replacePaneThreadPlan({
					enabled: state.threadTileMode,
					fromThreadId: from,
					toThreadId: to,
					ids,
					pinnedIds: state.threadTilePinnedIds
				}, { maxPanes: THREAD_TILE_USER_MAX_PANES });
				if (plan.action === "skip") return false;
				return applyThreadTilePaneSlotEffects(threadTileStatePolicy.paneSlotMutationEffectsPlan(plan, { maxPanes: THREAD_TILE_USER_MAX_PANES }), layout);
			}
			function moveThreadTilePaneRelative(fromThreadId, toThreadId, placement = "after") {
				const from = String(fromThreadId || "").trim();
				const to = String(toThreadId || "").trim();
				if (!from || !to || from === to || !state.threadTileMode) return false;
				const layout = threadTileLayout();
				const ids = threadTileCandidateIds(layout);
				const plan = threadTileStatePolicy.movePaneRelativePlan({
					enabled: state.threadTileMode,
					fromThreadId: from,
					toThreadId: to,
					placement,
					ids,
					splitPairs: state.threadTileSplitPairs
				}, {
					maxPanes: THREAD_TILE_USER_MAX_PANES,
					normalizeSplitPairs: threadTileLayoutPolicy.normalizeSplitPairs
				});
				if (plan.action !== "move") return false;
				return applyThreadTilePaneSlotEffects(threadTileStatePolicy.paneSlotMutationEffectsPlan(plan, { maxPanes: THREAD_TILE_USER_MAX_PANES }), layout);
			}
			function splitThreadTilePaneWithTarget(fromThreadId, toThreadId, placement = "below") {
				const from = String(fromThreadId || "").trim();
				const to = String(toThreadId || "").trim();
				if (!from || !to || from === to || !state.threadTileMode) return false;
				const layout = threadTileLayout();
				const ids = threadTileCandidateIds(layout);
				const plan = threadTileStatePolicy.splitPaneWithTargetPlan({
					enabled: state.threadTileMode,
					fromThreadId: from,
					toThreadId: to,
					placement,
					ids,
					splitPairs: state.threadTileSplitPairs
				}, {
					maxPanes: THREAD_TILE_USER_MAX_PANES,
					normalizeSplitPairs: threadTileLayoutPolicy.normalizeSplitPairs
				});
				if (plan.action !== "split") return false;
				return applyThreadTilePaneSlotEffects(threadTileStatePolicy.paneSlotMutationEffectsPlan(plan, { maxPanes: THREAD_TILE_USER_MAX_PANES }), layout);
			}
			function dropThreadTilePane(fromThreadId, toThreadId, event) {
				const from = String(fromThreadId || "").trim();
				const to = String(toThreadId || "").trim();
				const pane = event && event.target && event.target.closest ? event.target.closest("[data-thread-tile-pane]") : null;
				if (!from || !to || from === to || !pane) return false;
				const rect = pane.getBoundingClientRect();
				const plan = threadTileStatePolicy.dropPaneIntent({
					fromThreadId: from,
					toThreadId: to,
					left: rect.left,
					top: rect.top,
					width: rect.width,
					height: rect.height,
					clientX: event.clientX,
					clientY: event.clientY
				});
				if (plan.action === "move-relative") return moveThreadTilePaneRelative(from, to, plan.placement);
				if (plan.action === "split-with-target") return splitThreadTilePaneWithTarget(from, to, plan.placement);
				return false;
			}
			function replaceLastThreadTilePaneForThreadListOpen(threadId, options = {}) {
				const id = String(threadId || "").trim();
				const source = String(options.source || "").trim();
				if (!id || source !== "thread-list" || !state.threadTileMode) return false;
				const layout = threadTileLayout({ enabled: true });
				if (!layout || !layout.enabled) return false;
				const ids = threadTileCandidateIds(layout);
				const plan = threadTileStatePolicy.replaceLastPaneForThreadListOpenPlan({
					enabled: state.threadTileMode,
					source,
					threadId: id,
					ids,
					pinnedIds: state.threadTilePinnedIds
				}, { maxPanes: THREAD_TILE_USER_MAX_PANES });
				if (plan.action !== "replace-last") return false;
				return applyThreadTilePaneSlotEffects(threadTileStatePolicy.paneSlotMutationEffectsPlan(plan, { maxPanes: THREAD_TILE_USER_MAX_PANES }), layout);
			}
			function toggleThreadTileSwitchMenu(threadId) {
				const id = String(threadId || "").trim();
				if (!id || !state.threadTileMode) return false;
				setThreadTileSelectedThread(id, { render: false });
				state.threadTileSwitchMenuPaneId = state.threadTileSwitchMenuPaneId === id ? "" : id;
				if (!patchThreadTilePane(id, { preserveScroll: true })) scheduleRenderCurrentThread();
				return true;
			}
			function threadTileHasLiveThread() {
				if (!state.threadTileMode || !state.threadTileActiveIds.length) return false;
				return state.threadTileActiveIds.some((id) => {
					const thread = threadTileDisplayThread(id);
					return Boolean(latestLiveTurnForThread(thread) || isRunningStatus(thread && thread.status));
				});
			}
			function updateThreadTilePaneStatusBadges() {
				if (!state.threadTileMode) return;
				document.querySelectorAll("[data-thread-tile-pane]").forEach((pane) => {
					const id = pane.getAttribute("data-thread-tile-pane") || "";
					const container = pane.querySelector("[data-thread-tile-pane-state]");
					if (!container) return;
					const html = turnTimerStateHtml(threadTilePaneTimerState(threadTileDisplayThread(id)));
					if (container.innerHTML !== html) container.innerHTML = html;
				});
			}
			function threadTileError(threadId) {
				return state.threadTileErrors.get(String(threadId || "")) || "";
			}
			function threadTilePaneIsVisible(threadId) {
				const id = String(threadId || "");
				return Boolean(id && state.threadTileActiveIds.includes(id));
			}
			function setThreadTileConversationMode(active, layout = null) {
				const conversation = $("conversation");
				const main = document.querySelector(".main");
				document.documentElement.classList.toggle("thread-tile-open", Boolean(active));
				if (main) main.classList.toggle("thread-tile-main", Boolean(active));
				if (!conversation) return;
				conversation.classList.toggle("thread-tile-mode", Boolean(active));
				if (active && layout && layout.columns) conversation.style.setProperty("--thread-tile-columns", String(layout.columns));
				else {
					conversation.style.removeProperty("--thread-tile-columns");
					state.threadTileActiveIds = [];
					state.threadTileSelectedThreadId = "";
					state.threadTileSwitchMenuPaneId = "";
					state.threadTileViewportBaseline = null;
					state.threadTileComposerHeightBaselinePx = 0;
					for (const frame of state.threadTilePaneRenderFramesById.values()) if (window.cancelAnimationFrame) window.cancelAnimationFrame(frame);
					else clearTimeout(frame);
					state.threadTilePaneRenderFramesById.clear();
					state.threadTilePaneScrollHoldById.clear();
					clearThreadTileRefreshTimer();
					if (state.threadTileOperationRefreshTimer) {
						clearTimeout(state.threadTileOperationRefreshTimer);
						state.threadTileOperationRefreshTimer = null;
					}
				}
				updateComposerControls();
			}
			function captureThreadTilePaneScrollState() {
				const conversation = $("conversation");
				const states = /* @__PURE__ */ new Map();
				if (!conversation) return states;
				conversation.querySelectorAll("[data-thread-tile-pane]").forEach((pane) => {
					const id = pane.getAttribute("data-thread-tile-pane") || "";
					const body = pane.querySelector(".thread-tile-pane-body");
					if (!id || !body) return;
					states.set(id, threadTileStatePolicy.paneScrollMetrics({
						scrollHeight: body.scrollHeight,
						clientHeight: body.clientHeight,
						scrollTop: body.scrollTop,
						hold: state.threadTilePaneScrollHoldById.get(id) === true
					}));
				});
				return states;
			}
			function captureThreadTilePaneElementScrollState(pane) {
				const id = String(pane && pane.getAttribute && pane.getAttribute("data-thread-tile-pane") || "");
				const body = pane && pane.querySelector(".thread-tile-pane-body");
				if (!body) return null;
				return threadTileStatePolicy.paneScrollMetrics({
					scrollHeight: body.scrollHeight,
					clientHeight: body.clientHeight,
					scrollTop: body.scrollTop,
					hold: id ? state.threadTilePaneScrollHoldById.get(id) === true : false
				});
			}
			function scrollThreadTilePaneBodyToBottom(body, options = {}) {
				if (!body) return;
				const top = Math.max(0, Number(body.scrollHeight || 0));
				if (options.smooth && typeof body.scrollTo === "function") {
					body.scrollTo({
						top,
						behavior: "smooth"
					});
					setTimeout(() => updateThreadTileBottomButtonForBody(body), 220);
					return;
				}
				body.scrollTop = top;
				updateThreadTileBottomButtonForBody(body);
			}
			function isThreadTilePaneNearBottom(body) {
				if (!body) return true;
				return threadTileStatePolicy.paneScrollMetrics({
					scrollHeight: body.scrollHeight,
					clientHeight: body.clientHeight,
					scrollTop: body.scrollTop
				}).nearBottom;
			}
			function applyThreadTilePaneScrollHoldPlan(id, plan) {
				const threadId = String(id || "");
				if (!threadId || !plan || plan.action !== "pane-scroll-hold") return;
				if (plan.clearHold) state.threadTilePaneScrollHoldById.delete(threadId);
				else if (plan.rememberHold) state.threadTilePaneScrollHoldById.set(threadId, true);
			}
			function rememberThreadTilePaneScrollPosition(body) {
				const pane = body && body.closest && body.closest("[data-thread-tile-pane]");
				const id = String(pane && pane.getAttribute("data-thread-tile-pane") || "");
				if (!id || !body) return;
				applyThreadTilePaneScrollHoldPlan(id, threadTileStatePolicy.paneScrollHoldPlan({
					scrollHeight: body.scrollHeight,
					clientHeight: body.clientHeight,
					scrollTop: body.scrollTop
				}));
			}
			function updateThreadTileBottomButtonForBody(body) {
				const pane = body && body.closest && body.closest("[data-thread-tile-pane]");
				const button = pane && pane.querySelector("[data-thread-tile-bottom]");
				if (!button || !body) return;
				const metrics = threadTileStatePolicy.paneScrollMetrics({
					scrollHeight: body.scrollHeight,
					clientHeight: body.clientHeight,
					scrollTop: body.scrollTop
				});
				applyThreadTilePaneScrollHoldPlan(pane.getAttribute("data-thread-tile-pane") || "", threadTileStatePolicy.paneScrollHoldPlan(metrics));
				const plan = threadTileStatePolicy.paneBottomButtonPlan({ metrics });
				const shouldShow = Boolean(plan.shouldShow);
				button.classList.toggle("hidden", !shouldShow);
				button.setAttribute("aria-hidden", shouldShow ? "false" : "true");
				button.tabIndex = shouldShow ? 0 : -1;
			}
			function updateThreadTileBottomButtons() {
				const conversation = $("conversation");
				if (!conversation) return;
				conversation.querySelectorAll(".thread-tile-pane-body").forEach(updateThreadTileBottomButtonForBody);
			}
			function restoreThreadTilePaneScrollState(scrollState = /* @__PURE__ */ new Map()) {
				const conversation = $("conversation");
				if (!conversation) return;
				conversation.querySelectorAll("[data-thread-tile-pane]").forEach((pane) => {
					const id = pane.getAttribute("data-thread-tile-pane") || "";
					const body = pane.querySelector(".thread-tile-pane-body");
					if (!id || !body) return;
					const previous = scrollState.get(id);
					const plan = threadTileStatePolicy.paneScrollRestorePlan({
						previous,
						scrollHeight: body.scrollHeight,
						clientHeight: body.clientHeight
					});
					if (plan.mode === "restore-distance") {
						body.scrollTop = plan.top;
						updateThreadTileBottomButtonForBody(body);
						return;
					}
					scrollThreadTilePaneBodyToBottom(body);
				});
			}
			function restoreThreadTilePaneElementScrollState(pane, previous, options = {}) {
				const body = pane && pane.querySelector(".thread-tile-pane-body");
				if (!body) return;
				const id = String(pane && pane.getAttribute && pane.getAttribute("data-thread-tile-pane") || "");
				const plan = threadTileStatePolicy.paneScrollRestorePlan({
					previous,
					rememberedHold: Boolean(id && state.threadTilePaneScrollHoldById.get(id) === true),
					stickToBottom: options.stickToBottom === true,
					scrollHeight: body.scrollHeight,
					clientHeight: body.clientHeight
				});
				if (plan.mode !== "restore-distance") {
					scrollThreadTilePaneBodyToBottom(body);
					return;
				}
				body.scrollTop = plan.top;
				updateThreadTileBottomButtonForBody(body);
			}
			function scrollThreadTilePaneToBottom(threadId, options = {}) {
				const id = String(threadId || "");
				if (!id) return;
				const pane = Array.from(document.querySelectorAll("[data-thread-tile-pane]")).find((entry) => String(entry.getAttribute("data-thread-tile-pane") || "") === id);
				scrollThreadTilePaneBodyToBottom(pane && pane.querySelector(".thread-tile-pane-body"), options);
			}
			function clearThreadTileRefreshTimer() {
				clearTimeout(state.threadTileRefreshTimer);
				state.threadTileRefreshTimer = null;
			}
			function clearThreadTileDetailLoadQueueTimer() {
				clearTimeout(state.threadTileDetailLoadQueueTimer);
				state.threadTileDetailLoadQueueTimer = null;
			}
			function scheduleThreadTileDetailLoadQueueDrain(options = {}) {
				const plan = threadTileStatePolicy.detailLoadQueueDrainPlan({
					enabled: state.threadTileMode,
					activeIds: state.threadTileActiveIds,
					hasTimer: Boolean(state.threadTileDetailLoadQueueTimer),
					pending: options.pending === true,
					force: options.force === true,
					delayMs: options.delayMs
				}, { defaultDelayMs: THREAD_TILE_DETAIL_LOAD_QUEUE_DRAIN_MS });
				if (plan.clearTimer) {
					clearThreadTileDetailLoadQueueTimer();
					return false;
				}
				if (!plan.schedule) return false;
				state.threadTileDetailLoadQueueTimer = setTimeout(() => {
					state.threadTileDetailLoadQueueTimer = null;
					if (!state.threadTileMode) return;
					ensureThreadTileDetails(state.threadTileActiveIds);
				}, plan.delayMs);
				return true;
			}
			function scheduleThreadTileRefresh(delayMs = THREAD_TILE_REFRESH_INTERVAL_MS) {
				const plan = threadTileStatePolicy.refreshSchedulePlan({
					enabled: state.threadTileMode,
					visibilityState: document.visibilityState,
					activeIds: state.threadTileActiveIds,
					hasTimer: Boolean(state.threadTileRefreshTimer),
					delayMs
				}, {
					defaultDelayMs: THREAD_TILE_REFRESH_INTERVAL_MS,
					minDelayMs: 500
				});
				if (plan.clearTimer) {
					clearThreadTileRefreshTimer();
					return;
				}
				if (!plan.schedule) return;
				state.threadTileRefreshTimer = setTimeout(() => {
					state.threadTileRefreshTimer = null;
					if (!state.threadTileMode || document.visibilityState === "hidden") return;
					refreshThreadTileDetails(state.threadTileActiveIds, { source: "tile-refresh" }).catch(showError);
					scheduleThreadTileRefresh();
				}, plan.delayMs);
			}
			async function refreshThreadTileDetails(ids = [], options = {}) {
				const uniqueIds = threadTileStatePolicy.uniqueIds(ids);
				const visibleIds = uniqueIds.filter((id) => threadTilePaneIsVisible(id));
				const targetIds = threadTileStatePolicy.refreshTargetIds({
					enabled: state.threadTileMode,
					ids: uniqueIds,
					visibleIds,
					currentThreadId: state.currentThread && state.currentThread.id
				});
				if (!targetIds.length) return;
				await Promise.all(targetIds.map((id) => {
					return loadThreadTileDetail(id, {
						force: true,
						background: true,
						source: options.source || "tile-refresh"
					});
				}));
			}
			function abortThreadTileLoads() {
				clearThreadTileRefreshTimer();
				clearThreadTileDetailLoadQueueTimer();
				state.threadTileActiveIds = [];
				for (const frame of state.threadTilePaneRenderFramesById.values()) if (window.cancelAnimationFrame) window.cancelAnimationFrame(frame);
				else clearTimeout(frame);
				state.threadTilePaneRenderFramesById.clear();
				state.threadTilePaneScrollHoldById.clear();
				for (const controller of state.threadTileControllers.values()) try {
					controller.abort();
				} catch (_) {}
				state.threadTileControllers.clear();
				state.threadTileLoadingIds.clear();
			}
			async function loadThreadTileDetail(threadId, options = {}) {
				const id = String(threadId || "");
				const cached = state.threadTileDetails.get(id);
				const currentThreadId = state.currentThread && String(state.currentThread.id || "");
				const plan = threadTileStatePolicy.detailLoadPlan({
					threadId: id,
					currentThreadId,
					currentThreadLoaded: Boolean(currentThreadId === id && state.currentThread && !state.currentThread.mobileLoading),
					controllerActive: state.threadTileControllers.has(id),
					loadingActive: state.threadTileLoadingIds.has(id),
					cachedReady: Boolean(cached && !cached.mobileLoading && !cached.mobileLoadError),
					force: options.force === true,
					backgroundRequested: options.background === true,
					lastLoadedAt: Number(state.threadTileLoadedAtById.get(id) || 0),
					nowMs: Date.now(),
					minIntervalMs: THREAD_TILE_REFRESH_MIN_INTERVAL_MS
				});
				if (plan.action !== "load") return;
				const background = plan.background;
				const controller = new AbortController();
				applyThreadTileDetailLoadStartEffects(threadTileStatePolicy.detailLoadStartEffectsPlan(plan), controller);
				try {
					const result = await api(threadDetailApiPath(id, { mode: "recent" }), {
						timeoutMs: 2e4,
						signal: controller.signal
					});
					if (controller.signal.aborted) return;
					if (result && result.thread) applyThreadTileDetailLoadSuccessEffects(threadTileStatePolicy.detailLoadSuccessEffectsPlan({
						id,
						hasThread: true,
						nowMs: Date.now()
					}), result.thread);
				} catch (err) {
					applyThreadTileDetailLoadErrorEffects(threadTileStatePolicy.detailLoadErrorEffectsPlan({
						id,
						aborted: controller.signal.aborted,
						background,
						errorMessage: err && err.message ? err.message : String(err)
					}));
				} finally {
					applyThreadTileDetailLoadFinallyEffects(threadTileStatePolicy.detailLoadFinallyEffectsPlan({
						id,
						controllerMatches: state.threadTileControllers.get(id) === controller,
						visible: threadTilePaneIsVisible(id)
					}));
				}
			}
			function applyThreadTileDetailLoadStartEffects(effect, controller) {
				if (!effect || effect.action !== "detail-load-start-effects") return false;
				const id = String(effect.id || "");
				if (!id) return false;
				if (effect.setController) state.threadTileControllers.set(id, controller);
				if (effect.markLoading) {
					state.threadTileLoadingIds.add(id);
					if (effect.renderPane && !scheduleRenderThreadTilePane(id, { preserveScroll: effect.preserveScroll !== false })) scheduleRenderCurrentThread();
				}
				if (effect.clearError) state.threadTileErrors.delete(id);
				return true;
			}
			function applyThreadTileDetailLoadSuccessEffects(effect, thread) {
				if (!effect || effect.action !== "detail-load-success-effects" || !thread) return false;
				const id = String(effect.id || "");
				if (!id) return false;
				if (effect.setDetail) {
					const existing = state.threadTileDetails.get(id);
					state.threadTileDetails.set(id, mergeThreadPreservingVisibleItems(existing, thread));
				}
				if (effect.setLoadedAt) state.threadTileLoadedAtById.set(id, Number(effect.loadedAtMs || Date.now()));
				if (effect.clearError) state.threadTileErrors.delete(id);
				if (effect.mergeThread) mergeThreadIntoThreadList(thread);
				return true;
			}
			function applyThreadTileDetailLoadErrorEffects(effect) {
				if (!effect || effect.action !== "detail-load-error-effects") return false;
				const id = String(effect.id || "");
				if (!id) return false;
				state.threadTileErrors.set(id, effect.errorMessage || "Thread load failed");
				return true;
			}
			function applyThreadTileDetailLoadFinallyEffects(effect) {
				if (!effect || effect.action !== "detail-load-finally-effects") return false;
				const id = String(effect.id || "");
				if (!id) return false;
				if (effect.clearController) state.threadTileControllers.delete(id);
				if (effect.clearLoading) state.threadTileLoadingIds.delete(id);
				if (effect.renderPane && !scheduleRenderThreadTilePane(id, { preserveScroll: effect.preserveScroll !== false })) scheduleRenderCurrentThread();
				if (effect.scheduleQueueDrain) scheduleThreadTileDetailLoadQueueDrain({ force: true });
				return true;
			}
			function applyThreadTileDetailLoadQueuePlan(plan) {
				if (!plan || plan.action !== "detail-load-queue") return false;
				for (const id of Array.isArray(plan.abortIds) ? plan.abortIds : []) {
					const controller = state.threadTileControllers.get(id);
					if (controller && typeof controller.abort === "function") try {
						controller.abort();
					} catch (_) {}
					state.threadTileControllers.delete(id);
					state.threadTileLoadingIds.delete(id);
				}
				for (const id of Array.isArray(plan.loadIds) ? plan.loadIds : []) loadThreadTileDetail(id).catch(showError);
				if (plan.scheduleDrainAfterLoad) scheduleThreadTileDetailLoadQueueDrain({ pending: true });
				return true;
			}
			function ensureThreadTileDetails(ids = []) {
				if (!state.threadTileMode) return;
				syncThreadTileActivePaneState(ids);
				const currentThreadId = state.currentThread && String(state.currentThread.id || "");
				const readyIds = state.threadTileActiveIds.filter((id) => {
					if (currentThreadId && currentThreadId === id && state.currentThread && !state.currentThread.mobileLoading) return true;
					const cached = state.threadTileDetails.get(id);
					return Boolean(cached && !cached.mobileLoading && !cached.mobileLoadError);
				});
				const concurrency = threadTileStatePolicy.detailLoadConcurrencyPlan({
					activeIds: state.threadTileActiveIds,
					maxPanes: THREAD_TILE_USER_MAX_PANES
				});
				applyThreadTileDetailLoadQueuePlan(threadTileStatePolicy.detailLoadQueuePlan({
					enabled: state.threadTileMode,
					activeIds: state.threadTileActiveIds,
					controllerIds: Array.from(state.threadTileControllers.keys()),
					loadingIds: Array.from(state.threadTileLoadingIds),
					readyIds,
					maxConcurrentLoads: concurrency.maxConcurrentLoads
				}));
				scheduleThreadTileRefresh();
			}
			function renderThreadTileTurn(thread, turn, previousKeys = /* @__PURE__ */ new Set()) {
				return withRenderContextThread(thread, () => {
					const threadId = String(thread && thread.id || "");
					const renderedItems = visibleItemsForTurn(turn, thread).map((entry, index) => {
						const item = entry && entry.item;
						const sourceIndex = Number.isInteger(entry && entry.sourceIndex) && entry.sourceIndex >= 0 ? entry.sourceIndex : index;
						return renderVisibleItemPatchHtml(turn, item, previousKeys, sourceIndex, thread);
					}).filter(Boolean).join("");
					const budgetNoticeHtml = renderTurnVisibleItemBudgetNotice(turn, previousKeys);
					const turnApprovals = approvalsForTurn(threadId, turn && turn.id);
					const approvalsHtml = turnApprovals.length ? `<div class="approval-stack in-turn">${turnApprovals.map((request) => renderApprovalRequest(request, previousKeys, threadId)).join("")}</div>` : "";
					if (!budgetNoticeHtml.trim() && !renderedItems.trim() && !approvalsHtml.trim()) return "";
					const turnId = String(turn && (turn.id || turn.startedAt || "turn") || "turn");
					return `<article class="turn thread-tile-turn" data-thread-tile-turn="${escapeHtml(turnId)}" data-render-key="${escapeHtml(`tile-turn|${threadId}|${turnId}`)}">
      ${budgetNoticeHtml}${renderedItems}${approvalsHtml}
    </article>`;
				});
			}
			function scheduleThreadTileOperationMinimumRefresh(delayMs = LIVE_OPERATION_BUBBLE_MIN_VISIBLE_MS) {
				if (state.threadTileOperationRefreshTimer) clearTimeout(state.threadTileOperationRefreshTimer);
				state.threadTileOperationRefreshTimer = setTimeout(() => {
					state.threadTileOperationRefreshTimer = null;
					const plan = threadTileStatePolicy.operationMinimumRefreshPlan({
						enabled: state.threadTileMode,
						activeIds: state.threadTileActiveIds
					});
					if (plan.action === "operation-minimum-refresh") {
						let patchedAny = false;
						for (const id of plan.patchThreadIds || []) patchedAny = scheduleRenderThreadTilePane(id, { preserveScroll: true }) || patchedAny;
						if (plan.fullRenderOnPatchMiss && !patchedAny) scheduleRenderCurrentThread();
					}
				}, Math.max(0, Number(delayMs) || 0) + 16);
			}
			function rememberThreadTileOperationBubble(threadId, html = "") {
				const id = String(threadId || "");
				const record = threadTileStatePolicy.operationBubbleRecord({
					threadId: id,
					html,
					minVisibleMs: LIVE_OPERATION_BUBBLE_MIN_VISIBLE_MS,
					nowMs: Date.now()
				});
				if (!record) return;
				state.threadTileOperationBubblesById.set(id, record);
			}
			function clearThreadTileOperationBubble(threadId) {
				const id = String(threadId || "");
				if (!id) return;
				state.threadTileOperationBubblesById.delete(id);
			}
			function renderThreadTileOperationDock(thread, previousKeys = /* @__PURE__ */ new Set()) {
				const id = String(thread && thread.id || "");
				if (!id) return "";
				const entry = currentLiveOperationEntry(thread);
				const mode = threadTileStatePolicy.normalizeOperationMode(state.threadTileOperationModesById.get(id) || "compact");
				const plan = threadTileStatePolicy.operationDockPlan({
					threadId: id,
					mode,
					entryType: entry && entry.item && entry.item.type,
					hasOperation: Boolean(entry && entry.item && entry.item.type !== "liveTurnStatus"),
					hasLiveTurn: Boolean(latestLiveTurnForThread(thread)),
					remembered: state.threadTileOperationBubblesById.get(id),
					nowMs: Date.now()
				});
				if (plan.action === "render-remembered-operation") {
					if (plan.scheduleMinimumRefresh) scheduleThreadTileOperationMinimumRefresh(plan.remainingMs);
					return plan.html || "";
				}
				if (plan.action === "clear-remembered-operation") {
					if (plan.clearRemembered) state.threadTileOperationBubblesById.delete(id);
					return "";
				}
				if (plan.action !== "render-live-operation" || !entry || !entry.item) return "";
				const html = `<div class="thread-tile-operation-dock" data-thread-tile-operation-dock="${escapeHtml(id)}" data-mode="${escapeHtml(mode)}">
    <div class="live-operation-dock-inner">
      ${renderMobileOperationStack(entry.item, entry.turn, previousKeys, entry.sourceIndex, plan.expanded, {
					toggleAttribute: "data-thread-tile-operation-toggle",
					toggleValue: id
				})}
    </div>
  </div>`;
				rememberThreadTileOperationBubble(id, html);
				return html;
			}
			function threadTileOperationSignature(threadId) {
				const id = String(threadId || "");
				const thread = threadTileDisplayThread(id);
				const entry = currentLiveOperationEntry(thread);
				return threadTileStatePolicy.operationSignature({
					mode: state.threadTileOperationModesById.get(id) || "compact",
					remembered: state.threadTileOperationBubblesById.get(id),
					nowMs: Date.now(),
					entrySignature: entry && entry.item && entry.item.type !== "liveTurnStatus" ? visibleItemSignature(entry.item, entry.turn, thread) : null
				});
			}
			function applyThreadTileOperationModeTogglePlan(effect) {
				if (!effect || effect.action !== "operation-mode-toggle-effects") return false;
				const id = String(effect.id || "");
				if (!id) return false;
				state.threadTileOperationModesById.set(id, threadTileStatePolicy.normalizeOperationMode(effect.mode));
				if (effect.selectPane) setThreadTileSelectedThread(id, { render: effect.selectPaneRender !== false });
				if (effect.patchThreadId && !patchThreadTilePane(effect.patchThreadId, { preserveScroll: effect.patchPreserveScroll !== false })) {
					if (effect.scheduleFullRenderOnPatchMiss) scheduleRenderCurrentThread();
				}
				return true;
			}
			function threadTileMinimumPaneCount(layout = threadTileLayout()) {
				return threadTilePaneCountState(layout).minPaneCount;
			}
			function threadTileMaximumPaneCount(layout = threadTileLayout()) {
				return threadTilePaneCountState(layout).maxPaneCount;
			}
			function setThreadTilePaneCount(nextCount, options = {}) {
				if (!state.threadTileMode) return false;
				const layout = threadTileLayout({ enabled: true });
				if (!layout || !layout.enabled) return false;
				const minCount = threadTileMinimumPaneCount(layout);
				const maxCount = threadTileMaximumPaneCount(layout);
				const current = effectiveThreadTilePaneCount(layout);
				const plan = threadTileStatePolicy.paneCountChangePlan({
					enabled: state.threadTileMode,
					layoutEnabled: layout.enabled,
					nextCount,
					currentCount: current,
					storedPaneCount: state.threadTilePaneCount,
					minCount,
					maxCount
				}, { maxPanes: THREAD_TILE_USER_MAX_PANES });
				if (plan.action !== "set-pane-count") return false;
				return applyThreadTilePaneSlotEffects(threadTileStatePolicy.paneSlotMutationEffectsPlan(plan, {
					maxPanes: THREAD_TILE_USER_MAX_PANES,
					render: options.render !== false
				}), layout);
			}
			function changeThreadTilePaneCount(delta) {
				const layout = threadTileLayout({ enabled: true });
				if (!layout || !layout.enabled) return false;
				return setThreadTilePaneCount(effectiveThreadTilePaneCount(layout) + (Number(delta) || 0));
			}
			function closeThreadTilePane(threadId) {
				const id = String(threadId || "").trim();
				if (!id || !state.threadTileMode) return false;
				const layout = threadTileLayout({ enabled: true });
				if (!layout || !layout.enabled) return false;
				const ids = threadTileCandidateIds(layout);
				const minCount = threadTileMinimumPaneCount(layout);
				const plan = threadTileStatePolicy.closePanePlan({
					enabled: state.threadTileMode,
					layoutEnabled: layout.enabled,
					threadId: id,
					ids,
					pinnedIds: state.threadTilePinnedIds,
					defaultIds: defaultThreadTileCandidateIds(layout, { maxPanes: threadTileMaximumPaneCount(layout) }),
					minCount
				}, { maxPanes: THREAD_TILE_USER_MAX_PANES });
				if (plan.action !== "close-pane") return false;
				return applyThreadTilePaneSlotEffects(threadTileStatePolicy.paneSlotMutationEffectsPlan(plan, { maxPanes: THREAD_TILE_USER_MAX_PANES }), layout);
			}
			function renderThreadTilePane(threadId, layout, previousKeys = /* @__PURE__ */ new Set()) {
				const thread = threadTileDisplayThread(threadId);
				const id = String(threadId || thread && thread.id || "");
				const title = threadTitleForDisplay(thread) || id;
				const summary = threadTileSummary(id);
				const paneStateHtml = turnTimerStateHtml(threadTilePaneTimerState(thread || summary));
				const error = threadTileError(id);
				const loading = state.threadTileLoadingIds.has(id) || thread && thread.mobileLoading && !threadHasVisibleConversationTurns(thread);
				const readWarning = threadReadWarningMessage(thread);
				const turns = visibleTurnsForConversation(thread);
				const visibleTurnIds = new Set(turns.map((turn) => turn && turn.id).filter(Boolean).map(String));
				const omitted = Number(thread && thread.mobileOmittedTurnCount || 0) + Math.max(0, (thread && thread.turns || []).length - turns.length);
				const historyNote = renderThreadHistoryNote(thread, omitted, previousKeys);
				const approvalsHtml = renderPendingApprovals(thread, previousKeys, (request) => {
					const turnId = approvalTurnId(request);
					if (turnId && visibleTurnIds.has(turnId)) return false;
					return isApprovalActive(request);
				});
				const body = error ? `<div class="thread-tile-empty error">Thread failed: ${escapeHtml(error)}</div>` : loading ? `<div class="thread-tile-empty">Loading thread...</div>` : [
					historyNote,
					readWarning ? `<div class="history-note">${escapeHtml(readWarning)}</div>` : "",
					turns.map((turn) => renderThreadTileTurn(thread, turn, previousKeys)).join("") || `<div class="thread-tile-empty">No visible turns.</div>`,
					approvalsHtml
				].join("");
				const active = id && id === effectiveThreadTileSelectedThreadId() ? " active" : "";
				const operationDock = renderThreadTileOperationDock(thread, previousKeys);
				const switchMenu = renderThreadTileSwitchMenu(id);
				return `<section class="thread-tile-pane${active}" data-thread-tile-pane="${escapeHtml(id)}" data-render-key="${escapeHtml(`thread-tile|${id}`)}">
    <header class="thread-tile-pane-header">
      <div class="thread-tile-pane-title-wrap">
        <button class="thread-tile-pane-title-button" type="button" draggable="true" data-thread-tile-drag-handle="${escapeHtml(id)}" data-thread-tile-title="${escapeHtml(id)}" aria-haspopup="listbox" aria-expanded="${state.threadTileSwitchMenuPaneId === id ? "true" : "false"}">
          <span class="thread-tile-pane-title">${escapeHtml(title)}</span>
        </button>
        ${switchMenu}
      </div>
      <div class="thread-tile-pane-state-slot" data-thread-tile-pane-state>${paneStateHtml}</div>
    </header>
    <div class="thread-tile-pane-body"><div class="thread-tile-pane-content">${body}</div></div>
    ${operationDock}
    <button class="thread-tile-bottom-button hidden" type="button" data-thread-tile-bottom="${escapeHtml(id)}" aria-label="跳到此线程底部" title="跳到底部" aria-hidden="true" tabindex="-1">↓</button>
  </section>`;
			}
			function threadTilePaneElement(threadId) {
				const id = String(threadId || "");
				if (!id) return null;
				return Array.from(document.querySelectorAll("[data-thread-tile-pane]")).find((entry) => String(entry.getAttribute("data-thread-tile-pane") || "") === id) || null;
			}
			function threadTileRenderSignature(layout, ids) {
				return threadTileStatePolicy.paneRenderSignaturePlan({
					layout,
					ids,
					desiredPaneCount: normalizeThreadTilePaneCount(state.threadTilePaneCount, 0),
					splitPairs: threadTilePrunedSplitPairs(ids),
					selectedThreadId: effectiveThreadTileSelectedThreadId(ids),
					loadingIds: ids.filter((id) => state.threadTileLoadingIds.has(id)),
					switchMenuPaneId: state.threadTileSwitchMenuPaneId || "",
					errors: ids.map((id) => [id, threadTileError(id)]),
					operations: ids.map((id) => [id, threadTileOperationSignature(id)]),
					threadSignatures: ids.map((id) => conversationRenderSignature(threadTileDisplayThread(id)))
				}, { maxPanes: THREAD_TILE_USER_MAX_PANES }).signature;
			}
			function patchThreadTilePane(threadId, options = {}) {
				const id = String(threadId || "").trim();
				let preflight = threadTileStatePolicy.panePatchPreflightPlan({
					threadId: id,
					enabled: state.threadTileMode,
					visible: id ? threadTilePaneIsVisible(id) : false
				});
				if (!preflight.shouldContinue) return false;
				const conversation = $("conversation");
				preflight = threadTileStatePolicy.panePatchPreflightPlan({
					threadId: id,
					enabled: state.threadTileMode,
					visible: true,
					conversationPresent: Boolean(conversation),
					tileSurface: Boolean(conversation && conversation.classList.contains("thread-tile-mode"))
				});
				if (!preflight.shouldContinue) return false;
				const board = conversation.querySelector("[data-thread-tile-board]");
				preflight = threadTileStatePolicy.panePatchPreflightPlan({
					threadId: id,
					enabled: state.threadTileMode,
					visible: true,
					conversationPresent: true,
					tileSurface: true,
					boardPresent: Boolean(board)
				});
				if (!preflight.shouldContinue) return false;
				const layout = threadTileLayout();
				preflight = threadTileStatePolicy.panePatchPreflightPlan({
					threadId: id,
					enabled: state.threadTileMode,
					visible: true,
					conversationPresent: true,
					tileSurface: true,
					boardPresent: true,
					layoutEnabled: Boolean(layout && layout.enabled)
				});
				if (!preflight.shouldContinue) return false;
				const ids = threadTileCandidateIds(layout);
				preflight = threadTileStatePolicy.panePatchPreflightPlan({
					threadId: id,
					enabled: state.threadTileMode,
					visible: true,
					conversationPresent: true,
					tileSurface: true,
					boardPresent: true,
					layoutEnabled: true,
					ids
				});
				if (!preflight.shouldContinue) return false;
				const displayLayout = threadTileDisplayLayout(layout, ids);
				const pane = options.paneElement || threadTilePaneElement(id);
				preflight = threadTileStatePolicy.panePatchPreflightPlan({
					threadId: id,
					enabled: state.threadTileMode,
					visible: true,
					conversationPresent: true,
					tileSurface: true,
					boardPresent: true,
					layoutEnabled: true,
					ids,
					panePresent: Boolean(pane)
				});
				if (!preflight.canPatch) return false;
				const previousScroll = captureThreadTilePaneElementScrollState(pane);
				const previousKeys = existingConversationRenderKeys();
				const template = document.createElement("template");
				template.innerHTML = renderThreadTilePane(id, displayLayout, previousKeys);
				const sourcePane = template.content.firstElementChild;
				let completion = threadTileStatePolicy.panePatchCompletionPlan({
					threadId: id,
					sourcePanePresent: Boolean(sourcePane)
				});
				if (!completion.returnValue) return false;
				const patchedPane = patchNode(pane, sourcePane);
				completion = threadTileStatePolicy.panePatchCompletionPlan({
					threadId: id,
					sourcePanePresent: true,
					patchedPanePresent: Boolean(patchedPane),
					requestAnimationFrameAvailable: typeof window.requestAnimationFrame === "function"
				});
				if (!completion.returnValue) return false;
				if (completion.hydrate) hydrateThreadDetailSurface(patchedPane, { imageScanDelays: [0, 180] });
				if (completion.restoreScroll) restoreThreadTilePaneElementScrollState(patchedPane, previousScroll, options);
				if (completion.updateBottomButton) {
					const updateBottomButton = () => updateThreadTileBottomButtonForBody(patchedPane.querySelector(".thread-tile-pane-body"));
					if (completion.updateBottomButtonMode === "animation-frame" && typeof window.requestAnimationFrame === "function") window.requestAnimationFrame(updateBottomButton);
					else updateBottomButton();
				}
				if (completion.writeRenderSignature) state.renderedConversationSignature = threadTileRenderSignature(displayLayout, ids);
				if (completion.clearPatchShellSignature) state.renderedConversationPatchShellSignature = "";
				if (completion.bindActions) bindThreadTileActions();
				else return false;
				return completion.returnValue;
			}
			function isThreadTileConversationSurface() {
				const conversation = $("conversation");
				return Boolean(state.threadTileMode && conversation && conversation.classList && conversation.classList.contains("thread-tile-mode"));
			}
			function threadDetailDomPatchSurface(options = {}) {
				const id = String(options.threadId || state.currentThreadId || state.currentThread && state.currentThread.id || "").trim();
				return threadDetailPatchPlanApi.planThreadDetailDomPatchSurface({
					threadId: id,
					threadTileMode: state.threadTileMode,
					threadTileSurface: isThreadTileConversationSurface(),
					tilePaneVisible: id ? threadTilePaneIsVisible(id) : false,
					conversationPresent: Boolean($("conversation"))
				});
			}
			function canPatchSingleThreadConversationDom(options = {}) {
				const plan = threadDetailDomPatchSurface(options);
				return Boolean(plan && plan.canPatch && plan.surface === "single-thread");
			}
			function patchCurrentThreadTilePaneFromState(options = {}) {
				const plan = threadDetailDomPatchSurface(options);
				if (!plan || !plan.canPatch || plan.surface !== "thread-tile-pane") return false;
				clearGlobalLiveOperationDockForThreadTiles();
				return patchThreadTilePane(plan.threadId, Object.assign({ preserveScroll: true }, options));
			}
			function scheduleRenderThreadTilePane(threadId, options = {}) {
				const id = String(threadId || "").trim();
				const plan = threadTileStatePolicy.paneRenderFramePlan({
					threadId: id,
					enabled: state.threadTileMode,
					visible: id ? threadTilePaneIsVisible(id) : false,
					hasFrame: id ? state.threadTilePaneRenderFramesById.has(id) : false
				});
				if (plan.action === "skip" || !plan.returnValue) return false;
				if (!plan.scheduleFrame) return true;
				const render = () => {
					state.threadTilePaneRenderFramesById.delete(id);
					if (!patchThreadTilePane(id, options) && plan.fullRenderOnPatchMiss) scheduleRenderCurrentThread();
				};
				const frame = window.requestAnimationFrame ? window.requestAnimationFrame(render) : setTimeout(render, 33);
				state.threadTilePaneRenderFramesById.set(id, frame);
				return true;
			}
			function renderThreadTileLayout(layout, options = {}) {
				const ids = threadTileCandidateIds(layout);
				if (!ids.length) return false;
				const displayLayout = threadTileDisplayLayout(layout, ids);
				const scrollState = captureThreadTilePaneScrollState();
				ensureThreadTileDetails(ids);
				updateThreadTileGlobalHeader(displayLayout, ids);
				state.nowMs = Date.now();
				const previousKeys = existingConversationRenderKeys();
				const html = `<div class="thread-tile-board" data-thread-tile-board data-render-key="thread-tile-board">
    ${(Array.isArray(displayLayout.columnGroups) && displayLayout.columnGroups.length ? displayLayout.columnGroups : ids.map((id) => [id])).map((group, index) => `<div class="thread-tile-column" data-thread-tile-column="${escapeHtml(String(index))}" style="--thread-tile-column-rows: ${escapeHtml(String(Math.max(1, group.length)))}">
      ${group.map((id) => renderThreadTilePane(id, displayLayout, previousKeys)).join("")}
    </div>`).join("")}
  </div>`;
				const signature = threadTileRenderSignature(displayLayout, ids);
				const visibleShape = threadTileVisibleShape(ids);
				const expectedVisibleTurnCount = visibleShape.turnCount;
				const renderedDomTurnCount = threadTileDomTurnCount();
				const renderedDomShape = conversationDomShape();
				setThreadTileConversationMode(true, displayLayout);
				updateConversationHtml(html, signature, {
					stickToBottom: options.stickToBottom === true,
					patchShellSignature: "",
					expectedVisibleTurnCount,
					renderedDomTurnCount,
					expectedVisibleItemCount: visibleShape.visibleItemCount,
					renderedDomItemCount: renderedDomShape.itemCount,
					duplicateRenderKeyCount: renderedDomShape.duplicateRenderKeyCount,
					duplicateUserMessageCount: renderedDomShape.duplicateUserMessageCount,
					expectedDuplicateUserMessageCount: visibleShape.duplicateUserMessageCount,
					action: "thread-tile-empty-state",
					routeKind: "thread-tile",
					threadHash: diagnosticHash(`thread-tile:${ids.join("|")}`),
					currentTurns: expectedVisibleTurnCount,
					currentVisibleItems: visibleShape.visibleItemCount,
					source: "thread-tile-render",
					checkProjectionConsistency: true
				});
				bindThreadTileActions();
				restoreThreadTilePaneScrollState(scrollState);
				if (typeof window.requestAnimationFrame === "function") window.requestAnimationFrame(() => {
					restoreThreadTilePaneScrollState(scrollState);
					updateThreadTileBottomButtons();
				});
				return true;
			}
			function bindThreadTileActions() {
				const conversation = $("conversation");
				if (!conversation) return;
				if (conversation.dataset.threadTileActionsBound === "true") return;
				conversation.dataset.threadTileActionsBound = "true";
				conversation.addEventListener("pointerdown", (event) => {
					const plan = threadTileActionsApi.resolveThreadTilePointerAction({
						target: event.target,
						root: conversation
					});
					if (plan.action === "select-pane") {
						setThreadTileSelectedThread(plan.paneId || "");
						return;
					}
					if (plan.stopPropagation) {
						event.stopPropagation();
						return;
					}
				});
				conversation.addEventListener("focusin", (event) => {
					const plan = threadTileActionsApi.resolveThreadTileFocusAction({
						target: event.target,
						root: conversation
					});
					if (plan.action === "select-pane") setThreadTileSelectedThread(plan.paneId || "");
				});
				conversation.addEventListener("click", (event) => {
					const plan = threadTileActionsApi.resolveThreadTileClickAction({
						target: event.target,
						root: conversation
					});
					if (plan.preventDefault) event.preventDefault();
					if (plan.stopPropagation) event.stopPropagation();
					if (plan.action === "toggle-switch-menu") {
						toggleThreadTileSwitchMenu(plan.paneId || "");
						return;
					}
					if (plan.action === "switch-pane-thread") {
						replaceThreadTilePaneThread(plan.fromId || "", plan.toId || "");
						return;
					}
					if (plan.action === "change-pane-count") {
						if (!plan.disabled) changeThreadTilePaneCount(Number(plan.delta || 0));
						return;
					}
					if (plan.action === "close-pane") {
						if (!plan.disabled) closeThreadTilePane(plan.paneId || "");
						return;
					}
					if (plan.action === "scroll-pane-bottom") {
						scrollThreadTilePaneToBottom(plan.paneId || "", { smooth: true });
						return;
					}
					if (plan.action === "toggle-operation") {
						const id = plan.paneId || "";
						applyThreadTileOperationModeTogglePlan(threadTileStatePolicy.operationModeTogglePlan({
							enabled: state.threadTileMode,
							threadId: id,
							mode: state.threadTileOperationModesById.get(id) || "compact"
						}));
					}
				});
				conversation.addEventListener("scroll", (event) => {
					const plan = threadTileActionsApi.resolveThreadTileScrollAction({
						target: event.target,
						root: conversation
					});
					if (plan.action === "pane-scroll") updateThreadTileBottomButtonForBody(plan.body);
				}, {
					passive: true,
					capture: true
				});
				conversation.addEventListener("dragstart", (event) => {
					const plan = threadTileActionsApi.resolveThreadTileDragStartAction({
						target: event.target,
						root: conversation
					});
					if (plan.action !== "drag-start") return;
					const id = plan.paneId || "";
					if (!id) return;
					state.threadTileDraggingThreadId = id;
					state.threadTileSwitchMenuPaneId = "";
					if (event.dataTransfer) {
						event.dataTransfer.effectAllowed = "move";
						event.dataTransfer.setData("text/plain", id);
					}
					const pane = plan.pane;
					if (pane) pane.classList.add("dragging");
				});
				conversation.addEventListener("dragover", (event) => {
					const plan = threadTileActionsApi.resolveThreadTileDragOverAction({
						target: event.target,
						root: conversation,
						draggingId: state.threadTileDraggingThreadId || ""
					});
					if (plan.action !== "drag-over") return;
					if (plan.preventDefault) event.preventDefault();
					if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
					plan.pane.classList.add("drag-over");
				});
				conversation.addEventListener("dragleave", (event) => {
					const plan = threadTileActionsApi.resolveThreadTileDragLeaveAction({
						target: event.target,
						root: conversation
					});
					if (plan.action === "drag-leave") plan.pane.classList.remove("drag-over");
				});
				conversation.addEventListener("drop", (event) => {
					const plan = threadTileActionsApi.resolveThreadTileDropAction({
						target: event.target,
						root: conversation,
						draggingId: state.threadTileDraggingThreadId || "",
						transferId: event.dataTransfer && event.dataTransfer.getData("text/plain") || ""
					});
					if (plan.action !== "drop-pane") return;
					if (plan.preventDefault) event.preventDefault();
					if (plan.stopPropagation) event.stopPropagation();
					document.querySelectorAll(".thread-tile-pane.drag-over, .thread-tile-pane.dragging").forEach((entry) => entry.classList.remove("drag-over", "dragging"));
					state.threadTileDraggingThreadId = "";
					dropThreadTilePane(plan.draggingId, plan.targetId, event);
				});
				conversation.addEventListener("dragend", () => {
					state.threadTileDraggingThreadId = "";
					document.querySelectorAll(".thread-tile-pane.drag-over, .thread-tile-pane.dragging").forEach((entry) => entry.classList.remove("drag-over", "dragging"));
				});
			}
			function threadTileLayoutStatusText(layout) {
				if (!state.threadTileMode) return "当前视口：单线程";
				if (layout && layout.enabled) {
					const count = effectiveThreadTilePaneCount(layout);
					const maxCount = threadTileMaximumPaneCount(layout);
					return maxCount > 1 ? `当前视口：平铺 ${count}/${maxCount} 窗` : "当前视口：平铺可用";
				}
				const reason = String(layout && layout.reason || "");
				if (reason === "tablet-portrait") return "当前视口：竖屏单线程";
				if (reason === "insufficient-width" || reason === "narrow") return "当前视口：宽度不足";
				if (reason === "disabled") return "当前视口：单线程";
				return "当前视口：暂不可平铺";
			}
			function syncThreadTileToggle() {
				const layout = threadTileLayout({ enabled: true });
				document.querySelectorAll("[data-thread-display-choice]").forEach((button) => {
					const isTile = (button.getAttribute("data-thread-display-choice") || "single") === "tile";
					const isSelected = isTile ? state.threadTileMode : !state.threadTileMode;
					button.classList.toggle("selected", isSelected);
					button.setAttribute("aria-pressed", isSelected ? "true" : "false");
					if (isTile && !layout.enabled && !state.threadTileMode) button.setAttribute("title", "平铺会在 iPad 横屏或宽屏可用时生效");
					else button.removeAttribute("title");
				});
				const status = $("threadDisplaySettingsStatus");
				if (status) status.textContent = threadTileLayoutStatusText(layout);
			}
			function setThreadTileMode(enabled) {
				state.threadTileMode = enabled === true;
				mirrorThreadDisplayModeToLocalStorage();
				if (!state.threadTileMode) {
					abortThreadTileLoads();
					state.threadTileSelectedThreadId = "";
					setThreadTileConversationMode(false);
				}
				scheduleThreadDisplaySettingsSave();
				syncThreadTileToggle();
				renderCurrentThread({ stickToBottom: true });
			}
			function handleThreadTileModeChoice(event) {
				const button = event.target.closest("[data-thread-display-choice]");
				if (!button) return;
				event.preventDefault();
				setThreadTileMode(button.getAttribute("data-thread-display-choice") === "tile");
			}
			return {
				updateThreadTileGlobalHeader,
				viewportPixelSize,
				isCoarsePointerViewport,
				isThreadTileKeyboardFocusActive,
				threadTileViewportSize,
				threadTileVerticalChromePx,
				threadTileLayout,
				normalizeThreadTilePaneCount,
				threadTileLayoutCapacity,
				defaultThreadTileCandidateIds,
				threadTileRunningPaneIds,
				threadTilePaneCountState,
				autoThreadTilePaneCount,
				effectiveThreadTilePaneCount,
				threadTileDisplayLayout,
				normalizeThreadTilePinnedIds,
				normalizeThreadTileSplitPairs,
				threadTilePrunedSplitPairs,
				threadTileVisibleIdSet,
				threadTileIdsEqual,
				threadTileCandidateIds,
				threadDisplaySettingsPayload,
				localThreadDisplayMode,
				mirrorThreadDisplayModeToLocalStorage,
				applyThreadDisplaySettings,
				loadThreadDisplaySettings,
				saveThreadDisplaySettingsNow,
				scheduleThreadDisplaySettingsSave,
				syncThreadTileActivePaneState,
				threadTileSummary,
				threadTileDisplayThread,
				setThreadTileSelectedThread,
				applyThreadTileSelectedPaneEffects,
				threadTileVisibleThreadOptions,
				renderThreadTileSwitchMenu,
				applyThreadTilePaneSlotEffects,
				replaceThreadTilePaneThread,
				moveThreadTilePaneRelative,
				splitThreadTilePaneWithTarget,
				dropThreadTilePane,
				replaceLastThreadTilePaneForThreadListOpen,
				toggleThreadTileSwitchMenu,
				threadTileHasLiveThread,
				updateThreadTilePaneStatusBadges,
				threadTileError,
				threadTilePaneIsVisible,
				setThreadTileConversationMode,
				captureThreadTilePaneScrollState,
				captureThreadTilePaneElementScrollState,
				scrollThreadTilePaneBodyToBottom,
				isThreadTilePaneNearBottom,
				applyThreadTilePaneScrollHoldPlan,
				rememberThreadTilePaneScrollPosition,
				updateThreadTileBottomButtonForBody,
				updateThreadTileBottomButtons,
				restoreThreadTilePaneScrollState,
				restoreThreadTilePaneElementScrollState,
				scrollThreadTilePaneToBottom,
				clearThreadTileRefreshTimer,
				clearThreadTileDetailLoadQueueTimer,
				scheduleThreadTileDetailLoadQueueDrain,
				scheduleThreadTileRefresh,
				refreshThreadTileDetails,
				abortThreadTileLoads,
				loadThreadTileDetail,
				applyThreadTileDetailLoadStartEffects,
				applyThreadTileDetailLoadSuccessEffects,
				applyThreadTileDetailLoadErrorEffects,
				applyThreadTileDetailLoadFinallyEffects,
				applyThreadTileDetailLoadQueuePlan,
				ensureThreadTileDetails,
				renderThreadTileTurn,
				scheduleThreadTileOperationMinimumRefresh,
				rememberThreadTileOperationBubble,
				clearThreadTileOperationBubble,
				renderThreadTileOperationDock,
				threadTileOperationSignature,
				applyThreadTileOperationModeTogglePlan,
				threadTileMinimumPaneCount,
				threadTileMaximumPaneCount,
				setThreadTilePaneCount,
				changeThreadTilePaneCount,
				closeThreadTilePane,
				renderThreadTilePane,
				threadTilePaneElement,
				threadTileRenderSignature,
				patchThreadTilePane,
				isThreadTileConversationSurface,
				threadDetailDomPatchSurface,
				canPatchSingleThreadConversationDom,
				patchCurrentThreadTilePaneFromState,
				scheduleRenderThreadTilePane,
				renderThreadTileLayout,
				bindThreadTileActions,
				threadTileLayoutStatusText,
				syncThreadTileToggle,
				setThreadTileMode,
				handleThreadTileModeChoice
			};
		}
		const api = { createThreadTileRuntime };
		if (typeof module === "object" && module.exports) module.exports = api;
		root.CodexThreadTileRuntime = api;
	})(typeof globalThis !== "undefined" ? globalThis : window);
}));
//#endregion
//#region public/app-update-runtime.js
var require_app_update_runtime = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function attachAppUpdateRuntime(root) {
		function createAppUpdateRuntime(deps = {}) {
			const { state = {}, CLIENT_BUILD_ID = "", PAGE_REFRESH_CHECK_INTERVAL_MS = 6e4, PAGE_REFRESH_MIN_CHECK_INTERVAL_MS = 12e3, PAGE_SHELL_ASSETS = [], STORAGE_PUBLIC_PR_PROMPT = "codexMobilePublicPrPromptKey", PUBLIC_PR_REVIEW_THREAD_TITLE = "Codex Mobile Public PR", buildRefreshPolicy = null, $ = () => null, api = async () => ({}), escapeHtml = (value) => String(value == null ? "" : value), normalizeFsPath = (value) => String(value || ""), threadMatchesWorkspaceCwd = () => false, loadThreads = async () => {}, loadThread = async () => {}, setComposerText = () => {}, scheduleCurrentDraftSave = () => {}, updateComposerControls = () => {}, composerHasContent = () => false, requestAppAlert = async () => {}, requestAppConfirmation = async () => false, loadWorkspaces = async () => {}, postClientEvent = () => {}, saveCurrentDraftNow = () => {}, syncSidebarWorkspaceSelect = () => {}, updateWorkspacePath = () => {}, renderWorkspaceTokenUsage = () => {}, isMenuOverlayMode = () => false, closeSidebarMenu = () => {}, clearCurrentThreadSelection = () => {}, restoreDraftForCurrentTarget = () => {}, renderThreads = () => {}, renderCurrentThread = () => {}, showError = () => {}, isRunningStatus = () => false, visibleThreads = (threads) => Array.isArray(threads) ? threads : [], threadById = () => null, shortPath = (value) => String(value || ""), statusText = (status) => String(status && status.type || status || ""), saveRestartAutoRecoverThreads = () => {}, postPerformanceEvent = () => {}, roundedDurationMs = (startedAt) => Math.max(0, Date.now() - Number(startedAt || Date.now())), isHermesEmbedMode = () => false, requestHermesPluginRefresh = () => {}, rememberRateLimitsFromConfig = () => {}, rememberCodexProfiles = () => {}, renderCodexProfileSettings = () => {}, stopCodexProfileSwitchProgressPolling = () => {}, publishPluginNavigationState = () => {} } = deps;
			function appVersionText(status = state.appUpdateStatus) {
				const version = String(status && status.version || state.appVersion || "").trim();
				const client = clientBuildVersionText();
				return version ? `v${version} · ${client}` : client;
			}
			function clientBuildVersionText(buildId = CLIENT_BUILD_ID) {
				const text = String(buildId || "").trim();
				const match = text.match(/\bcodex-mobile-shell-v([0-9]+)\b/);
				if (match) return `客户端 v${match[1]}`;
				return text ? `客户端 ${text}` : "客户端未知";
			}
			function renderAppUpdateStatus() {
				const el = $("appUpdateStatus");
				if (!el) return;
				const status = state.appUpdateStatus || {};
				const supported = status.supported !== false;
				const checking = state.appUpdateBusy && !state.appUpdateRestarting;
				const applying = Boolean(status.applying) || state.appUpdateRestarting;
				const blocked = Boolean(status.updateAvailable && !status.canFastForward);
				let label = appVersionText(status);
				let title = `Check for GitHub updates；当前客户端 ${CLIENT_BUILD_ID}`;
				if (state.appUpdateRestarting) {
					label = "等待重启…";
					title = "更新已应用。服务会退出并等待启动任务或守护脚本拉起；手动启动的部署需要在服务停止后手动重启。";
				} else if (applying) {
					label = "更新中…";
					title = "正在拉取更新";
				} else if (checking) {
					label = "检查更新…";
					title = "正在检查 GitHub 更新";
				} else if (status.updateAvailable && status.canFastForward) {
					label = `有更新 ${status.remoteShort || ""}`.trim();
					title = `发现 ${status.remote || "origin"}/${status.branch || "main"} 更新，点击后确认拉取；更新后服务会退出并依赖启动任务或守护脚本重启`;
				} else if (blocked) {
					label = "更新受阻";
					title = status.reason || status.error || "检测到更新，但当前工作区不能安全 fast-forward";
				} else if (status.error) {
					label = "更新检查失败";
					title = status.error;
				} else if (!supported) title = status.reason || "当前安装方式不支持 Git 自动更新";
				else if (status.localShort) title = `${appVersionText(status)} (${status.localShort})，点击重新检查更新；当前客户端 ${CLIENT_BUILD_ID}`;
				el.textContent = label;
				el.title = title;
				el.classList.toggle("hidden", !state.appVersion && !state.appUpdateStatus);
				el.classList.toggle("available", Boolean(status.updateAvailable && status.canFastForward));
				el.classList.toggle("blocked", blocked || Boolean(status.error));
				el.classList.toggle("checking", checking || applying);
				el.disabled = state.appUpdateBusy || state.appUpdateRestarting;
			}
			async function refreshAppUpdateStatus(options = {}) {
				if (!state.key) return null;
				if (state.appUpdateBusy && !options.force) return state.appUpdateStatus;
				state.appUpdateBusy = true;
				if (!options.silent) renderAppUpdateStatus();
				try {
					const params = new URLSearchParams();
					if (options.fetch) params.set("fetch", "1");
					if (options.force) params.set("force", "1");
					const status = await api(`/api/app-update/status${params.toString() ? `?${params.toString()}` : ""}`, { timeoutMs: options.fetch ? 25e3 : 12e3 });
					state.appUpdateStatus = status;
					state.appUpdateError = status && status.error ? status.error : "";
					return status;
				} catch (err) {
					state.appUpdateError = err.message || String(err);
					state.appUpdateStatus = Object.assign({}, state.appUpdateStatus || {}, {
						version: state.appVersion,
						error: state.appUpdateError
					});
					return state.appUpdateStatus;
				} finally {
					state.appUpdateBusy = false;
					renderAppUpdateStatus();
					renderUpdatePanel();
				}
			}
			function currentUpdateUsesPublicRelease(status = state.appUpdateStatus) {
				const remoteUrl = String(status && status.remoteUrl || "").toLowerCase();
				const repository = String(state.publicReleaseRepository || state.publicPrRepository || "").toLowerCase();
				if (!remoteUrl || !repository) return false;
				return remoteUrl.includes(`github.com/${repository}`) || remoteUrl.endsWith(`/${repository}.git`) || remoteUrl.endsWith(`/${repository}`);
			}
			function updateStatusLine(status) {
				if (!status) return "Not checked";
				if (state.appUpdateRestarting || status.restartScheduled) return "Restart pending";
				if (state.appUpdateBusy || status.checking) return "Checking";
				if (status.applying) return "Updating";
				if (status.error) return `Error: ${status.error}`;
				if (status.supported === false) return status.reason || "Not supported";
				if (status.updateAvailable && status.canFastForward) return `Update available: ${status.remoteShort || status.remoteCommit || ""}`.trim();
				if (status.updateAvailable) return `Update blocked: ${status.reason || "cannot fast-forward"}`;
				return "Up to date";
			}
			function publicReleaseStatusLine(status) {
				if (!state.publicReleaseEnabled) return "Public release check disabled";
				if (!status) return "Not checked";
				if (state.publicReleaseBusy || status.checking) return "Checking";
				if (status.error) return `Error: ${status.error}`;
				if (status.supported === false) return status.reason || "Not supported";
				if (status.updateAvailable) return `Public latest: ${status.publicShort || ""}`.trim();
				return "Matches Public latest";
			}
			function updateActionButton(action, label, options = {}) {
				const classes = ["update-action-button"];
				if (options.primary) classes.push("primary");
				return `<button type="button" class="${escapeHtml(classes.join(" "))}" data-update-action="${escapeHtml(action)}" ${options.disabled ? "disabled" : ""}>${escapeHtml(label)}</button>`;
			}
			function publicPrHasOpenPullRequests(status) {
				return Boolean(status && status.hasOpenPullRequests);
			}
			function renderUpdatePanel() {
				const dialog = $("updateDialog");
				const content = $("updatePanelContent");
				if (!dialog || !content) return;
				dialog.classList.toggle("hidden", !state.updatePanelOpen);
				if (!state.updatePanelOpen) return;
				const current = state.appUpdateStatus || {};
				const release = state.publicReleaseStatus || {};
				const publicCheckout = currentUpdateUsesPublicRelease(current) || Boolean(release.currentCheckoutUsesPublicRelease);
				const canApplyCurrent = Boolean(current.updateAvailable && current.canFastForward && !state.appUpdateBusy && !state.appUpdateRestarting);
				const hasPublicPrs = publicPrHasOpenPullRequests(state.publicPrStatus);
				const publicPrActionLabel = state.publicPrBusy ? "Checking PR..." : hasPublicPrs ? "Review Public PR" : "Check PR";
				const currentButtons = [updateActionButton("refresh-current", state.appUpdateBusy ? "Checking..." : "Check current", { disabled: state.appUpdateBusy }), updateActionButton("apply-current", publicCheckout ? "Update from Public" : "Apply current update", {
					primary: canApplyCurrent,
					disabled: !canApplyCurrent
				})].join("");
				const publicButtons = [updateActionButton("refresh-public", state.publicReleaseBusy ? "Checking..." : "Check Public", { disabled: state.publicReleaseBusy || !state.publicReleaseEnabled }), updateActionButton("public-pr", publicPrActionLabel, {
					disabled: state.publicPrBusy || !state.publicPrEnabled,
					primary: hasPublicPrs
				})].join("");
				content.innerHTML = `
      <section class="update-card">
        <div class="update-card-title">Current checkout</div>
        <div class="update-row">
          <strong>${escapeHtml(updateStatusLine(current))}</strong>
          <span class="update-row-meta">${escapeHtml(current.remote || "origin")}/${escapeHtml(current.branch || "main")} ${escapeHtml(current.localShort || "")}${current.remoteShort ? ` -> ${escapeHtml(current.remoteShort)}` : ""}</span>
          <span class="update-row-detail">${escapeHtml(current.reason || current.remoteUrl || "Checks the Git remote configured for this running checkout.")}</span>
        </div>
        <div class="update-actions">${currentButtons}</div>
      </section>
      <section class="update-card">
        <div class="update-card-title">Public release</div>
        <div class="update-row">
          <strong>${escapeHtml(publicReleaseStatusLine(release))}</strong>
          <span class="update-row-meta">${escapeHtml(release.repository || state.publicReleaseRepository || "")}/${escapeHtml(release.branch || state.publicReleaseBranch || "main")} ${escapeHtml(release.publicShort || "")}</span>
          <span class="update-row-detail">${escapeHtml(publicCheckout ? "This checkout tracks Public, so the current update button applies Public fast-forward updates." : "This checkout does not track Public; Public latest is shown for reference here.")}</span>
        </div>
        <div class="update-actions">${publicButtons}</div>
      </section>`;
			}
			async function refreshPublicReleaseStatus(options = {}) {
				if (!state.key || !state.publicReleaseEnabled) return null;
				if (state.publicReleaseBusy && !options.force) return state.publicReleaseStatus;
				state.publicReleaseBusy = true;
				renderUpdatePanel();
				try {
					const params = new URLSearchParams();
					if (options.force) params.set("force", "1");
					const status = await api(`/api/public-release/status${params.toString() ? `?${params.toString()}` : ""}`, { timeoutMs: 18e3 });
					state.publicReleaseStatus = status;
					return status;
				} catch (err) {
					state.publicReleaseStatus = Object.assign({}, state.publicReleaseStatus || {}, {
						enabled: state.publicReleaseEnabled,
						repository: state.publicReleaseRepository,
						branch: state.publicReleaseBranch,
						error: err.message || String(err)
					});
					return state.publicReleaseStatus;
				} finally {
					state.publicReleaseBusy = false;
					renderUpdatePanel();
				}
			}
			function openUpdatePanel() {
				state.updatePanelOpen = true;
				renderUpdatePanel();
				publishPluginNavigationState({ force: true });
				refreshAppUpdateStatus({
					fetch: true,
					force: true,
					silent: true
				}).then(renderUpdatePanel).catch(() => renderUpdatePanel());
				refreshPublicReleaseStatus({ force: true }).catch(() => renderUpdatePanel());
			}
			function closeUpdatePanel() {
				state.updatePanelOpen = false;
				renderUpdatePanel();
				publishPluginNavigationState({ force: true });
			}
			function handleUpdatePanelClick(event) {
				const button = event.target && event.target.closest("[data-update-action]");
				if (!button) return;
				const action = button.dataset.updateAction;
				if (action === "refresh-current") refreshAppUpdateStatus({
					fetch: true,
					force: true,
					silent: true
				}).then(renderUpdatePanel).catch(showError);
				else if (action === "apply-current") handleAppUpdateClick().then(renderUpdatePanel).catch(showError);
				else if (action === "refresh-public") refreshPublicReleaseStatus({ force: true }).catch(showError);
				else if (action === "public-pr") handlePublicPrStatusClick().catch(showError);
			}
			function scheduleStartupUpdateCheck() {
				if (!state.key) return;
				window.setTimeout(() => {
					refreshAppUpdateStatus({
						fetch: true,
						force: true,
						silent: true
					}).catch(() => {});
				}, 900);
			}
			function publicPrPromptKey(status) {
				if (!publicPrHasOpenPullRequests(status)) return "";
				const pullRequests = Array.isArray(status.pullRequests) ? status.pullRequests : [];
				const marker = pullRequests.map((pr) => `#${pr.number || ""}:${pr.updatedAt || ""}`).filter(Boolean).join("|");
				return `${status.repository || ""}|${status.openPullRequestCount || pullRequests.length}|${marker}`;
			}
			function publicPrSummaryText(status) {
				const pullRequests = Array.isArray(status && status.pullRequests) ? status.pullRequests : [];
				if (!pullRequests.length) return "";
				return pullRequests.map((pr) => `#${pr.number} ${pr.title || ""}`.trim()).join("; ");
			}
			function normalizedPublicPrReviewTitle(value) {
				return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
			}
			function publicPrReviewThreadTitle() {
				return PUBLIC_PR_REVIEW_THREAD_TITLE;
			}
			function findPublicPrReviewThread(workspacePath = "") {
				const titleKey = normalizedPublicPrReviewTitle(publicPrReviewThreadTitle());
				const workspace = String(workspacePath || "").trim();
				return state.threads.find((thread) => {
					if (!thread || !thread.id) return false;
					if (normalizedPublicPrReviewTitle(thread.name || thread.title || thread.preview || "") !== titleKey) return false;
					return !workspace || threadMatchesWorkspaceCwd(thread.cwd || "", workspace);
				}) || null;
			}
			function workspacePathBaseName(value) {
				const text = String(value || "").trim().replace(/[\\/]+$/, "");
				if (!text) return "";
				const parts = text.split(/[\\/]+/).filter(Boolean);
				return parts[parts.length - 1] || "";
			}
			function workspacePathIsVisible(value) {
				const key = normalizeFsPath(value);
				if (!key) return false;
				return (state.workspaces || []).some((workspace) => normalizeFsPath(workspace && workspace.cwd) === key);
			}
			function visibleWorkspaceWithBaseName(value) {
				const baseName = workspacePathBaseName(value).toLowerCase();
				if (!baseName) return "";
				const match = (state.workspaces || []).find((workspace) => workspace && workspace.cwd && workspacePathBaseName(workspace.cwd).toLowerCase() === baseName);
				return match ? String(match.cwd || "").trim() : "";
			}
			function publicPrReviewWorkspacePath() {
				const appWorkspace = String(state.appWorkspacePath || "").trim();
				if (workspacePathIsVisible(appWorkspace)) return appWorkspace;
				const sameNameWorkspace = visibleWorkspaceWithBaseName(appWorkspace);
				if (sameNameWorkspace) return sameNameWorkspace;
				const selectedWorkspace = String(state.selectedCwd || "").trim();
				if (workspacePathIsVisible(selectedWorkspace)) return selectedWorkspace;
				const currentWorkspace = String(state.currentThread && state.currentThread.cwd || "").trim();
				if (workspacePathIsVisible(currentWorkspace)) return currentWorkspace;
				return appWorkspace || selectedWorkspace || currentWorkspace;
			}
			async function openPublicPrReviewThreadIfAvailable(workspacePath, text) {
				let target = findPublicPrReviewThread(workspacePath);
				if (!target) {
					try {
						await loadThreads({ silent: true });
					} catch (err) {
						postClientEvent("public_pr_reuse_lookup_failed", { message: err.message || String(err) });
					}
					target = findPublicPrReviewThread(workspacePath);
				}
				if (!target || !target.id) return false;
				await loadThread(target.id, { source: "public-pr" });
				setComposerText(text);
				scheduleCurrentDraftSave();
				updateComposerControls();
				return true;
			}
			function renderPublicPrStatus() {
				const el = $("publicPrStatus");
				if (!el) return;
				const status = state.publicPrStatus || {};
				const enabled = state.publicPrEnabled && status.enabled !== false;
				const checking = state.publicPrBusy || Boolean(status.checking);
				const hasPrs = publicPrHasOpenPullRequests(status);
				const blocked = Boolean(status.error || status.supported === false);
				let label = "Public PR";
				let title = state.publicPrRepository ? `Check ${state.publicPrRepository} pull requests` : "Check public pull requests";
				if (checking) {
					label = "PR...";
					title = "Checking public pull requests";
				} else if (hasPrs) {
					label = `PR ${status.openPullRequestCount || (status.pullRequests || []).length}`;
					title = `Open public PRs: ${publicPrSummaryText(status) || label}`;
				} else if (status.checkedAt && enabled) {
					label = "No PR";
					title = `No open public PRs in ${status.repository || state.publicPrRepository || "public repo"}`;
				} else if (blocked) {
					label = "PR ?";
					title = status.error || status.reason || "Public PR check is unavailable";
				}
				el.textContent = label;
				el.title = title;
				el.classList.toggle("hidden", !checking && !hasPrs && !blocked);
				el.classList.toggle("available", hasPrs);
				el.classList.toggle("blocked", blocked);
				el.classList.toggle("checking", checking);
				el.disabled = state.publicPrBusy;
			}
			async function refreshPublicPrStatus(options = {}) {
				if (!state.key || !state.publicPrEnabled) return null;
				if (state.publicPrBusy && !options.force) return state.publicPrStatus;
				state.publicPrBusy = true;
				if (!options.silent) renderPublicPrStatus();
				try {
					const params = new URLSearchParams();
					if (options.force) params.set("force", "1");
					const status = await api(`/api/public-pull-requests/status${params.toString() ? `?${params.toString()}` : ""}`, { timeoutMs: 18e3 });
					state.publicPrStatus = status;
					state.publicPrError = status && status.error ? status.error : "";
					if (!options.skipPrompt) maybePromptPublicPrMerge(status);
					return status;
				} catch (err) {
					state.publicPrError = err.message || String(err);
					state.publicPrStatus = Object.assign({}, state.publicPrStatus || {}, {
						enabled: state.publicPrEnabled,
						repository: state.publicPrRepository,
						hasOpenPullRequests: false,
						openPullRequestCount: 0,
						pullRequests: [],
						error: state.publicPrError
					});
					return state.publicPrStatus;
				} finally {
					state.publicPrBusy = false;
					renderPublicPrStatus();
					renderUpdatePanel();
				}
			}
			function scheduleStartupPublicPrCheck() {
				if (!state.key || !state.publicPrEnabled) return;
				window.setTimeout(() => {
					refreshPublicPrStatus({
						force: true,
						silent: true
					}).catch(() => {});
				}, 1600);
			}
			function publicPrMergeInstruction(status) {
				const summary = publicPrSummaryText(status);
				return [
					`请检查 public 仓库 ${status && status.repository || state.publicPrRepository || "pentiumxp/codex-mobile-web-public"} 的开放 PR${summary ? `：${summary}` : ""}。`,
					"按当前项目规则先评估 PR 是否可合并；如要合并，更新 public README 的中文发布说明，运行验证和隐私扫描，再提交并推送 public。",
					"不要复制 .agent-context、runtime state、本地密钥、上传内容或机器特定诊断。完成 public 后再同步回 private 并重新验证。"
				].join("\n");
			}
			function publicPrMergeConfirmationMessage(status) {
				return [
					`检测到 public 仓库有 ${status.openPullRequestCount || (status.pullRequests || []).length} 个开放 PR。`,
					publicPrSummaryText(status),
					"",
					"是否准备一条合并/发布检查任务？"
				].filter(Boolean).join("\n");
			}
			async function preparePublicPrMergePrompt(status) {
				const text = publicPrMergeInstruction(status);
				if (composerHasContent()) {
					await requestAppAlert("检测到 public 开放 PR，但输入框已有内容。请处理当前草稿后点击 Public PR 按钮。", { title: "Public PR" });
					return;
				}
				if (!state.workspaces.length) await loadWorkspaces().catch((err) => {
					postClientEvent("public_pr_workspace_lookup_failed", { message: err.message || String(err) });
				});
				const workspacePath = publicPrReviewWorkspacePath();
				if (!workspacePath) {
					setComposerText(text);
					scheduleCurrentDraftSave();
					updateComposerControls();
					return;
				}
				saveCurrentDraftNow();
				state.selectedCwd = workspacePath;
				syncSidebarWorkspaceSelect();
				updateWorkspacePath();
				renderWorkspaceTokenUsage();
				if (await openPublicPrReviewThreadIfAvailable(workspacePath, text)) {
					if (isMenuOverlayMode()) closeSidebarMenu();
					return;
				}
				clearCurrentThreadSelection({ saveDraft: false });
				state.selectedCwd = workspacePath;
				state.newThreadDraft = true;
				state.newThreadTitle = publicPrReviewThreadTitle();
				state.sendButtonHint = "";
				restoreDraftForCurrentTarget();
				state.newThreadTitle = publicPrReviewThreadTitle();
				setComposerText(text);
				syncSidebarWorkspaceSelect();
				updateWorkspacePath();
				renderWorkspaceTokenUsage();
				renderThreads();
				renderCurrentThread();
				updateComposerControls();
				scheduleCurrentDraftSave();
				if (isMenuOverlayMode()) closeSidebarMenu();
			}
			function rememberPublicPrPrompt(status) {
				const key = publicPrPromptKey(status);
				if (!key) return;
				state.publicPrPromptedKey = key;
				localStorage.setItem(STORAGE_PUBLIC_PR_PROMPT, key);
			}
			function maybePromptPublicPrMerge(status) {
				if (!publicPrHasOpenPullRequests(status)) return;
				const key = publicPrPromptKey(status);
				if (!key || key === state.publicPrPromptedKey) return;
				rememberPublicPrPrompt(status);
				requestAppConfirmation(publicPrMergeConfirmationMessage(status), {
					title: "Public PR",
					confirmLabel: "准备任务",
					cancelLabel: "稍后"
				}).then((confirmed) => {
					if (confirmed) preparePublicPrMergePrompt(status).catch(showError);
				}).catch(showError);
			}
			async function handlePublicPrStatusClick() {
				if (state.publicPrBusy) return;
				const status = await refreshPublicPrStatus({
					force: true,
					skipPrompt: true
				});
				if (!status) return;
				if (status.error && !publicPrHasOpenPullRequests(status)) {
					await requestAppAlert(`public PR 检查失败：${status.error}`, { title: "Public PR" });
					return;
				}
				if (!publicPrHasOpenPullRequests(status)) {
					await requestAppAlert("当前未检测到 public 开放 PR。", { title: "Public PR" });
					return;
				}
				const confirmed = await requestAppConfirmation(publicPrMergeConfirmationMessage(status), {
					title: "Public PR",
					confirmLabel: "准备任务",
					cancelLabel: "稍后"
				});
				rememberPublicPrPrompt(status);
				if (confirmed) await preparePublicPrMergePrompt(status);
			}
			async function handleAppUpdateClick() {
				if (state.appUpdateBusy || state.appUpdateRestarting) return;
				let status = state.appUpdateStatus;
				if (!status || !status.updateAvailable && !status.error) status = await refreshAppUpdateStatus({
					fetch: true,
					force: true
				});
				if (!status) return;
				if (status.supported === false) {
					await requestAppAlert(`当前安装方式不支持自动更新：${status.reason || "没有可用的 Git 远程分支"}`, { title: "更新检查" });
					return;
				}
				if (status.error && !status.updateAvailable) {
					await requestAppAlert(`更新检查失败：${status.error}`, { title: "更新检查" });
					return;
				}
				if (!status.updateAvailable) {
					await requestAppAlert("当前已经是最新版本。", { title: "更新检查" });
					return;
				}
				if (!status.canFastForward) {
					await requestAppAlert(`检测到更新，但不能自动应用：${status.reason || status.error || "当前工作区不是干净的 fast-forward 状态"}`, { title: "更新检查" });
					return;
				}
				if (!await requestAppConfirmation([
					"发现 GitHub 更新。是否拉取并重启 Mobile Web？",
					"",
					"仅在当前仓库干净、可 fast-forward 时执行；运行时数据和 Access Key 不会被覆盖。",
					"更新完成后当前 Node 服务会退出。只有通过 Windows 启动任务、windowless supervisor 或 macOS shared launcher 运行时才会自动拉起；手动运行 node/npm start 的部署需要手动重启。"
				].join("\n"), {
					title: "应用更新",
					confirmLabel: "更新并重启",
					cancelLabel: "取消"
				})) return;
				state.appUpdateBusy = true;
				renderAppUpdateStatus();
				try {
					const result = await api("/api/app-update/apply", {
						method: "POST",
						body: "{}",
						timeoutMs: 15e4
					});
					state.appUpdateStatus = result.after || result.status || status;
					if (result.updated) {
						state.appUpdateRestarting = true;
						$("connectionState").textContent = "更新已应用；如连接断开且未自动恢复，请在部署机手动重启";
						renderAppUpdateStatus();
						window.setTimeout(() => window.location.reload(), Math.max(1800, Number(result.restartInMs || 1200) + 900));
					} else await requestAppAlert("当前已经是最新版本。", { title: "更新检查" });
				} catch (err) {
					state.appUpdateError = err.message || String(err);
					state.appUpdateStatus = Object.assign({}, status || {}, { error: state.appUpdateError });
					showError(err);
				} finally {
					state.appUpdateBusy = false;
					renderAppUpdateStatus();
					renderUpdatePanel();
				}
			}
			function renderSharedRestartButton() {
				const el = $("sharedRestartButton");
				if (!el) return;
				const restarting = state.sharedRestarting;
				el.textContent = restarting ? "Restarting" : "Restart";
				el.title = restarting ? "Mobile Web is restarting" : "Restart Mobile Web shared chain";
				el.disabled = state.sharedRestartBusy || restarting;
				el.classList.toggle("checking", state.sharedRestartBusy || restarting);
			}
			function renderHardRefreshButton() {
				const el = $("hardRefreshButton");
				if (!el) return;
				const reloading = state.pageRefreshReloading;
				el.textContent = reloading ? "刷新中" : "硬刷新";
				el.title = reloading ? "Refreshing the current PWA page shell" : "Fetch current page assets, update the service worker, and reload this PWA page";
				el.disabled = reloading;
				el.classList.toggle("checking", reloading);
			}
			function markBootReady() {
				const boot = window.codexMobileBoot;
				if (boot && typeof boot.ready === "function") boot.ready();
			}
			function reportShellLoaded(startedAt, details = {}) {
				if (state.shellLoadedReported) return;
				state.shellLoadedReported = true;
				postPerformanceEvent("shell_loaded", Object.assign({
					elapsedMs: roundedDurationMs(startedAt),
					buildId: CLIENT_BUILD_ID,
					hasThreadOpenIntent: Boolean(state.startupThreadOpenPending)
				}, details || {}), { force: true });
			}
			function sharedRestartScopeLines() {
				return state.serverPlatform === "darwin" ? ["这会短暂断开当前页面连接，并重启这台 Mac 上的 Mobile Web 服务。", "不会重启 Codex Desktop、shared mux 或其它本机服务。"] : ["这会短暂断开当前页面连接，并重启 Mobile Web、shared mux 和本地 app-server。", "不会重启 WSL、Codex Desktop 或其它本机服务。"];
			}
			function restartRiskThreads(threads) {
				const seen = /* @__PURE__ */ new Set();
				const result = [];
				for (const thread of threads || []) {
					const id = String(thread && thread.id || "");
					if (!id || seen.has(id) || !isRunningStatus(thread.status)) continue;
					seen.add(id);
					result.push(thread);
				}
				if (state.currentThreadId && state.activeTurnId && !seen.has(String(state.currentThreadId))) {
					const current = state.currentThread || threadById(state.currentThreadId) || {
						id: state.currentThreadId,
						name: "Current session",
						status: { type: "active" }
					};
					result.unshift(current);
				}
				return result;
			}
			async function fetchRestartRiskThreads() {
				const params = new URLSearchParams({
					limit: "200",
					archived: "false"
				});
				const result = await api(`/api/threads?${params}`, { timeoutMs: 45e3 });
				return restartRiskThreads(visibleThreads(result.data || []));
			}
			function restartRiskThreadTitle(thread) {
				return String(thread && (thread.name || thread.preview || thread.id) || "Untitled session").trim();
			}
			function restartRiskThreadMeta(thread) {
				const parts = [];
				const cwd = shortPath(thread && thread.cwd);
				if (cwd) parts.push(cwd);
				const status = statusText(thread && thread.status);
				if (status) parts.push(status);
				return parts.join(" | ");
			}
			function renderSharedRestartDialog() {
				const dialog = $("restartConfirmDialog");
				const subtitle = $("restartConfirmSubtitle");
				const content = $("restartConfirmContent");
				const proceed = $("restartConfirmProceed");
				if (!dialog || !content || !subtitle || !proceed) return;
				dialog.classList.toggle("hidden", !state.sharedRestartDialogOpen);
				if (!state.sharedRestartDialogOpen) {
					content.innerHTML = "";
					return;
				}
				const riskThreads = state.sharedRestartRiskThreads || [];
				const hasRisk = riskThreads.length > 0;
				subtitle.textContent = hasRisk ? `${riskThreads.length} running session${riskThreads.length === 1 ? "" : "s"} may be interrupted` : "No running sessions were found";
				proceed.textContent = hasRisk ? "仍然重启" : "Restart";
				proceed.classList.toggle("danger", hasRisk);
				const scopeHtml = (state.sharedRestartScopeLines || []).map((line) => `<div class="restart-confirm-line">${escapeHtml(line)}</div>`).join("");
				const riskHtml = hasRisk ? `<div class="restart-risk-block">
          <div class="restart-risk-title">Running sessions</div>
          <div class="restart-risk-list">
            ${riskThreads.slice(0, 6).map((thread) => {
					const meta = restartRiskThreadMeta(thread);
					return `<div class="restart-risk-item">
                <div class="restart-risk-item-title">${escapeHtml(restartRiskThreadTitle(thread))}</div>
                ${meta ? `<div class="restart-risk-item-meta">${escapeHtml(meta)}</div>` : ""}
              </div>`;
				}).join("")}
            ${riskThreads.length > 6 ? `<div class="restart-risk-more">另有 ${escapeHtml(String(riskThreads.length - 6))} 个 running session</div>` : ""}
          </div>
        </div>` : `<div class="restart-safe-block">当前没有检测到 running session。重启仍会短暂断开本页面连接。</div>`;
				content.innerHTML = `
      <div class="restart-confirm-message">
        ${hasRisk ? "重启可能会打断正在通过 Codex Mobile 同步或运行的 session。建议等它们结束后再重启。" : "确认重启 Codex Mobile Web？"}
      </div>
      ${riskHtml}
      <div class="restart-confirm-scope">${scopeHtml}</div>
    `;
			}
			function closeSharedRestartDialog(confirmed = false) {
				const resolve = state.sharedRestartConfirmResolve;
				state.sharedRestartDialogOpen = false;
				state.sharedRestartRiskThreads = [];
				state.sharedRestartScopeLines = [];
				state.sharedRestartConfirmResolve = null;
				renderSharedRestartDialog();
				if (resolve) resolve(Boolean(confirmed));
			}
			function requestSharedRestartConfirmation(riskThreads, scopeLines) {
				if (state.sharedRestartConfirmResolve) closeSharedRestartDialog(false);
				state.sharedRestartRiskThreads = riskThreads || [];
				state.sharedRestartScopeLines = scopeLines || [];
				state.sharedRestartDialogOpen = true;
				renderSharedRestartDialog();
				return new Promise((resolve) => {
					state.sharedRestartConfirmResolve = resolve;
				});
			}
			async function handleSharedRestartClick() {
				if (state.sharedRestartBusy || state.sharedRestarting) return;
				state.sharedRestartBusy = true;
				renderSharedRestartButton();
				try {
					const riskThreads = await fetchRestartRiskThreads();
					if (!await requestSharedRestartConfirmation(riskThreads, sharedRestartScopeLines())) return;
					saveRestartAutoRecoverThreads(riskThreads);
					state.appServerWasUnavailable = true;
					await api("/api/restart/shared-chain", {
						method: "POST",
						body: "{}",
						timeoutMs: 12e3
					});
					state.sharedRestarting = true;
					state.sharedRestartBusy = false;
					showReconnectRefreshPrompt("restart");
					const connection = $("connectionState");
					if (connection) connection.textContent = "Restarting";
					renderSharedRestartButton();
				} catch (err) {
					showError(err);
				} finally {
					if (!state.sharedRestarting) {
						state.sharedRestartBusy = false;
						renderSharedRestartButton();
					}
				}
			}
			function serverBuildIdFromConfig(config) {
				return String(config && (config.clientBuildId || config.shellCacheName || config.buildId) || "").trim();
			}
			function shouldPromptForServerBuildChange(serverBuildId, clientBuildId) {
				if (buildRefreshPolicy && typeof buildRefreshPolicy.shouldPromptForServerBuildChange === "function") return buildRefreshPolicy.shouldPromptForServerBuildChange(serverBuildId, clientBuildId);
				return Boolean(serverBuildId && clientBuildId && serverBuildId !== clientBuildId);
			}
			function pageShellAssetUrl(asset, buildId) {
				const url = new URL(asset, window.location.origin);
				url.searchParams.set("shellBuild", buildId || "current");
				url.searchParams.set("shellCheck", String(Date.now()));
				return url.href;
			}
			function validatePageShellAsset(asset, text, config) {
				const buildId = serverBuildIdFromConfig(config);
				const shellCacheName = String(config && config.shellCacheName || "").trim();
				if (asset === "/" || asset === "/index.html") return text.includes("href=\"/styles.css\"") && text.includes("src=\"/app.js\"");
				if (asset === "/styles.css") return text.includes(".app") && text.includes(".composer");
				if (asset === "/app.js") return !buildId || text.includes(buildId) || text.includes(shellCacheName);
				if (asset === "/sw.js") return text.includes("shell-asset-manifest.js");
				return true;
			}
			async function fetchPageShellAsset(asset, config) {
				const response = await fetch(pageShellAssetUrl(asset, serverBuildIdFromConfig(config)), {
					cache: "no-store",
					credentials: "same-origin"
				});
				if (!response.ok) throw new Error(`page shell asset unavailable: ${asset}`);
				if (asset === "/" || asset.endsWith(".html") || asset.endsWith(".css") || asset.endsWith(".js") || asset.endsWith(".json") || asset.endsWith(".svg")) {
					if (!validatePageShellAsset(asset, await response.clone().text(), config)) throw new Error(`page shell asset stale: ${asset}`);
				}
				return response;
			}
			async function preparePageShellAssets(config, options = {}) {
				const populateCache = Boolean(options.populateCache);
				const shellCacheName = String(config && config.shellCacheName || "").trim();
				const cache = populateCache && shellCacheName && "caches" in window ? await window.caches.open(shellCacheName) : null;
				for (const asset of PAGE_SHELL_ASSETS) {
					const response = await fetchPageShellAsset(asset, config);
					if (cache) await cache.put(asset, response.clone());
				}
			}
			async function fetchPageBuildConfig() {
				const response = await fetch(`/api/public-config?buildCheck=${Date.now()}`, {
					cache: "no-store",
					credentials: "same-origin"
				});
				if (!response.ok) return null;
				return response.json();
			}
			async function pruneOldShellCaches(expectedCacheName) {
				if (!expectedCacheName || !("caches" in window)) return;
				const keys = await window.caches.keys();
				await Promise.all(keys.filter((key) => String(key || "").startsWith("codex-mobile-shell-") && key !== expectedCacheName).map((key) => window.caches.delete(key)));
			}
			async function clearAllShellCaches() {
				if (!("caches" in window)) return;
				const keys = await window.caches.keys();
				await Promise.all(keys.filter((key) => String(key || "").startsWith("codex-mobile-shell-")).map((key) => window.caches.delete(key)));
			}
			async function resetPageShellServiceWorker() {
				if (!("serviceWorker" in navigator)) return null;
				const registrations = await navigator.serviceWorker.getRegistrations();
				await Promise.all(registrations.map((registration) => registration.unregister().catch(() => false)));
				state.serviceWorkerRegistration = null;
				const registration = await navigator.serviceWorker.register("/sw.js");
				if (registration && registration.update) await registration.update().catch(() => {});
				state.serviceWorkerRegistration = registration || null;
				return registration || null;
			}
			function pageReloadUrlWithBust() {
				const url = new URL(window.location.href, window.location.origin);
				url.searchParams.set("shellReload", String(Date.now()));
				return url.href;
			}
			function initializePageBuildState(config) {
				state.serverBuildId = CLIENT_BUILD_ID || serverBuildIdFromConfig(config);
				state.serverAssetBuildId = String(config && config.buildId || "").trim();
				const currentServerBuildId = serverBuildIdFromConfig(config);
				if (shouldPromptForServerBuildChange(currentServerBuildId, state.serverBuildId)) {
					state.pageRefreshBuildId = currentServerBuildId;
					state.pageRefreshReason = "build";
					state.pageRefreshAvailable = true;
					state.pageRefreshPreparedConfig = config || null;
					if (isHermesEmbedMode()) {
						requestHermesPluginRefresh("server_build_changed", { force: true });
						return;
					}
				}
				renderPageRefreshPrompt();
			}
			function renderPageRefreshPrompt() {
				const el = $("pageRefreshPrompt");
				if (!el) return;
				const restarting = state.pageRefreshReason === "restart";
				const reconnecting = state.pageRefreshReason === "reconnect" || restarting;
				el.classList.toggle("hidden", !state.pageRefreshAvailable && !state.pageRefreshReloading);
				el.disabled = state.pageRefreshReloading;
				if (state.pageRefreshReloading) el.textContent = restarting ? "Waiting for service, then refreshing..." : reconnecting ? "Refreshing and reconnecting..." : "Refreshing page...";
				else el.textContent = restarting ? "Service restarted. Tap to refresh." : reconnecting ? "Connection changed. Tap to refresh." : "New version available. Tap to refresh.";
				el.title = restarting || reconnecting ? "Manual refresh only; the page will not reload until this button is tapped." : state.pageRefreshBuildId ? `Server version is ${state.pageRefreshBuildId}. Tap to refresh manually.` : "Server page assets changed. Tap to refresh manually.";
				renderHardRefreshButton();
			}
			async function handleHardRefreshClick() {
				if (state.pageRefreshReloading) return;
				state.pageRefreshPreparedConfig = null;
				state.pageRefreshReason = "build";
				state.pageRefreshAvailable = true;
				await refreshPageForNewBuild();
			}
			function showReconnectRefreshPrompt(reason = "reconnect") {
				if (state.pageRefreshReloading) return;
				if (isHermesEmbedMode() && reason !== "restart") return;
				state.pageRefreshAvailable = true;
				state.pageRefreshReason = reason === "restart" ? "restart" : "reconnect";
				state.pageRefreshPreparedConfig = null;
				renderPageRefreshPrompt();
			}
			function codexProfileHasQuotaSnapshot(profile) {
				const quota = profile && typeof profile === "object" ? profile.quota : null;
				if (!quota || typeof quota !== "object") return false;
				if (quota.rateLimits && typeof quota.rateLimits === "object") return true;
				const byModel = quota.rateLimitsByModel;
				return Boolean(byModel && typeof byModel === "object" && Object.keys(byModel).length);
			}
			function codexProfileRestartReadyForCompletion() {
				const targetId = String(state.codexProfileSwitchTargetId || "");
				if (!state.codexProfileRestarting || !targetId) return true;
				if (!state.activeCodexProfileId || targetId !== state.activeCodexProfileId) return false;
				const activeProfile = (Array.isArray(state.codexProfiles) ? state.codexProfiles : []).find((profile) => String(profile && profile.id || "") === targetId);
				if (!activeProfile || !codexProfileHasQuotaSnapshot(activeProfile)) {
					state.codexProfileSwitchStage = "服务已恢复，正在等待目标账号额度刷新...";
					const connection = $("connectionState");
					if (connection) connection.textContent = state.codexProfileSwitchStage;
					renderCodexProfileSettings();
					return false;
				}
				return true;
			}
			function finishRestartingUiIfReady() {
				if (!codexProfileRestartReadyForCompletion()) return false;
				const changed = Boolean(state.codexProfileRestarting || state.sharedRestarting || state.codexProfileSwitchTargetId || state.codexProfileSwitchStage);
				stopCodexProfileSwitchProgressPolling();
				state.codexProfileRestarting = false;
				state.codexProfileSwitchTargetId = "";
				state.codexProfileSwitchStage = "";
				state.codexProfileSwitchRequestId = "";
				state.sharedRestarting = false;
				state.sharedRestartBusy = false;
				if (changed) {
					renderCodexProfileSettings();
					renderSharedRestartButton();
				}
				return changed;
			}
			function clearReconnectRefreshPrompt() {
				if (!(state.pageRefreshReason === "reconnect" || state.pageRefreshReason === "restart") || state.pageRefreshReloading) return;
				state.pageRefreshAvailable = false;
				state.pageRefreshReason = "";
				state.pageRefreshPreparedConfig = null;
				finishRestartingUiIfReady();
				renderPageRefreshPrompt();
			}
			async function checkPageRefreshAvailability(options = {}) {
				if (state.pageRefreshReloading) return;
				const now = Date.now();
				if (state.pageRefreshBusy) return;
				if (!options.force && now - state.pageRefreshLastCheckAt < PAGE_REFRESH_MIN_CHECK_INTERVAL_MS) return;
				state.pageRefreshBusy = true;
				state.pageRefreshLastCheckAt = now;
				try {
					const config = await fetchPageBuildConfig();
					if (!config) return;
					const nextBuildId = serverBuildIdFromConfig(config);
					const nextAssetBuildId = String(config && config.buildId || "").trim();
					if (!state.serverBuildId) {
						state.serverBuildId = CLIENT_BUILD_ID || nextBuildId;
						state.serverAssetBuildId = nextAssetBuildId;
						return;
					}
					const serverBuildNeedsRefresh = Boolean(nextBuildId && nextBuildId !== state.serverBuildId) && shouldPromptForServerBuildChange(nextBuildId, state.serverBuildId);
					if (Boolean(nextAssetBuildId && state.serverAssetBuildId && nextAssetBuildId !== state.serverAssetBuildId) && !serverBuildNeedsRefresh) {
						state.serverAssetBuildId = nextAssetBuildId;
						return;
					}
					if (serverBuildNeedsRefresh) {
						if (isHermesEmbedMode()) {
							state.pageRefreshBuildId = nextBuildId;
							state.pageRefreshPreparedConfig = config;
							requestHermesPluginRefresh("server_build_changed");
							return;
						}
						state.pageRefreshAvailable = true;
						state.pageRefreshReason = "build";
						state.pageRefreshBuildId = nextBuildId;
						state.pageRefreshPreparedConfig = config;
						renderPageRefreshPrompt();
					}
				} catch (_) {} finally {
					state.pageRefreshBusy = false;
				}
			}
			function schedulePageRefreshCheck(delayMs = 0, options = {}) {
				window.setTimeout(() => {
					checkPageRefreshAvailability(options).catch(() => {});
				}, Math.max(0, Number(delayMs || 0)));
			}
			function scheduleVisiblePageRefreshCheck(delayMs = 0, options = {}) {
				if (document.visibilityState === "hidden") return;
				schedulePageRefreshCheck(delayMs, options);
			}
			function startPageRefreshChecks() {
				if (state.pageRefreshTimer) clearInterval(state.pageRefreshTimer);
				state.pageRefreshTimer = window.setInterval(() => {
					if (document.visibilityState === "hidden") return;
					checkPageRefreshAvailability({ silent: true }).catch(() => {});
				}, PAGE_REFRESH_CHECK_INTERVAL_MS);
			}
			async function waitForPageBuildConfig(timeoutMs = 18e3) {
				const startedAt = Date.now();
				let lastError = null;
				while (Date.now() - startedAt < timeoutMs) {
					try {
						const config = await fetchPageBuildConfig();
						if (config) return config;
					} catch (err) {
						lastError = err;
					}
					await new Promise((resolve) => setTimeout(resolve, 900));
				}
				throw lastError || /* @__PURE__ */ new Error("Mobile Web is still unavailable");
			}
			async function refreshPageForNewBuild() {
				if (state.pageRefreshReloading) return;
				state.pageRefreshReloading = true;
				renderPageRefreshPrompt();
				saveCurrentDraftNow();
				let config = state.pageRefreshPreparedConfig;
				try {
					const reconnectRefresh = state.pageRefreshReason === "reconnect" || state.pageRefreshReason === "restart";
					const latestConfig = reconnectRefresh ? await waitForPageBuildConfig() : await fetchPageBuildConfig();
					if (latestConfig) config = latestConfig;
					if (!config) throw new Error("page refresh build config unavailable");
					const nextBuildId = serverBuildIdFromConfig(config);
					const currentBuildId = state.serverBuildId || CLIENT_BUILD_ID || nextBuildId;
					if (reconnectRefresh && !shouldPromptForServerBuildChange(nextBuildId, currentBuildId)) {
						state.serverBuildId = currentBuildId || nextBuildId;
						state.serverAssetBuildId = String(config && config.buildId || state.serverAssetBuildId || "").trim();
						rememberRateLimitsFromConfig(config);
						rememberCodexProfiles(config && config.codexProfiles || null);
						const restartFinished = finishRestartingUiIfReady();
						state.pageRefreshReloading = false;
						state.pageRefreshAvailable = !restartFinished && state.codexProfileRestarting;
						state.pageRefreshReason = state.pageRefreshAvailable ? "restart" : "";
						state.pageRefreshPreparedConfig = null;
						renderPageRefreshPrompt();
						return;
					}
					rememberRateLimitsFromConfig(config);
					rememberCodexProfiles(config && config.codexProfiles || null);
					await clearAllShellCaches();
					if (config) await preparePageShellAssets(config, { populateCache: true });
					await resetPageShellServiceWorker();
					await pruneOldShellCaches(String(config && config.shellCacheName || "").trim());
					window.location.replace(pageReloadUrlWithBust());
				} catch (_) {
					state.pageRefreshReloading = false;
					state.pageRefreshPreparedConfig = null;
					if (state.pageRefreshReason !== "reconnect" && state.pageRefreshReason !== "restart") {
						state.pageRefreshAvailable = false;
						state.pageRefreshReason = "";
					}
					renderPageRefreshPrompt();
				}
			}
			return Object.freeze({
				appVersionText,
				clientBuildVersionText,
				renderAppUpdateStatus,
				refreshAppUpdateStatus,
				currentUpdateUsesPublicRelease,
				updateStatusLine,
				publicReleaseStatusLine,
				updateActionButton,
				publicPrHasOpenPullRequests,
				renderUpdatePanel,
				refreshPublicReleaseStatus,
				openUpdatePanel,
				closeUpdatePanel,
				handleUpdatePanelClick,
				scheduleStartupUpdateCheck,
				publicPrPromptKey,
				publicPrSummaryText,
				normalizedPublicPrReviewTitle,
				publicPrReviewThreadTitle,
				findPublicPrReviewThread,
				workspacePathBaseName,
				workspacePathIsVisible,
				visibleWorkspaceWithBaseName,
				publicPrReviewWorkspacePath,
				openPublicPrReviewThreadIfAvailable,
				renderPublicPrStatus,
				refreshPublicPrStatus,
				scheduleStartupPublicPrCheck,
				publicPrMergeInstruction,
				publicPrMergeConfirmationMessage,
				preparePublicPrMergePrompt,
				rememberPublicPrPrompt,
				maybePromptPublicPrMerge,
				handlePublicPrStatusClick,
				handleAppUpdateClick,
				renderSharedRestartButton,
				renderHardRefreshButton,
				markBootReady,
				reportShellLoaded,
				sharedRestartScopeLines,
				restartRiskThreads,
				fetchRestartRiskThreads,
				restartRiskThreadTitle,
				restartRiskThreadMeta,
				renderSharedRestartDialog,
				closeSharedRestartDialog,
				requestSharedRestartConfirmation,
				handleSharedRestartClick,
				serverBuildIdFromConfig,
				shouldPromptForServerBuildChange,
				pageShellAssetUrl,
				validatePageShellAsset,
				fetchPageShellAsset,
				preparePageShellAssets,
				fetchPageBuildConfig,
				pruneOldShellCaches,
				clearAllShellCaches,
				resetPageShellServiceWorker,
				pageReloadUrlWithBust,
				initializePageBuildState,
				renderPageRefreshPrompt,
				handleHardRefreshClick,
				showReconnectRefreshPrompt,
				finishRestartingUiIfReady,
				clearReconnectRefreshPrompt,
				checkPageRefreshAvailability,
				schedulePageRefreshCheck,
				scheduleVisiblePageRefreshCheck,
				startPageRefreshChecks,
				waitForPageBuildConfig,
				refreshPageForNewBuild
			});
		}
		root.CodexAppUpdateRuntime = Object.freeze({ createAppUpdateRuntime });
		if (typeof module !== "undefined" && module.exports) module.exports = { createAppUpdateRuntime };
	})(typeof window !== "undefined" ? window : globalThis);
}));
//#endregion
//#region public/modal-runtime.js
var require_modal_runtime = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	function renderAppNativeDialog() {
		const dialog = $("appNativeDialog");
		const title = $("appNativeDialogTitle");
		const message = $("appNativeDialogMessage");
		const input = $("appNativeDialogInput");
		const actions = $("appNativeDialogActions");
		const cancel = $("appNativeDialogCancel");
		const proceed = $("appNativeDialogProceed");
		if (!dialog || !title || !message || !input || !actions || !cancel || !proceed) return;
		const open = Boolean(state.appNativeDialogOpen);
		const promptMode = state.appNativeDialogMode === "prompt";
		const alertMode = state.appNativeDialogMode === "alert";
		dialog.classList.toggle("hidden", !open);
		title.textContent = state.appNativeDialogTitle || "提示";
		message.textContent = state.appNativeDialogMessage || "";
		input.classList.toggle("hidden", !open || !promptMode);
		input.value = promptMode ? state.appNativeDialogValue || "" : "";
		input.placeholder = promptMode ? state.appNativeDialogPlaceholder || "" : "";
		input.rows = Math.max(2, Math.min(10, Number(state.appNativeDialogRows) || 4));
		cancel.hidden = alertMode;
		actions.classList.toggle("single", alertMode);
		cancel.textContent = state.appNativeDialogCancelLabel || "取消";
		proceed.textContent = state.appNativeDialogConfirmLabel || (alertMode ? "知道了" : "确定");
		if (open) window.setTimeout(() => {
			const focusTarget = promptMode ? input : proceed;
			if (focusTarget && typeof focusTarget.focus === "function") try {
				focusTarget.focus({ preventScroll: true });
			} catch (_) {
				focusTarget.focus();
			}
		}, 0);
	}
	function closeAppNativeDialog(confirmed = false) {
		const resolve = state.appNativeDialogResolve;
		const mode = state.appNativeDialogMode;
		const input = $("appNativeDialogInput");
		const value = input ? input.value : state.appNativeDialogValue;
		state.appNativeDialogOpen = false;
		state.appNativeDialogMode = "alert";
		state.appNativeDialogTitle = "提示";
		state.appNativeDialogMessage = "";
		state.appNativeDialogValue = "";
		state.appNativeDialogPlaceholder = "";
		state.appNativeDialogConfirmLabel = "确定";
		state.appNativeDialogCancelLabel = "取消";
		state.appNativeDialogRows = 4;
		state.appNativeDialogResolve = null;
		renderAppNativeDialog();
		if (!resolve) return;
		if (mode === "prompt") {
			resolve(confirmed ? value : null);
			return;
		}
		if (mode === "confirm") {
			resolve(Boolean(confirmed));
			return;
		}
		resolve(void 0);
	}
	function requestAppNativeDialog(options = {}) {
		if (state.appNativeDialogResolve) closeAppNativeDialog(false);
		const mode = [
			"alert",
			"confirm",
			"prompt"
		].includes(options.mode) ? options.mode : "alert";
		state.appNativeDialogOpen = true;
		state.appNativeDialogMode = mode;
		state.appNativeDialogTitle = String(options.title || "提示");
		state.appNativeDialogMessage = String(options.message || "");
		state.appNativeDialogValue = String(options.value || "");
		state.appNativeDialogPlaceholder = String(options.placeholder || "");
		state.appNativeDialogConfirmLabel = String(options.confirmLabel || (mode === "alert" ? "知道了" : "确定"));
		state.appNativeDialogCancelLabel = String(options.cancelLabel || "取消");
		state.appNativeDialogRows = Math.max(2, Math.min(10, Number(options.rows) || 4));
		renderAppNativeDialog();
		return new Promise((resolve) => {
			state.appNativeDialogResolve = resolve;
		});
	}
	function requestAppAlert(message, options = {}) {
		return requestAppNativeDialog(Object.assign({}, options, {
			mode: "alert",
			message,
			title: options.title || "提示",
			confirmLabel: options.confirmLabel || "知道了"
		}));
	}
	function requestAppConfirmation(message, options = {}) {
		return requestAppNativeDialog(Object.assign({}, options, {
			mode: "confirm",
			message,
			title: options.title || "确认操作"
		}));
	}
	function requestAppTextInput(message, value = "", options = {}) {
		return requestAppNativeDialog(Object.assign({}, options, {
			mode: "prompt",
			message,
			value,
			title: options.title || "输入内容"
		}));
	}
	function handleAppNativeDialogKeydown(event) {
		if (!state.appNativeDialogOpen) return;
		if (event.key === "Escape") {
			event.preventDefault();
			closeAppNativeDialog(false);
			return;
		}
		if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
			event.preventDefault();
			closeAppNativeDialog(true);
		}
	}
	function renderCodexProfileSwitchDialog() {
		const dialog = $("profileSwitchConfirmDialog");
		const subtitle = $("profileSwitchConfirmSubtitle");
		if (!dialog || !subtitle) return;
		dialog.classList.toggle("hidden", !state.profileSwitchConfirmOpen);
		subtitle.textContent = state.profileSwitchConfirmOpen ? `目标账号：${state.profileSwitchConfirmLabel || state.profileSwitchConfirmTargetId || "--"}` : "";
	}
	function closeCodexProfileSwitchDialog(confirmed = false) {
		const resolve = state.profileSwitchConfirmResolve;
		state.profileSwitchConfirmOpen = false;
		state.profileSwitchConfirmTargetId = "";
		state.profileSwitchConfirmLabel = "";
		state.profileSwitchConfirmResolve = null;
		renderCodexProfileSwitchDialog();
		if (resolve) resolve(Boolean(confirmed));
	}
	function requestCodexProfileSwitchConfirmation(profileId, label) {
		if (state.profileSwitchConfirmResolve) closeCodexProfileSwitchDialog(false);
		state.profileSwitchConfirmOpen = true;
		state.profileSwitchConfirmTargetId = String(profileId || "");
		state.profileSwitchConfirmLabel = String(label || profileId || "");
		renderCodexProfileSwitchDialog();
		return new Promise((resolve) => {
			state.profileSwitchConfirmResolve = resolve;
		});
	}
	function codexProfileSwitchStageLabel(stageId, fallback = "") {
		const id = String(stageId || "");
		const stage = CODEX_PROFILE_SWITCH_STAGES.find((item) => item.id === id);
		return stage ? stage.label : String(fallback || id || "");
	}
	function formatCodexProfileSwitchProgress(progress = {}) {
		const input = progress && typeof progress === "object" ? progress : {};
		const fallback = codexProfileSwitchStageLabel(input.stage, "正在切换 Profile");
		const message = String(input.message || fallback || "").trim();
		const stepIndex = Number(input.stepIndex || 0);
		const stepCount = Number(input.stepCount || 0);
		if (message && stepIndex > 0 && stepCount > 0) return `${stepIndex}/${stepCount} ${message}`;
		return message || "正在切换 Profile...";
	}
	function setCodexProfileSwitchStage(progress) {
		const text = typeof progress === "string" ? progress : formatCodexProfileSwitchProgress(progress);
		state.codexProfileSwitchStage = text;
		const connection = $("connectionState");
		if (connection) connection.textContent = text;
		renderCodexProfileSettings();
	}
	function clearCodexProfileSwitchStageTimers() {
		for (const timer of state.codexProfileSwitchStageTimers || []) window.clearTimeout(timer);
		state.codexProfileSwitchStageTimers = [];
	}
	function stopCodexProfileSwitchProgressPolling() {
		clearCodexProfileSwitchStageTimers();
		if (state.codexProfileSwitchProgressTimer) {
			window.clearTimeout(state.codexProfileSwitchProgressTimer);
			state.codexProfileSwitchProgressTimer = null;
		}
	}
	function startCodexProfileSwitchProgressPolling(requestId) {
		const id = String(requestId || "").trim();
		stopCodexProfileSwitchProgressPolling();
		if (!id) return;
		const poll = async () => {
			if (!state.codexProfileSwitchBusy || state.codexProfileSwitchRequestId !== id) return;
			try {
				const result = await api(`/api/codex-profiles/switch-progress?requestId=${encodeURIComponent(id)}`, { timeoutMs: 5e3 });
				if (result && result.progress) {
					setCodexProfileSwitchStage(result.progress);
					const status = String(result.progress.status || "");
					if (status === "failed" || status === "restarting" || status === "complete") return;
				}
			} catch (_) {}
			if (state.codexProfileSwitchBusy && state.codexProfileSwitchRequestId === id) state.codexProfileSwitchProgressTimer = window.setTimeout(poll, 700);
		};
		state.codexProfileSwitchProgressTimer = window.setTimeout(poll, 250);
	}
	async function performCodexProfileSwitch(profileId) {
		const requestId = createSubmissionId();
		let switchAccepted = false;
		state.codexProfileSwitchBusy = true;
		state.codexProfileSwitchTargetId = profileId;
		state.codexProfileSwitchRequestId = requestId;
		clearStoredRateLimits();
		setCodexProfileSwitchStage({
			stage: "profile_lookup",
			message: "正在读取目标 Profile...",
			stepIndex: 1,
			stepCount: 10
		});
		startCodexProfileSwitchProgressPolling(requestId);
		try {
			const result = await api("/api/codex-profiles/active", {
				method: "POST",
				body: JSON.stringify({
					profileId,
					requestId
				}),
				timeoutMs: 9e4
			});
			stopCodexProfileSwitchProgressPolling();
			setCodexProfileSwitchStage(result && result.progress ? result.progress : {
				stage: "waiting_for_restart",
				message: "切换已写入，正在等待服务恢复...",
				stepIndex: 10,
				stepCount: 10
			});
			state.codexProfileRestarting = true;
			switchAccepted = true;
			showReconnectRefreshPrompt("restart");
		} catch (err) {
			stopCodexProfileSwitchProgressPolling();
			let showedProgress = false;
			try {
				const progressResult = await api(`/api/codex-profiles/switch-progress?requestId=${encodeURIComponent(requestId)}`, { timeoutMs: 5e3 });
				if (progressResult && progressResult.progress) {
					setCodexProfileSwitchStage(progressResult.progress);
					showedProgress = true;
				}
			} catch (_) {}
			if (err && err.progress) {
				setCodexProfileSwitchStage(err.progress);
				showedProgress = true;
			}
			if (!showedProgress) setCodexProfileSwitchStage(`切换失败：${err.message || "Codex profile switch failed"}`);
			const connection = $("connectionState");
			if (connection) connection.textContent = state.codexProfileSwitchStage || err.message || "Codex profile switch failed";
			showError(err);
		} finally {
			state.codexProfileSwitchBusy = false;
			if (!state.codexProfileRestarting && switchAccepted) {
				state.codexProfileSwitchTargetId = "";
				state.codexProfileSwitchStage = "";
				state.codexProfileSwitchRequestId = "";
			}
			renderCodexProfileSettings();
		}
	}
	function createModalRuntime() {
		return {
			requestAppNativeDialog: typeof requestAppNativeDialog === "function" ? requestAppNativeDialog : null,
			requestAppAlert: typeof requestAppAlert === "function" ? requestAppAlert : null,
			requestAppConfirmation: typeof requestAppConfirmation === "function" ? requestAppConfirmation : null,
			requestAppTextInput: typeof requestAppTextInput === "function" ? requestAppTextInput : null,
			requestCodexProfileSwitchConfirmation: typeof requestCodexProfileSwitchConfirmation === "function" ? requestCodexProfileSwitchConfirmation : null
		};
	}
	(function exposeCodexModalRuntime(root) {
		const modalRuntimeApi = { createModalRuntime };
		if (typeof module === "object" && module.exports) module.exports = modalRuntimeApi;
		Object.assign(root, {
			renderAppNativeDialog,
			closeAppNativeDialog,
			requestAppNativeDialog,
			requestAppAlert,
			requestAppConfirmation,
			requestAppTextInput,
			handleAppNativeDialogKeydown,
			renderCodexProfileSwitchDialog,
			closeCodexProfileSwitchDialog,
			requestCodexProfileSwitchConfirmation,
			codexProfileSwitchStageLabel,
			formatCodexProfileSwitchProgress,
			setCodexProfileSwitchStage,
			clearCodexProfileSwitchStageTimers,
			stopCodexProfileSwitchProgressPolling,
			startCodexProfileSwitchProgressPolling,
			performCodexProfileSwitch
		});
		root.CodexModalRuntime = modalRuntimeApi;
	})(typeof globalThis !== "undefined" ? globalThis : window);
}));
//#endregion
//#region public/thread-list-runtime.js
var require_thread_list_runtime = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function attachThreadListRuntime(root) {
		function createThreadListRuntime(deps = {}) {
			const state = deps.state || {};
			const $ = typeof deps.$ === "function" ? deps.$ : () => null;
			const api = deps.api;
			const document = deps.document || root.document || {};
			const window = deps.window || root.window || root;
			const localStorage = deps.localStorage || root.localStorage || {
				getItem: () => null,
				setItem: () => {},
				removeItem: () => {}
			};
			const setTimeout = typeof deps.setTimeout === "function" ? deps.setTimeout : root.setTimeout.bind(root);
			const clearTimeout = typeof deps.clearTimeout === "function" ? deps.clearTimeout : root.clearTimeout.bind(root);
			const THREAD_LIST_PAGE_LIMIT = deps.THREAD_LIST_PAGE_LIMIT;
			const THREAD_LIST_DEFERRED_FALLBACK_DELAY_MS = deps.THREAD_LIST_DEFERRED_FALLBACK_DELAY_MS;
			const THREAD_LIST_DEFERRED_FALLBACK_RETRY_MS = deps.THREAD_LIST_DEFERRED_FALLBACK_RETRY_MS;
			const THREAD_LIST_SLOW_PATH_MS = deps.THREAD_LIST_SLOW_PATH_MS;
			const STORAGE_THREAD_ID = deps.STORAGE_THREAD_ID;
			const { normalizeFsPath, escapeHtml, shortPath, isMobileViewport, tokenCountValue, formatTokenMillion, displayInputTokensExcludingCached, saveCurrentDraftNow, flushSideChatDraftNow, resetComposerRuntimeSelection, abortCurrentThreadRefresh, clearRecentCompletedReplyAnchor, clearConversationAutoScrollHold, setComposerText, replacePendingAttachments, syncActiveTurnFromThread, connectEvents, threadListLoadPolicy, nowPerfMs, roundedDurationMs, threadListSummaryFromDetailThread, threadListStableOrderPolicy, reconcileThreadStatusHints, renderCurrentThread, threadTileLayout, isThreadTileKeyboardFocusActive, threadTileCandidateIds, threadTileIdsEqual, restoreConnectionState, scheduleVisiblePageRefreshCheck, threadPerformanceMetrics, postPerformanceEvent, diagnosticDurationBucket, recordHomeAiDiagnosticFailure, recordHomeAiDiagnosticSuccess, threadDiagnosticEventsApi, renderThreadLoadError, diagnosticErrorCode, diagnosticErrorStatus, showError, visibleWorkspaceKeys, codexWorktreeRepoName, basenameForFsPath, visibleWorkspaceNames, statusText, scheduleRenderCurrentThread, threadTilePaneIsVisible, scheduleRenderThreadTilePane, updateThreadStatusHints, normalizeThreadGoal, updateThreadGoalDialogState, draftStore, readDraftMap, draftHasContent, restoreDraftForCurrentTarget, updateComposerControls, showHermesPluginPrimaryPage, isHermesEmbedMode, loadThread, isRunningStatus, rolloutSizeText, isRolloutOverThreshold, formatAbsoluteTime, formatTime, statusIconHtml, statusIconInfo, threadGoalForThread, renderThreadGoalBadge, handleThreadCardClick, threadGoalSignature, rolloutSizeBytes } = deps;
			async function loadWorkspaces() {
				const result = await api("/api/workspaces");
				state.workspaces = result.data || [];
				const select = $("workspaceSelect");
				const menu = $("workspaceSelectMenu");
				if (state.selectedCwd && !state.workspaces.some((ws) => normalizeFsPath(ws.cwd) === normalizeFsPath(state.selectedCwd))) state.selectedCwd = "";
				if (select) {
					select.textContent = state.selectedCwd ? selectedWorkspaceLabel() : "All workspaces";
					select.disabled = !state.workspaces.length && !state.workspaceCreateEnabled;
					select.setAttribute("title", state.workspaces.length ? "Select Workspace" : "Create Workspace");
				}
				if (menu) menu.innerHTML = workspaceSidebarOptionsHtml();
				updateWorkspacePath();
				if (shouldRenderPrimaryConversationShell()) renderCurrentThread();
			}
			function workspaceSidebarOptionsHtml() {
				const allOption = `<button type="button" class="workspace-select-option${!state.selectedCwd ? " is-selected" : ""}" data-workspace-value="">All workspaces</button>`;
				const workspaceOptions = state.workspaces.length ? state.workspaces.map((ws) => {
					const count = ws.recentThreadCount ? ` (${ws.recentThreadCount})` : "";
					const label = `${ws.label}${count} - ${ws.cwd}`;
					return `<button type="button" class="workspace-select-option${normalizeFsPath(ws.cwd) === normalizeFsPath(state.selectedCwd) ? " is-selected" : ""}" data-workspace-value="${escapeHtml(ws.cwd)}">${escapeHtml(label)}</button>`;
				}).join("") : `<div class="workspace-select-empty">No Workspace yet</div>`;
				const createRoot = state.workspaceCreateRoot ? `Under ${state.workspaceCreateRoot}` : "Create a local folder";
				const createOption = state.workspaceCreateEnabled ? `<button type="button" class="workspace-select-option workspace-create-option" data-create-workspace><span class="workspace-create-title">Create Workspace</span><span class="workspace-create-meta">${escapeHtml(createRoot)}</span></button>` : "";
				return allOption + workspaceOptions + createOption;
			}
			function syncSidebarWorkspaceSelect() {
				const select = $("workspaceSelect");
				const menu = $("workspaceSelectMenu");
				if (!select) return;
				select.textContent = state.selectedCwd ? selectedWorkspaceLabel() : "All workspaces";
				if (menu) menu.innerHTML = workspaceSidebarOptionsHtml();
			}
			function workspaceOptionsHtml() {
				return `<option value="">All workspaces</option>` + state.workspaces.map((ws) => {
					const count = ws.recentThreadCount ? ` (${ws.recentThreadCount})` : "";
					return `<option value="${escapeHtml(ws.cwd)}">${escapeHtml(`${ws.label}${count} - ${ws.cwd}`)}</option>`;
				}).join("");
			}
			function newThreadWorkspaceOptionsHtml() {
				return `<button type="button" class="new-thread-workspace-option${!state.selectedCwd ? " is-selected" : ""}" data-new-thread-workspace=""><span>不指定 Workspace</span><span class="new-thread-workspace-option-meta">对齐 Codex App 的项目外聊天</span></button>` + state.workspaces.map((ws) => {
					const count = ws.recentThreadCount ? ` (${ws.recentThreadCount})` : "";
					const label = `${ws.label}${count} - ${ws.cwd}`;
					return `<button type="button" class="new-thread-workspace-option${normalizeFsPath(ws.cwd) === normalizeFsPath(state.selectedCwd) ? " is-selected" : ""}" data-new-thread-workspace="${escapeHtml(ws.cwd)}">${escapeHtml(label)}</button>`;
				}).join("");
			}
			function newThreadChoiceOptionsHtml(values, selectedValue, dataName, labeler) {
				return normalizeOptionList(values).map((value) => {
					return `<button type="button" class="new-thread-choice${value === selectedValue ? " is-selected" : ""}" data-new-thread-${dataName}="${escapeHtml(value)}">${escapeHtml(labeler(value))}</button>`;
				}).join("");
			}
			function selectedWorkspaceLabel() {
				if (!state.selectedCwd) return "聊天";
				const workspace = state.workspaces.find((ws) => normalizeFsPath(ws.cwd) === normalizeFsPath(state.selectedCwd));
				return workspace && workspace.label ? workspace.label : shortPath(state.selectedCwd);
			}
			function fitWorkspaceMenuToViewport(menu, anchor, options = {}) {
				if (!menu || !anchor) return;
				const rect = anchor.getBoundingClientRect();
				const composer = $("composer");
				const composerTop = composer ? composer.getBoundingClientRect().top : 0;
				const viewportBottom = window.innerHeight || document.documentElement.clientHeight || 0;
				const bottomLimit = options.avoidComposer !== false && composerTop > rect.bottom ? composerTop : viewportBottom;
				const gap = Number(options.gap || 18);
				const cap = Number(options.cap || (isMobileViewport() ? 360 : 420));
				const available = Math.max(120, Math.floor(bottomLimit - rect.bottom - gap));
				const height = Math.max(120, Math.min(cap, available));
				menu.style.setProperty("--workspace-menu-max-height", `${height}px`);
			}
			function updateWorkspacePath() {
				const el = $("workspacePath");
				if (!el) return;
				el.hidden = !state.selectedCwd;
				el.textContent = state.selectedCwd || "";
			}
			function renderWorkspaceTokenUsage() {
				const el = $("workspaceTokenUsage");
				if (!el) return;
				const usage = state.workspaceTokenUsage;
				if (!usage || typeof usage !== "object") {
					el.hidden = true;
					el.innerHTML = "";
					return;
				}
				if (!(tokenCountValue(usage.totalTokens) || tokenCountValue(usage.todayTokens) || tokenCountValue(usage.weekTokens))) {
					el.hidden = true;
					el.innerHTML = "";
					return;
				}
				el.hidden = false;
				el.innerHTML = `<div class="workspace-token-usage-summary">
    <span title="当前 Workspace 累计 token">总 ${escapeHtml(formatTokenMillion(usage.totalTokens))}</span>
    <span title="本周 token">周 ${escapeHtml(formatTokenMillion(usage.weekTokens))}</span>
    <span title="今日 token">今 ${escapeHtml(formatTokenMillion(usage.todayTokens))}</span>
    <button type="button" class="workspace-token-usage-toggle" data-workspace-token-usage-toggle>统计</button>
  </div>`;
				renderWorkspaceStatsDialog();
			}
			function tokenBreakdownHtml(entry, className = "workspace-token-usage-breakdown") {
				return `<div class="${escapeHtml(className)}" aria-label="Token usage breakdown">
    <span title="Uncached input tokens">Uncached ${escapeHtml(formatTokenMillion(displayInputTokensExcludingCached(entry)))}</span>
    <span title="Cached input tokens">Cached ${escapeHtml(formatTokenMillion(entry && entry.cachedInputTokens))}</span>
    <span title="Output tokens">Out ${escapeHtml(formatTokenMillion(entry && entry.outputTokens))}</span>
    <span title="Reasoning output tokens">Reason ${escapeHtml(formatTokenMillion(entry && entry.reasoningOutputTokens))}</span>
  </div>`;
			}
			function renderWorkspaceStatsDialog() {
				const dialog = $("workspaceStatsDialog");
				const content = $("workspaceStatsContent");
				const subtitle = $("workspaceStatsSubtitle");
				if (!dialog || !content) return;
				if (!state.workspaceTokenStatsOpen) {
					dialog.classList.add("hidden");
					content.innerHTML = "";
					return;
				}
				const usage = state.workspaceTokenUsage && typeof state.workspaceTokenUsage === "object" ? state.workspaceTokenUsage : {};
				const daily = Array.isArray(usage.daily) ? usage.daily.slice(0, 31) : [];
				const workspaces = Array.isArray(usage.workspaces) ? usage.workspaces.slice(0, 50) : [];
				if (subtitle) subtitle.textContent = state.selectedCwd ? `当前 Workspace: ${state.selectedCwd}` : "All workspaces";
				content.innerHTML = `<section class="workspace-stats-section">
    <div class="workspace-stats-section-title">总览</div>
    <div class="workspace-stats-summary-grid">
      <div><span>总计</span><strong>${escapeHtml(formatTokenMillion(usage.totalTokens))}</strong></div>
      <div><span>本周</span><strong>${escapeHtml(formatTokenMillion(usage.weekTokens))}</strong></div>
      <div><span>今日</span><strong>${escapeHtml(formatTokenMillion(usage.todayTokens))}</strong></div>
    </div>
    ${tokenBreakdownHtml(usage, "workspace-stats-breakdown")}
  </section>
  <section class="workspace-stats-section">
    <div class="workspace-stats-section-title">按天</div>
    <div class="workspace-stats-list">
      ${daily.length ? daily.map((entry) => `<article class="workspace-stats-row">
        <div class="workspace-stats-row-head">
          <span>${escapeHtml(entry.date || "")}</span>
          <strong>${escapeHtml(formatTokenMillion(entry.totalTokens))}</strong>
        </div>
        ${tokenBreakdownHtml(entry, "workspace-stats-breakdown")}
      </article>`).join("") : `<div class="workspace-token-usage-empty">暂无每日明细</div>`}
    </div>
  </section>
  <section class="workspace-stats-section">
    <div class="workspace-stats-section-title">按项目</div>
    <div class="workspace-stats-list">
      ${workspaces.length ? workspaces.map((entry) => `<article class="workspace-stats-row">
        <div class="workspace-stats-row-head">
          <span title="${escapeHtml(entry.cwd || "")}">${escapeHtml(shortPath(entry.cwd) || entry.cwd || "")}</span>
          <strong>${escapeHtml(formatTokenMillion(entry.totalTokens))}</strong>
        </div>
        <div class="workspace-stats-row-meta">
          <span>周 ${escapeHtml(formatTokenMillion(entry.weekTokens))}</span>
          <span>今 ${escapeHtml(formatTokenMillion(entry.todayTokens))}</span>
        </div>
        ${tokenBreakdownHtml(entry, "workspace-stats-breakdown")}
      </article>`).join("") : `<div class="workspace-token-usage-empty">暂无项目明细</div>`}
    </div>
  </section>`;
				dialog.classList.remove("hidden");
			}
			function openWorkspaceStatsDialog() {
				state.workspaceTokenStatsOpen = true;
				renderWorkspaceStatsDialog();
			}
			function closeWorkspaceStatsDialog() {
				state.workspaceTokenStatsOpen = false;
				renderWorkspaceStatsDialog();
			}
			function clearCurrentThreadSelection(options = {}) {
				if (options.saveDraft !== false) saveCurrentDraftNow();
				flushSideChatDraftNow().catch(() => {});
				state.threadLoadSeq += 1;
				state.sendButtonHint = "";
				resetComposerRuntimeSelection();
				state.newThreadTitle = "";
				if (state.threadLoadController) {
					state.threadLoadController.abort();
					state.threadLoadController = null;
				}
				abortCurrentThreadRefresh();
				state.currentThread = null;
				state.currentThreadId = "";
				state.activeTurnId = "";
				clearRecentCompletedReplyAnchor();
				clearConversationAutoScrollHold();
				localStorage.removeItem(STORAGE_THREAD_ID);
				setComposerText("");
				replacePendingAttachments([], { saveDraft: false });
				syncActiveTurnFromThread();
				if (state.events) connectEvents();
			}
			function renderThreadListLoading() {
				const list = $("threadList");
				if (!list) return;
				list.innerHTML = `<div class="empty-state">Loading threads...</div>`;
				state.renderedThreadListSignature = `loading|${state.selectedCwd}|${$("threadSearch").value.trim()}`;
			}
			function hasThreadDetailSelectionIntent() {
				return Boolean(state.currentThread || state.currentThreadId || state.threadLoadController || state.startupThreadOpenPending);
			}
			function shouldRenderPrimaryConversationShell() {
				return !hasThreadDetailSelectionIntent() && !state.newThreadDraft;
			}
			function clearThreadListDeferredFallbackTimer() {
				if (!state.threadListDeferredFallbackTimer) return;
				clearTimeout(state.threadListDeferredFallbackTimer);
				state.threadListDeferredFallbackTimer = null;
			}
			function clearThreadListDeferredSilentTimer() {
				if (!state.threadListDeferredSilentTimer) return;
				clearTimeout(state.threadListDeferredSilentTimer);
				state.threadListDeferredSilentTimer = null;
			}
			function hasThreadDetailRequestInFlight() {
				return Boolean(state.threadLoadController || state.refreshThreadController || state.currentThread && state.currentThread.mobileLoading);
			}
			function scheduleThreadListDeferredFallback(delayMs = THREAD_LIST_DEFERRED_FALLBACK_DELAY_MS) {
				clearThreadListDeferredFallbackTimer();
				const delay = Math.max(500, Number(delayMs) || THREAD_LIST_DEFERRED_FALLBACK_DELAY_MS);
				state.threadListDeferredFallbackTimer = setTimeout(() => {
					state.threadListDeferredFallbackTimer = null;
					const search = $("threadSearch").value.trim();
					if (state.selectedCwd || search) return;
					if (state.threadListLoadController || hasThreadDetailRequestInFlight()) {
						scheduleThreadListDeferredFallback(THREAD_LIST_DEFERRED_FALLBACK_RETRY_MS);
						return;
					}
					loadThreads({
						silent: true,
						deferFallback: false
					}).catch(showError);
				}, delay);
			}
			function scheduleThreadListDeferredSilentRefresh(delayMs = 700, options = {}) {
				clearThreadListDeferredSilentTimer();
				const delay = Math.max(250, Number(delayMs) || 700);
				state.threadListDeferredSilentTimer = setTimeout(() => {
					state.threadListDeferredSilentTimer = null;
					if (document.visibilityState === "hidden") return;
					if (state.threadListLoadController || hasThreadDetailRequestInFlight()) {
						scheduleThreadListDeferredSilentRefresh(900, options);
						return;
					}
					loadThreads(Object.assign({}, options, {
						silent: true,
						allowDuringDetail: true,
						allowHidden: false
					})).catch(showError);
				}, delay);
			}
			async function loadThreads(options = {}) {
				const silent = options.silent === true;
				if (silent && state.threadListLoadController) return null;
				if (options.deferFallback !== true) clearThreadListDeferredFallbackTimer();
				const params = new URLSearchParams({
					limit: String(THREAD_LIST_PAGE_LIMIT),
					archived: "false"
				});
				if (state.selectedCwd) params.set("cwd", state.selectedCwd);
				const search = $("threadSearch").value.trim();
				if (search) params.set("search", search);
				const threadDetailOpening = hasThreadDetailRequestInFlight();
				const loadPlan = threadListLoadPolicy.planThreadListLoadRequest({
					deferFallback: options.deferFallback,
					search,
					selectedCwd: state.selectedCwd,
					silent,
					threadDetailOpening,
					threadListLoadedAtMs: state.threadListLoadedAtMs,
					documentHidden: document.visibilityState === "hidden",
					allowDuringDetail: options.allowDuringDetail === true,
					allowHidden: options.allowHidden === true
				});
				if (!loadPlan.shouldLoad) {
					if (loadPlan.skipReason === "detail-in-flight") scheduleThreadListDeferredSilentRefresh(loadPlan.retryDelayMs, { deferFallback: options.deferFallback });
					return null;
				}
				if (loadPlan.params && loadPlan.params.fallback) params.set("fallback", "defer");
				if (loadPlan.params && loadPlan.params.initial) params.set("initial", "warm-fallback");
				clearThreadListDeferredSilentTimer();
				const loadStartedAt = nowPerfMs();
				const seq = state.threadListLoadSeq + 1;
				state.threadListLoadSeq = seq;
				if (state.threadListLoadController) state.threadListLoadController.abort();
				const controller = new AbortController();
				state.threadListLoadController = controller;
				if (!silent) renderThreadListLoading();
				try {
					const apiStartedAt = nowPerfMs();
					const result = await api(`/api/threads?${params}`, {
						timeoutMs: 45e3,
						signal: controller.signal
					});
					const apiElapsedMs = roundedDurationMs(apiStartedAt);
					if (seq !== state.threadListLoadSeq) return null;
					const renderStartedAt = nowPerfMs();
					const nextThreads = visibleThreads(result.data || []).map((thread) => threadListSummaryFromDetailThread(thread) || thread);
					const stableOrderPlan = threadListStableOrderPolicy.planThreadListStableOrder({
						threads: nextThreads,
						previousState: state.threadListStableOrder,
						scopeKey: threadListStableOrderPolicy.threadListOrderScopeKey({
							selectedCwd: state.selectedCwd,
							search
						}),
						selectedCwd: state.selectedCwd,
						search,
						nowMs: Date.now()
					});
					state.threads = stableOrderPlan.threads;
					state.threadListStableOrder = stableOrderPlan.state;
					state.workspaceTokenUsage = result.mobileTokenUsage || null;
					state.threadListLoadedAtMs = Date.now();
					reconcileThreadStatusHints(state.threads);
					renderWorkspaceTokenUsage();
					renderThreads(result);
					if (state.currentThread && state.threadTileMode && !isThreadTileKeyboardFocusActive()) {
						const tileLayout = threadTileLayout();
						if (tileLayout.enabled) {
							const nextTileIds = threadTileCandidateIds(tileLayout);
							if (!threadTileIdsEqual(nextTileIds, state.threadTileActiveIds)) renderCurrentThread({ stickToBottom: true });
						}
					}
					restoreConnectionState(result.mobileFallback ? "Recovered from session index" : "Connected");
					scheduleVisiblePageRefreshCheck(500);
					if (result && (result.mobileDeferredFallback || result.mobileDeferredAppServer) && !state.selectedCwd && !search) scheduleThreadListDeferredFallback();
					if (shouldRenderPrimaryConversationShell()) renderCurrentThread();
					const listPerformance = threadPerformanceMetrics.threadListEventFields(result);
					const listPerformanceEvent = {
						elapsedMs: roundedDurationMs(loadStartedAt),
						apiElapsedMs,
						renderElapsedMs: roundedDurationMs(renderStartedAt),
						serverTimings: listPerformance.serverTimings,
						performancePhase: listPerformance.performancePhase,
						count: state.threads.length,
						silent,
						hasSearch: Boolean(search),
						hasWorkspace: Boolean(state.selectedCwd),
						mobileFallback: Boolean(result.mobileFallback)
					};
					postPerformanceEvent("thread_list_rendered", listPerformanceEvent);
					const listSlowPlan = threadPerformanceMetrics.planThreadListSlowPathDiagnostic(listPerformanceEvent, {
						action: "thread-list-load",
						source: silent ? "thread-list-refresh" : "thread-list-load",
						durationBucket: diagnosticDurationBucket(listPerformanceEvent.elapsedMs),
						thresholdMs: THREAD_LIST_SLOW_PATH_MS
					});
					if (listSlowPlan.shouldReport) recordHomeAiDiagnosticFailure(threadDiagnosticEventsApi.threadListSlowPathDiagnosticEvent(listSlowPlan));
					else recordHomeAiDiagnosticSuccess(threadDiagnosticEventsApi.threadListSlowPathDiagnosticSuccess({
						action: "thread-list-load",
						performancePhase: listPerformance.performancePhase
					}));
					recordHomeAiDiagnosticSuccess({
						category: "thread_session_load_failed",
						diagnostic_type: "thread_list_load_failed",
						error_code: "thread_list_load_failed",
						context: {
							surface: "thread-session",
							action: "thread-list-load"
						}
					});
					return result;
				} catch (err) {
					if (seq !== state.threadListLoadSeq || controller.signal.aborted) return null;
					if (!silent) renderThreadLoadError(err);
					recordHomeAiDiagnosticFailure({
						category: "thread_session_load_failed",
						diagnostic_type: "thread_list_load_failed",
						severity_hint: "H3",
						evidence_confidence: .7,
						error_code: diagnosticErrorCode(err, "thread_list_load_failed"),
						duration_bucket: diagnosticDurationBucket(roundedDurationMs(loadStartedAt)),
						context: {
							surface: "thread-session",
							action: "thread-list-load"
						},
						counts: { status_code: diagnosticErrorStatus(err) },
						breadcrumbs: [{
							kind: "thread-session",
							code: "thread-list-load",
							status: "failed",
							duration_bucket: diagnosticDurationBucket(roundedDurationMs(loadStartedAt)),
							fields: { status_code: diagnosticErrorStatus(err) }
						}]
					});
					throw err;
				} finally {
					if (state.threadListLoadController === controller) state.threadListLoadController = null;
				}
			}
			function threadMatchesWorkspaceCwd(threadCwd, workspaceCwd) {
				const threadKey = normalizeFsPath(threadCwd);
				const workspaceKey = normalizeFsPath(workspaceCwd);
				if (!workspaceKey) return true;
				if (threadKey === workspaceKey) return true;
				const repoName = codexWorktreeRepoName(threadCwd);
				return Boolean(repoName && repoName === basenameForFsPath(workspaceCwd));
			}
			function threadMatchesVisibleWorkspace(threadCwd) {
				const cwd = normalizeFsPath(threadCwd);
				const keys = visibleWorkspaceKeys();
				if (keys.size <= 0 || !cwd) return true;
				if (keys.has(cwd)) return true;
				const repoName = codexWorktreeRepoName(threadCwd);
				return Boolean(repoName && visibleWorkspaceNames().has(repoName));
			}
			function isHiddenThread(thread) {
				if (!thread) return true;
				const status = statusText(thread.status).toLowerCase();
				const location = String(thread.path || thread.rolloutPath || thread.rollout_path || "").toLowerCase();
				if (thread.archived || thread.archivedAt || thread.archived_at || thread.isArchived) return true;
				if (thread.deleted || thread.deletedAt || thread.deleted_at || thread.isDeleted || thread.removed || thread.removedAt) return true;
				if (/archived|deleted|removed/.test(status)) return true;
				if (/[/\\](archived|deleted|trash|removed)[_-]?sessions[/\\]/.test(location)) return true;
				if (/\.jsonl\.(bak|backup|old)(?:\b|[-_.])/.test(location)) return true;
				const cwd = normalizeFsPath(thread.cwd);
				if (state.selectedCwd && !threadMatchesWorkspaceCwd(thread.cwd, state.selectedCwd)) return true;
				if (cwd && !threadMatchesVisibleWorkspace(thread.cwd)) return true;
				return false;
			}
			function visibleThreads(threads = state.threads) {
				return (threads || []).filter((thread) => !isHiddenThread(thread));
			}
			function pruneHiddenThreads() {
				state.threads = visibleThreads();
			}
			function applyThreadStatusToThread(thread, status) {
				if (!thread) return false;
				thread.status = status;
				return true;
			}
			function scheduleThreadStatusDetailRender(threadId = "") {
				const id = String(threadId || state.currentThreadId || "").trim();
				if (!id) return false;
				if (state.currentThread && String(state.currentThread.id || "") === id) {
					scheduleRenderCurrentThread();
					return true;
				}
				if (state.threadTileMode && threadTilePaneIsVisible(id)) {
					if (!scheduleRenderThreadTilePane(id, { preserveScroll: true })) scheduleRenderCurrentThread();
					return true;
				}
				return false;
			}
			function updateThreadListStatus(threadId, status, options = {}) {
				const id = String(threadId || "");
				if (!id) return;
				applyThreadStatusToThread(state.threads.find((entry) => String(entry && entry.id || "") === id), status);
				applyThreadStatusToThread(state.currentThread && String(state.currentThread.id || "") === id ? state.currentThread : null, status);
				applyThreadStatusToThread(state.threadTileDetails && state.threadTileDetails.get(String(id)) || null, status);
				if (options.render === true) scheduleThreadStatusDetailRender(id);
			}
			function localThreadForStatusContext(threadId) {
				const id = String(threadId || "").trim();
				if (!id) return null;
				if (state.currentThread && String(state.currentThread.id || "") === id) return state.currentThread;
				return state.threads.find((entry) => String(entry && entry.id || "") === id) || state.threadTileDetails && state.threadTileDetails.get(String(id)) || null;
			}
			function snapshotThreadStatus(threadId) {
				const id = String(threadId || "");
				if (!id) return null;
				const listThread = state.threads.find((entry) => String(entry && entry.id || "") === id) || null;
				const currentMatches = Boolean(state.currentThread && String(state.currentThread.id || "") === id);
				const tileThread = state.threadTileDetails && state.threadTileDetails.get(String(id)) || null;
				return {
					id,
					hadListThread: Boolean(listThread),
					listStatus: listThread ? listThread.status : void 0,
					hadCurrentThread: currentMatches,
					currentStatus: currentMatches ? state.currentThread.status : void 0,
					hadTileThread: Boolean(tileThread),
					tileStatus: tileThread ? tileThread.status : void 0
				};
			}
			function restoreThreadStatusSnapshot(snapshot) {
				if (!snapshot || !snapshot.id) return;
				const id = String(snapshot.id);
				const listThread = state.threads.find((entry) => String(entry && entry.id || "") === id) || null;
				const currentThread = state.currentThread && String(state.currentThread.id || "") === id ? state.currentThread : null;
				const tileThread = state.threadTileDetails && state.threadTileDetails.get(String(id)) || null;
				const restoredStatus = snapshot.hadCurrentThread ? snapshot.currentStatus : snapshot.hadListThread ? snapshot.listStatus : snapshot.tileStatus;
				const targetThread = localThreadForStatusContext(id) || currentThread || listThread || tileThread;
				updateThreadStatusHints(id, { type: "active" }, restoredStatus, {
					thread: targetThread,
					notify: false
				});
				const listIndex = state.threads.findIndex((entry) => String(entry && entry.id || "") === id);
				if (snapshot.hadListThread && listIndex >= 0) applyThreadStatusToThread(state.threads[listIndex], snapshot.listStatus);
				else if (!snapshot.hadListThread && listIndex >= 0) state.threads = state.threads.filter((entry) => String(entry && entry.id || "") !== id);
				if (snapshot.hadCurrentThread && state.currentThread && String(state.currentThread.id || "") === id) state.currentThread.status = snapshot.currentStatus;
				if (snapshot.hadTileThread) applyThreadStatusToThread(state.threadTileDetails && state.threadTileDetails.get(String(id)) || null, snapshot.tileStatus);
				pruneHiddenThreads();
				scheduleThreadStatusDetailRender(id);
			}
			function scheduleRenderThreads() {
				if (state.threadListRenderFrame || state.threadListRenderScheduled) return;
				state.threadListRenderScheduled = true;
				const render = () => {
					state.threadListRenderFrame = null;
					state.threadListRenderScheduled = false;
					renderThreads();
				};
				if (window.requestAnimationFrame) state.threadListRenderFrame = window.requestAnimationFrame(render);
				else state.threadListRenderFrame = setTimeout(render, 33);
			}
			function updateThreadGoalState(threadId, goal) {
				const id = String(threadId || goal && goal.threadId || "").trim();
				if (!id) return;
				const normalizedGoal = goal ? normalizeThreadGoal(goal, id) : null;
				const thread = state.threads.find((entry) => String(entry && entry.id || "") === id);
				applyThreadGoalToThread(thread, normalizedGoal);
				applyThreadGoalToThread(state.currentThread && String(state.currentThread.id || "") === id ? state.currentThread : null, normalizedGoal);
				applyThreadGoalToThread(state.threadTileDetails && state.threadTileDetails.get(String(id)) || null, normalizedGoal);
				scheduleThreadGoalDetailRender(id);
				if (state.goalDialogThreadId && state.goalDialogThreadId === id) updateThreadGoalDialogState(normalizedGoal);
				scheduleRenderThreads();
			}
			function renderThreads(result = null) {
				const list = $("threadList");
				pruneHiddenThreads();
				if (!state.threads.length) {
					if (state.renderedThreadListSignature !== "empty") {
						list.innerHTML = `<div class="empty-state">No threads.</div>`;
						state.renderedThreadListSignature = "empty";
					}
					return;
				}
				const warning = result && result.mobileFallback ? `<div class="history-note">Live thread list recovering. Showing cached session index.</div>` : "";
				const nowMs = Date.now();
				const html = warning + state.threads.map((thread) => {
					const title = thread.name || thread.preview || thread.id;
					const sizeText = rolloutSizeText(thread);
					const sizeWarn = isRolloutOverThreshold(thread);
					const updatedTitle = formatAbsoluteTime(thread.updatedAt);
					const pathText = shortPath(thread.cwd) || "聊天";
					const isWorkspaceLess = !thread.cwd;
					const timeText = formatTime(thread.updatedAt, nowMs);
					const statusIcon = statusIconHtml(thread.status, "thread-status-icon", thread.id);
					const iconKind = statusIconInfo(thread.status, thread.id)?.kind || "";
					const active = thread.id === state.currentThreadId ? " active" : "";
					const emphasis = iconKind ? ` has-status-${iconKind}` : "";
					const goal = threadGoalForThread(thread);
					const goalBadge = renderThreadGoalBadge(goal);
					const pendingIncomingTaskCards = Math.max(0, Number(thread && thread.pendingIncomingTaskCardCount) || 0);
					const taskCardBadge = pendingIncomingTaskCards ? `<div class="thread-card-task-badge" title="Pending incoming task cards">${escapeHtml(`Task ${pendingIncomingTaskCards}`)}</div>` : "";
					const sizeBadge = sizeText ? `<div class="thread-card-size${sizeWarn ? " warn" : ""}" title="Rollout file size">${escapeHtml(sizeText)}</div>` : "";
					return `<div class="thread-card-wrap${sizeWarn ? " rollout-warn" : ""}" data-thread-row="${escapeHtml(thread.id)}">
      <button class="thread-card${active}${emphasis}${sizeWarn ? " rollout-warn" : ""}" type="button" data-thread="${escapeHtml(thread.id)}">
        <div class="thread-card-title-row">
          <div class="thread-card-title">${escapeHtml(title)}</div>
          <div class="thread-card-title-actions">${statusIcon}</div>
        </div>
        <div class="thread-card-meta-row">
          <div class="thread-card-meta">
            <span class="thread-card-path${isWorkspaceLess ? " thread-card-path-chat" : ""}">${escapeHtml(pathText)}</span>
            ${timeText ? `<span class="thread-card-time" title="${escapeHtml(updatedTitle)}">${escapeHtml(timeText)}</span>` : ""}
          </div>
          <div class="thread-card-meta-badges">
            ${goalBadge}
            ${taskCardBadge}
            ${sizeBadge}
          </div>
        </div>
      </button>
    </div>`;
				}).join("");
				const signature = JSON.stringify({
					warning: Boolean(warning),
					currentThreadId: state.currentThreadId,
					timeBucket: Math.floor(nowMs / 6e4),
					threads: state.threads.map((thread) => [
						thread.id,
						thread.name || thread.preview || thread.id,
						shortPath(thread.cwd) || "聊天",
						thread.updatedAt,
						statusText(thread.status),
						statusIconInfo(thread.status, thread.id)?.kind || "",
						threadGoalSignature(thread),
						state.unreadThreadIds.has(thread.id) ? 1 : 0,
						Number(thread.pendingIncomingTaskCardCount || 0),
						rolloutSizeBytes(thread),
						isRolloutOverThreshold(thread)
					])
				});
				if (state.renderedThreadListSignature === signature) return;
				list.innerHTML = html;
				state.renderedThreadListSignature = signature;
				list.querySelectorAll("[data-thread]").forEach((button) => {
					button.addEventListener("click", handleThreadCardClick);
				});
			}
			async function restoreThreadSelection() {
				if (hasThreadDetailSelectionIntent()) return;
				if (isHermesEmbedMode()) {
					state.startupThreadOpenPending = false;
					showHermesPluginPrimaryPage({ source: "restore-empty" });
					return;
				}
				const savedThreadId = localStorage.getItem(STORAGE_THREAD_ID) || "";
				if (!state.threads.length && !savedThreadId) {
					state.startupThreadOpenPending = false;
					restoreNewThreadDraftSelection();
					return;
				}
				const saved = savedThreadId && state.threads.find((thread) => thread.id === savedThreadId);
				const active = state.threads.find((thread) => isRunningStatus(thread.status));
				const target = saved || (savedThreadId ? { id: savedThreadId } : active);
				if (!target) {
					state.startupThreadOpenPending = false;
					restoreNewThreadDraftSelection();
					return;
				}
				try {
					await loadThread(target.id, { source: "restore" });
				} catch (err) {
					state.startupThreadOpenPending = false;
					if (target.id === savedThreadId) localStorage.removeItem(STORAGE_THREAD_ID);
					showError(err);
					renderCurrentThread();
				}
			}
			function restoreNewThreadDraftSelection() {
				const key = draftStore.getTargetKey();
				if (!key.startsWith("new:")) return false;
				const draft = readDraftMap()[key];
				if (!draftHasContent(draft)) return false;
				const cwd = String(draft.cwd || "");
				const workspace = cwd ? state.workspaces.find((ws) => normalizeFsPath(ws.cwd) === normalizeFsPath(cwd)) : null;
				if (!workspace) return false;
				state.selectedCwd = workspace.cwd || cwd;
				clearCurrentThreadSelection({ saveDraft: false });
				state.newThreadDraft = true;
				restoreDraftForCurrentTarget();
				syncSidebarWorkspaceSelect();
				updateWorkspacePath();
				renderThreads();
				renderCurrentThread();
				updateComposerControls();
				return true;
			}
			async function selectWorkspaceShortcut(cwd) {
				saveCurrentDraftNow();
				state.selectedCwd = cwd || "";
				clearCurrentThreadSelection({ saveDraft: false });
				const select = $("workspaceSelect");
				if (select) select.textContent = state.selectedCwd ? selectedWorkspaceLabel() : "All workspaces";
				syncSidebarWorkspaceSelect();
				updateWorkspacePath();
				updateComposerControls();
				renderCurrentThread();
				await loadThreads();
			}
			return {
				loadWorkspaces,
				workspaceSidebarOptionsHtml,
				syncSidebarWorkspaceSelect,
				workspaceOptionsHtml,
				newThreadWorkspaceOptionsHtml,
				newThreadChoiceOptionsHtml,
				selectedWorkspaceLabel,
				fitWorkspaceMenuToViewport,
				updateWorkspacePath,
				renderWorkspaceTokenUsage,
				tokenBreakdownHtml,
				renderWorkspaceStatsDialog,
				openWorkspaceStatsDialog,
				closeWorkspaceStatsDialog,
				clearCurrentThreadSelection,
				renderThreadListLoading,
				hasThreadDetailSelectionIntent,
				shouldRenderPrimaryConversationShell,
				clearThreadListDeferredFallbackTimer,
				clearThreadListDeferredSilentTimer,
				hasThreadDetailRequestInFlight,
				scheduleThreadListDeferredFallback,
				scheduleThreadListDeferredSilentRefresh,
				loadThreads,
				threadMatchesWorkspaceCwd,
				threadMatchesVisibleWorkspace,
				isHiddenThread,
				visibleThreads,
				pruneHiddenThreads,
				applyThreadStatusToThread,
				scheduleThreadStatusDetailRender,
				updateThreadListStatus,
				localThreadForStatusContext,
				snapshotThreadStatus,
				restoreThreadStatusSnapshot,
				scheduleRenderThreads,
				updateThreadGoalState,
				renderThreads,
				restoreThreadSelection,
				restoreNewThreadDraftSelection,
				selectWorkspaceShortcut
			};
		}
		const api = { createThreadListRuntime };
		if (typeof module === "object" && module.exports) module.exports = api;
		root.CodexThreadListRuntime = api;
	})(typeof globalThis !== "undefined" ? globalThis : window);
}));
//#endregion
//#region public/side-chat-runtime.js
var require_side_chat_runtime = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function attachSideChatRuntime(root) {
		function noop() {}
		function noopFalse() {
			return false;
		}
		function noopString() {
			return "";
		}
		function defaultRequestAnimationFrame(callback) {
			return typeof root.setTimeout === "function" ? root.setTimeout(callback, 16) : 0;
		}
		function createSideChatRuntime(deps = {}) {
			const state = deps.state || {};
			const $ = typeof deps.$ === "function" ? deps.$ : () => null;
			const document = deps.document || root.document || {};
			const window = deps.window || root.window || root;
			const requestAnimationFrame = typeof deps.requestAnimationFrame === "function" ? deps.requestAnimationFrame : typeof root.requestAnimationFrame === "function" ? root.requestAnimationFrame.bind(root) : defaultRequestAnimationFrame;
			const setTimeout = typeof deps.setTimeout === "function" ? deps.setTimeout : typeof root.setTimeout === "function" ? root.setTimeout.bind(root) : () => 0;
			const clearTimeout = typeof deps.clearTimeout === "function" ? deps.clearTimeout : typeof root.clearTimeout === "function" ? root.clearTimeout.bind(root) : noop;
			const SIDE_CHAT_DRAFT_SAVE_DEBOUNCE_MS = Math.max(0, Number(deps.SIDE_CHAT_DRAFT_SAVE_DEBOUNCE_MS || 450) || 450);
			const SIDE_CHAT_DRAFT_MAX_CHARS = Math.max(1, Number(deps.SIDE_CHAT_DRAFT_MAX_CHARS || 8e3) || 8e3);
			const SUBAGENT_EDGE_SWIPE_PX = Math.max(1, Number(deps.SUBAGENT_EDGE_SWIPE_PX || 56) || 56);
			const SUBAGENT_EDGE_SWIPE_MAX_PX = Math.max(SUBAGENT_EDGE_SWIPE_PX, Number(deps.SUBAGENT_EDGE_SWIPE_MAX_PX || 88) || 88);
			const SUBAGENT_EDGE_SWIPE_RATIO = Math.max(0, Number(deps.SUBAGENT_EDGE_SWIPE_RATIO || .08) || .08);
			const SUBAGENT_SWIPE_MIN_PX = Math.max(1, Number(deps.SUBAGENT_SWIPE_MIN_PX || 70) || 70);
			const SUBAGENT_WHEEL_SWIPE_MIN_PX = Math.max(1, Number(deps.SUBAGENT_WHEEL_SWIPE_MIN_PX || 48) || 48);
			const CLIENT_BUILD_ID = String(deps.CLIENT_BUILD_ID || "");
			const { api, collabAgentNameText = noopString, collabAgentTaskText = noopString, collabAgentThreadText = noopString, conversationDomTurnIds = () => [], conversationPatchShellSignature = noopString, conversationRenderSignature = noopString, createSubmissionId = () => "sidechat-" + Date.now(), currentLiveTurn = () => null, diagnosticThreadHash = noopString, escapeHtml = (value) => String(value || ""), escapeSelectorAttr = (value) => String(value || ""), formatTime = noopString, homeAiDiagnosticReportingApi = { boundedToken: (value) => String(value || "") }, isInteractiveGestureTarget = noopFalse, latestTurn = () => null, loadThread = async () => null, loadThreads = async () => null, markActivity = noop, normalizeClientErrorMessage = (value) => String(value || ""), primaryTouch = () => null, renderCurrentThread = noop, requestAppConfirmation = async () => false, scheduleCurrentThreadRefresh = noop, scheduleLivePollIfNeeded = noop, showError = noop, statusText = noopString, truncateMiddle = (value) => String(value || ""), visibleConversationShape = () => ({}) } = deps;
			function isSubagentItem(item) {
				return Boolean(item && item.type === "collabAgentToolCall");
			}
			function turnSubagentItems(turn) {
				return (Array.isArray(turn && turn.items) ? turn.items : []).filter(isSubagentItem);
			}
			function activeSubagentItems(turn) {
				return turnSubagentItems(turn).filter(isActiveSubagentItem);
			}
			function currentSubagentTurn() {
				if (!state.currentThread) return null;
				const live = currentLiveTurn();
				if (turnSubagentItems(live).length) return live;
				const latest = latestTurn();
				return activeSubagentItems(latest).length ? latest : null;
			}
			function currentSubagentItems() {
				const turn = currentSubagentTurn();
				if (turn && currentLiveTurn() === turn) return turnSubagentItems(turn);
				return activeSubagentItems(turn);
			}
			function subagentStatusKind(status) {
				const text = statusText(status).toLowerCase();
				if (/fail|error|denied|reject|cancel|interrupt|stop/.test(text)) return "failed";
				if (/complete|success|succeeded|done|finished|closed/.test(text)) return "completed";
				if (/queue|pending|waiting|wait/.test(text)) return "queued";
				if (/running|active|started|processing|inprogress|in_progress|in-progress|working|open|spawned|starting/.test(text)) return "running";
				return "unknown";
			}
			function isActiveSubagentItem(item) {
				const kind = subagentStatusKind(item && item.status);
				return kind === "running" || kind === "queued";
			}
			function currentSubagentStatusKind(item, turn) {
				const kind = subagentStatusKind(item && item.status);
				if (turn && currentLiveTurn() === turn && (kind === "completed" || kind === "unknown")) return "running";
				return kind;
			}
			function subagentStatusLabel(kind) {
				return {
					running: "运行中",
					queued: "等待",
					completed: "完成",
					failed: "失败",
					unknown: "未知"
				}[kind] || "未知";
			}
			function subagentSwipeAvailable() {
				return Boolean(state.currentThread);
			}
			function sideChatThreadId() {
				return String(state.currentThreadId || state.currentThread && state.currentThread.id || "");
			}
			function defaultSideChatState(threadId) {
				return {
					threadId: String(threadId || ""),
					version: 0,
					messages: [],
					draft: {
						text: "",
						updatedAt: ""
					},
					candidates: [],
					queue: null,
					sidecar: {
						status: "idle",
						pendingUserMessageId: "",
						updatedAt: "",
						error: ""
					},
					audit: {
						createdAt: "",
						updatedAt: ""
					},
					persistence: "server"
				};
			}
			function normalizeSideChatSidecar(input) {
				const source = input && typeof input === "object" ? input : {};
				const status = String(source.status || "idle").toLowerCase();
				return {
					status: [
						"idle",
						"pending",
						"failed"
					].includes(status) ? status : "idle",
					pendingUserMessageId: String(source.pendingUserMessageId || ""),
					updatedAt: String(source.updatedAt || ""),
					error: String(source.error || "")
				};
			}
			function normalizeSideChatState(input, threadId = "") {
				const source = input && typeof input === "object" ? input : {};
				return {
					threadId: String(source.threadId || threadId || ""),
					version: Math.max(0, Number(source.version) || 0),
					messages: Array.isArray(source.messages) ? source.messages.filter(Boolean) : [],
					draft: {
						text: String(source.draft && source.draft.text || ""),
						updatedAt: String(source.draft && source.draft.updatedAt || "")
					},
					candidates: Array.isArray(source.candidates) ? source.candidates.filter(Boolean) : [],
					queue: source.queue && typeof source.queue === "object" ? source.queue : null,
					sidecar: normalizeSideChatSidecar(source.sidecar),
					audit: {
						createdAt: String(source.audit && source.audit.createdAt || ""),
						updatedAt: String(source.audit && source.audit.updatedAt || "")
					},
					persistence: "server"
				};
			}
			function setSideChatState(threadId, sideChat) {
				const id = String(threadId || sideChat && sideChat.threadId || "");
				if (!id) return defaultSideChatState("");
				const normalized = normalizeSideChatState(sideChat, id);
				state.threadSideChats.set(id, normalized);
				return normalized;
			}
			function sideChatStateForThread(threadId = sideChatThreadId()) {
				const id = String(threadId || "");
				if (!id) return defaultSideChatState("");
				return state.threadSideChats.get(id) || defaultSideChatState(id);
			}
			function sideChatApiPath(threadId, suffix = "") {
				return `/api/threads/${encodeURIComponent(threadId)}/side-chat${suffix}`;
			}
			function sideChatDraftTextarea() {
				const panel = $("subagentPanel");
				if (!panel) return null;
				const textarea = panel.querySelector("[data-side-chat-draft]");
				return textarea && textarea.tagName === "TEXTAREA" ? textarea : null;
			}
			function ensureSideChatDraftVisible() {
				const textarea = sideChatDraftTextarea();
				if (!textarea || document.activeElement !== textarea) return;
				const form = textarea.closest("[data-side-chat-form]");
				const panel = $("subagentPanel");
				try {
					if (form) form.scrollIntoView({
						block: "nearest",
						inline: "nearest"
					});
					else textarea.scrollIntoView({
						block: "nearest",
						inline: "nearest"
					});
				} catch (_) {}
				if (!panel || !form) return;
				const panelRect = panel.getBoundingClientRect();
				const formRect = form.getBoundingClientRect();
				const overflow = Math.ceil(formRect.bottom - panelRect.bottom + 8);
				if (overflow > 0) panel.scrollTop = Math.max(0, Number(panel.scrollTop || 0) + overflow);
			}
			function autoSizeSideChatDraftTextarea(textarea = sideChatDraftTextarea()) {
				if (!textarea) return;
				textarea.style.height = "auto";
				const style = window.getComputedStyle ? window.getComputedStyle(textarea) : null;
				const maxHeight = style ? Number.parseFloat(style.maxHeight) : 160;
				const minHeight = style ? Number.parseFloat(style.minHeight) : 44;
				const nextHeight = Math.min(Number.isFinite(maxHeight) && maxHeight > 0 ? maxHeight : 160, Math.max(Number.isFinite(minHeight) && minHeight > 0 ? minHeight : 44, textarea.scrollHeight));
				textarea.style.height = `${nextHeight}px`;
				textarea.style.overflowY = textarea.scrollHeight > nextHeight + 1 ? "auto" : "hidden";
			}
			function sideChatScrollContainer() {
				const panel = $("subagentPanel");
				return panel ? panel.querySelector(".side-chat-scroll") : null;
			}
			function scrollSideChatToBottom() {
				const scroller = sideChatScrollContainer();
				if (!scroller) return false;
				scroller.scrollTop = scroller.scrollHeight;
				return true;
			}
			function scheduleSideChatToBottom() {
				requestAnimationFrame(() => {
					scrollSideChatToBottom();
					requestAnimationFrame(scrollSideChatToBottom);
				});
			}
			function openSideChatCandidate(candidateId = "") {
				const scroller = sideChatScrollContainer();
				if (!scroller) return false;
				const id = String(candidateId || "");
				const target = id ? scroller.querySelector(`[data-side-chat-candidate="${escapeSelectorAttr(id)}"]`) : scroller.querySelector(".side-chat-candidate");
				if (!target) {
					scrollSideChatToBottom();
					return false;
				}
				target.scrollIntoView({
					block: "center",
					inline: "nearest"
				});
				target.classList.add("side-chat-focus");
				setTimeout(() => target.classList.remove("side-chat-focus"), 1200);
				return true;
			}
			function currentSideChatDraftText(threadId = sideChatThreadId()) {
				const textarea = sideChatDraftTextarea();
				if (textarea && String(textarea.dataset.threadId || "") === String(threadId || "")) return textarea.value;
				return sideChatStateForThread(threadId).draft.text || "";
			}
			function truncateSideChatText(text) {
				const value = String(text || "");
				if (value.length <= SIDE_CHAT_DRAFT_MAX_CHARS) return value;
				return value.slice(0, SIDE_CHAT_DRAFT_MAX_CHARS);
			}
			async function loadSideChat(threadId = sideChatThreadId(), options = {}) {
				const id = String(threadId || "");
				if (!id) return null;
				const silent = options.silent === true;
				if (!silent) state.sideChatError = "";
				state.sideChatLoadingThreadId = id;
				if (state.subagentPanelOpen && !silent) updateSubagentPanelUi({ force: true });
				try {
					const result = await api(sideChatApiPath(id), { timeoutMs: 2e4 });
					const sideChat = setSideChatState(id, result && result.sideChat || null);
					if (state.sideChatLoadingThreadId === id) state.sideChatLoadingThreadId = "";
					if (state.sideChatError && sideChatThreadId() === id) state.sideChatError = "";
					if (state.subagentPanelOpen && sideChatThreadId() === id) updateSubagentPanelUi({
						force: true,
						scrollSideChatToBottom: true
					});
					if (sideChatReplyPending(id)) scheduleSideChatPoll(id);
					return sideChat;
				} catch (err) {
					if (state.sideChatLoadingThreadId === id) state.sideChatLoadingThreadId = "";
					if (sideChatThreadId() === id) state.sideChatError = normalizeClientErrorMessage(err && err.message || String(err));
					if (state.subagentPanelOpen && sideChatThreadId() === id) updateSubagentPanelUi({
						force: true,
						scrollSideChatToBottom: true
					});
					throw err;
				}
			}
			function sideChatReplyPending(threadId = sideChatThreadId()) {
				const sideChat = sideChatStateForThread(threadId);
				return String(sideChat.sidecar && sideChat.sidecar.status || "") === "pending";
			}
			function scheduleSideChatPoll(threadId = sideChatThreadId(), delayMs = 1600) {
				const id = String(threadId || "");
				clearTimeout(state.sideChatPollTimer);
				state.sideChatPollTimer = null;
				if (!id || !state.subagentPanelOpen || sideChatThreadId() !== id || !sideChatReplyPending(id)) return;
				state.sideChatPollTimer = setTimeout(() => {
					state.sideChatPollTimer = null;
					loadSideChat(id, { silent: true }).then(() => {
						if (sideChatReplyPending(id)) scheduleSideChatPoll(id, 1800);
					}).catch(() => {
						if (sideChatThreadId() === id) scheduleSideChatPoll(id, 2600);
					});
				}, Math.max(500, Number(delayMs) || 1600));
			}
			async function saveSideChatDraft(threadId, text, options = {}) {
				const id = String(threadId || "");
				if (!id) return null;
				const nextText = truncateSideChatText(text);
				const result = await api(sideChatApiPath(id, "/draft"), {
					method: "PUT",
					body: JSON.stringify({ text: nextText }),
					timeoutMs: 2e4
				});
				const sideChat = setSideChatState(id, result && result.sideChat || null);
				if (state.sideChatError && sideChatThreadId() === id) state.sideChatError = "";
				if (options.render !== false && state.subagentPanelOpen && sideChatThreadId() === id) updateSubagentPanelUi({ force: true });
				return sideChat;
			}
			function scheduleSideChatDraftSave(threadId = sideChatThreadId(), text = currentSideChatDraftText(threadId)) {
				const id = String(threadId || "");
				if (!id) return;
				const sideChat = sideChatStateForThread(id);
				sideChat.draft = Object.assign({}, sideChat.draft || {}, { text: truncateSideChatText(text) });
				state.threadSideChats.set(id, sideChat);
				clearTimeout(state.sideChatDraftSaveTimer);
				const seq = state.sideChatDraftSaveSeq + 1;
				state.sideChatDraftSaveSeq = seq;
				state.sideChatDraftSaveTimer = setTimeout(() => {
					state.sideChatDraftSaveTimer = null;
					saveSideChatDraft(id, sideChatStateForThread(id).draft.text, { render: false }).catch((err) => {
						if (seq !== state.sideChatDraftSaveSeq) return;
						if (sideChatThreadId() === id) {
							state.sideChatError = normalizeClientErrorMessage(err && err.message || String(err));
							updateSubagentPanelUi({ force: true });
						}
					});
				}, SIDE_CHAT_DRAFT_SAVE_DEBOUNCE_MS);
			}
			function flushSideChatDraftNow() {
				const id = sideChatThreadId();
				if (!id) return Promise.resolve(null);
				const text = currentSideChatDraftText(id);
				clearTimeout(state.sideChatDraftSaveTimer);
				state.sideChatDraftSaveTimer = null;
				return saveSideChatDraft(id, text, { render: false }).catch((err) => {
					state.sideChatError = normalizeClientErrorMessage(err && err.message || String(err));
					return null;
				});
			}
			function sideChatStatusLabel(status) {
				return {
					draft: "草稿",
					queued: "已排队",
					applied: "已发送",
					cancelled: "已取消",
					sending: "发送中",
					sent: "已发送",
					failed: "失败"
				}[String(status || "").toLowerCase()] || "草稿";
			}
			function sideChatQueueSummary(queue) {
				if (!queue) return "";
				return `${sideChatStatusLabel(queue.status)} · ${queue.mode === "autoSendWhenIdle" ? "完成后自动发送" : "等待确认"}`;
			}
			function sideChatTimeLabel(value) {
				const text = String(value || "");
				const ms = Date.parse(text);
				if (!Number.isFinite(ms)) return "";
				return formatTime(Math.floor(ms / 1e3), state.nowMs);
			}
			function sideChatBusy(key) {
				return Boolean(key && state.sideChatBusyKey === key);
			}
			function setSideChatNotice(kind, message, options = {}) {
				const threadId = sideChatThreadId();
				state.sideChatNotice = {
					threadId,
					kind: String(kind || "info"),
					message: String(message || ""),
					actionLabel: String(options.actionLabel || ""),
					candidateId: String(options.candidateId || ""),
					createdAtMs: Date.now()
				};
			}
			function clearSideChatNotice() {
				state.sideChatNotice = null;
			}
			function sideChatNoticeForThread(threadId = sideChatThreadId()) {
				const notice = state.sideChatNotice;
				if (!notice || String(notice.threadId || "") !== String(threadId || "")) return null;
				return notice;
			}
			function sideChatPanelRenderSignature() {
				const threadId = sideChatThreadId();
				const sideChat = sideChatStateForThread(threadId);
				const notice = sideChatNoticeForThread(threadId);
				const messages = sideChat.messages.map((message) => [
					message.id,
					message.role,
					String(message.text || "").length,
					message.createdAt
				].join(":")).join(",");
				const candidates = sideChat.candidates.map((candidate) => [
					candidate.id,
					candidate.status,
					candidate.updatedAt,
					String(candidate.body || "").length,
					candidate.appliedTurnId || ""
				].join(":")).join(",");
				const queue = sideChat.queue ? [
					sideChat.queue.candidateId,
					sideChat.queue.mode,
					sideChat.queue.status,
					sideChat.queue.updatedAt,
					String(sideChat.queue.error || "").length
				].join(":") : "";
				const sidecar = sideChat.sidecar ? [
					sideChat.sidecar.status,
					sideChat.sidecar.pendingUserMessageId,
					sideChat.sidecar.updatedAt,
					String(sideChat.sidecar.error || "").length
				].join(":") : "";
				const turn = currentSubagentTurn();
				const subagents = currentSubagentItems().map((item) => [
					item.id || item.itemId || "",
					item.tool || item.name || "",
					statusText(item.status),
					collabAgentThreadText(item),
					String(collabAgentTaskText(item) || "").length
				].join(":")).join(",");
				return [
					threadId,
					state.activeTurnId || "",
					state.sideChatLoadingThreadId === threadId ? "loading" : "",
					state.sideChatError || "",
					state.sideChatBusyKey || "",
					notice ? [
						notice.kind,
						notice.message,
						notice.actionLabel,
						notice.candidateId
					].join(":") : "",
					messages,
					candidates,
					queue,
					sidecar,
					turn && turn.id || "",
					subagents
				].join("|");
			}
			function renderSideChatNotice(threadId = sideChatThreadId()) {
				const notice = sideChatNoticeForThread(threadId);
				if (!notice || !notice.message) return "";
				const action = notice.actionLabel ? `<button type="button" data-side-chat-action="open-notice" data-candidate-id="${escapeHtml(notice.candidateId || "")}">${escapeHtml(notice.actionLabel)}</button>` : "";
				return `<div class="side-chat-notice ${escapeHtml(notice.kind || "info")}">
    <span>${escapeHtml(notice.message)}</span>
    <span class="side-chat-notice-actions">${action}<button type="button" data-side-chat-action="dismiss-notice" aria-label="关闭提示">×</button></span>
  </div>`;
			}
			function renderSubagentStatusWindow() {
				const turn = currentSubagentTurn();
				const items = currentSubagentItems();
				if (!items.length) return "";
				const rows = items.map((item, index) => {
					const kind = currentSubagentStatusKind(item, turn);
					const label = collabAgentNameText(item) || collabAgentThreadText(item) || (item.tool === "spawnAgent" ? "Subagent" : item.tool || item.name || `Subagent ${index + 1}`);
					const task = collabAgentTaskText(item);
					const thread = collabAgentThreadText(item);
					const meta = [
						subagentStatusLabel(kind),
						thread ? truncateMiddle(thread, 32, "thread") : "",
						item.tool && item.tool !== "collabAgentToolCall" ? item.tool : ""
					].filter(Boolean).join(" | ");
					return `<article class="subagent-status-row ${escapeHtml(kind)}">
      <div class="subagent-status-main">
        <div class="subagent-status-title"><span class="subagent-status-dot ${escapeHtml(kind)}"></span>${escapeHtml(label)}</div>
        ${task ? `<div class="subagent-status-task">${escapeHtml(truncateMiddle(task, 180, "task"))}</div>` : ""}
      </div>
      <div class="subagent-status-meta">${escapeHtml(meta)}</div>
    </article>`;
				}).join("");
				return `<section class="subagent-status-window" aria-label="Subagent 状态">
    <div class="subagent-status-header">
      <div>
        <div class="subagent-status-heading">Subagent 状态</div>
        <div class="subagent-status-summary">当前进行中 · ${items.length.toLocaleString()} 个</div>
      </div>
      <button class="subagent-window-close" type="button" data-subagent-panel-close aria-label="关闭 Subagent 状态">×</button>
    </div>
    <div class="subagent-status-list">${rows}</div>
  </section>`;
			}
			function latestAssistantSideChatMessageIndex(sideChat) {
				const messages = Array.isArray(sideChat && sideChat.messages) ? sideChat.messages : [];
				for (let index = messages.length - 1; index >= 0; index -= 1) if (String(messages[index] && messages[index].role || "").toLowerCase() === "assistant") return index;
				return -1;
			}
			function renderSideChatMessage(message, index, sideChat) {
				const role = String(message && message.role || "user").toLowerCase();
				const text = String(message && message.text || "");
				const time = sideChatTimeLabel(message && message.createdAt);
				const latestAssistant = role === "assistant" && index === latestAssistantSideChatMessageIndex(sideChat);
				const running = Boolean(state.activeTurnId);
				const busy = sideChatBusy(`message:${index}`) || sideChatBusy(`message-candidate:${index}`);
				const actions = latestAssistant && text.trim() ? `<div class="side-chat-message-actions">
        <button type="button" data-side-chat-action="message-apply" data-message-index="${index}"${busy ? " disabled" : ""}>发送主线程</button>
        <button type="button" data-side-chat-action="message-queue" data-message-index="${index}"${busy ? " disabled" : ""}>${running ? "完成后发送" : "排队"}</button>
        <button type="button" data-side-chat-action="message-candidate" data-message-index="${index}"${busy ? " disabled" : ""}>存为候选</button>
      </div>` : "";
				return `<article class="side-chat-message ${escapeHtml(role)}">
    <div class="side-chat-message-meta">
      <span>${escapeHtml(role === "assistant" ? "侧聊" : "我")}</span>
      ${time ? `<time>${escapeHtml(time)}</time>` : ""}
    </div>
    <div class="side-chat-message-text">${escapeHtml(text)}</div>
    ${actions}
  </article>`;
			}
			function renderSideChatCandidate(candidate, sideChat) {
				const id = String(candidate && candidate.id || "");
				const status = String(candidate && candidate.status || "draft").toLowerCase();
				const body = String(candidate && candidate.body || "");
				const queue = sideChat.queue && sideChat.queue.candidateId === id ? sideChat.queue : null;
				const busy = sideChatBusy(`candidate:${id}`) || sideChatBusy(`apply:${id}`) || sideChatBusy(`queue:${id}`) || sideChatBusy(`cancel:${id}`);
				const running = Boolean(state.activeTurnId);
				const canApply = (status === "draft" || status === "queued") && !running;
				const canQueue = status === "draft";
				const canCancel = status === "draft" || status === "queued";
				const appliedTurn = String(candidate && candidate.appliedTurnId || "");
				const queueSummary = queue ? sideChatQueueSummary(queue) : sideChatStatusLabel(status);
				const error = queue && queue.status === "failed" && queue.error ? `<div class="side-chat-candidate-error">${escapeHtml(queue.error)}</div>` : "";
				return `<article class="side-chat-candidate ${escapeHtml(status)}" data-side-chat-candidate="${escapeHtml(id)}">
    <div class="side-chat-candidate-main">
      <div class="side-chat-candidate-title">${escapeHtml(candidate && candidate.title || "候选指令")}</div>
      <div class="side-chat-candidate-status">${escapeHtml(queueSummary)}${appliedTurn ? ` · ${escapeHtml(truncateMiddle(appliedTurn, 24, "turn"))}` : ""}</div>
      <div class="side-chat-candidate-body">${escapeHtml(truncateMiddle(body, 420, "candidate"))}</div>
      ${error}
    </div>
    <div class="side-chat-candidate-actions">
      ${canApply ? `<button type="button" data-side-chat-action="apply" data-candidate-id="${escapeHtml(id)}"${busy ? " disabled" : ""}>发送主线程</button>` : ""}
      ${running && status === "draft" ? `<button type="button" data-side-chat-action="queue" data-candidate-id="${escapeHtml(id)}"${busy ? " disabled" : ""}>完成后发送</button>` : ""}
      ${!running && canQueue && status !== "queued" ? `<button type="button" data-side-chat-action="queue" data-candidate-id="${escapeHtml(id)}"${busy ? " disabled" : ""}>排队</button>` : ""}
      ${canCancel ? `<button type="button" data-side-chat-action="cancel" data-candidate-id="${escapeHtml(id)}"${busy ? " disabled" : ""}>取消</button>` : ""}
    </div>
  </article>`;
			}
			function renderSideChatPanel() {
				const threadId = sideChatThreadId();
				const sideChat = sideChatStateForThread(threadId);
				const loading = state.sideChatLoadingThreadId === threadId;
				const messages = sideChat.messages.map((message, index) => renderSideChatMessage(message, index, sideChat)).join("");
				const candidates = sideChat.candidates.slice().reverse().map((candidate) => renderSideChatCandidate(candidate, sideChat)).join("");
				const queue = sideChat.queue && sideChat.queue.status !== "sent" && sideChat.queue.status !== "cancelled" ? `<div class="side-chat-queue ${escapeHtml(sideChat.queue.status || "queued")}">${escapeHtml(sideChatQueueSummary(sideChat.queue))}</div>` : "";
				const sidecar = normalizeSideChatSidecar(sideChat.sidecar);
				const replyStatus = sidecar.status === "pending" ? `<div class="side-chat-queue pending">侧聊正在回复...</div>` : sidecar.status === "failed" && sidecar.error ? `<div class="side-chat-error">侧聊回复失败：${escapeHtml(sidecar.error)}</div>` : "";
				const error = state.sideChatError ? `<div class="side-chat-error">${escapeHtml(state.sideChatError)}</div>` : "";
				const notice = renderSideChatNotice(threadId);
				const transcript = `${messages}${sidecar.status === "pending" ? `<article class="side-chat-message assistant pending">
    <div class="side-chat-message-meta"><span>侧聊</span></div>
    <div class="side-chat-message-text">正在整理回复...</div>
  </article>` : ""}` || `<div class="side-chat-empty">暂无侧聊内容。</div>`;
				const candidateList = candidates ? `<div class="side-chat-candidates">${candidates}</div>` : "";
				const draftText = sideChat.draft && sideChat.draft.text || "";
				const draftEmpty = !String(draftText || "").trim();
				const busy = Boolean(state.sideChatBusyKey);
				const loadingLabel = loading ? `<span class="side-chat-saving">同步中</span>` : "";
				const clearDisabled = busy || !sideChat.messages.length && !sideChat.candidates.length && draftEmpty;
				return `<section class="side-chat-section" aria-label="侧边聊天">
    <div class="side-chat-header">
      <div>
        <div class="side-chat-heading">侧边聊天</div>
        <div class="side-chat-summary">服务器保存 · ${sideChat.messages.length.toLocaleString()} 条</div>
      </div>
      ${loadingLabel}
      <button class="side-chat-clear side-chat-header-clear" type="button" data-side-chat-action="clear" aria-label="清空侧聊"${clearDisabled ? " disabled" : ""}>清空</button>
      <button class="subagent-window-close side-chat-close" type="button" data-subagent-panel-close aria-label="关闭侧边聊天">×</button>
    </div>
    ${queue}
    ${replyStatus}
    ${error}
    ${notice}
    <div class="side-chat-scroll">
      <div class="side-chat-transcript">${transcript}</div>
      ${candidateList}
    </div>
    <form class="side-chat-form" data-side-chat-form>
      <div class="side-chat-composer-row">
        <button class="side-chat-tool-button" type="button" data-side-chat-action="tools" aria-label="侧聊工具">+</button>
        <textarea data-side-chat-draft data-thread-id="${escapeHtml(threadId)}" rows="1" maxlength="${SIDE_CHAT_DRAFT_MAX_CHARS}" placeholder="整理想法，不进入主线程">${escapeHtml(draftText)}</textarea>
        <button class="side-chat-send" type="submit" data-side-chat-action="message"${busy || draftEmpty ? " disabled" : ""}>Send</button>
      </div>
      <div class="side-chat-tool-row" hidden>
        <button type="button" data-side-chat-action="candidate"${busy || draftEmpty ? " disabled" : ""}>存为候选</button>
      </div>
    </form>
  </section>`;
			}
			function renderSubagentPanel() {
				const subagentWindow = renderSubagentStatusWindow();
				return `<div class="thread-side-panel${subagentWindow ? "" : " no-subagents"}">
    ${subagentWindow}
    ${renderSideChatPanel()}
  </div>`;
			}
			function updateSubagentPanelUi(options = {}) {
				const panel = $("subagentPanel");
				if (!panel) return;
				if (!state.subagentPanelOpen || !subagentSwipeAvailable()) {
					state.subagentPanelOpen = false;
					panel.classList.add("hidden");
					panel.innerHTML = "";
					panel.dataset.renderSignature = "";
					state.sideChatRenderSignature = "";
					clearTimeout(state.sideChatPollTimer);
					state.sideChatPollTimer = null;
					return;
				}
				const signature = sideChatPanelRenderSignature();
				if (options.force !== true && panel.dataset.renderSignature === signature) return;
				panel.classList.remove("hidden");
				panel.innerHTML = renderSubagentPanel();
				panel.dataset.renderSignature = signature;
				state.sideChatRenderSignature = signature;
				panel.querySelectorAll("[data-subagent-panel-close]").forEach((button) => {
					button.addEventListener("click", () => {
						state.subagentPanelOpen = false;
						updateSubagentPanelUi();
					});
				});
				const form = panel.querySelector("[data-side-chat-form]");
				if (form) form.addEventListener("submit", submitSideChatMessage);
				const textarea = sideChatDraftTextarea();
				if (textarea) {
					textarea.addEventListener("input", handleSideChatDraftInput);
					textarea.addEventListener("focus", () => requestAnimationFrame(ensureSideChatDraftVisible));
					autoSizeSideChatDraftTextarea(textarea);
					requestAnimationFrame(() => autoSizeSideChatDraftTextarea(textarea));
				}
				panel.querySelectorAll("[data-side-chat-action]").forEach((button) => {
					if (button.closest("[data-side-chat-form]") && button.type === "submit") return;
					button.addEventListener("click", handleSideChatActionClick);
				});
				if (options.scrollSideChatToBottom) scheduleSideChatToBottom();
			}
			function visualHarnessThreadShape(thread) {
				const shape = visibleConversationShape(thread);
				const itemCount = (Array.isArray(thread && thread.turns) ? thread.turns : []).reduce((total, turn) => total + (Array.isArray(turn && turn.items) ? turn.items.length : 0), 0);
				return {
					visibleTurnCount: Number(shape.visibleTurnCount || 0),
					visibleItemCount: Number(shape.visibleItemCount || 0),
					itemCount,
					detailLoaded: Boolean(thread && thread.mobileDetailLoaded),
					loading: Boolean(thread && thread.mobileLoading),
					loadError: Boolean(thread && thread.mobileLoadError),
					readMode: homeAiDiagnosticReportingApi.boundedToken(thread && thread.mobileReadMode || "", "", 80)
				};
			}
			async function simulateEmptyCachedDetailOpenForHarness(threadId) {
				const id = String(threadId || state.currentThreadId || "").trim();
				const threadHash = diagnosticThreadHash(id);
				const before = {
					visibleTurnCount: 0,
					visibleItemCount: 0,
					itemCount: 0,
					detailLoaded: true,
					loading: false,
					loadError: false,
					readMode: "visual-harness-empty-cache"
				};
				if (!id) return {
					ok: false,
					error: "missing_thread_id",
					clientBuildId: CLIENT_BUILD_ID,
					thread_hash: "",
					before,
					after: null
				};
				state.currentThreadId = id;
				state.currentThread = {
					id,
					turns: [],
					mobileDetailLoaded: true,
					mobileLoading: false,
					mobileLoadError: "",
					mobileReadMode: "visual-harness-empty-cache"
				};
				await loadThread(id, { source: "visual-harness-empty-cache" });
				const after = visualHarnessThreadShape(state.currentThread);
				return {
					ok: Boolean(after.visibleTurnCount || after.visibleItemCount),
					error: after.loadError ? "thread_detail_load_error" : "",
					clientBuildId: CLIENT_BUILD_ID,
					thread_hash: threadHash,
					before,
					after
				};
			}
			async function simulateStableSignatureEmptyDomForHarness(threadId) {
				const id = String(threadId || state.currentThreadId || "").trim();
				const threadHash = diagnosticThreadHash(id);
				if (!id) return {
					ok: false,
					error: "missing_thread_id",
					clientBuildId: CLIENT_BUILD_ID,
					thread_hash: "",
					before: null,
					after: null,
					domBefore: null,
					domAfter: null
				};
				await loadThread(id, { source: "visual-harness-stable-signature-seed" });
				const before = visualHarnessThreadShape(state.currentThread);
				const signature = conversationRenderSignature(state.currentThread);
				const patchShellSignature = conversationPatchShellSignature(state.currentThread);
				const conversation = $("conversation");
				const domBefore = {
					turnCount: conversationDomTurnIds(conversation).length,
					itemCount: conversation ? conversation.querySelectorAll(".item[data-item]").length : 0
				};
				state.renderedConversationSignature = signature;
				state.renderedConversationPatchShellSignature = patchShellSignature;
				if (conversation) conversation.innerHTML = "<div class=\"empty-state\">No visible turns.</div>";
				renderCurrentThread({
					stickToBottom: true,
					source: "visual-harness-stable-signature-empty-dom"
				});
				const afterConversation = $("conversation");
				const hasEmptyState = afterConversation ? Boolean(afterConversation.querySelector(".empty-state")) : false;
				const domAfter = {
					turnCount: conversationDomTurnIds(afterConversation).length,
					itemCount: afterConversation ? afterConversation.querySelectorAll(".item[data-item]").length : 0,
					emptyState: hasEmptyState ? "empty-state" : ""
				};
				const after = visualHarnessThreadShape(state.currentThread);
				return {
					ok: Boolean(before.visibleTurnCount && after.visibleTurnCount && domAfter.turnCount > 0 && !hasEmptyState),
					error: after.loadError ? "thread_detail_load_error" : "",
					clientBuildId: CLIENT_BUILD_ID,
					thread_hash: threadHash,
					before,
					after,
					domBefore,
					domAfter
				};
			}
			function refreshSideChatFormButtons() {
				const textarea = sideChatDraftTextarea();
				if (!textarea) return;
				const form = textarea.closest("[data-side-chat-form]");
				if (!form) return;
				const panel = $("subagentPanel");
				const sideChat = sideChatStateForThread(String(textarea.dataset.threadId || sideChatThreadId()));
				const draftEmpty = !textarea.value.trim();
				form.querySelectorAll("[data-side-chat-action='message'], [data-side-chat-action='candidate']").forEach((button) => {
					button.disabled = Boolean(state.sideChatBusyKey) || draftEmpty;
				});
				if (panel) panel.querySelectorAll("[data-side-chat-action='clear']").forEach((button) => {
					button.disabled = Boolean(state.sideChatBusyKey) || draftEmpty && !sideChat.messages.length && !sideChat.candidates.length;
				});
			}
			function setSideChatBusy(key) {
				state.sideChatBusyKey = String(key || "");
				updateSubagentPanelUi({ force: true });
			}
			function applySideChatResult(threadId, result) {
				if (result && result.state) return setSideChatState(threadId, result.state);
				if (result && result.sideChat) return setSideChatState(threadId, result.sideChat);
				return sideChatStateForThread(threadId);
			}
			function handleSideChatDraftInput(event) {
				const textarea = event && event.currentTarget;
				if (!textarea) return;
				const threadId = String(textarea.dataset.threadId || sideChatThreadId());
				const text = truncateSideChatText(textarea.value);
				if (text !== textarea.value) textarea.value = text;
				autoSizeSideChatDraftTextarea(textarea);
				scheduleSideChatDraftSave(threadId, text);
				refreshSideChatFormButtons();
				ensureSideChatDraftVisible();
			}
			function installCodexMobileVisualHarnessFacade() {
				if (!isHermesEmbedMode() || window.__codexMobileVisualHarness) return;
				Object.defineProperty(window, "__codexMobileVisualHarness", {
					configurable: false,
					enumerable: false,
					value: Object.freeze({
						clientBuildId: () => CLIENT_BUILD_ID,
						currentThreadId: () => String(state.currentThreadId || ""),
						hostViewport: () => state.pluginHostViewport || null,
						sideChatPanelOpen: () => Boolean(state.subagentPanelOpen),
						setSideChatPanelOpen: (open) => {
							state.subagentPanelOpen = Boolean(open);
							updateSubagentPanelUi({
								force: true,
								scrollSideChatToBottom: Boolean(open)
							});
							return Boolean(state.subagentPanelOpen);
						},
						openThread: (threadId) => loadThread(String(threadId || ""), { source: "visual-harness" }),
						simulateEmptyCachedDetailOpen: (threadId) => simulateEmptyCachedDetailOpenForHarness(threadId),
						simulateStableSignatureEmptyDom: (threadId) => simulateStableSignatureEmptyDomForHarness(threadId),
						loadSideChat: (threadId) => loadSideChat(String(threadId || sideChatThreadId()), { silent: true }),
						ensureSideChatDraftVisible,
						autoSizeSideChatDraftTextarea
					})
				});
			}
			async function submitSideChatMessage(event) {
				if (event && typeof event.preventDefault === "function") event.preventDefault();
				const threadId = sideChatThreadId();
				const text = currentSideChatDraftText(threadId).trim();
				if (!threadId || !text || state.sideChatBusyKey) return;
				setSideChatBusy("message");
				try {
					clearTimeout(state.sideChatDraftSaveTimer);
					state.sideChatDraftSaveTimer = null;
					applySideChatResult(threadId, await api(sideChatApiPath(threadId, "/messages"), {
						method: "POST",
						body: JSON.stringify({
							role: "user",
							text,
							idempotencyKey: createSubmissionId()
						}),
						timeoutMs: 2e4
					}));
					state.sideChatError = "";
					if (sideChatReplyPending(threadId)) scheduleSideChatPoll(threadId, 900);
					markActivity("侧聊已发送");
				} catch (err) {
					state.sideChatError = normalizeClientErrorMessage(err && err.message || String(err));
					showError(err);
				} finally {
					setSideChatBusy("");
					updateSubagentPanelUi({
						force: true,
						scrollSideChatToBottom: true
					});
				}
			}
			async function createSideChatCandidateFromText(text, options = {}) {
				const threadId = sideChatThreadId();
				const body = String(text || "").trim();
				if (!threadId || !body || state.sideChatBusyKey) return null;
				setSideChatBusy(options.busyKey || "candidate");
				try {
					clearTimeout(state.sideChatDraftSaveTimer);
					state.sideChatDraftSaveTimer = null;
					const sideChat = applySideChatResult(threadId, await api(sideChatApiPath(threadId, "/candidates"), {
						method: "POST",
						body: JSON.stringify({
							body,
							idempotencyKey: createSubmissionId()
						}),
						timeoutMs: 2e4
					}));
					if (options.clearDraft) await saveSideChatDraft(threadId, "", { render: false });
					state.sideChatError = "";
					markActivity("候选已保存");
					const candidates = Array.isArray(sideChat && sideChat.candidates) ? sideChat.candidates : [];
					const candidate = candidates[candidates.length - 1] || null;
					if (candidate && candidate.id) setSideChatNotice("success", "候选已保存，可以稍后发送到主线程。", {
						actionLabel: "打开候选",
						candidateId: candidate.id
					});
					return candidate;
				} catch (err) {
					state.sideChatError = normalizeClientErrorMessage(err && err.message || String(err));
					showError(err);
					return null;
				} finally {
					setSideChatBusy("");
					updateSubagentPanelUi({
						force: true,
						scrollSideChatToBottom: true
					});
				}
			}
			async function createSideChatCandidateFromDraft() {
				const threadId = sideChatThreadId();
				const text = currentSideChatDraftText(threadId).trim();
				if (!threadId || !text || state.sideChatBusyKey) return;
				await createSideChatCandidateFromText(text, {
					clearDraft: true,
					busyKey: "candidate"
				});
			}
			function sideChatMessageTextByIndex(index) {
				const message = sideChatStateForThread(sideChatThreadId()).messages[Number(index)];
				return String(message && message.text || "").trim();
			}
			async function createSideChatCandidateFromMessage(index, nextAction = "") {
				const text = sideChatMessageTextByIndex(index);
				if (!text || state.sideChatBusyKey) return;
				const candidate = await createSideChatCandidateFromText(text, { busyKey: `message-candidate:${index}` });
				const id = String(candidate && candidate.id || "");
				if (!id) return;
				if (nextAction === "apply") await applySideChatCandidate(id);
				else if (nextAction === "queue") await queueSideChatCandidate(id, state.activeTurnId ? "autoSendWhenIdle" : "confirmWhenIdle");
			}
			async function queueSideChatCandidate(candidateId, mode = "autoSendWhenIdle") {
				const threadId = sideChatThreadId();
				const id = String(candidateId || "");
				if (!threadId || !id || state.sideChatBusyKey) return;
				setSideChatBusy(`queue:${id}`);
				try {
					applySideChatResult(threadId, await api(sideChatApiPath(threadId, `/candidates/${encodeURIComponent(id)}/queue`), {
						method: "POST",
						body: JSON.stringify({
							mode,
							idempotencyKey: `sidechat:${threadId}:${id}:${mode}`
						}),
						timeoutMs: 2e4
					}));
					state.sideChatError = "";
					setSideChatNotice("success", mode === "autoSendWhenIdle" ? "已排队，当前任务完成后会发送到主线程。" : "候选已排队，空闲后可从队列继续。", {
						actionLabel: "打开队列",
						candidateId: id
					});
					markActivity(mode === "autoSendWhenIdle" ? "侧聊已排队" : "候选已排队");
				} catch (err) {
					state.sideChatError = normalizeClientErrorMessage(err && err.message || String(err));
					showError(err);
				} finally {
					setSideChatBusy("");
					updateSubagentPanelUi({
						force: true,
						scrollSideChatToBottom: true
					});
				}
			}
			async function applySideChatCandidate(candidateId) {
				const threadId = sideChatThreadId();
				const id = String(candidateId || "");
				if (!threadId || !id || state.sideChatBusyKey) return;
				if (state.activeTurnId) {
					await queueSideChatCandidate(id, "autoSendWhenIdle");
					return;
				}
				setSideChatBusy(`apply:${id}`);
				try {
					applySideChatResult(threadId, await api(sideChatApiPath(threadId, `/candidates/${encodeURIComponent(id)}/apply`), {
						method: "POST",
						body: JSON.stringify({
							mode: "confirmWhenIdle",
							idempotencyKey: `sidechat:${threadId}:${id}:apply`
						}),
						timeoutMs: 18e4
					}));
					state.sideChatError = "";
					clearSideChatNotice();
					markActivity("侧聊已发送");
					scheduleCurrentThreadRefresh(600);
					scheduleLivePollIfNeeded(1200);
					loadThreads({ silent: true }).catch(showError);
				} catch (err) {
					state.sideChatError = normalizeClientErrorMessage(err && err.message || String(err));
					showError(err);
				} finally {
					setSideChatBusy("");
					updateSubagentPanelUi({ force: true });
				}
			}
			async function cancelSideChatCandidate(candidateId) {
				const threadId = sideChatThreadId();
				const id = String(candidateId || "");
				if (!threadId || !id || state.sideChatBusyKey) return;
				setSideChatBusy(`cancel:${id}`);
				try {
					applySideChatResult(threadId, await api(sideChatApiPath(threadId, `/candidates/${encodeURIComponent(id)}/cancel`), {
						method: "POST",
						body: JSON.stringify({}),
						timeoutMs: 2e4
					}));
					state.sideChatError = "";
					clearSideChatNotice();
				} catch (err) {
					state.sideChatError = normalizeClientErrorMessage(err && err.message || String(err));
					showError(err);
				} finally {
					setSideChatBusy("");
					updateSubagentPanelUi({ force: true });
				}
			}
			async function clearSideChat() {
				const threadId = sideChatThreadId();
				if (!threadId || state.sideChatBusyKey) return;
				if (!await requestAppConfirmation("清空这个线程的侧聊内容？", {
					title: "清空侧聊",
					confirmLabel: "清空",
					cancelLabel: "取消"
				})) return;
				setSideChatBusy("clear");
				try {
					clearTimeout(state.sideChatDraftSaveTimer);
					state.sideChatDraftSaveTimer = null;
					applySideChatResult(threadId, await api(sideChatApiPath(threadId, "/clear"), {
						method: "POST",
						body: JSON.stringify({}),
						timeoutMs: 2e4
					}));
					state.sideChatError = "";
					clearSideChatNotice();
				} catch (err) {
					state.sideChatError = normalizeClientErrorMessage(err && err.message || String(err));
					showError(err);
				} finally {
					setSideChatBusy("");
					updateSubagentPanelUi({ force: true });
				}
			}
			function handleSideChatActionClick(event) {
				const button = event && event.currentTarget || event && event.target && event.target.closest("[data-side-chat-action]");
				if (!button) return;
				const action = String(button.dataset.sideChatAction || "");
				const candidateId = String(button.dataset.candidateId || "");
				const messageIndex = String(button.dataset.messageIndex || "");
				if (action === "candidate") createSideChatCandidateFromDraft();
				else if (action === "tools") {
					const row = button.closest("[data-side-chat-form]") && button.closest("[data-side-chat-form]").querySelector(".side-chat-tool-row");
					if (row) row.hidden = !row.hidden;
				} else if (action === "message-candidate") createSideChatCandidateFromMessage(messageIndex);
				else if (action === "message-apply") createSideChatCandidateFromMessage(messageIndex, "apply");
				else if (action === "message-queue") createSideChatCandidateFromMessage(messageIndex, "queue");
				else if (action === "apply") applySideChatCandidate(candidateId);
				else if (action === "queue") queueSideChatCandidate(candidateId, state.activeTurnId ? "autoSendWhenIdle" : "confirmWhenIdle");
				else if (action === "cancel") cancelSideChatCandidate(candidateId);
				else if (action === "clear") clearSideChat();
				else if (action === "open-notice") openSideChatCandidate(candidateId);
				else if (action === "dismiss-notice") {
					clearSideChatNotice();
					updateSubagentPanelUi({ force: true });
				}
			}
			function openSubagentPanelFromGesture() {
				if (!state.currentThread) return;
				state.subagentPanelOpen = true;
				updateSubagentPanelUi({
					force: true,
					scrollSideChatToBottom: true
				});
				if (!state.threadSideChats.has(sideChatThreadId())) loadSideChat(sideChatThreadId(), { silent: true }).catch(showError);
			}
			function isHorizontalScrollableGestureTarget(target) {
				return Boolean(target && target.closest && target.closest(".markdown-mermaid-viewer, .markdown-mermaid-canvas, .markdown-mermaid-artboard, .markdown-table-wrap, .markdown-code-table-preview, .markdown-code-block pre"));
			}
			function subagentSwipeEdgeLimitPx() {
				const viewportWidth = Math.max(0, window.innerWidth || document.documentElement.clientWidth || 0);
				if (!viewportWidth) return SUBAGENT_EDGE_SWIPE_PX;
				const responsiveLimit = Math.round(viewportWidth * SUBAGENT_EDGE_SWIPE_RATIO);
				return Math.min(SUBAGENT_EDGE_SWIPE_MAX_PX, Math.max(SUBAGENT_EDGE_SWIPE_PX, responsiveLimit));
			}
			function subagentSwipeStartsNearEdge(clientX) {
				const x = Number(clientX);
				const viewportWidth = Math.max(0, window.innerWidth || document.documentElement.clientWidth || 0);
				if (!Number.isFinite(x) || !viewportWidth) return false;
				return viewportWidth - x <= subagentSwipeEdgeLimitPx();
			}
			function beginSubagentSwipe(event) {
				if (!subagentSwipeAvailable()) return;
				if (event.touches && event.touches.length > 1) return;
				if (isInteractiveGestureTarget(event.target)) return;
				if (isHorizontalScrollableGestureTarget(event.target)) return;
				const touch = primaryTouch(event);
				if (!touch) return;
				if (!subagentSwipeStartsNearEdge(touch.clientX)) return;
				state.subagentSwipe = {
					startX: touch.clientX,
					startY: touch.clientY,
					currentX: touch.clientX,
					currentY: touch.clientY,
					moved: false
				};
			}
			function moveSubagentSwipe(event) {
				const swipe = state.subagentSwipe;
				if (!swipe) return;
				const touch = primaryTouch(event);
				if (!touch) return;
				const dx = touch.clientX - swipe.startX;
				const dy = touch.clientY - swipe.startY;
				if (!swipe.moved) {
					if (Math.abs(dx) < 10 && Math.abs(dy) < 12) return;
					if (dx >= 0 || Math.abs(dy) > Math.abs(dx)) {
						cancelSubagentSwipe();
						return;
					}
				}
				swipe.moved = true;
				swipe.currentX = touch.clientX;
				swipe.currentY = touch.clientY;
				if (event.cancelable !== false) event.preventDefault();
			}
			function finishSubagentSwipe() {
				const swipe = state.subagentSwipe;
				state.subagentSwipe = null;
				if (!swipe || !swipe.moved) return;
				const dx = Number(swipe.currentX || swipe.startX) - swipe.startX;
				const dy = Number(swipe.currentY || swipe.startY) - swipe.startY;
				if (dx <= -SUBAGENT_SWIPE_MIN_PX && Math.abs(dy) <= Math.abs(dx) * .85) openSubagentPanelFromGesture();
			}
			function cancelSubagentSwipe() {
				state.subagentSwipe = null;
			}
			function handleSubagentWheelSwipe(event) {
				if (state.subagentPanelOpen || !subagentSwipeAvailable()) return;
				if (isHorizontalScrollableGestureTarget(event.target)) return;
				if (!subagentSwipeStartsNearEdge(event.clientX)) return;
				const dx = Number(event.deltaX || 0);
				const dy = Number(event.deltaY || 0);
				if (dx >= SUBAGENT_WHEEL_SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy) * 1.2) openSubagentPanelFromGesture();
			}
			return Object.freeze({
				isSubagentItem,
				turnSubagentItems,
				activeSubagentItems,
				currentSubagentTurn,
				currentSubagentItems,
				subagentStatusKind,
				isActiveSubagentItem,
				currentSubagentStatusKind,
				subagentStatusLabel,
				subagentSwipeAvailable,
				sideChatThreadId,
				defaultSideChatState,
				normalizeSideChatSidecar,
				normalizeSideChatState,
				setSideChatState,
				sideChatStateForThread,
				sideChatApiPath,
				sideChatDraftTextarea,
				ensureSideChatDraftVisible,
				autoSizeSideChatDraftTextarea,
				sideChatScrollContainer,
				scrollSideChatToBottom,
				scheduleSideChatToBottom,
				openSideChatCandidate,
				currentSideChatDraftText,
				truncateSideChatText,
				loadSideChat,
				sideChatReplyPending,
				scheduleSideChatPoll,
				saveSideChatDraft,
				scheduleSideChatDraftSave,
				flushSideChatDraftNow,
				sideChatStatusLabel,
				sideChatQueueSummary,
				sideChatTimeLabel,
				sideChatBusy,
				setSideChatNotice,
				clearSideChatNotice,
				sideChatNoticeForThread,
				sideChatPanelRenderSignature,
				renderSideChatNotice,
				renderSubagentStatusWindow,
				latestAssistantSideChatMessageIndex,
				renderSideChatMessage,
				renderSideChatCandidate,
				renderSideChatPanel,
				renderSubagentPanel,
				updateSubagentPanelUi,
				visualHarnessThreadShape,
				simulateEmptyCachedDetailOpenForHarness,
				simulateStableSignatureEmptyDomForHarness,
				refreshSideChatFormButtons,
				setSideChatBusy,
				applySideChatResult,
				handleSideChatDraftInput,
				installCodexMobileVisualHarnessFacade,
				submitSideChatMessage,
				createSideChatCandidateFromText,
				createSideChatCandidateFromDraft,
				sideChatMessageTextByIndex,
				createSideChatCandidateFromMessage,
				queueSideChatCandidate,
				applySideChatCandidate,
				cancelSideChatCandidate,
				clearSideChat,
				handleSideChatActionClick,
				openSubagentPanelFromGesture,
				isHorizontalScrollableGestureTarget,
				subagentSwipeEdgeLimitPx,
				subagentSwipeStartsNearEdge,
				beginSubagentSwipe,
				moveSubagentSwipe,
				finishSubagentSwipe,
				cancelSubagentSwipe,
				handleSubagentWheelSwipe
			});
		}
		root.CodexSideChatRuntime = Object.freeze({ createSideChatRuntime });
		if (typeof module !== "undefined" && module.exports) module.exports = { createSideChatRuntime };
	})(typeof window !== "undefined" ? window : globalThis);
}));
//#endregion
//#region public/thread-list-load-policy.js
var require_thread_list_load_policy = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexThreadListLoadPolicy = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		function bool(value) {
			return value === true;
		}
		function text(value) {
			return String(value || "").trim();
		}
		function planThreadListLoadRequest(input = {}) {
			const silent = bool(input.silent);
			const selectedCwd = text(input.selectedCwd);
			const search = text(input.search);
			const threadDetailOpening = bool(input.threadDetailOpening);
			const documentHidden = bool(input.documentHidden);
			const allowDuringDetail = bool(input.allowDuringDetail);
			const allowHidden = bool(input.allowHidden);
			const hasLoadedList = Number(input.threadListLoadedAtMs || 0) > 0;
			const deferFallback = input.deferFallback;
			const suppressHiddenSilent = silent && documentHidden && !allowHidden;
			const suppressDetailSilent = silent && threadDetailOpening && !allowDuringDetail;
			const allowWarmFallbackInitial = deferFallback !== false && !selectedCwd && !search;
			const shouldDeferFallback = deferFallback === true || silent && deferFallback !== false && threadDetailOpening && !selectedCwd && !search;
			const shouldUseWarmFallbackInitial = allowWarmFallbackInitial && (shouldDeferFallback || !hasLoadedList);
			return {
				action: "thread-list-load-request",
				selectedCwd,
				search,
				silent,
				threadDetailOpening,
				documentHidden,
				shouldLoad: !suppressHiddenSilent && !suppressDetailSilent,
				skipReason: suppressHiddenSilent ? "hidden-silent" : suppressDetailSilent ? "detail-in-flight" : "",
				retryDelayMs: suppressDetailSilent ? 700 : 0,
				shouldDeferFallback,
				shouldUseWarmFallbackInitial,
				params: {
					fallback: shouldDeferFallback ? "defer" : "",
					initial: shouldUseWarmFallbackInitial ? "warm-fallback" : ""
				}
			};
		}
		return { planThreadListLoadRequest };
	});
}));
//#endregion
//#region public/thread-list-stable-order.js
var require_thread_list_stable_order = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexThreadListStableOrder = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		const DEFAULT_HOLD_MS = 45e3;
		function text(value) {
			return String(value || "").trim();
		}
		function boundedHoldMs(value) {
			const number = Math.trunc(Number(value) || 0);
			if (number <= 0) return DEFAULT_HOLD_MS;
			return Math.min(3e5, Math.max(5e3, number));
		}
		function threadId(thread) {
			return text(thread && thread.id);
		}
		function threadListOrderScopeKey(input = {}) {
			const cwd = text(input.selectedCwd);
			const search = text(input.search).toLowerCase();
			return JSON.stringify({
				cwd,
				search
			});
		}
		function orderedThreadsById(threads, ids) {
			const byId = /* @__PURE__ */ new Map();
			for (const thread of threads || []) {
				const id = threadId(thread);
				if (id && !byId.has(id)) byId.set(id, thread);
			}
			return (ids || []).map((id) => byId.get(id)).filter(Boolean);
		}
		function mergeHeldOrder(previousOrder, incomingIds) {
			const incomingSet = new Set(incomingIds);
			const rank = new Map(incomingIds.map((id, index) => [id, index]));
			const ordered = (previousOrder || []).filter((id) => incomingSet.has(id));
			const orderedSet = new Set(ordered);
			const additions = incomingIds.filter((id) => !orderedSet.has(id));
			for (const id of additions) {
				const idRank = rank.get(id);
				let insertAt = ordered.length;
				for (let index = 0; index < ordered.length; index += 1) if ((rank.get(ordered[index]) ?? Number.MAX_SAFE_INTEGER) > idRank) {
					insertAt = index;
					break;
				}
				ordered.splice(insertAt, 0, id);
				orderedSet.add(id);
			}
			return ordered;
		}
		function planThreadListStableOrder(input = {}) {
			const threads = Array.isArray(input.threads) ? input.threads : [];
			const incomingIds = threads.map(threadId).filter(Boolean);
			const previous = input.previousState && typeof input.previousState === "object" ? input.previousState : {};
			const previousOrder = Array.isArray(previous.order) ? previous.order.map(text).filter(Boolean) : [];
			const scopeKey = text(input.scopeKey) || threadListOrderScopeKey(input);
			const nowMs = Math.max(0, Math.trunc(Number(input.nowMs) || Date.now()));
			const holdMs = boundedHoldMs(input.holdMs);
			const previousHoldUntilMs = Math.max(0, Math.trunc(Number(previous.holdUntilMs) || 0));
			const sameScope = text(previous.scopeKey) === scopeKey;
			const canHold = !input.forceServerOrder && sameScope && previousOrder.length > 0 && previousHoldUntilMs > nowMs;
			const order = canHold ? mergeHeldOrder(previousOrder, incomingIds) : incomingIds;
			const holdUntilMs = canHold ? previousHoldUntilMs : nowMs + holdMs;
			return {
				action: "thread-list-stable-order",
				held: canHold,
				scopeKey,
				holdUntilMs,
				order,
				threads: orderedThreadsById(threads, order),
				state: {
					scopeKey,
					holdUntilMs,
					order
				}
			};
		}
		return {
			DEFAULT_HOLD_MS,
			threadListOrderScopeKey,
			planThreadListStableOrder
		};
	});
}));
//#endregion
//#region public/thread-status-hints.js
var require_thread_status_hints = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexThreadStatusHints = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		const DEFAULT_RUNNING_HINT_STALE_MS = 1200 * 1e3;
		const DEFAULT_SUBMITTED_PROCESSING_HINT_STALE_MS = 60 * 1e3;
		const DEFAULT_STATUS_EVENT_FRESHNESS_TOLERANCE_MS = 1e3;
		function timestampMs(value) {
			if (value === null || value === void 0 || value === "") return 0;
			if (typeof value === "number") {
				if (!Number.isFinite(value) || value <= 0) return 0;
				return value > 0xe8d4a51000 ? Math.trunc(value) : Math.trunc(value * 1e3);
			}
			if (/^\d+(?:\.\d+)?$/.test(String(value))) {
				const numeric = Number(value);
				if (Number.isFinite(numeric) && numeric > 0) return numeric > 0xe8d4a51000 ? Math.trunc(numeric) : Math.trunc(numeric * 1e3);
			}
			const parsed = Date.parse(String(value));
			return Number.isFinite(parsed) ? parsed : 0;
		}
		function statusText(status) {
			if (!status) return "";
			if (typeof status === "string") return status;
			if (status && typeof status === "object" && status.type) return String(status.type);
			try {
				return JSON.stringify(status);
			} catch (_) {
				return String(status);
			}
		}
		function isStaleActiveStatus(status, thread) {
			return Boolean(status && typeof status === "object" && (status.mobileStaleActiveTurn || status.staleActiveTurn || status.reason === "context-only-active-turn") || thread && thread.mobileStaleActiveTurn);
		}
		function isRunningStatus(status) {
			return /active|running|queued|processing|inprogress|in_progress|in-progress|pending|started/.test(statusText(status).toLowerCase());
		}
		function isSettledStatus(status) {
			return /^(idle|notloaded|not_loaded|not-loaded|completed|complete|done|failed|failure|cancelled|canceled|cancel|error|interrupted|stopped|stop)$/.test(statusText(status).toLowerCase());
		}
		function isIdleStatus(status) {
			return /^(idle|notloaded|not_loaded|not-loaded)$/.test(statusText(status).toLowerCase());
		}
		function isTerminalStatus(status) {
			return /^(completed|complete|done|failed|failure|cancelled|canceled|cancel|error|interrupted|stopped|stop)$/.test(statusText(status).toLowerCase());
		}
		function threadUpdatedAtMs(thread) {
			return timestampMs(thread && (thread.updatedAtMs || thread.updatedAt || thread.updated_at_ms || thread.updated_at));
		}
		function terminalTurnAtMs(turn) {
			return timestampMs(turn && turn.completedAtMs) || timestampMs(turn && turn.completedAt) || timestampMs(turn && turn.completed_at_ms) || timestampMs(turn && turn.completed_at) || timestampMs(turn && turn.finishedAt) || timestampMs(turn && turn.finished_at) || timestampMs(turn && turn.updatedAtMs) || timestampMs(turn && turn.updatedAt) || timestampMs(turn && turn.updated_at_ms) || timestampMs(turn && turn.updated_at) || timestampMs(turn && turn.startedAtMs) || timestampMs(turn && turn.startedAt) || timestampMs(turn && turn.started_at_ms) || timestampMs(turn && turn.started_at) || timestampMs(turn && turn.createdAtMs) || timestampMs(turn && turn.createdAt) || timestampMs(turn && turn.created_at_ms) || timestampMs(turn && turn.created_at);
		}
		function notificationDurableEventAtMs(params = {}) {
			return timestampMs(params.eventAtMs) || timestampMs(params.eventAt) || terminalTurnAtMs(params.turn) || timestampMs(params.receivedAtMs) || timestampMs(params.timestampMs) || timestampMs(params.timestamp);
		}
		function notificationEventAtMs(params = {}, fallbackMs = 0, options = {}) {
			const durableAt = notificationDurableEventAtMs(params);
			if (durableAt) return durableAt;
			if (options.allowReplayReceivedAt !== false) {
				const replayAt = timestampMs(params.mobileReplayReceivedAtMs);
				if (replayAt) return replayAt;
			}
			return timestampMs(params.receivedAtMs) || timestampMs(params.timestampMs) || timestampMs(params.timestamp) || timestampMs(fallbackMs);
		}
		function latestTerminalTurn(thread) {
			const turns = Array.isArray(thread && thread.turns) ? thread.turns : [];
			const latest = turns.length ? turns[turns.length - 1] : null;
			if (!latest) return null;
			return isTerminalStatus(latest.status) ? latest : null;
		}
		function latestTerminalTurnAtMs(thread) {
			const turn = latestTerminalTurn(thread);
			return turn ? terminalTurnAtMs(turn) : 0;
		}
		function hasFreshSubmittedProcessingHint(submittedProcessingHintedAtMs, nowMs, staleMs = DEFAULT_SUBMITTED_PROCESSING_HINT_STALE_MS) {
			const hintedAt = timestampMs(submittedProcessingHintedAtMs);
			const now = timestampMs(nowMs) || Date.now();
			return Boolean(hintedAt > 0 && now - hintedAt <= Math.max(0, Number(staleMs) || DEFAULT_SUBMITTED_PROCESSING_HINT_STALE_MS));
		}
		function statusFreshnessAtMs(thread, eventAtMs) {
			return Math.max(threadUpdatedAtMs(thread) || 0, timestampMs(eventAtMs) || 0);
		}
		function settledStatusFreshEnoughForRunningHint(input = {}) {
			const hintedAt = timestampMs(input.runningHintedAtMs);
			if (!hintedAt) return true;
			const statusAt = statusFreshnessAtMs(input.thread, input.eventAtMs);
			if (!statusAt) return false;
			if (input.mobileReplay) return statusAt >= hintedAt;
			return statusAt + Math.max(0, Number(input.freshnessToleranceMs) || DEFAULT_STATUS_EVENT_FRESHNESS_TOLERANCE_MS) >= hintedAt;
		}
		function shouldKeepRunningHintForSettledStatus(input = {}) {
			const threadId = String(input.threadId || "");
			if (!threadId || !input.isRunningHinted) return false;
			const status = input.status || input.thread && input.thread.status;
			if (isStaleActiveStatus(status, input.thread)) return false;
			if (!isSettledStatus(status)) return false;
			if (isIdleStatus(status) && !latestTerminalTurn(input.thread) && !input.eventIsTerminal) return true;
			if (input.allowLocalProcessing !== false && isIdleStatus(status) && !latestTerminalTurn(input.thread) && hasFreshSubmittedProcessingHint(input.submittedProcessingHintedAtMs, input.nowMs, input.submittedProcessingHintStaleMs)) return true;
			if (input.currentThreadId && threadId === String(input.currentThreadId) && input.currentThreadSettled) return false;
			if (input.currentThreadHasLiveTurn) return true;
			if (!input.mobileReplay && (isTerminalStatus(status) || latestTerminalTurn(input.thread) || input.eventIsTerminal)) return false;
			return !settledStatusFreshEnoughForRunningHint(input);
		}
		function threadUnreadTerminalAtMs(thread, eventAtMs = 0, options = {}) {
			const eventAt = options.eventIsTerminal ? timestampMs(eventAtMs) : 0;
			return Math.max(latestTerminalTurnAtMs(thread) || 0, eventAt || 0);
		}
		function shouldMarkThreadUnread(input = {}) {
			const threadId = String(input.threadId || "");
			if (!threadId || threadId === String(input.currentThreadId || "")) return false;
			const status = input.status || input.thread && input.thread.status;
			if (isStaleActiveStatus(status, input.thread)) return false;
			if (!isSettledStatus(status)) return false;
			if (isIdleStatus(status) && !latestTerminalTurn(input.thread) && !input.eventIsTerminal) return false;
			const terminalAt = threadUnreadTerminalAtMs(input.thread, input.eventAtMs, { eventIsTerminal: Boolean(input.eventIsTerminal) });
			const viewedAt = timestampMs(input.viewedAtMs);
			if (viewedAt > 0) return terminalAt > viewedAt;
			const updateAt = terminalAt || (input.wasRunning ? statusFreshnessAtMs(input.thread, input.eventAtMs) : 0);
			if (input.mobileReplay && !updateAt) return false;
			const hintedAt = timestampMs(input.runningHintedAtMs);
			if (!input.wasRunning || hintedAt <= 0) return false;
			if (!updateAt) return !input.mobileReplay;
			return updateAt + (input.mobileReplay ? 0 : Math.max(0, Number(input.freshnessToleranceMs) || DEFAULT_STATUS_EVENT_FRESHNESS_TOLERANCE_MS)) >= hintedAt;
		}
		function runningHintAgeMs(input = {}) {
			const hintedAt = timestampMs(input.runningHintedAtMs);
			const now = timestampMs(input.nowMs) || Date.now();
			if (hintedAt > 0) return now - hintedAt;
			const updatedAt = threadUpdatedAtMs(input.thread);
			if (updatedAt > 0) return now - updatedAt;
			return (Number(input.runningHintStaleMs) || DEFAULT_RUNNING_HINT_STALE_MS) + 1;
		}
		function shouldExpireRunningThreadHint(input = {}) {
			if (!input.threadId || !input.isRunningHinted) return false;
			const status = input.status || input.thread && input.thread.status;
			if (isStaleActiveStatus(status, input.thread)) return true;
			if (isRunningStatus(status)) return false;
			if (isSettledStatus(status) && !shouldKeepRunningHintForSettledStatus(input)) return false;
			if (input.currentThreadHasLiveTurn) return false;
			return runningHintAgeMs(input) > (Number(input.runningHintStaleMs) || DEFAULT_RUNNING_HINT_STALE_MS);
		}
		return {
			DEFAULT_RUNNING_HINT_STALE_MS,
			DEFAULT_SUBMITTED_PROCESSING_HINT_STALE_MS,
			DEFAULT_STATUS_EVENT_FRESHNESS_TOLERANCE_MS,
			hasFreshSubmittedProcessingHint,
			isIdleStatus,
			isRunningStatus,
			isSettledStatus,
			isStaleActiveStatus,
			isTerminalStatus,
			latestTerminalTurnAtMs,
			notificationDurableEventAtMs,
			notificationEventAtMs,
			runningHintAgeMs,
			shouldExpireRunningThreadHint,
			shouldKeepRunningHintForSettledStatus,
			shouldMarkThreadUnread,
			statusFreshnessAtMs,
			statusText,
			terminalTurnAtMs,
			threadUpdatedAtMs,
			timestampMs
		};
	});
}));
//#endregion
//#region public/thread-detail-patch-plan.js
var require_thread_detail_patch_plan = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexThreadDetailPatchPlan = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		function normalizePatchEntry(entry) {
			if (!entry || typeof entry !== "object") return null;
			const key = String(entry.key || "");
			if (!key) return null;
			return Object.assign({}, entry, { key });
		}
		function normalizeRefreshTurnPatchEntry(entry) {
			if (!entry || typeof entry !== "object") return null;
			const key = String(entry.key || "");
			if (!key) return null;
			return {
				key,
				hasPreviousTurn: Boolean(entry.hasPreviousTurn),
				itemPatchable: Boolean(entry.itemPatchable),
				articlePresent: Boolean(entry.articlePresent)
			};
		}
		function normalizedStringList(value) {
			return Array.isArray(value) ? value.map((entry) => String(entry || "")).filter(Boolean) : [];
		}
		function signatureText(signature) {
			if (signature == null) return "";
			if (typeof signature === "string") return signature;
			try {
				return JSON.stringify(signature);
			} catch (_) {
				return "";
			}
		}
		function planThreadDetailDomPatchSurface(input = {}) {
			const threadId = String(input.threadId || "").trim();
			const threadTileMode = Boolean(input.threadTileMode);
			const threadTileSurface = Boolean(input.threadTileSurface);
			const tilePaneVisible = Boolean(input.tilePaneVisible);
			const conversationPresent = Boolean(input.conversationPresent);
			if (threadTileMode || threadTileSurface) {
				if (!threadTileMode) return {
					canPatch: false,
					surface: "blocked",
					reason: "tile-surface-without-tile-mode",
					threadId
				};
				if (!threadTileSurface) return {
					canPatch: false,
					surface: "blocked",
					reason: "tile-mode-surface-mismatch",
					threadId
				};
				if (!threadId) return {
					canPatch: false,
					surface: "thread-tile-pane",
					reason: "missing-thread-id",
					threadId: ""
				};
				if (!tilePaneVisible) return {
					canPatch: false,
					surface: "thread-tile-pane",
					reason: "tile-pane-not-visible",
					threadId
				};
				return {
					canPatch: true,
					surface: "thread-tile-pane",
					reason: "tile-pane-visible",
					threadId
				};
			}
			if (!conversationPresent) return {
				canPatch: false,
				surface: "single-thread",
				reason: "missing-conversation",
				threadId
			};
			return {
				canPatch: true,
				surface: "single-thread",
				reason: "single-thread-surface",
				threadId
			};
		}
		function planThreadDetailRefreshLocalPatchPreflight(input = {}) {
			const conversationPresent = Boolean(input.conversationPresent);
			const previousThreadPresent = Boolean(input.previousThreadPresent);
			const nextThreadPresent = Boolean(input.nextThreadPresent);
			if (!conversationPresent) return {
				canPatch: false,
				terminal: false,
				reason: "missing-conversation-root"
			};
			if (!previousThreadPresent || !nextThreadPresent) return {
				canPatch: false,
				terminal: false,
				reason: "missing-thread"
			};
			if (String(input.stage || "complete") === "root") return {
				canPatch: true,
				terminal: false,
				reason: "root-ready"
			};
			if (input.tilePanePatched) return {
				canPatch: true,
				terminal: true,
				reason: "tile-pane-patched"
			};
			if (!input.singleThreadSurfaceAvailable) return {
				canPatch: false,
				terminal: false,
				reason: "single-thread-surface-unavailable"
			};
			if (input.previousLoadingOrError || input.nextLoadingOrError) return {
				canPatch: false,
				terminal: false,
				reason: "loading-or-error-state"
			};
			const renderedConversationSignature = signatureText(input.renderedConversationSignature);
			const previousConversationSignature = signatureText(input.previousConversationSignature);
			const renderedPatchShellSignature = signatureText(input.renderedPatchShellSignature);
			const previousPatchShellSignature = signatureText(input.previousPatchShellSignature);
			const nextPatchShellSignature = signatureText(input.nextPatchShellSignature);
			if (renderedConversationSignature !== previousConversationSignature && (!renderedPatchShellSignature || renderedPatchShellSignature !== previousPatchShellSignature)) return {
				canPatch: false,
				terminal: false,
				reason: "rendered-dom-stale"
			};
			if (previousPatchShellSignature !== nextPatchShellSignature) return {
				canPatch: false,
				terminal: false,
				reason: "patch-shell-changed"
			};
			return {
				canPatch: true,
				terminal: false,
				reason: "preflight-passed"
			};
		}
		function visibleItemPatchShapePreservesExisting(previousEntries, nextEntries) {
			if (!Array.isArray(previousEntries) || !Array.isArray(nextEntries)) return false;
			const previous = previousEntries.map(normalizePatchEntry).filter(Boolean);
			const next = nextEntries.map(normalizePatchEntry).filter(Boolean);
			if (previous.length !== previousEntries.length || next.length !== nextEntries.length) return false;
			if (previous.length > next.length) return false;
			let previousIndex = 0;
			for (const nextEntry of next) {
				const previousEntry = previous[previousIndex];
				if (previousEntry && previousEntry.key === nextEntry.key) previousIndex += 1;
			}
			return previousIndex === previous.length;
		}
		function planVisibleItemRefreshPatch(previousEntries, nextEntries) {
			if (!visibleItemPatchShapePreservesExisting(previousEntries, nextEntries)) return {
				canPatch: false,
				reason: "shape-changed",
				operations: []
			};
			const previousByKey = new Map(previousEntries.map(normalizePatchEntry).filter(Boolean).map((entry) => [entry.key, entry]));
			const operations = [];
			for (const rawNextEntry of nextEntries) {
				const nextEntry = normalizePatchEntry(rawNextEntry);
				if (!nextEntry) return {
					canPatch: false,
					reason: "invalid-entry",
					operations: []
				};
				const previousEntry = previousByKey.get(nextEntry.key);
				if (!previousEntry) {
					operations.push({
						type: "insert",
						key: nextEntry.key,
						nextEntry
					});
					continue;
				}
				const previousSignature = signatureText(previousEntry.signature);
				const nextSignature = signatureText(nextEntry.signature);
				operations.push({
					type: previousSignature === nextSignature ? "reuse" : "patch",
					key: nextEntry.key,
					previousEntry,
					nextEntry
				});
			}
			return {
				canPatch: true,
				reason: "shape-preserved",
				operations
			};
		}
		function planThreadDetailRefreshDomPatch(entries, options = {}) {
			if (!Array.isArray(entries)) return {
				canPatch: false,
				reason: "invalid-turn-entries",
				operations: []
			};
			const operations = [];
			const nextKeys = /* @__PURE__ */ new Set();
			for (const rawEntry of entries) {
				const entry = normalizeRefreshTurnPatchEntry(rawEntry);
				if (!entry) return {
					canPatch: false,
					reason: "invalid-turn-entry",
					operations: []
				};
				nextKeys.add(entry.key);
				if (entry.hasPreviousTurn && entry.itemPatchable && entry.articlePresent) {
					operations.push({
						type: "item-patch",
						key: entry.key,
						entry
					});
					continue;
				}
				operations.push({
					type: entry.articlePresent ? "replace-turn" : "insert-turn",
					key: entry.key,
					entry
				});
			}
			const previousTurnKeys = normalizedStringList(options.previousTurnKeys || options.previousKeys);
			for (const previousKey of previousTurnKeys) {
				if (nextKeys.has(previousKey)) continue;
				operations.push({
					type: "remove-turn",
					key: previousKey,
					entry: {
						key: previousKey,
						stale: true
					}
				});
			}
			return {
				canPatch: true,
				reason: "planned",
				operations
			};
		}
		return {
			normalizePatchEntry,
			normalizeRefreshTurnPatchEntry,
			planThreadDetailRefreshDomPatch,
			planThreadDetailRefreshLocalPatchPreflight,
			planVisibleItemRefreshPatch,
			planThreadDetailDomPatchSurface,
			visibleItemPatchShapePreservesExisting
		};
	});
}));
//#endregion
//#region public/thread-detail-actions.js
var require_thread_detail_actions = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexThreadDetailActions = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		function withinRoot(root, node) {
			if (!root || !node || typeof root.contains !== "function") return true;
			return root.contains(node);
		}
		function closestWithin(target, selector, root = null) {
			if (!target || typeof target.closest !== "function") return null;
			const node = target.closest(selector);
			if (!node || !withinRoot(root, node)) return null;
			return node;
		}
		function action(type, target, fields = {}) {
			return Object.assign({
				action: String(type || "none"),
				target: target || null,
				preventDefault: false,
				stopPropagation: false
			}, fields);
		}
		function dataValue(node, key) {
			return String(node && node.dataset && node.dataset[key] || "");
		}
		function contextThreadIdFromNode(node, explicitDatasetKey = "") {
			if (!node) return "";
			const explicit = explicitDatasetKey ? dataValue(node, explicitDatasetKey) : "";
			if (explicit) return explicit;
			if (typeof node.closest !== "function") return "";
			return dataValue(node.closest("[data-thread-tile-pane]"), "threadTilePane");
		}
		function previewableImageFromTarget(target, root = null) {
			const image = closestWithin(target, ".input-image img, .image-view img, .markdown-image img, .file-preview-image, .attachment-thumb", root);
			if (!image) return null;
			if (image.closest && image.closest(".github-link-card")) return null;
			return image;
		}
		function resolveRichContentClickAction(input = {}) {
			const target = input.target || null;
			const root = input.root || null;
			let node = closestWithin(target, "[data-copy-key]", root);
			if (node) return action("copy", node, {
				button: node,
				preventDefault: true,
				stopPropagation: true
			});
			node = closestWithin(target, "[data-local-file-path]", root);
			if (node) return action("local-file-preview", node, {
				link: node,
				threadId: contextThreadIdFromNode(node, "localFileThreadId"),
				preventDefault: true,
				stopPropagation: true
			});
			node = closestWithin(target, "[data-mermaid-action]", root);
			if (node) return action("mermaid", node, {
				button: node,
				preventDefault: true,
				stopPropagation: true
			});
			node = closestWithin(target, "[data-github-link-preview-expand]", root);
			if (node) return action("github-preview-toggle", node, {
				button: node,
				preventDefault: true,
				stopPropagation: true
			});
			return action("none", null, { reason: "no-match" });
		}
		function resolveThreadDetailClickAction(input = {}) {
			const target = input.target || null;
			const root = input.root || null;
			const rich = resolveRichContentClickAction({
				target,
				root
			});
			if (rich.action !== "none") return rich;
			let node = closestWithin(target, "[data-approval-action]", root);
			if (node) return action("approval-answer", node, {
				button: node,
				approvalId: dataValue(node, "approvalId"),
				approvalAction: dataValue(node, "approvalAction"),
				threadId: dataValue(node, "approvalThreadId")
			});
			node = closestWithin(target, "[data-task-card-action]", root);
			if (node) {
				const taskCardAction = dataValue(node, "taskCardAction");
				const cardId = dataValue(node, "taskCardId");
				const threadId = dataValue(node, "taskCardThreadId");
				if (taskCardAction === "reply") return action("task-card-reply", node, {
					button: node,
					cardId,
					taskCardAction,
					threadId
				});
				if (taskCardAction === "approve" || taskCardAction === "delete" || taskCardAction === "revoke") return action("task-card-mutate", node, {
					button: node,
					cardId,
					taskCardAction,
					threadId
				});
				return action("task-card-unknown", node, {
					button: node,
					cardId,
					taskCardAction,
					threadId
				});
			}
			node = closestWithin(target, "[data-task-card-draft-action]", root);
			if (node) return action("task-card-draft", node, {
				button: node,
				draftAction: dataValue(node, "taskCardDraftAction"),
				draftKey: dataValue(node, "taskCardDraftKey"),
				threadId: dataValue(node, "taskCardDraftThreadId")
			});
			node = closestWithin(target, "[data-server-response-text]", root);
			if (node) return action("server-response", node, {
				option: node,
				requestId: dataValue(node, "serverRequestId"),
				threadId: dataValue(node, "serverRequestThreadId"),
				responseText: dataValue(node, "serverResponseText"),
				questionId: dataValue(node, "serverQuestionId") || "answer"
			});
			node = closestWithin(target, "[data-server-request-decline]", root);
			if (node) return action("server-request-decline", node, {
				button: node,
				requestId: dataValue(node, "serverRequestId"),
				threadId: dataValue(node, "serverRequestThreadId")
			});
			return action("none", null, { reason: "no-match" });
		}
		return {
			closestWithin,
			previewableImageFromTarget,
			resolveRichContentClickAction,
			resolveThreadDetailClickAction,
			contextThreadIdFromNode
		};
	});
}));
//#endregion
//#region public/thread-detail-merge-state.js
var require_thread_detail_merge_state = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexThreadDetailMergeState = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		function defaultNormalizeThread(thread) {
			return thread;
		}
		function defaultSortTurns(turns) {
			return Array.isArray(turns) ? turns.slice() : [];
		}
		function createThreadDetailMergePolicy(options = {}) {
			const isV4ProjectionThread = typeof options.isV4ProjectionThread === "function" ? options.isV4ProjectionThread : () => false;
			const mergeV4ProjectionThread = typeof options.mergeV4ProjectionThread === "function" ? options.mergeV4ProjectionThread : (existingThread, incomingThread) => incomingThread || existingThread || null;
			const normalizeThreadVisibleUserMessages = typeof options.normalizeThreadVisibleUserMessages === "function" ? options.normalizeThreadVisibleUserMessages : defaultNormalizeThread;
			const turnVisibleWeight = typeof options.turnVisibleWeight === "function" ? options.turnVisibleWeight : () => 0;
			const shouldPreserveExistingTurnVisibleItems = typeof options.shouldPreserveExistingTurnVisibleItems === "function" ? options.shouldPreserveExistingTurnVisibleItems : () => false;
			const mergeItemsPreservingLocalVisible = typeof options.mergeItemsPreservingLocalVisible === "function" ? options.mergeItemsPreservingLocalVisible : (existingItems, incomingItems) => Array.isArray(incomingItems) ? incomingItems : existingItems;
			const shouldDropInitialSubmissionEchoTurn = typeof options.shouldDropInitialSubmissionEchoTurn === "function" ? options.shouldDropInitialSubmissionEchoTurn : () => false;
			const turnIsSupersededBy = typeof options.turnIsSupersededBy === "function" ? options.turnIsSupersededBy : () => false;
			const isTurnComplete = typeof options.isTurnComplete === "function" ? options.isTurnComplete : () => false;
			const shouldPreserveMissingExistingTurn = typeof options.shouldPreserveMissingExistingTurn === "function" ? options.shouldPreserveMissingExistingTurn : () => false;
			const sortTurnsForDisplay = typeof options.sortTurnsForDisplay === "function" ? options.sortTurnsForDisplay : defaultSortTurns;
			const threadHasInitialSubmissionEcho = typeof options.threadHasInitialSubmissionEcho === "function" ? options.threadHasInitialSubmissionEcho : () => false;
			const maxExpandedVisibleTurns = Math.max(1, Number(options.maxExpandedVisibleTurns || 200) || 200);
			function normalizeMergedThread(thread, limit = 0) {
				const normalized = normalizeThreadVisibleUserMessages(thread);
				if (normalized && Array.isArray(normalized.turns)) {
					const sorted = sortTurnsForDisplay(normalized.turns);
					normalized.turns = limit > 0 ? sorted.slice(-limit) : sorted;
				}
				return normalized;
			}
			function shouldPreserveLiveTurnLocalVisibleItems(existingTurn, incomingTurn, existingWeight = null) {
				return shouldPreserveExistingTurnVisibleItems(existingTurn, incomingTurn, existingWeight);
			}
			function mergeTurnPreservingVisibleItems(existingTurn, incomingTurn) {
				if (!existingTurn) return incomingTurn;
				if (!incomingTurn) return existingTurn;
				const existingItems = Array.isArray(existingTurn.items) ? existingTurn.items : [];
				const incomingHasItems = Array.isArray(incomingTurn.items);
				const merged = Object.assign({}, existingTurn, incomingTurn);
				if (!incomingHasItems) {
					merged.items = existingItems;
					return merged;
				}
				const incomingWeight = turnVisibleWeight(Object.assign({}, incomingTurn, { items: incomingTurn.items || [] }));
				const existingWeight = turnVisibleWeight(existingTurn);
				const preserveLocalVisible = incomingWeight < existingWeight || shouldPreserveLiveTurnLocalVisibleItems(existingTurn, incomingTurn, existingWeight);
				merged.items = mergeItemsPreservingLocalVisible(existingItems, incomingTurn.items || [], preserveLocalVisible, incomingTurn);
				return merged;
			}
			function mergeThreadPreservingVisibleItems(existingThread, incomingThread, runtime = {}) {
				if (isV4ProjectionThread(incomingThread)) return mergeV4ProjectionThread(existingThread, incomingThread);
				if (!existingThread || !incomingThread || existingThread.id !== incomingThread.id) return normalizeMergedThread(incomingThread);
				const existingTurns = Array.isArray(existingThread.turns) ? existingThread.turns : [];
				const incomingTurns = Array.isArray(incomingThread.turns) ? incomingThread.turns : null;
				const existingById = new Map(existingTurns.map((turn) => [turn && turn.id, turn]).filter(([id]) => id));
				const initialSubmissionId = String(existingThread.mobileInitialSubmissionId || "");
				const merged = Object.assign({}, existingThread, incomingThread);
				if (!Object.prototype.hasOwnProperty.call(incomingThread, "mobileLoading")) delete merged.mobileLoading;
				if (!Object.prototype.hasOwnProperty.call(incomingThread, "mobileLoadError")) delete merged.mobileLoadError;
				if (!Object.prototype.hasOwnProperty.call(incomingThread, "mobileReadWarning")) delete merged.mobileReadWarning;
				if (!incomingTurns) return normalizeMergedThread(merged);
				const existingVisibleWeight = existingTurns.reduce((total, turn) => total + turnVisibleWeight(turn), 0);
				const incomingVisibleWeight = incomingTurns.reduce((total, turn) => total + turnVisibleWeight(turn), 0);
				const incomingHasAuthoritativeVisibleWindow = incomingTurns.length > 0 && incomingVisibleWeight > 0;
				if (!incomingTurns.length && existingTurns.length && existingVisibleWeight > 0 && incomingVisibleWeight === 0) {
					merged.turns = existingTurns;
					return normalizeMergedThread(merged);
				}
				merged.turns = incomingTurns.map((incomingTurn) => {
					const existingTurn = existingById.get(incomingTurn && incomingTurn.id);
					return existingTurn ? mergeTurnPreservingVisibleItems(existingTurn, incomingTurn) : incomingTurn;
				});
				merged.turns = sortTurnsForDisplay(merged.turns);
				const incomingIds = new Set(merged.turns.map((turn) => turn && turn.id).filter(Boolean));
				const latestIncoming = merged.turns.length ? merged.turns[merged.turns.length - 1] : null;
				const preserveExpandedHistory = Boolean(existingThread.mobileHistoryExpanded) && (/turns-list/i.test(String(incomingThread.mobileReadMode || "")) || Boolean(incomingThread.mobileOlderTurnsCursor) || Number(incomingThread.mobileOmittedTurnCount || 0) > 0);
				let preservedExpandedTurnCount = 0;
				const activeTurnId = String(runtime.activeTurnId || "");
				for (const existingTurn of existingTurns) {
					if (!existingTurn || incomingIds.has(existingTurn.id)) continue;
					if (shouldDropInitialSubmissionEchoTurn(existingTurn, merged.turns, initialSubmissionId)) continue;
					if (preserveExpandedHistory) {
						merged.turns.push(existingTurn);
						preservedExpandedTurnCount += 1;
						continue;
					}
					if (incomingHasAuthoritativeVisibleWindow && !shouldPreserveMissingExistingTurn(existingTurn, merged, runtime)) continue;
					if (turnIsSupersededBy(existingTurn, latestIncoming)) continue;
					if (String(existingTurn.id || "") === activeTurnId || !isTurnComplete(existingTurn) && turnVisibleWeight(existingTurn) > 0) merged.turns.push(existingTurn);
				}
				if (preserveExpandedHistory) {
					merged.mobileHistoryExpanded = true;
					if (preservedExpandedTurnCount > 0) merged.mobileOmittedTurnCount = Math.max(0, Number(merged.mobileOmittedTurnCount || 0) - preservedExpandedTurnCount);
				}
				const normalized = normalizeMergedThread(merged, preserveExpandedHistory ? maxExpandedVisibleTurns : 0);
				if (!threadHasInitialSubmissionEcho(normalized, initialSubmissionId)) delete normalized.mobileInitialSubmissionId;
				return normalized;
			}
			return {
				mergeThreadPreservingVisibleItems,
				mergeTurnPreservingVisibleItems,
				shouldPreserveLiveTurnLocalVisibleItems
			};
		}
		return { createThreadDetailMergePolicy };
	});
}));
//#endregion
//#region public/thread-detail-v4-merge-state.js
var require_thread_detail_v4_merge_state = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexThreadDetailV4MergeState = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		function defaultNormalizeThread(thread) {
			return thread;
		}
		function defaultTurnVisibleWeight(turn) {
			return Array.isArray(turn && turn.items) ? turn.items.length : 0;
		}
		function defaultSortTurns(turns) {
			return Array.isArray(turns) ? turns.slice() : [];
		}
		function statusText(status) {
			if (!status) return "";
			if (typeof status === "object" && status.type) return String(status.type || "");
			return String(status || "");
		}
		function createThreadDetailV4MergePolicy(options = {}) {
			const normalizeThreadVisibleUserMessages = typeof options.normalizeThreadVisibleUserMessages === "function" ? options.normalizeThreadVisibleUserMessages : defaultNormalizeThread;
			const turnVisibleWeight = typeof options.turnVisibleWeight === "function" ? options.turnVisibleWeight : defaultTurnVisibleWeight;
			const isOptimisticUserMessage = typeof options.isOptimisticUserMessage === "function" ? options.isOptimisticUserMessage : () => false;
			const isRecentlySubmittedUserMessage = typeof options.isRecentlySubmittedUserMessage === "function" ? options.isRecentlySubmittedUserMessage : () => false;
			const isReasoningItem = typeof options.isReasoningItem === "function" ? options.isReasoningItem : () => false;
			const userMessageHasSubmissionId = typeof options.userMessageHasSubmissionId === "function" ? options.userMessageHasSubmissionId : (item, submissionId) => Boolean(item && submissionId && String(item.clientSubmissionId || "") === String(submissionId || ""));
			const userMessagesCanShadow = typeof options.userMessagesCanShadow === "function" ? options.userMessagesCanShadow : () => false;
			const isTurnComplete = typeof options.isTurnComplete === "function" ? options.isTurnComplete : (turn) => /completed|failed|cancel|error|interrupted/i.test(statusText(turn && turn.status));
			const isRunningStatus = typeof options.isRunningStatus === "function" ? options.isRunningStatus : (status) => /active|running|queued|processing|inprogress|in_progress|in-progress|pending|started/i.test(statusText(status));
			const isIncompleteInterruptedTurn = typeof options.isIncompleteInterruptedTurn === "function" ? options.isIncompleteInterruptedTurn : () => false;
			const turnHasActiveLiveItems = typeof options.turnHasActiveLiveItems === "function" ? options.turnHasActiveLiveItems : () => false;
			const turnOrderMs = typeof options.turnOrderMs === "function" ? options.turnOrderMs : () => 0;
			const mergeTurnPreservingVisibleItems = typeof options.mergeTurnPreservingVisibleItems === "function" ? options.mergeTurnPreservingVisibleItems : (existingTurn, incomingTurn) => incomingTurn || existingTurn;
			const sortTurnsForDisplay = typeof options.sortTurnsForDisplay === "function" ? options.sortTurnsForDisplay : defaultSortTurns;
			const maxVisibleTurnsForThread = typeof options.maxVisibleTurnsForThread === "function" ? options.maxVisibleTurnsForThread : () => 10;
			function isV4ProjectionThread(thread) {
				return Boolean(thread && (thread.mobileProjectionVersion === "v4" || thread.mobileProjection && thread.mobileProjection.version === "v4"));
			}
			function shouldPreserveV4PendingOverlayItem(item) {
				return Boolean(item && item.type === "userMessage" && isOptimisticUserMessage(item) && (isRecentlySubmittedUserMessage(item) || item.mobileSendError));
			}
			function v4ThreadHasPendingMatch(thread, pendingItem) {
				if (!pendingItem || pendingItem.type !== "userMessage") return false;
				const submissionId = String(pendingItem.clientSubmissionId || "").trim();
				for (const turn of Array.isArray(thread && thread.turns) ? thread.turns : []) for (const item of Array.isArray(turn && turn.items) ? turn.items : []) {
					if (!item || item.type !== "userMessage") continue;
					if (submissionId && userMessageHasSubmissionId(item, submissionId)) return true;
					if (!isOptimisticUserMessage(item) && userMessagesCanShadow(item, pendingItem)) return true;
				}
				return false;
			}
			function appendV4PendingOverlayItem(turn, item) {
				if (!turn || !item) return;
				turn.items = Array.isArray(turn.items) ? turn.items : [];
				const submissionId = String(item.clientSubmissionId || "").trim();
				if (!turn.items.some((existing) => existing && (submissionId && userMessageHasSubmissionId(existing, submissionId) || existing.id === item.id || userMessagesCanShadow(existing, item)))) turn.items.push(item);
			}
			function copyTurnWithOnlyItems(turn, items) {
				return Object.assign({}, turn || {}, { items: (items || []).slice() });
			}
			function applyV4PendingOverlay(existingThread, mergedThread) {
				if (!existingThread || !mergedThread || !Array.isArray(existingThread.turns)) return mergedThread;
				mergedThread.turns = Array.isArray(mergedThread.turns) ? mergedThread.turns : [];
				const turnsById = new Map(mergedThread.turns.map((turn) => [String(turn && turn.id || ""), turn]));
				for (const existingTurn of existingThread.turns) {
					const pendingItems = (Array.isArray(existingTurn && existingTurn.items) ? existingTurn.items : []).filter((item) => shouldPreserveV4PendingOverlayItem(item) && !v4ThreadHasPendingMatch(mergedThread, item));
					if (!pendingItems.length) continue;
					const targetTurn = turnsById.get(String(existingTurn.id || ""));
					if (targetTurn) {
						pendingItems.forEach((item) => appendV4PendingOverlayItem(targetTurn, item));
						continue;
					}
					const overlayTurn = copyTurnWithOnlyItems(existingTurn, pendingItems);
					overlayTurn.mobilePendingOverlay = true;
					mergedThread.turns.push(overlayTurn);
					if (overlayTurn.id) turnsById.set(String(overlayTurn.id), overlayTurn);
				}
				return mergedThread;
			}
			function v4ProjectionRevisionValue(thread) {
				const direct = Number(thread && thread.mobileProjectionRevision);
				if (Number.isFinite(direct) && direct > 0) return Math.trunc(direct);
				const nested = Number(thread && thread.mobileProjection && thread.mobileProjection.revision);
				return Number.isFinite(nested) && nested > 0 ? Math.trunc(nested) : 0;
			}
			function isV4ProjectionRefreshRegressive(existingThread, incomingThread) {
				const existingRevision = v4ProjectionRevisionValue(existingThread);
				const incomingRevision = v4ProjectionRevisionValue(incomingThread);
				return Boolean(existingRevision && incomingRevision && incomingRevision < existingRevision);
			}
			function isActiveLikeProjectionTurn(turn) {
				return Boolean(turn && !isTurnComplete(turn) && (isRunningStatus(turn.status) || isIncompleteInterruptedTurn(turn) || turnHasActiveLiveItems(turn)));
			}
			function incomingTurnsClearlySupersedeExistingTurn(existingTurn, incomingTurns) {
				const existingOrder = turnOrderMs(existingTurn);
				if (!existingOrder) return false;
				return (incomingTurns || []).some((incomingTurn) => {
					if (!incomingTurn || String(incomingTurn.id || "") === String(existingTurn && existingTurn.id || "")) return false;
					const incomingOrder = turnOrderMs(incomingTurn);
					return Boolean(incomingOrder && incomingOrder > existingOrder);
				});
			}
			function existingV4TurnHasOnlyMatchedPendingItems(existingTurn, incomingTurns) {
				const visibleItems = (Array.isArray(existingTurn && existingTurn.items) ? existingTurn.items : []).filter((item) => item && turnVisibleWeight({ items: [item] }) > 0 && !isReasoningItem(item));
				return Boolean(visibleItems.length && visibleItems.every((item) => shouldPreserveV4PendingOverlayItem(item) && v4ThreadHasPendingMatch({ turns: incomingTurns || [] }, item)));
			}
			function shouldPreserveExistingV4ProjectionTurn(existingThread, incomingThread, existingTurn, incomingTurns) {
				if (!existingTurn || turnVisibleWeight(existingTurn) <= 0) return false;
				const id = String(existingTurn.id || "");
				if (id && (incomingTurns || []).some((turn) => String(turn && turn.id || "") === id)) return false;
				if (existingV4TurnHasOnlyMatchedPendingItems(existingTurn, incomingTurns)) return false;
				const activeLike = isActiveLikeProjectionTurn(existingTurn);
				const regressiveRefresh = isV4ProjectionRefreshRegressive(existingThread, incomingThread);
				if (!activeLike && !regressiveRefresh) return false;
				return !incomingTurnsClearlySupersedeExistingTurn(existingTurn, incomingTurns);
			}
			function mergeV4ProjectionThread(existingThread, incomingThread) {
				if (!existingThread || !incomingThread || existingThread.id !== incomingThread.id) return normalizeThreadVisibleUserMessages(incomingThread);
				const merged = Object.assign({}, existingThread, incomingThread);
				if (!Object.prototype.hasOwnProperty.call(incomingThread, "mobileLoading")) delete merged.mobileLoading;
				if (!Object.prototype.hasOwnProperty.call(incomingThread, "mobileLoadError")) delete merged.mobileLoadError;
				if (!Object.prototype.hasOwnProperty.call(incomingThread, "mobileReadWarning")) delete merged.mobileReadWarning;
				if (Array.isArray(incomingThread.turns)) {
					const existingTurns = Array.isArray(existingThread.turns) ? existingThread.turns : [];
					const incomingTurns = incomingThread.turns.slice();
					const existingVisibleWeight = existingTurns.reduce((total, turn) => total + turnVisibleWeight(turn), 0);
					const incomingVisibleWeight = incomingTurns.reduce((total, turn) => total + turnVisibleWeight(turn), 0);
					if (!incomingTurns.length && existingTurns.length && existingVisibleWeight > 0 && incomingVisibleWeight === 0) {
						merged.turns = existingTurns;
						return normalizeThreadVisibleUserMessages(merged);
					}
					const existingById = new Map(existingTurns.map((turn) => [String(turn && turn.id || ""), turn]));
					merged.turns = incomingTurns.map((incomingTurn) => {
						const existingTurn = existingById.get(String(incomingTurn && incomingTurn.id || ""));
						return existingTurn ? mergeTurnPreservingVisibleItems(existingTurn, incomingTurn) : incomingTurn;
					});
					for (const existingTurn of existingTurns) if (shouldPreserveExistingV4ProjectionTurn(existingThread, incomingThread, existingTurn, merged.turns)) merged.turns.push(existingTurn);
					applyV4PendingOverlay(existingThread, merged);
					merged.turns = sortTurnsForDisplay(merged.turns).slice(-maxVisibleTurnsForThread(merged));
				}
				if (isV4ProjectionRefreshRegressive(existingThread, incomingThread)) {
					const existingRevision = v4ProjectionRevisionValue(existingThread);
					if (existingRevision) {
						merged.mobileProjectionRevision = existingRevision;
						if (merged.mobileProjection && typeof merged.mobileProjection === "object") merged.mobileProjection = Object.assign({}, merged.mobileProjection, { revision: existingRevision });
					}
				}
				return normalizeThreadVisibleUserMessages(merged);
			}
			return {
				applyV4PendingOverlay,
				isV4ProjectionRefreshRegressive,
				isV4ProjectionThread,
				mergeV4ProjectionThread,
				shouldPreserveExistingV4ProjectionTurn,
				v4ProjectionRevisionValue
			};
		}
		return { createThreadDetailV4MergePolicy };
	});
}));
//#endregion
//#region public/client-render-stability-guard.js
var require_client_render_stability_guard = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function initClientRenderStabilityGuard(globalScope) {
		function stringValue(value) {
			return String(value || "").trim();
		}
		function shortHash(value) {
			const text = stringValue(value);
			let hash = 2166136261;
			for (let index = 0; index < text.length; index += 1) {
				hash ^= text.charCodeAt(index);
				hash = Math.imul(hash, 16777619);
			}
			return (hash >>> 0).toString(36);
		}
		function submittedUserItemClientSubmissionId(item) {
			if (!item || item.type !== "userMessage") return "";
			return stringValue(item.clientSubmissionId);
		}
		function firstSubmittedUserMessageClientSubmissionId(turn) {
			const items = Array.isArray(turn && turn.items) ? turn.items : [];
			for (const item of items) {
				const submissionId = submittedUserItemClientSubmissionId(item);
				if (submissionId) return submissionId;
			}
			return "";
		}
		function localSubmissionRenderKey(clientSubmissionId) {
			const submissionId = stringValue(clientSubmissionId);
			return submissionId ? `submitted:${shortHash(submissionId)}` : "";
		}
		function submittedTurnRenderKey(turn) {
			const explicit = stringValue(turn && turn.mobileLocalSubmissionRenderKey);
			if (explicit) return explicit;
			return localSubmissionRenderKey(firstSubmittedUserMessageClientSubmissionId(turn));
		}
		function stableTurnIdentity(turn) {
			return submittedTurnRenderKey(turn) || stringValue(turn && (turn.id || turn.startedAt)) || "turn";
		}
		function markSubmittedTurn(turn, clientSubmissionId) {
			if (!turn || typeof turn !== "object") return "";
			const key = localSubmissionRenderKey(clientSubmissionId);
			if (key) turn.mobileLocalSubmissionRenderKey = key;
			return key;
		}
		function transferSubmittedTurnIdentity(sourceTurn, targetTurn, clientSubmissionId) {
			if (!targetTurn || typeof targetTurn !== "object") return "";
			const key = submittedTurnRenderKey(sourceTurn) || submittedTurnRenderKey(targetTurn) || localSubmissionRenderKey(clientSubmissionId);
			if (key) targetTurn.mobileLocalSubmissionRenderKey = key;
			return key;
		}
		const api = {
			firstSubmittedUserMessageClientSubmissionId,
			localSubmissionRenderKey,
			markSubmittedTurn,
			shortHash,
			stableTurnIdentity,
			submittedTurnRenderKey,
			transferSubmittedTurnIdentity
		};
		if (typeof module !== "undefined" && module.exports) module.exports = api;
		globalScope.CodexClientRenderStabilityGuard = api;
	})(typeof globalThis !== "undefined" ? globalThis : window);
}));
//#endregion
//#region public/live-operation-dock-state.js
var require_live_operation_dock_state = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexLiveOperationDockState = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		const DEFAULT_MIN_VISIBLE_MS = 500;
		function normalizeMode(mode) {
			return String(mode || "") === "expanded" ? "expanded" : "compact";
		}
		function text(value) {
			return String(value || "");
		}
		function isCompletedStatusText(value) {
			return /completed|failed|cancel|error|interrupted/i.test(text(value));
		}
		function nowValue(value) {
			const parsed = Number(value);
			return Number.isFinite(parsed) ? parsed : Date.now();
		}
		function containsBubble(html) {
			return text(html).includes("mobile-operation-bubble");
		}
		function containsSheet(html) {
			return text(html).includes("mobile-operation-sheet");
		}
		function rememberCompactBubble(input = {}) {
			const nowMs = nowValue(input.nowMs);
			const minVisibleMs = Math.max(0, Number(input.minVisibleMs || DEFAULT_MIN_VISIBLE_MS));
			const existingUntilMs = Number(input.existingVisibleUntilMs || 0);
			const html = text(input.html);
			const threadId = text(input.threadId);
			return {
				visibleUntilMs: Math.max(existingUntilMs, nowMs + minVisibleMs),
				html,
				threadId,
				recallHtml: html,
				recallThreadId: threadId,
				recallAtMs: nowMs
			};
		}
		function compactBubblePreservation(input = {}) {
			if (containsBubble(input.nextHtml)) return { preserve: false };
			if (input.liveTurnActive === false) return { preserve: false };
			const remainingMs = Number(input.visibleUntilMs || 0) - nowValue(input.nowMs);
			if (remainingMs <= 0) return { preserve: false };
			const savedThreadId = text(input.savedThreadId);
			if (!savedThreadId || savedThreadId !== text(input.currentThreadId)) return { preserve: false };
			const savedHtml = text(input.savedHtml);
			const dockHasBubble = Boolean(input.dockHasBubble);
			if (!dockHasBubble && !containsBubble(savedHtml)) return { preserve: false };
			return {
				preserve: true,
				remainingMs,
				patchSavedHtml: Boolean(savedHtml && !dockHasBubble),
				savedHtml
			};
		}
		function shouldPreservePinned(input = {}) {
			return Boolean(input.pinned && normalizeMode(input.mode) === "expanded" && text(input.pinnedThreadId) === text(input.currentThreadId) && input.dockHasSheet && input.liveTurnActive !== false && !containsBubble(input.nextHtml));
		}
		function shouldShowRecall(input = {}) {
			const recallThreadId = text(input.recallThreadId);
			return Boolean(input.isMobile && input.hasCurrentThread && !input.newThreadDraft && input.liveTurnActive !== false && recallThreadId && recallThreadId === text(input.currentThreadId) && containsSheet(input.recallHtml));
		}
		function operationCardContentPlan(input = {}) {
			const status = text(input.status || (input.completed ? "completed" : "running")).trim();
			const type = text(input.type || input.itemType || "item").trim() || "item";
			const title = text(input.title || type).trim() || type;
			const detail = text(input.detail).replace(/\s+/g, " ").trim();
			const durationText = text(input.durationText).trim();
			const extraClass = text(input.extraClass).trim();
			const completed = Boolean(input.completed || isCompletedStatusText(status));
			return {
				itemId: text(input.itemId).trim(),
				type,
				status,
				title,
				detail,
				detailEmpty: !detail,
				statusVisible: Boolean(status),
				durationVisible: Boolean(durationText),
				durationText,
				durationTitle: durationText ? `Elapsed ${durationText}` : "",
				durationAttrs: text(input.durationAttrs).trim(),
				classTokens: [
					"item",
					"live-operation",
					extraClass,
					completed ? "completed" : "",
					type
				].filter(Boolean)
			};
		}
		function htmlEscaper(input = {}) {
			return typeof input.escapeHtml === "function" ? input.escapeHtml : (value) => text(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
		}
		function durationAttributeHtml(value, escape) {
			const attrs = [];
			const input = text(value);
			const attrPattern = /\b(data-(?:started|completed|duration)-ms)="([^"]*)"/g;
			let match;
			while (match = attrPattern.exec(input)) attrs.push(`${match[1]}="${escape(match[2])}"`);
			return attrs.join(" ");
		}
		function operationCardHtml(input = {}) {
			const escape = htmlEscaper(input);
			const plan = input.plan || operationCardContentPlan(input);
			const renderKey = text(input.renderKey || input.key).trim();
			const durationAttrs = durationAttributeHtml(plan.durationAttrs, escape);
			const duration = plan.durationVisible ? `<time class="operation-duration" ${durationAttrs} title="${escape(plan.durationTitle)}">${escape(plan.durationText)}</time>` : "";
			const classes = (Array.isArray(plan.classTokens) ? plan.classTokens : []).map(escape).join(" ");
			const detailValue = plan.detail ? escape(plan.detail) : "&nbsp;";
			const body = `<div class="operation-detail-line${plan.detailEmpty ? " empty" : ""}"><span class="operation-detail">${detailValue}</span></div>`;
			const statusHtml = plan.statusVisible ? `<span class="operation-status">${escape(plan.status)}</span>` : "";
			return `<section class="${classes}" data-item="${escape(plan.itemId)}" data-render-key="${escape(renderKey)}">
    <div class="operation-meta-line"><span class="operation-meta-main"><span class="operation-title">${escape(plan.title)}</span>${statusHtml}</span>${duration}</div>
    ${body}
  </section>`;
		}
		return {
			DEFAULT_MIN_VISIBLE_MS,
			compactBubblePreservation,
			containsBubble,
			containsSheet,
			normalizeMode,
			operationCardContentPlan,
			operationCardHtml,
			rememberCompactBubble,
			shouldPreservePinned,
			shouldShowRecall
		};
	});
}));
//#endregion
//#region \0virtual:codex-mobile-esm-compatibility
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
var import_plugin_voice_input = /* @__PURE__ */ __toESM(require_plugin_voice_input());
var import_api_client = /* @__PURE__ */ __toESM(require_api_client());
var import_markdown_renderer = /* @__PURE__ */ __toESM(require_markdown_renderer());
var import_plugin_embed = /* @__PURE__ */ __toESM(require_plugin_embed());
var import_frontend_runtime_health = /* @__PURE__ */ __toESM(require_frontend_runtime_health());
var import_home_ai_diagnostic_reporting = /* @__PURE__ */ __toESM(require_home_ai_diagnostic_reporting());
var import_thread_diagnostic_events = /* @__PURE__ */ __toESM(require_thread_diagnostic_events());
var import_thread_tile_layout = /* @__PURE__ */ __toESM(require_thread_tile_layout());
var import_thread_tile_actions = /* @__PURE__ */ __toESM(require_thread_tile_actions());
var import_thread_tile_state = /* @__PURE__ */ __toESM(require_thread_tile_state());
var import_thread_tile_runtime = /* @__PURE__ */ __toESM(require_thread_tile_runtime());
var import_app_update_runtime = /* @__PURE__ */ __toESM(require_app_update_runtime());
var import_modal_runtime = /* @__PURE__ */ __toESM(require_modal_runtime());
var import_thread_list_runtime = /* @__PURE__ */ __toESM(require_thread_list_runtime());
var import_side_chat_runtime = /* @__PURE__ */ __toESM(require_side_chat_runtime());
var import_thread_list_load_policy = /* @__PURE__ */ __toESM(require_thread_list_load_policy());
var import_thread_list_stable_order = /* @__PURE__ */ __toESM(require_thread_list_stable_order());
var import_thread_status_hints = /* @__PURE__ */ __toESM(require_thread_status_hints());
var import_thread_detail_patch_plan = /* @__PURE__ */ __toESM(require_thread_detail_patch_plan());
var import_thread_detail_actions = /* @__PURE__ */ __toESM(require_thread_detail_actions());
var import_thread_detail_merge_state = /* @__PURE__ */ __toESM(require_thread_detail_merge_state());
var import_thread_detail_v4_merge_state = /* @__PURE__ */ __toESM(require_thread_detail_v4_merge_state());
var import_client_render_stability_guard = /* @__PURE__ */ __toESM(require_client_render_stability_guard());
var import_live_operation_dock_state = /* @__PURE__ */ __toESM(require_live_operation_dock_state());
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
		"classicLoaderExcluded": true
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
		"classicLoaderExcluded": true
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
		"classicLoaderExcluded": true
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
		"classicLoaderExcluded": true
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
		"classicLoaderExcluded": true
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
		"classicLoaderExcluded": true
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
		"classicLoaderExcluded": true
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
		"classicLoaderExcluded": true
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
		"classicLoaderExcluded": true
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
		"classicLoaderExcluded": true
	},
	{
		"id": "plugin-voice-input",
		"source": "public/plugin-voice-input.js",
		"globalName": "CodexPluginVoiceInput",
		"expectedFunctions": [
			"actionFromMessageType",
			"capabilityStateMessage",
			"errorMessage",
			"insertResultMessage",
			"isVoiceInputMessage",
			"normalizeAction",
			"startRequestMessage",
			"textFromMessage"
		],
		"assetPath": "/plugin-voice-input.js",
		"classicLoaderExcluded": true
	},
	{
		"id": "api-client",
		"source": "public/api-client.js",
		"globalName": "CodexApiClient",
		"expectedFunctions": ["createApiClient", "isFormDataBody"],
		"assetPath": "/api-client.js",
		"classicLoaderExcluded": true
	},
	{
		"id": "markdown-renderer",
		"source": "public/markdown-renderer.js",
		"globalName": "CodexMarkdownRenderer",
		"expectedFunctions": [
			"escapeHtml",
			"safeMarkdownUrl",
			"renderInlineMarkdown",
			"renderMarkdown",
			"renderMarkdownList",
			"renderMarkdownTable",
			"splitMarkdownTableRow",
			"isMarkdownTableSeparator"
		],
		"assetPath": "/markdown-renderer.js",
		"classicLoaderExcluded": true
	},
	{
		"id": "plugin-embed",
		"source": "public/plugin-embed.js",
		"globalName": "CodexPluginEmbed",
		"expectedFunctions": [
			"detect",
			"navigationMessage",
			"routeHintOpenPlan",
			"routeHintTargetSelectors",
			"scrubRouteHintPath",
			"externalLinkMessage",
			"refreshRequiredMessage"
		],
		"assetPath": "/plugin-embed.js",
		"classicLoaderExcluded": true
	},
	{
		"id": "frontend-runtime-health",
		"source": "public/frontend-runtime-health.js",
		"globalName": "CodexFrontendRuntimeHealth",
		"expectedFunctions": [
			"compactToken",
			"createMonitor",
			"submittedMessageDomProbeEffects",
			"threadListInteractionStallEffects",
			"renderChurnEvent",
			"domDropEvent",
			"runtimeSuccess"
		],
		"assetPath": "/frontend-runtime-health.js",
		"classicLoaderExcluded": true
	},
	{
		"id": "home-ai-diagnostic-reporting",
		"source": "public/home-ai-diagnostic-reporting.js",
		"globalName": "CodexHomeAiDiagnosticReporting",
		"expectedFunctions": [
			"boundedToken",
			"createDiagnosticReporter",
			"durationBucket",
			"hashIdentifier",
			"postReportToHomeAi",
			"sanitizeInput",
			"stableTextHash"
		],
		"assetPath": "/home-ai-diagnostic-reporting.js",
		"classicLoaderExcluded": true
	},
	{
		"id": "thread-diagnostic-events",
		"source": "public/thread-diagnostic-events.js",
		"globalName": "CodexThreadDiagnosticEvents",
		"expectedFunctions": [
			"boundedCount",
			"compactToken",
			"conversationProjectionDiagnosticSnapshot",
			"conversationProjectionConsistencyEffects",
			"projectionDiagnosticSnapshot",
			"renderSignatureMismatchDiagnosticEvent",
			"threadDetailResponseDiagnosticEffects",
			"turnOrderDiagnosticSnapshot"
		],
		"assetPath": "/thread-diagnostic-events.js",
		"classicLoaderExcluded": true
	},
	{
		"id": "thread-tile-layout",
		"source": "public/thread-tile-layout.js",
		"globalName": "CodexThreadTileLayout",
		"expectedFunctions": [
			"layoutForViewport",
			"normalizeSplitPairs",
			"selectPinnedThreadTileIds",
			"selectThreadTileIds",
			"threadTileColumnGroups"
		],
		"assetPath": "/thread-tile-layout.js",
		"classicLoaderExcluded": true
	},
	{
		"id": "thread-tile-actions",
		"source": "public/thread-tile-actions.js",
		"globalName": "CodexThreadTileActions",
		"expectedFunctions": [
			"closestWithin",
			"resolveThreadTilePointerAction",
			"resolveThreadTileFocusAction",
			"resolveThreadTileClickAction",
			"resolveThreadTileScrollAction",
			"resolveThreadTileDragStartAction",
			"resolveThreadTileDragOverAction",
			"resolveThreadTileDragLeaveAction",
			"resolveThreadTileDropAction"
		],
		"assetPath": "/thread-tile-actions.js",
		"classicLoaderExcluded": true
	},
	{
		"id": "thread-tile-state",
		"source": "public/thread-tile-state.js",
		"globalName": "CodexThreadTileState",
		"expectedFunctions": [
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
			"uniqueIds"
		],
		"assetPath": "/thread-tile-state.js",
		"classicLoaderExcluded": true
	},
	{
		"id": "thread-tile-runtime",
		"source": "public/thread-tile-runtime.js",
		"globalName": "CodexThreadTileRuntime",
		"expectedFunctions": ["createThreadTileRuntime"],
		"assetPath": "/thread-tile-runtime.js",
		"classicLoaderExcluded": true
	},
	{
		"id": "app-update-runtime",
		"source": "public/app-update-runtime.js",
		"globalName": "CodexAppUpdateRuntime",
		"expectedFunctions": ["createAppUpdateRuntime"],
		"assetPath": "/app-update-runtime.js",
		"classicLoaderExcluded": true
	},
	{
		"id": "modal-runtime",
		"source": "public/modal-runtime.js",
		"globalName": "CodexModalRuntime",
		"expectedFunctions": ["createModalRuntime"],
		"assetPath": "/modal-runtime.js",
		"classicLoaderExcluded": true
	},
	{
		"id": "thread-list-runtime",
		"source": "public/thread-list-runtime.js",
		"globalName": "CodexThreadListRuntime",
		"expectedFunctions": ["createThreadListRuntime"],
		"assetPath": "/thread-list-runtime.js",
		"classicLoaderExcluded": true
	},
	{
		"id": "side-chat-runtime",
		"source": "public/side-chat-runtime.js",
		"globalName": "CodexSideChatRuntime",
		"expectedFunctions": ["createSideChatRuntime"],
		"assetPath": "/side-chat-runtime.js",
		"classicLoaderExcluded": true
	},
	{
		"id": "thread-list-load-policy",
		"source": "public/thread-list-load-policy.js",
		"globalName": "CodexThreadListLoadPolicy",
		"expectedFunctions": ["planThreadListLoadRequest"],
		"assetPath": "/thread-list-load-policy.js",
		"classicLoaderExcluded": true
	},
	{
		"id": "thread-list-stable-order",
		"source": "public/thread-list-stable-order.js",
		"globalName": "CodexThreadListStableOrder",
		"expectedFunctions": ["threadListOrderScopeKey", "planThreadListStableOrder"],
		"assetPath": "/thread-list-stable-order.js",
		"classicLoaderExcluded": true
	},
	{
		"id": "thread-status-hints",
		"source": "public/thread-status-hints.js",
		"globalName": "CodexThreadStatusHints",
		"expectedFunctions": [
			"isRunningStatus",
			"shouldExpireRunningThreadHint",
			"shouldMarkThreadUnread"
		],
		"assetPath": "/thread-status-hints.js",
		"classicLoaderExcluded": true
	},
	{
		"id": "thread-detail-patch-plan",
		"source": "public/thread-detail-patch-plan.js",
		"globalName": "CodexThreadDetailPatchPlan",
		"expectedFunctions": [
			"planThreadDetailDomPatchSurface",
			"planThreadDetailRefreshDomPatch",
			"planVisibleItemRefreshPatch"
		],
		"assetPath": "/thread-detail-patch-plan.js",
		"classicLoaderExcluded": true
	},
	{
		"id": "thread-detail-actions",
		"source": "public/thread-detail-actions.js",
		"globalName": "CodexThreadDetailActions",
		"expectedFunctions": [
			"closestWithin",
			"contextThreadIdFromNode",
			"previewableImageFromTarget",
			"resolveRichContentClickAction",
			"resolveThreadDetailClickAction"
		],
		"assetPath": "/thread-detail-actions.js",
		"classicLoaderExcluded": true
	},
	{
		"id": "thread-detail-merge-state",
		"source": "public/thread-detail-merge-state.js",
		"globalName": "CodexThreadDetailMergeState",
		"expectedFunctions": ["createThreadDetailMergePolicy"],
		"assetPath": "/thread-detail-merge-state.js",
		"classicLoaderExcluded": true
	},
	{
		"id": "thread-detail-v4-merge-state",
		"source": "public/thread-detail-v4-merge-state.js",
		"globalName": "CodexThreadDetailV4MergeState",
		"expectedFunctions": ["createThreadDetailV4MergePolicy"],
		"assetPath": "/thread-detail-v4-merge-state.js",
		"classicLoaderExcluded": true
	},
	{
		"id": "client-render-stability-guard",
		"source": "public/client-render-stability-guard.js",
		"globalName": "CodexClientRenderStabilityGuard",
		"expectedFunctions": [
			"firstSubmittedUserMessageClientSubmissionId",
			"localSubmissionRenderKey",
			"markSubmittedTurn",
			"shortHash",
			"stableTurnIdentity",
			"submittedTurnRenderKey",
			"transferSubmittedTurnIdentity"
		],
		"assetPath": "/client-render-stability-guard.js",
		"classicLoaderExcluded": true
	},
	{
		"id": "live-operation-dock-state",
		"source": "public/live-operation-dock-state.js",
		"globalName": "CodexLiveOperationDockState",
		"expectedFunctions": [
			"compactBubblePreservation",
			"operationCardContentPlan",
			"shouldShowRecall"
		],
		"assetPath": "/live-operation-dock-state.js",
		"classicLoaderExcluded": true
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
	"image-compressor": import_image_compressor.default,
	"plugin-voice-input": import_plugin_voice_input.default,
	"api-client": import_api_client.default,
	"markdown-renderer": import_markdown_renderer.default,
	"plugin-embed": import_plugin_embed.default,
	"frontend-runtime-health": import_frontend_runtime_health.default,
	"home-ai-diagnostic-reporting": import_home_ai_diagnostic_reporting.default,
	"thread-diagnostic-events": import_thread_diagnostic_events.default,
	"thread-tile-layout": import_thread_tile_layout.default,
	"thread-tile-actions": import_thread_tile_actions.default,
	"thread-tile-state": import_thread_tile_state.default,
	"thread-tile-runtime": import_thread_tile_runtime.default,
	"app-update-runtime": import_app_update_runtime.default,
	"modal-runtime": import_modal_runtime.default,
	"thread-list-runtime": import_thread_list_runtime.default,
	"side-chat-runtime": import_side_chat_runtime.default,
	"thread-list-load-policy": import_thread_list_load_policy.default,
	"thread-list-stable-order": import_thread_list_stable_order.default,
	"thread-status-hints": import_thread_status_hints.default,
	"thread-detail-patch-plan": import_thread_detail_patch_plan.default,
	"thread-detail-actions": import_thread_detail_actions.default,
	"thread-detail-merge-state": import_thread_detail_merge_state.default,
	"thread-detail-v4-merge-state": import_thread_detail_v4_merge_state.default,
	"client-render-stability-guard": import_client_render_stability_guard.default,
	"live-operation-dock-state": import_live_operation_dock_state.default
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
