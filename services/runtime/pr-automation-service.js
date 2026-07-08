"use strict";

const crypto = require("node:crypto");
const path = require("node:path");

const DEFAULT_PRIVATE_REPOSITORY = "pentiumxp/codex-mobile-web";
const DEFAULT_PUBLIC_REPOSITORY = "pentiumxp/codex-mobile-web-public";
const DEFAULT_PLUGIN_ID = "codex-mobile-web";
const DEFAULT_WORKSPACE_CWD = "/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web";

const PR_AUTOMATION_STATES = Object.freeze([
  "discovered",
  "already_absorbed",
  "absorption_dispatched",
  "absorbed_private",
  "validation_failed",
  "deploy_dispatched",
  "deploy_readback_passed",
  "public_sync_dispatched",
  "public_ready",
  "pr_closed",
  "blocked",
]);

const PR_AUTOMATION_ISSUE_CODES = Object.freeze({
  ABSORPTION_REQUIRED: "absorption_required",
  CLEAN_WORKTREE_REQUIRED: "clean_worktree_required",
  DEPLOY_READBACK_REQUIRED: "deploy_readback_required",
  GENERATED_ARTIFACTS_REBUILD_REQUIRED: "generated_artifacts_rebuild_required",
  GITHUB_CREDENTIALS_MISSING: "github_credentials_missing",
  NO_OPEN_PULL_REQUESTS: "no_open_pull_requests",
  PR_CLOSE_GATE_REQUIRED: "pr_close_gate_required",
  PUBLIC_READY_GATE_REQUIRED: "public_ready_gate_required",
  PUBLIC_SYNC_REQUIRED: "public_sync_required",
  RELEASE_HOLD_ACTIVE: "release_hold_active",
  SHARED_CHECKOUT_DIRTY: "shared_checkout_dirty",
  VALIDATION_FAILED: "validation_failed",
});

const GENERATED_ARTIFACT_PATTERNS = Object.freeze([
  /^dist\//,
  /^public\/vite-shell\//,
  /^public\/shell-asset-manifest\.(?:json|js)$/u,
  /^public\/vite-shell-readback\.json$/u,
]);

