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

test("ordered markdown lists use the first source number as the list start", () => {
  const html = renderer.renderMarkdown("1. first\n2. second\n3. third\n\n3. resumed\n4. next\n5. final", {
    orderedListMode: "source",
  });

  assert.match(html, /<ol><li>first<\/li><li>second<\/li><li>third<\/li><\/ol>/);
  assert.match(html, /<ol start="3"><li>resumed<\/li><li>next<\/li><li>final<\/li><\/ol>/);
  assert.doesNotMatch(html, /<ol start="5"><li>resumed/);
});

test("ordered markdown lists use the first item as the source start", () => {
  const html = renderer.renderMarkdown("3. first\n4. second", { orderedListMode: "source" });

  assert.match(html, /<ol start="3"><li>first<\/li><li>second<\/li><\/ol>/);
  assert.doesNotMatch(html, /<ol start="4">/);
});

test("chat ordered markdown lists reset detached continuation numbering", () => {
  const html = renderer.renderMarkdown("6. one\n7. two\n8. three\n9. four");

  assert.match(html, /<ol><li>one<\/li><li>two<\/li><li>three<\/li><li>four<\/li><\/ol>/);
  assert.doesNotMatch(html, /<ol start="6">/);
  assert.doesNotMatch(html, /<ol start="9">/);
});

test("source-mode ordered markdown lists preserve detached continuation numbering", () => {
  const html = renderer.renderMarkdown("6. one\n7. two", { orderedListMode: "source" });

  assert.match(html, /<ol start="6"><li>one<\/li><li>two<\/li><\/ol>/);
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
  assert.match(html, /PROJECT_STATUS\.md<\/button>/);
  assert.doesNotMatch(html, />预览文件</);
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

test("markdown images render safe data png base64 images", () => {
  const html = renderer.renderMarkdown("![效果图](data:image/png;base64,iVBORw0KGgo=)");

  assert.match(html, /class="markdown-image"/);
  assert.match(html, /<img src="data:image\/png;base64,iVBORw0KGgo="/);
  assert.match(html, /alt="效果图"/);
  assert.doesNotMatch(html, /data:image\/svg\+xml/);
});

test("bare data png base64 lines render as generated images", () => {
  const html = renderer.renderMarkdown("data:image/png;base64,iVBORw0KGgo=");

  assert.match(html, /class="markdown-image"/);
  assert.match(html, /<img src="data:image\/png;base64,iVBORw0KGgo="/);
  assert.match(html, /Generated image/);
  assert.doesNotMatch(html, /<p>data:image/);
});

test("bare https URLs do not render as generated images", () => {
  const html = renderer.renderMarkdown("https://github.com/MiniMax-AI/MiniMax-M2.7/issues/52");

  assert.doesNotMatch(html, /class="markdown-image"/);
  assert.doesNotMatch(html, /Generated image/);
  assert.match(html, /<p><a href="https:\/\/github\.com\/MiniMax-AI\/MiniMax-M2\.7\/issues\/52" target="_blank" rel="noreferrer">https:\/\/github\.com\/MiniMax-AI\/MiniMax-M2\.7\/issues\/52<\/a><\/p>/);
});

test("markdown image renderer rejects unsafe data image formats", () => {
  const html = renderer.renderMarkdown("![bad](data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=)");

  assert.doesNotMatch(html, /<img/);
  assert.match(html, /!\[bad\]\(data:image\/svg\+xml;base64,PHN2Zz48L3N2Zz4=\)/);
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
