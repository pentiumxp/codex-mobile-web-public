# Troubleshooting

Use this document for live production diagnosis before changing code. Prefer bounded metadata, ids, sizes, timestamps, and status fields. Do not print raw access keys, Push endpoints, full prompts, full rollout logs, or uploaded file content.

## Fast Triage

```powershell
$key = (Get-Content -Raw -LiteralPath "$env:USERPROFILE\.codex-mobile-web\access_key").Trim()
$headers = @{ "x-codex-mobile-key" = $key }
Invoke-RestMethod http://127.0.0.1:8787/api/public-config | ConvertTo-Json -Depth 6
Invoke-RestMethod http://127.0.0.1:8787/api/status -Headers $headers | ConvertTo-Json -Depth 6
Invoke-RestMethod http://127.0.0.1:8787/api/approvals -Headers $headers | ConvertTo-Json -Depth 6
Get-Content "$env:USERPROFILE\.codex\app-server-mux\endpoint.json" -Raw
```

Interpretation:

| Symptom | First check |
| --- | --- |
| Mobile Web offline | `GET /api/public-config`, 8787 listener PID, startup log |
| Messages not visible in Desktop | `/api/status` endpoint vs `endpoint.json`, Desktop launched through shared launcher |
| Send appears accepted then disappears | active turn id, recent turn history, pending echo, latest rollout growth |
| Thread looks stuck | rollout size/mtime, pending approvals, live command/tool process, latest turn status |
| Old command appears running | latest turn id vs raw operation fallback call id/turn id, app version includes raw-operation fix |
| PWA still shows old UI | `/api/public-config.clientBuildId`, browser shell cache, service worker cache name |
| Push missing | HTTPS/Tailscale access, VAPID files, subscription count, sub-agent suppression |
| Push says turn ended but no final reply appears | rollout `task_complete.last_agent_message`, completion-push no-final-message guard |

## Shared Mux Drift

Evidence of mux drift:

- `%USERPROFILE%\.codex\app-server-mux\endpoint.json` points to one host/port.
- Authenticated `/api/status` shows a different endpoint.
- Desktop and Mobile Web show different live turn streams.

Recovery:

1. Call authenticated `POST /api/app-server/reconnect` when only Mobile Web is stale.
2. If bridge code changed or endpoint process is stale, fully quit Desktop and relaunch once with `start-codex-desktop-shared.ps1 -ForceRestartMux`.
3. Avoid starting an independent managed app-server when shared mode is required; that creates a divergent stream.

## Sent Message Disappears After Re-entering Thread

Common causes:

- Browser submitted a stale `activeTurnId` and app-server accepted/ignored steering against an old marker.
- Latest live turn is genuinely waiting and `turn/steer` has not produced a durable `user_message` yet.
- Browser has not refreshed to the build containing pending steer echo and latest-durable active-state fixes.

Checks:

1. Read thread detail and note latest turn id/status.
2. Compare browser active turn, recent durable turns, and latest rollout mtime.
3. Check `/api/approvals`; pending approvals block cleanup.
4. Confirm server build is on or after the pending steer echo and raw-operation fixes.

Expected current behavior:

- Superseded active turns are stale and should fall through to new turn start.
- Latest durable live turn should be steered, not auto-interrupted.
- Pending steer echo keeps the user message visible during the wait.

## Thread Stuck Or Very Slow

Do not infer from rollout file size alone. Separate:

- Is rollout still growing?
- Is a local command/tool still running?
- Is approval pending?
- Is app-server/mux CPU active?
- Is the latest turn `inProgress` but no event has been written for minutes?

Useful checks:

```powershell
$rollout = "path-from-thread-summary-or-sessions-search.jsonl"
(Get-Item -LiteralPath $rollout).Length
(Get-Item -LiteralPath $rollout).LastWriteTime
Get-Content -LiteralPath $rollout -Tail 40
Get-Process | Sort-Object CPU -Descending | Select-Object -First 20 Id,ProcessName,CPU,Path
```

Interrupt only when evidence shows a stale active turn: no rollout growth, no pending approvals, no running local command/tool, and the turn has not emitted new events for a reasonable window. Do not interrupt a latest live turn merely because the last visible item is a completed operation.

## Old Command Card Shows As Running

This is usually display attribution, not a live process, when:

- The visible command belongs to an older interrupted turn.
- The real `function_call_output` or `exec_command_end` exists later in the rollout.
- `Get-Process` shows no matching tool process.

Current server behavior keeps at most one operation card only while the latest turn is live. Completed turns should not keep command/tool/file/search operation cards below the final reply; when scoped usage exists, the final frame should be the Usage summary. Raw fallback may attach a completed operation only when the latest turn is still live and the rollout event is tied to that same turn id; older completed operations must not attach to a newer live turn. If this regresses, inspect `readLatestRawOperation()` and `compactThread()` in `server.js`, then add coverage in `test/thread-item-timestamp-enrichment.test.js`.

## `rg` Appears Related To A Stall

Verify before blaming `rg`:

