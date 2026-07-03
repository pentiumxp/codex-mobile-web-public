"use strict";

const SPECIAL_PURPOSES = new Set([
  "public_pr",
  "deploy_lane",
  "audit_lane",
  "task_intake",
  "worker_lane",
]);

function compactOneLine(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeText(value) {
  return compactOneLine(value).toLowerCase();
}

function normalizeCwd(value) {
  return compactOneLine(value).replace(/\\/g, "/").toLowerCase();
}

function classifyThreadPurpose(thread = {}) {
  const title = normalizeText(thread.title || thread.name || thread.preview);
  const cwd = normalizeCwd(thread.cwd || thread.workspace || thread.targetWorkspace);
  const id = compactOneLine(thread.id || thread.threadId);

  if (/\bpublic\s+pr\b/.test(title) || /\bpublic\s+pull\s+request\b/.test(title)) {
    return { purpose: "public_pr", specialPurpose: true, reason: "title-public-pr", threadId: id };
  }
  if (/\bdeploy\b/.test(title) || /\bdeployment\b/.test(title) || /\bdeploy\s+lane\b/.test(title)) {
    return { purpose: "deploy_lane", specialPurpose: true, reason: "title-deploy", threadId: id };
  }
  if (/\baudit\b/.test(title) || /\breview\b/.test(title)) {
    return { purpose: "audit_lane", specialPurpose: true, reason: "title-audit", threadId: id };
  }
  if (/\btask\s+intake\b/.test(title) || /\bintake\b/.test(title)) {
    return { purpose: "task_intake", specialPurpose: true, reason: "title-task-intake", threadId: id };
  }
  if (/\bworker\b/.test(title) || /\blane\b/.test(title)) {
    return { purpose: "worker_lane", specialPurpose: true, reason: "title-worker-lane", threadId: id };
  }
  if (cwd.endsWith("/plugins/codex-mobile-web")) {
    return { purpose: "codex_mobile_implementation", specialPurpose: false, reason: "cwd-codex-mobile-web", threadId: id };
  }
  if (cwd) {
    return { purpose: "workspace_implementation", specialPurpose: false, reason: "cwd-workspace", threadId: id };
  }
  return { purpose: "unknown", specialPurpose: false, reason: "no-purpose-signal", threadId: id };
}

function roleAllowedPurposes(role) {
  if (role === "product_audit") return new Set(["audit_lane"]);
  if (role === "deploy_readback") return new Set(["deploy_lane"]);
  if (role === "implementation" || role === "repair") {
    return new Set(["codex_mobile_implementation", "workspace_implementation", "worker_lane", "unknown"]);
  }
  if (role === "requirements") {
    return new Set(["codex_mobile_implementation", "workspace_implementation", "unknown"]);
  }
  return new Set(["codex_mobile_implementation", "workspace_implementation", "unknown"]);
}

function assertLoopRoleTarget({ role, thread } = {}) {
  const classification = classifyThreadPurpose(thread || {});
  const allowed = roleAllowedPurposes(role);
  const ok = allowed.has(classification.purpose);
  if (ok) {
    return { ok: true, classification };
  }
  return {
    ok: false,
    error: "at_loop_target_purpose_mismatch",
    role: compactOneLine(role),
    classification,
    allowedPurposes: Array.from(allowed).sort(),
    specialPurpose: SPECIAL_PURPOSES.has(classification.purpose),
  };
}

function publicRoutingMetadata(result = {}) {
  return {
    ok: result.ok !== false,
    error: result.error || "",
    role: result.role || "",
    targetPurpose: result.classification && result.classification.purpose || "",
    targetReason: result.classification && result.classification.reason || "",
    targetThreadId: result.classification && result.classification.threadId || "",
    allowedPurposes: Array.isArray(result.allowedPurposes) ? result.allowedPurposes.slice(0, 8) : [],
    specialPurpose: Boolean(result.specialPurpose || result.classification && result.classification.specialPurpose),
  };
}

function createThreadTaskCardLoopRoutingService() {
  return {
    assertLoopRoleTarget,
    classifyThreadPurpose,
    publicRoutingMetadata,
    roleAllowedPurposes,
  };
}

module.exports = {
  assertLoopRoleTarget,
  classifyThreadPurpose,
  createThreadTaskCardLoopRoutingService,
  publicRoutingMetadata,
  roleAllowedPurposes,
};
