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
  pollTimer: null,
  pollStableCount: 0,
  lastThreadSignature: "",
  tickTimer: null,
  nowMs: Date.now(),
};

const MAX_COMMAND_OUTPUT_CHARS = 16000;
const MAX_LIVE_TEXT_CHARS = 60000;
const MAX_VISIBLE_TURNS = 12;
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

function statusText(status) {
  if (!status) return "";
  if (typeof status === "string") return status;
  return status.type || JSON.stringify(status);
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
  return /(running|active|queued|processing|in_progress|in-progress)/.test(text)
    && !/(completed|failed|cancel|error|interrupted)/.test(text);
}

function isCompletedStatus(status) {
  return /completed|failed|cancel|error|interrupted/i.test(statusText(status));
}

function syncActiveTurnFromThread() {
  const turns = state.currentThread && Array.isArray(state.currentThread.turns)
    ? state.currentThread.turns
    : [];
  const running = turns.slice().reverse().find((turn) => isRunningStatus(turn.status));
  state.activeTurnId = running ? running.id : "";
  const interrupt = $("interruptTurn");
  if (interrupt) interrupt.disabled = !state.activeTurnId;
}

function isOperationalItem(item) {
  return item && OPERATIONAL_ITEM_TYPES.has(item.type);
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
  return Boolean(state.activeTurnId) || isRunningStatus(turn.status) || isIncompleteInterruptedTurn(turn);
}

function isLiveTurn(turn) {
  return isRunningStatus(turn && turn.status) || isIncompleteInterruptedTurn(turn);
}

function isLatestTurn(turn) {
  return Boolean(turn && latestTurn() === turn);
}

function visibleOperationIndex(turn) {
  if (!isLatestTurn(turn) || !isLiveTurn(turn)) return -1;
  const items = Array.isArray(turn.items) ? turn.items : [];
  let operationIndex = -1;
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (isOperationalItem(items[index])) {
      operationIndex = index;
      break;
    }
  }
  if (operationIndex < 0) return -1;
  const hasLaterVisibleItem = items.slice(operationIndex + 1).some((item) => item && !isOperationalItem(item));
  return hasLaterVisibleItem ? -1 : operationIndex;
}

function visibleItemsForTurn(turn) {
  const operationIndex = visibleOperationIndex(turn);
  return (turn.items || []).filter((item, index) => !isOperationalItem(item) || index === operationIndex);
}

