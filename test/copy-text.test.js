"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const { createThreadDetailCopyTextService } = require("../services/thread-detail/thread-detail-copy-text-service");
const { createThreadCopyTextRouteService } = require("../server-routes/thread-copy-text-route-service");

const root = path.resolve(__dirname, "..");
const settingsRuntimeJs = fs.readFileSync(path.join(root, "public", "settings-runtime.js"), "utf8");
const conversationRenderRuntimeJs = fs.readFileSync(path.join(root, "public", "conversation-render-runtime.js"), "utf8");
const apiDispatchRouteServiceJs = fs.readFileSync(path.join(root, "server-routes", "api-dispatch-route-service.js"), "utf8");
const serverJs = fs.readFileSync(path.join(root, "server.js"), "utf8");

function routeUrl(pathname) {
  return new URL(pathname, "http://127.0.0.1:8787");
}

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

test("thread detail copy-text service reads unbudgeted user message text", async () => {
  const calls = [];
  let backfilled = false;
  const service = createThreadDetailCopyTextService({
    codex: {
      request: async (method, params, options) => {
        calls.push({ method, params, timeoutMs: options.timeoutMs });
        return {
          thread: {
            turns: [{
              id: "turn-1",
              items: [{
                id: "item-1",
                type: "userMessage",
                text: "preview",
                content: [
                  { type: "input_text", content: "full user text" },
                  { input: "second part" },
                ],
              }],
            }],
          },
        };
      },
    },
    appendRolloutFinalReceiptsToThread(thread) {
      backfilled = Boolean(thread);
    },
    readRpcTimeoutMs: 2222,
  });

  const result = await service.readThreadItemCopyText("thread-1", { itemId: "item-1", turnId: "turn-1" });

  assert.deepEqual(calls, [{
    method: "thread/read",
    params: { threadId: "thread-1", includeTurns: true },
    timeoutMs: 2222,
  }]);
  assert.equal(backfilled, true);
  assert.equal(result.text, "preview\n\nfull user text\n\nsecond part");
  assert.equal(result.itemType, "userMessage");
});

test("thread detail copy-text service supports assistant and diagnostic items", () => {
  const service = createThreadDetailCopyTextService();
  assert.deepEqual(service.findThreadCopyText({
    turns: [{
      id: "turn-a",
      items: [{ id: "agent-1", type: "agentMessage", content: [{ text: "full assistant" }] }],
    }],
  }, { itemId: "agent-1" }), {
    text: "full assistant",
    itemId: "agent-1",
    turnId: "turn-a",
    itemType: "agentMessage",
  });
  assert.equal(service.copyTextFromThreadItem({
    id: "diag-1",
    type: "turnDiagnostic",
    title: "Title",
    message: "Message",
  }), "Title\nMessage");
});

test("thread copy-text route validates item id and maps service results", async () => {
  const calls = [];
  const service = createThreadCopyTextRouteService({
    threadDetailCopyTextService: {
      readThreadItemCopyText: async (threadId, input) => {
        calls.push({ threadId, input });
        if (input.itemId === "missing") return null;
        return { text: "full text", itemId: input.itemId, turnId: input.turnId, itemType: "agentMessage" };
      },
    },
  });
  const sent = [];
  const sendJson = (status, body) => sent.push({ status, body });

  await service.handleRoute({ url: routeUrl("/api/threads/thread-1/copy-text"), method: "GET", sendJson });
  await service.handleRoute({ url: routeUrl("/api/threads/thread-1/copy-text?itemId=missing"), method: "GET", sendJson });
  await service.handleRoute({ url: routeUrl("/api/threads/thread-1/copy-text?itemId=item-1&turnId=turn-1"), method: "GET", sendJson });

  assert.deepEqual(sent, [
    { status: 400, body: { ok: false, error: "itemId is required" } },
    { status: 404, body: { ok: false, error: "Copy text item not found" } },
    { status: 200, body: { ok: true, threadId: "thread-1", text: "full text", itemId: "item-1", turnId: "turn-1", itemType: "agentMessage" } },
  ]);
  assert.deepEqual(calls, [
    { threadId: "thread-1", input: { itemId: "missing", turnId: "" } },
    { threadId: "thread-1", input: { itemId: "item-1", turnId: "turn-1" } },
  ]);
});

test("copy-text route is wired through current API dispatch and server composition", () => {
  assert.match(apiDispatchRouteServiceJs, /createThreadCopyTextRouteService/);
  assert.match(apiDispatchRouteServiceJs, /threadCopyTextRouteService\.handleRoute/);
  assert.match(apiDispatchRouteServiceJs, /threadDetailCopyTextService/);
  assert.match(serverJs, /createThreadDetailCopyTextService/);
  assert.match(serverJs, /appendRolloutFinalReceiptsToThread/);
  assert.match(serverJs, /visibleItemId/);
});

test("frontend copy buttons fetch full text when first-paint content was budgeted", () => {
  const copyButtonBody = functionBody(settingsRuntimeJs, "copyButtonHtml");
  assert.match(copyButtonBody, /htmlAttrs\(attrs\)/);
  const clickBody = functionBody(settingsRuntimeJs, "handleCopyButtonClick");
  assert.match(clickBody, /dataset\.fullCopyText === "true"/);
  assert.match(clickBody, /fullCopyTextForButton\(button\)/);
  assert.match(clickBody, /state\.copyTextStore\.set\(key, text\)/);
  const fetchBody = functionBody(settingsRuntimeJs, "fullCopyTextForButton");
  assert.match(fetchBody, /\/api\/threads\/\$\{threadId\}\/copy-text/);
  assert.match(fetchBody, /itemId/);
  assert.match(fetchBody, /turnId/);

  const renderBody = functionBody(conversationRenderRuntimeJs, "renderItem");
  assert.match(renderBody, /fullCopyAttrsForItem\(item, turn, contextThread\)/);
  const injectedBody = functionBody(conversationRenderRuntimeJs, "renderInjectedThreadTaskCardItem");
  assert.match(injectedBody, /fullCopyAttrsForItem\(item, turn, thread\)/);
});

test("frontend copy text supports user messages and truncation metadata", () => {
  const copyTextBody = functionBody(conversationRenderRuntimeJs, "copyTextForItem");
  assert.match(copyTextBody, /item\.type === "userMessage"\) return copyTextForUserMessage\(item\)/);

  const userCopyBody = functionBody(conversationRenderRuntimeJs, "copyTextForUserMessage");
  assert.match(userCopyBody, /item && item\.text/);
  assert.match(userCopyBody, /item && item\.message/);
  assert.match(userCopyBody, /item && item\.input/);
  assert.match(userCopyBody, /item && item\.input_text/);
  assert.match(userCopyBody, /typeof content === "string"/);
  assert.match(userCopyBody, /typeof part === "string"/);
  assert.match(userCopyBody, /isInputTextPart\(part\)/);
  assert.match(userCopyBody, /inputTextValue\(part\)/);

  const truncationBody = functionBody(conversationRenderRuntimeJs, "itemHasFullCopyTruncation");
  assert.match(truncationBody, /mobileFirstPaintTextBudget/);
  assert.match(truncationBody, /mobileActiveTextBudget/);
  assert.match(truncationBody, /mobileFirstPaintUserInputBudget/);
  const attrsBody = functionBody(conversationRenderRuntimeJs, "fullCopyAttrsForItem");
  assert.match(attrsBody, /data-full-copy-text/);
  assert.match(attrsBody, /data-full-copy-thread-id/);
  assert.match(attrsBody, /data-full-copy-item-id/);
});
