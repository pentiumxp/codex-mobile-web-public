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

  const loop = runtimeLoop.parseArgs(["--loop", "--interval-ms", "600000", "--iterations", "2"]);
  assert.equal(loop.loop, true);
  assert.equal(loop.intervalMs, 600000);
  assert.equal(loop.iterations, 2);
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
    skipApi: false,
    skipBrowser: false,
    output,
  }, {
    execFile(_node, args, _options, callback) {
      const script = String(args[0] || "");
      const isBrowser = script.includes("browser-runtime");
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
  assert.doesNotMatch(line, /private-thread-id|raw prompt|cookie|token|Authorization/i);
  fs.rmSync(dir, { recursive: true, force: true });
});
