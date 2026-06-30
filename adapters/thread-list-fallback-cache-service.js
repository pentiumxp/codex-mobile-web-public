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

const BASELINE_SOURCE_DIAGNOSTIC_COUNTERS = [
  "rolloutDirectoryReadCount",
  "rolloutFileStatCount",
  "rolloutFileCollectedCount",
  "rolloutFileSortedCount",
  "rolloutCandidateFileCount",
  "rolloutCandidateScannedCount",
  "rolloutHeadReadCount",
  "rolloutHeadBytes",
  "rolloutSummaryReadCount",
  "rolloutStatusAttachCount",
  "rolloutStatusTailReadCount",
  "rolloutStatusTailBytes",
  "sessionIndexReadCount",
  "sessionIndexReuseCount",
  "sessionIndexLineCount",
  "sessionIndexEntryCount",
];

const BASELINE_WORK_DIAGNOSTIC_COUNTERS = [
  "baselineFinalFilterPassCount",
  "baselineFinalFilterInputCount",
  "baselineFinalFilterOutputCount",
  "baselineMergeInputCount",
  "baselineMergeOutputCount",
  "baselineMergeDuplicateCount",
  "baselineLimitDropCount",
];

function boundedCounter(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.trunc(number));
}

function baselineSourceDiagnostics(timings = {}) {
  const out = {};
  if (!timings || typeof timings !== "object") return out;
  for (const key of BASELINE_SOURCE_DIAGNOSTIC_COUNTERS) {
    const value = boundedCounter(timings[key]);
    if (value) out[key] = value;
  }
  return out;
}

