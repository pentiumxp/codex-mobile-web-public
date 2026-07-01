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
    canonical: require("../services/runtime/runtime-workspace-bootstrap-service"),
    adapter: require("../adapters/runtime-workspace-bootstrap-service"),
    exports: ["createRuntimeWorkspaceBootstrapService"],
  },
  {
    canonical: require("../services/runtime/app-server-request-policy-service"),
    adapter: require("../adapters/app-server-request-policy-service"),
    exports: ["createAppServerRequestPolicyService"],
  },
  {
    canonical: require("../services/runtime/thread-event-notification-service"),
    adapter: require("../adapters/thread-event-notification-service"),
    exports: ["createThreadEventNotificationService"],
  },
  {
    canonical: require("../services/runtime/thread-runtime-settings-service"),
    adapter: require("../adapters/thread-runtime-settings-service"),
    exports: ["createThreadRuntimeSettingsService"],
  },
  {
    canonical: require("../services/thread-detail/thread-detail-active-turn-evidence-service"),
    adapter: require("../adapters/thread-detail-active-turn-evidence-service"),
    exports: ["createThreadDetailActiveTurnEvidenceService"],
  },
];

test("runtime compatibility adapters re-export canonical service boundaries", () => {
  for (const boundary of serviceBoundaries) {
    for (const exportName of boundary.exports) {
      assert.equal(boundary.adapter[exportName], boundary.canonical[exportName], exportName);
    }
  }
});
