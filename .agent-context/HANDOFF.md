# HANDOFF

Last compacted: 2026-06-08T13:27:43.304Z

This active handoff was automatically compacted before a Codex Mobile continuation.
The previous full handoff was archived and should be opened only when old provenance is explicitly needed.

## Compaction Summary

- Workspace: `/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web`
- Original active handoff bytes: `237484`
- Archived full handoff: `/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web/.agent-context/archive/context-compaction-20260608_132743/HANDOFF.full-before-context-budget.md`
- Preserved recent active context chars: `16324`

## Startup Guidance

- Read `.agent-context/PROJECT_CONTEXT.md` first.
- Read this compact `.agent-context/HANDOFF.md` for current status.
- Do not load the archived full handoff unless the user asks for old provenance or the compact handoff is insufficient.
- Before changing any latest-version, backup, deployment, or runtime-state fact, verify current repo/runtime state or the latest source-thread handoff; archived old sections are provenance only.
- Keep future handoff updates concise: current state, changed files, validation, risks, and next steps.
- Do not store raw secrets, tokens, one-time approvals, hidden UI state, long logs, or bulky generated output.

## 2026-06-09 v257 Live Operation Rendering

- User clarified the requested fixed-height "command box" was the middle
  Command/File/Tool live operation card, not the bottom composer.
- Corrected v257 implementation:
  - `.live-operation` cards now always reserve an approximately three-line
    `.operation-detail-line`, even when the operation has no detail text.
  - `.live-operation.entry-animate` has no entry animation, reducing visible
    flashes when intermediate Command/File/Tool state cards appear or change.
  - Running assistant text deltas still prefer local patching of the current
    text item to avoid full conversation replacement during streaming.
  - In the latest live turn only, follow-up `userMessage` items that arrive
    after Codex output are displayed after current output/operation items, so
    a new user request does not visually interrupt the middle of an active
    Codex answer.
  - The bottom composer autosize behavior was restored; it is not fixed to
    three lines by this change.
- Commit:
  - `d278fc9 Stabilize live operation rendering`.
- Validation:
  - `node --check public/app.js && node --check public/sw.js` passed.
  - Focused tests passed:
    `node --test test/collab-agent-render.test.js
    test/composer-quota.test.js test/conversation-render.test.js
    test/turn-scroll-controls.test.js test/mobile-viewport.test.js
    test/thread-goal-service.test.js test/thread-task-card-route.test.js`.
  - `npm run check` passed.
  - Home AI central harness tests passed:
    `node --test tests/ios-pwa-live-debug-server.test.js
    tests/ios-pwa-visual-harness.test.js`.
  - `git diff --check` passed.
  - Live-debug visual measurement on Codex dev verified:
    empty and long Command card heights both `87.109375px`, detail height
    `48.109375px`, and operation animation `none`.
  - Live-debug visual ordering check verified a live turn with source order
    `Codex -> You -> Command` displayed as `Codex -> Command -> You`.
  - Screenshot artifact:
    `/Users/xuxin/.homeai-qa/artifacts/codex-mobile-operation-v257-20260609T151213Z.png`.
- Production:
  - User reported the update had already arrived and requested no more server
    restarts.
  - Only read-only smoke was run after that request; no further production
    restart was attempted.
  - Production `/api/public-config` reports
    `clientBuildId=0.1.11|codex-mobile-shell-v257` and
    `shellCacheName=codex-mobile-shell-v257`, build `110014de40c208a1`.
- Cleanup:
  - AI Ops visual lane `ios-pwa-1` was released.
  - Temporary dev/live-debug ports `18787` and `19073` were confirmed down.
  - Evidence ledger entries:
    `evidence-2579455b-e17c-4427-8231-d956b0c56559` and
    `evidence-5f51e015-8627-45bd-b87b-0af5ee8f974f`.

## 2026-06-09 v258 Live Operation Bottom Dock

- User reported v257 still made the tool/command box too tall and it still
  moved upward in the message flow, causing reading difficulty.
- Implemented v258:
  - Latest live Command/File/Tool operation is no longer rendered inside the
    turn body by `visibleItemsForTurn()`.
  - Added `currentLiveOperationEntry()` and `renderLiveOperationDock()` so only
    the newest live operation renders in a sticky `.live-operation-dock` at
    the bottom of the conversation.
  - Reduced operation detail clamp from three lines to two lines.
  - Bumped app shell/cache to `codex-mobile-shell-v258` and added README
    release notes.
- Commit:
  - `6ab8153 Dock live operation status`.
  - Pushed private `main` to origin.
- Validation:
  - `node --check public/app.js && node --check public/sw.js` passed.
  - Focused tests passed:
    `node --test test/collab-agent-render.test.js
    test/conversation-render.test.js test/mobile-viewport.test.js
    test/thread-goal-service.test.js test/thread-task-card-route.test.js
    test/turn-scroll-controls.test.js`.
  - `npm run check` passed.
  - Home AI central harness tests passed:
    `node --test tests/ios-pwa-live-debug-server.test.js
    tests/ios-pwa-visual-harness.test.js`.
  - `git diff --check` passed.
  - Live-debug visual measurement on Codex dev verified:
    `commandInTurnFlow=false`, `commandInDock=true`, detail line clamp `2`,
    dock position `sticky`, and Command dock screenshot:
    `/Users/xuxin/.homeai-qa/artifacts/codex-mobile-operation-dock-v258b-20260609T153507Z.png`.
- Production:
  - Not deployed in this step because the user explicitly asked not to keep
    restarting servers. Production remained read-only after the v257 smoke.
- Cleanup:
  - Evidence ledger entries:
    `evidence-4c4470c1-2b4e-4881-8c99-9d9e6652aa26` and
    `evidence-a4c9c6a6-ab58-4169-af9e-25c888687215`.

## 2026-06-09 v256 Pending Approval Projection

- User reported that sandbox/permission prompts were visible in Codex Desktop
  but not in Codex Mobile thread detail after projection changes, leaving
  commands stuck without a mobile `Approve` card.
- Fixed thread-detail projection/read/fallback responses to attach current
  thread pending Codex app-server `serverRequest` objects as compressed public
  approval payloads in `thread.pendingServerRequests`.
- Fixed `public/app.js` so `loadThread()` syncs projected
  `pendingServerRequests` into the existing in-memory approval map before the
  first detail render, so approval cards no longer depend on EventSource timing.
- Kept one-time approval state out of persistence/shared context; no raw
  request payloads, keys, cookies, or hidden state are written.
- Bumped app shell to `codex-mobile-shell-v256` and documented the release in
  README.
- Commit: `0b9c793 Project pending approval requests into thread detail`.
- Pushed private `main` to origin.
- Validation:
  - `node --check server.js`, `node --check public/app.js`, and
    `node --check public/sw.js` passed.
  - Focused tests passed:
    `node --test test/protocol.test.js test/conversation-render.test.js
    test/mobile-viewport.test.js test/app-update.test.js
    test/thread-goal-service.test.js test/thread-task-card-route.test.js`.
  - `npm run check` passed.
  - `git diff --check` passed.
  - Home AI `architecture-code-test-harness-map.test.js` passed.
  - `npm test` passed with 439 tests.
- Deployment:
  - Mac production reports `/api/public-config`
    `clientBuildId=0.1.11|codex-mobile-shell-v256` and
    `shellCacheName=codex-mobile-shell-v256`.
  - Authenticated plugin smoke:
    `/api/status?detail=1` returned `ready=true`, transport
    `managed-ws-child`, `lastError=null`; `/api/approvals` returned 200.
  - Home AI authenticated manifest/proxy smoke returned `codex-mobile` and
    proxied `public-config` v256.
  - Evidence ledger entries:
    `evidence-5e70fcce-5fed-44eb-b775-d4b13f638058` and
    `evidence-af90c5ae-66f8-4836-b7b1-5d9c2cce4d21`.

## 2026-06-09 Public Main Parity Push

- User asked to push public after private had advanced beyond public PR #57.
- Used clean public mirror
  `/Users/hermes-dev/HermesMobileDev/public-mirrors/codex-mobile-web-public`.
- Synced public-safe files from private `main` / `private/main`, explicitly
  excluding `.agent-context`.
- Public commit pushed:
  - `b9ecbd6 Sync public with private main`
- Public content now includes current product/source/docs through side-chat,
  image-ordering, GitHub preview, platform pointer, and related tests, but no
  tracked `.agent-context`, runtime state, uploaded content, local keys, or
  private handoff files.
- Public validation before push:
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `git diff --check` passed.
  - `npm test` passed with 435 tests.
  - Privacy/file scan found no tracked `.agent-context` files and no runtime or
    upload directories; text matches were expected public boundary docs,
    placeholder key examples, and code paths that mention local context files.
- Private reverse sync:
  - Merged `public/main` back into private with `Merge public sync`.
  - Private validation after merge passed: `npm run check`,
    `npm run check:macos`, `git diff --check HEAD`, Home AI platform contract
    check for `codex-mobile`, and `npm test` with 435 tests.

## 2026-06-09 Platform Contract Pointer v2

- Updated `docs/HOME_AI_PLATFORM_CONTRACT.md` from Home AI platform contract
  `20260606-v1` to `20260609-v2`.
- Added canonical AI Ops control-plane docs to the local pointer and recorded
  the required intake/checks/evidence/production-smoke flow plus the local
  evidence ledger path by reference only.
- No public sync is required for this private platform pointer update.
- Validation before commit:
  - Home AI platform contract check for `codex-mobile` passed; only warning
    remained `handoff_pointer_missing`.

## 2026-06-09 Public PR #57 Light Theme Sync

- Public PR:
  - Inspected `pentiumxp/codex-mobile-web-public` PR #57
    `优化 Codex Mobile 浅色主题`.
  - PR was open, non-draft, `MERGEABLE`, CI `Node checks` successful, and
    contained one public commit `843263d`.
  - Scope was public-safe frontend light-theme CSS polish, shell cache bump to
    `codex-mobile-shell-v252`, and tests.
- Public publish:
  - Used clean public mirror
    `/Users/hermes-dev/HermesMobileDev/public-mirrors/codex-mobile-web-public`.
  - Merged PR #57 locally on top of public `f994783`, added README v252
    Chinese release notes, and pushed merge commit `3705ed8`.
  - GitHub reports PR #57 `MERGED` at `2026-06-09T09:17:54Z`.
  - Public changed only README, `public/app.js`, `public/styles.css`,
    `public/sw.js`, and tests; no `.agent-context`, runtime state, local keys,
    uploads, or machine-specific diagnostics were copied.
- Public validation:
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `npm test` passed with 410 tests.
  - `git diff --check HEAD` passed.
  - Public privacy scan found only expected README/frontend boundary text and
    existing token-usage source/test filenames.
- Private reverse sync:
  - Stashed the pre-existing dirty `docs/HOME_AI_PLATFORM_CONTRACT.md` pointer
    update as `pr57-private-dirty-before-public-sync`, merged public `main`
    into private as `6bbbc39 Merge public PR 57`, then restored the stash.
  - Resolved conflicts in README and `test/mobile-viewport.test.js` by keeping
    private v252 side-chat keyboard content and adding public PR #57 light-theme
    release notes/cache assertions.
  - `public/styles.css` auto-merged, preserving private side-chat keyboard
    layout and adding public light-theme token/control overrides.
- Private validation after sync:
  - Focused mobile/thread tests passed with 17 tests.
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `git diff --check HEAD` passed.
  - `npm test` passed with 435 tests.
  - Home AI platform contract check passed for `codex-mobile`; only warning was
    `handoff_pointer_missing`.
- Current state:
  - Side-chat v252 source is committed and pushed from earlier work; the old
    "side-chat keyboard files remain dirty" caution below is historical.
  - Current remaining dirty file is the restored
    `docs/HOME_AI_PLATFORM_CONTRACT.md` pointer update; it was not copied to
    public and is not part of PR #57.

## 2026-06-09 v251 Hotfix Projected Image Ordering

- User reported that entering a thread rendered older image cards at the bottom
  of the latest turn even when the image timestamp was earlier than surrounding
  text.
- Implemented server-side ordering hotfix:
  - `readRolloutItemTimestampCandidates()` now scans the full bounded rollout
    text when available, matching the tool-output image scan path, so long
    turns do not lose early item timestamps outside the short tail.
  - Newly projected tool-output images are inserted into the turn by timestamp
    instead of always appended.
  - Existing image items in `turn.items` are restored to stable timestamp order
    during `compactThread()`.
- Added focused regression tests in `test/thread-item-timestamp-enrichment.test.js`
  for both newly projected image insertion and existing misplaced image items.
- Validation before deploy:
  - `node --test test/thread-item-timestamp-enrichment.test.js` passed with 14
    tests.
  - `npm run check` passed.
  - Development API smoke on thread `019ea76b-d846-7892-bda0-c0fff9cf7581`
    returned `imageOrderingProblems=0`.
