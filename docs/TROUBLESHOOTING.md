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
| Profile switch hides workspaces or threads | active `codexProfiles.activeCodexHome`, non-default profile shared-state links, `/api/threads?limit=10` |
| Quota chips show the previous account after switch | `/api/status.rateLimits`, browser quota localStorage, profile-switch cache clearing |
| Archived projectless thread reappears | session-index fallback, `archived_sessions`, `test/thread-archive.test.js` |
| After profile switch only a few workspaces or no threads appear | `/api/public-config.codexProfiles.activeCodexHome`, profile state links, and `state_5.sqlite` / `sessions` under the active home |
| Threads are visible but names/times stay stale | `/api/threads` row `name`/`updatedAt`, state DB `title`/`updated_at`, rollout file mtime, fallback merge tests |
| Running-thread indicator disappears | `runningThreadIds`, row `status`, `turn/started` / `turn/completed` notifications, stale browser shell |

## Shared Mux Drift

Evidence of mux drift:

- `%USERPROFILE%\.codex\app-server-mux\endpoint.json` points to one host/port.
- Authenticated `/api/status` shows a different endpoint.
- Desktop and Mobile Web show different live turn streams.

Recovery:

1. Call authenticated `POST /api/app-server/reconnect` when only Mobile Web is stale.
2. If bridge code changed or endpoint process is stale, fully quit Desktop and relaunch once with `start-codex-desktop-shared.ps1 -ForceRestartMux`.
3. Avoid starting an independent managed app-server when shared mode is required; that creates a divergent stream.

## Codex Profile Switch Shows Empty Threads

Profile switching should preserve conversations while changing the active
account. For non-default profiles, `auth.json` and `config.toml` stay local to
that profile, but the windowless launcher links these state paths back to the
default `%USERPROFILE%\.codex` home:

```text
.codex-global-state.json
state_5.sqlite
state_5.sqlite-wal
state_5.sqlite-shm
session_index.jsonl
sessions/
archived_sessions/
```

Checks:

```powershell
Invoke-RestMethod http://127.0.0.1:8787/api/public-config |
  Select-Object -ExpandProperty codexProfiles | ConvertTo-Json -Depth 6
Get-ChildItem "$env:USERPROFILE\.codex-homes\previous" -Force |
  Where-Object { $_.Name -match 'state_5|session_index|codex-global-state|sessions|auth|config' } |
  Select-Object Name,LinkType,Target,Length
```

If the active profile home has its own small `state_5.sqlite` and no linked
`sessions/` junction, restart the shared chain through
`restart-codex-mobile-shared-chain.ps1 -ProfileId <id>`. The startup wrapper
backs up `auth.json` / `config.toml` to
`%USERPROFILE%\.codex-mobile-web\profile-auth-backups` and moves any replaced
profile-local state into `profile-state-backups`; it must not overwrite auth
files.

If `/api/workspaces` still lists the expected workspaces but `/api/threads`
returns only a projectless fallback thread, check the active `state_5.sqlite`
before treating it as a lost-account problem:

```powershell
sqlite3 "$env:USERPROFILE\.codex\state_5.sqlite" "pragma quick_check;"
```

When quick check reports `database disk image is malformed`, current Mobile Web
builds recover the list from live `sessions/rollout-*.jsonl` headers plus
`session_index.jsonl` display names. This is a read-only visibility fallback;
it does not repair the SQLite file and it does not replace account auth files.

If threads are visible but quota chips still show the previous account, compare
the browser with authenticated `/api/status.rateLimits`. The frontend clears
`codexMobileRateLimits` / `codexMobileRateLimitsByModel` when profile switching
starts, then repopulates them from the restarted server's status/config.

If threads are visible after a profile switch but some rows keep UUID-like names
or old timestamps, compare `/api/threads?limit=...` with the active
`state_5.sqlite` row and the rollout file mtime. Current builds merge duplicate
fallback summaries into app-server rows instead of dropping them, and the newest
`updatedAt` wins. Existing-thread message sends also trigger a silent sidebar
list refresh after the current-thread refresh. If this regresses, run:

```powershell
node --test test\thread-visibility.test.js test\thread-title-source.test.js test\new-thread-route.test.js test\mobile-viewport.test.js
```

