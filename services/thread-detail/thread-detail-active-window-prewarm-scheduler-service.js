"use strict";

const {
  normalizeRuntimeJobDeclaration,
} = require("../runtime/runtime-job-scheduler-service");

const THREAD_DETAIL_ACTIVE_WINDOW_PREWARM_JOB = normalizeRuntimeJobDeclaration(
  "thread-detail-active-window-prewarm",
  {
    timeoutMs: 30000,
    maxConcurrency: 1,
    cpuBudgetClass: "medium",
    realBrowserAllowed: false,
    userRequestPreemptible: true,
    periodicAllowed: false,
    periodicDefaultEnabled: false,
    deployDefaultEnabled: false,
  },
);

function threadDetailActiveWindowPrewarmJobPolicy() {
  return {
    name: THREAD_DETAIL_ACTIVE_WINDOW_PREWARM_JOB.name,
    periodicAllowed: THREAD_DETAIL_ACTIVE_WINDOW_PREWARM_JOB.periodicAllowed,
    maxConcurrency: THREAD_DETAIL_ACTIVE_WINDOW_PREWARM_JOB.maxConcurrency,
    timeoutMs: THREAD_DETAIL_ACTIVE_WINDOW_PREWARM_JOB.timeoutMs,
    timeBudgetMs: THREAD_DETAIL_ACTIVE_WINDOW_PREWARM_JOB.timeBudgetMs,
    cpuBudgetClass: THREAD_DETAIL_ACTIVE_WINDOW_PREWARM_JOB.cpuBudgetClass,
    realBrowserAllowed: THREAD_DETAIL_ACTIVE_WINDOW_PREWARM_JOB.realBrowserAllowed,
    usesBrowser: THREAD_DETAIL_ACTIVE_WINDOW_PREWARM_JOB.usesBrowser,
    userRequestPreemptible: THREAD_DETAIL_ACTIVE_WINDOW_PREWARM_JOB.userRequestPreemptible,
    preemptibleByForeground: THREAD_DETAIL_ACTIVE_WINDOW_PREWARM_JOB.preemptibleByForeground,
  };
}

function withThreadDetailActiveWindowPrewarmJobPolicy(value = {}) {
  return Object.assign({}, value, {
    job: threadDetailActiveWindowPrewarmJobPolicy(),
  });
}

module.exports = {
  THREAD_DETAIL_ACTIVE_WINDOW_PREWARM_JOB,
  threadDetailActiveWindowPrewarmJobPolicy,
  withThreadDetailActiveWindowPrewarmJobPolicy,
};
