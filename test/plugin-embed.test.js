"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const pluginEmbed = require("../public/plugin-embed");

test("detects Hermes embed mode and launch parameters", () => {
  const detected = pluginEmbed.detect("https://codex.example.test/?embed=hermes&codexPluginLaunch=cpl_abc123456789012345&workspaceId=owner");
  assert.equal(detected.embedded, true);
  assert.equal(detected.launchKey, "cpl_abc123456789012345");
  assert.equal(detected.workspaceId, "owner");
});

test("builds Codex plugin navigation messages without exposing DOM internals", () => {
  const message = pluginEmbed.navigationMessage({
    currentThreadId: "thread-1",
    selectedCwd: "C:\\Work",
  });
  assert.equal(message.type, "codex-mobile.plugin.navigation");
  assert.equal(message.version, 1);
  assert.equal(message.canGoBack, true);
  assert.deepEqual(message.route, { kind: "thread", threadId: "thread-1" });
  assert.doesNotMatch(JSON.stringify(message), /querySelector|document|function|access key/i);
});

test("prioritizes modal and drawer back states before thread navigation", () => {
  assert.deepEqual(
    pluginEmbed.navigationMessage({ currentThreadId: "thread-1" }, { filePreviewOpen: true }).route,
    { kind: "modal", modal: "filePreview", threadId: "thread-1" },
  );
  assert.deepEqual(
    pluginEmbed.navigationMessage({ currentThreadId: "thread-1" }, { sidebarOpen: true }).route,
    { kind: "drawer", drawer: "threadList", threadId: "thread-1" },
  );
  assert.equal(pluginEmbed.navigationMessage({}, {}).canGoBack, false);
});

test("recognizes Hermes plugin back messages and internal URLs", () => {
  assert.equal(pluginEmbed.isBackMessage({ data: { type: "hermes.plugin.back", version: 1 } }), true);
  assert.equal(pluginEmbed.isBackMessage({ data: { type: "hermes.plugin.back", version: 2 } }), false);
  assert.equal(pluginEmbed.isInternalUrl("/api/status", "http://127.0.0.1:8787"), true);
  assert.equal(pluginEmbed.isInternalUrl("https://external.example.test/", "http://127.0.0.1:8787"), false);
});
