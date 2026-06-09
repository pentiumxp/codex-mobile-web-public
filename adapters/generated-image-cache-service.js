"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

function imageViewSourcePath(item) {
  if (!item || typeof item !== "object") return "";
  const candidates = [
    item.path,
    item.filePath,
    item.file_path,
    item.imagePath,
    item.image_path,
    item.savedPath,
    item.saved_path,
    item.sourcePath,
    item.source_path,
    item.arguments && (item.arguments.path || item.arguments.filePath || item.arguments.imagePath || item.arguments.savedPath),
    item.result && (item.result.path || item.result.filePath || item.result.imagePath || item.result.savedPath),
  ];
  const found = candidates.find((value) => typeof value === "string" && value.trim());
  return found ? found.trim() : "";
}

function imageContentTypeForPath(filePath, contentTypes) {
  const ext = path.extname(String(filePath || "")).toLowerCase();
  if (!ext) return "";
  if (contentTypes && typeof contentTypes.get === "function") return contentTypes.get(ext) || "";
  return contentTypes && contentTypes[ext] ? contentTypes[ext] : "";
}

function safeCacheSegment(value, fallback) {
  const text = String(value || "")
    .trim()
    .replace(/[^A-Za-z0-9_.-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 96);
  return text || fallback;
}

function safeCacheFileName(value) {
  const basename = path.basename(String(value || "image"));
  const safe = basename
    .replace(/[^\x20-\x7E]+/g, "_")
    .replace(/[<>:"/\\|?*\x00-\x1F]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return safe || "image";
}

function generatedImageCacheId(sourcePath, options = {}) {
  const resolved = path.resolve(String(sourcePath || ""));
  const threadSegment = safeCacheSegment(options.threadId, "unscoped");
  const hash = crypto
    .createHash("sha256")
    .update(`${threadSegment}\0${resolved}`)
    .digest("hex")
    .slice(0, 18);
  return `${threadSegment}/${hash}-${safeCacheFileName(resolved)}`;
}

function normalizeImageContentType(value) {
  const contentType = String(value || "").trim().toLowerCase();
  return contentType === "image/jpg" ? "image/jpeg" : contentType;
}

function contentTypeAllowed(contentType, contentTypes) {
  const normalized = normalizeImageContentType(contentType);
  if (!normalized) return false;
  if (!contentTypes) return /^image\/(?:avif|bmp|gif|heic|heif|jpe?g|png|tiff|webp)$/i.test(normalized);
  const values = contentTypes && typeof contentTypes.values === "function"
    ? Array.from(contentTypes.values())
    : Object.values(contentTypes || {});
  return values.map(normalizeImageContentType).includes(normalized);
}

function extensionForImageContentType(contentType, contentTypes) {
  const normalized = normalizeImageContentType(contentType);
  const preferred = {
    "image/avif": ".avif",
    "image/bmp": ".bmp",
    "image/gif": ".gif",
    "image/heic": ".heic",
    "image/heif": ".heif",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/tiff": ".tiff",
    "image/webp": ".webp",
  };
  const preferredExt = preferred[normalized] || ".png";
  if (!contentTypes || (typeof contentTypes.has === "function" && contentTypes.has(preferredExt))) return preferredExt;
  const entries = contentTypes && typeof contentTypes.entries === "function"
    ? Array.from(contentTypes.entries())
    : Object.entries(contentTypes || {});
  const match = entries.find(([, value]) => normalizeImageContentType(value) === normalized);
  return match ? match[0] : preferredExt;
}

function parseGeneratedImageDataUrl(value, options = {}) {
  const text = String(value || "").trim();
  const match = /^data:(image\/[A-Za-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(text);
  if (!match) return null;
  const contentType = normalizeImageContentType(match[1]);
  if (!contentTypeAllowed(contentType, options.contentTypes)) return null;
  const base64 = match[2].replace(/\s+/g, "");
  if (!base64) return null;
  const bytes = Buffer.from(base64, "base64");
  if (!bytes.length) return null;
  if (Number.isFinite(Number(options.maxBytes)) && bytes.length > Number(options.maxBytes)) return null;
  return {
    bytes,
    contentType,
    extension: extensionForImageContentType(contentType, options.contentTypes),
    sizeBytes: bytes.length,
  };
}

function cacheGeneratedImageDataUrl(dataUrl, options = {}) {
  const parsed = parseGeneratedImageDataUrl(dataUrl, options);
  if (!parsed) return null;
  const threadSegment = safeCacheSegment(options.threadId, "unscoped");
  const hash = crypto
    .createHash("sha256")
    .update(`${threadSegment}\0${parsed.contentType}\0`)
    .update(parsed.bytes)
    .digest("hex")
    .slice(0, 18);
  const cacheId = `${threadSegment}/${hash}-tool-output${parsed.extension}`;
  const cachedPath = generatedImagePathForId(options.cacheRoot, cacheId);
  fs.mkdirSync(path.dirname(cachedPath), { recursive: true });
  let shouldWrite = true;
  try {
    const existing = fs.statSync(cachedPath);
    shouldWrite = !existing.isFile() || existing.size !== parsed.sizeBytes;
  } catch (_) {
    shouldWrite = true;
  }
  if (shouldWrite) fs.writeFileSync(cachedPath, parsed.bytes, { mode: 0o600 });
  return {
    cacheId,
    cachedPath,
    fileName: path.basename(cachedPath),
    contentType: parsed.contentType,
    sizeBytes: parsed.sizeBytes,
  };
}

function isPathInside(parent, child) {
  const parentPath = path.resolve(parent);
  const childPath = path.resolve(child);
  return childPath === parentPath || childPath.startsWith(parentPath + path.sep);
}

function generatedImagePathForId(cacheRoot, cacheId) {
  const root = path.resolve(String(cacheRoot || ""));
  const normalized = String(cacheId || "").replace(/\\/g, "/").trim();
  if (!root || !normalized || normalized.startsWith("/") || normalized.includes("\0")) {
    const err = new Error("Invalid generated image id");
    err.statusCode = 400;
    throw err;
  }
  const segments = normalized.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    const err = new Error("Invalid generated image id");
    err.statusCode = 400;
    throw err;
  }
  const target = path.resolve(root, ...segments);
  if (!isPathInside(root, target)) {
    const err = new Error("Generated image id is outside the cache root");
    err.statusCode = 403;
    throw err;
  }
  return target;
}

function cacheGeneratedImageForItem(item, options = {}) {
  const sourcePath = imageViewSourcePath(item);
  if (!sourcePath || !path.isAbsolute(sourcePath)) return null;
  const resolved = path.resolve(sourcePath);
  if (options.isDeniedPath && options.isDeniedPath(resolved)) return null;
  const contentType = imageContentTypeForPath(resolved, options.contentTypes);
  if (!contentType) return null;

  let stat;
  try {
    stat = fs.statSync(resolved);
  } catch (_) {
    return null;
  }
  if (!stat.isFile()) return null;
  if (Number.isFinite(Number(options.maxBytes)) && stat.size > Number(options.maxBytes)) return null;

  const cacheId = generatedImageCacheId(resolved, { threadId: options.threadId });
  const cachedPath = generatedImagePathForId(options.cacheRoot, cacheId);
  fs.mkdirSync(path.dirname(cachedPath), { recursive: true });
  let shouldCopy = true;
  try {
    const existing = fs.statSync(cachedPath);
    shouldCopy = !existing.isFile() || existing.size !== stat.size || existing.mtimeMs < stat.mtimeMs;
  } catch (_) {
    shouldCopy = true;
  }
  if (shouldCopy) fs.copyFileSync(resolved, cachedPath);

  return {
    cacheId,
    cachedPath,
    sourcePath: resolved,
    fileName: path.basename(resolved),
    contentType,
    sizeBytes: stat.size,
  };
}

module.exports = {
  cacheGeneratedImageDataUrl,
  cacheGeneratedImageForItem,
  generatedImageCacheId,
  generatedImagePathForId,
  imageContentTypeForPath,
  imageViewSourcePath,
  parseGeneratedImageDataUrl,
};
