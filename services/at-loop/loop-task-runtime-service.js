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
const SOURCE_THREAD_LOCAL_REQUIREMENTS = "source_thread_local_role";
const TASK_CARD_DISPATCH = "task_card";
const AUDIT_PACKET_SECTION_DEFINITIONS = Object.freeze([
  ["requirements_packet", "requirements_role_return", [
    "objective",
    "non_goals",
    "acceptance_criteria",
    "user_visible_success",
    "privacy_boundary",
    "risk_gates",
  ]],
  ["design_contract_packet", "durable_docs_and_contracts", [
    "product_or_module_contract",
    "architecture_boundary",
    "routing_policy",
    "harness_requirements",
  ]],
  ["implementation_packet", "implementation_return_card", [
    "original_task_card_id",
    "commit_or_changed_files",
    "bounded_diff_summary",
    "ownership_claim",
    "residual_risk",
  ]],
  ["validation_packet", "tests_harnesses_and_readback", [
    "focused_tests",
    "harness_evidence",
    "deployment_readback_when_applicable",
    "privacy_confirmation",
  ]],
  ["privacy_packet", "privacy_boundary", [
    "excluded_payload_classes",
    "redaction_or_non_collection_claims",
    "task_card_privacy_confirmation",
    "residual_privacy_risk",
  ]],
]);
const DELTA_MATRIX_DEFINITIONS = Object.freeze([
  "intent_vs_requirements",
  "requirements_vs_design",
  "design_vs_implementation",
  "implementation_vs_validation",
  "user_journey_vs_acceptance",
  "privacy_boundary_vs_evidence",
]);
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

function redactPacketSensitiveText(value) {
  return redactSensitiveText(value)
    .replace(/\b(secret|password|token|api[-_\s]*key|access[-_\s]*key)\s*[:=]?\s+([A-Za-z0-9._-]{6,})/ig, "$1 [redacted]");
}

function safePacketValue(value, max = 240) {
  if (value == null) return "";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((item) => safePacketValue(item, max)).filter(Boolean).slice(0, 8).join("; ");
  if (typeof value === "object") {
    const entries = Object.entries(value).slice(0, 8)
      .map(([key, raw]) => `${compactOneLine(key).slice(0, 60)}=${safePacketValue(raw, 120)}`)
      .filter(Boolean);
    return boundedText(redactPacketSensitiveText(entries.join("; ")), max);
  }
  return boundedText(redactPacketSensitiveText(value), max);
}

function boundedPacketList(items, maxItems = 12, itemMax = 220) {
  return (Array.isArray(items) ? items : [items])
    .map((item) => safePacketValue(item, itemMax))
    .filter(Boolean)
    .slice(0, maxItems);
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
    threadRole: boundedText(thread.threadRole || thread.thread_role || thread.role, 80),
  };
}

function threadIdOf(thread = {}) {
  return compactOneLine(thread && (thread.id || thread.threadId));
}

function sameThreadId(left, right) {
  const leftId = compactOneLine(left);
  const rightId = compactOneLine(right);
  return Boolean(leftId && rightId && leftId === rightId);
}

function normalizeCwd(value) {
  return compactOneLine(value).replace(/\\/g, "/").toLowerCase();
}

function roleThreadField(role) {
  if (role === "product_audit") return "auditThreadId";
  if (role === "deploy_readback") return "deployThreadId";
  return "implementationThreadId";
}

function roleThreadRole(role) {
  if (role === "product_audit") return "product_audit";
  if (role === "deploy_readback") return "deploy_readback";
  if (role === "repair") return "repair";
  return "implementation";
}

