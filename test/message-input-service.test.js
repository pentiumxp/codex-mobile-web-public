"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const {
  hasImageUploads,
  parsePersistExtendedHistoryEnv,
  shouldPersistExtendedHistoryForUploads,
} = require("../adapters/message-input-service");

const serverJs = fs.readFileSync(path.resolve(__dirname, "..", "server.js"), "utf8");

test("image uploads disable extended-history persistence by default", () => {
  assert.equal(hasImageUploads([{ isImage: false }, { isImage: true }]), true);
  assert.equal(shouldPersistExtendedHistoryForUploads([{ isImage: false }]), true);
  assert.equal(shouldPersistExtendedHistoryForUploads([{ isImage: true }]), false);
  assert.equal(shouldPersistExtendedHistoryForUploads([{ isImage: true }], { persistImageUploads: true }), true);
  assert.equal(shouldPersistExtendedHistoryForUploads([{ isImage: false }], { defaultPersist: false }), false);
});

test("extended-history persistence policy is environment controlled", () => {
  assert.deepEqual(parsePersistExtendedHistoryEnv({}), {
    defaultPersist: true,
    persistImageUploads: false,
  });
  assert.deepEqual(parsePersistExtendedHistoryEnv({
    CODEX_MOBILE_PERSIST_EXTENDED_HISTORY: "0",
    CODEX_MOBILE_PERSIST_IMAGE_EXTENDED_HISTORY: "1",
  }), {
    defaultPersist: false,
    persistImageUploads: true,
  });
});

test("message routes use upload-aware extended-history persistence", () => {
  assert.match(serverJs, /const PERSIST_EXTENDED_HISTORY_POLICY = parsePersistExtendedHistoryEnv\(process\.env\);/);
  assert.match(serverJs, /function persistExtendedHistoryForUploads\(uploads\)/);
  assert.match(serverJs, /const persistExtendedHistory = persistExtendedHistoryForUploads\(uploads\);/);
  assert.match(serverJs, /persistExtendedHistory,/);
});
