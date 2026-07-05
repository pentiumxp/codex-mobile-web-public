"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

async function loadAssetGraphModule() {
  return import("../scripts/frontend-shell-asset-graph.mjs");
}

async function loadShellManifestGenerator() {
  return import("../scripts/generate-frontend-shell-manifest.mjs");
}

function createMemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    snapshot() {
      return Object.fromEntries(values.entries());
    },
  };
}

test("Vite shell asset graph covers the current ordered frontend shell", async () => {
  const { buildShellAssetManifest } = await loadAssetGraphModule();
  const manifest = buildShellAssetManifest(path.resolve(__dirname, ".."));
  assert.equal(manifest.validation.ok, true);
  assert.match(manifest.shellCacheName, /^codex-mobile-shell-v625-[a-f0-9]{12}$/);
  assert.match(manifest.clientBuildId, /^0\.1\.11\|codex-mobile-shell-v625-[a-f0-9]{12}$/);
  assert.equal(manifest.indexScriptAssets[0], "/shell-asset-manifest.js");
  assert.equal(manifest.indexScriptAssets.at(-1), "/app.js");
  assert.ok(manifest.indexScriptAssets.includes("/app-bootstrap.js"));
  assert.ok(manifest.indexScriptAssets.includes("/runtime-wiring-runtime.js"));
  assert.ok(manifest.indexScriptAssets.includes("/app-shell-runtime.js"));
  assert.ok(manifest.swStaticAssets.includes("/pane-layout-runtime.js"));
  assert.ok(manifest.swStaticAssets.includes("/shell-asset-manifest.json"));
  assert.ok(manifest.pageShellAssets.includes("/sw.js"));
  assert.ok(manifest.serverHashAssets.includes("/app-shell-runtime.js"));
  assert.ok(manifest.serverHashAssets.includes("/shell-asset-manifest.json"));
  assert.equal(manifest.entryGroups.length, 6);
  assert.ok(manifest.classicGlobalExports.length >= 50);
  const appBootstrapExports = manifest.classicGlobalExports.find((entry) => entry.asset === "/app-bootstrap.js");
  assert.ok(appBootstrapExports);
  for (const name of ["$", "CLIENT_BUILD_ID", "PAGE_SHELL_ASSETS", "apiClient", "draftStore", "fetchPublicConfigWithRetry", "state"]) {
    assert.ok(appBootstrapExports.globals.includes(name), `missing app-bootstrap global ${name}`);
  }
  const appBootstrapSource = fs.readFileSync(path.join(__dirname, "..", "public", "app-bootstrap.js"), "utf8");
  const appBootstrapAssignBlock = appBootstrapSource.match(/Object\.assign\(root, \{([\s\S]*?)\}\);/);
  assert.ok(appBootstrapAssignBlock);
  const assignedBootstrapGlobals = new Set(
    Array.from(appBootstrapAssignBlock[1].matchAll(/"([^"]+)"\s*:/g), (match) => match[1])
  );
  assert.deepEqual(
    appBootstrapExports.globals.filter((name) => !assignedBootstrapGlobals.has(name)),
    []
  );
  assert.match(appBootstrapSource, /function appBootstrapGlobalRoot\(\)/);
  assert.match(appBootstrapSource, /threadDetailRuntime = root && root\.threadDetailRuntime \|\| null/);
  assert.match(appBootstrapSource, /if \(!appUpdateRuntime && root && root\.appUpdateRuntime\) appUpdateRuntime = root\.appUpdateRuntime/);
  assert.match(appBootstrapSource, /root\.appUpdateRuntime = appUpdateRuntime/);
  assert.deepEqual(
    manifest.classicGlobalExports.find((entry) => entry.asset === "/runtime-wiring-runtime.js").globals,
    ["CodexRuntimeWiringRuntime"]
  );
  assert.deepEqual(
    manifest.classicGlobalExports.find((entry) => entry.asset === "/app-shell-runtime.js").globals,
    ["CodexAppShellRuntime"]
  );
  assert.deepEqual(
    manifest.classicGlobalExports.find((entry) => entry.asset === "/app.js").globals,
    ["CodexMobileAppEntry"]
  );
  assert.ok(manifest.startupGlobalContracts.length > 30);
  assert.deepEqual(
    manifest.startupGlobalContracts.find((entry) => entry.name === "CodexRuntimeWiringRuntime"),
    {
      name: "CodexRuntimeWiringRuntime",
      asset: "/runtime-wiring-runtime.js",
      groupId: "app-entry",
      startupCritical: true,
      source: "startup-window-guard",
      present: true,
    }
  );
  assert.deepEqual(
    manifest.startupGlobalContracts.find((entry) => entry.name === "CodexThreadDetailRuntime"),
    {
      name: "CodexThreadDetailRuntime",
      asset: "/thread-detail-runtime.js",
      groupId: "feature-runtimes",
      startupCritical: false,
      source: "startup-window-guard",
      present: true,
    }
  );
  assert.deepEqual(
    manifest.startupGlobalContracts.find((entry) => entry.name === "state"),
    {
      name: "state",
      asset: "/app-bootstrap.js",
      groupId: "bootstrap-state",
      startupCritical: true,
      source: "app-bootstrap-script-global",
      present: true,
    }
  );
  assert.deepEqual(
    manifest.startupGlobalContracts.find((entry) => entry.name === "apiClient"),
    {
      name: "apiClient",
      asset: "/app-bootstrap.js",
      groupId: "bootstrap-state",
      startupCritical: true,
      source: "app-bootstrap-script-global",
      present: true,
    }
  );
  assert.deepEqual(
    manifest.entryGroups.flatMap((group) => group.assets),
    manifest.indexScriptAssets
  );
  const groupsById = new Map(manifest.entryGroups.map((group) => [group.id, group]));
  assert.deepEqual(groupsById.get("bootstrap-state").assets, ["/app-bootstrap.js"]);
  assert.deepEqual(groupsById.get("app-entry").assets, [
    "/runtime-wiring-runtime.js",
    "/app-shell-runtime.js",
    "/app.js",
  ]);
  assert.equal(groupsById.get("bootstrap-state").startupCritical, true);
  assert.equal(groupsById.get("app-entry").startupCritical, true);
  assert.equal(groupsById.get("feature-runtimes").startupCritical, false);
  assert.equal(groupsById.get("shell-services").startupCritical, false);
  assert.ok(manifest.assets.some((asset) => asset.path === "/" && asset.sourcePath === "public/index.html"));
  assert.ok(manifest.assets.every((asset) => asset.exists));
});

test("classic shell cache name changes when static shell asset contents change", async () => {
  const { buildPublicShellManifest } = await loadShellManifestGenerator();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-shell-cache-hash-"));
  fs.mkdirSync(path.join(root, "public"), { recursive: true });
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ version: "0.1.11" }));
  fs.writeFileSync(path.join(root, "public", "manifest.json"), JSON.stringify({ icons: [] }));
  fs.writeFileSync(path.join(root, "public", "styles.css"), ".app{}\n");
  fs.writeFileSync(path.join(root, "public", "index.html"), [
    "<!doctype html>",
    "<link rel=\"stylesheet\" href=\"/styles.css\">",
    "<script src=\"/shell-asset-manifest.js\"></script>",
    "<script src=\"/a.js\"></script>",
  ].join("\n"));
  fs.writeFileSync(path.join(root, "public", "sw.js"), "importScripts(\"/shell-asset-manifest.js\");\n");
  fs.writeFileSync(path.join(root, "public", "a.js"), "\"use strict\";\nwindow.A = 1;\n");

  const first = buildPublicShellManifest(root);
  fs.writeFileSync(path.join(root, "public", "a.js"), "\"use strict\";\nwindow.A = 2;\n");
  const second = buildPublicShellManifest(root);

  assert.match(first.shellCacheName, /^codex-mobile-shell-v625-[a-f0-9]{12}$/);
  assert.match(second.shellCacheName, /^codex-mobile-shell-v625-[a-f0-9]{12}$/);
  assert.notEqual(second.shellCacheName, first.shellCacheName);
  assert.notEqual(second.clientBuildId, first.clientBuildId);
});

test("native ESM build refresh policy matches the classic public API", async () => {
  const classicApi = require("../public/build-refresh-policy.js");
  const nativeApi = await import("../frontend/native/build-refresh-policy.mjs");
  const cases = [
    ["0.1.11|codex-mobile-shell-v626", "0.1.11|codex-mobile-shell-v625"],
    ["0.1.11|codex-mobile-shell-v624", "0.1.11|codex-mobile-shell-v625"],
    ["0.1.11|codex-mobile-shell-v625", "0.1.11|codex-mobile-shell-v625"],
    ["build-a", "build-b"],
  ];
  for (const [serverBuildId, clientBuildId] of cases) {
    assert.equal(
      nativeApi.shellSequenceFromBuildId(serverBuildId),
      classicApi.shellSequenceFromBuildId(serverBuildId)
    );
    assert.equal(
      nativeApi.classifyServerBuildChange(serverBuildId, clientBuildId),
      classicApi.classifyServerBuildChange(serverBuildId, clientBuildId)
    );
    assert.equal(
      nativeApi.shouldPromptForServerBuildChange(serverBuildId, clientBuildId),
      classicApi.shouldPromptForServerBuildChange(serverBuildId, clientBuildId)
    );
    assert.equal(
      nativeApi.default.classifyServerBuildChange(serverBuildId, clientBuildId),
      classicApi.classifyServerBuildChange(serverBuildId, clientBuildId)
    );
  }
});

test("native ESM pure utility modules match the classic public APIs", async () => {
  const classicThreadListLoadPolicy = require("../public/thread-list-load-policy.js");
  const nativeThreadListLoadPolicy = await import("../frontend/native/thread-list-load-policy.mjs");
  for (const input of [
    {},
    { silent: true, documentHidden: true },
    { silent: true, documentHidden: true, allowHidden: true, selectedCwd: "/Users/example" },
    { silent: true, threadDetailOpening: true },
    { silent: true, threadDetailOpening: true, allowDuringDetail: true, threadListLoadedAtMs: 100 },
    { silent: true, threadDetailOpening: true, deferFallback: false },
    { silent: false, search: " owner " },
  ]) {
    assert.deepEqual(
      nativeThreadListLoadPolicy.planThreadListLoadRequest(input),
      classicThreadListLoadPolicy.planThreadListLoadRequest(input),
    );
    assert.deepEqual(
      nativeThreadListLoadPolicy.default.planThreadListLoadRequest(input),
      classicThreadListLoadPolicy.planThreadListLoadRequest(input),
    );
  }

  const classicViewportMetrics = require("../public/viewport-metrics.js");
  const nativeViewportMetrics = await import("../frontend/native/viewport-metrics.mjs");
  for (const value of [0, 0.4, 10.6, "22.4", -3, "bad"]) {
    assert.equal(nativeViewportMetrics.cssPixel(value), classicViewportMetrics.cssPixel(value));
  }
  for (const input of [
    { previous: 100, next: 100.5 },
    { previous: 100, next: 103, options: { epsilonPx: 2 } },
    { previous: 0, next: 1 },
    { previous: 2, next: 0 },
  ]) {
    assert.equal(
      nativeViewportMetrics.stablePixelChanged(input.previous, input.next, input.options),
      classicViewportMetrics.stablePixelChanged(input.previous, input.next, input.options),
    );
  }
  for (const element of [
    null,
    { tagName: "textarea", disabled: false, readOnly: false },
    { tagName: "input", type: "text", disabled: false, readOnly: false },
    { tagName: "input", type: "checkbox", disabled: false, readOnly: false },
    { tagName: "div", isContentEditable: true },
  ]) {
    assert.equal(
      nativeViewportMetrics.isKeyboardEditable(element),
      classicViewportMetrics.isKeyboardEditable(element),
    );
  }
  for (const input of [
    { visualHeight: 700, visualOffsetTop: 0, innerHeight: 700 },
    { visualHeight: 420, visualOffsetTop: 120, innerHeight: 800, keyboardInputActive: true },
    { innerHeight: 900, hostKeyboardVisible: true, hostKeyboardBottomInset: 260, hostViewportHeight: 640 },
  ]) {
    assert.deepEqual(
      nativeViewportMetrics.measureViewport(input),
      classicViewportMetrics.measureViewport(input),
    );
  }

  const classicRuntimeSettings = require("../public/runtime-settings.js");
  const nativeRuntimeSettings = await import("../frontend/native/runtime-settings.mjs");
  const settingsCases = [
    { selected: "gpt-5.4-mini", defaultValue: "gpt-5.2", options: ["gpt-5.5"] },
    { selected: "", defaultValue: "gpt-5.2", options: ["gpt-5.4"] },
    { selected: "full-access", defaultValue: "auto-review", options: ["config.toml"] },
    { selected: "", defaultValue: "", options: ["workspace-write"] },
  ];
  assert.deepEqual(
    nativeRuntimeSettings.normalizeOptionList([" gpt-5.4 ", "", "gpt-5.4", "gpt-5.5"]),
    classicRuntimeSettings.normalizeOptionList([" gpt-5.4 ", "", "gpt-5.4", "gpt-5.5"]),
  );
  for (const value of ["gpt-5.5", "gpt-5.3-codex-spark", "custom-model"]) {
    assert.equal(nativeRuntimeSettings.labelForModel(value), classicRuntimeSettings.labelForModel(value));
    assert.equal(nativeRuntimeSettings.compactLabelForModel(value), classicRuntimeSettings.compactLabelForModel(value));
  }
  for (const value of ["low", "xhigh", "unknown"]) {
    assert.equal(nativeRuntimeSettings.labelForEffort(value), classicRuntimeSettings.labelForEffort(value));
  }
  for (const value of ["full", "full-access", "workspace-write", "config.toml", ""]) {
    assert.equal(nativeRuntimeSettings.labelForPermissionMode(value), classicRuntimeSettings.labelForPermissionMode(value));
    assert.equal(nativeRuntimeSettings.titleForPermissionMode(value), classicRuntimeSettings.titleForPermissionMode(value));
    assert.equal(nativeRuntimeSettings.normalizePermissionModeValue(value), classicRuntimeSettings.normalizePermissionModeValue(value));
  }
  for (const settings of settingsCases) {
    assert.equal(nativeRuntimeSettings.selectedNewThreadModel(settings), classicRuntimeSettings.selectedNewThreadModel(settings));
    assert.equal(nativeRuntimeSettings.selectedNewThreadEffort(settings), classicRuntimeSettings.selectedNewThreadEffort(settings));
    assert.equal(nativeRuntimeSettings.selectedNewThreadPermission(settings), classicRuntimeSettings.selectedNewThreadPermission(settings));
  }
});

