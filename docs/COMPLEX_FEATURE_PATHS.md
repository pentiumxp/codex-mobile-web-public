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
6. Listener/app-server reconnect recovery is a dedicated path, not generic mutation RPC retry: after the browser observes app-server status recovering to ready, it may call `/api/threads/:id/auto-recover` for the current known running thread. The server should first try `turn/steer` on a still-live turn, then fall back to `thread/resume` plus a new `turn/start` with the bounded continuation prompt. Keep a thread-level cooldown so reconnect flapping cannot create repeated turns.
7. Test with `test/active-turn-staleness-service.test.js`, `test/new-thread-route.test.js`, `test/message-pending-echo-service.test.js`, `test/conversation-render.test.js`, and `test/mobile-viewport.test.js`.

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
6. Test with `test/thread-visibility.test.js`,
   `test/thread-list-fallback-cache-service.test.js`, and
   `test/mobile-viewport.test.js`; add thread detail or render tests if the
   detail shape changes.

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

Use when changing visible items, operation cards, timestamps, compaction notices, image views, projection, or merge behavior.

Read `docs/THREAD_DETAIL_PROJECTION_V4_DESIGN.md` before changing the thread
detail projection architecture. New projection behavior should target the v4
visible-item contract and tests, while v3 remains available until the v4 path is
validated and explicitly switched.

Implementation path:

1. Decide whether the behavior belongs in canonical server projection,
   transient browser pending overlay, or rendering only.
2. Server should compact, enrich, and bound data volume; browser should render stable visible items without broad DOM churn.
3. Operation cards in the latest live turn should globally show only the newest operation card, with a compact four-line visual budget: one metadata row plus up to three clipped detail lines. Historical completed turns should not keep operation cards below the final reply; when Usage data exists, the final frame should be `turnUsageSummary`. If there is no active turn, the latest completed turn is the replay turn and may keep a bounded recent operation/reasoning/assistant tail so the just-finished work remains inspectable.
4. Raw operation fallback must respect latest live turn id and completion outputs. Completed fallback is allowed only while the latest turn is still live and the completed operation is tied to that same turn, so older completed operations cannot attach to a newer live turn.
5. Live reasoning should update the timer/activity label, not insert reasoning rows.
6. Type-only context compaction markers must not synthesize visible pending/completed notices.
7. Current-turn upward scroll jump targets the final receipt/summary: the last `agentMessage` or `plan`, then the last non-user, non-live-operation fallback. It should not jump to the first assistant reply. Preserve an already activated live-turn anchor across `turn/completed`, and show the button when the target item's start is above the viewport. Do not expire this jump by elapsed time; hide it through thread/turn changes, explicit bottom navigation, or target visibility instead.
8. Live/final receipt rendering must not force-scroll while the user is reading. Recent manual scroll away from bottom should create a current-turn hold even during programmatic bottom-scroll; render stick-to-bottom and bottom-follow timers must respect that hold. The latest live `agentMessage` should be deferred until completion; a long final receipt should render once and position the viewport at the receipt start, not at the bottom.
9. Thread detail compaction should keep a small recent-turn window by default and expose `mobileOlderTurnsCursor` when older turns exist. Browser top-of-window pagination should request the next bounded page and preserve scroll position after prepending turns.
10. Completed-turn context/token usage summaries should be synthetic diagnostic items from rollout `token_count` events. They must be omitted when no scoped token event exists and must not become the upward final-receipt jump target. Turn-level token usage should be derived from cumulative `total_token_usage` deltas across all valid scoped events in that turn, not only the final event's `last_token_usage`; context-window percent/risk stays based on the raw input tokens from the final valid event. If cached input is present, the displayed `in` value should exclude cached input.
11. For v4 work, add or update `test/thread-visible-item-normalizer.test.js`,
    `test/thread-detail-projection-v4-service.test.js`, and a focused UI test
    such as `test/thread-detail-projection-v4-ui.test.js` or equivalent
    assertions in `test/conversation-render.test.js`.
