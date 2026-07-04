"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  createLoopTaskRuntimeService,
} = require("../services/at-loop/loop-task-runtime-service");

function tempStateFile(name) {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "codex-at-loop-")), `${name}.json`);
}

function stableHash(value, length = 16) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, length);
}

function testLoopId({ sourceThreadId, targetThreadId, objective, targetAlias = "", domainAdapter = "generic" }) {
  const seed = [
    "at-loop-v1",
    sourceThreadId,
    targetThreadId,
    targetAlias,
    domainAdapter,
    stableHash(objective, 32),
  ].join("|");
  return `loop_${stableHash(seed, 16)}`;
}

function makeRuntime(options = {}) {
  const cards = [];
  const createdThreads = [];
  let now = options.now || Date.parse("2026-07-03T00:00:00.000Z");
  const storageFile = tempStateFile(options.name || "state");
  const visibleThreads = options.visibleThreads || [
    {
      id: "source-thread",
      title: "codex mobile 06-30",
      cwd: "/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web",
    },
    {
      id: "implementation-thread",
      title: "codex mobile implementation",
      cwd: "/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web",
      threadRole: "implementation",
    },
    {
      id: "audit-thread",
      title: "Plugin Workspace Audit",
      cwd: "/Users/hermes-dev/HermesMobileDev/app",
    },
    {
      id: "deploy-thread",
      title: "Home AI Deploy",
      cwd: "/Users/hermes-dev/HermesMobileDev/app",
    },
  ];
  const dependencies = {
    storageFile,
    visibleThreads,
    clock: () => now,
    watchdogStaleMs: 1000,
    createThreadTaskCardsFromSourceThread: async (sourceThreadId, payload) => {
      if (typeof options.createThreadTaskCardsFromSourceThread === "function") {
        return options.createThreadTaskCardsFromSourceThread(sourceThreadId, payload, { cards });
      }
      if (sourceThreadId === payload.targetThreadId) {
        throw new Error("Target thread must be different from the source thread.");
      }
      cards.push({ sourceThreadId, payload });
      return { ok: true, cards: [{ id: `ttc_${cards.length}` }] };
    },
    isLoopImplementationWorkspace: options.isLoopImplementationWorkspace || (() => true),
  };
  if (options.assertThreadTaskCardTargetDeliverable !== false) {
    dependencies.assertThreadTaskCardTargetDeliverable = options.assertThreadTaskCardTargetDeliverable || (() => true);
  }
  if (options.resolveThreadTaskCardTargetReference !== false) {
    dependencies.resolveThreadTaskCardTargetReference = options.resolveThreadTaskCardTargetReference || ((threadId) => threadId);
  }
  if (options.createLoopRoleThread !== false) {
    dependencies.createLoopRoleThread = options.createLoopRoleThread || (async ({ role, cwd, title, threadRole }) => {
      const id = `${role}-created`;
      const thread = {
        id,
        title,
        cwd,
        threadRole,
      };
      createdThreads.push(thread);
      visibleThreads.push(thread);
      return thread;
    });
  }
  const runtime = createLoopTaskRuntimeService(dependencies);
  return {
    cards,
    createdThreads,
    runtime,
    storageFile,
    visibleThreads,
    setNow: (value) => {
      now = value;
    },
  };
}