- Commit: `523f5ca Fix projected image item ordering`.
- Production deployment:
  - Deployed from clean temporary worktree at commit `523f5ca1faa7`, not from
    the dirty main workspace, so paused v252 side-chat keyboard changes were
    not included.
  - Backup path:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260609T064102Z-plugin-codex-mobile-web-codex-mobile-image-order-523f5ca`.
  - Production `/api/public-config` reports `clientBuildId` and
    `shellCacheName` still at `0.1.11|codex-mobile-shell-v251`.
  - Production authenticated thread smoke returned 10 turns, 7 image items, and
    `imageOrderingProblems=0`. The target 06:03 image in turn
    `019eaac3-0282-75d3-83cc-5d78cea5ee7e` is now between the 06:03:21 and
    06:03:39 text items rather than at the 06:31 end of the turn.
- After deployment, temporary worktrees were removed and the local 18787
  development server was stopped.
- Current caution: unrelated paused v252 side-chat keyboard files remain dirty
  in the main workspace. Do not deploy from the dirty main workspace until that
  work is either completed or intentionally separated.

## 2026-06-09 Image Ordering Visual Toolchain Follow-up

- User asked to reread the central Home AI visual toolchain contract and align
  the just-completed image ordering fix with the new requirements.
- Re-read:
  - Home AI `plugin-workspace-platform-contract.md`;
  - Home AI `plugin-mobile-ui-visual-contract.md`;
  - Home AI `RUNBOOKS/macos-ios-simulator-appium.md`;
  - Home AI harness rollout/matrix references around visual recovery.
- Toolchain recovery performed by contract:
  - Appium `4723` was down while WDA `8101` was up and live debug `19073` was
    down.
  - Restarted Appium with
    `$HOME/.homeai-qa/scripts/macos-ios-appium-start.sh`.
  - Started Home AI `npm run ios:pwa:debug` on `19073`.
  - Checked harness first failed with `webview_context_missing`; reset the live
    debug Appium session with `type=connect resetSession=true`.
  - Subsequent `Unexpected EOF` persisted; restarted WDA once and then the
    Simulator lane before recovering direct live-debug JS access.
- Added `scripts/codex-mobile-image-order-visual-smoke.js`, a plugin-specific
  visual smoke that uses the central live debug server lease/action/screenshot
  endpoints, opens a real Codex thread, reads bounded iframe DOM item order,
  and saves a screenshot artifact without printing keys, cookies, launch
  tokens, or raw private logs.
- Updated `docs/HOME_AI_PLATFORM_CONTRACT.md` with the image-order smoke command
  and the central toolchain recovery order for `webview_context_missing`,
  `Unexpected EOF`, `socket hang up`, and `appium_timeout`.
- Validation:
  - `node --check scripts/codex-mobile-image-order-visual-smoke.js` passed.
  - `node --test test/thread-item-timestamp-enrichment.test.js` passed with 14
    tests.
  - `npm run check` passed.
  - Home AI platform contract checker for `codex-mobile` passed.
  - Home AI visual harness test passed.
  - `node scripts/codex-mobile-image-order-visual-smoke.js --debug-url
    http://127.0.0.1:19073/ --thread-id
    019ea76b-d846-7892-bda0-c0fff9cf7581 --target-turn-id
    019eaac3-0282-75d3-83cc-5d78cea5ee7e --json` passed with
    `orderProblems=[]`, 10 loaded turns, 8 image-capable DOM items, and
    screenshot
    `/Users/xuxin/.homeai-qa/artifacts/codex-mobile-image-order-20260609T070206Z.png`.
- The central checked `embedded-plugin-shell` harness still hit Appium/WebKit
  `webview_context_missing` / `Unexpected EOF` before business assertions, but
  the direct live-debug lease/action/screenshot path succeeded and is now
  captured in a reusable plugin smoke script.

## 2026-06-09 v252 Side-Chat Keyboard Work Paused

- User asked to pause after extended debugging. No production deployment was
  made for the v252 side-chat keyboard work.
- Intended plugin runtime fix in progress: `public/styles.css` raises the
  side panel above the main composer and adds `html.keyboard-open` compact
  layout for the side-chat panel/textarea; app shell ids were bumped toward
  `0.1.11|codex-mobile-shell-v252`.
- Central Home AI visual harness work in progress adds a dedicated
  `embedded-plugin-side-chat-keyboard` scenario so Codex Mobile side-chat
  textarea obstruction is not validated only through the main composer case.
- Static validation passed before pause:
  - plugin `npm run check`;
  - plugin focused mobile/thread tests;
  - Home AI `node --test tests/ios-pwa-visual-harness.test.js`;
  - Home AI focused live-debug/keyboard/bottom/task-list tests;
  - Home AI `npm run check`;
  - Home AI platform contract check for `codex-mobile`.
- Development visual validation did not reach business assertions. The current
  Appium/WDA lane repeatedly timed out on WebView context discovery/switch
  (`/contexts` and `/context`) even after restarting the live debug server and
  Appium/WDA. Debug ports `19073`, `4723`, `8101`, and `9100` were stopped
  before pausing.
- Current caution: after the public PR #56 reverse sync, no merge-conflict
  markers remain, but the v252 side-chat keyboard source files are still dirty
  and uncommitted. Inspect and commit or discard them intentionally before any
  v252 deployment.

## 2026-06-09 Public PR #56 GitHub Link Preview Cards

- Public PR:
  - Inspected `pentiumxp/codex-mobile-web-public` PR #56
    `增强 GitHub 链接预览卡片`.
  - PR was open, non-draft, `MERGEABLE`, CI `Node checks` successful, and
    contained one public commit `aaeae2b`.
  - Scope was public-safe frontend GitHub preview rendering, Markdown autolink
    punctuation handling, shell cache bump, and tests.
- Public publish:
  - Used clean public mirror
    `/Users/hermes-dev/HermesMobileDev/public-mirrors/codex-mobile-web-public`.
  - Merged PR #56 locally on top of public `e75ec78`, added README v250 Chinese
    release notes, and pushed merge commit `f994783`.
  - GitHub reports PR #56 `MERGED` at `2026-06-09T06:28:02Z`.
  - Public changed only README, frontend app/markdown/styles/service-worker,
    and tests; no `.agent-context`, runtime state, local keys, uploads, or
    machine-specific diagnostics were copied.
- Public validation:
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `npm test` passed with 410 tests.
  - `git diff --check HEAD` passed before commit.
  - Public privacy scan found only expected README boundary text mentions.
- Private reverse sync:
  - The private worktree had uncommitted v252 side-chat keyboard changes.
    They were temporarily stashed as
    `pr56-private-dirty-before-public-sync`, public `main` was merged into
    private as `a8db11a Merge public PR 56`, then the stash was restored
    without conflict.
  - Merge resolution kept private `codex-mobile-shell-v251` in the committed
    merge while adding public #56 GitHub preview cache/constants, hydrate calls,
    styles, and tests. Restored v252 dirty files then advanced local working
    tree versions back to `codex-mobile-shell-v252`.
- Private validation after stash restore:
  - Focused GitHub/Markdown/scroll/mobile tests passed with 45 tests.
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `npm test` passed with 433 tests.
  - Platform contract check passed via
    `/Users/hermes-dev/HermesMobileDev/app/scripts/plugin-workspace-platform-contract-check.js
    --plugin codex-mobile --json`.
  - Remaining dirty files are the pre-existing v252 side-chat keyboard work and
    this handoff update; they were not copied to public.

## 2026-06-09 v251 Image Projection And Upload Rendering

- Implemented Codex Mobile Web v251 image rendering fixes:
  - `server.js` now attaches unscoped `function_call_output` tool-output
    images to the matching turn by rollout timestamp window instead of always
    putting them on the latest turn.
  - Receipt-only compacted turns preserve `imageView` / `imageGeneration`
    visual receipt items so historical thread detail does not drop image cards.
  - `public/app.js` routes app-server-replayed absolute upload paths through
    authenticated `/api/uploads/file`, unwraps object image URLs including
    `href`, and forces image rerender when the plugin session auth key changes.
  - Image render keys include the image source signature so one projected image
    cannot reuse a stale DOM node from another image.
  - PWA shell advanced to `0.1.11|codex-mobile-shell-v251`.
- Docs updated:
  - `README.md`;
  - `docs/ARCHITECTURE.md`;
  - `docs/HOME_AI_PLATFORM_CONTRACT.md`;
  - `docs/TROUBLESHOOTING.md`.
- Development validation passed:
  - `npm run check`;
  - `npm test` with 427 tests;
  - focused image/mobile tests with 40 tests;
  - Home AI platform contract check for `codex-mobile`;
  - `git diff --check`.
- Development visual validation for the input/keyboard class of bugs used the
  new central Home AI `embedded-plugin-keyboard-composer` scenario against a
  real Codex thread. The Appium/Safari lane could not surface the real iOS
  software keyboard inside the iframe, so the harness injected the canonical
  `hermes.plugin.viewport` keyboard payload and recorded
  `keyboard.simulated=true`. The layout gate passed with input bottom at 384,
  keyboard top at 392, and screenshot artifact:
  `/Users/xuxin/.homeai-qa/artifacts/ios-pwa-visual-embedded-plugin-keyboard-composer-codex-mobile-20260609T060315Z.png`.
- Commit: `3eb6318 Fix Codex mobile image rendering`.
- Production deployment:
  - Deployed source commit `3eb631880e26` through the Home AI central Mac
    deploy script with reason `codex-mobile-image-rendering-v251`.
  - Backup path:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260609T061100Z-plugin-codex-mobile-web-codex-mobile-image-rendering-v251`.
  - LaunchDaemon validation passed for
    `system/com.hermesmobile.plugin.codex-mobile`.
  - Production `/api/public-config` reported
    `clientBuildId=0.1.11|codex-mobile-shell-v251`,
    `shellCacheName=codex-mobile-shell-v251`, `platform=darwin`, and
    `workspacePath=/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Production manifest smoke returned `id=codex-mobile`, `kind=embedded_app`,
    `raw_key_returned_by_codex_mobile=false`, and no local runtime/key path.
  - Production `/api/uploads/file` smoke for current-thread `IMG_5888.jpg`
    returned `401` without auth and `200 image/jpeg` with the Codex Mobile
    Access Key.
  - Production `/api/generated-images/file` smoke returned `401` without auth
    and `200 image/png` with the Codex Mobile Access Key.
  - Production thread detail smoke for
    `019ea76b-d846-7892-bda0-c0fff9cf7581` returned 10 projected turns, 23
    image-related items, 6 upload-route items, and 6 generated-image-route
    items, with image items present across several turns rather than only the
    latest turn.

## Preserved Recent Handoff Tail

## 2026-06-09 Thread Side Chat v250 Implementation

- Implemented current-thread side chat first version:
  - `adapters/thread-side-chat-service.js` persists per-profile/thread messages,
    draft, candidates, queue, apply metadata, and bounded public state under the
    Codex Mobile runtime root.
  - `server.js` exposes authenticated side-chat get/draft/messages/candidates/
    queue/apply/cancel/clear routes.
  - Candidate apply uses `thread/resume` plus main-thread `turn/start`, not
    `turn/steer`; queued `autoSendWhenIdle` candidates are applied from the
    `turn/completed` notification hook and are idempotent.
  - `public/app.js` converts the left-swipe Subagent panel into a two-region
    panel: upper Subagent status, lower side chat with server draft autosave,
    message save, candidate save, queue, apply, cancel, and clear controls.
  - `public/styles.css` adds independent scroll regions and a bounded lower
    side-chat composer.
  - App shell advanced to `0.1.11|codex-mobile-shell-v250`.
- This first version does not create a hidden AI sidecar thread. Side-chat
  entries are server-saved notes/candidates until explicitly applied.
- Validation passed before production deploy:
  - focused side-chat/UI/mobile tests: 18 passed;
  - `npm run check`;
  - `npm test` with 423 tests;
  - `npm run check:macos`;
  - Home AI platform contract check for `codex-mobile`;
  - `git diff --check`;
  - Home AI live iOS PWA debug server smoke against dev
    `http://127.0.0.1:18787/`, screenshot
    `/Users/xuxin/.homeai-qa/artifacts/codex-mobile-v250-dev-side-chat-panel.png`.
- Dev visual smoke opened thread `019ea76b-d846-7892-bda0-c0fff9cf7581`,
  verified panel/sidebar bounds, server draft round-trip, and
  `draftInMainConversation=false`; the temporary draft was cleared afterward.
- Commit: `6f26cfb Add current-thread side chat panel`.
- Production deployment:
  - Deployed source commit `6f26cfb49995` through the Home AI central Mac
    deploy script with reason `codex-mobile-thread-side-chat-v250`.
  - Backup path:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260609T040633Z-plugin-codex-mobile-web-codex-mobile-thread-side-chat-v250`.
  - LaunchDaemon validation passed for
    `system/com.hermesmobile.plugin.codex-mobile`.
  - Production `/api/public-config` reported
    `clientBuildId=0.1.11|codex-mobile-shell-v250`,
    `shellCacheName=codex-mobile-shell-v250`, `platform=darwin`, and
    `workspacePath=/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Production manifest smoke returned `id=codex-mobile`,
    `kind=embedded_app`, and exact raw access-key value not returned.
  - Side-chat auth smoke returned 401 without key and 200 with key, with
    `persistence=server`.
  - Production iOS live debug smoke against `http://127.0.0.1:8787/` verified
    combined panel bounds, server draft round-trip, and
    `draftInMainConversation=false`; screenshot
    `/Users/xuxin/.homeai-qa/artifacts/codex-mobile-v250-prod-side-chat-panel.png`.
  - The checked `ios:pwa:visual --scenario embedded-plugin-shell` harness was
    attempted against both external HTTPS and local `127.0.0.1:8797` Home AI
    entries, but Appium returned `execute/sync 500: Unexpected EOF` before
    business assertions. Live debug DOM/screenshot evidence above is the final
    visual proof for this deployment.

## 2026-06-09 Thread Side Chat Planning Docs

- User approved the current-thread side-chat direction:
  - side chat is attached to the current thread but must not pollute the main
    transcript or steer an active main turn by default;
  - the existing left-swipe Subagent surface should become a combined side
    panel, with Subagent status in the upper region and side chat in the lower
    region;
  - each thread needs independent saved side-chat state, including in-progress
    transcript/draft/candidate/queue state across thread switches.
- Added planning docs:
  - `docs/THREAD_SIDE_CHAT_REQUIREMENTS.md`
  - `docs/THREAD_SIDE_CHAT_DESIGN.md`
  - `docs/THREAD_SIDE_CHAT_IMPLEMENTATION.md`
- Updated `docs/README.md` reading guide with the side-chat planning docs.
- User then clarified side-chat state must be server-side only, not browser
  local storage.
- Added server-side persistence foundation:
  - `adapters/thread-side-chat-service.js`
  - `test/thread-side-chat-service.test.js`
  - `test/thread-side-chat-route.test.js`
  - `server.js` routes for side-chat get/draft/messages/candidates/queue/cancel/clear
  - `package.json` syntax check coverage
  - `docs/MODULES.md` module/test map entry
- The persistence foundation intentionally does not expose an apply route yet;
  apply should be added only with the real main-thread `turn/start`
  integration so a candidate cannot be marked applied without a main turn.
- Existing unrelated dirty frontend/public files were left untouched.

## 2026-06-09 Public PR #55 Markdown Mermaid Polish

- Public PR:
  - Inspected `pentiumxp/codex-mobile-web-public` PR #55
    `优化移动端 Markdown 与 Mermaid 渲染`.
  - PR was open, non-draft, CI `Node checks` successful, and contained one
    public commit `e4ad714`.
  - The PR branch was based on public commit `5e4e2ed`, before the later
    public v247 full sync `985cf5e`. Direct tree comparison against current
    public `main` showed apparent v247 regressions, so the merge was evaluated
    as safe only as a real three-way merge on current public `main`, not as a
    branch-tree overwrite.
