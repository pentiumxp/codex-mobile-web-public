"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ARTIFACT_TYPES = new Set([
  "analysis",
  "prd",
  "sprint",
  "codex_goal",
  "review",
  "task_card_draft",
]);

const ARTIFACT_ACTIONS = {
  analysis: ["copy_markdown", "save_runtime_artifact"],
  prd: ["copy_markdown", "save_runtime_artifact"],
  sprint: ["copy_markdown", "prepare_goal", "save_runtime_artifact"],
  codex_goal: ["copy_markdown", "set_goal", "start_thread_with_goal", "save_runtime_artifact"],
  review: ["copy_markdown", "create_task_card", "save_runtime_artifact"],
  task_card_draft: ["copy_markdown", "create_task_card", "save_runtime_artifact"],
};

const MODE_ALIASES = new Map([
  ["goal", "codex_goal"],
  ["codex-goal", "codex_goal"],
  ["codex goal", "codex_goal"],
  ["task-card", "task_card_draft"],
  ["task card", "task_card_draft"],
  ["task_card", "task_card_draft"],
]);

const DEFAULT_MAX_ARTIFACT_CHARS = 120000;
const DEFAULT_MAX_FILE_CHARS = 24000;
const DEFAULT_MAX_TITLE_CHARS = 180;
const MAX_LIST_LIMIT = 100;

function compactText(value, maxChars = 4000) {
  const text = String(value || "").replace(/\u0000/g, "").trim();
  if (text.length <= maxChars) return text;
  const half = Math.max(1, Math.floor(maxChars / 2));
  return `${text.slice(0, half)}\n\n[truncated ${text.length} chars]\n\n${text.slice(-half)}`;
}

function singleLine(value, maxChars = DEFAULT_MAX_TITLE_CHARS) {
  return compactText(value, maxChars).replace(/\s+/g, " ").trim();
}

function normalizeArtifactType(value) {
  const raw = String(value || "analysis").trim().toLowerCase().replace(/\s+/g, "_");
  const aliased = MODE_ALIASES.get(raw) || raw;
  if (ARTIFACT_TYPES.has(aliased)) return aliased;
  const err = new Error("unsupported_artifact_type");
  err.statusCode = 400;
  throw err;
}

function normalizeArtifactId(value) {
  const id = String(value || "").trim();
  if (!/^cpp_[a-z0-9][a-z0-9_-]{8,80}$/i.test(id)) {
    const err = new Error("invalid_artifact_id");
    err.statusCode = 400;
    throw err;
  }
  return id;
}

function safeJsonLine(value) {
  return `${JSON.stringify(value)}\n`;
}

function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (_) {
    return fallback;
  }
}

function writeJsonFile(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}

function appendJsonLine(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  fs.appendFileSync(filePath, safeJsonLine(value), { encoding: "utf8", mode: 0o600 });
}

function readJsonLines(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch (_) {
          return null;
        }
      })
      .filter(Boolean);
  } catch (_) {
    return [];
  }
}

function defaultStoreRoot(runtimeRoot) {
  return path.join(runtimeRoot || process.cwd(), "chatgpt-pro-planner");
}

function artifactBasename(id) {
  return normalizeArtifactId(id);
}

function normalizeSource(source = {}) {
  const src = source && typeof source === "object" ? source : {};
  return {
    kind: singleLine(src.kind || "chatgpt_pro", 80),
    sourceThreadId: singleLine(src.sourceThreadId || src.threadId || "", 120),
    cwd: String(src.cwd || src.workspace || "").trim(),
    conversationUrl: singleLine(src.conversationUrl || src.url || "", 500),
    requestId: singleLine(src.requestId || src.request_id || "", 120),
  };
}

function publicArtifact(record = {}, options = {}) {
  const includeBody = options.includeBody !== false;
  const type = normalizeArtifactType(record.type || "analysis");
  return {
    id: String(record.id || ""),
    type,
    status: singleLine(record.status || "draft", 40),
    title: singleLine(record.title || type, DEFAULT_MAX_TITLE_CHARS),
    source: normalizeSource(record.source || {}),
    bodyMarkdown: includeBody ? String(record.bodyMarkdown || "") : undefined,
    createdAt: Number(record.createdAt || 0),
    updatedAt: Number(record.updatedAt || record.createdAt || 0),
    applyActions: Array.isArray(record.applyActions) && record.applyActions.length
      ? record.applyActions.map((item) => singleLine(item, 80)).filter(Boolean)
      : ARTIFACT_ACTIONS[type].slice(),
  };
}

