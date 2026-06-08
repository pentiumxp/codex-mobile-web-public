"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const renderer = require(path.resolve(__dirname, "..", "public", "markdown-renderer.js"));
const appJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "app.js"), "utf8");
const indexHtml = fs.readFileSync(path.resolve(__dirname, "..", "public", "index.html"), "utf8");
const pluginEmbedJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "plugin-embed.js"), "utf8");
const stylesCss = fs.readFileSync(path.resolve(__dirname, "..", "public", "styles.css"), "utf8");

function functionBodyFrom(source, name) {
  const start = source.indexOf(`function ${name}(`);
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

function functionSourceFrom(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const body = functionBodyFrom(source, name);
  const open = source.indexOf("{", start);
  return `${source.slice(start, open + 1)}${body}}`;
}

function evaluatedMermaidErrorSvgDetector() {
  const source = functionSourceFrom(appJs, "isMermaidErrorSvgMarkup");
  return Function(`${source}\nreturn isMermaidErrorSvgMarkup;`)();
}

function evaluatedMermaidRenderArtifactIds() {
  const source = functionSourceFrom(appJs, "mermaidRenderArtifactIds");
  return Function(`${source}\nreturn mermaidRenderArtifactIds;`)();
}

test("mermaid fences render dedicated diagram blocks instead of plain code blocks", () => {
  const html = renderer.renderMarkdown("```mermaid\ngraph TD\n  A[Phone] --> B[iPad]\n```");

  assert.match(html, /class="markdown-mermaid-block"/);
  assert.match(html, /data-mermaid-action="zoom-out"/);
  assert.match(html, /data-mermaid-action="zoom-in"/);
  assert.match(html, /data-mermaid-action="expand"/);
  assert.match(html, /class="markdown-mermaid-source-details"/);
  assert.match(html, /class="markdown-mermaid-source" hidden>graph TD/);
  assert.doesNotMatch(html, /class="markdown-code-block"/);
});

test("mermaid render normalization rewrites flowchart newline labels into quoted html labels", () => {
  const source = String.raw`flowchart TD
R --> RC[Context Composer\n(系统提示 + 历史摘要 + Skill + 工具列表)]
RC --> M[Model Provider]`;

  const normalized = renderer.normalizeMermaidSourceForRender(source);

  assert.match(normalized, /RC\["Context Composer<br\/>\(系统提示 \+ 历史摘要 \+ Skill \+ 工具列表\)"\]/);
  assert.match(normalized, /M\[Model Provider\]/);
});

test("mermaid render normalization sanitizes edge labels with ascii parentheses on fallback", () => {
  const source = String.raw`flowchart TD
M -->|tool_call(工具意图)| T1[Runtime Tool Router]`;

  const normalized = renderer.normalizeMermaidSourceForRender(source);

  assert.match(normalized, /\|tool_call（工具意图）\|/);
  assert.match(normalized, /T1\[Runtime Tool Router\]/);
});

test("mermaid render normalization quotes node labels with ascii parentheses on fallback", () => {
  const source = String.raw`flowchart TD
R -->|实时事件| WL[Live Worklog (SSE)]
FA -->|最终归档| TRX[Transcript]`;

  const normalized = renderer.normalizeMermaidSourceForRender(source);

  assert.match(normalized, /WL\["Live Worklog \(SSE\)"\]/);
  assert.match(normalized, /TRX\[Transcript\]/);
});

test("mermaid runtime error SVG is rejected before rendering the bomb icon", () => {
  const isMermaidErrorSvgMarkup = evaluatedMermaidErrorSvgDetector();
  const errorSvg = `<svg viewBox="0 0 2412 512">
    <g>
      <path class="error-icon" d="m411.313,123.313"></path>
      <text class="error-text">Syntax error in text</text>
    </g>
  </svg>`;
  const validSvg = `<svg viewBox="0 0 100 80"><g><path class="node" d="M0 0h10v10z"></path></g></svg>`;

  assert.equal(isMermaidErrorSvgMarkup(errorSvg), true);
  assert.equal(isMermaidErrorSvgMarkup(validSvg), false);
  assert.match(appJs, /function isMermaidErrorSvgMarkup\(/);
  assert.match(appJs, /if \(isMermaidErrorSvgMarkup\(svgMarkup\)\) throw new Error\("Mermaid syntax error"\)/);
  assert.match(appJs, /svg\.querySelector\("\.error-icon, \.error-text"\)/);
});

test("mermaid render cleans external error artifacts left by failed candidates", () => {
  const mermaidRenderArtifactIds = evaluatedMermaidRenderArtifactIds();

  assert.deepEqual(mermaidRenderArtifactIds("codex-mobile-mermaid-7-0"), [
    "codex-mobile-mermaid-7-0",
    "dcodex-mobile-mermaid-7-0",
    "icodex-mobile-mermaid-7-0",
  ]);
  assert.match(appJs, /function cleanupMermaidRenderArtifacts\(/);
  assert.match(appJs, /function cleanupExternalMermaidErrorArtifacts\(/);
  assert.match(appJs, /querySelectorAll\("svg \.error-icon, svg \.error-text"\)/);
  assert.match(appJs, /removeNodeIfExternalMermaidArtifact\(document\.getElementById\(id\)\)/);
  assert.match(appJs, /cleanupMermaidRenderArtifacts\(candidateRenderId\);[\s\S]*cleanupExternalMermaidErrorArtifacts\(\);[\s\S]*renderMermaidSvg/);
  assert.match(appJs, /catch \(err\) \{[\s\S]*cleanupMermaidRenderArtifacts\(candidateRenderId\);[\s\S]*cleanupExternalMermaidErrorArtifacts\(\);/);
  assert.match(appJs, /document\.addEventListener\("focusin", \(\) => \{[\s\S]*cleanupExternalMermaidErrorArtifacts\(\);/);
});

test("mobile app ships a custom Mermaid preview dialog and lazy runtime loader", () => {
  const vendorPath = path.resolve(__dirname, "..", "public", "vendor", "mermaid.min.js");

  assert.ok(fs.existsSync(vendorPath), "missing vendored Mermaid runtime");
  assert.ok(fs.statSync(vendorPath).size > 1000000, "vendored Mermaid runtime looks incomplete");
  assert.match(indexHtml, /id="mermaidPreviewDialog"/);
  assert.match(indexHtml, /id="mermaidPreviewBody"/);
  assert.match(indexHtml, /id="mermaidPreviewSource"/);
  assert.match(appJs, /const MERMAID_SCRIPT_URL = "\/vendor\/mermaid\.min\.js"/);
  assert.match(appJs, /function ensureMermaidApi\(/);
  assert.match(appJs, /function hydrateMermaidDiagrams\(/);
  assert.match(appJs, /hydrateMermaidDiagrams\(conversation\)/);
  assert.match(appJs, /hydrateMermaidDiagrams\(\$\("filePreviewBody"\)\)/);
  assert.match(appJs, /function mermaidRenderCandidates\(/);
  assert.match(appJs, /function openMermaidPreview\(/);
  assert.match(appJs, /function closeMermaidPreview\(/);
  assert.match(appJs, /function handleMermaidAction\(/);
  assert.match(stylesCss, /\.markdown-mermaid-block/);
  assert.match(stylesCss, /\.markdown-mermaid-viewer/);
  assert.match(stylesCss, /\.mermaid-preview-dialog/);
  assert.match(stylesCss, /@media \(max-width: 760px\)[\s\S]*\.mermaid-preview-panel/);
  assert.match(pluginEmbedJs, /modal: "mermaidPreview"/);
});
