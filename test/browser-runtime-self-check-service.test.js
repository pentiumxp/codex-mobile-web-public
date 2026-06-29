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
      imageFigureCount: 2,
      imageFailedFigureCount: 1,
      brokenCompleteImageCount: 1,
      imageFailureCount: 2,
      imageFailureKindCounts: {
        "failed-class": 1,
        "protected-placeholder": 1,
        "hermes-proxy-generated-image": 1,
      },
      imageFailureDetails: [{
        reason: "failed-class",
        figureKind: "image-view",
        displaySourceKind: "protected-placeholder",
        protectedSourceKind: "hermes-proxy-generated-image",
        missingSrc: false,
        hasImage: true,
        complete: true,
        naturalWidth: 0,
        naturalHeight: 0,
        recoveryCount: 2,
      }],
      turns: 3,
      items: 9,
      renderKeys: 12,
    }],
  });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.code === "browser_latest_turn_usage_missing"));
  assert.ok(report.issues.some((issue) => issue.code === "browser_latest_turn_timestamp_missing"));
  const imageIssue = report.issues.find((issue) => issue.code === "browser_image_render_failed");
  assert.ok(imageIssue);
  assert.equal(imageIssue.imageFigureCount, 2);
  assert.equal(imageIssue.imageFailureKindCounts["protected-placeholder"], 1);
  assert.equal(imageIssue.firstImageFailure.protectedSourceKind, "hermes-proxy-generated-image");
  assert.equal(report.sampleSummary.maxImageFigures, 2);
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

test("browser runtime self-check catches latest turn user message duplicates", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    samples: [{
      label: "latest-user-duplicate",
      threadHash: "thread-hash",
      appVisible: true,
      targetConfirmed: true,
      contentConfirmed: true,
      latestTurnMatchesTarget: true,
      expectedLatestUserMessageCount: 2,
      expectedLatestUserMessageDuplicateCount: 1,
      latestTurnUserMessageCount: 2,
      latestTurnUserTextDuplicateCount: 1,
      turns: 3,
      items: 12,
      renderKeys: 12,
    }],
  });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.code === "browser_api_latest_turn_user_message_duplicate"));
  assert.ok(report.issues.some((issue) => issue.code === "browser_latest_turn_user_message_duplicate"));
  assert.equal(report.sampleSummary.maxExpectedLatestUserMessageDuplicates, 1);
  assert.equal(report.sampleSummary.maxLatestTurnUserTextDuplicates, 1);
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

test("browser runtime self-check catches latest turn user messages below API expectation", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    samples: [{
      label: "api-dom-user-gap",
      threadHash: "thread-hash",
      appVisible: true,
      targetConfirmed: true,
      contentConfirmed: true,
      latestTurnMatchesTarget: true,
      expectedLatestUserMessageCount: 4,
      latestTurnUserMessageCount: 3,
      turns: 3,
      items: 12,
      renderKeys: 12,
    }],
  });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.code === "browser_latest_turn_user_message_below_api_expectation"));
});

test("browser runtime self-check catches latest turn task card below API expectation", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    samples: [{
      label: "api-dom-task-card-gap",
      threadHash: "thread-hash",
      appVisible: true,
      targetConfirmed: true,
      contentConfirmed: true,
      latestTurnMatchesTarget: true,
      expectedLatestTaskCardUserMessageCount: 1,
      latestTurnTaskCardItemCount: 0,
      turns: 3,
      items: 12,
      renderKeys: 12,
    }],
  });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.code === "browser_latest_turn_task_card_below_api_expectation"));
});

test("browser runtime self-check catches visible process items in latest turn DOM", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    samples: [{
      label: "visible-process-items",
      threadHash: "thread-hash",
      appVisible: true,
      targetConfirmed: true,
      contentConfirmed: true,
      latestTurnMatchesTarget: true,
      latestTurnOperationItemCount: 2,
      latestTurnReasoningItemCount: 1,
      turns: 3,
      items: 12,
      renderKeys: 12,
    }],
  });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.code === "browser_latest_turn_operation_items_visible"));
  assert.ok(report.issues.some((issue) => issue.code === "browser_latest_turn_reasoning_items_visible"));
  assert.equal(report.sampleSummary.maxLatestTurnOperationItems, 2);
  assert.equal(report.sampleSummary.maxLatestTurnReasoningItems, 1);
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

test("browser runtime self-check catches submit exercise user message never becoming visible", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    minSettledDelayMs: 1000,
    samples: [
      {
        label: "submit-pre",
        threadHash: "thread-hash",
        appVisible: true,
        targetConfirmed: true,
        contentConfirmed: true,
        exerciseSubmit: true,
        submitPhase: "pre",
        submitOk: false,
        turns: 4,
        items: 20,
        delayMs: 0,
      },
      {
        label: "submit-post-1600",
        threadHash: "thread-hash",
        appVisible: true,
        targetConfirmed: true,
        contentConfirmed: true,
        exerciseSubmit: true,
        submitPhase: "post-1600",
        submitOk: true,
        turns: 4,
        items: 20,
        latestTurnUserMessageCount: 0,
        clientSubmissionCount: 0,
        delayMs: 1600,
      },
    ],
  });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.code === "browser_submit_user_message_not_visible"));
});

