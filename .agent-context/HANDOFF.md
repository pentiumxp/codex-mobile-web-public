# HANDOFF

Last compacted: 2026-06-03T07:41:47.778Z

This active handoff was automatically compacted before a Codex Mobile continuation.
The previous full handoff was archived and should be opened only when old provenance is explicitly needed.

## Compaction Summary

- Workspace: `C:\Users\xuxin\Documents\codex-mobile-web`
- Original active handoff bytes: `194806`
- Archived full handoff: `C:\Users\xuxin\Documents\codex-mobile-web\.agent-context\archive\context-compaction-20260603_074147\HANDOFF.full-before-context-budget.md`
- Preserved recent active context chars: `15281`

## Startup Guidance

- Read `.agent-context/PROJECT_CONTEXT.md` first.
- Read this compact `.agent-context/HANDOFF.md` for current status.
- Do not load the archived full handoff unless the user asks for old provenance or the compact handoff is insufficient.
- Before changing latest-version, backup, deployment, or runtime-state facts, verify current repo/runtime state or the latest source-thread handoff. Archived old sections are provenance only.
- Keep future handoff updates concise: current state, changed files, validation, risks, and next steps.
- Do not store raw secrets, tokens, one-time approvals, hidden UI state, long logs, or bulky generated output.

## 2026-06-08 Mac Hermes Plugin SSE Reconnect Investigation v220

- User reported that the Mac Hermes plugin thread list showed `connected`,
  then `reconnecting`, then refreshed the list, while thread detail was mostly
  stable.
- Codex Mobile frontend hardening prepared locally:
  - `public/app.js` now keeps Hermes embed EventSource fallback thread-list
    refreshes silent and does not set the visible chip to `Reconnecting` while
    JSON API recovery is healthy.
  - `CLIENT_BUILD_ID` / `public/sw.js` advanced to
    `0.1.11|codex-mobile-shell-v220` / `codex-mobile-shell-v220`.
  - README release note and architecture/troubleshooting/module docs updated.
  - Static tests updated to assert silent fallback and v220 shell identity.
- Validation:
  - `node --check public\app.js; node --check public\sw.js`
  - `node --test test\app-update.test.js test\mobile-viewport.test.js
    test\hermes-plugin-route.test.js test\plugin-embed.test.js
    test\thread-goal-service.test.js test\thread-task-card-route.test.js`
    passed: 34/34.
  - `git diff --check` for edited Codex Mobile files passed with only existing
    CRLF/LF warnings.
- Production/root-cause evidence came from the Home AI host, not this repo:
  direct Mac Codex Mobile `/api/events` stayed healthy for 45 seconds and
  returned status plus keepalive, but the Hermes same-origin plugin proxy was
  buffering `text/event-stream` with full-body reads. That host-side issue was
  fixed and deployed from the `C:\Users\xuxin\Documents\Agent` workspace.
- Current state: Codex Mobile v220 changes are local in this workspace and have
  not been committed or pushed in this turn.

## 2026-06-08 Public PR #49 Merge And Private Sync v219

- User requested assessment of public PR #49 in
  `pentiumxp/codex-mobile-web-public`, public README Chinese release notes,
  validation/privacy scan, public push, then private sync/revalidation.
- Public PR assessment:
  - PR #49 `修复 Mermaid 预览渲染边界` was GitHub `MERGEABLE` / `CLEAN`;
    CI `Node checks` passed; no comments/reviews were present.
  - PR was still Draft because its body said it was waiting for phone/iPad
    real-device confirmation. Local evidence covered static layout and Mermaid
    normalization, not real-device browser screenshots. Per the explicit
    public release request, the PR was marked ready and merged.
  - Scope was public-safe frontend/test only: Mermaid subgraph title
    normalization, Mermaid canvas horizontal scroll bounds, shell v219
    assertions, and focused tests.
- Public result:
  - Merged PR #49. Merge commit:
    `d6f97258bbb60c391bfa522937fe2b4c07e3a0d8`.
  - Added public README Chinese release note and pushed public `main` commit
    `09b164657255300052f511cca40beefee1276d4f`
    `发布 Mermaid 渲染边界修复 v219`.
  - Public push did not include `.agent-context`, `AGENTS.md`, runtime state,
    local keys, uploads, local diagnostics, or machine-specific state.
- Public validation:
  - Focused syntax/tests passed before merge:
    `node --check public\app.js public\markdown-renderer.js public\sw.js`,
    Mermaid/markdown/conversation/mobile/update focused tests with 56 tests,
    and goal/task-card focused tests with 12 tests.
  - After README release note: `npm.cmd run check`, `npm.cmd run check:macos`,
    and full `npm.cmd test` passed with 385 tests.
  - `git diff --check` showed only expected Windows LF/CRLF README warning.
  - BOM scan produced no output; forbidden-path scan produced no output.
    Raw-secret scan found only environment variable name references in source,
    not raw key material.
- Private sync:
  - Private already had the v219 refresh-prompt/Public-PR-thread work and shell
    cache ids, so sync was selective instead of copying whole files.
  - Synced PR #49 Mermaid changes into private:
    `public/markdown-renderer.js`, `public/styles.css`,
    `test/mermaid-render.test.js`, plus README v219 PR #49 release note.
  - Did not copy public `.agent-context`, runtime state, local keys, uploads,
    diagnostics, or machine-specific state into private.
- Private validation:
  - Focused syntax and Mermaid/markdown/conversation/mobile/update/goal/task
    tests passed with 68 tests.
  - `npm.cmd run check`, `npm.cmd run check:macos`, and full `npm.cmd test`
    passed with 388 tests.
  - `git diff --check` showed only existing Windows LF/CRLF working-tree
    warnings.
  - BOM scan produced no output. Raw-secret scan found only environment
    variable name references. Path scan only matched private
    `.agent-context/HANDOFF.md`, which was intentionally updated for this
    local handoff and was not copied to public.

## 2026-06-08 Windows CLI Windowless Env Cleanup v220

- User clarified the frequent Windows console popups were happening without
  Codex Desktop running; current app-server processes should all come from
  Codex Mobile invoking the CLI.
- Runtime diagnosis:
  - The scheduled `Codex Mobile Web` task was running through the hidden VBS /
    hidden PowerShell chain, and direct Mobile mux/server child spawns already
    used `windowsHide: true`.
  - The process tree still showed Mobile-owned `codex.exe app-server` tool
    children launching old `codex-app-server-mux.exe app-server --listen
    stdio://` under `node_repl.exe`. That indicates Desktop bridge environment
    such as `CODEX_CLI_PATH` / `CODEX_MUX_*` had leaked into the Mobile CLI
    process, so CLI tool subprocesses could loop back through the old console
    shim even when Desktop was not open.
- Implemented:
  - `codex-app-server-mux.js` now starts the real Codex CLI child with a
    sanitized environment that preserves `CODEX_HOME` but removes
    `CODEX_CLI_PATH` and all `CODEX_MUX_*` variables.
  - `server.js` uses the same sanitized environment for managed child
    `codex app-server` launches.
  - `start-codex-mobile-web.ps1` clears Desktop bridge variables before
    starting the Node listener.
  - `start-codex-mobile-web-windowless.ps1` saves, clears, and restores Desktop
    bridge variables around standalone mux startup so Mobile-owned mux children
    do not inherit stale Desktop bridge state.
  - Existing Desktop guard work remains: `start-codex-desktop-shared.ps1`
    builds `codex-app-server-mux-win.exe` with `/target:winexe`, a hidden VBS
    wrapper exists, and `install-codex-mobile-web-startup.ps1` registers future
    scheduled tasks with `Hidden=true`.
  - The currently registered `Codex Mobile Web` scheduled task was updated
    in-place to `Hidden=True` without restarting it.
  - Docs/harness updated in `README.md`, `docs/ARCHITECTURE.md`,
    `docs/MODULES.md`, `docs/MULTI_ACCOUNT_CODEX_CLI.md`,
    `docs/TROUBLESHOOTING.md`, `test/desktop-profile-launcher.test.js`,
    `test/new-thread-route.test.js`, and `test/hermes-plugin-route.test.js`.
- Validation:
  - `node --check codex-app-server-mux.js; node --check server.js` passed.
  - PowerShell parser checks passed for the edited startup scripts.
  - Focused tests passed:
    `node --test test\desktop-profile-launcher.test.js
    test\codex-profile-ui.test.js test\new-thread-route.test.js`,
    `node --test test\protocol.test.js test\desktop-profile-launcher.test.js`,
    and `node --test test\app-update.test.js test\hermes-plugin-route.test.js`.
  - `powershell.exe -NoProfile -ExecutionPolicy Bypass -File
    .\start-codex-desktop-shared.ps1 -PrintOnly` passed and generated
    `codex-app-server-mux-win.exe`; PE subsystem check returned `2`
    (Windows GUI).
  - `npm.cmd run check` passed.
  - Full `npm.cmd test` passed with 387 tests.
  - Focused `git diff --check` passed with only expected Windows LF/CRLF
    warnings. BOM check over edited files produced no output.
- Runtime:
  - Listener/shared chain was not restarted in this turn. Existing running
    Mobile CLI/app-server/tool child processes still have their original
    environment; the env cleanup applies after the next shared-chain restart.
  - No `.codex` state, raw keys, upload content, or runtime logs were copied
    into docs or Git.

## 2026-06-08 Public PR Fixed Thread And Refresh Prompt v219

- User reported two follow-ups after public PR work:
  - Accepting the public-PR prompt should reuse a stable working thread instead
    of creating a new disposable thread every time.
  - The update/refresh prompt was appearing too often even though PR #46 was
    intended to fix repeated refresh prompts.
- Diagnosis:
  - Public PR #46 was directionally correct. It made `/api/public-config` read
    `buildId`, `clientBuildId`, and `shellCacheName` on each request and removed
    the old plain-`version` fallback comparison that could cause stale startup
    build loops.
  - The remaining issue was frontend policy: `checkPageRefreshAvailability()`
    still allowed asset-only `buildId` drift to show the visible refresh prompt
    or ask Hermes to refresh. Because `buildId` is derived from static file
    size/mtime, normal development or deployment-in-progress edits could keep
    changing it even when the real app shell identity had not advanced.
- Implemented:
  - Static shell advanced to
    `0.1.11|codex-mobile-shell-v219` / `codex-mobile-shell-v219`.
  - `public/app.js` now treats `assetsChanged && !serverBuildNeedsRefresh` as
    silent bookkeeping: update `state.serverAssetBuildId` and return. Only a
    newer comparable app-shell identity (`clientBuildId` / `shellCacheName`)
    can show the standalone page refresh prompt or request a Hermes host
    refresh.
  - Public PR prompt acceptance now targets the app workspace from
    `/api/public-config.workspacePath`, first reusing a visible same-workspace
    thread titled `Codex Mobile Public PR`. If no such thread exists, the new
    thread draft carries that fixed title.
  - `POST /api/threads/new-message` accepts optional `title`/`name`, persists it
    through the session-index title fallback, and best-effort calls the app-server
    title update path after thread creation.
  - README and focused docs were updated:
    `docs/ARCHITECTURE.md`, `docs/MODULES.md`, and `docs/TROUBLESHOOTING.md`.
- Validation:
  - `node --check public\app.js`, `public\sw.js`, and `server.js` passed.
  - Focused tests passed:
    `node --test test\app-update.test.js test\new-thread-route.test.js
    test\mobile-viewport.test.js test\thread-goal-service.test.js
    test\thread-task-card-route.test.js` with 39 tests.
  - `npm.cmd run check` passed.
  - Focused `git diff --check` passed with only expected Windows LF/CRLF
    warnings.
  - BOM check over edited source/docs/tests produced no output.
- Runtime:
  - Local `/api/public-config` currently reports
    `clientBuildId=0.1.11|codex-mobile-shell-v219`,
    `shellCacheName=codex-mobile-shell-v219`, and a new static `buildId`.
  - Existing open v218 clients may see one legitimate update prompt because the
    app-shell identity really changed to v219. After loading v219, asset-only
    `buildId` drift should be silent.
  - The Windows 8787 Node listener has not been restarted in this follow-up yet;
    the `/api/threads/new-message` server-side title support needs a listener
    restart before it is active in the running process.

## 2026-06-08 Public PR #48 Merge And Private Sync v218

- User requested assessment/merge of public PR #48
  `支持移动端 Mermaid 图预览并增强硬刷新`, then public README release notes,
  validation/privacy scan, public push, and private sync/revalidation.
- Public PR assessment:
  - GitHub reported PR #48 as mergeable/clean with CI `Node checks` success.
  - Local review found a frontend-only scope: Mermaid markdown rendering,
    mobile preview modal, hard-refresh/page-shell behavior, service-worker
    shell bump, vendored `public/vendor/mermaid.min.js`, and focused tests.
  - Mermaid source is stored escaped in markdown output; runtime rendering uses
    Mermaid `securityLevel: "strict"` and rejects Mermaid error SVG artifacts.
- Public result:
  - Merged PR #48 through GitHub. Merge commit:
    `8c0c2ae3da79d9fb6783211abc8d3c259add1152`.
  - Added public README Chinese release note for v218 and pushed public
    `origin/main` commit `ae65529ad9740845516c59dbad43e69da920a7fa`
    `发布 Mermaid 预览与硬刷新说明 v218`.
  - Public `origin/main` now resolves to `ae65529`; PR #48 state is `MERGED`.
  - Public sync/push did not include `.agent-context`, `AGENTS.md`, runtime
    state, local keys, uploads, `node_modules`, or machine-specific diagnostics.
- Public validation before/after push:
  - Focused PR tests passed.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - Full `npm.cmd test` passed with 384 tests.
  - `git diff --check` / staged check showed only expected Windows LF/CRLF
    warnings for README.
  - BOM scan produced no output.
  - Public tracked-path scan found no forbidden release paths.
  - Raw-secret scan produced only expected documented runtime path/field-name
    references, not raw key material.
- Private sync:
  - Compared all PR #48 target files against public v217; private current
    files matched the public v217 baseline before syncing, so replacing them
    with public v218 did not discard private-only edits.
  - Synced PR #48 product/test files into private:
    `public/app.js`, `public/index.html`, `public/markdown-renderer.js`,
    `public/plugin-embed.js`, `public/styles.css`, `public/sw.js`,
    `public/vendor/mermaid.min.js`, focused test updates, and new
    `test/mermaid-render.test.js`.
  - Added the same v218 README release note to private.
  - Static shell advanced to
    `0.1.11|codex-mobile-shell-v218` / `codex-mobile-shell-v218`.
  - Private working tree still contains earlier uncommitted v217/multi-account
    changes; this turn did not commit or push private.
- Private validation after sync:
  - `node --check public\app.js public\markdown-renderer.js
    public\plugin-embed.js public\sw.js` passed.
  - Focused Mermaid/markdown/conversation/update/mobile/goal/task-card tests
    passed with 67 tests.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - Full `npm.cmd test` passed with 384 tests.
  - `git diff --check` showed only expected Windows LF/CRLF warnings.
  - BOM and forbidden-path scans produced no output.
  - Private raw-secret scan produced only existing documented local path
    examples / git metadata path hits, not raw key material.

## 2026-06-08 Public Push v217

- User requested `push public` after the continuation-goal migration work.
- Public repo path:
  `C:\Users\xuxin\Documents\codex-mobile-web-public`.
- Published to GitHub:
  - Repository: `pentiumxp/codex-mobile-web-public`
  - Branch: `main`
  - Commit: `4e54b68f3c0c886f912ba3ee4c66daee2ec81114`
  - Subject: `发布目标迁移与多账号稳定性修复 v217`
- Public sync scope:
  - Synced public-safe product source/docs/tests from the private working tree.
  - Added the Mac plugin deploy harness and its test to public because
    `docs/MODULES.md` now treats it as a stable product boundary.
  - Did not copy `.agent-context`, `AGENTS.md`, runtime state, uploads,
    `node_modules`, raw keys, local secret files, or machine-specific
    diagnostics.
- Public validation before push:
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - Focused goal/profile/continuation/deploy-harness tests passed.
  - Full `npm.cmd test` passed with 373 tests.
  - Staged path scan found no forbidden release paths.
  - `git diff --cached --check` passed.
  - BOM check produced no BOM findings.
  - Staged raw-secret scan produced no findings.
  - Extra staged machine-path/address scan produced no findings.
- Post-push verification:
  - `origin/main` resolves to `4e54b68f3c0c886f912ba3ee4c66daee2ec81114`.
  - Public tree path scan found no `.agent-context`, `AGENTS.md`, uploads,
    logs, data, `node_modules`, `.codex`, or `.codex-mobile-web` paths.

## 2026-06-08 Continuation Goal Migration v217 Server

- User approved the continuation-goal migration plan: when a source thread is
  compacted/continued into a new thread, unfinished CLI goals should move with
  the task instead of staying only on the old source thread.
- Implemented:
  - `adapters/thread-goal-service.js` owns pure continuation-goal migration
    planning. Only `active`, `blocked`, and legacy `paused` source statuses are
    migratable. Completed, budget-limited, usage-limited, missing, or unknown
    statuses are skipped.
  - `server.js` now runs a best-effort migration after the new continuation
    thread has been created and its bootstrap turn has started. The target
    receives the same objective and remaining token budget when positive;
    spent token/time counters stay on the source thread. `active` source goals
    are copied as active and the source is then best-effort frozen to
    `blocked`; `blocked`/`paused` source goals are copied as blocked.
  - Goal writes still go only through app-server `thread/goal/set` /
    `thread/goal/get` routes. Mobile Web still does not directly write
    `goals_1.sqlite`.
  - Continuation job/result now exposes a bounded `sourceGoalMigration`
    diagnostic. Continuation lineage stores only boolean/error fields and must
    not store the goal objective text.
  - README and focused docs were updated:
    `docs/ARCHITECTURE.md`, `docs/CONTEXT_STRATEGY.md`,
    `docs/MODULES.md`, `docs/COMPLEX_FEATURE_PATHS.md`, and
    `docs/TROUBLESHOOTING.md`.
- Existing Home AI continuation backfill:
  - The old source thread was created before this code path existed, so it was
    manually backfilled through Mobile Web/app-server HTTP goal routes rather
    than direct sqlite writes.
  - Source `019e9566-c222-7560-af45-2b3665862188` had a blocked goal; target
    `019ea58a-2615-7cd2-a69c-66fbc78baa0b` now has the same goal in blocked
    state with fresh counters. The old source thread was then hidden through
    the Mobile archive API/local archive index. No goal objective text was
    recorded here.
- Validation:
  - `node --check server.js adapters\thread-goal-service.js public\app.js
    public\sw.js` passed.
  - Focused tests passed:
    `node --test test\thread-goal-service.test.js
    test\continuation-lineage.test.js`, then with
    `test\continuation-handoff-compaction-service.test.js` and
    `test\new-thread-route.test.js`.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - Full `npm.cmd test` passed with 373 tests.
  - `git diff --check` passed with only expected Windows LF/CRLF warnings.
  - BOM check passed for edited source/docs/tests.
- Runtime:
  - Restarted only the Windows 8787 Node listener, not the shared mux/app-server.
  - New listener PID was `39180`; `/api/public-config` reports active profile
    `previous`, active Codex home under `.codex-homes\previous`, and static
    shell still `0.1.11|codex-mobile-shell-v216` /
    `codex-mobile-shell-v216` because this is a server-only behavior change.

## 2026-06-08 Public PR #46/#47 Merge And Private Sync v216

- User requested public PR review/merge for
  `pentiumxp/codex-mobile-web-public` PR #46 and #47, then private sync.
- Public PR assessment:
  - #46 `修复刷新提示反复出现` was mergeable and CI passed.
  - #47 `调整 Fast 模式开关视觉` was mergeable but its original PR CI failed
    because a tablet layout test still expected the old 18px Fast dot column.
  - Local combined integration of #46 + #47 fixed the context for #47, then the
    remaining tablet test assertion was updated to the new 28px Fast bolt
    column. The PRs were therefore merged through public `main` with follow-up
    validation.
- Public result:
  - Pushed public `origin/main` commit `2c647b0`
    `发布刷新提示与 Fast 开关修复 v214`.
  - GitHub reports PR #46 and PR #47 as `MERGED`.
  - Public README Chinese release notes were updated and explicitly state that
    `.agent-context`, runtime state, local keys, uploads, and machine-specific
    diagnostics were not copied.
  - Public validation passed: focused app-update/mobile/composer/build tests,
    `npm.cmd run check`, `npm.cmd run check:macos`, full `npm.cmd test` with
    365 tests, `git diff --check` with only LF/CRLF warnings, no BOM output,
    and no raw-secret pattern output.
- Private sync:
  - Synced the same behavior into the private working tree without reverting
    existing v214/v215 goal/profile changes.
  - Static shell advanced to
    `0.1.11|codex-mobile-shell-v216` / `codex-mobile-shell-v216`.
  - `server.js` now computes `/api/public-config` `buildId`,
    `clientBuildId`, and `shellCacheName` on each request through
    `currentPublicBuildConfig()`, and the frontend build comparison no longer
    falls back to plain `config.version`.
  - Composer Fast control changed from the tiny red/green dot to a 28px
    lightning icon button with `Fast mode on/off` labels.
  - README, `docs/ARCHITECTURE.md`, and `docs/TROUBLESHOOTING.md` were updated
    for v216 build-refresh behavior and Fast control notes.
- Private validation:
  - `node --check server.js public\app.js public\sw.js
    public\build-refresh-policy.js` passed.
  - Focused app-update/mobile/composer/build/tablet/goal/task-card tests
    passed.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - Full `npm.cmd test` passed with 372 tests.
  - `git diff --check` passed with only expected Windows LF/CRLF warnings.
  - BOM and raw-secret pattern scans produced no findings.
- Runtime:
  - Windows 8787 listener was not restarted in this turn.
  - Open clients need a listener restart plus manual refresh/close-reopen to
    load the v216 static shell.

## 2026-06-08 Goal Dialog Actions v214

- User clarified that `/g` should reopen the existing-goal dialog when a thread
  already has an unfinished goal, with Continue, Pause, Cancel goal, and Modify
  actions. User also clarified that Pause should map to the app-server
  `blocked` status.
- Implemented:
  - Static shell advanced to
    `0.1.11|codex-mobile-shell-v214` / `codex-mobile-shell-v214`.
  - `server.js` added `POST /api/threads/:id/goal/actions` as a thin wrapper
    around official app-server goal RPCs. Cancel calls `thread/goal/clear`;
    Pause calls `thread/goal/set` with `status: "blocked"` and verifies with
    `thread/goal/get` when needed; Continue leaves active goals unchanged and
    clears/re-sets blocked goals so they become active again. Mobile Web still
    does not write `goals_1.sqlite` directly.
  - `public/app.js`, `public/index.html`, and `public/styles.css` now show a
    status/action area in the `/g` dialog when the selected thread has an
    unfinished goal. Save modifies objective/token budget through the existing
    `POST /api/threads/:id/goal` route.
  - README and docs now describe the v214 behavior and Pause=>blocked rule.
- Validation:
  - `node --check server.js public\app.js public\sw.js` passed.
  - Focused goal/profile/task-card tests passed.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `npm.cmd test` passed with 372 tests.
  - `git diff --check` passed with only expected Windows LF/CRLF working-tree
    warnings.
  - BOM check passed for edited source/docs/tests.
- Runtime:
  - Windows 8787 listener was restarted by stopping only the old Node listener
    PID `20016` and starting the `Codex Mobile Web` scheduled task. The shared
    mux/app-server process was not killed.
  - Post-restart `/api/public-config` reports
    `clientBuildId=0.1.11|codex-mobile-shell-v214`,
    `shellCacheName=codex-mobile-shell-v214`, and active profile `previous`.
  - Authenticated smoke confirmed Home AI still has `goalStatus=active` and
    objective `继续目标`.
  - A non-destructive `POST /api/threads/:id/goal/actions` smoke with
    `action=continue` on the already-active Home AI goal returned
    `ok=true`, `changed=false`, `goalStatus=active`.
  - Open clients need to accept the refresh prompt or close/reopen the PWA or
    Hermes plugin frame to load the v214 shell.

## 2026-06-08 Goal Budget Token Label v215

- User reported that the token count shown in the goal dialog looked far from
  the real usage data.
- Diagnosis:
  - The goal dialog displays `goal.tokensUsed` / `goal.timeUsedSeconds`, which
    come from the app-server-owned goal object and the
    `goals_1.sqlite.thread_goals.tokens_used` fallback column.
  - Home AI Mobile API list/detail and the sqlite fallback all reported the
    same goal token value, so the number was not a frontend computation bug.
  - Home AI rollout comparison over the current goal window showed raw rollout
    `totalTokens` was much larger because it includes cached input. After
    removing cached input, the token count was close to the app-server
    `tokens_used` value. Treat this as a goal budget counter, not raw rollout
    total token usage or context-window size.
- Implemented:
  - Static shell advanced to
    `0.1.11|codex-mobile-shell-v215` / `codex-mobile-shell-v215`.
  - Goal token text now says `budget tokens` in both budgeted and unbudgeted
    goal progress labels.
  - README, architecture docs, and troubleshooting docs now document the goal
    token basis and the reason it differs from raw rollout `totalTokens`.
- Validation:
  - Focused goal/mobile/task-card tests passed.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `npm.cmd test` passed with 372 tests.
  - `git diff --check` passed with only expected Windows LF/CRLF working-tree
    warnings.
  - BOM check passed for edited source/docs/tests.
- Runtime:
  - Windows 8787 listener was restarted by stopping only the old Node listener
    PID `23128` and starting the `Codex Mobile Web` scheduled task. The shared
    mux/app-server process was not killed.
  - Post-restart `/api/public-config` reports
    `clientBuildId=0.1.11|codex-mobile-shell-v215`,
    `shellCacheName=codex-mobile-shell-v215`, and active profile `previous`.
  - Authenticated smoke confirmed Home AI still has `goalStatus=active`; the
    goal budget token counter continued updating from app-server state.
  - Open clients need to accept the refresh prompt or close/reopen the PWA or
    Hermes plugin frame to load the v215 shell.

## 2026-06-07 Mac Plugin Deploy Harness And v213 Production Deploy

- User required Mac production deployment to go through a harness instead of
  one-off SSH attempts.
- Implemented:
  - Added `scripts/deploy-macos-plugin.ps1`.
  - Added `test/macos-plugin-deploy-harness.test.js`.
  - Documented the harness in `docs/TROUBLESHOOTING.md` and `docs/MODULES.md`.
