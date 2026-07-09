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

function defaultMuxEndpointFileForHome(codexHome) {
  const home = String(codexHome || "").trim();
  return home ? path.join(path.resolve(home), "app-server-mux", "endpoint.json") : "";
}

function isDefaultMuxEndpointForHome(endpointFile, codexHome) {
  const endpoint = String(endpointFile || "").trim();
  const expected = defaultMuxEndpointFileForHome(codexHome);
  return Boolean(
    endpoint
    && expected
    && normalizePathForCompare(endpoint) === normalizePathForCompare(expected),
  );
}

function profileSwitchSupportedForEnv(env = {}, activeCodexHome = "") {
  if (env.CODEX_MOBILE_APP_SERVER_WS || env.CODEX_MOBILE_APP_SERVER_TCP) return false;
  const endpointFile = String(env.CODEX_MOBILE_MUX_ENDPOINT_FILE || "").trim();
  if (!endpointFile) return true;
  return isDefaultMuxEndpointForHome(endpointFile, activeCodexHome)
    || isDefaultMuxEndpointForHome(endpointFile, env.CODEX_HOME);
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

function accountDisplayNameFromAuth(auth) {
  if (!auth || auth.status !== "loggedIn") return "";
  return String(auth.email || auth.name || auth.label || auth.accountId || "Logged in").trim();
}

function publicProfileDisplayFields(profile, auth) {
  const slotLabel = String(profile && (profile.label || profile.id) || "").trim() || String(profile && profile.id || "");
  const accountName = accountDisplayNameFromAuth(auth);
  const authStatusLabel = auth && auth.status === "error"
    ? "Auth unreadable"
    : (auth && auth.status === "loggedIn" ? "Signed in" : "Not logged in");
  const displayName = accountName || authStatusLabel;
  return {
    label: displayName,
    displayName,
    accountName,
    accountLabel: accountName || "",
    authStatusLabel,
    slotId: String(profile && profile.id || ""),
    slotLabel,
    internalLabel: slotLabel,
  };
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

function realPathOrResolved(value) {
  const resolved = path.resolve(String(value || ""));
  try {
    return fs.realpathSync.native ? fs.realpathSync.native(resolved) : fs.realpathSync(resolved);
  } catch (_) {
    return resolved;
  }
}

function pathContains(parentPath, childPath) {
  const parent = realPathOrResolved(parentPath);
  const child = realPathOrResolved(childPath);
  const relative = path.relative(parent, child);
  return !relative || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function isRateLimitRolloutSourceAccountScoped(codexHome) {
  if (!codexHome) return false;
  for (const name of ["sessions", "archived_sessions"]) {
    const candidate = path.join(codexHome, name);
    try {
      if (!fs.existsSync(candidate)) continue;
      if (!pathContains(codexHome, candidate)) return false;
    } catch (_) {
      return false;
    }
  }
  return true;
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
  if (!isRateLimitRolloutSourceAccountScoped(codexHome)) {
    return { rateLimits: null, rateLimitsByModel: {}, source: "shared-rollout-skipped" };
  }
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
  return { rateLimits, rateLimitsByModel, source: hasQuotaSnapshot({ rateLimits, rateLimitsByModel }) ? "rollout" : null };
}

function hasQuotaSnapshot(value) {
  return Boolean(value && typeof value === "object" && (value.rateLimits || (value.rateLimitsByModel && Object.keys(value.rateLimitsByModel).length)));
}

function normalizeQuotaSnapshot(value) {
  if (!value || typeof value !== "object") return { rateLimits: null, rateLimitsByModel: {}, source: null, updatedAt: null };
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
  return {
    rateLimits,
    rateLimitsByModel,
    source: typeof value.source === "string" ? value.source : null,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null,
  };
}

function hasReusableStoredQuotaSnapshot(value, codexHome) {
  return isRateLimitRolloutSourceAccountScoped(codexHome)
    && hasQuotaSnapshot(value)
    && value.source === "active-live";
}

function isActiveLiveQuotaSource(source) {
  return source === "managed-child-live" || source === "profile-mux-live";
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

function envFlagEnabled(value) {
  return /^(1|true|yes|on)$/i.test(String(value || ""));
}

function resolveEffectiveCodexHome(options = {}) {
  const env = options.env || process.env;
  const userHome = options.userHome || env.USERPROFILE || env.HOME || process.cwd();
  const runtimeRoot = options.runtimeRoot || env.CODEX_MOBILE_RUNTIME_DIR || path.join(userHome, ".codex-mobile-web");
  const defaultCodexHome = options.defaultCodexHome || path.join(userHome, ".codex");
  const bootstrap = options.bootstrap || resolveActiveCodexHomeFromStore({
    userHome,
    runtimeRoot,
    env,
    storeFile: options.storeFile,
  });
  const envCodexHome = env.CODEX_HOME ? path.resolve(String(env.CODEX_HOME)) : "";
  const profileCodexHome = bootstrap && bootstrap.codexHome ? path.resolve(String(bootstrap.codexHome)) : "";
  const envOverrideAllowed = envFlagEnabled(env.CODEX_MOBILE_CODEX_HOME_OVERRIDE)
    || envFlagEnabled(env.CODEX_MOBILE_ALLOW_CODEX_HOME_OVERRIDE);
  const envCodexHomeIgnored = Boolean(
    profileCodexHome
    && envCodexHome
    && !envOverrideAllowed
    && normalizePathForCompare(profileCodexHome) !== normalizePathForCompare(envCodexHome),
  );
  const codexHome = envOverrideAllowed && envCodexHome
    ? envCodexHome
    : (profileCodexHome || envCodexHome || defaultCodexHome);
  return {
    codexHome,
    source: envOverrideAllowed && envCodexHome
      ? "env-override"
      : (profileCodexHome ? "profile-store" : (envCodexHome ? "env" : "default")),
    storeFile: bootstrap && bootstrap.storeFile || "",
    activeProfileId: bootstrap && bootstrap.activeProfileId || "",
    profileCodexHome,
    envCodexHome,
    envOverrideAllowed,
    envCodexHomeIgnored,
  };
}

function createCodexProfileService(options = {}) {
  const env = options.env || process.env;
  const userHome = options.userHome || env.USERPROFILE || env.HOME || process.cwd();
  const runtimeRoot = options.runtimeRoot || env.CODEX_MOBILE_RUNTIME_DIR || path.join(userHome, ".codex-mobile-web");
  const storeFile = options.storeFile || env.CODEX_MOBILE_PROFILE_FILE || path.join(runtimeRoot, DEFAULT_PROFILE_FILE_NAME);
  const activeCodexHomeOption = options.activeCodexHome;

  function runtimeActiveCodexHome() {
    const value = typeof activeCodexHomeOption === "function"
      ? activeCodexHomeOption()
      : activeCodexHomeOption;
    return value || env.CODEX_HOME || path.join(userHome, ".codex");
  }

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
    const activeCodexHome = runtimeActiveCodexHome();
    return normalized.find((profile) => normalizePathForCompare(profile.codexHome) === normalizePathForCompare(activeCodexHome))
      || normalized[0]
      || null;
  }

  function writeStore(store, patch) {
    const activeCodexHome = runtimeActiveCodexHome();
    const normalized = normalizeProfiles(store.profiles, userHome, activeCodexHome)
      .map((item) => ({ id: item.id, label: item.label, codexHome: item.codexHome }));
    writeJsonFile(storeFile, Object.assign({}, store, patch, {
      profiles: normalized,
      updatedAt: new Date().toISOString(),
    }));
  }

  function profiles(options = {}) {
    const store = readStore();
    const runtimeCodexHome = runtimeActiveCodexHome();
    const normalized = normalizeProfiles(store.profiles, userHome, runtimeCodexHome);
    const activeProfile = activeProfileFromStore(store, normalized);
    const activeId = activeProfile ? activeProfile.id : (normalized[0] && normalized[0].id || "");
    const selectedCodexHome = activeProfile && activeProfile.codexHome
      ? activeProfile.codexHome
      : runtimeCodexHome;
    const runtimeState = normalizePathForCompare(selectedCodexHome) === normalizePathForCompare(runtimeCodexHome)
      ? "aligned"
      : "restart_pending";
    const quotaSnapshots = store.quotaSnapshots && typeof store.quotaSnapshots === "object"
      ? Object.assign({}, store.quotaSnapshots)
      : {};
    const activeQuota = normalizeQuotaSnapshot(options.activeQuota);
    const activeQuotaAccountScoped = Boolean(activeProfile && isRateLimitRolloutSourceAccountScoped(activeProfile.codexHome));
    const activeOwnedLiveQuota = isActiveLiveQuotaSource(activeQuota.source) && hasQuotaSnapshot(activeQuota);
    if (activeId && activeQuotaAccountScoped && hasQuotaSnapshot(activeQuota)) {
      quotaSnapshots[activeId] = Object.assign({}, activeQuota, { updatedAt: new Date().toISOString(), source: "active-live" });
      if (JSON.stringify(store.quotaSnapshots || {}) !== JSON.stringify(quotaSnapshots)) {
        writeStore(store, { activeProfileId: activeId, quotaSnapshots });
      }
    } else if (activeId && !activeQuotaAccountScoped
      && quotaSnapshots[activeId] && quotaSnapshots[activeId].source === "active-live") {
      delete quotaSnapshots[activeId];
      writeStore(store, { activeProfileId: activeId, quotaSnapshots });
    }
    return {
      activeProfileId: activeId,
      activeCodexHome: selectedCodexHome,
      runtimeCodexHome,
      runtimeState,
      storeFile,
      restartRequired: true,
      switchSupported: profileSwitchSupportedForEnv(env, runtimeCodexHome),
      profiles: normalized.map((profile) => {
        const rolloutQuota = loadRateLimitSnapshotForHome(profile.codexHome);
        const storedQuota = normalizeQuotaSnapshot(quotaSnapshots[profile.id]);
        const quota = profile.id === activeId && activeOwnedLiveQuota
          ? activeQuota
          : (hasQuotaSnapshot(rolloutQuota)
            ? rolloutQuota
            : (hasReusableStoredQuotaSnapshot(storedQuota, profile.codexHome)
              ? storedQuota
              : { rateLimits: null, rateLimitsByModel: {}, source: null, updatedAt: null }));
        const auth = authStatusForHome(profile.codexHome);
        return Object.assign({}, profile, publicProfileDisplayFields(profile, auth), {
          active: profile.id === activeId,
          exists: fs.existsSync(profile.codexHome),
          auth,
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
    const activeCodexHome = runtimeActiveCodexHome();
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
  accountDisplayNameFromAuth,
  authStatusForHome,
  createCodexProfileService,
  decodeJwtPayload,
  isRateLimitRolloutSourceAccountScoped,
  loadRateLimitSnapshotForHome,
  normalizeProfileId,
  publicProfileDisplayFields,
  resolveActiveCodexHomeFromStore,
  resolveEffectiveCodexHome,
  safeAccountFromAuth,
};