If a running thread is interactive but the sidebar/home running indicator is
missing, first separate this from the page-refresh prompt. The running indicator
comes from `public/app.js` status hints, not `#pageRefreshPrompt`. Current builds
keep `runningThreadIds` across thread-list refreshes where the row only says
`notLoaded`, and current-thread `turn/started` / `turn/completed` notifications
write back to the matching sidebar row. If this regresses, run:

```powershell
node --test test\conversation-render.test.js test\mobile-viewport.test.js
```

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

On Windows, `rg.exe` may be installed outside the active `PATH`, such as under a user-local bin directory. A stale UI command card can make an already-completed `rg` look running; confirm through rollout output and process state.

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

On Android, a right swipe from the left edge can surface as a browser/system
Back action rather than a normal touch gesture. Current builds use two layers:
the sidebar edge `touchstart` listener is non-passive and widens the Android
start zone, and an Android-only two-entry `popstate` sentinel marks the current
history entry as `base` and pushes a same-URL `top` entry. A top-level Back
event should land on `base`, open the navigation menu, and immediately restore
`top` instead of letting the PWA close to the launcher. If this regresses,
verify `codex-mobile-shell-v175` or newer is loaded and run
`node --test test\mobile-viewport.test.js`.

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

## Archived Thread Reappears In Fallback List

If an archived projectless session returns to the thread list after app-server
omits it from the primary `thread/list`, inspect `readSessionIndexFallback()` in
`server.js`. Current builds should call `archivedSessionThreadIds()` and skip
matching ids after verifying `visibleProjectlessThreadIds()`.

Run:

```powershell
node --test test\thread-archive.test.js test\thread-visibility.test.js
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

Workspace `鎬?鍛?浠奰 totals come from
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

If the full-screen `缁熻` project list shows a garbled Workspace name while
`/api/workspaces` shows the same root correctly, inspect the `cwd` values in the
token usage DB. Current builds normalize known Windows mojibake such as
`系统鹿陇戮脽` back to the visible Unicode Workspace root during record and query, so
old rows should merge into the correct project after the 8787 listener restarts.

## Page Refresh Prompt Appears While Files Are Still Being Edited

`/api/public-config` should report the app-shell build/cache snapshot captured
when the 8787 listener started. It should not change merely because `public/`
files have been edited on disk while the old listener is still running. A normal
`New version available. Tap to refresh.` prompt should appear only after the
listener has restarted into the new build.

Current standalone behavior after `codex-mobile-shell-v170` is intentionally
manual: version checks only show the visible refresh button. They must not
prewarm shell caches, call `window.location.reload()`, or schedule a timed reload
after shared-chain restart. The only normal standalone reload trigger is a user
click on `#pageRefreshPrompt`.

Hermes embed mode is stricter about host refreshes. It may request a Hermes host
iframe refresh when `clientBuildId` / shell cache changes, because the open
iframe is running old frontend code. It must not request a host refresh for a
server-only asset `buildId` change. Foregrounding the plugin or tapping the
Hermes bottom Topic tab can run a build check, and server-only asset drift should
be recorded silently rather than causing a visible old-page-to-new-page iframe
reload.

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
- autonomous workflow target completion creates an automatic reverse-direction
  return card by default. The return card is keyed by original card id plus the
  completed target turn id and should auto-inject into the source thread
  through the same workflow grant. That return card should have
  `delivery.autoReturnOnCompletion=false`; its own completed turn must not
  create another return card. Its title should contain only one `Auto return:`
  prefix even if the original title already had that prefix.

If an autonomous follow-up card does not auto-run, inspect the stored card and
workflow fields in `%USERPROFILE%\.codex-mobile-web\thread-task-cards.json`.
The card should have `workflow.mode="autonomous"` and a non-empty `workflow.id`.
The store should also contain an active workflow with the same id and the same
two thread ids. Reusing the same workflow id for a different thread pair is
intentionally treated as unapproved and will leave the card pending.

