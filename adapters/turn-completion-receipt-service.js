"use strict";

function stringValue(value) {
  return String(value || "").trim();
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function timestampMs(value) {
  const number = Number(value);
  if (Number.isFinite(number) && number > 0) return number;
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function formatCompletedAt(value) {
  const timestamp = timestampMs(value);
  if (!timestamp) return "";
  try {
    return new Date(timestamp).toLocaleString("zh-CN", { hour12: false });
  } catch (_) {
    return new Date(timestamp).toISOString();
  }
}

function compactText(value) {
  return String(value || "").replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function contentPartText(part) {
  if (part == null) return "";
  if (typeof part === "string") return part;
  if (typeof part !== "object") return String(part);
  if (typeof part.text === "string") return part.text;
  if (Array.isArray(part.content)) return part.content.map(contentPartText).filter(Boolean).join("\n");
  if (Array.isArray(part.parts)) return part.parts.map(contentPartText).filter(Boolean).join("\n");
  if (typeof part.message === "string") return part.message;
  if (part.message && typeof part.message === "object") return contentPartText(part.message);
  if (Array.isArray(part.summary) && part.summary.length) return part.summary.join("\n");
  return "";
}

function finalReceiptTextFromParams(params) {
  const candidates = [
    params && params.lastAgentMessage,
    params && params.last_agent_message,
    params && params.finalAgentMessage,
    params && params.final_agent_message,
    params && params.turn && params.turn.lastAgentMessage,
    params && params.turn && params.turn.last_agent_message,
    params && params.turn && params.turn.finalAgentMessage,
    params && params.turn && params.turn.final_agent_message,
  ];
  for (const candidate of candidates) {
    const text = compactText(contentPartText(candidate));
    if (text) return text;
  }
  return "";
}

function formatTokenCount(value) {
  const number = numberValue(value);
  return number === null ? "--" : number.toLocaleString("en-US");
}

function formatUsagePercent(value) {
  const number = numberValue(value);
  return number === null ? "--" : `${Math.round(number)}%`;
}

function formatFileSize(bytes) {
  const value = numberValue(bytes);
  if (value === null || value < 0) return "--";
  if (value < 1024) return `${Math.round(value)} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function tokenUsageSummaryText(usage) {
  if (!usage || typeof usage !== "object") return "--";
  const parts = [];
  const input = numberValue(usage.inputTokens);
  const cached = numberValue(usage.cachedInputTokens);
  const output = numberValue(usage.outputTokens);
  const reasoning = numberValue(usage.reasoningOutputTokens);
  const total = numberValue(usage.totalTokens);
  if (input !== null) parts.push(`input ${formatTokenCount(input)}`);
  if (cached !== null) parts.push(`cached ${formatTokenCount(cached)}`);
  if (output !== null) parts.push(`output ${formatTokenCount(output)}`);
  if (reasoning !== null) parts.push(`reasoning ${formatTokenCount(reasoning)}`);
  if (total !== null) parts.push(`total ${formatTokenCount(total)}`);
  return parts.length ? parts.join(" · ") : "--";
}

function contextRiskLabel(level) {
  const normalized = stringValue(level).toLowerCase();
  if (normalized === "critical") return "critical";
  if (normalized === "high") return "high";
  if (normalized === "warn") return "warn";
  if (normalized === "normal") return "normal";
  return "unknown";
}

function usageLines(summary) {
  if (!summary || typeof summary !== "object") return [];
  const contextTokens = numberValue(summary.contextWindowUsedTokens);
  const contextWindow = numberValue(summary.modelContextWindow);
  const contextDetail = contextTokens !== null && contextWindow !== null && contextWindow > 0
    ? `${formatUsagePercent(summary.contextWindowUsedPercent)} (${formatTokenCount(contextTokens)} / ${formatTokenCount(contextWindow)})`
    : formatUsagePercent(summary.contextWindowUsedPercent);
  const rolloutSize = numberValue(summary.rolloutSizeBytes);
  const rolloutThreshold = numberValue(summary.rolloutWarningThresholdBytes);
  return [
    `- context window: ${contextDetail || "--"}`,
    `- risk: ${contextRiskLabel(summary.contextRiskLevel)}`,
    `- last turn: ${tokenUsageSummaryText(summary.lastTokenUsage || {})}`,
    `- thread total: ${tokenUsageSummaryText(summary.totalTokenUsage || {})}`,
    `- rollout: ${rolloutSize !== null ? formatFileSize(rolloutSize) : "--"}${rolloutThreshold !== null && rolloutThreshold > 0 ? ` (warn ${formatFileSize(rolloutThreshold)})` : ""}`,
  ];
}

function boundedBody(text, maxChars) {
  const body = compactText(text);
  if (!body) return null;
  const maxLength = Math.max(1000, Number(maxChars || 0) || 12000);
  if (body.length <= maxLength) return { body, truncated: false };
  const suffix = "\n\n...(truncated)";
  return {
    body: `${body.slice(0, Math.max(0, maxLength - suffix.length)).trimEnd()}${suffix}`,
    truncated: true,
  };
}

function buildTurnCompletionDetailMessage(input = {}) {
  const finalReceipt = compactText(input.finalReceiptText || finalReceiptTextFromParams(input.params));
  const usage = input.turnUsageSummary && typeof input.turnUsageSummary === "object"
    ? input.turnUsageSummary
    : null;
  if (!finalReceipt && !usage) return null;
  const lines = [];
  const threadTitle = stringValue(input.threadTitle);
  if (threadTitle) {
    lines.push(`# ${threadTitle}`);
    lines.push("");
  }
  const completedAt = formatCompletedAt(input.completedAt);
  if (completedAt) lines.push(`完成时间：${completedAt}`, "");
  if (finalReceipt) {
    lines.push("## 最终回执", "", finalReceipt, "");
  }
  if (usage) {
    lines.push("## Usage", "", ...usageLines(usage));
  }
  const bounded = boundedBody(lines.join("\n"), input.maxChars);
  if (!bounded) return null;
  return {
    format: "markdown",
    sourceTurnId: stringValue(input.turnId),
    body: bounded.body,
    truncated: bounded.truncated,
  };
}

module.exports = {
  buildTurnCompletionDetailMessage,
  finalReceiptTextFromParams,
};
