"use strict";

const DEFAULT_JOB_TIMEOUT_MS = 300000;
const BROWSER_MODES = new Set(["off", "full"]);
const GATE_MODES = new Set(["periodic", "deploy"]);
const CPU_BUDGET_CLASSES = new Set(["low", "medium", "high"]);

function positiveInteger(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.trunc(number);
}

function cpuBudgetClass(value, fallback = "medium") {
  const text = String(value || "").trim().toLowerCase();
  return CPU_BUDGET_CLASSES.has(text) ? text : fallback;
}

function normalizeRuntimeJobDeclaration(name, declaration = {}) {
  const timeoutMs = positiveInteger(declaration.timeoutMs ?? declaration.timeBudgetMs, DEFAULT_JOB_TIMEOUT_MS);
  const realBrowserAllowed = Boolean(declaration.realBrowserAllowed ?? declaration.usesBrowser);
  const userRequestPreemptible = Boolean(
    declaration.userRequestPreemptible ?? declaration.preemptibleByForeground
  );
  return Object.freeze({
    name,
    timeoutMs,
    timeBudgetMs: timeoutMs,
    maxConcurrency: positiveInteger(declaration.maxConcurrency, 1),
    cpuBudgetClass: cpuBudgetClass(declaration.cpuBudgetClass),
    realBrowserAllowed,
    usesBrowser: realBrowserAllowed,
    userRequestPreemptible,
    preemptibleByForeground: userRequestPreemptible,
    periodicAllowed: declaration.periodicAllowed !== false,
    periodicDefaultEnabled: declaration.periodicDefaultEnabled !== false,
    deployDefaultEnabled: declaration.deployDefaultEnabled !== false,
  });
}

const RUNTIME_SELF_CHECK_JOBS = Object.freeze({
  "hermes-manifest": normalizeRuntimeJobDeclaration("hermes-manifest", {
    timeoutMs: 30000,
    maxConcurrency: 1,
    cpuBudgetClass: "low",
    realBrowserAllowed: false,
    userRequestPreemptible: true,
    periodicAllowed: true,
    periodicDefaultEnabled: false,
    deployDefaultEnabled: true,
  }),
  "api-thread": normalizeRuntimeJobDeclaration("api-thread", {
    maxConcurrency: 1,
    cpuBudgetClass: "medium",
    realBrowserAllowed: false,
    userRequestPreemptible: true,
    periodicAllowed: true,
    periodicDefaultEnabled: false,
    deployDefaultEnabled: true,
  }),
  "browser-runtime": normalizeRuntimeJobDeclaration("browser-runtime", {
    maxConcurrency: 1,
    cpuBudgetClass: "high",
    realBrowserAllowed: true,
    userRequestPreemptible: true,
    periodicAllowed: true,
    periodicDefaultEnabled: false,
    deployDefaultEnabled: true,
  }),
  "browser-vite-preview": normalizeRuntimeJobDeclaration("browser-vite-preview", {
    maxConcurrency: 1,
    cpuBudgetClass: "high",
    realBrowserAllowed: true,
    userRequestPreemptible: true,
    periodicAllowed: true,
    periodicDefaultEnabled: false,
    deployDefaultEnabled: true,
  }),
  "browser-vite-app-preview": normalizeRuntimeJobDeclaration("browser-vite-app-preview", {
    maxConcurrency: 1,
    cpuBudgetClass: "high",
    realBrowserAllowed: true,
    userRequestPreemptible: true,
    periodicAllowed: true,
    periodicDefaultEnabled: false,
    deployDefaultEnabled: true,
  }),
  "browser-vite-app-preview-root": normalizeRuntimeJobDeclaration("browser-vite-app-preview-root", {
    maxConcurrency: 1,
    cpuBudgetClass: "high",
    realBrowserAllowed: true,
    userRequestPreemptible: true,
    periodicAllowed: true,
    periodicDefaultEnabled: false,
    deployDefaultEnabled: true,
  }),
  "browser-vite-app-preview-default-root": normalizeRuntimeJobDeclaration("browser-vite-app-preview-default-root", {
    maxConcurrency: 1,
    cpuBudgetClass: "high",
    realBrowserAllowed: true,
    userRequestPreemptible: true,
    periodicAllowed: true,
    periodicDefaultEnabled: false,
    deployDefaultEnabled: false,
  }),
  "browser-vite-app-preview-default-root-rehearsal": normalizeRuntimeJobDeclaration("browser-vite-app-preview-default-root-rehearsal", {
    maxConcurrency: 1,
    cpuBudgetClass: "high",
    realBrowserAllowed: true,
    userRequestPreemptible: true,
    periodicAllowed: true,
    periodicDefaultEnabled: false,
    deployDefaultEnabled: true,
  }),
  "browser-vite-app-preview-embed": normalizeRuntimeJobDeclaration("browser-vite-app-preview-embed", {
    maxConcurrency: 1,
    cpuBudgetClass: "high",
    realBrowserAllowed: true,
    userRequestPreemptible: true,
    periodicAllowed: true,
    periodicDefaultEnabled: false,
    deployDefaultEnabled: true,
  }),
  "browser-vite-app-preview-session": normalizeRuntimeJobDeclaration("browser-vite-app-preview-session", {
    maxConcurrency: 1,
    cpuBudgetClass: "high",
    realBrowserAllowed: true,
    userRequestPreemptible: true,
    periodicAllowed: true,
    periodicDefaultEnabled: false,
    deployDefaultEnabled: true,
  }),
  "client-events": normalizeRuntimeJobDeclaration("client-events", {
    maxConcurrency: 1,
    cpuBudgetClass: "low",
    realBrowserAllowed: false,
    userRequestPreemptible: false,
    periodicAllowed: true,
    periodicDefaultEnabled: true,
    deployDefaultEnabled: true,
  }),
});

