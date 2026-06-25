"use strict";

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else if (root) {
    root.CodexThreadDetailPatchPlan = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : null, function () {
  function normalizePatchEntry(entry) {
    if (!entry || typeof entry !== "object") return null;
    const key = String(entry.key || "");
    if (!key) return null;
    return Object.assign({}, entry, { key });
  }

  function signatureText(signature) {
    if (signature == null) return "";
    if (typeof signature === "string") return signature;
    try {
      return JSON.stringify(signature);
    } catch (_) {
      return "";
    }
  }

  function visibleItemPatchShapePreservesExisting(previousEntries, nextEntries) {
    if (!Array.isArray(previousEntries) || !Array.isArray(nextEntries)) return false;
    const previous = previousEntries.map(normalizePatchEntry).filter(Boolean);
    const next = nextEntries.map(normalizePatchEntry).filter(Boolean);
    if (previous.length !== previousEntries.length || next.length !== nextEntries.length) return false;
    if (previous.length > next.length) return false;
    let previousIndex = 0;
    for (const nextEntry of next) {
      const previousEntry = previous[previousIndex];
      if (previousEntry && previousEntry.key === nextEntry.key) previousIndex += 1;
    }
    return previousIndex === previous.length;
  }

  function planVisibleItemRefreshPatch(previousEntries, nextEntries) {
    if (!visibleItemPatchShapePreservesExisting(previousEntries, nextEntries)) {
      return {
        canPatch: false,
        reason: "shape-changed",
        operations: [],
      };
    }
    const previousByKey = new Map(previousEntries.map(normalizePatchEntry)
      .filter(Boolean)
      .map((entry) => [entry.key, entry]));
    const operations = [];
    for (const rawNextEntry of nextEntries) {
      const nextEntry = normalizePatchEntry(rawNextEntry);
      if (!nextEntry) {
        return {
          canPatch: false,
          reason: "invalid-entry",
          operations: [],
        };
      }
      const previousEntry = previousByKey.get(nextEntry.key);
      if (!previousEntry) {
        operations.push({
          type: "insert",
          key: nextEntry.key,
          nextEntry,
        });
        continue;
      }
      const previousSignature = signatureText(previousEntry.signature);
      const nextSignature = signatureText(nextEntry.signature);
      operations.push({
        type: previousSignature === nextSignature ? "reuse" : "patch",
        key: nextEntry.key,
        previousEntry,
        nextEntry,
      });
    }
    return {
      canPatch: true,
      reason: "shape-preserved",
      operations,
    };
  }

  return {
    normalizePatchEntry,
    planVisibleItemRefreshPatch,
    visibleItemPatchShapePreservesExisting,
  };
}));