```powershell
Get-Command rg
rg --version
Measure-Command { rg -n "pattern" . -g "!node_modules/**" | Out-Null }
Get-Process rg -ErrorAction SilentlyContinue
```

On this machine, `rg.exe` may be available through `%USERPROFILE%\.local\bin\rg.exe`. A stale UI command card can make an already-completed `rg` look running; confirm through rollout output and process state.

## PWA Cache Or Version Mismatch

Check:

```powershell
Invoke-RestMethod http://127.0.0.1:8787/api/public-config | Select-Object version,clientBuildId,shellCacheName
```

Rules:

- Static browser behavior changes require bumping `CLIENT_BUILD_ID` in `public/app.js` and cache name in `public/sw.js`.
- Server-only behavior fixes do not need a PWA bump, but open clients may need a thread reload.
- If the phone still shows old UI, confirm it loaded the current `clientBuildId` and has accepted the refresh prompt or hard-reopened the PWA.
- Current clients should check for a new server-started shell build after startup, foreground/focus recovery, EventSource reconnect/status, and successful thread-list refresh. If `/api/public-config.clientBuildId` is newer but no prompt appears on an already-open old page, that page may still be running a pre-v144 client and needs one manual refresh to load the stronger detection path.

## File Preview Says Unsupported

If an agent reply shows a local Markdown/text file preview action but clicking it says the type is unsupported, inspect the exact `data-local-file-path` / `/api/files/preview?path=...` target. Codex source links often include location suffixes such as `README.md:12`, `README.md:12:3`, or `README.md#L12`.

Current server behavior strips those location suffixes before extension detection and root validation. The remaining path must still be an absolute local path, stay under an explicit `CODEX_MOBILE_FILE_PREVIEW_ROOTS` root, a known visible workspace root, the current thread cwd, or an enclosing Obsidian vault, and pass the sensitive-path denylist.

Focused checks:

```powershell
node --test test\file-preview.test.js test\file-preview-ui.test.js test\markdown-render.test.js
```

Do not fix file-preview misses by adding broad roots such as `%USERPROFILE%`, `%TEMP%`, `.codex`, the upload directory, or machine diagnostic folders. The intended fix for normal repository files is that visible workspace roots and the current thread cwd are already accepted.

## Worktree Thread Missing From The Thread List

Codex may run a task in `%USERPROFILE%\.codex\worktrees\<id>\<repo>` while the visible workspace is the primary repository path such as `%USERPROFILE%\Documents\<repo>`. Current visibility logic should treat that worktree as visible when `<repo>` matches a known workspace basename.

If a worktree thread is missing:

- Confirm `GET /api/workspaces` includes the primary repository root.
- Confirm the thread cwd follows the Codex worktree shape and the final repo directory name matches the visible workspace basename.
- Check that the row is not archived/deleted, a backup rollout, a spawned Sub Agent child session, or outside the selected workspace filter.
- Run focused coverage:

```powershell
node --test test\thread-visibility.test.js test\mobile-viewport.test.js
```

## Quoted Uploaded Images Stay As Text

If the original user upload renders as a thumbnail but a later Codex/plan reply shows raw `Uploaded attachments:` text, inspect `public/app.js` attachment-summary parsing first.

The parser should recognize LF and CRLF summaries, plus Markdown blockquote-style quoted lines such as `> Uploaded attachments:` and `> - IMG_0001.jpg (...)`. It should also treat raw app-server `input_text` parts as text and `input_image` / `image_url` parts as images, including object-shaped `image_url.url`. The saved upload path must still be under `%USERPROFILE%\.codex-mobile-web\uploads` so `/api/uploads/file?path=...` can serve it to the authenticated browser.

If the DOM contains an `<img>` for the saved upload path but the browser still shows a broken or blank thumbnail, check the upload route response headers. Saved `.jpg`, `.jpeg`, `.webp`, `.gif`, and `.png` files must return image MIME types such as `image/jpeg` rather than `application/octet-stream`.

If Codex generates an image as Markdown or plain text `data:image/png;base64,...`, inspect `public/markdown-renderer.js`. Current builds render safe bitmap data images (`png`, `jpeg`, `webp`, `gif`) as bounded `<img>` figures and intentionally reject SVG data images.

Focused checks:

```powershell
node --test test\conversation-render.test.js test\mobile-viewport.test.js
```

## ImageView Screenshot Shows Broken Image

If a Codex turn displays an `Image` card for a visual verification screenshot but the thumbnail is broken, distinguish it from uploaded attachments first. Tool-generated screenshots often come from `view_image` / `imageView` paths under `%TEMP%`, not `%USERPROFILE%\.codex-mobile-web\uploads`. Codex-generated effect images can also arrive as `imageGeneration` items with `savedPath` under `%USERPROFILE%\.codex\generated_images`.

