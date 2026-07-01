"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const serverJs = fs.readFileSync(path.resolve(__dirname, "..", "server.js"), "utf8");
const threadListRouteServiceJs = fs.readFileSync(
  path.resolve(__dirname, "..", "server-routes", "thread-list-route-service.js"),
  "utf8",
);
const threadListRuntimeServiceJs = fs.readFileSync(
  path.resolve(__dirname, "..", "services", "thread-list", "thread-list-runtime-service.js"),
  "utf8",
);
const packageJson = fs.readFileSync(path.resolve(__dirname, "..", "package.json"), "utf8");

const serviceBoundaries = [
  {
    canonical: require("../services/thread-list/thread-list-fallback-source-service"),
    adapter: require("../adapters/thread-list-fallback-source-service"),
    exports: ["createThreadListFallbackSourceService"],
    servicePath: "services/thread-list/thread-list-fallback-source-service.js",
    adapterPath: "adapters/thread-list-fallback-source-service.js",
  },
  {
    canonical: require("../services/thread-list/thread-summary-state-service"),
    adapter: require("../adapters/thread-summary-state-service"),
    exports: ["createThreadSummaryStateService"],
    servicePath: "services/thread-list/thread-summary-state-service.js",
    adapterPath: "adapters/thread-summary-state-service.js",
  },
  {
    canonical: require("../services/thread-list/thread-list-fallback-baseline-service"),
    adapter: require("../adapters/thread-list-fallback-baseline-service"),
    exports: ["createThreadListFallbackBaselineService"],
    servicePath: "services/thread-list/thread-list-fallback-baseline-service.js",
    adapterPath: "adapters/thread-list-fallback-baseline-service.js",
  },
  {
    canonical: require("../services/thread-list/thread-list-fallback-cache-service"),
    adapter: require("../adapters/thread-list-fallback-cache-service"),
    exports: ["createThreadListFallbackCacheService"],
    servicePath: "services/thread-list/thread-list-fallback-cache-service.js",
    adapterPath: "adapters/thread-list-fallback-cache-service.js",
  },
  {
    canonical: require("../services/thread-list/thread-list-fallback-persistent-cache-store"),
    adapter: require("../adapters/thread-list-fallback-persistent-cache-store"),
    exports: ["createThreadListFallbackPersistentCacheStore"],
    servicePath: "services/thread-list/thread-list-fallback-persistent-cache-store.js",
    adapterPath: "adapters/thread-list-fallback-persistent-cache-store.js",
  },
  {
    canonical: require("../services/thread-list/thread-list-fallback-prewarm-service"),
    adapter: require("../adapters/thread-list-fallback-prewarm-service"),
    exports: [
      "createThreadListFallbackPrewarmService",
      "summarizePrewarmStatus",
      "threadListFallbackPrewarmJobPolicy",
      "withThreadListFallbackPrewarmJobPolicy",
    ],
    servicePath: "services/thread-list/thread-list-fallback-prewarm-service.js",
    adapterPath: "adapters/thread-list-fallback-prewarm-service.js",
  },
  {
    canonical: require("../services/thread-list/thread-list-app-server-fetch-policy-service"),
    adapter: require("../adapters/thread-list-app-server-fetch-policy-service"),
    exports: [
      "planThreadListAppServerFetch",
      "planThreadListInitialFallbackAttempt",
      "threadListAppServerFetchTimingFields",
      "threadListAppServerLatencyTimingFields",
      "threadListInitialFallbackMetadata",
    ],
    servicePath: "services/thread-list/thread-list-app-server-fetch-policy-service.js",
    adapterPath: "adapters/thread-list-app-server-fetch-policy-service.js",
  },
  {
    canonical: require("../services/thread-list/thread-list-route-merge-service"),
    adapter: require("../adapters/thread-list-route-merge-service"),
    exports: ["mergeThreadListRouteResult"],
    servicePath: "services/thread-list/thread-list-route-merge-service.js",
    adapterPath: "adapters/thread-list-route-merge-service.js",
  },
  {
    canonical: require("../services/thread-list/thread-list-summary-merge-service"),
    adapter: require("../adapters/thread-list-summary-merge-service"),
    exports: ["createThreadListSummaryMergeService"],
    servicePath: "services/thread-list/thread-list-summary-merge-service.js",
    adapterPath: "adapters/thread-list-summary-merge-service.js",
  },
  {
    canonical: require("../services/thread-list/thread-list-request-context-service"),
    adapter: require("../adapters/thread-list-request-context-service"),
    exports: ["createThreadListRequestContext"],
    servicePath: "services/thread-list/thread-list-request-context-service.js",
    adapterPath: "adapters/thread-list-request-context-service.js",
  },
  {
    canonical: require("../services/thread-list/thread-list-response-coalescer-service"),
    adapter: require("../adapters/thread-list-response-coalescer-service"),
    exports: ["createThreadListResponseCoalescer"],
    servicePath: "services/thread-list/thread-list-response-coalescer-service.js",
    adapterPath: "adapters/thread-list-response-coalescer-service.js",
  },
  {
    canonical: require("../services/thread-list/thread-list-cold-path-diagnosis-service"),
    adapter: require("../adapters/thread-list-cold-path-diagnosis-service"),
    exports: ["diagnoseThreadListColdPath"],
    servicePath: "services/thread-list/thread-list-cold-path-diagnosis-service.js",
    adapterPath: "adapters/thread-list-cold-path-diagnosis-service.js",
  },
  {
    canonical: require("../services/thread-list/thread-list-summary-service"),
    adapter: require("../adapters/thread-list-summary-service"),
    exports: ["stripThreadListDetailFields", "stripThreadListResultDetailFields"],
    servicePath: "services/thread-list/thread-list-summary-service.js",
    adapterPath: "adapters/thread-list-summary-service.js",
  },
  {
    canonical: require("../services/thread-list/thread-list-state-service"),
    adapter: require("../adapters/thread-list-state-service"),
    exports: ["createThreadListStateService"],
    servicePath: "services/thread-list/thread-list-state-service.js",
    adapterPath: "adapters/thread-list-state-service.js",
  },
  {
    canonical: require("../services/thread-list/thread-list-runtime-service"),
    adapter: require("../adapters/thread-list-runtime-service"),
    exports: ["createThreadListRuntimeService"],
    servicePath: "services/thread-list/thread-list-runtime-service.js",
    adapterPath: "adapters/thread-list-runtime-service.js",
  },
];

