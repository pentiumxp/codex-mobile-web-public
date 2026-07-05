const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { pathToFileURL } = require("node:url");

const root = path.resolve(__dirname, "..");
const appEntryPath = path.join(root, "public", "app.js");
const nativeAppEntryPath = path.join(root, "frontend", "native", "app-entry.mjs");

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
            return "startup-result";
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
    assert.equal(runtime.startCodexMobileApp(), "startup-result");
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
  assert.equal(context.CodexMobileAppEntry.startCodexMobileApp(), "startup-result");
  assert.deepEqual(counters, { initialize: 1, start: 1 });
});

test("native app entry does not auto-start on Vite shell preview artifact page", async () => {
  const counters = { initialize: 0, start: 0 };
  const previous = {
    document: globalThis.document,
    window: globalThis.window,
    CodexRuntimeWiringRuntime: globalThis.CodexRuntimeWiringRuntime,
    CodexAppShellRuntime: globalThis.CodexAppShellRuntime,
    CodexMobileAppEntry: globalThis.CodexMobileAppEntry,
    __CODEX_MOBILE_VITE_APP_PREVIEW_PAGE__: globalThis.__CODEX_MOBILE_VITE_APP_PREVIEW_PAGE__,
  };
  Object.assign(globalThis, runtimeStubs(counters), {
    document: {
      currentScript: null,
      getElementById(id) {
        return id === "codex-vite-shell-preview" ? { id } : null;
      },
    },
    window: globalThis,
    __CODEX_MOBILE_VITE_APP_PREVIEW_PAGE__: false,
  });
  try {
    const moduleUrl = `${pathToFileURL(nativeAppEntryPath).href}?test=${Date.now()}-${Math.random()}`;
    const appEntry = await import(moduleUrl);
    assert.equal(typeof appEntry.createCodexMobileAppEntry, "function");
    assert.equal(typeof appEntry.startCodexMobileApp, "function");
    assert.equal(globalThis.CodexMobileAppEntry, appEntry.default);
    assert.deepEqual(counters, { initialize: 0, start: 0 });
    assert.equal(globalThis.CodexMobileAppEntry.startCodexMobileApp(), "startup-result");
    assert.deepEqual(counters, { initialize: 1, start: 1 });
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
});

test("Vite app-preview starts the excluded app entry after classic loader scripts", () => {
  const source = fs.readFileSync(path.join(root, "frontend", "vite-shell-entry.mjs"), "utf8");
  assert.match(source, /__CODEX_MOBILE_VITE_APP_PREVIEW_PAGE__/);
  assert.match(source, /excludedEsmAssets\.includes\("\/app\.js"\)/);
  assert.match(source, /CodexMobileAppEntry/);
  assert.match(source, /startViteAppPreviewApp\(status, appEntry\)/);
  assert.match(source, /__CODEX_MOBILE_VITE_APP_PREVIEW_APP_START_PROMISE__/);
  assert.doesNotMatch(source, /await appEntry\.startCodexMobileApp\(\)/);
});
