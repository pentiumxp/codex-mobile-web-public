"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const appBootstrapJs = fs.readFileSync(path.join(root, "public", "app-bootstrap.js"), "utf8");
const settingsRuntimeJs = fs.readFileSync(path.join(root, "public", "settings-runtime.js"), "utf8");
const settingsRuntime = require(path.join(root, "public", "settings-runtime.js"));

function htmlAttrDecode(value) {
  return String(value || "")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

class FakeField {
  constructor(name, value = "") {
    this.name = name;
    this.value = value;
  }

  getAttribute(name) {
    return name === "data-rmw-field" ? this.name : "";
  }
}

class FakeContainer {
  constructor() {
    this.fields = new Map();
    this.html = "";
  }

  set innerHTML(value) {
    this.html = String(value || "");
    this.fields = new Map();
    const inputRegex = /<input\b[^>]*data-rmw-field="([^"]+)"[^>]*>/g;
    let match;
    while ((match = inputRegex.exec(this.html))) {
      const tag = match[0];
      const valueMatch = tag.match(/\bvalue="([^"]*)"/);
      this.fields.set(match[1], new FakeField(match[1], htmlAttrDecode(valueMatch ? valueMatch[1] : "")));
    }
  }

  get innerHTML() {
    return this.html;
  }

  querySelectorAll(selector) {
    if (selector === "[data-rmw-field]") return [...this.fields.values()];
    return [];
  }

  querySelector(selector) {
    const match = String(selector || "").match(/^\[data-rmw-field="([^"]+)"\]$/);
    if (!match) return null;
    return this.fields.get(match[1]) || null;
  }
}

class FakeButton {
  constructor(action, workspaceCwd = "") {
    this.action = action;
    this.workspaceCwd = workspaceCwd;
    this.disabled = false;
  }

  closest(selector) {
    return selector === "[data-rmw-action]" ? this : null;
  }

  getAttribute(name) {
    if (name === "data-rmw-action") return this.action;
    if (name === "data-rmw-workspace-cwd") return this.workspaceCwd;
    return "";
  }
}

function installRemoteManagedWorkspaceDomHarness(options = {}) {
  const container = new FakeContainer();
  const connectionState = { textContent: "" };
  const errors = [];
  const calls = [];
  const workspace = options.workspace || {
    cwd: "C:\\Users\\codex\\Documents\\GMK-test",
    label: "GMK-test",
  };
  let savedCentralUrl = String(options.initialCentralUrl || "");

  globalThis.state = {
    remoteManagedWorkspace: {
      enabled: Boolean(options.enabled),
      centralUrl: String(options.initialCentralUrl || ""),
      connectionStatus: "disconnected",
      pairingStatus: String(options.pairingStatus || "unconfigured"),
      scopedCredentialConfigured: Boolean(options.scopedCredentialConfigured),
    },
    remoteManagedWorkspaceBusy: false,
    remoteManagedWorkspaceWorkspaceLoadAttempted: true,
    remoteManagedWorkspaceWorkspaceLoadInFlight: false,
    workspaces: [workspace],
  };
  globalThis.$ = (id) => {
    if (id === "remoteManagedWorkspaceSettings") return container;
    if (id === "connectionState") return connectionState;
    return null;
  };
  globalThis.showError = (err) => errors.push(err);
  globalThis.api = async (url, request = {}) => {
    calls.push({ url, request });
    if (url === "/api/settings/remote-managed-workspace" && request.method === "POST") {
      const body = JSON.parse(request.body || "{}");
      savedCentralUrl = String(body.centralUrl || "");
      return {
        remoteManagedWorkspace: {
          enabled: false,
          centralUrl: savedCentralUrl,
          connectionStatus: "disconnected",
        },
      };
    }
    if (url === "/api/settings/remote-managed-workspace") {
      return {
        remoteManagedWorkspace: {
          enabled: Boolean(options.enabled),
          centralUrl: options.readbackCentralUrl === undefined ? savedCentralUrl : options.readbackCentralUrl,
          connectionStatus: "disconnected",
          pairingStatus: String(options.pairingStatus || "unconfigured"),
          scopedCredentialConfigured: Boolean(options.scopedCredentialConfigured),
        },
      };
    }
    if (url === "/api/settings/remote-managed-workspace/register" && request.method === "POST") {
      return {
        remoteManagedWorkspace: {
          enabled: true,
          centralUrl: savedCentralUrl || String(options.initialCentralUrl || ""),
          connectionStatus: "connecting",
          pairingStatus: String(options.registerPairingStatus || "pending_approval"),
          pairingRequestId: "rmw_pair_ui",
          scopedCredentialConfigured: Boolean(options.registerScopedCredentialConfigured),
        },
      };
    }
    if (url === "/api/workspaces") return { data: [workspace] };
    throw new Error(`unexpected api call: ${url}`);
  };
  return { container, connectionState, errors, calls, workspace };
}