test("native ESM draft store and image compressor match classic fallback behavior", async () => {
  const classicDraftStore = require("../public/draft-store.js");
  const nativeDraftStore = await import("../frontend/native/draft-store.mjs");
  assert.deepEqual(nativeDraftStore.DEFAULTS, classicDraftStore.DEFAULTS);
  assert.equal(
    nativeDraftStore.defaultNormalizeFsPath("\\\\?\\C:/Users/Owner/Project/"),
    classicDraftStore.defaultNormalizeFsPath("\\\\?\\C:/Users/Owner/Project/"),
  );
  for (const raw of ["", "{\"a\":{\"text\":\"hello\"}}", "[]", "{bad"]) {
    assert.deepEqual(nativeDraftStore.parseDraftMap(raw), classicDraftStore.parseDraftMap(raw));
  }
  for (const draft of [
    null,
    {},
    { text: "  " },
    { text: "hello" },
    { attachments: [{ id: "a" }] },
    { fastMode: true },
  ]) {
    assert.equal(nativeDraftStore.draftHasContent(draft), classicDraftStore.draftHasContent(draft));
  }
  const attachment = { id: 77, file: { name: "shot.png", type: "image/png", size: 42, lastModified: 123 } };
  assert.deepEqual(nativeDraftStore.normalizeAttachmentMeta(attachment), classicDraftStore.normalizeAttachmentMeta(attachment));
  assert.equal(
    nativeDraftStore.attachmentStorageKey("new:C:\\Project", "a/b"),
    classicDraftStore.attachmentStorageKey("new:C:\\Project", "a/b"),
  );

  const nativeStorage = createMemoryStorage();
  const classicStorage = createMemoryStorage();
  const nativeStore = nativeDraftStore.createDraftStore({ storage: nativeStorage, maxDrafts: 2 });
  const classicStore = classicDraftStore.createDraftStore({ storage: classicStorage, maxDrafts: 2 });
  assert.equal(nativeStore.keyForThread(" thread-a "), classicStore.keyForThread(" thread-a "));
  assert.equal(nativeStore.keyForNewThread("C:/Work/App/"), classicStore.keyForNewThread("C:/Work/App/"));
  const drafts = {
    a: { text: "older", updatedAt: 1 },
    b: { text: "newer", updatedAt: 3 },
    c: { text: "middle", updatedAt: 2 },
  };
  nativeStore.writeMap(drafts);
  classicStore.writeMap(drafts);
  assert.deepEqual(nativeStore.readMap(), classicStore.readMap());
  assert.deepEqual(nativeStorage.snapshot(), classicStorage.snapshot());
  nativeStore.setTargetKey("thread:a");
  classicStore.setTargetKey("thread:a");
  assert.equal(nativeStore.getTargetKey(), classicStore.getTargetKey());
  nativeStore.clearTargetKeyIfMatches("thread:a");
  classicStore.clearTargetKeyIfMatches("thread:a");
  assert.equal(nativeStore.getTargetKey(), classicStore.getTargetKey());

  const classicImageCompressor = require("../public/image-compressor.js");
  const nativeImageCompressor = await import("../frontend/native/image-compressor.mjs");
  assert.deepEqual(nativeImageCompressor.DEFAULT_OPTIONS, classicImageCompressor.DEFAULT_OPTIONS);
  for (const file of [
    null,
    { type: "image/png", size: 256 * 1024 },
    { type: "image/gif", size: 999999 },
    { type: "image/jpeg", size: 1024 },
  ]) {
    assert.equal(
      nativeImageCompressor.isCompressibleImageFile(file),
      classicImageCompressor.isCompressibleImageFile(file),
    );
  }
  for (const dims of [
    [4000, 2000, 1280],
    [640, 480, 1280],
    [0, 0, 0],
  ]) {
    assert.deepEqual(
      nativeImageCompressor.targetDimensions(...dims),
      classicImageCompressor.targetDimensions(...dims),
    );
  }
  for (const [name, type] of [
    ["photo.png", "image/jpeg"],
    ["folder/name.webp", "image/webp"],
    ["", ""],
  ]) {
    assert.equal(
      nativeImageCompressor.compressedImageName(name, type),
      classicImageCompressor.compressedImageName(name, type),
    );
  }
  for (const input of [
    [{ size: 1000 }, { size: 900 }],
    [{ size: 1000 }, { size: 950 }],
    [{ size: 0 }, { size: 1 }],
    [{ size: 1000 }, null],
  ]) {
    assert.equal(
      nativeImageCompressor.shouldUseCompressedBlob(input[0], input[1]),
      classicImageCompressor.shouldUseCompressedBlob(input[0], input[1]),
    );
  }
});

test("native ESM conversation scroll matches classic fallback behavior", async () => {
  const classicConversationScroll = require("../public/conversation-scroll.js");
  const nativeConversationScroll = await import("../frontend/native/conversation-scroll.mjs");
  assert.deepEqual(
    nativeConversationScroll.DEFAULT_BOTTOM_FOLLOW_DELAYS_MS,
    classicConversationScroll.DEFAULT_BOTTOM_FOLLOW_DELAYS_MS,
  );
  for (const metrics of [
    { scrollHeight: 1800, scrollTop: 725, clientHeight: 980 },
    { scrollHeight: 1800, scrollTop: 640, clientHeight: 980 },
    { scrollHeight: "800", scrollTop: "600", clientHeight: "160" },
  ]) {
    assert.equal(nativeConversationScroll.isNearBottom(metrics), classicConversationScroll.isNearBottom(metrics));
  }
  const submittedFollow = { threadId: "thread-a", clientSubmissionId: "submit-1", untilMs: 6000 };
  for (const input of [
    ["thread-a", { clientSubmissionId: "submit-1", nowMs: 1000, ttlMs: 5000 }],
    ["", { clientSubmissionId: "submit-1", nowMs: 1000, ttlMs: 5000 }],
  ]) {
    assert.deepEqual(
      nativeConversationScroll.createSubmittedMessageFollow(input[0], input[1]),
      classicConversationScroll.createSubmittedMessageFollow(input[0], input[1]),
    );
  }
  for (const input of [
    { threadId: "thread-a", nowMs: 5999 },
    { threadId: "thread-b", nowMs: 2000 },
    { threadId: "thread-a", nowMs: 6001 },
  ]) {
    assert.equal(
      nativeConversationScroll.shouldFollowSubmittedMessage(submittedFollow, input),
      classicConversationScroll.shouldFollowSubmittedMessage(submittedFollow, input),
    );
  }
  for (const input of [
    { nearBottom: true, nowMs: 10000 },
    { nearBottom: false, nowMs: 10000, lastNearBottomAtMs: 7000, recentBottomMs: 5000 },
    { nearBottom: false, nowMs: 10000, lastNearBottomAtMs: 4000, recentBottomMs: 5000 },
  ]) {
    assert.equal(nativeConversationScroll.shouldStartViewportFollow(input), classicConversationScroll.shouldStartViewportFollow(input));
  }
  const planCases = [
    ["planBottomFollowLeaseEvaluation", { userReadingCurrentTurn: true, leaseActive: true, hasLease: true }],
    ["planBottomFollowScrollSchedule", undefined],
    ["planLocalPatchScrollCompletion", { submittedMessageFollow: true }],
    ["planLocalPatchScrollCompletion", { userReadingCurrentTurn: true, nearBottom: true }],
    ["planConversationJumpButtons", { hasThread: true, isScrollable: true, nearBottom: false, hasReplyTarget: true, replyTargetAbove: true }],
    ["planUserReadingCurrentTurn", { nearBottom: false, recentScrollIntent: true, hasCurrentTurn: true }],
    ["planConversationAutoScrollHoldFromScroll", { nearBottom: false, recentScrollIntent: true, hasCurrentTurn: true }],
    ["planFullRenderScroll", { submittedMessageFollow: true, autoScrollHold: true }],
    ["planFullRenderScroll", { viewportFollow: true }],
    ["planReadingViewportPreservation", { nearBottom: false, userReadingAwayFromBottom: true }],
    ["planAutomaticConversationRefresh", { hasThread: true, nearBottom: false, recentScrollIntent: true }],
    ["planAutomaticConversationRefresh", { hasThread: true, nearBottom: false, recentScrollIntent: true, userInitiated: true }],
  ];
  for (const [fn, input] of planCases) {
    assert.deepEqual(nativeConversationScroll[fn](input), classicConversationScroll[fn](input));
    assert.deepEqual(nativeConversationScroll.default[fn](input), classicConversationScroll[fn](input));
  }
});

test("native ESM thread detail state matches classic fallback behavior", async () => {
  const classicThreadDetailState = require("../public/thread-detail-state.js");
  const nativeThreadDetailState = await import("../frontend/native/thread-detail-state.mjs");
  const loadedThread = {
    id: "thread-a",
    title: "Thread A",
    status: "completed",
    mobileDetailLoaded: true,
    mobileLoading: false,
    turns: [{
      id: "turn-a",
      status: "completed",
      items: [{ type: "userMessage", text: "hello", clientSubmissionId: "submit-a" }],
    }],
    mobileProjection: { source: "sample" },
    runtimeSettings: { model: "test" },
  };
  assert.deepEqual(
    nativeThreadDetailState.threadListSummaryFromDetailThread(loadedThread),
    classicThreadDetailState.threadListSummaryFromDetailThread(loadedThread),
  );
  for (const input of [
    loadedThread,
    Object.assign({}, loadedThread, { mobileLoading: true }),
    Object.assign({}, loadedThread, { turns: [] }),
  ]) {
    assert.equal(
      nativeThreadDetailState.threadHasLoadedDetailState(input),
      classicThreadDetailState.threadHasLoadedDetailState(input),
    );
    assert.equal(
      nativeThreadDetailState.threadHasReusableLoadedDetailState(input),
      classicThreadDetailState.threadHasReusableLoadedDetailState(input),
    );
    assert.equal(
      nativeThreadDetailState.threadHasVisualBaselineLoadedDetailState(input),
      classicThreadDetailState.threadHasVisualBaselineLoadedDetailState(input),
    );
  }
  for (const input of [
    { currentThread: loadedThread, threadId: "thread-a" },
    { currentThread: loadedThread, threadId: "thread-b" },
    { currentThread: null, threadId: "thread-a" },
  ]) {
    assert.deepEqual(
      nativeThreadDetailState.planThreadOpenCacheReuse(input),
      classicThreadDetailState.planThreadOpenCacheReuse(input),
    );
  }
  const policyOptions = {
    itemVisibleWeight(item) {
      if (item && Object.prototype.hasOwnProperty.call(item, "weight")) return Number(item.weight) || 0;
      return JSON.stringify(item || {}).length;
    },
    isContextCompactionItem(item) {
      return Boolean(item && item.type === "contextCompaction");
    },
    isOperationalItem(item) {
      return Boolean(item && item.type === "commandExecution");
    },
    isAssistantReceiptLikeItem(item) {
      return Boolean(item && (item.type === "agentMessage" || item.type === "plan"));
    },
    isTurnComplete(turn) {
      return Boolean(turn && turn.status === "completed");
    },
    isReasoningItem(item) {
      return Boolean(item && item.type === "reasoning");
    },
    visualReceiptMatchesSuppressionKeys(item, keys) {
      return Boolean(item && keys && keys.has(item.suppressionKey));
    },
  };
  const classicPolicy = classicThreadDetailState.createThreadDetailStatePolicy(policyOptions);
  const nativePolicy = nativeThreadDetailState.createThreadDetailStatePolicy(policyOptions);
  assert.deepEqual(
    nativePolicy.mergeItemPreservingVisibleFields({
      id: "existing",
      type: "agentMessage",
      text: "longer visible response",
      weight: 100,
    }, {
      id: "incoming",
      type: "agentMessage",
      text: "short",
      status: "completed",
      weight: 10,
    }),
    classicPolicy.mergeItemPreservingVisibleFields({
      id: "existing",
      type: "agentMessage",
      text: "longer visible response",
      weight: 100,
    }, {
      id: "incoming",
      type: "agentMessage",
      text: "short",
      status: "completed",
      weight: 10,
    }),
  );
  assert.equal(
    nativePolicy.shouldPreserveLocalOnlyItem({ id: "mux-user-1", type: "userMessage", weight: 10 }, false),
    classicPolicy.shouldPreserveLocalOnlyItem({ id: "mux-user-1", type: "userMessage", weight: 10 }, false),
  );
  assert.deepEqual(
    nativeThreadDetailState.default.planSummaryOnlyCurrentThreadRecoveryEffects({
      plan: { shouldRecover: true, reason: "summary-only-current" },
      threadId: "thread-a",
      seq: 4,
    }),
    classicThreadDetailState.planSummaryOnlyCurrentThreadRecoveryEffects({
      plan: { shouldRecover: true, reason: "summary-only-current" },
      threadId: "thread-a",
      seq: 4,
    }),
  );
});

