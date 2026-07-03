"use strict";

const crypto = require("node:crypto");
const defaultFs = require("node:fs");
const defaultPath = require("node:path");

const {
  boundedText,
  createAtLoopTriggerParserService,
  normalizeAlias,
  redactSensitiveText,
} = require("./at-loop-trigger-parser-service");
const {
  createThreadTaskCardLoopRoutingService,
  publicRoutingMetadata,
} = require("./thread-task-card-loop-routing-service");

const STATE_VERSION = 1;
const DEFAULT_MAX_ITERATIONS = 3;
const DEFAULT_WATCHDOG_STALE_MS = 30 * 60 * 1000;
const AUDIT_VERDICTS = new Set([
  "passed",
  "failed_requirements_gap",
  "failed_implementation_bug",
  "failed_test_gap",
  "failed_privacy_boundary",
  "failed_deployment_readback",
  "blocked_missing_evidence",
  "blocked_owner_decision",
  "blocked_target_unavailable",
  "rejected_out_of_scope",
]);

function nowIso(clock) {
  const value = typeof clock === "function" ? clock() : Date.now();
  return new Date(value).toISOString();
}

function compactOneLine(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function stableHash(value, length = 16) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, length);
}

function normalizeStatus(value) {
  const status = compactOneLine(value).toLowerCase();
  if (["completed", "blocked", "redirected", "rejected", "partially_completed"].includes(status)) return status;
  return status || "completed";
}

function stateSkeleton() {
  return { version: STATE_VERSION, loops: [] };
}

function safeJsonParse(text) {
  try {
    const parsed = JSON.parse(String(text || "{}"));
    return parsed && typeof parsed === "object" ? parsed : stateSkeleton();
  } catch (_) {
    return stateSkeleton();
  }
}

function writeJsonFile(fs, pathModule, file, payload) {
  if (!file) return;
  const dir = pathModule.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  fs.renameSync(tmp, file);
}

function publicThread(thread = {}) {
  return {
    id: compactOneLine(thread.id || thread.threadId),
    title: boundedText(thread.title || thread.name || thread.preview, 120),
    cwd: boundedText(thread.cwd || thread.workspace || thread.targetWorkspace, 300),
  };
}

function loopRoles(deployReadbackRequired) {
  const roles = ["requirements", "implementation", "product_audit", "repair"];
  if (deployReadbackRequired) roles.push("deploy_readback");
  return roles;
}

function roleTitle(role) {
  if (role === "requirements") return "Requirements analysis";
  if (role === "implementation") return "Implementation";
  if (role === "product_audit") return "Product audit";
  if (role === "repair") return "Repair iteration";
  if (role === "deploy_readback") return "Deploy/readback";
  return role;
}

function roleCardBody(loop, slice) {
  return [
    `# Codex Mobile @loop role: ${roleTitle(slice.role)}`,
    "",
    `Loop id: ${loop.loopId}`,
    `Role slice id: ${slice.roleSliceId}`,
    `Iteration: ${slice.iteration} / ${loop.maxIterations}`,
    `Runtime owner: codex-mobile`,
    `Domain adapter: ${loop.domainAdapter}`,
    `Target purpose: ${slice.targetPurpose || "unknown"}`,
    "",
    "## Objective",
    loop.objectiveSummary || "(bounded objective unavailable)",
    "",
    "## Contract",
    "- Complete only this role slice and return a terminal task card to the source thread.",
    "- Use bounded evidence: ids, statuses, counts, file paths, short hashes, and test names.",
    "- Do not include raw secrets, cookies, launch tokens, provider payloads, private thread bodies, screenshots, DB rows, full prompts, or long logs.",
    "- If the target thread purpose does not match this role, fail closed with bounded routing evidence.",
  ].join("\n");
}

function nextRouteForAuditVerdict(verdict) {
  if (verdict === "passed") return "closed";
  if (verdict === "failed_requirements_gap") return "requirements_revision";
  if (["failed_implementation_bug", "failed_test_gap", "failed_privacy_boundary"].includes(verdict)) {
    return "implementation_repair";
  }
  if (verdict === "failed_deployment_readback") return "deploy_readback";
  if (verdict === "rejected_out_of_scope") return "rejected";
  if (verdict && verdict.startsWith("blocked_")) return verdict;
  return "awaiting_audit_verdict";
}

