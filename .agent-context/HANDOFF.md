# HANDOFF

Last compacted: 2026-05-23T15:02:21.309Z

This active handoff was automatically compacted before a Codex Mobile continuation.
The previous full handoff was archived and should be opened only when old provenance is explicitly needed.

## Compaction Summary

- Workspace: `C:\Users\xuxin\Documents\codex-mobile-web`
- Original active handoff bytes: `318288`
- Archived full handoff: `C:\Users\xuxin\Documents\codex-mobile-web\.agent-context\archive\context-compaction-20260523_150221\HANDOFF.full.md`
- Preserved recent active context chars: `58562`

## Startup Guidance

- Read `.agent-context/PROJECT_CONTEXT.md` first.
- Read this compact `.agent-context/HANDOFF.md` for current status.
- Do not load the archived full handoff unless the user asks for old provenance or the compact handoff is insufficient.
- Keep future handoff updates concise: current state, changed files, validation, risks, and next steps.
- Do not store raw secrets, tokens, one-time approvals, hidden UI state, long logs, or bulky generated output.

## Preserved Recent Handoff Tail

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
  - Private repository was pushed after the public release.
  - Private product commit: `3481e7a 修正移动端发送与旋转后的底部滚动保持`.

## 2026-05-23 Top-Right Turn Timer Regression Fix

- User report:
  - After today's Mobile Web changes, the top-right turn status/timer box sometimes disappeared. This was a functional regression from the previous behavior.
- Current state observed before the fix:
  - Disk worktree had returned to clean `HEAD=98cb19e`, with `public/app.js` / `public/sw.js` at `codex-mobile-shell-v63`.
  - The running 8787 listener PID was `26160`; `/api/public-config` initially matched `0.1.9|codex-mobile-shell-v63`.
- Diagnosis:
  - `#turnTimer` was hidden whenever `currentLiveTurn()` returned null and the latest turn had no final duration.
  - The live-turn predicate depended too narrowly on explicit running/active status in the turn snapshot.
  - During optimistic send, refresh, replay, or incomplete app-server snapshots, the browser can know `state.activeTurnId` before the matching turn has a fully normalized running status. That made the top-right status box disappear even though the turn was still the active one.
  - Completed notifications can also arrive without `durationMs` / `completedAt`; the old `turnFinalSeconds()` then returned null and hid the settled timer.
- Local fix:
  - `public/app.js`
    - `syncActiveTurnFromThread()` now preserves the current `activeTurnId` when the matching turn exists and is not complete, even if its status field is not yet normalized.
    - `isLiveTurn()` treats the current active incomplete turn as live.
    - `isTurnComplete()` recognizes `completedAtMs` and zero-valued `durationMs`, and does not treat incomplete `interrupted` turns as complete.
    - `turnFinalSeconds()` now derives final seconds from `completedAtMs` / parsed timestamps and falls back to the current activity time for completed snapshots without duration fields.
    - `turn/completed` handling stamps `completedAtMs` when the event lacks explicit completion timing.
  - Added `test/turn-timer.test.js` covering optimistic active-turn visibility and completion-without-duration settled timer behavior.
  - PWA shell cache/build id bumped to `codex-mobile-shell-v68` / `0.1.9|codex-mobile-shell-v68`.
- Validation:
  - `node --check public\app.js` passed.
  - `node --test test\turn-timer.test.js test\mobile-viewport.test.js` passed: 5/5.
  - `npm.cmd test` passed: 94/94.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - Edited source/test files were checked for UTF-8 BOM; first bytes were `34 117 115`, no BOM.
  - Running 8787 `/api/public-config` now returns `clientBuildId: 0.1.9|codex-mobile-shell-v68` and `shellCacheName: codex-mobile-shell-v68`.
- Status:
  - Private workspace has local uncommitted changes for this fix.
  - Public repository has not been synced or pushed for this fix.
  - After the browser accepted the v68 page refresh prompt, the user reported that the Hermes thread's top-right status box appeared again.
  - Therefore this specific symptom should not be treated first as requiring rollout compression. Consider rollout continuation separately only if the thread is over threshold or detail reads keep falling back because the rollout is too large.

## 2026-05-23 Current-Turn Steering Regression Fix

- User report:
  - After today's Mobile Web changes, active-turn guidance / "引导" sometimes behaved as if the agent did not see it.
  - A live test message in this thread did arrive, so the transport was not globally broken; the suspect path was inconsistent steering classification after refresh.
- Diagnosis:
  - `server.js` already routes existing-thread messages through `turn/steer` whenever the request body includes `activeTurnId`.
  - If the refreshed browser misses or loses the live `turn/started` SSE state, `state.activeTurnId` can be empty even while the current thread snapshot still shows an incomplete latest running turn.
  - Before this fix, the composer button state and submit path looked only at `state.activeTurnId`, so a typed guidance message could be submitted without `activeTurnId` and fall back to `turn/start`.
- Local fix:
  - `public/app.js` now derives a `currentSteerableTurnId()` from `currentLiveTurn()`.
  - `isLiveTurn()` treats the latest incomplete turn as live when the thread summary/status is running, and still preserves explicit `activeTurnId` and incomplete `interrupted` turns.
  - `syncActiveTurnFromThread()`, composer button mode, current-thread send, and Stop/interrupt now all use the same derived steerable turn id.
  - When a send is classified as steering, the frontend stamps `state.activeTurnId = steerTurnId` before feedback/render updates so the UI stays coherent.
  - PWA shell cache/build id bumped to `codex-mobile-shell-v69` / `0.1.9|codex-mobile-shell-v69`.
  - Added `test/steering-active-turn.test.js` covering refresh-derived steering and interrupt targeting.
- Validation:
  - `node --check public\app.js` passed.
  - Targeted `node --test test\steering-active-turn.test.js test\turn-timer.test.js test\mobile-viewport.test.js` passed: 7/7.
  - `npm.cmd test` passed: 96/96.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - Edited source/test files were checked for UTF-8 BOM; first bytes were `34 117 115`, no BOM.
  - Running 8787 `/api/public-config` returns `clientBuildId: 0.1.9|codex-mobile-shell-v69` and `shellCacheName: codex-mobile-shell-v69`.
- Status:
  - Private workspace has local uncommitted changes for v68 timer fix plus this v69 steering fix.
  - Public repository has not been synced, committed, or pushed for this fix.

## 2026-05-23 Hermes-Codex Mux Worker Runtime Restore

- User report:
  - After a restart, Hermes Mobile could no longer receive Codex-side messages/updates through the Codex Mobile service chain.
- Diagnosis:
  - Codex Mobile 8787 was healthy: `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, mux endpoint `127.0.0.1:56410`, and `lastError=null`.
  - Hermes Mobile 8797 and bridge host 8798 were listening; `GET http://127.0.0.1:8797/api/public-config` returned 200.
  - Hermes Mux API was healthy with owner auth: `GET /api/codex-mux/tasks?assignedWorker=codex-hermes-main&status=open,running` returned 4 tasks.
  - The Codex-Hermes polling worker was the broken link:
    - `hermes-codex-mux-worker-auth.out.log` stopped at `2026-05-23T08:21Z`.
    - No real `codex-hermes-mux-worker.js` worker process was running.
    - The earlier rollback had removed the worker files and `npm.cmd run mux:worker` script from the current repo.
- Local restore:
  - Restored `adapters/hermes-codex-mux-worker-service.js`.
  - Restored `scripts/codex-hermes-mux-worker.js`.
  - Added `test/hermes-codex-mux-worker-service.test.js`.
  - Updated `package.json` with `mux:worker` and syntax-check coverage for the worker service/CLI.
  - Updated `.agent-context/PROJECT_CONTEXT.md` with durable worker runbook facts.
- Runtime recovery:
  - A real one-shot smoke poll succeeded:
    - `npm.cmd run mux:worker -- --once --base-url http://127.0.0.1:8797`
    - output reported `workerId=codex-hermes-main`, `tasks=4`.
  - Started a hidden continuous polling worker using:
    - `CODEX_HERMES_MUX_AUTH_HEADER_NAME=x-hermes-web-key`
    - `CODEX_HERMES_MUX_AUTH_VALUE_FILE=C:\ProgramData\HermesMobile\data\secrets\owner-web-key.secret`
    - base URL `http://127.0.0.1:8797`, poll interval 5000ms.
  - Running worker process:
    - `node.exe` PID `55300`
    - command `node scripts/codex-hermes-mux-worker.js --base-url http://127.0.0.1:8797 --poll-ms 5000`
  - Logs:
    - `%USERPROFILE%\.codex-mobile-web\hermes-codex-mux-worker-restored.out.log`
    - `%USERPROFILE%\.codex-mobile-web\hermes-codex-mux-worker-restored.err.log`
  - Hermes task heartbeat now reports:
    - `workerId=codex-hermes-main`
    - `observedAt=2026-05-23T11:56:25Z` or newer
    - `pid=55300`
    - `mode=polling`
- Validation:
  - `node --check adapters\hermes-codex-mux-worker-service.js` passed.
  - `node --check scripts\codex-hermes-mux-worker.js` passed.
  - `node --test test\hermes-codex-mux-worker-service.test.js` passed: 3/3.
  - `npm.cmd test` passed: 99/99.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - Edited source/test files were checked for UTF-8 BOM; no BOM.
- Status:
  - Immediate runtime bridge is restored.
  - Private workspace has local uncommitted changes for v68/v69 frontend fixes plus the restored Hermes-Codex worker.
  - Public repository has not been synced, committed, or pushed.
  - Existing 4 Hermes Mux tasks are already in `worker.blocked.context_conflict` state from 2026-05-22; the restored worker will heartbeat and handle new/open tasks, but those old blocked task states should be reviewed separately if the user expects them to continue.

## 2026-05-23 Mux Endpoint Drift Hotfix After Hermes Thread Stall

- User report:
  - Current Codex Mobile thread was normal, but the new `Hermes 05-23` continuation thread produced one sentence and then stopped showing updates mid-work.
  - The source thread had already been compressed/continued, and the new rollout was small, so this was not a large-rollout detail-load problem.
- Runtime evidence:
  - `Hermes 05-23` thread id: `019e54b8-7064-7763-9a37-f23c26a6bb32`.
  - Rollout size was about `593578` bytes and not over threshold.
  - Thread detail latest turn was `interrupted` with only 4 visible items, so no more output was expected from that turn after the runtime split.
  - Before repair, Mobile Web `/api/status` reported its live external mux endpoint as port `64172`, while `%USERPROFILE%\.codex\app-server-mux\endpoint.json` pointed at port `52203`.
  - Old mux ports `64172`, `56410`, and `53371` were still listening, so the stale Mobile Web connection looked healthy while current Desktop/current app-server traffic had moved to `52203`.
- Immediate repair:
  - Called authenticated `POST /api/app-server/reconnect`.
  - After reconnect, `/api/status` and endpoint file both reported `127.0.0.1:52203`, `ready=true`, `lastError=null`.
- Code hotfix:
  - `server.js` now exports and uses `sameExternalEndpoint()`.
  - `CodexAppServerClient.ensure()` resolves the current shared endpoint before reusing an open transport. If the endpoint file changed while the old TCP socket is still open, it logs the drift, closes the stale socket, and reconnects to the current mux.
  - Added `test/protocol.test.js` coverage for same/different JSONL TCP and WebSocket endpoints.
  - Updated `.agent-context/PROJECT_CONTEXT.md` with the durable endpoint-drift rule.
- Activation:
  - Restarted only the 8787 Node listener to load the `server.js` fix.
  - Old 8787 PID `46628`; new 8787 PID `35164`.
  - Did not restart the shared mux/app-server chain.
  - Post-restart `/api/status` reports endpoint port `52203`, matching endpoint file; `lastError=null`.
  - Restored Hermes-Codex worker PID `55300` continued polling after the 8787 restart.
- Validation:
  - `node --check server.js` passed.
  - Targeted `node --test test\protocol.test.js` passed: 9/9.
  - `npm.cmd test` passed: 100/100.
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
- Status:
  - Runtime split is repaired for future requests.
  - The already interrupted `Hermes 05-23` turn will not resume by itself; after refresh/reopen, the user should send the next instruction in that thread to continue on the now-correct mux.

## 2026-05-23 Interrupted Turn Steering Fix

- User follow-up:
  - After reconnecting the app-server stream, the `Hermes 05-23` thread still did not reply when the user tried to continue it.
- Diagnosis:
  - Service-chain state was healthy: 8787 `/api/status` and `%USERPROFILE%\.codex\app-server-mux\endpoint.json` both pointed at the same mux port, and the Hermes-Codex worker was still polling.
  - The `Hermes 05-23` latest turn was already `interrupted`, with no new turn created after reconnect.
  - The v69 frontend treated any `interrupted` turn without completion/duration fields as a live/steerable turn. That meant an old interrupted turn could keep the composer in steer/guide mode and route new text to `turn/steer` instead of starting a fresh turn.
