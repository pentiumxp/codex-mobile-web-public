"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  createWorkspaceRegistryService,
  workspaceNameFromInput,
} = require("../adapters/workspace-registry-service");

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-workspace-"));
}

test("workspace registry creates and persists a workspace under an allowed root", () => {
  const root = tempRoot();
  const storageFile = path.join(root, "runtime", "workspaces.json");
  const service = createWorkspaceRegistryService({
    storageFile,
    homeDir: root,
    createRoots: [root],
  });

  const result = service.create({ name: "Finance" });

  assert.equal(result.ok, true);
  assert.equal(result.created, true);
  assert.equal(result.workspace.label, "Finance");
  assert.equal(result.workspace.cwd, path.join(root, "Finance"));
  assert.equal(result.workspace.source, "mobile");
  assert.ok(fs.statSync(result.workspace.cwd).isDirectory());

  const reloaded = createWorkspaceRegistryService({
    storageFile,
    homeDir: root,
    createRoots: [root],
  });
  assert.deepEqual(reloaded.list().map((workspace) => workspace.cwd), [result.workspace.cwd]);
});

test("workspace registry is idempotent for an existing directory", () => {
  const root = tempRoot();
  const existing = path.join(root, "Existing");
  fs.mkdirSync(existing);
  const service = createWorkspaceRegistryService({
    storageFile: path.join(root, "workspaces.json"),
    homeDir: root,
    createRoots: [root],
  });

  const result = service.create({ name: "Existing" });

  assert.equal(result.created, false);
  assert.equal(result.workspace.cwd, existing);
  assert.deepEqual(service.list().map((workspace) => workspace.cwd), [existing]);
});

test("workspace registry rejects unsafe folder names and disallowed roots", () => {
  assert.throws(() => workspaceNameFromInput(".."), /not allowed/);
  assert.throws(() => workspaceNameFromInput("nested\\folder"), /simple folder name/);
  assert.throws(() => workspaceNameFromInput("bad:name"), /invalid characters/);
  assert.throws(() => workspaceNameFromInput("CON.txt"), /reserved/);

  const root = tempRoot();
  const otherRoot = tempRoot();
  const service = createWorkspaceRegistryService({
    storageFile: path.join(root, "workspaces.json"),
    homeDir: root,
    createRoots: [root],
  });

  assert.throws(() => service.create({ name: "Finance", parent: otherRoot }), /not allowed/);
});
