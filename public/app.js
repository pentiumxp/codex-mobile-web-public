"use strict";

const state = {
  key: localStorage.getItem("codexMobileKey") || "",
  workspaces: [],
  selectedCwd: "",
  threads: [],
  currentThread: null,
  currentThreadId: "",
  activeTurnId: "",
  events: null,
  renderScheduled: false,
  renderFrame: null,
  refreshTimer: null,
  recoveryTimer: null,
  resumeTimer: null,
  pollTimer: null,
  pollStableCount: 0,
  lastThreadSignature: "",
  renderedConversationSignature: "",
  renderedThreadListSignature: "",
  tickTimer: null,
  nowMs: Date.now(),
  threadLoadSeq: 0,
  threadLoadController: null,
  threadListLoadSeq: 0,
  threadListLoadController: null,
  pendingAttachments: [],
  composerBusy: false,
  maxUploadBytes: 64 * 1024 * 1024,
  maxUploadFiles: 12,
  modelOptions: [],
  reasoningEffortOptions: [],
  defaultModel: "",
  defaultReasoningEffort: "",
  rateLimits: null,
  pendingApprovals: new Map(),
  selectedModel: localStorage.getItem("codexMobileSelectedModel") || "",
  selectedEffort: localStorage.getItem("codexMobileSelectedEffort") || "",
  leavingItems: new Map(),
  leavingCleanupTimer: null,
};

const MAX_COMMAND_OUTPUT_CHARS = 16000;
const MAX_LIVE_TEXT_CHARS = 60000;
const MAX_VISIBLE_TURNS = 12;
const MAX_RETAINED_OPERATIONS_PER_TURN = 1;
const STORAGE_THREAD_ID = "codexMobileCurrentThreadId";
const STORAGE_MODEL = "codexMobileSelectedModel";
const STORAGE_EFFORT = "codexMobileSelectedEffort";
const OPERATIONAL_ITEM_TYPES = new Set(["commandExecution", "fileChange", "dynamicToolCall", "mcpToolCall"]);

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function truncateMiddle(value, maxChars, label) {
  const text = String(value ?? "");
  if (text.length <= maxChars) return text;
  const head = Math.floor(maxChars * 0.42);
  const tail = maxChars - head;
  return `${text.slice(0, head)}\n\n[${label} truncated: ${text.length} chars total, showing first ${head} and last ${tail}]\n\n${text.slice(-tail)}`;
}

function compactLiveText(value) {
  return truncateMiddle(value, MAX_LIVE_TEXT_CHARS, "text");
}

function appendCommandOutput(item, delta) {
  const text = String(delta || "");
  const current = item.aggregatedOutput || "";
  const totalBefore = item.outputTotalChars || current.length;
  const nextTotal = totalBefore + text.length;
  let next = current + text;
  if (next.length > MAX_COMMAND_OUTPUT_CHARS) {
    next = next.slice(-MAX_COMMAND_OUTPUT_CHARS);
    item.outputTruncated = true;
  }
  if (item.outputTruncated || nextTotal > next.length) {
    item.outputTruncated = true;
    item.outputTotalChars = nextTotal;
  }
  item.aggregatedOutput = next;
}

function shortPath(value) {
  if (!value) return "";
  return String(value).replace(/^\\\\\?\\/, "").replace(/^.*[\\/]/, "");
}

