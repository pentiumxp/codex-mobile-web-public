"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const pluginEmbed = require("../public/plugin-embed");

test("detects Hermes embed mode, launch parameters, and host appearance", () => {
  const detected = pluginEmbed.detect("https://codex.example.test/?embed=hermes&codexPluginLaunch=cpl_abc123456789012345&workspaceId=owner&pluginId=codex-mobile&pluginRoute=thread&pluginThreadId=thread-123&pluginTaskId=req-9&pluginTheme=light&pluginFontSize=xlarge");
  assert.equal(detected.embedded, true);
  assert.equal(detected.launchKey, "cpl_abc123456789012345");
  assert.equal(detected.workspaceId, "owner");
  assert.deepEqual(detected.routeHint, {
    pluginId: "codex-mobile",
    route: "thread",
    itemId: "",
    threadId: "thread-123",
    taskId: "req-9",
  });
  assert.deepEqual(detected.appearance, {
    theme: "light",
    fontSize: "xlarge",
  });
});

test("plans Hermes notification route-hint open and focus flows", () => {
  const threadOnly = pluginEmbed.routeHintOpenPlan({
    pluginId: "codex-mobile",
    route: "thread",
    threadId: "thread-123",
  });
  assert.equal(threadOnly.action, "openThread");
  assert.equal(threadOnly.threadId, "thread-123");
  assert.equal(threadOnly.targetId, "");
  assert.equal(threadOnly.pendingHint, null);
  assert.equal(threadOnly.statusMessage, "Opening notification thread");

  const taskTarget = pluginEmbed.routeHintOpenPlan({
    pluginId: "codex-mobile",
    route: "thread-task-card",
    threadId: "thread-123",
    taskId: "ttc_123",
  });
  assert.equal(taskTarget.action, "openThread");
  assert.equal(taskTarget.threadId, "thread-123");
  assert.equal(taskTarget.targetId, "ttc_123");
  assert.deepEqual(taskTarget.pendingHint, {
    pluginId: "codex-mobile",
    route: "thread-task-card",
    itemId: "",
    threadId: "thread-123",
    taskId: "ttc_123",
  });
  assert.equal(taskTarget.statusMessage, "Opening notification target");

  assert.deepEqual(pluginEmbed.routeHintOpenPlan({
    pluginId: "codex-mobile",
    route: "thread-task-card",
    taskId: "ttc_123",
  }), {
    action: "primary",
    diagnostic: { message: "Notification thread is unavailable", error: true },
  });

  assert.deepEqual(pluginEmbed.routeHintFocusPlan(taskTarget.pendingHint, {
    currentThreadId: "thread-123",
    targetFound: true,
  }), {
    action: "focused",
    diagnostic: { message: "Opened notification target", error: false },
  });

  assert.deepEqual(pluginEmbed.routeHintFocusPlan(taskTarget.pendingHint, {
    currentThreadId: "thread-123",
    targetFound: false,
  }), {
    action: "primary",
    diagnostic: { message: "Notification target is no longer available", error: true },
  });
});

test("locates Hermes route-hint targets through bounded DOM selectors", () => {
  const visited = [];
  const target = {
    scrollIntoView() {},
  };
  const root = {
    querySelector(selector) {
      visited.push(selector);
      return selector === '[data-task-card="ttc_123"]' ? target : null;
    },
  };

  assert.equal(pluginEmbed.findRouteHintTargetNode(root, {
    pluginId: "codex-mobile",
    threadId: "thread-123",
    taskId: "ttc_123",
  }), target);
  assert.deepEqual(visited, [
    '[data-approval-card="ttc_123"]',
    '[data-task-card="ttc_123"]',
  ]);
});

test("scrubs Hermes route-hint URLs to the embedded plugin root", () => {
  const scrubbed = pluginEmbed.scrubRouteHintPath(
    "https://codex.example.test/?embed=hermes&codexPluginLaunch=cpl_secret&pluginRoute=thread-task-card&pluginThreadId=thread-123&pluginTaskId=ttc_123&pluginItemId=item-1&workspaceId=old&pluginTheme=dark",
    {
      workspaceId: "owner",
      appearance: { theme: "light", fontSize: "xlarge" },
    },
  );

  assert.equal(scrubbed, "/?embed=hermes&workspaceId=owner&pluginTheme=light&pluginFontSize=xlarge");
  assert.doesNotMatch(scrubbed, /pluginRoute|pluginThreadId|pluginTaskId|pluginItemId|codexPluginLaunch|cpl_secret/);
});

test("ignores unsupported Hermes plugin appearance values", () => {
  const detected = pluginEmbed.detect("https://codex.example.test/?embed=hermes&pluginTheme=javascript:alert(1)&pluginFontSize=huge");
  assert.equal(detected.embedded, true);
  assert.deepEqual(detected.appearance, {});
});

test("builds Codex plugin navigation messages without exposing DOM internals", () => {
  const message = pluginEmbed.navigationMessage({
    currentThreadId: "thread-1",
    selectedCwd: "C:\\Work",
    fontSize: "xlarge",
    pluginAppearance: { theme: "light" },
  });
  assert.equal(message.type, "codex-mobile.plugin.navigation");
  assert.equal(message.version, 1);
  assert.equal(message.canGoBack, true);
  assert.deepEqual(message.route, { kind: "thread", threadId: "thread-1" });
  assert.deepEqual(message.appearance, { theme: "light", fontSize: "xlarge" });
  assert.doesNotMatch(JSON.stringify(message), /querySelector|document|function|access key/i);
  assert.equal(pluginEmbed.navigationMessage({ selectedCwd: "C:\\Work" }).canGoBack, false);
});

