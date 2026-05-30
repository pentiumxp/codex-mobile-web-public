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

## 2026-05-25 Pending Active-Turn Steer Echo Hotfix

- User report:
  - In `Hermes 05-25`, a live turn appeared stuck after Gateway Pool recovery work.
  - The bottom visible card was not a command card; new mobile guidance appeared to send, but after leaving and re-entering the thread the sent user message was not visible until the long wait later resolved.
- Runtime evidence:
  - Codex Mobile `/api/status` remained healthy on mux endpoint `127.0.0.1:61382`, `lastError=null`, and no pending approvals were returned.
  - `Hermes 05-25` rollout showed the earlier Gateway Pool scheduled-task wait was a real long PowerShell wait, not an `rg` scan:
    - `17:32:46` to `17:40:51`, about 484 seconds.
    - `17:45:25` to `17:51:04`, about 339 seconds.
  - Later `rg` commands in the same Hermes thread resolved quickly in the rollout around `17:56:31`; a manual repeat of the matching `rg` query from `C:\Users\xuxin\Documents\Agent` took about 72ms.
  - After those tool outputs, the latest turn could still remain `inProgress` with no rollout growth and near-idle mux/app-server CPU, indicating a model/turn-finalization wait rather than a still-running local `rg.exe`.
- Diagnosis:
  - The v85 stale-active-turn fix covered stale/superseded active turn IDs and prevented auto-interrupting the latest durable live turn.
  - It did not cover the case where the latest durable live turn is genuinely waiting inside `turn/steer` while a long tool/model-finalization step is still unresolved.
  - During that wait, the browser may show only transient local feedback; a reload/re-enter can lose the visible user message until app-server later emits a durable `user_message`.
- Local fix:
  - Added `adapters/message-pending-echo-service.js`.
    - Maintains a bounded short-lived pending active-turn steer echo store.
    - Normalizes text/localImage input into a synthetic `mux-user-*` userMessage item.
    - Injects the pending userMessage into thread detail responses only if the app-server snapshot does not already contain a matching real user message.
    - Expires pending echoes after a short TTL and removes them on stale-active-turn fallthrough.
  - `server.js`
    - Creates `pendingSteerEchoStore`.
    - Existing-thread `/messages` remembers pending echo before awaiting `turn/steer`, so thread reloads can still show the just-submitted guidance while the RPC is waiting.
    - `compactThread()` injects pending steer echoes before timestamp enrichment and compaction.
    - If `turn/steer` fails as stale and the route falls through to `thread/resume` + `turn/start`, the pending echo is forgotten to avoid cross-turn duplicates.
  - `package.json`
    - `npm run check` now syntax-checks `adapters/message-pending-echo-service.js`.
  - Tests:
    - Added `test/message-pending-echo-service.test.js`.
    - Updated `test/new-thread-route.test.js` to assert pending echo is remembered before `turn/steer` can block and forgotten on stale fallthrough.
- Validation:
  - `node --check server.js` passed.
  - `node --check adapters\message-pending-echo-service.js` passed.
  - Focused `node --test test\message-pending-echo-service.test.js test\new-thread-route.test.js` passed: 11/11.
  - `npm.cmd test` passed: 152/152.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - BOM check passed for touched files.
- Status:
  - Local private workspace has uncommitted pending-echo changes.
  - Public repository has not been synced or pushed for this fix.
  - This is a server-side Mobile Web fix; no PWA shell cache bump is required.
  - Activated by restarting only the 8787 Node listener: old PID `68712`, new PID `63960`.
  - Post-restart `/api/public-config` remains `0.1.11|codex-mobile-shell-v85`; authenticated `/api/status` returned `ready=true`, endpoint `127.0.0.1:61382`, `lastError=null`.
  - It still does not make a genuinely stuck model/tool-finalization step complete; it only keeps mobile-submitted guidance visible across reload/re-entry while the active-turn steering request is pending.

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

## 2026-05-25 Raw Operation Cross-Turn Display Hotfix

- User report:
  - In `Hermes 05-25`, after a previous turn had been interrupted, the mobile UI showed a new `You` message and then a `Command running` card for an older `rg -n "context-assembly|conversation|history|compact|context"` command.
  - The screenshot showed the operation as running for about nine minutes even though the real `rg` commands in the rollout had already returned.
- Diagnosis:
  - Current `rg` is installed and resolves to `C:\Users\xuxin\.local\bin\rg.exe`, version `ripgrep 15.1.0`.
  - Recent Hermes rollout evidence showed the relevant `rg` commands returned quickly; a manual repeat of the matching query from `C:\Users\xuxin\Documents\Agent` took about 72ms.
  - The stale `Command running` card was a Mobile Web server-side fallback display bug, not a live `rg.exe` process.
  - `server.js` `readLatestRawOperation()` scanned rollout tail entries globally and could return the latest raw `function_call` as running without respecting the current latest live turn boundary or later `function_call_output` completion.
  - `compactThread()` then appended that stale raw operation to the latest live turn when the app-server snapshot did not contain an operation item.
- Local fix:
  - `server.js`
    - Raw operation fallback now tracks rollout turn boundaries from `turn_context` and `task_started` records.
    - Raw operation fallback records `callId` for function/custom/web/exec/patch operations when available.
    - Raw operation fallback tracks completion output records such as `function_call_output`, `custom_tool_call_output`, `exec_command_end`, `patch_apply_end`, and `web_search_end`.
    - `compactThread()` calls `readLatestRawOperation(out, latest.id)`, so only an unfinished raw operation from the same latest live turn can be appended.
    - Completed or cross-turn raw operations are ignored instead of being rendered as current running cards.
  - Tests:
    - `test/thread-item-timestamp-enrichment.test.js` now covers both:
      - not attaching a completed older-turn raw operation to a new live turn;
      - attaching an unfinished raw operation from the same live turn.
- Validation:
  - `node --check server.js` passed.
  - `node --check adapters\message-pending-echo-service.js` passed.
  - Focused `node --test test\thread-item-timestamp-enrichment.test.js test\message-pending-echo-service.test.js test\new-thread-route.test.js` passed: 17/17.
  - `npm.cmd test` passed: 154/154.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - BOM check passed for touched files.
- Activation:
  - Restarted only the 8787 Node listener after the raw-operation fix: old PID `63960`, new PID `73580`.
  - Post-restart `/api/public-config` remains `0.1.11|codex-mobile-shell-v85`; authenticated `/api/status` returned `ready=true`, endpoint `127.0.0.1:61382`, `lastError=null`.
  - Authenticated detail check of `Hermes 05-25` showed the latest live turn no longer had the stale `rg` operation attached; the latest operation in that turn was a real completed `fileChange`.
- Status:
  - Private commit `6551c8b 修正移动端 active turn 回显与旧命令显示` contains the pending-echo and raw-operation-display fixes and was pushed to private `origin/main`.
  - Public repository has not been synced or pushed for these two hotfixes.
  - No PWA shell cache bump is required for the raw-operation fallback because this is server-side detail-response behavior.

## 2026-05-25 Project Docs And Codex Mobile Web Skill

- User request:
  - Fill in project documentation from architecture design and module descriptions through troubleshooting and complex feature implementation paths.
  - Create a skill that constrains future agents to read the relevant project docs when needed.
- Documentation added:
  - `docs/README.md`
    - Reading guide, source-of-truth order, safety rules, and standard validation commands.
  - `docs/ARCHITECTURE.md`
    - Runtime process model, browser/server/app-server/mux boundaries, runtime state, request flows, PWA cache/build rules, message submission, SSE, uploads, continuation, Push, and invariants.
  - `docs/MODULES.md`
    - Root runtime files, adapter services, public frontend files, test map, ownership boundaries, and new-module rules.
  - `docs/TROUBLESHOOTING.md`
    - Live triage commands and evidence paths for mux drift, disappearing messages, stuck turns, stale command cards, `rg`, PWA cache mismatch, Push, image context growth, continuation runtime settings, and Hermes/ChatGPT Pro bridge checks.
  - `docs/COMPLEX_FEATURE_PATHS.md`
    - Implementation paths for active-turn/message submission, conversation rendering, rollout continuation, mux/Desktop live sync, PWA/service worker, Web Push, uploads, runtime settings inheritance, Hermes/ChatGPT Pro integration, and public/private publish.
  - `README.md`
    - Added a `Project Documentation` entry linking to the new docs.
- Skill created:
  - Local skill path: `C:\Users\xuxin\.codex\skills\codex-mobile-web-project`.
  - Skill frontmatter triggers on Codex Mobile Web workspace, architecture, modules, troubleshooting, app-server/mux, PWA/service worker, active-turn/message submission, continuation, Web Push, uploads, public/private publish, and non-trivial project work.
  - Skill workflow requires reading `.agent-context/PROJECT_CONTEXT.md`, `.agent-context/HANDOFF.md`, `docs/README.md`, then the smallest relevant project doc.
  - Follow-up update: the skill now treats documentation as part of the done criteria for behavior changes. Future feature/fix work should update the matching architecture, module, troubleshooting, complex-feature-path, README/public README, or handoff documentation when the change affects those areas.
  - Skill UI metadata was aligned so the default prompt says to read relevant docs before changes and update matching docs when project behavior changes.
  - Skill validation passed with `skill-creator` `quick_validate.py`.
- Validation:
  - `git diff --check` passed with only the existing Windows LF-to-CRLF working-copy warning on `README.md`.
  - BOM checks passed for README, all new docs, and the new skill files.
- Status:
  - Documentation changes are local and uncommitted.
  - The local skill is outside this repository and is not part of Git.
  - No runtime restart is required for documentation/skill-only changes.

## 2026-05-26 No-Final-Agent-Message Completion Push Guard

- User report:
  - In `Hermes 05-25`, an external Web Push said the turn ended, but opening the thread showed no normal final reply.
  - The next guidance turn correctly continued the implementation, so the issue was the previous turn being marked complete without a final assistant message.
- Runtime finding:
  - Target thread: `019e5e12-0141-7d93-9a7a-7d3ff3eda657` (`Hermes 05-25`).
  - Previous turn: `019e626a-6c0e-7a42-a5fa-c419eec07004`.
  - Rollout event at `2026-05-26T04:01:52.294Z` was `task_complete`, not `turn_aborted`, `interrupted`, timeout, or pending approval.
  - Its payload had `last_agent_message: null`; other normal `task_complete` records in the same rollout had a final agent message.
  - Therefore the app-server/runtime emitted a terminal completion without final assistant reply, and Mobile Web treated the corresponding completion as a normal turn-ended Push.
- Local fix:
  - `adapters/push-notification-service.js` adds `completedTurnHasNoFinalAgentMessage()`, recognizing explicit missing final-message fields such as `last_agent_message: null`.
  - `server.js` now suppresses normal turn-completed Web Push when the completed notification payload explicitly indicates no final assistant message, logging reason `no-final-agent-message`.
  - `test/push-notification-service.test.js` covers explicit no-final-message detection while leaving unknown/missing fields as normal unknown rather than suppressing all completions.
  - `docs/ARCHITECTURE.md` and `docs/TROUBLESHOOTING.md` document the no-final-message completion-push guard and diagnosis path.
- Validation:
  - `node --check adapters\push-notification-service.js` passed.
  - `node --check server.js` passed.
  - `node --test test\push-notification-service.test.js` passed: 10/10.
  - `npm.cmd test` passed: 155/155.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - BOM checks passed for touched source, test, docs, and handoff files.
- Activation:
  - Restarted only the 8787 Node listener after the server-side Push guard: old PID `73580`, new PID `55456`.
  - Post-restart `/api/public-config` remains `0.1.11|codex-mobile-shell-v85`.
  - Authenticated `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, endpoint `127.0.0.1:61382`, and `lastError=null`.
- Status:
  - Local code/docs changes are uncommitted.
  - This is server-side Push behavior; no PWA shell cache bump is required.

## 2026-05-26 Context And Continuation Strategy v86

- User request:
  - Turn the context strategy and compression-continuation strategy into project documentation, fold it into the prior documentation rules, and implement the new policy.
  - The immediate driver was evidence that Hermes Mobile threads still reached 100k+ input tokens because image uploads were retained in app-server `replacement_history` despite the earlier extended-history mitigation.
- Diagnosis carried into the implementation:
  - The v78 mitigation only stopped Mobile Web from requesting app-server `persistExtendedHistory` for image-upload turns.
  - `server.js` still sent every uploaded image as an app-server `localImage` input part, so app-server could still put `input_image` payloads into current history and compacted `replacement_history`.
  - Continuation bootstrap also remained too large: defaults allowed a 120k inline bootstrap, full-ish source handoff text, 52k workspace handoff tail, and 5k per visible item summary.
- Local fix:
  - `adapters/message-input-service.js` now owns image context policy:
    - default `CODEX_MOBILE_IMAGE_CONTEXT_MODE=reference` sends no app-server `localImage` parts;
    - `latest` / `vision` sends only the latest uploaded image;
    - `all` restores legacy all-image behavior.
  - `server.js` now builds turn input through that policy. Uploaded images are still summarized by local path in message text, but image pixels are not sent to the model by default.
  - `/api/public-config` now exposes `imageContextMode` for runtime diagnosis.
  - Continuation bootstrap defaults were tightened:
    - `CODEX_MOBILE_CONTINUATION_BOOTSTRAP_CHARS=52000`;
    - source handoff excerpt `12000`;
    - workspace project context excerpt `18000`;
    - workspace handoff tail `18000`;
    - per-item summary `1200`;
    - non-user items per recent turn `4`;
    - lineage max `12000`.
  - `sourceHandoffSection()` now lists the full source handoff file path and includes only a bounded excerpt, so future continuation threads should read the handoff file rather than inheriting a large inline copy.
  - Added `docs/CONTEXT_STRATEGY.md` and linked it from `docs/README.md`.
  - Updated `docs/ARCHITECTURE.md`, `docs/MODULES.md`, `docs/TROUBLESHOOTING.md`, `docs/COMPLEX_FEATURE_PATHS.md`, `.agent-context/PROJECT_CONTEXT.md`, and the local skill `C:\Users\xuxin\.codex\skills\codex-mobile-web-project\SKILL.md` to make context-size and continuation-size docs part of the doc-update rule.
- Validation:
  - `node --check adapters\message-input-service.js` passed.
  - `node --check server.js` passed.
  - Focused `node --test test\message-input-service.test.js test\continuation-lineage.test.js` passed: 10/10.
  - `npm.cmd test` passed: 158/158.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - BOM checks passed for touched source, tests, docs, project context, and the local skill file.
- Activation:
  - Restarted only the 8787 Node listener to load the server-side image-context policy: old PID `55456`, new PID `47440`.
  - Post-restart `/api/public-config` returns `version=0.1.11`, `clientBuildId=0.1.11|codex-mobile-shell-v85`, `shellCacheName=codex-mobile-shell-v85`, and `imageContextMode=reference`.
  - Post-restart authenticated `/api/status` remains `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, and `lastError=null`.
- Status:
  - Local code/docs/skill changes are uncommitted.
  - This is a server-side input/continuation-policy fix plus docs; no PWA shell cache bump is required.
  - Existing oversized/polluted app-server threads are not shrunk by this change. They need a fresh continuation after the new policy is active; old rollout records and in-memory `replacement_history` are not rewritten.

## 2026-05-26 Uploaded Image Thumbnail Display v86

- User feedback:
  - The reference-only image context policy is correct for model history, but showing only an uploaded image path in the conversation is awkward for users.
- Local fix:
  - `public/app.js`
    - Keeps `CODEX_MOBILE_IMAGE_CONTEXT_MODE=reference` behavior unchanged for model input.
    - `renderInputContent()` now parses `Uploaded attachments` image summaries and renders saved absolute upload paths as centered thumbnails even when there are no app-server `localImage` parts.
    - Browser-local filename-only attachment rows are left as compact attachment rows instead of rendering broken images.
  - `public/sw.js` / `public/app.js` shell cache/build id bumped to `codex-mobile-shell-v86` / `0.1.11|codex-mobile-shell-v86`.
  - `README.md`, `docs/CONTEXT_STRATEGY.md`, `docs/ARCHITECTURE.md`, `docs/COMPLEX_FEATURE_PATHS.md`, and `.agent-context/PROJECT_CONTEXT.md` now explicitly separate model context policy from user-visible image thumbnail rendering.
  - `test/file-preview-ui.test.js` and `test/mobile-viewport.test.js` cover the thumbnail rendering path and v86 shell cache.
- Validation:
  - Focused `node --test test\file-preview-ui.test.js test\mobile-viewport.test.js` passed: 4/4.
  - `node --check public\app.js` passed.
  - `node --check public\sw.js` passed.
  - `npm.cmd test` passed: 158/158.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - BOM checks passed for touched source, tests, docs, and project context files.
- Activation:
  - Static frontend/PWA change; no Node listener restart required.
  - `GET http://127.0.0.1:8787/api/public-config` now returns `clientBuildId=0.1.11|codex-mobile-shell-v86`, `shellCacheName=codex-mobile-shell-v86`, and `imageContextMode=reference`.
- Status:
  - Local changes are uncommitted.
  - Mobile clients need the refresh prompt, hard refresh, or PWA close/reopen to load v86.

## 2026-05-26 Public v86 Context And Thumbnail Push

- User request:
  - Commit and push the current v86 changes, including the public repository.
