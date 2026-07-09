"use strict";

function taskCardActionThread(threadId) {
  const id = String(threadId || "").trim();
  if (id && state.currentThread && String(state.currentThread.id || "") === id) return state.currentThread;
  if (id && state.threadTileDetails.has(id)) return state.threadTileDetails.get(id);
  if (!id) return state.currentThread || null;
  return null;
}

function findThreadTaskCard(cardId, threadId = "") {
  const thread = taskCardActionThread(threadId);
  const cards = threadTaskCardsForThread(thread || {});
  return cards.find((card) => card.id === String(cardId || "")) || null;
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
  const head = Math.ceil(available * 0.6);
  const tail = Math.max(0, available - head);
  return `${text.slice(0, head).trimEnd()}${marker}${text.slice(-tail).trimStart()}`.slice(0, limit);
}

function isThreadTaskCardCommandText(value) {
  const text = String(value || "").trim();
  return (text.startsWith(THREAD_TASK_CARD_COMMAND_PREFIX)
      || THREAD_TASK_CARD_MENTION_PATTERN.test(text)
      || THREAD_TASK_CARD_AUTONOMOUS_MENTION_PATTERN.test(text))
    && threadTaskCardCommandText(text).length > 0;
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
    showError(new Error("@ChatGPT Pro does not support attachments in this entry point"));
    return true;
  }
  const sourceThreadId = currentComposerThreadId() || state.currentThreadId || "";
  const sourceThread = composerTargetThread() || state.currentThread || null;
  const cwd = state.newThreadDraft
    ? state.selectedCwd || ""
    : (sourceThread && sourceThread.cwd) || "";
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
        bridgeMode: isHermesEmbedMode() ? "embedded" : "standalone",
      }),
      timeoutMs: 180000,
    });
    setComposerText("");
    clearPendingAttachments();
    scheduleCurrentDraftSave();
    const proThreadId = String(result && result.proThreadId || "");
    $("connectionState").textContent = proThreadId
      ? `ChatGPT Pro 分析已提交：${proThreadId.slice(0, 8)}`
      : "ChatGPT Pro 分析已提交";
    markActivity("Pro 已提交");
    await loadThreads({ silent: true }).catch(showError);
    if (state.newThreadDraft && proThreadId) {
      state.newThreadDraft = false;
      await loadThread(proThreadId, { source: "chatgpt-pro" }).catch(showError);
    }
    return true;
  } catch (err) {
    $("connectionState").classList.add("error");
    $("connectionState").textContent = normalizeClientErrorMessage(err && err.message ? err.message : String(err), err)
      || "ChatGPT Pro 提交失败";
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
  if (text.startsWith(THREAD_TASK_CARD_LEGACY_COMMAND_PREFIX)) {
    return text.slice(THREAD_TASK_CARD_LEGACY_COMMAND_PREFIX.length).trim();
  }
  if (THREAD_TASK_CARD_AUTONOMOUS_MENTION_PATTERN.test(text)) {
    return text.replace(THREAD_TASK_CARD_AUTONOMOUS_MENTION_PATTERN, "").trim();
  }
  if (THREAD_TASK_CARD_MENTION_PATTERN.test(text)) {
    return text.replace(THREAD_TASK_CARD_MENTION_PATTERN, "").trim();
  }
  return text.startsWith(THREAD_TASK_CARD_COMMAND_PREFIX)
    ? text.slice(THREAD_TASK_CARD_COMMAND_PREFIX.length).trim()
    : "";
}

function threadTaskCardVisibleTargets() {
  const sourceThreadId = currentComposerThreadId() || state.currentThreadId;
  return (state.threads || [])
    .filter((thread) => thread && thread.id && thread.id !== sourceThreadId)
    .slice(0, 40)
    .map((thread) => ({
      threadId: String(thread.id || ""),
      title: threadTitleForDisplay(thread) || String(thread.id || ""),
      cwd: String(thread.cwd || ""),
    }));
}

function buildThreadTaskCardDraftRequestText(commandText, sourceThread = composerTargetThread()) {
  const original = String(commandText || "").trim();
  const compactCommand = threadTaskCardCommandText(original);
  if (!compactCommand) throw new Error("Task-card command is empty");
  const legacyAutonomousCommand = original.startsWith(THREAD_TASK_CARD_LEGACY_COMMAND_PREFIX)
    || THREAD_TASK_CARD_AUTONOMOUS_MENTION_PATTERN.test(original);
  const source = sourceThread || {};
  const sourceThreadId = currentComposerThreadId() || state.currentThreadId || "";
  const envelope = {
    version: 1,
    sourceThreadId: String(sourceThreadId),
    sourceThreadTitle: threadTitleForDisplay(source) || String(sourceThreadId),
    availableTargets: threadTaskCardVisibleTargets(),
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
    legacyAutonomousCommand
      ? "- This command used #自由协作 or @自由协作, so default workflowMode to autonomous unless it explicitly asks for manual."
      : "- This command used a manual task-card entry, so default workflowMode to manual unless it explicitly asks for autonomous/free collaboration.",
    "- Autonomous workflow means the target approves the first card once; after the target turn completes, Mobile Web sends the return card back automatically without another approval.",
    "- For a new autonomous workflow, leave workflowId empty. Reuse workflowId only when the command or visible context provides an existing id.",
    "- If the command is unclear or no target fits, set targetThreadIds to an empty array and explain the problem in error.",
    "- Keep title under 120 chars and summary under 280 chars.",
    "- Keep body under 7600 chars and put the actual requested work there.",
    "- Do not add any explanation outside the XML block.",
  ].join("\n");
}

