"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { test } = require("node:test");

function resetProfileSwitchGlobals() {
  const timers = [];
  globalThis.window = {
    setTimeout: (fn, delay) => {
      const id = timers.length + 1;
      timers.push({ id, fn, delay });
      return id;
    },
    clearTimeout: () => {},
  };
  const elements = new Map();
  globalThis.$ = (id) => {
    if (!elements.has(id)) {
      elements.set(id, {
        id,
        textContent: "",
        classList: { toggle: () => {} },
        rows: 0,
        hidden: false,
        value: "",
        placeholder: "",
        focus: () => {},
      });
    }
    return elements.get(id);
  };
  globalThis.state = {
    appNativeDialogMode: "alert",
    appNativeDialogOpen: false,
    appNativeDialogResolve: null,
    codexProfileSwitchStageTimers: [],
    codexProfileSwitchBusy: false,
    codexProfileRestarting: false,
  };
  globalThis.CODEX_PROFILE_SWITCH_STAGES = [
    { id: "profile_lookup", label: "读取 Profile" },
    { id: "waiting_for_restart", label: "等待重启" },
  ];
  globalThis.createSubmissionId = () => "profile-switch-request-1";
  globalThis.clearStoredRateLimits = () => {};
  globalThis.renderCodexProfileSettings = () => {
    globalThis.state.renderedProfileSettings = true;
  };
  globalThis.showReconnectRefreshPrompt = (reason) => {
    globalThis.state.reconnectReason = reason;
  };
  globalThis.showError = (err) => {
    globalThis.state.profileSwitchError = err && err.message || String(err);
  };
  return { elements, timers };
}

test("profile switch uses callable API helper for active profile POST", async () => {
  const { elements } = resetProfileSwitchGlobals();
  const calls = [];
  globalThis.api = async (url, options = {}) => {
    calls.push({ url, options });
    return {
      ok: true,
      progress: {
        stage: "waiting_for_restart",
        message: "切换已写入，正在等待服务恢复...",
        stepIndex: 10,
        stepCount: 10,
      },
    };
  };

  const moduleUrl = pathToFileURL(path.resolve(__dirname, "..", "frontend", "native", "modal-runtime.mjs")).href;
  const modalRuntime = await import(`${moduleUrl}?profile-switch=${Date.now()}`);

  assert.equal(typeof modalRuntime.default.createModalRuntime, "function");
  assert.equal(typeof globalThis.performCodexProfileSwitch, "function");

  await globalThis.performCodexProfileSwitch("target-profile");

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/codex-profiles/active");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.timeoutMs, 90000);
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    profileId: "target-profile",
    requestId: "profile-switch-request-1",
  });
  assert.equal(globalThis.state.codexProfileRestarting, true);
  assert.equal(globalThis.state.reconnectReason, "restart");
  assert.equal(globalThis.state.profileSwitchError, undefined);
  assert.doesNotMatch(elements.get("connectionState").textContent, /api(?:\$1)? is not a function/);
});

test("profile switch failure path does not report API namespace object errors", async () => {
  const { elements } = resetProfileSwitchGlobals();
  globalThis.api = async (url) => {
    assert.equal(url, "/api/codex-profiles/active");
    throw new Error("target_profile_unavailable");
  };

  const moduleUrl = pathToFileURL(path.resolve(__dirname, "..", "frontend", "native", "modal-runtime.mjs")).href;
  await import(`${moduleUrl}?profile-switch-failure=${Date.now()}`);
  await globalThis.performCodexProfileSwitch("target-profile");

  assert.equal(globalThis.state.profileSwitchError, "target_profile_unavailable");
  assert.doesNotMatch(elements.get("connectionState").textContent, /api(?:\$1)? is not a function/);
});

test("current Vite shell profile switch artifact keeps request helper callable", () => {
  const repoRoot = path.resolve(__dirname, "..");
  const readback = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "public", "vite-shell", "vite-shell-readback.json"), "utf8")
  );
  const shellManifest = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "public", "shell-asset-manifest.json"), "utf8")
  );
  assert.equal(readback.clientBuildId, shellManifest.clientBuildId);
  assert.equal(readback.shellCacheName, shellManifest.shellCacheName);
  assert.notEqual(readback.clientBuildId, "0.1.11|codex-mobile-shell-v625-f42567014622");
  assert.ok(readback.viteArtifactCache);
  assert.deepEqual(readback.viteArtifactCache, shellManifest.viteArtifactCache);
  assert.match(fs.readFileSync(path.join(repoRoot, "public", "vite-shell", "preview.html"), "utf8"), new RegExp(`data-client-build-id="${readback.clientBuildId}"`));
  const publishedAssets = readback.publishedFiles
    .map((record) => record && record.fileName)
    .filter((fileName) => typeof fileName === "string" && fileName.endsWith(".js"));
  assert.ok(publishedAssets.length > 0);

  let profileSwitchAssetCount = 0;
  for (const fileName of publishedAssets) {
    const source = fs.readFileSync(path.join(repoRoot, "public", "vite-shell", fileName), "utf8");
    assert.doesNotMatch(source, /api\$1\("\/api\/codex-profiles\/active"/, fileName);
    assert.doesNotMatch(source, /var api\$1 = \{ createModalRuntime \}/, fileName);
    assert.doesNotMatch(source, /const api = \{ createModalRuntime \}/, fileName);
    if (source.includes('api("/api/codex-profiles/active"')) {
      profileSwitchAssetCount += 1;
    }
  }

  assert.equal(profileSwitchAssetCount, 1);
});