function roleAfterTerminal(loop, slice, returnStatus, auditVerdict) {
  if (returnStatus === "blocked") return { loopStatus: "blocked", nextRoute: "blocked_role_return" };
  if (returnStatus === "rejected") return { loopStatus: "rejected", nextRoute: "rejected_role_return" };
  if (slice.role === "requirements") return { role: "implementation", nextRoute: "implementation" };
  if (slice.role === "implementation") return { role: "product_audit", nextRoute: "product_audit" };
  if (slice.role === "repair") {
    if (loop.iteration >= loop.maxIterations) return { loopStatus: "blocked", nextRoute: "max_iterations_reached" };
    loop.iteration += 1;
    return { role: "product_audit", nextRoute: "product_audit" };
  }
  if (slice.role === "product_audit") {
    const route = nextRouteForAuditVerdict(auditVerdict);
    if (route === "closed") {
      if (loop.deployReadbackRequired) return { role: "deploy_readback", nextRoute: "deploy_readback" };
      return { loopStatus: "completed", nextRoute: "closed" };
    }
    if (route === "requirements_revision") return { role: "requirements", nextRoute: route };
    if (route === "implementation_repair") return { role: "repair", nextRoute: route };
    if (route === "deploy_readback") return { role: "deploy_readback", nextRoute: route };
    if (route === "rejected") return { loopStatus: "rejected", nextRoute: route };
    if (route.startsWith("blocked_")) return { loopStatus: "blocked", nextRoute: route };
    return { loopStatus: "blocked", nextRoute: route };
  }
  if (slice.role === "deploy_readback") {
    if (returnStatus === "completed") return { loopStatus: "completed", nextRoute: "closed" };
    return { role: "repair", nextRoute: "deployment_repair" };
  }
  return { loopStatus: "blocked", nextRoute: "unknown_role_terminal" };
}