- Public repository:
  - Path: `C:\Users\xuxin\Documents\codex-mobile-web-public`.
  - Synced public-safe product/docs/test files from private:
    - `server.js`, `package.json`;
    - `public/app.js`, `public/sw.js`;
    - `adapters/message-input-service.js`, `adapters/message-pending-echo-service.js`, `adapters/push-notification-service.js`;
    - `test/continuation-lineage.test.js`, `test/file-preview-ui.test.js`, `test/message-input-service.test.js`, `test/message-pending-echo-service.test.js`, `test/mobile-viewport.test.js`, `test/push-notification-service.test.js`;
    - `docs/README.md`, `docs/ARCHITECTURE.md`, `docs/MODULES.md`, `docs/TROUBLESHOOTING.md`, `docs/COMPLEX_FEATURE_PATHS.md`, `docs/CONTEXT_STRATEGY.md`;
    - `README.md`.
  - Public README gained Chinese `2026-05-26 Public 发布说明` documenting:
    - default reference-only image model context;
    - `CODEX_MOBILE_IMAGE_CONTEXT_MODE=latest|vision|all` opt-ins;
    - mobile thumbnail rendering from saved uploaded-image paths without re-enabling `localImage`;
    - bounded file-first continuation bootstrap strategy;
    - new project docs and context strategy docs;
    - no-final-agent-message Web Push guard;
    - PWA shell cache `codex-mobile-shell-v86`.
  - Public docs were sanitized to avoid local Hermes/Gateway deployment diagnostics; public staged privacy scan found no private user path, Hermes/Gateway marker, Tailscale/LAN marker, raw key marker, Web Push runtime secret-file marker, or upload runtime path.
  - Public pushed commit: `faf8cfc 发布图片上下文与续接启动策略收紧`.
- Public validation:
  - Focused `node --test test\file-preview-ui.test.js test\mobile-viewport.test.js test\message-input-service.test.js test\message-pending-echo-service.test.js test\continuation-lineage.test.js test\push-notification-service.test.js` passed: 28/28.
  - `npm.cmd test` passed: 156/156.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --cached --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - BOM checks passed for touched public source, tests, docs, and README files.
- Private status:
  - Private workspace still needs the local v86 thumbnail/docs/handoff commit and push after this handoff entry.

## 2026-05-26 Markdown File Preview Line-Suffix Fix

- User report:
  - Markdown documents showed a Mobile Web preview action, but clicking preview returned an unsupported-preview message.
- Diagnosis:
  - The frontend Markdown renderer correctly renders local file links as in-page preview actions.
  - Codex-style local source links can include location suffixes such as `README.md:12`, `README.md:12:3`, or `README.md#L12`.
  - `server.js` previously passed that full target into extension detection, so a Markdown file could look like extension `.md:12` and be rejected as unsupported.
- Local fix:
  - `server.js` `stripMarkdownFileTarget()` now strips common source-location suffixes before preview extension detection, stat lookup, allowed-root validation, and public field generation.
  - The existing root checks, sensitive-path denylist, extension allowlist, and size limits remain unchanged.
  - `test/file-preview.test.js` covers suffix stripping and previewing a Markdown file target with `:line`.
  - `docs/ARCHITECTURE.md`, `docs/TROUBLESHOOTING.md`, `docs/COMPLEX_FEATURE_PATHS.md`, and `.agent-context/PROJECT_CONTEXT.md` document the line-suffix preview rule.
- Validation:
  - `node --test test\file-preview.test.js test\file-preview-ui.test.js test\markdown-render.test.js` passed: 20/20.
  - `node --check server.js` passed.
  - `npm.cmd test` passed: 159/159.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
- Status:
  - Local changes are uncommitted.
  - This is a server-side file-preview route fix; no PWA shell cache bump is required, but the 8787 Node listener must be restarted for the currently running service to use it.

## 2026-05-26 Local File Preview UI v87

- User feedback:
  - After Markdown preview started working, local file links still showed an extra "preview file" helper suffix even though the path was already styled as a clickable preview target.
  - The preview dialog could be dragged horizontally; the desired behavior is viewport-bounded width without horizontal scrolling.
- Local fix:
  - `public/markdown-renderer.js` now renders local-file preview actions as only the linked path label, without the extra helper `<span>`.
  - `public/styles.css` bounds `.file-preview-panel` to `min(980px, calc(100vw - 36px))`, hides horizontal overflow in the preview body, and wraps Markdown code blocks/tables inside file preview.
  - Static shell cache/build id bumped to `codex-mobile-shell-v87` / `0.1.11|codex-mobile-shell-v87`.
  - `test/markdown-render.test.js`, `test/file-preview-ui.test.js`, and `test/mobile-viewport.test.js` cover the label removal, no-horizontal-preview CSS, and v87 cache.
  - `docs/ARCHITECTURE.md`, `docs/COMPLEX_FEATURE_PATHS.md`, and `.agent-context/PROJECT_CONTEXT.md` document the local-file preview UI rule.
- Validation:
  - Focused `node --test test\markdown-render.test.js test\file-preview-ui.test.js test\mobile-viewport.test.js` passed: 15/15.
  - `node --check public\markdown-renderer.js`, `node --check public\app.js`, and `node --check public\sw.js` passed.
  - `npm.cmd test` passed: 159/159.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
- Status:
  - Local changes are uncommitted.
  - This is a static frontend/PWA shell change; no Node listener restart is required, but mobile clients must accept the refresh prompt, hard refresh, or close/reopen the PWA to load v87.

## 2026-05-26 Local File Preview Wrapping v88

- User feedback:
  - The preview panel width was bounded, but long preview content still did not fit; it should wrap instead of being clipped or requiring horizontal dragging.
- Local fix:
  - `public/styles.css`
    - `.local-file-preview-link` now uses `inline-block` plus `white-space: normal`, `overflow-wrap: anywhere`, and `word-break: break-word`, so long local paths wrap inside the message card.
    - File-preview Markdown content now forces `min-width: 0` / `max-width: 100%` on Markdown blocks, code blocks, and table wrappers.
    - File-preview code blocks and code content now use `pre-wrap` and aggressive word breaking inside the bounded preview width.
  - `public/app.js` / `public/sw.js` bumped the shell build/cache to `codex-mobile-shell-v88` / `0.1.11|codex-mobile-shell-v88`.
  - `test/file-preview-ui.test.js` and `test/mobile-viewport.test.js` cover the wrapping CSS and v88 cache.
  - `docs/ARCHITECTURE.md` and `.agent-context/PROJECT_CONTEXT.md` now explicitly state that local preview links must wrap long paths.
- Validation:
  - Focused `node --test test\markdown-render.test.js test\file-preview-ui.test.js test\mobile-viewport.test.js` passed: 15/15.
  - `node --check public\markdown-renderer.js`, `node --check public\app.js`, and `node --check public\sw.js` passed.
  - `npm.cmd test` passed: 159/159.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
- Status:
  - Local changes are uncommitted.
  - This is a static frontend/PWA shell change; no Node listener restart is required, but mobile clients must accept the refresh prompt, hard refresh, or close/reopen the PWA to load v88.

## 2026-05-26 File Preview Right-Swipe Close v89

- User feedback:
  - While inside the file preview dialog, right swipe should exit the preview. Instead, the gesture propagated to the underlying page and caused the parent conversation/page to exit.
- Local fix:
  - `public/app.js`
    - Added preview-layer touch gesture state and handlers: `beginFilePreviewSwipe()`, `moveFilePreviewSwipe()`, `finishFilePreviewSwipe()`, and `cancelFilePreviewSwipe()`.
    - The preview dialog now captures touch start/move/end while open. Horizontal right swipes prevent default behavior and close the preview; vertical movement is left available for preview scrolling.
    - The preview gesture stops propagation so sidebar/conversation navigation does not receive the same swipe.
    - `closeFilePreview()` clears preview swipe state.
  - `public/app.js` / `public/sw.js` bumped the shell build/cache to `codex-mobile-shell-v89` / `0.1.11|codex-mobile-shell-v89`.
  - `test/file-preview-ui.test.js` and `test/mobile-viewport.test.js` cover the preview swipe wiring and v89 cache.
  - `docs/ARCHITECTURE.md`, `docs/COMPLEX_FEATURE_PATHS.md`, and `.agent-context/PROJECT_CONTEXT.md` document that preview-layer right swipes close the preview instead of propagating to the underlying page.
- Validation:
  - Focused `node --test test\markdown-render.test.js test\file-preview-ui.test.js test\mobile-viewport.test.js` passed: 15/15.
  - `node --check public\app.js` and `node --check public\sw.js` passed.
  - `npm.cmd test` passed: 159/159.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
- Status:
  - Local changes are uncommitted.
  - This is a static frontend/PWA shell change; no Node listener restart is required, but mobile clients must accept the refresh prompt, hard refresh, or close/reopen the PWA to load v89.

## 2026-05-26 Quoted Uploaded Image Thumbnail v90

- User report:
  - The user's own uploaded image message rendered as a thumbnail, but when Codex quoted/re-emitted the same `Uploaded attachments:` block in a reply, it displayed as raw text/path again.
- Diagnosis:
  - `renderInputContent()` parsed `Uploaded attachments:` summaries only for `userMessage` items.
  - `agentMessage` and `plan` items went directly through `renderMarkdown()`, so quoted uploaded-image summaries stayed plain Markdown/text.
- Local fix:
  - `public/app.js`
    - Added reusable `renderAttachmentSummary()`.
    - `renderInputContent()` now uses that shared renderer for user uploads.
    - Added `renderMarkdownWithAttachmentSummary()`, used by `agentMessage` and `plan`, so Codex/plan replies that quote an `Uploaded attachments:` block render saved image paths as the same centered thumbnails.
    - `splitAttachmentSummaryText()` now preserves ordinary text after the attachment lines instead of dropping it.
  - `public/app.js` / `public/sw.js` bumped the shell build/cache to `codex-mobile-shell-v90` / `0.1.11|codex-mobile-shell-v90`.
  - `test/conversation-render.test.js` covers Codex/plan attachment-summary thumbnail routing and preserving trailing text.
  - `docs/ARCHITECTURE.md`, `docs/CONTEXT_STRATEGY.md`, `docs/COMPLEX_FEATURE_PATHS.md`, `README.md`, and `.agent-context/PROJECT_CONTEXT.md` now state that uploaded-image thumbnail rendering applies to quoted `Uploaded attachments:` summaries in Codex/plan replies too.
- Validation:
  - Focused `node --test test\conversation-render.test.js test\file-preview-ui.test.js test\mobile-viewport.test.js` passed: 13/13.
  - `node --check public\app.js` and `node --check public\sw.js` passed.
  - `npm.cmd test` passed: 160/160.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
- Status:
  - Local changes are uncommitted.
  - This is a static frontend/PWA shell change; no Node listener restart is required, but mobile clients must accept the refresh prompt, hard refresh, or close/reopen the PWA to load v90.

## 2026-05-26 CodeGraph Initialization

- User request:
  - Initialize CodeGraph for this `codex-mobile-web` workspace.
- Local setup:
  - Ran `codegraph init -i` from `C:\Users\xuxin\Documents\codex-mobile-web`.
  - Created local `.codegraph/` index data; root `.gitignore` now ignores `.codegraph/` so the SQLite index stays local and is not offered for commit.
  - `.agent-context/PROJECT_CONTEXT.md` records that CodeGraph MCP calls may need `projectPath: "C:\\Users\\xuxin\\Documents\\codex-mobile-web"` when workspace auto-detection fails.
- Verification:
  - `mcp__codegraph__.codegraph_status` with explicit `projectPath` succeeds.
  - Current index reports 54 files, 1540 nodes, 4809 edges, and a 3.96 MB database.
- Status:
  - No product code changed for this setup step.
  - Pre-existing v87-v90 product/docs/test changes remain uncommitted.

## 2026-05-26 Private v90 File Preview And Thumbnail Push

- User request:
  - Commit and push the previous private fix without an explicit public publish request.
- Scope:
  - Committed only the staged private v87-v90 product/docs/test changes.
  - Left the later CodeGraph setup changes local and uncommitted: `.gitignore`, plus the CodeGraph notes in `.agent-context/PROJECT_CONTEXT.md` and this handoff.
  - Public repository was not touched.
- Validation before commit:
  - `npm.cmd test` passed: 160/160.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --cached --check` passed.
  - BOM check for staged files produced no output.
- Commit:
  - Private pushed commit: `6531dbf 修正文件预览与上传图片缩略图显示`.
- Status:
  - Private `origin/main` now includes the v87-v90 file preview and quoted uploaded-image thumbnail fixes.
  - Local working tree still has uncommitted CodeGraph setup context/ignore changes.

## 2026-05-26 Quoted Uploaded Image CRLF Fix v91

- User report:
  - A newly uploaded image rendered in the original message, but when Codex Mobile quoted the same `Uploaded attachments:` block the image thumbnail did not appear.
  - Example path existed under `%USERPROFILE%\.codex-mobile-web\uploads\2026-05-26\...`.
- Diagnosis:
  - The uploaded file existed and authenticated `/api/uploads/file?path=...` returned HTTP 200.
  - The frontend parser only looked for exact `Uploaded attachments:\n`, so quoted summaries with CRLF line endings or Markdown blockquote-style prefixes were not parsed as attachments.
- Local fix:
  - `public/app.js`
    - Added line-based `attachmentSummaryMarkerMatch()` and `stripAttachmentSummaryLinePrefix()`.
    - `splitAttachmentSummaryText()` now recognizes LF, CRLF, and quoted lines such as `> Uploaded attachments:` / `> - IMG_0001.jpg (...)`.
    - Attachment paths are trimmed after parsing.
    - `CLIENT_BUILD_ID` bumped to `0.1.11|codex-mobile-shell-v91`.
  - `public/sw.js` bumped to `codex-mobile-shell-v91`.
  - `test/conversation-render.test.js` now functionally covers the reported `IMG_5430.jpg` summary shape with CRLF and blockquote quoting.
  - `test/mobile-viewport.test.js`, `README.md`, `docs/ARCHITECTURE.md`, `docs/CONTEXT_STRATEGY.md`, `docs/COMPLEX_FEATURE_PATHS.md`, `docs/TROUBLESHOOTING.md`, and `.agent-context/PROJECT_CONTEXT.md` were updated for the v91 rule.
- Validation:
  - Focused `node --test test\conversation-render.test.js test\mobile-viewport.test.js` passed: 13/13.
  - `node --check public\app.js` passed.
  - `node --check public\sw.js` passed.
  - `npm.cmd run check` passed.
  - `npm.cmd test` passed: 161/161.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - `/api/public-config` returns `clientBuildId=0.1.11|codex-mobile-shell-v91`, `shellCacheName=codex-mobile-shell-v91`, and `imageContextMode=reference`.
- Status:
  - Local changes are uncommitted.
  - Static frontend/PWA change; no Node listener restart is required, but mobile clients must accept the refresh prompt, hard refresh, or close/reopen the PWA to load v91.

## 2026-05-27 Raw App-Server Uploaded Image Part Fix v92

- User report:
  - A Hermes/bridge target thread still showed an uploaded-image `Uploaded attachments:` message as raw text/path even after the v91 CRLF and Markdown blockquote parser fix.
- Diagnosis:
  - The current `Hermes 05-26` target thread detail contained a recent `userMessage` item with `Uploaded attachments:` and a saved upload path under `%USERPROFILE%\.codex-mobile-web\uploads\2026-05-27\...`.
  - Running the exact target item through the current renderer produced `<figure class="input-image">`, so the persisted thread detail path was valid.
  - The remaining gap was live/bridge raw app-server content parts: `renderInputContent()` and `inputContentSignature()` only treated `type: "text"` as text, while raw app-server payloads can use `input_text`; image parts can also arrive as `input_image` or object-shaped `image_url.url`.
- Local fix:
  - `public/app.js`
    - Added `imageUrlValue()`, `isInputTextPart()`, and `inputTextValue()`.
    - `renderInputContent()` and `inputContentSignature()` now treat `text` and `input_text` as text for uploaded-attachment parsing and render signatures.
    - `isInputImagePart()` now recognizes `input_image`, `image_url`, and object-shaped `image_url.url`, while keeping existing `image`, `localImage`, data URL, and truncated payload handling.
    - `imageSourceForPart()` and `renderInputImage()` now avoid stringifying `{ image_url: { url } }` as `[object Object]`.
    - `CLIENT_BUILD_ID` bumped to `0.1.11|codex-mobile-shell-v92`.
  - `public/sw.js` bumped to `codex-mobile-shell-v92`.
  - `test/conversation-render.test.js` now functionally covers raw `input_text` uploaded summaries and raw `input_image` object `image_url.url`.
  - `test/mobile-viewport.test.js`, `README.md`, `docs/ARCHITECTURE.md`, `docs/CONTEXT_STRATEGY.md`, `docs/COMPLEX_FEATURE_PATHS.md`, `docs/TROUBLESHOOTING.md`, and `.agent-context/PROJECT_CONTEXT.md` document the v92 rule.
- Validation:
  - Focused `node --test test\conversation-render.test.js test\mobile-viewport.test.js` passed: 15/15.
  - `node --check public\app.js` and `node --check public\sw.js` passed.
  - Private `npm.cmd test` passed: 163/163.
  - Private `npm.cmd run check` passed.
  - Private `npm.cmd run check:macos` passed.
  - Private `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - BOM checks for touched private files produced no output.
  - `/api/public-config` returns `clientBuildId=0.1.11|codex-mobile-shell-v92`, `shellCacheName=codex-mobile-shell-v92`, and `imageContextMode=reference`.
- Public release:
  - Synced public-safe v92 frontend, docs, README, and tests to `C:\Users\xuxin\Documents\codex-mobile-web-public`.
  - Public validation passed: `npm.cmd test` 161/161, `npm.cmd run check`, `npm.cmd run check:macos`, `git diff --cached --check`, BOM check, and staged privacy scan.
  - Public pushed commit: `f260bb7 发布实时引用图片兼容修正`.
- Status:
  - This is a static frontend/PWA change; no Node listener restart is required.
  - Mobile clients must accept the refresh prompt, hard refresh, or close/reopen the PWA to load `codex-mobile-shell-v92`.

## 2026-05-27 Turn Up-Arrow Final Receipt Target v93

- User request:
  - The current-turn upward arrow should jump to the turn's final receipt/summary rather than the first assistant reply, because the summary is the main content the user wants to review.