- Local fix:
  - `public/app.js` now treats a turn as live only when it is the explicit `state.activeTurnId`, the latest turn in a running thread, or has a running status.
  - Bare stale `interrupted` turns are no longer steerable and no longer display as `syncing` unless they are actually live.
  - PWA shell build/cache bumped to `codex-mobile-shell-v70` / `0.1.9|codex-mobile-shell-v70`.
  - `test/steering-active-turn.test.js` covers the stale-interrupted-turn guard.
- Validation:
  - `node --check public\app.js` passed.
  - Targeted `node --test test\steering-active-turn.test.js test\turn-timer.test.js test\mobile-viewport.test.js` passed: 8/8.
  - `npm.cmd test` passed: 101/101.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
- Status:
  - `/api/public-config` returns `clientBuildId: 0.1.9|codex-mobile-shell-v70` and `shellCacheName: codex-mobile-shell-v70`.
  - This is a frontend/static-asset fix; the user must accept the page refresh prompt or hard refresh the PWA before retrying the `Hermes 05-23` thread.

## 2026-05-23 Guide Button Delayed Click Interrupt Fix

- User follow-up:
  - The `Hermes 05-23` thread could receive a new message stream again, but tapping `引导` could still cause the running turn to pause/interrupt.
- Evidence:
  - `Hermes 05-23` latest turn after the report was `interrupted`, while service-chain state remained healthy.
  - The composer submit button had both `pointerup` and `click` listeners. On iOS/PWA, a delayed `click` from the same physical tap can arrive after the `pointerup` path has already sent the guide message and cleared the composer. At that point the same button can be in empty-input `Stop` mode and call the interrupt path.
- Local fix:
  - `public/app.js` now records `lastSendButtonPointerUpAt`.
  - A `click` within 2500 ms after a send-button `pointerup` is suppressed.
  - General send-button debounce was raised from 650 ms to 1200 ms.
  - PWA shell build/cache bumped to `codex-mobile-shell-v71` / `0.1.9|codex-mobile-shell-v71`.
  - `test/steering-active-turn.test.js` covers the delayed-click suppression.
- Validation:
  - `node --check public\app.js` passed.
  - Targeted `node --test test\steering-active-turn.test.js test\turn-timer.test.js test\mobile-viewport.test.js` passed: 9/9.
  - `npm.cmd test` passed: 102/102.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - Edited source/test files have no UTF-8 BOM.
- Status:
  - `/api/public-config` returns `clientBuildId: 0.1.9|codex-mobile-shell-v71` and `shellCacheName: codex-mobile-shell-v71`.
  - This is a frontend/static-asset fix; no 8787 listener restart is needed, but mobile clients must refresh to v71.

## 2026-05-23 Recoverable Guide Message Echo

- User follow-up:
  - During a running turn, tapping `引导` no longer interrupted the turn, but the guide text disappeared after exiting the app and reopening the thread.
  - Before exit, the guide text was visible; after re-entering, the thread detail did not show that guide text, and the Agent did not visibly respond to it.
- Evidence:
  - `Hermes 05-23` thread detail showed recent durable turns with only app-server `userMessage` items; the just-sent guide text was absent after reload.
  - The frontend merge path only preserved `mux-user-*` synthetic user messages, not `local-user-*`.
  - The current-thread send path did not record a local recoverable echo after successful `turn/steer` / existing-thread submission.
- Local fix:
  - `public/app.js` adds `codexMobileSubmittedUserMessages` localStorage recovery for recent submitted user messages.
  - Current-thread sends and steering submissions now create a `local-user-*` item after the POST succeeds, record it with thread/turn id, and upsert it into the visible turn.
  - Thread detail load/refresh applies recent submitted-user records back into the thread before rendering.
  - Synthetic user-message matching now covers both `mux-user-*` and `local-user-*`; when a real matching `userMessage` later appears, the synthetic echo is shadowed.
  - Records are TTL-limited to 30 minutes and capped at 80 entries.
  - PWA shell build/cache bumped to `codex-mobile-shell-v72` / `0.1.9|codex-mobile-shell-v72`.
  - `test/steering-active-turn.test.js` covers recoverable local guide echoes.
- Validation:
  - `node --check public\app.js` passed.
  - Targeted `node --test test\steering-active-turn.test.js test\turn-timer.test.js test\mobile-viewport.test.js test\draft-store.test.js` passed: 15/15.
  - `npm.cmd test` passed: 103/103.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - Edited source/test files have no UTF-8 BOM.
- Status:
  - `/api/public-config` returns `clientBuildId: 0.1.9|codex-mobile-shell-v72` and `shellCacheName: codex-mobile-shell-v72`.
  - This preserves newly submitted guide text across app reloads after the client has refreshed to v72. It cannot reconstruct guide text that was submitted before v72 because that text was never stored in local recovery state.

## 2026-05-23 Guide Echo Ordering Fix

- User follow-up:
  - v72 made guide text visible after re-entering the conversation, but it appeared above the newer conversation content, requiring scrolling upward and breaking information-flow order.
- Cause:
  - `applySubmittedUserMessagesToThread()` merged the local guide echo as the existing item list and the durable turn items as incoming items, which placed the recovered `local-user-*` message at the top of the turn.
- Local fix:
  - Reversed the merge direction for recovered submitted-user records:
    - existing durable `turn.items` stay first;
    - recovered `local-user-*` guide echo appends after them unless shadowed by a real matching `userMessage`.
  - PWA shell build/cache bumped to `codex-mobile-shell-v73` / `0.1.9|codex-mobile-shell-v73`.
  - `test/steering-active-turn.test.js` asserts the append-order merge.
- Validation:
  - `node --check public\app.js` passed.
  - Targeted `node --test test\steering-active-turn.test.js test\mobile-viewport.test.js` passed: 8/8.
  - `npm.cmd test` passed: 103/103.
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
- Status:
  - `/api/public-config` returns `clientBuildId: 0.1.9|codex-mobile-shell-v73` and `shellCacheName: codex-mobile-shell-v73`.
  - Static frontend fix only; mobile clients must refresh to v73.

## 2026-05-23 Reverted Private Product Code To Public v63

- User decision:
  - Stop iterating on the guide/steer fixes and directly overwrite private product code with the current public repository version.
- Source used:
  - Public repo path: `C:\Users\xuxin\Documents\codex-mobile-web-public`.
  - `git pull --ff-only` reported already up to date.
  - Public HEAD: `b541fef 修正移动端发送与旋转后的底部滚动保持`.
- Sync performed:
  - Copied all public tracked files from public repo into private repo.
  - Preserved private `.agent-context` and runtime files.
  - Removed the local untracked files introduced during the abandoned guide/worker work:
    - `adapters\hermes-codex-mux-worker-service.js`
    - `scripts\codex-hermes-mux-worker.js`
    - `test\hermes-codex-mux-worker-service.test.js`
    - `test\steering-active-turn.test.js`
    - `test\turn-timer.test.js`
- Resulting frontend:
  - `public/app.js` is back to `CLIENT_BUILD_ID = "0.1.9|codex-mobile-shell-v63"`.
  - `public/sw.js` is back to `codex-mobile-shell-v63`.
  - The abandoned local additions are absent:
    - no `composerGoal`;
    - no `codexMobileSubmittedUserMessages`;
    - no `lastSendButtonPointerUpAt`;
    - no `currentSteerableTurnId`;
    - no v70/v71/v72/v73 cache strings.
- Validation:
  - `npm.cmd test` passed: 92/92.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `/api/public-config` returns `clientBuildId: 0.1.9|codex-mobile-shell-v63` and `shellCacheName: codex-mobile-shell-v63`.
- Status:
  - No commit or push was performed.
  - `git status --short` still shows line-ending touched files after the cross-repo copy, but `git diff --name-status` shows real content diffs only in `.agent-context/HANDOFF.md`, `.agent-context/PROJECT_CONTEXT.md`, `README.md`, and `public/app.js`.
  - The `README.md` / `public/app.js` real product diff is the public-safe restart wording replacing the private wording that named Hermes/Gateway.

## 2026-05-23 Restarted 8787 After Public v63 Revert

- User request:
  - Restart the server after reverting private product files to the public version.
- Action:
  - Restarted only the Codex Mobile Web 8787 Node listener by stopping old PID `35164`.
  - The existing hidden/windowless supervisor restarted it as PID `18744`.
  - Did not intentionally restart Hermes Mobile, Gateway, WSL, Codex Desktop, or the full shared chain.