test("loop runtime records source-thread requirements locally and dispatches implementation", async () => {
  const { cards, createdThreads, runtime } = makeRuntime({
    visibleThreads: [{
      id: "xcode-thread",
      title: "Xcode",
      cwd: "/Users/xuxin/Documents/Xcode-HomeAI",
    }],
  });
  const first = await runtime.startLoop({
    sourceThreadId: "xcode-thread",
    text: "@loop fix password=SECRET_VALUE token=abc123456789",
  });
  assert.equal(first.ok, true);
  assert.equal(first.duplicateSuppressed, false);
  assert.equal(first.loop.status, "running");
  assert.equal(first.loop.currentRole, "implementation");
  assert.equal(first.loop.requirementsThreadId, "xcode-thread");
  assert.equal(first.loop.implementationThreadId, "implementation-created");
  assert.equal(first.loop.auditThreadId, "product_audit-created");
  assert.equal(first.loop.requirementsLocal, true);
  assert.deepEqual(first.loop.auditPacketStatus.presentSections, ["requirements_packet"]);
  assert.ok(first.loop.auditPacketStatus.missingSections.includes("implementation_packet"));
  assert.equal(createdThreads.length, 2);
  assert.equal(cards.length, 1);
  const requirements = first.loop.roleSlices.find((slice) => slice.role === "requirements");
  assert.equal(requirements.status, "local");
  assert.equal(requirements.dispatchStatus, "source_thread_local_role");
  assert.equal(requirements.dispatchMode, "source_thread_local_role");
  assert.equal(requirements.taskCardDispatch, false);
  assert.equal(requirements.targetThreadId, "xcode-thread");
  assert.equal(requirements.taskCardId, "");
  const implementation = first.loop.roleSlices.find((slice) => slice.role === "implementation");
  assert.equal(implementation.status, "dispatched");
  assert.equal(implementation.targetThreadId, "implementation-created");
  const audit = first.loop.roleSlices.find((slice) => slice.role === "product_audit");
  assert.equal(audit.status, "pending");
  assert.equal(audit.targetThreadId, "product_audit-created");
  assert.equal(cards[0].payload.cardKind, "at_loop_role_slice");
  assert.ok(cards[0].payload.title.length <= 120);
  assert.equal(cards[0].payload.sourceThreadId, "xcode-thread");
  assert.equal(cards[0].payload.targetThreadId, "implementation-created");
  assert.notEqual(cards[0].payload.sourceThreadId, cards[0].payload.targetThreadId);
  assert.equal(cards[0].payload.sourceRole, "requirements");
  assert.equal(cards[0].payload.targetRole, "implementation");
  assert.equal(cards[0].payload.routeKind, "at_loop_role_slice");
  assert.equal(cards[0].payload.workflowId, `at-loop:${first.loop.loopId}`);
  assert.equal(cards[0].payload.routeResolution.code, "at_loop_role_slice");
  assert.equal(cards[0].payload.routeResolution.targetRole, "implementation");
  assert.match(cards[0].payload.idempotencyKey, /^at-loop:loop_[0-9a-f]{16}:implementation:1:v1$/);
  assert.doesNotMatch(JSON.stringify(first), /SECRET_VALUE|abc123456789/);
  assert.doesNotMatch(cards[0].payload.bodyMarkdown, /SECRET_VALUE|abc123456789/);

  const second = await runtime.startLoop({
    sourceThreadId: "xcode-thread",
    text: "@loop fix password=SECRET_VALUE token=abc123456789",
  });
  assert.equal(second.ok, true);
  assert.equal(second.duplicateSuppressed, true);
  assert.equal(second.loop.loopId, first.loop.loopId);
  assert.equal(second.loop.duplicateSuppressedCount, 1);
  assert.equal(cards.length, 1);
});

