"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");

const {
  localImageUploadsForContext,
  parseImageContextPolicyEnv,
  parsePersistExtendedHistoryEnv,
  shouldPersistExtendedHistoryForUploads,
} = require("./message-input-service");
const {
  generatedImagePathForId,
  imageContentTypeForPath,
} = require("./generated-image-cache-service");

const IMAGE_EXTENSIONS = new Set([".avif", ".bmp", ".gif", ".heic", ".heif", ".jpeg", ".jpg", ".png", ".tif", ".tiff", ".webp"]);
const FILE_PREVIEW_TEXT_EXTENSIONS = new Set([
  ".conf",
  ".csv",
  ".css",
  ".diff",
  ".env.example",
  ".htm",
  ".html",
  ".ini",
  ".js",
  ".jsx",
  ".json",
  ".jsonl",
  ".log",
  ".md",
  ".markdown",
  ".patch",
  ".plist",
  ".properties",
  ".py",
  ".rb",
  ".rs",
  ".sh",
  ".sql",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
]);
const FILE_PREVIEW_DOCUMENT_EXTENSIONS = new Set([".pdf"]);
const FILE_PREVIEW_IMAGE_CONTENT_TYPES = new Map([
  [".avif", "image/avif"],
  [".bmp", "image/bmp"],
  [".gif", "image/gif"],
  [".heic", "image/heic"],
  [".heif", "image/heif"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".tif", "image/tiff"],
  [".tiff", "image/tiff"],
  [".webp", "image/webp"],
]);
const FILE_PREVIEW_TEXT_CONTENT_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".csv", "text/csv; charset=utf-8"],
  [".htm", "text/html; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".jsonl", "application/x-ndjson; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"],
  [".markdown", "text/markdown; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".xml", "application/xml; charset=utf-8"],
  [".yaml", "application/yaml; charset=utf-8"],
  [".yml", "application/yaml; charset=utf-8"],
]);
const FILE_PREVIEW_DENIED_BASENAMES = new Set([
  ".env",
  ".npmrc",
  ".netrc",
  "access_key",
  "auth.json",
  "credentials",
  "credentials.json",
  "id_ed25519",
  "id_rsa",
  "known_hosts",
  "secret.json",
  "secrets.json",
  "service-account.json",
  "service_account.json",
  "token.json",
  "tokens.json",
]);
const FILE_PREVIEW_DENIED_DIRS = new Set([
  ".aws",
  ".gnupg",
  ".ssh",
  "keychain",
]);

function uniqueStrings(values) {
  return [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))];
}

function normalizeFsPath(value) {
  return String(value || "").replace(/\\/g, "/").replace(/\/+$/g, "").toLowerCase();
}

function getUrl(req) {
  return new URL(req.url || "/", "http://127.0.0.1");
}

