"use strict";

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else if (root) {
    root.CodexThreadDetailDomPatch = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : null, function () {
  function result(ok, reason, counts = {}) {
    return Object.assign({
      ok: Boolean(ok),
      reason: String(reason || (ok ? "applied" : "unknown")),
      reused: 0,
      patched: 0,
      inserted: 0,
    }, counts);
  }

  function normalizeOperation(operation) {
    if (!operation || typeof operation !== "object") return null;
    const type = String(operation.type || "");
    const nextEntry = operation.nextEntry && typeof operation.nextEntry === "object" ? operation.nextEntry : null;
    const key = String(operation.key || (nextEntry && nextEntry.key) || "");
    if (!type || !key || !nextEntry) return null;
    return Object.assign({}, operation, { key, nextEntry, type });
  }

  function normalizeTurnOperation(operation) {
    if (!operation || typeof operation !== "object") return null;
    const type = String(operation.type || "");
    const key = String(operation.key || "");
    if (!type || !key) return null;
    return Object.assign({}, operation, { key, type });
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

  function firstTurnElementFrom(input) {
    if (typeof input.firstTurnElement === "function") return input.firstTurnElement() || null;
    return input.firstTurnElement || null;
  }

  function documentFrom(input = {}) {
    if (input.document && typeof input.document.createElement === "function") return input.document;
    if (typeof document !== "undefined" && document && typeof document.createElement === "function") return document;
    return null;
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
      html,
    });
  }

  function defaultEscapeSelectorAttr(value) {
    return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  function findElementByRenderKey(input = {}) {
    const root = input.root || input.conversation || null;
    if (!root || typeof root.querySelector !== "function") return null;
    const key = String(input.key || input.renderKey || input.turnKey || "");
    if (!key) return null;
    const escapeSelectorAttr = typeof input.escapeSelectorAttr === "function"
      ? input.escapeSelectorAttr
      : defaultEscapeSelectorAttr;
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
    if (!turn) return { ok: false, reason: "missing-turn", anchor: null };
    const visibleTurns = Array.isArray(input.visibleTurns) ? input.visibleTurns : [];
    const findTurnElement = typeof input.findTurnElement === "function" ? input.findTurnElement : null;
    if (!findTurnElement) return { ok: false, reason: "missing-find-turn-element", anchor: null };
    const turnIndex = visibleTurns.indexOf(turn);
    for (let index = turnIndex - 1; index >= 0; index -= 1) {
      const previous = findTurnElement(visibleTurns[index], index);
      if (previous) {
        return {
          ok: true,
          reason: "after-previous-turn",
          anchor: previous.nextSibling || null,
        };
      }
    }
    const firstTurn = firstTurnElementFrom(input);
    return {
      ok: true,
      reason: firstTurn ? "before-first-turn" : "append",
      anchor: firstTurn || null,
    };
  }

  function insertTurnArticleElement(input = {}) {
    const conversation = input.conversation;
    if (!conversation || typeof conversation.insertBefore !== "function") {
      return result(false, "missing-conversation");
    }
    const source = input.source || null;
    if (!source) return result(false, "missing-source");
    const anchorPlan = resolveTurnInsertAnchor(input);
    if (!anchorPlan.ok) return result(false, anchorPlan.reason || "insert-anchor-failed");
    conversation.insertBefore(source, anchorPlan.anchor || null);
    return result(true, anchorPlan.reason || "inserted", { inserted: 1 });
  }

  function applyVisibleItemRefreshDomPatch(input = {}) {
    const patchPlan = input.patchPlan;
    if (!patchPlan || !patchPlan.canPatch || !Array.isArray(patchPlan.operations)) {
      return result(false, "plan-not-patchable");
    }
    const article = input.article;
    if (!article || typeof article.insertBefore !== "function") {
      return result(false, "missing-article");
    }
    const findElementByKey = typeof input.findElementByKey === "function" ? input.findElementByKey : null;
    const renderElement = typeof input.renderElement === "function" ? input.renderElement : null;
    const patchElement = typeof input.patchElement === "function" ? input.patchElement : null;
    if (!findElementByKey) return result(false, "missing-find-element");
    if (!renderElement) return result(false, "missing-render-element");
    if (!patchElement) return result(false, "missing-patch-element");

    let lastPatchedNode = null;
    const counts = { reused: 0, patched: 0, inserted: 0 };
    for (const rawOperation of patchPlan.operations) {
      const operation = normalizeOperation(rawOperation);
      if (!operation) return result(false, "invalid-operation", counts);
      const nextEntry = operation.nextEntry;
      if (operation.type === "reuse" || operation.type === "patch") {
        const existingNode = findElementByKey(operation.key, nextEntry);
        if (!existingNode) return result(false, "missing-existing-node", counts);
        if (operation.type === "reuse") {
          lastPatchedNode = existingNode;
          counts.reused += 1;
          continue;
        }
        const patchedNode = patchElement(existingNode, nextEntry);
        if (!patchedNode) return result(false, "patch-existing-node-failed", counts);
        lastPatchedNode = patchedNode;
        counts.patched += 1;
        continue;
      }
      if (operation.type !== "insert") return result(false, "unknown-operation", counts);
      const source = renderElement(nextEntry);
      if (!source) return result(false, "render-insert-node-failed", counts);
      const anchor = lastPatchedNode ? lastPatchedNode.nextSibling : article.firstChild;
      article.insertBefore(source, anchor || null);
      lastPatchedNode = source;
      counts.inserted += 1;
    }
    return result(true, "applied", counts);
  }

  function applyThreadTurnRefreshDomPatch(input = {}) {
    const patchPlan = input.patchPlan;
    if (!patchPlan || !patchPlan.canPatch || !Array.isArray(patchPlan.operations)) {
      return result(false, "turn-patch-plan-not-patchable", { itemPatched: 0, replaced: 0 });
    }
    const findTurnByKey = typeof input.findTurnByKey === "function" ? input.findTurnByKey : null;
    const applyItemPatch = typeof input.applyItemPatch === "function" ? input.applyItemPatch : null;
    const renderTurnElement = typeof input.renderTurnElement === "function" ? input.renderTurnElement : null;
    const insertTurnElement = typeof input.insertTurnElement === "function" ? input.insertTurnElement : null;
    const replaceTurnElement = typeof input.replaceTurnElement === "function" ? input.replaceTurnElement : null;
    if (!findTurnByKey) return result(false, "missing-find-turn", { itemPatched: 0, replaced: 0 });
    if (!applyItemPatch) return result(false, "missing-apply-item-patch", { itemPatched: 0, replaced: 0 });
    if (!renderTurnElement) return result(false, "missing-render-turn", { itemPatched: 0, replaced: 0 });
    if (!insertTurnElement) return result(false, "missing-insert-turn", { itemPatched: 0, replaced: 0 });
    if (!replaceTurnElement) return result(false, "missing-replace-turn", { itemPatched: 0, replaced: 0 });

    const counts = { reused: 0, patched: 0, inserted: 0, itemPatched: 0, replaced: 0 };
    for (const rawOperation of patchPlan.operations) {
      const operation = normalizeTurnOperation(rawOperation);
      if (!operation) return result(false, "invalid-turn-operation", counts);
      const turn = findTurnByKey(operation.key, operation);
      if (!turn) return result(false, "turn-patch-operation-missing-turn", counts);
      if (operation.type === "item-patch") {
        const itemPatchResult = applyItemPatch(turn, operation);
        if (!callbackOk(itemPatchResult)) return result(false, callbackReason(itemPatchResult, "item-patch-failed"), counts);
        counts.itemPatched += 1;
        counts.patched += 1;
        continue;
      }
      if (operation.type !== "insert-turn" && operation.type !== "replace-turn") {
        return result(false, "unknown-turn-patch-operation", counts);
      }
      const source = renderTurnElement(turn, operation);
      if (!source) return result(false, "render-turn-failed", counts);
      if (operation.type === "insert-turn") {
        const insertResult = insertTurnElement(source, turn, operation);
        if (!callbackOk(insertResult)) return result(false, callbackReason(insertResult, "insert-turn-failed"), counts);
        counts.inserted += 1;
        continue;
      }
      const replaceResult = replaceTurnElement(source, turn, operation);
      if (!callbackOk(replaceResult)) return result(false, callbackReason(replaceResult, "replace-turn-failed"), counts);
      counts.replaced += 1;
      counts.patched += 1;
    }
    return result(true, "applied", counts);
  }

  return {
    applyThreadTurnRefreshDomPatch,
    applyVisibleItemRefreshDomPatch,
    createElementFromHtml,
    createTurnArticleElement,
    findElementByRenderKey,
    findTurnArticleElement,
    insertTurnArticleElement,
    normalizeOperation,
    normalizeTurnOperation,
    resolveTurnInsertAnchor,
  };
}));
