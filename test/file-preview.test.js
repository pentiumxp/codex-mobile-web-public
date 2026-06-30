"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  createMediaFileService,
  filePreviewContentDisposition,
  filePreviewContentType,
  filePreviewAuthoritiesForThread,
  filePreviewSkillRoots,
  mimeFor,
  previewFileReferencesFromText,
  previewRootsForThread,
  readFilePreview,
  resolveFilePreviewPath,
  stripMarkdownFileTarget,
} = require("../adapters/media-file-service");

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

test("file preview allows files from visible workspace roots", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-preview-visible-"));
  const file = path.join(root, "10_Family", "Home network", "Personal AI Homelab.md");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "# Homelab\n", "utf8");

  const roots = previewRootsForThread("", {
    "electron-saved-workspace-roots": [root],
  });
  const preview = readFilePreview(file, roots);

  assert.equal(preview.fileName, "Personal AI Homelab.md");
  assert.equal(preview.relativePath, path.join("10_Family", "Home network", "Personal AI Homelab.md"));
  assert.equal(preview.content, "# Homelab\n");
});

test("file preview allows the current thread cwd even when workspace roots are visible", () => {
  const visibleRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-preview-visible-root-"));
  const threadRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-preview-thread-root-"));
  const file = path.join(threadRoot, "artifacts", "daily-oblique-full", "index.html");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "<!doctype html><title>Daily</title>\n", "utf8");

  const roots = previewRootsForThread("thread-1", {
    "electron-saved-workspace-roots": [visibleRoot],
  }, {
    threadSummary: { cwd: threadRoot },
  });
  const preview = readFilePreview(file, roots);

  assert.equal(preview.fileName, "index.html");
  assert.equal(preview.relativePath, path.join("artifacts", "daily-oblique-full", "index.html"));
  assert.equal(preview.kind, "text");
});

test("file preview allows configured Codex skill roots without allowing all Codex state", () => {
  const userHome = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-preview-home-"));
  const codexHome = path.join(userHome, ".codex");
  const skillRoot = path.join(codexHome, "skills");
  const skillFile = path.join(skillRoot, "hermes-webui-live-to-final-governance", "SKILL.md");
  const sessionFile = path.join(codexHome, "sessions", "2026", "rollout.md");
  const visibleRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-preview-visible-"));
  fs.mkdirSync(path.dirname(skillFile), { recursive: true });
  fs.mkdirSync(path.dirname(sessionFile), { recursive: true });
  fs.writeFileSync(skillFile, "# Skill\n\nUse this workflow.\n", "utf8");
  fs.writeFileSync(sessionFile, "# Session\n\nDo not expose this as a skill preview.\n", "utf8");

  const roots = previewRootsForThread("", {
    "electron-saved-workspace-roots": [visibleRoot],
  }, {
    userHome,
    codexHome,
    defaultCodexHome: codexHome,
  });
  const preview = readFilePreview(skillFile, roots);

  assert.deepEqual(filePreviewSkillRoots({ userHome, codexHome, defaultCodexHome: codexHome }), [
    skillRoot,
    path.join(userHome, ".agents", "skills"),
  ]);
  assert.equal(preview.fileName, "SKILL.md");
  assert.equal(preview.relativePath, path.join("hermes-webui-live-to-final-governance", "SKILL.md"));
  assert.equal(preview.kind, "markdown");
  assert.match(preview.content, /Use this workflow/);
  assert.throws(() => readFilePreview(sessionFile, roots), /outside the allowed preview roots/);
});

test("file preview allows exact local files referenced by the current thread", () => {
  const visibleRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-preview-visible-"));
  const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-preview-referenced-"));
  const referencedFile = path.join(outsideRoot, "Hermes Live to Final", "lesson notes.md");
  const siblingFile = path.join(outsideRoot, "Hermes Live to Final", "private sibling.md");
  const imageFile = path.join(outsideRoot, "Hermes Live to Final", "diagram.png");
  fs.mkdirSync(path.dirname(referencedFile), { recursive: true });
  fs.writeFileSync(referencedFile, "# Lesson\n\nReferenced by this thread.\n", "utf8");
  fs.writeFileSync(siblingFile, "# Sibling\n\nNot referenced.\n", "utf8");
  fs.writeFileSync(imageFile, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

  const rolloutText = [
    `Opened local note: ${referencedFile}:12`,
    `Rendered local image: file://${imageFile}`,
  ].join("\n");
  const authorities = filePreviewAuthoritiesForThread("thread-1", {
    "electron-saved-workspace-roots": [visibleRoot],
  }, {
    threadSummary: { cwd: visibleRoot },
    rolloutText,
  });

  const preview = readFilePreview(referencedFile, authorities);
  const imagePreview = readFilePreview(imageFile, authorities);

  assert.equal(preview.fileName, "lesson notes.md");
  assert.equal(preview.relativePath, "lesson notes.md");
  assert.equal(preview.kind, "markdown");
  assert.match(preview.content, /Referenced by this thread/);
  assert.equal(imagePreview.kind, "image");
  assert.throws(() => readFilePreview(siblingFile, authorities), /outside the allowed preview roots/);
});

test("file preview authorizes only the requested local file referenced by thread text", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-preview-root-fast-"));
  const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-preview-root-fast-outside-"));
  const requestedFile = path.join(outsideRoot, "notes", "current.md");
  const outsideFile = path.join(outsideRoot, "other.md");
  const unreferencedFile = path.join(outsideRoot, "private.md");
  fs.mkdirSync(path.dirname(requestedFile), { recursive: true });
  fs.writeFileSync(requestedFile, "# Current\n", "utf8");
  fs.writeFileSync(outsideFile, "# Outside\n", "utf8");
  fs.writeFileSync(unreferencedFile, "# Private\n", "utf8");

  const authorities = filePreviewAuthoritiesForThread("thread-1", {
    "electron-saved-workspace-roots": [root],
  }, {
    threadSummary: { cwd: root },
    requestedPath: requestedFile,
    rolloutText: `Open this file: ${requestedFile}\nMentioned elsewhere: ${outsideFile}`,
  });
  const unreferencedAuthorities = filePreviewAuthoritiesForThread("thread-1", {
    "electron-saved-workspace-roots": [root],
  }, {
    threadSummary: { cwd: root },
    requestedPath: unreferencedFile,
    rolloutText: `Open this file: ${requestedFile}\nMentioned elsewhere: ${outsideFile}`,
  });

  assert.equal(authorities.some((entry) => entry.file === outsideFile), false);
  assert.equal(readFilePreview(requestedFile, authorities).fileName, "current.md");
  assert.throws(() => readFilePreview(unreferencedFile, unreferencedAuthorities), /outside the allowed preview roots/);
});

