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
  assert.match(stylesCss, /\.file-preview-image/);
  assert.match(stylesCss, /\.image-view/);
  assert.match(stylesCss, /\.file-preview-table/);
  assert.match(appJs, /data-local-file-path/);
  assert.match(appJs, /file && file\.kind === "markdown"\) return renderMarkdown\(content\)/);
  assert.match(appJs, /file && file\.kind === "image"/);
  assert.match(appJs, /file && file\.kind === "pdf"/);
  assert.match(appJs, /function renderImageView\(item\)/);
  assert.match(appJs, /if \(item\.type === "imageView"\) return renderImageView\(item\)/);
  assert.match(appJs, /imageView: "Image"/);
  assert.match(appJs, /renderCsvPreview/);
  assert.match(appJs, /\/api\/files\/preview\?threadId=/);
  assert.match(appJs, /\/api\/files\/preview\/content\?\$\{params\.toString\(\)\}/);
  assert.match(serverJs, /\/api\/files\/preview/);
  assert.match(serverJs, /\/api\/files\/preview\/content/);
});
