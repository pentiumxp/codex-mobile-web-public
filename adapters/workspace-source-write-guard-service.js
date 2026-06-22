"use strict";

const fs = require("node:fs");
const path = require("node:path");

const SOURCE_ROOT_MARKERS = [
  ".git",
  "package.json",
  "pyproject.toml",
  "Cargo.toml",
  "go.mod",
  "pom.xml",
  "build.gradle",
  "settings.gradle",
  "composer.json",
  "Gemfile",
  "pubspec.yaml",
  "mix.exs",
  "deno.json",
  "tsconfig.json",
];

const PATH_FIELD_NAMES = new Set([
  "path",
  "file",
  "fileName",
  "filename",
  "filePath",
  "filepath",
  "target",
  "targetPath",
  "fullPath",
  "absolutePath",
  "root",
  "grantRoot",
  "workspace",
  "workspaceRoot",
]);

const PATH_ARRAY_FIELD_NAMES = new Set([
  "paths",
  "files",
  "fileNames",
  "filenames",
  "filePaths",
  "filepaths",
  "changedFiles",
  "targetPaths",
]);

const WRITE_COMMAND_PATTERN = new RegExp([
  "\\bapply_patch\\b",
  "\\btee\\b",
  "\\bsed\\s+-[^\\n;&|]*i",
  "\\bperl\\s+-[^\\n;&|]*p[^\\n;&|]*i",
  "\\bpython(?:3)?\\b[\\s\\S]{0,240}\\b(open\\s*\\(|write_text\\s*\\(|write_bytes\\s*\\(|shutil\\.(?:copy|move)|os\\.(?:remove|unlink|rename|replace|makedirs))",
  "\\bnode\\b[\\s\\S]{0,240}\\b(writeFileSync|appendFileSync|rmSync|renameSync|copyFileSync|mkdirSync)",
  "(?:^|[\\s;&|])(?:rm|mv|cp|rsync|touch|mkdir|truncate)\\b",
  "(?:^|[\\s;&|])git\\s+(?:add|commit|checkout|reset|clean|rm|mv|restore|switch|rebase|merge|cherry-pick|stash)\\b",
  "\\bnpm\\s+(?:install|i|ci|update|dedupe)\\b",
  "\\byarn\\s+(?:add|install|upgrade|remove)\\b",
  "\\bpnpm\\s+(?:add|install|update|remove)\\b",
  "\\b(?:pip|pip3)\\s+install\\b",
  "\\b(?:cargo|go)\\s+(?:fmt|mod\\s+tidy|fix)\\b",
  "(?:^|[^<])>>?\\s*['\\\"]?[^\\s;&|]+",
].join("|"), "i");

function normalizeFsPath(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    return path.resolve(text);
  } catch (_) {
    return "";
  }
}

function realPathOrResolved(value) {
  const resolved = normalizeFsPath(value);
  if (!resolved) return "";
  try {
    return fs.realpathSync.native ? fs.realpathSync.native(resolved) : fs.realpathSync(resolved);
  } catch (_) {
    const suffix = [];
    let cursor = resolved;
    while (cursor && cursor !== path.dirname(cursor)) {
      try {
        if (fs.existsSync(cursor)) {
          const realBase = fs.realpathSync.native ? fs.realpathSync.native(cursor) : fs.realpathSync(cursor);
          return path.join(realBase, ...suffix);
        }
      } catch (_) {}
      suffix.unshift(path.basename(cursor));
      cursor = path.dirname(cursor);
    }
    return resolved;
  }
}

function comparablePath(value) {
  return String(value || "")
    .replace(/^\\\\\?\\/, "")
    .replace(/[\\/]+/g, path.sep)
    .replace(new RegExp(`${path.sep.replace("\\", "\\\\")}+$`), "")
    .toLowerCase();
}

function isPathInside(child, parent) {
  const childPath = comparablePath(realPathOrResolved(child));
  const parentPath = comparablePath(realPathOrResolved(parent));
  if (!childPath || !parentPath) return false;
  return childPath === parentPath || childPath.startsWith(`${parentPath}${path.sep}`);
}

function isSourceRoot(root) {
  const normalized = normalizeFsPath(root);
  if (!normalized) return false;
  for (const marker of SOURCE_ROOT_MARKERS) {
    try {
      if (fs.existsSync(path.join(normalized, marker))) return true;
    } catch (_) {
      // Ignore unreadable marker checks; another marker may still be readable.
    }
  }
  return false;
}

