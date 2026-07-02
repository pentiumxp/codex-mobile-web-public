"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const service = require(path.join(__dirname, "..", "services", "runtime", "browser-runtime-self-check-service.js"));
const adapter = require(path.join(__dirname, "..", "adapters", "browser-runtime-self-check-service.js"));
const script = require(path.join(__dirname, "..", "scripts", "codex-mobile-browser-runtime-self-check.js"));
const scriptSource = fs.readFileSync(path.join(__dirname, "..", "scripts", "codex-mobile-browser-runtime-self-check.js"), "utf8");
const viteEsmCompatibilityReady = {
  esmCompatibilityReady: true,
  esmCompatibilityOwner: "vite-shell-entry",
  esmCompatibilityModuleCount: 6,
  esmCompatibilityReadyCount: 6,
  esmCompatibilityExpectedCount: 6,
};
const viteEsmCompatibilityMissing = {
  esmCompatibilityReady: false,
  esmCompatibilityOwner: "",
  esmCompatibilityModuleCount: 0,
  esmCompatibilityReadyCount: 0,
  esmCompatibilityExpectedCount: 6,
};

test("browser runtime self-check adapter re-exports canonical runtime service", () => {
  assert.equal(adapter.analyzeBrowserRuntimeSamples, service.analyzeBrowserRuntimeSamples);
  assert.equal(adapter.safeThreadRows, service.safeThreadRows);
});

test("browser runtime self-check parses startup-only listener smoke option", () => {
  const options = script.parseArgs(["--server", "http://127.0.0.1:8787", "--startup-only", "--json"]);
  assert.equal(options.startupOnly, true);
  assert.equal(options.json, true);
});

test("browser runtime self-check parses Vite preview-only smoke option", () => {
  const options = script.parseArgs(["--server", "http://127.0.0.1:8787", "--vite-preview-only", "--json"]);
  assert.equal(options.vitePreviewOnly, true);
  assert.equal(options.json, true);
});

test("browser runtime self-check parses Vite app-preview-only smoke option", () => {
  const options = script.parseArgs(["--server", "http://127.0.0.1:8787", "--vite-app-preview-only", "--json"]);
  assert.equal(options.viteAppPreviewOnly, true);
  assert.equal(options.json, true);
});

test("browser runtime self-check parses Vite app-preview full runtime option", () => {
  const options = script.parseArgs(["--server", "http://127.0.0.1:8787", "--vite-app-preview-runtime", "--json"]);
  assert.equal(options.viteAppPreviewRuntime, true);
  assert.equal(options.json, true);
});

test("browser runtime self-check parses Vite app-preview root-path option", () => {
  const options = script.parseArgs(["--server", "http://127.0.0.1:8787", "--vite-app-preview-only", "--vite-app-preview-root", "--json"]);
  assert.equal(options.viteAppPreviewOnly, true);
  assert.equal(options.viteAppPreviewRoot, true);
  assert.equal(options.json, true);
});

test("browser runtime self-check parses Vite app-preview default-root option", () => {
  const options = script.parseArgs(["--server", "http://127.0.0.1:8787", "--vite-app-preview-only", "--vite-app-preview-default-root", "--json"]);
  assert.equal(options.viteAppPreviewOnly, true);
  assert.equal(options.viteAppPreviewDefaultRoot, true);
  assert.equal(options.json, true);
});

test("browser runtime self-check parses Vite app-preview Hermes embed option", () => {
  const options = script.parseArgs(["--server", "http://127.0.0.1:8787", "--vite-app-preview-only", "--vite-app-preview-embed", "--json"]);
  assert.equal(options.viteAppPreviewOnly, true);
  assert.equal(options.viteAppPreviewEmbed, true);
  assert.equal(options.json, true);
});

test("browser runtime self-check parses Vite app-preview launch session option", () => {
  const options = script.parseArgs(["--server", "http://127.0.0.1:8787", "--vite-app-preview-only", "--vite-app-preview-launch-session", "--json"]);
  assert.equal(options.viteAppPreviewOnly, true);
  assert.equal(options.viteAppPreviewLaunchSession, true);
  assert.equal(options.json, true);
});

test("browser runtime self-check preserves bounded default shell mode in public config summary", () => {
  assert.match(scriptSource, /defaultShellMode: String\(config && config\.defaultShellMode \|\| ""\)\.slice\(0, 40\)/);
});

test("browser runtime self-check samples active thread rows before recent rows", () => {
  assert.deepEqual(script.selectThreadIdsForSampling([
    { id: "recent-completed", status: "completed" },
    { id: "active-old", status: "active" },
    { id: "running-old", status: { type: "in_progress" } },
    { id: "active-old", status: "active" },
    { id: "queued-thread", threadStatus: "queued" },
    { id: "other-completed", status: "completed" },
  ], 4), [
    "active-old",
    "running-old",
    "queued-thread",
    "recent-completed",
  ]);
});

test("browser runtime self-check reports API latest turn when it is not the DOM bottom turn", () => {
  const result = service.analyzeBrowserRuntimeSamples({
    minSettledDelayMs: 1000,
    samples: [{
      label: "settled",
      threadHash: "thread-a",
      delayMs: 1500,
      appVisible: true,
      loginVisible: false,
      targetConfirmed: true,
      contentConfirmed: true,
      turns: 20,
      items: 80,
      expectedTurnHashCount: 10,
      expectedTurnMatchCount: 10,
      latestTurnMatchesTarget: true,
      latestTurnHash: "expected-latest",
      actualLatestTurnHash: "stale-bottom",
      latestTurnAtDomBottom: false,
      latestTurnDomIndex: 18,
    }],
  });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "browser_latest_turn_not_at_dom_bottom"));
});

test("browser runtime self-check reports API latest turn when it is missing from settled DOM", () => {
  const result = service.analyzeBrowserRuntimeSamples({
    minSettledDelayMs: 1000,
    samples: [{
      label: "settled",
      threadHash: "thread-a",
      delayMs: 1500,
      appVisible: true,
      loginVisible: false,
      targetConfirmed: true,
      contentConfirmed: false,
      turns: 20,
      items: 80,
      expectedTurnHashCount: 10,
      expectedTurnMatchCount: 9,
      latestTurnMatchesTarget: false,
      expectedLatestTurnHash: "expected-latest",
      actualLatestTurnHash: "stale-bottom",
      latestTurnHash: "stale-bottom",
      latestTurnAtDomBottom: false,
      latestTurnDomIndex: 19,
    }],
  });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "browser_latest_turn_missing_from_dom"));
});

test("browser runtime self-check blocks stuck refresh activity after latest turn reaches DOM bottom", () => {
  const result = service.analyzeBrowserRuntimeSamples({
    minSettledDelayMs: 1000,
    samples: [{
      label: "settled",
      threadHash: "thread-a",
      delayMs: 1800,
      appVisible: true,
      loginVisible: false,
      targetConfirmed: true,
      contentConfirmed: true,
      turns: 8,
      items: 40,
      expectedTurnHashCount: 8,
      expectedTurnMatchCount: 8,
      latestTurnMatchesTarget: true,
      expectedLatestTurnHash: "latest",
      latestTurnHash: "latest",
      actualLatestTurnHash: "latest",
      latestTurnAtDomBottom: true,
      turnTimerVisible: true,
      turnTimerActive: true,
      turnTimerDetailKind: "refreshing-thread",
      connectionStateKind: "connected",
    }],
  });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "browser_thread_detail_activity_status_stuck"));
});

test("browser runtime self-check blocks settled initial sparse target before later nonempty content", () => {
  const result = service.analyzeBrowserRuntimeSamples({
    minSettledDelayMs: 1000,
    samples: [
      {
        label: "initial-settled",
        threadHash: "thread-a",
        delayMs: 1400,
        appVisible: true,
        loginVisible: false,
        targetConfirmed: false,
        contentConfirmed: false,
        turns: 0,
        items: 0,
        expectedTurnHashCount: 8,
      },
      {
        label: "later",
        threadHash: "thread-a",
        delayMs: 3000,
        appVisible: true,
        loginVisible: false,
        targetConfirmed: true,
        contentConfirmed: true,
        turns: 8,
        items: 36,
        expectedTurnHashCount: 8,
      },
    ],
  });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "browser_dom_initial_sparse_before_nonempty"));
});

test("browser runtime self-check catches DOM turn timestamp order regressions", () => {
  const result = service.analyzeBrowserRuntimeSamples({
    minSettledDelayMs: 1000,
    samples: [{
      label: "settled",
      threadHash: "thread-a",
      delayMs: 1500,
      appVisible: true,
      loginVisible: false,
      targetConfirmed: true,
      contentConfirmed: true,
      turns: 2,
      items: 8,
      expectedTurnHashCount: 2,
      latestTurnMatchesTarget: true,
      latestTurnAtDomBottom: true,
      domTurnShapes: [
        { index: 0, turnHash: "older-dom", itemCount: 4, firstTimestampMs: 20000, lastTimestampMs: 30000 },
        { index: 1, turnHash: "bottom-dom", itemCount: 4, firstTimestampMs: 10000, lastTimestampMs: 12000 },
      ],
    }],
  });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "browser_dom_turn_timestamp_order_mismatch"));
});

