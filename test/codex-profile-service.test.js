"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  authStatusForHome,
  createCodexProfileService,
  resolveActiveCodexHomeFromStore,
  resolveEffectiveCodexHome,
} = require("../adapters/codex-profile-service");

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "codex-profile-service-"));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value)}\n`, "utf8");
}

function linkDirectory(target, linkPath) {
  fs.mkdirSync(path.dirname(linkPath), { recursive: true });
  fs.symlinkSync(target, linkPath, process.platform === "win32" ? "junction" : "dir");
}

function fakeJwt(payload) {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8")
    .toString("base64url");
  return `header.${encoded}.signature`;
}

test("auth status exposes safe account identity without tokens", () => {
  const root = tempDir();
  const home = path.join(root, "current");
  writeJson(path.join(home, "auth.json"), {
    auth_mode: "chatgpt",
    tokens: {
      account_id: "acct_1234567890abcdef",
      id_token: fakeJwt({ email: "user@example.test", name: "Example User", sub: "secret-subject" }),
      access_token: "secret-access-token",
      refresh_token: "secret-refresh-token",
    },
    last_refresh: "2026-06-01T00:00:00.000Z",
  });

  const status = authStatusForHome(home);
  assert.equal(status.status, "loggedIn");
  assert.equal(status.email, "user@example.test");
  assert.equal(status.name, "Example User");
  assert.equal(status.accountId, "acct_123...cdef");
  assert.equal(JSON.stringify(status).includes("secret-access-token"), false);
  assert.equal(JSON.stringify(status).includes("secret-refresh-token"), false);
  assert.equal(JSON.stringify(status).includes("secret-subject"), false);
});

test("profile service lists default current and previous homes with active account", () => {
  const userHome = tempDir();
  const runtimeRoot = path.join(userHome, ".codex-mobile-web");
  const activeHome = path.join(userHome, ".codex");
  writeJson(path.join(activeHome, "auth.json"), {
    tokens: { id_token: fakeJwt({ email: "active@example.test" }) },
  });
  fs.mkdirSync(path.join(userHome, ".codex-homes", "current"), { recursive: true });
  fs.mkdirSync(path.join(userHome, ".codex-homes", "previous"), { recursive: true });

  const service = createCodexProfileService({
    userHome,
    runtimeRoot,
    activeCodexHome: activeHome,
    env: {},
  });
  const result = service.profiles();
  assert.equal(result.activeProfileId, "default");
  assert.deepEqual(result.profiles.map((profile) => profile.id), ["default", "current", "previous"]);
  assert.equal(result.profiles[0].auth.email, "active@example.test");
});

test("setting active profile persists the selected codex home for restart bootstrap", () => {
  const userHome = tempDir();
  const runtimeRoot = path.join(userHome, ".codex-mobile-web");
  const previousHome = path.join(userHome, ".codex-homes", "previous");
  writeJson(path.join(previousHome, "auth.json"), {
    tokens: { id_token: fakeJwt({ email: "previous@example.test" }) },
  });

  const service = createCodexProfileService({
    userHome,
    runtimeRoot,
    activeCodexHome: path.join(userHome, ".codex"),
    env: {},
  });
  const selected = service.setActiveProfile("previous");
  assert.equal(selected.id, "previous");

  const bootstrap = resolveActiveCodexHomeFromStore({ userHome, runtimeRoot, env: {} });
  assert.equal(bootstrap.activeProfileId, "previous");
  assert.equal(bootstrap.codexHome, previousHome);
});

test("effective codex home follows active profile store before stale environment home", () => {
  const userHome = tempDir();
  const runtimeRoot = path.join(userHome, ".codex-mobile-web");
  const defaultHome = path.join(userHome, ".codex");
  const previousHome = path.join(userHome, ".codex-homes", "previous");
  writeJson(path.join(runtimeRoot, "codex-profiles.json"), {
    activeProfileId: "default",
    profiles: [
      { id: "default", label: "Default", codexHome: defaultHome },
      { id: "previous", label: "Previous", codexHome: previousHome },
    ],
  });

  const resolved = resolveEffectiveCodexHome({
    userHome,
    runtimeRoot,
    env: { CODEX_HOME: previousHome },
  });
  assert.equal(resolved.codexHome, defaultHome);
  assert.equal(resolved.source, "profile-store");
  assert.equal(resolved.envCodexHomeIgnored, true);
  assert.equal(resolved.activeProfileId, "default");
});

test("effective codex home allows explicit environment override", () => {
  const userHome = tempDir();
  const runtimeRoot = path.join(userHome, ".codex-mobile-web");
  const defaultHome = path.join(userHome, ".codex");
  const previousHome = path.join(userHome, ".codex-homes", "previous");
  writeJson(path.join(runtimeRoot, "codex-profiles.json"), {
    activeProfileId: "default",
    profiles: [{ id: "default", label: "Default", codexHome: defaultHome }],
  });

  const resolved = resolveEffectiveCodexHome({
    userHome,
    runtimeRoot,
    env: {
      CODEX_HOME: previousHome,
      CODEX_MOBILE_CODEX_HOME_OVERRIDE: "1",
    },
  });
  assert.equal(resolved.codexHome, previousHome);
  assert.equal(resolved.source, "env-override");
  assert.equal(resolved.envCodexHomeIgnored, false);
});

test("active quota snapshots are persisted and reused when rollout data is absent", () => {
  const userHome = tempDir();
  const runtimeRoot = path.join(userHome, ".codex-mobile-web");
  const activeHome = path.join(userHome, ".codex");
  fs.mkdirSync(activeHome, { recursive: true });
  const service = createCodexProfileService({
    userHome,
    runtimeRoot,
    activeCodexHome: activeHome,
    env: {},
  });
  const snapshot = {
    rateLimits: {
      limitId: "codex",
      primary: { usedPercent: 25, windowDurationMins: 300, resetsAt: Math.floor(Date.now() / 1000) + 3600 },
      secondary: { usedPercent: 40, windowDurationMins: 10080, resetsAt: Math.floor(Date.now() / 1000) + 86400 },
    },
  };

  const first = service.profiles({ activeQuota: snapshot });
  assert.equal(first.profiles[0].quota.rateLimits.primary.usedPercent, 25);

  const second = createCodexProfileService({
    userHome,
    runtimeRoot,
    activeCodexHome: activeHome,
    env: {},
  }).profiles();
  assert.equal(second.profiles[0].quota.rateLimits.primary.usedPercent, 25);
  assert.equal(second.profiles[0].quota.rateLimits.secondary.usedPercent, 40);
});

test("active quota snapshot follows the selected active profile", () => {
  const userHome = tempDir();
  const runtimeRoot = path.join(userHome, ".codex-mobile-web");
  const previousHome = path.join(userHome, ".codex-homes", "previous");
  fs.mkdirSync(previousHome, { recursive: true });
  const service = createCodexProfileService({
    userHome,
    runtimeRoot,
    activeCodexHome: path.join(userHome, ".codex"),
    env: {},
  });
  service.setActiveProfile("previous");

  const result = createCodexProfileService({
    userHome,
    runtimeRoot,
    activeCodexHome: previousHome,
    env: {},
  }).profiles({
    activeQuota: {
      rateLimits: {
        limitId: "codex",
        primary: { usedPercent: 10, windowDurationMins: 300, resetsAt: Math.floor(Date.now() / 1000) + 3600 },
      },
    },
  });

  const previous = result.profiles.find((profile) => profile.id === "previous");
  assert.equal(result.activeProfileId, "previous");
  assert.equal(previous.quota.rateLimits.primary.usedPercent, 10);
});

test("shared rollout quota is not reused across profile homes", () => {
  const userHome = tempDir();
  const runtimeRoot = path.join(userHome, ".codex-mobile-web");
  const defaultHome = path.join(userHome, ".codex");
  const previousHome = path.join(userHome, ".codex-homes", "previous");
  const sharedSessions = path.join(defaultHome, "sessions");
  fs.mkdirSync(sharedSessions, { recursive: true });
  fs.writeFileSync(path.join(sharedSessions, "rollout.jsonl"), `${JSON.stringify({
    timestamp: new Date().toISOString(),
    payload: {
      rate_limits: {
        limitId: "codex",
        primary: { usedPercent: 87, windowDurationMins: 300, resetsAt: Math.floor(Date.now() / 1000) + 3600 },
      },
    },
  })}\n`, "utf8");
  fs.mkdirSync(previousHome, { recursive: true });
  linkDirectory(sharedSessions, path.join(previousHome, "sessions"));

  const result = createCodexProfileService({
    userHome,
    runtimeRoot,
    activeCodexHome: previousHome,
    env: {},
  }).profiles();
  const active = result.profiles.find((profile) => profile.active);

  assert.ok(active);
  assert.equal(active.codexHome, previousHome);
  assert.equal(active.quota.rateLimits, null);
  assert.equal(active.quota.source, null);
});

test("shared profile homes do not persist or reuse active live quota snapshots", () => {
  const userHome = tempDir();
  const runtimeRoot = path.join(userHome, ".codex-mobile-web");
  const defaultHome = path.join(userHome, ".codex");
  const previousHome = path.join(userHome, ".codex-homes", "previous");
  const sharedSessions = path.join(defaultHome, "sessions");
  fs.mkdirSync(sharedSessions, { recursive: true });
  fs.mkdirSync(previousHome, { recursive: true });
  linkDirectory(sharedSessions, path.join(previousHome, "sessions"));
  writeJson(path.join(runtimeRoot, "codex-profiles.json"), {
    activeProfileId: "previous",
    profiles: [{ id: "previous", label: "Previous", codexHome: previousHome }],
    quotaSnapshots: {
      previous: {
        source: "active-live",
        rateLimits: {
          limitId: "codex",
          primary: { usedPercent: 88, windowDurationMins: 300, resetsAt: Math.floor(Date.now() / 1000) + 3600 },
        },
      },
    },
  });

  const result = createCodexProfileService({
    userHome,
    runtimeRoot,
    activeCodexHome: previousHome,
    env: {},
  }).profiles({
    activeQuota: {
      rateLimits: {
        limitId: "codex",
        primary: { usedPercent: 12, windowDurationMins: 300, resetsAt: Math.floor(Date.now() / 1000) + 3600 },
      },
    },
  });
  const previous = result.profiles.find((profile) => profile.id === "previous");
  const store = JSON.parse(fs.readFileSync(path.join(runtimeRoot, "codex-profiles.json"), "utf8"));

  assert.equal(previous.quota.rateLimits, null);
  assert.equal(previous.quota.source, null);
  assert.equal(store.quotaSnapshots.previous, undefined);
});

test("shared profile homes expose managed child live quota without persisting it", () => {
  const userHome = tempDir();
  const runtimeRoot = path.join(userHome, ".codex-mobile-web");
  const defaultHome = path.join(userHome, ".codex");
  const previousHome = path.join(userHome, ".codex-homes", "previous");
  const sharedSessions = path.join(defaultHome, "sessions");
  fs.mkdirSync(sharedSessions, { recursive: true });
  fs.mkdirSync(previousHome, { recursive: true });
  linkDirectory(sharedSessions, path.join(previousHome, "sessions"));
  writeJson(path.join(runtimeRoot, "codex-profiles.json"), {
    activeProfileId: "previous",
    profiles: [{ id: "previous", label: "Previous", codexHome: previousHome }],
    quotaSnapshots: {},
  });

  const result = createCodexProfileService({
    userHome,
    runtimeRoot,
    activeCodexHome: previousHome,
    env: {},
  }).profiles({
    activeQuota: {
      source: "managed-child-live",
      rateLimits: {
        limitId: "codex",
        primary: { usedPercent: 12, windowDurationMins: 300, resetsAt: Math.floor(Date.now() / 1000) + 3600 },
        secondary: { usedPercent: 34, windowDurationMins: 10080, resetsAt: Math.floor(Date.now() / 1000) + 7200 },
      },
    },
  });
  const previous = result.profiles.find((profile) => profile.id === "previous");
  const store = JSON.parse(fs.readFileSync(path.join(runtimeRoot, "codex-profiles.json"), "utf8"));

  assert.equal(previous.quota.source, "managed-child-live");
  assert.equal(previous.quota.rateLimits.primary.usedPercent, 12);
  assert.equal(previous.quota.rateLimits.secondary.usedPercent, 34);
  assert.deepEqual(store.quotaSnapshots, {});
});

test("legacy stored quota snapshots without live provenance are ignored", () => {
  const userHome = tempDir();
  const runtimeRoot = path.join(userHome, ".codex-mobile-web");
  const previousHome = path.join(userHome, ".codex-homes", "previous");
  fs.mkdirSync(previousHome, { recursive: true });
  writeJson(path.join(runtimeRoot, "codex-profiles.json"), {
    activeProfileId: "previous",
    profiles: [{ id: "previous", label: "Previous", codexHome: previousHome }],
    quotaSnapshots: {
      previous: {
        source: "active",
        rateLimits: {
          limitId: "codex",
          primary: { usedPercent: 91, windowDurationMins: 300, resetsAt: Math.floor(Date.now() / 1000) + 3600 },
        },
      },
    },
  });

  const result = createCodexProfileService({
    userHome,
    runtimeRoot,
    activeCodexHome: previousHome,
    env: {},
  }).profiles();
  const previous = result.profiles.find((profile) => profile.id === "previous");

  assert.equal(previous.quota.rateLimits, null);
  assert.equal(previous.quota.source, null);
});

test("profile switching is disabled when a fixed app-server endpoint is configured", () => {
  const userHome = tempDir();
  const service = createCodexProfileService({
    userHome,
    runtimeRoot: path.join(userHome, ".codex-mobile-web"),
    activeCodexHome: path.join(userHome, ".codex"),
    env: { CODEX_MOBILE_MUX_ENDPOINT_FILE: "C:\\fixed\\endpoint.json" },
  });
  assert.equal(service.profiles().switchSupported, false);
  assert.throws(() => service.setActiveProfile("current"), /requires the default per-profile mux endpoint/);
});