If the first autonomous target card runs once but does not return after the
target turn completes, inspect the original card's `injectedTurnId`,
`injectedThreadId`, and `autoReplyCardId`. If `autoReplyCardId` is absent,
confirm that Mobile Web received a fresh `turn/completed` notification for that
`injectedTurnId` and that `server.js` has restarted into a build containing
`maybeAutoReplyThreadTaskCard()`. If `autoReplyCardId` exists, inspect the
return card status, `injectedTurnId`, `workflow.id`, target thread, and
`delivery.autoReturnOnCompletion`; it should be `approved`, target the original
source thread, keep the same workflow id, and have
`autoReturnOnCompletion=false`. If a return card completion creates another
return, or the title grows into `Auto return: Auto return: ...`, restart Mobile
Web into a build containing the terminal-return guard in
`adapters/thread-task-card-service.js`.

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

## `#鑷敱鍗忎綔` Task-card Command Does Not Parse

Only the exact `#鑷敱鍗忎綔` prefix is reserved for cross-thread task-card
commands. Ordinary `#...` text and `# 鑷敱鍗忎綔` with a space after `#` should
enter the normal message-send route.

Current behavior:

- bare `#` is a normal message, not a task-card command;
- `#鑷敱鍗忎綔` commands do not support attachments yet;
- the browser sends a bounded draft request to the current Codex thread;
- the model must return a bounded draft block with one visible
  `targetThreadId`, or an empty target plus an error.

Working examples:

#鑷敱鍗忎綔 鍙戠粰 Finance Review锛氳鏍搁獙 5 鏈堢粨璐︽槧灏?#鑷敱鍗忎綔 璁?Hermes 05-26 閰嶅悎澶勭悊鎻掍欢鍒锋柊鑱斿姩
#鑷敱鍗忎綔 璇疯绾跨▼銆孒ermes 鍙戝竷妫€鏌ャ€嶇‘璁ゆ彃浠堕€氱煡鍥炴墽鏄惁宸插叆搴?If no draft card appears, inspect:

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
- whether attachments were present, which still blocks `#鑷敱鍗忎綔` commands.

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

## Hermes Embed 鍘嬬缉缁帴纭妗嗕笉鍑虹幇

If `鍘嬬缉缁帴` can be selected from the thread action sheet but no confirmation
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

Before the restart request is sent, current browser builds should show an
in-app confirmation panel instead of a native `window.confirm()`. The panel
checks `/api/threads?limit=200&archived=false` and lists running sessions that
may be interrupted. If the panel is missing or does not show running-session
risk, verify that the open client loaded the current `clientBuildId` and run:

```powershell
node --test test\manual-restart-ui.test.js test\mobile-viewport.test.js
```

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

- `/?embed=hermes` shows a stable `姝ｅ湪鍔犺浇 Codex...` loading layer during initial
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
  profile mux and non-auth thread/workspace state links. Desktop GUI login may
  still be global; verify shared state by comparing the selected `CODEX_HOME`,
  endpoint, and linked `sessions`/`state_5.sqlite*` paths.
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

## Codex Profile Switch Hides Workspaces Or Threads

If switching Mobile Web to another Codex profile makes most workspaces or
threads disappear, or if Desktop launched from a profile wrapper cannot see the
expected threads, inspect the shared-state link setup before changing thread
visibility code.

Expected behavior:

- The active profile owns `auth.json` and `config.toml`.
- Non-default profiles link shared thread/workspace state back to the default
  `%USERPROFILE%\.codex` home:
  `.codex-global-state.json`, `state_5.sqlite*`, `session_index.jsonl`,
  `sessions/`, and `archived_sessions/`.
- File state paths should be hard links. Directory state paths should be
  junctions.
- Existing profile-local copies of those state paths should be moved under
  `%USERPROFILE%\.codex-mobile-web\profile-state-backups` before links are
  created.
- Profile-local `auth.json` and `config.toml` should be copied only to
  `%USERPROFILE%\.codex-mobile-web\profile-auth-backups`; they must not be
  replaced by default-account files.

Useful checks on Windows:

```powershell
Get-Item (Join-Path $env:USERPROFILE ".codex-homes\previous\sessions") | Format-List FullName,LinkType,Target
Get-Item (Join-Path $env:USERPROFILE ".codex-homes\previous\state_5.sqlite") | Format-List FullName,LinkType,Target
Test-Path (Join-Path $env:USERPROFILE ".codex-homes\previous\auth.json")
Test-Path (Join-Path $env:USERPROFILE ".codex-homes\previous\config.toml")
```

Harness expectations:

- `test/codex-profile-ui.test.js` should fail if the windowless shared-state
  list starts including `auth.json` or `config.toml`.
