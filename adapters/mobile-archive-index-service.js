"use strict";

const fs = require("node:fs");
const path = require("node:path");

const THREAD_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeThreadId(value) {
  const text = String(value || "").trim();
  return THREAD_ID_PATTERN.test(text) ? text.toLowerCase() : "";
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
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  fs.renameSync(tmp, filePath);
}

function normalizeArchivedAt(value) {
  const text = String(value || "").trim();
  return text || "";
}

function normalizeArchiveEntry(entry) {
  if (typeof entry === "string") {
    const id = normalizeThreadId(entry);
    return id ? { id, archivedAt: "" } : null;
  }
  if (!entry || typeof entry !== "object") return null;
  const id = normalizeThreadId(entry.id || entry.threadId || entry.thread_id);
  if (!id) return null;
  return {
    id,
    archivedAt: normalizeArchivedAt(entry.archivedAt || entry.archived_at),
  };
}

function archiveEntriesFromMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value).map(([id, entry]) => {
    if (entry && typeof entry === "object") {
      return normalizeArchiveEntry(Object.assign({}, entry, { id }));
    }
    return normalizeArchiveEntry({ id, archivedAt: entry });
  });
}

function normalizeArchiveStore(raw) {
  const candidates = [];
  if (Array.isArray(raw)) candidates.push(...raw);
  if (raw && typeof raw === "object") {
    if (Array.isArray(raw.archivedThreadIds)) candidates.push(...raw.archivedThreadIds);
    if (Array.isArray(raw.threadIds)) candidates.push(...raw.threadIds);
    if (Array.isArray(raw.items)) candidates.push(...raw.items);
    candidates.push(...archiveEntriesFromMap(raw.threads));
    candidates.push(...archiveEntriesFromMap(raw.archivedThreads));
  }
  const byId = new Map();
  for (const candidate of candidates) {
    const entry = normalizeArchiveEntry(candidate);
    if (!entry) continue;
    const existing = byId.get(entry.id);
    byId.set(entry.id, {
      id: entry.id,
      archivedAt: entry.archivedAt || (existing && existing.archivedAt) || "",
    });
  }
  return {
    version: 1,
    archivedThreadIds: [...byId.values()],
  };
}

function createMobileArchiveIndexService(options = {}) {
  const rawStorageFile = String(options.storageFile || "").trim();
  const storageFile = rawStorageFile ? path.resolve(rawStorageFile) : "";
  const now = typeof options.now === "function" ? options.now : () => new Date();

  function readStore() {
    if (!storageFile) return normalizeArchiveStore(null);
    return normalizeArchiveStore(readJsonFile(storageFile, { version: 1, archivedThreadIds: [] }));
  }

  function writeStore(store) {
    if (!storageFile) return false;
    writeJsonFile(storageFile, normalizeArchiveStore(store));
    return true;
  }

  function threadIds() {
    return new Set(readStore().archivedThreadIds.map((entry) => entry.id));
  }

  function has(threadId) {
    const id = normalizeThreadId(threadId);
    return Boolean(id && threadIds().has(id));
  }

  function remember(threadId, archivedAt = "") {
    const id = normalizeThreadId(threadId);
    if (!id || !storageFile) return false;
    const store = readStore();
    const byId = new Map(store.archivedThreadIds.map((entry) => [entry.id, entry]));
    const timestamp = normalizeArchivedAt(archivedAt) || now().toISOString();
    const existing = byId.get(id);
    byId.set(id, {
      id,
      archivedAt: (existing && existing.archivedAt) || timestamp,
    });
    writeStore({
      version: 1,
      archivedThreadIds: [...byId.values()],
    });
    return true;
  }

  return {
    has,
    normalizeStore: normalizeArchiveStore,
    readStore,
    remember,
    storageFile,
    threadIds,
  };
}

module.exports = {
  createMobileArchiveIndexService,
  normalizeArchiveStore,
  normalizeThreadId,
};
