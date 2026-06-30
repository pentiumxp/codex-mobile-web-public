"use strict";

const SERVER_REQUEST_METHODS = new Set([
  "item/commandExecution/requestApproval",
  "item/fileChange/requestApproval",
  "item/permissions/requestApproval",
  "item/tool/requestUserInput",
  "item/tool/call",
  "mcpServer/elicitation/request",
  "account/chatgptAuthTokens/refresh",
  "execCommandApproval",
  "applyPatchApproval",
]);
const ACTIONABLE_APPROVAL_METHODS = new Set([
  "item/commandExecution/requestApproval",
  "item/fileChange/requestApproval",
  "item/permissions/requestApproval",
  "execCommandApproval",
  "applyPatchApproval",
]);
const ACTIONABLE_USER_INPUT_METHODS = new Set([
  "item/tool/requestUserInput",
  "mcpServer/elicitation/request",
]);
const ACTIONABLE_SERVER_REQUEST_METHODS = new Set([
  ...ACTIONABLE_APPROVAL_METHODS,
  ...ACTIONABLE_USER_INPUT_METHODS,
]);
const CODEGRAPH_READONLY_MCP_TOOLS = new Set([
  "codegraph_search",
  "codegraph_explore",
  "codegraph_node",
  "codegraph_callers",
]);

function defaultTruncateMiddle(value, maxChars, label = "text") {
  const text = String(value ?? "");
  if (text.length <= maxChars) return text;
  const head = Math.floor(maxChars * 0.42);
  const tail = maxChars - head;
  return `${text.slice(0, head)}\n\n[${label} truncated: ${text.length} chars total, showing first ${head} and last ${tail}]\n\n${text.slice(-tail)}`;
}

