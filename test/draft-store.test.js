"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");

const draftStoreModule = require(path.resolve(__dirname, "..", "public", "draft-store.js"));

function memoryStorage() {
  const data = new Map();
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

test("draft store creates stable thread and workspace keys", () => {
  const store = draftStoreModule.createDraftStore({ storage: memoryStorage() });

  assert.equal(store.keyForThread(" abc "), "thread:abc");
  assert.equal(store.keyForThread(" "), "");
  assert.equal(store.keyForNewThread("C:/Users/xuefu/project/"), "new:c:\\users\\xuefu\\project");
});

test("draft store writes newest drafts first and caps retained entries", () => {
  const storage = memoryStorage();
  const store = draftStoreModule.createDraftStore({ storage, maxDrafts: 2 });

  store.writeMap({
    old: { text: "old", updatedAt: 1 },
    newest: { text: "newest", updatedAt: 3 },
    middle: { text: "middle", updatedAt: 2 },
    bad: null,
  });

  assert.deepEqual(Object.keys(store.readMap()), ["newest", "middle"]);
});

test("draft store detects text, attachment, and runtime-only drafts", () => {
  assert.equal(draftStoreModule.draftHasContent({ text: "   " }), false);
  assert.equal(draftStoreModule.draftHasContent({ text: "hello" }), true);
  assert.equal(draftStoreModule.draftHasContent({ attachments: [{ id: "a" }] }), true);
  assert.equal(draftStoreModule.draftHasContent({ model: "gpt-5.5" }), true);
  assert.equal(draftStoreModule.draftHasContent({ permissionMode: "full" }), true);
});

test("draft store normalizes attachment metadata and encoded storage keys", () => {
  const file = {
    name: "screenshot.png",
    type: "image/png",
    size: 42,
    lastModified: 123,
  };

  assert.deepEqual(draftStoreModule.normalizeAttachmentMeta({ id: 7, file }), {
    id: "7",
    name: "screenshot.png",
    type: "image/png",
    size: 42,
    lastModified: 123,
  });
  assert.equal(draftStoreModule.attachmentStorageKey("new:/a b", "x/y"), "new%3A%2Fa%20b|x%2Fy");
});

test("draft store keeps resumable new-thread target in browser storage", () => {
  const storage = memoryStorage();
  const store = draftStoreModule.createDraftStore({ storage });

  store.setTargetKey("new:/repo");
  assert.equal(store.getTargetKey(), "new:/repo");
  store.clearTargetKeyIfMatches("thread:other");
  assert.equal(store.getTargetKey(), "new:/repo");
  store.clearTargetKeyIfMatches("new:/repo");
  assert.equal(store.getTargetKey(), "");
});
