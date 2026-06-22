"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  classifyWorkspaceSourceWriteRequest,
  createWorkspaceSourceWriteGuard,
  extractWritePathsFromRequest,
  isPathInside,
} = require("../adapters/workspace-source-write-guard-service");

function tempProjectRoot(name) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `codex-mobile-${name}-`));
  fs.mkdirSync(path.join(root, ".git"));
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name }), "utf8");
  return root;
}

test("workspace source write guard allows current workspace git metadata writes", () => {
  const current = tempProjectRoot("current");
  const foreign = tempProjectRoot("foreign");

  const decision = classifyWorkspaceSourceWriteRequest({
    method: "applyPatchApproval",
    params: {
      cwd: current,
      fileChanges: {
        ".git/index.lock": { type: "create" },
      },
    },
  }, {
    currentCwd: current,
    workspaceRoots: [current, foreign],
  });

  assert.equal(decision.action, "allow");
  assert.equal(decision.reason, "file_change_not_foreign_source");
  fs.rmSync(current, { recursive: true, force: true });
  fs.rmSync(foreign, { recursive: true, force: true });
});

test("workspace source write guard denies explicit file changes in another source root", () => {
  const current = tempProjectRoot("current");
  const foreign = tempProjectRoot("foreign");
  const target = path.join(foreign, "server.js");

  const decision = classifyWorkspaceSourceWriteRequest({
    method: "item/fileChange/requestApproval",
    params: {
      cwd: current,
      fileChanges: [{ path: target, type: "modify" }],
    },
  }, {
    currentCwd: current,
    workspaceRoots: [current, foreign],
  });

  assert.equal(decision.action, "deny");
  assert.equal(decision.reason, "foreign_source_file_change");
  assert.equal(isPathInside(decision.matchedPath, foreign), true);
  fs.rmSync(current, { recursive: true, force: true });
  fs.rmSync(foreign, { recursive: true, force: true });
});

test("workspace source write guard allows read-like commands against other workspaces", () => {
  const current = tempProjectRoot("current");
  const foreign = tempProjectRoot("foreign");

  const decision = classifyWorkspaceSourceWriteRequest({
    method: "item/commandExecution/requestApproval",
    params: {
      cwd: current,
      command: `rg "TODO" ${foreign}`,
    },
  }, {
    currentCwd: current,
    workspaceRoots: [current, foreign],
  });

  assert.equal(decision.action, "allow");
  assert.equal(decision.reason, "read_or_non_write_command");
  fs.rmSync(current, { recursive: true, force: true });
  fs.rmSync(foreign, { recursive: true, force: true });
});

test("workspace source write guard denies write-like commands in another source root", () => {
  const current = tempProjectRoot("current");
  const foreign = tempProjectRoot("foreign");

  const byCwd = classifyWorkspaceSourceWriteRequest({
    method: "item/commandExecution/requestApproval",
    params: {
      cwd: foreign,
      command: "git commit -m update",
    },
  }, {
    currentCwd: current,
    workspaceRoots: [current, foreign],
  });
  assert.equal(byCwd.action, "deny");
  assert.equal(byCwd.reason, "foreign_source_write_command_cwd");

  const byPath = classifyWorkspaceSourceWriteRequest({
    method: "execCommandApproval",
    params: {
      cwd: current,
      command: `sed -i '' 's/a/b/' ${path.join(foreign, "app.js")}`,
    },
  }, {
    currentCwd: current,
    workspaceRoots: [current, foreign],
  });
  assert.equal(byPath.action, "deny");
  assert.equal(byPath.reason, "foreign_source_write_command_path");
  fs.rmSync(current, { recursive: true, force: true });
  fs.rmSync(foreign, { recursive: true, force: true });
});

test("workspace source write guard allows read permission requests and denies foreign write grants", () => {
  const current = tempProjectRoot("current");
  const foreign = tempProjectRoot("foreign");

  const readDecision = classifyWorkspaceSourceWriteRequest({
    method: "item/permissions/requestApproval",
    params: {
      cwd: current,
      grantRoot: foreign,
      permissions: { fileSystem: { read: [foreign] } },
    },
  }, {
    currentCwd: current,
    workspaceRoots: [current, foreign],
  });
  assert.equal(readDecision.action, "allow");
  assert.equal(readDecision.reason, "non_source_permission");

  const writeDecision = classifyWorkspaceSourceWriteRequest({
    method: "item/permissions/requestApproval",
    params: {
      cwd: current,
      grantRoot: foreign,
      permissions: { fileSystem: { write: [foreign] } },
    },
  }, {
    currentCwd: current,
    workspaceRoots: [current, foreign],
  });
  assert.equal(writeDecision.action, "deny");
  assert.equal(writeDecision.reason, "foreign_source_file_system_permission");
  fs.rmSync(current, { recursive: true, force: true });
  fs.rmSync(foreign, { recursive: true, force: true });
});

test("workspace source write guard factory resolves request context through providers", () => {
  const current = tempProjectRoot("current");
  const foreign = tempProjectRoot("foreign");
  const service = createWorkspaceSourceWriteGuard({
    currentCwdForRequest: () => current,
    workspaceRoots: () => [current, foreign],
  });

  const decision = service.classify({
    method: "applyPatchApproval",
    params: {
      fileChanges: {
        [path.join(foreign, "index.js")]: { type: "modify" },
      },
    },
  });

  assert.equal(decision.action, "deny");
  fs.rmSync(current, { recursive: true, force: true });
  fs.rmSync(foreign, { recursive: true, force: true });
});

test("workspace source write guard extracts bounded write paths from nested payloads", () => {
  const root = tempProjectRoot("extract");
  const paths = extractWritePathsFromRequest("item/fileChange/requestApproval", {
    cwd: root,
    changes: [{ targetPath: "src/app.js" }],
  }, root);

  assert.equal(paths.length, 1);
  const realRoot = fs.realpathSync.native ? fs.realpathSync.native(root) : fs.realpathSync(root);
  assert.equal(paths[0], path.join(realRoot, "src", "app.js"));
  fs.rmSync(root, { recursive: true, force: true });
});
