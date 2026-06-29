"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createPublicConfigRuntimeCache,
  stableJson,
} = require("../adapters/public-config-runtime-cache-service");

test("stableJson sorts object keys for cache signatures", () => {
  assert.equal(
    stableJson({ b: 2, a: { d: 4, c: 3 } }),
    stableJson({ a: { c: 3, d: 4 }, b: 2 }),
  );
});

test("public config profile cache reuses profile state within ttl", () => {
  let now = 1000;
  let calls = 0;
  const cache = createPublicConfigRuntimeCache({
    now: () => now,
    profileTtlMs: 5000,
  });
  const activeQuota = { rateLimits: { limitId: "codex" }, rateLimitsByModel: {}, source: "active-live" };
  const loadProfiles = () => {
    calls += 1;
    return { activeProfileId: "default", profiles: [{ id: "default" }], calls };
  };

  const first = cache.getProfileState({ activeQuota, loadProfiles });
  const second = cache.getProfileState({ activeQuota, loadProfiles });

  assert.equal(first.cacheHit, false);
  assert.equal(second.cacheHit, true);
  assert.equal(first.value, second.value);
  assert.equal(calls, 1);
});

test("public config profile cache misses when active quota changes", () => {
  let calls = 0;
  const cache = createPublicConfigRuntimeCache({ now: () => 1000, profileTtlMs: 5000 });
  const loadProfiles = ({ activeQuota }) => {
    calls += 1;
    return { activeProfileId: "default", profiles: [], source: activeQuota.source };
  };

  cache.getProfileState({ activeQuota: { source: "active-live", rateLimits: { limitId: "codex" } }, loadProfiles });
  const second = cache.getProfileState({ activeQuota: { source: "active-live", rateLimits: { limitId: "codex-bengalfox" } }, loadProfiles });

  assert.equal(second.cacheHit, false);
  assert.equal(calls, 2);
});

test("public config profile cache expires and can be invalidated", () => {
  let now = 1000;
  let calls = 0;
  const cache = createPublicConfigRuntimeCache({
    now: () => now,
    profileTtlMs: 100,
  });
  const activeQuota = { source: null, rateLimits: null, rateLimitsByModel: {} };
  const loadProfiles = () => ({ profiles: [], calls: ++calls });

  cache.getProfileState({ activeQuota, loadProfiles });
  now = 1050;
  assert.equal(cache.getProfileState({ activeQuota, loadProfiles }).cacheHit, true);
  now = 1201;
  assert.equal(cache.getProfileState({ activeQuota, loadProfiles }).cacheHit, false);
  cache.invalidateProfiles();
  assert.equal(cache.getProfileState({ activeQuota, loadProfiles }).cacheHit, false);
  assert.equal(calls, 3);
});
