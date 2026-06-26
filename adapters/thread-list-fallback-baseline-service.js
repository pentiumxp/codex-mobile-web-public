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

  function timedRead(name, reader, limit, filters) {
    const startedAtMs = Number(now());
    const threads = safeThreadList(reader(limit, filters));
    return {
      name,
      threads,
      elapsedMs: elapsedMs(now, startedAtMs),
      count: threads.length,
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
    const stateDb = timedRead("stateDb", readStateDbFallback, requiredLimit, readFilters);
    const rollout = timedRead("rollout", readRolloutSessionFallback, requiredLimit, readFilters);
    const sessionIndex = timedRead("sessionIndex", readSessionIndexFallback, requiredLimit, readFilters);
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
      },
    };
  }

  function filterSourceThreads(threads, filters = {}) {
    return safeThreadList(filterFallbackThreads(safeThreadList(threads), filters));
  }

  function buildBaselineFromSources(snapshot, bounded, filters = {}) {
    const sources = snapshot && snapshot.sources || {};
    const stateDbThreads = filterSourceThreads(sources.stateDb, filters);
    const rolloutThreads = filterSourceThreads(sources.rollout, filters);
    const sessionIndexThreads = filterSourceThreads(sources.sessionIndex, filters);
    const threads = safeThreadList(mergeThreadSummaryList([
      ...stateDbThreads,
      ...rolloutThreads,
      ...sessionIndexThreads,
    ])).slice(0, bounded);
    return {
      threads,
      counts: {
        stateDb: stateDbThreads.length,
        rollout: rolloutThreads.length,
        sessionIndex: sessionIndexThreads.length,
        baselineSourceCount: stateDbThreads.length + rolloutThreads.length + sessionIndexThreads.length,
        baselineResultCount: threads.length,
      },
    };
  }

  function readBaseline(limit = 80, filters = {}) {
    const bounded = boundedLimit(limit);
    const snapshot = readSourceSnapshot(bounded, filters);
    const baseline = snapshot
      ? buildBaselineFromSources(snapshot, bounded, filters)
      : null;
    const stateDb = snapshot ? null : timedRead("stateDb", readStateDbFallback, bounded, filters);
    const rollout = snapshot ? null : timedRead("rollout", readRolloutSessionFallback, bounded, filters);
    const sessionIndex = snapshot ? null : timedRead("sessionIndex", readSessionIndexFallback, bounded, filters);
    const threads = baseline
      ? baseline.threads
      : safeThreadList(mergeThreadSummaryList([
        ...stateDb.threads,
        ...rollout.threads,
        ...sessionIndex.threads,
      ])).slice(0, bounded);
    const counts = baseline ? baseline.counts : {
      stateDb: stateDb.count,
      rollout: rollout.count,
      sessionIndex: sessionIndex.count,
      baselineSourceCount: stateDb.count + rollout.count + sessionIndex.count,
      baselineResultCount: threads.length,
    };
    const sourceTimings = snapshot ? snapshot.timings : {
      stateDbMs: stateDb.elapsedMs,
      rolloutMs: rollout.elapsedMs,
      sessionIndexMs: sessionIndex.elapsedMs,
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
