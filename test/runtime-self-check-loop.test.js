"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const runtimeLoop = require("../scripts/codex-mobile-runtime-self-check-loop");

function fakeProcessPressureDeps() {
  const psText = [
    "33840 1 xuxin 1.5 204800 00:10:00 Ss /runtime/node server.js",
    "26623 26622 xuxin 2.5 409600 00:10:00 S /Users/xuxin/.local/bin/codex app-server --analytics-default-enabled",
  ].join("\n");
  const lsofText = [
    "COMMAND   PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME",
    "node    33840 xuxin  20u  IPv4 0x1      0t0  TCP 127.0.0.1:8787 (LISTEN)",
  ].join("\n");
  return {
    execFileSync(command, args) {
      if (command === "ps") return psText;
      if (command === "lsof" && args.includes("-iTCP")) return lsofText;
      if (command === "lsof" && args.includes("-p")) {
        const pid = args[args.indexOf("-p") + 1];
        if (pid === "33840") return "p33840\nfcwd\nn/Users/hermes-host/HermesMobile/plugins/codex-mobile-web\n";
        if (pid === "26623") return "p26623\nfcwd\nn/Users/hermes-host/HermesMobile/plugins/codex-mobile-web\n";
      }
      return "";
    },
    readFileSync() {
      return JSON.stringify({ pid: 26622, host: "127.0.0.1", port: 54498, protocol: "jsonl-tcp" });
    },
  };
}

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
    "--browser-startup-only",
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
    "--client-event-window-ms",
    "120000",
    "--gate-mode",
    "deploy",
  ]);
  assert.equal(loop.loop, true);
  assert.equal(loop.intervalMs, 600000);
  assert.equal(loop.iterations, 2);
  assert.equal(loop.browserRounds, 7);
  assert.equal(loop.browserSampleDelaysMs, "100,500,1500");
  assert.equal(loop.browserMinSettledDelayMs, 1500);
  assert.equal(loop.browserStartupOnly, true);
  assert.equal(loop.browserExerciseSubmit, true);
  assert.equal(loop.browserSubmitThreadId, "submit-thread");
  assert.equal(loop.browserSubmitMessage, "Reply OK only");
  assert.equal(loop.browserSubmitSampleDelaysMs, "100,600,1600");
  assert.equal(loop.skipClientEvents, true);
  assert.equal(loop.clientEventLog, "/tmp/client-events.log");
  assert.equal(loop.clientEventTailBytes, 4096);
  assert.equal(loop.clientEventMaxLines, 50);
  assert.equal(loop.clientEventWindowMs, 120000);
  assert.equal(loop.gateMode, "deploy");
  assert.equal(loop.browserMode, "full");
  assert.equal(loop.skipBrowser, false);

  const periodic = runtimeLoop.parseArgs(["--loop"]);
  assert.equal(periodic.gateMode, "periodic");
  assert.equal(periodic.browserMode, "off");
  assert.equal(periodic.skipBrowser, false);

  const forcedPeriodicBrowser = runtimeLoop.parseArgs(["--loop", "--browser-mode", "full"]);
  assert.equal(forcedPeriodicBrowser.browserMode, "full");
  assert.equal(forcedPeriodicBrowser.skipBrowser, false);
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
    gateMode: "deploy",
  }, {
    ...fakeProcessPressureDeps(),
    execFile(_node, args, _options, callback) {
      const script = String(args[0] || "");
      const isBrowser = script.includes("browser-runtime");
      const isVitePreview = args.includes("--vite-preview-only");
      const isViteAppPreviewRoot = args.includes("--vite-app-preview-root");
      const isViteAppPreviewEmbed = args.includes("--vite-app-preview-embed");
      const isViteAppPreviewSession = args.includes("--vite-app-preview-launch-session");
      const isViteAppPreviewOnly = args.includes("--vite-app-preview-only") && !isViteAppPreviewRoot && !isViteAppPreviewEmbed && !isViteAppPreviewSession;
      const isViteAppPreviewRuntime = args.includes("--vite-app-preview-runtime");
      if (isBrowser && !isVitePreview && !isViteAppPreviewOnly && !isViteAppPreviewRuntime && !isViteAppPreviewRoot && !isViteAppPreviewEmbed && !isViteAppPreviewSession) {
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
      if (isVitePreview) {
        assert.deepEqual(args, [
          String(args[0]),
          "--server",
          "http://127.0.0.1:8790",
          "--json",
          "--vite-preview-only",
        ]);
      }
      if (isViteAppPreviewRuntime) {
        assert.ok(args.includes("--thread-id"));
        assert.equal(args[args.indexOf("--thread-id") + 1], "private-thread-id");
        assert.ok(args.includes("--sample-threads"));
        assert.equal(args[args.indexOf("--sample-threads") + 1], "1");
        assert.ok(args.includes("--rounds"));
        assert.equal(args[args.indexOf("--rounds") + 1], "6");
        assert.ok(args.includes("--sample-delays-ms"));
        assert.equal(args[args.indexOf("--sample-delays-ms") + 1], "100,350,1200,2800,6000");
        assert.ok(args.includes("--min-settled-delay-ms"));
        assert.equal(args[args.indexOf("--min-settled-delay-ms") + 1], "1200");
        assert.doesNotMatch(args.join(" "), /--exercise-submit|--submit-thread-id|--submit-message|--submit-sample-delays-ms/);
      }
      if (isViteAppPreviewRoot && isViteAppPreviewRuntime) {
        assert.ok(args.includes("--vite-app-preview-root"));
        assert.ok(args.includes("--vite-app-preview-runtime"));
        assert.doesNotMatch(args.join(" "), /--vite-app-preview-only/);
      } else if (isViteAppPreviewRoot) {
        assert.deepEqual(args, [
          String(args[0]),
          "--server",
          "http://127.0.0.1:8790",
          "--json",
          "--vite-app-preview-only",
          "--vite-app-preview-root",
        ]);
      }
      if (isViteAppPreviewEmbed) {
        assert.deepEqual(args, [
          String(args[0]),
          "--server",
          "http://127.0.0.1:8790",
          "--json",
          "--vite-app-preview-only",
          "--vite-app-preview-embed",
        ]);
      }
      if (isViteAppPreviewSession) {
        assert.deepEqual(args, [
          String(args[0]),
          "--server",
          "http://127.0.0.1:8790",
          "--json",
          "--vite-app-preview-only",
          "--vite-app-preview-launch-session",
        ]);
      }
      const payload = isBrowser
        ? {
            ok: true,
            mode: isVitePreview
              ? "vite-preview"
              : isViteAppPreviewRoot && isViteAppPreviewRuntime
                ? "vite-app-preview-root-runtime"
              : isViteAppPreviewRoot
                ? "vite-app-preview-root"
              : isViteAppPreviewEmbed
                ? "vite-app-preview-embed"
                : isViteAppPreviewSession
                  ? "vite-app-preview-launch-session"
                : isViteAppPreviewOnly ? "vite-app-preview" : isViteAppPreviewRuntime ? "vite-app-preview-runtime" : "full",
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
  assert.match(line, /"browserMode":"full"/);
  assert.match(line, /"scheduler":"runtime-job-scheduler-service"/);
  assert.match(line, /"runtimeJobs":/);
  assert.match(line, /"processPressure":/);
  assert.match(line, /"productionServerCount":1/);
  assert.match(line, /"name":"browser-runtime","enabled":true/);
  assert.match(line, /"name":"browser-vite-preview","enabled":true/);
  assert.match(line, /"name":"browser-vite-app-preview","enabled":true/);
  assert.match(line, /"name":"browser-vite-app-preview-root","enabled":true/);
  assert.match(line, /"name":"browser-vite-app-preview-embed","enabled":true/);
  assert.match(line, /"name":"browser-vite-app-preview-session","enabled":true/);
  assert.match(line, /"gate":/);
  assert.match(line, /"deployPass":true/);
  assert.doesNotMatch(line, /private-thread-id|raw prompt|cookie|token|Authorization/i);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("runtime self-check browser job can run startup-only without submit exercise", async () => {
  const calls = [];
  const result = await runtimeLoop.runOnce({
    server: "http://127.0.0.1:8790",
    threadIds: [],
    sampleThreads: 1,
    browserRounds: 6,
    browserSampleDelaysMs: "100,350,1200",
    browserMinSettledDelayMs: 1200,
    browserStartupOnly: true,
    browserExerciseSubmit: true,
    browserSubmitThreadId: "private-submit-thread-id",
    browserSubmitMessage: "Reply OK only",
    browserSubmitSampleDelaysMs: "100,900,1600",
    skipClientEvents: true,
    skipApi: true,
    skipBrowser: false,
    output: "",
    gateMode: "deploy",
  }, {
    ...fakeProcessPressureDeps(),
    execFile(_node, args, _options, callback) {
      const script = String(args[0] || "");
      assert.match(script, /browser-runtime/);
      calls.push(args.slice());
      const isVitePreview = args.includes("--vite-preview-only");
      const isViteAppPreviewRoot = args.includes("--vite-app-preview-root");
      const isViteAppPreviewEmbed = args.includes("--vite-app-preview-embed");
      const isViteAppPreviewSession = args.includes("--vite-app-preview-launch-session");
      const isViteAppPreview = args.includes("--vite-app-preview-only") && !isViteAppPreviewRoot && !isViteAppPreviewEmbed && !isViteAppPreviewSession;
      if (isVitePreview || isViteAppPreview || isViteAppPreviewRoot || isViteAppPreviewEmbed || isViteAppPreviewSession) {
        assert.doesNotMatch(args.join(" "), /--startup-only|--exercise-submit|--submit-thread-id|--submit-message/);
      } else {
        assert.ok(args.includes("--startup-only"));
      }
      if (isViteAppPreviewRoot) {
        assert.deepEqual(args, [
          String(args[0]),
          "--server",
          "http://127.0.0.1:8790",
          "--json",
          "--vite-app-preview-only",
          "--vite-app-preview-root",
        ]);
      }
      if (isViteAppPreviewEmbed) {
        assert.deepEqual(args, [
          String(args[0]),
          "--server",
          "http://127.0.0.1:8790",
          "--json",
          "--vite-app-preview-only",
          "--vite-app-preview-embed",
        ]);
      }
      if (isViteAppPreviewSession) {
        assert.deepEqual(args, [
          String(args[0]),
          "--server",
          "http://127.0.0.1:8790",
          "--json",
          "--vite-app-preview-only",
          "--vite-app-preview-launch-session",
        ]);
      }
      assert.doesNotMatch(args.join(" "), /--exercise-submit|--submit-thread-id|--submit-message/);
      callback(null, JSON.stringify({
        ok: true,
        mode: isVitePreview
          ? "vite-preview"
          : isViteAppPreviewRoot
            ? "vite-app-preview-root"
          : isViteAppPreviewEmbed
            ? "vite-app-preview-embed"
            : isViteAppPreviewSession
              ? "vite-app-preview-launch-session"
            : isViteAppPreview ? "vite-app-preview" : "startup-only",
        publicConfig: { clientBuildId: "build", shellCacheName: "shell" },
        browserReport: { issueCount: 0, blockingIssueCount: 0 },
      }), "");
    },
  });

  assert.equal(result.ok, true);
  assert.equal(calls.length, 6);
  const browserCheck = result.checks.find((check) => check.name === "browser-runtime");
  assert.equal(browserCheck.ok, true);
  const vitePreviewCheck = result.checks.find((check) => check.name === "browser-vite-preview");
  assert.equal(vitePreviewCheck.ok, true);
  const viteAppPreviewCheck = result.checks.find((check) => check.name === "browser-vite-app-preview");
  assert.equal(viteAppPreviewCheck.ok, true);
  const viteAppPreviewRootCheck = result.checks.find((check) => check.name === "browser-vite-app-preview-root");
  assert.equal(viteAppPreviewRootCheck.ok, true);
  const viteAppPreviewEmbedCheck = result.checks.find((check) => check.name === "browser-vite-app-preview-embed");
  assert.equal(viteAppPreviewEmbedCheck.ok, true);
  const viteAppPreviewSessionCheck = result.checks.find((check) => check.name === "browser-vite-app-preview-session");
  assert.equal(viteAppPreviewSessionCheck.ok, true);
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

test("runtime self-check loop treats parsed child JSON as contract result", async () => {
  let childOptions = null;
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
    execFile(_node, _args, options, callback) {
      childOptions = options;
      const error = new Error("Command failed: private command");
      callback(error, JSON.stringify({
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
      }), "private stderr");
    },
  });

  assert.equal(result.ok, false);
  assert.equal(childOptions.timeout, 300000);
  assert.equal(result.gate.executionFailureCount, 0);
  assert.deepEqual(result.gate.actionableIssueCodes, ["browser_pending_user_message_disappeared"]);
  const browserCheck = result.checks.find((check) => check.name === "browser-runtime");
  assert.equal(browserCheck.errorCode, "");
});

test("runtime self-check loop keeps empty child output as execution failure", async () => {
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
      callback(new Error("Command failed: private command"), "", "private stderr");
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.gate.executionFailureCount, 6);
  assert.equal(result.gate.deployPass, false);
  assert.match(result.gate.actionableIssueCodes[0], /^Command_failed:/);
  const browserCheck = result.checks.find((check) => check.name === "browser-runtime");
  assert.match(browserCheck.errorCode, /^Command_failed:/);
});

test("runtime self-check loop records skipped periodic browser budget", async () => {
  const result = await runtimeLoop.runOnce({
    server: "http://127.0.0.1:8790",
    gateMode: "periodic",
    browserMode: "off",
    skipApi: true,
    skipBrowser: false,
    skipClientEvents: true,
    output: "",
  }, {
    execFile() {
      throw new Error("no child self-check should run");
    },
  });

  assert.deepEqual(result.checks, []);
  assert.deepEqual(result.runtimeJobs.map((job) => [job.name, job.enabled, job.reason]), [
    ["api-thread", false, "skip_flag"],
    ["browser-runtime", false, "browser_mode_off"],
    ["browser-vite-preview", false, "browser_mode_off"],
    ["browser-vite-app-preview", false, "browser_mode_off"],
    ["browser-vite-app-preview-root", false, "browser_mode_off"],
    ["browser-vite-app-preview-embed", false, "browser_mode_off"],
    ["browser-vite-app-preview-session", false, "browser_mode_off"],
    ["client-events", false, "skip_flag"],
  ]);
});

test("runtime self-check loop includes recent client-event stall summary", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-runtime-client-events-"));
  const clientEventLog = path.join(dir, "client-events.log");
  fs.writeFileSync(clientEventLog, [
    '[client-event] thread_list_runtime_stall {"ts":"2026-06-29T17:40:00.000Z","threadId":"private-thread","path":"/private","details":{"maxRafDelayMs":3200,"maxScrollApplyMs":7,"threadListCount":12},"userAgent":"private UA"}',
  ].join("\n"), "utf8");
  const realDateNow = Date.now;
  Date.now = () => Date.parse("2026-06-29T17:40:10.000Z");

  let result;
  try {
    result = await runtimeLoop.runOnce({
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
      clientEventWindowMs: 30 * 60 * 1000,
      output: "",
      gateMode: "deploy",
    });
  } finally {
    Date.now = realDateNow;
  }

  assert.equal(result.ok, false);
  assert.equal(result.gate.deployPass, false);
  assert.deepEqual(result.gate.actionableIssueCodes, ["browser_thread_list_interaction_blocked"]);
  const clientEventsCheck = result.checks.find((check) => check.name === "client-events");
  assert.equal(clientEventsCheck.blockingIssueCount, 1);
  assert.equal(clientEventsCheck.sampleSummary.maxRafDelayMs, 3200);
  assert.doesNotMatch(JSON.stringify(result), /private-thread|private UA|\/private/);
  fs.rmSync(dir, { recursive: true, force: true });
});