function compactText(value, maxChars = 240) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(1, maxChars - 3))}...`;
}

function normalizeRepositorySlug(value, fallback = "") {
  const text = String(value || "").trim() || String(fallback || "").trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(text)) return "";
  return text;
}

function normalizeSha(value) {
  const text = String(value || "").trim();
  return /^[a-f0-9]{7,64}$/i.test(text) ? text.toLowerCase() : "";
}

function shortSha(value) {
  const text = normalizeSha(value);
  return text ? text.slice(0, 8) : "";
}

function stableHash(value, length = 16) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, length);
}

function normalizeBoolean(value, fallback = false) {
  if (value === true || value === false) return value;
  if (value == null || value === "") return fallback;
  const text = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(text)) return true;
  if (["0", "false", "no", "n"].includes(text)) return false;
  return fallback;
}

function normalizePrNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.trunc(number);
}

function normalizeIso(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const ms = Date.parse(text);
  if (!Number.isFinite(ms)) return "";
  return new Date(ms).toISOString();
}

function normalizePathForPolicy(value) {
  return String(value || "").trim().replace(/\\/g, "/").replace(/^\/+/, "");
}

function isGeneratedArtifactPath(value) {
  const filePath = normalizePathForPolicy(value);
  if (!filePath) return false;
  return GENERATED_ARTIFACT_PATTERNS.some((pattern) => pattern.test(filePath));
}

function normalizeFilePathEntry(entry) {
  if (!entry) return "";
  if (typeof entry === "string") return normalizePathForPolicy(entry);
  if (typeof entry === "object") {
    return normalizePathForPolicy(entry.path || entry.filename || entry.file || entry.name);
  }
  return "";
}

function normalizeFilePaths(values = []) {
  const raw = Array.isArray(values) ? values : [];
  const seen = new Set();
  const out = [];
  for (const entry of raw) {
    const filePath = normalizeFilePathEntry(entry);
    if (!filePath || seen.has(filePath)) continue;
    seen.add(filePath);
    out.push(filePath);
  }
  return out.sort();
}

function normalizeLabels(value = []) {
  const raw = Array.isArray(value) ? value : [];
  const seen = new Set();
  const labels = [];
  for (const entry of raw) {
    const text = compactText(typeof entry === "string" ? entry : entry && (entry.name || entry.title), 80);
    if (!text || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    labels.push(text);
  }
  return labels.sort((left, right) => left.localeCompare(right));
}

function normalizePullRequest(value, defaults = {}) {
  if (!value || typeof value !== "object") return null;
  const number = normalizePrNumber(value.number);
  if (!number) return null;
  if (value.draft === true || value.isDraft === true) return null;
  const repository = normalizeRepositorySlug(value.repository || value.repo || value.repositorySlug, defaults.repository);
  if (!repository) return null;
  const repoKind = String(value.repoKind || value.repositoryKind || defaults.repoKind || "").trim().toLowerCase() || "public";
  const headSha = normalizeSha(value.headSha || value.headRefOid || value.head_ref_oid || value.head && value.head.sha);
  const filePaths = normalizeFilePaths(value.filePaths || value.files || value.changedFiles || value.changed_files);
  const generatedArtifactPaths = filePaths.filter(isGeneratedArtifactPath);
  const createdAt = normalizeIso(value.createdAt || value.created_at);
  const updatedAt = normalizeIso(value.updatedAt || value.updated_at || createdAt);
  return Object.freeze({
    repoKind,
    repository,
    number,
    title: compactText(value.title, 240),
    url: compactText(value.url || value.htmlUrl || value.html_url, 400),
    author: compactText(value.author && typeof value.author === "object" ? value.author.login : value.author || value.user && value.user.login, 100),
    createdAt,
    updatedAt,
    headRefName: compactText(value.headRefName || value.head_ref_name || value.head && value.head.ref, 160),
    headSha,
    headShort: shortSha(headSha),
    baseRefName: compactText(value.baseRefName || value.base_ref_name || value.base && value.base.ref || "main", 160),
    baseSha: normalizeSha(value.baseSha || value.baseRefOid || value.base_ref_oid || value.base && value.base.sha),
    mergeStateStatus: compactText(value.mergeStateStatus || value.merge_state_status || value.mergeableState, 80),
    labels: normalizeLabels(value.labels),
    filePaths,
    changedFileCount: Number.isFinite(Number(value.changedFileCount || value.changed_files))
      ? Math.max(0, Math.trunc(Number(value.changedFileCount || value.changed_files)))
      : filePaths.length,
    generatedArtifactPaths,
    hasGeneratedArtifacts: generatedArtifactPaths.length > 0,
  });
}

function pullRequestIdentity(pr) {
  if (!pr) return "";
  return `github-pr:${pr.repository}:${pr.number}`;
}

function pullRequestRevisionIdentity(pr) {
  if (!pr) return "";
  const head = pr.headSha || pr.headRefName || "unknown-head";
  return `${pullRequestIdentity(pr)}:${head}`;
}

function automationRunId(pr) {
  return `pr-auto-${stableHash(pullRequestRevisionIdentity(pr), 18)}`;
}

function prUpdatedAtMs(pr) {
  const updated = Date.parse(pr && pr.updatedAt || "");
  if (Number.isFinite(updated)) return updated;
  const created = Date.parse(pr && pr.createdAt || "");
  return Number.isFinite(created) ? created : 0;
}

function comparePullRequestPriority(left, right) {
  const updatedDelta = prUpdatedAtMs(right) - prUpdatedAtMs(left);
  if (updatedDelta) return updatedDelta;
  if (left.repoKind !== right.repoKind) return left.repoKind === "public" ? -1 : 1;
  return Number(right.number || 0) - Number(left.number || 0);
}

function normalizeOpenPullRequests(values = [], defaults = {}) {
  const raw = Array.isArray(values) ? values : [];
  const byIdentity = new Map();
  for (const entry of raw) {
    const pr = normalizePullRequest(entry, defaults);
    if (!pr) continue;
    const identity = pullRequestIdentity(pr);
    if (!byIdentity.has(identity)) byIdentity.set(identity, pr);
  }
  return [...byIdentity.values()].sort(comparePullRequestPriority);
}

function publicPullRequestSummary(pr) {
  if (!pr) return null;
  return {
    identity: pullRequestIdentity(pr),
    revisionIdentity: pullRequestRevisionIdentity(pr),
    runId: automationRunId(pr),
    repoKind: pr.repoKind,
    repository: pr.repository,
    number: pr.number,
    title: pr.title,
    updatedAt: pr.updatedAt,
    headRefName: pr.headRefName,
    headShort: pr.headShort,
    baseRefName: pr.baseRefName,
    mergeStateStatus: pr.mergeStateStatus,
    changedFileCount: pr.changedFileCount,
    generatedArtifactCount: pr.generatedArtifactPaths.length,
    hasGeneratedArtifacts: pr.hasGeneratedArtifacts,
  };
}

function normalizeAutomationRecord(record = {}) {
  if (!record || typeof record !== "object") return null;
  const identity = String(record.identity || record.prIdentity || record.pullRequestIdentity || "").trim();
  if (!identity) return null;
  const state = PR_AUTOMATION_STATES.includes(record.state) ? record.state : "discovered";
  const issueCode = compactText(record.issueCode || record.issue_code, 120);
  return {
    identity,
    revisionIdentity: String(record.revisionIdentity || record.prRevisionIdentity || "").trim(),
    state,
    issueCode,
    absorbedPrivateRef: normalizeSha(record.absorbedPrivateRef || record.privateRef || record.privateMainRef),
    absorbedPrivateShort: shortSha(record.absorbedPrivateRef || record.privateRef || record.privateMainRef),
    privateMainCoversIntent: normalizeBoolean(record.privateMainCoversIntent || record.alreadyAbsorbed || record.intentCovered, false),
    validationStatus: String(record.validationStatus || "").trim().toLowerCase(),
    validationPassed: normalizeBoolean(record.validationPassed, false) || String(record.validationStatus || "").trim().toLowerCase() === "passed",
    validationFailed: normalizeBoolean(record.validationFailed, false) || String(record.validationStatus || "").trim().toLowerCase() === "failed",
    deployTaskCardId: compactText(record.deployTaskCardId, 120),
    deployDispatched: normalizeBoolean(record.deployDispatched, false) || Boolean(record.deployTaskCardId),
    deployReadbackPassed: normalizeBoolean(record.deployReadbackPassed, false),
    deployReadbackRef: normalizeSha(record.deployReadbackRef || record.deployedRef),
    publicSyncTaskCardId: compactText(record.publicSyncTaskCardId, 120),
    publicSyncDispatched: normalizeBoolean(record.publicSyncDispatched, false) || Boolean(record.publicSyncTaskCardId),
    publicReady: normalizeBoolean(record.publicReady, false),
    publicParityPassed: normalizeBoolean(record.publicParityPassed, false),
    prClosed: normalizeBoolean(record.prClosed, false) || state === "pr_closed",
    closedAt: normalizeIso(record.closedAt),
    absorptionTaskCardId: compactText(record.absorptionTaskCardId, 120),
    absorptionDispatched: normalizeBoolean(record.absorptionDispatched, false) || Boolean(record.absorptionTaskCardId),
  };
}

function recordMap(records = []) {
  const map = new Map();
  for (const item of Array.isArray(records) ? records : []) {
    const record = normalizeAutomationRecord(item);
    if (!record || map.has(record.identity)) continue;
    map.set(record.identity, record);
  }
  return map;
}

function releaseHoldForPullRequest(pr, holds = []) {
  const raw = Array.isArray(holds) ? holds : [];
  const identity = pullRequestIdentity(pr);
  for (const hold of raw) {
    if (!hold || typeof hold !== "object") continue;
    const holdIdentity = String(hold.identity || hold.prIdentity || "").trim();
    const holdRepository = normalizeRepositorySlug(hold.repository || hold.repo);
    const holdNumber = normalizePrNumber(hold.number);
    const matchesIdentity = holdIdentity && holdIdentity === identity;
    const matchesRepoNumber = holdRepository && holdRepository === pr.repository && holdNumber === pr.number;
    if (!matchesIdentity && !matchesRepoNumber) continue;
    return {
      code: compactText(hold.code || hold.issueCode || PR_AUTOMATION_ISSUE_CODES.RELEASE_HOLD_ACTIVE, 120),
      reason: compactText(hold.reason || hold.summary || "release hold active", 240),
    };
  }
  return null;
}

function normalizeWorktree(value = {}) {
  const worktree = value && typeof value === "object" ? value : {};
  const dirty = normalizeBoolean(worktree.dirty || worktree.isDirty, false);
  return {
    cwd: String(worktree.cwd || worktree.path || "").trim(),
    dirty,
    cleanWorktreeAvailable: normalizeBoolean(worktree.cleanWorktreeAvailable ?? worktree.clean_worktree_available, true),
  };
}

function normalizeGithubCredentials(value = {}) {
  const credentials = value && typeof value === "object" ? value : {};
  return {
    available: normalizeBoolean(credentials.available ?? credentials.ok, true),
    issueCode: compactText(credentials.issueCode || PR_AUTOMATION_ISSUE_CODES.GITHUB_CREDENTIALS_MISSING, 120),
  };
}

function action(type, details = {}) {
  return Object.assign({ type }, details);
}

function taskTitlePrefix(pr) {
  return `${pr.repoKind === "private" ? "Private" : "Public"} PR #${pr.number}`;
}

