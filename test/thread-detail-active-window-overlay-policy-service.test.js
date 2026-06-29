"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  classifyActiveOverlayItem,
  mergeActiveOverlayTurnWithWindowBackfill,
  mergeProjectionThreadWithActiveOverlay,
  planActiveWindowOverlay,
  summarizeActiveOverlayTurnEvidence,
} = require("../adapters/thread-detail-active-window-overlay-policy-service");

function projectionThread(overrides = {}) {
  return Object.assign({
    id: "thread-1",
    mobileReadMode: "projection-v4-partial",
    mobileProjection: {
      partial: true,
      source: "partial",
      version: "v4",
      revision: 4,
    },
    turns: [{ id: "older-turn", items: [{ type: "agentMessage" }] }],
  }, overrides);
}

function overlayTurn(overrides = {}) {
  return Object.assign({
    id: "active-turn",
    items: [
      { type: "commandExecution", startedAtMs: 110 },
      { type: "input_image", createdAtMs: 111 },
      { type: "agentMessage", updatedAtMs: 120 },
      { type: "turnDiagnostic", createdAtMs: 121 },
    ],
  }, overrides);
}

test("active window overlay plan accepts complete bounded evidence", () => {
  const plan = planActiveWindowOverlay({
    summary: { activeTurnId: "active-turn", status: { type: "active" } },
    projectionThread: projectionThread(),
    overlaySource: "app-server-notification",
    overlayTurn: overlayTurn(),
    projectionRevision: 4,
    overlayRevision: 5,
  });

  assert.equal(plan.action, "use-projection-overlay");
  assert.equal(plan.reason, "overlay-evidence-complete");
  assert.equal(plan.activeTurnIdPresent, true);
  assert.equal(plan.projectionWindowPresent, true);
  assert.equal(plan.overlayTurnPresent, true);
  assert.equal(plan.overlayTurnMatched, true);
  assert.equal(plan.operationCoverage, "present");
  assert.equal(plan.uploadCoverage, "present");
  assert.equal(plan.assistantDeltaCoverage, "fresh");
  assert.equal(plan.receiptCoverage, "present");
  assert.deepEqual(plan.counts, {
    items: 4,
    operationItems: 1,
    uploadItems: 1,
    assistantItems: 1,
    receiptItems: 1,
    otherItems: 0,
    unknownItems: 0,
  });
  assert.doesNotMatch(JSON.stringify(plan), /active-turn[^-]/);
});

test("active window overlay evidence summary classifies item kinds without body text", () => {
  assert.equal(classifyActiveOverlayItem({ type: "toolCall" }), "operation");
  assert.equal(classifyActiveOverlayItem({ type: "mcpToolCall" }), "operation");
  assert.equal(classifyActiveOverlayItem({ type: "dynamicToolCall" }), "operation");
  assert.equal(classifyActiveOverlayItem({ type: "input_image" }), "upload");
  assert.equal(classifyActiveOverlayItem({ type: "agentMessage", text: "private body" }), "assistant");
  assert.equal(classifyActiveOverlayItem({ type: "usage" }), "receipt");
  assert.equal(classifyActiveOverlayItem({ type: "unknown-custom" }), "other");
  assert.equal(classifyActiveOverlayItem(null), "unknown");

  const summary = summarizeActiveOverlayTurnEvidence({
    id: "private-turn-id",
    items: [
      { type: "toolCall", text: "private command" },
      { type: "image", path: "/private/upload.png" },
      { type: "assistant", text: "private response" },
      { type: "usage", text: "private usage line" },
    ],
  });

  assert.equal(summary.turnId, "private-turn-id");
  assert.equal(summary.operationItems, 1);
  assert.equal(summary.uploadItems, 1);
  assert.equal(summary.assistantItems, 1);
  assert.equal(summary.receiptItems, 1);
  assert.doesNotMatch(JSON.stringify({
    operationItems: summary.operationItems,
    uploadItems: summary.uploadItems,
    assistantItems: summary.assistantItems,
    receiptItems: summary.receiptItems,
  }), /private|upload\.png/);
});

test("active window overlay plan fails closed without active turn id", () => {
  const plan = planActiveWindowOverlay({
    summary: { status: { type: "active" } },
    projectionThread: projectionThread(),
    overlaySource: "app-server-notification",
    overlayTurn: overlayTurn(),
  });

  assert.equal(plan.action, "require-full-read");
  assert.equal(plan.reason, "missing-active-turn-id");
});

test("active window overlay plan fails closed without projection window", () => {
  const plan = planActiveWindowOverlay({
    summary: { activeTurnId: "active-turn" },
    projectionThread: { turns: [] },
    overlaySource: "app-server-notification",
    overlayTurn: overlayTurn(),
  });

  assert.equal(plan.action, "require-full-read");
  assert.equal(plan.reason, "empty-projection-window");
});