test("native ESM thread detail render plan matches classic fallback behavior", async () => {
  const classicRenderPlan = require("../public/thread-detail-render-plan.js");
  const nativeRenderPlan = await import("../frontend/native/thread-detail-render-plan.mjs");
  for (const value of ["abc", 42, null, undefined]) {
    assert.equal(nativeRenderPlan.normalizeSignature(value), classicRenderPlan.normalizeSignature(value));
  }
  for (const input of [
    {
      threadId: "thread-a",
      threadLoadSeq: 7,
      options: { source: "resume" },
      hasActiveRefreshController: true,
    },
    {
      currentThreadId: "thread-b",
      threadLoadSeq: 3,
      options: { mode: "full", source: "manual", force: true },
      documentHidden: true,
      hasActiveThreadLoadController: true,
    },
    {
      threadLoadSeq: 4,
      options: { source: "ignored" },
      hasActiveRefreshController: true,
    },
  ]) {
    assert.deepEqual(
      nativeRenderPlan.planThreadDetailRefreshRequest(input),
      classicRenderPlan.planThreadDetailRefreshRequest(input),
    );
  }
  const backfillInput = {
    thread: {
      id: "thread-workflow",
      mobileOlderTurnsCursor: "cursor-a",
      turns: [
        { items: [{ type: "agentMessage", text: "Task card id: ttc_a\nReturn policy: terminal" }] },
        { items: [{ type: "agentMessage", text: "Source workspace: /workspace\nApproval: bypassed" }] },
        { items: [{ type: "agentMessage", text: "Workflow mode: autonomous\nAuto-return: yes" }] },
        { items: [{ type: "userMessage", text: "normal user message" }] },
      ],
    },
  };
  assert.deepEqual(
    nativeRenderPlan.planThreadDetailHistoryAutoBackfill(backfillInput),
    classicRenderPlan.planThreadDetailHistoryAutoBackfill(backfillInput),
  );
  const shellInput = {
    thread: { id: "thread-a", title: "Thread A" },
    escapedTitle: "Thread A",
    mainHtml: "<article>content</article>",
    pluginNoticeHtml: "<div>notice</div>",
    emptyStateHtml: "",
    loadErrorHtml: "",
  };
  assert.deepEqual(
    nativeRenderPlan.planSingleThreadFullRenderShell(shellInput),
    classicRenderPlan.planSingleThreadFullRenderShell(shellInput),
  );
  const patchInput = {
    patchSurface: { patchable: true, reason: "single-thread", surface: "single-thread" },
    renderPlan: { action: "patch", reason: "stable", signature: "sig-a" },
    patchAttempt: { ok: true, patched: true, reason: "patched", elapsedMs: 4 },
  };
  assert.deepEqual(
    nativeRenderPlan.default.planThreadDetailRefreshOutcomeExecution(patchInput),
    classicRenderPlan.planThreadDetailRefreshOutcomeExecution(patchInput),
  );
});

test("native ESM thread detail patch and merge helpers match classic fallback behavior", async () => {
  const classicPatchPlan = require("../public/thread-detail-patch-plan.js");
  const nativePatchPlan = await import("../frontend/native/thread-detail-patch-plan.mjs");
  const visiblePatchInput = [
    [{ key: "user-1", signature: { type: "userMessage", text: "request" } }],
    [
      { key: "user-1", signature: { type: "userMessage", text: "request" } },
      { key: "usage-1", signature: { type: "turnUsageSummary", total: 12 } },
    ],
  ];
  assert.deepEqual(
    nativePatchPlan.planVisibleItemRefreshPatch(...visiblePatchInput),
    classicPatchPlan.planVisibleItemRefreshPatch(...visiblePatchInput),
  );
  const patchSurfaceInput = {
    threadId: "thread-1",
    threadTileMode: true,
    threadTileSurface: true,
    tilePaneVisible: true,
    conversationPresent: true,
  };
  assert.deepEqual(
    nativePatchPlan.planThreadDetailDomPatchSurface(patchSurfaceInput),
    classicPatchPlan.planThreadDetailDomPatchSurface(patchSurfaceInput),
  );
  const domPatchInput = {
    nextTurnEntries: [
      { key: "turn-1", articlePresent: true, itemPatchable: true, hasPreviousTurn: true },
      { key: "turn-2", articlePresent: false, itemPatchable: false, hasPreviousTurn: false },
    ],
    previousTurnKeys: ["turn-1", "turn-old"],
  };
  assert.deepEqual(
    nativePatchPlan.default.planThreadDetailRefreshDomPatch(domPatchInput),
    classicPatchPlan.planThreadDetailRefreshDomPatch(domPatchInput),
  );

  const classicMergeState = require("../public/thread-detail-merge-state.js");
  const nativeMergeState = await import("../frontend/native/thread-detail-merge-state.mjs");
  const sortTurnsForDisplay = (turns) => (turns || []).slice().sort((left, right) => (
    Number(left && (left.completedAtMs || left.startedAtMs) || 0)
    - Number(right && (right.completedAtMs || right.startedAtMs) || 0)
  ));
  const mergeOptions = {
    normalizeThreadVisibleUserMessages: (thread) => thread,
    turnVisibleWeight: (turn) => (Array.isArray(turn && turn.items) ? turn.items.length : 0),
    shouldPreserveExistingTurnVisibleItems: (existingTurn, incomingTurn) => (
      String(existingTurn && existingTurn.status || "") === "running"
      && String(incomingTurn && incomingTurn.status || "") === "completed"
    ),
    mergeItemsPreservingLocalVisible(existingItems, incomingItems, preserveLocalVisible) {
      if (!preserveLocalVisible) return incomingItems;
      return incomingItems.concat((existingItems || []).filter((item) => item && item.localOnly));
    },
    isTurnComplete: (turn) => String(turn && turn.status || "") === "completed",
    sortTurnsForDisplay,
    threadHasInitialSubmissionEcho: () => true,
  };
  const existingThread = {
    id: "thread-1",
    turns: [
      { id: "turn-b", status: "completed", completedAtMs: 2000, items: [{ id: "b-old" }] },
      { id: "turn-a", status: "running", startedAtMs: 1000, items: [{ id: "a-old" }, { id: "local", localOnly: true }] },
    ],
  };
  const incomingThread = {
    id: "thread-1",
    turns: [
      { id: "turn-a", status: "completed", completedAtMs: 1000, items: [{ id: "a-new" }] },
      { id: "turn-b", status: "completed", completedAtMs: 2000, items: [{ id: "b-new" }] },
    ],
  };
  assert.deepEqual(
    nativeMergeState.createThreadDetailMergePolicy(mergeOptions).mergeThreadPreservingVisibleItems(
      JSON.parse(JSON.stringify(existingThread)),
      JSON.parse(JSON.stringify(incomingThread)),
    ),
    classicMergeState.createThreadDetailMergePolicy(mergeOptions).mergeThreadPreservingVisibleItems(
      JSON.parse(JSON.stringify(existingThread)),
      JSON.parse(JSON.stringify(incomingThread)),
    ),
  );

  const classicV4MergeState = require("../public/thread-detail-v4-merge-state.js");
  const nativeV4MergeState = await import("../frontend/native/thread-detail-v4-merge-state.mjs");
  const comparableText = (item) => String(item && (item.message || item.text || "") || "").trim().toLowerCase();
  const v4Options = {
    normalizeThreadVisibleUserMessages: (thread) => thread,
    turnVisibleWeight: (turn) => (Array.isArray(turn && turn.items) ? turn.items.length : 0),
    isOptimisticUserMessage: (item) => Boolean(item && item.mobilePendingSubmission),
    isRecentlySubmittedUserMessage: (item) => Boolean(item && item.mobilePendingSubmission),
    isReasoningItem: (item) => Boolean(item && item.type === "reasoning"),
    userMessageHasSubmissionId: (item, submissionId) => Boolean(item && submissionId && String(item.clientSubmissionId || "") === String(submissionId)),
    userMessagesCanShadow: (incoming, pending) => Boolean(incoming && pending && incoming.type === "userMessage" && pending.type === "userMessage" && comparableText(incoming) === comparableText(pending)),
    isTurnComplete: (turn) => /completed|failed|cancel|interrupted/i.test(String(turn && (turn.status && turn.status.type || turn.status) || "")),
    isRunningStatus: (status) => /active|running|queued|processing|pending/i.test(String(status && status.type || status || "")),
    isIncompleteInterruptedTurn: () => false,
    turnHasActiveLiveItems: () => false,
    turnOrderMs: (turn) => Number(turn && (turn.completedAtMs || turn.startedAtMs || 0)) || 0,
    mergeTurnPreservingVisibleItems: (existingTurn, incomingTurn) => Object.assign({}, existingTurn, incomingTurn, {
      items: Array.isArray(incomingTurn && incomingTurn.items) ? incomingTurn.items.slice() : [],
    }),
    sortTurnsForDisplay,
    maxVisibleTurnsForThread: () => 10,
  };
  const existingV4Thread = {
    id: "thread-v4",
    mobileProjectionVersion: "v4",
    turns: [{
      id: "pending-turn",
      startedAtMs: 300,
      status: { type: "running" },
      items: [{ id: "local", type: "userMessage", message: "send me", clientSubmissionId: "submit-1", mobilePendingSubmission: true }],
    }],
  };
  const incomingV4Thread = {
    id: "thread-v4",
    mobileProjectionVersion: "v4",
    turns: [{
      id: "durable-turn",
      startedAtMs: 100,
      completedAtMs: 200,
      status: { type: "completed" },
      items: [
        { id: "durable", type: "userMessage", message: "send me", clientSubmissionId: "submit-1" },
        { id: "assistant", type: "agentMessage", text: "done" },
      ],
    }],
  };
  assert.deepEqual(
    nativeV4MergeState.default.createThreadDetailV4MergePolicy(v4Options).mergeV4ProjectionThread(
      JSON.parse(JSON.stringify(existingV4Thread)),
      JSON.parse(JSON.stringify(incomingV4Thread)),
    ),
    classicV4MergeState.createThreadDetailV4MergePolicy(v4Options).mergeV4ProjectionThread(
      JSON.parse(JSON.stringify(existingV4Thread)),
      JSON.parse(JSON.stringify(incomingV4Thread)),
    ),
  );
});

test("native ESM low-risk UI helper modules match classic fallback behavior", async () => {
  const classicStableOrder = require("../public/thread-list-stable-order.js");
  const nativeStableOrder = await import("../frontend/native/thread-list-stable-order.mjs");
  const stableOrderInput = {
    nowMs: 2000,
    selectedCwd: "/workspace",
    threads: [
      { id: "thread-b", updatedAtMs: 1000 },
      { id: "thread-a", updatedAtMs: 900 },
    ],
    previousState: {
      scopeKey: JSON.stringify({ cwd: "/workspace", search: "" }),
      holdUntilMs: 3000,
      order: ["thread-a", "thread-b"],
      updatedAtById: { "thread-a": 900, "thread-b": 1000 },
    },
  };
  assert.deepEqual(
    nativeStableOrder.planThreadListStableOrder(stableOrderInput),
    classicStableOrder.planThreadListStableOrder(stableOrderInput),
  );
  assert.equal(
    nativeStableOrder.default.threadListOrderScopeKey({ selectedCwd: "/workspace", search: "Xcode" }),
    classicStableOrder.threadListOrderScopeKey({ selectedCwd: "/workspace", search: "Xcode" }),
  );

  const classicStatusHints = require("../public/thread-status-hints.js");
  const nativeStatusHints = await import("../frontend/native/thread-status-hints.mjs");
  const statusHintInput = {
    threadId: "thread-a",
    isRunningHinted: true,
    status: { type: "completed" },
    thread: { id: "thread-a", status: { type: "completed" }, updatedAtMs: 1000 },
    runningHintedAtMs: 900,
    nowMs: 2000,
    wasRunning: true,
    eventAtMs: 1100,
  };
  assert.equal(
    nativeStatusHints.shouldExpireRunningThreadHint(statusHintInput),
    classicStatusHints.shouldExpireRunningThreadHint(statusHintInput),
  );
  assert.equal(
    nativeStatusHints.default.shouldMarkThreadUnread({
      thread: { status: { type: "completed" }, updatedAtMs: 3000 },
      wasRunning: true,
      runningHintedAtMs: 2500,
      viewedAtMs: 2000,
      eventAtMs: 3000,
    }),
    classicStatusHints.shouldMarkThreadUnread({
      thread: { status: { type: "completed" }, updatedAtMs: 3000 },
      wasRunning: true,
      runningHintedAtMs: 2500,
      viewedAtMs: 2000,
      eventAtMs: 3000,
    }),
  );

  const classicActions = require("../public/thread-detail-actions.js");
  const nativeActions = await import("../frontend/native/thread-detail-actions.mjs");
  const approvalButton = {
    dataset: {
      approvalAction: "approve-once",
      approvalId: "1688",
      approvalThreadId: "thread-a",
    },
    closest(selector) {
      return selector === "[data-approval-action]" ? this : null;
    },
  };
  assert.deepEqual(
    nativeActions.resolveThreadDetailClickAction({ target: approvalButton }),
    classicActions.resolveThreadDetailClickAction({ target: approvalButton }),
  );
  const copyButton = {
    dataset: { copyKey: "copy-1" },
    closest(selector) {
      return selector === "[data-copy-key]" ? this : null;
    },
  };
  assert.deepEqual(
    nativeActions.default.resolveRichContentClickAction({ target: copyButton }),
    classicActions.resolveRichContentClickAction({ target: copyButton }),
  );
});

test("native ESM thread tile helper modules match classic fallback behavior", async () => {
  const classicLayout = require("../public/thread-tile-layout.js");
  const nativeLayout = await import("../frontend/native/thread-tile-layout.mjs");
  const layoutInput = {
    width: 1440,
    height: 900,
    desiredPaneCount: 4,
    maxPanes: 12,
    recommendedMaxPanes: 6,
    verticalChromePx: 120,
    coarsePointer: false,
    keyboardFocusActive: false,
  };
  assert.deepEqual(
    nativeLayout.layoutForViewport(layoutInput),
    classicLayout.layoutForViewport(layoutInput),
  );
  const columnInput = {
    ids: ["thread-a", "thread-b", "thread-c", "thread-d"],
    columns: 3,
    splitPairs: [{ anchorId: "thread-a", childId: "thread-b" }],
  };
  assert.deepEqual(
    nativeLayout.default.threadTileColumnGroups(columnInput),
    classicLayout.threadTileColumnGroups(columnInput),
  );

  const classicActions = require("../public/thread-tile-actions.js");
  const nativeActions = await import("../frontend/native/thread-tile-actions.mjs");
  const pane = {
    disabled: false,
    getAttribute(name) {
      return name === "data-thread-tile-pane" ? "thread-a" : "";
    },
    closest(selector) {
      return selector === "[data-thread-tile-pane]" ? this : null;
    },
  };
  const title = {
    disabled: false,
    getAttribute(name) {
      return name === "data-thread-tile-title" ? "thread-a" : "";
    },
    closest(selector) {
      if (selector === "[data-thread-tile-title]") return this;
      if (selector === "[data-thread-tile-pane]") return pane;
      return null;
    },
  };
  const actionRoot = { contains(node) { return node === pane || node === title; } };
  assert.deepEqual(
    nativeActions.resolveThreadTilePointerAction({ root: actionRoot, target: title }),
    classicActions.resolveThreadTilePointerAction({ root: actionRoot, target: title }),
  );
  const dragInput = { root: actionRoot, target: pane, draggingId: "thread-b" };
  assert.deepEqual(
    nativeActions.default.resolveThreadTileDragOverAction(dragInput),
    classicActions.resolveThreadTileDragOverAction(dragInput),
  );

  const classicState = require("../public/thread-tile-state.js");
  const nativeState = await import("../frontend/native/thread-tile-state.mjs");
  const paneStateInput = {
    paneCount: 0,
    runningIds: ["thread-live"],
    pinnedIds: ["thread-pinned"],
    candidateIds: ["thread-current", "thread-list"],
    maxCandidateIds: ["thread-current", "thread-list", "thread-live", "thread-pinned"],
    currentThreadId: "thread-current",
    maxPaneCount: 4,
  };
  assert.deepEqual(
    nativeState.paneCountStatePlan(paneStateInput),
    classicState.paneCountStatePlan(paneStateInput),
  );
  const detailQueueInput = {
    ids: ["thread-a", "thread-b", "thread-c"],
    readyIds: ["thread-a"],
    loadingIds: ["thread-b"],
    controllerIds: ["thread-old"],
    maxConcurrentLoads: 2,
  };
  assert.deepEqual(
    nativeState.default.detailLoadQueuePlan(detailQueueInput),
    classicState.detailLoadQueuePlan(detailQueueInput),
  );
});