- Verification:
  - `GET http://127.0.0.1:8787/api/public-config` returns `clientBuildId: 0.1.9|codex-mobile-shell-v63` and `shellCacheName: codex-mobile-shell-v63`.
  - Authenticated `/api/status` returns `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, and `lastError=null`.
  - New listener command line is `node.exe C:\Users\xuxin\Documents\codex-mobile-web\server.js`.

## 2026-05-23 Manual Reconnect After Public v63 Restart

- User report:
  - After restarting the 8787 server on the reverted public v63 code, replies were not visible again.
- Diagnosis:
  - `/api/status` reported Mobile Web connected to mux port `63967`.
  - `%USERPROFILE%\.codex\app-server-mux\endpoint.json` pointed to mux port `53683`.
  - This reproduced the endpoint drift problem. The public v63 code does not include the later automatic endpoint-drift protection that had been reverted.
- Immediate repair:
  - Called authenticated `POST /api/app-server/reconnect`.
  - After reconnect, `/api/status` and endpoint file both report mux port `53683`, `ready=true`, and `lastError=null`.
- Status:
  - Replies should be visible again after the browser reconnects/refreshes.
  - Because the code is back to public v63, future mux endpoint changes can still require manual `/api/app-server/reconnect` unless the endpoint-drift hotfix is reintroduced.

## 2026-05-23 Repeated Endpoint Drift Caused User-Only Completed Turns

- User report:
  - After another message, the turn ended instantly, but no reply content was visible.
- Evidence:
  - `/api/status` showed Mobile Web connected to mux port `62862`.
  - `%USERPROFILE%\.codex\app-server-mux\endpoint.json` had already moved to mux port `63008`.
  - `Hermes 05-23` detail showed the latest turns as `completed` with only `userMessage` items and no `agentMessage` items.
  - Thread status was `systemError`.
- Immediate repair:
  - Called authenticated `POST /api/app-server/reconnect`.
  - After reconnect, `/api/status` and endpoint file both report mux port `63008`, `ready=true`, `lastError=null`.
- Status:
  - The no-output user-only turns already created in the stale stream will not generate replies retroactively.
  - The user needs to send again after reconnect.
  - Because public v63 lacks automatic endpoint-drift detection, this can recur while the endpoint file keeps changing.

## 2026-05-23 Shared Endpoint Rebuilt After Dead Endpoint File

- User report:
  - Codex Mobile could not connect and showed an app-server endpoint-not-found/unavailable condition after restarts and mux/app-server cleanup.
- Runtime evidence:
  - `%USERPROFILE%\.codex\app-server-mux\endpoint.json` existed but pointed to port `56740`, mux PID `52280`, and child app-server PID `67392`.
  - Those PIDs were no longer running, and port `56740` was not listening.
  - The 8787 Node listener was still running as PID `18744`, but authenticated status failed with `shared app-server endpoint unavailable (connect ECONNREFUSED 127.0.0.1:56740)`.
- Recovery:
  - Ran the controlled shared-chain restart script:
    - `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\restart-codex-mobile-shared-chain.ps1 -MaxWaitSeconds 60`
  - The script stopped only the Codex Mobile Web shared chain, removed the stale endpoint file, started the `Codex Mobile Web` scheduled task, and reported ready.
- Verified current state:
  - Endpoint file now points to port `53146`, mux PID `60184`, child app-server PID `9428`.
  - Both endpoint processes exist and the endpoint port is listening.
  - 8787 listener is PID `55796`.
  - Authenticated `/api/status` returns `ready=true`, `transport=external-jsonl-tcp`, endpoint port `53146`, and `lastError=null`.
  - `/api/public-config` remains public v63: `clientBuildId: 0.1.9|codex-mobile-shell-v63`, `shellCacheName: codex-mobile-shell-v63`.
- Assessment:
  - The immediate failure was a stale/dead endpoint file, not a frontend failure.
  - There is not enough evidence to attribute this directly to a new Codex CLI bug. The runtime Codex executable reports `codex-cli 0.129.0-alpha.15`, and a fresh mux/app-server started by the same executable is currently healthy.
  - The observed endpoint churn is consistent with repeated Mobile Web/shared-chain restarts, manual reconnects, public v63 rollback removing the private endpoint-drift hotfix, and prior cleanup of extra mux/app-server processes.

## 2026-05-23 Hermes Continuation Handoff-Late Recovery

- User report:
  - The Hermes Mobile continuation job had stayed for a long time at "源线程仍在写交接文件，继续后台等待".
- Diagnosis:
  - Active continuation job id: `36ef1180-35f4-432a-b548-5097f6df02c6`.
  - Source thread id: `019e54b8-7064-7763-9a37-f23c26a6bb32`.
  - Source workspace: `C:\Users\xuxin\Documents\Agent`.
  - Expected handoff target:
    - `C:\Users\xuxin\Documents\Agent\.agent-context\thread-handoffs\2026-05-23T14-16-53-086Z-019e54b8-7064-7763-9a37-f23c26a6bb32-1772db71.md`
  - The source rollout showed the handoff-generation turn completed at `2026-05-23T14:17:03Z` with `last_agent_message:null`, and no handoff file was created.
  - The source thread was already in the same context-saturation/no-output failure mode: later turns showed `token_count total=258400`, `lastInput=0`, `lastOutput=0`, and `task_complete last_agent_message:null`.
- Recovery:
  - Wrote a manual runtime handoff file at the expected target path using the compacted Agent workspace context.
  - The continuation job immediately advanced from `handoff-late` to `archive-source` and then `done`.
  - New continuation thread id: `019e553a-fdda-7fc2-8913-cccbcdd0368a`.
  - New continuation rollout:
    - `C:\Users\xuxin\.codex\sessions\2026\05\23\rollout-2026-05-23T22-26-29-019e553a-fdda-7fc2-8913-cccbcdd0368a.jsonl`
  - Source thread was archived by the continuation job.
- Notes:
  - This was not a normal slow handoff write. The source thread had already failed to produce any assistant output, so waiting longer would not have produced the file.
  - The manual handoff file is under `.agent-context/thread-handoffs/` and remains runtime continuation context, not product code.

## 2026-05-23 Automatic Workspace Handoff Compaction For Continuation

- User request:
  - Add real handoff compaction to the Codex Mobile rollout continuation flow so a workspace's long-lived `.agent-context/HANDOFF.md` does not keep growing and poisoning future continuation context.
- Code changes:
  - Added `adapters/continuation-handoff-compaction-service.js`.
    - If `.agent-context/HANDOFF.md` exceeds `CODEX_MOBILE_CONTINUATION_CONTEXT_HANDOFF_COMPACT_BYTES` (default `300KB`), it copies the full original to `.agent-context/archive/context-compaction-<timestamp>/HANDOFF.full.md`.
    - It rewrites the active handoff to a compact file containing the archive path, startup guidance, and a recent Markdown-section tail.
    - Recent preservation size is controlled by `CODEX_MOBILE_CONTINUATION_CONTEXT_HANDOFF_PRESERVE_CHARS` (default `60000`).
  - `server.js` now calls this service at the start of `startThreadFromRequestBody()` after workspace visibility validation and before source snapshot / source handoff generation.
  - Continuation job public status now exposes `contextCompaction` so the UI/API can show whether compaction happened and where the archive is.
  - `package.json` check script now syntax-checks the new service.
  - Added `test/continuation-handoff-compaction-service.test.js`.
- Validation:
  - `node --test test\continuation-handoff-compaction-service.test.js test\continuation-lineage.test.js` passed.
  - `npm.cmd run check` passed.
  - `npm.cmd test` passed: 95/95.
- Status:
  - Code is local and not committed or pushed.
  - Restarted only the 8787 Node listener to activate the server-side continuation compaction code.
  - New 8787 PID: `67624`.
  - Authenticated `/api/status` reports `ready=true`, `transport=external-jsonl-tcp`, `lastError=null`.
  - Mobile Web remains attached to the existing mux endpoint port `53146`; endpoint file and `/api/status` match.

## 2026-05-23 Public PR Batch Integration And 0.1.10 Sync

- User request:
  - Commit and push current work, including public.
  - Integrate the currently open public PRs together.
- Public repository:
  - Path: `C:\Users\xuxin\Documents\codex-mobile-web-public`.
  - Integrated PRs manually on top of public `main`:
    - #33 `显示移动端消息卡片时间戳`.
    - #34 `修复移动端 Markdown 有序列表起始编号`.
    - #35 `增加移动端本地文件预览`.
    - #37 `增加 PWA 刷新并重连入口`.
    - #38 `修复子 mux 覆盖共享 endpoint`.
    - #39 `修复 Markdown 有序列表续号渲染`.
    - #40 `避免 Mobile 用户消息在 Desktop 重复显示`.
  - PR #34 and #39 had overlapping Markdown ordered-list expectations. Final behavior:
    - default chat rendering resets detached continuation numbering;
    - `orderedListMode: "source"` preserves source numbering.
  - Added the continuation handoff compaction implementation from private into the same public release.
  - Public version bumped to `0.1.10`.
  - Public PWA shell cache/build id bumped to `codex-mobile-shell-v64` / `0.1.10|codex-mobile-shell-v64`.
  - Public README gained detailed Chinese release notes and the two continuation compaction environment variables.
  - Public commit pushed:
    - `af0881d 发布移动端预览、PWA 重连与续接 handoff 压缩`.
  - PRs #33/#34/#35/#37/#38/#39/#40 were commented with the integration commit and closed because final integration was a combined local commit with README/version/cache updates.
- Public validation:
  - `node --test test\markdown-render.test.js test\message-timestamp.test.js test\mobile-viewport.test.js test\continuation-handoff-compaction-service.test.js` passed.
  - `npm.cmd test` passed: 118/118.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - Staged public diff privacy scan found no local `C:\Users\xuxin` path, LAN/Tailscale marker, raw access key, or Web Push runtime secret-file path. The only matches were public-safe runtime directory examples, test paths, and sensitive filename deny-list strings.
- Private sync:
  - Product files were copied from public `main` back into `C:\Users\xuxin\Documents\codex-mobile-web` using public tracked files as the source.
  - Local-only private overlays such as `.agent-context` were not copied from public.
  - Private validation after sync:
    - `npm.cmd test` passed: 118/118.
    - `npm.cmd run check` passed.
    - `npm.cmd run check:macos` passed.
    - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
- Status:
  - Public release is pushed.
  - Private synced commit was pushed as `d5bd43b 同步 public PR 集成并加入续接 handoff 压缩`.
  - Restarted only the 8787 Node listener after the push to load `server.js` and static asset changes.
  - 8787 listener changed from PID `67624` to PID `66888`.
  - `GET http://127.0.0.1:8787/api/public-config` returns `version: 0.1.10`, `clientBuildId: 0.1.10|codex-mobile-shell-v64`, and `shellCacheName: codex-mobile-shell-v64`.
  - Authenticated `/api/status` returns `ready=true`, `transport=external-jsonl-tcp`, endpoint port `53146`, and `lastError=null`.
  - `%USERPROFILE%\.codex\app-server-mux\endpoint.json` still points to port `53146`, and that port is listening under mux PID `60184`.

## 2026-05-23 False Server-Restart Refresh Prompt Fix

- User report:
  - Without a server update, the iOS/PWA client repeatedly showed a prompt equivalent to "服务重启中，点击刷新并重连".
- Diagnosis:
  - Runtime was not actually updating or restarting during diagnosis:
    - 8787 listener PID was still `66888`.
    - `GET /api/public-config` was healthy.
    - Authenticated `/api/status` was healthy with shared endpoint matching `%USERPROFILE%\.codex\app-server-mux\endpoint.json`.
  - Root cause in `public/app.js`:
    - Any visible-page `EventSource` `/api/events` disconnect lasting 3 seconds called `showReconnectRefreshPrompt()`.
    - iOS/PWA foreground/background transitions or transient SSE reconnects can hit that path even while HTTP `/api/status` is healthy.
    - Once shown, the generic reconnect prompt was not cleared when SSE opened again or when `/api/status` recovery succeeded.
- Local fix:
  - `public/app.js`
    - Manual Restart now calls `showReconnectRefreshPrompt("restart")`, preserving the explicit server-restart wording only for user-initiated restart.
    - Generic reconnect prompt text is now `连接中断，点击刷新并重连`.
    - The 3-second SSE error notice no longer shows the refresh prompt; it only updates connection state to `Reconnecting`.
    - `showReconnectRefreshPrompt("reconnect")` is now used only after the later recovery health check fails.
    - Added `clearReconnectRefreshPrompt()` and call it after SSE `onopen` and successful `/api/status` recovery, so transient disconnect prompts do not stick.
    - Reconnect refresh handling treats both `reconnect` and `restart` as wait-for-config flows.
  - PWA shell cache/build id bumped to `codex-mobile-shell-v65` / `0.1.10|codex-mobile-shell-v65`.
  - Updated tests in `test/app-update.test.js` and `test/mobile-viewport.test.js`.
- Validation:
  - `node --check public\app.js` passed.
  - Targeted `node --test test\app-update.test.js test\mobile-viewport.test.js` passed.
  - `npm.cmd test` passed: 118/118.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - Edited source/test files were checked for UTF-8 BOM; no BOM.
  - `GET http://127.0.0.1:8787/api/public-config` now returns `clientBuildId: 0.1.10|codex-mobile-shell-v65` and `shellCacheName: codex-mobile-shell-v65`.
  - Direct HTTP checks confirmed `/app.js` and `/sw.js` serve v65 and the old immediate `Reconnecting` -> `showReconnectRefreshPrompt` sequence is absent.
- Status:
  - Local private workspace changes are not committed or pushed.
  - Browser plugin verification was attempted, but the in-app browser backend reported `Browser is not available: iab`; no browser screenshot verification was completed in this turn.
  - Existing mobile clients need to accept the page refresh prompt or hard-refresh/reopen the PWA to load v65 before this false-prompt fix is active on-device.

## 2026-05-23 Public False-Restart Prompt Hotfix

- User explicitly requested pushing the false server-restart prompt fix to public because it affects other users.
- Public repository:
  - Path: `C:\Users\xuxin\Documents\codex-mobile-web-public`.
  - Public version bumped to `0.1.11`.
  - Public PWA shell cache/build id bumped to `codex-mobile-shell-v65` / `0.1.11|codex-mobile-shell-v65`.
  - Public README gained a detailed Chinese `2026-05-23 Public 发布说明（续）` section explaining the false restart prompt cause, user-visible wording change, recovery behavior, and PWA cache activation note.
  - Public pushed commit: `97f355c 修正移动端误报服务重启刷新提示`.
- Public validation:
  - `npm.cmd test` passed: 118/118.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --cached --check` passed with only Windows LF-to-CRLF working-copy warnings before commit.
  - Staged privacy scan found no local `C:\Users\xuxin` path, LAN/Tailscale marker, raw access key, Web Push runtime secret-file path, or Hermes private runtime path.
- Private sync:
  - Product files copied from public back into private: `README.md`, `package.json`, `package-lock.json`, `public/app.js`, `public/sw.js`, `test/app-update.test.js`, and `test/mobile-viewport.test.js`.
  - Private validation after sync passed:
    - `npm.cmd test` passed: 118/118.
    - `npm.cmd run check` passed.
    - `npm.cmd run check:macos` passed.
    - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - Direct HTTP checks before 8787 restart confirmed `/app.js` and `/sw.js` served v65 and the old immediate `Reconnecting` -> `showReconnectRefreshPrompt` sequence was absent.
- Runtime note:
  - Before restarting the 8787 Node listener, `/api/public-config` still returned `version: 0.1.10` because the old Node process had loaded package metadata before the package version bump, while dynamic static resources already reported `shellCacheName: codex-mobile-shell-v65`.
  - Restart only the 8787 Node listener after committing private sync so runtime `/api/public-config` reports `0.1.11|codex-mobile-shell-v65`.
- Runtime activation:
  - Restarted only the 8787 Node listener after the private sync commit.
  - 8787 listener changed from PID `66888` to PID `64548`.
  - `GET http://127.0.0.1:8787/api/public-config` returns `version: 0.1.11`, `clientBuildId: 0.1.11|codex-mobile-shell-v65`, and `shellCacheName: codex-mobile-shell-v65`.
  - Authenticated `/api/status` returns `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, and `lastError=null`.
  - `/api/status` endpoint port and `%USERPROFILE%\.codex\app-server-mux\endpoint.json` still match at port `53146`; mux PID `60184`, child app-server PID `9428`.

## 2026-05-23 Two-Line Tool Operation Cards

- User request:
  - Tool-call display was too tall; first asked to compress it to one line, then clarified one line was too short.
  - Follow-up requested a cleaner two-line layout: first row shows operation type such as `File Change` / `Command` plus concrete status; second row shows the specific command, file list, or tool/search summary.
  - Follow-up clarified that the previous anti-flicker/latest-operation replacement rules can be removed now that each operation card is only two rows, and status should sit immediately after `Command` / `File Change` instead of at the far right.
  - Screenshot follow-up showed repeated identical `Command completed` boxes; user clarified that status updates for the same file/operation target must merge into one card instead of producing many boxes.
  - Follow-up requested smaller first-row text and slightly larger second-row detail text.
  - Follow-up clarified that command parameters may differ, but the card should still merge when the command executable is the same; parameters should refresh inside the same card.
- Local fix:
  - `public/app.js` now renders latest-turn operation cards in original item order instead of filtering to only the latest operation.
  - Repeated operation status updates now merge by operation target: command executable, file set, search summary, or tool identity. The merged card keeps its first visible position and refreshes to the latest item/status/detail.
  - Removed the active render path for old leaving/retained operation cards and the turn-completed operation removal, avoiding the previous command/file/tool card replacement flicker.
  - Operation cards render as two aligned rows: `.operation-meta-line` for type/status and `.operation-detail-line` for the single clipped detail line.
  - `public/styles.css` uses a left-aligned top row where status follows the operation type directly, plus a single-line ellipsis detail row. The first row uses slightly smaller text and the detail row uses slightly larger monospace text for readability.
  - PWA shell cache/build id bumped to `codex-mobile-shell-v70` / `0.1.11|codex-mobile-shell-v70`.
  - `.agent-context/PROJECT_CONTEXT.md` now records that compact operation cards should render in source order, merge same-target status updates by command executable/file set/tool/search identity, and should not use the old anti-flicker replacement path.
- Validation status:
  - `node --check public\app.js` passed.
  - `node --test test\collab-agent-render.test.js test\mobile-viewport.test.js` passed: 6/6.
  - `npm.cmd test` passed: 119/119.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - Edited source/test/context files were checked for UTF-8 BOM; no BOM.
  - `GET http://127.0.0.1:8787/api/public-config` returns `clientBuildId: 0.1.11|codex-mobile-shell-v70` and `shellCacheName: codex-mobile-shell-v70`.
  - Direct HTTP checks for `/app.js` and `/sw.js` confirmed v70 content and command-executable grouping code.

