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

function xcodeSettingsRepairPacketBody() {
  return [
    "No Swift source repair was required.",
    "",
    "## Implementation Packet",
    "",
    "- Settings implementation: `Home AI/ContentView.swift`",
    "- Settings groups verified: `账号连接`, `安全与通知`, `环境上下文`, `环境诊断`, `Apple Health`, `PWA 与本机数据`, `危险操作`",
    "- Reusable UI components verified: `SettingsSection`, `SettingsStatusBadge`, `SettingsInputBackground`, `SettingsFieldLabel`, `CapabilityRow`",
    "",
    "## Design Contract Packet",
    "",
    "- The page is organized by product intent rather than a flat capability list.",
    "- Native SwiftUI owns settings UI and iOS capability controls; Home AI Web owns PWA/plugin UI.",
    "- Access Key remains Keychain-backed and is not displayed as plaintext.",
    "",
    "## Validation Packet",
    "",
    "- `scripts/check-native-settings-layout.sh`: passed",
    "- `scripts/check-native-secure-clipboard-secret.sh`: passed",
    "- `scripts/check-apple-health-guardian-mode.sh`: passed",
    "- Xcode build not rerun in repair due known automation limitation.",
    "",
    "## Privacy Packet",
    "",
    "- Access Key remains Keychain-backed.",
    "- Secure clipboard upload remains explicit and button-triggered.",
    "- UI displays bounded `secretRef` / expiry metadata only, not clipboard contents.",
    "- WebKit PWA data clearing remains separate from native Server/Access Key clearing.",
    "- Added evidence to `.agent-context/HANDOFF.md`.",
  ].join("\n");
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
    listWorkspaces: options.listWorkspaces,
    isLoopImplementationWorkspace: options.isLoopImplementationWorkspace || (() => true),
    readThreadTaskCardForLoopEvidence: options.readThreadTaskCardForLoopEvidence,
    readContinuationLineageEntries: options.readContinuationLineageEntries,
    startSourceRequirementsTurn: options.startSourceRequirementsTurn,
    recordSourceRequirementsScriptPath: options.recordSourceRequirementsScriptPath || "/plugin/scripts/record-at-loop-requirements.js",
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

function sourceRequirementsPackets() {
  return {
    requirementsPacket: {
      status: "present",
      summary: "Bounded requirements packet from source thread.",
      actualEvidence: [
        "objective",
        "acceptance_criteria",
        "privacy_boundary",
      ],
    },
    designContractPacket: {
      status: "present",
      summary: "Bounded design contract packet from source thread.",
      actualEvidence: [
        "architecture_boundary",
        "routing_policy",
        "harness_requirements",
      ],
    },
  };
}

function withSourceRequirements(input = {}) {
  return Object.assign({}, sourceRequirementsPackets(), input);
}

async function startLoopWithSourceRequirements(runtime, input = {}) {
  return runtime.startLoop(withSourceRequirements(input));
}

async function recordSourceRequirements(runtime, loop, input = {}) {
  const requirements = loop.roleSlices.find((slice) => slice.role === "requirements");
  return runtime.recordTerminalReturn(Object.assign({
    loopId: loop.loopId,
    roleSliceId: requirements && requirements.roleSliceId,
    role: "requirements",
    status: "completed",
    summary: "source requirements complete",
    returnBody: [
      "## Requirements Packet",
      "- Objective and acceptance criteria are bounded.",
      "- Privacy boundary and risk gates are explicit.",
      "",
      "## Design Contract Packet",
      "- Architecture boundary, routing policy, and harness requirements are explicit.",
    ].join("\n"),
  }, input));
}

test("loop runtime waits for source-thread requirements before implementation dispatch", async () => {
  const sourceRequirementTurns = [];
  const { cards, createdThreads, runtime } = makeRuntime({
    visibleThreads: [{
      id: "xcode-thread",
      title: "Xcode",
      cwd: "/Users/xuxin/Documents/Xcode-HomeAI",
    }],
    startSourceRequirementsTurn: async (input) => {
      sourceRequirementTurns.push(input);
      return { turnId: `turn-${sourceRequirementTurns.length}` };
    },
  });
  const first = await runtime.startLoop({
    sourceThreadId: "xcode-thread",
    text: "@loop fix password=SECRET_VALUE token=abc123456789",
  });
  assert.equal(first.ok, true);
  assert.equal(first.duplicateSuppressed, false);
  assert.equal(first.loop.status, "waiting_source_requirements");
  assert.equal(first.loop.currentRole, "requirements");
  assert.equal(first.loop.nextRoute, "source_requirements_pending");
  assert.equal(first.loop.requirementsThreadId, "xcode-thread");
  assert.equal(first.loop.implementationThreadId, "");
  assert.equal(first.loop.auditThreadId, "");
  assert.equal(first.loop.requirementsLocal, true);
  assert.deepEqual(first.loop.auditPacketStatus.presentSections, []);
  assert.deepEqual(first.loop.sourceRequirementsStatus.missingSections, ["requirements_packet", "design_contract_packet"]);
  assert.equal(first.loop.sourceRequirementsStatus.localTurnStatus, "started");
  assert.equal(first.loop.sourceRequirementsStatus.localTurnId, "turn-1");
  assert.ok(first.loop.auditPacketStatus.missingSections.includes("implementation_packet"));
  assert.equal(createdThreads.length, 0);
  assert.equal(cards.length, 0);
  assert.equal(sourceRequirementTurns.length, 1);
  assert.equal(sourceRequirementTurns[0].loop.loopId, first.loop.loopId);
  assert.equal(sourceRequirementTurns[0].slice.role, "requirements");
  assert.equal(sourceRequirementTurns[0].sourceThread.id, "xcode-thread");
  assert.match(sourceRequirementTurns[0].prompt, /## Requirements Packet/);
  assert.match(sourceRequirementTurns[0].prompt, /## Design Contract Packet/);
  assert.match(sourceRequirementTurns[0].prompt, /record-at-loop-requirements\.js/);
  const requirements = first.loop.roleSlices.find((slice) => slice.role === "requirements");
  assert.equal(requirements.status, "waiting");
  assert.equal(requirements.dispatchStatus, "source_thread_local_role");
  assert.equal(requirements.dispatchMode, "source_thread_local_role");
  assert.equal(requirements.taskCardDispatch, false);
  assert.equal(requirements.targetThreadId, "xcode-thread");
  assert.equal(requirements.taskCardId, "");
  assert.equal(requirements.returnStatus, "");
  assert.equal(requirements.sourceRequirementsTurnStatus, "started");
  assert.equal(requirements.sourceRequirementsTurnId, "turn-1");

  const duplicatePending = await runtime.startLoop({
    sourceThreadId: "xcode-thread",
    text: "@loop fix password=SECRET_VALUE token=abc123456789",
  });
  assert.equal(duplicatePending.ok, true);
  assert.equal(duplicatePending.duplicateSuppressed, true);
  assert.equal(duplicatePending.loop.status, "waiting_source_requirements");
  assert.equal(duplicatePending.loop.currentRole, "requirements");
  assert.equal(duplicatePending.loop.sourceRequirementsStatus.pending, true);
  assert.equal(cards.length, 0);
  assert.equal(sourceRequirementTurns.length, 1);

  const afterRequirements = await recordSourceRequirements(runtime, first.loop);
  assert.equal(afterRequirements.ok, true);
  assert.equal(afterRequirements.loop.status, "running");
  assert.equal(afterRequirements.loop.currentRole, "implementation");
  assert.equal(afterRequirements.loop.implementationThreadId, "implementation-created");
  assert.equal(afterRequirements.loop.auditThreadId, "product_audit-created");
  assert.deepEqual(afterRequirements.loop.auditPacketStatus.presentSections, ["requirements_packet", "design_contract_packet"]);
  assert.equal(createdThreads.length, 2);
  assert.equal(cards.length, 1);
  const returnedRequirements = afterRequirements.loop.roleSlices.find((slice) => slice.role === "requirements");
  assert.equal(returnedRequirements.status, "returned");
  assert.equal(returnedRequirements.returnStatus, "completed");
  assert.equal(afterRequirements.loop.sourceRequirementsStatus.readyForImplementation, true);
  assert.equal(createdThreads.find((thread) => thread.id === "implementation-created").title, "Xcode Loop Implement");
  assert.equal(createdThreads.find((thread) => thread.id === "product_audit-created").title, "Xcode Loop Audit");
  const implementation = first.loop.roleSlices.find((slice) => slice.role === "implementation");
  assert.equal(implementation.status, "pending");
  const dispatchedImplementation = afterRequirements.loop.roleSlices.find((slice) => slice.role === "implementation");
  assert.equal(dispatchedImplementation.status, "dispatched");
  assert.equal(dispatchedImplementation.targetThreadId, "implementation-created");
  const audit = afterRequirements.loop.roleSlices.find((slice) => slice.role === "product_audit");
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
  assert.equal(cards[0].payload.workflowId, `at-loop:${afterRequirements.loop.loopId}`);
  assert.equal(cards[0].payload.routeResolution.code, "at_loop_role_slice");
  assert.equal(cards[0].payload.routeResolution.targetRole, "implementation");
  assert.match(cards[0].payload.idempotencyKey, /^at-loop:loop_[0-9a-f]{16}:implementation:1:[0-9a-f]{8}:v1$/);
  assert.doesNotMatch(JSON.stringify(afterRequirements), /SECRET_VALUE|abc123456789/);
  assert.doesNotMatch(cards[0].payload.bodyMarkdown, /SECRET_VALUE|abc123456789/);

  const second = await runtime.startLoop({
    sourceThreadId: "xcode-thread",
    text: "@loop fix password=SECRET_VALUE token=abc123456789",
  });
  assert.equal(second.ok, true);
  assert.equal(second.duplicateSuppressed, true);
  assert.equal(second.loop.loopId, first.loop.loopId);
  assert.equal(second.loop.duplicateSuppressedCount, 2);
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

  const result = await startLoopWithSourceRequirements(runtime, {
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

test("loop runtime uses explicit implementation workspace instead of source requirements cwd", async () => {
  const realWorkspace = "/Users/xuxin/Xcode/Home AI";
  const sourceWorkspace = "/Users/xuxin/Documents/Xcode-HomeAI";
  const { cards, createdThreads, runtime } = makeRuntime({
    name: "explicit-implementation-workspace",
    visibleThreads: [{
      id: "xcode-thread",
      title: "Xcode",
      cwd: sourceWorkspace,
    }],
    isLoopImplementationWorkspace: (cwd) => cwd === realWorkspace
      ? { ok: true, cwd, reason: "xcode_project_marker" }
      : { ok: false, error: "implementation_workspace_project_markers_missing", cwd },
  });

  const result = await startLoopWithSourceRequirements(runtime, {
    sourceThreadId: "xcode-thread",
    text: "@loop redesign settings",
    implementationWorkspaceCwd: realWorkspace,
  });

  assert.equal(result.ok, true);
  assert.equal(result.loop.requirementsThreadId, "xcode-thread");
  assert.equal(result.loop.requirementsLocal, true);
  assert.equal(result.loop.implementationWorkspaceCwd, realWorkspace);
  assert.equal(result.loop.implementationThreadId, "implementation-created");
  const implementationThread = createdThreads.find((thread) => thread.id === "implementation-created");
  assert.equal(implementationThread.cwd, realWorkspace);
  assert.equal(implementationThread.threadRole, "implementation");
  assert.equal(cards.length, 1);
  assert.equal(cards[0].payload.targetThreadId, "implementation-created");
  assert.notEqual(cards[0].payload.targetThreadId, "xcode-thread");
});

test("loop runtime maps source-main thread to registered implementation workspace", async () => {
  const realWorkspace = "/Users/xuxin/Xcode/Home AI";
  const sourceWorkspace = "/Users/xuxin/Documents/Xcode-HomeAI";
  const { cards, createdThreads, runtime } = makeRuntime({
    name: "registered-implementation-workspace",
    visibleThreads: [{
      id: "xcode-thread",
      title: "Xcode",
      cwd: sourceWorkspace,
    }],
    listWorkspaces: async () => [
      { cwd: sourceWorkspace, label: "Xcode placeholder" },
      { cwd: realWorkspace, label: "Home AI Xcode" },
    ],
    isLoopImplementationWorkspace: (cwd) => cwd === realWorkspace
      ? { ok: true, cwd, reason: "xcode_project_marker" }
      : { ok: false, error: "implementation_workspace_project_markers_missing", cwd },
  });

  const result = await startLoopWithSourceRequirements(runtime, {
    sourceThreadId: "xcode-thread",
    text: "@loop redesign native settings",
  });

  assert.equal(result.ok, true);
  assert.equal(result.loop.requirementsThreadId, "xcode-thread");
  assert.equal(result.loop.requirementsLocal, true);
  assert.equal(result.loop.implementationWorkspaceCwd, realWorkspace);
  assert.equal(result.loop.implementationThreadId, "implementation-created");
  assert.equal(createdThreads.find((thread) => thread.id === "implementation-created").cwd, realWorkspace);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].payload.targetThreadId, "implementation-created");
});

test("thread lifecycle resolves Home AI main continuation over old source and Workers", async () => {
  const homeAiCwd = "/Users/hermes-dev/HermesMobileDev/app";
  const { runtime } = makeRuntime({
    name: "home-ai-main-continuation",
    visibleThreads: [
      {
        id: "home-old",
        title: "Home AI 06-22",
        cwd: homeAiCwd,
        status: { type: "completed" },
        updatedAt: 10,
      },
      {
        id: "home-new",
        title: "Home AI 07-05",
        cwd: homeAiCwd,
        status: { type: "completed" },
        updatedAt: 20,
      },
      {
        id: "home-worker",
        title: "Home AI 06-22 Worker Lane",
        cwd: homeAiCwd,
        threadRole: "home_ai_worker",
        status: { type: "idle" },
        updatedAt: 30,
      },
      {
        id: "task-intake",
        title: "Home AI Task Intake",
        cwd: homeAiCwd,
        status: { type: "completed" },
        updatedAt: 40,
      },
    ],
    readContinuationLineageEntries: () => [{
      createdAt: "2026-07-05T00:00:00.000Z",
      sourceThreadId: "home-old",
      sourceThreadTitle: "Home AI 06-22",
      newThreadId: "home-new",
      newThreadTitle: "Home AI 07-05",
      inheritedThreadRole: "home_ai_main",
      preferredMain: true,
    }],
  });

  const resolved = await runtime.threadLifecycle({
    action: "resolve",
    role: "home_ai_main",
    cwd: homeAiCwd,
    sourceThreadId: "home-old",
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.thread.id, "home-new");
  assert.equal(resolved.thread.role, "home_ai_main");

  const listed = await runtime.threadLifecycle({
    action: "list",
    role: "home_ai_main",
    cwd: homeAiCwd,
  });
  assert.deepEqual(listed.threads.map((thread) => thread.id), ["home-new"]);
});

test("loop runtime dispatches product audit in the mapped implementation workspace", async () => {
  const realWorkspace = "/Users/xuxin/Xcode/Home AI";
  const sourceWorkspace = "/Users/xuxin/Documents/Xcode-HomeAI";
  const { cards, createdThreads, runtime } = makeRuntime({
    name: "audit-uses-implementation-workspace",
    visibleThreads: [{
      id: "xcode-thread",
      title: "Xcode",
      cwd: sourceWorkspace,
    }],
    listWorkspaces: async () => [
      { cwd: sourceWorkspace, label: "Xcode placeholder" },
      { cwd: realWorkspace, label: "Home AI Xcode" },
    ],
    isLoopImplementationWorkspace: (cwd) => cwd === realWorkspace
      ? { ok: true, cwd, reason: "xcode_project_marker" }
      : { ok: false, error: "implementation_workspace_project_markers_missing", cwd },
  });

  const started = await startLoopWithSourceRequirements(runtime, {
    sourceThreadId: "xcode-thread",
    text: "@loop redesign native settings",
  });
  assert.equal(started.ok, true);
  assert.equal(started.loop.currentRole, "implementation");
  assert.equal(started.loop.implementationWorkspaceCwd, realWorkspace);
  assert.equal(createdThreads.find((thread) => thread.id === "implementation-created").cwd, realWorkspace);
  assert.equal(createdThreads.find((thread) => thread.id === "product_audit-created").cwd, realWorkspace);
  assert.equal(cards.length, 1);

  const returned = await runtime.recordTerminalReturn({
    taskCardId: "ttc_1",
    status: "completed",
    summary: "implementation done",
    changedFiles: ["Home AI/ContentView.swift", "scripts/check-native-settings-layout.sh"],
    tests: ["scripts/check-native-settings-layout.sh"],
    privacyConfirmation: "bounded native shell evidence only",
  });

  assert.equal(returned.ok, true);
  assert.equal(returned.loop.currentRole, "product_audit");
  assert.equal(returned.loop.auditThreadId, "product_audit-created");
  const audit = returned.loop.roleSlices.find((slice) => slice.role === "product_audit");
  assert.equal(audit.status, "dispatched");
  assert.equal(audit.targetThreadId, "product_audit-created");
  assert.equal(cards.length, 2);
  assert.equal(cards[1].payload.targetRole, "product_audit");
  assert.equal(cards[1].payload.targetThreadId, "product_audit-created");
  assert.match(cards[1].payload.bodyMarkdown, /Implementation workspace cwd: \/Users\/xuxin\/Xcode\/Home AI/);
  assert.match(cards[1].payload.bodyMarkdown, /Home AI\/ContentView\.swift/);
});

test("loop runtime updates blocked duplicate with explicit implementation workspace", async () => {
  const realWorkspace = "/Users/xuxin/Xcode/Home AI";
  const sourceWorkspace = "/Users/xuxin/Documents/Xcode-HomeAI";
  const { cards, createdThreads, runtime, storageFile } = makeRuntime({
    name: "blocked-duplicate-implementation-workspace",
    visibleThreads: [{
      id: "xcode-thread",
      title: "Xcode",
      cwd: sourceWorkspace,
    }, {
      id: "old-implementation-thread",
      title: "Xcode Loop Implement",
      cwd: sourceWorkspace,
      threadRole: "implementation",
    }, {
      id: "audit-thread",
      title: "Plugin Workspace Audit",
      cwd: "/Users/hermes-dev/HermesMobileDev/app",
    }],
    isLoopImplementationWorkspace: (cwd) => cwd === realWorkspace
      ? { ok: true, cwd, reason: "xcode_project_marker" }
      : { ok: false, error: "implementation_workspace_project_markers_missing", cwd },
  });
  const loopId = testLoopId({
    sourceThreadId: "xcode-thread",
    targetThreadId: "xcode-thread",
    objective: "redesign settings",
  });
  fs.writeFileSync(storageFile, `${JSON.stringify({ version: 1, loops: [{
    loopId,
    sourceThreadId: "xcode-thread",
    targetThreadId: "old-implementation-thread",
    requirementsThreadId: "xcode-thread",
    implementationThreadId: "old-implementation-thread",
    auditThreadId: "audit-thread",
    domainAdapter: "generic",
    objectiveSummary: "redesign settings",
    status: "blocked",
    currentRole: "requirements",
    iteration: 1,
    maxIterations: 3,
    nextRoute: "requirements_revision",
    blockedReason: "implementation_blocked_requires_requirements_revision",
    sourceRequestId: `at-loop:${loopId}:source`,
    requirementsLocal: true,
    auditPacket: {},
    createdAt: "2026-07-03T00:00:00.000Z",
    updatedAt: "2026-07-03T00:00:00.000Z",
    roleSlices: [{
      role: "requirements",
      roleSliceId: `${loopId}:requirements:1`,
      iteration: 1,
      status: "blocked",
      dispatchStatus: "source_thread_local_role",
      dispatchMode: "source_thread_local_role",
      taskCardDispatch: false,
      taskCardId: "",
      targetThreadId: "xcode-thread",
      roleOwnerThreadId: "xcode-thread",
      routing: null,
      createdAt: "2026-07-03T00:00:00.000Z",
      updatedAt: "2026-07-03T00:00:00.000Z",
    }, {
      role: "implementation",
      roleSliceId: `${loopId}:implementation:1`,
      iteration: 1,
      status: "returned",
      dispatchStatus: "failed",
      taskCardId: "ttc_old",
      targetThreadId: "old-implementation-thread",
      targetPurpose: "workspace_implementation",
      returnStatus: "blocked",
      blockedReason: "implementation_workspace_project_markers_missing",
      routing: null,
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
      routing: null,
      createdAt: "2026-07-03T00:00:00.000Z",
      updatedAt: "2026-07-03T00:00:00.000Z",
    }],
  }] }, null, 2)}\n`, "utf8");

  const result = await startLoopWithSourceRequirements(runtime, {
    sourceThreadId: "xcode-thread",
    text: "@loop redesign settings",
    implementationWorkspaceCwd: realWorkspace,
  });

  assert.equal(result.ok, true);
  assert.equal(result.recovered, true);
  assert.equal(result.loop.implementationWorkspaceCwd, realWorkspace);
  assert.equal(result.loop.implementationThreadId, "implementation-created");
  const implementation = result.loop.roleSlices.find((slice) => slice.role === "implementation");
  assert.equal(implementation.status, "dispatched");
  assert.equal(implementation.targetThreadId, "implementation-created");
  assert.notEqual(implementation.taskCardId, "ttc_old");
  assert.equal(cards.length, 1);
  assert.equal(cards[0].payload.targetThreadId, "implementation-created");
  assert.equal(createdThreads.find((thread) => thread.id === "implementation-created").cwd, realWorkspace);
});

test("loop runtime re-dispatches blocked audit returns whose lane cwd mismatches the implementation workspace", async () => {
  const realWorkspace = "/Users/xuxin/Xcode/Home AI";
  const sourceWorkspace = "/Users/xuxin/Documents/Xcode-HomeAI";
  const { cards, createdThreads, runtime, storageFile } = makeRuntime({
    name: "blocked-audit-workspace-recovery",
    visibleThreads: [{
      id: "xcode-thread",
      title: "Xcode",
      cwd: sourceWorkspace,
    }, {
      id: "implementation-thread",
      title: "Xcode Loop Implement",
      cwd: realWorkspace,
      threadRole: "implementation",
    }, {
      id: "old-audit-thread",
      title: "Xcode Loop Audit",
      cwd: sourceWorkspace,
      threadRole: "product_audit",
    }],
    listWorkspaces: async () => [
      { cwd: sourceWorkspace, label: "Xcode placeholder" },
      { cwd: realWorkspace, label: "Home AI Xcode" },
    ],
    isLoopImplementationWorkspace: (cwd) => cwd === realWorkspace
      ? { ok: true, cwd, reason: "xcode_project_marker" }
      : { ok: false, error: "implementation_workspace_project_markers_missing", cwd },
  });
  const loopId = testLoopId({
    sourceThreadId: "xcode-thread",
    targetThreadId: "xcode-thread",
    objective: "redesign native settings",
  });
  fs.writeFileSync(storageFile, `${JSON.stringify({ version: 1, loops: [{
    loopId,
    sourceThreadId: "xcode-thread",
    targetThreadId: "implementation-thread",
    requirementsThreadId: "xcode-thread",
    implementationThreadId: "implementation-thread",
    implementationWorkspaceCwd: realWorkspace,
    auditThreadId: "old-audit-thread",
    domainAdapter: "generic",
    objectiveSummary: "redesign native settings",
    status: "blocked",
    currentRole: "product_audit",
    iteration: 1,
    maxIterations: 3,
    nextRoute: "blocked_role_return",
    blockedReason: "product_audit_blocked",
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
      targetThreadId: "xcode-thread",
      roleOwnerThreadId: "xcode-thread",
      routing: null,
      createdAt: "2026-07-03T00:00:00.000Z",
      updatedAt: "2026-07-03T00:00:00.000Z",
    }, {
      role: "implementation",
      roleSliceId: `${loopId}:implementation:1`,
      iteration: 1,
      status: "returned",
      dispatchStatus: "dispatched",
      dispatchMode: "task_card_dispatch",
      taskCardDispatch: true,
      taskCardId: "ttc_impl",
      targetThreadId: "implementation-thread",
      targetPurpose: "workspace_implementation",
      returnStatus: "completed",
      routing: null,
      createdAt: "2026-07-03T00:00:00.000Z",
      updatedAt: "2026-07-03T00:00:00.000Z",
    }, {
      role: "product_audit",
      roleSliceId: `${loopId}:product_audit:1`,
      iteration: 1,
      status: "returned",
      dispatchStatus: "dispatched",
      dispatchMode: "task_card_dispatch",
      taskCardDispatch: true,
      taskCardId: "ttc_old_audit",
      targetThreadId: "old-audit-thread",
      targetPurpose: "audit_lane",
      returnStatus: "blocked",
      blockedReason: "workspace has no xcode project",
      routing: null,
      createdAt: "2026-07-03T00:00:00.000Z",
      updatedAt: "2026-07-03T00:00:00.000Z",
    }],
  }] }, null, 2)}\n`, "utf8");

  const result = await startLoopWithSourceRequirements(runtime, {
    sourceThreadId: "xcode-thread",
    text: "@loop redesign native settings",
  });

  assert.equal(result.ok, true);
  assert.equal(result.recovered, true);
  assert.equal(result.loop.status, "running");
  assert.equal(result.loop.currentRole, "product_audit");
  assert.equal(result.loop.auditThreadId, "product_audit-created");
  const audit = result.loop.roleSlices.find((slice) => slice.role === "product_audit");
  assert.equal(audit.status, "dispatched");
  assert.equal(audit.targetThreadId, "product_audit-created");
  assert.equal(audit.returnStatus, "");
  assert.equal(audit.taskCardId, "ttc_1");
  assert.equal(cards.length, 1);
  assert.equal(cards[0].payload.targetThreadId, "product_audit-created");
  assert.equal(createdThreads.find((thread) => thread.id === "product_audit-created").cwd, realWorkspace);
  assert.match(cards[0].payload.bodyMarkdown, /Implementation workspace cwd: \/Users\/xuxin\/Xcode\/Home AI/);
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
    const result = await startLoopWithSourceRequirements(runtime, {
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
  const result = await startLoopWithSourceRequirements(runtime, {
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
  const started = await startLoopWithSourceRequirements(runtime, {
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
  assert.ok(!cards[1].payload.missingAuditPacketSections.includes("design_contract_packet"));
  assert.ok(cards[1].payload.missingAuditPacketSections.includes("validation_packet"));
  assert.ok(cards[1].payload.auditPacket.sections.find((section) => section.id === "design_contract_packet" && section.status === "present"));
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

test("loop runtime routes product-audit missing-evidence blocks to repair", async () => {
  const { cards, runtime } = makeRuntime({ name: "audit-blocked-missing-evidence-repair" });
  const started = await startLoopWithSourceRequirements(runtime, {
    sourceThreadId: "source-thread",
    text: "@loop redesign settings",
  });
  assert.equal(started.loop.currentRole, "implementation");
  assert.equal(cards.length, 1);

  const implementation = await runtime.recordTerminalReturn({
    taskCardId: "ttc_1",
    status: "completed",
    summary: "implementation done without full validation packet",
  });
  assert.equal(implementation.loop.currentRole, "product_audit");
  assert.equal(cards.length, 2);
  assert.ok(cards[1].payload.missingAuditPacketSections.includes("validation_packet"));

  const audit = await runtime.recordTerminalReturn({
    taskCardId: "ttc_2",
    status: "blocked",
    summary: "audit needs validation and privacy evidence",
  });

  assert.equal(audit.ok, true);
  assert.equal(audit.loop.status, "running");
  assert.equal(audit.loop.currentRole, "repair");
  assert.equal(audit.loop.nextRoute, "repair");
  assert.equal(cards.length, 3);
  assert.equal(cards[2].payload.targetRole, "repair");
  assert.equal(cards[2].payload.targetThreadId, "implementation-thread");
  assert.match(cards[2].payload.bodyMarkdown, /## Repair Input/);
  assert.match(cards[2].payload.bodyMarkdown, /Missing audit packet sections:/);
  assert.match(cards[2].payload.bodyMarkdown, /validation_packet/);
  assert.match(cards[2].payload.bodyMarkdown, /privacy_packet/);
  const auditSlice = audit.loop.roleSlices.find((slice) => slice.role === "product_audit");
  assert.equal(auditSlice.status, "returned");
  assert.equal(auditSlice.returnStatus, "blocked");
  const repairSlice = audit.loop.roleSlices.find((slice) => slice.role === "repair");
  assert.equal(repairSlice.status, "dispatched");
});

test("loop runtime normalizes blocked product-audit UX findings without explicit verdict to repair", async () => {
  const { cards, runtime } = makeRuntime({ name: "audit-blocked-ux-text-repair" });
  const started = await startLoopWithSourceRequirements(runtime, {
    sourceThreadId: "source-thread",
    text: "@loop redesign settings UX",
  });
  assert.equal(started.loop.currentRole, "implementation");

  const implementation = await runtime.recordTerminalReturn({
    taskCardId: "ttc_1",
    status: "completed",
    summary: "implementation done with validation and privacy evidence",
    returnBody: [
      "## Validation Packet",
      "- focused UI validation passed",
      "",
      "## Privacy Packet",
      "- no raw secrets or private payloads exposed",
    ].join("\n"),
  });
  assert.equal(implementation.loop.currentRole, "product_audit");
  assert.deepEqual(implementation.loop.auditPacketStatus.missingSections, []);

  const audit = await runtime.recordTerminalReturn({
    taskCardId: "ttc_2",
    status: "blocked",
    summary: "Implementation UX failure remains in the primary settings workflow.",
  });

  assert.equal(audit.ok, true);
  assert.equal(audit.loop.status, "running");
  assert.equal(audit.loop.currentRole, "repair");
  assert.equal(audit.loop.lastAuditVerdict, "failed_implementation_bug");
  assert.equal(audit.loop.nextRoute, "repair");
  assert.equal(cards.length, 3);
  assert.equal(cards[2].payload.targetRole, "repair");
  assert.match(cards[2].payload.bodyMarkdown, /Audit return summary: Implementation UX failure remains/);
  const auditSlice = audit.loop.roleSlices.find((slice) => slice.role === "product_audit");
  assert.equal(auditSlice.auditVerdict, "failed_implementation_bug");
  assert.equal(auditSlice.routing.auditVerdictNormalization, "return_text");
  const repairSlice = audit.loop.roleSlices.find((slice) => slice.role === "repair");
  assert.equal(repairSlice.status, "dispatched");
});

test("loop runtime routes blocked product-audit requirements gaps back to local requirements", async () => {
  const { cards, runtime } = makeRuntime({ name: "audit-blocked-requirements-gap" });
  const started = await startLoopWithSourceRequirements(runtime, {
    sourceThreadId: "source-thread",
    text: "@loop clarify product requirements",
  });
  assert.equal(started.loop.currentRole, "implementation");

  const implementation = await runtime.recordTerminalReturn({
    taskCardId: "ttc_1",
    status: "completed",
    summary: "implementation done",
  });
  assert.equal(implementation.loop.currentRole, "product_audit");

  const audit = await runtime.recordTerminalReturn({
    taskCardId: "ttc_2",
    status: "blocked",
    auditVerdict: "failed_requirements_gap",
    summary: "requirements packet is ambiguous for the main acceptance criteria",
  });

  assert.equal(audit.ok, true);
  assert.equal(audit.loop.status, "blocked");
  assert.equal(audit.loop.currentRole, "requirements");
  assert.equal(audit.loop.nextRoute, "requirements_revision");
  assert.equal(audit.loop.blockedReason, "product_audit_blocked_requires_requirements_revision");
  assert.equal(audit.loop.lastAuditVerdict, "failed_requirements_gap");
  assert.equal(cards.length, 2);
  const requirements = audit.loop.roleSlices.find((slice) => slice.role === "requirements");
  assert.equal(requirements.status, "blocked");
  assert.equal(requirements.taskCardDispatch, false);
  assert.equal(requirements.blockedReason, "product_audit_blocked_requires_requirements_revision");
});

test("loop runtime marks malformed completed product-audit return with explicit routing error", async () => {
  const { cards, runtime } = makeRuntime({ name: "audit-completed-missing-verdict" });
  const started = await startLoopWithSourceRequirements(runtime, {
    sourceThreadId: "source-thread",
    text: "@loop malformed audit return",
  });
  assert.equal(started.loop.currentRole, "implementation");

  const implementation = await runtime.recordTerminalReturn({
    taskCardId: "ttc_1",
    status: "completed",
    summary: "implementation done",
    returnBody: [
      "## Validation Packet",
      "- focused validation passed",
      "",
      "## Privacy Packet",
      "- privacy boundary confirmed",
    ].join("\n"),
  });
  assert.equal(implementation.loop.currentRole, "product_audit");

  const audit = await runtime.recordTerminalReturn({
    taskCardId: "ttc_2",
    status: "completed",
    summary: "audit return omitted the structured verdict",
  });

  assert.equal(audit.ok, true);
  assert.equal(audit.loop.status, "blocked");
  assert.equal(audit.loop.currentRole, "requirements");
  assert.equal(audit.loop.nextRoute, "requirements_revision");
  assert.equal(audit.loop.blockedReason, "audit_routing_error");
  assert.equal(audit.loop.lastAuditVerdict, "blocked_audit_verdict_missing");
  assert.equal(cards.length, 2);
  const auditSlice = audit.loop.roleSlices.find((slice) => slice.role === "product_audit");
  assert.equal(auditSlice.auditVerdict, "blocked_audit_verdict_missing");
  assert.equal(auditSlice.routing.auditVerdictNormalization, "completed_missing_structured_verdict");
});

test("loop runtime recovers duplicate blocked after historical audit missing-evidence return", async () => {
  const { cards, runtime, storageFile } = makeRuntime({
    name: "historical-audit-blocked-repair",
    visibleThreads: [{
      id: "source-thread",
      title: "Xcode",
      cwd: "/Users/xuxin/Documents/Xcode-HomeAI",
    }, {
      id: "implementation-thread",
      title: "Xcode implementation",
      cwd: "/Users/xuxin/Xcode/Home AI",
      threadRole: "implementation",
    }, {
      id: "audit-thread",
      title: "Xcode Loop Audit",
      cwd: "/Users/xuxin/Xcode/Home AI",
      threadRole: "product_audit",
    }],
    isLoopImplementationWorkspace: (cwd) => cwd === "/Users/xuxin/Xcode/Home AI",
  });
  const loopId = testLoopId({
    sourceThreadId: "source-thread",
    targetThreadId: "source-thread",
    objective: "recover audit blocked loop",
  });
  fs.writeFileSync(storageFile, `${JSON.stringify({ version: 1, loops: [{
    loopId,
    sourceThreadId: "source-thread",
    targetThreadId: "",
    requirementsThreadId: "source-thread",
    implementationThreadId: "implementation-thread",
    auditThreadId: "audit-thread",
    implementationWorkspaceCwd: "/Users/xuxin/Xcode/Home AI",
    domainAdapter: "generic",
    objectiveSummary: "recover audit blocked loop",
    status: "blocked",
    currentRole: "",
    iteration: 1,
    maxIterations: 3,
    nextRoute: "blocked_role_return",
    blockedReason: "",
    sourceRequestId: `at-loop:${loopId}:source`,
    requirementsLocal: true,
    auditPacket: {
      required: true,
      sections: [{
        id: "requirements_packet",
        required: true,
        status: "present",
        source: "source_thread_local_requirements",
        summary: "recover audit blocked loop",
        expectedEvidence: [],
        evidence: ["source_thread_id:source-thread"],
        missingEvidence: [],
      }, {
        id: "design_contract_packet",
        required: true,
        status: "present",
        source: "durable_docs_and_contracts",
        summary: "bounded design contract",
        expectedEvidence: [],
        evidence: ["routing_policy"],
        missingEvidence: [],
      }, {
        id: "implementation_packet",
        required: true,
        status: "present",
        source: "implementation_return_card",
        summary: "implementation done",
        expectedEvidence: [],
        evidence: ["task_card_id:ttc_impl"],
        missingEvidence: [],
      }, {
        id: "validation_packet",
        required: true,
        status: "missing",
        source: "tests_harnesses_and_readback",
        summary: "",
        expectedEvidence: [],
        evidence: [],
        missingEvidence: [],
      }, {
        id: "privacy_packet",
        required: true,
        status: "missing",
        source: "privacy_boundary",
        summary: "",
        expectedEvidence: [],
        evidence: [],
        missingEvidence: [],
      }],
      deltaMatrix: [],
    },
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
      returnStatus: "completed",
      roleOwnerThreadId: "source-thread",
      routing: null,
      createdAt: "2026-07-03T00:00:00.000Z",
      updatedAt: "2026-07-03T00:00:00.000Z",
    }, {
      role: "implementation",
      roleSliceId: `${loopId}:implementation:1`,
      iteration: 1,
      status: "returned",
      dispatchStatus: "dispatched",
      dispatchMode: "task_card",
      taskCardDispatch: true,
      taskCardId: "ttc_impl",
      targetThreadId: "implementation-thread",
      targetPurpose: "workspace_implementation",
      returnStatus: "completed",
      routing: null,
      createdAt: "2026-07-03T00:00:00.000Z",
      updatedAt: "2026-07-03T00:00:00.000Z",
    }, {
      role: "product_audit",
      roleSliceId: `${loopId}:product_audit:1`,
      iteration: 1,
      status: "returned",
      dispatchStatus: "dispatched",
      dispatchMode: "task_card",
      taskCardDispatch: true,
      taskCardId: "ttc_audit",
      targetThreadId: "audit-thread",
      targetPurpose: "audit_lane",
      returnStatus: "blocked",
      auditVerdict: "",
      returnCardId: "ttc_audit_return",
      routing: null,
      createdAt: "2026-07-03T00:00:00.000Z",
      updatedAt: "2026-07-03T00:00:00.000Z",
    }, {
      role: "repair",
      roleSliceId: `${loopId}:repair:1`,
      iteration: 1,
      status: "pending",
      dispatchStatus: "",
      taskCardId: "",
      targetThreadId: "",
      targetPurpose: "",
      routing: null,
      createdAt: "2026-07-03T00:00:00.000Z",
      updatedAt: "2026-07-03T00:00:00.000Z",
    }],
  }] }, null, 2)}\n`, "utf8");

  const result = await startLoopWithSourceRequirements(runtime, {
    sourceThreadId: "source-thread",
    text: "@loop recover audit blocked loop",
    implementationWorkspaceCwd: "/Users/xuxin/Xcode/Home AI",
  });

  assert.equal(result.ok, true);
  assert.equal(result.recovered, true);
  assert.equal(result.loop.status, "running");
  assert.equal(result.loop.currentRole, "repair");
  assert.equal(cards.length, 1);
  assert.equal(cards[0].payload.targetRole, "repair");
  assert.equal(cards[0].payload.targetThreadId, "implementation-thread");
  assert.match(cards[0].payload.bodyMarkdown, /Missing audit packet sections:/);
  assert.match(cards[0].payload.bodyMarkdown, /validation_packet/);
  const repair = result.loop.roleSlices.find((slice) => slice.role === "repair");
  assert.equal(repair.status, "dispatched");
});

test("loop runtime routes blocked implementation returns back to local requirements revision", async () => {
  const { cards, runtime } = makeRuntime({ name: "implementation-blocked-requirements-revision" });
  const started = await startLoopWithSourceRequirements(runtime, {
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
  const started = await startLoopWithSourceRequirements(runtime, {
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

test("loop runtime normalizes design validation and privacy packets from repair return body", async () => {
  const { cards, runtime } = makeRuntime({ name: "repair-return-packet-body" });
  const started = await startLoopWithSourceRequirements(runtime, {
    sourceThreadId: "source-thread",
    text: "@loop redesign native settings",
  });
  assert.equal(started.loop.currentRole, "implementation");
  assert.equal(cards.length, 1);

  const implementation = await runtime.recordTerminalReturn({
    taskCardId: "ttc_1",
    status: "completed",
    summary: "Native settings layout redesign verified in Xcode/Home AI",
    changedFiles: ["Home AI/ContentView.swift", "scripts/check-native-settings-layout.sh"],
  });
  assert.equal(implementation.loop.currentRole, "product_audit");
  assert.equal(cards.length, 2);
  assert.ok(!cards[1].payload.missingAuditPacketSections.includes("design_contract_packet"));
  assert.ok(cards[1].payload.missingAuditPacketSections.includes("validation_packet"));
  assert.ok(cards[1].payload.missingAuditPacketSections.includes("privacy_packet"));
  assert.ok(cards[1].payload.auditPacket.sections.find((section) => section.id === "design_contract_packet" && section.status === "present"));

  const audit = await runtime.recordTerminalReturn({
    taskCardId: "ttc_2",
    status: "blocked",
    auditVerdict: "blocked_missing_evidence",
    summary: "product audit needs design, validation, and privacy packets",
  });
  assert.equal(audit.loop.currentRole, "repair");
  assert.equal(cards.length, 3);

  const repair = await runtime.recordTerminalReturn({
    taskCardId: "ttc_3",
    status: "completed",
    summary: "Filled design, validation, and privacy packets for native settings redesign",
    returnBody: xcodeSettingsRepairPacketBody(),
  });

  assert.equal(repair.ok, true);
  assert.equal(repair.loop.currentRole, "product_audit");
  assert.equal(repair.loop.iteration, 2);
  assert.equal(cards.length, 4);
  const auditPayload = cards[3].payload;
  assert.equal(auditPayload.targetRole, "product_audit");
  assert.deepEqual(auditPayload.missingAuditPacketSections, []);
  assert.equal(auditPayload.auditPacket.status.complete, true);
  for (const id of ["design_contract_packet", "validation_packet", "privacy_packet"]) {
    const section = auditPayload.auditPacket.sections.find((entry) => entry.id === id);
    assert.equal(section.status, "present");
    assert.ok(section.evidence.length > 0);
  }
  assert.match(auditPayload.bodyMarkdown, /Design Contract Packet|design_contract_packet/);
  assert.match(auditPayload.bodyMarkdown, /scripts\/check-native-settings-layout\.sh/);
  assert.doesNotMatch(auditPayload.bodyMarkdown, /\.agent-context\/HANDOFF\.md as audit context/);
});

test("loop runtime permits final audit retry after exhausted repair fills missing packets", async () => {
  const { cards, runtime } = makeRuntime({ name: "exhausted-repair-packet-retry" });
  const started = await startLoopWithSourceRequirements(runtime, {
    sourceThreadId: "source-thread",
    text: "@loop redesign native settings exhausted",
    maxIterations: 1,
  });
  assert.equal(started.loop.maxIterations, 1);
  assert.equal(cards.length, 1);

  await runtime.recordTerminalReturn({
    taskCardId: "ttc_1",
    status: "completed",
    summary: "implementation done",
  });
  await runtime.recordTerminalReturn({
    taskCardId: "ttc_2",
    status: "blocked",
    auditVerdict: "blocked_missing_evidence",
    summary: "missing packet sections",
  });
  const repair = await runtime.recordTerminalReturn({
    taskCardId: "ttc_3",
    status: "completed",
    summary: "repair supplied final packet evidence",
    returnBody: xcodeSettingsRepairPacketBody(),
  });

  assert.equal(repair.ok, true);
  assert.equal(repair.loop.status, "running");
  assert.equal(repair.loop.currentRole, "product_audit");
  assert.equal(repair.loop.nextRoute, "product_audit");
  assert.equal(repair.loop.iteration, 2);
  assert.equal(repair.loop.maxIterations, 2);
  assert.equal(cards.length, 4);
  assert.equal(cards[3].payload.targetRole, "product_audit");
  assert.deepEqual(cards[3].payload.missingAuditPacketSections, []);
});

test("loop runtime can hydrate repair packet body from stored terminal return card", async () => {
  const evidenceCards = new Map([
    ["ttc_repair_return", {
      message: {
        summary: "repair supplied packet evidence",
        body: xcodeSettingsRepairPacketBody(),
      },
    }],
  ]);
  const { cards, runtime } = makeRuntime({
    name: "stored-repair-return-body",
    readThreadTaskCardForLoopEvidence: (cardId) => evidenceCards.get(cardId) || null,
  });
  await startLoopWithSourceRequirements(runtime, {
    sourceThreadId: "source-thread",
    text: "@loop redesign native settings stored return",
    maxIterations: 1,
  });
  await runtime.recordTerminalReturn({
    taskCardId: "ttc_1",
    status: "completed",
    summary: "implementation done",
  });
  await runtime.recordTerminalReturn({
    taskCardId: "ttc_2",
    status: "blocked",
    auditVerdict: "blocked_missing_evidence",
    summary: "missing packet sections",
  });
  const repair = await runtime.recordTerminalReturn({
    taskCardId: "ttc_3",
    returnCardId: "ttc_repair_return",
    status: "completed",
  });

  assert.equal(repair.ok, true);
  assert.equal(repair.loop.status, "running");
  assert.equal(repair.loop.currentRole, "product_audit");
  assert.deepEqual(repair.loop.auditPacketStatus.missingSections, []);
  assert.equal(cards.length, 4);
  assert.deepEqual(cards[3].payload.missingAuditPacketSections, []);
});

test("loop runtime rebuilds exhausted loop audit packet from stored repair return card", async () => {
  const evidenceCards = new Map([
    ["ttc_repair_return", {
      message: {
        summary: "repair supplied final packet evidence",
        body: xcodeSettingsRepairPacketBody(),
      },
    }],
  ]);
  const { cards, runtime, storageFile } = makeRuntime({
    name: "historical-exhausted-packet-rebuild",
    visibleThreads: [{
      id: "source-thread",
      title: "Xcode",
      cwd: "/Users/xuxin/Documents/Xcode-HomeAI",
    }, {
      id: "implementation-thread",
      title: "Xcode Loop Implement",
      cwd: "/Users/xuxin/Xcode/Home AI",
      threadRole: "implementation",
    }, {
      id: "audit-thread",
      title: "Xcode Loop Audit",
      cwd: "/Users/xuxin/Xcode/Home AI",
      threadRole: "product_audit",
    }],
    isLoopImplementationWorkspace: (cwd) => cwd === "/Users/xuxin/Xcode/Home AI",
    readThreadTaskCardForLoopEvidence: (cardId) => evidenceCards.get(cardId) || null,
  });
  const loopId = testLoopId({
    sourceThreadId: "source-thread",
    targetThreadId: "source-thread",
    objective: "recover exhausted audit packet",
  });
  fs.writeFileSync(storageFile, `${JSON.stringify({ version: 1, loops: [{
    loopId,
    sourceThreadId: "source-thread",
    targetThreadId: "",
    requirementsThreadId: "source-thread",
    implementationThreadId: "implementation-thread",
    auditThreadId: "audit-thread",
    implementationWorkspaceCwd: "/Users/xuxin/Xcode/Home AI",
    domainAdapter: "generic",
    objectiveSummary: "recover exhausted audit packet",
    status: "blocked",
    currentRole: "",
    iteration: 3,
    maxIterations: 3,
    nextRoute: "max_iterations_reached",
    blockedReason: "",
    sourceRequestId: `at-loop:${loopId}:source`,
    requirementsLocal: true,
    auditPacket: {
      required: true,
      sections: [{
        id: "requirements_packet",
        required: true,
        status: "present",
        source: "source_thread_local_requirements",
        summary: "recover exhausted audit packet",
        expectedEvidence: [],
        evidence: ["source_thread_id:source-thread"],
        missingEvidence: [],
      }, {
        id: "design_contract_packet",
        required: true,
        status: "missing",
        source: "durable_docs_and_contracts",
        summary: "",
        expectedEvidence: [],
        evidence: [],
        missingEvidence: [],
      }, {
        id: "implementation_packet",
        required: true,
        status: "present",
        source: "implementation_return_card",
        summary: "implementation done",
        expectedEvidence: [],
        evidence: ["task_card_id:ttc_impl"],
        missingEvidence: [],
      }, {
        id: "validation_packet",
        required: true,
        status: "missing",
        source: "tests_harnesses_and_readback",
        summary: "",
        expectedEvidence: [],
        evidence: [],
        missingEvidence: [],
      }, {
        id: "privacy_packet",
        required: true,
        status: "missing",
        source: "privacy_boundary",
        summary: "",
        expectedEvidence: [],
        evidence: [],
        missingEvidence: [],
      }],
      deltaMatrix: [],
    },
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
      returnStatus: "completed",
      roleOwnerThreadId: "source-thread",
      routing: null,
      createdAt: "2026-07-03T00:00:00.000Z",
      updatedAt: "2026-07-03T00:00:00.000Z",
    }, {
      role: "implementation",
      roleSliceId: `${loopId}:implementation:1`,
      iteration: 1,
      status: "returned",
      dispatchStatus: "dispatched",
      dispatchMode: "task_card",
      taskCardDispatch: true,
      taskCardId: "ttc_impl",
      targetThreadId: "implementation-thread",
      targetPurpose: "workspace_implementation",
      returnStatus: "completed",
      returnCardId: "ttc_impl_return",
      routing: null,
      createdAt: "2026-07-03T00:00:00.000Z",
      updatedAt: "2026-07-03T00:00:00.000Z",
    }, {
      role: "product_audit",
      roleSliceId: `${loopId}:product_audit:3`,
      iteration: 3,
      status: "returned",
      dispatchStatus: "dispatched",
      dispatchMode: "task_card",
      taskCardDispatch: true,
      taskCardId: "ttc_audit",
      targetThreadId: "audit-thread",
      targetPurpose: "audit_lane",
      returnStatus: "blocked",
      auditVerdict: "blocked_missing_evidence",
      returnCardId: "ttc_audit_return",
      routing: null,
      createdAt: "2026-07-03T00:00:00.000Z",
      updatedAt: "2026-07-03T00:00:00.000Z",
    }, {
      role: "repair",
      roleSliceId: `${loopId}:repair:3`,
      iteration: 3,
      status: "returned",
      dispatchStatus: "dispatched",
      dispatchMode: "task_card",
      taskCardDispatch: true,
      taskCardId: "ttc_repair",
      targetThreadId: "implementation-thread",
      targetPurpose: "workspace_implementation",
      returnStatus: "completed",
      returnCardId: "ttc_repair_return",
      routing: null,
      createdAt: "2026-07-03T00:00:00.000Z",
      updatedAt: "2026-07-03T00:00:00.000Z",
    }],
  }] }, null, 2)}\n`, "utf8");

  const result = await startLoopWithSourceRequirements(runtime, {
    sourceThreadId: "source-thread",
    text: "@loop recover exhausted audit packet",
    implementationWorkspaceCwd: "/Users/xuxin/Xcode/Home AI",
  });

  assert.equal(result.ok, true);
  assert.equal(result.recovered, true);
  assert.equal(result.loop.status, "running");
  assert.equal(result.loop.currentRole, "product_audit");
  assert.equal(result.loop.iteration, 4);
  assert.equal(result.loop.maxIterations, 4);
  assert.deepEqual(result.loop.auditPacketStatus.missingSections, []);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].payload.targetRole, "product_audit");
  assert.deepEqual(cards[0].payload.missingAuditPacketSections, []);
});

test("loop runtime still blocks exhausted repair when packet sections remain missing", async () => {
  const { cards, runtime } = makeRuntime({ name: "exhausted-repair-missing-packets" });
  await startLoopWithSourceRequirements(runtime, {
    sourceThreadId: "source-thread",
    text: "@loop redesign native settings missing packets",
    maxIterations: 1,
  });
  await runtime.recordTerminalReturn({
    taskCardId: "ttc_1",
    status: "completed",
    summary: "implementation done",
  });
  await runtime.recordTerminalReturn({
    taskCardId: "ttc_2",
    status: "blocked",
    auditVerdict: "blocked_missing_evidence",
    summary: "missing packet sections",
  });
  const repair = await runtime.recordTerminalReturn({
    taskCardId: "ttc_3",
    status: "completed",
    summary: "repair did not include structured packet sections",
  });

  assert.equal(repair.ok, true);
  assert.equal(repair.loop.status, "blocked");
  assert.equal(repair.loop.currentRole, "");
  assert.equal(repair.loop.nextRoute, "max_iterations_reached");
  assert.equal(cards.length, 3);
  assert.ok(!repair.loop.auditPacketStatus.missingSections.includes("design_contract_packet"));
  assert.ok(repair.loop.auditPacketStatus.missingSections.includes("validation_packet"));
  assert.ok(repair.loop.auditPacketStatus.missingSections.includes("privacy_packet"));
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
  const result = await startLoopWithSourceRequirements(runtime, { sourceThreadId: "source-thread", text: "@loop implement work" });
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
  const first = await startLoopWithSourceRequirements(runtime, { sourceThreadId: "source-thread", text: "@loop implement work" });
  assert.equal(first.ok, false);
  assert.equal(first.error, "at_loop_missing_role_lane");
  const second = await startLoopWithSourceRequirements(runtime, { sourceThreadId: "source-thread", text: "@loop implement work" });
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
  const result = await startLoopWithSourceRequirements(runtime, {
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

test("loop runtime recovers duplicate blocked on implementation dispatch failure", async () => {
  const { cards, runtime, storageFile } = makeRuntime({
    name: "blocked-implementation-dispatch-duplicate",
    visibleThreads: [{
      id: "source-thread",
      title: "Xcode",
      cwd: "/Users/xuxin/Documents/Xcode-HomeAI",
    }, {
      id: "bad-implementation-thread",
      title: "Xcode implementation stale",
      cwd: "/Users/xuxin/Xcode/Home AI",
      threadRole: "implementation",
    }, {
      id: "good-implementation-thread",
      title: "Xcode implementation",
      cwd: "/Users/xuxin/Xcode/Home AI",
      threadRole: "implementation",
    }, {
      id: "audit-thread",
      title: "Xcode Loop Audit",
      cwd: "/Users/xuxin/Xcode/Home AI",
      threadRole: "product_audit",
    }],
    createLoopRoleThread: false,
    resolveThreadTaskCardTargetReference: (threadId) => {
      if (threadId === "bad-implementation-thread") {
        const err = new Error("Target thread is not visible or is not a current deliverable thread.");
        err.code = "target_thread_not_visible";
        err.statusCode = 404;
        throw err;
      }
      return String(threadId || "");
    },
    isLoopImplementationWorkspace: (cwd) => cwd === "/Users/xuxin/Xcode/Home AI",
  });
  const loopId = testLoopId({
    sourceThreadId: "source-thread",
    targetThreadId: "source-thread",
    objective: "recover blocked implementation dispatch",
  });
  fs.writeFileSync(storageFile, `${JSON.stringify({ version: 1, loops: [{
    loopId,
    sourceThreadId: "source-thread",
    targetThreadId: "bad-implementation-thread",
    requirementsThreadId: "source-thread",
    implementationThreadId: "bad-implementation-thread",
    auditThreadId: "audit-thread",
    implementationWorkspaceCwd: "/Users/xuxin/Xcode/Home AI",
    domainAdapter: "generic",
    objectiveSummary: "recover blocked implementation dispatch",
    status: "blocked",
    currentRole: "implementation",
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
      targetThreadId: "bad-implementation-thread",
      targetPurpose: "workspace_implementation",
      returnStatus: "blocked",
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
      routing: null,
      createdAt: "2026-07-03T00:00:00.000Z",
      updatedAt: "2026-07-03T00:00:00.000Z",
    }, {
      role: "repair",
      roleSliceId: `${loopId}:repair:1`,
      iteration: 1,
      status: "pending",
      dispatchStatus: "",
      taskCardId: "",
      targetThreadId: "",
      targetPurpose: "",
      routing: null,
      createdAt: "2026-07-03T00:00:00.000Z",
      updatedAt: "2026-07-03T00:00:00.000Z",
    }],
  }] }, null, 2)}\n`, "utf8");

  const result = await startLoopWithSourceRequirements(runtime, {
    sourceThreadId: "source-thread",
    text: "@loop recover blocked implementation dispatch",
    implementationWorkspaceCwd: "/Users/xuxin/Xcode/Home AI",
  });

  assert.equal(result.ok, true);
  assert.equal(result.recovered, true);
  assert.equal(result.loop.status, "running");
  assert.equal(result.loop.currentRole, "implementation");
  assert.equal(result.loop.implementationThreadId, "good-implementation-thread");
  const implementation = result.loop.roleSlices.find((slice) => slice.role === "implementation");
  assert.equal(implementation.status, "dispatched");
  assert.equal(implementation.targetThreadId, "good-implementation-thread");
  assert.equal(cards.length, 1);
  assert.equal(cards[0].payload.targetThreadId, "good-implementation-thread");
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

  const result = await startLoopWithSourceRequirements(runtime, {
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

test("loop runtime skips persisted stale dispatch target before sending role card", async () => {
  const dispatchAttempts = [];
  const { cards, createdThreads, runtime, storageFile } = makeRuntime({
    name: "dispatch-layer-stale-target-retry",
    visibleThreads: [{
      id: "source-thread",
      title: "Xcode",
      cwd: "/Users/xuxin/Documents/Xcode-HomeAI",
    }, {
      id: "stale-created-thread",
      title: "Xcode Loop Implement",
      cwd: "/Users/xuxin/Documents/Xcode-HomeAI",
      threadRole: "implementation",
      status: { type: "notLoaded" },
    }, {
      id: "audit-thread",
      title: "Plugin Workspace Audit",
      cwd: "/Users/hermes-dev/HermesMobileDev/app",
    }],
    createThreadTaskCardsFromSourceThread: async (sourceThreadId, payload, context) => {
      dispatchAttempts.push({
        targetThreadId: payload.targetThreadId,
        idempotencyKey: payload.idempotencyKey,
      });
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

  const result = await startLoopWithSourceRequirements(runtime, {
    sourceThreadId: "source-thread",
    text: "@loop recover stale dispatch target",
  });

  assert.equal(result.ok, false);
  assert.equal(result.duplicateSuppressed, false);
  assert.equal(result.recovered, false);
  assert.deepEqual(dispatchAttempts.map((entry) => entry.targetThreadId), ["stale-created-thread"]);
  assert.equal(result.loop.implementationThreadId, "stale-created-thread");
  const implementation = result.loop.roleSlices.find((slice) => slice.role === "implementation");
  assert.equal(implementation.status, "blocked");
  assert.equal(implementation.targetThreadId, "stale-created-thread");
  assert.equal(implementation.blockedReason, "Target thread is not visible or is not a current deliverable thread.");
  assert.equal(implementation.routing.preservedTargetThreadId, "stale-created-thread");
  assert.equal(cards.length, 0);
  assert.equal(createdThreads.length, 0);
});

test("loop runtime clears multiple stale dispatch targets before creating a fresh role lane", async () => {
  const dispatchAttempts = [];
  const { cards, createdThreads, runtime, storageFile } = makeRuntime({
    name: "multiple-dispatch-layer-stale-targets",
    visibleThreads: [{
      id: "source-thread",
      title: "Xcode",
      cwd: "/Users/xuxin/Documents/Xcode-HomeAI",
    }, {
      id: "stale-created-thread-a",
      title: "Xcode Loop Implement 07-04a",
      cwd: "/Users/xuxin/Documents/Xcode-HomeAI",
      threadRole: "implementation",
      status: { type: "notLoaded" },
    }, {
      id: "stale-created-thread-b",
      title: "Xcode Loop Implement 07-04b",
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
      if (payload.targetThreadId === "stale-created-thread-a" || payload.targetThreadId === "stale-created-thread-b") {
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
    objective: "recover multiple stale dispatch targets",
  });
  fs.writeFileSync(storageFile, `${JSON.stringify({ version: 1, loops: [{
    loopId,
    sourceThreadId: "source-thread",
    targetThreadId: "stale-created-thread-a",
    requirementsThreadId: "source-thread",
    implementationThreadId: "stale-created-thread-a",
    auditThreadId: "audit-thread",
    domainAdapter: "generic",
    objectiveSummary: "recover multiple stale dispatch targets",
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
      targetThreadId: "stale-created-thread-a",
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

  const result = await startLoopWithSourceRequirements(runtime, {
    sourceThreadId: "source-thread",
    text: "@loop recover multiple stale dispatch targets",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(dispatchAttempts, ["stale-created-thread-b", "implementation-created"]);
  assert.equal(result.loop.implementationThreadId, "implementation-created");
  assert.equal(cards.length, 1);
  assert.equal(cards[0].payload.targetThreadId, "implementation-created");
  assert.equal(createdThreads.length, 1);
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

  const result = await startLoopWithSourceRequirements(runtime, {
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

test("loop thread lifecycle lists completed role lanes as deliverable metadata targets", async () => {
  const { runtime } = makeRuntime({
    name: "thread-lifecycle-completed-role-lane",
    visibleThreads: [{
      id: "source-thread",
      title: "Home AI",
      cwd: "/Users/hermes-dev/HermesMobileDev/app",
    }, {
      id: "implementation-lane",
      title: "Home AI Loop Implement",
      cwd: "/Users/hermes-dev/HermesMobileDev/app",
      threadRole: "implementation",
      status: { type: "completed" },
    }, {
      id: "archived-implementation-lane",
      title: "Home AI Loop Implement",
      cwd: "/Users/hermes-dev/HermesMobileDev/app",
      threadRole: "implementation",
      status: { type: "completed" },
      archived: true,
    }],
  });

  const listed = await runtime.threadLifecycle({
    action: "list",
    role: "implementation",
    cwd: "/Users/hermes-dev/HermesMobileDev/app",
    includeIneligible: true,
  });

  assert.equal(listed.ok, true);
  const implementation = listed.threads.find((thread) => thread.id === "implementation-lane");
  assert.equal(implementation.status, "completed");
  assert.equal(implementation.deliverable, true);
  const archived = listed.threads.find((thread) => thread.id === "archived-implementation-lane");
  assert.equal(archived.deliverable, false);
  assert.equal(archived.deliverabilityReason, "explicit_non_deliverable_flag");
});

test("loop thread lifecycle ensures and marks role lanes complete without title routing", async () => {
  const { createdThreads, runtime } = makeRuntime({
    name: "thread-lifecycle-ensure-complete",
    visibleThreads: [{
      id: "source-thread",
      title: "Movie Loop Implementation: long old title should not leak",
      cwd: "/Users/hermes-dev/HermesMobileDev/Movie",
    }],
  });
  const started = await runtime.startLoop({
    sourceThreadId: "source-thread",
    text: "@loop improve product UI",
  });
  assert.equal(started.ok, true);

  const ensured = await runtime.threadLifecycle({
    action: "ensure",
    loopId: started.loop.loopId,
    role: "implementation",
  });
  assert.equal(ensured.ok, true);
  assert.equal(ensured.thread.id, "implementation-created");
  assert.equal(createdThreads.find((thread) => thread.id === "implementation-created").title, "Movie Loop Implement");

  const completed = await runtime.threadLifecycle({
    action: "mark_role_complete",
    loopId: started.loop.loopId,
    role: "implementation",
  });
  assert.equal(completed.ok, true);
  assert.equal(completed.slice.status, "achieved");
  assert.equal(completed.slice.dispatchStatus, "role_complete");
});

test("thread lifecycle ensures home ai worker lanes with idempotency and retirement", async () => {
  const { createdThreads, runtime } = makeRuntime({
    name: "thread-lifecycle-home-ai-worker",
    visibleThreads: [{
      id: "home-ai-main",
      title: "Home AI",
      cwd: "/Users/hermes-dev/HermesMobileDev/app",
    }, {
      id: "home-ai-task-intake",
      title: "Home AI Task Intake",
      cwd: "/Users/hermes-dev/HermesMobileDev/app",
      threadRole: "home_ai_task_intake",
    }, {
      id: "home-ai-deploy",
      title: "Home AI Deploy Lane",
      cwd: "/Users/hermes-dev/HermesMobileDev/app",
      threadRole: "home_ai_deploy",
    }],
  });

  const ensured = await runtime.threadLifecycle({
    action: "ensure",
    role: "home_ai_worker",
    sourceThreadId: "home-ai-main",
    cwd: "/Users/hermes-dev/HermesMobileDev/app",
    purpose: "implementation",
    idempotencyKey: "home-ai-worker-ensure-1",
  });
  assert.equal(ensured.ok, true);
  assert.equal(ensured.created, true);
  assert.equal(ensured.thread.threadRole, "home_ai_worker");
  assert.equal(ensured.thread.workerPurpose, "implementation");
  assert.equal(createdThreads[0].threadRole, "home_ai_worker");

  const duplicate = await runtime.threadLifecycle({
    action: "ensure",
    role: "home_ai_worker",
    sourceThreadId: "home-ai-main",
    cwd: "/Users/hermes-dev/HermesMobileDev/app",
    purpose: "implementation",
    idempotencyKey: "home-ai-worker-ensure-1",
  });
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.created, false);
  assert.equal(duplicate.thread.id, ensured.thread.id);
  assert.equal(createdThreads.length, 1);

  const completed = await runtime.threadLifecycle({
    action: "mark_completed",
    role: "home_ai_worker",
    targetThreadId: ensured.thread.id,
  });
  assert.equal(completed.ok, true);
  assert.equal(completed.thread.lifecycleStatus, "completed");
  assert.equal(completed.thread.deliverable, true);

  const retired = await runtime.threadLifecycle({
    action: "retire",
    role: "home_ai_worker",
    targetThreadId: ensured.thread.id,
  });
  assert.equal(retired.ok, true);
  assert.equal(retired.thread.deliverable, false);
  assert.equal(retired.thread.deliverabilityReason, "lifecycle_retired");

  const resolved = await runtime.threadLifecycle({
    action: "resolve",
    role: "home_ai_worker",
    targetThreadId: ensured.thread.id,
    includeIneligible: true,
  });
  assert.equal(resolved.ok, false);
  assert.equal(resolved.error, "thread_lifecycle_target_not_deliverable");

  const listed = await runtime.threadLifecycle({
    action: "list",
    role: "home_ai_worker",
    cwd: "/Users/hermes-dev/HermesMobileDev/app",
  });
  assert.equal(listed.ok, true);
  assert.equal(listed.threads.some((thread) => thread.id === "home-ai-task-intake"), false);
  assert.equal(listed.threads.some((thread) => thread.id === "home-ai-deploy"), false);
  assert.equal(listed.threads.some((thread) => thread.id === ensured.thread.id), false);
});

test("thread lifecycle supports plugin worker lanes distinct from plugin loop and deploy lanes", async () => {
  const { createdThreads, runtime } = makeRuntime({
    name: "thread-lifecycle-plugin-worker",
    visibleThreads: [{
      id: "movie-main",
      title: "Movie",
      cwd: "/Users/hermes-dev/HermesMobileDev/Movie",
    }, {
      id: "movie-loop-implementation",
      title: "Movie Loop Implement",
      cwd: "/Users/hermes-dev/HermesMobileDev/Movie",
      threadRole: "implementation",
    }, {
      id: "movie-deploy",
      title: "Movie Deploy Lane",
      cwd: "/Users/hermes-dev/HermesMobileDev/Movie",
      threadRole: "plugin_deployment",
    }],
  });

  const missingPlugin = await runtime.threadLifecycle({
    action: "ensure",
    role: "plugin_worker",
    sourceThreadId: "movie-main",
    cwd: "/Users/hermes-dev/HermesMobileDev/Movie",
  });
  assert.equal(missingPlugin.ok, false);
  assert.equal(missingPlugin.error, "thread_lifecycle_plugin_id_required");

  const ensured = await runtime.threadLifecycle({
    action: "ensure",
    role: "plugin_worker",
    pluginId: "movie",
    sourceThreadId: "movie-main",
    cwd: "/Users/hermes-dev/HermesMobileDev/Movie",
    purpose: "review",
    requestId: "movie-worker-review",
  });
  assert.equal(ensured.ok, true);
  assert.equal(ensured.created, true);
  assert.equal(ensured.thread.pluginId, "movie");
  assert.equal(ensured.thread.workerPurpose, "review");
  assert.equal(createdThreads[0].threadRole, "plugin_worker");

  const duplicate = await runtime.threadLifecycle({
    action: "ensure",
    role: "plugin_worker",
    pluginId: "movie",
    sourceThreadId: "movie-main",
    cwd: "/Users/hermes-dev/HermesMobileDev/Movie",
    purpose: "review",
    requestId: "movie-worker-review",
  });
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.created, false);
  assert.equal(duplicate.thread.id, ensured.thread.id);
  assert.equal(createdThreads.length, 1);

  const heartbeat = await runtime.threadLifecycle({
    action: "heartbeat",
    role: "plugin_worker",
    pluginId: "movie",
    targetThreadId: ensured.thread.id,
    taskCardId: "ttc_plugin_worker",
    status: "working",
    summary: "bounded progress",
  });
  assert.equal(heartbeat.ok, true);
  assert.equal(heartbeat.thread.heartbeat.taskCardId, "ttc_plugin_worker");
  assert.equal(heartbeat.thread.heartbeat.summary, "bounded progress");

  const listed = await runtime.threadLifecycle({
    action: "list",
    role: "plugin_worker",
    pluginId: "movie",
    cwd: "/Users/hermes-dev/HermesMobileDev/Movie",
    includeIneligible: true,
  });
  assert.equal(listed.ok, true);
  assert.equal(listed.threads.some((thread) => thread.id === ensured.thread.id && thread.deliverable), true);
  assert.equal(listed.threads.some((thread) => thread.id === "movie-loop-implementation"), false);
  assert.equal(listed.threads.some((thread) => thread.id === "movie-deploy"), false);

  const retired = await runtime.threadLifecycle({
    action: "retire",
    role: "plugin_worker",
    targetThreadId: ensured.thread.id,
  });
  assert.equal(retired.ok, true);
  assert.equal(retired.thread.deliverable, false);
});

test("loop watchdog marks stale returns without retrying or completing work", async () => {
  const initial = Date.parse("2026-07-03T01:00:00.000Z");
  const { cards, runtime, setNow } = makeRuntime({ name: "watchdog", now: initial });
  const started = await startLoopWithSourceRequirements(runtime, { sourceThreadId: "source-thread", text: "@loop wait for card" });
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
