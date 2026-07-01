"use strict";

function optional(fn, fallback) {
  return typeof fn === "function" ? fn : fallback;
}

function createThreadDetailActiveTurnEvidenceService(dependencies = {}) {
  const fs = dependencies.fs || require("node:fs");
  const statusText = optional(dependencies.statusText, (value) => String(value || ""));
  const timestampToMs = optional(dependencies.timestampToMs, () => 0);
  const rolloutActiveStatusWindowMs = Math.max(0, Number(dependencies.rolloutActiveStatusWindowMs || 120000) || 0);
  const rolloutPathForThread = optional(dependencies.rolloutPathForThread, (thread) => thread && (thread.path || thread.rolloutPath || thread.rollout_path) || "");
  const readStateDbThread = optional(dependencies.readStateDbThread, () => null);
  const rolloutLatestTurnEvidence = optional(dependencies.rolloutLatestTurnEvidence, () => null);
  const isThreadListLiveStatus = optional(dependencies.isThreadListLiveStatus, (status) => /active|running|queued|processing|inprogress|in_progress|in-progress/i.test(statusText(status)));
  const isThreadListRestStatus = optional(dependencies.isThreadListRestStatus, (status) => /idle|completed|failed|cancel|error|interrupted|notloaded|not_loaded/i.test(statusText(status)));
  const isEndedTurn = optional(dependencies.isEndedTurn, (turn) => Boolean(turn && (turn.completedAt || turn.durationMs || isCompletedStatus(turn.status))));
  const isUserQuestionItem = optional(dependencies.isUserQuestionItem, (item) => item && item.type === "userMessage");
  const userMessageHasVisualAttachment = optional(dependencies.userMessageHasVisualAttachment, () => false);
  const isTurnUsageSummaryItem = optional(dependencies.isTurnUsageSummaryItem, (item) => item && item.type === "turnUsageSummary");
  const isOperationalItem = optional(dependencies.isOperationalItem, (item) => item && /operation|command|tool|mcp|collab/i.test(String(item.type || "")));
  const isAssistantReceiptItem = optional(dependencies.isAssistantReceiptItem, (item) => item && (item.type === "agentMessage" || item.type === "assistantMessage"));
  const isVisualReceiptItem = optional(dependencies.isVisualReceiptItem, (item) => item && (item.type === "imageView" || item.type === "imageGeneration"));
  const isTurnDiagnosticItem = optional(dependencies.isTurnDiagnosticItem, (item) => item && /diagnostic/i.test(String(item.type || "")));
  const isContextCompactionType = optional(dependencies.isContextCompactionType, (type) => /context.*compaction|context.*compression|context_compaction|context_compression/i.test(String(type || "")));

  function isCompletedStatus(status) {
    return /completed|failed|cancel|error|interrupted/i.test(statusText(status));
  }

  function isLiveTurn(turn) {
    const text = statusText(turn && turn.status).toLowerCase();
    return /(running|active|queued|processing|inprogress|in_progress|in-progress)/.test(text)
      || (text === "interrupted" && turn && !turn.completedAt && !turn.durationMs);
  }

  function completedSupersededStatus(status) {
    const previous = statusText(status);
    const out = status && typeof status === "object" ? Object.assign({}, status) : {};
    out.type = "completed";
    out.mobileSupersededLive = true;
    if (previous && !out.previousType) out.previousType = previous;
    return out;
  }

  function normalizeSupersededLiveTurns(thread) {
    if (!thread || !Array.isArray(thread.turns) || thread.turns.length < 2) return thread;
    for (let index = 0; index < thread.turns.length - 1; index += 1) {
      const turn = thread.turns[index];
      if (!turn || !isLiveTurn(turn)) continue;
      turn.status = completedSupersededStatus(turn.status);
      turn.mobileSupersededLive = true;
    }
    return thread;
  }

  function isSupersededLiveTurn(turn) {
    return Boolean(turn && (turn.mobileSupersededLive || (turn.status && turn.status.mobileSupersededLive)));
  }

  function isReasoningOnlyItem(item) {
    return Boolean(item && item.type === "reasoning");
  }

  function isMeaningfulSupersededLiveItem(item) {
    if (!item || typeof item !== "object") return false;
    if (userMessageHasVisualAttachment(item)) return true;
    if (isUserQuestionItem(item)) return false;
    if (isReasoningOnlyItem(item)) return false;
    if (isTurnUsageSummaryItem(item)) return false;
    if (isOperationalItem(item)) return false;
    return isAssistantReceiptItem(item) || isVisualReceiptItem(item) || isTurnDiagnosticItem(item) || isContextCompactionType(item.type);
  }

  function pruneSupersededLiveShellTurns(thread) {
    if (!thread || !Array.isArray(thread.turns)) return thread;
    thread.turns = thread.turns.filter((turn) => {
      if (!isSupersededLiveTurn(turn)) return true;
      const items = Array.isArray(turn.items) ? turn.items : [];
      if (!items.some(isMeaningfulSupersededLiveItem)) return false;
      turn.items = items.filter((item) => (!isUserQuestionItem(item) || userMessageHasVisualAttachment(item)) && !isReasoningOnlyItem(item));
      return true;
    });
    return thread;
  }

  function turnIdentifier(turn) {
    return String(turn && (turn.id || turn.turnId) || "");
  }

  function turnTimestampFromFields(turn, fields) {
    for (const field of fields) {
      const value = timestampToMs(turn && turn[field]);
      if (value) return value;
    }
    return 0;
  }

  function turnStartedAtMs(turn) {
    return turnTimestampFromFields(turn, [
      "startedAtMs",
      "startedAt",
      "started_at_ms",
      "started_at",
      "createdAtMs",
      "createdAt",
      "created_at_ms",
      "created_at",
    ]);
  }

  function turnHasNoVisibleItems(turn) {
    const items = Array.isArray(turn && turn.items) ? turn.items : [];
    return !items.some(Boolean);
  }

  function isUnmaterializedLiveTurnShell(turn) {
    if (!turn || !isLiveTurn(turn) || isEndedTurn(turn)) return false;
    return turnHasNoVisibleItems(turn);
  }

  function itemLooksLikeActiveRuntime(item) {
    if (!item || typeof item !== "object" || isCompletedStatus(item.status)) return false;
    if (item.type === "reasoning" || isOperationalItem(item)) return true;
    if (item.type === "agentMessage" || item.type === "plan") return true;
    return isUserQuestionItem(item) || userMessageHasVisualAttachment(item);
  }

  function turnHasMaterializedActiveRuntime(turn) {
    const items = Array.isArray(turn && turn.items) ? turn.items : [];
    return items.some(itemLooksLikeActiveRuntime);
  }

  function latestMaterializedActiveTurnCandidate(turns, excludedTurnIds = new Set()) {
    for (let index = Array.isArray(turns) ? turns.length - 1 : -1; index >= 0; index -= 1) {
      const turn = turns[index];
      const turnId = turnIdentifier(turn);
      if (!turnId || excludedTurnIds.has(turnId) || isEndedTurn(turn)) continue;
      if (turnHasMaterializedActiveRuntime(turn)) return turn;
    }
    return null;
  }

  function rolloutEvidenceHasRuntimeActivity(evidence) {
    return Boolean(evidence && !evidence.hasTerminal
      && evidence.turnId
      && (evidence.hasVisibleUser || evidence.hasAssistant || evidence.hasOperation));
  }

  function rolloutEvidenceIsRecent(evidence, nowMs = Date.now()) {
    const lastActivityMs = Number(evidence && evidence.lastActivityMs || 0);
    if (!lastActivityMs) return false;
    return Math.max(0, Number(nowMs || Date.now()) - lastActivityMs) <= rolloutActiveStatusWindowMs;
  }

  function rolloutLatestEvidenceForThread(thread, options = {}) {
    if (!thread || typeof thread !== "object") return null;
    let rolloutPath = rolloutPathForThread(thread);
    if (!rolloutPath && thread.id) {
      const stateThread = readStateDbThread(thread.id);
      rolloutPath = rolloutPathForThread(stateThread);
    }
    if (!rolloutPath) return null;
    let stat = options.stat || null;
    if (!stat) {
      try {
        stat = fs.statSync(rolloutPath);
      } catch (_) {
        stat = null;
      }
    }
    return rolloutLatestTurnEvidence(rolloutPath, stat);
  }

  function activeRuntimeEvidenceForThread(thread, options = {}) {
    const evidence = rolloutLatestEvidenceForThread(thread, options);
    if (!rolloutEvidenceHasRuntimeActivity(evidence)) return null;
    return evidence;
  }

  function activeStatusFromRuntimeEvidence(previousStatus) {
    const previousType = statusText(previousStatus);
    const status = {
      type: "active",
      mobileRuntimeDerived: true,
    };
    if (previousType && previousType !== "active") status.previousType = previousType;
    return status;
  }

  function reconcileThreadActiveTurnWithRolloutEvidence(thread, options = {}) {
    if (!thread || typeof thread !== "object" || !Array.isArray(thread.turns)) return thread;
    const turns = thread.turns;
    const shouldReconcile = isThreadListLiveStatus(thread.status)
      || Boolean(thread.activeTurnId)
      || Boolean(thread.mobileLocalActiveStatus)
      || turns.some(isLiveTurn);
    if (!shouldReconcile) return thread;
    const evidence = activeRuntimeEvidenceForThread(thread, options);
    const unmaterializedShellIds = new Set(
      turns.filter(isUnmaterializedLiveTurnShell)
        .map(turnIdentifier)
        .filter(Boolean),
    );
    if (unmaterializedShellIds.size && isThreadListRestStatus(thread.status)) {
      const dropped = [];
      thread.turns = turns.filter((turn) => {
        const turnId = turnIdentifier(turn);
        if (!turnId || !unmaterializedShellIds.has(turnId)) return true;
        dropped.push(turnId);
        return false;
      });
      if (dropped.length) {
        thread.mobileDroppedUnmaterializedRestingActiveTurn = dropped[0];
        if (dropped.includes(String(thread.activeTurnId || ""))) delete thread.activeTurnId;
        if (thread.mobileLocalActiveStatus && dropped.includes(String(thread.mobileLocalActiveStatus.turnId || ""))) {
          delete thread.mobileLocalActiveStatus;
        }
      }
      return thread;
    }
    if (!evidence && !unmaterializedShellIds.size) return thread;
    if (evidence && !rolloutEvidenceIsRecent(evidence, options.nowMs || Date.now()) && !isThreadListLiveStatus(thread.status)) {
      return thread;
    }
    const materializedCandidate = latestMaterializedActiveTurnCandidate(turns, unmaterializedShellIds);
    const activeTurnId = String((evidence && evidence.turnId) || turnIdentifier(materializedCandidate) || "").trim();
    if (!activeTurnId) return thread;

    const dropped = [];
    thread.turns = turns.filter((turn) => {
      const turnId = turnIdentifier(turn);
      if (!turnId || turnId === activeTurnId) return true;
      if (!isUnmaterializedLiveTurnShell(turn)) return true;
      dropped.push(turnId);
      return false;
    });

    const activeTurn = thread.turns.find((turn) => turnIdentifier(turn) === activeTurnId) || null;
    if (!activeTurn || isEndedTurn(activeTurn)) return thread;

    thread.status = activeStatusFromRuntimeEvidence(thread.status);
    thread.activeTurnId = activeTurnId;
    activeTurn.status = activeStatusFromRuntimeEvidence(activeTurn.status);
    if (!turnStartedAtMs(activeTurn)) {
      const startedAtMs = Number((evidence && (evidence.startedAtMs || evidence.lastActivityMs)) || 0);
      if (startedAtMs) activeTurn.startedAt = Math.floor(startedAtMs / 1000);
    }
    if (evidence) {
      thread.mobileRolloutActiveTurn = {
        turnId: activeTurnId,
        startedAtMs: Math.trunc(Number(evidence.startedAtMs || 0)),
        lastActivityMs: Math.trunc(Number(evidence.lastActivityMs || 0)),
      };
    }
    if (dropped.length) {
      thread.mobileDroppedUnmaterializedLocalActiveTurn = dropped[0];
      if (thread.mobileLocalActiveStatus && dropped.includes(String(thread.mobileLocalActiveStatus.turnId || ""))) {
        delete thread.mobileLocalActiveStatus;
      }
    }
    return thread;
  }

  return {
    activeRuntimeEvidenceForThread,
    activeStatusFromRuntimeEvidence,
    completedSupersededStatus,
    isCompletedStatus,
    isLiveTurn,
    isMeaningfulSupersededLiveItem,
    isReasoningOnlyItem,
    isSupersededLiveTurn,
    isUnmaterializedLiveTurnShell,
    itemLooksLikeActiveRuntime,
    latestMaterializedActiveTurnCandidate,
    normalizeSupersededLiveTurns,
    pruneSupersededLiveShellTurns,
    reconcileThreadActiveTurnWithRolloutEvidence,
    rolloutEvidenceHasRuntimeActivity,
    rolloutEvidenceIsRecent,
    rolloutLatestEvidenceForThread,
    turnHasMaterializedActiveRuntime,
    turnHasNoVisibleItems,
    turnIdentifier,
    turnStartedAtMs,
    turnTimestampFromFields,
  };
}

module.exports = {
  createThreadDetailActiveTurnEvidenceService,
};
