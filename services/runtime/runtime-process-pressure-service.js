"use strict";

const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const DEFAULT_TOP_LIMIT = 12;

function positiveNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function positiveInt(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.trunc(number) : fallback;
}

function rssMbFromKb(value) {
  return Math.round(positiveInt(value, 0) / 1024);
}

function redactCommand(command) {
  return String(command || "")
    .replace(/--key-file\s+\S+/gi, "--key-file <redacted>")
    .replace(/(Authorization:\s*Bearer\s+)[^\s]+/gi, "$1<redacted>")
    .replace(/(access[_-]?key=)[^\s&]+/gi, "$1<redacted>")
    .slice(0, 240);
}

function parsePsRows(text = "") {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return null;
      const match = trimmed.match(/^(\d+)\s+(\d+)\s+(\S+)\s+([0-9.]+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(.+)$/);
      if (!match) return null;
      return {
        pid: positiveInt(match[1]),
        ppid: positiveInt(match[2]),
        user: String(match[3] || "").slice(0, 64),
        cpuPercent: positiveNumber(match[4]),
        rssMb: rssMbFromKb(match[5]),
        elapsed: String(match[6] || "").slice(0, 32),
        stat: String(match[7] || "").slice(0, 16),
        command: redactCommand(match[8]),
      };
    })
    .filter(Boolean);
}

function parseLsofListeners(text = "") {
  const listeners = new Map();
  for (const line of String(text || "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || /^COMMAND\s+PID\s+/i.test(trimmed)) continue;
    const parts = trimmed.split(/\s+/);
    if (parts.length < 9) continue;
    const pid = positiveInt(parts[1], 0);
    const name = parts.slice(8).join(" ");
    if (!pid || !name) continue;
    if (!listeners.has(pid)) listeners.set(pid, []);
    listeners.get(pid).push(name.slice(0, 120));
  }
  return listeners;
}

function parseCwdFromLsofFn(text = "") {
  const line = String(text || "")
    .split(/\r?\n/)
    .find((value) => value.startsWith("n"));
  return line ? line.slice(1, 240) : "";
}

function defaultMuxEndpointPath() {
  return path.join(os.homedir(), ".codex", "app-server-mux", "endpoint.json");
}

function readMuxEndpoint(filePath = defaultMuxEndpointPath(), deps = {}) {
  const readFileSync = deps.readFileSync || fs.readFileSync;
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8"));
    return {
      pid: positiveInt(parsed.pid, 0),
      host: String(parsed.host || "").slice(0, 80),
      port: positiveInt(parsed.port, 0),
      protocol: String(parsed.protocol || "").slice(0, 80),
    };
  } catch (_) {
    return null;
  }
}

function classifyProcess(process = {}, context = {}) {
  const command = process.command || "";
  const cwd = process.cwd || "";
  const listeners = Array.isArray(process.listeners) ? process.listeners.join(" ") : "";
  const activeMuxPid = positiveInt(context.activeMuxPid, 0);
  if (/codex-mobile-web-combined-hotfix/.test(cwd) || /codex-mobile-web-combined-hotfix/.test(command)) {
    return "stale-hotfix-server";
  }
  if (/node\s+server\.js/.test(command) && /127\.0\.0\.1:8788/.test(listeners)) {
    return "stale-hotfix-server";
  }
  if (/node\s+server\.js/.test(command) && /127\.0\.0\.1:8787/.test(listeners)) {
    return "production-server";
  }
  if (/codex-app-server-mux\.js/.test(command)) {
    return activeMuxPid && process.pid === activeMuxPid ? "active-app-server-mux" : "stale-app-server-mux";
  }
  if (/\bcodex\s+app-server\b/.test(command)) {
    return activeMuxPid && process.ppid === activeMuxPid ? "active-codex-app-server" : "stale-codex-app-server";
  }
  if (/codex-mobile-browser-self-check/.test(command)) return "browser-self-check";
  if (/codex-mobile-mcp-server\.js/.test(command)) return "mcp-server";
  if (/mds_stores|mdworker_shared/.test(command)) return "spotlight";
  if (/codex-mobile-web/.test(command) || /codex-mobile-web/.test(cwd)) return "codex-mobile-other";
  return "other";
}

function boundedProcess(process = {}) {
  return {
    pid: process.pid,
    ppid: process.ppid,
    user: process.user,
    kind: process.kind,
    cpuPercent: Number(process.cpuPercent.toFixed(1)),
    rssMb: process.rssMb,
    elapsed: process.elapsed,
    stat: process.stat,
    cwd: process.cwd || "",
    listeners: Array.isArray(process.listeners) ? process.listeners.slice(0, 4) : [],
    command: process.command,
  };
}