test("native ESM standalone helper modules match classic fallback behavior", async () => {
  const classicVoiceInput = require("../public/plugin-voice-input.js");
  const nativeVoiceInput = await import("../frontend/native/plugin-voice-input.mjs");
  const voiceInputPayload = {
    actions: ["append", "submit", "replace"],
    composerId: "composer-a",
    threadId: "thread-a",
    draftId: "draft-a",
    maxChars: 24000,
    writable: true,
    requestId: "request-a",
    voiceSessionId: "voice-a",
  };
  assert.deepEqual(
    nativeVoiceInput.startRequestMessage(voiceInputPayload),
    classicVoiceInput.startRequestMessage(voiceInputPayload),
  );
  assert.equal(
    nativeVoiceInput.actionFromMessageType(classicVoiceInput.TYPES.APPEND_TEXT),
    classicVoiceInput.actionFromMessageType(classicVoiceInput.TYPES.APPEND_TEXT),
  );
  assert.equal(
    nativeVoiceInput.default.textFromMessage({ final_text: "  spoken text  " }),
    classicVoiceInput.textFromMessage({ final_text: "  spoken text  " }),
  );

  const classicApiClient = require("../public/api-client.js");
  const nativeApiClient = await import("../frontend/native/api-client.mjs");
  class FakeFormData {}
  assert.equal(
    nativeApiClient.isFormDataBody(new FakeFormData(), FakeFormData),
    classicApiClient.isFormDataBody(new FakeFormData(), FakeFormData),
  );
  function FakeAbortController() {
    this.signal = {
      aborted: false,
      addEventListener() {},
      removeEventListener() {},
    };
    this.abort = () => {
      this.signal.aborted = true;
    };
  }
  const createFetch = (calls) => async (path, options) => {
    calls.push({ path, contentType: options.headers["Content-Type"], key: options.headers["X-Codex-Mobile-Key"] });
    return {
      ok: true,
      status: 200,
      async json() {
        return { ok: true, path };
      },
    };
  };
  const classicApiCalls = [];
  const nativeApiCalls = [];
  assert.deepEqual(
    await nativeApiClient.createApiClient({
      fetch: createFetch(nativeApiCalls),
      AbortControllerCtor: FakeAbortController,
      FormDataCtor: FakeFormData,
      getKey: () => "key-a",
    }).request("/api/test", { method: "POST", body: JSON.stringify({ value: 1 }) }),
    await classicApiClient.createApiClient({
      fetch: createFetch(classicApiCalls),
      AbortControllerCtor: FakeAbortController,
      FormDataCtor: FakeFormData,
      getKey: () => "key-a",
    }).request("/api/test", { method: "POST", body: JSON.stringify({ value: 1 }) }),
  );
  assert.deepEqual(nativeApiCalls, classicApiCalls);

  const classicMarkdown = require("../public/markdown-renderer.js");
  const nativeMarkdown = await import("../frontend/native/markdown-renderer.mjs");
  const markdownSource = [
    "## Links",
    "",
    "[repo](https://example.com/path?q=1) and `code`",
    "",
    "| A | B |",
    "| --- | --- |",
    "| **x** | y |",
  ].join("\n");
  assert.equal(
    nativeMarkdown.renderMarkdown(markdownSource),
    classicMarkdown.renderMarkdown(markdownSource),
  );
  assert.equal(
    nativeMarkdown.default.normalizeMermaidSourceForRender("flowchart TD\nsubgraph Needs Review\nA[Do (work)]\nend"),
    classicMarkdown.normalizeMermaidSourceForRender("flowchart TD\nsubgraph Needs Review\nA[Do (work)]\nend"),
  );

  const classicPluginEmbed = require("../public/plugin-embed.js");
  const nativePluginEmbed = await import("../frontend/native/plugin-embed.mjs");
  const embedUrl = "http://127.0.0.1:8787/?embed=hermes&pluginId=codex-mobile&pluginRoute=task&pluginThreadId=thread-a&pluginTaskId=task-a&pluginTheme=dark";
  assert.deepEqual(
    nativePluginEmbed.detect(embedUrl),
    classicPluginEmbed.detect(embedUrl),
  );
  const routeHint = {
    pluginId: "codex-mobile",
    route: "task",
    threadId: "thread-a",
    taskId: "task-a",
  };
  assert.deepEqual(
    nativePluginEmbed.routeHintOpenPlan(routeHint),
    classicPluginEmbed.routeHintOpenPlan(routeHint),
  );
  assert.deepEqual(
    nativePluginEmbed.default.navigationMessage({ currentThreadId: "thread-a" }, { settingsOpen: true }),
    classicPluginEmbed.navigationMessage({ currentThreadId: "thread-a" }, { settingsOpen: true }),
  );
});

test("native ESM app update runtime matches classic fallback behavior", async () => {
  const classicAppUpdate = require("../public/app-update-runtime.js");
  const nativeAppUpdate = await import("../frontend/native/app-update-runtime.mjs");
  const state = {
    appVersion: "0.1.11",
    appWorkspacePath: "/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web",
    selectedCwd: "/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web",
    publicReleaseEnabled: true,
    publicReleaseRepository: "pentiumxp/codex-mobile-web",
    publicReleaseBranch: "main",
    publicPrEnabled: true,
    publicPrRepository: "pentiumxp/codex-mobile-web",
    workspaces: [
      { cwd: "/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web" },
    ],
    threads: [],
    appUpdateStatus: {
      version: "0.1.11",
      supported: true,
      updateAvailable: true,
      canFastForward: true,
      remote: "origin",
      branch: "main",
      remoteShort: "abc1234",
      remoteUrl: "https://github.com/pentiumxp/codex-mobile-web.git",
    },
  };
  const deps = {
    state,
    CLIENT_BUILD_ID: "0.1.11|codex-mobile-shell-v625-cbb2ef9490a1",
    normalizeFsPath: (value) => String(value || "").toLowerCase(),
    threadMatchesWorkspaceCwd: (a, b) => String(a || "").toLowerCase() === String(b || "").toLowerCase(),
  };
  const classicRuntime = classicAppUpdate.createAppUpdateRuntime(deps);
  const nativeRuntime = nativeAppUpdate.createAppUpdateRuntime(deps);
  assert.equal(
    nativeRuntime.clientBuildVersionText(),
    classicRuntime.clientBuildVersionText(),
  );
  assert.equal(
    nativeRuntime.appVersionText(),
    classicRuntime.appVersionText(),
  );
  assert.equal(
    nativeRuntime.currentUpdateUsesPublicRelease(),
    classicRuntime.currentUpdateUsesPublicRelease(),
  );
  assert.equal(
    nativeRuntime.updateStatusLine(state.appUpdateStatus),
    classicRuntime.updateStatusLine(state.appUpdateStatus),
  );
  assert.equal(
    nativeRuntime.publicReleaseStatusLine({ updateAvailable: false, publicShort: "def5678" }),
    classicRuntime.publicReleaseStatusLine({ updateAvailable: false, publicShort: "def5678" }),
  );
  const publicPrStatus = {
    repository: "pentiumxp/codex-mobile-web",
    openPullRequestCount: 1,
    pullRequests: [{ number: 82, title: "Public release", updatedAt: "2026-07-05T00:00:00Z" }],
    hasOpenPullRequests: true,
  };
  assert.equal(
    nativeRuntime.publicPrPromptKey(publicPrStatus),
    classicRuntime.publicPrPromptKey(publicPrStatus),
  );
  assert.equal(
    nativeRuntime.publicPrSummaryText(publicPrStatus),
    classicRuntime.publicPrSummaryText(publicPrStatus),
  );
  assert.equal(
    nativeRuntime.publicPrReviewWorkspacePath(),
    classicRuntime.publicPrReviewWorkspacePath(),
  );
});

test("native ESM modal runtime preserves classic global dialog helpers", async () => {
  globalThis.CODEX_PROFILE_SWITCH_STAGES = [
    { id: "profile_lookup", label: "读取 Profile" },
  ];
  const classicModal = require("../public/modal-runtime.js");
  const classicRuntime = classicModal.createModalRuntime();
  const classicProgress = globalThis.formatCodexProfileSwitchProgress;
  const classicStageLabel = globalThis.codexProfileSwitchStageLabel;
  const nativeModal = await import("../frontend/native/modal-runtime.mjs");
  const nativeRuntime = nativeModal.createModalRuntime();
  const runtimeKeys = [
    "requestAppNativeDialog",
    "requestAppAlert",
    "requestAppConfirmation",
    "requestAppTextInput",
    "requestCodexProfileSwitchConfirmation",
  ];
  assert.deepEqual(
    Object.fromEntries(runtimeKeys.map((key) => [key, typeof nativeRuntime[key]])),
    Object.fromEntries(runtimeKeys.map((key) => [key, typeof classicRuntime[key]])),
  );
  assert.equal(globalThis.CodexModalRuntime, nativeModal.default);
  assert.equal(typeof globalThis.handleAppNativeDialogKeydown, "function");
  assert.equal(typeof globalThis.closeAppNativeDialog, "function");
  assert.equal(typeof globalThis.performCodexProfileSwitch, "function");
  const progressInput = {
    stage: "profile_lookup",
    message: "",
    stepIndex: 1,
    stepCount: 3,
  };
  assert.equal(
    globalThis.formatCodexProfileSwitchProgress(progressInput),
    classicProgress(progressInput),
  );
  assert.equal(
    globalThis.codexProfileSwitchStageLabel("profile_lookup"),
    classicStageLabel("profile_lookup"),
  );
});

test("native ESM client render guard and live operation dock match classic policies", async () => {
  const classicGuard = require("../public/client-render-stability-guard.js");
  const nativeGuard = await import("../frontend/native/client-render-stability-guard.mjs");
  const sourceTurn = {
    id: "local-turn-submission-secret",
    items: [{ type: "userMessage", clientSubmissionId: "submission-secret", mobilePendingSubmission: true }],
  };
  const nativeSourceTurn = structuredClone(sourceTurn);
  const targetTurn = {
    id: "server-turn-1",
    items: [{ type: "userMessage", clientSubmissionId: "submission-secret" }],
  };
  const nativeTargetTurn = structuredClone(targetTurn);
  const classicKey = classicGuard.markSubmittedTurn(sourceTurn, "submission-secret");
  const nativeKey = nativeGuard.markSubmittedTurn(nativeSourceTurn, "submission-secret");
  assert.equal(nativeKey, classicKey);
  assert.equal(
    nativeGuard.transferSubmittedTurnIdentity(nativeSourceTurn, nativeTargetTurn, "submission-secret"),
    classicGuard.transferSubmittedTurnIdentity(sourceTurn, targetTurn, "submission-secret"),
  );
  assert.equal(nativeGuard.stableTurnIdentity(nativeTargetTurn), classicGuard.stableTurnIdentity(targetTurn));
  assert.equal(globalThis.CodexClientRenderStabilityGuard, nativeGuard.default);

  const classicDock = require("../public/live-operation-dock-state.js");
  const nativeDock = await import("../frontend/native/live-operation-dock-state.mjs");
  const dockInput = {
    itemId: "cmd-1",
    type: "commandExecution",
    status: "running",
    title: "Command",
    detail: "npm   test",
    durationText: "00:00:05",
    durationAttrs: "data-started-at-ms=\"1\" data-ended-at-ms=\"6\"",
    extraClass: "mobile-operation-sheet-card",
  };
  assert.deepEqual(
    nativeDock.operationCardContentPlan(dockInput),
    classicDock.operationCardContentPlan(dockInput),
  );
  assert.deepEqual(
    nativeDock.compactBubblePreservation({
      nextHtml: "",
      visibleUntilMs: 1500,
      nowMs: 1200,
      savedHtml: "<button class=\"mobile-operation-bubble\"></button>",
      savedThreadId: "thread-1",
      currentThreadId: "thread-1",
      dockHasBubble: true,
    }),
    classicDock.compactBubblePreservation({
      nextHtml: "",
      visibleUntilMs: 1500,
      nowMs: 1200,
      savedHtml: "<button class=\"mobile-operation-bubble\"></button>",
      savedThreadId: "thread-1",
      currentThreadId: "thread-1",
      dockHasBubble: true,
    }),
  );
  assert.equal(globalThis.CodexLiveOperationDockState, nativeDock.default);
});

test("native ESM runtime wiring exposes startup factory without initializing globals", async () => {
  const classicRuntimeWiring = require("../public/runtime-wiring-runtime.js");
  const nativeRuntimeWiring = await import("../frontend/native/runtime-wiring-runtime.mjs");
  const classicRuntime = classicRuntimeWiring.createRuntimeWiringRuntime();
  const nativeRuntime = nativeRuntimeWiring.createRuntimeWiringRuntime();

  assert.equal(typeof classicRuntime.initialize, "function");
  assert.equal(typeof nativeRuntime.initialize, "function");
  assert.equal(globalThis.CodexRuntimeWiringRuntime, nativeRuntimeWiring.default);
});