- Public publish:
  - Used clean public mirror
    `/Users/hermes-dev/HermesMobileDev/public-mirrors/codex-mobile-web-public`.
  - Merged PR #55 locally on top of public `985cf5e`, added README v248 Chinese
    release notes, and pushed merge commit `e75ec78`.
  - GitHub reports PR #55 `MERGED` at `2026-06-09T02:26:01Z`.
  - Public changed only README, frontend app/markdown/styles, and tests; no
    `.agent-context`, runtime state, local keys, uploads, or machine-specific
    diagnostics were copied.
- Public validation:
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `npm test` passed with 407 tests.
  - `git diff --check HEAD` passed before commit.
  - Public privacy scan found only expected README boundary text mentions.
- Private reverse sync:
  - Fetched public `main` and merged it into private as `ec4303b Merge public
    PR 55`.
  - Resolved conflicts by keeping private README context plus v248 sync note,
    and keeping the public `commandOutputMarkdownPreview` / GitHub link preview
    function block in `public/app.js` so private does not drop public frontend
    behavior.
- Private validation after reverse sync:
  - Focused Markdown/Mermaid/conversation/collab tests passed with 59 tests.
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `npm test` passed with 412 tests.
  - Platform contract check passed via
    `/Users/hermes-dev/HermesMobileDev/app/scripts/plugin-workspace-platform-contract-check.js
    --plugin codex-mobile --json`.

## 2026-06-09 Public v247 Full Sync After PR #54

- User clarified the public workflow:
  - Use the clean public mirror before pushing public.
  - Public and private must not diverge on product code; after public is pushed,
    public history must be reverse-merged into private.
- Public mirror:
  - Used `/Users/hermes-dev/HermesMobileDev/public-mirrors/codex-mobile-web-public`.
  - Started from public `origin/main` after PR #54 merge commit `5e4e2ed`.
  - Cherry-picked the private v247 product fix onto public and resolved overlaps
    with PR #54 by keeping the broader live frontend plus projection dedupe.
  - Pushed public commit `985cf5e` `Fix live mobile user message echo dedupe`.
  - Public files were limited to README, public source, adapters, service worker,
    and tests; no `.agent-context`, runtime state, local keys, uploads, or
    machine diagnostics were copied.
- Public validation:
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `npm test` passed with 403 tests.
  - `git diff --check HEAD~1..HEAD` passed.
  - Privacy scan on the public diff found only expected README boundary text
    mentions documenting that private/runtime material was not copied.
- Private reverse sync:
  - Fetched public `main` and merged public history into private with
    `git merge -s ours --allow-unrelated-histories public/main` as
    `d6fab1d Merge public v247 history`.
  - The `ours` strategy was intentional because public and private are
    independent repositories with unrelated roots, and private already had the
    broader v247 tree plus private-only handoff/deployment records.
  - Public `985cf5e` is now a parent in private history, so future private work
    includes the public v247 line instead of losing it on a later sync.
- Private validation after reverse sync:
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `npm test` passed with 408 tests.
  - Platform contract check passed via
    `/Users/hermes-dev/HermesMobileDev/app/scripts/plugin-workspace-platform-contract-check.js
    --plugin codex-mobile --json`.

## 2026-06-09 Public PR #54 Projection User Dedupe

- Public PR:
  - Inspected `pentiumxp/codex-mobile-web-public` PR #54
    `修复动态投影重复显示 Mobile 用户消息`.
  - PR was open, clean/mergeable, non-draft, and CI `Node checks` was
    successful.
  - Scope was limited to
    `adapters/thread-detail-projection-service.js` and
    `test/thread-detail-projection-service.test.js`.
- Public publish:
  - Used isolated public clone under `/tmp/codex-mobile-web-public-pr54`.
  - Added README Chinese release note for v247.
  - Public validation passed: `npm install`, `npm run check`,
    `npm run check:macos`, `npm test` with 399 tests, and `git diff --check`.
  - Public privacy scan found no credential/local-path hits; expected
    boundary text mentions were documentation-only.
  - Pushed public `main`; GitHub reports PR #54 `MERGED` at
    `2026-06-09T02:04:14Z`.
- Private sync decision:
  - A no-commit cherry-pick probe of PR commit `74e8dba` onto private v247
    produced a content conflict in the projection service.
  - The conflict is semantic overlap, not behavior disagreement: private commit
    `43533db` is the broader v247 implementation and already covers PR #54's
    projection-only scenario plus frontend live upsert/merge dedupe,
    pending-echo normalization, `local-user-*`, `input_text`, image/url/path
    matching, and durable-user-message preference.
  - Per user direction, private keeps the broader v247 implementation and skips
    cherry-picking PR #54's narrower code subset.
  - Private should push the existing v247 commits:
    `43533db` `Fix live mobile user message echo dedupe` and
    `dfd3b56` `Record v247 duplicate message deployment`.

## 2026-06-09 Live User Message Echo Dedupe v247

- User reported that sending a message still briefly showed two user-message
  cards before one disappeared.
- Diagnosis:
  - Existing v227 dedupe covered full thread-detail refresh merges, but the
    live `item/completed` path still inserted `mux-user-*` / pending echo and
    durable app-server `userMessage` events separately until a later refresh
    folded them.
  - The server-side thread-detail projection cache also merged primarily by
    item id, so a live projection window could preserve both the synthetic
    mobile echo and the durable user message.
- Implemented:
  - Commit: `43533db Fix live mobile user message echo dedupe`.
  - Shell advanced to `0.1.11|codex-mobile-shell-v247`.
  - `public/app.js` now normalizes visible user messages during live upsert and
    thread merges, collapsing matching local/mux/pending echoes immediately.
  - `adapters/thread-detail-projection-service.js` now detects and merges
    synthetic mobile user echoes with durable app-server `userMessage` items in
    dynamic projection windows.
  - `adapters/message-pending-echo-service.js` now compares `text` and
    `input_text` content equivalently so pending steer echoes do not re-inject
    beside durable app-server input.
- Validation:
  - `node --check public/app.js` passed.
  - `node --check adapters/thread-detail-projection-service.js` and
    `node --check adapters/message-pending-echo-service.js` passed.
  - Focused tests passed:
    `node --test test/conversation-render.test.js`,
    `node --test test/thread-detail-projection-service.test.js
    test/message-pending-echo-service.test.js`, and
    `node --test test/mobile-viewport.test.js test/thread-goal-service.test.js
    test/thread-task-card-route.test.js`.
  - `npm run check`, `npm test` with 408 tests, and `npm run check:macos`
    passed.
  - Home AI platform contract check passed:
    `node scripts/plugin-workspace-platform-contract-check.js --plugin
    codex-mobile --json`.
  - Development live debug server opened `http://127.0.0.1:18787/` in the
    Simulator WebView. A real composer duplicate-message smoke created and
    archived thread `019eaa0f-50b4-7972-bc31-dcd030720717`; after waiting for
    the first turn to complete, the follow-up send had 50 DOM samples with
    `maxCount=1`, `duplicateSamples=0`, and `finalCount=1`. Screenshot:
    `/Users/xuxin/.homeai-qa/artifacts/codex-mobile-v247-dev-dup-smoke.png`.
- Production deployment:
  - Deployed commit `43533db7d44d` through the Home AI central Mac deploy
    script with reason `codex-mobile-live-user-message-dedupe-v247`.
  - Backup path:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260609T014739Z-plugin-codex-mobile-web-codex-mobile-live-user-message-dedupe-v247`.
  - LaunchDaemon validation passed and `/api/public-config` reported
    `clientBuildId=0.1.11|codex-mobile-shell-v247`,
    `shellCacheName=codex-mobile-shell-v247`, and `platform=darwin`.
  - Production manifest smoke returned `id=codex-mobile`,
    `kind=embedded_app`, and `rawAccessKeyReturned=false`.
  - Production live debug opened `http://127.0.0.1:8787/` in the Simulator
    WebView. The same real composer smoke created and archived thread
    `019eaa11-7240-7272-ae80-f63bb00dc6ba`; after waiting for the first turn to
    complete, the follow-up send had 50 DOM samples with `maxCount=1`,
    `duplicateSamples=0`, and `finalCount=1`. Screenshot:
    `/Users/xuxin/.homeai-qa/artifacts/codex-mobile-v247-prod-dup-smoke.png`.

## 2026-06-09 Public PR #53 Usage Card Scroll Polish

- Public PR:
  - Inspected `pentiumxp/codex-mobile-web-public` PR #53
    `优化移动端消息定位与 Usage 卡片展示`.
  - PR was open, clean/mergeable, non-draft, and CI `Node checks` was already
    successful before local validation.
  - Public changes were evaluated as mergeable after review: scoped to
    frontend scroll/Usage-card rendering, service worker shell cache, tests,
    and PR screenshots.
- Public publish:
  - Used isolated public clone under `/tmp/codex-mobile-web-public-pr53`.
  - Added README Chinese release note for v246.
  - Stripped metadata segments from the two PR JPG screenshots before
    publishing.
  - Pushed public `main` to merge commit `f7df92e`; GitHub now reports PR #53
    `MERGED` at `2026-06-09T01:17:14Z`.
  - Did not copy `.agent-context`, runtime state, local keys, uploads, or
    machine-specific diagnostics into public.
- Private sync:
  - Synced PR #53 back to private by cherry-picking public commits onto current
    private `main` rather than merging public `main`, because private had newer
    v228 work.
  - Private commits: `9d14b52` `优化移动端消息定位与 Usage 卡片展示`,
    `33db564` `补充 Usage 卡片发布说明`.
  - Conflict resolution kept private README context and advanced shell cache /
    tests to `codex-mobile-shell-v246`.
- Validation:
  - Public isolated clone: `npm run check`, `npm run check:macos`,
    `npm test` passed with 397 tests, `git diff --check` passed.
  - Public privacy scan: added diff had no credential/local-path hits; expected
    boundary text mentions were documentation-only; screenshot strings had no
    sensitive hits.
  - Private workspace: `npm run check`, `npm run check:macos`, `npm test`
    passed with 406 tests, `git diff --check HEAD~2..HEAD` passed.
  - Private privacy scan: added diff had no credential/local-path hits; expected
    boundary text mentions were documentation-only; screenshot strings had no
    sensitive hits.
- Current state:
  - Public merge was reverse-synced into private and private `main` should be
    pushed after this handoff record is committed.

## 2026-06-07 Completion Refresh Backfill v211

- Follow-up issue:
  - User reported that the latest completed turn did not generate Usage and the
    long final receipt did not land at the receipt start.
- Diagnosis:
  - Thread API after v210 showed recent completed turn `019ea149...` with
    `usageCount=1`, but older completed turn `019ea132...` had lost Usage after
    later output grew the rollout.
  - Usage collection was still primarily reading a fixed rollout tail. In large
    active rollouts, a recent completed turn's `token_count` can be pushed out
    of that tail before the visible 10-turn window rotates away.
  - The long-receipt start jump only ran during the immediate
    `turn/completed` render. If that completion payload was short and the full
    deferred final receipt arrived only through the follow-up detail refresh,
    no second positioning pass occurred.
- Implemented:
  - Static shell advanced to
    `0.1.11|codex-mobile-shell-v211` / `codex-mobile-shell-v211`.
  - `server.js` now passes the current detail turn ids to
    `readRolloutTurnUsageSummaries()`. If the tail result is missing target
    turn summaries and the rollout is within the runtime scan limit, the server
    scans the rollout file and caches only token summary metadata.
  - `public/app.js` now keeps a pending completion receipt anchor until the
    receipt-start jump has actually happened. `refreshCurrentThread()` checks
    the merged refreshed thread and performs one one-time receipt-start jump if
    the complete long receipt appears after the completion event.
- Validation:
  - Focused tests passed:
    `node --test test\turn-scroll-controls.test.js
    test\turn-usage-summary-service.test.js test\conversation-render.test.js
    test\mobile-viewport.test.js test\thread-detail-projection-service.test.js`.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `npm.cmd test` passed with 365 tests.
  - `git diff --check` passed with only expected Windows LF/CRLF working-tree
    warnings.
  - UTF-8 BOM checks for edited files showed no BOM.
- Runtime:
  - Restarted Windows shared chain; restart log showed ready at
    `2026-06-07 17:01:43`.
  - `GET http://127.0.0.1:8787/api/public-config` reports
    `clientBuildId=0.1.11|codex-mobile-shell-v211`,
    `shellCacheName=codex-mobile-shell-v211`, `platform=win32`.
  - Authenticated thread API smoke on thread `019e8050...` returned
    `mobileReadMode=projection-dynamic`, `mobileProjection.source=dynamic`,
    `turnCount=10`; recent completed turn `019ea149...` has `usageCount=1`.
  - The newest visible turn was still `inProgress` during the smoke test, so it
    correctly had `usageCount=0` until completion.

## 2026-06-07 Post-completion Usage Refresh v212

- Follow-up issue:
  - User screenshot showed the just-ended `019ea151...` turn without a Usage
    card in the browser even though the turn had completed.
- Diagnosis:
  - Raw rollout for `019ea149...` and `019ea151...` both had `task_complete=1`
    and valid scoped `token_count` events.
  - Full adapter scan produced Usage summaries for both ids.
  - The server target Usage cache path could still return a target cache entry
    without re-checking whether all currently returned target turn ids were
    present.
  - Separately, the browser could remain on the immediate `turn/completed`
    render if the first refresh occurred before Usage/projection state was
    stable.
- Implemented:
  - Static shell advanced to
    `0.1.11|codex-mobile-shell-v212` / `codex-mobile-shell-v212`.
  - Target Usage cache hits now require
    `missingUsageTurnIds(targetCached.payload, targetTurnIds).length === 0`;
    otherwise the server continues to tail/full metadata scan.
  - Browser completion now schedules two post-completion detail refreshes
    (`700ms`, `2400ms`) through `schedulePostCompletionThreadRefreshes()`.
- Validation:
  - Focused checks passed:
    `node --check public\app.js public\sw.js server.js` and
    `node --test test\turn-scroll-controls.test.js
    test\turn-usage-summary-service.test.js test\mobile-viewport.test.js
    test\thread-goal-service.test.js test\thread-task-card-route.test.js`.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `npm.cmd test` passed with 365 tests.
  - `git diff --check` passed with only expected Windows LF/CRLF working-tree
    warnings.
  - UTF-8 BOM checks for edited files showed no BOM.
- Runtime:
  - Restarted Windows shared chain; restart log showed ready at
    `2026-06-07 17:11:56`.
  - `GET http://127.0.0.1:8787/api/public-config` reports
    `clientBuildId=0.1.11|codex-mobile-shell-v212`,
    `shellCacheName=codex-mobile-shell-v212`, `platform=win32`.
  - Authenticated thread API smoke on thread `019e8050...` showed completed
    turn `019ea151...` has `usageCount=1`.
  - The newest visible turn `019ea15d...` was still `inProgress` during the
    smoke test, so it correctly had `usageCount=0` until completion.