12. Large-session performance work must preserve the authoritative first-paint
    contract. Use `mobileDiagnostics.threadDetailTimings` and client
    `performancePhase` events to distinguish warm projection cache, turns-list
    first paint, full `thread/read`, fallback list cache, and DOM render before
    changing caching/projection behavior. Do not introduce deferred incomplete
    detail enrichment as a UI fallback for server cold-path slowness.
13. Explicit empty final assistant-message completions belong in
    `adapters/thread-completion-diagnostic-service.js`. They should attach a
    bounded `turnDiagnostic` / `runtime_completed_without_response` item and
    must not synthesize an `agentMessage` or normal completion receipt.
14. Mobile operation dock state belongs in `public/live-operation-dock-state.js`.
    Keep 500ms compact-bubble dwell, expanded pinned sheet preservation, and
    same-thread recall-dot visibility covered by
    `test/live-operation-dock-state.test.js`; `public/app.js` should only do DOM
    patching and event binding.
15. Browser thread-detail item merge/state rules belong in
    `public/thread-detail-state.js`. Keep visible-field preservation,
    visible-text render identity, completed-receipt text retention,
    context-compaction notice cleanup, operation metadata retention,
    authoritative completed-receipt detection, and local-only item retention
    covered by `test/thread-detail-state.test.js`; `public/app.js` should only
    create the policy with local classifiers and delegate merge calls.
16. Projection/DOM consistency diagnostics must run after real single-thread
    and thread-tile renders, not only refresh-local-patch paths. Use
    `public/thread-diagnostic-events.js` to produce bounded
    `render_signature_mismatch`, `duplicate_render_keys`, and
    `turn_order_mismatch` events. Use `public/frontend-runtime-health.js` for
    browser-owned user-operation/render health such as submitted-message DOM
    disappearance, DOM drop, and repeated full-render/patch-fallback churn.
    Route repeated failures through `public/home-ai-diagnostic-reporting.js`.
    Single transient mismatches should not notify Owner; matching healthy
    renders must clear the repeated-failure counter. Do not include message
    text, task-card bodies, upload contents, local paths, tokens, cookies, or
    long logs in reports.
