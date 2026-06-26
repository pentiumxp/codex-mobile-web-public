"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  diagnoseThreadListColdPath,
} = require("../adapters/thread-list-cold-path-diagnosis-service");

test("thread-list cold path diagnosis classifies deferred and warm cache paths", () => {
  assert.deepEqual(diagnoseThreadListColdPath({
    fallbackDeferred: true,
    fallbackDeferredReason: "active-thread-detail",
  }), {
    owner: "deferred-fallback",
    reason: "active-thread-detail",
  });

  assert.deepEqual(diagnoseThreadListColdPath({
    fallbackCacheDecision: "hit",
    fallbackCacheHit: true,
    fallbackCacheIncrementalUpdates: 2,
  }), {
    owner: "warm-fallback-cache",
    reason: "cache-hit-incremental",
  });
});

test("thread-list cold path diagnosis attributes miss rebuilds to dominant baseline source", () => {
  assert.deepEqual(diagnoseThreadListColdPath({
    fallbackCacheDecision: "miss-rebuild",
    fallbackStateDbMs: 4,
    fallbackRolloutMs: 25,
    fallbackSessionIndexMs: 7,
    fallbackStateDbCount: 4,
    fallbackRolloutCount: 12,
    fallbackSessionIndexCount: 6,
    fallbackBaselineSourceCount: 22,
    fallbackBaselineResultCount: 10,
  }), {
    owner: "fallback-baseline",
    reason: "miss-rebuild:rollout",
  });

  assert.deepEqual(diagnoseThreadListColdPath({
    fallbackCacheDecision: "miss-rebuild",
    fallbackStateDbCount: 8,
    fallbackRolloutCount: 1,
    fallbackSessionIndexCount: 2,
    fallbackBaselineSourceCount: 11,
    fallbackBaselineResultCount: 8,
  }), {
    owner: "fallback-baseline",
    reason: "miss-rebuild:state-db",
  });
});

test("thread-list cold path diagnosis distinguishes ttl rebuilds and app-server paths", () => {
  assert.deepEqual(diagnoseThreadListColdPath({
    fallbackCacheDecision: "expired-rebuild",
    fallbackStateDbMs: 6,
    fallbackRolloutMs: 2,
  }), {
    owner: "fallback-cache-policy",
    reason: "ttl-expired:state-db",
  });

  assert.deepEqual(diagnoseThreadListColdPath({
    appServerMs: 18,
    fallbackMs: 0,
  }), {
    owner: "app-server-thread-list",
    reason: "app-server-only",
  });

  assert.deepEqual(diagnoseThreadListColdPath({
    appServerError: "request timed out",
    fallbackCacheDecision: "hit",
  }), {
    owner: "app-server-thread-list",
    reason: "app-server-error-fallback",
  });
});

test("thread-list cold path diagnosis stays bounded and does not copy private fields", () => {
  const diagnosis = diagnoseThreadListColdPath({
    fallbackCacheDecision: "miss-rebuild",
    fallbackBaselineSourceCount: 0,
    fallbackBaselineResultCount: 0,
    privatePrompt: "do not copy this prompt",
    appServerError: "",
  });

  assert.deepEqual(diagnosis, {
    owner: "fallback-baseline",
    reason: "miss-rebuild:empty-baseline",
  });
  assert.doesNotMatch(JSON.stringify(diagnosis), /private prompt/);
});
