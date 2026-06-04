# Complex Feature Implementation Paths

Use this document before non-trivial changes that affect runtime behavior, cross-module state, service worker/PWA behavior, app-server protocol, or public/private release.

## General Path

1. Read `.agent-context/PROJECT_CONTEXT.md`, `.agent-context/HANDOFF.md`, and the relevant `docs/` file.
2. Re-check live repo/runtime state when the task depends on current status.
3. Identify the owner module from `docs/MODULES.md`.
4. Put policy/state logic into an adapter or focused helper before expanding `server.js` or `public/app.js`.
5. Add focused tests for the behavior boundary.
6. Run focused tests, then broader validation by risk.
7. Update docs/handoff when the behavior becomes a stable rule.

## Active Turn And Message Submission

Use when changing send, stop, steer, active turn, local echo, or disappearing-message behavior.

Implementation path:

1. Read `docs/ARCHITECTURE.md` message submission flow.
2. Keep stale-turn policy in `adapters/active-turn-staleness-service.js`.
3. Keep pending-visible-message behavior in `adapters/message-pending-echo-service.js` or browser merge logic.
4. Preserve the rule: latest durable live turn should be steered, not auto-interrupted only because it is quiet.
5. Preserve the rule: superseded or missing stale active ids should not receive new guidance.
6. Test with `test/active-turn-staleness-service.test.js`, `test/new-thread-route.test.js`, `test/message-pending-echo-service.test.js`, and `test/conversation-render.test.js`.

Runtime activation is server-side unless browser active-state rendering changes; browser changes require shell cache/build bump.

## Workspace List And Creation

Use when changing Workspace dropdown behavior, `GET /api/workspaces`,
`POST /api/workspaces`, or the new-thread workspace visibility gate.

Implementation path:

1. Keep Codex `.codex` state read-only; do not patch
   `.codex-global-state.json` to add Mobile Web-created roots.
2. Keep folder-name validation, allowed-root enforcement, registry persistence,
   and public workspace shape in `adapters/workspace-registry-service.js`.
3. `server.js` should only compose the registry with Codex-visible roots and
   expose thin HTTP routes.
4. The browser create affordance belongs at the bottom of the Workspace
   dropdown list. Do not add a second button beside the new-thread entry.
5. After successful creation, select the new cwd, open a new-thread draft, and
   refresh the thread list silently.
6. Browser changes require a `CLIENT_BUILD_ID` / `public/sw.js` cache bump.
7. Test with `test/workspace-registry-service.test.js`,
   `test/new-thread-route.test.js`, `test/mobile-viewport.test.js`, and
   `test/new-thread-ui.test.js` when the new-thread draft path changes.

## Thread Visibility And Worktree Filtering

Use when changing thread-list visibility, workspace cwd filtering, local state
DB/session-index fallback, or Codex worktree handling.

Implementation path:

1. Keep archived/deleted/removed, backup rollout, old-workspace, and Sub Agent
   suppression rules active before adding new visibility allowances.
2. Treat `%USERPROFILE%\.codex\worktrees\<id>\<repo>` as visible only when
   `<repo>` matches a visible workspace basename. Do not make all `.codex`
   worktrees globally visible.
3. Apply the same cwd matching in server filters and browser-side hidden-thread
   checks so refreshes do not disagree.
4. If app-server `thread/list` can omit rows, merge bounded state DB and
   session-index fallback rows, then dedupe by thread id and reapply filters.
5. Browser changes require a `CLIENT_BUILD_ID` / `public/sw.js` cache bump.
6. Test with `test/thread-visibility.test.js` and `test/mobile-viewport.test.js`;
   add thread detail or render tests if the detail shape changes.

## Workspace Token Usage Ledger

Use when changing Workspace-level token totals, daily usage detail, completed-turn
usage persistence, or the sidebar usage display.

Implementation path:

1. Keep the durable ledger in `%USERPROFILE%\.codex-mobile-web\token-usage-stats.sqlite`.
2. Record usage on completed turns as soon as the scoped usage summary is
   available; do not depend on future rollout scans or browser state for the
   project total.