function threadTaskCardRequestMarkerMatch(value) {
  const text = String(value || "");
  const pattern = new RegExp(`\\n\\s*<${THREAD_TASK_CARD_REQUEST_TAG}>[\\s\\S]*?<\\/${THREAD_TASK_CARD_REQUEST_TAG}>[\\s\\S]*$`, "i");
  return pattern.exec(text);
}

function uniqueThreadTaskCardTargetIds(values, fallbackValue = "") {
  const raw = Array.isArray(values) && values.length ? values : [fallbackValue];
  const seen = new Set();
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
    error: truncateSingleLine(String(parsed.error || "").trim(), 280),
  };
}

function hasThreadTaskCardDraftTag(value) {
  return String(value || "").includes(`<${THREAD_TASK_CARD_DRAFT_TAG}>`);
}

function turnHasThreadTaskCardRequest(turn) {
  const items = Array.isArray(turn && turn.items) ? turn.items : [];
  return items.some((item) => {
    if (!item || item.type !== "userMessage") return false;
    const parts = Array.isArray(item.content) ? item.content : [];
    return parts.some((part) => isInputTextPart(part) && Boolean(threadTaskCardRequestMarkerMatch(inputTextValue(part))));
  });
}

function turnHasThreadTaskCardDraftResponse(turn) {
  const items = Array.isArray(turn && turn.items) ? turn.items : [];
  return items.some((item) => item && (item.type === "agentMessage" || item.type === "plan") && hasThreadTaskCardDraftTag(item.text || ""));
}

