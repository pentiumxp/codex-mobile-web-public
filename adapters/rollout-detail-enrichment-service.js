"use strict";

const defaultFs = require("node:fs");
const defaultPath = require("node:path");
const defaultCrypto = require("node:crypto");

function parseJsonLine(line) {
  try {
    return JSON.parse(line);
  } catch (_) {
    return null;
  }
}

function incrementBoundedDiagnosticCounter(diagnostics, key, amount = 1) {
  if (!diagnostics || typeof diagnostics !== "object") return;
  if (!/^[a-z][a-zA-Z0-9]{0,80}$/.test(String(key || ""))) return;
  const current = Number(diagnostics[key] || 0);
  const delta = Number(amount || 0);
  if (!Number.isFinite(delta) || delta <= 0) return;
  const next = (Number.isFinite(current) && current > 0 ? current : 0) + delta;
  diagnostics[key] = Math.min(Number.MAX_SAFE_INTEGER, Math.trunc(next));
}

function createRolloutDetailEnrichmentService(dependencies = {}) {
  const fs = dependencies.fs || defaultFs;
  const path = dependencies.path || defaultPath;
  const crypto = dependencies.crypto || defaultCrypto;
  const rolloutEnrichmentIndexService = dependencies.rolloutEnrichmentIndexService || { read: () => null };
  const normalizeFsPath = typeof dependencies.normalizeFsPath === "function" ? dependencies.normalizeFsPath : (value) => String(value || "");
  const timestampToMs = typeof dependencies.timestampToMs === "function" ? dependencies.timestampToMs : () => 0;
  const isContextCompactionType = typeof dependencies.isContextCompactionType === "function" ? dependencies.isContextCompactionType : () => false;
  const isWebSearchLikeItem = typeof dependencies.isWebSearchLikeItem === "function" ? dependencies.isWebSearchLikeItem : () => false;
  const isOperationalItem = typeof dependencies.isOperationalItem === "function" ? dependencies.isOperationalItem : () => false;
  const collectTurnUsageSummariesFromRolloutText = typeof dependencies.collectTurnUsageSummariesFromRolloutText === "function"
    ? dependencies.collectTurnUsageSummariesFromRolloutText
    : () => ({ byTurnId: new Map(), unscoped: [] });
  const collectTurnUsageSummariesFromEntries = typeof dependencies.collectTurnUsageSummariesFromEntries === "function"
    ? dependencies.collectTurnUsageSummariesFromEntries
    : () => ({ byTurnId: new Map(), unscoped: [] });
  const attachGeneratedImageContent = typeof dependencies.attachGeneratedImageContent === "function"
    ? dependencies.attachGeneratedImageContent
    : () => {};
  const isPathInside = typeof dependencies.isPathInside === "function" ? dependencies.isPathInside : () => false;
  const uploadRoot = String(dependencies.uploadRoot || "");
  const maxRolloutContextBytes = Math.max(256 * 1024, Number(dependencies.maxRolloutContextBytes || 4 * 1024 * 1024));
  const maxRuntimeContextScanBytes = Math.max(maxRolloutContextBytes, Number(dependencies.maxRuntimeContextScanBytes || 32 * 1024 * 1024));
  const maxRolloutEnrichmentContextBytes = Math.max(maxRolloutContextBytes, Number(dependencies.maxRolloutEnrichmentContextBytes || 32 * 1024 * 1024));
  const runtimeContextCacheTtlMs = Math.max(1000, Number(dependencies.runtimeContextCacheTtlMs || 30000));
  const runtimeContextCacheMax = Math.max(20, Number(dependencies.runtimeContextCacheMax || 200));

  const latestItemTimestampsByPath = new Map();
  const latestTurnUsageSummariesByPath = new Map();
  const latestToolOutputImagesByPath = new Map();
  const latestEnrichmentEntriesByPath = new Map();
  const enrichmentEntriesCacheMax = Math.max(2, Math.min(runtimeContextCacheMax, 4));

  function runtimeContextCacheKey(rolloutPath, stat) {
    return `${normalizeFsPath(rolloutPath)}:${stat.size}:${Math.trunc(Number(stat.mtimeMs || 0))}`;
  }

  function rememberBounded(cache, key, payload) {
    cache.set(key, {
      cachedAt: Date.now(),
      payload: payload || null,
    });
    while (cache.size > runtimeContextCacheMax) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
  }

  function rememberEnrichmentEntries(key, payload) {
    latestEnrichmentEntriesByPath.set(key, Object.assign({ cachedAt: Date.now() }, payload || {}));
    while (latestEnrichmentEntriesByPath.size > enrichmentEntriesCacheMax) {
      const firstKey = latestEnrichmentEntriesByPath.keys().next().value;
      latestEnrichmentEntriesByPath.delete(firstKey);
    }
  }

  function readRolloutSlice(rolloutPath, start, length) {
    if (!rolloutPath || typeof rolloutPath !== "string" || !length || length <= 0) return "";
    let fd = null;
    try {
      const buffer = Buffer.alloc(length);
      fd = fs.openSync(rolloutPath, "r");
      const read = fs.readSync(fd, buffer, 0, length, start);
      return buffer.subarray(0, read).toString("utf8");
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

  function parseJsonLineEntriesWithOffsets(text, absoluteStart = 0, options = {}) {
    const entries = [];
    const includeOpenFinalLine = options.includeOpenFinalLine !== false;
    let lineStart = 0;
    for (let index = 0; index <= text.length; index += 1) {
      const atEnd = index >= text.length;
      if (!atEnd && text.charCodeAt(index) !== 10) continue;
      if (atEnd && !includeOpenFinalLine && lineStart < text.length) break;
      let line = text.slice(lineStart, index);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.trim()) {
        const entry = parseJsonLine(line);
        if (entry) entries.push({ entry, endOffset: absoluteStart + index + (atEnd ? 0 : 1) });
      }
      lineStart = index + 1;
    }
    return entries;
  }

  function publicParsedEntries(parsedEntries) {
    return (Array.isArray(parsedEntries) ? parsedEntries : []).map((item) => item && item.entry).filter(Boolean);
  }

  function readRolloutTail(rolloutPath, maxBytes = maxRolloutContextBytes, options = {}) {
    if (maxBytes && typeof maxBytes === "object") {
      options = maxBytes;
      maxBytes = maxRolloutContextBytes;
    }
    if (!rolloutPath || typeof rolloutPath !== "string" || !fs.existsSync(rolloutPath)) return "";
    let fd = null;
    try {
      const stat = fs.statSync(rolloutPath);
      const limit = Math.max(1, Number(maxBytes) || maxRolloutContextBytes);
      const start = Math.max(0, stat.size - limit);
      const length = stat.size - start;
      const buffer = Buffer.alloc(length);
      fd = fs.openSync(rolloutPath, "r");
      fs.readSync(fd, buffer, 0, length, start);
      const counterPrefix = String(options.counterPrefix || "");
      if (counterPrefix) {
        incrementBoundedDiagnosticCounter(options.diagnostics, `${counterPrefix}ReadCount`);
        incrementBoundedDiagnosticCounter(options.diagnostics, `${counterPrefix}Bytes`, length);
      }
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

  function readRolloutRuntimeScanText(rolloutPath) {
    if (!rolloutPath || typeof rolloutPath !== "string" || !fs.existsSync(rolloutPath)) return "";
    try {
      const stat = fs.statSync(rolloutPath);
      if (!stat.isFile() || stat.size <= 0 || stat.size > maxRuntimeContextScanBytes) return "";
      return fs.readFileSync(rolloutPath, "utf8");
    } catch (_) {
      return "";
    }
  }

  function readRolloutEnrichmentText(rolloutPath) {
    const full = readRolloutRuntimeScanText(rolloutPath);
    if (full) return full;
    return readRolloutTail(rolloutPath, maxRolloutEnrichmentContextBytes);
  }

  function readRolloutEnrichmentEntries(rolloutPath) {
    if (!rolloutPath || typeof rolloutPath !== "string" || !fs.existsSync(rolloutPath)) return [];
    let stat = null;
    try {
      stat = fs.statSync(rolloutPath);
      if (!stat.isFile() || stat.size <= 0) return [];
    } catch (_) {
      return [];
    }
    if (stat.size <= maxRuntimeContextScanBytes) {
      const indexed = rolloutEnrichmentIndexService.read(rolloutPath);
      if (indexed && !indexed.readError) {
        return Array.isArray(indexed.entries) ? indexed.entries : [];
      }
    }
    const pathKey = normalizeFsPath(rolloutPath);
    const nowMs = Date.now();
    const cached = latestEnrichmentEntriesByPath.get(pathKey);
    if (cached && nowMs - Number(cached.cachedAt || 0) <= runtimeContextCacheTtlMs) {
      if (Number(cached.size || 0) === stat.size
        && Math.trunc(Number(cached.mtimeMs || 0)) === Math.trunc(Number(stat.mtimeMs || 0))) {
        cached.cachedAt = nowMs;
        return publicParsedEntries(cached.entries);
      }
      if (stat.size > Number(cached.size || 0)
        && stat.size - Number(cached.size || 0) <= maxRolloutEnrichmentContextBytes
        && Number(cached.size || 0) >= Number(cached.start || 0)) {
        const appended = readRolloutSlice(rolloutPath, Number(cached.size), stat.size - Number(cached.size));
        const appendedEntries = parseJsonLineEntriesWithOffsets(appended, Number(cached.size));
        const minOffset = Math.max(0, stat.size - maxRolloutEnrichmentContextBytes);
        const entries = [...(Array.isArray(cached.entries) ? cached.entries : []), ...appendedEntries]
          .filter((item) => item && Number(item.endOffset || 0) >= minOffset);
        rememberEnrichmentEntries(pathKey, {
          size: stat.size,
          mtimeMs: Number(stat.mtimeMs || 0),
          start: minOffset,
          entries,
        });
        return publicParsedEntries(entries);
      }
    }
    const full = readRolloutRuntimeScanText(rolloutPath);
    if (full) {
      const entries = parseJsonLineEntriesWithOffsets(full, 0);
      rememberEnrichmentEntries(pathKey, {
        size: stat.size,
        mtimeMs: Number(stat.mtimeMs || 0),
        start: 0,
        entries,
      });
      return publicParsedEntries(entries);
    }
    const start = Math.max(0, stat.size - maxRolloutEnrichmentContextBytes);
    const tail = readRolloutSlice(rolloutPath, start, stat.size - start);
    const entries = parseJsonLineEntriesWithOffsets(tail, start);
    rememberEnrichmentEntries(pathKey, {
      size: stat.size,
      mtimeMs: Number(stat.mtimeMs || 0),
      start,
      entries,
    });
    return publicParsedEntries(entries);
  }

  function rolloutEntryTurnId(entry) {
    const payload = entry && entry.payload;
    return String((payload && (
      payload.turn_id
      || payload.turnId
      || (payload.turn && payload.turn.id)
      || (payload.turn && payload.turn.turn_id)
    )) || entry.turn_id || entry.turnId || "");
  }

  function rolloutItemTimestampCandidateType(entry) {
    if (!entry || !entry.payload) return "";
    const payload = entry.payload;
    if (entry.type === "event_msg") {
      if (payload.type === "user_message") return "userMessage";
      if (payload.type === "agent_message") return "agentMessage";
      if (payload.type === "agent_reasoning") return "reasoning";
      if (payload.type === "exec_command_end") return "commandExecution";
      if (payload.type === "patch_apply_end") return "fileChange";
      if (payload.type === "web_search_end") return "dynamicToolCall";
      if (payload.type === "context_compacted" || isContextCompactionType(payload.type)) return "contextCompaction";
      return "";
    }
    if (entry.type !== "response_item") return "";
    if (payload.type === "message") {
      if (payload.role === "user") return "userMessage";
      if (payload.role === "assistant") return "agentMessage";
      return "";
    }
    if (payload.type === "reasoning") return "reasoning";
    if (payload.type === "function_call") return "commandExecution";
    if (payload.type === "web_search_call") return "dynamicToolCall";
    if (payload.type === "custom_tool_call") return payload.name === "apply_patch" ? "fileChange" : "dynamicToolCall";
    return "";
  }

  function normalizeTimestampMatchText(value) {
    if (value == null) return "";
    if (typeof value === "string") return value.replace(/\s+/g, " ").trim();
    if (Array.isArray(value)) {
      return value.map((entry) => {
        if (typeof entry === "string") return entry;
        if (!entry || typeof entry !== "object") return "";
        return entry.text || entry.message || entry.content || "";
      }).join(" ").replace(/\s+/g, " ").trim();
    }
    if (typeof value === "object") {
      return normalizeTimestampMatchText(value.text || value.message || value.content || value.summary || "");
    }
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function rolloutItemTimestampCandidateText(entry) {
    const payload = entry && entry.payload;
    if (!payload || typeof payload !== "object") return "";
    return normalizeTimestampMatchText(
      payload.message
      || payload.text
      || payload.content
      || payload.summary
      || payload.output,
    );
  }

  function rolloutItemTimestampCandidateId(entry) {
    const payload = entry && entry.payload;
    return String((payload && (payload.id || payload.call_id || payload.item_id || payload.itemId)) || "");
  }

  function itemTimestampCandidateId(item) {
    return String((item && (item.id || item.call_id || item.callId || item.item_id || item.itemId)) || "");
  }

  function visibleItemId(item) {
    return String((item && (item.id || item.itemId || item.item_id)) || "").trim();
  }

  function itemTimestampMatchText(item) {
    if (!item || typeof item !== "object") return "";
    return normalizeTimestampMatchText(
      item.text
      || item.message
      || item.content
      || item.summary
      || item.output,
    );
  }

  function timestampTextsMatch(left, right) {
    const a = normalizeTimestampMatchText(left);
    const b = normalizeTimestampMatchText(right);
    if (!a || !b) return false;
    const shortA = a.slice(0, 240);
    const shortB = b.slice(0, 240);
    return shortA === shortB || shortA.startsWith(shortB) || shortB.startsWith(shortA);
  }

  const dedupedRolloutTimestampTypes = new Set(["userMessage", "agentMessage", "reasoning"]);

  function appendRolloutItemTimestampCandidate(list, candidate) {
    if (!candidate || !candidate.itemType || !candidate.timestampMs) return;
    const last = list.length ? list[list.length - 1] : null;
    if (last
      && dedupedRolloutTimestampTypes.has(candidate.itemType)
      && last.itemType === candidate.itemType
      && Math.abs(last.timestampMs - candidate.timestampMs) <= 50) {
      if (!last.text && candidate.text) last.text = candidate.text;
      return;
    }
    list.push(candidate);
  }

  function rolloutTimestampFields(entry) {
    const timestampMs = timestampToMs(entry && entry.timestamp);
    if (!timestampMs) return {};
    return {
      startedAtMs: timestampMs,
      startedAt: new Date(timestampMs).toISOString(),
    };
  }

  function readRolloutItemTimestampCandidates(rolloutPath) {
    if (!rolloutPath || typeof rolloutPath !== "string" || !fs.existsSync(rolloutPath)) {
      return { byTurn: new Map(), unscoped: [], scopedCount: 0 };
    }
    let cacheKey = "";
    try {
      const stat = fs.statSync(rolloutPath);
      cacheKey = runtimeContextCacheKey(rolloutPath, stat);
      const cached = latestItemTimestampsByPath.get(cacheKey);
      if (cached && Date.now() - cached.cachedAt <= runtimeContextCacheTtlMs) {
        return cached.payload || { byTurn: new Map(), unscoped: [], scopedCount: 0 };
      }
    } catch (_) {
      return { byTurn: new Map(), unscoped: [], scopedCount: 0 };
    }
    const byTurn = new Map();
    const unscoped = [];
    let scopedCount = 0;
    let currentTurnId = "";
    const entries = readRolloutEnrichmentEntries(rolloutPath);
    for (const entry of entries) {
      if (!entry || !entry.type) continue;
      const payload = entry.payload || {};
      const explicitTurnId = rolloutEntryTurnId(entry);
      if (entry.type === "turn_context" && explicitTurnId) currentTurnId = explicitTurnId;
      if (entry.type === "event_msg" && payload.type === "task_started" && explicitTurnId) {
        currentTurnId = explicitTurnId;
      }
      const itemType = rolloutItemTimestampCandidateType(entry);
      const timestampMs = timestampToMs(entry.timestamp);
      if (!itemType || !timestampMs) continue;
      const turnId = explicitTurnId || currentTurnId;
      const candidate = {
        turnId,
        itemType,
        timestampMs,
        timestamp: new Date(timestampMs).toISOString(),
        entryId: rolloutItemTimestampCandidateId(entry),
        text: rolloutItemTimestampCandidateText(entry),
      };
      if (turnId) {
        if (!byTurn.has(turnId)) byTurn.set(turnId, []);
        appendRolloutItemTimestampCandidate(byTurn.get(turnId), candidate);
        scopedCount += 1;
      } else {
        appendRolloutItemTimestampCandidate(unscoped, candidate);
      }
    }
    const payload = { byTurn, unscoped, scopedCount };
    if (cacheKey) rememberBounded(latestItemTimestampsByPath, cacheKey, payload);
    return payload;
  }

  function normalizedTurnIdSet(turnIds) {
    const ids = new Set();
    for (const id of turnIds || []) {
      const text = String(id || "").trim();
      if (text) ids.add(text);
    }
    return ids;
  }

  function missingUsageTurnIds(payload, turnIds) {
    const ids = normalizedTurnIdSet(turnIds);
    if (!ids.size) return [];
    const byTurnId = payload && payload.byTurnId instanceof Map ? payload.byTurnId : new Map();
    return Array.from(ids).filter((id) => !byTurnId.has(id));
  }

  function targetUsageCacheKey(rolloutPath, turnIds) {
    const ids = Array.from(normalizedTurnIdSet(turnIds)).sort();
    if (!ids.length) return "";
    return `${normalizeFsPath(rolloutPath)}:target-usage:${ids.join(",")}`;
  }

  function readRolloutTurnUsageSummaries(rolloutPath, options = {}) {
    if (!rolloutPath || typeof rolloutPath !== "string" || !fs.existsSync(rolloutPath)) {
      return { byTurnId: new Map(), unscoped: [] };
    }
    const targetTurnIds = Array.isArray(options.targetTurnIds) ? options.targetTurnIds : [];
    const targetKey = targetUsageCacheKey(rolloutPath, targetTurnIds);
    if (targetKey) {
      const targetCached = latestTurnUsageSummariesByPath.get(targetKey);
      if (targetCached && Date.now() - targetCached.cachedAt <= runtimeContextCacheTtlMs
        && missingUsageTurnIds(targetCached.payload, targetTurnIds).length === 0) {
        return targetCached.payload || { byTurnId: new Map(), unscoped: [] };
      }
    }
    let cacheKey = "";
    try {
      const stat = fs.statSync(rolloutPath);
      cacheKey = runtimeContextCacheKey(rolloutPath, stat);
      const cached = latestTurnUsageSummariesByPath.get(cacheKey);
      if (cached && Date.now() - cached.cachedAt <= runtimeContextCacheTtlMs
        && missingUsageTurnIds(cached.payload, targetTurnIds).length === 0) {
        return cached.payload || { byTurnId: new Map(), unscoped: [] };
      }
    } catch (_) {
      return { byTurnId: new Map(), unscoped: [] };
    }
    let payload = collectTurnUsageSummariesFromRolloutText(readRolloutTail(rolloutPath));
    if (missingUsageTurnIds(payload, targetTurnIds).length > 0) {
      payload = collectTurnUsageSummariesFromEntries(readRolloutEnrichmentEntries(rolloutPath));
    }
    if (cacheKey) rememberBounded(latestTurnUsageSummariesByPath, cacheKey, payload);
    if (targetKey) rememberBounded(latestTurnUsageSummariesByPath, targetKey, payload);
    return payload;
  }

  function toolOutputImageUrlValue(part) {
    if (!part || typeof part !== "object") return "";
    const raw = part.url || part.image_url || part.imageUrl || part.uri || part.href || "";
    const value = raw && typeof raw === "object" ? raw.url || raw.uri || raw.href : raw;
    return typeof value === "string" ? value.trim() : "";
  }

  function toolOutputImagePathValue(part) {
    if (!part || typeof part !== "object") return "";
    const candidates = [
      part.path,
      part.filePath,
      part.file_path,
      part.imagePath,
      part.image_path,
      part.savedPath,
      part.saved_path,
      part.sourcePath,
      part.source_path,
    ];
    const found = candidates.find((value) => typeof value === "string" && value.trim());
    return found ? found.trim() : "";
  }

  function isToolOutputImagePart(part) {
    if (!part || typeof part !== "object") return false;
    const type = String(part.type || "").replace(/[-_]/g, "").toLowerCase();
    const url = toolOutputImageUrlValue(part);
    if (/^data:image\//i.test(url)) return true;
    return type === "image"
      || type === "inputimage"
      || type === "imageurl"
      || type === "localimage"
      || type === "imageview"
      || Boolean(url && /image/i.test(type));
  }

  function parseToolOutputStructuredValue(value) {
    if (typeof value !== "string") return value;
    const text = value.trim();
    if (!text || !/^[{\[]/.test(text)) return value;
    try {
      return JSON.parse(text);
    } catch (_) {
      return value;
    }
  }

  function collectToolOutputImageCandidates(value, out = [], seen = new Set(), depth = 0) {
    if (out.length >= 20 || value == null || depth > 6) return out;
    const parsed = parseToolOutputStructuredValue(value);
    if (typeof parsed === "string") {
      const text = parsed.trim();
      if (/^data:image\//i.test(text)) out.push({ url: text });
      return out;
    }
    if (Array.isArray(parsed)) {
      for (const entry of parsed) collectToolOutputImageCandidates(entry, out, seen, depth + 1);
      return out;
    }
    if (typeof parsed !== "object" || seen.has(parsed)) return out;
    seen.add(parsed);
    if (isToolOutputImagePart(parsed)) {
      const url = toolOutputImageUrlValue(parsed);
      const imagePath = toolOutputImagePathValue(parsed);
      if (url || imagePath) out.push({ url, path: imagePath });
    }
    for (const entry of Object.values(parsed)) collectToolOutputImageCandidates(entry, out, seen, depth + 1);
    return out;
  }

  function parseToolCallArguments(value) {
    if (!value) return {};
    if (typeof value === "object") return value;
    if (typeof value !== "string") return {};
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function viewImageToolPath(payload) {
    if (!payload || typeof payload !== "object") return "";
    if (String(payload.name || "") !== "view_image") return "";
    const args = parseToolCallArguments(payload.arguments || payload.input || payload.params);
    const candidates = [
      args.path,
      args.imagePath,
      args.image_path,
      args.filePath,
      args.file_path,
    ];
    const found = candidates.find((value) => typeof value === "string" && value.trim());
    return found ? found.trim() : "";
  }

  function isCodexMobileUploadFilePath(filePath) {
    const text = String(filePath || "").trim();
    if (!text) return false;
    return isPathInside(uploadRoot, path.resolve(text));
  }

  function shouldSuppressToolOutputImageCandidates(callInfo) {
    return Boolean(callInfo && callInfo.tool === "view_image" && isCodexMobileUploadFilePath(callInfo.viewImagePath));
  }

  function toolOutputImageFingerprint(candidate) {
    return crypto
      .createHash("sha256")
      .update(String(candidate && (candidate.url || candidate.path) || ""))
      .digest("hex")
      .slice(0, 16);
  }

  function toolOutputImageItemFromCandidate(entry, payload, candidate, index, options = {}) {
    const fingerprint = toolOutputImageFingerprint(candidate);
    const callId = String(payload && payload.call_id || "");
    const id = `tool-output-image-${callId || "call"}-${index}-${fingerprint}`;
    const imageItem = {
      id,
      type: "imageView",
      callId,
      source: "tool_output",
      fileName: "view_image output",
      label: "view_image output",
      ...rolloutTimestampFields(entry),
    };
    if (candidate && candidate.path) imageItem.path = candidate.path;
    if (candidate && candidate.url) imageItem.url = candidate.url;
    attachGeneratedImageContent(imageItem, { threadId: options.threadId || "" });
    const isInlineDataImage = candidate && typeof candidate.url === "string" && /^data:image\//i.test(candidate.url);
    const isLocalImagePath = candidate && candidate.path;
    if ((isInlineDataImage || isLocalImagePath) && !imageItem.contentUrl && !imageItem.content_url) return null;
    return imageItem;
  }

  function cloneRolloutToolOutputImagePayload(payload) {
    const byTurn = new Map();
    const sourceByTurn = payload && payload.byTurn instanceof Map ? payload.byTurn : new Map();
    for (const [turnId, items] of sourceByTurn.entries()) {
      byTurn.set(turnId, Array.isArray(items) ? items.map((item) => Object.assign({}, item)) : []);
    }
    const suppressedUploadViewImageCallIdsByTurn = new Map();
    const sourceSuppressedByTurn = payload && payload.suppressedUploadViewImageCallIdsByTurn instanceof Map
      ? payload.suppressedUploadViewImageCallIdsByTurn
      : new Map();
    for (const [turnId, callIds] of sourceSuppressedByTurn.entries()) {
      suppressedUploadViewImageCallIdsByTurn.set(String(turnId || ""), new Set(callIds instanceof Set
        ? [...callIds]
        : (Array.isArray(callIds) ? callIds : [])));
    }
    const suppressedUploadViewImageCallIds = payload && payload.suppressedUploadViewImageCallIds instanceof Set
      ? new Set(payload.suppressedUploadViewImageCallIds)
      : new Set();
    return {
      byTurn,
      unscoped: Array.isArray(payload && payload.unscoped)
        ? payload.unscoped.map((item) => Object.assign({}, item))
        : [],
      scopedCount: Number(payload && payload.scopedCount) || 0,
      suppressedUploadViewImageCallIds,
      suppressedUploadViewImageCallIdsByTurn,
    };
  }

  function turnCompletionBoundaryMs(turn) {
    for (const key of [
      "completedAtMs",
      "completedAt",
      "completed_at_ms",
      "completed_at",
      "updatedAtMs",
      "updatedAt",
      "updated_at_ms",
      "updated_at",
    ]) {
      const timestamp = timestampToMs(turn && turn[key]);
      if (timestamp) return timestamp;
    }
    return 0;
  }

  function rolloutToolOutputImageMatchesTurnByTime(turns, index, item) {
    const itemTimestamp = timestampToMs(item && (item.startedAtMs || item.startedAt));
    if (!itemTimestamp) return index === turns.length - 1;
    const turn = turns[index];
    const start = timestampToMs(turn && (turn.startedAtMs || turn.startedAt || turn.createdAt || turn.created_at));
    const end = turnCompletionBoundaryMs(turn);
    const next = turns[index + 1];
    const nextStart = timestampToMs(next && (next.startedAtMs || next.startedAt || next.createdAt || next.created_at));
    if (start && itemTimestamp < start - 1000) return false;
    if (end && itemTimestamp > end + 1000) return false;
    if (!end && nextStart && itemTimestamp >= nextStart - 1000) return false;
    return true;
  }

  function unscopedRolloutToolOutputImagesForTurn(turns, index, items) {
    return (items || []).filter((item) => rolloutToolOutputImageMatchesTurnByTime(turns, index, item));
  }

  function insertProjectedItemByTimestamp(items, item) {
    if (!Array.isArray(items) || !item) return;
    const itemTimestamp = timestampToMs(item.startedAtMs || item.startedAt || item.createdAt || item.created_at);
    if (!itemTimestamp) {
      items.push(item);
      return;
    }
    const insertAt = items.findIndex((existing) => {
      const existingTimestamp = timestampToMs(existing && (
        existing.startedAtMs || existing.startedAt || existing.createdAt || existing.created_at || existing.mobileDisplayTimestampMs || existing.mobileDisplayTimestamp
      ));
      return existingTimestamp && existingTimestamp > itemTimestamp;
    });
    if (insertAt === -1) items.push(item);
    else items.splice(insertAt, 0, item);
  }

  function readRolloutToolOutputImageItems(rolloutPath, options = {}) {
    if (!rolloutPath || typeof rolloutPath !== "string" || !fs.existsSync(rolloutPath)) {
      return {
        byTurn: new Map(),
        unscoped: [],
        scopedCount: 0,
        suppressedUploadViewImageCallIds: new Set(),
        suppressedUploadViewImageCallIdsByTurn: new Map(),
      };
    }
    let cacheKey = "";
    try {
      const stat = fs.statSync(rolloutPath);
      cacheKey = runtimeContextCacheKey(rolloutPath, stat);
      const cached = latestToolOutputImagesByPath.get(cacheKey);
      if (cached && Date.now() - cached.cachedAt <= runtimeContextCacheTtlMs) {
        return cloneRolloutToolOutputImagePayload(cached.payload);
      }
    } catch (_) {
      return {
        byTurn: new Map(),
        unscoped: [],
        scopedCount: 0,
        suppressedUploadViewImageCallIds: new Set(),
        suppressedUploadViewImageCallIdsByTurn: new Map(),
      };
    }

    const entries = readRolloutEnrichmentEntries(rolloutPath);
    const toolCallInfoById = new Map();
    const suppressedUploadViewImageCallIds = new Set();
    const suppressedUploadViewImageCallIdsByTurn = new Map();
    let currentSuppressionTurnId = "";
    for (const entry of entries) {
      if (!entry || !entry.type) continue;
      const payload = entry.payload || {};
      const explicitTurnId = rolloutEntryTurnId(entry);
      if (entry.type === "turn_context" && explicitTurnId) currentSuppressionTurnId = explicitTurnId;
      if (entry.type === "event_msg" && payload.type === "task_started" && explicitTurnId) currentSuppressionTurnId = explicitTurnId;
      if (entry.type !== "response_item" || !/^(function_call|custom_tool_call)$/.test(String(payload.type || ""))) continue;
      const callId = String(payload.call_id || "");
      if (!callId) continue;
      toolCallInfoById.set(callId, {
        tool: String(payload.name || ""),
        viewImagePath: viewImageToolPath(payload),
      });
      if (shouldSuppressToolOutputImageCandidates(toolCallInfoById.get(callId))) {
        suppressedUploadViewImageCallIds.add(callId);
        const turnId = explicitTurnId || currentSuppressionTurnId;
        if (turnId) {
          if (!suppressedUploadViewImageCallIdsByTurn.has(turnId)) {
            suppressedUploadViewImageCallIdsByTurn.set(turnId, new Set());
          }
          suppressedUploadViewImageCallIdsByTurn.get(turnId).add(callId);
        }
      }
    }
    const byTurn = new Map();
    const unscoped = [];
    const seenIds = new Set();
    const seenImageKeys = new Set();
    let scopedCount = 0;
    let currentTurnId = "";
    for (const entry of entries) {
      const payload = entry.payload || {};
      const explicitTurnId = rolloutEntryTurnId(entry);
      if (entry.type === "turn_context" && explicitTurnId) currentTurnId = explicitTurnId;
      if (entry.type === "event_msg" && payload.type === "task_started" && explicitTurnId) currentTurnId = explicitTurnId;
      if (entry.type !== "response_item" || !/^(function_call_output|custom_tool_call_output)$/.test(String(payload.type || ""))) continue;
      const callInfo = toolCallInfoById.get(String(payload.call_id || ""));
      if (shouldSuppressToolOutputImageCandidates(callInfo)) continue;
      const candidates = collectToolOutputImageCandidates(payload.output);
      if (!candidates.length) continue;
      const turnId = explicitTurnId || currentTurnId;
      const items = candidates
        .filter((candidate) => {
          const key = `${String(payload.call_id || "")}:${toolOutputImageFingerprint(candidate)}`;
          if (seenImageKeys.has(key)) return false;
          seenImageKeys.add(key);
          return true;
        })
        .map((candidate, index) => toolOutputImageItemFromCandidate(entry, payload, candidate, index, options))
        .filter(Boolean)
        .filter((item) => {
          const id = visibleItemId(item);
          if (!id || seenIds.has(id)) return false;
          seenIds.add(id);
          return true;
        });
      if (!items.length) continue;
      if (turnId) {
        if (!byTurn.has(turnId)) byTurn.set(turnId, []);
        byTurn.get(turnId).push(...items);
        scopedCount += items.length;
      } else {
        unscoped.push(...items);
      }
    }
    const payload = {
      byTurn,
      unscoped,
      scopedCount,
      suppressedUploadViewImageCallIds,
      suppressedUploadViewImageCallIdsByTurn,
    };
    if (cacheKey) rememberBounded(latestToolOutputImagesByPath, cacheKey, payload);
    return cloneRolloutToolOutputImagePayload(payload);
  }

  function rolloutPathForThread(thread) {
    return thread && (thread.path || thread.rolloutPath || thread.rollout_path) || "";
  }

  function appendRolloutToolOutputImagesToThread(thread, existingPayload = null) {
    if (!thread || typeof thread !== "object" || !Array.isArray(thread.turns) || !thread.turns.length) return thread;
    const rolloutPath = rolloutPathForThread(thread);
    if (!rolloutPath) return thread;
    const payload = existingPayload || readRolloutToolOutputImageItems(rolloutPath, {
      threadId: thread.id || thread.threadId || "",
    });
    if (!payload) return thread;
    thread.turns.forEach((turn, index) => {
      if (!turn || !Array.isArray(turn.items)) return;
      const turnId = String(turn.id || turn.turnId || "").trim();
      let imageItems = turnId && payload.byTurn instanceof Map ? payload.byTurn.get(turnId) : null;
      if ((!imageItems || !imageItems.length)
        && payload.scopedCount === 0
        && Array.isArray(payload.unscoped)
        && payload.unscoped.length) {
        imageItems = unscopedRolloutToolOutputImagesForTurn(thread.turns, index, payload.unscoped);
      }
      if (!Array.isArray(imageItems) || !imageItems.length) return;
      const existingIds = new Set(turn.items.map(visibleItemId).filter(Boolean));
      for (const item of imageItems) {
        const id = visibleItemId(item);
        if (!id || existingIds.has(id)) continue;
        insertProjectedItemByTimestamp(turn.items, Object.assign({}, item));
        existingIds.add(id);
      }
    });
    return thread;
  }

  return {
    appendRolloutToolOutputImagesToThread,
    insertProjectedItemByTimestamp,
    itemTimestampCandidateId,
    itemTimestampMatchText,
    readRolloutEnrichmentEntries,
    readRolloutEnrichmentText,
    readRolloutItemTimestampCandidates,
    readRolloutRuntimeScanText,
    readRolloutTail,
    readRolloutToolOutputImageItems,
    readRolloutTurnUsageSummaries,
    rolloutEntryTurnId,
    rolloutTimestampFields,
    timestampTextsMatch,
    visibleItemId,
  };
}

module.exports = {
  createRolloutDetailEnrichmentService,
};