- Harness contract:
  - Deploys only a clean public git archive.
  - Rejects private/runtime/secret-like archive paths.
  - Runs staging `npm run check` and `npm run check:macos` before production
    backup or sync.
  - Preserves target `.agent-context`, `node_modules`, `logs`, `data`,
    `uploads`, `.git`, and `AGENTS.md` during sync.
  - Runs target checks and focused tests before LaunchDaemon restart.
  - Reads sudo password and the Mobile access key without printing key
    material.
- Deployment notes:
  - First harness run stopped before restart at target-check time because
    sudo's timestamp was not reliable across the whole remote script. The
    target had been synced but the LaunchDaemon was not restarted.
  - The harness was fixed to route all privileged remote actions through a
    bounded `run_sudo` wrapper, then rerun from the same public commit.
  - Mac production deployed public commit `043576a` to the active plugin target.
  - Remote backup from the successful run:
    `/tmp/codex-mobile-web-deploy-043576a-20260607_184159.backup.tar.gz`.
  - Remote target checks passed before restart: `npm run check`,
    `npm run check:macos`, and 31 focused thread-detail/usage/scroll tests.
  - Restarted `system/com.hermesmobile.plugin.codex-mobile`.
  - Post-deploy smoke confirmed Mac 8787 reports
    `clientBuildId=0.1.11|codex-mobile-shell-v213`,
    `shellCacheName=codex-mobile-shell-v213`, `platform=darwin`, active
    profile id `previous`, LaunchDaemon PID `11701`, and listener
    `127.0.0.1:8787`.
- Local validation:
  - PowerShell script parse passed.
  - `node --test test\macos-plugin-deploy-harness.test.js` passed.
  - `npm.cmd test` passed with 371 tests.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only existing LF/CRLF warnings.
  - Focused scan of source/docs/tests/README/package files found no local sudo
    password file path, Mac SSH key path, or machine SSH alias.

## 2026-06-07 Thread Detail State-Relevant Intermediate Items v208

- User clarified that process/intermediate detail retention cannot be a simple
  recent-turn window. Mobile Web must preserve all compact intermediate cards
  for the current active turn, and also for the previous ended turn so users can
  scroll back to inspect the just-finished work. If no live turn exists, the
  latest ended turn keeps the intermediate cards.
- Implemented:
  - `server.js` now computes state-relevant turn indexes before compacting a
    thread detail response.
  - The selected live/latest-ended turn, plus the previous ended turn when a
    live turn exists, keeps all compact command/tool/file/search/reasoning
    intermediate cards. Command output is still bounded by the existing per-turn
    output budget.
  - Older turns outside that state-relevant set are receipt-only: user question
    plus assistant receipt. The older-turn pagination fallback is also
    receipt-only.
  - README, architecture docs, and troubleshooting docs now describe the
    state-relevant retention rule instead of the prior recent-window rule.
- Validation:
  - `node --check server.js` passed.
  - Focused tests passed:
    `node --test test/thread-item-timestamp-enrichment.test.js
    test/thread-visibility.test.js test/conversation-render.test.js`.
  - `npm run check` passed.
  - Full `npm test` passed with 358 tests.
  - `npm run check:macos` passed.
  - `git diff --check` passed.
  - After public publish, the 18 changed public product files were compared
    back to private with SHA256 and matched. Private `npm run check`,
    `npm test`, and `npm run check:macos` were rerun and passed.
- Public:
  - `codex-mobile-web-public` was synced from private product files only;
    `.agent-context`, runtime state, uploads, access keys, local secrets, and
    machine-specific diagnostics were not copied.
  - Open public PR check returned no open PRs before publish.
  - Public validation passed: `npm run check`, `npm test` with 358 tests,
    `npm run check:macos`, `git diff --check`, staged privacy scans, and BOM
    scan.
  - Pushed public `main` commit `0f5b1de`:
    `发布前台恢复、插件导航与线程详情裁剪修复 v208`.
- Runtime:
  - Local Windows 8787 listener was restarted after private commit `61ba4b6`.
  - Local API smoke with the local access key file, without printing content or
    key material, opened three visible details. Each returned a 10-turn compact
    window and only one or two state-relevant turns with operation/reasoning
    items, matching the v208 retention rule.
- Status:
  - Private product code is committed in `61ba4b6`.
  - Public is pushed at `0f5b1de`.
  - Mac production was not deployed in this update.

## 2026-06-07 Receipt-Only Older Turns Tightening

- User reported that Windows still showed intermediate content after v208 when
  scrolling far upward.
- Runtime check:
  - Windows 8787 was deployed from
    `C:\Users\xuxin\Documents\codex-mobile-web\server.js`.
  - The API already limited command/reasoning/operation cards to one or two
    state-relevant turns, but older receipt-only turns still contained many
    `agentMessage` items. Example counts before the fix included older turns
    with `agentMessage=25` or `agentMessage=54`.
- Root cause:
  - The receipt-only filter kept every user and assistant message. In Codex
    rollouts, many process/progress updates are represented as `agentMessage`,
    so older turns still looked like they contained intermediate content even
    after command/tool/reasoning cards were removed.
- Implemented:
  - Receipt-only turns now retain all user question items plus only the last
    assistant/plan receipt item.
  - Current live turn and the previous ended turn still keep their full compact
    intermediate cards.
  - README, architecture docs, and troubleshooting docs were tightened to
    describe the final-receipt-only rule.
- Validation:
  - Focused tests passed:
    `node --test test/thread-item-timestamp-enrichment.test.js
    test/thread-visibility.test.js test/conversation-render.test.js`.
  - `npm run check` passed.
  - Full `npm test` passed with 358 tests.
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Runtime:
  - Restarted Windows 8787 listener after the fix.
  - Post-restart API smoke opened the first five visible threads without
    printing key material or message content. Older non-operation turns now
    report one assistant/plan receipt each; state-relevant turns still retain
    process items.
- Status:
  - Public has not been pushed with this tightening yet.
  - Existing browser pages that already loaded the old expanded detail may need
    a manual refresh or thread re-open to drop in-memory old items.

## 2026-06-07 Large Rollout Dynamic Detail Projection v209

- User asked to improve large-rollout thread detail loading and clarified that
  the cache must be dynamic: turns keep increasing and any intermediate output
  should update the server-side projection in real time, not only after
  `turn/completed`.
- Implemented first stage:
  - Added `adapters/thread-detail-projection-service.js`.
  - The service maintains a Mobile thread-detail projection index seeded by
    compact detail reads and persisted under the runtime projection cache
    directory.
  - Projection signatures include rollout size/mtime, summary updated/status,
    max turn window, and projection policy version. Signature changes miss and
    fall back to the existing full `thread/read` path.
  - `broadcast()` now updates the projection service from raw app-server
    notifications before browser SSE compaction. This includes
    `item/started`, `item/completed`, agent message deltas, reasoning deltas,
    command output deltas, and file output deltas.
  - Existing-thread message send also applies a local `turn/started` projection
    update when the mutation response contains a new turn id, reducing the race
    before the app-server notification arrives.
  - `/api/threads/:id` now checks the projection first. Hits return
    `mobileReadMode=projection-dynamic` or `projection-cache`; misses still use
    the existing full `thread/read includeTurns:true`, then seed the projection.
  - The final response still runs through the existing `compactThreadReadResult`
    state-relevant retention rules so there is not a second copy of the
    receipt/operation pruning logic.
  - Updated README, `docs/ARCHITECTURE.md`, `docs/MODULES.md`, and
    `docs/TROUBLESHOOTING.md`.
- Validation:
  - Focused tests passed:
    `node --test test/thread-detail-projection-service.test.js
    test/thread-item-timestamp-enrichment.test.js test/thread-visibility.test.js`.
  - `npm run check` passed.
  - Full `npm test` passed with 362 tests.
  - `npm run check:macos` passed.
  - `git diff --check` passed.
  - CodeGraph status was healthy after edits: 91 indexed files.
- Runtime:
  - Restarted Windows 8787 listener.
  - Local API smoke with the local access key file, without printing key or
    message content, opened a 150.5MB rollout thread three times. Results:
    `projection-cache`, 10 turns, 163 omitted turns, about `692ms`, `373ms`,
    and `376ms`. This compares to the previous sampled 150.2MB thread detail
    time of about `2138ms` on full `thread/read`.
- Status:
  - Private implementation is ready to commit.
  - Public has not been synced or pushed for v209.

## 2026-06-07 Thread Detail Intermediate Items Regression v207

- User reported that after v206, opening any thread no longer showed
  intermediate command/tool/file/search information.
- Root cause:
  - v206 changed `/api/threads/:id` to prefer bounded app-server
    `thread/turns/list`.
  - That endpoint is fast, but it does not reliably provide the full operation
    item stream Mobile detail expects. `thread/read includeTurns:true` is still
    the source that preserves those intermediate items.
- Implemented:
  - Restored `/api/threads/:id` to prefer full `thread/read` first, then compact
    to the latest `CODEX_MOBILE_THREAD_TURNS` turns.
  - Kept bounded `thread/turns/list` only as fallback after `thread/read` fails
    or times out.
  - Kept the v206 foreground-resume optimization: stable loaded current threads
    are not detail-refreshed when returning from another app unless running,
    loading/error, or the list row shows a newer timestamp/status.
  - Added README v207 server-only release note and restored architecture /
    troubleshooting guidance to treat `turns-list` as fallback.
  - Updated `test/thread-visibility.test.js` to assert `thread/read` precedes
    `turnsListThreadReadResult()` in the detail route.
- Validation:
  - `node --check server.js public/app.js public/sw.js` passed.
  - Focused tests passed:
    `node --test test/thread-visibility.test.js test/thread-task-card-route.test.js
    test/mobile-viewport.test.js test/conversation-render.test.js
    test/thread-item-timestamp-enrichment.test.js`.
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - Full `npm test` passed with 356 tests.
  - `git diff --check` passed.
  - UTF-8 BOM check passed for edited source/docs/tests.
  - Local API smoke with the local access key file, without printing content or
    the key, opened the first three visible threads. All reported
    `mobileReadMode=thread-read`; two operation-heavy threads showed
    operation-like items in the compact 10-turn detail window.
- Runtime:
  - Restarted local Windows 8787 listener. `/api/public-config` still reports
    `clientBuildId=0.1.11|codex-mobile-shell-v206` /
    `shellCacheName=codex-mobile-shell-v206`; this is expected because v207 is
    server-only and does not change the static shell.

## 2026-06-07 Foreground Resume And Thread Detail Read v206

- User reported that returning from another app repeatedly reloads the open
  thread, and that thread detail still feels slow even after Mobile Web was
  changed to show only the latest 10 turns.
- Root cause:
  - `resumeMobileSession()` refreshed the current thread detail on every mobile
    foreground/focus recovery when a current thread was loaded.
  - `/api/threads/:id` still preferred full app-server
    `thread/read includeTurns:true`, then compacted the response to
    `CODEX_MOBILE_THREAD_TURNS=10`; the 10-turn window limited browser payload,
    but did not avoid the full app-server read cost.
- Implemented:
  - Bumped shell to `0.1.11|codex-mobile-shell-v206` /
    `codex-mobile-shell-v206`.
  - Added `currentThreadNeedsForegroundRefresh()` and
    `currentThreadListRowChanged()` in `public/app.js`.
  - Foreground recovery now keeps a stable loaded current thread rendered and
    skips detail refresh unless the thread is running/loading/error or the
    refreshed list row shows a newer timestamp/status for that current thread.
  - `/api/threads/:id` now prefers bounded `thread/turns/list` with
    `CODEX_MOBILE_THREAD_TURNS` as the normal detail window. Full
    `thread/read` remains only as `thread-read-fallback` when turns-list fails.
  - Updated README v206 note, architecture docs, troubleshooting guidance, and
    focused static tests.
- Validation:
  - `node --check server.js public/app.js public/sw.js` passed.
  - Focused tests passed:
    `node --test test/mobile-viewport.test.js test/mobile-polling.test.js
    test/thread-visibility.test.js test/thread-task-card-route.test.js
    test/thread-goal-service.test.js`.
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - Full `npm test` passed with 356 tests.
  - `git diff --check` passed.
  - UTF-8 BOM check passed for edited source/docs/tests.
- Runtime:
  - Local Windows 8787 listener was restarted after stopping the stale detached
    Node process that still served v204.
  - `http://127.0.0.1:8787/api/public-config` now reports
    `clientBuildId=0.1.11|codex-mobile-shell-v206`,
    `shellCacheName=codex-mobile-shell-v206`, `platform=win32`.
- Status:
  - Changes are local and uncommitted at this point.
  - Mac production has not been deployed with v206 in this update.

## 2026-06-07 Hermes Plugin Parent-Origin Back Navigation v205

- User reported that Mac-hosted Hermes plugin no longer reconnects frequently,
  but right-swipe from a Codex thread detail still exits to the Hermes host
  instead of returning to the Codex thread list. Windows-hosted Hermes on the
  same phone behaved correctly.
- Root cause confirmed with Appium on Mac iOS Simulator:
  - The Codex iframe was opened under
    `https://wardrobe-xuxin.synology.me:8555/api/hermes-plugins/codex-mobile/proxy/`.
  - Before the fix, `publishPluginNavigationState({ force: true })` sent
    `codex-mobile.plugin.navigation` to stale targetOrigin
    `https://hermes-xuxin.synology.me:8445`, inherited from the launch-session
    `hermes_origin`.
  - Browser `postMessage` silently dropped those messages because the actual
    parent origin was `https://wardrobe-xuxin.synology.me:8555`.
  - Hermes host therefore kept `record.canGoBack=false`, `navigationLastAt=0`,
    and `backSwipeTarget()` fell through to the outer plugin return.
- Implemented:
  - Added `currentPluginParentWindowOrigin()` in `public/app.js`.
  - `normalizePluginParentOrigin()` now prefers live
    `window.parent.location.origin` when same-origin proxying makes it
    readable; it falls back to launch-session `hermes_origin` or referrer only
    when the live parent origin is unavailable.
  - `publishPluginNavigationState()` and `postPluginBackResult()` re-normalize
    `targetOrigin` before posting and update `state.pluginParentOrigin` when a
    concrete live origin is available.
  - Bumped the frontend shell to `0.1.11|codex-mobile-shell-v205` /
    `codex-mobile-shell-v205`.
  - Added static regression coverage in `test/hermes-plugin-route.test.js` and
    updated version assertions in shell/version tests.
  - Added README Chinese v205 release note and troubleshooting notes for stale
    iframe `targetOrigin` when host domains change.
- Mac production deployment:
  - Copied `public/app.js`, `public/sw.js`, `public/index.html`, and
    `public/build-refresh-policy.js` to
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web/public`.
  - Backup directory:
    `/Users/xuxin/.codex-mobile-web/mac-codex-plugin-backup-before-parent-origin-v205-20260607_105839`.
  - Restarted `system/com.hermesmobile.plugin.codex-mobile` with
    `launchctl kickstart -k`.
  - After restart, `http://127.0.0.1:8787/api/public-config` reported
    `clientBuildId=0.1.11|codex-mobile-shell-v205`,
    `shellCacheName=codex-mobile-shell-v205`, `platform=darwin`.
- Appium verification on Mac production:
  - iframe helper `currentPluginParentWindowOrigin()` returned
    `https://wardrobe-xuxin.synology.me:8555`.
  - After opening a thread detail, the Hermes host received
    `codex-mobile.plugin.navigation` from origin
    `https://wardrobe-xuxin.synology.me:8555` with `canGoBack=true` and
    `route.kind=thread`.
  - Host state became `canGoBack=true`, `backSwipeTarget()=codex-plugin`.
  - `sendCodexPluginBackOrReturn()` returned the iframe to the Codex primary
    thread list without leaving `viewMode=codex`.
  - A real iOS W3C edge-swipe gesture from x=2 to x=280 also returned to the
    Codex primary thread list; it did not exit to Hermes.
- Local validation:
  - Focused tests passed:
    `node --test test/build-refresh-policy.test.js test/app-update.test.js
    test/hermes-plugin-route.test.js test/plugin-embed.test.js
    test/mobile-viewport.test.js test/thread-goal-service.test.js
    test/thread-task-card-route.test.js`.
  - `npm run check` passed.
  - Full `npm test` passed with 356 tests.

## 2026-06-07 Thread List Residue Filter

- User reported completed subagent/residue threads staying in the Mobile thread
  list as UUID-only rows that could not be opened, including old pre-April-30
  entries.
- Root cause: rollout-session fallback rows recovered cwd/time/status but did
  not carry `session_meta.payload.agent_nickname` / `agent_role`, and final
  list merging only skipped archived ids. Completed fallback summaries with no
  real display text could therefore re-enter the list as UUID-only rows even
  though detail-side visibility rejected them.
- Implemented:
  - `server.js` rollout fallback now carries session-meta agent metadata.
  - thread-list summary merging preserves archive/agent classification fields
    from duplicate fallback rows.
  - final merged/hydrated thread list re-applies archive/subagent filtering and
    removes non-live Mobile fallback summaries that still have only a UUID
    display after session-index hydration.
  - docs updated in `docs/ARCHITECTURE.md`, `docs/TROUBLESHOOTING.md`, and
    `docs/MODULES.md`.
- Validation:
  - `node --check server.js` passed.
  - Focused tests passed:
    `node --test test\thread-visibility.test.js test\thread-archive.test.js
    test\mobile-archive-index-service.test.js test\mobile-viewport.test.js`.
  - `npm.cmd run check` passed.
  - `npm.cmd test` passed with 352 tests.
  - `git diff --check` passed with only CRLF working-tree warnings.
  - UTF-8 BOM checks for edited files showed no BOM.
- Runtime:
  - Restarted Windows listener by stopping PID `115332` and starting scheduled
    task `Codex Mobile Web`.
  - Current Windows listener PID is `86748`.
  - `/api/public-config` reports
    `clientBuildId=0.1.11|codex-mobile-shell-v201` and
    `shellCacheName=codex-mobile-shell-v201` because this was server-only.
  - Authenticated `/api/threads?limit=80&archived=false` returned
    `bareNonLiveFallbackResidues=0` and `agentMarkedRows=0`.
  - Authenticated `/api/threads?limit=200&archived=false` returned 18 visible
    rows, `bareNonLiveFallbackResidues=0`, and `uuidTitleOrPreviewRows=0`.
- Public release:
  - Private commit `1b0f4cf` (`修复线程列表 subagent 残留过滤 v202`) was
    created before public sync.
  - `C:\Users\xuxin\Documents\codex-mobile-web-public` was synced from the
    tracked public-safe product files only. `.agent-context`, runtime state,
    uploads, local keys, tokens, logs, and machine-specific diagnostics were not
    copied.
  - Open PR check for `pentiumxp/codex-mobile-web-public` returned no open PRs.
  - Public README now includes Chinese v202 and v201 release notes.
  - Public validation before push:
    `npm.cmd test` passed with 352 tests, `npm.cmd run check` passed,
    `npm.cmd run check:macos` passed, staged `git diff --check` passed, UTF-8
    BOM checks showed no BOM, and staged privacy scans found no sensitive file
    paths, raw keys, local absolute paths, private host names, runtime state, or
    upload content.
  - Public commit `3564f02` (`发布目标长度与线程残留过滤修复 v202`) was pushed to
    `origin/main` on 2026-06-07; remote `refs/heads/main` resolved to
    `3564f027a1d249204d3f47bd492e44f78f310968`.

## 2026-06-06 Longer `/g` Goal Objective Limit v201

- User reported that pasting a longer objective into the `/g` goal dialog was
  truncated.
- Root cause: the browser textarea had `maxlength="1200"`, and the Mobile Web
  `thread/goal/set` proxy also normalized objective text down to 1200 chars.
  The `goals_1.sqlite` fallback public display was even shorter at 500 chars.
- Implemented:
  - `public/index.html` goal objective textarea `maxlength` increased to 4000.
  - `server.js` now uses `THREAD_GOAL_OBJECTIVE_MAX_CHARS = 4000` when
    normalizing objective text before forwarding app-server `thread/goal/set`.
  - `adapters/thread-goal-service.js` public fallback objective display cap
    increased to 4000 so a long accepted goal does not shrink after refresh.
  - Static shell advanced to `0.1.11|codex-mobile-shell-v201` /
    `codex-mobile-shell-v201`.
  - README and `docs/TROUBLESHOOTING.md` document the aligned 4000-char limit.
- Validation:
  - `node --check server.js; node --check public\app.js; node --check
    public\sw.js` passed.
  - Focused tests passed:
    `node --test test\thread-goal-service.test.js test\mobile-viewport.test.js
    test\thread-task-card-route.test.js`.
  - `npm.cmd test` passed with 349 tests.
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only CRLF working-tree warnings.
  - UTF-8 BOM checks for edited files showed no BOM.
- Runtime:
  - Restarted Windows listener by stopping PID `142372` and starting scheduled
    task `Codex Mobile Web`.
  - Current Windows listener PID is `115332`.
  - `/api/public-config` reports
    `clientBuildId=0.1.11|codex-mobile-shell-v201` and
    `shellCacheName=codex-mobile-shell-v201`.
  - Served `/index.html` contains `goalObjectiveInput` `maxlength="4000"`;
    served `/app.js` and `/sw.js` contain v201 and not v200.

## 2026-06-06 Operational Final Receipt One-shot Render v200

- User reported that long final receipts were still streaming. Root cause: the
  v199 hotfix used a length-threshold strategy for live `agentMessage` deltas:
  it streamed until `LONG_RECEIPT_SCROLL_CHARS`, then stopped repainting.
- `public/app.js` now distinguishes plain chat replies from operational final
  receipts:
  - Plain latest live chat `agentMessage` deltas may still stream normally.
  - If the latest live turn already has command/file/tool/search operation
    items, subsequent live `agentMessage` content is treated as the final
    receipt. The browser stores `item/agentMessage/delta` text without
    repainting from the first delta, suppresses `agentMessage` upsert repaint in
    that same operational-live case, and renders the full receipt once on
    `turn/completed`.
  - Long completed receipts still scroll to the receipt start rather than the
    bottom.
- Static shell advanced to `0.1.11|codex-mobile-shell-v200` /
  `codex-mobile-shell-v200`.
- Docs/tests updated:
  - README interface note, `docs/ARCHITECTURE.md`, `docs/TROUBLESHOOTING.md`,
    and `docs/MODULES.md`.
  - `test/conversation-render.test.js` now asserts
    `shouldDeferLiveFinalReceipt()`, `turnHasOperationalItems()`, and
    `shouldRenderAfterUpsert()` so future changes do not reintroduce started
    empty final-receipt streaming.
  - Build-id assertions updated in `test/mobile-viewport.test.js`,
    `test/thread-goal-service.test.js`, and
    `test/thread-task-card-route.test.js`.
- Validation:
  - `node --check public\app.js; node --check public\sw.js` passed.
  - Focused tests passed:
    `node --test test\conversation-render.test.js
    test\mobile-viewport.test.js test\turn-scroll-controls.test.js
    test\thread-goal-service.test.js test\thread-task-card-route.test.js`.
  - `npm.cmd run check` passed.
  - `npm.cmd test` passed with 349 tests.
  - `git diff --check` passed with only CRLF working-tree warnings.
  - UTF-8 BOM checks for edited source/docs/tests showed no BOM.
- Runtime:
  - Restarted Windows listener by stopping PID `48116` and starting scheduled
    task `Codex Mobile Web`.
  - Current Windows listener PID is `142372`.
  - `/api/public-config` reports
    `clientBuildId=0.1.11|codex-mobile-shell-v200` and
    `shellCacheName=codex-mobile-shell-v200`.
  - Served `/app.js` contains `defer-final-receipt`, does not contain
    `defer-long-agent`, and served `/sw.js` contains v200 only.
- Public release:
  - `C:\Users\xuxin\Documents\codex-mobile-web-public` was synced from the
    tracked public-safe product files only. `.agent-context`, runtime state,
    uploads, local keys, tokens, and machine-specific diagnostics were not
    copied.
  - Open PR check for `pentiumxp/codex-mobile-web-public` returned no open PRs.
  - Public commit `47d534c` (`修复操作型长回执一次性渲染 v200`) was pushed to
    `origin/main` on 2026-06-06.
  - Public validation before push:
    `npm.cmd test` passed with 349 tests, `npm.cmd run check` passed,
    `git diff --check` and `git diff --cached --check` passed, BOM checks
    showed no BOM, and staged privacy scans found no sensitive file paths, raw
    keys, local absolute paths, or private host names.

## 2026-06-06 Ten-turn Detail Pagination And Long Receipt Render v198

- Immediate follow-up v199 hotfix:
  - User reported that after accepting the v198 refresh, active/running threads
    showed only the user's own message and no running assistant messages.
  - Root cause: v198 hid the latest live `agentMessage` entirely until
    `turn/completed`, which made normal running replies disappear.
  - `public/app.js` now removes `shouldDeferLiveAgentMessage` and keeps live
    `agentMessage` items visible. `item/agentMessage/delta` uses
    `{ render: "defer-long-agent" }`: it renders normally until the long-receipt
    threshold, then stops repeated live redraws and waits for `turn/completed`
    to render the full receipt at the receipt start.
  - Static shell advanced again to `0.1.11|codex-mobile-shell-v199` /
    `codex-mobile-shell-v199`.
  - Validation:
    `node --check server.js; node --check public\app.js; node --check public\sw.js`,
    `node --test test\conversation-render.test.js test\mobile-viewport.test.js
    test\turn-scroll-controls.test.js test\thread-visibility.test.js`,
    `node --test test\thread-task-card-route.test.js
    test\thread-goal-service.test.js test\thread-item-timestamp-enrichment.test.js`,
    `npm.cmd run check`, `git diff --check`, and UTF-8 BOM checks passed.
  - Runtime:
    restarted Windows listener by stopping PID `55792` and starting scheduled
    task `Codex Mobile Web`; current PID is `48116`.
    `/api/public-config` reports
    `clientBuildId=0.1.11|codex-mobile-shell-v199` and
    `shellCacheName=codex-mobile-shell-v199`.
    Served `/app.js` contains v199, does not contain
    `shouldDeferLiveAgentMessage`, and contains the new
    `render: "defer-long-agent"` mode.
  - Public release:
    `C:\Users\xuxin\Documents\codex-mobile-web-public` was synced from the
    tracked public-safe product files, excluding `.agent-context`, runtime
    state, uploads, keys, local tokens, and machine-specific diagnostics.
    Open PR check for `pentiumxp/codex-mobile-web-public` returned no open PRs.
    Commit `55030e0` (`发布多账号、插件导航与长线程修复 v199`) was pushed to
    `origin/main` on 2026-06-06. Public validation before push:
    `npm.cmd test` passed with 349 tests, `npm.cmd run check` passed,
    `git diff --check` passed with only CRLF working-tree warnings, and staged
    privacy scans found no sensitive file paths, raw keys, local absolute paths,
    or private host names. The public multi-account CLI doc examples were
    generalized from local absolute paths to `%USERPROFILE%` / `%LOCALAPPDATA%`.
  - Private sync-back validation after the public push:
    `docs/MULTI_ACCOUNT_CODEX_CLI.md` was kept aligned with the public-safe
    path examples, `test/thread-title-source.test.js` was updated for the newer
    status-merge helper assertion, and private `npm.cmd test` passed with 349
    tests, `npm.cmd run check` passed, and `git diff --check` passed with only
    CRLF working-tree warnings.

