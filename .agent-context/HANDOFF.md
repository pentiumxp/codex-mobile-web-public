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
