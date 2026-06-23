"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  classifyWorkspaceSourceWriteRequest,
  commandLooksTrustedHomeAiTool,
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

function tempHomeAiRoot() {
  const root = tempProjectRoot("homeai");
  fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs", "PLATFORM_CONTRACTS"), { recursive: true });
  fs.writeFileSync(path.join(root, "scripts", "ai-ops-control-plane.js"), "", "utf8");
  fs.writeFileSync(path.join(root, "scripts", "deploy-macos-production.js"), "", "utf8");
  fs.writeFileSync(path.join(root, "scripts", "plugin-workspace-platform-contract-check.js"), "", "utf8");
  fs.writeFileSync(path.join(root, "docs", "PLATFORM_CONTRACTS", "plugin-workspace-platform-contract.md"), "", "utf8");
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

test("workspace source write guard allows foreign tool workspace commands that do not write source", () => {
  const current = tempProjectRoot("current");
  const foreign = tempProjectRoot("foreign");

  const playwrightDecision = classifyWorkspaceSourceWriteRequest({
    method: "item/commandExecution/requestApproval",
    params: {
      cwd: foreign,
      command: [
        "node -e '",
        "import { chromium } from \"playwright\";",
        "const page = await browser.newPage();",
        "const info = await page.evaluate(() => ({ ok: true }));",
        "await page.screenshot({ path: \"/private/tmp/music-demo-menu-fix.png\" });",
        "console.log(JSON.stringify(info));",
        "'",
      ].join("\n"),
    },
  }, {
    currentCwd: current,
    workspaceRoots: [current, foreign],
  });
  assert.equal(playwrightDecision.action, "allow");
  assert.equal(playwrightDecision.reason, "read_or_non_write_command");

  const tmpWriteDecision = classifyWorkspaceSourceWriteRequest({
    method: "item/commandExecution/requestApproval",
    params: {
      cwd: foreign,
      command: "node -e 'require(\"fs\").writeFileSync(\"/private/tmp/tool-output.json\", \"{}\")'",
    },
  }, {
    currentCwd: current,
    workspaceRoots: [current, foreign],
  });
  assert.equal(tmpWriteDecision.action, "allow");
  assert.equal(tmpWriteDecision.reason, "write_command_without_foreign_source");

  const relativeSourceWriteDecision = classifyWorkspaceSourceWriteRequest({
    method: "item/commandExecution/requestApproval",
    params: {
      cwd: foreign,
      command: "node -e 'require(\"fs\").writeFileSync(\"src/app.js\", \"changed\")'",
    },
  }, {
    currentCwd: current,
    workspaceRoots: [current, foreign],
  });
  assert.equal(relativeSourceWriteDecision.action, "deny");
  assert.equal(relativeSourceWriteDecision.reason, "foreign_source_write_command_cwd");

  fs.rmSync(current, { recursive: true, force: true });
  fs.rmSync(foreign, { recursive: true, force: true });
});

test("workspace source write guard allows trusted Home AI tools but denies direct Home AI source writes", () => {
  const current = tempProjectRoot("current");
  const homeAi = tempHomeAiRoot();

  assert.equal(commandLooksTrustedHomeAiTool("npm run --silent deploy:macos -- --plugin music", homeAi), true);
  assert.equal(commandLooksTrustedHomeAiTool("npm run --silent deploy:macos -- --plugin music && git status", homeAi), false);

  const deployDecision = classifyWorkspaceSourceWriteRequest({
    method: "item/commandExecution/requestApproval",
    params: {
      cwd: homeAi,
      command: "npm run --silent deploy:macos -- --plugin music --source /tmp/music --execute --json",
    },
  }, {
    currentCwd: current,
    workspaceRoots: [current, homeAi],
  });
  assert.equal(deployDecision.action, "allow");
  assert.equal(deployDecision.reason, "trusted_home_ai_tool_command");

  const gitDecision = classifyWorkspaceSourceWriteRequest({
    method: "item/commandExecution/requestApproval",
    params: {
      cwd: homeAi,
      command: "git add adapters/gateway-run-instruction-service.js && git commit -m update",
    },
  }, {
    currentCwd: current,
    workspaceRoots: [current, homeAi],
  });
  assert.equal(gitDecision.action, "deny");
  assert.equal(gitDecision.reason, "foreign_source_write_command_cwd");

  const patchDecision = classifyWorkspaceSourceWriteRequest({
    method: "applyPatchApproval",
    params: {
      cwd: current,
      fileChanges: {
        [path.join(homeAi, "mobile-server-runtime.js")]: { type: "modify" },
      },
    },
  }, {
    currentCwd: current,
    workspaceRoots: [current, homeAi],
  });
  assert.equal(patchDecision.action, "deny");
  assert.equal(patchDecision.reason, "foreign_source_file_change");

  fs.rmSync(current, { recursive: true, force: true });
  fs.rmSync(homeAi, { recursive: true, force: true });
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