test("browser runtime self-check analyzes Vite preview module readiness", () => {
  const passing = script.analyzeVitePreviewProbe({
    markerVisible: true,
    stage: "vite-shell-preview-html-v1",
    sourceBuildStage: "vite-shell-artifact-contract-v1",
    productionExecution: "classic-script-fallback",
    clientBuildMatches: true,
    shellCacheMatches: true,
    moduleScriptMatchesPreview: true,
    moduleEntryLoaded: true,
    entryTopologyReady: true,
    entryGroupImportOwnerOk: true,
    classicShellScriptBlockCount: 51,
    classicShellScriptBlockHashPresent: true,
    startupGlobalContractMarkerCount: 8,
    entryDynamicImportOwnerOk: true,
    entryDynamicImportDeferredSourceCount: 1,
    entryDynamicImportEntryGroupCountMatches: true,
    startupCriticalPreloadsMatch: true,
    startupCriticalAssetStatusOk: true,
    entryGroupChunkPreloadsMatch: true,
    entryGroupChunkStatusOk: true,
    entryGroupChunkExecutionOk: true,
    entryGroupClassicCoverageOk: true,
    classicCompatibilityReady: true,
    classicCompatibilityStartupGlobalsReady: true,
    classicCompatibilityStartupGlobalContractReady: true,
    ...viteEsmCompatibilityReady,
    deferredLoaded: true,
  }, { consoleEvents: [], exceptions: [] });
  assert.equal(passing.ok, true);
  assert.equal(passing.issueCount, 0);

  const failing = script.analyzeVitePreviewProbe({
    markerVisible: true,
    stage: "wrong",
    sourceBuildStage: "vite-shell-artifact-contract-v1",
    productionExecution: "classic-script-fallback",
    clientBuildMatches: true,
    shellCacheMatches: true,
    moduleScriptMatchesPreview: false,
    moduleEntryLoaded: false,
    entryTopologyReady: false,
    entryGroupImportOwnerOk: false,
    classicShellScriptBlockCount: 0,
    classicShellScriptBlockHashPresent: false,
    startupGlobalContractMarkerCount: 0,
    entryDynamicImportOwnerOk: false,
    entryDynamicImportDeferredSourceCount: 0,
    entryDynamicImportEntryGroupCountMatches: false,
    startupCriticalPreloadsMatch: false,
    startupCriticalAssetStatusOk: false,
    entryGroupChunkPreloadsMatch: false,
    entryGroupChunkStatusOk: false,
    entryGroupChunkExecutionOk: false,
    entryGroupClassicCoverageOk: false,
    classicCompatibilityReady: false,
    classicCompatibilityStartupGlobalsReady: false,
    classicCompatibilityStartupGlobalContractReady: false,
    ...viteEsmCompatibilityMissing,
    deferredLoaded: false,
  }, { consoleEvents: [{ type: "error" }], exceptions: [{ code: "runtime_exception" }] });
  assert.equal(failing.ok, false);
  assert.ok(failing.issues.some((issue) => issue.code === "vite_preview_stage_mismatch"));
  assert.ok(failing.issues.some((issue) => issue.code === "vite_preview_module_entry_missing"));
  assert.ok(failing.issues.some((issue) => issue.code === "vite_preview_entry_group_import_owner_mismatch"));
  assert.ok(failing.issues.some((issue) => issue.code === "vite_preview_classic_script_block_contract_missing"));
  assert.ok(failing.issues.some((issue) => issue.code === "vite_preview_entry_dynamic_import_graph_mismatch"));
  assert.ok(failing.issues.some((issue) => issue.code === "vite_preview_startup_preload_mismatch"));
  assert.ok(failing.issues.some((issue) => issue.code === "vite_preview_startup_asset_fetch_failed"));
  assert.ok(failing.issues.some((issue) => issue.code === "vite_preview_entry_group_chunk_preload_mismatch"));
  assert.ok(failing.issues.some((issue) => issue.code === "vite_preview_entry_group_chunk_fetch_failed"));
  assert.ok(failing.issues.some((issue) => issue.code === "vite_preview_entry_group_chunk_not_executed"));
  assert.ok(failing.issues.some((issue) => issue.code === "vite_preview_entry_group_classic_coverage_mismatch"));
  assert.ok(failing.issues.some((issue) => issue.code === "vite_preview_classic_compatibility_missing"));
  assert.ok(failing.issues.some((issue) => issue.code === "vite_preview_classic_startup_globals_missing"));
  assert.ok(failing.issues.some((issue) => issue.code === "vite_preview_classic_startup_global_contract_mismatch"));
  assert.ok(failing.issues.some((issue) => issue.code === "vite_preview_esm_compatibility_missing"));
  assert.ok(failing.issues.some((issue) => issue.code === "vite_preview_browser_exception"));
});

test("browser runtime self-check analyzes Vite app-preview startup readiness", () => {
  const passing = script.analyzeViteAppPreviewProbe({
    markerPresent: true,
    metaPresent: true,
    moduleScriptMatchesPreview: true,
    loaderOk: true,
    classicScriptCount: 51,
    expectedClassicScriptCount: 51,
    classicScriptOrderMatches: true,
    loaderPlanPresent: true,
    loaderPlanOwnerOk: true,
    loaderPlanHashPresent: true,
    loaderPlanScriptCount: 51,
    loaderPlanHashCount: 51,
    loaderPlanMatchesShellScripts: true,
    loaderPlanMatchesInjectedScripts: true,
    loaderPlanLoadedMatches: true,
    ...viteEsmCompatibilityReady,
    rootPreviewExpected: true,
    rootPathPreserved: true,
    rootViteShellParamPresent: true,
    clientBuildMatches: true,
    shellCacheMatches: true,
    appVisible: true,
    bootRecoveryVisible: false,
    composerRuntimeReady: true,
    threadListRuntimeReady: true,
    threadTileRuntimeReady: true,
    loadThreadReady: true,
  }, { consoleEvents: [], exceptions: [] }, { expectRoot: true });
  assert.equal(passing.ok, true);
  assert.equal(passing.issueCount, 0);

  const failing = script.analyzeViteAppPreviewProbe({
    markerPresent: false,
    metaPresent: false,
    moduleScriptMatchesPreview: false,
    ...viteEsmCompatibilityMissing,
    loaderOk: false,
    loaderTimedOut: true,
    loaderErrorCode: "timeout",
    rootPreviewExpected: true,
    rootPathPreserved: false,
    rootViteShellParamPresent: false,
    classicScriptCount: 1,
    expectedClassicScriptCount: 51,
    classicScriptOrderMatches: false,
    clientBuildMatches: false,
    shellCacheMatches: false,
    appVisible: false,
    bootRecoveryVisible: true,
    composerRuntimeReady: false,
    threadListRuntimeReady: true,
    threadTileRuntimeReady: false,
    loadThreadReady: false,
  }, { consoleEvents: [{ type: "error" }], exceptions: [{ code: "runtime_exception" }] }, { expectRoot: true });
  assert.equal(failing.ok, false);
  assert.ok(failing.issues.some((issue) => issue.code === "vite_app_preview_marker_missing"));
  assert.ok(failing.issues.some((issue) => issue.code === "vite_app_preview_module_entry_missing"));
  assert.ok(failing.issues.some((issue) => issue.code === "vite_app_preview_classic_loader_plan_missing"));
  assert.ok(failing.issues.some((issue) => issue.code === "vite_app_preview_classic_loader_plan_mismatch"));
  assert.ok(failing.issues.some((issue) => issue.code === "vite_app_preview_esm_compatibility_missing"));
  assert.ok(failing.issues.some((issue) => issue.code === "vite_app_preview_loader_failed"));
  assert.ok(failing.issues.some((issue) => issue.code === "vite_app_preview_classic_script_order_mismatch"));
  assert.ok(failing.issues.some((issue) => issue.code === "vite_app_preview_client_build_mismatch"));
  assert.ok(failing.issues.some((issue) => issue.code === "vite_app_preview_shell_cache_mismatch"));
  assert.ok(failing.issues.some((issue) => issue.code === "vite_app_preview_root_path_changed"));
  assert.ok(failing.issues.some((issue) => issue.code === "vite_app_preview_root_opt_in_missing"));
  assert.ok(failing.issues.some((issue) => issue.code === "vite_app_preview_app_not_visible"));
  assert.ok(failing.issues.some((issue) => issue.code === "vite_app_preview_boot_recovery_visible"));
  assert.ok(failing.issues.some((issue) => issue.code === "vite_app_preview_runtime_missing"));
  assert.ok(failing.issues.some((issue) => issue.code === "vite_app_preview_browser_exception"));
  assert.ok(failing.issues.some((issue) => issue.code === "vite_app_preview_console_error"));
});

test("browser runtime self-check analyzes Vite app-preview default-root readiness", () => {
  const passing = script.analyzeViteAppPreviewProbe({
    markerPresent: true,
    metaPresent: true,
    moduleScriptMatchesPreview: true,
    loaderOk: true,
    classicScriptCount: 51,
    expectedClassicScriptCount: 51,
    classicScriptOrderMatches: true,
    loaderPlanPresent: true,
    loaderPlanOwnerOk: true,
    loaderPlanHashPresent: true,
    loaderPlanScriptCount: 51,
    loaderPlanHashCount: 51,
    loaderPlanMatchesShellScripts: true,
    loaderPlanMatchesInjectedScripts: true,
    loaderPlanLoadedMatches: true,
    ...viteEsmCompatibilityReady,
    rootPreviewExpected: true,
    defaultRootPreviewExpected: true,
    rootPathPreserved: true,
    rootViteShellParamPresent: false,
    rootViteShellParamAbsent: true,
    clientBuildMatches: true,
    shellCacheMatches: true,
    appVisible: true,
    bootRecoveryVisible: false,
    composerRuntimeReady: true,
    threadListRuntimeReady: true,
    threadTileRuntimeReady: true,
    loadThreadReady: true,
  }, { consoleEvents: [], exceptions: [] }, { expectRoot: true, expectDefaultRoot: true });
  assert.equal(passing.ok, true);
  assert.equal(passing.issueCount, 0);

  const failing = script.analyzeViteAppPreviewProbe({
    markerPresent: true,
    metaPresent: true,
    moduleScriptMatchesPreview: true,
    loaderOk: true,
    classicScriptCount: 51,
    expectedClassicScriptCount: 51,
    classicScriptOrderMatches: true,
    loaderPlanPresent: true,
    loaderPlanOwnerOk: true,
    loaderPlanHashPresent: true,
    loaderPlanScriptCount: 51,
    loaderPlanHashCount: 51,
    loaderPlanMatchesShellScripts: true,
    loaderPlanMatchesInjectedScripts: true,
    loaderPlanLoadedMatches: true,
    ...viteEsmCompatibilityReady,
    rootPreviewExpected: true,
    defaultRootPreviewExpected: true,
    rootPathPreserved: true,
    rootViteShellParamPresent: true,
    rootViteShellParamAbsent: false,
    clientBuildMatches: true,
    shellCacheMatches: true,
    appVisible: true,
    bootRecoveryVisible: false,
    composerRuntimeReady: true,
    threadListRuntimeReady: true,
    threadTileRuntimeReady: true,
    loadThreadReady: true,
  }, { consoleEvents: [], exceptions: [] }, { expectRoot: true, expectDefaultRoot: true });
  assert.equal(failing.ok, false);
  assert.ok(failing.issues.some((issue) => issue.code === "vite_app_preview_default_root_opt_in_present"));
});

