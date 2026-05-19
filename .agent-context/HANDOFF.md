# HANDOFF

## 2026-05-15 Web Push SQLite Discovery Fix

- User report:
  - After the earlier Sub Agent Web Push suppression, the phone still received a completion Web Push for a Sub Agent thread.
  - Screenshot notification title showed a raw shortened thread id (`019e2afe...`) rather than the human title, suggesting the running server could not read local SQLite thread metadata.
- Evidence:
  - The notified thread was `019e2afe-9476-7533-9723-b807b0d57844`.
  - Interactive SQLite query showed it is definitely a Sub Agent child thread:
    - `threads.agent_nickname = Hegel`
    - `threads.agent_role = explorer`
    - `thread_spawn_edges.child_thread_id = 019e2afe-9476-7533-9723-b807b0d57844`
    - parent thread id `019e29d5-60ea-7723-99ba-ff50c3be067e`
  - The machine's working SQLite binary is under the user-local WinGet Platform Tools path:
    - `%USERPROFILE%\AppData\Local\Microsoft\WinGet\Packages\Google.PlatformTools_Microsoft.Winget.Source_8wekyb3d8bbwe\platform-tools\sqlite3.exe`
  - Hidden/scheduled Node listeners can have a PATH that differs from interactive PowerShell, so direct `spawnSync("sqlite3", ...)` can fail even when `sqlite3` works interactively.
- Local fix:
  - Added `adapters/sqlite-cli.js`.
  - The adapter honors `CODEX_MOBILE_SQLITE3_EXE`, then common user-local Platform Tools / WinGet `sqlite3.exe` paths, then falls back to `sqlite3` on PATH.
  - `server.js` now uses `runSqliteJson()` for all `state_5.sqlite` reads instead of direct `spawnSync("sqlite3", ...)`.
  - Updated `package.json` `check` script to syntax-check the new adapter.
  - Updated tests to assert server SQLite reads go through the adapter and that WinGet Platform Tools discovery is covered.
  - Updated `README.md` and `.agent-context/PROJECT_CONTEXT.md` to document `CODEX_MOBILE_SQLITE3_EXE` and the hidden/scheduled PATH issue.
- Runtime activation:
  - Restarted only the 8787 `server.js` Node listener.
  - Old listener PID `61000`; new listener PID `16580`.
  - `GET http://127.0.0.1:8787/api/public-config` returned `clientBuildId: 0.1.8|codex-mobile-shell-v58`.
  - Authenticated `GET /api/threads?limit=200` returned `containsSubagent=0` for `019e2afe-9476-7533-9723-b807b0d57844` and `agentLike=0`.
  - Direct adapter verification read the same Sub Agent row using the WinGet Platform Tools `sqlite3.exe` path.
- Validation:
  - `npm.cmd test` passed with 73/73 tests.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed, with only Windows LF-to-CRLF working-copy notices.
- Status:
  - Private workspace local changes only; not committed, not pushed, and not synced to public.

## 2026-05-15 Live Subagent Count Fix

- User report:
  - The Subagent panel could show `当前进行中 · 0 个` even while Sub Agents were visibly present/running.
- Cause:
  - The panel filtered `collabAgentToolCall` rows by the row's own status (`running` / `queued` only).
  - In current app-server events, a spawn-call row can become `closed` / `completed` after the child Agent is spawned, while the child Agent is still running as part of the parent live turn. Treating that row status as the child Agent lifecycle hid live Subagents.
- Local fix:
  - `public/app.js` now counts all `collabAgentToolCall` rows in the current live turn.
  - For current live-turn rows, `completed` / `closed` / `unknown` spawn-call statuses render as running/current instead of being filtered out.
  - Historical turns are still not scanned; without a live turn, the panel only falls back to active rows from the latest turn.
  - `public/sw.js` cache and `public/app.js` `CLIENT_BUILD_ID` bumped to `codex-mobile-shell-v58`.
  - Updated `test/collab-agent-render.test.js`, `test/mobile-viewport.test.js`, `README.md`, and `.agent-context/PROJECT_CONTEXT.md`.
- Validation:
  - `npm.cmd test` passed with 72/72 tests.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed, with only Windows LF-to-CRLF working-copy notices.
  - `GET http://127.0.0.1:8787/api/public-config` returned `clientBuildId: 0.1.8|codex-mobile-shell-v58` and `shellCacheName: codex-mobile-shell-v58`.
  - Direct HTTP checks for `/`, `/index.html`, `/styles.css`, `/app.js`, and `/sw.js` returned `200`.
- Status:
  - Private workspace local changes only; not committed, not pushed, and not synced to public.

## 2026-05-15 Page Refresh App-Shell Preflight

- User report:
  - After the page showed the new-version refresh prompt and the user clicked it, iOS/PWA could load an unstyled/half-updated page: static HTML was visible, CSS was not applied, and the displayed version/status looked stale.
  - User requirement: show/act on the refresh prompt only after all page resources are updated.
- Cause:
  - The previous `refreshPageForNewBuild()` updated the service worker best-effort, deleted every `codex-mobile-shell-*` cache, and immediately reloaded.
  - If the new HTML/CSS/JS/module/icon/service-worker assets were not all reachable and present in the target app-shell cache, the reload could land on a mixed or uncached app shell.
- Local fix:
  - `public/app.js` now defines `PAGE_SHELL_ASSETS` for the complete app shell: `/`, `/index.html`, `/styles.css`, frontend modules, `/app.js`, `/manifest.json`, `/sw.js`, and icons.
  - `checkPageRefreshAvailability()` fetches `/api/public-config`, then fetches all shell assets with `cache: "no-store"` and build cache-busting, validates critical HTML/CSS/JS/SW content, and populates the target `shellCacheName` cache before setting `pageRefreshAvailable=true`.
  - `refreshPageForNewBuild()` repeats that preflight before reloading. It prunes old `codex-mobile-shell-*` caches only after the target cache is populated; if preflight fails, it does not delete old caches and does not reload, then retries later.
  - `public/sw.js` cache and `public/app.js` `CLIENT_BUILD_ID` bumped to `codex-mobile-shell-v57`.
  - `test/app-update.test.js` now covers the app-shell preflight and target-cache pruning behavior; `test/mobile-viewport.test.js` expects v57.
- Validation:
  - `npm.cmd test` passed with 72/72 tests.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed, with only Windows LF-to-CRLF working-copy notices.
  - `GET http://127.0.0.1:8787/api/public-config` returned `clientBuildId: 0.1.8|codex-mobile-shell-v57` and `shellCacheName: codex-mobile-shell-v57`.
  - Direct HTTP checks for `/`, `/index.html`, `/styles.css`, all frontend modules, `/app.js`, `/manifest.json`, `/sw.js`, and icon assets all returned `200`.
- Runtime note:
  - No Node restart was required; the current 8787 listener PID is `61000`, and `/api/public-config` reads `public/sw.js` dynamically.
  - A page that has already loaded the unsafe v56 click handler cannot be patched in memory. If a device is already on the broken unstyled page, it may need one manual close/reopen or browser/PWA reload to load v57; future refresh prompts from v57 are gated by the full app-shell preflight.
- Status:
  - Private workspace local changes only; not committed, not pushed, and not synced to public.

## 2026-05-15 Subagent Panel Current-Only Filter

- User report:
  - Inside a busy Hermes thread, the Subagent panel could show one or two hundred Subagents.
  - The desired behavior is to see only the Subagents currently in progress; historical completed records are not useful.
- Local fix:
  - `public/app.js` no longer scans backward through historical turns for Subagent records.
  - `currentSubagentItems()` now returns only running or queued `collabAgentToolCall` items from the current live turn, with a latest-turn fallback only when that latest turn itself still has active Subagent items.
  - `completed`, `failed`, `closed`, and other inactive historical statuses are omitted from the panel.
  - The panel empty state now says there is no currently active Subagent, not that no Subagent call was ever found.
  - `public/sw.js` cache and `public/app.js` `CLIENT_BUILD_ID` bumped from `codex-mobile-shell-v55` to `codex-mobile-shell-v56` so existing mobile/PWA clients can get the page refresh prompt and reload the updated frontend.
  - Updated `test/collab-agent-render.test.js` and `test/mobile-viewport.test.js` for the current-only filter and v56 build id.
- Validation:
  - `npm.cmd test` passed with 72/72 tests.
  - `npm.cmd run check` passed.
- Runtime note:
  - This is a static frontend/service-worker update. The current running server reads `public/sw.js` dynamically for `/api/public-config`, so clients running v55 should see server `clientBuildId` move to `0.1.8|codex-mobile-shell-v56` and show the existing page refresh prompt.
- Status:
  - Private workspace local changes only; not committed, not pushed, and not synced to public.

## 2026-05-15 Web Push Sub Agent Completion Suppression

- User report:
  - Mobile Web still produced many Web Push notifications when Sub Agents completed.
  - Follow-up screenshot showed the thread list itself occasionally filled with many `Agent` rows titled by raw thread ids, so Sub Agent child threads were also leaking into normal Mobile Web session lists.
- Cause:
  - `server.js` observed every `turn/started` / `turn/completed` pair from the shared app-server stream and sent a completion Web Push for each observed turn.
  - Spawned Sub Agent threads are recorded in Codex `state_5.sqlite` table `thread_spawn_edges`; many also have `threads.agent_nickname` / `threads.agent_role`. The Web Push path and normal `thread/list` filtering did not check those fields, so child thread completions looked like ordinary background thread completions and child threads could appear as regular sessions.
- Local fix:
  - Added `adapters/push-notification-service.js` with `shouldTrackTurnForWebPush()` so the notification decision is testable outside the large `server.js` entrypoint.
  - `server.js` now checks both `thread_spawn_edges.child_thread_id` and `threads.agent_nickname` / `threads.agent_role` for the notification thread id and does not observe/send Web Push for Sub Agent child threads.
  - The Sub Agent lookup caches only positive matches. Negative matches are not cached so a child turn that starts before the spawn edge or agent metadata is visible can still be suppressed when its completion event arrives.
  - Normal `thread/list` results now merge local state fields including `agent_nickname`, `agent_role`, and whether the id exists as `thread_spawn_edges.child_thread_id`; `isHiddenThread()` hides those child threads from ordinary Mobile Web lists.
  - Updated `package.json` `check` script to syntax-check the new adapter.
  - Added/updated tests covering normal turn notifications, spawned child suppression, agent-metadata suppression, fail-open behavior when SQLite lookup is unavailable, server wiring to `thread_spawn_edges`, and session-list hiding for Sub Agent child threads.
  - Updated `README.md` and `.agent-context/PROJECT_CONTEXT.md` to document that Web Push and ordinary thread lists skip Sub Agent child threads while keeping parent/main turn completion notifications and rows.
- Runtime activation:
  - Restarted only the `server.js` Node listener, not the shared mux/app-server chain.
  - First restart after push-filter-only fix: old listener PID `15092`, new listener PID `66752`.
  - Second restart after adding agent-metadata and thread-list filtering: old listener PID `66752`, new listener PID `61000`.
  - `GET http://127.0.0.1:8787/api/public-config` returned `200` after restart.
  - Authenticated `GET /api/threads?limit=80` returned 11 rows and `0` agent-like rows after filtering.
- Validation:
  - `npm.cmd test` passed with 72/72 tests.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed, with only Windows LF-to-CRLF working-copy notices.
- Status:
  - Private workspace local changes only; not committed, not pushed, and not synced to public.

## 2026-05-15 Public Release 0.1.9

- User request:
  - Push the latest private Mobile Web fixes to the public repository.
- Public repository:
  - Path: `C:\Users\xuxin\Documents\codex-mobile-web-public`.
  - Previous public HEAD: `92e8915 集成 PR #31/#32：刷新标题来源并隐藏不可用推送入口`.
  - Pushed public commit: `43c5fab 发布移动端会话体验与页面刷新修正`.
- Public release contents:
  - Synced the latest private product changes for page build/cache detection, the page refresh prompt, current-thread left-swipe Subagent panel, and iOS/PWA Composer bottom positioning.
  - `/api/public-config` exposes `buildId`, `clientBuildId`, and `shellCacheName`.
  - Browser/PWA clients show `页面有新版本，点击刷新` when the server client build changes; clicking saves the draft, updates the service worker, deletes old `codex-mobile-shell-*` caches, and reloads.
  - The current conversation area supports left swipe to open a Subagent status panel without adding a topbar button; empty state is shown when the current thread has no related `collabAgentToolCall`.
  - Phone Composer returns to normal bottom layout flow and only uses measured `visualViewport` height while keyboard shrink is detected.
  - Public package version bumped to `0.1.9`; public PWA shell cache is `codex-mobile-shell-v55`; public `CLIENT_BUILD_ID` is `0.1.9|codex-mobile-shell-v55`.
  - Public `README.md` gained a detailed Chinese `2026-05-15 Public 发布说明` covering user-visible behavior, cache activation, version/build id, and iOS/PWA notes.
- Public validation before push:
  - `npm.cmd test` passed: 66/66.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` and `git diff --cached --check` passed, with only Windows LF-to-CRLF working-copy notices.
  - Public staged diff privacy scan found no local user path, private repo marker, LAN/Tailscale marker, Hermes marker, access-key marker, or Web Push runtime secret-file marker.
- Private workspace status:
  - Product code was already committed and pushed privately as `ab1a7cd 改进移动端会话体验与页面刷新`.
  - This entry updates only `.agent-context/HANDOFF.md`; no private product code was changed for the public push.

## 2026-05-15 Rollback To Prior Layout With Left-Swipe Subagent Panel Only

- User direction:
  - Revert today's UI/layout changes and keep only the behavior that opens the Subagent page via left swipe.
  - Follow-up user report: left swipe still appeared inactive, and the composer area left a large blank strip below the input on iOS/PWA.
- Result:
  - Restored the workspace to `HEAD` first, removing today's larger Subagent-status experiments, server/SSE changes, service-worker bump, composer height edits, viewport/grid edits, and the untracked Web Push subagent test.
  - Re-applied only a minimal current-turn Subagent panel:
    - `public/index.html` adds `#subagentPanel` under the topbar.
    - `public/app.js` opens the panel from a left-swipe gesture on `#conversation`; horizontal trackpad/wheel swipe also opens it for desktop use.
    - The panel has no topbar button.
    - Left swipe now opens whenever a current thread exists, even if there are no Subagent records; the panel shows an explicit empty state instead of silently ignoring the gesture.
    - Subagent rows come from the current live/latest turn when present, with a fallback to the latest visible turn in the current thread that contains `collabAgentToolCall`.
    - Switching thread, entering home, or entering new-thread draft closes the panel.
    - `public/styles.css` adds absolute overlay styles so the panel does not consume a grid row or affect the composer layout.
  - Fixed the large blank strip below the composer:
    - `viewportHeight()` now uses the maximum of visual viewport, `innerHeight`, and document client height when no text input is focused.
    - It only trusts a smaller visual viewport when a text input is focused and the viewport is clearly keyboard-shrunk.
    - Follow-up fix for keyboard-open state: visual viewport bottom now includes `visualViewport.offsetTop`, `html.keyboard-open` removes composer bottom safe-area padding while the keyboard is open, and keyboard-open detection no longer depends on `document.activeElement` because iOS input-method focus state can be stale.
  - `public/sw.js` was bumped to `codex-mobile-shell-v52` so installed PWA clients replace any mixed v45/v49/v50/v51 frontend caches.
  - Runtime recovery:
    - Restarted the Codex Mobile Web shared chain with `restart-codex-mobile-shared-chain.ps1` after logs showed `shared app-server endpoint unavailable (Codex request timed out: initialize)`.
    - New local checks confirmed `GET /api/threads?limit=5` returns `200` with the stored access key in about 264 ms.
  - Follow-up mobile composer positioning:
    - User requested the input bar position to match WeChat: docked to the bottom instead of floating above a blank strip.
    - In the `max-width: 760px` mobile layout, `.composer` is now `position: fixed` at `bottom: 0`, and `.conversation` bottom padding is based on `--composer-height` so content does not sit under the fixed input bar.
    - `public/sw.js` was bumped again to `codex-mobile-shell-v53`.
  - Follow-up page refresh prompt:
    - `server.js` now exposes `buildId`, `clientBuildId`, and `shellCacheName` from `/api/public-config`; `clientBuildId` combines package version with the Service Worker shell cache name.
    - `public/app.js` has a loaded `CLIENT_BUILD_ID`, checks `/api/public-config` on startup, focus/pageshow/visibility resume, and every 60 seconds while visible.
    - If the server build/client shell changes, `#pageRefreshPrompt` appears with "页面有新版本，点击刷新"; clicking saves the current draft, asks the Service Worker to update, deletes old `codex-mobile-shell-*` caches, and reloads the page.
    - `public/sw.js` was bumped again to `codex-mobile-shell-v54`.
    - Restarted the 8787 listener so the new `/api/public-config` fields are live; current listener PID after restart was `15092` during verification.
  - `test/collab-agent-render.test.js` now covers the minimal left-swipe Subagent panel and absence of a topbar button.
  - `test/mobile-viewport.test.js` covers the safer viewport-height behavior and service-worker v50.
- Validation:
  - `npm.cmd test` passed with 65 tests.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed, with only Windows LF-to-CRLF working-copy notices.
  - Local HTTP checks on `http://127.0.0.1:8787/app.js`, `/styles.css`, and `/sw.js` confirmed the running server serves:
    - relaxed Subagent left-swipe logic and empty state,
    - viewport-height keyboard guard and keyboard-open composer padding override,
    - `.subagent-panel` / `.subagent-empty` styles,
    - `codex-mobile-shell-v54`.
  - Local HTTP checks confirmed `/api/public-config` returns `clientBuildId=0.1.8|codex-mobile-shell-v54`, `/` contains `#pageRefreshPrompt`, `/app.js` contains the refresh-check logic, `/sw.js` is v54, and authenticated `/api/threads?limit=1` returns `200`.
- Status:
  - Private workspace only. Not committed, not pushed, and not synced to public.

## 2026-05-14 Mobile Quota Chip Width Fix

- User report:
  - On the phone composer control row, the weekly quota percentage was clipped; the `周` quota value showed without the trailing `%`.
- Private local changes:
  - `public/styles.css`
    - In the `max-width: 760px` phone layout, changed the four composer controls from equal-width columns to lightly weighted columns: model/effort/permission stay close to equal width and the quota card gets only a small extra width (`1.08fr`) to recover the missing one or two characters.
    - Tightened the quota inline layout on phone: smaller internal gap, retained the compact separator dot between 5-hour and weekly quota, removed text-node spacing impact inside quota parts, and allowed the quota value row to use the wider card.
  - `public/sw.js`
    - Bumped app-shell cache to `codex-mobile-shell-v42` so installed PWA clients can pick up the CSS fix.
  - `test/composer-quota.test.js`
    - Updated mobile composer-control assertions for the weighted columns and compact quota layout.
  - `test/mobile-viewport.test.js`
    - Updated cache-version assertion to `v41`.
- Validation:
  - `npm.cmd test` passed with 59 tests.
  - `npm.cmd run check` passed.
  - Local HTTP checks on `http://127.0.0.1:8787/styles.css` and `/sw.js` confirmed the running server serves the small quota-width boost and `v42` service-worker cache.
- Publication status:
  - Private workspace only. Do not update public until the user explicitly requests public push.

## 2026-05-13 Collab Agent Tool Call Compact Rendering

- User report:
  - Hermes/Codex multi-Agent collaboration output produced `collabAgentToolCall` items.
  - Mobile Web rendered those unknown items as full JSON, taking over the phone screen.
- Private local changes:
  - `public/app.js`
    - Added `collabAgentToolCall` label as `协作 Agent`.
    - Added `renderCollabAgentToolCall()` to show a compact summary card with tool/status/agent/thread/task when available.
    - Raw JSON is still available, but only inside a collapsed details block with copy support.
  - `public/styles.css`
    - Added compact `collab-agent-*` styles and included `.item.collabAgentToolCall` in the tool-call visual group.
  - `public/sw.js`
    - Bumped app-shell cache from `codex-mobile-shell-v39` to `codex-mobile-shell-v40` so installed PWA clients can pick up the new frontend assets.
  - `test/collab-agent-render.test.js`
    - Added regression coverage for the compact renderer and styles.
  - `test/mobile-viewport.test.js`
    - Updated cache-version assertion to `v40`.
- Validation:
  - `npm.cmd test` passed with 59 tests.
  - `npm.cmd run check` passed.
  - Local HTTP checks on `http://127.0.0.1:8787/app.js`, `/styles.css`, and `/sw.js` confirmed the running server serves the new renderer, styles, and `v40` service-worker cache.
- Publication status:
  - Private workspace only. Do not update public until the user explicitly requests public push.

## 2026-05-13 Long-Running Shared Chain Slowdown Evidence - 06:05 +08:00

- User report:
  - On 2026-05-12, Mobile/Hermes sessions became slow in synchronization, thinking, and command/tool execution, not just in thread loading.
  - After an automatic Windows reboot on 2026-05-13, speed felt fast again.
- Windows reboot evidence:
  - `Win32_OperatingSystem.LastBootUpTime`: `2026-05-13 03:16:05 +08:00`.
  - System event log showed planned OS update restarts initiated by `MoUsoCoreWorker.exe` and `TrustedInstaller.exe` around `03:14-03:16 +08:00`.
- Current post-reboot runtime:
  - `Codex Mobile Web` Scheduled Task last ran at `2026-05-13 05:25:26 +08:00` and is running.
  - Current mux endpoint is `127.0.0.1:53599`, mux PID `20000`, child `codex.exe app-server` PID `23676`, started `2026-05-12T21:25:35Z`.
  - Current Mobile Web listener PID `24228`; `http://127.0.0.1:8787/` returns HTTP `200`.
  - Current process scan showed one Mobile Web listener, one standalone mux, and one `codex app-server`; no duplicate stale mux/app-server chain like the 2026-05-12 manual restart window.
- Memory and latency evidence:
  - Before the 2026-05-12 manual restart, long-running `codex.exe app-server` private memory was about `492MB`; current post-reboot `codex.exe app-server` private memory is about `197MB`.
  - Current local authenticated API timings: `/api/status` hot path about `1ms`; `/api/threads?limit=20` about `88-166ms`; large 79.8MB thread detail about `260-460ms`.
- Mux log segmentation:
  - Old long-running segment `2026-05-10T15:29:39Z` to `2026-05-12T14:23:30Z`: 553 timestamped app-server/tool errors, 20 backpressure events, 7 replay events, 7 disconnects.
  - Post-manual-restart/pre-Windows-reboot segment `2026-05-12T14:23:30Z` to `2026-05-12T21:25:35Z`: 43 timestamped errors, no backpressure, 2 replay events, 2 disconnects.
  - Post-Windows-reboot/current segment started `2026-05-12T21:25:35Z`: early logs showed only one short backpressure/drain pair during startup plus normal app-server/tool errors from active work.
- Current diagnosis:
  - Initial evidence pointed to long-lived shared-chain degradation: `codex app-server` / mux process age, accumulated memory, historical tool errors, and occasional duplicate/stale mux processes are more likely than rollout-file size alone.
  - Rollout continuation reduces per-thread context/read size, but it does not reset the shared app-server/mux process state.
  - A practical fix should add supervised soft-restart criteria for the shared chain, preferably based on process age, `codex.exe` private memory, mux backpressure/replay/error counters, and no active turn/request state.
- Important correction after user feedback:
  - User observed that the 2026-05-12 manual mux/app-server restart did not restore perceived speed, while the 2026-05-13 full Windows reboot did.
  - Manual restart log only stopped Codex Mobile Web/mux/app-server PIDs `22916`, `23272`, `20964`, and `45264`; it did not restart Hermes Mobile listener, Hermes bridge host, Hermes gateway pool, WSL distributions, MCPVault child processes, or Codex Desktop itself.
  - `C:\ProgramData\HermesMobile\data\logs\worker-host.log` shows Hermes Mobile listener/bridge restarts independent of Codex Mobile Web, including listener PID `45228` at `2026-05-12 21:35:35 +08:00` and a fresh post-reboot worker listener PID `32152` at `2026-05-13 05:26:54 +08:00`.
  - `C:\ProgramData\HermesMobile\gateway-worker\logs\start-gateway-pool.log` shows the full reboot path restarted low gateway processes and reported healthy gateway ports `18751-18760,18651,18652` at `2026-05-13 05:26:52 +08:00`.
  - Revised diagnosis: the slow state likely involved the broader Hermes/WSL/gateway worker stack, not just Codex Mobile Web's mux/app-server. A future "deep restart" action should restart Hermes Mobile listener/bridge/gateway pool and reset WSL/gateway children, or at least make those components visible in diagnostics, instead of only restarting the Codex mux endpoint.

## 2026-05-12 Manual Shared Chain Restart - 22:26 +08:00

- User report:
  - Hermes/Mobile sessions felt slow in synchronization, thinking, and command/tool execution, not only in thread loading.
- Diagnostics before restart:
  - Previous standalone mux endpoint was PID `22916`, child `codex.exe app-server` PID `23272`, started `2026-05-10T15:29:39Z`.
  - Mobile Web listener was PID `45264`, started `2026-05-11 23:15:31 +08:00`.
  - Logs showed historical mux backpressure/replay, but not recent active backpressure; long-lived app-server/mux state and repeated tool errors were more plausible than unbounded replay accumulation.
- Action taken:
  - Stopped the `Codex Mobile Web` Scheduled Task, killed the old Mobile Web listener plus old standalone mux/app-server processes, removed the stale mux endpoint, and restarted the scheduled task.
- Post-restart state:
  - New endpoint: `%USERPROFILE%\.codex\app-server-mux\endpoint.json`.
  - New standalone mux PID `36872`, child `codex.exe app-server` PID `45320`, started `2026-05-12T14:23:30Z`.
  - New Mobile Web listener PID `43716`; `http://127.0.0.1:8787/` returned HTTP `200`.
  - A `codex-app-server-mux.exe` / node pair spawned by Codex Desktop was observed attaching desktop stdio to the existing mux PID `36872`; this is the Desktop shim path, not a second real app-server.

## 2026-05-12 Self-Update Restart Clarification - 19:35 +08:00

- User report:
  - A separate public deployment showed an update, the user clicked update, Mobile Web showed a restart state, then the connection dropped.
  - On that machine the service was stopped; manually starting it again showed the app had updated successfully.
- Finding:
  - This is consistent with the current self-update implementation. `server.js` applies a clean fast-forward update, returns the HTTP response, waits briefly, then exits the Node listener.
  - Automatic recovery depends on an external supervisor such as the Windows hidden startup wrapper, the user-logon Scheduled Task using that wrapper, or the macOS shared launcher.
  - Manual `node server.js`, `npm start`, or one-shot shell deployments have no supervisor, so the update is applied but the web service remains stopped until manually restarted.
- Private local changes:
  - `public/app.js`: update available/restarting tooltips and confirmation text now state that the service exits after update and only supervisor-backed deployments restart automatically.
  - `public/app.js`: after a successful update, the connection state tells the user to manually restart on the deployment machine if the connection drops and does not recover.
  - `README.md`: Self Update section documents that manual-start deployments require manual restart after an applied update.
  - `.agent-context/PROJECT_CONTEXT.md`: durable architecture note added for supervisor-dependent self-update restart.
  - `test/app-update.test.js`: added regression coverage for the supervisor/manual-restart UI and README text.
- Publication status:
  - User explicitly requested public push on 2026-05-12.
  - Public repo `C:\Users\xuxin\Documents\codex-mobile-web-public` was updated and pushed as commit `8a8dda3 澄清自更新后的重启依赖`.
  - Public package version was bumped from `0.1.3` to `0.1.4`.
  - Public validation before push: `npm.cmd test` (22/22), `npm.cmd run check`, `npm.cmd run check:macos`, `git diff --check` with line-ending warnings only, and a focused public diff privacy scan.

## 2026-05-12 Disable Mobile Page Zoom - 15:45 +08:00

- User request:
  - Disable page zoom in Mobile Web.
- Private local changes:
  - `public/index.html`: viewport meta now locks scale to `1` with `minimum-scale=1`, `maximum-scale=1`, and `user-scalable=no`.
  - `public/index.html`: added an early head script that prevents iOS/WebKit `gesturestart`, `gesturechange`, `gestureend`, `dblclick`, and rapid double-touch zoom events with non-passive listeners.
  - `public/styles.css`: root `html, body` now set `touch-action: pan-x pan-y`, keeping normal panning while omitting pinch zoom.
  - App-shell cache version was bumped from `v36` to `v37` across `index.html`, `public/app.js`, `public/service-worker.js`, and cache regression tests so installed PWA clients fetch the updated HTML/CSS/JS.
  - `test/mobile-viewport.test.js`: added regression coverage for the viewport lock, WebKit gesture guards, double-tap guard, and CSS touch-action rule.
  - `README.md` and `.agent-context/PROJECT_CONTEXT.md`: documented that browser page zoom is disabled and readability should use the in-app font-size setting.
- Publication status:
  - User explicitly requested public push later on 2026-05-12.
  - Public repo `C:\Users\xuxin\Documents\codex-mobile-web-public` was updated and pushed as commit `9f893f8 发布端口保留与移动端禁用页面缩放`.
  - Public release also included the previously prepared macOS reserved-port update: `start-codex-shared-mobile-macos.sh` skips `8797` by default, supports `CODEX_MOBILE_RESERVED_PORTS`, `--reserved-ports`, and `--no-reserved-ports`, and documents the behavior in Chinese README notes.
  - Public page-zoom changes were adapted to public's `/sw.js` and unversioned static asset layout, not copied wholesale from private's `service-worker.js?v=37` layout. Public PWA shell cache was bumped from `codex-mobile-shell-v34` to `codex-mobile-shell-v35`.
  - Public package version was bumped from `0.1.2` to `0.1.3`.
  - Public validation passed before push: `npm.cmd test` (20/20), `npm.cmd run check`, `npm.cmd run check:macos`, `git diff --check` with line-ending warnings only, reserved-port behavior checks, and a diff privacy scan for local/private markers.
  - GitHub Actions CI for public commit `9f893f8` completed successfully.

## 2026-05-12 Private Backport Of Public PR #24/#25 Composer Quota UI - 15:32 +08:00

- User clarification:
  - Public PR #24/#25's Composer/quota design is acceptable and should not be reverted.
  - The problem was that the public repo had the design while the private repo did not, which would cause later private-to-public syncs to overwrite the public behavior.
- Cause:
  - PR #24/#25 had been integrated directly into `C:\Users\xuxin\Documents\codex-mobile-web-public`.
  - The running private workspace `C:\Users\xuxin\Documents\codex-mobile-web` still had editable model/reasoning/permission selectors and single-text quota display.
- Private local changes:
  - `public/index.html`: Composer controls now use read-only `modelEffortDisplay` and `permissionDisplay` chips instead of editable `modelSelect`, `effortSelect`, and `permissionSelect`.
  - `public/app.js`: added compact model labels, reset-aware quota chip rendering, quota risk coloring classes, and read-only Composer settings rendering.
  - `public/app.js`: normal message send and continuation request bodies no longer append `model`, `effort`, or `permissionMode`, keeping Mobile Web aligned with Desktop/app-server runtime settings.
  - `public/styles.css`: Composer control row now has fixed-height read-only chips; phone layout hides the separate permission chip and compacts model/reasoning/permission into the model chip while showing the two quota chips on the same row.
  - `test/composer-quota.test.js`: added regression coverage for read-only model/reasoning, read-only permission, separate reset-aware quota chips, mobile compact layout, and fixed control heights.
  - `README.md`: updated current behavior notes from editable selectors/single quota text to read-only runtime chips and reset-aware quota chips.
- Public repo status:
  - A brief temporary edit to `public/app.js` was restored; public `public/app.js` has no substantive diff.
  - Existing public local changes remain the macOS reserved-port update in `README.md` and `start-codex-shared-mobile-macos.sh`; they are still uncommitted/unpushed unless the user explicitly requests publication.