function summarizeProcessPressure(processes = [], options = {}) {
  const topLimit = Math.max(1, Math.min(50, positiveInt(options.topLimit, DEFAULT_TOP_LIMIT)));
  const codexKinds = new Set([
    "production-server",
    "stale-hotfix-server",
    "active-app-server-mux",
    "stale-app-server-mux",
    "active-codex-app-server",
    "stale-codex-app-server",
    "browser-self-check",
    "mcp-server",
    "codex-mobile-other",
  ]);
  const groups = new Map();
  for (const process of processes) {
    const kind = process.kind || classifyProcess(process);
    if (!groups.has(kind)) {
      groups.set(kind, {
        kind,
        count: 0,
        cpuPercent: 0,
        rssMb: 0,
      });
    }
    const group = groups.get(kind);
    group.count += 1;
    group.cpuPercent += process.cpuPercent || 0;
    group.rssMb += process.rssMb || 0;
  }
  const groupRows = Array.from(groups.values())
    .map((group) => ({
      ...group,
      cpuPercent: Number(group.cpuPercent.toFixed(1)),
    }))
    .sort((a, b) => (b.cpuPercent - a.cpuPercent) || (b.rssMb - a.rssMb));
  const codexProcesses = processes.filter((process) => codexKinds.has(process.kind));
  const topProcesses = processes
    .filter((process) => process.kind !== "other")
    .sort((a, b) => (b.cpuPercent - a.cpuPercent) || (b.rssMb - a.rssMb))
    .slice(0, topLimit)
    .map(boundedProcess);
  return {
    privacy: "metadata_only",
    sampledAt: new Date().toISOString(),
    processCount: processes.length,
    codexOwnedProcessCount: codexProcesses.length,
    codexOwnedCpuPercent: Number(codexProcesses.reduce((total, process) => total + (process.cpuPercent || 0), 0).toFixed(1)),
    codexOwnedRssMb: codexProcesses.reduce((total, process) => total + (process.rssMb || 0), 0),
    staleHotfixServerCount: processes.filter((process) => process.kind === "stale-hotfix-server").length,
    browserSelfCheckProcessCount: processes.filter((process) => process.kind === "browser-self-check").length,
    productionServerCount: processes.filter((process) => process.kind === "production-server").length,
    codexAppServerCount: processes.filter((process) => /codex-app-server$/.test(process.kind)).length,
    activeCodexAppServerCount: processes.filter((process) => process.kind === "active-codex-app-server").length,
    staleCodexAppServerCount: processes.filter((process) => process.kind === "stale-codex-app-server").length,
    activeAppServerMuxCount: processes.filter((process) => process.kind === "active-app-server-mux").length,
    staleAppServerMuxCount: processes.filter((process) => process.kind === "stale-app-server-mux").length,
    groups: groupRows,
    topProcesses,
  };
}

function collectRuntimeProcessPressure(options = {}, deps = {}) {
  const execFileSync = deps.execFileSync || childProcess.execFileSync;
  const encoding = { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] };
  const muxEndpoint = readMuxEndpoint(options.muxEndpointPath, deps);
  let psText = "";
  let lsofText = "";
  try {
    psText = execFileSync("ps", ["-axo", "pid=,ppid=,user=,%cpu=,rss=,etime=,stat=,command="], encoding);
  } catch (_) {
    psText = "";
  }
  try {
    lsofText = execFileSync("lsof", ["-Pan", "-iTCP", "-sTCP:LISTEN"], encoding);
  } catch (_) {
    lsofText = "";
  }
  const listenersByPid = parseLsofListeners(lsofText);
  const rows = parsePsRows(psText)
    .filter((process) => /codex-mobile-web|codex app-server|\bnode\s+server\.js\b|codex-mobile-browser-self-check|mds_stores|mdworker_shared/.test(process.command))
    .map((process) => ({
      ...process,
      listeners: listenersByPid.get(process.pid) || [],
    }));
  const cwdCandidates = rows.filter((process) => (
    /server\.js|codex-app-server-mux|codex app-server/.test(process.command)
    || (process.listeners && process.listeners.length)
  ));
  for (const process of cwdCandidates) {
    try {
      process.cwd = parseCwdFromLsofFn(execFileSync("lsof", ["-a", "-p", String(process.pid), "-d", "cwd", "-Fn"], encoding));
    } catch (_) {
      process.cwd = "";
    }
  }
  const classified = rows.map((process) => ({
    ...process,
    kind: classifyProcess(process, { activeMuxPid: muxEndpoint && muxEndpoint.pid }),
  }));
  const summary = summarizeProcessPressure(classified, options);
  summary.activeMuxEndpoint = muxEndpoint ? {
    pid: muxEndpoint.pid,
    host: muxEndpoint.host,
    port: muxEndpoint.port,
    protocol: muxEndpoint.protocol,
  } : null;
  return summary;
}

module.exports = {
  classifyProcess,
  collectRuntimeProcessPressure,
  parseCwdFromLsofFn,
  parseLsofListeners,
  parsePsRows,
  redactCommand,
  readMuxEndpoint,
  summarizeProcessPressure,
};