const JOB_ORDER = Object.freeze([
  "hermes-manifest",
  "api-thread",
  "browser-runtime",
  "browser-vite-preview",
  "browser-vite-app-preview",
  "browser-vite-app-preview-root",
  "browser-vite-app-preview-default-root",
  "browser-vite-app-preview-default-root-rehearsal",
  "browser-vite-app-preview-embed",
  "browser-vite-app-preview-session",
  "client-events",
]);

const RUNTIME_PREWARM_JOBS = Object.freeze({
  "thread-list-fallback-prewarm": normalizeRuntimeJobDeclaration("thread-list-fallback-prewarm", {
    timeoutMs: 30000,
    maxConcurrency: 1,
    cpuBudgetClass: "medium",
    realBrowserAllowed: false,
    userRequestPreemptible: true,
    periodicAllowed: false,
    periodicDefaultEnabled: false,
    deployDefaultEnabled: false,
  }),
  "thread-detail-active-window-prewarm": normalizeRuntimeJobDeclaration("thread-detail-active-window-prewarm", {
    timeoutMs: 30000,
    maxConcurrency: 1,
    cpuBudgetClass: "medium",
    realBrowserAllowed: false,
    userRequestPreemptible: true,
    periodicAllowed: false,
    periodicDefaultEnabled: false,
    deployDefaultEnabled: false,
  }),
  "thread-detail-first-paint-prewarm": normalizeRuntimeJobDeclaration("thread-detail-first-paint-prewarm", {
    timeoutMs: 30000,
    maxConcurrency: 1,
    cpuBudgetClass: "medium",
    realBrowserAllowed: false,
    userRequestPreemptible: true,
    periodicAllowed: false,
    periodicDefaultEnabled: false,
    deployDefaultEnabled: false,
  }),
});

const PREWARM_JOB_ORDER = Object.freeze([
  "thread-list-fallback-prewarm",
  "thread-detail-active-window-prewarm",
  "thread-detail-first-paint-prewarm",
]);

