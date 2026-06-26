"use strict";

const {
  createThreadListFallbackBaselineService,
} = require("./thread-list-fallback-baseline-service");

function clonePlainJson(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function shortStableHash(value) {
  const text = String(value || "");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(36).padStart(6, "0").slice(0, 10);
}

function createThreadListFallbackCacheService(options = {}) {
  const ttlMs = Math.max(0, Number(options.ttlMs || 0));
  const maxEntries = Math.max(1, Number(options.maxEntries || 12));
  const now = typeof options.now === "function" ? options.now : Date.now;
  const readGlobalState = typeof options.readGlobalState === "function" ? options.readGlobalState : () => ({});
  const normalizeFsPath = typeof options.normalizeFsPath === "function"
    ? options.normalizeFsPath
    : (value) => String(value || "");
  const normalizeThreadId = typeof options.normalizeThreadId === "function"
    ? options.normalizeThreadId
    : (value) => String(value || "").trim();
  const visibleWorkspaceRoots = typeof options.visibleWorkspaceRoots === "function"
    ? options.visibleWorkspaceRoots
    : () => new Set();
  const visibleProjectlessThreadIds = typeof options.visibleProjectlessThreadIds === "function"
    ? options.visibleProjectlessThreadIds
    : () => new Set();
  const mergeThreadDisplaySummary = typeof options.mergeThreadDisplaySummary === "function"
    ? options.mergeThreadDisplaySummary
    : (base, display) => display || base;
  const normalizeThreadSummaryLiveStatus = typeof options.normalizeThreadSummaryLiveStatus === "function"
    ? options.normalizeThreadSummaryLiveStatus
    : (thread) => thread;
  const filterFallbackThreads = typeof options.filterFallbackThreads === "function"
    ? options.filterFallbackThreads
    : (threads) => threads || [];
  const mergeThreadSummaryList = typeof options.mergeThreadSummaryList === "function"
    ? options.mergeThreadSummaryList
    : (threads) => threads || [];
  const readStateDbFallback = typeof options.readStateDbFallback === "function"
    ? options.readStateDbFallback
    : () => [];
  const readRolloutSessionFallback = typeof options.readRolloutSessionFallback === "function"
    ? options.readRolloutSessionFallback
    : () => [];
  const readSessionIndexFallback = typeof options.readSessionIndexFallback === "function"
    ? options.readSessionIndexFallback
    : () => [];
  const baselineService = options.baselineService && typeof options.baselineService.readBaseline === "function"
    ? options.baselineService
    : createThreadListFallbackBaselineService({
      now,
      readStateDbFallback,
      readRolloutSessionFallback,
      readSessionIndexFallback,
      mergeThreadSummaryList,
    });

  const cache = new Map();
  let buildCount = 0;

  function clear() {
    cache.clear();
  }

  function removeThread(threadId) {
    const id = String(threadId || "").trim();
    if (!id || !cache.size) return false;
    let removed = false;
    const nowMs = now();
    for (const entry of cache.values()) {
      const before = Array.isArray(entry.threads) ? entry.threads.length : 0;
      entry.threads = (entry.threads || []).filter((thread) => String(thread && thread.id || "") !== id);
      if (entry.threads.length !== before) {
        removed = true;
        entry.updatedAt = nowMs;
        entry.incrementalUpdates = Number(entry.incrementalUpdates || 0) + 1;
      }
    }
    return removed;
  }

  function cloneFilters(filters = {}) {
    return {
      cwd: String(filters.cwd || ""),
      searchTerm: String(filters.searchTerm || ""),
      globalState: filters.globalState && typeof filters.globalState === "object"
        ? clonePlainJson(filters.globalState)
        : null,
    };
  }

  function upsertThread(thread, upsertOptions = {}) {
    const id = String(thread && thread.id || "").trim();
    if (!id || !cache.size) return false;
    const addIfMissing = upsertOptions.addIfMissing === true;
    const nowMs = now();
    let changed = false;
    for (const entry of cache.values()) {
      const existing = (entry.threads || []).find((candidate) => String(candidate && candidate.id || "") === id) || null;
      if (!existing && !addIfMissing) continue;
      const candidate = normalizeThreadSummaryLiveStatus(mergeThreadDisplaySummary(existing, thread) || thread);
      const filters = entry.filters || {};
      const filtered = filterFallbackThreads([candidate], {
        cwd: filters.cwd,
        searchTerm: filters.searchTerm,
        globalState: filters.globalState || undefined,
      });
      const withoutThread = (entry.threads || []).filter((item) => String(item && item.id || "") !== id);
      entry.threads = filtered.length
        ? mergeThreadSummaryList([...withoutThread, filtered[0]]).slice(0, Math.max(1, Number(entry.limit || 80)))
        : withoutThread;
      entry.updatedAt = nowMs;
      entry.incrementalUpdates = Number(entry.incrementalUpdates || 0) + 1;
      changed = true;
    }
    return changed;
  }

  function updateStatus(threadId, status, meta = {}) {
    const id = String(threadId || "").trim();
    if (!id || !cache.size) return false;
    const patch = {
      id,
      status: status || { type: "notLoaded" },
      updatedAt: Math.floor(now() / 1000),
    };
    const source = String(meta.source || "").trim();
    const turnId = String(meta.turnId || "").trim();
    if (source) patch.mobileStatusSource = source;
    if (turnId) patch.mobileStatusTurnId = turnId;
    return upsertThread(patch, { addIfMissing: false });
  }

  function applyStatusPayload(payload) {
    if (!payload || payload.type !== "notification" || payload.method !== "thread/status/changed") return false;
    const params = payload.params || {};
    return updateStatus(params.threadId, params.status, {
      source: params.source,
      turnId: params.turnId,
    });
  }

  function cacheKey(limit, filters = {}) {
    const globalState = filters.globalState || readGlobalState();
    const roots = [...visibleWorkspaceRoots(globalState)].map(normalizeFsPath).filter(Boolean).sort();
    const projectlessIds = [...visibleProjectlessThreadIds(globalState)].map(normalizeThreadId).filter(Boolean).sort();
    return JSON.stringify({
      limit: Math.max(1, Math.min(200, Number(limit || 80))),
      cwd: normalizeFsPath(filters.cwd || ""),
      search: String(filters.searchTerm || "").trim().toLowerCase(),
      roots,
      projectlessIds,
    });
  }

  function remember(key, threads, timings = {}, rememberOptions = {}) {
    if (!key) return;
    const nowMs = now();
    buildCount += 1;
    cache.set(key, {
      cachedAt: nowMs,
      updatedAt: nowMs,
      buildNumber: buildCount,
      limit: Math.max(1, Math.min(200, Number(rememberOptions.limit || 80))),
      filters: cloneFilters(rememberOptions.filters || {}),
      threads: clonePlainJson(Array.isArray(threads) ? threads : []),
      timings: Object.assign({}, timings || {}),
      incrementalUpdates: 0,
    });
    while (cache.size > maxEntries) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey) cache.delete(oldestKey);
    }
  }

  function assignReadDiagnostics(diagnostics, values = {}) {
    if (!diagnostics || typeof diagnostics !== "object") return;
    Object.assign(diagnostics, values);
  }

  function read(key, diagnostics = null) {
    const keyHash = shortStableHash(key);
    const baseDiagnostics = {
      cacheKeyHash: key ? keyHash : "",
      cacheEntryCount: cache.size,
      cacheTtlMs: ttlMs,
      cacheBuildCount: buildCount,
    };
    if (!key) return null;
    const cached = cache.get(key);
    if (!cached) {
      assignReadDiagnostics(diagnostics, Object.assign({}, baseDiagnostics, {
        cacheDecision: "miss",
      }));
      return null;
    }
    const nowMs = now();
    const cachedAt = Number(cached.cachedAt || 0);
    const updatedAt = Number(cached.updatedAt || cached.cachedAt || 0);
    const cacheAgeMs = cachedAt ? Math.max(0, nowMs - cachedAt) : 0;
    const cacheUpdatedAgeMs = updatedAt ? Math.max(0, nowMs - updatedAt) : 0;
    if (ttlMs > 0
      && cachedAt
      && cacheAgeMs > ttlMs) {
      cache.delete(key);
      assignReadDiagnostics(diagnostics, Object.assign({}, baseDiagnostics, {
        cacheDecision: "expired",
        cacheAgeMs,
        cacheUpdatedAgeMs,
        cacheEntryCount: cache.size,
        cacheBuildNumber: Number(cached.buildNumber || 0),
        cacheIncrementalUpdates: Number(cached.incrementalUpdates || 0),
      }));
      return null;
    }
    assignReadDiagnostics(diagnostics, Object.assign({}, baseDiagnostics, {
      cacheDecision: "hit",
      cacheAgeMs,
      cacheUpdatedAgeMs,
      cacheBuildNumber: Number(cached.buildNumber || 0),
      cacheIncrementalUpdates: Number(cached.incrementalUpdates || 0),
      cachedSourceTimings: Object.assign({}, cached.timings || {}),
    }));
    return {
      threads: clonePlainJson(cached.threads || []),
      timings: Object.assign({}, cached.timings || {}),
      cachedAt,
      updatedAt,
      buildNumber: Number(cached.buildNumber || 0),
      incrementalUpdates: Number(cached.incrementalUpdates || 0),
    };
  }

  function readFallback(limit = 80, filters = {}) {
    const diagnostics = filters.diagnostics && typeof filters.diagnostics === "object" ? filters.diagnostics : null;
    const key = cacheKey(limit, filters);
    const cached = read(key, diagnostics);
    if (cached) {
      if (diagnostics) {
        diagnostics.cacheHit = true;
        diagnostics.cacheDecision = "hit";
        diagnostics.stateDbMs = 0;
        diagnostics.rolloutMs = 0;
        diagnostics.sessionIndexMs = 0;
        diagnostics.cachedSourceTimings = cached.timings;
        diagnostics.cacheAgeMs = cached.updatedAt ? Math.max(0, now() - cached.updatedAt) : 0;
        diagnostics.cacheBaselineAgeMs = cached.cachedAt ? Math.max(0, now() - cached.cachedAt) : 0;
        diagnostics.cacheBuildNumber = cached.buildNumber || 0;
        diagnostics.cacheIncrementalUpdates = cached.incrementalUpdates || 0;
      }
      return cached.threads;
    }
    if (diagnostics) {
      diagnostics.cacheHit = false;
      const missDecision = diagnostics.cacheDecision || "miss";
      diagnostics.cacheBuildReason = missDecision;
      diagnostics.cacheDecision = missDecision === "expired" ? "expired-rebuild" : "miss-rebuild";
    }
    const baseline = baselineService.readBaseline(limit, filters);
    const threads = Array.isArray(baseline && baseline.threads) ? baseline.threads : [];
    const baselineTimings = baseline && baseline.timings && typeof baseline.timings === "object"
      ? baseline.timings
      : {};
    if (diagnostics) {
      diagnostics.stateDbMs = Number(baselineTimings.stateDbMs || 0);
      diagnostics.rolloutMs = Number(baselineTimings.rolloutMs || 0);
      diagnostics.sessionIndexMs = Number(baselineTimings.sessionIndexMs || 0);
      diagnostics.stateDbCount = Number(baselineTimings.stateDbCount || 0);
      diagnostics.rolloutCount = Number(baselineTimings.rolloutCount || 0);
      diagnostics.sessionIndexCount = Number(baselineTimings.sessionIndexCount || 0);
      diagnostics.baselineSourceCount = Number(baselineTimings.baselineSourceCount || 0);
      diagnostics.baselineResultCount = Number(baselineTimings.baselineResultCount || threads.length);
    }
    remember(key, threads, {
      stateDbMs: Number(baselineTimings.stateDbMs || 0),
      rolloutMs: Number(baselineTimings.rolloutMs || 0),
      sessionIndexMs: Number(baselineTimings.sessionIndexMs || 0),
      stateDbCount: Number(baselineTimings.stateDbCount || 0),
      rolloutCount: Number(baselineTimings.rolloutCount || 0),
      sessionIndexCount: Number(baselineTimings.sessionIndexCount || 0),
      baselineSourceCount: Number(baselineTimings.baselineSourceCount || 0),
      baselineResultCount: Number(baselineTimings.baselineResultCount || threads.length),
    }, {
      limit,
      filters,
    });
    if (diagnostics) {
      diagnostics.cacheEntryCount = cache.size;
      diagnostics.cacheBuildCount = buildCount;
      diagnostics.cacheBuildNumber = buildCount;
      diagnostics.cacheIncrementalUpdates = 0;
      diagnostics.cacheBaselineAgeMs = 0;
      diagnostics.cacheAgeMs = 0;
    }
    return threads;
  }

  return {
    applyStatusPayload,
    cacheKey,
    clear,
    read,
    readFallback,
    remember,
    removeThread,
    upsertThread,
    updateStatus,
  };
}

module.exports = {
  createThreadListFallbackCacheService,
};
