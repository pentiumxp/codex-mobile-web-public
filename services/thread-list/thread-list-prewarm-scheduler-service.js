"use strict";

const {
  runtimeJobDeclaration,
  runtimeJobPolicy,
} = require("../runtime/runtime-job-scheduler-service");

const THREAD_LIST_FALLBACK_PREWARM_JOB = runtimeJobDeclaration("thread-list-fallback-prewarm");

function threadListFallbackPrewarmJobPolicy() {
  return Object.assign({ name: THREAD_LIST_FALLBACK_PREWARM_JOB.name }, runtimeJobPolicy(THREAD_LIST_FALLBACK_PREWARM_JOB));
}

function withThreadListFallbackPrewarmJobPolicy(value = {}) {
  return Object.assign({}, value, {
    job: threadListFallbackPrewarmJobPolicy(),
  });
}

module.exports = {
  THREAD_LIST_FALLBACK_PREWARM_JOB,
  threadListFallbackPrewarmJobPolicy,
  withThreadListFallbackPrewarmJobPolicy,
};
