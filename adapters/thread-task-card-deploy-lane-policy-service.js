"use strict";

const path = require("node:path");

const DEFAULT_HOME_AI_APP_CWD = "/Users/hermes-dev/HermesMobileDev/app";
const HOME_AI_DEPLOY_LANE_TITLE = "Home AI Deploy";

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

function homeAiAppCwd(options = {}) {
  return String(options.homeAiAppCwd || process.env.HOME_AI_APP_ROOT || DEFAULT_HOME_AI_APP_CWD).trim();
}

function isHomeAiControlPlaneCwd(cwd, options = {}) {
  const expected = normalizeFsPath(homeAiAppCwd(options));
  return Boolean(expected && normalizeFsPath(cwd) === expected);
}

function isHomeAiDeployLaneThread(thread, options = {}) {
  if (!thread || typeof thread !== "object") return false;
  return displayTitle(thread).toLowerCase() === HOME_AI_DEPLOY_LANE_TITLE.toLowerCase()
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
  return Object.assign({}, thread, {
    mobileDeployLane: true,
    status: {
      type: "idle",
      mobileDeployLane: true,
      previousType: currentStatus || "",
    },
  });
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
  for (const thread of threads || []) {
    if (!isHomeAiDeployLaneThread(thread, options)) continue;
    if (thread.archived || thread.deleted) continue;
    return normalizeHomeAiDeployLaneSummary(thread, options);
  }
  return null;
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
  const homeAiTargets = targets.filter((thread) => thread && isHomeAiControlPlaneCwd(thread.cwd, options));
  const nonDeployHomeAiTargets = homeAiTargets.filter((thread) => !isHomeAiDeployLaneThread(thread, options));
  if (!nonDeployHomeAiTargets.length) {
    return { action: "allow", reason: "target_is_not_ordinary_home_ai" };
  }
  const deployLane = findHomeAiDeployLaneThread([...targets, ...visibleThreads], options);
  if (!deployLane) {
    return {
      action: "reject",
      code: "deploy_lane_required",
      message: "Routine plugin deployment cards must target the Home AI Deploy lane.",
      reason: "deploy_lane_missing",
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
    return { thread, index, score: deployLane ? 0 : 10 };
  });
  return scored
    .sort((left, right) => (left.score - right.score) || (right.thread.updatedAt || 0) - (left.thread.updatedAt || 0) || left.index - right.index)
    .map((entry) => entry.thread);
}

module.exports = {
  DEFAULT_HOME_AI_APP_CWD,
  HOME_AI_DEPLOY_LANE_TITLE,
  findHomeAiDeployLaneThread,
  isHomeAiControlPlaneCwd,
  isHomeAiDeployLaneThread,
  isPluginSourceCwd,
  isRoutinePluginDeploymentRequest,
  isTerminalDeployLaneStatus,
  normalizeHomeAiDeployLaneSummary,
  planHomeAiDeployLaneRouting,
  prioritizeDelegationTargetHints,
  statusText,
};