test("builds Codex plugin back-result messages for iframe-handled returns", () => {
  const message = pluginEmbed.backResultMessage(
    { currentThreadId: "thread-1" },
    { handled: true, reason: "handled_in_iframe", ui: { imagePreviewOpen: true } },
  );
  assert.equal(message.type, "codex-mobile.plugin.back_result");
  assert.equal(message.version, 1);
  assert.equal(message.handled, true);
  assert.equal(message.reason, "handled_in_iframe");
  assert.deepEqual(message.route, { kind: "modal", modal: "imagePreview", threadId: "thread-1" });
});

test("prioritizes modal and drawer back states before thread navigation", () => {
  assert.deepEqual(
    pluginEmbed.navigationMessage({ currentThreadId: "thread-1" }, { imagePreviewOpen: true }).route,
    { kind: "modal", modal: "imagePreview", threadId: "thread-1" },
  );
  assert.equal(pluginEmbed.navigationMessage({ currentThreadId: "thread-1" }, { imagePreviewOpen: true }).canGoBack, true);
  assert.deepEqual(
    pluginEmbed.navigationMessage({ currentThreadId: "thread-1" }, { imagePreviewOpen: true, mermaidPreviewOpen: true }).route,
    { kind: "modal", modal: "imagePreview", threadId: "thread-1" },
  );
  assert.deepEqual(
    pluginEmbed.navigationMessage({ currentThreadId: "thread-1" }, { filePreviewOpen: true }).route,
    { kind: "modal", modal: "filePreview", threadId: "thread-1" },
  );
  assert.equal(pluginEmbed.navigationMessage({ currentThreadId: "thread-1" }, { filePreviewOpen: true }).canGoBack, true);
  assert.equal(pluginEmbed.navigationMessage({}, { createWorkspaceOpen: true }).canGoBack, true);
  assert.equal(pluginEmbed.navigationMessage({}, { updatePanelOpen: true }).canGoBack, true);
  assert.equal(pluginEmbed.navigationMessage({ currentThreadId: "thread-1" }, { sidebarOpen: true }).canGoBack, true);
  assert.equal(pluginEmbed.navigationMessage({ currentThreadId: "thread-1" }, { settingsOpen: true }).canGoBack, true);
  assert.deepEqual(
    pluginEmbed.navigationMessage({ selectedCwd: "C:\\Work" }, { primaryPage: true, settingsOpen: true }).route,
    { kind: "root", workspace: "C:\\Work", settingsOpen: true },
  );
  assert.equal(pluginEmbed.navigationMessage({ selectedCwd: "C:\\Work" }, { primaryPage: true, settingsOpen: true }).canGoBack, false);
  assert.equal(pluginEmbed.navigationMessage({ currentThreadId: "thread-1" }, { primaryPage: true }).canGoBack, false);
  assert.deepEqual(
    pluginEmbed.navigationMessage({ currentThreadId: "thread-1" }, { sidebarOpen: true, settingsOpen: true }).route,
    { kind: "panel", panel: "settings", threadId: "thread-1" },
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

test("builds bounded external-link messages only for browser-safe links", () => {
  const message = pluginEmbed.externalLinkMessage({
    href: "https://download.example.test/report.zip?sig=bounded",
    source: "receipt-link",
  });

  assert.equal(message.type, "codex-mobile.plugin.external_link");
  assert.equal(message.version, 1);
  assert.equal(message.href, "https://download.example.test/report.zip?sig=bounded");
  assert.equal(message.source, "receipt-link");
  assert.equal(pluginEmbed.externalBrowserUrl("mailto:owner@example.test"), "mailto:owner@example.test");
  assert.equal(pluginEmbed.externalBrowserUrl("/api/files/preview/content?path=/tmp/a.zip", "https://codex.example.test"), "");
  assert.equal(pluginEmbed.externalBrowserUrl("file:///Users/xuxin/private.txt"), "");
  assert.equal(pluginEmbed.externalBrowserUrl("javascript:alert(1)"), "");
  assert.equal(pluginEmbed.externalLinkMessage({ href: "javascript:alert(1)" }), null);
});

test("builds bounded Hermes refresh-required messages without sensitive payloads", () => {
  const message = pluginEmbed.refreshRequiredMessage({
    reason: "auth_state_changed",
    route: {
      name: "thread",
      threadId: "thread-123",
      itemId: "item-456",
      pluginRoute: "thread",
      pluginTaskId: "task-789",
      pluginItemId: "item-456",
      ignored: "C:\\Users\\xuxin\\.codex-mobile-web\\secret",
    },
    appearance: {
      theme: "dark",
      fontSize: "xxlarge",
      accessKey: "must-not-leak",
    },
  });
  assert.equal(message.type, "codex-mobile.plugin.refresh_required");
  assert.equal(message.version, 1);
  assert.equal(message.reason, "auth_state_changed");
  assert.deepEqual(message.route, {
    name: "thread",
    threadId: "thread-123",
    itemId: "item-456",
    pluginRoute: "thread",
    pluginThreadId: "thread-123",
    pluginTaskId: "task-789",
    pluginItemId: "item-456",
  });
  assert.deepEqual(message.appearance, { theme: "dark", fontSize: "xxlarge" });
  assert.doesNotMatch(JSON.stringify(message), /access[_ -]?key|token|cookie|Authorization|C:\\Users/i);
});