- Local fix:
  - `public/app.js`
    - Replaced the first-reply target helper with `turnFinalReceiptNode()`.
    - The upward arrow now targets the last `.item.agentMessage` or `.item.plan` in the anchored current live/recently completed turn.
    - If no agent/plan receipt exists, it falls back to the last non-user, non-live-operation item, then the turn container.
    - `CLIENT_BUILD_ID` bumped to `0.1.11|codex-mobile-shell-v93`.
  - `public/index.html`
    - Updated the upward arrow accessible label/title from "回到本轮回复" to "回到本轮总结".
  - `public/sw.js`
    - Shell cache bumped to `codex-mobile-shell-v93`.
  - `test/turn-scroll-controls.test.js` and `test/mobile-viewport.test.js` cover the final-receipt target and v93 cache.
  - `README.md`, `docs/ARCHITECTURE.md`, `docs/COMPLEX_FEATURE_PATHS.md`, and `.agent-context/PROJECT_CONTEXT.md` document that the up-arrow target is final receipt/summary, not answer start.
- Validation:
  - Focused `node --test test\turn-scroll-controls.test.js test\mobile-viewport.test.js` passed: 7/7.
  - `node --check public\app.js` and `node --check public\sw.js` passed.
  - `npm.cmd test` passed: 163/163.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - BOM check for touched files produced no output.
  - `/api/public-config` returns `clientBuildId=0.1.11|codex-mobile-shell-v93`, `shellCacheName=codex-mobile-shell-v93`, and `imageContextMode=reference`.
- Status:
  - Local changes are uncommitted.
  - Public repository was not touched because this turn did not request publish/public sync.
  - This is a static frontend/PWA change; no Node listener restart is required, but mobile clients must accept the refresh prompt, hard refresh, or close/reopen the PWA to load `codex-mobile-shell-v93`.

## 2026-05-27 Turn Up-Arrow Visibility Fix v94

- User report:
  - After the final receipt/summary appears, the current-turn upward arrow sometimes does not show.
- Diagnosis:
  - If the user had already scrolled upward during live output, `turn/completed` called `rememberRecentCompletedTurnReply()` and overwrote the already activated current-turn anchor with `activatedByUserScroll=false`, so the button could disappear exactly when the final receipt arrived.
  - The button visibility check also required the whole target item to be above the viewport. Long final receipt/summary items can have their start above the viewport while their bottom still extends into view, so the old check could hide the jump even though clicking it would move to the desired summary start.
- Local fix:
  - `public/app.js`
    - `rememberRecentCompletedTurnReply()` now preserves `activatedByUserScroll` when the existing anchor is for the same thread and turn.
    - Replaced the whole-node-above check with `isNodeStartAboveConversationViewport()`, so the up-arrow appears when the target summary/receipt start is above the viewport.
    - `CLIENT_BUILD_ID` bumped to `0.1.11|codex-mobile-shell-v94`.
  - `public/sw.js`
    - Shell cache bumped to `codex-mobile-shell-v94`.
  - `test/turn-scroll-controls.test.js` and `test/mobile-viewport.test.js` cover the preserved activation path, target-start visibility check, and v94 cache.
  - `README.md`, `docs/ARCHITECTURE.md`, `docs/COMPLEX_FEATURE_PATHS.md`, and `.agent-context/PROJECT_CONTEXT.md` document the v94 up-arrow visibility rule.
- Validation:
  - Focused `node --test test\turn-scroll-controls.test.js test\mobile-viewport.test.js` passed: 7/7.
  - `node --check public\app.js` and `node --check public\sw.js` passed.
  - `npm.cmd test` passed: 163/163.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - BOM check for touched files produced no output.
  - `/api/public-config` returns `clientBuildId=0.1.11|codex-mobile-shell-v94`, `shellCacheName=codex-mobile-shell-v94`, and `imageContextMode=reference`.
- Status:
  - Local changes are uncommitted.
  - Public repository remains untouched and clean because this turn did not request publish/public sync.
  - This is a static frontend/PWA change; no Node listener restart is required, but mobile clients must accept the refresh prompt, hard refresh, or close/reopen the PWA to load `codex-mobile-shell-v94`.

## 2026-05-27 Reading Hold For Final Receipt Scroll v95

- User report:
  - When a long final receipt/summary refreshes, the conversation can keep scrolling downward while the user is reading. Manual dragging may not take effect because the UI continues forcing bottom scroll.
- Diagnosis:
  - The previous live-output hold was set only from a real scroll event outside the programmatic bottom-scroll window.
  - During long final output/final refresh, programmatic bottom-scroll could still be active while the user tried to drag, so `updateConversationAutoScrollHoldFromScroll()` returned before setting a hold. Later render passes still saw a bottom-follow or near-bottom state and kept scrolling down.
- Local fix:
  - `public/app.js`
    - Added `CONVERSATION_SCROLL_INTENT_MS` and `hasRecentConversationScrollIntent()`.
    - Added `turnForConversationAutoScrollHold()` and `isUserReadingCurrentTurn()`.
    - `renderCurrentThread()` now computes the current near-bottom state once and blocks render-time stick-to-bottom when the user is reading the current live or recently completed turn.
    - `shouldFollowSubmittedMessageToBottom()` and `shouldFollowViewportChangeToBottom()` now cancel their follow state when the user-reading hold is active.
    - `updateConversationAutoScrollHoldFromScroll()` now sets the hold whenever recent user scroll intent moved the conversation away from bottom, even if a programmatic bottom-scroll window is still active. The hold can apply to the live turn or the recent completed turn so final receipt refreshes stop pulling the viewport down.
    - `CLIENT_BUILD_ID` bumped to `0.1.11|codex-mobile-shell-v95`.
  - `public/sw.js`
    - Shell cache bumped to `codex-mobile-shell-v95`.
  - `test/turn-scroll-controls.test.js` and `test/mobile-viewport.test.js` cover the reading-hold guard and v95 cache.
  - `README.md`, `docs/ARCHITECTURE.md`, `docs/COMPLEX_FEATURE_PATHS.md`, and `.agent-context/PROJECT_CONTEXT.md` document that live/final output must stop auto-scrolling while the user is reading.
- Validation:
  - Focused `node --test test\turn-scroll-controls.test.js test\mobile-viewport.test.js` passed: 7/7.
  - `node --check public\app.js` and `node --check public\sw.js` passed.
  - `npm.cmd test` passed: 163/163.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - BOM check for touched files produced no output.
  - `/api/public-config` returns `clientBuildId=0.1.11|codex-mobile-shell-v95`, `shellCacheName=codex-mobile-shell-v95`, and `imageContextMode=reference`.
- Status:
  - Local changes are uncommitted.
  - Public repository remains untouched and clean because this turn did not request publish/public sync.
  - This is a static frontend/PWA change; no Node listener restart is required, but mobile clients must accept the refresh prompt, hard refresh, or close/reopen the PWA to load `codex-mobile-shell-v95`.

## 2026-05-27 Four-Line Operation Card v96

- User request:
  - Change the command/operation card from three visual lines to four visual lines.
- Local fix:
  - `public/styles.css`
    - `.operation-detail` now clamps to three detail lines with `-webkit-line-clamp: 3` and `max-height: calc(1.26em * 3)`.
    - The total compact operation card budget is now one metadata/status row plus up to three detail lines.
  - `public/app.js`
    - `CLIENT_BUILD_ID` bumped to `0.1.11|codex-mobile-shell-v96`.
  - `public/sw.js`
    - Shell cache bumped to `codex-mobile-shell-v96`.
  - `test/collab-agent-render.test.js` and `test/mobile-viewport.test.js` cover the four-line card CSS and v96 cache.
  - `README.md`, `docs/ARCHITECTURE.md`, `docs/COMPLEX_FEATURE_PATHS.md`, and `.agent-context/PROJECT_CONTEXT.md` document the current four-line operation-card rule.
- Validation:
  - Focused `node --test test\collab-agent-render.test.js test\mobile-viewport.test.js` passed: 6/6.
  - `node --check public\app.js` and `node --check public\sw.js` passed.
  - `npm.cmd test` passed: 163/163.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - BOM check for touched files produced no output.
  - `/api/public-config` returns `clientBuildId=0.1.11|codex-mobile-shell-v96`, `shellCacheName=codex-mobile-shell-v96`, and `imageContextMode=reference`.
- Status:
  - Local changes are uncommitted.
  - Public repository remains untouched because this turn did not request publish/public sync.
  - This is a static frontend/PWA change; no Node listener restart is required, but mobile clients must accept the refresh prompt, hard refresh, or close/reopen the PWA to load `codex-mobile-shell-v96`.

## 2026-05-27 Turn Usage Summary And Public PR Prompt v97

- User request:
  - After each turn ends, show context status and token usage so oversized-context risk is visible earlier.
  - If the public repository has open PRs, prompt whether to merge/integrate them.
- Local fix:
  - Added `adapters/turn-usage-summary-service.js`.
    - Parses rollout JSONL `event_msg` `token_count` events under the current `turn_context`.
    - Produces completed-turn diagnostic summaries with latest-turn token usage, cumulative token usage, model context-window usage percentage/risk, and rollout size.
    - `server.js` attaches synthetic `turnUsageSummary` items during thread detail compaction. These are display-only and are omitted when no scoped token count exists.
  - Added `adapters/public-pull-request-service.js`.
    - Normalizes the public GitHub repo slug and open PR response data.
    - `server.js` exposes authenticated `GET /api/public-pull-requests/status` and `publicPullRequests` config from `/api/public-config`.
    - The check is prompt-only. It does not merge, sync, commit, or push public automatically.
  - `public/app.js`
    - Renders `turnUsageSummary` cards after completed turns.
    - Excludes `turnUsageSummary` from the up-arrow final-receipt fallback target.
    - Adds startup/click public PR status checks. When open PRs are detected, the browser asks whether to prepare a merge/publish review task in the composer instead of auto-sending or auto-merging.
    - `CLIENT_BUILD_ID` bumped to `0.1.11|codex-mobile-shell-v97`.
  - `public/index.html` / `public/styles.css`
    - Added a compact `Public PR` status pill beside the update and restart controls.
    - Added bounded styles for turn usage summary cards.
  - `public/sw.js`
    - Shell cache bumped to `codex-mobile-shell-v97`.
  - `package.json`
    - `npm run check` now syntax-checks the two new adapter modules.
  - Tests added/updated:
    - New `test/turn-usage-summary-service.test.js`.
    - New `test/public-pull-request-service.test.js`.
    - `test/conversation-render.test.js`, `test/app-update.test.js`, and `test/mobile-viewport.test.js` cover the render path, public PR prompt wiring, final-receipt exclusion, and v97 shell.
  - Docs updated:
    - `README.md`, `docs/ARCHITECTURE.md`, `docs/MODULES.md`, `docs/CONTEXT_STRATEGY.md`, `docs/COMPLEX_FEATURE_PATHS.md`, and `.agent-context/PROJECT_CONTEXT.md`.
- Validation:
  - Focused `node --test test\turn-usage-summary-service.test.js test\public-pull-request-service.test.js` passed: 8/8.
  - Focused `node --test test\conversation-render.test.js test\app-update.test.js test\mobile-viewport.test.js` passed: 21/21.
  - `node --check adapters\turn-usage-summary-service.js`, `node --check adapters\public-pull-request-service.js`, `node --check server.js`, `node --check public\app.js`, and `node --check public\sw.js` passed.
  - `npm.cmd test` passed: 173/173.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - BOM check for touched source, test, docs, README, and project-context files produced no output.
- Activation:
  - Restarted the 8787 Node listener to load server-side usage summaries and public PR route: old PID `70560`, new PID `56180`.
  - Post-restart `/api/public-config` returns `clientBuildId=0.1.11|codex-mobile-shell-v97`, `shellCacheName=codex-mobile-shell-v97`, `imageContextMode=reference`, and `publicPullRequests.enabled=true` for `pentiumxp/codex-mobile-web-public`.
  - Post-restart authenticated `/api/status` returns `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, and `lastError=null`.
  - Post-restart authenticated `/api/public-pull-requests/status?force=1` returns enabled with `hasOpenPullRequests=false`, `openPullRequestCount=0`, and no error.
- Status:
  - Local changes are uncommitted.
  - Public repository was not touched because this turn did not request publish/public sync.
  - v97 includes both server-side and static PWA changes. The 8787 listener is already restarted, but mobile clients must accept the refresh prompt, hard refresh, or close/reopen the PWA to load `codex-mobile-shell-v97`.

## 2026-05-27 Uploaded JPG MIME And Uncached Usage Input v98

- User reports:
  - Quoted/uploaded `.jpg` image summaries still sometimes showed no thumbnail even when the same `Uploaded attachments:` text was parsed.
  - The turn usage summary `in` field should exclude cached input, while cached input remains visible separately.
  - During diagnosis, a long in-progress turn felt stuck for more than ten minutes.
- Diagnosis:
  - `renderInputContent()` already generated thumbnail markup for text before `Uploaded attachments:` summaries.
  - The authenticated upload route served saved `.jpg` uploads as `application/octet-stream`; the same request should be browser-renderable `image/jpeg`, especially for iOS/Safari `<img>` rendering.
  - The usage summary UI displayed raw `inputTokens` in `in`, so a turn with mostly cached input looked much larger than the paid/noncached input surface. Context-window usage still needs raw input because cached input still occupies prompt context.
  - Runtime checks during the slow-turn report showed `/api/status` healthy, mux endpoint healthy, no pending approvals/requests, fast thread-detail API reads, rollout sizes below warning thresholds, and both inspected turns still `inProgress`. The observed slowness was not a Mobile Web API block.
- Local fix:
  - `server.js`
    - `mimeFor()` now reuses `FILE_PREVIEW_IMAGE_CONTENT_TYPES` for upload/static file serving so `.jpg`, `.jpeg`, `.webp`, `.gif`, `.bmp`, `.avif`, `.heic`, `.heif`, `.tif`, `.tiff`, and `.png` return real image MIME types.
    - Exported `mimeFor()` for focused coverage.
  - `public/app.js`
    - Added `displayInputTokensExcludingCached()`.
    - `tokenUsageSummaryText()` now shows `in` as `inputTokens - cachedInputTokens` when cached input is present, and still shows `cached` separately.
    - Context-window percent/detail remains based on raw context-window tokens.
    - `CLIENT_BUILD_ID` bumped to `0.1.11|codex-mobile-shell-v98`.
  - `public/sw.js`
    - Shell cache bumped to `codex-mobile-shell-v98`.
  - Tests:
    - `test/file-preview.test.js` covers browser-renderable image MIME types for uploaded image route use.
    - `test/conversation-render.test.js` covers text-before-upload-summary thumbnail rendering and uncached `in` display.
    - `test/mobile-viewport.test.js` covers v98 shell cache.
  - Docs updated:
    - `README.md`, `docs/ARCHITECTURE.md`, `docs/CONTEXT_STRATEGY.md`, `docs/COMPLEX_FEATURE_PATHS.md`, `docs/TROUBLESHOOTING.md`, and `.agent-context/PROJECT_CONTEXT.md`.
- Validation:
  - Focused `node --test test\conversation-render.test.js test\file-preview.test.js test\mobile-viewport.test.js` passed: 27/27.
  - `node --check server.js`, `node --check public\app.js`, and `node --check public\sw.js` passed.
  - `npm.cmd test` passed: 176/176.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - BOM check for touched source, test, docs, README, and project-context files produced no output.
- Activation:
  - Restarted the 8787 Node listener to load the server-side MIME fix: old PID `56180`, new PID `49880`.
  - Post-restart `/api/public-config` returns `clientBuildId=0.1.11|codex-mobile-shell-v98`, `shellCacheName=codex-mobile-shell-v98`, `imageContextMode=reference`, and public PR checks enabled.
  - Post-restart authenticated `/api/status` returns `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, and `lastError=null`.
  - Post-restart authenticated `GET /api/uploads/file?path=...IMG_5435.jpg` returned `HTTP 200` with `Content-Type: image/jpeg`.
- Status:
  - Local changes remain uncommitted.
  - Public repository was not touched because this turn did not request publish/public sync.
  - v98 includes both server-side and static PWA changes. The 8787 listener is already restarted, but mobile clients must accept the refresh prompt, hard refresh, or close/reopen the PWA to load `codex-mobile-shell-v98`.

## 2026-05-27 Public v98 Publish

- User request:
  - Commit and push the current changes, including public.
- Pre-publish checks:
  - Authenticated `/api/public-pull-requests/status?force=1` returned `hasOpenPullRequests=false` and `openPullRequestCount=0`, so there was no public PR merge prompt to resolve before publishing.
  - Public repository started clean at `f260bb7 发布实时引用图片兼容修正`.
- Public repository:
  - Path: `C:\Users\xuxin\Documents\codex-mobile-web-public`.
  - Synced public-safe product/docs/test files from private:
    - `server.js`, `package.json`;
    - `public/app.js`, `public/index.html`, `public/styles.css`, `public/sw.js`;
    - `adapters/turn-usage-summary-service.js`, `adapters/public-pull-request-service.js`;
    - focused and full test files for update UI, operation cards, conversation render, file preview, mobile viewport, turn scroll controls, public PR status, and turn usage summaries;
    - `docs/ARCHITECTURE.md`, `docs/COMPLEX_FEATURE_PATHS.md`, `docs/CONTEXT_STRATEGY.md`, `docs/MODULES.md`, `docs/TROUBLESHOOTING.md`;
    - `README.md`.
  - Public README gained a detailed Chinese `2026-05-27 Public 发布说明` covering v93-v98:
    - final-receipt up-arrow target and visibility;
    - reading hold during final receipt refresh;
    - four-line operation cards;
    - completed-turn context/token usage summaries;
    - uncached `in` display while context-window risk still uses raw input;
    - prompt-only public PR checks;
    - reference-only uploaded-image thumbnail rendering;
    - real image MIME for saved uploaded images;
    - `codex-mobile-shell-v98` and listener restart note.
  - Public docs were sanitized to avoid copying local Hermes deployment paths; staged privacy scan found no private user path, Tailscale marker, private upload date path, owner-key marker, or local Hermes data path.
  - Public pushed commit: `4862fd7 发布移动端回执定位、用量诊断和图片缩略图修正`.
- Public validation:
  - Focused public tests passed: 47/47.
  - Public `npm.cmd test` passed: 174/174.
  - Public `npm.cmd run check` passed.
  - Public `npm.cmd run check:macos` passed.
  - Public `git diff --check` and `git diff --cached --check` passed with only Windows LF-to-CRLF working-copy warnings before staging.
  - Public staged privacy scan passed.