const RUNTIME_DIAGNOSTIC_JOBS = Object.freeze({
  "phase-b-readback-smoke": normalizeRuntimeJobDeclaration("phase-b-readback-smoke", {
    timeoutMs: 60000,
    maxConcurrency: 1,
    cpuBudgetClass: "medium",
    realBrowserAllowed: false,
    userRequestPreemptible: true,
    periodicAllowed: false,
    periodicDefaultEnabled: false,
    deployDefaultEnabled: false,
  }),
  "thread-self-check": normalizeRuntimeJobDeclaration("thread-self-check", {
    timeoutMs: 120000,
    maxConcurrency: 1,
    cpuBudgetClass: "medium",
    realBrowserAllowed: false,
    userRequestPreemptible: true,
    periodicAllowed: false,
    periodicDefaultEnabled: false,
    deployDefaultEnabled: false,
  }),
  "projection-replay-visual-smoke": normalizeRuntimeJobDeclaration("projection-replay-visual-smoke", {
    timeoutMs: 120000,
    maxConcurrency: 1,
    cpuBudgetClass: "high",
    realBrowserAllowed: true,
    userRequestPreemptible: true,
    periodicAllowed: false,
    periodicDefaultEnabled: false,
    deployDefaultEnabled: false,
  }),
  "media-render-visual-smoke": normalizeRuntimeJobDeclaration("media-render-visual-smoke", {
    timeoutMs: 120000,
    maxConcurrency: 1,
    cpuBudgetClass: "high",
    realBrowserAllowed: true,
    userRequestPreemptible: true,
    periodicAllowed: false,
    periodicDefaultEnabled: false,
    deployDefaultEnabled: false,
  }),
  "image-order-visual-smoke": normalizeRuntimeJobDeclaration("image-order-visual-smoke", {
    timeoutMs: 120000,
    maxConcurrency: 1,
    cpuBudgetClass: "high",
    realBrowserAllowed: true,
    userRequestPreemptible: true,
    periodicAllowed: false,
    periodicDefaultEnabled: false,
    deployDefaultEnabled: false,
  }),
  "pwa-shell-refresh-smoke": normalizeRuntimeJobDeclaration("pwa-shell-refresh-smoke", {
    timeoutMs: 120000,
    maxConcurrency: 1,
    cpuBudgetClass: "high",
    realBrowserAllowed: true,
    userRequestPreemptible: true,
    periodicAllowed: false,
    periodicDefaultEnabled: false,
    deployDefaultEnabled: false,
  }),
  "empty-detail-cache-smoke": normalizeRuntimeJobDeclaration("empty-detail-cache-smoke", {
    timeoutMs: 120000,
    maxConcurrency: 1,
    cpuBudgetClass: "high",
    realBrowserAllowed: true,
    userRequestPreemptible: true,
    periodicAllowed: false,
    periodicDefaultEnabled: false,
    deployDefaultEnabled: false,
  }),
});

const DIAGNOSTIC_JOB_ORDER = Object.freeze([
  "phase-b-readback-smoke",
  "thread-self-check",
  "projection-replay-visual-smoke",
  "media-render-visual-smoke",
  "image-order-visual-smoke",
  "pwa-shell-refresh-smoke",
  "empty-detail-cache-smoke",
]);

const RUNTIME_BACKFILL_JOBS = Object.freeze({
  "thread-detail-history-auto-backfill": normalizeRuntimeJobDeclaration("thread-detail-history-auto-backfill", {
    timeoutMs: 60000,
    maxConcurrency: 1,
    cpuBudgetClass: "medium",
    realBrowserAllowed: false,
    userRequestPreemptible: true,
    periodicAllowed: false,
    periodicDefaultEnabled: false,
    deployDefaultEnabled: false,
  }),
  "thread-detail-full-backfill": normalizeRuntimeJobDeclaration("thread-detail-full-backfill", {
    timeoutMs: 120000,
    maxConcurrency: 1,
    cpuBudgetClass: "medium",
    realBrowserAllowed: false,
    userRequestPreemptible: true,
    periodicAllowed: false,
    periodicDefaultEnabled: false,
    deployDefaultEnabled: false,
  }),
  "thread-usage-backfill-refresh": normalizeRuntimeJobDeclaration("thread-usage-backfill-refresh", {
    timeoutMs: 30000,
    maxConcurrency: 1,
    cpuBudgetClass: "low",
    realBrowserAllowed: false,
    userRequestPreemptible: true,
    periodicAllowed: false,
    periodicDefaultEnabled: false,
    deployDefaultEnabled: false,
  }),
  "active-overlay-window-backfill": normalizeRuntimeJobDeclaration("active-overlay-window-backfill", {
    timeoutMs: 60000,
    maxConcurrency: 1,
    cpuBudgetClass: "medium",
    realBrowserAllowed: false,
    userRequestPreemptible: true,
    periodicAllowed: false,
    periodicDefaultEnabled: false,
    deployDefaultEnabled: false,
  }),
  "rollout-completion-backfill": normalizeRuntimeJobDeclaration("rollout-completion-backfill", {
    timeoutMs: 30000,
    maxConcurrency: 1,
    cpuBudgetClass: "low",
    realBrowserAllowed: false,
    userRequestPreemptible: true,
    periodicAllowed: false,
    periodicDefaultEnabled: false,
    deployDefaultEnabled: false,
  }),
});

