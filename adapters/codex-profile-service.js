"use strict";

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_PROFILE_FILE_NAME = "codex-profiles.json";

function normalizeProfileId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizePathForCompare(value) {
  return path.resolve(String(value || "")).toLowerCase();
}

function safeReadJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (_) {
    return fallback;
  }
}

function writeJsonFile(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}

function decodeJwtPayload(token) {
  const parts = String(token || "").split(".");
  if (parts.length < 2 || !parts[1]) return null;
  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch (_) {
    return null;
  }
}

function redactIdentifier(value, options = {}) {
  const text = String(value || "").trim();
  if (!text) return "";
  const prefix = Math.max(0, Number(options.prefix || 8));
  const suffix = Math.max(0, Number(options.suffix || 4));
  if (text.length <= prefix + suffix + 3) return text;
  return `${text.slice(0, prefix)}...${text.slice(-suffix)}`;
}

function safeAccountFromAuth(auth) {
  if (!auth || typeof auth !== "object") {
    return { status: "notLoggedIn", label: "Not logged in" };
  }
  const tokens = auth.tokens && typeof auth.tokens === "object" ? auth.tokens : {};
  const claims = decodeJwtPayload(tokens.id_token);
  const email = claims && typeof claims.email === "string" ? claims.email.trim() : "";
  const name = claims && typeof claims.name === "string" ? claims.name.trim() : "";
  const accountId = String(tokens.account_id || "").trim();
  const accountIdShort = redactIdentifier(accountId);
  const label = email || name || (accountIdShort ? `account ${accountIdShort}` : "Logged in");
  return {
    status: "loggedIn",
    label,
    email: email || undefined,
    name: name || undefined,
    accountId: accountIdShort || undefined,
    authMode: typeof auth.auth_mode === "string" ? auth.auth_mode : undefined,
    lastRefresh: typeof auth.last_refresh === "string" ? auth.last_refresh : undefined,
  };
}

function authStatusForHome(codexHome) {
  const authPath = path.join(codexHome, "auth.json");
  if (!fs.existsSync(authPath)) {
    return { status: "notLoggedIn", label: "Not logged in", authFile: false };
  }
  const auth = safeReadJson(authPath, null);
  if (!auth) return { status: "error", label: "Auth unreadable", authFile: true };
  return Object.assign({ authFile: true }, safeAccountFromAuth(auth));
}

function compactRateLimitWindow(value) {
  if (!value || typeof value !== "object") return null;
  const usedPercent = value.usedPercent ?? value.used_percent;
  const windowDurationMins = value.windowDurationMins ?? value.window_minutes;
  const resetsAt = value.resetsAt ?? value.resets_at;
  return Object.fromEntries(Object.entries({
    usedPercent: Number.isFinite(Number(usedPercent)) ? Number(usedPercent) : undefined,
    windowDurationMins: Number.isFinite(Number(windowDurationMins)) ? Number(windowDurationMins) : undefined,
    resetsAt: Number.isFinite(Number(resetsAt)) ? Number(resetsAt) : undefined,
  }).filter(([, entry]) => entry !== undefined));
}

function normalizeModelKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function compactRateLimits(value) {
  if (!value || typeof value !== "object") return null;
  const compacted = Object.fromEntries(Object.entries({
    limitId: value.limitId || value.limit_id || undefined,
    limitName: value.limitName || value.limit_name || undefined,
    model: value.model || undefined,
    primary: compactRateLimitWindow(value.primary),
    secondary: compactRateLimitWindow(value.secondary),
    credits: value.credits || null,
    planType: value.planType || value.plan_type || undefined,
    rateLimitReachedType: value.rateLimitReachedType || value.rate_limit_reached_type || null,
  }).filter(([, entry]) => entry !== undefined));
  const modelKeys = rateLimitModelKeys(compacted);
  if (modelKeys.length) compacted.modelKeys = modelKeys;
  return compacted;
}

function addRateLimitModelKey(keys, value) {
  const key = normalizeModelKey(value);
  if (key) keys.add(key);
}

