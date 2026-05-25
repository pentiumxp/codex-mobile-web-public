"use strict";

function statusText(status) {
  if (typeof status === "string") return status;
  if (status && typeof status === "object") {
    return String(status.type || status.status || status.state || "");
  }
  return "";
}

function isCompletedStatus(status) {
  return /completed|failed|cancel|error|interrupted/i.test(statusText(status));
}

function isLiveStatus(status) {
  const text = statusText(status).toLowerCase();
  return /(running|active|queued|processing|inprogress|in_progress|in-progress)/.test(text)
    || text === "pending"
    || text === "started";
}

function isLiveTurn(turn) {
  if (!turn || typeof turn !== "object") return false;
  if (isCompletedStatus(turn.status)) return false;
  return isLiveStatus(turn.status) || (!turn.completedAt && !turn.durationMs && isLiveStatus(turn.state));
}

function turnListFromResult(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result && result.data)) return result.data;
  if (Array.isArray(result && result.turns)) return result.turns;
  return [];
}

function turnIdentifier(turn) {
  return String(turn && (turn.id || turn.turnId) || "");
}

function latestTurnFromResult(result) {
  const turns = turnListFromResult(result);
  if (!turns.length) return null;
  return turns[0];
}

function itemIsPending(item) {
  if (!item || typeof item !== "object") return false;
  if (isCompletedStatus(item.status)) return false;
  return isLiveStatus(item.status) || isLiveStatus(item.state);
}

function hasPendingItem(turn) {
  return Array.isArray(turn && turn.items) && turn.items.some(itemIsPending);
}

function lastVisibleItem(turn) {
  const items = Array.isArray(turn && turn.items) ? turn.items : [];
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item && typeof item === "object") return item;
  }
  return null;
}

function itemType(item) {
  return String(item && (item.type || item.kind || item.name) || "");
}

function isTerminalIdleBoundaryItem(item) {
  if (!item || itemIsPending(item)) return false;
  const type = itemType(item);
  if (/contextCompaction/i.test(type)) return true;
  if (/command|tool|file|search|exec|patch/i.test(type)) {
    const status = statusText(item.status).toLowerCase();
    return !status || isCompletedStatus(status);
  }
  return false;
}

function hasTerminalIdleBoundary(turn) {
  return isTerminalIdleBoundaryItem(lastVisibleItem(turn));
}

function hasMatchingPendingRequest(requests, threadId, turnId) {
  if (!Array.isArray(requests) || !requests.length) return false;
  const wantedThread = String(threadId || "");
  const wantedTurn = String(turnId || "");
  return requests.some((request) => {
    if (!request || typeof request !== "object") return false;
    const requestThread = String(request.threadId || request.thread_id || request.thread || "");
    const requestTurn = String(request.turnId || request.turn_id || request.turn || "");
    return (wantedTurn && requestTurn === wantedTurn)
      || (wantedThread && requestThread === wantedThread);
  });
}

function detectStaleActiveTurnForSubmission(options = {}) {
  const activeTurnId = String(options.activeTurnId || "");
  if (!activeTurnId) return { stale: false, reason: "no-active-turn" };

  const staleMs = Math.max(30_000, Number(options.staleMs || 180_000));
  const terminalIdleMs = Math.max(10_000, Number(options.terminalIdleMs || 45_000));
  const nowMs = Number.isFinite(Number(options.nowMs)) ? Number(options.nowMs) : Date.now();
  const rolloutStats = options.rolloutStats || {};
  const mtimeMs = Number(rolloutStats.mtimeMs || rolloutStats.updatedAtMs || 0);
  if (!mtimeMs) return { stale: false, reason: "no-rollout-mtime" };
  const quietMs = Math.max(0, nowMs - mtimeMs);

  const latestTurn = latestTurnFromResult(options.turnsResult || options.latestTurns || []);
  if (!latestTurn) return { stale: false, reason: "no-latest-turn", quietMs };
  const turns = turnListFromResult(options.turnsResult || options.latestTurns || []);
  const latestTurnId = turnIdentifier(latestTurn);
  if (latestTurnId !== activeTurnId) {
    if (hasMatchingPendingRequest(options.pendingServerRequests, options.threadId, activeTurnId)) {
      return { stale: false, reason: "pending-server-request", quietMs, latestTurnId };
    }
    const activeTurnIndex = turns.findIndex((turn) => turnIdentifier(turn) === activeTurnId);
    const activeTurn = activeTurnIndex >= 0 ? turns[activeTurnIndex] : null;
    if (activeTurn && hasPendingItem(activeTurn)) {
      return { stale: false, reason: "pending-item", quietMs, latestTurnId };
    }
    if (activeTurnIndex > 0) {
      return { stale: true, reason: "active-turn-superseded", quietMs, latestTurnId };
    }
    if (quietMs >= terminalIdleMs) {
      return { stale: true, reason: "active-turn-missing", quietMs, latestTurnId };
    }
    return { stale: false, reason: "active-turn-not-latest-recent", quietMs, latestTurnId };
  }
  if (!isLiveTurn(latestTurn)) {
    return { stale: false, reason: "latest-turn-not-live", quietMs, latestTurnId };
  }
  if (hasPendingItem(latestTurn)) {
    return { stale: false, reason: "pending-item", quietMs, latestTurnId };
  }
  if (hasMatchingPendingRequest(options.pendingServerRequests, options.threadId, activeTurnId)) {
    return { stale: false, reason: "pending-server-request", quietMs, latestTurnId };
  }
  if (quietMs >= terminalIdleMs && hasTerminalIdleBoundary(latestTurn)) {
    return { stale: false, reason: "latest-live-terminal-idle", quietMs, latestTurnId };
  }
  if (quietMs >= staleMs) {
    return { stale: false, reason: "latest-live-rollout-quiet", quietMs, latestTurnId };
  }
  return { stale: false, reason: "active-turn-latest-live", quietMs, latestTurnId };
}

module.exports = {
  detectStaleActiveTurnForSubmission,
  hasMatchingPendingRequest,
  hasPendingItem,
  hasTerminalIdleBoundary,
  isLiveTurn,
  itemIsPending,
};