function normalizedPathSegments(relativePath) {
  const normalized = String(relativePath || "").replace(/\\/g, "/").replace(/^\/+/, "");
  const segments = normalized.split("/").filter(Boolean);
  if (!segments.length || segments.some((segment) => segment === "." || segment === ".." || segment.includes("\u0000"))) {
    const err = new Error("invalid_relative_path");
    err.statusCode = 400;
    throw err;
  }
  return segments;
}

function isAllowedPlannerRelativePath(relativePath) {
  let segments;
  try {
    segments = normalizedPathSegments(relativePath);
  } catch (_) {
    return false;
  }
  const joined = segments.join("/");
  const basename = segments[segments.length - 1].toLowerCase();
  if (segments.includes(".git") || segments.includes("node_modules")) return false;
  if (segments.some((segment) => /^\.env($|\.)/i.test(segment))) return false;
  if (/\.(pem|key|p12|pfx|crt|cer|der|sqlite|db|log|cookie|cookies)$/i.test(basename)) return false;
  if (/^(access-key|access_key|auth|token|secret|password)/i.test(basename)) return false;
  if (joined === "AGENTS.md" || joined === "README.md") return true;
  if (/^docs\/[^/].*\.(md|markdown|txt|json)$/i.test(joined)) return true;
  if (joined === ".agent-context/PROJECT_CONTEXT.md" || joined === ".agent-context/HANDOFF.md") return true;
  return false;
}

function realPathOrNull(filePath) {
  try {
    return fs.realpathSync(filePath);
  } catch (_) {
    return null;
  }
}

function isInsideDir(child, parent) {
  const childPath = path.resolve(child);
  const parentPath = path.resolve(parent);
  return childPath === parentPath || childPath.startsWith(`${parentPath}${path.sep}`);
}

function normalizeWorkspaceRoot(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return realPathOrNull(text) || path.resolve(text);
}

function uniqueWorkspaceRoots(values) {
  const seen = new Set();
  const roots = [];
  for (const value of values || []) {
    const root = normalizeWorkspaceRoot(value && (value.cwd || value.path || value.root || value));
    if (!root || seen.has(root)) continue;
    seen.add(root);
    roots.push(root);
  }
  return roots;
}

