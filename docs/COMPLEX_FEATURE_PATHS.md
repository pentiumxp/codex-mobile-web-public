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

## Thread Detail And Conversation Rendering

Use when changing visible items, operation cards, timestamps, compaction notices, image views, or merge behavior.

Implementation path:

1. Decide whether the behavior belongs in server compaction or browser rendering.
2. Server should compact, enrich, and bound data volume; browser should render stable visible items without broad DOM churn.
3. Operation cards in the latest turn should globally show only the newest operation card, with a compact four-line visual budget: one metadata row plus up to three clipped detail lines.
4. Raw operation fallback must respect latest live turn id and completion outputs.
5. Live reasoning should update the timer/activity label, not insert reasoning rows.
6. Type-only context compaction markers must not synthesize visible pending/completed notices.
7. Current-turn upward scroll jump targets the final receipt/summary: the last `agentMessage` or `plan`, then the last non-user, non-live-operation fallback. It should not jump to the first assistant reply. Preserve an already activated live-turn anchor across `turn/completed`, and show the button when the target item's start is above the viewport.
8. Live/final receipt rendering must not force-scroll while the user is reading. Recent manual scroll away from bottom should create a current-turn hold even during programmatic bottom-scroll; render stick-to-bottom and bottom-follow timers must respect that hold.
9. Completed-turn context/token usage summaries should be synthetic diagnostic items from rollout `token_count` events. They must be omitted when no scoped token event exists and must not become the upward final-receipt jump target. If cached input is present, the displayed `in` value should exclude cached input while context-window percent/risk stays based on raw input tokens.
10. Test with `test/thread-item-timestamp-enrichment.test.js`, `test/conversation-render.test.js`, `test/collab-agent-render.test.js`, `test/message-timestamp.test.js`, `test/turn-scroll-controls.test.js`, `test/turn-usage-summary-service.test.js`, and `test/mobile-viewport.test.js`.

## Rollout Continuation

Use when changing "压缩续接", handoff generation, lineage, archive-after-continuation, large handoff compaction, or runtime setting inheritance.

Implementation path:

1. Keep browser flow on `POST /api/thread-continuations` plus job polling.
2. Keep generated source handoffs under `.agent-context/thread-handoffs/` and ignored.
3. Keep large workspace handoff compaction in `adapters/continuation-handoff-compaction-service.js`.
4. Keep the new-thread bootstrap as a bounded index plus excerpts; the full source handoff lives in `.agent-context/thread-handoffs/` and must be read by the new thread when exact state matters.
5. Include source id/title/cwd/rollout path/rollout size/status, latest runtime settings, recent turn summaries, workspace context excerpts, and lineage index.
6. Avoid injecting unrelated private thread rules into the new bootstrap.
7. For runtime settings, read rollout `turn_context` and SQLite/app-server metadata; pass only fields supported by app-server.
8. Test with `test/continuation-lineage.test.js`, `test/continuation-handoff-compaction-service.test.js`, `test/new-thread-route.test.js`, and relevant runtime-settings tests.

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
2. Ensure refresh prompt verifies the target shell cache before pruning old caches or reloading.
3. Keep iOS standalone behavior; do not use display-mode checks as a blocking gate.
4. Respect safe areas, keyboard/visual viewport rules, and touch layout breakpoints.
5. Test with `test/mobile-viewport.test.js`, `test/app-update.test.js`, and relevant UI tests.
6. Tell the user that open PWA clients need the refresh prompt, hard refresh, or close/reopen.

## Web Push

Use when changing Push subscription, notification payloads, click handling, or sub-agent suppression.

Implementation path:

1. Keep VAPID/subscription runtime files out of source and handoff.
2. Keep notification click routing through app shell focus/open and service worker message passing.
3. Fail closed for unknown thread ids or sub-agent child threads.
4. Test service logic with `test/push-notification-service.test.js` and shell behavior with `test/mobile-viewport.test.js`.
5. Validate over HTTPS/Tailscale when testing real subscription behavior.

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
9. Render saved image uploads as bounded thumbnails from the upload/file preview route even when model context stays reference-only, including quoted `Uploaded attachments:` summaries in Codex/plan replies. Keep this parser tolerant of CRLF line endings, Markdown blockquote-style quoted summaries, and raw app-server `input_text` / `input_image` / `image_url` content parts. The upload preview response must use a real image MIME type for `.jpg`, `.jpeg`, `.webp`, `.gif`, and related saved upload paths.
10. Render app-server `imageView` items as direct image views; never stringify data URLs into conversation text.
11. Test with upload/file/image focused tests.

## Runtime Settings Inheritance

Use when changing model, reasoning effort, sandbox, approval, verbosity, or continuation/new-turn runtime settings.

Implementation path:

1. Determine the actual app-server field name and supported protocol shape.
2. Read the latest rollout `turn_context` and SQLite/app-server thread metadata.
3. Do not default to global Codex config when a source thread has explicit settings that can be inherited.
4. Add tests that cover both small threads and large-rollout fallback paths.
5. Re-check `/api/public-config` and a real continuation/new send path after activation.

## Hermes / ChatGPT Pro Integration

Use when diagnosing or changing local Hermes-to-Codex integration.

Implementation path:

1. Identify which integration is active:
   - ChatGPT Pro bridge: Hermes Gateway plugin -> `bridge-host.js` `/bridge/chatgpt-pro` -> Codex Mobile thread API.
   - Legacy polling worker: `codex-hermes-main` -> `/api/codex-mux/...`.
2. For ChatGPT Pro, inspect the deployment's configured bridge-state file for the Codex thread id, then inspect that thread through Mobile Web.
3. Do not assume `/api/codex-mux` exists on current Hermes production; a 404 means that legacy queue path is unavailable.
4. Do not print bridge keys or owner keys.

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