function roleLaneTitle(sourceThread, role, objectiveSummary) {
  const sourceTitle = compactOneLine(sourceThread && (sourceThread.title || sourceThread.name || sourceThread.preview))
    || compactOneLine(sourceThread && (sourceThread.id || sourceThread.threadId))
    || "Loop";
  const suffix = role === "product_audit"
    ? "Loop Audit"
    : role === "deploy_readback"
      ? "Loop Deploy Readback"
      : role === "repair"
        ? "Loop Repair"
        : "Loop Implementation";
  const objective = compactOneLine(objectiveSummary);
  return boundedText(`${sourceTitle} ${suffix}${objective ? `: ${objective}` : ""}`, 120);
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

function auditSectionDefinition(id) {
  const normalized = compactOneLine(id);
  const entry = AUDIT_PACKET_SECTION_DEFINITIONS.find(([sectionId]) => sectionId === normalized);
  if (!entry) return null;
  return { id: entry[0], source: entry[1], expectedEvidence: entry[2] };
}

function auditPacketSource(input = {}) {
  const directSections = {
    requirements_packet: input.requirementsPacket || input.requirements_packet,
    design_contract_packet: input.designContractPacket || input.design_contract_packet,
    implementation_packet: input.implementationPacket || input.implementation_packet,
    validation_packet: input.validationPacket || input.validation_packet,
    privacy_packet: input.privacyPacket || input.privacy_packet,
  };
  const hasDirectSection = Object.values(directSections).some(Boolean);
  const configured = input.auditPacket
    || input.audit_packet
    || input.loopPlan && (input.loopPlan.auditPacket || input.loopPlan.audit_packet)
    || input.loop_plan && (input.loop_plan.auditPacket || input.loop_plan.audit_packet)
    || input.plan && (input.plan.auditPacket || input.plan.audit_packet)
    || null;
  if (configured && hasDirectSection) {
    const sections = Array.isArray(configured.sections)
      ? configured.sections.concat(Object.entries(directSections).filter(([, value]) => value).map(([id, value]) => Object.assign({ id }, value)))
      : Object.assign({}, configured.sections || {}, directSections);
    return Object.assign({}, configured, { sections });
  }
  return configured || (hasDirectSection ? { sections: directSections } : null) || null;
}

function sectionInputById(packet, id) {
  if (!packet || typeof packet !== "object") return null;
  if (packet[id] && typeof packet[id] === "object") return packet[id];
  const sections = packet.sections;
  if (Array.isArray(sections)) {
    return sections.find((section) => compactOneLine(section && section.id) === id) || null;
  }
  if (sections && typeof sections === "object" && sections[id]) return sections[id];
  return null;
}

function sectionStatus(raw = {}) {
  const status = compactOneLine(raw.status || raw.state || "").toLowerCase();
  if (["present", "provided", "completed", "complete", "available"].includes(status)) return "present";
  if (["missing", "blocked", "unavailable"].includes(status)) return "missing";
  if (raw.present === true || raw.available === true) return "present";
  return "missing";
}

function sanitizeAuditSection(raw, definition) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    id: definition.id,
    required: source.required === false ? false : true,
    status: sectionStatus(source),
    source: safePacketValue(source.source || definition.source, 120),
    summary: safePacketValue(source.summary || source.description || source.note || "", 320),
    expectedEvidence: boundedPacketList(source.expectedEvidence || source.expected_evidence || definition.expectedEvidence, 12, 120),
    evidence: boundedPacketList(source.items || source.actualEvidence || source.actual_evidence || source.providedEvidence || source.provided_evidence || [], 12, 220),
    missingEvidence: boundedPacketList(source.missingEvidence || source.missing_evidence || [], 12, 160),
  };
}

function sanitizeDeltaMatrixEntry(raw, id) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    id,
    status: compactOneLine(source.status || source.state || "unchecked").toLowerCase() || "unchecked",
    summary: safePacketValue(source.summary || source.description || "", 220),
    evidence: boundedPacketList(source.evidence || source.items || [], 8, 160),
  };
}

function deltaInputById(packet, id) {
  if (!packet || typeof packet !== "object") return null;
  const delta = packet.deltaMatrix || packet.delta_matrix;
  if (Array.isArray(delta)) return delta.find((entry) => compactOneLine(entry && entry.id) === id) || null;
  if (delta && typeof delta === "object" && delta[id]) return delta[id];
  return null;
}

function sanitizeAuditPacket(input = {}) {
  const packet = auditPacketSource(input) || {};
  const sections = AUDIT_PACKET_SECTION_DEFINITIONS.map(([id, source, expectedEvidence]) => {
    const definition = { id, source, expectedEvidence };
    return sanitizeAuditSection(sectionInputById(packet, id), definition);
  });
  return {
    required: true,
    source: safePacketValue(packet.source || "codex_mobile_loop_runtime", 120),
    handoffPolicy: {
      implementationHandoffAsContext: false,
      implementationHandoffAsAuditContext: false,
      implementationHandoffAllowedOnlyWhenAuditingHandoff: true,
      namedHandoffAsTargetEvidenceOnly: true,
      auditUsesPacketNotRawHandoff: true,
    },
    sections,
    deltaMatrix: DELTA_MATRIX_DEFINITIONS.map((id) => sanitizeDeltaMatrixEntry(deltaInputById(packet, id), id)),
  };
}

function auditPacketStatus(packet = {}) {
  const sections = Array.isArray(packet.sections) ? packet.sections : [];
  const requiredSections = sections.filter((section) => section.required !== false).map((section) => section.id);
  const presentSections = sections.filter((section) => section.required !== false && section.status === "present").map((section) => section.id);
  const missingSections = requiredSections.filter((id) => !presentSections.includes(id));
  return {
    required: packet.required !== false,
    requiredSections,
    presentSections,
    missingSections,
    complete: missingSections.length === 0,
    deltaMatrix: DELTA_MATRIX_DEFINITIONS.slice(),
  };
}