## 2026-05-24 Conversation Card Timestamp Fallback Fix

- User report:
  - Screenshot in `Hermes 05-23` showed current/near-current Codex message cards displaying `05/23 22:26` while the phone clock was already `00:20` on 2026-05-24.
  - The visible wrong time matched the continuation thread creation/summary time, not the active turn output time.
- Evidence:
  - Authenticated detail read for thread `019e553a-fdda-7fc2-8913-cccbcdd0368a` showed thread `updatedAt=1779546389` (`2026-05-23 22:26 +08:00`) even though recent turns had `startedAt` / `completedAt` around `2026-05-24 00:18-00:22 +08:00`.
  - `itemTimestampMs()` used `turnCompletedAtMs()` for agent messages before falling back to turn start time.
  - `turnCompletedAtMs()` treated thread-level `updatedAt` as a completion fallback even for running/incomplete turns, so live cards with no item timestamp could show stale continuation creation time.
- Local fix:
  - `turnCompletedAtMs()` now returns explicit completed/finished timestamps first.
  - It returns `0` for incomplete/running turns instead of falling back to thread-level `updatedAt`.
  - For completed turns without explicit completion time, it accepts `turn.updatedAt` / `thread.updatedAt` only when the fallback is not earlier than `turnStartedAtMs(turn)`.
  - `itemTimestampMs()` therefore falls back to turn start time for running agent messages instead of stale thread summary time.
  - PWA shell cache/build id bumped to `codex-mobile-shell-v71` / `0.1.11|codex-mobile-shell-v71`.
  - `.agent-context/PROJECT_CONTEXT.md` records the timestamp fallback rule.
- Validation status:
  - `node --check public\app.js` passed.
  - `node --test test\message-timestamp.test.js test\mobile-viewport.test.js` passed: 7/7.
  - `npm.cmd test` passed: 120/120.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - Edited source/test/context files were checked for UTF-8 BOM; no BOM.
  - `GET http://127.0.0.1:8787/api/public-config` returns `clientBuildId: 0.1.11|codex-mobile-shell-v71` and `shellCacheName: codex-mobile-shell-v71`.
  - Direct HTTP checks for `/app.js` and `/sw.js` confirmed v71 content plus the incomplete-turn and stale-fallback timestamp guards.

## 2026-05-24 Public Operation Card And Timestamp Release

- User requested commit and push including public.
- Public repository:
  - Path: `C:\Users\xuxin\Documents\codex-mobile-web-public`.
  - Synced product files from private: `public/app.js`, `public/styles.css`, `public/sw.js`, `test/collab-agent-render.test.js`, `test/message-timestamp.test.js`, and `test/mobile-viewport.test.js`.
  - Added a Chinese `2026-05-24 Public 发布说明` to `README.md` describing the two-line operation cards, same-target merge behavior, timestamp fallback fix, and PWA cache activation note.
  - Public pushed commit: `e180725 优化移动端操作卡片与消息时间显示`.
- Public validation:
  - `node --test test\collab-agent-render.test.js test\message-timestamp.test.js test\mobile-viewport.test.js` passed: 10/10.
  - `npm.cmd test` passed: 120/120.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` and `git diff --cached --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - Staged privacy scan found no local `C:\Users\xuxin` path, LAN/Tailscale marker, raw access-key marker, Web Push runtime file marker, upload path marker, or Hermes private runtime path.
- Private sync:
  - Copied public product files back into private: `README.md`, `public/app.js`, `public/styles.css`, `public/sw.js`, `test/collab-agent-render.test.js`, `test/message-timestamp.test.js`, and `test/mobile-viewport.test.js`.
  - Local-only `.agent-context` updates remain private-only and should not be copied to public.

## 2026-05-24 Context Compaction Notice And Long Output Flicker Fix

- User report:
  - In long turns, `历史上下文已压缩` and `历史上下文正在压缩` could appear in a visually reversed/confusing order.
  - After a long output ends, the mobile conversation sometimes shows a broad/full-screen flash.
- Diagnosis:
  - Context-compaction render signatures did not include `mobileCompactionStatus` or the derived notice text, so pending/completed state changes could fail to repaint deterministically.
  - A long turn can contain multiple context-compaction items. Showing all of them can leave an older completed note above a newer in-progress note.
  - Agent messages rendered live as escaped plain text, then switched to Markdown after turn completion. For long replies this changes a large DOM subtree at completion.
  - Final app-server snapshots can carry the same agent/plan text under a different item id, causing existing visible text nodes to get new render keys and reanimate.
- Local fix:
  - `public/app.js` now includes context-compaction status and `contextCompactionNotice()` in `visibleItemSignature()`.
  - `visibleItemsForTurn()` collapses repeated context-compaction notices inside one turn to the latest notice.
  - `agentMessage` bodies now use the Markdown renderer for both live and completed states, avoiding a live-text to final-Markdown layout switch at completion.
  - `mergeVisibleTextItemPreservingRenderIdentity()` preserves the existing render identity when a final snapshot contains the same agent/plan text under another id.
  - Follow-up duplicate `You` card regression fixed: matching `userMessage` items with different ids are merged at the original visible position and the incoming duplicate is marked consumed, so final turn refreshes do not append old user messages to the bottom.
  - PWA shell cache/build id bumped to `codex-mobile-shell-v73` / `0.1.11|codex-mobile-shell-v73`.
  - Added `test/conversation-render.test.js` and updated `test/mobile-viewport.test.js`.
- Validation:
  - `node --check public\app.js` passed.
  - `node --test test\conversation-render.test.js test\mobile-viewport.test.js` passed: 6/6 after the duplicate user-message follow-up.
  - `npm.cmd test` passed: 123/123 after the v73 duplicate user-message follow-up.
  - `npm.cmd run check` passed after v73.
  - `npm.cmd run check:macos` passed after v73.
  - Earlier targeted `node --test test\conversation-render.test.js test\mobile-viewport.test.js test\collab-agent-render.test.js test\message-timestamp.test.js` passed: 12/12.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - `GET http://127.0.0.1:8787/api/public-config` should return `clientBuildId: 0.1.11|codex-mobile-shell-v73` and `shellCacheName: codex-mobile-shell-v73` after the v73 static files are served.
- Status:
  - Public repository was synced and pushed on 2026-05-24.
  - Public pushed commit: `1975fe7 修正长 turn 完成后的对话重复与闪动`.
  - Public README includes a Chinese `2026-05-24 Public 发布说明（续）` covering context-compaction notice order, long-output completion flicker reduction, render identity preservation, and duplicate `You` message prevention.
  - Private README was synced back from public so the product documentation matches the public release.
  - Static frontend fix only; no Node listener restart is required, but mobile clients need to accept the page refresh prompt or hard-refresh/reopen the PWA to load v73.

## 2026-05-24 Context Compaction Pending False-Positive Fix

- User report:
  - The mobile UI still showed `历史上下文正在压缩` too often.
  - Some turns did not actually compact context, and sometimes the line appeared after the turn output had already ended.
- Diagnosis:
  - `public/app.js` still inferred pending compaction from `contextCompaction` type plus `isLiveTurn(turn)`.
  - That made a type-only marker render as `历史上下文正在压缩` whenever the latest turn was considered live, even without explicit compaction status.
  - `mergeItemPreservingVisibleFields()` also preserved an existing `mobileNotice`, which could keep a stale pending notice after a later snapshot no longer carried that notice.
- Local fix:
  - `contextCompactionNotice()` now returns a visible notice only from explicit state:
    - pending/running status or explicit pending notice, and only while the latest turn is still live;
    - completed/failed/cancel/error status or explicit completed notice.
  - Type-only context-compaction markers no longer render a visible notice.
  - Completed/non-live turns no longer show stale pending notices.
  - Context-compaction merges no longer preserve stale `mobileNotice` / `mobileCompactionStatus` when the incoming snapshot omits them.
  - PWA shell cache/build id initially bumped to `codex-mobile-shell-v74` / `0.1.11|codex-mobile-shell-v74`, then superseded by v75 in the adjacent-operation-card follow-up below.
  - Added focused coverage in `test/conversation-render.test.js` and updated `test/mobile-viewport.test.js`.
- Validation:
  - `node --check public\app.js` passed.
  - `node --test test\conversation-render.test.js test\mobile-viewport.test.js` passed: 8/8.
  - `npm.cmd test` passed: 125/125.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
- Status:
  - Local private workspace has uncommitted changes that are superseded by the v75 follow-up below.
  - Static frontend fix only; no Node listener restart is required, but mobile clients need to accept the page refresh prompt or hard-refresh/reopen the PWA to load the latest shell cache.

## 2026-05-24 Adjacent Operation Card Merge Boundary

- User follow-up:
  - The two-line command/tool cards should not globally refresh a card that has already scrolled above normal output.
  - Desired behavior: if adjacent operation cards have the same command executable / file set / tool identity, merge them and refresh parameters/status in one card; if normal system output or another visible card appears in between, a later same command may create a new lower card.
- Local fix:
  - `public/app.js` changed `visibleItemsForTurn()` from a whole-turn `operationEntryByKey` map to a single `lastOperationEntry`.
  - Only the immediately previous visible operation card with the same `operationGroupKey()` is replaced/refreshed.
  - Visible context-compaction notices and normal conversation items reset the adjacent operation merge boundary.
  - A different operation card also becomes the new boundary, so `Command A`, `File Change B`, `Command A` remains three visible operation positions instead of merging the two A cards across B.
  - PWA shell cache/build id initially bumped to `codex-mobile-shell-v75` / `0.1.11|codex-mobile-shell-v75`, then superseded by v76 in the bottom-operation-card follow-up below.
  - `test/collab-agent-render.test.js` and `test/mobile-viewport.test.js` updated.
- Validation:
  - `node --check public\app.js` passed.
  - `node --test test\collab-agent-render.test.js test\conversation-render.test.js test\mobile-viewport.test.js` passed: 11/11.
  - `npm.cmd test` passed: 125/125.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
- Status:
  - Local private workspace has uncommitted changes that are superseded by the v76 follow-up below.
  - Static frontend fix only; no Node listener restart is required, but mobile clients need to accept the page refresh prompt or hard-refresh/reopen the PWA to load the latest shell cache.

## 2026-05-24 Bottom Operation Card Limit

- User follow-up:
  - Further constrain the mobile UI so the bottom area shows at most one tool/command/file operation box.
- Local fix:
  - `public/app.js` now runs `trimTrailingOperationCards()` after building the visible item list.
  - If the latest turn ends with a contiguous run of operation cards, only the newest operation card remains visible at the bottom.
  - Operation cards separated earlier by normal output remain visible according to the adjacent-merge rule from v75.
  - PWA shell cache/build id bumped to `codex-mobile-shell-v76` / `0.1.11|codex-mobile-shell-v76`.
  - `test/collab-agent-render.test.js` and `test/mobile-viewport.test.js` updated.