test("browser runtime self-check accepts submit exercise user message in actual latest DOM turn", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    minSettledDelayMs: 1000,
    samples: [
      {
        label: "submit-post-1600",
        threadHash: "thread-hash",
        appVisible: true,
        targetConfirmed: true,
        contentConfirmed: true,
        exerciseSubmit: true,
        submitPhase: "post-1600",
        submitOk: true,
        turns: 5,
        items: 24,
        latestTurnUserMessageCount: 0,
        actualLatestTurnUserMessageCount: 1,
        clientSubmissionCount: 0,
        delayMs: 1600,
      },
    ],
  });

  assert.equal(report.ok, true);
  assert.ok(!report.issues.some((issue) => issue.code === "browser_submit_user_message_not_visible"));
  assert.equal(report.sampleSummary.maxActualLatestTurnUserMessages, 1);
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

test("browser runtime self-check catches small visual anchor jitter without DOM loss", () => {
  const base = {
    threadHash: "thread-hash",
    appVisible: true,
    targetConfirmed: true,
    contentConfirmed: true,
    turns: 6,
    items: 24,
    renderKeys: 30,
    visualAnchorKeyHash: "anchor-hash",
    visualFrameHash: "frame-hash",
    scrollHeight: 2400,
    delayMs: 1200,
  };
  const report = service.analyzeBrowserRuntimeSamples({
    minSettledDelayMs: 1000,
    samples: [
      Object.assign({}, base, { label: "stable-1", visualAnchorTopPx: 120 }),
      Object.assign({}, base, { label: "jitter-1", visualAnchorTopPx: 126 }),
      Object.assign({}, base, { label: "jitter-2", visualAnchorTopPx: 121 }),
    ],
  });

  assert.equal(report.ok, true);
  assert.ok(report.issues.some((issue) => issue.code === "browser_visual_anchor_jitter" && issue.severity === "H3"));
  assert.equal(report.sampleSummary.maxVisualAnchorSmallJitterCount, 2);
  assert.equal(report.sampleSummary.maxVisualAnchorShiftPx, 6);
});

test("browser runtime self-check catches submitted message card jitter", () => {
  const base = {
    threadHash: "thread-hash",
    appVisible: true,
    targetConfirmed: true,
    contentConfirmed: true,
    exerciseSubmit: true,
    submitOk: true,
    turns: 5,
    items: 22,
    renderKeys: 24,
    delayMs: 1200,
    clientSubmissionCount: 1,
    latestTurnUserMessageCount: 1,
    submittedMessageKeyHash: "submitted-key",
  };
  const report = service.analyzeBrowserRuntimeSamples({
    minSettledDelayMs: 1000,
    samples: [
      Object.assign({}, base, { label: "submit-post-350", submitPhase: "post-350", submittedMessageTopPx: 640 }),
      Object.assign({}, base, { label: "submit-post-900", submitPhase: "post-900", submittedMessageTopPx: 648 }),
    ],
  });

  assert.equal(report.ok, true);
  assert.ok(report.issues.some((issue) => issue.code === "browser_submitted_message_card_jitter" && issue.severity === "H3"));
  assert.equal(report.sampleSummary.maxSubmittedMessageSmallJitterCount, 1);
  assert.equal(report.sampleSummary.maxSubmittedMessageShiftPx, 8);
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
  assert.match(expression, /expectedLatestUserMessageCount/);
  assert.match(expression, /expectedLatestTaskCardUserMessageCount/);
  assert.match(expression, /latestTurnHash/);
  assert.match(expression, /latestTurnUserMessageCount/);
  assert.match(expression, /latestTurnTaskCardItemCount/);
  assert.match(expression, /latestTurnAssistantMessageCount/);
  assert.match(expression, /actualLatestTurnUserMessageCount/);
  assert.match(expression, /actualLatestTurnAssistantMessageCount/);
  assert.match(expression, /latestTurnOperationItemCount/);
  assert.match(expression, /latestTurnReasoningItemCount/);
  assert.match(expression, /latestTurnAssistantTextDuplicateCount/);
  assert.match(expression, /latestTimestampMissingItems/);
  assert.match(expression, /imageFailureCount/);
  assert.match(expression, /imageSourceKind/);
  assert.match(expression, /imageFailureKindCounts/);
  assert.match(expression, /imageFailureDetails/);
  assert.match(expression, /brokenCompleteImageCount/);
  assert.match(expression, /data-client-submission-hash/);
  assert.match(expression, /visualAnchorKeyHash/);
  assert.match(expression, /visualFrameHash/);
  assert.match(expression, /submittedMessageKeyHash/);
  assert.match(expression, /conversationTopPx/);
  assert.match(expression, /loadingNote/);
  assert.match(expression, /emptyState/);
  assert.match(expression, /codexMobileCurrentThreadId/);
  assert.doesNotMatch(expression, /innerText|location\.href|document\.cookie|Authorization|Bearer/);
});

test("browser runtime self-check exposes explicit composer submit exercise", () => {
  const expression = script.submitComposerExpression("Codex Mobile self-check test. Reply exactly: OK");

  assert.match(expression, /requestSubmit/);
  assert.match(expression, /messageInput/);
  assert.match(expression, /sendMessage/);
  assert.match(expression, /InputEvent/);
  assert.doesNotMatch(expression, /document\.cookie|Authorization|Bearer/);
});

test("browser runtime self-check route and console classifiers are bounded", () => {
  assert.equal(script.routeKind("http://127.0.0.1:8787/api/threads/private-id?key=secret"), "thread_detail");
  assert.equal(script.routeKind("http://127.0.0.1:8787/api/client-events?key=secret"), "client_events");
  assert.equal(script.routeKind("http://127.0.0.1:8787/private/path?cookie=value"), "other");
  assert.equal(script.safeConsoleText("Failed to load resource: the server responded with a status of 500"), "resource_load_failed");
  assert.equal(script.safeConsoleText("Uncaught TypeError: private value"), "uncaught");
});
