"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const serverJs = fs.readFileSync(path.resolve(__dirname, "..", "server.js"), "utf8");
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
];

test("thread-list compatibility adapters re-export canonical service boundaries", () => {
  for (const boundary of serviceBoundaries) {
    for (const exportName of boundary.exports) {
      assert.equal(boundary.adapter[exportName], boundary.canonical[exportName], exportName);
    }
  }
});

test("thread-list server composition imports canonical service paths", () => {
  assert.match(serverJs, /require\("\.\/services\/thread-list\/thread-list-fallback-cache-service"\)/);
  assert.match(serverJs, /require\("\.\/services\/thread-list\/thread-list-fallback-persistent-cache-store"\)/);
  assert.match(serverJs, /require\("\.\/services\/thread-list\/thread-list-fallback-source-service"\)/);
  assert.match(serverJs, /require\("\.\/services\/thread-list\/thread-summary-state-service"\)/);
  assert.match(serverJs, /require\("\.\/services\/thread-list\/thread-list-fallback-prewarm-service"\)/);
  assert.doesNotMatch(serverJs, /require\("\.\/adapters\/thread-list-fallback-cache-service"\)/);
  assert.doesNotMatch(serverJs, /require\("\.\/adapters\/thread-list-fallback-persistent-cache-store"\)/);
  assert.doesNotMatch(serverJs, /require\("\.\/adapters\/thread-list-fallback-source-service"\)/);
  assert.doesNotMatch(serverJs, /require\("\.\/adapters\/thread-summary-state-service"\)/);
  assert.doesNotMatch(serverJs, /require\("\.\/adapters\/thread-list-fallback-prewarm-service"\)/);
});

test("thread-list package check covers canonical services and compatibility adapters", () => {
  for (const boundary of serviceBoundaries) {
    assert.match(packageJson, new RegExp(`node --check ${boundary.servicePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    assert.match(packageJson, new RegExp(`node --check ${boundary.adapterPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  }
});