function createStatusError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function createMediaFileService(options = {}) {
  const env = options.env || process.env;
  const userHome = String(options.userHome || env.USERPROFILE || env.HOME || os.homedir() || process.cwd());
  const runtimeRoot = String(options.runtimeRoot || env.CODEX_MOBILE_RUNTIME_DIR || path.join(userHome, ".codex-mobile-web"));
  const codexHome = String(options.codexHome || env.CODEX_HOME || path.join(userHome, ".codex"));
  const defaultCodexHome = String(options.defaultCodexHome || path.join(userHome, ".codex"));
  const maxUploadBytes = Math.max(1, Number(options.maxUploadBytes || env.CODEX_MOBILE_MAX_UPLOAD_BYTES || String(64 * 1024 * 1024)));
  const maxUploadFiles = Math.max(1, Math.min(50, Number(options.maxUploadFiles || env.CODEX_MOBILE_MAX_UPLOAD_FILES || "12")));
  const uploadRoot = String(options.uploadRoot || env.CODEX_MOBILE_UPLOAD_DIR || path.join(runtimeRoot, "uploads"));
  const generatedImageRoot = String(options.generatedImageRoot || env.CODEX_MOBILE_GENERATED_IMAGE_CACHE_DIR || path.join(runtimeRoot, "generated-images"));
  const filePreviewMaxBytes = Math.max(1024, Number(options.filePreviewMaxBytes || env.CODEX_MOBILE_FILE_PREVIEW_MAX_BYTES || String(512 * 1024)));
  const filePreviewMediaMaxBytes = Math.max(1024 * 1024, Number(options.filePreviewMediaMaxBytes || env.CODEX_MOBILE_FILE_PREVIEW_MEDIA_MAX_BYTES || String(24 * 1024 * 1024)));
  const filePreviewReferenceScanMaxChars = Math.max(64 * 1024, Number(options.filePreviewReferenceScanMaxChars || env.CODEX_MOBILE_FILE_PREVIEW_REFERENCE_SCAN_MAX_CHARS || String(2 * 1024 * 1024)));
  const filePreviewReferenceScanMaxMatches = Math.max(1, Number(options.filePreviewReferenceScanMaxMatches || env.CODEX_MOBILE_FILE_PREVIEW_REFERENCE_SCAN_MAX_MATCHES || "80"));
  const messageDedupeWindowMs = Math.max(5_000, Number(options.messageDedupeWindowMs || env.CODEX_MOBILE_MESSAGE_DEDUPE_WINDOW_MS || "90000"));
  const messageDedupeMax = Math.max(20, Number(options.messageDedupeMax || env.CODEX_MOBILE_MESSAGE_DEDUPE_MAX || "300"));
  const imageContextPolicy = options.imageContextPolicy || parseImageContextPolicyEnv(env);
  const persistExtendedHistoryPolicy = options.persistExtendedHistoryPolicy || parsePersistExtendedHistoryEnv(env);
  const recentMessageSubmissions = options.recentMessageSubmissions || new Map();
  const readBody = options.readBody || (async () => ({}));
  const readRawBody = options.readRawBody || (async () => Buffer.alloc(0));
  const readGlobalState = options.readGlobalState || (() => ({}));
  const visibleWorkspaceRoots = options.visibleWorkspaceRoots || ((globalState) => {
    const roots = globalState && globalState["electron-saved-workspace-roots"];
    return Array.isArray(roots) ? roots : [];
  });
  const normalizePath = options.normalizeFsPath || normalizeFsPath;
  const readStateDbThread = options.readStateDbThread || (() => null);
  const readStartedThread = options.readStartedThread || (() => null);
  const rolloutPathForThread = options.rolloutPathForThread || (() => "");

  function filePreviewEnvRoots() {
    return String(env.CODEX_MOBILE_FILE_PREVIEW_ROOTS || "")
      .split(path.delimiter)
      .map((value) => value.trim())
      .filter(Boolean);
  }

  function filePreviewSkillRoots(skillOptions = {}) {
    const skillUserHome = String(skillOptions.userHome || userHome || "").trim();
    const skillCodexHome = String(skillOptions.codexHome || codexHome || "").trim();
    const skillDefaultCodexHome = String(skillOptions.defaultCodexHome || defaultCodexHome || "").trim();
    return uniqueStrings([
      skillCodexHome ? path.join(skillCodexHome, "skills") : "",
      skillDefaultCodexHome ? path.join(skillDefaultCodexHome, "skills") : "",
      skillUserHome ? path.join(skillUserHome, ".agents", "skills") : "",
    ]);
  }

  function nearestAncestorWithChild(startPath, childName) {
    let current = path.resolve(String(startPath || ""));
    for (let depth = 0; depth < 12; depth += 1) {
      if (!current || current === path.dirname(current)) break;
      try {
        if (fs.existsSync(path.join(current, childName))) return current;
      } catch (_) {}
      current = path.dirname(current);
    }
    return "";
  }

  function safeRealpath(value) {
    try {
      return fs.realpathSync.native ? fs.realpathSync.native(value) : fs.realpathSync(value);
    } catch (_) {
      return "";
    }
  }

  function isPathInsideRoot(targetPath, rootPath) {
    const target = safeRealpath(targetPath);
    const root = safeRealpath(rootPath);
    if (!target || !root) return false;
    const relative = path.relative(root, target);
    return relative === "" || (relative && !relative.startsWith("..") && !path.isAbsolute(relative));
  }

  function previewRootsForThread(threadId, globalState = readGlobalState(), rootOptions = {}) {
    const roots = new Map(filePreviewEnvRoots().map((root) => [root, "env"]));
    for (const root of filePreviewSkillRoots(rootOptions)) roots.set(root, "skill");
    const visibleRoots = visibleWorkspaceRoots(globalState);
    for (const root of visibleRoots) roots.set(root, "workspace");
    const summary = rootOptions.threadSummary || readStateDbThread(threadId) || readStartedThread(threadId);
    const cwd = summary && typeof summary.cwd === "string" ? summary.cwd : "";
    const obsidianRoot = cwd ? nearestAncestorWithChild(cwd, ".obsidian") : "";
    if (cwd) {
      roots.set(cwd, "thread");
      if (obsidianRoot) roots.set(obsidianRoot, "obsidian");
    }
    const visible = new Set([...visibleRoots].map(normalizePath).filter(Boolean));
    return [...roots.entries()]
      .map(([root, source]) => ({ root: path.resolve(root), source }))
      .filter((entry) => entry.root && fs.existsSync(entry.root))
      .filter((entry) => entry.source === "env"
        || entry.source === "skill"
        || entry.source === "workspace"
        || entry.source === "thread"
        || !visible.size
        || visible.has(normalizePath(entry.root))
        || entry.root === obsidianRoot)
      .map((entry) => entry.root);
  }

  function stripMarkdownFileTarget(value) {
    let target = String(value || "").trim();
    if (target.startsWith("<") && target.endsWith(">")) target = target.slice(1, -1).trim();
    const stripLocationSuffix = (entry) => String(entry || "")
      .replace(/#L\d+(?:-L?\d+)?$/i, "")
      .replace(/#line-\d+$/i, "")
      .replace(/^(.+\.[^\\/:]+):\d+(?::\d+)?$/i, "$1");
    const windowsFileUrl = target.match(/^file:\/\/([A-Za-z]:[\\/].*)$/i);
    if (windowsFileUrl) {
      try {
        return stripLocationSuffix(decodeURIComponent(windowsFileUrl[1]));
      } catch (_) {
        return stripLocationSuffix(windowsFileUrl[1]);
      }
    }
    if (/^file:\/\//i.test(target)) {
      try {
        return stripLocationSuffix(decodeURIComponent(new URL(target).pathname));
      } catch (_) {
        return stripLocationSuffix(target.replace(/^file:\/\//i, ""));
      }
    }
    try {
      return stripLocationSuffix(decodeURIComponent(target));
    } catch (_) {
      return stripLocationSuffix(target);
    }
  }

  function hasDeniedPreviewPathSegment(filePath) {
    const parts = path.resolve(filePath).split(path.sep).filter(Boolean);
    return parts.some((part, index) => {
      const lower = part.toLowerCase();
      if (FILE_PREVIEW_DENIED_BASENAMES.has(lower)) return true;
      return index < parts.length - 1 && FILE_PREVIEW_DENIED_DIRS.has(lower);
    });
  }

  function filePreviewExtension(filePath) {
    const basename = path.basename(filePath).toLowerCase();
    if (basename.endsWith(".env.example")) return ".env.example";
    return path.extname(filePath).toLowerCase();
  }

  function allowedFilePreviewExtension(filePath) {
    const ext = filePreviewExtension(filePath);
    return FILE_PREVIEW_TEXT_EXTENSIONS.has(ext)
      || IMAGE_EXTENSIONS.has(ext)
      || FILE_PREVIEW_DOCUMENT_EXTENSIONS.has(ext);
  }

  function filePreviewContentType(filePath) {
    const ext = filePreviewExtension(filePath);
    if (FILE_PREVIEW_IMAGE_CONTENT_TYPES.has(ext)) return FILE_PREVIEW_IMAGE_CONTENT_TYPES.get(ext);
    if (ext === ".pdf") return "application/pdf";
    return FILE_PREVIEW_TEXT_CONTENT_TYPES.get(ext) || "text/plain; charset=utf-8";
  }

  function isHtmlFilePreview(filePath) {
    const ext = filePreviewExtension(filePath);
    return ext === ".html" || ext === ".htm";
  }

  function filePreviewContentSecurityPolicy(filePath) {
    if (!isHtmlFilePreview(filePath)) return "";
    return [
      "sandbox allow-scripts",
      "default-src 'none'",
      "script-src 'unsafe-inline'",
      "style-src 'unsafe-inline'",
      "img-src data: blob:",
      "font-src data:",
      "base-uri 'none'",
      "form-action 'none'",
    ].join("; ");
  }

  function filePreviewExtensionPattern() {
    const extensions = [
      ...FILE_PREVIEW_TEXT_EXTENSIONS,
      ...IMAGE_EXTENSIONS,
      ...FILE_PREVIEW_DOCUMENT_EXTENSIONS,
    ]
      .map((ext) => ext.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .sort((a, b) => b.length - a.length);
    return extensions.join("|");
  }

  function previewReferenceScanTail(text) {
    const source = String(text || "");
    if (source.length <= filePreviewReferenceScanMaxChars) return source;
    return source.slice(source.length - filePreviewReferenceScanMaxChars);
  }

  function previewFileReferencesFromText(text) {
    const source = previewReferenceScanTail(text);
    if (!source) return [];
    const extPattern = filePreviewExtensionPattern();
    const windowsFileUrlPattern = new RegExp(`file://[A-Za-z]:[\\\\/](?:[^\\0\\r\\n<>"'\`|])*?(?:${extPattern})(?::\\d+(?::\\d+)?)?`, "gi");
    const fileUrlPattern = new RegExp(`file://[^\\s\\])}>"'\`]+(?:${extPattern})(?::\\d+(?::\\d+)?)?`, "gi");
    const absolutePathPattern = new RegExp(`/(?:[^\\0\\r\\n<>"'\`|])*?(?:${extPattern})(?::\\d+(?::\\d+)?)?`, "gi");
    const windowsAbsolutePathPattern = new RegExp(`[A-Za-z]:[\\\\/](?:[^\\0\\r\\n<>"'\`|])*?(?:${extPattern})(?::\\d+(?::\\d+)?)?`, "gi");
    const out = [];
    for (const pattern of [windowsFileUrlPattern, fileUrlPattern, absolutePathPattern, windowsAbsolutePathPattern]) {
      for (const match of source.matchAll(pattern)) {
        const target = stripMarkdownFileTarget(match[0]);
        if (!target || !path.isAbsolute(target)) continue;
        if (hasDeniedPreviewPathSegment(target) || !allowedFilePreviewExtension(target)) continue;
        try {
          const stat = fs.statSync(target);
          if (stat.isFile()) out.push(safeRealpath(target) || path.resolve(target));
        } catch (_) {}
        if (out.length >= filePreviewReferenceScanMaxMatches) return uniqueStrings(out);
      }
    }
    return uniqueStrings(out);
  }

  function readRolloutPreviewReferenceScanText(rolloutPath) {
    if (!rolloutPath || typeof rolloutPath !== "string" || !fs.existsSync(rolloutPath)) return "";
    let fd = null;
    try {
      const stat = fs.statSync(rolloutPath);
      if (!stat.isFile() || stat.size <= 0) return "";
      const maxBytes = Math.min(stat.size, filePreviewReferenceScanMaxChars);
      const start = Math.max(0, stat.size - maxBytes);
      const buffer = Buffer.alloc(maxBytes);
      fd = fs.openSync(rolloutPath, "r");
      fs.readSync(fd, buffer, 0, maxBytes, start);
      return buffer.toString("utf8");
    } catch (_) {
      return "";
    } finally {
      if (fd !== null) {
        try {
          fs.closeSync(fd);
        } catch (_) {}
      }
    }
  }

  function previewReferenceCandidatesForRequestedPath(requestedPath) {
    const target = stripMarkdownFileTarget(requestedPath);
    if (!target || !path.isAbsolute(target)) return [];
    if (hasDeniedPreviewPathSegment(target) || !allowedFilePreviewExtension(target)) return [];
    const candidates = new Set([target]);
    try {
      candidates.add(decodeURIComponent(target));
    } catch (_) {}
    try {
      candidates.add(encodeURI(target));
    } catch (_) {}
    try {
      candidates.add(`file://${target}`);
      candidates.add(`file://${encodeURI(target)}`);
    } catch (_) {}
    return [...candidates].filter(Boolean);
  }

  function previewRequestedPathReferencedInText(requestedPath, text) {
    const source = String(text || "");
    if (!source) return false;
    return previewReferenceCandidatesForRequestedPath(requestedPath).some((candidate) => source.includes(candidate));
  }

  function previewReferenceForRequestedPath(requestedPath, text) {
    const target = stripMarkdownFileTarget(requestedPath);
    if (!target || !path.isAbsolute(target)) return [];
    if (!previewRequestedPathReferencedInText(target, text)) return [];
    if (hasDeniedPreviewPathSegment(target) || !allowedFilePreviewExtension(target)) return [];
    try {
      const stat = fs.statSync(target);
      if (stat.isFile()) return [safeRealpath(target) || path.resolve(target)];
    } catch (_) {}
    return [];
  }

  function referencedPreviewFilesForThread(threadId, referenceOptions = {}) {
    const summary = referenceOptions.threadSummary || readStateDbThread(threadId) || readStartedThread(threadId);
    const rolloutPath = referenceOptions.rolloutPath || rolloutPathForThread(summary);
    const rawRolloutText = typeof referenceOptions.rolloutText === "string"
      ? referenceOptions.rolloutText
      : readRolloutPreviewReferenceScanText(rolloutPath);
    if (referenceOptions.requestedPath) {
      const requestedReference = previewReferenceForRequestedPath(referenceOptions.requestedPath, rawRolloutText);
      if (requestedReference.length) return requestedReference;
    }
    const rolloutText = previewReferenceScanTail(rawRolloutText);
    return previewFileReferencesFromText(rolloutText);
  }

  function filePreviewAuthoritiesForThread(threadId, globalState = readGlobalState(), authorityOptions = {}) {
    const rootAuthorities = previewRootsForThread(threadId, globalState, authorityOptions).map((root) => ({ root, source: "root" }));
    const referencedAuthorities = referencedPreviewFilesForThread(threadId, authorityOptions).map((file) => ({
      file,
      source: authorityOptions.requestedPath ? "requested-thread-reference" : "thread-reference",
    }));
    return [
      ...rootAuthorities,
      ...referencedAuthorities,
    ];
  }

  function isTextFilePreview(filePath) {
    return FILE_PREVIEW_TEXT_EXTENSIONS.has(filePreviewExtension(filePath));
  }

  function isMediaFilePreview(filePath) {
    const ext = filePreviewExtension(filePath);
    return IMAGE_EXTENSIONS.has(ext) || FILE_PREVIEW_DOCUMENT_EXTENSIONS.has(ext);
  }

  function normalizeFilePreviewAuthorities(allowedAuthorities) {
    return (allowedAuthorities || [])
      .map((entry) => {
        if (typeof entry === "string") return { root: path.resolve(entry), source: "root" };
        if (!entry || typeof entry !== "object") return null;
        if (entry.file) return { file: path.resolve(String(entry.file)), source: entry.source || "file" };
        if (entry.root) return { root: path.resolve(String(entry.root)), source: entry.source || "root" };
        return null;
      })
      .filter(Boolean);
  }

  function resolveFilePreviewPath(requestedPath, allowedAuthorities) {
    const target = stripMarkdownFileTarget(requestedPath);
    if (!target || !path.isAbsolute(target)) throw createStatusError(400, "Only absolute local file paths can be previewed");
    const resolved = path.resolve(target);
    if (hasDeniedPreviewPathSegment(resolved)) throw createStatusError(403, "This file is not allowed for mobile preview");
    if (!allowedFilePreviewExtension(resolved)) throw createStatusError(415, "This file type is not supported for mobile preview");
    let stat;
    try {
      stat = fs.statSync(resolved);
    } catch (_) {
      throw createStatusError(404, "File was not found");
    }
    if (!stat.isFile()) throw createStatusError(400, "Only files can be previewed");
    const resolvedReal = safeRealpath(resolved) || resolved;
    const authorities = normalizeFilePreviewAuthorities(allowedAuthorities);
    const matchingRoots = authorities
      .filter((entry) => entry.root)
      .map((entry) => entry.root)
      .filter((root) => isPathInsideRoot(resolvedReal, root))
      .sort((a, b) => b.length - a.length);
    const matchingFiles = authorities
      .filter((entry) => entry.file)
      .map((entry) => safeRealpath(entry.file) || entry.file)
      .filter((file) => file === resolvedReal);
    if (!matchingRoots.length && !matchingFiles.length) {
      throw createStatusError(403, "File is outside the allowed preview roots");
    }
    const matchedRoot = matchingRoots[0] || path.dirname(matchingFiles[0]);
    return {
      path: resolvedReal,
      root: safeRealpath(matchedRoot) || matchedRoot,
      stat,
    };
  }

  function previewKindForPath(filePath) {
    const ext = filePreviewExtension(filePath);
    if (isHtmlFilePreview(filePath)) return "html";
    if (ext === ".md" || ext === ".markdown") return "markdown";
    if (ext === ".json" || ext === ".jsonl") return "json";
    if (ext === ".yaml" || ext === ".yml") return "yaml";
    if (ext === ".csv") return "csv";
    if (IMAGE_EXTENSIONS.has(ext)) return "image";
    if (ext === ".pdf") return "pdf";
    return "text";
  }

  function filePreviewPublicFields(resolved, requestedPath = "", threadId = "") {
    const kind = previewKindForPath(resolved.path);
    const contentUrl = `/api/files/preview/content?threadId=${encodeURIComponent(threadId || "")}&path=${encodeURIComponent(resolved.path)}`;
    return {
      path: resolved.path,
      fileName: path.basename(resolved.path),
      relativePath: path.relative(resolved.root, resolved.path) || path.basename(resolved.path),
      kind,
      contentType: filePreviewContentType(resolved.path),
      sizeBytes: resolved.stat.size,
      sourcePath: stripMarkdownFileTarget(requestedPath || resolved.path),
      contentUrl,
    };
  }

  function readFilePreview(requestedPath, allowedRoots, previewOptions = {}) {
    const resolved = resolveFilePreviewPath(requestedPath, allowedRoots);
    const base = filePreviewPublicFields(resolved, requestedPath, previewOptions.threadId || "");
    if (isMediaFilePreview(resolved.path)) {
      if (resolved.stat.size > filePreviewMediaMaxBytes) {
        throw createStatusError(413, `File is too large for mobile preview (${Math.round(filePreviewMediaMaxBytes / 1024 / 1024)} MB limit)`);
      }
      return Object.assign(base, {
        truncated: false,
        maxBytes: filePreviewMediaMaxBytes,
      });
    }

    const limit = filePreviewMaxBytes;
    const fd = fs.openSync(resolved.path, "r");
    try {
      const bytesToRead = Math.min(resolved.stat.size, limit + 1);
      const buffer = Buffer.alloc(bytesToRead);
      const bytesRead = fs.readSync(fd, buffer, 0, bytesToRead, 0);
      const truncated = bytesRead > limit || resolved.stat.size > limit;
      const content = buffer.subarray(0, Math.min(bytesRead, limit)).toString("utf8");
      return Object.assign(base, {
        truncated,
        maxBytes: limit,
        content,
      });
    } finally {
      fs.closeSync(fd);
    }
  }

  function filePreviewContentDisposition(filePath) {
    const basename = path.basename(filePath);
    const asciiName = basename.replace(/[^\x20-\x7E]+/g, "_").replaceAll('"', "");
    return `inline; filename="${asciiName || "preview"}"; filename*=UTF-8''${encodeURIComponent(basename)}`;
  }

  function serveFilePreviewContent(req, res, requestedPath, allowedRoots, sendJson) {
    const resolved = resolveFilePreviewPath(requestedPath, allowedRoots);
    if (!isMediaFilePreview(resolved.path) && !isTextFilePreview(resolved.path)) {
      sendJson(415, { error: "This file type is not supported for mobile preview" });
      return;
    }
    const limit = isMediaFilePreview(resolved.path) ? filePreviewMediaMaxBytes : filePreviewMaxBytes;
    if (resolved.stat.size > limit) {
      sendJson(413, { error: `File is too large for mobile preview (${Math.round(limit / 1024 / 1024)} MB limit)` });
      return;
    }
    const headers = {
      "Content-Type": filePreviewContentType(resolved.path),
      "Content-Length": resolved.stat.size,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": filePreviewContentDisposition(resolved.path),
    };
    const csp = filePreviewContentSecurityPolicy(resolved.path);
    if (csp) headers["Content-Security-Policy"] = csp;
    res.writeHead(200, headers);
    fs.createReadStream(resolved.path).pipe(res);
  }

  function generatedImageContentUrl(cacheId) {
    return `/api/generated-images/file?id=${encodeURIComponent(cacheId || "")}`;
  }

  function multipartBoundary(contentType) {
    const match = /(?:^|;\s*)boundary=(?:"([^"]+)"|([^;]+))/i.exec(String(contentType || ""));
    return match ? String(match[1] || match[2] || "").trim() : "";
  }

  function parsePartHeaders(raw) {
    const headers = {};
    for (const line of String(raw || "").split(/\r?\n/)) {
      const idx = line.indexOf(":");
      if (idx < 0) continue;
      headers[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
    }
    return headers;
  }

  function dispositionParam(disposition, name) {
    const quoted = new RegExp(`(?:^|;\\s*)${name}="([^"]*)"`, "i").exec(String(disposition || ""));
    if (quoted) return quoted[1];
    const bare = new RegExp(`(?:^|;\\s*)${name}=([^;]*)`, "i").exec(String(disposition || ""));
    return bare ? bare[1].trim() : "";
  }

  function parseMultipartBody(buffer, contentType) {
    const boundary = multipartBoundary(contentType);
    if (!boundary) throw new Error("multipart boundary is missing");
    const boundaryBuffer = Buffer.from(`--${boundary}`, "utf8");
    const separator = Buffer.from("\r\n\r\n", "utf8");
    const fields = {};
    const files = [];
    let pos = buffer.indexOf(boundaryBuffer);
    while (pos >= 0) {
      pos += boundaryBuffer.length;
      if (buffer.slice(pos, pos + 2).toString("utf8") === "--") break;
      if (buffer.slice(pos, pos + 2).toString("utf8") === "\r\n") pos += 2;
      const next = buffer.indexOf(boundaryBuffer, pos);
      if (next < 0) break;
      let end = next;
      if (end >= 2 && buffer[end - 2] === 13 && buffer[end - 1] === 10) end -= 2;
      const part = buffer.slice(pos, end);
      const headerEnd = part.indexOf(separator);
      if (headerEnd >= 0) {
        const headers = parsePartHeaders(part.slice(0, headerEnd).toString("utf8"));
        const disposition = headers["content-disposition"] || "";
        const fieldName = dispositionParam(disposition, "name");
        const filename = dispositionParam(disposition, "filename");
        const content = part.slice(headerEnd + separator.length);
        if (fieldName) {
          if (filename) {
            files.push({
              fieldName,
              originalName: filename,
              mimeType: headers["content-type"] || "",
              buffer: content,
            });
          } else {
            fields[fieldName] = content.toString("utf8");
          }
        }
      }
      pos = next;
    }
    return { fields, files };
  }

  function sanitizeUploadName(name) {
    const base = path.basename(String(name || "upload").replace(/\\/g, "/"));
    const cleaned = base
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
      .replace(/\s+/g, " ")
      .trim();
    return (cleaned || "upload").slice(0, 160);
  }

  function isImageUpload(file) {
    const mime = String(file.mimeType || "").toLowerCase();
    const ext = path.extname(file.originalName || "").toLowerCase();
    return mime.startsWith("image/") || IMAGE_EXTENSIONS.has(ext);
  }

  function saveUploadedFiles(threadId, files) {
    if (!files.length) return [];
    if (files.length > maxUploadFiles) throw new Error(`Too many attachments; max ${maxUploadFiles}`);
    const total = files.reduce((sum, file) => sum + file.buffer.length, 0);
    if (total > maxUploadBytes) throw new Error(`Attachments are too large; max ${maxUploadBytes} bytes`);
    const day = new Date().toISOString().slice(0, 10);
    const safeThreadId = sanitizeUploadName(threadId).slice(0, 72);
    const dir = path.join(uploadRoot, day, safeThreadId || "thread");
    fs.mkdirSync(dir, { recursive: true });
    return files.map((file) => {
      const originalName = sanitizeUploadName(file.originalName);
      const diskName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}-${originalName}`;
      const diskPath = path.join(dir, diskName);
      fs.writeFileSync(diskPath, file.buffer, { mode: 0o600 });
      return {
        originalName,
        mimeType: file.mimeType || "application/octet-stream",
        size: file.buffer.length,
        path: diskPath,
        isImage: isImageUpload(file),
      };
    });
  }

  function formatUploadSize(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function appendAttachmentSummary(text, uploads) {
    if (!uploads.length) return text;
    const lines = uploads.map((file) => {
      const kind = file.isImage ? "image" : "file";
      return `- ${file.originalName} (${kind}, ${file.mimeType}, ${formatUploadSize(file.size)}): ${file.path}`;
    });
    return `${text ? `${text}\n\n` : ""}Uploaded attachments:\n${lines.join("\n")}`;
  }

  async function readMessageBody(req, threadId) {
    const contentType = String(req.headers["content-type"] || "");
    if (!/^multipart\/form-data\b/i.test(contentType)) {
      return { fields: await readBody(req), uploads: [] };
    }
    const raw = await readRawBody(req, maxUploadBytes + 256 * 1024);
    const parsed = parseMultipartBody(raw, contentType);
    const uploads = saveUploadedFiles(threadId, parsed.files);
    return { fields: parsed.fields, uploads };
  }

  function buildTurnInput(text, uploads) {
    const input = [];
    const messageText = appendAttachmentSummary(text, uploads).trim();
    if (messageText) input.push({ type: "text", text: messageText, text_elements: [] });
    for (const file of localImageUploadsForContext(uploads, imageContextPolicy)) {
      input.push({ type: "localImage", path: file.path });
    }
    return input;
  }

  function persistExtendedHistoryForUploads(uploads) {
    return shouldPersistExtendedHistoryForUploads(uploads, persistExtendedHistoryPolicy);
  }

  function uploadDedupeFingerprint(file) {
    return {
      name: file.originalName || "",
      mimeType: file.mimeType || "",
      size: Number(file.size || 0),
      isImage: Boolean(file.isImage),
    };
  }

  function messageSubmissionKeys(threadId, body, text, uploads) {
    const explicit = String(body.clientSubmissionId || "").trim();
    const payload = {
      threadId,
      activeTurnId: String(body.activeTurnId || ""),
      cwd: String(body.cwd || ""),
      text: String(text || ""),
      uploads: uploads.map(uploadDedupeFingerprint),
    };
    const contentKey = `content:${crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;
    return explicit ? [`client:${threadId}:${explicit}`] : [contentKey];
  }

  function pruneMessageSubmissions(now = Date.now()) {
    for (const [key, entry] of recentMessageSubmissions) {
      if (now - entry.startedAt > messageDedupeWindowMs) recentMessageSubmissions.delete(key);
    }
    while (recentMessageSubmissions.size > messageDedupeMax) {
      const firstKey = recentMessageSubmissions.keys().next().value;
      if (!firstKey) break;
      recentMessageSubmissions.delete(firstKey);
    }
  }

  function cleanupDuplicateUploads(uploads) {
    const root = path.resolve(uploadRoot);
    for (const file of uploads || []) {
      try {
        const filePath = path.resolve(file.path || "");
        if (!filePath.startsWith(`${root}${path.sep}`)) continue;
        fs.unlinkSync(filePath);
      } catch (_) {}
    }
  }

  async function runMessageSubmissionOnce(keys, duplicateUploads, fn) {
    const now = Date.now();
    const keyList = Array.isArray(keys) ? keys.filter(Boolean) : [keys].filter(Boolean);
    pruneMessageSubmissions(now);
    for (const key of keyList) {
      const existing = recentMessageSubmissions.get(key);
      if (existing && now - existing.startedAt <= messageDedupeWindowMs) {
        cleanupDuplicateUploads(duplicateUploads);
        return existing.promise;
      }
    }
    const entry = { startedAt: now, promise: null };
    entry.promise = Promise.resolve()
      .then(fn)
      .catch((err) => {
        for (const key of keyList) {
          if (recentMessageSubmissions.get(key) === entry) recentMessageSubmissions.delete(key);
        }
        throw err;
      });
    for (const key of keyList) recentMessageSubmissions.set(key, entry);
    try {
      return await entry.promise;
    } finally {
      pruneMessageSubmissions();
    }
  }

  function mimeFor(file) {
    const ext = path.extname(file).toLowerCase();
    if (FILE_PREVIEW_IMAGE_CONTENT_TYPES.has(ext)) return FILE_PREVIEW_IMAGE_CONTENT_TYPES.get(ext);
    return {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".svg": "image/svg+xml; charset=utf-8",
      ".ico": "image/x-icon",
    }[ext] || "application/octet-stream";
  }

  function isPathInside(parent, child) {
    const parentPath = path.resolve(parent);
    const childPath = path.resolve(child);
    return childPath === parentPath || childPath.startsWith(parentPath + path.sep);
  }

  function uploadPathForId(root, id) {
    const normalized = String(id || "").replace(/\\/g, "/").replace(/^\/+/, "");
    const parts = normalized.split("/").filter(Boolean);
    if (!parts.length || parts.some((part) => part === "." || part === ".." || part.includes("\0"))) {
      throw createStatusError(400, "Invalid upload id");
    }
    if (/^[a-zA-Z]:/.test(parts[0] || "")) throw createStatusError(400, "Invalid upload id");
    const target = path.resolve(root, ...parts);
    if (!isPathInside(root, target)) throw createStatusError(403, "Forbidden");
    return target;
  }

  function serveUploadedFile(req, res) {
    const url = getUrl(req);
    let target = "";
    const uploadId = url.searchParams.get("id") || "";
    if (uploadId) {
      try {
        target = uploadPathForId(uploadRoot, uploadId);
      } catch (err) {
        res.writeHead(err.statusCode || 400);
        res.end(err.message || "Invalid upload id");
        return;
      }
    } else {
      const rawPath = url.searchParams.get("path") || "";
      target = path.resolve(rawPath);
      if (!rawPath || !isPathInside(uploadRoot, target)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
    }
    fs.stat(target, (statErr, stat) => {
      if (statErr || !stat.isFile()) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.writeHead(200, {
        "Content-Type": mimeFor(target),
        "Cache-Control": "private, max-age=300",
        "Content-Length": stat.size,
        "Content-Disposition": `inline; filename="${path.basename(target).replace(/"/g, "_")}"`,
      });
      fs.createReadStream(target).pipe(res);
    });
  }

  function serveGeneratedImageFile(req, res, sendJson) {
    const url = getUrl(req);
    let target;
    try {
      target = generatedImagePathForId(generatedImageRoot, url.searchParams.get("id") || "");
    } catch (err) {
      sendJson(err.statusCode || 400, { error: err.message || String(err) });
      return;
    }
    const contentType = imageContentTypeForPath(target, FILE_PREVIEW_IMAGE_CONTENT_TYPES);
    if (!contentType) {
      sendJson(415, { error: "This generated image type is not supported" });
      return;
    }
    fs.stat(target, (statErr, stat) => {
      if (statErr || !stat.isFile()) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      if (stat.size > filePreviewMediaMaxBytes) {
        sendJson(413, { error: `File is too large for mobile preview (${Math.round(filePreviewMediaMaxBytes / 1024 / 1024)} MB limit)` });
        return;
      }
      res.writeHead(200, {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=300",
        "Content-Length": stat.size,
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": filePreviewContentDisposition(target),
      });
      fs.createReadStream(target).pipe(res);
    });
  }

  async function handleMediaFileRoute(input = {}) {
    const url = input.url || getUrl(input.req || {});
    const method = String(input.method || input.req && input.req.method || "");
    const req = input.req;
    const res = input.res;
    const sendJson = input.sendJson;
    if (url.pathname === "/api/uploads/file" && method === "GET") {
      serveUploadedFile(req, res);
      return { handled: true };
    }
    if (url.pathname === "/api/generated-images/file" && method === "GET") {
      serveGeneratedImageFile(req, res, sendJson);
      return { handled: true };
    }
    if (url.pathname === "/api/files/preview" && method === "GET") {
      const threadId = String(url.searchParams.get("threadId") || "");
      const requestedPath = url.searchParams.get("path") || "";
      try {
        const authorities = filePreviewAuthoritiesForThread(threadId, readGlobalState(), { requestedPath });
        sendJson(200, readFilePreview(requestedPath, authorities, { threadId }));
      } catch (err) {
        sendJson(err.statusCode || 500, { error: err.message || String(err) });
      }
      return { handled: true };
    }
    if (url.pathname === "/api/files/preview/content" && method === "GET") {
      const threadId = String(url.searchParams.get("threadId") || "");
      const requestedPath = url.searchParams.get("path") || "";
      try {
        const authorities = filePreviewAuthoritiesForThread(threadId, readGlobalState(), { requestedPath });
        serveFilePreviewContent(req, res, requestedPath, authorities, sendJson);
      } catch (err) {
        sendJson(err.statusCode || 500, { error: err.message || String(err) });
      }
      return { handled: true };
    }
    return { handled: false };
  }

  function publicConfig() {
    return {
      maxUploadBytes,
      maxUploadFiles,
      imageContextMode: imageContextPolicy.imageContextMode,
    };
  }

  return {
    allowedFilePreviewExtension,
    appendAttachmentSummary,
    buildTurnInput,
    cleanupDuplicateUploads,
    filePreviewAuthoritiesForThread,
    filePreviewContentSecurityPolicy,
    filePreviewContentDisposition,
    filePreviewContentType,
    filePreviewImageContentTypes: FILE_PREVIEW_IMAGE_CONTENT_TYPES,
    filePreviewMaxBytes,
    filePreviewMediaMaxBytes,
    filePreviewPublicFields,
    filePreviewSkillRoots,
    formatUploadSize,
    generatedImageContentUrl,
    generatedImageRoot,
    handleMediaFileRoute,
    hasDeniedPreviewPathSegment,
    imageContextPolicy,
    imageExtensions: IMAGE_EXTENSIONS,
    isHtmlFilePreview,
    isPathInside,
    maxUploadBytes,
    maxUploadFiles,
    messageSubmissionKeys,
    mimeFor,
    parseMultipartBody,
    persistExtendedHistoryForUploads,
    previewFileReferencesFromText,
    previewRootsForThread,
    publicConfig,
    readFilePreview,
    readMessageBody,
    referencedPreviewFilesForThread,
    resolveFilePreviewPath,
    runMessageSubmissionOnce,
    serveFilePreviewContent,
    serveGeneratedImageFile,
    serveUploadedFile,
    stripMarkdownFileTarget,
    uploadPathForId,
    uploadRoot,
  };
}

const defaultMediaFileService = createMediaFileService();

module.exports = Object.assign({
  createMediaFileService,
  FILE_PREVIEW_DOCUMENT_EXTENSIONS,
  FILE_PREVIEW_IMAGE_CONTENT_TYPES,
  FILE_PREVIEW_TEXT_CONTENT_TYPES,
  FILE_PREVIEW_TEXT_EXTENSIONS,
  IMAGE_EXTENSIONS,
}, defaultMediaFileService);
