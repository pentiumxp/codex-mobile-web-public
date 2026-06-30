"use strict";

const {
  normalizeRuntimeJobDeclaration,
} = require("../runtime/runtime-job-scheduler-service");

const THREAD_LIST_FALLBACK_PREWARM_JOB = normalizeRuntimeJobDeclaration("thread-list-fallback-prewarm", {
  timeoutMs: 30000,
  maxConcurrency: 1,
  cpuBudgetClass: "medium",
  realBrowserAllowed: false,
  userRequestPreemptible: true,
  periodicAllowed: false,
  periodicDefaultEnabled: false,
  deployDefaultEnabled: false,
});

function threadListFallbackPrewarmJobPolicy() {
  return {
    name: THREAD_LIST_FALLBACK_PREWARM_JOB.name,
    periodicAllowed: THREAD_LIST_FALLBACK_PREWARM_JOB.periodicAllowed,
    maxConcurrency: THREAD_LIST_FALLBACK_PREWARM_JOB.maxConcurrency,
    timeoutMs: THREAD_LIST_FALLBACK_PREWARM_JOB.timeoutMs,
    timeBudgetMs: THREAD_LIST_FALLBACK_PREWARM_JOB.timeBudgetMs,
    cpuBudgetClass: THREAD_LIST_FALLBACK_PREWARM_JOB.cpuBudgetClass,
    realBrowserAllowed: THREAD_LIST_FALLBACK_PREWARM_JOB.realBrowserAllowed,
    usesBrowser: THREAD_LIST_FALLBACK_PREWARM_JOB.usesBrowser,
    userRequestPreemptible: THREAD_LIST_FALLBACK_PREWARM_JOB.userRequestPreemptible,
    preemptibleByForeground: THREAD_LIST_FALLBACK_PREWARM_JOB.preemptibleByForeground,
  };
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
