"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const serverJs = fs.readFileSync(path.resolve(__dirname, "..", "server.js"), "utf8");

function functionBody(name) {
  const patterns = [
    `function ${name}(`,
    `async function ${name}(`,
  ];
  let start = -1;
  for (const pattern of patterns) {
    start = serverJs.indexOf(pattern);
    if (start >= 0) break;
  }
  assert.notEqual(start, -1, `missing function ${name}`);
  const bodyStart = serverJs.indexOf(") {", start) + 2;
  assert.notEqual(bodyStart, 1, `missing function body ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < serverJs.length; index += 1) {
    const char = serverJs[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return serverJs.slice(bodyStart + 1, index);
  }
  throw new Error(`could not parse function ${name}`);
}

test("continuation lineage writes a workspace-local ignored index", () => {
  assert.match(serverJs, /CODEX_MOBILE_CONTINUATION_LINEAGE_MAX_DEPTH/);
  assert.match(serverJs, /CODEX_MOBILE_CONTINUATION_LINEAGE_MAX_CHARS/);
  const indexPathBody = functionBody("continuationLineageIndexPath");
  assert.match(indexPathBody, /\.agent-context", "thread-handoffs", "index\.jsonl"/);

  const appendBody = functionBody("appendContinuationLineageEntry");
  assert.match(appendBody, /ensureContinuationHandoffIgnore\(target\)/);
  assert.match(appendBody, /fs\.appendFileSync\(indexPath, `\$\{JSON\.stringify\(normalized\)\}\\n`, "utf8"\)/);
});

test("continuation lineage follows prior continuation threads by newThreadId", () => {
  const chainBody = functionBody("buildContinuationLineageChain");
  assert.match(chainBody, /byNewThreadId\.set\(entry\.newThreadId, entry\)/);
  assert.match(chainBody, /const entry = byNewThreadId\.get\(currentThreadId\)/);
  assert.match(chainBody, /currentThreadId = entry\.sourceThreadId/);
  assert.match(chainBody, /chain\.length < maxDepth/);
});

test("bootstrap makes lineage visible to the next agent", () => {
  const lineageBody = functionBody("continuationLineageSection");
  assert.match(lineageBody, /## 续接 lineage/);
  assert.match(lineageBody, /Agent 可见的历史交接索引/);
  assert.match(lineageBody, /先读取 lineage 指向的 handoff 文件/);
  assert.match(lineageBody, /continuationLineageHandoffExcerpt\(entry, perHandoffChars\)/);

  const bootstrapBody = functionBody("newThreadBootstrapPromptScoped");
  assert.match(bootstrapBody, /sourceLineage \|\| continuationLineageSection\(cwd, sourceThreadId\)/);
  assert.match(bootstrapBody, /MAX_CONTINUATION_BOOTSTRAP_CHARS/);
});

test("continuation bootstrap keeps heavy context as bounded excerpts", () => {
  assert.match(serverJs, /CODEX_MOBILE_CONTINUATION_BOOTSTRAP_CHARS \|\| "52000"/);
  assert.match(serverJs, /CODEX_MOBILE_CONTINUATION_SOURCE_HANDOFF_EXCERPT_CHARS \|\| "12000"/);
  assert.match(serverJs, /CODEX_MOBILE_CONTINUATION_WORKSPACE_HANDOFF_TAIL_CHARS \|\| "18000"/);
  assert.match(serverJs, /CODEX_MOBILE_CONTINUATION_ITEM_SUMMARY_CHARS \|\| "1200"/);

  const workspaceBody = functionBody("continuationWorkspaceContextSections");
  assert.match(workspaceBody, /CONTINUATION_WORKSPACE_PROJECT_CONTEXT_CHARS/);
  assert.match(workspaceBody, /CONTINUATION_WORKSPACE_HANDOFF_TAIL_CHARS/);

  const itemBody = functionBody("continuationItemSummary");
  assert.match(itemBody, /CONTINUATION_ITEM_SUMMARY_CHARS/);

  const turnBody = functionBody("continuationTurnSummaries");
  assert.match(turnBody, /CONTINUATION_TURN_SUMMARY_ITEMS/);

  const handoffBody = functionBody("sourceHandoffSection");
  assert.match(handoffBody, /CONTINUATION_SOURCE_HANDOFF_EXCERPT_CHARS/);
  assert.match(handoffBody, /Source-thread-generated handoff excerpt/);
  assert.doesNotMatch(handoffBody, /sourceHandoff\.text \|\| "\(/);
});

test("continuation result persists lineage after bootstrap and archive attempt", () => {
  const startBody = functionBody("startThreadFromRequestBody");
  assert.match(startBody, /const sourceLineage = continuationLineageSection\(cwd, sourceThreadId\)/);
  assert.match(startBody, /input: newThreadBootstrapInput\(\{ cwd, sourceThreadId, sourceThreadTitle, desiredTitle, sourceSnapshot, runtimeSettings, sourceHandoff, sourceLineage \}\)/);
  assert.match(startBody, /const lineage = appendContinuationLineageEntry\(cwd, \{/);
  assert.match(startBody, /sourceArchived: Boolean\(sourceArchive && sourceArchive\.archived\)/);
  assert.match(startBody, /lineage,/);

  const publicJobBody = functionBody("publicContinuationJob");
  assert.match(publicJobBody, /lineage: job\.lineage \|\| null/);
});
