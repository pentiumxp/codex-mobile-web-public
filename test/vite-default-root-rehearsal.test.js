"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const { test } = require("node:test");

const {
  createViteDefaultRootRehearsalService,
  parseArgs,
  runRehearsal,
} = require("../scripts/codex-mobile-vite-default-root-rehearsal");

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      const address = server.address();
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

function close(server, service) {
  if (service && typeof service.closeEventClients === "function") service.closeEventClients();
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}

test("Vite default-root rehearsal service serves app-preview at plain root", async () => {
  const service = createViteDefaultRootRehearsalService();
  const server = http.createServer(service.handleRequest);
  const baseUrl = await listen(server);
  try {
    const configResponse = await fetch(`${baseUrl}/api/public-config`);
    const config = await configResponse.json();
    assert.equal(configResponse.status, 200);
    assert.equal(config.defaultShellMode, "vite-app-preview");
    assert.equal(config.authRequired, false);
    assert.match(config.clientBuildId, /^0\.1\.11\|codex-mobile-shell-/);

    const rootResponse = await fetch(`${baseUrl}/`);
    const rootHtml = await rootResponse.text();
    assert.equal(rootResponse.status, 200);
    assert.match(rootHtml, /data-codex-vite-app-preview="true"/);
    assert.match(rootHtml, /id="codex-vite-app-preview-loader-plan"/);
    assert.doesNotMatch(rootHtml, /CODEX_MOBILE_SHELL_SCRIPTS:BEGIN/);
  } finally {
    await close(server, service);
  }
});

test("Vite default-root rehearsal runs bounded browser default-root probe", async () => {
  let browserOptions = null;
  const result = await runRehearsal({
    browserTimeoutMs: 12345,
  }, {
    async runBrowserSelfCheck(options, deps) {
      browserOptions = options;
      assert.deepEqual(deps, { key: "" });
      return {
        ok: true,
        mode: "vite-app-preview-default-root",
        publicConfig: {
          clientBuildId: "0.1.11|codex-mobile-shell-v625",
          shellCacheName: "codex-mobile-shell-v625",
          defaultShellMode: "vite-app-preview",
        },
        browserReport: {
          issueCount: 0,
          blockingIssueCount: 0,
          issues: [],
        },
        viteAppPreview: {
          path: "/",
          rootPathPreserved: true,
          rootViteShellParamAbsent: true,
          loaderPlanPresent: true,
          loaderPlanOwner: "vite-shell-entry",
          loaderPlanMatchesShellScripts: true,
          loaderLoadedCount: 51,
          loaderFailedCount: 0,
          appVisible: true,
          composerRuntimeReady: true,
          threadListRuntimeReady: true,
          threadTileRuntimeReady: true,
          loadThreadReady: true,
        },
      };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.mode, "vite-default-root-rehearsal");
  assert.equal(result.publicConfig.defaultShellMode, "vite-app-preview");
  assert.equal(result.summary.blockingIssueCount, 0);
  assert.equal(result.browser.rootPathPreserved, true);
  assert.equal(result.browser.rootViteShellParamAbsent, true);
  assert.equal(browserOptions.viteAppPreviewOnly, true);
  assert.equal(browserOptions.viteAppPreviewDefaultRoot, true);
  assert.equal(browserOptions.timeoutMs, 12345);
  assert.match(browserOptions.server, /^http:\/\/127\.0\.0\.1:\d+\/$/);
});

test("Vite default-root rehearsal argument parser keeps browser skip bounded", () => {
  const options = parseArgs([
    "--host",
    "127.0.0.1",
    "--port",
    "9001",
    "--browser-timeout-ms",
    "30000",
    "--skip-browser",
    "--json",
  ]);

  assert.equal(options.host, "127.0.0.1");
  assert.equal(options.port, 9001);
  assert.equal(options.browserTimeoutMs, 30000);
  assert.equal(options.skipBrowser, true);
  assert.equal(options.json, true);
});