- User requested replacing the 80-turn mobile detail window with a smaller
  recent window plus incremental top pagination, and rendering long final
  receipts once at completion while stopping at the receipt start instead of
  snapping to bottom.
- Server/mobile detail:
  - `CODEX_MOBILE_THREAD_TURNS` and `CODEX_MOBILE_FULL_THREAD_TURNS` now
    default to `10`.
  - `compactThread()` now sets `mobileOlderTurnsCursor` from the oldest retained
    turn when it omits older turns, so normal `thread-read` detail can paginate
    older history without using the former 32MB special path.
- Browser:
  - Initial thread detail shows 10 recent turns by default.
  - Scrolling to the top with recent user scroll intent calls
    `/api/threads/<id>/turns?limit=10&sortDirection=desc&cursor=...`, prepends
    older turns, preserves the current reading position, and decrements the
    omitted-turn count.
  - Previously loaded older turns are preserved across normal compacted
    `thread-read` refreshes while an older cursor or omitted count exists.
  - Latest live `agentMessage` deltas are stored but not rendered during live
    streaming. On `turn/completed`, the final receipt renders once. If the final
    receipt is at least `LONG_RECEIPT_SCROLL_CHARS` characters, the render
    scrolls to the start of that receipt and suppresses bottom-stick behavior.
  - Static shell advanced to `0.1.11|codex-mobile-shell-v198` /
    `codex-mobile-shell-v198`.
- Docs/tests updated:
  - README, `docs/ARCHITECTURE.md`, `docs/TROUBLESHOOTING.md`,
    `docs/MODULES.md`, and `docs/COMPLEX_FEATURE_PATHS.md`.
  - Focused assertions updated in `test/mobile-viewport.test.js`,
    `test/conversation-render.test.js`, `test/turn-scroll-controls.test.js`,
    `test/thread-visibility.test.js`, `test/thread-goal-service.test.js`, and
    `test/thread-task-card-route.test.js`.
- Validation:
  - `node --check server.js`, `node --check public/app.js`, and
    `node --check public/sw.js` passed.
  - Focused tests passed:
    `node --test test\thread-visibility.test.js test\mobile-viewport.test.js
    test\conversation-render.test.js test\turn-scroll-controls.test.js`.
  - Focused regression tests passed:
    `node --test test\thread-task-card-route.test.js
    test\thread-goal-service.test.js test\thread-item-timestamp-enrichment.test.js`.
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only existing CRLF warnings.
  - UTF-8 BOM check for edited source/docs/tests showed no BOM.
- Runtime:
  - Restarted Windows listener by stopping PID `23176` and starting the
    `Codex Mobile Web` scheduled task.
  - Current Windows listener PID is `55792`.
  - `/api/public-config` reports
    `clientBuildId=0.1.11|codex-mobile-shell-v198` and
    `shellCacheName=codex-mobile-shell-v198`.
  - Authenticated smoke for thread
    `019e8050-5a2d-7da3-9307-a3ca7148a016` returned
    `mobileReadMode=thread-read`, 10 turns, omitted 73, and an older cursor.
    Fetching the cursor through `/api/threads/<id>/turns?limit=10` returned 10
    older turns and another next cursor.

## 2026-06-06 Remove 32MB Thread-detail Special Path v197

- User clarified that Mobile Web must enter thread detail at the bottom, and
  requested cancelling the special handling for threads over 32 MB.
- Reverted the v196 top-of-history open behavior:
  - Removed `shouldOpenLargeThreadHistoryAtTop()`,
    `threadOpenRenderOptions()`, `scrollConversationToTop()`, and all
    `scrollToTop` render handling from `public/app.js`.
  - Cached same-thread re-entry and normal detail completion both call
    `renderCurrentThread({ stickToBottom: true })` again.
- Removed the 32 MB server-side detail skip:
  - Deleted `CODEX_MOBILE_THREAD_DETAIL_ROLLOUT_MAX_BYTES`,
    `THREAD_DETAIL_ROLLOUT_MAX_BYTES`, `shouldSkipThreadDetailRpc()`, and
    `threadDetailTooLargeWarning()` from `server.js`.
  - Removed the `/api/threads/:id` branch that returned
    `large-rollout-turns-list` solely because rollout size exceeded the
    threshold.
  - Continuation snapshot code no longer treats a source thread as too large
    to inspect solely by rollout size.
  - `thread/turns/list` remains only as a fallback after `thread/read` fails
    and as the explicit older-turn pagination endpoint.
- Static shell advanced to `0.1.11|codex-mobile-shell-v197` /
  `codex-mobile-shell-v197`.
- Validation:
  - `node --check server.js`, `node --check public/app.js`, and
    `node --check public/sw.js` passed.
  - Focused tests passed:
    `node --test test\thread-visibility.test.js test\mobile-viewport.test.js`
    and
    `node --test test\thread-task-card-route.test.js
    test\thread-goal-service.test.js test\thread-item-timestamp-enrichment.test.js
    test\conversation-render.test.js`.
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only existing CRLF warnings.
  - UTF-8 BOM check for edited files showed no BOM.
- Runtime:
  - Restarted Windows listener by killing stale PID `143296` and starting the
    `Codex Mobile Web` scheduled task.
  - Current Windows listener PID is `23176`.
  - `/api/public-config` reports
    `clientBuildId=0.1.11|codex-mobile-shell-v197` and
    `shellCacheName=codex-mobile-shell-v197`.
  - Post-restart metadata-only detail smokes:
    - `Codex mobile`
      (`019e8050-5a2d-7da3-9307-a3ca7148a016`), rollout about 34.73 MB:
      `mobileReadMode=thread-read`, 80 turns, omitted 1.
    - `Hermes 06-05`
      (`019e9566-c222-7560-af45-2b3665862188`), rollout about 73.01 MB:
      `mobileReadMode=thread-read`, 80 turns, omitted 6.

## 2026-06-06 Large Thread Re-entry Viewport v196

- User showed that after leaving and re-entering a >32 MB thread, Mobile Web
  appeared to show only the latest live turn/receipt area rather than the
  loaded recent-history window.
- Live API check for thread `019e8050-5a2d-7da3-9307-a3ca7148a016`
  (`Codex mobile`) proved the server was returning
  `mobileReadMode=large-rollout-turns-list`, 8 turns, and an older-turn cursor.
  The missing history was therefore in the browser view state, not server
  history retrieval.
- `public/app.js` now treats large-rollout `turns-list` detail windows with
  `mobileOlderTurnsCursor` as recent-history windows on open/re-entry:
  `threadOpenRenderOptions()` disables bottom snapping and explicitly scrolls
  `#conversation` to top. This also runs on the cached same-thread branch so
  returning from the thread list does not reuse the old live-turn scroll
  position.
- `updateConversationHtml()` now honors `scrollToTop` even when the render
  signature is unchanged. `scrollConversationToTop()` clears near-bottom state
  after setting `scrollTop=0`.
- Static shell advanced to `0.1.11|codex-mobile-shell-v196` /
  `codex-mobile-shell-v196`.
- Validation:
  - `node --check public/app.js`, `node --check public/sw.js`, and
    `node --check server.js` passed.
  - Focused tests passed:
    `node --test test\mobile-viewport.test.js test\conversation-render.test.js
    test\thread-visibility.test.js` and
    `node --test test\thread-task-card-route.test.js
    test\thread-goal-service.test.js
    test\thread-item-timestamp-enrichment.test.js`.
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only existing CRLF warnings.
  - UTF-8 BOM check for edited files showed no BOM.
- Runtime:
  - Killed stale Windows listener PID `95016` after scheduled-task stop/start
    did not replace it, then started the `Codex Mobile Web` scheduled task.
  - Current Windows listener PID is `143296`.
  - `GET /api/public-config` now reports
    `clientBuildId=0.1.11|codex-mobile-shell-v196` and
    `shellCacheName=codex-mobile-shell-v196`.
  - Post-restart metadata-only detail smoke for `Codex mobile` returned
    `large-rollout-turns-list`, 8 turns, older cursor present, latest active
    turn `019e9bd0-fe15-7b53-94a9-fa9bb86aacd8`.

## 2026-06-06 Hash Task-card Command And Large Thread History v195

- User reports:
  - Composer `#` should send a single Task card; before this change only
    `#自由协作` switched the send button to Task card mode.
  - Codex Mobile threads over about 30 MB stopped exposing older history; each
    new turn made the phone feel limited to a tiny recent window.
- Task-card command fix:
  - `public/app.js` now treats leading non-empty `#` as the Task card command.
    Bare `#` is still empty and does not send a card.
  - Legacy `#自由协作` remains accepted and defaults to autonomous workflow.
    Plain `#` defaults to manual single-card workflow unless the command asks
    for autonomous/free collaboration.
  - Updated README and cross-thread task-card docs/tests so ordinary non-empty
    `# ...` is no longer documented or tested as a normal message.
- Large-thread history fix:
  - Root cause: detail reads over
    `CODEX_MOBILE_THREAD_DETAIL_ROLLOUT_MAX_BYTES` skip full `thread/read` and
    use bounded `thread/turns/list`. That first page is intentionally 8 turns by
    default, but Mobile had no older-turn pagination and the cursor route could
    fail when a cursor was double encoded.
  - `server.js` now attaches `mobileOlderTurnsCursor` and
    `mobileNewerTurnsCursor` to large-rollout detail responses, normalizes
    cursor query strings before forwarding them, and keeps the app-server cursor
    type as a string.
  - `public/app.js` now shows a `Load older` history control when an older cursor
    exists. It loads another bounded page through `/api/threads/<id>/turns`,
    merges turns chronologically, expands visible history up to 80 loaded turns,
    and preserves that expanded history across normal refreshes.
  - PWA shell cache/client build advanced to
    `0.1.11|codex-mobile-shell-v195`.
- Validation:
  - `node --check public/app.js`, `node --check public/sw.js`, and
    `node --check server.js` passed.
  - Focused tests passed:
    `node --test test\thread-visibility.test.js test\mobile-viewport.test.js
    test\thread-task-card-route.test.js test\thread-goal-service.test.js`.
  - Additional focused tests passed:
    `node --test test\thread-item-timestamp-enrichment.test.js
    test\conversation-render.test.js test\message-input-service.test.js`.
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only existing line-ending warnings.
  - UTF-8 BOM check for edited source/docs/tests showed no BOM.
- Runtime:
  - Restarted Windows `Codex Mobile Web` scheduled task to load v195.
  - Current local listener PID after restart is `95016`.
  - `GET /api/public-config` reports
    `clientBuildId=0.1.11|codex-mobile-shell-v195` and
    `shellCacheName=codex-mobile-shell-v195`.
  - Live metadata-only validation on thread
    `019e8050-5a2d-7da3-9307-a3ca7148a016` (`Codex mobile`) returned
    `mobileReadMode=large-rollout-turns-list`, 8 first-page turns, an older
    cursor, and a second page with 8 older turns plus another next cursor.
    Double-encoded cursor input also returned 8 turns instead of an app-server
    cursor error.

## 2026-06-06 Windows Refresh, Hermes Stale Turn, And Mac Host Cache v575

- User report:
  - After re-login, Mac-hosted Hermes plugin still right-swiped from Codex
    thread detail back to the Hermes host instead of Codex's embedded primary
    page.
  - Windows-hosted Codex Mobile began showing frequent refresh prompts again.
  - Windows `Hermes 06-05` thread stopped showing new information.
- Windows refresh diagnosis and repair:
  - Local `GET /api/public-config` still reported
    `0.1.11|codex-mobile-shell-v192`, while served `/app.js` and `/sw.js`
    already contained v193. That mismatch is sufficient to trigger repeated
    refresh prompts.
  - Restarted only the Windows 8787 listener under the hidden windowless
    launcher; final listener PID after later code restart is `110072`.
  - Post-restart `GET /api/public-config` reports
    `clientBuildId=0.1.11|codex-mobile-shell-v193` and
    `shellCacheName=codex-mobile-shell-v193`.
- Windows Hermes stale-turn diagnosis and repair:
  - Thread id: `019e9566-c222-7560-af45-2b3665862188` (`Hermes 06-05`).
  - Latest stale turn id:
    `019e9b35-f17d-7131-b85a-3e315cfcd71d`.
  - Detail showed the latest turn as `inProgress`, but the rollout file had
    not grown over a 20 second sample; latest write was
    `2026-06-06T04:54:30Z`, current sampled time was about
    `2026-06-06T05:01:36Z`.
  - Authenticated `/api/events` returned status plus keepalive, `/api/status`
    had no `activeThreadIds`, and `/api/approvals` had zero pending approvals.
    This was not an EventSource outage.
  - Interrupted only the stale Hermes turn through the Mobile route. Detail then
    showed thread status `idle`, latest turn status `interrupted`, and
    `completedAt=1780722169`.
- Thread-list stale-active code fix:
  - After interrupt, detail was `idle` but the thread list still showed the
    same row as `active`. Root cause: `mergeThreadDisplaySummary()` always let
    rollout fallback status override app-server status for duplicate thread ids.
  - `server.js` now gives list-status merge a small precedence rule: stale or
    same-time rollout `active` cannot override app-server/detail `idle`, while
    genuinely newer rollout activity can still revive an older completed or
    notLoaded row to `active`.
  - Added regression coverage in `test/thread-visibility.test.js`.
  - Restarted Windows 8787 again to load the fix; PID changed from `93296` to
    `110072`.
  - Post-restart validation for `Hermes 06-05`: list status `idle`, detail
    status `idle`, latest turn `interrupted`, no active thread ids.
  - Deployed the same `server.js`, `test/thread-visibility.test.js`, and
    `docs/TROUBLESHOOTING.md` fix to Mac active Codex plugin directory
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Mac Codex plugin backup:
    `/Users/xuxin/.codex-mobile-web/source-backup-before-thread-list-stale-active-20260606_131353`.
  - Restarted Mac `com.hermesmobile.plugin.codex-mobile`; PID is now `9914`.
    Mac 8787 `/api/public-config` still reports
    `0.1.11|codex-mobile-shell-v193`.
- Mac/Windows Hermes host cache repair:
  - The previous Mac host bridge file was correct, but the host still referenced
    `app-embedded-plugin-ui.js?v=20260606-capability-touch-longpress-v574` and
    served the script with long-lived caching. An iPhone could keep using the
    old v574 URL even after re-login.
  - Bumped Hermes host static/cache version to
    `20260606-plugin-origin-allow-v575` on Windows host source
    `C:\ProgramData\HermesMobile\app`, Mac xuxin source
    `/Users/xuxin/HermesMobile/app`, and Mac active system daemon directory
    `/Users/hermes-host/HermesMobile/app`.
  - Windows backups:
    `%USERPROFILE%\.codex-mobile-web\hermes-host-win-backup-before-plugin-origin-cache-v575-20260606_130502`
    and
    `%USERPROFILE%\.codex-mobile-web\hermes-host-win-backup-before-task-list-v575-20260606_130514`.
  - Mac backups:
    `/Users/xuxin/.codex-mobile-web/hermes-host-backup-before-plugin-origin-cache-v575-20260606_130613_Users_xuxin_HermesMobile_app`
    and
    `/Users/xuxin/.codex-mobile-web/hermes-host-backup-before-plugin-origin-cache-v575-20260606_130613_Users_hermes-host_HermesMobile_app`.
  - Restarted Mac `com.hermesmobile.listener`; PID is now `9336`.
- Validation:
  - Local Codex Mobile focused checks passed:
    `node --check server.js` and
    `node --test test\thread-visibility.test.js test\conversation-render.test.js
    test\thread-item-timestamp-enrichment.test.js` passed 45/45.
  - Local `npm.cmd run check` passed.
  - Mac Codex plugin `node --check server.js` and
    `node --test test/thread-visibility.test.js` passed after deployment.
  - Windows Hermes host checks passed:
    `node --check public\app-embedded-plugin-ui.js`,
    `node --check public\service-worker.js`, and
    `node --test tests\embedded-plugin-refresh-harness.test.js
    tests\static-cache-version-harness.test.js`.
  - Mac active Hermes host checks passed with the pinned Node runtime:
    `public/app-embedded-plugin-ui.js`, `public/service-worker.js`,
    `tests/embedded-plugin-refresh-harness.test.js`, and
    `tests/static-cache-version-harness.test.js`.
  - HTTP checks:
    - Windows 8787 public config reports v193.
    - Windows 8797 root and service worker report
      `20260606-plugin-origin-allow-v575`.
    - Mac LAN `http://192.168.10.110:8797/` and
      `/service-worker.js` report
      `20260606-plugin-origin-allow-v575`.
    - Mac LAN
      `/app-embedded-plugin-ui.js?v=20260606-plugin-origin-allow-v575`
      returns sha16 `d0290a18ec97d550` and contains
      `embeddedPluginCurrentFrameOrigin`.
- Client note:
  - Windows clients may need one normal refresh to load Codex Mobile v193.
  - Mac-hosted Hermes pages should now request a new v575 host script URL; one
    fresh load should be enough to bypass the old v574 script cache.

## 2026-06-06 Mac Hermes Host Plugin Back-Swipe Origin Repair

- User clarification:
  - Windows-hosted Hermes plugin behavior is correct: right-swipe from a Codex
    thread detail returns to the Codex embedded primary thread/settings page.
  - Mac-hosted Hermes plugin behavior was wrong: the same gesture returned to
    the Hermes Mobile host/modal context.
- Diagnosis:
  - The Codex plugin iframe files served by 8787 matched between Windows and
    Mac: `/app.js`, `/plugin-embed.js`, and `/sw.js` had the same hashes and
    v193 shell markers.
  - The difference was the Hermes host shell on 8797. Windows served
    `public/app-embedded-plugin-ui.js` with hash prefix `d0290a18ec97d550` and
    function `embeddedPluginCurrentFrameOrigin(def)`, while the active Mac host
    initially served an older `app-embedded-plugin-ui.js` from the
    `/Users/hermes-host/HermesMobile/app` LaunchDaemon directory.
  - Version strings alone were insufficient: both hosts could advertise the
    same Hermes host static version while the active Mac file content differed.
  - Without `embeddedPluginCurrentFrameOrigin(def)`, the Mac host could reject
    proxied iframe `codex-mobile.plugin.navigation` messages whose actual
    `event.origin` was the current iframe `src` origin. The host then never
    learned `canGoBack:true`, so right-swipe fell through to Hermes host
    navigation instead of sending `{ type: "hermes.plugin.back", version: 1 }`
    to Codex.
- Repair:
  - Backed up the old active host file under
    `/Users/xuxin/.codex-mobile-web/hermes-host-backup-before-plugin-origin-allow-20260606_124519`.
  - Copied the correct host bridge file from
    `/Users/xuxin/HermesMobile/app/public/app-embedded-plugin-ui.js` to the
    active daemon path
    `/Users/hermes-host/HermesMobile/app/public/app-embedded-plugin-ui.js`.
  - Preserved active-daemon ownership/mode as `hermes-host:staff` and `0644`.
  - Restarted `com.hermesmobile.listener`; PID changed from `205` to `7820`.
- Validation:
  - Mac local 8797 now serves
    `app-embedded-plugin-ui.js` sha256
    `d0290a18ec97d550d735116d1d479064b1df7a52040e3bd6054fbb5ed8d3371d`.
  - Windows-to-Mac LAN HTTP sees the same 8797 host file:
    status 200, length 47435, sha16 `d0290a18ec97d550`, marker
    `embeddedPluginCurrentFrameOrigin`.
  - Windows and Mac 8787 plugin static files match:
    `/app.js` sha16 `712c073baafc23ad`, `/plugin-embed.js` sha16
    `f30d6798986c685d`, `/sw.js` sha16 `452d1c61997ec19e`.
  - Host root `http://127.0.0.1:8797/` returned HTTP 200 after restart.
  - Remote `node --check public/app-embedded-plugin-ui.js` and
    `tests/embedded-plugin-refresh-harness.test.js` passed before restart.
    `tests/static-cache-version-harness.test.js` still failed on an adjacent
    test metadata assertion requiring `tests/task-list-ui.test.js` to include
    the current client version; that was not the origin/back-swipe failure.
- Client note:
  - Already-open iPhone pages may need one reload/reopen of the Mac-hosted
    Hermes Web App to replace the old top-level host JavaScript. After that,
    Mac should follow the Windows behavior for Codex thread-detail right-swipe.

## 2026-06-06 Mac Profile Quota And Plugin Refresh v193

- User report:
  - After reopening/re-logging into the Mac-hosted Hermes plugin, the top-right
    reconnect state was gone, but the page still refreshed and the visible quota
    belonged to the wrong account.
- Diagnosis:
  - The active Mac listener process ran from
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - The profile store selected `previous`, and `/api/status.codexHome` correctly
    reported `/Users/xuxin/.codex-homes/previous` with
    `codexHomeSource=profile-store`.
  - The system LaunchDaemon still carried a stale
    `CODEX_HOME=/Users/xuxin/.codex`. `server.js` ignored that for its own
    resolved paths, but the managed `codex app-server` child was spawned without
    an explicit `env`, so the child inherited the stale default home. This made
    live quota come from the default account while Mobile status appeared to use
    the selected profile.
  - The remaining non-reconnect refresh path can also happen when an old cached
    Hermes iframe repeatedly detects the same client shell mismatch. Before
    v193, embedded build-change checks used `force: true`, bypassing the
    `codex-mobile.plugin.refresh_required` signature dedupe.
- Repairs:
  - `server.js` now spawns managed `codex app-server` with
    `env: Object.assign({}, process.env, { CODEX_HOME })`, so the child uses the
    resolved active profile home even when the service environment is stale.
  - `public/app.js` no longer forces repeated `server_build_changed` plugin
    refresh requests for the same signature.
  - Bumped the PWA shell from `codex-mobile-shell-v192` to
    `codex-mobile-shell-v193`.
  - Updated focused tests and docs:
    `test/new-thread-route.test.js`, `test/app-update.test.js`,
    `test/hermes-plugin-route.test.js`, `test/mobile-viewport.test.js`,
    `test/thread-goal-service.test.js`, `test/thread-task-card-route.test.js`,
    README, `docs/ARCHITECTURE.md`, and `docs/TROUBLESHOOTING.md`.
- Mac deployment:
  - Backed up active production files to
    `/Users/xuxin/.codex-mobile-web/source-backup-before-codehome-child-env-v193-20260606_120239`.
  - Deployed changed source files to
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Restarted the 8787 listener by terminating the old listener and relying on
    LaunchDaemon KeepAlive. Listener PID changed from `3462` to `3785`.
- Validation:
  - Local syntax checks passed:
    `node --check server.js`, `node --check public/app.js`, and
    `node --check public/sw.js`.
  - Local focused tests passed:
    `node --test test\new-thread-route.test.js test\app-update.test.js
    test\hermes-plugin-route.test.js test\codex-profile-service.test.js
    test\codex-profile-ui.test.js test\mobile-viewport.test.js
    test\thread-goal-service.test.js test\thread-task-card-route.test.js`
    passed 59/59.
  - Remote Mac focused checks passed with the pinned Node runtime, 59/59.
  - Post-restart Mac smoke:
    - `http://192.168.10.110:8787/api/public-config` returned HTTP 200 with
      `clientBuildId=0.1.11|codex-mobile-shell-v193` and
      `shellCacheName=codex-mobile-shell-v193`.
    - `http://192.168.10.110:8797/` returned HTTP 200.
    - Authenticated `/api/status` returned `ready=true`,
      `transport=managed-ws-child`, `codexHome=/Users/xuxin/.codex-homes/previous`,
      `codexHomeSource=profile-store`, `codexHomeEnvIgnored=true`, and
      `lastError=null`.
    - The managed app-server child process environment now reports
      `CODEX_HOME=/Users/xuxin/.codex-homes/previous`.
    - Live active quota changed from the stale default-account sample
      `38% / 38% used` to the selected-profile child sample `7% / 17% used`,
      with source `managed-child-live`.
- Client note:
  - Existing iPhone plugin frames must load v193 once. One refresh for the shell
    bump is expected; repeated refreshes after the iframe is on v193 should be
    treated as a new host/browser-cache issue.

## 2026-06-06 Mac Hermes Plugin Reconnect And Quota Read Repair

- User report:
  - Mac-hosted Codex Mobile in Hermes plugin mode still showed the top-right
    `重连` state and refresh prompts after the previous 8787 listener address
    repair.
  - Wrong-account quota was gone, but the correct quota was initially blank.
- Diagnosis:
  - The Codex plugin listener was already corrected to listen on `*:8787`, and
    both `http://127.0.0.1:8787/api/public-config` and
    `http://192.168.10.110:8787/api/public-config` returned HTTP 200.
  - Direct Codex `/api/events` stayed open and produced the 25s keepalive.
  - The active Hermes host same-origin plugin proxy in
    `/Users/hermes-host/HermesMobile/app/server-routes/hermes-plugin-api-routes.js`
    treated non-JSON/non-HTML responses as `await upstream.arrayBuffer()`.
    For `Content-Type: text/event-stream`, this means the iframe EventSource
    receives no initial status event or keepalive until the upstream ends,
    which makes iOS/Hermes plugin pages enter reconnect/recovery and sometimes
    show a refresh prompt.
