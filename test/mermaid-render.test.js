"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { readFrontendSources } = require("./frontend-source-helper");

const renderer = require(path.resolve(__dirname, "..", "public", "markdown-renderer.js"));
const appJs = readFrontendSources(path.resolve(__dirname, ".."));
const mediaPreviewRuntimeJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "media-preview-runtime.js"), "utf8");
const appAndMediaJs = `${mediaPreviewRuntimeJs}\n${appJs}`;
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
  const source = functionSourceFrom(mediaPreviewRuntimeJs, "isMermaidErrorSvgMarkup");
  return Function(`${source}\nreturn isMermaidErrorSvgMarkup;`)();
}

function evaluatedMermaidRenderArtifactIds() {
  const source = functionSourceFrom(mediaPreviewRuntimeJs, "mermaidRenderArtifactIds");
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

test("mermaid render normalization merges detached soft-break label suffixes", () => {
  const source = String.raw`flowchart TD
  RT6[R6 收口判定]\n(done + terminal state)
  RT6 --> FIN[Final Answer]`;

  const normalized = renderer.normalizeMermaidSourceForRender(source);

  assert.match(normalized, /RT6\["R6 收口判定<br\/>\(done \+ terminal state\)"\]/);
  assert.doesNotMatch(normalized, /RT6\[R6 收口判定\]<br\/>\(done \+ terminal state\)/);
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

test("mermaid render normalization quotes subgraph titles with chinese punctuation", () => {
  const source = String.raw`flowchart TD
UI[用户输入] --> FE[前端界面\nWeb UI / Desktop / CLI]
subgraph 可见层（不是模型上下文原样）
  FE --> VIEW[Mobile 展示]
end
subgraph RN Run Journal / SessionDB
  J[持久化中间状态]
end`;

  const normalized = renderer.normalizeMermaidSourceForRender(source);

  assert.match(normalized, /subgraph codex_mobile_subgraph_3\["可见层（不是模型上下文原样）"\]/);
  assert.match(normalized, /subgraph RN\["Run Journal \/ SessionDB"\]/);
  assert.match(normalized, /FE\["前端界面<br\/>Web UI \/ Desktop \/ CLI"\]/);
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
  assert.match(mediaPreviewRuntimeJs, /function isMermaidErrorSvgMarkup\(/);
  assert.match(mediaPreviewRuntimeJs, /if \(isMermaidErrorSvgMarkup\(svgMarkup\)\) throw new Error\("Mermaid syntax error"\)/);
  assert.match(mediaPreviewRuntimeJs, /svg\.querySelector\("\.error-icon, \.error-text"\)/);
});

test("mermaid render cleans external error artifacts left by failed candidates", () => {
  const mermaidRenderArtifactIds = evaluatedMermaidRenderArtifactIds();

  assert.deepEqual(mermaidRenderArtifactIds("codex-mobile-mermaid-7-0"), [
    "codex-mobile-mermaid-7-0",
    "dcodex-mobile-mermaid-7-0",
    "icodex-mobile-mermaid-7-0",
  ]);
  assert.match(mediaPreviewRuntimeJs, /function cleanupMermaidRenderArtifacts\(/);
  assert.match(mediaPreviewRuntimeJs, /function cleanupExternalMermaidErrorArtifacts\(/);
  assert.match(mediaPreviewRuntimeJs, /querySelectorAll\("svg \.error-icon, svg \.error-text"\)/);
  assert.match(mediaPreviewRuntimeJs, /removeNodeIfExternalMermaidArtifact\(document\.getElementById\(id\)\)/);
  assert.match(mediaPreviewRuntimeJs, /cleanupMermaidRenderArtifacts\(candidateRenderId\);[\s\S]*cleanupExternalMermaidErrorArtifacts\(\);[\s\S]*renderMermaidSvg/);
  assert.match(mediaPreviewRuntimeJs, /catch \(err\) \{[\s\S]*cleanupMermaidRenderArtifacts\(candidateRenderId\);[\s\S]*cleanupExternalMermaidErrorArtifacts\(\);/);
  assert.match(appJs, /document\.addEventListener\("focusin", \(\) => \{[\s\S]*cleanupExternalMermaidErrorArtifacts\(\);/);
});

test("mobile app ships a custom Mermaid preview dialog and lazy runtime loader", () => {
  const vendorPath = path.resolve(__dirname, "..", "public", "vendor", "mermaid.min.js");

  assert.ok(fs.existsSync(vendorPath), "missing vendored Mermaid runtime");
  assert.ok(fs.statSync(vendorPath).size > 1000000, "vendored Mermaid runtime looks incomplete");
  assert.match(indexHtml, /id="mermaidPreviewDialog"/);
  assert.match(indexHtml, /id="mermaidPreviewBody"/);
  assert.match(indexHtml, /id="mermaidPreviewSource"/);
  assert.match(appJs, /(?:const|var) MERMAID_SCRIPT_URL = "\/vendor\/mermaid\.min\.js"/);
  assert.match(appAndMediaJs, /function ensureMermaidApi\(/);
  assert.match(appAndMediaJs, /function hydrateMermaidDiagrams\(/);
  assert.match(appJs, /function hydrateThreadDetailSurface\(/);
  assert.match(appJs, /hydrateMermaid:\s*options\.skipRichHydration \? null : hydrateMermaidDiagrams/);
  assert.match(appJs, /threadDetailDomPatchApi\.planConversationHtmlUpdateEffects\(updatePlan\)/);
  assert.match(appJs, /applyConversationHtmlUpdateEffectsPlan\(effectsPlan, \{ root: conversation \}\)/);
  assert.match(appJs, /hydrateThreadDetailSurface\(context\.root, item\.hydrateOptions \|\| \{\}\)/);
  assert.match(appAndMediaJs, /hydrateMermaidDiagrams\(\$\("filePreviewBody"\)\)/);
  assert.match(appAndMediaJs, /function mermaidRenderCandidates\(/);
  assert.match(appAndMediaJs, /function openMermaidPreview\(/);
  assert.match(appAndMediaJs, /function closeMermaidPreview\(/);
  assert.match(appAndMediaJs, /function handleMermaidAction\(/);
  assert.match(appJs, /mermaidPinch: null/);
  assert.match(appAndMediaJs, /function mermaidContainerFromViewer\(viewer\)/);
  assert.match(appAndMediaJs, /function beginMermaidPinch\(event\)/);
  assert.match(appAndMediaJs, /function moveMermaidPinch\(event\)/);
  assert.match(appAndMediaJs, /applyMermaidScale\(pinch\.container, pinch\.scale \* \(distance \/ pinch\.distance\), Object\.assign\(\{ viewer: pinch\.scroller \}, anchorOptions\)\)/);
  assert.match(appJs, /document\.addEventListener\("touchstart", beginMermaidPinch, \{ passive: false, capture: true \}\)/);
  assert.match(appJs, /document\.addEventListener\("touchmove", moveMermaidPinch, \{ passive: false, capture: true \}\)/);
  assert.match(stylesCss, /\.markdown-mermaid-block/);
  assert.match(stylesCss, /\.markdown-mermaid-viewer/);
  assert.match(stylesCss, /\.markdown-mermaid-viewer\s*\{[\s\S]*touch-action:\s*pan-x pan-y;[\s\S]*overscroll-behavior:\s*contain;/);
  assert.match(stylesCss, /\.markdown-mermaid-canvas\s*\{[\s\S]*width: max-content;[\s\S]*justify-content: flex-start;/);
  assert.match(stylesCss, /\.markdown-mermaid-artboard\s*\{[\s\S]*margin-inline: auto;/);
  assert.match(stylesCss, /\.mermaid-preview-dialog/);
  assert.match(stylesCss, /@media \(max-width: 760px\)[\s\S]*\.mermaid-preview-panel/);
  assert.match(pluginEmbedJs, /modal: "mermaidPreview"/);
});
