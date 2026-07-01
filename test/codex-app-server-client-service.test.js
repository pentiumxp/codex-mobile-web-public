"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const canonicalCodexAppServerClientService = require("../services/runtime/codex-app-server-client-service");
const adapterCodexAppServerClientService = require("../adapters/codex-app-server-client-service");

const { createCodexAppServerClient } = canonicalCodexAppServerClientService;

test("app-server client adapter re-exports the canonical runtime service boundary", () => {
  assert.equal(
    adapterCodexAppServerClientService.createCodexAppServerClient,
    canonicalCodexAppServerClientService.createCodexAppServerClient,
  );
});

test("app-server client refreshes rate limits from the latest live getter", async () => {
  let liveRateLimits = { current: true };
  const getterValues = [];
  const checkedValues = [];
  const client = createCodexAppServerClient({
    LIVE_RATE_LIMIT_REFRESH_MIN_INTERVAL_MS: 0,
    latestLiveRateLimits: () => {
      getterValues.push(liveRateLimits);
      return liveRateLimits;
    },
    hasCurrentRateLimitWindow: (value) => {
      checkedValues.push(value);
      return Boolean(value && value.current);
    },
  });

  client.ready = true;
  client.ws = { readyState: 1 };

  let refreshCount = 0;
  client.refreshRateLimits = async () => {
    refreshCount += 1;
  };

  await client.refreshRateLimitsIfMissing();
  assert.equal(refreshCount, 0);

  liveRateLimits = null;
  await client.refreshRateLimitsIfMissing();
  assert.equal(refreshCount, 1);
  assert.deepEqual(getterValues, [{ current: true }, null]);
  assert.deepEqual(checkedValues, [{ current: true }]);
});