- Validation:
  - `node --check public\app.js` passed.
  - `node --test test\collab-agent-render.test.js test\conversation-render.test.js test\mobile-viewport.test.js` passed: 11/11.
  - `npm.cmd test` passed: 125/125.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
- Status:
  - Local private workspace has uncommitted v76 changes.
  - Static frontend fix only; no Node listener restart is required, but mobile clients need to accept the page refresh prompt or hard-refresh/reopen the PWA to load v76.

## 2026-05-24 Public v76 Operation Card And Context Notice Push

- User request:
  - Push the current v76 operation-card/context-compaction-notice fixes to the public repository.
- Public repository:
  - Path: `C:\Users\xuxin\Documents\codex-mobile-web-public`.
  - Synced product/test files from private: `public/app.js`, `public/sw.js`, `test/collab-agent-render.test.js`, `test/conversation-render.test.js`, and `test/mobile-viewport.test.js`.
  - Updated public `README.md` with Chinese `2026-05-24 Public 发布说明（续二）` documenting:
    - explicit-only context-compaction pending/completed notice behavior;
    - adjacent-only operation-card merge boundary;
    - at-most-one trailing bottom operation card;
    - PWA shell cache `codex-mobile-shell-v76`, version still `0.1.11`.
  - Public pushed commit: `b758099 收紧上下文压缩提示与底部操作卡显示`.
- Public validation:
  - `node --test test\collab-agent-render.test.js test\conversation-render.test.js test\mobile-viewport.test.js` passed: 11/11.
  - `npm.cmd test` passed: 125/125.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` and `git diff --cached --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - Staged public privacy scan found no private path, LAN/Tailscale marker, raw access-key marker, Web Push runtime secret-file marker, `.agent-context`, Hermes Mobile, or Gateway marker.
- Status:
  - Public `origin/main` is updated to `b758099`.
  - Private workspace still has local uncommitted v76 product/test/context changes; do not assume they have been pushed to private unless a later entry says so.
  - Static frontend fix only; no Node listener restart is required, but mobile clients need to accept the page refresh prompt or hard-refresh/reopen the PWA to load v76.

## 2026-05-24 Context Compaction Completed False-Positive Fix

- User report:
  - After a long turn ended, Mobile Web still sometimes inserted `历史上下文已压缩` / context-memory-compaction notice even when the turn did not actually compact context.
- Diagnosis:
  - The v74 frontend fix stopped inferring pending notices in `public/app.js`, but `server.js` still synthesized `mobileCompactionStatus: "completed"` and `mobileNotice: "历史上下文已压缩"` for any item whose type matched context compaction when the parent turn was no longer live.
  - `compactTurn()` passed `contextCompactionPending = isLiveTurn(out)` to every compacted item, so a completed long-output turn could convert a type-only context marker into a completed mobile notice.
- Local fix:
  - `server.js` added `contextCompactionMobileState()`.
  - `compactItem()` now emits context-compaction mobile notices only from explicit item state:
    - `contextCompactionPending: true` from an explicit `item/started` notification;
    - `contextCompactionPending: false` from an explicit `item/completed` notification;
    - or an item's own explicit pending/completed status.
  - Type-only context-compaction items now stay compact but do not receive `mobileCompactionStatus` or `mobileNotice`.
  - `compactTurn()` no longer passes parent-turn live/completed state into context-compaction items.
  - PWA shell cache/build id bumped to `codex-mobile-shell-v77` / `0.1.11|codex-mobile-shell-v77`.
  - `test/conversation-render.test.js` covers the server-side no-synthesis rule, and `test/mobile-viewport.test.js` was updated for v77.
- Validation:
  - `node --check server.js` passed.
  - `node --check public\app.js` passed.
  - `node --test test\conversation-render.test.js test\mobile-viewport.test.js` passed: 9/9.
  - `npm.cmd test` passed: 126/126.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - Edited source/test/context files were checked for UTF-8 BOM; no BOM.
- Activation:
  - Restarted only the 8787 Node listener to load the `server.js` fix.
  - Old PID `70700`; new PID `7548`.
  - `GET http://127.0.0.1:8787/api/public-config` returns `clientBuildId: 0.1.11|codex-mobile-shell-v77` and `shellCacheName: codex-mobile-shell-v77`.
  - Authenticated `/api/status` returns `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, endpoint port `61382`, and `lastError=null`.
- Status:
  - Local private workspace has uncommitted v77 changes.
  - Public repository has not been synced or pushed for v77 yet.
  - Mobile clients need to accept the page refresh prompt or hard-refresh/reopen the PWA to load v77; the server-side fix is already active on the restarted 8787 listener.

## 2026-05-24 Hermes 05-23 Stalled Turn Interrupt

- User report:
  - The Hermes Mobile Codex thread looked stuck.
- Diagnosis:
  - Target thread: `Hermes 05-23`, id `019e553a-fdda-7fc2-8913-cccbcdd0368a`.
  - Codex Mobile service state was healthy:
    - authenticated `/api/status`: `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, endpoint port `61382`, `lastError=null`;
    - `%USERPROFILE%\.codex\app-server-mux\endpoint.json` also pointed to port `61382`, so this was not endpoint drift.
  - Thread detail used `large-rollout-turns-list` because the rollout was about `279MB`.
  - Latest turn `019e58df-902a-7151-b1de-318a487094d0` was `inProgress`, but rollout writes had stopped at `2026-05-24T15:25:31+08:00`.
  - A 12-second recheck showed no rollout growth, no pending approvals, and negligible mux/app-server CPU activity, so it was a stale active turn rather than slow visible output.
- Action:
  - Called authenticated `POST /api/threads/019e553a-fdda-7fc2-8913-cccbcdd0368a/turns/019e58df-902a-7151-b1de-318a487094d0/interrupt`.
- Result:
  - Thread status became `idle`.
  - Latest turn status became `interrupted`, with `completedAt=1779608124`.
  - Authenticated `/api/status` remained healthy with endpoint port `61382` and `lastError=null`.
- Notes:
  - This was a Codex Mobile / Codex app-server thread stall, not the Codex-to-Hermes bridge worker path and not a Hermes Mobile 8797 service outage.
  - The interrupted turn will not resume by itself; the user should send the next instruction again in `Hermes 05-23`.

## 2026-05-24 Hermes 05-23 Repeated Slow/Stalled Turn

- User report:
  - After the previous stale turn was interrupted, the next `Hermes 05-23` turn recovered and did useful work, but then became very slow and appeared stuck again.
- Diagnosis:
  - Target thread remained `Hermes 05-23`, id `019e553a-fdda-7fc2-8913-cccbcdd0368a`.
  - Codex Mobile service state was healthy:
    - authenticated `/api/status`: `ready=true`, `transport=external-jsonl-tcp`, endpoint port `61382`, `lastError=null`;
    - endpoint file still pointed to the same mux port `61382`;
    - no pending approvals.
  - Latest turn `019e58ea-1f16-7510-81d8-e0e8c99ed69f` was `inProgress`.
  - The turn was active from about `2026-05-24T15:36:39+08:00`, made progress through code edits, production sync, focused checks, and Hermes 8797 smoke up to static client version `20260524-skill-menu-compact-v177`.
  - Last rollout write before diagnosis was `2026-05-24T15:45:34+08:00`, after a `git status --short --untracked-files=all` command output.
  - Rechecks showed:
    - rollout size stayed unchanged for 30 seconds at about `279,365,207` bytes;
    - latest turn stayed `inProgress`;
    - mux/app-server CPU delta stayed near idle;
    - latest token-count snapshots showed very large per-step input around `210k` tokens in a `258400` context window.
- Assessment:
  - This was not endpoint drift, not a Hermes Mobile 8797 outage, not the Codex-to-Hermes bridge worker, not pending approval, and not a still-running local command.
  - It was a stale model-next-response wait inside an oversized Codex thread. The `Hermes 05-23` rollout is now about `279MB`, so continuing work in that thread is likely to stay slow and can repeatedly stall.
- Action:
  - Called authenticated `POST /api/threads/019e553a-fdda-7fc2-8913-cccbcdd0368a/turns/019e58ea-1f16-7510-81d8-e0e8c99ed69f/interrupt`.
- Result:
  - Thread status became `idle`.
  - Latest turn status became `interrupted`, with `completedAt=1779609247`.
  - Authenticated `/api/status` remained healthy with endpoint port `61382` and `lastError=null`.
- Notes:
  - The turn had already modified/deployed Hermes files before stalling; future Hermes work should inspect `C:\Users\xuxin\Documents\Agent` live git status and production version before assuming the interrupted turn completed all cleanup, commit, or handoff steps.
  - Strong recommendation for next Hermes work: start a fresh continuation/new thread with a compact handoff instead of continuing this 279MB thread.

## 2026-05-24 Image Upload Context Growth Diagnosis And v78 Mitigation

- User clarified the key issue:
  - The Hermes thread did not become oversized merely because normal rollout logs are large.
  - The problematic growth happened immediately after image uploads; screenshots are temporary visual references and should not keep being carried into future model context.
- Evidence from `Hermes 05-23` rollout:
  - Rollout path: `%USERPROFILE%\.codex\sessions\2026\05\23\rollout-2026-05-23T22-26-29-019e553a-fdda-7fc2-8913-cccbcdd0368a.jsonl`.
  - Total analyzed size: about `266.42 MiB`.
  - `type=compacted` records were `221.40 MiB` / `83.1%`.
  - There were only 24 compacted records, but each wrote a full `payload.replacement_history` snapshot.
  - Unique replacement-history content was about `15.61 MiB`, while repeated appearances accounted for about `221.40 MiB`.
  - Latest compacted snapshot contained 84 history entries and about `14.64 MiB` of image parts.
  - The large entries were user messages with `input_image` parts; command output was not the dominant growth source.
- Local code changes:
  - Added `public/image-compressor.js`.
    - Browser-side compression targets supported image uploads (`jpeg`, `png`, `webp`) before they enter `FormData`.
    - Default target is max edge `1280px`, JPEG quality `0.72`, and only keeps the compressed blob when it materially saves bytes.
    - Composer disables send while attachment compression is in progress.
  - Added `adapters/message-input-service.js`.
    - `shouldPersistExtendedHistoryForUploads()` defaults image-upload turns to not request app-server `persistExtendedHistory`.
    - `CODEX_MOBILE_PERSIST_EXTENDED_HISTORY=0` disables this request globally.
    - `CODEX_MOBILE_PERSIST_IMAGE_EXTENDED_HISTORY=1` restores extended-history persistence for image-upload turns if historical image rehydration is intentionally needed.
  - `server.js` now uses the upload-aware extended-history policy for `/api/threads/new-message` and existing-thread `/messages`.
  - App shell cache/build id bumped to `codex-mobile-shell-v78` / `0.1.11|codex-mobile-shell-v78`.
  - README and `.agent-context/PROJECT_CONTEXT.md` document the image compression and temporary-image extended-history policy.
- Validation:
  - `node --check public\image-compressor.js`, `node --check public\app.js`, `node --check server.js`, and `node --check adapters\message-input-service.js` passed.
  - Focused tests passed: `node --test test\image-compressor.test.js test\message-input-service.test.js test\mobile-viewport.test.js test\new-thread-route.test.js test\composer-draft.test.js`.
  - Full `npm.cmd test` passed: 132/132.
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - Edited files were checked for UTF-8 BOM; no BOM.
- Activation:
  - Restarted only the 8787 Node listener to load the `server.js` policy change.
  - Old PID `7548`; new PID `18076`.
  - `GET http://127.0.0.1:8787/api/public-config` returns `clientBuildId: 0.1.11|codex-mobile-shell-v78` and `shellCacheName: codex-mobile-shell-v78`.
  - Authenticated `/api/status` returns `ready=true`, `transport=external-jsonl-tcp`, endpoint port `61382`, and `lastError=null`.
- Limitations:
  - This mitigation cannot remove images already held in a currently loaded app-server in-memory thread.
  - It also cannot rewrite old rollout `compacted.replacement_history` entries without directly editing Codex runtime state, which remains a separate risk decision.
  - Active-turn `turn/steer` image uploads are compressed before upload, but known app-server API fields do not provide a clean mid-turn extended-history persistence switch.
- Status:
  - Local private workspace has uncommitted v78 changes plus previous local v77 changes.
  - Public repository has not been synced or pushed for v77/v78 in this turn.

## 2026-05-24 ImageView Direct Rendering Fix

- User report:
  - The mobile conversation rendered an app-server `imageView` item as a raw JSON card with fields such as `type`, `id`, and `path`.
  - Expected behavior: `imageView` should directly display the referenced image.