- Private follow-up:
  - Public README was copied back to private `README.md` so the private repo records the public v98 release note too.
  - Private validation after README sync passed:
    - `npm.cmd test` passed: 176/176.
    - `npm.cmd run check` passed.
    - `npm.cmd run check:macos` passed.
    - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - Private commit and push are handled after this handoff update in the same publish turn.

## 2026-05-27 Runtime Listener And Hermes Thumbnail Diagnosis

- Runtime repair:
  - A parentless/orphan `node server.js` listener was holding `0.0.0.0:8787` at PID `49880` while the expected hidden/windowless supervisor kept trying to start another listener and logging `EADDRINUSE`.
  - Stopped only the orphan listener. The existing `start-codex-mobile-web-windowless.ps1` supervisor PID `61104` restarted the listener as PID `76920`.
  - Post-repair checks showed a single 8787 listener, `/api/public-config` still on `0.1.11|codex-mobile-shell-v98`, authenticated `/api/status` with `ready=true` and `lastError=null`, and no new `EADDRINUSE` in the latest log tail.
- Hermes thumbnail diagnosis:
  - Current normal Codex Mobile thread `019e63ea-b64f-7e93-a92f-4c1dd9a79326` had `IMG_5441.png` as a `userMessage` and an `agentMessage` quote; both used standard `Uploaded attachments:\n- ...` text and the user confirmed the quote rendered as a thumbnail.
  - Hermes target thread `019e64e8-f29a-7fc1-8679-fee7b16f88ad` did not contain any `agentMessage` / assistant quote with an upload path. The matching uploaded-image records returned by `/api/threads/<id>` were all `itemType=userMessage`.
  - The six inspected Hermes upload paths (`IMG_5429.jpg`, `IMG_5433.jpg`, `503.jpg`, `IMG_5437.jpg`, `IMG_5438.jpg`, `IMG_5440.jpg`) all returned `HTTP 200` with `Content-Type: image/jpeg` from `/api/uploads/file`.
  - Evaluating the current v98 `renderInputContent()` against representative Hermes `userMessage` text generated `<figure class="input-image">` with `/api/uploads/file?path=...` and did not leak the raw `Uploaded attachments:` marker.
- Current interpretation:
  - If Hermes thread images still display as raw paths on the phone, the remaining likely cause is client-side runtime state: an old PWA shell, stale already-rendered DOM, or the phone viewing a browser/PWA context that has not reloaded the v98 app bundle. The backend item type, parser input, and upload MIME path were not the failing layer in this check.

## 2026-05-27 Hermes Usage Zero Diagnosis

- User asked why a Hermes `Usage` card showed all token fields as `0`.
- Evidence:
  - The screenshot was from Hermes thread `019e64e8-f29a-7fc1-8679-fee7b16f88ad`, not the current Codex Mobile thread.
  - `/api/threads/019e64e8-f29a-7fc1-8679-fee7b16f88ad` showed two completed turns with generated `turnUsageSummary` values where `lastTokenUsage` was all zero and `totalTokenUsage.totalTokens` was exactly `258400`, matching the model context window.
  - Raw rollout inspection showed the affected turns had valid `token_count` events earlier in the same turn, but a final `token_count` immediately before `task_complete` reported:
    - `last_token_usage` all zero;
    - `total_token_usage.input_tokens/cached_input_tokens/output_tokens/reasoning_output_tokens` all zero;
    - `total_token_usage.total_tokens = 258400`;
    - `model_context_window = 258400`.
- Diagnosis:
  - The zero card is caused by Mobile Web using the latest `token_count` event for a turn. In these Hermes turns, app-server emitted a final zero/window sentinel-style token count after normal usage events, so the valid usage was overwritten by the final invalid-looking event.
  - Real earlier usage for the screenshot turn was nonzero, for example prior events in the same turn showed context/input values around `200k+` tokens before the final zero sentinel.
- Likely fix:
  - `adapters/turn-usage-summary-service.js` should ignore sentinel token-count payloads where `last_token_usage` is all zero and `total_token_usage` has zero component fields while `total_tokens` equals `model_context_window`.
  - It should preserve the latest valid token-count event for that turn, or omit the summary if no valid event exists.
- Local fix now applied:
  - `adapters/turn-usage-summary-service.js` adds a narrow zero/window sentinel filter before collecting a `token_count` summary.
  - `test/turn-usage-summary-service.test.js` covers preserving the prior valid usage when a final sentinel follows it, and omitting the summary when only a sentinel exists.
  - `docs/CONTEXT_STRATEGY.md`, `docs/ARCHITECTURE.md`, and `docs/TROUBLESHOOTING.md` document the sentinel behavior and expected filtering.
- Validation and activation:
  - Focused `node --test test\turn-usage-summary-service.test.js` passed: 6/6.
  - `node --check adapters\turn-usage-summary-service.js` passed.
  - `npm.cmd test` passed: 178/178.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - BOM check for touched source, tests, docs, and handoff files produced no output.
  - Recomputed affected Hermes turns with the new parser:
    - `019e6904-7a76-7ed3-8667-b84ac4fc0195`: `contextWindowUsedTokens=208287`, `contextWindowUsedPercent=80.6%`, not zero.
    - `019e6909-9c45-7a93-9f74-f946f6948b49`: `contextWindowUsedTokens=208473`, `contextWindowUsedPercent=80.7%`, not zero.
  - Restarted the 8787 listener to load the server-side adapter fix: old PID `76920`, new PID `75852`, parent supervisor PID `61104`.
  - Post-restart `/api/public-config` remains `0.1.11|codex-mobile-shell-v98`; authenticated `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, `lastError=null`.
  - Post-restart authenticated `/api/threads/019e64e8-f29a-7fc1-8679-fee7b16f88ad` returned nonzero Usage summaries for both affected turns.

## 2026-05-27 Latest Operation Card Re-entry Fix

- User report:
  - After exiting and re-entering a thread, the command card for the last operation was often missing. Even if that command had already completed, hiding the frame made the conversation state easy to misread.
- Diagnosis:
  - `compactTurn()` only preserved operation cards when `allowLiveOperation` was set and the turn was still live.
  - `compactThread()` only attached rollout raw-operation fallback for the latest live turn.
  - `readLatestRawOperation()` skipped completed call ids, so a completed command/tool could not be restored from rollout tail after re-entry.
- Local fix:
  - `server.js`
    - Latest-thread detail compaction now preserves at most one newest operation card for the latest turn even after the operation or turn has completed.
    - Raw-operation fallback can include completed operations only when the rollout operation is tied to the same latest turn id, so older completed operations still cannot attach to a newer live turn.
    - `function_call_output` / tool output records now mark the matched raw operation completed when no explicit status/exit code is present.
  - `test/thread-item-timestamp-enrichment.test.js` covers preserving the newest operation in a completed latest turn and restoring a completed same-turn raw operation from rollout tail.
  - `README.md`, `docs/ARCHITECTURE.md`, `docs/COMPLEX_FEATURE_PATHS.md`, `docs/TROUBLESHOOTING.md`, and `.agent-context/PROJECT_CONTEXT.md` document the latest-turn completed-operation card rule.
- Validation:
  - Focused `node --test test\thread-item-timestamp-enrichment.test.js test\conversation-render.test.js test\collab-agent-render.test.js` passed: 26/26.
  - `node --check server.js` passed.
  - `npm.cmd test` passed: 180/180.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - BOM check for touched source, tests, docs, README, and handoff files produced no output.
- Activation:
  - Restarted the 8787 listener to load the server-side compaction fix: old PID `75852`, new PID `19764`.
  - Post-restart `/api/public-config` remains `0.1.11|codex-mobile-shell-v98`.
  - Post-restart authenticated `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, `lastError=null`.
- Status:
  - Local changes are uncommitted.
  - This is a server-side thread-detail compaction fix; no PWA shell cache bump is required.

## 2026-05-27 Public Usage Sentinel And Operation Card Publish

- User request:
  - Commit and push current fixes, including public.
- Pre-publish check:
  - Authenticated `/api/public-pull-requests/status?force=1` returned `hasOpenPullRequests=false`, `openPullRequestCount=0`; no public PR merge prompt blocked publishing.
- Public repository:
  - Path: `C:\Users\xuxin\Documents\codex-mobile-web-public`.
  - Synced public-safe files from private:
    - `server.js`;
    - `adapters/turn-usage-summary-service.js`;
    - `test/thread-item-timestamp-enrichment.test.js`;
    - `test/turn-usage-summary-service.test.js`;
    - `docs/ARCHITECTURE.md`, `docs/COMPLEX_FEATURE_PATHS.md`, `docs/CONTEXT_STRATEGY.md`, `docs/TROUBLESHOOTING.md`;
    - `README.md`.
  - Public README gained a Chinese `2026-05-27 Public 发布说明（续）` documenting:
    - zero/window sentinel `token_count` filtering for Usage cards;
    - latest-turn operation card retention after refresh/re-entry even when the operation or turn completed;
    - same-turn-id guard for completed raw-operation fallback;
    - no PWA shell cache bump and listener-restart requirement.
  - Public docs were sanitized so ChatGPT Pro bridge-state references use deployment-configured wording instead of a local Hermes `ProgramData` path.
  - Public pushed commit: `0765085 发布 Usage 零值过滤与最新操作卡保留`.
- Public validation:
  - Authenticated public PR status check passed with no open PRs.
  - Focused public tests passed: 32/32.
  - Public `npm.cmd test` passed: 180/180.
  - Public `npm.cmd run check` passed.
  - Public `npm.cmd run check:macos` passed.
  - Public `git diff --check` and `git diff --cached --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - Public BOM checks produced no output.
  - Public staged privacy scan found no private user path, Tailscale host, specific upload directory, local Hermes path, owner key, or raw key.
- Private follow-up:
  - Public-sanitized `docs/COMPLEX_FEATURE_PATHS.md` and `docs/TROUBLESHOOTING.md` were copied back to private so future public sync does not reintroduce local Hermes paths from shared docs.
  - Private commit/push is the next step in the same turn.

## 2026-05-27 Operation Cards Live-Only v99

- User correction:
  - If a turn has ended, there should not be a command/tool operation card below the final response. The last frame should be the Usage summary when Usage exists.
  - If a turn is still running, the latest operation card is still needed.
- Local fix:
  - `server.js`
    - `compactTurn()` now preserves operation cards only when `allowLiveOperation` is true and the turn is live.
    - `compactThread()` passes `allowLiveOperation` only for the latest turn and only attaches raw-operation fallback while that latest turn is live.
    - Completed raw-operation fallback can still be used for a live latest turn when the latest operation completed but the turn remains running; completed turns do not synthesize operation cards.
  - `public/app.js`
    - `visibleItemsForTurn()` now renders operation cards only when `isLatestTurn(turn) && isLiveTurn(turn)`, so a completed local/live-merged turn cannot keep showing a stale command box.
    - `CLIENT_BUILD_ID` bumped to `0.1.11|codex-mobile-shell-v99`.
  - `public/sw.js`
    - Shell cache bumped to `codex-mobile-shell-v99`.
  - Tests:
    - `test/thread-item-timestamp-enrichment.test.js` now covers completed latest turns dropping operations and ending with `turnUsageSummary`, live latest turns restoring a completed same-turn raw operation, and completed latest turns not restoring completed raw operations.
    - `test/collab-agent-render.test.js` covers live-only frontend operation visibility.
    - `test/mobile-viewport.test.js` covers v99 shell cache.
  - Docs updated:
    - `README.md`, `docs/ARCHITECTURE.md`, `docs/COMPLEX_FEATURE_PATHS.md`, `docs/TROUBLESHOOTING.md`, and `.agent-context/PROJECT_CONTEXT.md`.
- Validation so far:
  - Focused `node --test test\thread-item-timestamp-enrichment.test.js test\conversation-render.test.js test\collab-agent-render.test.js test\mobile-viewport.test.js` passed: 30/30.
  - `node --check server.js`, `node --check public\app.js`, and `node --check public\sw.js` passed.
- Final validation:
  - `npm.cmd test` passed: 181/181.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - BOM check for touched source, tests, docs, README, and handoff files produced no output.
- Activation:
  - Restarted the 8787 listener to load the server-side live-only operation compaction and v99 static config: old PID `19764`, new PID `66572`.
  - Post-restart `/api/public-config` returns `clientBuildId=0.1.11|codex-mobile-shell-v99`, `shellCacheName=codex-mobile-shell-v99`, and `imageContextMode=reference`.
  - Post-restart authenticated `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, `lastError=null`.
- Status:
  - Local changes are uncommitted.
  - This includes both server-side detail compaction and static PWA shell changes; mobile clients need the v99 refresh/hard reload/close-reopen path.

## 2026-05-28 Generated ImageView Screenshot Cache v100

- User report:
  - A Hermes turn showed an `Image` card for a visual verification screenshot, but the mobile thumbnail was broken.
  - Rollout evidence showed the image came from Codex's own `view_image` tool against a `%TEMP%` screenshot path, not from the user's upload root.
- Diagnosis:
  - `renderImageView()` treated local `imageView` paths like normal file-preview targets and built `/api/files/preview/content?threadId=...&path=...`.
  - That preview route correctly allows only current workspace, Obsidian, or configured preview roots. A tool-generated `%TEMP%` screenshot is outside those roots; if the temp file is later deleted, a historical card cannot be recovered from the path alone.
- Local fix:
  - Added `adapters/generated-image-cache-service.js`.
    - Extracts `imageView` source paths from direct, `arguments`, and `result` fields.
    - Copies small supported image files into `%USERPROFILE%\.codex-mobile-web\generated-images` or `CODEX_MOBILE_GENERATED_IMAGE_CACHE_DIR`.
    - Resolves generated-image ids back only under that runtime cache root.
  - `server.js`
    - `compactItem()` now attaches a generated-image `contentUrl` for `imageView` items when the source image is still available.
    - Added authenticated `GET /api/generated-images/file?id=...` to serve cached generated images with browser-renderable image MIME and no arbitrary temp-root preview broadening.
    - `compactTurn()` / live notification compaction now pass thread id options through to image caching.
  - `public/app.js`
    - `renderImageView()` now prefers server-provided `contentUrl` and adds the auth key to same-origin `/api/` media URLs when needed.
    - `visibleItemSignature()` includes `imageView` `contentUrl` so cached-url changes repaint.
    - `CLIENT_BUILD_ID` bumped to `0.1.11|codex-mobile-shell-v100`.
  - `public/sw.js`
    - Shell cache bumped to `codex-mobile-shell-v100`.
  - Tests/docs:
    - Added `test/generated-image-cache-service.test.js`.
    - Updated image/file UI and mobile viewport tests.
    - Updated README, architecture, module map, troubleshooting, complex feature paths, and project context.
- Validation:
  - Focused `node --test test\generated-image-cache-service.test.js test\file-preview-ui.test.js test\file-preview.test.js test\conversation-render.test.js test\mobile-viewport.test.js` passed: 31/31.
  - `node --check adapters\generated-image-cache-service.js`, `server.js`, `public\app.js`, and `public\sw.js` passed.
  - `npm.cmd test` passed: 184/184.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - BOM check for touched source, tests, docs, README, and project-context files produced no output.
  - Runtime smoke `GET /api/generated-images/file?id=route-smoke/...` returned `HTTP 200` with `Content-Type: image/png`.
- Status:
  - Local changes are uncommitted.
  - This fix includes server-side generated-image caching and a static PWA shell bump.