test("file preview opens a requested artifact path even when it appeared before the scan tail", () => {
  const visibleRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-preview-bounded-visible-"));
  const outsideRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-preview-bounded-outside-"));
  const oldFile = path.join(outsideRoot, "old.md");
  const recentFile = path.join(outsideRoot, "recent.md");
  fs.mkdirSync(outsideRoot, { recursive: true });
  fs.writeFileSync(oldFile, "# Old\n", "utf8");
  fs.writeFileSync(recentFile, "# Recent\n", "utf8");

  const rolloutText = [
    `Old reference: ${oldFile}`,
    "x".repeat(3 * 1024 * 1024),
    `Recent reference: ${recentFile}`,
  ].join("\n");
  const recentAuthorities = filePreviewAuthoritiesForThread("thread-1", {
    "electron-saved-workspace-roots": [visibleRoot],
  }, {
    threadSummary: { cwd: visibleRoot },
    requestedPath: recentFile,
    rolloutText,
  });
  const oldAuthorities = filePreviewAuthoritiesForThread("thread-1", {
    "electron-saved-workspace-roots": [visibleRoot],
  }, {
    threadSummary: { cwd: visibleRoot },
    requestedPath: oldFile,
    rolloutText,
  });

  assert.equal(readFilePreview(recentFile, recentAuthorities).fileName, "recent.md");
  assert.equal(readFilePreview(oldFile, oldAuthorities).fileName, "old.md");
});

test("file preview extracts local previewable files from thread text", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-preview-extract-"));
  const markdown = path.join(root, "05_AI_lessons", "Hermes Live to Final.md");
  const png = path.join(root, "diagrams", "flow chart.png");
  const secret = path.join(root, ".env");
  fs.mkdirSync(path.dirname(markdown), { recursive: true });
  fs.mkdirSync(path.dirname(png), { recursive: true });
  fs.writeFileSync(markdown, "# Lesson\n", "utf8");
  fs.writeFileSync(png, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  fs.writeFileSync(secret, "TOKEN=secret\n", "utf8");

  const references = previewFileReferencesFromText([
    `See [lesson](${markdown}:42)`,
    `![diagram](file://${png})`,
    `Do not allow ${secret}`,
  ].join("\n"));

  assert.deepEqual(references.sort(), [
    fs.realpathSync.native ? fs.realpathSync.native(markdown) : fs.realpathSync(markdown),
    fs.realpathSync.native ? fs.realpathSync.native(png) : fs.realpathSync(png),
  ].sort());
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

test("media service route returns file preview metadata through injected authority state", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-preview-route-"));
  const file = path.join(root, "notes", "route.md");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "# Route\n", "utf8");
  const service = createMediaFileService({
    readGlobalState: () => ({ "electron-saved-workspace-roots": [root] }),
  });
  const sent = [];

  const result = await service.handleMediaFileRoute({
    url: new URL(`/api/files/preview?threadId=t1&path=${encodeURIComponent(file)}`, "http://127.0.0.1"),
    method: "GET",
    sendJson: (status, body) => sent.push({ status, body }),
  });

  assert.equal(result.handled, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].status, 200);
  assert.equal(sent[0].body.fileName, "route.md");
  assert.equal(sent[0].body.content, "# Route\n");
});

test("media service deduplicates matching message submissions and keeps upload history policy local", async () => {
  const service = createMediaFileService({
    messageDedupeWindowMs: 60_000,
  });
  const uploads = [];
  const keys = service.messageSubmissionKeys("thread-1", { clientSubmissionId: "client-1" }, "hello", uploads);
  let calls = 0;

  const first = await service.runMessageSubmissionOnce(keys, uploads, async () => {
    calls += 1;
    return { ok: true, call: calls };
  });
  const second = await service.runMessageSubmissionOnce(keys, uploads, async () => {
    calls += 1;
    return { ok: false, call: calls };
  });

  assert.deepEqual(first, { ok: true, call: 1 });
  assert.deepEqual(second, { ok: true, call: 1 });
  assert.equal(calls, 1);
});
