"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  createMessageParser,
  delegateToThread,
  encodeMessage,
  handleMessage,
  listThreads,
  returnToSource,
  toolsList,
} = require("../scripts/codex-mobile-mcp-server");
const {
  ensureCodexMobileMcpServerInConfig,
  hasMcpServerSection,
} = require("../adapters/codex-mobile-mcp-config-service");

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => resolve(body));
  });
}

test("Codex Mobile MCP server exposes delegation tools and parses stdio framing", async () => {
  const listedTools = toolsList();
  assert.deepEqual(listedTools.map((entry) => entry.name), ["list_threads", "delegate_to_thread", "return_to_source"]);
  assert.equal(listedTools.find((entry) => entry.name === "list_threads").annotations.readOnlyHint, true);
  assert.equal(listedTools.find((entry) => entry.name === "delegate_to_thread").annotations.destructiveHint, false);
  assert.equal(listedTools.find((entry) => entry.name === "return_to_source").annotations.idempotentHint, true);
  assert.ok(listedTools.find((entry) => entry.name === "delegate_to_thread").inputSchema.properties.pluginId);
  assert.ok(listedTools.find((entry) => entry.name === "delegate_to_thread").inputSchema.properties.replyToThreadId);
  const initialized = await handleMessage({ server: "http://127.0.0.1:1", key: "secret" }, { id: 1, method: "initialize" });
  assert.equal(initialized.serverInfo.name, "codex_mobile");
  assert.match(initialized.instructions, /delegate_to_thread/);
  assert.match(initialized.instructions, /return_to_source/);

  const parsed = [];
  const parser = createMessageParser((message) => parsed.push(message));
  parser(encodeMessage({ jsonrpc: "2.0", id: 2, method: "tools/list" }));
  const framed = Buffer.from(JSON.stringify({ jsonrpc: "2.0", id: 3, method: "ping" }), "utf8");
  parser(Buffer.concat([Buffer.from(`Content-Length: ${framed.length}\r\n\r\n`, "ascii"), framed]));
  assert.deepEqual(parsed.map((message) => message.id), [2, 3]);
  assert.equal(encodeMessage({ jsonrpc: "2.0", id: 4, result: {} }).toString("utf8").startsWith("Content-Length:"), false);
});

test("Codex Mobile MCP server calls existing authenticated task-card API", async (t) => {
  const calls = [];
  const server = http.createServer(async (req, res) => {
    calls.push({ method: req.method, url: req.url, authorization: req.headers.authorization || "" });
    if (req.method === "GET" && req.url.startsWith("/api/threads?")) {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({
        data: [
          { id: "thread-home", name: "Home AI", cwd: "/Users/hermes-dev/HermesMobileDev/app", status: { type: "idle" } },
        ],
      }));
      return;
    }
    if (req.method === "POST" && req.url === "/api/threads/source-1/task-cards") {
      const body = JSON.parse(await readBody(req));
      assert.equal(body.direct, true);
      assert.equal(body.autoApprove, true);
      assert.equal(body.pending, false);
      assert.equal(body.body, "body");
      assert.equal(body.reasoningEffort, "xhigh");
      assert.equal(body.pluginId, "codex-mobile-web");
      assert.equal(body.replyToThreadId, "thread-origin");
      assert.deepEqual(body.targetThreadIds, ["thread-home"]);
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({
        ok: true,
        sourceThreadId: "source-1",
        direct: true,
        workspaceDelegationEnabled: true,
        cards: [
          {
            id: "ttc_1",
            status: "approved",
            target: { threadId: "thread-home" },
            injectedTurnId: "turn-1",
            delivery: { targetApprovalBypassed: true, reasoningEffort: "xhigh" },
            injectionRuntime: { reasoningEffort: "xhigh", requestedReasoningEffort: "xhigh" },
          },
        ],
      }));
      return;
    }
    if (req.method === "POST" && req.url === "/api/thread-task-cards/ttc_inbound/reply") {
      const body = JSON.parse(await readBody(req));
      assert.equal(body.threadId, "target-1");
      assert.equal(body.workflowId, "workflow-1");
      assert.equal(body.title, "Return: completed");
      assert.equal(body.summary, "completed");
      assert.equal(body.body, "done");
      assert.equal(body.returnToSource, true);
      assert.match(body.idempotencyKey, /^task-card-return:/);
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({
        ok: true,
        card: { id: "ttc_inbound", status: "replied" },
        returnResolution: {
          requestedActorThreadId: "target-1",
          resolvedActorThreadId: "target-1",
          expectedTargetThreadId: "target-1",
          workflowRecovered: true,
          actorThreadInferred: false,
          resolverVersion: "task-card-exact-routing-v1",
        },
        replyCard: {
          id: "ttc_return",
          status: "approved",
          source: { threadId: "target-1" },
          target: { threadId: "source-1" },
          injectedTurnId: "turn-return",
          terminal: true,
          requiresReturn: false,
          ackPolicy: "none",
          delivery: {
            returnToSource: true,
            returnStatus: "completed",
            terminal: true,
            requiresReturn: false,
            ackPolicy: "none",
          },
        },
      }));
      return;
    }
    res.statusCode = 404;
    res.end("{}");
  });
  t.after(() => server.close());
  const baseUrl = await listen(server);
  const context = { server: baseUrl, key: "secret" };

  const threads = await listThreads(context, { limit: 10 });
  assert.equal(threads.threads[0].id, "thread-home");
  assert.equal(threads.threads[0].cwd, "/Users/hermes-dev/HermesMobileDev/app");

  const delegated = await delegateToThread(context, {
    sourceThreadId: "source-1",
    targetThreadIds: ["thread-home"],
    title: "title",
    bodyMarkdown: "body",
    reasoningEffort: "xhigh",
    pluginId: "codex-mobile-web",
    replyToThreadId: "thread-origin",
  });
  assert.equal(delegated.cardCount, 1);
  assert.equal(delegated.cards[0].id, "ttc_1");
  assert.equal(delegated.cards[0].targetApprovalBypassed, true);
  assert.equal(delegated.cards[0].reasoningEffort, "xhigh");
  assert.equal(delegated.cards[0].runtimeReasoningEffort, "xhigh");

  const returned = await returnToSource(context, {
    taskCardId: "ttc_inbound",
    threadId: "target-1",
    workflowId: "workflow-1",
    status: "completed",
    title: "completed",
    bodyMarkdown: "done",
  });
  assert.equal(returned.status, "replied");
  assert.equal(returned.workflowRecovered, true);
  assert.equal(returned.actorThreadInferred, false);
  assert.equal(returned.expectedTargetThreadId, "target-1");
  assert.equal(returned.resolverVersion, "task-card-exact-routing-v1");
  assert.equal(returned.replyCard.id, "ttc_return");
  assert.equal(returned.replyCard.status, "approved");
  assert.equal(returned.replyCard.targetThreadId, "source-1");
  assert.equal(returned.replyCard.injectedTurnId, "turn-return");
  assert.equal(returned.replyCard.returnToSource, true);
  assert.equal(returned.replyCard.returnStatus, "completed");
  assert.equal(returned.replyCard.terminal, true);
  assert.equal(returned.replyCard.requiresReturn, false);
  assert.equal(returned.replyCard.ackPolicy, "none");
  assert.ok(calls.every((call) => call.authorization === "Bearer secret"));
});

