# Frontend ESM Migration Plan

## Current Contract

Codex Mobile uses the Vite shell entry for app-preview execution, but the
default production shell still preserves the generated classic script fallback.
The migration therefore has two separate milestones:

- Vite/ESM loading contract: done for app-preview. The app-preview classic
  loader has no direct classic scripts; Vite owns the entry and imports the
  compatibility graph.
- Source-native ESM: in progress. Classic `public/*.js` files remain the
  canonical default-shell fallback until the behavior gate proves each migrated
  module can be imported natively without regressing user-message, approval,
  thread-detail, or refresh behavior.

## Phase 1 Scope

Phase 1 makes native ESM migration explicit and measurable without switching
the default shell away from classic fallback:

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

## Remaining Migration Order

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

Do not remove the classic fallback or switch `productionExecution` until the
native ESM count covers all app-preview runtime modules and the full behavior
gate passes with controlled submit. Public release can happen for intermediate
Phase 1 slices only when production deploy/readback and full behavior gate pass.
