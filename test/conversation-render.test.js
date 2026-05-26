"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const appJs = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
const serverJs = fs.readFileSync(path.join(root, "server.js"), "utf8");

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

function functionBody(name) {
  return functionBodyFrom(appJs, name);
}

function serverFunctionBody(name) {
  return functionBodyFrom(serverJs, name);
}

function evaluatedAttachmentSummaryParser() {
  const sources = [
    "attachmentSummaryMarkerMatch",
    "stripAttachmentSummaryLinePrefix",
    "parseAttachmentLine",
    "splitAttachmentSummaryText",
  ].map((name) => functionSourceFrom(appJs, name));
  return Function(`${sources.join("\n")}\nreturn splitAttachmentSummaryText;`)();
}

test("context compaction notices update status and collapse repeated turn notices", () => {
  assert.match(functionBody("visibleItemsForTurn"), /const contextEntryByKey = new Map\(\)/);
  assert.match(functionBody("visibleItemsForTurn"), /isContextCompactionItem\(item\)/);
  assert.match(functionBody("visibleItemsForTurn"), /const notice = contextCompactionNotice\(item, turn\)/);
  assert.match(functionBody("visibleItemsForTurn"), /if \(!notice\) return/);
  assert.match(functionBody("visibleItemsForTurn"), /visible\[existing\.visibleIndex\] = null/);
  assert.match(functionBody("visibleItemsForTurn"), /return visible\.filter\(Boolean\)/);
  assert.match(functionBody("visibleItemSignature"), /isContextCompactionItem\(item\)/);
  assert.match(functionBody("visibleItemSignature"), /const notice = contextCompactionNotice\(item, turn\)/);
  assert.match(functionBody("visibleItemSignature"), /if \(!notice\) return null/);
  assert.match(functionBody("visibleItemSignature"), /mobileCompactionStatus: item\.mobileCompactionStatus/);
  assert.match(functionBody("visibleItemSignature"), /notice,/);
  assert.match(functionBody("conversationRenderSignature"), /visibleItemSignature\(entry\.item, turn\)/);
});