function baselineWorkDiagnostics(timings = {}) {
  const out = {};
  if (!timings || typeof timings !== "object") return out;
  for (const key of BASELINE_WORK_DIAGNOSTIC_COUNTERS) {
    const value = boundedCounter(timings[key]);
    if (value) out[key] = value;
  }
  return out;
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
      filterFallbackThreads,
      mergeThreadSummaryList,
    });
  const persistentStore = options.persistentStore
    && typeof options.persistentStore.loadEntries === "function"
    && typeof options.persistentStore.saveEntries === "function"
    ? options.persistentStore
    : null;

  const cache = new Map();
  let buildCount = 0;

  function cacheEntriesForPersistence() {
    return [...cache.entries()].map(([key, entry]) => Object.assign({ key }, entry || {}));
  }

  function persistCache() {
    if (!persistentStore) return false;
    try {
      return persistentStore.saveEntries(cacheEntriesForPersistence());
    } catch (_) {
      return false;
    }
  }

  function seedPersistedCache() {
    if (!persistentStore) return;
    let entries = [];
    try {
      entries = persistentStore.loadEntries();
    } catch (_) {
      entries = [];
    }
    for (const entry of Array.isArray(entries) ? entries : []) {
      const key = String(entry && entry.key || "");
      if (!key) continue;
      cache.set(key, Object.assign({}, entry, { persistentRestored: true }));
      buildCount = Math.max(buildCount, Number(entry.buildNumber || 0));
    }
    while (cache.size > maxEntries) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey) cache.delete(oldestKey);
    }
  }

  seedPersistedCache();

  function clear() {
    cache.clear();
    if (typeof baselineService.clearSourceSnapshots === "function") baselineService.clearSourceSnapshots();
    if (persistentStore && typeof persistentStore.clear === "function") persistentStore.clear();
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
    if (typeof baselineService.removeThread === "function") baselineService.removeThread(id);
    if (removed) persistCache();
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
    if ((changed || addIfMissing) && typeof baselineService.upsertThread === "function") {
      changed = baselineService.upsertThread(thread) || changed;
    }
    if (changed) persistCache();
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

  function filterScopeKey(filters = {}) {
    const globalState = filters.globalState || readGlobalState();
    const roots = [...visibleWorkspaceRoots(globalState)].map(normalizeFsPath).filter(Boolean).sort();
    const projectlessIds = [...visibleProjectlessThreadIds(globalState)].map(normalizeThreadId).filter(Boolean).sort();
    return JSON.stringify({
      cwd: normalizeFsPath(filters.cwd || ""),
      search: String(filters.searchTerm || "").trim().toLowerCase(),
      roots,
      projectlessIds,
    });
  }

  function sourceSnapshotKey(limit, filters = {}) {
    const globalState = filters.globalState || readGlobalState();
    const roots = [...visibleWorkspaceRoots(globalState)].map(normalizeFsPath).filter(Boolean).sort();
    const projectlessIds = [...visibleProjectlessThreadIds(globalState)].map(normalizeThreadId).filter(Boolean).sort();
    return JSON.stringify({
      roots,
      projectlessIds,
    });
  }

  function sourceSnapshotLimit(limit, filters = {}) {
    const explicit = Number(filters.sourceSnapshotLimit);
    if (Number.isFinite(explicit) && explicit > 0) {
      return Math.max(1, Math.min(1000, Math.trunc(explicit)));
    }
    const bounded = Math.max(1, Math.min(200, Number(limit || 80)));
    return Math.max(200, Math.min(1000, bounded * 8));
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
      filterScopeKey: filterScopeKey(rememberOptions.filters || {}),
      threads: clonePlainJson(Array.isArray(threads) ? threads : []),
      timings: Object.assign({}, timings || {}),
      incrementalUpdates: 0,
      persistentRestored: false,
    });
    while (cache.size > maxEntries) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey) cache.delete(oldestKey);
    }
    persistCache();
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
      cachePersistentRestored: cached.persistentRestored === true,
      cachedSourceTimings: Object.assign({}, cached.timings || {}),
    }));
    return {
      threads: clonePlainJson(cached.threads || []),
      timings: Object.assign({}, cached.timings || {}),
      cachedAt,
      updatedAt,
      buildNumber: Number(cached.buildNumber || 0),
      incrementalUpdates: Number(cached.incrementalUpdates || 0),
      persistentRestored: cached.persistentRestored === true,
    };
  }

  function readCompatible(limit = 80, filters = {}, diagnostics = null) {
    const requestedLimit = Math.max(1, Math.min(200, Number(limit || 80)));
    const requestedScopeKey = filterScopeKey(filters);
    let bestKey = "";
    let bestLimit = Number.MAX_SAFE_INTEGER;
    let bestUpdatedAt = 0;
    for (const [entryKey, entry] of cache.entries()) {
      if (!entry || entry.filterScopeKey !== requestedScopeKey) continue;
      const entryLimit = Math.max(1, Math.min(200, Number(entry.limit || 80)));
      if (entryLimit < requestedLimit) continue;
      const updatedAt = Number(entry.updatedAt || entry.cachedAt || 0);
      if (entryLimit < bestLimit || (entryLimit === bestLimit && updatedAt > bestUpdatedAt)) {
        bestKey = entryKey;
        bestLimit = entryLimit;
        bestUpdatedAt = updatedAt;
      }
    }
    if (!bestKey) return null;
    const cached = read(bestKey, diagnostics);
    if (!cached) return null;
    if (diagnostics) {
      diagnostics.cacheHit = true;
      diagnostics.cacheDecision = "compatible-hit";
      diagnostics.compatibleCacheHit = true;
      diagnostics.compatibleCacheLimit = bestLimit;
    }
    return Object.assign({}, cached, {
      threads: cached.threads.slice(0, requestedLimit),
      compatible: true,
      compatibleLimit: bestLimit,
    });
  }

  function readWorkspaceDerivedCompatible(limit = 80, filters = {}, diagnostics = null) {
    const cwd = String(filters.cwd || "").trim();
    const searchTerm = String(filters.searchTerm || "").trim();
    if (!cwd || searchTerm) return null;
    const requestedLimit = Math.max(1, Math.min(200, Number(limit || 80)));
    const defaultScopeKey = filterScopeKey(Object.assign({}, filters, {
      cwd: "",
      searchTerm: "",
    }));
    let bestKey = "";
    let bestLimit = 0;
    let bestUpdatedAt = 0;
    for (const [entryKey, entry] of cache.entries()) {
      if (!entry || entry.filterScopeKey !== defaultScopeKey) continue;
      const entryLimit = Math.max(1, Math.min(200, Number(entry.limit || 80)));
      const updatedAt = Number(entry.updatedAt || entry.cachedAt || 0);
      if (entryLimit > bestLimit || (entryLimit === bestLimit && updatedAt > bestUpdatedAt)) {
        bestKey = entryKey;
        bestLimit = entryLimit;
        bestUpdatedAt = updatedAt;
      }
    }
    if (!bestKey) return null;
    const cached = read(bestKey, null);
    if (!cached || !Array.isArray(cached.threads) || !cached.threads.length) return null;
    const filtered = filterFallbackThreads(cached.threads, {
      cwd,
      searchTerm: "",
      globalState: filters.globalState || undefined,
    }).slice(0, requestedLimit);
    if (!filtered.length) return null;
    if (diagnostics) {
      diagnostics.cacheHit = true;
      diagnostics.cacheDecision = "workspace-derived-hit";
      diagnostics.workspaceDerivedCacheHit = true;
      diagnostics.workspaceDerivedCacheLimit = bestLimit;
      diagnostics.compatibleCacheHit = true;
      diagnostics.compatibleCacheLimit = bestLimit;
      diagnostics.cacheBuildNumber = cached.buildNumber || 0;
      diagnostics.cacheIncrementalUpdates = cached.incrementalUpdates || 0;
      diagnostics.cachePersistentRestored = cached.persistentRestored === true;
      diagnostics.cachedSourceTimings = cached.timings;
    }
    remember(cacheKey(requestedLimit, filters), filtered, cached.timings, {
      limit: requestedLimit,
      filters,
    });
    return {
      threads: filtered,
      timings: cached.timings,
      cachedAt: cached.cachedAt,
      updatedAt: now(),
      buildNumber: buildCount,
      incrementalUpdates: 0,
      persistentRestored: false,
      compatible: true,
      compatibleLimit: bestLimit,
      workspaceDerived: true,
    };
  }

  function cachedThreadsForFilters(cached, limit = 80, filters = {}, diagnostics = null) {
    const input = Array.isArray(cached && cached.threads) ? cached.threads : [];
    const filtered = filterFallbackThreads(input, filters);
    const merged = mergeThreadSummaryList(filtered);
    const out = Array.isArray(merged) ? merged : filtered;
    if (diagnostics && typeof diagnostics === "object") {
      diagnostics.cacheFilteredDropCount = boundedCounter(Math.max(0, input.length - filtered.length));
    }
    return out.slice(0, Math.max(1, Math.min(200, Number(limit || 80))));
  }

  function readFallback(limit = 80, filters = {}) {
    const diagnostics = filters.diagnostics && typeof filters.diagnostics === "object" ? filters.diagnostics : null;
    const key = cacheKey(limit, filters);
    const cached = read(key, diagnostics)
      || readCompatible(limit, filters, diagnostics)
      || readWorkspaceDerivedCompatible(limit, filters, diagnostics);
    if (cached) {
      if (diagnostics) {
        diagnostics.cacheHit = true;
        diagnostics.cacheDecision = cached.workspaceDerived ? "workspace-derived-hit" : cached.compatible ? "compatible-hit" : "hit";
        diagnostics.stateDbMs = 0;
        diagnostics.rolloutMs = 0;
        diagnostics.sessionIndexMs = 0;
        diagnostics.cachedSourceTimings = cached.timings;
        diagnostics.cacheAgeMs = cached.updatedAt ? Math.max(0, now() - cached.updatedAt) : 0;
        diagnostics.cacheBaselineAgeMs = cached.cachedAt ? Math.max(0, now() - cached.cachedAt) : 0;
        diagnostics.cacheBuildNumber = cached.buildNumber || 0;
        diagnostics.cacheIncrementalUpdates = cached.incrementalUpdates || 0;
        diagnostics.cachePersistentRestored = cached.persistentRestored === true;
        if (cached.compatible) {
          diagnostics.compatibleCacheHit = true;
          diagnostics.compatibleCacheLimit = cached.compatibleLimit || 0;
        }
        if (cached.workspaceDerived) {
          diagnostics.workspaceDerivedCacheHit = true;
          diagnostics.workspaceDerivedCacheLimit = cached.compatibleLimit || 0;
        }
      }
      return cachedThreadsForFilters(cached, limit, filters, diagnostics);
    }
    if (diagnostics) {
      diagnostics.cacheHit = false;
      const missDecision = diagnostics.cacheDecision || "miss";
      diagnostics.cacheBuildReason = missDecision;
      diagnostics.cacheDecision = missDecision === "expired" ? "expired-rebuild" : "miss-rebuild";
    }
    const baseline = baselineService.readBaseline(limit, Object.assign({}, filters, {
      sourceSnapshotKey: sourceSnapshotKey(limit, filters),
      sourceSnapshotLimit: sourceSnapshotLimit(limit, filters),
    }));
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
      Object.assign(diagnostics, baselineWorkDiagnostics(baselineTimings));
      Object.assign(diagnostics, baselineSourceDiagnostics(baselineTimings));
      if (Object.prototype.hasOwnProperty.call(baselineTimings, "sourceSnapshotHit")) {
        diagnostics.sourceSnapshotHit = baselineTimings.sourceSnapshotHit === true;
        diagnostics.sourceSnapshotAgeMs = Number(baselineTimings.sourceSnapshotAgeMs || 0);
        diagnostics.sourceSnapshotLimit = Number(baselineTimings.sourceSnapshotLimit || 0);
        diagnostics.sourceSnapshotBuildCount = Number(baselineTimings.sourceSnapshotBuildCount || 0);
        diagnostics.sourceSnapshotBuildNumber = Number(baselineTimings.sourceSnapshotBuildNumber || 0);
        diagnostics.sourceSnapshotRawCount = Number(baselineTimings.sourceSnapshotRawCount || 0);
      }
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
      ...baselineWorkDiagnostics(baselineTimings),
      ...baselineSourceDiagnostics(baselineTimings),
      ...(Object.prototype.hasOwnProperty.call(baselineTimings, "sourceSnapshotHit") ? {
        sourceSnapshotHit: baselineTimings.sourceSnapshotHit === true,
        sourceSnapshotAgeMs: Number(baselineTimings.sourceSnapshotAgeMs || 0),
        sourceSnapshotLimit: Number(baselineTimings.sourceSnapshotLimit || 0),
        sourceSnapshotBuildCount: Number(baselineTimings.sourceSnapshotBuildCount || 0),
        sourceSnapshotBuildNumber: Number(baselineTimings.sourceSnapshotBuildNumber || 0),
        sourceSnapshotRawCount: Number(baselineTimings.sourceSnapshotRawCount || 0),
      } : {}),
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

  function readCachedFallback(limit = 80, filters = {}) {
    const diagnostics = filters.diagnostics && typeof filters.diagnostics === "object" ? filters.diagnostics : null;
    const key = cacheKey(limit, filters);
    const cached = read(key, diagnostics)
      || readCompatible(limit, filters, diagnostics)
      || readWorkspaceDerivedCompatible(limit, filters, diagnostics);
    if (!cached) {
      if (diagnostics) {
        diagnostics.cacheHit = false;
        diagnostics.stateDbMs = 0;
        diagnostics.rolloutMs = 0;
        diagnostics.sessionIndexMs = 0;
      }
      return [];
    }
    if (diagnostics) {
      diagnostics.cacheHit = true;
      diagnostics.cacheDecision = cached.workspaceDerived ? "workspace-derived-hit" : cached.compatible ? "compatible-hit" : "hit";
      diagnostics.stateDbMs = 0;
      diagnostics.rolloutMs = 0;
      diagnostics.sessionIndexMs = 0;
      diagnostics.cachedSourceTimings = cached.timings;
      diagnostics.cacheAgeMs = cached.updatedAt ? Math.max(0, now() - cached.updatedAt) : 0;
      diagnostics.cacheBaselineAgeMs = cached.cachedAt ? Math.max(0, now() - cached.cachedAt) : 0;
      diagnostics.cacheBuildNumber = cached.buildNumber || 0;
      diagnostics.cacheIncrementalUpdates = cached.incrementalUpdates || 0;
      diagnostics.cachePersistentRestored = cached.persistentRestored === true;
      if (cached.compatible) {
        diagnostics.compatibleCacheHit = true;
        diagnostics.compatibleCacheLimit = cached.compatibleLimit || 0;
      }
      if (cached.workspaceDerived) {
        diagnostics.workspaceDerivedCacheHit = true;
        diagnostics.workspaceDerivedCacheLimit = cached.compatibleLimit || 0;
      }
    }
    return cachedThreadsForFilters(cached, limit, filters, diagnostics);
  }

  return {
    applyStatusPayload,
    cacheKey,
    clear,
    read,
    readCachedFallback,
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
