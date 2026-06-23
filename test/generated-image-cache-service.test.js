"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { pathToFileURL } = require("node:url");

const {
  cacheGeneratedImageDataUrl,
  cacheGeneratedImageForItem,
  generatedImagePathForId,
  imageContentTypeForPath,
  imageViewSourcePath,
} = require("../adapters/generated-image-cache-service");

const imageTypes = new Map([
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
]);

test("image view source path is extracted from direct and nested item fields", () => {
  assert.equal(imageViewSourcePath({ type: "imageView", path: "C:\\tmp\\a.png" }), "C:\\tmp\\a.png");
  assert.equal(imageViewSourcePath({ type: "imageView", arguments: { imagePath: "C:\\tmp\\b.png" } }), "C:\\tmp\\b.png");
  assert.equal(imageViewSourcePath({ type: "imageView", result: { filePath: "C:\\tmp\\c.png" } }), "C:\\tmp\\c.png");
  assert.equal(imageViewSourcePath({ type: "imageGeneration", savedPath: "C:\\tmp\\generated.png" }), "C:\\tmp\\generated.png");
});

test("image view source path accepts local url fields but not browser routes", () => {
  const source = path.join(os.tmpdir(), "codex-mobile-image-url-source.png");
  assert.equal(imageViewSourcePath({ type: "imageView", url: source }), source);
  assert.equal(imageViewSourcePath({ type: "imageView", image_url: pathToFileURL(source).href }), source);
  assert.equal(imageViewSourcePath({ type: "imageView", url: "/api/generated-images/file?id=thread%2Fimage.png" }), "");
  assert.equal(imageViewSourcePath({ type: "imageView", url: "assistant-output.png" }), "");
});

test("generated image cache copies imageView screenshots into a runtime-safe cache", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-generated-source-"));
  const cacheRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-generated-cache-"));
  const source = path.join(tempRoot, "visual-check.png");
  fs.writeFileSync(source, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

  const cached = cacheGeneratedImageForItem(
    { type: "imageView", arguments: { path: source } },
    {
      cacheRoot,
      threadId: "019e64e8-f29a-7fc1-8679-fee7b16f88ad",
      maxBytes: 1024,
      contentTypes: imageTypes,
    },
  );

  assert.ok(cached.cacheId.includes("019e64e8-f29a-7fc1-8679-fee7b16f88ad/"));
  assert.equal(cached.fileName, "visual-check.png");
  assert.equal(cached.contentType, "image/png");
  assert.equal(fs.readFileSync(cached.cachedPath).length, 4);
  assert.equal(generatedImagePathForId(cacheRoot, cached.cacheId), cached.cachedPath);
});

test("generated image cache copies local image urls into a runtime-safe cache", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-generated-url-source-"));
  const cacheRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-generated-url-cache-"));
  const source = path.join(tempRoot, "assistant-output.png");
  fs.writeFileSync(source, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  try {
    const cached = cacheGeneratedImageForItem(
      { type: "imageView", image_url: source },
      {
        cacheRoot,
        threadId: "thread-url-image",
        maxBytes: 1024,
        contentTypes: imageTypes,
      },
    );

    assert.ok(cached.cacheId.includes("thread-url-image/"));
    assert.equal(cached.fileName, "assistant-output.png");
    assert.equal(cached.contentType, "image/png");
    assert.equal(fs.readFileSync(cached.cachedPath).length, 4);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    fs.rmSync(cacheRoot, { recursive: true, force: true });
  }
});

test("generated image cache stores safe bitmap data urls", () => {
  const cacheRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-generated-cache-"));
  try {
    const cached = cacheGeneratedImageDataUrl("data:image/png;base64,iVBORw0KGgo=", {
      cacheRoot,
      threadId: "019ea77e-4e36-7820-adf4-9bf0272965b8",
      maxBytes: 1024,
      contentTypes: imageTypes,
    });

    assert.ok(cached.cacheId.includes("019ea77e-4e36-7820-adf4-9bf0272965b8/"));
    assert.equal(cached.contentType, "image/png");
    assert.equal(path.extname(cached.cachedPath), ".png");
    assert.equal(fs.readFileSync(cached.cachedPath).toString("base64"), "iVBORw0KGgo=");
    assert.equal(generatedImagePathForId(cacheRoot, cached.cacheId), cached.cachedPath);
  } finally {
    fs.rmSync(cacheRoot, { recursive: true, force: true });
  }
});

test("generated image cache rejects non-image ids and path traversal", () => {
  assert.equal(imageContentTypeForPath("note.txt", imageTypes), "");
  assert.equal(cacheGeneratedImageDataUrl("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=", {
    cacheRoot: os.tmpdir(),
    threadId: "thread",
    maxBytes: 1024,
    contentTypes: imageTypes,
  }), null);
  assert.throws(() => generatedImagePathForId(os.tmpdir(), "../outside.png"), /Invalid generated image id/);
});