const BACKFILL_JOB_ORDER = Object.freeze([
  "thread-detail-history-auto-backfill",
  "thread-detail-full-backfill",
  "thread-usage-backfill-refresh",
  "active-overlay-window-backfill",
  "rollout-completion-backfill",
]);

const RUNTIME_JOB_REGISTRY = Object.freeze({
  ...RUNTIME_SELF_CHECK_JOBS,
  ...RUNTIME_PREWARM_JOBS,
  ...RUNTIME_DIAGNOSTIC_JOBS,
  ...RUNTIME_BACKFILL_JOBS,
});

const RUNTIME_JOB_ORDER = Object.freeze([
  ...JOB_ORDER,
  ...PREWARM_JOB_ORDER,
  ...DIAGNOSTIC_JOB_ORDER,
  ...BACKFILL_JOB_ORDER,
]);

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

function runtimeJobPlanFields(spec) {
  return {
    timeoutMs: spec.timeoutMs,
    timeBudgetMs: spec.timeBudgetMs,
    maxConcurrency: spec.maxConcurrency,
    cpuBudgetClass: spec.cpuBudgetClass,
    realBrowserAllowed: spec.realBrowserAllowed,
    usesBrowser: spec.usesBrowser,
    userRequestPreemptible: spec.userRequestPreemptible,
    preemptibleByForeground: spec.preemptibleByForeground,
    periodicAllowed: spec.periodicAllowed,
  };
}

function runtimeJobPolicy(spec) {
  return runtimeJobPlanFields(spec || {});
}

function runtimeJobDeclaration(name = "") {
  return RUNTIME_JOB_REGISTRY[String(name || "")] || null;
}

function disabledJob(spec, reason) {
  return {
    name: spec.name,
    enabled: false,
    reason,
    ...runtimeJobPlanFields(spec),
  };
}

function enabledJob(spec) {
  return {
    name: spec.name,
    enabled: true,
    reason: "enabled",
    ...runtimeJobPlanFields(spec),
  };
}

function skipFlagForJobName(name) {
  if (name === "hermes-manifest" || name === "api-thread") return "skipApi";
  if (name === "browser-runtime"
    || name === "browser-vite-preview"
    || name === "browser-vite-app-preview"
    || name === "browser-vite-app-preview-root"
    || name === "browser-vite-app-preview-default-root"
    || name === "browser-vite-app-preview-default-root-rehearsal"
    || name === "browser-vite-app-preview-embed"
    || name === "browser-vite-app-preview-session") return "skipBrowser";
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
  if (name === "browser-vite-app-preview-default-root" && !options.browserViteAppPreviewDefaultRoot) {
    return disabledJob(spec, "explicit_flag_required");
  }
  if (name === "browser-vite-app-preview-default-root-rehearsal" && options.skipViteDefaultRootRehearsal) {
    return disabledJob(spec, "skip_flag");
  }
  if (gateMode === "periodic" && !spec.periodicAllowed) return disabledJob(spec, "periodic_not_allowed");
  if (spec.realBrowserAllowed && browserMode !== "full") return disabledJob(spec, "browser_mode_off");
  if (gateMode === "periodic" && !spec.periodicDefaultEnabled && !(spec.realBrowserAllowed && browserMode === "full")) {
    return disabledJob(spec, "periodic_not_default");
  }
  if (gateMode === "deploy" && !spec.deployDefaultEnabled
    && !(name === "browser-vite-app-preview-default-root" && options.browserViteAppPreviewDefaultRoot)) {
    return disabledJob(spec, "deploy_not_default");
  }
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
      foregroundPreemptible: jobs.some((job) => job.enabled && job.userRequestPreemptible),
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
  BACKFILL_JOB_ORDER,
  DEFAULT_JOB_TIMEOUT_MS,
  DIAGNOSTIC_JOB_ORDER,
  JOB_ORDER,
  PREWARM_JOB_ORDER,
  RUNTIME_BACKFILL_JOBS,
  RUNTIME_DIAGNOSTIC_JOBS,
  RUNTIME_JOB_ORDER,
  RUNTIME_JOB_REGISTRY,
  RUNTIME_PREWARM_JOBS,
  RUNTIME_SELF_CHECK_JOBS,
  defaultBrowserModeForGate,
  normalizeBrowserMode,
  normalizeGateMode,
  normalizeRuntimeJobDeclaration,
  planRuntimeSelfCheckJob,
  resolveRuntimeSelfCheckPlan,
  runtimeJobDeclaration,
  runtimeJobPolicy,
  runtimeSelfCheckJob,
};