- Activation:
  - Restarted the 8787 Node listener to load generated-image caching: old PID `22144`, new PID `25104`.
  - Post-restart `/api/public-config` returns `clientBuildId=0.1.11|codex-mobile-shell-v100`, `shellCacheName=codex-mobile-shell-v100`, and `imageContextMode=reference`.
  - Post-restart authenticated `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, and `lastError=null`.
  - Mobile clients must load `codex-mobile-shell-v100` through refresh prompt, hard reload, or PWA close/reopen.

## 2026-05-28 Public v99/v100 Publish

- User request:
  - Commit and push the current changes, including public.
- Pre-publish check:
  - Authenticated `/api/public-pull-requests/status?force=1` returned `hasOpenPullRequests=false`, `openPullRequestCount=0`; no public PR merge prompt blocked publishing.
- Public repository:
  - Path: `C:\Users\xuxin\Documents\codex-mobile-web-public`.
  - Synced public-safe files from private:
    - `server.js`, `package.json`;
    - `public/app.js`, `public/sw.js`;
    - `adapters/generated-image-cache-service.js`;
    - `test/generated-image-cache-service.test.js`, `test/thread-item-timestamp-enrichment.test.js`, `test/conversation-render.test.js`, `test/collab-agent-render.test.js`, `test/file-preview-ui.test.js`, `test/mobile-viewport.test.js`;
    - `docs/ARCHITECTURE.md`, `docs/COMPLEX_FEATURE_PATHS.md`, `docs/MODULES.md`, `docs/TROUBLESHOOTING.md`;
    - `README.md`.
  - Public README gained a detailed Chinese `2026-05-28 Public 发布说明` covering:
    - live-only operation card behavior after turn completion;
    - Usage summary as the final completed-turn diagnostic frame;
    - generated-image cache for Codex `view_image` / `imageView` visual verification screenshots;
    - authenticated `/api/generated-images/file` rendering;
    - no broadening of `%TEMP%` or local file-preview roots;
    - PWA shell `codex-mobile-shell-v100`.
  - Public pushed commit: `5913849 发布完成回执操作卡收敛与 ImageView 截图缓存`.
- Public validation:
  - Focused public tests passed: 43/43.
  - Public `npm.cmd test` passed: 184/184.
  - Public `npm.cmd run check` passed.
  - Public `npm.cmd run check:macos` passed.
  - Public `git diff --check` and `git diff --cached --check` passed with only Windows LF-to-CRLF working-copy warnings before staging.
  - Public BOM checks produced no output.
  - Public staged privacy scan found no private user path, Tailscale/LAN marker, local Hermes path, owner key, raw key, Web Push runtime secret-file marker, or private upload runtime path.
- Private follow-up:
  - Private README now includes the same public release note.
  - Private validation after public README/handoff update passed:
    - `npm.cmd test` passed: 185/185.
    - `npm.cmd run check` passed.
    - `npm.cmd run check:macos` passed.
    - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
    - BOM check for touched source, tests, docs, README, project-context, and handoff files produced no output.
  - This entry is included in the private commit/push for the same turn.

## 2026-05-28 Turn Usage Delta Accounting

- User report:
  - The completed-turn `Usage` card's `last turn` row looked too small and appeared to count only the final reply/model call rather than the whole turn.
- Diagnosis:
  - Raw rollout inspection for current thread turn `019e6cec-9a4a-7933-b24c-617684bc71d5` showed 28 valid scoped `token_count` events in one turn.
  - The existing parser stored only the latest valid event per turn, so the card used final-event `last_token_usage` (`input=195073`, `out=282`, `reasoning=74`) and missed earlier model calls in the same turn.
- Local fix:
  - `adapters/turn-usage-summary-service.js` now accumulates turn-level usage from consecutive cumulative `total_token_usage` deltas across valid scoped events.
  - Duplicate events with identical cumulative totals add zero; zero/window sentinel events remain ignored.
  - The final valid event still provides context-window percent/risk, and `finalTokenUsage` preserves the final-call snapshot.
  - `lastTokenUsage` is normalized to the turn-level total for backward compatibility with the current frontend `last turn` row.
  - Updated `test/turn-usage-summary-service.test.js`, `README.md`, `docs/ARCHITECTURE.md`, `docs/CONTEXT_STRATEGY.md`, `docs/TROUBLESHOOTING.md`, `docs/COMPLEX_FEATURE_PATHS.md`, and `.agent-context/PROJECT_CONTEXT.md`.
- Validation:
  - Focused `node --test test\turn-usage-summary-service.test.js` passed: 7/7.
  - `node --check adapters\turn-usage-summary-service.js` passed.
  - `npm.cmd test` passed: 185/185.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - BOM check for touched source, tests, docs, README, and project-context files produced no output.
  - Recomputed the reported turn with the new parser:
    - final context snapshot remains `input=195073`, context window `75.49%`;
    - turn-level usage becomes `input=4393070`, `cached=4196864`, `out=10548`, `reasoning=2990`, `total=4403618`.
- Activation:
  - Restarted the 8787 Node listener to load the server-side parser fix: old PID `25104`, new PID `51460`.
  - Post-restart `/api/public-config` returns `clientBuildId=0.1.11|codex-mobile-shell-v100`, `shellCacheName=codex-mobile-shell-v100`, and `imageContextMode=reference`.
  - Post-restart authenticated `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, and `lastError=null`.
  - Post-restart authenticated thread detail for turn `019e6cec-9a4a-7933-b24c-617684bc71d5` returns `turnUsageSummary.lastTokenUsage.inputTokens=4393070`, `cachedInputTokens=4196864`, `outputTokens=10548`, `reasoningOutputTokens=2990`, and `finalTokenUsage.inputTokens=195073`.
- Status:
  - Local changes are uncommitted.
  - This is a server-side usage parser/documentation change; no PWA shell cache bump is required.

## 2026-05-28 Public Usage Delta Publish

- User request:
  - Commit and push the Usage turn-delta accounting fix, including public.
- Pre-publish check:
  - Authenticated `/api/public-pull-requests/status?force=1` returned `hasOpenPullRequests=false`, `openPullRequestCount=0`; no public PR merge prompt blocked publishing.
- Public repository:
  - Path: `C:\Users\xuxin\Documents\codex-mobile-web-public`.
  - Synced public-safe files from private:
    - `README.md`;
    - `adapters/turn-usage-summary-service.js`;
    - `test/turn-usage-summary-service.test.js`;
    - `docs/ARCHITECTURE.md`, `docs/COMPLEX_FEATURE_PATHS.md`, `docs/CONTEXT_STRATEGY.md`, `docs/TROUBLESHOOTING.md`.
  - Public README gained Chinese `2026-05-28 Public 发布说明（Usage 本轮统计修正）` documenting:
    - `last turn` now counts all valid scoped token events in the turn rather than only the final `last_token_usage`;
    - turn-level usage comes from consecutive cumulative `total_token_usage` deltas;
    - duplicate cumulative events add zero;
    - context-window percent/risk still uses the final valid event;
    - zero/window sentinel filtering remains.
  - Public pushed commit: `eff8fbc 发布 Usage 本轮统计修正`.
- Public validation:
  - Focused `node --test test\turn-usage-summary-service.test.js` passed: 7/7.
  - Public `npm.cmd test` passed: 185/185.
  - Public `npm.cmd run check` passed.
  - Public `npm.cmd run check:macos` passed.
  - Public `git diff --check` and `git diff --cached --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - Public BOM checks produced no output.
  - Public staged privacy scan found only existing generic guardrail/runtime-path documentation, with no raw secrets or user-specific upload/runtime paths introduced by this change.
- Private follow-up:
  - Private README now includes the same public release note.
  - Private commit/push remains to be completed after final validation in the same turn.

## 2026-05-28 Hermes Mobile Independent Plugin Mode v101

- User clarification:
  - Codex Mobile Web must be deployed as an independent Hermes Mobile plugin, following the current embedded-plugin pattern used by Wardrobe.
  - This is not related to the retired Hermes/Codex worker or collaboration queue, and active docs for that old path should be removed.
  - Authentication remains independent: Hermes Mobile must provide the Codex Mobile Access Key for registration and launch.
  - Registration must include a Hermes callback URL, which may be an HTTPS domain.
- Local fix:
  - Added `adapters/hermes-plugin-service.js`:
    - builds a Hermes `embedded_app` manifest for `codex-mobile`;
    - registers workspace/callback metadata in runtime state without storing Access Keys;
    - validates callback URLs as `http` or `https` and rejects unsafe schemes/credentials;
    - issues short-lived `codexPluginLaunch` iframe tokens for launch.
  - `server.js` now exposes:
    - public `GET /api/v1/hermes/plugin/manifest`;
    - Access-Key-protected `POST /api/v1/hermes/plugin/workspaces`;
    - Access-Key-protected `POST /api/v1/hermes/plugin/callbacks`;
    - Access-Key-protected `POST /api/v1/hermes/plugin/launch`;
    - authenticated `GET /api/v1/hermes/plugin/registration`;
    - `/api/public-config.hermesPlugin` endpoint metadata.
  - `server.js` accepts `Authorization: Bearer <codex-mobile-access-key>` in addition to the existing `X-Codex-Mobile-Key`, cookie, and query auth paths.
  - Plugin launch tokens authorize normal Mobile Web API/SSE calls while valid, but registration and launch still require the long-lived Codex Mobile Access Key.
  - `public/app.js` can bootstrap from `?codexPluginLaunch=...` or `?pluginLaunch=...` as an in-memory browser-session key without writing it to `localStorage`.
  - `public/app.js` / `public/sw.js` bumped the shell build/cache to `codex-mobile-shell-v101` / `0.1.11|codex-mobile-shell-v101`.
  - `CODEX_MOBILE_HERMES_PLUGIN_BASE_URL` or `CODEX_MOBILE_PUBLIC_BASE_URL` can pin the manifest base URL to an external HTTPS Codex Mobile deployment.
  - Removed active documentation references to the old Hermes/Codex worker path from `.agent-context/PROJECT_CONTEXT.md`, `docs/COMPLEX_FEATURE_PATHS.md`, and `docs/TROUBLESHOOTING.md`.
  - Updated `README.md`, `docs/ARCHITECTURE.md`, `docs/MODULES.md`, `docs/TROUBLESHOOTING.md`, `docs/COMPLEX_FEATURE_PATHS.md`, and `.agent-context/PROJECT_CONTEXT.md`.
  - Added `test/hermes-plugin-service.test.js` and `test/hermes-plugin-route.test.js`; `package.json` syntax check now includes the new adapter.
- Validation:
  - Focused `node --test test\hermes-plugin-service.test.js test\hermes-plugin-route.test.js test\mobile-viewport.test.js` passed: 9/9.
  - `node --check server.js`, `node --check adapters\hermes-plugin-service.js`, `node --check public\app.js`, and `node --check public\sw.js` passed.
  - `npm.cmd test` passed: 191/191.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - Runtime smoke after listener restart:
    - `/api/public-config` returns `clientBuildId=0.1.11|codex-mobile-shell-v101`, `shellCacheName=codex-mobile-shell-v101`, and the `hermesPlugin` endpoint map.
    - unauthenticated `GET /api/v1/hermes/plugin/manifest` returns `id=codex-mobile`, `kind=embedded_app`, entry `http://127.0.0.1:8787/?embed=hermes`, and registration/launch paths.
    - authenticated `POST /api/v1/hermes/plugin/launch` returns a short-lived `codexPluginLaunch` entry path with `expires_in=300`.
    - `/api/status?codexPluginLaunch=<short-token>` returned `ready=true`, `transport=external-jsonl-tcp`.
    - invalid callback registration with `ftp://...` returned HTTP 400; this smoke avoided writing a fake runtime callback registration.
- Activation:
  - The authenticated shared-chain restart endpoint returned accepted but did not stop the existing old listener under the windowless supervisor.
  - Stopped only the old 8787 listener child PID `51460`; the existing windowless supervisor restarted `server.js` as PID `57584`.
  - Post-restart authenticated `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, and `lastError=null`.
- Status:
  - Local changes are uncommitted.
  - This change includes server-side plugin routes, runtime-state policy, frontend launch-token bootstrap, docs, and a static PWA shell bump.
  - Mobile clients need the refresh prompt, hard refresh, or PWA close/reopen to load `codex-mobile-shell-v101`.

## 2026-05-29 Hermes Mobile Embedded Plugin Contract v102

- User request:
  - Complete the Hermes Mobile embedded-plugin contract on the Codex Mobile side so it works as a real iframe secondary app, following the Wardrobe plugin pattern.
  - This is independent from the retired Hermes/Codex worker/collaboration flow.
- Local fix:
  - `adapters/hermes-plugin-service.js`
    - Manifest keeps `id=codex-mobile`, `kind=embedded_app`, `entry.url`, `program_api.plugin_launch`, and `owner_binding`, and now also exposes `origin_registration`, `plugin_session`, `frame_embedding`, and navigation contract metadata.
    - Manifest no longer includes local access-key/config paths and is covered by a no-secret-shape test.
    - Added origin-only registration through `registerOrigin()` and frame ancestor helpers.
    - Added launch-to-session exchange: `POST /api/v1/hermes/plugin/launch` returns only `{ ok, entry_path, expires_in }`; the browser exchanges the short `codexPluginLaunch` token for a scoped `cps_...` in-memory plugin session through `/api/v1/hermes/plugin/session`.
    - HTTPS Hermes + HTTP Codex entry now reports a manifest diagnostic `https_hermes_cannot_embed_http_codex_entry`.
  - `server.js`
    - Added `CODEX_MOBILE_HERMES_PLUGIN_SESSION_TTL_MS` and `CODEX_MOBILE_HERMES_PLUGIN_FRAME_ORIGINS`.
    - Added authenticated `POST /api/v1/hermes/plugin/origins` and launch-token-backed `POST /api/v1/hermes/plugin/session`.
    - Session tokens authorize normal app API calls without exposing the long-lived Codex Mobile Access Key.
    - Static HTML responses now include CSP `frame-ancestors 'self' <registered-origins>`.
    - `/api/public-config.hermesPlugin` now lists origin and session endpoint paths.
  - Frontend:
    - Added `public/plugin-embed.js` for embed detection, navigation message shape, back-message detection, and internal URL policy.
    - `public/index.html` sets `html.embed-hermes` before CSS loads and includes `plugin-embed.js`.
    - `public/app.js` in `?embed=hermes` mode ignores standalone `localStorage` access keys, exchanges launch tokens for plugin sessions, scrubs the launch URL, avoids page-refresh checks on visibility/focus, hides the login form on plugin auth failures, posts `codex-mobile.plugin.navigation`, handles `hermes.plugin.back`, closes preview/edit/action/drawer/panel before returning detail/new-thread views to root/list, and blocks `window.open`, `target=_blank`, external browser handoff, and second-window launches.
    - `public/styles.css` hides standalone chrome in embed mode and constrains the iframe layout to one full-width column without side gutters.
    - Shell cache/build id bumped to `codex-mobile-shell-v102` / `0.1.11|codex-mobile-shell-v102`; `public/sw.js` caches `plugin-embed.js`.
  - Tests/docs:
    - Added `test/plugin-embed.test.js`.
    - Expanded `test/hermes-plugin-service.test.js`, `test/hermes-plugin-route.test.js`, and `test/mobile-viewport.test.js`.
    - Updated README, `docs/ARCHITECTURE.md`, `docs/MODULES.md`, `docs/TROUBLESHOOTING.md`, `docs/COMPLEX_FEATURE_PATHS.md`, and `.agent-context/PROJECT_CONTEXT.md`.
- Validation:
  - Focused `node --test test\hermes-plugin-service.test.js test\hermes-plugin-route.test.js test\plugin-embed.test.js test\mobile-viewport.test.js` passed: 16/16.
  - `npm.cmd test` passed: 198/198.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - BOM check for touched source, tests, docs, README, project context, and handoff files produced no output.
- Runtime smoke:
  - Restarted only the 8787 Node listener to load server-side plugin/session/CSP changes: old PID `57584`, new PID `61208`.
  - `/api/public-config` returns `clientBuildId=0.1.11|codex-mobile-shell-v102`, `shellCacheName=codex-mobile-shell-v102`, and Hermes plugin paths including `originRegistrationPath` and `sessionPath`.
  - Authenticated `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, and `lastError=null`.
  - Manifest smoke returned `id=codex-mobile`, `kind=embedded_app`, launch/session/origin endpoint paths, owner strategy `workspace_bound_codex_mobile_key`, no secret/path leak by regex scan, and the expected HTTPS-Hermes/HTTP-entry diagnostic.
  - Launch/session smoke returned expected fields `entry_path,expires_in,ok`, exchanged to a scoped session key without printing token material, and the session key authorized `/api/status`.
  - Temporary origin registration smoke confirmed registered origin appears in frame ancestors and HTML CSP, then restored the runtime registration file to its prior absent state.
  - Browser smoke initially hit old v101 service-worker shell; after clearing that test browser's old shell cache, v102 embed launch scrubbed `codexPluginLaunch` from the URL, kept `embed=hermes&workspaceId=owner`, entered the app without login, hid the sidebar/menu, and filled the iframe width.
- Status:
  - Local changes are uncommitted.
  - Server-side route/CSP/session changes are active in the current 8787 listener.
  - Mobile/PWA clients must refresh, hard reload, or close/reopen to activate `codex-mobile-shell-v102`; old v101 service-worker shells will not have the full embed contract until refreshed.

## 2026-05-29 Hermes Plugin HTTPS Base URL Startup Wiring

- User report:
  - Hermes Mobile has registered Codex Mobile and registered Hermes PWA origin `https://hermes-xuxin.synology.me:8445`.
  - Direct manifest call with `hermesOrigin=https%3A%2F%2Fhermes-xuxin.synology.me%3A8445` still returned `entry.url=http://127.0.0.1:8787/?embed=hermes` and `program_api.base_url=http://127.0.0.1:8787`.
  - This is valid for local debug only and is blocked as mixed content when HTTPS Hermes embeds the plugin iframe.
- Diagnosis:
  - Existing plugin service already honors `CODEX_MOBILE_HERMES_PLUGIN_BASE_URL` / `CODEX_MOBILE_PUBLIC_BASE_URL` and uses registered origins for `frame-ancestors`.
  - Current Windows scheduled task had no way to persist these values into the hidden/windowless Node process, so restarts fell back to request-local `127.0.0.1`.
- Local fix:
  - `start-codex-mobile-web.ps1` now accepts `-HermesPluginBaseUrl`, `-PublicBaseUrl`, and `-HermesPluginFrameOrigins`, then sets:
    - `CODEX_MOBILE_HERMES_PLUGIN_BASE_URL`;
    - `CODEX_MOBILE_PUBLIC_BASE_URL`;
    - `CODEX_MOBILE_HERMES_PLUGIN_FRAME_ORIGINS`.
  - `start-codex-mobile-web-windowless.ps1` forwards those values to the foreground startup script.
  - `install-codex-mobile-web-startup.ps1` persists those values into the Windows scheduled-task action arguments, so production HTTPS plugin deployment does not depend on a temporary shell environment.
  - Tests now assert the startup script chain can persist the HTTPS base URL and frame-origin settings.
  - `test/hermes-plugin-service.test.js` now covers HTTPS Hermes origin + configured HTTPS Codex base URL returning HTTPS `entry.url` / `program_api.base_url` with no mixed-content diagnostic.
  - Updated README, architecture, module map, troubleshooting, complex feature path docs, and project context.
- Validation:
  - PowerShell parser check passed for:
    - `start-codex-mobile-web.ps1`;
    - `start-codex-mobile-web-windowless.ps1`;
    - `install-codex-mobile-web-startup.ps1`.
  - Focused `node --test test\hermes-plugin-service.test.js test\hermes-plugin-route.test.js test\plugin-embed.test.js test\mobile-viewport.test.js` passed: 18/18.
  - `npm.cmd test` passed: 200/200.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - BOM check for touched source, tests, docs, README, and project-context files produced no output.
- Runtime smoke:
  - Live manifest with simulated reverse-proxy headers `X-Forwarded-Proto=https` and `X-Forwarded-Host=codex.example.test:8443` returned:
    - `entry.url=https://codex.example.test:8443/?embed=hermes`;
    - `program_api.base_url=https://codex.example.test:8443`;
    - `frame_ancestors='self' https://hermes-xuxin.synology.me:8445`;
    - no diagnostic code.
  - Live direct manifest without external base URL still returns `http://127.0.0.1:8787/?embed=hermes` plus diagnostic `https_hermes_cannot_embed_http_codex_entry`, confirming the current process still needs a real `-HermesPluginBaseUrl` deployment value to satisfy HTTPS Hermes embedding.
  - Authenticated launch smoke returned fields `entry_path,expires_in,ok`, `entry_path` was relative, and it did not contain the long-lived Access Key.
