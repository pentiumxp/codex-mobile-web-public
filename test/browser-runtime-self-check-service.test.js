"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const service = require(path.join(__dirname, "..", "adapters", "browser-runtime-self-check-service.js"));
const script = require(path.join(__dirname, "..", "scripts", "codex-mobile-browser-runtime-self-check.js"));

test("browser runtime self-check catches sparse DOM after confirmed nonempty target content", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    minSettledDelayMs: 1000,
    samples: [
      {
        label: "first",
        threadHash: "thread-hash",
        appVisible: true,
        targetConfirmed: true,
        contentConfirmed: true,
        turns: 6,
        items: 24,
        renderKeys: 30,
      },
      {
        label: "second",
        threadHash: "thread-hash",
        appVisible: true,
        targetConfirmed: true,
        contentConfirmed: true,
        turns: 0,
        items: 0,
        renderKeys: 1,
        delayMs: 1200,
        loadingNote: true,
      },
    ],
  });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.code === "browser_dom_sparse_after_nonempty" && issue.severity === "H2"));
  assert.ok(report.issues.some((issue) => issue.code === "browser_dom_final_sparse_after_nonempty"));
});

test("browser runtime self-check catches unconfirmed sparse downgrade after confirmed target content", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    minSettledDelayMs: 1000,
    samples: [
      {
        label: "confirmed-content",
        threadHash: "thread-hash",
        appVisible: true,
        targetConfirmed: true,
        contentConfirmed: true,
        turns: 8,
        items: 40,
        renderKeys: 45,
      },
      {
        label: "current-thread-dropped",
        threadHash: "thread-hash",
        appVisible: true,
        targetConfirmed: true,
        contentConfirmed: false,
        turns: 0,
        items: 0,
        renderKeys: 1,
        delayMs: 1200,
        emptyState: true,
      },
    ],
  });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.code === "browser_dom_sparse_after_nonempty" && issue.severity === "H2"));
});

test("browser runtime self-check catches visible item downgrade after confirmed target content", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    minSettledDelayMs: 1000,
    samples: [
      {
        label: "confirmed-rich-content",
        threadHash: "thread-hash",
        appVisible: true,
        targetConfirmed: true,
        contentConfirmed: true,
        turns: 10,
        items: 80,
        renderKeys: 85,
      },
      {
        label: "dropped-middle-items",
        threadHash: "thread-hash",
        appVisible: true,
        targetConfirmed: true,
        contentConfirmed: true,
        turns: 4,
        items: 25,
        renderKeys: 30,
        delayMs: 1600,
      },
    ],
  });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.code === "browser_dom_visible_items_downgraded_after_nonempty"));
});

test("browser runtime self-check ignores previous-thread residue as nonempty baseline", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    minSettledDelayMs: 1000,
    samples: [
      {
        label: "previous-thread-residue",
        threadHash: "target-thread-hash",
        appVisible: true,
        targetConfirmed: true,
        contentConfirmed: false,
        turns: 8,
        items: 32,
        renderKeys: 40,
      },
      {
        label: "initial-loading",
        threadHash: "target-thread-hash",
        appVisible: true,
        targetConfirmed: true,
        contentConfirmed: false,
        turns: 0,
        items: 0,
        renderKeys: 1,
        delayMs: 1200,
        loadingNote: true,
      },
    ],
  });

  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});

test("browser runtime self-check catches latest usage timestamp and image failures", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    samples: [{
      label: "dom-contract",
      threadHash: "thread-hash",
      appVisible: true,
      targetConfirmed: true,
      contentConfirmed: true,
      latestTurnMatchesTarget: true,
      expectedLatestUsageRequired: true,
      latestTurnUsageCount: 0,
      latestTimestampExpectedItems: 2,
      latestTimestampMissingItems: 1,
      imageCount: 2,
      imageFailedFigureCount: 1,
      brokenCompleteImageCount: 1,
      imageFailureCount: 2,
      turns: 3,
      items: 9,
      renderKeys: 12,
    }],
  });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.code === "browser_latest_turn_usage_missing"));
  assert.ok(report.issues.some((issue) => issue.code === "browser_latest_turn_timestamp_missing"));
  assert.ok(report.issues.some((issue) => issue.code === "browser_image_render_failed"));
});