function formatTime(seconds) {
  if (!seconds) return "";
  const d = new Date(seconds * 1000);
  return d.toLocaleString([], { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatElapsedTime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function statusText(status) {
  if (!status) return "";
  if (typeof status === "string") return status;
  return status.type || JSON.stringify(status);
}

function normalizeOptionList(values) {
  return [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))];
}

function labelForModel(value) {
  const labels = {
    "gpt-5.5": "GPT-5.5",
    "gpt-5.4": "GPT-5.4",
    "gpt-5.4-mini": "GPT-5.4 Mini",
    "gpt-5.3-codex": "GPT-5.3 Codex",
    "gpt-5.3-codex-spark": "GPT-5.3 Codex Spark",
    "gpt-5.2": "GPT-5.2",
  };
  return labels[value] || value;
}

function labelForEffort(value) {
  const labels = {
    low: "Low",
    medium: "Medium",
    high: "High",
    xhigh: "XHigh",
  };
  return labels[value] || value;
}

function rateLimitWindows(rateLimits) {
  return [rateLimits && rateLimits.primary, rateLimits && rateLimits.secondary]
    .filter((windowInfo) => windowInfo && Number.isFinite(Number(windowInfo.usedPercent)));
}

function rateLimitWindowForMinutes(rateLimits, targetMinutes) {
  const windows = rateLimitWindows(rateLimits);
  if (!windows.length) return null;
  return windows.find((windowInfo) => Number(windowInfo.windowDurationMins || 0) === targetMinutes) || null;
}

function weeklyRateLimit(rateLimits) {
  return rateLimitWindowForMinutes(rateLimits, 10080);
}

function fiveHourRateLimit(rateLimits) {
  return rateLimitWindowForMinutes(rateLimits, 300);
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function formatQuotaReset(seconds) {
  if (!seconds) return "";
  const date = new Date(Number(seconds) * 1000);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleString([], { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function quotaRemainingText(windowInfo) {
  if (!windowInfo) return "--";
  const used = clampPercent(windowInfo.usedPercent);
  const remaining = clampPercent(100 - used);
  return `${Math.round(remaining)}%`;
}

function quotaTitle(label, windowInfo) {
  if (!windowInfo) return `${label} quota remaining unavailable`;
  const used = clampPercent(windowInfo.usedPercent);
  const resetText = formatQuotaReset(windowInfo.resetsAt);
  return [
    `${label} quota remaining: ${quotaRemainingText(windowInfo)}`,
    `used: ${Math.round(used)}%`,
    resetText ? `resets: ${resetText}` : "",
  ].filter(Boolean).join("; ");
}

function renderQuotaUsage() {
  const el = $("quotaUsage");
  if (!el) return;
  const fiveHour = fiveHourRateLimit(state.rateLimits);
  const weekly = weeklyRateLimit(state.rateLimits);
  el.textContent = `${quotaRemainingText(fiveHour)} | ${quotaRemainingText(weekly)}`;
  el.title = `${quotaTitle("5-hour", fiveHour)} | ${quotaTitle("weekly", weekly)}`;
  el.classList.toggle("unknown", !fiveHour && !weekly);
}

function updateConnectionState(status, fallbackText = "Starting") {
  const el = $("connectionState");
  if (!el) return;
  const hasError = Boolean(status && !status.ready && status.lastError);
  if (status && status.ready) {
    el.textContent = status.sharedRequired || String(status.transport || "").startsWith("external-")
      ? "Shared"
      : "Connected";
  } else {
    el.textContent = hasError ? status.lastError : fallbackText;
  }
  el.classList.toggle("error", hasError);
  el.title = hasError ? status.lastError : "";
}

function normalizeFsPath(value) {
  return String(value || "")
    .replace(/^\\\\\?\\/, "")
    .replace(/[\\/]+/g, "\\")
    .replace(/\\+$/, "")
    .toLowerCase();
}

function visibleWorkspaceKeys() {
  return new Set(state.workspaces.map((ws) => normalizeFsPath(ws.cwd)).filter(Boolean));
}

function isHiddenThread(thread) {
  if (!thread) return true;
  const status = statusText(thread.status).toLowerCase();
  const location = String(thread.path || thread.rolloutPath || thread.rollout_path || "").toLowerCase();
  if (thread.archived || thread.archivedAt || thread.archived_at || thread.isArchived) return true;
  if (thread.deleted || thread.deletedAt || thread.deleted_at || thread.isDeleted || thread.removed || thread.removedAt) return true;
  if (/archived|deleted|removed/.test(status)) return true;
  if (/[/\\](archived|deleted|trash|removed)[_-]?sessions[/\\]/.test(location)) return true;
  const cwd = normalizeFsPath(thread.cwd);
  if (state.selectedCwd && cwd !== normalizeFsPath(state.selectedCwd)) return true;
  const keys = visibleWorkspaceKeys();
  if (keys.size > 0 && (!cwd || !keys.has(cwd))) return true;
  return false;
}

function visibleThreads(threads = state.threads) {
  return (threads || []).filter((thread) => !isHiddenThread(thread));
}

function pruneHiddenThreads() {
  state.threads = visibleThreads();
}

function isRunningStatus(status) {
  const text = statusText(status).toLowerCase();
  return /(running|active|queued|processing|inprogress|in_progress|in-progress)/.test(text)
    && !/(completed|failed|cancel|error|interrupted)/.test(text);
}

function isCompletedStatus(status) {
  return /completed|failed|cancel|error|interrupted/i.test(statusText(status));
}

function isTurnComplete(turn) {
  return Boolean(turn && (turn.completedAt || turn.durationMs || isCompletedStatus(turn.status)));
}

function isReasoningItem(item) {
  return item && item.type === "reasoning";
}

function syncActiveTurnFromThread() {
  const turns = state.currentThread && Array.isArray(state.currentThread.turns)
    ? state.currentThread.turns
    : [];
  const running = turns.slice().reverse().find((turn) => !isTurnComplete(turn) && isRunningStatus(turn.status));
  state.activeTurnId = running ? running.id : "";
  const interrupt = $("interruptTurn");
  if (interrupt) interrupt.disabled = !state.activeTurnId;
  updateComposerControls();
}

function isOperationalItem(item) {
  return item && (OPERATIONAL_ITEM_TYPES.has(item.type) || isWebSearchLikeItem(item));
}

function isWebSearchLikeItem(item) {
  if (!item) return false;
  return /web[_-]?search|websearch|search_query|image_query/i.test([
    item.type,
    item.tool,
    item.name,
    item.namespace,
    item.server,
  ].filter(Boolean).join(" "));
}

function isContextCompactionType(type) {
  return /context.*compaction|context.*compression|context_compaction|context_compression/i.test(String(type || ""));
}

function isContextCompactionItem(item) {
  return item && (isContextCompactionType(item.type) || item.mobileNotice === "历史上下文已压缩");
}

function latestTurn() {
  const turns = state.currentThread && Array.isArray(state.currentThread.turns)
    ? state.currentThread.turns
    : [];
  return turns.length ? turns[turns.length - 1] : null;
}

function isIncompleteInterruptedTurn(turn) {
  return turn
    && statusText(turn.status).toLowerCase() === "interrupted"
    && !turn.completedAt
    && !turn.durationMs;
}

function shouldPollCurrentThread() {
  if (!state.currentThreadId || document.visibilityState === "hidden") return false;
  const turn = latestTurn();
  if (!turn) return false;
  if (isTurnComplete(turn)) return false;
  return Boolean(state.activeTurnId) || isRunningStatus(turn.status) || isIncompleteInterruptedTurn(turn);
}

function isLiveTurn(turn) {
  if (!turn || isTurnComplete(turn)) return false;
  return isRunningStatus(turn && turn.status) || isIncompleteInterruptedTurn(turn);
}

function isLatestTurn(turn) {
  return Boolean(turn && latestTurn() === turn);
}

function stableItemKey(turn, item, index = 0, prefix = "item") {
  const threadId = state.currentThreadId || (state.currentThread && state.currentThread.id) || "thread";
  const turnId = turn && (turn.id || turn.startedAt || "turn");
  const itemId = item && (item.id || `${item.type || "item"}-${index}`);
  return [prefix, threadId, turnId, itemId].map((part) => String(part || "")).join("|");
}

function stableTurnKey(turn, suffix = "") {
  const threadId = state.currentThreadId || (state.currentThread && state.currentThread.id) || "thread";
  return ["turn", threadId, turn && (turn.id || turn.startedAt || "turn"), suffix].filter(Boolean).join("|");
}

function existingConversationRenderKeys() {
  const el = $("conversation");
  if (!el) return new Set();
  return new Set(Array.from(el.querySelectorAll("[data-render-key]"))
    .map((node) => node.dataset.renderKey)
    .filter(Boolean));
}

function entryAnimationClass(key, previousKeys) {
  return previousKeys && previousKeys.has(key) ? "" : " entry-animate";
}

function cleanupLeavingItems() {
  const now = Date.now();
  let needsRecheck = false;
  for (const [key, value] of state.leavingItems.entries()) {
    if (!value) {
      state.leavingItems.delete(key);
      continue;
    }
    if (value.keepUntilOutOfView) {
      if (value.maxExpiresAt && value.maxExpiresAt <= now) {
        state.leavingItems.delete(key);
        continue;
      }
      if (value.minExpiresAt && value.minExpiresAt > now) {
        needsRecheck = true;
        continue;
      }
      const node = renderNodeByKey(value.renderKey || key);
      if (node && isNodeInConversationViewport(node)) {
        needsRecheck = true;
        continue;
      }
      state.leavingItems.delete(key);
      continue;
    }
    if (value.expiresAt <= now) state.leavingItems.delete(key);
  }
  if (needsRecheck) scheduleLeavingCleanup();
}

function leavingItemsForTurn(turn) {
  cleanupLeavingItems();
  const threadId = state.currentThreadId || (state.currentThread && state.currentThread.id) || "";
  return Array.from(state.leavingItems.values())
    .filter((value) => value.threadId === threadId && value.turnId === turn.id)
    .map((value) => ({
      html: value.html,
      sourceIndex: Number.isFinite(value.sourceIndex) ? value.sourceIndex : Number.MAX_SAFE_INTEGER,
      order: Number.isFinite(value.order) ? value.order : 0,
    }));
}

function renderNodeByKey(key) {
  const conversation = $("conversation");
  if (!conversation || !key) return null;
  return Array.from(conversation.querySelectorAll("[data-render-key]"))
    .find((node) => node.dataset.renderKey === key) || null;
}

function liveOperationNodeForItem(item) {
  const conversation = $("conversation");
  if (!conversation || !item || !item.id) return null;
  return Array.from(conversation.querySelectorAll(".live-operation"))
    .find((node) => node.dataset.item === String(item.id)) || null;
}

function isNodeInConversationViewport(node) {
  const conversation = $("conversation");
  if (!conversation || !node) return false;
  const viewport = conversation.getBoundingClientRect();
  const rect = node.getBoundingClientRect();
  const margin = 24;
  return rect.bottom > viewport.top + margin && rect.top < viewport.bottom - margin;
}

function scheduleLeavingCleanup(delay = 1200) {
  if (state.leavingCleanupTimer) return;
  state.leavingCleanupTimer = setTimeout(() => {
    state.leavingCleanupTimer = null;
    scheduleRenderCurrentThread();
  }, delay);
}

function trimRetainedOperationsForTurn(threadId, turnId, keepKey = "") {
  const retained = Array.from(state.leavingItems.entries())
    .filter(([, value]) => value
      && value.keepUntilOutOfView
      && value.threadId === threadId
      && value.turnId === turnId)
    .sort((a, b) => (Number(b[1].createdAt || 0) - Number(a[1].createdAt || 0)));
  if (keepKey && MAX_RETAINED_OPERATIONS_PER_TURN <= 1) {
    retained.forEach(([key]) => {
      if (key !== keepKey) state.leavingItems.delete(key);
    });
    return;
  }
  retained.forEach(([key], index) => {
    if (key === keepKey) return;
    if (index >= MAX_RETAINED_OPERATIONS_PER_TURN) state.leavingItems.delete(key);
  });
}

function rememberLeavingOperation(turn, item, index, options = {}) {
  if (!turn || !item || !isLatestTurn(turn)) return;
  const keepUntilOutOfView = Boolean(options.keepUntilOutOfView);
  if (options.onlyIfInViewport && !isNodeInConversationViewport(liveOperationNodeForItem(item))) return;
  const key = stableItemKey(turn, item, index, keepUntilOutOfView ? "retained-operation" : "leaving-operation");
  if (state.leavingItems.has(key)) return;
  const lines = operationSummaryLines(item);
  const body = lines.length ? `<div class="operation-body">${escapeHtml(lines.join("\n"))}</div>` : "";
  const status = statusText(item.status) || (item.completedAtMs ? "completed" : "running");
  const title = operationTitle(item, status);
  const type = item.type || "item";
  const now = Date.now();
  const transitionClass = keepUntilOutOfView ? "retained-operation" : "entry-leave";
  const threadId = state.currentThreadId || (state.currentThread && state.currentThread.id) || "";
  const turnId = turn.id;
  state.leavingItems.set(key, {
    threadId,
    turnId,
    sourceIndex: index,
    order: 0,
    renderKey: key,
    keepUntilOutOfView,
    createdAt: now,
    minExpiresAt: keepUntilOutOfView ? now + 450 : 0,
    maxExpiresAt: keepUntilOutOfView ? now + 30000 : 0,
    expiresAt: now + (keepUntilOutOfView ? 30000 : 180),
    html: `<section class="item live-operation ${transitionClass} ${isCompletedStatus(status) ? "completed" : ""} ${escapeHtml(type)}" data-item="${escapeHtml(item.id || "")}" data-render-key="${escapeHtml(key)}">
    <div class="item-head"><span>${escapeHtml(title)}</span><span>${escapeHtml(status)}</span></div>
    ${body}
  </section>`,
  });
  if (keepUntilOutOfView) trimRetainedOperationsForTurn(threadId, turnId, key);
  setTimeout(() => scheduleRenderCurrentThread(), keepUntilOutOfView ? 480 : 190);
}

function visibleOperationIndex(turn) {
  if (!isLatestTurn(turn) || !isLiveTurn(turn)) return -1;
  const items = Array.isArray(turn.items) ? turn.items : [];
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (isOperationalItem(items[index])) return index;
  }
  return -1;
}

function latestVisibleOperationItem(turn) {
  const index = visibleOperationIndex(turn);
  if (index < 0) return null;
  const item = turn && Array.isArray(turn.items) ? turn.items[index] : null;
  return item ? { item, index } : null;
}

function visibleNonOperationalItemsForTurn(turn) {
  return (turn.items || []).filter((item) => !isReasoningItem(item) && !isOperationalItem(item));
}

function visibleItemsForTurn(turn) {
  const operation = latestVisibleOperationItem(turn);
  return (turn.items || []).map((item, index) => {
    if (!item || isReasoningItem(item)) return null;
    if (isOperationalItem(item) && (!operation || operation.item !== item)) return null;
    return { item, sourceIndex: index };
  }).filter(Boolean);
}

function hasVisibleNonOperationAfterIndex(turn, sourceIndex) {
  const items = turn && Array.isArray(turn.items) ? turn.items : [];
  for (let index = sourceIndex + 1; index < items.length; index += 1) {
    const item = items[index];
    if (item && !isOperationalItem(item) && !isReasoningItem(item) && itemVisibleWeight(item) > 0) return true;
  }
  return false;
}

function visibleItemSignature(item) {
  if (!item || isReasoningItem(item)) return null;
  if (isOperationalItem(item)) {
    return {
      id: item.id || "",
      type: item.type || "",
      status: statusText(item.status),
      command: item.command || "",
      fileNames: Array.isArray(item.fileNames) ? item.fileNames : [],
      tool: item.tool || "",
      server: item.server || "",
      namespace: item.namespace || "",
    };
  }
  return {
    id: item.id || "",
    type: item.type || "",
    status: statusText(item.status),
    text: item.text || "",
    content: Array.isArray(item.content) ? inputContentSignature(item.content) : [],
    summary: Array.isArray(item.summary) ? item.summary : [],
    mobileNotice: item.mobileNotice || "",
  };
}

function inputContentSignature(content) {
  return (content || []).map((part) => {
    if (!part || typeof part !== "object") return String(part || "");
    if (part.type === "text") return { type: "text", text: part.text || "" };
    if (isInputImagePart(part)) {
      return {
        type: part.type || "image",
        path: part.path || "",
        url: imageSourceSignature(part.url || part.image_url || ""),
      };
    }
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
  const items = turn && Array.isArray(turn.items) ? turn.items : [];
  return items.reduce((total, item) => total + itemVisibleWeight(item), 0);
}

function mergeTurnPreservingVisibleItems(existingTurn, incomingTurn) {
  if (!existingTurn) return incomingTurn;
  if (!incomingTurn) return existingTurn;
  const existingItems = Array.isArray(existingTurn.items) ? existingTurn.items : [];
  const incomingHasItems = Array.isArray(incomingTurn.items);
  const existingWeight = turnVisibleWeight(existingTurn);
  const incomingWeight = incomingHasItems ? turnVisibleWeight(incomingTurn) : -1;
  const merged = Object.assign({}, existingTurn, incomingTurn);
  if (!incomingHasItems || existingWeight > incomingWeight) {
    merged.items = existingItems;
  }
  return merged;
}

function mergeThreadPreservingVisibleItems(existingThread, incomingThread) {
  if (!existingThread || !incomingThread || existingThread.id !== incomingThread.id) return incomingThread;
  const existingTurns = Array.isArray(existingThread.turns) ? existingThread.turns : [];
  const incomingTurns = Array.isArray(incomingThread.turns) ? incomingThread.turns : null;
  const existingById = new Map(existingTurns.map((turn) => [turn.id, turn]));
  const merged = Object.assign({}, existingThread, incomingThread);
  if (!Object.prototype.hasOwnProperty.call(incomingThread, "mobileLoading")) {
    delete merged.mobileLoading;
  }
  if (!Object.prototype.hasOwnProperty.call(incomingThread, "mobileLoadError")) {
    delete merged.mobileLoadError;
  }
  if (!incomingTurns) return merged;
  merged.turns = incomingTurns.map((incomingTurn) => {
    const existingTurn = existingById.get(incomingTurn.id);
    return existingTurn ? mergeTurnPreservingVisibleItems(existingTurn, incomingTurn) : incomingTurn;
  });
  const incomingIds = new Set(merged.turns.map((turn) => turn && turn.id).filter(Boolean));
  for (const existingTurn of existingTurns) {
    if (!existingTurn || incomingIds.has(existingTurn.id)) continue;
    if (existingTurn.id === state.activeTurnId || (!isTurnComplete(existingTurn) && turnVisibleWeight(existingTurn) > 0)) {
      merged.turns.push(existingTurn);
    }
  }
  return merged;
}

function approvalThreadId(request) {
  return request && request.params && (request.params.threadId || request.params.conversationId || "");
}

function pendingApprovalsForThread(threadId) {
  return Array.from(state.pendingApprovals.values())
    .filter((request) => approvalThreadId(request) === threadId)
    .sort((a, b) => Number(a.receivedAt || 0) - Number(b.receivedAt || 0));
}

function approvalRequestsSignature(threadId) {
  return pendingApprovalsForThread(threadId).map((request) => ({
    id: request.id,
    method: request.method,
    status: request.status,
    decision: request.decision,
    params: request.params,
  }));
}

function conversationRenderSignature(thread) {
  if (!thread) return "home";
  if (thread.mobileLoadError) return `load-error|${state.currentThreadId || thread.id || ""}|${thread.mobileLoadError}`;
  if (thread.mobileLoading) return `loading|${state.currentThreadId || thread.id || ""}`;
  cleanupLeavingItems();
  const turns = (thread.turns || []).slice(-MAX_VISIBLE_TURNS);
  const omitted = Number(thread.mobileOmittedTurnCount || 0) + Math.max(0, (thread.turns || []).length - turns.length);
  const leavingKeys = Array.from(state.leavingItems.entries())
    .filter(([, value]) => value && value.threadId === (state.currentThreadId || thread.id || ""))
    .map(([key]) => key)
    .sort();
  const payload = {
    threadId: state.currentThreadId || thread.id || "",
    omitted,
    leavingKeys,
    approvals: approvalRequestsSignature(state.currentThreadId || thread.id || ""),
    turns: turns.map((turn) => {
      const timerShowsStatus = isLatestTurn(turn) && (isLiveTurn(turn) || turnFinalSeconds(turn) != null);
      return {
        id: turn.id || "",
        statusLine: timerShowsStatus ? "" : displayTurnStatus(turn),
        durationMs: timerShowsStatus ? "" : (turn.durationMs || ""),
        items: visibleItemsForTurn(turn).map((entry) => ({
          sourceIndex: entry.sourceIndex,
          item: visibleItemSignature(entry.item),
        })).filter((entry) => entry.item),
      };
    }),
  };
  return JSON.stringify(payload);
}

function removeOperationalItemsFromTurn(turn) {
  if (!turn || !Array.isArray(turn.items)) return;
  let visibleIndex = visibleOperationIndex(turn);
  if (visibleIndex < 0 && isLatestTurn(turn) && !isLiveTurn(turn)) {
    for (let index = turn.items.length - 1; index >= 0; index -= 1) {
      if (isOperationalItem(turn.items[index])) {
        visibleIndex = index;
        break;
      }
    }
  }
  turn.items.forEach((item, index) => {
    if (index === visibleIndex && isOperationalItem(item)) rememberLeavingOperation(turn, item, index);
  });
  turn.items = turn.items.filter((item) => !isOperationalItem(item));
}

function isPathLikeValue(value) {
  const text = String(value || "");
  if (!text || text.includes("\n") || text.includes("\r")) return false;
  return /^[A-Za-z]:[\\/]/.test(text)
    || /^\\\\\?\\/.test(text)
    || /^[/\\][^/\\]+/.test(text)
    || /[\\/][^/\\]+\.[A-Za-z0-9]{1,12}$/.test(text);
}

function isFileNameLikeValue(value) {
  const text = String(value || "");
  return Boolean(text && !text.includes("\n") && !text.includes("\r") && /^[^\\/]+\.[A-Za-z0-9]{1,12}$/.test(text));
}

function collectFileNames(value, out = [], keyHint = "") {
  if (out.length >= 5 || value == null) return out;
  if (typeof value === "string") {
    const keyLooksPath = /^(path|file|filepath|filename|name|target|source|uri)$/i.test(keyHint);
    if (isPathLikeValue(value) || (keyLooksPath && isFileNameLikeValue(value))) out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectFileNames(entry, out, keyHint);
    return out;
  }
  if (typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      if (/^(path|file|filePath|filename|name|target|source|uri)$/i.test(key) && typeof entry === "string"
        && (isPathLikeValue(entry) || isFileNameLikeValue(entry))) {
        out.push(entry);
        if (out.length >= 5) return out;
        continue;
      }
      collectFileNames(entry, out, key);
      if (out.length >= 5) return out;
    }
  }
  return out;
}

function isLiveReasoning(item, turn) {
  return item && item.type === "reasoning" && isLatestTurn(turn) && isLiveTurn(turn) && !isCompletedStatus(item.status);
}

function liveReasoningElapsed(item, turn) {
  const startedMs = item.startedAtMs
    || (item.startedAt ? item.startedAt * 1000 : 0)
    || (turn && turn.startedAt ? turn.startedAt * 1000 : 0)
    || state.nowMs;
  return Math.max(0, Math.floor((state.nowMs - startedMs) / 1000));
}

function currentLiveTurn() {
  const turns = state.currentThread && Array.isArray(state.currentThread.turns)
    ? state.currentThread.turns
    : [];
  if (state.activeTurnId) {
    const active = turns.find((turn) => turn.id === state.activeTurnId);
    if (active && isLiveTurn(active)) return active;
  }
  return turns.slice().reverse().find((turn) => isLiveTurn(turn)) || null;
}

function turnElapsedSeconds(turn) {
  if (!turn) return 0;
  const startedMs = turn.startedAtMs
    || (turn.startedAt ? turn.startedAt * 1000 : 0)
    || state.nowMs;
  return Math.max(0, Math.floor((state.nowMs - startedMs) / 1000));
}

function turnFinalSeconds(turn) {
  if (!turn) return null;
  if (turn.durationMs) return Math.max(0, Math.round(turn.durationMs / 1000));
  if (turn.completedAt && turn.startedAt) return Math.max(0, Math.round(turn.completedAt - turn.startedAt));
  return null;
}

function updateTurnTimer() {
  const el = $("turnTimer");
  if (!el) return;
  updateComposerHeightVar();
  const turnLabel = "\u672c\u8f6e";
  const turn = currentLiveTurn();
  if (!turn) {
    const latest = latestTurn();
    const finalSeconds = turnFinalSeconds(latest);
    if (finalSeconds != null) {
      el.textContent = `${turnLabel} ${formatElapsedTime(finalSeconds)}`;
      el.classList.add("visible", "settled");
      el.classList.remove("active");
      el.setAttribute("aria-hidden", "false");
    } else {
      el.textContent = `${turnLabel} 00:00:00`;
      el.classList.remove("visible", "settled", "active");
      el.setAttribute("aria-hidden", "true");
    }
    return;
  }
  el.textContent = `${turnLabel} ${formatElapsedTime(turnElapsedSeconds(turn))}`;
  el.classList.add("visible", "active");
  el.classList.remove("settled");
  el.setAttribute("aria-hidden", "false");
}

function updateTickTimer() {
  clearInterval(state.tickTimer);
  state.tickTimer = null;
  updateTurnTimer();
  if (!currentLiveTurn()) return;
  state.tickTimer = setInterval(() => {
    state.nowMs = Date.now();
    updateTurnTimer();
  }, 1000);
}

function threadSignature() {
  const turn = latestTurn();
  if (!turn) return "";
  const items = Array.isArray(turn.items) ? turn.items : [];
  const last = items.length ? items[items.length - 1] : null;
  const bodySize = items.reduce((total, item) => {
    if (!item || isOperationalItem(item) || isReasoningItem(item)) return total;
    return total
      + String(item.text || "").length
      + String((item.summary || []).join("")).length
      + String((item.content || []).join("")).length;
  }, 0);
  const visibleCount = items.filter((item) => item && !isReasoningItem(item)).length;
  return [turn.id, statusText(turn.status), visibleCount, last && !isReasoningItem(last) ? last.id : "", turn.completedAt || "", turn.durationMs || "", bodySize].join("|");
}

async function api(path, options = {}) {
  const headers = Object.assign({}, options.headers || {});
  const timeoutMs = options.timeoutMs || 30000;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const externalSignal = options.signal;
  const abortFromExternal = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener("abort", abortFromExternal, { once: true });
  }
  const fetchOptions = Object.assign({}, options, { headers, signal: controller.signal });
  delete fetchOptions.timeoutMs;
  if (state.key) headers["X-Codex-Mobile-Key"] = state.key;
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (options.body && !isFormData && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  try {
    const res = await fetch(path, fetchOptions);
    if (res.status === 401) {
      showLogin();
      throw new Error("Unauthorized");
    }
    if (!res.ok) {
      let message = `${res.status} ${res.statusText}`;
      try {
        const body = await res.json();
        if (body.error) message = body.error;
      } catch (_) {}
      throw new Error(message);
    }
    if (res.status === 204) return null;
    return res.json();
  } catch (err) {
    if (err.name === "AbortError") {
      if (timedOut) throw new Error(`Request timed out: ${path}`);
      throw new Error(`Request cancelled: ${path}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
    if (externalSignal) externalSignal.removeEventListener("abort", abortFromExternal);
  }
}

function showLogin(message = "") {
  $("app").classList.add("hidden");
  $("login").classList.remove("hidden");
  $("loginError").textContent = message;
}

function showApp() {
  $("login").classList.add("hidden");
  $("app").classList.remove("hidden");
  updateComposerHeightVar();
}

async function login(key) {
  await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  }).then(async (res) => {
    if (!res.ok) throw new Error("Access key is not valid");
  });
  state.key = key;
  localStorage.setItem("codexMobileKey", key);
  showApp();
  await bootstrap();
}

async function bootstrap() {
  const status = await api("/api/status").catch((err) => {
    $("connectionState").textContent = err.message;
    $("connectionState").classList.add("error");
    return null;
  });
  if (status) updateConnectionState(status);
  if (status && status.rateLimits) {
    state.rateLimits = status.rateLimits;
    renderQuotaUsage();
  }
  await loadWorkspaces();
  await loadThreads();
  await restoreThreadSelection();
  connectEvents();
}

async function loadWorkspaces() {
  const result = await api("/api/workspaces");
  state.workspaces = result.data || [];
  const select = $("workspaceSelect");
  select.innerHTML = `<option value="">All workspaces</option>` + state.workspaces.map((ws) => {
    const count = ws.recentThreadCount ? ` (${ws.recentThreadCount})` : "";
    return `<option value="${escapeHtml(ws.cwd)}">${escapeHtml(`${ws.label}${count} - ${ws.cwd}`)}</option>`;
  }).join("");
  if (state.selectedCwd && !state.workspaces.some((ws) => normalizeFsPath(ws.cwd) === normalizeFsPath(state.selectedCwd))) {
    state.selectedCwd = "";
  }
  if (state.selectedCwd) select.value = state.selectedCwd;
  updateWorkspacePath();
  if (!state.currentThread) renderCurrentThread();
}

function updateWorkspacePath() {
  const el = $("workspacePath");
  if (!el) return;
  el.textContent = state.selectedCwd || "All workspaces";
}

function clearCurrentThreadSelection() {
  state.threadLoadSeq += 1;
  if (state.threadLoadController) {
    state.threadLoadController.abort();
    state.threadLoadController = null;
  }
  clearTimeout(state.refreshTimer);
  clearTimeout(state.pollTimer);
  state.pollStableCount = 0;
  state.currentThread = null;
  state.currentThreadId = "";
  state.activeTurnId = "";
  state.leavingItems.clear();
  localStorage.removeItem(STORAGE_THREAD_ID);
  syncActiveTurnFromThread();
}

function renderThreadListLoading() {
  const list = $("threadList");
  if (!list) return;
  list.innerHTML = `<div class="empty-state">Loading threads...</div>`;
  state.renderedThreadListSignature = `loading|${state.selectedCwd}|${$("threadSearch").value.trim()}`;
}

async function loadThreads() {
  const seq = state.threadListLoadSeq + 1;
  state.threadListLoadSeq = seq;
  if (state.threadListLoadController) state.threadListLoadController.abort();
  const controller = new AbortController();
  state.threadListLoadController = controller;
  const params = new URLSearchParams({ limit: "80", archived: "false" });
  if (state.selectedCwd) params.set("cwd", state.selectedCwd);
  const search = $("threadSearch").value.trim();
  if (search) params.set("search", search);
  renderThreadListLoading();
  try {
    const result = await api(`/api/threads?${params}`, { timeoutMs: 45000, signal: controller.signal });
    if (seq !== state.threadListLoadSeq) return null;
    state.threads = visibleThreads(result.data || []);
    renderThreads(result);
    $("connectionState").classList.remove("error");
    if (result.mobileFallback) $("connectionState").textContent = "Recovered from session index";
    else $("connectionState").textContent = "Connected";
    if (!state.currentThread) renderCurrentThread();
    return result;
  } catch (err) {
    if (seq !== state.threadListLoadSeq || controller.signal.aborted) return null;
    renderThreadLoadError(err);
    throw err;
  } finally {
    if (state.threadListLoadController === controller) state.threadListLoadController = null;
  }
}

async function loadThread(threadId) {
  const seq = state.threadLoadSeq + 1;
  state.threadLoadSeq = seq;
  if (state.threadLoadController) state.threadLoadController.abort();
  const controller = new AbortController();
  state.threadLoadController = controller;
  clearTimeout(state.pollTimer);
  const summary = state.threads.find((thread) => thread.id === threadId);
  state.currentThreadId = threadId;
  state.currentThread = summary ? Object.assign({ turns: [], mobileLoading: true }, summary) : {
    id: threadId,
    name: threadId,
    preview: threadId,
    turns: [],
    mobileLoading: true,
  };
  renderComposerSettings();
  syncActiveTurnFromThread();
  renderThreads();
  renderCurrentThread({ stickToBottom: true });
  updateComposerControls();
  $("connectionState").classList.remove("error");
  $("connectionState").textContent = "Loading thread";
  let result;
  try {
    result = await api(`/api/threads/${encodeURIComponent(threadId)}`, {
      timeoutMs: 20000,
      signal: controller.signal,
    });
  } catch (err) {
    if (seq !== state.threadLoadSeq || controller.signal.aborted) return;
    state.currentThread = Object.assign({}, state.currentThread || { id: threadId, name: threadId, preview: threadId, turns: [] }, {
      mobileLoading: false,
      mobileLoadError: err.message || String(err),
    });
    syncActiveTurnFromThread();
    renderThreads();
    renderCurrentThread();
    updateComposerControls();
    throw err;
  } finally {
    if (state.threadLoadController === controller) state.threadLoadController = null;
  }
  if (seq !== state.threadLoadSeq || state.currentThreadId !== threadId) return;
  state.currentThread = mergeThreadPreservingVisibleItems(state.currentThread, result.thread);
  localStorage.setItem(STORAGE_THREAD_ID, threadId);
  renderComposerSettings();
  syncActiveTurnFromThread();
  renderThreads();
  renderCurrentThread({ stickToBottom: true });
  $("connectionState").classList.remove("error");
  $("connectionState").textContent = "Connected";
  scheduleLivePollIfNeeded(1200);
  updateComposerControls();
  if (window.matchMedia("(max-width: 760px)").matches) $("sidebar").classList.remove("open");
}

async function refreshCurrentThread() {
  if (!state.currentThreadId) return;
  const threadId = state.currentThreadId;
  const seq = state.threadLoadSeq;
  const result = await api(`/api/threads/${encodeURIComponent(threadId)}`, { timeoutMs: 20000 });
  if (state.currentThreadId !== threadId || seq !== state.threadLoadSeq) return;
  state.currentThread = mergeThreadPreservingVisibleItems(state.currentThread, result.thread);
  renderComposerSettings();
  syncActiveTurnFromThread();
  renderThreads();
  renderCurrentThread();
  scheduleLivePollIfNeeded();
}

function scheduleCurrentThreadRefresh(delay = 600) {
  clearTimeout(state.refreshTimer);
  state.refreshTimer = setTimeout(() => {
    refreshCurrentThread().catch(showError);
  }, delay);
}

function scheduleLivePollIfNeeded(delay = 2600) {
  clearTimeout(state.pollTimer);
  if (!shouldPollCurrentThread()) return;
  const signature = threadSignature();
  if (signature === state.lastThreadSignature) state.pollStableCount += 1;
  else state.pollStableCount = 0;
  state.lastThreadSignature = signature;
  const nextDelay = state.pollStableCount > 60 ? 10000 : delay;
  state.pollTimer = setTimeout(() => {
    refreshCurrentThread().catch(showError);
  }, nextDelay);
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
  const warning = result && result.mobileFallback
    ? `<div class="history-note">Live thread list recovering. Showing cached session index.</div>`
    : "";
  const html = warning + state.threads.map((thread) => {
    const title = thread.name || thread.preview || thread.id;
    const meta = `${shortPath(thread.cwd)} | ${formatTime(thread.updatedAt)} | ${statusText(thread.status)}`;
    const active = thread.id === state.currentThreadId ? " active" : "";
    return `<button class="thread-card${active}" type="button" data-thread="${escapeHtml(thread.id)}">
      <div class="thread-card-title">${escapeHtml(title)}</div>
      <div class="thread-card-meta">${escapeHtml(meta)}</div>
    </button>`;
  }).join("");
  const signature = JSON.stringify({
    warning: Boolean(warning),
    currentThreadId: state.currentThreadId,
    threads: state.threads.map((thread) => [
      thread.id,
      thread.name || thread.preview || thread.id,
      shortPath(thread.cwd),
      thread.updatedAt,
      statusText(thread.status),
    ]),
  });
  if (state.renderedThreadListSignature === signature) return;
  list.innerHTML = html;
  state.renderedThreadListSignature = signature;
  list.querySelectorAll("[data-thread]").forEach((button) => {
    button.addEventListener("click", () => loadThread(button.dataset.thread).catch(showError));
  });
}

async function restoreThreadSelection() {
  if (state.currentThread || !state.threads.length) return;
  const savedThreadId = localStorage.getItem(STORAGE_THREAD_ID) || "";
  const saved = savedThreadId && state.threads.find((thread) => thread.id === savedThreadId);
  const active = state.threads.find((thread) => isRunningStatus(thread.status));
  const target = saved || active;
  if (!target) return;
  try {
    await loadThread(target.id);
  } catch (err) {
    if (target.id === savedThreadId) localStorage.removeItem(STORAGE_THREAD_ID);
    showError(err);
    renderCurrentThread();
  }
}

async function selectWorkspaceShortcut(cwd) {
  state.selectedCwd = cwd || "";
  clearCurrentThreadSelection();
  const select = $("workspaceSelect");
  if (select) select.value = state.selectedCwd;
  updateWorkspacePath();
  updateComposerControls();
  renderCurrentThread();
  await loadThreads();
}

function renderKeyForNode(node) {
  return node && node.nodeType === Node.ELEMENT_NODE ? node.getAttribute("data-render-key") || "" : "";
}

function canPatchNode(target, source) {
  if (!target || !source || target.nodeType !== source.nodeType) return false;
  if (target.nodeType !== Node.ELEMENT_NODE) return true;
  return target.tagName === source.tagName;
}

function syncAttributes(target, source) {
  const sourceNames = new Set(Array.from(source.attributes).map((attr) => attr.name));
  for (const attr of Array.from(target.attributes)) {
    if (!sourceNames.has(attr.name)) target.removeAttribute(attr.name);
  }
  for (const attr of Array.from(source.attributes)) {
    if (target.getAttribute(attr.name) !== attr.value) target.setAttribute(attr.name, attr.value);
  }
}

function patchNode(target, source) {
  if (!canPatchNode(target, source)) {
    const replacement = source.cloneNode(true);
    target.replaceWith(replacement);
    return replacement;
  }
  if (target.nodeType === Node.TEXT_NODE || target.nodeType === Node.COMMENT_NODE) {
    if (target.nodeValue !== source.nodeValue) target.nodeValue = source.nodeValue;
    return target;
  }
  syncAttributes(target, source);
  patchChildNodes(target, source);
  return target;
}

function patchChildNodes(target, source) {
  const sourceChildren = Array.from(source.childNodes);
  const targetChildren = Array.from(target.childNodes);
  const keyedTargets = new Map();
  for (const child of targetChildren) {
    const key = renderKeyForNode(child);
    if (key && !keyedTargets.has(key)) keyedTargets.set(key, child);
  }

  const used = new Set();
  let cursor = target.firstChild;
  for (const sourceChild of sourceChildren) {
    const key = renderKeyForNode(sourceChild);
    let targetChild = key ? keyedTargets.get(key) : null;
    if (targetChild && used.has(targetChild)) targetChild = null;
    if (!targetChild && cursor && !renderKeyForNode(cursor) && canPatchNode(cursor, sourceChild)) {
      targetChild = cursor;
    }

    if (targetChild) {
      const patched = patchNode(targetChild, sourceChild);
      used.add(patched);
      if (patched !== cursor) target.insertBefore(patched, cursor);
      cursor = patched.nextSibling;
      continue;
    }

    const inserted = sourceChild.cloneNode(true);
    target.insertBefore(inserted, cursor);
    used.add(inserted);
  }

  for (const child of Array.from(target.childNodes)) {
    if (!used.has(child)) child.remove();
  }
}

function patchHtml(target, html) {
  const template = document.createElement("template");
  template.innerHTML = html;
  patchChildNodes(target, template.content);
}

function updateConversationHtml(html, signature, options = {}) {
  const conversation = $("conversation");
  if (state.renderedConversationSignature === signature) {
    return false;
  }
  try {
    if (conversation.childNodes.length) patchHtml(conversation, html);
    else conversation.innerHTML = html;
  } catch (err) {
    console.warn("Conversation patch failed; falling back to full render.", err);
    conversation.innerHTML = html;
  }
  state.renderedConversationSignature = signature;
  if (options.stickToBottom) scrollConversationToBottom();
  return true;
}

function renderHome() {
  clearInterval(state.tickTimer);
  state.tickTimer = null;
  updateTurnTimer();
  const selectedLabel = state.selectedCwd ? shortPath(state.selectedCwd) : "Codex Mobile";
  $("threadTitle").textContent = selectedLabel || "Codex Mobile";
  $("threadMeta").textContent = state.selectedCwd || "Recent workspaces and threads";
  const workspaces = state.workspaces.slice()
    .sort((a, b) => Number(b.active) - Number(a.active)
      || Number(b.recentThreadCount || 0) - Number(a.recentThreadCount || 0)
      || String(a.label || a.cwd).localeCompare(String(b.label || b.cwd)))
    .slice(0, 8);
  const recentThreads = visibleThreads(state.threads).slice(0, 8);
  const workspaceHtml = workspaces.length
    ? workspaces.map((ws) => {
      const active = ws.active ? "Active" : "Workspace";
      const count = Number(ws.recentThreadCount || 0);
      const countText = `${count.toLocaleString()} recent thread${count === 1 ? "" : "s"}`;
      const selected = normalizeFsPath(ws.cwd) === normalizeFsPath(state.selectedCwd) ? " selected" : "";
      return `<button class="home-shortcut${selected}" type="button" data-home-workspace="${escapeHtml(ws.cwd)}">
        <span class="home-shortcut-title">${escapeHtml(ws.label || shortPath(ws.cwd) || ws.cwd)}</span>
        <span class="home-shortcut-meta">${escapeHtml(`${active} | ${countText} | ${ws.cwd}`)}</span>
      </button>`;
    }).join("")
    : `<div class="home-empty">No recent workspaces.</div>`;
  const threadHtml = recentThreads.length
    ? recentThreads.map((thread) => {
      const title = thread.name || thread.preview || thread.id;
      const meta = `${shortPath(thread.cwd)} | ${formatTime(thread.updatedAt)} | ${statusText(thread.status)}`;
      return `<button class="home-shortcut" type="button" data-home-thread="${escapeHtml(thread.id)}">
        <span class="home-shortcut-title">${escapeHtml(title)}</span>
        <span class="home-shortcut-meta">${escapeHtml(meta)}</span>
      </button>`;
    }).join("")
    : `<div class="home-empty">No recent threads.</div>`;
  const html = `<div class="home-shortcuts">
    <section class="home-section">
      <div class="home-section-title">Workspaces</div>
      <div class="home-list">${workspaceHtml}</div>
    </section>
    <section class="home-section">
      <div class="home-section-title">Recent threads</div>
      <div class="home-list">${threadHtml}</div>
    </section>
  </div>`;
  const signature = JSON.stringify({
    view: "home",
    selectedCwd: state.selectedCwd,
    workspaces: workspaces.map((ws) => [ws.cwd, ws.label, ws.active, ws.recentThreadCount]),
    threads: recentThreads.map((thread) => [thread.id, thread.name, thread.preview, thread.cwd, thread.updatedAt, statusText(thread.status)]),
  });
  if (!updateConversationHtml(html, signature)) return;
  $("conversation").querySelectorAll("[data-home-workspace]").forEach((button) => {
    button.addEventListener("click", () => selectWorkspaceShortcut(button.dataset.homeWorkspace).catch(showError));
  });
  $("conversation").querySelectorAll("[data-home-thread]").forEach((button) => {
    button.addEventListener("click", () => loadThread(button.dataset.homeThread).catch(showError));
  });
}

function renderThreadLoadError(err) {
  const list = $("threadList");
  list.innerHTML = `<div class="empty-state">
    <div>Thread list failed: ${escapeHtml(err.message || String(err))}</div>
    <button id="retryThreads" class="retry-button" type="button">Retry</button>
  </div>`;
  state.renderedThreadListSignature = `error|${err.message || String(err)}`;
  const retry = $("retryThreads");
  if (retry) retry.addEventListener("click", () => loadThreads().catch(showError));
}

function renderCurrentThread(options = {}) {
  state.nowMs = Date.now();
  const thread = state.currentThread;
  if (!thread) {
    renderHome();
    return;
  }
  const shouldStickToBottom = options.stickToBottom === true || isConversationNearBottom();
  const previousKeys = existingConversationRenderKeys();
  cleanupLeavingItems();
  const titleEl = $("threadTitle");
  const metaEl = $("threadMeta");
  if (titleEl) titleEl.textContent = thread.name || thread.preview || thread.id;
  if (metaEl) metaEl.textContent = "";
  if (thread.mobileLoading) {
    updateConversationHtml(
      `<div class="empty-state entry-animate">Loading thread...</div>`,
      conversationRenderSignature(thread),
      { stickToBottom: shouldStickToBottom },
    );
    updateTickTimer();
    return;
  }
  if (thread.mobileLoadError) {
    updateConversationHtml(
      `<div class="empty-state entry-animate">
        <div>Thread failed: ${escapeHtml(thread.mobileLoadError)}</div>
        <button id="retryCurrentThread" class="retry-button" type="button">Retry</button>
      </div>`,
      conversationRenderSignature(thread),
      { stickToBottom: shouldStickToBottom },
    );
    const retry = $("retryCurrentThread");
    if (retry) retry.onclick = () => loadThread(thread.id || state.currentThreadId).catch(showError);
    updateTickTimer();
    return;
  }
  const turns = (thread.turns || []).slice(-MAX_VISIBLE_TURNS);
  const omitted = Number(thread.mobileOmittedTurnCount || 0) + Math.max(0, (thread.turns || []).length - turns.length);
  const omittedKey = `history|${state.currentThreadId}|${omitted}`;
  const omittedBanner = omitted > 0
    ? `<div class="history-note${entryAnimationClass(omittedKey, previousKeys)}" data-render-key="${escapeHtml(omittedKey)}">Older history hidden on mobile: ${omitted.toLocaleString()} turn(s)</div>`
    : "";
  const turnsHtml = turns.map((turn) => renderTurn(turn, previousKeys)).join("");
  const approvalsHtml = renderPendingApprovals(thread, previousKeys);
  const html = omittedBanner + (turnsHtml || approvalsHtml ? `${turnsHtml}${approvalsHtml}` : `<div class="empty-state entry-animate">No visible turns.</div>`);
  updateConversationHtml(html, conversationRenderSignature(thread), { stickToBottom: shouldStickToBottom });
  updateTickTimer();
}

function approvalTitle(method) {
  const titles = {
    "item/commandExecution/requestApproval": "Command approval",
    "execCommandApproval": "Command approval",
    "item/fileChange/requestApproval": "File change approval",
    "applyPatchApproval": "File change approval",
    "item/permissions/requestApproval": "Permission approval",
    "item/tool/requestUserInput": "User input required",
    "mcpServer/elicitation/request": "MCP input required",
    "item/tool/call": "Tool request",
    "account/chatgptAuthTokens/refresh": "Account authorization",
  };
  return titles[method] || "Approval request";
}

function approvalStatusLabel(status) {
  const text = String(status || "waiting");
  if (text === "responding") return "Sending";
  if (text === "responded" || text === "resolved") return "Answered";
  if (text === "connectionClosed") return "Closed";
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
  return [
    params.reason ? `Reason: ${params.reason}` : "",
    params.command ? `Command:\n${params.command}` : "",
    params.cwd ? `Working directory:\n${params.cwd}` : "",
    params.grantRoot ? `Grant root:\n${params.grantRoot}` : "",
    Array.isArray(params.fileNames) && params.fileNames.length ? `Files:\n${params.fileNames.join("\n")}` : "",
    params.permissions ? `Permissions:\n${permissionSummary(params.permissions) || JSON.stringify(params.permissions, null, 2)}` : "",
    params.networkApprovalContext ? `Network:\n${JSON.stringify(params.networkApprovalContext, null, 2)}` : "",
  ].filter(Boolean);
}

function renderApprovalActions(request) {
  const waiting = request.status === "waiting";
  if (!request.actionable || !waiting) {
    return "";
  }
  return `<div class="approval-actions">
    <button class="approval-button allow" type="button" data-approval-id="${escapeHtml(request.id)}" data-approval-action="allow_once">Allow once</button>
    <button class="approval-button allow" type="button" data-approval-id="${escapeHtml(request.id)}" data-approval-action="allow_session">Allow session</button>
    <button class="approval-button deny" type="button" data-approval-id="${escapeHtml(request.id)}" data-approval-action="deny">Deny</button>
  </div>`;
}

function renderPendingApprovals(thread, previousKeys = new Set()) {
  const threadId = thread && (thread.id || state.currentThreadId);
  const requests = pendingApprovalsForThread(threadId);
  if (!requests.length) return "";
  return `<div class="approval-stack">
    ${requests.map((request) => {
      const key = `approval|${request.id}`;
      const detail = approvalDetailLines(request).join("\n");
      return `<section class="approval-card${entryAnimationClass(key, previousKeys)} ${escapeHtml(request.status || "waiting")}" data-render-key="${escapeHtml(key)}" data-approval-card="${escapeHtml(request.id)}">
        <div class="approval-head">
          <div>
            <div class="approval-title">${escapeHtml(approvalTitle(request.method))}</div>
            <div class="approval-method">${escapeHtml(request.method)}</div>
          </div>
          <span class="approval-status">${escapeHtml(approvalStatusLabel(request.status))}</span>
        </div>
        ${detail ? `<pre class="approval-detail">${escapeHtml(detail)}</pre>` : ""}
        ${renderApprovalActions(request)}
      </section>`;
    }).join("")}
  </div>`;
}

function renderTurn(turn, previousKeys = new Set()) {
  const renderedItems = visibleItemsForTurn(turn).map((entry, index) => {
    const item = entry.item;
    const sourceIndex = Number.isInteger(entry.sourceIndex) && entry.sourceIndex >= 0 ? entry.sourceIndex : index;
    let html = "";
    if (isContextCompactionItem(item)) html = renderContextCompaction(item, turn, previousKeys, sourceIndex);
    else if (isOperationalItem(item)) html = renderLiveOperation(item, turn, previousKeys, sourceIndex);
    else if (item.type === "reasoning" && isLiveTurn(turn)) html = "";
    else html = renderItem(item, turn, previousKeys, sourceIndex);
    return { html, sourceIndex, order: 1 };
  }).filter((entry) => entry && entry.html);
  const items = renderedItems
    .concat(leavingItemsForTurn(turn))
    .sort((a, b) => (a.sourceIndex - b.sourceIndex) || (a.order - b.order))
    .map((entry) => entry.html)
    .join("");
  if (!items.trim()) return "";
  const turnKey = stableTurnKey(turn);
  const statusKey = stableTurnKey(turn, "status");
  const duration = turn.durationMs ? ` | ${formatElapsedTime(Math.round(turn.durationMs / 1000))}` : "";
  const timerShowsStatus = isLatestTurn(turn) && (isLiveTurn(turn) || turnFinalSeconds(turn) != null);
  const showStatusLine = !timerShowsStatus;
  return `<article class="turn" data-turn="${escapeHtml(turn.id)}" data-render-key="${escapeHtml(turnKey)}">
    ${items}
    ${showStatusLine ? `<div class="turn-status${entryAnimationClass(statusKey, previousKeys)}" data-render-key="${escapeHtml(statusKey)}">${escapeHtml(displayTurnStatus(turn))}${duration}</div>` : ""}
  </article>`;
}

function renderLiveOperation(item, turn, previousKeys = new Set(), index = 0) {
  const operation = latestVisibleOperationItem(turn);
  if (!operation || operation.item !== item) return "";
  const lines = operationSummaryLines(item);
  const body = lines.length ? `<div class="operation-body">${escapeHtml(lines.join("\n"))}</div>` : "";
  const status = statusText(item.status) || (item.completedAtMs ? "completed" : "running");
  const title = operationTitle(item, status);
  const key = stableTurnKey(turn, "live-operation");
  return `<section class="item live-operation ${isCompletedStatus(status) ? "completed" : ""} ${escapeHtml(item.type || "item")}" data-item="${escapeHtml(item.id || "")}" data-render-key="${escapeHtml(key)}">
    <div class="item-head"><span>${escapeHtml(title)}</span><span>${escapeHtml(status)}</span></div>
    ${body}
  </section>`;
}

function operationTitle(item, status) {
  const label = labelForItem(item);
  if (isCompletedStatus(status)) return `${label} Completed`;
  return label;
}

function truncateSingleLine(value, maxChars = 96) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 1))}...`;
}

function operationFileNames(item) {
  const values = Array.isArray(item.fileNames) && item.fileNames.length
    ? item.fileNames
    : collectFileNames(item.changes || item.arguments || item.result || item.contentItems);
  return [...new Set(values.map((name) => truncateSingleLine(shortPath(name), 72)).filter(Boolean))].slice(0, 5);
}

function collectSearchSummaries(value, out = [], keyHint = "") {
  if (out.length >= 3 || value == null) return out;
  const keyLooksSearch = /^(q|query|searchQuery|url|pattern)$/i.test(keyHint);
  const keyLooksQueryList = /^queries$/i.test(keyHint);
  if (typeof value === "string") {
    const text = value.replace(/\s+/g, " ").trim();
    if ((keyLooksSearch || keyLooksQueryList) && text) out.push(text);
    return out;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectSearchSummaries(entry, out, keyLooksQueryList ? "query" : keyHint);
      if (out.length >= 3) return out;
    }
    return out;
  }
  if (typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      collectSearchSummaries(entry, out, key);
      if (out.length >= 3) return out;
    }
  }
  return out;
}

function operationSearchSummary(item) {
  return [...new Set(collectSearchSummaries(item && (item.action || item.arguments || item.result || item.contentItems || item)))]
    .slice(0, 3)
    .join(" | ");
}

function operationSummaryLines(item) {
  if (item.type === "fileChange") {
    const names = operationFileNames(item);
    return names.length ? [names.join(", ")] : [];
  }
  if (item.command) return [truncateMiddle(item.command, 180, "command")];
  const searchSummary = isWebSearchLikeItem(item) ? operationSearchSummary(item) : "";
  if (searchSummary) return [truncateMiddle(searchSummary, 180, "search")];
  const names = operationFileNames(item);
  if (names.length) return [names.join(", ")];
  if (item.tool) return [item.tool];
  return [];
}

function displayTurnStatus(turn) {
  if (isIncompleteInterruptedTurn(turn)) return "syncing";
  return statusText(turn.status);
}

function renderContextCompaction(item, turn = null, previousKeys = new Set(), index = 0) {
  const key = stableItemKey(turn, item, index, "context");
  const fallbackNotice = "\u5386\u53f2\u4e0a\u4e0b\u6587\u5df2\u538b\u7f29";
  return `<div class="context-compaction-note${entryAnimationClass(key, previousKeys)}" data-item="${escapeHtml(item.id || "")}" data-render-key="${escapeHtml(key)}">${escapeHtml(item.mobileNotice || fallbackNotice)}</div>`;
}

function renderItem(item, turn = null, previousKeys = new Set(), index = 0) {
  if (isContextCompactionItem(item)) return renderContextCompaction(item, turn, previousKeys, index);
  if (isLiveReasoning(item, turn)) return "";
  const type = item.type || "item";
  const key = stableItemKey(turn, item, index);
  return `<section class="item${entryAnimationClass(key, previousKeys)} ${escapeHtml(type)}" data-item="${escapeHtml(item.id || "")}" data-render-key="${escapeHtml(key)}">
    <div class="item-head"><span>${escapeHtml(labelForItem(item))}</span><span>${escapeHtml(item.status ? statusText(item.status) : "")}</span></div>
    <div class="item-body">${renderItemBody(item)}</div>
  </section>`;
}

function renderLiveReasoning(item, turn) {
  const elapsed = liveReasoningElapsed(item, turn);
  return `<section class="item live-reasoning reasoning" data-item="${escapeHtml(item.id || "")}">
    <div class="item-head"><span>Reasoning</span><span>${elapsed}s</span></div>
  </section>`;
}

function labelForItem(item) {
  if (isWebSearchLikeItem(item)) return "Web Search";
  const map = {
    userMessage: "You",
    agentMessage: "Codex",
    reasoning: "Reasoning",
    commandExecution: "Command",
    fileChange: "File Change",
    mcpToolCall: `MCP ${item.server || ""}.${item.tool || ""}`,
    dynamicToolCall: `${item.namespace ? item.namespace + "." : ""}${item.tool || "Tool"}`,
    plan: "Plan",
    contextCompaction: "Context",
  };
  return map[item.type] || item.type || "Item";
}

function isInputImagePart(part) {
  if (!part || typeof part !== "object") return false;
  const type = String(part.type || "");
  const url = String(part.url || part.image_url || "");
  return type === "image" || type === "localImage" || /^data:image\//i.test(url);
}

function splitAttachmentSummaryText(text) {
  const source = String(text || "");
  const marker = "Uploaded attachments:\n";
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) return { text: source, attachments: [] };
  const before = source.slice(0, markerIndex).trimEnd();
  const lines = source.slice(markerIndex + marker.length)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return { text: before, attachments: lines.map(parseAttachmentLine).filter(Boolean) };
}

function parseAttachmentLine(line) {
  const match = /^-\s*(.*?)\s*\((.*?)\):\s*(.+)$/.exec(String(line || ""));
  if (!match) return null;
  const meta = match[2] || "";
  return {
    name: match[1] || "attachment",
    meta,
    path: match[3] || "",
    isImage: /\bimage\b/i.test(meta),
  };
}

function uploadFileUrl(filePath) {
  const params = new URLSearchParams({ path: filePath });
  if (state.key) params.set("key", state.key);
  return `/api/uploads/file?${params.toString()}`;
}

function imageSourceForPart(part, attachment = null) {
  if (attachment && attachment.path) return uploadFileUrl(attachment.path);
  if (part.path) return uploadFileUrl(part.path);
  const url = String(part.url || part.image_url || "");
  return url || "";
}

function renderInputText(text) {
  if (!String(text || "").trim()) return "";
  return `<div class="input-text">${escapeHtml(text)}</div>`;
}

function renderInputImage(part, attachment = null, index = 0) {
  const src = imageSourceForPart(part, attachment);
  const label = (attachment && attachment.name) || shortPath(part.path || part.url || "") || `Image ${index + 1}`;
  if (!src) return `<div class="input-attachment">${escapeHtml(label)}</div>`;
  return `<figure class="input-image">
    <img src="${escapeHtml(src)}" alt="${escapeHtml(label)}" loading="lazy">
    <figcaption>${escapeHtml(label)}</figcaption>
  </figure>`;
}

function renderInputAttachment(attachment) {
  const label = attachment.name || shortPath(attachment.path) || "attachment";
  const meta = attachment.meta ? ` (${attachment.meta})` : "";
  return `<div class="input-attachment">
    <span>${escapeHtml(label)}</span>
    <span>${escapeHtml(meta)}</span>
    ${attachment.path ? `<code>${escapeHtml(attachment.path)}</code>` : ""}
  </div>`;
}

function renderInputContent(content) {
  const parts = content || [];
  const imageParts = parts.filter(isInputImagePart);
  const attachments = [];
  const html = [];
  for (const part of parts) {
    if (!part || isInputImagePart(part)) continue;
    if (part.type === "text") {
      const split = splitAttachmentSummaryText(part.text || "");
      if (split.text) html.push(renderInputText(split.text));
      attachments.push(...split.attachments);
      continue;
    }
    html.push(`<div class="input-text">${escapeHtml(compactStructuredForSignature(part))}</div>`);
  }
  const imageAttachments = attachments.filter((attachment) => attachment.isImage);
  imageParts.forEach((part, index) => {
    html.push(renderInputImage(part, imageAttachments[index] || null, index));
  });
  attachments
    .filter((attachment) => !attachment.isImage || !imageParts.length)
    .forEach((attachment) => html.push(renderInputAttachment(attachment)));
  return html.join("");
}

function isMarkdownTableSeparator(line) {
  const cells = String(line || "").trim().replace(/^\||\|$/g, "").split("|");
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function splitMarkdownTableRow(line) {
  return String(line || "")
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isMarkdownBlockStart(line, nextLine = "") {
  return /^```/.test(line)
    || /^(#{1,6})\s+\S/.test(line)
    || /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line)
    || /^>\s?/.test(line)
    || /^\s*[-*+]\s+\S/.test(line)
    || /^\s*\d+[.)]\s+\S/.test(line)
    || (line.includes("|") && isMarkdownTableSeparator(nextLine));
}

function safeMarkdownUrl(value) {
  const url = String(value || "").trim();
  if (/^(https?:|mailto:)/i.test(url)) return url;
  return "";
}

function renderInlineMarkdown(value) {
  const placeholders = [];
  const tokenPrefix = "MDTOKEN";
  let text = String(value || "").replace(/`([^`\n]+)`/g, (_match, code) => {
    const token = `${tokenPrefix}${placeholders.length}END`;
    placeholders.push(`<code>${escapeHtml(code)}</code>`);
    return token;
  });

  text = escapeHtml(text);
  text = text.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (match, label, url) => {
    const safeUrl = safeMarkdownUrl(url.replaceAll("&amp;", "&"));
    if (!safeUrl) return match;
    return `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noreferrer">${label}</a>`;
  });
  text = text
    .replace(/\*\*([^*\n][^*\n]*?)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_\n][^_\n]*?)__/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\n][^*\n]*?)\*/g, "$1<em>$2</em>")
    .replace(/(^|[\s(])_([^_\n][^_\n]*?)_/g, "$1<em>$2</em>");

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

function renderMarkdownList(lines, ordered) {
  const tag = ordered ? "ol" : "ul";
  const itemPattern = ordered ? /^\s*\d+[.)]\s+(.+)$/ : /^\s*[-*+]\s+(.+)$/;
  const items = lines.map((line) => {
    const match = itemPattern.exec(line);
    const text = match ? match[1] : line.trim();
    return `<li>${renderInlineMarkdown(text)}</li>`;
  });
  return `<${tag}>${items.join("")}</${tag}>`;
}

function renderMarkdown(value) {
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
      const langLabel = lang ? `<div class="markdown-code-lang">${escapeHtml(lang)}</div>` : "";
      blocks.push(`<div class="markdown-code-block">${langLabel}<pre><code>${escapeHtml(code.join("\n"))}</code></pre></div>`);
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
      blocks.push(`<blockquote>${renderMarkdown(quote.join("\n"))}</blockquote>`);
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
      blocks.push(renderMarkdownList(list, false));
      continue;
    }

    if (/^\s*\d+[.)]\s+\S/.test(line)) {
      const list = [];
      while (i < lines.length && /^\s*\d+[.)]\s+\S/.test(lines[i])) {
        list.push(lines[i]);
        i += 1;
      }
      blocks.push(renderMarkdownList(list, true));
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

function renderItemBody(item) {
  if (isContextCompactionItem(item)) return escapeHtml(item.mobileNotice || "历史上下文已压缩");
  if (item.type === "userMessage") return renderInputContent(item.content);
  if (item.type === "agentMessage") return renderMarkdown(item.text || "");
  if (item.type === "reasoning") {
    const summary = (item.summary || []).join("\n");
    const content = (item.content || []).join("\n");
    return escapeHtml([summary, content].filter(Boolean).join("\n\n"));
  }
  if (item.type === "plan") return renderMarkdown(item.text || "");
  if (item.type === "commandExecution") {
    return `<div class="mono">${escapeHtml(item.command || "")}</div>${renderOutputBlock(item.aggregatedOutput, item)}`;
  }
  if (item.type === "fileChange") {
    return renderStructuredBlock(item.changes || [], `${Array.isArray(item.changes) ? item.changes.length : 0} change(s)`);
  }
  if (item.type === "dynamicToolCall" || item.type === "mcpToolCall") {
    return `<div class="mono">${escapeHtml(JSON.stringify(item.arguments || {}, null, 2))}</div>${renderStructuredBlock(item.result || item.contentItems, "Tool result")}`;
  }
  return escapeHtml(JSON.stringify(item, null, 2));
}

function renderOutputBlock(output, item = {}) {
  if (!output && item.outputOmitted) {
    const total = item.outputTotalChars || 0;
    return `<details class="output-details">
      <summary>${escapeHtml(`Output omitted from mobile view: ${Number(total).toLocaleString()} chars`)}</summary>
      <pre>${escapeHtml("This command output is still in the Codex session history. It is omitted here to keep the mobile client responsive.")}</pre>
    </details>`;
  }
  if (!output) return "";
  const total = item.outputTotalChars || String(output).length;
  const truncated = item.outputTruncated || total > String(output).length;
  const summary = truncated
    ? `Output preview: ${total.toLocaleString()} chars total, showing latest ${String(output).length.toLocaleString()}`
    : `Output: ${String(output).length.toLocaleString()} chars`;
  return `<details class="output-details">
    <summary>${escapeHtml(summary)}</summary>
    <pre>${escapeHtml(output)}</pre>
  </details>`;
}

function renderStructuredBlock(value, label) {
  if (!value) return "";
  if (value.truncated && value.preview) {
    return `<details class="output-details">
      <summary>${escapeHtml(`${label}: ${Number(value.totalChars || 0).toLocaleString()} chars total, preview`)}</summary>
      <pre>${escapeHtml(value.preview)}</pre>
    </details>`;
  }
  const raw = JSON.stringify(value, null, 2);
  if (!raw || raw === "null") return "";
  return `<details class="output-details">
    <summary>${escapeHtml(`${label}: ${raw.length.toLocaleString()} chars`)}</summary>
    <pre>${escapeHtml(raw)}</pre>
  </details>`;
}

function ensureTurn(turnId) {
  const thread = state.currentThread;
  if (!thread) return null;
  thread.turns = thread.turns || [];
  let turn = thread.turns.find((x) => x.id === turnId);
  if (!turn) {
    turn = { id: turnId, items: [], status: { type: "running" }, error: null, startedAt: Math.floor(Date.now() / 1000), completedAt: null, durationMs: null };
    thread.turns.push(turn);
  }
  return turn;
}

function upsertItem(turnId, item) {
  const turn = ensureTurn(turnId);
  if (!turn || !item || !item.id) return;
  if (isReasoningItem(item)) {
    updateTickTimer();
    return;
  }
  turn.items = turn.items || [];
  if (isOperationalItem(item)) {
    turn.items.forEach((existing, existingIndex) => {
      if (isOperationalItem(existing) && existing.id !== item.id) {
        if (hasVisibleNonOperationAfterIndex(turn, existingIndex)) {
          rememberLeavingOperation(turn, existing, existingIndex, {
            keepUntilOutOfView: true,
            onlyIfInViewport: true,
          });
        }
      }
    });
    turn.items = turn.items.filter((existing) => !isOperationalItem(existing) || existing.id === item.id);
  }
  const index = turn.items.findIndex((x) => x.id === item.id);
  if (index >= 0 && !item.startedAtMs && turn.items[index].startedAtMs) item.startedAtMs = turn.items[index].startedAtMs;
  if (item.type === "reasoning" && !item.startedAtMs) item.startedAtMs = Date.now();
  if (isOperationalItem(item) && isCompletedStatus(item.status) && !item.completedAtMs) item.completedAtMs = Date.now();
  if (index >= 0) turn.items[index] = item;
  else turn.items.push(item);
  scheduleRenderCurrentThread();
}

function removeItem(turnId, itemId) {
  const turn = ensureTurn(turnId);
  if (!turn || !itemId) return;
  turn.items = (turn.items || []).filter((item) => item.id !== itemId);
  scheduleRenderCurrentThread();
}

function ensureTimerItem(turnId, itemId, itemType) {
  const turn = ensureTurn(turnId);
  if (!turn || !itemId) return;
  if (itemType === "reasoning") {
    updateTickTimer();
    return;
  }
  turn.items = turn.items || [];
  let item = turn.items.find((x) => x.id === itemId);
  if (!item) {
    item = { id: itemId, type: itemType, startedAtMs: Date.now() };
    turn.items.push(item);
  }
  if (!item.startedAtMs) item.startedAtMs = Date.now();
  scheduleRenderCurrentThread();
}

function appendToItem(turnId, itemId, itemType, field, delta, index = 0) {
  const turn = ensureTurn(turnId);
  if (!turn) return;
  if (itemType === "reasoning") {
    updateTickTimer();
    return;
  }
  let item = (turn.items || []).find((x) => x.id === itemId);
  if (!item) {
    item = { id: itemId, type: itemType };
    if (itemType === "reasoning") item.startedAtMs = Date.now();
    turn.items.push(item);
  }
  if (field === "aggregatedOutput") {
    appendCommandOutput(item, delta);
  } else if (Array.isArray(item[field])) {
    item[field][index] = (item[field][index] || "") + delta;
  } else {
    item[field] = compactLiveText((item[field] || "") + delta);
  }
  scheduleRenderCurrentThread();
}

function scheduleRenderCurrentThread() {
  if (state.renderFrame || state.renderScheduled) return;
  state.renderScheduled = true;
  const render = () => {
    state.renderFrame = null;
    state.renderScheduled = false;
    renderCurrentThread();
  };
  if (window.requestAnimationFrame) {
    state.renderFrame = window.requestAnimationFrame(render);
  } else {
    state.renderFrame = setTimeout(render, 33);
  }
}

function upsertServerRequest(request) {
  if (!request || !request.id) return;
  state.pendingApprovals.set(String(request.id), Object.assign({}, state.pendingApprovals.get(String(request.id)) || {}, request));
  if (state.currentThread && approvalThreadId(request) === state.currentThread.id) scheduleRenderCurrentThread();
}

function resolveServerRequest(payload) {
  const requestId = String(payload && payload.requestId || "");
  if (!requestId) return;
  const existing = state.pendingApprovals.get(requestId);
  let next = existing || null;
  if (payload.request) {
    next = Object.assign({}, existing || {}, payload.request);
    state.pendingApprovals.set(requestId, next);
  } else if (existing) {
    existing.status = payload.status || "resolved";
    next = existing;
  }
  if (state.currentThread && next && approvalThreadId(next) === state.currentThread.id) scheduleRenderCurrentThread();
  setTimeout(() => {
    state.pendingApprovals.delete(requestId);
    if (state.currentThread) scheduleRenderCurrentThread();
  }, 1200);
}

function applyNotification(method, params) {
  if (!params) return;
  if (method === "account/rateLimits/updated") {
    state.rateLimits = params.rateLimits || null;
    renderQuotaUsage();
    return;
  }
  if (method === "thread/started" && params.thread) {
    if (isHiddenThread(params.thread)) {
      state.threads = state.threads.filter((thread) => thread.id !== params.thread.id);
      renderThreads();
      return;
    }
    const index = state.threads.findIndex((x) => x.id === params.thread.id);
    if (index >= 0) state.threads[index] = Object.assign({}, state.threads[index], params.thread);
    else state.threads.unshift(params.thread);
    renderThreads();
    return;
  }
  if (method === "thread/status/changed") {
    const thread = state.threads.find((x) => x.id === params.threadId);
    if (thread) thread.status = params.status;
    pruneHiddenThreads();
    if (state.currentThread && state.currentThread.id === params.threadId) {
      state.currentThread.status = params.status;
      renderCurrentThread();
      scheduleLivePollIfNeeded(1400);
    }
    renderThreads();
    return;
  }
  if (method === "thread/name/updated") {
    const thread = state.threads.find((x) => x.id === params.threadId);
    if (thread) thread.name = params.threadName;
    pruneHiddenThreads();
    if (state.currentThread && state.currentThread.id === params.threadId) {
      state.currentThread.name = params.threadName;
      renderCurrentThread();
    }
    renderThreads();
    return;
  }
  if (!state.currentThread || params.threadId !== state.currentThread.id) return;
  if (method === "turn/started") {
    state.activeTurnId = params.turn.id;
    $("interruptTurn").disabled = false;
    updateComposerControls();
    ensureTurn(params.turn.id);
    renderCurrentThread();
    scheduleLivePollIfNeeded(1200);
    return;
  }
  if (method === "turn/completed") {
    const turn = ensureTurn(params.turn.id);
    Object.assign(turn, mergeTurnPreservingVisibleItems(turn, params.turn));
    removeOperationalItemsFromTurn(turn);
    state.activeTurnId = "";
    $("interruptTurn").disabled = true;
    updateComposerControls();
    renderCurrentThread();
    scheduleCurrentThreadRefresh(700);
    scheduleLivePollIfNeeded(1400);
    return;
  }
  if (method === "item/started" || method === "item/completed") {
    upsertItem(params.turnId, params.item);
    scheduleLivePollIfNeeded(2200);
    return;
  }
  if (method === "item/agentMessage/delta") {
    appendToItem(params.turnId, params.itemId, "agentMessage", "text", params.delta || "");
    return;
  }
  if (method === "item/commandExecution/outputDelta") {
    return;
  }
  if (method === "item/fileChange/outputDelta") {
    return;
  }
  if (method === "item/reasoning/textDelta") {
    ensureTimerItem(params.turnId, params.itemId, "reasoning");
    return;
  }
  if (method === "item/reasoning/summaryTextDelta") {
    ensureTimerItem(params.turnId, params.itemId, "reasoning");
  }
}

function connectEvents() {
  if (state.events) state.events.close();
  state.events = new EventSource(`/api/events?key=${encodeURIComponent(state.key)}`);
  state.events.onmessage = (event) => {
    const payload = JSON.parse(event.data);
    if (payload.type === "status") {
      updateConnectionState(payload.status);
      if (payload.status.rateLimits) {
        state.rateLimits = payload.status.rateLimits;
        renderQuotaUsage();
      }
      if (payload.status.ready) clearTimeout(state.recoveryTimer);
      return;
    }
    if (payload.type === "notification") applyNotification(payload.method, payload.params);
    if (payload.type === "serverRequest") upsertServerRequest(payload.request);
    if (payload.type === "serverRequestResolved") resolveServerRequest(payload);
  };
  state.events.onerror = () => {
    updateConnectionState(null, "Reconnecting");
    clearTimeout(state.recoveryTimer);
    state.recoveryTimer = setTimeout(async () => {
      try {
        const status = await api("/api/status");
        updateConnectionState(status);
        if (status.rateLimits) {
          state.rateLimits = status.rateLimits;
          renderQuotaUsage();
        }
        await loadThreads();
        await refreshCurrentThread();
      } catch (err) {
        showError(err);
      }
    }, 1500);
  };
}

function ensureEventConnection() {
  if (!state.key) return;
  if (!state.events || state.events.readyState === EventSource.CLOSED) connectEvents();
}

function scheduleMobileResume(reason = "resume", delay = 80) {
  if (document.visibilityState === "hidden") return;
  clearTimeout(state.resumeTimer);
  state.resumeTimer = setTimeout(() => {
    resumeMobileSession(reason).catch(showError);
  }, delay);
}

async function resumeMobileSession(reason = "resume") {
  if (document.visibilityState === "hidden" || !state.key) return;
  showApp();
  updateComposerHeightVar();
  renderComposerSettings();
  updateComposerControls();
  if (state.currentThread || state.threads.length) renderCurrentThread();
  ensureEventConnection();
  state.pollStableCount = 0;
  const status = await api("/api/status");
  updateConnectionState(status);
  if (status.rateLimits) {
    state.rateLimits = status.rateLimits;
    renderQuotaUsage();
  }
  await loadThreads();
  if (state.currentThreadId) await refreshCurrentThread();
  else await restoreThreadSelection();
  scheduleLivePollIfNeeded(1200);
}

function scrollConversationToBottom() {
  const el = $("conversation");
  if (!el) return;
  const target = Math.max(0, el.scrollHeight - el.clientHeight);
  if (Math.abs(el.scrollTop - target) < 2) return;
  el.scrollTop = target;
}

function isConversationNearBottom() {
  const el = $("conversation");
  if (!el) return true;
  return el.scrollHeight - el.scrollTop - el.clientHeight < 96;
}

function updateComposerHeightVar() {
  const composer = $("composer");
  if (!composer) return;
  document.documentElement.style.setProperty("--composer-height", `${Math.ceil(composer.getBoundingClientRect().height)}px`);
}

function showError(err) {
  $("connectionState").textContent = err.message || String(err);
  $("connectionState").classList.add("error");
}

function autoSizeTextarea(el) {
  el.style.height = "auto";
  el.style.height = `${Math.min(160, Math.max(44, el.scrollHeight))}px`;
  updateComposerHeightVar();
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function attachmentId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function pendingAttachmentBytes(extra = []) {
  return state.pendingAttachments.reduce((total, item) => total + item.file.size, 0)
    + extra.reduce((total, file) => total + file.size, 0);
}

function addAttachmentFiles(fileList) {
  const files = Array.from(fileList || []).filter(Boolean);
  if (!files.length) return;
  const accepted = [];
  for (const file of files) {
    if (state.pendingAttachments.length + accepted.length >= state.maxUploadFiles) {
      showError(new Error(`Too many attachments; max ${state.maxUploadFiles}`));
      break;
    }
    if (pendingAttachmentBytes(accepted.concat(file)) > state.maxUploadBytes) {
      showError(new Error(`Attachments are too large; max ${formatFileSize(state.maxUploadBytes)}`));
      break;
    }
    accepted.push(file);
  }
  for (const file of accepted) {
    const previewUrl = file.type && file.type.startsWith("image/") ? URL.createObjectURL(file) : "";
    state.pendingAttachments.push({ id: attachmentId(), file, previewUrl });
  }
  renderAttachmentList();
}

function removeAttachment(id) {
  const index = state.pendingAttachments.findIndex((item) => item.id === id);
  if (index < 0) return;
  const [item] = state.pendingAttachments.splice(index, 1);
  if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
  renderAttachmentList();
}

function clearPendingAttachments() {
  for (const item of state.pendingAttachments) {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
  }
  state.pendingAttachments = [];
  renderAttachmentList();
}

function renderAttachmentList() {
  const list = $("attachmentList");
  if (!state.pendingAttachments.length) {
    list.classList.add("hidden");
    list.innerHTML = "";
    updateComposerControls();
    updateComposerHeightVar();
    return;
  }
  list.classList.remove("hidden");
  list.innerHTML = state.pendingAttachments.map((item) => {
    const file = item.file;
    const thumb = item.previewUrl
      ? `<img class="attachment-thumb" src="${escapeHtml(item.previewUrl)}" alt="">`
      : `<div class="attachment-file-icon" aria-hidden="true"></div>`;
    return `<div class="attachment-chip" data-attachment="${escapeHtml(item.id)}">
      ${thumb}
      <div class="attachment-meta">
        <div class="attachment-name">${escapeHtml(file.name || "upload")}</div>
        <div class="attachment-size">${escapeHtml(`${file.type || "file"} - ${formatFileSize(file.size)}`)}</div>
      </div>
      <button class="attachment-remove" type="button" title="Remove attachment" data-remove-attachment="${escapeHtml(item.id)}">x</button>
    </div>`;
  }).join("");
  updateComposerControls();
  updateComposerHeightVar();
}

function composerHasContent() {
  return Boolean($("messageInput").value.trim() || state.pendingAttachments.length);
}

function effectiveDefaultModel() {
  return (state.currentThread && state.currentThread.model) || state.defaultModel || "";
}

function effectiveDefaultEffort() {
  return (state.currentThread && state.currentThread.effort) || state.defaultReasoningEffort || "";
}

function renderComposerSettings() {
  const modelSelect = $("modelSelect");
  const effortSelect = $("effortSelect");
  if (!modelSelect || !effortSelect) return;
  const defaultModel = effectiveDefaultModel();
  const defaultEffort = effectiveDefaultEffort();
  const modelValues = normalizeOptionList([state.selectedModel, ...state.modelOptions])
    .filter((value) => value !== defaultModel);
  const effortValues = normalizeOptionList([state.selectedEffort, ...state.reasoningEffortOptions])
    .filter((value) => value !== defaultEffort);
  modelSelect.innerHTML = `<option value="">${escapeHtml(defaultModel ? labelForModel(defaultModel) : "Default")}</option>`
    + modelValues.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(labelForModel(value))}</option>`).join("");
  effortSelect.innerHTML = `<option value="">${escapeHtml(defaultEffort ? labelForEffort(defaultEffort) : "Default")}</option>`
    + effortValues.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(labelForEffort(value))}</option>`).join("");
  if (state.selectedModel && state.selectedModel !== defaultModel && modelValues.includes(state.selectedModel)) modelSelect.value = state.selectedModel;
  else modelSelect.value = "";
  if (state.selectedEffort && state.selectedEffort !== defaultEffort && effortValues.includes(state.selectedEffort)) effortSelect.value = state.selectedEffort;
  else effortSelect.value = "";
}

function updateComposerControls() {
  const hasThread = Boolean(state.currentThreadId
    && state.currentThread
    && !state.currentThread.mobileLoading
    && !state.currentThread.mobileLoadError);
  const disabled = !hasThread || state.composerBusy;
  const hasContent = composerHasContent();
  const interruptMode = Boolean(state.activeTurnId) && !hasContent;
  const sendButton = $("sendMessage");
  const attachButton = $("attachFiles");
  $("messageInput").disabled = disabled;
  $("fileInput").disabled = disabled;
  $("modelSelect").disabled = disabled;
  $("effortSelect").disabled = disabled;
  attachButton.classList.toggle("disabled", disabled);
  attachButton.setAttribute("aria-disabled", disabled ? "true" : "false");
  attachButton.tabIndex = disabled ? -1 : 0;
  sendButton.textContent = interruptMode ? "Stop" : "Send";
  sendButton.title = interruptMode ? "Interrupt current turn" : "Send message";
  sendButton.classList.toggle("interrupt-mode", interruptMode);
  sendButton.disabled = disabled || (!interruptMode && !hasContent);
}

function hasTransferFiles(event) {
  const types = Array.from((event.dataTransfer && event.dataTransfer.types) || []);
  return types.includes("Files");
}

async function sendMessage(event) {
  event.preventDefault();
  if (state.composerBusy) return;
  const input = $("messageInput");
  const text = input.value.trim();
  const hasContent = Boolean(text || state.pendingAttachments.length);
  if (state.activeTurnId && !hasContent) {
    await interruptActiveTurn();
    return;
  }
  if ((!text && !state.pendingAttachments.length) || !state.currentThreadId) return;
  state.composerBusy = true;
  updateComposerControls();
  try {
    const body = new FormData();
    body.append("text", text);
    if (state.currentThread && state.currentThread.cwd) body.append("cwd", state.currentThread.cwd);
    if (state.activeTurnId) body.append("activeTurnId", state.activeTurnId);
    if ($("modelSelect").value) body.append("model", $("modelSelect").value);
    if ($("effortSelect").value) body.append("effort", $("effortSelect").value);
    for (const item of state.pendingAttachments) {
      body.append("attachments", item.file, item.file.name || "upload");
    }
    await api(`/api/threads/${encodeURIComponent(state.currentThreadId)}/messages`, {
      method: "POST",
      body,
      timeoutMs: 180000,
    });
    input.value = "";
    autoSizeTextarea(input);
    clearPendingAttachments();
    input.blur();
    $("connectionState").classList.remove("error");
    $("connectionState").textContent = "Sent";
    scheduleCurrentThreadRefresh(600);
    scheduleLivePollIfNeeded(1200);
  } catch (err) {
    showError(err);
  } finally {
    state.composerBusy = false;
    updateComposerControls();
  }
}

async function interruptActiveTurn() {
  if (!state.currentThreadId || !state.activeTurnId) return;
  $("connectionState").classList.remove("error");
  $("connectionState").textContent = "Interrupt requested";
  await api(`/api/threads/${encodeURIComponent(state.currentThreadId)}/turns/${encodeURIComponent(state.activeTurnId)}/interrupt`, { method: "POST" })
    .then(() => scheduleCurrentThreadRefresh(900))
    .catch(showError);
}

async function answerApproval(requestId, decision) {
  const key = String(requestId || "");
  const request = state.pendingApprovals.get(key);
  if (!request || request.status !== "waiting") return;
  request.status = "responding";
  request.decision = decision;
  renderCurrentThread();
  try {
    const result = await api(`/api/approvals/${encodeURIComponent(key)}`, {
      method: "POST",
      body: JSON.stringify({ decision }),
      timeoutMs: 20000,
    });
    if (result && result.request) state.pendingApprovals.set(key, result.request);
    $("connectionState").classList.remove("error");
    $("connectionState").textContent = "Approval sent";
    renderCurrentThread();
  } catch (err) {
    request.status = "waiting";
    request.decision = null;
    showError(err);
    renderCurrentThread();
  }
}

function wireUi() {
  $("loginForm").addEventListener("submit", (event) => {
    event.preventDefault();
    login($("loginKey").value.trim()).catch((err) => showLogin(err.message));
  });
  $("workspaceSelect").addEventListener("change", (event) => {
    state.selectedCwd = event.target.value;
    clearCurrentThreadSelection();
    updateWorkspacePath();
    updateComposerControls();
    renderCurrentThread();
    loadThreads().catch(showError);
  });
  $("refreshThreads").addEventListener("click", () => loadThreads().catch(showError));
  $("threadSearch").addEventListener("input", () => {
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(() => loadThreads().catch(showError), 250);
  });
  $("openMenu").addEventListener("click", () => {
    $("sidebar").classList.add("open");
    loadWorkspaces()
      .then(() => loadThreads())
      .catch(showError);
  });
  $("closeMenu").addEventListener("click", () => $("sidebar").classList.remove("open"));
  $("composer").addEventListener("submit", sendMessage);
  $("interruptTurn").addEventListener("click", interruptActiveTurn);
  $("conversation").addEventListener("scroll", () => {
    if (state.leavingItems.size) scheduleLeavingCleanup(120);
  }, { passive: true });
  $("conversation").addEventListener("click", (event) => {
    const button = event.target.closest("[data-approval-action]");
    if (!button) return;
    answerApproval(button.dataset.approvalId, button.dataset.approvalAction).catch(showError);
  });
  $("messageInput").addEventListener("input", (event) => {
    autoSizeTextarea(event.target);
    updateComposerControls();
  });
  $("modelSelect").addEventListener("change", (event) => {
    state.selectedModel = event.target.value;
    if (state.selectedModel) localStorage.setItem(STORAGE_MODEL, state.selectedModel);
    else localStorage.removeItem(STORAGE_MODEL);
  });
  $("effortSelect").addEventListener("change", (event) => {
    state.selectedEffort = event.target.value;
    if (state.selectedEffort) localStorage.setItem(STORAGE_EFFORT, state.selectedEffort);
    else localStorage.removeItem(STORAGE_EFFORT);
  });
  $("messageInput").addEventListener("paste", (event) => {
    const files = Array.from((event.clipboardData && event.clipboardData.files) || []);
    if (files.length) addAttachmentFiles(files);
  });
  $("attachFiles").addEventListener("keydown", (event) => {
    if ($("fileInput").disabled || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    $("fileInput").click();
  });
  $("fileInput").addEventListener("change", (event) => {
    addAttachmentFiles(event.target.files);
    event.target.value = "";
  });
  $("attachmentList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-attachment]");
    if (button) removeAttachment(button.dataset.removeAttachment);
  });
  $("composer").addEventListener("dragover", (event) => {
    if (!state.currentThreadId || !hasTransferFiles(event)) return;
    event.preventDefault();
    $("composer").classList.add("drag-over");
  });
  $("composer").addEventListener("dragleave", () => $("composer").classList.remove("drag-over"));
  $("composer").addEventListener("drop", (event) => {
    if (!state.currentThreadId || !hasTransferFiles(event)) return;
    event.preventDefault();
    $("composer").classList.remove("drag-over");
    addAttachmentFiles(event.dataTransfer.files);
  });
  document.addEventListener("visibilitychange", () => scheduleMobileResume("visibility"));
  window.addEventListener("pageshow", () => scheduleMobileResume("pageshow"));
  window.addEventListener("focus", () => scheduleMobileResume("focus", 150));
  window.addEventListener("orientationchange", () => scheduleMobileResume("orientation", 250));
  window.addEventListener("resize", updateComposerHeightVar);
}

async function start() {
  wireUi();
  const config = await fetch("/api/public-config").then((res) => res.json());
  state.maxUploadBytes = Number(config.maxUploadBytes || state.maxUploadBytes);
  state.maxUploadFiles = Number(config.maxUploadFiles || state.maxUploadFiles);
  state.modelOptions = normalizeOptionList(config.modelOptions || []);
  state.reasoningEffortOptions = normalizeOptionList(config.reasoningEffortOptions || []);
  state.defaultModel = String(config.defaultModel || "");
  state.defaultReasoningEffort = String(config.defaultReasoningEffort || "");
  state.rateLimits = config.rateLimits || null;
  renderComposerSettings();
  renderQuotaUsage();
  if (config.authRequired && !state.key) {
    showLogin();
    return;
  }
  showApp();
  await bootstrap().catch((err) => {
    showError(err);
    if (/unauthorized/i.test(err.message)) showLogin();
  });
}

start();