function absorptionTaskCardRequest(pr, options = {}, extra = {}) {
  const identity = pullRequestIdentity(pr);
  const revisionIdentity = pullRequestRevisionIdentity(pr);
  return {
    purpose: "pr_absorption",
    targetRole: "plugin_worker",
    pluginId: options.pluginId || DEFAULT_PLUGIN_ID,
    workspaceCwd: options.workspaceCwd || DEFAULT_WORKSPACE_CWD,
    workflowMode: "autonomous",
    reasoningEffort: "high",
    idempotencyKey: `pr-auto:absorb:${stableHash(revisionIdentity, 20)}`,
    title: `${taskTitlePrefix(pr)} absorption automation`,
    bodyLanguage: "zh-CN",
    privacy: "metadata_only",
    metadata: {
      identity,
      revisionIdentity,
      runId: automationRunId(pr),
      repository: pr.repository,
      number: pr.number,
      headShort: pr.headShort,
      baseRefName: pr.baseRefName,
      hasGeneratedArtifacts: pr.hasGeneratedArtifacts,
      generatedArtifactCount: pr.generatedArtifactPaths.length,
      cleanWorktreeRequired: Boolean(extra.cleanWorktreeRequired),
    },
  };
}

function deployTaskCardRequest(pr, record, options = {}) {
  const ref = record && (record.absorbedPrivateRef || record.deployReadbackRef) || "";
  return {
    purpose: "plugin_deployment",
    targetRole: "home_ai_deploy",
    pluginId: options.pluginId || DEFAULT_PLUGIN_ID,
    workflowMode: "autonomous",
    reasoningEffort: "high",
    idempotencyKey: `pr-auto:deploy:${options.pluginId || DEFAULT_PLUGIN_ID}:${stableHash(ref || pullRequestRevisionIdentity(pr), 20)}`,
    title: `${taskTitlePrefix(pr)} deploy readback gate`,
    bodyLanguage: "zh-CN",
    privacy: "metadata_only",
    metadata: {
      identity: pullRequestIdentity(pr),
      repository: pr.repository,
      number: pr.number,
      privateRefShort: shortSha(ref),
      requiredGate: "deploy_readback",
    },
  };
}

