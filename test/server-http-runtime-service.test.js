"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { PassThrough } = require("node:stream");
const { test } = require("node:test");

const { createServerHttpRuntimeService } = require("../services/runtime/server-http-runtime-service");

function requestFromChunks(chunks) {
  const req = new PassThrough();
  process.nextTick(() => {
    for (const chunk of chunks) req.write(Buffer.from(chunk));
    req.end();
  });
  return req;
}

test("server http runtime reads JSON request bodies", async () => {
  const service = createServerHttpRuntimeService({ maxJsonBodyBytes: 64 });

  assert.deepEqual(await service.readBody(requestFromChunks(['{"ok":true}'])), { ok: true });
  assert.deepEqual(await service.readBody(requestFromChunks(["  \n "])), {});
});

test("server http runtime rejects invalid or oversized JSON bodies", async () => {
  const invalidService = createServerHttpRuntimeService({ maxJsonBodyBytes: 64 });
  const oversizedService = createServerHttpRuntimeService({ maxJsonBodyBytes: 4 });

  await assert.rejects(
    invalidService.readBody(requestFromChunks(["not-json"])),
    /invalid JSON body/,
  );
  await assert.rejects(
    oversizedService.readBody(requestFromChunks(['{"too":"large"}'])),
    /request body too large/,
  );
});

test("server http runtime reads bounded raw bodies", async () => {
  const service = createServerHttpRuntimeService();

  const raw = await service.readRawBody(requestFromChunks(["ab", "cd"]), 4);
  assert.equal(raw.toString("utf8"), "abcd");

  await assert.rejects(
    service.readRawBody(requestFromChunks(["ab", "cd"]), 3),
    /request body too large/,
  );
});

test("server http runtime writes high-volume client events to bounded runtime log", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-http-runtime-"));
  const logPath = path.join(dir, "mobile-web.log");
  const service = createServerHttpRuntimeService({
    mobileWebLogFile: logPath,
    mobileWebLogMaxBytes: 1024,
    mobileWebLogKeepBytes: 512,
    maxStructuredChars: 160,
  });
  const originalLog = console.log;
  const stdoutLines = [];
  console.log = (...args) => stdoutLines.push(args.join(" "));
  try {
    service.logClientEvent("thread_refresh_ms", {
      threadId: "private-thread",
      path: "/private/path",
      details: {
        clientTimings: {
          refreshRenderAction: "full-render",
          largePayload: "x".repeat(2000),
        },
      },
    });
  } finally {
    console.log = originalLog;
  }

  const text = fs.readFileSync(logPath, "utf8");
  assert.match(text, /^\[client-event\] thread_refresh_ms /);
  assert.match(text, /structured payload truncated/);
  assert.equal(stdoutLines.length, 0);
  assert.ok(text.length < 1200);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("server http runtime routes high-frequency server events to bounded runtime log", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-http-runtime-"));
  const logPath = path.join(dir, "mobile-web.log");
  const service = createServerHttpRuntimeService({
    mobileWebLogFile: logPath,
    mobileWebLogMaxBytes: 2048,
    mobileWebLogKeepBytes: 1024,
    maxStructuredChars: 160,
  });
  const originalLog = console.log;
  const stdoutLines = [];
  console.log = (...args) => stdoutLines.push(args.join(" "));
  try {
    service.logThreadDetail("complete", { threadId: "t1", payload: { body: "x".repeat(2000) } });
    service.logThreadList("complete", { threadCount: 12 });
    service.logContinuation("heartbeat", { cardId: "ttc_test" });
    service.logMessageSubmit("active-turn-stale", { threadId: "t1" });
  } finally {
    console.log = originalLog;
  }

  const text = fs.readFileSync(logPath, "utf8");
  assert.match(text, /^\[thread-detail\] complete /m);
  assert.match(text, /^\[thread-list\] complete /m);
  assert.match(text, /^\[continuation\] heartbeat /m);
  assert.match(text, /^\[message-submit\] active-turn-stale /m);
  assert.match(text, /structured payload truncated/);
  assert.equal(stdoutLines.length, 0);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("server http runtime rate-limits repeated diagnostic log events", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-http-runtime-"));
  const logPath = path.join(dir, "mobile-web.log");
  let now = 1_000;
  const service = createServerHttpRuntimeService({
    mobileWebLogFile: logPath,
    mobileWebLogMaxBytes: 2048,
    mobileWebLogKeepBytes: 1024,
    mobileWebLogEventMinIntervalMs: 5_000,
    nowMs: () => now,
  });

  service.logThreadDetail("complete", { seq: 1 });
  service.logThreadDetail("complete", { seq: 2 });
  service.logThreadDetail("complete", { seq: 3 });
  let text = fs.readFileSync(logPath, "utf8");
  assert.equal((text.match(/^\[thread-detail\] complete /gm) || []).length, 1);
  assert.match(text, /"seq":1/);
  assert.doesNotMatch(text, /"seq":2/);

  now += 5_001;
  service.logThreadDetail("complete", { seq: 4 });
  text = fs.readFileSync(logPath, "utf8");
  assert.equal((text.match(/^\[thread-detail\] complete /gm) || []).length, 2);
  assert.match(text, /"seq":4/);
  assert.match(text, /"suppressedCount":2/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("server http runtime does not rate-limit frontend diagnostic log samples", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-http-runtime-"));
  const logPath = path.join(dir, "mobile-web.log");
  const service = createServerHttpRuntimeService({
    mobileWebLogFile: logPath,
    mobileWebLogMaxBytes: 4096,
    mobileWebLogKeepBytes: 2048,
    mobileWebLogEventMinIntervalMs: 30_000,
    nowMs: () => 1_000,
  });

  service.logClientEvent("frontend_diagnostic_log", { details: { seq: 1, stage: "local-insert" } });
  service.logClientEvent("frontend_diagnostic_log", { details: { seq: 2, stage: "post-response" } });
  service.logClientEvent("frontend_diagnostic_log", { details: { seq: 3, stage: "dom-probe" } });

  const text = fs.readFileSync(logPath, "utf8");
  assert.equal((text.match(/^\[client-event\] frontend_diagnostic_log /gm) || []).length, 3);
  assert.match(text, /"seq":1/);
  assert.match(text, /"seq":2/);
  assert.match(text, /"seq":3/);
  assert.doesNotMatch(text, /"suppressedCount"/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("server http runtime suppresses stdout fallback for high-frequency diagnostic events", () => {
  const service = createServerHttpRuntimeService({
    mobileWebLogFile: "",
    mobileWebLogEventMinIntervalMs: 0,
  });
  const originalLog = console.log;
  const stdoutLines = [];
  console.log = (...args) => stdoutLines.push(args.join(" "));
  try {
    service.logThreadDetail("complete", { threadId: "t1" });
    service.logThreadList("complete", { resultCount: 1 });
    service.logClientEvent("thread_refresh_ms", { threadId: "t1" });
  } finally {
    console.log = originalLog;
  }

  assert.equal(stdoutLines.length, 0);
});
