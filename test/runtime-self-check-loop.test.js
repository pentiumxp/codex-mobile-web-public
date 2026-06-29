"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const runtimeLoop = require("../scripts/codex-mobile-runtime-self-check-loop");

test("runtime self-check loop parses one-shot and periodic options", () => {
  const once = runtimeLoop.parseArgs(["--server", "http://127.0.0.1:8790", "--thread-id", "t1", "--skip-browser"]);
  assert.equal(once.server, "http://127.0.0.1:8790");
  assert.deepEqual(once.threadIds, ["t1"]);
  assert.equal(once.loop, false);
  assert.equal(once.iterations, 1);
  assert.equal(once.skipBrowser, true);

  const loop = runtimeLoop.parseArgs([
    "--loop",
    "--interval-ms",
    "600000",
    "--iterations",
    "2",
    "--browser-rounds",
    "7",
    "--browser-sample-delays-ms",
    "100,500,1500",
    "--browser-min-settled-delay-ms",
    "1500",
    "--browser-exercise-submit",
    "--browser-submit-thread-id",
    "submit-thread",
    "--browser-submit-message",
    "Reply OK only",
    "--browser-submit-sample-delays-ms",
    "100,600,1600",
    "--skip-client-events",
    "--client-event-log",
    "/tmp/client-events.log",
    "--client-event-tail-bytes",
    "4096",
    "--client-event-max-lines",
    "50",
    "--gate-mode",
    "deploy",
  ]);
  assert.equal(loop.loop, true);
  assert.equal(loop.intervalMs, 600000);
  assert.equal(loop.iterations, 2);
  assert.equal(loop.browserRounds, 7);
  assert.equal(loop.browserSampleDelaysMs, "100,500,1500");
  assert.equal(loop.browserMinSettledDelayMs, 1500);
  assert.equal(loop.browserExerciseSubmit, true);
  assert.equal(loop.browserSubmitThreadId, "submit-thread");
  assert.equal(loop.browserSubmitMessage, "Reply OK only");
  assert.equal(loop.browserSubmitSampleDelaysMs, "100,600,1600");
  assert.equal(loop.skipClientEvents, true);
  assert.equal(loop.clientEventLog, "/tmp/client-events.log");
  assert.equal(loop.clientEventTailBytes, 4096);
  assert.equal(loop.clientEventMaxLines, 50);
  assert.equal(loop.gateMode, "deploy");
});

test("runtime self-check summary keeps only bounded metadata", () => {
  const summary = runtimeLoop.summarizeCheck("browser-runtime", {
    ok: true,
    report: {
      publicConfig: {
        clientBuildId: "0.1.11|codex-mobile-shell-v576",
        shellCacheName: "codex-mobile-shell-v576",
      },
      browserReport: {
        issueCount: 1,
        blockingIssueCount: 0,
      },
      privateBody: "raw prompt text",
    },
  });

  assert.deepEqual(summary, {
    name: "browser-runtime",
    ok: true,
    issueCount: 1,
    blockingIssueCount: 0,
    diagnosticCandidateCount: 0,
    clientBuildId: "0.1.11|codex-mobile-shell-v576",
    shellCacheName: "codex-mobile-shell-v576",
    errorCode: "",
    issues: [],
    diagnosticCandidates: [],
  });
  assert.doesNotMatch(JSON.stringify(summary), /raw prompt text|cookie|token|Authorization/i);
});

