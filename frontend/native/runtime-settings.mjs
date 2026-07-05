const MODEL_LABELS = {
  "gpt-5.5": "GPT-5.5",
  "gpt-5.4": "GPT-5.4",
  "gpt-5.4-mini": "GPT-5.4 Mini",
  "gpt-5.3-codex": "GPT-5.3 Codex",
  "gpt-5.3-codex-spark": "GPT-5.3 Codex Spark",
  "gpt-5.2": "GPT-5.2",
};

const COMPACT_MODEL_LABELS = {
  "gpt-5.5": "5.5",
  "gpt-5.4": "5.4",
  "gpt-5.4-mini": "5.4 Mini",
  "gpt-5.3-codex": "5.3 Codex",
  "gpt-5.3-codex-spark": "5.3 Spark",
  "gpt-5.2": "5.2",
};

const EFFORT_LABELS = {
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "XHigh",
};

const PERMISSION_LABELS = {
  default: "默认权限",
  auto: "自动审查",
  full: "完全访问权限",
  custom: "自定义 (config.toml)",
};

const PERMISSION_ALIASES = {
  "full-access": "full",
  "workspace-write": "auto",
  "read-only": "auto",
  "auto-review": "auto",
  "auto-reviewing": "auto",
  config: "custom",
  "config.toml": "custom",
  "custom-config": "custom",
};

export function normalizeOptionList(values) {
  return [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))];
}

export function labelForModel(value) {
  return MODEL_LABELS[value] || value;
}

export function compactLabelForModel(value) {
  return COMPACT_MODEL_LABELS[value] || labelForModel(value).replace(/^GPT-/, "");
}

export function labelForEffort(value) {
  return EFFORT_LABELS[value] || value;
}

export function labelForPermissionMode(value) {
  return PERMISSION_LABELS[value] || value || "Perm";
}

export function titleForPermissionMode(value) {
  return PERMISSION_LABELS[value] || "Thread permission";
}

export function normalizePermissionModeValue(value) {
  const text = String(value || "").trim().toLowerCase();
  return PERMISSION_ALIASES[text] || text;
}

function firstRuntimeValue(values) {
  return normalizeOptionList(values)[0] || "";
}

export function selectedNewThreadModel(settings) {
  return firstRuntimeValue([settings && settings.selected, settings && settings.defaultValue, ...((settings && settings.options) || [])]);
}

export function selectedNewThreadEffort(settings) {
  return firstRuntimeValue([settings && settings.selected, settings && settings.defaultValue, ...((settings && settings.options) || [])]);
}

export function selectedNewThreadPermission(settings) {
  const normalized = normalizePermissionModeValue(settings && settings.selected);
  if (normalized) return normalized;
  return normalizePermissionModeValue(settings && settings.defaultValue)
    || normalizePermissionModeValue(((settings && settings.options) || [])[0])
    || "full";
}

export default {
  normalizeOptionList,
  labelForModel,
  compactLabelForModel,
  labelForEffort,
  labelForPermissionMode,
  titleForPermissionMode,
  normalizePermissionModeValue,
  selectedNewThreadModel,
  selectedNewThreadEffort,
  selectedNewThreadPermission,
};