- Validation:
  - Private `node --check public/app.js` passed.
  - Private `npm.cmd test` passed (15/15).
  - Private `npm.cmd run check` passed.
  - Private `git diff --check` passed with line-ending warnings only.
- Important workflow note:
  - Future public PR integrations that change user-visible behavior should either be backported to the private repo after acceptance or intentionally reverted in public. Leaving accepted public-only behavior creates a later sync conflict where private changes can overwrite public behavior.

## 2026-05-12 Public Deployment Port Reservation - 15:04 +08:00

- User report:
  - Hermes Mobile was deployed first on port `8797`.
  - Later Codex public deployment also targeted `8797`, causing a service/target conflict.
- Findings:
  - `C:\Users\xuxin\Documents\codex-mobile-web-public` tracked files do not hard-code `8797` for the core Windows/Node server. `server.js`, Windows startup scripts, and README default to `8787`.
  - Current local listeners:
    - `0.0.0.0:8797` is Hermes Mobile: `C:\ProgramData\HermesMobile\app\server.js`, PID `17964`.
    - `0.0.0.0:8787` is Codex Mobile Web private: `C:\Users\xuxin\Documents\codex-mobile-web\server.js`, PID `45264`.
    - `127.0.0.1:8798` is a Hermes Mobile bridge host: `C:\ProgramData\HermesMobile\app\scripts\bridge-host.js`, PID `17224`.
  - `tailscale serve status` currently maps:
    - `https://gmk.tail62e8ce.ts.net/` -> `http://127.0.0.1:8797` (Hermes Mobile)
    - `https://gmk.tail62e8ce.ts.net:8443/` -> `http://127.0.0.1:8787` (Codex Mobile Web)
  - The public macOS one-command shared launcher auto-selects from `8789..8899`, which included `8797`; that made it possible for Codex auto deployment to choose or be documented around a port that another local Agent service reserves.
- Public local repo changes, not pushed:
  - `C:\Users\xuxin\Documents\codex-mobile-web-public\start-codex-shared-mobile-macos.sh`
    - Added `CODEX_MOBILE_RESERVED_PORTS`, default `8797`.
    - Auto port selection now skips reserved ports.
    - Explicit `--port 8797` fails with a reserved-port error unless the reserved list is disabled.
    - Added `--reserved-ports <csv>` and `--no-reserved-ports`.
  - `C:\Users\xuxin\Documents\codex-mobile-web-public\README.md`
    - Added detailed Chinese release notes for the `8797` reservation.
    - Updated macOS bridge start docs and environment variable table.
- Validation:
  - Public `npm.cmd test` passed (18/18).
  - Public `npm.cmd run check` passed.
  - Public `npm.cmd run check:macos` passed.
  - Public `git diff --check` passed with line-ending warnings only.
  - `bash ./start-codex-shared-mobile-macos.sh --start-port 8797 --end-port 8798 --print-only` chooses `8798`, proving default auto mode skips `8797`.
  - `bash ./start-codex-shared-mobile-macos.sh --port 8797 --print-only` exits with the reserved-port error.
- Publication status:
  - Changes are local in the public repo. They have not been committed or pushed.

## 2026-05-11 PWA Cache Reset For Swipe Archive - 23:12 +08:00

- User report:
  - Killing and reopening the PWA still showed the old thread-list left-swipe action `压缩续接` instead of `归档`.
- Cause:
  - The running server had already been updated and restarted, but the installed iOS/PWA client could still be controlled by the old active service worker.
  - The old service worker used cache-first behavior for static assets, so reopening the app could continue serving stale `/index.html` and `/app.js` from Cache Storage.
- Private workspace changes:
  - `public/index.html`: versioned app-shell URLs are now used for `/manifest.json?v=36`, `/styles.css?v=36`, `/service-worker.js?v=36`, and `/app.js?v=36`.
  - `public/app.js`: normal service-worker registration now also uses `/service-worker.js?v=36` and asks the registration to update.
  - `public/service-worker.js`: static assets are cached with versioned URLs, and non-API/non-upload requests now prefer network first with cached fallback. The old `return cached || network` cache-first path is removed.
  - `server.js`: added unauthenticated `GET /api/client-reset`, which bypasses the old service worker because `/api/` is excluded from app-shell caching. It unregisters all service workers for the origin, deletes Cache Storage entries, then redirects to a fresh app URL.
  - `test/thread-archive.test.js`: added regression coverage for versioned app-shell URLs and the client reset route.
- Runtime activation:
  - Restarted the 8787 Node listener after the `v36` cache-version bump. Old PID `37712`, new PID `45264`.
  - Verified `http://127.0.0.1:8787/app.js?v=36` contains `data-thread-archive` and no `data-new-thread-from-thread`.
  - Verified `http://127.0.0.1:8787/service-worker.js?v=36` contains `codex-mobile-shell-v36`, versioned app assets, network-first fetch logic, and no old cache-first `return cached || network`.
  - Verified `http://127.0.0.1:8787/api/client-reset` returns the reset page and includes service-worker unregister plus cache deletion code.
- Validation:
  - `npm.cmd test` passed (10/10).
  - `npm.cmd run check` passed.
  - `git diff --check` passed with line-ending warnings only.
- User-facing recovery:
  - Open the reset route in the same PWA/Safari origin used for Mobile Web, for example `https://gmk.tail62e8ce.ts.net:8443/api/client-reset` or the matching LAN host. After it redirects back to the app, the left-swipe action should show `归档`.

## 2026-05-11 Private Swipe Archive Activation - 18:34 +08:00

- User report:
  - After re-login, thread-list left swipe still showed `压缩续接` instead of `归档`.
- Cause:
  - The previous PR #18 merge was completed in `C:\Users\xuxin\Documents\codex-mobile-web-public`, but the running 8787 service was using the private workspace `C:\Users\xuxin\Documents\codex-mobile-web`.
  - Private `public/app.js` still used `data-new-thread-from-thread` and rendered `压缩续接` for the thread-row swipe action.
- Private workspace changes:
  - `public/app.js`: thread-row swipe action now renders `归档`, uses `data-thread-archive`, and calls `archiveThreadFromList()`.
  - `server.js`: added `POST /api/threads/<threadId>/archive`, idempotent archive handling, archive/backup rollout filtering through `archived_sessions`, `state_5.sqlite`, and `.jsonl.bak/.backup/.old` paths.
  - `public/service-worker.js`: cache name bumped from `codex-mobile-shell-v10` to `codex-mobile-shell-v35`.
  - `test/thread-archive.test.js`: added regression coverage for left-swipe archive selectors and archive route presence.
- Runtime activation:
  - Restarted only the 8787 Node listener. Old PID `13572`, new PID `15612`.
  - Verified `http://127.0.0.1:8787/app.js` contains `data-thread-archive` and `archiveThreadFromList`, and does not contain `data-new-thread-from-thread`.
  - Verified `http://127.0.0.1:8787/service-worker.js` contains `codex-mobile-shell-v35`.
- Validation:
  - `npm.cmd test` passed (9/9).
  - `npm.cmd run check` passed.
  - `git diff --check` passed with line-ending warnings only.
- User-facing note:
  - If an already-installed PWA still shows `压缩续接`, it is using the old service worker/app-shell cache. Refresh once or close/reopen the PWA so the new service worker and `app.js` activate.

## 2026-05-11 Public Repo PR #18/#24/#25 Merge - 18:05 +08:00

- User instruction:
  - Continue merging public pull requests.
  - Merge PR #18 as well and let PR content override the previous local behavior.
- Public repo path:
  - `C:\Users\xuxin\Documents\codex-mobile-web-public`
- Published commits:
  - `f13f8a3 合并 PR #18：将线程列表左滑动作改为归档`
    - Left-swipe thread-row action changed from `压缩续接` to `归档`.
    - Added `POST /api/threads/<threadId>/archive`.
    - Added filtering for `archived_sessions` and `.jsonl.bak/.backup/.old` backup rollout paths.
    - Resolved an automatic merge issue where PR #18 and current main both defined `mergeThreadStateFromStateDb`; final code keeps one merged implementation.
    - README Chinese release section `2026-05-11 Public 发布说明（续三）`; service worker cache `codex-mobile-shell-v18`.
    - Added `test/thread-archive.test.js`.
  - `233eb66 合并 PR #24/#25：修复 iPad 横屏 Composer 溢出并优化额度显示`
    - PR #25 includes PR #24, so both were merged through the PR #25 head.
    - iPad landscape split composer overflow fixed with tighter sidebar/main height constraints.
    - Removed the previous visualViewport composer lift path in favor of stable grid/container constraints.
    - Composer model/reasoning and permission are read-only chips; Mobile Web no longer submits `model`, `effort`, or `permissionMode`.
    - Quota display is now two reset-aware chips with severity coloring.
    - README Chinese release section `2026-05-11 Public 发布说明（续四）`; service worker cache `codex-mobile-shell-v34`.
    - Added `test/composer-quota.test.js` and updated `test/tablet-layout.test.js`.
- PR state:
  - Closed PR #18, #24, and #25 after push.
  - `gh pr list --state open` returned no open PRs.
- Validation:
  - After PR #18: `npm.cmd test` passed (12/12), `npm.cmd run check` passed, `npm.cmd run check:macos` passed, `git diff --check` passed.
  - After PR #24/#25: `npm.cmd test` passed (18/18), `npm.cmd run check` passed, `npm.cmd run check:macos` passed, `git diff --check` passed.
  - Public `main` and `origin/main` are aligned at `233eb66`.

## 2026-05-11 Public Repo Merge Follow-up - 16:08 +08:00

- Scope:
  - Continue processing pending public pull requests in `C:\Users\xuxin\Documents\codex-mobile-web-public`.
  - Complete integration of PR #21, #22, #23 into `main` with detailed README update.
- Integrated and published:
  - Consolidated changes on `main` as commit `e13daeb`:
    - iPad landscape composer two-row compact layout and keyboard-avoidance lift.
    - Session switch refresh abort + polling backoff optimization.
    - Desktop notification replay enabled by default and replay buffer stores full notifications.
    - Added tests: `test/tablet-layout.test.js`, `test/mobile-polling.test.js`, and protocol replay coverage in `test/protocol.test.js`.
    - README updated with Chinese release section `2026-05-11 Public 发布说明（续二）`, plus mux replay/env/troubleshooting corrections.
  - Pushed to `origin/main`: `5b57a54..e13daeb`.
- PR state updates:
  - Closed PR #21, #22, #23 with comments pointing to `e13daeb`.
  - PR #18 (`[移动端] 将左滑操作改为归档`) remains open intentionally; it is still outside the current product rule.
- Validation in public repo:
  - `npm.cmd test` passed (10/10).
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.

## 2026-05-03 Migration From Agent Workspace - 17:45 +08:00

- Objective:
  - Move Codex Mobile Web out of `C:\Users\xuxin\Documents\Agent\tools\cli\codex-mobile-web` into standalone workspace `C:\Users\xuxin\Documents\codex-mobile-web`.
- Migrated source files:
  - `server.js`
  - `public/app.js`
  - `public/index.html`
  - `public/styles.css`
  - `codex-app-server-mux.js`
  - `codex-app-server-mux.cmd`
  - `start-codex-mobile-web.ps1`
  - `README.md`
  - `package.json`, `.gitignore`, `LICENSE`
- Runtime setup:
  - Local runnable Codex binary copied to `%USERPROFILE%\.codex-mobile-web\codex.exe`.
  - Existing access key copied to `%USERPROFILE%\.codex-mobile-web\access_key`.
  - These runtime files are not stored in Git.
  - Old Agent workspace `.webui_secret_key` was removed after matching the runtime access key hash.
- Standalone adjustments:
  - `server.js` uses repository root as `APP_ROOT`, not the old nested `Agent\tools\cli` layout.
  - Default `CODEX_HOME` is `%USERPROFILE%\.codex`.
  - Default access key file is `%USERPROFILE%\.codex-mobile-web\access_key`.
  - Startup script defaults to `0.0.0.0:8787` and prefers `%USERPROFILE%\.codex-mobile-web\codex.exe` when present.
  - Old source directory `C:\Users\xuxin\Documents\Agent\tools\cli\codex-mobile-web` and old logs `C:\Users\xuxin\Documents\Agent\workspace\codex-mobile-web` were removed after validation.
- Latest functional behavior migrated:
  - Hidden thread filtering for archived/deleted/removed sessions and old workspaces.
  - Weak-network safe read retry and state DB fallback.
  - Mobile interaction-first rendering with bounded recent history.
  - Context compaction single-line Chinese notice.
  - Latest-only live command/file-change operation card.
  - File-change cards show compact file names only.
- Validation completed:
  - `node --check server.js`, `node --check codex-app-server-mux.js`, and `node --check public/app.js` passed.
  - Web server restarted from this workspace on `0.0.0.0:8787`.
  - Current wrapper PowerShell PID `51596`, Node PID `2424`, managed app-server child PID `6104`.
  - `/api/status` returned `ready=true`, `transport=managed-ws-child`, `lastError=null`, `codexExe=C:\Users\xuxin\.codex-mobile-web\codex.exe`.
  - LAN `/api/threads?limit=80&archived=false` returned 9 visible threads, 0 hidden/archived/old-workspace matches.
  - Current thread detail validation: 1 latest operational item, 1 context-compaction notice, and `DiffAsFilename=False`.

## Next Checks

- Start from this workspace when needed:
  - `powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\Users\xuxin\Documents\codex-mobile-web\start-codex-mobile-web.ps1 -HostAddress 0.0.0.0 -Port 8787`

## 2026-05-03 GitHub Publish Attempt - 18:05 +08:00

- User requested creating a new remote repository and pushing this workspace.
- Local scope reviewed:
  - Before publish preparation, the repository had no prior commits and no configured remote.
  - Intended initial commit scope is the complete standalone app source plus `.agent-context` durable context.
  - Runtime key and binary locations remain outside the repo under `%USERPROFILE%\.codex-mobile-web`.
  - `.gitignore` excludes `.env*`, `*.key`, `*.pem`, `.webui_secret_key`, logs, and workspace/log directories.
- Validation:
  - `npm.cmd run check` passed.

## 2026-05-06 Web Push Thread Switch And Swipe Continuation Fix - 13:52 +08:00

- User-reported issues:
  - Clicking a Web Push notification opened/focused Mobile Web, but the app did not switch to the notification's thread.
  - The thread-list left-swipe `压缩续接` action flashed briefly and then closed instead of staying visible.
- Code changes:
  - `public/service-worker.js` now extracts the target `/?thread=<threadId>` from notification data and posts a `codex-open-thread` message to an already-open Mobile Web window after focusing it. If no window exists, it opens the URL with the thread parameter.
  - `public/app.js` now listens for service-worker `codex-open-thread` messages, stores the target thread id, clears the URL parameter, and directly calls `loadThread()` so an iOS/PWA notification click switches threads without depending on browser navigation.
  - `public/app.js` also re-checks URL thread parameters on `pageshow` and `focus`, covering browser/PWA resume cases where the app is opened with `?thread=...`.
  - `public/app.js` now uses pointer capture for thread-row swipes, no longer cancels the gesture on `pointerleave`, and suppresses the synthetic same-gesture card click for 1.2 seconds so the revealed `压缩续接` button remains open.
- Documentation:
  - `README.md` documents Web Push thread switching and the persistent left-swipe action.
  - `.agent-context/PROJECT_CONTEXT.md` records the service-worker message path and persistent swipe behavior.
- Activation note:
  - Static frontend/service-worker change. Existing PWA/browser sessions may need a refresh so the new `app.js` and updated service worker are installed and activated.

## 2026-05-06 iOS Swipe Continuation Follow-up - 13:59 +08:00

- User-reported issue:
  - The left-swipe `压缩续接` action still flashed and disappeared on the phone.
- Follow-up code change:
  - `public/app.js` now ignores touch-origin Pointer Events and uses explicit `touchstart` / `touchmove` / `touchend` / `touchcancel` handlers for thread-list rows.
  - `touchcancel` now finalizes the gesture from the last horizontal position instead of blindly clearing the row. This covers iOS canceling pointer/touch gestures after the action has already been revealed.
  - The open threshold was lowered to about 28px / 32% of action width so a deliberate short left swipe keeps the `压缩续接` action open.
  - A capture-phase click guard now suppresses the same-gesture synthetic click on the row while still allowing immediate taps on the revealed action button.
- Activation note:
  - Static frontend-only change. Existing PWA/browser sessions need a refresh to load the updated `public/app.js`.

## 2026-05-06 Public Sync After User Test - 14:03 +08:00

- User instruction:
  - After testing the private build, the user explicitly approved public push.
- Public release sync:
  - Synchronized current private `README.md` and `public/app.js` into `C:\Users\xuxin\Documents\codex-mobile-web-public`.
  - Preserved public release differences: `README.md` uses `https://github.com/pentiumxp/codex-mobile-web-public.git` and `cd codex-mobile-web-public`; `public/app.js` registers `/sw.js`.
  - Updated public `public/sw.js` by keeping its PWA cache shell and adding the Web Push notification-click `codex-open-thread` message path.
  - Public README includes Chinese documentation for Web Push thread switching and iOS/PWA left-swipe `压缩续接` behavior.
- Validation:
  - Public `npm.cmd test` passed.
  - Public `npm.cmd run check` passed.
  - Public `git diff --check` passed with line-ending warnings only.
  - Public tracked-file privacy scan excluding `.gitignore` returned no matches for local user paths, Tailscale host markers, LAN address, Hermes name, or the private GitHub clone URL.
- Published:
  - Public commit `f8ac2de 修复通知线程切换和左滑续接` pushed to `origin/main`.

## 2026-05-06 Web Push Thread Title Binding Fix - 15:02 +08:00

- User-reported issue:
  - A task completed in the `Hermes Web` thread, but the Web Push notification appeared labeled as `Codex Mobile`.
- Diagnosis:
  - `server.js` only remembered observed `turn/started` turn ids in a `Set`.
  - On `turn/completed`, it recomputed thread title and click target from the completion event's params. In the shared mux stream, those completion params can be incomplete or use different thread-id/title fields, so the notification could be labeled from the wrong available thread/title.
- Code change:
  - `server.js` now stores `turn/started` metadata in a `Map` keyed by turn id, including normalized thread id and thread title.
  - `turn/completed` now reuses the started-turn metadata for notification title, dedupe key, tag, and `/?thread=<threadId>` click target.
  - Thread id extraction now accepts `threadId`, `conversationId`, snake_case variants, `thread.id`, and nested `turn.threadId` / `turn.conversationId` variants.
  - Turn-completed notification title is now the thread title, with body `This turn 已结束 · <local time>`, so iOS/PWA notifications show the actual completed thread instead of a generic app title.
- Documentation:
  - `README.md` and `.agent-context/PROJECT_CONTEXT.md` document the bound turn metadata and thread-title notification behavior.
- Activation note:
  - `server.js` change requires restarting the 8787 Mobile Web listener. Public sync was not performed; wait for user testing and explicit public approval.

## 2026-05-06 Default User-Logon Startup Simplification - 00:35 +08:00

- User-requested change:
  - Do not make `LocalSystem` the default startup mode. The simpler default should be a Windows user-logon task because WSL access requires the user context.
  - The user-logon task must still be no-window.
- Code/documentation changes:
  - `install-codex-mobile-web-startup.ps1` now defaults to an `AtLogOn` interactive Scheduled Task for the current Windows user. It no longer silently converts missing `-InteractiveLogon` into `-RunAsSystem`.
  - The default task still runs `wscript.exe start-codex-mobile-web-hidden.vbs`, so both user-logon and optional `-RunAsSystem` modes launch without a visible console window.
  - `-RunAsSystem` is now an explicit optional mode only, for cases that need startup before user logon or survival after sign-out and do not need WSL.
  - Added `-UserProfilePath` to the installer so SYSTEM/elevated automation can explicitly target a real Windows user profile when registering the default user-logon task.
  - README now documents the user-logon no-window task as the primary install path and moves `LocalSystem` into an optional caveat.
  - `.agent-context/PROJECT_CONTEXT.md` now records the default no-window user-logon startup rule and the two context-compaction display states.
- Runtime note:
  - No runtime reinstall was needed during this change because the existing `Codex Mobile Web` task was already `LogonType=Interactive`, `RunLevel=Limited`, owned by `GMK\xuxin`.
- Validation:
  - `npm.cmd run check` passed.
  - PowerShell parser check passed for `install-codex-mobile-web-startup.ps1`.
  - `git diff --check` passed with line-ending warnings only.
  - Current Scheduled Task action was verified as `wscript.exe "...\start-codex-mobile-web-hidden.vbs" ...`, with `LogonType=Interactive`, confirming the user-logon task is still no-window.
- Public release sync:
  - Synchronized public-safe files to `C:\Users\xuxin\Documents\codex-mobile-web-public`: `README.md`, `install-codex-mobile-web-startup.ps1`, `server.js`, `public/app.js`, `public/index.html`, and `public/styles.css`.
  - Preserved the public release differences: `public/app.js` registers `/sw.js`, and README uses `https://github.com/pentiumxp/codex-mobile-web-public.git`.
  - Public validation passed: `npm.cmd test`, `npm.cmd run check`, PowerShell parser check for the installer, Git Bash macOS shell parser check, `git diff --check`, and the tracked-file privacy scan excluding `.gitignore`.

## 2026-05-06 Mobile Web SSE Reconnect And Stutter Fix - 09:55 +08:00

- User-reported issue:
  - The Web App frequently showed `Shared`, `Reconnecting`, and `Connected` state changes.
  - During these events the mobile client visibly stalled and did not update, so it was not treated as a cosmetic state-label issue only.
- Findings:
  - The 8787 listener and shared app-server were healthy after reboot: `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, `lastError=null`.
  - `tailscale serve status` still mapped `https://gmk.tail62e8ce.ts.net:8443/` to `http://127.0.0.1:8787`.
  - Local SSE diagnostics showed that Mobile Web was receiving large unrelated app-server notifications from other active shared threads, especially `turn/diff/updated` payloads. The browser had to receive and parse those payloads before client-side thread filtering could ignore them.
  - The old frontend recovery path also amplified transient `EventSource.onerror` events by immediately showing `Reconnecting` and, after 1.5 seconds, reloading status, thread list, and current thread detail.
- Code changes:
  - `server.js` now drops `turn/diff/*` notifications before broadcasting to Mobile Web SSE clients.
  - `/api/events` now records an optional `threadId` query parameter per SSE client.
  - `server.js` filters turn/item notifications to the SSE client's selected thread, while still allowing status, rate-limit, and thread-list-level notifications.
  - `public/app.js` now includes the current thread id in the SSE URL and reconnects SSE when the selected thread changes or clears.
  - `public/app.js` keeps the last real backend connection status so normal thread list/detail refreshes no longer overwrite `Shared` with `Connected`.
  - `public/app.js` delays the visible reconnect notice for 3 seconds and only runs full recovery refreshes after 8 seconds of sustained SSE outage, reducing stutter from short browser/Tailscale long-connection interruptions.
- Activation:
  - Restarted only the 8787 Node listener; the supervisor relaunched it under `GMK\xuxin`.
  - New listener PID after activation: `6088`.
  - Shared mux/app-server were not restarted.
- Validation:
  - `npm.cmd run check` passed.
  - `git diff --check` passed with line-ending warnings only.

  - Authenticated `/api/status` returned ready with endpoint port `59136`.
  - Local SSE test with `threadId=019df88b-cc8b-7413-83f4-625b39083dcc` timed out normally after 10 seconds, included status, contained no `turn/diff/*`, and did not include the unrelated Hermes thread id observed before the fix.
- Public release sync:
  - Synchronized `server.js` and `public/app.js` to `C:\Users\xuxin\Documents\codex-mobile-web-public`.
  - Preserved public `public/app.js` service worker registration on `/sw.js`.
  - Public validation passed: `npm.cmd test`, `npm.cmd run check`, `git diff --check`, and tracked-file privacy scan excluding `.gitignore`.

## 2026-05-06 Public README Release Requirement

- User instruction:
  - Future public-repo commits must include a detailed README update.
  - The README update must include Chinese documentation explaining the user-visible change, usage impact, and any operational notes.
- Follow-up user instruction on 2026-05-06 13:54 +08:00:
  - Do not update the public repo immediately during normal private development.
  - Wait until the user has tested the private build and explicitly instructs a public update before syncing, committing, or pushing `C:\Users\xuxin\Documents\codex-mobile-web-public`.
- Durable context update:
  - `.agent-context/PROJECT_CONTEXT.md` records this as a public release rule.
- Operational implication:
  - Do not treat a public sync as complete when only code files are copied/committed. If public code changes are pushed, update `C:\Users\xuxin\Documents\codex-mobile-web-public\README.md` in the same public commit unless the user explicitly excludes README changes.
  - `git diff --check` passed with only Git line-ending warnings.

## 2026-05-06 Rollout Continuation Bootstrap Detail

- User-requested adjustment:
  - The rollout-size action should be treated as "压缩续接" rather than an ordinary "新线程".
  - The continuation thread must receive enough explicit detail to avoid missing durable GitHub/private/public/README requirements after a thread switch.
- Code behavior:
  - `public/app.js` now labels the over-threshold action as `压缩续接`, updates the warning banner and confirmation prompt, and explains that the source thread summary, recent context, GitHub release rules, and handoff excerpts are written into the first message.
  - `server.js` now builds a detailed bootstrap message before starting the first continuation turn. The message includes source thread id/title/cwd/rollout path/rollout size/status, runtime settings, recent visible source turns from `thread/turns/list`, `.agent-context/PROJECT_CONTEXT.md`, critical `.agent-context/HANDOFF.md` GitHub/release sections, the latest handoff tail, and explicit reminders about public README and privacy-safe public sync.
  - `server.js` now defaults continuation runtime settings from the source thread runtime context, then applies any user-selected permission-mode override.
  - `CODEX_MOBILE_CONTINUATION_BOOTSTRAP_CHARS` controls the maximum bootstrap message size, default `120000`.
  - `CODEX_MOBILE_CONTINUATION_RECENT_TURNS` controls the number of recent source turns summarized, default `12`, capped at `30`.
- Documentation:
  - `README.md` documents the "Rollout 压缩续接" behavior in Chinese and records the new environment variables.
  - `.agent-context/PROJECT_CONTEXT.md` records that the continuation bootstrap must carry explicit release rules and not rely only on a generic "read handoff" instruction.

## 2026-05-06 Thread Load Timing And Swipe Continuation

- User-reported issue:
  - Opening/loading a thread felt slow in Mobile Web.
  - The user also requested proactive `压缩续接` access through a left-swipe action.
  - Follow-up screenshot showed thread-list rows with the second metadata line clipped/overlapped after the left-swipe change.
- Runtime timing findings:
  - Local/LAN backend checks did not show app-server or 8787 service slowness during this check.
  - `http://127.0.0.1:8787/api/threads?limit=80&archived=false` was about `159ms`.
  - LAN `http://192.168.10.108:8787/api/threads?limit=80&archived=false` was about `65ms`.
  - Current newest thread detail `Codex Mobile 0505` was about `159ms` locally and `147ms` over LAN.
  - The slowest sampled visible detail read was `Hermes 05-05` at about `384ms`.
  - `/api/status` was healthy with `transport=external-jsonl-tcp`, `sharedRequired=true`, `lastError=null`.
  - `tailscale netcheck` showed the nearest DERP as `sfo` around `150ms`, and `pentium-iphone` appeared active through relay `sfo`; phone-side Tailscale/HTTPS can therefore add visible latency beyond the local/LAN API timings.
- Code changes:
  - `public/app.js` now renders a hidden `压缩续接` action for every thread list row.
  - A left swipe on a thread row reveals that action; tapping the row while an action is open closes it rather than accidentally opening the thread.
  - Re-tapping an already loaded current thread now keeps the existing detail view instead of forcing a fresh "Loading thread" state; explicit refresh remains available through the refresh control.
  - Existing over-threshold current-thread banner still exposes the normal `压缩续接` button.
  - `public/styles.css` adds the swipe-reveal row layout and mobile-friendly action area.
  - The thread list now uses a vertical flex layout and keeps the swipe action layer behind a full-height card layer without clipping the row wrapper, avoiding iOS/PWA text clipping of thread metadata.
- Documentation:
  - `README.md` now documents proactive left-swipe continuation in English and Chinese.
  - `.agent-context/PROJECT_CONTEXT.md` records the left-swipe continuation rule.

## 2026-05-03 Composer Send/Stop And Model Selectors - 21:18 +08:00

- User-requested adjustment:
  - During an active turn, the composer button should be `Stop` only when the composer is empty.
  - If text or attachments are present during an active turn, the same button should become `Send` and submit the new input.
  - Add model and reasoning effort selectors similar to Codex Desktop.
- Changes:
  - `public/app.js` now makes `Send`/`Stop` depend on both `activeTurnId` and composer content.
  - `public/app.js` now sends `model` and `effort` with message `FormData` only when the user selects non-default values.
  - `public/index.html` adds compact `Model` and `Reasoning` selectors in the composer.
  - `public/styles.css` styles the selectors for the compact composer.
  - `server.js` now exposes model and reasoning effort options via `/api/public-config`.
  - Model options can be overridden with `CODEX_MOBILE_MODEL_OPTIONS`; reasoning options can be overridden with `CODEX_MOBILE_REASONING_EFFORT_OPTIONS`.
  - Defaults are read from `%USERPROFILE%\.codex\config.toml` (`model` and `model_reasoning_effort`) when available.
  - `README.md` and `PROJECT_CONTEXT.md` document the new per-message selector behavior.
- Runtime state after restart:
  - Mobile Web wrapper PID `43952`, Node/listener PID `48832`.
  - Shared mux remains `external-jsonl-tcp`.
- Validation:
  - `npm.cmd run check` passed.
  - `/api/status` returns `ready=true`, `transport=external-jsonl-tcp`, `lastError=null`.
  - `/api/public-config` returns default model `gpt-5.5`, default reasoning effort `xhigh`, model options `gpt-5.5,gpt-5.4,gpt-5.4-mini,gpt-5.3-codex,gpt-5.3-codex-spark,gpt-5.2`, and efforts `low,medium,high,xhigh`.

## 2026-05-03 Composer Selector Compact Layout - 21:24 +08:00

- User-requested adjustment:
  - Model and reasoning selectors should not stack vertically.
  - Remove visible `Model` / `Reasoning` prompt text because it wastes space.
  - Avoid duplicate default values in the dropdown lists, such as two `GPT-5.5` or two `XHigh` entries.
- Changes:
  - `public/styles.css` now forces the selector area into two equal side-by-side columns.
  - `public/styles.css` hides the label text visually while keeping the labels for accessibility.
  - `public/app.js` now shows only the selected/default value in the collapsed controls, for example `GPT-5.5` and `XHigh`.
  - `public/app.js` now filters the current default value out of the explicit option list and treats a saved selection equal to the default as the default option.
- Validation:
  - `npm.cmd run check` passed.

## 2026-05-03 Mobile Foreground Black-Screen Recovery - 21:30 +08:00

- User-reported issue:
  - Voice input sometimes jumps to another app for permissions, then returns to Mobile Web with a black screen.
- Likely cause:
  - The page only handled `visibilitychange` by firing refresh requests; it did not force the app shell to re-show, re-render existing state, or reconnect SSE when returning from an external permission/input-method screen.
- Changes:
  - `public/app.js` adds `scheduleMobileResume()` / `resumeMobileSession()`.
  - Resume now handles `visibilitychange`, `pageshow`, `focus`, and `orientationchange`.
  - Resume re-shows the app shell, updates composer/layout height, renders cached current state immediately, reconnects SSE if closed, then refreshes status, thread list, and current thread.
  - `public/styles.css` uses `100dvh` for the app shell with a fallback to `100%`, and prevents body-level overflow after mobile viewport changes.
- Validation:
  - `npm.cmd run check` passed.
- Blocker:
  - GitHub CLI is installed, but `gh auth status` reports no authenticated GitHub hosts.
  - The available GitHub connector tools can operate inside existing repositories but do not expose repository creation.
