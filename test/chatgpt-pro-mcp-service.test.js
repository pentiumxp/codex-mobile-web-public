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

function makeMcp() {
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
