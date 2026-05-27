"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  filePreviewContentDisposition,
  filePreviewContentType,
  mimeFor,
  readFilePreview,
  resolveFilePreviewPath,
  stripMarkdownFileTarget,
} = require("../server");

test("file preview reads allowed markdown files with relative display paths", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-preview-"));
  const file = path.join(root, "docs", "PROJECT_STATUS.md");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "# Project\n\n- ready\n", "utf8");

  const preview = readFilePreview(`<${file}>`, [root]);

  assert.equal(preview.fileName, "PROJECT_STATUS.md");
  assert.equal(preview.relativePath, path.join("docs", "PROJECT_STATUS.md"));
  assert.equal(preview.kind, "markdown");
  assert.equal(preview.content, "# Project\n\n- ready\n");
  assert.equal(preview.truncated, false);
});

test("file preview rejects files outside allowed roots", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-preview-root-"));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-preview-outside-"));
  const file = path.join(outside, "note.md");
  fs.writeFileSync(file, "secret", "utf8");

  assert.throws(() => resolveFilePreviewPath(file, [root]), /outside the allowed preview roots/);
});

test("file preview rejects unsupported and sensitive files", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-preview-safe-"));
  const binary = path.join(root, "archive.zip");
  const envFile = path.join(root, ".env");
  const credentialsFile = path.join(root, "credentials.json");
  fs.writeFileSync(binary, "not really zip", "utf8");
  fs.writeFileSync(envFile, "TOKEN=secret", "utf8");
  fs.writeFileSync(credentialsFile, "{\"token\":\"secret\"}", "utf8");

  assert.throws(() => resolveFilePreviewPath(binary, [root]), /file type is not supported/);
  assert.throws(() => resolveFilePreviewPath(envFile, [root]), /not allowed/);
  assert.throws(() => resolveFilePreviewPath(credentialsFile, [root]), /not allowed/);
});

test("file preview returns media metadata without reading binary content", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-preview-media-"));
  const image = path.join(root, "screenshots", "view.png");
  const pdf = path.join(root, "docs", "report.pdf");
  fs.mkdirSync(path.dirname(image), { recursive: true });
  fs.mkdirSync(path.dirname(pdf), { recursive: true });
  fs.writeFileSync(image, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  fs.writeFileSync(pdf, "%PDF-1.7\n", "utf8");

  const imagePreview = readFilePreview(image, [root], { threadId: "thread-1" });
  const pdfPreview = readFilePreview(pdf, [root], { threadId: "thread-1" });

  assert.equal(imagePreview.kind, "image");
  assert.equal(imagePreview.contentType, "image/png");
  assert.equal(imagePreview.content, undefined);
  assert.match(imagePreview.contentUrl, /\/api\/files\/preview\/content\?threadId=thread-1&path=/);
  assert.equal(pdfPreview.kind, "pdf");
  assert.equal(pdfPreview.contentType, "application/pdf");
});

test("uploaded image route returns browser-renderable image mime types", () => {
  assert.equal(mimeFor("photo.jpg"), "image/jpeg");
  assert.equal(mimeFor("photo.jpeg"), "image/jpeg");
  assert.equal(mimeFor("photo.webp"), "image/webp");
  assert.equal(mimeFor("photo.gif"), "image/gif");
  assert.equal(mimeFor("photo.png"), "image/png");
});

test("file preview supports common code and data document types", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-preview-docs-"));
  const json = path.join(root, "data.json");
  const script = path.join(root, "script.ts");
  const csv = path.join(root, "table.csv");
  fs.writeFileSync(json, "{\"ok\":true}", "utf8");
  fs.writeFileSync(script, "const ok: boolean = true;\n", "utf8");
  fs.writeFileSync(csv, "name,value\nA,1\n", "utf8");

  assert.equal(readFilePreview(json, [root]).kind, "json");
  assert.equal(readFilePreview(script, [root]).kind, "text");
  assert.equal(readFilePreview(csv, [root]).kind, "csv");
  assert.equal(filePreviewContentType(json), "application/json; charset=utf-8");
});

test("file preview content disposition keeps non-ascii names browser friendly", () => {
  const header = filePreviewContentDisposition("/tmp/截屏 1.png");

  assert.match(header, /filename="_ 1\.png"/);
  assert.match(header, /filename\*=UTF-8''%E6%88%AA%E5%B1%8F%201\.png/);
});

test("markdown file targets strip angle brackets and file urls", () => {
  assert.equal(stripMarkdownFileTarget("</Users/frank/A B.md>"), "/Users/frank/A B.md");
  assert.equal(stripMarkdownFileTarget("file:///Users/frank/A%20B.md"), "/Users/frank/A B.md");
  assert.equal(stripMarkdownFileTarget("/Users/frank/Obsidian%20Vault/A%20B.md"), "/Users/frank/Obsidian Vault/A B.md");
  assert.equal(stripMarkdownFileTarget("/Users/frank/Obsidian%20Vault/A%20B.md:12"), "/Users/frank/Obsidian Vault/A B.md");
  assert.equal(stripMarkdownFileTarget("/Users/frank/Obsidian%20Vault/A%20B.md:12:3"), "/Users/frank/Obsidian Vault/A B.md");
  assert.equal(stripMarkdownFileTarget("/Users/frank/Obsidian%20Vault/A%20B.md#L12"), "/Users/frank/Obsidian Vault/A B.md");
});

test("file preview accepts markdown targets with line suffixes", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-preview-line-"));
  const file = path.join(root, "docs", "PROJECT_STATUS.md");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "# Project\n\n- ready\n", "utf8");

  const preview = readFilePreview(`${file}:12`, [root]);

  assert.equal(preview.path, fs.realpathSync.native ? fs.realpathSync.native(file) : fs.realpathSync(file));
  assert.equal(preview.kind, "markdown");
  assert.equal(preview.content, "# Project\n\n- ready\n");
});
