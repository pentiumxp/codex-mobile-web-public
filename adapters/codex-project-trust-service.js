"use strict";

const fs = require("node:fs");
const path = require("node:path");

function pathKey(value) {
  return path.resolve(String(value || "")).replace(/[\\/]+$/, "").toLowerCase();
}

function tomlBasicString(value) {
  return JSON.stringify(String(value || ""));
}

function decodeTomlBasicString(value) {
  return String(value || "").replace(/\\(["\\bfnrt])/g, (_, escaped) => {
    if (escaped === "b") return "\b";
    if (escaped === "f") return "\f";
    if (escaped === "n") return "\n";
    if (escaped === "r") return "\r";
    if (escaped === "t") return "\t";
    return escaped;
  });
}

function projectPathsFromConfig(text) {
  const paths = [];
  const re = /^\s*\[projects\.(?:"((?:\\.|[^"\\])*)"|'([^']*)')\]\s*$/gm;
  let match;
  while ((match = re.exec(String(text || "")))) {
    const raw = match[1] !== undefined ? decodeTomlBasicString(match[1]) : match[2];
    if (raw) paths.push(path.resolve(raw));
  }
  return paths;
}

function canonicalProjectPath(value) {
  const resolved = path.resolve(String(value || ""));
  try {
    return fs.realpathSync.native ? fs.realpathSync.native(resolved) : fs.realpathSync(resolved);
  } catch (_) {
    return resolved;
  }
}

function appendTrustedProject(text, projectPath) {
  const prefix = String(text || "").trimEnd();
  const separator = prefix ? "\n\n" : "";
  return `${prefix}${separator}[projects.${tomlBasicString(projectPath)}]\ntrust_level = "trusted"\n`;
}

function ensureTrustedProjectsInConfig(configPath, projectPaths) {
  const targets = Array.from(new Set((projectPaths || [])
    .map(canonicalProjectPath)
    .filter(Boolean)));
  if (!targets.length) {
    return { changed: false, added: [], configPath };
  }

  let text = "";
  try {
    text = fs.readFileSync(configPath, "utf8");
  } catch (err) {
    if (!err || err.code !== "ENOENT") throw err;
  }

  const existing = new Set(projectPathsFromConfig(text).map(pathKey));
  const added = [];
  let next = text;
  for (const target of targets) {
    if (existing.has(pathKey(target))) continue;
    next = appendTrustedProject(next, target);
    existing.add(pathKey(target));
    added.push(target);
  }

  if (!added.length) {
    return { changed: false, added: [], configPath };
  }

  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  const tmp = `${configPath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, next, { encoding: "utf8", mode: 0o600 });
  fs.renameSync(tmp, configPath);
  return { changed: true, added, configPath };
}

function ensureCodexProjectsTrusted(options = {}) {
  const codexHome = String(options.codexHome || "").trim();
  if (!codexHome) {
    return { changed: false, added: [], configPath: "" };
  }
  return ensureTrustedProjectsInConfig(
    path.join(codexHome, "config.toml"),
    options.projectPaths || [],
  );
}

module.exports = {
  ensureCodexProjectsTrusted,
  ensureTrustedProjectsInConfig,
  projectPathsFromConfig,
};
