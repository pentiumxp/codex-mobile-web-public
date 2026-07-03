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
| Same submitted user message appears twice while the turn is thinking | Inspect whether one item is a browser `local-user-*` echo and the other is a server `mux-user-*` or durable `userMessage` echo for the same `clientSubmissionId`. Clients after `codex-mobile-shell-v396` merge these at the thread-normalization layer using submission id, deterministic mux id suffix, and content signature. If both duplicates are projection-index `item-*` user messages, compare bounded timestamps too: current servers collapse same-content/same-timestamp projection-index duplicates but keep repeated same-text user messages with different timestamps. Clients after `codex-mobile-shell-v620` also collapse cross-turn same-event user duplicates when a projection/optimistic identity and same text fall inside the same 5-second event window. If duplication remains, compare `/api/threads/:id?mode=recent` against the open shell before adding render-layer filtering. |
| API thread detail has one user message but the browser still shows two | If `/api/threads/:id?mode=recent` has no duplicate user-message text or submission hash but browser self-check reports `browser_latest_turn_user_message_duplicate` or `browser_user_message_event_duplicate`, the failing layer is the client DOM authority path. Clients after `codex-mobile-shell-v589` include same-turn duplicate user-message counts in `conversationDomShape()` / `visibleConversationShape()` and invalidate stable signatures when the DOM contains more duplicate user-message cards than the current projection allows, forcing a full render from the authoritative projection. Clients after `codex-mobile-shell-v620` extend that DOM authority check to cross-turn same-event user-message duplicates. |
| Message is actually sent but the Composer still shows failed/retry | Compare the failed browser `local-user-*` item with durable `userMessage` rows by `clientSubmissionId` and bounded text hash. Clients after `codex-mobile-shell-v602` hide failed optimistic echoes even when the durable matching user message is in an earlier completed turn, provided the bounded timestamps are near each other, and clear `mobileSendError` when merging a durable same-message row. If this regresses, inspect `shouldHideOptimisticUserMessageEcho()`, `optimisticEchoCanMatchEarlierDurable()`, `mergeLikelySameUserMessage()`, and `test/conversation-render.test.js`. |
| Historical user text appears inside or after a final receipt | Compare `/api/threads/:id?mode=recent&budget=full` item order with the browser DOM. Clients after `codex-mobile-shell-v602` stop preserving local-only user rows when an incoming completed turn has an authoritative assistant receipt, so old local residue cannot be inserted between the final receipt and Usage or appended after the completed turn. If this regresses, inspect `thread-detail-state.js` `shouldPreserveLocalOnlyItem()` and the completed projection merge coverage in `test/conversation-render.test.js`. |
| Visible messages are out of order but API order is correct | Inspect `/api/threads/:id?mode=recent&budget=full` item order first. If the API order is correct but the browser keeps an older DOM order after a local visible-item patch, the failing layer is `public/thread-detail-dom-patch.js`. Clients after `codex-mobile-shell-v599` move reused/patched visible item nodes to match the next projection order and validate post-apply `data-render-key` order; focused coverage is in `test/thread-detail-dom-patch.test.js`. |
| Android shell Composer tap/long-press hides keyboard | Clients after `codex-mobile-shell-v584` do not blur an already-focused Android Composer on `pointerdown`. The stale-focus workaround is limited away from the active editing path, and Android recovery may retry focus without `resetActiveFocus` so long-press/caret/selection affordances do not close the IME. If this regresses, inspect `prepareMessageInputForNativeGesture()`, `releaseStaleAndroidMessageInputFocusBeforeNativeTap()`, and the focused Android tests in `test/new-thread-ui.test.js` / `test/mobile-viewport.test.js` before changing the native shell. |
| User message timestamps jump backwards inside one turn | Clients after `codex-mobile-shell-v585` use `mobileDisplayTimestampMs` for projection user messages that lack a direct rollout timestamp and cannot be matched to a rollout candidate. Servers after the v603 response-budget timestamp repair also infer display-only timestamps at the final HTTP detail boundary for retained user/assistant items that still lack own timestamps after projection, budget, task-card, or user-anchor rewriting. This keeps item order and labels stable without overwriting `startedAt*` source fields. If this regresses, inspect `visible_item_timestamp_order_mismatch`, `browser_latest_turn_timestamp_missing`, and focused coverage in `test/thread-detail-response-budget-service.test.js`, `test/thread-item-timestamp-enrichment.test.js`, and `test/thread-detail-self-check-service.test.js` before changing client-side sorting. |
| Thread looks stuck | rollout size/mtime, pending approvals, live command/tool process, latest turn status |
| Old command appears running | latest turn id vs raw operation fallback call id/turn id, app version includes raw-operation fix |
| PWA still shows old UI | `/api/public-config.clientBuildId`, browser shell cache, service worker cache name |
| Refresh prompt repeats after a static bump | Compare `/api/public-config.clientBuildId` and `shellCacheName` with served `/app.js` and `/sw.js`; current builds read shell metadata on each config request and do not use plain `version` for this comparison |
| Push missing | HTTPS/Tailscale access, VAPID files, subscription count, sub-agent suppression |
| Push says turn ended but no final reply appears | rollout `task_complete.last_agent_message`, completion-push no-final-message guard |
| Turn accepts a message then ends with no visible reply | inspect rollout for `task_complete.last_agent_message: null` and no scoped `user_message` / `agent_message`; current detail projection renders a `turnDiagnostic` item with code `runtime_completed_without_response` rather than fabricating an assistant reply |
| First open after completion lacks the latest receipt | `/api/threads/:id?mode=recent` read mode, whether the latest rollout EOF line is a complete `task_complete` JSON object without a trailing newline, and whether enrichment index exposes a provisional entry |
| Same turn shows two final receipts and only one has Usage | Compare `/api/threads/:id?mode=recent` service projection against the open client shell. If the API has one `agentMessage` plus one `turnUsageSummary` but the page shows two receipts, the failure layer is browser V4 local-visible merge; current clients after `codex-mobile-shell-v390` drop local-only live receipts once a completed server turn has an authoritative receipt. |
| Final receipt appears, disappears, then returns one line shorter | Compare the live active receipt text and completed service projection receipt text for the same turn, then inspect `/api/client-events` for `thread_refresh_ms.locallyPatchedDetail`. Clients after `codex-mobile-shell-v391` preserve same-prefix completed receipt identity; clients after `codex-mobile-shell-v392` also keep post-completion refreshes on the local item patch path when only receipt/Usage items change. Clients after `codex-mobile-shell-v609` cancel or ignore automatic post-completion, Usage-backfill, live-poll, and resume refreshes while the user has manually scrolled the current thread away from the bottom; the protection lasts until the user returns to bottom or takes an explicit action. In that protected reading state, use an explicit user action such as returning to bottom or manually refreshing before treating missing later Usage as a projection loss. |
| Bottom Command/status row disappears during a running turn | Check viewport first. Wide clients after `codex-mobile-shell-v394` keep the one-line dock stable during reasoning-only active turns. Phone-width clients after `codex-mobile-shell-v395` intentionally do not reserve a bottom row: pure reasoning is shown only by the top-right timer, and real command/file/tool/search activity appears as a floating operation bubble above the composer with short summary and elapsed time. Clients after `codex-mobile-shell-v402` keep the last same-thread operation bubble visible for at least 500ms even when the operation finishes before the next full thread render, and the expiry refresh updates only the dock instead of rerendering the conversation. Clients after `codex-mobile-shell-v403` keep a small same-thread recall dot after that temporary bubble disappears; tap it to reopen the last operation detail sheet without restoring a permanent bottom row. Clients after `codex-mobile-shell-v404` align that recall dot with the lower-right scroll controls using the same 36px size and right edge. Clients after `codex-mobile-shell-v405` keep those dwell/pinned/recall decisions in `public/live-operation-dock-state.js`; regressions should be tested there before adding render fallbacks. |
| Command row has no detail on macOS | First inspect `/api/threads/:id?mode=recent`: if `commandExecution.command` is empty, the failure layer is server raw-operation projection from rollout `function_call.arguments`; current server code reads `command`/`cmd`/`shellCommand`/`shell_command` from object or JSON-string arguments. If the API has a non-empty command but the dock/bubble is blank, inspect the v394+ frontend `operationCommandText()` path. |
| Continuation fails because source thread cannot reply | continuation job progress `handoff-fallback`, generated `.agent-context/thread-handoffs/*.md` mode, `/api/status` profile/quota |
| Profile switch hides workspaces or threads | active `codexProfiles.activeCodexHome`, non-default profile shared-state links, `/api/threads?limit=10` |
| Quota chips show the previous account after switch | `/api/status.rateLimits`, browser quota localStorage, profile-switch cache clearing, shared `sessions/` quota fallback |
| Archived projectless thread reappears | session-index fallback, `archived_sessions`, `test/thread-archive.test.js` |
| After profile switch only a few workspaces or no threads appear | `/api/public-config.codexProfiles.activeCodexHome`, profile state links, and `state_5.sqlite` / `sessions` under the active home |
| Threads are visible but names/times stay stale | `/api/threads` row `name`/`updatedAt`, state DB `title`/`updated_at`, rollout file mtime, fallback merge tests |
| Large session first open is slow | On clients after `codex-mobile-shell-v495`, inspect `/api/client-events` `thread_detail_first_paint.serverTimings` and `performancePhase`. `warm-projection-cache` points away from rollout rebuild and toward network/DOM render, `warm-projection-partial` means `mode=recent` reused a signed current-window projection, `projection-stale-partial-hit` means first paint intentionally used a stale signed partial window and scheduled a background refresh, `cold-turns-list-initial` means the first recent window was loaded from bounded app-server turns-list and should report `projectionSeedStatus=seeded-partial` when projection input exists, and `cold-thread-read` points at full app-server read/projection seed. If `projectionState=miss`, inspect `projectionMissReason` before changing cache behavior: `entry-missing` means no cache exists, `partial-not-allowed` means a partial window was correctly rejected for a full read, `static-signature-mismatch` / dynamic signature mismatch reasons point at invalid full-cache lifecycle, and `signature-unavailable` points at projection input/stat construction. `dynamic-summary-stale` should require backing evidence such as rollout size/mtime or retained-window/policy change; summary timestamp-only movement is metadata freshness and should not force an app-server `turns/list` read. Thread-list slowness should be checked through `thread_list_rendered.serverTimings` / `performancePhase` and, on v556+ clients, repeated successful slow list loads should also emit `thread_list_slow_path` diagnostics. `mobileInitialSource=warm-fallback-cache` means the first paint used the process fallback cache; `mobileInitialSource=fallback-baseline` with `appServerDeferredReason=cold-fallback-initial` means the first paint still had to build the local baseline but did not wait for app-server `thread/list`; `appServerDeferredReason=warm-fallback-initial` means even that local baseline was already warm. When cold, compare `fallbackStateDbCount`, `fallbackRolloutCount`, `fallbackSessionIndexCount`, `fallbackBaselineSourceCount`, `fallbackBaselineResultCount`, and fallback source timings before changing cache or prewarm behavior. If prewarm is completed but a larger same-scope first-paint request still reports `fallbackCacheDecision=miss-rebuild`, inspect `threadListFallbackPrewarm.sourceSnapshotLimit`, `lastSourceSnapshotLimit`, and request limit before blaming app-server: the final fallback cache is limit-scoped, while the source snapshot should be wide enough to rebuild large first-paint windows without rereading rollout tails. If a deferred/full follow-up is slow, inspect `appServerRequestLimit`, `appServerResponsePayloadBytes`, `appServerRpcMs`, and `appServerUnattributedMs` separately from first-paint fallback work. |
| Light endpoints and thread opens jitter to multi-second after runtime self-check | Check for orphaned headless Chrome self-check processes using a temporary profile named `codex-mobile-browser-self-check-*`, especially if logs still show older `clientBuildId` values after a deploy. Current browser self-check scripts launch Chrome in a cleanup-owned process group and register exit/signal cleanup handlers; if this regresses, inspect `cleanupChromeChild()`, `installChromeCleanupHandlers()`, and the runtime self-check child timeout path before changing thread-detail code. |
| Thread list is slow only after deploy/restart | Inspect `/api/threads` `mobileDiagnostics.threadListTimings.fallbackCachePersistentRestored` and `fallbackCacheDecision`, then `/api/public-config.threadListFallbackPrewarm`. A restored warm cache should show `fallbackCachePersistentRestored=true` on the first default list hit after restart. `threadListFallbackPrewarm.job` should show `periodicAllowed=false`, `maxConcurrency=1`, `timeBudgetMs=30000`, `realBrowserAllowed=false`, and `userRequestPreemptible=true`; if those fields are missing, the prewarm has lost the background-budget contract. If the runtime cache file is missing or corrupt, the server treats it as a cold cache miss and rebuilds from the normal sources; do not classify that as a network timeout unless `appServerRpcTimedOut=true` or the request actually fails. |
| Listener RSS or total Codex-owned process RSS keeps climbing | Run the runtime self-check with the `process-pressure` child enabled and inspect bounded codes such as `production_listener_rss_elevated`, `production_listener_rss_high`, `active_app_server_mux_rss_elevated`, `stale_app_server_mux_pressure`, and `codex_mobile_mcp_child_accumulation`. These are process-memory/lifecycle issues, not Vite static asset failures. For thread-list memory pressure, inspect `mobileDiagnostics.threadListTimings.cacheEntryCount`, `cacheThreadCount`, and `cacheApproxBytes`; the fallback cache should contain summary-safe rows only and must not retain `turns`, item payloads, active-overlay details, diagnostics, or credential-like fields. If coalesced list bursts are involved, check `threadListCoalescedRequest` and `threadListCoalescedWaitMs`; followers should patch diagnostics without deep-cloning the full list payload. |
| Thread list freezes and cannot scroll | On clients after `codex-mobile-shell-v597`, first inspect `/api/client-events` / Home AI diagnostic intake for `thread_list_interaction_stall`, `browser_thread_list_interaction_blocked`, or `browser_main_thread_long_task`. The live client records bounded rAF heartbeat delay, scroll-apply delay, long-task duration/count, scroll position, and thread-list row count when the thread list is visible. Clients after `codex-mobile-shell-v598` also report the same bounded evidence when the list DOM is present on the primary list route but has not yet become visibly intersecting, which covers freezes during list-entry/render-transition before the old visible-only monitor could emit. Runtime self-check loop builds after the client-event stall log integration also read the runtime log tail as a `client-events` child check, so a real-user >=3s `thread_list_runtime_stall` / `thread_list_interaction_stall` row can fail deploy/periodic gates even when the synthetic browser stress run does not reproduce the freeze. Newer server log lines include a bounded `ts` field, and the child check only treats timestamped stalls inside `--client-event-window-ms` (default 30 minutes) as blocking; stale or untimed historical rows are counted in `untimedStallEventCount` / `outOfWindowStallEventCount` without blocking. Also run the browser runtime self-check with thread-list stress enabled. The check reports `browser_thread_list_interaction_blocked` when a single list interaction probe has a blocked rAF/scroll application path, and `browser_main_thread_long_task` when Chrome records a >=1s main-thread long task. Inspect bounded fields such as `maxThreadListRafDelayMs`, `maxThreadListScrollApplyMs`, `maxLongTaskDurationMs`, `threadListCardCount`, `threadListMonitorable`, and the runtime-loop `client-events.sampleSummary`. A stress probe's total elapsed time includes intentional waits between opening the list and clicking thread cards, so do not treat `maxThreadListProbeElapsedMs` alone as a freeze unless the sample is not a stress probe or the per-frame fields are also high. |
| Active large thread still uses full `thread/read` | Inspect `thread_detail_first_paint.serverTimings.activeFullReadRequired`, `activeFullReadReason`, `activeOverlayAction`, and `activeOverlayReason`. `overlay-provider-unavailable` means the safe orchestration seam is present but no authoritative provider is wired yet. Other `require-full-read` reasons such as `assistant-delta-unknown`, `receipt-evidence-unknown`, `active-turn-mismatch`, or `non-authoritative-overlay-source` are intentional fail-closed outcomes and should not be bypassed with a client refresh or UI dedupe layer. |
| Running-thread indicator disappears | `/api/threads` row `status` and `rolloutSizeUpdatedAtMs`, rollout tail `task_started` / `task_complete`, `runningThreadIds`, stale browser shell |
| Thread list/detail returns `http_500` and server logs `Maximum call stack size exceeded` | Inspect the thread-list server boundary before blaming PWA cache. A recursion path between thread-list summary merge, thread-detail bridge, and stale-context active normalization can make `/api/threads` fail and eventually surface as browser `fetch failed`. Current builds force boundary-owned list merges to skip re-entering stale-context normalization; if this regresses, check `services/thread-list/thread-list-server-boundary-service.js`, `services/thread-list/thread-summary-state-service.js`, and `test/thread-list-service-boundary.test.js`. |
| Thread detail shakes during streaming output | Client shell version v317+, `/api/client-events` `conversation_render_ms`, `thread_refresh_ms.skippedDetailRender`, `thread_refresh_ms.locallyPatchedDetail`, compact Command dock height, stale PWA shell |
| Thread detail reopens and temporarily loses already-visible messages | First run API self-check, then browser-runtime self-check. If `/api/threads/:id?mode=recent` is stable but Chrome samples report `browser_dom_sparse_after_nonempty`, the failing layer is client first-paint/DOM state rather than server projection. |
| Entering an active thread first shows an old receipt, then updates seconds later | Check whether the first paint came from `cached-current` / loaded detail cache while the thread still has active evidence. Clients after `codex-mobile-shell-v599` no longer treat active/running loaded detail as reusable completed-state cache. Clients after `codex-mobile-shell-v600` use an active loading preview instead of an empty shell: completed history and current user input stay visible, stale active assistant/plan/Usage/operation progress is stripped, and the fresh detail read replaces the preview. Clients after `codex-mobile-shell-v604` also drop active-preview local/failed user echoes when an earlier durable user message already matches by submission id or bounded text, so a stale preview cannot show the same user message again after the previous final receipt. Inspect `activeDetailLoadingPreviewThread()`, `planThreadOpenCacheReuse()`, and `test/thread-detail-state.test.js`. |
| Runtime gate reports browser timestamp gaps during active streaming | Check whether the missing timestamp kind is only `agentMessage` / `plan` on an incomplete active turn, or whether the sample also shows newer DOM assistant progress than the API plan plus a smaller budgeted visible item count. Newer browser self-checks keep those active assistant/plan timestamp gaps advisory because they are in-flight sampling races; missing user/task-card/diagnostic timestamps and completed/resting `browser_latest_turn_timestamp_missing` or `browser_turn_timestamp_missing` remain H2 and should be repaired in the renderer/projection timestamp contract. |
| Listener/app-server update interrupts a running turn | Browser shell `codex-mobile-shell-v280+`, `/api/status.ready` recovery, bounded `auto_turn_recovery_result` client event, `/api/threads/:id/auto-recover` route |
| macOS shows frequent `重连` or refresh prompts | 8787 listener PID, loopback and LAN `/api/public-config`, `/api/events` keepalive, `mobile-web.log` `EADDRINUSE`, stale `launchctl submit` labels |
| Hermes host says plugin workspace access key file is missing | Host `com.hermesmobile.listener` env `HERMES_MOBILE_CODEX_PLUGIN_ACCESS_KEY_PATH`, readable key file under Hermes secrets, plugin manifest `tokenStatus` |
| macOS shows `spawn codex ENOENT` | LaunchAgent/wrapper `PATH`, absolute `CODEX_MOBILE_CODEX_EXE`, `command -v codex` in login vs non-login shell |
| macOS app-server reports SQLx migration modified | `pragma quick_check`, `_sqlx_migrations` checksums in `state_5.sqlite`, `logs_2.sqlite`, `memories_1.sqlite`, and `goals_1.sqlite`; compare against a temporary same-CLI `CODEX_HOME` before repair |