16. Wide-screen multi-thread reading layout belongs in
    `public/thread-tile-layout.js`. Keep viewport/sidebar/orientation to
    columns/rows/maxPanes decisions covered by `test/thread-tile-layout.test.js`,
    including iPad portrait single-thread mode and iPad landscape two/three-pane
    rules. Do not bind tile availability to the sidebar split media query:
    Home AI embedded iPad landscape can have an overlay sidebar or a visual
    viewport height below the split threshold while still having enough reading
    width for two or three panes. In the browser caller, subtract sidebar width
    only when `splitPaneSidebarVisible()` proves the sidebar actually occupies
    layout space; Home AI embed fixed/offscreen sidebars are overlays even when
    tablet split media matches. `public/app.js` may own DOM assembly and event
    binding, but tile panes must preserve explicit pane ownership: active pane,
    detail cache, local optimistic message echo, operation bubble state, and
    bounded background refresh must be keyed by thread id. Tile panes should
    feel like shrunken normal thread pages: initial render lands at the bottom,
    each pane has a direct bottom button, manual upward scroll is preserved
    across refresh, visible non-current panes refresh through bounded
    recent-detail reads plus notification-triggered updates, and command/tool
    status appears inside that pane through the same compact mobile operation
    bubble/sheet vocabulary. Pane-level changes should patch only the affected
    pane where possible: selected-pane border, title switch menu, background
    recent-detail refresh, and operation bubble updates must not require a full
    tile-board repaint unless the pane id set or column layout changes. Each
    pane must track whether the user has intentionally scrolled away from the
    bottom. If not, new content and background refreshes should follow the
    bottom like the single-thread mobile page; if yes, preserve distance from
    bottom until the user returns. Operation bubble duration text must reserve
    enough fixed tabular width for `HH:MM:SS`; long command text may shrink only
    the summary region, not the elapsed-time seconds. Pane header run state
    should reuse the same
    turn-timer vocabulary as the single-thread page (`本轮`, elapsed time, and
    thinking/output/running/settled detail) instead of inventing a separate
    status string. The current v418 middle state keeps one shared
    bottom Composer and one shared Composer runtime row, but their draft key,
    send target, Stop/steer state, local echo, failure receipt, task-card
    command source, ChatGPT Pro source thread, Fast tag, model, reasoning
    effort, and permission controls must follow the selected active pane
    without reordering the tile board. Quota remains a global display in that
    reused toolbar; do not create pane-local quota state. Pane thread switching
    is slot-local: selecting a thread from a pane title replaces that pane's
    thread id and must not navigate the whole page into single-thread mode;
    title/menu pointer handling must not trigger a pane-select re-render before
    the menu opens, and the menu-open state must be part of the tile render
    signature or a pane-local patch. Do not reintroduce
    a global iPad command dock,
    global tile title strip, per-turn Active/Completed footer, or always-visible
    pane bottom button in tile mode. On touch wide screens, command state is a
    floating operation bubble/sheet and must not reserve a bottom layout row.
    Composer/keyboard focus must not be treated as a tile layout change:
    while a keyboard-editable element is focused in tile mode, layout decisions
    should reuse the pre-keyboard viewport and Composer-height baseline, and
    visualViewport resize events should not call full `renderCurrentThread()`
    just to settle keyboard animation. In Home AI embedded mode, tile keyboard
    focus should not translate the entire app via `--app-top`; only the
    Composer/keyboard-safe surface should adapt.
    Treat
    this automatic tile policy as an interim surface. The long-term product
    direction is a user-managed
    split-screen reader: users can add/close panes, drag pane widths, decide
    how many threads to keep visible, and type into pane-local composers. That
    future split manager must keep pane identity, width persistence,
    per-pane draft/input state, detail-read concurrency caps, active pane,
    approvals, interrupt ownership, command/operation bubble state, command
    detail panels, and current-thread action ownership explicit instead of
    extending the automatic viewport heuristic. Product rule: every split pane
    is a self-contained mobile single-thread window scaled down; global
    composer or global command dock reuse is not sufficient for the final
    split-screen model.
17. Existing v3 behavior still uses
    `test/thread-completion-diagnostic-service.test.js`,
    `test/thread-item-timestamp-enrichment.test.js`,
    `test/conversation-render.test.js`, `test/collab-agent-render.test.js`,
    `test/thread-turn-compaction-policy-service.test.js`,
    `test/thread-detail-summary-service.test.js`,
    `test/thread-detail-performance-service.test.js`,
    `test/thread-detail-projection-input-service.test.js`,
    `test/thread-detail-projection-result-service.test.js`,
    `test/message-timestamp.test.js`, `test/turn-scroll-controls.test.js`,
    `test/turn-usage-summary-service.test.js`,
    `test/thread-performance-metrics.test.js`,
    `test/live-operation-dock-state.test.js`,
    `test/thread-detail-state.test.js`, and
    `test/mobile-viewport.test.js`.

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
12. Persist the computed continuation title to `session_index.jsonl` after
    `thread/start`. App-server rename RPCs are best-effort; fallback list
    refreshes must still recover the intended title instead of showing the new
    thread id, bootstrap prompt, or source thread's stale first-message title.
    When `session_index.jsonl` has a display title for a thread, Mobile Web
    treats that title as the known UI title for list/detail display and for the
    next continuation's source-title request; the index timestamp should affect
    sort recency only when it is newer than the thread row.
13. After the new thread bootstrap is started, migrate any unfinished source CLI
    goal through app-server goal RPCs. Copy only objective, status, and
    remaining token budget; do not copy spent token/time counters and do not
    write the goal objective into lineage metadata. Freeze an active source goal
    to `blocked` after the target goal is set so the same task does not run in
    both threads.