test("browser runtime self-check analyzes Vite app-preview Hermes embed startup readiness", () => {
  const passing = script.analyzeViteAppPreviewProbe({
    markerPresent: true,
    metaPresent: true,
    moduleScriptMatchesPreview: true,
    loaderOk: true,
    classicScriptCount: 51,
    expectedClassicScriptCount: 51,
    classicScriptOrderMatches: true,
    loaderPlanPresent: true,
    loaderPlanOwnerOk: true,
    loaderPlanHashPresent: true,
    loaderPlanScriptCount: 51,
    loaderPlanHashCount: 51,
    loaderPlanMatchesShellScripts: true,
    loaderPlanMatchesInjectedScripts: true,
    loaderPlanLoadedMatches: true,
    ...viteEsmCompatibilityReady,
    embedExpected: true,
    embedQueryPresent: true,
    embedHtmlClassPresent: true,
    pluginEmbedApiReady: true,
    initialPluginEmbedEmbedded: true,
    pluginModeLocalKeySuppressed: true,
    clientBuildMatches: true,
    shellCacheMatches: true,
    appVisible: true,
    bootRecoveryVisible: false,
    composerRuntimeReady: true,
    threadListRuntimeReady: true,
    threadTileRuntimeReady: true,
    loadThreadReady: true,
  }, { consoleEvents: [], exceptions: [] }, { expectEmbed: true });
  assert.equal(passing.ok, true);
  assert.equal(passing.issueCount, 0);

  const failing = script.analyzeViteAppPreviewProbe({
    markerPresent: true,
    metaPresent: true,
    moduleScriptMatchesPreview: true,
    loaderOk: true,
    classicScriptCount: 51,
    expectedClassicScriptCount: 51,
    classicScriptOrderMatches: true,
    loaderPlanPresent: true,
    loaderPlanOwnerOk: true,
    loaderPlanHashPresent: true,
    loaderPlanScriptCount: 51,
    loaderPlanHashCount: 51,
    loaderPlanMatchesShellScripts: true,
    loaderPlanMatchesInjectedScripts: true,
    loaderPlanLoadedMatches: true,
    ...viteEsmCompatibilityReady,
    embedExpected: true,
    embedQueryPresent: false,
    embedHtmlClassPresent: false,
    pluginEmbedApiReady: false,
    initialPluginEmbedEmbedded: false,
    pluginModeLocalKeySuppressed: false,
    clientBuildMatches: true,
    shellCacheMatches: true,
    appVisible: true,
    bootRecoveryVisible: false,
    composerRuntimeReady: true,
    threadListRuntimeReady: true,
    threadTileRuntimeReady: true,
    loadThreadReady: true,
  }, { consoleEvents: [], exceptions: [] }, { expectEmbed: true });
  assert.equal(failing.ok, false);
  assert.ok(failing.issues.some((issue) => issue.code === "vite_app_preview_embed_query_missing"));
  assert.ok(failing.issues.some((issue) => issue.code === "vite_app_preview_embed_class_missing"));
  assert.ok(failing.issues.some((issue) => issue.code === "vite_app_preview_plugin_embed_api_missing"));
  assert.ok(failing.issues.some((issue) => issue.code === "vite_app_preview_initial_plugin_embed_missing"));
  assert.ok(failing.issues.some((issue) => issue.code === "vite_app_preview_plugin_local_key_present"));
});

test("browser runtime self-check analyzes Vite app-preview Hermes launch session readiness", () => {
  const passing = script.analyzeViteAppPreviewProbe({
    markerPresent: true,
    metaPresent: true,
    moduleScriptMatchesPreview: true,
    loaderOk: true,
    classicScriptCount: 51,
    expectedClassicScriptCount: 51,
    classicScriptOrderMatches: true,
    loaderPlanPresent: true,
    loaderPlanOwnerOk: true,
    loaderPlanHashPresent: true,
    loaderPlanScriptCount: 51,
    loaderPlanHashCount: 51,
    loaderPlanMatchesShellScripts: true,
    loaderPlanMatchesInjectedScripts: true,
    loaderPlanLoadedMatches: true,
    ...viteEsmCompatibilityReady,
    embedExpected: true,
    pluginSessionExpected: true,
    embedQueryPresent: true,
    embedHtmlClassPresent: true,
    pluginEmbedApiReady: true,
    initialPluginEmbedEmbedded: true,
    initialPluginLaunchKeyPresent: true,
    pluginLaunchUrlScrubbed: true,
    pluginLaunchSessionCleared: true,
    pluginSessionActive: true,
    pluginSessionKeyPresent: true,
    pluginSessionKeyDiffersFromLocalStorage: true,
    pluginAppPreviewPathPreserved: true,
    pluginStartupLoadingCleared: true,
    clientBuildMatches: true,
    shellCacheMatches: true,
    appVisible: true,
    bootRecoveryVisible: false,
    composerRuntimeReady: true,
    threadListRuntimeReady: true,
    threadTileRuntimeReady: true,
    loadThreadReady: true,
  }, { consoleEvents: [], exceptions: [] }, { expectEmbed: true, expectPluginSession: true });
  assert.equal(passing.ok, true);
  assert.equal(passing.issueCount, 0);

  const failing = script.analyzeViteAppPreviewProbe({
    markerPresent: true,
    metaPresent: true,
    moduleScriptMatchesPreview: true,
    loaderOk: true,
    classicScriptCount: 51,
    expectedClassicScriptCount: 51,
    classicScriptOrderMatches: true,
    loaderPlanPresent: true,
    loaderPlanOwnerOk: true,
    loaderPlanHashPresent: true,
    loaderPlanScriptCount: 51,
    loaderPlanHashCount: 51,
    loaderPlanMatchesShellScripts: true,
    loaderPlanMatchesInjectedScripts: true,
    loaderPlanLoadedMatches: true,
    embedExpected: true,
    pluginSessionExpected: true,
    embedQueryPresent: true,
    embedHtmlClassPresent: true,
    pluginEmbedApiReady: true,
    initialPluginEmbedEmbedded: true,
    initialPluginLaunchKeyPresent: false,
    pluginLaunchUrlScrubbed: false,
    pluginLaunchSessionCleared: false,
    pluginSessionActive: false,
    pluginSessionKeyPresent: false,
    pluginSessionKeyDiffersFromLocalStorage: false,
    pluginAppPreviewPathPreserved: false,
    pluginStartupLoadingCleared: false,
    clientBuildMatches: true,
    shellCacheMatches: true,
    appVisible: true,
    bootRecoveryVisible: false,
    composerRuntimeReady: true,
    threadListRuntimeReady: true,
    threadTileRuntimeReady: true,
    loadThreadReady: true,
  }, { consoleEvents: [], exceptions: [] }, { expectEmbed: true, expectPluginSession: true });
  assert.equal(failing.ok, false);
  assert.ok(failing.issues.some((issue) => issue.code === "vite_app_preview_plugin_launch_key_missing"));
  assert.ok(failing.issues.some((issue) => issue.code === "vite_app_preview_plugin_launch_url_not_scrubbed"));
  assert.ok(failing.issues.some((issue) => issue.code === "vite_app_preview_plugin_launch_session_not_cleared"));
  assert.ok(failing.issues.some((issue) => issue.code === "vite_app_preview_plugin_session_inactive"));
  assert.ok(failing.issues.some((issue) => issue.code === "vite_app_preview_plugin_session_key_missing"));
  assert.ok(failing.issues.some((issue) => issue.code === "vite_app_preview_plugin_session_uses_local_key"));
  assert.ok(failing.issues.some((issue) => issue.code === "vite_app_preview_plugin_session_path_changed"));
  assert.ok(failing.issues.some((issue) => issue.code === "vite_app_preview_plugin_startup_loading_stuck"));
});

test("browser runtime self-check reads client build from shell manifest assets", () => {
  assert.ok(scriptSource.includes('readAsset("/shell-asset-manifest.js")'));
  assert.ok(scriptSource.includes('readAsset("/shell-asset-manifest.json")'));
  assert.ok(scriptSource.includes('readAsset("/app-bootstrap.js")'));
  assert.ok(scriptSource.includes("shellManifestJs.text"));
  assert.ok(scriptSource.includes("shellManifestJson.text"));
  assert.ok(scriptSource.includes("/vite-shell/preview.html"));
  assert.ok(scriptSource.includes("/vite-shell/app-preview.html"));
  assert.ok(scriptSource.includes("--vite-app-preview-runtime"));
  assert.ok(scriptSource.includes("--vite-app-preview-embed"));
  assert.ok(scriptSource.includes("--vite-app-preview-launch-session"));
  assert.ok(scriptSource.includes("/api/v1/hermes/plugin/launch"));
  assert.ok(scriptSource.includes('embed: "hermes"'));
  assert.ok(scriptSource.includes("embedHtmlClassPresent"));
  assert.ok(scriptSource.includes("vite_app_preview_initial_plugin_embed_missing"));
  assert.ok(scriptSource.includes("vite_app_preview_plugin_launch_url_not_scrubbed"));
  assert.ok(scriptSource.includes("vite_app_preview_plugin_session_uses_local_key"));
  assert.ok(scriptSource.includes("vite-app-preview-runtime"));
  assert.ok(scriptSource.includes("viteAppPreviewReport"));
  assert.ok(scriptSource.includes("__CODEX_MOBILE_VITE_APP_PREVIEW_PROMISE__"));
  assert.ok(scriptSource.includes("vite_app_preview_classic_script_order_mismatch"));
  assert.ok(scriptSource.includes("__CODEX_MOBILE_VITE_SHELL_ENTRY_TOPOLOGY__"));
  assert.ok(scriptSource.includes("__CODEX_MOBILE_VITE_CLASSIC_COMPATIBILITY__"));
  assert.ok(scriptSource.includes("__CODEX_MOBILE_VITE_ESM_COMPATIBILITY__"));
  assert.ok(scriptSource.includes("build-refresh-policy"));
  assert.ok(scriptSource.includes("thread-list-load-policy"));
  assert.ok(scriptSource.includes("esmCompatibilityExpectedCount"));
  assert.ok(scriptSource.includes("__CODEX_MOBILE_VITE_ENTRY_GROUP_IMPORT_OWNER__"));
  assert.ok(scriptSource.includes("__CODEX_MOBILE_VITE_ENTRY_DYNAMIC_IMPORT_GRAPH__"));
  assert.ok(scriptSource.includes("__CODEX_MOBILE_VITE_ENTRY_GROUP_IMPORT_PROMISE__"));
  assert.ok(scriptSource.includes("__CODEX_MOBILE_VITE_ENTRY_GROUP_CHUNKS__"));
  assert.ok(scriptSource.includes("entryGroupImportOwnerOk"));
  assert.ok(scriptSource.includes("classicShellScriptBlockHashPresent"));
  assert.ok(scriptSource.includes("startupGlobalContractMarkerCount"));
  assert.ok(scriptSource.includes("entryDynamicImportEntryGroupCountMatches"));
  assert.ok(scriptSource.includes("entryGroupClassicCoverageOk"));
  assert.ok(scriptSource.includes("classicCompatibilityStartupGlobalContractReady"));
  assert.ok(scriptSource.includes("esmCompatibilityReady"));
  assert.ok(scriptSource.includes("vite_preview_esm_compatibility_missing"));
  assert.ok(scriptSource.includes("vite_app_preview_esm_compatibility_missing"));
  assert.ok(scriptSource.includes("shellRefreshContractReady"));
  assert.ok(scriptSource.includes("refreshPageForNewBuild"));
  assert.ok(scriptSource.includes("clearAllShellCaches"));
  assert.ok(scriptSource.includes("resetPageShellServiceWorker"));
  assert.ok(scriptSource.includes("browser_startup_shell_refresh_contract_missing"));
  assert.ok(scriptSource.includes("data-codex-vite-startup-asset"));
  assert.ok(scriptSource.includes("data-codex-vite-entry-group-chunk"));
});

