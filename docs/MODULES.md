# Module Map

## Root Runtime Files

| File | Responsibility | Notes |
| --- | --- | --- |
| `server.js` | Main HTTP server, app-server client, auth, routes, thread detail compaction, uploads, continuation jobs, Web Push, update/restart endpoints | Treat as composition glue. Extract reusable logic instead of expanding large inline blocks. |
| `codex-app-server-mux.js` | Shared Desktop/Mobile app-server bridge, endpoint publication, TCP server, app-server notification replay, approval proxying | Stdout is protocol data for Desktop; diagnostics must go to mux log. |
| `codex-app-server-mux-shim.cs` | Windows `.exe` shim for Desktop `CODEX_CLI_PATH` | Rebuild/relaunch Desktop through the shared launcher after changes. |
| `start-codex-mobile-web*.ps1/.vbs` | Windows startup wrappers and hidden scheduled-task startup | User-logon task is preferred when WSL access is needed; plugin HTTPS base URL and Hermes frame-origin settings must be passed here for scheduled deployments. |
| `restart-codex-mobile-shared-chain.ps1` | Scoped restart for Mobile Web chain | Does not restart Hermes Mobile, WSL, Codex Desktop, or unrelated services. |
| `start-codex-*-macos.sh` | macOS standalone/shared launch helpers | Keep shell syntax validated with `npm run check:macos`. |

## Adapter Services

| File | Responsibility |
| --- | --- |
| `adapters/active-turn-staleness-service.js` | Stale/superseded active-turn detection before existing-thread message submission. |
| `adapters/message-pending-echo-service.js` | Short-lived pending user-message echo injection for active-turn steering that is still waiting. |
| `adapters/message-input-service.js` | Upload-aware model input policy, image context mode, and extended-history persistence policy. |
| `adapters/continuation-handoff-compaction-service.js` | Workspace handoff compaction before rollout continuation. |
| `adapters/turn-usage-summary-service.js` | Rollout `token_count` parsing and completed-turn context/token usage summary attachment. |
| `adapters/public-pull-request-service.js` | Public GitHub pull request status normalization for prompt-only public PR checks. |
| `adapters/push-notification-service.js` | Web Push turn tracking, sub-agent suppression classification, completed-turn notification thread-title resolution, and the bounded app-server display-summary cache used before SQLite fallback. |
| `adapters/shared-chain-restart-service.js` | Authenticated restart endpoint orchestration. |
| `adapters/generated-image-cache-service.js` | Caches app-server `imageView` screenshot files into runtime-owned generated-image storage before browser rendering. |
| `adapters/hermes-plugin-service.js` | Independent Hermes Mobile embedded-app plugin manifest, callback/origin registration, launch/session token policy, frame-ancestor metadata, and bounded launch/session appearance sync. |
| `adapters/hermes-notification-delegate-service.js` | Backend-only Hermes Action Inbox notification delegation, safe payload normalization, Hermes endpoint/key resolution, and response sanitization. |
| `adapters/turn-completion-receipt-service.js` | Builds bounded completed-turn detail receipts for Hermes plugin Inbox/thread-message delegation from final assistant text plus usage summary. |
| `adapters/thread-task-card-service.js` | Cross-thread task-card normalization, readable visible-text guards, JSON store persistence, idempotency, single/multi-target creation, source/target authorization, state transitions, approval in-flight persistence, autonomous workflow grants, same-pair auto-approval, and approval injection payload generation. |
| `adapters/workspace-registry-service.js` | Mobile Web-created workspace folder validation, runtime registry persistence, allowed-root policy, and public workspace shape. |
| `adapters/sqlite-cli.js` | Cross-environment `sqlite3` discovery and JSON result execution. |

Add new service modules when logic has independent inputs/outputs, state rules, route policies, or tests. Keep route handlers thin and make service behavior directly testable.

## Public Frontend Files