- `test/codex-profile-ui.test.js` should also fail if
  `docs/MULTI_ACCOUNT_CODEX_CLI.md` reverts to the old observation that
  `previous` has no `auth.json` or that all state remains isolated per profile.
- `test/manual-restart-ui.test.js` should continue checking that profile
  switches pass explicit `profileId` / `codexHome` restart arguments.

## Page Refresh Does Not Update Quota

The page-refresh prompt and quota refresh are related but not identical. The
prompt is primarily a PWA shell/cache update path; quota chips come from active
`/api/public-config` and `/api/status` snapshots.

Expected behavior after `codex-mobile-shell-v170`:

- No automatic reload should happen after build detection, foreground recovery,
  reconnect, or shared-chain restart. Those paths only show the visible refresh
  button.
- Clicking `New version available. Tap to refresh.` fetches the latest
  `/api/public-config`.
- The browser applies `rateLimits` / `rateLimitsByModel` from that config before
  preparing shell assets, pruning old shell caches, and calling
  `window.location.reload()`.
- Killing and reopening the PWA should no longer be required merely to update
  visible quota after a profile switch or controlled restart.
- If quota is still stale, compare authenticated `/api/status.rateLimits` with
  the composer chips. If `/api/status` is correct but the UI is not, the open
  client is still running an older shell and needs one manual refresh or
  close/reopen once to load v170 or newer.

For account/profile switches, also compare `/api/status.codexHome` with the
active profile in `%USERPROFILE%\.codex-mobile-web\codex-profiles.json`.
Expected behavior after this repair is:

- `server.js` prefers the active profile store over an inherited shell
  `CODEX_HOME`; stale inherited homes are reported as
  `codexHomeEnvIgnored=true`.
- Normal profile-switched listeners should report
  `codexHomeSource=profile-store`.
- `CODEX_HOME` only overrides the profile store when
  `CODEX_MOBILE_CODEX_HOME_OVERRIDE=1` is explicitly set.
- The Windows shared-chain restart script stops the selected port's stale
  `node.exe ... server.js` listener even if it was started as bare
  `node server.js` and therefore lacks an absolute server path in its command
  line.

## Source `#鑷敱鍗忎綔` Task-Card Draft Reappears After Approve Or Dismiss

If the source thread hides a `#鑷敱鍗忎綔`-generated draft card immediately after
`Approve` or `Dismiss`, but the same draft comes back after leaving and
re-entering the thread, the draft-settled state was only held in browser memory.

Expected behavior after `codex-mobile-shell-v129`:

- Draft-card settled states are persisted in browser storage under
  `codexMobileThreadTaskCardDraftStates`.
- Source-thread draft cards with status `created` or `dismissed` stay hidden
  after a thread reload or app re-entry.
- Pending/in-flight draft creation states are not persisted as durable settled
  state.

## Cross-Thread Task Card Does Not Reach Target

If a `#鑷敱鍗忎綔` cross-thread card appears to finish in the source thread but no
pending card appears in the target thread, check the server-side materialization
path before blaming the model response.

Expected behavior after `codex-mobile-shell-v164`:

- The model response may contain a structured
  `<codex-mobile-thread-task-card-draft>` block, but the browser is not the only
  component that can create the stored card.
- On fresh `turn/completed`, the Node listener fetches a bounded recent-turn
  window, parses assistant/plan draft XML, resolves source/target workspaces
  from Codex state, truncates overlong draft bodies to the 8k service limit, and
  calls `threadTaskCardService.createMany()` with a stable idempotency key.
- Thread detail reads run the same materialization before attaching
  `thread.threadTaskCards`, including large-rollout `thread/turns/list` mode.
- A deleted/revoked/replied/approved card stays settled and should not be
  recreated by re-entering the source thread. If the target card was deleted,
  send a new source request instead of expecting the old idempotency key to
  resurrect it.

Useful checks:

```powershell
Invoke-RestMethod http://127.0.0.1:8787/api/public-config |
  Select-Object clientBuildId,shellCacheName
```

Use a UTF-8-safe Node script, not `ConvertFrom-Json`, to inspect
`%USERPROFILE%\.codex-mobile-web\thread-task-cards.json`; historical Chinese
payloads can make PowerShell JSON parsing brittle. Check whether a card exists
for the target thread id and whether its status is still `pending`.

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
