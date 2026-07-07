"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const userBehavior = require("../scripts/codex-mobile-user-behavior-check");
const centralVisual = require("../scripts/codex-mobile-central-compatible-visual");

test("user behavior bundle fails closed when required live targets are missing", () => {
  const options = userBehavior.parseArgs(["--json"], {});
  const plan = userBehavior.buildPlan(options);
  assert.equal(plan.ok, false);
  assert.equal(plan.status, "blocked_missing_user_behavior_targets");
  assert.deepEqual(
    plan.issues.map((issue) => issue.code),
    [
      "missing_submitted_harness_target",
      "missing_quota_harness_target",
      "missing_runtime_submit_target",
    ],
  );
});

test("user behavior bundle plans submitted quota and runtime gates for real threads", () => {
  const options = userBehavior.parseArgs([
    "--server", "http://127.0.0.1:8787",
    "--submitted-thread-id", "controlled:019f-controlled",
    "--submitted-thread-id", "homeai:019f-homeai",
    "--quota-thread-id", "019f-quota",
    "--runtime-submit-thread-id", "019f-controlled",
    "--expect-build-hash", "abc12345",
    "--service-workers", "both",
    "--plan-only",
    "--json",
  ], {});
  const result = userBehavior.runUserBehaviorCheck(options);
  assert.equal(result.ok, true);
  assert.equal(result.planOnly, true);
  assert.equal(result.commandCount, 4);
  const previews = result.commandPreview.map((items) => items.join(" "));
  assert.ok(previews.some((item) => item.includes("codex-mobile-submitted-message-harness.js") && item.includes("019f-controlled")));
  assert.ok(previews.some((item) => item.includes("codex-mobile-submitted-message-harness.js") && item.includes("019f-homeai")));
  assert.ok(previews.some((item) => item.includes("codex-mobile-quota-popup-harness.js") && item.includes("--click-interval-ms 80")));
  assert.ok(previews.some((item) => item.includes("codex-mobile-runtime-self-check-loop.js") && item.includes("--browser-exercise-submit")));
});

test("central-compatible visual evidence matches Home AI delegate-local schema", async () => {
  const options = centralVisual.parseArgs([
    "--scenario", "embedded-plugin-shell",
    "--plugin-id", "codex-mobile",
    "--base-url", "http://127.0.0.1:8797",
    "--plugin-server", "http://127.0.0.1:8787",
    "--json",
  ], {});
  const evidence = await centralVisual.buildEvidence(options);
  assert.equal(evidence.schemaVersion, "codex-mobile-plugin-visual/v1");
  assert.equal(evidence.pluginId, "codex-mobile");
  assert.equal(evidence.scenario, "embedded-plugin-shell");
  assert.equal(evidence.surface, "embedded-plugin");
  assert.equal(evidence.harnessKind, "codex-mobile-plugin-local-compatible");
  assert.equal(evidence.mode, "metadata-probe");
  assert.ok(Array.isArray(evidence.assertions));
  assert.ok(evidence.assertions.length >= 4);
  assert.doesNotMatch(JSON.stringify(evidence), /access[-_ ]?key|cookie|launch[-_ ]?token|bearer|secret/i);
});

test("package scripts expose hard user behavior and central-compatible visual entrypoints", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.match(pkg.scripts["check:user-behavior"], /codex-mobile-user-behavior-check\.js/);
  assert.match(pkg.scripts["check:user-behavior"], /user-behavior-harness-contract\.test\.js/);
  assert.match(pkg.scripts["visual:central-compatible"], /codex-mobile-central-compatible-visual\.js/);
  assert.match(pkg.scripts["visual:plugin"], /codex-mobile-central-compatible-visual\.js/);
  assert.match(pkg.scripts.check, /codex-mobile-user-behavior-check\.js/);
});

test("user behavior contract documents required symptom-to-harness matrix", () => {
  const doc = fs.readFileSync(path.join(root, "docs", "USER_BEHAVIOR_HARNESS_CONTRACT.md"), "utf8");
  assert.match(doc, /Submitted user message duplicates/);
  assert.match(doc, /codex-mobile-submitted-message-harness\.js/);
  assert.match(doc, /codex-mobile-quota-popup-harness\.js/);
  assert.match(doc, /codex-mobile-runtime-self-check-loop\.js/);
  assert.match(doc, /visual:central-compatible/);
  assert.match(doc, /blocked_missing_repro_harness/);
});
