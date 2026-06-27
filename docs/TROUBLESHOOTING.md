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
| Same submitted user message appears twice while the turn is thinking | Inspect whether one item is a browser `local-user-*` echo and the other is a server `mux-user-*` or durable `userMessage` echo for the same `clientSubmissionId`. Clients after `codex-mobile-shell-v396` merge these at the thread-normalization layer using submission id, deterministic mux id suffix, and content signature; if duplication remains, compare `/api/threads/:id?mode=recent` against the open shell before adding render-layer filtering. |
| Thread looks stuck | rollout size/mtime, pending approvals, live command/tool process, latest turn status |
| Old command appears running | latest turn id vs raw operation fallback call id/turn id, app version includes raw-operation fix |
| PWA still shows old UI | `/api/public-config.clientBuildId`, browser shell cache, service worker cache name |
| Refresh prompt repeats after a static bump | Compare `/api/public-config.clientBuildId` and `shellCacheName` with served `/app.js` and `/sw.js`; current builds read shell metadata on each config request and do not use plain `version` for this comparison |
| Push missing | HTTPS/Tailscale access, VAPID files, subscription count, sub-agent suppression |
| Push says turn ended but no final reply appears | rollout `task_complete.last_agent_message`, completion-push no-final-message guard |
| Turn accepts a message then ends with no visible reply | inspect rollout for `task_complete.last_agent_message: null` and no scoped `user_message` / `agent_message`; current detail projection renders a `turnDiagnostic` item with code `runtime_completed_without_response` rather than fabricating an assistant reply |
| First open after completion lacks the latest receipt | `/api/threads/:id?mode=recent` read mode, whether the latest rollout EOF line is a complete `task_complete` JSON object without a trailing newline, and whether enrichment index exposes a provisional entry |
| Same turn shows two final receipts and only one has Usage | Compare `/api/threads/:id?mode=recent` service projection against the open client shell. If the API has one `agentMessage` plus one `turnUsageSummary` but the page shows two receipts, the failure layer is browser V4 local-visible merge; current clients after `codex-mobile-shell-v390` drop local-only live receipts once a completed server turn has an authoritative receipt. |
| Final receipt appears, disappears, then returns one line shorter | Compare the live active receipt text and completed service projection receipt text for the same turn, then inspect `/api/client-events` for `thread_refresh_ms.locallyPatchedDetail`. Clients after `codex-mobile-shell-v391` preserve same-prefix completed receipt identity; clients after `codex-mobile-shell-v392` also keep post-completion refreshes on the local item patch path when only receipt/Usage items change. |
| Bottom Command/status row disappears during a running turn | Check viewport first. Wide clients after `codex-mobile-shell-v394` keep the one-line dock stable during reasoning-only active turns. Phone-width clients after `codex-mobile-shell-v395` intentionally do not reserve a bottom row: pure reasoning is shown only by the top-right timer, and real command/file/tool/search activity appears as a floating operation bubble above the composer with short summary and elapsed time. Clients after `codex-mobile-shell-v402` keep the last same-thread operation bubble visible for at least 500ms even when the operation finishes before the next full thread render, and the expiry refresh updates only the dock instead of rerendering the conversation. Clients after `codex-mobile-shell-v403` keep a small same-thread recall dot after that temporary bubble disappears; tap it to reopen the last operation detail sheet without restoring a permanent bottom row. Clients after `codex-mobile-shell-v404` align that recall dot with the lower-right scroll controls using the same 36px size and right edge. Clients after `codex-mobile-shell-v405` keep those dwell/pinned/recall decisions in `public/live-operation-dock-state.js`; regressions should be tested there before adding render fallbacks. |
| Command row has no detail on macOS | First inspect `/api/threads/:id?mode=recent`: if `commandExecution.command` is empty, the failure layer is server raw-operation projection from rollout `function_call.arguments`; current server code reads `command`/`cmd`/`shellCommand`/`shell_command` from object or JSON-string arguments. If the API has a non-empty command but the dock/bubble is blank, inspect the v394+ frontend `operationCommandText()` path. |
| Continuation fails because source thread cannot reply | continuation job progress `handoff-fallback`, generated `.agent-context/thread-handoffs/*.md` mode, `/api/status` profile/quota |
| Profile switch hides workspaces or threads | active `codexProfiles.activeCodexHome`, non-default profile shared-state links, `/api/threads?limit=10` |
| Quota chips show the previous account after switch | `/api/status.rateLimits`, browser quota localStorage, profile-switch cache clearing, shared `sessions/` quota fallback |
| Archived projectless thread reappears | session-index fallback, `archived_sessions`, `test/thread-archive.test.js` |
| After profile switch only a few workspaces or no threads appear | `/api/public-config.codexProfiles.activeCodexHome`, profile state links, and `state_5.sqlite` / `sessions` under the active home |
| Threads are visible but names/times stay stale | `/api/threads` row `name`/`updatedAt`, state DB `title`/`updated_at`, rollout file mtime, fallback merge tests |
| Large session first open is slow | On clients after `codex-mobile-shell-v495`, inspect `/api/client-events` `thread_detail_first_paint.serverTimings` and `performancePhase`. `warm-projection-cache` points away from rollout rebuild and toward network/DOM render, `warm-projection-partial` means `mode=recent` reused a memory-only current-window projection, `cold-turns-list-initial` means the first recent window was loaded from bounded app-server turns-list and should report `projectionSeedStatus=seeded-partial` when projection input exists, and `cold-thread-read` points at full app-server read/projection seed. If `projectionState=miss`, inspect `projectionMissReason` before changing cache behavior: `entry-missing` means no cache exists, `partial-not-allowed` means a partial window was correctly rejected for a full read, `static-signature-mismatch` / dynamic signature mismatch reasons point at invalid full-cache lifecycle, and `signature-unavailable` points at projection input/stat construction. Thread-list slowness should be checked through `thread_list_rendered.serverTimings` / `performancePhase`. `mobileInitialSource=warm-fallback-cache` means the first paint used the process fallback cache; `mobileInitialSource=fallback-baseline` with `appServerDeferredReason=cold-fallback-initial` means the first paint still had to build the local baseline but did not wait for app-server `thread/list`; `appServerDeferredReason=warm-fallback-initial` means even that local baseline was already warm. When cold, compare `fallbackStateDbCount`, `fallbackRolloutCount`, `fallbackSessionIndexCount`, `fallbackBaselineSourceCount`, `fallbackBaselineResultCount`, and fallback source timings before changing cache or prewarm behavior. If prewarm is completed but a larger same-scope first-paint request still reports `fallbackCacheDecision=miss-rebuild`, inspect `threadListFallbackPrewarm.sourceSnapshotLimit`, `lastSourceSnapshotLimit`, and request limit before blaming app-server: the final fallback cache is limit-scoped, while the source snapshot should be wide enough to rebuild large first-paint windows without rereading rollout tails. If a deferred/full follow-up is slow, inspect `appServerRequestLimit`, `appServerResponsePayloadBytes`, `appServerRpcMs`, and `appServerUnattributedMs` separately from first-paint fallback work. |
| Thread list is slow only after deploy/restart | Inspect `/api/threads` `mobileDiagnostics.threadListTimings.fallbackCachePersistentRestored` and `fallbackCacheDecision`, then `/api/public-config.threadListFallbackPrewarm`. A restored warm cache should show `fallbackCachePersistentRestored=true` on the first default list hit after restart. If the runtime cache file is missing or corrupt, the server treats it as a cold cache miss and rebuilds from the normal sources; do not classify that as a network timeout unless `appServerRpcTimedOut=true` or the request actually fails. |
| Active large thread still uses full `thread/read` | Inspect `thread_detail_first_paint.serverTimings.activeFullReadRequired`, `activeFullReadReason`, `activeOverlayAction`, and `activeOverlayReason`. `overlay-provider-unavailable` means the safe orchestration seam is present but no authoritative provider is wired yet. Other `require-full-read` reasons such as `assistant-delta-unknown`, `receipt-evidence-unknown`, `active-turn-mismatch`, or `non-authoritative-overlay-source` are intentional fail-closed outcomes and should not be bypassed with a client refresh or UI dedupe layer. |
| Running-thread indicator disappears | `/api/threads` row `status` and `rolloutSizeUpdatedAtMs`, rollout tail `task_started` / `task_complete`, `runningThreadIds`, stale browser shell |
| Thread detail shakes during streaming output | Client shell version v317+, `/api/client-events` `conversation_render_ms`, `thread_refresh_ms.skippedDetailRender`, `thread_refresh_ms.locallyPatchedDetail`, compact Command dock height, stale PWA shell |
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
```

The script reads the target user and runtime paths from
`/Library/LaunchDaemons/com.hermesmobile.plugin.codex-mobile.plist`, updates the
active Codex profile store plus the plist `CODEX_HOME`, bootstraps
`system/com.hermesmobile.plugin.codex-mobile`, and waits for
`/api/public-config`. It must not print access keys or raw auth tokens. Use
`--codex-home <path>` only when the host has selected an explicit configured
home path outside the normal profile ids.

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

If an active large thread spins for a long time but eventually renders, inspect
`mobileDiagnostics.threadDetailTimings.activeOverlayWindowMs`. A high first
sample followed by `activeOverlayWindowMs=0` on repeated reads means the detail
request had to synchronously build the `turns-list-active-overlay-window`
projection window from app-server `thread/turns/list`; it is different from an
RPC/network timeout because the request succeeds and then warms the cache.
The server schedules the same window build in the background after active
turn/status notifications and thread-list refreshes through
`thread-detail-active-window-prewarm-service`, so the preferred closure is to
verify prewarm scheduling and cache reuse rather than increasing the detail
timeout or adding a client loading fallback. Current servers also coalesce
foreground detail and background prewarm reads for the same thread/mode through
`thread-detail-active-window-read-coalescer-service`. If logs show
`turns_list_coalesced`, duplicate app-server work has been suppressed and the
remaining wait belongs to the single authoritative
`turns-list-active-overlay-window` read or earlier prewarm readiness. After
restart, the thread-list fallback prewarm should also schedule active-window
prewarm for active rows when it completes; if the first active detail open is
still cold after the fallback baseline has completed, inspect whether
`thread-list-prewarm:completed` produced an active-window prewarm result before
the detail request arrived.
If the active thread has a stale full projection whose stable identity still
matches, current servers can downgrade that full cache to a history-only
`turns-list-active-overlay-window` by omitting the currently growing active
turn. Ordinary detail lookups still reject the same signature mismatch. If a
post-restart or active-growth sample still spends seconds in app-server
`turns-list-active-overlay-window`, confirm whether the projection cache was
missing entirely, the stable identity changed, or the lookup lacked
`activeOverlay=true` plus `omitActiveTurnId`; those cases remain authoritative
app-server reads rather than client timeouts.
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
`omittedAssistantItems`. A high assistant-progress count with a large response
body points at server detail payload size or browser DOM merge pressure; do not
fix that by repeated client refreshes or by loosening the timeout. The default
detail response keeps completed turns receipt-only and active turns on a bounded
recent assistant tail. When a thread has a known current active turn id, only
that matching turn should use the active budget; if
`mobileDetailResponseBudget.staleActiveTurnCount` is non-zero, older
active-looking turns were deliberately downgraded for response shaping. When
`progressiveActiveBudgetApplied=true`, compare
`progressiveActiveBudgetReason`, `activeProgressiveItemThreshold`,
`activeProgressiveByteThreshold`,
`activeProgressiveThreadByteThreshold`,
`progressiveActiveTextChars`, `truncatedActiveTextItems`,
`omittedActiveTextChars`,
`progressiveActiveTurnOriginalBytes`, `progressiveActiveOriginalBytes`,
`configuredActive*Items`, and the effective `active*Items` fields before
changing visible-item policy. Current servers also expose
`progressiveVisibleItemCeiling`, `progressiveVisibleItemBudgetApplied`,
`progressiveVisibleItemOriginalCount`, `progressiveVisibleItemRetainedCount`,
`omittedVisibleItems`, and per-turn `mobileVisibleItemBudget` when progressive
active pressure still leaves too many first-paint visible items after per-type
compaction. That ceiling should remove older operation/reasoning rows first;
user messages, images, Usage rows, diagnostics, and retained final receipts
should stay visible. Reasons ending in `-byte-pressure` mean the request was
successful but too large, not that the network or app-server RPC timed out.
If item counts are already bounded but the payload remains heavy, inspect the
second-stage first-paint byte fields:
`progressiveFirstPaintThreadByteCeiling`,
`progressiveFirstPaintBytesBeforeTextBudget`,
`progressiveFirstPaintBytesAfterTextBudget`,
`progressiveCompletedTextBudgetApplied`,
`progressiveCompletedTextBudgetReason`,
`progressiveCompletedTextChars`, `truncatedCompletedTextItems`, and
`omittedCompletedTextChars`. Those fields mean non-current completed
assistant/reasoning receipts were reduced to first-paint previews marked with
`mobileFirstPaintTextBudget`; the current active turn still uses
`mobileActiveTextBudget`.
On-demand expansion of omitted historical assistant progress is a separate
route/API feature, not part of the default first paint.

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
  The HTTP detail response applies the same assistant/plan budget after
  projection/read orchestration: active turns keep a bounded recent assistant
  tail, completed turns keep the latest assistant/plan receipt, and
  `mobileOmittedAssistantItemCount` / `mobileDetailResponseBudget` record the
  omitted progress-row count. If `progressiveActiveBudgetApplied=true`, retained
  active assistant/reasoning text fields may also carry
  `mobileActiveTextBudget`; that is a pressure-triggered first-paint preview,
  not a generic completed-turn truncation rule.
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
  after the full deferred receipt is merged. If `/api/threads/<id>` already has
  `turnUsageSummary` but the just-completed browser view does not, inspect the
  post-completion refresh queue; completion should schedule both an immediate
  and a delayed full detail refresh.
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
- Did an ordinary no-search default thread-list request wait on app-server even
  though the process fallback cache was warm? Current server behavior should
  report `appServerDeferredReason=warm-fallback-default`,
  `appServerDeferredInitialReason=default-warm-cache`,
  `mobileDeferredAppServer=true`, and `fallbackCacheDecision=compatible-hit` for
  that path. If those fields are absent, check
  `CODEX_MOBILE_THREAD_LIST_DEFAULT_WARM_FALLBACK`, the request filter shape,
  and whether the process cache was actually warm. A miss on this ordinary
  default path intentionally falls through to app-server instead of building a
  cold fallback baseline.
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
`readSessionIndexFallback()` in `server.js`. If a completed UUID-only fallback
row appears and detail cannot open it, inspect `readRolloutSessionFallbackThreadFromFile()`,
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
stricter than the manual pending-card API. Exact `targetThreadId` and exact
`targetThreadTitle` are thread identity and may point to any normal
non-archived thread, even when several threads share the same cwd/workspace.
`400 target_thread_self` means the caller tried to send a card to the same
source thread. `409 target_thread_archived` means the target is archived,
deleted, or otherwise not deliverable. `404 target_thread_not_visible` means
the id/title/cwd is not currently deliverable. `targetCwd` /
`targetWorkspace` are fuzzy workspace targets and choose a current visible
thread for that workspace. Dynamic tool calls and
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