function createChatGptProPlannerService(options = {}) {
  const runtimeRoot = options.runtimeRoot || process.cwd();
  const storeRoot = options.storeRoot || defaultStoreRoot(runtimeRoot);
  const artifactsDir = options.artifactsDir || path.join(storeRoot, "artifacts");
  const indexFile = options.indexFile || path.join(storeRoot, "artifacts.jsonl");
  const now = options.now || (() => Date.now());
  const randomBytes = options.randomBytes || ((size) => crypto.randomBytes(size));
  const maxArtifactChars = Math.max(1000, Number(options.maxArtifactChars || DEFAULT_MAX_ARTIFACT_CHARS));
  const maxFileChars = Math.max(1000, Number(options.maxFileChars || DEFAULT_MAX_FILE_CHARS));
  const listWorkspaces = options.listWorkspaces || (async () => []);
  const readThreadContext = options.readThreadContext || (async () => null);
  const workspaceRoots = options.workspaceRoots || (async () => []);
  const version = String(options.version || "");

  function ensureStore() {
    fs.mkdirSync(artifactsDir, { recursive: true, mode: 0o700 });
    fs.mkdirSync(path.dirname(indexFile), { recursive: true, mode: 0o700 });
  }

  function newArtifactId() {
    return `cpp_${now().toString(36)}_${randomBytes(5).toString("hex")}`;
  }

  function artifactPaths(id) {
    const basename = artifactBasename(id);
    return {
      json: path.join(artifactsDir, `${basename}.json`),
      md: path.join(artifactsDir, `${basename}.md`),
    };
  }

  function readArtifactRecord(id) {
    const paths = artifactPaths(id);
    const record = readJsonFile(paths.json, null);
    if (!record || typeof record !== "object" || Array.isArray(record)) return null;
    let bodyMarkdown = "";
    try {
      bodyMarkdown = fs.readFileSync(paths.md, "utf8");
    } catch (_) {
      bodyMarkdown = String(record.bodyMarkdown || "");
    }
    return Object.assign({}, record, { bodyMarkdown });
  }

  function writeArtifact(record) {
    ensureStore();
    const artifact = publicArtifact(record, { includeBody: true });
    const paths = artifactPaths(artifact.id);
    fs.writeFileSync(paths.md, artifact.bodyMarkdown, { encoding: "utf8", mode: 0o600 });
    const meta = Object.assign({}, artifact);
    delete meta.bodyMarkdown;
    writeJsonFile(paths.json, meta);
    appendJsonLine(indexFile, meta);
    return artifact;
  }

  async function visibleWorkspaceRoots() {
    const listed = await listWorkspaces().catch(() => []);
    const configured = await Promise.resolve(workspaceRoots()).catch(() => []);
    return uniqueWorkspaceRoots([...(Array.isArray(listed) ? listed : []), ...(Array.isArray(configured) ? configured : [])]);
  }

  async function assertVisibleWorkspace(cwd) {
    const root = normalizeWorkspaceRoot(cwd);
    if (!root) {
      const err = new Error("workspace_required");
      err.statusCode = 400;
      throw err;
    }
    const roots = await visibleWorkspaceRoots();
    if (!roots.some((candidate) => root === candidate || isInsideDir(root, candidate))) {
      const err = new Error("workspace_not_visible");
      err.statusCode = 403;
      throw err;
    }
    return root;
  }

  function status() {
    const count = readJsonLines(indexFile).length;
    return {
      ok: true,
      mode: "planner_connector",
      version,
      artifactTypes: Array.from(ARTIFACT_TYPES),
      artifactCount: count,
      maxArtifactChars,
      maxFileChars,
      storeReady: fs.existsSync(storeRoot),
    };
  }

  async function listVisibleWorkspaces(input = {}) {
    const limit = Math.min(MAX_LIST_LIMIT, Math.max(1, Math.trunc(Number(input.limit || 50))));
    const rows = await listWorkspaces().catch(() => []);
    return {
      ok: true,
      workspaces: (Array.isArray(rows) ? rows : []).slice(0, limit).map((workspace) => ({
        cwd: String(workspace && workspace.cwd || ""),
        label: singleLine(workspace && workspace.label || path.basename(String(workspace && workspace.cwd || "")), 120),
        active: Boolean(workspace && workspace.active),
        recentThreadCount: Math.max(0, Math.trunc(Number(workspace && workspace.recentThreadCount || 0))),
      })),
    };
  }

  async function readBoundedThreadContext(input = {}) {
    const threadId = singleLine(input.threadId || input.thread_id || input.sourceThreadId || "", 120);
    if (!threadId) {
      const err = new Error("thread_id_required");
      err.statusCode = 400;
      throw err;
    }
    const context = await readThreadContext({ threadId });
    if (!context) {
      const err = new Error("thread_not_found_or_not_visible");
      err.statusCode = 404;
      throw err;
    }
    return {
      ok: true,
      thread: {
        id: singleLine(context.id || threadId, 120),
        title: singleLine(context.title || context.name || context.preview || "", 180),
        status: singleLine(context.status || context.statusText || "", 80),
        cwd: String(context.cwd || ""),
        model: singleLine(context.model || "", 100),
        reasoningEffort: singleLine(context.reasoningEffort || context.effort || "", 80),
        updatedAt: context.updatedAt || context.updated_at || context.updatedAtMs || 0,
        summary: compactText(context.summary || context.preview || "", 2000),
      },
    };
  }

  async function readAllowedRepoFile(input = {}) {
    const cwd = String(input.cwd || input.workspace || "").trim();
    const relativePath = String(input.relativePath || input.path || input.file || "").trim();
    if (!isAllowedPlannerRelativePath(relativePath)) {
      const err = new Error("file_not_allowed");
      err.statusCode = 403;
      throw err;
    }
    const root = await assertVisibleWorkspace(cwd);
    const segments = normalizedPathSegments(relativePath);
    const target = path.join(root, ...segments);
    const realTarget = realPathOrNull(target);
    if (!realTarget || !isInsideDir(realTarget, root)) {
      const err = new Error("file_not_found_or_outside_workspace");
      err.statusCode = 404;
      throw err;
    }
    let stat;
    try {
      stat = fs.statSync(realTarget);
    } catch (_) {
      stat = null;
    }
    if (!stat || !stat.isFile()) {
      const err = new Error("file_not_readable");
      err.statusCode = 404;
      throw err;
    }
    const limit = Math.min(maxFileChars, Math.max(1000, Math.trunc(Number(input.maxChars || maxFileChars))));
    const text = fs.readFileSync(realTarget, "utf8");
    return {
      ok: true,
      cwd: root,
      relativePath: segments.join("/"),
      content: compactText(text, limit),
      truncated: text.length > limit,
      originalChars: text.length,
    };
  }

  function createPlannerArtifact(input = {}) {
    const type = normalizeArtifactType(input.type || input.mode);
    const title = singleLine(input.title || type, DEFAULT_MAX_TITLE_CHARS) || type;
    const bodyMarkdown = compactText(input.bodyMarkdown || input.markdown || input.body || "", maxArtifactChars);
    if (!bodyMarkdown) {
      const err = new Error("artifact_body_required");
      err.statusCode = 400;
      throw err;
    }
    const createdAt = now();
    return writeArtifact({
      id: newArtifactId(),
      type,
      status: singleLine(input.status || "draft", 40) || "draft",
      title,
      source: normalizeSource(input.source || input),
      bodyMarkdown,
      createdAt,
      updatedAt: createdAt,
      applyActions: ARTIFACT_ACTIONS[type].slice(),
    });
  }

  function prepareCodexGoal(input = {}) {
    const objective = compactText(input.objective || input.goal || input.bodyMarkdown || input.markdown || "", maxArtifactChars);
    if (!objective) {
      const err = new Error("goal_objective_required");
      err.statusCode = 400;
      throw err;
    }
    const body = String(input.bodyMarkdown || input.markdown || "").trim() || [
      "Objective:",
      objective,
      "",
      "Constraints:",
      compactText(input.constraints || "", 4000) || "- Follow the current repository rules and user constraints.",
      "",
      "Required checks:",
      compactText(input.requiredChecks || input.required_checks || "", 4000) || "- Run focused checks selected by the implementation.",
      "",
      "Done when:",
      compactText(input.doneWhen || input.done_when || "", 4000) || "- The requested behavior is implemented, verified, and summarized.",
    ].join("\n");
    return createPlannerArtifact(Object.assign({}, input, {
      type: "codex_goal",
      title: input.title || singleLine(objective, DEFAULT_MAX_TITLE_CHARS),
      bodyMarkdown: body,
    }));
  }

  function createTaskCardDraft(input = {}) {
    const body = compactText(input.bodyMarkdown || input.markdown || input.body || "", maxArtifactChars);
    if (!body) {
      const err = new Error("task_card_body_required");
      err.statusCode = 400;
      throw err;
    }
    return createPlannerArtifact(Object.assign({}, input, {
      type: "task_card_draft",
      title: input.title || "ChatGPT Pro task card draft",
      bodyMarkdown: body,
    }));
  }

  function listPlannerArtifacts(input = {}) {
    const limit = Math.min(MAX_LIST_LIMIT, Math.max(1, Math.trunc(Number(input.limit || 20))));
    const typeFilter = input.type || input.mode ? normalizeArtifactType(input.type || input.mode) : "";
    const threadFilter = singleLine(input.threadId || input.thread_id || input.sourceThreadId || "", 120);
    const cwdFilter = String(input.cwd || input.workspace || "").trim();
    const rows = readJsonLines(indexFile).reverse();
    const artifacts = [];
    const seen = new Set();
    for (const row of rows) {
      const id = String(row && row.id || "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const artifact = publicArtifact(row, { includeBody: false });
      if (typeFilter && artifact.type !== typeFilter) continue;
      if (threadFilter && artifact.source.sourceThreadId !== threadFilter) continue;
      if (cwdFilter && artifact.source.cwd !== cwdFilter) continue;
      artifacts.push(artifact);
      if (artifacts.length >= limit) break;
    }
    return { ok: true, artifacts };
  }

  function readPlannerArtifact(input = {}) {
    const id = normalizeArtifactId(input.id || input.artifactId || input.artifact_id);
    const artifact = readArtifactRecord(id);
    if (!artifact) {
      const err = new Error("artifact_not_found");
      err.statusCode = 404;
      throw err;
    }
    return { ok: true, artifact: publicArtifact(artifact, { includeBody: true }) };
  }

  return {
    ARTIFACT_TYPES: Array.from(ARTIFACT_TYPES),
    status,
    listVisibleWorkspaces,
    readBoundedThreadContext,
    readAllowedRepoFile,
    createPlannerArtifact,
    prepareCodexGoal,
    createTaskCardDraft,
    listPlannerArtifacts,
    readPlannerArtifact,
    isAllowedPlannerRelativePath,
  };
}

module.exports = {
  ARTIFACT_TYPES,
  createChatGptProPlannerService,
  isAllowedPlannerRelativePath,
  normalizeArtifactType,
};