test("active window overlay plan requires authoritative overlay source", () => {
  const plan = planActiveWindowOverlay({
    summary: { activeTurnId: "active-turn" },
    projectionThread: projectionThread(),
    overlaySource: "browser-local-echo",
    overlayTurn: overlayTurn(),
  });

  assert.equal(plan.action, "require-full-read");
  assert.equal(plan.reason, "non-authoritative-overlay-source");
});

test("active window overlay plan rejects active turn mismatch", () => {
  const plan = planActiveWindowOverlay({
    summary: { activeTurnId: "active-turn" },
    projectionThread: projectionThread(),
    overlaySource: "mux-notification",
    overlayTurn: overlayTurn({ id: "other-turn" }),
  });

  assert.equal(plan.action, "require-full-read");
  assert.equal(plan.reason, "active-turn-mismatch");
  assert.equal(plan.overlayTurnMatched, false);
});

test("active window overlay plan rejects unknown item kinds", () => {
  const plan = planActiveWindowOverlay({
    summary: { activeTurnId: "active-turn" },
    projectionThread: projectionThread(),
    overlaySource: "app-server-notification",
    overlayTurn: { id: "active-turn", items: [null] },
  });

  assert.equal(plan.action, "require-full-read");
  assert.equal(plan.reason, "unknown-overlay-item-kind");
});

test("active window overlay plan rejects partial live snapshot until it is backfilled", () => {
  const partial = planActiveWindowOverlay({
    summary: { activeTurnId: "active-turn" },
    projectionThread: projectionThread(),
    overlaySource: "projection-live",
    overlayTurn: overlayTurn(),
    overlayCompleteness: "partial",
    operationCoverage: "present",
    uploadCoverage: "present",
    receiptCoverage: "present",
    projectionRevision: 4,
    overlayRevision: 5,
  });

  assert.equal(partial.action, "require-full-read");
  assert.equal(partial.reason, "active-overlay-turn-incomplete");

  const backfilled = planActiveWindowOverlay({
    summary: { activeTurnId: "active-turn" },
    projectionThread: projectionThread(),
    overlaySource: "projection-live",
    overlayTurn: overlayTurn(),
    overlayCompleteness: "backfilled",
    operationCoverage: "present",
    uploadCoverage: "present",
    receiptCoverage: "present",
    projectionRevision: 4,
    overlayRevision: 5,
  });

  assert.equal(backfilled.action, "use-projection-overlay");
  assert.equal(backfilled.reason, "overlay-evidence-complete");
});

test("active window overlay plan requires explicit none coverage for absent categories", () => {
  const plan = planActiveWindowOverlay({
    summary: { activeTurnId: "active-turn" },
    projectionThread: projectionThread(),
    overlaySource: "app-server-notification",
    overlayTurn: { id: "active-turn", items: [{ type: "agentMessage", updatedAtMs: 120 }] },
    projectionTimestampMs: 100,
  });

  assert.equal(plan.action, "require-full-read");
  assert.equal(plan.reason, "operation-evidence-unknown");

  const complete = planActiveWindowOverlay({
    summary: { activeTurnId: "active-turn" },
    projectionThread: projectionThread(),
    overlaySource: "app-server-notification",
    overlayTurn: { id: "active-turn", items: [{ type: "agentMessage", updatedAtMs: 120 }] },
    operationCoverage: "none",
    uploadCoverage: "none",
    receiptCoverage: "none",
    projectionTimestampMs: 100,
  });

  assert.equal(complete.action, "use-projection-overlay");
  assert.equal(complete.assistantDeltaCoverage, "fresh");
});

test("active window overlay plan requires explicit assistant freshness evidence", () => {
  const plan = planActiveWindowOverlay({
    summary: { activeTurnId: "active-turn" },
    projectionThread: projectionThread(),
    overlaySource: "app-server-notification",
    overlayTurn: {
      id: "active-turn",
      items: [{ type: "agentMessage" }],
    },
    operationCoverage: "none",
    uploadCoverage: "none",
    receiptCoverage: "none",
  });

  assert.equal(plan.action, "require-full-read");
  assert.equal(plan.reason, "assistant-delta-unknown");
  assert.equal(plan.assistantDeltaCoverage, "unknown");
});