function createLoopTaskRuntimeService(dependencies = {}) {
  const fs = dependencies.fs || defaultFs;
  const pathModule = dependencies.path || defaultPath;
  const parser = dependencies.parser || createAtLoopTriggerParserService(dependencies.parserOptions || {});
  const routingService = dependencies.routingService || createThreadTaskCardLoopRoutingService();
  const createThreadTaskCardsFromSourceThread = dependencies.createThreadTaskCardsFromSourceThread;
  const storageFile = dependencies.storageFile || "";
  const staleAfterMs = Number(dependencies.watchdogStaleMs || DEFAULT_WATCHDOG_STALE_MS);
  const maxIterationsDefault = Number(dependencies.maxIterations || DEFAULT_MAX_ITERATIONS);
  const clock = dependencies.clock || (() => Date.now());

  let stateCache = null;

  function loadState() {
    if (stateCache) return stateCache;
    if (!storageFile) {
      stateCache = stateSkeleton();
      return stateCache;
    }
    if (!fs.existsSync(storageFile)) {
      stateCache = stateSkeleton();
      return stateCache;
    }
    const parsed = safeJsonParse(fs.readFileSync(storageFile, "utf8"));
    stateCache = Object.assign(stateSkeleton(), parsed, {
      loops: Array.isArray(parsed.loops) ? parsed.loops : [],
    });
    return stateCache;
  }

  function saveState() {
    const state = loadState();
    writeJsonFile(fs, pathModule, storageFile, state);
    return state;
  }

  function visibleThreads() {
    if (typeof dependencies.threadTaskCardVisibleTargetThreads === "function") {
      return dependencies.threadTaskCardVisibleTargetThreads() || [];
    }
    if (Array.isArray(dependencies.visibleThreads)) return dependencies.visibleThreads;
    return [];
  }

  function readThreadSummary(threadId) {
    const id = compactOneLine(threadId);
    if (!id) return null;
    if (typeof dependencies.readThreadTaskCardVisibleTargetSummary === "function") {
      const visible = dependencies.readThreadTaskCardVisibleTargetSummary(id);
      if (visible) return visible;
    }
    if (typeof dependencies.readThreadTaskCardTargetSummary === "function") {
      const target = dependencies.readThreadTaskCardTargetSummary(id);
      if (target) return target;
    }
    const visible = visibleThreads().find((thread) => compactOneLine(thread.id || thread.threadId) === id);
    return visible || null;
  }

  function aliasTargets() {
    const targets = new Map();
    const configured = dependencies.loopTargetAliases && typeof dependencies.loopTargetAliases === "object"
      ? dependencies.loopTargetAliases
      : {};
    for (const [alias, target] of Object.entries(configured)) {
      const normalized = normalizeAlias(alias);
      if (normalized && target) targets.set(normalized, target);
    }
    for (const thread of visibleThreads()) {
      const title = compactOneLine(thread && (thread.title || thread.name || thread.preview));
      const cwd = compactOneLine(thread && thread.cwd);
      const id = compactOneLine(thread && (thread.id || thread.threadId));
      for (const value of [title, cwd.split("/").filter(Boolean).pop(), id]) {
        const alias = normalizeAlias(value);
        if (alias && !targets.has(alias)) targets.set(alias, thread);
      }
    }
    return targets;
  }

  function knownAliases() {
    return Array.from(aliasTargets().keys());
  }

  function targetFromAlias(alias) {
    const normalized = normalizeAlias(alias);
    if (!normalized) return null;
    return aliasTargets().get(normalized) || null;
  }

  function targetForRole(loop, role) {
    if (role === "product_audit") {
      const audit = visibleThreads().find((thread) => routingService.classifyThreadPurpose(thread).purpose === "audit_lane");
      return audit || null;
    }
    if (role === "deploy_readback") {
      const deploy = visibleThreads().find((thread) => routingService.classifyThreadPurpose(thread).purpose === "deploy_lane");
      return deploy || null;
    }
    if ((role === "implementation" || role === "repair") && loop.targetThreadId) {
      return readThreadSummary(loop.targetThreadId) || { id: loop.targetThreadId, threadId: loop.targetThreadId };
    }
    return readThreadSummary(loop.sourceThreadId) || { id: loop.sourceThreadId, threadId: loop.sourceThreadId };
  }

  function publicSlice(slice = {}) {
    return {
      roleSliceId: slice.roleSliceId || "",
      role: slice.role || "",
      status: slice.status || "",
      iteration: slice.iteration || 0,
      targetThreadId: slice.targetThreadId || "",
      targetPurpose: slice.targetPurpose || "",
      taskCardId: slice.taskCardId || "",
      dispatchStatus: slice.dispatchStatus || "",
      returnStatus: slice.returnStatus || "",
      auditVerdict: slice.auditVerdict || "",
      stale: Boolean(slice.stale),
      blockedReason: slice.blockedReason || "",
      routing: slice.routing || null,
      updatedAt: slice.updatedAt || "",
    };
  }

  function publicLoop(loop = {}) {
    const slices = Array.isArray(loop.roleSlices) ? loop.roleSlices : [];
    return {
      loopId: loop.loopId || "",
      sourceThreadId: loop.sourceThreadId || "",
      targetThreadId: loop.targetThreadId || "",
      targetAlias: loop.targetAlias || "",
      domainAdapter: loop.domainAdapter || "generic",
      objectiveSummary: loop.objectiveSummary || "",
      status: loop.status || "",
      currentRole: loop.currentRole || "",
      iteration: loop.iteration || 1,
      maxIterations: loop.maxIterations || maxIterationsDefault,
      deployReadbackRequired: Boolean(loop.deployReadbackRequired),
      lastAuditVerdict: loop.lastAuditVerdict || "",
      nextRoute: loop.nextRoute || "",
      blockedReason: loop.blockedReason || "",
      duplicateSuppressedCount: Number(loop.duplicateSuppressedCount || 0),
      waitingReturnCount: slices.filter((slice) => slice.status === "dispatched").length,
      roleSlices: slices.map(publicSlice),
      createdAt: loop.createdAt || "",
      updatedAt: loop.updatedAt || "",
    };
  }

  function buildLoopId({ sourceThreadId, targetThreadId, targetAlias, domainAdapter, objective }) {
    const seed = [
      "at-loop-v1",
      compactOneLine(sourceThreadId),
      compactOneLine(targetThreadId),
      normalizeAlias(targetAlias),
      compactOneLine(domainAdapter),
      stableHash(redactSensitiveText(objective), 32),
    ].join("|");
    return `loop_${stableHash(seed, 16)}`;
  }

  function createRoleSlices(loop) {
    return loopRoles(loop.deployReadbackRequired).map((role) => ({
      role,
      roleSliceId: `${loop.loopId}:${role}:1`,
      iteration: 1,
      status: role === "requirements" ? "planned" : "pending",
      dispatchStatus: "",
      taskCardId: "",
      targetThreadId: "",
      targetPurpose: "",
      routing: null,
      createdAt: loop.createdAt,
      updatedAt: loop.createdAt,
    }));
  }

  function findLoop(loopId) {
    return loadState().loops.find((loop) => loop.loopId === loopId) || null;
  }

  function findSlice(loop, query = {}) {
    if (!loop) return null;
    const slices = Array.isArray(loop.roleSlices) ? loop.roleSlices : [];
    const taskCardId = compactOneLine(query.taskCardId);
    if (taskCardId) {
      const byCard = slices.find((slice) => slice.taskCardId === taskCardId);
      if (byCard) return byCard;
    }
    const roleSliceId = compactOneLine(query.roleSliceId);
    if (roleSliceId) {
      const bySlice = slices.find((slice) => slice.roleSliceId === roleSliceId);
      if (bySlice) return bySlice;
    }
    const role = compactOneLine(query.role);
    if (role) {
      return slices.find((slice) => slice.role === role && slice.iteration === (query.iteration || loop.iteration)) || null;
    }
    return null;
  }

  async function dispatchRole(loop, role) {
    const timestamp = nowIso(clock);
    let slice = findSlice(loop, { role, iteration: loop.iteration });
    if (!slice) {
      slice = {
        role,
        roleSliceId: `${loop.loopId}:${role}:${loop.iteration}`,
        iteration: loop.iteration,
        status: "planned",
        createdAt: timestamp,
      };
      loop.roleSlices.push(slice);
    }
    const target = targetForRole(loop, role);
    if (!target) {
      slice.status = "blocked";
      slice.dispatchStatus = "blocked";
      slice.blockedReason = "at_loop_missing_role_lane";
      slice.updatedAt = timestamp;
      loop.status = "blocked";
      loop.blockedReason = "at_loop_missing_role_lane";
      loop.nextRoute = "blocked_target_unavailable";
      loop.updatedAt = timestamp;
      saveState();
      return { ok: false, error: "at_loop_missing_role_lane", loop: publicLoop(loop), slice: publicSlice(slice) };
    }
    const thread = publicThread(target);
    const targetThreadId = thread.id || compactOneLine(target.threadId);
    slice.targetThreadId = targetThreadId;
    const targetCheck = routingService.assertLoopRoleTarget({ role, thread: target });
    slice.targetPurpose = targetCheck.classification && targetCheck.classification.purpose || "";
    if (!targetCheck.ok) {
      slice.status = "blocked";
      slice.dispatchStatus = "blocked";
      slice.blockedReason = targetCheck.error;
      slice.routing = publicRoutingMetadata(targetCheck);
      slice.updatedAt = timestamp;
      loop.status = "blocked";
      loop.blockedReason = targetCheck.error;
      loop.nextRoute = "blocked_target_unavailable";
      loop.updatedAt = timestamp;
      saveState();
      return { ok: false, error: targetCheck.error, routing: slice.routing, loop: publicLoop(loop), slice: publicSlice(slice) };
    }
    if (typeof createThreadTaskCardsFromSourceThread !== "function") {
      slice.status = "blocked";
      slice.dispatchStatus = "blocked";
      slice.blockedReason = "at_loop_task_card_channel_unavailable";
      slice.updatedAt = timestamp;
      loop.status = "blocked";
      loop.blockedReason = "at_loop_task_card_channel_unavailable";
      loop.updatedAt = timestamp;
      saveState();
      return { ok: false, error: "at_loop_task_card_channel_unavailable", loop: publicLoop(loop), slice: publicSlice(slice) };
    }

    const idempotencyKey = `at-loop:${loop.loopId}:${role}:${slice.iteration}:v1`;
    const bodyMarkdown = roleCardBody(loop, slice);
    const payload = {
      sourceThreadId: loop.sourceThreadId,
      targetThreadId,
      title: `@loop ${roleTitle(role)}: ${loop.objectiveSummary}`,
      summary: `${roleTitle(role)} for ${loop.loopId}`,
      body: bodyMarkdown,
      bodyMarkdown,
      cardKind: "at_loop_role_slice",
      category: "at-loop",
      workflowMode: "autonomous",
      workflowId: `at-loop:${loop.loopId}`,
      requestId: idempotencyKey,
      idempotencyKey,
      direct: true,
      autoApprove: true,
      pending: false,
      reasoningEffort: role === "product_audit" ? "medium" : "high",
    };
    try {
      const result = await createThreadTaskCardsFromSourceThread(loop.sourceThreadId, payload, { source: "at-loop-runtime" });
      const cards = Array.isArray(result && result.cards) ? result.cards : result && result.card ? [result.card] : [];
      const card = cards[0] || {};
      slice.status = "dispatched";
      slice.dispatchStatus = "dispatched";
      slice.taskCardId = compactOneLine(card.id || card.cardId || result && result.cardId);
      slice.targetPurpose = targetCheck.classification.purpose;
      slice.routing = publicRoutingMetadata(targetCheck);
      slice.dispatchedAt = timestamp;
      slice.updatedAt = timestamp;
      loop.status = "running";
      loop.currentRole = role;
      loop.nextRoute = role;
      loop.updatedAt = timestamp;
      saveState();
      return { ok: true, loop: publicLoop(loop), slice: publicSlice(slice), cardCount: cards.length };
    } catch (err) {
      slice.status = "blocked";
      slice.dispatchStatus = "failed";
      slice.blockedReason = compactOneLine(err && err.message || err || "at_loop_dispatch_failed");
      slice.updatedAt = timestamp;
      loop.status = "blocked";
      loop.blockedReason = "at_loop_dispatch_failed";
      loop.updatedAt = timestamp;
      saveState();
      return { ok: false, error: "at_loop_dispatch_failed", message: slice.blockedReason, loop: publicLoop(loop), slice: publicSlice(slice) };
    }
  }

  async function startLoop(input = {}) {
    const sourceThreadId = compactOneLine(input.sourceThreadId || input.threadId);
    if (!sourceThreadId) return { ok: false, error: "source_thread_id_required" };
    const triggerText = input.text || input.message || (input.objective ? `@loop ${input.objective}` : "");
    const parsed = parser.parse(triggerText, { knownAliases: knownAliases() });
    if (!parsed.triggered) return { ok: false, error: "at_loop_trigger_not_found" };
    if (!parsed.ok) return Object.assign({ ok: false }, parsed);

    const explicitTarget = input.targetThreadId || (parsed.targetAlias ? targetFromAlias(parsed.targetAlias) : null);
    const explicitTargetId = compactOneLine(typeof explicitTarget === "string" ? explicitTarget : explicitTarget && (explicitTarget.id || explicitTarget.threadId));
    const sourceTarget = readThreadSummary(sourceThreadId) || { id: sourceThreadId, threadId: sourceThreadId };
    const targetThreadId = explicitTargetId || compactOneLine(sourceTarget.id || sourceTarget.threadId || sourceThreadId);
    const loopId = buildLoopId({
      sourceThreadId,
      targetThreadId,
      targetAlias: parsed.targetAlias,
      domainAdapter: parsed.domainAdapter,
      objective: parsed.objective,
    });
    const state = loadState();
    const existing = state.loops.find((loop) => loop.loopId === loopId);
    if (existing) {
      existing.duplicateSuppressedCount = Number(existing.duplicateSuppressedCount || 0) + 1;
      existing.updatedAt = nowIso(clock);
      saveState();
      return { ok: true, duplicateSuppressed: true, loop: publicLoop(existing) };
    }

    const timestamp = nowIso(clock);
    const loop = {
      loopId,
      sourceThreadId,
      targetThreadId,
      targetAlias: parsed.targetAlias || "",
      domainAdapter: parsed.domainAdapter || "generic",
      objectiveHash: stableHash(parsed.objective, 24),
      objectiveSummary: parsed.objectiveSummary || boundedText(parsed.objective, 220),
      status: "created",
      currentRole: "requirements",
      iteration: 1,
      maxIterations: Math.max(1, Math.min(10, Number(input.maxIterations || maxIterationsDefault))),
      deployReadbackRequired: Boolean(input.deployReadbackRequired || input.deployReadback),
      duplicateSuppressedCount: 0,
      lastAuditVerdict: "",
      nextRoute: "requirements",
      blockedReason: "",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    loop.roleSlices = createRoleSlices(loop);
    state.loops.unshift(loop);
    saveState();
    const dispatch = await dispatchRole(loop, "requirements");
    return Object.assign({ ok: dispatch.ok !== false, duplicateSuppressed: false }, dispatch, { loop: publicLoop(loop) });
  }

  async function recordTerminalReturn(input = {}) {
    const loopId = compactOneLine(input.loopId);
    const taskCardId = compactOneLine(input.taskCardId || input.cardId);
    const roleSliceId = compactOneLine(input.roleSliceId);
    const state = loadState();
    const loop = loopId
      ? findLoop(loopId)
      : state.loops.find((candidate) => findSlice(candidate, { taskCardId, roleSliceId }));
    if (!loop) return { ok: false, error: "at_loop_return_loop_not_found" };
    const slice = findSlice(loop, input);
    if (!slice) return { ok: false, error: "at_loop_return_slice_not_found", loop: publicLoop(loop) };
    const timestamp = nowIso(clock);
    const returnStatus = normalizeStatus(input.status);
    const auditVerdict = AUDIT_VERDICTS.has(compactOneLine(input.auditVerdict)) ? compactOneLine(input.auditVerdict) : "";
    slice.status = "returned";
    slice.returnStatus = returnStatus;
    slice.returnCardId = boundedText(input.returnCardId || input.replyCardId, 120);
    slice.returnSummary = boundedText(redactSensitiveText(input.summary || ""), 220);
    slice.auditVerdict = auditVerdict;
    slice.updatedAt = timestamp;
    loop.lastAuditVerdict = auditVerdict || loop.lastAuditVerdict || "";

    const route = roleAfterTerminal(loop, slice, returnStatus, auditVerdict);
    loop.nextRoute = route.nextRoute || "";
    if (route.loopStatus) {
      loop.status = route.loopStatus;
      loop.currentRole = "";
      loop.updatedAt = timestamp;
      saveState();
      return { ok: true, loop: publicLoop(loop), slice: publicSlice(slice) };
    }
    loop.updatedAt = timestamp;
    saveState();
    const dispatch = await dispatchRole(loop, route.role);
    return Object.assign({ ok: dispatch.ok !== false }, dispatch, { loop: publicLoop(loop) });
  }

  function runWatchdog(input = {}) {
    const timestamp = nowIso(clock);
    const nowMs = typeof clock === "function" ? Number(clock()) : Date.now();
    const requestedLoopId = compactOneLine(input.loopId);
    const loops = loadState().loops.filter((loop) => !requestedLoopId || loop.loopId === requestedLoopId);
    const stale = [];
    for (const loop of loops) {
      for (const slice of Array.isArray(loop.roleSlices) ? loop.roleSlices : []) {
        if (slice.status !== "dispatched" || slice.stale) continue;
        const dispatchedMs = Date.parse(slice.dispatchedAt || slice.updatedAt || slice.createdAt || "");
        if (!Number.isFinite(dispatchedMs)) continue;
        if (nowMs - dispatchedMs < staleAfterMs) continue;
        slice.stale = true;
        slice.dispatchStatus = "return_stale";
        slice.blockedReason = "return_card_watchdog_stale";
        slice.updatedAt = timestamp;
        loop.nextRoute = "watchdog_stale_return";
        loop.updatedAt = timestamp;
        stale.push({ loopId: loop.loopId, roleSliceId: slice.roleSliceId, taskCardId: slice.taskCardId });
      }
    }
    if (stale.length) saveState();
    return { ok: true, staleCount: stale.length, stale, retried: false, completed: false, rejected: false };
  }

  function status(input = {}) {
    const loopId = compactOneLine(input.loopId);
    const loops = loopId ? loadState().loops.filter((loop) => loop.loopId === loopId) : loadState().loops;
    return {
      ok: true,
      loopCount: loops.length,
      loops: loops.map(publicLoop),
    };
  }

  return {
    dispatchRole,
    knownAliases,
    parseTrigger: (input, options) => parser.parse(input, options),
    publicLoop,
    recordTerminalReturn,
    runWatchdog,
    startLoop,
    status,
  };
}

module.exports = {
  AUDIT_VERDICTS,
  createLoopTaskRuntimeService,
  nextRouteForAuditVerdict,
};
