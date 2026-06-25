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

  return {
    applyVisibleItemRefreshDomPatch,
    normalizeOperation,
  };
}));