Current behavior should cache small `imageView` and `imageGeneration.savedPath` source files into `%USERPROFILE%\.codex-mobile-web\generated-images` and serve them through `/api/generated-images/file`. Do not fix this by adding `%TEMP%` or `%USERPROFILE%\.codex` to `CODEX_MOBILE_FILE_PREVIEW_ROOTS`; that would broaden local file preview access beyond the current thread workspace. If the source temp/generated file was already deleted before Mobile Web saw the item, the historical card cannot be recovered from the path alone.

Focused checks:

```powershell
node --test test\generated-image-cache-service.test.js test\file-preview-ui.test.js test\mobile-viewport.test.js
```

## Usage Card Shows Zero Tokens

If a completed-turn `Usage` card shows `0` for context window and token usage even though the turn clearly used the model, inspect the rollout `token_count` events for that turn.

Known app-server behavior can emit a final sentinel-shaped `token_count` immediately before `task_complete`:

- `last_token_usage` fields are all `0`.
- `total_token_usage.input_tokens`, `cached_input_tokens`, `output_tokens`, and `reasoning_output_tokens` are all `0`.
- `total_token_usage.total_tokens` equals `model_context_window`.

That event is not real usage. Mobile Web should ignore it and preserve the latest prior valid `token_count` for the same turn. If no valid token event exists, omit the `Usage` card instead of displaying a guessed zero summary.

## Usage Card Last Turn Looks Too Small

If the `Usage` card's `last turn` row looks like it only counted the final answer segment, inspect all scoped rollout `token_count` events for that turn. Multi-call turns can emit many valid token events before `task_complete`; a final event's `last_token_usage` is only the final model call, not the whole turn.

Mobile Web should compute the displayed turn-level usage from cumulative `total_token_usage` deltas across valid scoped events, while using the final valid event only for context-window percentage/risk. Duplicate token events with the same cumulative totals should add zero, and zero/window sentinel events should still be ignored.

## Workspace Token Totals Are Missing Or Wrong

Workspace `总/周/今` totals come from
`%USERPROFILE%\.codex-mobile-web\token-usage-stats.sqlite`, not from the browser
session or a fresh rollout scan. The write happens on `turn/completed` after
Mobile Web resolves the scoped `Usage` summary for that turn.

Checks:

- The 8787 listener is running the build that includes
  `adapters/token-usage-stats-service.js`.
- `CODEX_MOBILE_TOKEN_USAGE_DB` is unset or points to the intended SQLite file.
- The local `sqlite3` executable is discoverable through `CODEX_MOBILE_SQLITE3_EXE`,
  `SQLITE3_EXE`, the Android Platform Tools paths, or `PATH`.
- The completed turn has a valid scoped `token_count`; turns with only the
  zero/window sentinel are intentionally not recorded.
- Repeated completion notifications should replace the same `(thread_id,
  turn_id)` row, not add another row.
- Daily/project detail should split uncached input (`inputTokens -
  cachedInputTokens`), cached input, output, and reasoning output. If a category
  is missing, inspect the corresponding SQLite columns and the grouped `cwd`
  query before changing the frontend display.

If the sidebar still shows zero after a known completed turn, inspect the local
runtime DB rather than the frontend cache. Do not edit `.codex` state to repair
this ledger.

If the full-screen `统计` project list shows a garbled Workspace name while
`/api/workspaces` shows the same root correctly, inspect the `cwd` values in the
token usage DB. Current builds normalize known Windows mojibake such as
`ϵͳ¹¤¾ß` back to the visible Unicode Workspace root during record and query, so
old rows should merge into the correct project after the 8787 listener restarts.

## Page Refresh Prompt Appears While Files Are Still Being Edited

`/api/public-config` should report the app-shell build/cache snapshot captured
when the 8787 listener started. It should not change merely because `public/`
files have been edited on disk while the old listener is still running. A normal
"页面有新版本" prompt should appear only after the listener has restarted into the
new build and the browser has preflighted the full target shell cache.

If the prompt appears immediately after a source edit and before a server
restart, check whether `clientBuildId()`, `shellCacheName`, or `buildId` has
regressed to dynamically reading `public/sw.js` / static asset mtimes on each
`/api/public-config` request.

If the prompt does not appear after a real server restart into a newer shell
build, check whether the loaded browser code calls `scheduleVisiblePageRefreshCheck()`
from EventSource `onopen`, `status` messages, and successful `loadThreads()`.
Older open pages may only check on a 60-second timer or foreground/focus events.

## Composer Quota Jumps Between Two Weekly Percentages

If the composer quota alternates between two weekly remaining percentages in the
same open thread, compare authenticated `/api/public-config`, authenticated
`/api/status`, and recent rollout `rate_limits` events. A shared mux can observe
source-less `account/rateLimits/updated` events from another workspace, and
recent rollout scans can contain different snapshots for the same `limitId=codex`.

Current builds keep rollout-scanned quota as a cold-start fallback only and do
not broadcast source-less rate-limit notifications directly to browsers. The
composer quota should follow active `/api/public-config` / `/api/status`
snapshots for the current Mobile Web chain, while profile settings can still use
stored or scanned snapshots for inactive profile rows.

## Web Push

Checks:

- Page is opened through HTTPS, not plain LAN HTTP.
- `/api/public-config.push.supported` is true and `subscriptionCount` is nonzero.
- VAPID subject is not localhost.
- Target thread is not a sub-agent child thread.

Notification clicks should focus/open the app shell and pass the thread id through service worker messaging. Avoid direct `/?thread=...` launches on iOS when they risk separate PWA scenes.

If a Push says a turn ended but the thread has no final assistant reply, inspect the rollout `task_complete` payload for that turn. A normal completed turn should have `last_agent_message`; if it is explicitly null or empty, the app-server/runtime ended the turn without a final response. Current Mobile Web suppresses normal completion Push in that explicit no-final-message case.

When Codex runs inside Hermes Mobile as `/?embed=hermes`, the iframe should not
register its own Web Push subscription. Check
`/api/public-config.hermesPlugin.notificationDelegateConfigured`: if it is
true, turn-completed notifications are delegated to Hermes Action Inbox/Web
Push; if false, embedded clients should remain quiet and standalone Mobile Web
keeps the local Push fallback.

If a Hermes Inbox click opens the Codex iframe but not the intended thread/task,
check whether the iframe URL only contains bounded route hints such as
`pluginId=codex-mobile`, `pluginRoute`, `pluginThreadId`, `pluginTaskId`, or
`pluginItemId`. Current embed mode consumes those hints, opens the matching
thread when available, and scrubs them from the URL. If the target was deleted
or is no longer visible, Codex should stay on the normal embedded primary page
and show a small in-app diagnostic such as `Notification target is unavailable`
instead of leaving a broken detail page selected.

If Hermes receives only the short notification preview but not the long
completed-turn receipt, inspect the delegated notification payload rather than
the standalone Web Push path. Current plugin delegation keeps Web Push preview
short and sends the long receipt through `detailMessage`. The receipt is built
from the final assistant message plus Usage summary; if both are missing, Codex
will not fabricate a long body from command output or reasoning noise.

## Cross-Thread Task Card Does Not Inject

If a target-side `Approve` succeeds visually but no new target-thread turn
appears, separate these cases:

- the card never left `pending`;
- the card changed to `approved`, but target-thread injection failed before
  `turn/start`;
- the new target turn started, but the browser is still showing stale detail.

Checks:

```powershell
$headers = @{ "x-codex-mobile-key" = $key }
Invoke-RestMethod http://127.0.0.1:8787/api/threads/<target-thread-id> -Headers $headers | ConvertTo-Json -Depth 6
Invoke-RestMethod http://127.0.0.1:8787/api/thread-task-cards/<card-id>?threadId=<target-thread-id> -Headers $headers | ConvertTo-Json -Depth 6
```

Current implementation rules:

- pending task cards live in `thread.threadTaskCards`, not in
  `thread.turns[*].items`;
- thread-list summaries now carry `pendingIncomingTaskCardCount`, so the target
  thread can show a `Task N` badge before the detail view is opened;
- only target-side approve may inject;
- approval injects a real new target-thread `turn/start` input;
- delete and revoke never inject;
- reply creates a reverse-direction pending card, not a direct source-thread
  message.
- autonomous workflow cards still require the first target-side approval; only
  later cards with the same workflow id and the same unordered pair of
  source/target thread ids may auto-inject without another click.

If an autonomous follow-up card does not auto-run, inspect the stored card and
workflow fields in `%USERPROFILE%\.codex-mobile-web\thread-task-cards.json`.
The card should have `workflow.mode="autonomous"` and a non-empty `workflow.id`.
The store should also contain an active workflow with the same id and the same
two thread ids. Reusing the same workflow id for a different thread pair is
intentionally treated as unapproved and will leave the card pending.

If source-side draft `Approve` appears to hang, check whether the card was
already created in `%USERPROFILE%\.codex-mobile-web\thread-task-cards.json`.
Current draft approval uses a stable key derived from the source thread and
draft item, so repeated taps should reuse the same pending card instead of
creating duplicates. After creation the browser should switch directly to the
target thread; it should not wait for a slow source-thread detail refresh. If
the target thread is long, Mobile Web should also focus the specific pending
card via the existing route-hint target lookup instead of leaving the view at
the conversation bottom. Pending task cards should now render at the bottom of
the thread, after visible turns and detached approvals, so opening the target
thread normally should also leave the card near the latest content instead of at
the top of a long history. Settled cards are no longer rendered in thread
detail, so if a card was approved and a new turn started, look for the injected
turn rather than expecting the old card to remain visible. If `Approve` does
start a new turn but the old card still lingers in the current thread until you
leave and re-enter, the browser build is stale; current builds locally settle
the card immediately after a successful approve/delete/revoke/reply response,
then follow with a forced current-thread refresh instead of the old same-thread
`loadThread()` cache path. Current builds also keep polling briefly for the
returned injected `turnId`; once that turn becomes visible, the browser scrolls
to the injected turn instead of leaving the user to back out and re-enter.

