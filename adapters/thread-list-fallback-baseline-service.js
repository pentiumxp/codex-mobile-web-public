"use strict";

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

  function readBaseline(limit = 80, filters = {}) {
    const bounded = boundedLimit(limit);
    const stateDb = timedRead("stateDb", readStateDbFallback, bounded, filters);
    const rollout = timedRead("rollout", readRolloutSessionFallback, bounded, filters);
    const sessionIndex = timedRead("sessionIndex", readSessionIndexFallback, bounded, filters);
    const threads = safeThreadList(mergeThreadSummaryList([
      ...stateDb.threads,
      ...rollout.threads,
      ...sessionIndex.threads,
    ])).slice(0, bounded);
    const timings = {
      stateDbMs: stateDb.elapsedMs,
      rolloutMs: rollout.elapsedMs,
      sessionIndexMs: sessionIndex.elapsedMs,
      stateDbCount: stateDb.count,
      rolloutCount: rollout.count,
      sessionIndexCount: sessionIndex.count,
      baselineSourceCount: stateDb.count + rollout.count + sessionIndex.count,
      baselineResultCount: threads.length,
    };
    return {
      threads,
      timings,
      sources: {
        stateDb: stateDb.count,
        rollout: rollout.count,
        sessionIndex: sessionIndex.count,
      },
    };
  }

  return {
    readBaseline,
  };
}

module.exports = {
  createThreadListFallbackBaselineService,
};
