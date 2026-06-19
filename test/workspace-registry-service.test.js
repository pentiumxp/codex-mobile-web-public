"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  createWorkspaceRegistryService,
  syncDesktopGlobalWorkspaceRoots,
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
  assert.deepEqual(reloaded.registeredPaths(), [result.workspace.cwd]);
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

test("workspace registry syncs mobile-created workspaces into Codex Desktop global state", () => {
  const root = tempRoot();
  const globalStateFile = path.join(root, "codex-home", ".codex-global-state.json");
  fs.mkdirSync(path.dirname(globalStateFile), { recursive: true });
  fs.writeFileSync(globalStateFile, JSON.stringify({
    "electron-saved-workspace-roots": [path.join(root, "Existing")],
    "project-order": [],
    "active-workspace-roots": [],
  }, null, 2), "utf8");
  const service = createWorkspaceRegistryService({
    storageFile: path.join(root, "workspaces.json"),
    homeDir: root,
    createRoots: [root],
    desktopGlobalStateFiles: [globalStateFile],
  });

  const result = service.create({ name: "HomeAI" });
  const globalState = JSON.parse(fs.readFileSync(globalStateFile, "utf8"));

  assert.equal(result.desktopGlobalStateSynced, true);
  assert.equal(result.desktopGlobalStateSyncCount, 1);
  for (const key of ["electron-saved-workspace-roots", "project-order", "active-workspace-roots"]) {
    assert.ok(globalState[key].includes(result.workspace.cwd), `${key} should include workspace cwd`);
  }
});

test("desktop global state sync is idempotent across repeated writes", () => {
  const root = tempRoot();
  const globalStateFile = path.join(root, ".codex-global-state.json");
  const workspace = path.join(root, "Workspace");
  fs.mkdirSync(workspace);

  syncDesktopGlobalWorkspaceRoots([globalStateFile, globalStateFile], workspace);
  syncDesktopGlobalWorkspaceRoots([globalStateFile], workspace);
  const globalState = JSON.parse(fs.readFileSync(globalStateFile, "utf8"));

  for (const key of ["electron-saved-workspace-roots", "project-order", "active-workspace-roots"]) {
    assert.deepEqual(globalState[key], [workspace]);
  }
});

test("registered paths keep persisted mobile workspaces even when list filters missing directories", () => {
  const root = tempRoot();
  const storageFile = path.join(root, "workspaces.json");
  const service = createWorkspaceRegistryService({
    storageFile,
    homeDir: root,
    createRoots: [root],
  });
  const result = service.create({ name: "Music" });
  fs.rmSync(result.workspace.cwd, { recursive: true, force: true });

  assert.deepEqual(service.list(), []);
  assert.deepEqual(service.registeredPaths(), [result.workspace.cwd]);
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
