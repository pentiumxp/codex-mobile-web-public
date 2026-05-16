"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

let cachedSqliteCommand = "";

function isPathLike(value) {
  return /[\\/]/.test(String(value || "")) || path.isAbsolute(String(value || ""));
}

function addCandidate(out, value) {
  const text = String(value || "").trim();
  if (!text) return;
  if (!out.includes(text)) out.push(text);
}

function sqliteCandidates(options = {}) {
  const env = options.env || process.env;
  const userHome = options.userHome || env.USERPROFILE || env.HOME || "";
  const out = [];
  addCandidate(out, env.CODEX_MOBILE_SQLITE3_EXE);
  addCandidate(out, env.SQLITE3_EXE);
  if (userHome) {
    const wingetRoot = path.join(userHome, "AppData", "Local", "Microsoft", "WinGet", "Packages");
    addCandidate(out, path.join(
      wingetRoot,
      "Google.PlatformTools_Microsoft.Winget.Source_8wekyb3d8bbwe",
      "platform-tools",
      "sqlite3.exe",
    ));
    try {
      for (const entry of fs.readdirSync(wingetRoot, { withFileTypes: true })) {
        if (!entry.isDirectory() || !entry.name.startsWith("Google.PlatformTools_")) continue;
        addCandidate(out, path.join(wingetRoot, entry.name, "platform-tools", "sqlite3.exe"));
      }
    } catch (_) {}
    addCandidate(out, path.join(userHome, "AppData", "Local", "Android", "Sdk", "platform-tools", "sqlite3.exe"));
  }
  addCandidate(out, path.join(process.env.ProgramFiles || "C:\\Program Files", "SQLite", "sqlite3.exe"));
  addCandidate(out, path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "SQLite", "sqlite3.exe"));
  addCandidate(out, "sqlite3");
  return out;
}

function sqliteCommandExists(command) {
  if (!isPathLike(command)) return true;
  try {
    return fs.existsSync(command);
  } catch (_) {
    return false;
  }
}

function runSqliteJson(dbPath, query, options = {}) {
  const timeout = Math.max(1000, Number(options.timeoutMs || 5000));
  const maxBuffer = Math.max(1024 * 1024, Number(options.maxBuffer || 1024 * 1024));
  const candidates = cachedSqliteCommand
    ? [cachedSqliteCommand, ...sqliteCandidates(options)]
    : sqliteCandidates(options);
  let lastError = null;
  for (const command of candidates) {
    if (!sqliteCommandExists(command)) continue;
    let result;
    try {
      result = spawnSync(command, ["-json", dbPath, query], {
        encoding: "utf8",
        timeout,
        windowsHide: true,
        maxBuffer,
      });
    } catch (err) {
      lastError = err;
      continue;
    }
    if (!result.error && result.status === 0) {
      try {
        const rows = JSON.parse(result.stdout || "[]");
        cachedSqliteCommand = command;
        return { ok: true, rows: Array.isArray(rows) ? rows : [], command };
      } catch (err) {
        return { ok: false, rows: [], command, error: err };
      }
    }
    lastError = result.error || new Error(result.stderr || `sqlite3 exited with ${result.status}`);
  }
  return { ok: false, rows: [], command: "", error: lastError || new Error("sqlite3 not found") };
}

module.exports = {
  runSqliteJson,
  sqliteCandidates,
};