- Repairs:
  - Hermes host production:
    - Added a `text/event-stream` branch to the same-origin plugin proxy. It
      writes the upstream status/headers immediately, preserves no-buffering
      headers, and pipes the upstream body through `Readable.fromWeb(...)`
      instead of buffering it.
    - Updated `/Users/hermes-host/HermesMobile/app/docs/MODULES/plugins.md`
      with the SSE streaming proxy rule.
    - Backups:
      `/Users/xuxin/.codex-mobile-web/hermes-host-backup-before-plugin-proxy-sse-20260606_1110xx`
      and
      `/Users/xuxin/.codex-mobile-web/hermes-host-doc-backup-before-plugin-proxy-sse-20260606_111742`.
    - Restarted `com.hermesmobile.listener`; post-restart PID was `205`.
  - Codex Mobile production:
    - `server.js` now calls official app-server RPC
      `account/rateLimits/read` after `initialize`, before broadcasting ready
      status. This hydrates current quota without waiting for a later
      `account/rateLimits/updated` notification.
    - Shared-profile homes still expose quota only when the source is this
      listener's own managed child app-server (`managed-child-live`); that
      snapshot is not persisted as reusable profile quota.
    - Deployed `server.js`, `adapters/codex-profile-service.js`,
      `test/codex-profile-service.test.js`, `test/new-thread-route.test.js`,
      README, `docs/ARCHITECTURE.md`, and `docs/TROUBLESHOOTING.md` to
      `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
    - Backup:
      `/Users/xuxin/.codex-mobile-web/source-backup-before-quota-read-rpc-20260606_111510`.
    - Restarted Codex plugin listener; post-restart PID was `710`.
- Validation:
  - Local Codex checks passed:
    `node --check server.js`,
    `node --check adapters\codex-profile-service.js`, and focused
    `node --test test\codex-profile-service.test.js
    test\codex-profile-ui.test.js test\new-thread-route.test.js` passed 33/33.
  - Mac Codex production focused checks passed with the pinned Node runtime:
    syntax checks plus the same focused test set, 33/33.
  - Hermes host focused check passed:
    `node --check server-routes/hermes-plugin-api-routes.js` and
    `node --test tests/hermes-plugin-api-routes.test.js`.
  - Post-restart Mac smoke:
    - `127.0.0.1:8787/api/public-config` HTTP 200, about 0.16s.
    - `192.168.10.110:8787/api/public-config` HTTP 200, about 0.14s.
    - Authenticated `/api/status` showed `ready=true`,
      `transport=managed-ws-child`, active profile `previous`,
      `topQuota=true`, active quota source `managed-child-live`,
      5h quota `36%`, weekly quota `37%`, and `lastError=null`.
    - Host proxy SSE smoke through
      `/api/hermes-plugins/codex-mobile/proxy/api/events` with a real plugin
      session returned a status event and a keepalive within a 32s sample.
      Curl ended with its max-time timeout, which is expected for SSE.
- Client note:
  - An already-open iPhone iframe may still show its old reconnect/refresh
    notice until the page reloads once. After the host restart and one fresh
    plugin load, new EventSource connections should receive proxy-streamed
    status and keepalive instead of staying silent behind the proxy.

## 2026-06-05 Hermes 06-05 Stale Turn Recovery

- User report:
  - The Windows-hosted `Hermes 06-05` Codex thread appeared stuck. After the
    user stopped the old turn and sent another message, the new turn also did
    not progress.
- Evidence:
  - Thread id: `019e9566-c222-7560-af45-2b3665862188`.
  - Latest stuck turn before repair:
    `019e984d-f938-7902-ac11-635438beaf90`.
  - Rollout path:
    `%USERPROFILE%\.codex\sessions\2026\06\05\rollout-2026-06-05T09-30-00-019e9566-c222-7560-af45-2b3665862188.jsonl`.
  - The previous stale turn `019e9842-ed02-7be3-ac74-36f81877c571` had already
    moved to `interrupted` after the user stop.
  - The new turn had only `task_started`, `turn_context`, and user-message
    events. The rollout size stayed unchanged across a short sample, there were
    no pending approvals, and no assistant/tool/token/complete event followed.
  - Another thread, `Codex mobile`, was still active and its rollout was
    growing, so the shared app-server was not globally down.
- Repair:
  - Used the Mobile Web authenticated interrupt route for only the Hermes turn:
    `POST /api/threads/019e9566-c222-7560-af45-2b3665862188/turns/019e984d-f938-7902-ac11-635438beaf90/interrupt`.
  - Did not restart the listener, mux, or shared app-server, to avoid
    disrupting the active `Codex mobile` thread.
- Validation:
  - After interrupt, latest Hermes turn status was `interrupted` with
    `completedAt=1780672335`, and thread status returned to `idle`.
- Caveat:
  - Root cause was not fully isolated. The observed failure mode is that the
    real app-server emits `turn/started` but the rollout then receives no first
    model/tool event for that Hermes thread. If it recurs on the next send,
    inspect mux/client connection churn and the real app-server child before
    restarting; avoid app-server restart while another important turn is active.
  - Follow-up clarification: the simultaneously active `Codex mobile` thread
    was the current diagnostic Codex thread. Do not treat Hermes no-growth as
    definitely stale while the diagnostic thread itself is still running and
    occupying the shared app-server/model execution path. Recheck Hermes only
    after the diagnostic turn has ended or after the other active turn is known
    to be unrelated.
  - Second recurrence: after the user resent again, Hermes created turn
    `019e9859-93cb-7bd0-98b4-c1ea94d88e89` at `2026-06-05T15:14:27Z` and again
    emitted only startup/user-message events with no rollout growth and no
    pending approvals. It was interrupted through the Mobile Web route at
    `completedAt=1780672808`; thread status returned to `idle`. The user opened
    a new handoff/continuation thread because the old Hermes thread is not
    currently usable for work.
  - Later recovery: the old Hermes thread did not revive the interrupted turn;
    it accepted later new turns. `019e9866-4aaa-7e30-90af-0cf1cb2a0777` and
    `019e9868-15e0-7f03-9f69-20261d4be1b4` completed after the interruptions.
    A later turn `61b34ecd-3fa1-4813-ae0c-dcf161950ee8` was active with a
    `commandExecution` item when checked. Treat the earlier issue as delayed or
    starved scheduling for specific submitted turns, not permanent thread
    loss.

## 2026-06-05 Windows Refresh Prompt And Mac Host Active-Path Repair

- User report:
  - Windows-hosted Mobile Web still showed frequent refresh prompts.
  - On the same iPhone, the Windows-hosted Hermes plugin could return from a
    Codex thread detail to the Codex primary plugin page, while the Mac-hosted
    Hermes plugin still right-swiped directly back to Hermes Mobile.
- Diagnosis:
  - Windows 8787 `/api/public-config` reported
    `clientBuildId=0.1.11|codex-mobile-shell-v191` and
    `shellCacheName=codex-mobile-shell-v191`, while the workspace disk files
    `public/app.js` and `public/sw.js` already contained v192. That listener
    was an old Node process and had not restarted into the current shell.
  - Mac Codex plugin 8787 was healthy on v192, but the active Hermes host
    system daemon `com.hermesmobile.listener` served host static version
    `20260605-gateway-key-run-status-v562` from
    `/Users/hermes-host/HermesMobile/app`.
  - The earlier v568 host bridge fix had been deployed to
    `/Users/xuxin/HermesMobile/app/public`, which was not the active system
    daemon working directory after the host moved to `hermes-host`.
  - This explains why the same phone behaved differently: the Windows host had
    the v568 embedded-plugin bridge, while the Mac system host was still on old
    v562 static files and could still reject the current proxied iframe
    navigation origin.
- Repair:
  - Windows: no active thread was reported by local `/api/status`; manually
    stopped only the 8787 listener PID and restarted `node server.js` hidden
    from `C:\Users\xuxin\Documents\codex-mobile-web`. The new listener PID is
    `42024`.
  - Mac: copied the v568 Hermes host files from
    `/Users/xuxin/HermesMobile/app` into the active system daemon directory
    `/Users/hermes-host/HermesMobile/app`, limited to:
    `public/app-embedded-plugin-ui.js`, `public/index.html`,
    `public/service-worker.js`, `public/directory-viewer.html`,
    `tests/embedded-plugin-refresh-harness.test.js`,
    `tests/static-cache-version-harness.test.js`, and
    `tests/task-list-ui.test.js`.
  - Mac backups:
    `/Users/xuxin/.codex-mobile-web/hermes-host-system-backup-before-host-v568-active-20260605_193031`
    and
    `/Users/xuxin/.codex-mobile-web/hermes-host-system-backup-before-task-list-test-v568-20260605_193136`.
  - Restarted Mac `com.hermesmobile.listener`; host PID changed from `98822` to
    `681`.
- Validation:
  - Windows `/api/public-config`, served `/app.js`, and served `/sw.js` now all
    report/include `codex-mobile-shell-v192`.
  - Mac active host root and `service-worker.js` now both report
    `20260605-capability-entry-hub-v568` from
    `/Users/hermes-host/HermesMobile/app`.
  - Mac focused host tests passed with
    `/Users/hermes-host/HermesMobile/runtime/node-current/bin/node`:
    `tests/embedded-plugin-refresh-harness.test.js` and
    `tests/static-cache-version-harness.test.js`.
  - Mac Codex plugin 8787 still reports `clientBuildId=0.1.11|codex-mobile-shell-v192`.
  - Mac Hermes host plugin manifest is healthy:
    `available=true`, `tokenStatus=launch_token_issued`; the proxied Codex
    plugin entry returned HTTP 200 and contained the Codex Mobile shell.
- Client note:
  - iPhone clients may need one host/plugin refresh or close/reopen to replace
    cached v562/v191 service worker shells. Repeated prompts after loading these
    versions would be a new issue, not the same version mismatch.

## 2026-06-05 Mac Hermes Host Codex Plugin Key Path Repair

- User report:
  - On Mac production, Hermes Mobile could not load the Codex Mobile plugin and
    reported that the workspace access key file could not be found.
- Diagnosis:
  - Codex Mobile listener `com.hermesmobile.plugin.codex-mobile` on 8787 was
    healthy: `/api/public-config` and `/api/v1/hermes/plugin/manifest` returned
    valid responses.
  - The error string came from Hermes host
    `/Users/xuxin/HermesMobile/app/adapters/hermes-plugin-service.js`, not from
    the Codex plugin listener.
  - The active Hermes host is the system LaunchDaemon
    `com.hermesmobile.listener`, running as user `hermes-host` from
    `/Users/hermes-host/HermesMobile/app`.
  - `findCodexMobileAccessKeyPath()` defaults to the host process home
    `.codex-mobile-web/access_key`; for `hermes-host` that path did not exist.
    The real Codex Mobile access key was under the `xuxin` runtime path.
- Repair:
  - Created a secret copy at
    `/Users/hermes-host/HermesMobile/data/secrets/codex-mobile-access-key.secret`.
    It is owned by `hermes-host:staff` with mode `600`.
  - Backed up `/Library/LaunchDaemons/com.hermesmobile.listener.plist` to
    `/Users/xuxin/.codex-mobile-web/launchdaemon-backup-com.hermesmobile.listener-20260605_190822.plist`.
  - Added `HERMES_MOBILE_CODEX_PLUGIN_ACCESS_KEY_PATH` to
    `com.hermesmobile.listener.plist`, pointing to the secret copy.
  - `launchctl kickstart` alone did not reload the edited environment, so the
    service was reloaded with `bootout` plus `bootstrap`. Final listener PID was
    `98822`, and live `launchctl print` showed the new environment variable.
- Validation:
  - Through Hermes host auth on `http://127.0.0.1:8797` using the
    `x-hermes-web-key` header backed by `HERMES_WEB_AUTH_KEY_PATH`, the Codex
    plugin manifest changed from `available=false`,
    `code=plugin_launch_key_missing`, `tokenStatus=workspace_key_missing` to
    `available=true`, `tokenStatus=launch_token_issued`.
  - LAN address `http://192.168.10.110:8797` returned the same healthy plugin
    manifest state.
  - Codex plugin proxy entry returned HTTP 200 with the Codex Mobile shell.
  - Recent `listener.err.log` had no new workspace-access-key related errors.
- Operational note:
  - Password SSH to this Mac was verified with user `xuxin`; the local note that
    said `xuxinXP` did not authenticate in this session. Do not record or print
    the password.
  - Do not use the Codex plugin access key as the Hermes host API auth key.
    The host API auth header is `x-hermes-web-key`; the plugin access key is
    only the host-readable plugin launch key material.

## 2026-06-05 Mac Reconnect / LaunchDaemon Split-Brain

- User report:
  - Mac-hosted Codex Mobile frequently showed the top-right `重连` activity
    state and sometimes refreshed the whole embedded app.
- Evidence and immediate repair:
  - A stale user submitted `launchctl submit` job label under the
    `com.xuefusong.codex-mobile-web.8787...` prefix had repeatedly tried to
    start another `server.js` on 8787. `mobile-web.log` had 563
    `EADDRINUSE` entries.
  - Removed that stale submitted job. Afterward, the `EADDRINUSE` count stayed
    at 563 over repeated checks, and authenticated `/api/events` stayed
    connected to a keepalive.
  - Found a second deployment split:
    - The active production listener is managed by system LaunchDaemon
      `/Library/LaunchDaemons/com.hermesmobile.plugin.codex-mobile.plist`,
      running as user `xuxin` from
      `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
    - A user LaunchAgent backup under `~/Library/LaunchAgents` points at
      `/Users/xuxin/HermesMobile/plugins/codex-mobile-web`.
  - Restoring the user LaunchAgent made it compete with the system daemon.
    Removed the user LaunchAgent again so only the system daemon owns 8787.
    The user-agent EADDRINUSE log count then stayed stable at 24 over 15s.
  - Current Mac smoke after cleanup:
    - 8787 is served by the system daemon's `node server.js`.
    - `/api/status` reports `ready=true`, transport `managed-ws-child`,
      `codexHomeSource=profile-store`, active profile `previous`, and no
      lastError.
    - Authenticated `/api/events` produced data plus keepalive with no error.
- Local implementation to prevent recurrence:
  - `adapters/shared-chain-restart-service.js`
    - Added safe LaunchAgent service-label detection from
      `CODEX_MOBILE_LAUNCHD_LABEL` / `XPC_SERVICE_NAME`.
    - macOS restart now cleans same-prefix submitted jobs and, when running
      under a LaunchAgent/LaunchDaemon label, calls
      `launchctl kickstart -k` for the existing service label.
    - Removed creation of persistent `launchctl submit` jobs. The non-service
      fallback is now a one-shot detached `nohup` listener.
  - `test/shared-chain-restart-service.test.js`
    - Added coverage for LaunchAgent `kickstart`, one-shot fallback, and
      absence of `launchctl submit`.
  - Updated `README.md`, `docs/ARCHITECTURE.md`, `docs/MODULES.md`, and
    `docs/TROUBLESHOOTING.md` with the macOS restart and EADDRINUSE diagnosis
    rule.
- Validation:
  - Local `node --check adapters\shared-chain-restart-service.js` passed.
  - Local focused `node --test test\shared-chain-restart-service.test.js
    test\manual-restart-ui.test.js` passed 12/12.
  - Local `npm.cmd run check` passed.
  - Local `npm.cmd run check:macos` passed.
  - Local `npm.cmd test` passed 341/341.
  - Local `git diff --check` passed, with only expected Windows LF-to-CRLF
    working-copy warnings.
- Deployment status and blocker:
  - User authorized using the SSH/sudo password stored in Desktop `NAS.TXT`;
    the password was used only as stdin and was not recorded.
  - The active system production directory
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web` was backed up
    and updated with the restart adapter, test, README, and docs changes.
    Latest backup:
    `/Users/xuxin/.codex-mobile-web/source-backup-before-macos-reconnect-restart-v193-kill-fallback-20260605_181033`.
  - During validation, a system LaunchDaemon edge was found: user-level
    `launchctl kickstart system/com.hermesmobile.plugin.codex-mobile` can leave
    the listener down. The final adapter therefore tries only GUI-domain
    `kickstart`; if that fails under a service label, it kills only the current
    listener and relies on LaunchDaemon KeepAlive. A controlled plain `kill`
    test confirmed KeepAlive restarted 8787 quickly.
  - Production focused checks passed in
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web` with
    `/Users/hermes-host/HermesMobile/runtime/node-current/bin/node`.
  - After sudo `launchctl kickstart -k
    system/com.hermesmobile.plugin.codex-mobile`, the loaded production listener
    was tested through the real authenticated `POST /api/restart/shared-chain`
    endpoint. PID changed from 69008 to 69106, `/api/status` returned
    `ready=true`, stale submitted labels were absent, and EADDRINUSE counts
    stayed `mobile 563` and `daemon 0`.
  - Authenticated `/api/events` stayed connected through a 32s keepalive, and
    a later 15s EADDRINUSE recheck still showed `mobile 563` and `daemon 0`.
  - Current Mac runtime is stable and the Mobile Web Restart endpoint is now
    safe for the system LaunchDaemon deployment.

## 2026-06-05 Mac Profile Quota Isolation v192

- User report:
  - Same iPhone accesses separate Windows-hosted and Mac-hosted Web Apps.
  - On Mac, Codex Mobile quota looked like the Windows account even though the
    Mac profile is a different Codex account.
  - Mac Codex Mobile also frequently showed reconnect/reload behavior.
- Evidence:
  - Mac 8787 process was running from
    `/Users/xuxin/HermesMobile/plugins/codex-mobile-web`, transport
    `managed-ws-child`, with
    `codexHome=/Users/xuxin/.codex-homes/previous`,
    `codexHomeSource=profile-store`, and `codexProfileActiveId=previous`.
  - Mac profile homes `current` and `previous` keep their own auth/config but
    link `sessions/`, `archived_sessions/`, and `state_5.sqlite` to the default
    `/Users/xuxin/.codex` state so thread visibility is shared.
  - Before this fix, Mac `/api/public-config` decorated all profiles with the
    same rollout-derived quota snapshot. That was unsafe after shared thread
    state because rollout quota is no longer account-scoped.
- Local implementation:
  - `adapters/codex-profile-service.js`
    - Added account-scoped rollout detection. If a profile's `sessions/` or
      `archived_sessions/` resolves outside that profile home, rollout quota is
      skipped for that profile.
    - Stored profile quota snapshots are now reusable only when written from a
      live active account snapshot (`source=active-live`); legacy snapshots
      without that provenance are ignored.
  - `server.js`
    - `loadRecentRateLimitsFromRollouts()` now skips rollout quota fallback
      when the active `CODEX_HOME` shares session state outside the profile
      home.
    - Profile list decoration receives only live quota snapshots, not
      activeRateLimits that may come from rollout fallback.
  - `public/app.js`
    - When `/api/public-config`, `/api/status`, or EventSource status explicitly
      contains no valid quota snapshot, the browser clears stale local quota
      cache instead of keeping a previous-account value.
    - Bumped client build to `0.1.11|codex-mobile-shell-v192`.
  - `public/sw.js`
    - Bumped shell cache to `codex-mobile-shell-v192`.
  - Updated tests/docs:
    - `test/codex-profile-service.test.js`
    - `test/codex-profile-ui.test.js`
    - `test/new-thread-route.test.js`
    - `test/new-thread-ui.test.js`
    - `test/mobile-viewport.test.js`
    - `test/thread-goal-service.test.js`
    - `test/thread-task-card-route.test.js`
    - `README.md`
    - `docs/ARCHITECTURE.md`
    - `docs/MODULES.md`
    - `docs/TROUBLESHOOTING.md`
- Validation:
  - `node --check server.js adapters\codex-profile-service.js public\app.js
    public\sw.js` passed.
  - Focused `node --test test\codex-profile-service.test.js
    test\codex-profile-ui.test.js test\new-thread-route.test.js
    test\new-thread-ui.test.js test\mobile-viewport.test.js
    test\thread-goal-service.test.js test\thread-task-card-route.test.js`
    passed 54/54.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `npm.cmd test` passed 340/340.
- Mac runtime:
  - Checked Mac visible threads before restart; no running thread was reported.
  - Backup created:
    `~/.codex-mobile-web/source-backup-before-profile-quota-v192-20260605_172526`.
  - Deployed the changed runtime/source/test/doc files to
    `/Users/xuxin/HermesMobile/plugins/codex-mobile-web/`.
  - Remote syntax and focused tests passed on Mac with
    `/Users/xuxin/HermesMobile/runtime/node-current/bin/node`.
  - Restarted Mac LaunchAgent `com.homeai.plugin.codex-mobile`; listener PID
    changed from `38722` to `53162`.
  - Mac `/api/public-config` now reports
    `clientBuildId=0.1.11|codex-mobile-shell-v192` and
    `shellCacheName=codex-mobile-shell-v192`.
  - After restart, active profile `previous` no longer receives the shared
    default rollout quota. Active top-level quota is currently absent until the
    live app-server account emits a quota snapshot; this is intentional because
    showing no quota is safer than showing another account's shared-rollout
    quota.
  - Mac endpoint timings after restart were approximately:
    `/api/public-config` 0.18s, `/api/status` 0.14s,
    `/api/threads?limit=40` 0.93s. This removes the shared-rollout quota scan
    as a reconnect contributor.
- Status:
  - Local changes are uncommitted.
  - Public repository was not synced or pushed.
  - iPhone clients should accept the v192 refresh prompt or close/reopen the
    Mac-hosted Web App once so local quota cache is cleared by the new shell.

## 2026-06-05 Mac Hermes Host Plugin Origin v568

- User clarification:
  - The same iPhone accesses two different Web Apps: one served by the Windows
    host and one served by the Mac production host. Windows host behavior was
    acceptable; Mac host still exited from Codex thread detail to the Hermes
    plugin context page and sometimes refreshed while inside a thread.
- Diagnosis:
  - This is a host deployment/configuration difference, not an iPhone browser
    difference.
  - The shared symptom is consistent with the Hermes host rejecting the Codex
    iframe `codex-mobile.plugin.navigation` postMessage. When that navigation
    state is not accepted, host right-swipe falls through to plugin context
    home and the launch-health timer can refresh the iframe after about 30s.
  - Mac Hermes host was still serving shell version
    `20260605-capability-entry-hub-v567`; Windows host had the patched host
    bridge staged for v568.
- Host implementation outside this repository:
  - In `C:\ProgramData\HermesMobile\app\public\app-embedded-plugin-ui.js`,
    `embeddedPluginMessageOriginAllowed()` now accepts the exact origin derived
    from the currently rendered iframe `src`, in addition to the existing
    manifest/record origins. This keeps the check origin-exact while allowing
    same-origin Hermes proxy iframe deployments.
  - Bumped Hermes host static shell/cache version to
    `20260605-capability-entry-hub-v568` in host `public/index.html`,
    `public/service-worker.js`, and `public/directory-viewer.html`; updated
    the host test version sentinel.
  - Added host harness coverage for accepting navigation from the current proxy
    frame origin.
- Validation:
  - Windows host focused checks passed:
    `node --check public\app-embedded-plugin-ui.js public\service-worker.js`;
    `node --test tests\embedded-plugin-refresh-harness.test.js
    tests\static-cache-version-harness.test.js`.
  - BOM checks for edited Windows host files passed.
  - Mac production checks passed after deployment:
    remote syntax checks for `public/app-embedded-plugin-ui.js` and
    `public/service-worker.js`; remote focused host tests
    `embedded-plugin-refresh-harness.test.js` and
    `static-cache-version-harness.test.js`; no old `v567` static version
    string remains under Mac host `public/` or `tests/`.
  - Remote public-file BOM checks showed no UTF-8 BOM.
- Runtime:
  - Mac host backup:
    `~/.codex-mobile-web/hermes-host-backup-before-plugin-origin-v568-20260605_161936`.
  - Deployed host files to `/Users/xuxin/HermesMobile/app/public/` and test
    harness files to `/Users/xuxin/HermesMobile/app/tests/`.
  - Restarted Mac LaunchAgent `com.homeai.hermes-mobile`; host PID changed
    from `9119` to `39557`.
  - Codex plugin listener LaunchAgent `com.homeai.plugin.codex-mobile` stayed
    on PID `38722`.
  - Mac host HTTP root reports
    `data-client-version="20260605-capability-entry-hub-v568"` and
    `service-worker.js` reports
    `HERMES_SW_VERSION = "20260605-capability-entry-hub-v568"`.
  - Mac Codex plugin shell remains on
    `clientBuildId=0.1.11|codex-mobile-shell-v191` /
    `shellCacheName=codex-mobile-shell-v191`.
- Status:
  - Local Codex Mobile repository changes remain uncommitted.
  - Public repository was not synced or pushed.
  - The iPhone may need to accept the Hermes Web App refresh prompt or close
    and reopen the Mac-hosted Web App once so the host service worker loads
    v568.

## 2026-06-05 Hermes Embed iOS Iframe Swipe v191

- User report:
  - Windows H5 could return from a Codex plugin thread detail to the Codex
    plugin thread/settings primary page, but Mac production inside Hermes
    Mobile still right-swiped directly back to the Hermes modal/topic page.
  - Windows also repeatedly showed a new-version refresh prompt.
- Evidence:
  - Mac production Codex plugin static files and `/api/public-config` were
    already on v190 before this fix; the Mac Hermes host JS hashes matched the
    Windows production host JS for the embedded plugin bridge, back-swipe
    target, right-swipe guard, service worker, and index shell.
  - Windows 8787 listener reported
    `clientBuildId=0.1.11|codex-mobile-shell-v189` while the served
    `/app.js` and `/sw.js` files contained v190/v191 static shell constants.
    That listener/static mismatch caused the repeated refresh prompt.
- Local implementation:
  - `public/app.js`
    - Added an iframe-owned Hermes embed left-edge swipe guard. In embed mode,
      if Codex's own navigation message would report `canGoBack:true`, an iOS
      left-edge right-swipe inside the iframe calls the same `handlePluginBack`
      path as `hermes.plugin.back` and returns to the embedded primary page.
    - Bumped client build to `0.1.11|codex-mobile-shell-v191`.
  - `public/sw.js`
    - Bumped shell cache to `codex-mobile-shell-v191`.
  - Updated tests/docs:
    - `test/mobile-viewport.test.js`
    - `test/thread-goal-service.test.js`
    - `test/thread-task-card-route.test.js`
    - `README.md`
    - `docs/ARCHITECTURE.md`
    - `docs/COMPLEX_FEATURE_PATHS.md`
    - `docs/MODULES.md`
    - `docs/TROUBLESHOOTING.md`
- Validation:
  - `node --check public\app.js public\plugin-embed.js public\sw.js` passed.
  - Focused `node --test test\mobile-viewport.test.js
    test\plugin-embed.test.js test\thread-goal-service.test.js
    test\thread-task-card-route.test.js` passed 23/23.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `npm.cmd test` passed 337/337.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
- Runtime:
  - Mac production backup created at
    `~/.codex-mobile-web/source-backup-before-embed-back-v191-20260605_160934`.
  - Deployed `public/app.js`, `public/plugin-embed.js`, and `public/sw.js` to
    `/Users/xuxin/HermesMobile/plugins/codex-mobile-web/public/`.
  - Remote syntax checks passed for those three files.
  - Restarted Mac LaunchAgent `com.homeai.plugin.codex-mobile`; listener PID
    changed from `28819` to `38722`.
  - Mac `/api/public-config` now reports
    `clientBuildId=0.1.11|codex-mobile-shell-v191` and
    `shellCacheName=codex-mobile-shell-v191`.
  - Restarted only the Windows 8787 `server.js` listener; PID changed from
    `129652` to `75948`, leaving mux PID `77796` unchanged.
  - Windows `/api/public-config`, `/app.js`, and `/sw.js` now all report or
    contain `codex-mobile-shell-v191`.
- Status:
  - Local changes are uncommitted.
  - Public repository was not synced.
  - iOS clients should accept the refresh prompt or close/reopen Hermes Mobile
    once so the iframe loads v191.

## 2026-06-05 Hermes Embed Back Navigation v190

- User report:
  - On Mac production inside Hermes Mobile, right-swipe from a Codex plugin
    thread detail secondary page returned directly to Hermes Mobile instead of
    returning to Codex's embedded thread-switcher/settings page.
- Local implementation:
  - `public/plugin-embed.js`
    - `canGoBack()` now treats the embedded primary page as an explicit
      `false` boundary even if stale thread state is present.
    - It now includes iframe-owned transient/detail states such as create
      workspace, update panel, settings panel, and thread-list drawer in
      `canGoBack:true` eligibility.
  - `public/app.js`
    - Bumped client build to `0.1.11|codex-mobile-shell-v190`.
    - `loadThread()` force-publishes plugin navigation immediately after
      selecting `currentThreadId` and again after the detail read completes, so
      the host sees `canGoBack:true` during the thread loading shell.
  - `public/sw.js`
    - Bumped shell cache to `codex-mobile-shell-v190`.
  - Tests/docs updated:
    - `test/plugin-embed.test.js`
    - `test/mobile-viewport.test.js`
    - `README.md`
    - `docs/ARCHITECTURE.md`
    - `docs/COMPLEX_FEATURE_PATHS.md`
    - `docs/MODULES.md`
    - `docs/TROUBLESHOOTING.md`
- Validation:
  - `node --check public\app.js public\plugin-embed.js public\sw.js` passed.
  - Focused `node --test test\plugin-embed.test.js test\mobile-viewport.test.js`
    passed 12/12.
  - `npm.cmd run check` passed.
  - `npm.cmd test` passed 337/337.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
- Runtime:
  - Deployed `public/app.js`, `public/plugin-embed.js`, and `public/sw.js` to
    Mac production plugin directory after backup:
    `~/.codex-mobile-web/source-backup-before-embed-back-v190-20260605_155358`.
  - Restarted LaunchAgent `com.homeai.plugin.codex-mobile`; observed listener
    PID `27710`.
  - `/api/public-config` on Mac production reports
    `clientBuildId=0.1.11|codex-mobile-shell-v190` and
    `shellCacheName=codex-mobile-shell-v190`.

## 2026-06-05 Goal RPC And Mobile Archive Index v185

- User report:
  - `/g` goal dialog still did not create a goal. The visible Codex reply said
    CLI goal read failed with `no such table: thread_goals`.
  - Old archived threads from recovered/profile history were still visible, and
    re-archiving them did not hide them.
- Evidence:
  - Default/profile `goals_1.sqlite` files had `thread_goals`, so the visible
    error was not the default DB schema alone.
  - Running Mobile/mux app-server processes used
    `%USERPROFILE%\.codex-mobile-web\codex.exe`, version
    `codex-cli 0.129.0-alpha.15`.
  - Local newer Codex app-server protocol from 0.135.x includes
    `thread/goal/set`, `thread/goal/get`, and `thread/goal/clear`; 0.129 only
    exposed goal notifications, not goal set/get/clear requests.
  - A reachable `%USERPROFILE%\.codex\app-server-mux\endpoint.json` can keep
    Mobile Web attached to an old app-server even after launchers are changed to
    prefer the newer binary.
- Local implementation:
  - `server.js`
    - Added `POST /api/threads/:id/goal`, forwarding to app-server
      `thread/goal/set` with objective and optional token budget.
    - Returns a clear 501 when the running app-server lacks the goal set RPC.
    - Added Mobile-local archive filtering through
      `%USERPROFILE%\.codex-mobile-web\archived-thread-ids.json`, merged with
      active/default/profile `archived_sessions` directories.
  - `public/app.js` / `public/sw.js`
    - `/g` still opens the compact dialog, but submit now calls
      `/api/threads/:id/goal` and updates local goal state from the response.
    - No normal chat message is sent for goal creation.
    - Static shell bumped to `0.1.11|codex-mobile-shell-v185` /
      `codex-mobile-shell-v185`.
  - Launchers:
    - Windows Mobile/Desktop shared launchers and direct mux startup now prefer
      the newest installed `%LOCALAPPDATA%\OpenAI\Codex\bin\*\codex.exe` when
      no explicit `-CodexExe` / `CODEX_MOBILE_CODEX_EXE` /
      `CODEX_MUX_CODEX_EXE` is set, then fall back to the older runtime copy.
    - The mux endpoint now records `codexExe` and `threadGoalRpc`; the
      windowless launcher reuses an existing endpoint only when `codexExe`
      matches the resolved binary. Old endpoints without this metadata are
      treated as stale.
  - Tests/docs updated:
    - `test/thread-goal-service.test.js`
    - `test/thread-archive.test.js`
    - `test/mobile-archive-index-service.test.js`
    - `README.md`
    - `docs/ARCHITECTURE.md`
    - `docs/MODULES.md`
    - `docs/TROUBLESHOOTING.md`
    - `docs/COMPLEX_FEATURE_PATHS.md`
- Validation so far:
  - JS syntax checks for edited server/mux/adapter/frontend/test files passed.
  - PowerShell parse checks for edited startup scripts passed.
  - Focused `node --test test\thread-goal-service.test.js
    test\thread-archive.test.js test\mobile-archive-index-service.test.js
    test\thread-visibility.test.js` passed 26/26.
  - Focused `node --test test\protocol.test.js
    test\thread-goal-service.test.js test\thread-archive.test.js
    test\mobile-archive-index-service.test.js test\codex-profile-ui.test.js`
    passed 29/29 after adding endpoint metadata coverage.
  - Full `npm test` passed 334/334.
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - BOM scan passed.
  - Narrow added-line secret-pattern scan found no matches.
- Runtime:
  - Stopped the old 8787 listener/windowless wrapper and started the updated
    windowless launcher.
  - New live chain:
    - windowless PID `115512`
    - mux PID `67460`
    - real app-server PID `67500`
    - listener PID `99604`
  - `%USERPROFILE%\.codex\app-server-mux\endpoint.json` now reports
    `codexExe=C:\Users\xuxin\AppData\Local\OpenAI\Codex\bin\7dea4a003bc76627\codex.exe`
    and `capabilities.threadGoalRpc=true`.
  - That binary reports `codex-cli 0.135.0-alpha.1`.
  - `/api/public-config` reports
    `clientBuildId=0.1.11|codex-mobile-shell-v185` and
    `shellCacheName=codex-mobile-shell-v185`.
  - Authenticated `/api/status` reports `ready=true`, transport
    `external-jsonl-tcp`, and `codexHome=C:\Users\xuxin\.codex`.
  - Did not create a real thread goal during validation to avoid mutating user
    thread state.

## 2026-06-05 Goal Submitted Card Fallback v186

- User report:
  - `/g` goal creation now works, but after entering the goal and pressing
    enter, the thread immediately starts executing while the entered objective
    is not shown in the conversation.
  - User explicitly requested not to affect the current goal task information
    flow; if activation would affect it, do not restart.
- Local implementation:
  - `public/app.js`
    - Added a submitted-goal display fallback. After `POST
      /api/threads/:id/goal` succeeds, the browser normalizes the returned
      `result.goal`; if the app-server response lacks a public goal object, it
      renders a local goal card from the just-entered objective and optional
      token budget.
    - Later `thread/goal/updated` notifications or sqlite fallback data still
      replace that local display state.
    - Bumped client build to `0.1.11|codex-mobile-shell-v186`.
  - `public/sw.js`
    - Bumped shell cache to `codex-mobile-shell-v186`.
  - Tests/docs updated:
    - `test/thread-goal-service.test.js`
    - `test/mobile-viewport.test.js`
    - `test/thread-task-card-route.test.js`
    - `README.md`
    - `docs/ARCHITECTURE.md`
    - `docs/MODULES.md`
    - `docs/TROUBLESHOOTING.md`
    - `docs/COMPLEX_FEATURE_PATHS.md`
- Validation:
  - Focused `node --test test\thread-goal-service.test.js
    test\mobile-viewport.test.js test\thread-task-card-route.test.js` passed
    16/16.
  - `node --check` for edited frontend/test files passed.
  - Full `npm test` passed 334/334.
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - BOM scan passed.
- Runtime:
  - Initially no restart was performed to avoid disturbing the current goal task
    information flow.
  - Later on 2026-06-05, restarted only the 8787 `server.js` listener after the
    user explicitly requested it. Listener PID changed from `99604` to `74572`.
  - Mux PID `67460` and real app-server PID `67500` were unchanged, so the goal
    task app-server stream was not restarted.
  - `/api/public-config` now reports
    `clientBuildId=0.1.11|codex-mobile-shell-v186` and
    `shellCacheName=codex-mobile-shell-v186`.
  - Authenticated `/api/status` reports `ready=true`, transport
    `external-jsonl-tcp`, and `codexHome=C:\Users\xuxin\.codex`.
  - Open PWA/browser clients should now accept the refresh prompt, hard refresh,
    or close/reopen once to load v186; the repeated v185/v186 prompt loop was
    caused by editing static files without restarting the listener.
- Public release:
  - Synced the public-safe source, tests, README, and docs to
    `C:\Users\xuxin\Documents\codex-mobile-web-public`; `.agent-context`,
    runtime state, uploads, local keys, and machine diagnostics were not copied.
  - Public validation passed in the public checkout:
    `npm.cmd test` 334/334, `npm.cmd run check`,
    `npm.cmd run check:macos`, `git diff --cached --check`, BOM scan, and
    staged privacy scan.
  - Pushed public commit `4da28c3` to
    `https://github.com/pentiumxp/codex-mobile-web-public.git` on `main`.

