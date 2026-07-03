"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const appJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "app.js"), "utf8");
const serverJs = fs.readFileSync(path.resolve(__dirname, "..", "server.js"), "utf8");

function functionBody(source, name) {
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
    if (depth === 0) return source.slice(bodyStart + 1, index);
  }
  throw new Error(`could not parse function ${name}`);
}

test("truncated assistant copy buttons fetch full text instead of copying first-paint previews", () => {
  const copyAttrsBody = functionBody(appJs, "fullCopyAttrsForItem");
  assert.match(copyAttrsBody, /itemHasFullCopyTruncation\(item\)/);
  assert.match(copyAttrsBody, /data-full-copy-text/);
  assert.match(copyAttrsBody, /data-full-copy-thread-id/);
  assert.match(copyAttrsBody, /data-full-copy-item-id/);

  const clickBody = functionBody(appJs, "handleCopyButtonClick");
  assert.match(clickBody, /dataset\.fullCopyText === "true"/);
  assert.match(clickBody, /fullCopyTextForButton\(button\)/);
  assert.match(clickBody, /state\.copyTextStore\.set\(key, text\)/);

  const fetchBody = functionBody(appJs, "fullCopyTextForButton");
  assert.match(fetchBody, /\/api\/threads\/\$\{threadId\}\/copy-text/);
  assert.match(fetchBody, /itemId/);
  assert.match(fetchBody, /turnId/);
});

test("user messages expose copy text and use full-copy route when first-paint previewed", () => {
  const copyTextBody = functionBody(appJs, "copyTextForItem");
  assert.match(copyTextBody, /item\.type === "userMessage"\) return copyTextForUserMessage\(item\)/);

  const userCopyBody = functionBody(appJs, "copyTextForUserMessage");
  assert.match(userCopyBody, /item && item\.text/);
  assert.match(userCopyBody, /item && item\.message/);
  assert.match(userCopyBody, /item && item\.input/);
  assert.match(userCopyBody, /item && item\.input_text/);
  assert.match(userCopyBody, /typeof content === "string"/);
  assert.match(userCopyBody, /typeof part === "string"/);
  assert.match(userCopyBody, /isInputTextPart\(part\)/);
  assert.match(userCopyBody, /inputTextValue\(part\)/);
  assert.match(userCopyBody, /values\.join\("\\n\\n"\)/);

  const truncationBody = functionBody(appJs, "itemHasFullCopyTruncation");
  assert.match(truncationBody, /mobileFirstPaintUserInputBudget/);
});

test("server exposes copy-text route that reads unbudgeted thread item text", () => {
  assert.match(serverJs, /\/api\\\/threads\\\/\(\[\^\/\]\+\)\\\/copy-text/);
  assert.match(serverJs, /async function readThreadItemCopyText/);
  assert.match(serverJs, /codexClient\.request\("thread\/read", \{ threadId, includeTurns: true \}/);
  assert.match(serverJs, /appendRolloutFinalReceiptsToThread\(thread\)/);
  assert.match(serverJs, /findThreadCopyText\(thread, input\)/);

  const routeStart = serverJs.indexOf("const threadCopyText = url.pathname.match");
  const routeEnd = serverJs.indexOf("const threadTurns = url.pathname.match", routeStart);
  assert.ok(routeStart > 0 && routeEnd > routeStart, "missing copy-text route");
  const routeBody = serverJs.slice(routeStart, routeEnd);
  assert.match(routeBody, /itemId is required/);
  assert.match(routeBody, /readThreadItemCopyText\(codex, threadId, \{ itemId, turnId \}\)/);
  assert.match(routeBody, /Copy text item not found/);
});

test("server copy-text extraction supports user messages", () => {
  const copyItemBody = functionBody(serverJs, "copyTextFromThreadItem");
  assert.match(copyItemBody, /item\.type === "userMessage"\) return copyTextFromUserMessageItem\(item\)/);

  const userCopyBody = functionBody(serverJs, "copyTextFromUserMessageItem");
  assert.match(userCopyBody, /item && item\.text/);
  assert.match(userCopyBody, /item && item\.message/);
  assert.match(userCopyBody, /item && item\.input/);
  assert.match(userCopyBody, /item && item\.input_text/);
  assert.match(userCopyBody, /typeof \(item && item\.content\) === "string"/);
  assert.match(userCopyBody, /userMessageContentParts\(item\)/);
  assert.match(userCopyBody, /textValueForUserMessagePart\(part\)/);
  assert.match(userCopyBody, /values\.join\("\\n\\n"\)/);

  const partTextBody = functionBody(serverJs, "textValueForUserMessagePart");
  assert.match(partTextBody, /typeof part === "string"/);
  assert.match(partTextBody, /typeof part\.input === "string"/);
});
