"use strict";

const assert = require("node:assert/strict");
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
