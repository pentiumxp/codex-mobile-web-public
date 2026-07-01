"use strict";

function createServerRuntimeUtils(dependencies = {}) {
  const fs = dependencies.fs || require("node:fs");
  const path = dependencies.path || require("node:path");
  const crypto = dependencies.crypto || require("node:crypto");
  const env = dependencies.env || process.env;
  const appRoot = dependencies.appRoot || process.cwd();
  const publicRoot = dependencies.publicRoot || path.join(appRoot, "public");
  const userHome = dependencies.userHome || env.USERPROFILE || env.HOME || process.cwd();
  const getCodexHome = typeof dependencies.getCodexHome === "function"
    ? dependencies.getCodexHome
    : () => dependencies.codexHome || "";

  function uniqueStrings(values) {
    const seen = new Set();
    const result = [];
    for (const value of values || []) {
      const text = String(value || "").trim();
      if (!text || seen.has(text)) continue;
      seen.add(text);
      result.push(text);
    }
    return result;
  }

  function detectDevelopmentWorkspaceRoot(root) {
    let current = path.resolve(String(root || process.cwd()));
    while (current && current !== path.dirname(current)) {
      if (path.basename(current) === "HermesMobileDev") return current;
      current = path.dirname(current);
    }
    const fallbackRoots = uniqueStrings([
      env.HERMES_MOBILE_DEV_ROOT || "",
      "/Users/hermes-dev/HermesMobileDev",
    ]);
    for (const candidate of fallbackRoots) {
      const resolved = path.resolve(candidate);
      try {
        if (path.basename(resolved) === "HermesMobileDev" && fs.statSync(resolved).isDirectory()) {
          return resolved;
        }
      } catch (_) {}
    }
    return "";
  }

  function normalizePathForEarlyCompare(value) {
    return path.resolve(String(value || "")).toLowerCase();
  }

  function sameEarlyFsPath(left, right) {
    const a = String(left || "").trim();
    const b = String(right || "").trim();
    return Boolean(a && b && normalizePathForEarlyCompare(a) === normalizePathForEarlyCompare(b));
  }

  function defaultMuxEndpointFileForCodexHome(codexHome) {
    const home = String(codexHome || "").trim();
    return home ? path.join(path.resolve(home), "app-server-mux", "endpoint.json") : "";
  }

  function resolveMuxEndpointFile(envSource, codexHome, codexHomeResolution = {}) {
    const source = envSource || env;
    const fallback = defaultMuxEndpointFileForCodexHome(codexHome);
    const configured = String(source && source.CODEX_MOBILE_MUX_ENDPOINT_FILE || "").trim();
    if (!configured) return fallback;
    const envCodexHome = codexHomeResolution && codexHomeResolution.envCodexHome || "";
    const staleEnvDefault = envCodexHome
      && codexHomeResolution.envCodexHomeIgnored
      && sameEarlyFsPath(configured, defaultMuxEndpointFileForCodexHome(envCodexHome))
      && !sameEarlyFsPath(configured, fallback);
    return staleEnvDefault ? fallback : path.resolve(configured);
  }

  function optionListFromEnv(name, fallback) {
    const values = String(env[name] || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    return [...new Set(values.length ? values : fallback)];
  }

  function readPackageVersion() {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(appRoot, "package.json"), "utf8"));
      return String(pkg.version || "0.0.0");
    } catch (_) {
      return "0.0.0";
    }
  }

  function readServiceWorkerCacheName() {
    try {
      const source = fs.readFileSync(path.join(publicRoot, "sw.js"), "utf8");
      const match = source.match(/CACHE_NAME\s*=\s*["']([^"']+)["']/);
      return match ? String(match[1] || "") : "";
    } catch (_) {
      return "";
    }
  }

  function appShellBuildId(cacheName = readServiceWorkerCacheName()) {
    const appVersion = typeof dependencies.getAppVersion === "function"
      ? dependencies.getAppVersion()
      : dependencies.appVersion || readPackageVersion();
    const parts = [`app=${appVersion}`, `sw=${cacheName}`];
    for (const file of [
      "index.html",
      "styles.css",
      "api-client.js",
      "runtime-settings.js",
      "draft-store.js",
      "composer-runtime.js",
      "markdown-renderer.js",
      "viewport-metrics.js",
      "conversation-scroll.js",
      "image-compressor.js",
      "plugin-embed.js",
      "plugin-voice-input.js",
      "home-ai-diagnostic-reporting.js",
      "thread-diagnostic-events.js",
      "frontend-runtime-health.js",
      "build-refresh-policy.js",
      "thread-status-hints.js",
      "thread-performance-metrics.js",
      "thread-list-load-policy.js",
      "thread-list-stable-order.js",
      "thread-list-runtime.js",
      "client-render-stability-guard.js",
      "live-operation-dock-state.js",
      "thread-detail-state.js",
      "thread-detail-render-plan.js",
      "thread-detail-merge-state.js",
      "thread-detail-v4-merge-state.js",
      "thread-detail-runtime.js",
      "thread-detail-patch-plan.js",
      "thread-detail-dom-patch.js",
      "thread-detail-actions.js",
      "thread-tile-actions.js",
      "thread-tile-state.js",
      "thread-tile-layout.js",
      "thread-tile-runtime.js",
      "app-update-runtime.js",
      "side-chat-runtime.js",
      "media-preview-runtime.js",
      "app-bootstrap.js",
      "settings-runtime.js",
      "modal-runtime.js",
      "navigation-runtime.js",
      "api-client-runtime.js",
      "notification-ui-runtime.js",
      "pane-layout-runtime.js",
      "task-card-runtime.js",
      "conversation-render-runtime.js",
      "event-stream-runtime.js",
      "composer-bridge-runtime.js",
      "runtime-wiring-runtime.js",
      "app-shell-runtime.js",
      "app.js",
      "sw.js",
      "manifest.json",
    ]) {
      try {
        const stat = fs.statSync(path.join(publicRoot, file));
        parts.push(`${file}:${stat.size}:${Math.trunc(stat.mtimeMs)}`);
      } catch (_) {
        parts.push(`${file}:missing`);
      }
    }
    return crypto.createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 16);
  }

  function clientBuildId(cacheName = readServiceWorkerCacheName(), buildId = appShellBuildId(cacheName)) {
    const appVersion = typeof dependencies.getAppVersion === "function"
      ? dependencies.getAppVersion()
      : dependencies.appVersion || readPackageVersion();
    return `${appVersion}|${cacheName || buildId}`;
  }

  function currentPublicBuildConfig() {
    const shellCacheName = readServiceWorkerCacheName();
    const buildId = appShellBuildId(shellCacheName);
    return {
      buildId,
      clientBuildId: clientBuildId(shellCacheName, buildId),
      shellCacheName,
    };
  }

  function commandNeedsFilesystemCheck(command) {
    const value = String(command || "");
    return path.isAbsolute(value) || value.includes("/") || value.includes("\\");
  }

  function pathEntriesFromEnvPath(value) {
    return String(value || "")
      .split(path.delimiter)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  function executableCandidateNames(command) {
    const value = String(command || "").trim();
    if (!value) return [];
    if (commandNeedsFilesystemCheck(value) || process.platform !== "win32") return [value];
    const pathext = String(env.PATHEXT || ".EXE;.CMD;.BAT;.COM")
      .split(";")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);
    const lower = value.toLowerCase();
    if (pathext.some((ext) => lower.endsWith(ext))) return [value];
    return [value, ...pathext.map((ext) => `${value}${ext}`)];
  }

  function isExecutableFile(filePath) {
    try {
      fs.accessSync(filePath, fs.constants.X_OK);
      return true;
    } catch (_) {
      return process.platform === "win32" && fs.existsSync(filePath);
    }
  }

  function findExecutableInDirs(command, dirs) {
    const names = executableCandidateNames(command);
    for (const dir of dirs) {
      for (const name of names) {
        const candidate = path.join(dir, name);
        if (isExecutableFile(candidate)) return candidate;
      }
    }
    return "";
  }

  function commonCodexExecutableDirs() {
    const dirs = pathEntriesFromEnvPath(env.PATH);
    if (process.platform !== "win32") {
      dirs.push(
        "/opt/homebrew/bin",
        "/usr/local/bin",
        "/opt/local/bin",
        "/usr/bin",
        path.join(userHome, ".local", "bin"),
        path.join(userHome, ".npm-global", "bin"),
        path.join(userHome, ".yarn", "bin"),
        path.join(userHome, ".bun", "bin"),
        path.join(userHome, ".cargo", "bin"),
        path.join(userHome, "Library", "pnpm"),
      );
    }
    return Array.from(new Set(dirs));
  }

  function resolveDefaultCodexExecutable() {
    const explicit = String(env.CODEX_MOBILE_CODEX_EXE || "").trim();
    if (explicit) return explicit;
    return findExecutableInDirs("codex", commonCodexExecutableDirs()) || "codex";
  }

  function assertCommandAvailable(command, label) {
    const value = String(command || "").trim();
    if (!value) throw new Error(`${label} is not configured`);
    if (commandNeedsFilesystemCheck(value) && !isExecutableFile(value)) {
      throw new Error(`${label} not found: ${value}`);
    }
    if (!commandNeedsFilesystemCheck(value) && !findExecutableInDirs(value, pathEntriesFromEnvPath(env.PATH))) {
      throw new Error(`${label} not found on PATH: ${value}`);
    }
  }

  function codexAppServerChildEnv(extra = {}) {
    const out = Object.assign({}, env);
    for (const key of Object.keys(out)) {
      if (key === "CODEX_CLI_PATH" || key.startsWith("CODEX_MUX_")) {
        delete out[key];
      }
    }
    const codexHome = getCodexHome();
    if (codexHome) out.CODEX_HOME = codexHome;
    Object.assign(out, extra);
    return out;
  }

  return {
    appShellBuildId,
    assertCommandAvailable,
    clientBuildId,
    codexAppServerChildEnv,
    commandNeedsFilesystemCheck,
    commonCodexExecutableDirs,
    currentPublicBuildConfig,
    defaultMuxEndpointFileForCodexHome,
    detectDevelopmentWorkspaceRoot,
    executableCandidateNames,
    findExecutableInDirs,
    isExecutableFile,
    normalizePathForEarlyCompare,
    optionListFromEnv,
    pathEntriesFromEnvPath,
    readPackageVersion,
    readServiceWorkerCacheName,
    resolveDefaultCodexExecutable,
    resolveMuxEndpointFile,
    sameEarlyFsPath,
    uniqueStrings,
  };
}

module.exports = {
  createServerRuntimeUtils,
};