function rateLimitModelKeys(rateLimits) {
  if (!rateLimits || typeof rateLimits !== "object") return [];
  const keys = new Set();
  if (Array.isArray(rateLimits.modelKeys)) {
    for (const value of rateLimits.modelKeys) addRateLimitModelKey(keys, value);
  }
  addRateLimitModelKey(keys, rateLimits.model);
  addRateLimitModelKey(keys, rateLimits.limitName);
  const limitId = normalizeModelKey(rateLimits.limitId);
  if (limitId === "codex-bengalfox") keys.add("gpt-5.3-codex-spark");
  else if (limitId === "codex") {
    for (const model of ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.3-codex", "gpt-5.2"]) keys.add(model);
  }
  return [...keys];
}

function rateLimitWindows(rateLimits) {
  return [rateLimits && rateLimits.primary, rateLimits && rateLimits.secondary]
    .filter((windowInfo) => windowInfo && Number.isFinite(Number(windowInfo.usedPercent)));
}

function hasCurrentRateLimitWindow(rateLimits, nowMs = Date.now()) {
  const nowSeconds = nowMs / 1000;
  return rateLimitWindows(rateLimits).some((windowInfo) => {
    const resetsAt = Number(windowInfo.resetsAt || 0);
    return !resetsAt || resetsAt > nowSeconds;
  });
}

function collectRecentRolloutFiles(root, options = {}) {
  const maxFiles = Number(options.maxFiles || 80);
  const maxDepth = Number(options.maxDepth || 6);
  const out = [];
  const visit = (dir, depth) => {
    if (out.length >= maxFiles * 4 || depth > maxDepth) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_) {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath, depth + 1);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue;
      try {
        const stat = fs.statSync(fullPath);
        out.push({ path: fullPath, mtimeMs: Number(stat.mtimeMs || 0), size: Number(stat.size || 0) });
      } catch (_) {}
    }
  };
  visit(root, 0);
  return out.sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, maxFiles);
}

function readRolloutTail(filePath, maxBytes = 2 * 1024 * 1024) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size <= 0) return "";
    const bytesToRead = Math.min(maxBytes, stat.size);
    const fd = fs.openSync(filePath, "r");
    try {
      const buffer = Buffer.alloc(bytesToRead);
      fs.readSync(fd, buffer, 0, bytesToRead, stat.size - bytesToRead);
      return buffer.toString("utf8");
    } finally {
      fs.closeSync(fd);
    }
  } catch (_) {
    return "";
  }
}

function loadRateLimitSnapshotForHome(codexHome, options = {}) {
  const nowMs = Number(options.nowMs || Date.now());
  const files = [
    ...collectRecentRolloutFiles(path.join(codexHome, "sessions"), { maxFiles: 80 }),
    ...collectRecentRolloutFiles(path.join(codexHome, "archived_sessions"), { maxFiles: 30, maxDepth: 1 }),
  ].sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, 100);
  const latestByGroup = new Map();
  for (const file of files) {
    const tail = readRolloutTail(file.path);
    if (!tail.includes("rate_limits")) continue;
    const lines = tail.split(/\r?\n/).filter(Boolean).reverse();
    for (const line of lines) {
      let entry;
      try {
        entry = JSON.parse(line);
      } catch (_) {
        continue;
      }
      const compacted = compactRateLimits(entry && entry.payload && entry.payload.rate_limits);
      if (!compacted || !hasCurrentRateLimitWindow(compacted, nowMs)) continue;
      const group = normalizeModelKey(compacted.limitId || compacted.limitName || compacted.model);
      if (!group) continue;
      const eventMs = Date.parse(entry.timestamp || "") || file.mtimeMs || 0;
      const existing = latestByGroup.get(group);
      if (!existing || eventMs > existing.eventMs) latestByGroup.set(group, { eventMs, rateLimits: compacted });
      break;
    }
  }
  let rateLimits = null;
  const rateLimitsByModel = {};
  for (const entry of [...latestByGroup.values()].sort((a, b) => a.eventMs - b.eventMs)) {
    rateLimits = entry.rateLimits;
    for (const key of rateLimitModelKeys(entry.rateLimits)) {
      rateLimitsByModel[normalizeModelKey(key)] = entry.rateLimits;
    }
  }
  return { rateLimits, rateLimitsByModel };
}