## macOS Production Startup

LaunchAgent and other non-interactive macOS processes do not inherit the login
shell PATH. If Mobile Web can serve `/api/public-config` but shows
`failed to start codex app-server (spawn codex ENOENT)`, set absolute paths in
the plist or wrapper:

```bash
CODEX_MOBILE_CODEX_EXE="$HOME/.local/bin/codex"
CODEX_MOBILE_NODE_EXE="$HOME/HermesMobile/runtime/node-current/bin/node"
PATH="$HOME/.local/bin:$HOME/HermesMobile/runtime/node-current/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
```

For the Mac Hermes plugin production deployment, use the checked deployment
harness instead of one-off SSH copy commands. The harness deploys a clean public
git archive, rejects private/runtime paths, runs staging syntax checks before
touching production, backs up the active target, runs target checks before
restart, then verifies `/api/public-config` and `/api/status` without printing
key material:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\deploy-macos-plugin.ps1 `
  -HostAlias <mac-ssh-alias> `
  -PublicRepoPath <local-public-repo-path> `
  -SudoPasswordFile <local-sudo-password-file>
```

If the harness fails during staging checks, production has not been backed up,
copied, or restarted yet. If it fails during target checks, the active target
has already been synced but the LaunchDaemon has not been restarted; inspect the
bounded failure, repair, and rerun the harness instead of manually patching the
production directory.

If the Hermes Mobile host can load its shell but the Codex Mobile plugin card or iframe reports `Plugin workspace access key file was not found for this workspace`, separate the host listener from the Codex plugin listener. On the Mac production deployment, `com.hermesmobile.listener` runs as `hermes-host`, while `com.hermesmobile.plugin.codex-mobile` reads the Codex Mobile key from the `xuxin` runtime. The host process must have its own readable key-file path:

```bash
launchctl print system/com.hermesmobile.listener | grep HERMES_MOBILE_CODEX_PLUGIN_ACCESS_KEY_PATH
ls -l /Users/hermes-host/HermesMobile/data/secrets/codex-mobile-access-key.secret
```

The key file should be a secret copy owned by `hermes-host` with mode `600`, and the LaunchDaemon plist should set `HERMES_MOBILE_CODEX_PLUGIN_ACCESS_KEY_PATH` to that path. After changing the plist, use `bootout` plus `bootstrap`; `kickstart` alone does not reload edited LaunchDaemon environment variables. Validate without printing keys by checking `GET /api/hermes-plugins/codex-mobile/manifest?workspaceId=owner` through Hermes host auth and confirming `available=true` and `tokenStatus=launch_token_issued`. The Hermes host auth header is `x-hermes-web-key`, backed by `HERMES_WEB_AUTH_KEY_PATH`; do not use the Codex plugin access key as the host API auth key.

If the iOS client frequently shows the top-right `重连` activity chip or a
refresh prompt, first verify that only one macOS service owns the browser port.
Repeated `EADDRINUSE 127.0.0.1:8787` in `~/.codex-mobile-web/logs/mobile-web.log`
usually means an old `launchctl submit` keepalive job is repeatedly trying to
start another `server.js` on the same port:

```bash
launchctl list | grep codex-mobile
lsof -nP -iTCP:8787 -sTCP:LISTEN
grep -c EADDRINUSE "$HOME/.codex-mobile-web/logs/mobile-web.log"
```

If the 8787 listener is absent because the system LaunchDaemon is not loaded,
the host can recover without depending on the Web UI:

```bash
cd /Users/hermes-host/HermesMobile/plugins/codex-mobile-web
./restart-codex-mobile-host-macos.sh --list-homes --json
./restart-codex-mobile-host-macos.sh --profile-id previous --json
./restart-codex-mobile-host-macos.sh --profile-id default --default-shell-mode vite-app-preview --json
```

The script reads the target user and runtime paths from
`/Library/LaunchDaemons/com.hermesmobile.plugin.codex-mobile.plist`, updates the
active Codex profile store plus the plist `CODEX_HOME`, optional
`CODEX_MOBILE_DEFAULT_SHELL`, bootstraps
`system/com.hermesmobile.plugin.codex-mobile`, and waits for
`/api/public-config`. For production Vite default-root cutovers, prefer
`--default-shell-mode vite-app-preview` on this host script rather than the
in-process `/api/restart/shared-chain` route, because the host script runs
outside the managed listener and verifies both public config and launchd
environment after `bootout` / `bootstrap`. It must not print access keys or raw
auth tokens. Use `--codex-home <path>` only when the host has selected an
explicit configured home path outside the normal profile ids.

If a Vite default-root cutover reaches `defaultShellMode=vite-app-preview` and
the browser gate reports `vite_app_preview_loader_failed` with the app already
visible, ESM compatibility ready, loader-zero counts clean, and no failed
classic scripts, treat it as a loader/app-start contract issue before assuming
static asset corruption. `frontend/vite-shell-entry.mjs` owns the split:
loader readiness covers Vite resources and the classic-loader plan, while app
startup is reported separately through
`__CODEX_MOBILE_VITE_APP_PREVIEW_APP_START_PROMISE__`. Real app-start failures
should surface as `vite_app_preview_app_start_failed` or
`vite_app_preview_app_start_recovery_error`; slow thread bootstrap by itself
should not be counted as a Vite loader failure.

If the phone shows the boot recovery card with "页面脚本启动失败" but production
browser gates pass, check whether the page shell is old enough to treat every
captured `window.error` as a fatal startup script failure. Current app-preview
shells only schedule the recovery card for real script/module errors or
unhandled rejections, and give the main shell a short chance to become visible
before showing the card. Non-script resource errors should not force the
recovery UI.

Also check stale Vite chunk availability before treating this as a runtime
logic failure. iOS PWA scenes and embedded iframes can keep an older HTML shell
after a deploy; if that shell references an older hashed
`/vite-shell/assets/vite-shell-entry-*.js` that was deleted from production,
WebKit reports a startup script failure before normal client telemetry can run.
The durable fix is the stable app-preview entry:
`/vite-shell/app-preview-entry.js`. Current preview HTML points at that stable
entry, and the static file service maps missing old
`/vite-shell/assets/vite-shell-entry-*.js` requests to the stable entry instead
of returning 404. The boot shell also performs one session-scoped cache-busted
reload on a Vite script startup error before showing the manual recovery card.

`scripts/publish-vite-shell-artifact.mjs` still preserves existing
`public/vite-shell/assets/*` files as a transition compatibility window while
replacing the current HTML/readback/manifest files. That retention is not the
release boundary and is not expected to cover every historical PWA version
forever; it only protects already-open scenes during the move to the stable
entry contract. Do not add deployment cleanup that deletes old Vite asset chunks
unless the stable-entry fallback and script-error auto-reload gates are still
green.

If the phone shows the boot recovery card with "页面启动时间过长" during a Vite
app-preview cold iframe/PWA launch, check the Vite app-preview status object
before treating it as a failed boot. Current shells start the timeout at 12s
for app-preview, continue polling while
`__CODEX_MOBILE_VITE_APP_PREVIEW__.appStartPending` or an unfinished loader is
observable, and keep a 30s hard cap so real blank starts still surface the
recovery card. `script-error` remains a fast failure path; do not suppress real
`appStartErrorCode` or loader `failed[]` evidence.

Also compare the listener bind address with the plugin base URL advertised to
Hermes. If `CODEX_MOBILE_HERMES_PLUGIN_BASE_URL` is a LAN URL such as
`http://192.168.x.x:8787`, the listener must bind to `0.0.0.0` or that LAN
address. A loopback-only listener can make local `127.0.0.1` probes pass while
Hermes host proxy calls to the advertised LAN URL fail, which appears in the
iframe as reconnect and can trigger host-driven refresh recovery:

```bash
curl -fsS http://127.0.0.1:8787/api/public-config >/dev/null
curl -fsS http://<mac-lan-ip>:8787/api/public-config >/dev/null
```

For HTTPS reverse-proxy deployments, validate the currently configured public
entry URL instead of an older host URL unless the deployment config was changed.
Validate the actual plugin path by checking the active external origin:

```bash
curl -k -fsS https://new-hermes.example.com/api/public-config >/dev/null
curl -k -fsS https://new-hermes.example.com/api/hermes-plugins/codex-mobile/manifest?workspaceId=owner >/dev/null
```

Authenticated SSE probes should receive one `data:` status event and one
`: keepalive` within about 32 seconds. If the SSE stream fails but ordinary JSON
routes such as proxied `/api/status` still work, current embed clients fall back
to bounded polling and retry EventSource with backoff instead of repeatedly
showing the reconnect/refresh prompt. The thread list should keep its current DOM
while this fallback is healthy; a visible `Connected -> Reconnecting -> Connected`
cycle on the plugin thread list means the loaded shell is stale or the JSON
fallback is also failing.

The current restart service removes same-prefix submitted jobs before restarting
a LaunchAgent/LaunchDaemon-managed listener and no longer creates new
`launchctl submit` jobs. For a system LaunchDaemon, the helper avoids
user-level `launchctl kickstart system/...`, kills only the current listener,
and relies on KeepAlive to start the replacement. If an older submitted job
remains, remove only that stale label from the current GUI domain, then confirm
the `EADDRINUSE` count stops growing and `/api/events` produces a status plus
keepalive:

```bash
launchctl bootout "gui/$(id -u)/<stale-submitted-label>"
curl --max-time 32 -N http://127.0.0.1:8787/api/events
```

If `codex app-server` then fails with `migration 1 was previously applied but
has been modified`, do not replace the Codex home. First run
`pragma quick_check` on the affected SQLite files and create a temporary empty
`CODEX_HOME` with the same Codex CLI to read the expected `_sqlx_migrations`
checksums. Only when schema objects match should a backed-up repair update the
checksum rows. Check at least:

```text
state_5.sqlite
logs_2.sqlite
memories_1.sqlite
goals_1.sqlite
```

For migrated Windows production state on macOS, the visible workspace roots may
be Mac paths while historical thread cwd values are Windows paths. Current
Mobile Web keeps non-archived fallback threads visible in All workspaces when
none of the returned rows match the visible workspace set; it still hides
archived and sub-agent rows. If this regresses, run:

```powershell
node --test test\thread-visibility.test.js
```

If a workspace-delegation continuation can `stat` a target workspace and create
then read back a new temporary file under that root, but `readdir`, existing
source file opens, `git status`, or `apply_patch` fail with `EPERM` /
`Operation not permitted`, inspect the managed permission profile. It must grant
both read and write access to the target workspace root and its `.git`
metadata. Also check inherited `workspaceWrite.writableRoots`: a later turn that
inherits only `<workspace>/.git` must be normalized back to include the
workspace root before `.git`, otherwise the thread can enter the cwd but cannot
read existing source files. Already-running turns keep the sandbox they were
started with, so a fixed listener still requires a new continuation for the
affected workspace.

## Shared Mux Drift

Evidence of mux drift:

- `%USERPROFILE%\.codex\app-server-mux\endpoint.json` points to one host/port.
- Authenticated `/api/status` shows a different endpoint.
- Desktop and Mobile Web show different live turn streams.

Recovery:

1. Call authenticated `POST /api/app-server/reconnect` when only Mobile Web is stale.
2. If bridge code changed or endpoint process is version-stale, use authenticated `POST /api/restart/shared-chain` from a build that includes selected mux cleanup. On macOS that path reads only the selected profile endpoint file, stops the recorded mux/app-server PIDs when their command lines match `codex-app-server-mux` or `codex app-server`, removes that selected endpoint file, and restarts the listener. It must not scan or stop unrelated profile muxes.
3. If Desktop owns the selected mux and the authenticated restart path cannot refresh it, fully quit Desktop and relaunch once with `start-codex-desktop-shared.ps1 -ForceRestartMux` or the macOS shared Desktop launcher equivalent.
4. Avoid starting an independent managed app-server when shared mode is required; that creates a divergent stream.

## Continuation When Source Thread Cannot Reply

