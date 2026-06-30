"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  buildChatGptProPrompt,
  createChatGptProBridgeService,
  isChatGptProRequestText,
  stripChatGptProMention,
} = require("../adapters/chatgpt-pro-bridge-service");

const root = path.resolve(__dirname, "..");
const serverJs = fs.readFileSync(path.join(root, "server.js"), "utf8");
const coreApiRouteServiceJs = fs.readFileSync(path.join(root, "adapters", "core-api-route-service.js"), "utf8");
const appJs = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
const packageJson = fs.readFileSync(path.join(root, "package.json"), "utf8");
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");

test("ChatGPT Pro mention parser only triggers explicit Pro requests", () => {
  assert.equal(isChatGptProRequestText("@ChatGPT Pro 生成分析文档"), true);
  assert.equal(isChatGptProRequestText("请用 @ChatGPTPro 分析"), true);
  assert.equal(isChatGptProRequestText("@ChatGPT 普通问题"), false);
  assert.equal(stripChatGptProMention("@ChatGPT Pro 生成分析文档"), "生成分析文档");
});

test("ChatGPT Pro prompt requires Chrome/Pro and forbids impersonation", () => {
  const prompt = buildChatGptProPrompt({
    title: "架构分析",
    prompt: "分析当前改动",
    sourceSummary: "bounded context",
    outputDir: "/tmp/runtime/outputs/chatgpt-pro",
  });
  assert.match(prompt, /use the Chrome plugin \/ Chrome skill/);
  assert.match(prompt, /Do not impersonate ChatGPT Pro output/);
  assert.match(prompt, /Do not read, copy, or expose browser cookies, tokens, passwords/);
  assert.match(prompt, /outputs\/chatgpt-pro/);
  assert.doesNotMatch(prompt, /access_key|auth\.json|cookie=/i);
});

test("ChatGPT Pro bridge creates a dedicated thread and starts one turn", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-chatgpt-pro-"));
  const calls = [];
  const service = createChatGptProBridgeService({
    runtimeRoot: tmp,
    now: () => 1700000000000,
    createThread: async (input) => {
      calls.push(["thread", input]);
      return { threadId: "pro-thread-1", thread: { id: "pro-thread-1" } };
    },
    startTurn: async (input) => {
      calls.push(["turn", input]);
      return { turnId: "turn-1" };
    },
    persistThreadTitle: () => true,
    updateThreadTitle: async () => true,
  });
  const result = await service.start({
    prompt: "@ChatGPT Pro 生成架构分析",
    sourceThreadId: "source-thread-1",
    cwd: "/work/project",
    sourceSummary: "bounded",
  });
  assert.equal(result.ok, true);
  assert.equal(result.proThreadId, "pro-thread-1");
  assert.equal(calls[0][0], "thread");
  assert.equal(calls[1][0], "turn");
  assert.equal(calls[1][1].threadId, "pro-thread-1");
  assert.match(calls[1][1].input[0].text, /生成架构分析/);
  assert.match(calls[1][1].input[0].text, /bounded/);
});