test("runtime self-check one-shot writes metadata-only JSONL", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-runtime-self-check-"));
  const output = path.join(dir, "self-check.jsonl");
  const result = await runtimeLoop.runOnce({
    server: "http://127.0.0.1:8790",
    threadIds: ["private-thread-id"],
    sampleThreads: 1,
    browserRounds: 6,
    browserSampleDelaysMs: "100,350,1200,2800,6000",
    browserMinSettledDelayMs: 1200,
    browserExerciseSubmit: true,
    browserSubmitThreadId: "private-submit-thread-id",
    browserSubmitMessage: "Reply OK only",
    browserSubmitSampleDelaysMs: "100,900,1600",
    skipClientEvents: true,
    skipApi: false,
    skipBrowser: false,
    output,
  }, {
    execFile(_node, args, _options, callback) {
      const script = String(args[0] || "");
      const isBrowser = script.includes("browser-runtime");
      if (isBrowser) {
        assert.ok(args.includes("--rounds"));
        assert.equal(args[args.indexOf("--rounds") + 1], "6");
        assert.ok(args.includes("--sample-delays-ms"));
        assert.equal(args[args.indexOf("--sample-delays-ms") + 1], "100,350,1200,2800,6000");
        assert.ok(args.includes("--min-settled-delay-ms"));
        assert.equal(args[args.indexOf("--min-settled-delay-ms") + 1], "1200");
        assert.ok(args.includes("--exercise-submit"));
        assert.ok(args.includes("--submit-thread-id"));
        assert.equal(args[args.indexOf("--submit-thread-id") + 1], "private-submit-thread-id");
        assert.ok(args.includes("--submit-message"));
        assert.equal(args[args.indexOf("--submit-message") + 1], "Reply OK only");
        assert.ok(args.includes("--submit-sample-delays-ms"));
        assert.equal(args[args.indexOf("--submit-sample-delays-ms") + 1], "100,900,1600");
      }
      const payload = isBrowser
        ? {
            ok: true,
            publicConfig: { clientBuildId: "build", shellCacheName: "shell" },
            browserReport: { issueCount: 0, blockingIssueCount: 0 },
          }
        : {
            ok: true,
            publicConfig: { clientBuildId: "build", shellCacheName: "shell" },
            summary: { issueCount: 0, blockingIssueCount: 0, diagnosticCandidateCount: 0 },
          };
      callback(null, JSON.stringify(payload), "");
    },
  });

  assert.equal(result.ok, true);
  const line = fs.readFileSync(output, "utf8").trim();
  assert.match(line, /"privacy":"metadata_only"/);
  assert.match(line, /"gate":/);
  assert.match(line, /"deployPass":true/);
  assert.doesNotMatch(line, /private-thread-id|raw prompt|cookie|token|Authorization/i);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("runtime self-check gate lets slow-path observations remain nonblocking", async () => {
  const result = await runtimeLoop.runOnce({
    server: "http://127.0.0.1:8790",
    threadIds: ["private-thread-id"],
    sampleThreads: 1,
    browserRounds: 1,
    browserSampleDelaysMs: "100",
    browserMinSettledDelayMs: 1000,
    skipClientEvents: true,
    skipApi: false,
    skipBrowser: true,
    output: "",
    gateMode: "deploy",
  }, {
    execFile(_node, _args, _options, callback) {
      callback(null, JSON.stringify({
        ok: false,
        publicConfig: { clientBuildId: "build", shellCacheName: "shell" },
        summary: {
          issueCount: 1,
          blockingIssueCount: 1,
          diagnosticCandidateCount: 1,
          diagnosticCandidates: [{
            category: "thread_session_slow_path",
            diagnostic_type: "thread_detail_slow_path",
            error_code: "thread_detail_slow_path",
            severity_hint: "H2",
          }],
          issues: [],
        },
      }), "");
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.gate.deployPass, true);
  assert.equal(result.gate.observeOnlyIssueCount, 1);
  assert.deepEqual(result.gate.observeOnlyIssueCodes, ["thread_detail_slow_path"]);
});

test("runtime self-check gate blocks actionable browser regressions", async () => {
  const result = await runtimeLoop.runOnce({
    server: "http://127.0.0.1:8790",
    threadIds: ["private-thread-id"],
    sampleThreads: 1,
    browserRounds: 1,
    browserSampleDelaysMs: "100",
    browserMinSettledDelayMs: 1000,
    skipClientEvents: true,
    skipApi: true,
    skipBrowser: false,
    output: "",
    gateMode: "deploy",
  }, {
    execFile(_node, _args, _options, callback) {
      callback(null, JSON.stringify({
        ok: false,
        publicConfig: { clientBuildId: "build", shellCacheName: "shell" },
        browserReport: {
          issueCount: 1,
          blockingIssueCount: 1,
          issues: [{
            severity: "H2",
            code: "browser_pending_user_message_disappeared",
          }],
        },
      }), "");
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.gate.deployPass, false);
  assert.deepEqual(result.gate.actionableIssueCodes, ["browser_pending_user_message_disappeared"]);
});

test("runtime self-check loop includes recent client-event stall summary", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-runtime-client-events-"));
  const clientEventLog = path.join(dir, "client-events.log");
  fs.writeFileSync(clientEventLog, [
    '[client-event] thread_list_runtime_stall {"threadId":"private-thread","path":"/private","details":{"maxRafDelayMs":3200,"maxScrollApplyMs":7,"threadListCount":12},"userAgent":"private UA"}',
  ].join("\n"), "utf8");

  const result = await runtimeLoop.runOnce({
    server: "http://127.0.0.1:8790",
    threadIds: [],
    sampleThreads: 1,
    browserRounds: 1,
    browserSampleDelaysMs: "100",
    browserMinSettledDelayMs: 1000,
    skipApi: true,
    skipBrowser: true,
    skipClientEvents: false,
    clientEventLog,
    clientEventTailBytes: 4096,
    clientEventMaxLines: 20,
    output: "",
    gateMode: "deploy",
  });

  assert.equal(result.ok, false);
  assert.equal(result.gate.deployPass, false);
  assert.deepEqual(result.gate.actionableIssueCodes, ["browser_thread_list_interaction_blocked"]);
  const clientEventsCheck = result.checks.find((check) => check.name === "client-events");
  assert.equal(clientEventsCheck.blockingIssueCount, 1);
  assert.equal(clientEventsCheck.sampleSummary.maxRafDelayMs, 3200);
  assert.doesNotMatch(JSON.stringify(result), /private-thread|private UA|\/private/);
  fs.rmSync(dir, { recursive: true, force: true });
});