test("native ESM diagnostic and metrics helpers match classic public APIs", async () => {
  const classicThreadPerformanceMetrics = require("../public/thread-performance-metrics.js");
  const nativeThreadPerformanceMetrics = await import("../frontend/native/thread-performance-metrics.mjs");
  const detailThread = {
    status: { type: "running" },
    mobileReadMode: "projection-v4-partial",
    mobileOmittedTurnCount: 2,
    rolloutSizeBytes: 2048,
    mobileDiagnostics: {
      threadDetailTimings: {
        readDecision: "projection-partial-hit",
        projectionState: "hit",
        prepareResponseMs: 14,
      },
    },
    turns: [{
      status: "completed",
      items: [
        { type: "userMessage", text: "hello" },
        { type: "agentMessage", text: "done" },
        { type: "turnUsageSummary" },
      ],
    }],
  };
  for (const value of [0, 1.4, "22.8", -1, "bad", 20 * 60 * 1000]) {
    assert.equal(
      nativeThreadPerformanceMetrics.boundedTiming(value),
      classicThreadPerformanceMetrics.boundedTiming(value),
    );
  }
  assert.equal(
    nativeThreadPerformanceMetrics.classifyThreadDetailPhase(detailThread.mobileDiagnostics.threadDetailTimings, { readMode: detailThread.mobileReadMode }),
    classicThreadPerformanceMetrics.classifyThreadDetailPhase(detailThread.mobileDiagnostics.threadDetailTimings, { readMode: detailThread.mobileReadMode }),
  );
  assert.deepEqual(
    nativeThreadPerformanceMetrics.threadDetailRefreshEventFields(detailThread, { source: "test", elapsedMs: 44, renderMode: "patch" }),
    classicThreadPerformanceMetrics.threadDetailRefreshEventFields(detailThread, { source: "test", elapsedMs: 44, renderMode: "patch" }),
  );
  assert.deepEqual(
    nativeThreadPerformanceMetrics.threadListEventFields({ mobileDiagnostics: { threadListTimings: { fallbackCacheDecision: "hit" } } }),
    classicThreadPerformanceMetrics.threadListEventFields({ mobileDiagnostics: { threadListTimings: { fallbackCacheDecision: "hit" } } }),
  );
  assert.equal(
    nativeThreadPerformanceMetrics.default.classifyThreadListPhase({ fallbackDeferred: true }),
    classicThreadPerformanceMetrics.classifyThreadListPhase({ fallbackDeferred: true }),
  );

  const classicFrontendRuntimeHealth = require("../public/frontend-runtime-health.js");
  const nativeFrontendRuntimeHealth = await import("../frontend/native/frontend-runtime-health.mjs");
  const submitProbe = {
    elapsedMs: 500,
    currentThreadMatch: true,
    hasThreadSubmission: true,
    domHasSubmission: false,
    domCount: 1,
    visibleCount: 3,
    threadHash: "thread_h",
    itemHash: "item_h",
  };
  assert.deepEqual(
    nativeFrontendRuntimeHealth.submittedMessageDomProbeEffects(submitProbe),
    classicFrontendRuntimeHealth.submittedMessageDomProbeEffects(submitProbe),
  );
  assert.deepEqual(
    nativeFrontendRuntimeHealth.threadListInteractionStallEffects({ elapsedMs: 6000, thresholdMs: 3000, threadListCount: 4 }),
    classicFrontendRuntimeHealth.threadListInteractionStallEffects({ elapsedMs: 6000, thresholdMs: 3000, threadListCount: 4 }),
  );
  const nativeMonitor = nativeFrontendRuntimeHealth.createMonitor({ windowMs: 10000 });
  const classicMonitor = classicFrontendRuntimeHealth.createMonitor({ windowMs: 10000 });
  const renderSample = {
    nowMs: 1000,
    fullRender: true,
    fullRenderThreshold: 1,
    previousCount: 5,
    domCount: 1,
    visibleCount: 5,
    sameThreadRender: true,
    renderMode: "full-render",
  };
  assert.deepEqual(nativeMonitor.recordRender(renderSample), classicMonitor.recordRender(renderSample));
  assert.equal(
    nativeFrontendRuntimeHealth.default.compactToken(" hello world "),
    classicFrontendRuntimeHealth.compactToken(" hello world "),
  );

  const classicHomeAiDiagnosticReporting = require("../public/home-ai-diagnostic-reporting.js");
  const nativeHomeAiDiagnosticReporting = await import("../frontend/native/home-ai-diagnostic-reporting.mjs");
  const diagnosticInput = {
    diagnostic_type: "render_dom_drop",
    error_code: "render_dom_drop",
    severity_hint: "H2",
    context: { surface: "conversation-render", action: "refresh", thread_hash: "thread_h", rawText: "unsafe" },
    counts: { visible_count: 3, raw_payload_bytes: 999, ok: true },
    breadcrumbs: [{ kind: "render", code: "drop", status: "failed", fields: { visible_count: 3, rawText: "unsafe" } }],
  };
  assert.deepEqual(
    nativeHomeAiDiagnosticReporting.sanitizeInput(diagnosticInput),
    classicHomeAiDiagnosticReporting.sanitizeInput(diagnosticInput),
  );
  const nativeReporter = nativeHomeAiDiagnosticReporting.createDiagnosticReporter({ threshold: 2, throttleMs: 1000, now: () => 1000 });
  const classicReporter = classicHomeAiDiagnosticReporting.createDiagnosticReporter({ threshold: 2, throttleMs: 1000, now: () => 1000 });
  assert.deepEqual(nativeReporter.recordFailure(diagnosticInput), classicReporter.recordFailure(diagnosticInput));
  assert.deepEqual(nativeReporter.recordFailure(diagnosticInput), classicReporter.recordFailure(diagnosticInput));
  assert.deepEqual(nativeReporter.recordSuccess(diagnosticInput), classicReporter.recordSuccess(diagnosticInput));
  assert.equal(
    nativeHomeAiDiagnosticReporting.default.hashIdentifier("thread-1", "t"),
    classicHomeAiDiagnosticReporting.hashIdentifier("thread-1", "t"),
  );

  const classicThreadDiagnosticEvents = require("../public/thread-diagnostic-events.js");
  const nativeThreadDiagnosticEvents = await import("../frontend/native/thread-diagnostic-events.mjs");
  const projectionSnapshotInput = {
    renderedConversationSignature: "a",
    currentSignature: "b",
    source: "refresh",
    renderMode: "patch",
    domShape: { renderKeyCount: 2, duplicateRenderKeyCount: 0 },
    thread: detailThread,
  };
  const deps = {
    visibleShape: () => ({ visibleTurnCount: 1, visibleItemCount: 3 }),
    singleSignature: () => "b",
  };
  assert.deepEqual(
    nativeThreadDiagnosticEvents.conversationProjectionDiagnosticSnapshot(projectionSnapshotInput, deps),
    classicThreadDiagnosticEvents.conversationProjectionDiagnosticSnapshot(projectionSnapshotInput, deps),
  );
  assert.deepEqual(
    nativeThreadDiagnosticEvents.turnOrderDiagnosticSnapshot({ expectedTurnIds: ["a", "b"], domTurnIds: ["a", "c"] }),
    classicThreadDiagnosticEvents.turnOrderDiagnosticSnapshot({ expectedTurnIds: ["a", "b"], domTurnIds: ["a", "c"] }),
  );
  assert.deepEqual(
    nativeThreadDiagnosticEvents.threadDetailResponseDiagnosticEffects({
      slowPlan: { shouldReport: true, reason: "thread-read", threadId: "thread", elapsedMs: 3500 },
      contractPlan: { shouldReport: false, reason: "ok", readMode: "projection-v4-partial" },
    }),
    classicThreadDiagnosticEvents.threadDetailResponseDiagnosticEffects({
      slowPlan: { shouldReport: true, reason: "thread-read", threadId: "thread", elapsedMs: 3500 },
      contractPlan: { shouldReport: false, reason: "ok", readMode: "projection-v4-partial" },
    }),
  );
  assert.equal(
    nativeThreadDiagnosticEvents.default.compactToken("bad value!"),
    classicThreadDiagnosticEvents.compactToken("bad value!"),
  );
});