function createAppServerRequestPolicyService(options = {}) {
  const truncateMiddle = typeof options.truncateMiddle === "function" ? options.truncateMiddle : defaultTruncateMiddle;
  const compactStructured = typeof options.compactStructured === "function" ? options.compactStructured : (value) => value;

  function compactApprovalText(value, maxChars = 1200) {
    return truncateMiddle(String(value ?? ""), maxChars, "approval text");
  }

  function commandTextFromApproval(method, params = {}) {
    if (method === "execCommandApproval" && Array.isArray(params.command)) return params.command.join(" ");
    if (typeof params.command === "string") return params.command;
    if (Array.isArray(params.commandActions) && params.commandActions.length) {
      return params.commandActions.map((action) => action && action.command).filter(Boolean).join(" && ");
    }
    return "";
  }

  function fileNamesFromApproval(method, params = {}) {
    if (method === "applyPatchApproval" && params.fileChanges && typeof params.fileChanges === "object") {
      return Object.keys(params.fileChanges).slice(0, 12);
    }
    return [];
  }

  function compactUserInputQuestions(params = {}) {
    if (!Array.isArray(params.questions)) return [];
    return params.questions.slice(0, 8).map((question) => {
      const options = Array.isArray(question && question.options)
        ? question.options.slice(0, 12).map((option) => Object.fromEntries(Object.entries({
          label: option && option.label ? compactApprovalText(option.label, 240) : "",
          description: option && option.description ? compactApprovalText(option.description, 500) : "",
        }).filter(([, value]) => value !== "")))
        : [];
      return Object.fromEntries(Object.entries({
        id: question && question.id ? String(question.id) : "",
        header: question && question.header ? compactApprovalText(question.header, 240) : "",
        question: question && question.question ? compactApprovalText(question.question, 1200) : "",
        isOther: Boolean(question && question.isOther),
        options,
      }).filter(([, value]) => {
        if (Array.isArray(value)) return value.length > 0;
        return value !== "" && value !== false;
      }));
    });
  }

  function compactApprovalParams(method, params = {}) {
    return Object.fromEntries(Object.entries({
      threadId: params.threadId || params.conversationId || null,
      turnId: params.turnId || null,
      itemId: params.itemId || params.callId || null,
      approvalId: params.approvalId || null,
      reason: params.reason ? compactApprovalText(params.reason, 900) : null,
      command: commandTextFromApproval(method, params) ? compactApprovalText(commandTextFromApproval(method, params), 1800) : null,
      cwd: params.cwd || null,
      grantRoot: params.grantRoot || null,
      fileNames: fileNamesFromApproval(method, params),
      permissions: method === "item/permissions/requestApproval" ? compactStructured(params.permissions || {}) : null,
      networkApprovalContext: params.networkApprovalContext || null,
      questions: method === "item/tool/requestUserInput" ? compactUserInputQuestions(params) : [],
      elicitationId: method === "mcpServer/elicitation/request" ? params.elicitationId || null : null,
      title: method === "mcpServer/elicitation/request" && params.title ? compactApprovalText(params.title, 240) : null,
      message: method === "mcpServer/elicitation/request" && params.message ? compactApprovalText(params.message, 1200) : null,
      schema: method === "mcpServer/elicitation/request" && params.schema ? compactStructured(params.schema) : null,
      elicitation: method === "mcpServer/elicitation/request" && params.elicitation ? compactStructured(params.elicitation) : null,
    }).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== null && value !== undefined && value !== "";
    }));
  }

  function publicServerRequest(request) {
    return {
      id: String(request.id),
      method: request.method,
      status: request.status || "waiting",
      decision: request.decision || null,
      receivedAt: request.receivedAt || null,
      respondedAt: request.respondedAt || null,
      actionable: ACTIONABLE_SERVER_REQUEST_METHODS.has(request.method),
      params: compactApprovalParams(request.method, request.params || {}),
    };
  }

  function codeGraphMcpElicitationToolName(request) {
    if (!request || request.method !== "mcpServer/elicitation/request") return "";
    const params = request.params && typeof request.params === "object" ? request.params : {};
    const candidates = [
      params.serverName,
      params.server_name,
      params.server,
      params.mcpServer,
      params.mcp_server,
      params.toolName,
      params.tool_name,
      params.name,
      params.title,
      params.message,
      params.elicitation,
      params.schema,
    ];
    const text = candidates.map((value) => (typeof value === "string" ? value : JSON.stringify(value || ""))).join("\n");
    const explicitServer = [params.serverName, params.server_name, params.server, params.mcpServer, params.mcp_server]
      .some((value) => /^codegraph$/i.test(String(value || "").trim()) || /\bcodegraph\b/i.test(String(value || "")));
    const messageMentionsCodeGraphServer = /\bcodegraph\b[\s-]*(?:MCP\s+)?server\b/i.test(text);
    if (!explicitServer && !messageMentionsCodeGraphServer) return "";
    const quoted = /\bcodegraph MCP server\b[\s\S]*?\btool\s+["“]([^"”]+)["”]/i.exec(text);
    const raw = quoted ? quoted[1] : ((/\b(codegraph_[a-z0-9_]+)\b/i.exec(text) || [])[1] || "");
    const toolName = String(raw || "").trim();
    return CODEGRAPH_READONLY_MCP_TOOLS.has(toolName) ? toolName : "";
  }

  function codeGraphReadOnlyMcpElicitationDecision(request) {
    const toolName = codeGraphMcpElicitationToolName(request);
    return toolName ? { action: "allow", toolName } : null;
  }

  function grantedPermissionsFromRequest(params = {}) {
    const permissions = params.permissions || {};
    const granted = {};
    if (permissions.network) granted.network = permissions.network;
    if (permissions.fileSystem) granted.fileSystem = permissions.fileSystem;
    return granted;
  }

  function approvalResponsePayload(request, decision) {
    const method = request && request.method;
    const params = (request && request.params) || {};
    if (!["allow_once", "allow_session", "deny"].includes(decision)) {
      throw new Error("Invalid approval decision");
    }
    if (method === "item/commandExecution/requestApproval") {
      return {
        result: {
          decision: decision === "allow_once" ? "accept" : decision === "allow_session" ? "acceptForSession" : "decline",
        },
      };
    }
    if (method === "item/fileChange/requestApproval") {
      return {
        result: {
          decision: decision === "allow_once" ? "accept" : decision === "allow_session" ? "acceptForSession" : "decline",
        },
      };
    }
    if (method === "execCommandApproval" || method === "applyPatchApproval") {
      return {
        result: {
          decision: decision === "allow_once" ? "approved" : decision === "allow_session" ? "approved_for_session" : "denied",
        },
      };
    }
    if (method === "item/permissions/requestApproval") {
      if (decision === "deny") {
        return { error: { code: -32001, message: "Permission request denied" } };
      }
      return {
        result: {
          permissions: grantedPermissionsFromRequest(params),
          scope: decision === "allow_session" ? "session" : "turn",
          strictAutoReview: false,
        },
      };
    }
    throw new Error(`Unsupported server request method: ${method || "unknown"}`);
  }

  function userInputResponsePayload(request, body = {}) {
    const params = (request && request.params) || {};
    const questions = Array.isArray(params.questions) ? params.questions : [];
    if (body.answers && typeof body.answers === "object") {
      return { result: { answers: body.answers } };
    }
    const responseText = String(body.responseText || body.text || "").trim();
    const questionId = String(body.questionId || (questions[0] && questions[0].id) || "answer");
    return {
      result: {
        answers: responseText ? { [questionId]: { answers: [responseText] } } : {},
      },
    };
  }

  function mcpElicitationResponsePayload(body = {}) {
    const action = body.action === "decline" || body.decision === "deny" ? "decline" : "accept";
    if (action === "decline") return { result: { action, content: null } };
    const responseText = String(body.responseText || body.text || "").trim();
    const result = { action, content: {} };
    if (body.content && typeof body.content === "object") result.content = body.content;
    else if (responseText) result.content = { response: responseText };
    return { result };
  }

  function serverRequestResponsePayload(request, body = {}) {
    const method = request && request.method;
    if (ACTIONABLE_APPROVAL_METHODS.has(method)) {
      return approvalResponsePayload(request, String(body.decision || ""));
    }
    if (method === "item/tool/requestUserInput") return userInputResponsePayload(request, body);
    if (method === "mcpServer/elicitation/request") return mcpElicitationResponsePayload(body);
    throw new Error(`Unsupported server request method: ${method || "unknown"}`);
  }

  function isActionableApprovalMethod(method) {
    return ACTIONABLE_APPROVAL_METHODS.has(method);
  }

  return {
    ACTIONABLE_APPROVAL_METHODS,
    ACTIONABLE_SERVER_REQUEST_METHODS,
    ACTIONABLE_USER_INPUT_METHODS,
    CODEGRAPH_READONLY_MCP_TOOLS,
    SERVER_REQUEST_METHODS,
    approvalResponsePayload,
    codeGraphMcpElicitationToolName,
    codeGraphReadOnlyMcpElicitationDecision,
    compactApprovalParams,
    compactApprovalText,
    isActionableApprovalMethod,
    publicServerRequest,
    serverRequestResponsePayload,
  };
}

module.exports = {
  createAppServerRequestPolicyService,
};
