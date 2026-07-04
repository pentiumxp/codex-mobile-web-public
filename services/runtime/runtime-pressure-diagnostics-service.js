"use strict";

const { monitorEventLoopDelay, performance } = require("node:perf_hooks");

function boundedNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function boundedInteger(value, fallback = 0) {
  return Math.max(0, Math.trunc(boundedNumber(value, fallback)));
}

function bytesToMb(value) {
  return Math.round((boundedNumber(value) / 1024 / 1024) * 10) / 10;
}

function nsToMs(value) {
  return Math.round((boundedNumber(value) / 1_000_000) * 10) / 10;
}

function normalizeRoutePath(pathname) {
  const value = String(pathname || "").split("?")[0] || "/";
  return value
    .replace(/\/ttc_[a-z0-9]+/gi, "/:taskCardId")
    .replace(/\/loop_[a-z0-9]+/gi, "/:loopId")
    .replace(/\/019[a-z0-9-]{20,}/gi, "/:threadId")
    .replace(/\/[a-f0-9]{24,}/gi, "/:id");
}

function responseObjectCount(value) {
  if (!value || typeof value !== "object") return 0;
  if (Array.isArray(value)) return value.length;
  if (Array.isArray(value.threads)) return value.threads.length;
  if (Array.isArray(value.data)) return value.data.length;
  if (Array.isArray(value.cards)) return value.cards.length;
  if (Array.isArray(value.loops)) return value.loops.length;
  const thread = value.thread && typeof value.thread === "object" ? value.thread : null;
  if (thread && Array.isArray(thread.turns)) return thread.turns.length;
  return Object.keys(value).length;
}

function createRuntimePressureDiagnosticsService(options = {}) {
  const now = typeof options.now === "function" ? options.now : () => Date.now();
  const processRef = options.processRef || process;
  const historyLimit = boundedInteger(options.historyLimit, 80) || 80;
  const slowRouteMs = boundedInteger(options.slowRouteMs, 1000) || 1000;
  const eventLoopResolution = boundedInteger(options.eventLoopResolution, 20) || 20;
  const eventLoopDelay = options.eventLoopDelay || monitorEventLoopDelay({ resolution: eventLoopResolution });
  let eventLoopDelayEnabled = false;
  let previousEventLoopUtilization = performance.eventLoopUtilization();
  const routeHistory = [];
  const routeStats = new Map();

  function enable() {
    if (eventLoopDelayEnabled) return;
    if (eventLoopDelay && typeof eventLoopDelay.enable === "function") {
      eventLoopDelay.enable();
      eventLoopDelayEnabled = true;
    }
  }

  function recordRoute(input = {}) {
    const method = String(input.method || "GET").toUpperCase().slice(0, 12);
    const path = normalizeRoutePath(input.path || input.pathname || "");
    const status = boundedInteger(input.status, 0);
    const elapsedMs = boundedInteger(input.elapsedMs, 0);
    const responseBytes = boundedInteger(input.responseBytes, 0);
    const objectCount = boundedInteger(input.responseObjectCount, 0);
    const at = now();
    const row = { at, method, path, status, elapsedMs, responseBytes, objectCount };
    routeHistory.push(row);
    while (routeHistory.length > historyLimit) routeHistory.shift();

    const key = `${method} ${path}`;
    const stat = routeStats.get(key) || {
      method,
      path,
      count: 0,
      slowCount: 0,
      maxMs: 0,
      totalMs: 0,
      maxBytes: 0,
      last: null,
    };
    stat.count += 1;
    if (elapsedMs >= slowRouteMs) stat.slowCount += 1;
    stat.maxMs = Math.max(stat.maxMs, elapsedMs);
    stat.totalMs += elapsedMs;
    stat.maxBytes = Math.max(stat.maxBytes, responseBytes);
    stat.last = row;
    routeStats.set(key, stat);
  }

  function routeSummary() {
    const stats = [...routeStats.values()]
      .map((stat) => ({
        method: stat.method,
        path: stat.path,
        count: stat.count,
        slowCount: stat.slowCount,
        maxMs: stat.maxMs,
        avgMs: Math.round(stat.totalMs / Math.max(1, stat.count)),
        maxBytes: stat.maxBytes,
        lastMs: stat.last ? stat.last.elapsedMs : 0,
        lastStatus: stat.last ? stat.last.status : 0,
      }))
      .sort((a, b) => (b.slowCount - a.slowCount) || (b.maxMs - a.maxMs))
      .slice(0, 12);
    return {
      slowThresholdMs: slowRouteMs,
      recent: routeHistory.slice(-12),
      slow: routeHistory.filter((row) => row.elapsedMs >= slowRouteMs).slice(-12),
      stats,
    };
  }

  function eventLoopSummary() {
    const current = performance.eventLoopUtilization(previousEventLoopUtilization);
    previousEventLoopUtilization = performance.eventLoopUtilization();
    return {
      enabled: eventLoopDelayEnabled,
      utilization: Math.round(boundedNumber(current.utilization) * 1000) / 1000,
      lagMeanMs: eventLoopDelayEnabled ? nsToMs(eventLoopDelay.mean) : 0,
      lagMaxMs: eventLoopDelayEnabled ? nsToMs(eventLoopDelay.max) : 0,
      lagP95Ms: eventLoopDelayEnabled && typeof eventLoopDelay.percentile === "function" ? nsToMs(eventLoopDelay.percentile(95)) : 0,
      lagP99Ms: eventLoopDelayEnabled && typeof eventLoopDelay.percentile === "function" ? nsToMs(eventLoopDelay.percentile(99)) : 0,
    };
  }

  function processSummary() {
    const memory = typeof processRef.memoryUsage === "function" ? processRef.memoryUsage() : {};
    return {
      pid: Number(processRef.pid || 0) || undefined,
      uptimeSec: typeof processRef.uptime === "function" ? Math.round(processRef.uptime()) : undefined,
      rssMb: bytesToMb(memory.rss),
      heapUsedMb: bytesToMb(memory.heapUsed),
      heapTotalMb: bytesToMb(memory.heapTotal),
      externalMb: bytesToMb(memory.external),
    };
  }

  function status() {
    enable();
    return {
      process: processSummary(),
      eventLoop: eventLoopSummary(),
      routes: routeSummary(),
    };
  }

  return {
    enable,
    normalizeRoutePath,
    recordRoute,
    responseObjectCount,
    status,
  };
}

module.exports = {
  createRuntimePressureDiagnosticsService,
  normalizeRoutePath,
  responseObjectCount,
};
