"use strict";

const defaultFs = require("node:fs");
const defaultPath = require("node:path");

function compactOneLine(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeLabel(value) {
  return compactOneLine(value).toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
}

function normalizeCwd(value, pathModule = defaultPath) {
  const text = compactOneLine(value);
  if (!text) return "";
  try {
    return pathModule.resolve(text).replace(/\\/g, "/").toLowerCase();
  } catch (_) {
    return text.replace(/\\/g, "/").toLowerCase();
  }
}

function threadIdOf(thread = {}) {
  return compactOneLine(thread && (thread.id || thread.threadId || thread.thread_id));
}

function threadTitle(thread = {}) {
  return compactOneLine(thread && (thread.title || thread.name || thread.preview || thread.threadTitle || thread.thread_name));
}

function threadRole(thread = {}) {
  return normalizeLabel(thread && (thread.threadRole || thread.thread_role || thread.role || thread.taskCardRole || thread.task_card_role));
}

function normalizeWorkspaceMainRole(value) {
  const role = normalizeLabel(value);
  if (role === "home_ai_main" || role === "home_ai_implementation" || role === "home_ai_scheduler" || role === "home_ai_main_scheduler") return "home_ai_main";
  if (role === "plugin_main" || role === "plugin_implementation" || role === "plugin_scheduler" || role === "plugin_main_scheduler") return "plugin_main";
  if (role === "workspace_main" || role === "workspace_implementation" || role === "main_scheduler" || role === "implementation_main") return "workspace_main";
  return "";
}

function isWorkspaceMainRole(value) {
  return Boolean(normalizeWorkspaceMainRole(value));
}

function continuationLineageIndexPath(cwd, pathModule = defaultPath) {
  return pathModule.join(cwd || "", ".agent-context", "thread-handoffs", "index.jsonl");
}

function normalizeContinuationLineageEntry(entry = {}) {
  if (!entry || typeof entry !== "object") return null;
  const newThreadId = compactOneLine(entry.newThreadId);
  const sourceThreadId = compactOneLine(entry.sourceThreadId);
  if (!newThreadId || !sourceThreadId) return null;
  return {
    version: Number(entry.version || 1),
    createdAt: compactOneLine(entry.createdAt || ""),
    workspace: compactOneLine(entry.workspace || ""),
    newThreadId,
    newThreadTitle: compactOneLine(entry.newThreadTitle || ""),
    sourceThreadId,
    sourceThreadTitle: compactOneLine(entry.sourceThreadTitle || ""),
    sourceThreadRole: normalizeWorkspaceMainRole(entry.sourceThreadRole || entry.sourceRole || ""),
    inheritedThreadRole: normalizeWorkspaceMainRole(entry.inheritedThreadRole || entry.threadRole || ""),
    preferredMain: entry.preferredMain === true || entry.workspaceMain === true || entry.currentMain === true,
    sourceArchived: entry.sourceArchived === true,
  };
}

function readContinuationLineageEntries(cwd, options = {}) {
  const fs = options.fs || defaultFs;
  const pathModule = options.path || defaultPath;
  const workspace = compactOneLine(cwd);
  if (!workspace) return [];
  let text = "";
  try {
    text = fs.readFileSync(continuationLineageIndexPath(workspace, pathModule), "utf8");
  } catch (_) {
    return [];
  }
  return text.split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return normalizeContinuationLineageEntry(JSON.parse(line));
      } catch (_) {
        return null;
      }
    })
    .filter(Boolean);
}

function classifyThreadPurpose(thread = {}) {
  const role = threadRole(thread);
  const title = threadTitle(thread).toLowerCase();
  if (role === "home_ai_worker" || role === "plugin_worker" || /\bworker\b|worker[-_\s]*lane|(^|_)worker($|_)/.test(role)) return "worker_lane";
  if (/\bworker\b|\blane\b/.test(title) && !/\bdeploy\b/.test(title)) return "worker_lane";
  if (/\bdeploy\b|deployment|deploy[-_\s]*lane/.test(role) || /\bdeploy\b|deployment|deploy\s*lane/.test(title)) return "deploy_lane";
  if (/\baudit\b|review|product[-_\s]*audit/.test(role) || /\baudit\b|review/.test(title)) return "audit_lane";
  if (/public[-_\s]*pr|public[-_\s]*pull[-_\s]*request/.test(role) || /\bpublic\s+pr\b|\bpublic\s+pull\s+request\b/.test(title)) return "public_pr";
  if (/task[-_\s]*intake|\bintake\b/.test(role) || /\btask\s+intake\b|\bintake\b/.test(title)) return "task_intake";
  return "workspace_main";
}

