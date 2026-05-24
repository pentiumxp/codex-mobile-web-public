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
  parsePersistExtendedHistoryEnv,
  shouldPersistExtendedHistoryForUploads,
};