- Local Git state:
  - Initial commit has been prepared locally on branch `main`.
  - No remote is configured because repository creation failed before authentication.
- Resume steps after authentication:
  - Run `gh auth login` in this Windows user session.
  - From `C:\Users\xuxin\Documents\codex-mobile-web`, create the private remote and push with `gh repo create codex-mobile-web --private --source . --remote origin --push`.

## 2026-05-03 GitHub Publish Completed - 18:17 +08:00

- GitHub CLI authenticated as account `pentiumxp`.
- Created private GitHub repository:
  - `https://github.com/pentiumxp/codex-mobile-web`
- Local Git state:
  - Branch: `main`
  - Remote: `origin` -> `https://github.com/pentiumxp/codex-mobile-web.git`
  - Tracking: `main` tracks `origin/main`
- Pushed commits:
  - `6f821a1 Initial Codex Mobile Web app`
- Validation after push:
  - `npm.cmd run check` passed.

## 2026-05-03 Composer Attachment Uploads - 18:17 +08:00

- Objective:
  - Add image and file upload support to the mobile interaction composer.
- Changed files:
  - `server.js`
  - `public/app.js`
  - `public/index.html`
  - `public/styles.css`
  - `README.md`
  - `.gitignore`
  - `.agent-context/PROJECT_CONTEXT.md`
- Runtime behavior:
  - Browser sends composer submissions as multipart `FormData` when attachments are present.
  - Server stores uploaded files under `%USERPROFILE%\.codex-mobile-web\uploads` by default.
  - `CODEX_MOBILE_UPLOAD_DIR` can override upload storage.
  - `CODEX_MOBILE_MAX_UPLOAD_BYTES` controls max total upload bytes per message, default `67108864`.
  - `CODEX_MOBILE_MAX_UPLOAD_FILES` controls max attachments per message, default `12`.
  - Uploaded images are passed to `turn/start` as app-server `localImage` input items.
  - Uploaded non-image files are referenced in the message text by absolute local path.
- Validation:
  - Official `openai/codex` source was checked for app-server v2 `UserInput` shape; `localImage` with `path` is supported, no generic file input exists.
  - `npm.cmd run check` passed.
  - `git diff --check` passed.
  - Temporary no-auth server on `127.0.0.1:8790` returned upload limits from `/api/public-config`.
  - Main server restarted on `0.0.0.0:8787`.
  - `/api/public-config` returns `maxUploadBytes=67108864` and `maxUploadFiles=12`.
  - Authenticated `/api/status` returned `ready=true`, `transport=managed-ws-child`, `lastError=null`.
- Current runtime PIDs after restart:
  - Wrapper PowerShell PID `15412`
  - Node PID `20868`
  - Managed app-server child PID `38792`

## 2026-05-03 Live Thread Refresh Diagnosis - 19:14 +08:00

- Objective:
  - Diagnose why the Codex Mobile Web conversation showed user messages but did not show later assistant updates.
- Findings:
  - Backend service on `8787` was alive and `/api/status` returned ready with managed app-server transport.
  - Authenticated thread detail for the active `codex-mobile-web` thread contained the newer assistant items, so the issue was client-side display/recovery, not missing backend data.
  - Browser validation showed reload/login landed on the home shortcuts view instead of automatically opening the active thread.
  - Browser validation also showed that opening the active thread renders the latest assistant content with no frontend console errors.
  - Existing polling stopped permanently after more than 60 stable polls, leaving SSE as the only update path during long-running turns.
- Changes:
  - `public/app.js` now keeps polling long-running active turns at a lower frequency instead of stopping after the stable-poll threshold.
  - `public/app.js` now persists the opened thread id and restores it after reload/login.
  - If there is no persisted thread id, startup opens the newest active thread when available.
  - Switching workspaces clears the persisted current-thread selection to avoid restoring a thread outside the selected workspace.
- Validation:
  - `npm.cmd run check` passed.
  - `git diff --check` passed.
  - Browser reload of `http://127.0.0.1:8787` automatically reopened the active `Codex webapp` thread and rendered the latest assistant updates.

## 2026-05-03 Desktop/Mobile Shared App-Server Bridge - 19:25 +08:00

- Objective:
  - Make the existing app-server mux bridge operational for Desktop/Mobile live convergence.
- Existing code confirmed:
  - `codex-app-server-mux.js` is the bridge: it accepts a Desktop stdio client, starts one real Codex app-server, and exposes `%USERPROFILE%\.codex\app-server-mux\endpoint.json` for Mobile Web.
  - Desktop currently launches its bundled `codex.exe app-server --analytics-default-enabled` directly unless launched with an override.
  - Mobile Web already detects the mux endpoint file when connecting to app-server.
- Changes:
  - `codex-app-server-mux.js` now passes through CLI arguments supplied by Desktop, falling back to `app-server --analytics-default-enabled` when no args are supplied.
  - Added `start-codex-desktop-shared.ps1`, a reversible launcher that sets `CODEX_CLI_PATH` to `codex-app-server-mux.cmd` only for the launched Desktop process.
  - Added authenticated `POST /api/app-server/reconnect` to let Mobile Web reconnect to a newly available mux endpoint without restarting the whole web server.
  - Updated `README.md` and `PROJECT_CONTEXT.md` with shared-mux setup and limitations.
- Operational notes:
  - To converge live UI state, fully quit Codex Desktop, launch it with `start-codex-desktop-shared.ps1`, then start or reconnect Mobile Web.
  - This bridge does not merge two already-running turns or retroactively inject missed content into an in-progress model call.
- Validation:
  - `npm.cmd run check` passed.
  - PowerShell parser check passed for `start-codex-desktop-shared.ps1`.
  - `git diff --check` passed.

## 2026-05-03 Desktop Shared Launcher `spawn EINVAL` Fix - 20:10 +08:00

- Problem:
  - Launching Codex Desktop through the new `Codex (MUX)` shortcut showed `spawn EINVAL`.
  - The launcher had set `CODEX_CLI_PATH` to `codex-app-server-mux.cmd`.
  - Codex Desktop uses direct process spawning for `CODEX_CLI_PATH`; on Windows this path must be a real executable, not a batch/cmd wrapper.
- Changes:
  - Added `codex-app-server-mux-shim.cs`.
  - `start-codex-desktop-shared.ps1` now builds generated `codex-app-server-mux.exe` from the shim source when missing or stale.
  - The launcher now sets `CODEX_CLI_PATH` to generated `codex-app-server-mux.exe`.
  - The launcher also sets `CODEX_MUX_SCRIPT_PATH` to `codex-app-server-mux.js`, `CODEX_MUX_CODEX_EXE` to the real Codex CLI, and `CODEX_MUX_NODE_EXE` when `node.exe` is discoverable.
  - `.gitignore` excludes generated `codex-app-server-mux.exe`.
  - `README.md` and `PROJECT_CONTEXT.md` now document the exe shim requirement.
- Validation:
  - `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-codex-desktop-shared.ps1 -PrintOnly` succeeded and generated `codex-app-server-mux.exe`.
  - `.\codex-app-server-mux.exe --mux-shim-version` returned `codex-app-server-mux-shim 1`.
  - `npm.cmd run check` passed.
  - PowerShell parser check passed for `start-codex-desktop-shared.ps1`.
  - `git diff --check` passed with only Git line-ending warnings.
- Operational note:
  - Existing Codex Desktop processes must be fully closed before relaunching through `Codex (MUX)`; already-running Desktop processes cannot inherit the corrected `CODEX_CLI_PATH`.

## 2026-05-03 Mobile Web No-Response / Mux Initialize Fix - 20:20 +08:00

- Symptom:
  - User reported that sending from Mobile Web produced no visible reaction and did not sync to this Desktop-side conversation.
- Findings:
  - Port `8787` was initially still running old `server.js` PID `20868`, started before the mux/reconnect changes; `POST /api/app-server/reconnect` returned 404.
  - After restarting Mobile Web, it still fell back to `managed-ws-child`.
  - Direct mux diagnostic showed the real shared app-server returned `Already initialized` for a second `initialize` request because Desktop had already initialized the same app-server.
  - Direct `thread/list` over the mux worked without a second initialize, confirming the shared app-server itself was usable.
- Changes:
  - `server.js` now calls `initialize({ allowAlreadyInitialized: true })` for external/shared endpoints.
  - If external/shared initialize returns `Already initialized`, Mobile Web treats the connection as ready instead of falling back to a managed child.
- Runtime actions:
  - Stopped old Mobile Web wrapper/server/managed child PIDs `15412`, `52580`, `20868`, `27476`.
  - Later stopped restarted managed fallback PIDs `10224`, `31512`, `33288`.
  - Restarted Mobile Web from current workspace on `0.0.0.0:8787`; current wrapper PID `22760`, Node PID `29288`.
  - Current mux PID `11600`, shared real app-server PID `57936`.
- Validation:
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only Git line-ending warnings.
  - `/api/status` now returns `ready=true`, `transport=external-jsonl-tcp`, endpoint source `%USERPROFILE%\.codex\app-server-mux\endpoint.json`, `lastError=null`.
  - `/api/threads/019ded32-ed92-7681-9591-0e4d457c5274` returns the current active thread with latest commentary items.
  - `/api/events` returns SSE status with `external-jsonl-tcp`.
- Operational note:
  - Mobile browser tabs connected before the restart may need a reload if their EventSource did not automatically reconnect after the 8787 process restart.

## 2026-05-03 Mobile Rendering Stability Pass - 20:32 +08:00

- User-reported issues:
  - Live command/file operation cards sometimes disappeared and were replaced by repeating `Reasoning` rows.
  - The lower-left turn timer overlapped final `in progress` / `syncing` turn status text.
  - The timer continued updating after completion instead of settling on a final elapsed value.
  - The top conversation header used too much vertical space by showing thread title, cwd, and status metadata.
- Changes:
  - `public/app.js` now treats reasoning items as non-conversation items everywhere in visible item selection and thread signatures.
  - Reasoning `item/started`, reasoning deltas, and reasoning timer updates no longer remove existing command/file/tool operation items.
  - Live operation visibility ignores later hidden reasoning items, so operation cards remain visible until later normal content arrives.
  - Turn completion checks now prioritize `completedAt`, `durationMs`, or completed/error/interrupted status before treating a turn as live.
  - The lower-left timer now clears its interval when no live turn exists and shows a settled final duration when the latest turn has completion timing.
  - The conversation area gets extra bottom padding while the timer is visible so the timer does not cover `in progress` / `syncing` status text.
  - `public/index.html`/`public/styles.css` now hide the thread title/meta header block and use smaller topbar icon buttons.
- Validation:
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only Git line-ending warnings.
  - `/api/status` still returns `ready=true`, `transport=external-jsonl-tcp`, `lastError=null`.
- Operational note:
  - Existing browser tabs need a page refresh to load the updated `public/app.js` and CSS.

## 2026-05-03 Topbar Thread Title And Turn Timer Adjustment - 20:36 +08:00

- User-requested adjustment:
  - Restore the thread name at the top of the conversation.
  - Do not render the turn timer and turn status as separate lines.
  - Move the current-turn timer to the top right if the lower-left placement is problematic.
- Changes:
  - `public/index.html` now places `#turnTimer` inside the topbar, between the thread title and interrupt button.
  - The topbar again shows `#threadTitle`; `#threadMeta` remains hidden, so cwd/status metadata does not take vertical space.
  - `public/app.js` now formats the timer as one line with status: `本轮 HH:MM:SS · <status>`.
  - Latest-turn status is hidden from the conversation body when the topbar timer can show the same status, avoiding duplicated two-line status/timer presentation.
  - `public/styles.css` now styles the timer as a compact top-right pill instead of a lower-left absolute overlay.
- Validation:
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only Git line-ending warnings.
  - `/api/status` still returns `ready=true`, `transport=external-jsonl-tcp`, `lastError=null`.
- Operational note:
  - Existing browser tabs need a page refresh to load the updated topbar layout.

## 2026-05-03 Operation Card Restore And Composer Stop Button - 20:43 +08:00

- User-reported issues:
  - After hiding reasoning, command/file operation cards also disappeared.
  - The separate topbar interrupt button did not match Codex Desktop behavior; the composer submit button should become the interrupt button while a turn is active.
- Findings:
  - Current app-server `thread/read` for the active Desktop-backed thread returned only `userMessage` and `agentMessage` items.
  - The raw rollout JSONL still contained operation runtime events such as `exec_command_end`, `patch_apply_end`, `function_call`, and `custom_tool_call`.
  - Status string compatibility also mattered: current turns use `inProgress`, while the live-turn regex only matched `in_progress` and `in-progress`.
- Changes:
  - `server.js` now treats `inProgress` / `inprogress` as a live status.
  - `server.js` now keeps the latest app-server operation item whenever a latest turn is live.
  - If app-server omits operation items, `server.js` reads the thread rollout JSONL tail and synthesizes one compact latest operation card from runtime events.
  - The synthesized card includes only command text or file names; it does not include command output or diffs.
  - `public/app.js` now treats `inProgress` / `inprogress` as running.
  - `public/app.js` preserves latest operation cards while a turn is active and appends the latest operation card after visible non-operation items.
  - The composer submit button now switches between `Send` and `Stop`; `Stop` calls the existing turn interrupt endpoint.
  - `public/styles.css` hides the old topbar interrupt button and styles `#sendMessage.interrupt-mode`.
- Runtime state after restart:
  - Mobile Web wrapper PID `6576`, Node PID `33644`.
  - Mux PID `11600`, shared real app-server PID `57936`.
- Validation:
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only Git line-ending warnings.
  - `/api/status` returns `ready=true`, `transport=external-jsonl-tcp`, `lastError=null`.
  - `/api/threads/019ded32-ed92-7681-9591-0e4d457c5274` now includes `commandExecution:1` in the latest in-progress turn.
- Operational note:
  - Existing browser tabs need a page refresh to load the updated composer button behavior and operation-card rendering.

## 2026-05-03 Thread Switch Performance Fix - 21:05 +08:00

- User-reported issue:
  - Switching threads in Mobile Web was slow and could appear stuck; restarting the app and restoring the previous thread was fast.
- Findings:
  - `/api/threads?limit=12&archived=false` returned in about 179 ms.
  - Old `/api/threads/:id` used app-server `thread/read includeTurns:true`; one visible `Hermes` thread took about 7.6 s while most others were under 1 s.
  - Direct `thread/turns/list` for the same slow thread returned in about 0.5-0.6 s.
  - The frontend did not cancel or sequence stale thread-load requests, so rapid switching could leave older slow reads in flight and produce stale UI updates.
- Changes:
  - `server.js` now serves `/api/threads/:id` through fast `thread/turns/list` plus local `state_5.sqlite` thread metadata.
  - `server.js` keeps `thread/read` only as a fallback if the fast turns-list path fails.
  - `server.js` normalizes `\\?\` cwd prefixes from state DB summaries before sending them to the browser.
  - `public/app.js` now assigns a sequence number to each thread switch, aborts the previous thread detail fetch, ignores stale responses, clears old live-poll timers, and renders an immediate lightweight loading state for the selected thread.
- Runtime state after restart:
  - Mobile Web wrapper PID `48976`, Node/listener PID `12888`.
  - Mux remains `external-jsonl-tcp` through `%USERPROFILE%\.codex\app-server-mux\endpoint.json`.
- Validation:
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only Git line-ending warnings.
  - `/api/status` returns `ready=true`, `transport=external-jsonl-tcp`, `lastError=null`.
  - After restart, the first 8 visible thread detail reads all used `mobileReadMode=turns-list`.
  - The previously slow `Hermes` detail read dropped from about 7.6 s to about 573 ms.
  - Current active thread detail still includes `commandExecution:1` in the latest turn.
- Operational note:
  - Existing browser tabs need a page refresh to load the updated thread-switch cancellation logic.

## 2026-05-03 Topbar Timer And Live Operation Flicker Adjustment - 21:12 +08:00

- User-requested adjustment:
  - Move the topbar current-turn timer to the far right.
  - Remove the `in progress` / status suffix from the timer text.
  - Reduce flashing when consecutive command/file operation cards update.
- Changes:
  - `public/app.js` now formats the timer as `本轮 HH:MM:SS` for both running and settled turns.
  - `public/app.js` now gives the live operation card a stable render key per turn, so a new command does not trigger a fresh entry animation for the whole card.
  - `public/styles.css` keeps the timer as a fixed-width right-side topbar element and disables entry animation on `.live-operation` cards.
  - `public/styles.css` narrows the mobile timer max width so the title remains usable.
- Validation:
  - `npm.cmd run check` passed.

## 2026-05-03 Active-Turn Web Input Desktop Echo Fix - 21:40 +08:00

- User-reported issue:
  - If a message is sent from Mobile Web while a turn is already running, Codex Desktop shows later assistant replies but does not show that user message live.
  - If the same message starts a new turn, Desktop shows it normally.
- Finding:
  - Current thread detail from Mobile Web already contained the mid-turn `userMessage` items, so persistence was intact.
  - The missing part was a Desktop-visible live notification for Web App active-turn input.
- Changes:
  - `public/app.js` now includes `activeTurnId` in composer submissions when a turn is running.
  - `server.js` now emits a mux-local `mux/userMessage` notification after `turn/start` succeeds, but only when connected through a shared mux endpoint that advertises `capabilities.mobileUserMessageEcho=true`.
  - `codex-app-server-mux.js` handles `mux/userMessage` locally and broadcasts it as an `item/completed` `userMessage` notification to mux clients, including Codex Desktop.
  - New mux endpoint files include `capabilities.mobileUserMessageEcho=true`; old running mux processes do not.
  - The mux also tracks `turn/started` / `turn/completed` notifications as a fallback for active turn ids.
- Runtime state after Web restart:
  - Mobile Web wrapper PID `57100`, Node/listener PID `17480`.
  - Mobile Web is ready on `0.0.0.0:8787` and connected to external shared mux endpoint `%USERPROFILE%\.codex\app-server-mux\endpoint.json`.
  - Running mux PID was still `11600` at validation time; its endpoint file had no capabilities block because it was started before this change.
  - To activate Desktop live echo for mid-turn Web input, fully quit Codex Desktop and relaunch through `Codex (MUX)` so the mux endpoint advertises `mobileUserMessageEcho`.
- Validation:
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only Git line-ending warnings.
  - `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, `lastError=null`.
  - Current thread detail used `mobileReadMode=turns-list`; latest in-progress turn `019dedf9-d737-70e1-99df-0057b88c1605` contained 3 `userMessage` items.

## 2026-05-03 No-Op Conversation Refresh Flicker Fix - 22:05 +08:00

- User-reported issue:
  - Codex reply text streams in correctly, but after a paragraph finishes the whole conversation appears to flash every few seconds even when no visible text changes.
  - After the first no-op skip pass, user still saw refresh-like flashes and asked to minimize global refreshes in favor of local refresh.
- Likely cause:
  - Polling and status refreshes could call `renderCurrentThread()` with unchanged visible content.
  - `renderCurrentThread()` replaced the entire `#conversation.innerHTML` each time, rebuilding the DOM even when the rendered text was identical.
  - Even when visible content changed only locally, the old path still replaced the whole conversation DOM.
- Changes:
  - `public/app.js` now tracks `state.renderedConversationSignature`.
  - Added `conversationRenderSignature()` based on visible turns, visible items, operation cards, status lines, omitted-history count, and leaving-operation keys.
  - Added `updateConversationHtml()` so no-op conversation refreshes do not touch the DOM.
  - Added a lightweight keyed DOM patcher (`patchHtml`, `patchNode`, `patchChildNodes`) so changed conversation renders reuse existing turn/item nodes by `data-render-key` and update only changed local text/attributes/children.
  - Thread list rendering now tracks `state.renderedThreadListSignature` and skips rebuilding the sidebar list when thread metadata has not changed.
  - Home shortcut rendering uses the same skip path to avoid unnecessary home DOM rebuilds.
  - Timer/title updates still run even when the conversation DOM is skipped.
- Runtime state after restart:
  - Mobile Web wrapper PID `57184`, Node/listener PID `55308`.
  - `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, `lastError=null`.
  - Current mux endpoint advertised `capabilities.mobileUserMessageEcho=true` on port `50163`.
- Validation:
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only Git line-ending warnings.
  - Current thread detail still used `mobileReadMode=turns-list`.
- Operational note:
  - Existing Mobile Web browser tabs need a page reload to load this updated `public/app.js`.

## 2026-05-03 Quota, Web Search, And Operation Ordering - 22:24 +08:00

- User-requested adjustments:
  - Show 5-hour and weekly quota remaining percentages to the right of the model/reasoning selectors, with 5-hour remaining before weekly remaining.
  - Render the quota values as a single compact numeric indicator in the same line as model/reasoning, formatted as `<5-hour remaining> | <weekly remaining>`.
  - Render Web Search like a compact Command/tool operation, not as an expanded structured payload.
  - Do not pin command/file operation cards to the bottom; newer normal messages should render below them, and a newer operation should replace older operation cards.
- Changes:
  - `server.js` now stores compact `account/rateLimits/updated` notifications and exposes them through `/api/status` and `/api/public-config`.
  - `public/app.js` selects the 5-hour quota window from the 300-minute `primary` rate-limit window and the weekly quota window from the 10080-minute `secondary` rate-limit window when present, displaying remaining percentages as `100 - usedPercent`.
  - `public/app.js` updates one compact `#quotaUsage` indicator with 5-hour and weekly remaining values separated by `|`.
  - `server.js` and `public/app.js` now classify Web Search payloads and rollout `web_search_*` events as compact `Web Search` operation cards.
  - `public/app.js` now keeps only the latest operation card but renders it in source order inside the turn instead of appending it to the bottom.
  - `public/index.html` and `public/styles.css` add the compact quota indicator next to the existing selectors.
  - `public/styles.css` keeps model, reasoning, and quota controls in one row while keeping model/reasoning selectors readable.
- Service recovery:
  - An interrupted restart left old 8787 process PID `55308` running, so new code was not loaded.
  - Stopped wrapper PID `57184` and child PID `55308`, then restarted with `start-codex-mobile-web.ps1`.
  - Current wrapper PID `49844`, Node/listener PID `50372`.
- Validation:
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only Git line-ending warnings.
  - LAN `/api/public-config` responds at `http://192.168.10.108:8787`.
  - Authenticated `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, `lastError=null`.
  - Latest validation showed Mobile Web should display about `86% | 20%` after status/bootstrap.
  - Current thread detail confirmed the latest command operation remains between surrounding agent messages in source order.

## 2026-05-03 Completion Refresh And Composer Layout

- User-reported issues:
  - At the end of a turn, the final streamed summary could finish line-by-line, then the screen could go black briefly before the complete content returned.
  - The Effort selector became too narrow after adding the quota indicator.
  - The quota indicator should stay at the far right of the selector row.
- Likely cause for the black-screen/end-of-turn flash:
  - `turn/completed` and the scheduled follow-up thread refresh both replaced local turn/thread state directly with the incoming payload.
  - If the completion payload or a fast server snapshot had fewer visible `items` than the locally streamed turn, the keyed DOM patcher correctly rendered that shorter state, temporarily removing visible content until a fuller snapshot arrived.
- Changes:
  - `public/app.js` now computes visible item weight and merges completion/thread refresh payloads without letting empty or shorter visible item snapshots overwrite local streamed items.
  - `public/app.js` preserves local in-progress turns if a refresh snapshot omits them.
  - `public/styles.css` gives Model and Effort readable grid tracks and makes the quota indicator a fixed-content right-aligned column.
- Validation:
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only Git line-ending warnings.

## 2026-05-03 Loading Thread Regression Fix

- User-reported issue:
  - Mobile Web could enter the app but remain stuck on `Loading thread`.
- Finding:
  - The new visible-item merge path was also used for initial `loadThread()`.
  - The initial placeholder thread carries `mobileLoading: true`; because the server detail payload does not include `mobileLoading`, `Object.assign({}, existingThread, incomingThread)` preserved the placeholder flag after a successful detail read.
  - Result: the thread detail data was loaded, but the UI still rendered the loading state.
- Changes:
  - `public/app.js` now clears placeholder-only `mobileLoading` and `mobileLoadError` flags when merging a real incoming thread payload that does not explicitly contain those fields.
  - `public/app.js` now catches keyed conversation patch failures and falls back to a full `innerHTML` render instead of leaving a stale loading screen.
- Validation:
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only Git line-ending warnings.

## 2026-05-03 Image Payload Rendering And Mobile Width Fix

- User-reported issues:
  - A huge image data payload appeared in the conversation after sending screenshots.
  - Image attachments in user messages were shown as paths/text instead of rendered images.
  - The mobile page width overflowed horizontally, clipping the right side of the top timer and `Stop` button.
- Findings:
  - App-server thread data can include image input parts as `{"type":"image","url":"data:image/png;base64,..."}` alongside the text attachment summary.
  - `public/app.js` rendered unknown input parts with `JSON.stringify(part)`, which expanded the full data URL into the conversation.
  - The same raw `content` array was used in visible-content signatures, making render signatures large when image data URLs were present.
  - Mobile composer minimum widths for Model/Effort/quota plus attachment/input/send controls exceeded the phone viewport.
- Changes:
  - `public/app.js` now normalizes input content signatures so data URLs are represented by a short signature, not the full payload.
  - `public/app.js` now renders `image` / `localImage` input parts as bounded thumbnails and skips expanded JSON rendering for image payloads.
  - `public/app.js` parses the text `Uploaded attachments` summary so image paths can be used as thumbnail sources instead of embedding large data URLs.
  - `server.js` adds authenticated `/api/uploads/file?path=<absolute-upload-path>` serving, restricted to the configured upload root.
  - `public/styles.css` adds bounded image/attachment styles and mobile-only composer grid areas so controls no longer force horizontal page overflow.
- Runtime:
  - Mobile Web was restarted after the `server.js` route change.
  - Current wrapper PID `10796`, Node/listener PID `50268`.
  - `/api/status` returns `ready=true`, `transport=external-jsonl-tcp`, `lastError=null`.
  - A known uploaded PNG returned `HTTP 200`, `Content-Type: image/png` through `/api/uploads/file`.
- Validation:
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only Git line-ending warnings.

## 2026-05-03 Mobile Attachment Picker Fix

- User-reported issue:
  - After the image rendering/mobile width changes, tapping `+` on the mobile composer no longer reliably attached images.
- Likely cause:
  - The old implementation kept `#fileInput` as `display:none` and opened it by calling `.click()` from the visual `+` button.
  - Mobile browsers, especially iOS/Safari contexts, can reject or ignore programmatic clicks on fully hidden file inputs.
- Changes:
  - `public/index.html` now makes `#attachFiles` a real file-picker label containing the `#fileInput`.
  - `public/styles.css` positions the transparent file input over the visible `+` affordance, so tapping the button hits the native file input directly.
  - `public/app.js` updates disabled/ARIA state through class attributes and keeps keyboard activation as a fallback.
- Validation:
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only Git line-ending warnings.

## 2026-05-03 Viewport-Based Operation Card Pruning

- User-reported issue:
  - When a new Command/operation card appears, removing the old card immediately can visibly flash, especially if the old card is large and still on screen.
- Change:
  - `public/app.js` now snapshots old operation cards before replacement if the old card is currently inside the conversation viewport.
  - Retained operation cards are reinserted in source order and do not run the short leave animation.
  - Retained cards are pruned after they leave the conversation viewport, with scroll-triggered and timed cleanup plus a 30-second failsafe.
  - `public/styles.css` disables animation for `.retained-operation`.
- Validation:
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only Git line-ending warnings.

## 2026-05-03 Active Turn Steering And Operation Retention Cap

- User-reported issues:
  - During an active turn, Mobile Web input and live guidance output were not consistently mirrored in Codex Desktop.
  - The top-right turn timer should use red/active styling while a turn is running, then revert to the settled muted styling after completion.
  - The previous viewport-based operation retention could stack multiple old Command cards during consecutive command updates.
- Findings:
  - The active-turn message path was using `turn/start` plus a mux-local synthetic `mux/userMessage` echo.
  - Current app-server supports `turn/steer` with `expectedTurnId`, which is the correct API for sending extra input into an already-running turn.
- Changes:
  - `server.js` now uses `turn/steer` when `activeTurnId` is present, returning immediately on success.
  - The older `mux/userMessage` synthetic echo remains only as a fallback if `turn/steer` is unavailable.
  - `public/app.js` now adds an `active` class to the top-right timer while the latest turn is running and removes it when settled/hidden.
  - `public/styles.css` gives `.turn-timer.active` the red active treatment while preserving the muted settled treatment.
  - `public/app.js` now caps retained old operation cards to one per thread/turn, so consecutive Command/file operation updates do not stack multiple old cards.
- Runtime after restart:
  - Mobile Web wrapper PID `29852`, Node/listener PID `49296`.
  - `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, `lastError=null`.
- Validation:
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only Git line-ending warnings.

## 2026-05-03 Image Thumbnail Size And Command Card Rule

- User-reported issues:
  - Uploaded images rendered too large in the conversation; they should appear as thumbnails.
  - Consecutive command updates could still show two Command cards. Desired behavior: only one Command card for consecutive operations; two cards are acceptable only when visible non-operation content appears between the older operation and the newer operation.
- Changes:
  - `public/styles.css` now caps conversation image thumbnails at `min(36vw, 160px)` wide and `120px` high.
  - `public/app.js` now retains an older operation card only if visible non-operation content exists after that operation in the same turn.
  - Consecutive operation updates without intervening visible content replace the current operation card instead of retaining the old card.
  - `PROJECT_CONTEXT.md` documents compact thumbnail rendering and the refined command-card retention rule.
- Validation:
  - `npm.cmd run check` passed.

## 2026-05-03 Center Image Thumbnails

- User-reported issue:
  - Single image thumbnails were left-aligned inside the message body, which looked visually unbalanced.
- Changes:
  - `public/styles.css` now centers `.input-image` thumbnails with horizontal auto margins.
  - Image captions are centered under thumbnails.
  - `PROJECT_CONTEXT.md` records that user-message images should render as compact centered thumbnails.

## 2026-05-03 Enlarge Image Thumbnails

- User-requested adjustment:
  - Centered image thumbnails were still too small; enlarge them by about 2x.
- Changes:
  - `public/styles.css` changed conversation image thumbnail caps from `min(36vw, 160px)` / `120px` to `min(72vw, 320px)` / `240px`.
  - `PROJECT_CONTEXT.md` records the current thumbnail size cap.

## 2026-05-03 Cross-Platform README

- User-requested documentation:
  - Write a README that someone can read after cloning, including Windows and Mac usage.
  - Clarify access-key generation and the easiest way for another user to enter/copy it.
- Changes:
  - `README.md` now has a platform support table, Windows standalone startup, macOS standalone startup, authentication flow, upload behavior, interface notes, Windows Desktop mux sync, macOS sync limitations, environment variables, and safety notes.
  - Authentication docs now state the exact key source priority and generation behavior: `CODEX_MOBILE_KEY`, then key file, then an 18-random-byte base64url key generated on first start.
  - README includes clipboard commands: Windows `Set-Clipboard`, macOS `pbcopy`.
  - README includes optional custom-key examples for demos on trusted private networks.
  - `PROJECT_CONTEXT.md` records the durable access-key generation behavior.

## 2026-05-03 Clean Public Release Repository

- User-requested action:
  - Create a clean release repository and remove Agent context from the submitted history.
- Release repo:
  - URL: `https://github.com/pentiumxp/codex-mobile-web-public`
  - Visibility: public
  - Local path: `C:\Users\xuxin\Documents\codex-mobile-web-public`
- Release construction:
  - Created a new local repository with no inherited Git history.
  - Copied only release files from the private workspace.
  - Excluded `.agent-context/` and `AGENTS.md`.
  - Added `.agent-context/` and `AGENTS.md` to the release `.gitignore`.
  - Updated the release README clone URL to `pentiumxp/codex-mobile-web-public`.
  - Changed release `LICENSE` copyright holder to `Codex Mobile Web contributors`.
