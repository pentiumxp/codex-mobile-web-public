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
const {
  createWorkspaceMainThreadRoutingService,
  isWorkspaceMainRole,
  normalizeWorkspaceMainRole,
} = require("../runtime/workspace-main-thread-routing-service");

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
  "blocked_audit_verdict_missing",
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

function auditPacketSectionIdFromHeading(line) {
  const raw = compactOneLine(line)
    .replace(/^\s{0,3}#{1,6}\s*/, "")
    .replace(/^[-*]\s*/, "")
    .replace(/^[`*_]+|[`*_]+$/g, "")
    .replace(/[:：]+$/g, "")
    .trim();
  if (!raw) return "";
  const lower = raw.toLowerCase();
  const words = lower.replace(/[`*_/-]+/g, " ").replace(/\s+/g, " ").trim();
  if (/\brequirements_packet\b/.test(lower) || /^requirements packet\b/.test(words) || /^需求.*包/.test(raw)) return "requirements_packet";
  if (/\bdesign_contract_packet\b/.test(lower) || /^design contract packet\b/.test(words) || /设计契约包|设计合同包/.test(raw)) return "design_contract_packet";
  if (/\bimplementation_packet\b/.test(lower) || /^implementation packet\b/.test(words) || /^实现.*包|^实施.*包/.test(raw)) return "implementation_packet";
  if (/\bvalidation_packet\b/.test(lower) || /^validation packet\b/.test(words) || /^验证.*包|^校验.*包/.test(raw)) return "validation_packet";
  if (/\bprivacy_packet\b/.test(lower) || /^privacy packet\b/.test(words) || /^隐私.*包/.test(raw)) return "privacy_packet";
  return "";
}

function cleanAuditPacketEvidenceLine(line, sectionId) {
  const text = compactOneLine(line)
    .replace(/^\s{0,3}#{1,6}\s*/, "")
    .replace(/^[-*]\s*/, "")
    .replace(/^\d+[.)]\s*/, "")
    .trim();
  if (!text) return "";
  if (sectionId !== "implementation_packet" && /\.agent-context\/HANDOFF\.md/i.test(text)) return "";
  return safePacketValue(text, 220);
}

function extractAuditPacketSectionsFromText(text) {
  const source = String(text || "").slice(0, 12_000);
  if (!source) return {};
  const sections = {};
  let currentSectionId = "";
  for (const line of source.split(/\r?\n/)) {
    const headingSectionId = auditPacketSectionIdFromHeading(line);
    if (headingSectionId) {
      currentSectionId = headingSectionId;
      if (!sections[currentSectionId]) sections[currentSectionId] = [];
      continue;
    }
    if (!currentSectionId) continue;
    const cleaned = cleanAuditPacketEvidenceLine(line, currentSectionId);
    if (!cleaned) continue;
    if (sections[currentSectionId].length < 12) sections[currentSectionId].push(cleaned);
  }
  return Object.fromEntries(Object.entries(sections)
    .filter(([, lines]) => lines.length)
    .map(([id, lines]) => [id, {
      status: "present",
      source: "return_card_body_section",
      summary: safePacketValue(lines.slice(0, 3).join("; "), 320),
      actualEvidence: boundedPacketList(lines, 12, 220),
    }]));
}

function extractAuditPacketSectionsFromInputText(input = {}) {
  const message = input.message && typeof input.message === "object" ? input.message : {};
  const sources = [
    input.returnBody,
    input.bodyMarkdown,
    input.body,
    message.body,
    input.text,
  ].map((value) => String(value || "")).filter(Boolean);
  return sources.reduce((acc, text) => {
    const extracted = extractAuditPacketSectionsFromText(text);
    for (const [id, section] of Object.entries(extracted)) {
      if (!acc[id]) acc[id] = section;
    }
    return acc;
  }, {});
}

function auditReturnText(input = {}) {
  const message = input.message && typeof input.message === "object" ? input.message : {};
  return [
    input.summary,
    input.returnBody,
    input.bodyMarkdown,
    input.body,
    message.summary,
    message.body,
    input.text,
  ].map((value) => String(value || "")).filter(Boolean).join("\n").slice(0, 12_000);
}

function directAuditVerdict(input = {}) {
  const direct = compactOneLine(input.auditVerdict || input.audit_verdict || input.verdict).toLowerCase();
  return AUDIT_VERDICTS.has(direct) ? direct : "";
}

function auditVerdictFromText(text = "") {
  const source = String(text || "");
  const lower = source.toLowerCase();
  for (const verdict of AUDIT_VERDICTS) {
    const pattern = new RegExp(`(^|[^a-z0-9_])${verdict.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9_]|$)`, "i");
    if (pattern.test(source)) return verdict;
  }
  if (/requirements?\s+(gap|problem|issue|missing|unclear|incomplete)|acceptance\s+criteria|requirements?_packet|design_contract_packet|需求包|设计契约|设计合同/.test(lower)) {
    return "failed_requirements_gap";
  }
  if (/privacy|secret|token|credential|access\s*key|隐私|密钥/.test(lower)) return "failed_privacy_boundary";
  if (/test\s+(gap|missing|failed)|validation\s+(gap|missing|failed)|evidence\s+(gap|missing|required|insufficient)|missing\s+evidence|缺少.*证据|验证.*不足/.test(lower)) {
    return "blocked_missing_evidence";
  }
  if (/deploy|readback|production|发布|部署|回读/.test(lower)) return "failed_deployment_readback";
  if (/implementation|bug|regression|ux|ui|visual|layout|interaction|failure|failed|problem|issue|repair|实现|缺陷|界面|交互|问题|修复/.test(lower)) {
    return "failed_implementation_bug";
  }
  return "";
}

function normalizedAuditVerdict(loop, slice, returnInput = {}, returnStatus = "") {
  const explicit = directAuditVerdict(returnInput);
  if (explicit) return { verdict: explicit, source: "explicit" };
  if (!slice || slice.role !== "product_audit") return { verdict: "", source: "" };
  const textVerdict = auditVerdictFromText(auditReturnText(returnInput));
  if (textVerdict) return { verdict: textVerdict, source: "return_text" };
  if (returnStatus === "blocked") {
    const packetStatus = auditPacketStatus(loop.auditPacket || sanitizeAuditPacket({}));
    if (packetStatus.missingSections.includes("requirements_packet")
      || packetStatus.missingSections.includes("design_contract_packet")) {
      return { verdict: "failed_requirements_gap", source: "blocked_missing_requirements_packet" };
    }
    if (packetStatus.complete === false) {
      return { verdict: "blocked_missing_evidence", source: "blocked_incomplete_audit_packet" };
    }
    return { verdict: "blocked_missing_evidence", source: "blocked_missing_structured_verdict" };
  }
  if (returnStatus === "completed") {
    return { verdict: "blocked_audit_verdict_missing", source: "completed_missing_structured_verdict" };
  }
  return { verdict: "", source: "" };
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
  return { version: STATE_VERSION, loops: [], workerLanes: [] };
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

function loopImplementationWorkspaceCwd(loop = {}) {
  return compactOneLine(loop.implementationWorkspaceCwd || loop.implementationWorkspace || loop.implementationCwd);
}

function inputImplementationWorkspaceCwd(input = {}) {
  return compactOneLine(input.implementationWorkspaceCwd
    || input.implementationWorkspace
    || input.implementationCwd
    || input.implementation_workspace_cwd
    || input.implementation_workspace
    || input.implementation_cwd);
}

function roleWorkspaceCwd(loop = {}, role = "", source = {}) {
  if (roleFollowsImplementationWorkspace(role)) {
    return loopImplementationWorkspaceCwd(loop)
      || compactOneLine(source.cwd || source.workspace || source.targetWorkspace);
  }
  return compactOneLine(source.cwd || source.workspace || source.targetWorkspace);
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

function workspaceToken(value) {
  return compactOneLine(value).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "");
}

function workspacePathTokens(cwd) {
  return compactOneLine(cwd).split(/[\\/]+/).map(workspaceToken).filter(Boolean);
}

function roleRequiresImplementationWorkspace(role) {
  return role === "implementation" || role === "repair";
}

function roleFollowsImplementationWorkspace(role) {
  return roleRequiresImplementationWorkspace(role) || role === "product_audit" || role === "deploy_readback";
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
  if (role === "requirements") return "requirements";
  return "implementation";
}

function workspaceDisplayName(sourceThread, cwd) {
  const sourceTitle = compactOneLine(sourceThread && (sourceThread.title || sourceThread.name || sourceThread.preview))
    || compactOneLine(sourceThread && (sourceThread.id || sourceThread.threadId))
    || "Loop";
  const compactTitle = sourceTitle
    .replace(/\s+Loop\s+(?:Requirements|Implementation|Implement|Audit|Repair|Deploy Readback)\b.*$/i, "")
    .replace(/\s*[:：].*$/, "")
    .trim();
  if (compactTitle) return boundedText(compactTitle, 60);
  const parts = compactOneLine(cwd).split(/[\\/]+/).filter(Boolean);
  return boundedText(parts[parts.length - 1] || "Workspace", 60);
}

function roleLaneTitle(sourceThread, role, _objectiveSummary, cwd = "") {
  const workspace = workspaceDisplayName(sourceThread, cwd);
  const suffix = role === "requirements"
    ? "Loop Requirements"
    : role === "product_audit"
      ? "Loop Audit"
      : role === "deploy_readback"
        ? "Loop Deploy Readback"
        : role === "repair"
          ? "Loop Repair"
          : "Loop Implement";
  return boundedText(`${workspace} ${suffix}`, 120);
}

function workerLaneTitle(sourceThread, purpose = "", cwd = "") {
  const workspace = workspaceDisplayName(sourceThread, cwd);
  const normalizedPurpose = compactOneLine(purpose).toLowerCase();
  const suffix = normalizedPurpose && normalizedPurpose !== "default"
    ? `Worker ${boundedText(normalizedPurpose.replace(/[_-]+/g, " "), 32)}`
    : "Worker Lane";
  return boundedText(`${workspace} ${suffix}`, 120);
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

function auditPacketHasPresentSection(packet = {}, sectionId = "") {
  const id = compactOneLine(sectionId);
  const sections = Array.isArray(packet && packet.sections) ? packet.sections : [];
  return sections.some((section) => compactOneLine(section && section.id) === id
    && section.required !== false
    && section.status === "present");
}

function sourceRequirementsReadyForImplementation(loop = {}) {
  const packet = loop.auditPacket || sanitizeAuditPacket({});
  return auditPacketHasPresentSection(packet, "requirements_packet")
    && auditPacketHasPresentSection(packet, "design_contract_packet");
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
  if (Array.isArray(input.changedFiles) && input.changedFiles.length) {
    evidence.push(`changed_files:${input.changedFiles.length}`);
    for (const file of boundedPacketList(input.changedFiles, 8, 180)) evidence.push(`changed_file:${file}`);
  }
  if (Array.isArray(input.tests) && input.tests.length) {
    evidence.push(`tests:${input.tests.length}`);
    for (const testName of boundedPacketList(input.tests, 8, 180)) evidence.push(`test:${testName}`);
  }
  return evidence.filter((item) => !/:$/.test(item));
}

function roleReturnAuditPacketUpdate(loop, slice, input, returnStatus) {
  let packet = sanitizeAuditPacket(input);
  const bodySectionUpdates = extractAuditPacketSectionsFromInputText(input);
  if (Object.keys(bodySectionUpdates).length) {
    packet = mergeAuditPacket(packet, sanitizeAuditPacket({ auditPacket: { sections: bodySectionUpdates } }));
  }
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

function repairPacketBody(loop) {
  const packet = publicAuditPacket(loop.auditPacket || sanitizeAuditPacket({}));
  const missingSections = packet.status.missingSections;
  const auditSlice = (Array.isArray(loop.roleSlices) ? loop.roleSlices : [])
    .filter((slice) => slice && slice.role === "product_audit" && slice.iteration === loop.iteration && slice.status === "returned")
    .slice(-1)[0] || null;
  const auditSummary = safePacketValue(auditSlice && auditSlice.returnSummary || "", 320);
  const lines = [
    "",
    "## Repair Input",
    "",
    `Last audit verdict: ${loop.lastAuditVerdict || "none"}`,
    `Audit return summary: ${auditSummary || "none"}`,
    `Missing audit packet sections: ${missingSections.length ? missingSections.join(", ") : "none"}`,
    "Return bounded implementation, validation, and privacy packet updates when repair work fills missing evidence.",
    "",
  ];
  return lines.join("\n");
}

function roleCardBody(loop, slice) {
  const implementationWorkspaceCwd = loopImplementationWorkspaceCwd(loop);
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
    `Implementation workspace cwd: ${implementationWorkspaceCwd || ""}`,
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
  if (slice.role === "repair") return `${body}${repairPacketBody(loop)}`;
  return body;
}

function nextRouteForAuditVerdict(verdict) {
  if (verdict === "passed") return "closed";
  if (verdict === "failed_requirements_gap") return "requirements_revision";
  if (["failed_implementation_bug", "failed_test_gap", "failed_privacy_boundary"].includes(verdict)) {
    return "implementation_repair";
  }
  if (verdict === "failed_deployment_readback") return "deploy_readback";
  if (verdict === "blocked_missing_evidence") return "implementation_repair";
  if (verdict === "blocked_audit_verdict_missing") return "audit_routing_error";
  if (verdict === "rejected_out_of_scope") return "rejected";
  if (verdict && verdict.startsWith("blocked_")) return verdict;
  return "awaiting_audit_verdict";
}

function productAuditBlockedRepairRoute(loop, auditVerdict) {
  if (auditVerdict === "failed_requirements_gap") return "";
  if (auditVerdict === "blocked_missing_evidence") return "blocked_missing_evidence_repair";
  const status = auditPacketStatus(loop.auditPacket || sanitizeAuditPacket({}));
  if (status && (status.missingSections.includes("requirements_packet") || status.missingSections.includes("design_contract_packet"))) return "";
  if (status && status.complete === false) return "audit_missing_evidence_repair";
  if (!auditVerdict) return "audit_blocked_missing_verdict_repair";
  return "";
}

function roleAfterTerminal(loop, slice, returnStatus, auditVerdict) {
  if (returnStatus === "blocked" && slice.role === "product_audit") {
    const verdictRoute = nextRouteForAuditVerdict(auditVerdict);
    if (verdictRoute === "requirements_revision" || verdictRoute === "audit_routing_error") {
      return { role: "requirements", nextRoute: verdictRoute, blockedReturnRole: slice.role };
    }
    if (verdictRoute === "implementation_repair") return { role: "repair", nextRoute: verdictRoute, blockedReturnRole: slice.role };
    if (verdictRoute === "deploy_readback") return { role: "deploy_readback", nextRoute: verdictRoute, blockedReturnRole: slice.role };
    const repairRoute = productAuditBlockedRepairRoute(loop, auditVerdict);
    if (repairRoute) return { role: "repair", nextRoute: repairRoute, blockedReturnRole: slice.role };
    return { loopStatus: "blocked", nextRoute: "blocked_role_return" };
  }
  if (returnStatus === "blocked" && (slice.role === "implementation" || slice.role === "repair")) {
    return { role: "requirements", nextRoute: "requirements_revision", blockedReturnRole: slice.role };
  }
  if (returnStatus === "blocked") return { loopStatus: "blocked", nextRoute: "blocked_role_return" };
  if (returnStatus === "rejected") return { loopStatus: "rejected", nextRoute: "rejected_role_return" };
  if (slice.role === "requirements") return { role: "implementation", nextRoute: "implementation" };
  if (slice.role === "implementation") return { role: "product_audit", nextRoute: "product_audit" };
  if (slice.role === "repair") {
    if (loop.iteration >= loop.maxIterations) {
      const status = auditPacketStatus(loop.auditPacket || sanitizeAuditPacket({}));
      if (status.complete && loop.maxIterations < 10) {
        loop.iteration += 1;
        loop.maxIterations = Math.max(loop.maxIterations, loop.iteration);
        return { role: "product_audit", nextRoute: "product_audit_packet_retry" };
      }
      return { loopStatus: "blocked", nextRoute: "max_iterations_reached" };
    }
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
    if (route === "audit_routing_error") return { role: "requirements", nextRoute: route };
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
  const readThreadTaskCardForLoopEvidence = typeof dependencies.readThreadTaskCardForLoopEvidence === "function"
    ? dependencies.readThreadTaskCardForLoopEvidence
    : null;
  const startSourceRequirementsTurn = typeof dependencies.startSourceRequirementsTurn === "function"
    ? dependencies.startSourceRequirementsTurn
    : null;
  const recordSourceRequirementsScriptPath = compactOneLine(dependencies.recordSourceRequirementsScriptPath)
    || "scripts/record-at-loop-requirements.js";
  const workspaceMainRouting = dependencies.workspaceMainRouting || createWorkspaceMainThreadRoutingService({
    fs,
    path: pathModule,
    readContinuationLineageEntries: dependencies.readContinuationLineageEntries,
    readThreadSummary,
    visibleThreads,
  });

  let stateCache = null;

  function defaultImplementationWorkspaceCheck(cwd) {
    const root = compactOneLine(cwd);
    if (!root) return { ok: false, error: "implementation_workspace_missing" };
    let stat;
    try {
      stat = fs.statSync(root);
    } catch (_) {
      return { ok: false, error: "implementation_workspace_not_found", cwd: root };
    }
    if (!stat || !stat.isDirectory()) {
      return { ok: false, error: "implementation_workspace_not_directory", cwd: root };
    }
    let entries;
    try {
      entries = fs.readdirSync(root);
    } catch (_) {
      return { ok: false, error: "implementation_workspace_unreadable", cwd: root };
    }
    const entrySet = new Set(entries);
    const markerFiles = [
      ".git",
      "package.json",
      "pnpm-lock.yaml",
      "yarn.lock",
      "package-lock.json",
      "Cargo.toml",
      "go.mod",
      "pyproject.toml",
      "requirements.txt",
      "Gemfile",
      "Makefile",
      "CMakeLists.txt",
      "Package.swift",
      "server.js",
    ];
    if (markerFiles.some((name) => entrySet.has(name))) {
      return { ok: true, cwd: root, reason: "workspace_marker" };
    }
    if (entries.some((name) => /\.(?:xcodeproj|xcworkspace)$/i.test(name))) {
      return { ok: true, cwd: root, reason: "xcode_project_marker" };
    }
    if (entries.some((name) => ["src", "Sources", "app", "public"].includes(name))) {
      return { ok: true, cwd: root, reason: "source_directory_marker" };
    }
    return { ok: false, error: "implementation_workspace_project_markers_missing", cwd: root };
  }

  function implementationWorkspaceCheck(cwd, context = {}) {
    if (typeof dependencies.isLoopImplementationWorkspace === "function") {
      const result = dependencies.isLoopImplementationWorkspace(cwd, context);
      if (result && typeof result === "object") return Object.assign({ ok: result.ok !== false }, result);
      return result === true
        ? { ok: true, cwd: compactOneLine(cwd), reason: "custom_validator" }
        : { ok: false, error: "implementation_workspace_unresolved", cwd: compactOneLine(cwd) };
    }
    return defaultImplementationWorkspaceCheck(cwd);
  }

  function implementationWorkspaceCandidateScore(workspace = {}, sourceThread = {}) {
    const cwd = compactOneLine(workspace.cwd || workspace.path || workspace.workspace);
    const sourceCwd = compactOneLine(sourceThread && (sourceThread.cwd || sourceThread.workspace || sourceThread.targetWorkspace));
    const sourceTitle = compactOneLine(sourceThread && (sourceThread.title || sourceThread.name || sourceThread.preview));
    const sourceBase = workspaceToken(sourceCwd.split(/[\\/]+/).filter(Boolean).pop() || "");
    const sourceTitleToken = workspaceToken(sourceTitle);
    const workspaceLabelToken = workspaceToken(workspace.label || workspace.name || workspace.title || "");
    const cwdToken = workspaceToken(cwd);
    const pathTokens = workspacePathTokens(cwd);
    if (sourceCwd && normalizeCwd(cwd) === normalizeCwd(sourceCwd)) return 100;
    let score = 0;
    if (sourceTitleToken && pathTokens.includes(sourceTitleToken)) score = Math.max(score, 80);
    if (sourceTitleToken && workspaceLabelToken && workspaceLabelToken.includes(sourceTitleToken)) score = Math.max(score, 70);
    if (sourceBase && sourceBase.length >= 4 && cwdToken.includes(sourceBase)) score = Math.max(score, 55);
    return score;
  }

  async function registeredImplementationWorkspaceCwd(sourceThread = {}) {
    if (typeof dependencies.listWorkspaces !== "function") return "";
    let rows;
    try {
      rows = await dependencies.listWorkspaces();
    } catch (_) {
      return "";
    }
    const candidates = [];
    for (const workspace of Array.isArray(rows) ? rows : []) {
      const cwd = compactOneLine(workspace && (workspace.cwd || workspace.path || workspace.workspace));
      if (!cwd) continue;
      const check = implementationWorkspaceCheck(cwd, {
        role: "implementation",
        sourceThread,
        source: "registered-workspace",
      });
      if (!check || check.ok === false) continue;
      const score = implementationWorkspaceCandidateScore(workspace, sourceThread);
      if (score <= 0) continue;
      candidates.push({ cwd, score });
    }
    candidates.sort((left, right) => right.score - left.score || left.cwd.localeCompare(right.cwd));
    if (!candidates.length) return "";
    if (candidates[1] && candidates[1].score === candidates[0].score) return "";
    return candidates[0].cwd;
  }

  async function resolvedImplementationWorkspaceCwd(input = {}, sourceThread = {}) {
    const explicit = inputImplementationWorkspaceCwd(input);
    if (explicit) return explicit;
    if (typeof dependencies.resolveLoopImplementationWorkspaceCwd === "function") {
      const resolved = await dependencies.resolveLoopImplementationWorkspaceCwd({
        input,
        sourceThread,
        sourceThreadId: compactOneLine(input.sourceThreadId || input.threadId),
      });
      const cwd = compactOneLine(resolved && typeof resolved === "object"
        ? resolved.cwd || resolved.path || resolved.workspace
        : resolved);
      if (cwd) return cwd;
    }
    return registeredImplementationWorkspaceCwd(sourceThread);
  }

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
      workerLanes: Array.isArray(parsed.workerLanes) ? parsed.workerLanes : [],
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
      if (typeof dependencies.resolveThreadTaskCardTargetReference === "function") {
        const resolved = dependencies.resolveThreadTaskCardTargetReference(targetThreadId, loop && loop.sourceThreadId || "");
        if (compactOneLine(resolved) !== targetThreadId) {
          return {
            ok: false,
            error: "target_thread_not_resolved",
            message: "Target thread is not visible or is not a current deliverable thread.",
          };
        }
        return { ok: true };
      }
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
    if (!threadHasRoleLaneSignal(role, thread)) {
      return Object.assign({}, loopCheck, {
        ok: false,
        error: "at_loop_target_not_role_lane",
        role,
        roleLaneRequired: true,
      });
    }
    if (roleFollowsImplementationWorkspace(role) && !roleRequiresImplementationWorkspace(role)) {
      const expectedCwd = normalizeCwd(loopImplementationWorkspaceCwd(loop));
      const threadCwd = normalizeCwd(thread && (thread.cwd || thread.workspace || thread.targetWorkspace));
      if (expectedCwd && threadCwd && expectedCwd !== threadCwd) {
        return Object.assign({}, loopCheck, {
          ok: false,
          error: "at_loop_role_workspace_mismatch",
          role,
          workspace: {
            ok: false,
            error: "role_workspace_mismatch",
            expectedCwd: loopImplementationWorkspaceCwd(loop),
            cwd: thread && (thread.cwd || thread.workspace || thread.targetWorkspace) || "",
          },
        });
      }
    }
    if (roleRequiresImplementationWorkspace(role)) {
      const expectedCwd = normalizeCwd(loopImplementationWorkspaceCwd(loop));
      const threadCwd = normalizeCwd(thread && (thread.cwd || thread.workspace || thread.targetWorkspace));
      if (expectedCwd && threadCwd && expectedCwd !== threadCwd) {
        return Object.assign({}, loopCheck, {
          ok: false,
          error: "at_loop_implementation_workspace_mismatch",
          role,
          workspace: {
            ok: false,
            error: "implementation_workspace_mismatch",
            expectedCwd: loopImplementationWorkspaceCwd(loop),
            cwd: thread && (thread.cwd || thread.workspace || thread.targetWorkspace) || "",
          },
        });
      }
      const workspace = implementationWorkspaceCheck(thread && (thread.cwd || thread.workspace || thread.targetWorkspace), {
        role,
        loop,
        thread,
      });
      if (!workspace.ok) {
        return Object.assign({}, loopCheck, {
          ok: false,
          error: "at_loop_implementation_workspace_unresolved",
          role,
          workspace,
        });
      }
    }
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
    if (result.roleLaneRequired) out.roleLaneRequired = true;
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

  function threadHasRoleLaneSignal(role, thread = {}) {
    if (role !== "implementation" && role !== "repair") return true;
    const roleText = compactOneLine(thread.threadRole || thread.thread_role || thread.role || thread.taskCardRole || thread.task_card_role).toLowerCase();
    const title = compactOneLine(thread.title || thread.name || thread.preview).toLowerCase();
    if (/\bimplementation\b|\bimplementer\b/.test(roleText)) return true;
    if (role === "repair" && /\brepair\b/.test(roleText)) return true;
    if (role === "implementation" && /\bimplementation\b|\bimplementer\b/.test(title)) return true;
    if (role === "repair" && /\brepair\b/.test(title)) return true;
    return false;
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
      sourceRequirementsTurnId: slice.sourceRequirementsTurnId || "",
      sourceRequirementsTurnStatus: slice.sourceRequirementsTurnStatus || "",
      sourceRequirementsTurnStartedAt: slice.sourceRequirementsTurnStartedAt || "",
      sourceRequirementsTurnError: slice.sourceRequirementsTurnError || "",
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
    const requirementsSlice = slices.find((slice) => slice.role === "requirements" && slice.iteration === (loop.iteration || 1))
      || slices.find((slice) => slice.role === "requirements")
      || null;
    return {
      loopId: loop.loopId || "",
      sourceThreadId: loop.sourceThreadId || "",
      targetThreadId: loop.targetThreadId || "",
      requirementsThreadId: loop.requirementsThreadId || "",
      implementationThreadId: loop.implementationThreadId || "",
      implementationWorkspaceCwd: loopImplementationWorkspaceCwd(loop),
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
      sourceRequirementsStatus: loop.requirementsLocal === true ? {
        status: requirementsSlice && requirementsSlice.status || "",
        dispatchStatus: requirementsSlice && requirementsSlice.dispatchStatus || "",
        returnStatus: requirementsSlice && requirementsSlice.returnStatus || "",
        pending: loop.status === "waiting_source_requirements" || requirementsSlice && requirementsSlice.status === "waiting",
        readyForImplementation: sourceRequirementsReadyForImplementation(loop),
        missingSections: ["requirements_packet", "design_contract_packet"].filter((id) => !auditPacketHasPresentSection(loop.auditPacket || sanitizeAuditPacket({}), id)),
        blockedReason: requirementsSlice && requirementsSlice.blockedReason || loop.blockedReason || "",
        localTurnStatus: requirementsSlice && requirementsSlice.sourceRequirementsTurnStatus || "",
        localTurnId: requirementsSlice && requirementsSlice.sourceRequirementsTurnId || "",
        localTurnStartedAt: requirementsSlice && requirementsSlice.sourceRequirementsTurnStartedAt || "",
        localTurnError: requirementsSlice && requirementsSlice.sourceRequirementsTurnError || "",
      } : null,
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

  function isTargetUndeliverableDispatchError(err) {
    const code = compactOneLine(err && err.code);
    const message = compactOneLine(err && err.message || err);
    return code === "target_thread_not_visible"
      || code === "target_thread_not_deliverable"
      || /not visible|not a current deliverable|not deliverable/i.test(message);
  }

  function clearRoleLaneTarget(loop, slice, reason) {
    const timestamp = nowIso(clock);
    const role = slice && slice.role || "";
    const field = roleThreadField(role);
    const staleTargetThreadId = compactOneLine(slice && slice.targetThreadId || loop && loop[field] || "");
    if (slice) {
      slice.targetThreadId = "";
      slice.targetPurpose = "";
      slice.taskCardId = "";
      slice.routing = Object.assign({}, slice.routing || {}, {
        staleTargetThreadId,
        staleTargetReason: reason,
      });
      slice.updatedAt = timestamp;
    }
    if (field && loop) loop[field] = "";
    if (loop && loop.targetThreadId === staleTargetThreadId) loop.targetThreadId = "";
    if (loop) loop.updatedAt = timestamp;
    saveState();
  }

  function returnedRoleWorkspaceMismatch(loop, slice) {
    if (!slice || slice.returnStatus !== "blocked" || !roleFollowsImplementationWorkspace(slice.role)) return false;
    const expectedCwd = normalizeCwd(loopImplementationWorkspaceCwd(loop));
    if (!expectedCwd) return false;
    const targetThreadId = compactOneLine(slice.targetThreadId || loop && loop[roleThreadField(slice.role)] || "");
    if (!targetThreadId) return true;
    const target = readThreadSummary(targetThreadId);
    if (!target) return true;
    const targetCwd = normalizeCwd(target.cwd || target.workspace || target.targetWorkspace);
    return !targetCwd || targetCwd !== expectedCwd;
  }

  function blockedReturnedRoleForRedispatch(loop) {
    const slices = Array.isArray(loop && loop.roleSlices) ? loop.roleSlices : [];
    return slices.find((slice) => slice.status === "returned" && returnedRoleWorkspaceMismatch(loop, slice)) || null;
  }

  function productAuditBlockedReturnForRepair(loop) {
    const slices = Array.isArray(loop && loop.roleSlices) ? loop.roleSlices : [];
    return slices.find((slice) => {
      if (!slice || slice.role !== "product_audit") return false;
      if (slice.status !== "returned" || slice.returnStatus !== "blocked") return false;
      return Boolean(productAuditBlockedRepairRoute(loop, slice.auditVerdict));
    }) || null;
  }

  function blockedDispatchRoleForRedispatch(loop) {
    const slices = Array.isArray(loop && loop.roleSlices) ? loop.roleSlices : [];
    return slices.find((slice) => {
      if (!slice || !["implementation", "product_audit", "repair", "deploy_readback"].includes(slice.role)) return false;
      if (slice.status !== "blocked") return false;
      const dispatchStatus = compactOneLine(slice.dispatchStatus);
      if (dispatchStatus && !["failed", "blocked"].includes(dispatchStatus)) return false;
      if (isTargetUndeliverableDispatchError(slice.blockedReason)) return true;
      return compactOneLine(loop && loop.blockedReason) === "at_loop_dispatch_failed";
    }) || null;
  }

  function resetReturnedRoleForRedispatch(loop, slice, reason) {
    const timestamp = nowIso(clock);
    const staleTargetThreadId = compactOneLine(slice && slice.targetThreadId || "");
    clearRoleLaneTarget(loop, slice, reason);
    slice.status = "pending";
    slice.dispatchStatus = "";
    slice.dispatchMode = "";
    slice.taskCardDispatch = true;
    slice.returnStatus = "";
    slice.returnCardId = "";
    slice.returnSummary = "";
    slice.auditVerdict = "";
    slice.blockedReason = "";
    slice.dispatchedAt = "";
    slice.updatedAt = timestamp;
    loop.status = "running";
    loop.currentRole = slice.role;
    loop.nextRoute = slice.role;
    loop.blockedReason = "";
    loop.updatedAt = timestamp;
    saveState();
    return {
      role: slice.role,
      staleTargetThreadId,
      excludedTargetThreadIds: staleTargetThreadId ? [staleTargetThreadId] : [],
    };
  }

  function resetBlockedRoleForRedispatch(loop, slice, reason) {
    const timestamp = nowIso(clock);
    const targetThreadId = compactOneLine(slice && slice.targetThreadId || "");
    const preserveCreatedLane = Boolean(slice && slice.roleThreadCreated && targetThreadId)
      && !alternateExistingRoleTarget(loop, slice.role, targetThreadId);
    if (!preserveCreatedLane) return resetReturnedRoleForRedispatch(loop, slice, reason);
    slice.status = "pending";
    slice.dispatchStatus = "";
    slice.dispatchMode = "";
    slice.taskCardDispatch = true;
    slice.returnStatus = "";
    slice.returnCardId = "";
    slice.returnSummary = "";
    slice.auditVerdict = "";
    slice.blockedReason = "";
    slice.dispatchedAt = "";
    slice.routing = Object.assign({}, slice.routing || {}, {
      preservedTargetThreadId: targetThreadId,
      preservedTargetReason: reason,
    });
    slice.updatedAt = timestamp;
    loop.status = "running";
    loop.currentRole = slice.role;
    loop.nextRoute = slice.role;
    loop.blockedReason = "";
    loop.updatedAt = timestamp;
    saveState();
    return {
      role: slice.role,
      staleTargetThreadId: "",
      excludedTargetThreadIds: [],
    };
  }

  function prepareRepairForAuditBlockedReturn(loop, auditSlice) {
    const timestamp = nowIso(clock);
    const auditBlockedRoute = productAuditBlockedRepairRoute(loop, auditSlice && auditSlice.auditVerdict || "");
    if (auditSlice && !auditSlice.auditVerdict && auditBlockedRoute) {
      auditSlice.auditVerdict = "blocked_missing_evidence";
      auditSlice.routing = Object.assign({}, auditSlice.routing || {}, {
        auditVerdictNormalization: "historical_blocked_missing_structured_verdict",
      });
      loop.lastAuditVerdict = loop.lastAuditVerdict || auditSlice.auditVerdict;
    }
    let repair = findSlice(loop, { role: "repair", iteration: loop.iteration });
    if (!repair) {
      repair = {
        role: "repair",
        roleSliceId: `${loop.loopId}:repair:${loop.iteration}`,
        iteration: loop.iteration,
        createdAt: timestamp,
      };
      loop.roleSlices.push(repair);
    }
    repair.status = "pending";
    repair.dispatchStatus = "";
    repair.dispatchMode = "";
    repair.taskCardDispatch = true;
    repair.taskCardId = "";
    repair.returnStatus = "";
    repair.returnCardId = "";
    repair.returnSummary = "";
    repair.auditVerdict = "";
    repair.blockedReason = "";
    repair.routing = Object.assign({}, repair.routing || {}, {
      auditBlockedRoleSliceId: auditSlice && auditSlice.roleSliceId || "",
      auditBlockedRoute,
    });
    repair.updatedAt = timestamp;
    loop.status = "running";
    loop.currentRole = "repair";
    loop.nextRoute = "repair";
    loop.blockedReason = "";
    loop.updatedAt = timestamp;
    saveState();
    return { role: "repair" };
  }

  function rebuildAuditPacketFromReturnedRoleCards(loop) {
    if (!readThreadTaskCardForLoopEvidence) return false;
    let changed = false;
    const slices = Array.isArray(loop && loop.roleSlices) ? loop.roleSlices : [];
    for (const slice of slices) {
      if (!slice || slice.status !== "returned" || !["implementation", "repair", "requirements"].includes(slice.role)) continue;
      const returnCardId = compactOneLine(slice.returnCardId || slice.replyCardId);
      if (!returnCardId) continue;
      let card;
      try {
        card = readThreadTaskCardForLoopEvidence(returnCardId);
      } catch (_) {
        card = null;
      }
      const message = card && card.message && typeof card.message === "object" ? card.message : {};
      const returnBody = String(message.body || "");
      if (!returnBody) continue;
      const update = roleReturnAuditPacketUpdate(loop, slice, {
        taskCardId: slice.taskCardId,
        returnCardId,
        status: slice.returnStatus || "completed",
        summary: slice.returnSummary || message.summary || "",
        returnBody,
      }, normalizeStatus(slice.returnStatus || "completed"));
      const before = JSON.stringify(publicAuditPacket(loop.auditPacket || sanitizeAuditPacket({})).status);
      loop.auditPacket = mergeAuditPacket(loop.auditPacket || sanitizeAuditPacket({}), update);
      const after = JSON.stringify(publicAuditPacket(loop.auditPacket || sanitizeAuditPacket({})).status);
      if (after !== before) changed = true;
    }
    if (changed) {
      loop.updatedAt = nowIso(clock);
      saveState();
    }
    return changed;
  }

  function terminalReturnInputWithStoredBody(slice, input = {}) {
    if (!readThreadTaskCardForLoopEvidence) return input;
    if (input.returnBody || input.body || input.bodyMarkdown || input.text || input.message && input.message.body) return input;
    const returnCardId = compactOneLine(input.returnCardId || input.replyCardId || slice && (slice.returnCardId || slice.replyCardId));
    if (!returnCardId) return input;
    let card;
    try {
      card = readThreadTaskCardForLoopEvidence(returnCardId);
    } catch (_) {
      card = null;
    }
    const message = card && card.message && typeof card.message === "object" ? card.message : {};
    if (!message.body) return input;
    return Object.assign({}, input, {
      returnBody: String(message.body || ""),
      summary: input.summary || message.summary || "",
    });
  }


  function prepareProductAuditPacketRetry(loop, reason = "audit_packet_rebuilt") {
    const timestamp = nowIso(clock);
    if (loop.iteration >= loop.maxIterations) {
      loop.iteration += 1;
      loop.maxIterations = Math.max(loop.maxIterations, loop.iteration);
    }
    let audit = findSlice(loop, { role: "product_audit", iteration: loop.iteration });
    if (!audit) {
      audit = {
        role: "product_audit",
        roleSliceId: `${loop.loopId}:product_audit:${loop.iteration}`,
        iteration: loop.iteration,
        createdAt: timestamp,
      };
      loop.roleSlices.push(audit);
    }
    audit.status = "pending";
    audit.dispatchStatus = "";
    audit.dispatchMode = "";
    audit.taskCardDispatch = true;
    audit.taskCardId = "";
    audit.returnStatus = "";
    audit.returnCardId = "";
    audit.returnSummary = "";
    audit.auditVerdict = "";
    audit.blockedReason = "";
    audit.routing = Object.assign({}, audit.routing || {}, {
      packetRetryReason: compactOneLine(reason),
    });
    audit.updatedAt = timestamp;
    loop.status = "running";
    loop.currentRole = "product_audit";
    loop.nextRoute = "product_audit_packet_retry";
    loop.blockedReason = "";
    loop.updatedAt = timestamp;
    saveState();
    return { role: "product_audit" };
  }

  function sourceRequirementsPrompt(loop, slice) {
    return [
      "# Codex Mobile @loop source requirements analysis",
      "",
      "你是当前主线程的 Loop 需求分析角色。不要实现代码、不要部署、不要向同线程发送 task card。",
      "先把 Owner 的目标整理成结构化需求包和设计契约包；只有记录完成后，Codex Mobile 才会派发实现线程和审计线程。",
      "",
      `Loop id: ${loop.loopId}`,
      `Role slice id: ${slice.roleSliceId}`,
      `Source thread id: ${loop.sourceThreadId}`,
      `Implementation workspace cwd: ${loopImplementationWorkspaceCwd(loop) || "(runtime will resolve later)"}`,
      "",
      "## Objective",
      loop.objectiveSummary || "(bounded objective unavailable)",
      "",
      "## Required Output",
      "",
      "请在当前线程回复并包含这两个一级小节：",
      "",
      "## Requirements Packet",
      "- objective / non-goals",
      "- acceptance criteria",
      "- user-visible success",
      "- privacy boundary",
      "- risk gates",
      "",
      "## Design Contract Packet",
      "- owning workspace and architecture boundary",
      "- relevant docs/contracts",
      "- routing policy for implementation/audit lanes",
      "- focused validation harnesses",
      "- implementation lane hints when needed",
      "",
      "完成分析后，把完整分析正文写入一个临时 Markdown 文件，然后运行下面的受限记录命令。命令只提交 packet 正文，不打印正文内容：",
      "",
      "```sh",
      `node "${recordSourceRequirementsScriptPath}" --loop "${loop.loopId}" --role-slice "${slice.roleSliceId}" --status completed --body-file <requirements-packet.md>`,
      "```",
      "",
      "如果无法产出需求/设计包，使用 `--status blocked` 并在正文里给出 bounded reason。不要包含 raw secrets、cookies、launch tokens、provider payloads、private thread bodies、screenshots with private data、DB rows 或 long logs。",
    ].join("\n");
  }

  async function ensureSourceRequirementsTurn(loop, slice) {
    if (!slice || sourceRequirementsReadyForImplementation(loop)) {
      return { ok: true, skipped: true, reason: "source_requirements_ready" };
    }
    const status = compactOneLine(slice.sourceRequirementsTurnStatus);
    if (slice.sourceRequirementsTurnId || status === "started" || status === "starting") {
      return { ok: true, duplicateSuppressed: true };
    }
    const timestamp = nowIso(clock);
    if (!startSourceRequirementsTurn) {
      slice.sourceRequirementsTurnStatus = "unavailable";
      slice.sourceRequirementsTurnError = "source_requirements_turn_unavailable";
      slice.routing = Object.assign({}, slice.routing || {}, {
        sourceRequirementsTurnUnavailable: true,
      });
      slice.updatedAt = timestamp;
      loop.updatedAt = timestamp;
      saveState();
      return { ok: true, unavailable: true };
    }
    slice.sourceRequirementsTurnStatus = "starting";
    slice.sourceRequirementsTurnError = "";
    slice.updatedAt = timestamp;
    loop.updatedAt = timestamp;
    saveState();
    try {
      const result = await startSourceRequirementsTurn({
        loop: publicLoop(loop),
        slice: publicSlice(slice),
        sourceThread: publicThread(sourceThread(loop)),
        prompt: sourceRequirementsPrompt(loop, slice),
      });
      const startedAt = nowIso(clock);
      slice.sourceRequirementsTurnStatus = "started";
      slice.sourceRequirementsTurnId = compactOneLine(result && (result.turnId || result.id || result.turn_id));
      slice.sourceRequirementsTurnStartedAt = startedAt;
      slice.sourceRequirementsTurnError = "";
      slice.routing = Object.assign({}, slice.routing || {}, {
        sourceRequirementsTurnStarted: true,
      });
      slice.updatedAt = startedAt;
      loop.updatedAt = startedAt;
      saveState();
      return { ok: true, result };
    } catch (err) {
      const failedAt = nowIso(clock);
      slice.sourceRequirementsTurnStatus = "failed";
      slice.sourceRequirementsTurnError = compactOneLine(err && err.message || err || "source_requirements_turn_failed");
      slice.routing = Object.assign({}, slice.routing || {}, {
        sourceRequirementsTurnFailed: true,
      });
      slice.updatedAt = failedAt;
      loop.status = "waiting_source_requirements";
      loop.nextRoute = "source_requirements_pending";
      loop.blockedReason = "source_requirements_turn_failed";
      loop.updatedAt = failedAt;
      saveState();
      return {
        ok: false,
        error: "source_requirements_turn_failed",
        message: slice.sourceRequirementsTurnError,
      };
    }
  }

  async function markRequirementsLocal(loop, slice) {
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
    slice.blockedReason = "";
    slice.updatedAt = timestamp;
    loop.requirementsThreadId = loop.sourceThreadId;
    loop.requirementsLocal = true;
    if (sourceRequirementsReadyForImplementation(loop)) {
      slice.status = "returned";
      slice.returnStatus = "completed";
      loop.status = "running";
      loop.nextRoute = "implementation";
    } else {
      slice.status = "waiting";
      slice.returnStatus = "";
      slice.blockedReason = "source_requirements_pending";
      slice.routing = Object.assign({}, slice.routing || {}, {
        sourceRequirementsPending: true,
        requiredPacketSections: ["requirements_packet", "design_contract_packet"],
        localTurnRequired: true,
      });
      loop.status = "waiting_source_requirements";
      loop.nextRoute = "source_requirements_pending";
      await ensureSourceRequirementsTurn(loop, slice);
    }
    loop.currentRole = "requirements";
    loop.blockedReason = "";
    loop.updatedAt = timestamp;
    saveState();
    return {
      ok: true,
      local: true,
      waiting: !sourceRequirementsReadyForImplementation(loop),
      loop: publicLoop(loop),
      slice: publicSlice(slice),
    };
  }

  function markLocalRequirementsRevision(loop, reason = "requirements_revision") {
    const timestamp = nowIso(clock);
    const slice = findSlice(loop, { role: "requirements", iteration: loop.iteration });
    if (slice) {
      slice.status = "blocked";
      slice.dispatchStatus = SOURCE_THREAD_LOCAL_REQUIREMENTS;
      slice.dispatchMode = SOURCE_THREAD_LOCAL_REQUIREMENTS;
      slice.taskCardDispatch = false;
      slice.blockedReason = compactOneLine(reason);
      slice.targetThreadId = loop.requirementsThreadId || loop.sourceThreadId;
      slice.updatedAt = timestamp;
    }
    loop.status = "blocked";
    loop.currentRole = "requirements";
    loop.nextRoute = "requirements_revision";
    loop.blockedReason = compactOneLine(reason);
    loop.updatedAt = timestamp;
    saveState();
    return { ok: true, loop: publicLoop(loop), slice: slice ? publicSlice(slice) : undefined };
  }

  function scoreRoleTarget(loop, role, thread) {
    const id = threadIdOf(thread);
    if (!id || sameThreadId(id, loop.sourceThreadId)) return -1;
    const check = roleTargetCheck(loop, role, thread);
    if (!check.ok) return -1;
    const source = sourceThread(loop);
    const sourceCwd = normalizeCwd(roleWorkspaceCwd(loop, role, source));
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

  function excludedTargetSet(options = {}) {
    return new Set((Array.isArray(options.excludedTargetThreadIds) ? options.excludedTargetThreadIds : [])
      .map((id) => compactOneLine(id))
      .filter(Boolean));
  }

  function selectExistingRoleTarget(loop, role, options = {}) {
    const excluded = excludedTargetSet(options);
    const candidates = visibleThreads()
      .filter((thread) => !sameThreadId(threadIdOf(thread), loop.sourceThreadId))
      .filter((thread) => !excluded.has(threadIdOf(thread)))
      .map((thread) => ({ thread, score: scoreRoleTarget(loop, role, thread) }))
      .filter((entry) => entry.score >= 0)
      .sort((left, right) => right.score - left.score || threadIdOf(left.thread).localeCompare(threadIdOf(right.thread)));
    return candidates[0] && candidates[0].thread || null;
  }

  function alternateExistingRoleTarget(loop, role, targetThreadId, options = {}) {
    const excluded = new Set([
      ...Array.from(excludedTargetSet(options)),
      compactOneLine(targetThreadId),
    ].filter(Boolean));
    return selectExistingRoleTarget(loop, role, Object.assign({}, options, {
      excludedTargetThreadIds: Array.from(excluded),
    }));
  }

  function shouldPreserveUndeliverableRoleLane(loop, role, slice, target, options = {}) {
    const targetThreadId = compactOneLine(threadIdOf(target || {}) || slice && slice.targetThreadId || "");
    if (!targetThreadId) return false;
    if (!Boolean(slice && slice.roleThreadCreated)) return false;
    return !alternateExistingRoleTarget(loop, role, targetThreadId, options);
  }

  async function createRoleThread(loop, role) {
    if (typeof dependencies.createLoopRoleThread !== "function") return null;
    const source = sourceThread(loop);
    const cwd = roleWorkspaceCwd(loop, role, source);
    if (!cwd) return null;
    if (roleRequiresImplementationWorkspace(role)) {
      const workspace = implementationWorkspaceCheck(cwd, { role, loop, thread: source, create: true });
      if (!workspace.ok) {
        const err = new Error("at_loop_implementation_workspace_unresolved");
        err.code = "at_loop_implementation_workspace_unresolved";
        err.routing = {
          ok: false,
          error: "at_loop_implementation_workspace_unresolved",
          role,
          sourceThreadId: loop && loop.sourceThreadId || "",
          sourceCwd: compactOneLine(source.cwd || source.workspace || source.targetWorkspace),
          implementationWorkspaceCwd: loopImplementationWorkspaceCwd(loop),
          workspace,
        };
        throw err;
      }
    }
    const thread = await dependencies.createLoopRoleThread({
      loop: publicLoop(loop),
      role,
      sourceThread: publicThread(source),
      cwd,
      title: roleLaneTitle(source, role, loop.objectiveSummary, cwd),
      threadRole: roleThreadRole(role),
    });
    return thread || null;
  }

  function roleFromLifecycle(input = {}) {
    const raw = compactOneLine(input.role || input.threadRole || input.targetRole).toLowerCase();
    if (raw === "audit" || raw === "loop_product_audit" || raw === "product-audit") return "product_audit";
    if (raw === "implement" || raw === "loop_implementation" || raw === "implementation") return "implementation";
    if (raw === "loop_repair" || raw === "repair") return "repair";
    if (raw === "loop_requirements" || raw === "requirements") return "requirements";
    if (raw === "deploy" || raw === "deploy_readback" || raw === "deploy-readback") return "deploy_readback";
    if (raw === "home_ai_worker" || raw === "worker" || raw === "worker_lane") return "home_ai_worker";
    if (raw === "plugin_worker" || raw === "plugin-worker" || raw === "plugin_worker_lane" || raw === "plugin-worker-lane") return "plugin_worker";
    if (normalizeWorkspaceMainRole(raw)) return normalizeWorkspaceMainRole(raw);
    return raw;
  }

  function explicitNonDeliverability(thread = {}) {
    const status = compactOneLine(thread.status && (thread.status.type || thread.status.status) || thread.status).toLowerCase();
    if (thread.visible === false) return { unavailable: true, reason: "visible_false" };
    if (thread.deliverable === false) return { unavailable: true, reason: "deliverable_false" };
    if (thread.canReceiveTaskCards === false || thread.can_receive_task_cards === false) return { unavailable: true, reason: "can_receive_task_cards_false" };
    if (thread.archived === true || thread.deleted === true || thread.closed === true || thread.hidden === true) {
      return { unavailable: true, reason: "explicit_non_deliverable_flag" };
    }
    if (/^(archived|deleted|closed|hidden)$/.test(status)) return { unavailable: true, reason: `status_${status}` };
    return { unavailable: false, reason: "" };
  }

  function workerPurposeFromLifecycle(input = {}) {
    return compactOneLine(input.workerPurpose || input.worker_purpose || input.purpose || input.targetPurpose || input.target_purpose || "default").toLowerCase() || "default";
  }

  function hasWorkerPurposeFilter(input = {}) {
    return Boolean(compactOneLine(input.workerPurpose || input.worker_purpose || input.purpose || input.targetPurpose || input.target_purpose));
  }

  function pluginIdFromLifecycle(input = {}) {
    return compactOneLine(input.pluginId || input.plugin_id || input.plugin || input.targetPlugin || input.target_plugin).toLowerCase();
  }

  function isWorkerLifecycleRole(role) {
    return role === "home_ai_worker" || role === "plugin_worker";
  }

  function workerLaneKey(input = {}) {
    const role = roleFromLifecycle(input);
    const cwd = normalizeCwd(input.cwd || input.workspaceCwd || input.workspace || input.targetWorkspace);
    const pluginId = role === "plugin_worker" ? pluginIdFromLifecycle(input) : "";
    const purpose = workerPurposeFromLifecycle(input);
    return [role || "home_ai_worker", cwd, pluginId, purpose].join("|");
  }

  function workerLaneIdFor(input = {}) {
    return `worker_${stableHash(workerLaneKey(input), 16)}`;
  }

  function workerLanesState() {
    const state = loadState();
    if (!Array.isArray(state.workerLanes)) state.workerLanes = [];
    return state.workerLanes;
  }

  function workerLaneTerminalState(record = {}) {
    const status = compactOneLine(record.lifecycleStatus || record.status).toLowerCase();
    if (record.retired === true || status === "retired") return { unavailable: true, reason: "lifecycle_retired" };
    if (record.disabled === true || status === "disabled") return { unavailable: true, reason: "lifecycle_disabled" };
    if (record.archived === true || status === "archived") return { unavailable: true, reason: "lifecycle_archived" };
    return { unavailable: false, reason: "" };
  }

  function workerLaneRecordForThread(threadOrId = {}) {
    const threadId = compactOneLine(typeof threadOrId === "string"
      ? threadOrId
      : threadOrId && (threadOrId.id || threadOrId.threadId));
    if (!threadId) return null;
    return workerLanesState().find((lane) => sameThreadId(lane.threadId, threadId)) || null;
  }

  function exactWorkerLifecycleTarget(input = {}) {
    const workerLaneId = compactOneLine(input.workerLaneId || input.worker_lane_id);
    const threadId = compactOneLine(input.targetThreadId || input.target_thread_id || input.threadId || input.thread_id);
    return { workerLaneId, threadId, exact: Boolean(workerLaneId || threadId) };
  }

  function workerLaneRecordMatchesInput(record = {}, input = {}) {
    const role = roleFromLifecycle(input);
    if (!isWorkerLifecycleRole(role)) return false;
    if (compactOneLine(record.role) !== role) return false;
    const requestedCwd = normalizeCwd(input.cwd || input.workspaceCwd || input.workspace || input.targetWorkspace);
    const requestedPurpose = workerPurposeFromLifecycle(input);
    const purposeFiltered = hasWorkerPurposeFilter(input);
    const requestedPluginId = pluginIdFromLifecycle(input);
    if (requestedCwd && normalizeCwd(record.cwd) !== requestedCwd) return false;
    if (role === "plugin_worker" && requestedPluginId && pluginIdFromLifecycle(record) !== requestedPluginId) return false;
    if (purposeFiltered && workerPurposeFromLifecycle(record) !== requestedPurpose) return false;
    return true;
  }

  function compactWorkerRequestId(input = {}) {
    return compactOneLine(input.idempotencyKey || input.idempotency_key || input.requestId || input.request_id);
  }

  function workerRecordHasRequestId(record = {}, requestId = "") {
    const id = compactOneLine(requestId);
    return Boolean(id && Array.isArray(record.requestIds) && record.requestIds.includes(id));
  }

  function rememberWorkerRequestId(record = {}, requestId = "") {
    const id = compactOneLine(requestId);
    if (!id) return;
    if (!Array.isArray(record.requestIds)) record.requestIds = [];
    if (!record.requestIds.includes(id)) record.requestIds.push(id);
    if (record.requestIds.length > 12) record.requestIds = record.requestIds.slice(-12);
  }

  function publicWorkerLane(record = {}, thread = null, input = {}) {
    const resolvedThread = thread || readThreadSummary(record.threadId) || {};
    const lifecycle = workerLaneTerminalState(record);
    const threadShape = resolvedThread && typeof resolvedThread === "object" ? resolvedThread : {};
    const detail = lifecycleThread(Object.assign({}, threadShape, {
      id: record.threadId || threadShape.id || threadShape.threadId,
      title: threadShape.title || threadShape.name || threadShape.preview || record.title,
      cwd: threadShape.cwd || record.cwd,
      threadRole: threadShape.threadRole || threadShape.thread_role || threadShape.role || record.role || "home_ai_worker",
      status: threadShape.status || record.threadStatus || record.lifecycleStatus || record.status,
    }), Object.assign({}, input, { role: record.role || input.role || "home_ai_worker" }));
    const deliverable = detail.deliverable && !lifecycle.unavailable;
    return Object.assign({}, detail, {
      workerLaneId: compactOneLine(record.workerLaneId),
      workerPurpose: workerPurposeFromLifecycle(record),
      lifecycleStatus: compactOneLine(record.lifecycleStatus || record.status || (deliverable ? "available" : "retired")),
      deliverable,
      deliverabilityReason: deliverable ? "eligible" : lifecycle.reason || detail.deliverabilityReason || "not_deliverable",
      pluginId: pluginIdFromLifecycle(record),
      retired: record.retired === true,
      disabled: record.disabled === true,
      archived: record.archived === true,
      sourceThreadId: compactOneLine(record.sourceThreadId),
      heartbeat: record.heartbeat && typeof record.heartbeat === "object" ? Object.assign({}, record.heartbeat) : null,
      lastTaskCardId: compactOneLine(record.lastTaskCardId),
      updatedAt: compactOneLine(record.updatedAt),
    });
  }

  function lifecyclePurposeAllowed(role, classification) {
    const purpose = classification && classification.purpose || "";
    if (isWorkerLifecycleRole(role)) return purpose === "worker_lane";
    if (!role) return true;
    if (role === "implementation" || role === "repair") return ["codex_mobile_implementation", "workspace_implementation", "unknown"].includes(purpose);
    if (role === "requirements") return ["codex_mobile_implementation", "workspace_implementation", "unknown"].includes(purpose);
    if (role === "product_audit") return purpose === "audit_lane";
    if (role === "deploy_readback") return purpose === "deploy_lane";
    return true;
  }

  function lifecycleThread(thread = {}, input = {}) {
    const role = roleFromLifecycle(input);
    const classification = routingService.assertLoopRoleTarget({
      role: isWorkerLifecycleRole(role) ? "implementation" : role,
      thread,
    }).classification || routingService.classifyThreadPurpose(thread);
    const nonDeliverable = explicitNonDeliverability(thread);
    const workerRecord = isWorkerLifecycleRole(role) ? workerLaneRecordForThread(thread) : null;
    const workerLifecycle = workerRecord ? workerLaneTerminalState(workerRecord) : { unavailable: false, reason: "" };
    const cwd = compactOneLine(thread.cwd || thread.workspace || thread.targetWorkspace);
    const requestedCwd = compactOneLine(input.cwd || input.workspaceCwd || input.workspace || input.targetWorkspace);
    const cwdMatches = !requestedCwd || normalizeCwd(cwd) === normalizeCwd(requestedCwd);
    const requestedPluginId = pluginIdFromLifecycle(input);
    const workerRoleMatches = !isWorkerLifecycleRole(role)
      ? true
      : workerRecord
        ? compactOneLine(workerRecord.role) === role
        : compactOneLine(thread.threadRole || thread.thread_role || thread.role || thread.taskCardRole || thread.task_card_role).toLowerCase() === role
          || (role === "home_ai_worker" && classification.purpose === "worker_lane" && !requestedPluginId);
    const pluginMatches = role !== "plugin_worker" || !requestedPluginId
      || pluginIdFromLifecycle(workerRecord || thread) === requestedPluginId;
    const sourceThreadId = compactOneLine(input.sourceThreadId || input.source_thread_id);
    const selfTarget = sourceThreadId && sameThreadId(sourceThreadId, threadIdOf(thread));
    const roleSignal = isWorkerLifecycleRole(role)
      ? classification.purpose === "worker_lane" && workerRoleMatches && pluginMatches
      : !role || role === "requirements" || role === "product_audit" || role === "deploy_readback" || threadHasRoleLaneSignal(role, thread);
    const deliverable = !nonDeliverable.unavailable && !workerLifecycle.unavailable && !selfTarget && cwdMatches && lifecyclePurposeAllowed(role, classification) && roleSignal;
    let deliverabilityReason = "eligible";
    if (!deliverable) {
      deliverabilityReason = nonDeliverable.reason
        || workerLifecycle.reason
        || (selfTarget ? "source_thread_self" : "")
        || (!cwdMatches ? "workspace_mismatch" : "")
        || (!roleSignal ? (isWorkerLifecycleRole(role) && !workerRoleMatches ? "role_mismatch" : "role_signal_missing") : "")
        || "purpose_mismatch";
    }
    return {
      id: threadIdOf(thread),
      title: boundedText(thread.title || thread.name || thread.preview, 120),
      cwd: boundedText(cwd, 300),
      role,
      threadRole: boundedText(thread.threadRole || thread.thread_role || thread.role, 80),
      purpose: classification.purpose || "",
      purposeReason: classification.reason || "",
      status: compactOneLine(thread.status && (thread.status.type || thread.status.status) || thread.status),
      deliverable,
      deliverabilityReason,
    };
  }

  function lifecycleList(input = {}) {
    const role = roleFromLifecycle(input);
    if (isWorkspaceMainRole(role)) {
      const threads = workspaceMainRouting.list(Object.assign({}, input, { role }));
      return { ok: true, action: "list", count: threads.length, threads };
    }
    if (isWorkerLifecycleRole(role)) return workerLifecycleList(Object.assign({}, input, { role }));
    const rows = visibleThreads()
      .map((thread) => lifecycleThread(thread, input))
      .filter((thread) => thread.id && (input.includeIneligible === true || thread.deliverable))
      .slice(0, Math.max(1, Math.min(80, Number(input.limit || 40) || 40)));
    return { ok: true, action: "list", count: rows.length, threads: rows };
  }

  function lifecycleResolve(input = {}) {
    const role = roleFromLifecycle(input);
    if (isWorkspaceMainRole(role)) return workspaceMainRouting.resolve(Object.assign({}, input, { role }));
    if (isWorkerLifecycleRole(role)) return workerLifecycleResolve(Object.assign({}, input, { role }));
    const threadId = compactOneLine(input.threadId || input.targetThreadId);
    const rows = lifecycleList(Object.assign({}, input, { includeIneligible: true })).threads;
    const resolved = threadId
      ? rows.find((thread) => sameThreadId(thread.id, threadId))
      : rows.find((thread) => thread.deliverable);
    if (!resolved) return { ok: false, action: "resolve", error: "thread_lifecycle_target_not_found", threads: rows.slice(0, 8) };
    return { ok: resolved.deliverable, action: "resolve", thread: resolved, error: resolved.deliverable ? "" : "thread_lifecycle_target_not_deliverable" };
  }

  function workerThreadFromRecord(record = {}) {
    return readThreadSummary(record.threadId) || {
      id: record.threadId,
      threadId: record.threadId,
      title: record.title,
      name: record.title,
      preview: record.title,
      cwd: record.cwd,
      threadRole: record.role,
      pluginId: record.pluginId,
      workerPurpose: record.workerPurpose,
      status: { type: record.lifecycleStatus || "available" },
    };
  }

  function workerLifecycleList(input = {}) {
    const byId = new Map();
    for (const record of workerLanesState()) {
      if (!workerLaneRecordMatchesInput(record, input)) continue;
      const row = publicWorkerLane(record, workerThreadFromRecord(record), input);
      if (row.id && (input.includeIneligible === true || row.deliverable)) byId.set(row.id, row);
    }
    for (const thread of visibleThreads()) {
      const row = lifecycleThread(thread, input);
      if (!row.id) continue;
      if (byId.has(row.id)) continue;
      if (row.purpose !== "worker_lane") continue;
      if (input.includeIneligible === true || row.deliverable) byId.set(row.id, row);
    }
    const rows = [...byId.values()]
      .sort((left, right) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")) || left.id.localeCompare(right.id))
      .slice(0, Math.max(1, Math.min(80, Number(input.limit || 40) || 40)));
    return { ok: true, action: "list", count: rows.length, threads: rows };
  }

  function workerLifecycleResolve(input = {}) {
    const threadId = compactOneLine(input.threadId || input.targetThreadId);
    const rows = workerLifecycleList(Object.assign({}, input, { includeIneligible: true })).threads;
    const resolved = threadId
      ? rows.find((thread) => sameThreadId(thread.id, threadId))
      : rows.find((thread) => thread.deliverable);
    if (!resolved) return { ok: false, action: "resolve", error: "thread_lifecycle_target_not_found", threads: rows.slice(0, 8) };
    return { ok: resolved.deliverable, action: "resolve", thread: resolved, error: resolved.deliverable ? "" : "thread_lifecycle_target_not_deliverable" };
  }

  function findWorkerLaneRecord(input = {}, options = {}) {
    const exactTarget = exactWorkerLifecycleTarget(input);
    const workerLaneId = exactTarget.workerLaneId;
    const threadId = exactTarget.threadId;
    const requestId = compactWorkerRequestId(input);
    const lanes = workerLanesState();
    if (workerLaneId) {
      const found = lanes.find((lane) => compactOneLine(lane.workerLaneId) === workerLaneId);
      if (found) return found;
      return null;
    }
    if (threadId) {
      const found = lanes.find((lane) => sameThreadId(lane.threadId, threadId));
      if (found) return found;
      return null;
    }
    if (options.exactOnly === true) return null;
    if (requestId) {
      const found = lanes.find((lane) => workerRecordHasRequestId(lane, requestId));
      if (found) return found;
    }
    return lanes.find((lane) => workerLaneRecordMatchesInput(lane, input)) || null;
  }

  function workerLifecycleTargetNotManageable(input = {}, action = "status") {
    const exactTarget = exactWorkerLifecycleTarget(input);
    return {
      ok: false,
      action,
      error: "worker_lifecycle_target_not_manageable",
      targetThreadId: exactTarget.threadId || "",
      workerLaneId: exactTarget.workerLaneId || "",
    };
  }

  function adoptVisibleWorkerLaneRecord(input = {}) {
    const role = roleFromLifecycle(input);
    const exactTarget = exactWorkerLifecycleTarget(input);
    if (!isWorkerLifecycleRole(role) || !exactTarget.threadId) return null;
    const thread = readThreadSummary(exactTarget.threadId);
    if (!thread) return null;
    const row = lifecycleThread(thread, input);
    if (row.id !== exactTarget.threadId || row.purpose !== "worker_lane") return null;
    if (row.deliverabilityReason === "role_mismatch" || row.deliverabilityReason === "role_signal_missing") return null;
    const timestamp = nowIso(clock);
    const record = {
      workerLaneId: `worker_${stableHash(`${role}|legacy|${exactTarget.threadId}`, 16)}`,
      threadId: exactTarget.threadId,
      title: boundedText(thread.title || thread.name || thread.preview || row.title, 120),
      role,
      cwd: compactOneLine(thread.cwd || thread.workspace || thread.targetWorkspace || input.cwd || input.workspaceCwd),
      pluginId: pluginIdFromLifecycle(thread) || pluginIdFromLifecycle(input),
      workerPurpose: workerPurposeFromLifecycle(input),
      sourceThreadId: compactOneLine(input.sourceThreadId || input.source_thread_id),
      lifecycleStatus: "available",
      legacy: true,
      requestIds: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    workerLanesState().unshift(record);
    return record;
  }

  function findOrAdoptWorkerLaneRecord(input = {}, action = "status") {
    const record = findWorkerLaneRecord(input, { exactOnly: true });
    if (record) return { record };
    const exactTarget = exactWorkerLifecycleTarget(input);
    if (!exactTarget.exact) return { record: findWorkerLaneRecord(input) };
    const adopted = adoptVisibleWorkerLaneRecord(input);
    if (adopted) return { record: adopted };
    return { error: workerLifecycleTargetNotManageable(input, action) };
  }

  async function ensureWorkerLane(input = {}) {
    const role = roleFromLifecycle(input);
    const action = compactOneLine(input.action || "ensure").toLowerCase();
    if (!isWorkerLifecycleRole(role)) return { ok: false, action, error: "thread_lifecycle_worker_role_required" };
    const cwd = compactOneLine(input.cwd || input.workspaceCwd || input.workspace || input.targetWorkspace);
    if (!cwd) return { ok: false, action, error: "thread_lifecycle_worker_workspace_required" };
    const pluginId = pluginIdFromLifecycle(input);
    if (role === "plugin_worker" && !pluginId) return { ok: false, action, error: "thread_lifecycle_plugin_id_required" };
    const sourceThreadId = compactOneLine(input.sourceThreadId || input.source_thread_id || input.threadId);
    if (!sourceThreadId) return { ok: false, action, error: "thread_lifecycle_source_thread_required" };
    const requestId = compactWorkerRequestId(input);
    const existing = findWorkerLaneRecord(input);
    if (existing && (workerRecordHasRequestId(existing, requestId) || !workerLaneTerminalState(existing).unavailable)) {
      rememberWorkerRequestId(existing, requestId);
      existing.updatedAt = nowIso(clock);
      saveState();
      const row = publicWorkerLane(existing, workerThreadFromRecord(existing), input);
      return { ok: row.deliverable, action, created: false, thread: row, error: row.deliverable ? "" : "thread_lifecycle_target_not_deliverable" };
    }
    if (typeof dependencies.createLoopRoleThread !== "function") {
      return { ok: false, action, error: "thread_lifecycle_worker_create_unavailable" };
    }
    const sourceThread = readThreadSummary(sourceThreadId) || {
      id: sourceThreadId,
      threadId: sourceThreadId,
      title: input.sourceThreadTitle || input.sourceTitle || sourceThreadId,
      cwd,
    };
    const purpose = workerPurposeFromLifecycle(input);
    const thread = await dependencies.createLoopRoleThread({
      role,
      sourceThread: publicThread(sourceThread),
      cwd,
      title: workerLaneTitle(sourceThread, purpose, cwd),
      threadRole: role,
      pluginId,
      workerPurpose: purpose,
    });
    const threadId = threadIdOf(thread);
    if (!threadId) return { ok: false, action, error: "thread_lifecycle_worker_create_missing_thread_id" };
    if (sameThreadId(threadId, sourceThreadId)) return { ok: false, action, error: "thread_lifecycle_target_self_disallowed" };
    const timestamp = nowIso(clock);
    const record = {
      workerLaneId: `worker_${stableHash(`${workerLaneKey(Object.assign({}, input, { role, cwd, pluginId, purpose }))}|${threadId}`, 16)}`,
      threadId,
      title: boundedText(thread.title || thread.name || thread.preview || workerLaneTitle(sourceThread, purpose, cwd), 120),
      role,
      cwd,
      pluginId,
      workerPurpose: purpose,
      sourceThreadId,
      lifecycleStatus: "available",
      requestIds: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    rememberWorkerRequestId(record, requestId);
    workerLanesState().unshift(record);
    saveState();
    const row = publicWorkerLane(record, thread, input);
    return { ok: row.deliverable, action, created: true, thread: row, error: row.deliverable ? "" : "thread_lifecycle_target_not_deliverable" };
  }

  function updateWorkerLaneLifecycle(input = {}, nextStatus = "") {
    const action = compactOneLine(input.action || nextStatus || "status").toLowerCase();
    const lookup = findOrAdoptWorkerLaneRecord(input, action);
    if (lookup.error) return lookup.error;
    const record = lookup.record;
    if (!record) return { ok: false, action, error: "thread_lifecycle_target_not_found" };
    const timestamp = nowIso(clock);
    if (nextStatus === "retired") record.retired = true;
    if (nextStatus === "disabled") record.disabled = true;
    if (nextStatus === "archived") record.archived = true;
    if (nextStatus === "available" || nextStatus === "idle" || nextStatus === "completed") {
      record.retired = false;
      record.disabled = false;
      record.archived = false;
    }
    if (nextStatus) record.lifecycleStatus = nextStatus;
    record.updatedAt = timestamp;
    saveState();
    const row = publicWorkerLane(record, workerThreadFromRecord(record), Object.assign({}, input, { role: record.role }));
    return { ok: row.deliverable || ["retired", "disabled", "archived"].includes(nextStatus), action, thread: row };
  }

  function updateWorkerLaneHeartbeat(input = {}) {
    const action = "heartbeat";
    const lookup = findOrAdoptWorkerLaneRecord(input, action);
    if (lookup.error) return lookup.error;
    const record = lookup.record;
    if (!record) return { ok: false, action, error: "thread_lifecycle_target_not_found" };
    const timestamp = nowIso(clock);
    record.heartbeat = {
      status: boundedText(input.status || input.heartbeatStatus || "working", 80),
      taskCardId: boundedText(input.taskCardId || input.cardId || "", 120),
      summary: boundedText(input.summary || input.message || "", 240),
      updatedAt: timestamp,
    };
    if (record.heartbeat.taskCardId) record.lastTaskCardId = record.heartbeat.taskCardId;
    record.updatedAt = timestamp;
    saveState();
    return { ok: true, action, thread: publicWorkerLane(record, workerThreadFromRecord(record), Object.assign({}, input, { role: record.role })) };
  }

  function workerLifecycleDeliverability(thread = {}) {
    const record = workerLaneRecordForThread(thread);
    if (!record) return { ok: true };
    const lifecycle = workerLaneTerminalState(record);
    if (!lifecycle.unavailable) return { ok: true, workerLaneId: record.workerLaneId, role: record.role };
    return {
      ok: false,
      error: `thread_lifecycle_worker_lane_${lifecycle.reason.replace(/^lifecycle_/, "")}`,
      message: "Target Worker lane is retired, disabled, or archived by lifecycle metadata.",
      workerLaneId: record.workerLaneId,
      role: record.role,
      lifecycleStatus: record.lifecycleStatus || "",
    };
  }

  async function threadLifecycle(input = {}) {
    const action = compactOneLine(input.action || "list").toLowerCase();
    const role = roleFromLifecycle(input);
    const workerLifecycleActions = new Set(["status", "heartbeat", "retire", "disable", "archive", "mark_available", "available", "mark_idle", "idle", "mark_completed", "mark_complete"]);
    if (action === "list") return lifecycleList(Object.assign({}, input, { role }));
    if (action === "resolve") return lifecycleResolve(Object.assign({}, input, { role }));
    if ((action === "status") && isWorkspaceMainRole(role)) return lifecycleResolve(Object.assign({}, input, { role }));
    if (action === "ensure" || action === "create") {
      if (isWorkspaceMainRole(role)) return { ok: false, action, error: "thread_lifecycle_main_create_unsupported" };
      if (isWorkerLifecycleRole(role)) return ensureWorkerLane(Object.assign({}, input, { role, action }));
      if (!role || role === "home_ai_worker") return { ok: false, action, error: "thread_lifecycle_loop_role_required" };
      const loopId = compactOneLine(input.loopId);
      const loop = loopId ? findLoop(loopId) : null;
      if (!loop) return { ok: false, action, error: "thread_lifecycle_loop_not_found" };
      const ensured = await ensureRoleLane(loop, role, {
        excludedTargetThreadIds: Array.isArray(input.excludedTargetThreadIds) ? input.excludedTargetThreadIds : [],
      });
      return Object.assign({ action }, ensured.ok
        ? { ok: true, thread: lifecycleThread(ensured.target, { role }), slice: publicSlice(ensured.slice), loop: publicLoop(loop) }
        : ensured);
    }
    if (action === "status" && isWorkerLifecycleRole(role)) return workerLifecycleResolve(Object.assign({}, input, { role, action }));
    if (action === "heartbeat" && isWorkerLifecycleRole(role)) return updateWorkerLaneHeartbeat(Object.assign({}, input, { role }));
    if (action === "retire" && isWorkerLifecycleRole(role)) return updateWorkerLaneLifecycle(Object.assign({}, input, { role }), "retired");
    if (action === "disable" && isWorkerLifecycleRole(role)) return updateWorkerLaneLifecycle(Object.assign({}, input, { role }), "disabled");
    if (action === "archive" && isWorkerLifecycleRole(role)) return updateWorkerLaneLifecycle(Object.assign({}, input, { role }), "archived");
    if ((action === "mark_available" || action === "available") && isWorkerLifecycleRole(role)) {
      return updateWorkerLaneLifecycle(Object.assign({}, input, { role }), "available");
    }
    if ((action === "mark_idle" || action === "idle") && isWorkerLifecycleRole(role)) {
      return updateWorkerLaneLifecycle(Object.assign({}, input, { role }), "idle");
    }
    if ((action === "mark_completed" || action === "mark_complete") && isWorkerLifecycleRole(role)) {
      return updateWorkerLaneLifecycle(Object.assign({}, input, { role }), "completed");
    }
    if ((action === "achieve" || action === "mark_role_complete") && isWorkerLifecycleRole(role)) {
      return updateWorkerLaneLifecycle(Object.assign({}, input, { role }), "completed");
    }
    if (workerLifecycleActions.has(action)) {
      return { ok: false, action, error: "thread_lifecycle_worker_role_required" };
    }
    if (action === "achieve" || action === "mark_role_complete") {
      const loopId = compactOneLine(input.loopId);
      const loop = loopId ? findLoop(loopId) : null;
      if (!loop) return { ok: false, action, error: "thread_lifecycle_loop_not_found" };
      const slice = findSlice(loop, { role, iteration: Number(input.iteration || loop.iteration) || loop.iteration });
      if (!slice) return { ok: false, action, error: "thread_lifecycle_role_slice_not_found", loop: publicLoop(loop) };
      const timestamp = nowIso(clock);
      slice.status = "achieved";
      slice.dispatchStatus = "role_complete";
      slice.updatedAt = timestamp;
      loop.updatedAt = timestamp;
      saveState();
      return { ok: true, action, loop: publicLoop(loop), slice: publicSlice(slice) };
    }
    if (action === "refresh") {
      const state = loadState();
      let refreshed = 0;
      for (const loop of state.loops) {
        for (const slice of Array.isArray(loop.roleSlices) ? loop.roleSlices : []) {
          if (!slice.targetThreadId) continue;
          const resolved = lifecycleResolve({ threadId: slice.targetThreadId, role: slice.role });
          slice.routing = Object.assign({}, slice.routing || {}, {
            lifecycleRefresh: resolved.ok ? "deliverable" : resolved.error || "not_deliverable",
          });
          refreshed += 1;
        }
      }
      if (refreshed) saveState();
      return { ok: true, action, refreshed };
    }
    return { ok: false, action, error: "thread_lifecycle_action_unsupported" };
  }

  async function ensureRoleLane(loop, role, options = {}) {
    const slice = findSlice(loop, { role, iteration: loop.iteration });
    if (!slice) return { ok: false, error: "at_loop_role_slice_not_found" };
    const field = roleThreadField(role);
    const existingId = compactOneLine(slice.targetThreadId || loop[field] || (role === "implementation" || role === "repair" ? loop.targetThreadId : ""));
    if (existingId && !sameThreadId(existingId, loop.sourceThreadId)) {
      const excluded = excludedTargetSet(options);
      if (excluded.has(existingId)) {
        clearRoleLaneTarget(loop, slice, "dispatch_target_not_deliverable");
      } else {
        const target = readVisibleThreadSummary(existingId);
        if (!target) {
          const timestamp = nowIso(clock);
          slice.targetThreadId = "";
          slice.targetPurpose = "";
          slice.taskCardId = "";
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
            if (check.error === "at_loop_target_not_deliverable"
              && shouldPreserveUndeliverableRoleLane(loop, role, slice, target, options)) {
              return setLoopBlocked(loop, slice, "at_loop_role_lane_not_deliverable", {
                dispatchStatus: "failed",
                message: check.deliverability && check.deliverability.message || "created role lane is not currently deliverable",
                routing: Object.assign({}, publicRoleTargetRoutingMetadata(check), {
                  preservedTargetThreadId: existingId,
                  preservedTargetReason: "created_role_lane_not_deliverable",
                }),
                nextRoute: role,
              });
            }
            const timestamp = nowIso(clock);
            slice.targetThreadId = "";
            slice.targetPurpose = "";
            slice.taskCardId = "";
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
    }

    let target = selectExistingRoleTarget(loop, role, options);
    let created = false;
    if (!target) {
      try {
        target = await createRoleThread(loop, role);
        created = Boolean(target);
      } catch (err) {
        const code = compactOneLine(err && err.code) || "at_loop_role_lane_create_failed";
        return setLoopBlocked(loop, slice, code, {
          dispatchStatus: "failed",
          message: err && err.message || err || code,
          routing: err && err.routing || null,
          nextRoute: code === "at_loop_implementation_workspace_unresolved"
            ? "implementation_workspace_unresolved"
            : undefined,
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

  async function dispatchRole(loop, role, options = {}) {
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
      const local = await markRequirementsLocal(loop, slice);
      if (!local.ok) return local;
      if (local.waiting) return local;
      const lanes = await ensureCoreRoleLanes(loop);
      if (!lanes.ok) return lanes;
      return dispatchRole(loop, "implementation", options);
    }
    if (role !== "requirements") {
      const lane = await ensureRoleLane(loop, role, options);
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
    const targetCheck = roleTargetCheck(loop, role, target);
    slice.targetPurpose = targetCheck.classification && targetCheck.classification.purpose || "";
    if (!targetCheck.ok) {
      slice.status = "blocked";
      slice.dispatchStatus = "blocked";
      slice.blockedReason = targetCheck.error;
      slice.routing = publicRoleTargetRoutingMetadata(targetCheck);
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

    const idempotencyKey = `at-loop:${loop.loopId}:${role}:${slice.iteration}:${stableHash(targetThreadId, 8)}:v1`;
    slice.sourceRequestId = idempotencyKey;
    slice.workflowId = `at-loop:${loop.loopId}`;
    if (role === "product_audit") {
      slice.auditPacketStatus = auditPacketStatus(loop.auditPacket || sanitizeAuditPacket({}));
    }
    const bodyMarkdown = roleCardBody(loop, slice);
    const payload = {
      sourceThreadId: loop.sourceThreadId,
      targetThreadId,
      title: boundedText(`@loop ${roleTitle(role)} ${loop.loopId}`, 120),
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
      slice.blockedReason = "";
      if (role === "product_audit") {
        slice.auditPacketStatus = auditPacketStatus(loop.auditPacket || sanitizeAuditPacket({}));
      }
      slice.targetPurpose = targetCheck.classification.purpose;
      slice.routing = publicRoleTargetRoutingMetadata(targetCheck);
      slice.dispatchedAt = timestamp;
      slice.updatedAt = timestamp;
      loop.status = "running";
      loop.currentRole = role;
      loop.nextRoute = role;
      loop.updatedAt = timestamp;
      saveState();
      return { ok: true, loop: publicLoop(loop), slice: publicSlice(slice), cardCount: cards.length };
    } catch (err) {
      const dispatchTargetClearCount = Math.max(0, Number(options.dispatchTargetClearCount || (options.retriedAfterTargetClear ? 1 : 0)) || 0);
      if (isTargetUndeliverableDispatchError(err)
        && shouldPreserveUndeliverableRoleLane(loop, role, slice, target, options)) {
        const preservedTargetThreadId = compactOneLine(slice.targetThreadId || targetThreadId);
        slice.status = "blocked";
        slice.dispatchStatus = "failed";
        slice.blockedReason = compactOneLine(err && err.message || err || "at_loop_dispatch_failed");
        slice.routing = Object.assign({}, slice.routing || {}, {
          preservedTargetThreadId,
          preservedTargetReason: "created_role_lane_dispatch_not_deliverable",
        });
        slice.updatedAt = timestamp;
        loop.status = "blocked";
        loop.currentRole = role;
        loop.nextRoute = role;
        loop.blockedReason = "at_loop_dispatch_failed";
        loop.updatedAt = timestamp;
        saveState();
        return { ok: false, error: "at_loop_dispatch_failed", message: slice.blockedReason, loop: publicLoop(loop), slice: publicSlice(slice) };
      }
      if (dispatchTargetClearCount < 6 && isTargetUndeliverableDispatchError(err)) {
        const failedTargetThreadId = compactOneLine(slice.targetThreadId || targetThreadId);
        clearRoleLaneTarget(loop, slice, "dispatch_target_not_deliverable");
        const excludedTargetThreadIds = Array.from(new Set([...(options.excludedTargetThreadIds || []), failedTargetThreadId].filter(Boolean)));
        return dispatchRole(loop, role, Object.assign({}, options, {
          retriedAfterTargetClear: true,
          dispatchTargetClearCount: dispatchTargetClearCount + 1,
          excludedTargetThreadIds,
        }));
      }
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
    const implementationWorkspaceCwd = await resolvedImplementationWorkspaceCwd(input, sourceTarget);
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
      if (implementationWorkspaceCwd) existing.implementationWorkspaceCwd = implementationWorkspaceCwd;
      existing.updatedAt = nowIso(clock);
      if (existing.status === "blocked") {
        rebuildAuditPacketFromReturnedRoleCards(existing);
        const packetStatus = auditPacketStatus(existing.auditPacket || sanitizeAuditPacket({}));
        if (existing.nextRoute === "max_iterations_reached" && packetStatus.complete) {
          const recoveredRole = prepareProductAuditPacketRetry(existing, "max_iterations_reached_packet_rebuilt");
          const recovered = await dispatchRole(existing, recoveredRole.role);
          return Object.assign({
            ok: recovered.ok !== false,
            duplicateSuppressed: false,
            recovered: recovered.ok !== false,
          }, recovered, { loop: publicLoop(existing) });
        }
        const blockedRole = existing.currentRole || existing.nextRoute || "requirements";
        const blockedReturnedRole = blockedReturnedRoleForRedispatch(existing);
        if (blockedReturnedRole) {
          const recoveredRole = resetReturnedRoleForRedispatch(
            existing,
            blockedReturnedRole,
            "returned_role_workspace_mismatch",
          );
          const recovered = await dispatchRole(existing, recoveredRole.role, {
            excludedTargetThreadIds: recoveredRole.excludedTargetThreadIds,
          });
          return Object.assign({
            ok: recovered.ok !== false,
            duplicateSuppressed: false,
            recovered: recovered.ok !== false,
          }, recovered, { loop: publicLoop(existing) });
        }
        const auditBlockedRepair = productAuditBlockedReturnForRepair(existing);
        if (auditBlockedRepair) {
          const recoveredRole = prepareRepairForAuditBlockedReturn(existing, auditBlockedRepair);
          const recovered = await dispatchRole(existing, recoveredRole.role);
          return Object.assign({
            ok: recovered.ok !== false,
            duplicateSuppressed: false,
            recovered: recovered.ok !== false,
          }, recovered, { loop: publicLoop(existing) });
        }
        const blockedDispatchRole = blockedDispatchRoleForRedispatch(existing);
        if (blockedDispatchRole) {
          const recoveredRole = resetBlockedRoleForRedispatch(
            existing,
            blockedDispatchRole,
            "blocked_dispatch_target_not_deliverable",
          );
          const recovered = await dispatchRole(existing, recoveredRole.role, {
            excludedTargetThreadIds: recoveredRole.excludedTargetThreadIds,
          });
          return Object.assign({
            ok: recovered.ok !== false,
            duplicateSuppressed: false,
            recovered: recovered.ok !== false,
          }, recovered, { loop: publicLoop(existing) });
        }
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
      if (existing.status === "waiting_source_requirements" && existing.requirementsLocal === true && !sourceRequirementsReadyForImplementation(existing)) {
        const waiting = await dispatchRole(existing, "requirements");
        return Object.assign({
          ok: waiting.ok !== false,
          duplicateSuppressed: true,
        }, waiting, { loop: publicLoop(existing) });
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
      implementationWorkspaceCwd,
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

  async function startSourceRequirementsForLoop(input = {}) {
    const loopId = compactOneLine(input.loopId);
    if (!loopId) return { ok: false, error: "loop_id_required" };
    const loop = findLoop(loopId);
    if (!loop) return { ok: false, error: "at_loop_not_found" };
    if (loop.requirementsLocal !== true) {
      return { ok: false, error: "source_requirements_not_local", loop: publicLoop(loop) };
    }
    if (sourceRequirementsReadyForImplementation(loop)) {
      return { ok: true, skipped: true, reason: "source_requirements_ready", loop: publicLoop(loop) };
    }
    const result = await dispatchRole(loop, "requirements");
    return Object.assign({
      ok: result.ok !== false,
      sourceRequirementsTurnStarted: Boolean(result.loop && result.loop.sourceRequirementsStatus && result.loop.sourceRequirementsStatus.localTurnStatus === "started"),
    }, result, { loop: publicLoop(loop) });
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
    const returnInput = terminalReturnInputWithStoredBody(slice, input);
    const timestamp = nowIso(clock);
    const returnStatus = normalizeStatus(returnInput.status);
    const auditVerdictResult = normalizedAuditVerdict(loop, slice, returnInput, returnStatus);
    const auditVerdict = auditVerdictResult.verdict;
    slice.status = "returned";
    slice.returnStatus = returnStatus;
    slice.returnCardId = boundedText(returnInput.returnCardId || returnInput.replyCardId, 120);
    slice.returnSummary = boundedText(redactSensitiveText(returnInput.summary || ""), 220);
    slice.auditVerdict = auditVerdict;
    if (slice.role === "product_audit" && auditVerdictResult.source) {
      slice.routing = Object.assign({}, slice.routing || {}, {
        auditVerdictNormalization: auditVerdictResult.source,
      });
    }
    slice.updatedAt = timestamp;
    loop.auditPacket = mergeAuditPacket(loop.auditPacket || sanitizeAuditPacket({}), roleReturnAuditPacketUpdate(loop, slice, returnInput, returnStatus));
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
    if (route.role === "requirements" && loop.requirementsLocal) {
      const reason = route.nextRoute === "requirements_revision"
        ? `${slice.role}_${returnStatus}_requires_requirements_revision`
        : route.nextRoute || "requirements_revision";
      return markLocalRequirementsRevision(loop, reason);
    }
    if (slice.role === "requirements" && loop.requirementsLocal && route.role === "implementation") {
      if (!sourceRequirementsReadyForImplementation(loop)) {
        slice.status = "blocked";
        slice.dispatchStatus = SOURCE_THREAD_LOCAL_REQUIREMENTS;
        slice.dispatchMode = SOURCE_THREAD_LOCAL_REQUIREMENTS;
        slice.taskCardDispatch = false;
        slice.blockedReason = "source_requirements_packet_incomplete";
        slice.routing = Object.assign({}, slice.routing || {}, {
          sourceRequirementsPending: true,
          requiredPacketSections: ["requirements_packet", "design_contract_packet"],
          missingPacketSections: ["requirements_packet", "design_contract_packet"]
            .filter((id) => !auditPacketHasPresentSection(loop.auditPacket || sanitizeAuditPacket({}), id)),
        });
        loop.status = "blocked";
        loop.currentRole = "requirements";
        loop.nextRoute = "source_requirements_pending";
        loop.blockedReason = "source_requirements_packet_incomplete";
        loop.updatedAt = timestamp;
        saveState();
        return { ok: false, error: "source_requirements_packet_incomplete", loop: publicLoop(loop), slice: publicSlice(slice) };
      }
      const lanes = await ensureCoreRoleLanes(loop);
      if (!lanes.ok) return lanes;
    }
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
    startSourceRequirementsForLoop,
    status,
    threadLifecycle,
    workerLifecycleDeliverability,
  };
}

module.exports = {
  AUDIT_VERDICTS,
  createLoopTaskRuntimeService,
  nextRouteForAuditVerdict,
};