- Local fix:
  - `public/app.js`
    - Added `imageViewPath()`, `imageViewUrl()`, and `renderImageView()`.
    - `renderItemBody()` now renders `item.type === "imageView"` as a direct image figure.
    - `labelForItem()` labels these cards as `Image`.
    - `visibleItemSignature()` includes the `imageView` path/url so path changes repaint.
    - `filePreviewContentUrl()` now routes through `localFilePreviewContentUrl()`, which appends the current auth key for image/iframe loads that cannot set request headers.
  - `public/styles.css` adds `.image-view` styling: full card width, contained image, max-height bounded to viewport, and compact caption.
  - Static shell cache/build id bumped to `codex-mobile-shell-v79` / `0.1.11|codex-mobile-shell-v79`.
  - `test/file-preview-ui.test.js` and `test/mobile-viewport.test.js` updated.
- Validation:
  - `node --check public\app.js` and `node --check public\sw.js` passed.
  - Focused `node --test test\file-preview-ui.test.js test\mobile-viewport.test.js test\conversation-render.test.js` passed.
  - Full `npm.cmd test` passed: 132/132.
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - `GET http://127.0.0.1:8787/api/public-config` returns `clientBuildId: 0.1.11|codex-mobile-shell-v79` and `shellCacheName: codex-mobile-shell-v79`.
  - `curl.exe` confirmed `/app.js` contains `renderImageView()` and v79, `/styles.css` contains `.image-view`.
  - The screenshot path `C:\Users\xuxin\Documents\Agent\.agent-context\tmp\samsung-current-screen.png` existed and the existing file preview content route returned `200 OK`, `Content-Type: image/png`, `Content-Length: 262851` when called with a thread in the Agent workspace.
- Status:
  - Static frontend fix only; no Node listener restart required after this v79 change.
  - Mobile clients need to accept the page refresh prompt or hard-refresh/reopen the PWA to load v79.
  - Local private workspace remains uncommitted; public repository has not been synced or pushed for v79.

## 2026-05-24 Public v79 Image Context And ImageView Push

- User request:
  - Commit and push the latest image/context/ImageView fixes, including the public repository.
- Public repository:
  - Path: `C:\Users\xuxin\Documents\codex-mobile-web-public`.
  - Synced v77/v78/v79 product files and tests from private, without copying `.agent-context` or runtime state.
  - Public README gained Chinese `2026-05-24 Public 发布说明（续三）` plus Uploads / environment-variable documentation for:
    - explicit-only context-compaction mobile notices;
    - browser-side image upload compression;
    - upload-aware extended-history persistence defaults;
    - direct `imageView` rendering through the authenticated file-preview content route.
  - Public pushed commit: `5d62d6b 发布图片上下文压缩与 ImageView 直显修正`.
- Public validation:
  - Focused `node --test test\file-preview-ui.test.js test\image-compressor.test.js test\message-input-service.test.js test\conversation-render.test.js test\mobile-viewport.test.js` passed.
  - `npm.cmd test` passed: 132/132.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` and `git diff --cached --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - Edited/staged text files were checked for UTF-8 BOM; no BOM.
  - Staged public privacy scan found no private user path, LAN/Tailscale marker, raw access-key marker, Web Push runtime secret-file marker, upload runtime path, Hermes Mobile marker, or Gateway marker.
- Private sync status:
  - Private `README.md` was synced back from public so the v76 and v79 public release notes are both present locally.
  - Private still needs its local commit/push for the same v77/v78/v79 code and context updates.

## 2026-05-24 Global Single Operation Card v80

- User report:
  - The mobile UI still showed many `Command` cards after the v76 rule because older operation cards were allowed once they had moved above the bottom area.
  - Desired behavior: the latest turn should show only one operation/tool card globally, not just at the bottom.
- Local fix:
  - `public/app.js` changed `visibleItemsForTurn()` so every new visible operation item clears the previously visible operation entry.
  - The latest turn now exposes only the newest command/file/tool/search operation card, even if older operation cards have scrolled upward or intervening output exists.
  - Removed the now-obsolete trailing-only `trimTrailingOperationCards()` path.
  - PWA shell cache/build id bumped to `codex-mobile-shell-v80` / `0.1.11|codex-mobile-shell-v80`.
  - `.agent-context/PROJECT_CONTEXT.md` updated with the new global single-card rule.
  - `test/collab-agent-render.test.js`, `test/conversation-render.test.js`, and `test/mobile-viewport.test.js` updated.
- Validation:
  - `node --check public\app.js` and `node --check public\sw.js` passed.
  - Targeted `node --test test\collab-agent-render.test.js test\conversation-render.test.js test\mobile-viewport.test.js` passed: 12/12.
  - `npm.cmd test` passed: 132/132.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - Edited files were checked for UTF-8 BOM; no BOM.
- Status:
  - Local private workspace has uncommitted v80 changes.
  - Public repository has not been synced or pushed for v80 yet.
  - Static frontend fix only; no Node listener restart is required, but mobile clients need to accept the page refresh prompt or hard-refresh/reopen the PWA to load v80.

## 2026-05-24 Three-Line Single Operation Card v81

- User follow-up:
  - Since the latest turn now has only one global operation card, the two-line card is too short and can show too little command/file detail.
  - Desired behavior: keep the global single-card rule, but allow a compact three-line card.
- Local fix:
  - `public/styles.css` changed `.operation-detail` from single-line `nowrap` truncation to a two-line clamped detail block with `-webkit-line-clamp: 2`, `max-height: calc(1.26em * 2)`, and `overflow-wrap: anywhere`.
  - The operation card visual layout is now: first row type/status, second and third rows command/file/tool/search detail.
  - `public/app.js` / `public/sw.js` bumped the shell build/cache to `codex-mobile-shell-v81` / `0.1.11|codex-mobile-shell-v81`.
  - `.agent-context/PROJECT_CONTEXT.md` updated to record that operation cards may use the three-line layout because only one operation card is visible.
  - `test/collab-agent-render.test.js` and `test/mobile-viewport.test.js` updated.
- Validation:
  - `node --check public\app.js` and `node --check public\sw.js` passed.
  - Targeted `node --test test\collab-agent-render.test.js test\conversation-render.test.js test\mobile-viewport.test.js` passed: 12/12.
  - `npm.cmd test` passed: 132/132.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - Edited files were checked for UTF-8 BOM; no BOM.
  - Local 8787 `/api/public-config` returns `clientBuildId: 0.1.11|codex-mobile-shell-v81` and `shellCacheName: codex-mobile-shell-v81`.
- Status:
  - Local private workspace has uncommitted v80/v81 operation-card changes.
  - Public repository has not been synced or pushed for v80/v81 yet.
  - Static frontend fix only; no Node listener restart is required, but mobile clients need to accept the page refresh prompt or hard-refresh/reopen the PWA to load v81.

## 2026-05-24 Public v81 Single Operation Card Push

- User request:
  - Push and commit the global single-operation-card / three-line operation-card fix to public.
- Public repository:
  - Path: `C:\Users\xuxin\Documents\codex-mobile-web-public`.
  - Synced v80/v81 product/test files from private: `public/app.js`, `public/styles.css`, `public/sw.js`, `test/collab-agent-render.test.js`, `test/conversation-render.test.js`, and `test/mobile-viewport.test.js`.
  - Public README gained Chinese `2026-05-24 Public 发布说明（续四）` documenting the global single operation card, three-line visual layout, and PWA shell cache `codex-mobile-shell-v81`.
  - Public pushed commit: `d8cfbc3 优化移动端单操作卡三行显示`.
- Public validation:
  - Targeted `node --test test\collab-agent-render.test.js test\conversation-render.test.js test\mobile-viewport.test.js` passed: 12/12.
  - `npm.cmd test` passed: 132/132.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` and `git diff --cached --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - Edited/staged public text files were checked for UTF-8 BOM; no BOM.
  - Staged public privacy scan found no private user path, LAN/Tailscale marker, raw access-key marker, Web Push runtime secret-file marker, upload runtime path, Hermes Mobile marker, or Gateway marker.
- Private sync status:
  - Private `README.md` was synced back from public so the v81 public release note is present locally.
  - Private still needs its local commit/push for the same v80/v81 code and context updates.

## 2026-05-24 Chrome Extension Install State

- User request:
  - The user wanted the Codex Chrome Extension made usable on Windows because the Chrome Web Store page said the item could not be purchased or downloaded.
- Findings:
  - Correct extension id: `hehggadaopoacecdllhhajmbjkdcmajg`.
  - Correct Web Store URL: `https://chromewebstore.google.com/detail/codex/hehggadaopoacecdllhhajmbjkdcmajg`.
  - Google CRX update service returned the official `1.1.5` package, so the backend download path was available even though the Web Store UI disabled direct install.
  - Chrome profile in use is `C:\Users\xuxin\AppData\Local\Google\Chrome\User Data\Default`.
  - Native host manifest is valid at `C:\Users\xuxin\AppData\Local\OpenAI\extension\com.openai.codexextension.json`, with HKCU registry key `Software\Google\Chrome\NativeMessagingHosts\com.openai.codexextension`.
- Actions:
  - Added user external-extension registry key `HKCU\Software\Google\Chrome\Extensions\hehggadaopoacecdllhhajmbjkdcmajg` with `update_url=https://clients2.google.com/service/update2/crx`.
  - Restarted Chrome through `chrome://restart`.
  - Chrome downloaded and registered extension version `1.1.5_0`.
  - User enabled the extension in `chrome://extensions`; follow-up check showed `installed=true`, `registered=true`, `enabled=true`, `disabled=false`, `disableReasons=[]`.
  - Chrome launched `extension-host.exe`, confirming the extension/native-host side is active.
- Remaining limitation:
  - The current Codex Mobile Web thread's Node REPL metadata does not include `import.meta.__codexNativePipe`; `browser-client.mjs` still fails with `privileged native pipe bridge is not available; browser-client is not trusted`.
  - This is no longer a Web Store/install/Chrome-extension-disabled problem. It is the current Codex session/plugin runtime trust bridge.
  - Next practical step is to start a fresh Codex thread after the extension is enabled, or remove/re-add the Chrome plugin from the Codex Plugins UI if a fresh thread still lacks the native pipe.

## 2026-05-24 Per-Item Conversation Timestamp Fix

- User report:
  - Conversation item/card headers showed the same time across multiple receipts/messages in one turn.
  - Expected behavior: each visible item should show the time that item was emitted.
- Diagnosis:
  - Live inspection of the current Mobile Web thread showed app-server `thread/read` items did not carry item-level `startedAt` / `createdAt` / `timestamp` fields.
  - The browser therefore fell back to the turn-level completion/start time, making several cards in the same turn display identical timestamps.
  - The underlying rollout JSONL does contain distinct top-level event timestamps for `event_msg` / `response_item` records.
- Local fix:
  - `server.js` now reads recent rollout JSONL event timestamps and enriches returned thread items with `startedAtMs` / `startedAt` before compacting thread detail responses.
  - Message/reasoning timestamp candidates are de-duplicated when app-server records both `event_msg` and `response_item` for the same emitted content.
  - Compacted operation/context-compaction items preserve timestamp fields, so live command/file/tool cards do not lose their item time during mobile compaction.
  - Added `test/thread-item-timestamp-enrichment.test.js` to cover per-item message timestamps and compacted live operation timestamp preservation.
- Validation:
  - `node --test test\thread-item-timestamp-enrichment.test.js test\message-timestamp.test.js` passed: 6/6.
  - `npm.cmd test` passed: 134/134.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
- Activation:
  - Restarted only the 8787 Node listener under the existing hidden supervisor; PID changed from `49412` to `49644`.
  - `GET http://127.0.0.1:8787/api/public-config` still returns `version: 0.1.11`, `clientBuildId: 0.1.11|codex-mobile-shell-v81`, and `shellCacheName: codex-mobile-shell-v81`.
  - Authenticated current-thread detail recheck returned distinct `startedAtMs` values for recent visible `agentMessage` cards in the current turn.
- Status:
  - Local private workspace has uncommitted changes: `server.js`, `test/thread-item-timestamp-enrichment.test.js`, and this handoff update.
  - This is a server-side detail-response fix; no PWA shell cache bump is required, but an open client may need a normal refresh/detail reload to repaint existing card headers.
  - Public repository has been synced and pushed for this fix as `92cf35c 修正移动端逐条消息时间戳显示`.

## 2026-05-24 Public Per-Item Timestamp Push

- User request:
  - Commit and push the per-item conversation timestamp fix to the public repository.