| File | Responsibility |
| --- | --- |
| `public/app.js` | Main app state, rendering, thread list/detail, composer, SSE, Push UI, update/restart UI, continuation UI, source-side `#` task-card auto-send orchestration with stable draft settlement, target-side-only pending task-card rendering, and runtime application of plugin session appearance. |
| `public/styles.css` | Full app shell, mobile/tablet layout, operation cards, composer, sidebar, modals, PWA-safe layout. |
| `public/sw.js` | Service worker, app-shell cache, Web Push notification click handling. |
| `public/api-client.js` | Authenticated fetch helper. |
| `public/runtime-settings.js` | Model/effort/permission option normalization and labels. |
| `public/draft-store.js` | Browser-local draft persistence and resumable attachment draft data. |
| `public/markdown-renderer.js` | Markdown rendering rules for conversation/source text. |
| `public/viewport-metrics.js` | Visual viewport and keyboard-shrink helpers. |
| `public/conversation-scroll.js` | Scroll position and bottom-follow helpers. |
| `public/image-compressor.js` | Browser-side image compression before upload. |
| `public/plugin-embed.js` | Hermes iframe embed-mode helper for launch detection, bounded appearance query parsing, navigation messages, back messages, and internal-window policy. |

`public/app.js` is large. For new frontend behavior, first check whether the change belongs in an existing helper module or can be extracted into a new public helper with focused tests.

## Test Map

| Area | Tests |
| --- | --- |
| app-server/mux protocol | `test/protocol.test.js` |
| active-turn send behavior | `test/active-turn-staleness-service.test.js`, `test/new-thread-route.test.js`, `test/message-pending-echo-service.test.js` |
| workspace list/create | `test/workspace-registry-service.test.js`, `test/new-thread-route.test.js`, `test/mobile-viewport.test.js` |
| conversation rendering and operation cards | `test/conversation-render.test.js`, `test/collab-agent-render.test.js`, `test/thread-item-timestamp-enrichment.test.js`, `test/message-timestamp.test.js` |
| continuation | `test/continuation-lineage.test.js`, `test/continuation-handoff-compaction-service.test.js` |
| context and bootstrap size policy | `test/message-input-service.test.js`, `test/continuation-lineage.test.js`, `test/turn-usage-summary-service.test.js` |
| PWA/update/mobile viewport | `test/mobile-viewport.test.js`, `test/app-update.test.js`, `test/tablet-layout.test.js`, `test/manual-restart-ui.test.js`, `test/public-pull-request-service.test.js` |
| uploads/files/images | `test/image-compressor.test.js`, `test/message-input-service.test.js`, `test/generated-image-cache-service.test.js`, `test/file-preview.test.js`, `test/file-preview-ui.test.js`, `test/composer-draft.test.js` |
| Hermes Mobile plugin mode | `test/hermes-plugin-service.test.js`, `test/hermes-plugin-route.test.js`, `test/hermes-notification-delegate-service.test.js`, `test/plugin-embed.test.js` |
| cross-thread task cards | `test/thread-task-card-harness.test.js`, `test/thread-task-card-service.test.js`, `test/thread-task-card-route.test.js`, `test/conversation-render.test.js`; include readable-text/encoding-damage, approve-in-flight, autonomous workflow same-pair coverage, stable source-draft settlement, and target-side-only pending render coverage when changing sender or store paths |
| Push | `test/push-notification-service.test.js` |
| runtime settings | `test/runtime-settings.test.js`, `test/composer-quota.test.js` |
| scroll and markdown | `test/conversation-scroll.test.js`, `test/turn-scroll-controls.test.js`, `test/markdown-render.test.js` |

Use focused tests first for local iteration, then run `npm.cmd test`, `npm.cmd run check`, `npm.cmd run check:macos`, and `git diff --check` before commit/push or release.

## Ownership Boundaries

- `server.js` owns HTTP protocol shape and app-server request sequencing, but domain-specific state decisions should live in adapters.
- `codex-app-server-mux.js` owns shared-stream mechanics. Do not move browser UI logic into the mux.
- `public/sw.js` owns only cache and Push behavior. Do not put app state or route logic there.
- `.agent-context/` owns durable local context. Do not copy it to public release.
- Runtime files under `%USERPROFILE%\.codex-mobile-web` and `%USERPROFILE%\.codex` are not source files.

## Adding A New Module

1. Prefer `adapters/<domain>-service.js` for server-side policy or state logic.
2. Prefer `public/<domain>.js` for reusable browser helpers.
3. Add focused `node --test` coverage close to the behavior.
4. Add the new JS file to `package.json` `check` if it should be syntax-checked.
5. Document the module here when it becomes part of a stable boundary.
