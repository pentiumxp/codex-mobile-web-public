"use strict";

const {
  runtimeJobDeclaration,
  runtimeJobPolicy,
} = require("../runtime/runtime-job-scheduler-service");

const THREAD_DETAIL_FIRST_PAINT_PREWARM_JOB = runtimeJobDeclaration("thread-detail-first-paint-prewarm");

function threadDetailFirstPaintPrewarmJobPolicy() {
  return Object.assign({ name: THREAD_DETAIL_FIRST_PAINT_PREWARM_JOB.name }, runtimeJobPolicy(THREAD_DETAIL_FIRST_PAINT_PREWARM_JOB));
}

function withThreadDetailFirstPaintPrewarmJobPolicy(value = {}) {
  return Object.assign({}, value, {
    job: threadDetailFirstPaintPrewarmJobPolicy(),
  });
}

module.exports = {
  THREAD_DETAIL_FIRST_PAINT_PREWARM_JOB,
  threadDetailFirstPaintPrewarmJobPolicy,
  withThreadDetailFirstPaintPrewarmJobPolicy,
};
