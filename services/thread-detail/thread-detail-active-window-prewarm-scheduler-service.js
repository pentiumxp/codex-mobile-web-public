"use strict";

const {
  runtimeJobDeclaration,
  runtimeJobPolicy,
} = require("../runtime/runtime-job-scheduler-service");

const THREAD_DETAIL_ACTIVE_WINDOW_PREWARM_JOB = runtimeJobDeclaration("thread-detail-active-window-prewarm");

function threadDetailActiveWindowPrewarmJobPolicy() {
  return Object.assign({ name: THREAD_DETAIL_ACTIVE_WINDOW_PREWARM_JOB.name }, runtimeJobPolicy(THREAD_DETAIL_ACTIVE_WINDOW_PREWARM_JOB));
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