## 2026-06-05 Goal Dialog Submit Reliability v189

- User report:
  - In the Hermes Mobile thread, opening `/g`, entering a goal, pressing Enter,
    and later tapping Send appeared to do nothing.
  - Reopening `/g` still showed previous goal content.
- Diagnosis:
  - Runtime `/api/status` showed the shared app-server supports
    `threadGoalRpc=true`, so this was not the old 0.129 app-server issue.
  - `Hermes 06-05` already had a completed goal; the old dialog prefilled any
    existing goal, including completed goals, so a new `/g` could reopen with
    stale completed objective text.
  - Recent client-event logs had no `goal_request_start`, meaning the user's
    earlier taps did not reach the goal submit function in the loaded client.
- Local implementation:
  - `public/app.js`
    - Bumped shell to `0.1.11|codex-mobile-shell-v189`.
    - Goal objective Enter now submits; Shift+Enter keeps newline; IME
      composition is ignored.
    - Goal Send button now has explicit `pointerdown`, `pointerup`, `touchend`,
      and `click` handlers that call the same submit path instead of relying
      only on default form submit.
    - Added bounded `goal_button_pressed`, `goal_request_start`,
      `goal_request_success`, and existing failure diagnostics.
    - Completed goals are no longer used as editable `/g` dialog prefill;
      unfinished goals still prefill for editing.
  - `public/sw.js`
    - Shell cache bumped to `codex-mobile-shell-v189`.
  - Tests/docs updated:
    - `test/thread-goal-service.test.js`
    - `test/mobile-viewport.test.js`
    - `test/thread-task-card-route.test.js`
    - `README.md`
    - `docs/TROUBLESHOOTING.md`
- Validation:
  - `node --check public\app.js public\sw.js` passed.
  - Focused `node --test test\thread-goal-service.test.js
    test\mobile-viewport.test.js test\thread-task-card-route.test.js` passed
    16/16.
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - BOM scan of edited files found no UTF-8 BOM.
- Runtime:
  - Restarted only the 8787 `server.js` listener; PID changed from `90816` to
    `113936`.
  - Mux PID `67460` and real app-server PID `67500` were unchanged.
  - `/api/public-config` reports
    `clientBuildId=0.1.11|codex-mobile-shell-v189` and
    `shellCacheName=codex-mobile-shell-v189`.
  - Authenticated `/api/status` reports `ready=true`,
    `transport=external-jsonl-tcp`, and `lastError=null`.
  - Direct HTTP reads of `/app.js` and `/sw.js` returned v189 assets with the
    goal submit fallback code.

## 2026-06-05 Goal Completed-Row Reopen Fix

- User report:
  - After Mobile was reachable again, `/g` in the Hermes Mobile thread still
    looked inert: pressing Send produced no visible new goal task, and reopening
    `/g` showed empty/new input rather than an active submitted goal.
- Diagnosis:
  - Local client-event logs showed `goal_button_pressed`,
    `goal_request_start`, and `goal_request_success` for the Hermes thread, so
    the frontend button/submit path and backend HTTP route were firing.
  - The affected thread already had a `complete` goal row. The app-server
    accepted `thread/goal/set`, but the returned/current state remained tied to
    the completed goal row instead of starting a fresh goal turn.
  - Desktop and Mobile can appear out of sync because they are separate
    consumers of the app-server/mux stream. Desktop can keep its own open
    session while Mobile depends on the 8787 listener plus the shared mux
    endpoint, and this incident temporarily broke the Mobile side by disabling
    the scheduled task and replacing the endpoint with a sandbox process.
- Local implementation:
  - `server.js`
    - Imports `normalizeThreadGoalStatus`.
    - `POST /api/threads/:id/goal` now checks the current fallback goal state
      read-only through `threadGoalService.goalForThread()`.
    - If the current goal is `complete`, Mobile Web calls app-server
      `thread/goal/clear` first, then calls `thread/goal/set`.
    - If `thread/goal/set` still returns a completed goal and the route has not
      cleared one already, it clears and retries set once.
    - Mobile Web still does not write `goals_1.sqlite` directly.
  - Tests/docs updated:
    - `test/thread-goal-service.test.js`
    - `README.md`
    - `docs/TROUBLESHOOTING.md`
- Runtime:
  - The 8787 listener had been down because the scheduled task was disabled and
    a sandbox process had overwritten the mux endpoint. Re-enabled and started
    the `Codex Mobile Web` scheduled task through the shared-chain restart
    script.
  - After the code fix, restarted only the 8787 `server.js` listener by stopping
    the current listener and letting the windowless wrapper relaunch it.
  - Current listener PID is `129652`; mux PID `77796` and app-server child PID
    `21104` were not restarted by this final listener-only activation.
  - `/api/public-config` reports
    `clientBuildId=0.1.11|codex-mobile-shell-v189` and
    `shellCacheName=codex-mobile-shell-v189`.
  - Authenticated `/api/status` reports `ready=true`,
    `transport=external-jsonl-tcp`, `codexHome=C:\Users\xuxin\.codex`, and
    `lastError=null`.
- Validation:
  - `node --check server.js` passed.
  - `node --test test\thread-goal-service.test.js` passed 6/6.
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - BOM check for edited files found no UTF-8 BOM.
- Status:
  - The fix is active in the running 8787 listener.
  - A real `/g` retry on the user's Hermes thread is still needed to confirm
    app-server starts the fresh goal turn after the completed-row clear.

## 2026-06-05 Mac Studio Production Bring-Up

- Production host:
  - `macstudio-110` / `192.168.10.110`, user `xuxin`.
  - Treat this host as the production deployment target. Windows remains the
    development/source environment.
- User report:
  - iPhone showed `failed to start codex app-server (spawn codex ENOENT)` and
    thread list failed the same way after deploying Codex Mobile on the Mac.
- Diagnosis:
  - Non-interactive SSH/LaunchAgent PATH on the Mac lacked both `codex` and
    `node`; login zsh found Codex at `/Users/xuxin/.local/bin/codex`.
  - `~/.codex-mobile-web/codex-profiles.json` had Windows `C:\Users\xuxin\...`
    Codex home paths, overriding the correct `CODEX_HOME=/Users/xuxin/.codex`.
  - After PATH/profile repair, Codex CLI 0.137 still rejected the migrated
    SQLite state with SQLx checksum errors; schema matched a same-CLI fresh
    home, but migration checksums differed.
  - Once app-server started, v186 Mobile Web returned zero threads because the
    Mac visible-workspace roots did not match migrated Windows cwd values.
- Production runtime changes:
  - Updated `~/Library/LaunchAgents/com.homeai.plugin.codex-mobile.plist` with
    absolute `CODEX_MOBILE_CODEX_EXE=/Users/xuxin/.local/bin/codex`,
    `CODEX_MOBILE_NODE_EXE=/Users/xuxin/HermesMobile/runtime/node-current/bin/node`,
    and a PATH including `/Users/xuxin/.local/bin`.
  - Rewrote `~/.codex-mobile-web/codex-profiles.json` to Mac homes:
    `/Users/xuxin/.codex`, `/Users/xuxin/.codex-homes/current`, and
    `/Users/xuxin/.codex-homes/previous`.
  - Kept those as three separate Codex homes/profile ids; do not collapse them
    into one home because production relies on Codex home switching.
  - Restored `current` and `previous` home `auth.json` / `config.toml` only
    from existing Mac-side `profile-auth-backups`, without reading or printing
    raw token values. Linked shared non-auth thread/workspace state back to
    `/Users/xuxin/.codex`.
  - Backed up and updated SQLx migration checksums for `state_5.sqlite`,
    `logs_2.sqlite`, `memories_1.sqlite`, and `goals_1.sqlite` after matching
    schema against a temporary same-CLI `CODEX_HOME`; did not replace thread
    tables or auth/config files.
  - Deployed current source files needed by the production plugin:
    `server.js`, `public/app.js`, `public/sw.js`,
    `adapters/mobile-archive-index-service.js`, and
    `adapters/thread-goal-service.js`.
- Local implementation:
  - `server.js` now resolves `CODEX_MOBILE_CODEX_EXE` through explicit env,
    PATH, and common macOS CLI locations such as `/opt/homebrew/bin`,
    `/usr/local/bin`, and `$HOME/.local/bin` before falling back to bare
    `codex`.
  - `start-codex-shared-mobile-macos.sh` accepts/pass-through `--codex` and
    `--node` to Desktop and Mobile launchers.
  - Thread visibility fallback now keeps non-archived non-sub-agent migrated
    Windows-cwd rows visible in All workspaces when no returned row matches the
    current visible workspace set.
  - Tests/docs updated: `test/new-thread-route.test.js`,
    `test/thread-visibility.test.js`, `README.md`,
    `docs/TROUBLESHOOTING.md`, `docs/ARCHITECTURE.md`, and
    `docs/MODULES.md`.
- Production validation:
  - LaunchAgent PID after final restart: `14811`; app-server child:
    `/Users/xuxin/.local/bin/codex app-server --listen ws://127.0.0.1:51194`.
  - Authenticated `/api/status`: `ready=true`,
    `transport=managed-ws-child`, `codexExe=/Users/xuxin/.local/bin/codex`,
    `codexHome=/Users/xuxin/.codex`, `lastError=null`.
  - `/api/public-config`: `clientBuildId=0.1.11|codex-mobile-shell-v189`,
    `switchSupported=true`, and `default` / `current` / `previous` profiles
    exist with auth files and `loggedIn` status.
  - `/api/threads?limit=5&archived=false`: 200 with 5 rows from migrated
    Windows cwd history.
  - SQLite `pragma quick_check` remained `ok` for repaired DBs.
- Backups created on production host:
  - `~/.codex-mobile-web/mac-production-fix-*`
  - `~/.codex-mobile-web/mac-profile-home-restore-*`
  - `~/.codex-mobile-web/launchagent-backup-com.homeai.plugin.codex-mobile-*.plist`
  - `~/.codex-mobile-web/state-db-before-sqlx-checksum-fix-*`
  - `~/.codex-mobile-web/codex-dbs-before-sqlx-checksum-fix-*`
  - `~/.codex-mobile-web/source-backup-before-local-sync-*`
  - `~/.codex-mobile-web/server-backup-before-visible-filter-fix-*`

## 2026-06-05 Desktop/Mobile Shared-Stream Re-Convergence And No-Window Rule

- User correction:
  - Desktop launched through the same account shared shortcut and Mobile Web
    must converge on the same app-server/mux stream. Treat divergent Desktop
    and Mobile information flow as runtime drift, not as acceptable design.
  - Any Codex-started background/helper window must be no-window. The Desktop
    GUI itself is the user-facing exception; mux, Node, app-server, and bridge
    helper children must not open visible consoles.
- Diagnosis:
  - Active Mobile Web was on default profile
    `C:\Users\xuxin\.codex\app-server-mux\endpoint.json`, pointing to mux PID
    `77796` and app-server child PID `21104`.
  - A stale standalone default mux/app-server chain `135688 -> 54876` and
    several old `codex-app-server-mux.exe app-server --listen stdio://` bridge
    trees were still running. A Desktop attached to one of those old stdio
    chains would not share live stream state with Mobile on the new endpoint.
  - The Desktop mux shim source used `CreateProcessW` for its Node child but
    did not set `CREATE_NO_WINDOW` or hidden startup flags.

- Local implementation:
  - `codex-app-server-mux-shim.cs`
    - Added `CREATE_NO_WINDOW`, `STARTF_USESHOWWINDOW`, and `SW_HIDE`.
    - Starts the shim-spawned Node child with stdio handles preserved but no
      visible console window.
  - `test/desktop-profile-launcher.test.js`
    - Added static coverage for the no-window shim constants and
      `CreateProcessW` creation flags.
  - Docs updated:
    - `README.md`
    - `docs/ARCHITECTURE.md`
    - `docs/MODULES.md`
    - `docs/MULTI_ACCOUNT_CODEX_CLI.md`
- Runtime repair:
  - Stopped stale default standalone mux/app-server chain and old stdio bridge
    trees that were occupying `codex-app-server-mux.exe`.
  - Rebuilt `codex-app-server-mux.exe` through
    `start-codex-desktop-shared.ps1 -ProfileId default -PrintOnly`; this did
    not launch the Desktop GUI.
  - Current active app-server/mux processes are now the single default endpoint
    chain `77796 -> 21104`; no `codex-app-server-mux.exe` bridge process remains
    running.
  - Mobile Web remains healthy on 8787 with authenticated `/api/status`
    reporting `ready=true`, `transport=external-jsonl-tcp`,
    `sharedRequired=true`, `lastError=null`, and
    `codexHome=C:\Users\xuxin\.codex`.
- Validation:
  - Focused `node --test test\desktop-profile-launcher.test.js
    test\manual-restart-ui.test.js test\codex-profile-ui.test.js` passed
    16/16.
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - BOM scan of edited source/test/docs/context files found no UTF-8 BOM.
- Operational note:
  - If Desktop was still attached to an old bridge, it needs to be fully
    reopened through the shared shortcut/wrapper. The rebuilt shim and current
    endpoint will make the next Desktop bridge attach to the default profile
    mux path without visible helper consoles.


## 2026-06-05 State DB Recover And Thread List Rehydration

- User report:
  - `state_5.sqlite` corruption blocked CLI goal storage and manual thread
    rename with `database disk image is malformed`.
  - During repair attempts, Mobile briefly lost the 8787 listener while
    app-server/mux writers kept reopening the WAL.
  - After recover, Mobile loaded again but many thread rows had names that
    looked like thread ids or older archived/projectless entries.
- Runtime repair:
  - Generated a recovered `state_5.sqlite` candidate from the live default
    Codex home using SQLite `.recover`; the candidate passed
    `pragma quick_check`.
  - A force-offline repair stopped Mobile listener, standalone/stdin mux,
    `.codex-mobile-web\codex.exe app-server`, native Codex Desktop processes,
    and the scheduled `Codex Mobile Web` task long enough to move the old
    `state_5.sqlite`, `state_5.sqlite-wal`, and `state_5.sqlite-shm` into a
    backup directory and copy the recovered DB into place.
  - New live `C:\Users\xuxin\.codex\state_5.sqlite` passed
    `pragma quick_check`; recovered table counts logged as `threads=633` and
    `jobs=30`.
  - Re-enabled and restarted the `Codex Mobile Web` scheduled task/listener.
- Code follow-up:
  - `server.js`
    - `readThreadListFallback()` now always scans rollout-session fallback
      summaries instead of skipping them when the state DB returns enough rows.
    - Thread list merge now deduplicates by id, filters archived ids from
      `archived_sessions`, hydrates ID-like/empty titles from
      `session_index.jsonl`, sorts by newest timestamp before applying the
      requested limit, and then returns the capped list.
    - This is needed because a recovered SQLite DB can be structurally healthy
      but still miss recent thread rows or titles that exist only in rollout
      files and the Mobile title index.
  - Tests/docs updated:
    - `test/thread-visibility.test.js`
    - `README.md`
    - `docs/TROUBLESHOOTING.md`
- Validation:
  - `sqlite3.exe -readonly C:\Users\xuxin\.codex\state_5.sqlite
    "pragma quick_check;"` returned `ok`.
  - Focused `node --test test\thread-visibility.test.js
    test\new-thread-route.test.js` passed 26/26.
  - Full `npm test` passed 330/330.
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.

## 2026-06-05 Manual Rename Malformed State DB Fallback

- User report:
  - Manual thread rename again showed:
    `failed to set thread name: thread-store internal error: failed to set
    thread name: error returned from database: (code: 11) database disk image
    is malformed`.
- Cause:
  - This is the same underlying malformed default `.codex\state_5.sqlite`
    already diagnosed during the CLI goal failure and profile-switch thread
    recovery work.
  - The profile/MUX shared-state change made Mobile and other profiles use the
    default shared thread-state DB consistently. That exposed the bad DB on
    write paths such as app-server thread-store rename. It did not by itself
    prove the MUX change corrupted the DB.
- Local implementation:
  - `server.js`
    - Renamed the helper to `isRecoverableThreadTitleUpdateError()`.
    - Treats both `thread metadata unavailable before name update` and
      `database disk image is malformed` as recoverable app-server title-write
      failures.
    - If `session_index.jsonl` title persistence succeeds, manual rename now
      returns HTTP 200 with `titleUpdated=false` and `titleIndexed=true`, updates
      the short-lived in-memory summary, and avoids surfacing the bad SQLite
      write error to Mobile.
  - Tests/docs updated:
    - `test/new-thread-route.test.js`
    - `README.md`
    - `docs/TROUBLESHOOTING.md`
- Validation:
  - Focused `node --test test\new-thread-route.test.js
    test\thread-visibility.test.js test\mobile-viewport.test.js` passed 29/29.
  - Full `npm test` passed 328/328.
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.