3. Use `(thread_id, turn_id)` as the SQLite primary key so duplicate completion
   notifications update the same turn instead of double-counting.
4. Aggregate primarily by Workspace `cwd` and local day. Per-thread fields may
   be returned for small badges/debugging, but the product surface is the
   Workspace ledger.
5. Include an all-Workspace breakdown grouped by `cwd` so the stats page can
   show per-project consumption without switching Workspace filters.
6. Keep daily/project detail split by uncached input, cached input, output, and
   reasoning output because these token classes have different usage/cost
   meaning.
7. Keep SQL/schema/query logic in `adapters/token-usage-stats-service.js`;
   `server.js` should only call the service from notification and thread-list
   routes.
8. Browser changes require a `CLIENT_BUILD_ID` / `public/sw.js` cache bump.
9. Test with `test/token-usage-stats-service.test.js`,
   `test/turn-usage-summary-service.test.js`, and `test/mobile-viewport.test.js`.

## Thread Detail And Conversation Rendering

Use when changing visible items, operation cards, timestamps, compaction notices, image views, or merge behavior.

Implementation path:

1. Decide whether the behavior belongs in server compaction or browser rendering.
2. Server should compact, enrich, and bound data volume; browser should render stable visible items without broad DOM churn.
3. Operation cards in the latest live turn should globally show only the newest operation card, with a compact four-line visual budget: one metadata row plus up to three clipped detail lines. Completed turns should not keep operation cards below the final reply; when Usage data exists, the final frame should be `turnUsageSummary`.
4. Raw operation fallback must respect latest live turn id and completion outputs. Completed fallback is allowed only while the latest turn is still live and the completed operation is tied to that same turn, so older completed operations cannot attach to a newer live turn.
5. Live reasoning should update the timer/activity label, not insert reasoning rows.
6. Type-only context compaction markers must not synthesize visible pending/completed notices.
7. Current-turn upward scroll jump targets the final receipt/summary: the last `agentMessage` or `plan`, then the last non-user, non-live-operation fallback. It should not jump to the first assistant reply. Preserve an already activated live-turn anchor across `turn/completed`, and show the button when the target item's start is above the viewport.
8. Live/final receipt rendering must not force-scroll while the user is reading. Recent manual scroll away from bottom should create a current-turn hold even during programmatic bottom-scroll; render stick-to-bottom and bottom-follow timers must respect that hold.
9. Completed-turn context/token usage summaries should be synthetic diagnostic items from rollout `token_count` events. They must be omitted when no scoped token event exists and must not become the upward final-receipt jump target. Turn-level token usage should be derived from cumulative `total_token_usage` deltas across all valid scoped events in that turn, not only the final event's `last_token_usage`; context-window percent/risk stays based on the raw input tokens from the final valid event. If cached input is present, the displayed `in` value should exclude cached input.
10. Test with `test/thread-item-timestamp-enrichment.test.js`, `test/conversation-render.test.js`, `test/collab-agent-render.test.js`, `test/message-timestamp.test.js`, `test/turn-scroll-controls.test.js`, `test/turn-usage-summary-service.test.js`, and `test/mobile-viewport.test.js`.

## Rollout Continuation

Use when changing "压缩续接", handoff generation, lineage,
archive-after-continuation, workspace context compaction, large handoff
compaction, or runtime setting inheritance.

Implementation path:

1. Keep browser flow on `POST /api/thread-continuations` plus job polling.
2. Keep generated source handoffs under `.agent-context/thread-handoffs/` and ignored.
3. Keep large workspace handoff compaction in `adapters/continuation-handoff-compaction-service.js`.
4. Keep workspace context compaction in the continuation/context strategy
   service layer. The MVP archives and rewrites only
   `.agent-context/PROJECT_CONTEXT.md` and `.agent-context/HANDOFF.md`;
   diagnose `AGENTS.md` size but do not rewrite it without explicit user
   approval.
5. Archive full originals before rewriting under
   `.agent-context/archive/context-compaction-<timestamp>/`, verify the archive
   stays inside the current workspace, and report Git ignore/tracked status.