- Validation:
  - Release repo has a single root commit: `95a04a9 Initial clean public release`.
  - `git ls-files` in the release repo returns 13 files and no `.agent-context` / `AGENTS.md`.
  - `npm.cmd run check` passed in the release repo.
  - Privacy scan in the release repo found no `xuxin`, `Hermes`, `C:\Users`, `192.168.10.108`, `.webui_secret`, old private repo clone URL, or `AGENTS` matches.

## 2026-05-03 Composer Keyboard Focus Suppression

- User-reported issue:
  - The message input could bring up the mobile input method even when the user did not intend to type.
- Finding:
  - `sendMessage()` called `input.focus()` in `finally`, so every send attempt could programmatically focus the textarea.
- Changes:
  - `public/app.js` now removes the automatic `input.focus()` after send.
  - After a successful send, `public/app.js` clears the textarea and calls `input.blur()` so the mobile keyboard closes instead of being reopened.
  - `PROJECT_CONTEXT.md` records that keyboards/input methods should open only after the user explicitly taps the textarea.

## 2026-05-03 README macOS App-Server Bridge Notes

- User-requested documentation:
  - README should clearly describe the macOS implementation approach for the bridge app-server path.
  - README should explicitly state Windows bridge support is implemented while macOS is not yet verified.
  - The public release README should be enough for another Codex agent to implement and validate macOS support.
- Changes:
  - `README.md` now has an `App-Server Bridge Design` section describing the mux flow shared by Desktop and Mobile Web.
  - Windows Desktop live sync is marked `implemented and verified`.
  - macOS Desktop live sync is marked `design documented, not yet packaged or verified on macOS`.
  - Added a macOS implementation plan covering `CODEX_CLI_PATH`, `CODEX_HOME`, `CODEX_MUX_SCRIPT_PATH`, `CODEX_MUX_CODEX_EXE`, optional `CODEX_MUX_NODE_EXE`, stdout cleanliness, argument passthrough, and fallback native shim requirements.
  - Added a macOS verification checklist for endpoint file, mux log, Mobile Web `external-jsonl-tcp` transport, Desktop-to-Mobile live updates, Mobile-to-Desktop mid-turn sync, and endpoint cleanup.
  - The clean public release repo README was synchronized while preserving the public clone URL and `.agent-context/` ignore note.

## 2026-05-04 Menu Workspace/Thread Loading Fix

- User-reported issue:
  - In the menu/sidebar workspace and thread switcher, the UI could get stuck showing `Loading thread` and the thread list would not repaint.
  - Selecting a workspace again from the workspace select could force the list to recover.
  - The conversation could also appear to shift upward and then downward even when visible content did not materially change.
- Findings:
  - `loadThreads()` directly replaced the thread list DOM with a loading placeholder but did not reset `state.renderedThreadListSignature`.
  - If the refreshed thread data was identical to the previous rendered list, `renderThreads()` skipped repainting and left the loading placeholder on screen.
  - Workspace shortcut and workspace select changes cleared thread state inline instead of using a shared reset path, so pending detail loads, poll timers, and home rendering could be left in inconsistent states.
  - Automatic scroll-to-bottom used smooth scrolling, which can produce visible whole-content motion during frequent live or near-no-op refreshes.
- Changes:
  - Added request sequencing and abort handling for thread-list loads.
  - Loading and error placeholders now update the thread-list render signature, so later successful results repaint even when the data is unchanged.
  - Workspace changes now call a shared current-thread reset helper that aborts pending detail loads, clears poll/refresh timers, clears retained operation cards, resets active turn state, and renders the home view immediately.
  - Opening the mobile menu now refreshes workspaces and threads.
  - Thread detail load failures now render an inline retry state instead of leaving the conversation permanently in `Loading thread`.
  - Composer controls remain disabled while a thread is loading or in a thread-load error state.
  - Automatic bottom scrolling is now immediate and no-op guarded instead of smooth.
- Validation:
  - `npm.cmd run check` passed in the private workspace.
  - `git diff --check` passed with only Git line-ending warnings.
  - The same front-end fix was synchronized to the clean public release workspace, where `npm.cmd run check`, `git diff --check`, and the public privacy scan passed.

## 2026-05-04 Desktop-Owned Mux Lifetime Finding

- Superseded by the keep-alive implementation below, but retained as the diagnosis that led to the fix.
- Current Windows Desktop live-sync mode is Desktop-owned:
  - Codex Desktop launches `codex-app-server-mux.exe` through `CODEX_CLI_PATH`.
  - The shim launches `node codex-app-server-mux.js`.
  - The mux launches the real `codex app-server` child and exposes the JSONL TCP endpoint consumed by Mobile Web.
- The mux is intentionally tied to Desktop stdio unless `CODEX_MUX_STANDALONE=1`:
  - When Desktop closes the mux stdin, `codex-app-server-mux.js` calls shutdown.
  - Shutdown removes the endpoint file, closes TCP, and kills the real app-server child.
- Operational implication:
  - If Mobile Web is actively interacting through `external-jsonl-tcp` and the Desktop app is fully quit, the Mobile Web server process remains running but its shared app-server connection is closed.
  - The active turn stream should be treated as interrupted in this mode.
  - Later Mobile Web requests may reconnect or fall back to its own managed app-server if the shared endpoint is unavailable, but that is a new app-server process, not continuation of the killed Desktop-owned process.
- Durable design note:
  - To allow Desktop to quit without affecting Mobile Web live turns, the bridge would need a daemon-style mux plus a Desktop stdio adapter, or Mobile Web must run standalone without Desktop live-sync.

## 2026-05-04 Shared Stream Strictness And Mux Keep-Alive

- User-requested product rule:
  - Shared live message stream is mandatory for Desktop/Mobile sync.
  - If the shared stream disconnects, Mobile Web should show a connection error rather than silently starting a separate managed app-server with a divergent stream.
  - Prefer keeping the stream process alive after Desktop exits; Desktop restart should reconnect to the same stream where possible.
- Changes:
  - `server.js` now treats detected mux endpoint files as required for the process lifetime.
  - `server.js` adds `CODEX_MOBILE_REQUIRE_SHARED_APP_SERVER=1` to require a shared endpoint even before a mux endpoint file exists.
  - If a shared endpoint is unavailable or closes, `server.js` sets a shared app-server error and does not fall back to a managed child.
  - `/api/status` now includes `sharedRequired`.
  - `public/app.js` shows `Shared` when using a shared endpoint and surfaces shared app-server errors in the connection label.
  - `codex-app-server-mux.js` adds `CODEX_MUX_KEEP_ALIVE=1`.
  - With keep-alive enabled, Desktop stdio disconnect removes only the Desktop client; mux, TCP endpoint, and the real app-server child remain alive.
  - When a new Desktop-launched mux starts while a live endpoint already exists, it acts as a stdio adapter to the existing mux instead of starting another real app-server.
  - The mux caches/replays the first successful `initialize` response so reconnecting Desktop clients can attach to an already-initialized app-server.
  - `start-codex-desktop-shared.ps1` now enables `CODEX_MUX_KEEP_ALIVE=1` by default, with `-NoMuxKeepAlive` as an opt-out.
  - `start-codex-mobile-web.ps1` adds `-RequireSharedAppServer`.
  - README and `PROJECT_CONTEXT.md` document strict shared-stream and keep-alive behavior.
- Validation:
  - `npm.cmd run check` passed.
- Remaining limitation:
  - Desktop UI foreground thread switching is still controlled by Codex Desktop, not by the app-server protocol. Reconnecting Desktop should attach to the same app-server process, but exact foreground route restoration depends on Desktop behavior.
- Runtime confirmation after Desktop restart:
  - `%USERPROFILE%\.codex\app-server-mux\endpoint.json` now points to `jsonl-tcp` port `64924`, mux Node PID `47860`, real app-server child PID `36432`, started at `2026-05-04T01:38:48.447Z`.
  - Codex Desktop process tree includes `Codex.exe` PID `27296` -> `codex-app-server-mux.exe` PID `44428` -> `node.exe` PID `47860` -> `codex.exe app-server` PID `36432`.
  - Mobile Web wrapper PID `49736`, Node PID `46112`.
  - Authenticated `/api/status` returns `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, `lastError=null`.
  - Mux log shows `replayed cached initialize result`, confirming the cached initialize/reconnect path is active.
- Runtime confirmation after a second Desktop restart:
  - Endpoint remained unchanged: port `64924`, mux Node PID `47860`, child app-server PID `36432`, started at `2026-05-04T01:38:48.447Z`.
  - New Desktop main PID became `51516`.
  - New Desktop-launched adapter process tree is `Codex.exe` PID `51516` -> `codex-app-server-mux.exe` PID `52068` -> `node.exe` PID `55728`.
  - Mux log shows `client disconnected c1 desktop-stdio`, then `attached desktop stdio to existing mux 127.0.0.1:64924 pid=47860`, then `replayed cached initialize result for c3`.
  - Authenticated `/api/status` still returns `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, `lastError=null`.

## 2026-05-04 Mobile Approval Control Work - 11:47 +08:00

- User-reported issue:
  - A normal-permission thread can block on command/file/permission approval, and Mobile Web did not show a usable approval notification.
- Findings:
  - The app-server sends approval prompts as server requests with both `method` and `id`, such as `item/commandExecution/requestApproval`, `item/fileChange/requestApproval`, `item/permissions/requestApproval`, plus legacy `execCommandApproval` and `applyPatchApproval`.
  - The previous mux treated all app-server messages with an `id` as responses to client requests. Server requests with ids were logged as `response for unknown request id ...` and dropped.
  - Because dropped server requests are not replayed by the app-server, a turn already blocked behind a dropped approval may need to be interrupted/retried or the shared mux/app-server restarted.
- Changes:
  - `codex-app-server-mux.js` now distinguishes app-server server requests (`id` + `method`) from responses (`id` without `method`), broadcasts server requests to clients, and forwards the first client response back to the real app-server.
  - The mux endpoint capability now includes `serverRequestProxy: true` when the new mux code is running.
  - `server.js` now stores pending server requests, exposes authenticated `GET /api/approvals`, accepts `POST /api/approvals/<requestId>` decisions, and sends JSON-RPC responses back through the shared app-server stream.
  - `public/app.js` renders pending approval cards in the current thread with `Allow once`, `Allow session`, and `Deny` actions.
  - `public/styles.css` adds compact approval-card styling.
  - `start-codex-desktop-shared.ps1` adds `-ForceRestartMux`, which stops the mux PID recorded in `%USERPROFILE%\.codex\app-server-mux\endpoint.json` before launching Desktop. This is needed after bridge-code changes because normal Desktop restarts attach to the old keep-alive mux.
  - `.gitignore` now ignores local `data/` logs and `*.log.err`, because server restarts can leave runtime log files in the workspace.
  - README and `PROJECT_CONTEXT.md` document approval proxying and the forced mux restart workflow.
- Validation:
  - `npm.cmd run check` passed.
  - `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-codex-desktop-shared.ps1 -PrintOnly` passed.
  - `git diff --check` passed with only Git line-ending warnings.
- Current runtime state:
  - Mobile Web server was restarted with new `server.js`; current 8787 listener is Node PID `53012`.
  - Authenticated `GET /api/approvals` now returns `200` with an empty `data` array.
  - Authenticated `/api/status` returns `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, `lastError=null`.
  - The old keep-alive mux has been replaced through `start-codex-desktop-shared.ps1 -ForceRestartMux`.
  - Current endpoint is port `62570`, mux Node PID `12780`, real app-server child PID `44104`, started `2026-05-04T03:57:34.646Z`.
  - Current mux endpoint capabilities are `{ mobileUserMessageEcho: true, serverRequestProxy: true }`, so approval server-request proxying is active.
  - Mobile Web was explicitly reconnected to this endpoint; authenticated `/api/status` reports `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, `lastError=null`, endpoint port `62570`, and `serverRequestProxy=true`.
  - Authenticated `/api/approvals` currently returns an empty `data` array.
  - Any approval prompt dropped by the old mux before the replacement cannot be replayed by app-server; that specific blocked operation should be retried if still needed.

## 2026-05-04 Public PR #1 Pulled Locally

- User reported a new GitHub pull request had been merged.
- Private repository `pentiumxp/codex-mobile-web` had no new remote commits after `git fetch origin --prune`; `main` remained at `aecf3c2`.
- The merged PR was in the clean public release repository `pentiumxp/codex-mobile-web-public`:
  - PR #1: `增加 macOS 共享启动支持并优化手机端消息显示`
  - Author: `franksong2702`
  - Merge commit: `73ff0bd`
- Local public release path `C:\Users\xuxin\Documents\codex-mobile-web-public` was fast-forwarded to `73ff0bd`.
- Public PR changed:
  - macOS launch scripts: `codex-app-server-mux-macos.sh`, `start-codex-desktop-shared-macos.sh`, `start-codex-mobile-web-macos.sh`, `start-codex-shared-mobile-macos.sh`
  - macOS README instructions
  - mobile Markdown rendering styles/logic
  - small server/mux memory-pressure and path-resolution fixes
- Validation in the public release repo:
  - `npm.cmd run check` passed.
- Not yet integrated into the private source workspace:
  - The private workspace currently has uncommitted local changes in overlapping files, including `server.js`, `public/app.js`, `public/styles.css`, `codex-app-server-mux.js`, and `README.md`.
  - Do not blindly copy or merge the public PR into the private workspace without reconciling it with the newer private approval-proxy and shared-stream changes.

## 2026-05-04 Private/Public Merge And Push Preparation

- User asked to push current private modifications and also merge the public PR.
- Process used:
  - Removed unused `web-push` dependency and untracked `package-lock.json`; the dependency was from earlier Web Push investigation and had no implementation references.
  - Committed private approval/shared-stream work first as `eb33384 Add shared approval controls`.
  - Added the local public release repo as remote `public` and fetched `public/main`.
  - Cherry-picked the four non-merge commits from public PR #1 into the private repository to preserve Frank Song's authorship and avoid unrelated-history merge noise:
    - `572f936` from public `5f39aa7`: macOS launcher and app-server path fixes
    - `1c73332` from public `858af2e`: macOS one-command shared/mobile launcher
    - `ea05c4c` from public `4c2cdb5`: mobile Markdown rendering
    - `eb5cb50` from public `59414eb`: lower live long-message memory pressure
  - Resolved the README conflict by keeping private Windows approval/keep-alive docs and adding the public macOS launcher instructions.
  - Added `.gitattributes` in `9c6969c` to force `*.sh` files to LF so `npm run check:macos` works from Windows checkouts.
- Validation after integration:
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed under available Windows bash after LF normalization.
  - `git diff --check` passed.
- Before pushing, ensure the clean public release repository is synchronized from the private source without copying `.agent-context/` or `AGENTS.md`.

## 2026-05-04 Mux Reconnect History Replay Fix

- User-reported issue:
  - After replacing mux, if Codex Desktop exits and then reopens, the shared stream still receives new messages, but Desktop does not backfill messages emitted while Desktop was offline.
- Runtime finding:
  - The current mux endpoint stayed alive at port `62570` with mux PID `12780` and app-server PID `44104`.
  - Mobile Web remained connected and healthy (`transport=external-jsonl-tcp`, `sharedRequired=true`, `lastError=null`).
  - Desktop reconnects were visible in mux log as `attached desktop stdio to existing mux 127.0.0.1:62570`, so the stream was connected; only offline event replay was missing.
- Root cause:
  - Keep-alive mux only cached and replayed the `initialize` result for reconnecting clients.
  - App-server notifications emitted while Desktop stdio was disconnected were broadcast to currently connected clients but not stored for later replay.
- Code change:
  - `codex-app-server-mux.js` now keeps a bounded replay buffer for recent `turn/*`, `item/*`, `thread/*`, and `account/rateLimits/updated` notifications.
  - On client `initialize`, mux replays unresolved server requests and buffered notifications to the reconnecting client.
  - Synthetic `mux/userMessage` notifications are also cached for replay.
  - New mux endpoint capability includes `notificationReplay: true`.
  - Replay controls:
    - `CODEX_MUX_REPLAY_BUFFER_LIMIT`, default `1200`
    - `CODEX_MUX_REPLAY_BUFFER_MAX_AGE_MS`, default `1800000` (30 minutes)
- Validation:
  - `node --check codex-app-server-mux.js` passed.
  - `npm.cmd run check` passed.
- Operational note:
  - The fix only applies after starting a new mux process from the updated file.
  - Events missed before the replay buffer existed cannot be reconstructed from mux memory; future offline intervals after replacement should replay within the buffer limit/age.