test("server and client wire @ChatGPT Pro without normal message submission", () => {
  assert.match(packageJson, /adapters\/chatgpt-pro-bridge-service\.js/);
  assert.match(packageJson, /adapters\/chatgpt-pro-planner-service\.js/);
  assert.match(packageJson, /adapters\/chatgpt-pro-mcp-service\.js/);
  assert.match(serverJs, /createChatGptProBridgeService/);
  assert.match(serverJs, /createChatGptProPlannerService/);
  assert.match(serverJs, /createChatGptProMcpService/);
  assert.match(serverJs, /\/api\/chatgpt-pro\/status/);
  assert.match(serverJs, /\/api\/chatgpt-pro\/generate/);
  assert.match(serverJs, /\/api\/chatgpt-pro\/planner\/status/);
  assert.match(serverJs, /\/api\/chatgpt-pro\/planner\/artifacts/);
  assert.match(coreApiRouteServiceJs, /\/api\/chatgpt-pro\/mcp/);
  assert.match(serverJs, /CODEX_MOBILE_CHATGPT_PRO_MCP_TOKEN_FILE/);
  assert.match(serverJs, /CODEX_MOBILE_CHATGPT_PRO_MCP_ALLOW_DIRECT_TASK_CARDS/);
  assert.match(serverJs, /delegateTaskCard: async \(input = \{\}\) => createThreadTaskCardsFromSourceThread\(input\.sourceThreadId, input\)/);
  assert.match(serverJs, /allowDirectTaskCards: CHATGPT_PRO_MCP_ALLOW_DIRECT_TASK_CARDS/);
  assert.ok(
    serverJs.indexOf("coreApiRouteService.handlePublicRoute") < serverJs.indexOf("if (!isAuthorized(req))")
      && coreApiRouteServiceJs.includes('url.pathname === "/api/chatgpt-pro/mcp"'),
    "MCP connector route should use its own token before normal browser auth",
  );
  assert.match(serverJs, /chatGptProSourceSummary/);
  assert.match(serverJs, /createThread: async \(\{ cwd \}\) => \{\s*const runtimeSettings = applyPermissionModeOverride\(\{\}, "full", cwd \|\| APP_ROOT\);/);
  assert.match(serverJs, /startTurn: async \(\{ threadId, cwd, input \}\) => \{\s*const runtimeSettings = applyPermissionModeOverride\(await resolveThreadRuntimeSettings\(threadId\), "full", cwd \|\| APP_ROOT\);/);
  assert.doesNotMatch(serverJs, /createThread: async \(\{ cwd \}\) => \{\s*const runtimeSettings = applyPermissionModeOverride\(\{\}, "auto", cwd \|\| APP_ROOT\);/);
  assert.doesNotMatch(serverJs, /startTurn: async \(\{ threadId, cwd, input \}\) => \{\s*const runtimeSettings = applyPermissionModeOverride\(await resolveThreadRuntimeSettings\(threadId\), "auto", cwd \|\| APP_ROOT\);/);
  assert.match(appJs, /function isChatGptProCommandText\(/);
  assert.match(appJs, /async function submitChatGptProRequest\(text, options = \{\}\)/);
  assert.match(appJs, /api\("\/api\/chatgpt-pro\/generate"/);
  assert.match(appJs, /function composerIntentBareTagKind\(/);
  assert.match(appJs, /function openComposerIntentDialog\(/);
  assert.match(appJs, /submitChatGptProRequest\(`\$\{option\.tag\} \$\{body\}`, \{ rethrow: true \}\)/);
  assert.match(appJs, /@ChatGPT Pro/);
  const sendStart = appJs.indexOf("async function sendMessage");
  const sendEnd = appJs.indexOf("async function sendNewThreadMessage", sendStart);
  const sendBody = appJs.slice(sendStart, sendEnd);
  assert.ok(sendBody.indexOf("isChatGptProCommandText(text)") < sendBody.indexOf("sendNewThreadMessage(text"), "Pro command should intercept before new-thread send");
  assert.ok(sendBody.indexOf("isChatGptProCommandText(text)") < sendBody.indexOf("/api/threads/${encodeURIComponent(targetThreadId)}/messages"), "Pro command should intercept before normal message send");
});

test("README documents standalone ChatGPT Pro bridge boundary in Chinese", () => {
  assert.match(readme, /v302/);
  assert.match(readme, /ChatGPT Pro MCP Connector/);
  assert.match(readme, /@ChatGPT Pro/);
  assert.match(readme, /不把这条内容发进当前工作线程/);
  assert.match(readme, /outputs\/chatgpt-pro/);
  assert.match(readme, /CODEX_MOBILE_CHATGPT_PRO_MCP_TOKEN_FILE/);
});