test("browser runtime self-check catches latest turn assistant text duplicates", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    samples: [{
      label: "latest-turn-duplicate",
      threadHash: "thread-hash",
      appVisible: true,
      targetConfirmed: true,
      contentConfirmed: true,
      latestTurnMatchesTarget: true,
      latestTurnAssistantMessageCount: 4,
      latestTurnAssistantTextDuplicateCount: 1,
      turns: 3,
      items: 12,
      renderKeys: 12,
    }],
  });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.code === "browser_latest_turn_assistant_text_duplicate"));
  assert.equal(report.sampleSummary.maxLatestTurnAssistantTextDuplicates, 1);
});

test("browser runtime self-check catches latest turn item and message count downgrades", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    minSettledDelayMs: 1000,
    samples: [
      {
        label: "rich-latest-turn",
        threadHash: "thread-hash",
        appVisible: true,
        targetConfirmed: true,
        contentConfirmed: true,
        latestTurnMatchesTarget: true,
        latestTurnHash: "latest-turn-hash",
        latestTurnItemCount: 8,
        latestTurnUserMessageCount: 2,
        latestTurnAssistantMessageCount: 4,
        turns: 4,
        items: 24,
        delayMs: 1200,
      },
      {
        label: "latest-turn-dropped",
        threadHash: "thread-hash",
        appVisible: true,
        targetConfirmed: true,
        contentConfirmed: true,
        latestTurnMatchesTarget: true,
        latestTurnHash: "latest-turn-hash",
        latestTurnItemCount: 4,
        latestTurnUserMessageCount: 1,
        latestTurnAssistantMessageCount: 2,
        turns: 4,
        items: 20,
        delayMs: 1600,
      },
    ],
  });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.code === "browser_latest_turn_item_count_downgraded"));
  assert.ok(report.issues.some((issue) => issue.code === "browser_latest_turn_user_message_downgraded"));
  assert.ok(report.issues.some((issue) => issue.code === "browser_latest_turn_assistant_message_downgraded"));
  assert.equal(report.sampleSummary.maxLatestTurnItems, 8);
  assert.equal(report.sampleSummary.maxLatestTurnUserMessages, 2);
  assert.equal(report.sampleSummary.maxLatestTurnAssistantMessages, 4);
});

test("browser runtime self-check catches pending user message disappearing after submission", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    minSettledDelayMs: 1000,
    samples: [
      {
        label: "pending-visible",
        threadHash: "thread-hash",
        appVisible: true,
        targetConfirmed: true,
        contentConfirmed: true,
        turns: 4,
        items: 20,
        latestTurnUserMessageCount: 1,
        clientSubmissionCount: 1,
        delayMs: 1200,
      },
      {
        label: "pending-dropped",
        threadHash: "thread-hash",
        appVisible: true,
        targetConfirmed: true,
        contentConfirmed: true,
        turns: 4,
        items: 20,
        latestTurnUserMessageCount: 0,
        clientSubmissionCount: 0,
        delayMs: 1600,
      },
    ],
  });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.code === "browser_pending_user_message_disappeared"));
  assert.equal(report.sampleSummary.maxClientSubmissions, 1);
});

test("browser runtime self-check accepts pending user message replaced by durable user message", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    minSettledDelayMs: 1000,
    samples: [
      {
        label: "pending-visible",
        threadHash: "thread-hash",
        appVisible: true,
        targetConfirmed: true,
        contentConfirmed: true,
        turns: 4,
        items: 20,
        latestTurnUserMessageCount: 1,
        clientSubmissionCount: 1,
        delayMs: 1200,
      },
      {
        label: "durable-visible",
        threadHash: "thread-hash",
        appVisible: true,
        targetConfirmed: true,
        contentConfirmed: true,
        turns: 4,
        items: 20,
        latestTurnUserMessageCount: 1,
        clientSubmissionCount: 0,
        delayMs: 1600,
      },
    ],
  });

  assert.equal(report.ok, true);
  assert.ok(!report.issues.some((issue) => issue.code === "browser_pending_user_message_disappeared"));
});