- Runtime activation:
  - User approved immediate mux replacement.
  - `start-codex-desktop-shared.ps1 -ForceRestartMux` returned `aborted` from the tool layer, but the replacement completed.
  - New endpoint file points to port `58264`, mux Node PID `28708`, real app-server child PID `50760`, started `2026-05-04T04:28:54.284Z`.
  - Endpoint capabilities are `{ mobileUserMessageEcho: true, serverRequestProxy: true, notificationReplay: true }`.
  - Mobile Web was explicitly reconnected to port `58264`; authenticated `/api/status` reported `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, and `lastError=null`.
  - Mux log confirmed replay path is active: `replayed 288 buffered message(s) to c3 after cached initialize`.

## 2026-05-04 Mobile Foreground Black-Screen Follow-Up

- User confirmed the input-method/external-app return path could still produce a black screen.
- Likely cause:
  - The previous resume path refreshed data once, but iOS can return from an input-method permission/app switch with a stale visual viewport height or blank composited layer.
  - A single resume render can run before `visualViewport.height` / `innerHeight` stabilizes.
- Changes:
  - `public/app.js` now maintains `--app-height` from `visualViewport.height`, `window.innerHeight`, or document client height.
  - `public/styles.css` uses `height: var(--app-height)` for `.app` instead of direct `100dvh`.
  - Foreground resume now runs visual-only recovery passes at multiple short delays, re-shows the app shell, re-renders cached content, updates composer height, and forces a lightweight repaint before doing the network refresh.
  - `visualViewport` resize/scroll and window resize update the viewport height variable without focusing the textarea.
- Validation:
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
- Operational note:
  - Existing browser tabs need a page refresh to load the updated `public/app.js` and CSS before this fix can affect the black-screen path.

## 2026-05-04 Desktop Reconnect Replay Rollback Fix

- User-reported issue:
  - After Desktop restart, the current thread initially displayed complete history, then a refresh rolled the visible UI back to an earlier partial point.
  - New turns still streamed to Desktop, which indicates the live connection itself was still attached.
- Likely cause:
  - The new mux notification replay sent historical `turn/*` and `item/*` incremental notifications to Desktop after cached `initialize`.
  - Desktop had already loaded durable thread history, so replaying older incremental UI events could overwrite or roll back the foreground view.
- Code change:
  - `codex-app-server-mux.js` now records each client's `initialize.params.clientInfo`.
  - Historical notification replay is sent only to clients identified as `codex-mobile-web` by default.
  - Pending approval/server requests are still replayed to all clients.
  - `CODEX_MUX_REPLAY_DESKTOP_NOTIFICATIONS=1` can opt Desktop back into historical notification replay for diagnostics.
- Validation:
  - `node --check codex-app-server-mux.js` passed.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
- Operational note:
  - This code change needs a fresh mux process before it affects Desktop reconnect behavior.
- Runtime activation:
  - A forced mux restart was requested; the tool reported `aborted`, but the restart completed.
  - Current endpoint file points to port `49686`, mux Node PID `11168`, real app-server child PID `54496`, started `2026-05-04T04:44:08.760Z`.
  - Mux log shows Desktop initialized with `name=Codex Desktop` and Mobile Web initialized with `name=codex-mobile-web`.
  - Authenticated `/api/status` reports `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, `lastError=null`, endpoint port `49686`.

## 2026-05-04 Duplicate Message Submission Guard

- User-reported issue:
  - A message could appear to submit twice, and long-running/stale turns increasingly required manual Stop.
- Runtime cleanup:
  - Found and stopped an old server process from `C:\Users\xuxin\Documents\Agent\tools\cli\codex-mobile-web` and its independent app-server child.
  - Current Mobile Web status remained healthy afterward: `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, `lastError=null`.
- Code change:
  - `public/app.js` now adds a `clientSubmissionId` to each composer message submission.
  - `server.js` keeps a short bounded message-submission dedupe map.
  - Server dedupe checks both `clientSubmissionId` and a content fingerprint made from thread id, active turn id, cwd, model, effort, message text, and attachment metadata.
  - If the same submission arrives again within `CODEX_MOBILE_MESSAGE_DEDUPE_WINDOW_MS` (default 90 seconds), the server returns the original in-flight/completed result and does not call app-server `turn/start` or `turn/steer` again.
  - Duplicate uploaded files saved by the repeated request are unlinked if they are under the configured upload root.
- Validation:
  - `node --check server.js` passed.
  - `node --check public/app.js` passed.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
- Operational note:
  - The server-side dedupe fix needs the Mobile Web Node server to be restarted before it affects live submissions.

## 2026-05-04 Stale Running Turn Diagnosis

- User-reported issue:
  - Desktop/Mobile interaction increasingly appears stuck and often requires pressing Stop.
  - The same user message could appear twice before the dedupe guard was added.
- Current evidence:
  - Mobile Web `/api/status` remains healthy: `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, `lastError=null`, mux port `49686`.
  - Thread `019ded32-ed92-7681-9591-0e4d457c5274` contains stale turn `019df149-500f-74b3-a038-849c5d2cfda7` still reported by app-server as `inProgress` with no `completedAt` / `durationMs`.
  - Later turns in the same thread already exist, including completed turns, so the stale in-progress turn is not the actual latest user intent.
  - Mux/app-server log repeatedly shows `thread/resume overrides ignored for running thread 019ded32-ed92-7681-9591-0e4d457c5274`, which is consistent with app-server treating the thread as still running and causing follow-up submissions/resumes to behave abnormally.
  - A long-lived PowerShell child under the app-server is the normal Rust command-safety PowerShell AST parser, not necessarily the stuck user command.
- Recommended next action:
  - Use the app-server `turn/interrupt` API once for stale turn `019df149-500f-74b3-a038-849c5d2cfda7`.
  - After interrupt, re-read only that turn's status and verify it is no longer `inProgress`.
  - Avoid broad `.codex` scans and avoid full mux replacement unless interrupt fails.

## 2026-05-04 iOS Composer Toolbar Mitigation And Activity Feedback - 14:02 +08:00

- User-reported issue:
  - On iOS, focusing the composer showed an extra browser/input accessory row above the keyboard, taking significant vertical space.
  - During long active turns, the UI could feel stuck when no command/file card or text delta was visibly changing.
- Code changes:
  - `public/index.html` replaces the native composer `textarea` with a `contenteditable` textbox.
  - `public/app.js` adds contenteditable-specific helpers for text read/write, enabled state, autosizing, paste handling, and Enter-to-send / Shift+Enter newline behavior.
  - `public/styles.css` moves the composer input styling to `.message-input`.
  - The active turn timer can now append a compact activity label from live app-server events: `思考`, `输出`, `命令`, `文件`, `工具`, `搜索`, `同步`, `等待批准`, etc.
  - Activity labels update only the timer text; they do not reintroduce reasoning rows and do not force full conversation rerenders.
- Validation:
  - `node --check public/app.js` passed.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with line-ending warnings only.
  - Authenticated `/api/status` reports `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, `lastError=null`.
- Operational note:
  - No Node server restart is required for these static frontend changes.
  - Existing browser tabs must refresh the page to load the new `index.html`, `app.js`, and `styles.css`.
  - The `contenteditable` mitigation can reduce the iOS native textarea accessory row, but iOS/browser-owned IME UI cannot be completely controlled from page CSS.

## 2026-05-04 Stable Turn Timer Activity Label Layout

- User-reported issue:
  - The new activity label in the top-right turn timer made the elapsed time text shift horizontally when labels such as `思考` and `等待批准` had different lengths.
- Code changes:
  - `public/app.js` now renders timer content as separate `.turn-timer-time` and `.turn-timer-detail` spans instead of one variable-length text node.
  - `public/styles.css` gives the timer a fixed responsive width, keeps the elapsed time span fixed, and ellipsizes only the activity label.
- Validation:
  - `node --check public/app.js` passed.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
- Operational note:
  - No Node server restart is required because this only changes static frontend files.

## 2026-05-04 README Update Before Private Push

- User requested commit and push, with README update notes made more detailed.
- README changes:
  - Expanded interface notes for activity labels, fixed timer layout, contenteditable composer, and no programmatic composer focus.
  - Added `Current Update Notes` covering shared Desktop/Mobile stream behavior, mux replay, approval controls, duplicate message submission handling, active-turn steering, and mobile UI recovery.
  - Added a restart/refresh matrix for frontend files, `server.js`, mux changes, shared launcher changes, and macOS scripts.
  - Documented `notificationReplay` in the mux endpoint capability example.
  - Added environment variables for message dedupe and mux replay buffer controls.
  - Added troubleshooting notes for `Loading thread`, Desktop/Mobile stream mismatch, missing approval cards, and iOS blank/black page recovery.
- Validation before commit:
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with line-ending warnings only.
- Scope:
  - Push target is the private `origin` remote: `https://github.com/pentiumxp/codex-mobile-web.git`.
  - The local `public` remote points to the clean public release directory and is not pushed by this step.

## 2026-05-04 Settled Timer Label

- User requested that right-side timer activity labels such as `同步` should not remain semantically active after the turn has ended.
- Change:
  - `public/app.js` now renders the settled/final timer detail as `已结束` when the latest turn has a final duration.
  - `README.md` and `PROJECT_CONTEXT.md` document the settled timer label behavior.
- Validation pending:
  - Run normal checks before commit and push.

## 2026-05-04 Runtime Inheritance And Mux Backpressure Fix

- User paused remote GitHub push; local commit/amend is allowed, but do not run `git push` until explicitly requested again.
- User-reported issues:
  - Desktop showed `Codex app-server websocket closed (code=1)` and stopped refreshing.
  - Mobile Web mid-turn messages sent through `turn/steer` could disappear from the sender's visible conversation.
  - Mobile Web turns did not inherit Desktop/thread permissions and output-detail settings closely enough, causing approval prompts even when Desktop was effectively running with high permissions.
- Findings:
  - Mux log showed `dropping slow tcp client ...`; the mux treated one `socket.write()` backpressure signal as a dead client and closed it.
  - Current app-server `turn/steer` returns a turn id but may not emit a visible user-message item.
  - Thread runtime permissions are available from the latest rollout `turn_context` and `state_5.sqlite` thread metadata; the current thread has `sandbox_policy={"type":"danger-full-access"}` plus a root-write/network-enabled permission profile.
- Changes:
  - `codex-app-server-mux.js` now logs TCP backpressure and waits for `drain` instead of closing the client.
  - `codex-app-server-mux.js` now uses deterministic synthetic user-message ids when `clientSubmissionId` is present.
  - `server.js` now reads the latest rollout `turn_context` and state DB metadata for thread runtime settings.
  - `server.js` forwards inherited approval policy, sandbox policy, reasoning summary, and config verbosity where supported during `thread/resume` / `turn/start`.
  - `server.js` sends a mux-local user-message echo after successful active-turn `turn/steer`.
  - `README.md` and `PROJECT_CONTEXT.md` document runtime inheritance and the backpressure behavior.
- Validation:
  - `node --check server.js` passed.
  - `node --check codex-app-server-mux.js` passed.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with line-ending warnings only.
- Activation notes:
  - `server.js` changes require restarting Mobile Web.
  - `codex-app-server-mux.js` changes require replacing the keep-alive mux, normally through `start-codex-desktop-shared.ps1 -ForceRestartMux` after Desktop is closed or ready to reconnect.

## 2026-05-04 Runtime Fix Activation Confirmed

- User restarted Codex Desktop after the mux backpressure fix.
- Confirmed mux endpoint file now points to a fresh shared endpoint:
  - Protocol: `jsonl-tcp`
  - Endpoint: `127.0.0.1:51838`
  - Mux PID: `32948`
  - Real app-server child PID: `24208`
  - Capabilities: `mobileUserMessageEcho=true`, `serverRequestProxy=true`, `notificationReplay=true`
- Confirmed active connections:
  - Mobile Web Node PID `46604` is listening on `0.0.0.0:8787`.
  - Desktop adapter PID `44640` is connected to mux port `51838`.
  - Mobile Web PID `46604` is connected to mux port `51838`.
- Authenticated `/api/status` confirms:
  - `ready=true`
  - `transport=external-jsonl-tcp`
  - `sharedRequired=true`
  - `lastError=null`
  - endpoint port `51838`
- Mux log after the fresh endpoint start no longer shows new `dropping slow tcp client` entries; the old entries were before the 07:32 mux restart.
- Remaining observed app-server warnings are upstream/runtime warnings, not Mobile Web transport failures:
  - ChatGPT backend plugin/event requests returning `403 Forbidden`.
  - Obsidian MCP resource/list template methods not found.
  - `thread/resume` overrides ignored for an already running thread; inherited runtime settings are still applied on the next `turn/start` path.
- Remote push remains paused by user instruction; local branch is ahead of `origin/main`.

## 2026-05-04 Visible External Input Regression Fix

- User-reported issue:
  - Inputs sent from Mobile Web during an active turn were no longer visible in the message stream.
  - The regression appeared after adding duplicate-submission protection.
- Root causes:
  - `server.js` deduplicated modern submissions by both `clientSubmissionId` and content fingerprint. This could suppress intentional repeated short messages inside the dedupe window.
  - Synthetic mux-local `mux-user-*` user-message echo items are live stream artifacts; app-server historical thread snapshots may not include them. A later thread refresh could therefore replace the visible item list and drop the user's mid-turn input.
- Changes:
  - `server.js` now deduplicates requests with `clientSubmissionId` by that id only.
  - Content-fingerprint dedupe remains only for legacy/no-id requests.
  - `public/app.js` thread refresh merges now preserve local-only `mux-user-*` user-message items.
  - `public/app.js` also preserves richer visible fields for existing items when an incoming snapshot is shorter for the same item id.
  - `README.md` and `PROJECT_CONTEXT.md` document the revised dedupe and merge behavior.
- Validation:
  - `node --check server.js` passed.
  - `node --check public/app.js` passed.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with line-ending warnings only.
- Activation notes:
  - `server.js` changes require restarting Mobile Web.
  - `public/app.js` changes require refreshing existing browser/mobile tabs to load the new frontend bundle.

## 2026-05-04 Full Access Approval Normalization

- User-reported issue:
  - Mobile Web still showed many command approval cards even though the thread was expected to be in full-access mode.
- Findings:
  - Current thread `019ded32-ed92-7681-9591-0e4d457c5274` has `sandbox_policy={"type":"danger-full-access"}` in `state_5.sqlite`.
  - The same thread and latest rollout `turn_context` still store `approval_policy="on-request"`.
  - Therefore the sandbox/file permissions were being inherited, but approval policy still allowed command approval prompts.
- Change:
  - `server.js` now treats inherited full access as authoritative for Mobile Web new turns.
  - If sandbox policy is `dangerFullAccess`, or the permission profile grants root write access, and approval policy is missing or `on-request`, Mobile Web sends `approvalPolicy: "never"` on `turn/start`.
  - This applies only to new turns. Existing active turns keep their already-started runtime settings; `turn/steer` cannot change approval policy mid-turn.
- Documentation:
  - `README.md` and `PROJECT_CONTEXT.md` document this full-access approval normalization.
- Validation:
  - `node --check server.js` passed.
  - `node --check public/app.js` passed.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with line-ending warnings only.
- Runtime activation:
  - Mobile Web restarted after the change.
  - Current Mobile Web Node PID `56684` listens on `0.0.0.0:8787`.
  - Authenticated `/api/status` reports `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, `lastError=null`, endpoint port `51838`.
  - Existing active turns keep their original approval policy; the full-access normalization applies to subsequent `turn/start` calls.

## 2026-05-04 Approval Card Placement And Settled Compact State

- User-reported issue:
  - Command approval cards remained as large cards at the bottom of the conversation after approval, occupying too much space.
- Changes:
  - `public/app.js` now associates approval requests with their `params.turnId` when available.
  - Approval cards for visible turns render inside the matching turn instead of in the bottom fallback stack.
  - Only active waiting approvals without a visible turn remain in the bottom fallback stack.
  - Answered/resolved approvals render as a compact one-line in-turn status.
  - `public/styles.css` adds compact approval row styling and in-turn approval spacing.
  - `README.md` and `PROJECT_CONTEXT.md` document the behavior.
- Validation:
  - `node --check public/app.js` passed.
  - `node --check server.js` passed.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with line-ending warnings only.
- Activation note:
  - This approval placement change is frontend/CSS only; existing browser tabs need a page refresh to load it.

## 2026-05-04 Public Repository PR Merge Sequence

- User requested checking the latest public GitHub repository and merging PRs in order starting from PR #6.
- Public repository:
  - `https://github.com/pentiumxp/codex-mobile-web-public`
  - Local path: `C:\Users\xuxin\Documents\codex-mobile-web-public`
- Merged and pushed public PRs:
  - PR #6 `增加协议级回归测试` -> merge commit `f2dbf90bc0f352b21ff86f5deba7052e830beb97`
  - PR #7 `完善手机端 server request 处理` -> merge commit `f3608e744628879a97fa564cabb2ad9369f0c655`
  - PR #8 `增加 PWA 主屏幕支持` -> merge commit `ffa2792eabbf33cd12af56090d7c07e80a48a725`
- PR #6 local finding:
  - Its new `npm test` initially failed on Windows because the test tried to spawn `mock-codex-app-server.js` directly, which raised `spawn EFTYPE`.
  - The merge commit fixed the test to launch the mock through `process.execPath` and pass the mock script via `CODEX_MUX_CODEX_ARGS`, making the test cross-platform.
- PR #7 merge details:
  - Three-way merge after PR #6 preserved the new CI/test files.
  - Actual changed files were `public/app.js`, `public/styles.css`, and `server.js`.
- PR #8 merge details:
  - Resolved `package.json` conflict by keeping `npm test` from PR #6 and adding `public/sw.js` to `npm run check`.
  - Added PWA manifest, icons, and service worker static shell caching.
- Validation completed after each merge as applicable:
  - `npm.cmd test`
  - `npm.cmd run check`
  - `npm.cmd run check:macos`
  - `git diff --check`
  - For PR #8, also checked `manifest.json` parsing and PNG icon dimensions `192x192`, `512x512`, and `180x180`.
- Final public repository state:
  - `main` is synchronized with `origin/main`.
  - No open PRs remained after merging #6, #7, and #8.

## 2026-05-04 Live Agent Text Disappearing During Stream

- User-reported issue:
  - During live agent output, text appeared line by line, then the whole current paragraph/section could disappear briefly and reappear a few seconds later.
- Diagnosis:
  - The running Mobile Web process was confirmed to use private workspace `C:\Users\xuxin\Documents\codex-mobile-web\server.js`, not the public release checkout.
  - Public PR merging did not directly change the running code.
  - Two frontend merge paths could still cause the observed symptom:
    - `item/completed` / `item/started` upserts replaced an existing streamed item with the incoming item object, even if the incoming object had less visible text.
    - Thread refresh merges preserved synthetic `mux-user-*` user messages, but did not preserve local-only visible assistant/operation items when the app-server snapshot was shorter than the local streamed state.
- Code change:
  - `public/app.js` now uses `mergeItemPreservingVisibleFields()` when upserting an existing item, so short completion/status events cannot erase already-streamed text.
  - `public/app.js` now preserves local-only visible non-reasoning items when an incoming turn snapshot has lower visible weight than the existing local turn.
  - The same frontend fix was also applied to the clean public release checkout at `C:\Users\xuxin\Documents\codex-mobile-web-public\public\app.js`.
- Validation:
  - Private checkout: `npm.cmd run check`, `npm.cmd run check:macos`, and `git diff --check` passed with line-ending warnings only.
  - Public checkout: `npm.cmd test`, `npm.cmd run check`, `npm.cmd run check:macos`, and `git diff --check` passed with line-ending warnings only.
- Activation note:
  - This is a static frontend change. Existing browser/mobile tabs need a page refresh to load the fixed `public/app.js`; the Node server does not need to restart.

## 2026-05-04 Image Upload Duplicate And Base64 Rendering Fix

- User-reported issue:
  - Uploading an image could show the submitted user message twice.
  - One copy could render a large base64/data-url-like payload as garbled text before the attachment path.
- Diagnosis:
  - The affected Hermes thread item contained a normal text attachment summary with the local upload path, plus a second app-server-snapshot part shaped like `{ truncated: true, totalChars, preview: "{\"type\":\"image\",\"url\":\"data:image/png;base64,...` }`.
  - `public/app.js` did not recognize that truncated snapshot part as an image, so it rendered the compacted JSON preview as ordinary text.
  - During active-turn image input, Mobile Web can first show a synthetic `mux-user-*` echo, then later receive the real app-server `userMessage` with a different item id; previous merge logic preserved both.
- Code change:
  - `public/app.js` now recognizes truncated data-image preview payloads as image input parts, preventing the base64 JSON preview from rendering as text.
  - When a matching attachment summary exists, the image renders from the local upload path as a thumbnail.
  - `public/app.js` now compares synthetic `mux-user-*` user messages with incoming real `userMessage` items by normalized text and upload paths.
  - Matching synthetic echoes are dropped during thread refresh merges and when a real `userMessage` is upserted, preventing duplicate display.
  - The same fix was applied to the clean public release checkout at `C:\Users\xuxin\Documents\codex-mobile-web-public\public\app.js`.
- Validation:
  - Private checkout: `npm.cmd run check`, `npm.cmd run check:macos`, and `git diff --check` passed with line-ending warnings only.
  - Public checkout: `npm.cmd test`, `npm.cmd run check`, `npm.cmd run check:macos`, and `git diff --check` passed with line-ending warnings only.
- Activation note:
  - This is a static frontend change. Existing browser/mobile tabs need a page refresh to load the fixed `public/app.js`.

## 2026-05-04 Input Method Black-Screen Recovery And Assistant Duplicate Guard

- User-reported issues:
  - Switching to the Doubao input method and letting it switch back could still leave the mobile Web UI black until the app was minimized and reopened.
  - Assistant/Codex output cards were frequently duplicated in the UI, while the fetched thread history did not contain duplicate agent messages.
- Diagnosis:
  - Existing foreground recovery relied mostly on `visibilitychange`, `pageshow`, `window focus`, `orientationchange`, and `visualViewport` resize/scroll.
  - Some input-method return paths do not reliably fire page-level focus/visibility events, so the composited viewport can stay stale or black.
  - Assistant duplicate display was caused by the local merge guard preserving a streamed local `agentMessage` while a later server snapshot supplied the same text under a different item id.
- Code change:
  - `public/app.js` now has a visual-only recovery pulse separate from network refresh.
  - Visual recovery is scheduled from `window blur`, `focusin`, `focusout`, `resize`, and `visualViewport` resize/scroll.
  - Heavy visual recovery updates `--app-height`, re-shows the app shell, applies a short compositing transform, and uses delayed repeated repaint pulses without forcing API refreshes.
  - `focusin`, `focusout`, `resize`, and `visualViewport` recovery are lightweight and do not transform the scroll container.
  - Touch/pointer start recovery was deliberately not used because it can cancel normal iOS scrolling when the user starts dragging the conversation.
  - `public/styles.css` adds stronger temporary compositing/repaint styles for `visual-recovering` and `resume-repaint`.
  - `public/app.js` now deduplicates local streamed `agentMessage` / `plan` items against incoming real items when the incoming text is the same or a longer continuation of the local text.
  - The same frontend/CSS changes were also applied to the clean public release checkout at `C:\Users\xuxin\Documents\codex-mobile-web-public`.
- Validation:
  - Private checkout: `npm.cmd run check`, `npm.cmd run check:macos`, and `git diff --check` passed with line-ending warnings only.
  - Public checkout: `npm.cmd test`, `npm.cmd run check`, `npm.cmd run check:macos`, and `git diff --check` passed with line-ending warnings only.
- Activation note:
  - This is a static frontend/CSS change. Existing browser/mobile tabs need a page refresh to load the fixed `public/app.js` and `public/styles.css`; the Node server does not need to restart.

## 2026-05-04 Late Mux User Echo Duplicate Guard

- User-reported issue:
  - The same Mobile Web `You` message could still appear twice, for example the text `主要是因为刚才Tailscale 没有直连，现在已经好了。`.
- Diagnosis:
  - The authenticated thread history for Hermes thread `019dde72-2de7-7542-b43f-d7fa0d98fb21` contained only one real `userMessage` for that text.
  - The duplicate was therefore a browser-local merge artifact, not a double write into app-server history.
  - Existing frontend logic handled the order `mux-user-*` echo first, real `userMessage` later. It did not handle the reverse order where the real item arrived first and a replayed or delayed `mux-user-*` echo arrived later.
- Code change:
  - `public/app.js` now detects a `mux-user-*` user-message echo that is shadowed by a matching real `userMessage` in the same item list.
  - Late shadowed mux echoes are dropped in `upsertItem`.
  - Thread refresh merges also remove shadowed mux echoes after merging existing and incoming items, covering replay/order variations.
  - The same fix was applied to the clean public release checkout at `C:\Users\xuxin\Documents\codex-mobile-web-public\public\app.js`.
- Validation:
  - Private checkout: `npm.cmd run check`, `npm.cmd run check:macos`, and `git diff --check` passed with line-ending warnings only.
  - Public checkout: `npm.cmd test`, `npm.cmd run check`, `npm.cmd run check:macos`, and `git diff --check` passed with line-ending warnings only.
- Activation note:
  - This is a static frontend change. Existing browser/mobile tabs need a page refresh to load the fixed `public/app.js`; the Node server does not need to restart.

## 2026-05-05 Web Push Port Correction

- User requested restoring Codex Mobile Web to local port `8787`.
- Runtime state after correction:
  - Codex Mobile Web wrapper PID `60628`, Node PID `16148`.
  - Codex Mobile Web listens on `0.0.0.0:8787`.
  - Hermes Web currently listens on `0.0.0.0:8797` with Node PID `42396`.
  - Tailscale Serve maps `https://gmk.tail62e8ce.ts.net:8443/` to `http://127.0.0.1:8787`.
  - Tailscale Serve root `https://gmk.tail62e8ce.ts.net/` remains mapped to Hermes Web at `http://127.0.0.1:8797`.
- Code/doc state:
  - `server.js`, `start-codex-mobile-web.ps1`, `start-codex-mobile-web-macos.sh`, `README.md`, and `PROJECT_CONTEXT.md` have been restored to default Codex Mobile Web port `8787`.
  - Web Push work remains in progress in the working tree and is not yet committed.

## 2026-05-05 iOS Dynamic Island Safe Area

- User-reported issue:
  - The top menu bar occupied the iPhone Dynamic Island/status-bar area and the menu button became hard or impossible to tap.
- Changes:
  - `public/index.html` changed `apple-mobile-web-app-status-bar-style` from `black-translucent` to `black`.
  - `public/styles.css` now applies `env(safe-area-inset-top, 0px)` to the top conversation bar.
  - `public/styles.css` also applies the same top safe-area inset to the mobile sidebar, so the menu page header does not start under the status bar.
- Activation note:
  - This is a static frontend change. Existing phone/PWA sessions need a page refresh or app relaunch to load the updated HTML/CSS.

## 2026-05-05 Web Push Apple BadJwtToken Fix

- User-reported issue:
  - Notifications were enabled and a test notification was sent from Mobile Web, but no notification arrived.
- Diagnosis:
  - Runtime subscription existed in `%USERPROFILE%\.codex-mobile-web\web-push-subscriptions.json`.
  - The stored endpoint host was Apple Push (`web.push.apple.com`).
  - Authenticated `POST /api/push/test` initially returned `sent=0`, `failed=1`.
  - Direct diagnostic send showed Apple returned HTTP `403` with reason `BadJwtToken`.
  - The VAPID subject in `%USERPROFILE%\.codex-mobile-web\web-push-vapid.json` was `mailto:codex-mobile-web@localhost`.
  - Reusing the same VAPID key with a non-localhost subject was accepted by Apple with HTTP `201`.
- Changes:
  - `server.js` default Web Push VAPID subject is now `mailto:codex-mobile-web@example.com` instead of a localhost address.
  - `server.js` automatically repairs existing runtime VAPID files whose subject contains `localhost`, while preserving the same public/private key pair.
  - `server.js` now returns sanitized Web Push send failure details from `/api/push/test`.
  - `public/app.js` now reports test-send failure explicitly instead of showing `No push subscription` when a subscription exists but delivery fails.
  - Turn-completed Web Push payloads now use `Codex Mobile Web` as the notification title and body `<thread-title> · This turn 已结束 · <local time>`.
  - Notification click targets include `/?thread=<threadId>`, and the browser now loads that thread directly from the URL even when it is not present in the first rendered thread list.
  - `README.md` documents Web Push setup, iOS Home Screen requirements, local runtime files, and the non-localhost VAPID subject requirement.
- Runtime state after restart:
  - Codex Mobile Web wrapper PID `48188`, Node PID `54184`.
  - Codex Mobile Web listens on `0.0.0.0:8787`.
  - Authenticated `GET /api/status` through `https://gmk.tail62e8ce.ts.net:8443` returned `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, `lastError=null`.
  - Authenticated `GET /api/push/vapid-public-key` returned subject `mailto:codex-mobile-web@example.com`.
  - Authenticated `POST /api/push/test` returned `sent=1`, `failed=0`, `removed=0`.
  - `%USERPROFILE%\.codex-mobile-web\web-push-vapid.json` has been repaired to the non-localhost subject; do not commit or copy the raw key material.
- Validation:
  - `node --check server.js` passed.
  - `node --check public/app.js` passed.
  - `node --check public/service-worker.js` passed.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with line-ending warnings only.

## 2026-05-05 Web Push Completion Title Adjustment

- User-reported issue:
  - Automatic turn-completed notifications used the thread name, for example `Hermes`, as the system notification title.
  - Test notifications already used the expected app title.
- Change:
  - `server.js` now uses `Codex Mobile Web` as the title for automatic turn-completed notifications.
  - The thread title remains in the notification body as `<thread-title> · This turn 已结束 · <local time>`.
  - `README.md`, `PROJECT_CONTEXT.md`, and the public release checkout were updated to match this behavior.
- Runtime activation:
  - Mobile Web was restarted on `0.0.0.0:8787`.
  - Current wrapper PID `51516`, Node PID `41324`.
  - Authenticated `/api/status` through `https://gmk.tail62e8ce.ts.net:8443` returned `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, `lastError=null`.
- Validation:
  - Private checkout: `npm.cmd run check`, `npm.cmd run check:macos`, and `git diff --check` passed with line-ending warnings only.
  - Public checkout: `npm.cmd run check`, `npm.cmd run check:macos`, `npm.cmd test`, and `git diff --check` passed with line-ending warnings only.

## 2026-05-05 Windows Hidden Startup Task

- User requested making the Codex Mobile Web listener run with no visible window and start with Windows.
- Added scripts:
  - `start-codex-mobile-web-hidden.vbs` launches PowerShell through `WScript.Shell.Run(..., 0, True)` so the Windows startup path does not create a visible console window while the Scheduled Task remains running.
  - `start-codex-mobile-web-windowless.ps1` runs the existing `start-codex-mobile-web.ps1` path and appends logs to `%USERPROFILE%\.codex-mobile-web\codex-mobile-web.startup.log`.
  - `install-codex-mobile-web-startup.ps1` registers a per-user Scheduled Task named `Codex Mobile Web` that starts at Windows logon with `wscript.exe start-codex-mobile-web-hidden.vbs`.
  - `uninstall-codex-mobile-web-startup.ps1` removes the Scheduled Task and can stop it first with `-StopRunning`.
- The startup task defaults to `-RequireSharedAppServer`, matching the project rule that Mobile Web should not silently create a divergent managed app-server stream when the shared mux is expected.
- README and PROJECT_CONTEXT document the hidden startup behavior and reinstall/remove commands.
- Runtime activation:
  - Registered Scheduled Task `Codex Mobile Web` for the current Windows user.
  - Current task state is `Running`; Task Scheduler result `267009` means the long-running task is active.
  - Current hidden launcher PowerShell PID `36100`; Node listener PID `8124`.
  - `0.0.0.0:8787` is listening from PID `8124`.
  - Authenticated `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, and `lastError=null`.
- Validation:
  - PowerShell parser checks passed for the three startup scripts.
  - `npm.cmd run check` passed.
  - `git diff --check` passed with line-ending warnings only.

## 2026-05-05 Windows Startup Survive Sign-Out Fix

- User reported that the hidden startup task stopped when the current Windows user signed out, then came back after the user logged in again.
- Root cause:
  - The first task was an interactive `AtLogOn` task with `LogonType=Interactive`.
  - Windows terminates processes in that interactive user session on sign-out, so the Mobile Web listener could not survive sign-out.
- Changes:
  - `install-codex-mobile-web-startup.ps1 -RunAsSystem` now creates an `AtStartup` trigger running as `LocalSystem`.
  - Running as `LocalSystem` requires elevated PowerShell, but does not store the Windows user password and is not tied to the visible desktop session.
  - `-InteractiveLogon` is available only for the older sign-in-bound behavior.
  - `start-codex-mobile-web-windowless.ps1` gained `-UserProfilePath` to force the background task to use the real user profile paths for `%USERPROFILE%`, `CODEX_HOME`, and `CODEX_MOBILE_RUNTIME_DIR`.
  - `start-codex-mobile-web-windowless.ps1` gained `-EnsureStandaloneMux`; when shared-stream mode is required, it starts `codex-app-server-mux.js` with `CODEX_MUX_STANDALONE=1` and `CODEX_MUX_KEEP_ALIVE=1` if no live mux endpoint exists.
  - The default installed task passes `-EnsureStandaloneMux -RequireSharedAppServer`, so Mobile Web keeps one mux-backed app-server stream and does not silently fall back to a divergent managed child.
- Operational implication:
  - The background task can keep Mobile Web and the mux endpoint alive after sign-out.
  - Codex Desktop should still be launched through `start-codex-desktop-shared.ps1` when the user logs back in, so Desktop attaches to the existing mux endpoint instead of starting its own independent app-server.
- Runtime activation:
  - Elevated install through UAC completed successfully.
  - Scheduled Task `Codex Mobile Web` is now `AtStartup`, `UserId=SYSTEM`, `LogonType=ServiceAccount`, `RunLevel=Highest`.
  - Current task action is `wscript.exe start-codex-mobile-web-hidden.vbs -HostAddress 0.0.0.0 -Port 8787 -UserProfilePath C:\Users\xuxin -EnsureStandaloneMux -RequireSharedAppServer`.
  - Current task state is `Running`; `0.0.0.0:8787` is listening from Node PID `40348`.
  - Authenticated `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, and `lastError=null`.
- Current limitation:
  - During this active Desktop turn, the background task reused the already-running Desktop-owned mux endpoint (`endpoint.json` PID `14328`) to avoid interrupting the current Desktop session.
  - A full immediate ownership switch to a SYSTEM-owned standalone mux requires stopping the existing mux endpoint and restarting Mobile Web, which will disconnect the current Desktop app-server stream. The safer time to do that is after the current turn ends or after a Windows reboot, where no Desktop-owned mux exists yet.

## 2026-05-05 Thread Detail 404 After SYSTEM Task Switch

- User reported that after switching/restarting the background task, opening a thread failed with `Thread is archived, deleted, or outside visible workspace`.
- Diagnosis:
  - `/api/threads?limit=...` still returned visible threads with correct `cwd`.
  - `/api/threads/{id}` returned 404 for known visible thread ids.
  - Under the SYSTEM task environment, `readStateDbThread()` could fail to get the per-thread summary from local `state_5.sqlite` via `sqlite3`.
  - The detail route then built a thread from `thread/turns/list` without `cwd`, and the visible-workspace filter treated the thread as outside visible workspaces.
- Fix:
  - `server.js` now falls back to app-server `thread/list` when local `readStateDbThread(threadId)` returns no summary.
  - The fallback recovers the thread summary/cwd before applying `isHiddenThread()`.
- Runtime activation:
  - Elevated restart stopped the SYSTEM-owned 8787 listener and restarted the Scheduled Task.
  - New listener PID is `38552` on `0.0.0.0:8787`.
  - Authenticated `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, `lastError=null`.
  - Direct detail reads for `019ded32-ed92-7681-9591-0e4d457c5274`, `019dde72-2de7-7542-b43f-d7fa0d98fb21`, and `019de2ad-421d-7fe2-883b-a6c7cbb8742b` now all return successfully with their expected cwd.
- Validation:
  - `node --check server.js` passed.
  - `npm.cmd run check` passed.
  - `git diff --check` passed with line-ending warnings only.

## 2026-05-05 Model-Specific Quota Display

- User-reported issue:
  - The composer quota indicator showed `100% | 100%` even though the selected/default model remained `GPT-5.5`.
- Diagnosis:
  - Authenticated `/api/status` showed `rateLimits.limitName = GPT-5.3-Codex-Spark` with zero usage.
  - `server.js` only kept one global `latestRateLimits`, so a quota event from another model could overwrite the quota shown next to the current model selector.
- Code change:
  - `server.js` now records rate-limit updates in `rateLimitsByModel`, keyed by normalized model/limit id, while still exposing the latest event for compatibility.
  - `public/app.js` now merges `rateLimitsByModel` from config/status/SSE updates and renders quota for the current selected/default model.
  - Spark quota events no longer overwrite the displayed quota for `GPT-5.5`; if no quota event has been observed for the current model, the UI shows unknown quota instead of a false `100% | 100%`.
- Activation note:
  - `server.js` changes require restarting the Codex Mobile Web listener.

## 2026-05-05 Composer Thread Permission Selector

- User-requested change:
  - Show and allow setting the current thread permission in the composer, positioned after reasoning effort and before quota.
- Code change:
  - `server.js` now exposes `permissionModeOptions` and attaches sanitized current-thread `runtimeSettings.permissionMode` to thread detail responses.
  - Runtime-setting lookup now reuses the app-server thread summary when local SQLite is unavailable under the SYSTEM startup task, and scans large rollout files backward for the latest `turn_context` instead of relying on a small tail read.
  - `server.js` accepts `permissionMode` on message/resume requests and maps it to app-server runtime settings:
    - `full` / `完全访问权限` -> `sandboxPolicy: dangerFullAccess` plus `approvalPolicy: never`
    - `default` / `默认权限` -> `sandboxPolicy: workspaceWrite` plus `approvalPolicy: on-request`
    - `auto` / `自动审查` -> `sandboxPolicy: workspaceWrite` plus `approvalPolicy: on-request`
    - `custom` / `自定义 (config.toml)` -> local `%USERPROFILE%\.codex\config.toml` sandbox/approval settings when present
  - `public/index.html`, `public/styles.css`, and `public/app.js` add a compact permission selector between effort and quota using the same visible option names as Codex Desktop.
  - Permission overrides are stored per thread in browser local storage and are sent only when different from the displayed current thread default.
- Activation note:
  - `server.js` changes require restarting the Codex Mobile Web listener; existing browser/PWA sessions need a refresh for the new selector markup and script.

## 2026-05-05 Composer Four-Control Row

- User-requested change:
  - Shrink the model and reasoning controls so model, reasoning, permission, and quota all fit on one row.
- Code change:
  - `public/styles.css` now uses a four-column mobile composer grid for the controls row.
  - Model and reasoning columns, select padding, and quota padding were tightened so the four boxes remain on one line on phone-width layouts.
- Follow-up change:
  - Permission options were renamed from the earlier `Full` / `Work` / `Read` prototype to the Codex Desktop labels `默认权限` / `自动审查` / `完全访问权限` / `自定义 (config.toml)`.
- Activation note:
  - Static CSS change only; existing browser/PWA sessions need a refresh.

## 2026-05-05 User Message Duplicate Render Guard

- User-reported issue:
  - Mobile Web frequently displayed the same `You` message twice in the conversation.
- Diagnosis:
  - Authenticated `/api/threads/019ded32-ed92-7681-9591-0e4d457c5274` showed only one durable app-server `userMessage` for the duplicated visible text.
  - The duplicate was therefore a browser-side merge artifact, not a double write into app-server history.
  - Existing frontend merge logic only dropped matching `mux-user-*` synthetic user-message echoes. A live ordinary `userMessage` and a later thread snapshot `userMessage` with identical visible content but a different id could both be retained.
- Code change:
  - `public/app.js` now compares ordinary `userMessage` items by normalized visible text and upload paths, not only by id.
  - During thread refresh merges, a local user-message item is dropped when the incoming snapshot has a matching user-message item in the same turn.
  - During live upsert, a matching existing user-message item is replaced only when the new item is at least as specific; otherwise the less complete duplicate is ignored.
  - Image-only versus text-plus-image duplicates are treated as the same visible input when their upload paths overlap.
- Validation:
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with line-ending warnings only.
- Activation note:
  - Static frontend change only. Existing browser/PWA sessions need a page refresh so the updated `public/app.js` can clean the currently duplicated local cards on the next thread refresh.

## 2026-05-05 Hermes Thread Slowness Diagnosis

- User reported the Hermes Codex thread felt extremely slow, with simple operations taking 10-20 minutes.
- Runtime checks:
  - Codex Mobile Web `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, and `lastError=null`.
  - Current mux endpoint is `%USERPROFILE%\.codex\app-server-mux\endpoint.json`, TCP `127.0.0.1:49695`, mux PID `12128`, real app-server PID `11732`.
  - Current listener on `0.0.0.0:8787` is Node PID `13412`.
  - A local trivial PowerShell command completed in about 40ms under the SYSTEM task context, so the machine's shell execution was not generally stuck.
  - A 3-second CPU sample showed app-server PID `11732` using under 1 CPU-second and mux/server Node processes using much less, so there was no obvious CPU saturation.
- Hermes-specific findings:
  - Hermes thread `019dde72-2de7-7542-b43f-d7fa0d98fb21` is named `Hermes`, cwd `C:\Users\xuxin\Documents\Agent`, status `active`.
  - Its rollout JSONL file is about 505.5 MB and still being written, making thread load, history scanning, and replay substantially heavier than normal threads.
  - Recent Hermes turns include long completed durations, including about 26 minutes and 43 minutes, and the latest turn `019df84f-f9f0-7572-a8fc-7c1558704d6f` was still `inProgress` during diagnosis.
  - mux log showed repeated tool/command errors in the Hermes workspace, several `apply_patch verification failed` entries, command/path-not-found errors, and TCP client backpressure events such as drains after 866ms and 5179ms.
  - Earlier app-server log entries also showed ChatGPT/Codex websocket/model refresh failures around 10:02-10:16, but no current evidence of 8787 service failure during this check.
- Interpretation:
  - The current evidence points to a heavy/stale active Hermes thread plus large persisted history and failed tool-output volume, not a port conflict or a generally frozen local shell.
  - Git commands under the SYSTEM task can report dubious ownership for user-owned repos such as `C:\Users\xuxin\Documents\Agent`; this can add failures/noise when the app-server runs as SYSTEM.
- Operational recommendation:
  - Prefer starting a fresh Hermes thread from a compact handoff/summary for new work, leaving the 505 MB thread as archive/reference.
  - Avoid broad recursive searches or raw diff/output dumps in the old Hermes thread.
  - If keeping the old thread live, clear or interrupt only stale old `inProgress` turns after confirming the current active turn should not be interrupted.

## 2026-05-05 Hermes Stale Turns And Slowness Fix

- User confirmed the new Hermes turn had ended and asked to terminate the two old turns first.
- Runtime action:
  - Interrupted old Hermes thread `019dde72-2de7-7542-b43f-d7fa0d98fb21` turns:
    - `019df779-1a1d-7632-857e-5981474d3f32`
    - `019df84f-f9f0-7572-a8fc-7c1558704d6f`
  - Verification immediately after interruption showed both old turns as `interrupted` and the Hermes thread as `idle`.
  - User then started a new Hermes thread; this avoids continuing live work inside the old ~505 MB rollout.
- Code changes:
  - `start-codex-mobile-web-windowless.ps1` is now a restart supervisor for the 8787 listener. If `server.js` exits, the wrapper waits briefly and restarts the listener while reusing the existing mux endpoint.
  - `start-codex-mobile-web.ps1` and the windowless wrapper no longer treat Node stderr as a terminating PowerShell error. This fixes ordinary `clientError: read ECONNRESET` events causing the listener to exit.
  - `server.js` now ignores expected HTTP `ECONNRESET` client errors, keeps process-level `uncaughtException` / `unhandledRejection` logging, and guards JSON error responses when the client is already closed.
  - `server.js` caches latest rollout `turn_context` scan results briefly by rollout path/size/mtime, reducing repeated scans over very large rollout files.
  - `codex-app-server-mux.js` now drops Mobile Web command/file output delta notifications and reasoning deltas, truncates very large payload strings for Mobile Web, and stores compacted notifications in the replay buffer to reduce backpressure and heavy replay.
  - SYSTEM startup now injects process-local Git `safe.directory` entries for the user's Documents tree and Codex runtime dirs, reducing `dubious ownership` failures from SYSTEM-owned app-server tool runs.
- Runtime state after activation:
  - 8787 listener was replaced without killing the shared mux/app-server.
  - Current Codex Mobile Web listener PID after restart: `15900`.
  - `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, `lastError=null`.
  - Current mux endpoint still points to existing mux PID `12128`, real app-server PID `11732`, TCP `127.0.0.1:49695`.
- Activation note:
  - `server.js` and startup wrapper changes are active on the current 8787 listener.
  - The mux payload compaction code will take effect after the mux itself is restarted. It was intentionally not restarted during the active Codex turn because restarting mux/app-server would disconnect the current shared stream.
- Validation:
  - `npm.cmd run check` passed.
  - PowerShell parser checks passed for `start-codex-mobile-web.ps1` and `start-codex-mobile-web-windowless.ps1`.
  - macOS shell parser check passed with `C:\Program Files\Git\bin\bash.exe -n ...`; the default SYSTEM `bash` command points to the WindowsApps WSL stub and cannot execute here.
  - `git diff --check` passed with line-ending warnings only.

## 2026-05-05 Rollout Size Monitor And New Thread Action

- User-requested change:
  - Monitor each thread's rollout JSONL size.
  - Warn when a rollout reaches about `100MB`.
  - Provide a direct action to create and switch to a new thread in the same workspace.
- Code changes:
  - `server.js` now exposes `CODEX_MOBILE_ROLLOUT_WARNING_BYTES`, default `104857600` (`100MB`), through `/api/public-config`.
  - `server.js` annotates thread list/detail responses with rollout size metadata when the rollout file path is available.
  - `server.js` adds authenticated `POST /api/threads` to start a new app-server thread for a visible workspace through `thread/start`.
  - New threads started from Mobile Web include discovered `AGENTS.md` files as start-thread developer instructions, so the workspace context protocol remains available in the new thread.
  - `public/app.js` shows rollout size badges in the thread list and recent-thread home shortcuts.
  - `public/app.js` shows a current-thread warning banner when the rollout reaches the configured threshold, with a `新线程` button that starts and switches to the new thread.
  - `public/styles.css` adds compact badge and warning-banner styling with a mobile single-column layout.
  - `README.md` and `PROJECT_CONTEXT.md` document the threshold and behavior.
- Activation note:
  - Codex Mobile Web listener was restarted after the change without restarting mux/app-server.
  - Previous listener PID `15900`; new listener PID `38160`.
  - Authenticated `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, and `lastError=null`.
  - `/api/public-config` returned `rolloutWarningBytes=104857600`.
  - Authenticated `/api/threads?limit=80&archived=false` returned 10 visible threads, all with rollout size metadata; 2 were over threshold, largest visible rollout about `242.1MB`.
  - Existing browser/PWA sessions need a refresh to load the updated `public/app.js` and CSS.
- Validation:
  - `npm.cmd run check` passed.
  - macOS shell parser check passed with `C:\Program Files\Git\bin\bash.exe -n ...`; `npm.cmd run check:macos` still fails in this SYSTEM environment because `bash` resolves to the WindowsApps WSL stub.
  - `git diff --check` passed with line-ending warnings only.

## 2026-05-05 Rollout Warning List Button Fix

- User reported:
  - Threads over `100MB` were visibly red in the sidebar thread list, but no `新线程` button was visible.
- Cause:
  - The first implementation put the `新线程` action only in the opened thread's conversation banner.
  - The red visual indicator most visible to the user is the sidebar thread list item.
- Code change:
  - `public/app.js` now renders over-threshold sidebar entries as a wrapper containing the main thread-open button plus a separate `新线程` action button.
  - The list action creates a new thread from that row's workspace and switches to the new thread.
  - `public/styles.css` now gives over-threshold list rows a two-column layout with a compact right-side action button.
- Activation note:
  - Static frontend change only. Existing browser/PWA sessions need a refresh.
- Validation:
  - `node --check public/app.js` passed.
  - `npm.cmd run check` passed.
  - `git diff --check` passed with line-ending warnings only.

## 2026-05-05 New Thread Bootstrap And Naming Fix

- User reported:
  - A newly created thread could be unmaterialized, causing `includeTurns is unavailable before first user message`.
  - New thread naming should not look random.
- Code changes:
  - `server.js` now materializes Mobile Web-created threads immediately by sending a fixed first user message that asks the agent to read `.agent-context/PROJECT_CONTEXT.md` and `.agent-context/HANDOFF.md`, acknowledge that durable context is loaded, and wait for the next step without editing files.
  - `server.js` now names these new threads deterministically from the source thread title and uses the app-server protocol method `thread/name/set` with `{ threadId, name }`, with legacy title-update attempts kept as fallbacks.
  - `server.js` sets the title both before and after the bootstrap `turn/start`, so a newly materialized thread keeps the source-based name instead of a generated/random-looking fallback.
  - `server.js` keeps a short in-memory summary for just-started threads and returns a valid empty thread object for unmaterialized thread detail reads, rather than surfacing an app-server materialization error to the browser.
  - `public/app.js` sends `sourceThreadId` and `sourceThreadTitle` when creating a new thread from an over-threshold thread list row or current-thread banner.
- Follow-up change:
  - The new-thread action now shows a browser confirmation prompt before proceeding.
  - If confirmed, `public/app.js` sends `archiveSourceThread: true`.
  - `server.js` archives the source thread with app-server `thread/archive` only after the new thread has been created and the fixed bootstrap turn has started.
  - `public/app.js` removes archived source threads from the visible list and handles `thread/archived` notifications.
  - If source archival fails, the response still returns the new thread so the browser can switch to it, and Mobile Web displays the archive failure in the connection status.
- Activation note:
  - Mobile Web listener was restarted after the server-side change without restarting mux/app-server.
  - Previous listener PID `46616`; new listener PID `4476`.
  - Authenticated `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, and `lastError=null`.
  - Existing browser/PWA sessions need a refresh for static frontend changes.
- Validation:
  - `node --check server.js` passed.
  - `node --check public/app.js` passed.
  - `npm.cmd run check` passed.
  - `git diff --check` passed with line-ending warnings only.

## 2026-05-05 New Thread Title Shortening

- User-requested change:
  - New thread names should not include `续`.
  - New thread names should include the date only, not time.
- Code change:
  - `server.js` now formats Mobile Web-created thread names as `<source thread title> MM-DD`.
  - `shortThreadTitle()` strips either old `<title> 续 MM-DD HH:mm` suffixes or new `<title> MM-DD` suffixes before appending the current date, so repeated thread rollover does not accumulate date suffixes.
- Activation note:
  - Mobile Web listener was restarted after the server-side change without restarting mux/app-server.
  - Previous listener PID `4476`; new listener PID `11048`.
  - Authenticated `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, and `lastError=null`.
- Validation:
  - `node --check server.js` passed.
  - `npm.cmd run check` passed.
  - `git diff --check` passed with line-ending warnings only.
- Follow-up runtime action:
  - Renamed existing old-format thread `019df8b5-0028-7d90-ab9b-18d3f7898e01` from `衣橱1 续 05-05 23:15` to `衣橱1 05-05` using app-server `thread/name/set`.
  - Verification through `/api/threads?limit=200&archived=false` showed the new title and no remaining visible/archived old-format titles matching `续 MM-DD HH:mm`.
  - Note: when issuing direct app-server rename requests from PowerShell, avoid embedding non-ASCII title literals through a pipeline; use UTF-8-safe input or Unicode code points to avoid `??` replacement.

## 2026-05-05 Private/Public Commit Preparation

- User reminder:
  - Before push, check handoff for private/public release requirements and README handling.
- Requirements re-confirmed from prior handoff:
  - Private repo `origin` is `https://github.com/pentiumxp/codex-mobile-web.git`.
  - Clean public release repo is `https://github.com/pentiumxp/codex-mobile-web-public`, local path `C:\Users\xuxin\Documents\codex-mobile-web-public`.
  - Public release must not copy `.agent-context/` or `AGENTS.md`.
  - Public README must use the public clone URL and preserve public/PWA conventions.
- Follow-up code/release fixes:
  - Restored test-friendly `server.js` behavior from the public release line: when `server.js` is required as a module it no longer starts the HTTP listener, and it exports `approvalResponsePayload` / `publicServerRequest` for protocol tests.
  - Synchronized release files from private to public for `README.md`, `codex-app-server-mux.js`, `public/app.js`, `public/styles.css`, `server.js`, `start-codex-mobile-web-windowless.ps1`, and `start-codex-mobile-web.ps1`.
  - Preserved the public checkout's PWA service worker path by keeping `public/app.js` registration on `/sw.js`.
  - Fixed the public README clone command to use `https://github.com/pentiumxp/codex-mobile-web-public.git` and `cd codex-mobile-web-public`.
- Public release commit:
  - Local public commit `a77c9f3 优化大线程切换与后台稳定性` is prepared and ahead of public `origin/main`.
- Validation:
  - Private checkout: `npm.cmd run check` passed, `git diff --check` passed with line-ending warnings only.
  - Public checkout: `npm.cmd test` passed, `npm.cmd run check` passed, Git Bash `bash -n ...` macOS shell syntax check passed, `git diff --check` passed with line-ending warnings only.
  - Public privacy scan passed for tracked files excluding `.gitignore`; no `xuxin`, `Hermes`, `C:\Users`, `192.168.10.108`, `gmk.tail`, `tail62e8ce`, or private GitHub clone URL matches.

## 2026-05-05 Non-Actionable Tool Request Approval Card Fix - 23:46 +08:00

- User-reported issue:
  - Mobile Web showed a bottom `Tool request` card with method `item/tool/call`, status `Waiting`, and no clickable approval controls.
- Diagnosis:
  - `/api/approvals` showed the pending request with `actionable=false`.
  - Generated app-server TypeScript protocol identifies `item/tool/call` as `DynamicToolCallParams` with a `DynamicToolCallResponse`, not an Allow/Deny approval request.
  - Mobile Web had been tracking this server request in the same pending-approval stack as command/file/permission approval requests, producing a misleading waiting card.
- Code change:
  - `server.js` no longer includes `item/tool/call` in `SERVER_REQUEST_METHODS`, so dynamic tool calls are not exposed through `/api/approvals` or the approval SSE path.
  - `server.js` filters pending server requests by the current supported approval/input methods before returning `/api/approvals` or initial SSE approval state.
  - `public/app.js` ignores `item/tool/call` if an old server or existing browser session still receives it, and uses `等待输入` rather than `等待批准` for other non-actionable visible server requests.
- Activation note:
  - Restarted only the Mobile Web 8787 Node listener to load the server-side change.
  - Previous listener PID `11048`; new listener PID `10276`.
  - Shared mux/app-server were not restarted.
  - Authenticated `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, and `lastError=null`.
  - Authenticated `/api/approvals` returned zero pending approval requests after restart.
- Validation:
  - `npm.cmd run check` passed.
  - `git diff --check` passed with line-ending warnings only.

## 2026-05-06 Workspace Selector Mobile Layout Fix - 00:03 +08:00

- User-reported issue:
  - In the mobile sidebar, the `Workspace` select text was vertically clipped.
  - The sidebar also showed a duplicate `All workspaces` row below the select.
- Code change:
  - `public/index.html` now starts `#workspacePath` hidden.
  - `public/app.js` hides `#workspacePath` when all workspaces are selected and only shows it for a concrete workspace path.
  - `public/styles.css` gives the workspace select a fixed `46px` height, matching line height, `16px` font size, and extra right padding for the native picker indicator.
- Activation note:
  - Static frontend change only. Existing browser/PWA sessions need a refresh.
- Validation:
  - `npm.cmd run check` passed.
  - `git diff --check` passed with line-ending warnings only.

## 2026-05-06 User-Mode Startup And WSL Access - 00:19 +08:00

- User-requested change:
  - Switch Codex Mobile Web away from `LocalSystem` so Codex tool calls can use WSL.
- Findings:
  - Commands launched from the existing SYSTEM app-server returned `WSL_E_LOCAL_SYSTEM_NOT_SUPPORTED`.
  - A temporary `GMK\xuxin` interactive Scheduled Task successfully ran `wsl.exe --exec /bin/sh -lc 'whoami; uname -a'`, returning Linux `GMK ... WSL2` with exit code 0.
- Code/documentation changes:
  - `install-codex-mobile-web-startup.ps1` now accepts `-UserId`, so a SYSTEM/elevated process can explicitly register the interactive task for `GMK\xuxin` instead of accidentally using the executing SYSTEM identity.
  - `README.md` documents that `LocalSystem` cannot start WSL and shows the `-InteractiveLogon -UserId "$env:COMPUTERNAME\$env:USERNAME"` install form.
  - `.agent-context/PROJECT_CONTEXT.md` records the current user-mode startup requirement and WSL limitation of LocalSystem.
- Runtime changes:
  - Re-registered the `Codex Mobile Web` Scheduled Task as `GMK\xuxin`, `LogonType=Interactive`, `RunLevel=Limited`.
  - Stopped the old SYSTEM 8787 listener/supervisor.
  - Started the 8787 listener under `GMK\xuxin`; listener PID observed as `2568`, parent PowerShell PID `45220`, both owned by `GMK\xuxin`.
  - Started a new user-owned standalone mux by temporary interactive task. New mux PID `48432`, child app-server PID `8732`, both owned by `GMK\xuxin`.
  - The endpoint file `%USERPROFILE%\.codex\app-server-mux\endpoint.json` now points to user-owned mux port `62616`.
  - Called authenticated `POST /api/app-server/reconnect`; `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, endpoint port `62616`, and `lastError=null`.
- Operational note:
  - The old SYSTEM mux/app-server can remain only for already-connected Desktop/current sessions. It is no longer the endpoint file target. Later Mobile Web reconnects and later Desktop shared launches should attach to the user-owned endpoint.
  - The current Codex thread that performed this migration may still execute local shell tools under the old SYSTEM app-server until that old session is restarted; new Mobile Web turns should use the user-owned app-server.
- Validation:
  - `npm.cmd run check` passed.
  - PowerShell parser check passed for `install-codex-mobile-web-startup.ps1`.
  - `git diff --check` passed with line-ending warnings only.
  - Final status check showed Scheduled Task `LogonType=Interactive`, `/api/status` ready on endpoint port `62616`, mux owner `GMK\xuxin`, and child app-server owner `GMK\xuxin`.

## 2026-05-06 Context Compaction State Text - 00:25 +08:00

- User-reported issue:
  - Mobile Web displayed `历史上下文已压缩` for both in-progress historical context compaction and completed compaction.
- Code change:
  - `server.js` now emits `mobileCompactionStatus` and `mobileNotice` for context-compaction items:
    - `item/started` and live turns -> `历史上下文正在压缩`
    - `item/completed` and completed turns -> `历史上下文已压缩`
  - `public/app.js` now computes context-compaction text from item status plus the containing turn live/completed state, so stale live notices settle to `已压缩` after turn completion.
- Activation note:
  - Restarted only the 8787 Mobile Web Node listener to load the `server.js` change.
  - Previous listener PID `2568`; new listener PID `46060`, owned by `GMK\xuxin`.
  - `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, endpoint port `62616`, and `lastError=null`.
  - Existing browser/PWA sessions need a refresh for the updated frontend script.
- Validation:
  - `npm.cmd run check` passed.

## 2026-05-06 Public Web Push Title Binding Release - 15:20 +08:00

- User instruction:
  - After testing the private build, the user explicitly approved pushing the public repository.
- Public sync:
  - Synchronized the private Web Push thread-title binding fix into `C:\Users\xuxin\Documents\codex-mobile-web-public`.
  - Public files changed: `server.js` and `README.md`.
  - Preserved public release differences: the public README uses `https://github.com/pentiumxp/codex-mobile-web-public.git` and `cd codex-mobile-web-public`; the public PWA keeps its existing `/sw.js` service-worker convention.
  - Public README includes the required Chinese explanation of the Web Push behavior change: turn-completed notifications bind metadata captured at `turn/started`, use the completed thread title, and open `/?thread=<threadId>` so one thread's completion is not labeled as another thread.
- Validation:
  - Public `npm.cmd test` passed.
  - Public `npm.cmd run check` passed.
  - Public `git diff --check` passed with line-ending warnings only.
  - Public tracked-file privacy scan excluding `.gitignore` returned no matches for local user paths, Tailscale host markers, LAN address, Hermes name, or the private GitHub clone URL.
- Published:
  - Public commit `82660e0 修复 Web Push 线程标题绑定` pushed to `origin/main`.
  - Private implementation commit was `1a927ab 修复 Web Push 线程标题绑定`.

## 2026-05-07 Source-Thread Handoff Continuation Fix - 06:09 +08:00

- User-reported issue:
  - Rollout "压缩续接" bootstrap was still partly template-driven and could inject Codex Mobile Web-specific private/public/README release rules into unrelated workspaces such as Hermes Web.
  - Continuation should require the old/source thread to summarize its own handoff points and write a file, instead of relying only on fixed prewritten bootstrap text.
- Code changes:
  - `POST /api/threads` now first starts a source-thread handoff turn when `sourceThreadId` is provided.
  - The source-thread handoff turn must write `.agent-context/thread-handoffs/<id>.md` in the current workspace, summarizing only source-thread/current-workspace facts: goals, completed work, pending work, key files/commands, validation, risks, and next-thread advice.
  - Mobile Web waits for that handoff file before starting the new continuation thread. Default wait is `CODEX_MOBILE_CONTINUATION_HANDOFF_TIMEOUT_MS=240000`; default minimum accepted file size is `CODEX_MOBILE_CONTINUATION_HANDOFF_MIN_CHARS=400`.
  - The continuation bootstrap now includes the source-thread-generated handoff file as the highest-priority handoff source, plus source metadata, limited recent source-turn summaries, and current-workspace `.agent-context/PROJECT_CONTEXT.md` / `.agent-context/HANDOFF.md` excerpts.
  - Removed the old hard-coded "must carry GitHub / public release rules" bootstrap section and the special handoff-section extractor for public/private release keywords.
  - Frontend confirmation text now states that the old thread writes the handoff file first and that unrelated fixed commit rules are not injected. The continuation request timeout is now `300000ms`.
- Documentation:
  - `README.md` documents the source-thread handoff file workflow and the new continuation handoff timeout/min-size environment variables.
  - `.agent-context/PROJECT_CONTEXT.md` records that fixed private/public/README/GitHub rules must not be hard-coded into every continuation.
- Activation:
  - Restarted only the 8787 Node listener. Previous listener PID `40692`; new listener PID `53376`.
  - `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, and `lastError=null`.
  - Shared mux/app-server were not restarted.
- Validation:
  - `npm.cmd run check` passed.
  - `git diff --check` passed with line-ending warnings only.

## 2026-05-07 Continuation Source Thread Visibility Fix - 06:20 +08:00

- User-reported issue:
  - After tapping `压缩续接`, Mobile Web returned to the home screen or kept the source thread visible without showing any source-thread handoff turn.
  - A Control4 continuation attempt showed the source thread still unchanged: no 2026-05-07 handoff turn, no handoff file under `C:\Users\xuxin\SynologyDrive\Codex\智能\.agent-context\thread-handoffs`, and no new Control4 continuation thread.
- Diagnosis:
  - The previous server implementation started the source-thread handoff turn directly with `turn/start` but did not first `thread/resume` the source thread. For older/notLoaded threads, that can fail to materialize a visible turn in the source thread.
  - The frontend success path still jumped to the new continuation thread, and `thread/archived` could clear the current source-thread detail view back to the home screen.
- Code changes:
  - `createSourceContinuationHandoff()` now resumes the source thread with inherited runtime settings before starting the handoff turn.
  - The frontend switches to the source thread before starting continuation and no longer automatically loads the new continuation thread when the request completes.
  - During a continuation, a `thread/archived` event for the source thread marks the current source detail as archived instead of clearing it.
  - After completion, Mobile Web stays on the source thread so the user can inspect the handoff generation turn/result.
- Operational note:
  - The failed Control4 attempt left only an empty `thread-handoffs` directory; no handoff file and no new Control4 continuation thread were created. Retrying after the listener restart should use the fixed flow.
- Activation:
  - Restarted only the 8787 Node listener after confirming the Control4 attempt had no active handoff file or new continuation thread.
  - New listener PID `52296`.
  - `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, and `lastError=null`.
- Validation:
  - `npm.cmd run check` passed.
  - `git diff --check` passed with line-ending warnings only.

## 2026-05-07 Continuation Switch-To-New-Thread Fix - 06:35 +08:00

- User-reported issue:
  - After the source thread's handoff turn finished, Mobile Web still stayed on the archived source thread. The expected behavior is to show the source thread while the handoff turn runs, then switch to the new continuation thread after the continuation is created.
- Code changes:
  - Frontend success flow now loads the new continuation thread after `/api/threads` returns the new thread id.
  - The source-thread archive guard remains in place so an archive event cannot clear the source view before the new thread switch happens.
  - Server-side continuation now waits briefly for the source handoff turn to report a completed status after the handoff file is written, controlled by `CODEX_MOBILE_CONTINUATION_HANDOFF_TURN_COMPLETION_TIMEOUT_MS` (default `60000`).
  - The API response includes `sourceHandoff.turnCompletion` for diagnostics.
- Documentation:
  - `README.md` and `.agent-context/PROJECT_CONTEXT.md` now describe the two-stage UX: show source thread during handoff, then switch to the new continuation thread.
- Activation:
  - Restarted only the 8787 Node listener; new listener PID `8076`.
  - `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, and `lastError=null`.
- Validation:
  - `npm.cmd run check` passed.
  - `git diff --check` passed with line-ending warnings only.

## 2026-05-07 Public Commit Detail Rule - 06:45 +08:00

- User instruction:
  - For future public-repo commits, the commit message must include detailed information about what changed since the previous public commit.
  - A public commit message must not be only a one-line title; it should name the concrete changed areas, behavior/documentation impact, and validation or operational notes when relevant.
- Durable context:
  - Added this as a public commit-message rule in `.agent-context/PROJECT_CONTEXT.md`.

## 2026-05-07 Public Rollout Continuation Release - 07:05 +08:00

- User instruction:
  - User explicitly asked to commit and push after clarifying that public commits must include detailed change information rather than a one-line message.
- Public sync:
  - Synchronized the private rollout continuation fixes into `C:\Users\xuxin\Documents\codex-mobile-web-public`.
  - Public files changed: `server.js`, `public/app.js`, and `README.md`.
  - Preserved public release differences: public README still points to `https://github.com/pentiumxp/codex-mobile-web-public.git`, and public `public/app.js` keeps service worker registration path `/sw.js`.
  - Did not copy `.agent-context/` into public.
- Public behavior released:
  - `server.js` now starts/resumes the source thread, asks it to write a thread-specific `.agent-context/thread-handoffs/<id>.md`, waits for that file, briefly waits for source-turn completion, then creates the continuation thread.
  - New-thread bootstrap uses the source-generated handoff, limited source-turn context, and current-workspace context; it no longer hard-codes unrelated private/public/GitHub release rules into every continuation.
  - `public/app.js` shows the source thread while the handoff turn runs, prevents source archive events from clearing the view before the continuation is ready, and then switches to the new continuation thread after creation.
  - Public README includes the required Chinese documentation of the updated rollout continuation flow and new environment variables.
- Validation:
  - Public `npm.cmd test` passed.
  - Public `npm.cmd run check` passed.
  - Public `git diff --check` passed with line-ending warnings only.
  - Targeted tracked-file privacy scan found no local user path, private repo URL, LAN/Tailscale host marker, GMK/xuxin marker, or Hermes marker.
- Published:
  - Public commit `7160bcd 改进 rollout 压缩续接交接流程` pushed to `origin/main`.
  - The public commit message includes detailed body paragraphs describing changes since previous public commit `82660e0`.

## 2026-05-07 Public PR #9 Merge - 14:55 +08:00

- User instruction:
  - User approved the recommended controlled merge flow for public PR #9.
- PR:
  - `https://github.com/pentiumxp/codex-mobile-web-public/pull/9`
  - Title: `修复移动端审批卡片和超长会话切换卡顿`
  - Base before merge: public `main` at `7160bcd`.
  - Head: `f7f9b46`.
  - GitHub reported `mergeable=true`; no PR comments or review threads.
- Private sync first:
  - Applied the public PR #9 equivalent patch onto private `C:\Users\xuxin\Documents\codex-mobile-web`.
  - Resolved the README conflict by keeping the private clone URL and private `cd codex-mobile-web` path while retaining `npm ci`.
  - Kept private `public/app.js` service worker registration at `/service-worker.js`.
  - Added private `package.json` script `test: node --test` because the PR introduced protocol tests and private did not yet expose `npm test`.
  - Private commit `69da9dc 同步移动端审批和长线程切换修复` pushed to `origin/main`.
- Public merge:
  - Squash-merged public PR #9 with a detailed multi-paragraph commit message, as required for public commits.
  - Public merge commit `828760a 修复移动端审批和超长会话切换卡顿` pushed to public `origin/main`.
  - Local public checkout was fast-forwarded to `828760a`.
- Behavior merged:
  - Mobile Web actionable server requests now include command/file/permission approvals plus `item/tool/requestUserInput` and `mcpServer/elicitation/request`.
  - The browser renders input/MCP request cards with option/manual response/cancel paths and sends answers through the same app-server request/response stream.
  - Thread detail reads avoid resetting the whole app-server connection on detail timeout and use summary fallback for rollout files at or above `CODEX_MOBILE_THREAD_DETAIL_ROLLOUT_MAX_BYTES`.
  - Mobile Web asks mux for a bounded notification replay window with `CODEX_MOBILE_MUX_REPLAY_NOTIFICATION_LIMIT`; unresolved server requests still replay separately.
  - macOS shared launcher, PWA icon links, README, and protocol tests were updated.
- Validation:
  - Private `npm.cmd test` passed with 6 tests.
  - Private `npm.cmd run check` passed.
  - Private `npm.cmd run check:macos` passed.
  - Private `git diff --cached --check` passed before commit.
  - Public `npm.cmd test` passed with 6 tests after merge.
  - Public `npm.cmd run check` passed after merge.
  - Public `npm.cmd run check:macos` passed after merge.
  - Public `git diff --check HEAD~1..HEAD` passed.
  - Public targeted tracked-file privacy scan found no local user path, private repo URL, LAN/Tailscale host marker, GMK/xuxin marker, or Hermes marker.

## 2026-05-08 Public PR #10 Merge - 08:45 +08:00

- User instruction:
  - User asked to inspect and merge the new public pull request.
- PR:
  - `https://github.com/pentiumxp/codex-mobile-web-public/pull/10`
  - Title: `[codex] 修复移动端续接和桌面同步`
  - Base before merge: public `main` at `828760a`.
  - Head: `e15cf41`.
  - GitHub reported `mergeable=true`; no PR comments or review threads.
  - GitHub Actions `Node checks` passed before merge.
- Private sync first:
  - Applied the public PR #10 equivalent patch onto private `C:\Users\xuxin\Documents\codex-mobile-web`.
  - Resolved the README conflict by keeping private wording while adding the PR #10 continuation-job behavior.
  - Kept private `public/app.js` service worker registration at `/service-worker.js`.
  - Did not apply the public `public/sw.js` cache-name-only change to private because private uses `public/service-worker.js` and does not have the same shell-cache implementation.
  - Private commit `5b0fe7d 同步续接后台任务和桌面同步修复` pushed to `origin/main`.
- Public merge:
  - Squash-merged public PR #10 with a detailed multi-paragraph commit message, as required for public commits.
  - Public merge commit `fec1194 修复移动端续接和桌面同步` pushed to public `origin/main`.
  - Local public checkout was fast-forwarded to `fec1194`.
- Behavior merged:
  - Mobile Web `turn/start` requests now get a mux synthetic `mux/userMessage` echo after `turn/started`, improving visibility of mobile-started new-turn user messages in Codex Desktop.
  - Thread detail reads prefer full `thread/read` for normal-size sessions, fall back to `thread/turns/list`, and still avoid expensive detail reads for very large rollout files.
  - Browser-facing rollout continuation now uses background jobs via `POST /api/thread-continuations` and `GET /api/thread-continuations/<jobId>`, allowing phase status, refresh recovery, and switching to other sessions while continuation runs.
  - Continuation no longer forces opening the source thread before starting, supports late handoff waiting and recent handoff reuse, writes `.agent-context/thread-handoffs/.gitignore`, and avoids locking unrelated session inputs.
  - Thread list status icons, unread dot semantics, relative time display, public PWA cache version, README, and protocol tests were updated.
- Validation:
  - Public PR worktree `npm.cmd test` passed with 7 tests.
  - Public PR worktree `npm.cmd run check` passed.
  - Public PR worktree `npm.cmd run check:macos` passed.
  - Public PR diff-check and targeted tracked-file privacy scan passed before merge.
  - Private `npm.cmd test` passed with 7 tests.
  - Private `npm.cmd run check` passed.
  - Private `npm.cmd run check:macos` passed.
  - Private `git diff --cached --check` passed before commit.
  - Public `npm.cmd test` passed with 7 tests after merge.
  - Public `npm.cmd run check` passed after merge.
  - Public `npm.cmd run check:macos` passed after merge.
  - Public `git diff --check HEAD~1..HEAD` passed.
  - Public targeted tracked-file privacy scan found no local user path, private repo URL, LAN/Tailscale host marker, GMK/xuxin marker, or Hermes marker.

## 2026-05-08 Runtime Restart After PR #10 - 09:10 +08:00

- User instruction:
  - User asked to restart after the PR #10 merge because `server.js`, frontend assets, and `codex-app-server-mux.js` changed.
- Restart result:
  - Old 8787 listener was replaced; current listener PID is `67944`.
  - Shared mux endpoint was replaced; current mux PID is `55456`, child `codex.exe app-server` PID is `68428`.
  - Endpoint file `%USERPROFILE%\.codex\app-server-mux\endpoint.json` now points to TCP port `59301` and started at `2026-05-08T01:07:42.488Z`.
  - Scheduled Task `Codex Mobile Web` remains running.
- Health check:
  - Authenticated `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, and `lastError=null`.
- Notes:
  - Existing browser/PWA sessions may need a refresh to load the updated frontend and service worker behavior.
  - Existing Desktop windows may need reconnect/relaunch if they were attached to the old mux stream before the restart.

## 2026-05-08 Large Rollout Warning Skip And 200MB Threshold - 09:26 +08:00

- User-reported issue:
  - Opening `Hermes 05-07` showed only the rollout-size warning and `No visible turns`; the warning should be kept but must be skippable.
  - The rollout warning threshold should be raised from `100MB` to `200MB`.
- Code changes:
  - `server.js` default `CODEX_MOBILE_ROLLOUT_WARNING_BYTES` is now `209715200` (`200MB`), and `CODEX_MOBILE_THREAD_DETAIL_ROLLOUT_MAX_BYTES` still defaults to the same value unless explicitly overridden.
  - Large-rollout detail reads no longer immediately return the empty local summary fallback. They skip full `thread/read`, then try bounded `thread/turns/list`, preserving recent visible turns when the app-server can provide them. When this succeeds, the extra read-warning note is suppressed; the user-facing size warning remains in the skippable banner.
  - `public/app.js` adds per-thread/rollout-size dismissal storage under `codexMobileDismissedRolloutWarnings`; the detail banner now has `跳过` and `压缩续接` actions.
  - `public/styles.css` adds the two-button action layout for desktop and mobile.
  - `README.md` and `.agent-context/PROJECT_CONTEXT.md` document the `200MB` default and the skippable warning behavior.
- Runtime validation:
  - Restarted the 8787 Node listener after the server-side changes. Previous listener PID `5364`; current listener PID `63392`.
  - `/api/public-config` returned `rolloutWarningBytes=209715200`.
  - `Hermes 05-07` summary returned `rolloutSizeBytes=200195815`, threshold `209715200`, and `rolloutOverWarningThreshold=false`.
  - Direct detail read for `Hermes 05-07` returned in about `2229ms` with `mobileReadMode=thread-read`, `turnCount=80`, and no rollout warning.
- Validation:
  - `npm.cmd test` passed with 7 tests.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with line-ending warnings only.
- Public release note:
  - Public repo was not updated in this step. Follow the project rule: wait for user testing and explicit public-update instruction before syncing `C:\Users\xuxin\Documents\codex-mobile-web-public`.

## 2026-05-09 Sidebar Font Size Selector - 09:14 +08:00

- User request:
  - Add font-size adjustment, placed in the menu/sidebar top-right area rather than in the main conversation window.
- Code changes:
  - `public/index.html` now places a compact `fontSizeSelect` control in the sidebar header actions, next to the mobile close button.
  - `public/app.js` stores the selected size in `localStorage` key `codexMobileFontSize`, normalizes values to `small`, `default`, `large`, or `xlarge`, and applies the value through `document.documentElement.dataset.fontSize`.
  - `public/styles.css` adds CSS variables for content, code, table, heading, and composer input font sizes, with size-specific values under `:root[data-font-size]`.
  - `README.md` and `.agent-context/PROJECT_CONTEXT.md` document that the control belongs in the sidebar/menu header, not the main topbar.
- Validation:
  - `npm.cmd test` passed with 7 tests.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with line-ending warnings only.
- Runtime note:
  - This is a static frontend change. The running 8787 server can serve the updated files without a Node restart, but existing PWA/browser sessions need a refresh to load the new `index.html`, `app.js`, and `styles.css`.

## 2026-05-09 Tablet Sidebar Overlay Mode - 09:20 +08:00

- User request:
  - On a large tablet, the page was split left/right with the menu occupying about half the screen. The user wants the tablet layout to behave like phone layout: the main window should be full-screen, and the menu should appear only after explicit user action.
- Code changes:
  - `public/styles.css` split sidebar overlay behavior from phone-only compact layout. The sidebar overlay breakpoint is now `(max-width: 1180px), (pointer: coarse) and (max-width: 1400px)`, while the tighter composer/content mobile layout remains under `760px`.
  - `public/app.js` adds `MENU_OVERLAY_MEDIA` and `isMenuOverlayMode()`, using the same media query to close the sidebar after selecting/loading a thread on tablet overlay layouts.
  - `README.md` and `.agent-context/PROJECT_CONTEXT.md` document that phones and tablet-sized/touch layouts should not keep the sidebar permanently visible.
- Runtime note:
  - Static frontend change; existing browser/PWA sessions need a refresh to load the updated CSS/JS.

## 2026-05-09 Extra-Large Tablet Font Size - 09:22 +08:00

- User request:
  - The existing `特大` font size was still too small on a large tablet; add one larger level.
- Code changes:
  - `public/index.html` adds a `超大` option with value `xxlarge` to the sidebar font-size selector.
  - `public/app.js` accepts `xxlarge` in `codexMobileFontSize`.
  - `public/styles.css` adds `:root[data-font-size="xxlarge"]`, setting conversation text to `22px`, composer input to `22px`, code to `16px`, table text to `18px`, and headings up to `26px`.
  - `README.md` and `.agent-context/PROJECT_CONTEXT.md` document the new `超大` / `xxlarge` option.
- Runtime note:
  - Static frontend change; existing browser/PWA sessions need a refresh to load the updated HTML/CSS/JS.

## 2026-05-09 PR #12 Stability Integration - 10:05 +08:00

- User instruction:
  - Continue from the split public PR plan until the stability PR can be submitted/committed.
  - PR #12 is the ready stability PR; PR #13 remains draft and should wait until after #12.
- PR status:
  - Public PR #12: `https://github.com/pentiumxp/codex-mobile-web-public/pull/12`, title `[codex] 优化移动端续接同步、模型一致性和完成提醒`, ready, GitHub Actions `Node checks` passed.
  - Public PR #13: draft and GitHub reported `mergeable=CONFLICTING`; no #13 code was integrated in this step.
- Integration approach:
  - Fetched PR #12 into private as `public/pr-12-stability` and three-way merged against current private files using public `main` as base.
  - Kept current behavior that PR #12 would otherwise regress: 200MB rollout warning threshold, skippable rollout warning banner, large-rollout `thread/turns/list` detail path, sidebar font-size selector including `xxlarge`, and tablet/touch sidebar overlay mode.
  - Integrated #12 stability behavior into private `server.js`, `public/app.js`, and `public/styles.css`.
- Behavior integrated:
  - Server logs compact `[message-submit]` diagnostics for empty/received/done/failed submissions without raw text.
  - Server accepts best-effort `/api/client-events` diagnostics for UI stalls, send stalls, send-button no-submit cases, and send failures.
  - Mobile Web adds send-button busy/failed states, a send watchdog, click-submit guarding, and clearer retry/slow-send feedback.
  - Mobile Web keeps model display and actual submitted model aligned through `currentComposerModel()`, and normalizes quota/rate-limit failures into a model-specific message where possible.
  - Thread list rendering is requestAnimationFrame-scheduled, noisy thread notifications are throttled, and non-current thread completion can trigger a throttled local tone/haptic completion alert.
- Documentation:
  - `README.md` documents the stability behavior.
  - `.agent-context/PROJECT_CONTEXT.md` records the durable message submission diagnostics, model-selector alignment, send watchdog, and completion alert rules.
- Validation:
  - Private validation passed after integration: `npm.cmd test`, `npm.cmd run check`, `npm.cmd run check:macos`, and `git diff --check`.
  - Manual diff review confirmed current 200MB rollout threshold, skippable rollout warning banner, font-size selector including `xxlarge`, tablet/touch overlay sidebar behavior, and large-rollout `thread/turns/list` path were preserved while integrating PR #12 stability changes.
- Publication status:
  - Completed in the follow-up entry below.

## 2026-05-09 PR #12 Published - 10:08 +08:00

- Private repository:
  - Committed and pushed `9528e100e40027ae18216114a4cf49f46d2e049a` on `main`.
  - Validation passed before commit: `npm.cmd test`, `npm.cmd run check`, `npm.cmd run check:macos`, and `git diff --check`.
- Public repository:
  - Updated cross-repo PR #12 head to `63ef96f974f3c654e89a7d21de25cc3c69b866ab` after merging `origin/main` and resolving conflicts.
  - Public validation passed on the updated PR head: `npm.cmd test`, `npm.cmd run check`, `npm.cmd run check:macos`, `git diff --cached --check`, and a privacy scan for private paths/repo URLs/IP/Tailscale/Hermes markers.
  - PR #12 reported `MERGEABLE` / `CLEAN`; GitHub Actions `Node checks` passed on run `25588614935`.
  - Squash-merged PR #12 into public `main` as `78e8748e4b28a4a2b7b0fff1327ed455a684f0b5`.
  - Local public workspace was switched back to `main` and fast-forwarded to `origin/main`.
- Public/private difference preserved:
  - Public `public/app.js` registers `/sw.js`.
  - Public `public/sw.js` shell cache was bumped to `codex-mobile-shell-v8`.
  - Public README clone instructions still point to `pentiumxp/codex-mobile-web-public`.
- PR #13 status:
  - Left untouched as draft; GitHub still reports it open/draft and it should be reviewed after #12.

## 2026-05-09 PR #13 Mobile UX Integration - 10:48 +08:00

- User instruction:
  - Start merging public PR #13 after PR #12 was published.
- PR:
  - Public PR #13: `https://github.com/pentiumxp/codex-mobile-web-public/pull/13`, title `[codex] 优化移动端会话列表和消息操作体验`.
  - It was draft, cross-repo, and initially `CONFLICTING` / `DIRTY` because it was based before the #12 squash merge plus later main changes.
- Integration approach:
  - Instead of directly merging the stale PR branch, reset the local PR branch to current public `origin/main` and cherry-picked only the actual #13 UX commits: `15aa804` and `066e23f`.
  - Resolved conflicts by preserving main behavior from #12 and later private/public sync: 200MB rollout threshold, skippable rollout banner, sidebar font-size selector including `xxlarge`, tablet/touch overlay sidebar mode, model/send stability fixes, and public `/sw.js` registration path.
  - Added a public README section for the #13 UX behavior because public commits require detailed README updates.
- Behavior integrated into private for validation:
  - Theme selector in the sidebar header with `codexMobileTheme` localStorage and early `data-theme` application.
  - Left-edge right-swipe opens the overlay sidebar/session list, and sidebar open reuses recent list data before silent background refresh.
  - Thread long-press action sheet supports rename and rollout continuation while avoiding iOS text selection on cards.
  - `PATCH /api/threads/<threadId>/name` route calls available app-server title update methods and returns `501` when unsupported.
  - Agent messages, Markdown code blocks, and output/detail blocks expose copy buttons using in-memory copy text.
- Private validation:
  - `npm.cmd test`, `npm.cmd run check`, `npm.cmd run check:macos`, and `git diff --check` passed after syncing #13 code into private.
- Publication status:
  - Completed in the follow-up entry below.

## 2026-05-09 PR #13 Published - 10:22 +08:00

- Private repository:
  - Committed and pushed `a461062706685f980cc2479f1ab6e7f2e5dd7f9b` on `main`.
  - Validation passed before commit: `npm.cmd test`, `npm.cmd run check`, `npm.cmd run check:macos`, and `git diff --check`.
- Public repository:
  - Updated cross-repo PR #13 head to `77ad6944059b76644ac6fcb0c9489d0235a7ae3d` by replaying it on top of public `origin/main`.
  - Public validation passed on the updated PR head: `npm.cmd test`, `npm.cmd run check`, `npm.cmd run check:macos`, `git diff --check origin/main...HEAD`, and a privacy scan for private paths/repo URLs/IP/Tailscale/Hermes markers.
  - PR #13 was marked ready after CI; GitHub reported `MERGEABLE` / `CLEAN`; GitHub Actions `Node checks` passed on run `25588982220`.
  - Squash-merged PR #13 into public `main` as `5e86ee5b963186b4ac027d85ee7ab3c5100de9a6`.
  - Local public workspace was switched back to `main` and fast-forwarded to `origin/main`.
- Public/private difference preserved:
  - Public `public/app.js` registers `/sw.js`; private registers `/service-worker.js`.
  - Public `public/sw.js` shell cache was bumped to `codex-mobile-shell-v10`; private `public/service-worker.js` remains the no-cache push/click worker.
  - Public README clone instructions still point to `pentiumxp/codex-mobile-web-public`.

## 2026-05-09 Settings Panel Font Size Integration - 10:36 +08:00

- User request:
  - Move font-size settings into the new settings button/panel and make it visually match the color/theme settings.
- Code changes:
  - `public/index.html` removed the standalone `fontSizeSelect` dropdown from the sidebar header.
  - The existing gear settings panel now contains both `主题` and `字体大小` sections, each using segmented button groups.
  - `public/app.js` now renders and handles `[data-font-size-choice]` buttons, still persisting `codexMobileFontSize` and applying `:root[data-font-size]`.
  - `public/styles.css` replaced the old dropdown styling with shared `.settings-options` segmented styles used by both theme and font-size controls.
  - `README.md` and `.agent-context/PROJECT_CONTEXT.md` document that theme and font-size choices now live together in the settings panel.
- Validation:
  - `npm.cmd test`, `npm.cmd run check`, `npm.cmd run check:macos`, and `git diff --check` passed.
- Public release:
  - User later explicitly requested public push.
  - Synced the same frontend/README change to `C:\Users\xuxin\Documents\codex-mobile-web-public`.
  - Preserved public-only service worker registration path `/sw.js`.
  - Bumped public `public/sw.js` shell cache to `codex-mobile-shell-v11`.
  - Public validation passed: `npm.cmd test`, `npm.cmd run check`, `npm.cmd run check:macos`, `git diff --check`, and a targeted privacy scan for private paths/repo URLs/IP/Tailscale/Hermes markers.
  - Public commit `27bf27b 整合字体大小设置面板` pushed to `origin/main`.

## 2026-05-09 Git Fast-Forward Self Update - 11:05 +08:00

- User request:
  - Add a startup check for whether the GitHub public/current remote has newer code, show an update hint near the version area, and let the user click to pull and restart.
- Private code changes:
  - `server.js` now exposes app version and update config through `/api/public-config`.
  - Added authenticated `GET /api/app-update/status` and `POST /api/app-update/apply`.
  - Update status checks the current Git checkout against `CODEX_MOBILE_UPDATE_REMOTE` / `CODEX_MOBILE_UPDATE_BRANCH`, default `origin/main`, using a fetch refspec that updates the remote-tracking branch.
  - Apply is intentionally fast-forward only. It refuses non-Git installs, missing remotes, dirty working trees, detached/wrong branches, and ahead/diverged local branches. Remote URLs/errors mask URL credentials before returning to the browser.
  - After a successful fast-forward, the server responds to the browser and schedules `shutdown()`, relying on the existing hidden startup supervisor to restart the 8787 listener from updated files.
  - `public/index.html`, `public/app.js`, and `public/styles.css` add a sidebar version/update pill. After login it checks updates in the background; available clean updates ask for confirmation before applying. Blocked/unsupported/error states are surfaced through the pill and click alerts.
  - `README.md` documents self-update behavior and environment variables. `.agent-context/PROJECT_CONTEXT.md` records the durable update semantics.
- Validation:
  - `npm.cmd test` passed with 7 tests.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with line-ending warnings only.
  - A temporary local server on a separate port returned `/api/public-config` update config correctly, and `/api/app-update/status?force=1` reported the expected blocked state because the current worktree contains these uncommitted changes.
  - A temporary local server returned `409` from `/api/app-update/apply` while the worktree was dirty, confirming the safety refusal path.
- Runtime activation:
  - Restarted the 8787 Mobile Web listener after the `server.js` change. Old listener PID `63392`; new listener PID `67020`.
  - Authenticated `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, and `lastError=null`.
  - Authenticated `/api/app-update/status?force=1` returned `state=blocked`, `dirty=true`, and `reason=working tree has local changes`, which is expected while these changes are uncommitted.
- Public release:
  - User explicitly approved updating public and requested the public version be one patch version higher than private for testing.
  - Synchronized the self-update implementation to `C:\Users\xuxin\Documents\codex-mobile-web-public`.
  - Preserved public-only differences: `public/app.js` registers `/sw.js`; README clone instructions point to `pentiumxp/codex-mobile-web-public`; public `public/sw.js` cache is `codex-mobile-shell-v12`.
  - Bumped public `package.json` / `package-lock.json` version to `0.1.1`; at that moment private remained `0.1.0` before the follow-up private version bump below.
  - Public validation passed: `npm.cmd test`, `npm.cmd run check`, `npm.cmd run check:macos`, `git diff --check`, a temporary local update-status API check, and a targeted privacy scan for private paths/repo URLs/IP/Tailscale/Hermes markers.
  - Public commit `b8bb3e6f513a443b8e0600fd857be8c84fbad26a` pushed to `origin/main`.
  - After push, a temporary public local server returned `version=0.1.1`, `state=up-to-date`, `dirty=false`, `ahead=0`, and `behind=0` for `/api/app-update/status?force=1`.

## 2026-05-09 Private Version Bump For Current App Display - 14:45 +08:00

- User clarification:
  - Do not add a separate public-release update channel just for the current private app. Instead, directly bump the private repository version number.
- Code change:
  - Bumped private `package.json` and `package-lock.json` from `0.1.0` to `0.1.1`.
- Operational note:
  - The running server reads `package.json` once at startup, so the 8787 listener must be restarted after this change for the sidebar version pill and `/api/public-config` to show `0.1.1`.
- Follow-up validation:
  - User correctly noted that simply bumping private and restarting the live 8787 service did not validate the self-update flow.
  - A temporary clean clone of `https://github.com/pentiumxp/codex-mobile-web.git` was reset to old private commit `cf6412852a7bdd2457f0c7ca446c5c1b976f6152` on `main`, where `package.json` was `0.1.0` and `HEAD...origin/main` was `0 1`.
  - Running that old checkout on an isolated local port returned `/api/app-update/status?force=1&fetch=1` with `state=update-available`, `behind=1`, `updateAvailable=true`, and `canFastForward=true`.
  - Calling `/api/app-update/apply` returned `updated=true`; the clone advanced to commit `317a68a`, and disk `package.json` became `0.1.1`.
  - Restarting the updated clone returned `/api/public-config` `version=0.1.1` and `/api/app-update/status?force=1` `state=up-to-date`, `dirty=false`, `ahead=0`, `behind=0`.
  - The temporary clone was deleted after validation.

## 2026-05-09 Conversation Return-To-Bottom Button - 16:04 +08:00

- User request:
  - Long sessions can land or remain in the middle of a conversation, requiring repeated manual scrolling to return to the newest turn.
- Code changes:
  - `public/index.html` adds a hidden floating `scrollToBottom` button between the conversation pane and composer.
  - `public/styles.css` positions the button above the composer on desktop, phone, and tablet layouts, using the existing composer-height CSS variable and safe-area inset.
  - `public/app.js` shows the button only when a current thread is loaded, the conversation is scrollable, and the viewport is not near the bottom. It hides the button on home, loading, and error states.
  - Clicking the button uses the existing immediate scroll-to-bottom behavior; normal rendering still avoids forcing the scroll position while the user is reading older content.
  - `README.md` and `.agent-context/PROJECT_CONTEXT.md` document the user-visible behavior.
- Validation:
  - `npm.cmd test` passed with 7 tests.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with line-ending warnings only.
- Runtime note:
  - This is a static frontend change. Existing browser/PWA sessions need a refresh to load the updated `index.html`, `app.js`, and `styles.css`.
  - Public repo was not updated; wait for explicit user approval before syncing `C:\Users\xuxin\Documents\codex-mobile-web-public`.

## 2026-05-09 Thread Switch Detail Read Threshold - 16:15 +08:00

- User-reported issue:
  - After the PR merges, switching sessions / loading a session felt slower than before. Larger rollout sessions were noticeably slower, taking several seconds instead of opening nearly immediately.
- Findings:
  - Local API timing reproduced the size correlation: `/api/threads` was about `307ms`; a `44.9MB` thread detail read took about `748ms`; a `184MB` thread detail read took about `2752ms`.
  - Both larger sessions were still using full app-server `thread/read`, because `CODEX_MOBILE_THREAD_DETAIL_ROLLOUT_MAX_BYTES` defaulted to the same `200MB` value as the UI rollout warning threshold.
  - Direct bounded `thread/turns/list` for the same sessions was much faster: about `182ms` for the `44.9MB` thread and `506ms` for the `184MB` thread.
- Code change:
  - `server.js` now defaults `CODEX_MOBILE_THREAD_DETAIL_ROLLOUT_MAX_BYTES` to `33554432` (`32MB`) instead of inheriting the `200MB` warning threshold.
  - The `200MB` `CODEX_MOBILE_ROLLOUT_WARNING_BYTES` UI warning / continuation threshold is unchanged.
  - `README.md` and `.agent-context/PROJECT_CONTEXT.md` now document that the performance threshold and UI warning threshold are intentionally separate.
- Runtime validation:
  - Restarted only the 8787 Node listener so the new startup constant took effect. Old listener PID `75020`; new listener PID `10704`.
  - `/api/status` returned `ready=True`, `transport=external-jsonl-tcp`, `lastError=` after restart.
  - Post-change detail timings:
    - `184.1MB` thread: about `638ms`, mode `large-rollout-turns-list`, `12` turns.
    - `45MB` thread: about `290ms`, mode `large-rollout-turns-list`, `12` turns.
    - Smaller threads under `32MB` continue to use `thread-read`.
- Validation:
  - `npm.cmd test` passed with 7 tests.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with line-ending warnings only.
- Public release:
  - User later explicitly requested submit and push including public.
  - Synchronized the `server.js` threshold change and README documentation to `C:\Users\xuxin\Documents\codex-mobile-web-public`.
  - Public README includes Chinese explanation that the `32MB` detail-read performance threshold is separate from the `200MB` compression-continuation warning threshold.
  - Public commit message was written in Chinese with detailed behavior, user impact, documentation, and validation notes, following the updated public release rule.
  - Public validation passed: `npm.cmd test`, `npm.cmd run check`, `npm.cmd run check:macos`, `git diff --check`, and targeted privacy scan for local paths, private repo URLs, LAN/Tailscale markers, and Hermes markers.
  - Public commit `e0addcb127c779e3cf4f5500d11357f255f714d6` pushed to `origin/main`.

## 2026-05-09 iOS PWA Blank Return From Input Method Permission - 16:51 +08:00

- User-reported issue:
  - When switching input methods and opening an input-method permission/settings screen, returning to Mobile Web can show a black/empty window that is not the original app window. Switching back to the original app/window restores the real UI.
- Likely cause:
  - iOS PWA / WebKit can create or restore a separate web app scene after returning from Settings/input-method permission flows.
  - The Mobile Web HTML initially hides both `#login` and `#app`, and the old startup path waited for `/api/public-config` before revealing either pane. If that new/restored scene hit a transient stalled/failed config request, it could remain visually black even though the original scene was still alive.
- Code changes:
  - `public/app.js` now reveals a cached shell immediately at startup: if a stored access key exists, show the app shell before `/api/public-config`; otherwise show login.
  - `/api/public-config` is now fetched through the normal `api()` helper with an 8-second timeout. If it fails and an access key exists, the app shell stays visible and shows the error instead of leaving a hidden black page.
  - Added a blank-shell watchdog. While visible, if both `#login` and `#app` are hidden, it restores the app shell when a key exists or login otherwise. Recovery emits a compact `blank_shell_recovered` client event when authenticated.
  - `resumeMobileSession()` also invokes blank-shell recovery before the heavier visual recovery passes.
  - `README.md` and `.agent-context/PROJECT_CONTEXT.md` document the startup-shell and blank-shell watchdog rule.
- Validation:
  - `npm.cmd test` passed with 7 tests.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with line-ending warnings only.
- Runtime note:
  - Static frontend-only change; the 8787 Node listener does not need restart.
  - Existing browser/PWA sessions need a refresh to load the updated `public/app.js`.
  - Public repo was not updated in this step. Follow the project rule: wait for explicit user approval before syncing `C:\Users\xuxin\Documents\codex-mobile-web-public`.

## 2026-05-09 iOS PWA Blank Return Follow-up - 17:00 +08:00

- User feedback:
  - The first blank-return fix did not resolve the issue.
- Follow-up diagnosis:
  - The first fix only covered the case where JavaScript was already running and both root panes were hidden.
  - The remaining failure can happen earlier or lower in the WebKit/PWA scene lifecycle: the restored scene may show the static page before startup JavaScript/config finishes, or a previous visual-recovery transform/class can remain around a suspended scene.
- Code changes:
  - `public/index.html` now leaves the app shell visible in static HTML instead of hiding both root panes by default. Startup JavaScript still switches to login when auth requires it and no saved access key exists.
  - `public/index.html` now includes a pre-app boot fallback (`Codex / 正在恢复界面 / 重新载入`), early service-worker registration, and an inline early diagnostic script. When a saved key exists, it posts compact `early_boot` client events with phase, visibility, standalone mode, and viewport dimensions, without raw secrets or user content.
  - `public/app.js` now clears transient visual-recovery classes/transforms before showing login/app, before new foreground recovery passes, and when the page blurs, hides, or receives `pagehide`.
  - `public/app.js` now registers the service worker during normal startup even when Web Push is not being enabled, so the app shell cache is installed independently of notification setup.
  - `public/service-worker.js` now caches the private app shell and uses cached `index.html` for navigation after a short network timeout, while bypassing `/api/` and `/uploads/`. This mirrors the public PWA shell-cache behavior and targets the pure black iOS launch screen where page HTML was not reached.
  - Follow-up evidence from startup logs showed `early_boot`, `early-service-worker-registered`, and `app-app-shown` events from the iPhone while the user still saw pure black, so page JavaScript did run and the remaining issue is a WebKit/PWA paint/compositing failure.
  - Removed the heavy iOS recovery compositor hints: root/body/app 3D transforms and the full-screen transparent `body::before` pseudo-element are no longer used. These were plausible contributors to a black composited surface.
  - The boot fallback is no longer hidden immediately by `app-booted`; it stays visible during startup/resume and is hidden later through `app-ready`, giving iOS a visible fixed layer while the main app repaints.
  - After the user still reproduced pure black, the default iOS launch mode was changed to avoid standalone Web App scenes: `public/manifest.json` now uses `display: "browser"` and `display_override: ["browser"]`, `public/index.html` sets `apple-mobile-web-app-capable=no`, and the service-worker cache is bumped to `codex-mobile-shell-v3`. Existing Home Screen installs may keep the old standalone mode until the user deletes and re-adds the icon from Safari.
  - Follow-up logs showed both `standalone:true` Safari/Home Screen paths and `standalone:false` Chrome/browser paths. The standalone warning gate caused false-positive UX when the user tried browser paths, so it was removed. Mobile Web now records diagnostics but does not block entry based on display-mode checks; service-worker cache was bumped to `codex-mobile-shell-v5`.
  - Follow-up user feedback: the fallback still appeared on every refresh and was disruptive. The boot fallback is now hidden by default through CSS and only becomes visible after a 2.5s startup timeout or an explicit shell recovery path. `showBootFallback()` adds `boot-fallback-visible`, `hideBootFallback()` removes it, and the service-worker cache was bumped to `codex-mobile-shell-v6`.
  - The blank-shell watchdog now also treats a visible but collapsed app pane as recoverable, not only the "both root panes hidden" case.
  - Focus-out visual recovery is suppressed when the document has already lost focus, reducing the chance that opening an input-method permission screen leaves a stale repaint layer behind.
  - `public/styles.css` now uses `100vh` / `100svh` startup fallbacks for the app shell and boot fallback, reducing dependence on `100dvh` before JavaScript updates `--app-height`.
- Documentation:
  - `README.md` and `.agent-context/PROJECT_CONTEXT.md` now describe the static visible shell, collapsed-pane recovery, and suspended-scene cleanup behavior.
- Validation:
  - `npm.cmd test` passed with 7 tests.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with line-ending warnings only.
- Runtime note:
  - Static frontend-only change; existing PWA sessions need a refresh/relaunch to load the new `index.html` and `app.js`.
  - Public repo was not updated in this step; wait for explicit user approval before syncing public.

## 2026-05-09 iOS Full-Screen PWA Recovery Adjustment

- User clarification:
  - Browser display mode avoids the black-return issue but is not acceptable because the target use case requires a full-screen Home Screen app.
  - Follow-up screenshot showed the black page is a separate iOS PWA scene/window, while the original Codex scene on the left is still alive. Reloading the original scene is therefore the wrong recovery target.
- Code changes:
  - Restored full-screen PWA install behavior: `public/manifest.json` now uses `display: "standalone"` with `display_override: ["standalone", "fullscreen"]`, and `public/index.html` sets `mobile-web-app-capable=yes`, `apple-mobile-web-app-capable=yes`, and `apple-mobile-web-app-status-bar-style=black-translucent`.
  - `public/manifest.json` now also declares stable PWA identity with `id: "/"` and `launch_handler.client_mode` preferring `focus-existing` / `navigate-existing` where supported, so repeated launches should prefer the existing PWA client instead of creating an additional app scene.
  - Removed the iOS standalone resume hard-reload recovery because it refreshed the original good scene and did not affect the separate black scene.
  - `public/service-worker.js` now opens `/` when no notification client exists, then posts the target thread id to that client. It no longer directly opens `/?thread=...`, which can be treated by iOS as a distinct PWA launch target.
  - `public/app.js` now installs a `launchQueue` consumer when available and routes launch target URLs through the existing external-thread selection path.
  - Fixed the private HTML icon references from missing `/icons/...` paths to the existing `/icon.svg` path. This reduces the chance of generic PWA icons after a fresh Home Screen install, though iOS may still prefer PNG touch icons in some versions.
  - Bumped the private service-worker app-shell cache to `codex-mobile-shell-v8`.
- Documentation:
  - `README.md` now states that full-screen standalone PWA is intentional and that the black-scene issue is a multi-scene launch problem, not a simple repaint problem.
  - `.agent-context/PROJECT_CONTEXT.md` records that future iOS recovery work must preserve full-screen PWA mode unless the user explicitly changes that requirement.
- Publication status:
  - Private workspace only. Do not sync public until the user tests and explicitly requests public update.

## 2026-05-09 Disable Boot Recovery Overlay

- User decision:
  - The iOS separate black PWA scene issue is deferred for now.
  - The page-entry recovery / old-page prompt should be removed because it is disruptive.
- Code changes:
  - `public/index.html` no longer renders the `bootFallback` overlay markup.
  - The early startup timeout still reports a compact diagnostic event, but it no longer adds `boot-fallback-visible`.
  - `public/app.js` suppresses `showBootFallback()` by removing `boot-fallback-visible` instead of showing an overlay, while keeping the normal shell recovery logic.
  - `public/styles.css` keeps any stale `boot-fallback-visible` state hidden so old cached HTML plus new CSS does not display the prompt.
  - Bumped private service-worker app-shell cache to `codex-mobile-shell-v9`.
- Documentation:
  - `README.md` and `.agent-context/PROJECT_CONTEXT.md` now state that the boot recovery overlay is intentionally disabled.
- Publication status:
  - Private workspace only. Do not sync public until the user tests and explicitly requests public update.

## 2026-05-09 Light Theme Warmer Page Background

- User request:
  - Make the daytime/light page background slightly more yellow.
- Code changes:
  - `public/styles.css` changed the light-theme `--bg` value from the previous cool gray to a warmer pale background for both explicit `light` mode and system-light mode.
  - `public/index.html` updated the early light `theme-color` metadata to match the warmer background before the app bundle loads.
- Publication status:
  - Private workspace only. Do not sync public until the user tests and explicitly requests public update.

## 2026-05-09 Web Push Button Visible After PWA Reinstall

- User-reported issue:
  - After reinstalling the PWA, the Web Push registration button disappeared and notifications could not be enabled.
- Finding:
  - `public/index.html` renders the button initially as `class="push-button hidden"`.
  - `updatePushButton()` updated text and disabled/error/ready states but never removed `hidden`, so a fresh PWA install could keep the button invisible.
- Code changes:
  - `public/app.js` now removes `hidden` whenever `updatePushButton()` runs, so the sidebar shows the current notification state such as enable, test, HTTPS required, unsupported, or blocked.
  - Bumped private service-worker app-shell cache to `codex-mobile-shell-v10` so cached `app.js` updates are picked up.
- Publication status:
  - User explicitly requested public push on 2026-05-10.
  - Public repo `C:\Users\xuxin\Documents\codex-mobile-web-public` was updated with the public-safe subset of these changes:
    - Web Push button removes initial `hidden` state in `updatePushButton()`.
    - Public `manifest.json` adds stable `id: "/"`, `display_override`, and `launch_handler` hints while preserving public PNG icon assets.
    - Public `sw.js` cache bumped to `codex-mobile-shell-v14`, navigation uses cached `index.html` after a short timeout, and notification clicks open `/` before posting the target thread id.
    - Public light theme background changed to the warmer `#f8f6ee`.
    - Public package version bumped to `0.1.2`.
    - Public README received detailed Chinese release notes, Web Push behavior notes, PWA limitation notes, and cache activation guidance.
  - Public validation passed: `npm.cmd test`, `npm.cmd run check`, `npm.cmd run check:macos`, `git diff --check`, and a targeted diff privacy scan for local paths, private repo markers, LAN/Tailscale markers, Hermes markers, access-key and Web Push runtime file names.
  - Public commit `7e50677 发布移动端 PWA 与推送体验修正` pushed to `origin/main`.

## 2026-05-11 Public PR #20 iPad Landscape Layout

- User request:
  - Public repository had a new pull request to pull/merge.
- PR reviewed:
  - `pentiumxp/codex-mobile-web-public#20` titled `[移动端] 增加 iPad 横屏双栏布局`.
  - The PR touched `public/app.js`, `public/styles.css`, and `public/sw.js`.
  - GitHub CI `Node checks` was green before integration.
- Integration approach:
  - The PR author's branch could not be pushed to directly from this environment even though GitHub reported maintainer modification was allowed; `git push` to the contributor fork returned `permission denied`.
  - To satisfy the public release rule that public code changes must include detailed Chinese README documentation in the same public commit, the PR code changes and a README release-note update were integrated locally with a squash commit on public `main`.
  - The original PR was commented with the integration details and closed. GitHub shows it as closed rather than merged because the final public commit is a local squash with added README documentation, not the contributor head commit.
- Public changes pushed:
  - Public commit `defe3a9 集成 iPad 横屏双栏布局` pushed to `C:\Users\xuxin\Documents\codex-mobile-web-public` `origin/main`.
  - iPad / coarse-pointer landscape screens at roughly `min-width: 900px` and `min-height: 600px` now use a persistent left session/sidebar plus right conversation pane.
  - Phone, narrow, and iPad portrait layouts keep the drawer/sidebar behavior.
  - `public/app.js` now keeps sidebar overlay detection aligned with the new CSS tablet split breakpoint.
  - Public service worker cache bumped from `codex-mobile-shell-v14` to `codex-mobile-shell-v15`.
  - Public `README.md` added a `2026-05-11 Public 发布说明` section with Chinese user-visible behavior, scope, and cache activation notes.
- Validation:
  - Public `npm.cmd test` passed.
  - Public `npm.cmd run check` passed.
  - Public `npm.cmd run check:macos` passed.
  - Public `git diff --cached --check` passed before commit.
  - Public privacy scan found no local user paths, private repo markers, LAN/Tailscale markers, Hermes markers, access-key markers, or Web Push runtime file markers.
- Remaining open public PRs after closing #20:
  - #14 `优化运行中消息引导反馈`
  - #15 `增加移动端同步健康日志`
  - #16 `增加线程切换和恢复诊断`
  - #17 `[移动端] 完善新建对话入口与工作区下拉`
  - #18 `[移动端] 将左滑操作改为归档` - conflicts with the current product rule that left swipe exposes `压缩续接`; do not merge blindly.
  - #19 `[移动端] 只读显示 session 的模型和推理强度`

## 2026-05-11 Public PR Batch Merge (#14/#15/#16/#17/#19)

- User request:
  - Continue processing remaining public pull requests.
- Scope integrated to public main:
  - PR #14 optimize running-turn steer feedback UX.
  - PR #15 add mobile sync-health diagnostics logs and log-size guards.
  - PR #16 thread switch/resume diagnostics (resulted empty during cherry-pick because equivalent behavior was already present after merged stack and conflict resolution).
  - PR #17 mobile new-thread entry and workspace picker improvements.
  - PR #19 mobile model/reasoning read-only behavior and no model/effort submit from mobile.
- Public release commit:
  - `5b57a54 合并移动端体验增强与诊断能力（PR #14/#15/#16/#17/#19）` pushed to `origin/main` in `C:\Users\xuxin\Documents\codex-mobile-web-public`.
- Public documentation and cache:
  - README updated with detailed Chinese notes for this batch release.
  - Public service-worker cache bumped to `codex-mobile-shell-v16`.
- Validation:
  - `npm.cmd test` passed.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed.
  - Public privacy scan passed for local paths/private markers/runtime secret markers.
  - GitHub CI for commit `5b57a54` completed with `success`.
- PR closure:
  - Added integrated-to-main comments and closed PRs #14/#15/#16/#17/#19.
- Remaining open public PRs after this batch:
  - #18 `[移动端] 将左滑操作改为归档` (still open; conflicts with current product rule that left swipe exposes `压缩续接`).
  - Newly observed open PRs: #21, #22, #23 (not processed in this batch).

## 2026-05-13 Scheduled Shared-Chain Restart

- User request:
  - Create a scheduled restart for processes that may become slow over long uptimes.
  - Scope should not include Hermes Mobile or Gateway, because the user had already restarted those repeatedly without restoring speed.
- Implemented scripts:
  - `restart-codex-mobile-shared-chain.ps1`
    - Stops the `Codex Mobile Web` scheduled task.
    - Stops only matching Codex Mobile Web shared-chain processes: hidden/windowless launchers for this workspace, this workspace's `server.js`, this workspace's app-server mux, and `%USERPROFILE%\.codex-mobile-web\codex.exe app-server`.
    - Removes `%USERPROFILE%\.codex\app-server-mux\endpoint.json`.
    - Starts `Codex Mobile Web` again and waits for both HTTP on port `8787` and mux endpoint readiness.
    - Logs to `%USERPROFILE%\.codex-mobile-web\scheduled-shared-chain-restart.log`.
  - `install-codex-mobile-shared-chain-restart.ps1`
    - Installs or uninstalls the scheduled restart task.
    - Uses `powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden`, so the task is hidden/no-window.
- Installed task:
  - Name: `Codex Mobile Web Shared Chain Restart`
  - Schedule: daily at `04:30`
  - Next run after installation: `2026-05-14 04:30:00`
  - Hidden: `True`
  - It intentionally does not restart Hermes Mobile, Gateway, WSL, or Codex Desktop.
- Validation:
  - PowerShell scriptblock syntax check passed for both scripts.
  - Dry run of `restart-codex-mobile-shared-chain.ps1 -DryRun` matched only the expected current processes: `wscript.exe`, the windowless PowerShell launcher, `node.exe` mux, `codex.exe app-server`, and `node.exe server.js`.
  - `Get-ScheduledTask` verified the new task is `Ready`, hidden, and points at `restart-codex-mobile-shared-chain.ps1`.

## 2026-05-13 Public PR #26-#30 Integration And Public-First Sync

- User decision:
  - Future PR integrations should be public-first: merge/integrate public PRs in `C:\Users\xuxin\Documents\codex-mobile-web-public`, then sync product files into the private repo.
  - Private repo should stay aligned with public product code and keep only local-only overlays such as `.agent-context`, raw runtime state, generated binaries, and local scheduled-task helper scripts.
- Public PRs processed:
  - #26 `恢复 Composer 运行时设置卡片`
  - #27 `修复移动端 Markdown 列表和链接渲染`
  - #28 `保留移动端浏览器本地草稿`
  - #29 `重构移动端核心前端模块`
  - #30 `记录压缩续接 lineage`
- Public merge results:
  - PR #26 was squash-merged with Chinese detailed commit `00062bf 合并 PR #26：恢复移动端 Composer 运行时设置卡片`.
  - PR #27 was squash-merged with Chinese detailed commit `f0b02fd 合并 PR #27：修复移动端 Markdown 列表和链接渲染`.
  - PR #28/#29/#30 were stacked on top of one another and conflicted after #26/#27 squash merges. To avoid bringing duplicate and English PR commits into public history, their final #30 tree was squash-integrated with Chinese detailed commit `7393a58 合并 PR #28/#29/#30：草稿保存、前端模块化与续接 lineage`.
  - PR #28/#29/#30 were commented with the integration commit and closed because GitHub could not directly mark them merged after the stacked conflict resolution.
- Public changes integrated:
  - Composer runtime cards are editable again: model, reasoning effort, permission, and quota render as compact cards; selected model/effort/permission are submitted for existing-thread sends and new-thread first messages.
  - Browser-local composer drafts are saved per thread and per new-thread workspace. Text uses `localStorage`; resumable attachments use IndexedDB where available.
  - Frontend core modules were split into `public/api-client.js`, `public/runtime-settings.js`, `public/draft-store.js`, and `public/markdown-renderer.js`.
  - Markdown rendering now has dedicated module/test coverage for ordered lists, bare URLs, safe links, unsafe links, and code-copy hooks.
  - Continuation lineage records successful continuation links in `.agent-context/thread-handoffs/index.jsonl` and includes bounded lineage instructions in future continuation bootstrap messages.
  - Public app shell uses `public/sw.js` and cache `codex-mobile-shell-v39`.
- Public validation:
  - `npm.cmd test` passed with 58 tests.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --cached --check` passed.
  - Privacy scan of staged public diff found no local user paths, private repo paths, LAN/Tailscale markers, Hermes markers, or Web Push runtime file markers.
- Private sync:
  - Product files were copied from public main into private after public push. Private now follows public product layout, including `public/sw.js` instead of private-only `public/service-worker.js`, version `0.1.4`, and the new frontend modules/tests.
  - Preserved private-only overlays: `.agent-context`, `AGENTS.md`, `data`, `logs`, generated `codex-app-server-mux.exe`, and the local scheduled shared-chain restart scripts.
  - The earlier private-only PWA boot fallback/client-reset/service-worker recovery path is no longer present in product code after the public-upstream sync. If needed again, implement it in public first, then sync private.
- Private validation after sync:
  - `npm.cmd test` passed with 58 tests.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.

## 2026-05-14 Public Release 0.1.5

- User explicitly requested pushing public after the mobile display fixes.
- Public repo: `C:\Users\xuxin\Documents\codex-mobile-web-public`.
- Public commit pushed:
  - `a17d4d2 发布移动端协作 Agent 与额度显示修复`
- Public version/cache:
  - `package.json` / `package-lock.json` version bumped from `0.1.4` to `0.1.5`.
  - `public/sw.js` cache bumped to `codex-mobile-shell-v42`.
- Product changes published:
  - `collabAgentToolCall` now renders as a compact Chinese “协作 Agent” card instead of expanding raw JSON in the conversation.
  - Raw JSON remains available under a collapsed details block with copy support.
  - Mobile Composer quota card was lightly widened and its internal spacing compressed so the weekly quota percent is not clipped at large mobile font sizes.
- Public README:
  - Added a detailed Chinese `2026-05-14 Public 发布说明` section covering the rendering change, quota layout change, cache bump, and version bump.
- Validation before push:
  - `npm.cmd test` passed with 59 tests.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed, with only Windows LF-to-CRLF working-copy notices.
  - Staged public diff privacy scan found no local user path, private repo marker, LAN marker, access key marker, or Web Push runtime secret-file marker.
- Private repo note:
  - Product files in private already contain the same display fixes, but private has not been committed in this step.

## 2026-05-14 Turn Scroll Controls

- User request:
  - Add an upward shortcut for the case where a just-completed turn leaves the user at the bottom after long receipt/tool output, but the user wants to jump back to the turn's reply/summary content.
  - While a turn is streaming output line by line, if the user manually drags/scrolls the conversation, stop forcing the conversation to keep sticking to the bottom. The user scroll gesture means they want to inspect the current output position.
- Implemented in private product code:
  - Added `#scrollToTurnReply` next to the existing `#scrollToBottom` floating button.
  - The new up arrow is shown only for the current thread's recently completed latest turn, while the viewport is near the bottom and the latest assistant reply in that turn is above the visible conversation viewport.
  - Clicking it scrolls to the latest `.item.agentMessage` in the completed turn; if no assistant message exists it falls back to the first non-user/non-live-operation item, then the turn itself.
  - Added a per-turn `autoScrollHold`: touch/pointer/wheel intent plus a real conversation scroll during a live turn disables automatic bottom stick for that turn. Returning to the bottom or pressing the down arrow clears the hold and resumes normal behavior.
  - Programmatic scrolls are marked so the auto-scroll hold is not triggered by Mobile Web's own render-time scroll-to-bottom.
  - `public/sw.js` cache bumped to `codex-mobile-shell-v43`.
- Tests:
  - Added `test/turn-scroll-controls.test.js` for the up-arrow anchor and live auto-scroll hold behavior.
  - Updated `test/mobile-viewport.test.js` for cache `v43`.
- Validation:
  - `npm.cmd test` passed with 61 tests.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed, with only Windows LF-to-CRLF working-copy notices.
- Browser verification note:
  - The in-app Browser plugin's required Node REPL control tool was not exposed by tool discovery in this session, so browser-level interaction testing was not run here.

## 2026-05-14 Public Release 0.1.6

- User explicitly requested pushing public after the turn scroll-control fixes.
- Public repo: `C:\Users\xuxin\Documents\codex-mobile-web-public`.
- Public commit pushed:
  - `41d31d8 发布移动端回执滚动控制修复`
- Public version/cache:
  - `package.json` / `package-lock.json` version bumped from `0.1.5` to `0.1.6`.
  - `public/sw.js` cache bumped to `codex-mobile-shell-v43`.
- Product changes published:
  - Added the recently completed turn up-arrow button that jumps from the bottom back to the current turn's latest `agentMessage`.
  - Live turn output now respects manual conversation scrolling: touch/pointer/wheel scroll intent plus a real scroll disables auto-stick-to-bottom for that turn until the user returns to bottom or presses the down arrow.
  - Mobile quota summary keeps the compact separator dot between 5-hour and weekly quota while retaining the narrow-screen width fix.
- Public README:
  - Added a detailed Chinese `2026-05-14 Public 发布说明（续）` section covering the new up arrow, live scroll hold behavior, quota separator, cache bump, and version bump.
- Validation before push:
  - `npm.cmd test` passed with 61 tests.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed, with only Windows LF-to-CRLF working-copy notices.
  - Staged public diff privacy scan found no local user path, private repo marker, LAN/Tailscale marker, access key marker, or Web Push runtime secret-file marker.

## 2026-05-14 Background-Completed Turn Reply Anchor Fix

- User report:
  - If a different thread/turn finishes in the background and the user switches into it after completion, the bottom up-arrow does not appear even though the turn just ended.
- Cause:
  - `recentCompletedReplyAnchor` was only written by live `turn/completed` notifications for the currently open thread.
  - Background completion only marked the thread unread in the list; after switching into the thread, the detail load did not derive an anchor from the latest completed turn.
- Private local changes:
  - `public/app.js`
    - Added `primeRecentCompletedReplyAnchor()` to derive the reply anchor from the latest completed turn after thread detail load/refresh.
    - Captures `wasUnreadOnOpen` before `markThreadViewed()` and forces the anchor for unread completed threads opened from the list.
    - Uses turn completion timestamps (`completedAt`, `completedAtMs`, snake_case variants, finished/updated variants) and falls back to thread `updatedAt` to keep the normal 10-minute “recent completion” window for non-unread direct opens.
    - Cached same-thread opens and current-thread refreshes also try to prime the anchor, covering missed completion events or notification-open paths.
  - `public/sw.js`
    - Bumped app-shell cache to `codex-mobile-shell-v44`.
  - `test/turn-scroll-controls.test.js`
    - Added assertions for unread thread-open anchor priming and completed-turn timestamp derivation.
  - `test/mobile-viewport.test.js`
    - Updated cache-version assertion to `v44`.
- Validation:
  - `npm.cmd test` passed with 61 tests.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed, with only Windows LF-to-CRLF working-copy notices.
- Publication status:
  - Superseded by the later 0.1.7 commit/push request recorded above.

## 2026-05-14 Release 0.1.7 And Public Push

- User explicitly requested commit and push, including public.
- Version alignment:
  - Private `package.json` / `package-lock.json` bumped from `0.1.4` to `0.1.7`.
  - Public `package.json` / `package-lock.json` bumped from `0.1.6` to `0.1.7`.
  - `public/sw.js` cache remains the new `codex-mobile-shell-v44`.
- Public repo:
  - Path: `C:\Users\xuxin\Documents\codex-mobile-web-public`.
  - Pushed commit: `3225803 发布移动端本轮回复跳转逻辑修正`.
  - Public README gained a Chinese `2026-05-14 Public 发布说明（续二）` section describing the upward-scroll-only trigger, answer-start jump target, 10-minute recency window, coexistence with the down arrow, PWA cache `v44`, and version `0.1.7`.
- Validation before public/private commits:
  - Private: `npm.cmd test` passed with 61 tests; `npm.cmd run check` passed; `npm.cmd run check:macos` passed; `git diff --check` passed with only Windows LF-to-CRLF notices.
  - Public: `npm.cmd test` passed with 61 tests; `npm.cmd run check` passed; `npm.cmd run check:macos` passed; `git diff --check` passed with only Windows LF-to-CRLF notices.
  - Public staged diff privacy scan found no local user path, raw access-key marker, Web Push runtime file marker, LAN/Tailscale marker, or other runtime secret marker.
- Private repo:
  - The private commit that includes this note records the same product changes plus this handoff update.

## 2026-05-14 Upward-Scroll Reply Jump Revision

- User revised the requirement:
  - The up-arrow should not appear simply because a turn recently completed or an unread/background thread was opened.
  - It should appear only after the user manually scrolls upward, and clicking it should jump to the start of the current answer.
- Private local changes supersede the previous automatic background anchor approach:
  - Removed `primeRecentCompletedReplyAnchor()` and the `wasUnreadOnOpen` thread-open priming path from `public/app.js`.
  - Added scroll-direction tracking with `conversationLastScrollTop`.
  - `updateRecentCompletedReplyAnchorFromScroll()` activates the jump anchor only when a recent user scroll intent causes `scrollTop` to decrease.
  - The anchor is allowed only for the current live turn or the latest turn completed within the existing 10-minute window.
  - The jump target changed from the latest `.item.agentMessage` to the first `.item.agentMessage` in the turn, falling back to the first non-user/non-live-operation item.
  - The reply up-arrow can coexist with the down-to-bottom arrow; `.scroll-turn-reply-button` is shifted left to avoid overlap.
  - Pressing the down-to-bottom button clears the reply jump anchor.
- Tests:
  - Updated `test/turn-scroll-controls.test.js` to cover upward user-scroll activation, recent-turn gating, first assistant-message target, and the new down-button clearing behavior.
- Validation:
  - `npm.cmd test` passed with 61 tests.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed, with only Windows LF-to-CRLF working-copy notices.
- Publication status:
  - Superseded by the later 0.1.7 commit/push request recorded above.

## 2026-05-14 Public PR #31/#32 Integration

- User request:
  - Public repo had two open PRs; merge them and pull the result back locally.
- Public repo:
  - Path: `C:\Users\xuxin\Documents\codex-mobile-web-public`.
  - Integrated PRs:
    - #31 `刷新线程详情标题来源`.
    - #32 `隐藏不可用的推送入口`.
  - #31 was GitHub-mergeable, #32 was conflicting against current `main` because it was based on older frontend/cache state. To preserve the public README rule and avoid an outdated cache/version merge, both PRs were manually integrated on top of current public `main`.
  - Public pushed commit: `92e8915 集成 PR #31/#32：刷新标题来源并隐藏不可用推送入口`.
  - Both PRs were commented with the integration commit and closed.
- Product changes:
  - `server.js`
    - Added `mergeThreadDisplaySummary(base, display)`.
    - Thread detail reads that already have a `state_5.sqlite` or started-cache summary now refresh display fields from app-server `thread/list`.
    - Only display fields are refreshed: `name`, `preview`, `cwd`, `updatedAt`, and `status`.
    - Runtime fields such as model, reasoning, sandbox, and approval policy are intentionally not overwritten.
  - `public/app.js`
    - Push notification button is hidden when Push is unavailable: server does not support Push, page is not secure, or browser does not support Push.
    - HTTPS-supported cases still show normal enable/test/blocked states.
  - `public/sw.js`
    - PWA shell cache bumped to `codex-mobile-shell-v45`.
  - `package.json` / `package-lock.json`
    - Version bumped to `0.1.8`.
  - `README.md`
    - Added detailed Chinese `2026-05-14 Public 发布说明（续三）` describing PR #31/#32 integration, display-field-only title refresh, hidden unavailable Push entry, cache `v45`, and version `0.1.8`.
  - Tests:
    - Added `test/thread-title-source.test.js`.
    - Updated `test/mobile-viewport.test.js` for cache `v45` and unavailable Push button hiding.
- Validation:
  - Public: `npm.cmd test` passed with 64 tests; `npm.cmd run check` passed; `npm.cmd run check:macos` passed; `git diff --check` and `git diff --cached --check` passed with only Windows LF-to-CRLF notices.
  - Public staged privacy scan found no local user path, raw access-key marker, Web Push runtime file marker, LAN/Tailscale marker, or other runtime secret marker.
  - Private after sync: `npm.cmd test` passed with 64 tests; `npm.cmd run check` passed; `npm.cmd run check:macos` passed; `git diff --check` passed with only Windows LF-to-CRLF notices.
- Private sync:
  - Copied public product files back into `C:\Users\xuxin\Documents\codex-mobile-web`: `README.md`, `package.json`, `package-lock.json`, `server.js`, `public/app.js`, `public/sw.js`, `test/mobile-viewport.test.js`, and `test/thread-title-source.test.js`.
  - Local-only overlays such as `.agent-context`, runtime state, generated binaries, and local scheduled-task scripts were not overwritten.

## 2026-05-15 Mobile Composer Bottom Position

- User reported the Codex Mobile input bar still floated above the bottom, while the comparable Hermes Mobile page did not.
- Comparison target:
  - `C:\ProgramData\HermesMobile\app\public\styles.css`
  - Hermes keeps the composer in the normal bottom grid row, uses `100vh`/`100dvh` by default, and only switches to measured visual viewport height when keyboard shrink is likely.
- Root cause judged from code:
  - Codex Mobile was overwriting `--app-height` with `visualViewport.height` even when no keyboard was open.
  - On iOS/PWA this value can under-report the real standalone viewport, leaving a stable blank area below the app.
  - Phone composer had also been changed to `position: fixed`, making it more sensitive to app/viewport mismatch and repaint transforms.
- Local fix:
  - `public/app.js`: `updateViewportVars()` now writes `--app-height` only while `viewport.keyboardShrunk` is true; otherwise it removes the inline override and lets CSS use `100dvh`.
  - `public/styles.css`: added `-webkit-fill-available` fallback for `html`/`body`; `.app` now has `height: 100vh` before `height: var(--app-height)`.
  - `public/styles.css`: phone `.composer` is back to normal layout flow (`position: relative`, `width: 100%`) with compact bottom padding, and phone `.conversation` no longer reserves composer-height padding for a fixed composer.
  - `public/sw.js` / `public/app.js`: PWA shell cache/build id bumped to `codex-mobile-shell-v55`.
  - Tests updated in `test/mobile-viewport.test.js` and `test/composer-quota.test.js`.
- Validation:
  - `npm.cmd test` passed: 66/66.
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy notices.
  - Local 8787 `/api/public-config` returned `clientBuildId: 0.1.8|codex-mobile-shell-v55`.
  - Headless mobile viewport 390x844 measurement with app manually unhidden: app bottom 844, composer bottom 844, bottom gap 0, composer position `relative`, app height variable `100dvh` with no inline `--app-height`.

## 2026-05-16 Manual Shared-Chain Restart

- User request:
  - Cancel the daily scheduled restart and replace it with a manual restart entry in the navigation/sidebar menu.
  - Put a small restart button next to the version number, ask for confirmation before restarting, and keep the restart button visually the same size as the version pill.
- Operational change:
  - Removed the hidden Windows Scheduled Task `Codex Mobile Web Shared Chain Restart`.
  - Verified `Get-ScheduledTask -TaskName 'Codex Mobile Web Shared Chain Restart'` returns no task.
- Code changes:
  - Added `adapters/shared-chain-restart-service.js`.
    - It builds an encoded delayed PowerShell command and launches `restart-codex-mobile-shared-chain.ps1` detached/hidden after the HTTP response can be sent.
    - It targets only the existing shared-chain restart script and `Codex Mobile Web` startup task.
  - `server.js` now wires authenticated `POST /api/restart/shared-chain` to the new service and returns `202` when the restart is scheduled.
  - `public/index.html` adds `#sharedRestartButton` beside `#appUpdateStatus` inside a shared `.version-actions` container.
  - `public/styles.css` gives the update pill and restart button the same base height, padding, font size, border radius, and inline-flex alignment.
  - `public/app.js` adds the confirmed manual restart flow and reloads the page after the backend schedules the restart.
  - `restart-codex-mobile-shared-chain.ps1` now logs to `%USERPROFILE%\.codex-mobile-web\shared-chain-restart.log` instead of the old scheduled-task log name.
  - PWA shell build/cache bumped to `codex-mobile-shell-v59`.
- Documentation:
  - `README.md` documents the manual restart button, `POST /api/restart/shared-chain`, exact restart scope, and log file.
  - `.agent-context/PROJECT_CONTEXT.md` now records that the daily scheduled restart task has been removed and manual restart is the active flow.
- Validation:
  - `npm.cmd test` passed: 78/78.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
- Activation:
  - Restarted only the 8787 Node listener to load the new backend route and v59 static assets; old PID `16580`, new PID `1344`.
  - `GET http://127.0.0.1:8787/api/public-config` now returns `clientBuildId: 0.1.8|codex-mobile-shell-v59` and `shellCacheName: codex-mobile-shell-v59`.

## 2026-05-16 Web Push SubAgent Completion Filter Tightening

- User report:
  - iOS notification center still showed many Sub Agent completion Web Push notifications after the earlier spawn-edge filter.
  - Screenshot examples used UUID-like notification titles such as `019e2df9...`, which indicates the Push path was sending completions without a resolved durable thread title/thread id.
- Diagnosis:
  - Local `state_5.sqlite` confirmed at least one recent `019e2df9-d85a-...` thread has `agent_nickname=Sagan`, `agent_role=explorer`, and a `thread_spawn_edges` child row.
  - Current Mobile Web had only one active `codex-mobile-web\server.js` listener, so this was not caused by an old duplicate Node process.
  - The remaining leak path was the Web Push decision rule allowing turns with no resolved `threadId`; those can bypass the SQLite child-thread lookup and produce UUID-title Push notifications.
- Code changes:
  - `adapters/push-notification-service.js` now fails closed for completion decisions when no `threadId` is available, returning `missing-thread-id`.
  - `turn/started` still allows a temporary `pending-thread-id` observation so a later `turn/completed` can notify if that completion event resolves a real non-SubAgent thread id.
  - `server.js` now passes `allowMissingThreadId: true` only for `turn/started`, not for `turn/completed`.
  - `server.js` expands `pushThreadId()` to parse more nested thread id/session id variants and rollout paths before deciding the id is missing.
  - Added compact `[web push]` decision logs for skipped/pending cases with only short turn/thread identifiers.
  - `test/push-notification-service.test.js` covers missing-thread-id suppression and pending started events.
- Validation:
  - Targeted `node --test test\push-notification-service.test.js test\manual-restart-ui.test.js` passed.
  - `npm.cmd test` passed: 80/80.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
- Activation:
  - Restarted the 8787 Node listener to load the new server-side Push filter; old PID `1344`, new PID `14904`.
  - `GET http://127.0.0.1:8787/api/public-config` still returns `clientBuildId: 0.1.8|codex-mobile-shell-v59`.

## 2026-05-16 Web Push Main-Thread Classification And 0.1.9

- User follow-up:
  - Sub Agent completion Web Push notifications were still observed after the missing-thread-id suppression.
  - Recent iOS notifications still showed UUID-like titles for completed Sub Agent turns.
- Additional hardening:
  - `adapters/push-notification-service.js` now requires completion notifications to classify as a known main thread before sending.
  - Sub Agent / child / agent classifications are skipped as `subagent-thread`.
  - Unknown thread ids are skipped as `unknown-thread`.
  - Thread-classification lookup failures are skipped as `thread-lookup-failed`.
  - Missing thread ids remain skipped for `turn/completed`; `turn/started` can still keep temporary pending state only until a later completion resolves a real known main thread.
  - `server.js` now uses `classifyWebPushThreadId()` for Push decisions. It reads `state_5.sqlite` through `adapters/sqlite-cli.js`, checks `thread_spawn_edges`, `threads.agent_nickname`, and `threads.agent_role`, and caches main/subagent/unknown classifications with short TTL for unknowns.
- Version/cache:
  - Private package version bumped to `0.1.9`.
  - PWA shell cache/build id bumped to `codex-mobile-shell-v60` / `0.1.9|codex-mobile-shell-v60`.
- Validation:
  - `npm.cmd test` passed: 81/81.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
- Activation:
  - Restarted the 8787 Node listener to load the final Push classifier and v60 static assets; old PID `14904`, new PID `43816`.
  - `GET http://127.0.0.1:8787/api/public-config` returns `version: 0.1.9`, `clientBuildId: 0.1.9|codex-mobile-shell-v60`, and `shellCacheName: codex-mobile-shell-v60`.
- Public release:
  - User explicitly requested update and push including public.
  - Synced product files, adapters, restart script, tests, and README notes to `C:\Users\xuxin\Documents\codex-mobile-web-public`.
  - Public README uses a public-safe manual restart description that avoids naming unrelated local private services while preserving the restart scope.
  - Public validation passed: `npm.cmd test` 81/81, `npm.cmd run check`, `npm.cmd run check:macos`, `git diff --check`, `git diff --cached --check`, and staged diff privacy scan.
  - Public pushed commit: `6aea3ab 发布移动端重启入口与 Sub Agent 推送过滤修正`.

## 2026-05-17 iOS/iPad Portrait Half-Height Viewport Fix

- User report:
  - iPhone screenshot showed the active conversation/composer occupying only the upper half of the screen, with a large blank area below.
  - The same "only half" layout also occurred on iPad portrait and had appeared several times.
- Diagnosis:
  - Existing `viewportState()` treated `visualViewport.height + offsetTop < layout - 120` as a keyboard shrink signal by itself.
  - On iOS/PWA, `visualViewport` can remain or report a stale half-height value after the keyboard is no longer active. That made `updateViewportVars()` keep writing a small pixel `--app-height`, pinning the app grid to the upper half of the screen.
- Code changes:
  - Added `public/viewport-metrics.js` as a small testable frontend module.
  - `viewport-metrics.measureViewport()` only allows the shrunk visual viewport to override app height when an editable input, textarea, or contenteditable element owns the keyboard.
  - Without an active text input, stale half-height `visualViewport` values now fall back to the full layout viewport.
  - `public/app.js` delegates viewport calculation to `window.CodexViewportMetrics`.
  - `public/index.html`, `public/sw.js`, and page refresh shell assets now include `/viewport-metrics.js`.
  - `server.js` app-shell build hashing now includes the frontend support modules, including `viewport-metrics.js`.
  - PWA shell build/cache bumped to `codex-mobile-shell-v61` / `0.1.9|codex-mobile-shell-v61`.
- Validation:
  - `node --test test\viewport-metrics.test.js test\mobile-viewport.test.js` passed.
  - `npm.cmd test` passed: 85/85.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
- Runtime:
  - `GET http://127.0.0.1:8787/api/public-config` returns `clientBuildId: 0.1.9|codex-mobile-shell-v61` and `shellCacheName: codex-mobile-shell-v61`, so existing clients should receive the page refresh prompt and fetch the new shell assets.
- Status:
  - User requested commit/push including public on 2026-05-18.
  - Public README gained a Chinese `2026-05-18 Public 发布说明` section describing the iOS/iPad portrait half-height fix, viewport-metrics module, app-shell cache `v61`, and PWA refresh/reopen requirement.
  - Public validation passed: `npm.cmd test` 85/85, `npm.cmd run check`, `npm.cmd run check:macos`, `git diff --check`, `git diff --cached --check`, and staged diff privacy scan.
  - Public pushed commit: `82346f7 修正 iOS 与 iPad 竖屏半屏显示问题`.
  - Private pushed commit: `c2339f1 修正 iOS 与 iPad 竖屏半屏显示问题`.

## 2026-05-18 Send Submit Bottom Follow Fix

- User report:
  - After typing and tapping Send, the conversation often landed in the middle of the session instead of staying near the bottom.
  - The user then had to tap the floating down-arrow to return to the newest content.
- Diagnosis:
  - Existing render logic only auto-stuck when `isConversationNearBottom()` was true or a caller explicitly passed `stickToBottom`.
  - Sending a message did not create an explicit bottom-follow state. If keyboard close, composer height changes, or a refresh made the near-bottom check false, the next render preserved the middle scroll position.
- Code changes:
  - Added `public/conversation-scroll.js` as a small testable frontend module for near-bottom metrics and submitted-message follow state.
  - `public/app.js` now enters a same-thread `submittedMessageBottomFollow` window after a current-thread send is submitted.
  - While the follow window is active, renders and delayed layout passes scroll the conversation to bottom so the new user message / turn start / first output stays visible.
  - A real user touch/pointer/wheel scroll in the conversation clears the follow state immediately, preserving manual live-output scroll hold.
  - Page refresh shell assets, `index.html`, service worker cache, and server app-shell build hash now include `/conversation-scroll.js`.
  - PWA shell build/cache bumped to `codex-mobile-shell-v62` / `0.1.9|codex-mobile-shell-v62`.
- Validation:
  - Targeted `node --test test\conversation-scroll.test.js test\turn-scroll-controls.test.js test\mobile-viewport.test.js test\app-update.test.js` passed.
  - `npm.cmd test` passed: 89/89.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - `GET http://127.0.0.1:8787/api/public-config` returns `clientBuildId: 0.1.9|codex-mobile-shell-v62` and `shellCacheName: codex-mobile-shell-v62`.
- Status:
  - Private workspace has local uncommitted changes for this fix.
  - Public repository has not been synced for this fix yet.

## 2026-05-19 Orientation Return Bottom Follow Fix

- User report:
  - After rotating to landscape and then back, the current conversation could remain away from the bottom even when the user had been reading the newest turn.
- Local fix:
  - Extended `public/conversation-scroll.js` with testable viewport-follow state:
    - viewport follow starts only when the current conversation is at the bottom or was at the bottom very recently;
    - follow state is scoped to the current thread and expires quickly.
  - `public/app.js` now records recent near-bottom state by thread and uses the same bottom-follow scheduler for submitted-message follow and orientation/resize/visualViewport follow.
  - `orientationchange`, `resize`, `visualViewport.resize`, and `visualViewport.scroll` now schedule short delayed bottom scrolls while the follow state is valid.
  - User touch/pointer/wheel scroll cancels both submitted-message and viewport bottom-follow states immediately.
  - Tapping the up-arrow reply jump also cancels viewport bottom-follow so intentional navigation is not pulled back down.
  - PWA shell build/cache bumped to `codex-mobile-shell-v63` / `0.1.9|codex-mobile-shell-v63`.
- Validation:
  - Targeted `node --test test\conversation-scroll.test.js test\turn-scroll-controls.test.js test\mobile-viewport.test.js test\app-update.test.js` passed.
  - `npm.cmd test` passed: 92/92.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - `GET http://127.0.0.1:8787/api/public-config` returns `clientBuildId: 0.1.9|codex-mobile-shell-v63` and `shellCacheName: codex-mobile-shell-v63`.
- Status:
  - Public repository was synced and pushed on 2026-05-19.
  - Public pushed commit: `b541fef 修正移动端发送与旋转后的底部滚动保持`.
  - Public README includes a Chinese `2026-05-19 Public 发布说明` covering the send-after-submit bottom follow, landscape-to-portrait bottom follow, user-scroll cancellation behavior, `conversation-scroll.js`, and PWA shell cache `v63`.
  - Public validation passed before push: `npm.cmd test` 92/92, `npm.cmd run check`, `npm.cmd run check:macos`, `git diff --check`, `node --check public/app.js`, and staged diff privacy scan.
  - Private workspace still needs the local commit/push that includes this handoff update.