test("settings runtime preserves CommonJS and legacy global entry points", () => {
  assert.equal(typeof settingsRuntime.createSettingsRuntime, "function");
  const runtime = settingsRuntime.createSettingsRuntime();
  for (const name of [
    "renderFontSizeControl",
    "renderQuotaUsage",
    "renderCodexProfileSettings",
    "renderWorkspaceDelegationSettings",
    "renderRemoteManagedWorkspaceSettings",
    "rememberRateLimitsFromConfig",
    "rememberCodexProfiles",
  ]) {
    assert.equal(typeof runtime[name], "function", `${name} should be exported`);
  }
  for (const name of [
    "saveRestartAutoRecoverThreads",
    "clearRestartAutoRecoverThreads",
    "initializeRestartAutoRecoverThreads",
    "renderQuotaUsage",
    "renderCodexProfileSettings",
    "rememberRateLimitsFromConfig",
    "rememberCodexProfiles",
    "threadDisplayName",
    "statusText",
    "showCompletionAlert",
    "requestSharedRestartConfirmation",
    "refreshPageForNewBuild",
  ]) {
    assert.equal(typeof globalThis[name], "function", `${name} should remain a legacy global`);
  }
  assert.equal(globalThis.CodexSettingsRuntime, settingsRuntime);
  assert.match(settingsRuntimeJs, /module\.exports = settingsRuntimeApi/);
  assert.match(settingsRuntimeJs, /Object\.assign\(root,/);
  assert.match(settingsRuntimeJs, /root\.CodexSettingsRuntime = settingsRuntimeApi/);
  assert.match(appBootstrapJs, /if \(typeof initializeRestartAutoRecoverThreads === "function"\) \{[\s\S]*initializeRestartAutoRecoverThreads\(\);/);
  assert.match(settingsRuntimeJs, /function normalizeRemoteManagedWorkspaceConfig/);
  assert.match(settingsRuntimeJs, /data-rmw-action="save-central"/);
  assert.match(settingsRuntimeJs, /"enable-workspace"/);
  assert.match(settingsRuntimeJs, /"disable-workspace"/);
  assert.match(settingsRuntimeJs, /Advanced \/ Diagnostics/);
  assert.match(settingsRuntimeJs, /scopedCredentialConfigured/);
  assert.match(settingsRuntimeJs, /请求配对/);
  assert.doesNotMatch(settingsRuntimeJs, /Enrollment token/);
  assert.doesNotMatch(settingsRuntimeJs, /data-rmw-field="enrollmentToken"/);
  assert.match(settingsRuntimeJs, /\/api\/settings\/remote-managed-workspace\/workspace/);
  assert.doesNotMatch(settingsRuntimeJs, /data-rmw-field="workspaceId"/);
  assert.doesNotMatch(settingsRuntimeJs, /data-rmw-field="nodeName"/);
  assert.doesNotMatch(settingsRuntimeJs, /data-rmw-field="roles"/);
  assert.doesNotMatch(settingsRuntimeJs, /data-rmw-field="capabilities"/);
  assert.match(settingsRuntimeJs, /api\("\/api\/settings\/remote-managed-workspace"/);
  assert.match(appBootstrapJs, /remoteManagedWorkspace:\s*\{/);
});

test("remote managed workspace save preserves typed central URL through busy render and readback", async () => {
  const harness = installRemoteManagedWorkspaceDomHarness();
  globalThis.renderRemoteManagedWorkspaceSettings();
  harness.container.querySelector("[data-rmw-field=\"centralUrl\"]").value = "http://127.0.0.1:8797";

  await globalThis.handleRemoteManagedWorkspaceSettingsClick({
    target: new FakeButton("save-central"),
  });

  const post = harness.calls.find((call) => call.url === "/api/settings/remote-managed-workspace" && call.request.method === "POST");
  assert.ok(post, "settings POST should be issued");
  assert.equal(JSON.parse(post.request.body).centralUrl, "http://127.0.0.1:8797");
  assert.equal(harness.errors.length, 0);
  assert.equal(harness.connectionState.textContent, "Remote Managed Workspace 已保存");
  assert.equal(harness.container.querySelector("[data-rmw-field=\"centralUrl\"]").value, "http://127.0.0.1:8797");
  assert.match(harness.container.innerHTML, /GMK-test/);
  assert.match(harness.container.innerHTML, /远程受控/);
  assert.doesNotMatch(harness.container.innerHTML, /Enrollment token/);
});

test("remote managed workspace save reports readback failure instead of success toast", async () => {
  const harness = installRemoteManagedWorkspaceDomHarness({ readbackCentralUrl: "" });
  globalThis.renderRemoteManagedWorkspaceSettings();
  harness.container.querySelector("[data-rmw-field=\"centralUrl\"]").value = "http://127.0.0.1:8797";

  await globalThis.handleRemoteManagedWorkspaceSettingsClick({
    target: new FakeButton("save-central"),
  });

  assert.equal(JSON.parse(harness.calls.find((call) => call.request.method === "POST").request.body).centralUrl, "http://127.0.0.1:8797");
  assert.equal(harness.errors.length, 1);
  assert.equal(harness.errors[0].message, "Remote Managed Workspace 保存读回失败");
  assert.equal(harness.connectionState.textContent, "Remote Managed Workspace 保存读回失败");
});

test("remote managed workspace register button requests pairing and renders pending approval without token input", async () => {
  const harness = installRemoteManagedWorkspaceDomHarness({
    enabled: true,
    initialCentralUrl: "http://127.0.0.1:8797",
    pairingStatus: "unconfigured",
  });
  globalThis.renderRemoteManagedWorkspaceSettings();

  assert.match(harness.container.innerHTML, /请求配对/);
  assert.doesNotMatch(harness.container.innerHTML, /Enrollment token/);
  assert.equal(harness.container.querySelector("[data-rmw-field=\"enrollmentToken\"]"), null);

  await globalThis.handleRemoteManagedWorkspaceSettingsClick({
    target: new FakeButton("register"),
  });

  assert.equal(harness.calls.some((call) => call.url === "/api/settings/remote-managed-workspace/register"), true);
  assert.match(harness.connectionState.textContent, /等待 Home AI 审批/);
  assert.match(harness.container.innerHTML, /等待 Home AI 审批/);
  assert.doesNotMatch(harness.container.innerHTML, /rmw-secret|route-scoped|Bearer/i);
});
