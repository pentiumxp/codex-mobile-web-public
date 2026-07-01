"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { readFrontendSources } = require("./frontend-source-helper");

const imageCompressor = require("../public/image-compressor.js");
const appJs = readFrontendSources(path.resolve(__dirname, ".."));
const composerRuntimeJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "composer-runtime.js"), "utf8");

function sourceFunctionBody(source, name) {
  let start = source.indexOf(`function ${name}(`);
  if (start < 0) start = source.indexOf(`async function ${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const bodyStart = source.indexOf(") {", start) + 2;
  assert.notEqual(bodyStart, 1, `missing function body ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(bodyStart + 1, index);
  }
  throw new Error(`could not parse function ${name}`);
}

function functionBody(name) {
  return sourceFunctionBody(appJs, name);
}

function composerRuntimeBody(name) {
  return sourceFunctionBody(composerRuntimeJs, name);
}

test("image compressor targets large browser-supported image uploads", () => {
  assert.equal(imageCompressor.isCompressibleImageFile({ type: "image/png", size: 300 * 1024 }), true);
  assert.equal(imageCompressor.isCompressibleImageFile({ type: "image/jpeg", size: 300 * 1024 }), true);
  assert.equal(imageCompressor.isCompressibleImageFile({ type: "image/gif", size: 300 * 1024 }), false);
  assert.equal(imageCompressor.isCompressibleImageFile({ type: "image/png", size: 12 * 1024 }), false);
});

test("image compressor bounds dimensions and keeps only useful compressed blobs", () => {
  assert.deepEqual(imageCompressor.targetDimensions(3000, 1500, 1200), {
    width: 1200,
    height: 600,
    scaled: true,
  });
  assert.deepEqual(imageCompressor.targetDimensions(800, 600, 1200), {
    width: 800,
    height: 600,
    scaled: false,
  });
  assert.equal(imageCompressor.compressedImageName("screen.png"), "screen.jpg");
  assert.equal(imageCompressor.shouldUseCompressedBlob({ size: 1000 }, { size: 930 }), false);
  assert.equal(imageCompressor.shouldUseCompressedBlob({ size: 1000 }, { size: 800 }), true);
});

test("composer compresses attachments before size checks and draft persistence", () => {
  assert.match(appJs, /(?:const|var) imageCompressor = window\.CodexImageCompressor/);
  assert.match(composerRuntimeJs, /async function prepareAttachmentFile\(file\)/);
  assert.match(composerRuntimeJs, /await imageCompressor\.compressImageFile\(file\)/);
  const addBody = composerRuntimeBody("addAttachmentFiles");
  assert.match(addBody, /preparedFiles = await prepareAttachmentFiles\(files\)/);
  assert.match(addBody, /for \(const file of preparedFiles\)/);
  assert.match(addBody, /state\.attachmentProcessingCount \+= 1/);
});
