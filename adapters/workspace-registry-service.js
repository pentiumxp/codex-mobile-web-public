"use strict";

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_MAX_WORKSPACE_NAME_LENGTH = 80;
const INVALID_WINDOWS_NAME_CHARS = /[<>:"/\\|?*\x00-\x1F]/;
const RESERVED_WINDOWS_NAMES = new Set([
  "CON",
  "PRN",
  "AUX",
  "NUL",
  "COM1",
  "COM2",
  "COM3",
  "COM4",
  "COM5",
  "COM6",
  "COM7",
  "COM8",
  "COM9",
  "LPT1",
  "LPT2",
  "LPT3",
  "LPT4",
  "LPT5",
  "LPT6",
  "LPT7",
  "LPT8",
  "LPT9",
]);

function statusError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function pathKey(value) {
  return path.resolve(String(value || "")).replace(/[\\/]+$/, "").toLowerCase();
}

function uniqueExistingDirectories(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const candidate = String(value || "").trim();
    if (!candidate) continue;
    const resolved = path.resolve(candidate);
    const key = pathKey(resolved);
    if (seen.has(key)) continue;
    try {
      if (!fs.statSync(resolved).isDirectory()) continue;
    } catch (_) {
      continue;
    }
    seen.add(key);
    result.push(resolved);
  }
  return result;
}

function defaultCreateRoots(homeDir) {
  const home = path.resolve(homeDir || process.cwd());
  return uniqueExistingDirectories([
    path.join(home, "Documents"),
    home,
  ]);
}

function parseCreateRoots(value, fallback) {
  const roots = Array.isArray(value)
    ? value
    : String(value || "").split(path.delimiter);
  const explicit = uniqueExistingDirectories(roots);
  return explicit.length ? explicit : uniqueExistingDirectories(fallback || []);
}

function readJsonFile(filePath, fallback) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch (_) {
    return fallback;
  }
}

function writeJsonFile(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(tmp, filePath);
}

function normalizeStore(raw) {
  const workspaces = Array.isArray(raw && raw.workspaces) ? raw.workspaces : [];
  return {
    version: 1,
    workspaces: workspaces
      .map((entry) => {
        const cwd = String(entry && entry.cwd || "").trim();
        const label = String(entry && entry.label || "").trim();
        if (!cwd || !label) return null;
        return {
          cwd: path.resolve(cwd),
          label,
          source: String(entry && entry.source || "mobile").trim() || "mobile",
          parent: String(entry && entry.parent || "").trim(),
          createdAt: String(entry && entry.createdAt || "").trim(),
          updatedAt: String(entry && entry.updatedAt || "").trim(),
        };
      })
      .filter(Boolean),
  };
}

function workspaceNameFromInput(value, maxLength) {
  const name = String(value || "").trim();
  if (!name) throw statusError(400, "Workspace name is required");
  if (name.length > maxLength) throw statusError(400, "Workspace name is too long");
  if (path.isAbsolute(name) || name.includes("/") || name.includes("\\")) {
    throw statusError(400, "Workspace name must be a simple folder name");
  }
  if (name === "." || name === ".." || name.endsWith(".")) {
    throw statusError(400, "Workspace name is not allowed");
  }
  if (INVALID_WINDOWS_NAME_CHARS.test(name)) {
    throw statusError(400, "Workspace name contains invalid characters");
  }
  const deviceName = name.split(".")[0].toUpperCase();
  if (RESERVED_WINDOWS_NAMES.has(deviceName)) {
    throw statusError(400, "Workspace name is reserved by Windows");
  }
  return name;
}

function publicWorkspace(entry) {
  return {
    cwd: entry.cwd,
    label: entry.label || path.basename(entry.cwd) || entry.cwd,
    source: entry.source || "mobile",
    parent: entry.parent || "",
  };
}

function createWorkspaceRegistryService(options = {}) {
  const storageFile = path.resolve(String(options.storageFile || path.join(process.cwd(), "workspace-registry.json")));
  const fallbackRoots = defaultCreateRoots(options.homeDir);
  const createRoots = parseCreateRoots(options.createRoots, fallbackRoots);
  const maxNameLength = Math.max(1, Number(options.maxNameLength || DEFAULT_MAX_WORKSPACE_NAME_LENGTH));

  function loadStore() {
    return normalizeStore(readJsonFile(storageFile, { version: 1, workspaces: [] }));
  }

  function saveStore(store) {
    writeJsonFile(storageFile, normalizeStore(store));
  }

  function availableCreateRoots() {
    return uniqueExistingDirectories(createRoots);
  }

  function defaultCreateRoot() {
    return availableCreateRoots()[0] || "";
  }

  function list() {
    const seen = new Set();
    const result = [];
    for (const entry of loadStore().workspaces) {
      const key = pathKey(entry.cwd);
      if (seen.has(key)) continue;
      try {
        if (!fs.statSync(entry.cwd).isDirectory()) continue;
      } catch (_) {
        continue;
      }
      seen.add(key);
      result.push(publicWorkspace(entry));
    }
    return result;
  }

  function resolveCreateRoot(value) {
    const roots = availableCreateRoots();
    if (!roots.length) throw statusError(500, "Workspace create root is unavailable");
    if (!value) return roots[0];
    const requestedKey = pathKey(value);
    const root = roots.find((candidate) => pathKey(candidate) === requestedKey);
    if (!root) throw statusError(403, "Workspace create root is not allowed");
    return root;
  }

  function upsertWorkspace(store, workspace) {
    const key = pathKey(workspace.cwd);
    const existing = store.workspaces.find((entry) => pathKey(entry.cwd) === key);
    if (existing) {
      Object.assign(existing, workspace, {
        createdAt: existing.createdAt || workspace.createdAt,
      });
      return existing;
    }
    store.workspaces.push(workspace);
    return workspace;
  }

  function create(input = {}) {
    const label = workspaceNameFromInput(input.name || input.label, maxNameLength);
    const parent = resolveCreateRoot(input.parent || input.root);
    const target = path.resolve(parent, label);
    const relative = path.relative(parent, target);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
      throw statusError(403, "Workspace path is outside the allowed create root");
    }

    let created = false;
    try {
      const stat = fs.existsSync(target) ? fs.statSync(target) : null;
      if (stat && !stat.isDirectory()) throw statusError(409, "Workspace path already exists and is not a directory");
      if (!stat) {
        fs.mkdirSync(target, { recursive: false });
        created = true;
      }
    } catch (err) {
      if (err && err.statusCode) throw err;
      throw statusError(500, err.message || String(err));
    }

    const now = new Date().toISOString();
    const store = loadStore();
    const entry = upsertWorkspace(store, {
      cwd: target,
      label,
      source: "mobile",
      parent,
      createdAt: now,
      updatedAt: now,
    });
    saveStore(store);
    return {
      ok: true,
      created,
      workspace: Object.assign(publicWorkspace(entry), { created }),
      createRoot: parent,
      createRoots: availableCreateRoots(),
    };
  }

  return {
    create,
    list,
    createRoots: availableCreateRoots,
    defaultCreateRoot,
  };
}

module.exports = {
  createWorkspaceRegistryService,
  workspaceNameFromInput,
};