## 2026-06-05 WeChat-Style Composer Bottom Clamp v184

- User follow-up:
  - Asked to make the bottom area closer to current WeChat behavior. The
    reference screenshot shows a bottom bar whose background fills the rounded
    bottom/safe area while the actual controls sit low instead of floating high
    above a large blank region.
- Diagnosis:
  - The prior v183 `safe-area - 12px` style only subtracts a small constant.
    In the Hermes/iPhone screenshot the effective bottom inset appears much
    larger than the normal iOS Home Indicator inset, so subtracting 12-14px is
    visually insufficient.
- Local implementation:
  - `public/styles.css`
    - Changed Hermes embed composer bottom spacing to clamp the reported bottom
      inset instead of preserving almost all of it.
    - Phone composer now uses
      `clamp(8px, safe-area - 88px, 52px)`.
    - Phone Hermes embed composer now uses
      `clamp(8px, safe-area - 84px, 56px)`.
    - Mobile composer row gap was reduced from 8px to 6px so the runtime
      controls sit closer to the input row, matching the compact bottom-bar
      feel without shrinking touch targets.
  - `public/app.js` and `public/sw.js`
    - Bumped static shell to `0.1.11|codex-mobile-shell-v184` /
      `codex-mobile-shell-v184`.
  - Tests/docs updated:
    - `test/mobile-viewport.test.js`
    - `test/composer-quota.test.js`
    - `test/thread-goal-service.test.js`
    - `test/thread-task-card-route.test.js`
    - `README.md`

## 2026-06-05 iPhone Composer Safe-Area Compromise v183

- User follow-up:
  - The v182 constant reduction did not visibly solve iPhone placement. Android
    already looked close to the bottom, but iPhone Home Indicator / rounded
    bottom geometry still left the composer too high.
- History/evidence:
  - Earlier phone composer layout used `padding: 8px 12px 7px`.
  - Later Hermes embed iOS handling used `14px + safe-area`, which becomes much
    higher on iPhone Home Indicator devices.
- Local implementation:
  - `public/styles.css`
    - Changed the non-phone Hermes embed bottom padding to
      `max(12px, safe-area - 10px)`.
    - Changed phone composer bottom padding to
      `max(8px, safe-area - 14px)`.
    - Changed phone Hermes embed bottom padding to
      `max(8px, safe-area - 12px)`.
    - This keeps Android / zero-safe-area phones at the existing 8px floor, but
      lets iPhone composer content sit partly inside the bottom safe area
      instead of reserving the full inset.
  - `public/app.js` and `public/sw.js`
    - Bumped static shell to `0.1.11|codex-mobile-shell-v183` /
      `codex-mobile-shell-v183`.
  - Tests/docs updated:
    - `test/mobile-viewport.test.js`
    - `test/composer-quota.test.js`
    - `test/thread-goal-service.test.js`
    - `test/thread-task-card-route.test.js`
    - `README.md`
- Validation:
  - Focused `node --test test\composer-quota.test.js
    test\mobile-viewport.test.js test\thread-goal-service.test.js
    test\thread-task-card-route.test.js` passed 22/22.
  - Full `npm test` passed 328/328.
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - BOM scan of edited text files found no UTF-8 BOM.
- Runtime:
  - Restarted only the 8787 Mobile Web listener; PID changed from 140492 to
    140700. Mux and external Codex app-server were not replaced.
  - `/api/public-config` now reports
    `clientBuildId=0.1.11|codex-mobile-shell-v183` and
    `shellCacheName=codex-mobile-shell-v183`.
  - `/api/status` returned `ready=true`, active `codexHome` source
    `profile-store`.

## 2026-06-05 iPhone Composer Bottom Offset v182

- User report:
  - On iPhone, the bottom composer still sat too high. With the model/effort/
    permission/quota controls stacked above the input row, one-handed swipes
    could accidentally hit the controls.
- Local implementation:
  - `public/styles.css`
    - Lowered Hermes embed composer bottom padding from `18px + safe-area` to
      `12px + safe-area` for larger embed layouts.
    - Lowered phone composer bottom padding from
      `max(12px, 7px + safe-area)` to `max(8px, 3px + safe-area)`.
    - Lowered phone Hermes embed composer bottom padding from
      `14px + safe-area` to `max(8px, 4px + safe-area)`.
    - Kept composer control, attachment, input, and Send button target heights
      unchanged.
  - `public/app.js` and `public/sw.js`
    - Bumped static shell to `0.1.11|codex-mobile-shell-v182` /
      `codex-mobile-shell-v182`.
  - Tests/docs updated:
    - `test/mobile-viewport.test.js`
    - `test/composer-quota.test.js`
    - `test/thread-goal-service.test.js`
    - `test/thread-task-card-route.test.js`
    - `README.md`
- Validation:
  - Focused `node --test test\composer-quota.test.js
    test\mobile-viewport.test.js test\thread-goal-service.test.js
    test\thread-task-card-route.test.js` passed 22/22.
  - Full `npm test` passed 328/328 after updating the old composer-padding
    assertion.
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - BOM scan of edited text files found no UTF-8 BOM.
- Runtime:
  - Restarted only the 8787 Mobile Web listener; PID changed from 133260 to
    140492. Mux and external Codex app-server were not replaced.
  - `/api/public-config` now reports
    `clientBuildId=0.1.11|codex-mobile-shell-v182` and
    `shellCacheName=codex-mobile-shell-v182`.
  - `/api/status` returned `ready=true`, active `codexHome` source
    `profile-store`.

## 2026-06-05 Rollout Fallback Running Status Server Fix

- User-reported regression:
  - A Hermes Mobile thread that was still writing to the shared rollout did not
    show the sidebar/home running refresh indicator after the v181 browser-local
    stale-hint change.
- Evidence:
  - `/api/threads?limit=200&archived=false` returned the Hermes row as
    `status.type=notLoaded`, `mobileFallback=true`, and an old `updatedAt`.
  - The same row had a fresh `rolloutSizeUpdatedAtMs`.
  - Bounded rollout-tail metadata showed the relevant turn later emitted
    `task_complete`, so fallback state also needs to clear stale spinners when
    a completion event exists.
- Local implementation:
  - `server.js`
    - Added rollout-session fallback status inference from bounded rollout-tail
      event types. Recent activity after the latest terminal event becomes
      fallback `status.type=active`; a latest terminal event such as
      `task_complete` becomes `status.type=completed`.
    - Added `CODEX_MOBILE_ROLLOUT_ACTIVE_STATUS_WINDOW_MS`, default 30 minutes,
      for active inference. The server requires a timestamped activity event;
      mtime alone is not enough to mark a thread active.
    - `rowToFallbackThread()` now preserves a passed fallback status instead of
      forcing `notLoaded`.
    - Rollout-session fallback `updatedAt` now uses the newest of session-index
      timestamp, rollout head timestamp, and rollout file mtime, so shared
      fallback rows move in the thread list after background writes.
  - `test/thread-visibility.test.js`
    - Added coverage for mtime-over-index `updatedAt`, active/completed rollout
      tail status inference, and no active inference from a touched file without
      timestamped activity.
  - Documentation updated:
    - `README.md`
    - `docs/ARCHITECTURE.md`
    - `docs/MODULES.md`
    - `docs/TROUBLESHOOTING.md`
- Validation:
  - `node --check server.js` passed.
  - Focused `node --test test\thread-visibility.test.js
    test\conversation-render.test.js test\mobile-viewport.test.js` passed
    34/34.
  - Full `npm test` passed 328/328.
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - BOM scan of edited text files found no UTF-8 BOM.
- Runtime:
  - This is server-only; no `public/app.js` / `public/sw.js` shell bump is
    required for this fix.
  - Restarted only the 8787 Mobile Web listener; PID changed from 137312 to
    133260. Mux and external Codex app-server were not replaced.
  - `/api/status` returned `ready=true`, active `codexHome` source
    `profile-store`.
  - `/api/threads?limit=200&archived=false` now returns Hermes thread
    `019e8da4-1a90-7b03-a827-5c1ddf9a7fee` with
    `status.type=completed` and `updatedAt=1780596290`, matching the rollout
    mtime-backed completion point.

## 2026-06-04 CLI Goal `/g` Entry v180

- User clarification:
  - Do not add another visible toolbar button for goals. The screen is tight and
    goals are not common.
  - Use a composer command instead: entering `/g` should open a goal dialog,
    then Mobile Web should send a normal Codex message in the required format.
- Local implementation:
  - `public/app.js`
    - Added `THREAD_GOAL_COMMAND_PREFIX = "/g"`.
    - Existing-thread composer submit now treats exact `/g` as a local command:
      it clears the composer and opens the goal dialog instead of sending `/g`
      as message text.
    - `/g` is rejected in new-thread drafts and with attachments.
    - Added a compact goal dialog backed by `submitThreadGoalMessage()`.
    - Goal dialog submit posts to the existing
      `/api/threads/:id/messages` route with current model/effort/permission
      and fastMode settings. It does not call a custom goal route.
    - The generated message asks Codex to set the current thread goal and to
      use the CLI goal feature if available.
    - Bumped client build to `0.1.11|codex-mobile-shell-v180`.
  - `public/index.html`
    - Added the hidden goal dialog with objective and optional token budget.
  - `public/styles.css`
    - Added goal dialog/panel styles.
  - `public/sw.js`
    - Bumped shell cache to `codex-mobile-shell-v180`.
  - Tests/docs updated:
    - Extended `test/thread-goal-service.test.js` for `/g`, dialog, normal
      messages POST, and no direct `goals_1.sqlite` frontend write.
    - Updated v180 shell assertions.
    - Updated README, architecture, complex feature path, module map,
      troubleshooting, and this handoff.
- Invariant:
  - Mobile Web still treats `goals_1.sqlite` as read-only fallback state.
    Creation/status/completion semantics remain Codex CLI/runtime behavior.
- Validation:
  - Focused `node --test test/thread-goal-service.test.js
    test/mobile-viewport.test.js test/thread-task-card-route.test.js` passed
    16/16.
  - Full `npm test` passed 324/324.
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - BOM scan of changed tracked/untracked files found no BOM.
  - Added-line privacy scan outside `.agent-context` found no new
    secret/path/upload hits.
- Runtime notes:
  - Restarted the 8787 Node listener after validation.
  - `/api/public-config` reported
    `clientBuildId=0.1.11|codex-mobile-shell-v180` and
    `shellCacheName=codex-mobile-shell-v180`.
  - Open browser/PWA clients must accept the refresh prompt, hard refresh, or
    close/reopen to load `codex-mobile-shell-v180`.
- Follow-up goal-store failure diagnosis:
  - A `/g` request reached Codex, but the CLI/runtime goal write failed with
    `database disk image is malformed`.
  - Checked active Mobile Web profile through authenticated `/api/status`:
    `codexHome=C:\Users\xuxin\.codex`, `codexHomeSource=profile-store`,
    active profile `default`.
  - `goals_1.sqlite` in default/current/previous profile homes passed
    `PRAGMA integrity_check`/`quick_check` and each had `thread_goals` count 0.
  - `logs_2.sqlite` passed `quick_check`.
  - The real corruption is `C:\Users\xuxin\.codex\state_5.sqlite`; quick check
    reports invalid pages/freelist/index counts. This matches mux log evidence:
    goal reconciliation failed while reading thread metadata before writing
    goals.
  - A non-destructive recovery candidate was generated with SQLite 3.53
    `.recover`:
    `C:\Users\xuxin\.codex\state_5.sqlite.recover-candidate-20260604-233644`.
    It passes `quick_check`, has 10 tables, 24 indexes, 633 threads, 30 jobs,
    and 378 thread spawn edges.
  - The corrupt live DB still has 639 readable threads, so the recovery
    candidate is missing 6 currently readable thread rows. Do not replace the
    live DB without first backing up `state_5.sqlite`, `state_5.sqlite-wal`,
    and `state_5.sqlite-shm`, then stopping the app-server/mux writers that use
    the same `.codex` home.

## 2026-06-04 CLI Goal State Display v179

- User request:
  - Inspect how Codex Mobile Web should use the new Codex CLI/Desktop goal
    feature now that the local CLI supports it.
- Protocol evidence:
  - Local Codex CLI app-server schema exposes `thread/goal/updated` and
    `thread/goal/cleared` server notifications.
  - The generated client request union has no dedicated `thread/goal/create`,
    edit, clear, or complete RPC. Mobile Web therefore treats goals as
    read-only thread state; creation/completion remains Codex turn/model/tool
    behavior from CLI/Desktop.
- Local implementation:
  - Added `adapters/thread-goal-service.js`.
    - Reads active `<CODEX_HOME>\goals_1.sqlite` read-only through
      `sqlite-cli`.
    - Normalizes sqlite `thread_goals` rows into public `thread.goal` shape.
    - Converts `budget_limited` to `budgetLimited`, preserves
      `usageLimited`/`blocked`, truncates objective text, and degrades to empty
      goals when sqlite is missing, locked, malformed, or table-less.
  - `server.js`
    - Resolves `GOALS_DB` under the active profile `CODEX_HOME`.
    - Decorates `/api/threads` list rows and `/api/threads/:id` detail
      responses with `thread.goal` without blocking normal list/detail reads.
  - `public/app.js`
    - Handles `thread/goal/updated` and `thread/goal/cleared` before the
      current-thread-only notification guard.
    - Adds thread-list Goal/Paused/Budget/Limited/Blocked/Done badges.
    - Adds a compact thread-detail goal card with objective and budget/time
      summary.
    - Includes goal state in list/detail render signatures.
    - Bumped client build to `0.1.11|codex-mobile-shell-v179`.
  - `public/styles.css`
    - Added goal badge/card styles.
  - `public/sw.js`
    - Bumped shell cache to `codex-mobile-shell-v179`.
  - Documentation updated:
    - `README.md`
    - `docs/ARCHITECTURE.md`
    - `docs/COMPLEX_FEATURE_PATHS.md`
    - `docs/MODULES.md`
    - `docs/TROUBLESHOOTING.md`
  - Tests updated/added:
    - Added `test/thread-goal-service.test.js`.
    - Updated v179 shell assertions in `test/mobile-viewport.test.js` and
      `test/thread-task-card-route.test.js`.
- Validation:
  - Focused `node --test test/thread-goal-service.test.js
    test/mobile-viewport.test.js test/thread-task-card-route.test.js` passed
    15/15.
  - Full `npm test` passed 323/323.
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - BOM scan of changed tracked/untracked files found no BOM.
  - Added-line privacy scan found no new secret/local-path/upload leaks; a
    broad whole-file scan still reports known existing documentation/source
    references such as `auth.json`, VAPID file names, and upload route strings.
- Runtime notes:
  - Restarted only the 8787 Node listener after validation; did not remove the
    mux endpoint or stop Codex app-server/Desktop mux processes.
  - `/api/public-config` reported
    `clientBuildId=0.1.11|codex-mobile-shell-v179` and
    `shellCacheName=codex-mobile-shell-v179`.
  - Open browser/PWA clients must accept the refresh prompt, hard refresh, or
    close/reopen to load `codex-mobile-shell-v179`.
  - Do not manually edit or write `goals_1.sqlite`.

## 2026-06-04 Runtime Settings Persistence And Inheritance v178

- User clarification:
  - The issue was not changing a currently running turn. The expected behavior
    is that a selected model/reasoning level should apply to the next turn and
    should survive leaving/reopening the app before that send.
- Local implementation:
  - `public/app.js`
    - Runtime model/effort/permission selections now call the existing draft
      save path immediately.
    - Thread load restores the thread-keyed draft before rendering composer
      settings, so runtime-only drafts survive app reloads and thread switches.
    - Existing-thread send success clears only text/attachments, then writes the
      runtime-only draft back under the thread key. This prevents the composer
      from showing stale thread metadata such as Medium immediately after a
      user sends with XHigh.
    - New-thread send captures submitted model/effort/permission before
      creation and writes them back under the newly created thread key once the
      thread id is known.
    - Removed the stale `saveDraftForCurrentTarget()` call from the Fast toggle
      path and replaced it with `saveCurrentDraftNow()`.
    - Bumped client build to `0.1.11|codex-mobile-shell-v178`.
  - `public/sw.js`
    - Bumped shell cache to `codex-mobile-shell-v178`.
  - `server.js`
    - `threadRuntimeSettings()` now inherits `model` and `reasoningEffort`
      from rollout `turn_context`, state DB/app-server thread metadata, then
      Codex config defaults.
    - `applyStartThreadRuntimeSettings()` applies inherited model to
      `thread/start`.
    - `applyTurnRuntimeSettings()` applies inherited model and effort to
      `turn/start`, covering continuation bootstrap/source handoff turns and
      cross-thread task-card approval injection. Explicit browser request
      values still override inherited values on normal sends.
  - Documentation updated:
    - `README.md`
    - `docs/ARCHITECTURE.md`
    - `docs/COMPLEX_FEATURE_PATHS.md`
    - `docs/MODULES.md`
    - `docs/TROUBLESHOOTING.md`
  - Tests updated:
    - `test/composer-draft.test.js`
    - `test/new-thread-route.test.js`
    - `test/thread-task-card-route.test.js`
    - `test/mobile-viewport.test.js`
- Validation:
  - Focused `node --test test\composer-draft.test.js
    test\new-thread-route.test.js test\thread-task-card-route.test.js
    test\runtime-settings.test.js test\mobile-viewport.test.js` passed 30/30.
  - Full `npm.cmd test` passed 318/318.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - UTF-8 BOM scan of changed files found no BOM.
- Runtime notes:
  - Existing clients must accept the refresh prompt, hard refresh, or close and
    reopen to load v178.
  - A message sent as `turn/steer` still cannot change a turn that has already
    started; the persisted runtime selection is for the next new `turn/start`.

## 2026-06-04 Profile Switch Thread Recovery And Desktop Shared State

- User report:
  - After switching Codex account/profile, Mobile Web could keep chatting but
    thread/workspace lists collapsed after changing threads. Re-login later
    showed the threads again after the shared-chain restart completed.
  - User asked to apply the same MUX/shared-state pattern to Codex Desktop's
    three profile launchers.
- Diagnosis:
  - Active Mobile Web profile was `default`, using
    `C:\Users\xuxin\.codex` and
    `C:\Users\xuxin\.codex\app-server-mux\endpoint.json`.
  - `%USERPROFILE%\.codex\state_5.sqlite` failed `pragma quick_check` with
    `database disk image is malformed`, so the prior SQLite fallback could
    collapse to a small projectless `session_index` result set.
  - `.codex-homes\current\state_5.sqlite` returned `ok`; this is evidence of
    profile-local state divergence, not a database repair.
- Local implementation:
  - `server.js`
    - Added a rollout-session/thread-list fallback that reads bounded rollout
      session heads and `session_index.jsonl` when `state_5.sqlite` is
      unavailable or malformed.
    - Thread detail now falls back to rollout-session data before app-server
      summary-only detail.
  - `start-codex-desktop-shared.ps1`
    - Added the same non-default profile shared-state setup used by the Mobile
      Web windowless launcher.
    - Profile-local `auth.json` and `config.toml` are backed up but not
      replaced. Non-auth thread/workspace state is linked from default
      `.codex`: `.codex-global-state.json`, `state_5.sqlite*`,
      `session_index.jsonl`, `sessions`, and `archived_sessions`.
  - Tests updated:
    - `test/thread-visibility.test.js`
    - `test/thread-archive.test.js`
    - `test/desktop-profile-launcher.test.js`
  - Documentation updated:
    - `docs/ARCHITECTURE.md`
    - `docs/TROUBLESHOOTING.md`
    - `docs/MODULES.md`
    - `docs/MULTI_ACCOUNT_CODEX_CLI.md`
- Validation:
  - Mobile Web shared-chain restart completed in the background despite the
    interrupted wait output. Latest observed listener was PID `138472`.
  - Authenticated `/api/public-config` returned
    `clientBuildId=0.1.11|codex-mobile-shell-v172` and
    `shellCacheName=codex-mobile-shell-v172`.
  - Authenticated `/api/status` was ready with endpoint source under
    `.codex\app-server-mux\endpoint.json`.
  - Authenticated `/api/threads?limit=20` returned 20 threads after restart.
  - `node --test test\thread-visibility.test.js test\thread-archive.test.js
    test\mobile-viewport.test.js` passed 15/15 before Desktop changes.
  - `powershell.exe` scriptblock parse for
    `start-codex-desktop-shared.ps1` passed.
  - `node --test test\desktop-profile-launcher.test.js
    test\codex-profile-ui.test.js` passed 10/10.
  - Full `npm.cmd test` passed 310/310.
  - `npm.cmd run check`, `npm.cmd run check:macos`, and `git diff --check`
    passed; `git diff --check` only emitted Windows LF-to-CRLF working-copy
    warnings.
- Status and risk:
  - Local changes are uncommitted.
  - Mobile Web thread visibility is live via a read-only recovery fallback; it
    does not repair the malformed default `.codex\state_5.sqlite`.
  - Desktop launchers now prepare shared non-auth state before launch. Desktop
    GUI ChatGPT login isolation is still not proven by this change; validate
    Desktop behavior by fully quitting Desktop and relaunching via
    `start-codex-desktop-default.cmd`, `start-codex-desktop-current.cmd`, or
    `start-codex-desktop-previous.cmd`.

## 2026-06-04 Android Back Gesture Opens Sidebar v174

- User report:
  - On iPhone, a right swipe at the top-level page opens the Codex navigation
    menu and a second right swipe while the menu is open does nothing.
  - On Android, the same edge/right-swipe behavior was closing the PWA and
    returning to the system launcher.
- Local implementation:
  - `public/app.js`
    - Bumped `CLIENT_BUILD_ID` to `0.1.11|codex-mobile-shell-v174`.
    - Kept the existing sidebar edge-swipe behavior, widened the Android start
      zone to 84px, and made the sidebar `touchstart` listener non-passive so
      it can call `preventDefault()` when it owns the gesture.
    - Added an Android-only history `popstate` sentinel. When Mobile Web is in
      the logged-in visible app shell on a mobile overlay viewport, a top-level
      Android Back event opens the sidebar instead of letting the PWA close to
      the launcher. If the sidebar is already open, the event is consumed and
      the sentinel is restored.
    - Fixed the first v173 attempt by installing the sentinel from `showApp()`,
      after `state.key` exists and `#app` is visible. Installing it during early
      initialization returned before login and did not protect the Android PWA.
  - `public/sw.js`
    - Bumped shell cache to `codex-mobile-shell-v174`.
  - Tests updated:
    - `test/mobile-viewport.test.js`
    - `test/hermes-plugin-route.test.js`
    - `test/thread-task-card-route.test.js`
  - Documentation updated:
    - `docs/TROUBLESHOOTING.md`
- Validation/runtime:
  - Focused `node --test test\mobile-viewport.test.js
    test\hermes-plugin-route.test.js test\thread-task-card-route.test.js`
    passed 13/13.
  - Full `npm.cmd test` passed 311/311.
  - `npm.cmd run check`, `npm.cmd run check:macos`, and `git diff --check`
    passed; `git diff --check` only emitted Windows LF-to-CRLF working-copy
    warnings.
  - Shared-chain restart completed in the background. Authenticated
    `/api/public-config` now returns
    `clientBuildId=0.1.11|codex-mobile-shell-v174` and
    `shellCacheName=codex-mobile-shell-v174`; 8787 listener PID observed as
    `134204`.
- Status and risk:
  - Local changes are uncommitted.
  - Existing Android PWA clients must accept the refresh prompt or be fully
    closed/reopened so they load v174. A client still running v173 or older
    will not have the fixed `showApp()` sentinel installation.

## 2026-06-04 Web Push Thread Deep-link v172

- User request:
  - Web Push messages must carry the target thread id, and tapping a
    notification must return to the matching thread.
- Local implementation:
  - `server.js`
    - Completed-turn Web Push payloads now include top-level `threadId` and
      `turnId` in addition to `data.threadId`, `data.turnId`, and
      `data.url=/?thread=<thread-id>`.
  - `public/sw.js`
    - Push payload top-level ids are copied into notification data when needed.
    - Notification click target normalizes `data.threadId` into the same-origin
      `thread` query parameter.
    - Cold-start/PWA click opens `target.url` directly instead of always
      opening `/`, so startup URL handling can load the target thread even
      before service-worker `postMessage` is received.
    - Existing focused clients still receive the `codex-open-thread`
      `postMessage` fallback.
    - Shell cache bumped to `codex-mobile-shell-v172`.
  - `public/app.js`
    - `CLIENT_BUILD_ID` bumped to `0.1.11|codex-mobile-shell-v172`.
  - Tests updated:
    - `test/push-notification-service.test.js`
    - `test/mobile-viewport.test.js`
    - `test/thread-task-card-route.test.js`
  - Documentation updated:
    - `docs/ARCHITECTURE.md`
    - `docs/COMPLEX_FEATURE_PATHS.md`
- Validation:
  - `node --check server.js` passed.
  - `node --check public\app.js` passed.
  - `node --check public\sw.js` passed.
  - `node --test test\push-notification-service.test.js
    test\mobile-viewport.test.js test\thread-task-card-route.test.js` passed:
    25/25.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
- Status:
  - Local changes are uncommitted.
  - PWA/browser clients need the v172 shell refresh path, hard refresh, or
    close/reopen before the service worker click behavior is active.
  - Public repo was not touched.

## 2026-06-03 Continuation Context Archive Guard And Current-State Repair v173

- User reports:
  - Finance continuation generated a small source-thread handoff, but active
    Finance `.agent-context/HANDOFF.md` still measured about 108KB and would
    keep inflating future thread context if fully read.
  - Hermes Mobile later updated active context from stale v522/v526-era
    current-state text to v547, showing that compact context could still
    contain stale `Latest Product State` sections and agents could treat old
    preserved state as current.
- Local fixes in this workspace:
  - `adapters/continuation-handoff-compaction-service.js`
    - Added automatic `.agent-context/archive/.gitignore` creation before
      writing full archived context in Git workspaces.
    - `compactWorkspaceHandoff()` now uses the same archive ignore guard and
      returns `archiveDir`, `archiveGit`, and `archiveIgnore` metadata.
    - Compact handoff startup guidance now requires current repo/runtime or
      latest source-thread handoff verification before changing latest-version,
      backup, deployment, or runtime-state facts. Archived old sections are
      provenance only.
  - `test/continuation-handoff-compaction-service.test.js`
    - Covers archive ignore guard creation for workspace-context and
      single-handoff compaction.
    - Covers the new compact handoff current-state guidance.
  - Documentation updated:
    - `docs/CONTEXT_STRATEGY.md`
    - `docs/ARCHITECTURE.md`
    - `docs/MODULES.md`