6. Keep compact live context as a routing index plus current state card. Move
   long history into archive/on-demand references rather than the default read
   path.
7. Keep the new-thread bootstrap as a reference-only index by default; the full source handoff lives in `.agent-context/thread-handoffs/` and must be read by the new thread when exact state matters.
8. Include source id/title/cwd/rollout path/rollout size/status, latest runtime settings, the source handoff path, workspace context paths, docs entrypoint, and lineage index path. Do not inline recent turn summaries, workspace context excerpts, source handoff excerpts, or lineage handoff excerpts by default.
9. Instruct the new thread to use bounded reads for large handoff/context files: top metadata plus recent tail first, targeted search next, full reads only when needed.
10. Avoid injecting unrelated private thread rules into the new bootstrap.
11. For runtime settings, read rollout `turn_context` and SQLite/app-server metadata; pass only fields supported by app-server.
12. Test with `test/continuation-lineage.test.js`, `test/continuation-handoff-compaction-service.test.js`, `test/new-thread-route.test.js`, and relevant runtime-settings tests. Keep focused workspace context compaction service tests green before changing route/UI wiring.

## Mux And Desktop Live Sync

Use when changing `codex-app-server-mux.js`, Desktop launcher scripts, endpoint publication, notification replay, or approval proxying.

Implementation path:

1. Keep stdout clean because Desktop uses it as the app-server protocol channel.
2. Write diagnostics to mux log.
3. Preserve endpoint auto-publish rules: secondary stdio muxes should not overwrite a reachable shared endpoint.
4. Preserve replay limits and unresolved server request replay.
5. Preserve mobile truncation/drop rules for large deltas and outputs.
6. Test with `test/protocol.test.js`.
7. Activation usually requires replacing the keep-alive mux: quit Desktop and use `start-codex-desktop-shared.ps1 -ForceRestartMux`.

## PWA, Service Worker, And Mobile UI Shell

Use when changing static assets, mobile layout, refresh prompts, Push click behavior, PWA launch behavior, or cache version.

Implementation path:

1. Update `public/app.js` `CLIENT_BUILD_ID` and `public/sw.js` shell cache name together.
2. Ensure refresh prompt verifies the target shell cache before pruning old caches or reloading, and that server-started build checks run on reconnect/status/list refresh paths as well as timers and foreground/focus recovery.
3. Keep iOS standalone behavior; do not use display-mode checks as a blocking gate.
4. Respect safe areas, keyboard/visual viewport rules, and touch layout breakpoints.
5. Test with `test/mobile-viewport.test.js`, `test/app-update.test.js`, and relevant UI tests.
6. Tell the user that open PWA clients need the refresh prompt, hard refresh, or close/reopen.

## Web Push

Use when changing Push subscription, notification payloads, click handling, or sub-agent suppression.

Implementation path:

1. Keep VAPID/subscription runtime files out of source and handoff.
2. Keep notification click routing through app shell focus/open and service worker message passing.
3. Include the stable Codex thread id in completion payloads and make the
   service worker cold-start path open `/?thread=<thread-id>` directly, with
   `postMessage` retained as a focused-client fallback.
4. Fail closed for unknown thread ids or sub-agent child threads.
5. Test service logic with `test/push-notification-service.test.js` and shell behavior with `test/mobile-viewport.test.js`.
6. Validate over HTTPS/Tailscale when testing real subscription behavior.

## Uploads, Files, And Image Context

Use when changing composer attachments, preview, `imageView`, upload limits, or extended-history policy.

Implementation path:

1. Keep upload files under the runtime upload root.
2. Validate preview routes against allowed roots; never serve arbitrary local paths.
3. Treat Codex-style file-location suffixes such as `:line`, `:line:column`, and `#Lline` as preview metadata, not as part of the filename.
4. Keep local preview links visually clickable without redundant helper text, keep preview panels viewport-bounded without horizontal dragging, and capture preview-layer right swipes so they close the preview instead of navigating the underlying page.
5. Keep browser image compression in `public/image-compressor.js`.
6. Keep upload-aware model input and history persistence in `adapters/message-input-service.js`.
7. Preserve the default `CODEX_MOBILE_IMAGE_CONTEXT_MODE=reference` behavior unless the feature explicitly requires vision input.
8. If vision is required, prefer `latest`/`vision` over legacy `all`, and document that app-server current history may still retain the image until a fresh continuation.
9. Render saved image uploads as bounded thumbnails from the upload/file preview route even when model context stays reference-only, including quoted `Uploaded attachments:` summaries in Codex/plan replies. Keep this parser tolerant of CRLF line endings, Markdown blockquote-style quoted summaries, and raw app-server `input_text` / `input_image` / `image_url` content parts. The upload preview response must use a real image MIME type for `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, and related saved upload paths. Generated assistant Markdown data images such as `data:image/png;base64,...` should render as bounded images while unsafe data image formats such as SVG stay blocked.
10. Render app-server `imageView` items and completed `imageGeneration` items with `savedPath` as direct image views; never stringify data URLs or image-generation JSON into conversation text.
11. If an `imageView` or `imageGeneration.savedPath` points at a generated screenshot/image outside the workspace/upload roots, cache the file into the runtime generated-image cache and serve that cached copy through an authenticated Mobile Web URL instead of expanding arbitrary local preview roots.
12. Test with upload/file/image focused tests.

## Runtime Settings Inheritance

Use when changing model, reasoning effort, sandbox, approval, verbosity, or continuation/new-turn runtime settings.

Implementation path:

1. Determine the actual app-server field name and supported protocol shape.
2. Read the latest rollout `turn_context` and SQLite/app-server thread metadata.
3. Inherit `model` and `reasoning_effort` from the latest rollout
   `turn_context` first, then state DB/app-server thread metadata, then Codex
   config defaults. Do not default to global Codex config when a source thread
   has explicit settings that can be inherited.
4. Apply inherited model to `thread/start` and `turn/start`; apply inherited
   reasoning effort to `turn/start`. Explicit browser-selected model/effort on
   normal message submission must still override inherited values.
5. `turn/steer` is an active-turn steering path, not a new model invocation; it
   cannot change the model or reasoning effort of a turn that has already
   started.
6. Add tests that cover both small threads and large-rollout fallback paths,
   plus continuation and cross-thread task-card injection paths.
7. Re-check `/api/public-config` and a real continuation/new send path after activation.

## Hermes Mobile Plugin Deployment

Use when changing Codex Mobile Web as a Hermes Mobile embedded-app plugin.

Implementation path:

1. Treat Codex Mobile as an independent plugin service, not as a worker or
   collaboration queue.
2. Keep authentication independent. Registration and launch must require the
   Codex Mobile Access Key through `Authorization: Bearer` or
   `X-Codex-Mobile-Key`; do not accept Hermes owner auth as a substitute.
3. Keep the manifest metadata-only. It may expose endpoint paths and plugin
   capabilities, but no Access Key, launch token, callback secret, upload path,
   or local deployment secret.
4. Store only bounded registration metadata in runtime state:
   workspace id, Hermes callback URL, Hermes app origin, label, and timestamps.
   The callback URL may be `https`.
5. Register the Hermes iframe origin through
   `POST /api/v1/hermes/plugin/origins` or
   `CODEX_MOBILE_HERMES_PLUGIN_FRAME_ORIGINS`; use those origins for CSP
   `frame-ancestors` instead of hard-coding a personal deployment domain.
6. If Codex Mobile is reverse-proxied behind HTTPS, set
   `CODEX_MOBILE_HERMES_PLUGIN_BASE_URL` or `CODEX_MOBILE_PUBLIC_BASE_URL` so
   the manifest advertises the external HTTPS entry URL. HTTPS Hermes cannot
   embed an HTTP Codex entry; return/report a diagnostic rather than silently
   advertising an unusable iframe URL. On Windows, keep this configuration in
   the startup chain with `-HermesPluginBaseUrl` / `-PublicBaseUrl`; use
   `-HermesPluginFrameOrigins` when the Hermes iframe origin must be present at
   process start instead of relying only on runtime registration.
7. Launch must return a short-lived `codexPluginLaunch` iframe entry path, not
   the long-lived Access Key. The browser should exchange that one-time token
   for an in-memory plugin session and scrub the URL so tab switches do not
   replay expired launch URLs.
8. Host appearance sync must be launch/session metadata, not frontend guessing.
   The manifest should advertise the supported `appearance_sync` values.
   `POST /api/v1/hermes/plugin/launch` may accept `appearance.theme` and
   `appearance.fontSize`, copy only whitelisted values to `pluginTheme` /
   `pluginFontSize` query params, and return the same sanitized appearance from
   `/session`. The iframe must apply those values before stylesheet/app
   initialization to avoid a flash of the standalone theme or font size.
9. `/?embed=hermes` must behave as an embedded secondary app: hide standalone
   chrome/splash, keep state on visibility/focus changes, stay inside the same
   iframe, post `codex-mobile.plugin.navigation`, and handle
   `hermes.plugin.back` only for iframe-owned transient layers such as
   modals/edit panels. The thread-switcher/settings surface should be the
   plugin primary page, not an overlay sidebar; it reports `canGoBack:false` so
   Hermes bottom tabs remain visible. Thread detail and new-thread routes should
   report `canGoBack:true` so iOS Hermes forwards right-swipe/back to the iframe;
   Codex should handle that secondary-page back by returning to the primary
   thread-switcher/settings page. Do not implement thread-page back by showing
   Codex's standalone first-launch Workspace page or by opening a sidebar drawer
   inside the iframe. In embedded startup, restore only explicit launch or route
   targets; when Hermes provides no target, stay on the plugin primary page
   instead of restoring localStorage's last thread or the latest active recent
   thread. Hermes notification opens may also supply bounded query
   hints such as `pluginId=codex-mobile`, `pluginRoute`, `pluginThreadId`,
   `pluginTaskId`, and `pluginItemId`; consume them inside the iframe, focus the
   matching thread/task when still present, scrub them from the URL, and fall
   back to the normal embedded primary page plus a bounded diagnostic when the
   target is missing.
10. Plugin notifications must be delegated from the backend to Hermes Mobile
   Action Inbox through `POST /api/hermes-plugins/codex-mobile/notifications`.
   Keep the Hermes Web/Owner key server-side only, require a stable `eventId` or
   `sourceId`, send only bounded title/summary plus route metadata, and reject
   raw keys, bearer tokens, launch tokens, Push endpoints, DB paths, prompts,
   raw model responses, private manifest dumps, and long logs. For completed-turn
   notifications, send a short preview for Push/InBox plus an optional bounded
   Markdown `detailMessage` for Hermes thread-message storage; do not overload
   the short summary field with the long receipt body. In `/?embed=hermes`,
   browser Web Push registration should be disabled so Hermes owns the Inbox and
   Web Push delivery path.
11. Add service tests for manifest/registration/token behavior, route tests for
   the public/authenticated paths, frontend embed harness tests for
   navigation/back/windowing, and bump the PWA shell cache if frontend launch
   behavior changes.

## Cross-Thread Task Cards

Use when planning or implementing controlled task cards sent from one thread to
another thread without immediately entering the target thread's message flow.

Implementation path:

1. Read:
   - `docs/CROSS_THREAD_TASK_CARDS_REQUIREMENTS.md`
   - `docs/CROSS_THREAD_TASK_CARDS_DESIGN.md`
   - `docs/CROSS_THREAD_TASK_CARDS_IMPLEMENTATION.md`
2. Keep pending cards outside normal `thread.turns[*].items` until approval.
3. Put normalization, authorization, idempotency, and state transitions in a
   dedicated server-side adapter instead of expanding `server.js`.
4. Treat approval as the only path that injects a real target-thread message.
5. Target-side approval must leave `pending` immediately by persisting a
   transient `approving` state before external `turn/start`, so thread refresh
   or continuation compaction cannot show a duplicate actionable `Approve`
   card while the target turn is already starting.
6. Treat delete and revoke as card-state transitions only; they must not create
   target-thread messages.
7. Reply should create a controlled reverse-direction card, not a silent direct
   message injection.
8. Ordinary task cards remain manual. The `#自由协作` draft path defaults to an
   autonomous/no-further-approval collaboration workflow unless the user asks
   for a one-off manual card. The first target approval may activate a workflow
   grant. Auto-run is allowed only for later cards with the same workflow id and
   the same unordered pair of source/target thread ids; a reused id with a
   different pair must stay pending.
