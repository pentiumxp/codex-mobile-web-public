"use strict";

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
    transferSubmittedTurnIdentity,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  globalScope.CodexClientRenderStabilityGuard = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
