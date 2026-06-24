"use strict";

const path = require("node:path");

function normalizeFsPath(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return path.resolve(text).toLowerCase();
}

function defaultThreadDisplayTitle(thread) {
  if (!thread || typeof thread !== "object") return "";
  return String(thread.name || thread.title || thread.threadName || thread.thread_name || thread.id || "").trim();
}

function defaultVisibilityFromGlobalState() {
  return {
    workspaceKeys: new Set(),
    workspaceNames: new Set(),
    projectlessThreadIds: new Set(),
  };
}

function defaultCreateError(statusCode, code, message, details = {}) {
  const err = new Error(message || code);
  err.statusCode = statusCode;
  err.code = code;
  err.details = details && typeof details === "object" ? details : {};
  return err;
}

function threadTaskCardTargetReferenceText(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return String(value.threadId || value.id || value.cwd || value.workspace || value.title || value.name || value.label || "").trim();
  }
  return String(value || "").trim();
}

function threadTaskCardTargetReferenceEntry(kind, value) {
  const text = threadTaskCardTargetReferenceText(value);
  if (!text) return null;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    if (value.threadId || value.id) kind = "threadId";
    else if (value.cwd || value.workspace) kind = "workspace";
    else if (value.title || value.name || value.label) kind = "title";
  }
  return { kind, text };
}

function threadTaskCardTargetReferenceEntries(body = {}) {
  const values = [];
  const push = (kind, value) => {
    const entry = threadTaskCardTargetReferenceEntry(kind, value);
    if (entry) values.push(entry);
  };
  if (Array.isArray(body.targetThreadIds)) body.targetThreadIds.forEach((value) => push("threadId", value));
  if (body.targetThreadId) push("threadId", body.targetThreadId);
  if (Array.isArray(body.targetThreads)) body.targetThreads.forEach((value) => push("thread", value));
  if (Array.isArray(body.targetThreadRefs)) body.targetThreadRefs.forEach((value) => push("thread", value));
  if (Array.isArray(body.targetThreadTitles)) body.targetThreadTitles.forEach((value) => push("title", value));
  if (body.targetThreadTitle) push("title", body.targetThreadTitle);
  if (values.some((entry) => entry && entry.kind !== "workspace")) return values;
  if (Array.isArray(body.targetWorkspaces)) body.targetWorkspaces.forEach((value) => push("workspace", value));
  if (body.targetWorkspace) push("workspace", body.targetWorkspace);
  if (body.targetWorkspaceId) push("workspace", body.targetWorkspaceId);
  if (Array.isArray(body.targetCwds)) body.targetCwds.forEach((value) => push("workspace", value));
  if (body.targetCwd) push("workspace", body.targetCwd);
  return values;
}

function threadTaskCardTargetReferences(body = {}) {
  return threadTaskCardTargetReferenceEntries(body).map((entry) => entry.text).filter(Boolean);
}

function isThreadIdLike(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || "").trim());
}

function threadTaskCardTargetUpdatedAt(thread) {
  const value = Number(thread && (thread.updatedAt || thread.updated_at || thread.updatedAtMs || thread.updated_at_ms) || 0);
  return Number.isFinite(value) ? value : 0;
}