9. Autonomous workflow completion return is server-owned and is part of the
   default autonomous workflow contract: when the approved card's injected
   target turn emits `turn/completed`, create one reverse-direction return card
   carrying the final receipt, reuse the same workflow id, and let the active
   grant auto-approve it into the source thread. The return key must be
   idempotent by original card id plus completed turn id.
10. Preserve source/target audit metadata after approval injection and
   auto-return creation.
11. The current implementation uses:
   - `adapters/thread-task-card-service.js`
   - `POST /api/thread-task-cards`
   - `GET /api/thread-task-cards/:id`
   - `POST /api/thread-task-cards/:id/approve|delete|revoke|reply`
   - `thread.threadTaskCards` on thread-detail responses
   - `public/app.js` task-card stack rendered outside normal turn items
12. Approval currently injects the approved card as a real new target-thread
   `turn/start` input, not as a fake static `userMessage`.
13. Keep `test/thread-task-card-harness.test.js` green, and cover real behavior
   with `test/thread-task-card-service.test.js` and
   `test/thread-task-card-route.test.js`.
14. Composer input is routed into the natural-language task-card flow only when
    it starts with the exact `#自由协作` prefix. Ordinary `#...` text remains a
    normal message. Convert `#自由协作` inputs into a bounded draft-request prompt
    for the current Codex thread, including the visible target-thread list and
    exact XML/JSON response schema.