test("active window overlay plan falls back to timestamps when only one revision is visible", () => {
  const plan = planActiveWindowOverlay({
    summary: { activeTurnId: "active-turn" },
    projectionThread: projectionThread(),
    overlaySource: "projection-live",
        overlayCompleteness: "full",
        overlayPartial: false,
    overlayTurn: {
      id: "active-turn",
      items: [{ type: "agentMessage", updatedAtMs: 260 }],
    },
    operationCoverage: "none",
    uploadCoverage: "none",
    receiptCoverage: "none",
    overlayCompleteness: "full",
    projectionRevision: 12,
    projectionTimestampMs: 200,
    overlayTimestampMs: 260,
  });

  assert.equal(plan.action, "use-projection-overlay");
  assert.equal(plan.reason, "overlay-evidence-complete");
  assert.equal(plan.assistantDeltaCoverage, "fresh");

  const stale = planActiveWindowOverlay({
    summary: { activeTurnId: "active-turn" },
    projectionThread: projectionThread(),
    overlaySource: "projection-live",
        overlayCompleteness: "full",
        overlayPartial: false,
    overlayTurn: {
      id: "active-turn",
      items: [{ type: "agentMessage", updatedAtMs: 180 }],
    },
    operationCoverage: "none",
    uploadCoverage: "none",
    receiptCoverage: "none",
    overlayCompleteness: "full",
    overlayRevision: 12,
    projectionTimestampMs: 200,
    overlayTimestampMs: 180,
  });

  assert.equal(stale.action, "require-full-read");
  assert.equal(stale.reason, "assistant-delta-stale");
  assert.equal(stale.assistantDeltaCoverage, "stale");
});

test("active window overlay plan rejects stale assistant deltas", () => {
  const plan = planActiveWindowOverlay({
    summary: { activeTurnId: "active-turn" },
    projectionThread: projectionThread(),
    overlaySource: "projection-live",
        overlayCompleteness: "full",
        overlayPartial: false,
    overlayTurn: overlayTurn(),
    overlayCompleteness: "full",
    projectionRevision: 10,
    overlayRevision: 9,
  });

  assert.equal(plan.action, "require-full-read");
  assert.equal(plan.reason, "assistant-delta-stale");
  assert.equal(plan.assistantDeltaCoverage, "stale");
});

test("active overlay window projection revision does not make live overlay stale", () => {
  const plan = planActiveWindowOverlay({
    summary: { activeTurnId: "active-turn" },
    projectionThread: projectionThread({
      mobileReadMode: "projection-active-window",
      mobileProjection: {
        partial: true,
        source: "partial",
        version: "active-window",
        partialKind: "turns-list-active-overlay-window",
        activeOverlayWindow: true,
        revision: 10,
      },
    }),
    overlaySource: "projection-live",
        overlayCompleteness: "full",
        overlayPartial: false,
    overlayTurn: overlayTurn(),
    overlayCompleteness: "full",
    projectionRevision: 10,
    overlayRevision: 9,
  });

  assert.equal(plan.action, "use-projection-overlay");
  assert.equal(plan.reason, "overlay-evidence-complete");
  assert.equal(plan.assistantDeltaCoverage, "fresh");
});

test("active window overlay plan requires receipt coverage", () => {
  const plan = planActiveWindowOverlay({
    summary: { activeTurnId: "active-turn" },
    projectionThread: projectionThread(),
    overlaySource: "server-active-overlay",
    overlayTurn: {
      id: "active-turn",
      items: [
        { type: "commandExecution" },
        { type: "input_image" },
        { type: "agentMessage", updatedAtMs: 120 },
      ],
    },
    projectionTimestampMs: 100,
  });

  assert.equal(plan.action, "require-full-read");
  assert.equal(plan.reason, "receipt-evidence-unknown");
  assert.equal(plan.receiptCoverage, "unknown");
});

test("active window overlay merge appends or replaces the active turn without mutating projection", () => {
  const projected = projectionThread();
  const overlay = overlayTurn();
  const merged = mergeProjectionThreadWithActiveOverlay(projected, overlay, {
    overlaySource: "app-server-notification",
    reason: "overlay-evidence-complete",
    counts: { items: 4 },
  });

  assert.equal(merged.mobileReadMode, "projection-active-overlay");
  assert.equal(merged.mobileProjection.activeOverlay, true);
  assert.equal(merged.mobileProjection.activeOverlaySource, "app-server-notification");
  assert.equal(merged.mobileActiveOverlay.reason, "overlay-evidence-complete");
  assert.equal(merged.activeTurnId, "active-turn");
  assert.deepEqual(merged.turns.map((turn) => turn.id), ["older-turn", "active-turn"]);
  assert.deepEqual(projected.turns.map((turn) => turn.id), ["older-turn"]);

  const replaced = mergeProjectionThreadWithActiveOverlay({
    id: "thread-1",
    turns: [{ id: "active-turn", items: [{ type: "agentMessage", text: "old" }] }],
    mobileProjection: { source: "partial" },
  }, { id: "active-turn", items: [{ type: "agentMessage", text: "new" }] }, {
    overlaySource: "mux-notification",
  });
  assert.equal(replaced.turns.length, 1);
  assert.equal(replaced.turns[0].items[0].text, "new");
});