test("browser runtime startup gate blocks missing shell refresh contract", () => {
  const report = {
    browserReport: {
      ok: true,
      issues: [],
      issueCount: 0,
      blockingIssueCount: 0,
    },
  };
  script.applyStartupGateIssues(report, {
    clientBuildMatches: true,
    composerRuntimeReady: true,
    threadListRuntimeReady: true,
    threadTileRuntimeReady: true,
    bootRecoveryVisible: false,
    shellRefreshContractReady: false,
    shellRefreshHardRefreshPresent: true,
    shellRefreshPromptPresent: true,
    shellRefreshRefreshPageReady: true,
    shellRefreshClearCachesReady: true,
    shellRefreshResetServiceWorkerReady: false,
    shellRefreshServiceWorkerCapable: true,
    shellRefreshCachesCapable: true,
  }, { ok: true });

  assert.equal(report.browserReport.ok, false);
  assert.equal(report.browserReport.blockingIssueCount, 1);
  const issue = report.browserReport.issues.find((item) => item.code === "browser_startup_shell_refresh_contract_missing");
  assert.ok(issue);
  assert.equal(issue.severity, "H2");
  assert.equal(issue.resetServiceWorkerReady, false);
  assert.equal(issue.serviceWorkerCapable, true);
});

test("browser runtime self-check treats startup exceptions as blocking", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    samples: [{
      label: "startup",
      probeKind: "startup",
      appVisible: false,
      loginVisible: false,
      targetConfirmed: true,
      contentConfirmed: true,
      turns: 0,
      items: 0,
      renderKeys: 0,
    }],
    exceptions: [{ code: "ReferenceError" }],
  });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.code === "browser_app_not_visible" && issue.severity === "H2"));
  assert.ok(report.issues.some((issue) => issue.code === "browser_runtime_exception" && issue.severity === "H2"));
});

test("browser runtime self-check catches sparse DOM after confirmed nonempty target content", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    minSettledDelayMs: 1000,
    samples: [
      {
        label: "first",
        threadHash: "thread-hash",
        appVisible: true,
        targetConfirmed: true,
        contentConfirmed: true,
        turns: 6,
        items: 24,
        renderKeys: 30,
      },
      {
        label: "second",
        threadHash: "thread-hash",
        appVisible: true,
        targetConfirmed: true,
        contentConfirmed: true,
        turns: 0,
        items: 0,
        renderKeys: 1,
        delayMs: 1200,
        loadingNote: true,
      },
    ],
  });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.code === "browser_dom_sparse_after_nonempty" && issue.severity === "H2"));
  assert.ok(report.issues.some((issue) => issue.code === "browser_dom_final_sparse_after_nonempty"));
});

test("browser runtime self-check catches unconfirmed sparse downgrade after confirmed target content", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    minSettledDelayMs: 1000,
    samples: [
      {
        label: "confirmed-content",
        threadHash: "thread-hash",
        appVisible: true,
        targetConfirmed: true,
        contentConfirmed: true,
        turns: 8,
        items: 40,
        renderKeys: 45,
      },
      {
        label: "current-thread-dropped",
        threadHash: "thread-hash",
        appVisible: true,
        targetConfirmed: true,
        contentConfirmed: false,
        turns: 0,
        items: 0,
        renderKeys: 1,
        delayMs: 1200,
        emptyState: true,
      },
    ],
  });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.code === "browser_dom_sparse_after_nonempty" && issue.severity === "H2"));
});

test("browser runtime self-check catches visible item downgrade after confirmed target content", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    minSettledDelayMs: 1000,
    samples: [
      {
        label: "confirmed-rich-content",
        threadHash: "thread-hash",
        appVisible: true,
        targetConfirmed: true,
        contentConfirmed: true,
        turns: 10,
        items: 80,
        renderKeys: 85,
      },
      {
        label: "dropped-middle-items",
        threadHash: "thread-hash",
        appVisible: true,
        targetConfirmed: true,
        contentConfirmed: true,
        turns: 4,
        items: 25,
        renderKeys: 30,
        delayMs: 1600,
      },
    ],
  });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.code === "browser_dom_visible_items_downgraded_after_nonempty"));
});

test("browser runtime self-check ignores previous-thread residue as nonempty baseline", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    minSettledDelayMs: 1000,
    samples: [
      {
        label: "previous-thread-residue",
        threadHash: "target-thread-hash",
        appVisible: true,
        targetConfirmed: true,
        contentConfirmed: false,
        turns: 8,
        items: 32,
        renderKeys: 40,
      },
      {
        label: "initial-loading",
        threadHash: "target-thread-hash",
        appVisible: true,
        targetConfirmed: true,
        contentConfirmed: false,
        turns: 0,
        items: 0,
        renderKeys: 1,
        delayMs: 1200,
        loadingNote: true,
      },
    ],
  });

  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});

test("browser runtime self-check catches latest usage timestamp and image failures", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    samples: [{
      label: "dom-contract",
      threadHash: "thread-hash",
      appVisible: true,
      targetConfirmed: true,
      contentConfirmed: true,
      latestTurnMatchesTarget: true,
      expectedLatestUsageRequired: true,
      latestTurnUsageCount: 0,
      latestTimestampExpectedItems: 2,
      latestTimestampMissingItems: 1,
      imageCount: 2,
      imageFigureCount: 2,
      imageFailedFigureCount: 1,
      brokenCompleteImageCount: 1,
      imageFailureCount: 2,
      imageFailureKindCounts: {
        "failed-class": 1,
        "protected-placeholder": 1,
        "hermes-proxy-generated-image": 1,
      },
      imageFailureDetails: [{
        reason: "failed-class",
        figureKind: "image-view",
        displaySourceKind: "protected-placeholder",
        protectedSourceKind: "hermes-proxy-generated-image",
        missingSrc: false,
        hasImage: true,
        complete: true,
        naturalWidth: 0,
        naturalHeight: 0,
        recoveryCount: 2,
      }],
      turns: 3,
      items: 9,
      renderKeys: 12,
    }],
  });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.code === "browser_latest_turn_usage_missing"));
  assert.ok(report.issues.some((issue) => issue.code === "browser_latest_turn_timestamp_missing"));
  const imageIssue = report.issues.find((issue) => issue.code === "browser_image_render_failed");
  assert.ok(imageIssue);
  assert.equal(imageIssue.imageFigureCount, 2);
  assert.equal(imageIssue.imageFailureKindCounts["protected-placeholder"], 1);
  assert.equal(imageIssue.firstImageFailure.protectedSourceKind, "hermes-proxy-generated-image");
  assert.equal(report.sampleSummary.maxImageFigures, 2);
});

test("browser runtime self-check catches per-turn DOM/API structure mismatches", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    samples: [{
      label: "turn-structure",
      threadHash: "thread-hash",
      appVisible: true,
      targetConfirmed: true,
      contentConfirmed: true,
      expectedTurnShapes: [{
        index: 0,
        turnHash: "turn-a",
        completed: true,
        expectedItemCount: 3,
        expectedUserMessageCount: 1,
        expectedAssistantMessageCount: 1,
        expectedUsageRequired: true,
        expectedTimestampItemCount: 2,
      }],
      domTurnShapes: [{
        index: 0,
        turnHash: "turn-a",
        itemCount: 2,
        userMessageCount: 1,
        assistantMessageCount: 0,
        usageCount: 1,
        timestampExpectedItems: 1,
        timestampMissingItems: 1,
        userAfterUsageCount: 1,
      }],
      turns: 1,
      items: 2,
      renderKeys: 2,
    }],
  });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.code === "browser_turn_assistant_missing"));
  assert.ok(report.issues.some((issue) => issue.code === "browser_turn_user_message_after_usage"));
  assert.ok(report.issues.some((issue) => issue.code === "browser_turn_timestamp_missing"));
  const issue = report.issues.find((entry) => entry.code === "browser_turn_user_message_after_usage");
  assert.equal(issue.turnShape.turnHash, "turn-a");
  assert.equal(issue.turnShape.actualUserMessageCount, 1);
  assert.equal(issue.turnShape.actualAssistantMessageCount, 0);
});

test("browser runtime self-check keeps one-off dynamic API plan mismatches advisory", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    samples: [{
      label: "dynamic-turn-structure",
      threadHash: "thread-hash",
      appVisible: true,
      targetConfirmed: true,
      contentConfirmed: true,
      dynamicThreadPlan: true,
      expectedTurnShapes: [{
        index: 0,
        turnHash: "turn-a",
        completed: true,
        expectedItemCount: 7,
        expectedUserMessageCount: 3,
        expectedAssistantMessageCount: 1,
        expectedUsageRequired: true,
        expectedTimestampItemCount: 5,
      }],
      domTurnShapes: [{
        index: 0,
        turnHash: "turn-a",
        itemCount: 3,
        userMessageCount: 0,
        taskCardUserMessageCount: 1,
        assistantMessageCount: 1,
        usageCount: 1,
        timestampExpectedItems: 2,
        timestampMissingItems: 0,
        userAfterUsageCount: 0,
      }],
      turns: 1,
      items: 3,
      renderKeys: 3,
    }],
  });

  const issue = report.issues.find((entry) => entry.code === "browser_turn_user_message_below_api_expectation");
  assert.equal(report.ok, true);
  assert.equal(issue && issue.severity, "H3");
  assert.equal(issue && issue.dynamicThreadPlan, true);
  assert.equal(issue && issue.observationCount, 1);
});

