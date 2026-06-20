"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const { createChatGptProMcpService } = require("../adapters/chatgpt-pro-mcp-service");
const { createChatGptProPlannerService } = require("../adapters/chatgpt-pro-planner-service");

function makeReq(token) {
  return {
    headers: {
      authorization: token ? `Bearer ${token}` : "",
    },
  };
}

function makeMcp(options = {}) {
  const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-mcp-runtime-"));
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-mcp-workspace-"));
  fs.writeFileSync(path.join(workspace, "README.md"), "# MCP workspace\n", "utf8");
  const plannerService = createChatGptProPlannerService({
    runtimeRoot,
    now: () => 1780000000000,
    randomBytes: () => Buffer.from("1234567890", "hex"),
    listWorkspaces: async () => [{ cwd: workspace, label: "MCP", active: true }],
    workspaceRoots: async () => [workspace],
    readThreadContext: async ({ threadId }) => ({ id: threadId, title: "Thread", status: "idle", cwd: workspace }),
  });
  const token = "test-token-1234567890";
  const service = createChatGptProMcpService({
    plannerService,
    delegateTaskCard: options.delegateTaskCard,
    allowDirectTaskCards: options.allowDirectTaskCards,
    token,
    version: "0.1.test",
  });
  return { service, token, workspace };
}

test("ChatGPT Pro MCP connector requires a separate configured bearer token", () => {
  const empty = createChatGptProMcpService({ plannerService: { status: () => ({ ok: true }) } });
  assert.equal(empty.isConfigured(), false);

  const { service, token } = makeMcp();
  assert.equal(service.isConfigured(), true);
  assert.equal(service.isAuthorized(makeReq("wrong-token")), false);
  assert.equal(service.isAuthorized(makeReq(token)), true);
});