function publicSyncTaskCardRequest(pr, record, options = {}) {
  const ref = record && (record.deployReadbackRef || record.absorbedPrivateRef) || "";
  return {
    purpose: "public_release_sync",
    targetRole: "plugin_worker",
    pluginId: options.pluginId || DEFAULT_PLUGIN_ID,
    workspaceCwd: options.workspaceCwd || DEFAULT_WORKSPACE_CWD,
    workflowMode: "autonomous",
    reasoningEffort: "high",
    idempotencyKey: `pr-auto:public-sync:${stableHash(`${pullRequestIdentity(pr)}:${ref}`, 20)}`,
    title: `${taskTitlePrefix(pr)} public-ready sync gate`,
    bodyLanguage: "zh-CN",
    privacy: "metadata_only",
    metadata: {
      identity: pullRequestIdentity(pr),
      repository: pr.repository,
      number: pr.number,
      privateRefShort: shortSha(ref),
      requiredGate: "public_parity_and_public_ready",
    },
  };
}

function selectedRecordState(pr, record, context) {
  const actions = [];
  const taskCardRequests = [];
  const evidence = {};
  const releaseHold = releaseHoldForPullRequest(pr, context.releaseHolds);
  const cleanWorktreeRequired = context.worktree.dirty;

  if (cleanWorktreeRequired) {
    if (!context.worktree.cleanWorktreeAvailable) {
      return {
        state: "blocked",
        issueCode: PR_AUTOMATION_ISSUE_CODES.SHARED_CHECKOUT_DIRTY,
        actions: [action("stop_until_clean_worktree_available", {
          issueCode: PR_AUTOMATION_ISSUE_CODES.SHARED_CHECKOUT_DIRTY,
        })],
        taskCardRequests,
        evidence,
      };
    }
    actions.push(action("use_clean_detached_worktree", {
      issueCode: PR_AUTOMATION_ISSUE_CODES.CLEAN_WORKTREE_REQUIRED,
      cwd: context.worktree.cwd,
    }));
  }

  if (record && (record.prClosed || record.closedAt)) {
    return {
      state: "pr_closed",
      issueCode: "",
      actions,
      taskCardRequests,
      evidence: { closedAt: record.closedAt },
    };
  }

  if (record && record.publicReady) {
    if (context.gates.closePrAllowed) {
      actions.push(action("close_pull_request", {
        repository: pr.repository,
        number: pr.number,
        issueCode: "",
      }));
      return { state: "pr_closed", issueCode: "", actions, taskCardRequests, evidence };
    }
    actions.push(action("await_pr_close_gate", {
      issueCode: PR_AUTOMATION_ISSUE_CODES.PR_CLOSE_GATE_REQUIRED,
    }));
    return {
      state: "public_ready",
      issueCode: PR_AUTOMATION_ISSUE_CODES.PR_CLOSE_GATE_REQUIRED,
      actions,
      taskCardRequests,
      evidence,
    };
  }

  if (record && (record.publicSyncDispatched || record.state === "public_sync_dispatched")) {
    return {
      state: "public_sync_dispatched",
      issueCode: PR_AUTOMATION_ISSUE_CODES.PUBLIC_READY_GATE_REQUIRED,
      actions: actions.concat(action("wait_for_public_sync_terminal_return", {
        taskCardId: record.publicSyncTaskCardId,
      })),
      taskCardRequests,
      evidence,
    };
  }

  if (record && (record.deployReadbackPassed || record.state === "deploy_readback_passed")) {
    taskCardRequests.push(publicSyncTaskCardRequest(pr, record, context));
    actions.push(action("dispatch_public_sync_after_public_ready_gate", {
      issueCode: PR_AUTOMATION_ISSUE_CODES.PUBLIC_SYNC_REQUIRED,
    }));
    return {
      state: "deploy_readback_passed",
      issueCode: PR_AUTOMATION_ISSUE_CODES.PUBLIC_READY_GATE_REQUIRED,
      actions,
      taskCardRequests,
      evidence,
    };
  }

  if (record && (record.deployDispatched || record.state === "deploy_dispatched")) {
    return {
      state: "deploy_dispatched",
      issueCode: PR_AUTOMATION_ISSUE_CODES.DEPLOY_READBACK_REQUIRED,
      actions: actions.concat(action("wait_for_deploy_terminal_return", {
        taskCardId: record.deployTaskCardId,
      })),
      taskCardRequests,
      evidence,
    };
  }

  if (record && record.validationFailed) {
    return {
      state: "validation_failed",
      issueCode: record.issueCode || PR_AUTOMATION_ISSUE_CODES.VALIDATION_FAILED,
      actions: actions.concat(action("return_blocker_for_validation_failure", {
        issueCode: record.issueCode || PR_AUTOMATION_ISSUE_CODES.VALIDATION_FAILED,
      })),
      taskCardRequests,
      evidence,
    };
  }

  const absorbed = record && (record.privateMainCoversIntent || record.absorbedPrivateRef || record.state === "already_absorbed" || record.state === "absorbed_private");
  if (absorbed) {
    if (releaseHold) {
      return {
        state: "blocked",
        issueCode: releaseHold.code || PR_AUTOMATION_ISSUE_CODES.RELEASE_HOLD_ACTIVE,
        priorState: "absorbed_private",
        actions: actions.concat(action("hold_until_related_release_finishes", {
          issueCode: releaseHold.code || PR_AUTOMATION_ISSUE_CODES.RELEASE_HOLD_ACTIVE,
        })),
        taskCardRequests,
        evidence: {
          privateRefShort: record.absorbedPrivateShort,
          releaseHold,
        },
      };
    }
    if (!record.validationPassed) {
      actions.push(action("run_absorbed_private_validation", {
        issueCode: PR_AUTOMATION_ISSUE_CODES.PUBLIC_READY_GATE_REQUIRED,
      }));
      return {
        state: "absorbed_private",
        issueCode: PR_AUTOMATION_ISSUE_CODES.PUBLIC_READY_GATE_REQUIRED,
        actions,
        taskCardRequests,
        evidence: { privateRefShort: record.absorbedPrivateShort },
      };
    }
    taskCardRequests.push(deployTaskCardRequest(pr, record, context));
    actions.push(action("dispatch_deploy_readback_gate", {
      issueCode: PR_AUTOMATION_ISSUE_CODES.DEPLOY_READBACK_REQUIRED,
    }));
    return {
      state: "absorbed_private",
      issueCode: PR_AUTOMATION_ISSUE_CODES.DEPLOY_READBACK_REQUIRED,
      actions,
      taskCardRequests,
      evidence: { privateRefShort: record.absorbedPrivateShort },
    };
  }

  if (record && (record.absorptionDispatched || record.state === "absorption_dispatched")) {
    return {
      state: "absorption_dispatched",
      issueCode: PR_AUTOMATION_ISSUE_CODES.ABSORPTION_REQUIRED,
      actions: actions.concat(action("wait_for_absorption_terminal_return", {
        taskCardId: record.absorptionTaskCardId,
      })),
      taskCardRequests,
      evidence,
    };
  }

  const rebuildRequired = pr.hasGeneratedArtifacts;
  if (rebuildRequired) {
    actions.push(action("reject_direct_generated_artifact_merge", {
      issueCode: PR_AUTOMATION_ISSUE_CODES.GENERATED_ARTIFACTS_REBUILD_REQUIRED,
      generatedArtifactCount: pr.generatedArtifactPaths.length,
    }));
  }
  taskCardRequests.push(absorptionTaskCardRequest(pr, context, { cleanWorktreeRequired }));
  actions.push(action("dispatch_absorption_task_card", {
    issueCode: rebuildRequired
      ? PR_AUTOMATION_ISSUE_CODES.GENERATED_ARTIFACTS_REBUILD_REQUIRED
      : PR_AUTOMATION_ISSUE_CODES.ABSORPTION_REQUIRED,
  }));
  return {
    state: "absorption_dispatched",
    issueCode: rebuildRequired
      ? PR_AUTOMATION_ISSUE_CODES.GENERATED_ARTIFACTS_REBUILD_REQUIRED
      : PR_AUTOMATION_ISSUE_CODES.ABSORPTION_REQUIRED,
    actions,
    taskCardRequests,
    evidence,
  };
}