## 2026-06-07 Usage Backfill Poll v213

- Follow-up issue:
  - User still saw the completed v212 response without a Usage card in the
    browser, while `/api/threads/019e8050...` already returned Usage for the
    corresponding completed turn.
- Diagnosis:
  - API had `turnUsageSummary`; frontend filtering and render signatures include
    `turnUsageSummary`, so a page state that still lacks the card means the
    browser did not complete a detail refresh merge after Usage became
    available.
  - Fixed post-completion refresh timings are still a race against Usage and
    projection stabilization.
- Implemented:
  - Static shell advanced to
    `0.1.11|codex-mobile-shell-v213` / `codex-mobile-shell-v213`.
  - Added bounded frontend Usage backfill refresh:
    - Detect the latest successful completed turn without `turnUsageSummary`.
    - Retry current-thread detail refresh up to six times.
    - Stop when Usage appears, the thread changes, the page is hidden, or the
      attempt cap is reached.
    - Do not trigger for interrupted, failed, cancelled, active, or in-progress
      turns.
- Validation:
  - Focused checks passed:
    `node --check public\app.js public\sw.js server.js` and
    `node --test test\turn-scroll-controls.test.js test\mobile-viewport.test.js
    test\thread-goal-service.test.js test\thread-task-card-route.test.js
    test\conversation-render.test.js`.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `npm.cmd test` passed with 365 tests.
  - `git diff --check` passed with only expected Windows LF/CRLF working-tree
    warnings.
  - UTF-8 BOM checks for edited files showed no BOM.
- Runtime:
  - Restarted Windows shared chain; restart log showed ready at
    `2026-06-07 17:20:49`.
  - `GET http://127.0.0.1:8787/api/public-config` reports
    `clientBuildId=0.1.11|codex-mobile-shell-v213`,
    `shellCacheName=codex-mobile-shell-v213`, `platform=win32`.
  - Authenticated thread API smoke on thread `019e8050...` showed recent
    successful completed turn `019ea15d...` has `usageCount=1`.
  - The newest visible turn `019ea164...` was still `inProgress` during the
    smoke test, so it correctly had `usageCount=0` until completion.

## 2026-06-07 Usage Projection Receipt-only Follow-up

- Follow-up issue:
  - User still saw completed turns without Usage in both the current Codex
    Mobile thread and the Home AI thread after v213.
- Diagnosis:
  - Authenticated API smoke before this follow-up showed the current Codex
    Mobile thread's latest successful completed turn had `usageCount=1`.
  - Home AI returned `projection-dynamic`; its raw rollout had valid scoped
    `token_count` for completed turns, but older completed turns in the 10-turn
    detail window still returned without `turnUsageSummary`.
  - Root cause: after Usage was attached from rollout, receipt-only compaction
    kept only user questions and the final assistant/plan receipt. It treated
    `turnUsageSummary` as a removable non-receipt item, so older completed
    turns lost Usage even though rollout parsing succeeded.
  - Related projection fast-path fix: `prepareProjectedThreadReadResult()` now
    merges display summary fields before `compactThreadReadResult()`, so
    compact/Usage code sees the rollout path from the summary.
- Implemented:
  - `server.js` now treats `turnUsageSummary` as receipt-only metadata that is
    retained for older compacted completed turns while still removing old
    intermediate operation/reasoning/progress cards.
  - Added a regression assertion in
    `test/thread-item-timestamp-enrichment.test.js` using a real temporary
    rollout with scoped `token_count` events.
  - Updated `docs/ARCHITECTURE.md`, `docs/TROUBLESHOOTING.md`, and public
    `README.md` to document the server-only follow-up.
- Validation:
  - `node --check server.js` passed.
  - Focused tests passed:
    `node --test test\thread-item-timestamp-enrichment.test.js
    test\turn-usage-summary-service.test.js
    test\thread-detail-projection-service.test.js
    test\conversation-render.test.js`.
- Runtime:
  - Per user instruction, Listener was not restarted after this follow-up.
  - The running Windows listener still has the previous v213 server process
    until an explicit restart is approved/requested.
  - Follow-up runtime check after user retest:
    - 8787 listener PID `40056` started at `2026-06-07 17:27:42`, before the
      server-only receipt-only Usage fix was edited.
    - Live API still drops `turnUsageSummary` after leaving and re-entering
      older completed turns, matching the user's report.
    - Offline simulation with current repository code and the real rollout
      paths for Codex Mobile and Home AI retains `usageCount=1` on every
      completed turn in the current 10-turn windows, so the code fix is ready
      but not active in the running listener.
  - User approved continuing with restart. Shared-chain restart completed at
    `2026-06-07 17:52:32`; 8787 listener moved to PID `6544`.
  - Post-restart authenticated API smoke:
    - Codex Mobile thread `019e8050...` returned `projection-dynamic`; all
      completed turns in the current window had `usageCount=1`.
    - Home AI thread `019e9566...` returned `projection-dynamic`; all completed
      turns in the current window had `usageCount=1`.
  - Public publishing:
    - User explicitly requested public push after private commit `50c86fc`.
    - Public-safe product/docs/tests/README files were synced to
      `C:\Users\xuxin\Documents\codex-mobile-web-public`; `.agent-context`,
      runtime state, local keys, uploads, and machine diagnostics were not
      copied.
    - Public commit `043576a 发布线程详情投影与 Usage 稳定性修复 v213` was pushed to
      `pentiumxp/codex-mobile-web-public` `origin/main`.
    - Public validation passed: `npm.cmd run check`, `npm.cmd run check:macos`,
      `npm.cmd test` with 365 tests, `git diff --check` with only expected
      LF/CRLF warnings, BOM checks, and bounded privacy scan. Privacy scan
      hits were expected documentation/path references or token field names,
      not raw secrets.

## 2026-06-07 Windows Profile Mux Quota And Goal-State Follow-up

- User clarification:
  - Current Codex development machine is Windows. Do not investigate Mac unless
    explicitly requested again.
  - Goal UI is not the focus; user can start goals through normal conversation.
- Diagnosis:
  - Profile store had active profile `previous` / safe account label
    `2261065@qq.com`, but the running 8787 listener had been started with the
    default `C:\Users\xuxin\.codex` home before manual correction.
  - After manual shared-chain restart with `-ProfileId previous`, 8787 reported
    `codexHome=C:\Users\xuxin\.codex-homes\previous` but live quota was still
    absent.
  - Direct local mux RPC to the `previous` endpoint returned valid quota
    snapshots (`codex` and `codex_bengalfox`), proving auth/mux were valid and
    the remaining issue was Mobile Web's trust/exposure path.
  - Root cause for quota: shared-profile homes intentionally ignore source-less
    live quota, but the new shared mux path connects through the active profile
    home's endpoint as `external-jsonl-tcp`. Mobile Web did not classify that
    endpoint as a trusted live quota source, so valid `account/rateLimits/read`
    snapshots could be hidden for non-default profile homes.
  - A second root cause affects thread goals after account/profile switching:
    launcher shared state linked thread/session state but did not link
    `goals_1.sqlite*`. The same visible thread could therefore have different
    goal status in default vs non-default homes.
- Implemented:
  - `server.js` now classifies live quota from the active profile home's mux
    endpoint as `profile-mux-live`; arbitrary external live quota remains
    untrusted for shared-profile homes.
  - `server.js` also retries `account/rateLimits/read` when `/api/public-config`
    or `/api/status` is requested and no valid live quota has been hydrated yet,
    with a short cooldown to avoid polling pressure.
  - `adapters/codex-profile-service.js` exposes `profile-mux-live` only for the
    active profile and still does not persist it as reusable profile quota.
  - `start-codex-mobile-web-windowless.ps1` and
    `start-codex-desktop-shared.ps1` now include `goals_1.sqlite`,
    `goals_1.sqlite-wal`, and `goals_1.sqlite-shm` in the non-auth shared-state
    hard-link set. Auth files remain profile-owned and are still excluded.
  - Regression coverage added in `test/codex-profile-service.test.js` and
    `test/new-thread-route.test.js`; launcher goal-link coverage added in
    `test/codex-profile-ui.test.js` and `test/desktop-profile-launcher.test.js`.
  - `docs/ARCHITECTURE.md`, `docs/TROUBLESHOOTING.md`, and
    `docs/MULTI_ACCOUNT_CODEX_CLI.md` now document trusted live quota and
    shared goal DB state.
- Validation:
  - Targeted profile/goal/launcher tests passed.
  - `npm run check` passed.
  - `npm test` passed with 372 tests.
  - Windows 8787 Node listener was lightly restarted without killing the mux;
    `/api/public-config` now reports active profile `previous`, active Codex
    home `C:\Users\xuxin\.codex-homes\previous`, and quota source
    `profile-mux-live`.
- Runtime state:
  - Direct app-server `thread/list` with Mobile's state-db params returned 32
    rows; `Home AI` was active and `Codex mobile` was idle at inspection time.
  - Runtime goal DB relink was not forced because `previous\goals_1.sqlite` was
    locked by the active app-server and `Home AI` was active. The code fix will
    repair the link on the next full shared-chain restart. Do not kill the mux
    just to repair this while Home AI is still active unless the user explicitly
    approves interruption.

## 2026-06-08 Mac Home AI Embedded Codex Single Runtime Alignment

- Context:
  - Home AI production embeds the existing Mac Codex Mobile Web service through
    `com.hermesmobile.plugin.codex-mobile` on `127.0.0.1:8787`.
  - This is the single intended runtime. The Mac dev clone under
    `/Users/xuxin/Developer/HomeAIDev/codex-mobile-web` is source only until
    explicitly deployed to the production plugin directory.
- Runtime facts verified:
  - 8787 listener is running as macOS user `xuxin`.
  - Codex Mobile status reports Codex executable
    `/Users/xuxin/.local/bin/codex`.
  - Active Codex home is `/Users/xuxin/.codex-homes/previous`.
  - Production build is `0.1.11|codex-mobile-shell-v213`.
  - Dev clone is git `main` at `bc82703` with service worker
    `codex-mobile-shell-v220`.
- Workspace registry update:
  - `/Users/xuxin/.codex-mobile-web/workspace-registry.json` previously held
    Windows paths that are invisible on Mac.
  - Added Mac dev symlink workspaces under
    `/Users/xuxin/Developer/HomeAIDev`:
    `Home-AI`, `healthy`, `Note`, `wardrobe`, `finance`, `email`,
    `codex-mobile-web`, and `codex-mobile-web-public`.
  - Authenticated `GET /api/workspaces` now returns those eight Mac dev
    entries from the single production 8787 runtime.
- Production permission boundary:
  - Home AI production app root remains unavailable to `xuxin` without sudo.
  - `xuxin` has only the narrow read/search/execute access needed for
    launchd to run `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.

## 2026-06-08 Current Development Environment Clarification

- User clarified that the current Codex Mobile Web development environment is
  now Mac.
- Treat the Mac workspace/runtime facts as current by default. Older Windows
  handoff sections are historical context only unless the user explicitly asks
  to inspect or operate on the Windows environment.

## 2026-06-08 Mac GitHub SSH Account Key Setup

- Diagnosis:
  - `github.com` SSH was forced to
    `~/.ssh/homeai_github_deploy_ed25519` with `IdentitiesOnly yes`.
  - GitHub authenticated that key as the Home-AI deploy key, so
    `pentiumxp/codex-mobile-web.git` returned `Repository not found`.
- Current local setup:
  - Removed the mistakenly generated codex-mobile-web-specific key.
  - Generated account-intended SSH key
    `~/.ssh/github_account_ed25519`; public fingerprint:
    `SHA256:MFcBjKZSwTsb5E46CeLA10Rs4CRGO+KQZUrjw0EkpIM`.
  - Updated `~/.ssh/config` so default `Host github.com` uses the account key.
  - Kept the old Home-AI deploy key reachable through `Host github.com-homeai`;
    `git ls-remote git@github.com-homeai:pentiumxp/Home-AI.git HEAD` works.
- Remaining step:
  - Add `~/.ssh/github_account_ed25519.pub` to the GitHub account SSH keys.
    Until that is done, `ssh -T git@github.com` and `git ls-remote origin HEAD`
    correctly fail with `Permission denied (publickey)`.
- Completed follow-up:
  - Refreshed GitHub CLI auth for account `pentiumxp` with
    `admin:public_key` scope using browser/device authorization.
  - Added `~/.ssh/github_account_ed25519.pub` to the GitHub account as
    `Mac Studio account key 2026-06-08`.
  - Verified `ssh -T git@github.com` authenticates as account `pentiumxp`.
  - Verified `git ls-remote origin HEAD refs/heads/main` and
    `git fetch origin --prune` now succeed for
    `git@github.com:pentiumxp/codex-mobile-web.git`.
  - Local `main` and live `origin/main` are synchronized at `bc82703`
    (`ahead/behind 0/0`) after fetch.

## 2026-06-08 Mac Production Hermes Keyboard Flicker Hotfix

- User reported that in the Mac production Hermes embedded Codex plugin,
  typing in the input box made the iOS keyboard flicker and cursor positioning
  look wrong.
- Diagnosis:
  - The active launchd service `com.hermesmobile.plugin.codex-mobile` runs from
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`, not the Git dev
    checkout under `/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web`.
  - Production was still `0.1.11|codex-mobile-shell-v213`.
  - In Hermes embed mode, `visualViewport.resize` / `visualViewport.scroll`
    fired while the contenteditable composer owned the keyboard and triggered
    bottom-follow scrolling plus visual recovery transforms. On iOS this can
    interfere with keyboard/caret layout.
- Implemented:
  - In the Git dev checkout, prepared the equivalent source fix and advanced
    source shell assertions to v221.
  - In the active production plugin directory, applied a minimal hotfix only to
    `public/app.js` and `public/sw.js`, advancing production shell to
    `codex-mobile-shell-v214`.
  - Production `public/app.js` now skips visual recovery and automatic
    bottom-follow work during Hermes embed text input focus, while still
    updating viewport/composer height variables.