14. Test with `test/continuation-lineage.test.js`, `test/continuation-handoff-compaction-service.test.js`, `test/new-thread-route.test.js`, `test/thread-goal-service.test.js`, and relevant runtime-settings tests. Keep focused workspace context compaction service tests green before changing route/UI wiring.

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
10. Render app-server `imageView` items, completed `imageGeneration` items with `savedPath`, and rollout tool-output `input_image` parts from `function_call_output` / `custom_tool_call_output` as direct image views; never stringify data URLs or image-generation JSON into conversation text.
11. If an `imageView`, `imageGeneration.savedPath`, or tool-output data image points at a generated screenshot/image outside the workspace/upload roots, cache the image into the runtime generated-image cache and serve that cached copy through an authenticated Mobile Web URL instead of expanding arbitrary local preview roots.
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
6. Add tests that cover both normal `thread/read` detail and fallback paths,
   plus continuation and cross-thread task-card injection paths.
7. Re-check `/api/public-config` and a real continuation/new send path after activation.

## Thread Goals

Use when changing CLI/Desktop goal visibility, goal status display, or thread-level goal state.

Implementation path:

1. Inspect the generated app-server protocol from the local Codex CLI before adding UI actions. Codex app-server 0.135.0 and newer expose `thread/goal/set`, `thread/goal/get`, and `thread/goal/clear` requests plus `thread/goal/updated` and `thread/goal/cleared` notifications.
2. Keep Mobile Web goal state app-server-owned. Do not write `<CODEX_HOME>\goals_1.sqlite` directly; Mobile should call the official app-server goal RPC and treat sqlite as a fallback read path.
3. Use `adapters/thread-goal-service.js` to read `<CODEX_HOME>\goals_1.sqlite` as a cold-start/list/detail fallback and normalize sqlite statuses such as `budget_limited` into public camelCase status values.
4. Decorate both `GET /api/threads` list rows and `GET /api/threads/:id` detail responses with `thread.goal`; sqlite errors, missing tables, missing db files, or lock contention must not break the thread list.
5. In `public/app.js`, handle `thread/goal/updated` and `thread/goal/cleared` before the current-thread-only notification guard so non-current list rows update.
6. Include the goal signature in both the thread-list render signature and `conversationRenderSignature`; otherwise a valid notification may update state without repainting.
7. For Mobile goal creation, use the composer `/g` command to open the goal dialog, then call `POST /api/threads/:id/goal`; `server.js` should forward that to app-server `thread/goal/set`. If the running app-server is older and lacks the method, return a clear unsupported-version error instead of sending a normal chat message and asking the model to guess.
8. If the set response succeeds but lacks a public goal object, keep the user-visible target explicit by rendering a submitted-goal card from the dialog objective/token budget until `thread/goal/updated` or sqlite fallback data replaces it.
9. When `/g` is reopened on a thread with an unfinished goal, keep the same dialog as the action surface: Continue should clear and re-set blocked goals to active, Pause should map to app-server `blocked`, Cancel goal should call `thread/goal/clear`, and Save should keep using `thread/goal/set` for objective/token-budget edits.
10. During continuation, treat `active`, `blocked`, and legacy `paused` goals as task-level state to copy to the new thread through app-server `thread/goal/set`. Use `adapters/thread-goal-service.js` for the pure migration plan. Completed, budget-limited, usage-limited, missing, or unsupported goals should not be copied. Lineage should record only migrated/error booleans, not the goal objective.

## ChatGPT Pro Planner Connector

Use when extending `@ChatGPT Pro`, adding ChatGPT MCP connector tools, saving
ChatGPT Pro planner artifacts, or applying Pro output as a goal/task-card/review.

Implementation path:

1. Read `docs/CHATGPT_PRO_PLANNER_CONNECTOR_DESIGN.md` first.
2. Preserve the existing direct `@ChatGPT Pro ...` compatibility path.
3. Keep ChatGPT Pro as planner/reviewer and Codex as executor. The default
   connector profile must not edit source files, run shell commands, answer
   approvals, or start Codex turns.
4. Put planner request/artifact policy in a service module such as
   `adapters/chatgpt-pro-planner-service.js`; keep `server.js` route handlers
   thin.
