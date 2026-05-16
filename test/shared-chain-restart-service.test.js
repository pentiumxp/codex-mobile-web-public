"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");

const {
  buildRestartPowerShellCommand,
  createSharedChainRestartService,
  psQuote,
} = require("../adapters/shared-chain-restart-service");

test("restart command targets the existing shared-chain restart script", () => {
  const command = buildRestartPowerShellCommand({
    delayMs: 1200,
    scriptPath: "C:\\repo\\restart-codex-mobile-shared-chain.ps1",
    taskName: "Codex Mobile Web",
    workspacePath: "C:\\repo",
    userProfilePath: "C:\\Users\\xuxin",
    port: 8787,
    maxWaitSeconds: 45,
  });

  assert.match(command, /Start-Sleep -Milliseconds 1200/);
  assert.match(command, /restart-codex-mobile-shared-chain\.ps1/);
  assert.match(command, /-TaskName 'Codex Mobile Web'/);
  assert.match(command, /-WorkspacePath 'C:\\repo'/);
  assert.match(command, /-UserProfilePath 'C:\\Users\\xuxin'/);
  assert.match(command, /-Port 8787/);
});

test("restart service spawns a detached hidden PowerShell process", () => {
  const root = path.resolve(__dirname, "..");
  let spawnCall = null;
  let unrefCalled = false;
  const service = createSharedChainRestartService({
    allowNonWindows: true,
    env: {
      SystemRoot: "C:\\Windows",
      USERPROFILE: path.join(root, ".tmp-user"),
    },
    fs: {
      existsSync: () => true,
    },
    spawn: (exe, args, options) => {
      spawnCall = { exe, args, options };
      return {
        pid: 12345,
        unref: () => {
          unrefCalled = true;
        },
      };
    },
    workspacePath: root,
    taskName: "Codex Mobile Web",
    port: 8787,
  });

  const result = service.restart({ delayMs: 900 });

  assert.equal(result.ok, true);
  assert.equal(result.restarting, true);
  assert.equal(result.restartInMs, 900);
  assert.equal(result.pid, 12345);
  assert.ok(unrefCalled);
  assert.match(spawnCall.exe, /powershell\.exe$/i);
  assert.deepEqual(spawnCall.args.slice(0, 5), ["-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden"]);
  assert.ok(spawnCall.args.includes("-EncodedCommand"));
  assert.equal(spawnCall.options.detached, true);
  assert.equal(spawnCall.options.stdio, "ignore");
  assert.equal(spawnCall.options.windowsHide, true);

  const encoded = spawnCall.args[spawnCall.args.indexOf("-EncodedCommand") + 1];
  const decoded = Buffer.from(encoded, "base64").toString("utf16le");
  assert.match(decoded, /restart-codex-mobile-shared-chain\.ps1/);
  assert.match(decoded, /-TaskName 'Codex Mobile Web'/);
});

test("PowerShell single-quote escaping doubles embedded quotes", () => {
  assert.equal(psQuote("Codex's Mobile"), "'Codex''s Mobile'");
});
