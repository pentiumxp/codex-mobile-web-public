"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const serverJs = fs.readFileSync(path.resolve(__dirname, "..", "server.js"), "utf8");
const packageJson = fs.readFileSync(path.resolve(__dirname, "..", "package.json"), "utf8");
const requirements = fs.readFileSync(path.resolve(__dirname, "..", "docs", "THREAD_SIDE_CHAT_REQUIREMENTS.md"), "utf8");
const design = fs.readFileSync(path.resolve(__dirname, "..", "docs", "THREAD_SIDE_CHAT_DESIGN.md"), "utf8");
const implementation = fs.readFileSync(path.resolve(__dirname, "..", "docs", "THREAD_SIDE_CHAT_IMPLEMENTATION.md"), "utf8");

test("server wires side chat routes to the server-side persistence service", () => {
  assert.match(serverJs, /createThreadSideChatService/);
  assert.match(serverJs, /CODEX_MOBILE_THREAD_SIDE_CHAT_FILE/);
  assert.match(serverJs, /const threadSideChatService = createThreadSideChatService/);
  assert.match(serverJs, /GET \/api\/threads\/:threadId\/side-chat/);
  assert.match(serverJs, /threadSideChatService\.get\(threadSideChatId\)/);
  assert.match(serverJs, /threadSideChatService\.updateDraft/);
  assert.match(serverJs, /threadSideChatService\.addMessage/);
  assert.match(serverJs, /threadSideChatService\.createCandidate/);
  assert.match(serverJs, /threadSideChatService\.queueCandidate/);
  assert.match(serverJs, /threadSideChatService\.applyCandidate/);
  assert.match(serverJs, /threadSideChatService\.cancelCandidate/);
  assert.match(serverJs, /threadSideChatService\.clear/);
  assert.match(serverJs, /executeCandidate:\s*async/);
  assert.match(serverJs, /codex\.request\("thread\/resume"/);
  assert.match(serverJs, /codex\.request\("turn\/start"/);
  assert.match(serverJs, /maybeApplyQueuedThreadSideChat/);
  assert.match(serverJs, /threadSideChatService\.maybeApplyQueuedCandidate\(threadId\)/);
  assert.doesNotMatch(serverJs, /sideChat[\s\S]{0,120}turn\/steer/);
});

test("side chat persistence docs forbid browser-local storage", () => {
  const combined = `${requirements}\n${design}\n${implementation}`;
  assert.match(combined, /server-side under the Codex Mobile runtime state root/);
  assert.match(combined, /must not use browser localStorage, sessionStorage, IndexedDB, or\s+`public\/draft-store\.js`/);
  assert.doesNotMatch(combined, /Browser-local draft backup is allowed/);
  assert.doesNotMatch(combined, /last-mile unsynced backup/);
  assert.doesNotMatch(combined, /optional browser-local unsynced side-chat draft fallback/);
});

test("package syntax check includes the side chat service", () => {
  assert.match(packageJson, /adapters\/thread-side-chat-service\.js/);
});
