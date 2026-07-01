"use strict";

const SLOW_PATH_CODES = new Set([
  "thread_detail_slow_path",
  "thread_list_slow_path",
  "thread_session_slow_path",
  "api-slow",
]);

const DEPLOY_BLOCKING_SEVERITIES = new Set(["H1", "H2"]);

function safeLabel(value, fallback = "unknown", maxChars = 120) {
  const text = String(value || "").trim();
  return text.replace(/[^a-z0-9_.:-]+/gi, "_").slice(0, maxChars) || fallback;
}

function boundedCount(value, max = 100000) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.min(max, Math.trunc(number));
}

function normalizeSeverity(value) {
  const text = String(value || "").trim().toUpperCase();
  if (text === "H1" || text === "H2" || text === "H3" || text === "H4") return text;
  return "H3";
}

function issueCode(issue = {}) {
  return safeLabel(
    issue.code
    || issue.error_code
    || issue.errorCode
    || issue.diagnostic_type
    || issue.diagnosticType
    || issue.category
    || "unknown_issue",
    "unknown_issue",
  );
}

function issueDiagnosticType(issue = {}) {
  return safeLabel(issue.diagnostic_type || issue.diagnosticType || "", "", 120);
}

function issueCategory(issue = {}) {
  return safeLabel(issue.category || "", "", 120);
}

function isSlowPathIssue(issue = {}) {
  const code = issueCode(issue);
  const diagnosticType = issueDiagnosticType(issue);
  const category = issueCategory(issue);
  if (SLOW_PATH_CODES.has(code) || SLOW_PATH_CODES.has(diagnosticType) || SLOW_PATH_CODES.has(category)) return true;
  if (/_slow_path$/.test(code) || /_slow_path$/.test(diagnosticType)) return true;
  return category === "thread_session_slow_path";
}

function normalizeIssue(issue = {}, sourceCheck = "") {
  const code = issueCode(issue);
  const severity = normalizeSeverity(issue.severity || issue.severity_hint || issue.severityHint);
  return {
    severity,
    code,
    surface: safeLabel(issue.surface || sourceCheck || "self-check", "self-check", 80),
    category: issueCategory(issue),
    diagnostic_type: issueDiagnosticType(issue),
    error_code: safeLabel(issue.error_code || issue.errorCode || "", "", 120),
    count: boundedCount(issue.count || issue.occurrenceCount || issue.repeated_failures || 1, 1000) || 1,
    observeOnly: Boolean(issue.observeOnly || issue.observe_only || isSlowPathIssue(issue)),
  };
}

function normalizeCandidate(candidate = {}, sourceCheck = "") {
  return normalizeIssue(Object.assign({}, candidate, {
    severity: candidate.severity || candidate.severity_hint || candidate.severityHint || "H2",
    code: candidate.error_code || candidate.errorCode || candidate.diagnostic_type || candidate.diagnosticType,
    surface: candidate.surface || sourceCheck,
  }), sourceCheck);
}

function checkIssues(check = {}) {
  const out = [];
  const sourceCheck = safeLabel(check.name || "self-check", "self-check", 80);
  for (const issue of Array.isArray(check.issues) ? check.issues : []) {
    if (issue && typeof issue === "object") out.push(normalizeIssue(issue, sourceCheck));
  }
  for (const candidate of Array.isArray(check.diagnosticCandidates) ? check.diagnosticCandidates : []) {
    if (candidate && typeof candidate === "object") out.push(normalizeCandidate(candidate, sourceCheck));
  }
  if (!check.ok && check.errorCode) {
    out.push({
      severity: "H2",
      code: safeLabel(check.errorCode, "self_check_execution_failed"),
      surface: sourceCheck,
      category: "runtime_self_check_execution",
      diagnostic_type: "runtime_self_check_execution_failed",
      error_code: safeLabel(check.errorCode, "self_check_execution_failed"),
      count: 1,
      observeOnly: false,
    });
  }
  return out;
}

function uniqueCodes(issues = []) {
  return [...new Set(issues.map((issue) => issue.code).filter(Boolean))].sort();
}

function classifyRuntimeSelfCheckGate(input = {}) {
  const checks = Array.isArray(input.checks) ? input.checks : [];
  const mode = safeLabel(input.mode || "periodic", "periodic", 40);
  const issues = checks.flatMap(checkIssues);
  const observeOnlyIssues = issues.filter((issue) => issue.observeOnly || isSlowPathIssue(issue));
  const deployBlockingIssues = issues.filter((issue) => (
    DEPLOY_BLOCKING_SEVERITIES.has(issue.severity)
    && !issue.observeOnly
    && !isSlowPathIssue(issue)
  ));
  const advisoryIssues = issues.filter((issue) => (
    !deployBlockingIssues.includes(issue)
    && !observeOnlyIssues.includes(issue)
  ));
  const explicitExecutionFailureIssues = issues.filter((issue) => (
    issue.category === "runtime_self_check_execution"
    || issue.diagnostic_type === "runtime_self_check_execution_failed"
  ));
  const failedChecksWithoutIssues = checks.filter((check) => !check.ok && !checkIssues(check).length);
  const executionFailureIssues = failedChecksWithoutIssues.map((check) => ({
    severity: "H2",
    code: "self_check_failed_without_details",
    surface: safeLabel(check.name || "self-check", "self-check", 80),
    category: "runtime_self_check_execution",
    diagnostic_type: "runtime_self_check_failed_without_details",
    error_code: "self_check_failed_without_details",
    count: 1,
    observeOnly: false,
  }));
  const allBlockingIssues = deployBlockingIssues.concat(executionFailureIssues);
  const ok = allBlockingIssues.length === 0;
  return {
    mode,
    ok,
    deployPass: ok,
    periodicHealthy: ok,
    privacy: "metadata_only",
    issueCount: boundedCount(issues.length + executionFailureIssues.length),
    blockingIssueCount: boundedCount(allBlockingIssues.length),
    reportableIssueCount: boundedCount(deployBlockingIssues.length),
    observeOnlyIssueCount: boundedCount(observeOnlyIssues.length),
    advisoryIssueCount: boundedCount(advisoryIssues.length),
    executionFailureCount: boundedCount(explicitExecutionFailureIssues.length + executionFailureIssues.length),
    actionableIssueCodes: uniqueCodes(allBlockingIssues),
    reportableIssueCodes: uniqueCodes(deployBlockingIssues),
    observeOnlyIssueCodes: uniqueCodes(observeOnlyIssues),
    advisoryIssueCodes: uniqueCodes(advisoryIssues),
    checkNames: checks.map((check) => safeLabel(check.name || "self-check", "self-check", 80)),
  };
}

module.exports = {
  classifyRuntimeSelfCheckGate,
  isSlowPathIssue,
  normalizeIssue,
  safeLabel,
};
