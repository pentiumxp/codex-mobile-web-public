# Frontend ESM Migration Plan

## Current Contract

Codex Mobile uses the Vite shell entry for app-preview execution, but the
production shell execution contract has now been switched to the native ESM
app-preview path. The generated classic assets remain present as an explicit
rollback fallback, not as the expected production execution path.

- Vite/ESM loading contract: done. The app-preview classic loader has no
  direct classic scripts; Vite owns the entry and imports the compatibility
  graph.
- Source-native ESM: done for all app-preview runtime modules. Classic
  `public/*.js` files remain generated and hashed for rollback parity.
- Production execution: `vite-app-preview-native-esm`.

## Phase 1 Scope

Phase 1 made native ESM migration explicit and measurable before switching the
production execution contract:

- Each migrated runtime keeps its public classic asset for fallback.
- The Vite compatibility graph can import a native ESM source through
  `nativeSource`.
- The graph still publishes the same classic global name for app-preview
  compatibility.
- The Vite build contract records:
  - `nativeEsmModuleCount`
  - `classicGlobalCompatibilityModuleCount`
  - per-module `nativeSource`, `importSource`, and `compatibilityMode`
- `scripts/verify-vite-shell-manifest.mjs` fails closed when the migration
  counts drift.

The first migrated module is `build-refresh-policy`, a pure utility module with
no DOM, thread state, or user-message side effects.

## Migration Order

Migrate modules in low-risk to high-risk order:

1. Pure utilities: `thread-list-load-policy`, `viewport-metrics`,
   `runtime-settings`, `draft-store`, `image-compressor`.
2. Diagnostic and metrics helpers: `thread-performance-metrics`,
   `frontend-runtime-health`, `home-ai-diagnostic-reporting`,
   `thread-diagnostic-events`.
3. Rendering planners and state helpers: `conversation-scroll`,
   `thread-detail-state`, `thread-detail-render-plan`,
   `thread-detail-patch-plan`, `thread-detail-merge-state`,
   `thread-detail-v4-merge-state`.
4. UI runtimes with DOM ownership: thread list/tile/detail runtimes, composer,
   conversation render, task cards, event stream, navigation, pane layout, and
   app shell.

Each module migration must add or preserve focused tests proving:

- native ESM API matches the existing public classic API;
- app-preview imports the native source;
- the classic fallback asset remains present and hashed;
- behavior self-checks remain green for visible items, submit flow, refresh,
  and approval actions when the module owns one of those surfaces.

## Release Rule

Classic fallback removal remains a separate future cleanup. Keep the fallback
until production deploy/readback and the full behavior gate pass repeatedly
under `productionExecution: "vite-app-preview-native-esm"` and a rollback
window has been retained.
