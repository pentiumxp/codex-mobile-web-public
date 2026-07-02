import { n as __toESM, t as __commonJSMin } from "./rolldown-runtime-FDOR9p9I.js";
//#region public/api-client-runtime.js
var require_api_client_runtime = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function attachApiClientRuntime(root) {
		async function api(path, options = {}) {
			return apiClient.request(path, options);
		}
		function postClientEvent(event, details = {}) {
			if (!state.key) return;
			const payload = JSON.stringify({
				event,
				threadId: state.currentThreadId || "",
				path: location.pathname || "/",
				details
			});
			const url = `/api/client-events?key=${encodeURIComponent(state.key)}`;
			fetch(url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: payload,
				keepalive: true
			}).catch(() => {
				try {
					if (navigator.sendBeacon) {
						const blob = new Blob([payload], { type: "application/json" });
						navigator.sendBeacon(url, blob);
					}
				} catch (_) {}
			});
		}
		function nowPerfMs() {
			return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
		}
		function roundedDurationMs(startedAt) {
			return Math.max(0, Math.round(nowPerfMs() - Number(startedAt || 0)));
		}
		function postPerformanceEvent(event, details = {}, options = {}) {
			const now = Date.now();
			const key = String(options.key || event || "");
			const minIntervalMs = Math.max(0, Number(options.minIntervalMs || 0));
			if (key && minIntervalMs > 0) {
				const last = Number(state.perfEventLastReportedAt[key] || 0);
				if (!options.force && last && now - last < minIntervalMs) return false;
				state.perfEventLastReportedAt[key] = now;
			}
			postClientEvent(event, Object.assign({
				pwa: isPwaMode(),
				embedded: isHermesEmbedMode(),
				visibility: document.visibilityState || "",
				clientBuildId: CLIENT_BUILD_ID
			}, details || {}));
			return true;
		}
		function diagnosticHash(value) {
			return homeAiDiagnosticReportingApi.hashIdentifier(String(value || ""), "h");
		}
		function diagnosticThreadHash(threadId = state.currentThreadId) {
			const id = String(threadId || "").trim();
			return id ? diagnosticHash(`thread:${id}`) : "";
		}
		function diagnosticTurnHash(turnId) {
			const id = String(turnId || "").trim();
			return id ? diagnosticHash(`turn:${id}`) : "";
		}
		function diagnosticTaskHash(taskId) {
			const id = String(taskId || "").trim();
			return id ? diagnosticHash(`task:${id}`) : "";
		}
		function diagnosticItemHash(itemId) {
			const id = String(itemId || "").trim();
			return id ? diagnosticHash(`item:${id}`) : "";
		}
		function clientSubmissionDiagnosticHash(clientSubmissionId) {
			const id = String(clientSubmissionId || "").trim();
			return id ? diagnosticHash(`submission:${id}`) : "";
		}
		function clientSubmissionDataAttr(item) {
			const hash = clientSubmissionDiagnosticHash(item && item.clientSubmissionId);
			return hash ? ` data-client-submission-hash="${escapeHtml(hash)}"` : "";
		}
		function diagnosticRouteKind() {
			if (state.newThreadDraft) return "new-thread";
			if (isHermesEmbedMode() && isHermesPluginPrimaryPage()) return "embedded-primary";
			if (state.threadTileMode) return "thread-tile";
			if (state.currentThreadId) return "thread-detail";
			return isHermesEmbedMode() ? "embedded-root" : "standalone-root";
		}
		function diagnosticErrorStatus(err) {
			let status = Number(err && (err.status || err.statusCode) || 0);
			if ((!Number.isFinite(status) || status <= 0) && err && /^\d+$/.test(String(err.code || ""))) status = Number(err.code);
			return Number.isFinite(status) && status > 0 ? status : 0;
		}
		function diagnosticErrorCode(err, fallback = "runtime_failed") {
			const explicit = String(err && err.code || "").trim();
			if (explicit && !/^\d+$/.test(explicit)) return homeAiDiagnosticReportingApi.boundedToken(explicit, fallback, 100);
			const status = diagnosticErrorStatus(err);
			if (status) return `http_${status}`;
			const message = String(err && err.message || err || "").toLowerCase();
			if (message.includes("request timed out")) return "request_timeout";
			if (message.includes("request cancelled")) return "request_cancelled";
			if (message.includes("failed to fetch")) return "network_fetch_failed";
			if (message.includes("not visible")) return "target_thread_not_visible";
			if (message.includes("terminal") && message.includes("return")) return "terminal_card_no_return_required";
			return fallback;
		}
		function diagnosticDurationBucket(ms) {
			return homeAiDiagnosticReportingApi.durationBucket(ms);
		}
		function currentHomeAiDiagnosticContext(extra = {}) {
			const context = Object.assign({
				surface: "runtime",
				action: "unknown",
				route_kind: diagnosticRouteKind(),
				build_id: CLIENT_BUILD_ID,
				shell_cache: CLIENT_BUILD_ID.split("|").pop() || "",
				thread_hash: diagnosticThreadHash(),
				embedded: isHermesEmbedMode(),
				pwa: isPwaMode(),
				client_visibility: document.visibilityState || ""
			}, extra || {});
			if (!context.thread_hash) delete context.thread_hash;
			return context;
		}
		function postHomeAiDiagnosticReport(report, meta = {}) {
			const targetOrigin = normalizePluginParentOrigin(state.pluginParentOrigin);
			if (targetOrigin) state.pluginParentOrigin = targetOrigin;
			const result = homeAiDiagnosticReportingApi.postReportToHomeAi({
				report,
				embedded: isHermesEmbedMode(),
				parentWindow: window.parent,
				selfWindow: window,
				targetOrigin: targetOrigin || "*"
			});
			postClientEvent("home_ai_diagnostic_report_post", {
				ok: Boolean(result.ok),
				reason: result.reason || "",
				category: report && report.category || "",
				diagnostic_type: report && report.diagnostic_type || "",
				error_code: report && report.error_code || "",
				signature: meta.signature || "",
				repeatedFailures: Number(meta.repeatedFailures || 0)
			});
			return result;
		}
		function recordHomeAiDiagnosticFailure(input = {}) {
			const result = state.homeAiDiagnosticReporter.recordFailure(Object.assign({}, input, { context: currentHomeAiDiagnosticContext(input.context || {}) }));
			postClientEvent("home_ai_diagnostic_failure_recorded", {
				category: input.category || "",
				diagnostic_type: input.diagnostic_type || input.diagnosticType || "",
				error_code: input.error_code || input.errorCode || "",
				eligible: Boolean(result.eligible),
				repeatedFailures: Number(result.repeatedFailures || 0),
				threshold: Number(result.threshold || 0),
				signature: result.signature || "",
				observeOnly: Boolean(result.observeOnly),
				reason: result.reason || ""
			});
			if (result.report) postHomeAiDiagnosticReport(result.report, result);
			return result;
		}
		function recordHomeAiDiagnosticSuccess(input = {}) {
			return state.homeAiDiagnosticReporter.recordSuccess(Object.assign({}, input, { context: currentHomeAiDiagnosticContext(input.context || {}) }));
		}
		function applyFrontendRuntimeHealthEffect(effect) {
			const item = effect && typeof effect === "object" ? effect : {};
			if (!item.type) return;
			if (item.type === "diagnostic-failure") {
				recordHomeAiDiagnosticFailure(item.diagnostic || {});
				return;
			}
			if (item.type === "diagnostic-success") {
				recordHomeAiDiagnosticSuccess(item.diagnostic || {});
				return;
			}
			throw new Error(`Unknown frontend runtime health effect: ${item.type}`);
		}
		function applyFrontendRuntimeHealthEffectsPlan(plan) {
			const effects = Array.isArray(plan && plan.effects) ? plan.effects : [];
			for (const effect of effects) applyFrontendRuntimeHealthEffect(effect);
		}
		function threadListRuntimeMetrics() {
			const list = $("threadList");
			if (!list || typeof list.getBoundingClientRect !== "function") return {
				present: false,
				visible: false,
				threadListCount: 0,
				scrollTop: 0,
				scrollHeight: 0
			};
			const rect = list.getBoundingClientRect();
			const viewportWidth = Math.max(0, window.innerWidth || document.documentElement.clientWidth || 0);
			const viewportHeight = Math.max(0, window.innerHeight || document.documentElement.clientHeight || 0);
			return {
				present: true,
				visible: document.visibilityState !== "hidden" && rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < viewportHeight && rect.left < viewportWidth,
				threadListCount: list.querySelectorAll("[data-thread]").length,
				scrollTop: Math.max(0, Math.round(Number(list.scrollTop || 0))),
				scrollHeight: Math.max(0, Math.round(Number(list.scrollHeight || 0)))
			};
		}
		function recordThreadListRuntimeStall(input = {}) {
			const now = Date.now();
			if (now - Number(state.threadListRuntimeLastReportAt || 0) < THREAD_LIST_RUNTIME_STALL_REPORT_INTERVAL_MS) return false;
			const metrics = threadListRuntimeMetrics();
			const routeKind = diagnosticRouteKind();
			const threadListMonitorable = metrics.visible || metrics.present && document.visibilityState !== "hidden" && (routeKind === "embedded-primary" || routeKind === "standalone-root");
			const plan = frontendRuntimeHealthApi.threadListInteractionStallEffects(Object.assign({
				threadListVisible: metrics.visible,
				threadListMonitorable,
				routeKind,
				minDelayMs: THREAD_LIST_RUNTIME_STALL_MIN_MS,
				h2ThresholdMs: THREAD_LIST_RUNTIME_STALL_H2_MS,
				threadListCount: metrics.threadListCount,
				scrollTop: metrics.scrollTop,
				scrollHeight: metrics.scrollHeight
			}, input || {}));
			if (!plan.effects || !plan.effects.length) return false;
			state.threadListRuntimeLastReportAt = now;
			applyFrontendRuntimeHealthEffectsPlan(plan);
			postPerformanceEvent("thread_list_runtime_stall", {
				action: input.action || "thread-list-runtime",
				routeKind,
				maxRafDelayMs: Math.max(0, Math.round(Number(input.maxRafDelayMs || 0))),
				maxScrollApplyMs: Math.max(0, Math.round(Number(input.maxScrollApplyMs || 0))),
				maxLongTaskMs: Math.max(0, Math.round(Number(input.maxLongTaskMs || 0))),
				longTaskCount: Math.max(0, Math.round(Number(input.longTaskCount || 0))),
				threadListCount: metrics.threadListCount,
				threadListVisible: Boolean(metrics.visible),
				threadListMonitorable: Boolean(threadListMonitorable)
			}, {
				key: "thread-list-runtime-stall",
				minIntervalMs: THREAD_LIST_RUNTIME_STALL_REPORT_INTERVAL_MS
			});
			return true;
		}
		function sampleThreadListInputDelay(action = "thread-list-input") {
			if (!threadListRuntimeMetrics().visible) return;
			const list = $("threadList");
			const startedAt = nowPerfMs();
			const startScrollTop = list ? Number(list.scrollTop || 0) : 0;
			requestAnimationFrame(() => {
				const rafDelayMs = roundedDurationMs(startedAt);
				requestAnimationFrame(() => {
					const elapsedMs = roundedDurationMs(startedAt);
					const scrollApplyMs = (list ? Number(list.scrollTop || 0) : startScrollTop) !== startScrollTop ? elapsedMs : rafDelayMs;
					recordThreadListRuntimeStall({
						action,
						maxRafDelayMs: rafDelayMs,
						maxScrollApplyMs: scrollApplyMs,
						elapsedMs
					});
				});
			});
		}
		function startThreadListRuntimeHeartbeat() {
			if (state.threadListRuntimeHeartbeatFrame) return;
			const tick = (timestamp) => {
				const previous = Number(state.threadListRuntimeLastFrameAt || 0);
				if (previous > 0) {
					const delayMs = Math.max(0, Math.round(Number(timestamp || 0) - previous));
					if (delayMs >= THREAD_LIST_RUNTIME_STALL_MIN_MS) recordThreadListRuntimeStall({
						action: "thread-list-heartbeat",
						maxRafDelayMs: delayMs,
						elapsedMs: delayMs
					});
				}
				state.threadListRuntimeLastFrameAt = Number(timestamp || nowPerfMs());
				state.threadListRuntimeHeartbeatFrame = requestAnimationFrame(tick);
			};
			state.threadListRuntimeHeartbeatFrame = requestAnimationFrame(tick);
		}
		function startThreadListRuntimeLongTaskObserver() {
			if (state.threadListRuntimeLongTaskObserver || typeof PerformanceObserver !== "function") return;
			try {
				const observer = new PerformanceObserver((list) => {
					let maxLongTaskMs = 0;
					let longTaskCount = 0;
					for (const entry of list.getEntries()) {
						const duration = Math.max(0, Math.round(Number(entry && entry.duration || 0)));
						if (duration < THREAD_LIST_RUNTIME_STALL_MIN_MS) continue;
						maxLongTaskMs = Math.max(maxLongTaskMs, duration);
						longTaskCount += 1;
					}
					if (maxLongTaskMs > 0) recordThreadListRuntimeStall({
						action: "thread-list-longtask",
						maxLongTaskMs,
						longTaskCount,
						elapsedMs: maxLongTaskMs
					});
				});
				observer.observe({
					type: "longtask",
					buffered: true
				});
				state.threadListRuntimeLongTaskObserver = observer;
			} catch (_) {
				state.threadListRuntimeLongTaskObserver = null;
			}
		}
		function startThreadListRuntimeStallMonitoring() {
			const list = $("threadList");
			if (list) [
				"pointerdown",
				"touchstart",
				"wheel",
				"scroll"
			].forEach((eventName) => {
				list.addEventListener(eventName, () => sampleThreadListInputDelay(`thread-list-${eventName}`), { passive: true });
			});
			document.addEventListener("visibilitychange", () => {
				if (document.visibilityState === "hidden") state.threadListRuntimeLastFrameAt = 0;
			});
			startThreadListRuntimeHeartbeat();
			startThreadListRuntimeLongTaskObserver();
		}
		function conversationHasClientSubmissionHash(submissionHash) {
			const hash = String(submissionHash || "").trim();
			const conversation = $("conversation");
			if (!hash || !conversation) return false;
			return Array.from(conversation.querySelectorAll("[data-client-submission-hash]")).some((node) => String(node && node.getAttribute && node.getAttribute("data-client-submission-hash") || "") === hash);
		}
		function frontendHealthThreadForSubmission(threadId) {
			const id = String(threadId || "").trim();
			if (!id) return null;
			if (state.currentThread && String(state.currentThread.id || "") === id) return state.currentThread;
			return state.threadTileDetails && state.threadTileDetails.get(id) || null;
		}
		function probeSubmittedMessageDom(threadId, clientSubmissionId, action = "message-submit", startedAtMs = Date.now()) {
			const id = String(threadId || "").trim();
			const submissionId = String(clientSubmissionId || "").trim();
			const submissionHash = clientSubmissionDiagnosticHash(submissionId);
			if (!id || !submissionId || !submissionHash) return;
			const thread = frontendHealthThreadForSubmission(id);
			const domShape = conversationDomShape();
			const visibleShape = thread ? visibleConversationShape(thread) : { visibleItemCount: 0 };
			applyFrontendRuntimeHealthEffectsPlan(frontendRuntimeHealthApi.submittedMessageDomProbeEffects({
				elapsedMs: Date.now() - Number(startedAtMs || Date.now()),
				action,
				routeKind: diagnosticRouteKind(),
				threadHash: diagnosticThreadHash(id),
				itemHash: submissionHash,
				currentThreadMatch: !state.threadTileMode && String(state.currentThreadId || "") === id,
				hasThreadSubmission: threadHasClientSubmission(thread, submissionId),
				domHasSubmission: conversationHasClientSubmissionHash(submissionHash),
				visibleCount: visibleShape.visibleItemCount,
				domCount: domShape.itemCount,
				composerBusy: state.composerBusy
			}));
		}
		function scheduleSubmittedMessageDomProbe(threadId, clientSubmissionId, action = "message-submit") {
			const id = String(threadId || "").trim();
			const submissionId = String(clientSubmissionId || "").trim();
			if (!id || !submissionId) return;
			const startedAtMs = Date.now();
			[
				350,
				1200,
				2800
			].forEach((delayMs) => {
				setTimeout(() => probeSubmittedMessageDom(id, submissionId, action, startedAtMs), delayMs);
			});
		}
		function applyThreadDetailResponseDiagnosticEffect(effect) {
			const item = effect && typeof effect === "object" ? effect : {};
			if (!item.type) return;
			if (item.type === "diagnostic-failure") {
				recordHomeAiDiagnosticFailure(item.diagnostic || {});
				return;
			}
			if (item.type === "diagnostic-success") {
				recordHomeAiDiagnosticSuccess(item.diagnostic || {});
				return;
			}
			throw new Error(`Unknown thread detail response diagnostic effect: ${item.type}`);
		}
		function applyThreadDetailResponseDiagnosticEffectsPlan(plan) {
			const effects = Array.isArray(plan && plan.effects) ? plan.effects : [];
			for (const effect of effects) applyThreadDetailResponseDiagnosticEffect(effect);
		}
		function recordThreadDetailResponseDiagnostics(performanceEvent = {}, input = {}) {
			const source = input && typeof input === "object" ? input : {};
			const threadHash = diagnosticThreadHash(String(source.threadId || state.currentThreadId || ""));
			const action = String(source.action || "thread-detail").slice(0, 80);
			const durationBucket = source.durationBucket || diagnosticDurationBucket(Number(performanceEvent && performanceEvent.elapsedMs || 0));
			const slowPlan = threadPerformanceMetrics.planThreadDetailSlowPathDiagnostic(performanceEvent, {
				action,
				threadHash,
				durationBucket
			});
			const contractPlan = threadPerformanceMetrics.planThreadDetailResponseContractDiagnostic(performanceEvent, {
				action,
				threadHash,
				durationBucket,
				thread: source.thread,
				expectedActiveFullRead: source.expectedActiveFullRead
			});
			applyThreadDetailResponseDiagnosticEffectsPlan(threadDiagnosticEventsApi.threadDetailResponseDiagnosticEffects({
				slowPlan,
				slowSuccessInput: {
					action,
					threadHash,
					readMode: performanceEvent && performanceEvent.readMode || "",
					renderMode: performanceEvent && performanceEvent.clientTimings && performanceEvent.clientTimings.detailRenderMode || ""
				},
				contractPlan
			}));
		}
		function conversationDomShape() {
			const conversation = $("conversation");
			if (!conversation) return {
				renderKeyCount: 0,
				duplicateRenderKeyCount: 0,
				duplicateUserMessageCount: 0,
				turnCount: 0,
				itemCount: 0
			};
			const seen = /* @__PURE__ */ new Set();
			let duplicateRenderKeyCount = 0;
			for (const node of Array.from(conversation.querySelectorAll("[data-render-key]"))) {
				const key = String(node && node.getAttribute && node.getAttribute("data-render-key") || "");
				if (!key) continue;
				if (seen.has(key)) duplicateRenderKeyCount += 1;
				else seen.add(key);
			}
			let duplicateUserMessageCount = 0;
			const userMessageNodes = [];
			for (const turnNode of Array.from(conversation.querySelectorAll("article.turn[data-turn], article.thread-tile-turn[data-thread-tile-turn]"))) for (const node of Array.from(turnNode.querySelectorAll(".item.userMessage"))) userMessageNodes.push({
				turnNode,
				node
			});
			duplicateUserMessageCount = duplicateUserMessageSignatureCount(userMessageNodes, (entry) => domUserMessageEventDuplicateSignature(entry.turnNode, entry.node));
			return {
				renderKeyCount: seen.size,
				duplicateRenderKeyCount,
				duplicateUserMessageCount,
				turnCount: conversation.querySelectorAll("article.turn[data-turn], article.thread-tile-turn[data-thread-tile-turn]").length,
				itemCount: conversation.querySelectorAll("[data-item]").length
			};
		}
		function duplicateUserMessageSignatureCount(entries, signatureForEntry) {
			const seen = /* @__PURE__ */ new Set();
			let duplicates = 0;
			for (const entry of Array.isArray(entries) ? entries : []) {
				const signature = String(signatureForEntry(entry) || "").trim();
				if (!signature) continue;
				if (seen.has(signature)) duplicates += 1;
				else seen.add(signature);
			}
			return duplicates;
		}
		function domUserMessageDuplicateSignature(turnNode, node) {
			if (!node || !node.getAttribute) return "";
			const turnId = String(turnNode && turnNode.getAttribute && (turnNode.getAttribute("data-turn") || turnNode.getAttribute("data-thread-tile-turn")) || "").trim();
			const submissionHash = String(node.getAttribute("data-client-submission-hash") || "").trim();
			if (submissionHash) return `submission:${turnId}:${submissionHash}`;
			const body = node.querySelector && node.querySelector(".item-body");
			const text = String((body || node).textContent || "").replace(/\s+/g, " ").trim();
			return text ? `text:${turnId}:${stableTextHash(text)}` : "";
		}
		function domUserMessageEventDuplicateSignature(turnNode, node) {
			if (!node || !node.getAttribute) return "";
			const submissionHash = String(node.getAttribute("data-client-submission-hash") || "").trim();
			if (submissionHash) return `submission:${submissionHash}`;
			const body = node.querySelector && node.querySelector(".item-body");
			const text = String((body || node).textContent || "").replace(/\s+/g, " ").trim();
			if (!text) return "";
			const timestamp = node.querySelector && node.querySelector(".item-timestamp");
			const datetime = String(timestamp && timestamp.getAttribute && timestamp.getAttribute("datetime") || "").trim();
			const timestampMs = datetime ? Date.parse(datetime) : 0;
			if (Number.isFinite(timestampMs) && timestampMs > 0) return `text-time:${Math.floor(timestampMs / 5e3)}:${stableTextHash(text)}`;
			return domUserMessageDuplicateSignature(turnNode, node);
		}
		function visibleUserMessageDuplicateSignature(turn, item) {
			if (!item || item.type !== "userMessage") return "";
			const turnId = String(turn && turn.id || turn && turn.mobileVisibleKey || "").trim();
			const submissionHash = clientSubmissionDiagnosticHash(item && item.clientSubmissionId);
			if (submissionHash) return `submission:${turnId}:${submissionHash}`;
			const comparable = userMessageComparableParts(item);
			const text = String(comparable.text || itemTextValue(item && item.text) || itemTextValue(item && item.message) || itemTextValue(item && item.content) || "").replace(/\s+/g, " ").trim();
			return text ? `text:${turnId}:${stableTextHash(text)}` : "";
		}
		function visibleUserMessageEventDuplicateSignature(turn, item) {
			if (!item || item.type !== "userMessage") return "";
			const submissionHash = clientSubmissionDiagnosticHash(item && item.clientSubmissionId);
			if (submissionHash) return `submission:${submissionHash}`;
			const comparable = userMessageComparableParts(item);
			const text = String(comparable.text || itemTextValue(item && item.text) || itemTextValue(item && item.message) || itemTextValue(item && item.content) || "").replace(/\s+/g, " ").trim();
			if (!text) return "";
			const timestampMs = userMessageTimestampMs(item) || turnStartedAtMs(turn);
			if (timestampMs) return `text-time:${Math.floor(timestampMs / 5e3)}:${stableTextHash(text)}`;
			return visibleUserMessageDuplicateSignature(turn, item);
		}
		function turnRendersConversationArticle(turn, thread) {
			if (!turn || !turn.id) return false;
			if (visibleItemsForTurn(turn, thread).length > 0) return true;
			if (typeof visibleItemBudgetSignature === "function" && visibleItemBudgetSignature(turn)) return true;
			const threadId = typeof renderContextThreadId === "function" ? renderContextThreadId(thread) : String(thread && thread.id || state.currentThreadId || "");
			if (typeof approvalsForTurn === "function" && approvalsForTurn(threadId, turn.id).length > 0) return true;
			if (typeof turnHasThreadTaskCardDraftResponse === "function" && turnHasThreadTaskCardDraftResponse(turn)) return true;
			return Boolean(typeof turnHasThreadTaskCardRequest === "function" && typeof isLatestTurn === "function" && typeof isLiveTurn === "function" && isLatestTurn(turn, thread) && isLiveTurn(turn, thread) && turnHasThreadTaskCardRequest(turn));
		}
		function visibleRenderableTurnsForConversation(thread) {
			return visibleTurnsForConversation(thread).filter((turn) => turnRendersConversationArticle(turn, thread));
		}
		function visibleConversationShape(thread) {
			const turns = visibleRenderableTurnsForConversation(thread);
			let visibleItemCount = 0;
			const userMessages = [];
			for (const turn of turns) {
				const visibleItems = visibleItemsForTurn(turn, thread);
				visibleItemCount += visibleItems.length;
				for (const entry of visibleItems) {
					const item = entry && entry.item;
					if (item && item.type === "userMessage") userMessages.push({
						turn,
						item
					});
				}
			}
			const duplicateUserMessageCount = duplicateUserMessageSignatureCount(userMessages, (entry) => visibleUserMessageEventDuplicateSignature(entry.turn, entry.item));
			return {
				visibleTurnCount: turns.length,
				visibleItemCount,
				duplicateUserMessageCount
			};
		}
		function rememberThreadDetailRenderEvidence(thread, source = "unknown") {
			if (!thread || thread.mobileLoading || thread.mobileLoadError) return null;
			const threadId = String(thread.id || state.currentThreadId || "").trim();
			if (!threadId) return null;
			const shape = visibleConversationShape(thread);
			if (!shape.visibleTurnCount && !shape.visibleItemCount) return null;
			const itemCount = (Array.isArray(thread.turns) ? thread.turns : []).reduce((total, turn) => total + (Array.isArray(turn && turn.items) ? turn.items.length : 0), 0);
			const evidence = threadDetailStateApi.buildThreadDetailRenderEvidence({
				atMs: Date.now(),
				threadId,
				threadHash: diagnosticThreadHash(threadId),
				readMode: thread.mobileReadMode || "",
				sourceKind: homeAiDiagnosticReportingApi.boundedToken(source, "unknown", 80),
				turnCount: shape.visibleTurnCount,
				visibleItemCount: shape.visibleItemCount,
				itemCount
			});
			if (!evidence) return null;
			state.lastThreadDetailRenderEvidence = evidence;
			return evidence;
		}
		function clearThreadDetailRenderEvidence(reason = "") {
			if (!state.lastThreadDetailRenderEvidence) return;
			state.lastThreadDetailRenderEvidence = null;
			postClientEvent("thread_detail_render_evidence_cleared", { reason: String(reason || "").slice(0, 80) });
		}
		function recentThreadDetailRenderEvidence() {
			return threadDetailStateApi.recentThreadDetailRenderEvidence({
				evidence: state.lastThreadDetailRenderEvidence,
				nowMs: Date.now(),
				maxAgeMs: PRIMARY_SHELL_CONFLICT_EVIDENCE_MS
			});
		}
		function primaryShellSelectionConflictInput(reason, details = {}) {
			const evidence = recentThreadDetailRenderEvidence() || {};
			const thread = state.currentThread || null;
			const shape = thread ? visibleConversationShape(thread) : null;
			return {
				reason,
				action: "primary-shell-selection",
				routeKind: "embedded-primary",
				sourceKind: details.source || evidence.sourceKind || "",
				threadHash: evidence.threadHash || diagnosticThreadHash(state.currentThreadId || thread && thread.id || ""),
				readMode: evidence.readMode || thread && thread.mobileReadMode || "",
				renderMode: details.renderMode || "",
				turns: evidence.turnCount || shape && shape.visibleTurnCount || 0,
				visibleItems: evidence.visibleItemCount || shape && shape.visibleItemCount || 0,
				items: evidence.itemCount || 0,
				domCount: details.domCount,
				previousCount: details.previousCount,
				recentDetailAgeMs: evidence.ageMs || 0,
				hasCurrentThread: Boolean(state.currentThread),
				hasCurrentThreadId: Boolean(state.currentThreadId),
				hasThreadLoadController: Boolean(state.threadLoadController),
				startupThreadOpenPending: Boolean(state.startupThreadOpenPending),
				mobileLoading: Boolean(state.currentThread && state.currentThread.mobileLoading)
			};
		}
		function recordPrimaryShellSelectionConflict(reason, details = {}) {
			return recordHomeAiDiagnosticFailure(threadDiagnosticEventsApi.primaryShellSelectionConflictDiagnosticEvent(primaryShellSelectionConflictInput(reason, details)));
		}
		function recordPrimaryShellSelectionHealthy(source, thread = state.currentThread) {
			const evidence = rememberThreadDetailRenderEvidence(thread, source);
			if (!evidence) return null;
			return recordHomeAiDiagnosticSuccess(threadDiagnosticEventsApi.primaryShellSelectionConflictDiagnosticSuccess({
				action: "primary-shell-selection",
				routeKind: "embedded-primary",
				sourceKind: source,
				threadHash: evidence.threadHash,
				readMode: evidence.readMode
			}));
		}
		function emptyVisibleDetailMismatchInput(reason, thread = state.currentThread, details = {}) {
			const threadId = String(thread && thread.id || state.currentThreadId || "").trim();
			const evidence = recentThreadDetailRenderEvidence();
			const sameThreadEvidence = threadDetailStateApi.sameThreadDetailRenderEvidence({
				evidence,
				threadId
			});
			const shape = thread ? visibleConversationShape(thread) : {
				visibleTurnCount: 0,
				visibleItemCount: 0
			};
			return {
				reason,
				action: details.action || "single-thread-empty-state",
				routeKind: details.routeKind || "single-thread",
				sourceKind: details.source || sameThreadEvidence && sameThreadEvidence.sourceKind || "",
				threadHash: details.threadHash || sameThreadEvidence && sameThreadEvidence.threadHash || diagnosticThreadHash(threadId),
				readMode: sameThreadEvidence && sameThreadEvidence.readMode || thread && thread.mobileReadMode || "",
				renderMode: details.renderMode || "",
				turns: Object.prototype.hasOwnProperty.call(details, "turns") ? details.turns : sameThreadEvidence && sameThreadEvidence.turnCount || 0,
				visibleItems: Object.prototype.hasOwnProperty.call(details, "visibleItems") ? details.visibleItems : sameThreadEvidence && sameThreadEvidence.visibleItemCount || 0,
				items: Object.prototype.hasOwnProperty.call(details, "items") ? details.items : sameThreadEvidence && sameThreadEvidence.itemCount || 0,
				currentTurns: Object.prototype.hasOwnProperty.call(details, "currentTurns") ? details.currentTurns : shape.visibleTurnCount,
				currentVisibleItems: Object.prototype.hasOwnProperty.call(details, "currentVisibleItems") ? details.currentVisibleItems : shape.visibleItemCount,
				domCount: details.domCount,
				previousCount: details.previousCount,
				detailLoaded: Boolean(thread && thread.mobileDetailLoaded),
				mobileLoading: Boolean(thread && thread.mobileLoading),
				recentDetailAgeMs: sameThreadEvidence && sameThreadEvidence.ageMs || 0
			};
		}
		function recordEmptyVisibleDetailMismatch(reason, thread = state.currentThread, details = {}) {
			return recordHomeAiDiagnosticFailure(threadDiagnosticEventsApi.emptyVisibleDetailMismatchDiagnosticEvent(emptyVisibleDetailMismatchInput(reason, thread, details)));
		}
		function recordEmptyVisibleDetailHealthy(source, thread = state.currentThread) {
			if (!thread || thread.mobileLoading || thread.mobileLoadError) return null;
			const threadId = String(thread.id || state.currentThreadId || "").trim();
			if (!threadId) return null;
			const shape = visibleConversationShape(thread);
			if (!shape.visibleTurnCount && !shape.visibleItemCount) return null;
			return recordHomeAiDiagnosticSuccess(threadDiagnosticEventsApi.emptyVisibleDetailMismatchDiagnosticSuccess({
				action: "single-thread-empty-state",
				routeKind: "single-thread",
				sourceKind: source,
				threadHash: diagnosticThreadHash(threadId),
				readMode: thread.mobileReadMode || ""
			}));
		}
		function maybeRecoverEmptyDetailWithHistoryEvidence(thread, details = {}) {
			const now = Date.now();
			const basePlan = threadDetailStateApi.planEmptyDetailHistoryRecovery({
				thread,
				currentThreadId: state.currentThreadId,
				details,
				nowMs: now,
				cooldownMs: 0
			});
			if (!basePlan.shouldRecover || !basePlan.recoveryKey) return false;
			const plan = threadDetailStateApi.planEmptyDetailHistoryRecovery({
				thread,
				currentThreadId: state.currentThreadId,
				details,
				nowMs: now,
				lastRecoveredAtMs: state.emptyDetailHistoryRecoveryAtByKey.get(basePlan.recoveryKey),
				cooldownMs: EMPTY_DETAIL_HISTORY_RECOVERY_COOLDOWN_MS
			});
			if (!plan.shouldRecover || !plan.recoveryKey) return false;
			state.emptyDetailHistoryRecoveryAtByKey.set(plan.recoveryKey, plan.nowMs || now);
			recordEmptyVisibleDetailMismatch(plan.diagnosticReason || "empty_render_with_history_evidence", thread, details);
			if (!hasThreadDetailRequestInFlight()) scheduleCurrentThreadRefresh(0, "empty-detail-history-evidence");
			postClientEvent("empty_detail_history_recovery", plan.event || {});
			return true;
		}
		function emptyCachedDetailReuseInput(reason, thread = state.currentThread, details = {}) {
			const threadId = String(thread && thread.id || state.currentThreadId || "").trim();
			const shape = thread ? visibleConversationShape(thread) : {
				visibleTurnCount: 0,
				visibleItemCount: 0
			};
			const itemCount = (Array.isArray(thread && thread.turns) ? thread.turns : []).reduce((total, turn) => total + (Array.isArray(turn && turn.items) ? turn.items.length : 0), 0);
			return {
				reason,
				action: "thread-open-cache-reuse",
				routeKind: "single-thread",
				sourceKind: details.source || "",
				threadHash: diagnosticThreadHash(threadId),
				readMode: thread && thread.mobileReadMode || "",
				currentTurns: shape.visibleTurnCount,
				currentVisibleItems: shape.visibleItemCount,
				items: itemCount,
				detailLoaded: Boolean(thread && thread.mobileDetailLoaded),
				reusableDetail: Boolean(details.reusableDetail),
				mobileLoading: Boolean(thread && thread.mobileLoading),
				threadTaskCardCount: Array.isArray(thread && thread.threadTaskCards) ? thread.threadTaskCards.length : 0
			};
		}
		function recordEmptyCachedDetailReuseBlocked(reason, thread = state.currentThread, details = {}) {
			return recordHomeAiDiagnosticFailure(threadDiagnosticEventsApi.emptyCachedDetailReuseBlockedDiagnosticEvent(emptyCachedDetailReuseInput(reason, thread, details)));
		}
		function recordEmptyCachedDetailReuseHealthy(source, thread = state.currentThread) {
			const threadId = String(thread && thread.id || state.currentThreadId || "").trim();
			if (!threadId) return null;
			return recordHomeAiDiagnosticSuccess(threadDiagnosticEventsApi.emptyCachedDetailReuseDiagnosticSuccess({
				action: "thread-open-cache-reuse",
				routeKind: "single-thread",
				sourceKind: source,
				threadHash: diagnosticThreadHash(threadId),
				readMode: thread && thread.mobileReadMode || ""
			}));
		}
		function checkEmptyVisibleDetailMismatchAfterRender(thread, shellPlan = {}, metrics = {}) {
			if (!thread || thread.mobileLoading || thread.mobileLoadError) return;
			if (shellPlan.hasPrimaryContent || shellPlan.emptyMessage !== "No visible turns.") return;
			const threadId = String(thread.id || state.currentThreadId || "").trim();
			const evidence = recentThreadDetailRenderEvidence();
			const details = {
				source: metrics.source || "single-thread-render",
				renderMode: metrics.renderMode || "full-render",
				domCount: metrics.domCount,
				previousCount: metrics.previousCount
			};
			if (threadDetailStateApi.hasNonemptyThreadDetailRenderEvidence(threadDetailStateApi.sameThreadDetailRenderEvidence({
				evidence,
				threadId
			}))) {
				recordEmptyVisibleDetailMismatch("empty_render_after_nonempty_detail", thread, details);
				return;
			}
			maybeRecoverEmptyDetailWithHistoryEvidence(thread, details);
		}
		function visibleRenderableTurnIds(thread) {
			return visibleRenderableTurnsForConversation(thread).map((turn) => String(turn.id));
		}
		function conversationDomTurnIds(conversation = $("conversation")) {
			if (!conversation) return [];
			return Array.from(conversation.querySelectorAll("article.turn[data-turn]")).map((node) => String(node && node.getAttribute && node.getAttribute("data-turn") || "")).filter(Boolean);
		}
		function threadTileVisibleShape(ids = state.threadTileActiveIds) {
			return (Array.isArray(ids) ? ids : []).reduce((shape, id) => {
				const thread = threadTileDisplayThread(id);
				visibleTurnsForConversation(thread).forEach((turn) => {
					const visibleItems = visibleItemsForTurn(turn, thread);
					const itemCount = visibleItems.length;
					if (itemCount > 0) {
						shape.turnCount += 1;
						shape.visibleItemCount += itemCount;
						const userMessages = visibleItems.map((entry) => entry && entry.item).filter((item) => item && item.type === "userMessage");
						shape.duplicateUserMessageCount += duplicateUserMessageSignatureCount(userMessages, (item) => visibleUserMessageDuplicateSignature(turn, item));
					}
				});
				return shape;
			}, {
				turnCount: 0,
				visibleItemCount: 0,
				duplicateUserMessageCount: 0
			});
		}
		function threadTileVisibleTurnCount(ids = state.threadTileActiveIds) {
			return threadTileVisibleShape(ids).turnCount;
		}
		function threadTileDomTurnCount(conversation = $("conversation")) {
			if (!conversation) return 0;
			return conversation.querySelectorAll("article.thread-tile-turn[data-thread-tile-turn]").length;
		}
		function conversationTurnOrderDiagnosticSnapshot(source, extra = {}, deps = {}) {
			const conversation = deps.conversation || $("conversation");
			const thread = deps.thread || state.currentThread;
			if (!conversation || !thread) return null;
			const tileMode = Object.prototype.hasOwnProperty.call(deps, "threadTileMode") ? deps.threadTileMode === true : state.threadTileMode === true;
			const tileDomActive = Object.prototype.hasOwnProperty.call(deps, "tileDomActive") ? deps.tileDomActive === true : Boolean(conversation.classList && conversation.classList.contains("thread-tile-mode"));
			if (tileMode || tileDomActive) return null;
			const expectedIds = Array.isArray(deps.expectedTurnIds) ? deps.expectedTurnIds.map(String).filter(Boolean) : visibleRenderableTurnIds(thread);
			const domIds = Array.isArray(deps.domTurnIds) ? deps.domTurnIds.map(String).filter(Boolean) : conversationDomTurnIds(conversation);
			const expectedLatestId = expectedIds[expectedIds.length - 1] || "";
			return threadDiagnosticEventsApi.turnOrderDiagnosticSnapshot({
				source,
				readMode: thread.mobileReadMode || "",
				renderMode: extra.renderMode || "",
				threadHash: diagnosticThreadHash(thread.id || state.currentThreadId),
				turnHash: diagnosticTurnHash(expectedLatestId),
				expectedTurnIds: expectedIds,
				domTurnIds: domIds
			});
		}
		function conversationProjectionDiagnosticSnapshot(source, extra = {}, deps = {}) {
			const conversation = deps.conversation || $("conversation");
			if (!conversation) return null;
			const renderedSignature = Object.prototype.hasOwnProperty.call(deps, "renderedConversationSignature") ? String(deps.renderedConversationSignature || "") : String(state.renderedConversationSignature || "");
			const domShape = deps.domShape || conversationDomShape();
			const tileMode = Object.prototype.hasOwnProperty.call(deps, "threadTileMode") ? deps.threadTileMode === true : state.threadTileMode === true;
			const tileDomActive = Object.prototype.hasOwnProperty.call(deps, "tileDomActive") ? deps.tileDomActive === true : Boolean(conversation.classList && conversation.classList.contains("thread-tile-mode"));
			return threadDiagnosticEventsApi.conversationProjectionDiagnosticSnapshot({
				source,
				renderMode: extra.renderMode,
				renderedSignature,
				domShape,
				threadTileMode: tileMode,
				tileDomActive,
				tileLayout: deps.tileLayout,
				tileIds: deps.tileIds,
				tileDisplayLayout: deps.tileDisplayLayout,
				tileSignature: deps.tileSignature,
				currentSignature: deps.currentSignature,
				thread: deps.thread || state.currentThread
			}, {
				singleSignature: conversationRenderSignature,
				tileLayout: threadTileLayout,
				tileCandidateIds: threadTileCandidateIds,
				tileDisplayLayout: threadTileDisplayLayout,
				tileRenderSignature: threadTileRenderSignature,
				tileThreadForId: typeof deps.tileThreadForId === "function" ? deps.tileThreadForId : threadTileDisplayThread,
				visibleShape: visibleConversationShape
			});
		}
		function applyConversationProjectionConsistencyEffect(effect) {
			const item = effect && typeof effect === "object" ? effect : {};
			if (!item.type) return;
			if (item.type === "diagnostic-failure") {
				recordHomeAiDiagnosticFailure(item.diagnostic || {});
				return;
			}
			if (item.type === "diagnostic-success") {
				recordHomeAiDiagnosticSuccess(item.diagnostic || {});
				return;
			}
			throw new Error(`Unknown conversation projection consistency effect: ${item.type}`);
		}
		function applyConversationProjectionConsistencyEffectsPlan(plan) {
			const effects = Array.isArray(plan && plan.effects) ? plan.effects : [];
			for (const effect of effects) applyConversationProjectionConsistencyEffect(effect);
		}
		function checkConversationProjectionConsistency(source, extra = {}) {
			if (!state.currentThread || state.currentThread.mobileLoading || state.currentThread.mobileLoadError) return;
			recordPrimaryShellSelectionHealthy(source, state.currentThread);
			recordEmptyVisibleDetailHealthy(source, state.currentThread);
			const snapshot = conversationProjectionDiagnosticSnapshot(source, extra);
			if (!snapshot) return;
			const orderSnapshot = conversationTurnOrderDiagnosticSnapshot(source, extra);
			applyConversationProjectionConsistencyEffectsPlan(threadDiagnosticEventsApi.conversationProjectionConsistencyEffects({
				snapshot,
				orderSnapshot
			}));
		}
		function startUiWatchdog() {
			if (state.uiWatchdogTimer) return;
			state.lastUiWatchdogTickAt = Date.now();
			state.uiWatchdogTimer = setInterval(() => {
				const now = Date.now();
				const lagMs = now - state.lastUiWatchdogTickAt - 1e3;
				state.lastUiWatchdogTickAt = now;
				if (document.visibilityState === "hidden" || lagMs < 2500) return;
				if (now - state.lastUiStallReportedAt < 15e3) return;
				state.lastUiStallReportedAt = now;
				postClientEvent("ui_stall", {
					lagMs: Math.round(lagMs),
					composerBusy: state.composerBusy,
					activeTurnId: state.activeTurnId || "",
					hasContent: composerHasContent()
				});
			}, 1e3);
		}
		function updatePushButton() {
			const button = $("pushNotifications");
			if (!button) return;
			button.classList.remove("hidden", "ready", "error");
			const hideButton = () => {
				button.textContent = "";
				button.disabled = true;
				button.classList.add("hidden");
			};
			if (state.pushBusy) {
				button.textContent = "Working...";
				button.disabled = true;
				return;
			}
			if (!state.pushServerSupported) {
				hideButton();
				return;
			}
			if (!window.isSecureContext) {
				hideButton();
				return;
			}
			if (!pushBrowserAvailable()) {
				hideButton();
				return;
			}
			if (Notification.permission === "denied") {
				button.textContent = "Notifications blocked";
				button.disabled = true;
				button.classList.add("error");
				return;
			}
			if (state.pushSubscribed) {
				button.textContent = "Send test notification";
				button.disabled = false;
				button.classList.add("ready");
				return;
			}
			button.textContent = "Enable notifications";
			button.disabled = false;
			if (state.pushError) button.classList.add("error");
		}
		async function registerPushServiceWorker() {
			if (state.serviceWorkerRegistration) return state.serviceWorkerRegistration;
			state.serviceWorkerRegistration = await navigator.serviceWorker.register("/sw.js");
			if (state.serviceWorkerRegistration && state.serviceWorkerRegistration.update) state.serviceWorkerRegistration.update().catch(() => {});
			return state.serviceWorkerRegistration;
		}
		async function syncExistingPushSubscription() {
			if (!state.key || !pushBrowserAvailable()) return;
			const subscription = await (await registerPushServiceWorker()).pushManager.getSubscription();
			state.pushSubscribed = Boolean(subscription);
			if (subscription) await api("/api/push/subscribe", {
				method: "POST",
				body: JSON.stringify({ subscription: pushSubscriptionToJson(subscription) })
			});
		}
		async function initializePushControls() {
			state.pushError = "";
			updatePushButton();
			if (!pushBrowserAvailable() || !state.key) return;
			try {
				await syncExistingPushSubscription();
			} catch (err) {
				state.pushError = err.message || String(err);
			} finally {
				updatePushButton();
			}
		}
		async function enablePushNotifications() {
			if (!pushBrowserAvailable()) return;
			const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
			if (permission !== "granted") {
				state.pushSubscribed = false;
				state.pushError = permission === "denied" ? "Notifications blocked" : "Notification permission not granted";
				updatePushButton();
				return;
			}
			const registration = await registerPushServiceWorker();
			let subscription = await registration.pushManager.getSubscription();
			if (!subscription) {
				const key = await api("/api/push/vapid-public-key");
				subscription = await registration.pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey: base64UrlToUint8Array(key.publicKey)
				});
			}
			await api("/api/push/subscribe", {
				method: "POST",
				body: JSON.stringify({ subscription: pushSubscriptionToJson(subscription) })
			});
			state.pushSubscribed = true;
			state.pushError = "";
			$("connectionState").classList.remove("error");
			$("connectionState").textContent = "Notifications enabled";
		}
		async function sendTestPushNotification() {
			const result = await api("/api/push/test", {
				method: "POST",
				body: "{}"
			});
			$("connectionState").classList.remove("error");
			if (result.sent) {
				$("connectionState").textContent = "Test notification sent";
				return;
			}
			if (result.failed) {
				const detail = result.lastError && (result.lastError.reason || result.lastError.statusCode) ? `${result.lastError.statusCode || ""} ${result.lastError.reason || ""}`.trim() : "delivery failed";
				throw new Error(`Test notification failed: ${detail}`);
			}
			$("connectionState").textContent = "No push subscription";
		}
		async function handlePushButtonClick() {
			if (state.pushBusy) return;
			state.pushBusy = true;
			updatePushButton();
			try {
				if (state.pushSubscribed) await sendTestPushNotification();
				else await enablePushNotifications();
			} catch (err) {
				state.pushError = err.message || String(err);
				showError(err);
			} finally {
				state.pushBusy = false;
				updatePushButton();
			}
		}
		const legacyGlobals = {
			api,
			postClientEvent,
			nowPerfMs,
			roundedDurationMs,
			postPerformanceEvent,
			diagnosticHash,
			diagnosticThreadHash,
			diagnosticTurnHash,
			diagnosticTaskHash,
			diagnosticItemHash,
			clientSubmissionDiagnosticHash,
			clientSubmissionDataAttr,
			diagnosticRouteKind,
			diagnosticErrorStatus,
			diagnosticErrorCode,
			diagnosticDurationBucket,
			currentHomeAiDiagnosticContext,
			postHomeAiDiagnosticReport,
			recordHomeAiDiagnosticFailure,
			recordHomeAiDiagnosticSuccess,
			applyFrontendRuntimeHealthEffect,
			applyFrontendRuntimeHealthEffectsPlan,
			threadListRuntimeMetrics,
			recordThreadListRuntimeStall,
			sampleThreadListInputDelay,
			startThreadListRuntimeHeartbeat,
			startThreadListRuntimeLongTaskObserver,
			startThreadListRuntimeStallMonitoring,
			conversationHasClientSubmissionHash,
			frontendHealthThreadForSubmission,
			probeSubmittedMessageDom,
			scheduleSubmittedMessageDomProbe,
			applyThreadDetailResponseDiagnosticEffect,
			applyThreadDetailResponseDiagnosticEffectsPlan,
			recordThreadDetailResponseDiagnostics,
			conversationDomShape,
			duplicateUserMessageSignatureCount,
			domUserMessageDuplicateSignature,
			domUserMessageEventDuplicateSignature,
			visibleUserMessageDuplicateSignature,
			visibleUserMessageEventDuplicateSignature,
			turnRendersConversationArticle,
			visibleRenderableTurnsForConversation,
			visibleConversationShape,
			rememberThreadDetailRenderEvidence,
			clearThreadDetailRenderEvidence,
			recentThreadDetailRenderEvidence,
			primaryShellSelectionConflictInput,
			recordPrimaryShellSelectionConflict,
			recordPrimaryShellSelectionHealthy,
			emptyVisibleDetailMismatchInput,
			recordEmptyVisibleDetailMismatch,
			recordEmptyVisibleDetailHealthy,
			maybeRecoverEmptyDetailWithHistoryEvidence,
			emptyCachedDetailReuseInput,
			recordEmptyCachedDetailReuseBlocked,
			recordEmptyCachedDetailReuseHealthy,
			checkEmptyVisibleDetailMismatchAfterRender,
			visibleRenderableTurnIds,
			conversationDomTurnIds,
			threadTileVisibleShape,
			threadTileVisibleTurnCount,
			threadTileDomTurnCount,
			conversationTurnOrderDiagnosticSnapshot,
			conversationProjectionDiagnosticSnapshot,
			applyConversationProjectionConsistencyEffect,
			applyConversationProjectionConsistencyEffectsPlan,
			checkConversationProjectionConsistency,
			startUiWatchdog,
			updatePushButton,
			registerPushServiceWorker,
			syncExistingPushSubscription,
			initializePushControls,
			enablePushNotifications,
			sendTestPushNotification,
			handlePushButtonClick
		};
		function createApiClientRuntime() {
			return Object.assign({}, legacyGlobals);
		}
		const apiClientRuntimeApi = { createApiClientRuntime };
		if (typeof module === "object" && module.exports) module.exports = apiClientRuntimeApi;
		for (const [name, value] of Object.entries(legacyGlobals)) if (typeof value === "function") root[name] = value;
		root.CodexApiClientRuntime = apiClientRuntimeApi;
	})(typeof globalThis !== "undefined" ? globalThis : window);
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
//#region public/thread-detail-runtime.js
var require_thread_detail_runtime = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function attachThreadDetailRuntime(root) {
		function noopString() {
			return "";
		}
		function noopFalse() {
			return false;
		}
		function identityArray(value) {
			return Array.isArray(value) ? value : [];
		}
		function createThreadDetailRuntime(deps = {}) {
			const { state = {}, MAX_EXPANDED_VISIBLE_TURNS = 200, MAX_RAW_THREAD_VISIBLE_ITEMS_PER_TURN = 24, threadDetailStateApi = root.CodexThreadDetailState, threadDetailMergeStateApi = root.CodexThreadDetailMergeState, threadDetailV4MergeStateApi = root.CodexThreadDetailV4MergeState, statusText = noopString, normalizeFsPath = (value) => String(value || ""), imageUrlValue = noopString, isInputTextPart = noopFalse, inputTextValue = noopString, isInputImagePart = noopFalse, splitAttachmentSummaryText = (value) => ({
				text: String(value || ""),
				attachments: []
			}), canRenderImageAttachment = noopFalse, truncateMiddle = (value) => String(value || ""), isLiveTurn = noopFalse, isLatestTurn = noopFalse, latestTurnForThread = (thread) => {
				const turns = Array.isArray(thread && thread.turns) ? thread.turns : [];
				return turns.length ? turns[turns.length - 1] : null;
			}, isLiveTurnForThread = (thread, turn) => isLiveTurn(turn, thread), isActiveOperationalItem = noopFalse, isReasoningItem = noopFalse, isOperationalItem = noopFalse, isContextCompactionItem = noopFalse, contextCompactionNotice = () => null, operationCommandText = noopString, operationDetailText = noopString, imageViewPath = noopString, imageViewContentUrl = noopString, imageViewUrl = noopString, isTurnComplete = noopFalse, isRunningStatus = noopFalse, isIncompleteInterruptedTurn = noopFalse, turnHasActiveLiveItems = noopFalse, isRecentlySubmittedUserMessage = noopFalse, sortTurnsForDisplay = identityArray, maxVisibleTurnsForThread = () => 10, numericTimestampMs = (value) => {
				const numberValue = Number(value);
				return Number.isFinite(numberValue) ? numberValue : 0;
			}, renderContextThread = (thread = null) => thread || state.currentThread || null } = deps;
			if (!threadDetailStateApi || typeof threadDetailStateApi.createThreadDetailStatePolicy !== "function") throw new Error("CodexThreadDetailState policy script failed to load");
			if (!threadDetailMergeStateApi || typeof threadDetailMergeStateApi.createThreadDetailMergePolicy !== "function") throw new Error("CodexThreadDetailMergeState script failed to load");
			if (!threadDetailV4MergeStateApi || typeof threadDetailV4MergeStateApi.createThreadDetailV4MergePolicy !== "function") throw new Error("CodexThreadDetailV4MergeState script failed to load");
			function liveTurnHasNonUserProgress(turn, thread = null) {
				if (!turn || !isLiveTurn(turn, thread)) return false;
				return (turn.items || []).some((item) => item && item.type !== "userMessage" && (isReasoningItem(item) || isOperationalItem(item) || isContextCompactionItem(item) || item.type === "agentMessage" || item.type === "plan" || item.type === "turnDiagnostic" || item.type === "turnUsageSummary"));
			}
			function isVisibleNonUserProgressItem(item) {
				return Boolean(item && item.type !== "userMessage" && (isReasoningItem(item) || isOperationalItem(item) || isContextCompactionItem(item) || item.type === "agentMessage" || item.type === "plan" || item.type === "turnDiagnostic" || item.type === "turnUsageSummary"));
			}
			function liveTurnHasNonUserProgressBefore(turn, index, thread = null) {
				if (!turn || !isLiveTurn(turn, thread)) return false;
				const items = Array.isArray(turn.items) ? turn.items : [];
				for (let pos = 0; pos < Math.min(index, items.length); pos += 1) if (isVisibleNonUserProgressItem(items[pos])) return true;
				return false;
			}
			function liveTurnHasNonUserProgressAfter(turn, index, thread = null) {
				if (!turn || !isLiveTurn(turn, thread)) return false;
				const items = Array.isArray(turn.items) ? turn.items : [];
				for (let pos = Math.max(0, index + 1); pos < items.length; pos += 1) if (isVisibleNonUserProgressItem(items[pos])) return true;
				return false;
			}
			function isUserVisibleTextReplyItem(item) {
				return Boolean(item && item.type !== "userMessage" && (item.type === "agentMessage" || item.type === "plan" || item.type === "turnUsageSummary"));
			}
			function liveTurnHasUserVisibleTextReplyAfter(turn, index, thread = null) {
				if (!turn || !isLiveTurn(turn, thread)) return false;
				const items = Array.isArray(turn.items) ? turn.items : [];
				for (let pos = Math.max(0, index + 1); pos < items.length; pos += 1) if (isUserVisibleTextReplyItem(items[pos])) return true;
				return false;
			}
			function userMessageHasVisualAttachment(item) {
				if (!item || item.type !== "userMessage") return false;
				const textValues = [];
				if (typeof item.text === "string") textValues.push(item.text);
				if (typeof item.message === "string") textValues.push(item.message);
				const content = Array.isArray(item.content) ? item.content : [];
				for (const part of content) {
					if (!part || typeof part !== "object") continue;
					if (isInputImagePart(part)) return true;
					if (isInputTextPart(part)) textValues.push(inputTextValue(part));
					if (part.path && /\.(?:png|jpe?g|webp|gif)(?:[?#].*)?$/i.test(String(part.path))) return true;
					const url = imageUrlValue(part);
					if (url && /\.(?:png|jpe?g|webp|gif)(?:[?#].*)?$/i.test(String(url))) return true;
				}
				return textValues.some((text) => splitAttachmentSummaryText(text).attachments.some((attachment) => attachment.isImage && canRenderImageAttachment(attachment)));
			}
			function shouldHideDurableLiveUserMessage(turn, item, index = 0, thread = null) {
				return false;
			}
			function durableUserMessageMatchesOptimisticEcho(durableItem, optimisticItem) {
				if (!durableItem || !optimisticItem) return false;
				if (durableItem.type !== "userMessage" || optimisticItem.type !== "userMessage") return false;
				if (isOptimisticUserMessage(durableItem) || !isOptimisticUserMessage(optimisticItem)) return false;
				return userMessagesShareSubmissionId(durableItem, optimisticItem) || userMessagesLikelySame(durableItem, optimisticItem);
			}
			function threadHasDurableUserMessageWithSubmissionId(thread, optimisticItem) {
				const submissionIds = userMessageSubmissionIdCandidates(optimisticItem);
				if (!submissionIds.length || !thread || !Array.isArray(thread.turns)) return false;
				return thread.turns.some((candidateTurn) => (Array.isArray(candidateTurn && candidateTurn.items) ? candidateTurn.items : []).some((candidate) => candidate && candidate.type === "userMessage" && !isOptimisticUserMessage(candidate) && submissionIds.some((submissionId) => userMessageHasSubmissionId(candidate, submissionId))));
			}
			function threadHasDurableUserMessageMatchingOptimisticEcho(thread, optimisticItem) {
				if (!thread || !Array.isArray(thread.turns) || !isOptimisticUserMessage(optimisticItem)) return false;
				return thread.turns.some((candidateTurn) => (Array.isArray(candidateTurn && candidateTurn.items) ? candidateTurn.items : []).some((candidate) => candidate && candidate.type === "userMessage" && !isOptimisticUserMessage(candidate) && optimisticEchoCanMatchEarlierDurable(candidate, optimisticItem)));
			}
			function shouldHideOptimisticUserMessageEcho(turn, item, index = 0, thread = null) {
				if (!item || item.type !== "userMessage" || !isOptimisticUserMessage(item)) return false;
				if ((Array.isArray(turn && turn.items) ? turn.items : []).some((candidate, candidateIndex) => candidateIndex !== index && durableUserMessageMatchesOptimisticEcho(candidate, item))) return true;
				const contextThread = renderContextThread(thread);
				return threadHasDurableUserMessageWithSubmissionId(contextThread, item) || threadHasDurableUserMessageMatchingOptimisticEcho(contextThread, item);
			}
			function isSupersededLiveTurn(turn) {
				return Boolean(turn && (turn.mobileSupersededLive || turn.status && turn.status.mobileSupersededLive));
			}
			function shouldHideSupersededLiveUserMessage(turn, item) {
				return Boolean(isSupersededLiveTurn(turn) && item && item.type === "userMessage" && !userMessageHasVisualAttachment(item));
			}
			function isRawThreadReadMode(thread) {
				return Boolean(thread && (thread.mobileRawThreadRead || String(thread.mobileReadMode || "") === "thread-read-raw"));
			}
			function shouldPreserveRawThreadVisibleEntry(entry) {
				const item = entry && entry.item;
				if (!item) return false;
				return item.type === "userMessage" || item.type === "imageView" || item.type === "imageGeneration" || item.type === "turnUsageSummary" || isContextCompactionItem(item);
			}
			function itemTextValue(value) {
				if (typeof value === "string") return value;
				if (Array.isArray(value)) return value.map(itemTextValue).join("");
				return "";
			}
			function reasoningItemHasVisibleText(item) {
				return Boolean(itemTextValue(item && item.text).trim() || itemTextValue(item && item.content).trim() || itemTextValue(item && item.summary).trim());
			}
			function isLatestCompletedProcessTurn(turn, thread = null) {
				if (!turn || !isTurnComplete(turn)) return false;
				const contextThread = renderContextThread(thread);
				const turns = Array.isArray(contextThread && contextThread.turns) ? contextThread.turns : [];
				for (let index = turns.length - 1; index >= 0; index -= 1) {
					const candidate = turns[index];
					if (!candidate || isLiveTurn(candidate, contextThread)) continue;
					if (!isTurnComplete(candidate)) continue;
					return candidate === turn;
				}
				return isLatestTurn(turn, contextThread);
			}
			function limitRawThreadVisibleEntries(entries, thread = null) {
				if (!isRawThreadReadMode(renderContextThread(thread))) return entries;
				if (!Array.isArray(entries) || entries.length <= MAX_RAW_THREAD_VISIBLE_ITEMS_PER_TURN) return entries;
				const keep = /* @__PURE__ */ new Set();
				entries.forEach((entry, index) => {
					if (shouldPreserveRawThreadVisibleEntry(entry)) keep.add(index);
				});
				for (let index = Math.max(0, entries.length - MAX_RAW_THREAD_VISIBLE_ITEMS_PER_TURN); index < entries.length; index += 1) keep.add(index);
				return entries.filter((_, index) => keep.has(index));
			}
			function visibleItemsForTurn(turn, thread = null) {
				const visible = [];
				const contextEntryByKey = /* @__PURE__ */ new Map();
				const contextThread = renderContextThread(thread);
				(turn.items || []).forEach((item, index) => {
					if (!item) return;
					if (isReasoningItem(item)) return;
					if (shouldHideSupersededLiveUserMessage(turn, item)) return;
					if (shouldHideOptimisticUserMessageEcho(turn, item, index, contextThread)) return;
					if (shouldHideDurableLiveUserMessage(turn, item, index, contextThread)) return;
					if (isContextCompactionItem(item)) {
						if (!contextCompactionNotice(item, turn, contextThread)) return;
						const groupKey = "context-compaction";
						const existing = contextEntryByKey.get(groupKey);
						if (existing) visible[existing.visibleIndex] = null;
						contextEntryByKey.set(groupKey, { visibleIndex: visible.length });
						visible.push({
							item,
							sourceIndex: index
						});
						return;
					}
					if (isOperationalItem(item)) return;
					visible.push({
						item,
						sourceIndex: index
					});
				});
				const filtered = visible.filter(Boolean);
				if (isSupersededLiveTurn(turn) && filtered.length && filtered.every((entry) => isTurnUsageSummaryItem(entry.item))) return [];
				return limitRawThreadVisibleEntries(filtered, thread);
			}
			function currentLiveOperationEntry(thread) {
				if (!thread || !Array.isArray(thread.turns) || !thread.turns.length) return null;
				let turn = null;
				for (let index = thread.turns.length - 1; index >= 0; index -= 1) {
					const candidate = thread.turns[index];
					if (isSupersededLiveTurn(candidate)) continue;
					if (isLiveTurnForThread(thread, candidate)) {
						turn = candidate;
						break;
					}
				}
				if (!turn) return null;
				const items = Array.isArray(turn.items) ? turn.items : [];
				for (let index = items.length - 1; index >= 0; index -= 1) {
					const item = items[index];
					if (isActiveOperationalItem(item)) return {
						turn,
						item,
						sourceIndex: index
					};
				}
				return {
					turn,
					item: liveTurnStatusDockItem(turn),
					sourceIndex: -1
				};
			}
			function liveTurnStatusDockItem(turn) {
				return {
					id: `live-turn-status-${turn && (turn.id || turn.startedAt || "active")}`,
					type: "liveTurnStatus",
					status: "",
					title: "Command"
				};
			}
			function visibleItemSignature(item, turn = null, thread = null) {
				if (!item || isReasoningItem(item)) return null;
				const projection = {
					mobileVisibleKey: item.mobileVisibleKey || "",
					mobileVisibleKind: item.mobileVisibleKind || ""
				};
				if (isContextCompactionItem(item)) {
					const notice = contextCompactionNotice(item, turn, thread);
					if (!notice) return null;
					return {
						...projection,
						id: item.id || "",
						type: item.type || "",
						status: statusText(item.status),
						mobileCompactionStatus: item.mobileCompactionStatus || "",
						mobileNotice: item.mobileNotice || "",
						notice
					};
				}
				if (isOperationalItem(item)) return {
					...projection,
					id: item.id || "",
					type: item.type || "",
					status: statusText(item.status),
					startedAtMs: item.startedAtMs || item.startedAt || item.started_at_ms || item.started_at || "",
					completedAtMs: item.completedAtMs || item.completedAt || item.completed_at_ms || item.completed_at || "",
					durationMs: item.durationMs || item.duration_ms || item.elapsedMs || item.elapsed_ms || "",
					command: operationCommandText(item),
					fileNames: Array.isArray(item.fileNames) ? item.fileNames : [],
					tool: item.tool || "",
					server: item.server || "",
					namespace: item.namespace || "",
					detail: operationDetailText(item)
				};
				if (item.type === "turnUsageSummary") return {
					...projection,
					id: item.id || "",
					type: item.type || "",
					status: statusText(item.status),
					mobileUsageSummary: item.mobileUsageSummary || {}
				};
				if (item.type === "turnDiagnostic") return {
					...projection,
					id: item.id || "",
					type: item.type || "",
					status: statusText(item.status),
					code: item.code || "",
					severity: item.severity || "",
					title: item.title || "",
					message: item.message || "",
					source: item.source || "",
					mobileRuntimeDiagnostic: Boolean(item.mobileRuntimeDiagnostic)
				};
				if (item.type === "imageView") return {
					...projection,
					id: item.id || "",
					type: item.type || "",
					status: statusText(item.status),
					path: imageViewPath(item),
					contentUrl: imageSourceSignature(imageViewContentUrl(item)),
					url: imageSourceSignature(imageViewUrl(item))
				};
				return {
					...projection,
					id: item.id || "",
					type: item.type || "",
					status: statusText(item.status),
					text: item.text || "",
					content: Array.isArray(item.content) ? inputContentSignature(item.content) : [],
					summary: Array.isArray(item.summary) ? item.summary : [],
					mobileNotice: item.mobileNotice || ""
				};
			}
			function visibleItemBudgetForTurn(turn) {
				if (!turn || typeof turn !== "object") return null;
				const budget = turn.mobileVisibleItemBudget && typeof turn.mobileVisibleItemBudget === "object" ? turn.mobileVisibleItemBudget : {};
				const omitted = Math.max(0, Math.trunc(Number(turn.mobileOmittedVisibleItemCount || budget.omitted || 0)));
				if (!omitted) return null;
				return {
					omitted,
					retained: Math.max(0, Math.trunc(Number(budget.retained || 0))),
					original: Math.max(0, Math.trunc(Number(budget.original || 0))),
					ceiling: Math.max(0, Math.trunc(Number(budget.ceiling || 0))),
					reason: String(budget.reason || "response-budget")
				};
			}
			function visibleItemBudgetSignature(turn) {
				const budget = visibleItemBudgetForTurn(turn);
				if (!budget) return null;
				return budget;
			}
			function inputContentSignature(content) {
				return (content || []).map((part) => {
					if (!part || typeof part !== "object") return String(part || "");
					if (isInputTextPart(part)) return {
						type: "text",
						text: inputTextValue(part)
					};
					if (isInputImagePart(part)) return {
						type: part.type || "image",
						path: part.path || "",
						url: imageSourceSignature(imageUrlValue(part))
					};
					return compactStructuredForSignature(part);
				});
			}
			function imageSourceSignature(value) {
				const text = String(value || "");
				if (/^data:image\//i.test(text)) return `${text.slice(0, 48)}...${text.length}`;
				return text;
			}
			function compactStructuredForSignature(value) {
				try {
					return truncateMiddle(JSON.stringify(value), 600, "payload");
				} catch (_) {
					return String(value || "");
				}
			}
			function itemVisibleWeight(item) {
				const signature = visibleItemSignature(item);
				return signature ? JSON.stringify(signature).length : 0;
			}
			function turnVisibleWeight(turn) {
				return (turn && Array.isArray(turn.items) ? turn.items : []).reduce((total, item) => total + itemVisibleWeight(item), 0);
			}
			function isAssistantReceiptLikeItem(item) {
				return Boolean(item && (item.type === "agentMessage" || item.type === "plan"));
			}
			function completedIncomingTurnHasAuthoritativeReceipt(incomingTurn) {
				return threadDetailStatePolicy.completedIncomingTurnHasAuthoritativeReceipt(incomingTurn);
			}
			function shouldDropLocalOnlyReceiptForIncomingTurn(item, incomingTurn = null) {
				return threadDetailStatePolicy.shouldDropLocalOnlyReceiptForIncomingTurn(item, incomingTurn);
			}
			function shouldPreserveLocalOnlyItem(item, preserveLocalVisible = false, suppressedVisualReceiptKeys = null, incomingTurn = null) {
				return threadDetailStatePolicy.shouldPreserveLocalOnlyItem(item, preserveLocalVisible, suppressedVisualReceiptKeys, incomingTurn);
			}
			function isMuxUserMessage(item) {
				return Boolean(item && item.type === "userMessage" && /^mux-user-/.test(String(item.id || "")));
			}
			function isOptimisticUserMessage(item) {
				return Boolean(item && item.type === "userMessage" && (item.mobilePendingSubmission || /^local-user-/.test(String(item.id || "")) || isMuxUserMessage(item)));
			}
			function userMessageSubmissionIdCandidates(item) {
				if (!item || item.type !== "userMessage") return [];
				const values = [];
				const explicit = String(item.clientSubmissionId || "").trim();
				if (explicit) values.push(explicit);
				const local = String(item.id || "").match(/^local-user-(.+)$/);
				if (local && local[1]) values.push(local[1]);
				return [...new Set(values)];
			}
			function userMessageHasSubmissionId(item, submissionId) {
				const value = String(submissionId || "").trim();
				if (!value || !item || item.type !== "userMessage") return false;
				if (userMessageSubmissionIdCandidates(item).includes(value)) return true;
				const id = String(item.id || "");
				return Boolean(id && id.endsWith(`-${value}`));
			}
			function userMessagesShareSubmissionId(left, right) {
				const leftValues = userMessageSubmissionIdCandidates(left);
				const rightValues = userMessageSubmissionIdCandidates(right);
				return leftValues.some((value) => userMessageHasSubmissionId(right, value)) || rightValues.some((value) => userMessageHasSubmissionId(left, value));
			}
			function isTurnUsageSummaryItem(item) {
				return Boolean(item && item.type === "turnUsageSummary");
			}
			function isTurnDiagnosticItem(item) {
				return Boolean(item && item.type === "turnDiagnostic");
			}
			function dedupeTurnUsageSummaryItems(items) {
				if (!Array.isArray(items)) return [];
				let lastSummaryIndex = -1;
				items.forEach((item, index) => {
					if (isTurnUsageSummaryItem(item)) lastSummaryIndex = index;
				});
				if (lastSummaryIndex < 0) return items;
				return items.filter((item, index) => !isTurnUsageSummaryItem(item) || index === lastSummaryIndex);
			}
			function normalizeComparableText(value) {
				return String(value || "").replace(/\s+/g, " ").trim();
			}
			function userMessageComparableParts(item) {
				const result = {
					text: "",
					paths: []
				};
				if (!item || item.type !== "userMessage") return result;
				const textParts = [];
				const paths = [];
				if (typeof item.text === "string") textParts.push(item.text);
				if (typeof item.message === "string") textParts.push(item.message);
				const contentParts = Array.isArray(item.content) ? item.content : typeof item.content === "string" ? [{
					type: "text",
					text: item.content
				}] : [];
				for (const part of contentParts) {
					if (!part || typeof part !== "object") continue;
					if (isInputTextPart(part)) {
						const split = splitAttachmentSummaryText(inputTextValue(part));
						if (split.text) textParts.push(split.text);
						for (const attachment of split.attachments) if (attachment.path) paths.push(normalizeFsPath(attachment.path));
						continue;
					}
					if (part.path) paths.push(normalizeFsPath(part.path));
					else if (isInputImagePart(part)) {
						const url = imageUrlValue(part);
						if (url && !/^data:image\//i.test(url)) paths.push(normalizeFsPath(url));
					}
				}
				result.text = normalizeComparableText(textParts.join("\n"));
				result.paths = [...new Set(paths.filter(Boolean))].sort();
				return result;
			}
			function userMessagePathOverlap(left, right) {
				return left.paths.length > 0 && right.paths.length > 0 && left.paths.some((pathValue) => right.paths.includes(pathValue));
			}
			function comparablePathName(pathValue) {
				const text = String(pathValue || "").split(/[?#]/)[0];
				const parts = normalizeFsPath(text).split("\\").filter(Boolean);
				return parts[parts.length - 1] || "";
			}
			function userMessagePathNameOverlap(left, right) {
				if (!left.paths.length || !right.paths.length) return false;
				const leftNames = new Set(left.paths.map(comparablePathName).filter(Boolean));
				if (!leftNames.size) return false;
				return right.paths.some((pathValue) => {
					const rightName = comparablePathName(pathValue);
					return rightName && Array.from(leftNames).some((leftName) => comparablePathNamesLikelySame(leftName, rightName));
				});
			}
			function comparablePathNamesLikelySame(leftName, rightName) {
				const left = String(leftName || "");
				const right = String(rightName || "");
				if (!left || !right) return false;
				if (left === right) return true;
				return left.endsWith(`-${right}`) || right.endsWith(`-${left}`);
			}
			function isVisualReceiptItem(item) {
				return Boolean(item && (item.type === "imageView" || item.type === "imageGeneration"));
			}
			function visualReceiptComparableNames(item) {
				if (!isVisualReceiptItem(item)) return [];
				const values = [
					imageViewPath(item),
					imageViewContentUrl(item),
					imageViewUrl(item),
					item.fileName,
					item.file_name,
					item.label,
					item.caption,
					item.name
				];
				return [...new Set(values.map(comparablePathName).filter(Boolean))];
			}
			function visualReceiptCallId(item) {
				return String(item && (item.callId || item.call_id || item.toolCallId || item.tool_call_id || item.arguments && (item.arguments.callId || item.arguments.call_id || item.arguments.toolCallId || item.arguments.tool_call_id) || item.result && (item.result.callId || item.result.call_id || item.result.toolCallId || item.result.tool_call_id)) || "").trim();
			}
			function visualReceiptSuppressionKeys(item) {
				if (!isVisualReceiptItem(item)) return [];
				const keys = /* @__PURE__ */ new Set();
				const id = String(item && item.id || "").trim();
				const callId = visualReceiptCallId(item);
				if (id) keys.add(`id:${id}`);
				if (callId) keys.add(`call:${callId}`);
				for (const name of visualReceiptComparableNames(item)) keys.add(`name:${name}`);
				return [...keys];
			}
			function suppressedVisualReceiptKeySet(turn) {
				const values = Array.isArray(turn && turn.mobileSuppressedVisualReceiptKeys) ? turn.mobileSuppressedVisualReceiptKeys : [];
				return new Set(values.map((entry) => String(entry || "").trim()).filter(Boolean));
			}
			function visualReceiptMatchesSuppressionKeys(item, suppressedVisualReceiptKeys) {
				if (!isVisualReceiptItem(item) || !suppressedVisualReceiptKeys || !suppressedVisualReceiptKeys.size) return false;
				return visualReceiptSuppressionKeys(item).some((key) => suppressedVisualReceiptKeys.has(key));
			}
			function userMessageSpecificity(item) {
				const parts = userMessageComparableParts(item);
				return parts.text.length + parts.paths.length * 240;
			}
			function userMessagesLikelySame(left, right) {
				if (!left || !right || left.type !== "userMessage" || right.type !== "userMessage") return false;
				const a = userMessageComparableParts(left);
				const b = userMessageComparableParts(right);
				if (a.text && b.text && a.text === b.text) {
					if (isOptimisticUserMessage(left) || isOptimisticUserMessage(right)) return true;
					if (!a.paths.length && !b.paths.length) return true;
					return userMessagePathOverlap(a, b);
				}
				if ((isOptimisticUserMessage(left) || isOptimisticUserMessage(right)) && userMessagePathNameOverlap(a, b) && (!a.text || !b.text || a.text === b.text)) return true;
				return userMessagePathOverlap(a, b) && (!a.text || !b.text || a.text === b.text);
			}
			function userMessagesCanShadow(left, right) {
				const leftSubmittedEcho = Boolean(String(left && left.clientSubmissionId || "").trim() && !(left && left.mobileSendError));
				const rightSubmittedEcho = Boolean(String(right && right.clientSubmissionId || "").trim() && !(right && right.mobileSendError));
				const projectionIndexId = (item) => String(item && (item.id || item.itemId || item.item_id) || "").trim().match(/^item-(\d+)$/i);
				const leftProjectionIndex = Boolean(projectionIndexId(left));
				const rightProjectionIndex = Boolean(projectionIndexId(right));
				const itemTimeMs = (item) => {
					const value = item && (item.startedAtMs || item.startedAt || item.createdAtMs || item.createdAt || item.timestampMs || item.timestamp || item.updatedAtMs || item.updatedAt);
					if (value === null || value === void 0 || value === "") return 0;
					const numberValue = Number(value);
					if (Number.isFinite(numberValue) && numberValue > 0) return numberValue > 0xe8d4a51000 ? Math.trunc(numberValue) : Math.trunc(numberValue * 1e3);
					const parsed = Date.parse(String(value));
					return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
				};
				const leftProjectionTime = itemTimeMs(left);
				const rightProjectionTime = itemTimeMs(right);
				const projectionIndexEcho = Boolean(leftProjectionIndex && rightProjectionIndex && leftProjectionTime && rightProjectionTime && Math.abs(leftProjectionTime - rightProjectionTime) <= 5e3);
				return Boolean(left && right && left.type === "userMessage" && right.type === "userMessage" && (isOptimisticUserMessage(left) || isOptimisticUserMessage(right) || leftSubmittedEcho || rightSubmittedEcho || projectionIndexEcho) && userMessagesLikelySame(left, right));
			}
			function userMessageTimestampMs(item) {
				const value = item && (item.startedAtMs || item.startedAt || item.createdAtMs || item.createdAt || item.timestampMs || item.timestamp || item.updatedAtMs || item.updatedAt || item.mobileDisplayTimestampMs);
				if (value === null || value === void 0 || value === "") return 0;
				const numberValue = Number(value);
				if (Number.isFinite(numberValue) && numberValue > 0) return numberValue > 0xe8d4a51000 ? Math.trunc(numberValue) : Math.trunc(numberValue * 1e3);
				const parsed = Date.parse(String(value));
				return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
			}
			function userMessagesHaveNearbyTimestamps(left, right, windowMs = 600 * 1e3) {
				const leftMs = userMessageTimestampMs(left);
				const rightMs = userMessageTimestampMs(right);
				return Boolean(leftMs && rightMs && Math.abs(leftMs - rightMs) <= windowMs);
			}
			function isProjectionIndexUserMessage(item) {
				return Boolean(String(item && (item.id || item.itemId || item.item_id) || "").trim().match(/^item-\d+$/i));
			}
			function userMessagesAreSameEventAcrossTurns(left, right) {
				if (!left || !right || left.type !== "userMessage" || right.type !== "userMessage") return false;
				if (!userMessagesLikelySame(left, right)) return false;
				if (userMessagesShareSubmissionId(left, right)) return true;
				if (userMessagesCanShadow(left, right)) return true;
				const leftTime = userMessageTimestampMs(left);
				const rightTime = userMessageTimestampMs(right);
				if (!leftTime || !rightTime || Math.abs(leftTime - rightTime) > 5e3) return false;
				return Boolean(isOptimisticUserMessage(left) || isOptimisticUserMessage(right) || isProjectionIndexUserMessage(left) || isProjectionIndexUserMessage(right));
			}
			function durableTurnCanReceivePendingEcho(turn) {
				if (!turn) return false;
				const status = turn.status;
				const statusType = status && typeof status === "object" ? String(status.type || status.status || status.state || "") : String(status || "");
				if (/completed|failed|cancel|error|interrupted/i.test(statusType)) return false;
				if (/running|active|queued|processing|inprogress|in_progress|in-progress|pending|started/i.test(statusType)) return true;
				return Boolean(turn.live || turn.mobileLive || turn.mobileActiveLiveTurn || turn.mobilePendingOverlay);
			}
			function optimisticEchoCanMatchEarlierDurable(durableItem, optimisticItem, durableTurn = null) {
				if (!durableItem || !optimisticItem) return false;
				if (durableItem.type !== "userMessage" || optimisticItem.type !== "userMessage") return false;
				if (isOptimisticUserMessage(durableItem) || !isOptimisticUserMessage(optimisticItem)) return false;
				if (userMessagesShareSubmissionId(durableItem, optimisticItem)) return true;
				const likelySameNearby = userMessagesLikelySame(durableItem, optimisticItem) && userMessagesHaveNearbyTimestamps(durableItem, optimisticItem);
				if (optimisticItem.mobileSendError) return likelySameNearby;
				if (!Boolean(optimisticItem.mobilePendingSubmission && String(optimisticItem.clientSubmissionId || "").trim() && /^local-user-/.test(String(optimisticItem.id || ""))) || !durableTurnCanReceivePendingEcho(durableTurn)) return false;
				return likelySameNearby;
			}
			function hasMatchingIncomingUserMessage(existingItem, incomingItems) {
				if (!existingItem || existingItem.type !== "userMessage") return false;
				return (incomingItems || []).some((incomingItem) => incomingItem && incomingItem.id !== existingItem.id && incomingItem.type === "userMessage" && userMessagesCanShadow(existingItem, incomingItem));
			}
			function hasMatchingRealUserMessage(item, items) {
				if (!isMuxUserMessage(item)) return false;
				return (items || []).some((candidate) => candidate && candidate.id !== item.id && candidate.type === "userMessage" && !isMuxUserMessage(candidate) && userMessagesCanShadow(candidate, item));
			}
			function removeShadowedMuxUserMessages(items) {
				return (items || []).filter((item) => !hasMatchingRealUserMessage(item, items));
			}
			function userMessageShadowPriority(item) {
				if (!item || item.type !== "userMessage") return 0;
				if (/^local-user-/.test(String(item.id || ""))) return 1;
				if (isMuxUserMessage(item) || item.mobilePendingSubmission || String(item.clientSubmissionId || "").trim()) return 2;
				const projectionMatch = String(item.id || item.itemId || item.item_id || "").trim().match(/^item-(\d+)$/i);
				if (projectionMatch) return 2 + Math.max(0, Math.min(999999, Number(projectionMatch[1]) || 0)) / 1e6;
				return 3;
			}
			function mergeLikelySameUserMessage(existingItem, incomingItem) {
				const existingPriority = userMessageShadowPriority(existingItem);
				const incomingPriority = userMessageShadowPriority(incomingItem);
				const merged = mergeItemPreservingVisibleFields(existingItem, incomingItem);
				const preferred = incomingPriority >= existingPriority ? incomingItem : existingItem;
				if (preferred && preferred.id) merged.id = preferred.id;
				if (preferred && preferred.clientSubmissionId) merged.clientSubmissionId = preferred.clientSubmissionId;
				else if (existingItem && existingItem.clientSubmissionId) merged.clientSubmissionId = existingItem.clientSubmissionId;
				else if (incomingItem && incomingItem.clientSubmissionId) merged.clientSubmissionId = incomingItem.clientSubmissionId;
				if (preferred && preferred.startedAtMs && !merged.startedAtMs) merged.startedAtMs = preferred.startedAtMs;
				if (preferred && !isOptimisticUserMessage(preferred)) {
					delete merged.mobilePendingSubmission;
					delete merged.mobileSendError;
				}
				if (incomingItem && !isOptimisticUserMessage(incomingItem) && isOptimisticUserMessage(existingItem) || incomingPriority > existingPriority && incomingPriority >= 3) {
					if (Array.isArray(incomingItem.content)) merged.content = incomingItem.content;
					if (typeof incomingItem.text === "string") merged.text = incomingItem.text;
					if (typeof incomingItem.message === "string") merged.message = incomingItem.message;
				}
				return merged;
			}
			function dedupeLikelySameUserMessages(items) {
				const out = [];
				for (const item of items || []) {
					if (item && item.type === "userMessage") {
						const existingIndex = out.findIndex((candidate) => userMessagesCanShadow(candidate, item));
						if (existingIndex >= 0) {
							out[existingIndex] = mergeLikelySameUserMessage(out[existingIndex], item);
							continue;
						}
					}
					out.push(item);
				}
				return out;
			}
			function normalizeThreadVisibleUserMessages(thread) {
				if (!thread || !Array.isArray(thread.turns)) return thread;
				for (const turn of thread.turns) {
					if (!turn || !Array.isArray(turn.items)) continue;
					turn.items = removeShadowedMuxUserMessages(dedupeLikelySameUserMessages(turn.items));
				}
				const userMessages = threadUserMessageEntries(thread.turns);
				const durableUserMessages = [];
				for (const entry of userMessages) if (entry && entry.item && !isOptimisticUserMessage(entry.item)) durableUserMessages.push(entry);
				if (!durableUserMessages.length && userMessages.length < 2) return thread;
				for (let turnIndex = 0; turnIndex < thread.turns.length; turnIndex += 1) {
					const turn = thread.turns[turnIndex];
					if (!turn || !Array.isArray(turn.items)) continue;
					turn.items = turn.items.filter((item, itemIndex) => !shouldDropOptimisticUserMessageForDurable(item, turnIndex, durableUserMessages) && !shouldDropOptimisticUserMessageForHigherPriorityEcho(item, turnIndex, itemIndex, userMessages) && !shouldDropDuplicateUserMessageEvent(item, turnIndex, itemIndex, userMessages));
				}
				return thread;
			}
			function threadUserMessageEntries(turns) {
				const entries = [];
				for (let turnIndex = 0; turnIndex < (turns || []).length; turnIndex += 1) {
					const turn = turns[turnIndex];
					const items = Array.isArray(turn && turn.items) ? turn.items : [];
					for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
						const item = items[itemIndex];
						if (item && item.type === "userMessage") entries.push({
							item,
							turn,
							turnIndex,
							itemIndex
						});
					}
				}
				return entries;
			}
			function shouldDropOptimisticUserMessageForDurable(item, turnIndex, durableUserMessages) {
				if (!isOptimisticUserMessage(item) || !Array.isArray(durableUserMessages)) return false;
				return durableUserMessages.some((real) => {
					if (!real || !real.item || real.item.id === item.id) return false;
					if (!userMessagesCanShadow(real.item, item)) return false;
					if (real.turnIndex >= turnIndex) return true;
					if (optimisticEchoCanMatchEarlierDurable(real.item, item, real.turn)) return true;
					return userMessageHasVisualAttachment(real.item) && userMessageHasVisualAttachment(item);
				});
			}
			function shouldDropOptimisticUserMessageForHigherPriorityEcho(item, turnIndex, itemIndex, userMessages) {
				if (!isOptimisticUserMessage(item) || item.mobileSendError || !Array.isArray(userMessages)) return false;
				const itemPriority = userMessageShadowPriority(item);
				if (itemPriority <= 0 || itemPriority >= 3) return false;
				return userMessages.some((candidate) => {
					if (!candidate || !candidate.item || candidate.item === item || candidate.item.id === item.id) return false;
					if (userMessageShadowPriority(candidate.item) <= itemPriority) return false;
					if (!userMessagesShareSubmissionId(candidate.item, item)) {
						if (candidate.turnIndex < turnIndex) return false;
						if (candidate.turnIndex === turnIndex && candidate.itemIndex <= itemIndex) return false;
					}
					return userMessagesCanShadow(candidate.item, item);
				});
			}
			function shouldDropDuplicateUserMessageEvent(item, turnIndex, itemIndex, userMessages) {
				if (!item || item.type !== "userMessage" || !Array.isArray(userMessages)) return false;
				const itemHasVisualAttachment = userMessageHasVisualAttachment(item);
				const itemPriority = userMessageShadowPriority(item);
				return userMessages.some((candidate) => {
					if (!candidate || !candidate.item || candidate.item === item || candidate.item.id === item.id) return false;
					if (candidate.turnIndex < turnIndex) return false;
					if (candidate.turnIndex === turnIndex && candidate.itemIndex <= itemIndex) return false;
					const sameSubmission = userMessagesShareSubmissionId(candidate.item, item);
					if ((itemHasVisualAttachment || userMessageHasVisualAttachment(candidate.item)) && !sameSubmission) return false;
					if (!userMessagesAreSameEventAcrossTurns(candidate.item, item)) return false;
					const candidatePriority = userMessageShadowPriority(candidate.item);
					if (candidatePriority > itemPriority) return true;
					if (candidatePriority === itemPriority) return true;
					return false;
				});
			}
			function threadDurableUserMessages(turns) {
				const messages = [];
				for (const turn of turns || []) {
					const items = Array.isArray(turn && turn.items) ? turn.items : [];
					for (const item of items) if (item && item.type === "userMessage" && !isOptimisticUserMessage(item)) messages.push(item);
				}
				return messages;
			}
			function shouldDropInitialSubmissionEchoTurn(existingTurn, incomingTurns, initialSubmissionId) {
				const submissionId = String(initialSubmissionId || "").trim();
				if (!submissionId || !existingTurn || !Array.isArray(existingTurn.items)) return false;
				const visibleItems = existingTurn.items.filter((item) => item && itemVisibleWeight(item) > 0 && !isReasoningItem(item));
				const submittedEchoes = visibleItems.filter((item) => item && item.type === "userMessage" && isOptimisticUserMessage(item) && String(item.clientSubmissionId || "") === submissionId);
				if (!submittedEchoes.length || submittedEchoes.length !== visibleItems.length) return false;
				const durableMessages = threadDurableUserMessages(incomingTurns);
				return submittedEchoes.every((echo) => durableMessages.some((real) => userMessagesCanShadow(real, echo)));
			}
			function threadHasInitialSubmissionEcho(thread, initialSubmissionId) {
				const submissionId = String(initialSubmissionId || "").trim();
				if (!submissionId || !thread || !Array.isArray(thread.turns)) return false;
				return thread.turns.some((turn) => {
					return (Array.isArray(turn && turn.items) ? turn.items : []).some((item) => item && item.type === "userMessage" && isOptimisticUserMessage(item) && String(item.clientSubmissionId || "") === submissionId);
				});
			}
			function shouldPreserveMissingExistingTurn(existingTurn) {
				if (!existingTurn || isTurnComplete(existingTurn)) return false;
				const visibleItems = (Array.isArray(existingTurn.items) ? existingTurn.items : []).filter((item) => item && itemVisibleWeight(item) > 0 && !isReasoningItem(item));
				return Boolean(visibleItems.length && visibleItems.every((item) => item.type === "userMessage" && isOptimisticUserMessage(item)));
			}
			function comparableVisibleTextItem(item) {
				return Boolean(item && (item.type === "agentMessage" || item.type === "plan"));
			}
			function comparableVisibleText(item) {
				if (!comparableVisibleTextItem(item)) return "";
				return normalizeComparableText(item.text || "");
			}
			function visibleTextItemsLikelySame(existingItem, incomingItem) {
				if (!comparableVisibleTextItem(existingItem) || !comparableVisibleTextItem(incomingItem)) return false;
				if (existingItem.type !== incomingItem.type) return false;
				const existingText = comparableVisibleText(existingItem);
				const incomingText = comparableVisibleText(incomingItem);
				if (!existingText || !incomingText) return false;
				return incomingText === existingText || incomingText.length >= existingText.length && incomingText.startsWith(existingText);
			}
			function visibleTextItemsHaveStableSharedPrefix(existingItem, incomingItem) {
				if (!comparableVisibleTextItem(existingItem) || !comparableVisibleTextItem(incomingItem)) return false;
				if (existingItem.type !== incomingItem.type) return false;
				const existingText = comparableVisibleText(existingItem);
				const incomingText = comparableVisibleText(incomingItem);
				if (!existingText || !incomingText) return false;
				if (existingText === incomingText) return true;
				const shorterText = existingText.length <= incomingText.length ? existingText : incomingText;
				const longerText = existingText.length <= incomingText.length ? incomingText : existingText;
				if (shorterText.length < 16) return false;
				if (!longerText.startsWith(shorterText)) return false;
				return shorterText.length / Math.max(1, longerText.length) >= .5;
			}
			function completedReceiptItemsLikelySame(existingItem, incomingItem, incomingTurn = null) {
				if (!completedIncomingTurnHasAuthoritativeReceipt(incomingTurn)) return false;
				if (!isAssistantReceiptLikeItem(existingItem) || !isAssistantReceiptLikeItem(incomingItem)) return false;
				return visibleTextItemsLikelySame(existingItem, incomingItem) || visibleTextItemsHaveStableSharedPrefix(existingItem, incomingItem);
			}
			function visibleTextItemsCanShareRenderIdentity(existingItem, incomingItem, incomingTurn = null) {
				return threadDetailStatePolicy.visibleTextItemsCanShareRenderIdentity(existingItem, incomingItem, incomingTurn);
			}
			function findUnusedExistingItemIndexForIncoming(incomingItem, existingItems, usedExistingIndexes, incomingTurn = null) {
				if (!incomingItem) return -1;
				const used = usedExistingIndexes || /* @__PURE__ */ new Set();
				if (incomingItem.id) {
					const index = (existingItems || []).findIndex((existingItem, candidateIndex) => existingItem && !used.has(candidateIndex) && existingItem.id === incomingItem.id);
					if (index >= 0) return index;
				}
				if (incomingItem.type === "userMessage") {
					const index = (existingItems || []).findIndex((existingItem, candidateIndex) => existingItem && !used.has(candidateIndex) && existingItem.type === "userMessage" && userMessagesCanShadow(existingItem, incomingItem));
					if (index >= 0) return index;
				}
				if (comparableVisibleTextItem(incomingItem)) {
					const index = (existingItems || []).findIndex((existingItem, candidateIndex) => existingItem && !used.has(candidateIndex) && visibleTextItemsCanShareRenderIdentity(existingItem, incomingItem, incomingTurn));
					if (index >= 0) return index;
				}
				return -1;
			}
			function mergeIncomingOrderedItem(existingItem, incomingItem, incomingTurn = null) {
				if (!existingItem) return incomingItem;
				if (!incomingItem) return existingItem;
				if (incomingItem.type === "userMessage" && existingItem.type === "userMessage") return mergeLikelySameUserMessage(existingItem, incomingItem);
				if (visibleTextItemsCanShareRenderIdentity(existingItem, incomingItem, incomingTurn)) return mergeVisibleTextItemPreservingRenderIdentity(existingItem, incomingItem, incomingTurn);
				return mergeItemPreservingVisibleFields(existingItem, incomingItem);
			}
			function insertLocalOnlyItemByExistingOrder(merged, item, existingIndex, existingIndexToMergedIndex) {
				if (!item) return;
				let insertAt = -1;
				for (let index = existingIndex - 1; index >= 0; index -= 1) if (existingIndexToMergedIndex.has(index)) {
					insertAt = existingIndexToMergedIndex.get(index) + 1;
					break;
				}
				if (insertAt < 0) {
					for (const [index, mergedIndex] of existingIndexToMergedIndex.entries()) if (index > existingIndex && (insertAt < 0 || mergedIndex < insertAt)) insertAt = mergedIndex;
				}
				if (insertAt < 0 || insertAt > merged.length) insertAt = merged.length;
				merged.splice(insertAt, 0, item);
				for (const [index, mergedIndex] of existingIndexToMergedIndex.entries()) if (mergedIndex >= insertAt) existingIndexToMergedIndex.set(index, mergedIndex + 1);
				existingIndexToMergedIndex.set(existingIndex, insertAt);
			}
			function mergeItemPreservingVisibleFields(existingItem, incomingItem) {
				return threadDetailStatePolicy.mergeItemPreservingVisibleFields(existingItem, incomingItem);
			}
			function mergeVisibleTextItemPreservingRenderIdentity(existingItem, incomingItem, incomingTurn = null) {
				return threadDetailStatePolicy.mergeVisibleTextItemPreservingRenderIdentity(existingItem, incomingItem, incomingTurn);
			}
			function mergeItemsPreservingLocalVisible(existingItems, incomingItems, preserveLocalVisible = false, incomingTurn = null) {
				const added = /* @__PURE__ */ new Set();
				const usedExistingIndexes = /* @__PURE__ */ new Set();
				const existingIndexToMergedIndex = /* @__PURE__ */ new Map();
				const merged = [];
				const suppressedVisualReceiptKeys = suppressedVisualReceiptKeySet(incomingTurn);
				for (const incomingItem of incomingItems || []) {
					if (!incomingItem) continue;
					if (incomingItem.id && added.has(incomingItem.id)) continue;
					if (hasMatchingRealUserMessage(incomingItem, merged) || hasMatchingRealUserMessage(incomingItem, incomingItems)) continue;
					const existingIndex = findUnusedExistingItemIndexForIncoming(incomingItem, existingItems || [], usedExistingIndexes, incomingTurn);
					const existingItem = existingIndex >= 0 ? existingItems[existingIndex] : null;
					const mergedItem = mergeIncomingOrderedItem(existingItem, incomingItem, incomingTurn);
					merged.push(mergedItem);
					if (incomingItem.id) added.add(incomingItem.id);
					if (mergedItem && mergedItem.id) added.add(mergedItem.id);
					if (existingItem && existingItem.id) added.add(existingItem.id);
					if (existingIndex >= 0) {
						usedExistingIndexes.add(existingIndex);
						existingIndexToMergedIndex.set(existingIndex, merged.length - 1);
					}
				}
				(existingItems || []).forEach((existingItem, existingIndex) => {
					if (!existingItem || usedExistingIndexes.has(existingIndex)) return;
					if (!shouldPreserveLocalOnlyItem(existingItem, preserveLocalVisible, suppressedVisualReceiptKeys, incomingTurn)) return;
					if (existingItem.id && added.has(existingItem.id)) return;
					insertLocalOnlyItemByExistingOrder(merged, existingItem, existingIndex, existingIndexToMergedIndex);
					if (existingItem.id) added.add(existingItem.id);
				});
				return dedupeTurnUsageSummaryItems(removeShadowedMuxUserMessages(dedupeLikelySameUserMessages(merged)));
			}
			function mergeTurnPreservingVisibleItems(existingTurn, incomingTurn) {
				return threadDetailMergePolicy.mergeTurnPreservingVisibleItems(existingTurn, incomingTurn);
			}
			function shouldPreserveLiveTurnLocalVisibleItems(existingTurn, incomingTurn, existingWeight = null) {
				return threadDetailMergePolicy.shouldPreserveLiveTurnLocalVisibleItems(existingTurn, incomingTurn, existingWeight);
			}
			function mergeThreadPreservingVisibleItems(existingThread, incomingThread) {
				return threadDetailMergePolicy.mergeThreadPreservingVisibleItems(existingThread, incomingThread, { activeTurnId: state.activeTurnId });
			}
			function firstTurnTimestampMs(turn, fields = []) {
				for (const field of fields) {
					const timestamp = numericTimestampMs(turn && turn[field]);
					if (timestamp) return timestamp;
				}
				return 0;
			}
			function turnOrderMs(turn) {
				if (!turn) return 0;
				if (isTurnComplete(turn)) return firstTurnTimestampMs(turn, [
					"completedAtMs",
					"completedAt",
					"completed_at_ms",
					"completed_at",
					"updatedAtMs",
					"updatedAt",
					"updated_at_ms",
					"updated_at",
					"startedAtMs",
					"startedAt",
					"started_at_ms",
					"started_at",
					"createdAtMs",
					"createdAt",
					"created_at_ms",
					"created_at"
				]);
				return firstTurnTimestampMs(turn, [
					"startedAtMs",
					"startedAt",
					"started_at_ms",
					"started_at",
					"createdAtMs",
					"createdAt",
					"created_at_ms",
					"created_at",
					"updatedAtMs",
					"updatedAt",
					"updated_at_ms",
					"updated_at",
					"completedAtMs",
					"completedAt",
					"completed_at_ms",
					"completed_at"
				]);
			}
			function turnIsSupersededBy(turn, newerTurn) {
				if (!turn || !newerTurn || turn.id === newerTurn.id) return false;
				const left = turnOrderMs(turn);
				const right = turnOrderMs(newerTurn);
				if (left && right) return right > left;
				return isTurnComplete(newerTurn) && !isTurnComplete(turn);
			}
			const threadDetailStatePolicy = threadDetailStateApi.createThreadDetailStatePolicy({
				itemVisibleWeight,
				isContextCompactionItem,
				isOperationalItem,
				isAssistantReceiptLikeItem,
				isTurnComplete,
				isReasoningItem,
				visualReceiptMatchesSuppressionKeys,
				comparableVisibleText,
				visibleTextItemsLikelySame,
				completedReceiptItemsLikelySame
			});
			const threadListSummaryFromDetailThread = threadDetailStateApi.threadListSummaryFromDetailThread;
			const planThreadOpenCacheReuse = threadDetailStateApi.planThreadOpenCacheReuse;
			const threadHasReusableLoadedDetailState = threadDetailStateApi.threadHasReusableLoadedDetailState;
			const threadDetailV4MergePolicy = threadDetailV4MergeStateApi.createThreadDetailV4MergePolicy({
				normalizeThreadVisibleUserMessages,
				turnVisibleWeight,
				isOptimisticUserMessage,
				isRecentlySubmittedUserMessage,
				isReasoningItem,
				userMessageHasSubmissionId,
				userMessagesCanShadow,
				isTurnComplete,
				isRunningStatus,
				isIncompleteInterruptedTurn,
				turnHasActiveLiveItems,
				turnOrderMs,
				mergeTurnPreservingVisibleItems,
				sortTurnsForDisplay,
				maxVisibleTurnsForThread
			});
			const threadDetailMergePolicy = threadDetailMergeStateApi.createThreadDetailMergePolicy({
				isV4ProjectionThread: threadDetailV4MergePolicy.isV4ProjectionThread,
				mergeV4ProjectionThread: threadDetailV4MergePolicy.mergeV4ProjectionThread,
				normalizeThreadVisibleUserMessages,
				turnVisibleWeight,
				shouldPreserveExistingTurnVisibleItems: (existingTurn, incomingTurn, existingWeight) => threadDetailStatePolicy.shouldPreserveExistingTurnVisibleItems(existingTurn, incomingTurn, existingWeight),
				mergeItemsPreservingLocalVisible,
				shouldDropInitialSubmissionEchoTurn,
				shouldPreserveMissingExistingTurn,
				turnIsSupersededBy,
				isTurnComplete,
				sortTurnsForDisplay,
				threadHasInitialSubmissionEcho,
				maxExpandedVisibleTurns: MAX_EXPANDED_VISIBLE_TURNS
			});
			return {
				threadDetailStatePolicy,
				threadDetailV4MergePolicy,
				threadDetailMergePolicy,
				threadListSummaryFromDetailThread,
				planThreadOpenCacheReuse,
				threadHasReusableLoadedDetailState,
				liveTurnHasNonUserProgress,
				isVisibleNonUserProgressItem,
				liveTurnHasNonUserProgressBefore,
				liveTurnHasNonUserProgressAfter,
				isUserVisibleTextReplyItem,
				liveTurnHasUserVisibleTextReplyAfter,
				userMessageHasVisualAttachment,
				shouldHideDurableLiveUserMessage,
				durableUserMessageMatchesOptimisticEcho,
				threadHasDurableUserMessageWithSubmissionId,
				threadHasDurableUserMessageMatchingOptimisticEcho,
				shouldHideOptimisticUserMessageEcho,
				isSupersededLiveTurn,
				shouldHideSupersededLiveUserMessage,
				isRawThreadReadMode,
				shouldPreserveRawThreadVisibleEntry,
				itemTextValue,
				reasoningItemHasVisibleText,
				isLatestCompletedProcessTurn,
				limitRawThreadVisibleEntries,
				visibleItemsForTurn,
				currentLiveOperationEntry,
				liveTurnStatusDockItem,
				visibleItemSignature,
				visibleItemBudgetForTurn,
				visibleItemBudgetSignature,
				inputContentSignature,
				imageSourceSignature,
				compactStructuredForSignature,
				itemVisibleWeight,
				turnVisibleWeight,
				isAssistantReceiptLikeItem,
				completedIncomingTurnHasAuthoritativeReceipt,
				shouldDropLocalOnlyReceiptForIncomingTurn,
				shouldPreserveLocalOnlyItem,
				isMuxUserMessage,
				isOptimisticUserMessage,
				userMessageSubmissionIdCandidates,
				userMessageHasSubmissionId,
				userMessagesShareSubmissionId,
				isTurnUsageSummaryItem,
				isTurnDiagnosticItem,
				dedupeTurnUsageSummaryItems,
				normalizeComparableText,
				userMessageComparableParts,
				userMessagePathOverlap,
				comparablePathName,
				userMessagePathNameOverlap,
				comparablePathNamesLikelySame,
				isVisualReceiptItem,
				visualReceiptComparableNames,
				visualReceiptCallId,
				visualReceiptSuppressionKeys,
				suppressedVisualReceiptKeySet,
				visualReceiptMatchesSuppressionKeys,
				userMessageSpecificity,
				userMessagesLikelySame,
				userMessagesCanShadow,
				userMessageTimestampMs,
				userMessagesHaveNearbyTimestamps,
				isProjectionIndexUserMessage,
				userMessagesAreSameEventAcrossTurns,
				durableTurnCanReceivePendingEcho,
				optimisticEchoCanMatchEarlierDurable,
				hasMatchingIncomingUserMessage,
				hasMatchingRealUserMessage,
				removeShadowedMuxUserMessages,
				userMessageShadowPriority,
				mergeLikelySameUserMessage,
				dedupeLikelySameUserMessages,
				normalizeThreadVisibleUserMessages,
				threadUserMessageEntries,
				shouldDropOptimisticUserMessageForDurable,
				shouldDropOptimisticUserMessageForHigherPriorityEcho,
				shouldDropDuplicateUserMessageEvent,
				threadDurableUserMessages,
				shouldDropInitialSubmissionEchoTurn,
				threadHasInitialSubmissionEcho,
				comparableVisibleTextItem,
				comparableVisibleText,
				visibleTextItemsLikelySame,
				visibleTextItemsHaveStableSharedPrefix,
				completedReceiptItemsLikelySame,
				visibleTextItemsCanShareRenderIdentity,
				findUnusedExistingItemIndexForIncoming,
				mergeIncomingOrderedItem,
				insertLocalOnlyItemByExistingOrder,
				mergeItemPreservingVisibleFields,
				mergeVisibleTextItemPreservingRenderIdentity,
				mergeItemsPreservingLocalVisible,
				mergeTurnPreservingVisibleItems,
				shouldPreserveLiveTurnLocalVisibleItems,
				mergeThreadPreservingVisibleItems,
				turnOrderMs,
				turnIsSupersededBy
			};
		}
		root.CodexThreadDetailRuntime = { createThreadDetailRuntime };
		if (typeof module !== "undefined" && module.exports) module.exports = { createThreadDetailRuntime };
	})(typeof globalThis !== "undefined" ? globalThis : exports);
}));
//#endregion
//#region public/task-card-runtime.js
var require_task_card_runtime = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	function taskCardActionThread(threadId) {
		const id = String(threadId || "").trim();
		if (id && state.currentThread && String(state.currentThread.id || "") === id) return state.currentThread;
		if (id && state.threadTileDetails.has(id)) return state.threadTileDetails.get(id);
		if (!id) return state.currentThread || null;
		return null;
	}
	function findThreadTaskCard(cardId, threadId = "") {
		const thread = taskCardActionThread(threadId);
		return threadTaskCardsForThread(thread || {}).find((card) => card.id === String(cardId || "")) || null;
	}
	function summarizeTaskCardText(value) {
		return truncateSingleLine(String(value || "").replace(/\s+/g, " ").trim(), 280);
	}
	function truncateThreadTaskCardBody(value, maxChars = THREAD_TASK_CARD_BODY_MAX_CHARS) {
		const text = String(value || "").trim();
		const limit = Math.max(0, Number(maxChars) || 0);
		if (!limit || text.length <= limit) return text;
		const marker = `\n\n[Task card body truncated: ${text.length} chars total]\n\n`;
		const available = Math.max(0, limit - marker.length);
		if (available <= 0) return text.slice(0, limit);
		const head = Math.ceil(available * .6);
		const tail = Math.max(0, available - head);
		return `${text.slice(0, head).trimEnd()}${marker}${text.slice(-tail).trimStart()}`.slice(0, limit);
	}
	function isThreadTaskCardCommandText(value) {
		const text = String(value || "").trim();
		return (text.startsWith(THREAD_TASK_CARD_COMMAND_PREFIX) || THREAD_TASK_CARD_MENTION_PATTERN.test(text) || THREAD_TASK_CARD_AUTONOMOUS_MENTION_PATTERN.test(text)) && threadTaskCardCommandText(text).length > 0;
	}
	function isThreadGoalCommandText(value) {
		const text = String(value || "").trim();
		return text.toLowerCase() === THREAD_GOAL_COMMAND_PREFIX || THREAD_GOAL_MENTION_PATTERN.test(text);
	}
	function isChatGptProCommandText(value) {
		return /(?:^|\s)@(?:ChatGPT\s+Pro|ChatGPTPro|GPT\s+Pro)\b/i.test(String(value || ""));
	}
	async function submitChatGptProRequest(text, options = {}) {
		if (!String(text || "").trim()) return false;
		if (state.pendingAttachments.length) {
			showError(/* @__PURE__ */ new Error("@ChatGPT Pro does not support attachments in this entry point"));
			return true;
		}
		const sourceThreadId = currentComposerThreadId() || state.currentThreadId || "";
		const sourceThread = composerTargetThread() || state.currentThread || null;
		const cwd = state.newThreadDraft ? state.selectedCwd || "" : sourceThread && sourceThread.cwd || "";
		state.composerBusy = true;
		state.sendButtonHint = "";
		$("connectionState").classList.remove("error");
		$("connectionState").textContent = "正在提交 ChatGPT Pro 分析";
		markActivity("Pro 分析");
		updateComposerControls();
		try {
			const result = await api("/api/chatgpt-pro/generate", {
				method: "POST",
				body: JSON.stringify({
					prompt: text,
					sourceThreadId,
					sourceThreadTitle: sourceThread ? threadDisplayName(sourceThread) : "",
					cwd,
					language: "zh-CN",
					outputFormat: "markdown",
					bridgeMode: isHermesEmbedMode() ? "embedded" : "standalone"
				}),
				timeoutMs: 18e4
			});
			setComposerText("");
			clearPendingAttachments();
			scheduleCurrentDraftSave();
			const proThreadId = String(result && result.proThreadId || "");
			$("connectionState").textContent = proThreadId ? `ChatGPT Pro 分析已提交：${proThreadId.slice(0, 8)}` : "ChatGPT Pro 分析已提交";
			markActivity("Pro 已提交");
			await loadThreads({ silent: true }).catch(showError);
			if (state.newThreadDraft && proThreadId) {
				state.newThreadDraft = false;
				await loadThread(proThreadId, { source: "chatgpt-pro" }).catch(showError);
			}
			return true;
		} catch (err) {
			$("connectionState").classList.add("error");
			$("connectionState").textContent = normalizeClientErrorMessage(err && err.message ? err.message : String(err), err) || "ChatGPT Pro 提交失败";
			showError(err);
			if (options.rethrow) throw err;
			return true;
		} finally {
			state.composerBusy = false;
			updateComposerControls();
		}
	}
	function threadTaskCardCommandText(value) {
		const text = String(value || "").trim();
		if (text.startsWith(THREAD_TASK_CARD_LEGACY_COMMAND_PREFIX)) return text.slice(THREAD_TASK_CARD_LEGACY_COMMAND_PREFIX.length).trim();
		if (THREAD_TASK_CARD_AUTONOMOUS_MENTION_PATTERN.test(text)) return text.replace(THREAD_TASK_CARD_AUTONOMOUS_MENTION_PATTERN, "").trim();
		if (THREAD_TASK_CARD_MENTION_PATTERN.test(text)) return text.replace(THREAD_TASK_CARD_MENTION_PATTERN, "").trim();
		return text.startsWith(THREAD_TASK_CARD_COMMAND_PREFIX) ? text.slice(THREAD_TASK_CARD_COMMAND_PREFIX.length).trim() : "";
	}
	function threadTaskCardVisibleTargets() {
		const sourceThreadId = currentComposerThreadId() || state.currentThreadId;
		return (state.threads || []).filter((thread) => thread && thread.id && thread.id !== sourceThreadId).slice(0, 40).map((thread) => ({
			threadId: String(thread.id || ""),
			title: threadTitleForDisplay(thread) || String(thread.id || ""),
			cwd: String(thread.cwd || "")
		}));
	}
	function buildThreadTaskCardDraftRequestText(commandText, sourceThread = composerTargetThread()) {
		const original = String(commandText || "").trim();
		if (!threadTaskCardCommandText(original)) throw new Error("Task-card command is empty");
		const legacyAutonomousCommand = original.startsWith(THREAD_TASK_CARD_LEGACY_COMMAND_PREFIX) || THREAD_TASK_CARD_AUTONOMOUS_MENTION_PATTERN.test(original);
		const source = sourceThread || {};
		const sourceThreadId = currentComposerThreadId() || state.currentThreadId || "";
		const envelope = {
			version: 1,
			sourceThreadId: String(sourceThreadId),
			sourceThreadTitle: threadTitleForDisplay(source) || String(sourceThreadId),
			availableTargets: threadTaskCardVisibleTargets()
		};
		return [
			original,
			"",
			`<${THREAD_TASK_CARD_REQUEST_TAG}>`,
			JSON.stringify(envelope, null, 2),
			`</${THREAD_TASK_CARD_REQUEST_TAG}>`,
			"",
			"Interpret the command above as a cross-thread pending task card request.",
			"Return only one XML block in exactly this format:",
			`<${THREAD_TASK_CARD_DRAFT_TAG}>`,
			"{\"targetThreadIds\":[\"one or more exact threadId values from availableTargets\"],\"workflowMode\":\"manual|autonomous\",\"workflowId\":\"optional existing workflow id\",\"title\":\"short title\",\"summary\":\"one-line summary\",\"body\":\"full markdown body\",\"error\":\"\"}",
			`</${THREAD_TASK_CARD_DRAFT_TAG}>`,
			"Rules:",
			"- Choose one or more targetThreadIds only from availableTargets.threadId.",
			"- Do not invent a thread id; when the request names multiple clear targets, include all of them.",
			"- Default workflowMode to manual for plain # or @任务卡片 single-card commands.",
			"- Use autonomous only when the command uses #自由协作, @自由协作, or explicitly asks for autonomous/free collaboration/auto-return workflow.",
			legacyAutonomousCommand ? "- This command used #自由协作 or @自由协作, so default workflowMode to autonomous unless it explicitly asks for manual." : "- This command used a manual task-card entry, so default workflowMode to manual unless it explicitly asks for autonomous/free collaboration.",
			"- Autonomous workflow means the target approves the first card once; after the target turn completes, Mobile Web sends the return card back automatically without another approval.",
			"- For a new autonomous workflow, leave workflowId empty. Reuse workflowId only when the command or visible context provides an existing id.",
			"- If the command is unclear or no target fits, set targetThreadIds to an empty array and explain the problem in error.",
			"- Keep title under 120 chars and summary under 280 chars.",
			"- Keep body under 7600 chars and put the actual requested work there.",
			"- Do not add any explanation outside the XML block."
		].join("\n");
	}
	function threadTaskCardRequestMarkerMatch(value) {
		const text = String(value || "");
		return new RegExp(`\\n\\s*<${THREAD_TASK_CARD_REQUEST_TAG}>[\\s\\S]*?<\\/${THREAD_TASK_CARD_REQUEST_TAG}>[\\s\\S]*$`, "i").exec(text);
	}
	function uniqueThreadTaskCardTargetIds(values, fallbackValue = "") {
		const raw = Array.isArray(values) && values.length ? values : [fallbackValue];
		const seen = /* @__PURE__ */ new Set();
		const ids = [];
		for (const value of raw) {
			const id = String(value || "").trim();
			if (!id || seen.has(id)) continue;
			seen.add(id);
			ids.push(id);
			if (ids.length >= 12) break;
		}
		return ids;
	}
	function normalizeThreadTaskCardWorkflowMode(value) {
		const mode = String(value || "manual").trim().toLowerCase();
		if (mode === "autonomous" || mode === "auto" || mode === "automatic") return "autonomous";
		return "manual";
	}
	function visibleThreadTaskCardCommandText(value) {
		const text = String(value || "");
		const match = threadTaskCardRequestMarkerMatch(text);
		return match ? text.slice(0, match.index).trimEnd() : text;
	}
	function parseThreadTaskCardDraftText(value) {
		const text = String(value || "");
		const match = new RegExp(`<${THREAD_TASK_CARD_DRAFT_TAG}>\\s*([\\s\\S]*?)\\s*<\\/${THREAD_TASK_CARD_DRAFT_TAG}>`, "i").exec(text);
		if (!match) return null;
		let parsed;
		try {
			parsed = JSON.parse(match[1]);
		} catch (_) {
			return null;
		}
		if (!parsed || typeof parsed !== "object") return null;
		const targetThreadIds = uniqueThreadTaskCardTargetIds(parsed.targetThreadIds, parsed.targetThreadId);
		return {
			rawText: text,
			targetThreadId: targetThreadIds[0] || "",
			targetThreadIds,
			workflowMode: normalizeThreadTaskCardWorkflowMode(parsed.workflowMode),
			workflowId: truncateSingleLine(String(parsed.workflowId || "").trim(), 220),
			title: truncateSingleLine(String(parsed.title || "").trim(), 120),
			summary: truncateSingleLine(String(parsed.summary || "").trim(), 280),
			body: String(parsed.body || "").trim(),
			error: truncateSingleLine(String(parsed.error || "").trim(), 280)
		};
	}
	function hasThreadTaskCardDraftTag(value) {
		return String(value || "").includes(`<${THREAD_TASK_CARD_DRAFT_TAG}>`);
	}
	function turnHasThreadTaskCardRequest(turn) {
		return (Array.isArray(turn && turn.items) ? turn.items : []).some((item) => {
			if (!item || item.type !== "userMessage") return false;
			return (Array.isArray(item.content) ? item.content : []).some((part) => isInputTextPart(part) && Boolean(threadTaskCardRequestMarkerMatch(inputTextValue(part))));
		});
	}
	function turnHasThreadTaskCardDraftResponse(turn) {
		return (Array.isArray(turn && turn.items) ? turn.items : []).some((item) => item && (item.type === "agentMessage" || item.type === "plan") && hasThreadTaskCardDraftTag(item.text || ""));
	}
	function renderTurnThreadTaskCardDraft(turn, previousKeys = /* @__PURE__ */ new Set(), thread = renderContextThread()) {
		const contextThread = renderContextThread(thread);
		const items = Array.isArray(turn && turn.items) ? turn.items : [];
		for (const item of items) {
			if (!item || item.type !== "agentMessage" && item.type !== "plan") continue;
			const text = String(item.text || "");
			const draft = parseThreadTaskCardDraftText(text);
			if (draft) {
				const draftKey = threadTaskCardDraftKeyForDraft(turn, draft, item);
				let draftState = threadTaskCardDraftState(draftKey);
				if (draftState.status === "pending") {
					const existing = matchingThreadTaskCardsForDraft(draft, turn, contextThread);
					if (existing.length) {
						setThreadTaskCardDraftState(draftKey, {
							status: "created",
							error: "",
							cardId: String(existing[0] && existing[0].id || ""),
							cardIds: existing.map((card) => String(card && card.id || "")).filter(Boolean)
						}, { render: false });
						draftState = threadTaskCardDraftState(draftKey);
					}
				}
				if (canRecoverFailedThreadTaskCardDraft(draft, draftState)) {
					setThreadTaskCardDraftState(draftKey, {
						status: "pending",
						error: ""
					}, { render: false });
					queueThreadTaskCardDraftCreation(draftKey, contextThread);
					draftState = Object.assign({}, draftState, { status: "creating" });
				}
				if (draftState.status === "created" || draftState.status === "dismissed") return "";
				if (draftState.status === "creating" && isThreadTaskCardDraftCreationStale(draftKey, draftState)) {
					const attempts = Math.max(1, Number(draftState.attempts || 1));
					if (attempts < THREAD_TASK_CARD_DRAFT_CREATE_MAX_ATTEMPTS) {
						setThreadTaskCardDraftState(draftKey, {
							status: "pending",
							error: "",
							attempts
						}, { render: false });
						queueThreadTaskCardDraftCreation(draftKey, contextThread);
						draftState = Object.assign({}, draftState, {
							status: "creating",
							attempts: attempts + 1
						});
					} else {
						setThreadTaskCardDraftState(draftKey, {
							status: "failed",
							error: "Task card creation timed out before the server stored a card"
						}, { render: false });
						draftState = threadTaskCardDraftState(draftKey);
					}
				}
				if (draftState.status === "pending") {
					queueThreadTaskCardDraftCreation(draftKey, contextThread);
					draftState = Object.assign({}, draftState, { status: "creating" });
				}
				if (draftState.status === "creating") return "";
				return renderThreadTaskCardDraft(draft, item, turn, previousKeys, draftKey, draftState, contextThread);
			}
			if (hasThreadTaskCardDraftTag(text)) return renderPendingThreadTaskCardDraft("Generating cross-thread task card draft...", "Generating");
		}
		return "";
	}
	function renderPendingThreadTaskCardDraft(message, status = "Generating") {
		const detail = escapeHtml(String(message || "Generating cross-thread task card draft..."));
		return `<section class="approval-card thread-task-card-draft pending synthetic">
    <div class="approval-head">
      <div>
        <div class="approval-title">Cross-thread task card draft</div>
        <div class="approval-method">Pending</div>
      </div>
      <span class="approval-status">${escapeHtml(String(status || "Generating"))}</span>
    </div>
    <div class="approval-summary-line">${detail}</div>
  </section>`;
	}
	function threadTaskCardDraftKey(turnId, itemId) {
		return `task-card-draft|${String(turnId || "")}|${String(itemId || "")}`;
	}
	function isThreadTaskCardDraftCreationStale(draftKey, draftState) {
		if (!draftKey || !draftState || draftState.status !== "creating") return false;
		const updatedAtMs = Number(draftState.updatedAtMs || 0);
		if (!updatedAtMs) return false;
		if (Date.now() - updatedAtMs < THREAD_TASK_CARD_DRAFT_CREATE_STALE_MS) return false;
		state.scheduledThreadTaskCardDraftCreations.delete(String(draftKey));
		state.activeThreadTaskCardDraftCreations.delete(String(draftKey));
		return true;
	}
	function threadTaskCardDraftPayloadKey(draft) {
		const targetThreadIds = threadTaskCardDraftTargetIds(draft).sort();
		return stableTextHash(JSON.stringify({
			targetThreadIds,
			workflowMode: normalizeThreadTaskCardWorkflowMode(draft && draft.workflowMode),
			workflowId: String(draft && draft.workflowId || "").trim(),
			title: String(draft && draft.title || "").trim(),
			summary: String(draft && draft.summary || "").trim(),
			body: String(draft && draft.body || "").trim()
		}));
	}
	function threadTaskCardDraftKeyForDraft(turn, draft, item = null) {
		const turnId = String(turn && turn.id || "");
		const payloadKey = threadTaskCardDraftPayloadKey(draft);
		if (turnId && payloadKey) return threadTaskCardDraftKey(turnId, `draft-${payloadKey}`);
		return threadTaskCardDraftKey(turnId, item && item.id || "");
	}
	function findThreadById(threadId) {
		const id = String(threadId || "").trim();
		return (state.threads || []).find((thread) => String(thread && thread.id || "") === id) || null;
	}
	function threadTaskCardDraftTargetIds(draft) {
		return uniqueThreadTaskCardTargetIds(draft && draft.targetThreadIds, draft && draft.targetThreadId);
	}
	function commonPrefixLength(a, b) {
		const left = String(a || "");
		const right = String(b || "");
		const max = Math.min(left.length, right.length);
		let index = 0;
		while (index < max && left[index] === right[index]) index += 1;
		return index;
	}
	function recoverVisibleThreadForDraftTargetId(threadId) {
		const id = String(threadId || "").trim();
		if (!id || id.length < 12) return null;
		if (findThreadById(id)) return null;
		const candidates = (state.threads || []).filter((thread) => thread && thread.id && thread.id !== state.currentThreadId).map((thread) => ({
			thread,
			prefix: commonPrefixLength(id, thread.id)
		})).filter((entry) => entry.prefix >= 14).sort((a, b) => b.prefix - a.prefix);
		if (!candidates.length) return null;
		const bestPrefix = candidates[0].prefix;
		const best = candidates.filter((entry) => entry.prefix === bestPrefix);
		return best.length === 1 ? best[0].thread : null;
	}
	function threadTaskCardDraftTargetThreads(draft) {
		return threadTaskCardDraftTargetIds(draft).map((threadId) => ({
			threadId,
			thread: findThreadById(threadId) || recoverVisibleThreadForDraftTargetId(threadId)
		}));
	}
	function canRecoverFailedThreadTaskCardDraft(draft, draftState) {
		if (!draft || !draftState || draftState.status !== "failed") return false;
		const error = String(draftState.error || "");
		if (!/Target thread is missing from the visible thread list/i.test(error)) return false;
		return threadTaskCardDraftTargetIds(draft).length > 0;
	}
	function matchingThreadTaskCardsForDraft(draft, turn, thread = renderContextThread()) {
		const contextThread = renderContextThread(thread);
		const sourceThread = contextThread || state.currentThread;
		const cards = Array.isArray(sourceThread && sourceThread.threadTaskCards) ? sourceThread.threadTaskCards : [];
		const targetIds = new Set(threadTaskCardDraftTargetIds(draft));
		const sourceThreadId = String(sourceThread && sourceThread.id || renderContextThreadId(contextThread) || "");
		const sourceTurnId = String(turn && turn.id || "");
		const title = String(draft && draft.title || "").trim();
		const body = String(draft && draft.body || "").trim();
		return cards.filter((card) => {
			if (!card) return false;
			if (sourceThreadId && String(card.source && card.source.threadId || "") !== sourceThreadId) return false;
			if (sourceTurnId && String(card.source && card.source.turnId || "") !== sourceTurnId) return false;
			if (targetIds.size && !targetIds.has(String(card.target && card.target.threadId || ""))) return false;
			if (title && String(card.message && card.message.title || "").trim() !== title) return false;
			if (body && String(card.message && card.message.body || "").trim() !== body) return false;
			return true;
		});
	}
	function upsertThreadTaskCardOnThread(thread, card) {
		if (!thread || !card) return;
		thread.threadTaskCards = [card, ...(Array.isArray(thread.threadTaskCards) ? thread.threadTaskCards : []).filter((entry) => String(entry && entry.id || "") !== String(card.id || ""))];
	}
	function replaceTaskCardBodyPlaceholder(details, card) {
		if (!details || !card || !card.message || typeof card.message.body !== "string") return false;
		const placeholder = details.querySelector("[data-task-card-body-placeholder]");
		if (!placeholder) return false;
		const pre = document.createElement("pre");
		pre.className = "approval-detail";
		pre.textContent = card.message.body;
		placeholder.replaceWith(pre);
		return true;
	}
	async function loadThreadTaskCardBody(cardId, threadId = "", details = null) {
		const id = String(cardId || "").trim();
		const ownerThreadId = String(threadId || state.currentThreadId || "").trim();
		if (!id || !ownerThreadId) return null;
		const loadKey = `${ownerThreadId}:${id}`;
		if (state.threadTaskCardBodyLoads.has(loadKey)) return null;
		const currentCard = findThreadTaskCard(id, ownerThreadId);
		if (currentCard && currentCard.message && typeof currentCard.message.body === "string") {
			replaceTaskCardBodyPlaceholder(details, currentCard);
			return currentCard;
		}
		state.threadTaskCardBodyLoads.add(loadKey);
		const placeholder = details && details.querySelector("[data-task-card-body-placeholder]");
		if (placeholder) placeholder.textContent = "Loading task card body...";
		try {
			const result = await api(`/api/thread-task-cards/${encodeURIComponent(id)}?threadId=${encodeURIComponent(ownerThreadId)}`, { timeoutMs: 15e3 });
			const card = result && result.card;
			if (!card) throw new Error("task_card_body_missing");
			const thread = taskCardActionThread(ownerThreadId);
			if (thread) upsertThreadTaskCardOnThread(thread, card);
			if (!replaceTaskCardBodyPlaceholder(details, card) && thread) {
				if (ownerThreadId === String(state.currentThreadId || "")) renderCurrentThread();
				else if (!scheduleRenderThreadTilePane(ownerThreadId, { preserveScroll: true })) renderCurrentThread();
			}
			return card;
		} catch (err) {
			if (placeholder) placeholder.textContent = "Failed to load task card body.";
			throw err;
		} finally {
			state.threadTaskCardBodyLoads.delete(loadKey);
		}
	}
	function handleThreadTaskCardDetailsToggle(event) {
		const details = event && event.target && event.target.closest ? event.target.closest("[data-task-card-details]") : null;
		if (!details || !details.open) return;
		const cardId = details.dataset.taskCardId || "";
		const threadId = details.dataset.taskCardThreadId || "";
		if (!details.querySelector("[data-task-card-body-placeholder]")) return;
		loadThreadTaskCardBody(cardId, threadId, details).catch(showError);
	}
	function taskCardCountThreadsForId(threadId) {
		const id = String(threadId || "").trim();
		if (!id) return [];
		const threads = [];
		const add = (thread) => {
			if (!thread || String(thread.id || "") !== id || threads.includes(thread)) return;
			threads.push(thread);
		};
		add(state.currentThread);
		add(state.threadTileDetails && state.threadTileDetails.get(id));
		add(findThreadById(id));
		return threads;
	}
	function incrementPendingIncomingTaskCardCount(threadId, delta = 1) {
		const threads = taskCardCountThreadsForId(threadId);
		const base = threads[0] || null;
		if (!base) return;
		const current = Math.max(0, Number(base.pendingIncomingTaskCardCount) || 0);
		const next = Math.max(0, current + Number(delta || 0));
		const outgoing = Math.max(0, Number(base.pendingOutgoingTaskCardCount) || 0);
		for (const thread of threads) {
			thread.pendingIncomingTaskCardCount = next;
			thread.pendingOutgoingTaskCardCount = outgoing;
			thread.pendingTaskCardCount = next + outgoing;
		}
	}
	function incrementPendingOutgoingTaskCardCount(threadId, delta = 1) {
		const threads = taskCardCountThreadsForId(threadId);
		const base = threads[0] || null;
		if (!base) return;
		const current = Math.max(0, Number(base.pendingOutgoingTaskCardCount) || 0);
		const next = Math.max(0, current + Number(delta || 0));
		const incoming = Math.max(0, Number(base.pendingIncomingTaskCardCount) || 0);
		for (const thread of threads) {
			thread.pendingIncomingTaskCardCount = incoming;
			thread.pendingOutgoingTaskCardCount = next;
			thread.pendingTaskCardCount = incoming + next;
		}
	}
	function settleThreadTaskCardForThread(threadId, cardId, nextStatus, nextCard = null) {
		const thread = taskCardActionThread(String(threadId || "").trim() || String(state.currentThreadId || "").trim());
		if (!thread || !Array.isArray(thread.threadTaskCards)) return;
		const id = String(cardId || "").trim();
		if (!id) return;
		let settledCard = null;
		thread.threadTaskCards = thread.threadTaskCards.map((entry) => {
			if (String(entry && entry.id || "") !== id) return entry;
			settledCard = Object.assign({}, entry || {}, nextCard || {}, { status: nextStatus || nextCard && nextCard.status || entry.status });
			return settledCard;
		});
		if (!settledCard) return;
		if (settledCard.threadRole === "target") incrementPendingIncomingTaskCardCount(thread.id, -1);
		if (settledCard.threadRole === "source") incrementPendingOutgoingTaskCardCount(thread.id, -1);
		if (state.threadTileDetails.has(String(thread.id || ""))) state.threadTileDetails.set(String(thread.id || ""), thread);
		renderThreads();
		if (String(thread.id || "") === String(state.currentThreadId || "")) renderCurrentThread();
		else if (state.threadTileMode && threadTilePaneIsVisible(thread.id) && !scheduleRenderThreadTilePane(thread.id, { preserveScroll: true })) scheduleRenderCurrentThread();
	}
	function settleCurrentThreadTaskCard(cardId, nextStatus, nextCard = null) {
		settleThreadTaskCardForThread(state.currentThreadId, cardId, nextStatus, nextCard);
	}
	function resolveTargetThreadReference(input) {
		const raw = String(input || "").trim();
		if (!raw) return null;
		const lowered = raw.toLowerCase();
		return state.threads.find((thread) => thread && thread.id !== state.currentThreadId && (String(thread.id || "").toLowerCase() === lowered || String(threadTitleForDisplay(thread) || "").trim().toLowerCase() === lowered)) || null;
	}
	function resolveTargetThreadReferences(input) {
		const parts = String(input || "").split(/[\n,;，；]+/u).map((part) => part.trim()).filter(Boolean);
		const seen = /* @__PURE__ */ new Set();
		const targets = [];
		for (const part of parts) {
			const thread = resolveTargetThreadReference(part);
			const id = String(thread && thread.id || part || "").trim();
			if (!id || id === state.currentThreadId || seen.has(id)) continue;
			seen.add(id);
			targets.push({
				threadId: id,
				thread
			});
			if (targets.length >= 12) break;
		}
		return targets;
	}
	async function refreshThreadAfterTaskCard(threadId = "") {
		const id = String(threadId || state.currentThreadId || "").trim();
		if (!id) return;
		if (id === String(state.currentThreadId || "")) await refreshCurrentThread({ source: "task-card" });
		else if (state.threadTileMode && threadTilePaneIsVisible(id)) await loadThreadTileDetail(id, {
			force: true,
			background: true,
			source: "task-card"
		});
		loadThreads({ silent: true }).catch(showError);
	}
	async function refreshCurrentThreadAfterTaskCard() {
		await refreshThreadAfterTaskCard(state.currentThreadId);
	}
	function currentThreadHasTurn(turnId) {
		const targetTurnId = String(turnId || "").trim();
		if (!targetTurnId || !state.currentThread) return false;
		return (Array.isArray(state.currentThread.turns) ? state.currentThread.turns : []).some((turn) => String(turn && turn.id || "") === targetTurnId);
	}
	async function waitForCurrentThreadTurn(turnId, options = {}) {
		const targetTurnId = String(turnId || "").trim();
		if (!targetTurnId || !state.currentThreadId) return false;
		const timeoutMs = Math.max(500, Number(options.timeoutMs) || 1e4);
		const intervalMs = Math.max(150, Number(options.intervalMs) || 500);
		const deadline = Date.now() + timeoutMs;
		while (state.currentThreadId && Date.now() <= deadline) {
			await refreshCurrentThread({ source: "wait-turn" });
			if (!state.currentThreadId) return false;
			if (currentThreadHasTurn(targetTurnId)) {
				state.pendingPluginRouteHint = normalizePluginRouteHint({
					pluginId: "codex-mobile",
					route: "thread-turn",
					threadId: state.currentThreadId,
					itemId: targetTurnId
				});
				renderCurrentThread();
				return true;
			}
			await sleep(intervalMs);
		}
		return currentThreadHasTurn(targetTurnId);
	}
	async function createThreadTaskCardFromThread(sourceThread, event) {
		if (event) {
			event.preventDefault();
			event.stopPropagation();
		}
		const thread = sourceThread || state.currentThread;
		if (!thread || !thread.id) return;
		const targetInput = await requestAppTextInput("输入目标 thread id 或精确标题；多个目标用英文逗号分隔。", "", {
			title: "任务卡片目标",
			confirmLabel: "下一步",
			placeholder: "thread id 或标题",
			rows: 3
		});
		if (targetInput == null) return;
		const targets = resolveTargetThreadReferences(targetInput);
		if (!targets.length) {
			showError(/* @__PURE__ */ new Error("At least one different target thread is required"));
			return;
		}
		const title = await requestAppTextInput("输入任务卡片标题。", `Need response from ${threadTitleForDisplay(thread) || thread.id}`, {
			title: "任务卡片标题",
			confirmLabel: "下一步",
			rows: 2
		}) || "";
		if (!String(title).trim()) return;
		const body = await requestAppTextInput("输入任务卡片正文。", "", {
			title: "任务卡片正文",
			confirmLabel: "创建",
			rows: 7
		}) || "";
		if (!String(body).trim()) return;
		$("connectionState").classList.remove("error");
		$("connectionState").textContent = "Creating task card";
		try {
			const targetWorkspaceIds = {};
			for (const target of targets) if (target.thread) targetWorkspaceIds[target.threadId] = String(target.thread.cwd || "");
			await api("/api/thread-task-cards", {
				method: "POST",
				body: JSON.stringify({
					sourceWorkspaceId: thread.cwd || state.selectedCwd || "",
					sourceThreadId: thread.id,
					sourceTurnId: activeTurnIdForThread(thread),
					sourceThreadTitle: threadTitleForDisplay(thread) || thread.id,
					targetThreadIds: targets.map((target) => target.threadId),
					targetWorkspaceIds,
					idempotencyKey: `task-card:${thread.id}:${Date.now()}:${Math.random().toString(16).slice(2, 8)}`,
					format: "markdown",
					title: String(title).trim(),
					summary: summarizeTaskCardText(body),
					body: String(body).trim()
				}),
				timeoutMs: 3e4
			});
			$("connectionState").textContent = "Task card created";
			recordHomeAiDiagnosticSuccess({
				category: "task_card_workflow_failed",
				diagnostic_type: "task_card_creation_failed",
				error_code: "task_card_create_failed",
				context: {
					surface: "task-card",
					action: "manual-create",
					thread_hash: diagnosticThreadHash(thread.id)
				}
			});
			await refreshThreadAfterTaskCard(thread.id);
		} catch (err) {
			recordHomeAiDiagnosticFailure({
				category: "task_card_workflow_failed",
				diagnostic_type: "task_card_creation_failed",
				severity_hint: "H2",
				evidence_confidence: .78,
				error_code: diagnosticErrorCode(err, "task_card_create_failed"),
				context: {
					surface: "task-card",
					action: "manual-create",
					thread_hash: diagnosticThreadHash(thread.id)
				},
				counts: {
					target_count: targets.length,
					status_code: diagnosticErrorStatus(err)
				},
				breadcrumbs: [{
					kind: "task-card",
					code: "manual-create",
					status: "failed",
					fields: {
						status_code: diagnosticErrorStatus(err),
						thread_hash: diagnosticThreadHash(thread.id)
					}
				}]
			});
			showError(err);
		}
	}
	async function createThreadTaskCardFromCurrent(event) {
		await createThreadTaskCardFromThread(state.currentThread, event);
	}
	function startThreadRequestBody(sourceThread = null, options = {}) {
		const thread = sourceThread || state.currentThread || {};
		const pluginMode = isHermesEmbedMode() ? "hermes" : "";
		return {
			cwd: thread.cwd || state.selectedCwd || "",
			sourceThreadId: thread.id || "",
			sourceThreadTitle: threadTitleForDisplay(thread) || thread.id || "",
			archiveSourceThread: Boolean(options.archiveSourceThread && thread.id),
			pluginMode,
			hermesPluginMode: Boolean(pluginMode),
			pluginId: pluginMode ? "codex-mobile" : ""
		};
	}
	function threadActionTargetRow(target) {
		if (!target || !target.closest) return null;
		return target.closest("[data-thread-row]");
	}
	function primaryTouch(event) {
		return event.touches && event.touches[0] || event.changedTouches && event.changedTouches[0] || null;
	}
	function startedThreadId(result) {
		return String(result && result.threadId || result && result.thread && result.thread.id || result && result.result && result.result.thread && result.result.thread.id || result && result.result && result.result.threadId || "");
	}
	function startedTurnId(result) {
		return String(result && result.turnId || result && result.turn && result.turn.id || result && result.result && result.result.turnId || result && result.result && result.result.turn && result.result.turn.id || "");
	}
	function continuationJobStatusText(job) {
		const status = String(job && job.status || "");
		const message = String(job && job.message || "").trim();
		if (message) return message;
		return {
			queued: "续接任务已排队",
			running: "正在生成交接并续接",
			done: "续接线程已就绪",
			failed: "续接任务失败"
		}[status] || "正在生成交接并续接";
	}
	function rememberContinuationJob(jobId) {
		const id = String(jobId || "").trim();
		if (!id) return;
		state.continuationJobId = id;
		localStorage.setItem(STORAGE_CONTINUATION_JOB, id);
	}
	function clearRememberedContinuationJob(jobId = "") {
		const id = String(jobId || "").trim();
		if (!id || localStorage.getItem(STORAGE_CONTINUATION_JOB) === id) localStorage.removeItem(STORAGE_CONTINUATION_JOB);
		if (!id || state.continuationJobId === id) state.continuationJobId = "";
	}
	async function openContinuationResult(result) {
		const threadId = startedThreadId(result);
		if (!threadId) throw new Error("Continuation thread was created without a thread id");
		state.continuationNewThreadId = threadId;
		const archivedSourceThreadId = result.sourceArchive && result.sourceArchive.archived ? result.sourceArchive.threadId : "";
		if (archivedSourceThreadId) state.threads = state.threads.filter((entry) => entry.id !== archivedSourceThreadId);
		if (result.thread) {
			state.threads = [result.thread, ...state.threads.filter((thread) => thread.id !== result.thread.id)];
			renderThreads();
		}
		$("connectionState").classList.remove("error");
		if (result.sourceArchive && result.sourceArchive.error && !result.sourceArchive.archived) {
			$("connectionState").classList.add("error");
			$("connectionState").textContent = `续接线程已就绪；归档失败：${result.sourceArchive.error}`;
		} else if (result.sourceArchive && result.sourceArchive.error) $("connectionState").textContent = "交接已生成；旧线程已在 Mobile 隐藏";
		else $("connectionState").textContent = "交接已生成；正在打开续接线程";
		await loadThread(threadId, { source: "continuation" });
		loadThreads().catch(showError);
	}
	async function waitForContinuationJob(jobId) {
		const id = String(jobId || "").trim();
		if (!id) throw new Error("Continuation job was created without a job id");
		rememberContinuationJob(id);
		let delayMs = 800;
		while (state.continuationJobId === id) {
			const job = await api(`/api/thread-continuations/${encodeURIComponent(id)}`, { timeoutMs: 3e4 });
			$("connectionState").classList.toggle("error", job.status === "failed");
			$("connectionState").textContent = continuationJobStatusText(job);
			setContinuationDialogStatus(continuationJobStatusText(job), { error: job.status === "failed" });
			postClientEvent("continuation_job_poll", {
				jobId: id,
				status: String(job.status || ""),
				step: String(job.step || "")
			});
			markActivity(job.step || "续接任务");
			if (job.status === "done") {
				clearRememberedContinuationJob(id);
				postClientEvent("continuation_job_done", { jobId: id });
				return job.result || job;
			}
			if (job.status === "failed") {
				clearRememberedContinuationJob(id);
				postClientEvent("continuation_job_failed", {
					jobId: id,
					message: String(job.error || job.message || "Continuation job failed")
				});
				throw new Error(job.error || job.message || "Continuation job failed");
			}
			await sleep(delayMs);
			delayMs = Math.min(1800, Math.round(delayMs * 1.25));
		}
		throw new Error("Continuation job was cancelled");
	}
	async function resumeRememberedContinuationJob() {
		const jobId = String(localStorage.getItem(STORAGE_CONTINUATION_JOB) || "").trim();
		if (!jobId || state.continuationBusy) return;
		state.continuationBusy = true;
		state.continuationJobId = jobId;
		$("connectionState").classList.remove("error");
		$("connectionState").textContent = "正在恢复续接任务";
		try {
			await openContinuationResult(await waitForContinuationJob(jobId));
		} catch (err) {
			clearRememberedContinuationJob(jobId);
			if (!/Continuation job not found/i.test(err.message || "")) showError(err);
		} finally {
			state.continuationBusy = false;
		}
	}
	async function startNewThreadFromThread(sourceThread, event) {
		if (event) event.preventDefault();
		if (event) event.stopPropagation();
		if (state.continuationBusy) {
			setContinuationDialogStatus("续接任务已经在运行，请稍等。");
			$("connectionState").textContent = "续接任务已经在运行";
			postClientEvent("continuation_start_ignored_busy", {
				jobId: state.continuationJobId || "",
				sourceThreadId: state.continuationSourceThreadId || ""
			});
			return;
		}
		const thread = sourceThread || state.currentThread || {};
		if (!continuationDialogOpen()) {
			openContinuationDialog(thread);
			return;
		}
		const button = event && event.currentTarget;
		const cwd = thread.cwd ? String(thread.cwd).trim() : String(state.selectedCwd || "").trim();
		const sourceThreadId = thread.id || state.currentThreadId || "";
		const body = {
			cwd,
			sourceThreadId: thread.id || "",
			sourceThreadTitle: threadTitleForDisplay(thread) || thread.id || "",
			archiveSourceThread: Boolean(thread.id),
			pluginMode: isHermesEmbedMode() ? "hermes" : "",
			hermesPluginMode: isHermesEmbedMode(),
			pluginId: isHermesEmbedMode() ? "codex-mobile" : ""
		};
		if (!body.cwd) {
			showError(/* @__PURE__ */ new Error("Thread has no workspace path"));
			return;
		}
		if (sourceThreadId) {
			state.continuationSourceThreadId = sourceThreadId;
			state.continuationNewThreadId = "";
			clearRememberedContinuationJob();
		}
		state.continuationBusy = true;
		if (button) button.disabled = true;
		setContinuationDialogBusy(true, "正在创建续接任务。");
		$("connectionState").classList.remove("error");
		$("connectionState").textContent = "正在创建续接任务";
		markActivity("创建续接任务");
		let completed = false;
		let failed = false;
		postClientEvent("continuation_start_requested", {
			sourceThreadId,
			hasWorkspace: Boolean(body.cwd),
			hermesPluginMode: Boolean(body.hermesPluginMode)
		});
		try {
			const job = await api("/api/thread-continuations", {
				method: "POST",
				body: JSON.stringify(body),
				timeoutMs: 3e4
			});
			$("connectionState").textContent = continuationJobStatusText(job);
			setContinuationDialogStatus(continuationJobStatusText(job));
			postClientEvent("continuation_job_created", {
				jobId: String(job.jobId || ""),
				status: String(job.status || ""),
				pluginMode: String(job.pluginMode || "")
			});
			const result = await waitForContinuationJob(job.jobId);
			closeContinuationDialog({ force: true });
			completed = true;
			await openContinuationResult(result);
		} catch (err) {
			failed = true;
			setContinuationDialogBusy(false, err && err.message ? err.message : String(err), { error: true });
			postClientEvent("continuation_start_failed", {
				sourceThreadId,
				message: err && err.message ? err.message : String(err)
			});
			showError(err);
		} finally {
			clearRememberedContinuationJob();
			state.continuationBusy = false;
			if (!failed) setContinuationDialogBusy(false, completed || !continuationDialogOpen() ? "" : "续接任务未完成，可以重试。");
			if (button) button.disabled = false;
		}
	}
	async function startNewThreadFromCurrent(event) {
		await startNewThreadFromThread(state.currentThread, event);
	}
	function renderThreadArchiveDialog() {
		const dialog = $("threadArchiveConfirmDialog");
		const subtitle = $("threadArchiveConfirmSubtitle");
		if (!dialog || !subtitle) return;
		dialog.classList.toggle("hidden", !state.threadArchiveConfirmOpen);
		subtitle.textContent = state.threadArchiveConfirmOpen ? `目标会话：${state.threadArchiveConfirmTitle || state.threadArchiveConfirmTargetId || "--"}` : "";
	}
	function closeThreadArchiveDialog(confirmed = false) {
		const resolve = state.threadArchiveConfirmResolve;
		state.threadArchiveConfirmOpen = false;
		state.threadArchiveConfirmTargetId = "";
		state.threadArchiveConfirmTitle = "";
		state.threadArchiveConfirmResolve = null;
		renderThreadArchiveDialog();
		if (resolve) resolve(Boolean(confirmed));
	}
	function requestThreadArchiveConfirmation(threadId, title) {
		const label = String(title || "会话");
		if (state.threadArchiveConfirmResolve) closeThreadArchiveDialog(false);
		state.threadArchiveConfirmOpen = true;
		state.threadArchiveConfirmTargetId = String(threadId || "");
		state.threadArchiveConfirmTitle = label;
		renderThreadArchiveDialog();
		return new Promise((resolve) => {
			state.threadArchiveConfirmResolve = resolve;
		});
	}
	async function archiveThread(threadId, button = null) {
		const id = String(threadId || "");
		const thread = state.threads.find((entry) => entry.id === id);
		if (!thread) {
			showError(/* @__PURE__ */ new Error("Thread is no longer in the current list"));
			return;
		}
		const title = threadTitleForDisplay(thread) || "会话";
		if (!await requestThreadArchiveConfirmation(thread.id, title)) return;
		if (button) button.disabled = true;
		$("connectionState").classList.remove("error");
		$("connectionState").textContent = "正在归档会话";
		markActivity("归档会话");
		try {
			await api(`/api/threads/${encodeURIComponent(thread.id)}/archive`, {
				method: "POST",
				timeoutMs: 3e4
			});
			state.threads = state.threads.filter((entry) => entry.id !== thread.id);
			if (state.currentThreadId === thread.id) {
				clearCurrentThreadSelection();
				renderCurrentThread();
			}
			renderThreads();
			loadThreads().catch(showError);
		} catch (err) {
			showError(err);
		} finally {
			if (button) button.disabled = false;
		}
	}
	function taskCardStatusLabel(status) {
		const text = String(status || "pending");
		return {
			pending: "Pending",
			approving: "Approving",
			approved: "Approved",
			deleted: "Deleted",
			revoked: "Revoked",
			replied: "Replied"
		}[text] || text;
	}
	function taskCardDirectionLabel(card) {
		if (!card) return "Task card";
		if (card.threadRole === "target") return `Task card from ${card.source && (card.source.title || card.source.threadId || card.source.workspaceId || "source thread")}`;
		if (card.threadRole === "source") return `Task card to ${card.target && (card.target.threadId || card.target.workspaceId || "target thread")}`;
		return "Task card";
	}
	function taskCardDetailLines(card) {
		if (!card) return [];
		const workflow = card.workflow && card.workflow.mode === "autonomous" ? card.workflow : null;
		return [
			card.target && card.threadRole === "source" ? `Target thread: ${card.target.threadId}` : "",
			card.source && card.threadRole === "target" ? `Source workspace: ${card.source.workspaceId}` : "",
			workflow ? `Workflow: autonomous${workflow.authorized ? " (authorized)" : " (first approval required)"}` : "",
			workflow && workflow.id ? `Workflow id: ${workflow.id}` : "",
			card.injectedTurnId ? `Injected turn: ${card.injectedTurnId}` : ""
		].filter(Boolean);
	}
	function threadTaskCardSummaryLine(text) {
		return truncateSingleLine(String(text || "").trim(), 220);
	}
	function renderThreadTaskCardExpandable(preview, sections, attributes = "") {
		const blocks = (Array.isArray(sections) ? sections : []).filter(Boolean);
		if (!blocks.length) return "";
		const attr = String(attributes || "").trim();
		return `<details class="approval-details"${attr ? ` ${attr}` : ""}>
    <summary><span>${escapeHtml(threadTaskCardSummaryLine(preview) || "Show details")}</span></summary>
    ${blocks.join("")}
  </details>`;
	}
	function renderThreadTaskCardActions(card, threadId = "") {
		if (!card) return "";
		const ownerThreadId = String(threadId || "").trim();
		const ownerAttribute = ownerThreadId ? ` data-task-card-thread-id="${escapeHtml(ownerThreadId)}"` : "";
		if (card.canApprove || card.canDelete || card.canReply || card.canRevoke) {
			const buttons = [];
			const approveLabel = card.workflow && card.workflow.mode === "autonomous" ? "Approve workflow" : "Approve";
			if (card.canApprove) buttons.push(`<button class="approval-button allow" type="button" data-task-card-action="approve" data-task-card-id="${escapeHtml(card.id)}"${ownerAttribute}>${escapeHtml(approveLabel)}</button>`);
			if (card.canReply) buttons.push(`<button class="approval-button allow" type="button" data-task-card-action="reply" data-task-card-id="${escapeHtml(card.id)}"${ownerAttribute}>Reply</button>`);
			if (card.canDelete) buttons.push(`<button class="approval-button deny" type="button" data-task-card-action="delete" data-task-card-id="${escapeHtml(card.id)}"${ownerAttribute}>Delete</button>`);
			if (card.canRevoke) buttons.push(`<button class="approval-button deny" type="button" data-task-card-action="revoke" data-task-card-id="${escapeHtml(card.id)}"${ownerAttribute}>Revoke</button>`);
			return `<div class="approval-actions">${buttons.join("")}</div>`;
		}
		return "";
	}
	function renderThreadTaskCard(card, previousKeys = /* @__PURE__ */ new Set(), threadId = "") {
		const key = `task-card|${card.id}`;
		const status = String(card.status || "pending");
		const detail = taskCardDetailLines(card).join("\n");
		const summary = threadTaskCardSummaryLine(card.message && card.message.summary ? card.message.summary : "");
		const body = card.message && card.message.body ? `<pre class="approval-detail">${escapeHtml(card.message.body)}</pre>` : card.message && card.message.bodyOmitted ? `<div class="approval-detail" data-task-card-body-placeholder data-task-card-id="${escapeHtml(card.id)}" data-task-card-thread-id="${escapeHtml(threadId)}">Task card body loads when opened.</div>` : "";
		const compact = status !== "pending" ? " compact" : "";
		const detailBlocks = [detail ? `<pre class="approval-detail">${escapeHtml(detail)}</pre>` : "", body];
		return `<section class="approval-card thread-task-card${compact}${entryAnimationClass(key, previousKeys)} ${escapeHtml(status)}" data-render-key="${escapeHtml(key)}" data-task-card="${escapeHtml(card.id)}">
    <div class="approval-head">
      <div>
        <div class="approval-title">${escapeHtml(taskCardDirectionLabel(card))}</div>
        <div class="approval-method">${escapeHtml(card.message && card.message.title || "Task card")}</div>
      </div>
      <span class="approval-status">${escapeHtml(taskCardStatusLabel(status))}</span>
    </div>
    ${summary ? `<div class="approval-summary-line">${escapeHtml(summary)}</div>` : ""}
    ${renderThreadTaskCardExpandable(summary || detail || card.message && card.message.title || "Task card details", detailBlocks, `data-task-card-details data-task-card-id="${escapeHtml(card.id)}" data-task-card-thread-id="${escapeHtml(threadId)}"`)}
    ${renderThreadTaskCardActions(card, threadId)}
  </section>`;
	}
	function renderThreadTaskCards(thread, previousKeys = /* @__PURE__ */ new Set()) {
		const cards = threadTaskCardsForThread(thread);
		if (!cards.length) return "";
		const threadId = String(thread && thread.id || "").trim();
		return `<div class="approval-stack thread-task-card-stack">
    ${cards.map((card) => renderThreadTaskCard(card, previousKeys, threadId)).join("")}
  </div>`;
	}
	function threadTaskCardDraftState(key) {
		return state.threadTaskCardDraftStates.get(String(key || "")) || {
			status: "pending",
			error: "",
			cardId: ""
		};
	}
	function threadTaskCardDraftStatusLabel(status) {
		return {
			pending: "Draft",
			creating: "Creating",
			created: "Created",
			dismissed: "Dismissed",
			failed: "Failed"
		}[status] || "Draft";
	}
	function threadTaskCardDraftDetailLines(draft, targetRefs, draftState) {
		const refs = Array.isArray(targetRefs) ? targetRefs : [];
		const targetLine = refs.length ? `Target threads: ${refs.map((entry) => {
			const thread = entry && entry.thread;
			return thread ? thread.title || thread.id || entry.threadId : entry && entry.threadId || "";
		}).filter(Boolean).join(", ")}` : "";
		const missing = refs.filter((entry) => entry && !entry.thread).map((entry) => entry.threadId).filter(Boolean);
		return [
			targetLine,
			draft && draft.workflowMode === "autonomous" ? `Workflow: autonomous${draft.workflowId ? ` (${draft.workflowId})` : " (new)"}` : "",
			missing.length ? `Missing targets: ${missing.join(", ")}` : "",
			draft.error ? `Model note: ${draft.error}` : "",
			draftState.error ? `Last error: ${draftState.error}` : ""
		].filter(Boolean);
	}
	function renderThreadTaskCardDraftActions(draftKey, draft, draftState, thread = renderContextThread()) {
		if (!draft || draftState.status === "pending" || draftState.status === "creating" || draftState.status === "created" || draftState.status === "dismissed") return "";
		const threadId = renderContextThreadId(thread);
		const threadAttr = threadId ? ` data-task-card-draft-thread-id="${escapeHtml(threadId)}"` : "";
		if (draftState.status === "failed") return `<div class="approval-actions">
      <button class="approval-button deny" type="button" data-task-card-draft-action="dismiss" data-task-card-draft-key="${escapeHtml(draftKey)}"${threadAttr}>Dismiss</button>
    </div>`;
		return `<div class="approval-actions">
    <button class="approval-button deny" type="button" data-task-card-draft-action="dismiss" data-task-card-draft-key="${escapeHtml(draftKey)}"${threadAttr}>Dismiss</button>
  </div>`;
	}
	function renderThreadTaskCardDraft(draft, item, turn, previousKeys = /* @__PURE__ */ new Set(), draftKey = "", draftState = null, thread = renderContextThread()) {
		if (!draft || !item || !turn) return "";
		const contextThread = renderContextThread(thread);
		const resolvedDraftKey = draftKey || threadTaskCardDraftKeyForDraft(turn, draft, item);
		const resolvedDraftState = draftState || threadTaskCardDraftState(resolvedDraftKey);
		const targetRefs = threadTaskCardDraftTargetThreads(draft);
		const compact = resolvedDraftState.status === "created" || resolvedDraftState.status === "dismissed" ? " compact" : "";
		const detail = threadTaskCardDraftDetailLines(draft, targetRefs, resolvedDraftState).join("\n");
		const summary = threadTaskCardSummaryLine(draft.summary || draft.error || "");
		const detailBlocks = [detail ? `<pre class="approval-detail">${escapeHtml(detail)}</pre>` : "", draft.body ? `<pre class="approval-detail">${escapeHtml(draft.body)}</pre>` : ""];
		return `<section class="approval-card thread-task-card-draft${compact}${entryAnimationClass(draftKey, previousKeys)} ${escapeHtml(draftState.status)}" data-render-key="${escapeHtml(draftKey)}" data-task-card-draft="${escapeHtml(draftKey)}">
    <div class="approval-head">
      <div>
        <div class="approval-title">Cross-thread task card draft</div>
        <div class="approval-method">${escapeHtml(draft.title || "Task card draft")}</div>
      </div>
      <span class="approval-status">${escapeHtml(threadTaskCardDraftStatusLabel(resolvedDraftState.status))}</span>
    </div>
    ${summary ? `<div class="approval-summary-line">${escapeHtml(summary)}</div>` : ""}
    ${renderThreadTaskCardExpandable(summary || detail || draft.title || "Task card draft details", detailBlocks)}
    ${renderThreadTaskCardDraftActions(resolvedDraftKey, draft, resolvedDraftState, contextThread)}
  </section>`;
	}
	function approvalTitle(method) {
		return {
			"item/commandExecution/requestApproval": "命令需要批准",
			"execCommandApproval": "命令需要批准",
			"item/fileChange/requestApproval": "文件改动需要批准",
			"applyPatchApproval": "文件改动需要批准",
			"item/permissions/requestApproval": "权限需要批准",
			"item/tool/requestUserInput": "需要你补充信息",
			"mcpServer/elicitation/request": "MCP 需要输入",
			"item/tool/call": "工具请求",
			"account/chatgptAuthTokens/refresh": "账号授权"
		}[method] || "待处理请求";
	}
	function approvalStatusLabel(status) {
		const text = String(status || "waiting");
		if (text === "waiting") return "等待中";
		if (text === "responding") return "发送中";
		if (text === "responded" || text === "resolved") return "已处理";
		if (text === "connectionClosed") return "已关闭";
		return text.charAt(0).toUpperCase() + text.slice(1);
	}
	function permissionSummary(permissions) {
		if (!permissions || typeof permissions !== "object") return "";
		const parts = [];
		if (permissions.network) parts.push(`Network: ${JSON.stringify(permissions.network)}`);
		if (permissions.fileSystem) parts.push(`File system: ${JSON.stringify(permissions.fileSystem)}`);
		return parts.join("\n");
	}
	function approvalDetailLines(request) {
		const params = request.params || {};
		const questions = Array.isArray(params.questions) ? params.questions : [];
		return [
			params.reason ? `原因: ${params.reason}` : "",
			params.command ? `命令:\n${params.command}` : "",
			params.cwd ? `工作目录:\n${params.cwd}` : "",
			params.grantRoot ? `授权目录:\n${params.grantRoot}` : "",
			Array.isArray(params.fileNames) && params.fileNames.length ? `文件:\n${params.fileNames.join("\n")}` : "",
			params.permissions ? `权限:\n${permissionSummary(params.permissions) || JSON.stringify(params.permissions, null, 2)}` : "",
			params.networkApprovalContext ? `网络:\n${JSON.stringify(params.networkApprovalContext, null, 2)}` : "",
			questions.length ? questions.map((question, index) => {
				return [
					question.header ? `${question.header}` : `问题 ${index + 1}`,
					question.question || "",
					Array.isArray(question.options) && question.options.length ? question.options.map((option) => `- ${option.label}${option.description ? `: ${option.description}` : ""}`).join("\n") : ""
				].filter(Boolean).join("\n");
			}).join("\n\n") : "",
			params.title ? `标题:\n${params.title}` : "",
			params.message ? `说明:\n${params.message}` : "",
			params.schema ? `结构:\n${JSON.stringify(params.schema, null, 2)}` : "",
			params.elicitation ? `请求:\n${JSON.stringify(params.elicitation, null, 2)}` : ""
		].filter(Boolean);
	}
	function isUserInputRequest(request) {
		return USER_INPUT_REQUEST_METHODS.has(request && request.method);
	}
	function renderUserInputOptions(request, fallbackThreadId = "") {
		const params = request.params || {};
		const questions = Array.isArray(params.questions) ? params.questions : [];
		const question = questions.find((entry) => Array.isArray(entry.options) && entry.options.length) || questions[0] || null;
		if (!question || !Array.isArray(question.options) || !question.options.length) return "";
		const threadId = approvalActionThreadId(request, fallbackThreadId);
		return `<div class="approval-option-grid">
    ${question.options.map((option) => `<button class="approval-option" type="button" data-server-request-id="${escapeHtml(request.id)}" data-server-request-thread-id="${escapeHtml(threadId)}" data-server-question-id="${escapeHtml(question.id || "answer")}" data-server-response-text="${escapeHtml(option.label || "")}">
      <span>${escapeHtml(option.label || "选项")}</span>
      ${option.description ? `<small>${escapeHtml(option.description)}</small>` : ""}
    </button>`).join("")}
  </div>`;
	}
	function renderUserInputActions(request, fallbackThreadId = "") {
		const params = request.params || {};
		const question = (Array.isArray(params.questions) ? params.questions : [])[0] || {};
		const threadId = approvalActionThreadId(request, fallbackThreadId);
		return `<form class="approval-response-form" data-server-request-form data-server-request-id="${escapeHtml(request.id)}" data-server-request-thread-id="${escapeHtml(threadId)}" data-server-question-id="${escapeHtml(question.id || "answer")}">
    ${renderUserInputOptions(request, threadId)}
    <textarea class="approval-response-input" name="responseText" rows="3" placeholder="输入回复内容"></textarea>
    <div class="approval-actions request-actions">
      <button class="approval-button allow" type="submit">提交</button>
      <button class="approval-button deny" type="button" data-server-request-id="${escapeHtml(request.id)}" data-server-request-thread-id="${escapeHtml(threadId)}" data-server-request-decline>取消</button>
    </div>
  </form>`;
	}
	function renderApprovalActions(request, fallbackThreadId = "") {
		const waiting = request.status === "waiting";
		if (!request.actionable || !waiting) return "";
		if (isUserInputRequest(request)) return renderUserInputActions(request, fallbackThreadId);
		const threadId = approvalActionThreadId(request, fallbackThreadId);
		return `<div class="approval-actions">
    <button class="approval-button allow" type="button" data-approval-id="${escapeHtml(request.id)}" data-approval-thread-id="${escapeHtml(threadId)}" data-approval-action="allow_once">允许一次</button>
    <button class="approval-button allow" type="button" data-approval-id="${escapeHtml(request.id)}" data-approval-thread-id="${escapeHtml(threadId)}" data-approval-action="allow_session">本会话允许</button>
    <button class="approval-button deny" type="button" data-approval-id="${escapeHtml(request.id)}" data-approval-thread-id="${escapeHtml(threadId)}" data-approval-action="deny">拒绝</button>
  </div>`;
	}
	function renderApprovalRequest(request, previousKeys = /* @__PURE__ */ new Set(), fallbackThreadId = "") {
		const key = `approval|${request.id}`;
		const status = String(request.status || "waiting");
		if (isApprovalSettled(request)) return `<section class="approval-card compact${entryAnimationClass(key, previousKeys)} ${escapeHtml(status)}" data-render-key="${escapeHtml(key)}" data-approval-card="${escapeHtml(request.id)}">
      <div class="approval-line">
        <span>${escapeHtml(approvalTitle(request.method))}</span>
        <span>${escapeHtml(approvalStatusLabel(request.status))}</span>
      </div>
    </section>`;
		const detail = approvalDetailLines(request).join("\n");
		return `<section class="approval-card${entryAnimationClass(key, previousKeys)} ${escapeHtml(status)}" data-render-key="${escapeHtml(key)}" data-approval-card="${escapeHtml(request.id)}">
    <div class="approval-head">
      <div>
        <div class="approval-title">${escapeHtml(approvalTitle(request.method))}</div>
        <div class="approval-method">${escapeHtml(request.method)}</div>
      </div>
      <span class="approval-status">${escapeHtml(approvalStatusLabel(request.status))}</span>
    </div>
    ${detail ? `<pre class="approval-detail">${escapeHtml(detail)}</pre>` : ""}
    ${renderApprovalActions(request, fallbackThreadId)}
  </section>`;
	}
	function renderPendingApprovals(thread, previousKeys = /* @__PURE__ */ new Set(), filter = null) {
		const threadId = String(thread && (thread.id || state.currentThreadId) || "").trim();
		const requests = pendingApprovalsForThread(threadId).filter((request) => !filter || filter(request));
		if (!requests.length) return "";
		return `<div class="approval-stack">
    ${requests.map((request) => renderApprovalRequest(request, previousKeys, threadId)).join("")}
  </div>`;
	}
	function createTaskCardRuntime() {
		return {
			renderThreadTaskCard: typeof renderThreadTaskCard === "function" ? renderThreadTaskCard : null,
			renderThreadTaskCards: typeof renderThreadTaskCards === "function" ? renderThreadTaskCards : null,
			createThreadTaskCardFromCurrent: typeof createThreadTaskCardFromCurrent === "function" ? createThreadTaskCardFromCurrent : null,
			mutateThreadTaskCard: typeof mutateThreadTaskCard === "function" ? mutateThreadTaskCard : null,
			replyTaskCard: typeof replyTaskCard === "function" ? replyTaskCard : null,
			renderApprovalRequest: typeof renderApprovalRequest === "function" ? renderApprovalRequest : null
		};
	}
	(function exposeCodexTaskCardRuntime(root) {
		const taskCardRuntimeApi = { createTaskCardRuntime };
		const legacyGlobals = {
			approvalDetailLines,
			approvalStatusLabel,
			approvalTitle,
			archiveThread,
			buildThreadTaskCardDraftRequestText,
			canRecoverFailedThreadTaskCardDraft,
			clearRememberedContinuationJob,
			closeThreadArchiveDialog,
			commonPrefixLength,
			continuationJobStatusText,
			createThreadTaskCardFromCurrent,
			createThreadTaskCardFromThread,
			currentThreadHasTurn,
			findThreadById,
			findThreadTaskCard,
			handleThreadTaskCardDetailsToggle,
			hasThreadTaskCardDraftTag,
			incrementPendingIncomingTaskCardCount,
			incrementPendingOutgoingTaskCardCount,
			isChatGptProCommandText,
			isThreadGoalCommandText,
			isThreadTaskCardCommandText,
			isThreadTaskCardDraftCreationStale,
			isUserInputRequest,
			loadThreadTaskCardBody,
			matchingThreadTaskCardsForDraft,
			normalizeThreadTaskCardWorkflowMode,
			openContinuationResult,
			parseThreadTaskCardDraftText,
			permissionSummary,
			primaryTouch,
			recoverVisibleThreadForDraftTargetId,
			rememberContinuationJob,
			renderApprovalActions,
			renderApprovalRequest,
			renderPendingApprovals,
			renderPendingThreadTaskCardDraft,
			renderThreadArchiveDialog,
			renderThreadTaskCard,
			renderThreadTaskCardActions,
			renderThreadTaskCardDraft,
			renderThreadTaskCardDraftActions,
			renderThreadTaskCardExpandable,
			renderThreadTaskCards,
			renderTurnThreadTaskCardDraft,
			renderUserInputActions,
			renderUserInputOptions,
			replaceTaskCardBodyPlaceholder,
			requestThreadArchiveConfirmation,
			resolveTargetThreadReference,
			resolveTargetThreadReferences,
			resumeRememberedContinuationJob,
			refreshCurrentThreadAfterTaskCard,
			refreshThreadAfterTaskCard,
			settleCurrentThreadTaskCard,
			settleThreadTaskCardForThread,
			startNewThreadFromCurrent,
			startNewThreadFromThread,
			startThreadRequestBody,
			startedThreadId,
			startedTurnId,
			submitChatGptProRequest,
			summarizeTaskCardText,
			taskCardActionThread,
			taskCardCountThreadsForId,
			taskCardDetailLines,
			taskCardDirectionLabel,
			taskCardStatusLabel,
			threadActionTargetRow,
			threadTaskCardCommandText,
			threadTaskCardDraftDetailLines,
			threadTaskCardDraftKey,
			threadTaskCardDraftKeyForDraft,
			threadTaskCardDraftPayloadKey,
			threadTaskCardDraftState,
			threadTaskCardDraftStatusLabel,
			threadTaskCardDraftTargetIds,
			threadTaskCardDraftTargetThreads,
			threadTaskCardRequestMarkerMatch,
			threadTaskCardSummaryLine,
			threadTaskCardVisibleTargets,
			truncateThreadTaskCardBody,
			turnHasThreadTaskCardDraftResponse,
			turnHasThreadTaskCardRequest,
			uniqueThreadTaskCardTargetIds,
			upsertThreadTaskCardOnThread,
			visibleThreadTaskCardCommandText,
			waitForContinuationJob,
			waitForCurrentThreadTurn
		};
		if (typeof module === "object" && module.exports) module.exports = taskCardRuntimeApi;
		Object.assign(root, legacyGlobals);
		root.CodexTaskCardRuntime = taskCardRuntimeApi;
	})(typeof globalThis !== "undefined" ? globalThis : window);
}));
//#endregion
//#region \0virtual:codex-mobile-esm-compatibility/shard/shard-06
var import_api_client_runtime = /* @__PURE__ */ __toESM(require_api_client_runtime());
var import_thread_list_load_policy = /* @__PURE__ */ __toESM(require_thread_list_load_policy());
var import_thread_list_stable_order = /* @__PURE__ */ __toESM(require_thread_list_stable_order());
var import_thread_status_hints = /* @__PURE__ */ __toESM(require_thread_status_hints());
var import_thread_detail_patch_plan = /* @__PURE__ */ __toESM(require_thread_detail_patch_plan());
var import_thread_detail_actions = /* @__PURE__ */ __toESM(require_thread_detail_actions());
var import_thread_detail_merge_state = /* @__PURE__ */ __toESM(require_thread_detail_merge_state());
var import_thread_detail_v4_merge_state = /* @__PURE__ */ __toESM(require_thread_detail_v4_merge_state());
var import_thread_detail_runtime = /* @__PURE__ */ __toESM(require_thread_detail_runtime());
var import_task_card_runtime = /* @__PURE__ */ __toESM(require_task_card_runtime());
var moduleDefinitions = [
	{
		"id": "api-client-runtime",
		"source": "public/api-client-runtime.js",
		"globalName": "CodexApiClientRuntime",
		"expectedFunctions": ["createApiClientRuntime"],
		"assetPath": "/api-client-runtime.js",
		"classicLoaderExcluded": true,
		"bytes": 49014
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
		"classicLoaderExcluded": true,
		"bytes": 5362
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
		"id": "thread-detail-v4-merge-state",
		"source": "public/thread-detail-v4-merge-state.js",
		"globalName": "CodexThreadDetailV4MergeState",
		"expectedFunctions": ["createThreadDetailV4MergePolicy"],
		"assetPath": "/thread-detail-v4-merge-state.js",
		"classicLoaderExcluded": true,
		"bytes": 12071
	},
	{
		"id": "thread-detail-runtime",
		"source": "public/thread-detail-runtime.js",
		"globalName": "CodexThreadDetailRuntime",
		"expectedFunctions": ["createThreadDetailRuntime"],
		"assetPath": "/thread-detail-runtime.js",
		"classicLoaderExcluded": true,
		"bytes": 57528
	},
	{
		"id": "task-card-runtime",
		"source": "public/task-card-runtime.js",
		"globalName": "CodexTaskCardRuntime",
		"expectedFunctions": ["createTaskCardRuntime"],
		"assetPath": "/task-card-runtime.js",
		"classicLoaderExcluded": true,
		"bytes": 64113
	}
];
var moduleApis = {
	"api-client-runtime": import_api_client_runtime.default,
	"thread-list-load-policy": import_thread_list_load_policy.default,
	"thread-list-stable-order": import_thread_list_stable_order.default,
	"thread-status-hints": import_thread_status_hints.default,
	"thread-detail-patch-plan": import_thread_detail_patch_plan.default,
	"thread-detail-actions": import_thread_detail_actions.default,
	"thread-detail-merge-state": import_thread_detail_merge_state.default,
	"thread-detail-v4-merge-state": import_thread_detail_v4_merge_state.default,
	"thread-detail-runtime": import_thread_detail_runtime.default,
	"task-card-runtime": import_task_card_runtime.default
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
