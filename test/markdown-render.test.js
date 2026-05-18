"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");

const renderer = require(path.resolve(__dirname, "..", "public", "markdown-renderer.js"));

test("ordered markdown lists keep their source numbering across blank-separated items", () => {
  const html = renderer.renderMarkdown("1. first\n\n2. second\n\n3. third");

  assert.match(html, /<ol><li>first<\/li><\/ol>/);
  assert.match(html, /<ol start="2"><li>second<\/li><\/ol>/);
  assert.match(html, /<ol start="3"><li>third<\/li><\/ol>/);
});

test("bare URLs render as safe clickable links", () => {
  const html = renderer.renderInlineMarkdown("Open https://example.com/a?b=1&c=2, or www.example.org.");

  assert.match(html, /<a href="https:\/\/example\.com\/a\?b=1&amp;c=2" target="_blank" rel="noreferrer">https:\/\/example\.com\/a\?b=1&amp;c=2<\/a>,/);
  assert.match(html, /<a href="https:\/\/www\.example\.org" target="_blank" rel="noreferrer">www\.example\.org<\/a>\./);
});

test("existing markdown links are not broken by bare URL linkification", () => {
  const html = renderer.renderInlineMarkdown("[Open](https://example.com/path) and https://other.example");

  assert.match(html, /^<a href="https:\/\/example\.com\/path" target="_blank" rel="noreferrer">Open<\/a> and <a href="https:\/\/other\.example" target="_blank" rel="noreferrer">https:\/\/other\.example<\/a>$/);
});

test("local file markdown links render as explicit preview actions", () => {
  const html = renderer.renderInlineMarkdown("[PROJECT_STATUS.md](</Users/frank/Obsidian Vault/01_Work/PROJECT_STATUS.md>)");

  assert.match(html, /class="local-file-preview-link"/);
  assert.match(html, /data-local-file-path="\/Users\/frank\/Obsidian Vault\/01_Work\/PROJECT_STATUS\.md"/);
  assert.match(html, /PROJECT_STATUS\.md<span>预览文件<\/span>/);
});

test("local file markdown links decode url-encoded path segments", () => {
  const html = renderer.renderInlineMarkdown("[Personal AI Homelab.md](/Users/frank/Obsidian%20Vault/Personal%20AI%20Homelab.md)");

  assert.match(html, /data-local-file-path="\/Users\/frank\/Obsidian Vault\/Personal AI Homelab\.md"/);
});

test("unsafe markdown links are escaped instead of rendered clickable", () => {
  const html = renderer.renderInlineMarkdown("[bad](javascript:alert(1)) and <script>alert(2)</script>");

  assert.equal(html, "[bad](javascript:alert(1)) and &lt;script&gt;alert(2)&lt;/script&gt;");
  assert.doesNotMatch(html, /href="javascript:/);
  assert.doesNotMatch(html, /<script>/);
});

test("code blocks can receive app copy button hooks", () => {
  const html = renderer.renderMarkdown("```js\nconsole.log(1)\n```", {
    rememberCopyText(value) {
      assert.equal(value, "console.log(1)");
      return "copy-key";
    },
    copyButtonHtml(copyKey, label, className) {
      return `<button data-copy-key="${copyKey}" class="${className}">${label}</button>`;
    },
  });

  assert.match(html, /<span class="markdown-code-lang">js<\/span><button data-copy-key="copy-key" class="markdown-copy-button">复制<\/button>/);
  assert.match(html, /<pre><code>console\.log\(1\)<\/code><\/pre>/);
});