test("browser runtime self-check blocks repeated dynamic API plan mismatches", () => {
  const sample = {
    threadHash: "thread-hash",
    appVisible: true,
    targetConfirmed: true,
    contentConfirmed: true,
    dynamicThreadPlan: true,
    expectedTurnShapes: [{
      index: 0,
      turnHash: "turn-a",
      completed: true,
      expectedItemCount: 7,
      expectedUserMessageCount: 3,
      expectedAssistantMessageCount: 1,
      expectedUsageRequired: true,
      expectedTimestampItemCount: 5,
    }],
    domTurnShapes: [{
      index: 0,
      turnHash: "turn-a",
      itemCount: 3,
      userMessageCount: 0,
      taskCardUserMessageCount: 1,
      assistantMessageCount: 1,
      usageCount: 1,
      timestampExpectedItems: 2,
      timestampMissingItems: 0,
      userAfterUsageCount: 0,
    }],
    turns: 1,
    items: 3,
    renderKeys: 3,
  };
  const report = service.analyzeBrowserRuntimeSamples({
    samples: [
      Object.assign({ label: "dynamic-turn-structure-a" }, sample),
      Object.assign({ label: "dynamic-turn-structure-b" }, sample),
    ],
  });

  const issue = report.issues.find((entry) => entry.code === "browser_turn_user_message_below_api_expectation");
  assert.equal(report.ok, false);
  assert.equal(issue && issue.severity, "H2");
  assert.equal(issue && issue.observationCount, 2);
});

test("browser runtime self-check counts task-card DOM as visible user input", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    samples: [{
      label: "turn-task-card-user-input",
      threadHash: "thread-hash",
      appVisible: true,
      targetConfirmed: true,
      contentConfirmed: true,
      expectedTurnShapes: [{
        index: 0,
        turnHash: "turn-a",
        completed: true,
        expectedItemCount: 3,
        expectedUserMessageCount: 1,
        expectedAssistantMessageCount: 1,
        expectedUsageRequired: true,
        expectedTimestampItemCount: 2,
      }],
      domTurnShapes: [{
        index: 0,
        turnHash: "turn-a",
        itemCount: 26,
        userMessageCount: 0,
        taskCardUserMessageCount: 1,
        assistantMessageCount: 24,
        usageCount: 1,
        timestampExpectedItems: 25,
        timestampMissingItems: 0,
        userAfterUsageCount: 0,
      }],
      turns: 1,
      items: 26,
      renderKeys: 26,
    }],
  });

  assert.equal(report.ok, true);
  assert.equal(report.blockingIssueCount, 0);
  assert.equal(report.issues.some((issue) => issue.code === "browser_turn_user_message_below_api_expectation"), false);
});

test("browser runtime self-check keeps active progressive timestamp gaps advisory", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    samples: [{
      label: "active-progressive",
      threadHash: "thread-hash",
      appVisible: true,
      targetConfirmed: true,
      contentConfirmed: true,
      latestTurnMatchesTarget: true,
      latestTurnHash: "turn-active",
      latestTimestampExpectedItems: 27,
      latestTimestampMissingItems: 1,
      expectedTurnShapes: [{
        index: 0,
        turnHash: "turn-active",
        completed: false,
        expectedItemCount: 34,
        expectedUserMessageCount: 0,
        expectedTaskCardUserMessageCount: 2,
        expectedAssistantMessageCount: 24,
        expectedUsageRequired: false,
        expectedTimestampItemCount: 27,
      }],
      domTurnShapes: [{
        index: 0,
        turnHash: "turn-active",
        itemCount: 27,
        userMessageCount: 0,
        taskCardUserMessageCount: 2,
        assistantMessageCount: 25,
        usageCount: 0,
        timestampExpectedItems: 27,
        timestampMissingItems: 1,
        userAfterUsageCount: 0,
      }],
      turns: 1,
      items: 27,
      renderKeys: 27,
    }],
  });

  assert.equal(report.ok, true);
  assert.equal(report.blockingIssueCount, 0);
  const latestIssue = report.issues.find((entry) => entry.code === "browser_latest_turn_timestamp_missing");
  assert.ok(latestIssue);
  assert.equal(latestIssue.severity, "H3");
  assert.equal(latestIssue.activeProgressive, true);
  const turnIssue = report.issues.find((entry) => entry.code === "browser_turn_timestamp_missing");
  assert.ok(turnIssue);
  assert.equal(turnIssue.severity, "H3");
  assert.equal(turnIssue.turnShape.completed, false);
});

test("browser runtime self-check keeps early active assistant timestamp gaps advisory", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    samples: [{
      label: "active-assistant-gap",
      threadHash: "thread-hash",
      appVisible: true,
      targetConfirmed: true,
      contentConfirmed: true,
      latestTurnMatchesTarget: true,
      latestTurnHash: "turn-active",
      latestTimestampExpectedItems: 27,
      latestTimestampMissingItems: 1,
      latestTimestampMissingKindCounts: { agentMessage: 1 },
      expectedTurnShapes: [{
        index: 0,
        turnHash: "turn-active",
        completed: false,
        expectedItemCount: 34,
        expectedUserMessageCount: 0,
        expectedTaskCardUserMessageCount: 2,
        expectedAssistantMessageCount: 24,
        expectedUsageRequired: false,
        expectedTimestampItemCount: 27,
      }],
      domTurnShapes: [{
        index: 0,
        turnHash: "turn-active",
        itemCount: 34,
        userMessageCount: 0,
        taskCardUserMessageCount: 2,
        assistantMessageCount: 24,
        usageCount: 0,
        timestampExpectedItems: 27,
        timestampMissingItems: 1,
        timestampMissingKindCounts: { agentMessage: 1 },
        userAfterUsageCount: 0,
      }],
      turns: 1,
      items: 34,
      renderKeys: 34,
    }],
  });

  assert.equal(report.ok, true);
  assert.equal(report.blockingIssueCount, 0);
  const latestIssue = report.issues.find((entry) => entry.code === "browser_latest_turn_timestamp_missing");
  assert.equal(latestIssue.severity, "H3");
  assert.equal(latestIssue.latestTimestampMissingKindCounts.agentMessage, 1);
  const turnIssue = report.issues.find((entry) => entry.code === "browser_turn_timestamp_missing");
  assert.equal(turnIssue.severity, "H3");
  assert.equal(turnIssue.turnShape.timestampMissingKindCounts.agentMessage, 1);
});

test("browser runtime self-check still blocks active user timestamp gaps", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    samples: [{
      label: "active-user-gap",
      threadHash: "thread-hash",
      appVisible: true,
      targetConfirmed: true,
      contentConfirmed: true,
      latestTurnMatchesTarget: true,
      latestTurnHash: "turn-active",
      latestTimestampExpectedItems: 3,
      latestTimestampMissingItems: 1,
      latestTimestampMissingKindCounts: { userMessage: 1 },
      expectedTurnShapes: [{
        index: 0,
        turnHash: "turn-active",
        completed: false,
        expectedItemCount: 4,
        expectedUserMessageCount: 1,
        expectedAssistantMessageCount: 1,
        expectedUsageRequired: false,
        expectedTimestampItemCount: 3,
      }],
      domTurnShapes: [{
        index: 0,
        turnHash: "turn-active",
        itemCount: 4,
        userMessageCount: 1,
        assistantMessageCount: 1,
        usageCount: 0,
        timestampExpectedItems: 3,
        timestampMissingItems: 1,
        timestampMissingKindCounts: { userMessage: 1 },
        userAfterUsageCount: 0,
      }],
      turns: 1,
      items: 4,
      renderKeys: 4,
    }],
  });

  assert.equal(report.ok, false);
  assert.equal(report.blockingIssueCount, 2);
  assert.ok(report.issues.some((entry) => entry.code === "browser_latest_turn_timestamp_missing" && entry.severity === "H2"));
  assert.ok(report.issues.some((entry) => entry.code === "browser_turn_timestamp_missing" && entry.severity === "H2"));
});

test("browser runtime self-check still blocks completed timestamp gaps", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    samples: [{
      label: "completed-gap",
      threadHash: "thread-hash",
      appVisible: true,
      targetConfirmed: true,
      contentConfirmed: true,
      latestTurnMatchesTarget: true,
      latestTurnHash: "turn-completed",
      latestTimestampExpectedItems: 3,
      latestTimestampMissingItems: 1,
      expectedTurnShapes: [{
        index: 0,
        turnHash: "turn-completed",
        completed: true,
        expectedItemCount: 4,
        expectedUserMessageCount: 1,
        expectedAssistantMessageCount: 1,
        expectedUsageRequired: true,
        expectedTimestampItemCount: 3,
      }],
      domTurnShapes: [{
        index: 0,
        turnHash: "turn-completed",
        itemCount: 4,
        userMessageCount: 1,
        assistantMessageCount: 1,
        usageCount: 1,
        timestampExpectedItems: 3,
        timestampMissingItems: 1,
        userAfterUsageCount: 0,
      }],
      turns: 1,
      items: 4,
      renderKeys: 4,
    }],
  });

  assert.equal(report.ok, false);
  assert.equal(report.blockingIssueCount, 2);
  assert.ok(report.issues.some((entry) => entry.code === "browser_latest_turn_timestamp_missing" && entry.severity === "H2"));
  assert.ok(report.issues.some((entry) => entry.code === "browser_turn_timestamp_missing" && entry.severity === "H2"));
});

test("browser runtime self-check accepts receipt-only assistant compaction in older turns", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    samples: [{
      label: "receipt-only-history",
      threadHash: "thread-hash",
      appVisible: true,
      targetConfirmed: true,
      contentConfirmed: true,
      expectedTurnShapes: [{
        index: 0,
        turnHash: "turn-a",
        completed: true,
        expectedItemCount: 34,
        expectedUserMessageCount: 1,
        expectedTaskCardUserMessageCount: 5,
        expectedAssistantMessageCount: 24,
        expectedUsageRequired: true,
        expectedTimestampItemCount: 30,
      }],
      domTurnShapes: [{
        index: 0,
        turnHash: "turn-a",
        itemCount: 8,
        userMessageCount: 1,
        taskCardUserMessageCount: 5,
        assistantMessageCount: 1,
        usageCount: 1,
        timestampExpectedItems: 7,
        timestampMissingItems: 0,
        userAfterUsageCount: 0,
      }],
      turns: 1,
      items: 8,
      renderKeys: 8,
    }],
  });

  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
});