If a target thread already has an incompatible live app-server state, approval
may fail at the `thread/resume` / `turn/start` stage. In that case the card
should remain actionable instead of silently disappearing.

The thread-task-card API preserves service-level error codes. A missing card
read should return `404 task_card_not_found`; wrong-thread actions should return
`403`; settled-card actions should return `409`. If these appear as a generic
500, the route error wrapper has regressed and the browser may show an
ambiguous failure instead of a bounded task-card diagnostic.

## `#` Task-card Command Does Not Parse

`#` at the start of the composer is now reserved for cross-thread task-card
commands. It should not enter the normal message-send route.

Current behavior:

- bare `#` is invalid;
- `#` commands do not support attachments yet;
- the browser sends a bounded draft request to the current Codex thread;
- the model must return a bounded draft block with one visible
  `targetThreadId`, or an empty target plus an error.

Working examples:

# 发给 Finance Review：请核验 5 月结账映射
# 让 Hermes 05-26 配合处理插件刷新联动
# 请让线程「Hermes 发布检查」确认插件通知回执是否已入库
If no draft card appears, inspect:

- whether the current sent message contains the
  `<codex-mobile-thread-task-card-request>` envelope;
- whether the assistant reply contains a valid
  `<codex-mobile-thread-task-card-draft>...</codex-mobile-thread-task-card-draft>`
  JSON block;
- whether `%USERPROFILE%\.codex-mobile-web\thread-task-cards.json` was updated
  after the draft appeared. If the draft exists but the store timestamp and
  target pending count do not change, inspect the browser-side queued draft
  lookup in `public/app.js`; it must skip earlier non-draft assistant/plan
  messages instead of aborting before the later draft item;
- whether the returned `targetThreadId` is still present in the visible thread
  list;
- whether attachments were present, which still blocks `#` commands.

Current UI rules:

- while the current turn is still waiting for the model to emit a bounded draft,
  the browser should show a pending draft placeholder card instead of a blank
  gap;
- if the assistant has started streaming
  `<codex-mobile-thread-task-card-draft>...` but the JSON block is not complete
  yet, the browser should suppress the raw XML and keep showing the pending
  placeholder until the full draft card is ready;
- pending draft cards and pending task cards should default to a medium card
  with summary visible and the long body/details behind an explicit expand
  action, rather than rendering the full body immediately.

## Hermes Embed Missing Version/Restart/PR Actions

If the plugin sidebar is missing the version pill, public-PR status, or
`Restart`, check whether embed CSS is hiding the whole `.version-actions` row.
Current builds should hide only the duplicate main-pane version actions, not the
sidebar header row.

## Hermes Embed 压缩续接确认框不出现

If `压缩续接` can be selected from the thread action sheet but no confirmation
popup appears in Hermes embed mode, check whether the browser is still using the
old native `window.confirm(...)` path. Current builds should render an in-app
continuation dialog inside the iframe, because native confirm dialogs are not
reliable in the plugin host path.

## Hermes Plugin Seems To Reload Without Explanation

When Mobile Web sends `codex-mobile.plugin.refresh_required` to Hermes, the
current iframe should first show an in-app refresh notice such as "Refreshing
plugin page..." so the user can distinguish a deliberate host-driven reload from
an unexplained crash/reload. If the iframe reloads with no visible notice, the
browser build is stale or the refresh-required path regressed.

## Shared-Chain Restart Stops 8787 But Mobile Web Does Not Come Back

Do not treat "the restart command was sent" or "the old Node listener exited" as
proof that Mobile Web is healthy again. The success condition is stricter:

- a new `8787` listener exists; and
- `/api/public-config` is reachable again.

If either check is missing, Mobile Web should be treated as down even if a
restart script or detached PowerShell command was already launched.

## Public PR Prompt Targets The Wrong Thread

Public-PR review preparation must not reuse an arbitrary currently open thread.
Current builds should route the generated review text into a new-thread draft for
the app workspace path reported by `/api/public-config.workspacePath`. If the
prompt still lands inside an unrelated Agent/Hermes thread, the browser build is
stale or the client never loaded the workspace-path config.
## Image Upload Context Growth

Large rollout growth after image upload often comes from repeated `compacted.replacement_history` snapshots with `input_image` payloads.

Current mitigations:

- `public/image-compressor.js` compresses browser images before upload.
- `adapters/message-input-service.js` keeps image uploads reference-only by default, so new uploads are sent as path text rather than app-server `localImage` parts.
- `adapters/message-input-service.js` avoids requesting extended-history persistence for image-upload turns by default.

Check current mode:

```powershell
Invoke-RestMethod http://127.0.0.1:8787/api/public-config | Select-Object imageContextMode
```

Modes:

- `reference` is the default and sends no image pixels to the model.
- `latest` / `vision` sends only the latest uploaded image as a `localImage` part.
- `all` restores legacy all-image behavior and should be treated as high-risk for large context growth.

Limitations:

- Existing app-server in-memory thread state may still hold prior images.
- Old rollout records are not rewritten.
- Extended-history flags do not purge app-server current history; use a fresh continuation after switching to reference-only mode if the thread is already polluted.