test("browser runtime self-check catches duplicate DOM keys and runtime exceptions", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    samples: [{
      label: "dup",
      threadHash: "thread-hash",
      appVisible: true,
      targetConfirmed: true,
      contentConfirmed: true,
      turns: 3,
      items: 9,
      renderKeys: 12,
      duplicateRenderKeys: 1,
      duplicateItemIds: 2,
    }],
    exceptions: [{ code: "uncaught" }],
  });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.code === "browser_duplicate_render_keys"));
  assert.ok(report.issues.some((issue) => issue.code === "browser_duplicate_item_ids"));
  assert.ok(report.issues.some((issue) => issue.code === "browser_runtime_exception"));
});

test("browser runtime self-check helper output is metadata-only", () => {
  const privateThreadId = "019-private-thread-id";
  const rows = service.safeThreadRows([{ id: privateThreadId, title: "private title" }], 1);

  assert.equal(rows[0].threadHash, service.stableTextHash(privateThreadId));
  assert.doesNotMatch(JSON.stringify(rows), /019-private-thread-id|private title/);

  const report = service.analyzeBrowserRuntimeSamples({
    samples: [{
      label: "private label with spaces",
      threadHash: service.stableTextHash(privateThreadId),
      appVisible: true,
      turns: 2,
      items: 4,
    }],
    networkEvents: [
      { route: "/api/client-events?key=secret-token", status: 200 },
      { route: "thread_detail", status: 200 },
    ],
  });
  const serialized = JSON.stringify(report);
  assert.doesNotMatch(serialized, /019-private-thread-id|private title|secret-token|cookie|access_key|message body/i);
});

test("browser runtime self-check script exposes bounded browser snapshot fields", () => {
  const expression = script.snapshotExpression({
    threadId: "thread-private-id",
    threadHash: "thread-hash",
    expectedTurnHashes: ["expected-hash"],
    expectedLatestTurnHash: "expected-hash",
    label: "sample",
    delayMs: 1200,
  });

  assert.match(expression, /duplicateRenderKeys/);
  assert.match(expression, /duplicateItemIds/);
  assert.match(expression, /renderRoot = conversation \|\| document/);
  assert.match(expression, /contentConfirmed/);
  assert.match(expression, /expectedLatestUsageRequired/);
  assert.match(expression, /latestTurnHash/);
  assert.match(expression, /latestTurnUserMessageCount/);
  assert.match(expression, /latestTurnAssistantMessageCount/);
  assert.match(expression, /latestTurnAssistantTextDuplicateCount/);
  assert.match(expression, /latestTimestampMissingItems/);
  assert.match(expression, /imageFailureCount/);
  assert.match(expression, /brokenCompleteImageCount/);
  assert.match(expression, /data-client-submission-hash/);
  assert.match(expression, /loadingNote/);
  assert.match(expression, /emptyState/);
  assert.match(expression, /codexMobileCurrentThreadId/);
  assert.doesNotMatch(expression, /innerText|location\.href|document\.cookie|Authorization|Bearer/);
});

test("browser runtime self-check route and console classifiers are bounded", () => {
  assert.equal(script.routeKind("http://127.0.0.1:8787/api/threads/private-id?key=secret"), "thread_detail");
  assert.equal(script.routeKind("http://127.0.0.1:8787/api/client-events?key=secret"), "client_events");
  assert.equal(script.routeKind("http://127.0.0.1:8787/private/path?cookie=value"), "other");
  assert.equal(script.safeConsoleText("Failed to load resource: the server responded with a status of 500"), "resource_load_failed");
  assert.equal(script.safeConsoleText("Uncaught TypeError: private value"), "uncaught");
});