function explicitNonDeliverability(thread = {}) {
  const status = compactOneLine(thread.status && (thread.status.type || thread.status.status) || thread.status).toLowerCase();
  if (thread.visible === false) return "visible_false";
  if (thread.deliverable === false) return "deliverable_false";
  if (thread.canReceiveTaskCards === false || thread.can_receive_task_cards === false) return "can_receive_task_cards_false";
  if (thread.archived === true || thread.deleted === true || thread.closed === true || thread.hidden === true) return "explicit_non_deliverable_flag";
  if (/^(archived|deleted|closed|hidden)$/.test(status)) return `status_${status}`;
  return "";
}

function inferredWorkspaceMainRole(thread = {}, options = {}) {
  const explicit = normalizeWorkspaceMainRole(threadRole(thread));
  if (explicit) return explicit;
  if (classifyThreadPurpose(thread) !== "workspace_main") return "";
  const title = threadTitle(thread);
  const cwd = normalizeCwd(thread.cwd || thread.workspace || options.cwd || "", options.path);
  if (/^home\s+ai(?:\s+\d{2}-\d{2})?(?:\s|$)/i.test(title)) return "home_ai_main";
  if (/\/plugins\/[^/]+$/.test(cwd)) return "plugin_main";
  return "workspace_main";
}

function inheritedWorkspaceMainThreadRole({ sourceThread = {}, sourceThreadTitle = "", cwd = "", path: pathModule } = {}) {
  const source = Object.assign({}, sourceThread || {});
  if (sourceThreadTitle && !threadTitle(source)) {
    source.title = sourceThreadTitle;
    source.name = sourceThreadTitle;
  }
  if (cwd && !source.cwd) source.cwd = cwd;
  if (explicitNonDeliverability(source) && !threadIdOf(source)) return "";
  return inferredWorkspaceMainRole(source, { cwd, path: pathModule });
}

function compareThreadsByFreshness(left = {}, right = {}) {
  const leftUpdated = Number(left.updatedAt || left.updated_at || left.updatedAtMs || left.updated_at_ms || 0) || 0;
  const rightUpdated = Number(right.updatedAt || right.updated_at || right.updatedAtMs || right.updated_at_ms || 0) || 0;
  if (rightUpdated !== leftUpdated) return rightUpdated - leftUpdated;
  return threadIdOf(left).localeCompare(threadIdOf(right));
}

function createdAtMs(entry = {}) {
  const ms = Date.parse(entry.createdAt || "");
  return Number.isFinite(ms) ? ms : 0;
}

function publicMainThread(thread = {}, details = {}) {
  const role = details.role || inferredWorkspaceMainRole(thread, { cwd: details.cwd, path: details.path });
  const nonDeliverable = explicitNonDeliverability(thread);
  return {
    id: threadIdOf(thread),
    title: threadTitle(thread),
    cwd: compactOneLine(thread.cwd || thread.workspace || details.cwd || ""),
    role,
    threadRole: threadRole(thread),
    purpose: classifyThreadPurpose(thread),
    status: compactOneLine(thread.status && (thread.status.type || thread.status.status) || thread.status),
    deliverable: !nonDeliverable,
    deliverabilityReason: nonDeliverable || "eligible",
    sourceThreadId: compactOneLine(details.sourceThreadId || ""),
    lineageSourceThreadId: compactOneLine(details.lineageSourceThreadId || ""),
    lineageCreatedAt: compactOneLine(details.lineageCreatedAt || ""),
  };
}

