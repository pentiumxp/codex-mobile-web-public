"use strict";

const SENSITIVE_ASSIGNMENT_PATTERN = /\b(password|passwd|pwd|token|api[_-]?key|access[_-]?key|secret|authorization|bearer)\s*[:=]\s*("[^"]+"|'[^']+'|[^\s,;]+)/gi;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi;
const GENERIC_SECRET_REF_PATTERN = /\b(sec_[A-Za-z0-9._:-]{8,})\b/g;

function compactWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeAlias(value) {
  return compactWhitespace(value)
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/_/g, "-");
}

function boundedText(value, maxLength) {
  const text = compactWhitespace(value);
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function redactSensitiveText(value) {
  return compactWhitespace(value)
    .replace(BEARER_PATTERN, "Bearer [redacted]")
    .replace(SENSITIVE_ASSIGNMENT_PATTERN, (_, key) => `${key}=[redacted]`)
    .replace(GENERIC_SECRET_REF_PATTERN, "sec_[redacted]");
}

function knownAliasSet(knownAliases) {
  const aliases = new Set(["home-ai", "homeai", "codex", "codex-mobile"]);
  if (Array.isArray(knownAliases)) {
    for (const alias of knownAliases) {
      const normalized = normalizeAlias(alias);
      if (normalized) aliases.add(normalized);
    }
  } else if (knownAliases && typeof knownAliases === "object") {
    for (const alias of Object.keys(knownAliases)) {
      const normalized = normalizeAlias(alias);
      if (normalized) aliases.add(normalized);
    }
  }
  return aliases;
}

function leadingMentionTokens(text) {
  const tokens = compactWhitespace(text).match(/^(@[A-Za-z0-9][A-Za-z0-9_-]*)(?:\s+(@[A-Za-z0-9][A-Za-z0-9_-]*))?/);
  if (!tokens) return [];
  return tokens.slice(1).filter(Boolean);
}

function parseAtLoopTrigger(input, options = {}) {
  const text = compactWhitespace(input && typeof input === "object" ? input.text || input.message || input.body : input);
  if (!text) {
    return { ok: false, triggered: false, error: "at_loop_trigger_empty" };
  }
  const mentions = leadingMentionTokens(text);
  if (!mentions.length) {
    return { ok: true, triggered: false };
  }

  const aliases = knownAliasSet(options.knownAliases);
  let triggerPrefix = "";
  let targetAlias = "";
  let domainAdapter = "generic";
  const first = normalizeAlias(mentions[0]);
  const second = normalizeAlias(mentions[1]);

  if (first === "loop") {
    triggerPrefix = mentions[0];
  } else if (second === "loop") {
    targetAlias = first;
    if (!aliases.has(targetAlias)) {
      return {
        ok: false,
        triggered: true,
        error: "at_loop_unknown_target_alias",
        targetAlias,
      };
    }
    triggerPrefix = `${mentions[0]} ${mentions[1]}`;
    domainAdapter = targetAlias === "home-ai" || targetAlias === "homeai" ? "home-ai" : "plugin";
  } else {
    return { ok: true, triggered: false };
  }

  const rawObjective = compactWhitespace(text.slice(triggerPrefix.length));
  if (!rawObjective) {
    return {
      ok: false,
      triggered: true,
      error: "at_loop_objective_required",
      targetAlias,
      domainAdapter,
    };
  }
  const redactedObjective = redactSensitiveText(rawObjective);
  return {
    ok: true,
    triggered: true,
    trigger: "@loop",
    targetAlias,
    domainAdapter,
    objective: boundedText(redactedObjective, options.objectiveMaxChars || 2000),
    objectiveSummary: boundedText(redactedObjective, options.summaryMaxChars || 220),
  };
}

function createAtLoopTriggerParserService(options = {}) {
  return {
    parse: (input, parseOptions = {}) => parseAtLoopTrigger(input, Object.assign({}, options, parseOptions)),
    normalizeAlias,
    redactSensitiveText,
    boundedText,
  };
}

module.exports = {
  boundedText,
  createAtLoopTriggerParserService,
  normalizeAlias,
  parseAtLoopTrigger,
  redactSensitiveText,
};
