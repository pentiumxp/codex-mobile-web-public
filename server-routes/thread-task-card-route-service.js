"use strict";

const path = require("node:path");
const { createThreadTaskCardRoutingService } = require("../services/task-cards/thread-task-card-routing-service");
const {
  planHomeAiDeployLaneRouting,
  prioritizeDelegationTargetHints,
} = require("../services/task-cards/thread-task-card-deploy-lane-policy-service");
const {
  threadTaskCardThreadCallIdempotencyKey: canonicalThreadTaskCardThreadCallIdempotencyKey,
} = require("../services/task-cards/task-card-idempotency-service");

function defaultError(statusCode, code, message, details = {}) {
  const err = new Error(message || code || "thread_task_card_error");
  err.statusCode = statusCode || 500;
  err.code = code || err.message;
  err.details = details;
  return err;
}

function createThreadTaskCardRouteService(dependencies = {}) {
  const {
    appRoot = process.cwd(),
    threadTaskCardService,
    threadTaskCardDraftTag = "codex-mobile-thread-task-card-draft",
    threadTaskCardBodyMaxChars = 8_000,
    workspaceDelegationToolNamespace = "codex_mobile",
    workspaceDelegationToolName = "delegate_to_thread",
    taskCardReturnToolName = "return_to_source",
    reasoningEffortOptions = [],
    readRuntimeSettings = () => ({}),
    workspaceDelegationPublicSettings = () => ({ enabled: false }),
    readStateDbThread = () => null,
    readStartedThread = () => null,
    readRolloutSessionFallbackThread = () => null,
    hydrateThreadTitleFromSessionIndex = (thread) => thread,
    readThreadListFallback = () => [],
    visibilityFromGlobalState = () => ({}),
    threadHasArchiveSignal = () => false,
    isHiddenThread = () => false,
    isSubagentThreadSummary = () => false,
    isSideChatSidecarThreadSummary = () => false,
    normalizeFsPath = (value) => String(value || ""),
    threadDisplayTitle = (thread) => String(thread && (thread.name || thread.title || thread.preview || thread.id || "") || ""),
    isRecoverableThreadListTitle = () => false,
    stableTextHash = (value) => String(value || "").length.toString(36),
    truncateSingleLine = (value, maxChars = 96) => {
      const text = String(value || "").replace(/\s+/g, " ").trim();
      return text.length <= maxChars ? text : `${text.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
    },
    truncateToolDescriptionText = truncateSingleLine,
    shortIdentifier = (value) => String(value || "").slice(0, 12),
    pushThreadId = () => "",
    threadIdForTurnId = () => "",
    attachThreadTaskCardsToResult = (result) => result,
    attachPendingServerRequestsToResult = (result) => result,
    httpStatusError = (statusCode, code) => defaultError(statusCode, code, code),
    createTargetError = defaultError,
    logger = console,
  } = dependencies;

  const workspaceDelegationToolFullName = `${workspaceDelegationToolNamespace}.${workspaceDelegationToolName}`;
  const taskCardReturnToolFullName = `${workspaceDelegationToolNamespace}.${taskCardReturnToolName}`;
  const effortOptions = Array.isArray(reasoningEffortOptions) ? reasoningEffortOptions : [];
  let workspaceDelegationTargetHintsCache = { text: "", cachedAt: 0 };

  const threadTaskCardRoutingService = createThreadTaskCardRoutingService({
    normalizeFsPath,
    threadDisplayTitle,
    readThreadListFallback,
    readThreadSummary: (threadId) => readThreadTaskCardTargetSummary(threadId),
    visibilityFromGlobalState,
    threadHasArchiveSignal,
    isHiddenThread,
    isSubagentThreadSummary,
    isSideChatSidecarThreadSummary,
    createError: createTargetError,
  });

  function workspaceDelegationSettings(settings = readRuntimeSettings()) {
    return workspaceDelegationPublicSettings(settings) || { enabled: false };
  }

  function workspaceDelegationTargetHints() {
    const now = Date.now();
    if (workspaceDelegationTargetHintsCache && now - Number(workspaceDelegationTargetHintsCache.cachedAt || 0) < 15_000) {
      return workspaceDelegationTargetHintsCache.text || "";
    }
    try {
      const threads = prioritizeDelegationTargetHints([...threadTaskCardVisibleTargetThreads()])
        .slice(0, 80);
      const lines = [];
      for (const thread of threads) {
        if (!thread || lines.length >= 24) break;
        const id = truncateToolDescriptionText(thread.id || "", 80);
        const title = truncateToolDescriptionText(threadDisplayTitle(thread), 80);
        const cwd = truncateToolDescriptionText(thread.cwd || "", 160);
        if (!id) continue;
        lines.push(`- ${title || id} | id: ${id}${cwd ? ` | cwd: ${cwd}` : ""}`);
      }
      const text = lines.join("\n");
      workspaceDelegationTargetHintsCache = { text, cachedAt: now };
      return text;
    } catch (_) {
      workspaceDelegationTargetHintsCache = { text: "", cachedAt: now };
      return "";
    }
  }

  function workspaceDelegationDynamicToolSpec() {
    const targetHints = workspaceDelegationTargetHints();
    return {
      namespace: workspaceDelegationToolNamespace,
      name: workspaceDelegationToolName,
      description: [
        "Create a Codex Mobile cross-thread task card when the current user request requires work in another Codex thread or workspace.",
        "Mandatory boundary when this tool is available: if the requested implementation, file edit, command execution, test, deployment, or other mutation belongs to a different workspace or thread, call this tool before doing that work.",
        "Do not inspect, cd into, edit, patch, run commands in, test, deploy, or otherwise operate on the other workspace from the current thread. Delegate first, then stop or report the created task card.",
        "If the user requested target-workspace mutation and your local attempt already failed with sandbox, filesystem, permission denied, operation not permitted, cwd, or approval-policy errors, do not retry locally or merely report blocked. Use the source-thread context to decide the exact delegation, then call this tool yourself with the failed intent and exact target.",
        "The server does not auto-create task cards from failure logs; the source model must call this tool so the card preserves source-thread context and intent.",
        "This dynamic tool always creates source-direct cards when workspace delegation is enabled; do not request target-side pending approval from this tool.",
        "Do not use this for ordinary discussion, read-only references that do not require target-workspace inspection, or work that clearly belongs in the current thread workspace.",
        "The model must decide from the user's request whether delegation is required; do not rely on local keyword or path heuristics.",
        "Use only a current non-archived target thread. Archived, deleted, hidden, subagent, or non-detail-readable targetThreadId values are rejected by the server.",
        "Thread identity is the exact targetThreadId. Titles and cwd/workspace values are hints only and must not be treated as stable identity.",
        "Several normal threads may share the same cwd/workspace. Use targetThreadId for the intended thread; title-only routing fails closed when ambiguous.",
        "Use targetWorkspace/cwd only when that workspace has exactly one visible deliverable thread. If multiple visible threads share the cwd, the server rejects the request with target_workspace_ambiguous instead of choosing one.",
        targetHints ? `Visible target hints:\n${targetHints}` : "",
      ].filter(Boolean).join("\n\n"),
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          sourceThreadId: { type: "string", description: "Current source thread id when known. Usually the server can infer this from turnId." },
          targetThreadId: { type: "string", description: "Exact target Codex thread id. Preferred when known." },
          targetThreadIds: { type: "array", items: { type: "string" }, description: "One or more exact target Codex thread ids." },
          targetThreadTitle: { type: "string", description: "Exact visible target thread title when id is not known." },
          targetThreadTitles: { type: "array", items: { type: "string" }, description: "Exact visible target thread titles." },
          targetWorkspace: { type: "string", description: "Exact target workspace cwd/path when title/id is not known." },
          targetCwd: { type: "string", description: "Exact target workspace cwd/path." },
          title: { type: "string", description: "Short task-card title." },
          summary: { type: "string", description: "One-line bounded task summary." },
          body: { type: "string", description: "Full Markdown task body for the target thread." },
          bodyMarkdown: { type: "string", description: "Alias for body." },
          replyToThreadId: { type: "string", description: "Optional terminal-return target thread id. Use when this card is a multi-hop supplement that must return to an original requester instead of the immediate source thread." },
          replyToWorkspaceId: { type: "string", description: "Optional workspace/cwd for replyToThreadId." },
          replyToThreadTitle: { type: "string", description: "Optional display title for replyToThreadId." },
          replyToCardId: { type: "string", description: "Optional originating task-card id; when replyToThreadId is omitted, the service can resolve the terminal-return target from this card." },
          workflowMode: { type: "string", enum: ["manual", "autonomous"], description: "Task-card workflow mode. Default is manual." },
          reasoningEffort: { type: "string", enum: effortOptions, description: "Optional target turn reasoning effort for this injected task card, for example xhigh for deep audits." },
          cardKind: { type: "string", description: "Optional bounded task-card kind, for example plugin_deployment for routine plugin deploy cards." },
          pluginId: { type: "string", description: "Optional Home AI plugin id for routine plugin deployment lane routing, for example codex-mobile-web or movie." },
          category: { type: "string", description: "Optional bounded task-card category." },
          requestId: { type: "string", description: "Optional stable idempotency seed for this tool call." },
        },
        required: ["title", "body"],
      },
      outputSchema: {
        type: "object",
        additionalProperties: true,
        properties: {
          ok: { type: "boolean" },
          cardCount: { type: "integer" },
          direct: { type: "boolean" },
        },
      },
      exposeToContext: true,
      deferLoading: false,
    };
  }

  function taskCardReturnDynamicToolSpec() {
    return {
      namespace: workspaceDelegationToolNamespace,
      name: taskCardReturnToolName,
      description: [
        "Return a received Codex Mobile task card to its source thread when target work is completed, blocked, or redirected.",
        "Use this for task-card closure. A plain final answer in the target thread is not a source-thread return card.",
        "The original injected task-card message contains `Task card id`; pass that value as `taskCardId`.",
        "The server validates that the current target thread is allowed to return the card and creates the reverse-direction return card through the normal task-card reply service.",
        "Do not use this to delegate new work. Use codex_mobile.delegate_to_thread for new cross-thread work when that tool is available.",
      ].join("\n\n"),
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          taskCardId: { type: "string", description: "Original task-card id shown in the injected card message." },
          threadId: { type: "string", description: "Current target thread id. Usually the server can infer this from turnId." },
          status: {
            type: "string",
            enum: ["completed", "blocked", "redirected", "rejected", "partially_completed"],
            description: "Closure status for the source thread.",
          },
          title: { type: "string", description: "Short return-card title." },
          summary: { type: "string", description: "One-line bounded return summary." },
          body: { type: "string", description: "Full Markdown return body for the source thread." },
          bodyMarkdown: { type: "string", description: "Alias for body." },
          requestId: { type: "string", description: "Optional stable idempotency seed for this return." },
          idempotencyKey: { type: "string", description: "Explicit return-card idempotency key." },
        },
        required: ["taskCardId", "title", "body"],
      },
      outputSchema: {
        type: "object",
        additionalProperties: true,
        properties: {
          ok: { type: "boolean" },
          taskCardId: { type: "string" },
          replyCardId: { type: "string" },
        },
      },
      exposeToContext: true,
      deferLoading: false,
    };
  }

  function taskCardRuntimeDynamicTools(settings = readRuntimeSettings()) {
    const tools = [taskCardReturnDynamicToolSpec()];
    if (workspaceDelegationSettings(settings).enabled) tools.push(workspaceDelegationDynamicToolSpec());
    return tools;
  }

  function workspaceDelegationDynamicTools(settings = readRuntimeSettings()) {
    return workspaceDelegationSettings(settings).enabled
      ? [workspaceDelegationDynamicToolSpec()]
      : [];
  }

  function attachTaskCardRuntimeDynamicTools(params, settings = readRuntimeSettings()) {
    if (!params || typeof params !== "object") return params;
    const tools = taskCardRuntimeDynamicTools(settings);
    if (!tools.length) return params;
    const existing = Array.isArray(params.dynamicTools)
      ? params.dynamicTools.filter(Boolean)
      : params.dynamicTools ? [params.dynamicTools] : [];
    const seen = new Set(existing.map((tool) => `${tool && tool.namespace || ""}.${tool && tool.name || ""}`));
    for (const tool of tools) {
      const key = `${tool.namespace}.${tool.name}`;
      if (!seen.has(key)) {
        existing.push(tool);
        seen.add(key);
      }
    }
    params.dynamicTools = existing;
    return params;
  }

  function appendDeveloperInstructions(params, instructions, marker) {
    if (!params || typeof params !== "object") return params;
    const text = String(instructions || "").trim();
    if (!text) return params;
    const existing = String(params.developerInstructions || "").trim();
    if (marker && existing.includes(marker)) return params;
    params.developerInstructions = existing ? `${existing}\n\n${text}` : text;
    return params;
  }

  function workspaceDelegationScriptFallbackInstruction(params = {}) {
    const sourceThreadId = String(params && params.threadId || "").trim();
    const scriptPath = path.join(appRoot, "scripts", "create-thread-task-card.js");
    return [
      "Codex Mobile cross-thread delegation fallback:",
      `- Prefer the app-server dynamic tool \`${workspaceDelegationToolFullName}\` when it is visible.`,
      "- App-server dynamic tools may not appear in deferred tool discovery such as `tool_search`; absence there is not proof that delegation is unavailable.",
      "- If no direct callable `codex_mobile.delegate_to_thread` tool surface is visible, use the local script below as the first-class fallback path:",
      `  node ${JSON.stringify(scriptPath)} --source-thread ${sourceThreadId || "<current-thread-id>"} --target-thread <target-thread-id-or-exact-title> --title \"<short title>\" --body-file <markdown-file>`,
      "- `multi_agent_v1.spawn_agent`, `multi_agent_v1.resume`, `multi_agent_v1.send`, and `multi_agent_v1.close` are not Codex Mobile task-card APIs and must not be used as a substitute for cross-workspace file changes.",
      "- When the user requested another workspace/thread to be modified, tested, deployed, or otherwise mutated, do not retry a guarded local write after sandbox/permission/cwd/approval failure. Delegate through the dynamic tool or this script and then report the created card.",
      "- The server does not create task cards from failure logs in the background; the source thread model must create the card so the body preserves source-thread context and intent.",
    ].join("\n");
  }

  function taskCardReturnScriptFallbackInstruction(params = {}) {
    const threadId = String(params && params.threadId || "").trim();
    const scriptPath = path.join(appRoot, "scripts", "return-thread-task-card.js");
    return [
      "Codex Mobile task-card return fallback:",
      `- Prefer the app-server dynamic tool \`${taskCardReturnToolFullName}\` when it is visible.`,
      "- A local final answer in the target thread is not a source-thread return card.",
      "- If no direct callable `codex_mobile.return_to_source` tool surface is visible, use the local script below as the first-class return path:",
      `  node ${JSON.stringify(scriptPath)} --task-card <task-card-id> --thread ${threadId || "<current-target-thread-id>"} --status completed --title "<short return title>" --body-file <markdown-file>`,
      "- Use status `completed`, `blocked`, or `redirected` to close the task-card workflow.",
    ].join("\n");
  }

  function attachWorkspaceDelegationRuntimeGuidance(params, settings = readRuntimeSettings()) {
    attachTaskCardRuntimeDynamicTools(params, settings);
    appendDeveloperInstructions(
      params,
      taskCardReturnScriptFallbackInstruction(params),
      "Codex Mobile task-card return fallback:",
    );
    if (workspaceDelegationSettings(settings).enabled) {
      appendDeveloperInstructions(
        params,
        workspaceDelegationScriptFallbackInstruction(params),
        "Codex Mobile cross-thread delegation fallback:",
      );
    }
    return params;
  }

  function normalizeThreadTaskCardWorkflowMode(value) {
    const mode = String(value || "").trim().toLowerCase();
    if (mode === "autonomous" || mode === "auto" || mode === "automatic") return "autonomous";
    return "manual";
  }

  function normalizeThreadTaskCardReasoningEffort(value) {
    const effort = String(value || "").trim().toLowerCase();
    if (!effort) return "";
    return effortOptions.includes(effort) ? effort : "";
  }

  function uniqueThreadTaskCardTargetIds(values, fallback = "") {
    const raw = Array.isArray(values) ? values : [values, fallback];
    const seen = new Set();
    const out = [];
    for (const value of raw) {
      const id = String(value || "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
    return out;
  }

  function threadTaskCardTargetReferenceText(value) {
    return threadTaskCardRoutingService.targetReferenceText(value);
  }

  function threadTaskCardTargetReferenceEntry(kind, value) {
    return threadTaskCardRoutingService.targetReferenceEntry(kind, value);
  }

  function threadTaskCardTargetReferenceEntries(body = {}) {
    return threadTaskCardRoutingService.targetReferenceEntries(body);
  }

  function threadTaskCardTargetReferences(body = {}) {
    return threadTaskCardRoutingService.targetReferences(body);
  }

  function isThreadIdLike(value) {
    return threadTaskCardRoutingService.isThreadIdLike(value);
  }

  function threadTaskCardTargetUpdatedAt(thread) {
    return threadTaskCardRoutingService.targetUpdatedAt(thread);
  }

  function publicThreadTaskCardTarget(thread) {
    return threadTaskCardRoutingService.publicTarget(thread);
  }

  function threadTaskCardTargetError(code, message, details = {}, statusCode = 400) {
    return threadTaskCardRoutingService.targetError(code, message, details, statusCode);
  }

  function threadTaskCardTargetVisibility(options = {}) {
    return threadTaskCardRoutingService.targetVisibility(options);
  }

  function threadTaskCardVisibleTargetThreads(options = {}) {
    return threadTaskCardRoutingService.visibleTargetThreads(options);
  }

  function threadTaskCardCanonicalTargetForCwd(cwd, visibleThreads = []) {
    return threadTaskCardRoutingService.canonicalTargetForCwd(cwd, visibleThreads);
  }

  function threadTaskCardCanonicalTargetForThread(thread, visibleThreads = []) {
    return threadTaskCardRoutingService.canonicalTargetForThread(thread, visibleThreads);
  }

  function threadTaskCardCanonicalVisibleTargets(visibleThreads = []) {
    return threadTaskCardRoutingService.canonicalVisibleTargets(visibleThreads);
  }

  function readThreadTaskCardTargetSummary(threadId, options = {}) {
    if (typeof options.readThreadSummary === "function") return options.readThreadSummary(threadId);
    return readStateDbThread(threadId) || readStartedThread(threadId) || readRolloutSessionFallbackThread(threadId);
  }

  function readThreadTaskCardVisibleTargetSummary(threadId) {
    const id = String(threadId || "").trim();
    if (!id) return null;
    const visibleThreads = threadTaskCardVisibleTargetThreads();
    return (Array.isArray(visibleThreads) ? visibleThreads : [])
      .find((thread) => String(thread && (thread.id || thread.threadId || "") || "").trim() === id) || null;
  }

  function readThreadTaskCardExecutionTargetSummary(card) {
    const target = card && card.target && typeof card.target === "object" ? card.target : {};
    const threadId = String(target.threadId || "").trim();
    const stored = readThreadTaskCardTargetSummary(threadId) || null;
    const visible = readThreadTaskCardVisibleTargetSummary(threadId) || null;
    const merged = Object.assign({}, stored || {}, target, visible || {});
    if (!String(merged.id || "").trim()) merged.id = threadId;
    if (!String(merged.threadId || "").trim()) merged.threadId = threadId;
    const targetWorkspace = String(target.workspaceId || target.workspace || "").trim();
    if (!String(merged.cwd || "").trim() && targetWorkspace) merged.cwd = targetWorkspace;
    const visibleTitle = String(visible && (visible.name || visible.title || visible.threadName || visible.thread_name || visible.preview || "") || "").trim();
    const storedTitle = String(stored && (stored.name || stored.title || stored.threadName || stored.thread_name || stored.preview || "") || "").trim();
    const targetTitle = String(target.name || target.title || target.threadName || target.thread_name || target.preview || "").trim();
    const title = visibleTitle || storedTitle || targetTitle;
    if (title) {
      if (visibleTitle) {
        merged.title = title;
        merged.name = title;
        merged.preview = title;
      } else {
        if (!String(merged.title || "").trim()) merged.title = title;
        if (!String(merged.name || "").trim()) merged.name = title;
        if (!String(merged.preview || "").trim()) merged.preview = title;
      }
    }
    return merged;
  }

  function taskCardPayloadTargetThreads(targetThreadIds = [], readThreadSummary = readThreadTaskCardTargetSummary) {
    return (Array.isArray(targetThreadIds) ? targetThreadIds : [])
      .map((threadId) => {
        const id = String(threadId || "").trim();
        if (!id) return null;
        return readThreadSummary(id) || { id };
      })
      .filter(Boolean);
  }

  function applyHomeAiDeployLaneRoutingPolicy(payload = {}, sourceSummary = null, options = {}) {
    const readThreadSummary = typeof options.readThreadSummary === "function"
      ? options.readThreadSummary
      : readThreadTaskCardTargetSummary;
    const sourceThread = Object.assign({}, sourceSummary || {}, {
      cwd: (sourceSummary && sourceSummary.cwd)
        || payload.sourceWorkspaceId
        || payload.sourceWorkspace
        || "",
    });
    const targetThreadIds = uniqueThreadTaskCardTargetIds(payload.targetThreadIds, payload.targetThreadId);
    const targetThreads = taskCardPayloadTargetThreads(targetThreadIds, readThreadSummary);
    const plan = planHomeAiDeployLaneRouting({
      body: payload,
      sourceThread,
      targetThreads,
      visibleThreads: threadTaskCardVisibleTargetThreads(),
    });
    if (plan.action === "reject") {
      throw threadTaskCardTargetError(
        plan.code || "deploy_lane_required",
        plan.message || "Routine plugin deployment cards must target a live configured deploy lane.",
        {
          reason: plan.reason || "deploy_lane_required",
          sourceThreadId: payload.sourceThreadId || "",
          targetThreadIds,
          pluginId: plan.pluginId || "",
          expectedDeployLaneTitle: plan.expectedDeployLaneTitle || "",
          duplicateTitles: plan.duplicateTitles || undefined,
          deployLane: plan.deployLane ? publicThreadTaskCardTarget(plan.deployLane) : undefined,
        },
        409,
      );
    }
    if (plan.action !== "retarget") return payload;
    const nextTargetThreadIds = uniqueThreadTaskCardTargetIds(plan.targetThreadIds);
    const targetWorkspaceIds = Object.assign({}, payload.targetWorkspaceIds && typeof payload.targetWorkspaceIds === "object" ? payload.targetWorkspaceIds : {});
    const deployLaneCwd = plan.deployLane && plan.deployLane.cwd || "";
    for (const id of nextTargetThreadIds) {
      if (id && !targetWorkspaceIds[id]) targetWorkspaceIds[id] = deployLaneCwd || payload.targetWorkspaceId || payload.targetWorkspace || "";
    }
    return Object.assign({}, payload, {
      targetThreadId: nextTargetThreadIds[0] || payload.targetThreadId,
      targetThreadIds: nextTargetThreadIds,
      targetWorkspaceIds,
      mobileDeployLaneRouting: {
        reason: plan.reason,
        targetThreadId: plan.deployLane && plan.deployLane.id || "",
        targetThreadTitle: plan.deployLane ? threadDisplayTitle(plan.deployLane) : "",
      },
    });
  }

  function assertThreadTaskCardTargetDeliverable(thread, details = {}, options = {}) {
    return threadTaskCardRoutingService.assertTargetDeliverable(thread, details, options);
  }

  function resolveThreadTaskCardTargetReference(value, sourceThreadId = "", options = {}) {
    return threadTaskCardRoutingService.resolveTargetReference(value, sourceThreadId, options);
  }

  function resolvedThreadTaskCardTargetIds(body = {}, sourceThreadId = "", options = {}) {
    return threadTaskCardRoutingService.resolvedTargetIds(body, sourceThreadId, options);
  }

  function threadTaskCardThreadCallIdempotencyKey(sourceThreadId, body = {}, targetThreadIds = []) {
    return canonicalThreadTaskCardThreadCallIdempotencyKey(sourceThreadId, body, targetThreadIds, {
      stableTextHash,
      normalizeReasoningEffort: normalizeThreadTaskCardReasoningEffort,
      normalizeWorkflowMode: normalizeThreadTaskCardWorkflowMode,
    });
  }

  function taskCardSourceThreadTitle(sourceThreadId, requestedTitle = "", sourceSummary = null) {
    const id = String(sourceThreadId || "").trim();
    const requested = String(requestedTitle || "").trim();
    if (requested && !isRecoverableThreadListTitle(requested, id)) return requested;
    const title = threadDisplayTitle(hydrateThreadTitleFromSessionIndex(sourceSummary || (id ? { id } : null)));
    return title || id;
  }

  function buildThreadTaskCardCreatePayload(body = {}, sourceThreadId = "", options = {}) {
    const sourceId = String(sourceThreadId || body.sourceThreadId || "").trim();
    if (body.sourceThreadId && String(body.sourceThreadId || "").trim() !== sourceId) {
      throw httpStatusError(400, "source_thread_id_mismatch");
    }
    const readThreadSummary = typeof options.readThreadSummary === "function"
      ? options.readThreadSummary
      : (threadId) => readThreadTaskCardTargetSummary(threadId) || null;
    const sourceSummary = hydrateThreadTitleFromSessionIndex(
      readThreadSummary(sourceId) || (sourceId ? { id: sourceId } : null),
    );
    let targetThreadIds = resolvedThreadTaskCardTargetIds(body, sourceId, options);
    if (!targetThreadIds.length) {
      throw threadTaskCardTargetError(
        "target_thread_required",
        "A visible target thread id, exact visible thread title, or exact target workspace cwd is required.",
        { sourceThreadId: sourceId },
        400,
      );
    }
    const routingPayload = applyHomeAiDeployLaneRoutingPolicy(Object.assign({}, body, {
      sourceThreadId: sourceId,
      sourceWorkspaceId: body.sourceWorkspaceId || body.sourceWorkspace || (sourceSummary && sourceSummary.cwd) || "",
      targetThreadIds,
    }), sourceSummary, { readThreadSummary });
    targetThreadIds = uniqueThreadTaskCardTargetIds(routingPayload.targetThreadIds, routingPayload.targetThreadId);
    const targetWorkspaceIds = Object.assign({}, body.targetWorkspaceIds && typeof body.targetWorkspaceIds === "object" ? body.targetWorkspaceIds : {});
    Object.assign(targetWorkspaceIds, routingPayload.targetWorkspaceIds && typeof routingPayload.targetWorkspaceIds === "object" ? routingPayload.targetWorkspaceIds : {});
    for (const targetThreadId of targetThreadIds) {
      if (!targetThreadId || targetWorkspaceIds[targetThreadId]) continue;
      const targetSummary = readThreadSummary(targetThreadId);
      targetWorkspaceIds[targetThreadId] = body.targetWorkspaceId || body.targetWorkspace || (targetSummary && targetSummary.cwd) || "";
    }
    const rawBody = String(body.body || body.bodyMarkdown || body.message || "").trim();
    const cardBody = truncateThreadTaskCardBody(rawBody);
    const reasoningEffort = normalizeThreadTaskCardReasoningEffort(body.reasoningEffort || body.reasoning_effort || body.effort);
    if ((body.reasoningEffort || body.reasoning_effort || body.effort) && !reasoningEffort) {
      throw httpStatusError(400, "reasoning_effort_invalid");
    }
    return Object.assign({}, body, {
      sourceThreadId: sourceId,
      sourceTurnId: body.sourceTurnId || body.turnId || "",
      sourceWorkspaceId: body.sourceWorkspaceId || body.sourceWorkspace || (sourceSummary && sourceSummary.cwd) || "",
      sourceThreadTitle: taskCardSourceThreadTitle(sourceId, body.sourceThreadTitle, sourceSummary),
      targetThreadIds,
      targetWorkspaceIds,
      idempotencyKey: threadTaskCardThreadCallIdempotencyKey(sourceId, body, targetThreadIds),
      format: body.format || "markdown",
      title: body.title,
      summary: body.summary || summarizeTaskCardText(cardBody),
      body: cardBody,
      reasoningEffort,
      mobileDeployLaneRouting: routingPayload.mobileDeployLaneRouting,
    });
  }

  async function createThreadTaskCardsFromSourceThread(sourceThreadId, body = {}, options = {}) {
    const payload = buildThreadTaskCardCreatePayload(body, sourceThreadId, options);
    const service = options.threadTaskCardService || threadTaskCardService;
    const cards = await service.createMany(payload);
    const workspaceDelegation = options.workspaceDelegation || workspaceDelegationSettings();
    const autoApprove = workspaceDelegation.enabled
      && body.autoApprove !== false
      && body.direct !== false
      && body.pending !== true;
    const approvals = [];
    if (autoApprove) {
      for (const card of cards) {
        approvals.push(await service.approveFromSource(card.id, payload.sourceThreadId));
      }
    }
    const publicCards = autoApprove
      ? approvals.map((entry) => entry && entry.card).filter(Boolean)
      : cards;
    return {
      ok: true,
      sourceThreadId: payload.sourceThreadId,
      direct: autoApprove,
      autoApprove,
      workspaceDelegationEnabled: workspaceDelegation.enabled,
      card: publicCards[0] || null,
      cards: publicCards,
      approvals,
    };
  }

  function parseDynamicToolArguments(value) {
    if (!value) return {};
    if (typeof value === "object" && !Array.isArray(value)) return value;
    if (typeof value !== "string") return {};
    const text = value.trim();
    if (!text) return {};
    try {
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function dynamicToolCallIdentity(params = {}) {
    const namespace = String(params.namespace || params.toolNamespace || params.dynamicToolNamespace || "").trim();
    const name = String(params.name || params.toolName || params.tool || params.action || "").trim();
    const fullName = String(params.fullName || params.toolFullName || params.dynamicTool || "").trim();
    return {
      namespace,
      name,
      fullName: fullName || (namespace && name ? `${namespace}.${name}` : name),
    };
  }

  function isWorkspaceDelegationDynamicToolCall(params = {}, args = {}) {
    const identity = dynamicToolCallIdentity(params);
    if (identity.fullName) return identity.fullName === workspaceDelegationToolFullName;
    if (identity.namespace || identity.name) {
      return identity.namespace === workspaceDelegationToolNamespace && identity.name === workspaceDelegationToolName;
    }
    const references = threadTaskCardTargetReferences(args);
    return Boolean(references.length && (args.title || args.body || args.bodyMarkdown || args.message));
  }

  function workspaceDelegationDynamicToolCallDiagnostics(request, params = {}, args = {}, extra = {}) {
    const identity = dynamicToolCallIdentity(params);
    const argKeys = Object.keys(args || {})
      .filter((key) => !["body", "bodyMarkdown", "message"].includes(key))
      .sort()
      .slice(0, 30);
    return Object.assign({
      requestId: shortIdentifier(request && request.id),
      tool: truncateToolDescriptionText(identity.fullName || identity.name || "", 160),
      namespace: truncateToolDescriptionText(identity.namespace || "", 80),
      name: truncateToolDescriptionText(identity.name || "", 80),
      isWorkspaceDelegationTool: isWorkspaceDelegationDynamicToolCall(params, args),
      workspaceDelegationEnabled: workspaceDelegationSettings().enabled,
      sourceThreadId: truncateToolDescriptionText(sourceThreadIdFromDynamicToolCall(params, args), 80),
      turnId: truncateToolDescriptionText(params.turnId || params.turn_id || "", 80),
      callId: truncateToolDescriptionText(params.callId || params.call_id || "", 80),
      targetRefCount: threadTaskCardTargetReferences(args).length,
      argKeys,
      hasBody: Boolean(String(args.body || args.bodyMarkdown || args.message || "").trim()),
    }, extra);
  }

  function logWorkspaceDelegationDynamicToolCall(request, params = {}, args = {}, extra = {}) {
    try {
      logger.log(`[workspace-delegation-tool-call] ${JSON.stringify(workspaceDelegationDynamicToolCallDiagnostics(request, params, args, extra))}`);
    } catch (err) {
      logger.error(`[workspace-delegation-tool-call] failed to summarize request=${shortIdentifier(request && request.id)}: ${err.message || String(err)}`);
    }
  }

  function dynamicToolTextResponse(text, options = {}) {
    const success = options && typeof options.success === "boolean" ? options.success : true;
    return {
      result: {
        success,
        contentItems: [
          {
            type: "inputText",
            text: String(text || ""),
          },
        ],
      },
    };
  }

  function dynamicToolJsonResponse(payload, options = {}) {
    return dynamicToolTextResponse(JSON.stringify(payload, null, 2), options);
  }

  function sourceThreadIdFromDynamicToolCall(params = {}, args = {}) {
    const fromParams = pushThreadId(params);
    if (fromParams) return fromParams;
    const turnId = String((params && (params.turnId || params.turn_id))
      || (params && params.turn && (params.turn.id || params.turn.turnId || params.turn.turn_id))
      || "").trim();
    const inferred = turnId ? String(threadIdForTurnId(turnId) || "") : "";
    if (inferred) return inferred;
    return String(args.sourceThreadId || args.source_thread_id || "").trim();
  }

  function actorThreadIdFromDynamicToolCall(params = {}, args = {}) {
    const fromParams = pushThreadId(params);
    if (fromParams) return fromParams;
    const turnId = String((params && (params.turnId || params.turn_id))
      || (params && params.turn && (params.turn.id || params.turn.turnId || params.turn.turn_id))
      || "").trim();
    const inferred = turnId ? String(threadIdForTurnId(turnId) || "") : "";
    if (inferred) return inferred;
    return String(args.threadId || args.thread_id || args.actorThreadId || args.actor_thread_id || "").trim();
  }

  function dynamicToolErrorPayload(code, message, extra = {}) {
    return dynamicToolJsonResponse(Object.assign({
      ok: false,
      error: code,
      message: String(message || code || "dynamic_tool_error"),
    }, extra), { success: false });
  }

  function isTaskCardReturnDynamicToolCall(params = {}) {
    const identity = dynamicToolCallIdentity(params);
    if (identity.fullName) return identity.fullName === taskCardReturnToolFullName;
    if (identity.namespace || identity.name) {
      return identity.namespace === workspaceDelegationToolNamespace && identity.name === taskCardReturnToolName;
    }
    return false;
  }

  function normalizedTaskCardReturnStatus(value) {
    const status = String(value || "").trim().toLowerCase();
    if (!status) return "";
    return ["completed", "blocked", "redirected", "rejected", "partially_completed"].includes(status) ? status : "";
  }

  function taskCardReturnIdempotencyKey(taskCardId, actorThreadId, body = {}) {
    const explicit = String(body.idempotencyKey || "").trim();
    if (explicit) return explicit;
    const requestId = String(body.requestId || body.request_id || "").trim();
    const seed = requestId || JSON.stringify({
      taskCardId,
      actorThreadId,
      status: normalizedTaskCardReturnStatus(body.status),
      title: String(body.title || "").trim(),
      summary: String(body.summary || "").trim(),
      body: String(body.body || body.bodyMarkdown || body.message || "").trim(),
    });
    return `task-card-return:${stableTextHash(`${taskCardId}|${actorThreadId}`)}:${stableTextHash(seed)}`;
  }

  function taskCardReturnDynamicToolBody(params = {}, args = {}) {
    const taskCardId = String(args.taskCardId || args.task_card_id || args.cardId || args.card_id || "").trim();
    const actorThreadId = actorThreadIdFromDynamicToolCall(params, args);
    const rawBody = String(args.body || args.bodyMarkdown || args.message || "").trim();
    const status = normalizedTaskCardReturnStatus(args.status);
    const title = String(args.title || "").trim();
    return {
      taskCardId,
      actorThreadId,
      body: {
        threadId: actorThreadId,
        status,
        returnToSource: true,
        title: /^Return:/i.test(title) ? title : `Return: ${title || status || "task card"}`,
        summary: String(args.summary || "").trim() || status,
        body: truncateThreadTaskCardBody(rawBody),
        format: args.format || "markdown",
        idempotencyKey: taskCardReturnIdempotencyKey(taskCardId, actorThreadId, args),
      },
    };
  }

  function logTaskCardReturnDynamicToolCall(request, params = {}, args = {}, extra = {}) {
    try {
      logger.log(`[task-card-return-tool-call] ${JSON.stringify(Object.assign({
        requestId: shortIdentifier(request && request.id),
        tool: truncateToolDescriptionText(dynamicToolCallIdentity(params).fullName || taskCardReturnToolFullName, 160),
        actorThreadId: truncateToolDescriptionText(actorThreadIdFromDynamicToolCall(params, args), 80),
        turnId: truncateToolDescriptionText(params.turnId || params.turn_id || "", 80),
        callId: truncateToolDescriptionText(params.callId || params.call_id || "", 80),
        taskCardId: truncateToolDescriptionText(args.taskCardId || args.task_card_id || args.cardId || args.card_id || "", 80),
        status: truncateToolDescriptionText(args.status || "", 40),
        hasBody: Boolean(String(args.body || args.bodyMarkdown || args.message || "").trim()),
      }, extra))}`);
    } catch (err) {
      logger.error(`[task-card-return-tool-call] failed to summarize request=${shortIdentifier(request && request.id)}: ${err.message || String(err)}`);
    }
  }

  function workspaceDelegationDynamicToolBody(params = {}, args = {}) {
    const sourceThreadId = sourceThreadIdFromDynamicToolCall(params, args);
    const body = Object.assign({}, args);
    body.sourceThreadId = sourceThreadId;
    body.sourceTurnId = body.sourceTurnId || body.turnId || params.turnId || params.turn_id || "";
    body.requestId = body.requestId || body.request_id || "";
    if (!body.body && body.bodyMarkdown) body.body = body.bodyMarkdown;
    body.direct = true;
    body.autoApprove = true;
    body.pending = false;
    return body;
  }

  async function dynamicToolServerRequestResponsePayload(request) {
    const params = request && request.params && typeof request.params === "object" ? request.params : {};
    const args = parseDynamicToolArguments(params.arguments || params.input || params.args);
    if (isTaskCardReturnDynamicToolCall(params)) {
      const prepared = taskCardReturnDynamicToolBody(params, args);
      if (!prepared.taskCardId) {
        logTaskCardReturnDynamicToolCall(request, params, args, { outcome: "task_card_id_required" });
        return dynamicToolErrorPayload("task_card_id_required", "Original task card id is required for return_to_source.");
      }
      if (!prepared.actorThreadId) {
        logTaskCardReturnDynamicToolCall(request, params, args, { outcome: "actor_thread_id_required" });
        return dynamicToolErrorPayload(
          "actor_thread_id_required",
          "Codex Mobile could not infer the target thread id for this return card.",
          { turnId: params.turnId || params.turn_id || "" },
        );
      }
      if (args.status && !prepared.body.status) {
        logTaskCardReturnDynamicToolCall(request, params, args, { outcome: "status_invalid" });
        return dynamicToolErrorPayload("status_invalid", "Return status must be completed, blocked, redirected, rejected, or partially_completed.");
      }
      if (!String(args.title || "").trim()) {
        logTaskCardReturnDynamicToolCall(request, params, args, { outcome: "return_title_required" });
        return dynamicToolErrorPayload("return_title_required", "Return-card title is required.");
      }
      if (!String(args.body || args.bodyMarkdown || args.message || "").trim()) {
        logTaskCardReturnDynamicToolCall(request, params, args, { outcome: "return_body_required" });
        return dynamicToolErrorPayload("return_body_required", "Return-card body is required.");
      }
      const result = await threadTaskCardService.reply(prepared.taskCardId, prepared.actorThreadId, prepared.body);
      logTaskCardReturnDynamicToolCall(request, params, args, {
        outcome: "ok",
        replyCardId: result && result.replyCard && result.replyCard.id || "",
      });
      return dynamicToolJsonResponse({
        ok: true,
        tool: taskCardReturnToolFullName,
        taskCardId: prepared.taskCardId,
        actorThreadId: prepared.actorThreadId,
        originalCardStatus: result && result.card && result.card.status || "",
        replyCardId: result && result.replyCard && result.replyCard.id || "",
        replyCardStatus: result && result.replyCard && result.replyCard.status || "",
        replyCardTerminal: Boolean(result && result.replyCard && result.replyCard.terminal),
        replyCardRequiresReturn: Boolean(result && result.replyCard && result.replyCard.requiresReturn),
        replyCardAckPolicy: result && result.replyCard && result.replyCard.ackPolicy || "",
        sourceThreadId: result && result.replyCard && result.replyCard.source && result.replyCard.source.threadId || "",
        targetThreadId: result && result.replyCard && result.replyCard.target && result.replyCard.target.threadId || "",
      });
    }
    if (!isWorkspaceDelegationDynamicToolCall(params, args)) {
      const identity = dynamicToolCallIdentity(params);
      logWorkspaceDelegationDynamicToolCall(request, params, args, { outcome: "unsupported_dynamic_tool" });
      return dynamicToolErrorPayload(
        "unsupported_dynamic_tool",
        `Unsupported Codex Mobile dynamic tool: ${identity.fullName || identity.name || "unknown"}`,
      );
    }
    const workspaceDelegation = workspaceDelegationSettings();
    if (!workspaceDelegation.enabled) {
      logWorkspaceDelegationDynamicToolCall(request, params, args, { outcome: "workspace_delegation_tool_disabled" });
      return dynamicToolErrorPayload(
        "workspace_delegation_tool_disabled",
        "Codex Mobile workspace delegation is disabled in Settings.",
        { tool: workspaceDelegationToolFullName },
      );
    }
    const body = workspaceDelegationDynamicToolBody(params, args);
    if (!body.sourceThreadId) {
      logWorkspaceDelegationDynamicToolCall(request, params, args, { outcome: "source_thread_id_required" });
      return dynamicToolErrorPayload(
        "source_thread_id_required",
        "Codex Mobile could not infer the source thread id for this tool call.",
        { turnId: params.turnId || params.turn_id || "" },
      );
    }
    if (!threadTaskCardTargetReferences(body).length) {
      logWorkspaceDelegationDynamicToolCall(request, params, args, { outcome: "target_thread_required" });
      return dynamicToolErrorPayload(
        "target_thread_required",
        "A target thread id, exact thread title, or exact target workspace cwd is required.",
      );
    }
    if (!String(body.title || "").trim()) {
      logWorkspaceDelegationDynamicToolCall(request, params, args, { outcome: "task_card_title_required" });
      return dynamicToolErrorPayload("task_card_title_required", "Task-card title is required.");
    }
    if (!String(body.body || body.bodyMarkdown || body.message || "").trim()) {
      logWorkspaceDelegationDynamicToolCall(request, params, args, { outcome: "task_card_body_required" });
      return dynamicToolErrorPayload("task_card_body_required", "Task-card body is required.");
    }
    const result = await createThreadTaskCardsFromSourceThread(body.sourceThreadId, body);
    logWorkspaceDelegationDynamicToolCall(request, params, args, {
      outcome: "ok",
      cardCount: Array.isArray(result.cards) ? result.cards.length : result.card ? 1 : 0,
      targetThreadCount: (result.cards || []).map((card) => card && card.target && card.target.threadId).filter(Boolean).length,
      direct: result.direct,
      autoApprove: result.autoApprove,
    });
    return dynamicToolJsonResponse({
      ok: true,
      tool: workspaceDelegationToolFullName,
      sourceThreadId: result.sourceThreadId,
      workspaceDelegationEnabled: result.workspaceDelegationEnabled,
      direct: result.direct,
      autoApprove: result.autoApprove,
      forcedDirect: true,
      cardCount: Array.isArray(result.cards) ? result.cards.length : result.card ? 1 : 0,
      cardIds: (result.cards || []).map((card) => card && card.id).filter(Boolean),
      targetThreadIds: (result.cards || []).map((card) => card && card.target && card.target.threadId).filter(Boolean),
    });
  }

  function parseThreadTaskCardDraftText(value) {
    const text = String(value || "");
    const match = new RegExp(`<${threadTaskCardDraftTag}>\\s*([\\s\\S]*?)\\s*<\\/${threadTaskCardDraftTag}>`, "i").exec(text);
    if (!match) return null;
    let parsed;
    try {
      parsed = JSON.parse(match[1]);
    } catch (_) {
      return null;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const targetThreadIds = uniqueThreadTaskCardTargetIds(parsed.targetThreadIds, parsed.targetThreadId);
    return {
      targetThreadId: targetThreadIds[0] || "",
      targetThreadIds,
      workflowMode: normalizeThreadTaskCardWorkflowMode(parsed.workflowMode),
      workflowId: truncateSingleLine(parsed.workflowId || "", 220),
      title: truncateSingleLine(parsed.title || "", 120),
      summary: truncateSingleLine(parsed.summary || "", 280),
      body: String(parsed.body || "").trim(),
      error: truncateSingleLine(parsed.error || "", 280),
    };
  }

  function threadTaskCardDraftPayloadKey(draft) {
    const targetThreadIds = uniqueThreadTaskCardTargetIds(draft && draft.targetThreadIds, draft && draft.targetThreadId).sort();
    return stableTextHash(JSON.stringify({
      targetThreadIds,
      workflowMode: normalizeThreadTaskCardWorkflowMode(draft && draft.workflowMode),
      workflowId: String(draft && draft.workflowId || "").trim(),
      title: String(draft && draft.title || "").trim(),
      summary: String(draft && draft.summary || "").trim(),
      body: String(draft && draft.body || "").trim(),
    }));
  }

  function threadTaskCardDraftIdempotencyKey(threadId, turnId, draft) {
    const payloadKey = threadTaskCardDraftPayloadKey(draft);
    return `task-card-draft:${String(threadId || "")}:task-card-draft|${String(turnId || "")}|draft-${payloadKey}`;
  }

  function threadTaskCardItemText(item) {
    if (!item || typeof item !== "object") return "";
    if (typeof item.text === "string") return item.text;
    if (typeof item.content === "string") return item.content;
    if (Array.isArray(item.content)) {
      return item.content.map((part) => {
        if (!part || typeof part !== "object") return "";
        return typeof part.text === "string" ? part.text : "";
      }).join("\n");
    }
    return "";
  }

  function summarizeTaskCardText(value) {
    return truncateSingleLine(String(value || "").replace(/\s+/g, " ").trim(), 280);
  }

  function truncateThreadTaskCardBody(value, maxChars = threadTaskCardBodyMaxChars) {
    const text = String(value || "").trim();
    const limit = Math.max(0, Number(maxChars) || 0);
    if (!limit || text.length <= limit) return text;
    const marker = `\n\n[Task card body truncated: ${text.length} chars total]\n\n`;
    const available = Math.max(0, limit - marker.length);
    if (available <= 0) return text.slice(0, limit);
    const head = Math.ceil(available * 0.6);
    const tail = Math.max(0, available - head);
    return `${text.slice(0, head).trimEnd()}${marker}${text.slice(-tail).trimStart()}`.slice(0, limit);
  }

  async function materializeThreadTaskCardDraftsForThread(thread) {
    if (!thread || typeof thread !== "object" || !thread.id || !Array.isArray(thread.turns)) return [];
    const sourceThreadId = String(thread.id || "");
    const sourceWorkspaceId = String(thread.cwd || (readStateDbThread(sourceThreadId) || {}).cwd || "");
    const sourceThreadTitle = taskCardSourceThreadTitle(sourceThreadId, "", thread);
    const created = [];
    for (const turn of thread.turns) {
      const turnId = String(turn && turn.id || "");
      if (!turnId || !Array.isArray(turn && turn.items)) continue;
      for (const item of turn.items) {
        if (!item || (item.type !== "agentMessage" && item.type !== "plan")) continue;
        const itemText = threadTaskCardItemText(item);
        if (!itemText.includes(threadTaskCardDraftTag)) continue;
        const draft = parseThreadTaskCardDraftText(itemText);
        if (!draft || draft.error || !draft.title || !draft.body || !draft.targetThreadIds.length) continue;
        const targetWorkspaceIds = {};
        for (const targetThreadId of draft.targetThreadIds) {
          const targetSummary = readStateDbThread(targetThreadId) || readStartedThread(targetThreadId);
          targetWorkspaceIds[targetThreadId] = targetSummary && targetSummary.cwd || "";
        }
        try {
          const body = truncateThreadTaskCardBody(draft.body);
          const cards = await threadTaskCardService.createMany({
            sourceWorkspaceId,
            sourceThreadId,
            sourceTurnId: turnId,
            sourceThreadTitle,
            targetThreadIds: draft.targetThreadIds,
            targetWorkspaceIds,
            idempotencyKey: threadTaskCardDraftIdempotencyKey(sourceThreadId, turnId, draft),
            format: "markdown",
            title: draft.title,
            summary: draft.summary || summarizeTaskCardText(body),
            body,
            workflowMode: draft.workflowMode || "manual",
            workflowId: draft.workflowId || "",
          });
          for (const card of cards || []) {
            if (card && card.id) created.push(card);
          }
        } catch (err) {
          logger.error(`[thread task card] server draft materialization failed thread=${shortIdentifier(sourceThreadId)} turn=${shortIdentifier(turnId)}: ${err.message || String(err)}`);
        }
      }
    }
    return created;
  }

  async function prepareThreadTaskCardsToResult(result) {
    if (!result || typeof result !== "object" || !result.thread) return result;
    await materializeThreadTaskCardDraftsForThread(result.thread);
    return attachPendingServerRequestsToResult(attachThreadTaskCardsToResult(result));
  }

  async function handleRoute(options = {}) {
    const url = options.url;
    const method = String(options.method || "").toUpperCase();
    const readBody = typeof options.readBody === "function" ? options.readBody : async () => ({});
    const sendJson = typeof options.sendJson === "function" ? options.sendJson : () => {};
    if (!url || typeof url.pathname !== "string") return { handled: false };

    const sourceThreadWorkspaceDelegation = url.pathname.match(/^\/api\/threads\/([^/]+)\/workspace-delegation$/);
    if (sourceThreadWorkspaceDelegation && method === "POST") {
      try {
        const workspaceDelegation = workspaceDelegationSettings();
        sendJson(200, {
          ok: true,
          enabled: workspaceDelegation.enabled,
          delegated: false,
          disabled: true,
          analysis: {
            shouldDelegate: false,
            reason: workspaceDelegation.enabled
              ? "model_driven_delegation_requires_explicit_task_card"
              : "workspace_delegation_disabled",
          },
        });
      } catch (err) {
        sendJson(err.statusCode || 500, { ok: false, error: err.message || String(err) });
      }
      return { handled: true };
    }

    const sourceThreadTaskCardCreate = url.pathname.match(/^\/api\/threads\/([^/]+)\/task-cards$/);
    if (sourceThreadTaskCardCreate && method === "POST") {
      try {
        const sourceThreadId = decodeURIComponent(sourceThreadTaskCardCreate[1]);
        const body = await readBody();
        sendJson(200, await createThreadTaskCardsFromSourceThread(sourceThreadId, body));
      } catch (err) {
        sendJson(err.statusCode || 500, {
          ok: false,
          error: err.message || String(err),
          code: err.code || err.message || String(err),
          details: err.details || undefined,
        });
      }
      return { handled: true };
    }

    if (url.pathname === "/api/thread-task-cards" && method === "POST") {
      try {
        const body = await readBody();
        const sourceSummary = hydrateThreadTitleFromSessionIndex(readStateDbThread(body.sourceThreadId) || readStartedThread(body.sourceThreadId) || (body.sourceThreadId ? { id: body.sourceThreadId } : null));
        const requestedTargetIds = Array.isArray(body.targetThreadIds) && body.targetThreadIds.length
          ? body.targetThreadIds
          : [body.targetThreadId];
        const routedBody = applyHomeAiDeployLaneRoutingPolicy(Object.assign({}, body, {
          sourceWorkspaceId: body.sourceWorkspaceId || body.sourceWorkspace || (sourceSummary && sourceSummary.cwd) || "",
          targetThreadIds: requestedTargetIds,
        }), sourceSummary);
        const routedTargetIds = Array.isArray(routedBody.targetThreadIds) && routedBody.targetThreadIds.length
          ? routedBody.targetThreadIds
          : [routedBody.targetThreadId];
        const targetWorkspaceIds = Object.assign({}, routedBody.targetWorkspaceIds && typeof routedBody.targetWorkspaceIds === "object" ? routedBody.targetWorkspaceIds : {});
        for (const targetThreadId of routedTargetIds) {
          const id = String(targetThreadId || "").trim();
          if (!id || targetWorkspaceIds[id]) continue;
          const targetSummary = readStateDbThread(id) || readStartedThread(id);
          targetWorkspaceIds[id] = routedBody.targetWorkspaceId || routedBody.targetWorkspace || (targetSummary && targetSummary.cwd) || "";
        }
        const cards = await threadTaskCardService.createMany(Object.assign({}, routedBody, {
          sourceWorkspaceId: routedBody.sourceWorkspaceId || routedBody.sourceWorkspace || (sourceSummary && sourceSummary.cwd) || "",
          targetThreadIds: routedTargetIds,
          targetWorkspaceIds,
          sourceThreadTitle: taskCardSourceThreadTitle(routedBody.sourceThreadId, routedBody.sourceThreadTitle, sourceSummary),
        }));
        sendJson(200, {
          ok: true,
          card: cards[0] || null,
          cards,
        });
      } catch (err) {
        sendJson(err.statusCode || 500, { ok: false, error: err.message || String(err) });
      }
      return { handled: true };
    }

    const threadTaskCardRead = url.pathname.match(/^\/api\/thread-task-cards\/([^/]+)$/);
    if (threadTaskCardRead && method === "GET") {
      try {
        const cardId = decodeURIComponent(threadTaskCardRead[1]);
        const threadId = url.searchParams.get("threadId") || "";
        sendJson(200, { ok: true, card: threadTaskCardService.get(cardId, threadId) });
      } catch (err) {
        sendJson(err.statusCode || 500, { ok: false, error: err.message || String(err) });
      }
      return { handled: true };
    }

    const threadTaskCardApprove = url.pathname.match(/^\/api\/thread-task-cards\/([^/]+)\/approve$/);
    if (threadTaskCardApprove && method === "POST") {
      try {
        const cardId = decodeURIComponent(threadTaskCardApprove[1]);
        const body = await readBody();
        sendJson(200, Object.assign({ ok: true }, await threadTaskCardService.approve(cardId, body.threadId || body.actorThreadId || "")));
      } catch (err) {
        sendJson(err.statusCode || 500, { ok: false, error: err.message || String(err) });
      }
      return { handled: true };
    }

    const threadTaskCardDelete = url.pathname.match(/^\/api\/thread-task-cards\/([^/]+)\/delete$/);
    if (threadTaskCardDelete && method === "POST") {
      try {
        const cardId = decodeURIComponent(threadTaskCardDelete[1]);
        const body = await readBody();
        sendJson(200, {
          ok: true,
          card: await threadTaskCardService.deleteCard(cardId, body.threadId || body.actorThreadId || ""),
        });
      } catch (err) {
        sendJson(err.statusCode || 500, { ok: false, error: err.message || String(err) });
      }
      return { handled: true };
    }

    const threadTaskCardRevoke = url.pathname.match(/^\/api\/thread-task-cards\/([^/]+)\/revoke$/);
    if (threadTaskCardRevoke && method === "POST") {
      try {
        const cardId = decodeURIComponent(threadTaskCardRevoke[1]);
        const body = await readBody();
        sendJson(200, {
          ok: true,
          card: await threadTaskCardService.revoke(cardId, body.threadId || body.actorThreadId || ""),
        });
      } catch (err) {
        sendJson(err.statusCode || 500, { ok: false, error: err.message || String(err) });
      }
      return { handled: true };
    }

    const threadTaskCardReply = url.pathname.match(/^\/api\/thread-task-cards\/([^/]+)\/reply$/);
    if (threadTaskCardReply && method === "POST") {
      try {
        const cardId = decodeURIComponent(threadTaskCardReply[1]);
        const body = await readBody();
        const actorThreadId = body.threadId || body.actorThreadId || "";
        const actorSummary = hydrateThreadTitleFromSessionIndex(readStateDbThread(actorThreadId) || readStartedThread(actorThreadId) || (actorThreadId ? { id: actorThreadId } : null));
        sendJson(200, Object.assign({ ok: true }, await threadTaskCardService.reply(cardId, actorThreadId, Object.assign({}, body, {
          sourceWorkspaceId: body.sourceWorkspaceId || (actorSummary && actorSummary.cwd) || "",
          sourceThreadId: body.sourceThreadId || actorThreadId,
          sourceThreadTitle: taskCardSourceThreadTitle(actorThreadId, body.sourceThreadTitle, actorSummary),
        }))));
      } catch (err) {
        sendJson(err.statusCode || 500, { ok: false, error: err.message || String(err) });
      }
      return { handled: true };
    }

    const threadTaskCardExecutionPause = url.pathname.match(/^\/api\/thread-task-cards\/([^/]+)\/execution\/pause$/);
    if (threadTaskCardExecutionPause && method === "POST") {
      try {
        const cardId = decodeURIComponent(threadTaskCardExecutionPause[1]);
        const body = await readBody();
        sendJson(200, {
          ok: true,
          card: await threadTaskCardService.pauseExecution(cardId, body.threadId || body.actorThreadId || ""),
        });
      } catch (err) {
        sendJson(err.statusCode || 500, { ok: false, error: err.message || String(err) });
      }
      return { handled: true };
    }

    const threadTaskCardExecutionCancel = url.pathname.match(/^\/api\/thread-task-cards\/([^/]+)\/execution\/cancel$/);
    if (threadTaskCardExecutionCancel && method === "POST") {
      try {
        const cardId = decodeURIComponent(threadTaskCardExecutionCancel[1]);
        const body = await readBody();
        sendJson(200, {
          ok: true,
          card: await threadTaskCardService.cancelExecution(cardId, body.threadId || body.actorThreadId || ""),
        });
      } catch (err) {
        sendJson(err.statusCode || 500, { ok: false, error: err.message || String(err) });
      }
      return { handled: true };
    }

    return { handled: false };
  }

  return {
    applyHomeAiDeployLaneRoutingPolicy,
    assertThreadTaskCardTargetDeliverable,
    attachTaskCardRuntimeDynamicTools,
    attachWorkspaceDelegationRuntimeGuidance,
    buildThreadTaskCardCreatePayload,
    createThreadTaskCardsFromSourceThread,
    dynamicToolErrorPayload,
    dynamicToolJsonResponse,
    dynamicToolServerRequestResponsePayload,
    dynamicToolTextResponse,
    handleRoute,
    isThreadIdLike,
    materializeThreadTaskCardDraftsForThread,
    normalizeThreadTaskCardReasoningEffort,
    normalizeThreadTaskCardWorkflowMode,
    parseDynamicToolArguments,
    parseThreadTaskCardDraftText,
    prepareThreadTaskCardsToResult,
    publicThreadTaskCardTarget,
    readThreadTaskCardExecutionTargetSummary,
    readThreadTaskCardTargetSummary,
    readThreadTaskCardVisibleTargetSummary,
    resolveThreadTaskCardTargetReference,
    resolvedThreadTaskCardTargetIds,
    summarizeTaskCardText,
    taskCardReturnDynamicToolSpec,
    taskCardReturnScriptFallbackInstruction,
    taskCardRuntimeDynamicTools,
    taskCardSourceThreadTitle,
    threadTaskCardCanonicalTargetForCwd,
    threadTaskCardCanonicalTargetForThread,
    threadTaskCardCanonicalVisibleTargets,
    threadTaskCardDraftIdempotencyKey,
    threadTaskCardItemText,
    threadTaskCardTargetError,
    threadTaskCardTargetReferenceEntries,
    threadTaskCardTargetReferenceEntry,
    threadTaskCardTargetReferences,
    threadTaskCardTargetReferenceText,
    threadTaskCardTargetUpdatedAt,
    threadTaskCardTargetVisibility,
    threadTaskCardThreadCallIdempotencyKey,
    threadTaskCardVisibleTargetThreads,
    truncateThreadTaskCardBody,
    uniqueThreadTaskCardTargetIds,
    workspaceDelegationDynamicToolCallDiagnostics,
    workspaceDelegationDynamicToolSpec,
    workspaceDelegationDynamicTools,
    workspaceDelegationScriptFallbackInstruction,
    workspaceDelegationTargetHints,
  };
}

module.exports = { createThreadTaskCardRouteService };
