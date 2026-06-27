"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const serverJs = fs.readFileSync(path.resolve(__dirname, "..", "server.js"), "utf8");
const summaryServiceJs = fs.readFileSync(path.resolve(__dirname, "..", "adapters", "thread-detail-summary-service.js"), "utf8");
const appJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "app.js"), "utf8");

function functionSource(source, name) {
  let start = source.indexOf(`function ${name}(`);
  if (start < 0) start = source.indexOf(`async function ${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const bodyStart = source.indexOf(") {", start) + 2;
  assert.notEqual(bodyStart, 1, `missing function body ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`could not parse function ${name}`);
}

test("thread detail refreshes display title from app-server summary", () => {
  assert.match(serverJs, /function mergeThreadDisplaySummary\(base, display, options = \{\}\)/);
  assert.match(serverJs, /createThreadDetailSummaryService\(\{\s*readStateDbThread,\s*readStartedThread,\s*readRolloutSessionFallbackThread,\s*readThreadSummaryFromAppServer,\s*mergeThreadDisplaySummary,/);
  assert.match(summaryServiceJs, /summary = mergeThreadDisplaySummary\(summary, appServerSummary\);/);
  assert.match(summaryServiceJs, /source = `\$\{source\}\+app-server`;/);
});

test("thread display summary keeps local runtime fields while accepting display fields", () => {
  const helperStart = serverJs.indexOf("function mergeThreadDisplaySummary(base, display, options = {})");
  assert.notEqual(helperStart, -1, "missing mergeThreadDisplaySummary helper");
  const helperEnd = serverJs.indexOf("function mergeThreadRuntimeFromStateDb", helperStart);
  assert.ok(helperEnd > helperStart, "helper should be placed before runtime merge");
  const helperBody = serverJs.slice(helperStart, helperEnd);

  assert.match(helperBody, /Object\.assign\(\{\}, base\)/);
  assert.match(helperBody, /for \(const key of \["name", "preview", "cwd"\]\)/);
  assert.match(helperBody, /displayUpdatedAtMs[\s\S]*>= baseUpdatedAtMs/);
  assert.match(helperBody, /shouldReplaceThreadDisplayStatus\(base\.status, display\.status, baseUpdatedAtMs, displayUpdatedAtMs\)/);
  assert.doesNotMatch(helperBody, /if \(display\.status\) next\.status = display\.status;/);
  assert.doesNotMatch(helperBody, /model|effort|sandboxPolicy|approvalPolicy/);
});

test("thread name updates refresh visible tile pane detail cache", () => {
  const sources = [
    "applyThreadNameToThread",
    "scheduleThreadNameDetailRender",
    "updateThreadNameLocally",
  ].map((name) => functionSource(appJs, name));
  const harness = Function(`
const paneListThread = { id: "thread-pane", name: "Old" };
const paneDetailThread = { id: "thread-pane", name: "Old" };
const state = {
  threads: [paneListThread],
  currentThreadId: "thread-current",
  currentThread: { id: "thread-current", name: "Current" },
  threadTileMode: true,
  threadTileDetails: new Map([["thread-pane", paneDetailThread]]),
  renderedThreadListSignature: "old-signature",
};
const currentRenders = [];
const tileRenders = [];
let listRenderCount = 0;
function renderCurrentThread() { currentRenders.push("current"); }
function threadTilePaneIsVisible(threadId) { return String(threadId || "") === "thread-pane"; }
function scheduleRenderThreadTilePane(threadId, options) {
  tileRenders.push({ threadId: String(threadId || ""), preserveScroll: Boolean(options && options.preserveScroll) });
  return true;
}
function renderThreads() { listRenderCount += 1; }
${sources.join("\n")}
return {
  update: updateThreadNameLocally,
  result: () => ({ paneListThread, paneDetailThread, currentThread: state.currentThread, currentRenders, tileRenders, listRenderCount, signature: state.renderedThreadListSignature }),
};
`)();

  harness.update("thread-pane", "New Pane Title");
  const result = harness.result();

  assert.equal(result.paneListThread.name, "New Pane Title");
  assert.equal(result.paneDetailThread.name, "New Pane Title");
  assert.equal(result.currentThread.name, "Current");
  assert.equal(result.signature, "");
  assert.equal(result.listRenderCount, 1);
  assert.deepEqual(result.currentRenders, []);
  assert.deepEqual(result.tileRenders, [{ threadId: "thread-pane", preserveScroll: true }]);
});