function summarizeRecords(openPullRequests, recordsByIdentity) {
  return openPullRequests.map((pr) => {
    const record = recordsByIdentity.get(pullRequestIdentity(pr));
    return {
      pr: publicPullRequestSummary(pr),
      state: record ? record.state : "discovered",
      issueCode: record ? record.issueCode : "",
      absorbedPrivateShort: record ? record.absorbedPrivateShort : "",
      deployReadbackPassed: Boolean(record && record.deployReadbackPassed),
      publicReady: Boolean(record && record.publicReady),
      prClosed: Boolean(record && record.prClosed),
    };
  });
}

function stateCounts(records = []) {
  const counts = {};
  for (const state of PR_AUTOMATION_STATES) counts[state] = 0;
  for (const record of records) {
    const state = PR_AUTOMATION_STATES.includes(record && record.state) ? record.state : "discovered";
    counts[state] += 1;
  }
  return counts;
}

function planPrAutomationRun(options = {}) {
  const checkedAt = normalizeIso(options.checkedAt || options.now) || new Date().toISOString();
  const privateRepository = normalizeRepositorySlug(options.privateRepository, DEFAULT_PRIVATE_REPOSITORY);
  const publicRepository = normalizeRepositorySlug(options.publicRepository, DEFAULT_PUBLIC_REPOSITORY);
  const privateOpenPullRequests = normalizeOpenPullRequests(options.privateOpenPullRequests, {
    repoKind: "private",
    repository: privateRepository,
  });
  const publicOpenPullRequests = normalizeOpenPullRequests(options.publicOpenPullRequests, {
    repoKind: "public",
    repository: publicRepository,
  });
  const openPullRequests = [...publicOpenPullRequests, ...privateOpenPullRequests].sort(comparePullRequestPriority);
  const recordsByIdentity = recordMap(options.records || options.stateRecords || options.automationRecords);
  const githubCredentials = normalizeGithubCredentials(options.githubCredentials);
  const worktree = normalizeWorktree(options.worktree);
  const gates = {
    closePrAllowed: normalizeBoolean(options.gates && (options.gates.closePrAllowed ?? options.gates.prCloseAllowed), false),
  };
  const context = {
    checkedAt,
    gates,
    pluginId: options.pluginId || DEFAULT_PLUGIN_ID,
    releaseHolds: options.releaseHolds || [],
    workspaceCwd: options.workspaceCwd || DEFAULT_WORKSPACE_CWD,
    worktree,
  };

  const base = {
    ok: true,
    privacy: "metadata_only",
    checkedAt,
    repositories: {
      private: privateRepository,
      public: publicRepository,
    },
    openPullRequestSummary: {
      privateCount: privateOpenPullRequests.length,
      publicCount: publicOpenPullRequests.length,
      totalCount: openPullRequests.length,
      pullRequests: openPullRequests.map(publicPullRequestSummary),
    },
    records: summarizeRecords(openPullRequests, recordsByIdentity),
  };

  if (!githubCredentials.available) {
    return Object.assign(base, {
      state: "blocked",
      issueCode: githubCredentials.issueCode || PR_AUTOMATION_ISSUE_CODES.GITHUB_CREDENTIALS_MISSING,
      selectedPullRequest: null,
      actions: [action("configure_github_credentials", {
        issueCode: githubCredentials.issueCode || PR_AUTOMATION_ISSUE_CODES.GITHUB_CREDENTIALS_MISSING,
      })],
      taskCardRequests: [],
      stateCounts: stateCounts(base.records.concat({ state: "blocked" })),
    });
  }

  if (!openPullRequests.length) {
    return Object.assign(base, {
      state: "discovered",
      issueCode: PR_AUTOMATION_ISSUE_CODES.NO_OPEN_PULL_REQUESTS,
      selectedPullRequest: null,
      actions: [],
      taskCardRequests: [],
      stateCounts: stateCounts(base.records),
    });
  }

  const selectedPullRequest = openPullRequests[0];
  const selectedRecord = recordsByIdentity.get(pullRequestIdentity(selectedPullRequest)) || null;
  const decision = selectedRecordState(selectedPullRequest, selectedRecord, context);
  const selectedSummary = publicPullRequestSummary(selectedPullRequest);
  const finalRecords = base.records.map((record) => {
    if (!record || !record.pr || record.pr.identity !== selectedSummary.identity) return record;
    return Object.assign({}, record, {
      state: decision.state,
      issueCode: decision.issueCode || "",
    });
  });

  return Object.assign(base, {
    records: finalRecords,
    state: decision.state,
    priorState: decision.priorState || "",
    issueCode: decision.issueCode || "",
    selectedPullRequest: selectedSummary,
    selectedEvidence: decision.evidence || {},
    actions: decision.actions || [],
    taskCardRequests: decision.taskCardRequests || [],
    stateCounts: stateCounts(finalRecords),
  });
}