5. Keep MCP protocol/auth/tool projection in
   `adapters/chatgpt-pro-mcp-service.js`. The first connector endpoint is
   `POST /api/chatgpt-pro/mcp` with separate bearer-token auth from
   `CODEX_MOBILE_CHATGPT_PRO_MCP_TOKEN` or
   `CODEX_MOBILE_CHATGPT_PRO_MCP_TOKEN_FILE`.
6. Store planner requests and generated artifacts under the Codex Mobile runtime
   root by default. Do not write PRD/Sprint/Review files into the source repo
   without a separate explicit apply action.
7. Treat all ChatGPT-generated markdown as untrusted content and render it
   through the existing safe markdown path.
8. Browser UI changes should extend the existing unified `@` intent menu/dialog
   and require the normal `CLIENT_BUILD_ID` / service-worker cache bump.
9. For MCP connector setup, keep connector auth material runtime-only and out of
   `.agent-context`, Git, public release, logs, screenshots, and handoff.
10. Test with focused planner/MCP service tests,
    `test/chatgpt-pro-planner-service.test.js`,
    `test/chatgpt-pro-mcp-service.test.js`, existing
    `test/chatgpt-pro-bridge-service.test.js`, composer intent tests,
    goal/task-card apply tests when actions are added, `npm test`,
    `npm run check`, and `git diff --check`.
11. If the frontend shell changes, bump `CLIENT_BUILD_ID`, `public/sw.js` cache name, and the matching tests.

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
   thread-switcher/settings page. Publish that state as soon as a thread id is
   selected, even before the detail read completes, so early gestures are still
   forwarded to the iframe. Also keep an iframe-owned iOS left-edge swipe guard
   that calls the same back handler when the iframe itself knows
   `canGoBack:true`, because touch gestures that begin inside the iframe may not
   reliably reach the Hermes host document. Do not implement thread-page back by showing Codex's
   standalone first-launch Workspace page or by opening a sidebar drawer inside
   the iframe. In embedded startup, restore only explicit launch or route
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
11. In embedded mode, receipt Markdown links may request an external browser
    open only for user-clicked `http`, `https`, or `mailto` URLs. Keep local
    paths on the in-app file preview path, reject unsafe schemes, and do not log
    raw link URLs in client events.
12. Add service tests for manifest/registration/token behavior, route tests for
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
8. Ordinary task cards remain manual. Plain `#` draft commands default to a
   manual one-off card. The legacy `#自由协作` draft path defaults to an
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
   Separately, approved cards with an active execution lease and
   `resumeRequired=true` are covered by the listener execution watchdog. If no
   terminal return or fresh bounded heartbeat/progress appears after the stale
   window, the watchdog resumes the original target lane with bounded
   id/title/summary context only; if resume fails, it records a blocked
   execution lease instead of leaving a healthy active-looking card.
10. Preserve source/target audit metadata after approval injection and
   auto-return creation.
11. The current implementation uses:
   - `services/task-cards/thread-task-card-service.js`
   - `services/task-cards/thread-task-card-routing-service.js`
   - `services/task-cards/thread-task-card-deploy-lane-policy-service.js`
   - `POST /api/thread-task-cards`
   - `POST /api/threads/:sourceThreadId/task-cards`
   - `GET /api/thread-task-cards/:id`
   - `POST /api/thread-task-cards/:id/approve|delete|revoke|reply`
   - `thread.threadTaskCards` on thread-detail responses
   - `public/app.js` task-card stack rendered outside normal turn items
   Thread-detail `thread.threadTaskCards` must stay summary-only for first
   paint. Do not include full `message.body`, idempotency keys,
   `injectionResult`, raw audit/provider payloads, or full execution internals
   in the detail-attached list; the browser fetches the full body through
   `GET /api/thread-task-cards/:id` when the user expands a card.
12. Approval currently injects the approved card as a real new target-thread
   `turn/start` input, not as a fake static `userMessage`.
    The thread-callable route is a separate model/tool surface. By default it
    stores pending target cards; it only calls `approveFromSource()` and
    bypasses the target pending approval UI when the runtime Settings switch
    `跨工作区委派` is enabled. Do not enable that bypass for ordinary browser
    composer or `#` draft-created cards.