- Validation:
  - Dev checkout: `node --check public/app.js public/sw.js`, focused viewport
    tests, and `npm run check` passed.
  - Production directory:
    `/Users/hermes-host/HermesMobile/runtime/node-current/bin/node --check`
    passed for production `public/app.js` and `public/sw.js`.
  - Restarted launchd listener: old PID `6377`, new PID `19882`.
  - `GET http://127.0.0.1:8787/api/public-config` now reports
    `clientBuildId=0.1.11|codex-mobile-shell-v214`,
    `shellCacheName=codex-mobile-shell-v214`, `platform=darwin`, and
    workspacePath `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Served `/app.js` contains `isHermesKeyboardInputActive`; served `/sw.js`
    contains `codex-mobile-shell-v214`.
  - Temporary write ACL for `xuxin` on production `public/app.js` and
    `public/sw.js` was removed after the hotfix; `xuxin` retains only the
    prior read/execute ACL on those files.
- Follow-up screenshot:
  - Keyboard still covers/mispositions the composer area after v214.
  - Additional diagnosis: Hermes embed CSS still forced `.app` to `height:
    100dvh`, so JS `--app-height` keyboard shrink did not actually resize the
    embedded app shell.
  - Dev checkout fix prepared: `html.embed-hermes .app` now uses
    `height: var(--app-height, 100dvh)`, and source shell/test assertions were
    advanced to v222. Focused syntax and viewport tests passed.
  - Production v215 deployment is not complete. Writing
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web/public/app.js`,
    `public/sw.js`, and `public/styles.css` requires administrator approval;
    two authorization prompts were cancelled, so production remains v214.
  - Re-read the updated central Home AI production contract at
    `/Users/hermes-dev/HermesMobileDev/app/docs/PLATFORM_CONTRACTS/macos-dev-to-production-deployment-contract.md`.
    It now explicitly requires plugin threads to load the central contract and
    use the Home AI shared deploy script instead of direct production writes or
    plugin-private sudo flows.
  - Prepared a contract-shaped clean staging source at
    `/Users/hermes-dev/HermesMobileDev/.deploy-staging/codex-mobile-web-keyboard-v215`
    by copying production v214 and applying only the keyboard v215 patch
    (`public/app.js`, `public/sw.js`, `public/styles.css`). Local staging commit
    is `e93d1b16c84d`.
  - Staging validation passed: `node --check public/app.js public/sw.js` and
    `npm run check`.
  - Shared deploy plan-only command passed:
    `node /Users/hermes-dev/HermesMobileDev/app/scripts/deploy-macos-production.js
    --plugin codex-mobile-web --source
    /Users/hermes-dev/HermesMobileDev/.deploy-staging/codex-mobile-web-keyboard-v215
    --reason codex-mobile-keyboard-v215 --health-url
    http://127.0.0.1:8787/api/public-config --json`.
  - The plan target is `plugin:codex-mobile-web`, source ref `e93d1b16c84d`,
    restart label `com.hermesmobile.plugin.codex-mobile`, health URL
    `http://127.0.0.1:8787/api/public-config`, and rollback is rsync from the
    generated backup path.
  - Execution is still blocked because `HOMEAI_MAC_SUDO_PASSWORD_FILE` is not
    configured in this Mac shell. Per the updated contract, do not fall back to
    interactive sudo or direct production ACL/write edits.
  - User configured `HOMEAI_MAC_SUDO_PASSWORD_FILE`; file existence was
    verified without printing contents.
  - Executed the shared deployment script:
    `node /Users/hermes-dev/HermesMobileDev/app/scripts/deploy-macos-production.js
    --plugin codex-mobile-web --source
    /Users/hermes-dev/HermesMobileDev/.deploy-staging/codex-mobile-web-keyboard-v215
    --reason codex-mobile-keyboard-v215 --health-url
    http://127.0.0.1:8787/api/public-config --execute --json`.
  - Deployment result:
    - target: `plugin:codex-mobile-web`
    - source ref: staging commit `e93d1b16c84d`
    - production path:
      `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`
    - backup path:
      `/Users/hermes-host/HermesMobile/backups/deploy/20260608T142216Z-plugin-codex-mobile-web-codex-mobile-keyboard-v215`
    - restart label: `com.hermesmobile.plugin.codex-mobile`
    - validation: launchd print passed; health URL passed on attempt 2 and
      returned `clientBuildId=0.1.11|codex-mobile-shell-v215`.
  - Post-deploy environment correction:
    - Initially misclassified `HOMEAI_MAC_SUDO_PASSWORD_FILE` in the plugin
      plist as a deployment credential leak and removed it after backing up the
      plist to
      `/Library/LaunchDaemons/com.hermesmobile.plugin.codex-mobile.plist.bak-clean-sudo-env-20260608T142338Z`.
    - User clarified this variable is the shared production environment
      interface for the main service and plugins, so it should remain in the
      service environment.
    - Restored `EnvironmentVariables:HOMEAI_MAC_SUDO_PASSWORD_FILE` in
      `/Library/LaunchDaemons/com.hermesmobile.plugin.codex-mobile.plist` after
      backing up the plist to
      `/Library/LaunchDaemons/com.hermesmobile.plugin.codex-mobile.plist.bak-restore-sudo-env-20260608T142520Z`.
    - Linted the plist, then reloaded the LaunchDaemon with bootout/bootstrap
      and kickstart.
  - Final production verification:
    - listener PID `84121` on `127.0.0.1:8787`
    - launchd state `running`; working directory
      `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`
    - `HOMEAI_MAC_SUDO_PASSWORD_FILE` is present in
      `launchctl print system/com.hermesmobile.plugin.codex-mobile` as the
      shared production environment variable path
    - `/api/public-config` reports
      `clientBuildId=0.1.11|codex-mobile-shell-v215` and
      `shellCacheName=codex-mobile-shell-v215`
    - served `/styles.css` contains
      `height: var(--app-height, 100dvh)` for `html.embed-hermes .app`

## 2026-06-08 Codex Plugin Right-Swipe Investigation Paused

- User reported Codex embedded plugin right-swipe could not return to the Home
  AI host, then clarified this should pause because the root cause is in Home
  AI rather than Codex Mobile Web.
- Dev checkout has an uncommitted exploratory Codex-side patch in
  `public/app.js` and `test/mobile-viewport.test.js`:
  - secondary Codex pages still handle iframe back by returning to the plugin
    primary page;
  - plugin primary/root edge swipe would post
    `codex-mobile.plugin.back_result` with `handled:false` and reason
    `plugin_root_unhandled`.
- A clean staging copy was also prepared but not deployed:
  `/Users/hermes-dev/HermesMobileDev/.deploy-staging/codex-mobile-web-back-root-v216`.
  It bumps `public/app.js` / `public/sw.js` to
  `codex-mobile-shell-v216` and includes the same root back-swipe fallback.
- Validation already run:
  `node --check public/app.js && node --test test/mobile-viewport.test.js
  test/hermes-plugin-route.test.js test/plugin-embed.test.js` passed in the dev
  checkout; staging `node --check public/app.js public/sw.js` plus the same
  focused tests also passed.
- Production was not changed for this right-swipe item. Production remains
  `clientBuildId=0.1.11|codex-mobile-shell-v215` /
  `shellCacheName=codex-mobile-shell-v215`.

## 2026-06-08 Embedded Keyboard Viewport v217

- User resumed the keyboard/composer issue and clarified:
  - flicker happens when typing each character after the input method is open;
  - the page does not move up, so the keyboard covers the composer;
  - standalone Codex Mobile Web does not reproduce it;
  - the issue occurs in plugin mode on both Mac and Windows production.
- Diagnosis:
  - The failure is plugin/iframe-specific. Codex only used iframe-local
    `visualViewport.height` shrink. In Home AI embedded mode, the host can
    send `hermes.plugin.viewport` with keyboard bottom inset while the iframe's
    own visual viewport does not shrink in the same way.
  - v216 first added host viewport bridge handling and set `--app-height`, but
    Appium smoke showed a false positive: `--app-height` became `422px` while
    `.app.getBoundingClientRect().height` stayed `714px` because
    `html.embed-hermes .app` still had `min-height: 100%`.
- Implemented and deployed:
  - Clean staging source:
    `/Users/hermes-dev/HermesMobileDev/.deploy-staging/codex-mobile-web-keyboard-v216`
    (now containing production v217 content; name kept from initial staging).
  - `public/viewport-metrics.js` now treats focused input plus any of these as
    keyboard shrink: iframe visual viewport shrink, iframe `offsetTop`, iframe
    `scrollTop`, or bounded host `keyboard.bottomInset`.
  - `public/app.js` now stores bounded `hermes.plugin.viewport` messages for
    `pluginId=codex-mobile`, updates `--app-height` and `--app-top`, and skips
    visual recovery while Hermes input is active.
  - `public/styles.css` now sets `html.embed-hermes .app { min-height: 0; }`
    so keyboard height compression is not cancelled by the old `min-height:
    100%`.
  - `public/app.js` / `public/sw.js` production shell advanced to
    `codex-mobile-shell-v217`.
- Validation:
  - Dev checkout focused validation passed:
    `node --check public/app.js public/sw.js` and
    `node --test test/viewport-metrics.test.js test/mobile-viewport.test.js
    test/hermes-plugin-route.test.js test/plugin-embed.test.js`.
  - Staging validation passed:
    same focused tests plus `npm run check`.
  - Shared deploy script executed successfully:
    `node /Users/hermes-dev/HermesMobileDev/app/scripts/deploy-macos-production.js
    --plugin codex-mobile-web --source
    /Users/hermes-dev/HermesMobileDev/.deploy-staging/codex-mobile-web-keyboard-v216
    --reason codex-mobile-keyboard-v217 --health-url
    http://127.0.0.1:8787/api/public-config --execute --json`.
  - Backup path:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260608T150424Z-plugin-codex-mobile-web-codex-mobile-keyboard-v217`.
  - Production health reports
    `clientBuildId=0.1.11|codex-mobile-shell-v217` and
    `shellCacheName=codex-mobile-shell-v217`.
  - Served file checks confirmed:
    `hermes.plugin.viewport` handler and `pluginHostViewport` in `/app.js`,
    `codex-mobile-shell-v217` in `/app.js` and `/sw.js`, and
    `height: var(--app-height, 100dvh)`, `min-height: 0`, and
    `transform: translateY(var(--app-top, 0px))` in `/styles.css`.
  - Appium/Safari production smoke:
    `/tmp/codex-mobile-viewport-bridge-smoke.js`.
    Artifact directory:
    `/Users/xuxin/.homeai-qa/artifacts/codex-viewport-bridge-1780931087533`.
    Result `ok=true`; after simulated host keyboard bottom inset `292`,
    `activeId=messageInput`, root classes `embed-hermes keyboard-open`,
    `--app-height=422px`, actual `.app.height=422`, composer bottom `422`,
    and input bottom `414`.
- Notes:
  - The dev checkout still contains the paused exploratory right-swipe patch in
    `public/app.js` / `test/mobile-viewport.test.js`; that patch was not
    included in the clean production v217 staging/deploy.
  - Dev checkout shell is `codex-mobile-shell-v224` because it includes both
    the keyboard work and the paused right-swipe exploration. Production v217
    intentionally contains only the keyboard/viewport fix.

## 2026-06-08 Public Baseline Mac Plugin Hotfix v224

- User reported that the deployed Mac production plugin was stale because the
  Fast control still showed the old green dot, while Public already had the
  lightning icon. User also warned that Public contained other people's recent
  changes and asked to compare against Public before deploying.
- Comparison:
  - Public mirror:
    `/Users/hermes-dev/HermesMobileDev/public-mirrors/codex-mobile-web-public`
    at `faf2dc7` (`记录 GitHub 链接预览架构边界`).
  - Public latest includes v222 GitHub link preview support from PR #50,
    Mermaid boundary fixes, Fast lightning icon, and
    `codex-mobile-shell-v222`.
  - Older production/staging had been built from the old production v217 tree,
    so it would have missed Public's GitHub link preview files/routes/tests.
- Implemented:
  - Built a new clean staging tree from Public latest:
    `/Users/hermes-dev/HermesMobileDev/.deploy-staging/codex-mobile-web-public-v222-mac-hotfix-v224`.
  - Applied only the Mac/plugin hotfixes on top of Public:
    - `codex-mobile-shell-v224` build id/cache.
    - Hermes plugin keyboard viewport bridge using
      `hermes.plugin.viewport`, host keyboard inset, iframe offset/scroll, and
      `--app-height` / `--app-top`.
    - Suppressed non-restart reconnect refresh prompts and reconnect errors in
      Hermes embed mode; CSS hides `#refreshThreads` and `#connectionState`.
    - Preserved valid local quota snapshots in embed mode when a later
      `public-config` or status payload has empty quota fields.
    - Local `codexMobileFontSize` now wins over plugin appearance font size on
      first paint and later appearance sync, preventing app-update font reset.
  - Public functionality intentionally preserved:
    `adapters/github-link-preview-service.js`,
    `/api/link-previews/github`, GitHub preview UI hydration, markdown preview
    shells, Mermaid fixes, and Fast lightning icon.
- Validation before deploy:
  - In staging, `npm run check` passed.
  - In staging, focused tests passed with 98 tests:
    `test/composer-quota.test.js`, `test/app-update.test.js`,
    `test/new-thread-ui.test.js`, `test/hermes-plugin-route.test.js`,
    `test/mobile-viewport.test.js`, `test/viewport-metrics.test.js`,
    `test/new-thread-route.test.js`, `test/codex-profile-service.test.js`,
    `test/github-link-preview-service.test.js`,
    `test/github-link-preview-ui.test.js`, `test/markdown-render.test.js`,
    `test/thread-goal-service.test.js`, and
    `test/thread-task-card-route.test.js`.
  - Static grep confirmed presence of Fast lightning, GitHub link previews,
    `profile-mux-live`, quota snapshot preservation, embed reconnect hiding,
    stored font preference, and Hermes viewport bridge.