function createWorkspaceMainThreadRoutingService(deps = {}) {
  const fs = deps.fs || defaultFs;
  const pathModule = deps.path || defaultPath;
  const readLineageEntries = typeof deps.readContinuationLineageEntries === "function"
    ? deps.readContinuationLineageEntries
    : (cwd) => readContinuationLineageEntries(cwd, { fs, path: pathModule });
  const readThreadSummary = typeof deps.readThreadSummary === "function" ? deps.readThreadSummary : () => null;
  const visibleThreads = typeof deps.visibleThreads === "function" ? deps.visibleThreads : () => [];

  function mainCandidate(thread = {}, input = {}) {
    const id = threadIdOf(thread);
    if (!id) return null;
    const wantedCwd = normalizeCwd(input.cwd || input.workspaceCwd || input.workspace || input.targetWorkspace, pathModule);
    const threadCwd = normalizeCwd(thread.cwd || thread.workspace, pathModule);
    if (wantedCwd && threadCwd !== wantedCwd) return null;
    const nonDeliverable = explicitNonDeliverability(thread);
    const role = inferredWorkspaceMainRole(thread, { cwd: input.cwd, path: pathModule });
    if (!role) return null;
    const requestedRole = normalizeWorkspaceMainRole(input.role || input.threadRole || input.targetRole);
    if (requestedRole && role !== requestedRole && requestedRole !== "workspace_main") return null;
    const purpose = classifyThreadPurpose(thread);
    if (purpose !== "workspace_main") return null;
    if (input.includeIneligible !== true && nonDeliverable) return null;
    return publicMainThread(thread, { role, cwd: input.cwd });
  }

  function visibleCandidateMap(input = {}) {
    const map = new Map();
    for (const thread of visibleThreads() || []) {
      const row = mainCandidate(thread, input);
      if (row) map.set(row.id, { row, thread });
    }
    return map;
  }

  function latestSuccessorsBySource(entries = []) {
    const bySource = new Map();
    for (const entry of entries || []) {
      const source = compactOneLine(entry.sourceThreadId);
      if (!source) continue;
      const current = bySource.get(source);
      if (!current || createdAtMs(entry) >= createdAtMs(current)) bySource.set(source, entry);
    }
    return bySource;
  }

  function resolveLineageCurrent(sourceThreadId, input = {}, candidateMap = visibleCandidateMap(input)) {
    const sourceId = compactOneLine(sourceThreadId);
    if (!sourceId) return null;
    const cwd = compactOneLine(input.cwd || input.workspaceCwd || input.workspace || input.targetWorkspace || "");
    const successors = latestSuccessorsBySource(readLineageEntries(cwd).map(normalizeContinuationLineageEntry).filter(Boolean));
    const seen = new Set();
    let current = sourceId;
    let selected = candidateMap.get(current) || null;
    let selectedEntry = null;
    while (current && !seen.has(current)) {
      seen.add(current);
      const entry = successors.get(current);
      if (!entry) break;
      const next = compactOneLine(entry.newThreadId);
      const nextCandidate = candidateMap.get(next);
      if (!nextCandidate) break;
      if (nextCandidate.row && nextCandidate.row.deliverable === false && input.includeIneligible !== true) break;
      selected = nextCandidate;
      selectedEntry = entry;
      current = next;
    }
    if (!selected) return null;
    return Object.assign({}, selected.row, {
      sourceThreadId: sourceId,
      lineageSourceThreadId: selectedEntry ? selectedEntry.sourceThreadId : "",
      lineageCreatedAt: selectedEntry ? selectedEntry.createdAt : "",
    });
  }

  function list(input = {}) {
    const candidateMap = visibleCandidateMap(input);
    const cwd = compactOneLine(input.cwd || input.workspaceCwd || input.workspace || input.targetWorkspace || "");
    const successors = latestSuccessorsBySource(readLineageEntries(cwd).map(normalizeContinuationLineageEntry).filter(Boolean));
    const superseded = new Set();
    for (const [sourceId, entry] of successors) {
      if (candidateMap.has(entry.newThreadId)) superseded.add(sourceId);
    }
    const rows = [...candidateMap.entries()]
      .filter(([id]) => !superseded.has(id))
      .map(([, value]) => value.row)
      .sort((left, right) => compareThreadsByFreshness(
        readThreadSummary(left.id) || { id: left.id, updatedAt: 0 },
        readThreadSummary(right.id) || { id: right.id, updatedAt: 0 },
      ))
      .slice(0, Math.max(1, Math.min(80, Number(input.limit || 40) || 40)));
    return rows;
  }

  function resolve(input = {}) {
    const threadId = compactOneLine(input.threadId || input.targetThreadId);
    const candidateMap = visibleCandidateMap(Object.assign({}, input, { includeIneligible: true }));
    if (threadId) {
      const row = resolveLineageCurrent(threadId, input, candidateMap) || (candidateMap.get(threadId) && candidateMap.get(threadId).row) || null;
      if (!row) return { ok: false, action: "resolve", error: "thread_lifecycle_main_target_not_found", threads: list(Object.assign({}, input, { includeIneligible: true })).slice(0, 8) };
      return { ok: row.deliverable, action: "resolve", thread: row, error: row.deliverable ? "" : "thread_lifecycle_main_target_not_deliverable" };
    }
    const sourceThreadId = compactOneLine(input.sourceThreadId || input.source_thread_id);
    if (sourceThreadId) {
      const row = resolveLineageCurrent(sourceThreadId, input, candidateMap);
      if (row) return { ok: row.deliverable, action: "resolve", thread: row, error: row.deliverable ? "" : "thread_lifecycle_main_target_not_deliverable" };
    }
    const rows = list(input);
    const resolved = rows.find((thread) => thread.deliverable);
    if (!resolved) return { ok: false, action: "resolve", error: "thread_lifecycle_main_target_not_found", threads: rows.slice(0, 8) };
    return { ok: true, action: "resolve", thread: resolved, error: "" };
  }

  return {
    list,
    mainCandidate,
    resolve,
    resolveLineageCurrent,
  };
}

module.exports = {
  compactOneLine,
  createWorkspaceMainThreadRoutingService,
  inheritedWorkspaceMainThreadRole,
  isWorkspaceMainRole,
  normalizeContinuationLineageEntry,
  normalizeWorkspaceMainRole,
  readContinuationLineageEntries,
};