15. Suppress the raw returned
     `<codex-mobile-thread-task-card-draft>...</codex-mobile-thread-task-card-draft>`
     assistant block, show a bounded placeholder while it is generating, and
     automatically call `POST /api/thread-task-cards` once a valid draft names
     visible targets. Do not show a source-side local `Approve` step.
16. Keep the command path conservative: if the model does not return at least
     one valid visible target id, do not auto-send to any other thread. The
     preferred draft field is `targetThreadIds`, with legacy `targetThreadId`
     accepted for backward compatibility. `#自由协作` defaults to autonomous
     workflow mode unless the user explicitly asks for a one-off manual card.
17. Do not rely only on the browser to turn a parsed draft into stored cards.
     On fresh `turn/completed`, `server.js` should fetch a bounded recent-turn
     window and materialize assistant/plan draft XML through the same
     idempotent `createMany()` path. Thread-detail reads should do the same
     before attaching `thread.threadTaskCards`, including large-rollout
     `thread/turns/list` reads.
18. Model-generated draft bodies can exceed the persisted card limit. Truncate
     draft bodies to the 8k service limit with a marker before create, while
     keeping idempotency based on the original draft content.
19. Multi-target creation must create one stored pending card per target. Keep
     the server route compatible by returning `card` for old callers plus
     `cards` for the complete batch result.
20. Source-side draft creation must feel immediate: use a stable draft-scoped
     idempotency key, surface incoming pending-card counts on thread summaries,
     and switch directly to the target thread only for single-target drafts.
     Multi-target drafts should stay on the source thread after creation,
     because jumping to one recipient would hide the other delivered cards.

## Public/Private Publish

Use when user explicitly asks to publish public or sync public.

Implementation path:

1. Re-read `.agent-context/PROJECT_CONTEXT.md` public release rules.
2. If the sidebar public PR check reports open pull requests, prompt the user whether to handle them. The check can prepare a review task, but merge/sync/commit/push still require explicit user approval.
3. Sync only product files to the clean public repo.
4. Do not copy `.agent-context`, runtime state, uploads, logs, raw key paths, VAPID/subscription files, or local-only scripts unless explicitly public-safe.
5. Public commit must include detailed Chinese README update and detailed Chinese commit message.
6. Run public tests/checks and staged privacy scan before push.
7. Sync public README back to private only when appropriate.