- Deployment:
  - Deployed with:
    `node /Users/hermes-dev/HermesMobileDev/app/scripts/deploy-macos-production.js
    --plugin codex-mobile-web --source
    /Users/hermes-dev/HermesMobileDev/.deploy-staging/codex-mobile-web-public-v222-mac-hotfix-v224
    --execute --restart auto --health-url
    http://127.0.0.1:8787/api/public-config --reason
    codex-mobile-public-v222-mac-hotfix-v224 --validation-retries 20
    --validation-delay-ms 2000 --json`.
  - Backup path:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260608T153157Z-plugin-codex-mobile-web-codex-mobile-public-v222-mac-hotfix-v224`.
  - LaunchDaemon `system/com.hermesmobile.plugin.codex-mobile` restarted and
    remained running.
  - LaunchDaemon environment still includes
    `HOMEAI_MAC_SUDO_PASSWORD_FILE => /Users/xuxin/Desktop/sudo`.
- Production verification:
  - `/api/public-config` reports
    `clientBuildId=0.1.11|codex-mobile-shell-v224`,
    `shellCacheName=codex-mobile-shell-v224`, and workspace path
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Production `npm run check` passed.
  - Production focused tests passed with 58 tests, including Fast, app update,
    quota UI, Hermes plugin route, mobile viewport, viewport metrics, GitHub
    preview service/UI, and markdown rendering.
  - Production static grep confirmed Fast lightning with no `composer-fast-dot`,
    GitHub link preview service/UI, profile mux quota trust, embed reconnect
    hiding, quota snapshot preservation, font preference preservation, and
    Hermes viewport bridge.
  - Authenticated smoke against production:
    quota present with primary used percent `23` and weekly used percent `52`;
    `/api/link-previews/github` for Public PR #50 returned supported
    `kind="pull"` with a title.
- Notes:
  - Browser/Appium visual smoke was not run in this final v224 deploy turn; the
    keyboard bridge behavior is covered by the same viewport-metrics logic and
    focused tests, and was previously Appium-smoked for the v217 keyboard
    implementation.
  - Do not redeploy the older v217/v220/v221 production-derived staging trees;
    they are known to miss Public v222 GitHub link preview changes.

## 2026-06-08 Home AI Platform Contract Pointer And Live iOS Debug

- User required Codex Mobile Web to be covered by the Home AI platform contract
  live iOS PWA debug tooling, not left outside the standard pointer/checker
  path.
- Added `docs/HOME_AI_PLATFORM_CONTRACT.md`.
  - Home AI Platform Contract Pointer version: `20260606-v1`.
  - `plugin_id=codex-mobile`.
  - `production_source_path_macos=/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - `production_data_root_macos=/Users/xuxin/.codex-mobile-web`.
  - `macos_production_base_url=http://127.0.0.1:8787`.
  - `launchd_label=system/com.hermesmobile.plugin.codex-mobile`.
  - `ios_live_debug_available=yes`.
- Durable debug rule:
  - For embedded UI, keyboard, gesture, cache, or PWA reproduction loops, start
    from Home AI `cd /Users/hermes-dev/HermesMobileDev/app && npm run ios:pwa:debug`.
  - Use one Simulator/live-debug-port/WDA-port/MJPEG-port lane per concurrent
    plugin debug session.
  - Record bounded final Simulator/Appium or installed-PWA evidence for
    acceptance; do not store raw keys, launch tokens, cookies, auth state,
    prompts, uploaded payloads, or long logs.
- Platform center follow-up was made in `/Users/hermes-dev/HermesMobileDev/app`:
  `scripts/plugin-workspace-platform-contract-check.js` now includes
  `codex-mobile`, and the central rollout/test matrix docs no longer treat
  Codex Mobile Web as excluded from the platform contract.
- Validation run in `/Users/hermes-dev/HermesMobileDev/app`:
  - `node --check scripts/plugin-workspace-platform-contract-check.js`;
  - `node tests/plugin-workspace-platform-contract-check.test.js`;
  - `node scripts/plugin-workspace-platform-contract-check.js --plugin codex-mobile --json`;
  - `node scripts/plugin-workspace-platform-contract-check.js --json`;
  - `node scripts/plugin-workspace-platform-contract-check.js --plugin codex-mobile --probe-mac --require-mac-ok --ssh-alias local --json`.
  The local Mac probe verified production source, launchd, manifest, and
  `/api/public-config` without printing raw keys or private payloads.

## 2026-06-09 Codex Tool Output Image Projection Fix

- Task: fix Codex Mobile thread detail so Codex tool-generated screenshots from
  rollout `function_call_output` / `custom_tool_call_output` payloads render as
  image cards, especially `view_image` outputs carrying
  `{type:"input_image", image_url:"data:image/png;base64,..."}`.
- Source changes in this dev checkout:
  - `adapters/generated-image-cache-service.js` now validates safe bitmap
    data-image URLs, rejects unsupported image types such as SVG, and caches
    accepted bytes under the existing generated-image cache root.
  - `server.js` now converts tool-output image parts into standard `imageView`
    items during thread compaction, attaches authenticated
    `/api/generated-images/file` content URLs, removes inline base64 from the
    projected item, and dedupes repeated same-call/same-image parts.
  - `public/app.js` image captions can use `label` / `fileName` / `caption`
    when an image is served only by generated-image `contentUrl`.
  - Added missing `adapters/github-link-preview-service.js` because current
    `server.js` already required it and require-time tests could not load the
    server without it.
  - Added `test/tool-output-image-projection.test.js` plus focused cache/UI
    assertions.
  - Updated image-rendering docs in `docs/ARCHITECTURE.md`,
    `docs/COMPLEX_FEATURE_PATHS.md`, and `docs/TROUBLESHOOTING.md`.
- Validation:
  - `node --check server.js public/app.js adapters/generated-image-cache-service.js`
    passed.
  - `node --test test/generated-image-cache-service.test.js
    test/tool-output-image-projection.test.js test/conversation-render.test.js
    test/file-preview-ui.test.js test/thread-item-timestamp-enrichment.test.js`
    passed: 41 tests.
  - `npm run check` passed.
  - Production route smoke against existing `127.0.0.1:8787` generated-image
    route: no key returned `401 application/json`; access key returned
    `200 image/png`. Key value was not printed.
  - Local smoke using the real source rollout
    `/Users/xuxin/.codex/sessions/2026/06/08/rollout-2026-06-08T21-48-53-019ea77e-4e36-7820-adf4-9bf0272965b8.jsonl`
    and a temporary generated-image cache produced one `imageView` for current
    turn `019ea7ef-14b0-7d72-8da4-16ad95ab2c6d`, with
    `/api/generated-images/file?id=...`, `image/png`, size `314293`, and no
    inline data URL in the projected item.
- Deployment state:
  - Not deployed to production in this turn. The dev worktree has many
    unrelated pre-existing dirty files; direct full-directory deployment would
    mix unrelated changes. Use the shared Mac production deploy script with a
    staging copy built from current production plus only the selected image
    projection files if production rollout is requested.

## 2026-06-09 Local Commit Split After Image Projection Fix

- User asked to commit the completed image-rendering fix first, then commit the
  remaining local changes.
- Commits created in this dev checkout:
  - `5b194f5 Render tool output images in thread detail`.
  - `1f9ab73 Sync mobile workspaces with desktop state`.
  - `ab4289c Add bounded GitHub link preview route`.
  - `ab5819c Harden Hermes embed viewport behavior`.
- Focused validation after splitting remaining changes:
  - Workspace sync: `node --check server.js`,
    `node --check adapters/workspace-registry-service.js`, and
    `node --test test/workspace-registry-service.test.js` passed.
  - GitHub preview backend: `node --check server.js`,
    `node --check adapters/github-link-preview-service.js`,
    `node --test test/github-link-preview-service.test.js`, and
    `git diff --cached --check` passed.
  - Hermes embed/frontend: `node --check public/app.js public/sw.js
    public/viewport-metrics.js`, focused UI/viewport/thread tests, and
    `git diff --check` for the edited frontend/test files passed.
- Remaining context files were reviewed for raw secret patterns before commit.
  Matches were policy text or bounded path references only; no key, token,
  cookie, password, or auth-file contents were recorded.
- Production deployment still has not been performed for the image projection
  fix or any newly committed dev changes in this turn.

## 2026-06-09 Hermes Embed Recovery Refresh v225

- User reported two production regressions in the Hermes embedded Codex plugin:
  - the Reconnect banner was hidden, but the thread list still visibly
    refreshed every few seconds;
  - after sending a message, the submitted user message often appeared twice
    briefly, then one copy disappeared after a later refresh.
- Diagnosis:
  - In Hermes embed mode, SSE error recovery still called
    `loadThreads({ silent: true })` on every fallback poll. Because the event
    stream can remain non-open in the iframe path, this silently re-rendered
    the already-loaded thread list every poll cycle.
  - User-message merge logic only treated `type:"text"` parts as comparable
    text. App-server/user input commonly returns `input_text`, so a local
    `local-user-*` item or server `mux-user-*` pending echo could fail to match
    the real userMessage on the first merge.
- Implemented:
  - `public/app.js` now routes event recovery thread-list refresh through
    `refreshThreadListDuringEventRecovery()`. In Hermes embed mode it skips
    list refresh once a list is already loaded, while still refreshing status
    and the current thread.
  - User message comparison now understands `input_text`, string content, and
    bounded image/path references. Optimistic `local-user-*`,
    `mux-user-*`, or `mobilePendingSubmission` messages can collapse into a
    matching real userMessage by normalized text.
  - Shell advanced to `0.1.11|codex-mobile-shell-v225`.
  - `docs/HOME_AI_PLATFORM_CONTRACT.md` now declares Mac DEV runtime
    prerequisites and the checked `ios:pwa:visual` harness command.
- Validation:
  - Focused checks passed:
    `node --check public/app.js public/sw.js`;
    `node --test test/app-update.test.js test/conversation-render.test.js
    test/mobile-viewport.test.js test/thread-goal-service.test.js
    test/thread-task-card-route.test.js`.
  - `npm run check` passed.
  - `npm test` passed with 399 tests.
  - `git diff --check` passed.
  - Home AI platform contract check passed:
    `node scripts/plugin-workspace-platform-contract-check.js --plugin
    codex-mobile --json`.
- Production deployment:
  - Commit deployed: `89cda66`.
  - Shared deploy command used Home AI central Mac deploy script with
    `--plugin codex-mobile-web`, source
    `/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web`, restart
    label `com.hermesmobile.plugin.codex-mobile`, health URL
    `http://127.0.0.1:8787/api/public-config`, and reason
    `codex-mobile-embed-recovery-v225`.
  - Backup path:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260608T163812Z-plugin-codex-mobile-web-codex-mobile-embed-recovery-v225`.
  - LaunchDaemon validation passed and `/api/public-config` reported
    `clientBuildId=0.1.11|codex-mobile-shell-v225` and
    `shellCacheName=codex-mobile-shell-v225`.
  - Production `npm run check` passed in
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Production static smoke confirmed `/app.js` and `/sw.js` serve v225,
    `/api/v1/hermes/plugin/manifest` returns `codex-mobile`, and `/app.js`
    contains the event-recovery list guard and optimistic user-message merge
    logic.
- Visual toolchain status:
  - Center live debug server was used per contract and restarted at
    `http://127.0.0.1:19073/` with WDA MJPEG ports `8101` / `9100`.
  - `npm run ios:pwa:visual -- --scenario embedded-plugin-shell --plugin-id
    codex-mobile --debug-url http://127.0.0.1:19073/ --app-url
    http://127.0.0.1:8797/?source=pwa` could not produce a valid plugin-shell
    assertion because the Simulator PWA was unauthenticated (`authenticated:
    false`, app hidden). The harness failure was therefore a Home AI PWA
    session/auth precondition issue, not a Codex assertion failure.
  - The temporary live debug server started for this validation was stopped.

## 2026-06-09 Hermes Media Auth And Font Sync v226

- User reported two embedded-only regressions after the v225 deploy:
  - Codex `view_image` cards appeared but displayed `图片无法加载`.
  - After refreshing to a new version, the embedded plugin font size fell back
    from the user's extra-large setting to a smaller host/default value.
- Diagnosis:
  - Server projection and cache were already correct. The example generated
    image file existed under
    `/Users/xuxin/.codex-mobile-web/generated-images/...`, and authenticated
    `/api/generated-images/file` returned `200 image/png`; unauthenticated
    returned `401`.
  - The remaining failure was embedded media authentication. Normal JSON API
    calls carry the in-memory `cps_...` plugin session in
    `X-Codex-Mobile-Key`, but browser `<img>` loads cannot send that header.
    Old or missing image query tokens could leave the card broken even though
    the thread projection was correct.
  - The font reset is also plugin-only: Hermes relaunches the iframe on shell
    refresh/session recovery. If the host launch carries an older font value
    and iframe localStorage is unavailable or lost, the plugin can restart at
    the host value instead of the user's in-plugin choice.
- Implemented:
  - Commit: `31a0f13 Stabilize Hermes media auth and font sync`.
  - Shell advanced to `0.1.11|codex-mobile-shell-v226`.
  - `server.js` now evaluates all bounded auth token candidates from headers,
    query params, `codex_mobile_plugin_session`, and `codex_mobile_key` cookies
    instead of letting one stale query token mask a current cookie/session.
  - `/api/v1/hermes/plugin/session` now sets a short-lived HttpOnly
    `codex_mobile_plugin_session` cookie for same-origin media loads.
  - `public/app.js` always refreshes same-origin API image URLs with the
    current in-memory key, probes failed generated-image loads for 401/403 once,
    and requests a bounded Hermes refresh instead of leaving a permanent broken
    image.
  - Plugin appearance state now lets local `codexMobileFontSize` override host
    appearance, updates the scrubbed embed URL after in-plugin font changes,
    and includes sanitized `appearance` in navigation and refresh-required
    postMessages.
  - `public/plugin-embed.js` now includes whitelisted `theme`/`fontSize`
    appearance metadata in plugin navigation and refresh-required messages.
- Validation:
  - `npm run check` passed.
  - Focused tests passed:
    `node --test test/plugin-embed.test.js test/hermes-plugin-route.test.js
    test/conversation-render.test.js test/generated-image-cache-service.test.js
    test/tool-output-image-projection.test.js test/file-preview-ui.test.js`.
  - `npm test` passed with 400 tests.
  - `npm run check:macos` passed.
  - Home AI platform contract check passed:
    `node scripts/plugin-workspace-platform-contract-check.js --plugin
    codex-mobile --json`.
