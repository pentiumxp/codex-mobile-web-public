"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const appJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "app.js"), "utf8");

function functionSource(name) {
  const start = appJs.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const bodyStart = appJs.indexOf("{", start);
  assert.notEqual(bodyStart, -1, `missing function body ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < appJs.length; index += 1) {
    const char = appJs[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return appJs.slice(start, index + 1);
  }
  throw new Error(`could not parse function ${name}`);
}

function markdownHarness() {
  const sources = [
    "safeMarkdownUrl",
    "autolinkUrlParts",
    "renderMarkdownLink",
    "renderAutolinkUrl",
    "renderInlineMarkdown",
    "isMarkdownTableSeparator",
    "splitMarkdownTableRow",
    "isMarkdownBlockStart",
    "renderMarkdownTable",
    "renderMarkdownList",
    "renderMarkdown",
  ].map(functionSource).join("\n");
  return vm.runInNewContext(`
    function escapeHtml(value) {
      return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[ch]));
    }
    function rememberCopyText() { return ""; }
    function copyButtonHtml() { return ""; }
    ${sources}
    ({ renderMarkdown, renderInlineMarkdown });
  `);
}

test("ordered markdown lists keep their source numbering across blank-separated items", () => {
  const { renderMarkdown } = markdownHarness();
  const html = renderMarkdown("1. first\n\n2. second\n\n3. third");

  assert.match(html, /<ol><li>first<\/li><\/ol>/);
  assert.match(html, /<ol start="2"><li>second<\/li><\/ol>/);
  assert.match(html, /<ol start="3"><li>third<\/li><\/ol>/);
});

test("bare URLs render as safe clickable links", () => {
  const { renderInlineMarkdown } = markdownHarness();
  const html = renderInlineMarkdown("Open https://example.com/a?b=1&c=2, or www.example.org.");

  assert.match(html, /<a href="https:\/\/example\.com\/a\?b=1&amp;c=2" target="_blank" rel="noreferrer">https:\/\/example\.com\/a\?b=1&amp;c=2<\/a>,/);
  assert.match(html, /<a href="https:\/\/www\.example\.org" target="_blank" rel="noreferrer">www\.example\.org<\/a>\./);
});

test("existing markdown links are not broken by bare URL linkification", () => {
  const { renderInlineMarkdown } = markdownHarness();
  const html = renderInlineMarkdown("[Open](https://example.com/path) and https://other.example");

  assert.match(html, /^<a href="https:\/\/example\.com\/path" target="_blank" rel="noreferrer">Open<\/a> and <a href="https:\/\/other\.example" target="_blank" rel="noreferrer">https:\/\/other\.example<\/a>$/);
});
