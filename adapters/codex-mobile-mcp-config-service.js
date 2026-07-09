"use strict";

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_SERVER_NAME = "codex_mobile";
const CODEX_MOBILE_MCP_TOOL_NAMES = [
  "list_threads",
  "delegate_to_thread",
  "start_loop",
  "loop_status",
  "thread_lifecycle",
  "return_to_source",
  "task_card_heartbeat",
  "rmw_list_workspaces",
  "rmw_dispatch_task_card",
  "rmw_read_task_card",
];

function tomlBasicString(value) {
  return JSON.stringify(String(value || ""));
}

function tomlArray(values) {
  return `[${(values || []).map(tomlBasicString).join(", ")}]`;
}

function normalizeBaseUrl(value) {
  const raw = String(value || "").trim().replace(/\/+$/, "");
  if (!raw) throw new Error("codex_mobile_mcp_base_url_required");
  const parsed = new URL(raw);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("codex_mobile_mcp_base_url_invalid");
  }
  return parsed.origin;
}

function configSectionHeader(serverName = DEFAULT_SERVER_NAME) {
  return `[mcp_servers.${serverName}]`;
}

function toolSectionHeader(serverName = DEFAULT_SERVER_NAME, toolName = "") {
  return `[mcp_servers.${serverName}.tools.${toolName}]`;
}

function hasMcpServerSection(text, serverName = DEFAULT_SERVER_NAME) {
  const escaped = String(serverName || DEFAULT_SERVER_NAME).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^\\s*\\[mcp_servers\\.${escaped}\\]\\s*$`, "m").test(String(text || ""));
}

function mcpServerSectionRange(text, serverName = DEFAULT_SERVER_NAME) {
  const source = String(text || "");
  const escaped = String(serverName || DEFAULT_SERVER_NAME).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^\\s*\\[mcp_servers\\.${escaped}\\]\\s*$`, "m");
  const match = re.exec(source);
  if (!match) return null;
  const start = match.index;
  const ownHeader = `mcp_servers.${serverName || DEFAULT_SERVER_NAME}`;
  const headerRe = /^\s*\[([^\]]+)\]\s*$/gm;
  headerRe.lastIndex = start + match[0].length;
  let end = source.length;
  let next;
  while ((next = headerRe.exec(source))) {
    const headerName = String(next[1] || "").trim();
    if (headerName === ownHeader || headerName.startsWith(`${ownHeader}.`)) continue;
    end = next.index;
    break;
  }
  return { start, end };
}

function buildCodexMobileMcpSection(options = {}) {
  const serverName = String(options.serverName || DEFAULT_SERVER_NAME).trim() || DEFAULT_SERVER_NAME;
  const command = String(options.command || process.execPath || "node").trim();
  const rawScriptPath = String(options.scriptPath || "").trim();
  if (!rawScriptPath) throw new Error("codex_mobile_mcp_script_path_required");
  const scriptPath = path.resolve(rawScriptPath);
  const baseUrl = normalizeBaseUrl(options.baseUrl || "http://127.0.0.1:8787");
  const keyFile = String(options.keyFile || "").trim();
  const args = [scriptPath, "--server", baseUrl];
  if (keyFile) args.push("--key-file", keyFile);
  const lines = [
    configSectionHeader(serverName),
    `command = ${tomlBasicString(command)}`,
    `args = ${tomlArray(args)}`,
    "",
  ];
  for (const toolName of CODEX_MOBILE_MCP_TOOL_NAMES) {
    lines.push(
      toolSectionHeader(serverName, toolName),
      `approval_mode = ${tomlBasicString("approve")}`,
      "",
    );
  }
  return lines.join("\n");
}

function ensureCodexMobileMcpServerInConfig(configPath, options = {}) {
  const serverName = String(options.serverName || DEFAULT_SERVER_NAME).trim() || DEFAULT_SERVER_NAME;
  let text = "";
  try {
    text = fs.readFileSync(configPath, "utf8");
  } catch (err) {
    if (!err || err.code !== "ENOENT") throw err;
  }
  const section = buildCodexMobileMcpSection(Object.assign({}, options, { serverName }));
  const range = mcpServerSectionRange(text, serverName);
  let next;
  let added = false;
  if (range) {
    const current = text.slice(range.start, range.end).trim();
    if (current === section.trim()) {
      return { changed: false, added: false, serverName, configPath };
    }
    next = `${text.slice(0, range.start).trimEnd()}${text.slice(0, range.start).trimEnd() ? "\n\n" : ""}${section.trimEnd()}\n${text.slice(range.end).replace(/^\n+/, "")}`;
  } else {
    added = true;
    next = `${String(text || "").trimEnd()}${String(text || "").trimEnd() ? "\n\n" : ""}${section}`;
  }
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  const tmp = `${configPath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, next, { encoding: "utf8", mode: 0o600 });
  fs.renameSync(tmp, configPath);
  return { changed: true, added, serverName, configPath };
}

function ensureCodexMobileMcpServer(options = {}) {
  const codexHome = String(options.codexHome || "").trim();
  if (!codexHome) return { changed: false, added: false, serverName: DEFAULT_SERVER_NAME, configPath: "" };
  return ensureCodexMobileMcpServerInConfig(path.join(codexHome, "config.toml"), options);
}

module.exports = {
  CODEX_MOBILE_MCP_TOOL_NAMES,
  DEFAULT_SERVER_NAME,
  buildCodexMobileMcpSection,
  ensureCodexMobileMcpServer,
  ensureCodexMobileMcpServerInConfig,
  hasMcpServerSection,
  mcpServerSectionRange,
};