test("browser runtime self-check catches latest turn assistant text duplicates", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    samples: [{
      label: "latest-turn-duplicate",
      threadHash: "thread-hash",
      appVisible: true,
      targetConfirmed: true,
      contentConfirmed: true,
      latestTurnMatchesTarget: true,
      latestTurnAssistantMessageCount: 4,
      latestTurnAssistantTextDuplicateCount: 1,
      turns: 3,
      items: 12,
      renderKeys: 12,
    }],
  });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.code === "browser_latest_turn_assistant_text_duplicate"));
  assert.equal(report.sampleSummary.maxLatestTurnAssistantTextDuplicates, 1);
});

test("browser runtime self-check keeps long active assistant progress duplicates advisory", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    samples: [{
      label: "latest-turn-progress-duplicate",
      threadHash: "thread-hash",
      appVisible: true,
      targetConfirmed: true,
      contentConfirmed: true,
      latestTurnMatchesTarget: true,
      latestTurnAssistantMessageCount: 24,
      latestTurnAssistantTextDuplicateCount: 1,
      turns: 3,
      items: 36,
      renderKeys: 36,
    }],
  });

  assert.equal(report.ok, true);
  const duplicateIssue = report.issues.find((issue) => issue.code === "browser_latest_turn_assistant_text_duplicate");
  assert.ok(duplicateIssue);
  assert.equal(duplicateIssue.severity, "H3");
  assert.equal(report.blockingIssueCount, 0);
});

test("browser runtime self-check keeps active progressive assistant duplicates advisory", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    samples: [{
      label: "latest-turn-active-progress-duplicate",
      threadHash: "thread-hash",
      appVisible: true,
      targetConfirmed: true,
      contentConfirmed: true,
      latestTurnMatchesTarget: true,
      latestTurnHash: "turn-a",
      latestTurnAssistantMessageCount: 8,
      latestTurnAssistantTextDuplicateCount: 1,
      expectedTurnShapes: [{
        turnHash: "turn-a",
        completed: false,
        expectedItemCount: 21,
        expectedAssistantMessageCount: 4,
        expectedUsageRequired: false,
      }],
      domTurnShapes: [{
        turnHash: "turn-a",
        completed: false,
        itemCount: 13,
        assistantMessageCount: 8,
        usageCount: 0,
      }],
      turns: 3,
      items: 36,
      renderKeys: 36,
    }],
  });

  assert.equal(report.ok, true);
  const duplicateIssue = report.issues.find((issue) => issue.code === "browser_latest_turn_assistant_text_duplicate");
  assert.ok(duplicateIssue);
  assert.equal(duplicateIssue.severity, "H3");
  assert.equal(duplicateIssue.activeProgressive, true);
  assert.equal(duplicateIssue.turnShape.completed, false);
  assert.equal(report.blockingIssueCount, 0);
});

test("browser runtime self-check catches latest turn user message duplicates", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    samples: [{
      label: "latest-user-duplicate",
      threadHash: "thread-hash",
      appVisible: true,
      targetConfirmed: true,
      contentConfirmed: true,
      latestTurnMatchesTarget: true,
      expectedLatestUserMessageCount: 2,
      expectedLatestUserMessageDuplicateCount: 1,
      latestTurnUserMessageCount: 2,
      latestTurnUserTextDuplicateCount: 1,
      latestTurnUserNodeDetails: [
        {
          index: 0,
          textHash: "hash-a",
          dataItemHash: "item-a",
          renderKeyHash: "render-a",
          clientSubmissionHash: "",
          hasTimestamp: true,
          classKind: "durable",
        },
        {
          index: 1,
          textHash: "hash-a",
          dataItemHash: "",
          renderKeyHash: "",
          clientSubmissionHash: "submit-a",
          hasTimestamp: true,
          classKind: "local-pending",
        },
      ],
      turns: 3,
      items: 12,
      renderKeys: 12,
    }],
  });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.code === "browser_api_latest_turn_user_message_duplicate"));
  const duplicateIssue = report.issues.find((issue) => issue.code === "browser_latest_turn_user_message_duplicate");
  assert.ok(duplicateIssue);
  assert.equal(duplicateIssue.latestTurnUserNodeDetails.length, 2);
  assert.equal(duplicateIssue.latestTurnUserNodeDetails[1].classKind, "local-pending");
  assert.equal(report.sampleSummary.maxExpectedLatestUserMessageDuplicates, 1);
  assert.equal(report.sampleSummary.maxLatestTurnUserTextDuplicates, 1);
});

test("browser runtime self-check catches cross-turn user event duplicates", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    minSettledDelayMs: 1000,
    samples: [{
      label: "cross-turn-user-duplicate",
      threadHash: "thread-hash",
      appVisible: true,
      targetConfirmed: true,
      contentConfirmed: true,
      latestTurnMatchesTarget: true,
      allUserEventDuplicateCount: 1,
      latestTurnUserMessageCount: 1,
      latestTurnUserTextDuplicateCount: 0,
      turns: 4,
      items: 18,
      renderKeys: 18,
      delayMs: 1200,
    }],
  });

  assert.equal(report.ok, false);
  const duplicateIssue = report.issues.find((issue) => issue.code === "browser_user_message_event_duplicate");
  assert.ok(duplicateIssue);
  assert.equal(duplicateIssue.severity, "H2");
  assert.equal(duplicateIssue.duplicateCount, 1);
  assert.equal(report.sampleSummary.maxAllUserEventDuplicates, 1);
});

test("browser runtime self-check ignores null samples in summary", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    samples: [
      null,
      {
        label: "healthy",
        threadHash: "thread-hash",
        appVisible: true,
        targetConfirmed: true,
        contentConfirmed: true,
        latestTurnMatchesTarget: true,
        turns: 3,
        items: 12,
        renderKeys: 12,
      },
    ],
  });

  assert.equal(report.ok, true);
  assert.equal(report.sampleSummary.sampleCount, 1);
});

test("browser runtime self-check catches latest turn item and message count downgrades", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    minSettledDelayMs: 1000,
    samples: [
      {
        label: "rich-latest-turn",
        threadHash: "thread-hash",
        appVisible: true,
        targetConfirmed: true,
        contentConfirmed: true,
        latestTurnMatchesTarget: true,
        latestTurnHash: "latest-turn-hash",
        latestTurnItemCount: 8,
        latestTurnUserMessageCount: 2,
        latestTurnAssistantMessageCount: 4,
        turns: 4,
        items: 24,
        delayMs: 1200,
      },
      {
        label: "latest-turn-dropped",
        threadHash: "thread-hash",
        appVisible: true,
        targetConfirmed: true,
        contentConfirmed: true,
        latestTurnMatchesTarget: true,
        latestTurnHash: "latest-turn-hash",
        latestTurnItemCount: 4,
        latestTurnUserMessageCount: 1,
        latestTurnAssistantMessageCount: 2,
        turns: 4,
        items: 20,
        delayMs: 1600,
      },
    ],
  });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.code === "browser_latest_turn_item_count_downgraded"));
  assert.ok(report.issues.some((issue) => issue.code === "browser_latest_turn_user_message_downgraded"));
  assert.ok(report.issues.some((issue) => issue.code === "browser_latest_turn_assistant_message_downgraded"));
  assert.equal(report.sampleSummary.maxLatestTurnItems, 8);
  assert.equal(report.sampleSummary.maxLatestTurnUserMessages, 2);
  assert.equal(report.sampleSummary.maxLatestTurnAssistantMessages, 4);
});

test("browser runtime self-check treats active assistant progress consolidation as advisory", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    minSettledDelayMs: 1000,
    samples: [
      {
        label: "active-progress-rich",
        threadHash: "thread-hash",
        appVisible: true,
        targetConfirmed: true,
        contentConfirmed: true,
        latestTurnMatchesTarget: true,
        latestTurnHash: "latest-turn-hash",
        latestTurnItemCount: 12,
        latestTurnUserMessageCount: 1,
        latestTurnAssistantMessageCount: 9,
        turns: 4,
        items: 24,
        delayMs: 1200,
        expectedTurnShapes: [{
          turnHash: "latest-turn-hash",
          completed: false,
          expectedItemCount: 12,
          expectedAssistantMessageCount: 8,
        }],
        domTurnShapes: [{
          turnHash: "latest-turn-hash",
          itemCount: 11,
          userMessageCount: 1,
          assistantMessageCount: 9,
        }],
      },
      {
        label: "active-progress-consolidated",
        threadHash: "thread-hash",
        appVisible: true,
        targetConfirmed: true,
        contentConfirmed: true,
        latestTurnMatchesTarget: true,
        latestTurnHash: "latest-turn-hash",
        latestTurnItemCount: 11,
        latestTurnUserMessageCount: 1,
        latestTurnAssistantMessageCount: 8,
        turns: 4,
        items: 23,
        delayMs: 1600,
        expectedTurnShapes: [{
          turnHash: "latest-turn-hash",
          completed: false,
          expectedItemCount: 11,
          expectedAssistantMessageCount: 8,
        }],
        domTurnShapes: [{
          turnHash: "latest-turn-hash",
          itemCount: 11,
          userMessageCount: 1,
          assistantMessageCount: 8,
        }],
      },
    ],
  });

  const itemIssue = report.issues.find((issue) => issue.code === "browser_latest_turn_item_count_downgraded");
  const assistantIssue = report.issues.find((issue) => issue.code === "browser_latest_turn_assistant_message_downgraded");
  assert.equal(report.ok, true);
  assert.equal(itemIssue && itemIssue.severity, "H3");
  assert.equal(assistantIssue && assistantIssue.severity, "H3");
  assert.equal(report.issues.some((issue) => issue.code === "browser_latest_turn_user_message_downgraded"), false);
});

test("browser runtime self-check does not treat loading previews as latest turn downgrades", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    minSettledDelayMs: 1000,
    samples: [
      {
        label: "rich-latest-turn",
        threadHash: "thread-hash",
        appVisible: true,
        targetConfirmed: true,
        contentConfirmed: true,
        latestTurnMatchesTarget: true,
        latestTurnHash: "latest-turn-hash",
        latestTurnItemCount: 8,
        latestTurnUserMessageCount: 1,
        latestTurnAssistantMessageCount: 4,
        turns: 4,
        items: 24,
        delayMs: 1200,
      },
      {
        label: "active-preview",
        threadHash: "thread-hash",
        appVisible: true,
        targetConfirmed: true,
        contentConfirmed: true,
        loadingNote: true,
        latestTurnMatchesTarget: true,
        latestTurnHash: "latest-turn-hash",
        latestTurnItemCount: 2,
        latestTurnUserMessageCount: 1,
        latestTurnAssistantMessageCount: 0,
        turns: 4,
        items: 12,
        delayMs: 1600,
      },
    ],
  });

  assert.equal(report.ok, true);
  assert.ok(!report.issues.some((issue) => issue.code === "browser_latest_turn_item_count_downgraded"));
  assert.ok(!report.issues.some((issue) => issue.code === "browser_latest_turn_assistant_message_downgraded"));
});

