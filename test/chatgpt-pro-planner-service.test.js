"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  createChatGptProPlannerService,
  isAllowedPlannerRelativePath,
  normalizeArtifactType,
} = require("../adapters/chatgpt-pro-planner-service");

function makeWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-planner-workspace-"));
  fs.mkdirSync(path.join(root, "docs"), { recursive: true });
  fs.mkdirSync(path.join(root, ".agent-context"), { recursive: true });
  fs.writeFileSync(path.join(root, "README.md"), "# Demo\n", "utf8");
  fs.writeFileSync(path.join(root, "docs", "PLAN.md"), "# Plan\nDetails\n", "utf8");
  fs.writeFileSync(path.join(root, ".agent-context", "HANDOFF.md"), "# Handoff\n", "utf8");
  fs.writeFileSync(path.join(root, ".env"), "SECRET=value\n", "utf8");
  return root;
}

function makeService(options = {}) {
  const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-planner-runtime-"));
  const workspace = options.workspace || makeWorkspace();
  let idCounter = 0;
  const service = createChatGptProPlannerService({
    runtimeRoot,
    now: () => 1780000000000 + idCounter++,
    randomBytes: () => Buffer.from("abcde12345", "hex"),
    version: "0.1.test",
    listWorkspaces: async () => [{ cwd: workspace, label: "Demo", active: true, recentThreadCount: 2 }],
    workspaceRoots: async () => [workspace],
    readThreadContext: async ({ threadId }) => threadId === "thread-1" ? {
      id: "thread-1",
      title: "Current work",
      status: "idle",
      cwd: workspace,
      model: "gpt-test",
      reasoningEffort: "high",
      updatedAt: 1780000000000,
      summary: "bounded summary",
    } : null,
  });
  return { service, runtimeRoot, workspace };
}

test("planner service normalizes artifact types and stores runtime artifacts", () => {
  const { service } = makeService();
  assert.equal(normalizeArtifactType("goal"), "codex_goal");
  assert.equal(normalizeArtifactType("task card"), "task_card_draft");
  const artifact = service.createPlannerArtifact({
    type: "prd",
    title: "Profile switch preflight",
    bodyMarkdown: "# PRD\nBody",
    sourceThreadId: "thread-1",
    cwd: "/work/project",
  });
  assert.equal(artifact.type, "prd");
  assert.match(artifact.id, /^cpp_/);
  assert.deepEqual(artifact.applyActions, ["copy_markdown", "save_runtime_artifact"]);

  const listed = service.listPlannerArtifacts({ limit: 10 });
  assert.equal(listed.artifacts.length, 1);
  assert.equal(listed.artifacts[0].bodyMarkdown, undefined);

  const read = service.readPlannerArtifact({ id: artifact.id });
  assert.equal(read.artifact.bodyMarkdown, "# PRD\nBody");
});

test("planner service prepares codex goals and task-card drafts without executing them", () => {
  const { service } = makeService();
  const goal = service.prepareCodexGoal({
    objective: "Implement bounded connector",
    constraints: "- Do not write source from ChatGPT",
    requiredChecks: "- npm test",
  });
  assert.equal(goal.type, "codex_goal");
  assert.match(goal.bodyMarkdown, /Objective:/);
  assert.match(goal.bodyMarkdown, /Implement bounded connector/);
  assert.ok(goal.applyActions.includes("set_goal"));

  const draft = service.createTaskCardDraft({
    title: "Review connector",
    bodyMarkdown: "Please review the connector boundaries.",
  });
  assert.equal(draft.type, "task_card_draft");
  assert.ok(draft.applyActions.includes("create_task_card"));
});

test("planner service reads only allowlisted bounded repository files", async () => {
  const { service, workspace } = makeService();
  assert.equal(isAllowedPlannerRelativePath("README.md"), true);
  assert.equal(isAllowedPlannerRelativePath("docs/PLAN.md"), true);
  assert.equal(isAllowedPlannerRelativePath(".agent-context/HANDOFF.md"), true);
  assert.equal(isAllowedPlannerRelativePath(".env"), false);
  assert.equal(isAllowedPlannerRelativePath("../README.md"), false);

  const read = await service.readAllowedRepoFile({
    cwd: workspace,
    relativePath: "docs/PLAN.md",
    maxChars: 1000,
  });
  assert.equal(read.ok, true);
  assert.equal(read.relativePath, "docs/PLAN.md");
  assert.match(read.content, /# Plan/);

  await assert.rejects(
    () => service.readAllowedRepoFile({ cwd: workspace, relativePath: ".env" }),
    /file_not_allowed/,
  );
});

test("planner service rejects invisible workspaces and missing thread contexts", async () => {
  const { service } = makeService();
  await assert.rejects(
    () => service.readAllowedRepoFile({ cwd: "/tmp/not-visible", relativePath: "README.md" }),
    /workspace_not_visible/,
  );
  await assert.rejects(
    () => service.readBoundedThreadContext({ threadId: "missing" }),
    /thread_not_found_or_not_visible/,
  );
});
