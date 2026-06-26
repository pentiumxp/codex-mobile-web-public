"use strict";

function clonePlainJson(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function safeThreadList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function boundedLimit(value, fallback = 80) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(1, Math.trunc(number));
}

function elapsedMs(now, startedAtMs) {
  return Math.max(0, Number(now()) - Number(startedAtMs || now()));
}

const SAFE_SOURCE_DIAGNOSTIC_COUNTERS = new Set([
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
]);

function safeDiagnosticCounter(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.trunc(number));
}

function mergeSourceDiagnostics(...diagnosticsList) {
  const out = {};
  for (const diagnostics of diagnosticsList) {
    if (!diagnostics || typeof diagnostics !== "object") continue;
    for (const key of SAFE_SOURCE_DIAGNOSTIC_COUNTERS) {
      const value = safeDiagnosticCounter(diagnostics[key]);
      if (!value) continue;
      out[key] = safeDiagnosticCounter(Number(out[key] || 0) + value);
    }
  }
  return out;
}

function countDuplicateThreadIds(threads) {
  const seen = new Set();
  let duplicates = 0;
  for (const thread of safeThreadList(threads)) {
    const id = String(thread && thread.id || "").trim();
    if (!id) continue;
    if (seen.has(id)) duplicates += 1;
    else seen.add(id);
  }
  return duplicates;
}