function hasQuotaSnapshot(value) {
  return Boolean(value && typeof value === "object" && (value.rateLimits || (value.rateLimitsByModel && Object.keys(value.rateLimitsByModel).length)));
}

function normalizeQuotaSnapshot(value) {
  if (!value || typeof value !== "object") return { rateLimits: null, rateLimitsByModel: {} };
  const rateLimits = compactRateLimits(value.rateLimits);
  const rateLimitsByModel = {};
  if (value.rateLimitsByModel && typeof value.rateLimitsByModel === "object") {
    for (const [model, snapshot] of Object.entries(value.rateLimitsByModel)) {
      const key = normalizeModelKey(model);
      const compacted = compactRateLimits(snapshot);
      if (key && compacted) rateLimitsByModel[key] = compacted;
    }
  }
  if (rateLimits) {
    for (const key of rateLimitModelKeys(rateLimits)) {
      rateLimitsByModel[normalizeModelKey(key)] = rateLimits;
    }
  }
  return { rateLimits, rateLimitsByModel };
}

function defaultProfiles(userHome, activeCodexHome = "") {
  const candidates = [
    { id: "current", label: "Current", codexHome: path.join(userHome, ".codex-homes", "current") },
    { id: "previous", label: "Previous", codexHome: path.join(userHome, ".codex-homes", "previous") },
  ];
  const defaultHome = path.join(userHome, ".codex");
  const activeHome = activeCodexHome || defaultHome;
  const known = new Set(candidates.map((profile) => normalizePathForCompare(profile.codexHome)));
  if (!known.has(normalizePathForCompare(activeHome)) || fs.existsSync(defaultHome)) {
    candidates.unshift({ id: "default", label: "Default", codexHome: activeHome });
  }
  return candidates;
}

function normalizeProfiles(rawProfiles, userHome, activeCodexHome = "") {
  const byId = new Map();
  for (const profile of [...defaultProfiles(userHome, activeCodexHome), ...(Array.isArray(rawProfiles) ? rawProfiles : [])]) {
    const id = normalizeProfileId(profile && profile.id);
    const codexHome = profile && profile.codexHome ? path.resolve(String(profile.codexHome)) : "";
    if (!id || !codexHome) continue;
    byId.set(id, {
      id,
      label: String(profile.label || id).trim() || id,
      codexHome,
    });
  }
  return [...byId.values()];
}

function resolveActiveCodexHomeFromStore(options = {}) {
  const env = options.env || process.env;
  const userHome = options.userHome || env.USERPROFILE || env.HOME || process.cwd();
  const runtimeRoot = options.runtimeRoot || env.CODEX_MOBILE_RUNTIME_DIR || path.join(userHome, ".codex-mobile-web");
  const storeFile = options.storeFile || env.CODEX_MOBILE_PROFILE_FILE || path.join(runtimeRoot, DEFAULT_PROFILE_FILE_NAME);
  const store = safeReadJson(storeFile, {});
  const profiles = normalizeProfiles(store.profiles, userHome, "");
  const activeProfileId = normalizeProfileId(store.activeProfileId || store.active || "");
  const activeProfile = activeProfileId ? profiles.find((profile) => profile.id === activeProfileId) : null;
  return {
    storeFile,
    activeProfileId: activeProfile ? activeProfile.id : "",
    codexHome: activeProfile ? activeProfile.codexHome : "",
  };
}

