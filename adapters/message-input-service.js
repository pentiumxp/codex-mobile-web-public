"use strict";

function truthyEnv(value) {
  return /^(1|true|yes|on)$/i.test(String(value || ""));
}

function falsyEnv(value) {
  return /^(0|false|no|off)$/i.test(String(value || ""));
}

function hasImageUploads(uploads) {
  return Array.isArray(uploads) && uploads.some((file) => file && file.isImage);
}

function normalizeImageContextMode(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "reference";
  if (/^(0|false|no|off|path|file|reference|none)$/.test(normalized)) return "reference";
  if (/^(1|true|yes|on|vision|latest|single|local-image|localimage)$/.test(normalized)) return "latest";
  if (/^(all|legacy|full)$/.test(normalized)) return "all";
  return "reference";
}

function parseImageContextPolicyEnv(env = process.env) {
  return {
    imageContextMode: normalizeImageContextMode(env.CODEX_MOBILE_IMAGE_CONTEXT_MODE),
  };
}

function localImageUploadsForContext(uploads, options = {}) {
  const files = Array.isArray(uploads) ? uploads.filter((file) => file && file.isImage) : [];
  if (!files.length) return [];
  const mode = normalizeImageContextMode(options.imageContextMode || options.mode);
  if (mode === "all") return files;
  if (mode === "latest") return files.slice(-1);
  return [];
}

function shouldSendImageContentToModel(uploads, options = {}) {
  return localImageUploadsForContext(uploads, options).length > 0;
}

function shouldPersistExtendedHistoryForUploads(uploads, options = {}) {
  const defaultValue = Object.prototype.hasOwnProperty.call(options, "defaultPersist")
    ? Boolean(options.defaultPersist)
    : true;
  const persistImageUploads = Boolean(options.persistImageUploads);
  if (!defaultValue) return false;
  if (hasImageUploads(uploads) && !persistImageUploads) return false;
  return true;
}

function parsePersistExtendedHistoryEnv(env = process.env) {
  const defaultRaw = env.CODEX_MOBILE_PERSIST_EXTENDED_HISTORY;
  const imageRaw = env.CODEX_MOBILE_PERSIST_IMAGE_EXTENDED_HISTORY;
  return {
    defaultPersist: defaultRaw === undefined || defaultRaw === "" ? true : !falsyEnv(defaultRaw),
    persistImageUploads: truthyEnv(imageRaw),
  };
}

module.exports = {
  hasImageUploads,
  localImageUploadsForContext,
  normalizeImageContextMode,
  parseImageContextPolicyEnv,
  parsePersistExtendedHistoryEnv,
  shouldSendImageContentToModel,
  shouldPersistExtendedHistoryForUploads,
};
