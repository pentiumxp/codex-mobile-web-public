"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const service = require("../adapters/runtime-self-check-launchagent-service");
const readback = require("../scripts/codex-mobile-runtime-self-check-launchagent-readback");

const SCRIPT_PATH = "/prod/scripts/codex-mobile-runtime-self-check-loop.js";
const OUTPUT_PATH = "/home/logs/runtime-self-check.jsonl";

function healthyPlist() {
  return service.summarizeLaunchAgentPlist({
    Label: service.DEFAULT_LABEL,
    ProgramArguments: [
      "/node",
      SCRIPT_PATH,
      "--server",
      "http://127.0.0.1:8787",
      "--output",
      OUTPUT_PATH,
      "--json",
    ],
    StartInterval: 600,
    RunAtLoad: true,
    WorkingDirectory: "/prod",
  }, {
    label: service.DEFAULT_LABEL,
    scriptPath: SCRIPT_PATH,
    outputPath: OUTPUT_PATH,
    server: "http://127.0.0.1:8787",
    intervalSeconds: 600,
  });
}

function healthyEvent() {
  return service.summarizeLatestEvent({
    ok: true,
    completedAt: "2026-06-29T09:39:21.000Z",
    gate: {
      mode: "periodic",
      deployPass: true,
      periodicHealthy: true,
      issueCount: 0,
      blockingIssueCount: 0,
      reportableIssueCount: 0,
      observeOnlyIssueCount: 0,
      advisoryIssueCount: 0,
      executionFailureCount: 0,
      checkNames: ["api-thread", "browser-runtime"],
    },
    checks: [{ name: "api-thread" }, { name: "browser-runtime" }],
  }, Date.parse("2026-06-29T09:40:00.000Z"));
}

test("runtime self-check launchagent readback accepts healthy periodic gate", () => {
  const result = service.classifyRuntimeSelfCheckLaunchAgent({
    expected: { maxEventAgeMs: 20 * 60 * 1000 },
    plist: healthyPlist(),
    launchctl: service.parseLaunchctlPrint(`
      state = not running
      type = LaunchAgent
      runs = 81
      last exit code = 0
      run interval = 600 seconds
    `),
    latestEvent: healthyEvent(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.issueCount, 0);
});

test("runtime self-check launchagent readback fails old latest events without gate", () => {
  const latestEvent = service.summarizeLatestEvent({
    ok: true,
    completedAt: "2026-06-29T09:39:21.000Z",
    checks: [{ name: "api-thread" }],
  }, Date.parse("2026-06-29T09:40:00.000Z"));
  const result = service.classifyRuntimeSelfCheckLaunchAgent({
    plist: healthyPlist(),
    launchctl: service.parseLaunchctlPrint("state = not running\nlast exit code = 0\n"),
    latestEvent,
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.issues.map((issue) => issue.code), ["runtime_self_check_latest_event_no_gate"]);
});

test("runtime self-check launchagent readback treats running after previous failure as advisory", () => {
  const result = service.classifyRuntimeSelfCheckLaunchAgent({
    plist: healthyPlist(),
    launchctl: service.parseLaunchctlPrint(`
      state = running
      runs = 82
      last exit code = 1
      run interval = 600 seconds
    `),
    latestEvent: healthyEvent(),
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, [{ code: "launchagent_running_after_previous_failure", severity: "H3" }]);
});

test("runtime self-check launchagent readback accepts recovered previous nonzero exit", () => {
  const result = service.classifyRuntimeSelfCheckLaunchAgent({
    expected: { maxEventAgeMs: 20 * 60 * 1000 },
    plist: healthyPlist(),
    launchctl: service.parseLaunchctlPrint(`
      state = not running
      runs = 101
      last exit code = 1
      run interval = 600 seconds
    `),
    latestEvent: healthyEvent(),
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.issues, [{ code: "launchagent_previous_exit_nonzero_recovered", severity: "H3" }]);
});

test("runtime self-check launchagent readback blocks missing agent and stale log", () => {
  const latestEvent = service.summarizeLatestEvent({
    ok: true,
    completedAt: "2026-06-29T09:00:00.000Z",
    gate: { mode: "periodic", deployPass: true, periodicHealthy: true },
  }, Date.parse("2026-06-29T10:00:00.000Z"));
  const result = service.classifyRuntimeSelfCheckLaunchAgent({
    expected: { maxEventAgeMs: 20 * 60 * 1000 },
    plist: service.summarizeLaunchAgentPlist({}, {}),
    launchctl: service.parseLaunchctlPrint(""),
    latestEvent,
  });

  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.code === "launchagent_plist_missing"));
  assert.ok(result.issues.some((issue) => issue.code === "launchagent_not_loaded"));
  assert.ok(result.issues.some((issue) => issue.code === "runtime_self_check_latest_event_stale"));
});

test("runtime self-check launchagent readback parses latest valid JSONL line", () => {
  const event = service.parseLatestRuntimeSelfCheckEvent([
    "{bad",
    JSON.stringify({ ok: false, completedAt: "old" }),
    JSON.stringify({ ok: true, completedAt: "new", gate: { mode: "periodic" } }),
    "",
  ].join("\n"));

  assert.equal(event.ok, true);
  assert.equal(event.completedAt, "new");
});

test("runtime self-check launchagent CLI readback is metadata-only", () => {
  const result = readback.buildReadback({
    label: service.DEFAULT_LABEL,
    plistPath: "/ignored/plist",
    logPath: "/ignored/log",
    expectedOutputPath: OUTPUT_PATH,
    scriptPath: SCRIPT_PATH,
    server: "http://127.0.0.1:8787",
    intervalSeconds: 600,
    maxAgeMs: 20 * 60 * 1000,
    domain: "gui/501",
  }, {
    nowMs: Date.parse("2026-06-29T09:40:00.000Z"),
    existsSync() {
      return true;
    },
    readTailText() {
      return JSON.stringify({
        ok: true,
        completedAt: "2026-06-29T09:39:21.000Z",
        gate: {
          mode: "periodic",
          deployPass: true,
          periodicHealthy: true,
          issueCount: 0,
          blockingIssueCount: 0,
        },
        checks: [{ name: "api-thread", errorCode: "" }],
      });
    },
    execFileSync(command, args) {
      const joined = [command].concat(args).join(" ");
      if (joined.includes("plutil")) {
        return JSON.stringify({
          Label: service.DEFAULT_LABEL,
          ProgramArguments: ["/node", SCRIPT_PATH, "--server", "http://127.0.0.1:8787", "--output", OUTPUT_PATH, "--json"],
          StartInterval: 600,
          RunAtLoad: true,
          WorkingDirectory: "/private/path",
        });
      }
      if (joined.includes("launchctl")) {
        return "state = not running\nruns = 81\nlast exit code = 0\nrun interval = 600 seconds\n";
      }
      throw new Error("unexpected command");
    },
  });

  assert.equal(result.ok, true);
  assert.doesNotMatch(JSON.stringify(result), /private\/path|ignored|raw prompt|cookie|token/i);
});