test("active overlay turn backfill preserves earlier assistant items from active window", () => {
  const merged = mergeActiveOverlayTurnWithWindowBackfill({
    id: "active-turn",
    items: [
      { id: "agent-2", type: "agentMessage", text: "newer delta" },
      { id: "agent-3", type: "agentMessage", text: "late overlay" },
    ],
  }, {
    id: "thread-1",
    turns: [{
      id: "active-turn",
      status: "inProgress",
      items: [
        { id: "user-1", type: "userMessage", text: "private user" },
        { id: "agent-1", type: "agentMessage", text: "early assistant" },
        { id: "agent-2", type: "agentMessage", text: "old assistant" },
      ],
    }],
  });

  assert.deepEqual(merged.items.map((item) => item.id), ["user-1", "agent-1", "agent-2", "agent-3"]);
  assert.equal(merged.items[2].text, "newer delta");
  assert.equal(merged.mobileActiveOverlayBackfill.version, "active-overlay-window-backfill-v1");
  assert.equal(merged.mobileActiveOverlayBackfill.sourceItems, 3);
  assert.equal(merged.mobileActiveOverlayBackfill.overlayItems, 2);
  assert.equal(merged.mobileActiveOverlayBackfill.mergedItems, 4);
});

test("active overlay turn backfill dedupes matching user message echoes", () => {
  const merged = mergeActiveOverlayTurnWithWindowBackfill({
    id: "active-turn",
    status: "inProgress",
    items: [
      {
        id: "mux-user-thread-turn-client-1",
        type: "userMessage",
        mobilePendingSubmission: true,
        clientSubmissionId: "client-1",
        content: [{ type: "text", text: "please process once" }],
      },
      { id: "agent-2", type: "agentMessage", text: "newer delta" },
    ],
  }, {
    id: "thread-1",
    turns: [{
      id: "active-turn",
      status: "inProgress",
      items: [
        {
          id: "durable-user-1",
          type: "userMessage",
          content: [{ type: "text", text: "please process once" }],
        },
        { id: "agent-1", type: "agentMessage", text: "early assistant" },
      ],
    }],
  });

  assert.deepEqual(merged.items.map((item) => item.id), ["durable-user-1", "agent-1", "agent-2"]);
  assert.equal(merged.mobileActiveOverlayBackfill.sourceItems, 2);
  assert.equal(merged.mobileActiveOverlayBackfill.overlayItems, 2);
  assert.equal(merged.mobileActiveOverlayBackfill.mergedItems, 3);
  assert.equal(merged.mobileActiveOverlayBackfill.dedupedUserMessageEchoes, 1);
});

test("active overlay turn backfill avoids deep cloning large item payloads", () => {
  const largePayload = { body: "x".repeat(1024) };
  const windowItem = { id: "agent-1", type: "agentMessage", payload: largePayload };
  const overlayItem = { id: "agent-2", type: "agentMessage", payload: largePayload };
  const merged = mergeActiveOverlayTurnWithWindowBackfill({
    id: "active-turn",
    items: [overlayItem],
  }, {
    id: "active-turn",
    items: [windowItem],
  });

  assert.notEqual(merged.items[0], windowItem);
  assert.notEqual(merged.items[1], overlayItem);
  assert.equal(merged.items[0].payload, largePayload);
  assert.equal(merged.items[1].payload, largePayload);
  merged.items[0].id = "changed-result-id";
  assert.equal(windowItem.id, "agent-1");
});

test("active window overlay merge compacts overlay turn before response merge", () => {
  const projected = projectionThread();
  const overlay = overlayTurn({
    items: [
      { id: "tool-old", type: "mcpToolCall", arguments: { private: "old" }, result: { body: "old-result" } },
      { id: "tool-new", type: "mcpToolCall", arguments: { private: "new" }, result: { body: "new-result" } },
      { id: "agent-1", type: "agentMessage", text: "visible assistant" },
    ],
  });
  const compactedOverlayIds = [];
  const merged = mergeProjectionThreadWithActiveOverlay(projected, overlay, {
    overlaySource: "projection-live",
        overlayCompleteness: "full",
        overlayPartial: false,
    compactOverlayTurn: (turn) => Object.assign({}, turn, {
      items: turn.items
        .filter((item) => item.type !== "mcpToolCall" || item.id === "tool-new")
        .map((item) => item.type === "mcpToolCall"
          ? { id: item.id, type: item.type, status: item.status, mobileLiveOperation: true }
          : item),
    }),
  });

  for (const item of merged.turns[1].items) compactedOverlayIds.push(item.id);
  assert.deepEqual(compactedOverlayIds, ["tool-new", "agent-1"]);
  assert.equal(JSON.stringify(merged).includes("old-result"), false);
  assert.equal(JSON.stringify(merged).includes("new-result"), false);
  assert.equal(JSON.stringify(merged).includes("private"), false);
});