function uniquePaths(values) {
  const seen = new Set();
  const result = [];
  for (const value of values || []) {
    const normalized = realPathOrResolved(value);
    const key = comparablePath(normalized);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

function currentWorkspaceRoots(currentCwd, sourceRoots) {
  const cwd = realPathOrResolved(currentCwd);
  if (!cwd) return [];
  const roots = sourceRoots.filter((root) => isPathInside(cwd, root) || isPathInside(root, cwd));
  return roots.length ? roots : [cwd];
}

function foreignSourceRoots(currentCwd, workspaceRoots) {
  const sourceRoots = uniquePaths(workspaceRoots).filter(isSourceRoot);
  const allowedRoots = currentWorkspaceRoots(currentCwd, sourceRoots);
  return sourceRoots.filter((root) => !allowedRoots.some((allowed) => isPathInside(root, allowed) || isPathInside(allowed, root)));
}

function resolveRequestPath(value, cwd) {
  const text = String(value || "").trim();
  if (!text || /^[-]+$/.test(text)) return "";
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) return "";
  if (/^~(?:\/|\\|$)/.test(text)) return "";
  try {
    return path.isAbsolute(text) ? path.resolve(text) : path.resolve(cwd || process.cwd(), text);
  } catch (_) {
    return "";
  }
}

function collectPathsFromValue(value, cwd, depth = 0, out = []) {
  if (depth > 5 || value == null) return out;
  if (typeof value === "string") {
    const resolved = resolveRequestPath(value, cwd);
    if (resolved) out.push(resolved);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 80)) collectPathsFromValue(item, cwd, depth + 1, out);
    return out;
  }
  if (typeof value !== "object") return out;
  for (const [key, entry] of Object.entries(value).slice(0, 160)) {
    if (PATH_FIELD_NAMES.has(key)) {
      collectPathsFromValue(entry, cwd, depth + 1, out);
    } else if (PATH_ARRAY_FIELD_NAMES.has(key)) {
      collectPathsFromValue(entry, cwd, depth + 1, out);
    } else if (/path|file|root/i.test(key) && (typeof entry === "string" || Array.isArray(entry))) {
      collectPathsFromValue(entry, cwd, depth + 1, out);
    } else if (key && (key.includes("/") || key.includes("\\") || key.startsWith("."))) {
      collectPathsFromValue(key, cwd, depth + 1, out);
    } else if (entry && typeof entry === "object") {
      collectPathsFromValue(entry, cwd, depth + 1, out);
    }
  }
  return out;
}

function commandTextFromRequest(method, params = {}) {
  if (method === "execCommandApproval" && Array.isArray(params.command)) return params.command.join(" ");
  if (typeof params.command === "string") return params.command;
  if (Array.isArray(params.commandActions) && params.commandActions.length) {
    return params.commandActions.map((action) => action && action.command).filter(Boolean).join(" && ");
  }
  return "";
}

function extractWritePathsFromRequest(method, params = {}, currentCwd = "") {
  const cwd = params.cwd || currentCwd || process.cwd();
  if (method === "applyPatchApproval" && params.fileChanges && typeof params.fileChanges === "object") {
    return uniquePaths(Object.keys(params.fileChanges).map((name) => resolveRequestPath(name, cwd)).filter(Boolean));
  }
  if (method === "item/fileChange/requestApproval") {
    return uniquePaths(collectPathsFromValue(params, cwd));
  }
  if (method === "item/permissions/requestApproval") {
    if (!permissionRequestLooksWritable(params)) return [];
    return uniquePaths(collectPathsFromValue({
      grantRoot: params.grantRoot,
      fileSystem: params.permissions && params.permissions.fileSystem,
    }, cwd));
  }
  return [];
}

function commandLooksWriteLike(command) {
  return WRITE_COMMAND_PATTERN.test(String(command || ""));
}

function permissionRequestLooksWritable(params = {}) {
  const fileSystem = params.permissions && params.permissions.fileSystem;
  if (!fileSystem) return false;
  let text = "";
  try {
    text = JSON.stringify(fileSystem);
  } catch (_) {
    text = String(fileSystem || "");
  }
  return /\b(write|writable|readWrite|read-write|modify|create|delete|full|workspace-write|dangerFullAccess)\b/i.test(text);
}

function commandMentionsRoot(command, root) {
  const text = String(command || "");
  if (!text || !root) return false;
  const normalized = String(root);
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(escaped.replace(/\\ /g, "(?:\\\\ | )"), "i").test(text);
}