Normal continuation first asks the source thread to write a concise handoff
file, then starts a new thread with a small bootstrap index. If the source
thread cannot be resumed, cannot start the handoff turn, completes without
writing the file, or times out, Mobile Web now writes a bounded server fallback
handoff under `.agent-context/thread-handoffs/`.

The fallback handoff is not a model-authored source-thread summary. It contains
source thread metadata, recent visible turn summaries, workspace context
references, and a bounded reason. The new thread must re-check
`.agent-context/PROJECT_CONTEXT.md`, `.agent-context/HANDOFF.md`, the smallest
relevant docs, `/api/status`, active profile, and quota before making changes.
Use continuation progress step `handoff-fallback` and the bootstrap handoff
mode line to distinguish this recovery path from a normal source-generated
handoff.

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

If thread visibility works after a profile switch but quota looks identical
across different accounts, check whether the non-default profile's `sessions/`
or `archived_sessions/` is linked to the default `.codex` home. Current builds
must not hydrate quota from those shared rollout files. They must also ignore
source-less live `account/rateLimits/updated` snapshots for shared-profile
homes, because those notifications do not prove which account produced the
quota. A shared-profile active home may still show live quota when the snapshot
comes from the same listener's managed child app-server or from the active
profile home's mux endpoint; that snapshot may be read immediately through
`account/rateLimits/read` after initialize or later via
`account/rateLimits/updated`, but it should not be written as reusable profile
quota. When no account-scoped or trusted live quota is available, authenticated
`/api/status.rateLimits` should be absent and the browser should clear its old
local quota cache instead of showing a previous-account value.

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

If threads are visible after a profile switch or state DB recovery but some rows
keep UUID-like names or old timestamps, compare `/api/threads?limit=...` with the
active `state_5.sqlite` row, `%CODEX_HOME%\session_index.jsonl`, and the rollout
file mtime. A recovered SQLite file can pass `pragma quick_check` while still
missing recent `threads` rows or titles that only exist in rollout files and the
Mobile session index. Current builds merge rollout/session-index summaries even
when app-server and `state_5.sqlite` are readable, sort the merged list before
applying the requested limit, and use `session_index.jsonl` to replace empty or
thread-id-like titles. It also replaces continuation bootstrap messages such as
`# Continuation Bootstrap Index` when app-server accidentally exposes them as
the thread title. Rollout fallback also carries `session_meta` agent metadata
into the list filter, and final list merge drops completed/non-live Mobile
fallback summaries that still have only a UUID after session-index hydration.
Those UUID-only rows are treated as orphan child-agent or unusable recovered
sessions rather than user-openable main threads. Archived ids from `archived_sessions`, profile
`archived_sessions`, `%USERPROFILE%\.codex-mobile-web\archived-thread-ids.json`,
DB archive flags, and backup rollout paths remain hidden. Existing-thread
message sends also trigger a silent sidebar list refresh after the current-thread refresh. If this
regresses, run:

```powershell
node --test test\thread-visibility.test.js test\thread-title-source.test.js test\new-thread-route.test.js test\mobile-viewport.test.js
```

If a running thread is interactive but the sidebar/home running indicator is
missing, first separate this from the page-refresh prompt. The running indicator
comes from thread row `status` plus `public/app.js` status hints, not
`#pageRefreshPrompt`. Current server builds infer rollout-session fallback
`active` / `completed` status from bounded rollout-tail event types and use
rollout file mtime as a fallback `updatedAt` source. This lets a Hermes/remote
client show or clear the spinner even when app-server only returns `notLoaded`.
The browser still keeps `runningThreadIds` across thread-list refreshes where
the row only says `notLoaded`, and current-thread `turn/started` /
`turn/completed` notifications write back to the matching sidebar row. Derived
background `thread/status/changed` notifications created from
`turn/completed` must include the completion `eventAtMs` when available; if the
server emits a terminal status without a fresh event time, the browser's
replay-aware freshness policy may keep the local running hint and make the
outer thread list look like it is still refreshing after the detail page has
ended. For
background work started by normal sends, source-direct or automatic task cards,
auto-recover, side-chat apply, continuation handoff/bootstrap, or ChatGPT Pro
bridge starts, the server must broadcast `thread/status/changed active`
immediately after its local `turn/start` call succeeds and record the bounded
server-side active overlay used by `/api/threads` and `/api/threads/:id`.
Otherwise an immediate state-db/app-server summary refresh can report `idle` and
erase the running marker even though the turn already started. The overlay
clears when `turn/completed` arrives, when the rollout tail has a later
terminal event such as `task_complete`, or when its TTL expires. The server also
derives the same lightweight event from raw `turn/started` / `turn/completed`
notifications and incrementally updates the matching thread-list fallback cache
row. If both the local
overlay and the derived event are missing, the running spinner may appear only
after a later full list refresh. Those hints also carry
`codexMobileRunningThreadHintedAtById` timestamps; if a row stays
`notLoaded` without a terminal status and the current thread has no active turn,
the hint expires after the stale window so completed work does not keep a
permanent spinner.

For active/running large threads, `/api/threads/:id` can avoid full
`thread/read` only when the server-owned live projection has a complete active
overlay proof. The provider reads only the projection service's in-memory
notification snapshot and returns a cloned active turn plus bounded counts and
v4 revision metadata. If `mobileDiagnostics.threadDetailTimings` reports
`activeOverlayAction=require-full-read`, inspect `activeOverlayReason` first:
`entry-missing`, `active-turn-missing`, `assistant-delta-unknown`, stale
assistant evidence, unknown item kind, or missing receipt/operation/upload
coverage all mean the request intentionally failed closed to full `thread/read`
instead of rendering an unsafe partial live window.
If the reason is `latest-completed-input-missing`, inspect the receipt-only
active window before changing the browser renderer. The latest completed replay
must retain a user-visible input anchor (`userMessage` or `contextCompaction`)
next to the final assistant/Usage rows; otherwise the active-window projection
is correctly treated as an unsafe downgrade and the request falls back to a
slow full read.
Current orchestration first invalidates that unsafe cached active window and
rebuilds a bounded `turns-list-active-overlay-window`; only if the rebuilt
window still lacks the input anchor should it try full projection or full
`thread/read`.

If an active large thread spins for a long time but eventually renders, inspect
`mobileDiagnostics.threadDetailTimings.activeOverlayWindowMs`. A high first
sample followed by `activeOverlayWindowMs=0` on repeated reads means the detail
request had to synchronously build the `turns-list-active-overlay-window`
projection window from app-server `thread/turns/list`; it is different from an
RPC/network timeout because the request succeeds and then warms the cache.
The server schedules the same window build in the background after active
turn/status notifications and thread-list refreshes through
`services/thread-detail/thread-detail-active-window-prewarm-service.js`, so the preferred closure is to
verify prewarm scheduling and cache reuse rather than increasing the detail
timeout or adding a client loading fallback. Current servers also coalesce
foreground detail and background prewarm reads for the same thread/mode/limit
through `thread-detail-turns-list-read-coalescer-service`. This covers
`turns-list-active-overlay-window`, ordinary cold `turns-list-initial`, and
large-session `turns-list-large` no-warning windows. If logs show
`turns_list_coalesced`, duplicate app-server work has been suppressed and the
remaining wait belongs to the single authoritative app-server window read or
earlier prewarm/projection readiness. After
restart, the thread-list fallback prewarm should also schedule active-window
prewarm for active rows when it completes; if the first active detail open is
still cold after the fallback baseline has completed, inspect whether
`thread-list-prewarm:completed` produced an active-window prewarm result before
the detail request arrived. Startup fallback prewarm defaults to zero delay
after listener start; if a detail request is already in flight, it should
defer through `active-detail-in-flight` and retry instead of competing with the
foreground detail request. Current active-window prewarm status and results
should also expose a `job` object with
`name=thread-detail-active-window-prewarm`, `periodicAllowed=false`,
`maxConcurrency=1`, `timeBudgetMs=30000`, `cpuBudgetClass=medium`,
`realBrowserAllowed=false`, and `userRequestPreemptible=true`; missing job
metadata means the background task is not yet inside the scheduler-budget
contract.
If bounded logs show `active_window_prewarm_done` with
`reason=projection-input-unavailable` mostly from
`thread-list:warm_fallback_*`, the active fallback row likely lacks rollout
path/stat evidence even though it proves active status. Current prewarm builds
refresh the canonical thread summary once and retry projection input before
skipping; if that still fails, inspect summary rollout path/stat availability
rather than adding another foreground detail fallback.
`turn/started`, `turn/completed`, and active `thread/status/changed`
notification-triggered prewarm should fast-start with zero delay and bypass the
ordinary recent-attempt throttle, because the client can refetch the thread
detail immediately after receiving the same notification. Thread-list batch
prewarm still uses the normal delay/min-interval guard, but notification jobs
can preempt older pending ordinary prewarm so completion-boundary repairs are
not hidden behind an obsolete pending task. If a first detail open still wins
the race and pays `activeOverlayWindowMs`, compare the notification timestamp
to the `active_window_prewarm_*` bounded log event before changing
active-overlay proof policy.
If the active thread has a stale full projection whose stable identity still
matches, current servers can downgrade that full cache to a history-only
`turns-list-active-overlay-window` by omitting the currently growing active
turn. Ordinary detail lookups still reject the same signature mismatch. If a
post-restart or active-growth sample still spends seconds in app-server
`turns-list-active-overlay-window`, confirm whether the projection cache was
missing entirely, the stable identity changed, or the lookup lacked
`activeOverlay=true` plus `omitActiveTurnId`; those cases remain authoritative
app-server reads rather than client timeouts.
Background prewarm `active-window-already-cached` is a weak cache-existence
signal: it proves a projection-window lookup can return history rows, not that
the foreground active-summary proof path has already accepted the same window.
The foreground detail path should now retry the dedicated
`activeOverlayProjectionWindowLookup` with `activeOverlayStatusProven=true` and
`omitActiveTurnId=<active turn>` after an initial active-window miss. When that
history-only retry succeeds and the live overlay evidence is already complete,
foreground detail should merge the overlay directly and should not pay a fresh
`turns-list-active-overlay-window` backfill read.
If logs show a foreground detail request coalescing with background prewarm
immediately after restart or after a new active turn starts, verify whether a
persisted full projection existed before the active notification. Current
servers should restore that full projection before applying `turn/started` /
active item notifications, preserving a history baseline and avoiding a
foreground `turns-list-active-overlay-window` rebuild when the full cache is
available and matches the stable thread identity.
Current builds also expose
`mobileDiagnostics.threadDetailTimings.activeOverlayWindowFirst`. When this is
`true`, the active detail orchestrator used the dedicated active-overlay
projection-window lookup before ordinary projection lookup, avoiding a duplicate
normal projection normalize/assemble pass. If active detail latency is high
while `activeOverlayWindowFirst=true`, inspect `activeOverlayProjectionLookupMs`,
`activeOverlayMergeMs`, and `prepareResponseMs`; if it is `false`, first verify
whether the server route has injected the dedicated
`activeOverlayProjectionWindowLookup` hot path before changing projection-cache
policy.