function createCodexProfileService(options = {}) {
  const env = options.env || process.env;
  const userHome = options.userHome || env.USERPROFILE || env.HOME || process.cwd();
  const runtimeRoot = options.runtimeRoot || env.CODEX_MOBILE_RUNTIME_DIR || path.join(userHome, ".codex-mobile-web");
  const storeFile = options.storeFile || env.CODEX_MOBILE_PROFILE_FILE || path.join(runtimeRoot, DEFAULT_PROFILE_FILE_NAME);
  const activeCodexHome = options.activeCodexHome || env.CODEX_HOME || path.join(userHome, ".codex");

  function readStore() {
    const store = safeReadJson(storeFile, {});
    if (!store || typeof store !== "object") return {};
    return store;
  }

  function activeProfileFromStore(store, normalized) {
    const activeProfileId = normalizeProfileId(store.activeProfileId || store.active || "");
    if (activeProfileId) {
      const byId = normalized.find((profile) => profile.id === activeProfileId);
      if (byId) return byId;
    }
    return normalized.find((profile) => normalizePathForCompare(profile.codexHome) === normalizePathForCompare(activeCodexHome))
      || normalized[0]
      || null;
  }

  function writeStore(store, patch) {
    const normalized = normalizeProfiles(store.profiles, userHome, activeCodexHome)
      .map((item) => ({ id: item.id, label: item.label, codexHome: item.codexHome }));
    writeJsonFile(storeFile, Object.assign({}, store, patch, {
      profiles: normalized,
      updatedAt: new Date().toISOString(),
    }));
  }

  function profiles(options = {}) {
    const store = readStore();
    const normalized = normalizeProfiles(store.profiles, userHome, activeCodexHome);
    const activeProfile = activeProfileFromStore(store, normalized);
    const activeId = activeProfile ? activeProfile.id : (normalized[0] && normalized[0].id || "");
    const quotaSnapshots = store.quotaSnapshots && typeof store.quotaSnapshots === "object"
      ? Object.assign({}, store.quotaSnapshots)
      : {};
    const activeQuota = normalizeQuotaSnapshot(options.activeQuota);
    if (activeId && hasQuotaSnapshot(activeQuota)) {
      quotaSnapshots[activeId] = Object.assign({}, activeQuota, { updatedAt: new Date().toISOString(), source: "active" });
      if (JSON.stringify(store.quotaSnapshots || {}) !== JSON.stringify(quotaSnapshots)) {
        writeStore(store, { activeProfileId: activeId, quotaSnapshots });
      }
    }
    return {
      activeProfileId: activeId,
      activeCodexHome,
      storeFile,
      restartRequired: true,
      switchSupported: !env.CODEX_MOBILE_MUX_ENDPOINT_FILE && !env.CODEX_MOBILE_APP_SERVER_WS && !env.CODEX_MOBILE_APP_SERVER_TCP,
      profiles: normalized.map((profile) => {
        const rolloutQuota = loadRateLimitSnapshotForHome(profile.codexHome);
        const storedQuota = normalizeQuotaSnapshot(quotaSnapshots[profile.id]);
        const quota = hasQuotaSnapshot(rolloutQuota) ? rolloutQuota : storedQuota;
        return Object.assign({}, profile, {
          active: profile.id === activeId,
          exists: fs.existsSync(profile.codexHome),
          auth: authStatusForHome(profile.codexHome),
          quota,
        });
      }),
    };
  }

  function setActiveProfile(profileId) {
    const id = normalizeProfileId(profileId);
    const current = profiles();
    const profile = current.profiles.find((item) => item.id === id);
    if (!profile) {
      const err = new Error("Unknown Codex profile");
      err.statusCode = 404;
      throw err;
    }
    if (!current.switchSupported) {
      const err = new Error("Codex profile switching requires the default per-profile mux endpoint configuration.");
      err.statusCode = 409;
      throw err;
    }
    const store = readStore();
    const storedProfiles = normalizeProfiles(store.profiles, userHome, activeCodexHome)
      .map((item) => ({ id: item.id, label: item.label, codexHome: item.codexHome }));
    writeJsonFile(storeFile, {
      activeProfileId: profile.id,
      profiles: storedProfiles,
      quotaSnapshots: store.quotaSnapshots && typeof store.quotaSnapshots === "object" ? store.quotaSnapshots : {},
      updatedAt: new Date().toISOString(),
    });
    return profile;
  }

  return {
    profiles,
    setActiveProfile,
  };
}

module.exports = {
  authStatusForHome,
  createCodexProfileService,
  decodeJwtPayload,
  loadRateLimitSnapshotForHome,
  normalizeProfileId,
  resolveActiveCodexHomeFromStore,
  safeAccountFromAuth,
};
