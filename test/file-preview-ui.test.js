"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const appJs = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const stylesCss = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");
const serverJs = fs.readFileSync(path.join(root, "server.js"), "utf8");

test("mobile file preview UI is wired from markdown link to preview API", () => {
  assert.match(indexHtml, /id="filePreviewDialog"/);
  assert.match(indexHtml, /id="filePreviewBody"/);
  assert.match(stylesCss, /\.local-file-preview-link/);
  assert.match(stylesCss, /\.file-preview-panel/);
  assert.match(stylesCss, /width: min\(980px, calc\(100vw - 36px\)\)/);
  assert.match(stylesCss, /\.file-preview-body \{[\s\S]*overflow-x: hidden;[\s\S]*overflow-y: auto;/);
  assert.match(stylesCss, /\.file-preview-image/);
  assert.match(stylesCss, /\.image-view/);
  assert.match(stylesCss, /\.file-preview-table/);
  assert.match(stylesCss, /\.file-preview-body \.markdown-code-block pre \{[\s\S]*white-space: pre-wrap;/);
  assert.match(stylesCss, /\.file-preview-body \.markdown-body,[\s\S]*\.file-preview-body \.markdown-table-wrap \{[\s\S]*min-width: 0;[\s\S]*max-width: 100%;/);
  assert.match(stylesCss, /\.local-file-preview-link \{[\s\S]*display: inline-block;[\s\S]*overflow-wrap: anywhere;[\s\S]*word-break: break-word;/);
  assert.doesNotMatch(stylesCss, /\.local-file-preview-link span/);
  assert.match(appJs, /data-local-file-path/);
  assert.match(appJs, /file && file\.kind === "markdown"\) return renderMarkdown\(content\)/);
  assert.match(appJs, /file && file\.kind === "image"/);
  assert.match(appJs, /file && file\.kind === "pdf"/);
  assert.match(appJs, /function renderImageView\(item\)/);
  assert.match(appJs, /if \(item\.type === "imageView"\) return renderImageView\(item\)/);
  assert.match(appJs, /imageView: "Image"/);
  assert.match(appJs, /function canRenderImageAttachment\(attachment\)/);
  assert.match(appJs, /imageAttachments[\s\S]*\.filter\(canRenderImageAttachment\)[\s\S]*renderInputImage\(\{ path: attachment\.path \}, attachment, index\)/);
  assert.match(appJs, /FILE_PREVIEW_SWIPE_CLOSE_MIN_PX/);
  assert.match(appJs, /function beginFilePreviewSwipe\(event\)/);
  assert.match(appJs, /function moveFilePreviewSwipe\(event\)[\s\S]*event\.stopPropagation\(\)[\s\S]*event\.preventDefault\(\)/);
  assert.match(appJs, /function finishFilePreviewSwipe\(event\)[\s\S]*closeFilePreview\(\)/);
  assert.match(appJs, /filePreviewDialog\.addEventListener\("touchstart", beginFilePreviewSwipe, \{ passive: false \}\)/);
  assert.match(appJs, /renderCsvPreview/);
  assert.match(appJs, /\/api\/files\/preview\?threadId=/);
  assert.match(appJs, /\/api\/files\/preview\/content\?\$\{params\.toString\(\)\}/);
  assert.match(serverJs, /\/api\/files\/preview/);
  assert.match(serverJs, /\/api\/files\/preview\/content/);
});