test("loop runtime blocks implementation lane creation when source workspace is not implementable", async () => {
  const { cards, createdThreads, runtime } = makeRuntime({
    visibleThreads: [{
      id: "xcode-thread",
      title: "Xcode",
      cwd: "/Users/xuxin/Documents/Xcode-HomeAI",
    }],
    isLoopImplementationWorkspace: () => ({
      ok: false,
      error: "implementation_workspace_project_markers_missing",
      cwd: "/Users/xuxin/Documents/Xcode-HomeAI",
    }),
  });

  const result = await runtime.startLoop({
    sourceThreadId: "xcode-thread",
    text: "@loop redesign settings",
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, "at_loop_implementation_workspace_unresolved");
  assert.equal(result.loop.status, "blocked");
  assert.equal(result.loop.currentRole, "requirements");
  assert.equal(result.loop.nextRoute, "implementation_workspace_unresolved");
  assert.equal(result.loop.requirementsLocal, true);
  const implementation = result.loop.roleSlices.find((slice) => slice.role === "implementation");
  assert.equal(implementation.status, "blocked");
  assert.equal(implementation.dispatchStatus, "failed");
  assert.equal(implementation.targetThreadId, "");
  assert.equal(implementation.routing.error, "at_loop_implementation_workspace_unresolved");
  assert.equal(cards.length, 0);
  assert.equal(createdThreads.length, 0);
});

test("loop runtime treats plugin and Home AI main threads as local requirements owners", async () => {
  for (const source of [
    {
      id: "plugin-main",
      title: "codex mobile 06-30",
      cwd: "/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web",
    },
    {
      id: "home-ai-main",
      title: "Home AI 06-22",
      cwd: "/Users/hermes-dev/HermesMobileDev/app",
    },
  ]) {
    const { cards, runtime } = makeRuntime({
      name: source.id,
      visibleThreads: [source],
    });
    const result = await runtime.startLoop({
      sourceThreadId: source.id,
      text: "@loop improve local product flow",
    });
    assert.equal(result.ok, true);
    assert.equal(result.loop.requirementsThreadId, source.id);
    assert.equal(result.loop.requirementsLocal, true);
    assert.equal(result.loop.roleSlices.find((slice) => slice.role === "requirements").dispatchMode, "source_thread_local_role");
    assert.equal(cards.length, 1);
    assert.notEqual(cards[0].payload.sourceThreadId, cards[0].payload.targetThreadId);
  }
});

test("loop runtime fails closed when source thread is a Public PR lane", async () => {
  const { cards, runtime } = makeRuntime({
    visibleThreads: [
      {
        id: "public-pr-thread",
        title: "Codex Mobile Public PR",
        cwd: "/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web",
      },
    ],
  });
  const result = await runtime.startLoop({
    sourceThreadId: "public-pr-thread",
    text: "@loop implement runtime",
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, "at_loop_target_purpose_mismatch");
  assert.equal(result.loop.status, "blocked");
  assert.equal(result.loop.blockedReason, "at_loop_target_purpose_mismatch");
  assert.equal(cards.length, 0);
});

test("loop runtime correlates terminal returns and routes audit failure to repair", async () => {
  const { cards, runtime } = makeRuntime({ name: "terminal-routing" });
  const started = await runtime.startLoop({
    sourceThreadId: "source-thread",
    text: "@loop add status surface",
  });
  assert.equal(started.loop.currentRole, "implementation");
  assert.equal(cards.length, 1);

  const implementation = await runtime.recordTerminalReturn({
    taskCardId: "ttc_1",
    status: "completed",
    summary: "implementation done",
  });
  assert.equal(implementation.ok, true);
  assert.equal(implementation.loop.currentRole, "product_audit");
  assert.equal(cards.length, 2);
  assert.equal(cards[1].payload.targetThreadId, "audit-thread");
  assert.equal(cards[1].payload.targetRole, "product_audit");
  assert.match(cards[1].payload.bodyMarkdown, /## Audit Packet/);
  assert.match(cards[1].payload.bodyMarkdown, /## Delta Matrix/);
  assert.ok(cards[1].payload.missingAuditPacketSections.includes("design_contract_packet"));
  assert.ok(cards[1].payload.missingAuditPacketSections.includes("validation_packet"));
  assert.ok(cards[1].payload.auditPacket.sections.find((section) => section.id === "implementation_packet" && section.status === "present"));

  const audit = await runtime.recordTerminalReturn({
    taskCardId: "ttc_2",
    status: "completed",
    auditVerdict: "failed_implementation_bug",
    summary: "bug remains",
  });
  assert.equal(audit.ok, true);
  assert.equal(audit.loop.currentRole, "repair");
  assert.equal(audit.loop.lastAuditVerdict, "failed_implementation_bug");
  assert.equal(audit.loop.nextRoute, "repair");
  assert.equal(cards.length, 3);
  assert.equal(cards[2].payload.targetThreadId, "implementation-thread");
});

test("loop runtime routes blocked implementation returns back to local requirements revision", async () => {
  const { cards, runtime } = makeRuntime({ name: "implementation-blocked-requirements-revision" });
  const started = await runtime.startLoop({
    sourceThreadId: "source-thread",
    text: "@loop redesign settings",
  });
  assert.equal(started.loop.currentRole, "implementation");
  assert.equal(cards.length, 1);

  const returned = await runtime.recordTerminalReturn({
    taskCardId: "ttc_1",
    status: "blocked",
    summary: "target workspace is empty",
  });

  assert.equal(returned.ok, true);
  assert.equal(returned.loop.status, "blocked");
  assert.equal(returned.loop.currentRole, "requirements");
  assert.equal(returned.loop.nextRoute, "requirements_revision");
  assert.equal(cards.length, 1);
  const requirements = returned.loop.roleSlices.find((slice) => slice.role === "requirements");
  assert.equal(requirements.status, "blocked");
  assert.equal(requirements.dispatchStatus, "source_thread_local_role");
  assert.equal(requirements.blockedReason, "implementation_blocked_requires_requirements_revision");
  const implementation = returned.loop.roleSlices.find((slice) => slice.role === "implementation");
  assert.equal(implementation.status, "returned");
  assert.equal(implementation.returnStatus, "blocked");
  const audit = returned.loop.roleSlices.find((slice) => slice.role === "product_audit");
  assert.equal(audit.status, "pending");
  assert.equal(audit.taskCardId, "");
});

test("loop runtime propagates bounded audit packet and delta matrix to product audit card", async () => {
  const { cards, runtime } = makeRuntime({ name: "audit-packet" });
  const started = await runtime.startLoop({
    sourceThreadId: "source-thread",
    text: "@loop improve product journey",
    designContractPacket: {
      status: "present",
      summary: "Use Loop Engineering contract and module ownership.",
      actualEvidence: ["docs/ARCHITECTURE.md", "docs/COMPLEX_FEATURE_PATHS.md"],
    },
    auditPacket: {
      deltaMatrix: {
        intent_vs_requirements: { status: "unchecked", summary: "Compare owner request to local requirements." },
      },
    },
  });
  assert.equal(started.ok, true);
  assert.equal(cards.length, 1);

  const implementation = await runtime.recordTerminalReturn({
    taskCardId: "ttc_1",
    status: "completed",
    summary: "implemented without secret SECRET_VALUE",
    changedFiles: ["services/at-loop/loop-task-runtime-service.js"],
    tests: ["node --test test/loop-task-runtime.test.js"],
    validationSummary: "focused loop runtime tests passed",
    privacyConfirmation: "no raw secrets or private thread bodies included",
  });
  assert.equal(implementation.ok, true);
  assert.equal(cards.length, 2);
  const auditPayload = cards[1].payload;
  assert.equal(auditPayload.targetRole, "product_audit");
  assert.deepEqual(auditPayload.missingAuditPacketSections, []);
  assert.deepEqual(auditPayload.deltaMatrix.map((entry) => entry.id), [
    "intent_vs_requirements",
    "requirements_vs_design",
    "design_vs_implementation",
    "implementation_vs_validation",
    "user_journey_vs_acceptance",
    "privacy_boundary_vs_evidence",
  ]);
  assert.equal(auditPayload.auditPacket.status.complete, true);
  assert.match(auditPayload.bodyMarkdown, /requirements_packet/);
  assert.match(auditPayload.bodyMarkdown, /privacy_boundary_vs_evidence/);
  assert.doesNotMatch(JSON.stringify(auditPayload), /SECRET_VALUE/);
  assert.doesNotMatch(auditPayload.bodyMarkdown, /\.agent-context\/HANDOFF\.md as audit context/);

  const status = runtime.status({ loopId: implementation.loop.loopId });
  assert.equal(status.loops[0].auditPacketStatus.complete, true);
  const auditSlice = status.loops[0].roleSlices.find((slice) => slice.role === "product_audit");
  assert.equal(auditSlice.auditPacketStatus.complete, true);
});

test("loop runtime fails closed when required product-audit lane is missing", async () => {
  const { cards, runtime } = makeRuntime({
    name: "missing-audit",
    visibleThreads: [{
      id: "source-thread",
      title: "codex mobile 06-30",
      cwd: "/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web",
    }, {
      id: "implementation-thread",
      title: "codex mobile implementation",
      cwd: "/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web",
      threadRole: "implementation",
    }],
    createLoopRoleThread: false,
  });
  const result = await runtime.startLoop({ sourceThreadId: "source-thread", text: "@loop implement work" });
  assert.equal(result.ok, false);
  assert.equal(result.error, "at_loop_missing_role_lane");
  assert.equal(result.loop.status, "blocked");
  assert.equal(result.loop.blockedReason, "at_loop_missing_role_lane");
  assert.equal(cards.length, 0);
  assert.equal(result.loop.roleSlices.find((slice) => slice.role === "implementation").targetThreadId, "implementation-thread");
  assert.equal(result.loop.roleSlices.find((slice) => slice.role === "product_audit").status, "blocked");
});

test("loop runtime does not report blocked duplicate triggers as successful no-ops", async () => {
  const { cards, runtime } = makeRuntime({
    name: "blocked-duplicate",
    visibleThreads: [{
      id: "source-thread",
      title: "codex mobile 06-30",
      cwd: "/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web",
    }],
    createLoopRoleThread: false,
  });
  const first = await runtime.startLoop({ sourceThreadId: "source-thread", text: "@loop implement work" });
  assert.equal(first.ok, false);
  assert.equal(first.error, "at_loop_missing_role_lane");
  const second = await runtime.startLoop({ sourceThreadId: "source-thread", text: "@loop implement work" });
  assert.equal(second.ok, false);
  assert.equal(second.error, "at_loop_missing_role_lane");
  assert.notEqual(second.duplicateSuppressed, true);
  assert.equal(second.loop.duplicateSuppressedCount, 1);
  assert.equal(cards.length, 0);
});

test("loop runtime recovers blocked duplicate by dropping stale or ineligible role lane target", async () => {
  const { cards, runtime, storageFile } = makeRuntime({
    name: "blocked-stale-target-recovery",
    visibleThreads: [{
      id: "source-thread",
      title: "codex mobile 06-30",
      cwd: "/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web",
    }, {
      id: "stale-implementation-thread",
      title: "Home AI Worker Lane A",
      cwd: "/Users/hermes-dev/HermesMobileDev/app",
      status: { type: "completed" },
    }, {
      id: "implementation-thread",
      title: "codex mobile implementation",
      cwd: "/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web",
      threadRole: "implementation",
    }, {
      id: "audit-thread",
      title: "Plugin Workspace Audit",
      cwd: "/Users/hermes-dev/HermesMobileDev/app",
    }],
    createLoopRoleThread: false,
  });
  const loopId = testLoopId({
    sourceThreadId: "source-thread",
    targetThreadId: "source-thread",
    objective: "recover stale lane",
  });
  const state = { version: 1, loops: [{
    loopId,
    sourceThreadId: "source-thread",
    targetThreadId: "stale-implementation-thread",
    requirementsThreadId: "source-thread",
    implementationThreadId: "stale-implementation-thread",
    auditThreadId: "audit-thread",
    targetAlias: "",
    domainAdapter: "generic",
    objectiveHash: "hash",
    objectiveSummary: "recover stale lane",
    status: "blocked",
    currentRole: "requirements",
    iteration: 1,
    maxIterations: 3,
    deployReadbackRequired: false,
    duplicateSuppressedCount: 0,
    lastAuditVerdict: "",
    nextRoute: "implementation",
    blockedReason: "at_loop_dispatch_failed",
    sourceRequestId: `at-loop:${loopId}:source`,
    requirementsLocal: true,
    auditPacket: {},
    createdAt: "2026-07-03T00:00:00.000Z",
    updatedAt: "2026-07-03T00:00:00.000Z",
    roleSlices: [{
      role: "requirements",
      roleSliceId: `${loopId}:requirements:1`,
      iteration: 1,
      status: "local",
      dispatchStatus: "source_thread_local_role",
      dispatchMode: "source_thread_local_role",
      taskCardDispatch: false,
      taskCardId: "",
      targetThreadId: "source-thread",
      targetPurpose: "codex_mobile_implementation",
      sourceRequestId: "",
      workflowId: "",
      roleOwnerThreadId: "source-thread",
      roleThreadCreated: false,
      routing: null,
      createdAt: "2026-07-03T00:00:00.000Z",
      updatedAt: "2026-07-03T00:00:00.000Z",
    }, {
      role: "implementation",
      roleSliceId: `${loopId}:implementation:1`,
      iteration: 1,
      status: "blocked",
      dispatchStatus: "failed",
      taskCardId: "",
      targetThreadId: "stale-implementation-thread",
      targetPurpose: "worker_lane",
      sourceRequestId: "",
      workflowId: "",
      roleOwnerThreadId: "",
      roleThreadCreated: false,
      routing: null,
      blockedReason: "Target thread is not visible or is not a current deliverable thread.",
      createdAt: "2026-07-03T00:00:00.000Z",
      updatedAt: "2026-07-03T00:00:00.000Z",
    }, {
      role: "product_audit",
      roleSliceId: `${loopId}:product_audit:1`,
      iteration: 1,
      status: "pending",
      dispatchStatus: "",
      taskCardId: "",
      targetThreadId: "audit-thread",
      targetPurpose: "audit_lane",
      sourceRequestId: "",
      workflowId: "",
      roleOwnerThreadId: "",
      roleThreadCreated: false,
      routing: null,
      createdAt: "2026-07-03T00:00:00.000Z",
      updatedAt: "2026-07-03T00:00:00.000Z",
    }],
  }] };
  fs.writeFileSync(storageFile, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  const result = await runtime.startLoop({
    sourceThreadId: "source-thread",
    text: "@loop recover stale lane",
  });
  assert.equal(result.ok, true);
  assert.equal(result.recovered, true);
  assert.equal(result.loop.status, "running");
  assert.equal(result.loop.implementationThreadId, "implementation-thread");
  const implementation = result.loop.roleSlices.find((slice) => slice.role === "implementation");
  assert.equal(implementation.status, "dispatched");
  assert.equal(implementation.targetThreadId, "implementation-thread");
  assert.equal(cards.length, 1);
  assert.equal(cards[0].payload.targetThreadId, "implementation-thread");
});

test("loop runtime skips visible implementation targets rejected by task-card deliverability", async () => {
  const { cards, runtime, storageFile } = makeRuntime({
    name: "blocked-undeliverable-target-recovery",
    visibleThreads: [{
      id: "source-thread",
      title: "Xcode",
      cwd: "/Users/xuxin/Documents/Xcode-HomeAI",
    }, {
      id: "aaa-visible-but-hidden-target",
      title: "Xcode implementation",
      cwd: "/Users/xuxin/Documents/Xcode-HomeAI",
      threadRole: "implementation",
    }, {
      id: "zzz-implementation-thread",
      title: "Xcode implementation fallback",
      cwd: "/Users/xuxin/Documents/Xcode-HomeAI",
      threadRole: "implementation",
    }, {
      id: "audit-thread",
      title: "Plugin Workspace Audit",
      cwd: "/Users/hermes-dev/HermesMobileDev/app",
    }],
    createLoopRoleThread: false,
    resolveThreadTaskCardTargetReference: (threadId) => {
      if (threadId === "aaa-visible-but-hidden-target") {
        const err = new Error("Target thread is not visible or is not a current deliverable thread.");
        err.code = "target_thread_not_visible";
        err.statusCode = 404;
        throw err;
      }
      return String(threadId || "");
    },
  });
  const loopId = testLoopId({
    sourceThreadId: "source-thread",
    targetThreadId: "source-thread",
    objective: "recover undeliverable lane",
  });
  fs.writeFileSync(storageFile, `${JSON.stringify({ version: 1, loops: [{
    loopId,
    sourceThreadId: "source-thread",
    targetThreadId: "aaa-visible-but-hidden-target",
    requirementsThreadId: "source-thread",
    implementationThreadId: "aaa-visible-but-hidden-target",
    auditThreadId: "audit-thread",
    domainAdapter: "generic",
    objectiveSummary: "recover undeliverable lane",
    status: "blocked",
    currentRole: "requirements",
    iteration: 1,
    maxIterations: 3,
    nextRoute: "implementation",
    blockedReason: "at_loop_dispatch_failed",
    sourceRequestId: `at-loop:${loopId}:source`,
    requirementsLocal: true,
    auditPacket: {},
    createdAt: "2026-07-03T00:00:00.000Z",
    updatedAt: "2026-07-03T00:00:00.000Z",
    roleSlices: [{
      role: "requirements",
      roleSliceId: `${loopId}:requirements:1`,
      iteration: 1,
      status: "local",
      dispatchStatus: "source_thread_local_role",
      dispatchMode: "source_thread_local_role",
      taskCardDispatch: false,
      taskCardId: "",
      targetThreadId: "source-thread",
      targetPurpose: "workspace_implementation",
      roleOwnerThreadId: "source-thread",
      roleThreadCreated: false,
      routing: null,
      createdAt: "2026-07-03T00:00:00.000Z",
      updatedAt: "2026-07-03T00:00:00.000Z",
    }, {
      role: "implementation",
      roleSliceId: `${loopId}:implementation:1`,
      iteration: 1,
      status: "blocked",
      dispatchStatus: "failed",
      taskCardId: "",
      targetThreadId: "aaa-visible-but-hidden-target",
      targetPurpose: "workspace_implementation",
      roleThreadCreated: false,
      routing: null,
      blockedReason: "Target thread is not visible or is not a current deliverable thread.",
      createdAt: "2026-07-03T00:00:00.000Z",
      updatedAt: "2026-07-03T00:00:00.000Z",
    }, {
      role: "product_audit",
      roleSliceId: `${loopId}:product_audit:1`,
      iteration: 1,
      status: "pending",
      dispatchStatus: "",
      taskCardId: "",
      targetThreadId: "audit-thread",
      targetPurpose: "audit_lane",
      roleThreadCreated: false,
      routing: null,
      createdAt: "2026-07-03T00:00:00.000Z",
      updatedAt: "2026-07-03T00:00:00.000Z",
    }],
  }] }, null, 2)}\n`, "utf8");

  const result = await runtime.startLoop({
    sourceThreadId: "source-thread",
    text: "@loop recover undeliverable lane",
  });
  assert.equal(result.ok, true);
  assert.equal(result.recovered, true);
  assert.equal(result.loop.implementationThreadId, "zzz-implementation-thread");
  const implementation = result.loop.roleSlices.find((slice) => slice.role === "implementation");
  assert.equal(implementation.status, "dispatched");
  assert.equal(implementation.targetThreadId, "zzz-implementation-thread");
  assert.equal(cards.length, 1);
  assert.equal(cards[0].payload.targetThreadId, "zzz-implementation-thread");
});

test("loop runtime retries with a fresh target when task-card dispatch rejects a stale target", async () => {
  const dispatchAttempts = [];
  const { cards, createdThreads, runtime, storageFile } = makeRuntime({
    name: "dispatch-layer-stale-target-retry",
    visibleThreads: [{
      id: "source-thread",
      title: "Xcode",
      cwd: "/Users/xuxin/Documents/Xcode-HomeAI",
    }, {
      id: "stale-created-thread",
      title: "Xcode Loop Implementation: redesign settings",
      cwd: "/Users/xuxin/Documents/Xcode-HomeAI",
      threadRole: "implementation",
      status: { type: "notLoaded" },
    }, {
      id: "audit-thread",
      title: "Plugin Workspace Audit",
      cwd: "/Users/hermes-dev/HermesMobileDev/app",
    }],
    createThreadTaskCardsFromSourceThread: async (sourceThreadId, payload, context) => {
      dispatchAttempts.push(payload.targetThreadId);
      if (payload.targetThreadId === "stale-created-thread") {
        const err = new Error("Target thread is not visible or is not a current deliverable thread.");
        err.code = "target_thread_not_visible";
        err.statusCode = 400;
        throw err;
      }
      context.cards.push({ sourceThreadId, payload });
      return { ok: true, cards: [{ id: `ttc_${context.cards.length}` }] };
    },
  });
  const loopId = testLoopId({
    sourceThreadId: "source-thread",
    targetThreadId: "source-thread",
    objective: "recover stale dispatch target",
  });
  fs.writeFileSync(storageFile, `${JSON.stringify({ version: 1, loops: [{
    loopId,
    sourceThreadId: "source-thread",
    targetThreadId: "stale-created-thread",
    requirementsThreadId: "source-thread",
    implementationThreadId: "stale-created-thread",
    auditThreadId: "audit-thread",
    domainAdapter: "generic",
    objectiveSummary: "recover stale dispatch target",
    status: "blocked",
    currentRole: "requirements",
    iteration: 1,
    maxIterations: 3,
    nextRoute: "implementation",
    blockedReason: "at_loop_dispatch_failed",
    sourceRequestId: `at-loop:${loopId}:source`,
    requirementsLocal: true,
    auditPacket: {},
    createdAt: "2026-07-03T00:00:00.000Z",
    updatedAt: "2026-07-03T00:00:00.000Z",
    roleSlices: [{
      role: "requirements",
      roleSliceId: `${loopId}:requirements:1`,
      iteration: 1,
      status: "local",
      dispatchStatus: "source_thread_local_role",
      dispatchMode: "source_thread_local_role",
      taskCardDispatch: false,
      taskCardId: "",
      targetThreadId: "source-thread",
      targetPurpose: "workspace_implementation",
      roleOwnerThreadId: "source-thread",
      roleThreadCreated: false,
      routing: null,
      createdAt: "2026-07-03T00:00:00.000Z",
      updatedAt: "2026-07-03T00:00:00.000Z",
    }, {
      role: "implementation",
      roleSliceId: `${loopId}:implementation:1`,
      iteration: 1,
      status: "blocked",
      dispatchStatus: "failed",
      taskCardId: "",
      targetThreadId: "stale-created-thread",
      targetPurpose: "workspace_implementation",
      roleThreadCreated: true,
      routing: null,
      blockedReason: "Target thread is not visible or is not a current deliverable thread.",
      createdAt: "2026-07-03T00:00:00.000Z",
      updatedAt: "2026-07-03T00:00:00.000Z",
    }, {
      role: "product_audit",
      roleSliceId: `${loopId}:product_audit:1`,
      iteration: 1,
      status: "pending",
      dispatchStatus: "",
      taskCardId: "",
      targetThreadId: "audit-thread",
      targetPurpose: "audit_lane",
      roleThreadCreated: false,
      routing: null,
      createdAt: "2026-07-03T00:00:00.000Z",
      updatedAt: "2026-07-03T00:00:00.000Z",
    }],
  }] }, null, 2)}\n`, "utf8");

  const result = await runtime.startLoop({
    sourceThreadId: "source-thread",
    text: "@loop recover stale dispatch target",
  });

  assert.equal(result.ok, true);
  assert.equal(result.recovered, true);
  assert.deepEqual(dispatchAttempts, ["stale-created-thread", "implementation-created"]);
  assert.equal(result.loop.implementationThreadId, "implementation-created");
  const implementation = result.loop.roleSlices.find((slice) => slice.role === "implementation");
  assert.equal(implementation.status, "dispatched");
  assert.equal(implementation.targetThreadId, "implementation-created");
  assert.equal(implementation.blockedReason, "");
  assert.equal(cards.length, 1);
  assert.equal(cards[0].payload.targetThreadId, "implementation-created");
  assert.equal(createdThreads.length, 1);
  assert.equal(createdThreads[0].id, "implementation-created");
});

test("loop runtime creates implementation lane instead of selecting ordinary completed workspace thread", async () => {
  const { cards, createdThreads, runtime } = makeRuntime({
    name: "ordinary-thread-not-implementation-lane",
    visibleThreads: [{
      id: "xcode-thread",
      title: "Xcode",
      cwd: "/Users/xuxin/Documents/Xcode-HomeAI",
    }, {
      id: "growth-main-thread",
      title: "成长 06-18",
      cwd: "/Users/hermes-dev/HermesMobileDev/plugins/growth",
      status: { type: "completed" },
    }, {
      id: "audit-thread",
      title: "Plugin Workspace Audit",
      cwd: "/Users/hermes-dev/HermesMobileDev/app",
    }],
  });

  const result = await runtime.startLoop({
    sourceThreadId: "xcode-thread",
    text: "@loop redesign settings",
  });

  assert.equal(result.ok, true);
  assert.equal(result.loop.implementationThreadId, "implementation-created");
  assert.equal(createdThreads.find((thread) => thread.id === "implementation-created").threadRole, "implementation");
  assert.equal(cards.length, 1);
  assert.equal(cards[0].payload.targetThreadId, "implementation-created");
  assert.notEqual(cards[0].payload.targetThreadId, "growth-main-thread");
});

test("loop watchdog marks stale returns without retrying or completing work", async () => {
  const initial = Date.parse("2026-07-03T01:00:00.000Z");
  const { cards, runtime, setNow } = makeRuntime({ name: "watchdog", now: initial });
  const started = await runtime.startLoop({ sourceThreadId: "source-thread", text: "@loop wait for card" });
  assert.equal(started.loop.currentRole, "implementation");
  setNow(initial + 2000);
  const watchdog = runtime.runWatchdog({ loopId: started.loop.loopId });
  assert.equal(watchdog.ok, true);
  assert.equal(watchdog.staleCount, 1);
  assert.equal(watchdog.retried, false);
  assert.equal(watchdog.completed, false);
  assert.equal(watchdog.rejected, false);
  assert.equal(cards.length, 1);
  const status = runtime.status({ loopId: started.loop.loopId });
  const implementation = status.loops[0].roleSlices.find((slice) => slice.role === "implementation");
  assert.equal(implementation.stale, true);
  assert.equal(implementation.dispatchStatus, "return_stale");
});