test("context compaction notices require explicit state and do not infer pending from live turns", () => {
  assert.match(appJs, /function contextCompactionState\(/);
  assert.match(functionBody("contextCompactionState"), /itemKind === "complete"/);
  assert.match(functionBody("contextCompactionState"), /mobileKind === "complete"/);
  assert.match(functionBody("contextCompactionState"), /itemKind === "pending"/);
  assert.match(functionBody("contextCompactionState"), /canShowPendingContextCompaction\(turn\)/);
  assert.match(functionBody("contextCompactionState"), /return ""/);
  assert.match(functionBody("canShowPendingContextCompaction"), /isLatestTurn\(turn\) && isLiveTurn\(turn\)/);
  assert.doesNotMatch(functionBody("contextCompactionState"), /isContextCompactionType\(item\.type\)/);
  assert.match(functionBody("renderContextCompaction"), /const notice = contextCompactionNotice\(item, turn\)/);
  assert.match(functionBody("renderContextCompaction"), /if \(!notice\) return ""/);
});

test("long agent messages keep a stable render path when a turn completes", () => {
  assert.match(functionBody("renderItemBody"), /if \(item\.type === "agentMessage"\) \{[\s\S]*return renderMarkdownWithAttachmentSummary\(item\.text \|\| ""\);/);
  assert.doesNotMatch(functionBody("renderItemBody"), /isLiveTurn\(turn\) \? escapeHtml/);
  assert.match(appJs, /function mergeVisibleTextItemPreservingRenderIdentity\(/);
  assert.match(functionBody("mergeVisibleTextItemPreservingRenderIdentity"), /merged\.id = existingItem\.id/);
  assert.match(functionBody("mergeItemsPreservingLocalVisible"), /mergeVisibleTextItemPreservingRenderIdentity\(existingItem, incomingTextMatch\)/);
  assert.match(functionBody("mergeItemsPreservingLocalVisible"), /const addedIncomingItems = new Set\(\)/);
  assert.match(functionBody("mergeItemsPreservingLocalVisible"), /if \(addedIncomingItems\.has\(incomingItem\)\) continue/);
});

test("agent markdown can render uploaded image summaries as thumbnails", () => {
  assert.match(appJs, /function renderMarkdownWithAttachmentSummary\(value\)/);
  assert.match(functionBody("renderMarkdownWithAttachmentSummary"), /splitAttachmentSummaryText\(value \|\| ""\)/);
  assert.match(functionBody("renderMarkdownWithAttachmentSummary"), /renderAttachmentSummary\(split\.attachments\)/);
  assert.match(functionBody("splitAttachmentSummaryText"), /attachmentSummaryMarkerMatch/);
  assert.match(functionBody("splitAttachmentSummaryText"), /stripAttachmentSummaryLinePrefix/);
  assert.match(functionBody("splitAttachmentSummaryText"), /const visibleText = \[before, after\]/);
  assert.match(functionBody("renderAttachmentSummary"), /canRenderImageAttachment/);
  assert.match(functionBody("renderAttachmentSummary"), /renderInputImage\(\{ path: attachment\.path \}, attachment, index\)/);
  assert.match(functionBody("renderItemBody"), /item\.type === "plan"[\s\S]*renderMarkdownWithAttachmentSummary\(item\.text \|\| ""\)/);
});

test("uploaded image summaries parse CRLF and markdown blockquote references", () => {
  const splitAttachmentSummaryText = evaluatedAttachmentSummaryParser();
  const uploadPath = "C:\\Users\\example\\.codex-mobile-web\\uploads\\2026-05-26\\thread-id\\1779810277313-IMG_5430.jpg";
  const line = `- IMG_5430.jpg (image, image/jpeg, 104.1 KB): ${uploadPath}`;
  for (const source of [
    `Uploaded attachments:\r\n${line}`,
    `Before\r\nUploaded attachments:\r\n${line}\r\nAfter`,
    `> Uploaded attachments:\n> ${line}`,
  ]) {
    const split = splitAttachmentSummaryText(source);
    assert.equal(split.attachments.length, 1);
    assert.equal(split.attachments[0].name, "IMG_5430.jpg");
    assert.equal(split.attachments[0].meta, "image, image/jpeg, 104.1 KB");
    assert.equal(split.attachments[0].path, uploadPath);
    assert.equal(split.attachments[0].isImage, true);
  }
});

test("context compaction merge does not preserve stale mobile notices", () => {
  const body = functionBody("mergeItemPreservingVisibleFields");
  assert.match(body, /isContextCompactionItem\(existingItem\) \|\| isContextCompactionItem\(incomingItem\)/);
  assert.match(body, /delete merged\.mobileNotice/);
  assert.match(body, /delete merged\.mobileCompactionStatus/);
  assert.match(body, /else if \(existingItem\.mobileNotice\)/);
});

test("server only emits context compaction notices from explicit item state", () => {
  const itemBody = serverFunctionBody("compactItem");
  const turnBody = serverFunctionBody("compactTurn");
  assert.match(serverJs, /function contextCompactionMobileState\(/);
  assert.match(serverFunctionBody("contextCompactionMobileState"), /options\.contextCompactionPending === true/);
  assert.match(serverFunctionBody("contextCompactionMobileState"), /options\.contextCompactionPending === false/);
  assert.match(serverFunctionBody("contextCompactionMobileState"), /if \(!text\) return ""/);
  assert.match(itemBody, /const compactionState = contextCompactionMobileState\(out, options\)/);
  assert.match(itemBody, /if \(!compactionState\) return compacted/);
  assert.doesNotMatch(itemBody, /options\.contextCompactionPending !== false/);
  assert.doesNotMatch(turnBody, /contextCompactionPending = isLiveTurn\(out\)/);
  assert.match(turnBody, /out\.items = out\.items\.map\(\(item\) => compactItem\(item\)\)/);
});

test("matching user messages keep their original turn position after final refresh", () => {
  const body = functionBody("mergeItemsPreservingLocalVisible");
  assert.match(body, /const incomingUserMatch = \(incomingItems \|\| \[\]\)\.find/);
  assert.match(body, /existingItem\.type === "userMessage"/);
  assert.match(body, /userMessagesLikelySame\(existingItem, incomingItem\)/);
  assert.match(body, /merged\.push\(mergeItemPreservingVisibleFields\(existingItem, incomingUserMatch\)\)/);
  assert.match(body, /addedIncomingItems\.add\(incomingUserMatch\)/);
  assert.match(body, /const incomingTextMatch = incomingUserMatch[\s\S]*visibleTextItemsLikelySame\(existingItem, incomingItem\)/);
});

test("active turn state follows only the latest durable turn", () => {
  const syncBody = functionBody("syncActiveTurnFromThread");
  assert.match(syncBody, /const latest = turns\.length \? turns\[turns\.length - 1\] : null/);
  assert.match(syncBody, /const running = latest && !isTurnComplete\(latest\) && isRunningStatus\(latest\.status\) \? latest : null/);
  assert.doesNotMatch(syncBody, /reverse\(\)\.find/);

  const liveBody = functionBody("currentLiveTurn");
  assert.match(liveBody, /const latest = turns\.length \? turns\[turns\.length - 1\] : null/);
  assert.match(liveBody, /const active = latest && latest\.id === state\.activeTurnId \? latest : null/);
  assert.match(liveBody, /return latest && isLiveTurn\(latest\) \? latest : null/);
  assert.doesNotMatch(liveBody, /reverse\(\)\.find/);
});

test("thread merge drops superseded stale active turns", () => {
  assert.match(appJs, /function turnIsSupersededBy\(/);
  assert.match(functionBody("turnIsSupersededBy"), /return isTurnComplete\(newerTurn\) && !isTurnComplete\(turn\)/);
  assert.match(functionBody("mergeThreadPreservingVisibleItems"), /const latestIncoming = merged\.turns\.length \? merged\.turns\[merged\.turns\.length - 1\] : null/);
  assert.match(functionBody("mergeThreadPreservingVisibleItems"), /if \(turnIsSupersededBy\(existingTurn, latestIncoming\)\) continue/);
});
