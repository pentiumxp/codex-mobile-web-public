const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const appEntryPath = path.join(root, "public", "app.js");

function appEntrySource() {
  return fs.readFileSync(appEntryPath, "utf8");
}

function runtimeStubs(counters) {
  return {
    CodexRuntimeWiringRuntime: {
      createRuntimeWiringRuntime() {
        return {
          initialize() {
            counters.initialize += 1;
          },
        };
      },
    },
    CodexAppShellRuntime: {
      createAppShellRuntime() {
        return {
          startCodexMobileAppWithRecovery() {
            counters.start += 1;
          },
        };
      },
    },
  };
}

test("app entry exposes a delayed startup API for Vite app-preview", () => {
  delete require.cache[require.resolve(appEntryPath)];
  const counters = { initialize: 0, start: 0 };
  global.window = runtimeStubs(counters);
  try {
    const appEntry = require(appEntryPath);
    assert.equal(typeof appEntry.createCodexMobileAppEntry, "function");
    assert.equal(typeof appEntry.startCodexMobileApp, "function");
    assert.equal(globalThis.CodexMobileAppEntry, appEntry);
    assert.deepEqual(counters, { initialize: 0, start: 0 });
    const runtime = appEntry.createCodexMobileAppEntry();
    runtime.startCodexMobileApp();
    assert.deepEqual(counters, { initialize: 1, start: 1 });
  } finally {
    delete global.window;
    delete global.CodexMobileAppEntry;
    delete require.cache[require.resolve(appEntryPath)];
  }
});

test("app entry does not auto-start when imported by Vite app-preview ESM", () => {
  const counters = { initialize: 0, start: 0 };
  const context = {
    ...runtimeStubs(counters),
    document: {
      currentScript: null,
    },
    __CODEX_MOBILE_VITE_APP_PREVIEW_PAGE__: true,
  };
  context.globalThis = context;
  context.window = context;
  vm.runInNewContext(appEntrySource(), context, { filename: "app.js" });
  assert.equal(typeof context.CodexMobileAppEntry.createCodexMobileAppEntry, "function");
  assert.equal(typeof context.CodexMobileAppEntry.startCodexMobileApp, "function");
  assert.deepEqual(counters, { initialize: 0, start: 0 });
  context.CodexMobileAppEntry.startCodexMobileApp();
  assert.deepEqual(counters, { initialize: 1, start: 1 });
});

test("Vite app-preview starts the excluded app entry after classic loader scripts", () => {
  const source = fs.readFileSync(path.join(root, "frontend", "vite-shell-entry.mjs"), "utf8");
  assert.match(source, /__CODEX_MOBILE_VITE_APP_PREVIEW_PAGE__/);
  assert.match(source, /excludedEsmAssets\.includes\("\/app\.js"\)/);
  assert.match(source, /CodexMobileAppEntry/);
  assert.match(source, /startCodexMobileApp\(\)/);
});
