function normalizePatchEntry(entry) {
    if (!entry || typeof entry !== "object") return null;
    const key = String(entry.key || "");
    if (!key) return null;
    return Object.assign({}, entry, { key });
  }

  function normalizeRefreshTurnPatchEntry(entry) {
    if (!entry || typeof entry !== "object") return null;
    const key = String(entry.key || "");
    if (!key) return null;
    return {
      key,
      hasPreviousTurn: Boolean(entry.hasPreviousTurn),
      itemPatchable: Boolean(entry.itemPatchable),
      articlePresent: Boolean(entry.articlePresent),
    };
  }

  function normalizedStringList(value) {
    return Array.isArray(value) ? value.map((entry) => String(entry || "")).filter(Boolean) : [];
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

  function planThreadDetailDomPatchSurface(input = {}) {
    const threadId = String(input.threadId || "").trim();
    const threadTileMode = Boolean(input.threadTileMode);
    const threadTileSurface = Boolean(input.threadTileSurface);
    const tilePaneVisible = Boolean(input.tilePaneVisible);
    const conversationPresent = Boolean(input.conversationPresent);
    if (threadTileSurface) {
      if (!threadTileMode) {
        return { canPatch: false, surface: "blocked", reason: "tile-surface-without-tile-mode", threadId };
      }
      if (!threadId) {
        return { canPatch: false, surface: "thread-tile-pane", reason: "missing-thread-id", threadId: "" };
      }
      if (!tilePaneVisible) {
        return { canPatch: false, surface: "thread-tile-pane", reason: "tile-pane-not-visible", threadId };
      }
      return { canPatch: true, surface: "thread-tile-pane", reason: "tile-pane-visible", threadId };
    }
    if (!conversationPresent) {
      return { canPatch: false, surface: "single-thread", reason: "missing-conversation", threadId };
    }
    return { canPatch: true, surface: "single-thread", reason: "single-thread-surface", threadId };
  }

  function planThreadDetailRefreshLocalPatchPreflight(input = {}) {
    const conversationPresent = Boolean(input.conversationPresent);
    const previousThreadPresent = Boolean(input.previousThreadPresent);
    const nextThreadPresent = Boolean(input.nextThreadPresent);
    if (!conversationPresent) return { canPatch: false, terminal: false, reason: "missing-conversation-root" };
    if (!previousThreadPresent || !nextThreadPresent) return { canPatch: false, terminal: false, reason: "missing-thread" };
    const stage = String(input.stage || "complete");
    if (stage === "root") return { canPatch: true, terminal: false, reason: "root-ready" };
    if (input.tilePanePatched) return { canPatch: true, terminal: true, reason: "tile-pane-patched" };
    if (!input.singleThreadSurfaceAvailable) return { canPatch: false, terminal: false, reason: "single-thread-surface-unavailable" };
    if (input.previousLoadingOrError || input.nextLoadingOrError) return { canPatch: false, terminal: false, reason: "loading-or-error-state" };
    const renderedConversationSignature = signatureText(input.renderedConversationSignature);
    const previousConversationSignature = signatureText(input.previousConversationSignature);
    const renderedPatchShellSignature = signatureText(input.renderedPatchShellSignature);
    const previousPatchShellSignature = signatureText(input.previousPatchShellSignature);
    const nextPatchShellSignature = signatureText(input.nextPatchShellSignature);
    if (renderedConversationSignature !== previousConversationSignature
      && (!renderedPatchShellSignature || renderedPatchShellSignature !== previousPatchShellSignature)) {
      return { canPatch: false, terminal: false, reason: "rendered-dom-stale" };
    }
    if (previousPatchShellSignature !== nextPatchShellSignature) {
      return { canPatch: false, terminal: false, reason: "patch-shell-changed" };
    }
    return { canPatch: true, terminal: false, reason: "preflight-passed" };
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

  function patchEntryKind(entry) {
    if (!entry || typeof entry !== "object") return "";
    const signature = entry.signature && typeof entry.signature === "object" ? entry.signature : null;
    const item = entry.item && typeof entry.item === "object" ? entry.item : null;
    return String((signature && signature.type) || (item && item.type) || entry.type || "");
  }

  function visibleUserMessagePatchKeysPreserved(previousEntries, nextEntries) {
    if (!Array.isArray(previousEntries) || !Array.isArray(nextEntries)) return false;
    const previous = previousEntries.map(normalizePatchEntry).filter(Boolean);
    const next = nextEntries.map(normalizePatchEntry).filter(Boolean);
    if (previous.length !== previousEntries.length || next.length !== nextEntries.length) return false;
    const previousKeys = previous
      .filter((entry) => patchEntryKind(entry) === "userMessage")
      .map((entry) => entry.key);
    const nextKeys = next
      .filter((entry) => patchEntryKind(entry) === "userMessage")
      .map((entry) => entry.key);
    if (previousKeys.length !== nextKeys.length) return false;
    return previousKeys.every((key, index) => key === nextKeys[index]);
  }

  function planVisibleItemRefreshPatch(previousEntries, nextEntries) {
    if (!visibleItemPatchShapePreservesExisting(previousEntries, nextEntries)) {
      return {
        canPatch: false,
        reason: "shape-changed",
        operations: [],
      };
    }
    if (!visibleUserMessagePatchKeysPreserved(previousEntries, nextEntries)) {
      return {
        canPatch: false,
        reason: "user-message-shape-changed",
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

  function planThreadDetailRefreshDomPatch(entries, options = {}) {
    if (!Array.isArray(entries)) {
      return {
        canPatch: false,
        reason: "invalid-turn-entries",
        operations: [],
      };
    }
    const operations = [];
    const nextKeys = new Set();
    for (const rawEntry of entries) {
      const entry = normalizeRefreshTurnPatchEntry(rawEntry);
      if (!entry) {
        return {
          canPatch: false,
          reason: "invalid-turn-entry",
          operations: [],
        };
      }
      nextKeys.add(entry.key);
      if (entry.hasPreviousTurn && entry.itemPatchable && entry.articlePresent) {
        operations.push({
          type: "item-patch",
          key: entry.key,
          entry,
        });
        continue;
      }
      operations.push({
        type: entry.articlePresent ? "replace-turn" : "insert-turn",
        key: entry.key,
        entry,
      });
    }
    const previousTurnKeys = normalizedStringList(options.previousTurnKeys || options.previousKeys);
    for (const previousKey of previousTurnKeys) {
      if (nextKeys.has(previousKey)) continue;
      operations.push({
        type: "remove-turn",
        key: previousKey,
        entry: {
          key: previousKey,
          stale: true,
        },
      });
    }
    return {
      canPatch: true,
      reason: "planned",
      operations,
    };
  }


const api = {
    normalizePatchEntry,
    normalizeRefreshTurnPatchEntry,
    planThreadDetailRefreshDomPatch,
    planThreadDetailRefreshLocalPatchPreflight,
    planVisibleItemRefreshPatch,
    planThreadDetailDomPatchSurface,
    visibleItemPatchShapePreservesExisting,
    visibleUserMessagePatchKeysPreserved,
};

export {
  normalizePatchEntry,
  normalizeRefreshTurnPatchEntry,
  planThreadDetailRefreshDomPatch,
  planThreadDetailRefreshLocalPatchPreflight,
  planVisibleItemRefreshPatch,
  planThreadDetailDomPatchSurface,
  visibleItemPatchShapePreservesExisting,
  visibleUserMessagePatchKeysPreserved,
};

export default api;
