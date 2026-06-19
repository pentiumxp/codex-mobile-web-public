"use strict";

const fs = require("node:fs");
const crypto = require("node:crypto");

const SERVER_NAME = "codex-mobile-chatgpt-pro-planner";
const DEFAULT_PROTOCOL_VERSION = "2025-03-26";

function readSecretFile(filePath) {
  const file = String(filePath || "").trim();
  if (!file) return "";
  try {
    return fs.readFileSync(file, "utf8").trim();
  } catch (_) {
    return "";
  }
}

function normalizeToken(value) {
  return String(value || "").trim();
}

function timingSafeEquals(a, b) {
  const left = Buffer.from(String(a || ""), "utf8");
  const right = Buffer.from(String(b || ""), "utf8");
  if (left.length !== right.length) return false;
  if (!left.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function requestBearerToken(req) {
  const auth = String(req && req.headers && req.headers.authorization || "").trim();
  const bearer = auth.match(/^Bearer\s+(.+)$/i);
  if (bearer) return bearer[1].trim();
  return String(
    req && req.headers && (
      req.headers["x-codex-mobile-chatgpt-pro-mcp-key"]
      || req.headers["x-codex-mobile-mcp-key"]
      || req.headers["x-chatgpt-pro-mcp-token"]
    )
    || "",
  ).trim();
}

function textContent(data) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2),
      },
    ],
    structuredContent: data,
  };
}

function jsonRpcResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function jsonRpcError(id, code, message, data) {
  const error = { code, message: String(message || "MCP error") };
  if (data !== undefined) error.data = data;
  return { jsonrpc: "2.0", id: id === undefined ? null : id, error };
}

function publicError(err) {
  const code = err && err.statusCode && err.statusCode >= 400 && err.statusCode < 500 ? -32602 : -32603;
  return {
    code,
    message: err && err.message ? err.message : String(err || "tool_call_failed"),
  };
}

function tool(name, description, inputSchema) {
  return { name, description, inputSchema };
}

function plannerToolDefinitions() {
  return [
    tool("codex_mobile_status", "Return safe Codex Mobile planner connector status.", {
      type: "object",
      additionalProperties: false,
      properties: {},
    }),
    tool("list_visible_workspaces", "List bounded Codex Mobile workspaces visible to the current app.", {
      type: "object",
      additionalProperties: false,
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 100 },
      },
    }),
    tool("read_thread_context", "Read bounded metadata for one visible Codex Mobile thread.", {
      type: "object",
      additionalProperties: false,
      required: ["threadId"],
      properties: {
        threadId: { type: "string", minLength: 1, maxLength: 120 },
      },
    }),
    tool("read_allowed_repo_file", "Read an allowlisted repository documentation file from a visible workspace.", {
      type: "object",
      additionalProperties: false,
      required: ["cwd", "relativePath"],
      properties: {
        cwd: { type: "string", minLength: 1 },
        relativePath: { type: "string", minLength: 1, maxLength: 500 },
        maxChars: { type: "integer", minimum: 1000, maximum: 24000 },
      },
    }),
    tool("create_planner_artifact", "Persist a ChatGPT Pro planner artifact under the Codex Mobile runtime root.", {
      type: "object",
      additionalProperties: false,
      required: ["type", "title", "bodyMarkdown"],
      properties: {
        type: { type: "string", enum: ["analysis", "prd", "sprint", "codex_goal", "review", "task_card_draft"] },
        title: { type: "string", minLength: 1, maxLength: 180 },
        bodyMarkdown: { type: "string", minLength: 1 },
        sourceThreadId: { type: "string", maxLength: 120 },
        cwd: { type: "string" },
        conversationUrl: { type: "string" },
        requestId: { type: "string" },
      },
    }),
    tool("prepare_codex_goal", "Persist a Codex goal artifact for later explicit user application.", {
      type: "object",
      additionalProperties: false,
      required: ["objective"],
      properties: {
        title: { type: "string", maxLength: 180 },
        objective: { type: "string", minLength: 1 },
        constraints: { type: "string" },
        requiredChecks: { type: "string" },
        doneWhen: { type: "string" },
        sourceThreadId: { type: "string", maxLength: 120 },
        cwd: { type: "string" },
        conversationUrl: { type: "string" },
        requestId: { type: "string" },
      },
    }),
    tool("create_task_card_draft", "Persist a cross-thread task-card draft without sending it.", {
      type: "object",
      additionalProperties: false,
      required: ["title", "bodyMarkdown"],
      properties: {
        title: { type: "string", minLength: 1, maxLength: 180 },
        bodyMarkdown: { type: "string", minLength: 1 },
        sourceThreadId: { type: "string", maxLength: 120 },
        cwd: { type: "string" },
        conversationUrl: { type: "string" },
        requestId: { type: "string" },
      },
    }),
    tool("list_planner_artifacts", "List recent ChatGPT Pro planner artifacts.", {
      type: "object",
      additionalProperties: false,
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 100 },
        type: { type: "string", enum: ["analysis", "prd", "sprint", "codex_goal", "review", "task_card_draft"] },
        threadId: { type: "string", maxLength: 120 },
        cwd: { type: "string" },
      },
    }),
    tool("read_planner_artifact", "Read one saved ChatGPT Pro planner artifact.", {
      type: "object",
      additionalProperties: false,
      required: ["id"],
      properties: {
        id: { type: "string", minLength: 1, maxLength: 120 },
      },
    }),
  ];
}

