"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const serviceBoundaries = [
  {
    canonical: require("../services/runtime/runtime-permission-policy-service"),
    adapter: require("../adapters/runtime-permission-policy-service"),
    exports: ["createRuntimePermissionPolicyService"],
  },
  {
    canonical: require("../services/runtime/rate-limit-runtime-service"),
    adapter: require("../adapters/rate-limit-runtime-service"),
    exports: ["createRateLimitRuntimeService"],
  },
  {
    canonical: require("../services/runtime/server-runtime-utils"),
    adapter: require("../adapters/server-runtime-utils"),
    exports: ["createServerRuntimeUtils"],
  },
  {
    canonical: require("../services/runtime/server-http-runtime-service"),
    adapter: require("../adapters/server-http-runtime-service"),
    exports: ["createServerHttpRuntimeService"],
  },
  {
    canonical: require("../services/runtime/runtime-settings-service"),
    adapter: require("../adapters/runtime-settings-service"),
    exports: ["createRuntimeSettingsService"],
  },
  {
    canonical: require("../services/runtime/app-server-request-policy-service"),
    adapter: require("../adapters/app-server-request-policy-service"),
    exports: ["createAppServerRequestPolicyService"],
  },
];

test("runtime compatibility adapters re-export canonical service boundaries", () => {
  for (const boundary of serviceBoundaries) {
    for (const exportName of boundary.exports) {
      assert.equal(boundary.adapter[exportName], boundary.canonical[exportName], exportName);
    }
  }
});
