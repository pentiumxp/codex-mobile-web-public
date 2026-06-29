"use strict";

function stableJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
}

function normalizeTtlMs(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.trunc(n);
}

function createPublicConfigRuntimeCache(options = {}) {
  const now = typeof options.now === "function" ? options.now : () => Date.now();
  const profileTtlMs = normalizeTtlMs(options.profileTtlMs, 5000);
  let profileCache = null;

  function profileSignature(input = {}) {
    return stableJson({
      activeQuota: input.activeQuota || null,
    });
  }

  function invalidateProfiles() {
    profileCache = null;
  }

  function getProfileState(input = {}) {
    if (typeof input.loadProfiles !== "function") {
      throw new Error("public_config_profile_loader_required");
    }
    const signature = profileSignature(input);
    const nowMs = now();
    if (
      profileCache
      && profileCache.signature === signature
      && profileCache.expiresAt > nowMs
    ) {
      return {
        value: profileCache.value,
        cacheHit: true,
        signature,
        expiresInMs: profileCache.expiresAt - nowMs,
      };
    }

    const value = input.loadProfiles({ activeQuota: input.activeQuota });
    profileCache = {
      value,
      signature,
      expiresAt: nowMs + profileTtlMs,
    };
    return {
      value,
      cacheHit: false,
      signature,
      expiresInMs: profileTtlMs,
    };
  }

  return {
    getProfileState,
    invalidateProfiles,
    profileSignature,
  };
}

module.exports = {
  createPublicConfigRuntimeCache,
  stableJson,
};
