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

## Preserved Recent Handoff Tail

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