function publicAuditPacket(packet = {}) {
  const normalized = packet && packet.sections ? packet : sanitizeAuditPacket({ auditPacket: packet });
  return {
    required: normalized.required !== false,
    source: safePacketValue(normalized.source || "codex_mobile_loop_runtime", 120),
    handoffPolicy: Object.assign({
      implementationHandoffAsContext: false,
      implementationHandoffAsAuditContext: false,
      implementationHandoffAllowedOnlyWhenAuditingHandoff: true,
      namedHandoffAsTargetEvidenceOnly: true,
      auditUsesPacketNotRawHandoff: true,
    }, normalized.handoffPolicy || {}),
    sections: (Array.isArray(normalized.sections) ? normalized.sections : []).map((section) => ({
      id: section.id,
      required: section.required !== false,
      status: section.status === "present" ? "present" : "missing",
      source: safePacketValue(section.source, 120),
      summary: safePacketValue(section.summary, 260),
      expectedEvidence: boundedPacketList(section.expectedEvidence || [], 12, 120),
      evidence: boundedPacketList(section.evidence || [], 12, 180),
      missingEvidence: boundedPacketList(section.missingEvidence || [], 12, 120),
    })),
    deltaMatrix: (Array.isArray(normalized.deltaMatrix) ? normalized.deltaMatrix : []).map((entry) => ({
      id: compactOneLine(entry.id),
      status: compactOneLine(entry.status || "unchecked"),
      summary: safePacketValue(entry.summary, 180),
      evidence: boundedPacketList(entry.evidence || [], 8, 120),
    })),
    status: auditPacketStatus(normalized),
  };
}

function mergeAuditPacket(base, update) {
  const packet = publicAuditPacket(base || sanitizeAuditPacket({}));
  const incoming = publicAuditPacket(update || {});
  const byId = new Map(packet.sections.map((section) => [section.id, section]));
  for (const section of incoming.sections) {
    if (!byId.has(section.id)) continue;
    const current = byId.get(section.id);
    byId.set(section.id, {
      id: section.id,
      required: section.required !== false,
      status: section.status === "present" || current.status === "present" ? "present" : "missing",
      source: section.status === "present" ? section.source : current.source,
      summary: section.summary || current.summary,
      expectedEvidence: section.expectedEvidence.length ? section.expectedEvidence : current.expectedEvidence,
      evidence: section.evidence.length ? section.evidence : current.evidence,
      missingEvidence: section.missingEvidence.length ? section.missingEvidence : current.missingEvidence,
    });
  }
  const deltaById = new Map(packet.deltaMatrix.map((entry) => [entry.id, entry]));
  for (const entry of incoming.deltaMatrix) {
    if (!deltaById.has(entry.id)) continue;
    const current = deltaById.get(entry.id);
    deltaById.set(entry.id, {
      id: entry.id,
      status: entry.status && entry.status !== "unchecked" ? entry.status : current.status,
      summary: entry.summary || current.summary,
      evidence: entry.evidence.length ? entry.evidence : current.evidence,
    });
  }
  return publicAuditPacket(Object.assign({}, packet, {
    sections: Array.from(byId.values()),
    deltaMatrix: Array.from(deltaById.values()),
  }));
}

function returnEvidence(input = {}, slice = {}, returnStatus = "") {
  const evidence = [
    `role_slice_id:${slice.roleSliceId || ""}`,
    `task_card_id:${slice.taskCardId || ""}`,
    `return_status:${returnStatus || ""}`,
  ];
  if (input.returnCardId || input.replyCardId) evidence.push(`return_card_id:${safePacketValue(input.returnCardId || input.replyCardId, 120)}`);
  if (input.commit || input.commitHash || input.sourceRef) evidence.push(`commit:${safePacketValue(input.commit || input.commitHash || input.sourceRef, 120)}`);
  if (Array.isArray(input.changedFiles) && input.changedFiles.length) evidence.push(`changed_files:${input.changedFiles.length}`);
  if (Array.isArray(input.tests) && input.tests.length) evidence.push(`tests:${input.tests.length}`);
  return evidence.filter((item) => !/:$/.test(item));
}

function roleReturnAuditPacketUpdate(loop, slice, input, returnStatus) {
  const packet = sanitizeAuditPacket(input);
  const sectionUpdates = {};
  const summary = safePacketValue(input.summary || "", 320);
  if (slice.role === "requirements") {
    sectionUpdates.requirements_packet = {
      status: "present",
      source: "requirements_role_return",
      summary: summary || loop.objectiveSummary,
      actualEvidence: returnEvidence(input, slice, returnStatus),
    };
  }
  if (slice.role === "implementation" || slice.role === "repair") {
    sectionUpdates.implementation_packet = {
      status: "present",
      source: "implementation_return_card",
      summary,
      actualEvidence: returnEvidence(input, slice, returnStatus),
    };
    if (input.validationPacket || input.validation_packet || input.validation || input.validationSummary || input.tests || input.deploymentReadback) {
      sectionUpdates.validation_packet = {
        status: "present",
        source: "implementation_return_validation",
        summary: safePacketValue(input.validationSummary || input.validation || input.deploymentReadback || "", 320),
        actualEvidence: boundedPacketList(input.tests || input.validationPacket || input.validation_packet || input.validation || input.deploymentReadback, 12, 180),
      };
    }
    if (input.privacyPacket || input.privacy_packet || input.privacy || input.privacyConfirmation || input.privacy_confirmation) {
      sectionUpdates.privacy_packet = {
        status: "present",
        source: "implementation_return_privacy",
        summary: safePacketValue(input.privacyConfirmation || input.privacy_confirmation || input.privacy || "", 320),
        actualEvidence: boundedPacketList(input.privacyPacket || input.privacy_packet || input.privacy || input.privacyConfirmation || input.privacy_confirmation, 12, 180),
      };
    }
  }
  return mergeAuditPacket(packet, sanitizeAuditPacket({ auditPacket: { sections: sectionUpdates } }));
}