test("Codex Mobile MCP config registration is per Codex Home and stores no raw key", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-mcp-config-"));
  const configPath = path.join(dir, "config.toml");
  const result = ensureCodexMobileMcpServerInConfig(configPath, {
    command: "/node",
    scriptPath: "/repo/scripts/codex-mobile-mcp-server.js",
    baseUrl: "http://127.0.0.1:8787",
    keyFile: "/runtime/access_key",
  });
  assert.equal(result.changed, true);
  const text = fs.readFileSync(configPath, "utf8");
  assert.equal(hasMcpServerSection(text), true);
  assert.match(text, /\[mcp_servers\.codex_mobile\]/);
  assert.match(text, /codex-mobile-mcp-server\.js/);
  assert.match(text, /"--key-file"/);
  assert.match(text, /"\/runtime\/access_key"/);
  assert.match(text, /\[mcp_servers\.codex_mobile\.tools\.list_threads\]/);
  assert.match(text, /\[mcp_servers\.codex_mobile\.tools\.delegate_to_thread\]/);
  assert.match(text, /\[mcp_servers\.codex_mobile\.tools\.return_to_source\]/);
  assert.equal((text.match(/approval_mode = "approve"/g) || []).length, 3);
  assert.doesNotMatch(text, /Bearer/);
  assert.doesNotMatch(text, /secret/);

  const second = ensureCodexMobileMcpServerInConfig(configPath, {
    command: "/node",
    scriptPath: "/repo/scripts/codex-mobile-mcp-server.js",
    baseUrl: "http://127.0.0.1:8787",
    keyFile: "/runtime/access_key",
  });
  assert.equal(second.changed, false);
});

test("Codex Mobile MCP config registration repairs stale command args", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-mcp-stale-"));
  const configPath = path.join(dir, "config.toml");
  fs.writeFileSync(configPath, [
    "[mcp_servers.codex_mobile]",
    "command = \"/old-node\"",
    "args = [\"/old/script.js\"]",
    "",
    "[mcp_servers.codex_mobile.tools.list_threads]",
    "approval_mode = \"manual\"",
    "",
    "[mcp_servers.codegraph]",
    "command = \"codegraph\"",
    "",
  ].join("\n"), "utf8");

  const result = ensureCodexMobileMcpServerInConfig(configPath, {
    command: "/new-node",
    scriptPath: "/new/codex-mobile-mcp-server.js",
    baseUrl: "http://127.0.0.1:8787",
    keyFile: "/runtime/access_key",
  });
  assert.equal(result.changed, true);
  assert.equal(result.added, false);
  const text = fs.readFileSync(configPath, "utf8");
  assert.match(text, /command = "\/new-node"/);
  assert.match(text, /\/new\/codex-mobile-mcp-server\.js/);
  assert.doesNotMatch(text, /old-node|\/old\/script|manual/);
  assert.equal((text.match(/\[mcp_servers\.codex_mobile\.tools\.list_threads\]/g) || []).length, 1);
  assert.equal((text.match(/\[mcp_servers\.codex_mobile\.tools\.delegate_to_thread\]/g) || []).length, 1);
  assert.equal((text.match(/\[mcp_servers\.codex_mobile\.tools\.return_to_source\]/g) || []).length, 1);
  assert.equal((text.match(/approval_mode = "approve"/g) || []).length, 3);
  assert.match(text, /\[mcp_servers\.codegraph\]/);
});