13. Keep `test/thread-task-card-harness.test.js` green, and cover real behavior
   with `test/thread-task-card-service.test.js`,
   `test/thread-task-card-routing-service.test.js`, and
   `test/thread-task-card-route.test.js`.
14. Composer input is routed into the natural-language task-card flow when it
    starts with a leading non-empty `#` command. Plain `# ...` is the manual
    one-off card path; `#自由协作` remains the autonomous compatibility shortcut.
    Convert task-card commands into a bounded draft-request prompt for the
    current Codex thread, including the visible target-thread list and exact
    XML/JSON response schema.
15. Suppress the raw returned
     `<codex-mobile-thread-task-card-draft>...</codex-mobile-thread-task-card-draft>`
     assistant block, show a bounded placeholder while it is generating, and
     automatically call `POST /api/thread-task-cards` once a valid draft names
     visible targets. Do not show a source-side local `Approve` step.
16. Keep the command path conservative: if the model does not return at least
     one valid visible target id, do not auto-send to any other thread. The
     preferred draft field is `targetThreadIds`, with legacy `targetThreadId`
     accepted for backward compatibility. Plain `#` defaults to manual workflow
     mode unless the user explicitly asks for autonomous/free collaboration;
     `#自由协作` defaults to autonomous workflow mode unless the user explicitly
     asks for a one-off manual card.
17. Do not rely only on the browser to turn a parsed draft into stored cards.
     On fresh `turn/completed`, `server.js` should fetch a bounded recent-turn
     window and materialize assistant/plan draft XML through the same
     idempotent `createMany()` path. Thread-detail reads should do the same
     before attaching `thread.threadTaskCards`, including fallback
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

## Codex Mobile `@loop` Runtime

Use when implementing or extending explicit autonomous-delivery loop triggers
such as `@loop <objective>`, `@home-ai @loop <objective>`, or
`@plugin @loop <objective>`.

Implementation path:

1. Keep generic trigger parsing, loop state, role-slice orchestration,
   task-card dispatch idempotency, terminal-return correlation, target-purpose
   classification, and Watchdog classification in Codex Mobile. Home AI owns
   only its domain adapter and bounded status projection.
2. Current runtime ownership:
   - `services/at-loop/at-loop-trigger-parser-service.js`
   - `services/at-loop/thread-task-card-loop-routing-service.js`
   - `services/at-loop/loop-task-runtime-service.js`
   - `services/task-cards/thread-task-card-runtime-service.js` for bridging
     task-card terminal return events into the local Loop runtime
   - `server-routes/at-loop-route-service.js`
   - `POST /api/at-loop/triggers`
   - `GET /api/at-loop/status` and `GET /api/at-loop/status/:loopId`
   - `POST /api/at-loop/returns`
   - `POST /api/at-loop/watchdog`
   - MCP tools `start_loop` and `loop_status`
   - `public/composer-runtime.js` for the user-facing Composer `@loop`
     intent and direct `@loop <objective>` submit path
3. Persist loop state in `CODEX_MOBILE_AT_LOOP_STATE_FILE` or the runtime root
   `at-loop-state.json`. Store only bounded loop ids, source/target thread ids,
   role slice ids, task-card ids, statuses, audit verdicts, routing metadata,
   timestamps, and redacted objective summaries. Do not store raw secrets, full
   prompts, private thread bodies, cookies, launch tokens, screenshots, DB rows,
   provider payloads, or long logs.
4. Dispatch role cards only through the existing task-card channel. Role-card
   idempotency keys must be stable per `loopId`, role, iteration, and runtime
   target-thread generation, plus runtime contract version. If a stale or
   ineligible role lane is discarded and the same role/iteration retargets to a
   different thread, the idempotency key must change so the new role card does
   not resolve to the old target's terminal card.
