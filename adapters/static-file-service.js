"use strict";

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const DEFAULT_STATIC_COMPRESSION_MIN_BYTES = 1024;
const DEFAULT_STATIC_COMPRESSION_CACHE_MAX_BYTES = 16 * 1024 * 1024;
const STATIC_COMPRESSIBLE_EXTENSIONS = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".svg",
  ".txt",
  ".webmanifest",
]);

function acceptsEncoding(req, encoding) {
  const header = String(req && req.headers && req.headers["accept-encoding"] || "").toLowerCase();
  if (!header) return false;
  const needle = String(encoding || "").toLowerCase();
  return header.split(",").some((part) => {
    const [name, ...params] = part.trim().split(";").map((value) => value.trim());
    if (name !== needle) return false;
    return !params.some((param) => /^q=0(?:\.0*)?$/.test(param));
  });
}

function defaultRequestUrl(req) {
  return new URL(req.url, `http://${req.headers.host || "localhost"}`);
}

function createStaticFileService(options = {}) {
  const publicRoot = path.resolve(options.publicRoot || path.join(process.cwd(), "public"));
  const mimeFor = typeof options.mimeFor === "function"
    ? options.mimeFor
    : () => "application/octet-stream";
  const getUrl = typeof options.getUrl === "function" ? options.getUrl : defaultRequestUrl;
  const frameAncestorsHeader = typeof options.frameAncestorsHeader === "function"
    ? options.frameAncestorsHeader
    : () => "'self'";
  const compressionMinBytes = Number.isFinite(Number(options.compressionMinBytes))
    ? Math.max(0, Number(options.compressionMinBytes))
    : DEFAULT_STATIC_COMPRESSION_MIN_BYTES;
  const compressionCacheMaxBytes = Number.isFinite(Number(options.compressionCacheMaxBytes))
    ? Math.max(0, Number(options.compressionCacheMaxBytes))
    : DEFAULT_STATIC_COMPRESSION_CACHE_MAX_BYTES;
  const staticCompressionCache = new Map();
  let staticCompressionCacheBytes = 0;

  function staticCompressionEncoding(req, target, byteLength) {
    if (Number(byteLength || 0) < compressionMinBytes) return "";
    if (!STATIC_COMPRESSIBLE_EXTENSIONS.has(path.extname(target).toLowerCase())) return "";
    if (acceptsEncoding(req, "br")) return "br";
    if (acceptsEncoding(req, "gzip")) return "gzip";
    return "";
  }

  function compressStaticBody(data, encoding, callback) {
    if (encoding === "br") {
      zlib.brotliCompress(data, {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: 5,
        },
      }, callback);
      return;
    }
    if (encoding === "gzip") {
      zlib.gzip(data, { level: 6 }, callback);
      return;
    }
    callback(null, data);
  }

  function staticCompressionCacheKey(target, stat, encoding) {
    return [
      path.resolve(target),
      encoding,
      stat.size,
      Math.round(Number(stat.mtimeMs || 0)),
    ].join("|");
  }

  function getStaticCompressionCache(key) {
    const entry = staticCompressionCache.get(key);
    if (!entry) return null;
    staticCompressionCache.delete(key);
    staticCompressionCache.set(key, entry);
    return entry;
  }

  function rememberStaticCompressionCache(key, body) {
    if (!key || !Buffer.isBuffer(body) || !body.length) return;
    if (body.length > compressionCacheMaxBytes) return;
    const previous = staticCompressionCache.get(key);
    if (previous) {
      staticCompressionCacheBytes -= previous.body.length;
      staticCompressionCache.delete(key);
    }
    staticCompressionCache.set(key, { body });
    staticCompressionCacheBytes += body.length;
    while (staticCompressionCacheBytes > compressionCacheMaxBytes && staticCompressionCache.size) {
      const oldestKey = staticCompressionCache.keys().next().value;
      const oldest = staticCompressionCache.get(oldestKey);
      staticCompressionCache.delete(oldestKey);
      if (oldest && oldest.body) staticCompressionCacheBytes -= oldest.body.length;
    }
  }

  function clearStaticCompressionCache() {
    staticCompressionCache.clear();
    staticCompressionCacheBytes = 0;
  }

  function staticCompressionCacheStats() {
    return {
      entries: staticCompressionCache.size,
      bytes: staticCompressionCacheBytes,
    };
  }

  function writeStaticResponse(res, headers, body) {
    headers["Content-Length"] = body.length;
    res.writeHead(200, headers);
    res.end(body);
  }

  function serveStatic(req, res) {
    const url = getUrl(req);
    const rel = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
    const target = path.normalize(path.join(publicRoot, rel));
    if (!target.startsWith(publicRoot)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    fs.stat(target, (statErr, stat) => {
      if (statErr || !stat.isFile()) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const headers = {
        "Content-Type": mimeFor(target),
        "Cache-Control": "no-cache",
      };
      if (target.endsWith(".html")) {
        headers["Content-Security-Policy"] = `frame-ancestors ${frameAncestorsHeader()}`;
      }
      const encoding = staticCompressionEncoding(req, target, stat.size);
      const cacheKey = encoding ? staticCompressionCacheKey(target, stat, encoding) : "";
      const cached = cacheKey ? getStaticCompressionCache(cacheKey) : null;
      if (cached) {
        headers["Content-Encoding"] = encoding;
        headers.Vary = "Accept-Encoding";
        writeStaticResponse(res, headers, cached.body);
        return;
      }
      fs.readFile(target, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        if (!encoding) {
          writeStaticResponse(res, headers, data);
          return;
        }
        compressStaticBody(data, encoding, (compressErr, compressed) => {
          if (compressErr) {
            writeStaticResponse(res, headers, data);
            return;
          }
          headers["Content-Encoding"] = encoding;
          headers.Vary = "Accept-Encoding";
          rememberStaticCompressionCache(cacheKey, compressed);
          writeStaticResponse(res, headers, compressed);
        });
      });
    });
  }

  return {
    clearStaticCompressionCache,
    serveStatic,
    staticCompressionCacheStats,
    staticCompressionEncoding,
  };
}

module.exports = {
  acceptsEncoding,
  createStaticFileService,
};
