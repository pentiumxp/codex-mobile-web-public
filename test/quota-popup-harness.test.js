"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  analyzeQuotaPopupScenario,
  entryUrlForScenario,
  parseArgs,
} = require("../scripts/codex-mobile-quota-popup-harness");

test("quota popup harness fails when bridge toggle is missing", () => {
  const result = analyzeQuotaPopupScenario({
    before: {
      runtimeToggleType: "undefined",
      runtimeCloseType: "function",
      buttonVisible: true,
    },
    after: {
      ariaExpanded: "false",
      panelHidden: true,
      panelVisible: false,
      panelText: "",
    },
  });

  assert.equal(result.ok, false);
  assert.ok(result.issueCodes.includes("quota_bridge_toggle_missing"));
  assert.ok(result.issueCodes.includes("quota_panel_not_open"));
});

test("quota popup harness accepts opened quota details with expected content", () => {
  const result = analyzeQuotaPopupScenario({
    before: {
      runtimeToggleType: "function",
      runtimeCloseType: "function",
      buttonVisible: true,
    },
    after: {
      ariaExpanded: "true",
      panelHidden: false,
      panelVisible: true,
      panelText: "额度 当前模型\n5小时额度 80%\n周额度 90%",
    },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.issueCodes, []);
});

test("quota popup harness parses service worker and thread options", () => {
  const options = parseArgs([
    "--server", "http://127.0.0.1:8897/",
    "--thread-id", "thread-123",
    "--service-workers", "both",
    "--entry-surface", "direct",
    "--click-count", "2",
    "--click-interval-ms", "180",
    "--timeout-ms", "12000",
    "--json",
  ], {});

  assert.equal(options.server, "http://127.0.0.1:8897");
  assert.equal(options.threadId, "thread-123");
  assert.equal(options.serviceWorkers, "both");
  assert.equal(options.entrySurface, "direct");
  assert.equal(options.clickCount, 2);
  assert.equal(options.clickIntervalMs, 180);
  assert.equal(options.timeoutMs, 12000);
  assert.equal(options.json, true);
});

test("quota popup harness entry URL targets the requested thread", () => {
  const options = parseArgs(["--server", "http://127.0.0.1:8897", "--thread-id", "thread-123"], {});
  const url = new URL(entryUrlForScenario(options, "run-1"));

  assert.equal(url.pathname, "/vite-shell/app-preview.html");
  assert.equal(url.searchParams.get("thread"), "thread-123");
  assert.equal(url.searchParams.get("threadId"), "thread-123");
  assert.equal(url.searchParams.get("quotaHarness"), "run-1");
});

test("quota popup harness can target the legacy direct root explicitly", () => {
  const options = parseArgs(["--server", "http://127.0.0.1:8897", "--thread-id", "thread-123", "--entry-surface", "direct"], {});
  const url = new URL(entryUrlForScenario(options, "run-1"));

  assert.equal(url.pathname, "/");
  assert.equal(url.searchParams.get("threadId"), "thread-123");
});