- Status:
  - Local changes are uncommitted.
  - No Node listener restart was performed for this wiring-only source change.
  - To activate for the real Hermes PWA, re-register/restart the Windows task with the actual external HTTPS Codex Mobile origin, for example:
    `.\install-codex-mobile-web-startup.ps1 -RunNow -HermesPluginBaseUrl "https://<codex-https-origin>" -HermesPluginFrameOrigins "https://hermes-xuxin.synology.me:8445"`.

## 2026-05-29 Hermes Plugin Normal-Page Back State v104

- User correction:
  - In Hermes Mobile, right-swipe on a normal secondary page should behave like the independent Hermes PWA and reach the Hermes outer settings/menu surface.
  - Codex plugin normal thread/workspace pages must not treat themselves as iframe-backable, because that causes Hermes to forward the gesture into Codex and can dump the user into Codex's initial Workspace list.
  - No fallback topbar button should be added.
- Local fix:
  - `public/plugin-embed.js`
    - Normal thread/workspace/new-thread routes still report their route, but `canGoBack=false`.
    - `canGoBack=true` is now limited to iframe-owned transient layers: file preview, sidebar/settings drawer state, rename/action dialogs, and subagent panel.
  - `public/app.js`
    - Removed the plugin back path that cleared current thread/workspace selection and returned to the initial Workspace list.
    - `hermes.plugin.back` now only closes iframe-owned transient UI if one is open.
    - Sidebar edge-swipe handling is disabled in `?embed=hermes`, so normal plugin pages leave the outer gesture to Hermes.
    - Shell build id bumped to `0.1.11|codex-mobile-shell-v104`.
  - `public/sw.js`
    - Shell cache bumped to `codex-mobile-shell-v104`.
  - Tests/docs:
    - Updated `test/plugin-embed.test.js`, `test/hermes-plugin-route.test.js`, and `test/mobile-viewport.test.js`.
    - Updated README, `docs/ARCHITECTURE.md`, `docs/COMPLEX_FEATURE_PATHS.md`, `docs/TROUBLESHOOTING.md`, and `.agent-context/PROJECT_CONTEXT.md`.
- Validation:
  - `node --check public\app.js`, `node --check public\plugin-embed.js`, and `node --check public\sw.js` passed.
  - Focused `node --test test\plugin-embed.test.js test\hermes-plugin-route.test.js test\mobile-viewport.test.js` passed: 11/11.
  - `npm.cmd test` passed: 200/200.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
- Runtime smoke:
  - `/api/public-config` returns `clientBuildId=0.1.11|codex-mobile-shell-v104` and `shellCacheName=codex-mobile-shell-v104`.
  - Android emulator Hermes PWA was reloaded through Chrome DevTools Protocol, then the Codex tab was opened. After v104 load, the Hermes host top-left control on the Codex plugin thread showed `Open menu` instead of `Back`, confirming the normal thread route no longer advertises iframe back state.
  - ADB synthetic edge-swipe was not treated as definitive gesture evidence because it can trigger Chrome/Hermes host reload/navigation paths; the reliable evidence for this fix is the posted navigation state and host control state.
- Status:
  - Local changes are uncommitted.
  - Static frontend/PWA change only; no Node listener restart required.
  - Mobile/PWA clients must refresh, hard reload, or close/reopen to activate `codex-mobile-shell-v104`.

## 2026-05-29 Hermes Plugin Sidebar Gesture v105

- User correction:
  - In the Hermes embedded Codex tab, right-swipe on a normal thread page should behave like standalone Codex Mobile Web by opening Codex's own sidebar/settings surface.
  - The previous v104 change prevented the wrong Workspace-root navigation but also disabled the iframe's sidebar edge gesture, leaving the user stuck on the thread page.
- Local fix:
  - `public/app.js`
    - Restored left-edge sidebar swipe handling in `?embed=hermes` while preserving the rule that `hermes.plugin.back` never clears `currentThreadId` or `selectedCwd` into the initial Workspace page.
    - Shell build id bumped to `0.1.11|codex-mobile-shell-v105`.
  - `public/styles.css`
    - Embedded mode no longer hides the sidebar permanently.
    - The sidebar remains off-canvas by default and appears only as an overlay when opened or edge-dragged; the standalone top-left menu button remains hidden.
  - `public/sw.js`
    - Shell cache bumped to `codex-mobile-shell-v105`.
  - Tests/docs:
    - Updated `test/hermes-plugin-route.test.js` and `test/mobile-viewport.test.js`.
    - Updated README, `docs/ARCHITECTURE.md`, `docs/COMPLEX_FEATURE_PATHS.md`, `docs/TROUBLESHOOTING.md`, and `.agent-context/PROJECT_CONTEXT.md`.
- Status:
  - Local changes are uncommitted.
  - Static frontend/PWA change only; no Node listener restart is required.
  - Mobile/PWA clients must refresh, hard reload, or close/reopen to activate `codex-mobile-shell-v105`.

## 2026-05-29 Hermes Plugin Back-To-Sidebar v106

- User correction:
  - On iOS Hermes Mobile, the embedded Codex thread page still could not leave the secondary page.
  - The desired behavior is not the first-launch Workspace page. Right-swipe/back from a normal thread page should open Codex's sidebar that contains the thread switcher and settings button.
- Diagnosis:
  - v105 restored an iframe-local left-edge sidebar gesture, but iOS Hermes still needs normal thread/workspace routes to advertise `canGoBack=true` before the host forwards its right-swipe/back affordance into the iframe.
  - v104/v105 were too strict by keeping normal routes at `canGoBack=false`.
- Local fix:
  - `public/plugin-embed.js`
    - Normal `currentThreadId`, `newThreadDraft`, and `selectedCwd` routes now contribute `canGoBack=true`.
  - `public/app.js`
    - If `hermes.plugin.back` arrives on a normal thread/new-thread/workspace route with no transient layer open, Codex opens `openSidebarMenu()` instead of clearing current selection.
    - Existing transient handling remains first: preview, rename dialog, action sheet, subagent panel, settings panel, and open sidebar are closed before normal-page sidebar opening is considered.
    - Shell build id bumped to `0.1.11|codex-mobile-shell-v106`.
  - `public/sw.js`
    - Shell cache bumped to `codex-mobile-shell-v106`.
  - Tests/docs:
    - Updated `test/plugin-embed.test.js`, `test/hermes-plugin-route.test.js`, and `test/mobile-viewport.test.js`.
    - Updated README, `docs/ARCHITECTURE.md`, `docs/COMPLEX_FEATURE_PATHS.md`, `docs/TROUBLESHOOTING.md`, and `.agent-context/PROJECT_CONTEXT.md`.
- Status:
  - User verified on iOS Hermes Mobile PWA that the behavior now works: right-swipe from the Codex thread page opens Codex's sidebar/thread switcher with the settings button instead of the first-launch Workspace page.
  - Local changes are uncommitted.
  - Static frontend/PWA change only; no Node listener restart is required.
  - Mobile/PWA clients must refresh, hard reload, or close/reopen to activate `codex-mobile-shell-v106`.

## 2026-05-29 Hermes Plugin Host-Back Result v107

- User correction:
  - Right-swipe/back from the Codex thread page now opens the Codex sidebar/settings surface correctly.
  - A second right-swipe/back while that sidebar/settings surface is open should return to Hermes Mobile's host navigation/tab surface, not close Codex back to the thread page where Hermes bottom tabs are hidden.
- Local fix:
  - `public/plugin-embed.js`
    - Added `codex-mobile.plugin.back_result` message helpers.
  - `public/app.js`
    - `handlePluginBack()` still closes iframe-owned modal/edit surfaces such as file preview, rename/action dialog, and subagent panel.
    - Normal thread/workspace/new-thread back still opens the Codex sidebar with the thread switcher/settings button.
    - If the Codex sidebar or settings surface is already open, `handlePluginBack()` now posts `codex-mobile.plugin.back_result` with `handled:false` and a bounded route instead of calling `closeSidebarMenu()`.
    - Shell build id bumped to `0.1.11|codex-mobile-shell-v107`.
  - `adapters/hermes-plugin-service.js`
    - Manifest navigation metadata now declares `back_result_message.type = codex-mobile.plugin.back_result`.
  - `public/sw.js`
    - Shell cache bumped to `codex-mobile-shell-v107`.
  - Tests/docs:
    - Updated `test/plugin-embed.test.js`, `test/hermes-plugin-service.test.js`, `test/hermes-plugin-route.test.js`, and `test/mobile-viewport.test.js`.
    - Updated README, `docs/ARCHITECTURE.md`, `docs/COMPLEX_FEATURE_PATHS.md`, `docs/TROUBLESHOOTING.md`, and `.agent-context/PROJECT_CONTEXT.md`.
- Status:
  - Local changes are uncommitted.
  - Hermes Mobile host still needs to consume `codex-mobile.plugin.back_result` with `handled:false` and perform host-level back/return; otherwise the iframe-side message alone cannot change Hermes navigation.
  - Static frontend/PWA change only; no Node listener restart is required after source load, but mobile/PWA clients must refresh, hard reload, or close/reopen to activate `codex-mobile-shell-v107`.

## 2026-05-29 Hermes Plugin Primary Page v108

- User correction:
  - The Codex thread-switcher/settings surface should not be a sidebar drawer inside Hermes.
  - It should be the plugin's first-level main page so Hermes Mobile can show its bottom navigation tabs there; Codex thread pages should be second-level pages.
- Local fix:
  - `public/plugin-embed.js`
    - Added `ui.primaryPage` route handling. The embedded primary page reports route `kind=root` and `canGoBack=false`.
    - `selectedCwd` alone no longer makes the plugin iframe backable; only thread detail, new-thread draft, and modal/edit transient states do.
  - `public/app.js`
    - Added `isHermesPluginPrimaryPage()`, `syncHermesPluginPageLevel()`, and `showHermesPluginPrimaryPage()`.
    - In `?embed=hermes`, thread detail/new-thread back now clears the selected detail and returns to the primary thread-switcher/settings page.
    - The local left-edge sidebar drawer gesture is disabled inside the Hermes iframe.
    - Shell build id bumped to `0.1.11|codex-mobile-shell-v108`.
  - `public/styles.css`
    - `html.embed-hermes.embed-hermes-primary` renders `#sidebar` as the full-width primary page, hides `.main`, hides the close-menu button, and makes the settings panel flow within the page instead of acting as a drawer overlay.
  - `public/sw.js`
    - Shell cache bumped to `codex-mobile-shell-v108`.
  - Tests/docs:
    - Updated `test/plugin-embed.test.js`, `test/hermes-plugin-route.test.js`, and `test/mobile-viewport.test.js`.
    - Updated README, `docs/ARCHITECTURE.md`, `docs/COMPLEX_FEATURE_PATHS.md`, `docs/TROUBLESHOOTING.md`, and `.agent-context/PROJECT_CONTEXT.md`.
- Status:
  - Local changes are uncommitted.
  - Static frontend/PWA change only; no Node listener restart is required after source load, but mobile/PWA clients must refresh, hard reload, or close/reopen to activate `codex-mobile-shell-v108`.

## 2026-05-29 Public And Private Publish v108

- User request:
  - Commit and push the current Codex Mobile Web changes, including the public repository.
- Public repository:
  - Path: `C:\Users\xuxin\Documents\codex-mobile-web-public`.
  - Synced public-safe changes from private since the previous public Usage release, including:
    - Hermes Mobile embedded plugin service and routes;
    - launch/session/origin registration contract;
    - HTTPS plugin base URL startup wiring;
    - `/?embed=hermes` frontend session/bootstrap/windowing/navigation handling;
    - v104-v108 Hermes iframe back/primary-page behavior;
    - shell cache `codex-mobile-shell-v108`;
    - README public release notes and project docs/tests.
  - Public commit pushed: `c15877f 发布 Hermes Mobile 嵌入插件能力`.
- Validation before publish:
  - Private `npm.cmd test` passed: 201/201.
  - Private `npm.cmd run check` passed.
  - Private `npm.cmd run check:macos` passed.
  - Private `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - Private BOM check produced no output.
  - Public `npm.cmd test` passed: 201/201.
  - Public `npm.cmd run check` passed.
  - Public `npm.cmd run check:macos` passed.
  - Public `git diff --check` and staged `git diff --cached --check` passed with only Windows LF-to-CRLF working-copy warnings.
  - Public BOM check produced no output.
  - Public privacy scan found no real local user path, personal Hermes/Tailscale/Synology domain, raw secret, Web Push runtime secret file content, or upload file content. Expected false positives were documentation warnings about VAPID private keys and fixed fake test tokens.
- Status:
  - Public repository is pushed at `c15877f`.
  - Private repository is being committed/pushed with this handoff entry.
  - Runtime/static note remains: server route/CSP/session/startup changes require a Node listener restart to activate in a running deployment; PWA clients must load `codex-mobile-shell-v108`.

## 2026-05-29 Hermes Plugin Notification Delegation v109

- User request:
  - Connect Codex Mobile to the Hermes Mobile plugin notification delegation contract.
  - The plugin iframe must not register Web Push by itself. Notification events should be sent by the Codex backend to Hermes Mobile so Hermes writes Action Inbox items and sends Web Push through Hermes PWA subscriptions.
- Local fix:
  - Added `adapters/hermes-notification-delegate-service.js`.
    - Normalizes safe summary-only notification payloads.
    - Requires stable `eventId` or `sourceId`.
    - Allows only bounded title/summary, allowed item type/priority, and small route metadata.
    - Rejects raw access keys, bearer tokens, launch tokens, Push endpoint markers, local runtime paths, DB paths, private content fields, and long unsafe values.
    - Sends server-side `POST /api/hermes-plugins/codex-mobile/notifications` with `X-Hermes-Web-Key`.
    - Resolves Hermes base URL from `CODEX_MOBILE_HERMES_PLUGIN_NOTIFICATION_BASE_URL` or the registered workspace callback/app origin.
    - Reads the Hermes key from `CODEX_MOBILE_HERMES_PLUGIN_NOTIFICATION_KEY`, `CODEX_MOBILE_HERMES_PLUGIN_NOTIFICATION_KEY_FILE`, or `CODEX_MOBILE_HERMES_WEB_KEY` fallbacks.
  - `server.js`
    - Wires the delegate service.
    - Adds Codex-authenticated `POST /api/v1/hermes/plugin/notifications` as a backend test/delegation route.
    - Exposes `hermesPlugin.notificationDelegatePath` and `notificationDelegateConfigured` in `/api/public-config`.
    - Delegates turn-completed notifications to Hermes when configured; direct Mobile Web Push remains the standalone fallback when not configured.
  - `adapters/hermes-plugin-service.js`
    - Manifest now advertises the metadata-only notification delegation contract and Hermes endpoint path without returning any key, token, Push endpoint, local secret path, or private content.
  - `public/app.js`
    - `/?embed=hermes` disables browser Push registration and local completion alerts so Hermes owns Inbox/Web Push delivery.
    - Shell build id bumped to `0.1.11|codex-mobile-shell-v109`.
  - `public/sw.js`
    - Shell cache bumped to `codex-mobile-shell-v109`.
  - Tests/docs:
    - Added `test/hermes-notification-delegate-service.test.js`.
    - Updated Hermes plugin route/manifest/mobile viewport tests.
    - Updated README, architecture, modules, troubleshooting, complex feature path, and project context docs.
- Validation:
  - Focused `node --test test\hermes-notification-delegate-service.test.js test\hermes-plugin-service.test.js test\hermes-plugin-route.test.js test\mobile-viewport.test.js` passed: 21/21.
  - `node --check adapters\hermes-notification-delegate-service.js` passed.
  - `node --check server.js`, `node --check public\app.js`, and `node --check public\sw.js` passed.
  - `npm.cmd test` passed: 208/208.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
- Activation:
  - Restarted only the 8787 Node listener to load the new server route/delegate wiring: old PID `61208`, new PID `31916`.
  - `/api/public-config` now returns `clientBuildId=0.1.11|codex-mobile-shell-v109`, `shellCacheName=codex-mobile-shell-v109`, and `hermesPlugin.notificationDelegatePath=/api/v1/hermes/plugin/notifications`.
  - `hermesPlugin.notificationDelegateConfigured=false` in the current process because no Hermes notification key is configured.
  - Authenticated `/api/status` returns `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, and `lastError=null`.
  - Authenticated runtime route check against `/api/v1/hermes/plugin/notifications` reaches the new route and returns `503 hermes_notification_key_not_configured`, which is expected until a server-side Hermes key is configured.
- Status:
  - Local changes are uncommitted.
  - Static/PWA clients must refresh, hard reload, or close/reopen to load `codex-mobile-shell-v109`.

## 2026-05-29 Hermes Plugin Notification Startup Wiring

- User request:
  - Fix the immediate Hermes plugin notification/InBox failure with the smallest possible change set because the remaining Codex quota was low.
  - Reconfigure and restart the 8787 service so plugin Web Push delegation remains enabled after future scheduled-task restarts.
- Local fix:
  - Added startup-script parameter wiring for the Hermes notification delegate:
    - `start-codex-mobile-web.ps1`
    - `start-codex-mobile-web-windowless.ps1`
    - `install-codex-mobile-web-startup.ps1`
  - New startup parameters:
    - `-HermesPluginNotificationBaseUrl`
    - `-HermesPluginNotificationKey`
    - `-HermesPluginNotificationKeyFile`
  - Updated `test/hermes-plugin-route.test.js` to assert the startup/install scripts persist those notification parameters.
- Validation:
  - Focused `node --test test\hermes-plugin-route.test.js test\hermes-notification-delegate-service.test.js` passed: 11/11.
  - `node --check server.js` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings.
