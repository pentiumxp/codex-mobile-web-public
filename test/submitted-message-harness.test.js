"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  analyzeSubmittedMessageScenario,
  buildMarkers,
  entryUrlForScenario,
  extractThreadMarkerEvidence,
  installBrowserSessionKey,
  installBrowserThreadTarget,
  markerHash,
  parseArgs,
} = require("../scripts/codex-mobile-submitted-message-harness");

test("submitted message harness flags duplicate visible user cards", () => {
  const markers = buildMarkers({ messagePrefix: "CM_TEST", repeat: 1 }, 1234);
  const result = analyzeSubmittedMessageScenario({
    markers,
    samples: [
      {
        t: 350,
        markers: {
          [markers[0].hash]: {
            visibleUserArticleCount: 2,
            visibleUserNodeCount: 2,
            dataItemCount: 1,
          },
        },
      },
    ],
    apiEvidence: {
      byMarker: {
        [markers[0].hash]: {
          durableUserItemCount: 1,
          userMessageAfterUsageCount: 0,
        },
      },
    },
    postCount: 1,
    expectedPosts: 1,
  });

  assert.equal(result.ok, false);
  assert.ok(result.issueCodes.includes("visible_user_card_duplicate"));
});

test("submitted message harness classifies duplicate that clears after reopen as transient", () => {
  const markers = buildMarkers({ messagePrefix: "CM_TEST", repeat: 1 }, 1234);
  const result = analyzeSubmittedMessageScenario({
    markers,
    samples: [
      {
        t: 350,
        markers: {
          [markers[0].hash]: {
            visibleUserArticleCount: 2,
            visibleUserNodeCount: 2,
            dataItemCount: 1,
          },
        },
      },
    ],
    reopenSamples: [
      {
        t: 900,
        markers: {
          [markers[0].hash]: {
            visibleUserArticleCount: 1,
            visibleUserNodeCount: 1,
            dataItemCount: 1,
          },
        },
      },
      {
        t: 2800,
        markers: {
          [markers[0].hash]: {
            visibleUserArticleCount: 1,
            visibleUserNodeCount: 1,
            dataItemCount: 1,
          },
        },
      },
    ],
    apiEvidence: {
      byMarker: {
        [markers[0].hash]: {
          durableUserItemCount: 1,
          userMessageAfterUsageCount: 0,
        },
      },
    },
    postCount: 1,
    expectedPosts: 1,
  });

  assert.equal(result.ok, false);
  assert.ok(result.issueCodes.includes("visible_user_card_duplicate"));
  assert.ok(result.issueCodes.includes("transient_visible_user_duplicate_clears_after_reopen"));
});

