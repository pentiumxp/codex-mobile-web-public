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
  loopStatus,
  returnToSource,
  startLoop,
  taskCardHeartbeat,
  threadLifecycle,
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
  assert.deepEqual(listedTools.map((entry) => entry.name), ["list_threads", "delegate_to_thread", "start_loop", "loop_status", "thread_lifecycle", "return_to_source", "task_card_heartbeat"]);
  assert.equal(listedTools.find((entry) => entry.name === "list_threads").annotations.readOnlyHint, true);
  assert.equal(listedTools.find((entry) => entry.name === "delegate_to_thread").annotations.destructiveHint, false);
  assert.equal(listedTools.find((entry) => entry.name === "loop_status").annotations.readOnlyHint, true);
  assert.equal(listedTools.find((entry) => entry.name === "thread_lifecycle").annotations.idempotentHint, true);
  assert.equal(listedTools.find((entry) => entry.name === "return_to_source").annotations.idempotentHint, true);
  assert.equal(listedTools.find((entry) => entry.name === "task_card_heartbeat").annotations.idempotentHint, true);
  assert.ok(listedTools.find((entry) => entry.name === "delegate_to_thread").inputSchema.properties.sourceWorkspaceId);
  assert.ok(listedTools.find((entry) => entry.name === "delegate_to_thread").inputSchema.properties.pluginId);
  assert.ok(listedTools.find((entry) => entry.name === "delegate_to_thread").inputSchema.properties.replyToThreadId);
  assert.ok(listedTools.find((entry) => entry.name === "delegate_to_thread").inputSchema.properties.secretRef);
  assert.ok(listedTools.find((entry) => entry.name === "start_loop").inputSchema.properties.deployReadbackRequired);
  assert.ok(listedTools.find((entry) => entry.name === "start_loop").inputSchema.properties.auditPacket);
  const lifecycleSchema = listedTools.find((entry) => entry.name === "thread_lifecycle").inputSchema;
  assert.ok(lifecycleSchema.properties.role);
  assert.ok(lifecycleSchema.properties.pluginId);
  assert.ok(lifecycleSchema.properties.workerPurpose);
  assert.ok(lifecycleSchema.properties.sourceThreadId);
  assert.ok(lifecycleSchema.properties.workerLaneId);
  assert.ok(lifecycleSchema.properties.action.enum.includes("retire"));
  assert.ok(lifecycleSchema.properties.action.enum.includes("heartbeat"));
  assert.ok(lifecycleSchema.properties.action.enum.includes("mark_completed"));
  const returnSchema = listedTools.find((entry) => entry.name === "return_to_source").inputSchema;
  assert.ok(returnSchema.properties.threadId);
  assert.ok(!returnSchema.required.includes("threadId"));
  assert.ok(listedTools.find((entry) => entry.name === "task_card_heartbeat").inputSchema.properties.threadId);
  const initialized = await handleMessage({ server: "http://127.0.0.1:1", key: "secret" }, { id: 1, method: "initialize" });
  assert.equal(initialized.serverInfo.name, "codex_mobile");
  assert.match(initialized.instructions, /mcp__codex_mobile\.delegate_to_thread/);
  assert.match(initialized.instructions, /mcp__codex_mobile/);
  assert.match(initialized.instructions, /non-MCP namespace variants are unsupported/);
  assert.doesNotMatch(initialized.instructions, /(?<!mcp__)codex_mobile\.(delegate_to_thread|return_to_source|task_card_heartbeat)/);
  assert.match(initialized.instructions, /delegate_to_thread/);
  assert.match(initialized.instructions, /start_loop/);
  assert.match(initialized.instructions, /thread_lifecycle/);
  assert.match(initialized.instructions, /return_to_source/);
  assert.match(initialized.instructions, /task_card_heartbeat/);

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
      assert.equal(body.sourceWorkspaceId, "/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web");
      assert.equal(body.autoApprove, true);
      assert.equal(body.pending, false);
      assert.equal(body.body, "body");
      assert.equal(body.reasoningEffort, "xhigh");
      assert.equal(body.pluginId, "codex-mobile-web");
      assert.equal(body.replyToThreadId, "thread-origin");
      assert.equal(body.sensitiveContext.secretRefs[0].id, "sec_mcp1234567890");
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
            sensitiveContext: {
              secretRefs: [
                { id: "sec_mcp1...7890", targetPlugin: "codex", expiresInSeconds: 600, expiresInMinutes: 10 },
              ],
            },
          },
        ],
      }));
      return;
    }
    if (req.method === "POST" && (req.url === "/api/thread-task-cards/ttc_inbound/reply" || req.url === "/api/thread-task-cards/ttc_inbound_no_thread/reply")) {
      const noThread = req.url.includes("ttc_inbound_no_thread");
      const body = JSON.parse(await readBody(req));
      assert.equal(body.threadId || "", noThread ? "" : "target-1");
      assert.equal(body.workflowId || "", noThread ? "" : "workflow-1");
      assert.equal(body.title, "Return: completed");
      assert.equal(body.summary, "completed");
      assert.equal(body.body, "done");
      assert.equal(body.returnToSource, true);
      assert.match(body.idempotencyKey, /^task-card-return:/);
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({
        ok: true,
        card: { id: noThread ? "ttc_inbound_no_thread" : "ttc_inbound", status: "replied" },
        returnResolution: {
          requestedActorThreadId: noThread ? "" : "target-1",
          resolvedActorThreadId: "target-1",
          expectedTargetThreadId: "target-1",
          workflowRecovered: !noThread,
          actorThreadInferred: noThread,
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
    if (req.method === "POST" && req.url === "/api/thread-task-cards/ttc_inbound/execution/heartbeat") {
      const body = JSON.parse(await readBody(req));
      assert.equal(body.threadId, "target-1");
      assert.equal(body.actorThreadId, "target-1");
      assert.equal(body.status, "validating");
      assert.equal(body.source, "mcp-test");
      assert.equal(body.turnId, "turn-1");
      assert.equal(body.message, "bounded progress");
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({
        ok: true,
        taskCardId: "ttc_inbound",
        status: "validating",
        source: "mcp-test",
        heartbeatCount: 3,
        lastHeartbeatAt: "2026-07-04T09:45:00.000Z",
        resumeRequired: false,
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
    sourceWorkspaceId: "/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web",
    targetThreadIds: ["thread-home"],
    title: "title",
    bodyMarkdown: "body",
    reasoningEffort: "xhigh",
    pluginId: "codex-mobile-web",
    replyToThreadId: "thread-origin",
    secretRef: "sec_mcp1234567890",
  });
  assert.equal(delegated.cardCount, 1);
  assert.equal(delegated.cards[0].id, "ttc_1");
  assert.equal(delegated.cards[0].targetApprovalBypassed, true);
  assert.equal(delegated.cards[0].reasoningEffort, "xhigh");
  assert.equal(delegated.cards[0].runtimeReasoningEffort, "xhigh");
  assert.equal(delegated.cards[0].sensitiveContext.secretRefs[0].id, "sec_mcp1...7890");
  assert.doesNotMatch(JSON.stringify(delegated), /sec_mcp1234567890/);

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

  const inferredReturn = await returnToSource(context, {
    taskCardId: "ttc_inbound_no_thread",
    status: "completed",
    title: "completed",
    bodyMarkdown: "done",
  });
  assert.equal(inferredReturn.status, "replied");
  assert.equal(inferredReturn.threadId, "target-1");
  assert.equal(inferredReturn.requestedActorThreadId, "");
  assert.equal(inferredReturn.resolvedActorThreadId, "target-1");
  assert.equal(inferredReturn.actorThreadInferred, true);

  const heartbeat = await taskCardHeartbeat(context, {
    taskCardId: "ttc_inbound",
    threadId: "target-1",
    status: "validating",
    source: "mcp-test",
    turnId: "turn-1",
    message: "bounded progress",
  });
  assert.equal(heartbeat.ok, true);
  assert.equal(heartbeat.taskCardId, "ttc_inbound");
  assert.equal(heartbeat.threadId, "target-1");
  assert.equal(heartbeat.status, "validating");
  assert.equal(heartbeat.source, "mcp-test");
  assert.equal(heartbeat.heartbeatCount, 3);
  assert.equal(heartbeat.resumeRequired, false);
  assert.doesNotMatch(JSON.stringify(heartbeat), /secret|Bearer|body|prompt/i);
  assert.ok(calls.every((call) => call.authorization === "Bearer secret"));
});

test("Codex Mobile MCP server calls bounded at-loop API", async (t) => {
  const calls = [];
  const server = http.createServer(async (req, res) => {
    calls.push({ method: req.method, url: req.url, authorization: req.headers.authorization || "" });
    if (req.method === "POST" && req.url === "/api/at-loop/triggers") {
      const body = JSON.parse(await readBody(req));
      assert.equal(body.sourceThreadId, "source-1");
      assert.equal(body.text, "@home-ai @loop implement loop runtime");
      assert.equal(body.implementationWorkspaceCwd, "/Users/xuxin/Xcode/Home AI");
      assert.equal(body.deployReadbackRequired, true);
      assert.equal(body.auditPacket.sections.design_contract_packet.status, "present");
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({
        ok: true,
        duplicateSuppressed: false,
        loop: {
          loopId: "loop_1234",
          status: "running",
          currentRole: "requirements",
          nextRoute: "requirements",
          implementationWorkspaceCwd: "/Users/xuxin/Xcode/Home AI",
          waitingReturnCount: 1,
          duplicateSuppressedCount: 0,
          objectiveSummary: "implement loop runtime",
        },
      }));
      return;
    }
    if (req.method === "GET" && req.url === "/api/at-loop/status/loop_1234") {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({
        ok: true,
        loopCount: 1,
        loops: [{
          loopId: "loop_1234",
          status: "running",
          currentRole: "requirements",
          iteration: 1,
          maxIterations: 3,
          nextRoute: "requirements",
          implementationWorkspaceCwd: "/Users/xuxin/Xcode/Home AI",
          lastAuditVerdict: "",
          waitingReturnCount: 1,
          duplicateSuppressedCount: 0,
          roleSlices: [{
            roleSliceId: "loop_1234:requirements:1",
            role: "requirements",
            status: "dispatched",
            targetThreadId: "source-1",
            targetPurpose: "codex_mobile_implementation",
            taskCardId: "ttc_1",
            stale: false,
          }],
        }],
      }));
      return;
    }
    if (req.method === "POST" && req.url === "/api/at-loop/thread-lifecycle") {
      const body = JSON.parse(await readBody(req));
      assert.equal(body.action, "ensure");
      assert.equal(body.role, "plugin_worker");
      assert.equal(body.pluginId, "movie");
      assert.equal(body.sourceThreadId, "source-1");
      assert.equal(body.workerPurpose, "worker_lane");
      assert.equal(body.purpose, "worker_lane");
      assert.equal(body.idempotencyKey, "ensure-movie-plugin-worker-lane-v8-20260708");
      assert.equal(body.requestId, "movie-worker-v8");
      assert.equal(body.cwd, "/Users/hermes-dev/HermesMobileDev/Movie");
      assert.equal(body.workspaceCwd, "/Users/hermes-dev/HermesMobileDev/Movie");
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({
        ok: true,
        action: body.action,
        count: 1,
        threads: [{
          id: "implementation-thread",
          title: "Home AI Loop Implement",
          cwd: "/Users/hermes-dev/HermesMobileDev/app",
          role: body.role,
          purpose: "workspace_implementation",
          deliverable: true,
          status: "completed",
        }],
      }));
      return;
    }
    res.statusCode = 404;
    res.end("{}");
  });
  t.after(() => server.close());
  const context = { server: await listen(server), key: "secret" };
  const started = await startLoop(context, {
    sourceThreadId: "source-1",
    targetAlias: "home-ai",
    objective: "implement loop runtime",
    implementationWorkspaceCwd: "/Users/xuxin/Xcode/Home AI",
    deployReadbackRequired: true,
    auditPacket: {
      sections: {
        design_contract_packet: {
          status: "present",
          summary: "contract packet",
        },
      },
    },
  });
  assert.equal(started.ok, true);
  assert.equal(started.loop.loopId, "loop_1234");
  assert.equal(started.loop.implementationWorkspaceCwd, "/Users/xuxin/Xcode/Home AI");
  assert.equal(started.loop.waitingReturnCount, 1);

  const status = await loopStatus(context, { loopId: "loop_1234" });
  assert.equal(status.loopCount, 1);
  assert.equal(status.loops[0].implementationWorkspaceCwd, "/Users/xuxin/Xcode/Home AI");
  assert.equal(status.loops[0].roleSlices[0].taskCardId, "ttc_1");
  const lifecycle = await threadLifecycle(context, {
    action: "ensure",
    role: "plugin_worker",
    pluginId: "movie",
    sourceThreadId: "source-1",
    workerPurpose: "worker_lane",
    purpose: "worker_lane",
    idempotencyKey: "ensure-movie-plugin-worker-lane-v8-20260708",
    requestId: "movie-worker-v8",
    cwd: "/Users/hermes-dev/HermesMobileDev/Movie",
    workspaceCwd: "/Users/hermes-dev/HermesMobileDev/Movie",
  });
  assert.equal(lifecycle.ok, true);
  assert.equal(lifecycle.threads[0].status, "completed");
  assert.equal(lifecycle.threads[0].deliverable, true);
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
  assert.match(text, /\[mcp_servers\.codex_mobile\.tools\.start_loop\]/);
  assert.match(text, /\[mcp_servers\.codex_mobile\.tools\.loop_status\]/);
  assert.match(text, /\[mcp_servers\.codex_mobile\.tools\.thread_lifecycle\]/);
  assert.match(text, /\[mcp_servers\.codex_mobile\.tools\.return_to_source\]/);
  assert.match(text, /\[mcp_servers\.codex_mobile\.tools\.task_card_heartbeat\]/);
  assert.equal((text.match(/approval_mode = "approve"/g) || []).length, 7);
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
  assert.equal((text.match(/\[mcp_servers\.codex_mobile\.tools\.start_loop\]/g) || []).length, 1);
  assert.equal((text.match(/\[mcp_servers\.codex_mobile\.tools\.loop_status\]/g) || []).length, 1);
  assert.equal((text.match(/\[mcp_servers\.codex_mobile\.tools\.thread_lifecycle\]/g) || []).length, 1);
  assert.equal((text.match(/\[mcp_servers\.codex_mobile\.tools\.return_to_source\]/g) || []).length, 1);
  assert.equal((text.match(/\[mcp_servers\.codex_mobile\.tools\.task_card_heartbeat\]/g) || []).length, 1);
  assert.equal((text.match(/approval_mode = "approve"/g) || []).length, 7);
  assert.match(text, /\[mcp_servers\.codegraph\]/);
});
