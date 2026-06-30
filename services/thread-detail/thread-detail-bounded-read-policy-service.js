"use strict";

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function configuredNumber(value) {
  return typeof value === "undefined" ? 0 : Number(value);
}

function projectionRolloutSizeBytes(projection) {
  const stats = projection && projection.rolloutStats && typeof projection.rolloutStats === "object"
    ? projection.rolloutStats
    : {};
  return positiveNumber(stats.sizeBytes || stats.size || 0);
}

function decideThreadDetailBoundedReadBeforeFullRead(input = {}) {
  const thresholdBytes = configuredNumber(input.thresholdBytes);
  if (thresholdBytes <= 0) {
    return {
      prefer: false,
      thresholdBytes,
      reason: "disabled",
    };
  }

  let sizeBytes = projectionRolloutSizeBytes(input.projection);
  let source = sizeBytes > 0 ? "projection" : "";
  if (!source) {
    const threadRolloutSizeBytes = typeof input.threadRolloutSizeBytes === "function"
      ? input.threadRolloutSizeBytes
      : () => 0;
    sizeBytes = positiveNumber(threadRolloutSizeBytes(input.summary));
    source = sizeBytes > 0 ? "summary" : "";
  }

  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return {
      prefer: false,
      thresholdBytes,
      reason: "no-rollout-size",
    };
  }

  return {
    prefer: sizeBytes >= thresholdBytes,
    rolloutSizeBytes: sizeBytes,
    thresholdBytes,
    source,
    reason: sizeBytes >= thresholdBytes ? "large-rollout" : "below-threshold",
  };
}

function createThreadDetailBoundedReadPolicyService(options = {}) {
  const thresholdBytes = configuredNumber(options.thresholdBytes);
  const threadRolloutSizeBytes = typeof options.threadRolloutSizeBytes === "function"
    ? options.threadRolloutSizeBytes
    : () => 0;

  return {
    preferBoundedReadBeforeFullRead(input = {}) {
      return decideThreadDetailBoundedReadBeforeFullRead({
        summary: input.summary,
        projection: input.projection,
        thresholdBytes,
        threadRolloutSizeBytes,
      });
    },
  };
}

module.exports = {
  createThreadDetailBoundedReadPolicyService,
  decideThreadDetailBoundedReadBeforeFullRead,
};