- Production deployment:
  - Deployed commit `31a0f13b51fb` through the Home AI central Mac deploy
    script with reason `codex-mobile-hermes-media-font-v226`.
  - Backup path:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260608T165345Z-plugin-codex-mobile-web-codex-mobile-hermes-media-font-v226`.
  - LaunchDaemon validation passed and `/api/public-config` reported
    `clientBuildId=0.1.11|codex-mobile-shell-v226` and
    `shellCacheName=codex-mobile-shell-v226`.
  - Production manifest smoke returned `id=codex-mobile`,
    `kind=embedded_app`, `rawAccessKeyReturned=false`, and font-size values
    `small/default/large/xlarge/xxlarge`.
  - Generated-image production smoke:
    unauthenticated `401`, Access Key `200 image/png`, plugin session cookie
    with stale query token `200 image/png`; no raw keys or tokens were printed.
  - Plugin session launch/session smoke returned `appearance.fontSize=xlarge`
    and set the plugin-session cookie.
- Visual toolchain:
  - Standard `ios:pwa:visual --scenario embedded-plugin-shell --plugin-id
    codex-mobile` initially hit the known Home AI Simulator precondition:
    the PWA was unauthenticated (`authenticated:false`, app hidden), so it
    could not open the plugin through `openPluginTopicApp`.
  - The live debug server was restarted and used directly to open a real Codex
    plugin launch URL without printing launch tokens.
  - Direct live-debug DOM evidence passed:
    build `0.1.11|codex-mobile-shell-v226`, `fontSize=xlarge`,
    `embed=true`, current thread
    `019ea77e-4e36-7820-adf4-9bf0272965b8`, one rendered image card,
    `failedCount=0`, image natural size `942x2048`, caption
    `view_image output`.
  - Screenshot artifact:
    `/Users/xuxin/.homeai-qa/artifacts/codex-mobile-v226-media-font-1780937849769.png`.
  - The temporary live debug server started for direct validation was stopped.

## 2026-06-09 Upload Image Auth And Pending Echo v227

- User reported two remaining embedded Codex Mobile issues after v226:
  - User-uploaded images still displayed `图片无法加载`, while Codex-generated
    referenced images rendered correctly.
  - A just-sent user message briefly appeared twice, then one copy disappeared.
- Diagnosis:
  - Uploaded images use `/api/uploads/file`, not `/api/generated-images/file`.
    The v226 failed-image auth probe only covered generated-image URLs.
  - `imageSourceForPart` always preferred an attachment-summary path when a
    matching image part existed. During optimistic/local or mixed app-server
    input, that path may be only a filename such as `IMG_5882.jpg`; the browser
    then tried `/api/uploads/file?path=IMG_5882.jpg`, which is outside the safe
    upload root and cannot load.
  - Image-only optimistic user messages compared a local filename with the
    server's absolute upload path, so they were not always treated as the same
    user message until a later refresh rebuilt the turn.
- Implemented:
  - Commit: `e786c9c Fix mobile upload image auth and pending echo dedupe`.
  - Shell advanced to `0.1.11|codex-mobile-shell-v227`.
  - `public/app.js` now routes upload-file URLs through the same authenticated
    same-origin API URL refresh as other media.
  - Failed-image probing now covers `/api/uploads/file` and
    `/api/files/preview/content` in addition to `/api/generated-images/file`.
  - Input-image rendering only uses an attachment-summary path when it is an
    absolute local path; otherwise it falls back to the image part's own
    `image_url` / data URL / blob URL instead of fabricating an upload URL from
    a bare filename.
  - User-message merge now limits shadowing to optimistic/local/mux messages,
    compares optimistic attachment basenames for image-only sends, and collapses
    matching local, mux, and durable app-server echoes to one visible message.
- Validation:
  - `node --check public/app.js` passed.
  - Focused tests passed:
    `node --test test/conversation-render.test.js` and
    `node --test test/mobile-viewport.test.js test/thread-goal-service.test.js
    test/thread-task-card-route.test.js`.
  - `npm run check` passed.
  - `npm test` passed with 402 tests.
  - `npm run check:macos` passed.
  - Home AI platform contract check passed:
    `node scripts/plugin-workspace-platform-contract-check.js --plugin
    codex-mobile --json`.
- Production deployment:
  - Deployed commit `e786c9c11ba5` through the Home AI central Mac deploy
    script with reason `codex-mobile-upload-image-echo-v227`.
  - Backup path:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260609T002806Z-plugin-codex-mobile-web-codex-mobile-upload-image-echo-v227`.
  - LaunchDaemon validation passed and `/api/public-config` reported
    `clientBuildId=0.1.11|codex-mobile-shell-v227`,
    `shellCacheName=codex-mobile-shell-v227`, and `platform=darwin`.
  - Uploaded-image production smoke:
    unauthenticated `401`, Access Key `200 image/jpeg`, plugin session cookie
    with stale query token `200 image/jpeg`; no raw keys or tokens were
    printed.
  - Generated-image production smoke remained protected:
    unauthenticated `401`, Access Key `200 image/png`.
- Visual toolchain:
  - Used Home AI `npm run ios:pwa:debug` directly.
  - Opened a real Codex plugin launch URL with top-level `threadId` target
    `019ea76b-d846-7892-bda0-c0fff9cf7581` without printing launch tokens.
  - Direct live-debug DOM evidence passed:
    `embed=true`, `fontSize=xlarge`, target thread text present, image cards
    included one uploaded image and one generated image, `failedCount=0`.
  - After scrolling the uploaded image into view, DOM evidence showed upload
    image `complete=true`, natural size `591x1280`, caption `IMG_5882.jpg`,
    and `failedUploadCount=0`.
  - Screenshot artifact:
    `/Users/xuxin/.homeai-qa/artifacts/codex-mobile-v227-upload-image-1781040000.png`.
  - The temporary live debug server started for direct validation was stopped.

## 2026-06-09 Public PR Review Workspace Routing v228

- User reported that with one open public PR, tapping the merge/review flow got
  stuck at the new-thread creation step.
- Diagnosis:
  - Production `/api/public-config.workspacePath` is the deployed plugin path:
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Codex Desktop visible workspaces contain the source checkout:
    `/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web`, not the
    deployed `/Users/hermes-host/...` directory.
  - Public PR preparation used `workspacePath` directly, so the new-thread draft
    could be sent with an invisible cwd and fail `/api/threads/new-message`
    workspace visibility validation.
- Implemented:
  - Commit: `e5a80a2 Fix public PR review workspace routing`.
  - Shell advanced to `0.1.11|codex-mobile-shell-v228`.
  - `public/app.js` now resolves the Public PR review workspace through
    `publicPrReviewWorkspacePath()`:
    - use `/api/public-config.workspacePath` when it is visible;
    - otherwise use a visible workspace with the same basename;
    - otherwise fall back to selected/current workspace when visible.
  - `preparePublicPrMergePrompt()` loads workspaces if needed before choosing
    the review workspace.
  - Docs now describe the production deployment path to source-workspace
    fallback.
- Validation:
  - Focused tests passed:
    `node --test test/app-update.test.js test/new-thread-route.test.js
    test/mobile-viewport.test.js test/thread-goal-service.test.js
    test/thread-task-card-route.test.js`.
  - Development server smoke on `127.0.0.1:18787` passed:
    open public PR `#53` was visible; both the dev `workspacePath` and simulated
    production deployment path resolved to
    `/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web`.
  - Development `/api/threads/new-message` smoke returned thread id
    `019ea9ed-6fe9-7052-b7d9-5b32b515fef1`, turn id
    `019ea9ed-745a-7901-ad2d-b12d7c6fcce8`, title update/index both true, and
    cwd `/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web`; the smoke
    thread was archived afterward.
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `npm test` passed with 403 tests.
  - Home AI platform contract check passed:
    `node scripts/plugin-workspace-platform-contract-check.js --plugin
    codex-mobile --json`.
- Production deployment:
  - Deployed commit `e5a80a2b0afc` through the Home AI central Mac deploy
    script with reason `codex-mobile-public-pr-workspace-v228`.
  - Backup path:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260609T011046Z-plugin-codex-mobile-web-codex-mobile-public-pr-workspace-v228`.
  - LaunchDaemon validation passed and `/api/public-config` reported
    `clientBuildId=0.1.11|codex-mobile-shell-v228`,
    `shellCacheName=codex-mobile-shell-v228`, and `platform=darwin`.
  - Production smoke confirmed open public PR `#53` and resolved production
    `workspacePath` `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`
    to review workspace
    `/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web`.

## 2026-06-09 Side Chat Keyboard Clearance v252

- User reported the newly added side chat input was hidden by the iOS keyboard
  in embedded plugin production mode.
- Implemented:
  - Shell advanced to `0.1.11|codex-mobile-shell-v252`.
  - `public/styles.css` now gives the left side panel higher stacking than the
    main composer and, while `keyboard-open`, binds the side panel to the
    host-provided visible app height with compact Subagent and side-chat rows.
  - `public/app.js` now keeps the focused side-chat draft textarea/form visible
    after host viewport updates, focus, and input events.
  - Added a minimal embedded-only `window.__codexMobileVisualHarness` facade for
    the central visual toolchain. It exposes only safe layout/control methods
    and build/thread identifiers; it does not expose raw state, cookies, keys,
    tokens, or logs.
  - Home AI central visual harness was patched to use this facade for Codex
    Mobile side-chat scenarios because Codex Mobile keeps its runtime state in
    module scope, not on `window.state`.
- Validation before production:
  - Focused tests passed:
    `node --test test/mobile-viewport.test.js test/thread-goal-service.test.js
    test/thread-task-card-route.test.js`.
  - `npm run check`, `npm test`, and `npm run check:macos` passed in this
    plugin workspace.
  - Home AI checks passed:
    `node --check scripts/ios-pwa-visual-harness.js`,
    `node --test tests/ios-pwa-visual-harness.test.js`,
    `node scripts/plugin-workspace-platform-contract-check.js --plugin
    codex-mobile --json`, and `npm run check`.
  - Development visual validation used the central contract scenario
    `embedded-plugin-side-chat-keyboard` with target thread
    `019ea76b-d846-7892-bda0-c0fff9cf7581`.
  - Development visual result passed with simulated canonical host keyboard
    viewport: keyboard top `392`, textarea bottom `322`, composer bottom `362`,
    input clearance `70`, composer clearance `30`, side-chat panel open, and
    side-chat textarea focused.
  - Development artifact:
    `/Users/xuxin/.homeai-qa/artifacts/ios-pwa-visual-embedded-plugin-side-chat-keyboard-codex-mobile-20260609T071211Z.png`.
- Production deployment:
  - Deployed source commit `07c5ad316cad` through the Home AI central Mac
    deploy script with reason `codex-mobile-side-chat-keyboard-v252`.
  - Backup path:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260609T071617Z-plugin-codex-mobile-web-codex-mobile-side-chat-keyboard-v252`.
  - LaunchDaemon validation passed and `/api/public-config` reported
    `clientBuildId=0.1.11|codex-mobile-shell-v252`,
    `shellCacheName=codex-mobile-shell-v252`, `buildId=c35f887701a41a9f`,
    and `platform=darwin`.
  - Production visual validation used the central contract scenario
    `embedded-plugin-side-chat-keyboard` against
    `https://wardrobe-xuxin.synology.me:8555/?source=pwa`.
  - Production visual result passed with plugin build
    `0.1.11|codex-mobile-shell-v252`, target thread
    `019ea76b-d846-7892-bda0-c0fff9cf7581`, keyboard top `471`, textarea
    bottom `334`, composer bottom `374`, input clearance `137`, composer
    clearance `97`, side-chat panel open, and side-chat textarea focused.
  - Production artifact:
    `/Users/xuxin/.homeai-qa/artifacts/ios-pwa-visual-embedded-plugin-side-chat-keyboard-codex-mobile-20260609T071645Z.png`.

## 2026-06-09 Side Chat AI Sidecar Replies v253

- User clarified that side chat should not be a note surface: it should get a
  current-thread model/subagent-style reply while staying outside the main
  thread's code-changing flow.
- Official Codex manual check:
  - Fresh Codex manual was fetched through the OpenAI docs skill.
  - Public docs mention side chats for status recaps/explanations without
    interrupting the main task, but do not expose an app-server side-chat RPC.
  - Implemented the already documented fallback: hidden sidecar conversation as
    an implementation detail, with Codex Mobile side-chat store as source of
    truth.
- Implemented:
  - Shell advanced to `0.1.11|codex-mobile-shell-v253`.
  - `adapters/thread-side-chat-service.js` now stores hidden sidecar metadata,
    public pending/failed status, and assistant reply lifecycle state. Hidden
    sidecar thread ids are not returned to the browser.
  - `server.js` creates/reuses one hidden read-only sidecar Codex thread per
    main thread, inherits current thread model/reasoning settings and cwd,
    injects bounded recent parent-thread context plus side-chat transcript, and
    writes the assistant reply back to the side-chat transcript.
  - Sidecar threads are filtered from normal Mobile thread lists and web-push
    completion classification.
  - `public/app.js` shows pending/failed side-chat reply state, polls the
    server while a reply is pending, and changes the side-chat submit action to
    `发送`.
  - Main thread remains untouched unless the user explicitly applies or queues a
    side-chat candidate.
- Validation before deployment:
  - Focused checks passed:
    `node --check adapters/thread-side-chat-service.js && node --check
    server.js && node --check public/app.js && node --test
    test/thread-side-chat-service.test.js test/thread-side-chat-route.test.js
    test/mobile-viewport.test.js test/thread-goal-service.test.js
    test/thread-task-card-route.test.js`.
  - `npm run check`, `npm test` (436 tests), and `npm run check:macos` passed.
  - Home AI platform checker passed:
    `node scripts/plugin-workspace-platform-contract-check.js --plugin
    codex-mobile --json`.
  - Development API smoke on `127.0.0.1:18787` passed with target thread
    `019ea76b-d846-7892-bda0-c0fff9cf7581`: POST side-chat message returned
    sidecar `pending`, polling returned assistant reply and sidecar `idle`, and
    normal thread list contained zero visible side-chat/sidecar rows.
  - Evidence ledger:
    `$HOME/.homeai-qa/codex-mobile-evidence-ledger.jsonl`.
