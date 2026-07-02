import { i as __toESM, r as __commonJSMin } from "./vite-shell-entry-4WUavjDd.js";
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
//#region \0virtual:codex-mobile-esm-compatibility/shard/shard-04
var import_thread_detail_runtime = /* @__PURE__ */ __toESM(require_thread_detail_runtime());
var import_client_render_stability_guard = /* @__PURE__ */ __toESM(require_client_render_stability_guard());
var import_live_operation_dock_state = /* @__PURE__ */ __toESM(require_live_operation_dock_state());
var moduleDefinitions = [
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
	"thread-detail-runtime": import_thread_detail_runtime.default,
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
