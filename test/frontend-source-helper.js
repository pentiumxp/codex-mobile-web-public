"use strict";

const fs = require("node:fs");
const path = require("node:path");

const FRONTEND_SOURCE_FILES = [
  "shell-asset-manifest.js",
  "api-client.js",
  "runtime-settings.js",
  "draft-store.js",
  "composer-runtime.js",
  "markdown-renderer.js",
  "viewport-metrics.js",
  "conversation-scroll.js",
  "image-compressor.js",
  "plugin-embed.js",
  "plugin-voice-input.js",
  "home-ai-diagnostic-reporting.js",
  "thread-diagnostic-events.js",
  "frontend-runtime-health.js",
  "thread-status-hints.js",
  "thread-performance-metrics.js",
  "thread-list-load-policy.js",
  "thread-list-stable-order.js",
  "thread-list-runtime.js",
  "client-render-stability-guard.js",
  "live-operation-dock-state.js",
  "thread-detail-state.js",
  "thread-detail-render-plan.js",
  "thread-detail-merge-state.js",
  "thread-detail-v4-merge-state.js",
  "thread-detail-runtime.js",
  "thread-detail-patch-plan.js",
  "thread-detail-dom-patch.js",
  "thread-detail-actions.js",
  "thread-tile-actions.js",
  "thread-tile-state.js",
  "thread-tile-layout.js",
  "thread-tile-runtime.js",
  "build-refresh-policy.js",
  "app-update-runtime.js",
  "side-chat-runtime.js",
  "media-preview-runtime.js",
  "app-bootstrap.js",
  "settings-runtime.js",
  "modal-runtime.js",
  "navigation-runtime.js",
  "api-client-runtime.js",
  "notification-ui-runtime.js",
  "pane-layout-runtime.js",
  "task-card-runtime.js",
  "conversation-render-runtime.js",
  "event-stream-runtime.js",
  "composer-bridge-runtime.js",
  "runtime-wiring-runtime.js",
  "app-shell-runtime.js",
  "app.js",
];

function readFrontendSources(root, files = FRONTEND_SOURCE_FILES) {
  return files
    .map((file) => fs.readFileSync(path.join(root, "public", file), "utf8"))
    .join("\n");
}

module.exports = {
  FRONTEND_SOURCE_FILES,
  readFrontendSources,
};