- Activation:
  - Re-registered the `Codex Mobile Web` scheduled task so its action now includes:
    - `-HermesPluginNotificationBaseUrl "https://hermes-xuxin.synology.me:8445"`
    - `-HermesPluginNotificationKeyFile "C:\ProgramData\HermesMobile\data\secrets\owner-web-key.secret"`
  - The first restart attempt only replaced the child `node server.js` process; the old windowless supervisor kept relaunching it with stale arguments.
  - Stopped the old scheduled-task chain (`wscript.exe` / `start-codex-mobile-web-windowless.ps1` / `server.js`) and cold-started the task again.
  - Fresh process chain now shows the new notification arguments:
    - supervisor PID `57584`
    - node listener PID `16264`
  - `/api/public-config.hermesPlugin.notificationDelegateConfigured` is now `true`.
  - Authenticated runtime test against `POST /api/v1/hermes/plugin/notifications` now succeeds and Hermes returns `202` with Inbox item id `ainb_mpqoef9j_8c235fcb`.
- Status:
  - Plugin notification delegation is now live on the current 8787 service and persisted in the scheduled-task startup path.
  - Local code/docs changes remain uncommitted.

## 2026-05-29 Hermes Plugin Composer Bottom Spacing v110

- User report:
  - In the Hermes embedded plugin, the composer/input area sat too close to the bottom edge.
- Local fix:
  - `public/styles.css`
    - Added Hermes-embed-only composer bottom padding so the iframe composer keeps more space above the device bottom edge and host chrome.
    - Added matching `html.embed-hermes.keyboard-open` padding overrides.
    - Added narrower `@media (max-width: 760px)` Hermes-embed overrides so phone-sized iframe layouts keep the extra bottom spacing too.
  - `public/app.js` / `public/sw.js`
    - Bumped the static shell build/cache to `0.1.11|codex-mobile-shell-v110` / `codex-mobile-shell-v110` so mobile/PWA/plugin clients pick up the CSS change.
  - `test/mobile-viewport.test.js`
    - Added assertions for the Hermes-embed composer padding overrides and updated the shell version check to `v110`.
- Validation:
  - Focused `node --test test\mobile-viewport.test.js test\hermes-plugin-route.test.js` passed: 7/7.
  - `node --check public\app.js` and `node --check public\sw.js` passed.
- Status:
  - Static frontend/PWA change only; no Node listener restart is required.
  - Embedded/plugin clients must refresh, hard reload, or close/reopen to load `codex-mobile-shell-v110`.

## 2026-05-29 Hermes Plugin Route Hints v111

- User request:
  - Hermes Mobile notification opens now pass bounded iframe query hints such as
    `pluginRoute`, `pluginItemId`, `pluginThreadId`, `pluginTaskId`, and
    `pluginId=codex-mobile`.
  - In `/?embed=hermes`, Codex should consume those hints, focus the matching
    thread/task when available, and otherwise stay on the normal embedded
    primary page with a bounded in-app diagnostic.
- Local fix:
  - `public/plugin-embed.js`
    - `detect()` now parses bounded route-hint fields from the iframe URL.
  - `public/app.js`
    - Added bounded route-hint normalization and URL parsing.
    - Added `openHermesPluginRouteHint()` / `applyUrlPluginRouteHint()` so
      embedded startup, `pageshow`, and `focus` consume Hermes route hints.
    - Matching `pluginThreadId` opens that thread inside the iframe.
    - Matching `pluginTaskId` or `pluginItemId` focuses the approval/item card
      in the conversation when it still exists.
    - Missing targets now return to the embedded primary page and show bounded
      diagnostics such as `Notification target is unavailable`, instead of
      leaving a broken detail route selected.
    - Consumed route hints are scrubbed from the URL back to the embed root.
    - Static shell build id bumped to `0.1.11|codex-mobile-shell-v111`.
  - `public/sw.js`
    - Shell cache bumped to `codex-mobile-shell-v111`.
  - Tests/docs:
    - Updated `test/plugin-embed.test.js`, `test/hermes-plugin-route.test.js`,
      and `test/mobile-viewport.test.js`.
    - Updated README, architecture, troubleshooting, complex feature paths, and
      project context docs.
- Validation:
  - `node --check public\app.js` passed.
  - `node --check public\plugin-embed.js` passed.
  - `node --check public\sw.js` passed.
  - Focused `node --test test\plugin-embed.test.js test\hermes-plugin-route.test.js test\mobile-viewport.test.js` passed: 12/12.
- Status:
  - Static frontend/PWA change only; no Node listener restart is required.
  - Embedded/plugin clients must refresh, hard reload, or close/reopen to load `codex-mobile-shell-v111`.

## 2026-05-29 Dual CODEX_HOME Investigation

- User request:
  - Explore whether two ChatGPT/Codex accounts can coexist on the same PC and later support separate workspace/account selection, with Desktop being non-essential and CLI considered sufficient.
- What was implemented locally:
  - Created two independent CLI homes:
    - `C:\Users\xuxin\.codex-homes\current`
    - `C:\Users\xuxin\.codex-homes\previous`
  - Copied base `config.toml` into both homes and rewired embedded `CODEX_HOME` / Node REPL trusted-path settings to the corresponding home.
  - Kept shared non-auth assets via junctions to the existing global directories where practical (`plugins`, `skills`, `memories`, cache-like folders), while leaving per-home auth/config/state files local to each home.
  - Added desktop helper launchers:
    - `C:\Users\xuxin\OneDrive\Desktop\Codex-Current-Account.cmd`
    - `C:\Users\xuxin\OneDrive\Desktop\Codex-Current-Account-Login.cmd`
    - `C:\Users\xuxin\OneDrive\Desktop\Codex-Previous-Account.cmd`
    - `C:\Users\xuxin\OneDrive\Desktop\Codex-Previous-Account-Login.cmd`
  - The `.cmd` launchers now default to opening `C:\Users\xuxin\Documents\Agent` unless a workspace path argument is supplied.
- Verified findings:
  - CLI isolation works at the file/auth level:
    - `CODEX_HOME=current` login status: `Logged in using ChatGPT`
    - `CODEX_HOME=previous` login status: `Not logged in`
  - `C:\Users\xuxin\.codex-homes\previous\auth.json` was still absent after trying the Desktop-oriented login flow.
  - Conclusion: current Codex Desktop App GUI login is not isolated by `CODEX_HOME`; it appears to use global app-package state rather than per-home `auth.json`.
- Durable conclusion:
  - `CODEX_HOME` is good enough for multi-account Codex CLI separation.
  - `CODEX_HOME` is not enough for two concurrently independent Codex Desktop GUI ChatGPT logins on this machine.
  - A dedicated implementation note now exists at `docs/MULTI_ACCOUNT_CODEX_CLI.md`.
  - If future work resumes, the clean path is CLI-first:
    - log the second account into `C:\Users\xuxin\.codex-homes\previous` using a CLI flow that really writes that home's `auth.json`;
    - then, if needed, build two separate Codex Mobile Web instances, one per account, with different ports/runtime dirs/access keys and different CLI backends.
- Current status:
  - This investigation changed only local helper files outside the repo plus the shared-context notes here.
  - No Codex Mobile runtime/service change was made from this investigation alone.

## 2026-05-29 Hermes Plugin Detailed Completion Receipt

- User requirement:
  - Standalone Web App Push should keep the old short format.
  - Hermes plugin notifications should still send a short Web Push/InBox preview,
    but Inbox/thread detail should also include the long completed-turn receipt.
- Local implementation:
  - Added `adapters/turn-completion-receipt-service.js`.
    - Extracts final assistant receipt text from `turn/completed` payloads.
    - Builds bounded Markdown `detailMessage` content.
    - Appends Usage summary when rollout token stats are available.
  - Extended `adapters/hermes-notification-delegate-service.js`.
    - Supports `detailMessage`.
    - Supports small route metadata fields `threadId` and `taskId`.
    - Contract now advertises short preview plus optional detail message instead
      of summary-only storage.
  - `server.js`
    - Hermes turn-completed delegation now includes:
      - short `title + summary` preview;
      - route metadata with both `threadId` and `taskId`;
      - bounded Markdown `detailMessage` built from final receipt + Usage.
    - Standalone Web Push fallback path remains unchanged.
  - `adapters/hermes-plugin-service.js`
    - Manifest notifications contract now advertises
      `supports_detail_message=true` and `stores_summary_only=false`.
- Validation:
  - `node --check adapters\turn-completion-receipt-service.js` passed.
  - `node --check adapters\hermes-notification-delegate-service.js` passed.
  - `node --check adapters\hermes-plugin-service.js` passed.
  - `node --check server.js` passed.
  - Focused `node --test test\turn-completion-receipt-service.test.js test\hermes-notification-delegate-service.test.js test\hermes-plugin-service.test.js test\hermes-plugin-route.test.js` passed: 23/23.
- Activation:
  - Server-side change; requires 8787 Node listener restart to take effect.

## 2026-05-29 Cross-Thread Task Card Planning Docs And Harness

- User request:
  - Before implementing cross-thread task cards, add dedicated requirement,
    design, and implementation docs plus a related harness.
  - The feature direction is:
    - source thread sends a pending task card to a target thread;
    - target user can approve to inject into message flow, delete, or reply;
    - source user can revoke while pending.
- Added docs:
  - `docs/CROSS_THREAD_TASK_CARDS_REQUIREMENTS.md`
  - `docs/CROSS_THREAD_TASK_CARDS_DESIGN.md`
  - `docs/CROSS_THREAD_TASK_CARDS_IMPLEMENTATION.md`
  - `docs/README.md` now links the design doc from the reading guide.
  - `docs/COMPLEX_FEATURE_PATHS.md` now has a dedicated implementation path
    section for cross-thread task cards.
- Added harness:
  - `test/thread-task-card-harness.test.js`
  - This is an executable contract/state-machine harness, not the production
    implementation. It fixes the planned behavior for:
    - bounded create payloads;
    - target approve -> injected message;
    - target delete -> no injection;
    - source revoke while pending;
    - target reply -> reverse-direction controlled card.
- Added context references:
  - `.agent-context/PROJECT_CONTEXT.md`
  - `docs/MODULES.md` test map
- Status:
  - This step adds planning docs and harness only.
  - No cross-thread task-card product routes/UI/storage are implemented yet.

## 2026-05-29 Cross-Thread Task Cards v112

- User request:
  - Move from planning docs/harness into a real first implementation.
- Local implementation:
  - Added `adapters/thread-task-card-service.js`.
    - Normalizes bounded create/reply payloads.
    - Persists card state in `%USERPROFILE%\.codex-mobile-web\thread-task-cards.json` by default, or `CODEX_MOBILE_THREAD_TASK_CARD_FILE` when overridden.
    - Enforces source/target thread role checks, idempotency, and state transitions.
    - Approve triggers a real target-thread injection payload instead of a fake static message.
  - `server.js`
    - Instantiates the task-card service.
    - Adds routes:
      - `POST /api/thread-task-cards`
      - `GET /api/thread-task-cards/:id`
      - `POST /api/thread-task-cards/:id/approve`
      - `POST /api/thread-task-cards/:id/delete`
      - `POST /api/thread-task-cards/:id/revoke`
      - `POST /api/thread-task-cards/:id/reply`
    - Thread detail responses now attach bounded `thread.threadTaskCards`.
    - Target-side approve resumes the target thread if needed and injects a real new `turn/start` input into that thread.
  - `public/app.js`
    - Adds `threadTaskCards` render signature support.
    - Renders task cards in a separate stack outside normal turn items.
    - Adds per-card actions for approve, delete, revoke, and reply.
    - Adds a minimal `Send task card` entry in thread detail using prompt-based target/title/body capture.
    - Plugin route-target focus can now land on task-card DOM nodes through `data-task-card`.
  - `public/sw.js` / `public/app.js`
    - Shell cache/build bumped to `codex-mobile-shell-v112` / `0.1.11|codex-mobile-shell-v112`.
  - Tests:
    - Added `test/thread-task-card-service.test.js`
    - Added `test/thread-task-card-route.test.js`
    - Existing `test/thread-task-card-harness.test.js` kept green.
- Validation:
  - Focused `node --test test\thread-task-card-harness.test.js test\thread-task-card-service.test.js test\thread-task-card-route.test.js test\mobile-viewport.test.js` passed: 13/13.
  - `npm.cmd test` passed: 223/223.
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only existing Windows LF-to-CRLF working-copy warnings.
- Activation:
  - Server route/service changes require restarting the 8787 Node listener.
  - Static browser behavior changed too; clients need `codex-mobile-shell-v112`.
- Current boundary:
  - The task-card state machine and API are implemented.
  - The browser compose entry is intentionally minimal; target resolution currently depends on exact visible thread title or explicit thread id.
  - There is no live SSE push path for task-card updates yet; browser actions refresh thread detail after each mutation.

## 2026-05-29 `#` Natural-Language Thread Task Cards v113

- User request:
  - Reserve `#` in the composer so the current thread can issue natural-language
    cross-thread task-card commands.
  - Parse them into a task-card draft, then confirm before send.
- Local implementation:
  - Added `adapters/thread-task-card-intent-service.js`.
    - Strips leading `#`.
    - Parses a bounded set of command-like natural-language patterns.
    - Builds draft `title` / `summary` / `body`.
    - Scores target-thread candidates from visible threads/state and refuses to
      auto-select ambiguous matches.
  - `server.js`
    - Instantiates the intent parser service.
    - Adds `POST /api/thread-task-cards/parse`.
    - Uses visible thread metadata from `thread/list` with state-db/session-index fallback.
  - `public/app.js`
    - `#...` at the start of a message now bypasses the normal message-send path.
    - Sends the command to `/api/thread-task-cards/parse`.
    - Shows a browser confirmation dialog for the parsed draft.
    - On confirmation, creates a normal pending task card through the existing task-card API.
    - Bare `#`, missing target/body, attachments, and ambiguous targets fail closed with an error instead of silently sending.
  - `public/app.js` / `public/sw.js`
    - Shell build/cache bumped to `0.1.11|codex-mobile-shell-v113` / `codex-mobile-shell-v113`.
  - Tests:
    - Added `test/thread-task-card-intent-service.test.js`
    - Updated `test/thread-task-card-route.test.js`
    - Updated `test/mobile-viewport.test.js`
- Validation:
  - Focused `node --test test\thread-task-card-intent-service.test.js test\thread-task-card-service.test.js test\thread-task-card-route.test.js test\thread-task-card-harness.test.js test\mobile-viewport.test.js` passed: 16/16.
  - `npm.cmd test` passed: 223/223.
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only existing Windows LF-to-CRLF working-copy warnings.
- Activation:
  - Static browser behavior changed and server route changed.
  - Restart 8787 listener and refresh/reopen clients to load `codex-mobile-shell-v113`.
- Current boundary:
  - This is model-like natural-language command parsing but still bounded and conservative; it is not a free-form agent that can safely infer arbitrary targets.
  - The confirmation step remains mandatory before creating the pending task card.
## 2026-05-29 `#` Task-card Drafts v114

- User correction:
  - The dedicated `/api/thread-task-cards/parse` route and local regex command parser were the wrong architecture.
  - `#` commands should be interpreted by the current Codex thread, with the user approving the resulting draft before any real cross-thread card is created.
- Local implementation:
  - Removed `adapters/thread-task-card-intent-service.js` and the `POST /api/thread-task-cards/parse` route.
  - `public/app.js`
    - `#...` now sends through the normal current-thread message path, but the browser wraps the original command in a bounded draft-request envelope that includes the visible target-thread list and a required XML/JSON response schema.
    - User-message rendering hides that internal envelope and shows only the original `#` command text.
    - Agent/plan messages that return `<codex-mobile-thread-task-card-draft>...</codex-mobile-thread-task-card-draft>` now render as a local approval card instead of raw markdown.
    - Approving that draft creates a real pending task card through the existing task-card API; dismissing it stays local to the browser.
  - `public/app.js` / `public/sw.js`
    - Static shell build/cache bumped to `0.1.11|codex-mobile-shell-v114` / `codex-mobile-shell-v114`.
  - Tests/docs:
    - Removed `test/thread-task-card-intent-service.test.js`.
    - Updated task-card route tests, conversation render tests, composer draft tests, architecture, modules, troubleshooting, README, project context, and this handoff.
- Validation:
  - Focused `node --test test\thread-task-card-route.test.js test\conversation-render.test.js test\composer-draft.test.js test\thread-task-card-service.test.js test\thread-task-card-harness.test.js` passed: 29/29.
  - `node --check public\app.js` passed.
  - `node --check server.js` passed.
- Status:
  - This supersedes the earlier v113 parse-route path.
  - Server restart and client refresh are still required before `v114` becomes active everywhere.

## 2026-05-30 Task-card Draft Approve Visibility v115

- User report:
  - Clicking `Approve` on a `#`-generated task-card draft looked ineffective.
  - After a long wait the action ended, and the target thread appeared not to receive the pending card.
- Diagnosis:
  - Pending cards were already being persisted successfully in `%USERPROFILE%\.codex-mobile-web\thread-task-cards.json`.
  - The perceived failure was mainly a visibility/UX problem:
    - source-side draft approval used a timestamped idempotency key, so repeated taps created duplicate pending cards;
    - the draft-approval path waited on a source-thread reread after creation, which could feel hung on large threads;
    - thread-list summaries did not expose incoming pending-card counts, so the target thread had no obvious badge;
    - the draft approval UI read `result.id` even though the route returns `{ ok, card }`.
- Local implementation:
  - `adapters/thread-task-card-service.js`
    - Added `pendingCountsForThread()` so thread summaries can expose pending incoming/outgoing counts without relying on bounded detail-card lists.
  - `server.js`
    - Thread-detail enrichment now adds:
      - `pendingTaskCardCount`
      - `pendingIncomingTaskCardCount`
      - `pendingOutgoingTaskCardCount`
    - Thread-list and fallback thread-list responses now also attach those summary counts.
  - `public/app.js`
    - Source-side draft approval now uses stable idempotency key `task-card-draft:<sourceThreadId>:<draftKey>`.
    - Corrected create-response handling to read `result.card.id`.
    - Added local summary/count updates after successful creation.
    - Added immediate target-thread open after successful draft approval instead of waiting for source-thread reread.
    - Thread-list rows now show an incoming `Task N` badge when `pendingIncomingTaskCardCount > 0`.
  - `public/styles.css`
    - Added task-badge styling for thread-list rows.
  - `public/app.js` / `public/sw.js`
    - Shell build/cache bumped to `0.1.11|codex-mobile-shell-v115` / `codex-mobile-shell-v115`.