If `activeOverlayWindowMs`, `threadReadMs`, and `turnsListMs` are already zero
or near-zero but the user still sees a long wait before content appears, inspect
the response shape rather than the network timeout. `mobileDetailResponseBudget`
version `thread-detail-response-budget-v2` should report whether
`agentMessage`/`plan` progress rows were removed through
`omittedAssistantItems`, and whether contradictory empty live shells were pruned
through `prunedEmptyActivePlaceholderTurns`. A high assistant-progress count
with a large response body points at server detail payload size or browser DOM
merge pressure; do not fix that by repeated client refreshes or by loosening the
timeout. The default detail response keeps completed turns receipt-only and
active turns on a bounded recent assistant tail. When a thread has a known
current active turn id, only that matching turn should use the active budget; if
`mobileDetailResponseBudget.staleActiveTurnCount` is non-zero, older
active-looking turns were deliberately downgraded for response shaping. If the
last returned turn is `inProgress`, has zero items, and does not match
`activeTurnId`, it should be removed by response budgeting so browser bottom
anchoring cannot land below the real latest content. When
`progressiveActiveBudgetApplied=true`, compare
`progressiveActiveBudgetReason`, `activeProgressiveItemThreshold`,
`activeProgressiveByteThreshold`,
`activeProgressiveThreadByteThreshold`,
`progressiveActiveUserTextChars`, `truncatedActiveUserMessageItems`,
`omittedActiveUserInputChars`,
`progressiveActiveTextChars`, `truncatedActiveTextItems`,
`omittedActiveTextChars`,
`progressiveActiveOperationPayloadChars`,
`truncatedActiveOperationPayloadItems`,
`omittedActiveOperationPayloadChars`,
`progressiveActiveTurnOriginalBytes`, `progressiveActiveOriginalBytes`,
`configuredActive*Items`, and the effective `active*Items` fields before
changing visible-item policy. Affected operation rows expose
`mobileOperationPayloadBudget.fields`; that set can include command output,
operation display text such as collab-agent task/prompt text, file-change
`changes`, tool arguments/results/content items, and bounded
action/request/response payloads. Affected active user-message rows expose
`mobileUserInputBudget` / `mobileUserInputTruncated` when task-card/bootstrap
text or inline `data:image` input parts are reduced for first paint; this should
happen only under progressive active pressure and does not mutate the persisted
rollout. The same bounded budget evidence appears in Phase-B readback smoke
under `detail.responseBudget*` and
`decision.evidence.detailResponseBudget*`, so operators can diagnose active
payload pressure without inspecting private thread bodies. Current servers also
expose
`progressiveVisibleItemCeiling`, `progressiveVisibleItemBudgetApplied`,
`progressiveVisibleItemOriginalCount`, `progressiveVisibleItemRetainedCount`,
`omittedVisibleItems`, and per-turn `mobileVisibleItemBudget` when progressive
active pressure still leaves too many first-paint visible items after per-type
compaction. That ceiling should remove older operation/reasoning rows first;
user messages, images, Usage rows, diagnostics, and retained final receipts
should stay visible. Reasons ending in `-byte-pressure` mean the request was
successful but too large, not that the network or app-server RPC timed out.
On server builds after the active first-paint item-budget module, inspect
`progressiveActiveFirstPaintThreadByteCeiling`,
`progressiveActiveFirstPaintBytesBeforeItemBudget`,
`progressiveActiveFirstPaintBytesAfterItemBudget`,
`progressiveActiveFirstPaintItemBudgetApplied`,
`progressiveActiveFirstPaintItemBudgetReason`, and
`progressiveActiveFirstPaintOmittedVisibleItems` when an active thread is still
slow after ordinary progressive compaction. This second pass is byte-driven:
it can remove more low-value operation/reasoning visible items, but it must not
remove user messages, assistant receipts/progress, Usage rows, images, or
diagnostic rows just to hit the byte ceiling. A reason of
`protected-visible-items` means the remaining payload is protected visible
content and should be handled by a more specific content-budget rule, not by
client refresh retries. Newer server builds also report
`progressiveActiveFirstPaintOverCeilingBytes`,
`retainedVisibleItemCountByKind`, `retainedVisibleItemBytesByKind`,
`retainedVisibleItemLargestKind`, and `retainedVisibleItemLargestBytes` in
`mobileDetailResponseBudget` and Phase-B readback. Use those bounded counters
to decide whether the remaining protected payload is dominated by operation,
assistant, user-message, Usage, media, diagnostic, or other item shapes before
adding a new budget rule.
Normal `/api/threads/:id` UI detail reads default to compact
`mobileDetailResponseBudget` evidence to avoid spending first-paint bytes on
zero/empty diagnostic fields. If an operator or self-check needs the full
budget contract, request the same detail endpoint with `budget=full`; the
Phase-B, browser-runtime, and API thread self-check scripts do this explicitly.
Do not classify missing long-tail budget fields from a compact response as a
budget-policy regression until the same read has been repeated with full
budget evidence.
If the retained visible item budget is already bounded but the total detail
JSON remains over the active first-paint byte ceiling, inspect the task-card
budget fields next:
`progressiveThreadTaskCardBudgetApplied`,
`progressiveThreadTaskCardBudgetReason`,
`progressiveThreadTaskCardOriginalCount`,
`progressiveThreadTaskCardCompactedCount`,
`progressiveThreadTaskCardActionableCount`,
`progressiveThreadTaskCardSettledCompactedCount`,
`progressiveThreadTaskCardOriginalBytes`,
`progressiveThreadTaskCardRetainedBytes`,
`progressiveThreadTaskCardOmittedBytes`,
`progressiveThreadTaskCardBytesBeforeBudget`,
`progressiveThreadTaskCardIneligibleCount`,
`progressiveThreadTaskCardBytesAfterBudget`, and
`progressiveActiveFirstPaintBytesAfterTaskCardBudget`. This pass compacts
task-card metadata to an action-safe first-paint shape. Pending/actionable
cards keep their action booleans and minimal workflow/source/target/message
fields needed by the renderer, while full card details remain available through
`GET /api/thread-task-cards/:id?threadId=<thread-id>` when a card is opened.
Settled non-actionable cards can be reduced further to id/status/thread-role
placeholders with `mobileTaskCardSettledCompacted`; use
`progressiveThreadTaskCardSettledCompactedCount` to confirm that this
placeholder path is active.
When `assistant` is the dominant retained kind, inspect
`retainedAssistantItemCountByTurnState` and
`retainedAssistantItemBytesByTurnState`, then inspect the metadata-only
`retainedAssistantItemBytesByShape` buckets before changing assistant budgets.
`active` bytes belong to the current live assistant/plan progress and should
not be reduced with the same rule as historical replay. `completed` bytes point
at retained completed/replay assistant rows and are the candidate for a
separate completed-replay first-paint policy. `staleActive` indicates an
ordering/state repair target, not a generic content budget.
If active first-paint byte pressure is dominated by completed `userMessage`
items, newer servers can preview only historical/completed user input through
`mobileFirstPaintUserInputBudget`; the active/current user input remains outside
that completed-user budget. Inspect
`progressiveCompletedUserTextChars`,
`progressiveCompletedUserInputBudgetApplied`,
`progressiveCompletedUserInputBudgetReason`,
`progressiveCompletedUserInputBytesBeforeBudget`,
`progressiveCompletedUserInputBytesAfterBudget`,
`truncatedCompletedUserInputItems`, and
`omittedCompletedUserInputChars`. Newer builds also report
`progressiveCompletedUserInputBudgetMode=shared-newest-first`: the completed
user-input preview budget is shared across retained historical user inputs and
is assigned from newer completed inputs toward older ones. The active/current
user input remains outside this completed-user budget. When the shared budget
is exhausted, older completed user inputs keep a short first-paint placeholder
instead of becoming empty, so API user-message expectations and browser DOM
visibility stay aligned. That placeholder carries a short stable token so
multiple exhausted historical inputs in the same turn do not collapse into one
browser-visible user card. The default shared limit is controlled by
`CODEX_MOBILE_THREAD_DETAIL_PROGRESSIVE_COMPLETED_USER_TEXT_CHARS` and defaults
to 1024 characters. This is an HTTP first-paint preview only; it does not mutate
the rollout/session record.
If the same active first-paint response remains over budget because completed
`turnUsageSummary` rows still carry full internal summary metadata, newer
servers compact only the completed Usage summary payload to fields consumed by
the Usage UI. Affected rows carry `mobileFirstPaintUsageBudget`, and the
thread budget reports `progressiveCompletedUsageBudgetApplied`,
`progressiveCompletedUsageBudgetReason`,
`progressiveCompletedUsageBytesBeforeBudget`,
`progressiveCompletedUsageBytesAfterBudget`,
`truncatedCompletedUsageItems`, and `omittedCompletedUsageBytes`. This is an
HTTP response-shaping rule: the Usage row remains visible, persisted rollout
data is unchanged, and the budget must preserve rendered fields such as context
window usage, risk level, last/total token usage, rollout size, and workspace
context size counters. The per-row marker is intentionally lightweight and the
service should skip a Usage compaction when the marker overhead would make the
row or full thread response larger; verify that
`progressiveCompletedUsageBytesAfterBudget` is below
`progressiveCompletedUsageBytesBeforeBudget` before treating the compact as a
payload win.
If task-card/user-input/first-stage Usage budgets still leave the active
first-paint response over the byte ceiling, newer servers run a second Usage
pass that keeps only the summary fields needed for the compact Usage display:
context percent, risk level, rollout size/over-threshold state, and
`totalTokenUsage.totalTokens`. Affected rows keep the same
`mobileFirstPaintUsageBudget` marker with `scope=completed-summary-only` and
`detailOmitted=true`; thread-level readback reports
`progressiveCompletedUsageSummaryOnlyBudgetApplied`,
`progressiveCompletedUsageSummaryOnlyBudgetReason`,
`progressiveCompletedUsageSummaryOnlyBytesBeforeBudget`,
`progressiveCompletedUsageSummaryOnlyBytesAfterBudget`,
`truncatedCompletedUsageSummaryOnlyItems`, and
`omittedCompletedUsageSummaryOnlyBytes`. `progressiveActiveFirstPaintOverCeilingBytes`
is computed from
`progressiveActiveFirstPaintBytesAfterUsageSummaryOnlyBudget` when that pass
runs.
On v558+ clients, a per-turn `mobileVisibleItemBudget` also renders as a small
first-paint omission notice in the conversation. That notice has a
`data-render-key` and enters the conversation signature, but intentionally does
not have `data-item`; treat it as proof of server-side response budgeting, not
as a projection mismatch or missing DOM item.
If item counts are already bounded but the payload remains heavy, inspect the
second-stage first-paint byte fields:
`progressiveFirstPaintThreadByteCeiling`,
`progressiveFirstPaintBytesBeforeTextBudget`,
`progressiveFirstPaintBytesAfterTextBudget`,
`progressiveCompletedTextBudgetApplied`,
`progressiveCompletedTextBudgetReason`,
`progressiveCompletedTextBudgetScope`,
`progressiveCompletedTextBudgetProtectedLatestTurn`,
`progressiveCompletedTextBudgetSkippedLatestTurnCount`,
`progressiveCompletedTextChars`, `truncatedCompletedTextItems`, and
`omittedCompletedTextChars`. Those fields mean non-current completed
assistant/reasoning receipts were reduced to first-paint previews marked with
`mobileFirstPaintTextBudget`; the current active turn still uses
`mobileActiveTextBudget`. In active first-paint scope, protected completed
replay text can also be previewed because the live active turn owns the current
reading state. In resting recent detail, scope
`resting-history-first-paint` means historical completed receipts were previewed
while the latest completed turn stayed protected. If those completed receipts
are not the cause, inspect
retained active operation items for `mobileOperationPayloadBudget` /
`mobilePayloadTruncated`; command output previews should show
`outputTruncated=true` and `outputTotalChars` while keeping only the latest
output tail in the default first paint.
On-demand expansion of omitted historical assistant progress is a separate
route/API feature, not part of the default first paint.

If `turnsListInitialMs` dominates while the final read still returns
`projection-active-overlay` and `activeFullReadReason=initial-window-active-turn`,
the summary missed active state and the route discovered the live turn too late
through generic `turns-list-initial`. Current builds should use live overlay
preprobe evidence to try `turns-list-active-overlay-window` before generic
initial reads; a successful repair reports
`activeFullReadReason=projection-live-active-turn`,
`activeOverlayWindowFirst=true`, and `projectionSeedSource` from the active
overlay projection window. If that still falls back to `turns-list-initial`,
inspect active-overlay provider completeness and active-window projection lookup
miss reasons before changing response budgets.

For thread-list loads that are "warm" but still cost tens or hundreds of
milliseconds, inspect `mobileDiagnostics.threadListTimings.stateAttachMs` and
`decorateMs` before changing fallback or app-server policy. If `stateAttachMs`
dominates `totalMs` and `coldPathOwner=thread-list-state-attach`, the visible
cost is thread-list state decoration such as task-card/Goal metadata, not
`thread/list` RPC or rollout scanning. If `decorateMs` dominates `totalMs` and
`coldPathOwner=token-usage-decoration`, the visible cost is Workspace token
usage decoration. Current builds add
`tokenUsageQueryCount`, `tokenUsageCacheHitCount`,
`tokenUsageFreshCacheHitCount`, `tokenUsageStaleCacheHitCount`,
`tokenUsageExpiredMissCount`, `tokenUsageAllowExpiredCache`, and
`tokenUsageMaxCacheAgeMs` to the same timing object. It also exposes bounded
phase counters: `tokenUsageWorkspaceCwdCount`,
`tokenUsageWorkspaceSnapshotBuildMs`,
`tokenUsageWorkspaceSnapshotCacheHitCount`,
`tokenUsageWorkspaceSnapshotCacheMissCount`, `tokenUsageCacheCloneMs`,
`tokenUsageDecorateSummaryMs`, and `tokenUsageDecorateAttachMs`. A healthy
repeated first-paint list should show `tokenUsageQueryCount=0` after the first
aggregate read unless a real completed-turn Usage write changed the ledger, and
the Workspace snapshot should be a cache hit for the same visible Workspace set.
Replayed identical `turn/completed` events should not invalidate the token usage
query cache.

If `threadReadMs=0`, `projectionState=hit`, and `summaryMs` dominates
`totalMs`, inspect the thread-detail summary phase before changing projection
or frontend render policy. A warm detail open should not synchronously run
app-server `thread/list limit=1000` when the process already has local
state-db/started/rollout summary plus display-summary cache. The expected
server-side evidence is `summary_display_cache_merge` followed by
`summary_app_server_refresh_skipped` with reason `display-cache`, or reason
`recent-app-server-refresh` within
`CODEX_MOBILE_THREAD_DETAIL_SUMMARY_APP_SERVER_REFRESH_TTL_MS` (default `30s`).
Missing local and display-cache summaries still require the app-server lookup;
that is a different cold/deep-link path.

If the user reports the newer shape "it keeps loading for a long time and then
eventually appears", distinguish it from the old timeout/failure path. The
client thread-open watchdog fires after `THREAD_LOAD_STALL_MS` and reports a
bounded Home AI diagnostic as `thread_detail_slow_path` with reason
`api-pending`, the thread hash, the stall threshold, and elapsed duration. A
single stall remains local/retry behavior. Clients after
`codex-mobile-shell-v580` treat `thread_session_slow_path` events as
observe-only by default: counts and bounded client events are kept for
performance analysis, but they do not post `homeai.diagnostic.report` and
should not create Owner repair cards unless the reporter is explicitly run in
controlled `slowPathReportMode: "report"` diagnostics.
On v557+ clients, successful thread-detail loads also plan
`thread_detail_slow_path` when first-paint elapsed/API/render time crosses the
default 1.5s threshold. Slow-path repeat counting is intentionally stable across
client build id, read mode, render mode, and source kind so repeated
user-visible slow opens such as `turns-list-initial` ->
`projection-active-overlay` do not stay below the reporting threshold merely
because the implementation path changed. Those volatile fields remain in the
bounded local evidence for root-cause attribution.
For the thread list, v556+ clients also plan `thread_list_slow_path` from
successful `thread_list_rendered` evidence when elapsed/API/render time crosses
the list slow threshold. That local evidence includes only bounded phase labels
and counts such as fallback-cache decision, app-server request reason,
`appServerRpcMs`, diagnostic `app_server_response_kb`, fallback source counters,
and result count.

If a newly submitted message briefly shows local input feedback and then the
right-side turn timer changes to `已结束` while `/api/threads/:id?mode=recent`
still returns thread-level `status=active`, check for a stale latest turn row in
the detail payload. Some app-server/detail windows can expose a completed latest
turn row before the real active turn is materialized. The browser must treat the
thread-level non-stale active status as a runtime signal: continue live polling
and keep the timer in an active fallback state instead of trusting the completed
turn row and stopping refresh.

If thread detail shows `idle` or latest turn `interrupted`, but the thread list
still reports the same row as `active`, compare app-server list rows with
rollout fallback rows. A stale rollout fallback `active` summary must not
override a same-time or newer app-server `idle` summary during list merge; only
a genuinely newer rollout activity should revive the row to `active`. If this
regresses, run:

```powershell
node --test test\thread-visibility.test.js test\conversation-render.test.js test\thread-item-timestamp-enrichment.test.js test\mobile-viewport.test.js
```

If the opposite happens for a configured deploy lane, where
`/api/threads/:id?mode=recent` reports `status=active` with a real
`activeTurnId` but `/api/threads` still shows the lane as `idle`, inspect the
warm fallback cache merge path. Deploy-lane idle summaries can have a newer
cache/list timestamp than the runtime-derived active summary, so the merge rule
must allow runtime-derived deploy-lane active evidence to replace warm idle
metadata while preserving the stale-rollout-active protection above. The focused
coverage is:

```powershell
node --test test\thread-visibility.test.js test\thread-list-fallback-cache-service.test.js test\thread-task-card-deploy-lane-policy-service.test.js
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
- Clients after `codex-mobile-shell-v581` must not append local submitted user
  cards or server pending steer echoes into a completed turn. If a `You` card
  appears below the final assistant receipt or Usage row, inspect
  `composerTargetActiveTurnId()`, `insertLocalSubmittedUserMessage()`, and
  `adapters/message-pending-echo-service.js` before adding UI-side dedupe.
- Server builds after the projection-index duplicate fix also fold same-content
  `item-*` user messages only when their bounded timestamps match. This is a
  projection-event repair, not text-only dedupe: two same-text user messages
  sent at different times must still render as two messages.

## Active Goal Output Disappears After Re-entering A Large Thread

Symptom:

- While a goal or long task is open, Mobile Web streams many tool/action cards.
- After leaving the thread and entering it again, only a small subset of those
  cards remains visible.

Cause to check:

- Thread detail may report `mobileReadMode=projection-dynamic` or
  `mobileReadMode=projection-cache`. That is the expected fast path for large
  rollout threads once the server has a dynamic or warm projection. If a large
  stable thread still reports `mobileReadMode=thread-read` every time, inspect
  `adapters/thread-detail-projection-service.js`, rollout size/mtime changes,
  and summary `updatedAt/status` changes that may be invalidating the
  projection signature.
- `projection-v4-dynamic` is not an unconditional long-lived cache. If the
  backing rollout path/size/mtime, retained turn window, or policy version
  changes after the projection seed, completed/idle/error-like threads should
  miss and reseed; active threads only keep the dynamic projection for a short
  stale window while notifications continue arriving.
- `turns-list-active-overlay-window` is a history-only active-window cache.
  It intentionally omits the live active turn, so active-turn rollout
  size/mtime growth must not invalidate that history cache by itself. It should
  be invalidated by turn-boundary events such as `turn/started` or
  `turn/completed`, then repaired by notification or thread-list active-window
  prewarm.
- On current servers, warm `projection-v4-cache` / `projection-v4-dynamic` hits
  may report `mobileProjection.normalization=reused-visible-metadata` when the
  cached v4 result already has complete visible keys. That is the expected fast
  path for repeated opens. If `projectionMs` is still high and this marker is
  absent, inspect whether recent delta-created items lack visible metadata and
  force a full v4 normalization pass; do not treat this as a client refresh
  problem. If the marker is present but `projectionMs` remains high, inspect
  whether the projection-result assembler accepted the response-ready v4 shape
  or had to run the raw `thread/read` compaction path because visible-key
  metadata was incomplete or inconsistent.
- The projection index is updated from raw app-server notifications before
  browser SSE compaction. It should observe `item/started`, `item/completed`,
  `item/agentMessage/delta`, `item/reasoning/*Delta`,
  `item/commandExecution/outputDelta`, and `item/fileChange/outputDelta`.
  If re-entering a running thread misses the latest intermediate output, check
  whether the listener is receiving raw notifications and whether the current
  projection entry was seeded before those notifications arrived.
- If the status chip shows live output/commands/reasoning but the thread body is
  anchored on an empty latest `inProgress` turn, compare `activeTurnId`,
  `mobileLocalActiveStatus`, and the last two detail turns. A Mobile Web
  `message-submit` overlay is only a temporary state bridge until a real turn is
  materialized. Server compaction must transfer active ownership to a different
  unfinished turn that already has runtime items, and must drop empty live
  shells once the thread summary is idle/completed/error-like. Do not fix this
  in the browser by displaying another fallback turn; the server projection
  should not emit the contradictory empty active shell.
- If a completed turn shows two different `Usage` cards or the final assistant
  receipt disappears after leaving and re-entering, check the
  `turn/completed` projection merge path first. Completion notifications are
  patches; they must preserve already-streamed assistant text when their
  `items` array is missing or shorter, merge replacement assistant/plan
  receipts by id or matching text, and keep only one `turnUsageSummary` item per
  turn.
- If the rollout comparison shows `task_started` and many `token_count` events
  but no `task_complete` for that turn, the missing final receipt is not a
  projection-rendering loss: the source turn is incomplete or interrupted.
  Mobile Web should remove any stale Usage card from that turn instead of
  rendering Usage as if the final receipt had completed.
- If rollout has `task_complete.last_agent_message` for a completed turn but
  first-open thread detail loses the final assistant/plan receipt, check the
  rollout final-receipt enrichment path in `server.js`. The compact/projection,
  raw, and turns-list detail paths should insert one synthetic `agentMessage`
  before `turnUsageSummary` when the completed turn has no assistant/plan item
  whose text matches the rollout final message. Intermediate `agentMessage`
  items are not enough to suppress this fallback. Existing matching receipts
  must not be replaced, and failed, cancelled, interrupted, active, or
  in-progress turns must not receive this fallback.
- If only command/file rows appear for the latest completed turn after
  re-entering a thread, inspect the rollout completion-turn backfill before
  changing browser rendering. Current server builds retain a bounded tail of
  scoped `agent_message` / assistant `response_item` progress text for the
  latest completed turn, attach `task_complete.completed_at` to the synthetic
  final receipt, and suppress command/file raw-operation rows when progress
  text exists. Command/file rows are only a degraded replay signal when the
  rollout has no usable assistant progress text for that completed turn.
- If rollout has `task_complete` / `task_completed` with an explicit empty
  final assistant message, do not synthesize a normal `agentMessage`. That
  indicates the runtime completed the turn without a response. The detail
  projection should attach a `turnDiagnostic` item with
  `runtime_completed_without_response`, preserve it through receipt-only
  compaction, and suppress normal completion Push for that no-final-message
  shape.
- If `thread/turns/list` omits the latest completed turn entirely while the
  thread summary `updatedAt` and rollout tail both point to a later
  `task_complete`, the compacted detail response must append that completed
  turn from the rollout completion event before trimming the recent window. This
  is separate from adding a missing receipt to an existing turn: the turn itself
  is absent from app-server's bounded list.
- If raw rollout has valid scoped `token_count` for a recently completed turn
  but the detail response has no `turnUsageSummary`, check whether the fixed
  rollout tail no longer contains that turn's token events. Thread detail should
  pass the returned turn ids into `readRolloutTurnUsageSummaries()` so the
  server can perform a bounded full-file metadata scan and cache token summaries
  when the tail result is missing a target turn. Targeted Usage cache hits must
  also pass this missing-turn check; do not return a target cache entry that
  lacks any currently returned target turn id.
- If raw rollout has scoped `token_count` and `readRolloutTurnUsageSummaries()`
  can resolve the latest completed turn, but a `projection-v4-cache` or
  `projection-v4-dynamic` detail response still omits `turnUsageSummary`, check
  the projection result assembler rather than the browser. Response-ready v4
  projection hits intentionally skip `compactThreadReadResult()` for speed, but
  they must still run the dynamic thread-read result decoration hook before
  final visible-key normalization and response budgeting. Do not add a frontend
  Usage fallback over a server projection missing this synthetic item.
- Latest-completed replay is for user-visible progress receipts after a turn
  finishes. It may retain bounded assistant/plan progress and final receipt
  rows, but completed replay must not keep `reasoning` rows from the active
  budget and should not replay command/file/tool operation rows. If a reloaded
  completed turn shows Reasoning or command cards instead of user-facing
  intermediate receipts, inspect `thread-detail-response-budget-service`
  replay filtering before changing the renderer. A single final assistant
  receipt is not by itself a `latest_completed_replay_receipt_only` defect; the
  self-check should only raise that warning when
  `mobileDetailResponseBudget.latestCompletedReplayOmittedAssistantItems`
  proves that latest-replay assistant/plan progress was actually budgeted away.
  If the latest completed turn has `mobileSyntheticCompletionTurn=true` /
  `source=rollout_task_complete`, it is a rollout completion receipt backfill
  for a turn missing from the app-server detail window. Lack of a user-input
  item on that synthetic turn is not evidence that the projection dropped the
  user's message, and the active-overlay input-gap gate should not force a slow
  rebuild for that shape.
- For routine self-checks after projection, Usage, timestamp, or thread-list
  ordering changes, run
  `node scripts/codex-mobile-thread-self-check.js --server http://127.0.0.1:8787 --json`
  or pass one or more `--thread-id <id>` values for focused checks. This
  metadata-only check verifies latest completed turn Usage and assistant
  presence, user-input presence warnings, assistant/plan timestamps, no
  completed replay operation/reasoning rows, duplicate turn/item/visible keys,
  repeated detail-refresh downgrades, transient repeat-sample detail/list
  losses, and bounded thread-list duplicate/order/update warnings. Use
  `--repeat <n>` when checking intermittent refresh faults: every sample is
  analyzed and any middle-sample downgrade remains in the summary even if the
  final sample recovers. It intentionally checks the Usage tool item exists but
  does not require a separate Usage title/timestamp, because the visible time
  belongs to the adjacent final assistant receipt.
  Current checks also report `duplicate_user_message_events` when one turn has
  same-content user messages with the same bounded timestamp, which usually
  means the projection/live-overlay layer double-counted one submitted event.
- If the API self-check is clean but the real client still flickers, clears a
  thread detail to `No visible turns.`, shows duplicate DOM items, or loses a
  just-visible thread after reopening, run the browser-runtime check:
  `node scripts/codex-mobile-browser-runtime-self-check.js --server http://127.0.0.1:8787 --sample-threads 3 --rounds 5 --sample-delays-ms 100,350,1200,2800,6000 --json`.
  The script drives a temporary Chrome profile through the real UI and samples
  only bounded `#conversation` metadata. `browser_dom_sparse_after_nonempty`
  means the browser had already shown confirmed nonempty content for that
  target thread, then rendered a sparse/empty shell; this should be fixed at
  the client state/first-paint boundary instead of hidden with UI dedupe.
  Clients after `codex-mobile-shell-v576` also report
  `browser_dom_visible_items_downgraded_after_nonempty`,
  `browser_latest_turn_timestamp_missing`,
  `browser_latest_turn_usage_missing`, and `browser_image_render_failed`.
  Clients after `codex-mobile-shell-v577` additionally report
  `browser_latest_turn_item_count_downgraded`,
  `browser_latest_turn_user_message_downgraded`,
  `browser_latest_turn_assistant_message_downgraded`, and
  `browser_latest_turn_assistant_text_duplicate`. These are latest-turn scoped
  checks: a healthy whole-conversation item total no longer hides the user
  message or latest assistant rows disappearing inside the active/latest turn.
  Assistant text duplicates are H2 for completed/resting receipt shapes and H3
  for active progressive shapes where the DOM has newer budgeted assistant
  progress than the API plan and repeated short status fragments are advisory.
  Clients after `codex-mobile-shell-v578` split ordinary user-message and
  injected task-card expectations, and also report
  `browser_latest_turn_user_message_below_api_expectation`,
  `browser_latest_turn_task_card_below_api_expectation`,
  `browser_latest_turn_operation_items_visible`, and
  `browser_latest_turn_reasoning_items_visible`. These checks catch the class
  where the API has the submitted user input but the DOM latest turn does not,
  or where command/reasoning process rows leak into the ordinary conversation
  instead of staying in the operation status surface. Task-card injected DOM is
  a userMessage presentation, so newer analyzer builds count
  `.thread-task-card-injected` as visible user input for ordinary user-message
  visibility while still enforcing task-card-specific expectation counts.
  Current checks also compare bounded DOM/API structure for every recent
  visible turn, not only the latest turn. `browser_turn_assistant_missing`,
  `browser_turn_user_message_below_api_expectation`,
  `browser_turn_task_card_below_api_expectation`,
  `browser_turn_usage_missing`, `browser_turn_timestamp_missing`, and
  `browser_turn_user_message_after_usage` catch the class where an ended turn
  visually shows only user cards, loses assistant/Usage rows, or renders a
  user-message card after the Usage row even though `/api/threads/:id` returned
  a complete turn. These reports include only turn hashes and bounded counts.
  Current checks also report `browser_api_latest_turn_user_message_duplicate`
  when the API expectation already contains duplicate same-event user messages,
  and `browser_latest_turn_user_message_duplicate` when the real DOM latest
  turn shows repeated same-text user cards.
  Current image failure reports include bounded `imageFailureKindCounts` and
  `firstImageFailure` metadata, such as `generated-image`,
  `hermes-proxy-generated-image`, `protected-placeholder`, `unsafe-source`,
  `missingSrc`, natural dimensions, and recovery counters. These fields
  distinguish missing `src`, unsafe source, failed protected recovery, and
  missing generated-image cache routes without printing raw URLs, paths, or
  image bytes.
  Clients after `codex-mobile-shell-v579` preserve a non-bottom user-reading
  viewport anchor across full conversation renders, local refresh patch
  transactions, visible item inserts, visible item replacements, and live text
  patches. If a new reply still makes the screen jump while the user is
  reading above the bottom, inspect `captureConversationViewportAnchor()` /
  `restoreConversationViewportAnchor()` before adding throttles or UI dedupe.
  The browser self-check now also samples visual anchor positions. It reports
  `browser_visual_anchor_jitter` when the same target thread, same visual frame,
  same anchor, and unchanged DOM counts still move by a few pixels repeatedly;
  this is an H3 user-experience signal for small flicker, not a full projection
  loss. Clients after `codex-mobile-shell-v581` disable conversation-body
  `entry-animate` / `entry-leave` translation animations because those 6-8px
  entry transforms are visible as thread-open jitter in the reading surface.
  If jitter remains after v581, treat it as a scroll-anchor or local-patch
  sequencing issue, not an animation issue. The browser self-check also runs
  a bounded thread-list interaction stress by default. It opens the list,
  scroll-probes it, clicks thread cards, returns to the list, and records
  metadata-only rAF/scroll/long-task evidence. `browser_thread_list_interaction_blocked`
  is H2 only when the per-frame interaction path is blocked; stress probe
  wall-clock time includes intentional waits and is preserved as trend metadata.
  With explicit `--exercise-submit`, the browser check sends one short
  Composer message through the real UI path, asking for an OK-only reply, then
  samples whether the submitted user card becomes visible, disappears, or
  jitters. Use `--submit-thread-id <id>` to target a dedicated thread, or omit
  it to exercise the first selected production thread. Do not enable this flag
  in periodic checks unless a small OK-only model turn is acceptable. If the
  target thread is busy and Composer is not writable, the self-check reports
  `browser_submit_exercise_failed` instead of treating the run as a successful
  client validation.
  The analyzer no longer drops a sparse sample merely because
  `contentConfirmed=false`; such samples cannot establish a healthy baseline,
  but they can prove regression after the same target thread was previously
  confirmed nonempty. It also reports duplicate render/item keys, login/app
  visibility failures, runtime exceptions, console errors, and route/status
  counts without printing thread titles, message text, task-card bodies,
  uploads, query strings, cookies, access keys, tokens, screenshots, or logs.
- After each deployment that changes thread-detail, projection, image rendering,
  timestamps, or client refresh behavior, run the combined one-shot self-check:
  `node scripts/codex-mobile-runtime-self-check-loop.js --server http://127.0.0.1:8787 --gate-mode deploy --json`.
  For periodic local monitoring, run the same script with
  `--loop --interval-ms 600000`; it appends metadata-only JSONL records to
  `~/.codex-mobile-web/logs/runtime-self-check.jsonl`. Read the top-level
  `gate` object before treating a sample as blocking. `gate.deployPass=false`
  means a user-visible H1/H2 projection, duplicate-message, image, timestamp,
  submit, list/detail, or child execution issue remains actionable. Slow but
  eventually successful `thread_session_slow_path` samples remain
  `observeOnlyIssueCodes` by default; keep them as performance evidence rather
  than creating repeated repair cards. The loop records issue counts and
  build/cache ids only and must not directly dispatch repair cards; Home AI
  diagnostic intake and Owner approval own the repair-card step. Child
  self-check CLIs can intentionally exit nonzero when their JSON report has
  `ok=false`; treat the parsed JSON report as the health contract, and treat the
  child as an execution failure only when no parseable JSON report was emitted.
  Browser-runtime child checks can legitimately take several minutes while
  opening Chrome, switching threads, and sampling delayed DOM states; the
  `runtimeJobs` entries are emitted from
  `services/runtime/runtime-job-scheduler-service.js` and should be checked for
  `periodicAllowed`, `timeBudgetMs`, `cpuBudgetClass`, `realBrowserAllowed`,
  and `userRequestPreemptible` before changing LaunchAgent cadence or enabling
  recurring browser checks.
  parent loop allows a bounded 300s child timeout, still below the 10-minute
  periodic interval. Newer browser-runtime checks refresh the API thread plan
  after each sampled thread is opened and refresh it again before settled
  delayed snapshots at or above the configured settled-delay threshold. This
  avoids comparing active-thread DOM samples against stale API expectations
  while keeping short-delay samples on the lower-cost path.
- To verify the 10-minute macOS periodic checker itself, run:
  `node scripts/codex-mobile-runtime-self-check-launchagent-readback.js --json`.
  A healthy result has `ok=true`, `launchctl.loaded=true`,
  `latestEvent.hasGate=true`, `latestEvent.gateMode=periodic`, and
  `latestEvent.periodicHealthy=true`. A historical nonzero
  `launchctl.lastExitCode` is not itself a failure when the latest fresh gate
  event is healthy; it remains actionable only when the latest event is stale,
  missing, or unhealthy.
  The readback selects the latest JSONL event that contains the expected full
  periodic check set (`api-thread`, `browser-runtime`, and `client-events` by
  default). Manual diagnostic runs such as `--skip-api --skip-browser` may write
  to the same JSONL file, but they must not replace the LaunchAgent health
  evidence. Use `--required-checks` only when the scheduled plist intentionally
  runs a different check set.
  The readback is inspect-only and reports path hashes plus bounded counts; it
  must not be used to install, unload, or kickstart launchd jobs.
- If opening a thread takes 1-2s before latest detail appears, run Phase-B
  readback against that thread:
  `node scripts/codex-mobile-phase-b-readback-smoke.js --server http://127.0.0.1:8787 --thread-id <id> --json`.
  Read the bounded `decision` object first. Clients after
  `codex-mobile-shell-v579` classify detail `totalMs >= 1000` or
  `activeOverlayMs >= 800` as a latency finding instead of reporting ready;
  `totalMs >= 1500` or `activeOverlayMs >= 1000` is H2. If the owner is
  `active-overlay-latency`, continue in the active-overlay provider/read
  orchestration path. Check `activeOverlayWindowMs` first for app-server
  active-window RPC rebuilds, then `activeOverlayBackfillWindowMs` /
  `activeOverlayFullProjectionMs` / `activeOverlayHistoryBaselineMs` for local
  active-overlay merge/projection CPU work. If `activeOverlayMs` is high while
  those child fields stay low, repair the diagnostics split before changing
  runtime behavior. For live projection overlays, a complete signed
  `projection-live` snapshot should not perform a fresh
  `turns-list-active-overlay-window` read on every detail request. Partial,
  notification-shell, or missing-signature overlays should still force the
  fresh active-window read. If production shows high
  `activeOverlayBackfillWindowMs` together with `activeOverlayWindowMs` after
  this rule, inspect why the overlay was classified incomplete before tuning
  app-server RPCs. If the owner is `thread-detail-latency`, split the
  summary/projection/prepare/transport stages before changing the renderer.
- Clients after `codex-mobile-shell-v575` keep a reusable in-memory thread
  detail snapshot in `state.threadTileDetails`. When reopening a thread that
  already has loaded detail state, `loadThread()` paints that cached detail
  first and refreshes in the background, rather than replacing the conversation
  with a loading/empty shell. If this regresses, check the
  `cached-detail-first-paint` branch before adding render-layer filtering.
- Thread detail should first use app-server `thread/read` even when the rollout
  file is over 32MB, because `thread/turns/list` does not reliably preserve the
  command/tool/file/search operation items expected in Mobile detail. If detail
  reports `mobileReadMode=turns-list`, treat that as a fallback after both
  projection and `thread/read` were unavailable or timed out, not as the normal
  large-rollout path.
- A `thread/turns/list` fallback should include `mobileOlderTurnsCursor` when
  app-server has older turns. The phone can load another bounded page through
  `/api/threads/<id>/turns?sortDirection=desc&cursor=<json>`. If this returns
  `invalid cursor`, the route is forwarding the cursor as a raw string instead
  of parsing the app-server cursor JSON object.
- A normal compacted `thread/read` detail should also expose
  `mobileOlderTurnsCursor` when more than `CODEX_MOBILE_THREAD_TURNS` turns
  exist. The browser defaults to 10 recent turns and loads 10 older turns when
  the user scrolls to the top of the current detail window.
- The current compact path should retain intermediate cards for the current
  live turn and its previous ended turn. If no live turn exists, it should
  retain intermediate cards for the latest ended turn. Older-history turns
  loaded through `/api/threads/<id>/turns`, and older turns outside that
  state-relevant set, should be receipt-only: user question items plus the last
  assistant/plan receipt and any `turnUsageSummary` metadata, without old
  assistant progress updates, operation, reasoning, or other diagnostic cards.
  The HTTP detail response applies the same display contract after
  projection/read orchestration: current active turns and the latest completed
  replay keep assistant/plan progress rows, while command/operation and
  reasoning rows remain budgeted. Historical completed turns keep the latest
  assistant/plan receipt, and `mobileOmittedAssistantItemCount` /
  `mobileDetailResponseBudget` record omitted historical progress-row counts.
  If `progressiveActiveBudgetApplied=true`, active replay turns may be bounded
  by `progressiveReplayAssistantItems`; completed replay turns may be bounded
  separately by `progressiveCompletedReplayAssistantItems`.
  `limitedReplayAssistantItems` records the total replay assistant/plan rows
  intentionally omitted by the server first-paint budget, while
  `limitedCompletedReplayAssistantItems` records the completed replay subset.
  Treat that as response shaping evidence, not a browser render drop. If
  `progressiveActiveBudgetApplied=true`, retained active
  assistant/reasoning text fields may also carry
  `mobileActiveTextBudget`; that is a pressure-triggered first-paint preview.
  If `progressiveCompletedTextBudgetScope=resting-history-first-paint`, the
  server previewed older completed receipts because the resting recent detail
  body was too large, but the latest completed turn should remain untruncated.
- Current clients still enter thread detail at the bottom. Do not fix missing
  large-thread history by changing the open position; first check whether the
  server returned full `thread-read` or a fallback `turns-list` window.
- If a compressed continuation thread first opens with only the bootstrap
  message, then shows the turn ended before the final receipt/Usage appears,
  check the first `thread_refresh_ms` after `turn/completed`. It must not leave
  the browser on a `turns-list-initial` recent window when projection has not
  been seeded yet. Post-completion refreshes should request full detail, and
  a resting `idle` / `completed` summary with matching rollout
  `task_complete` / scoped `token_count` evidence should still backfill the
  same turn's synthetic final receipt and `turnUsageSummary`. Failed,
  cancelled, interrupted, running, active, pending, or progress statuses must
  remain excluded from that relaxed resting-window path.
- Long latest-turn final receipts are intentionally rendered once after
  `turn/completed` when the live turn already has command/file/tool/search
  operation items. Pure chat replies may still stream normally. If the receipt
  is long, the browser should stop at the receipt start rather than the bottom;
  the down-arrow remains the explicit skip-to-bottom control. If the completion
  notification only carries a short payload, the follow-up thread refresh should
  preserve the completion anchor and perform the one-time receipt-start jump
  after the full deferred receipt is merged unless current-thread reading
  protection is active. Clients after `codex-mobile-shell-v609` intentionally
  cancel pending post-completion, Usage-backfill, live-poll, and resume refreshes
  while the user is manually scrolled away from the bottom in the current thread;
  this is a persistent reading state, not a short recent-scroll timeout. In-flight
  automatic refresh responses must not be applied. If `/api/threads/<id>` already has
  `turnUsageSummary` but the just-completed browser view does not, first check
  whether the user was in that protected reading state; otherwise inspect the
  post-completion refresh queue, where completion should schedule both an
  immediate and a delayed full detail refresh.
- If a thread finished while the browser was away and Usage appears only after
  leaving and reopening the thread, inspect the initial `loadThread()` path in
  `public/app.js`. The first successful detail render must schedule the same
  bounded Usage backfill used by post-completion refreshes, because the first
  open can otherwise render an older projection cache that has the final
  receipt but not yet the `turnUsageSummary`.

Useful verification:

```powershell
node --test test\thread-item-timestamp-enrichment.test.js test\turn-scroll-controls.test.js test\mobile-viewport.test.js
```

## Thread Stuck Or Very Slow

Do not infer from rollout file size alone. Separate:

- Is rollout still growing?
- Is a local command/tool still running?
- Is approval pending?
- Is the slow request actually thread detail, or a background thread-list
  refresh? Check `thread_detail_first_paint` / `thread_refresh_ms` against
  `thread_list_rendered.serverTimings`. Large threads may return 10-turn detail
  quickly while a cold full list fallback spends time in `fallbackRolloutMs`.
  The deferred full-list fallback should be delayed and cancellable, not run
  immediately while a thread detail request is still loading. If a list response
  reports `fallbackDeferredReason=active-thread-detail`, the server intentionally
  skipped the expensive fallback scan because a detail request was in flight;
  wait for the later deferred list refresh instead of rebuilding in-memory
  projection caches.
- Does the same list key become slow again after a fixed interval? Current
  server behavior should not do that by default: the expensive fallback baseline
  is process-lifetime, not a 30-second timer. `fallbackCacheHit=false` should be
  expected after cold start/redeploy/restart, after a new cwd/search/visibility
  cache key, or if `CODEX_MOBILE_THREAD_LIST_FALLBACK_CACHE_TTL_MS` was
  explicitly set for diagnostics. Normal turn/status/title/archive changes
  should update the cached row incrementally rather than clearing the baseline
  and forcing another rollout/session scan.
- Did an ordinary no-search default or Workspace thread-list request wait on
  app-server even though the process fallback cache was warm? Current server
  behavior should report `mobileDeferredAppServer=true`. Default list reads
  should report `appServerDeferredReason=warm-fallback-default` and
  `appServerDeferredInitialReason=default-warm-cache`; Workspace reads should
  report `appServerDeferredReason=warm-fallback-workspace` and
  `appServerDeferredInitialReason=workspace-warm-cache`. A Workspace read that
  is served by filtering the default visible-thread warm cache should report
  `fallbackCacheDecision=workspace-derived-hit` and
  `fallbackWorkspaceDerivedCacheHit=true`. If those fields are absent, check
  `CODEX_MOBILE_THREAD_LIST_DEFAULT_WARM_FALLBACK`, the request filter shape,
  and whether the process cache was actually warm. A miss on this ordinary
  default/workspace path intentionally falls through to app-server instead of
  building a cold fallback baseline.
- Did an ordinary default list request use `limit=80` while production only has
  fewer visible rows? A warm default cache with fewer rows than `limit` is still
  complete when `fallbackBaselineResultCount` is less than or equal to the row
  count and `fallbackBaselineLimitDropCount=0`. That response should keep the
  warm path with `initialFallbackCompleteBelowLimit=true` and
  `appServerDeferredReason=warm-fallback-default`. If it instead reports
  `initialFallbackSkippedReason=insufficient-default-warm-cache-window`, the
  server is incorrectly treating a complete small list as a truncated window and
  can recreate high CPU by repeatedly falling through to app-server/full
  fallback work.
- For small ordinary default list requests, check `appServerRequestLimit`.
  It should follow bounded overfetch `max(limit * 2, 80)` capped at 500. A
  default `limit=8`, `20`, or `40` request reporting `appServerRequestLimit=500`
  has regressed to the old unconditional app-server window and can make thread
  entry slow by competing with the immediate detail request after a user tap.
  Workspace-filtered and archived list requests intentionally still preserve
  the 500-row window.
- If `/api/threads` and thread detail both return HTTP 500 immediately after a
  runtime-boundary split deploy, inspect the bounded server error code before
  assuming app-server or rollout corruption. A `ReferenceError` naming a
  `server.js` local constant or helper from `server-routes/api-dispatch-route-service.js`
  means the extracted route module leaked a server-local dependency. The route
  service must receive that policy or lifecycle helper through
  `createApiDispatchRouteService()` dependencies; focused coverage should
  assert the adapter source uses the injected dependency, and route execution
  coverage should exercise the affected `/api/threads` branch.
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

Current server behavior keeps compact process cards for the current live turn and the previous ended turn; if no live turn exists, the latest ended turn keeps those cards. Older turns are receipt-only: user question items plus the last assistant/plan receipt only. Raw fallback may attach a completed operation only when the latest turn is still live and the rollout event is tied to that same turn id; older completed operations must not attach to a newer live turn. If this regresses, inspect `readLatestRawOperation()` and `compactThread()` in `server.js`, then add coverage in `test/thread-item-timestamp-enrichment.test.js`.

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

Current server behavior strips those location suffixes before extension detection and root validation. The remaining path must still be an absolute local path, stay under an explicit `CODEX_MOBILE_FILE_PREVIEW_ROOTS` root, a known visible workspace root, the current thread cwd, a Codex skill directory such as `$CODEX_HOME/skills`, `$HOME/.codex/skills`, or `$HOME/.agents/skills`, or an enclosing Obsidian vault, and pass the sensitive-path denylist.

Focused checks:

```powershell
node --test test\file-preview.test.js test\file-preview-ui.test.js test\markdown-render.test.js
```

Do not fix file-preview misses by adding broad roots such as `%USERPROFILE%`, `%TEMP%`, the whole `.codex` directory, the upload directory, or machine diagnostic folders. The intended fix for normal repository files is that visible workspace roots and the current thread cwd are already accepted; skill docs are limited to the explicit `skills` subdirectories.

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
omits it from the primary `thread/list`, inspect `archivedSessionThreadIds()` and
`readSessionIndexFallback()` through `services/thread-list/thread-list-fallback-source-service.js`.
If a completed UUID-only fallback row appears and detail cannot open it, inspect
`readRolloutSessionFallbackThreadFromFile()` in the same provider,
`mergeThreadSummaryList()`, and `shouldHideThreadListSummary()` before mutating
Codex state. Current builds should merge ids from
the active/default/profile `archived_sessions` directories and
`%USERPROFILE%\.codex-mobile-web\archived-thread-ids.json`, then skip matching
ids after verifying `visibleProjectlessThreadIds()`. The Mobile-local index
contains only ids and timestamps, so re-archiving a recovered or old-profile row
can hide it even when the app-server cannot update the original state DB row.

Run:

```powershell
node --test test\thread-archive.test.js test\mobile-archive-index-service.test.js test\thread-visibility.test.js
```

If a source thread still appears after `压缩续接` succeeds, inspect the
continuation result's `sourceArchive`. Current builds should first try the
app-server `thread/archive` RPC and, if that RPC fails after the new
continuation thread is created, write the source id into the Mobile local
archive index so the old thread is still hidden from Codex Mobile. Manual
archive in Hermes/iOS embed mode should use the in-app archive confirmation
dialog; native `window.confirm()` is not reliable in that WebView path.

## Quoted Uploaded Images Stay As Text

If the original user upload renders as a thumbnail but a later Codex/plan reply shows raw `Uploaded attachments:` text, inspect `public/app.js` attachment-summary parsing first.

The parser should recognize LF and CRLF summaries, plus Markdown blockquote-style quoted lines such as `> Uploaded attachments:` and `> - IMG_0001.jpg (...)`. It should also treat raw app-server `input_text` parts as text and `input_image` / `image_url` parts as images, including object-shaped `image_url.url`. The saved upload path must still be under `%USERPROFILE%\.codex-mobile-web\uploads`. Current clients should turn default-runtime upload paths into `/api/uploads/file?id=<upload-root-relative-id>` so the browser image `src` does not include a local absolute path; `/api/uploads/file?path=...` remains a compatibility fallback for old clients and non-default upload roots.

If the DOM contains an `<img>` for the saved upload path but the browser still shows a broken or blank thumbnail, check the upload route response headers. Saved `.jpg`, `.jpeg`, `.webp`, `.gif`, and `.png` files must return image MIME types such as `image/jpeg` rather than `application/octet-stream`. In Hermes/Home AI embed mode, the `<img>` should keep the browser-visible same-origin `/api/uploads/file` or `/api/generated-images/file` URL as `src` plus `data-protected-image-src`; when the iframe page is served under `/api/hermes-plugins/<plugin-id>/proxy/`, the browser-visible URL must include that same plugin proxy prefix instead of the Home AI host root `/api`. Scheduled image scans should not proactively convert still-loading embedded direct images into `data:image/...` or `blob:` URLs. If the image actually errors, recovery may fetch with the current session key; embedded/iOS recovery should retry a cache-busted same-origin URL first.

For `Image` cards from `imageView` / `imageGeneration`, the safe render contract
is stricter than for user uploads. A visible image card should render from a
server-provided `contentUrl` under `/api/generated-images/file` or from an
authorized absolute local path that the server can preview. If the item only
contains a relative filename, raw `data:image`, stale `blob:`, `file://`, or
external URL, the client must not put that value into `<img src>` because the
browser will show a broken icon and Home AI proxy logs may never see a generated
image request. Current clients render those uncached/unsafe sources as bounded
failed image cards with no raw path/text. The source-side fix is still to cache
tool output images through the generated-image cache during projection.

If Codex generates an image as Markdown or plain text `data:image/png;base64,...`, inspect `public/markdown-renderer.js`. Current builds render safe bitmap data images (`png`, `jpeg`, `webp`, `gif`) as bounded `<img>` figures and intentionally reject SVG data images.

Focused checks:

```powershell
node --test test\conversation-render.test.js test\mobile-viewport.test.js
```

## ImageView Screenshot Shows Broken Image

If a Codex turn displays an `Image` card for a visual verification screenshot but the thumbnail is broken, distinguish it from uploaded attachments first. Tool-generated screenshots often come from `view_image` / `imageView` paths under `%TEMP%`, not `%USERPROFILE%\.codex-mobile-web\uploads`. Codex-generated effect images can also arrive as `imageGeneration` items with `savedPath` under `%USERPROFILE%\.codex\generated_images`. Some Codex tool screenshots arrive only in rollout `function_call_output` / `custom_tool_call_output` payloads as `input_image` parts with `data:image/...;base64,...`; Mobile Web should project those into `imageView` cards during thread-detail compaction.

Current behavior should cache small `imageView`, `imageGeneration.savedPath`, and safe bitmap tool-output data images into `%USERPROFILE%\.codex-mobile-web\generated-images` and serve them through `/api/generated-images/file`. Receipt-only historical turn compaction must keep these image cards; otherwise only the latest turn's generated image will appear after thread projection/reload. If a rollout tool-output image has no explicit turn id, Mobile Web should attach it by timestamp window rather than appending every unscoped image to the latest turn. Do not fix this by adding `%TEMP%` or `%USERPROFILE%\.codex` to `CODEX_MOBILE_FILE_PREVIEW_ROOTS`; that would broaden local file preview access beyond the current thread workspace. If the source temp/generated file was already deleted before Mobile Web saw the item, the historical card cannot be recovered from the path alone.

If the original user upload thumbnail is visible but a later system `Image` receipt for the same uploaded file is broken, do not try to make that duplicate receipt render. The intended projection is to keep the user upload in the user message and suppress `view_image` / tool-output echoes for the same upload, including native `imageView` echoes that only retain the upload filename or the original `view_image` call id. Visual verification screenshots and other generated tool images without a matching user-upload summary should still render as generated-image cards.

Focused checks:

```powershell
node --test test\generated-image-cache-service.test.js test\tool-output-image-projection.test.js test\file-preview-ui.test.js test\mobile-viewport.test.js
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
reload. If an old cached iframe keeps detecting the same shell mismatch, it
should send at most one `server_build_changed` refresh request for that
signature; repeated host reloads for the same `clientBuildId` indicate the
request dedupe path regressed.

If the prompt repeats after a source edit, first verify that
`/api/public-config` reports the same `clientBuildId` / `shellCacheName` as the
served `/app.js` and `/sw.js`. Current builds intentionally read shell metadata
from disk on each config request and compare only app-shell build fields, not
the plain `version` string.

If the prompt repeats after the intended restart, compare the running API and
the served static files, not just the workspace on disk:

```powershell
Invoke-RestMethod http://127.0.0.1:8787/api/public-config |
  Select-Object clientBuildId,shellCacheName
(Invoke-WebRequest http://127.0.0.1:8787/app.js -UseBasicParsing).Content.Contains("codex-mobile-shell-vNNN")
(Invoke-WebRequest http://127.0.0.1:8787/sw.js -UseBasicParsing).Content.Contains("codex-mobile-shell-vNNN")
```

If `/api/public-config` is older than `/app.js` / `/sw.js`, the listener is
still an old process and must be restarted into the current files. Current
clients should not enter a visible refresh loop in this state: a loaded
`codex-mobile-shell-vNNN` that is newer than the server-reported shell is a
deployment middle state, and refreshing the page alone cannot fix it. On
Windows, verify the PID that owns port 8787 before killing anything; stop only
the listener process that is actually running this workspace's `server.js`, then
start the replacement hidden.

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
not broadcast source-less rate-limit notifications directly to browsers. For
shared profile homes, live quota is trusted only when it comes from the managed
child app-server or the active profile home's mux endpoint. The composer quota
should follow active `/api/public-config` / `/api/status` snapshots for the
current Mobile Web chain, while profile settings can still use stored or scanned
snapshots for inactive profile rows.

If clicking the `5小时额度` / `周额度` quota chip no longer opens the detail
popup after a Vite app-preview deploy, check the frontend app-shell bridge
boundary before debugging quota data. `public/app-shell-runtime.js` should call
`CodexComposerBridgeRuntime.createComposerBridgeRuntime().toggleQuotaDetails()`
for the top-level quota click. Calling the classic bare `toggleQuotaDetails`
symbol directly can fail after that runtime is ESM-owned and no longer creates a
script-global lexical binding. Also verify the popup is visually in the
viewport, not only `hidden=false` / `aria-expanded=true`: in Hermes embed or
route-transition states, a zero-size quota anchor can otherwise position the
panel off-screen. Current builds use a viewport fallback for hidden anchors and
do not suppress later `click` / `touchend` events unless the bridge toggle has
already succeeded.

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
  message;
- a target-thread `final` answer is not a source-thread return card. Manual
  task-card closure must use `codex_mobile.return_to_source` or
  `scripts/return-thread-task-card.js`, both of which call
  `POST /api/thread-task-cards/:id/reply`;
- approved implementation cards remain returnable by the target thread. If a
  return attempt fails with `task_card_not_returnable:*`, inspect the stored
  card status and confirm the target is using the original `Task card id`.
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

If a routine plugin deploy request appears as multiple deployment cards after a
dynamic-tool failure followed by a fallback-script retry, compare the stored
`idempotencyKey` values for the original cards. Current builds derive
`cardKind=plugin_deployment` plus `pluginId` create keys from the semantic
deployment request instead of the caller `requestId`, so the dynamic tool and
`scripts/create-thread-task-card.js` should converge on one original card when
the plugin id, final deploy lane set, title/body, workflow, and return metadata
are unchanged. A duplicate after that point means either the semantic deployment
text changed, the explicit `idempotencyKey` differed, or the duplication is in
return-card rendering/store recovery rather than original-card creation. Check
`services/task-cards/task-card-idempotency-service.js` and
`test/task-card-idempotency-service.test.js` before changing the renderer.

If a target thread already has an incompatible live app-server state, approval
may fail at the `thread/resume` / `turn/start` stage. In that case the card
should remain actionable instead of silently disappearing.

The thread-task-card API preserves service-level error codes. A missing card
read should return `404 task_card_not_found`; wrong-thread actions should return
`403`; settled-card actions should return `409`. If these appear as a generic
500, the route error wrapper has regressed and the browser may show an
ambiguous failure instead of a bounded task-card diagnostic.

For source-thread direct task-card creation through
`/api/threads/:sourceThreadId/task-cards`, target resolution is intentionally
stricter than the manual pending-card API. Exact `targetThreadId` is the
thread identity and may point to any normal non-archived thread. Exact
`targetThreadTitle` is accepted only when it uniquely matches one visible
deliverable target; duplicate titles fail with `409 target_thread_title_ambiguous`.
`targetCwd` / `targetWorkspace` are workspace hints, not identity, and are
accepted only when exactly one visible deliverable thread owns that cwd. If
several threads share the cwd, creation fails with
`409 target_workspace_ambiguous` and bounded candidate metadata instead of
choosing a thread. `400 target_thread_self` means the caller tried to send a
card to the same source thread. `409 target_thread_archived` means the target
is archived, deleted, or otherwise not deliverable. `404 target_thread_not_visible`
means the id/title/cwd is not currently deliverable. Dynamic tool calls and
`scripts/create-thread-task-card.js` share this same guard.

## `#` Task-card Command Does Not Parse

Leading non-empty `#` commands are reserved for cross-thread task-card
drafting. Bare `#` remains empty and should not create a card. Plain `# ...`
defaults to a manual one-off card; `#自由协作 ...` remains supported and defaults
to autonomous collaboration unless the command explicitly asks for manual mode.

Current behavior:

- bare `#` is empty and does not enter the task-card send path;
- `#` task-card commands do not support attachments yet;
- the browser sends a bounded draft request to the current Codex thread;
- the model must return a bounded draft block with visible `targetThreadIds`,
  or an empty target list plus an error.

Working examples:

```text
# 发给 Finance Review：请核验 5 月结账映射
# 让 Hermes 05-26 处理插件刷新联动
#自由协作 请让线程「Hermes 发布检查」确认插件通知回执是否已入库
```

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

## Compression Continuation Has No Visible Progress

When the user presses `压缩续接` and confirms with `继续`, clients after
`codex-mobile-shell-v606` keep the in-app dialog visible, disable the action
buttons, and show the current continuation step until the job finishes or
fails. The client should also emit bounded events:
`continuation_start_requested`, `continuation_job_created`,
`continuation_job_poll`, and either `continuation_job_done` or
`continuation_job_failed`.

If the user reports that nothing happened, first check client events for
`continuation_start_requested`. Absence of that event means the frontend did
not enter the confirmed submit path. If it is present but no
`continuation_job_created` follows, inspect the `POST /api/thread-continuations`
request. If a job id is present, inspect `/api/thread-continuations/:id` and the
server `[continuation]` progress logs.

## Hermes Plugin Seems To Reload Without Explanation

When Mobile Web sends `codex-mobile.plugin.refresh_required` to Hermes, the
current iframe should first show an in-app refresh notice such as "Refreshing
plugin page..." so the user can distinguish a deliberate host-driven reload from
an unexplained crash/reload. If the iframe reloads with no visible notice, the
browser build is stale or the refresh-required path regressed.

If the same phone behaves differently against the Windows-hosted Hermes Web App
and the Mac-hosted Hermes Web App, treat it as a host deployment/configuration
difference first. Check the Hermes host shell version in `index.html` /
`service-worker.js`, then check whether the host accepts the actual current
iframe `src` origin for `codex-mobile.plugin.navigation`. A host-side origin
rejection can make thread-detail right-swipe exit to the Hermes plugin context
page and can also trigger the 30-second launch-health iframe refresh.

On Mac production, do this check against the active LaunchDaemon working
directory, not only the `xuxin` user's source checkout. `com.hermesmobile.listener`
may run as `hermes-host` from `/Users/hermes-host/HermesMobile/app`; deploying a
host bridge fix only to `/Users/xuxin/HermesMobile/app/public` leaves the active
host on the old shell. Verify with:

```bash
launchctl print system/com.hermesmobile.listener | grep -E 'working directory|pid ='
curl -sS http://127.0.0.1:8797/ | grep -o 'data-client-version="[^"]*"'
curl -sS http://127.0.0.1:8797/service-worker.js | grep HERMES_SW_VERSION
curl -sS http://127.0.0.1:8797/app-embedded-plugin-ui.js | shasum -a 256
curl -sS http://127.0.0.1:8797/app-embedded-plugin-ui.js | grep embeddedPluginCurrentFrameOrigin
```

Do not trust the host static version string alone for this symptom. A Mac host
can advertise the same version as Windows while serving an older
`app-embedded-plugin-ui.js` from the active `/Users/hermes-host` daemon
directory. The working host bridge accepts the exact current iframe `src`
origin through `embeddedPluginCurrentFrameOrigin(def)`; without that function,
the host can reject `codex-mobile.plugin.navigation`, never learn
`canGoBack:true`, and let right-swipe escape to Hermes Mobile instead of asking
Codex to return to its embedded primary page.

## Shared-Chain Restart Stops 8787 But Mobile Web Does Not Come Back

Do not treat "the restart command was sent" or "the old Node listener exited" as
proof that Mobile Web is healthy again. The success condition is stricter:

- a new `8787` listener exists; and
- `/api/public-config` is reachable again.

If either check is missing, Mobile Web should be treated as down even if a
restart script or detached PowerShell command was already launched.

On Windows system-task deployments, a restart response with
`mode=windows-scheduled-task-bootstrap` means the short PowerShell bootstrap
created and started the separate helper task; it does not mean the main listener
has already restarted. Confirm that
`%USERPROFILE%\.codex-mobile-web\shared-chain-restart-bootstrap.log` records
helper task creation, that
`%USERPROFILE%\.codex-mobile-web\shared-chain-restart.log` receives a new
timestamp, and that `Get-ScheduledTaskInfo -TaskName "Codex Mobile Web"` shows a
new `LastRunTime`. Current builds register a short-lived `SYSTEM` helper task
named `Codex Mobile Web Restart Helper` so the real restart helper is not killed
when it stops the `Codex Mobile Web` scheduled task. If the API returns
`ok=true` but the logs and task time do not move, inspect
`adapters/shared-chain-restart-service.js` and run:

```powershell
node --test test\shared-chain-restart-service.test.js test\shared-chain-restart-script.test.js
```

Before the restart request is sent, current browser builds should show an
in-app confirmation panel instead of a native `window.confirm()`. The panel
checks `/api/threads?limit=200&archived=false` and lists running sessions that
may be interrupted. If the panel is missing or does not show running-session
risk, verify that the open client loaded the current `clientBuildId` and run:

```powershell
node --test test\manual-restart-ui.test.js test\mobile-viewport.test.js
```

## Windows Startup Before User Login

The normal Windows startup task uses `AtLogOn` with `LogonType=Interactive`, so
it starts only after the target user logs in and may stop on sign-out. For
startup before login or survival after sign-out, install the same task name with
`-RunAsSystem` from an elevated PowerShell session. It should show
`AtStartup`, `UserId=SYSTEM`, and `LogonType=ServiceAccount`:

```powershell
Get-ScheduledTask -TaskName "Codex Mobile Web" |
  Select-Object TaskName,State,@{n="UserId";e={$_.Principal.UserId}},@{n="LogonType";e={$_.Principal.LogonType}}
```

Even in LocalSystem mode, the task must pass `-UserProfilePath` for the target
Windows user. The windowless launcher maps `USERPROFILE`, `HOME`, `APPDATA`,
`LOCALAPPDATA`, `TEMP`, and `TMP` back to that profile before reading
`.codex-mobile-web`, `codex-profiles.json`, profile Codex homes, or the
installed Codex binary under `AppData\Local\OpenAI\Codex\bin`. If diagnostics
show paths under `C:\Windows\System32\config\systemprofile`, treat that as a
startup-wrapper regression.

Self-update is not a separate service path. After a fast-forward update, the
Node listener exits and the same hidden windowless supervisor restarts it. A
LocalSystem deployment therefore requires both the system scheduled task and the
target-user environment mapping; otherwise the restart may come back with the
wrong Codex binary, empty runtime state, or Git safe-directory errors.

## Public PR Prompt Targets The Wrong Thread

Public-PR review preparation must not reuse an arbitrary currently open thread
or an invisible production deployment directory. Current builds should first
resolve a visible review workspace: use `/api/public-config.workspacePath` when
that path is visible to Codex Desktop, otherwise use a visible workspace with
the same basename, such as resolving
`/Users/hermes-host/HermesMobile/plugins/codex-mobile-web` to
`/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web`.

After resolving the workspace, current builds should reuse a same-workspace
thread titled `Codex Mobile Public PR`; if no matching thread exists, they
route the generated review text into a new-thread draft for that resolved
workspace and send that fixed title to `/api/threads/new-message`. If the
prompt still lands inside an unrelated Agent/Hermes thread or the new-thread
send returns `Workspace is not visible in Codex Desktop`, the browser build is
stale or the client never loaded the workspace list needed for resolution.

## Repeated New Version Prompt

The visible "New version" prompt should be driven by comparable app-shell
identity, not by every static-file hash change. Check:

```powershell
Invoke-RestMethod http://127.0.0.1:8787/api/public-config |
  Select-Object clientBuildId,shellCacheName,buildId
```

If the open browser has an older `CLIENT_BUILD_ID` than
`clientBuildId`/`shellCacheName`, one prompt is expected. After the browser loads
the newer shell, later asset-only `buildId` changes should be silent. If prompts
continue after the loaded shell and server `clientBuildId` match, inspect
`public/app.js` `checkPageRefreshAvailability()` and verify asset-only drift
still returns after updating `state.serverAssetBuildId` without setting
`state.pageRefreshAvailable`.

## Windows Shows A Codex Console Window

The shared app-server chain has three possible visible-window sources:

- the user-facing launcher host; and
- the `CODEX_CLI_PATH` shim that Codex Desktop starts when it needs an
  app-server process; and
- a Mobile-owned `codex app-server` process that accidentally inherited
  Desktop bridge environment variables, then starts CLI tool subprocesses
  through the shim.

Desktop shortcuts should target `wscript.exe` with
`start-codex-desktop-shared-hidden.vbs`, or another hidden host. Do not point a
desktop shortcut at `start-codex-desktop-*.cmd`; a `.cmd` wrapper can open a
command window before it reaches hidden PowerShell.

The mux shim must be compiled as a Windows subsystem executable:

```powershell
Select-String .\start-codex-desktop-shared.ps1 -Pattern "/target:winexe"
```

The current launcher builds `codex-app-server-mux-win.exe` by default. This
avoids rebuild failures when older Desktop-spawned `codex-app-server-mux.exe`
processes are still running. Rebuild through the shared launcher without
starting Desktop:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-codex-desktop-shared.ps1 -PrintOnly
```

Existing Desktop-spawned shim processes keep their original executable image.
Quit/relaunch Codex Desktop through the hidden shortcut after rebuilding so new
app-server helper processes use the windowless shim. Current harness coverage is
`node --test test\desktop-profile-launcher.test.js`.

If Codex Desktop is not running but console windows still flash, inspect the
Mobile app-server process tree before changing Desktop shortcuts:

```powershell
Get-CimInstance Win32_Process |
  Where-Object { $_.CommandLine -match 'codex-app-server-mux|codex.exe|node_repl|cmd.exe|powershell.exe' } |
  Select-Object ProcessId,ParentProcessId,Name,CommandLine
```

Seeing `node_repl.exe` or other CLI tool children under Mobile's
`codex.exe app-server`, followed by `codex-app-server-mux.exe app-server
--listen stdio://`, indicates leaked `CODEX_CLI_PATH` / `CODEX_MUX_*` state.
Mobile launchers and the mux/server child-spawn paths must clear those variables
before starting the real CLI child. The fix applies on the next shared-chain
restart; existing running CLI children keep their original environment.

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

Current expected behavior: inherited runtime settings should read `model` and
`reasoning_effort` from rollout `turn_context`, then state DB/app-server thread
metadata, then Codex config defaults. Continuation creation applies inherited
model to `thread/start` and inherited model/effort to bootstrap `turn/start`.
Cross-thread task-card approval uses the same target-thread inheritance before
injecting its real target `turn/start`.

If a continuation thread appears with `name=null`, the thread id as preview, or
the bootstrap prompt as its title after refreshing/restarting Mobile Web:

1. Check the new rollout file exists under the active `%CODEX_HOME%\sessions`
   tree and that `session_meta.payload.originator` is `codex-mobile-web`.
2. Check `%CODEX_HOME%\session_index.jsonl` has a tail entry for the new thread
   id with the intended `thread_name`.
3. Check the workspace-local `.agent-context/thread-handoffs/index.jsonl` for
   source/new thread lineage. The index is workspace-local, so inspect the
   target workspace, not only the Mobile Web repository.
4. Treat app-server title RPCs as best-effort. `tryUpdateThreadTitle()` may
   return false on older app-server builds, but Mobile Web should still recover
   the intended title from `session_index.jsonl` during fallback list reads.

If manual rename shows
`thread-store internal error: thread metadata unavailable before name update`,
the thread exists but app-server has not materialized its metadata row yet. If
it shows `database disk image is malformed`, the app-server title update is
hitting the known corrupt `state_5.sqlite` path. Current Mobile Web builds
treat both as recoverable rename failures: the requested name is stored in
`session_index.jsonl`, the short-lived in-memory summary is updated, and
`/api/threads` should return `titleUpdated=false` with `titleIndexed=true`
instead of failing the save. This does not repair the SQLite database; it only
keeps the Mobile thread list title usable through the fallback index.

If a user changes model/effort while the current thread is still actively
running, a follow-up message may be sent as `turn/steer`. That path steers the
already-started turn and cannot change its model or reasoning effort; wait for a
new turn when verifying runtime-setting changes.

If model/effort/Fast changes disappear after closing and reopening Mobile Web,
or immediately after pressing Send, inspect the browser draft map
`codexMobileDraftsV1`. Runtime-only drafts are valid: `model`, `effort`,
`permissionMode`, or `fastMode: true` should keep a thread-keyed draft even when
`text` is empty and there are no attachments. Fast is intentionally a
thread-local tag; the retired global `codexMobileCodexFastMode` flag should not
restore Fast after `codex-mobile-shell-v377`. Existing-thread send success should
clear only text and attachments, then write the runtime-only draft back while
the new turn is starting. New-thread send success should move the selected
runtime values from the workspace draft to a thread-keyed runtime draft once the
new thread id is known.

If a continuation starts with unexpectedly high input tokens, inspect the bootstrap size and source handoff handling:

- Bootstrap should be bounded by `CODEX_MOBILE_CONTINUATION_BOOTSTRAP_CHARS` default `52000`.
- Source handoff should be listed by file path with a small excerpt, not pasted in full.
- Workspace handoff and prior lineage excerpts should stay bounded.
- Durable project facts should move to `.agent-context` and `docs/`, not into a larger bootstrap prompt.

If a continuation thread does not show the source thread's unfinished goal:

1. Check the continuation job/result for `sourceGoalMigration`. A skipped goal
   should report a bounded reason such as `no-goal`, `completed`,
   `status-not-migratable`, `unsupported`, or `set-target-error`.
2. Check the workspace `.agent-context/thread-handoffs/index.jsonl` entry for
   `sourceGoalMigrated` and `sourceGoalMigrationError`. The lineage entry must
   not include the goal objective text.
3. Only `active`, `blocked`, and legacy `paused` source goals are copied.
   Completed, budget-limited, usage-limited, missing, or unsupported goals are
   intentionally skipped.
4. The new thread gets the same objective and remaining token budget, not the
   source thread's spent `tokens_used` / `time_used_seconds` counters.
5. If the source goal was `active`, Mobile Web best-effort freezes it to
   `blocked` after setting the new thread goal. A non-empty `sourceFreezeError`
   means the new goal may have been created while the old active goal could not
   be frozen; inspect app-server goal RPC support before continuing work in both
   threads.

## Thread Goal Display

If a CLI/Desktop goal does not appear in Mobile Web:

1. Confirm the active CLI app-server protocol includes `thread/goal/set`,
   `thread/goal/get`, `thread/goal/clear`, `thread/goal/updated`, and
   `thread/goal/cleared`. Goal creation requires Codex CLI/app-server 0.135.0
   or newer.
2. Inspect the active profile home reported by `/api/public-config`; Mobile Web
   reads `<CODEX_HOME>\goals_1.sqlite`, not an arbitrary default home.
3. Check whether the thread has a row in `goals_1.sqlite` `thread_goals`.
   Mobile Web reads this database only as fallback and must not write it.
4. Check the browser EventSource stream for `thread/goal/updated` or
   `thread/goal/cleared`. These notifications should update non-current list
   rows as well as the open thread detail card.
5. If sqlite is locked or missing, thread list/detail should still load without
   goals; wait for the CLI/runtime to release the lock, then refresh the list or
   reopen the thread.

If `/g` does not create a goal:

1. Confirm the composer text is exactly `/g` in an existing thread. The command
   opens a local dialog; it is not available from a new-thread draft.
2. In current shells, Enter inside the goal objective field submits the dialog
   and Shift+Enter inserts a newline. If Enter only inserts a newline, the
   browser is still running an older shell; accept the refresh prompt, hard
   refresh, or close/reopen the PWA/Hermes plugin frame.
3. Current shells allow objective text up to 4000 characters. The browser
   `maxlength`, the Mobile Web `thread/goal/set` proxy input normalization, and
   the `goals_1.sqlite` fallback display bound should stay aligned at that
   value so a long pasted goal does not shrink after submit or refresh.
4. Current shells also submit from explicit pointer/click handlers on the goal
   Send button rather than relying only on the browser's default form submit.
   Reopening `/g` should not prefill a completed old goal; only unfinished goal
   state is used as editable prefill. If an unfinished goal already exists, the
   dialog should also show Continue, Pause, and Cancel goal actions. Pause maps
   to app-server `blocked`; Continue clears and re-sets a blocked goal to make
   it active again; Cancel goal calls `thread/goal/clear`.
5. After the dialog submit, the frontend should log a bounded
   `goal_request_start` client event before sending
   `POST /api/threads/:id/goal`. Mobile Web forwards this to app-server
   `thread/goal/set`; it does not write `goals_1.sqlite` directly.
6. Goal action buttons should log `goal_action_start` and call
   `POST /api/threads/:id/goal/actions`. If actions are missing, the browser is
   still on an older PWA shell; refresh to the shell containing
   `codex-mobile-shell-v214` or newer.
7. If `goal_request_start` and `goal_request_success` appear but no new goal
   turn starts, inspect the current thread's `thread_goals.status`. A completed
   old goal can cause app-server `thread/goal/set` to update the completed row
   instead of starting a new goal. Current Mobile Web clears a completed goal
   through app-server `thread/goal/clear` before retrying `thread/goal/set`.
8. If the response says the running app-server does not support goal set, check
   the real `codex.exe` used by the mux/listener. On Windows the launchers
   should prefer the newest installed `%LOCALAPPDATA%\OpenAI\Codex\bin\*\codex.exe`
   over the older `%USERPROFILE%\.codex-mobile-web\codex.exe` runtime copy when
   `-CodexExe` / `CODEX_MOBILE_CODEX_EXE` is not explicit.
9. Inspect `%USERPROFILE%\.codex\app-server-mux\endpoint.json`. Current
   endpoints should include `codexExe` and `capabilities.threadGoalRpc=true`.
   If `codexExe` is missing or still points at
   `%USERPROFILE%\.codex-mobile-web\codex.exe`, remove the stale endpoint by
   restarting the shared chain so the windowless launcher can start a fresh mux.
10. If the route succeeds but the card does not appear, first confirm the browser
   shell is current. Current frontend builds synthesize a submitted-goal card
   from the just-entered objective/token budget when the app-server accepts
   `thread/goal/set` but does not return a public goal object in the immediate
   response.
11. If a current shell still does not show the card, inspect the EventSource
   stream for `thread/goal/updated`, then refresh the thread detail/list so the
   sqlite fallback can decorate `thread.goal`.

If goal token progress appears far from Usage cards or rollout totals:

1. The goal dialog/card displays `thread_goals.tokens_used` as budget tokens.
   This value comes from the Codex app-server goal store and is surfaced through
   `thread/goal/get`, `thread/goal/updated`, or the sqlite fallback.
2. Do not compare it directly with rollout raw `totalTokens`. Current observed
   CLI behavior tracks a budget-consumable basis that is close to non-cached
   input plus output, while rollout raw totals include cached input events that
   can be much larger.
3. To diagnose a mismatch, compare the Mobile API goal object, the
   `goals_1.sqlite` row, and the rollout `token_count` events over the goal's
   `created_at_ms` window. Treat this as a read-only check; Mobile Web must not
   repair `tokens_used` by writing sqlite directly.

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
right-swipe instead returns directly to Hermes Mobile, check whether the thread
detail page published `canGoBack:true` immediately after selecting
`currentThreadId`; this must happen while the detail page is still loading, not
only after the read completes. Also check the iframe's postMessage
`targetOrigin`: when Hermes serves Codex through the same-origin plugin proxy,
Codex must prefer the live `window.parent.location.origin` over the launch
session's older `hermes_origin`. A stale target such as
`https://old-hermes.example.com` while the actual parent is
`https://new-hermes.example.com` silently drops
`codex-mobile.plugin.navigation`, leaving the host with `canGoBack:false` and
making right-swipe fall through to the outer plugin return. If
right-swipe instead opens Codex's standalone initial Workspace page, check the
`hermes.plugin.back` handler: thread-page back must clear only the selected
thread detail, not leave the iframe in the standalone home route. If the primary
thread-switcher/settings page is still shown as a drawer or closes back to the
thread, check the `embed-hermes-primary` class and CSS rules. When file preview,
rename/action dialog, or subagent panel is already open, the same back event
should close that transient layer before page-level back is applied. Hermes
should use postMessage only; it must not inspect Codex DOM or call internal
Codex route functions.

If this only reproduces on iOS/Mac-hosted Hermes while the Codex plugin and
Hermes host static files match the working Windows installation, check the
iframe-owned left-edge swipe guard in `public/app.js`. iOS may start the gesture
inside the iframe, so the Hermes host document may not receive the touchstart
sequence even though the iframe can still navigate. In that case the iframe must
handle the gesture locally when its own navigation message would report
`canGoBack:true`.

After `codex-mobile-shell-v563`, an iframe-owned `plugin-back-swipe` that is
suppressed by recent conversation scroll protection must still send a handled
back result to the host. The suppression means "Codex consumed this gesture but
did not navigate", not "Home AI may perform an outer back". If repeated
detail/list swipes can still escape directly to the host, inspect whether
`plugin_back_suppressed_recent_conversation_scroll` reports
`consumedInIframe:true` and whether the host honors
`codex-mobile.plugin.back_result.handled=true`.

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
- Completed/idle current threads also run a lightweight detail refresh on
  foreground resume. Do not skip this only because the thread is not running;
  otherwise a WebView that kept stale in-memory detail can miss the final
  receipt until the user exits and re-enters the thread.
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
`/api/threads` by requested limit before changing thread-detail code. Older
Windows-era builds kept the mobile default list page at 40 rows for performance,
but the current Mac/Home AI embedded contract uses a wider All-workspaces entry
window: the frontend requests `THREAD_LIST_PAGE_LIMIT = 200`, while the server
uses a bounded 500-row app-server read before visibility/workspace merge. This
keeps non-archived, non-recent implementation threads visible in All workspaces
instead of requiring the user to activate a workspace-filtered thread before it
appears. If this path becomes slow, optimize the authoritative read/merge/cache
path rather than shrinking the All entry window back to a recent-only slice.

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
  directories. `CODEX_MOBILE_WORKSPACE_DEFAULT_CREATE_ROOT` can select the
  default parent among those allowed roots. If both are unset and Mobile Web is
  running from a `HermesMobileDev` development checkout, it uses that
  development root before falling back to the user's Documents folder and then
  the user profile folder.
- `%USERPROFILE%\.codex-mobile-web\workspace-registry.json` should contain only
  bounded metadata for Mobile Web-created workspaces: cwd, label, parent,
  source, and timestamps.
- `GET /api/workspaces` should include the created cwd with `source:"mobile"`.
- `visibleWorkspaceRoots()` should merge the registry service list before the
  new-thread route checks workspace visibility.
- If Codex Desktop must also show Mobile-created workspaces, confirm the
  listener was started with `CODEX_MOBILE_SYNC_DESKTOP_WORKSPACES=1`. The
  created cwd should be stored as a canonical real path, and the same root
  should be present in `electron-saved-workspace-roots`, `project-order`, and
  `active-workspace-roots` in the relevant `.codex-global-state.json` files.

Do not fix routine creation failures by editing `.codex\.codex-global-state.json`
manually. Use the Mobile Web registry route or Codex/Desktop workspace
selection paths, and back up global-state files before any explicit operational
repair.

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
- On macOS system LaunchDaemon deployments, `launchctl print
  system/<label>` and the LaunchDaemon plist should also show the selected
  `CODEX_HOME` and `<CODEX_HOME>/app-server-mux/endpoint.json`. If the API
  status is correct but those static values still point at the previous
  profile, inspect `adapters/shared-chain-restart-service.js`; the macOS
  shared-chain restart must have received the explicit profile `codexHome`.
- The restart log should show the same `codexHome=...` value and the mux
  endpoint should be under that profile's
  `<CODEX_HOME>\app-server-mux\endpoint.json`, not always the default
  `%USERPROFILE%\.codex` endpoint.
- If `/api/status.codexHome` matches the selected profile but live quota still
  follows another account, check the managed `codex app-server` child
  environment. The child must be spawned with the resolved active `CODEX_HOME`,
  not the stale service or LaunchDaemon `CODEX_HOME` that the Node listener
  itself ignored.
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
  `.codex-global-state.json`, `state_5.sqlite*`, `goals_1.sqlite*`,
  `session_index.jsonl`, `sessions/`, and `archived_sessions/`.
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
Get-Item (Join-Path $env:USERPROFILE ".codex-homes\previous\goals_1.sqlite") | Format-List FullName,LinkType,Target
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
- Managed-child app-server launches must pass that resolved `CODEX_HOME` into
  the child process. Otherwise `/api/status.codexHome` can look correct while
  live quota is still read through the stale inherited account.
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
  `thread.threadTaskCards`, including fallback `thread/turns/list` mode.
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
