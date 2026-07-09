"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  createRemoteManagedWorkspaceLocalExecutionService,
} = require("../services/remote-managed-workspaces/remote-managed-workspace-local-execution-service");

function makeProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rmw-local-exec-"));
  const projectRoot = path.join(root, "project");
  fs.mkdirSync(projectRoot, { recursive: true });
  fs.writeFileSync(path.join(projectRoot, "package.json"), "{\"private\":true}\n");
  return { root, projectRoot };
}

test("remote managed workspace local execution starts Codex thread, waits for completion, and returns bounded zh-CN metadata", async () => {
  const { root, projectRoot } = makeProject();
  const requests = [];
  const heartbeats = [];
  let pollCount = 0;
  let nowMs = Date.parse("2026-07-08T00:00:00.000Z");
  try {
    const service = createRemoteManagedWorkspaceLocalExecutionService({
      fs,
      path,
      codex: {
        request: async (method, params) => {
          requests.push({ method, params });
          if (method === "thread/start") return { threadId: "local-thread-1", thread: { id: "local-thread-1", cwd: params.cwd } };
          if (method === "turn/start") return { turnId: "local-turn-1" };
          if (method === "thread/turns/list") {
            pollCount += 1;
            return {
              turns: [{
                id: "local-turn-1",
                status: { type: pollCount >= 2 ? "completed" : "active" },
                completedAt: pollCount >= 2 ? "2026-07-08T00:00:01.000Z" : "",
              }],
            };
          }
          return { ok: true };
        },
      },
      applyPermissionModeOverride: (settings, approvalPolicy, cwd) => Object.assign({}, settings || {}, {
        approvalPolicy,
        cwd,
        sandboxPolicy: { type: "dangerFullAccess" },
      }),
      applyStartThreadRuntimeSettings: (params, settings) => Object.assign({}, params, {
        startReasoning: settings.reasoningEffort || "",
      }),
      applyTurnRuntimeSettings: (params, settings) => Object.assign({}, params, {
        effort: settings.reasoningEffort || "",
        approvalPolicy: settings.approvalPolicy || "",
      }),
      resolveThreadRuntimeSettings: async () => ({ reasoningEffort: "high" }),
      readStartThreadDeveloperInstructions: () => "AGENTS",
      notifyLocalTurnStarted: () => "local-turn-1",
      rememberStartedThread: () => true,
      persistThreadTitleToSessionIndex: () => true,
      tryUpdateThreadTitle: async () => true,
      completionPollIntervalMs: 10,
      completionTimeoutMs: 50,
      now: () => nowMs,
      sleep: async (ms) => {
        nowMs += ms;
      },
    });

    const terminal = await service.execute({
      taskCardId: "ttc_remote_local",
      idempotencyKey: "idem-local",
      title: "Implement bounded local task",
      summary: "bounded summary",
      bodyMarkdown: "Run the local project task.",
      reasoningEffort: "medium",
    }, {
      config: {
        workspaceId: "rmw_local",
        workspaceKind: "remote_managed_workspace",
        projectType: "vite_game",
        projectRoot,
        allowedRoots: [root],
        enrollmentToken: "secret-token-that-must-not-leak",
      },
      heartbeat: async (payload) => heartbeats.push(payload),
      onExecutionStarted: (execution) => heartbeats.push({ started: true, execution }),
    });

    assert.equal(terminal.status, "completed");
    assert.equal(terminal.summary, "local_task_card_execution_completed");
    assert.equal(terminal.metadata.localExecutionBridge, "codex_mobile_local_runtime");
    assert.equal(terminal.metadata.localThreadId, "local-thread-1");
    assert.equal(terminal.metadata.localTurnId, "local-turn-1");
    assert.equal(terminal.metadata.turnStatus, "completed");
    assert.equal(heartbeats.some((entry) => entry.started === true), true);
    assert.equal(heartbeats.some((entry) => entry.status === "working" && entry.localThreadId === "local-thread-1"), true);
    assert.equal(requests[0].method, "thread/start");
    assert.equal(requests[0].params.cwd, projectRoot);
    assert.equal(requests[0].params.startReasoning, "xhigh");
    assert.equal(requests[1].method, "turn/start");
    assert.equal(requests[1].params.threadId, "local-thread-1");
    assert.equal(requests[1].params.effort, "xhigh");
    assert.match(requests[1].params.input[0].text, /Implement bounded local task/);
    assert.doesNotMatch(JSON.stringify(terminal), /secret-token-that-must-not-leak/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("remote managed workspace local execution rejects project roots outside allowed root", async () => {
  const { root, projectRoot } = makeProject();
  const allowedRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rmw-local-allowed-"));
  try {
    const service = createRemoteManagedWorkspaceLocalExecutionService({
      fs,
      path,
      codex: { request: async () => ({ ok: true }) },
    });
    await assert.rejects(
      () => service.execute({ taskCardId: "ttc_outside" }, {
        config: {
          workspaceId: "rmw_local",
          workspaceKind: "remote_managed_workspace",
          projectType: "vite_game",
          projectRoot,
          allowedRoots: [allowedRoot],
          enrollmentToken: "secret-token",
        },
      }),
      /project_root_outside_allowed_root/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(allowedRoot, { recursive: true, force: true });
  }
});

test("remote managed workspace local execution treats completedAt as terminal evidence", async () => {
  const { root, projectRoot } = makeProject();
  try {
    const service = createRemoteManagedWorkspaceLocalExecutionService({
      fs,
      path,
      codex: {
        request: async (method) => {
          if (method === "thread/start") return { threadId: "local-thread-completed-at" };
          if (method === "turn/start") return { turnId: "local-turn-completed-at" };
          if (method === "thread/turns/list") return { turns: [{ id: "local-turn-completed-at", completedAt: "2026-07-08T00:00:02.000Z" }] };
          return { ok: true };
        },
      },
      notifyLocalTurnStarted: () => "local-turn-completed-at",
      completionPollIntervalMs: 10,
      completionTimeoutMs: 50,
    });

    const terminal = await service.execute({ taskCardId: "ttc_completed_at", title: "CompletedAt task" }, {
      config: {
        workspaceId: "rmw_local",
        workspaceKind: "remote_managed_workspace",
        projectType: "vite_game",
        projectRoot,
        allowedRoots: [root],
        enrollmentToken: "secret-token",
      },
    });

    assert.equal(terminal.status, "completed");
    assert.equal(terminal.metadata.completed, true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("remote managed workspace local execution returns partial terminal when local turn does not settle", async () => {
  const { root, projectRoot } = makeProject();
  let nowMs = Date.parse("2026-07-08T00:00:00.000Z");
  try {
    const service = createRemoteManagedWorkspaceLocalExecutionService({
      fs,
      path,
      codex: {
        request: async (method, params) => {
          if (method === "thread/start") return { threadId: "local-thread-timeout" };
          if (method === "turn/start") return { turnId: "local-turn-timeout" };
          if (method === "thread/turns/list") return { turns: [{ id: "local-turn-timeout", status: { type: "active" } }] };
          return { ok: true, params };
        },
      },
      notifyLocalTurnStarted: () => "local-turn-timeout",
      completionPollIntervalMs: 10,
      completionTimeoutMs: 15,
      now: () => nowMs,
      sleep: async (ms) => {
        nowMs += ms;
      },
    });

    const terminal = await service.execute({ taskCardId: "ttc_timeout", title: "Timeout task" }, {
      config: {
        workspaceId: "rmw_local",
        workspaceKind: "remote_managed_workspace",
        projectType: "vite_game",
        projectRoot,
        allowedRoots: [root],
        enrollmentToken: "secret-token",
      },
    });

    assert.equal(terminal.status, "partially_completed");
    assert.equal(terminal.summary, "local_task_card_execution_completion_timeout");
    assert.equal(terminal.metadata.completed, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