- Cross-workspace repairs:
  - Finance workspace `C:\Users\xuxin\Documents\财务`
    - Active `.agent-context/HANDOFF.md` compacted from `110667` bytes to
      `18193` bytes.
    - Full old handoff archived at
      `.agent-context/archive/context-compaction-20260603_133744/HANDOFF.full.md`.
    - `.agent-context/archive/.gitignore` was created; `git check-ignore`
      confirmed the full archive payload is ignored.
  - Agent/Hermes workspace `C:\Users\xuxin\Documents\Agent`
    - Active `.agent-context/HANDOFF.md` rewritten to a short current-state
      router around v547, about 6.3KB.
    - `.agent-context/PROJECT_CONTEXT.md` now says latest version/deployment
      facts must be verified from current repo/runtime or source-thread
      handoff; archived old `Latest Product State` sections are provenance
      only.
- Validation:
  - `node --check adapters\continuation-handoff-compaction-service.js` passed.
  - `node --test test\continuation-handoff-compaction-service.test.js
    test\continuation-lineage.test.js` passed: 12/12.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
- Status:
  - Codex Mobile changes were committed locally as
    `207e73f 修复续接上下文归档与版本事实指针 v173`.
  - Finance and Agent context repairs are local context-file changes only; no
    product code was changed in those workspaces by this repair.
  - Public repo was not touched.

## Preserved Recent Handoff Tail

## 2026-06-03 Task-card Command Bypasses Active-turn Steer v167

- User report:
  - Typing the hash task-card command while the Hermes Mobile thread was still
    looking for context did not create a task-card flow.
  - The send path behaved like normal active-turn guidance instead of a
    source-side task-card draft request.
- Diagnosis:
  - `public/app.js` correctly recognized only the exact `#自由协作` prefix after
    the v165 tightening.
  - However, `sendMessage()` computed `steering` from `state.activeTurnId &&
    hasContent` after command recognition, so a valid task-card command could
    still be sent as `turn/steer` to the currently live turn.
- Local fix:
  - `public/app.js`
    - Changed `steering` to require `!threadTaskCardCommand`, so
      `#自由协作` commands always use the task-card draft request path instead
      of active-turn steering.
    - Static shell bumped to `0.1.11|codex-mobile-shell-v167`.
  - `public/sw.js`
    - Cache bumped to `codex-mobile-shell-v167`.
  - `test/thread-task-card-route.test.js`
    - Added a static assertion that `sendMessage()` excludes task-card commands
      from the active-turn steer condition.
  - `test/mobile-viewport.test.js`
    - Updated shell/cache assertions for v167.
- Validation/runtime:
  - `node --check public\app.js` passed.
  - `node --check public\sw.js` passed.
  - Focused `node --test test\thread-task-card-route.test.js
    test\conversation-render.test.js test\mobile-viewport.test.js` passed:
    24/24.
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - Restarted the 8787 Node listener: old PID `91904`, new PID `46484`.
  - `/api/public-config` returns
    `clientBuildId=0.1.11|codex-mobile-shell-v167`,
    `shellCacheName=codex-mobile-shell-v167`, and
    `imageContextMode=reference`.
  - Authenticated `/api/status` is healthy:
    `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`,
    `lastError=null`.
- Status:
  - Local changes are uncommitted.
  - Public repository was not synced.

## 2026-06-03 Continuation Bootstrap Uses Reference-only Index

- User request:
  - Reduce continuation prompt cost by storing full handoff/context in files and
    sending only a short startup index to the new thread.
  - Apply the same principle used for cross-thread cards: do not put large
    payloads into chat when a durable file reference is enough.
  - Keep repository docs in English; use Chinese only in direct replies to the
    user.
- Local implementation:
  - `server.js`
    - Lowered default `CODEX_MOBILE_CONTINUATION_BOOTSTRAP_CHARS` from `52,000`
      to `12,000`.
    - Changed `newThreadBootstrapPromptScoped()` to a reference-only index.
      It now lists the source handoff path, workspace context paths, docs
      entrypoint, lineage index path, source-thread metadata, and runtime
      settings.
    - Startup instructions now require bounded reads for large handoff/context
      files: top metadata plus recent tail first, targeted search next, and full
      reads only when needed.
    - The bootstrap no longer inlines source handoff excerpts, recent
      source-turn summaries, workspace context excerpts, or lineage handoff
      excerpts.
    - Replaced the source handoff generation prompt with English ASCII text to
      avoid recurring Windows mojibake when this path is edited.
  - `test/continuation-lineage.test.js`
    - Updated coverage so continuation bootstrap must use file references for
      handoff/context/lineage and must not contain obvious `????` replacement
      text in the edited prompt bodies.
  - Documentation updated:
    - `docs/CONTEXT_STRATEGY.md`
    - `docs/ARCHITECTURE.md`
    - `docs/COMPLEX_FEATURE_PATHS.md`
- Validation so far:
  - `node --check server.js` passed.
  - Focused `node --test test\continuation-lineage.test.js
    test\continuation-handoff-compaction-service.test.js
    test\new-thread-route.test.js` passed: 20/20.
  - `npm.cmd test` passed: 302/302 before the bounded-read wording update.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - BOM check for touched files had no output.
  - Restarted the 8787 Node listener during smoke: old PID `132060`, new PID
    `84240`.
  - `/api/public-config` returns
    `clientBuildId=0.1.11|codex-mobile-shell-v171`,
    `shellCacheName=codex-mobile-shell-v171`, and
    `imageContextMode=reference`.
  - Authenticated `/api/status` is healthy:
    `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`,
    `lastError=null`, `codexHome=C:\Users\xuxin\.codex-homes\previous`.
  - Real continuation smoke using idle source thread
    `019e8bad-1431-7241-b4b7-e0dc727e082d` completed:
    job `48906b3d-c1b8-4c38-b3c8-273d9af7f886`,
    new thread `019e8d98-a265-7f31-8de8-d3920ee4a954`,
    source handoff chars `7351`, bootstrap chars `3857`.
  - Smoke confirmed the new bootstrap rollout contains
    `Continuation Bootstrap Index`, does not contain the old
    `Source-thread-generated handoff excerpt` heading, and does not inline
    recent source-turn summaries. It also showed that default full reads of
    workspace context can still grow the next thread, which led to the
    bounded-read instruction update above.
- Status:
  - Local changes are uncommitted.
  - Public repository was not synced.
  - Final validation after the bounded-read wording update passed:
    - `node --check server.js`
    - Focused `node --test test\continuation-lineage.test.js
      test\continuation-handoff-compaction-service.test.js
      test\new-thread-route.test.js` passed: 20/20.
    - `npm.cmd run check` passed.
    - `git diff --check` passed with only Windows LF-to-CRLF working-copy
      warnings.
  - Restarted the 8787 Node listener again after the final server.js update:
    old PID `84240`, actual listener PID `5416`.
  - `/api/public-config` still returns
    `clientBuildId=0.1.11|codex-mobile-shell-v171`,
    `shellCacheName=codex-mobile-shell-v171`, and
    `imageContextMode=reference`.
  - Authenticated `/api/status` is healthy:
    `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`,
    `lastError=null`, `codexHome=C:\Users\xuxin\.codex-homes\previous`.
  - Open clients need the v167 refresh prompt, hard refresh, close/reopen, or
    Hermes plugin refresh path before this frontend send-path fix is active.

## 2026-06-03 Autonomous Task-card Return Loop Guard

- User report:
  - An autonomous cross-thread task-card return kept generating another return
    after the return turn completed.
  - The injected card title grew into stacked prefixes such as
    `Auto return: Auto return: Auto return: Auto return: ...`.
- Diagnosis:
  - The earlier auto-return path correctly keyed duplicate returns by original
    card id plus completed target turn id, but a return card still reused the
    autonomous workflow id and could be treated like another completion-return
    source.
  - `injectedMessageText()` advertised Auto-return for every autonomous
    workflow card, regardless of the card's delivery flags.
  - Return titles were generated by blindly prepending `Auto return:` to the
    source card title.
- Local fix:
  - `adapters/thread-task-card-service.js`
    - Added a single-prefix auto-return title helper.
    - Return cards keep `delivery.autoReturnOnCompletion=false`.
    - Injected messages only include the Auto-return promise when
      `delivery.autoReturnOnCompletion===true`.
    - The completion observer ignores cards marked as auto-return receipts, so
      return-card completions cannot ping-pong into more return cards.
  - `test/thread-task-card-service.test.js`
    - Added coverage that the first target completion creates exactly one
      reverse return card, the return card does not create a recursive return,
      injected return messages do not advertise another Auto-return, and stacked
      `Auto return:` prefixes collapse to one prefix.
  - Documentation updated:
    - README
    - `docs/CROSS_THREAD_TASK_CARDS_DESIGN.md`
    - `docs/CROSS_THREAD_TASK_CARDS_IMPLEMENTATION.md`
    - `docs/TROUBLESHOOTING.md`
    - `.agent-context/PROJECT_CONTEXT.md`
- Validation/runtime:
  - `node --check adapters\thread-task-card-service.js` passed.
  - Focused `node --test test\thread-task-card-service.test.js
    test\thread-task-card-harness.test.js test\thread-task-card-route.test.js
    test\conversation-render.test.js` passed: 43/43.
  - `npm.cmd test` passed: 297/297.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - BOM check for touched source/test/docs/context files had no output.
  - Restarted the 8787 Node listener: old PID `46484`, new PID `112608`.
  - `/api/public-config` returns
    `clientBuildId=0.1.11|codex-mobile-shell-v167`,
    `shellCacheName=codex-mobile-shell-v167`, and
    `imageContextMode=reference`.
  - Authenticated `/api/status` is healthy:
    `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`,
    `lastError=null`, `codexHome=C:\Users\xuxin\.codex-homes\previous`.
- Status:
  - Local changes are uncommitted.
  - Public repository was not synced.
  - This is a server-side task-card service fix; no static shell bump was
    required beyond the existing v167 frontend build.

## 2026-06-03 Workspace Context Compaction Design Docs

- User request:
  - After discussing `AGENTS.md`, `.agent-context/PROJECT_CONTEXT.md`, and
    `.agent-context/HANDOFF.md` context size, document a plan to make workspace
    context backup/compaction part of the compression continuation flow.
  - Scope for this step was documentation first, not implementation.
- Current assessment:
  - Current `codex-mobile-web` `AGENTS.md` is only 521 bytes / 15 lines, so it
    is not a meaningful context burden.
  - Hermes Mobile `C:\Users\xuxin\Documents\Agent` after manual compaction has
    `AGENTS.md` about 3.54 KB, `PROJECT_CONTEXT.md` about 9.04 KB, and
    `HANDOFF.md` about 5.51 KB, also acceptable.
  - The higher-value built-in feature is first-class compaction of live
    `.agent-context/PROJECT_CONTEXT.md` and `.agent-context/HANDOFF.md` during
    or before continuation handoff generation.
- Documentation added:
  - `docs/CONTEXT_STRATEGY.md`
    - Added "Workspace Context Compaction Candidate".
    - MVP scope: archive/rewrite only `.agent-context/PROJECT_CONTEXT.md` and
      `.agent-context/HANDOFF.md`.
    - `AGENTS.md` should be diagnosed/reported but not automatically rewritten
      without explicit user approval.
    - Suggested thresholds: single live context file over 50 KB suggests,
      over 100 KB is a strong candidate; combined live pair over 100 KB
      suggests, over 200 KB is a strong candidate.
    - Modes: disabled, suggest-only, auto-compact-above-threshold.
    - Safety rules: archive under
      `.agent-context/archive/context-compaction-<timestamp>/`, verify workspace
      boundary and Git ignore status, do not touch product code or secrets.
    - Compaction report should include before/after bytes and lines, reduction
      percentage, archive/live paths, Git ignore/tracked status, and skip
      reasons.
  - `docs/COMPLEX_FEATURE_PATHS.md`
    - Updated Rollout Continuation implementation path to include workspace
      context compaction ownership, archive-before-rewrite behavior, compact
      routing-index live files, and focused service tests.
  - `docs/README.md`
    - Updated reading guide row so model/context/continuation work includes
      workspace context compaction.
- Status:
  - Documentation only; no product code implementation for workspace context
    compaction yet.
  - Local changes remain uncommitted.
  - Public repository was not synced.

## 2026-06-03 Workspace Context Compaction Implemented

- User request:
  - Implement the discussed safe/on-demand workspace context compaction in the
    compression continuation flow, not just document it.
  - Requirement: full old content must remain recoverable by archive lookup when
    needed; live context should stay small by default.
- Local implementation:
  - `adapters/continuation-handoff-compaction-service.js`
    - Added `compactWorkspaceContext()` as the new continuation compaction
      entry point.
    - It treats `.agent-context/PROJECT_CONTEXT.md` and
      `.agent-context/HANDOFF.md` as a live context pair.
    - It archives full originals under
      `.agent-context/archive/context-compaction-<timestamp>/` with:
      `PROJECT_CONTEXT.full-before-context-budget.md`,
      `HANDOFF.full-before-context-budget.md`, and `MANIFEST.json`.
    - It rewrites live `PROJECT_CONTEXT.md` into a short source-of-truth /
      startup-guidance / archive-pointer routing document.
    - It rewrites live `HANDOFF.md` into the existing compact handoff shape with
      archive pointer and preserved recent tail.
    - It reports before/after bytes and lines, reduction percentage, archive
      paths, live paths, `AGENTS.md` size, and Git ignored/tracked state.
    - It refuses to write full archives when the workspace is a Git checkout and
      the archive path is not ignored, returning `archive-not-ignored`.
    - It keeps legacy `compactWorkspaceHandoff()` exported for compatibility.
  - `server.js`
    - `POST /api/thread-continuations` now calls
      `compactWorkspaceContext()` before source-thread handoff generation.
    - New defaults:
      - `CODEX_MOBILE_CONTINUATION_CONTEXT_FILE_COMPACT_BYTES=100KB`
      - `CODEX_MOBILE_CONTINUATION_CONTEXT_PAIR_COMPACT_BYTES=200KB`
      - `CODEX_MOBILE_CONTINUATION_CONTEXT_COMPACT_PRESERVE_CHARS=18000`
    - Job progress now reports workspace context compaction with archive dir,
      manifest, original/compacted bytes, and reduction percentage.
  - Tests:
    - `test/continuation-handoff-compaction-service.test.js`
      - Added coverage for full project+handoff archive, live rewrite, manifest
        generation, AGENTS size reporting, Git ignored-state reporting, and
        refusing non-ignored archive paths.
      - Existing single-handoff compaction tests remain.
  - Documentation updated:
    - `docs/CONTEXT_STRATEGY.md`
    - `docs/COMPLEX_FEATURE_PATHS.md`
    - `docs/ARCHITECTURE.md`
    - `docs/MODULES.md`
    - `docs/README.md`
    - `.agent-context/PROJECT_CONTEXT.md`
- Validation/runtime:
  - `node --check adapters\continuation-handoff-compaction-service.js` passed.
  - `node --check server.js` passed.
  - Focused `node --test test\continuation-handoff-compaction-service.test.js
    test\continuation-lineage.test.js test\new-thread-route.test.js` passed:
    19/19.
  - `npm.cmd test` passed: 299/299.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - BOM check for touched source/test/docs/context files had no output.
  - Current workspace sizes before this handoff entry:
    `PROJECT_CONTEXT.md=75.08KB`, `HANDOFF.md=180.51KB`, `AGENTS.md=0.51KB`.
    The live pair exceeds the new default pair threshold, so the next
    continuation job in this workspace should trigger workspace context
    archive/rewrite if `.agent-context/archive/...` remains ignored.
  - Confirmed current repo ignores `.agent-context/archive/context-compaction-*`
    through `.gitignore:11:.agent-context/`.
  - Restarted the 8787 Node listener: old PID `112608`, new PID `35208`.
  - `/api/public-config` returns
    `clientBuildId=0.1.11|codex-mobile-shell-v168`,
    `shellCacheName=codex-mobile-shell-v168`, and
    `imageContextMode=reference`.
  - Authenticated `/api/status` is healthy:
    `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`,
    `lastError=null`, `codexHome=C:\Users\xuxin\.codex-homes\previous`.
- Status:
  - Local changes are uncommitted.
  - Public repository was not synced.
  - This is server-side continuation behavior; no additional static shell bump
    was made in this step.

## 2026-06-03 Usage Block Shows Workspace Context Sizes v169

- User request:
  - At the end of each turn, the `Usage` block currently showed rollout size
    only. Add context / handoff information in that same block.
  - If the thresholds indicate risk, show the `压缩续接` action beside the block.
- Local implementation:
  - `server.js`
    - Added workspace context size collection for the current thread cwd:
      `.agent-context/PROJECT_CONTEXT.md`, `.agent-context/HANDOFF.md`, and
      `AGENTS.md`.
    - Passes those sizes plus the context-compaction thresholds into
      `attachTurnUsageSummaries()`.
    - Restored the Hermes embed build-change path to call
      `requestHermesPluginRefresh("server_build_changed", { force: true })`
      instead of only showing a standalone page-refresh prompt.
  - `adapters/turn-usage-summary-service.js`
    - Added `projectContextSizeBytes`, `handoffSizeBytes`, `agentsSizeBytes`,
      `workspaceContextPairSizeBytes`, and threshold fields to
      `mobileUsageSummary`.
  - `public/app.js`
    - Completed-turn Usage cards now render `context` and `handoff` metrics
      next to rollout/token metrics.
    - If rollout size, either live context file, or the live context pair crosses
      the configured threshold, the Usage card shows a compact `压缩续接` button.
    - `bindCurrentThreadActions()` now binds all
      `[data-new-thread-from-current]` buttons so both the top warning and Usage
      block action use the same continuation route.
    - Static shell build bumped to `0.1.11|codex-mobile-shell-v169`.
  - `public/styles.css`
    - Added compact Usage-card action styling.
  - `public/sw.js`
    - Shell cache bumped to `codex-mobile-shell-v169`.
  - Tests/docs:
    - `test/turn-usage-summary-service.test.js` covers propagated workspace
      context sizes.
    - `test/conversation-render.test.js` covers rendering context/handoff sizes
      and the compact continuation action.
    - `test/mobile-viewport.test.js` updated to v169.
    - Documentation updated in `docs/CONTEXT_STRATEGY.md`,
      `docs/ARCHITECTURE.md`, and `.agent-context/PROJECT_CONTEXT.md`.
- Validation/runtime:
  - `node --check adapters\turn-usage-summary-service.js` passed.
  - `node --check server.js` passed.
  - `node --check public\app.js` passed.
  - Focused `node --test test\hermes-plugin-route.test.js
    test\turn-usage-summary-service.test.js test\conversation-render.test.js
    test\mobile-viewport.test.js` passed: 33/33.
  - `npm.cmd test` passed: 300/300.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - BOM check for touched source/test/docs/context files had no output.
  - Restarted the 8787 Node listener: old PID `5228`, new PID `26168`.
  - `/api/public-config` returns
    `clientBuildId=0.1.11|codex-mobile-shell-v169`,
    `shellCacheName=codex-mobile-shell-v169`, and
    `imageContextMode=reference`.
  - Authenticated `/api/status` is healthy:
    `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`,
    `lastError=null`, `codexHome=C:\Users\xuxin\.codex-homes\previous`.
- Status:
  - Local changes are uncommitted.
  - Public repository was not synced.
  - Open clients need the v169 refresh prompt, hard refresh, close/reopen, or
    Hermes plugin refresh path to see the new Usage-card metrics/action.

## 2026-06-03 Hermes Topic Tab Avoids Server-only Iframe Refresh v170

- User report:
  - After entering the Hermes plugin, tapping the host bottom Topic tab caused a
    brief refresh/flash from an older or default iframe page into the current
    page.
- Diagnosis:
  - `pageshow` / `focus` in `public/app.js` run a build check when the iframe is
    foregrounded.
  - The v169 embed branch requested `codex-mobile.plugin.refresh_required` for
    either client shell changes or server asset `buildId` changes.
  - A server-only asset build difference can occur after listener restart and
    does not require reloading the Hermes iframe, so the host tab action could
    trigger an unnecessary short reload.
- Local fix:
  - `public/app.js`
    - In Hermes embed mode, `checkPageRefreshAvailability()` now requests host
      refresh only when `clientBuildId` / shell build changes.
    - Server-only asset `buildId` drift is recorded in
      `state.serverAssetBuildId` without calling `requestHermesPluginRefresh()`.
    - Static shell bumped to `0.1.11|codex-mobile-shell-v170`.
  - `public/sw.js`
    - Cache bumped to `codex-mobile-shell-v170`.
  - Tests updated:
    - `test/hermes-plugin-route.test.js`
    - `test/app-update.test.js`
    - `test/mobile-viewport.test.js`
    - `test/thread-task-card-route.test.js`
  - Documentation updated:
    - `docs/ARCHITECTURE.md`
    - `docs/TROUBLESHOOTING.md`
- Status:
  - Validation passed:
    - `node --check public\app.js`
    - `node --check public\sw.js`
    - Focused `node --test test\hermes-plugin-route.test.js
      test\app-update.test.js test\mobile-viewport.test.js
      test\thread-task-card-route.test.js` passed: 18/18.
    - `npm.cmd test` passed: 300/300.
    - `npm.cmd run check` passed.
    - `npm.cmd run check:macos` passed.
    - `git diff --check` passed with only Windows LF-to-CRLF working-copy
      warnings.
    - BOM check for touched source/test/docs/context files had no output.
  - Restarted the 8787 Node listener: old PID `26168`, new PID `94928`.
  - `/api/public-config` returns
    `clientBuildId=0.1.11|codex-mobile-shell-v170`,
    `shellCacheName=codex-mobile-shell-v170`, and
    `imageContextMode=reference`.
  - Authenticated `/api/status` is healthy:
    `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`,
    `lastError=null`, `codexHome=C:\Users\xuxin\.codex-homes\previous`.
  - Local changes remain uncommitted.
  - Public repository was not synced.
  - Open Hermes plugin clients need the v170 host refresh, hard refresh, or
    close/reopen once before the Topic-tab flash fix is active.

## 2026-06-03 Handoff Usage Prompt Raised To 200KB v171

- User report:
  - After running compression continuation in other workspaces, compacted
    handoffs could still sit near 100KB and immediately show another
    `压缩续接` prompt.
- Local fix:
  - `server.js`
    - Added `CODEX_MOBILE_CONTINUATION_CONTEXT_HANDOFF_PROMPT_BYTES`, default
      `200 KB`.
    - Usage summaries now include `workspaceHandoffPromptThresholdBytes`.
  - `adapters/turn-usage-summary-service.js`
    - Propagates the separate handoff prompt threshold into
      `mobileUsageSummary`.
  - `public/app.js`
    - Uses the 200KB handoff prompt threshold for `HANDOFF.md` single-file
      risk while keeping `PROJECT_CONTEXT.md` on the existing 100KB file
      threshold and keeping the pair threshold unchanged.
    - Static shell bumped to `0.1.11|codex-mobile-shell-v171`.
  - `public/sw.js`
    - Cache bumped to `codex-mobile-shell-v171`.
  - Tests/docs updated:
    - `test/conversation-render.test.js`
    - `test/turn-usage-summary-service.test.js`
    - `test/mobile-viewport.test.js`
    - `test/thread-task-card-route.test.js`
    - `docs/CONTEXT_STRATEGY.md`
    - `docs/ARCHITECTURE.md`
- Status:
  - Validation passed:
    - `node --check server.js`
    - `node --check adapters\turn-usage-summary-service.js`
    - `node --check public\app.js`
    - `node --check public\sw.js`
    - Focused `node --test test\turn-usage-summary-service.test.js
      test\conversation-render.test.js test\mobile-viewport.test.js
      test\thread-task-card-route.test.js` passed: 34/34.
    - `npm.cmd test` passed: 301/301.
    - `npm.cmd run check` passed.
    - `npm.cmd run check:macos` passed.
    - `git diff --check` passed with only Windows LF-to-CRLF working-copy
      warnings.
    - BOM check for touched source/test/docs/context files had no output.
  - Local changes are uncommitted.
  - Public repository was not synced.

## 2026-06-04 Profile Switch Quota Runtime Repair

- User report:
  - After switching accounts and completing another turn, visible quota did not
    update to the switched account.
- Diagnosis:
  - `%USERPROFILE%\.codex-mobile-web\codex-profiles.json` had
    `activeProfileId=default` and active `codexHome=C:\Users\xuxin\.codex`.
  - The live 8787 Node listener was still a manually-started
    `"node.exe" server.js` process inherited from a shell with
    `CODEX_HOME=C:\Users\xuxin\.codex-homes\previous`.
  - Because `server.js` gives `process.env.CODEX_HOME` precedence over the
    profile store, `/api/status.codexHome` remained
    `C:\Users\xuxin\.codex-homes\previous`; the completed turn and live quota
    snapshot were therefore still on the previous profile chain.
- Runtime repair:
  - Ran `restart-codex-mobile-shared-chain.ps1 -ProfileId default`, then stopped
    the lingering manual 8787 listener PID after confirming it was
    `node.exe server.js`.
  - The scheduled task/windowless launcher took over 8787 as PID `133084` with
    absolute command line
    `C:\Users\xuxin\Documents\codex-mobile-web\server.js`.
- Verified current state:
  - Authenticated `/api/status` now reports `ready=true`,
    `transport=external-jsonl-tcp`, `sharedRequired=true`, and
    `codexHome=C:\Users\xuxin\.codex`.
  - Profile store active profile remains `default`.
- Operational rule:
  - After account/profile switches, do not restart production 8787 with a bare
    `node server.js` from an arbitrary shell. Use the profile-aware scheduled
    task/windowless launcher or `/api/restart/shared-chain` so the active
    profile store controls `CODEX_HOME`.

## 2026-06-04 Profile Switch Guard Fix

- User concern:
  - Profile switching must not silently remain on the previous account, because
    the user cannot reliably detect that quota and turns are still attached to
    the wrong account.
- Code fix:
  - `adapters/codex-profile-service.js`
    - Added `resolveEffectiveCodexHome()`.
    - When the active profile store has a selected home, it now wins over a
      stale inherited shell `CODEX_HOME`.
    - Explicit env override is still possible only with
      `CODEX_MOBILE_CODEX_HOME_OVERRIDE=1` or
      `CODEX_MOBILE_ALLOW_CODEX_HOME_OVERRIDE=1`.
  - `server.js`
    - Uses `resolveEffectiveCodexHome()` for bootstrap `CODEX_HOME`.
    - `/api/status` now exposes `codexHomeSource`,
      `codexHomeEnvIgnored`, and `codexProfileActiveId` for diagnostics.
  - `restart-codex-mobile-shared-chain.ps1`
    - Adds selected-port listener PID discovery.
    - Stops stale `node.exe ... server.js` listeners on that port even if the
      command line was bare `node server.js` and lacks the absolute server path.
