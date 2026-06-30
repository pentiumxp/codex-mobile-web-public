"use strict";

const path = require("node:path");

const DEFAULT_HOME_AI_APP_CWD = "/Users/hermes-dev/HermesMobileDev/app";
const HOME_AI_DEPLOY_LANE_TITLE = "Home AI Deploy";
const DEFAULT_HOME_AI_DEPLOY_LANE_TITLES = Object.freeze([
  HOME_AI_DEPLOY_LANE_TITLE,
  "Home AI Deploy Lane A",
  "Home AI Deploy Lane B",
  "Home AI Deploy Lane C",
  "Codex Mobile Deploy Lane",
  "Movie Deploy Lane",
]);
const DEFAULT_HOME_AI_DEPLOY_LANE_ASSIGNMENTS = Object.freeze({
  "codex-mobile-web": "Codex Mobile Deploy Lane",
  "codex-mobile": "Codex Mobile Deploy Lane",
  movie: "Movie Deploy Lane",
});

function normalizeFsPath(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    return path.resolve(text).replace(/^\\\\\?\\/, "").replace(/[\\/]+/g, path.sep).toLowerCase();
  } catch (_) {
    return text.replace(/^\\\\\?\\/, "").replace(/[\\/]+/g, path.sep).toLowerCase();
  }
}

function statusText(status) {
  if (!status) return "";
  if (typeof status === "string") return status;
  if (typeof status === "object") return String(status.type || status.status || "").trim();
  return String(status || "").trim();
}

function displayTitle(thread) {
  return String(thread && (thread.name || thread.title || thread.threadName || thread.thread_name || thread.preview || "") || "").trim();
}