function createThreadTaskCardRoutingService(deps = {}) {
  const normalizePath = typeof deps.normalizeFsPath === "function" ? deps.normalizeFsPath : normalizeFsPath;
  const displayTitle = typeof deps.threadDisplayTitle === "function" ? deps.threadDisplayTitle : defaultThreadDisplayTitle;
  const readThreadList = typeof deps.readThreadListFallback === "function" ? deps.readThreadListFallback : () => [];
  const readThreadSummary = typeof deps.readThreadSummary === "function" ? deps.readThreadSummary : () => null;
  const visibilityFromState = typeof deps.visibilityFromGlobalState === "function" ? deps.visibilityFromGlobalState : defaultVisibilityFromGlobalState;
  const hasArchiveSignal = typeof deps.threadHasArchiveSignal === "function" ? deps.threadHasArchiveSignal : (thread) => Boolean(thread && (thread.archived || thread.deleted));
  const isHidden = typeof deps.isHiddenThread === "function" ? deps.isHiddenThread : () => false;
  const isSubagent = typeof deps.isSubagentThreadSummary === "function" ? deps.isSubagentThreadSummary : () => false;
  const isSidecar = typeof deps.isSideChatSidecarThreadSummary === "function" ? deps.isSideChatSidecarThreadSummary : () => false;
  const createError = typeof deps.createError === "function" ? deps.createError : defaultCreateError;

  function targetError(code, message, details = {}, statusCode = 400) {
    return createError(statusCode, code, message || code, details);
  }

  function targetVisibility(options = {}) {
    if (options.visibility && typeof options.visibility === "object") return options.visibility;
    if (options.globalState && typeof options.globalState === "object") return visibilityFromState(options.globalState);
    return visibilityFromState();
  }

  function visibleTargetThreads(options = {}) {
    const rawThreads = Array.isArray(options.visibleThreads)
      ? options.visibleThreads
      : readThreadList(500, { archived: false });
    const byId = new Map();
    for (const thread of rawThreads || []) {
      const id = String(thread && thread.id || "").trim();
      if (!id || byId.has(id)) continue;
      if (hasArchiveSignal(thread) || isSubagent(thread) || isSidecar(thread)) continue;
      byId.set(id, thread);
    }
    return [...byId.values()];
  }

  function canonicalTargetForCwd(cwd, visibleThreads = []) {
    const wanted = normalizePath(cwd || "");
    if (!wanted) return null;
    let best = null;
    for (const thread of visibleThreads || []) {
      if (!thread || normalizePath(thread.cwd || "") !== wanted) continue;
      if (!best || threadTaskCardTargetUpdatedAt(thread) > threadTaskCardTargetUpdatedAt(best)) {
        best = thread;
      }
    }
    return best;
  }

  function canonicalTargetForThread(thread, visibleThreads = []) {
    if (!thread || !thread.cwd) return thread || null;
    return canonicalTargetForCwd(thread.cwd, visibleThreads) || thread;
  }

  function canonicalVisibleTargets(visibleThreads = []) {
    const out = [];
    const seenCwds = new Set();
    for (const thread of [...(visibleThreads || [])].sort((a, b) => threadTaskCardTargetUpdatedAt(b) - threadTaskCardTargetUpdatedAt(a))) {
      if (!thread || !thread.id) continue;
      const cwd = normalizePath(thread.cwd || "");
      if (!cwd) {
        out.push(thread);
        continue;
      }
      if (seenCwds.has(cwd)) continue;
      seenCwds.add(cwd);
      out.push(thread);
    }
    return out;
  }

  function readTargetSummary(threadId, options = {}) {
    if (typeof options.readThreadSummary === "function") return options.readThreadSummary(threadId);
    return readThreadSummary(threadId, options);
  }

  function publicTarget(thread) {
    if (!thread || typeof thread !== "object") return null;
    return {
      threadId: String(thread.id || ""),
      title: displayTitle(thread),
      cwd: String(thread.cwd || ""),
      updatedAt: threadTaskCardTargetUpdatedAt(thread),
    };
  }

  function assertTargetDeliverable(thread, details = {}, options = {}) {
    const target = publicTarget(thread);
    if (!thread || !String(thread.id || "").trim()) {
      throw targetError(
        "target_thread_not_visible",
        "Target thread is not visible or is not a current deliverable thread.",
        details,
        404,
      );
    }
    if (hasArchiveSignal(thread)) {
      throw targetError(
        "target_thread_archived",
        "Target thread is archived, deleted, or otherwise not deliverable.",
        Object.assign({}, details, { requestedTarget: target }),
        409,
      );
    }
    if (isSubagent(thread) || isSidecar(thread)) {
      throw targetError(
        "target_thread_not_visible",
        "Target thread is not visible or is not a current deliverable thread.",
        Object.assign({}, details, { requestedTarget: target }),
        404,
      );
    }
    if (isHidden(thread, targetVisibility(options))) {
      throw targetError(
        "target_thread_not_visible",
        "Target thread is not visible or is not a current deliverable thread.",
        Object.assign({}, details, { requestedTarget: target }),
        404,
      );
    }
    return String(thread.id || "");
  }

  function resolveTargetReference(value, sourceThreadId = "", options = {}) {
    const entry = value && typeof value === "object" && !Array.isArray(value) && value.text
      ? value
      : threadTaskCardTargetReferenceEntry("thread", value);
    const raw = String(entry && entry.text || "").trim();
    if (!raw) return "";
    if (raw === String(sourceThreadId || "")) {
      throw targetError(
        "target_thread_self",
        "Target thread must be different from the source thread.",
        { sourceThreadId: String(sourceThreadId || "") },
        400,
      );
    }
    const visibleThreads = visibleTargetThreads(options);
    const visibleById = new Map(visibleThreads.map((thread) => [String(thread.id || ""), thread]));
    const currentVisible = visibleById.get(raw);
    if (currentVisible) {
      return assertTargetDeliverable(currentVisible, {
        reference: raw,
        referenceKind: entry.kind || "thread",
      }, options);
    }
    const direct = isThreadIdLike(raw) ? readTargetSummary(raw, options) : null;
    if (direct && String(direct.id || "") === raw) {
      return assertTargetDeliverable(direct, {
        reference: raw,
        referenceKind: entry.kind || "threadId",
      }, options);
    }
    const lowered = raw.toLowerCase();
    const rawPath = normalizePath(raw);
    const byCwd = canonicalTargetForCwd(rawPath, visibleThreads);
    if (byCwd && String(byCwd.id || "") !== String(sourceThreadId || "")) return String(byCwd.id || "");
    for (const thread of visibleThreads) {
      if (!thread || String(thread.id || "") === String(sourceThreadId || "")) continue;
      const id = String(thread.id || "").trim();
      const title = displayTitle(thread);
      if (id.toLowerCase() === lowered || String(title || "").trim().toLowerCase() === lowered) {
        return assertTargetDeliverable(thread, {
          reference: raw,
          referenceKind: entry.kind || "thread",
        }, options);
      }
    }
    throw targetError(
      "target_thread_not_visible",
      "Target thread is not visible or is not a current deliverable thread.",
      {
        reference: raw,
        referenceKind: entry.kind || "thread",
      },
      404,
    );
  }

  function resolvedTargetIds(body = {}, sourceThreadId = "", options = {}) {
    const visibleThreads = visibleTargetThreads(options);
    const seen = new Set();
    const out = [];
    for (const reference of threadTaskCardTargetReferenceEntries(body)) {
      const id = resolveTargetReference(reference, sourceThreadId, Object.assign({}, options, { visibleThreads }));
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
      if (out.length >= 12) break;
    }
    return out;
  }

  return {
    assertTargetDeliverable,
    canonicalTargetForCwd,
    canonicalTargetForThread,
    canonicalVisibleTargets,
    isThreadIdLike,
    publicTarget,
    resolveTargetReference,
    resolvedTargetIds,
    targetError,
    targetReferenceEntries: threadTaskCardTargetReferenceEntries,
    targetReferenceEntry: threadTaskCardTargetReferenceEntry,
    targetReferenceText: threadTaskCardTargetReferenceText,
    targetReferences: threadTaskCardTargetReferences,
    targetUpdatedAt: threadTaskCardTargetUpdatedAt,
    targetVisibility,
    visibleTargetThreads,
  };
}

module.exports = {
  createThreadTaskCardRoutingService,
  isThreadIdLike,
  normalizeFsPath,
  threadTaskCardTargetReferenceEntries,
  threadTaskCardTargetReferenceEntry,
  threadTaskCardTargetReferences,
  threadTaskCardTargetReferenceText,
  threadTaskCardTargetUpdatedAt,
};