- Docs/tests:
  - Updated `docs/ARCHITECTURE.md`, `docs/MULTI_ACCOUNT_CODEX_CLI.md`, and
    `docs/TROUBLESHOOTING.md`.
  - Added regression tests in `test/codex-profile-service.test.js` and
    `test/manual-restart-ui.test.js`.
- Validation so far:
  - `node --check server.js` passed.
  - `node --check adapters\codex-profile-service.js` passed.
  - `node --test test\codex-profile-service.test.js test\manual-restart-ui.test.js`
    passed: 13/13 after rerunning with shell permission for Node test runner
    child processes.
  - Focused profile/UI/restart/mobile viewport tests passed: 23/23.
  - `npm.cmd test` passed: 307/307.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
- Status:
  - Changes are uncommitted.

## 2026-06-04 Thread List Title And Timestamp Refresh v176

- User report:
  - After profile/MUX sharing, threads became visible across accounts, but some
    rows still showed temporary UUID-like names and stale sidebar timestamps.
    Some threads could interact normally while their list time did not update.
- Diagnosis:
  - Authenticated `/api/threads` returned the current codex-mobile-web thread
    with stale `updatedAt` from 2026-06-01, while direct state DB evidence for
    the same id showed `updated_at=2026-06-04 20:32:30`.
  - `mergeThreadListFallback()` discarded duplicate fallback rows, so newer
    state DB / rollout fallback display data could not hydrate an app-server row
    with stale title/time.
  - `mergeThreadStateFromStateDb()` did not merge `title`,
    `first_user_message`, `cwd`, or `updated_at` into app-server rows.
  - Existing-thread sends refreshed current detail and live polling but did not
    silently refresh the sidebar thread list.
- Local fix:
  - `server.js`
    - Duplicate fallback rows now merge into existing app-server rows.
    - Display fields can hydrate stale/missing names/previews/cwd.
    - The newest `updatedAt` wins when app-server and fallback disagree.
    - State DB row enrichment now includes title, first user message, cwd, and
      updated timestamp.
  - `public/app.js`
    - Existing-thread message send success now triggers
      `loadThreads({ silent: true })` after scheduling current-thread refresh.
    - Static shell bumped to `0.1.11|codex-mobile-shell-v176`.
  - `public/sw.js`
    - Shell cache bumped to `codex-mobile-shell-v176`.
  - Tests/docs:
    - Added/updated coverage in `test/thread-visibility.test.js`,
      `test/thread-title-source.test.js`, `test/new-thread-route.test.js`, and
      `test/mobile-viewport.test.js`.
    - Updated `docs/ARCHITECTURE.md` and `docs/TROUBLESHOOTING.md`.
- Validation:
  - `node --check server.js` passed.
  - `node --check public\app.js` passed.
  - `node --check public\sw.js` passed.
  - Focused `node --test test\thread-visibility.test.js
    test\thread-title-source.test.js test\new-thread-route.test.js
    test\mobile-viewport.test.js` passed: 25/25.
  - `npm.cmd test` passed: 313/313.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
- Status:
  - `systemError` on the separate `Codex Mobile 06-03` thread was intentionally
    not changed in this fix.
  - Changes are uncommitted.

## 2026-06-04 Running Thread Indicator Refresh v177

- User report:
  - Thread names and update times recovered, but working threads no longer
    showed the prior running/refresh indicator in the thread list.
- Diagnosis:
  - Runtime `/api/threads` rows can still report `status.type=notLoaded` even
    when the thread is active and interactive.
  - `reconcileThreadStatusHints()` cleared browser-local `runningThreadIds`
    whenever a refreshed list row was not running, so a silent list refresh could
    erase the running hint from an active thread.
  - `statusIconInfo()` did not consult `runningThreadIds`, so preserved hints
    could not render the running indicator.
  - Current-thread `turn/started` / `turn/completed` notifications updated
    detail state but did not explicitly write the sidebar row status or schedule
    a sidebar repaint.
- Local fix:
  - `public/app.js`
    - `notLoaded` list rows no longer clear known running hints; only terminal
      statuses clear them.
    - Sidebar/home status icons now render from `runningThreadIds` when the row
      status itself is not running.
    - Current-thread `turn/started` writes `{ type: "active" }` to the matching
      thread row, updates running hints, and schedules thread-list repaint.
    - Current-thread `turn/completed` writes a terminal status, updates hints,
      and schedules thread-list repaint.
    - Static shell bumped to `0.1.11|codex-mobile-shell-v177`.
  - `public/sw.js`
    - Shell cache bumped to `codex-mobile-shell-v177`.
  - Tests/docs:
    - Added coverage in `test/conversation-render.test.js`.
    - Updated `test/mobile-viewport.test.js` and
      `test/thread-task-card-route.test.js` for v177.
    - Updated `docs/ARCHITECTURE.md` and `docs/TROUBLESHOOTING.md`.
- Validation:
  - `node --check public\app.js` passed.
  - `node --check public\sw.js` passed.
  - Focused `node --test test\conversation-render.test.js
    test\mobile-viewport.test.js test\thread-task-card-route.test.js` passed:
    28/28.
  - `npm.cmd test` passed: 314/314.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
- Status:
  - `systemError` on the separate `Codex Mobile 06-03` thread remains outside
    this fix.
  - Changes are uncommitted.

## 2026-06-05 Continuation Title Fallback Persistence

- User report:
  - A fresh Finance/Bookkeeping continuation created thread
    `019e936c-d163-75b3-adf4-d5ae69e46936`, but after refresh the thread list
    showed no normal title: API fallback row had `name=null` and preview equal
    to the thread id.
- Diagnosis:
  - The rollout exists under the active `.codex\sessions` tree and was created
    by `codex-mobile-web`.
  - The continuation bootstrap metadata correctly identified the source thread
    as `019e8dac-65e3-78f2-80b3-b9026928f3f5` with source title
    `记账 06-03`.
  - The new thread had no active `%CODEX_HOME%\session_index.jsonl` entry, so
    when app-server title rename was unavailable or lost after restart,
    Mobile Web fallback reconstruction had no durable display name and fell
    back to the thread id.
  - The workspace-local lineage index is in the target Finance workspace, not
    the Codex Mobile Web repo.
- Local fix:
  - `server.js`
    - Continuation title derivation now reselects the source title after
      reading the source snapshot, preferring app-server/source-summary display
      name before frontend-supplied fallback title.
    - Continuation creation now appends the computed title to
      `%CODEX_HOME%\session_index.jsonl` immediately after `thread/start`, so
      fallback list reads can recover the title even when app-server rename RPCs
      are unsupported or not persisted.
    - Successful manual thread rename also appends the new title to the same
      fallback index.
    - Manual thread rename now treats
      `thread metadata unavailable before name update` as recoverable: Mobile
      persists the requested title to the fallback index, updates the short-lived
      summary cache, and returns HTTP 200 with `titleUpdated=false` and
      `titleIndexed=true`.
  - Runtime repair:
    - Appended a minimal active `.codex\session_index.jsonl` entry for
      `019e936c-d163-75b3-adf4-d5ae69e46936` with title
      `记账 06-03 06-05`.
    - After the screenshot-confirmed manual rename failure, called the rename
      API for the same thread with title `记账 06-05`; it returned HTTP 200,
      `titleUpdated=false`, and `titleIndexed=true`.
    - Authenticated `/api/threads?limit=200` now returns that thread with the
      fallback title `记账 06-05`. PowerShell may display the Chinese text as
      mojibake due to console encoding, but the index entry was written as
      UTF-8 JSON.
  - Documentation/tests:
    - Updated `docs/COMPLEX_FEATURE_PATHS.md` and `docs/TROUBLESHOOTING.md`.
    - Added coverage in `test/new-thread-route.test.js`.
- Validation:
  - `node --check server.js` passed.
  - Focused `node --test test\new-thread-route.test.js
    test\continuation-lineage.test.js test\thread-title-source.test.js`
    passed after the continuation-title fallback: 21/21.
  - Focused `node --test test\new-thread-route.test.js
    test\continuation-lineage.test.js test\thread-title-source.test.js`
    passed after the manual-rename fallback: 22/22.
  - `npm.cmd test` passed: 325/325.
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - Restarted the 8787 listener to activate the server fixes:
    old PID `136648`, new PID `133444`; after the manual-rename fallback,
    old PID `133444`, new PID `133608`.
  - Post-restart `/api/public-config` returns
    `clientBuildId=0.1.11|codex-mobile-shell-v180` and
    `shellCacheName=codex-mobile-shell-v180`.
  - Post-restart `/api/status` is healthy:
    `ready=true`, `transport=external-jsonl-tcp`, `lastError=null`.
  - Latest post-restart `/api/threads?limit=200` returns thread
    `019e936c-d163-75b3-adf4-d5ae69e46936` with the restored fallback title
    `记账 06-05`.
- Status:
  - The 8787 listener has been restarted; future continuation title fallback
    persistence is active in the running service.
  - Changes are uncommitted.

## 2026-06-05 Running Thread Indicator Stale-Hint Expiry v181

- User report:
  - The current Codex Mobile task had ended, but the thread list still showed
    the running/refresh indicator for that thread.
- Diagnosis:
  - v177 correctly stopped plain `notLoaded` list rows from immediately clearing
    `runningThreadIds`, because app-server list rows can say `notLoaded` while a
    thread is genuinely active.
  - That fix had no stale fallback. If the `turn/completed` event was missed or
    an old page kept a browser-local running hint, repeated `notLoaded` list
    refreshes could keep the spinner forever.
- Local fix:
  - `public/app.js`
    - Added `codexMobileRunningThreadHintedAtById` timestamps beside the
      existing `codexMobileRunningThreadIds` set.
    - Running hints are timestamped on running status / `turn/started`.
    - Terminal statuses still clear the hint immediately.
    - If a row remains non-running/non-terminal, such as `notLoaded`, and the
      current thread has no active turn, the browser clears the local running
      hint after the bounded stale window instead of keeping a permanent
      spinner.
    - Static shell bumped to `0.1.11|codex-mobile-shell-v181`.
  - `public/sw.js`
    - Shell cache bumped to `codex-mobile-shell-v181`.
  - Documentation/tests:
    - Updated README, `docs/ARCHITECTURE.md`, `docs/TROUBLESHOOTING.md`, and
      `test/conversation-render.test.js`.
    - Updated v181 shell assertions in `test/mobile-viewport.test.js`,
      `test/thread-goal-service.test.js`, and
      `test/thread-task-card-route.test.js`.
- Validation:
  - `node --check public\app.js` and `node --check public\sw.js` passed.
  - Focused `node --test test\conversation-render.test.js
    test\mobile-viewport.test.js test\thread-task-card-route.test.js
    test\thread-goal-service.test.js` passed: 35/35.
  - `npm.cmd test` passed: 326/326.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - Restarted the 8787 listener to expose v181:
    old PID `133608`, new PID `137312`.
  - Post-restart `/api/public-config` returns
    `clientBuildId=0.1.11|codex-mobile-shell-v181` and
    `shellCacheName=codex-mobile-shell-v181`.
  - Post-restart `/api/status` is healthy:
    `ready=true`, `transport=external-jsonl-tcp`, `lastError=null`.
- Status:
  - Frontend/PWA clients must load v181 through the page refresh prompt, hard
    refresh, or close/reopen before stale running hints can be cleared.
  - Changes are uncommitted.

## 2026-06-05 Large Rollout Live Operation Rehydration

- User report:
  - A revived `Hermes 06-05` goal thread streamed many cards while open, but
    after leaving the thread and entering it again, many visible cards
    disappeared.
- Diagnosis:
  - The raw rollout still contained the live-turn events. The disappearance was
    a server rehydration/compaction issue, not model output loss.
  - Large thread detail can use `large-rollout-turns-list`; the previous
    `compactThread` path kept at most one operational card for the latest live
    turn, and separate turns-list compaction dropped operation cards entirely.
- Local fix:
  - `server.js`
    - Added bounded `CODEX_MOBILE_LIVE_OPERATION_ITEMS` support, defaulting to
      12 recent live operation cards.
    - Added raw-rollout recent-operation rehydration for the latest live turn.
    - Merges by `callId` where possible, updates existing status/timestamps,
      falls back to command/tool/file signatures when `callId` is absent, and
      only reads operations from the matching live turn id.
    - Completed turns remain compact and do not reopen full operation history.
  - `test/thread-item-timestamp-enrichment.test.js`
    - Added regression coverage for a live turn whose server turn object only
      has user/agent messages while rollout contains several recent operations.
  - `docs/TROUBLESHOOTING.md`
    - Added an active-goal large-rollout disappearance section.
- Validation:
  - `node --check server.js` passed.
  - `node --test test\thread-item-timestamp-enrichment.test.js` passed: 10/10.
- Status:
  - Listener was not restarted in this pass because the user had an active goal
    running in the affected thread. The fix is local until the app-server is
    restarted.

## 2026-06-06 Mac Shared-Profile Live Quota Isolation

- User report:
  - Mac production Codex Mobile was using the `previous` profile account
    `2261065@qq.com`, matching Mac Codex Desktop, but the quota display still
    matched the Windows/default account.
- Diagnosis:
  - Mac `/api/public-config` before the fix showed active profile `previous`
    with auth email `2261065@qq.com`, but top-level quota was still populated
    with the same reset windows as Windows.
  - v192 skipped shared rollout quota, but still trusted source-less live
    `account/rateLimits/updated` snapshots. Those notifications do not carry
    an account id, so they are unsafe when a non-default profile shares
    `sessions/`, `archived_sessions/`, and `state_5.sqlite` with the default
    `.codex` home.
- Local fix:
  - `server.js`
    - Added `canExposeRateLimitsForActiveHome()`.
    - `recordRateLimits()` now ignores and clears source-less live quota when
      the active `CODEX_HOME` is not account-scoped.
    - `activeRateLimits()`, `activeRateLimitsByModelMap()`, and
      `liveQuotaSnapshotForProfiles()` return empty quota for shared-profile
      homes rather than exposing an unverified account snapshot.
  - `adapters/codex-profile-service.js`
    - Stored `active-live` quota snapshots are reusable only for account-scoped
      profile homes.
    - A shared-profile active home now deletes stale stored `active-live`
      snapshots instead of reusing them.
  - Tests/docs:
    - Added `test/codex-profile-service.test.js` coverage for shared profile
      homes not persisting or reusing active live quota snapshots.
    - Updated `test/new-thread-route.test.js`, README, `docs/ARCHITECTURE.md`,
      and `docs/TROUBLESHOOTING.md`.
- Validation:
  - Local `node --check server.js` and
    `node --check adapters\codex-profile-service.js` passed.
  - Local focused `node --test test\codex-profile-service.test.js
    test\codex-profile-ui.test.js test\new-thread-route.test.js` passed: 32/32.
  - Local `git diff --check` passed with only expected Windows LF-to-CRLF
    working-copy warnings.
  - Mac active production directory:
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Mac backup:
    `/Users/xuxin/.codex-mobile-web/source-backup-before-shared-live-quota-20260606_103741`.
  - Deployed `server.js`, `adapters/codex-profile-service.js`,
    `test/codex-profile-service.test.js`, `test/new-thread-route.test.js`,
    README, `docs/ARCHITECTURE.md`, and `docs/TROUBLESHOOTING.md` to the Mac
    active production directory.
  - Remote syntax and focused tests passed on Mac with
    `/Users/hermes-host/HermesMobile/runtime/node-current/bin/node`: 32/32.
  - Restarted the Mac 8787 listener by killing PID `69106`; LaunchDaemon
    KeepAlive started PID `96771`, with app-server child PID `96782`.
  - Post-restart Mac `/api/public-config` showed active profile `previous`,
    auth email `2261065@qq.com`, `topQuota=false`, `topModels=0`,
    `activeQuota=false`, and `activeQuotaSource=null`.
  - `%HOME%/.codex-mobile-web/codex-profiles.json` on Mac now has
    `activeProfileId=previous` and `quotaSnapshotKeys=["default"]`; the stale
    `previous` active-live snapshot was removed.
  - Mac EADDRINUSE count stayed at `563`; no new port split-brain was observed.
- Status:
  - This intentionally suppresses quota for the active Mac `previous` profile
    while that profile shares thread state with the default `.codex` home and
    app-server quota notifications remain source-less.
  - Open iPhone/PWA clients should receive EventSource `status` with
    `rateLimits=null` and clear local quota cache; if the visible chip remains
    stale, close/reopen or refresh the Mac-hosted Web App once.

## 2026-06-07 Mac Production Codex Plugin Loopback Binding

- User request:
  - Mac production Codex Mobile should stop exposing the Codex plugin listener
    on the LAN. The phone does not need to visit `8787` directly; it should
    access Codex Mobile through the Hermes embedded-plugin proxy.
  - The user also observed that Mac Codex Mobile active profile was
    `2261065@qq.com`, while directly opening Codex Desktop showed another
    account.
- Diagnosis:
  - `192.168.10.110` was reachable over SSH through the `macstudio-110` alias.
  - `/Library/LaunchDaemons/com.hermesmobile.plugin.codex-mobile.plist` ran
    Codex Mobile as user `xuxin` and had:
    - `CODEX_MOBILE_HOST=0.0.0.0`
    - `CODEX_MOBILE_HERMES_PLUGIN_BASE_URL=http://192.168.10.110:8787`
    - `CODEX_MOBILE_HERMES_PLUGIN_NOTIFICATION_BASE_URL=http://192.168.10.110:8797`
  - `lsof` showed `node ... TCP *:8787 (LISTEN)`.
  - Hermes host code already supports same-origin plugin proxying, and the
    active host manifest can rewrite the Codex plugin entry to
    `/api/hermes-plugins/codex-mobile/proxy/...` when the upstream manifest is
    `http://127.0.0.1:8787`.
  - `/api/codex-profiles` on Mac showed active profile `previous`,
    active home `/Users/xuxin/.codex-homes/previous`, and safe auth label
    `2261065@qq.com`. This confirms Mobile was using the requested CLI profile.
    Direct Codex Desktop account state is not isolated by `CODEX_HOME` alone;
    use the shared Desktop launcher path when Desktop must match Mobile.
- Operational changes:
  - Backed up the system plist before each edit:
    - `/Library/LaunchDaemons/com.hermesmobile.plugin.codex-mobile.plist.bak-20260607_072038`
    - `/Library/LaunchDaemons/com.hermesmobile.plugin.codex-mobile.plist.bak-20260607_072209`
    - `/Library/LaunchDaemons/com.hermesmobile.plugin.codex-mobile.plist.bak-20260607_072350`
  - Updated `/Library/LaunchDaemons/com.hermesmobile.plugin.codex-mobile.plist`:
    - `CODEX_MOBILE_HOST=127.0.0.1`
    - `CODEX_MOBILE_HERMES_PLUGIN_BASE_URL=http://127.0.0.1:8787`
    - `CODEX_MOBILE_HERMES_PLUGIN_NOTIFICATION_BASE_URL=http://127.0.0.1:8797`
    - `CODEX_MOBILE_HERMES_PLUGIN_NOTIFICATION_KEY_FILE` points at the
      server-side HermesMobile secrets directory for the `xuxin` runtime user.
  - Kept `CODEX_MOBILE_HERMES_PLUGIN_FRAME_ORIGINS` with the Hermes LAN and
    HTTPS origins, because those are iframe ancestor origins for the Hermes
    host, not the Codex `8787` listener.
  - Restarted `com.hermesmobile.plugin.codex-mobile` with `launchctl`; final
    listener PID was `77618`.
- Validation:
  - `lsof -nP -iTCP:8787 -sTCP:LISTEN` showed
    `TCP 127.0.0.1:8787 (LISTEN)`.
  - `curl http://127.0.0.1:8787/api/public-config` succeeded.
  - `curl http://192.168.10.110:8787/api/public-config` was blocked.
  - Codex plugin manifest now reports:
    - `entry.url=http://127.0.0.1:8787/?embed=hermes`
    - `program_api.base_url=http://127.0.0.1:8787`
  - Hermes host manifest now reports:
    - `entry.url=/api/hermes-plugins/codex-mobile/proxy/?embed=hermes&...&workspaceId=owner`
    - `entry.proxiedFromOrigin=http://127.0.0.1:8787`
  - Fetching the Hermes proxy entry returned HTTP 200 with `text/html`.
  - `/api/public-config.hermesPlugin.notificationDelegateConfigured` is now
    `true`.
- Status:
  - The Mac phone/plugin path should now be Hermes host -> same-origin proxy ->
    local Codex `127.0.0.1:8787`; the phone should not directly reach
    `192.168.10.110:8787`.
  - If Desktop must share the same Mac account/profile as Mobile, direct
    Dock/app launch is not enough; use the shared macOS Desktop launcher path
    and the selected `CODEX_HOME`/mux endpoint.

## 2026-06-07 App-shell Refresh Loop Harness v204

- User reported that after Mac-side Codex Mobile updates, the Windows-hosted
  Codex Mobile client repeatedly prompted to refresh the client.
- Diagnosis:
  - Windows `GET /api/public-config` was still the listener startup snapshot:
    `clientBuildId=0.1.11|codex-mobile-shell-v201` and
    `shellCacheName=codex-mobile-shell-v201`.
  - The same Windows listener was already serving the edited disk `app.js`
    containing `codex-mobile-shell-v204`.
  - This old-process/new-static deployment middle state made the old frontend
    treat every check as a recoverable client-build mismatch, so refresh could
    reload the page without fixing the process snapshot.
- Implemented:
  - Added `public/build-refresh-policy.js`, a pure browser/Node helper for
    comparing `codex-mobile-shell-vNNN` direction.
  - `public/app.js` now prompts/asks Hermes for refresh only when the server
    shell is newer than the loaded client, or when non-comparable build ids
    conservatively differ. If the loaded client is newer than
    `/api/public-config`, it treats that as a listener-restart requirement and
    does not create a visible refresh loop.
  - Added `test/build-refresh-policy.test.js` harness coverage for:
    server-newer prompts, client-newer suppression, and non-comparable
    conservative prompting.
  - Added the new helper to `index.html`, `public/sw.js`,
    `public/app.js` app-shell assets, `server.js` `appShellBuildId()`, and
    `package.json` `npm run check`.
  - Static shell advanced to
    `0.1.11|codex-mobile-shell-v204` / `codex-mobile-shell-v204`.
  - README and docs updated in `docs/ARCHITECTURE.md`,
    `docs/MODULES.md`, and `docs/TROUBLESHOOTING.md`.
- Validation:
  - `node --check public\build-refresh-policy.js public\app.js public\sw.js
    server.js` passed.
  - Focused tests passed:
    `node --test test\build-refresh-policy.test.js test\app-update.test.js
    test\mobile-viewport.test.js test\thread-goal-service.test.js
    test\thread-task-card-route.test.js test\hermes-plugin-route.test.js`.
  - `npm.cmd run check` passed.
  - `npm.cmd test` passed with 356 tests.
  - `git diff --check` passed with only Windows LF/CRLF working-tree warnings.
  - UTF-8 BOM checks for edited source/docs/tests showed no BOM.
- Runtime:
  - Restarted the Windows listener by stopping PID `24704` and starting the
    `Codex Mobile Web` scheduled task.
  - Current Windows listener PID is `27924`.
  - `GET http://127.0.0.1:8787/api/public-config` now reports
    `clientBuildId=0.1.11|codex-mobile-shell-v204`,
    `shellCacheName=codex-mobile-shell-v204`, `platform=win32`.
  - Served `/app.js`, `/sw.js`, and `/build-refresh-policy.js` all contain the
    v204 policy and do not contain the old v201 shell marker.
- Mac production:
  - This v204 harness turn did not redeploy Mac production static files. The
    Mac plugin may still be on the previously deployed v203 EventSource
    fallback build until explicitly synced/deployed.

## 2026-06-07 Completion Receipt Anchor and Usage Projection v210

- User reported that after a long completed receipt, the up-arrow anchor was
  missing and one turn showed Usage while the expected final receipt above it
  was absent.
- Diagnosis:
  - Compared both derived projection cache and raw rollout for thread
    `019e8050-5a2d-7da3-9307-a3ca7148a016`.
  - Problem turn `019ea133-19d6-7683-a380-a688365bf60d` was `interrupted`.
  - Projection cache had stale `turnUsageSummary`; raw rollout lines
    `24152..24576` had `task_started=1`, `task_complete=0`, `token_count=48`,
    assistant messages with max text length 216, and no long final receipt.
  - Root cause for this case was not projection dropping a long receipt: the
    raw source never wrote a completed final receipt, while stale Usage made the
    interrupted turn look complete.
- Implemented:
  - Static shell advanced to
    `0.1.11|codex-mobile-shell-v210` / `codex-mobile-shell-v210`.
  - Projection completion patches now merge into existing items instead of
    replacing streamed receipts with shorter completion payloads.
  - Projection and client item merges now dedupe `turnUsageSummary`, preserving
    one Usage summary per turn.
  - Usage summaries are attached only to successfully completed-like turn
    statuses; interrupted, failed, cancelled, active, pending, and in-progress
    turns do not render Usage even when raw token_count exists.
  - Completion of a long receipt creates a reply-start anchor automatically.
    The down-arrow no longer clears that anchor, so after jumping to bottom the
    user can still jump back to the completed receipt start.
- Validation:
  - `node --check` passed for edited browser/service files.
  - Focused Node tests passed for scroll controls, projection merge,
    conversation render, viewport/build id, goal route, task card route, and
    Usage summary service.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `npm.cmd test` passed with 364 tests.
  - `git diff --check` passed with only expected Windows LF/CRLF working-tree
    warnings.
  - UTF-8 BOM checks for edited files showed no BOM.
- Runtime:
  - Removed only derived projection cache file
    `%USERPROFILE%\.codex-mobile-web\thread-detail-projections\95243c8a34648c4fbc52581c7e3c9446.json`
    after verifying it was inside the projection cache directory.
  - Restarted Windows shared chain; restart log showed ready at
    `2026-06-07 16:51:35`.
  - `GET http://127.0.0.1:8787/api/public-config` reports
    `clientBuildId=0.1.11|codex-mobile-shell-v210`,
    `shellCacheName=codex-mobile-shell-v210`, `platform=win32`.
  - Authenticated thread API smoke on thread `019e8050...` returned
    `mobileReadMode=projection-dynamic`, `mobileProjection.source=dynamic`,
    `turnCount=10`; interrupted turn `019ea133...` now has `usageCount=0`.

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