## Continuation Issues

If a continuation thread starts with wrong runtime settings:

1. Inspect source rollout `turn_context` for model/effort/sandbox/approval.
2. Inspect `state_5.sqlite` thread metadata when available.
3. Inspect `threadRuntimeSettings()` and `applyStartThreadRuntimeSettings()` in `server.js`.

Known finding: if reasoning effort is not explicitly passed, continuation can fall back to Codex config defaults such as `xhigh` even when the source thread used `medium`.

If a continuation starts with unexpectedly high input tokens, inspect the bootstrap size and source handoff handling:

- Bootstrap should be bounded by `CODEX_MOBILE_CONTINUATION_BOOTSTRAP_CHARS` default `52000`.
- Source handoff should be listed by file path with a small excerpt, not pasted in full.
- Workspace handoff and prior lineage excerpts should stay bounded.
- Durable project facts should move to `.agent-context` and `docs/`, not into a larger bootstrap prompt.

## Hermes Mobile Plugin Checks

Codex Mobile Web's Hermes integration is an independent embedded-app plugin.
Do not diagnose it through a worker queue or collaboration queue.

For plugin setup:

1. Check the manifest:

   ```powershell
   Invoke-RestMethod http://127.0.0.1:8787/api/v1/hermes/plugin/manifest | ConvertTo-Json -Depth 6
   ```

2. Register the Hermes callback URL with the Codex Mobile Access Key. The
   callback may be an HTTPS domain:

   ```powershell
   Invoke-RestMethod http://127.0.0.1:8787/api/v1/hermes/plugin/workspaces `
     -Method Post `
     -Headers @{ Authorization = "Bearer <codex-mobile-access-key>" } `
     -ContentType "application/json" `
     -Body '{"workspace_id":"owner","hermes_callback_url":"https://hermes.example.test/api/plugins/codex-mobile/callback"}'
   ```

3. Register the Hermes PWA iframe origin for CSP `frame-ancestors`. Use the
   deployment's real HTTPS origin; do not hard-code a personal domain in source:

   ```powershell
   Invoke-RestMethod http://127.0.0.1:8787/api/v1/hermes/plugin/origins `
     -Method Post `
     -Headers @{ Authorization = "Bearer <codex-mobile-access-key>" } `
     -ContentType "application/json" `
     -Body '{"workspace_id":"owner","hermes_origin":"https://hermes.example.test"}'
   ```

4. Confirm the registration without printing the Access Key:

   ```powershell
   Invoke-RestMethod "http://127.0.0.1:8787/api/v1/hermes/plugin/registration?workspaceId=owner" `
     -Headers @{ Authorization = "Bearer <codex-mobile-access-key>" }
   ```

5. Test launch through `POST /api/v1/hermes/plugin/launch`. The response should
   contain a short-lived `entry_path` with `codexPluginLaunch`; it must not
   contain the long-lived Access Key. In the browser iframe, the app exchanges
   this launch token through `/api/v1/hermes/plugin/session`, removes the
   one-time token from the URL, and keeps only an in-memory plugin session.

6. For a Windows scheduled-task deployment, persist the external HTTPS Codex
   URL and the Hermes iframe origin in the task arguments rather than only in
   the current shell:

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install-codex-mobile-web-startup.ps1 -RunNow `
     -HermesPluginBaseUrl "https://codex.example.test:8443" `
     -HermesPluginFrameOrigins "https://hermes.example.test"
   ```

7. Check notification delegation without printing the Hermes key. The Codex
   route is protected by the Codex Mobile Access Key, then the backend reads the
   Hermes key from `CODEX_MOBILE_HERMES_PLUGIN_NOTIFICATION_KEY_FILE`,
   `CODEX_MOBILE_HERMES_PLUGIN_NOTIFICATION_KEY`, or the
   `CODEX_MOBILE_HERMES_WEB_KEY` fallbacks:

   ```powershell
   Invoke-RestMethod http://127.0.0.1:8787/api/v1/hermes/plugin/notifications `
     -Method Post `
     -Headers @{ Authorization = "Bearer <codex-mobile-access-key>" } `
     -ContentType "application/json" `
     -Body '{"workspaceId":"owner","eventId":"codex-test-1","title":"Codex test","summary":"Test notification","itemType":"info","priority":"normal","route":{"name":"thread","tab":"codex","itemId":"test-thread"},"notify":false}'
   ```

   A successful call should return an `inboxItem.id` or `inboxItemId`. Reusing
   the same stable `eventId` should let Hermes dedupe. `notify:false` should
   create only an Inbox item. `openMode:"plugin"` may request plugin-tab
   opening while still creating the Inbox record. A 401/403 response means the
   Hermes workspace/key binding is wrong or unauthorized. Do not put the Hermes
   key in the request body, iframe URL, frontend JavaScript, manifest, or logs.