test("Vite shell entry imports the asset-graph ESM compatibility module", async () => {
  const {
    VITE_ESM_COMPATIBILITY_MODULES,
    VITE_ESM_COMPATIBILITY_SHARD_SOURCE_PREFIX,
    VITE_ESM_COMPATIBILITY_SOURCE,
    buildViteEsmCompatibilityShards,
    createShellEntryGroupVirtualModulePlugin,
  } = await loadAssetGraphModule();
  const root = path.resolve(__dirname, "..");
  const source = fs.readFileSync(path.join(root, "frontend", "vite-shell-entry.mjs"), "utf8");
  assert.match(source, /virtual:codex-mobile-esm-compatibility/);
  assert.match(source, /import\("virtual:codex-mobile-esm-compatibility"\)/);
  assert.doesNotMatch(source, /import\s+\{\s*codexMobileViteEsmCompatibility\s*\}\s+from\s+"virtual:codex-mobile-esm-compatibility"/);
  assert.match(source, /__CODEX_MOBILE_VITE_ESM_COMPATIBILITY_PROMISE__/);
  assert.match(source, /__CODEX_MOBILE_VITE_APP_PREVIEW_APP_START_PROMISE__/);
  assert.match(source, /startViteAppPreviewApp\(status, appEntry\)/);
  assert.doesNotMatch(source, /await appEntry\.startCodexMobileApp\(\)/);
  assert.doesNotMatch(source, /\.\.\/public\/build-refresh-policy\.js/);
  assert.match(source, /__CODEX_MOBILE_VITE_ESM_COMPATIBILITY__/);
  assert.match(source, /codexMobileEsmCompatibility/);
  const expectedEsmModuleIds = [
    "build-refresh-policy",
    "runtime-settings",
    "viewport-metrics",
    "conversation-scroll",
    "thread-performance-metrics",
    "thread-detail-state",
    "thread-detail-render-plan",
    "thread-detail-dom-patch",
    "draft-store",
    "image-compressor",
    "plugin-voice-input",
    "api-client",
    "markdown-renderer",
    "plugin-embed",
    "frontend-runtime-health",
    "home-ai-diagnostic-reporting",
    "thread-diagnostic-events",
    "thread-tile-layout",
    "thread-tile-actions",
    "thread-tile-state",
    "thread-tile-runtime",
    "app-update-runtime",
    "settings-runtime",
    "modal-runtime",
    "navigation-runtime",
    "runtime-wiring-runtime",
    "app-shell-runtime",
    "pane-layout-runtime",
    "app-entry",
    "thread-list-runtime",
    "side-chat-runtime",
    "media-preview-runtime",
    "composer-runtime",
    "composer-bridge-runtime",
    "api-client-runtime",
    "thread-list-load-policy",
    "thread-list-stable-order",
    "thread-status-hints",
    "thread-detail-patch-plan",
    "thread-detail-actions",
    "thread-detail-merge-state",
    "thread-detail-v4-merge-state",
    "thread-detail-runtime",
    "task-card-runtime",
    "notification-ui-runtime",
    "conversation-render-runtime",
    "event-stream-runtime",
    "client-render-stability-guard",
    "live-operation-dock-state",
  ];
  assert.deepEqual(VITE_ESM_COMPATIBILITY_MODULES.map((entry) => entry.id), expectedEsmModuleIds);
  const plugin = createShellEntryGroupVirtualModulePlugin({ root });
  const resolved = plugin.resolveId(VITE_ESM_COMPATIBILITY_SOURCE);
  assert.equal(resolved, `\0${VITE_ESM_COMPATIBILITY_SOURCE}`);
  const virtualSource = plugin.load(resolved);
  assert.match(virtualSource, /codexMobileViteEsmCompatibility/);
  assert.match(virtualSource, /codexMobileViteEsmCompatibilityShardSources/);
  assert.match(virtualSource, new RegExp(VITE_ESM_COMPATIBILITY_SHARD_SOURCE_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(virtualSource, /public\/build-refresh-policy\.js/);
  const shards = buildViteEsmCompatibilityShards(root);
  assert.ok(shards.length >= 1);
  assert.equal(shards.reduce((total, shard) => total + shard.moduleCount, 0), VITE_ESM_COMPATIBILITY_MODULES.length);
  const shardSources = shards.map((shard) => {
    const shardResolved = plugin.resolveId(shard.source);
    assert.equal(shardResolved, `\0${shard.source}`);
    return plugin.load(shardResolved);
  }).join("\n");
  assert.match(shardSources, /frontend\/native\/build-refresh-policy\.mjs/);
  assert.match(shardSources, /frontend\/native\/runtime-settings\.mjs/);
  assert.match(shardSources, /frontend\/native\/viewport-metrics\.mjs/);
  assert.match(shardSources, /frontend\/native\/conversation-scroll\.mjs/);
  assert.match(shardSources, /frontend\/native\/thread-detail-state\.mjs/);
  assert.match(shardSources, /frontend\/native\/thread-detail-render-plan\.mjs/);
  assert.match(shardSources, /frontend\/native\/thread-detail-patch-plan\.mjs/);
  assert.match(shardSources, /frontend\/native\/thread-detail-merge-state\.mjs/);
  assert.match(shardSources, /frontend\/native\/thread-detail-v4-merge-state\.mjs/);
  assert.match(shardSources, /frontend\/native\/thread-list-load-policy\.mjs/);
  assert.match(shardSources, /frontend\/native\/draft-store\.mjs/);
  assert.match(shardSources, /frontend\/native\/image-compressor\.mjs/);
  assert.match(shardSources, /frontend\/native\/plugin-voice-input\.mjs/);
  assert.match(shardSources, /frontend\/native\/api-client\.mjs/);
  assert.match(shardSources, /frontend\/native\/markdown-renderer\.mjs/);
  assert.match(shardSources, /frontend\/native\/plugin-embed\.mjs/);
  assert.match(shardSources, /frontend\/native\/thread-performance-metrics\.mjs/);
  assert.match(shardSources, /frontend\/native\/frontend-runtime-health\.mjs/);
  assert.match(shardSources, /frontend\/native\/home-ai-diagnostic-reporting\.mjs/);
  assert.match(shardSources, /frontend\/native\/thread-diagnostic-events\.mjs/);
  assert.match(shardSources, /frontend\/native\/thread-list-stable-order\.mjs/);
  assert.match(shardSources, /frontend\/native\/thread-status-hints\.mjs/);
  assert.match(shardSources, /frontend\/native\/thread-detail-actions\.mjs/);
  assert.match(shardSources, /frontend\/native\/thread-tile-layout\.mjs/);
  assert.match(shardSources, /frontend\/native\/thread-tile-actions\.mjs/);
  assert.match(shardSources, /frontend\/native\/thread-tile-state\.mjs/);
  assert.match(shardSources, /frontend\/native\/app-update-runtime\.mjs/);
  assert.match(shardSources, /frontend\/native\/modal-runtime\.mjs/);
  assert.match(shardSources, /frontend\/native\/runtime-wiring-runtime\.mjs/);
  assert.match(shardSources, /frontend\/native\/client-render-stability-guard\.mjs/);
  assert.match(shardSources, /frontend\/native\/live-operation-dock-state\.mjs/);
  assert.doesNotMatch(shardSources, /from ".*public\/build-refresh-policy\.js"/);
  assert.doesNotMatch(shardSources, /from ".*public\/runtime-settings\.js"/);
  assert.doesNotMatch(shardSources, /from ".*public\/viewport-metrics\.js"/);
  assert.doesNotMatch(shardSources, /from ".*public\/conversation-scroll\.js"/);
  assert.doesNotMatch(shardSources, /from ".*public\/thread-detail-state\.js"/);
  assert.doesNotMatch(shardSources, /from ".*public\/thread-detail-render-plan\.js"/);
  assert.doesNotMatch(shardSources, /from ".*public\/thread-detail-patch-plan\.js"/);
  assert.doesNotMatch(shardSources, /from ".*public\/thread-detail-merge-state\.js"/);
  assert.doesNotMatch(shardSources, /from ".*public\/thread-detail-v4-merge-state\.js"/);
  assert.doesNotMatch(shardSources, /from ".*public\/thread-list-load-policy\.js"/);
  assert.doesNotMatch(shardSources, /from ".*public\/draft-store\.js"/);
  assert.doesNotMatch(shardSources, /from ".*public\/image-compressor\.js"/);
  assert.doesNotMatch(shardSources, /from ".*public\/plugin-voice-input\.js"/);
  assert.doesNotMatch(shardSources, /from ".*public\/api-client\.js"/);
  assert.doesNotMatch(shardSources, /from ".*public\/markdown-renderer\.js"/);
  assert.doesNotMatch(shardSources, /from ".*public\/plugin-embed\.js"/);
  assert.doesNotMatch(shardSources, /from ".*public\/thread-performance-metrics\.js"/);
  assert.doesNotMatch(shardSources, /from ".*public\/frontend-runtime-health\.js"/);
  assert.doesNotMatch(shardSources, /from ".*public\/home-ai-diagnostic-reporting\.js"/);
  assert.doesNotMatch(shardSources, /from ".*public\/thread-diagnostic-events\.js"/);
  assert.doesNotMatch(shardSources, /from ".*public\/thread-list-stable-order\.js"/);
  assert.doesNotMatch(shardSources, /from ".*public\/thread-status-hints\.js"/);
  assert.doesNotMatch(shardSources, /from ".*public\/thread-detail-actions\.js"/);
  assert.doesNotMatch(shardSources, /from ".*public\/thread-tile-layout\.js"/);
  assert.doesNotMatch(shardSources, /from ".*public\/thread-tile-actions\.js"/);
  assert.doesNotMatch(shardSources, /from ".*public\/thread-tile-state\.js"/);
  assert.doesNotMatch(shardSources, /from ".*public\/app-update-runtime\.js"/);
  assert.doesNotMatch(shardSources, /from ".*public\/modal-runtime\.js"/);
  assert.doesNotMatch(shardSources, /from ".*public\/runtime-wiring-runtime\.js"/);
  assert.doesNotMatch(shardSources, /from ".*public\/client-render-stability-guard\.js"/);
  assert.doesNotMatch(shardSources, /from ".*public\/live-operation-dock-state\.js"/);
  assert.match(shardSources, /public\/thread-detail-dom-patch\.js/);
  assert.match(shardSources, /public\/thread-tile-runtime\.js/);
  assert.match(shardSources, /public\/settings-runtime\.js/);
  assert.match(shardSources, /public\/navigation-runtime\.js/);
  assert.match(shardSources, /public\/app-shell-runtime\.js/);
  assert.match(shardSources, /public\/pane-layout-runtime\.js/);
  assert.match(shardSources, /public\/app\.js/);
  assert.match(shardSources, /public\/thread-list-runtime\.js/);
  assert.match(shardSources, /public\/side-chat-runtime\.js/);
  assert.match(shardSources, /public\/media-preview-runtime\.js/);
  assert.match(shardSources, /public\/composer-runtime\.js/);
  assert.match(shardSources, /public\/composer-bridge-runtime\.js/);
  assert.match(shardSources, /public\/api-client-runtime\.js/);
  assert.match(shardSources, /public\/thread-detail-runtime\.js/);
  assert.match(shardSources, /public\/task-card-runtime\.js/);
  assert.match(shardSources, /public\/notification-ui-runtime\.js/);
  assert.match(shardSources, /public\/conversation-render-runtime\.js/);
  assert.match(shardSources, /public\/event-stream-runtime\.js/);
  assert.match(shardSources, /createApiClient/);
  assert.match(shardSources, /renderMarkdownTable/);
  assert.match(shardSources, /planThreadListLoadRequest/);
  assert.match(shardSources, /planBottomFollowScrollSchedule/);
  assert.match(shardSources, /threadDetailTimings/);
  assert.match(shardSources, /createThreadDetailStatePolicy/);
  assert.match(shardSources, /planThreadDetailFirstPaintResponseEffects/);
  assert.match(shardSources, /applyThreadTurnRefreshDomPatch/);
  assert.match(shardSources, /compressedImageName/);
  assert.match(shardSources, /capabilityStateMessage/);
  assert.match(shardSources, /routeHintOpenPlan/);
  assert.match(shardSources, /threadListInteractionStallEffects/);
  assert.match(shardSources, /createDiagnosticReporter/);
  assert.match(shardSources, /threadDetailResponseDiagnosticEffects/);
  assert.match(shardSources, /stablePixelChanged/);
  assert.match(shardSources, /planThreadDetailRefreshRequest/);
  assert.match(shardSources, /visibleTurnOrderMismatch/);
  assert.match(shardSources, /createDraftStore/);
  assert.match(shardSources, /threadTileColumnGroups/);
  assert.match(shardSources, /resolveThreadTileDropAction/);
  assert.match(shardSources, /activePaneSyncPlan/);
  assert.match(shardSources, /createThreadTileRuntime/);
  assert.match(shardSources, /createAppUpdateRuntime/);
  assert.match(shardSources, /createSettingsRuntime/);
  assert.match(shardSources, /createModalRuntime/);
  assert.match(shardSources, /createNavigationRuntime/);
  assert.match(shardSources, /createRuntimeWiringRuntime/);
  assert.match(shardSources, /createAppShellRuntime/);
  assert.match(shardSources, /createPaneLayoutRuntime/);
  assert.match(shardSources, /createCodexMobileAppEntry/);
  assert.match(shardSources, /startCodexMobileApp/);
  assert.match(shardSources, /createThreadListRuntime/);
  assert.match(shardSources, /createSideChatRuntime/);
  assert.match(shardSources, /createMediaPreviewRuntime/);
  assert.match(shardSources, /createComposerRuntime/);
  assert.match(shardSources, /createComposerBridgeRuntime/);
  assert.match(shardSources, /createApiClientRuntime/);
  assert.match(shardSources, /server-newer/);
  assert.match(shardSources, /planThreadListStableOrder/);
  assert.match(shardSources, /shouldMarkThreadUnread/);
  assert.match(shardSources, /planVisibleItemRefreshPatch/);
  assert.match(shardSources, /resolveThreadDetailClickAction/);
  assert.match(shardSources, /createThreadDetailMergePolicy/);
  assert.match(shardSources, /createThreadDetailV4MergePolicy/);
  assert.match(shardSources, /createThreadDetailRuntime/);
  assert.match(shardSources, /createTaskCardRuntime/);
  assert.match(shardSources, /createNotificationUiRuntime/);
  assert.match(shardSources, /createConversationRenderRuntime/);
  assert.match(shardSources, /createEventStreamRuntime/);
  assert.match(shardSources, /renderLiveOperationDock/);
  assert.match(shardSources, /operationCardContentPlan/);
});

test("Vite shell build contract records entry chunks and classic fallback outputs", async () => {
  const {
    VITE_ENTRY_GROUP_SOURCE_PREFIX,
    VITE_ESM_COMPATIBILITY_MODULES,
    VITE_ESM_COMPATIBILITY_SOURCE,
    buildViteEsmCompatibilityShards,
    buildShellAssetManifest,
    buildViteShellBuildContract,
  } = await loadAssetGraphModule();
  const root = path.resolve(__dirname, "..");
  const manifest = buildShellAssetManifest(root);
  const compatibilityShards = buildViteEsmCompatibilityShards(root);
  assert.ok(compatibilityShards.length >= 1);
  const bundle = {
    "assets/vite-shell-entry-example.js": {
      type: "chunk",
      fileName: "assets/vite-shell-entry-example.js",
      name: "vite-shell-entry",
      facadeModuleId: path.join(root, "frontend", "vite-shell-entry.mjs"),
      isEntry: true,
      isDynamicEntry: false,
      imports: [],
      dynamicImports: [
        "assets/vite-esm-compatibility-example.js",
        "assets/app-bootstrap-example.js",
        "assets/vite-deferred-entry-topology-example.js",
      ],
    },
    "assets/vite-esm-compatibility-example.js": {
      type: "chunk",
      fileName: "assets/vite-esm-compatibility-example.js",
      name: "codex-mobile-esm-compatibility",
      facadeModuleId: `\0${VITE_ESM_COMPATIBILITY_SOURCE}`,
      isEntry: false,
      isDynamicEntry: true,
      imports: ["assets/vite-shell-entry-example.js"],
      dynamicImports: compatibilityShards.map((shard) => `assets/vite-esm-compatibility-${shard.id}-example.js`),
    },
    "assets/app-bootstrap-example.js": {
      type: "chunk",
      fileName: "assets/app-bootstrap-example.js",
      name: "app-bootstrap",
      facadeModuleId: path.join(root, "public", "app-bootstrap.js"),
      isEntry: false,
      isDynamicEntry: true,
      imports: ["assets/vite-shell-entry-example.js"],
      dynamicImports: [],
    },
    "assets/vite-deferred-entry-topology-example.js": {
      type: "chunk",
      fileName: "assets/vite-deferred-entry-topology-example.js",
      name: "vite-deferred-entry-topology",
      facadeModuleId: path.join(root, "frontend", "vite-deferred-entry-topology.mjs"),
      isEntry: false,
      isDynamicEntry: true,
      imports: ["assets/vite-shell-entry-example.js"],
      dynamicImports: [],
    },
  };
  for (const shard of compatibilityShards) {
    bundle[`assets/vite-esm-compatibility-${shard.id}-example.js`] = {
      type: "chunk",
      fileName: `assets/vite-esm-compatibility-${shard.id}-example.js`,
      name: `codex-mobile-esm-compatibility-${shard.id}`,
      facadeModuleId: `\0${shard.source}`,
      isEntry: false,
      isDynamicEntry: true,
      imports: ["assets/vite-esm-compatibility-example.js", "assets/vite-shared-runtime-example.js"],
      dynamicImports: [],
    };
  }
  bundle["assets/vite-shared-runtime-example.js"] = {
    type: "chunk",
    fileName: "assets/vite-shared-runtime-example.js",
    name: "vite-shared-runtime",
    facadeModuleId: "",
    isEntry: false,
    isDynamicEntry: false,
    imports: [],
    dynamicImports: [],
  };
  for (const group of manifest.entryGroups) {
    const groupId = String(group.id).toLowerCase();
    bundle["assets/vite-shell-entry-example.js"].dynamicImports.push(`assets/vite-entry-group-${groupId}-example.js`);
    bundle[`assets/vite-entry-group-${groupId}-example.js`] = {
      type: "chunk",
      fileName: `assets/vite-entry-group-${groupId}-example.js`,
      name: `vite-entry-group-${groupId}`,
      facadeModuleId: `\0${VITE_ENTRY_GROUP_SOURCE_PREFIX}${groupId}`,
      isEntry: true,
      isDynamicEntry: false,
      imports: [],
      dynamicImports: [],
    };
  }
  const contract = buildViteShellBuildContract(manifest, bundle);
  assert.equal(contract.validation.ok, true);
  assert.equal(contract.stage, "vite-shell-artifact-contract-v1");
  assert.equal(contract.productionExecution, "classic-script-fallback");
  assert.equal(contract.entryGroupImportOwner, "vite-shell-entry");
  assert.equal(contract.viteEntry.source, "frontend/vite-shell-entry.mjs");
  assert.equal(contract.viteEntry.fileName, "assets/vite-shell-entry-example.js");
  assert.deepEqual(contract.viteEntry.dynamicImports, [
    "assets/vite-esm-compatibility-example.js",
    "assets/app-bootstrap-example.js",
    "assets/vite-deferred-entry-topology-example.js",
    ...manifest.entryGroups.map((group) => `assets/vite-entry-group-${String(group.id).toLowerCase()}-example.js`),
  ]);
  assert.equal(contract.viteEsmCompatibilityChunks.length, compatibilityShards.length + 1);
  assert.ok(contract.viteEsmCompatibilityChunks.some((chunk) => chunk.source === VITE_ESM_COMPATIBILITY_SOURCE));
  assert.deepEqual(
    contract.viteEsmCompatibilityChunks
      .map((chunk) => chunk.source)
      .filter((source) => source.includes("/shard/"))
      .sort(),
    compatibilityShards.map((shard) => shard.source).sort()
  );
  assert.equal(contract.viteDeferredChunks.length, 1);
  assert.equal(contract.viteDeferredChunks[0].source, "frontend/vite-deferred-entry-topology.mjs");
  assert.deepEqual(contract.viteOwnedAppBootstrapChunks.map((chunk) => chunk.source), ["public/app-bootstrap.js"]);
  assert.equal(contract.viteEntryGroupChunks.length, manifest.entryGroups.length);
  assert.equal(contract.viteSharedChunks.length, 1);
  assert.equal(contract.viteSharedChunks[0].fileName, "assets/vite-shared-runtime-example.js");
  assert.equal(contract.entryDynamicImportGraph.owner, "vite-shell-entry");
  assert.equal(contract.entryDynamicImportGraph.esmCompatibilityFileCount, 1);
  assert.equal(contract.entryDynamicImportGraph.deferredFileCount, 1);
  assert.equal(contract.entryDynamicImportGraph.entryGroupFileCount, manifest.entryGroups.length);
  assert.equal(contract.startupCompatibility.requiredGlobalCount, manifest.startupGlobalContracts.length);
  assert.equal(contract.startupCompatibility.hashCount, manifest.startupGlobalContracts.length);
  assert.equal(
    contract.startupCompatibility.assetCount,
    new Set(manifest.startupGlobalContracts.map((entry) => entry.asset).filter(Boolean)).size
  );
  assert.ok(contract.startupCompatibility.byteCount > 0);
  assert.equal(contract.appPreviewClassicLoaderPlan.owner, "vite-shell-entry");
  assert.equal(contract.appPreviewClassicLoaderPlan.sourceScriptCount, manifest.indexScriptAssets.length);
  assert.equal(contract.appPreviewClassicLoaderPlan.excludedEsmScriptCount, VITE_ESM_COMPATIBILITY_MODULES.length);
  assert.equal(contract.appPreviewClassicLoaderPlan.excludedEsmHashCount, VITE_ESM_COMPATIBILITY_MODULES.length);
  assert.equal(contract.appPreviewClassicLoaderPlan.excludedViteOwnedScriptCount, 2);
  assert.equal(contract.appPreviewClassicLoaderPlan.excludedViteOwnedHashCount, 2);
  assert.equal(
    contract.appPreviewClassicLoaderPlan.scriptCount
      + contract.appPreviewClassicLoaderPlan.excludedEsmScriptCount
      + contract.appPreviewClassicLoaderPlan.excludedViteOwnedScriptCount,
    manifest.indexScriptAssets.length
  );
  assert.equal(contract.appPreviewClassicLoaderPlan.hashCount, contract.appPreviewClassicLoaderPlan.scriptCount);
  const loaderScriptPaths = contract.appPreviewClassicLoaderPlan.scripts.map((entry) => entry.path);
  assert.equal(contract.appPreviewClassicLoaderPlan.scriptCount, loaderScriptPaths.length);
  assert.equal(contract.appPreviewClassicLoaderPlan.firstScript, loaderScriptPaths[0] || "");
  assert.equal(contract.appPreviewClassicLoaderPlan.lastScript, loaderScriptPaths[loaderScriptPaths.length - 1] || "");
  assert.match(contract.appPreviewClassicLoaderPlan.sha256, /^[a-f0-9]{64}$/);
  const loaderPlanCoveredScripts = new Set([
    ...contract.appPreviewClassicLoaderPlan.scripts.map((entry) => entry.path),
    ...contract.appPreviewClassicLoaderPlan.excludedEsmScripts.map((entry) => entry.path),
    ...contract.appPreviewClassicLoaderPlan.excludedViteOwnedScripts.map((entry) => entry.path),
  ]);
  assert.deepEqual(manifest.indexScriptAssets.filter((entry) => loaderPlanCoveredScripts.has(entry)), manifest.indexScriptAssets);
  const esmModuleIdByAssetPath = new Map(VITE_ESM_COMPATIBILITY_MODULES.map((entry) => [
    `/${entry.source.replace(/^public\//, "")}`,
    entry.id,
  ]));
  const expectedExcludedEsmIds = manifest.indexScriptAssets
    .map((entry) => esmModuleIdByAssetPath.get(entry))
    .filter(Boolean);
  assert.deepEqual(
    contract.appPreviewClassicLoaderPlan.excludedEsmScripts.map((entry) => entry.esmModuleId),
    expectedExcludedEsmIds
  );
  assert.deepEqual(
    contract.appPreviewClassicLoaderPlan.excludedViteOwnedScripts.map((entry) => ({
      path: entry.path,
      ownerId: entry.ownerId,
      globalName: entry.globalName,
    })),
    [
      {
        path: "/shell-asset-manifest.js",
        ownerId: "shell-manifest",
        globalName: "CODEX_MOBILE_SHELL_MANIFEST",
      },
      {
        path: "/app-bootstrap.js",
        ownerId: "vite-app-bootstrap",
        globalName: "CodexAppBootstrap",
      },
    ]
  );
  assert.ok(contract.appPreviewClassicLoaderPlan.scripts.every((entry) => entry.groupId && entry.bytes > 0));
  assert.ok(contract.appPreviewClassicLoaderPlan.scripts.every((entry) => /^[a-f0-9]{64}$/.test(entry.sha256)));
  assert.ok(contract.appPreviewClassicLoaderPlan.excludedEsmScripts.every((entry) => entry.globalName && /^[a-f0-9]{64}$/.test(entry.sha256)));
  assert.ok(contract.appPreviewClassicLoaderPlan.excludedViteOwnedScripts.every((entry) => entry.ownerId && entry.globalName && /^[a-f0-9]{64}$/.test(entry.sha256)));
  assert.equal(contract.esmCompatibility.owner, "vite-shell-entry");
  assert.equal(contract.esmCompatibility.virtualModuleSource, VITE_ESM_COMPATIBILITY_SOURCE);
  assert.equal(contract.esmCompatibility.shardCount, compatibilityShards.length);
  assert.deepEqual(
    contract.esmCompatibility.shards.map((shard) => shard.source).sort(),
    compatibilityShards.map((shard) => shard.source).sort()
  );
  assert.equal(
    contract.esmCompatibility.shards.reduce((total, shard) => total + shard.moduleCount, 0),
    VITE_ESM_COMPATIBILITY_MODULES.length
  );
  assert.equal(contract.esmCompatibility.moduleCount, VITE_ESM_COMPATIBILITY_MODULES.length);
  assert.equal(contract.esmCompatibility.nativeEsmModuleCount, 46);
  assert.equal(contract.esmCompatibility.classicGlobalCompatibilityModuleCount, VITE_ESM_COMPATIBILITY_MODULES.length - 46);
  assert.equal(contract.esmCompatibility.hashCount, VITE_ESM_COMPATIBILITY_MODULES.length);
  assert.equal(
    contract.esmCompatibility.expectedFunctionCount,
    VITE_ESM_COMPATIBILITY_MODULES.reduce((total, entry) => total + entry.expectedFunctions.length, 0)
  );
  assert.deepEqual(
    contract.esmCompatibility.modules.map((entry) => entry.id),
    VITE_ESM_COMPATIBILITY_MODULES.map((entry) => entry.id)
  );
  assert.deepEqual(
    contract.esmCompatibility.modules.map((entry) => entry.assetPath),
    VITE_ESM_COMPATIBILITY_MODULES.map((entry) => `/${entry.source.replace(/^public\//, "")}`)
  );
  assert.deepEqual(
    contract.esmCompatibility.modules.filter((entry) => entry.compatibilityMode === "native-esm").map((entry) => ({
      id: entry.id,
      nativeSource: entry.nativeSource,
      importSource: entry.importSource,
    })),
    [
      {
        id: "build-refresh-policy",
        nativeSource: "frontend/native/build-refresh-policy.mjs",
        importSource: "frontend/native/build-refresh-policy.mjs",
      },
      {
        id: "runtime-settings",
        nativeSource: "frontend/native/runtime-settings.mjs",
        importSource: "frontend/native/runtime-settings.mjs",
      },
      {
        id: "viewport-metrics",
        nativeSource: "frontend/native/viewport-metrics.mjs",
        importSource: "frontend/native/viewport-metrics.mjs",
      },
      {
        id: "conversation-scroll",
        nativeSource: "frontend/native/conversation-scroll.mjs",
        importSource: "frontend/native/conversation-scroll.mjs",
      },
      {
        id: "thread-performance-metrics",
        nativeSource: "frontend/native/thread-performance-metrics.mjs",
        importSource: "frontend/native/thread-performance-metrics.mjs",
      },
      {
        id: "thread-detail-state",
        nativeSource: "frontend/native/thread-detail-state.mjs",
        importSource: "frontend/native/thread-detail-state.mjs",
      },
      {
        id: "thread-detail-render-plan",
        nativeSource: "frontend/native/thread-detail-render-plan.mjs",
        importSource: "frontend/native/thread-detail-render-plan.mjs",
      },
      {
        id: "thread-detail-dom-patch",
        nativeSource: "frontend/native/thread-detail-dom-patch.mjs",
        importSource: "frontend/native/thread-detail-dom-patch.mjs",
      },
      {
        id: "draft-store",
        nativeSource: "frontend/native/draft-store.mjs",
        importSource: "frontend/native/draft-store.mjs",
      },
      {
        id: "image-compressor",
        nativeSource: "frontend/native/image-compressor.mjs",
        importSource: "frontend/native/image-compressor.mjs",
      },
      {
        id: "plugin-voice-input",
        nativeSource: "frontend/native/plugin-voice-input.mjs",
        importSource: "frontend/native/plugin-voice-input.mjs",
      },
      {
        id: "api-client",
        nativeSource: "frontend/native/api-client.mjs",
        importSource: "frontend/native/api-client.mjs",
      },
      {
        id: "markdown-renderer",
        nativeSource: "frontend/native/markdown-renderer.mjs",
        importSource: "frontend/native/markdown-renderer.mjs",
      },
      {
        id: "plugin-embed",
        nativeSource: "frontend/native/plugin-embed.mjs",
        importSource: "frontend/native/plugin-embed.mjs",
      },
      {
        id: "frontend-runtime-health",
        nativeSource: "frontend/native/frontend-runtime-health.mjs",
        importSource: "frontend/native/frontend-runtime-health.mjs",
      },
      {
        id: "home-ai-diagnostic-reporting",
        nativeSource: "frontend/native/home-ai-diagnostic-reporting.mjs",
        importSource: "frontend/native/home-ai-diagnostic-reporting.mjs",
      },
      {
        id: "thread-diagnostic-events",
        nativeSource: "frontend/native/thread-diagnostic-events.mjs",
        importSource: "frontend/native/thread-diagnostic-events.mjs",
      },
      {
        id: "thread-tile-layout",
        nativeSource: "frontend/native/thread-tile-layout.mjs",
        importSource: "frontend/native/thread-tile-layout.mjs",
      },
      {
        id: "thread-tile-actions",
        nativeSource: "frontend/native/thread-tile-actions.mjs",
        importSource: "frontend/native/thread-tile-actions.mjs",
      },
      {
        id: "thread-tile-state",
        nativeSource: "frontend/native/thread-tile-state.mjs",
        importSource: "frontend/native/thread-tile-state.mjs",
      },
      {
        id: "thread-tile-runtime",
        nativeSource: "frontend/native/thread-tile-runtime.mjs",
        importSource: "frontend/native/thread-tile-runtime.mjs",
      },
      {
        id: "app-update-runtime",
        nativeSource: "frontend/native/app-update-runtime.mjs",
        importSource: "frontend/native/app-update-runtime.mjs",
      },
      {
        id: "settings-runtime",
        nativeSource: "frontend/native/settings-runtime.mjs",
        importSource: "frontend/native/settings-runtime.mjs",
      },
      {
        id: "modal-runtime",
        nativeSource: "frontend/native/modal-runtime.mjs",
        importSource: "frontend/native/modal-runtime.mjs",
      },
      {
        id: "navigation-runtime",
        nativeSource: "frontend/native/navigation-runtime.mjs",
        importSource: "frontend/native/navigation-runtime.mjs",
      },
      {
        id: "runtime-wiring-runtime",
        nativeSource: "frontend/native/runtime-wiring-runtime.mjs",
        importSource: "frontend/native/runtime-wiring-runtime.mjs",
      },
      {
        id: "app-shell-runtime",
        nativeSource: "frontend/native/app-shell-runtime.mjs",
        importSource: "frontend/native/app-shell-runtime.mjs",
      },
      {
        id: "pane-layout-runtime",
        nativeSource: "frontend/native/pane-layout-runtime.mjs",
        importSource: "frontend/native/pane-layout-runtime.mjs",
      },
      {
        id: "app-entry",
        nativeSource: "frontend/native/app-entry.mjs",
        importSource: "frontend/native/app-entry.mjs",
      },
      {
        id: "thread-list-runtime",
        nativeSource: "frontend/native/thread-list-runtime.mjs",
        importSource: "frontend/native/thread-list-runtime.mjs",
      },
      {
        id: "side-chat-runtime",
        nativeSource: "frontend/native/side-chat-runtime.mjs",
        importSource: "frontend/native/side-chat-runtime.mjs",
      },
      {
        id: "media-preview-runtime",
        nativeSource: "frontend/native/media-preview-runtime.mjs",
        importSource: "frontend/native/media-preview-runtime.mjs",
      },
      {
        id: "composer-runtime",
        nativeSource: "frontend/native/composer-runtime.mjs",
        importSource: "frontend/native/composer-runtime.mjs",
      },
      {
        id: "composer-bridge-runtime",
        nativeSource: "frontend/native/composer-bridge-runtime.mjs",
        importSource: "frontend/native/composer-bridge-runtime.mjs",
      },
      {
        id: "api-client-runtime",
        nativeSource: "frontend/native/api-client-runtime.mjs",
        importSource: "frontend/native/api-client-runtime.mjs",
      },
      {
        id: "thread-list-load-policy",
        nativeSource: "frontend/native/thread-list-load-policy.mjs",
        importSource: "frontend/native/thread-list-load-policy.mjs",
      },
      {
        id: "thread-list-stable-order",
        nativeSource: "frontend/native/thread-list-stable-order.mjs",
        importSource: "frontend/native/thread-list-stable-order.mjs",
      },
      {
        id: "thread-status-hints",
        nativeSource: "frontend/native/thread-status-hints.mjs",
        importSource: "frontend/native/thread-status-hints.mjs",
      },
      {
        id: "thread-detail-patch-plan",
        nativeSource: "frontend/native/thread-detail-patch-plan.mjs",
        importSource: "frontend/native/thread-detail-patch-plan.mjs",
      },
      {
        id: "thread-detail-actions",
        nativeSource: "frontend/native/thread-detail-actions.mjs",
        importSource: "frontend/native/thread-detail-actions.mjs",
      },
      {
        id: "thread-detail-merge-state",
        nativeSource: "frontend/native/thread-detail-merge-state.mjs",
        importSource: "frontend/native/thread-detail-merge-state.mjs",
      },
      {
        id: "thread-detail-v4-merge-state",
        nativeSource: "frontend/native/thread-detail-v4-merge-state.mjs",
        importSource: "frontend/native/thread-detail-v4-merge-state.mjs",
      },
      {
        id: "task-card-runtime",
        nativeSource: "frontend/native/task-card-runtime.mjs",
        importSource: "frontend/native/task-card-runtime.mjs",
      },
      {
        id: "notification-ui-runtime",
        nativeSource: "frontend/native/notification-ui-runtime.mjs",
        importSource: "frontend/native/notification-ui-runtime.mjs",
      },
      {
        id: "client-render-stability-guard",
        nativeSource: "frontend/native/client-render-stability-guard.mjs",
        importSource: "frontend/native/client-render-stability-guard.mjs",
      },
      {
        id: "live-operation-dock-state",
        nativeSource: "frontend/native/live-operation-dock-state.mjs",
        importSource: "frontend/native/live-operation-dock-state.mjs",
      },
    ]
  );
  assert.ok(contract.esmCompatibility.modules.every((entry) => entry.classicLoaderExcluded === true));
  assert.ok(contract.esmCompatibility.modules.every((entry) => entry.bytes > 0));
  assert.ok(contract.esmCompatibility.modules.every((entry) => /^[a-f0-9]{64}$/.test(entry.sha256)));
  assert.deepEqual(
    contract.startupCompatibility.requiredGlobals.find((entry) => entry.name === "CodexAppShellRuntime"),
    {
      name: "CodexAppShellRuntime",
      asset: "/app-shell-runtime.js",
      groupId: "app-entry",
      startupCritical: true,
      source: "startup-window-guard",
      present: true,
      exportedAsset: "/app-shell-runtime.js",
      hashPresent: true,
      bytes: contract.startupCompatibility.requiredGlobals.find((entry) => entry.name === "CodexAppShellRuntime").bytes,
      sha256: contract.startupCompatibility.requiredGlobals.find((entry) => entry.name === "CodexAppShellRuntime").sha256,
    }
  );
  assert.match(
    contract.startupCompatibility.requiredGlobals.find((entry) => entry.name === "CodexAppShellRuntime").sha256,
    /^[a-f0-9]{64}$/
  );
  assert.deepEqual(contract.entryDynamicImportGraph.missingFiles, []);
  assert.deepEqual(contract.entryDynamicImportGraph.extraFiles, []);
  assert.deepEqual(
    contract.entryDynamicImportGraph.actualFiles.slice().sort(),
    contract.entryDynamicImportGraph.expectedFiles.slice().sort()
  );
  assert.deepEqual(
    contract.viteEntryGroupChunks.map((chunk) => chunk.groupId).sort(),
    manifest.entryGroups.map((group) => group.id).sort()
  );
  const appEntryChunk = contract.viteEntryGroupChunks.find((chunk) => chunk.groupId === "app-entry");
  assert.deepEqual(appEntryChunk.assets, [
    "/runtime-wiring-runtime.js",
    "/app-shell-runtime.js",
    "/app.js",
  ]);
  assert.equal(appEntryChunk.assetCount, 3);
  assert.equal(appEntryChunk.classicAssetRecords.length, 3);
  assert.equal(appEntryChunk.classicAssetHashCount, 3);
  assert.ok(appEntryChunk.classicAssetBytes > 0);
  assert.ok(appEntryChunk.classicAssetRecords.every((entry) => /^\/.+\.js$/.test(entry.path)));
  assert.ok(appEntryChunk.classicAssetRecords.every((entry) => /^[a-f0-9]{64}$/.test(entry.sha256)));
  assert.equal(appEntryChunk.classicGlobalExportAssetCount, 3);
  assert.equal(appEntryChunk.classicGlobalExportCount, 3);
  assert.deepEqual(
    appEntryChunk.startupGlobalContracts.map((entry) => entry.name).sort(),
    ["CodexAppShellRuntime", "CodexRuntimeWiringRuntime"]
  );
  assert.ok(contract.outputFiles.includes("assets/vite-shell-entry-example.js"));
  assert.ok(contract.outputFiles.includes("assets/vite-esm-compatibility-example.js"));
  for (const shard of compatibilityShards) {
    assert.ok(contract.outputFiles.includes(`assets/vite-esm-compatibility-${shard.id}-example.js`));
  }
  assert.ok(contract.outputFiles.includes("assets/vite-shared-runtime-example.js"));
  assert.ok(contract.outputFiles.includes("assets/vite-deferred-entry-topology-example.js"));
  assert.ok(contract.outputFiles.includes("assets/vite-entry-group-app-entry-example.js"));
  assert.ok(contract.outputFiles.includes("codex-mobile-shell-manifest.json"));
  assert.ok(contract.classicShellAssets.some((asset) => asset.path === "/app.js" && asset.fileName === "shell-assets/app.js"));
  assert.equal(contract.classicFallback.scriptBlock.source, "generated-classic-index-script-block");
  assert.equal(contract.classicFallback.scriptBlock.scriptCount, manifest.indexScriptAssets.length);
  assert.equal(contract.classicFallback.scriptBlock.firstScript, "/shell-asset-manifest.js");
  assert.equal(contract.classicFallback.scriptBlock.lastScript, "/app.js");
  assert.match(contract.classicFallback.scriptBlock.sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(contract.classicFallback.entryGroups, manifest.entryGroups);
  assert.deepEqual(contract.classicFallback.classicGlobalExports, manifest.classicGlobalExports);
  assert.deepEqual(contract.classicFallback.startupGlobalContracts, manifest.startupGlobalContracts);
});

test("Vite entry group virtual modules preserve bounded group payloads", async () => {
  const {
    VITE_ENTRY_GROUP_LOADER_SOURCE,
    VITE_ENTRY_GROUP_SOURCE_PREFIX,
    createShellEntryGroupVirtualModulePlugin,
  } = await loadAssetGraphModule();
  const plugin = createShellEntryGroupVirtualModulePlugin({ root: path.resolve(__dirname, "..") });
  const loaderResolved = plugin.resolveId(VITE_ENTRY_GROUP_LOADER_SOURCE);
  assert.equal(loaderResolved, `\0${VITE_ENTRY_GROUP_LOADER_SOURCE}`);
  const loaderSource = plugin.load(loaderResolved);
  assert.match(loaderSource, /export const codexMobileViteEntryGroupIds = /);
  assert.match(loaderSource, /loadCodexMobileViteEntryGroups/);
  assert.match(loaderSource, /__CODEX_MOBILE_VITE_ENTRY_GROUP_IMPORT_PROMISE__/);
  assert.match(loaderSource, /virtual:codex-mobile-shell-entry-group\/app-entry/);
  const resolved = plugin.resolveId(`${VITE_ENTRY_GROUP_SOURCE_PREFIX}app-entry`);
  assert.equal(resolved, `\0${VITE_ENTRY_GROUP_SOURCE_PREFIX}app-entry`);
  const source = plugin.load(resolved);
  assert.match(source, /export const codexMobileViteEntryGroup = /);
  assert.match(source, /__CODEX_MOBILE_VITE_ENTRY_GROUP_CHUNKS__/);
  assert.match(source, /codexMobileViteEntryGroupRegistry\[codexMobileViteEntryGroup\.id\]/);
  assert.match(source, /"id": "app-entry"/);
  assert.match(source, /"\/app\.js"/);
  assert.match(source, /"classicGlobalExports"/);
  assert.match(source, /"classicAssetHashCount": 3/);
  assert.match(source, /"classicGlobalExportCount": 3/);
  assert.match(source, /"startupGlobalContracts"/);
  assert.match(source, /"CodexRuntimeWiringRuntime"/);
});

test("frontend shell generator owns the index classic script block", async () => {
  const {
    SHELL_SCRIPT_BLOCK_END,
    SHELL_SCRIPT_BLOCK_START,
    canonicalShellScriptAssets,
    generatedIndexHtmlSource,
  } = await import("../scripts/generate-frontend-shell-manifest.mjs");
  const scriptAssets = canonicalShellScriptAssets();
  const source = [
    "<!doctype html>",
    "<html>",
    "<body>",
    SHELL_SCRIPT_BLOCK_START,
    "  <script src=\"/stale-manual-script.js\"></script>",
    SHELL_SCRIPT_BLOCK_END,
    "<script>window.afterGeneratedBlock = true;</script>",
    "</body>",
    "</html>",
  ].join("\n");
  const generated = generatedIndexHtmlSource(source, { scriptAssets });
  assert.ok(generated.includes(SHELL_SCRIPT_BLOCK_START));
  assert.ok(generated.includes(SHELL_SCRIPT_BLOCK_END));
  assert.ok(generated.includes('<script src="/shell-asset-manifest.js"></script>'));
  assert.ok(generated.includes('<script src="/app.js"></script>'));
  assert.ok(!generated.includes("/stale-manual-script.js"));
  assert.ok(generated.includes("window.afterGeneratedBlock = true"));
  assert.deepEqual(scriptAssets.slice(0, 2), ["/shell-asset-manifest.js", "/api-client.js"]);
  assert.equal(scriptAssets.at(-1), "/app.js");
});

test("Vite shell asset graph fails closed when generated manifest is stale", async () => {
  const { buildShellAssetManifest } = await loadAssetGraphModule();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-shell-assets-"));
  fs.mkdirSync(path.join(root, "public", "icons"), { recursive: true });
  fs.mkdirSync(path.join(root, "services", "runtime"), { recursive: true });
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ version: "0.1.11" }));
  fs.writeFileSync(path.join(root, "public", "manifest.json"), JSON.stringify({ icons: [] }));
  fs.writeFileSync(path.join(root, "public", "styles.css"), "");
  fs.writeFileSync(path.join(root, "public", "index.html"), [
    "<!doctype html>",
    "<link rel=\"stylesheet\" href=\"/styles.css\">",
    "<script src=\"/shell-asset-manifest.js\"></script>",
    "<script src=\"/a.js\"></script>",
  ].join("\n"));
  fs.writeFileSync(path.join(root, "public", "a.js"), "\"use strict\";\n");
  fs.writeFileSync(path.join(root, "public", "sw.js"), [
    "importScripts(\"/shell-asset-manifest.js\");",
    "const SHELL_MANIFEST = self.CODEX_MOBILE_SHELL_MANIFEST || {};",
    "const CACHE_NAME = SHELL_MANIFEST.shellCacheName;",
    "const STATIC_ASSETS = SHELL_MANIFEST.precacheAssets;",
  ].join("\n"));
  fs.writeFileSync(path.join(root, "public", "app-bootstrap.js"), [
    "function readShellManifest() { return window.CODEX_MOBILE_SHELL_MANIFEST || {}; }",
    "function shellManifestList(name) { return readShellManifest()[name] || []; }",
    "var CLIENT_BUILD_ID = readShellManifest().clientBuildId;",
    "var PAGE_SHELL_ASSETS = Object.freeze(shellManifestList(\"pageShellAssets\"));",
  ].join("\n"));
  fs.writeFileSync(path.join(root, "services", "runtime", "server-runtime-utils.js"), [
    "function readShellAssetManifest() {",
    "  return JSON.parse(require(\"node:fs\").readFileSync(\"shell-asset-manifest.json\", \"utf8\"));",
    "}",
  ].join("\n"));
  const staleManifest = {
    schemaVersion: 2,
    generatedBy: "test-stale-manifest",
    shellCacheName: "codex-mobile-shell-test",
    clientBuildId: "0.1.11|codex-mobile-shell-test",
    scriptAssets: ["/shell-asset-manifest.js", "/a.js"],
    entryGroups: [{
      id: "ordered-classic-scripts",
      phase: "compatibility",
      startupCritical: true,
      chunkTarget: "ordered-classic-scripts",
      assets: ["/shell-asset-manifest.js", "/a.js"],
    }],
    linkAssets: ["/styles.css"],
    iconAssets: [],
    precacheAssets: ["/", "/index.html", "/styles.css", "/manifest.json", "/shell-asset-manifest.js", "/a.js", "/shell-asset-manifest.json"],
    pageShellAssets: ["/", "/index.html", "/styles.css", "/manifest.json", "/shell-asset-manifest.js", "/a.js", "/shell-asset-manifest.json", "/sw.js"],
    hashAssets: ["/index.html", "/styles.css", "/manifest.json", "/shell-asset-manifest.js", "/a.js", "/shell-asset-manifest.json", "/sw.js"],
  };
  fs.writeFileSync(path.join(root, "public", "shell-asset-manifest.json"), `${JSON.stringify(staleManifest, null, 2)}\n`);
  fs.writeFileSync(path.join(root, "public", "shell-asset-manifest.js"), [
    "\"use strict\";",
    "(function (root) {",
    `  root.CODEX_MOBILE_SHELL_MANIFEST = ${JSON.stringify(staleManifest)};`,
    "}(typeof globalThis !== \"undefined\" ? globalThis : this));",
    "",
  ].join("\n"));
  fs.writeFileSync(path.join(root, "public", "index.html"), [
    "<!doctype html>",
    "<link rel=\"stylesheet\" href=\"/styles.css\">",
    "<script src=\"/shell-asset-manifest.js\"></script>",
    "<script src=\"/a.js\"></script>",
    "<script src=\"/b.js\"></script>",
  ].join("\n"));
  fs.writeFileSync(path.join(root, "public", "b.js"), "\"use strict\";\n");
  const manifest = buildShellAssetManifest(root);
  assert.equal(manifest.validation.ok, false);
  assert.ok(manifest.validation.issues.some((issue) => issue.code === "public_shell_manifest_out_of_date"));
  assert.ok(manifest.validation.issues.some((issue) => issue.code === "sw_missing_index_script" && issue.asset === "/b.js"));
});
