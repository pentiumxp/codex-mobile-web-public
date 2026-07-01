"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const {
  hasImageUploads,
  localImageUploadsForContext,
  normalizeImageContextMode,
  parseImageContextPolicyEnv,
  parsePersistExtendedHistoryEnv,
  shouldSendImageContentToModel,
  shouldPersistExtendedHistoryForUploads,
} = require("../adapters/message-input-service");

const serverJs = fs.readFileSync(path.resolve(__dirname, "..", "server.js"), "utf8");
const coreApiRouteServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "server-routes", "core-api-route-service.js"), "utf8");
const mediaFileServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "adapters", "media-file-service.js"), "utf8");
const threadMessageRouteServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "adapters", "thread-message-route-service.js"), "utf8");

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

test("image context defaults to path reference instead of model image content", () => {
  const uploads = [
    { isImage: true, path: "C:\\tmp\\first.png" },
    { isImage: false, path: "C:\\tmp\\notes.txt" },
    { isImage: true, path: "C:\\tmp\\second.png" },
  ];

  assert.equal(normalizeImageContextMode(""), "reference");
  assert.equal(normalizeImageContextMode("vision"), "latest");
  assert.equal(normalizeImageContextMode("all"), "all");
  assert.deepEqual(parseImageContextPolicyEnv({}), { imageContextMode: "reference" });
  assert.deepEqual(parseImageContextPolicyEnv({ CODEX_MOBILE_IMAGE_CONTEXT_MODE: "latest" }), { imageContextMode: "latest" });
  assert.equal(shouldSendImageContentToModel(uploads), false);
  assert.deepEqual(localImageUploadsForContext(uploads), []);
  assert.deepEqual(localImageUploadsForContext(uploads, { imageContextMode: "latest" }).map((file) => file.path), ["C:\\tmp\\second.png"]);
  assert.deepEqual(localImageUploadsForContext(uploads, { imageContextMode: "all" }).map((file) => file.path), ["C:\\tmp\\first.png", "C:\\tmp\\second.png"]);
});

test("message routes use upload-aware extended-history persistence", () => {
  assert.match(serverJs, /const mediaFileService = createMediaFileService\(/);
  assert.match(mediaFileServiceJs, /parsePersistExtendedHistoryEnv\(env\)/);
  assert.match(mediaFileServiceJs, /function persistExtendedHistoryForUploads\(uploads\)/);
  assert.match(threadMessageRouteServiceJs, /const persistExtendedHistory = persistExtendedHistoryForUploads\(uploads\);/);
  assert.match(threadMessageRouteServiceJs, /persistExtendedHistory,/);
});

test("message routes gate localImage input parts behind the image context policy", () => {
  assert.match(mediaFileServiceJs, /parseImageContextPolicyEnv\(env\)/);
  assert.match(coreApiRouteServiceJs, /\.\.\.mediaFileService\.publicConfig\(\)/);
  assert.match(mediaFileServiceJs, /for \(const file of localImageUploadsForContext\(uploads, imageContextPolicy\)\)/);
  assert.doesNotMatch(serverJs, /for \(const file of uploads\) \{\s*if \(file\.isImage\) input\.push\(\{ type: "localImage"/);
});
