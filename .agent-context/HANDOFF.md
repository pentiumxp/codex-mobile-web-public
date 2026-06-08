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