If Hermes Mobile is served over HTTPS, the plugin entry URL must also be HTTPS
or the browser may block the embedded frame as mixed content. The fix is a
deployment URL/TLS configuration change, not a Codex Access Key change. Set
`CODEX_MOBILE_HERMES_PLUGIN_BASE_URL` or `CODEX_MOBILE_PUBLIC_BASE_URL` to the
external HTTPS Codex Mobile URL when the Node listener itself only sees local
HTTP. If the manifest still returns `http://127.0.0.1:8787/?embed=hermes` for a
HTTPS Hermes origin, check the current Node process environment or the
scheduled-task action arguments; the registered Hermes origin only controls
`frame-ancestors`, not the Codex entry/base URL.

If the iframe opens a standalone login panel after a valid launch, check:

- the launch token was exchanged before its TTL expired;
- the Node listener has not restarted and lost in-memory launch/session tokens;
- the iframe URL has `embed=hermes` and no stale `codexPluginLaunch` after the
  first successful exchange;
- `/api/v1/hermes/plugin/session` is included in `/api/public-config.hermesPlugin`.

If a right-swipe on a normal Codex plugin thread does nothing on iOS, check the
`codex-mobile.plugin.navigation` message first: normal
thread/workspace/new-thread routes must report `canGoBack: true` so Hermes
forwards its back affordance as `{ type: "hermes.plugin.back", version: 1 }`.
Codex should handle that secondary-page back by returning to the embedded
primary thread-switcher/settings page. That primary page must report
`canGoBack:false`, allowing Hermes Mobile's bottom tabs to remain visible. If
right-swipe instead opens Codex's standalone initial Workspace page, check the
`hermes.plugin.back` handler: thread-page back must clear only the selected
thread detail, not leave the iframe in the standalone home route. If the primary
thread-switcher/settings page is still shown as a drawer or closes back to the
thread, check the `embed-hermes-primary` class and CSS rules. When file preview,
rename/action dialog, or subagent panel is already open, the same back event
should close that transient layer before page-level back is applied. Hermes
should use postMessage only; it must not inspect Codex DOM or call internal
Codex route functions.

The validated target behavior after v108 is: Codex's thread-switcher/settings
surface is the embedded primary page with Hermes bottom tabs visible; a Codex
thread page is secondary and right-swipe/back returns to that primary page.

## Returning From Another App Shows `Loading thread...`

If Mobile Web flashes `Loading thread...` when the user simply switches back
from another app, the foreground recovery path is too heavy.

Expected behavior after `codex-mobile-shell-v152`:

- `resumeMobileSession()` keeps the current thread rendered in place.
- The thread list refresh stays silent.
- The active current thread refreshes through background merge/poll work rather
  than a same-thread `loadThread()` reset.
- URL thread hints still open a different thread when needed, but if the hinted
  thread already matches the current thread, the app should schedule a
  lightweight refresh instead of a full reload.
- On cold startup with a saved current thread, `start()` should set the opening
  intent before showing the app shell, so the user sees a stable
  `Opening thread...` state instead of a transient `Select a thread` empty page.
- The saved-thread detail request should start in parallel with workspace/list
  refresh instead of waiting for the list response first.
- Startup emits `startup_stage` client events for `public_config_done`,
  `bootstrap_start`, `status_done`, `workspaces_done`, `threads_done`, and
  `bootstrap_done`; compare these with `thread_switch_complete` to identify
  whether the delay is network, list refresh, detail read, or client rendering.
- `pageshow`, `focus`, and visibility resume events that fire while startup is
  still in progress should not run the full network resume path. They should
  log `mobile_resume_skipped_startup` and only run visual recovery, otherwise
  cold startup duplicates status/list/detail requests and can report a slow
  `mobile_resume_slow` even though bootstrap is already opening the thread.

If the page is slow before or around the thread detail load, measure
`/api/threads` by requested limit before changing thread-detail code. The mobile
frontend should keep its default list page at `THREAD_LIST_PAGE_LIMIT = 40`; on
this Windows deployment, requesting 60 or 80 rows made the list route roughly
twice as slow even though the visible list was much smaller.

## First Load Flashes Workspace Home Before Opening A Thread

If Mobile Web already knows the startup target thread from the saved current
thread id, URL `?thread=...`, or Hermes plugin route hint, the app should not
briefly render the Workspace/recent-thread home panel first.

Expected behavior after `codex-mobile-shell-v122`:

- Startup marks thread-open intent before the first thread-list fetch finishes.
- The main panel stays in a stable `Opening thread...` state until the target
  thread is restored.
- The initial thread-list fetch stays silent while that direct-thread startup is
  pending, reducing visible flicker in the main panel.

## Hermes Embed Startup Shows Several Intermediate Screens

If slow network startup shows `Select a thread`, then `Loading threads...`, then
the final plugin primary page, inspect the embedded startup loading gate.

Expected behavior after `codex-mobile-shell-v147`:

- `/?embed=hermes` shows a stable `正在加载 Codex...` loading layer during initial
  bootstrap.
