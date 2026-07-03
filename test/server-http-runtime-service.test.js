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