function renderTurnThreadTaskCardDraft(turn, previousKeys = new Set(), thread = renderContextThread()) {
  const contextThread = renderContextThread(thread);
  const items = Array.isArray(turn && turn.items) ? turn.items : [];
  for (const item of items) {
    if (!item || (item.type !== "agentMessage" && item.type !== "plan")) continue;
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
            cardIds: existing.map((card) => String(card && card.id || "")).filter(Boolean),
          }, { render: false });
          draftState = threadTaskCardDraftState(draftKey);
        }
      }
      if (canRecoverFailedThreadTaskCardDraft(draft, draftState)) {
        setThreadTaskCardDraftState(draftKey, { status: "pending", error: "" }, { render: false });
        queueThreadTaskCardDraftCreation(draftKey, contextThread);
        draftState = Object.assign({}, draftState, { status: "creating" });
      }
      if (draftState.status === "created" || draftState.status === "dismissed") return "";
      if (draftState.status === "creating" && isThreadTaskCardDraftCreationStale(draftKey, draftState)) {
        const attempts = Math.max(1, Number(draftState.attempts || 1));
        if (attempts < THREAD_TASK_CARD_DRAFT_CREATE_MAX_ATTEMPTS) {
          setThreadTaskCardDraftState(draftKey, { status: "pending", error: "", attempts }, { render: false });
          queueThreadTaskCardDraftCreation(draftKey, contextThread);
          draftState = Object.assign({}, draftState, { status: "creating", attempts: attempts + 1 });
        } else {
          setThreadTaskCardDraftState(draftKey, {
            status: "failed",
            error: "Task card creation timed out before the server stored a card",
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
    if (hasThreadTaskCardDraftTag(text)) {
      return renderPendingThreadTaskCardDraft("Generating cross-thread task card draft...", "Generating");
    }
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
    body: String(draft && draft.body || "").trim(),
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
  const candidates = (state.threads || [])
    .filter((thread) => thread && thread.id && thread.id !== state.currentThreadId)
    .map((thread) => ({
      thread,
      prefix: commonPrefixLength(id, thread.id),
    }))
    .filter((entry) => entry.prefix >= 14)
    .sort((a, b) => b.prefix - a.prefix);
  if (!candidates.length) return null;
  const bestPrefix = candidates[0].prefix;
  const best = candidates.filter((entry) => entry.prefix === bestPrefix);
  return best.length === 1 ? best[0].thread : null;
}

function threadTaskCardDraftTargetThreads(draft) {
  return threadTaskCardDraftTargetIds(draft).map((threadId) => ({
    threadId,
    thread: findThreadById(threadId) || recoverVisibleThreadForDraftTargetId(threadId),
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
  const existing = Array.isArray(thread.threadTaskCards) ? thread.threadTaskCards : [];
  thread.threadTaskCards = [card, ...existing.filter((entry) => String(entry && entry.id || "") !== String(card.id || ""))];
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
    const result = await api(`/api/thread-task-cards/${encodeURIComponent(id)}?threadId=${encodeURIComponent(ownerThreadId)}`, {
      timeoutMs: 15000,
    });
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
  const details = event && event.target && event.target.closest
    ? event.target.closest("[data-task-card-details]")
    : null;
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
  const targetThreadId = String(threadId || "").trim() || String(state.currentThreadId || "").trim();
  const thread = taskCardActionThread(targetThreadId);
  if (!thread || !Array.isArray(thread.threadTaskCards)) return;
  const id = String(cardId || "").trim();
  if (!id) return;
  let settledCard = null;
  thread.threadTaskCards = thread.threadTaskCards.map((entry) => {
    if (String(entry && entry.id || "") !== id) return entry;
    settledCard = Object.assign({}, entry || {}, nextCard || {}, { status: nextStatus || (nextCard && nextCard.status) || entry.status });
    return settledCard;
  });
  if (!settledCard) return;
  if (settledCard.threadRole === "target") incrementPendingIncomingTaskCardCount(thread.id, -1);
  if (settledCard.threadRole === "source") incrementPendingOutgoingTaskCardCount(thread.id, -1);
  if (state.threadTileDetails.has(String(thread.id || ""))) state.threadTileDetails.set(String(thread.id || ""), thread);
  renderThreads();
  if (String(thread.id || "") === String(state.currentThreadId || "")) {
    renderCurrentThread();
  } else if (state.threadTileMode && threadTilePaneIsVisible(thread.id) && !scheduleRenderThreadTilePane(thread.id, { preserveScroll: true })) {
    scheduleRenderCurrentThread();
  }
}

function settleCurrentThreadTaskCard(cardId, nextStatus, nextCard = null) {
  settleThreadTaskCardForThread(state.currentThreadId, cardId, nextStatus, nextCard);
}

function resolveTargetThreadReference(input) {
  const raw = String(input || "").trim();
  if (!raw) return null;
  const lowered = raw.toLowerCase();
  return state.threads.find((thread) => thread
    && thread.id !== state.currentThreadId
    && (
      String(thread.id || "").toLowerCase() === lowered
      || String(threadTitleForDisplay(thread) || "").trim().toLowerCase() === lowered
    )) || null;
}

function resolveTargetThreadReferences(input) {
  const parts = String(input || "")
    .split(/[\n,;，；]+/u)
    .map((part) => part.trim())
    .filter(Boolean);
  const seen = new Set();
  const targets = [];
  for (const part of parts) {
    const thread = resolveTargetThreadReference(part);
    const id = String((thread && thread.id) || part || "").trim();
    if (!id || id === state.currentThreadId || seen.has(id)) continue;
    seen.add(id);
    targets.push({ threadId: id, thread });
    if (targets.length >= 12) break;
  }
  return targets;
}

async function refreshThreadAfterTaskCard(threadId = "") {
  const id = String(threadId || state.currentThreadId || "").trim();
  if (!id) return;
  if (id === String(state.currentThreadId || "")) {
    await refreshCurrentThread({ source: "task-card" });
  } else if (state.threadTileMode && threadTilePaneIsVisible(id)) {
    await loadThreadTileDetail(id, { force: true, background: true, source: "task-card" });
  }
  loadThreads({ silent: true }).catch(showError);
}

async function refreshCurrentThreadAfterTaskCard() {
  await refreshThreadAfterTaskCard(state.currentThreadId);
}

function currentThreadHasTurn(turnId) {
  const targetTurnId = String(turnId || "").trim();
  if (!targetTurnId || !state.currentThread) return false;
  const turns = Array.isArray(state.currentThread.turns) ? state.currentThread.turns : [];
  return turns.some((turn) => String(turn && turn.id || "") === targetTurnId);
}

async function waitForCurrentThreadTurn(turnId, options = {}) {
  const targetTurnId = String(turnId || "").trim();
  if (!targetTurnId || !state.currentThreadId) return false;
  const timeoutMs = Math.max(500, Number(options.timeoutMs) || 10000);
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
        itemId: targetTurnId,
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
    rows: 3,
  });
  if (targetInput == null) return;
  const targets = resolveTargetThreadReferences(targetInput);
  if (!targets.length) {
    showError(new Error("At least one different target thread is required"));
    return;
  }
  const title = await requestAppTextInput("输入任务卡片标题。", `Need response from ${threadTitleForDisplay(thread) || thread.id}`, {
    title: "任务卡片标题",
    confirmLabel: "下一步",
    rows: 2,
  }) || "";
  if (!String(title).trim()) return;
  const body = await requestAppTextInput("输入任务卡片正文。", "", {
    title: "任务卡片正文",
    confirmLabel: "创建",
    rows: 7,
  }) || "";
  if (!String(body).trim()) return;
  $("connectionState").classList.remove("error");
  $("connectionState").textContent = "Creating task card";
  try {
    const targetWorkspaceIds = {};
    for (const target of targets) {
      if (target.thread) targetWorkspaceIds[target.threadId] = String(target.thread.cwd || "");
    }
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
        body: String(body).trim(),
      }),
      timeoutMs: 30000,
    });
    $("connectionState").textContent = "Task card created";
    recordHomeAiDiagnosticSuccess({
      category: "task_card_workflow_failed",
      diagnostic_type: "task_card_creation_failed",
      error_code: "task_card_create_failed",
      context: {
        surface: "task-card",
        action: "manual-create",
        thread_hash: diagnosticThreadHash(thread.id),
      },
    });
    await refreshThreadAfterTaskCard(thread.id);
  } catch (err) {
    recordHomeAiDiagnosticFailure({
      category: "task_card_workflow_failed",
      diagnostic_type: "task_card_creation_failed",
      severity_hint: "H2",
      evidence_confidence: 0.78,
      error_code: diagnosticErrorCode(err, "task_card_create_failed"),
      context: {
        surface: "task-card",
        action: "manual-create",
        thread_hash: diagnosticThreadHash(thread.id),
      },
      counts: {
        target_count: targets.length,
        status_code: diagnosticErrorStatus(err),
      },
      breadcrumbs: [{
        kind: "task-card",
        code: "manual-create",
        status: "failed",
        fields: {
          status_code: diagnosticErrorStatus(err),
          thread_hash: diagnosticThreadHash(thread.id),
        },
      }],
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
    pluginId: pluginMode ? "codex-mobile" : "",
  };
}

function threadActionTargetRow(target) {
  if (!target || !target.closest) return null;
  return target.closest("[data-thread-row]");
}

function primaryTouch(event) {
  return (event.touches && event.touches[0])
    || (event.changedTouches && event.changedTouches[0])
    || null;
}

function startedThreadId(result) {
  return String((result && result.threadId)
    || (result && result.thread && result.thread.id)
    || (result && result.result && result.result.thread && result.result.thread.id)
    || (result && result.result && result.result.threadId)
    || "");
}

function startedTurnId(result) {
  return String((result && result.turnId)
    || (result && result.turn && result.turn.id)
    || (result && result.result && result.result.turnId)
    || (result && result.result && result.result.turn && result.result.turn.id)
    || "");
}

function continuationJobStatusText(job) {
  const status = String(job && job.status || "");
  const message = String(job && job.message || "").trim();
  if (message) return message;
  return {
    queued: "续接任务已排队",
    running: "正在生成交接并续接",
    done: "续接线程已就绪",
    failed: "续接任务失败",
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
  if (!id || localStorage.getItem(STORAGE_CONTINUATION_JOB) === id) {
    localStorage.removeItem(STORAGE_CONTINUATION_JOB);
  }
  if (!id || state.continuationJobId === id) state.continuationJobId = "";
}

async function openContinuationResult(result) {
  const threadId = startedThreadId(result);
  if (!threadId) throw new Error("Continuation thread was created without a thread id");
  state.continuationNewThreadId = threadId;
  const archivedSourceThreadId = result.sourceArchive && result.sourceArchive.archived
    ? result.sourceArchive.threadId
    : "";
  if (archivedSourceThreadId) {
    state.threads = state.threads.filter((entry) => entry.id !== archivedSourceThreadId);
  }
  if (result.thread) {
    state.threads = [result.thread, ...state.threads.filter((thread) => thread.id !== result.thread.id)];
    renderThreads();
  }
  $("connectionState").classList.remove("error");
  if (result.sourceArchive && result.sourceArchive.error && !result.sourceArchive.archived) {
    $("connectionState").classList.add("error");
    $("connectionState").textContent = `续接线程已就绪；归档失败：${result.sourceArchive.error}`;
  } else if (result.sourceArchive && result.sourceArchive.error) {
    $("connectionState").textContent = "交接已生成；旧线程已在 Mobile 隐藏";
  } else {
    $("connectionState").textContent = "交接已生成；正在打开续接线程";
  }
  await loadThread(threadId, { source: "continuation" });
  loadThreads().catch(showError);
}

async function waitForContinuationJob(jobId) {
  const id = String(jobId || "").trim();
  if (!id) throw new Error("Continuation job was created without a job id");
  rememberContinuationJob(id);
  let delayMs = 800;
  while (state.continuationJobId === id) {
    const job = await api(`/api/thread-continuations/${encodeURIComponent(id)}`, {
      timeoutMs: 30000,
    });
    $("connectionState").classList.toggle("error", job.status === "failed");
    $("connectionState").textContent = continuationJobStatusText(job);
    setContinuationDialogStatus(continuationJobStatusText(job), { error: job.status === "failed" });
    postClientEvent("continuation_job_poll", {
      jobId: id,
      status: String(job.status || ""),
      step: String(job.step || ""),
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
        message: String(job.error || job.message || "Continuation job failed"),
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
    const result = await waitForContinuationJob(jobId);
    await openContinuationResult(result);
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
      sourceThreadId: state.continuationSourceThreadId || "",
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
    pluginId: isHermesEmbedMode() ? "codex-mobile" : "",
  };
  if (!body.cwd) {
    showError(new Error("Thread has no workspace path"));
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
    hermesPluginMode: Boolean(body.hermesPluginMode),
  });
  try {
    const job = await api("/api/thread-continuations", {
      method: "POST",
      body: JSON.stringify(body),
      timeoutMs: 30000,
    });
    $("connectionState").textContent = continuationJobStatusText(job);
    setContinuationDialogStatus(continuationJobStatusText(job));
    postClientEvent("continuation_job_created", {
      jobId: String(job.jobId || ""),
      status: String(job.status || ""),
      pluginMode: String(job.pluginMode || ""),
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
      message: err && err.message ? err.message : String(err),
    });
    showError(err);
  } finally {
    clearRememberedContinuationJob();
    state.continuationBusy = false;
    if (!failed) {
      setContinuationDialogBusy(false, completed || !continuationDialogOpen() ? "" : "续接任务未完成，可以重试。");
    }
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
  subtitle.textContent = state.threadArchiveConfirmOpen
    ? `目标会话：${state.threadArchiveConfirmTitle || state.threadArchiveConfirmTargetId || "--"}`
    : "";
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
    showError(new Error("Thread is no longer in the current list"));
    return;
  }
  const title = threadTitleForDisplay(thread) || "会话";
  const archiveConfirmed = await requestThreadArchiveConfirmation(thread.id, title);
  if (!archiveConfirmed) return;
  if (button) button.disabled = true;
  $("connectionState").classList.remove("error");
  $("connectionState").textContent = "正在归档会话";
  markActivity("归档会话");
  try {
    await api(`/api/threads/${encodeURIComponent(thread.id)}/archive`, { method: "POST", timeoutMs: 30000 });
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
    replied: "Replied",
  }[text] || text;
}

function taskCardReturnStatusLabel(card) {
  const text = String(
    card && card.delivery && card.delivery.returnStatus
    || card && card.audit && card.audit.returnStatus
    || card && card.returnStatus
    || "returned"
  ).trim().toLowerCase();
  return {
    completed: "Completed",
    partially_completed: "Partial",
    blocked: "Blocked",
    redirected: "Redirected",
    rejected: "Rejected",
    returned: "Returned",
  }[text] || (text ? text.replace(/_/g, " ") : "Returned");
}

function taskCardDirectionLabel(card) {
  if (!card) return "Task card";
  if (card.threadRole === "target") {
    return `Task card from ${card.source && (card.source.title || card.source.threadId || card.source.workspaceId || "source thread")}`;
  }
  if (card.threadRole === "source") {
    return `Task card to ${card.target && (card.target.threadId || card.target.workspaceId || "target thread")}`;
  }
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
    card.injectedTurnId ? `Injected turn: ${card.injectedTurnId}` : "",
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

function renderThreadTaskCard(card, previousKeys = new Set(), threadId = "") {
  const key = `task-card|${card.id}`;
  const status = String(card.status || "pending");
  const detail = taskCardDetailLines(card).join("\n");
  const summary = threadTaskCardSummaryLine(card.message && card.message.summary ? card.message.summary : "");
  const body = card.message && card.message.body
    ? `<pre class="approval-detail">${escapeHtml(card.message.body)}</pre>`
    : card.message && card.message.bodyOmitted
      ? `<div class="approval-detail" data-task-card-body-placeholder data-task-card-id="${escapeHtml(card.id)}" data-task-card-thread-id="${escapeHtml(threadId)}">Task card body loads when opened.</div>`
      : "";
  const compact = status !== "pending" ? " compact" : "";
  const detailBlocks = [
    detail ? `<pre class="approval-detail">${escapeHtml(detail)}</pre>` : "",
    body,
  ];
  return `<section class="approval-card thread-task-card${compact}${entryAnimationClass(key, previousKeys)} ${escapeHtml(status)}" data-render-key="${escapeHtml(key)}" data-task-card="${escapeHtml(card.id)}">
    <div class="approval-head">
      <div>
        <div class="approval-title">${escapeHtml(taskCardDirectionLabel(card))}</div>
        <div class="approval-method">${escapeHtml(card.message && card.message.title || "Task card")}</div>
      </div>
      <span class="approval-status">${escapeHtml(taskCardStatusLabel(status))}</span>
    </div>
    ${summary ? `<div class="approval-summary-line">${escapeHtml(summary)}</div>` : ""}
    ${renderThreadTaskCardExpandable(summary || detail || (card.message && card.message.title) || "Task card details", detailBlocks, `data-task-card-details data-task-card-id="${escapeHtml(card.id)}" data-task-card-thread-id="${escapeHtml(threadId)}"`)}
    ${renderThreadTaskCardActions(card, threadId)}
  </section>`;
}

function renderThreadTaskCardReturnReceipt(card, previousKeys = new Set(), threadId = "") {
  const key = `task-card-return-receipt|${card.id}`;
  const status = String(card.status || "approved");
  const detail = taskCardDetailLines(card).join("\n");
  const summary = threadTaskCardSummaryLine(card.message && card.message.summary ? card.message.summary : "");
  const body = card.message && card.message.body
    ? `<pre class="approval-detail">${escapeHtml(card.message.body)}</pre>`
    : card.message && card.message.bodyOmitted
      ? `<div class="approval-detail" data-task-card-body-placeholder data-task-card-id="${escapeHtml(card.id)}" data-task-card-thread-id="${escapeHtml(threadId)}">Task card body loads when opened.</div>`
      : "";
  const title = card.message && card.message.title || "Return receipt";
  const detailBlocks = [
    detail ? `<pre class="approval-detail">${escapeHtml(detail)}</pre>` : "",
    body,
  ];
  return `<section class="item thread-task-card-return-receipt${entryAnimationClass(key, previousKeys)} ${escapeHtml(status)}" data-render-key="${escapeHtml(key)}" data-task-card-return-receipt="${escapeHtml(card.id)}">
    <div class="item-head thread-task-card-return-head">
      <span class="thread-task-card-return-heading">
        <span class="thread-task-card-return-kicker">Return card</span>
        <span class="thread-task-card-return-title">${escapeHtml(title)}</span>
      </span>
      <span class="approval-status thread-task-card-return-status">${escapeHtml(taskCardReturnStatusLabel(card))}</span>
    </div>
    ${summary ? `<div class="approval-summary-line">${escapeHtml(summary)}</div>` : ""}
    ${renderThreadTaskCardExpandable(summary || detail || title, detailBlocks, `data-task-card-details data-task-card-id="${escapeHtml(card.id)}" data-task-card-thread-id="${escapeHtml(threadId)}"`)}
  </section>`;
}

function taskCardReturnReceiptTurnId(card) {
  const cardId = String(card && card.id || "").trim();
  return cardId ? `task-card-return-receipt|${cardId}` : "";
}

function taskCardReturnReceiptTimestampMs(value) {
  if (value == null || value === "") return 0;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return 0;
    return value < 10000000000 ? value * 1000 : value;
  }
  const text = String(value || "").trim();
  if (!text) return 0;
  if (/^\d+$/.test(text)) return taskCardReturnReceiptTimestampMs(Number(text));
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function taskCardReturnReceiptFlowTimeMs(card) {
  const delivery = card && card.delivery && typeof card.delivery === "object" ? card.delivery : {};
  const audit = card && card.audit && typeof card.audit === "object" ? card.audit : {};
  const message = card && card.message && typeof card.message === "object" ? card.message : {};
  return taskCardReturnReceiptTimestampMs(delivery.returnedAtMs)
    || taskCardReturnReceiptTimestampMs(delivery.returnedAt)
    || taskCardReturnReceiptTimestampMs(delivery.deliveredAtMs)
    || taskCardReturnReceiptTimestampMs(delivery.deliveredAt)
    || taskCardReturnReceiptTimestampMs(audit.returnedAtMs)
    || taskCardReturnReceiptTimestampMs(audit.returnedAt)
    || taskCardReturnReceiptTimestampMs(card && card.returnedAtMs)
    || taskCardReturnReceiptTimestampMs(card && card.returnedAt)
    || taskCardReturnReceiptTimestampMs(message.createdAtMs)
    || taskCardReturnReceiptTimestampMs(message.createdAt)
    || taskCardReturnReceiptTimestampMs(card && card.createdAtMs)
    || taskCardReturnReceiptTimestampMs(card && card.createdAt)
    || taskCardReturnReceiptTimestampMs(card && card.updatedAtMs)
    || taskCardReturnReceiptTimestampMs(card && card.updatedAt);
}

function taskCardTurnFlowTimeMs(turn) {
  const direct = taskCardReturnReceiptTimestampMs(turn && turn.completedAtMs)
    || taskCardReturnReceiptTimestampMs(turn && turn.completedAt)
    || taskCardReturnReceiptTimestampMs(turn && turn.finishedAtMs)
    || taskCardReturnReceiptTimestampMs(turn && turn.finishedAt)
    || taskCardReturnReceiptTimestampMs(turn && turn.updatedAtMs)
    || taskCardReturnReceiptTimestampMs(turn && turn.updatedAt)
    || taskCardReturnReceiptTimestampMs(turn && turn.startedAtMs)
    || taskCardReturnReceiptTimestampMs(turn && turn.startedAt)
    || taskCardReturnReceiptTimestampMs(turn && turn.createdAtMs)
    || taskCardReturnReceiptTimestampMs(turn && turn.createdAt);
  const items = Array.isArray(turn && turn.items) ? turn.items : [];
  const itemMax = items.reduce((max, item) => Math.max(max,
    taskCardReturnReceiptTimestampMs(item && item.completedAtMs)
      || taskCardReturnReceiptTimestampMs(item && item.completedAt)
      || taskCardReturnReceiptTimestampMs(item && item.updatedAtMs)
      || taskCardReturnReceiptTimestampMs(item && item.updatedAt)
      || taskCardReturnReceiptTimestampMs(item && item.startedAtMs)
      || taskCardReturnReceiptTimestampMs(item && item.startedAt)
      || taskCardReturnReceiptTimestampMs(item && item.createdAtMs)
      || taskCardReturnReceiptTimestampMs(item && item.createdAt)
      || taskCardReturnReceiptTimestampMs(item && item.timestampMs)
      || taskCardReturnReceiptTimestampMs(item && item.timestamp)
      || 0), 0);
  return Math.max(direct || 0, itemMax || 0);
}

function threadTaskCardReturnReceiptFlowEntries(thread, turns = []) {
  const safeTurns = Array.isArray(turns) ? turns : [];
  const turnEntries = safeTurns.map((turn, index) => ({
    kind: "turn",
    turn,
    flowMs: taskCardTurnFlowTimeMs(turn),
    order: index * 2,
    index,
  }));
  const receipts = typeof threadTaskCardReturnReceiptsForThread === "function"
    ? threadTaskCardReturnReceiptsForThread(thread)
    : [];
  const receiptEntries = receipts.map((card, index) => {
    const flowMs = taskCardReturnReceiptFlowTimeMs(card);
    let afterIndex = -1;
    if (flowMs > 0) {
      for (const entry of turnEntries) {
        if (entry.flowMs > 0 && entry.flowMs <= flowMs) afterIndex = entry.index;
      }
    } else if (turnEntries.length) {
      afterIndex = turnEntries[turnEntries.length - 1].index;
    }
    const baseOrder = afterIndex >= 0
      ? turnEntries[afterIndex].order + 1
      : turnEntries.length
        ? turnEntries[0].order - 1
        : 0;
    return {
      kind: "return-receipt",
      card,
      flowMs,
      order: baseOrder + index / 1000,
      index,
    };
  });
  return turnEntries.concat(receiptEntries)
    .sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      if (a.flowMs !== b.flowMs) return a.flowMs - b.flowMs;
      return a.index - b.index;
    });
}

function threadTaskCardReturnReceiptTurnIds(thread) {
  const receipts = typeof threadTaskCardReturnReceiptsForThread === "function"
    ? threadTaskCardReturnReceiptsForThread(thread)
    : [];
  return receipts.map(taskCardReturnReceiptTurnId).filter(Boolean);
}

function threadTaskCardReturnReceiptFlowTurnIds(thread, turns = []) {
  return threadTaskCardReturnReceiptFlowEntries(thread, turns)
    .map((entry) => {
      if (entry.kind === "turn") return String(entry.turn && entry.turn.id || "").trim();
      return taskCardReturnReceiptTurnId(entry.card);
    })
    .filter(Boolean);
}

function renderThreadTaskCardReturnReceiptTurn(card, previousKeys = new Set(), threadId = "") {
  const turnId = taskCardReturnReceiptTurnId(card);
  if (!turnId) return "";
  const key = `task-card-return-turn|${card.id}`;
  return `<article class="turn thread-task-card-return-turn${entryAnimationClass(key, previousKeys)}" data-turn="${escapeHtml(turnId)}" data-render-key="${escapeHtml(key)}" data-task-card-return-turn="${escapeHtml(card.id)}">
    ${renderThreadTaskCardReturnReceipt(card, previousKeys, threadId)}
  </article>`;
}

function renderThreadTaskCardReturnReceipts(thread, previousKeys = new Set()) {
  const receipts = typeof threadTaskCardReturnReceiptsForThread === "function"
    ? threadTaskCardReturnReceiptsForThread(thread)
    : [];
  if (!receipts.length) return "";
  const threadId = String(thread && thread.id || "").trim();
  return `<div class="thread-task-card-return-receipt-stack">
    ${receipts.map((card) => renderThreadTaskCardReturnReceiptTurn(card, previousKeys, threadId)).join("")}
  </div>`;
}

function renderThreadConversationFlowWithReturnReceipts(thread, turns = [], previousKeys = new Set(), renderTurnHtml = null) {
  const renderTurnEntry = typeof renderTurnHtml === "function"
    ? renderTurnHtml
    : () => "";
  const threadId = String(thread && thread.id || "").trim();
  return threadTaskCardReturnReceiptFlowEntries(thread, turns)
    .map((entry) => entry.kind === "turn"
      ? renderTurnEntry(entry.turn, previousKeys)
      : renderThreadTaskCardReturnReceiptTurn(entry.card, previousKeys, threadId))
    .join("");
}

function renderThreadTaskCards(thread, previousKeys = new Set()) {
  const cards = threadTaskCardsForThread(thread);
  if (!cards.length) return "";
  const threadId = String(thread && thread.id || "").trim();
  return `<div class="approval-stack thread-task-card-stack">
    ${cards.map((card) => renderThreadTaskCard(card, previousKeys, threadId)).join("")}
  </div>`;
}

function threadTaskCardDraftState(key) {
  return state.threadTaskCardDraftStates.get(String(key || "")) || { status: "pending", error: "", cardId: "" };
}

function threadTaskCardDraftStatusLabel(status) {
  return {
    pending: "Draft",
    creating: "Creating",
    created: "Created",
    dismissed: "Dismissed",
    failed: "Failed",
  }[status] || "Draft";
}

function threadTaskCardDraftDetailLines(draft, targetRefs, draftState) {
  const refs = Array.isArray(targetRefs) ? targetRefs : [];
  const targetLine = refs.length
    ? `Target threads: ${refs.map((entry) => {
      const thread = entry && entry.thread;
      return thread ? (thread.title || thread.id || entry.threadId) : (entry && entry.threadId || "");
    }).filter(Boolean).join(", ")}`
    : "";
  const missing = refs.filter((entry) => entry && !entry.thread).map((entry) => entry.threadId).filter(Boolean);
  return [
    targetLine,
    draft && draft.workflowMode === "autonomous" ? `Workflow: autonomous${draft.workflowId ? ` (${draft.workflowId})` : " (new)"}` : "",
    missing.length ? `Missing targets: ${missing.join(", ")}` : "",
    draft.error ? `Model note: ${draft.error}` : "",
    draftState.error ? `Last error: ${draftState.error}` : "",
  ].filter(Boolean);
}

function renderThreadTaskCardDraftActions(draftKey, draft, draftState, thread = renderContextThread()) {
  if (!draft || draftState.status === "pending" || draftState.status === "creating" || draftState.status === "created" || draftState.status === "dismissed") return "";
  const threadId = renderContextThreadId(thread);
  const threadAttr = threadId ? ` data-task-card-draft-thread-id="${escapeHtml(threadId)}"` : "";
  if (draftState.status === "failed") {
    return `<div class="approval-actions">
      <button class="approval-button deny" type="button" data-task-card-draft-action="dismiss" data-task-card-draft-key="${escapeHtml(draftKey)}"${threadAttr}>Dismiss</button>
    </div>`;
  }
  return `<div class="approval-actions">
    <button class="approval-button deny" type="button" data-task-card-draft-action="dismiss" data-task-card-draft-key="${escapeHtml(draftKey)}"${threadAttr}>Dismiss</button>
  </div>`;
}

function renderThreadTaskCardDraft(draft, item, turn, previousKeys = new Set(), draftKey = "", draftState = null, thread = renderContextThread()) {
  if (!draft || !item || !turn) return "";
  const contextThread = renderContextThread(thread);
  const resolvedDraftKey = draftKey || threadTaskCardDraftKeyForDraft(turn, draft, item);
  const resolvedDraftState = draftState || threadTaskCardDraftState(resolvedDraftKey);
  const targetRefs = threadTaskCardDraftTargetThreads(draft);
  const compact = resolvedDraftState.status === "created" || resolvedDraftState.status === "dismissed" ? " compact" : "";
  const detail = threadTaskCardDraftDetailLines(draft, targetRefs, resolvedDraftState).join("\n");
  const summary = threadTaskCardSummaryLine(draft.summary || draft.error || "");
  const detailBlocks = [
    detail ? `<pre class="approval-detail">${escapeHtml(detail)}</pre>` : "",
    draft.body ? `<pre class="approval-detail">${escapeHtml(draft.body)}</pre>` : "",
  ];
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
  const titles = {
    "item/commandExecution/requestApproval": "命令需要批准",
    "execCommandApproval": "命令需要批准",
    "item/fileChange/requestApproval": "文件改动需要批准",
    "applyPatchApproval": "文件改动需要批准",
    "item/permissions/requestApproval": "权限需要批准",
    "item/tool/requestUserInput": "需要你补充信息",
    "mcpServer/elicitation/request": "MCP 需要输入",
    "item/tool/call": "工具请求",
    "account/chatgptAuthTokens/refresh": "账号授权",
  };
  return titles[method] || "待处理请求";
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
      const lines = [
        question.header ? `${question.header}` : `问题 ${index + 1}`,
        question.question || "",
        Array.isArray(question.options) && question.options.length
          ? question.options.map((option) => `- ${option.label}${option.description ? `: ${option.description}` : ""}`).join("\n")
          : "",
      ].filter(Boolean);
      return lines.join("\n");
    }).join("\n\n") : "",
    params.title ? `标题:\n${params.title}` : "",
    params.message ? `说明:\n${params.message}` : "",
    params.schema ? `结构:\n${JSON.stringify(params.schema, null, 2)}` : "",
    params.elicitation ? `请求:\n${JSON.stringify(params.elicitation, null, 2)}` : "",
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
  const questions = Array.isArray(params.questions) ? params.questions : [];
  const question = questions[0] || {};
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
  if (!request.actionable || !waiting) {
    return "";
  }
  if (isUserInputRequest(request)) return renderUserInputActions(request, fallbackThreadId);
  const threadId = approvalActionThreadId(request, fallbackThreadId);
  return `<div class="approval-actions">
    <button class="approval-button allow" type="button" data-approval-id="${escapeHtml(request.id)}" data-approval-thread-id="${escapeHtml(threadId)}" data-approval-action="allow_once">允许一次</button>
    <button class="approval-button allow" type="button" data-approval-id="${escapeHtml(request.id)}" data-approval-thread-id="${escapeHtml(threadId)}" data-approval-action="allow_session">本会话允许</button>
    <button class="approval-button deny" type="button" data-approval-id="${escapeHtml(request.id)}" data-approval-thread-id="${escapeHtml(threadId)}" data-approval-action="deny">拒绝</button>
  </div>`;
}

function renderApprovalRequest(request, previousKeys = new Set(), fallbackThreadId = "") {
  const key = `approval|${request.id}`;
  const status = String(request.status || "waiting");
  if (isApprovalSettled(request)) {
    return `<section class="approval-card compact${entryAnimationClass(key, previousKeys)} ${escapeHtml(status)}" data-render-key="${escapeHtml(key)}" data-approval-card="${escapeHtml(request.id)}">
      <div class="approval-line">
        <span>${escapeHtml(approvalTitle(request.method))}</span>
        <span>${escapeHtml(approvalStatusLabel(request.status))}</span>
      </div>
    </section>`;
  }
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

function renderPendingApprovals(thread, previousKeys = new Set(), filter = null) {
  const threadId = String(thread && (thread.id || state.currentThreadId) || "").trim();
  const requests = pendingApprovalsForThread(threadId)
    .filter((request) => !filter || filter(request));
  if (!requests.length) return "";
  return `<div class="approval-stack">
    ${requests.map((request) => renderApprovalRequest(request, previousKeys, threadId)).join("")}
  </div>`;
}

function createTaskCardRuntime() {
  return {
    renderThreadTaskCard: typeof renderThreadTaskCard === "function" ? renderThreadTaskCard : null,
    renderThreadTaskCards: typeof renderThreadTaskCards === "function" ? renderThreadTaskCards : null,
    renderThreadTaskCardReturnReceipt: typeof renderThreadTaskCardReturnReceipt === "function" ? renderThreadTaskCardReturnReceipt : null,
    renderThreadTaskCardReturnReceiptTurn: typeof renderThreadTaskCardReturnReceiptTurn === "function" ? renderThreadTaskCardReturnReceiptTurn : null,
    renderThreadTaskCardReturnReceipts: typeof renderThreadTaskCardReturnReceipts === "function" ? renderThreadTaskCardReturnReceipts : null,
    renderThreadConversationFlowWithReturnReceipts: typeof renderThreadConversationFlowWithReturnReceipts === "function" ? renderThreadConversationFlowWithReturnReceipts : null,
    taskCardReturnReceiptTurnId: typeof taskCardReturnReceiptTurnId === "function" ? taskCardReturnReceiptTurnId : null,
    threadTaskCardReturnReceiptFlowEntries: typeof threadTaskCardReturnReceiptFlowEntries === "function" ? threadTaskCardReturnReceiptFlowEntries : null,
    threadTaskCardReturnReceiptFlowTurnIds: typeof threadTaskCardReturnReceiptFlowTurnIds === "function" ? threadTaskCardReturnReceiptFlowTurnIds : null,
    threadTaskCardReturnReceiptTurnIds: typeof threadTaskCardReturnReceiptTurnIds === "function" ? threadTaskCardReturnReceiptTurnIds : null,
    createThreadTaskCardFromCurrent: typeof createThreadTaskCardFromCurrent === "function" ? createThreadTaskCardFromCurrent : null,
    mutateThreadTaskCard: typeof mutateThreadTaskCard === "function" ? mutateThreadTaskCard : null,
    replyTaskCard: typeof replyTaskCard === "function" ? replyTaskCard : null,
    renderApprovalRequest: typeof renderApprovalRequest === "function" ? renderApprovalRequest : null,
  };
}

const taskCardRuntimeApi = Object.freeze({ createTaskCardRuntime });
const taskCardRuntimeRoot = typeof globalThis !== "undefined" ? globalThis : window;
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
    renderThreadConversationFlowWithReturnReceipts,
    renderThreadTaskCardReturnReceipt,
    renderThreadTaskCardReturnReceiptTurn,
    renderThreadTaskCardReturnReceipts,
    taskCardReturnReceiptTurnId,
    threadTaskCardReturnReceiptFlowEntries,
    threadTaskCardReturnReceiptFlowTurnIds,
    threadTaskCardReturnReceiptTurnIds,
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
    waitForCurrentThreadTurn,
  };
Object.assign(taskCardRuntimeRoot, legacyGlobals);
taskCardRuntimeRoot.CodexTaskCardRuntime = taskCardRuntimeApi;

export { createTaskCardRuntime };
export default taskCardRuntimeApi;