- Production deployment:
  - Deployed source commit `3f72165500c0` through the Home AI central Mac
    deploy script with reason `codex-mobile-side-chat-ai-sidecar-v253-text-wait`.
  - Backup path:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260609T122259Z-plugin-codex-mobile-web-codex-mobile-side-chat-ai-sidecar-v253-text-wait`.
  - LaunchDaemon validation passed and `/api/public-config` reported
    `clientBuildId=0.1.11|codex-mobile-shell-v253`,
    `shellCacheName=codex-mobile-shell-v253`, and `platform=darwin`.
  - Production API smoke against `127.0.0.1:8787` passed with target thread
    `019ea76b-d846-7892-bda0-c0fff9cf7581`: POST side-chat message returned
    sidecar `pending`; polling returned assistant reply text and sidecar
    `idle`; normal `/api/threads?limit=80` returned `sideChatVisibleCount=0`.

## 2026-06-09 Side Chat Fullscreen Layout v254

- User confirmed side-chat replies now work, then asked for the panel to become
  full-screen, the upper Subagent area to collapse when there are no Subagents,
  and side-chat typography to inherit the current font-size setting.
- Implemented:
  - Shell advanced to `0.1.11|codex-mobile-shell-v254`.
  - `renderSubagentStatusWindow()` now returns no markup when the current
    thread has no Subagent items.
  - `renderSubagentPanel()` adds a `no-subagents` layout class so side chat
    receives the full panel height.
  - Side-chat header now always includes a close button, so the panel remains
    closable when the Subagent window is absent.
  - `.subagent-panel` is now a fixed full-screen overlay using `--app-height`
    / `--app-top`; side-chat message text, candidates, buttons, and textarea
    use the existing content/composer font variables instead of hard-coded
    small pixel sizes.
- Validation before commit:
  - `node --test test/collab-agent-render.test.js
    test/mobile-viewport.test.js test/thread-task-card-route.test.js
    test/thread-goal-service.test.js` passed.
  - `npm run check`, `npm run check:macos`, `npm test` (436 tests), and
    `git diff --check` passed.
  - Home AI `node tests/architecture-code-test-harness-map.test.js` passed.
  - Home AI `node scripts/plugin-workspace-platform-contract-check.js --json`
    passed; Codex Mobile pointer had no issues or warnings.
  - Browser layout fixture against development server `127.0.0.1:18787`
    passed: 390x844 panel height matched viewport, no Subagent fixture used one
    grid row, message and textarea font size were `22px` under `xxlarge`, and
    simulated keyboard `--app-height=520px` kept the textarea inside the panel.
  - Visual artifact:
    `/Users/xuxin/.homeai-qa/artifacts/codex-mobile-side-chat-fullscreen-v254.png`.
  - Evidence ledger:
    `$HOME/.homeai-qa/codex-mobile-evidence-ledger.jsonl`.

## 2026-06-09 Mobile-Owned App-Server Mux Fallback

- User reported that after Codex Desktop exits, Codex Mobile can temporarily
  fail to send messages with endpoint/JSON-file missing errors. Windows
  development did not have this dependency, so Mac production must not rely on
  Desktop to keep the app-server mux alive.
- Root cause:
  - Mac production runs Codex Mobile as a launchd plugin service, but the
    selected Codex profile endpoint can be created by Codex Desktop's stdio mux.
  - A non-keep-alive Desktop-owned mux can delete the profile endpoint and stop
    the real app-server when Desktop exits.
  - Codex Mobile was in required shared-endpoint mode, so a missing/stale
    endpoint surfaced as shared app-server unavailable instead of starting a
    Mobile-owned mux.
- Implemented:
  - `server.js` can start `codex-app-server-mux.js` itself when the selected
    profile mux endpoint is missing or stale.
  - The Mobile-owned mux is started with `CODEX_MUX_STANDALONE=1`,
    `CODEX_MUX_KEEP_ALIVE=1`, `CODEX_MUX_PUBLISH_ENDPOINT=1`, the resolved
    active `CODEX_HOME`, and the active profile endpoint file path.
  - Explicit child env overrides are applied after dropping inherited
    `CODEX_MUX_*` bridge variables, so Mobile-owned mux settings are preserved
    while managed real app-server children still avoid Desktop bridge leakage.
  - `/api/status?detail=1` now includes bounded `mobileOwnedMux` pid/running
    metadata when Mobile owns the mux.
  - Server shutdown now explicitly stops `muxChild` as well as the managed
    direct app-server child.
- Validation before commit:
  - AI Ops intake classified the task as H1 Mac production deployment and the
    required deployment docs were read from the Home AI app workspace.
  - Focused checks passed:
    `node --check server.js && git diff --check && node --test
    test/new-thread-route.test.js test/protocol.test.js
    test/desktop-profile-launcher.test.js`.
  - `npm run check`, `npm run check:macos`, and `npm test` passed with 436
    tests.
  - Home AI deployment/architecture checks passed:
    `node --check scripts/deploy-macos-production.js`,
    `node tests/macos-production-deploy-script.test.js`,
    `node tests/production-status-smoke-harness.test.js`, and
    `node tests/architecture-code-test-harness-map.test.js`.
  - Development smoke with a temporary runtime and missing temporary profile
    endpoint passed on `127.0.0.1:18787`: `/api/status?detail=1` reported
    `ready=true`, `transport=external-jsonl-tcp`, endpoint source under the
    temporary profile path, `mobileOwnedMux.running=true`, and
    `lastError=null`. The temporary runtime was removed afterward.
- Commit:
  - Product/source commit deployed to production:
    `4086dce2aef2 Fix side chat layout and mobile mux fallback`.
- Production deployment:
  - Deployed through the Home AI central Mac deploy script from a clean source
    tree.
  - Backup path:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260609T130306Z-plugin-codex-mobile-web-manual`.
  - Restarted launchd label:
    `com.hermesmobile.plugin.codex-mobile`.
  - Production `/api/public-config` reports
    `clientBuildId=0.1.11|codex-mobile-shell-v254`,
    `shellCacheName=codex-mobile-shell-v254`, build
    `47f2a372421853e5`, and default model `gpt-5.5`.
  - Production `/api/status?detail=1` reports `ready=true`,
    `transport=external-jsonl-tcp`, profile endpoint source
    `/Users/xuxin/.codex-homes/previous/app-server-mux/endpoint.json`,
    active `codexHome=/Users/xuxin/.codex-homes/previous`,
    `sharedRequired=true`, and `lastError=null`.
  - Production thread-list smoke on `/api/threads?limit=3` returned 3 rows and
    mobile token usage metadata.
  - Current production status still uses an existing profile mux endpoint, so
    `mobileOwnedMux=null` is expected until Desktop-owned/non-owned endpoint
    disappears or becomes stale. The missing-endpoint fallback was verified in
    development without mutating production endpoint state.
  - Evidence ledger entries:
    `evidence-4d3cf85f-de47-40d7-8cbe-85ec85596605`,
    `evidence-8dbe517a-47cc-4e2a-97e0-bb6e463f5499`, and
    `evidence-bcf81af2-1088-480f-82a1-e3e7f54004fc`.

## 2026-06-09 Side Chat Composer Layout v255

- User pointed out that side chat should look like normal thread content: same
  bottom composer layout with input and Send, while extra side-chat actions can
  wait until a side-chat receipt exists and attach after that receipt.
- Implemented:
  - Shell advanced to `0.1.11|codex-mobile-shell-v255`.
  - Side-chat bottom form now uses a normal composer-like row:
    `+ / textarea / Send`.
  - Low-frequency draft actions moved behind the `+` tool row:
    `存为候选` and `清空`.
  - Latest assistant side-chat receipt now renders inline action buttons:
    `发送主线程`, `完成后发送` or `排队`, and `存为候选`.
  - Clicking a receipt action first creates a server-side side-chat candidate
    from that receipt text, then reuses the existing candidate apply/queue
    lifecycle. Main-thread injection still only happens after explicit user
    action.
  - Added `scripts/side-chat-layout-visual-fixture.js`, a bounded Chrome
    headless fixture that renders the side-chat panel at 390px and writes
    screenshot plus rect evidence without keys or live thread content.
- Validation before commit:
  - AI Ops intake classified this as H3; required Home AI architecture/test
    docs were read.
  - Focused checks passed:
    `node --check public/app.js && node --check public/sw.js && git diff
    --check`;
    `node --test test/collab-agent-render.test.js test/mobile-viewport.test.js
    test/thread-side-chat-service.test.js test/thread-side-chat-route.test.js`;
    Home AI `node tests/architecture-code-test-harness-map.test.js`.
  - Visual fixture passed in full and keyboard modes:
    `node scripts/side-chat-layout-visual-fixture.js --json`;
    `node scripts/side-chat-layout-visual-fixture.js --keyboard --json`.
    The 390px rects showed `sendWithinViewport=true`,
    `bottomWithinViewport=true`, compact 44px tool/send controls, and visible
    textarea.
  - Visual artifacts:
    `/Users/xuxin/.homeai-qa/artifacts/codex-mobile-side-chat-composer-full-20260609T134925Z.png`
    and
    `/Users/xuxin/.homeai-qa/artifacts/codex-mobile-side-chat-composer-keyboard-20260609T134925Z.png`.
  - Aggregate checks passed:
    `npm run check`, `npm run check:macos`, and `npm test` with 437 tests.
- Commit:
  - Product/source commit deployed to production:
    `3cc05a32e47f Refine side chat composer layout`.
- Production deployment and incident note:
  - An initial deploy attempt failed because the inherited
    `HOMEAI_MAC_SUDO_PASSWORD_FILE` pointed at missing `/Users/xuxin/Desktop/sudo`.
    The valid private password file was `/Users/xuxin/.homeai-qa/sudo-password`.
  - During the interrupted deployment/retry window, Home AI could not open the
    Codex plugin because `127.0.0.1:8787` had no listener and
    `launchctl print system/com.hermesmobile.plugin.codex-mobile` reported the
    service missing from the system domain.
  - Recovered by bootstrapping and kickstarting
    `/Library/LaunchDaemons/com.hermesmobile.plugin.codex-mobile.plist`, then
    rerunning the central Mac deploy script with explicit `--password-file`.
  - Successful deploy backup path:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260609T140140Z-plugin-codex-mobile-web-manual`.
  - Production `/api/public-config` reports
    `clientBuildId=0.1.11|codex-mobile-shell-v255`,
    `shellCacheName=codex-mobile-shell-v255`, build `e14f03015fcbd4a3`.
  - Production `/api/status?detail=1` reports `ready=true`,
    `transport=external-jsonl-tcp`, and `lastError=null`.
  - Home AI side smoke passed:
    `/api/hermes-plugins/codex-mobile/manifest` returned `id=codex-mobile`;
    `/api/hermes-plugins/codex-mobile/proxy/api/public-config` returned
    Codex Mobile v255.
  - Evidence ledger entries:
    `evidence-fb396a60-9a89-484c-9e88-5a8ebe5c97a2`,
    `evidence-b31f0370-e268-4094-8623-955d6268bd37`, and
    `evidence-0e2a40af-ed11-4765-ab6e-a449d44cd0c0`.

## 2026-06-09 Public PR #58 Keyboard Focus Sync

- Public PR:
  - Evaluated `pentiumxp/codex-mobile-web-public#58` from GitHub REST/git refs
    because local `gh` API auth was unavailable.
  - PR was open, non-draft, mergeable/clean, and its `Node checks` check-run
    was successful at commit `cf409214a5f1a0176d05fe8d51d985324efa21b6`.
  - The change fixes standalone mobile editable focus handling so iOS keyboard
    autoscroll does not leave the Composer visibly shifted upward, while Hermes
    embed mode still honors host-provided keyboard and scroll offsets.
- Public merge:
  - Merged in the clean public mirror
    `/Users/hermes-dev/HermesMobileDev/public-mirrors/codex-mobile-web-public`.
  - Added README Chinese release note for v253.
  - Pushed public `main` at merge commit
    `c80b70c66c706380ea0d89a14681c442711f855c`.
  - GitHub reported PR #58 closed and merged at that merge commit.
- Public validation:
  - Focused mobile/viewport checks passed with 25 tests:
    `node --test test/viewport-metrics.test.js test/mobile-viewport.test.js
    test/turn-scroll-controls.test.js test/composer-quota.test.js`.
  - `npm run check`, `npm run check:macos`, `git diff --check HEAD`, and
    `npm test` passed with 436 tests.
  - Public privacy/file scan found no tracked `.agent-context`, runtime state,
    local keys, uploads, or raw private material. Fixed-string hits were limited
    to expected README boundary text, documented placeholder examples, and
    public docs references.
  - Evidence ledger entry:
    `evidence-aedc7991-1433-4904-8094-82ac90d3a3d8`.
- Private reverse sync:
  - Merged public `main` back into private `main` after the public push.
  - Conflict resolution kept private shell/cache v254 because local private
    side-chat/mux commits were already ahead, while preserving PR #58 keyboard
    focus behavior and tests.
  - Private merge commit:
    `46010668916db2064119e83de66630a8ef2fbe88`.
- Private validation:
  - Focused mobile/viewport checks passed with 25 tests.
  - `npm run check`, `npm run check:macos`, `git diff --check --cached`, and
    the plugin platform contract checker passed.
  - One full `npm test` run hit a transient `test/protocol.test.js` temporary
    directory teardown `ENOTEMPTY`; rerunning `node --test
    test/protocol.test.js` passed with 10 tests, and a full `npm test` rerun
    passed with 437 tests.
  - Evidence ledger entry:
    `evidence-c9f0d073-ee76-41f5-9ae0-a067db5375b2`.

## 2026-06-10 Codex Mobile v259 Side Chat and Command Dock

- Product changes:
  - Side chat now scrolls to the bottom when opened or refreshed.
  - The side-chat clear action is available in the lower composer row.
  - Save-as-candidate and queue actions show a success notice with an
    action button that opens the related candidate/queue position.
  - Thread live Command/File/Tool output remains a single latest dock fixed
    above the composer, with the detail area clamped to two lines.
  - Live turn rendering no longer moves follow-up user messages below later
    assistant output after operational items are docked; visible non-operation
    items keep source order.
  - PWA shell cache advanced to `codex-mobile-shell-v259`.
- Visual validation:
  - Used the Home AI AI Ops lane and `npm run ios:pwa:debug` against the
    Codex dev server on port 18787.
  - Verified side chat bottom-open behavior, lower-row clear button,
    queue/save notice open action, single fixed two-line command dock, and
    user-message-before-assistant source order.
  - Visual artifact:
    `/Users/xuxin/.homeai-qa/artifacts/codex-mobile-side-chat-dock-v259-20260610T000312Z.png`.
- Checks passed:
  - `npm run check`.
  - `node --test test/thread-side-chat-service.test.js test/thread-side-chat-route.test.js`.
  - `node --test test/collab-agent-render.test.js test/mobile-viewport.test.js
    test/thread-goal-service.test.js test/thread-task-card-route.test.js
    test/turn-scroll-controls.test.js test/conversation-render.test.js`.
  - Home AI: `node tests/ios-pwa-live-debug-server.test.js
    tests/ios-pwa-visual-harness.test.js`.
  - `git diff --check`.
- Evidence ledger entries:
  - `evidence-744d30bd-cfa8-49bf-9106-5d5ae3a7a32b`.
  - `evidence-e499524e-6716-4119-a46a-a0a2ed3c7650`.
- Deployment boundary:
  - This entry records development validation only. Production was not
    restarted or redeployed during this change because the user requested
    avoiding repeated service restarts.