test("browser runtime self-check catches latest turn user messages below API expectation", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    samples: [{
      label: "api-dom-user-gap",
      threadHash: "thread-hash",
      appVisible: true,
      targetConfirmed: true,
      contentConfirmed: true,
      latestTurnMatchesTarget: true,
      expectedLatestUserMessageCount: 4,
      latestTurnUserMessageCount: 3,
      turns: 3,
      items: 12,
      renderKeys: 12,
    }],
  });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.code === "browser_latest_turn_user_message_below_api_expectation"));
});

test("browser runtime self-check counts latest task-card DOM as visible user input", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    samples: [{
      label: "latest-task-card-user-input",
      threadHash: "thread-hash",
      appVisible: true,
      targetConfirmed: true,
      contentConfirmed: true,
      latestTurnMatchesTarget: true,
      expectedLatestUserMessageCount: 1,
      latestTurnUserMessageCount: 0,
      latestTurnTaskCardItemCount: 1,
      turns: 3,
      items: 12,
      renderKeys: 12,
    }],
  });

  assert.equal(report.ok, true);
  assert.equal(report.blockingIssueCount, 0);
  assert.equal(report.issues.some((issue) => issue.code === "browser_latest_turn_user_message_below_api_expectation"), false);
});

test("browser runtime self-check catches latest turn task card below API expectation", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    samples: [{
      label: "api-dom-task-card-gap",
      threadHash: "thread-hash",
      appVisible: true,
      targetConfirmed: true,
      contentConfirmed: true,
      latestTurnMatchesTarget: true,
      expectedLatestTaskCardUserMessageCount: 1,
      latestTurnTaskCardItemCount: 0,
      turns: 3,
      items: 12,
      renderKeys: 12,
    }],
  });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.code === "browser_latest_turn_task_card_below_api_expectation"));
});

test("browser runtime self-check catches visible process items in latest turn DOM", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    samples: [{
      label: "visible-process-items",
      threadHash: "thread-hash",
      appVisible: true,
      targetConfirmed: true,
      contentConfirmed: true,
      latestTurnMatchesTarget: true,
      latestTurnOperationItemCount: 2,
      latestTurnReasoningItemCount: 1,
      turns: 3,
      items: 12,
      renderKeys: 12,
    }],
  });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.code === "browser_latest_turn_operation_items_visible"));
  assert.ok(report.issues.some((issue) => issue.code === "browser_latest_turn_reasoning_items_visible"));
  assert.equal(report.sampleSummary.maxLatestTurnOperationItems, 2);
  assert.equal(report.sampleSummary.maxLatestTurnReasoningItems, 1);
});

test("browser runtime self-check catches pending user message disappearing after submission", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    minSettledDelayMs: 1000,
    samples: [
      {
        label: "pending-visible",
        threadHash: "thread-hash",
        appVisible: true,
        targetConfirmed: true,
        contentConfirmed: true,
        turns: 4,
        items: 20,
        latestTurnUserMessageCount: 1,
        clientSubmissionCount: 1,
        delayMs: 1200,
      },
      {
        label: "pending-dropped",
        threadHash: "thread-hash",
        appVisible: true,
        targetConfirmed: true,
        contentConfirmed: true,
        turns: 4,
        items: 20,
        latestTurnUserMessageCount: 0,
        clientSubmissionCount: 0,
        delayMs: 1600,
      },
    ],
  });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.code === "browser_pending_user_message_disappeared"));
  assert.equal(report.sampleSummary.maxClientSubmissions, 1);
});

test("browser runtime self-check does not treat loading previews as pending user disappearance", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    minSettledDelayMs: 1000,
    samples: [
      {
        label: "pending-visible",
        threadHash: "thread-hash",
        appVisible: true,
        targetConfirmed: true,
        contentConfirmed: true,
        turns: 4,
        items: 20,
        latestTurnUserMessageCount: 1,
        clientSubmissionCount: 1,
        delayMs: 1200,
      },
      {
        label: "active-preview",
        threadHash: "thread-hash",
        appVisible: true,
        targetConfirmed: true,
        contentConfirmed: true,
        loadingNote: true,
        turns: 4,
        items: 12,
        latestTurnUserMessageCount: 0,
        clientSubmissionCount: 0,
        delayMs: 1600,
      },
    ],
  });

  assert.equal(report.ok, true);
  assert.ok(!report.issues.some((issue) => issue.code === "browser_pending_user_message_disappeared"));
  assert.equal(report.sampleSummary.maxClientSubmissions, 1);
});

test("browser runtime self-check catches submit exercise user message never becoming visible", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    minSettledDelayMs: 1000,
    samples: [
      {
        label: "submit-pre",
        threadHash: "thread-hash",
        appVisible: true,
        targetConfirmed: true,
        contentConfirmed: true,
        exerciseSubmit: true,
        submitPhase: "pre",
        submitOk: false,
        turns: 4,
        items: 20,
        delayMs: 0,
      },
      {
        label: "submit-post-1600",
        threadHash: "thread-hash",
        appVisible: true,
        targetConfirmed: true,
        contentConfirmed: true,
        exerciseSubmit: true,
        submitPhase: "post-1600",
        submitOk: true,
        turns: 4,
        items: 20,
        latestTurnUserMessageCount: 0,
        clientSubmissionCount: 0,
        delayMs: 1600,
      },
    ],
  });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.code === "browser_submit_user_message_not_visible"));
});

test("browser runtime self-check accepts submit exercise user message in actual latest DOM turn", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    minSettledDelayMs: 1000,
    samples: [
      {
        label: "submit-post-1600",
        threadHash: "thread-hash",
        appVisible: true,
        targetConfirmed: true,
        contentConfirmed: true,
        exerciseSubmit: true,
        submitPhase: "post-1600",
        submitOk: true,
        turns: 5,
        items: 24,
        latestTurnUserMessageCount: 0,
        actualLatestTurnUserMessageCount: 1,
        clientSubmissionCount: 0,
        delayMs: 1600,
      },
    ],
  });

  assert.equal(report.ok, true);
  assert.ok(!report.issues.some((issue) => issue.code === "browser_submit_user_message_not_visible"));
  assert.equal(report.sampleSummary.maxActualLatestTurnUserMessages, 1);
});

test("browser runtime self-check accepts pending user message replaced by durable user message", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    minSettledDelayMs: 1000,
    samples: [
      {
        label: "pending-visible",
        threadHash: "thread-hash",
        appVisible: true,
        targetConfirmed: true,
        contentConfirmed: true,
        turns: 4,
        items: 20,
        latestTurnUserMessageCount: 1,
        clientSubmissionCount: 1,
        delayMs: 1200,
      },
      {
        label: "durable-visible",
        threadHash: "thread-hash",
        appVisible: true,
        targetConfirmed: true,
        contentConfirmed: true,
        turns: 4,
        items: 20,
        latestTurnUserMessageCount: 1,
        clientSubmissionCount: 0,
        delayMs: 1600,
      },
    ],
  });

  assert.equal(report.ok, true);
  assert.ok(!report.issues.some((issue) => issue.code === "browser_pending_user_message_disappeared"));
});

test("browser runtime self-check catches small visual anchor jitter without DOM loss", () => {
  const base = {
    threadHash: "thread-hash",
    appVisible: true,
    targetConfirmed: true,
    contentConfirmed: true,
    turns: 6,
    items: 24,
    renderKeys: 30,
    visualAnchorKeyHash: "anchor-hash",
    visualFrameHash: "frame-hash",
    scrollHeight: 2400,
    delayMs: 1200,
  };
  const report = service.analyzeBrowserRuntimeSamples({
    minSettledDelayMs: 1000,
    samples: [
      Object.assign({}, base, { label: "stable-1", visualAnchorTopPx: 120 }),
      Object.assign({}, base, { label: "jitter-1", visualAnchorTopPx: 126 }),
      Object.assign({}, base, { label: "jitter-2", visualAnchorTopPx: 121 }),
    ],
  });

  assert.equal(report.ok, true);
  assert.ok(report.issues.some((issue) => issue.code === "browser_visual_anchor_jitter" && issue.severity === "H3"));
  assert.equal(report.sampleSummary.maxVisualAnchorSmallJitterCount, 2);
  assert.equal(report.sampleSummary.maxVisualAnchorShiftPx, 6);
});

test("browser runtime self-check catches submitted message card jitter", () => {
  const base = {
    threadHash: "thread-hash",
    appVisible: true,
    targetConfirmed: true,
    contentConfirmed: true,
    exerciseSubmit: true,
    submitOk: true,
    turns: 5,
    items: 22,
    renderKeys: 24,
    delayMs: 1200,
    clientSubmissionCount: 1,
    latestTurnUserMessageCount: 1,
    submittedMessageKeyHash: "submitted-key",
  };
  const report = service.analyzeBrowserRuntimeSamples({
    minSettledDelayMs: 1000,
    samples: [
      Object.assign({}, base, { label: "submit-post-350", submitPhase: "post-350", submittedMessageTopPx: 640 }),
      Object.assign({}, base, { label: "submit-post-900", submitPhase: "post-900", submittedMessageTopPx: 648 }),
    ],
  });

  assert.equal(report.ok, true);
  assert.ok(report.issues.some((issue) => issue.code === "browser_submitted_message_card_jitter" && issue.severity === "H3"));
  assert.equal(report.sampleSummary.maxSubmittedMessageSmallJitterCount, 1);
  assert.equal(report.sampleSummary.maxSubmittedMessageShiftPx, 8);
});

test("browser runtime self-check catches bottom follow jitter while content grows", () => {
  const base = {
    threadHash: "thread-hash",
    appVisible: true,
    targetConfirmed: true,
    contentConfirmed: true,
    turns: 6,
    renderKeys: 30,
    clientHeight: 700,
    delayMs: 1200,
  };
  const report = service.analyzeBrowserRuntimeSamples({
    minSettledDelayMs: 1000,
    samples: [
      Object.assign({}, base, {
        label: "bottom-stable",
        items: 24,
        scrollHeight: 2400,
        scrollTop: 1700,
      }),
      Object.assign({}, base, {
        label: "receipt-inserted-not-followed",
        items: 28,
        scrollHeight: 2640,
        scrollTop: 1700,
      }),
    ],
  });

  assert.equal(report.ok, true);
  assert.ok(report.issues.some((issue) => issue.code === "browser_bottom_follow_jitter" && issue.severity === "H3"));
  assert.equal(report.sampleSummary.maxBottomFollowJitterCount, 1);
  assert.equal(report.sampleSummary.maxBottomDistancePx, 240);
});