test("thread-list compatibility adapters re-export canonical service boundaries", () => {
  for (const boundary of serviceBoundaries) {
    for (const exportName of boundary.exports) {
      assert.equal(boundary.adapter[exportName], boundary.canonical[exportName], exportName);
    }
  }
});

test("thread-list server composition imports canonical service paths", () => {
  assert.match(serverJs, /require\("\.\/services\/thread-list\/thread-list-fallback-source-service"\)/);
  assert.match(serverJs, /require\("\.\/services\/thread-list\/thread-summary-state-service"\)/);
  assert.match(serverJs, /require\("\.\/services\/thread-list\/thread-list-summary-service"\)/);
  assert.match(serverJs, /require\("\.\/services\/thread-list\/thread-list-state-service"\)/);
  assert.match(serverJs, /require\("\.\/services\/thread-list\/thread-list-runtime-service"\)/);
  assert.match(threadListRuntimeServiceJs, /require\("\.\/thread-list-fallback-cache-service"\)/);
  assert.match(threadListRuntimeServiceJs, /require\("\.\/thread-list-fallback-persistent-cache-store"\)/);
  assert.match(threadListRuntimeServiceJs, /require\("\.\/thread-list-fallback-prewarm-service"\)/);
  assert.match(threadListRuntimeServiceJs, /require\("\.\/thread-list-route-merge-service"\)/);
  assert.match(threadListRuntimeServiceJs, /require\("\.\/thread-list-summary-merge-service"\)/);
  assert.match(threadListRuntimeServiceJs, /require\("\.\/thread-list-response-coalescer-service"\)/);
  assert.doesNotMatch(serverJs, /require\("\.\/services\/thread-list\/thread-list-fallback-cache-service"\)/);
  assert.doesNotMatch(serverJs, /require\("\.\/services\/thread-list\/thread-list-fallback-persistent-cache-store"\)/);
  assert.doesNotMatch(serverJs, /require\("\.\/services\/thread-list\/thread-list-fallback-prewarm-service"\)/);
  assert.doesNotMatch(serverJs, /require\("\.\/services\/thread-list\/thread-list-route-merge-service"\)/);
  assert.doesNotMatch(serverJs, /require\("\.\/services\/thread-list\/thread-list-summary-merge-service"\)/);
  assert.doesNotMatch(serverJs, /require\("\.\/services\/thread-list\/thread-list-response-coalescer-service"\)/);
  assert.doesNotMatch(serverJs, /require\("\.\/adapters\/thread-list-fallback-cache-service"\)/);
  assert.doesNotMatch(serverJs, /require\("\.\/adapters\/thread-list-fallback-persistent-cache-store"\)/);
  assert.doesNotMatch(serverJs, /require\("\.\/adapters\/thread-list-fallback-source-service"\)/);
  assert.doesNotMatch(serverJs, /require\("\.\/adapters\/thread-summary-state-service"\)/);
  assert.doesNotMatch(serverJs, /require\("\.\/adapters\/thread-list-fallback-prewarm-service"\)/);
  assert.doesNotMatch(serverJs, /require\("\.\/adapters\/thread-list-route-merge-service"\)/);
  assert.doesNotMatch(serverJs, /require\("\.\/adapters\/thread-list-summary-merge-service"\)/);
  assert.doesNotMatch(serverJs, /require\("\.\/adapters\/thread-list-response-coalescer-service"\)/);
  assert.doesNotMatch(serverJs, /require\("\.\/adapters\/thread-list-summary-service"\)/);
  assert.doesNotMatch(serverJs, /require\("\.\/adapters\/thread-list-state-service"\)/);
  assert.match(threadListRouteServiceJs, /require\("\.\.\/services\/thread-list\/thread-list-app-server-fetch-policy-service"\)/);
  assert.match(threadListRouteServiceJs, /require\("\.\.\/services\/thread-list\/thread-list-route-merge-service"\)/);
  assert.match(threadListRouteServiceJs, /require\("\.\.\/services\/thread-list\/thread-list-request-context-service"\)/);
  assert.match(threadListRouteServiceJs, /require\("\.\.\/services\/thread-list\/thread-list-cold-path-diagnosis-service"\)/);
  assert.doesNotMatch(threadListRouteServiceJs, /require\("\.\.\/adapters\/thread-list-app-server-fetch-policy-service"\)/);
  assert.doesNotMatch(threadListRouteServiceJs, /require\("\.\.\/adapters\/thread-list-route-merge-service"\)/);
  assert.doesNotMatch(threadListRouteServiceJs, /require\("\.\.\/adapters\/thread-list-request-context-service"\)/);
  assert.doesNotMatch(threadListRouteServiceJs, /require\("\.\.\/adapters\/thread-list-cold-path-diagnosis-service"\)/);
});

test("thread-list package check covers canonical services and compatibility adapters", () => {
  for (const boundary of serviceBoundaries) {
    assert.match(packageJson, new RegExp(`node --check ${boundary.servicePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    assert.match(packageJson, new RegExp(`node --check ${boundary.adapterPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  }
});
