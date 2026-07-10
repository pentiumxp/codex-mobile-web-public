"use strict";

const DEFAULT_CACHE_TTL_MS = 60_000;
const DEFAULT_READ_TIMEOUT_MS = 3000;
const DEFAULT_MODEL_LIST_LIMIT = 100;
const MAX_MODEL_LIST_PAGES = 5;
const MAX_MODEL_OPTIONS = 200;

function compactOneLine(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeModelOption(value) {
  const text = compactOneLine(value).slice(0, 120);
  if (!text) return "";
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(text)) return "";
  return text;
}

function normalizeModelOptions(values, limit = MAX_MODEL_OPTIONS) {
  const source = Array.isArray(values) ? values : [];
  const seen = new Set();
  const result = [];
  for (const value of source) {
    const option = normalizeModelOption(value);
    if (!option || seen.has(option)) continue;
    seen.add(option);
    result.push(option);
    if (result.length >= limit) break;
  }
  return result;
}

function modelOptionFromEntry(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return "";
  if (entry.hidden === true) return "";
  return normalizeModelOption(entry.model || entry.id || entry.slug);
}

function extractModelOptionsFromModelListResponse(response) {
  const source = response && typeof response === "object" && !Array.isArray(response)
    ? (Array.isArray(response.data) ? response.data : response.models)
    : [];
  return normalizeModelOptions((Array.isArray(source) ? source : [])
    .map((entry) => (typeof entry === "string" ? entry : modelOptionFromEntry(entry))));
}

function boundedErrorCode(err) {
  return compactOneLine(err && (err.code || err.message || err.name) || "model_options_read_failed")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .slice(0, 120) || "model_options_read_failed";
}

function createModelOptionsRuntimeService(dependencies = {}) {
  const codex = dependencies.codex;
  const now = typeof dependencies.now === "function" ? dependencies.now : Date.now;
  const fallbackModelOptions = normalizeModelOptions(dependencies.fallbackModelOptions || dependencies.modelOptions || []);
  const fallbackDefaultModel = normalizeModelOption(dependencies.defaultModel) || fallbackModelOptions[0] || "";
  const cacheTtlMs = Math.max(1000, Number(dependencies.cacheTtlMs || DEFAULT_CACHE_TTL_MS) || DEFAULT_CACHE_TTL_MS);
  const readTimeoutMs = Math.max(500, Number(dependencies.readTimeoutMs || DEFAULT_READ_TIMEOUT_MS) || DEFAULT_READ_TIMEOUT_MS);
  let cachedDynamicOptions = [];
  let cachedDynamicAt = 0;
  let lastSource = "fallback";
  let lastErrorCode = "";
  let inFlight = null;

  function fallbackOptions() {
    return fallbackModelOptions.slice();
  }

  function currentModelOptions() {
    if (cachedDynamicOptions.length && (now() - cachedDynamicAt) <= cacheTtlMs) {
      return cachedDynamicOptions.slice();
    }
    return fallbackOptions();
  }

  function defaultModelForOptions(options = currentModelOptions()) {
    const effective = normalizeModelOptions(options);
    if (fallbackDefaultModel && effective.includes(fallbackDefaultModel)) return fallbackDefaultModel;
    return effective[0] || fallbackDefaultModel;
  }

  async function readProviderModelOptions() {
    if (!codex || typeof codex.request !== "function") throw new Error("codex_app_server_client_unavailable");
    let cursor = null;
    const collected = [];
    for (let page = 0; page < MAX_MODEL_LIST_PAGES; page += 1) {
      const response = await codex.request("model/list", {
        cursor,
        includeHidden: false,
        limit: DEFAULT_MODEL_LIST_LIMIT,
      }, {
        timeoutMs: readTimeoutMs,
        retry: false,
        resetOnTimeout: false,
      });
      collected.push(...extractModelOptionsFromModelListResponse(response));
      cursor = compactOneLine(response && response.nextCursor);
      if (!cursor || collected.length >= MAX_MODEL_OPTIONS) break;
    }
    return normalizeModelOptions(collected);
  }

  async function refreshModelOptions() {
    try {
      const options = await readProviderModelOptions();
      if (!options.length) throw new Error("model_list_empty");
      cachedDynamicOptions = options;
      cachedDynamicAt = now();
      lastSource = "provider";
      lastErrorCode = "";
      return options.slice();
    } catch (err) {
      cachedDynamicOptions = [];
      cachedDynamicAt = 0;
      lastSource = "fallback";
      lastErrorCode = boundedErrorCode(err);
      return fallbackOptions();
    }
  }

  async function effectiveModelOptions(options = {}) {
    if (options.force !== true && cachedDynamicOptions.length && (now() - cachedDynamicAt) <= cacheTtlMs) {
      return cachedDynamicOptions.slice();
    }
    if (!inFlight) {
      inFlight = refreshModelOptions().finally(() => {
        inFlight = null;
      });
    }
    return inFlight;
  }

  function publicStatus() {
    return {
      source: lastSource,
      fallbackCount: fallbackModelOptions.length,
      dynamicCount: cachedDynamicOptions.length,
      lastDynamicReadAt: cachedDynamicAt ? new Date(cachedDynamicAt).toISOString() : "",
      lastErrorCode,
    };
  }

  return {
    currentModelOptions,
    defaultModelForOptions,
    effectiveModelOptions,
    publicStatus,
    readProviderModelOptions,
  };
}

module.exports = {
  createModelOptionsRuntimeService,
  extractModelOptionsFromModelListResponse,
  normalizeModelOption,
  normalizeModelOptions,
};
