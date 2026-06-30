"use strict";

const DEFAULT_JOB_TIMEOUT_MS = 300000;
const BROWSER_MODES = new Set(["off", "full"]);
const GATE_MODES = new Set(["periodic", "deploy"]);

const RUNTIME_SELF_CHECK_JOBS = Object.freeze({
  "api-thread": Object.freeze({
    name: "api-thread",
    timeoutMs: DEFAULT_JOB_TIMEOUT_MS,
    maxConcurrency: 1,
    usesBrowser: false,
    preemptibleByForeground: true,
    periodicDefaultEnabled: true,
    deployDefaultEnabled: true,
  }),
  "browser-runtime": Object.freeze({
    name: "browser-runtime",
    timeoutMs: DEFAULT_JOB_TIMEOUT_MS,
    maxConcurrency: 1,
    usesBrowser: true,
    preemptibleByForeground: true,
    periodicDefaultEnabled: false,
    deployDefaultEnabled: true,
  }),
  "client-events": Object.freeze({
    name: "client-events",
    timeoutMs: DEFAULT_JOB_TIMEOUT_MS,
    maxConcurrency: 1,
    usesBrowser: false,
    preemptibleByForeground: false,
    periodicDefaultEnabled: true,
    deployDefaultEnabled: true,
  }),
});

const JOB_ORDER = Object.freeze(["api-thread", "browser-runtime", "client-events"]);

function normalizeBrowserMode(value, fallback = "") {
  const text = String(value || "").trim().toLowerCase();
  if (BROWSER_MODES.has(text)) return text;
  return fallback;
}

function normalizeGateMode(value, fallback = "periodic") {
  const text = String(value || "").trim().toLowerCase();
  if (GATE_MODES.has(text)) return text;
  return fallback;
}

function defaultBrowserModeForGate(gateMode = "periodic", browserMode = "") {
  const normalizedGateMode = normalizeGateMode(gateMode);
  const normalizedBrowserMode = normalizeBrowserMode(browserMode);
  if (normalizedBrowserMode) return normalizedBrowserMode;
  return normalizedGateMode === "deploy" ? "full" : "off";
}

function disabledJob(spec, reason) {
  return {
    name: spec.name,
    enabled: false,
    reason,
    timeoutMs: spec.timeoutMs,
    maxConcurrency: spec.maxConcurrency,
    usesBrowser: spec.usesBrowser,
    preemptibleByForeground: spec.preemptibleByForeground,
  };
}

function enabledJob(spec) {
  return {
    name: spec.name,
    enabled: true,
    reason: "enabled",
    timeoutMs: spec.timeoutMs,
    maxConcurrency: spec.maxConcurrency,
    usesBrowser: spec.usesBrowser,
    preemptibleByForeground: spec.preemptibleByForeground,
  };
}

function skipFlagForJobName(name) {
  if (name === "api-thread") return "skipApi";
  if (name === "browser-runtime") return "skipBrowser";
  if (name === "client-events") return "skipClientEvents";
  return "";
}

function planRuntimeSelfCheckJob(name, options = {}) {
  const spec = RUNTIME_SELF_CHECK_JOBS[name];
  if (!spec) return null;
  const gateMode = normalizeGateMode(options.gateMode);
  const browserMode = defaultBrowserModeForGate(gateMode, options.browserMode);
  const skipFlag = skipFlagForJobName(name);
  if (skipFlag && options[skipFlag]) return disabledJob(spec, "skip_flag");
  if (spec.usesBrowser && browserMode !== "full") return disabledJob(spec, "browser_mode_off");
  if (gateMode === "periodic" && !spec.periodicDefaultEnabled && browserMode !== "full") {
    return disabledJob(spec, "periodic_not_default");
  }
  if (gateMode === "deploy" && !spec.deployDefaultEnabled) return disabledJob(spec, "deploy_not_default");
  return enabledJob(spec);
}

function resolveRuntimeSelfCheckPlan(options = {}) {
  const gateMode = normalizeGateMode(options.gateMode);
  const browserMode = defaultBrowserModeForGate(gateMode, options.browserMode);
  const jobs = JOB_ORDER.map((name) => planRuntimeSelfCheckJob(name, {
    ...options,
    gateMode,
    browserMode,
  })).filter(Boolean);
  const enabledJobNames = jobs.filter((job) => job.enabled).map((job) => job.name);
  return {
    privacy: "metadata_only",
    profile: {
      gateMode,
      browserMode,
      foregroundPreemptible: jobs.some((job) => job.enabled && job.preemptibleByForeground),
    },
    jobs,
    enabledJobNames,
  };
}

function runtimeSelfCheckJob(plan = {}, name = "") {
  const jobs = Array.isArray(plan.jobs) ? plan.jobs : [];
  return jobs.find((job) => job && job.name === name) || null;
}

module.exports = {
  DEFAULT_JOB_TIMEOUT_MS,
  JOB_ORDER,
  RUNTIME_SELF_CHECK_JOBS,
  defaultBrowserModeForGate,
  normalizeBrowserMode,
  normalizeGateMode,
  resolveRuntimeSelfCheckPlan,
  runtimeSelfCheckJob,
};