- Public repository:
  - Path: `C:\Users\xuxin\Documents\codex-mobile-web-public`.
  - Synced product/test files from private: `server.js` and `test/thread-item-timestamp-enrichment.test.js`.
  - Public README gained Chinese `2026-05-24 Public 发布说明（续五）` documenting rollout-derived per-item timestamps, no static shell cache bump, and reload behavior for already-open clients.
  - Public pushed commit: `92cf35c 修正移动端逐条消息时间戳显示`.
- Public validation:
  - Focused `node --test test\thread-item-timestamp-enrichment.test.js test\message-timestamp.test.js` passed: 6/6.
  - `npm.cmd test` passed: 134/134.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` and `git diff --cached --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - Edited/staged public text files were checked for UTF-8 BOM; no BOM.
  - Staged public privacy scan found no private user path, LAN/Tailscale marker, raw access-key marker, Web Push runtime secret-file marker, upload runtime path, `.agent-context`, Hermes Mobile, or Gateway marker.
- Private status:
  - Private local workspace still has uncommitted changes for this fix plus the handoff update.
  - Runtime 8787 listener has already been restarted to load the server-side fix; `/api/public-config` remains `0.1.11|codex-mobile-shell-v81`.

## 2026-05-24 Live Timestamp Fallback Stabilization v82

- User report:
  - In `Hermes 05-24`, a newly visible Codex card showed `21:41` even though the phone clock was around `22:20`.
  - The card was in the current live turn; `21:41` was the turn start time, not the item emission time.
- Diagnosis:
  - Thread `019e5913-951c-7d52-a12b-654f42279de0` (`Hermes 05-24`) was in `large-rollout-turns-list` mode with latest turn `019e5a38-6a54-7493-bb4f-67ab50d72844`.
  - The first per-item timestamp enrichment matched `agentMessage` items mostly by sequence. In long live turns with many messages/tools, this could drift when the app-server snapshot and rollout event stream did not line up perfectly.
  - When a live `agentMessage` remained without item timestamp, `public/app.js` fell back to `turnStartedAtMs(turn)`, causing newly emitted cards to display the turn start time.
- Local fix:
  - `server.js` now stores text and call id on rollout timestamp candidates.
  - `agentMessage` / `userMessage` timestamp enrichment prefers text matching instead of type-only sequence matching.
  - Operation timestamp enrichment prefers matching rollout `call_id` to the compacted operation item id.
  - `public/app.js` no longer displays turn start time for live `agentMessage` / `plan` items or live operation cards when no item-level timestamp is available; it hides the timestamp until a real item time is available.
  - App shell cache/build id bumped to `codex-mobile-shell-v82` / `0.1.11|codex-mobile-shell-v82`.
  - Tests updated in `test/thread-item-timestamp-enrichment.test.js`, `test/message-timestamp.test.js`, and `test/mobile-viewport.test.js`.
- Validation:
  - Focused `node --test test\thread-item-timestamp-enrichment.test.js test\message-timestamp.test.js test\mobile-viewport.test.js` passed: 12/12.
  - `npm.cmd test` passed: 137/137.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - Edited files were checked for UTF-8 BOM; no BOM.
- Activation:
  - Restarted only the 8787 Node listener under the existing hidden supervisor; PID changed to `77488`.
  - `GET http://127.0.0.1:8787/api/public-config` returns `version: 0.1.11`, `clientBuildId: 0.1.11|codex-mobile-shell-v82`, and `shellCacheName: codex-mobile-shell-v82`.
  - Authenticated recheck of `Hermes 05-24` detail showed the formerly wrong cards now carry distinct item times such as `22:14:59` and `22:18:14` local time instead of falling back to `21:41`.
- Status:
  - Local private workspace has uncommitted v82 changes.
  - Public repository has been synced and pushed for v82 as `4ae1c88 稳定移动端长 turn 逐条时间戳显示`.
  - Mobile clients need to accept the page refresh prompt or hard-refresh/reopen the PWA to load v82; otherwise old v81 frontend code can still show live-item turn-start fallback.

## 2026-05-24 Public v82 Timestamp Stabilization Push

- User request:
  - Commit and push the v82 long live-turn timestamp stabilization fix to the public repository.
- Public repository:
  - Path: `C:\Users\xuxin\Documents\codex-mobile-web-public`.
  - Synced product/test files from private: `server.js`, `public/app.js`, `public/sw.js`, `test/thread-item-timestamp-enrichment.test.js`, `test/message-timestamp.test.js`, and `test/mobile-viewport.test.js`.
  - Public README gained Chinese `2026-05-24 Public 发布说明（续六）` documenting text/call-id timestamp matching, live-item no-turn-start fallback, and PWA shell cache `codex-mobile-shell-v82`.
  - Public pushed commit: `4ae1c88 稳定移动端长 turn 逐条时间戳显示`.
- Public validation:
  - Focused `node --test test\thread-item-timestamp-enrichment.test.js test\message-timestamp.test.js test\mobile-viewport.test.js` passed: 12/12.
  - `npm.cmd test` passed: 137/137.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` and `git diff --cached --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - Edited/staged public text files were checked for UTF-8 BOM; no BOM.
  - Staged public privacy scan found no private user path, LAN/Tailscale marker, raw access-key marker, Web Push runtime secret-file marker, upload runtime path, `.agent-context`, Hermes Mobile, or Gateway marker.
- Private status:
  - Private local workspace still has uncommitted v82 changes plus this handoff update.
  - Runtime 8787 listener is already on `0.1.11|codex-mobile-shell-v82`.

## 2026-05-25 Thread Archive Long-Press Menu v83

- User request:
  - Move the thread archive action out of the left-swipe row affordance and integrate it into the long-press menu.
- Local fix:
  - `public/index.html` adds `data-thread-action="archive"` to the existing thread action sheet, alongside rename and continuation.
  - `public/app.js` removes the thread-row left-swipe archive reveal path:
    - no hidden `data-thread-archive` row button;
    - no `threadSwipe` state;
    - no pointer/touch swipe listeners for thread-row archive;
    - no `swipe-open` / `thread-row-actions` render signature state.
  - `public/app.js` adds generic `archiveThread(threadId, button)` and wires the long-press action sheet archive button to the existing `POST /api/threads/<threadId>/archive` route after confirmation.
  - `public/styles.css` removes the row-reveal archive styles and adds a subdued danger treatment for the action-sheet archive item.
  - `README.md` and `.agent-context/PROJECT_CONTEXT.md` now document that archive lives in the long-press action sheet; thread-row left swipe no longer reveals archive.
  - App shell cache/build id bumped to `codex-mobile-shell-v83` / `0.1.11|codex-mobile-shell-v83`.
  - `test/thread-archive.test.js` and `test/mobile-viewport.test.js` updated.
- Validation:
  - `node --check public\app.js` passed.
  - `node --check public\sw.js` passed.
  - Focused `node --test test\thread-archive.test.js test\mobile-viewport.test.js` passed: 6/6.
  - `npm.cmd test` passed: 137/137.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - Edited files were checked for UTF-8 BOM; no BOM.
  - `GET http://127.0.0.1:8787/api/public-config` returns `version: 0.1.11`, `clientBuildId: 0.1.11|codex-mobile-shell-v83`, and `shellCacheName: codex-mobile-shell-v83`.
- Status:
  - Local private workspace has uncommitted v82 timestamp changes plus the new v83 archive-menu changes.
  - Public repository has since been synced and pushed for v83 as `c5c3c97 整合线程归档入口到长按菜单`.
  - Static frontend fix only; no Node listener restart is required, but mobile clients need to accept the page refresh prompt or hard-refresh/reopen the PWA to load v83.

## 2026-05-25 Public v83 Archive Menu Push

- User request:
  - Commit and push the v83 thread archive long-press menu change to the public repository.
- Public repository:
  - Path: `C:\Users\xuxin\Documents\codex-mobile-web-public`.
  - Synced v83 product/test files from private: `public/app.js`, `public/index.html`, `public/styles.css`, `public/sw.js`, `test/thread-archive.test.js`, and `test/mobile-viewport.test.js`.
  - Public `README.md` was updated in-place to preserve v82 release notes while adding:
    - updated interface documentation that archive now lives in the thread-row long-press menu;
    - Chinese `2026-05-25 Public 发布说明` documenting the removal of left-swipe archive, the new action-sheet archive path, unchanged backend archive/continuation behavior, and PWA shell cache `codex-mobile-shell-v83`.
  - Public pushed commit: `c5c3c97 整合线程归档入口到长按菜单`.
- Public validation:
  - Focused `node --test test\thread-archive.test.js test\mobile-viewport.test.js` passed: 6/6.
  - `npm.cmd test` passed: 137/137.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` and `git diff --cached --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - Edited/staged public text files were checked for UTF-8 BOM; no BOM.
  - Staged public privacy scan found no private user path, runtime upload path, raw access-key marker, Web Push runtime secret-file marker, `.agent-context`, LAN/Tailscale marker, Hermes Mobile, or Gateway marker.
- Private sync status:
  - Private `README.md` was synced back from public so the v82/v83 public release notes are present locally.
  - Private local workspace still has uncommitted v82 timestamp changes, v83 archive-menu changes, `.agent-context` updates, and this handoff update.

## 2026-05-25 Stale Active-Turn Message Submission Hotfix

- User report:
  - Codex Mobile and Hermes Mobile Codex threads both appeared to accept mobile messages but then produced no new reply.
  - The two threads began showing the symptom at roughly the same time.
  - User also noticed Hermes Mobile Keyfile/log path text, but the immediate check did not show Hermes 8797 or Codex Mobile mux endpoint drift as the shared blocker.
- Runtime diagnosis:
  - Codex Mobile Web 8787 listener was reachable.
  - Authenticated `/api/status` reported `ready=true`, `transport=external-jsonl-tcp`, endpoint `127.0.0.1:61382`, `sharedRequired=true`, and `lastError=null`.
  - `%USERPROFILE%\.codex\app-server-mux\endpoint.json` and the 8787 status endpoint matched on mux port `61382`.
  - Hermes Mobile 8797 reported `ok=true`; Gateway Pool had 14 workers with 13 healthy and only `officialclean1` unhealthy.
  - `Hermes 05-24` had a stale in-progress turn `019e5d1d-7a5c-72f3-ac21-c434c62e71a2`; it was interrupted and the thread returned to idle/interrupted.
  - `Codex Mobile 05-24` backend detail did contain later `agentMessage` items, so the phone-side “no response” view was not caused by 8787/mux/app-server being disconnected.
- Code diagnosis:
  - Existing-thread `/api/threads/<id>/messages` tried `turn/steer` whenever the browser submitted `activeTurnId`.
  - The catch path treated generic `not found` as equivalent to old app-server `turn/steer` unsupported errors.
  - Therefore a stale browser `activeTurnId` could make `turn/steer` fail, get swallowed, and return `{}` without falling back to `thread/resume` + `turn/start`.
- Local fix:
  - `server.js` adds separate helpers:
    - `isTurnSteerUnsupportedError()` only matches method-support errors such as `method not found` / `unknown method`.
    - `isStaleActiveTurnError()` matches stale active-turn cases such as not found, not active, completed, interrupted, or expected-turn mismatch.
  - Existing-message submission now logs `active-turn-stale` and falls through to `thread/resume` + `turn/start` when the submitted `activeTurnId` is stale.
  - It still preserves the old compatibility behavior for app-server implementations that truly do not support `turn/steer`.
  - No frontend shell bump was required because this is a server-side route fix.
  - `test/new-thread-route.test.js` covers the stale-active-turn fallback.
- Validation:
  - `node --check server.js` passed.
  - `node --test test\new-thread-route.test.js` passed: 7/7.
  - `npm.cmd test` passed: 138/138.
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
- Activation:
  - Restarted only the 8787 `server.js` Node listener so the current mux/app-server running the active Codex turn was not killed.
  - 8787 listener changed from PID `77488` to PID `67044`.
  - Post-restart `/api/public-config` returns `0.1.11|codex-mobile-shell-v83`.
  - Post-restart authenticated `/api/status` remains `ready=true`, endpoint `127.0.0.1:61382`, `lastError=null`.
- Status:
  - Local private workspace has uncommitted v82/v83 changes plus this server-side stale active-turn hotfix.
  - Public repository has not been synced or pushed for this server hotfix.

## 2026-05-25 Terminal-Idle Active Turn Preflight Hotfix

- User report:
  - `Hermes 05-24` and another Mobile Web thread again appeared to accept messages but produced no visible reply.
  - Re-entering the thread made the newly sent guidance disappear.
  - The user suspected an app-server-level stall rather than a specific Hermes Mobile command.
