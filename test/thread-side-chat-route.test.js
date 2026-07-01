"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const serverJs = fs.readFileSync(path.resolve(__dirname, "..", "server.js"), "utf8");
const serverRuntimeConfigServiceJs = fs.readFileSync(
  path.resolve(__dirname, "..", "services", "runtime", "server-runtime-config-service.js"),
  "utf8",
);
const packageJson = fs.readFileSync(path.resolve(__dirname, "..", "package.json"), "utf8");
const apiDispatchRouteServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "server-routes", "api-dispatch-route-service.js"), "utf8");
const routeServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "server-routes", "thread-side-chat-route-service.js"), "utf8");
const routeAdapterJs = fs.readFileSync(path.resolve(__dirname, "..", "adapters", "thread-side-chat-route-service.js"), "utf8");
const orchestrationServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "adapters", "thread-side-chat-orchestration-service.js"), "utf8");
const requirements = fs.readFileSync(path.resolve(__dirname, "..", "docs", "THREAD_SIDE_CHAT_REQUIREMENTS.md"), "utf8");
const design = fs.readFileSync(path.resolve(__dirname, "..", "docs", "THREAD_SIDE_CHAT_DESIGN.md"), "utf8");
const implementation = fs.readFileSync(path.resolve(__dirname, "..", "docs", "THREAD_SIDE_CHAT_IMPLEMENTATION.md"), "utf8");

test("server delegates side chat route and orchestration to owner modules", () => {
  assert.match(serverJs, /createThreadSideChatService/);
  assert.match(serverJs, /createThreadSideChatOrchestrationService/);
  assert.match(serverJs, /handleThreadSideChatRoute/);
  assert.match(serverJs, /THREAD_SIDE_CHAT_FILE/);
  assert.match(serverRuntimeConfigServiceJs, /CODEX_MOBILE_THREAD_SIDE_CHAT_FILE/);
  assert.match(serverJs, /const threadSideChatService = createThreadSideChatService/);
  assert.match(serverJs, /const threadSideChatOrchestrationService = createThreadSideChatOrchestrationService/);
  assert.match(apiDispatchRouteServiceJs, /orchestrationService: threadSideChatOrchestrationService/);
  assert.match(serverJs, /threadSideChatService\.isSidecarThreadId/);
  assert.match(serverJs, /executeCandidate:\s*async/);
  assert.match(serverJs, /maybeApplyQueuedThreadSideChat/);
  assert.doesNotMatch(serverJs, /function sideChatReadOnlyRuntimeSettings/);
  assert.doesNotMatch(serverJs, /function ensureSideChatSidecarThread/);
  assert.doesNotMatch(serverJs, /function parentThreadSideChatContext/);
  assert.doesNotMatch(serverJs, /function startSideChatAssistantReply/);
  assert.doesNotMatch(serverJs, /sideChat[\s\S]{0,120}turn\/steer/);
  assert.match(serverJs, /require\("\.\/server-routes\/thread-side-chat-route-service"\)/);
});

test("side chat route module and adapters own route and hidden sidecar orchestration behavior", () => {
  assert.match(routeServiceJs, /GET/);
  assert.match(routeServiceJs, /\/api\\\/threads\\\/\(\[\^\/\]\+\)\\\/side-chat/);
  assert.match(routeServiceJs, /threadSideChatService\.get\(threadId\)/);
  assert.match(routeServiceJs, /threadSideChatService\.updateDraft/);
  assert.match(routeServiceJs, /threadSideChatService\.addMessage/);
  assert.match(routeServiceJs, /orchestrationService\.startAssistantReply\(threadId, result\.message\)/);
  assert.match(routeServiceJs, /threadSideChatService\.createCandidate/);
  assert.match(routeServiceJs, /threadSideChatService\.queueCandidate/);
  assert.match(routeServiceJs, /threadSideChatService\.applyCandidate/);
  assert.match(routeServiceJs, /threadSideChatService\.cancelCandidate/);
  assert.match(routeServiceJs, /threadSideChatService\.clear/);
  assert.match(orchestrationServiceJs, /function sideChatReadOnlyRuntimeSettings/);
  assert.match(orchestrationServiceJs, /function ensureSideChatSidecarThread/);
  assert.match(orchestrationServiceJs, /function parentThreadSideChatContext/);
  assert.match(orchestrationServiceJs, /function startAssistantReply/);
  assert.match(orchestrationServiceJs, /codex\.request\("thread\/resume"/);
  assert.match(orchestrationServiceJs, /codex\.request\("turn\/start"/);
  assert.match(orchestrationServiceJs, /threadSideChatService\.maybeApplyQueuedCandidate\(threadId\)/);
  assert.match(orchestrationServiceJs, /readOnlySandboxPolicy/);
  assert.match(routeAdapterJs, /require\("\.\.\/server-routes\/thread-side-chat-route-service"\)/);
  assert.doesNotMatch(routeAdapterJs, /threadSideChatService\.addMessage/);
});

test("side chat persistence docs forbid browser-local storage", () => {
  const combined = `${requirements}\n${design}\n${implementation}`;
  assert.match(combined, /server-side under the Codex Mobile runtime state root/);
  assert.match(combined, /must not use browser localStorage, sessionStorage, IndexedDB, or\s+`public\/draft-store\.js`/);
  assert.doesNotMatch(combined, /Browser-local draft backup is allowed/);
  assert.doesNotMatch(combined, /last-mile unsynced backup/);
  assert.doesNotMatch(combined, /optional browser-local unsynced side-chat draft fallback/);
});

test("package syntax check includes the side chat services", () => {
  assert.match(packageJson, /adapters\/thread-side-chat-service\.js/);
  assert.match(packageJson, /adapters\/thread-side-chat-orchestration-service\.js/);
  assert.match(packageJson, /server-routes\/thread-side-chat-route-service\.js/);
  assert.match(packageJson, /adapters\/thread-side-chat-route-service\.js/);
});