5. Treat source-main-thread requirements as a local role. A loop submitted from
   Xcode/Home AI/plugin main threads records requirements as
   `source_thread_local_role` and must not send a same-thread requirements card.
   This local role is not automatically completed from the raw Owner objective:
   the runtime must leave the loop visible as `waiting_source_requirements` /
   `source_requirements_pending` until the source thread records a bounded
   local requirements/design return. The runtime must also start a visible
   source-thread-local requirements-analysis turn through `thread/resume` +
   `turn/start` instead of silently waiting; that turn records the packet
   through `scripts/record-at-loop-requirements.js`. Duplicate triggers while
   the local turn is already started reuse the same waiting state and must not
   create a second source turn or any implementation card. Implementation
   dispatch is allowed only after `requirements_packet` and
   `design_contract_packet` are present in the
   Audit Packet, unless a future explicit fast-path mode is added. Duplicate
   triggers during this state return the same waiting loop/status and must not
   dispatch implementation. Implementation/audit/repair/deploy roles still
   require real task cards with `sourceThreadId !== targetThreadId`. Select or
   create those role lanes from explicit role/purpose metadata first, then
   bounded cwd/title heuristics, and require the same task-card deliverability
   check used by normal cross-thread dispatch. Ordinary product/source main
   threads with only a workspace cwd are valid requirements owners but are not
   implementation/repair lanes; if a safe lane is unavailable, create one only
   when the source cwd is a real
   implementable workspace with project markers. A requirements/source thread's
   cwd must not be blindly treated as the implementation workspace; if the cwd
   is empty or projectless, fail closed with bounded
   `at_loop_implementation_workspace_unresolved` metadata and keep the loop
   visible at requirements revision. When the source/main requirements thread
   maps to a separate real implementation workspace, callers may pass
   `implementationWorkspaceCwd` (or the snake_case equivalent) through the
   API/MCP trigger; if omitted, the runtime may resolve a registered
   implementation workspace by bounded source title/path matching after the
   candidate passes implementation project-marker validation. Implementation
   and repair lane selection must then reuse
   only role lanes whose cwd matches that mapped workspace, or create a role
   lane at that cwd; other implementation-looking threads are stale/ineligible
   for that Loop. Product-audit and deploy/readback lanes also follow the
   mapped implementation workspace. A source requirements cwd such as an empty
   Xcode placeholder must not become the audit target when the actual
   implementation workspace is a different validated project directory.
6. Classify target-thread purpose before dispatch. Public PR, deploy lane,
   audit, task intake, and worker threads are special-purpose lanes; mismatched
   roles must fail closed with bounded routing metadata instead of relying on
   matching cwd or same-workspace recency. Generic `@loop` implementation and
   repair roles must target implementation/workspace threads or freshly created
   role threads, not unrelated worker-lane threads.
7. Terminal return correlation must match by task-card id first, then role
   slice id / loop id. Local final prose in a target thread is not a terminal
   return. Task-card terminal return events whose workflow id is
   `at-loop:<loopId>` must be recorded through
   `atLoopRuntimeService.recordTerminalReturn()` from the task-card runtime
   composition layer before or alongside any external Home AI return-event
   notification, so implementation/audit/repair returns advance the local Loop
   state without a manual `/api/at-loop/returns` call.
8. Watchdog marks stale/missing role returns only. It must not retry, complete,
   reject, or redispatch role work by itself.
9. Audit verdict classes route the next iteration: `passed` closes or proceeds
   to deploy/readback when required; requirements gaps route to requirements;
   implementation/test/privacy gaps route to repair; deploy readback failures
   route to deploy/readback or repair. Product-audit returns must normalize an
   explicit verdict from structured fields or bounded return text before the
   next-route decision. Audit `blocked_missing_evidence`, a blocked audit return
   that omits a structured verdict, or an audit return that is blocked while the
   Audit Packet still has missing implementation/validation/privacy sections,
   routes to repair so the implementation lane can provide bounded
   validation/privacy/design evidence. Requirements/design packet gaps route
   back to `requirements_revision` in the source thread. A completed audit
   return that remains unparsable is classified as a bounded routing error and
   routed to the source requirements lane; it must not leave `lastAuditVerdict`
   empty or create a pending repair slice without a dispatch target. Other
   blocked/rejected classes stop the loop. An implementation/repair role
   returning `blocked` is not a terminal Loop close: for source-thread-local
   requirements, record the role return and move the loop back to
   `requirements_revision` so the requirements owner can revise
   target/workspace/evidence before the next dispatch.
