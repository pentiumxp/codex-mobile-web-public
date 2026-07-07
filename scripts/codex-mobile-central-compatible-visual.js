#!/usr/bin/env node
"use strict";

const http = require("node:http");
const https = require("node:https");
const fs = require("node:fs");

const DEFAULT_BASE_URL = "http://127.0.0.1:8797";
const DEFAULT_PLUGIN_SERVER = "http://127.0.0.1:8787";
const DEFAULT_VIEWPORT = "390x844";
const SUPPORTED_SCENARIOS = new Set(["embedded-plugin-shell", "browser-mobile"]);

function usage() {
  return [
    "Usage:",
    "  node scripts/codex-mobile-central-compatible-visual.js --scenario embedded-plugin-shell --plugin-id codex-mobile --json",
    "",
    "Produces central-compatible, metadata-only plugin-local visual evidence for Home AI visual:central --delegate-local.",
    "",
    "Options:",
    "  --scenario <name>       Scenario requested by the central visual broker.",
    "  --plugin-id <id>        Expected plugin id. Must be codex-mobile.",
    "  --surface <name>        Surface label. Default: embedded-plugin.",
    "  --base-url <url>        Home AI base URL. Default: http://127.0.0.1:8797.",
    "  --plugin-server <url>   Codex Mobile local server. Default: http://127.0.0.1:8787.",
    "  --workspace-id <id>     Workspace label. Default: owner.",
    "  --viewport <WxH>        Viewport label. Default: 390x844.",
    "  --timeout-ms <n>        HTTP probe timeout. Default: 5000.",
    "  --json                  Print JSON.",
  ].join("\n");
}

function parseArgs(argv = process.argv.slice(2), env = process.env) {
  const options = {
    scenario: "",
    pluginId: "",
    surface: "embedded-plugin",
    baseUrl: env.HOMEAI_CENTRAL_VISUAL_BASE_URL || DEFAULT_BASE_URL,
    pluginServer: env.CODEX_MOBILE_VISUAL_PLUGIN_SERVER || env.CODEX_MOBILE_BASE_URL || DEFAULT_PLUGIN_SERVER,
    workspaceId: env.HOMEAI_CENTRAL_VISUAL_WORKSPACE_ID || "owner",
    viewport: env.HOMEAI_CENTRAL_VISUAL_VIEWPORT || DEFAULT_VIEWPORT,
    accessKeyPath: "",
    timeoutMs: 5000,
    json: false,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`missing value for ${arg}`);
      return argv[index];
    };
    if (arg === "--scenario") options.scenario = normalizeToken(next());
    else if (arg === "--plugin-id") options.pluginId = normalizePluginId(next());
    else if (arg === "--surface") options.surface = normalizeToken(next()) || options.surface;
    else if (arg === "--base-url") options.baseUrl = next();
    else if (arg === "--plugin-server") options.pluginServer = next();
    else if (arg === "--workspace-id") options.workspaceId = String(next() || "owner").slice(0, 80);
    else if (arg === "--viewport") options.viewport = String(next() || DEFAULT_VIEWPORT).slice(0, 40);
    else if (arg === "--timeout-ms") options.timeoutMs = Math.max(1000, Number(next()) || options.timeoutMs);
    else if (arg === "--access-key-path") options.accessKeyPath = next();
    else if (arg === "--json") options.json = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`unknown_arg:${arg}`);
  }
  if (!options.scenario) options.scenario = "embedded-plugin-shell";
  if (!options.pluginId) options.pluginId = "codex-mobile";
  return options;
}

function normalizeToken(value) {
  return String(value || "").trim().toLowerCase().replace(/_/g, "-").slice(0, 120);
}

function normalizePluginId(value) {
  return normalizeToken(value);
}

function originLabel(value) {
  try {
    const url = new URL(String(value || DEFAULT_BASE_URL));
    return `${url.protocol}//${url.host}`;
  } catch (_) {
    return "invalid-origin";
  }
}

function normalizeServer(value) {
  const url = new URL(String(value || DEFAULT_PLUGIN_SERVER));
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("plugin_server_must_be_http");
  return url.href.replace(/\/+$/, "");
}

function readAccessKey(options) {
  if (!options.accessKeyPath) return "";
  try {
    return fs.readFileSync(options.accessKeyPath, "utf8").trim();
  } catch (_) {
    return "";
  }
}

function fetchJson(url, timeoutMs = 5000, headers = {}) {
  const parsed = new URL(url);
  const transport = parsed.protocol === "https:" ? https : http;
  return new Promise((resolve) => {
    const req = transport.get(parsed, { timeout: timeoutMs, headers }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        let body = null;
        try {
          body = JSON.parse(text);
        } catch (_) {}
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode || 0, body });
      });
    });
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, status: 0, errorCode: "http_timeout" });
    });
    req.on("error", (err) => {
      resolve({ ok: false, status: 0, errorCode: String(err && err.code || "http_error").slice(0, 80) });
    });
  });
}