function sanitizedStateRecordFromRun(run = {}) {
  const pr = run && run.selectedPullRequest;
  if (!pr || !pr.identity) return null;
  return {
    identity: pr.identity,
    revisionIdentity: pr.revisionIdentity,
    state: PR_AUTOMATION_STATES.includes(run.state) ? run.state : "discovered",
    issueCode: compactText(run.issueCode, 120),
    updatedAt: normalizeIso(run.checkedAt) || new Date().toISOString(),
    selectedHeadShort: compactText(pr.headShort, 20),
  };
}

function mergeAutomationState(existing = {}, run = {}) {
  const records = Array.isArray(existing.records) ? existing.records.slice() : [];
  const nextRecord = sanitizedStateRecordFromRun(run);
  if (!nextRecord) {
    return Object.assign({}, existing, {
      updatedAt: normalizeIso(run.checkedAt) || new Date().toISOString(),
      lastRunState: run.state || "",
      records,
    });
  }
  const nextRecords = [];
  let replaced = false;
  for (const record of records) {
    if (record && record.identity === nextRecord.identity) {
      nextRecords.push(Object.assign({}, record, nextRecord));
      replaced = true;
    } else {
      nextRecords.push(record);
    }
  }
  if (!replaced) nextRecords.push(nextRecord);
  return {
    version: 1,
    updatedAt: nextRecord.updatedAt,
    lastRunState: run.state || "",
    records: nextRecords,
  };
}

function defaultStateFile(cwd = process.cwd()) {
  return path.join(cwd, ".agent-context", "pr-automation-state.json");
}

module.exports = {
  DEFAULT_PLUGIN_ID,
  DEFAULT_PRIVATE_REPOSITORY,
  DEFAULT_PUBLIC_REPOSITORY,
  DEFAULT_WORKSPACE_CWD,
  GENERATED_ARTIFACT_PATTERNS,
  PR_AUTOMATION_ISSUE_CODES,
  PR_AUTOMATION_STATES,
  automationRunId,
  defaultStateFile,
  isGeneratedArtifactPath,
  mergeAutomationState,
  normalizeOpenPullRequests,
  normalizePullRequest,
  normalizeRepositorySlug,
  planPrAutomationRun,
  pullRequestIdentity,
  pullRequestRevisionIdentity,
  sanitizedStateRecordFromRun,
};