function auditPacketBody(loop) {
  const packet = publicAuditPacket(loop.auditPacket || sanitizeAuditPacket({}));
  const status = packet.status;
  const lines = [
    "",
    "## Audit Packet",
    "",
    "Use this structured packet as audit input. Do not treat `.agent-context/HANDOFF.md` or implementation-thread handoffs as inherited audit context.",
    `Missing required sections: ${status.missingSections.length ? status.missingSections.join(", ") : "none"}`,
    "",
  ];
  for (const section of packet.sections) {
    lines.push(`### ${section.id}`);
    lines.push(`- status: ${section.status}`);
    lines.push(`- source: ${section.source || "unknown"}`);
    if (section.summary) lines.push(`- summary: ${section.summary}`);
    lines.push(`- expected evidence: ${section.expectedEvidence.join(", ") || "none"}`);
    lines.push(`- provided evidence: ${section.evidence.join("; ") || "missing"}`);
    if (section.status !== "present") lines.push("- missing-evidence handling: return `blocked_missing_evidence` with bounded missing-field evidence if this section is required for the verdict.");
    lines.push("");
  }
  lines.push("## Delta Matrix");
  lines.push("");
  for (const entry of packet.deltaMatrix) {
    lines.push(`- [ ] ${entry.id}${entry.summary ? ` - ${entry.summary}` : ""}`);
  }
  return lines.join("\n");
}

