"use strict";

(function (root) {
  var manifest = {
    "schemaVersion": 4,
    "generatedBy": "generate-frontend-shell-manifest",
    "shellCacheName": "codex-mobile-shell-v625-5d8a53ef77a5",
    "clientBuildId": "0.1.11|codex-mobile-shell-v625-5d8a53ef77a5",
    "scriptAssets": [
      "/shell-asset-manifest.js",
      "/api-client.js",
      "/runtime-settings.js",
      "/draft-store.js",
      "/composer-runtime.js",
      "/markdown-renderer.js",
      "/viewport-metrics.js",
      "/conversation-scroll.js",
      "/image-compressor.js",
      "/plugin-embed.js",
      "/plugin-voice-input.js",
      "/home-ai-diagnostic-reporting.js",
      "/thread-diagnostic-events.js",
      "/frontend-runtime-health.js",
      "/thread-status-hints.js",
      "/thread-performance-metrics.js",
      "/thread-list-load-policy.js",
      "/thread-list-stable-order.js",
      "/thread-list-runtime.js",
      "/client-render-stability-guard.js",
      "/live-operation-dock-state.js",
      "/thread-detail-state.js",
      "/thread-detail-render-plan.js",
      "/thread-detail-merge-state.js",
      "/thread-detail-v4-merge-state.js",
      "/thread-detail-runtime.js",
      "/thread-detail-patch-plan.js",
      "/thread-detail-dom-patch.js",
      "/thread-detail-actions.js",
      "/thread-tile-actions.js",
      "/thread-tile-state.js",
      "/thread-tile-layout.js",
      "/thread-tile-runtime.js",
      "/build-refresh-policy.js",
      "/app-update-runtime.js",
      "/side-chat-runtime.js",
      "/media-preview-runtime.js",
      "/app-bootstrap.js",
      "/settings-runtime.js",
      "/modal-runtime.js",
      "/navigation-runtime.js",
      "/api-client-runtime.js",
      "/notification-ui-runtime.js",
      "/pane-layout-runtime.js",
      "/task-card-runtime.js",
      "/conversation-render-runtime.js",
      "/event-stream-runtime.js",
      "/composer-bridge-runtime.js",
      "/runtime-wiring-runtime.js",
      "/app-shell-runtime.js",
      "/app.js"
    ],
    "entryGroups": [
      {
        "id": "manifest",
        "phase": "startup-manifest",
        "startupCritical": true,
        "chunkTarget": "startup-manifest",
        "assets": [
          "/shell-asset-manifest.js"
        ]
      },
      {
        "id": "foundation",
        "phase": "startup-prerequisite",
        "startupCritical": true,
        "chunkTarget": "startup-foundation",
        "assets": [
          "/api-client.js",
          "/runtime-settings.js",
          "/draft-store.js",
          "/composer-runtime.js",
          "/markdown-renderer.js",
          "/viewport-metrics.js",
          "/conversation-scroll.js",
          "/image-compressor.js",
          "/plugin-embed.js",
          "/plugin-voice-input.js",
          "/home-ai-diagnostic-reporting.js",
          "/thread-diagnostic-events.js",
          "/frontend-runtime-health.js",
          "/thread-status-hints.js",
          "/thread-performance-metrics.js",
          "/thread-list-load-policy.js",
          "/thread-list-stable-order.js"
        ]
      },
      {
        "id": "feature-runtimes",
        "phase": "classic-runtime",
        "startupCritical": false,
        "chunkTarget": "deferred-feature-runtimes",
        "assets": [
          "/thread-list-runtime.js",
          "/client-render-stability-guard.js",
          "/live-operation-dock-state.js",
          "/thread-detail-state.js",
          "/thread-detail-render-plan.js",
          "/thread-detail-merge-state.js",
          "/thread-detail-v4-merge-state.js",
          "/thread-detail-runtime.js",
          "/thread-detail-patch-plan.js",
          "/thread-detail-dom-patch.js",
          "/thread-detail-actions.js",
          "/thread-tile-actions.js",
          "/thread-tile-state.js",
          "/thread-tile-layout.js",
          "/thread-tile-runtime.js",
          "/build-refresh-policy.js",
          "/app-update-runtime.js",
          "/side-chat-runtime.js",
          "/media-preview-runtime.js"
        ]
      },
      {
        "id": "bootstrap-state",
        "phase": "startup-critical",
        "startupCritical": true,
        "chunkTarget": "startup-bootstrap",
        "assets": [
          "/app-bootstrap.js"
        ]
      },
      {
        "id": "shell-services",
        "phase": "classic-runtime",
        "startupCritical": false,
        "chunkTarget": "deferred-shell-services",
        "assets": [
          "/settings-runtime.js",
          "/modal-runtime.js",
          "/navigation-runtime.js",
          "/api-client-runtime.js",
          "/notification-ui-runtime.js",
          "/pane-layout-runtime.js",
          "/task-card-runtime.js",
          "/conversation-render-runtime.js",
          "/event-stream-runtime.js",
          "/composer-bridge-runtime.js"
        ]
      },
      {
        "id": "app-entry",
        "phase": "startup-critical",
        "startupCritical": true,
        "chunkTarget": "startup-app-shell",
        "assets": [
          "/runtime-wiring-runtime.js",
          "/app-shell-runtime.js",
          "/app.js"
        ]
      }
    ],
    "classicGlobalExports": [
      {
        "asset": "/api-client.js",
        "globals": [
          "CodexApiClient"
        ]
      },
      {
        "asset": "/runtime-settings.js",
        "globals": [
          "CodexRuntimeSettings"
        ]
      },
      {
        "asset": "/draft-store.js",
        "globals": [
          "CodexDraftStore"
        ]
      },
      {
        "asset": "/composer-runtime.js",
        "globals": [
          "CodexComposerRuntime"
        ]
      },
      {
        "asset": "/markdown-renderer.js",
        "globals": [
          "CodexMarkdownRenderer"
        ]
      },
      {
        "asset": "/viewport-metrics.js",
        "globals": [
          "CodexViewportMetrics"
        ]
      },
      {
        "asset": "/conversation-scroll.js",
        "globals": [
          "CodexConversationScroll"
        ]
      },
      {
        "asset": "/image-compressor.js",
        "globals": [
          "CodexImageCompressor"
        ]
      },
      {
        "asset": "/plugin-embed.js",
        "globals": [
          "CodexPluginEmbed"
        ]
      },
      {
        "asset": "/plugin-voice-input.js",
        "globals": [
          "CodexPluginVoiceInput"
        ]
      },
      {
        "asset": "/home-ai-diagnostic-reporting.js",
        "globals": [
          "CodexHomeAiDiagnosticReporting"
        ]
      },
      {
        "asset": "/thread-diagnostic-events.js",
        "globals": [
          "CodexThreadDiagnosticEvents"
        ]
      },
      {
        "asset": "/frontend-runtime-health.js",
        "globals": [
          "CodexFrontendRuntimeHealth"
        ]
      },
      {
        "asset": "/thread-status-hints.js",
        "globals": [
          "CodexThreadStatusHints"
        ]
      },
      {
        "asset": "/thread-performance-metrics.js",
        "globals": [
          "CodexThreadPerformanceMetrics"
        ]
      },
      {
        "asset": "/thread-list-load-policy.js",
        "globals": [
          "CodexThreadListLoadPolicy"
        ]
      },
      {
        "asset": "/thread-list-stable-order.js",
        "globals": [
          "CodexThreadListStableOrder"
        ]
      },
      {
        "asset": "/thread-list-runtime.js",
        "globals": [
          "CodexThreadListRuntime"
        ]
      },
      {
        "asset": "/client-render-stability-guard.js",
        "globals": [
          "CodexClientRenderStabilityGuard"
        ]
      },
      {
        "asset": "/live-operation-dock-state.js",
        "globals": [
          "CodexLiveOperationDockState"
        ]
      },
      {
        "asset": "/thread-detail-state.js",
        "globals": [
          "CodexThreadDetailState"
        ]
      },
      {
        "asset": "/thread-detail-render-plan.js",
        "globals": [
          "CodexThreadDetailRenderPlan"
        ]
      },
      {
        "asset": "/thread-detail-merge-state.js",
        "globals": [
          "CodexThreadDetailMergeState"
        ]
      },
      {
        "asset": "/thread-detail-v4-merge-state.js",
        "globals": [
          "CodexThreadDetailV4MergeState"
        ]
      },
      {
        "asset": "/thread-detail-runtime.js",
        "globals": [
          "CodexThreadDetailRuntime"
        ]
      },
      {
        "asset": "/thread-detail-patch-plan.js",
        "globals": [
          "CodexThreadDetailPatchPlan"
        ]
      },
      {
        "asset": "/thread-detail-dom-patch.js",
        "globals": [
          "CodexThreadDetailDomPatch"
        ]
      },
      {
        "asset": "/thread-detail-actions.js",
        "globals": [
          "CodexThreadDetailActions"
        ]
      },
      {
        "asset": "/thread-tile-actions.js",
        "globals": [
          "CodexThreadTileActions"
        ]
      },
      {
        "asset": "/thread-tile-state.js",
        "globals": [
          "CodexThreadTileState"
        ]
      },
      {
        "asset": "/thread-tile-layout.js",
        "globals": [
          "CodexThreadTileLayout"
        ]
      },
      {
        "asset": "/thread-tile-runtime.js",
        "globals": [
          "CodexThreadTileRuntime"
        ]
      },
      {
        "asset": "/build-refresh-policy.js",
        "globals": [
          "CodexBuildRefreshPolicy"
        ]
      },
      {
        "asset": "/app-update-runtime.js",
        "globals": [
          "CodexAppUpdateRuntime"
        ]
      },
      {
        "asset": "/side-chat-runtime.js",
        "globals": [
          "CodexSideChatRuntime"
        ]
      },
      {
        "asset": "/media-preview-runtime.js",
        "globals": [
          "CodexMediaPreviewRuntime"
        ]
      },
      {
        "asset": "/settings-runtime.js",
        "globals": [
          "CodexSettingsRuntime"
        ]
      },
      {
        "asset": "/modal-runtime.js",
        "globals": [
          "CodexModalRuntime"
        ]
      },
      {
        "asset": "/navigation-runtime.js",
        "globals": [
          "CodexNavigationRuntime"
        ]
      },
      {
        "asset": "/api-client-runtime.js",
        "globals": [
          "CodexApiClientRuntime"
        ]
      },
      {
        "asset": "/notification-ui-runtime.js",
        "globals": [
          "CodexNotificationUiRuntime"
        ]
      },
      {
        "asset": "/pane-layout-runtime.js",
        "globals": [
          "CodexPaneLayoutRuntime"
        ]
      },
      {
        "asset": "/task-card-runtime.js",
        "globals": [
          "CodexTaskCardRuntime"
        ]
      },
      {
        "asset": "/conversation-render-runtime.js",
        "globals": [
          "CodexConversationRenderRuntime"
        ]
      },
      {
        "asset": "/event-stream-runtime.js",
        "globals": [
          "CodexEventStreamRuntime"
        ]
      },
      {
        "asset": "/composer-bridge-runtime.js",
        "globals": [
          "CodexComposerBridgeRuntime"
        ]
      },
      {
        "asset": "/runtime-wiring-runtime.js",
        "globals": [
          "CodexRuntimeWiringRuntime"
        ]
      },
      {
        "asset": "/app-shell-runtime.js",
        "globals": [
          "CodexAppShellRuntime"
        ]
      }
    ],
    "startupGlobalContracts": [
      {
        "name": "CodexApiClient",
        "asset": "/api-client.js",
        "groupId": "foundation",
        "startupCritical": true,
        "source": "startup-window-guard",
        "present": true
      },
      {
        "name": "CodexAppShellRuntime",
        "asset": "/app-shell-runtime.js",
        "groupId": "app-entry",
        "startupCritical": true,
        "source": "startup-window-guard",
        "present": true
      },
      {
        "name": "CodexAppUpdateRuntime",
        "asset": "/app-update-runtime.js",
        "groupId": "feature-runtimes",
        "startupCritical": false,
        "source": "startup-window-guard",
        "present": true
      },
      {
        "name": "CodexClientRenderStabilityGuard",
        "asset": "/client-render-stability-guard.js",
        "groupId": "feature-runtimes",
        "startupCritical": false,
        "source": "startup-window-guard",
        "present": true
      },
      {
        "name": "CodexComposerRuntime",
        "asset": "/composer-runtime.js",
        "groupId": "foundation",
        "startupCritical": true,
        "source": "startup-window-guard",
        "present": true
      },
      {
        "name": "CodexDraftStore",
        "asset": "/draft-store.js",
        "groupId": "foundation",
        "startupCritical": true,
        "source": "startup-window-guard",
        "present": true
      },
      {
        "name": "CodexFrontendRuntimeHealth",
        "asset": "/frontend-runtime-health.js",
        "groupId": "foundation",
        "startupCritical": true,
        "source": "startup-window-guard",
        "present": true
      },
      {
        "name": "CodexHomeAiDiagnosticReporting",
        "asset": "/home-ai-diagnostic-reporting.js",
        "groupId": "foundation",
        "startupCritical": true,
        "source": "startup-window-guard",
        "present": true
      },
      {
        "name": "CodexLiveOperationDockState",
        "asset": "/live-operation-dock-state.js",
        "groupId": "feature-runtimes",
        "startupCritical": false,
        "source": "startup-window-guard",
        "present": true
      },
      {
        "name": "CodexMediaPreviewRuntime",
        "asset": "/media-preview-runtime.js",
        "groupId": "feature-runtimes",
        "startupCritical": false,
        "source": "startup-window-guard",
        "present": true
      },
      {
        "name": "CodexRuntimeWiringRuntime",
        "asset": "/runtime-wiring-runtime.js",
        "groupId": "app-entry",
        "startupCritical": true,
        "source": "startup-window-guard",
        "present": true
      },
      {
        "name": "CodexSideChatRuntime",
        "asset": "/side-chat-runtime.js",
        "groupId": "feature-runtimes",
        "startupCritical": false,
        "source": "startup-window-guard",
        "present": true
      },
      {
        "name": "CodexThreadDetailActions",
        "asset": "/thread-detail-actions.js",
        "groupId": "feature-runtimes",
        "startupCritical": false,
        "source": "startup-window-guard",
        "present": true
      },
      {
        "name": "CodexThreadDetailDomPatch",
        "asset": "/thread-detail-dom-patch.js",
        "groupId": "feature-runtimes",
        "startupCritical": false,
        "source": "startup-window-guard",
        "present": true
      },
      {
        "name": "CodexThreadDetailMergeState",
        "asset": "/thread-detail-merge-state.js",
        "groupId": "feature-runtimes",
        "startupCritical": false,
        "source": "startup-window-guard",
        "present": true
      },
      {
        "name": "CodexThreadDetailPatchPlan",
        "asset": "/thread-detail-patch-plan.js",
        "groupId": "feature-runtimes",
        "startupCritical": false,
        "source": "startup-window-guard",
        "present": true
      },
      {
        "name": "CodexThreadDetailRenderPlan",
        "asset": "/thread-detail-render-plan.js",
        "groupId": "feature-runtimes",
        "startupCritical": false,
        "source": "startup-window-guard",
        "present": true
      },
      {
        "name": "CodexThreadDetailRuntime",
        "asset": "/thread-detail-runtime.js",
        "groupId": "feature-runtimes",
        "startupCritical": false,
        "source": "startup-window-guard",
        "present": true
      },
      {
        "name": "CodexThreadDetailState",
        "asset": "/thread-detail-state.js",
        "groupId": "feature-runtimes",
        "startupCritical": false,
        "source": "startup-window-guard",
        "present": true
      },
      {
        "name": "CodexThreadDetailV4MergeState",
        "asset": "/thread-detail-v4-merge-state.js",
        "groupId": "feature-runtimes",
        "startupCritical": false,
        "source": "startup-window-guard",
        "present": true
      },
      {
        "name": "CodexThreadDiagnosticEvents",
        "asset": "/thread-diagnostic-events.js",
        "groupId": "foundation",
        "startupCritical": true,
        "source": "startup-window-guard",
        "present": true
      },
      {
        "name": "CodexThreadListLoadPolicy",
        "asset": "/thread-list-load-policy.js",
        "groupId": "foundation",
        "startupCritical": true,
        "source": "startup-window-guard",
        "present": true
      },
      {
        "name": "CodexThreadListRuntime",
        "asset": "/thread-list-runtime.js",
        "groupId": "feature-runtimes",
        "startupCritical": false,
        "source": "startup-window-guard",
        "present": true
      },
      {
        "name": "CodexThreadListStableOrder",
        "asset": "/thread-list-stable-order.js",
        "groupId": "foundation",
        "startupCritical": true,
        "source": "startup-window-guard",
        "present": true
      },
      {
        "name": "CodexThreadPerformanceMetrics",
        "asset": "/thread-performance-metrics.js",
        "groupId": "foundation",
        "startupCritical": true,
        "source": "startup-window-guard",
        "present": true
      },
      {
        "name": "CodexThreadStatusHints",
        "asset": "/thread-status-hints.js",
        "groupId": "foundation",
        "startupCritical": true,
        "source": "startup-window-guard",
        "present": true
      },
      {
        "name": "CodexThreadTileActions",
        "asset": "/thread-tile-actions.js",
        "groupId": "feature-runtimes",
        "startupCritical": false,
        "source": "startup-window-guard",
        "present": true
      },
      {
        "name": "CodexThreadTileLayout",
        "asset": "/thread-tile-layout.js",
        "groupId": "feature-runtimes",
        "startupCritical": false,
        "source": "startup-window-guard",
        "present": true
      },
      {
        "name": "CodexThreadTileRuntime",
        "asset": "/thread-tile-runtime.js",
        "groupId": "feature-runtimes",
        "startupCritical": false,
        "source": "startup-window-guard",
        "present": true
      },
      {
        "name": "CodexThreadTileState",
        "asset": "/thread-tile-state.js",
        "groupId": "feature-runtimes",
        "startupCritical": false,
        "source": "startup-window-guard",
        "present": true
      }
    ],
    "linkAssets": [
      "/manifest.json",
      "/icons/icon.svg",
      "/icons/apple-touch-icon.png",
      "/styles.css"
    ],
    "iconAssets": [
      "/icons/icon.svg",
      "/icons/apple-touch-icon.png",
      "/icons/icon-192.png",
      "/icons/icon-512.png"
    ],
    "precacheAssets": [
      "/",
      "/index.html",
      "/manifest.json",
      "/icons/icon.svg",
      "/icons/apple-touch-icon.png",
      "/styles.css",
      "/icons/icon-192.png",
      "/icons/icon-512.png",
      "/shell-asset-manifest.js",
      "/api-client.js",
      "/runtime-settings.js",
      "/draft-store.js",
      "/composer-runtime.js",
      "/markdown-renderer.js",
      "/viewport-metrics.js",
      "/conversation-scroll.js",
      "/image-compressor.js",
      "/plugin-embed.js",
      "/plugin-voice-input.js",
      "/home-ai-diagnostic-reporting.js",
      "/thread-diagnostic-events.js",
      "/frontend-runtime-health.js",
      "/thread-status-hints.js",
      "/thread-performance-metrics.js",
      "/thread-list-load-policy.js",
      "/thread-list-stable-order.js",
      "/thread-list-runtime.js",
      "/client-render-stability-guard.js",
      "/live-operation-dock-state.js",
      "/thread-detail-state.js",
      "/thread-detail-render-plan.js",
      "/thread-detail-merge-state.js",
      "/thread-detail-v4-merge-state.js",
      "/thread-detail-runtime.js",
      "/thread-detail-patch-plan.js",
      "/thread-detail-dom-patch.js",
      "/thread-detail-actions.js",
      "/thread-tile-actions.js",
      "/thread-tile-state.js",
      "/thread-tile-layout.js",
      "/thread-tile-runtime.js",
      "/build-refresh-policy.js",
      "/app-update-runtime.js",
      "/side-chat-runtime.js",
      "/media-preview-runtime.js",
      "/app-bootstrap.js",
      "/settings-runtime.js",
      "/modal-runtime.js",
      "/navigation-runtime.js",
      "/api-client-runtime.js",
      "/notification-ui-runtime.js",
      "/pane-layout-runtime.js",
      "/task-card-runtime.js",
      "/conversation-render-runtime.js",
      "/event-stream-runtime.js",
      "/composer-bridge-runtime.js",
      "/runtime-wiring-runtime.js",
      "/app-shell-runtime.js",
      "/app.js",
      "/shell-asset-manifest.json"
    ],
    "pageShellAssets": [
      "/",
      "/index.html",
      "/manifest.json",
      "/icons/icon.svg",
      "/icons/apple-touch-icon.png",
      "/styles.css",
      "/icons/icon-192.png",
      "/icons/icon-512.png",
      "/shell-asset-manifest.js",
      "/api-client.js",
      "/runtime-settings.js",
      "/draft-store.js",
      "/composer-runtime.js",
      "/markdown-renderer.js",
      "/viewport-metrics.js",
      "/conversation-scroll.js",
      "/image-compressor.js",
      "/plugin-embed.js",
      "/plugin-voice-input.js",
      "/home-ai-diagnostic-reporting.js",
      "/thread-diagnostic-events.js",
      "/frontend-runtime-health.js",
      "/thread-status-hints.js",
      "/thread-performance-metrics.js",
      "/thread-list-load-policy.js",
      "/thread-list-stable-order.js",
      "/thread-list-runtime.js",
      "/client-render-stability-guard.js",
      "/live-operation-dock-state.js",
      "/thread-detail-state.js",
      "/thread-detail-render-plan.js",
      "/thread-detail-merge-state.js",
      "/thread-detail-v4-merge-state.js",
      "/thread-detail-runtime.js",
      "/thread-detail-patch-plan.js",
      "/thread-detail-dom-patch.js",
      "/thread-detail-actions.js",
      "/thread-tile-actions.js",
      "/thread-tile-state.js",
      "/thread-tile-layout.js",
      "/thread-tile-runtime.js",
      "/build-refresh-policy.js",
      "/app-update-runtime.js",
      "/side-chat-runtime.js",
      "/media-preview-runtime.js",
      "/app-bootstrap.js",
      "/settings-runtime.js",
      "/modal-runtime.js",
      "/navigation-runtime.js",
      "/api-client-runtime.js",
      "/notification-ui-runtime.js",
      "/pane-layout-runtime.js",
      "/task-card-runtime.js",
      "/conversation-render-runtime.js",
      "/event-stream-runtime.js",
      "/composer-bridge-runtime.js",
      "/runtime-wiring-runtime.js",
      "/app-shell-runtime.js",
      "/app.js",
      "/shell-asset-manifest.json",
      "/sw.js"
    ],
    "hashAssets": [
      "/index.html",
      "/manifest.json",
      "/icons/icon.svg",
      "/icons/apple-touch-icon.png",
      "/styles.css",
      "/icons/icon-192.png",
      "/icons/icon-512.png",
      "/shell-asset-manifest.js",
      "/api-client.js",
      "/runtime-settings.js",
      "/draft-store.js",
      "/composer-runtime.js",
      "/markdown-renderer.js",
      "/viewport-metrics.js",
      "/conversation-scroll.js",
      "/image-compressor.js",
      "/plugin-embed.js",
      "/plugin-voice-input.js",
      "/home-ai-diagnostic-reporting.js",
      "/thread-diagnostic-events.js",
      "/frontend-runtime-health.js",
      "/thread-status-hints.js",
      "/thread-performance-metrics.js",
      "/thread-list-load-policy.js",
      "/thread-list-stable-order.js",
      "/thread-list-runtime.js",
      "/client-render-stability-guard.js",
      "/live-operation-dock-state.js",
      "/thread-detail-state.js",
      "/thread-detail-render-plan.js",
      "/thread-detail-merge-state.js",
      "/thread-detail-v4-merge-state.js",
      "/thread-detail-runtime.js",
      "/thread-detail-patch-plan.js",
      "/thread-detail-dom-patch.js",
      "/thread-detail-actions.js",
      "/thread-tile-actions.js",
      "/thread-tile-state.js",
      "/thread-tile-layout.js",
      "/thread-tile-runtime.js",
      "/build-refresh-policy.js",
      "/app-update-runtime.js",
      "/side-chat-runtime.js",
      "/media-preview-runtime.js",
      "/app-bootstrap.js",
      "/settings-runtime.js",
      "/modal-runtime.js",
      "/navigation-runtime.js",
      "/api-client-runtime.js",
      "/notification-ui-runtime.js",
      "/pane-layout-runtime.js",
      "/task-card-runtime.js",
      "/conversation-render-runtime.js",
      "/event-stream-runtime.js",
      "/composer-bridge-runtime.js",
      "/runtime-wiring-runtime.js",
      "/app-shell-runtime.js",
      "/app.js",
      "/shell-asset-manifest.json",
      "/sw.js"
    ],
    "counts": {
      "scriptAssets": 51,
      "entryGroups": 6,
      "classicGlobalExportAssets": 48,
      "classicGlobalExports": 48,
      "startupGlobalContracts": 30,
      "linkAssets": 4,
      "iconAssets": 4,
      "precacheAssets": 60,
      "pageShellAssets": 61,
      "hashAssets": 60
    }
  };
  root.CODEX_MOBILE_SHELL_MANIFEST = manifest;
}(typeof globalThis !== "undefined" ? globalThis : this));