10. Duplicate blocked triggers must return a visible blocked loop/status, not an
    `ok=true` no-op. Existing same-thread requirements blockers may be recovered
    by converting requirements to the local role and preparing role lanes. When
    stored role-lane ids are no longer visible/current deliverable threads,
    or are rejected by the task-card deliverability boundary, discard those
    stale ids and rerun role-lane selection before dispatch. If a returned
    audit/deploy role blocked because it was dispatched to a target whose cwd
    no longer matches the mapped implementation workspace, repeated `@loop`
    should clear that returned role target and redispatch the same role to a
    valid lane instead of reporting a successful no-op or leaving the old
    blocked target in place. If a role slice is itself stuck at
    `status=blocked` after a task-card dispatch target was rejected as not
    visible/current deliverable, repeated `@loop` should clear that target and
    redispatch the blocked role directly instead of first replaying the local
    requirements role. The exception is a lane that the current Loop runtime
    created itself (`roleThreadCreated=true`): if no alternate same-role lane is
    already deliverable, preserve that target and keep the Loop visibly blocked
    instead of creating another implementation/audit/repair thread on each
    duplicate trigger.
11. Product-audit role cards must include a bounded Audit Packet and Delta
    Matrix. Packet sections are `requirements_packet`,
    `design_contract_packet`, `implementation_packet`, `validation_packet`, and
    `privacy_packet`. Delta Matrix ids are `intent_vs_requirements`,
    `requirements_vs_design`, `design_vs_implementation`,
    `implementation_vs_validation`, `user_journey_vs_acceptance`, and
    `privacy_boundary_vs_evidence`. Missing required sections must remain
    explicit missing-evidence state in the card and `/api/at-loop/status`; do
    not attach or read `.agent-context/HANDOFF.md` as audit context unless the
    named handoff is the audit target itself. Repair cards created after an
    audit missing-evidence block must include the bounded missing packet
    section ids so the implementation lane can fill the packet without raw
    handoff context. Terminal implementation/repair return cards may supply
    explicitly headed packet sections such as `## Design Contract Packet`,
    `## Validation Packet`, and `## Privacy Packet`; the task-card runtime
    passes that bounded return body only to the local Loop runtime, and the
    Loop runtime normalizes those sections into the Audit Packet before the
    next product-audit dispatch. The external Home AI return-event notification
    keeps its summary-only contract. For historical loops that already reached
    `max_iterations_reached`, a repeated trigger may rebuild the packet from
    stored implementation/repair return cards and perform one evidence-complete
    product-audit retry without losing implementation evidence. If the packet
    is still incomplete after rebuild, the loop remains blocked.
12. Focused tests include:
   - `test/at-loop-trigger-parser.test.js`
   - `test/thread-task-card-loop-routing-service.test.js`
   - `test/loop-task-runtime.test.js`
   - `test/at-loop-route-service.test.js`
   - `test/at-loop-composer-intent.test.js`
   - MCP/task-card composition tests that prove the API/MCP surfaces stay
     bounded and idempotent.
13. The Composer `@` picker intentionally exposes `Loop`, `目标任务`, and
    `ChatGPT Pro` only. Task-card and autonomous-collaboration creation remains
    available through the existing task-card channel/text commands, but is not a
    top-level Composer `@` picker entry. When the trigger returns
    `waiting_source_requirements`, Composer must render that waiting state
    visibly instead of treating the request as an ordinary "started" success:
    direct `@loop` submission updates the connection/activity text, and the
    `@` dialog keeps the dialog open with the source-requirements status. The
    actual unblock happens in the source thread's local requirements-analysis
    turn; if a historical loop is waiting without that turn, the bounded
    `/api/at-loop/source-requirements/start` endpoint can start it by `loopId`.

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