function roleCardBody(loop, slice) {
  const body = [
    `# Codex Mobile @loop role: ${roleTitle(slice.role)}`,
    "",
    `Loop id: ${loop.loopId}`,
    `Role slice id: ${slice.roleSliceId}`,
    `Iteration: ${slice.iteration} / ${loop.maxIterations}`,
    `Workflow id: at-loop:${loop.loopId}`,
    `Source request id: ${slice.sourceRequestId || loop.sourceRequestId || ""}`,
    `Source thread id: ${loop.sourceThreadId}`,
    `Target thread id: ${slice.targetThreadId || ""}`,
    `Target role: ${slice.role}`,
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
  if (slice.role === "product_audit") return `${body}${auditPacketBody(loop)}`;
  return body;
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

  function readVisibleThreadSummary(threadId) {
    const id = compactOneLine(threadId);
    if (!id) return null;
    if (typeof dependencies.readThreadTaskCardVisibleTargetSummary === "function") {
      const visible = dependencies.readThreadTaskCardVisibleTargetSummary(id);
      if (visible) return visible;
    }
    return visibleThreads().find((thread) => compactOneLine(thread.id || thread.threadId) === id) || null;
  }

  function taskCardDeliverabilityCheck(loop, role, thread) {
    if (typeof dependencies.assertThreadTaskCardTargetDeliverable !== "function") {
      return { ok: true };
    }
    const targetThreadId = threadIdOf(thread);
    try {
      dependencies.assertThreadTaskCardTargetDeliverable(thread, {
        reference: targetThreadId,
        referenceKind: "thread",
        routeKind: "at_loop_role_slice",
        sourceThreadId: loop && loop.sourceThreadId || "",
        targetRole: role,
        loopId: loop && loop.loopId || "",
      });
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err && err.code || "target_thread_not_deliverable",
        message: compactOneLine(err && err.message || err || "target_thread_not_deliverable"),
        statusCode: Number(err && err.statusCode || 0) || undefined,
        details: err && err.details || undefined,
      };
    }
  }

  function roleTargetCheck(loop, role, thread) {
    const loopCheck = routingService.assertLoopRoleTarget({ role, thread });
    if (!loopCheck.ok) return loopCheck;
    const deliverability = taskCardDeliverabilityCheck(loop, role, thread);
    if (deliverability.ok) return Object.assign({}, loopCheck, { deliverability });
    return Object.assign({}, loopCheck, {
      ok: false,
      error: "at_loop_target_not_deliverable",
      deliverability,
    });
  }

  function publicRoleTargetRoutingMetadata(result = {}) {
    const out = publicRoutingMetadata(result);
    if (result.deliverability && result.deliverability.ok === false) {
      out.deliverable = false;
      out.deliverabilityError = result.deliverability.error || "";
      out.deliverabilityMessage = result.deliverability.message || "";
      out.deliverabilityStatusCode = result.deliverability.statusCode || undefined;
    } else if (result.deliverability) {
      out.deliverable = true;
    }
    return out;
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
    const slice = findSlice(loop, { role, iteration: loop.iteration });
    if (slice && slice.targetThreadId) {
      return readThreadSummary(slice.targetThreadId) || { id: slice.targetThreadId, threadId: slice.targetThreadId };
    }
    if (role === "requirements") {
      const requirementsThreadId = compactOneLine(loop.requirementsThreadId || loop.targetThreadId || loop.sourceThreadId);
      return readThreadSummary(requirementsThreadId) || { id: requirementsThreadId, threadId: requirementsThreadId };
    }
    const field = roleThreadField(role);
    const roleThreadId = compactOneLine(loop[field]);
    if (roleThreadId) {
      return readThreadSummary(roleThreadId) || { id: roleThreadId, threadId: roleThreadId };
    }
    return null;
  }

  function publicSlice(slice = {}) {
    const out = {
      roleSliceId: slice.roleSliceId || "",
      role: slice.role || "",
      status: slice.status || "",
      iteration: slice.iteration || 0,
      targetThreadId: slice.targetThreadId || "",
      targetPurpose: slice.targetPurpose || "",
      taskCardId: slice.taskCardId || "",
      dispatchMode: slice.dispatchMode || "",
      taskCardDispatch: slice.taskCardDispatch === false ? false : slice.taskCardDispatch === true ? true : undefined,
      sourceRequestId: slice.sourceRequestId || "",
      workflowId: slice.workflowId || "",
      roleOwnerThreadId: slice.roleOwnerThreadId || "",
      roleThreadCreated: slice.roleThreadCreated === true,
      dispatchStatus: slice.dispatchStatus || "",
      returnStatus: slice.returnStatus || "",
      auditVerdict: slice.auditVerdict || "",
      stale: Boolean(slice.stale),
      blockedReason: slice.blockedReason || "",
      routing: slice.routing || null,
      updatedAt: slice.updatedAt || "",
    };
    if (slice.role === "product_audit" && slice.auditPacketStatus) {
      out.auditPacketStatus = slice.auditPacketStatus;
    }
    return out;
  }

  function publicLoop(loop = {}) {
    const slices = Array.isArray(loop.roleSlices) ? loop.roleSlices : [];
    const packet = publicAuditPacket(loop.auditPacket || sanitizeAuditPacket({}));
    return {
      loopId: loop.loopId || "",
      sourceThreadId: loop.sourceThreadId || "",
      targetThreadId: loop.targetThreadId || "",
      requirementsThreadId: loop.requirementsThreadId || "",
      implementationThreadId: loop.implementationThreadId || "",
      auditThreadId: loop.auditThreadId || "",
      deployThreadId: loop.deployThreadId || "",
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
      sourceRequestId: loop.sourceRequestId || "",
      requirementsLocal: loop.requirementsLocal === true,
      auditPacketStatus: packet.status,
      auditPacket: {
        required: packet.required,
        sections: packet.sections.map((section) => ({
          id: section.id,
          required: section.required,
          status: section.status,
          source: section.source,
          missingEvidence: section.missingEvidence,
        })),
        deltaMatrix: packet.deltaMatrix.map((entry) => ({
          id: entry.id,
          status: entry.status,
        })),
      },
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
      dispatchMode: "",
      taskCardDispatch: undefined,
      taskCardId: "",
      targetThreadId: "",
      targetPurpose: "",
      sourceRequestId: "",
      workflowId: "",
      roleOwnerThreadId: "",
      roleThreadCreated: false,
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

  function sourceThread(loop) {
    return readThreadSummary(loop.sourceThreadId) || { id: loop.sourceThreadId, threadId: loop.sourceThreadId };
  }

  function sourceOwnsRequirements(loop) {
    return sameThreadId(loop.sourceThreadId, loop.requirementsThreadId || loop.targetThreadId || loop.sourceThreadId);
  }

  function setLoopBlocked(loop, slice, error, options = {}) {
    const timestamp = nowIso(clock);
    if (slice) {
      slice.status = "blocked";
      slice.dispatchStatus = options.dispatchStatus || "blocked";
      slice.blockedReason = compactOneLine(options.message || error);
      slice.routing = options.routing || slice.routing || null;
      slice.updatedAt = timestamp;
    }
    loop.status = "blocked";
    loop.blockedReason = compactOneLine(error);
    loop.nextRoute = options.nextRoute || "blocked_target_unavailable";
    loop.updatedAt = timestamp;
    saveState();
    return {
      ok: false,
      error,
      message: options.message ? compactOneLine(options.message) : undefined,
      routing: options.routing || null,
      loop: publicLoop(loop),
      slice: slice ? publicSlice(slice) : undefined,
    };
  }

  function markRequirementsLocal(loop, slice) {
    const timestamp = nowIso(clock);
    const source = sourceThread(loop);
    const sourceCheck = routingService.assertLoopRoleTarget({ role: "requirements", thread: source });
    if (!sourceCheck.ok) {
      return setLoopBlocked(loop, slice, sourceCheck.error, {
        routing: publicRoutingMetadata(sourceCheck),
      });
    }
    slice.status = "local";
    slice.dispatchStatus = SOURCE_THREAD_LOCAL_REQUIREMENTS;
    slice.dispatchMode = SOURCE_THREAD_LOCAL_REQUIREMENTS;
    slice.taskCardDispatch = false;
    slice.roleOwnerThreadId = loop.sourceThreadId;
    slice.targetThreadId = loop.sourceThreadId;
    slice.targetPurpose = sourceCheck.classification && sourceCheck.classification.purpose || "";
    slice.routing = Object.assign(publicRoutingMetadata(sourceCheck), {
      sourceThreadLocalRole: true,
      taskCardDispatch: false,
    });
    slice.returnStatus = "completed";
    slice.blockedReason = "";
    slice.updatedAt = timestamp;
    loop.requirementsThreadId = loop.sourceThreadId;
    loop.requirementsLocal = true;
    loop.auditPacket = mergeAuditPacket(loop.auditPacket || sanitizeAuditPacket({}), sanitizeAuditPacket({
      auditPacket: {
        sections: {
          requirements_packet: {
            status: "present",
            source: "source_thread_local_requirements",
            summary: loop.objectiveSummary,
            actualEvidence: [
              `source_thread_id:${loop.sourceThreadId}`,
              `role_slice_id:${slice.roleSliceId}`,
              "task_card_dispatch:false",
            ],
          },
        },
      },
    }));
    loop.status = "running";
    loop.currentRole = "requirements";
    loop.nextRoute = "implementation";
    loop.blockedReason = "";
    loop.updatedAt = timestamp;
    saveState();
    return { ok: true, local: true, loop: publicLoop(loop), slice: publicSlice(slice) };
  }

  function scoreRoleTarget(loop, role, thread) {
    const id = threadIdOf(thread);
    if (!id || sameThreadId(id, loop.sourceThreadId)) return -1;
    const check = roleTargetCheck(loop, role, thread);
    if (!check.ok) return -1;
    const source = sourceThread(loop);
    const sourceCwd = normalizeCwd(source.cwd || source.workspace || source.targetWorkspace);
    const threadCwd = normalizeCwd(thread.cwd || thread.workspace || thread.targetWorkspace);
    const roleText = compactOneLine(thread.threadRole || thread.thread_role || thread.role).toLowerCase();
    const title = compactOneLine(thread.title || thread.name || thread.preview).toLowerCase();
    const sourceTitle = compactOneLine(source.title || source.name || source.preview).toLowerCase();
    let score = 10;
    if (role === "product_audit") {
      if (check.classification.purpose === "audit_lane") score += 120;
      if (/\baudit\b|product[-_\s]*audit/.test(roleText)) score += 80;
      if (/\baudit\b/.test(title)) score += 30;
    } else if (role === "deploy_readback") {
      if (check.classification.purpose === "deploy_lane") score += 120;
      if (/\bdeploy\b|readback/.test(roleText)) score += 80;
    } else {
      if (/\bimplementation\b|\bimplementer\b|\brepair\b/.test(roleText)) score += 100;
      if (check.classification.purpose === "worker_lane") score += 45;
      if (check.classification.purpose === "workspace_implementation" || check.classification.purpose === "codex_mobile_implementation") score += 35;
      if (role === "repair" && /\brepair\b/.test(title)) score += 25;
    }
    if (sourceCwd && threadCwd && sourceCwd === threadCwd) score += 60;
    if (sourceTitle && title && title.includes(sourceTitle)) score += 20;
    return score;
  }

  function selectExistingRoleTarget(loop, role) {
    const candidates = visibleThreads()
      .filter((thread) => !sameThreadId(threadIdOf(thread), loop.sourceThreadId))
      .map((thread) => ({ thread, score: scoreRoleTarget(loop, role, thread) }))
      .filter((entry) => entry.score >= 0)
      .sort((left, right) => right.score - left.score || threadIdOf(left.thread).localeCompare(threadIdOf(right.thread)));
    return candidates[0] && candidates[0].thread || null;
  }

  async function createRoleThread(loop, role) {
    if (typeof dependencies.createLoopRoleThread !== "function") return null;
    const source = sourceThread(loop);
    const cwd = compactOneLine(source.cwd || source.workspace || source.targetWorkspace);
    if (!cwd) return null;
    const thread = await dependencies.createLoopRoleThread({
      loop: publicLoop(loop),
      role,
      sourceThread: publicThread(source),
      cwd,
      title: roleLaneTitle(source, role, loop.objectiveSummary),
      threadRole: roleThreadRole(role),
    });
    return thread || null;
  }

  async function ensureRoleLane(loop, role) {
    const slice = findSlice(loop, { role, iteration: loop.iteration });
    if (!slice) return { ok: false, error: "at_loop_role_slice_not_found" };
    const field = roleThreadField(role);
    const existingId = compactOneLine(slice.targetThreadId || loop[field] || (role === "implementation" || role === "repair" ? loop.targetThreadId : ""));
    if (existingId && !sameThreadId(existingId, loop.sourceThreadId)) {
      const target = readVisibleThreadSummary(existingId);
      if (!target) {
        const timestamp = nowIso(clock);
        slice.targetThreadId = "";
        slice.targetPurpose = "";
        slice.routing = Object.assign({}, slice.routing || {}, {
          staleTargetThreadId: existingId,
          staleTargetReason: "not_visible_or_not_current_deliverable",
        });
        slice.updatedAt = timestamp;
        loop[field] = "";
        if (loop.targetThreadId === existingId) loop.targetThreadId = "";
        loop.updatedAt = timestamp;
        saveState();
      } else {
        const check = roleTargetCheck(loop, role, target);
        if (!check.ok) {
          const timestamp = nowIso(clock);
          slice.targetThreadId = "";
          slice.targetPurpose = "";
          slice.routing = Object.assign({}, publicRoleTargetRoutingMetadata(check), {
            staleTargetThreadId: existingId,
            staleTargetReason: check.error === "at_loop_target_not_deliverable"
              ? "stored_target_not_deliverable"
              : "stored_target_purpose_mismatch",
          });
          slice.updatedAt = timestamp;
          loop[field] = "";
          if (loop.targetThreadId === existingId) loop.targetThreadId = "";
          loop.updatedAt = timestamp;
          saveState();
        } else {
          slice.targetThreadId = existingId;
          slice.targetPurpose = check.classification && check.classification.purpose || "";
          slice.routing = publicRoleTargetRoutingMetadata(check);
          loop[field] = existingId;
          if (role === "implementation") loop.targetThreadId = existingId;
          return { ok: true, target, slice };
        }
      }
    }

    let target = selectExistingRoleTarget(loop, role);
    let created = false;
    if (!target) {
      try {
        target = await createRoleThread(loop, role);
        created = Boolean(target);
      } catch (err) {
        return setLoopBlocked(loop, slice, "at_loop_role_lane_create_failed", {
          dispatchStatus: "failed",
          message: err && err.message || err || "at_loop_role_lane_create_failed",
        });
      }
    }
    if (!target) {
      return setLoopBlocked(loop, slice, "at_loop_missing_role_lane", {
        message: `missing ${role} lane`,
      });
    }
    const check = roleTargetCheck(loop, role, target);
    if (!check.ok) {
      return setLoopBlocked(loop, slice, check.error, { routing: publicRoleTargetRoutingMetadata(check) });
    }
    const targetThreadId = threadIdOf(target);
    if (sameThreadId(targetThreadId, loop.sourceThreadId)) {
      return setLoopBlocked(loop, slice, "at_loop_same_thread_task_card_disallowed", {
        message: "target thread must differ from source thread",
      });
    }
    const timestamp = nowIso(clock);
    slice.targetThreadId = targetThreadId;
    slice.targetPurpose = check.classification && check.classification.purpose || "";
    slice.routing = publicRoutingMetadata(check);
    slice.roleThreadCreated = created;
    slice.updatedAt = timestamp;
    loop[field] = targetThreadId;
    if (role === "implementation") loop.targetThreadId = targetThreadId;
    loop.updatedAt = timestamp;
    saveState();
    return { ok: true, target, slice };
  }

  async function ensureCoreRoleLanes(loop) {
    const implementation = await ensureRoleLane(loop, "implementation");
    if (!implementation.ok) return implementation;
    const audit = await ensureRoleLane(loop, "product_audit");
    if (!audit.ok) return audit;
    return { ok: true };
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
    slice.sourceRequestId = slice.sourceRequestId || `at-loop:${loop.loopId}:${role}:${slice.iteration}`;
    slice.workflowId = slice.workflowId || `at-loop:${loop.loopId}`;
    if (role === "requirements" && sourceOwnsRequirements(loop)) {
      const local = markRequirementsLocal(loop, slice);
      if (!local.ok) return local;
      const lanes = await ensureCoreRoleLanes(loop);
      if (!lanes.ok) return lanes;
      return dispatchRole(loop, "implementation");
    }
    if (role !== "requirements") {
      const lane = await ensureRoleLane(loop, role);
      if (!lane.ok) return lane;
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
    if (sameThreadId(targetThreadId, loop.sourceThreadId)) {
      return setLoopBlocked(loop, slice, "at_loop_same_thread_task_card_disallowed", {
        message: "target thread must differ from source thread",
      });
    }
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
    slice.sourceRequestId = idempotencyKey;
    slice.workflowId = `at-loop:${loop.loopId}`;
    if (role === "product_audit") {
      slice.auditPacketStatus = auditPacketStatus(loop.auditPacket || sanitizeAuditPacket({}));
    }
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
      sourceRole: loop.requirementsLocal ? "requirements" : "loop_coordinator",
      targetRole: role,
      routeKind: "at_loop_role_slice",
      routeResolution: {
        resolverVersion: "at-loop-role-routing-v1",
        routeKind: "at_loop_role_slice",
        inputReferenceKind: "loop_role",
        inputReferenceKinds: ["loop_id", "role_slice_id", "target_thread_id"],
        inputReferenceCount: 3,
        sourceThreadId: loop.sourceThreadId,
        targetThreadId,
        matchedThreadId: targetThreadId,
        matchedThreadIds: [targetThreadId],
        sourceRole: loop.requirementsLocal ? "requirements" : "loop_coordinator",
        targetRole: role,
        code: "at_loop_role_slice",
      },
      workflowMode: "autonomous",
      workflowId: slice.workflowId,
      requestId: idempotencyKey,
      idempotencyKey,
      direct: true,
      autoApprove: true,
      pending: false,
      reasoningEffort: role === "product_audit" ? "medium" : "high",
    };
    if (role === "product_audit") {
      const packet = publicAuditPacket(loop.auditPacket || sanitizeAuditPacket({}));
      payload.auditPacket = packet;
      payload.deltaMatrix = packet.deltaMatrix;
      payload.missingAuditPacketSections = packet.status.missingSections;
    }
    try {
      const result = await createThreadTaskCardsFromSourceThread(loop.sourceThreadId, payload, { source: "at-loop-runtime" });
      const cards = Array.isArray(result && result.cards) ? result.cards : result && result.card ? [result.card] : [];
      const card = cards[0] || {};
      slice.status = "dispatched";
      slice.dispatchStatus = "dispatched";
      slice.dispatchMode = TASK_CARD_DISPATCH;
      slice.taskCardDispatch = true;
      slice.taskCardId = compactOneLine(card.id || card.cardId || result && result.cardId);
      if (role === "product_audit") {
        slice.auditPacketStatus = auditPacketStatus(loop.auditPacket || sanitizeAuditPacket({}));
      }
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
    const requirementsThreadId = explicitTargetId || compactOneLine(sourceTarget.id || sourceTarget.threadId || sourceThreadId);
    const loopId = buildLoopId({
      sourceThreadId,
      targetThreadId: requirementsThreadId,
      targetAlias: parsed.targetAlias,
      domainAdapter: parsed.domainAdapter,
      objective: parsed.objective,
    });
    const state = loadState();
    const existing = state.loops.find((loop) => loop.loopId === loopId);
    if (existing) {
      existing.duplicateSuppressedCount = Number(existing.duplicateSuppressedCount || 0) + 1;
      existing.updatedAt = nowIso(clock);
      if (existing.status === "blocked") {
        const blockedRole = existing.currentRole || existing.nextRoute || "requirements";
        const canRecoverRequirements = blockedRole === "requirements"
          || Array.isArray(existing.roleSlices) && existing.roleSlices.some((slice) => slice.role === "requirements" && /Target thread must be different|same.thread|target_thread_must_differ/i.test(String(slice.blockedReason || "")));
        if (canRecoverRequirements) {
          existing.requirementsThreadId = existing.requirementsThreadId || existing.sourceThreadId;
          existing.blockedReason = "";
          existing.status = "created";
          saveState();
          const recovered = await dispatchRole(existing, "requirements");
          return Object.assign({ ok: recovered.ok !== false, duplicateSuppressed: false, recovered: recovered.ok !== false }, recovered, { loop: publicLoop(existing) });
        }
        saveState();
        return {
          ok: false,
          error: existing.blockedReason || "at_loop_existing_blocked",
          duplicateSuppressed: true,
          loop: publicLoop(existing),
        };
      }
      saveState();
      return { ok: true, duplicateSuppressed: true, loop: publicLoop(existing) };
    }

    const timestamp = nowIso(clock);
    const loop = {
      loopId,
      sourceThreadId,
      targetThreadId: sameThreadId(requirementsThreadId, sourceThreadId) ? "" : requirementsThreadId,
      requirementsThreadId,
      implementationThreadId: "",
      auditThreadId: "",
      deployThreadId: "",
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
      sourceRequestId: compactOneLine(input.requestId || input.request_id) || `at-loop:${loopId}:source`,
      requirementsLocal: sameThreadId(requirementsThreadId, sourceThreadId),
      auditPacket: sanitizeAuditPacket(input),
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
    loop.auditPacket = mergeAuditPacket(loop.auditPacket || sanitizeAuditPacket({}), roleReturnAuditPacketUpdate(loop, slice, input, returnStatus));
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
