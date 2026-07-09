"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { createRateLimitRuntimeService } = require("../services/runtime/rate-limit-runtime-service");

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "rate-limit-runtime-"));
}

function activeQuota(percent) {
  return {
    limitId: "codex",
    primary: {
      usedPercent: percent,
      windowDurationMins: 300,
      resetsAt: Math.floor(Date.now() / 1000) + 3600,
    },
  };
}

test("rate-limit runtime clears stale quota when active profile home changes", () => {
  const root = tempDir();
  const firstHome = path.join(root, "first");
  const secondHome = path.join(root, "second");
  fs.mkdirSync(firstHome, { recursive: true });
  fs.mkdirSync(secondHome, { recursive: true });
  let activeHome = firstHome;
  const service = createRateLimitRuntimeService({
    codexHome: () => activeHome,
    sessionsDir: () => path.join(activeHome, "sessions"),
    archivedSessionsDir: () => path.join(activeHome, "archived_sessions"),
    isRateLimitRolloutSourceAccountScoped: () => true,
    modelOptions: ["gpt-5.5"],
  });

  service.recordRateLimits(activeQuota(99), { source: "profile-mux-live" });
  assert.equal(service.activeRateLimits().primary.usedPercent, 99);
  assert.equal(service.latestLiveRateLimits().primary.usedPercent, 99);

  activeHome = secondHome;
  assert.equal(service.latestLiveRateLimits(), null);
  assert.equal(service.activeRateLimits(), null);

  service.recordRateLimits(activeQuota(18), { source: "profile-mux-live" });
  assert.equal(service.activeRateLimits().primary.usedPercent, 18);
});
