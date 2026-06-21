"use strict";

const fs = require("node:fs");
const path = require("node:path");

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : 0;
}

function normalizePath(filePath) {
  const raw = String(filePath || "").trim();
  if (!raw) return "";
  try {
    return fs.realpathSync.native(raw);
  } catch (_) {
    return path.resolve(raw);
  }
}

function defaultParseJsonLine(line) {
  try {
    return JSON.parse(line);
  } catch (_) {
    return null;
  }
}

function emptyIndex(filePath) {
  return {
    filePath,
    offset: 0,
    carry: "",
    entries: [],
    parseErrorCount: 0,
    parsedLineCount: 0,
    resetCount: 0,
    sizeBytes: 0,
    mtimeMs: 0,
    updatedAtMs: 0,
  };
}

function snapshot(index, extra = {}) {
  return Object.assign({
    entries: index && Array.isArray(index.entries) ? index.entries : [],
    offset: safeNumber(index && index.offset),
    sizeBytes: safeNumber(index && index.sizeBytes),
    mtimeMs: safeNumber(index && index.mtimeMs),
    parsedLineCount: safeNumber(index && index.parsedLineCount),
    parseErrorCount: safeNumber(index && index.parseErrorCount),
    resetCount: safeNumber(index && index.resetCount),
  }, extra);
}

function createRolloutEnrichmentIndexService(options = {}) {
  const maxIndexes = Math.max(1, safeNumber(options.maxIndexes) || 200);
  const chunkBytes = Math.max(64 * 1024, safeNumber(options.chunkBytes) || 1024 * 1024);
  const now = typeof options.now === "function" ? options.now : () => Date.now();
  const parseJsonLine = typeof options.parseJsonLine === "function" ? options.parseJsonLine : defaultParseJsonLine;
  const indexes = new Map();

  function pruneIndexes() {
    while (indexes.size > maxIndexes) {
      let oldestKey = "";
      let oldestAt = Infinity;
      for (const [key, index] of indexes.entries()) {
        const updatedAt = safeNumber(index.updatedAtMs);
        if (updatedAt < oldestAt) {
          oldestAt = updatedAt;
          oldestKey = key;
        }
      }
      if (!oldestKey) break;
      indexes.delete(oldestKey);
    }
  }

  function resetIndex(index, stat) {
    index.offset = 0;
    index.carry = "";
    index.entries = [];
    index.parseErrorCount = 0;
    index.parsedLineCount = 0;
    index.resetCount += 1;
    index.sizeBytes = safeNumber(stat && stat.size);
    index.mtimeMs = Math.trunc(Number(stat && stat.mtimeMs || 0));
  }

  function appendText(index, text) {
    const combined = `${index.carry || ""}${text || ""}`;
    if (!combined) return { parsedLines: 0, parseErrors: 0 };
    const complete = /\r?\n$/.test(combined);
    const lines = combined.split(/\r?\n/);
    index.carry = complete ? "" : lines.pop() || "";
    let parsedLines = 0;
    let parseErrors = 0;
    for (const line of lines) {
      if (!line || !line.trim()) continue;
      const parsed = parseJsonLine(line);
      if (!parsed) {
        parseErrors += 1;
        continue;
      }
      index.entries.push(parsed);
      parsedLines += 1;
    }
    index.parsedLineCount += parsedLines;
    index.parseErrorCount += parseErrors;
    return { parsedLines, parseErrors };
  }

  function read(filePath) {
    const key = normalizePath(filePath);
    if (!key) return snapshot(emptyIndex(""));
    let stat;
    try {
      stat = fs.statSync(key);
      if (!stat.isFile()) return snapshot(emptyIndex(key));
    } catch (_) {
      indexes.delete(key);
      return snapshot(emptyIndex(key), { missing: true });
    }

    let index = indexes.get(key);
    if (!index) {
      index = emptyIndex(key);
      indexes.set(key, index);
    } else if (safeNumber(stat.size) < safeNumber(index.offset)) {
      resetIndex(index, stat);
    }

    const previousOffset = safeNumber(index.offset);
    const sizeBytes = safeNumber(stat.size);
    let parsedLines = 0;
    let parseErrors = 0;
    let bytesRead = 0;
    if (sizeBytes > previousOffset) {
      let fd = null;
      try {
        fd = fs.openSync(key, "r");
        let position = previousOffset;
        while (position < sizeBytes) {
          const length = Math.min(chunkBytes, sizeBytes - position);
          const buffer = Buffer.alloc(length);
          const readBytes = fs.readSync(fd, buffer, 0, length, position);
          if (readBytes <= 0) break;
          position += readBytes;
          bytesRead += readBytes;
          const result = appendText(index, buffer.subarray(0, readBytes).toString("utf8"));
          parsedLines += result.parsedLines;
          parseErrors += result.parseErrors;
        }
        index.offset = position;
      } catch (_) {
        indexes.delete(key);
        return snapshot(emptyIndex(key), { readError: true });
      } finally {
        if (fd !== null) {
          try {
            fs.closeSync(fd);
          } catch (_) {}
        }
      }
    }

    index.sizeBytes = sizeBytes;
    index.mtimeMs = Math.trunc(Number(stat.mtimeMs || 0));
    index.updatedAtMs = now();
    pruneIndexes();
    return snapshot(index, {
      bytesRead,
      parsedLines,
      parseErrors,
      cacheHit: bytesRead === 0,
    });
  }

  function forget(filePath) {
    const key = normalizePath(filePath);
    if (!key) return false;
    return indexes.delete(key);
  }

  function stats() {
    return {
      size: indexes.size,
      maxIndexes,
      paths: Array.from(indexes.keys()),
    };
  }

  return {
    forget,
    read,
    stats,
  };
}

module.exports = {
  createRolloutEnrichmentIndexService,
};