function normalizeTitle(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function homeAiAppCwd(options = {}) {
  return String(options.homeAiAppCwd || process.env.HOME_AI_APP_ROOT || DEFAULT_HOME_AI_APP_CWD).trim();
}

function isHomeAiControlPlaneCwd(cwd, options = {}) {
  const expected = normalizeFsPath(homeAiAppCwd(options));
  return Boolean(expected && normalizeFsPath(cwd) === expected);
}

function splitConfiguredValues(value) {
  return String(value || "")
    .split(/[\n,;，；]+/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function homeAiDeployLaneTitles(options = {}) {
  const configured = Array.isArray(options.deployLaneTitles)
    ? options.deployLaneTitles
    : splitConfiguredValues(options.deployLaneTitles || process.env.HOMEAI_DEPLOY_THREAD_TITLES);
  const titles = configured.length ? configured : DEFAULT_HOME_AI_DEPLOY_LANE_TITLES;
  const seen = new Set();
  const out = [];
  for (const title of titles) {
    const text = String(title || "").trim();
    const key = normalizeTitle(text);
    if (!text || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

function homeAiDeployLaneTitleSet(options = {}) {
  return new Set(homeAiDeployLaneTitles(options).map(normalizeTitle));
}

function isHomeAiDeployLaneThread(thread, options = {}) {
  if (!thread || typeof thread !== "object") return false;
  return homeAiDeployLaneTitleSet(options).has(normalizeTitle(displayTitle(thread)))
    && isHomeAiControlPlaneCwd(thread.cwd, options);
}

function isPluginSourceCwd(cwd, options = {}) {
  const normalized = normalizeFsPath(cwd);
  if (!normalized) return false;
  if (isHomeAiControlPlaneCwd(cwd, options)) return false;
  return normalized.includes(`${path.sep}plugins${path.sep}`);
}

function isTerminalDeployLaneStatus(status) {
  return /^(completed|complete|failed|failure|cancelled|canceled|interrupted|error)$/i.test(statusText(status));
}

function normalizeHomeAiDeployLaneSummary(thread, options = {}) {
  if (!isHomeAiDeployLaneThread(thread, options)) return thread;
  if (thread.archived || thread.deleted) return thread;
  const currentStatus = statusText(thread.status);
  const live = /^(active|running|queued|processing|inprogress|in_progress|in-progress)$/i.test(currentStatus);
  if (live) return Object.assign({}, thread, { mobileDeployLane: true });
  const normalized = Object.assign({}, thread, {
    mobileDeployLane: true,
    status: {
      type: "idle",
      mobileDeployLane: true,
      previousType: currentStatus || "",
    },
  });
  delete normalized.activeTurnId;
  delete normalized.active_turn_id;
  delete normalized.mobileLocalActiveStatus;
  delete normalized.mobileRolloutActiveTurn;
  delete normalized.mobileActiveTurnId;
  return normalized;
}

function normalizePluginId(value) {
  const text = String(value || "").trim().toLowerCase();
  return /^[a-z0-9][a-z0-9._-]{0,100}$/i.test(text) ? text : "";
}

function parseDeployLaneAssignments(value) {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  const text = String(value || "").trim();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    const out = {};
    for (const entry of splitConfiguredValues(text)) {
      const match = entry.match(/^([^:=]+)\s*[:=]\s*(.+)$/);
      if (match) out[match[1].trim()] = match[2].trim();
    }
    return out;
  }
}

function homeAiDeployLaneAssignments(options = {}) {
  return Object.assign(
    {},
    DEFAULT_HOME_AI_DEPLOY_LANE_ASSIGNMENTS,
    parseDeployLaneAssignments(options.deployLaneAssignments || process.env.HOMEAI_DEPLOY_LANE_ASSIGNMENTS),
  );
}

function routinePluginId(input = {}, sourceThread = {}) {
  const explicit = normalizePluginId(input.pluginId || input.plugin_id || input.plugin || input.pluginName || input.plugin_name);
  if (explicit) return explicit;
  const text = boundedTaskText(input).toLowerCase();
  if (/\bcodex-mobile-web\b|codex mobile/.test(text)) return "codex-mobile-web";
  if (/\bmovie\b|电影/.test(text)) return "movie";
  const cwd = normalizeFsPath(sourceThread && sourceThread.cwd);
  if (cwd.endsWith(`${path.sep}plugins${path.sep}codex-mobile-web`)) return "codex-mobile-web";
  const pluginMatch = cwd.match(new RegExp(`${path.sep}plugins${path.sep}([^${path.sep}]+)$`));
  return pluginMatch ? normalizePluginId(pluginMatch[1]) : "";
}

function boundedTaskText(input = {}) {
  return [
    input.cardKind,
    input.taskCardKind,
    input.category,
    input.title,
    input.summary,
    input.body,
    input.bodyMarkdown,
    input.message,
  ].map((value) => String(value || "")).join("\n").slice(0, 20_000);
}

function hasStructuredDeployKind(input = {}) {
  const value = String(input.cardKind || input.taskCardKind || input.category || input.kind || "").trim().toLowerCase();
  return [
    "plugin_deployment",
    "plugin-deployment",
    "routine_plugin_deploy",
    "routine-plugin-deploy",
    "plugin-production-deploy",
  ].includes(value);
}

function isHostPlatformRepairText(text) {
  return /(?:home ai central|host-owned|host owned|deploy-contract|deploy contract|proxy|launchd|gateway|schema|platform repair|home ai source|control-plane|控制平面|部署契约|宿主|平台修复)/i.test(text);
}

function isDeploymentText(text) {
  return /(?:\bdeploy(?:ment)?\b|deploy:macos|deploy-macos|production deploy|public-config|readback|部署|上线|生产部署)/i.test(text);
}

function isPluginDeploymentText(text) {
  return /(?:\bplugin\b|--plugin|plugin-owned|plugin owned|插件|codex-mobile-web|codex mobile)/i.test(text);
}

function isRoutinePluginDeploymentRequest(input = {}, sourceThread = {}, options = {}) {
  const text = boundedTaskText(input);
  if (hasStructuredDeployKind(input)) return true;
  if (isHostPlatformRepairText(text)) return false;
  if (!isDeploymentText(text)) return false;
  return isPluginSourceCwd(sourceThread && sourceThread.cwd, options) || isPluginDeploymentText(text);
}

function findHomeAiDeployLaneThread(threads = [], options = {}) {
  const title = String(options.title || "").trim();
  const titleKey = normalizeTitle(title);
  const matches = [];
  for (const thread of threads || []) {
    if (!isHomeAiDeployLaneThread(thread, options)) continue;
    if (thread.archived || thread.deleted) continue;
    if (titleKey && normalizeTitle(displayTitle(thread)) !== titleKey) continue;
    matches.push(normalizeHomeAiDeployLaneSummary(thread, options));
  }
  return matches.length === 1 ? matches[0] : null;
}

function findHomeAiDeployLaneThreads(threads = [], options = {}) {
  const byId = new Map();
  for (const thread of threads || []) {
    if (!thread || !isHomeAiDeployLaneThread(thread, options) || thread.archived || thread.deleted) continue;
    const id = String(thread.id || "").trim();
    if (!id || byId.has(id)) continue;
    byId.set(id, normalizeHomeAiDeployLaneSummary(thread, options));
  }
  return [...byId.values()];
}

function duplicateDeployLaneTitles(threads = [], options = {}) {
  const counts = new Map();
  for (const thread of findHomeAiDeployLaneThreads(threads, options)) {
    const key = normalizeTitle(displayTitle(thread));
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Array.from(counts.entries())
    .filter((entry) => entry[1] > 1)
    .map((entry) => entry[0]);
}

function stableHashIndex(value, modulo) {
  if (!modulo) return -1;
  const text = String(value || "");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % modulo;
}

function deployLaneTitleForPlugin(pluginId, options = {}) {
  const id = normalizePluginId(pluginId);
  const titles = homeAiDeployLaneTitles(options);
  const assignments = homeAiDeployLaneAssignments(options);
  const assigned = id ? String(assignments[id] || "").trim() : "";
  if (assigned) return assigned;
  if (id && titles.length) return titles[stableHashIndex(id, titles.length)];
  return HOME_AI_DEPLOY_LANE_TITLE;
}

function findDeployLaneForPlugin(threads = [], pluginId = "", options = {}) {
  const title = deployLaneTitleForPlugin(pluginId, options);
  const deployLane = findHomeAiDeployLaneThread(threads, Object.assign({}, options, { title }));
  return { title, deployLane };
}

function planHomeAiDeployLaneRouting(input = {}) {
  const body = input.body && typeof input.body === "object" ? input.body : {};
  const sourceThread = input.sourceThread && typeof input.sourceThread === "object" ? input.sourceThread : {};
  const targets = Array.isArray(input.targetThreads) ? input.targetThreads.filter(Boolean) : [];
  const visibleThreads = Array.isArray(input.visibleThreads) ? input.visibleThreads.filter(Boolean) : [];
  const options = input.options || {};
  if (!isRoutinePluginDeploymentRequest(body, sourceThread, options)) {
    return { action: "allow", reason: "not_routine_plugin_deployment" };
  }
  const duplicates = duplicateDeployLaneTitles([...targets, ...visibleThreads], options);
  if (duplicates.length) {
    return {
      action: "reject",
      code: "deploy_lane_ambiguous",
      message: "Routine plugin deployment cards require a unique configured deploy lane title.",
      reason: "deploy_lane_ambiguous",
      duplicateTitles: duplicates,
    };
  }
  const homeAiTargets = targets.filter((thread) => thread && isHomeAiControlPlaneCwd(thread.cwd, options));
  const nonDeployHomeAiTargets = homeAiTargets.filter((thread) => !isHomeAiDeployLaneThread(thread, options));
  if (!nonDeployHomeAiTargets.length) {
    return { action: "allow", reason: "target_is_not_ordinary_home_ai" };
  }
  const pluginId = routinePluginId(body, sourceThread);
  const laneMatch = findDeployLaneForPlugin([...targets, ...visibleThreads], pluginId, options);
  const deployLane = laneMatch.deployLane;
  if (!deployLane) {
    return {
      action: "reject",
      code: "deploy_lane_required",
      message: `Routine plugin deployment cards must target a live configured deploy lane${laneMatch.title ? ` (${laneMatch.title})` : ""}.`,
      reason: "deploy_lane_missing",
      pluginId,
      expectedDeployLaneTitle: laneMatch.title,
    };
  }
  if (isTerminalDeployLaneStatus(deployLane.status) && !deployLane.mobileDeployLane) {
    return {
      action: "reject",
      code: "deploy_lane_required",
      message: "Routine plugin deployment cards must target a runnable Home AI Deploy lane.",
      reason: "deploy_lane_terminal",
      deployLane,
    };
  }
  return {
    action: "retarget",
    reason: "routine_plugin_deployment_uses_deploy_lane",
    deployLane,
    pluginId,
    expectedDeployLaneTitle: laneMatch.title,
    targetThreadIds: Array.from(new Set(targets.map((thread) => {
      if (thread && isHomeAiControlPlaneCwd(thread.cwd, options) && !isHomeAiDeployLaneThread(thread, options)) {
        return deployLane.id;
      }
      return thread && thread.id;
    }).filter(Boolean))),
  };
}

function prioritizeDelegationTargetHints(threads = [], options = {}) {
  const normalized = (threads || []).map((thread) => normalizeHomeAiDeployLaneSummary(thread, options));
  const scored = normalized.map((thread, index) => {
    const deployLane = isHomeAiDeployLaneThread(thread, options);
    const titleIndex = deployLane ? homeAiDeployLaneTitles(options).map(normalizeTitle).indexOf(normalizeTitle(displayTitle(thread))) : -1;
    return { thread, index, score: deployLane ? 0 : 10, titleIndex: titleIndex < 0 ? 999 : titleIndex };
  });
  return scored
    .sort((left, right) => (left.score - right.score) || (left.titleIndex - right.titleIndex) || (right.thread.updatedAt || 0) - (left.thread.updatedAt || 0) || left.index - right.index)
    .map((entry) => entry.thread);
}

module.exports = {
  DEFAULT_HOME_AI_APP_CWD,
  DEFAULT_HOME_AI_DEPLOY_LANE_ASSIGNMENTS,
  DEFAULT_HOME_AI_DEPLOY_LANE_TITLES,
  HOME_AI_DEPLOY_LANE_TITLE,
  deployLaneTitleForPlugin,
  findHomeAiDeployLaneThread,
  findHomeAiDeployLaneThreads,
  homeAiDeployLaneAssignments,
  homeAiDeployLaneTitles,
  isHomeAiControlPlaneCwd,
  isHomeAiDeployLaneThread,
  isPluginSourceCwd,
  isRoutinePluginDeploymentRequest,
  isTerminalDeployLaneStatus,
  normalizeHomeAiDeployLaneSummary,
  routinePluginId,
  planHomeAiDeployLaneRouting,
  prioritizeDelegationTargetHints,
  statusText,
};