function createThreadListFallbackBaselineService(options = {}) {
  const now = typeof options.now === "function" ? options.now : Date.now;
  const readStateDbFallback = typeof options.readStateDbFallback === "function"
    ? options.readStateDbFallback
    : () => [];
  const readRolloutSessionFallback = typeof options.readRolloutSessionFallback === "function"
    ? options.readRolloutSessionFallback
    : () => [];
  const readSessionIndexFallback = typeof options.readSessionIndexFallback === "function"
    ? options.readSessionIndexFallback
    : () => [];
  const mergeThreadSummaryList = typeof options.mergeThreadSummaryList === "function"
    ? options.mergeThreadSummaryList
    : (threads) => safeThreadList(threads);
  const filterFallbackThreads = typeof options.filterFallbackThreads === "function"
    ? options.filterFallbackThreads
    : (threads) => safeThreadList(threads);
  const maxSourceSnapshots = Math.max(1, Math.min(8, Number(options.maxSourceSnapshots || 4)));
  const sourceSnapshots = new Map();
  let sourceSnapshotBuildCount = 0;

  function timedRead(name, reader, limit, filters, sourceContext = null) {
    const startedAtMs = Number(now());
    const sourceDiagnostics = {};
    const readFilters = Object.assign({}, filters || {}, {
      diagnostics: sourceDiagnostics,
    });
    if (sourceContext && typeof sourceContext === "object") {
      readFilters.sourceContext = sourceContext;
    }
    const threads = safeThreadList(reader(limit, readFilters));
    return {
      name,
      threads,
      elapsedMs: elapsedMs(now, startedAtMs),
      count: threads.length,
      diagnostics: mergeSourceDiagnostics(sourceDiagnostics),
    };
  }

  function sourceSnapshotFilters(filters = {}) {
    return {
      globalState: filters.globalState && typeof filters.globalState === "object"
        ? clonePlainJson(filters.globalState)
        : undefined,
    };
  }

  function sourceSnapshotLimit(limit, filters = {}) {
    const explicit = Number(filters.sourceSnapshotLimit);
    if (Number.isFinite(explicit) && explicit > 0) return Math.max(1, Math.min(1000, Math.trunc(explicit)));
    return Math.max(1, Math.min(1000, boundedLimit(limit)));
  }

  function trimSourceSnapshotCache() {
    while (sourceSnapshots.size > maxSourceSnapshots) {
      const oldestKey = sourceSnapshots.keys().next().value;
      if (oldestKey) sourceSnapshots.delete(oldestKey);
    }
  }

  function readSourceSnapshot(limit, filters = {}) {
    const key = String(filters.sourceSnapshotKey || "").trim();
    const requiredLimit = sourceSnapshotLimit(limit, filters);
    if (!key) return null;
    const cached = sourceSnapshots.get(key);
    if (cached && Number(cached.sourceLimit || 0) >= requiredLimit) {
      return {
        hit: true,
        key,
        sourceLimit: Number(cached.sourceLimit || 0),
        buildNumber: Number(cached.buildNumber || 0),
        ageMs: Math.max(0, Number(now()) - Number(cached.cachedAt || now())),
        sources: clonePlainJson(cached.sources || {}),
        timings: {
          stateDbMs: 0,
          rolloutMs: 0,
          sessionIndexMs: 0,
          stateDbCount: safeThreadList(cached.sources && cached.sources.stateDb).length,
          rolloutCount: safeThreadList(cached.sources && cached.sources.rollout).length,
          sessionIndexCount: safeThreadList(cached.sources && cached.sources.sessionIndex).length,
        },
      };
    }

    const readFilters = sourceSnapshotFilters(filters);
    const sourceContext = {};
    const stateDb = timedRead("stateDb", readStateDbFallback, requiredLimit, readFilters, sourceContext);
    const rollout = timedRead("rollout", readRolloutSessionFallback, requiredLimit, readFilters, sourceContext);
    const sessionIndex = timedRead("sessionIndex", readSessionIndexFallback, requiredLimit, readFilters, sourceContext);
    sourceSnapshotBuildCount += 1;
    const snapshot = {
      cachedAt: Number(now()),
      sourceLimit: requiredLimit,
      buildNumber: sourceSnapshotBuildCount,
      sourceFilters: clonePlainJson(readFilters),
      sources: {
        stateDb: clonePlainJson(stateDb.threads),
        rollout: clonePlainJson(rollout.threads),
        sessionIndex: clonePlainJson(sessionIndex.threads),
      },
    };
    sourceSnapshots.set(key, snapshot);
    trimSourceSnapshotCache();
    const sourceDiagnostics = mergeSourceDiagnostics(
      stateDb.diagnostics,
      rollout.diagnostics,
      sessionIndex.diagnostics,
    );
    return {
      hit: false,
      key,
      sourceLimit: requiredLimit,
      buildNumber: sourceSnapshotBuildCount,
      ageMs: 0,
      sources: clonePlainJson(snapshot.sources),
      timings: {
        stateDbMs: stateDb.elapsedMs,
        rolloutMs: rollout.elapsedMs,
        sessionIndexMs: sessionIndex.elapsedMs,
        stateDbCount: stateDb.count,
        rolloutCount: rollout.count,
        sessionIndexCount: sessionIndex.count,
        ...sourceDiagnostics,
      },
    };
  }

  function filterSourceThreads(threads, filters = {}) {
    return safeThreadList(filterFallbackThreads(safeThreadList(threads), filters));
  }

  function buildBaselineFromSources(snapshot, bounded, filters = {}) {
    const sources = snapshot && snapshot.sources || {};
    const stateDbRaw = safeThreadList(sources.stateDb);
    const rolloutRaw = safeThreadList(sources.rollout);
    const sessionIndexRaw = safeThreadList(sources.sessionIndex);
    const stateDbThreads = filterSourceThreads(sources.stateDb, filters);
    const rolloutThreads = filterSourceThreads(sources.rollout, filters);
    const sessionIndexThreads = filterSourceThreads(sources.sessionIndex, filters);
    const mergeInput = [
      ...stateDbThreads,
      ...rolloutThreads,
      ...sessionIndexThreads,
    ];
    const merged = safeThreadList(mergeThreadSummaryList(mergeInput));
    const threads = merged.slice(0, bounded);
    return {
      threads,
      counts: {
        stateDb: stateDbThreads.length,
        rollout: rolloutThreads.length,
        sessionIndex: sessionIndexThreads.length,
        baselineSourceCount: stateDbThreads.length + rolloutThreads.length + sessionIndexThreads.length,
        baselineResultCount: threads.length,
        baselineFinalFilterPassCount: 3,
        baselineFinalFilterInputCount: stateDbRaw.length + rolloutRaw.length + sessionIndexRaw.length,
        baselineFinalFilterOutputCount: mergeInput.length,
        baselineMergeInputCount: mergeInput.length,
        baselineMergeOutputCount: merged.length,
        baselineMergeDuplicateCount: countDuplicateThreadIds(mergeInput),
        baselineLimitDropCount: Math.max(0, merged.length - threads.length),
      },
    };
  }

  function readBaseline(limit = 80, filters = {}) {
    const bounded = boundedLimit(limit);
    const snapshot = readSourceSnapshot(bounded, filters);
    const baseline = snapshot
      ? buildBaselineFromSources(snapshot, bounded, filters)
      : null;
    const sourceContext = snapshot ? null : {};
    const stateDb = snapshot ? null : timedRead("stateDb", readStateDbFallback, bounded, filters, sourceContext);
    const rollout = snapshot ? null : timedRead("rollout", readRolloutSessionFallback, bounded, filters, sourceContext);
    const sessionIndex = snapshot ? null : timedRead("sessionIndex", readSessionIndexFallback, bounded, filters, sourceContext);
    const directMergeInput = baseline ? [] : [
      ...stateDb.threads,
      ...rollout.threads,
      ...sessionIndex.threads,
    ];
    const directMerged = baseline ? [] : safeThreadList(mergeThreadSummaryList(directMergeInput));
    const threads = baseline
      ? baseline.threads
      : directMerged.slice(0, bounded);
    const counts = baseline
      ? baseline.counts
      : {
        stateDb: stateDb.count,
        rollout: rollout.count,
        sessionIndex: sessionIndex.count,
        baselineSourceCount: stateDb.count + rollout.count + sessionIndex.count,
        baselineResultCount: threads.length,
        baselineFinalFilterPassCount: 0,
        baselineFinalFilterInputCount: 0,
        baselineFinalFilterOutputCount: 0,
        baselineMergeInputCount: directMergeInput.length,
        baselineMergeOutputCount: directMerged.length,
        baselineMergeDuplicateCount: countDuplicateThreadIds(directMergeInput),
        baselineLimitDropCount: Math.max(0, directMerged.length - threads.length),
      };
    const sourceTimings = snapshot ? snapshot.timings : {
      stateDbMs: stateDb.elapsedMs,
      rolloutMs: rollout.elapsedMs,
      sessionIndexMs: sessionIndex.elapsedMs,
      ...mergeSourceDiagnostics(
        stateDb.diagnostics,
        rollout.diagnostics,
        sessionIndex.diagnostics,
      ),
    };
    const timings = {
      stateDbMs: sourceTimings.stateDbMs,
      rolloutMs: sourceTimings.rolloutMs,
      sessionIndexMs: sourceTimings.sessionIndexMs,
      stateDbCount: counts.stateDb,
      rolloutCount: counts.rollout,
      sessionIndexCount: counts.sessionIndex,
      baselineSourceCount: counts.baselineSourceCount,
      baselineResultCount: counts.baselineResultCount,
      baselineFinalFilterPassCount: counts.baselineFinalFilterPassCount,
      baselineFinalFilterInputCount: counts.baselineFinalFilterInputCount,
      baselineFinalFilterOutputCount: counts.baselineFinalFilterOutputCount,
      baselineMergeInputCount: counts.baselineMergeInputCount,
      baselineMergeOutputCount: counts.baselineMergeOutputCount,
      baselineMergeDuplicateCount: counts.baselineMergeDuplicateCount,
      baselineLimitDropCount: counts.baselineLimitDropCount,
      ...mergeSourceDiagnostics(sourceTimings),
    };
    if (snapshot) {
      timings.sourceSnapshotHit = snapshot.hit === true;
      timings.sourceSnapshotAgeMs = snapshot.ageMs;
      timings.sourceSnapshotLimit = snapshot.sourceLimit;
      timings.sourceSnapshotBuildCount = sourceSnapshotBuildCount;
      timings.sourceSnapshotBuildNumber = snapshot.buildNumber;
      timings.sourceSnapshotRawCount = safeThreadList(snapshot.sources.stateDb).length
        + safeThreadList(snapshot.sources.rollout).length
        + safeThreadList(snapshot.sources.sessionIndex).length;
    }
    return {
      threads,
      timings,
      sources: {
        stateDb: counts.stateDb,
        rollout: counts.rollout,
        sessionIndex: counts.sessionIndex,
      },
    };
  }

  function clearSourceSnapshots() {
    sourceSnapshots.clear();
  }

  function removeThread(threadId) {
    const id = String(threadId || "").trim();
    if (!id || !sourceSnapshots.size) return false;
    let removed = false;
    for (const snapshot of sourceSnapshots.values()) {
      for (const sourceName of ["stateDb", "rollout", "sessionIndex"]) {
        const before = safeThreadList(snapshot.sources && snapshot.sources[sourceName]).length;
        snapshot.sources[sourceName] = safeThreadList(snapshot.sources && snapshot.sources[sourceName])
          .filter((thread) => String(thread && thread.id || "") !== id);
        if (snapshot.sources[sourceName].length !== before) removed = true;
      }
    }
    return removed;
  }

  function upsertThread(thread) {
    const id = String(thread && thread.id || "").trim();
    if (!id || !sourceSnapshots.size) return false;
    let changed = false;
    for (const snapshot of sourceSnapshots.values()) {
      for (const sourceName of ["stateDb", "rollout", "sessionIndex"]) {
        snapshot.sources[sourceName] = safeThreadList(snapshot.sources && snapshot.sources[sourceName])
          .filter((candidate) => String(candidate && candidate.id || "") !== id);
      }
      const sourceFilters = snapshot.sourceFilters && typeof snapshot.sourceFilters === "object"
        ? clonePlainJson(snapshot.sourceFilters)
        : {};
      const visible = filterSourceThreads([thread], sourceFilters);
      if (!visible.length) continue;
      snapshot.sources.stateDb = safeThreadList(snapshot.sources.stateDb);
      snapshot.sources.stateDb.unshift(clonePlainJson(visible[0]));
      changed = true;
    }
    return changed;
  }

  return {
    clearSourceSnapshots,
    readBaseline,
    removeThread,
    upsertThread,
  };
}

module.exports = {
  createThreadListFallbackBaselineService,
};
