"use strict";

const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const DEFAULT_TOP_LIMIT = 12;
const DEFAULT_LAUNCHD_LABEL = "system/com.hermesmobile.plugin.codex-mobile";

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

function elapsedSeconds(value = "") {
  const text = String(value || "").trim();
  const match = text.match(/^(?:(\d+)-)?(?:(\d+):)?(\d+):(\d+)$/);
  if (!match) return 0;
  const days = positiveInt(match[1], 0);
  const hours = positiveInt(match[2], 0);
  const minutes = positiveInt(match[3], 0);
  const seconds = positiveInt(match[4], 0);
  return (((days * 24) + hours) * 60 + minutes) * 60 + seconds;
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

function parseLaunchdServiceReadback(text = "", label = DEFAULT_LAUNCHD_LABEL) {
  const source = String(text || "");
  const stateMatch = source.match(/\n\s*state = ([^\n]+)/);
  const activeCountMatch = source.match(/\n\s*active count = (\d+)/);
  const pidMatch = source.match(/\n\s*pid = (\d+)/);
  const usernameMatch = source.match(/\n\s*username = ([^\n]+)/);
  const workingDirectoryMatch = source.match(/\n\s*working directory = ([^\n]+)/);
  const defaultShellModeMatch = source.match(/\n\s*CODEX_MOBILE_DEFAULT_SHELL => ([^\n]+)/);
  const found = Boolean(stateMatch || activeCountMatch || pidMatch || usernameMatch || workingDirectoryMatch);
  return {
    found,
    label: String(label || "").slice(0, 120),
    state: stateMatch ? String(stateMatch[1] || "").trim().slice(0, 80) : "",
    activeCount: activeCountMatch ? positiveInt(activeCountMatch[1], 0) : 0,
    pid: pidMatch ? positiveInt(pidMatch[1], 0) : 0,
    username: usernameMatch ? String(usernameMatch[1] || "").trim().slice(0, 64) : "",
    workingDirectory: workingDirectoryMatch ? String(workingDirectoryMatch[1] || "").trim().slice(0, 240) : "",
    defaultShellMode: defaultShellModeMatch ? String(defaultShellModeMatch[1] || "").trim().slice(0, 80) : "",
  };
}

function readLaunchdService(options = {}, deps = {}) {
  const execFileSync = deps.execFileSync || childProcess.execFileSync;
  const label = String(
    options.launchdLabel
    || process.env.CODEX_MOBILE_PROCESS_PRESSURE_LAUNCHD_LABEL
    || DEFAULT_LAUNCHD_LABEL,
  ).trim();
  if (!label) return null;
  try {
    const text = execFileSync("launchctl", ["print", label], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const parsed = parseLaunchdServiceReadback(text, label);
    return parsed.found ? parsed : null;
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

function classifyAppServerChildProcess(process = {}) {
  const command = process.command || "";
  if (/codex-mobile-mcp-server\.js/.test(command)) return "codex-mobile-mcp";
  if (/codegraph(?:\.js)?\s+serve\s+--mcp|codegraph-darwin-arm64/.test(command)) return "codegraph-mcp";
  if (/SkyComputerUseClient.*\bmcp\b/.test(command)) return "computer-use-mcp";
  if (/node_repl\b/.test(command)) return "node-repl";
  if (/\bdns-sd\b/.test(command)) return "dns-sd";
  if (/\/bin\/(?:zsh|bash|sh)\s+-c\b|(?:^|\s)find\s+/.test(command)) return "shell-command";
  return "other-child";
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

function normalizedPath(value = "") {
  const text = String(value || "").trim();
  if (!text) return "";
  return path.normalize(text).replace(/\/+$/, "");
}

function pathMatchesOrContains(actual = "", expected = "") {
  const actualPath = normalizedPath(actual);
  const expectedPath = normalizedPath(expected);
  if (!actualPath || !expectedPath) return false;
  return actualPath === expectedPath || actualPath.startsWith(`${expectedPath}${path.sep}`);
}

function productionListenerOwnershipIssues(processes = [], options = {}) {
  const launchdService = options.launchdService || null;
  const expectedUser = String(options.productionListenerUser || process.env.CODEX_MOBILE_EXPECTED_PRODUCTION_LISTENER_USER || "").trim();
  const expectedCwd = String(options.productionListenerCwd || process.env.CODEX_MOBILE_EXPECTED_PRODUCTION_LISTENER_CWD || "").trim();
  const listenerProcesses = (processes || []).filter((row) => row && row.kind === "production-server");
  const issues = [];
  if (listenerProcesses.length > 1) {
    issues.push({
      severity: "H2",
      code: "production_listener_duplicate",
      surface: "runtime-process-pressure",
      category: "production_listener_ownership",
      diagnostic_type: "production_listener_duplicate",
      count: listenerProcesses.length,
    });
  }
  if (launchdService && launchdService.found && launchdService.state === "running") {
    if (!listenerProcesses.length) {
      issues.push({
        severity: "H2",
        code: "production_listener_missing",
        surface: "runtime-process-pressure",
        category: "production_listener_ownership",
        diagnostic_type: "production_listener_missing",
        count: 1,
        expectedPid: launchdService.pid,
        expectedUser: launchdService.username,
        expectedCwd: launchdService.workingDirectory,
      });
    }
    const matchingPid = listenerProcesses.find((listener) => listener.pid === launchdService.pid);
    if (launchdService.pid && listenerProcesses.length && !matchingPid) {
      issues.push({
        severity: "H2",
        code: "production_listener_launchd_pid_mismatch",
        surface: "runtime-process-pressure",
        category: "production_listener_ownership",
        diagnostic_type: "production_listener_launchd_pid_mismatch",
        count: 1,
        expectedPid: launchdService.pid,
        listenerPids: listenerProcesses.map((listener) => listener.pid).slice(0, 8),
      });
    }
    for (const listener of matchingPid ? [matchingPid] : []) {
      if (launchdService.username && String(listener.user || "") !== launchdService.username) {
        issues.push({
          severity: "H2",
          code: "production_listener_owner_mismatch",
          surface: "runtime-process-pressure",
          category: "production_listener_ownership",
          diagnostic_type: "production_listener_owner_mismatch",
          count: 1,
          listenerPid: listener.pid,
          listenerUser: String(listener.user || "").slice(0, 64),
          expectedUser: launchdService.username,
        });
      }
      if (launchdService.workingDirectory && !pathMatchesOrContains(listener.cwd, launchdService.workingDirectory)) {
        issues.push({
          severity: "H2",
          code: "production_listener_cwd_mismatch",
          surface: "runtime-process-pressure",
          category: "production_listener_ownership",
          diagnostic_type: "production_listener_cwd_mismatch",
          count: 1,
          listenerPid: listener.pid,
          listenerCwd: String(listener.cwd || "").slice(0, 240),
          expectedCwd: launchdService.workingDirectory,
        });
      }
    }
    return issues;
  }
  if (!expectedUser && !expectedCwd) return issues;
  for (const listener of listenerProcesses) {
    if (expectedCwd && !pathMatchesOrContains(listener.cwd, expectedCwd)) continue;
    if (expectedUser && String(listener.user || "") === expectedUser) continue;
    issues.push({
      severity: "H2",
      code: "production_listener_owner_mismatch",
      surface: "runtime-process-pressure",
      category: "production_listener_ownership",
      diagnostic_type: "production_listener_owner_mismatch",
      count: 1,
      listenerPid: listener.pid,
      listenerUser: String(listener.user || "").slice(0, 64),
      listenerCwd: String(listener.cwd || "").slice(0, 240),
      expectedUser: expectedUser.slice(0, 64) || "",
      expectedCwd: expectedCwd.slice(0, 240),
    });
  }
  return issues;
}

function summarizeAppServerChildren(processes = [], options = {}) {
  const topLimit = Math.max(1, Math.min(50, positiveInt(options.topLimit, DEFAULT_TOP_LIMIT)));
  const groups = new Map();
  for (const process of processes) {
    const kind = process.childKind || classifyAppServerChildProcess(process);
    if (!groups.has(kind)) {
      groups.set(kind, {
        kind,
        count: 0,
        cpuPercent: 0,
        rssMb: 0,
        maxElapsedSeconds: 0,
        maxElapsed: "",
      });
    }
    const group = groups.get(kind);
    group.count += 1;
    group.cpuPercent += process.cpuPercent || 0;
    group.rssMb += process.rssMb || 0;
    const seconds = elapsedSeconds(process.elapsed);
    if (seconds > group.maxElapsedSeconds) {
      group.maxElapsedSeconds = seconds;
      group.maxElapsed = process.elapsed || "";
    }
  }
  const groupRows = Array.from(groups.values())
    .map((group) => ({
      kind: group.kind,
      count: group.count,
      cpuPercent: Number(group.cpuPercent.toFixed(1)),
      rssMb: group.rssMb,
      maxElapsed: group.maxElapsed,
    }))
    .sort((a, b) => (b.count - a.count) || (b.rssMb - a.rssMb));
  const topProcesses = processes
    .slice()
    .sort((a, b) => (elapsedSeconds(b.elapsed) - elapsedSeconds(a.elapsed)) || (b.rssMb - a.rssMb))
    .slice(0, topLimit)
    .map((process) => boundedProcess(Object.assign({}, process, { kind: process.childKind || classifyAppServerChildProcess(process) })));
  return {
    count: processes.length,
    cpuPercent: Number(processes.reduce((total, process) => total + (process.cpuPercent || 0), 0).toFixed(1)),
    rssMb: processes.reduce((total, process) => total + (process.rssMb || 0), 0),
    groups: groupRows,
    topProcesses,
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
  const appServerChildren = Array.isArray(options.appServerChildren) ? options.appServerChildren : [];
  const appServerChildSummary = summarizeAppServerChildren(appServerChildren, { topLimit });
  const topProcesses = processes
    .filter((process) => process.kind !== "other")
    .sort((a, b) => (b.cpuPercent - a.cpuPercent) || (b.rssMb - a.rssMb))
    .slice(0, topLimit)
    .map(boundedProcess);
  const launchdService = options.launchdService || null;
  const issues = productionListenerOwnershipIssues(processes, Object.assign({}, options, { launchdService }));
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
    launchdService,
    issueCount: issues.length,
    blockingIssueCount: issues.filter((issue) => issue.severity === "H1" || issue.severity === "H2").length,
    issues,
    appServerChildProcessCount: appServerChildSummary.count,
    appServerChildCpuPercent: appServerChildSummary.cpuPercent,
    appServerChildRssMb: appServerChildSummary.rssMb,
    appServerChildGroups: appServerChildSummary.groups,
    appServerChildTopProcesses: appServerChildSummary.topProcesses,
    groups: groupRows,
    topProcesses,
  };
}

function collectRuntimeProcessPressure(options = {}, deps = {}) {
  const execFileSync = deps.execFileSync || childProcess.execFileSync;
  const encoding = { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] };
  const muxEndpoint = readMuxEndpoint(options.muxEndpointPath, deps);
  const launchdService = readLaunchdService(options, deps);
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
  const allRows = parsePsRows(psText);
  const rows = allRows
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
  const appServerPids = new Set(classified
    .filter((process) => /codex-app-server$/.test(process.kind))
    .map((process) => process.pid));
  const appServerChildren = allRows
    .filter((process) => appServerPids.has(process.ppid))
    .map((process) => ({
      ...process,
      childKind: classifyAppServerChildProcess(process),
    }));
  const summary = summarizeProcessPressure(classified, Object.assign({}, options, { appServerChildren, launchdService }));
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
  classifyAppServerChildProcess,
  collectRuntimeProcessPressure,
  elapsedSeconds,
  parseCwdFromLsofFn,
  parseLaunchdServiceReadback,
  parseLsofListeners,
  parsePsRows,
  productionListenerOwnershipIssues,
  redactCommand,
  readLaunchdService,
  readMuxEndpoint,
  summarizeProcessPressure,
};
