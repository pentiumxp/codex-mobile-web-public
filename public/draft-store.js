"use strict";

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else if (root) {
    root.CodexDraftStore = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : null, function () {
  const DEFAULTS = {
    draftsKey: "codexMobileDraftsV1",
    draftTargetKey: "codexMobileDraftTargetV1",
    dbName: "codex-mobile-drafts",
    dbVersion: 1,
    attachmentStore: "attachments",
    maxDrafts: 80,
  };

  function defaultNormalizeFsPath(value) {
    return String(value || "")
      .replace(/^\\\\\?\\/, "")
      .replace(/[\\/]+/g, "\\")
      .replace(/\\+$/, "")
      .toLowerCase();
  }

  function safeStorage(options) {
    return options && options.storage ? options.storage : null;
  }

  function report(options, type, details) {
    if (options && typeof options.reportError === "function") options.reportError(type, details || {});
  }

  function parseDraftMap(raw) {
    try {
      const value = raw ? JSON.parse(raw) : {};
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    } catch (_) {
      return {};
    }
  }

  function normalizeAttachmentMeta(item) {
    if (!item || !item.id || !item.file) return null;
    return {
      id: String(item.id),
      name: String(item.file.name || "upload"),
      type: String(item.file.type || ""),
      size: Number(item.file.size || 0),
      lastModified: Number(item.file.lastModified || 0),
    };
  }

  function draftHasContent(draft) {
    return Boolean(draft
      && (String(draft.text || "").trim()
        || (Array.isArray(draft.attachments) && draft.attachments.length)
        || draft.model
        || draft.effort
        || draft.permissionMode
        || draft.fastMode === true));
  }

  function attachmentStorageKey(draftKey, attachmentIdValue) {
    return `${encodeURIComponent(draftKey)}|${encodeURIComponent(attachmentIdValue)}`;
  }

  function createDraftStore(options = {}) {
    const config = Object.assign({}, DEFAULTS, options);
    const normalizeFsPath = typeof config.normalizeFsPath === "function"
      ? config.normalizeFsPath
      : defaultNormalizeFsPath;
    let dbPromise = null;

    function keyForThread(threadId) {
      const id = String(threadId || "").trim();
      return id ? `thread:${id}` : "";
    }

    function keyForNewThread(cwd) {
      const key = normalizeFsPath(cwd || "");
      return key ? `new:${key}` : "";
    }

    function readMap() {
      const storage = safeStorage(config);
      if (!storage) return {};
      try {
        return parseDraftMap(storage.getItem(config.draftsKey));
      } catch (_) {
        return {};
      }
    }

    function writeMap(map) {
      const storage = safeStorage(config);
      if (!storage) return;
      const entries = Object.entries(map || {})
        .filter(([, draft]) => draft && typeof draft === "object")
        .sort((a, b) => Number(b[1].updatedAt || 0) - Number(a[1].updatedAt || 0))
        .slice(0, config.maxDrafts);
      const next = Object.fromEntries(entries);
      try {
        if (entries.length) storage.setItem(config.draftsKey, JSON.stringify(next));
        else storage.removeItem(config.draftsKey);
      } catch (err) {
        report(config, "draft_save_failed", { message: err.message || String(err) });
      }
    }

    function setTargetKey(key) {
      const storage = safeStorage(config);
      if (!storage) return;
      try {
        if (key) storage.setItem(config.draftTargetKey, key);
        else storage.removeItem(config.draftTargetKey);
      } catch (err) {
        report(config, "draft_target_save_failed", { message: err.message || String(err) });
      }
    }

    function getTargetKey() {
      const storage = safeStorage(config);
      if (!storage) return "";
      try {
        return String(storage.getItem(config.draftTargetKey) || "");
      } catch (_) {
        return "";
      }
    }

    function clearTargetKeyIfMatches(key) {
      if (getTargetKey() === String(key || "")) setTargetKey("");
    }

    function openAttachmentDb() {
      const indexedDBRef = config.indexedDB;
      if (!indexedDBRef || typeof indexedDBRef.open !== "function") return Promise.resolve(null);
      if (dbPromise) return dbPromise;
      dbPromise = new Promise((resolve) => {
        const request = indexedDBRef.open(config.dbName, config.dbVersion);
        request.onupgradeneeded = () => {
          const db = request.result;
          const store = db.objectStoreNames.contains(config.attachmentStore)
            ? request.transaction.objectStore(config.attachmentStore)
            : db.createObjectStore(config.attachmentStore, { keyPath: "key" });
          if (!store.indexNames.contains("draftKey")) store.createIndex("draftKey", "draftKey", { unique: false });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
          report(config, "draft_db_open_failed", { message: request.error ? request.error.message : "" });
          resolve(null);
        };
        request.onblocked = () => resolve(null);
      });
      return dbPromise;
    }

    async function storeAttachment(draftKey, item) {
      if (!draftKey || !item || !item.id || !item.file) return;
      const db = await openAttachmentDb();
      if (!db) throw new Error("Draft attachment storage unavailable");
      await new Promise((resolve, reject) => {
        const tx = db.transaction(config.attachmentStore, "readwrite");
        tx.objectStore(config.attachmentStore).put({
          key: attachmentStorageKey(draftKey, item.id),
          draftKey,
          id: item.id,
          name: item.file.name || "upload",
          type: item.file.type || "",
          lastModified: item.file.lastModified || Date.now(),
          file: item.file,
        });
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error || new Error("Draft attachment save failed"));
        tx.onabort = () => reject(tx.error || new Error("Draft attachment save aborted"));
      });
    }

    async function loadAttachment(draftKey, meta) {
      const db = await openAttachmentDb();
      if (!db || !draftKey || !meta || !meta.id) return null;
      const record = await new Promise((resolve, reject) => {
        const tx = db.transaction(config.attachmentStore, "readonly");
        const request = tx.objectStore(config.attachmentStore).get(attachmentStorageKey(draftKey, meta.id));
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error || new Error("Draft attachment read failed"));
      });
      const blob = record && record.file;
      const FileCtor = config.FileCtor;
      if (!blob || typeof FileCtor !== "function") return null;
      const file = blob instanceof FileCtor
        ? blob
        : new FileCtor([blob], meta.name || record.name || "upload", {
          type: meta.type || record.type || blob.type || "",
          lastModified: meta.lastModified || record.lastModified || Date.now(),
        });
      const urlApi = config.URLApi;
      const previewUrl = file.type && file.type.startsWith("image/") && urlApi && typeof urlApi.createObjectURL === "function"
        ? urlApi.createObjectURL(file)
        : "";
      return { id: meta.id, file, previewUrl };
    }

    async function deleteAttachments(draftKey, attachmentIds = null) {
      const db = await openAttachmentDb();
      const keyRange = config.IDBKeyRangeCtor;
      if (!db || !draftKey || !keyRange || typeof keyRange.only !== "function") return;
      const ids = attachmentIds ? new Set(Array.from(attachmentIds).map(String)) : null;
      await new Promise((resolve, reject) => {
        const tx = db.transaction(config.attachmentStore, "readwrite");
        const request = tx.objectStore(config.attachmentStore).index("draftKey").openCursor(keyRange.only(draftKey));
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) return;
          if (!ids || ids.has(String(cursor.value && cursor.value.id))) cursor.delete();
          cursor.continue();
        };
        request.onerror = () => reject(request.error || new Error("Draft attachment cleanup failed"));
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error || new Error("Draft attachment cleanup failed"));
        tx.onabort = () => reject(tx.error || new Error("Draft attachment cleanup aborted"));
      });
    }

    return {
      keyForThread,
      keyForNewThread,
      readMap,
      writeMap,
      setTargetKey,
      getTargetKey,
      clearTargetKeyIfMatches,
      hasContent: draftHasContent,
      normalizeAttachmentMeta,
      attachmentStorageKey,
      openAttachmentDb,
      storeAttachment,
      loadAttachment,
      deleteAttachments,
    };
  }

  return {
    DEFAULTS,
    defaultNormalizeFsPath,
    parseDraftMap,
    draftHasContent,
    normalizeAttachmentMeta,
    attachmentStorageKey,
    createDraftStore,
  };
}));