- The app shell stays hidden behind that layer until `loadWorkspaces()`,
  `loadThreads()`, and the final primary page, launch target, or route hint have
  rendered.
- Recovering/auth paths must clear the startup layer before showing the bounded
  plugin-recovering or auth state.

## Hermes Embed Startup Briefly Shows A Red Codex Error Panel

If an embedded Hermes launch/session is already being recovered through
`codex-mobile.plugin.refresh_required`, the iframe should not first flash the
red Codex auth/login error panel.

Expected behavior after `codex-mobile-shell-v123`:

- Plugin launch/session/auth failures that already trigger a Hermes refresh stay
  in a neutral in-app recovering state.
- The iframe shows a bounded `Refreshing Codex Mobile plugin...` style message
  while Hermes rebuilds the iframe.
- The red plugin auth panel should be reserved for non-recovering states, not
  for transient launch/session churn that Hermes can immediately replace.

## Workspace Creation Is Missing Or New Thread Says Workspace Is Not Visible

Workspace creation is intentionally exposed at the bottom of the Workspace
dropdown list, not beside the new-thread button. If the entry is missing or a
newly created workspace is rejected by `/api/threads/new-message`, check:

- `/api/public-config.workspaceCreate.enabled` should be true.
- `CODEX_MOBILE_WORKSPACE_CREATE_ROOTS` should point only at existing parent
  directories. If unset, Mobile Web uses the user's Documents folder, then the
  user profile folder.
- `%USERPROFILE%\.codex-mobile-web\workspace-registry.json` should contain only
  bounded metadata for Mobile Web-created workspaces: cwd, label, parent,
  source, and timestamps.
- `GET /api/workspaces` should include the created cwd with `source:"mobile"`.
- `visibleWorkspaceRoots()` should merge the registry service list before the
  new-thread route checks workspace visibility.

Do not fix this by editing `.codex\.codex-global-state.json` manually. Use the
Mobile Web registry route or Codex/Desktop workspace selection paths.

## Codex Profile Switch Does Not Change Account

The settings-panel profile switcher changes the single active Mobile Web
`CODEX_HOME` after a listener restart. It does not live-switch the current Node
process and it does not change Codex Desktop GUI login state.

Check these facts in order:

- `/api/codex-profiles` should list each profile with `auth.status`,
  `auth.email` or another safe account label, and `activeProfileId`.
- `%USERPROFILE%\.codex-mobile-web\codex-profiles.json` should contain the
  selected `activeProfileId`.
- After switching, the hidden/windowless launcher must restart the shared
  chain; `/api/status.codexHome` should match the selected profile home.
- The restart log should show the same `codexHome=...` value and the mux
  endpoint should be under that profile's
  `<CODEX_HOME>\app-server-mux\endpoint.json`, not always the default
  `%USERPROFILE%\.codex` endpoint.
- If Desktop must be used as a recovery path, fully quit Desktop and relaunch
  it through `start-codex-desktop-shared.ps1 -ProfileId <id>` or the matching
  `start-codex-desktop-<id>.cmd` wrapper so Desktop and Mobile share the same
  profile mux. Desktop GUI login may still be global; verify shared state by
  comparing the selected `CODEX_HOME` and endpoint.
- The shared-chain restart should only stop the selected endpoint's recorded
  mux/child PIDs. If a dry run lists many unrelated profile muxes, treat that
  as a regression before running a real restart.
- If `switchSupported=false`, the process is pinned to a fixed
  `CODEX_MOBILE_MUX_ENDPOINT_FILE`, `CODEX_MOBILE_APP_SERVER_WS`, or
  `CODEX_MOBILE_APP_SERVER_TCP`; those deployments cannot be switched by a
  profile file.
- Inactive quota values are recent rollout snapshots. They can be stale or
  unavailable until that profile has produced recent `rate_limits` events.

The browser should never display or log raw token fields from `auth.json`.

## Source `#` Task-Card Draft Reappears After Approve Or Dismiss

If the source thread hides a `#`-generated draft card immediately after
`Approve` or `Dismiss`, but the same draft comes back after leaving and
re-entering the thread, the draft-settled state was only held in browser memory.

Expected behavior after `codex-mobile-shell-v129`:

- Draft-card settled states are persisted in browser storage under
  `codexMobileThreadTaskCardDraftStates`.
- Source-thread draft cards with status `created` or `dismissed` stay hidden
  after a thread reload or app re-entry.
- Pending/in-flight draft creation states are not persisted as durable settled
  state.

## Hermes Plugin Refresh Notice Stays On Screen Too Long

If Hermes embed mode shows `Refreshing plugin page...` and the notice never
clears even when the host-driven refresh does not happen immediately, the page
should bound that notice to a short lifetime.

Expected behavior after `codex-mobile-shell-v129`:

- `codex-mobile.plugin.refresh_required` first shows the in-app refresh notice.
- The notice auto-dismisses after about 10 seconds if the page has not already
  been replaced by the Hermes host refresh flow.
- Recovering screens such as plugin launch/session refresh clear the pending
  notice immediately instead of stacking the two states.
