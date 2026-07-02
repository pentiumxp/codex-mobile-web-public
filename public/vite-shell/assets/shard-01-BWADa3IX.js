import { i as __toESM, r as __commonJSMin } from "./vite-shell-entry-BEtgdOLS.js";
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
//#region \0virtual:codex-mobile-esm-compatibility/shard/shard-01
var import_build_refresh_policy = /* @__PURE__ */ __toESM(require_build_refresh_policy());
var import_runtime_settings = /* @__PURE__ */ __toESM(require_runtime_settings());
var import_viewport_metrics = /* @__PURE__ */ __toESM(require_viewport_metrics());
var import_conversation_scroll = /* @__PURE__ */ __toESM(require_conversation_scroll());
var import_draft_store = /* @__PURE__ */ __toESM(require_draft_store());
var import_image_compressor = /* @__PURE__ */ __toESM(require_image_compressor());
var import_plugin_voice_input = /* @__PURE__ */ __toESM(require_plugin_voice_input());
var import_plugin_embed = /* @__PURE__ */ __toESM(require_plugin_embed());
var import_frontend_runtime_health = /* @__PURE__ */ __toESM(require_frontend_runtime_health());
var import_home_ai_diagnostic_reporting = /* @__PURE__ */ __toESM(require_home_ai_diagnostic_reporting());
var import_thread_diagnostic_events = /* @__PURE__ */ __toESM(require_thread_diagnostic_events());
var import_thread_tile_layout = /* @__PURE__ */ __toESM(require_thread_tile_layout());
var import_thread_tile_actions = /* @__PURE__ */ __toESM(require_thread_tile_actions());
var import_thread_list_load_policy = /* @__PURE__ */ __toESM(require_thread_list_load_policy());
var import_thread_list_stable_order = /* @__PURE__ */ __toESM(require_thread_list_stable_order());
var import_thread_status_hints = /* @__PURE__ */ __toESM(require_thread_status_hints());
var import_thread_detail_patch_plan = /* @__PURE__ */ __toESM(require_thread_detail_patch_plan());
var import_thread_detail_merge_state = /* @__PURE__ */ __toESM(require_thread_detail_merge_state());
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
		"classicLoaderExcluded": true,
		"bytes": 8247
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
		"classicLoaderExcluded": true,
		"bytes": 14761
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
		"classicLoaderExcluded": true,
		"bytes": 17014
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
		"classicLoaderExcluded": true,
		"bytes": 14358
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
		"classicLoaderExcluded": true,
		"bytes": 46238
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
		"classicLoaderExcluded": true,
		"bytes": 8454
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
		"classicLoaderExcluded": true,
		"bytes": 7380
	},
	{
		"id": "thread-list-load-policy",
		"source": "public/thread-list-load-policy.js",
		"globalName": "CodexThreadListLoadPolicy",
		"expectedFunctions": ["planThreadListLoadRequest"],
		"assetPath": "/thread-list-load-policy.js",
		"classicLoaderExcluded": true,
		"bytes": 2160
	},
	{
		"id": "thread-list-stable-order",
		"source": "public/thread-list-stable-order.js",
		"globalName": "CodexThreadListStableOrder",
		"expectedFunctions": ["threadListOrderScopeKey", "planThreadListStableOrder"],
		"assetPath": "/thread-list-stable-order.js",
		"classicLoaderExcluded": true,
		"bytes": 3327
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
		"classicLoaderExcluded": true,
		"bytes": 9883
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
		"classicLoaderExcluded": true,
		"bytes": 8310
	},
	{
		"id": "thread-detail-merge-state",
		"source": "public/thread-detail-merge-state.js",
		"globalName": "CodexThreadDetailMergeState",
		"expectedFunctions": ["createThreadDetailMergePolicy"],
		"assetPath": "/thread-detail-merge-state.js",
		"classicLoaderExcluded": true,
		"bytes": 8461
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
		"classicLoaderExcluded": true,
		"bytes": 2528
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
		"classicLoaderExcluded": true,
		"bytes": 6190
	}
];
var moduleApis = {
	"build-refresh-policy": import_build_refresh_policy.default,
	"runtime-settings": import_runtime_settings.default,
	"viewport-metrics": import_viewport_metrics.default,
	"conversation-scroll": import_conversation_scroll.default,
	"draft-store": import_draft_store.default,
	"image-compressor": import_image_compressor.default,
	"plugin-voice-input": import_plugin_voice_input.default,
	"plugin-embed": import_plugin_embed.default,
	"frontend-runtime-health": import_frontend_runtime_health.default,
	"home-ai-diagnostic-reporting": import_home_ai_diagnostic_reporting.default,
	"thread-diagnostic-events": import_thread_diagnostic_events.default,
	"thread-tile-layout": import_thread_tile_layout.default,
	"thread-tile-actions": import_thread_tile_actions.default,
	"thread-list-load-policy": import_thread_list_load_policy.default,
	"thread-list-stable-order": import_thread_list_stable_order.default,
	"thread-status-hints": import_thread_status_hints.default,
	"thread-detail-patch-plan": import_thread_detail_patch_plan.default,
	"thread-detail-merge-state": import_thread_detail_merge_state.default,
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
	if (id === "navigation-runtime") {
		const runtime = functionReady(api, "createNavigationRuntime") ? api.createNavigationRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.updateConnectionState === "function" && typeof runtime.restoreConnectionState === "function" && typeof runtime.markActivity === "function" && typeof runtime.composerTargetPlan === "function" && typeof runtime.visibleTurnsForConversation === "function" && typeof runtime.conversationRenderSignature === "function" && typeof runtime.updateTurnTimer === "function" && typeof globalThis.updateConnectionState === "function" && typeof globalThis.composerTargetPlan === "function" && typeof globalThis.visibleTurnsForConversation === "function",
			factoryType: typeof api.createNavigationRuntime,
			updateType: typeof (runtime && runtime.updateConnectionState),
			restoreType: typeof (runtime && runtime.restoreConnectionState),
			activityType: typeof (runtime && runtime.markActivity),
			composerPlanType: typeof (runtime && runtime.composerTargetPlan),
			visibleTurnsType: typeof (runtime && runtime.visibleTurnsForConversation),
			signatureType: typeof (runtime && runtime.conversationRenderSignature),
			timerType: typeof (runtime && runtime.updateTurnTimer),
			globalUpdateType: typeof globalThis.updateConnectionState,
			globalComposerPlanType: typeof globalThis.composerTargetPlan,
			globalVisibleTurnsType: typeof globalThis.visibleTurnsForConversation
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
	if (id === "pane-layout-runtime") {
		const runtime = functionReady(api, "createPaneLayoutRuntime") ? api.createPaneLayoutRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.renderCurrentThread === "function" && typeof runtime.updateConversationHtml === "function" && typeof runtime.patchCurrentThreadDetailFromRefresh === "function" && typeof runtime.syncThreadTileToggle === "function" && typeof runtime.setThreadTileMode === "function" && typeof runtime.renderHome === "function" && typeof runtime.loadThread === "function" && typeof runtime.loadThreads === "function" && typeof runtime.enterNewThreadDraft === "function" && typeof runtime.handleThreadCardClick === "function" && typeof runtime.showHermesPluginPrimaryPage === "function" && typeof runtime.returnToThreadListFromDetail === "function" && typeof globalThis.loadThread === "function" && typeof globalThis.loadThreads === "function" && typeof globalThis.renderCurrentThread === "function",
			factoryType: typeof api.createPaneLayoutRuntime,
			renderType: typeof (runtime && runtime.renderCurrentThread),
			updateHtmlType: typeof (runtime && runtime.updateConversationHtml),
			patchType: typeof (runtime && runtime.patchCurrentThreadDetailFromRefresh),
			tileToggleType: typeof (runtime && runtime.syncThreadTileToggle),
			tileModeType: typeof (runtime && runtime.setThreadTileMode),
			homeType: typeof (runtime && runtime.renderHome),
			loadThreadType: typeof (runtime && runtime.loadThread),
			loadThreadsType: typeof (runtime && runtime.loadThreads),
			newThreadType: typeof (runtime && runtime.enterNewThreadDraft),
			cardClickType: typeof (runtime && runtime.handleThreadCardClick),
			pluginPrimaryType: typeof (runtime && runtime.showHermesPluginPrimaryPage),
			returnType: typeof (runtime && runtime.returnToThreadListFromDetail),
			globalLoadThreadType: typeof globalThis.loadThread,
			globalLoadThreadsType: typeof globalThis.loadThreads,
			globalRenderType: typeof globalThis.renderCurrentThread
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
