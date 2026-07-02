"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { readFrontendSources } = require("./frontend-source-helper");

const root = path.resolve(__dirname, "..");
const appJs = readFrontendSources(root);
const indexHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const swJs = fs.readFileSync(path.join(root, "public", "sw.js"), "utf8");
const shellManifest = JSON.parse(fs.readFileSync(path.join(root, "public", "shell-asset-manifest.json"), "utf8"));
const serverRuntimeUtilsJs = fs.readFileSync(
  path.join(root, "services", "runtime", "server-runtime-utils.js"),
  "utf8",
);

const { createThreadDetailRuntime } = require(path.join(root, "public", "thread-detail-runtime.js"));
const threadDetailStateApi = require(path.join(root, "public", "thread-detail-state.js"));
const threadDetailMergeStateApi = require(path.join(root, "public", "thread-detail-merge-state.js"));
const threadDetailV4MergeStateApi = require(path.join(root, "public", "thread-detail-v4-merge-state.js"));

function createRuntimeFixture() {
  const state = { activeTurnId: "active-turn", currentThread: null };
  return createThreadDetailRuntime({
    state,
    threadDetailStateApi,
    threadDetailMergeStateApi,
    threadDetailV4MergeStateApi,
    statusText(status) {
      return typeof status === "string" ? status : String(status && status.type || "");
    },
    normalizeFsPath(value) {
      return String(value || "").replace(/\\/g, "/").toLowerCase();
    },
    isInputTextPart(part) {
      return Boolean(part && (part.type === "text" || part.type === "input_text"));
    },
    inputTextValue(part) {
      return String(part && (part.text || part.input_text) || "");
    },
    isInputImagePart(part) {
      return Boolean(part && (part.type === "input_image" || part.type === "localImage"));
    },
    imageUrlValue(part) {
      return String(part && (part.url || part.path || part.image_url && part.image_url.url) || "");
    },
    splitAttachmentSummaryText(text) {
      return { text: String(text || ""), attachments: [] };
    },
    truncateMiddle(value) {
      return String(value || "");
    },
    isLiveTurn(turn) {
      return Boolean(turn && (turn.live || /active|running/i.test(String(turn.status && turn.status.type || turn.status || ""))));
    },
    isLatestTurn(turn, thread) {
      const turns = Array.isArray(thread && thread.turns) ? thread.turns : [];
      return Boolean(turn && turns.length && turns[turns.length - 1] === turn);
    },
    isReasoningItem(item) {
      return Boolean(item && item.type === "reasoning");
    },
    isOperationalItem(item) {
      return Boolean(item && item.type === "commandExecution");
    },
    isContextCompactionItem(item) {
      return Boolean(item && item.type === "contextCompaction");
    },
    contextCompactionNotice() {
      return "";
    },
    isTurnComplete(turn) {
      return /completed|failed|cancel/i.test(String(turn && (turn.status && turn.status.type || turn.status) || ""));
    },
    isRunningStatus(status) {
      return /active|running|queued|processing/i.test(String(status && status.type || status || ""));
    },
    isRecentlySubmittedUserMessage(item) {
      return Boolean(item && item.mobilePendingSubmission);
    },
    sortTurnsForDisplay(turns) {
      return turns || [];
    },
    maxVisibleTurnsForThread() {
      return 10;
    },
    numericTimestampMs(value) {
      return Number(value) || 0;
    },
    renderContextThread(thread = null) {
      return thread || state.currentThread || null;
    },
  });
}

test("thread detail runtime is wired into the static shell", () => {
  assert.match(indexHtml, /<script src="\/thread-detail-runtime\.js"><\/script>/);
  assert.ok(shellManifest.precacheAssets.includes("/thread-detail-runtime.js"));
  assert.match(appJs, /"\/thread-detail-runtime\.js"/);
  assert.ok(shellManifest.hashAssets.includes("/thread-detail-runtime.js"));
  assert.match(swJs, /shell-asset-manifest\.js/);
  assert.match(serverRuntimeUtilsJs, /shell-asset-manifest\.json/);
  assert.match(appJs, /(?:const|var) threadDetailRuntimeApi = window\.CodexThreadDetailRuntime/);
  assert.match(appJs, /threadDetailRuntimeApi\.createThreadDetailRuntime\(\{/);
  assert.match(appJs, /function initializeThreadDetailRuntimeWiring\(\)/);
});

test("thread detail runtime exposes merge and echo-normalizer APIs", () => {
  const runtime = createRuntimeFixture();

  for (const name of [
    "visibleItemsForTurn",
    "mergeItemsPreservingLocalVisible",
    "mergeThreadPreservingVisibleItems",
    "normalizeThreadVisibleUserMessages",
    "userMessagesLikelySame",
    "turnIsSupersededBy",
  ]) {
    assert.equal(typeof runtime[name], "function", `${name} export`);
  }

  const local = {
    id: "local-user-submit-1",
    type: "userMessage",
    mobilePendingSubmission: true,
    clientSubmissionId: "submit-1",
    content: [{ type: "text", text: "same prompt" }],
  };
  const durable = {
    id: "real-user-submit-1",
    type: "userMessage",
    clientSubmissionId: "submit-1",
    content: [{ type: "input_text", text: "same   prompt" }],
  };

  const merged = runtime.mergeItemsPreservingLocalVisible([local], [durable], true);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, durable.id);
  assert.equal(merged[0].mobilePendingSubmission, undefined);
});

test("turn ordering uses completion timestamps for completed turns and start timestamps for active turns", () => {
  const runtime = createRuntimeFixture();

  assert.equal(runtime.turnOrderMs({
    status: { type: "completed" },
    startedAtMs: 100,
    completedAtMs: 300,
  }), 300);
  assert.equal(runtime.turnOrderMs({
    status: { type: "running" },
    startedAtMs: 100,
    updatedAtMs: 400,
    completedAtMs: 500,
  }), 100);
  assert.equal(runtime.turnOrderMs({
    status: { type: "completed" },
    startedAtMs: 100,
    updatedAtMs: 250,
  }), 250);
});