- Runtime diagnosis:
  - 8787 remained reachable and authenticated `/api/status` reported `ready=true`, endpoint `127.0.0.1:61382`, and `lastError=null`.
  - `%USERPROFILE%\.codex\app-server-mux\endpoint.json` still matched the 8787 status endpoint on port `61382`.
  - `Hermes 05-24` latest turn `019e5d61-e0ab-7bb2-b0e3-18fb784124f9` was still `inProgress`, but rollout writes had stopped at `2026-05-25 12:33:01 +08:00`.
  - A short recheck showed no rollout growth.
  - `/api/approvals` returned no pending requests.
  - mux/app-server/8787 processes were responsive with near-idle CPU.
  - The latest visible command in the turn was already `completed`; the last item was a `contextCompaction` marker. This was not a still-running PowerShell command.
- Immediate recovery:
  - Called authenticated `POST /api/threads/019e5913-951c-7d52-a12b-654f42279de0/turns/019e5d61-e0ab-7bb2-b0e3-18fb784124f9/interrupt`.
  - The thread returned to `idle`; latest turn became `interrupted`.
  - Post-interrupt `/api/status` remained healthy on endpoint `127.0.0.1:61382`.
- Code diagnosis:
  - The earlier stale-active-turn hotfix only treated a turn as stale after `CODEX_MOBILE_STALE_ACTIVE_TURN_MS` (default 180s) of rollout silence.
  - Today's failure often entered a fake-active state immediately after `contextCompaction` or a completed operation. During the first 180s, mobile submissions still used `turn/steer`; app-server could return success with the same turn id but not produce a durable user-message item, so the browser's temporary echo disappeared after detail reload.
- Local fix:
  - `adapters/active-turn-staleness-service.js` now recognizes a shorter terminal-idle stale state.
  - If the active turn has no pending item or server request and the latest visible item is `contextCompaction` or a completed command/tool/file/search operation, `CODEX_MOBILE_TERMINAL_IDLE_ACTIVE_TURN_MS` (default 45s) of rollout silence is enough to interrupt the fake-active turn before submission.
  - Long quiet turns still use the broader `CODEX_MOBILE_STALE_ACTIVE_TURN_MS` default 180s rule.
  - `server.js` passes both thresholds into the service before attempting `turn/steer`.
  - Added focused coverage for short quiet context-compaction fake-active turns and for avoiding short-threshold interruption after a normal assistant message.
- Validation:
  - `node --check adapters\active-turn-staleness-service.js` passed.
  - `node --check server.js` passed.
  - `node --test test\active-turn-staleness-service.test.js test\new-thread-route.test.js` passed: 13/13.
  - `npm.cmd test` passed: 144/144.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - Edited key files were checked for UTF-8 BOM; no BOM.
- Activation:
  - Restarted only the 8787 `server.js` Node listener to load the server-side route fix.
  - 8787 listener changed from PID `56692` to PID `61128`.
  - Post-restart `/api/public-config` returns `0.1.11|codex-mobile-shell-v83`.
  - Post-restart authenticated `/api/status` remains `ready=true`, endpoint `127.0.0.1:61382`, `lastError=null`.
- Status:
  - Local private workspace has uncommitted v82/v83 changes plus the stale-active-turn terminal-idle hotfix.
  - Public repository has not been synced or pushed for this terminal-idle hotfix.

## 2026-05-25 Superseded Active-Turn Preflight Follow-up

- User report:
  - The same "sent message is visible locally, then disappears after re-entering the thread" symptom recurred across two Mobile Web threads.
  - The user described both threads as previously healthy and then suddenly frozen.
- Runtime diagnosis:
  - 8787 and the shared mux were healthy: authenticated `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, endpoint `127.0.0.1:61382`, and `lastError=null`.
  - `%USERPROFILE%\.codex\app-server-mux\endpoint.json` still matched endpoint port `61382`.
  - `/api/approvals` returned no pending requests.
  - `Codex Mobile 05-24` showed a different fake-active shape: turn `019e5d60-7058-72d3-8ba2-0702fe2082fe` remained `inProgress`, but a newer turn `019e5d6e-d22d-7e80-b8a7-f7011938f264` had already completed after it.
  - This means the browser could keep submitting stale `activeTurnId` through `turn/steer`, even though durable thread history had already advanced past that active turn.
  - `Hermes 05-24` was `idle` at the time of this check; its last problematic turn was already `interrupted`.
- Code diagnosis:
  - The terminal-idle hotfix only treated the active turn as stale when it was the latest durable turn and had gone quiet.
  - If the submitted `activeTurnId` was no longer the latest turn, `detectStaleActiveTurnForSubmission()` returned `active-turn-not-latest` as non-stale.
  - That left the message route free to attempt `turn/steer` into an old active marker, which can create a transient mobile echo that disappears after reload.
- Local fix:
  - `adapters/active-turn-staleness-service.js` now treats an active turn as stale when it is present in recent turn history but superseded by newer durable turns.
  - If the active turn is missing from recent history, it is treated as stale only after the terminal-idle window, preserving a short grace period for newly started but not-yet-materialized active turns.
  - The preflight now asks `thread/turns/list` for the latest 20 turns instead of only the latest one, so it can see whether the browser's active turn has been superseded.
  - Existing safeguards remain: pending server requests and pending items still prevent interruption.
- Validation:
  - `node --check adapters\active-turn-staleness-service.js` passed.
  - `node --check server.js` passed.
  - `node --test test\active-turn-staleness-service.test.js test\new-thread-route.test.js` passed: 15/15.
  - `npm.cmd test` passed: 146/146.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - Edited key files were checked for UTF-8 BOM; no BOM.
- Activation:
  - Restarted only the 8787 `server.js` Node listener to load the server-side fix.
  - 8787 listener changed from PID `61128` to PID `8852`.
  - Post-restart `/api/public-config` returns `0.1.11|codex-mobile-shell-v83`.
  - Post-restart authenticated `/api/status` remains `ready=true`, endpoint `127.0.0.1:61382`, `lastError=null`.
- Status:
  - Local private workspace has uncommitted v82/v83 changes plus stale-active-turn hotfixes.
  - Public repository has not been synced or pushed for these stale-active-turn hotfixes.

## 2026-05-25 Latest Live Turn Steering v85

- User correction:
  - The user did not intentionally interrupt the Codex Mobile turn; they sent a guidance message.
  - The rollout still recorded `turn_aborted reason=interrupted` for the current Codex Mobile Web turn, which means Mobile Web/app-server state handling caused an automatic interrupt-like path.
- Diagnosis:
  - The terminal-idle active-turn preflight was too aggressive for the latest durable live turn.
  - It could treat a quiet latest live turn whose last visible item was a completed operation or context-compaction marker as stale, then call `turn/interrupt` before starting a new turn.
  - That is wrong for user guidance: guidance submitted while the latest durable turn is live should go through `turn/steer`, not silently interrupt the live turn.
  - A separate frontend issue could keep old `inProgress` turns sticky in active UI state after newer durable turns existed, so the composer/timer could look active even when the durable latest turn had moved on.
- Local fix:
  - `adapters/active-turn-staleness-service.js`
    - Latest durable live active turn is never auto-interrupted merely for rollout quietness or terminal-idle shape.
    - Such cases now return non-stale reasons `latest-live-terminal-idle`, `latest-live-rollout-quiet`, or `active-turn-latest-live`.
    - Superseded active turns remain stale when a newer durable turn exists.
    - Missing active turns are stale only after the terminal-idle grace window.
    - Pending server requests and pending items still prevent cleanup.
  - `public/app.js`
    - `syncActiveTurnFromThread()` only derives `state.activeTurnId` from the latest durable turn.
    - `currentLiveTurn()` only returns the latest durable live turn, or the latest turn matching the active id; it no longer scans older turns.
    - `mergeThreadPreservingVisibleItems()` drops superseded stale active turns instead of preserving old in-progress rows after newer durable turns exist.
    - Shell cache/build id bumped to `codex-mobile-shell-v85` / `0.1.11|codex-mobile-shell-v85`.
  - `public/sw.js` and `test/mobile-viewport.test.js` updated for v85.
  - `test/active-turn-staleness-service.test.js` now asserts latest quiet live active turns are not auto-interrupted.
  - `test/conversation-render.test.js` now asserts active UI state follows only the latest durable turn and that superseded stale turns are dropped during merge.
- Validation:
  - `node --check public\app.js` passed.
  - `node --check adapters\active-turn-staleness-service.js` passed.
  - Focused `node --test test\active-turn-staleness-service.test.js test\conversation-render.test.js test\mobile-viewport.test.js test\collab-agent-render.test.js` passed: 22/22.
  - `npm.cmd test` passed: 148/148.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
- Activation:
  - Restarted only the 8787 `server.js` Node listener.
  - 8787 listener changed from PID `8852` to PID `68712`.
  - Post-restart `/api/public-config` returns `version=0.1.11`, `clientBuildId=0.1.11|codex-mobile-shell-v85`, and `shellCacheName=codex-mobile-shell-v85`.
  - Post-restart authenticated `/api/status` remains `ready=true`, `transport=external-jsonl-tcp`, endpoint `127.0.0.1:61382`, and `lastError=null`.
- Status:
  - Local private workspace has uncommitted v82/v83/v84/v85 changes plus stale-active-turn hotfixes.
  - Public repository has not been synced or pushed for v84/v85 or the stale-active-turn hotfixes.
  - Mobile clients must refresh/hard-reopen the PWA to load the v85 frontend active-state fix; the server-side latest-live steering fix is active after the 8787 restart.

## 2026-05-25 Continuation Reasoning Effort Inheritance Finding

- User report:
  - A source thread configured with reasoning effort `medium` produced a continuation thread that started as `xhigh`.
- Read-only diagnosis:
  - `%USERPROFILE%\.codex\config.toml` currently has `model_reasoning_effort = "xhigh"`.
  - `/api/public-config` therefore exposes `defaultReasoningEffort: "xhigh"`.
  - Source rollout evidence can carry `turn_context.effort = "medium"` and `collaboration_mode.settings.reasoning_effort = "medium"`.
  - `state_5.sqlite.threads.reasoning_effort` can also contain a thread-level value, but current continuation runtime-setting resolution does not return it.
  - `threadRuntimeSettings()` currently returns approval/sandbox/summary/verbosity, but not reasoning effort.
  - `applyStartThreadRuntimeSettings()` and `applyTurnRuntimeSettings()` therefore cannot pass inherited effort into continuation `thread/start` or bootstrap `turn/start`.
- Assessment:
  - Current continuation threads fall back to app-server / Codex config default reasoning effort when the continuation code does not explicitly pass `effort`.
  - This explains a `medium` source thread becoming `xhigh` after continuation.
- Status:
  - No code change for this finding has been made yet in this publish cycle.
  - A future fix should read source `turn_context.effort` / `collaboration_mode.settings.reasoning_effort` / `state_5.sqlite.threads.reasoning_effort`, expose it in runtime settings, and pass it to continuation bootstrap `turn/start` where the app-server protocol supports `effort`.

## 2026-05-25 Public v85 Active Turn Stability Push

- User request:
  - Commit, push, and publish the accumulated Mobile Web fixes.
- Public repository:
  - Path: `C:\Users\xuxin\Documents\codex-mobile-web-public`.
  - Public pushed commit: `c35e981 发布移动端 active turn 稳定性与操作耗时显示`.
  - Synced product/test files from private for v84/v85 and stale active-turn handling, including:
    - `server.js`
    - `adapters/active-turn-staleness-service.js`
    - `public/app.js`
    - `public/styles.css`
    - `public/sw.js`
    - `package.json`
    - `test/active-turn-staleness-service.test.js`
    - `test/collab-agent-render.test.js`
    - `test/conversation-render.test.js`
    - `test/mobile-viewport.test.js`
    - `test/new-thread-route.test.js`
  - Public README gained a Chinese `2026-05-25 Public 发布说明（续）` documenting operation-duration display, rollout-derived operation timestamps, stale active-turn fallback, latest-live turn steering protection, latest-durable-turn active UI state, and PWA shell cache `codex-mobile-shell-v85`.
- Public validation:
  - Focused `node --test test\active-turn-staleness-service.test.js test\new-thread-route.test.js test\conversation-render.test.js test\collab-agent-render.test.js test\mobile-viewport.test.js` passed: 29/29.
  - `npm.cmd test` passed: 148/148.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` and `git diff --cached --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - Edited/staged public text files were checked for UTF-8 BOM; no BOM.
  - Staged public privacy scan found no added-line hits for private user paths, LAN/Tailscale markers, raw key markers, Web Push runtime files, `.agent-context`, upload runtime path, Hermes Mobile, Gateway, or local owner-key markers.
- Private status:
  - Private `README.md` was synced back from public so the new v85 public release note is present locally.
  - Private publish commit includes the v82/v83/v84/v85 product/test changes, `.agent-context` updates, the reasoning-effort inheritance finding above, and this handoff entry. Use `git log -1 --oneline --decorate` for the exact final private commit hash after the commit is written.
