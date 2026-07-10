"use strict";

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else if (root) {
    root.CodexRuntimeSettings = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : null, function () {
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

  function normalizeOptionList(values) {
    return [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))];
  }

  function titleCaseModelSuffix(value) {
    return String(value || "")
      .split(/[-_]+/)
      .map((part) => part ? part.charAt(0).toUpperCase() + part.slice(1) : "")
      .filter(Boolean)
      .join(" ");
  }

  function fallbackModelLabel(value) {
    const text = String(value || "").trim();
    const match = /^gpt[-_]?([0-9]+(?:\.[0-9]+)?)(?:[-_](.+))?$/i.exec(text);
    if (!match) return text;
    const suffix = titleCaseModelSuffix(match[2] || "");
    return `GPT-${match[1]}${suffix ? ` ${suffix}` : ""}`;
  }

  function labelForModel(value) {
    return MODEL_LABELS[value] || fallbackModelLabel(value);
  }

  function compactLabelForModel(value) {
    return COMPACT_MODEL_LABELS[value] || labelForModel(value).replace(/^GPT-/, "");
  }

  function labelForEffort(value) {
    return EFFORT_LABELS[value] || value;
  }

  function labelForPermissionMode(value) {
    return PERMISSION_LABELS[value] || value || "Perm";
  }

  function titleForPermissionMode(value) {
    return PERMISSION_LABELS[value] || "Thread permission";
  }

  function normalizePermissionModeValue(value) {
    const text = String(value || "").trim().toLowerCase();
    return PERMISSION_ALIASES[text] || text;
  }

  function firstRuntimeValue(values) {
    return normalizeOptionList(values)[0] || "";
  }

  function selectedNewThreadModel(settings) {
    return firstRuntimeValue([settings && settings.selected, settings && settings.defaultValue, ...((settings && settings.options) || [])]);
  }

  function optionSignature(values) {
    return normalizeOptionList(values).join("\n");
  }

  function legalModelValues(defaultModel, modelOptions) {
    return new Set(normalizeOptionList([defaultModel, ...modelOptions]));
  }

  function applyModelOptionsRefresh(state, config = {}) {
    const target = state && typeof state === "object" ? state : {};
    const nextOptions = normalizeOptionList(config.modelOptions || []);
    const nextDefault = String(config.defaultModel || "").trim();
    const currentOptions = normalizeOptionList(target.modelOptions || []);
    const currentDefault = String(target.defaultModel || "").trim();
    const optionsChanged = optionSignature(currentOptions) !== optionSignature(nextOptions);
    const defaultChanged = currentDefault !== nextDefault;
    if (!optionsChanged && !defaultChanged) {
      return {
        changed: false,
        optionsChanged: false,
        defaultChanged: false,
        selectionChanged: false,
        modelOptions: currentOptions,
        defaultModel: currentDefault,
      };
    }

    const legal = legalModelValues(nextDefault, nextOptions);
    const fallback = nextDefault || nextOptions[0] || "";
    let selectionChanged = false;
    const previousNewThreadModel = String(target.newThreadModel || "").trim();
    const previousComposerModel = String(target.composerModel || "").trim();

    target.modelOptions = nextOptions;
    target.defaultModel = nextDefault;

    if (!previousNewThreadModel || !legal.has(previousNewThreadModel)) {
      target.newThreadModel = fallback;
      selectionChanged = previousNewThreadModel !== String(target.newThreadModel || "").trim();
    }
    if (previousComposerModel && !legal.has(previousComposerModel)) {
      target.composerModel = "";
      selectionChanged = true;
    }

    return {
      changed: true,
      optionsChanged,
      defaultChanged,
      selectionChanged,
      modelOptions: nextOptions,
      defaultModel: nextDefault,
      fallbackModel: fallback,
    };
  }

  function selectedNewThreadEffort(settings) {
    return firstRuntimeValue([settings && settings.selected, settings && settings.defaultValue, ...((settings && settings.options) || [])]);
  }

  function selectedNewThreadPermission(settings) {
    const normalized = normalizePermissionModeValue(settings && settings.selected);
    if (normalized) return normalized;
    return normalizePermissionModeValue(settings && settings.defaultValue)
      || normalizePermissionModeValue(((settings && settings.options) || [])[0])
      || "full";
  }

  return {
    normalizeOptionList,
    labelForModel,
    compactLabelForModel,
    applyModelOptionsRefresh,
    labelForEffort,
    labelForPermissionMode,
    titleForPermissionMode,
    normalizePermissionModeValue,
    selectedNewThreadModel,
    selectedNewThreadEffort,
    selectedNewThreadPermission,
  };
}));