function removeOperationalItemsFromTurn(turn) {
  if (!turn || !Array.isArray(turn.items)) return;
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

function updateTickTimer() {
  clearInterval(state.tickTimer);
  const hasLiveReasoning = Boolean(state.currentThread && (state.currentThread.turns || []).some((turn) => (
    isLiveTurn(turn) && (turn.items || []).some((item) => isLiveReasoning(item, turn))
  )));
  if (!hasLiveReasoning) return;
  state.tickTimer = setInterval(() => {
    state.nowMs = Date.now();
    renderCurrentThread();
  }, 1000);
}

function threadSignature() {
  const turn = latestTurn();
  if (!turn) return "";
  const items = Array.isArray(turn.items) ? turn.items : [];
  const last = items.length ? items[items.length - 1] : null;
  const bodySize = items.reduce((total, item) => {
    if (!item || isOperationalItem(item)) return total;
    return total
      + String(item.text || "").length
      + String((item.summary || []).join("")).length
      + String((item.content || []).join("")).length;
  }, 0);
  return [turn.id, statusText(turn.status), items.length, last ? last.id : "", bodySize].join("|");
}

async function api(path, options = {}) {
  const headers = Object.assign({}, options.headers || {});
  const timeoutMs = options.timeoutMs || 30000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const fetchOptions = Object.assign({}, options, { headers, signal: controller.signal });
  delete fetchOptions.timeoutMs;
  if (state.key) headers["X-Codex-Mobile-Key"] = state.key;
  if (options.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
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
    if (err.name === "AbortError") throw new Error(`Request timed out: ${path}`);
    throw err;
  } finally {
    clearTimeout(timer);
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
  await api("/api/status").catch((err) => {
    $("connectionState").textContent = err.message;
  });
  await loadWorkspaces();
  await loadThreads();
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
}

function updateWorkspacePath() {
  const el = $("workspacePath");
  if (!el) return;
  el.textContent = state.selectedCwd || "All workspaces";
}

async function loadThreads() {
  const params = new URLSearchParams({ limit: "80", archived: "false" });
  if (state.selectedCwd) params.set("cwd", state.selectedCwd);
  const search = $("threadSearch").value.trim();
  if (search) params.set("search", search);
  $("threadList").innerHTML = `<div class="empty-state">Loading threads...</div>`;
  try {
    const result = await api(`/api/threads?${params}`, { timeoutMs: 45000 });
    state.threads = visibleThreads(result.data || []);
    renderThreads(result);
    if (result.mobileFallback) $("connectionState").textContent = "Recovered from session index";
  } catch (err) {
    renderThreadLoadError(err);
    throw err;
  }
}

async function loadThread(threadId) {
  state.currentThreadId = threadId;
  const result = await api(`/api/threads/${encodeURIComponent(threadId)}`, { timeoutMs: 60000 });
  state.currentThread = result.thread;
  syncActiveTurnFromThread();
  renderThreads();
  renderCurrentThread({ stickToBottom: true });
  scheduleLivePollIfNeeded(1200);
  $("composer").querySelectorAll("textarea, button").forEach((el) => {
    el.disabled = false;
  });
  if (window.matchMedia("(max-width: 760px)").matches) $("sidebar").classList.remove("open");
}

async function refreshCurrentThread() {
  if (!state.currentThreadId) return;
  const threadId = state.currentThreadId;
  const result = await api(`/api/threads/${encodeURIComponent(threadId)}`, { timeoutMs: 60000 });
  if (state.currentThreadId !== threadId) return;
  state.currentThread = result.thread;
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
  if (state.pollStableCount > 60) return;
  state.pollTimer = setTimeout(() => {
    refreshCurrentThread().catch(showError);
  }, delay);
}

function renderThreads(result = null) {
  const list = $("threadList");
  pruneHiddenThreads();
  if (!state.threads.length) {
    list.innerHTML = `<div class="empty-state">No threads.</div>`;
    return;
  }
  const warning = result && result.mobileFallback
    ? `<div class="history-note">Live thread list recovering. Showing cached session index.</div>`
    : "";
  list.innerHTML = warning + state.threads.map((thread) => {
    const title = thread.name || thread.preview || thread.id;
    const meta = `${shortPath(thread.cwd)} | ${formatTime(thread.updatedAt)} | ${statusText(thread.status)}`;
    const active = thread.id === state.currentThreadId ? " active" : "";
    return `<button class="thread-card${active}" type="button" data-thread="${escapeHtml(thread.id)}">
      <div class="thread-card-title">${escapeHtml(title)}</div>
      <div class="thread-card-meta">${escapeHtml(meta)}</div>
    </button>`;
  }).join("");
  list.querySelectorAll("[data-thread]").forEach((button) => {
    button.addEventListener("click", () => loadThread(button.dataset.thread).catch(showError));
  });
}

function renderThreadLoadError(err) {
  const list = $("threadList");
  list.innerHTML = `<div class="empty-state">
    <div>Thread list failed: ${escapeHtml(err.message || String(err))}</div>
    <button id="retryThreads" class="retry-button" type="button">Retry</button>
  </div>`;
  const retry = $("retryThreads");
  if (retry) retry.addEventListener("click", () => loadThreads().catch(showError));
}

function renderCurrentThread(options = {}) {
  const thread = state.currentThread;
  if (!thread) {
    clearInterval(state.tickTimer);
    $("threadTitle").textContent = "Select a thread";
    $("threadMeta").textContent = "";
    $("conversation").innerHTML = `<div class="empty-state">Select a thread from the menu.</div>`;
    return;
  }
  const shouldStickToBottom = options.stickToBottom === true || isConversationNearBottom();
  $("threadTitle").textContent = thread.name || thread.preview || thread.id;
  $("threadMeta").textContent = `${thread.cwd} | ${statusText(thread.status)}`;
  const turns = (thread.turns || []).slice(-MAX_VISIBLE_TURNS);
  const omitted = Number(thread.mobileOmittedTurnCount || 0) + Math.max(0, (thread.turns || []).length - turns.length);
  const omittedBanner = omitted > 0
    ? `<div class="history-note">Older history hidden on mobile: ${omitted.toLocaleString()} turn(s)</div>`
    : "";
  $("conversation").innerHTML = omittedBanner + (turns.map((turn) => renderTurn(turn)).join("") || `<div class="empty-state">No visible turns.</div>`);
  if (shouldStickToBottom) scrollConversationToBottom();
  updateTickTimer();
}

function renderTurn(turn) {
  const items = visibleItemsForTurn(turn).map((item) => {
    if (isContextCompactionItem(item)) return renderContextCompaction(item);
    if (isOperationalItem(item)) return renderLiveOperation(item, turn);
    if (item.type === "reasoning" && isLiveTurn(turn)) return isLiveReasoning(item, turn) ? renderLiveReasoning(item, turn) : "";
    return renderItem(item, turn);
  }).join("");
  if (!items.trim()) return "";
  return `<article class="turn" data-turn="${escapeHtml(turn.id)}">
    ${items}
    <div class="turn-status">${escapeHtml(displayTurnStatus(turn))}${turn.durationMs ? ` | ${Math.round(turn.durationMs / 1000)}s` : ""}</div>
  </article>`;
}

function renderLiveOperation(item, turn) {
  if (visibleOperationIndex(turn) < 0) return "";
  const lines = operationSummaryLines(item);
  const body = lines.length ? `<div class="operation-body">${escapeHtml(lines.join("\n"))}</div>` : "";
  const status = statusText(item.status) || (item.completedAtMs ? "completed" : "running");
  const title = operationTitle(item, status);
  return `<section class="item live-operation ${isCompletedStatus(status) ? "completed" : ""} ${escapeHtml(item.type || "item")}" data-item="${escapeHtml(item.id || "")}">
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

function operationSummaryLines(item) {
  if (item.type === "fileChange") {
    const names = operationFileNames(item);
    return names.length ? [names.join(", ")] : [];
  }
  if (item.command) return [truncateMiddle(item.command, 180, "command")];
  const names = operationFileNames(item);
  if (names.length) return [names.join(", ")];
  if (item.tool) return [item.tool];
  return [];
}

function displayTurnStatus(turn) {
  if (isIncompleteInterruptedTurn(turn)) return "syncing";
  return statusText(turn.status);
}

function renderContextCompaction(item) {
  return `<div class="context-compaction-note" data-item="${escapeHtml(item.id || "")}">${escapeHtml(item.mobileNotice || "历史上下文已压缩")}</div>`;
}

function renderItem(item, turn = null) {
  if (isContextCompactionItem(item)) return renderContextCompaction(item);
  if (isLiveReasoning(item, turn)) return renderLiveReasoning(item, turn);
  const type = item.type || "item";
  return `<section class="item ${escapeHtml(type)}" data-item="${escapeHtml(item.id || "")}">
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

function renderInputContent(content) {
  return (content || []).map((part) => {
    if (part.type === "text") return escapeHtml(part.text || "");
    if (part.type === "image" || part.type === "localImage") return `[${part.type}: ${escapeHtml(part.url || part.path || "")}]`;
    return escapeHtml(JSON.stringify(part));
  }).join("\n");
}

function renderItemBody(item) {
  if (isContextCompactionItem(item)) return escapeHtml(item.mobileNotice || "历史上下文已压缩");
  if (item.type === "userMessage") return renderInputContent(item.content);
  if (item.type === "agentMessage") return escapeHtml(item.text || "");
  if (item.type === "reasoning") {
    const summary = (item.summary || []).join("\n");
    const content = (item.content || []).join("\n");
    return escapeHtml([summary, content].filter(Boolean).join("\n\n"));
  }
  if (item.type === "plan") return escapeHtml(item.text || "");
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
  turn.items = turn.items || [];
  if (isOperationalItem(item)) {
    turn.items = turn.items.filter((existing) => !isOperationalItem(existing) || existing.id === item.id);
  } else {
    removeOperationalItemsFromTurn(turn);
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
  turn.items = turn.items || [];
  if (!OPERATIONAL_ITEM_TYPES.has(itemType)) removeOperationalItemsFromTurn(turn);
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
  if (!OPERATIONAL_ITEM_TYPES.has(itemType)) removeOperationalItemsFromTurn(turn);
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

function applyNotification(method, params) {
  if (!params) return;
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
    ensureTurn(params.turn.id);
    renderCurrentThread();
    scheduleLivePollIfNeeded(1200);
    return;
  }
  if (method === "turn/completed") {
    const turn = ensureTurn(params.turn.id);
    Object.assign(turn, params.turn);
    removeOperationalItemsFromTurn(turn);
    state.activeTurnId = "";
    $("interruptTurn").disabled = true;
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
      $("connectionState").textContent = payload.status.ready ? "Connected" : "Starting";
      if (payload.status.ready) clearTimeout(state.recoveryTimer);
      return;
    }
    if (payload.type === "notification") applyNotification(payload.method, payload.params);
  };
  state.events.onerror = () => {
    $("connectionState").textContent = "Reconnecting";
    clearTimeout(state.recoveryTimer);
    state.recoveryTimer = setTimeout(async () => {
      try {
        const status = await api("/api/status");
        $("connectionState").textContent = status.ready ? "Connected" : "Starting";
        await loadThreads();
        await refreshCurrentThread();
      } catch (err) {
        showError(err);
      }
    }, 1500);
  };
}

function scrollConversationToBottom() {
  const el = $("conversation");
  el.scrollTop = el.scrollHeight;
}

function isConversationNearBottom() {
  const el = $("conversation");
  if (!el) return true;
  return el.scrollHeight - el.scrollTop - el.clientHeight < 96;
}

function showError(err) {
  $("connectionState").textContent = err.message || String(err);
}

function autoSizeTextarea(el) {
  el.style.height = "auto";
  el.style.height = `${Math.min(160, Math.max(44, el.scrollHeight))}px`;
}

async function sendMessage(event) {
  event.preventDefault();
  const input = $("messageInput");
  const text = input.value.trim();
  if (!text || !state.currentThreadId) return;
  input.value = "";
  autoSizeTextarea(input);
  $("sendMessage").disabled = true;
  try {
    const body = { text };
    if (state.currentThread && state.currentThread.cwd) body.cwd = state.currentThread.cwd;
    await api(`/api/threads/${encodeURIComponent(state.currentThreadId)}/messages`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    $("connectionState").textContent = "Sent";
    scheduleCurrentThreadRefresh(600);
    scheduleLivePollIfNeeded(1200);
  } catch (err) {
    showError(err);
  } finally {
    $("sendMessage").disabled = false;
    input.focus();
  }
}

async function interruptActiveTurn() {
  if (!state.currentThreadId || !state.activeTurnId) return;
  $("connectionState").textContent = "Interrupt requested";
  await api(`/api/threads/${encodeURIComponent(state.currentThreadId)}/turns/${encodeURIComponent(state.activeTurnId)}/interrupt`, { method: "POST" })
    .then(() => scheduleCurrentThreadRefresh(900))
    .catch(showError);
}

function wireUi() {
  $("loginForm").addEventListener("submit", (event) => {
    event.preventDefault();
    login($("loginKey").value.trim()).catch((err) => showLogin(err.message));
  });
  $("workspaceSelect").addEventListener("change", (event) => {
    state.selectedCwd = event.target.value;
    updateWorkspacePath();
    loadThreads().catch(showError);
  });
  $("refreshThreads").addEventListener("click", () => loadThreads().catch(showError));
  $("threadSearch").addEventListener("input", () => {
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(() => loadThreads().catch(showError), 250);
  });
  $("openMenu").addEventListener("click", () => $("sidebar").classList.add("open"));
  $("closeMenu").addEventListener("click", () => $("sidebar").classList.remove("open"));
  $("composer").addEventListener("submit", sendMessage);
  $("interruptTurn").addEventListener("click", interruptActiveTurn);
  $("messageInput").addEventListener("input", (event) => autoSizeTextarea(event.target));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    state.pollStableCount = 0;
    api("/api/status").catch(showError);
    loadThreads().catch(showError);
    refreshCurrentThread().catch(showError);
  });
}

async function start() {
  wireUi();
  const config = await fetch("/api/public-config").then((res) => res.json());
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
