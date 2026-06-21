"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  analyzeWorkspaceDelegation,
  buildWorkspaceDelegationTaskCardPayload,
  textContainsWorkspacePath,
} = require("../adapters/workspace-delegation-service");

const sourceThread = {
  id: "codex-thread",
  name: "codex mobile",
  cwd: "/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web",
};

const threads = [
  sourceThread,
  {
    id: "home-ai-thread",
    name: "Home AI 06-18",
    cwd: "/Users/hermes-dev/HermesMobileDev/app",
  },
  {
    id: "finance-thread",
    name: "记账",
    cwd: "/Users/hermes-dev/HermesMobileDev/plugins/finance",
  },
  {
    id: "music-thread",
    name: "Music",
    cwd: "/Users/xuxin/Documents/Music",
  },
];

test("workspace path plus mutating intent delegates to the matching thread", () => {
  const analysis = analyzeWorkspaceDelegation({
    text: "到 /Users/hermes-dev/HermesMobileDev/app 里修复平台契约检查，然后提交。",
    currentThread: sourceThread,
    threads,
  });
  assert.equal(analysis.shouldDelegate, true);
  assert.equal(analysis.targetThreadId, "home-ai-thread");
  assert.equal(analysis.targetWorkspaceId, "/Users/hermes-dev/HermesMobileDev/app");
  assert.equal(analysis.reason, "workspace_path_match");
});

test("current workspace references are not delegated", () => {
  const analysis = analyzeWorkspaceDelegation({
    text: "把 /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web 的委派策略实现一下。",
    currentThread: sourceThread,
    threads,
  });
  assert.equal(analysis.shouldDelegate, false);
  assert.equal(analysis.reason, "no_target_match");
});

test("read-only references to another thread do not delegate automatically", () => {
  const analysis = analyzeWorkspaceDelegation({
    text: "你看一下 Finance 线程状态为什么滞后。",
    currentThread: sourceThread,
    threads,
  });
  assert.equal(analysis.shouldDelegate, false);
  assert.equal(analysis.reason, "no_target_match");
});

test("explicit card wording with a target title delegates", () => {
  const analysis = analyzeWorkspaceDelegation({
    text: "发卡给 Home AI，让它补充这个语音输入需求的设计文档。",
    currentThread: sourceThread,
    threads,
  });
  assert.equal(analysis.shouldDelegate, true);
  assert.equal(analysis.targetThreadId, "home-ai-thread");
  assert.equal(analysis.reason, "explicit_delegation_alias_match");
});

test("attachments and active turn steering are never auto-delegated", () => {
  assert.equal(analyzeWorkspaceDelegation({
    text: "到 /Users/hermes-dev/HermesMobileDev/app 修一下",
    currentThread: sourceThread,
    threads,
    attachmentsCount: 1,
  }).reason, "attachments_not_delegated");
  assert.equal(analyzeWorkspaceDelegation({
    text: "到 /Users/hermes-dev/HermesMobileDev/app 修一下",
    currentThread: sourceThread,
    threads,
    activeTurnId: "turn-1",
  }).reason, "active_turn_not_delegated");
});

test("task-card payload is bounded and uses source-direct defaults", () => {
  const analysis = analyzeWorkspaceDelegation({
    text: "到 /Users/hermes-dev/HermesMobileDev/app 里修复平台契约检查，然后提交。",
    currentThread: sourceThread,
    threads,
  });
  const payload = buildWorkspaceDelegationTaskCardPayload({
    text: "到 /Users/hermes-dev/HermesMobileDev/app 里修复平台契约检查，然后提交。",
    currentThread: sourceThread,
    analysis,
  });
  assert.equal(payload.targetThreadId, "home-ai-thread");
  assert.equal(payload.sourceThreadId, "codex-thread");
  assert.equal(payload.workflowMode, "manual");
  assert.equal(payload.autoApprove, true);
  assert.equal(payload.direct, true);
  assert.match(payload.idempotencyKey, /^workspace-delegation:/);
  assert.match(payload.body, /## Cross-workspace delegation/);
  assert.match(payload.body, /## Execution boundary/);
});

test("workspace path detection supports macOS and Windows path text", () => {
  assert.equal(textContainsWorkspacePath("请修改 /Users/xuxin/Documents/Music/runtime", "/Users/xuxin/Documents/Music"), true);
  assert.equal(textContainsWorkspacePath("请修改 C:\\Users\\xuxin\\Documents\\Music", "C:/Users/xuxin/Documents/Music"), true);
});