- Validation:
  - Focused `node --test test\thread-task-card-service.test.js test\thread-task-card-route.test.js test\mobile-viewport.test.js` passed: 8/8.
  - `node --check public\app.js` passed.
  - `node --check server.js` passed.
  - `git diff --check` passed with only existing Windows LF-to-CRLF working-copy warnings.
- Activation:
  - Server and frontend both changed.
  - Restart the 8787 Node listener.
  - Refresh/reopen clients to load `codex-mobile-shell-v115`.

## 2026-05-30 Task-card Target Focus v116

- Follow-up diagnosis:
  - Target-thread API responses already contained `thread.threadTaskCards`.
  - The remaining visibility bug was that pending cards render above the turn list, while opening a long target thread still followed the normal "show latest content" path and left the browser at the bottom.
- Local implementation:
  - `public/app.js`
    - After source-side `#` draft approval creates a card, Mobile Web now stores a local route-hint target for that exact task-card id.
    - The existing `applyPendingPluginRouteHintFocus()` path then scrolls the target thread directly to the pending task card after the thread loads, instead of leaving the user at the bottom of the long conversation.
  - `public/app.js` / `public/sw.js`
    - Static shell build/cache bumped to `0.1.11|codex-mobile-shell-v116` / `codex-mobile-shell-v116`.
- Validation:
  - Focused `node --test test\thread-task-card-route.test.js test\mobile-viewport.test.js` passed: 5/5.
  - `node --check public\app.js` passed.
- Activation:
  - Static frontend change only.
  - Refresh/reopen clients to load `codex-mobile-shell-v116`.

## 2026-05-30 Task-card Bottom Placement v117

- User correction:
  - Cross-thread task cards should live at the bottom of the target thread, not above the historical conversation.
- Local implementation:
  - `public/app.js`
    - Reordered target-thread detail rendering so `threadTaskCards` now render after visible turns and detached approval cards.
    - Kept the exact-card route-hint focus path in place for cases where a specific pending card still needs direct focus.
  - `public/app.js` / `public/sw.js`
    - Static shell build/cache bumped to `0.1.11|codex-mobile-shell-v117` / `codex-mobile-shell-v117`.
- Validation:
  - Focused `node --test test\thread-task-card-route.test.js test\mobile-viewport.test.js` passed: 5/5.
  - `node --check public\app.js` passed.
- Activation:
  - Static frontend change only.
  - Refresh/reopen clients to load `codex-mobile-shell-v117`.

## 2026-05-30 Hide Settled Task Cards v118

- User correction:
  - Once a cross-thread task card is approved, the card itself should get out of the way. Keeping a large approved card at the bottom can still obscure the newly injected turn.
- Local implementation:
  - `public/app.js`
    - `threadTaskCardsForThread()` now renders only `pending` cards in thread detail.
    - `approved`, `deleted`, `revoked`, and `replied` cards remain in runtime audit/state but no longer render in the conversation UI.
  - `public/app.js` / `public/sw.js`
    - Static shell build/cache bumped to `0.1.11|codex-mobile-shell-v118` / `codex-mobile-shell-v118`.
- Validation:
  - Focused `node --test test\thread-task-card-route.test.js test\mobile-viewport.test.js` passed: 5/5.
  - `node --check public\app.js` passed.
- Activation:
  - Static frontend change only.
  - Refresh/reopen clients to load `codex-mobile-shell-v118`.

## 2026-05-30 Immediate Current-Thread Task Card Settlement v120

- User correction:
  - After target-side `Approve`, the current thread should remove the pending task card immediately.
  - Waiting until leave/re-enter to hide the card is too slow and makes it look like the action did not finish.
- Local implementation:
  - `public/app.js`
    - `incrementPendingIncomingTaskCardCount()` and `incrementPendingOutgoingTaskCardCount()` now also update the active `state.currentThread` counts when the current thread is the affected thread.
    - Added `settleCurrentThreadTaskCard(cardId, nextStatus, nextCard)` to mark the active current-thread card as settled locally and re-render immediately.
    - `mutateThreadTaskCard()` now calls that local settlement path as soon as approve/delete/revoke/reply returns successfully, before the follow-up `loadThread()` refresh finishes.
  - `public/app.js` / `public/sw.js`
    - Static shell build/cache bumped to `0.1.11|codex-mobile-shell-v120` / `codex-mobile-shell-v120`.
- Validation:
  - `node --check public\app.js` passed.
  - `node --check public\sw.js` passed.
  - Focused `node --test test\thread-task-card-route.test.js test\mobile-viewport.test.js` passed: 5/5.
- Activation:
  - Static frontend change only.
  - Refresh/reopen clients to load `codex-mobile-shell-v120`.

## 2026-05-30 Foreground Current-Thread Silent Refresh v121

- User report:
  - Returning to Mobile Web from another app could show `Loading thread...` again for the already open current thread.
- Local implementation:
  - `public/app.js`
    - `resumeMobileSession()` now keeps an already open current thread rendered, silently refreshes the thread list, and schedules a lightweight current-thread refresh instead of blocking on a same-thread reload path.
    - `applyUrlThreadSelection()` now avoids re-opening the current thread through `loadThread()` when a URL hint already matches the active thread; it schedules a lightweight refresh instead.
  - `public/app.js` / `public/sw.js`
    - Static shell build/cache bumped to `0.1.11|codex-mobile-shell-v121` / `codex-mobile-shell-v121`.
- Validation:
  - `node --check public\app.js` passed.
  - `node --check public\sw.js` passed.
  - Focused `node --test test\mobile-viewport.test.js test\thread-task-card-route.test.js` passed.
- Activation:
  - Static frontend change only.
  - Refresh/reopen clients to load `codex-mobile-shell-v121`.

## 2026-05-30 Startup Thread Opening Stabilization v122

- User report:
  - First load when opening directly into a thread still flashed the Workspace/recent-thread home screen before the target thread appeared.
- Local implementation:
  - `public/app.js`
    - `bootstrap()` now marks a startup thread-open-pending state when startup already knows a direct thread target from a saved thread id, URL `thread` hint, or Hermes plugin route-hint thread id.
    - While that state is pending, the first `loadThreads()` call stays silent and the main panel renders a stable `Opening thread...` placeholder instead of the Workspace/recent-thread home view.
    - The pending state clears as soon as the real thread opens or startup falls back to the normal home/new-thread path.
  - `public/app.js` / `public/sw.js`
    - Static shell build/cache bumped to `0.1.11|codex-mobile-shell-v122` / `codex-mobile-shell-v122`.
- Validation:
  - `node --check public\app.js` passed.
  - `node --check public\sw.js` passed.
  - Focused `node --test test\mobile-viewport.test.js test\thread-task-card-route.test.js` passed.
- Activation:
  - Static frontend change only.
  - Refresh/reopen clients to load `codex-mobile-shell-v122`.

## 2026-05-30 Hermes Embed Recovering State v123

- User report:
  - Hermes plugin startup could still flash a red `Codex` auth/session error panel, then succeed after one more refresh.
- Local implementation:
  - `public/app.js`
    - Added `showPluginEmbedRecovering()` for embed-mode launch/session/auth failures that already request a Hermes-side iframe refresh.
    - `onUnauthorized`, launch-session exchange failure, missing plugin session, and bootstrap unauthorized-session recovery now keep the iframe in a neutral recovering state instead of showing the red plugin auth/login panel first.
  - `public/app.js` / `public/sw.js`
    - Static shell build/cache bumped to `0.1.11|codex-mobile-shell-v123` / `codex-mobile-shell-v123`.
- Validation:
  - `node --check public\app.js` passed.
  - `node --check public\sw.js` passed.
  - Focused `node --test test\mobile-viewport.test.js test\thread-task-card-route.test.js test\hermes-plugin-route.test.js` passed.
- Activation:
  - Static frontend change only.
  - Refresh/reopen clients to load `codex-mobile-shell-v123`.

## 2026-05-30 Task-card Draft/Approve Feedback Stabilization v124

- User report:
  - Before the formal cross-thread draft card appeared, the conversation could briefly show raw XML/code from the bounded draft schema.
  - `#` draft generation had no visible in-thread progress state while the current turn was still producing the draft.
  - Target-side `Approve` could look hung even after the backend had started injection, because the current thread reused the same-thread `loadThread()` cache path and did not immediately show the injected turn.
  - Pending task cards and draft cards were too large because the full body rendered immediately.
- Local implementation:
  - `public/app.js`
    - Added pending draft placeholders for `#` command turns while the current live turn is still generating a draft.
    - Suppresses raw `<codex-mobile-thread-task-card-draft>...</...>` streaming text until a valid draft block is ready.
    - Changed `refreshCurrentThreadAfterTaskCard()` to use `refreshCurrentThread()` instead of same-thread `loadThread()`.
    - Added `waitForCurrentThreadTurn()` so target-side `Approve` briefly polls for the returned injected `turnId` and then focuses that turn directly once it becomes visible.
    - Pending task-card drafts and pending task cards now render as medium cards with a visible summary line and collapsed details/body.
  - `public/styles.css`
    - Added collapsed task-card detail styling via `.approval-summary-line` and `.approval-details`.
  - `public/app.js` / `public/sw.js`
    - Static shell build/cache bumped to `0.1.11|codex-mobile-shell-v124` / `codex-mobile-shell-v124`.
- Validation:
  - `node --check public\app.js` passed.
  - `node --check public\sw.js` passed.
  - Focused `node --test test\thread-task-card-route.test.js test\mobile-viewport.test.js test\conversation-render.test.js` passed: 21/21.
- Activation:
  - Static frontend change only.
  - Refresh/reopen clients to load `codex-mobile-shell-v124`.

## 2026-05-30 Hermes Embed Action Visibility And PR Routing v125

- User report:
  - In Hermes embed mode, the version pill plus `Restart` / `Public PR` controls disappeared from the sidebar header.
  - Thread-level actions such as `压缩续接` were unreliable because the embed experience still depended on long-press only.
  - Accepting the public-PR prompt could prepare the merge-review task inside an unrelated currently open Hermes/Agent thread instead of the Codex Mobile Web workspace.
- Local implementation:
  - `public/styles.css`
    - Hermes embed now hides only `.main .version-actions`, leaving the sidebar header version-action row visible.
    - Added `.thread-card-menu-button` styling for an explicit thread action button in embed thread rows.
  - `public/app.js`
    - Embed thread rows now render a direct `⋯` action button that opens the existing action sheet without relying only on long-press timing.
    - Added `handleThreadMenuButtonClick()`.
    - `preparePublicPrMergePrompt()` now clears the current thread selection, opens a new-thread draft for `state.appWorkspacePath`, and places the review task text there instead of reusing the currently open thread.
    - Client startup now stores `config.workspacePath` from `/api/public-config` in `state.appWorkspacePath`.
  - `server.js`
    - `/api/public-config` now includes `workspacePath: APP_ROOT` so the browser can route public-PR review tasks back into this workspace.
  - `public/app.js` / `public/sw.js`
    - Static shell build/cache bumped to `0.1.11|codex-mobile-shell-v125` / `codex-mobile-shell-v125`.
- Validation:
  - `node --check public\app.js` passed.
  - `node --check server.js` passed.
  - Focused `node --test test\app-update.test.js test\manual-restart-ui.test.js test\mobile-viewport.test.js test\thread-task-card-route.test.js` passed: 13/13.
- Activation:
  - Frontend and server changed.
  - Restart the 8787 Node listener, then refresh/reopen clients to load `codex-mobile-shell-v125`.

## 2026-05-30 Hermes Embed Continuation Dialog Fix v126

- User correction:
  - The real embed bug was not missing access to the thread action sheet itself.
  - Long-press was already enough to open the menu, but choosing `压缩续接` did not show the confirmation popup inside the Hermes plugin iframe.
- Local implementation:
  - `public/app.js`
    - Replaced the `window.confirm(...)` continuation confirmation path with an in-app `#continuationDialog` flow.
    - Added `openContinuationDialog()`, `closeContinuationDialog()`, and `continuationDialogOpen()` so `压缩续接` can confirm entirely inside the iframe.
    - Hermes plugin back handling now closes the continuation dialog before falling through to other navigation layers.
    - Removed the earlier experimental embed-only thread-row menu button path and went back to the original long-press action-sheet trigger.
  - `public/index.html`
    - Added the continuation confirmation dialog markup.
  - `public/styles.css`
    - Added continuation-dialog styling and removed the temporary `.thread-card-menu-button` styling.
  - `public/app.js` / `public/sw.js`
    - Static shell build/cache bumped to `0.1.11|codex-mobile-shell-v126` / `codex-mobile-shell-v126`.
- Validation:
  - `node --check public\app.js` passed.
  - `node --check public\sw.js` passed.
  - Focused `node --test test\app-update.test.js test\manual-restart-ui.test.js test\mobile-viewport.test.js test\thread-task-card-route.test.js` passed: 13/13.
- Activation:
  - Static frontend change only for the continuation dialog itself.
  - The earlier v125 `/api/public-config.workspacePath` server fix still requires the 8787 Node listener restart if it has not been restarted yet.
  - Refresh/reopen clients to load `codex-mobile-shell-v126`.

## 2026-05-30 Restart Readiness Harness

- User report:
  - A restart attempt stopped the old `8787` listener, but Mobile Web did not come back immediately and the browser became unusable until a later Desktop-side recovery.
- Local follow-up:
  - Added a focused harness for `restart-codex-mobile-shared-chain.ps1` so future edits keep the correct success definition:
    - wait for both HTTP readiness and mux endpoint readiness;
    - only log `Shared-chain restart finished.` after `Wait-Ready`;
    - timeout if replacement readiness never arrives.
  - Updated README, troubleshooting, and project context to state the operational rule:
    - "old listener exited" does not count as restart success;
    - success requires a new `8787` listener plus reachable `/api/public-config`.

## 2026-05-30 Hermes Plugin Refresh Notice Emphasis v128

- User feedback:
  - The new in-app "Refreshing plugin page..." notice was visible, but its color blended in too much with ordinary history notes.
- Local implementation:
  - `public/styles.css`
    - Added a stronger warning-like `plugin-refresh-pending` visual treatment with higher-contrast text/background/border.
  - `public/app.js` / `public/sw.js`
    - Static shell build/cache bumped to `0.1.11|codex-mobile-shell-v128` / `codex-mobile-shell-v128`.
- Validation:
  - Focused `node --test test\hermes-plugin-route.test.js test\mobile-viewport.test.js` passed as part of the current frontend regression set.
- Activation:
  - Static frontend change only.
  - Refresh/reopen clients to load `codex-mobile-shell-v128`.

## 2026-05-30 Draft Persistence And Timed Refresh Notice v129

- User report:
  - In the source thread, a `#`-generated cross-thread draft card could disappear immediately after `Approve`, but then reappear after leaving and re-entering the thread.
  - Hermes plugin refresh notices should explain an automatic host-driven refresh, but should not remain visible indefinitely.
- Local implementation:
  - `public/app.js`
    - Added durable browser storage for settled source draft-card state under `codexMobileThreadTaskCardDraftStates`.
    - `setThreadTaskCardDraftState()` now persists durable states through `saveThreadTaskCardDraftStates()`.
    - `renderTurnThreadTaskCardDraft()` now suppresses source draft cards whose stored state is already `created` or `dismissed`, preventing old draft XML from recreating visible source cards after thread re-entry.
    - Added `clearPluginRefreshPendingNotice()` plus a 10-second timeout in `requestHermesPluginRefresh()` so the Hermes embed refresh notice auto-clears when the host refresh does not immediately replace the page.
    - Recovering states such as `showPluginEmbedRecovering()` now clear any pending refresh notice first.
  - `public/app.js` / `public/sw.js`
    - Static shell build/cache bumped to `0.1.11|codex-mobile-shell-v129` / `codex-mobile-shell-v129`.
- Validation:
  - `node --check public\app.js` passed.
  - `node --check public\sw.js` passed.
  - Focused `node --test test\hermes-plugin-route.test.js test\mobile-viewport.test.js test\thread-task-card-route.test.js test\conversation-render.test.js` passed.
- Activation:
  - Static frontend change only.
  - Refresh/reopen clients to load `codex-mobile-shell-v129`.

## 2026-05-30 Public PR #41 Merge And Safe-Area Sync v130

- User request:
  - Push the current public update first, then merge public PR `#41` (`修复 PWA 底部输入栏安全区遮挡`).
- Public repository:
  - Public-safe current private changes were synced to `C:\Users\xuxin\Documents\codex-mobile-web-public`, validated, committed, and pushed as `2e1c63a 发布 Hermes 插件续接确认修复、跨线程卡片持久化与刷新提示收口`.
  - PR `#41` could not be merged by GitHub directly because `main` had moved and the PR had conflicts against the newer Hermes/task-card/frontend work.
  - The PR head was fetched locally as `pr-41`, merged into public `main` with manual conflict resolution, and pushed as merge commit `0d89f28 Merge pull request #41 from franksong2702/fix-pwa-composer-safe-area`.
  - The resolved merge preserved current Hermes/task-card functionality and also kept the PR's PWA bottom safe-area composer padding fix.
- Private follow-up:
  - Synced the merged product files back into the private workspace to avoid drift:
    - `public/app.js`
    - `public/sw.js`
    - `public/styles.css`
    - `README.md`
    - `test/composer-quota.test.js`
    - `test/mobile-viewport.test.js`
    - `test/thread-task-card-route.test.js`
  - Static shell build/cache is now `0.1.11|codex-mobile-shell-v130` / `codex-mobile-shell-v130`.
- Validation:
  - Public focused tests for app-update, Hermes plugin route, manual restart UI, mobile viewport, thread-task-card route, and composer quota passed.
  - Public `npm.cmd test`, `npm.cmd run check`, and `git diff --check` passed before the merge commit was pushed.
  - GitHub now reports PR `#41` as `MERGED` with merge commit `0d89f28a4cd317829823d96deeaeda1eb62e31b2`.