test("ChatGPT Pro MCP connector exposes initialize and tools/list", async () => {
  const { service } = makeMcp();
  const init = await service.handleJsonRpc({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
  assert.equal(init.result.serverInfo.name, "codex-mobile-chatgpt-pro-planner");
  assert.equal(init.result.capabilities.tools.listChanged, false);

  const listed = await service.handleJsonRpc({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
  const names = listed.result.tools.map((item) => item.name);
  assert.ok(names.includes("codex_mobile_status"));
  assert.ok(names.includes("read_allowed_repo_file"));
  assert.ok(names.includes("create_planner_artifact"));
  assert.ok(names.includes("delegate_to_codex_thread"));
  const delegateTool = listed.result.tools.find((item) => item.name === "delegate_to_codex_thread");
  assert.deepEqual(delegateTool.inputSchema.required, ["sourceThreadId", "targetThreadIds", "title", "bodyMarkdown"]);
  assert.deepEqual(delegateTool.inputSchema.properties.mode.enum, ["draft", "pending", "direct"]);
  assert.ok(!names.includes("execute_now"));
});

test("ChatGPT Pro MCP tools read bounded docs and write runtime artifacts", async () => {
  const { service, workspace } = makeMcp();
  const file = await service.handleJsonRpc({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "read_allowed_repo_file",
      arguments: { cwd: workspace, relativePath: "README.md" },
    },
  });
  assert.match(file.result.structuredContent.content, /MCP workspace/);

  const created = await service.handleJsonRpc({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "create_planner_artifact",
      arguments: {
        type: "review",
        title: "Connector review",
        bodyMarkdown: "# Review\nLooks bounded.",
        cwd: workspace,
        sourceThreadId: "thread-1",
      },
    },
  });
  assert.equal(created.result.structuredContent.artifact.type, "review");
  assert.match(created.result.structuredContent.artifact.id, /^cpp_/);

  const listed = await service.handleJsonRpc({
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: { name: "list_planner_artifacts", arguments: { limit: 5 } },
  });
  assert.equal(listed.result.structuredContent.artifacts.length, 1);
});

test("ChatGPT Pro MCP task-card delegation defaults to pending approval", async () => {
  const calls = [];
  const { service } = makeMcp({
    delegateTaskCard: async (input) => {
      calls.push(input);
      return {
        ok: true,
        sourceThreadId: input.sourceThreadId,
        direct: false,
        autoApprove: false,
        cards: [{
          id: "ttc-pending",
          status: "pending",
          source: { threadId: input.sourceThreadId, title: "Source" },
          target: { threadId: input.targetThreadIds[0] },
          message: { title: input.title, summary: input.summary },
          delivery: {},
        }],
      };
    },
  });

  const result = await service.handleJsonRpc({
    jsonrpc: "2.0",
    id: 7,
    method: "tools/call",
    params: {
      name: "delegate_to_codex_thread",
      arguments: {
        sourceThreadId: "thread-source",
        targetThreadIds: ["thread-target"],
        title: "Review scoped change",
        summary: "Please review this patch.",
        bodyMarkdown: "Review only this scoped change.",
        requestId: "req-1",
      },
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].mode, "pending");
  assert.equal(calls[0].pending, true);
  assert.equal(calls[0].autoApprove, false);
  assert.equal(calls[0].direct, false);
  assert.equal(result.result.structuredContent.mode, "pending");
  assert.equal(result.result.structuredContent.direct, false);
  assert.equal(result.result.structuredContent.card.status, "pending");
  assert.equal(result.result.structuredContent.card.message.title, "Review scoped change");
  assert.equal(result.result.structuredContent.card.message.body, undefined);
});

test("ChatGPT Pro MCP task-card delegation can save a draft without sending", async () => {
  const { service } = makeMcp({
    delegateTaskCard: async () => {
      throw new Error("delegate_should_not_be_called");
    },
  });
  const result = await service.handleJsonRpc({
    jsonrpc: "2.0",
    id: 8,
    method: "tools/call",
    params: {
      name: "delegate_to_codex_thread",
      arguments: {
        mode: "draft",
        sourceThreadId: "thread-source",
        targetThreadIds: ["thread-target"],
        title: "Draft task",
        bodyMarkdown: "Draft body.",
      },
    },
  });
  assert.equal(result.result.structuredContent.mode, "draft");
  assert.equal(result.result.structuredContent.artifact.type, "task_card_draft");
});

test("ChatGPT Pro MCP direct task-card delegation requires explicit enablement", async () => {
  const { service } = makeMcp({
    delegateTaskCard: async () => ({ ok: true, cards: [] }),
  });
  const denied = await service.handleJsonRpc({
    jsonrpc: "2.0",
    id: 9,
    method: "tools/call",
    params: {
      name: "delegate_to_codex_thread",
      arguments: {
        mode: "direct",
        sourceThreadId: "thread-source",
        targetThreadIds: ["thread-target"],
        title: "Direct task",
        bodyMarkdown: "Direct body.",
      },
    },
  });
  assert.equal(denied.error.message, "direct_task_card_delegation_disabled");

  const calls = [];
  const enabled = makeMcp({
    allowDirectTaskCards: true,
    delegateTaskCard: async (input) => {
      calls.push(input);
      return {
        ok: true,
        sourceThreadId: input.sourceThreadId,
        direct: true,
        autoApprove: true,
        cards: [{
          id: "ttc-direct",
          status: "approved",
          injectedTurnId: "turn-direct",
          source: { threadId: input.sourceThreadId, title: "Source" },
          target: { threadId: input.targetThreadIds[0] },
          message: { title: input.title, summary: "" },
          delivery: { approvalMode: "source_thread_direct", targetApprovalBypassed: true },
        }],
      };
    },
  });
  const approved = await enabled.service.handleJsonRpc({
    jsonrpc: "2.0",
    id: 10,
    method: "tools/call",
    params: {
      name: "delegate_to_codex_thread",
      arguments: {
        mode: "direct",
        sourceThreadId: "thread-source",
        targetThreadIds: ["thread-target"],
        title: "Direct task",
        bodyMarkdown: "Direct body.",
      },
    },
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].pending, false);
  assert.equal(calls[0].autoApprove, true);
  assert.equal(calls[0].direct, true);
  assert.equal(approved.result.structuredContent.direct, true);
  assert.equal(approved.result.structuredContent.card.status, "approved");
  assert.equal(approved.result.structuredContent.card.injectedTurnId, "turn-direct");
  assert.equal(approved.result.structuredContent.card.delivery.targetApprovalBypassed, true);
});

test("ChatGPT Pro MCP unknown tools fail as JSON-RPC errors", async () => {
  const { service } = makeMcp();
  const result = await service.handleJsonRpc({
    jsonrpc: "2.0",
    id: 6,
    method: "tools/call",
    params: { name: "shell_exec", arguments: {} },
  });
  assert.equal(result.error.message, "unknown_tool");
});