test("submitted message harness treats composer residual as observation only", () => {
  const markers = buildMarkers({ messagePrefix: "CM_TEST", repeat: 1 }, 1234);
  const result = analyzeSubmittedMessageScenario({
    markers,
    samples: [
      {
        t: 100,
        markers: {
          [markers[0].hash]: {
            visibleUserArticleCount: 1,
            visibleUserNodeCount: 1,
            dataItemCount: 1,
            composerResidualCount: 1,
          },
        },
      },
    ],
    apiEvidence: {
      byMarker: {
        [markers[0].hash]: {
          durableUserItemCount: 1,
          userMessageAfterUsageCount: 0,
        },
      },
    },
    postCount: 1,
    expectedPosts: 1,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.issueCodes, []);
  assert.deepEqual(result.observations, ["composer_residual_observed"]);
});

test("submitted message harness flags durable duplicate and post-usage ordering", () => {
  const marker = "CM_TEST_ORDER diagnostic marker";
  const evidence = extractThreadMarkerEvidence({
    thread: {
      turns: [
        {
          id: "turn-1",
          items: [
            { type: "assistantMessage", text: "done" },
            { type: "turnUsage", text: "usage" },
            { type: "userMessage", text: marker },
            { type: "userMessage", text: marker },
          ],
        },
      ],
    },
  }, [{ marker, hash: markerHash(marker) }]);
  const result = analyzeSubmittedMessageScenario({
    markers: [{ marker, hash: markerHash(marker) }],
    samples: [
      {
        t: 1600,
        markers: {
          [markerHash(marker)]: {
            visibleUserArticleCount: 1,
            visibleUserNodeCount: 1,
            dataItemCount: 1,
          },
        },
      },
    ],
    apiEvidence: evidence,
    postCount: 1,
    expectedPosts: 1,
  });

  assert.equal(result.ok, false);
  assert.ok(result.issueCodes.includes("durable_user_item_duplicate"));
  assert.ok(result.issueCodes.includes("durable_user_message_after_usage"));
});

test("submitted message harness validates configured client build hash from build text", () => {
  const markers = buildMarkers({ messagePrefix: "CM_TEST", repeat: 1 }, 1234);
  const result = analyzeSubmittedMessageScenario({
    markers,
    samples: [],
    apiEvidence: {
      byMarker: {
        [markers[0].hash]: {
          durableUserItemCount: 1,
          userMessageAfterUsageCount: 0,
        },
      },
    },
    postCount: 1,
    expectedPosts: 1,
    expectBuildHash: "abcdef12",
    buildText: "0.1.11|codex-mobile-shell-v625-abcdef123456",
  });

  assert.equal(result.ok, true);
});

test("submitted message harness parses repeat and service worker flags", () => {
  const options = parseArgs([
    "--thread-id", "thread-1",
    "--repeat", "2",
    "--service-workers", "both",
    "--entry-surface", "direct",
    "--submit-method", "auto",
    "--sample-delays-ms", "350,100,350",
  ], {});

  assert.equal(options.threadId, "thread-1");
  assert.equal(options.repeat, 2);
  assert.equal(options.serviceWorkers, "both");
  assert.equal(options.entrySurface, "direct");
  assert.equal(options.submitMethod, "auto");
  assert.deepEqual(options.sampleDelaysMs, [100, 350]);
});

test("submitted message harness flags submit attempts without observed post", () => {
  const markers = buildMarkers({ messagePrefix: "CM_TEST", repeat: 1 }, 1234);
  const result = analyzeSubmittedMessageScenario({
    markers,
    samples: [
      {
        t: 900,
        markers: {
          [markers[0].hash]: {
            visibleUserArticleCount: 1,
            visibleUserNodeCount: 1,
            dataItemCount: 1,
          },
        },
      },
    ],
    apiEvidence: {
      byMarker: {
        [markers[0].hash]: {
          durableUserItemCount: 0,
          userMessageAfterUsageCount: 0,
        },
      },
    },
    postCount: 0,
    expectedPosts: 1,
    submitAttempts: [
      {
        ok: false,
        method: "button",
        composerHasMarker: false,
      },
    ],
  });

  assert.equal(result.ok, false);
  assert.ok(result.issueCodes.includes("message_post_count_mismatch"));
  assert.ok(result.issueCodes.includes("submit_attempt_no_post"));
  assert.ok(result.issueCodes.includes("composer_cleared_without_post"));
});

test("submitted message harness default markers are inert diagnostic text", () => {
  const markers = buildMarkers({ messagePrefix: "CM_TEST", repeat: 1 }, 1234);

  assert.equal(markers[0].marker, "CM_TEST_1234_1 diagnostic marker");
  assert.doesNotMatch(markers[0].marker, /reply exactly|ignore previous|system prompt|assistant/i);
});

test("submitted message harness installs browser session key for frontend API calls", async () => {
  const calls = [];
  const page = {
    evaluate: async (fn, value) => {
      const localRows = [];
      const sessionRows = [];
      const previousLocalStorage = globalThis.localStorage;
      const previousSessionStorage = globalThis.sessionStorage;
      globalThis.localStorage = { setItem: (key, stored) => localRows.push([key, stored]) };
      globalThis.sessionStorage = { setItem: (key, stored) => sessionRows.push([key, stored]) };
      try {
        await fn(value);
      } finally {
        globalThis.localStorage = previousLocalStorage;
        globalThis.sessionStorage = previousSessionStorage;
      }
      calls.push({ localRows, sessionRows });
    },
  };

  await installBrowserSessionKey(page, "test-key");

  assert.deepEqual(calls, [{
    localRows: [["codexMobileKey", "test-key"]],
    sessionRows: [["codexMobileKey", "test-key"]],
  }]);
});

test("submitted message harness opens the requested thread explicitly", async () => {
  const options = parseArgs(["--thread-id", "thread-123"], {});
  const calls = [];
  const page = {
    evaluate: async (fn, value) => {
      const rows = [];
      const previousLocalStorage = globalThis.localStorage;
      globalThis.localStorage = { setItem: (key, stored) => rows.push([key, stored]) };
      try {
        await fn(value);
      } finally {
        globalThis.localStorage = previousLocalStorage;
      }
      calls.push(rows);
    },
  };

  await installBrowserThreadTarget(page, "thread-123");

  const url = new URL(entryUrlForScenario(options, "run-1"));
  assert.equal(url.pathname, "/vite-shell/app-preview.html");
  assert.equal(url.searchParams.get("thread"), "thread-123");
  assert.equal(url.searchParams.get("threadId"), "thread-123");
  assert.deepEqual(calls, [[["codexMobileCurrentThreadId", "thread-123"]]]);
});

test("submitted message harness can target the legacy direct root explicitly", () => {
  const options = parseArgs(["--server", "http://127.0.0.1:8897", "--thread-id", "thread-123", "--entry-surface", "direct"], {});
  const url = new URL(entryUrlForScenario(options, "run-1"));

  assert.equal(url.pathname, "/");
  assert.equal(url.searchParams.get("threadId"), "thread-123");
});