test("browser runtime self-check catches blocked thread list interaction", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    samples: [{
      label: "thread-list-probe",
      probeKind: "thread-list-interaction",
      threadHash: "thread-list",
      appVisible: true,
      targetConfirmed: true,
      contentConfirmed: true,
      threadListAvailable: true,
      threadListScrollable: true,
      threadListCardCount: 40,
      threadListProbeElapsedMs: 2200,
      threadListMaxRafDelayMs: 1300,
      threadListMaxScrollApplyMs: 1320,
      longTaskCount: 2,
      longTaskMaxDurationMs: 1280,
      longTaskTotalDurationMs: 1800,
      turns: 0,
      items: 0,
      renderKeys: 0,
    }],
  });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.code === "browser_thread_list_interaction_blocked"));
  assert.ok(report.issues.some((issue) => issue.code === "browser_main_thread_long_task"));
  assert.equal(report.sampleSummary.maxThreadListRafDelayMs, 1300);
  assert.equal(report.sampleSummary.maxLongTaskDurationMs, 1280);
});

test("browser runtime self-check ignores expected stress probe elapsed time without per-frame blocking", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    samples: [{
      label: "thread-list-stress",
      probeKind: "thread-list-interaction",
      stressProbe: true,
      threadHash: "thread-list",
      appVisible: true,
      targetConfirmed: true,
      contentConfirmed: true,
      threadListAvailable: true,
      threadListScrollable: true,
      threadListCardCount: 40,
      threadListProbeElapsedMs: 4500,
      threadListMaxRafDelayMs: 150,
      threadListMaxScrollApplyMs: 150,
      longTaskCount: 0,
      longTaskMaxDurationMs: 0,
      turns: 0,
      items: 0,
      renderKeys: 0,
    }],
  });

  assert.equal(report.ok, true);
  assert.equal(report.issueCount, 0);
  assert.equal(report.sampleSummary.maxThreadListProbeElapsedMs, 4500);
});

test("browser runtime self-check catches duplicate DOM keys and runtime exceptions", () => {
  const report = service.analyzeBrowserRuntimeSamples({
    samples: [{
      label: "dup",
      threadHash: "thread-hash",
      appVisible: true,
      targetConfirmed: true,
      contentConfirmed: true,
      turns: 3,
      items: 9,
      renderKeys: 12,
      duplicateRenderKeys: 1,
      duplicateItemIds: 2,
    }],
    exceptions: [{ code: "uncaught" }],
  });

  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.code === "browser_duplicate_render_keys"));
  assert.ok(report.issues.some((issue) => issue.code === "browser_duplicate_item_ids"));
  assert.ok(report.issues.some((issue) => issue.code === "browser_runtime_exception"));
});

test("browser runtime self-check helper output is metadata-only", () => {
  const privateThreadId = "019-private-thread-id";
  const rows = service.safeThreadRows([{ id: privateThreadId, title: "private title" }], 1);

  assert.equal(rows[0].threadHash, service.stableTextHash(privateThreadId));
  assert.doesNotMatch(JSON.stringify(rows), /019-private-thread-id|private title/);

  const report = service.analyzeBrowserRuntimeSamples({
    samples: [{
      label: "private label with spaces",
      threadHash: service.stableTextHash(privateThreadId),
      appVisible: true,
      turns: 2,
      items: 4,
    }],
    networkEvents: [
      { route: "/api/client-events?key=secret-token", status: 200 },
      { route: "thread_detail", status: 200 },
    ],
  });
  const serialized = JSON.stringify(report);
  assert.doesNotMatch(serialized, /019-private-thread-id|private title|secret-token|cookie|access_key|message body/i);
});

test("browser runtime self-check script exposes bounded browser snapshot fields", () => {
  const expression = script.snapshotExpression({
    threadId: "thread-private-id",
    threadHash: "thread-hash",
    expectedTurnHashes: ["expected-hash"],
    expectedLatestTurnHash: "expected-hash",
    label: "sample",
    delayMs: 1200,
  });

  assert.match(expression, /duplicateRenderKeys/);
  assert.match(expression, /duplicateItemIds/);
  assert.match(expression, /renderRoot = conversation \|\| document/);
  assert.match(expression, /contentConfirmed/);
  assert.match(expression, /expectedLatestUsageRequired/);
  assert.match(expression, /expectedLatestUserMessageCount/);
  assert.match(expression, /expectedLatestTaskCardUserMessageCount/);
  assert.match(expression, /expectedTurnShapes/);
  assert.match(expression, /domTurnShapes/);
  assert.match(expression, /userAfterUsageCount/);
  assert.match(expression, /longTaskMaxDurationMs/);
  assert.match(expression, /latestTurnHash/);
  assert.match(expression, /latestTurnUserMessageCount/);
  assert.match(expression, /latestTurnTaskCardItemCount/);
  assert.match(expression, /latestTurnAssistantMessageCount/);
  assert.match(expression, /actualLatestTurnUserMessageCount/);
  assert.match(expression, /actualLatestTurnAssistantMessageCount/);
  assert.match(expression, /latestTurnOperationItemCount/);
  assert.match(expression, /latestTurnReasoningItemCount/);
  assert.match(expression, /latestTurnAssistantTextDuplicateCount/);
  assert.match(expression, /latestTimestampMissingItems/);
  assert.match(expression, /imageFailureCount/);
  assert.match(expression, /imageSourceKind/);
  assert.match(expression, /imageFailureKindCounts/);
  assert.match(expression, /imageFailureDetails/);
  assert.match(expression, /brokenCompleteImageCount/);
  assert.match(expression, /data-client-submission-hash/);
  assert.match(expression, /visualAnchorKeyHash/);
  assert.match(expression, /visualFrameHash/);
  assert.match(expression, /submittedMessageKeyHash/);
  assert.match(expression, /conversationTopPx/);
  assert.match(expression, /loadingNote/);
  assert.match(expression, /emptyState/);
  assert.match(expression, /codexMobileCurrentThreadId/);
  assert.doesNotMatch(expression, /innerText|location\.href|document\.cookie|Authorization|Bearer/);
});

test("browser runtime self-check refreshes API plan before settled delayed samples", () => {
  const input = script.snapshotInputForPlanEntry({
    id: "private-thread-id",
    threadHash: "thread-hash",
    expectedTurnHashes: ["turn-a"],
    expectedLatestTurnHash: "turn-a",
    expectedLatestUsageRequired: true,
    expectedLatestUserMessageCount: 1,
    expectedLatestUserMessageDuplicateCount: 0,
    expectedLatestTaskCardUserMessageCount: 2,
    expectedTurnShapes: [{ turnHash: "turn-a" }],
  }, {
    label: "sample",
    delayMs: 100,
  });

  assert.equal(input.threadId, "private-thread-id");
  assert.equal(input.expectedLatestTaskCardUserMessageCount, 2);
  assert.deepEqual(input.expectedTurnShapes, [{ turnHash: "turn-a" }]);
  assert.match(
    script.run.toString(),
    /let snapshotPlan = await refreshThreadPlanEntry\(options, key, entry\);\s+for \(const delayMs of options\.sampleDelaysMs\)/,
  );
  assert.match(script.run.toString(), /if \(delayMs >= options\.minSettledDelayMs\)/);
  assert.match(script.run.toString(), /snapshotPlan = await refreshThreadPlanEntry\(options, key, snapshotPlan\);/);
  assert.match(script.run.toString(), /snapshotExpression\(snapshotInputForPlanEntry\(snapshotPlan/);
  assert.match(script.run.toString(), /snapshotExpression\(snapshotInputForPlanEntry\(submitPostPlan/);
});

test("browser runtime self-check script exposes thread-list interaction probe", () => {
  const expression = script.threadListInteractionProbeExpression("thread-list-test");

  assert.match(expression, /thread-list-interaction/);
  assert.match(expression, /threadListProbeElapsedMs/);
  assert.match(expression, /threadListMaxRafDelayMs/);
  assert.match(expression, /threadListMaxScrollApplyMs/);
  assert.match(expression, /longTaskMaxDurationMs/);
});

test("browser runtime self-check script exposes thread-list stress probe", () => {
  const expression = script.threadListStressProbeExpression("thread-list-stress", 2);

  assert.match(expression, /thread-list-stress/);
  assert.match(expression, /stressProbe/);
  assert.match(expression, /openMenu/);
  assert.match(expression, /data-thread/);
  assert.match(expression, /threadListMaxRafDelayMs/);
});

test("browser runtime self-check exposes explicit composer submit exercise", () => {
  const expression = script.submitComposerExpression("Codex Mobile self-check test. Reply exactly: OK");

  assert.match(expression, /requestSubmit/);
  assert.match(expression, /messageInput/);
  assert.match(expression, /sendMessage/);
  assert.match(expression, /InputEvent/);
  assert.doesNotMatch(expression, /document\.cookie|Authorization|Bearer/);
});

test("browser runtime self-check route and console classifiers are bounded", () => {
  assert.equal(script.routeKind("http://127.0.0.1:8787/api/threads/private-id?key=secret"), "thread_detail");
  assert.equal(script.routeKind("http://127.0.0.1:8787/api/client-events?key=secret"), "client_events");
  assert.equal(script.routeKind("http://127.0.0.1:8787/private/path?cookie=value"), "other");
  assert.equal(script.safeConsoleText("Failed to load resource: the server responded with a status of 500"), "resource_load_failed");
  assert.equal(script.safeConsoleText("Uncaught TypeError: private value"), "uncaught");
});

test("browser runtime self-check launches Chrome in a cleanup-owned process group", () => {
  assert.match(scriptSource, /const activeChromeCleanups = new Set\(\)/);
  assert.match(scriptSource, /function cleanupChromeChild\(/);
  assert.match(scriptSource, /process\.kill\(-child\.pid, signal\)/);
  assert.match(scriptSource, /function installChromeCleanupHandlers\(/);
  assert.match(scriptSource, /process\.once\("exit"/);
  assert.match(scriptSource, /process\.once\(signal/);
  assert.match(scriptSource, /detached:\s*true/);
  assert.match(scriptSource, /activeChromeCleanups\.add\(cleanup\)/);
  assert.match(scriptSource, /activeChromeCleanups\.delete\(cleanup\)/);
});
