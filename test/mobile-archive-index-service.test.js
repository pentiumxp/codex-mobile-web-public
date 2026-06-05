"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  createMobileArchiveIndexService,
  normalizeArchiveStore,
  normalizeThreadId,
} = require("../adapters/mobile-archive-index-service");

test("mobile archive index normalizes thread ids from legacy store shapes", () => {
  const id = "019E799B-44C6-7F20-AD9D-5FCC9B1813AA";
  assert.equal(normalizeThreadId(id), id.toLowerCase());
  assert.equal(normalizeThreadId("not-a-thread"), "");

  const store = normalizeArchiveStore({
    threadIds: [id, "bad"],
    archivedThreads: {
      "019e7c24-0728-7832-9284-508ab25eb1d5": "2026-06-05T02:00:00.000Z",
    },
    items: [{
      threadId: "019e88be-fbda-77c0-b07b-701c2433ba50",
      archivedAt: "2026-06-05T02:01:00.000Z",
    }],
  });

  assert.deepEqual(store.archivedThreadIds.map((entry) => entry.id), [
    "019e799b-44c6-7f20-ad9d-5fcc9b1813aa",
    "019e88be-fbda-77c0-b07b-701c2433ba50",
    "019e7c24-0728-7832-9284-508ab25eb1d5",
  ]);
});

test("mobile archive index persists archived ids without message content", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-archive-index-"));
  const storageFile = path.join(tempDir, "archived-thread-ids.json");
  const service = createMobileArchiveIndexService({
    storageFile,
    now: () => new Date("2026-06-05T02:05:00.000Z"),
  });
  const id = "019e799b-44c6-7f20-ad9d-5fcc9b1813aa";

  assert.equal(service.has(id), false);
  assert.equal(service.remember(id), true);
  assert.equal(service.has(id), true);

  const raw = JSON.parse(fs.readFileSync(storageFile, "utf8"));
  assert.deepEqual(raw, {
    version: 1,
    archivedThreadIds: [{
      id,
      archivedAt: "2026-06-05T02:05:00.000Z",
    }],
  });
  assert.equal(JSON.stringify(raw).includes("rollout"), false);
  assert.equal(JSON.stringify(raw).includes("message"), false);
});