function assertion(name, pass, evidence = {}) {
  return Object.assign({ name, pass: Boolean(pass) }, evidence);
}

async function buildEvidence(options) {
  const assertions = [];
  const issueCodes = [];
  const pluginIdOk = options.pluginId === "codex-mobile";
  const scenarioOk = SUPPORTED_SCENARIOS.has(options.scenario);
  assertions.push(assertion("plugin-id-codex-mobile", pluginIdOk, { pluginId: options.pluginId }));
  assertions.push(assertion("scenario-supported", scenarioOk, { scenario: options.scenario }));
  if (!pluginIdOk) issueCodes.push("plugin_id_mismatch");
  if (!scenarioOk) issueCodes.push("unsupported_visual_scenario");

  let publicConfig = { ok: false, status: 0, body: null };
  let viteArtifact = { ok: false, status: 0, body: null };
  const accessKey = readAccessKey(options);
  const headers = accessKey ? { Authorization: `Bearer ${accessKey}` } : {};
  try {
    const server = normalizeServer(options.pluginServer);
    publicConfig = await fetchJson(`${server}/api/public-config`, options.timeoutMs, headers);
    viteArtifact = await fetchJson(`${server}/api/vite-shell-artifact`, options.timeoutMs, headers);
  } catch (err) {
    issueCodes.push(String(err && err.message || "plugin_server_invalid").slice(0, 120));
  }

  const configBody = publicConfig.body || {};
  const artifactBody = viteArtifact.body || {};
  assertions.push(assertion("plugin-public-config-http-200", publicConfig.ok, { statusCode: publicConfig.status }));
  const artifactAuthRequired = viteArtifact.status === 401 && !accessKey;
  assertions.push(assertion("plugin-vite-artifact-ok-or-auth-required", artifactAuthRequired || (viteArtifact.ok && artifactBody.ok !== false), {
    statusCode: viteArtifact.status,
    authRequired: artifactAuthRequired,
    publishedFileCount: Number(artifactBody.publishedFileCount || artifactBody.publishedFiles?.length || 0),
  }));
  assertions.push(assertion("plugin-default-shell-app-preview", configBody.defaultShellMode === "vite-app-preview", {
    defaultShellMode: String(configBody.defaultShellMode || "").slice(0, 80),
  }));
  assertions.push(assertion("plugin-client-build-present", Boolean(configBody.clientBuildId || configBody.shellCacheName), {
    clientVersion: String(configBody.clientBuildId || configBody.shellCacheName || "").slice(0, 120),
  }));

  if (!publicConfig.ok) issueCodes.push("plugin_public_config_unavailable");
  if (!artifactAuthRequired && (!viteArtifact.ok || artifactBody.ok === false)) issueCodes.push("plugin_vite_artifact_unavailable");
  if (configBody.defaultShellMode !== "vite-app-preview") issueCodes.push("plugin_default_shell_not_app_preview");
  if (!configBody.clientBuildId && !configBody.shellCacheName) issueCodes.push("plugin_client_build_missing");

  const failed = assertions.filter((item) => item.pass === false);
  return {
    ok: failed.length === 0,
    status: failed.length === 0 ? "plugin_local_visual_evidence_ready" : "plugin_local_visual_evidence_failed",
    schemaVersion: "codex-mobile-plugin-visual/v1",
    pluginId: options.pluginId,
    scenario: options.scenario,
    surface: options.surface || "embedded-plugin",
    harnessKind: "codex-mobile-plugin-local-compatible",
    mode: "metadata-probe",
    viewport: options.viewport,
    workspaceId: options.workspaceId,
    baseUrlOrigin: originLabel(options.baseUrl),
    originLabel: originLabel(options.baseUrl),
    clientVersion: String(configBody.clientBuildId || configBody.shellCacheName || "").slice(0, 120),
    issueCodes: Array.from(new Set(issueCodes)).slice(0, 20),
    assertions,
    assertionCount: assertions.length,
    passedCount: assertions.length - failed.length,
    failedCount: failed.length,
    screenshotPresent: false,
    artifactCount: 0,
  };
}

async function main() {
  const options = parseArgs();
  if (options.help) {
    console.log(usage());
    return;
  }
  const evidence = await buildEvidence(options);
  console.log(JSON.stringify(evidence, null, 2));
  if (!evidence.ok) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((err) => {
    console.error(JSON.stringify({ ok: false, status: "failed", error: String(err && err.message || err).slice(0, 300) }, null, 2));
    process.exitCode = 1;
  });
}

module.exports = {
  parseArgs,
  buildEvidence,
  fetchJson,
  normalizeServer,
  originLabel,
};