function createChatGptProMcpService(options = {}) {
  const plannerService = options.plannerService;
  const version = String(options.version || "");
  const staticToken = normalizeToken(options.token);
  const tokenFile = String(options.tokenFile || "").trim();
  const protocolVersion = String(options.protocolVersion || DEFAULT_PROTOCOL_VERSION);

  function configuredToken() {
    return staticToken || normalizeToken(readSecretFile(tokenFile));
  }

  function isConfigured() {
    return configuredToken().length >= 16;
  }

  function isAuthorized(req) {
    const expected = configuredToken();
    if (!expected) return false;
    return timingSafeEquals(requestBearerToken(req), expected);
  }

  function status() {
    return {
      ok: true,
      configured: isConfigured(),
      endpoint: "/api/chatgpt-pro/mcp",
      auth: "bearer",
      serverName: SERVER_NAME,
      protocolVersion,
      tools: plannerToolDefinitions().map((entry) => entry.name),
      planner: plannerService.status(),
    };
  }

  async function callTool(name, args = {}) {
    if (!plannerService) throw new Error("planner_service_unavailable");
    if (name === "codex_mobile_status") return plannerService.status();
    if (name === "list_visible_workspaces") return plannerService.listVisibleWorkspaces(args);
    if (name === "read_thread_context") return plannerService.readBoundedThreadContext(args);
    if (name === "read_allowed_repo_file") return plannerService.readAllowedRepoFile(args);
    if (name === "create_planner_artifact") return { ok: true, artifact: plannerService.createPlannerArtifact(args) };
    if (name === "prepare_codex_goal") return { ok: true, artifact: plannerService.prepareCodexGoal(args) };
    if (name === "create_task_card_draft") return { ok: true, artifact: plannerService.createTaskCardDraft(args) };
    if (name === "list_planner_artifacts") return plannerService.listPlannerArtifacts(args);
    if (name === "read_planner_artifact") return plannerService.readPlannerArtifact(args);
    const err = new Error("unknown_tool");
    err.statusCode = 404;
    throw err;
  }

  async function handleOne(message = {}) {
    const id = Object.prototype.hasOwnProperty.call(message, "id") ? message.id : undefined;
    const method = String(message.method || "");
    if (!method) return jsonRpcError(id, -32600, "invalid_request");
    if (method === "notifications/initialized") return null;
    if (method === "initialize") {
      return jsonRpcResult(id, {
        protocolVersion,
        capabilities: {
          tools: {
            listChanged: false,
          },
        },
        serverInfo: {
          name: SERVER_NAME,
          version,
        },
        instructions: [
          "Use this connector only for planning and review artifacts.",
          "Do not ask it to write source code, run shell commands, or start Codex turns.",
          "Create planner artifacts for explicit user application inside Codex Mobile.",
        ].join("\n"),
      });
    }
    if (method === "ping") return jsonRpcResult(id, {});
    if (method === "tools/list") {
      return jsonRpcResult(id, { tools: plannerToolDefinitions() });
    }
    if (method === "tools/call") {
      const params = message.params && typeof message.params === "object" ? message.params : {};
      const name = String(params.name || "");
      const args = params.arguments && typeof params.arguments === "object" ? params.arguments : {};
      try {
        return jsonRpcResult(id, textContent(await callTool(name, args)));
      } catch (err) {
        const error = publicError(err);
        return jsonRpcError(id, error.code, error.message);
      }
    }
    if (method === "resources/list") return jsonRpcResult(id, { resources: [] });
    if (method === "prompts/list") return jsonRpcResult(id, { prompts: [] });
    return jsonRpcError(id, -32601, "method_not_found");
  }

  async function handleJsonRpc(payload) {
    if (Array.isArray(payload)) {
      const responses = [];
      for (const item of payload) {
        const response = await handleOne(item);
        if (response) responses.push(response);
      }
      return responses;
    }
    return handleOne(payload);
  }

  return {
    status,
    isConfigured,
    isAuthorized,
    handleJsonRpc,
    callTool,
    toolDefinitions: plannerToolDefinitions,
  };
}

module.exports = {
  createChatGptProMcpService,
  plannerToolDefinitions,
};
