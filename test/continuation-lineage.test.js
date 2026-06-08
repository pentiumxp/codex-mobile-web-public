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

test("bootstrap exposes lineage as file references instead of inline excerpts", () => {
  const lineageBody = functionBody("continuationLineageSection");
  assert.match(lineageBody, /continuationLineageHandoffExcerpt\(entry, perHandoffChars\)/);

  const referenceBody = functionBody("continuationLineageIndexReference");
  assert.match(referenceBody, /Lineage index file/);
  assert.match(referenceBody, /Prior lineage handoff contents are intentionally not inlined/);
  assert.doesNotMatch(referenceBody, /continuationLineageHandoffExcerpt/);

  const bootstrapBody = functionBody("newThreadBootstrapPromptScoped");
  assert.match(bootstrapBody, /continuationLineageIndexReference\(cwd, sourceThreadId\)/);
  assert.doesNotMatch(bootstrapBody, /continuationLineageSection\(cwd, sourceThreadId\)/);
  assert.match(bootstrapBody, /MAX_CONTINUATION_BOOTSTRAP_CHARS/);
});

test("continuation bootstrap keeps heavy context behind file references", () => {
  assert.match(serverJs, /CODEX_MOBILE_CONTINUATION_BOOTSTRAP_CHARS \|\| "12000"/);
  assert.match(serverJs, /CODEX_MOBILE_CONTINUATION_SOURCE_HANDOFF_EXCERPT_CHARS \|\| "12000"/);
  assert.match(serverJs, /CODEX_MOBILE_CONTINUATION_WORKSPACE_HANDOFF_TAIL_CHARS \|\| "18000"/);
  assert.match(serverJs, /CODEX_MOBILE_CONTINUATION_ITEM_SUMMARY_CHARS \|\| "1200"/);

  const workspaceBody = functionBody("workspaceContextReference");
  assert.match(workspaceBody, /PROJECT_CONTEXT\.md/);
  assert.match(workspaceBody, /HANDOFF\.md/);
  assert.match(workspaceBody, /These files are intentionally not inlined/);
  assert.doesNotMatch(workspaceBody, /readWorkspaceContextFile/);

  const itemBody = functionBody("continuationItemSummary");
  assert.match(itemBody, /CONTINUATION_ITEM_SUMMARY_CHARS/);

  const turnBody = functionBody("continuationTurnSummaries");
  assert.match(turnBody, /CONTINUATION_TURN_SUMMARY_ITEMS/);

  const handoffBody = functionBody("sourceHandoffSection");
  assert.match(handoffBody, /The handoff content is intentionally not inlined/);
  assert.doesNotMatch(handoffBody, /CONTINUATION_SOURCE_HANDOFF_EXCERPT_CHARS/);
  assert.doesNotMatch(handoffBody, /Source-thread-generated handoff excerpt/);
  assert.doesNotMatch(handoffBody, /sourceHandoff\.text \|\| "\(/);

  const bootstrapBody = functionBody("newThreadBootstrapPromptScoped");
  assert.match(bootstrapBody, /Continuation Bootstrap Index/);
  assert.match(bootstrapBody, /bounded file sections/);
  assert.match(bootstrapBody, /top metadata and recent tail first/);
  assert.match(bootstrapBody, /sourceHandoffSection\(sourceHandoff\)/);
  assert.match(bootstrapBody, /workspaceContextReference\(cwd\)/);
  assert.doesNotMatch(bootstrapBody, /\?\?\?\?/);
  assert.doesNotMatch(bootstrapBody, /continuationTurnSummaries\(snapshot\.turns\)/);
  assert.doesNotMatch(bootstrapBody, /continuationWorkspaceContextSections\(cwd\)/);
});

test("source handoff generation prompt is ascii-safe", () => {
  const promptBody = functionBody("sourceContinuationHandoffPrompt");
  assert.match(promptBody, /Continuation Handoff File Generation/);
  assert.match(promptBody, /Target file: \$\{handoffFile\}/);
  assert.doesNotMatch(promptBody, /\?\?\?\?/);
});

test("continuation result persists lineage after bootstrap and archive attempt", () => {
  const startBody = functionBody("startThreadFromRequestBody");
  assert.doesNotMatch(startBody, /const sourceLineage = continuationLineageSection\(cwd, sourceThreadId\)/);
  assert.match(startBody, /input: newThreadBootstrapInput\(\{ cwd, sourceThreadId, sourceThreadTitle, desiredTitle, sourceSnapshot, runtimeSettings, sourceHandoff \}\)/);
  assert.match(startBody, /await migrateContinuationThreadGoal\(sourceThreadId, threadId\)/);
  assert.match(startBody, /if \(job\) job\.sourceGoalMigration = sourceGoalMigration/);
  assert.match(startBody, /const lineage = appendContinuationLineageEntry\(cwd, \{/);
  assert.match(startBody, /sourceGoalMigrated: Boolean\(sourceGoalMigration && sourceGoalMigration\.migrated\)/);
  assert.match(startBody, /sourceGoalMigrationError: sourceGoalMigration && \(sourceGoalMigration\.error \|\| sourceGoalMigration\.sourceFreezeError\)/);
  assert.match(startBody, /sourceArchived: Boolean\(sourceArchive && sourceArchive\.archived\)/);
  assert.match(startBody, /lineage,/);

  const publicJobBody = functionBody("publicContinuationJob");
  assert.match(publicJobBody, /sourceGoalMigration: job\.sourceGoalMigration \|\| null/);
  assert.match(publicJobBody, /lineage: job\.lineage \|\| null/);
});
