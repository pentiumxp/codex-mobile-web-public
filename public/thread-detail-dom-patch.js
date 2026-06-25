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
    normalizeOperation,
    normalizeTurnOperation,
  };
}));