function commandPathTokens(command, cwd) {
  const text = String(command || "");
  if (!text) return [];
  const tokens = text
    .match(/(?:[A-Za-z]:)?(?:\/|\\|\.\.?[\\/])[^'"\s;&|)]+/g) || [];
  return uniquePaths(tokens.map((token) => {
    const cleaned = token.replace(/^['"]+|['",:]+$/g, "");
    return resolveRequestPath(cleaned, cwd);
  }).filter(Boolean));
}

function matchingForeignRoot(targetPath, roots) {
  return (roots || []).find((root) => isPathInside(targetPath, root)) || "";
}

function classifyWorkspaceSourceWriteRequest(request, options = {}) {
  const method = String(request && request.method || "");
  const params = request && request.params && typeof request.params === "object" ? request.params : {};
  const currentCwd = String(options.currentCwd || params.cwd || "").trim();
  if (!currentCwd) return { action: "allow", reason: "no_current_cwd" };
  const roots = foreignSourceRoots(currentCwd, options.workspaceRoots || []);
  if (!roots.length) return { action: "allow", reason: "no_foreign_source_roots" };

  if (method === "applyPatchApproval" || method === "item/fileChange/requestApproval") {
    const writePaths = extractWritePathsFromRequest(method, params, currentCwd);
    const deniedPath = writePaths.find((target) => matchingForeignRoot(target, roots));
    if (deniedPath) {
      return {
        action: "deny",
        reason: "foreign_source_file_change",
        matchedPath: deniedPath,
        matchedRoot: matchingForeignRoot(deniedPath, roots),
      };
    }
    return { action: "allow", reason: "file_change_not_foreign_source" };
  }

  if (method === "item/permissions/requestApproval") {
    const writePaths = extractWritePathsFromRequest(method, params, currentCwd);
    const deniedPath = writePaths.find((target) => matchingForeignRoot(target, roots));
    if (deniedPath) {
      return {
        action: "deny",
        reason: "foreign_source_file_system_permission",
        matchedPath: deniedPath,
        matchedRoot: matchingForeignRoot(deniedPath, roots),
      };
    }
    return { action: "allow", reason: "non_source_permission" };
  }

  if (method === "item/commandExecution/requestApproval" || method === "execCommandApproval") {
    const command = commandTextFromRequest(method, params);
    if (!commandLooksWriteLike(command)) return { action: "allow", reason: "read_or_non_write_command" };
    const cwdRoot = matchingForeignRoot(params.cwd || currentCwd, roots);
    if (cwdRoot) {
      return {
        action: "deny",
        reason: "foreign_source_write_command_cwd",
        matchedPath: params.cwd || currentCwd,
        matchedRoot: cwdRoot,
      };
    }
    const deniedPath = commandPathTokens(command, params.cwd || currentCwd).find((target) => matchingForeignRoot(target, roots));
    if (deniedPath) {
      return {
        action: "deny",
        reason: "foreign_source_write_command_path",
        matchedPath: deniedPath,
        matchedRoot: matchingForeignRoot(deniedPath, roots),
      };
    }
    const mentionedRoot = roots.find((root) => commandMentionsRoot(command, root));
    if (mentionedRoot) {
      return {
        action: "deny",
        reason: "foreign_source_write_command_path",
        matchedRoot: mentionedRoot,
      };
    }
    return { action: "allow", reason: "write_command_without_foreign_source" };
  }

  return { action: "allow", reason: "non_write_request" };
}

function createWorkspaceSourceWriteGuard(options = {}) {
  const workspaceRoots = typeof options.workspaceRoots === "function" ? options.workspaceRoots : () => options.workspaceRoots || [];
  const currentCwdForRequest = typeof options.currentCwdForRequest === "function"
    ? options.currentCwdForRequest
    : (request) => String(request && request.params && request.params.cwd || "");

  function classify(request) {
    return classifyWorkspaceSourceWriteRequest(request, {
      currentCwd: currentCwdForRequest(request),
      workspaceRoots: workspaceRoots(request),
    });
  }

  return { classify };
}

module.exports = {
  SOURCE_ROOT_MARKERS,
  classifyWorkspaceSourceWriteRequest,
  commandLooksWriteLike,
  createWorkspaceSourceWriteGuard,
  extractWritePathsFromRequest,
  foreignSourceRoots,
  isPathInside,
  isSourceRoot,
};
