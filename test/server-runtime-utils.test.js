"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { createServerRuntimeUtils } = require("../services/runtime/server-runtime-utils");

function fakeFs(executablePaths = []) {
  const executables = new Set(executablePaths);
  return {
    constants: { X_OK: 1 },
    accessSync(filePath) {
      if (!executables.has(filePath)) {
        const err = new Error("not found");
        err.code = "ENOENT";
        throw err;
      }
    },
    existsSync(filePath) {
      return executables.has(filePath);
    },
    statSync(filePath) {
      if (!executables.has(filePath)) {
        const err = new Error("not found");
        err.code = "ENOENT";
        throw err;
      }
      return {
        isDirectory: () => false,
        isFile: () => true,
        size: 0,
        mtimeMs: 1,
      };
    },
    readFileSync() {
      throw new Error("not implemented");
    },
  };
}

test("runtime resolver prefers ChatGPT bundled Codex CLI over older PATH codex", () => {
  const bundledCodex = "/Applications/ChatGPT.app/Contents/Resources/codex";
  const pathCodex = "/home/tester/.local/bin/codex";
  const utils = createServerRuntimeUtils({
    fs: fakeFs([bundledCodex, pathCodex]),
    path,
    env: { PATH: "/home/tester/.local/bin" },
    userHome: "/home/tester",
  });

  assert.equal(utils.resolveDefaultCodexExecutable(), bundledCodex);
});

test("runtime resolver keeps explicit Codex executable override authoritative", () => {
  const explicitCodex = "/custom/codex";
  const bundledCodex = "/Applications/ChatGPT.app/Contents/Resources/codex";
  const utils = createServerRuntimeUtils({
    fs: fakeFs([explicitCodex, bundledCodex]),
    path,
    env: {
      CODEX_MOBILE_CODEX_EXE: explicitCodex,
      PATH: "",
    },
    userHome: "/home/tester",
  });

  assert.equal(utils.resolveDefaultCodexExecutable(), explicitCodex);
});

test("runtime resolver falls back to PATH codex when bundled CLI is absent", () => {
  const pathCodex = "/home/tester/.local/bin/codex";
  const utils = createServerRuntimeUtils({
    fs: fakeFs([pathCodex]),
    path,
    env: { PATH: "/home/tester/.local/bin" },
    userHome: "/home/tester",
  });

  assert.equal(utils.resolveDefaultCodexExecutable(), pathCodex);
});
