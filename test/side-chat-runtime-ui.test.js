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
const serverRuntimeUtilsJs = fs.readFileSync(path.join(root, "services", "runtime", "server-runtime-utils.js"), "utf8");
const sideChatRuntimeJs = fs.readFileSync(path.join(root, "public", "side-chat-runtime.js"), "utf8");

const { createSideChatRuntime } = require(path.join(root, "public", "side-chat-runtime.js"));

function createRuntimeFixture() {
  const state = {
    activeTurnId: "turn-active",
    currentThreadId: "thread-1",
    currentThread: {
      id: "thread-1",
      turns: [{
        id: "turn-active",
        status: "active",
        items: [{
          id: "agent-1",
          type: "collabAgentToolCall",
          status: "running",
          name: "Review agent",
          targetThread: "thread-child",
          task: "Review a bounded change",
        }],
      }],
    },
    nowMs: Date.parse("2026-07-01T00:00:00.000Z"),
    subagentPanelOpen: true,
    sideChatBusyKey: "",
    sideChatError: "",
    sideChatLoadingThreadId: "",
    sideChatNotice: null,
    sideChatRenderSignature: "",
    threadSideChats: new Map(),
  };
  const runtime = createSideChatRuntime({
    state,
    $: () => null,
    document: { activeElement: null },
    window: { innerWidth: 1000 },
    SIDE_CHAT_DRAFT_MAX_CHARS: 32,
    currentLiveTurn: () => state.currentThread.turns[0],
    latestTurn: () => state.currentThread.turns[0],
    statusText: (status) => String(status && status.type || status || ""),
    escapeHtml: (value) => String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;"),
    escapeSelectorAttr: (value) => String(value || "").replace(/"/g, "\\\""),
    truncateMiddle: (value) => String(value || ""),
    formatTime: () => "00:00",
    collabAgentNameText: (item) => String(item && item.name || ""),
    collabAgentThreadText: (item) => String(item && item.targetThread || ""),
    collabAgentTaskText: (item) => String(item && item.task || ""),
  });
  return { runtime, state };
}

test("side chat runtime is wired into the static shell", () => {
  assert.match(indexHtml, /<script src="\/side-chat-runtime\.js"><\/script>[\s\S]*<script src="\/app\.js"><\/script>/);
  assert.ok(shellManifest.precacheAssets.includes("/side-chat-runtime.js"));
  assert.match(appJs, /"\/side-chat-runtime\.js"/);
  assert.ok(shellManifest.hashAssets.includes("/side-chat-runtime.js"));
  assert.match(swJs, /shell-asset-manifest\.js/);
  assert.match(serverRuntimeUtilsJs, /shell-asset-manifest\.json/);
  assert.match(appJs, /(?:const|var) sideChatRuntimeApi = window\.CodexSideChatRuntime/);
  assert.match(appJs, /function requireSideChatRuntime\(\)/);
  assert.match(appJs, /sideChatRuntimeApi\.createSideChatRuntime\(\{/);
  assert.doesNotMatch(appJs.slice(0, appJs.indexOf("var $ =")), /sideChatRuntimeApi\.createSideChatRuntime\(\{/);
});

test("side chat runtime exposes panel, draft, queue, and gesture APIs", () => {
  const { runtime } = createRuntimeFixture();
  for (const name of [
    "renderSubagentPanel",
    "renderSideChatPanel",
    "loadSideChat",
    "flushSideChatDraftNow",
    "queueSideChatCandidate",
    "applySideChatCandidate",
    "beginSubagentSwipe",
    "handleSubagentWheelSwipe",
  ]) {
    assert.equal(typeof runtime[name], "function", `${name} export`);
  }
});

test("side chat runtime renders subagent and side-chat state without browser storage", () => {
  const { runtime } = createRuntimeFixture();
  runtime.setSideChatState("thread-1", {
    threadId: "thread-1",
    version: 3,
    messages: [
      { role: "user", text: "Plan a follow-up", createdAt: "2026-07-01T00:00:00.000Z" },
      { role: "assistant", text: "Use a candidate.", createdAt: "2026-07-01T00:00:01.000Z" },
    ],
    draft: { text: "Draft text" },
    candidates: [{ id: "candidate-1", status: "queued", body: "Send this later" }],
    queue: { candidateId: "candidate-1", mode: "autoSendWhenIdle", status: "queued" },
    sidecar: { status: "pending" },
  });
  const html = runtime.renderSubagentPanel();
  assert.match(html, /thread-side-panel/);
  assert.match(html, /subagent-status-window/);
  assert.match(html, /Review agent/);
  assert.match(html, /side-chat-message-actions/);
  assert.match(html, /data-side-chat-candidate="candidate-1"/);
  assert.match(html, /data-side-chat-draft/);
  assert.match(html, /maxlength="32"/);
  assert.doesNotMatch(sideChatRuntimeJs, /localStorage|sessionStorage|indexedDB|draftStore/);
});

test("side chat runtime keeps edge-swipe decisions in the extracted module", () => {
  const { runtime, state } = createRuntimeFixture();
  assert.equal(runtime.subagentSwipeStartsNearEdge(950), true);
  assert.equal(runtime.subagentSwipeStartsNearEdge(100), false);
  assert.equal(runtime.subagentSwipeAvailable(), true);
  state.currentThread = null;
  assert.equal(runtime.subagentSwipeAvailable(), false);
});
