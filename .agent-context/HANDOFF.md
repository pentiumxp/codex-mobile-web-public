# HANDOFF

Last compacted: 2026-05-31T03:26:40.298Z

## 2026-06-01 Updates Panel And Public Release Check v157

- User request:
  - Keep the sidebar version entry as the update entry point, but make it an
    Updates panel.
  - A public-installed version should be able to discover and apply public
    updates. Private checkout behavior can remain separate.
- Local fix:
  - `server.js`
    - Added `/api/public-release/status`.
    - The endpoint checks the configured public repository
      `pentiumxp/codex-mobile-web-public` on branch `main`, returns the latest
      public commit, compares it to the running checkout HEAD, and reports
      whether the running checkout's update remote already tracks that public
      repository.
    - The endpoint is informational for private checkouts. It does not merge,
      sync, commit, or push public/private repositories.
    - `/api/public-config` now exposes `publicRelease` config.
  - `public/index.html`, `public/styles.css`, `public/app.js`
    - The version pill now opens an Updates dialog instead of immediately
      running the old update click handler.
    - The dialog has a current-checkout section using the existing safe
      fast-forward `/api/app-update/*` path and a Public release section using
      `/api/public-release/status`.
    - If the current checkout tracks the public repository, the current update
      action is labeled as a Public update; otherwise Public latest is shown
      as reference only.
    - Static shell bumped to `0.1.11|codex-mobile-shell-v157` /
      `codex-mobile-shell-v157`.
  - Tests/docs:
    - Added `test/app-update.test.js` coverage for the update panel and public
      release endpoint wiring.
    - Updated static shell tests and docs.
- Validation:
  - `node --check server.js`, `node --check public\app.js`, and
    `node --check public\sw.js` passed.
  - Focused `node --test test\app-update.test.js
    test\mobile-viewport.test.js test\thread-task-card-route.test.js` passed:
    13/13.
  - `npm.cmd test` passed: 286/286.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - BOM check for touched files had no output.
- Runtime verification:
  - Restarted the 8787 listener after validation: old PID `46356`, new PID
    `65700`.
  - `/api/public-config` returns
    `clientBuildId=0.1.11|codex-mobile-shell-v157`,
    `shellCacheName=codex-mobile-shell-v157`, and public release config
    `pentiumxp/codex-mobile-web-public/main`.
  - Authenticated `/api/status` is healthy:
    `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`,
    `lastError=null`.
  - Authenticated `/api/public-release/status?force=1` returned:
    public latest `889c2fe`, local checkout `5dca5ed`,
    `currentCheckoutUsesPublicRelease=false`, and
    `canUpdateThroughCurrentCheckout=false`, which is expected for this private
    checkout.
  - Open clients need the v157 refresh prompt, hard refresh, close/reopen, or
    Hermes plugin refresh path to load the new Updates dialog.
  - Public sync:
    - Synced public-safe product, test, docs, and README files to
      `C:\Users\xuxin\Documents\codex-mobile-web-public`.
    - Public validation passed: `npm.cmd test` 286/286,
      `npm.cmd run check`, `npm.cmd run check:macos`,
      `git diff --check`, and `git diff --cached --check`.
    - Staged privacy scan only matched public documentation/placeholders and
      source references to runtime key/VAPID handling; no raw secrets or
      runtime files were added.
    - Public commit pushed:
      `eb52dd4 发布线程加载、Token 统计归并与更新面板 v157`.
  - Private commit/push is next.

## 2026-06-01 Workspace Token Mojibake Merge Harness v156

- User report:
  - The full-screen token stats page again showed two garbled Workspace rows.
  - Runtime `/api/threads?limit=40&archived=false` confirmed the backend was
    returning separate `mobileTokenUsage.workspaces` rows for historical cwd
    values such as `C:\Users\xuxin\Documents\²ÆÎñ` and
    `C:\Users\xuxin\Documents\ÄÐװÒ³÷`, while `/api/workspaces` exposed the
    correct Unicode roots `财务` and `男装衣橱`.
- Local fix:
  - `adapters/token-usage-stats-service.js`
    - Expanded known Windows cwd mojibake repair for the observed Finance,
      Wardrobe, and System Tools path segments.
    - Added a small GB18030 repair fallback for mojibake path segments whose
      bytes survived as Latin-1-style code points or known Windows-mapped
      multi-byte code points.
    - Existing rows are still left in SQLite unchanged; query-time grouping
      now merges them under visible Workspace roots.
  - `test/token-usage-stats-service.test.js`
    - Added harness coverage that injects historical mojibake rows for
      `财务`, `男装衣橱`, and `系统工具` through a fake SQLite result and asserts
      the public Workspace summary shows only the canonical Unicode cwd rows.
- Status:
  - Validation passed:
    - `node --check adapters\token-usage-stats-service.js`
    - Focused `node --test test\token-usage-stats-service.test.js
      test\mobile-viewport.test.js` passed: 9/9.
    - `npm.cmd test` passed: 285/285.
    - `npm.cmd run check` passed.
    - `npm.cmd run check:macos` passed.
    - `git diff --check` passed with only Windows LF-to-CRLF working-copy
      warnings.
    - BOM check for touched files had no output.
  - Restarted the 8787 listener after the server-side service change:
    old PID `2592`, new PID `46356`.
  - `/api/public-config` still returns
    `clientBuildId=0.1.11|codex-mobile-shell-v155` and
    `shellCacheName=codex-mobile-shell-v155`; no PWA shell bump was needed.
  - Authenticated `/api/status` is healthy:
    `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`,
    `lastError=null`.
  - Authenticated `/api/threads?limit=40&archived=false` now returns the
    affected Workspace token rows as canonical Unicode cwd values:
    `财务`, `男装衣橱`, and `系统工具`; the separate mojibake rows are gone.
  - Local changes remain uncommitted.

## 2026-06-01 Cross-Thread Draft Target Id Recovery v155

- User report:
  - Cross-thread task-card draft failed for the second time today.
  - Screenshot showed a source-side `Cross-thread task card draft` card in
    `Failed` state for a Hermes -> Finance request.
- Diagnosis:
  - The runtime task-card store did not receive a new card for this failure,
    so the failure happened before a server-side card was persisted.
  - Thread detail for Hermes thread `019e7c19-c797-7ed0-bd7d-494b5efea678`
    showed the assistant draft target id was
    `019e6e22-e3d3-7d1-afef-cb9f9b833b71`, while the real Finance thread id is
    `019e6e22-e3d3-7e60-bcc2-027d40895193`.
  - The model copied the target id prefix correctly but corrupted the suffix.
    The browser previously required exact id matching and therefore marked the
    source draft failed as "target missing from visible thread list".
- Local fix:
  - `public/app.js`
    - Added a conservative target-id recovery path for source-side drafts.
    - If a returned target id is not exact, Mobile Web now recovers it only
      when exactly one visible target thread has a sufficiently long common id
      prefix.
    - Failed drafts whose only problem was a now-recoverable missing target are
      moved back to pending and retried after the refreshed client loads, so an
      already-visible failed card can self-heal instead of requiring a resend.
    - Static build id bumped to `0.1.11|codex-mobile-shell-v155`.
  - `public/sw.js`
    - App shell cache bumped to `codex-mobile-shell-v155`.
  - Docs/tests:
    - Updated README, Architecture, Project Context, mobile viewport test, and
      task-card route test expectations.
- Status:
  - Validation passed:
    - `node --check public\app.js` and `node --check public\sw.js`.
    - Focused `node --test test\thread-task-card-route.test.js
      test\mobile-viewport.test.js test\thread-task-card-service.test.js`
      passed: 20/20.
    - `npm.cmd test` passed: 284/284.
    - `npm.cmd run check` passed.
    - `npm.cmd run check:macos` passed.
    - `git diff --check` passed with only Windows LF-to-CRLF working-copy
      warnings.
    - BOM check for touched files had no output.
  - Restarted the 8787 listener after validation: old PID `105844`, new PID
    `2592`.
  - `/api/public-config` returns
    `clientBuildId=0.1.11|codex-mobile-shell-v155`,
    `shellCacheName=codex-mobile-shell-v155`, and
    `imageContextMode=reference`.
  - Authenticated `/api/status` is healthy:
    `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`,
    `lastError=null`.
  - Local changes are uncommitted.
  - Open clients need the v155 refresh prompt, hard refresh, close/reopen, or
    Hermes plugin refresh path to load the recovered draft behavior.

## 2026-06-01 Large Rollout Thread Turn Limit v154

- User report:
  - `Loading thread` still felt slow on long sessions.
  - Asked how much Mobile Web currently reads from large raw/rollout sessions
    and whether it can read less.
- Diagnosis:
  - Current large-rollout threshold is
    `CODEX_MOBILE_THREAD_DETAIL_ROLLOUT_MAX_BYTES`, default `32MB`.
  - Threads above that threshold already skip full `thread/read` and use
    bounded `thread/turns/list`.
  - Runtime logs for long thread `019e7c19-c797-7ed0-bd7d-494b5efea678`
    showed a rollout around 70MB, `limit=12`, `returnedTurns=12`, with
    `thread/turns/list` commonly around 260-330ms and one mobile cold-start
    sample around 731ms; overall restore-startup was around 1.57s.
- Local fix:
  - `server.js`
    - Changed default `CODEX_MOBILE_THREAD_TURNS` fallback from `12` to `8`.
    - Operators can still override through the environment variable.
  - `public/app.js`
    - Changed `MAX_VISIBLE_TURNS` from `12` to `8`.
    - Static build id bumped to `0.1.11|codex-mobile-shell-v154`.
  - `public/sw.js`
    - App shell cache bumped to `codex-mobile-shell-v154`.
  - Docs/tests:
    - Updated README, Architecture, Project Context, mobile viewport test, and
      task-card route test expectations.
- Status:
  - Local changes are uncommitted.
  - Validation and runtime restart still need to be run for v154.

## 2026-06-01 Startup Resume Dedup v153

- User report:
  - After refreshing and logging in on mobile, requested log inspection. User
    also noted Chrome could be used for reproduction.
- Log finding:
  - The v152 `startup_stage` events showed the first visible state was already
    early: `early_opening_rendered` at about 10 ms and `public_config_done` at
    about 319 ms.
  - The main remaining slow path was not a single slow thread detail call. A
    `pageshow` resume fired during cold startup and ran full
    `resumeMobileSession()` while bootstrap was already restoring the saved
    thread, ending as `mobile_resume_slow` around 3443 ms.
  - The same startup log showed duplicated status/list/detail activity during
    that overlap.
- Local fix:
  - `public/app.js`
    - Added `state.startupInProgress`.
    - `scheduleMobileResume()` now skips the full network resume path during
      startup, runs only visual recovery, and logs
      `mobile_resume_skipped_startup`.
    - Static shell bumped to `0.1.11|codex-mobile-shell-v153`.
  - `public/sw.js`
    - App shell cache bumped to `codex-mobile-shell-v153`.
  - Tests/docs:
    - Updated mobile viewport/static shell assertions.
    - Updated README, Troubleshooting, Project Context, and this handoff.
- Status:
  - Validation, Chrome reproduction, and runtime restart still need to be
    completed in this turn.
  - Local changes are uncommitted at this handoff update point.

## 2026-06-01 Startup Timing Logs And Earlier Detail Restore v152

- User report:
  - v151 still felt obviously slow. Requested startup log inspection to find
    where time is being spent and fix the problematic path.
- Log evidence:
  - Existing server-side thread-detail logs in
    `%USERPROFILE%\.codex-mobile-web\codex-mobile-web.startup.log` showed the
    current thread detail route itself is fast: recent `thread-detail complete`
    entries for thread `019e7c13-f9fa-76d1-afef-cb9f9b833b71` were roughly
    187-266 ms, with `thread/read` roughly 88-162 ms.
  - Local authenticated timing after v151:
    `/api/public-config` about 0.28-0.39 s, `/api/status` about 0.28-0.35 s,
    `/api/workspaces` about 0.02 s, `/api/threads?limit=40` about
    0.65-1.35 s, and current thread detail about 0.19-0.48 s.
  - Existing logs did not include enough frontend startup milestones to explain
    the user's several-second mobile delay, so client-side startup stage
    diagnostics were needed.
- Local fix:
  - `public/app.js`
    - Added bounded `startup_stage` client events for `public_config_done`,
      `early_opening_rendered`, `app_shown`, `bootstrap_start`,
      `restore_start`, `status_done`, `workspaces_done`, `threads_done`, and
      `bootstrap_done`.
    - The saved-thread `restore-startup` detail read now starts before awaiting
      `/api/status`, so known-thread detail can overlap status/workspace/list
      refresh instead of waiting for them.
    - When a local key and startup thread intent exist, the app shell renders
      the stable `Opening thread...` state before `/api/public-config`
      completes; config still fills in model/quota/settings once it arrives.
    - Static shell bumped to `0.1.11|codex-mobile-shell-v152`.
  - `public/sw.js`
    - App shell cache bumped to `codex-mobile-shell-v152`.
  - Tests/docs:
    - Updated mobile viewport/static shell assertions.
    - Updated README, Architecture, Troubleshooting, Project Context, and this
      handoff.
- Status:
  - `node --check public\app.js` passed.
  - `node --check public\sw.js` passed.
  - Focused `node --test test\mobile-viewport.test.js
    test\thread-task-card-route.test.js test\app-update.test.js` passed: 12/12.
  - `npm.cmd test` passed: 284/284.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - BOM check for touched source/test/docs/context files had no output.
  - Restarted the 8787 Node listener by stopping old PID `103896`; the
    windowless supervisor restarted it as PID `59580`.
  - `/api/public-config` now returns
    `clientBuildId=0.1.11|codex-mobile-shell-v152`,
    `shellCacheName=codex-mobile-shell-v152`, and
    `imageContextMode=reference`.
  - Authenticated `/api/status` is healthy:
    `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`,
    `lastError=null`.
  - Local changes are uncommitted at this handoff update point.

## 2026-06-01 Startup Thread Loading v151

- User report:
  - v150 only slightly improved startup. On mobile, the page still stayed on
    `Select a thread` for about two seconds, then `Loading thread` for another
    two seconds, creating a roughly four-to-five second perceived delay.
  - Screenshot confirmed the first pause was the standalone empty detail state
    `Select a thread / Select a thread from the menu`, not the Hermes startup
    loading gate.
- Diagnosis:
  - Local authenticated timing after v150 was not slow by itself:
    `/api/status` about 0.28-0.39 s, `/api/workspaces` about 0.02 s,
    `/api/threads?limit=40` about 0.65-0.74 s, and current thread detail about
    0.19-0.26 s.
  - The frontend still revealed the app shell through `showApp()` before
    `bootstrap()` set `startupThreadOpenPending`, so a saved-thread cold start
    could briefly render the empty home state.
  - The saved-thread detail read also waited until after the thread list
    response, creating a serial list-then-detail wait on higher-latency mobile
    connections.
- Local fix:
  - `public/app.js`
    - Added `hasStartupThreadOpenIntent()` and calls it before `showApp()`.
    - If a saved current thread exists, the first visible app state is now
      `Opening thread...` instead of `Select a thread`.
    - Saved-thread detail loading starts as `restore-startup` in parallel with
      workspace/list refresh, so detail no longer waits for the list response.
    - Static shell bumped to `0.1.11|codex-mobile-shell-v151`.
  - `public/sw.js`
    - App shell cache bumped to `codex-mobile-shell-v151`.
  - Tests/docs:
    - Updated static mobile viewport coverage.
    - Updated README, Architecture, Troubleshooting, Project Context, and this
      handoff.
- Status:
  - `node --check public\app.js` passed.
  - `node --check public\sw.js` passed.
  - Focused `node --test test\mobile-viewport.test.js
    test\thread-task-card-route.test.js test\app-update.test.js` passed: 12/12.
  - `npm.cmd test` passed: 284/284.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - BOM check for touched source/test/docs/context files had no output.
  - Restarted the 8787 Node listener by stopping old PID `120076`; the
    windowless supervisor restarted it as PID `103896`.
  - `/api/public-config` now returns
    `clientBuildId=0.1.11|codex-mobile-shell-v151`,
    `shellCacheName=codex-mobile-shell-v151`, and
    `imageContextMode=reference`.
  - Authenticated `/api/status` is healthy:
    `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`,
    `lastError=null`.
  - Local changes are uncommitted at this handoff update point.

## 2026-06-01 Thread List Loading Limit v150

- User report:
  - `Loading Thread` felt slower today; requested a check before committing.
- Diagnosis:
  - Current thread detail reads were not the main bottleneck in local probes:
    the current Codex Mobile detail loaded in about 372 ms, Hermes large-rollout
    detail in about 371 ms, and Finance large-rollout detail in about 312 ms.
  - The thread-list route was sensitive to requested page size:
    `/api/threads?limit=12/20/30/40` returned in roughly 0.6-0.75 seconds,
    while `limit=60/80` returned in roughly 1.27-1.40 seconds even though only
    17 visible rows were returned.
  - The frontend `loadThreads()` still requested `limit=80`, so startup,
    foreground resume, Hermes plugin startup, and switching flows could spend
    extra time on list refresh before opening or refreshing a thread.
- Local fix:
  - `public/app.js`
    - Added `THREAD_LIST_PAGE_LIMIT = 40`.
    - `loadThreads()` now uses that bounded default instead of hard-coded `80`.
    - Static shell bumped to `0.1.11|codex-mobile-shell-v150`.
  - `public/sw.js`
    - App shell cache bumped to `codex-mobile-shell-v150`.
  - Tests/docs:
    - Updated mobile viewport/static shell coverage.
    - Updated README, Architecture, Troubleshooting, Project Context, and this
      handoff.
- Status:
  - `node --check public\app.js` passed.
  - `node --check public\sw.js` passed.
  - Focused `node --test test\mobile-viewport.test.js
    test\thread-task-card-route.test.js` passed: 7/7.
  - `npm.cmd test` passed: 284/284.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - BOM check for touched source/test/docs/context files had no output.
  - Restarted the 8787 Node listener by stopping old PID `79708`; the
    windowless supervisor restarted it as PID `120076`.
  - `/api/public-config` now returns
    `clientBuildId=0.1.11|codex-mobile-shell-v150`,
    `shellCacheName=codex-mobile-shell-v150`, and
    `imageContextMode=reference`.
  - Authenticated `/api/status` is healthy:
    `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`,
    `lastError=null`.
  - Local changes are uncommitted at this handoff update point.

This active handoff was automatically compacted before a Codex Mobile continuation.
The previous full handoff was archived and should be opened only when old provenance is explicitly needed.

## Compaction Summary

- Workspace: `C:\Users\xuxin\Documents\codex-mobile-web`
- Original active handoff bytes: `322000`
- Archived full handoff: `C:\Users\xuxin\Documents\codex-mobile-web\.agent-context\archive\context-compaction-20260531_032640\HANDOFF.full.md`
- Preserved recent active context chars: `59878`

## Startup Guidance

- Read `.agent-context/PROJECT_CONTEXT.md` first.
- Read this compact `.agent-context/HANDOFF.md` for current status.
- Do not load the archived full handoff unless the user asks for old provenance or the compact handoff is insufficient.
- Keep future handoff updates concise: current state, changed files, validation, risks, and next steps.
- Do not store raw secrets, tokens, one-time approvals, hidden UI state, long logs, or bulky generated output.

## 2026-06-01 Quota Source Isolation And Million Token Units v149

- User request:
  - Token stats should display in millions instead of ten-thousands.
  - Composer quota was jumping between weekly remaining `59%` and `83%` in the
    same thread; diagnose whether the current workspace/account was wrong, then
    prevent other quota sources from overwriting the current display.
- Diagnosis:
  - Current active profile is `default`, logged in as
    `5gdxrncpzf@privaterelay.appleid.com`; `current` / LKF and `previous` are
    inactive.
  - Authenticated `/api/public-config`, `/api/status`, and active profile quota
    agreed on `limitId=codex`, weekly `usedPercent=17`, remaining `83%`.
  - Recent rollout evidence also contained `limitId=codex`, weekly
    `usedPercent=41`, remaining `59%`, from an `Agent` workspace thread. The
    two snapshots alternated in recent rollout events, so the symptom was not
    evidence of the active Mobile Web profile switching accounts.
- Local fix:
  - `server.js`
    - Split quota storage into live app-server quota and rollout-scanned
      snapshot quota.
    - `loadRecentRateLimitsFromRollouts()` records only snapshot quota.
    - `activeRateLimits()` / `rateLimitsByModelObject()` prefer live quota and
      use rollout snapshots only as a cold-start fallback.
    - Source-less `account/rateLimits/updated` notifications are recorded but
      no longer broadcast directly to browser SSE clients.
  - `public/app.js`
    - Browser ignores source-less `account/rateLimits/updated` notifications and
      keeps composer quota tied to `/api/public-config` / `/api/status`
      snapshots for the active Mobile Web chain.
    - Token stats formatting now uses millions (`百万`) instead of `万`.
  - `public/app.js` / `public/sw.js`
    - Static shell bumped to `0.1.11|codex-mobile-shell-v149` /
      `codex-mobile-shell-v149`.
- Tests/docs:
    - Updated quota, profile, mobile viewport, and task-card static shell tests.
    - Updated README, Architecture, Troubleshooting, Project Context, and this
      handoff.
- Validation:
  - `node --check server.js` passed.
  - `node --check public\app.js` passed.
  - `node --check public\sw.js` passed.
  - Focused `node --test test\new-thread-route.test.js
    test\new-thread-ui.test.js test\codex-profile-ui.test.js
    test\mobile-viewport.test.js test\thread-task-card-route.test.js
    test\token-usage-stats-service.test.js` passed: 29/29.
  - `npm.cmd test` passed: 284/284.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - BOM check for touched source/test/docs/context files had no output.
- Deployment/runtime:
  - Restarted the 8787 Node listener by stopping old PID `92664`; the
    windowless supervisor restarted it as PID `79708`.
  - `/api/public-config` now returns
    `clientBuildId=0.1.11|codex-mobile-shell-v149`,
    `shellCacheName=codex-mobile-shell-v149`, and
    `imageContextMode=reference`.
  - Authenticated `/api/status` is healthy:
    `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`,
    `lastError=null`.
  - Authenticated `/api/status` / `/api/codex-profiles` confirm active profile
    `default`, account `5gdxrncpzf@privaterelay.appleid.com`, and `codex`
    weekly `usedPercent=17` after restart.
- Status:
  - Local changes remain uncommitted.
  - Open clients need the refresh prompt, hard refresh, close/reopen, or Hermes
    plugin refresh to load v149.

## 2026-06-01 Thread List Token Badge Removal v148

- User request:
  - Remove the per-thread "today token" consumption display from the thread
    list because it has low value and makes the list look worse.
- Local fix:
  - `public/app.js`
    - Removed the per-thread `thread-card-token-badge` from thread rows.
    - Removed today/total per-thread token values from the thread-list render
      signature.
    - Kept Workspace token stats, full-screen stats, and turn-level usage
      summaries intact.
  - `public/styles.css`
    - Removed the unused `thread-card-token-badge` style.
  - `public/app.js` / `public/sw.js`
    - Static shell bumped to `0.1.11|codex-mobile-shell-v148` /
      `codex-mobile-shell-v148`.
  - Tests/docs:
    - Updated mobile viewport/static shell tests to assert the badge is absent.
    - Updated README, Architecture, Project Context, and this handoff.
- Validation:
  - `node --check public\app.js` passed.
  - `node --check public\sw.js` passed.
  - Focused `node --test test\mobile-viewport.test.js
    test\thread-task-card-route.test.js test\token-usage-stats-service.test.js`
    passed: 11/11.
  - `npm.cmd test` passed: 282/282.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - BOM check for touched source/test/docs/context files had no output.
- Deployment/runtime:
  - Restarted the 8787 Node listener by stopping old PID `6244`; the
    windowless supervisor restarted it as PID `92664`.
  - `/api/public-config` now returns
    `clientBuildId=0.1.11|codex-mobile-shell-v148`,
    `shellCacheName=codex-mobile-shell-v148`, and
    `imageContextMode=reference`.
  - Authenticated `/api/status` is healthy:
    `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`,
    `lastError=null`.
- Status:
  - Local changes remain uncommitted.
  - This is a static frontend/PWA behavior change. Open clients need the refresh
    prompt, hard refresh, close/reopen, or Hermes plugin refresh to load v148.
  - Public repository was not synced or pushed.

## 2026-06-02 Profile Switch Controlled Restart Fix

- User report:
  - After switching the Codex account/profile, quota display did not refresh.
  - The active profile store showed `previous`, but Mobile Web was still using
    `C:\Users\xuxin\.codex`.
- Diagnosis:
  - `%USERPROFILE%\.codex-mobile-web\codex-profiles.json` correctly persisted
    `activeProfileId=previous`.
  - Before the fix, `/api/public-config` and authenticated `/api/status`
    still reported `activeCodexHome=C:\Users\xuxin\.codex`.
  - The previous-profile mux endpoint did not exist, while the default
    `.codex\app-server-mux\endpoint.json` still existed.
  - `start-codex-mobile-web-windowless.ps1` only read the active profile store
    when process-level `CODEX_HOME` was empty, so a stale/default environment
    value could override the selected profile during scheduled-task startup.
  - The restart API returned accepted during one attempt without replacing the
    listener; direct script dry-run showed the restart script itself could
    resolve `previous` and target the old listener correctly.
- Local fix:
  - `start-codex-mobile-web-windowless.ps1`
    - Always resolves `%USERPROFILE%\.codex-mobile-web\codex-profiles.json`
      first and sets `CODEX_HOME` to the selected profile home when present.
    - Falls back to existing `CODEX_HOME` / default `.codex` only when the
      profile store has no selected home.
  - `server.js`
    - Added `activeProfileRestartOptions()`.
    - `POST /api/codex-profiles/active` now passes the selected `profileId`
      and `codexHome` into the shared-chain restart service.
    - `POST /api/restart/shared-chain` now passes the current active
      profile's `profileId` and `codexHome` instead of depending on stale
      process environment.
  - Harness/tests:
    - `test/codex-profile-ui.test.js` asserts the windowless launcher reads
      the profile store before honoring `CODEX_HOME`.
    - `test/manual-restart-ui.test.js` asserts profile switch/manual restart
      routes pass active profile restart options.
  - Documentation updated:
    - `.agent-context/PROJECT_CONTEXT.md`
    - this handoff.
- Validation:
  - `node --check server.js` passed.
  - PowerShell parser checks passed for:
    - `start-codex-mobile-web-windowless.ps1`
    - `restart-codex-mobile-shared-chain.ps1`
  - Focused `node --test test\manual-restart-ui.test.js
    test\shared-chain-restart-service.test.js
    test\shared-chain-restart-script.test.js test\codex-profile-ui.test.js
    test\codex-profile-service.test.js test\desktop-profile-launcher.test.js`
    passed: 26/26.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
- Runtime:
  - Explicit dry-run:
    - `restart-codex-mobile-shared-chain.ps1 -ProfileId previous -DryRun`
      resolved `codexHome='C:\Users\xuxin\.codex-homes\previous'` and would
      stop the old `node.exe pid=124576`.
  - First explicit controlled restart stopped old `node.exe pid=124576` and
    started Mobile Web on `previous`.
  - Second explicit controlled restart loaded the server route fix:
    - stopped `node.exe pid=62856`, previous mux child `codex.exe pid=49092`,
      and mux wrapper `node.exe pid=105396`;
    - final 8787 listener PID: `94704`.
  - Final `/api/public-config`:
    - `clientBuildId=0.1.11|codex-mobile-shell-v160`
    - `shellCacheName=codex-mobile-shell-v160`
    - `activeProfileId=previous`
    - `activeCodexHome=C:\Users\xuxin\.codex-homes\previous`
    - account labels:
      - default: `5gdxrncpzf@privaterelay.appleid.com`
      - current: `lkf12101975@icloud.com`
      - previous: `2261065@qq.com`
  - Final authenticated `/api/status`:
    - `ready=true`
    - `transport=external-jsonl-tcp`
    - `sharedRequired=true`
    - `lastError=null`
    - `activeCodexHome=C:\Users\xuxin\.codex-homes\previous`
  - Final endpoints:
    - default endpoint still exists at `.codex\app-server-mux\endpoint.json`
      from the older default chain.
    - active previous endpoint exists at
      `.codex-homes\previous\app-server-mux\endpoint.json` with port `49979`.
- Status:
  - Local changes remain uncommitted.
  - Public repository was not synced or pushed for this runtime/profile fix.

## 2026-06-02 Profile Switch Shared Thread State

- User report:
  - After switching Codex Mobile Web to another Codex account/profile and
    performing a controlled restart, Mobile Web could only see two workspaces
    and no threads.
  - The user clarified the desired behavior: switching accounts should preserve
    the existing workspaces, threads, and conversation continuity while new
    turns use the selected account.
- Diagnosis:
  - Runtime was on `activeProfileId=previous` with
    `activeCodexHome=C:\Users\xuxin\.codex-homes\previous`.
  - The default home `C:\Users\xuxin\.codex` had a large
    `state_5.sqlite` and 201 session JSONL files.
  - The previous profile home had its own auth/config but no `sessions/`
    rollout files and only a small profile-local SQLite state, so switching
    the whole `CODEX_HOME` hid the original thread/workspace state.
- Local fix:
  - `start-codex-mobile-web-windowless.ps1`
    - Added `Backup-ProfileAuthFiles()`.
    - Added `Ensure-SharedProfileState()`.
    - For non-default profile homes, startup now keeps that profile's
      `auth.json` and `config.toml`, but links conversation state back to the
      default `.codex` home:
      - `.codex-global-state.json`
      - `state_5.sqlite`
      - `state_5.sqlite-wal`
      - `state_5.sqlite-shm`
      - `session_index.jsonl`
      - `sessions/`
      - `archived_sessions/`
    - Files use hardlinks and directories use junctions.
    - Existing auth/config are copied to
      `%USERPROFILE%\.codex-mobile-web\profile-auth-backups`.
    - Replaced profile-local state is moved to
      `%USERPROFILE%\.codex-mobile-web\profile-state-backups`.
  - Harness/tests:
    - `test/codex-profile-ui.test.js` now asserts the launcher backs up
      auth/config, shares only state paths, and uses hardlink/junction link
      types.
  - Documentation updated:
    - README
    - `docs/ARCHITECTURE.md`
    - `docs/MODULES.md`
    - `docs/TROUBLESHOOTING.md`
    - `.agent-context/PROJECT_CONTEXT.md`
    - this handoff.
- Validation:
  - PowerShell parser check passed for
    `start-codex-mobile-web-windowless.ps1` and
    `restart-codex-mobile-shared-chain.ps1`.
  - Focused `node --test test\codex-profile-ui.test.js
    test\codex-profile-service.test.js test\manual-restart-ui.test.js
    test\shared-chain-restart-script.test.js
    test\shared-chain-restart-service.test.js` passed: 24/24.
  - `node --check server.js` passed.
  - `npm.cmd test` passed: 292/292.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
- Runtime:
  - Manually backed up all three profile auth/config files under
    `%USERPROFILE%\.codex-mobile-web\profile-auth-backups\manual-20260602-194104`.
  - Switched store to `previous` and ran explicit controlled restart through
    `restart-codex-mobile-shared-chain.ps1 -ProfileId previous`.
  - Final `/api/public-config`:
    - `activeProfileId=previous`
    - `activeCodexHome=C:\Users\xuxin\.codex-homes\previous`
    - active account label: `2261065@qq.com`
    - `clientBuildId=0.1.11|codex-mobile-shell-v161`
    - `shellCacheName=codex-mobile-shell-v161`
  - Final authenticated `/api/status`:
    - `ready=true`
    - `transport=external-jsonl-tcp`
    - `lastError=null`
  - `C:\Users\xuxin\.codex-homes\previous` now has hardlinks to default
    `.codex` for `state_5.sqlite*`, `.codex-global-state.json`, and
    `session_index.jsonl`, and junctions for `sessions/` and
    `archived_sessions/`.
  - Auth/config remained ordinary profile-local files in the previous profile
    home.
  - Authenticated `/api/threads?limit=10` returned 10 threads, including
    `Codex Mobile 05-31`, `Hermes 05-31`, `记账 06-01`, and `Email`, proving
    previous-account runtime can see the shared default conversation state.
- Status:
  - Local changes remain uncommitted.
  - Public repository was not synced or pushed for this change.

## 2026-06-02 Codex App-Server Residual Process Cleanup

- User report:
  - Codex weekly quota still appeared to drop while the user was not actively
    working.
- Diagnosis:
  - Active Mobile Web profile was the default main account
    `5gdxrncpzf@privaterelay.appleid.com`.
  - `/api/public-config` and authenticated `/api/status` agreed on the same
    active quota source; no split quota source was observed.
  - `/api/threads?limit=80&archived=false` showed no active/running turn in the
    current visible list.
  - Local token usage SQLite showed 2026-06-02 completed-turn usage mainly from
    `Hermes 05-31` (`C:\Users\xuxin\Documents\Agent`) and `Email`
    (`C:\Users\xuxin\Documents\email`), not from this `codex-mobile-web`
    workspace.
  - Process inspection found 16 `codex-app-server-mux.js app-server` processes
    and 16 child `codex.exe app-server` processes. A 3-second CPU sample showed
    no CPU delta, so they were residual/idle at that moment rather than proven
    active model consumption.
- Cleanup:
  - Preserved the current Mobile Web listener PID `65700`.
  - Preserved the current endpoint mux PID `27004` on port `64816` and its child
    `codex.exe app-server` PID `21860`.
  - Stopped 15 stale mux Node processes and their 15 child `codex.exe
    app-server` processes.
- Verification:
  - Post-cleanup only one mux/app-server pair remained:
    - mux PID `27004`
    - child app-server PID `21860`
  - Authenticated `/api/status` stayed healthy:
    `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`,
    `lastError=null`.
  - `/api/public-config` still returned
    `clientBuildId=0.1.11|codex-mobile-shell-v157` and
    `shellCacheName=codex-mobile-shell-v157`.
  - Private git status was clean before this handoff update.
- Note:
  - During the diagnostic/cleanup turn, the 5-hour active quota used percentage
    changed from `49%` to `52%`; this was observed while the current Codex
    diagnostic turn itself was running, so it is not evidence that the stopped
    residual processes were still consuming quota.

## 2026-06-02 Generated PNG Base64 Markdown Rendering v158

- User request:
  - Codex-generated effect images can arrive as PNG `data:image/png;base64,...`
    content rather than saved upload files; Mobile Web should render them as
    images.
- Local fix:
  - `public/markdown-renderer.js`
    - Added safe Markdown image rendering for bitmap data URLs:
      `png`, `jpeg`, `webp`, and `gif`.
    - Added support for a bare single-line `data:image/png;base64,...` block,
      rendering it as a bounded generated image instead of a long text string.
    - SVG data images remain blocked.
  - `public/styles.css`
    - Reused the bounded thumbnail treatment for `.markdown-image`.
  - `public/app.js` / `public/sw.js`
    - Static shell bumped to
      `0.1.11|codex-mobile-shell-v158` / `codex-mobile-shell-v158`.
  - Tests and docs updated:
    - `test/markdown-render.test.js`
    - README, Architecture, Complex Feature Paths, Troubleshooting, and Project
      Context.
- Validation:
  - Focused `node --test test\markdown-render.test.js
    test\conversation-render.test.js test\file-preview.test.js
    test\image-compressor.test.js` passed: 44/44.
  - `node --check public\markdown-renderer.js`, `node --check public\app.js`,
    and `node --check public\sw.js` passed.
  - Focused rerun `node --test test\mobile-viewport.test.js
    test\thread-task-card-route.test.js test\markdown-render.test.js` passed:
    21/21.
  - `npm.cmd test` passed: 289/289.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
- Status:
  - Restarted the 8787 listener after validation:
    old PID `65700`, new PID `88964`.
  - Post-restart `/api/public-config` returns
    `clientBuildId=0.1.11|codex-mobile-shell-v158`,
    `shellCacheName=codex-mobile-shell-v158`, and
    `imageContextMode=reference`.
  - Post-restart authenticated `/api/status` is healthy:
    `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`,
    `lastError=null`.
  - Post-restart process check still shows only one mux/app-server pair:
    mux PID `27004`, app-server PID `21860`.
  - Open clients need the v158 refresh prompt, hard refresh, close/reopen, or
    Hermes plugin refresh path to load the new Markdown image renderer.

## 2026-06-02 ImageGeneration Saved PNG Rendering v159

- User report:
  - In `Hermes 05-31`, Codex generated two effect images, but Mobile Web showed
    raw `imageGeneration` JSON cards with `status=generating` instead of the
    PNG images.
- Diagnosis:
  - Last Hermes turn `019e8723-b2c5-7c92-b8a5-32e973c939db` was completed.
  - It contained two `imageGeneration` items that still had
    `status=generating`, but each item also had a real `savedPath` under
    `%USERPROFILE%\.codex\generated_images\...`.
  - Both saved PNG files existed locally:
    - first size about 1.23 MB
    - second size about 1.18 MB
  - The existing Mobile Web generated-image cache only handled `imageView`, so
    `imageGeneration` fell through to generic JSON rendering.
- Local fix:
  - `adapters/generated-image-cache-service.js`
    - `imageViewSourcePath()` now also recognizes `savedPath` /
      `saved_path`, including `imageGeneration.savedPath`.
  - `server.js`
    - `attachGeneratedImageContent()` now accepts both `imageView` and
      `imageGeneration`.
    - Thread compaction attaches authenticated `/api/generated-images/file`
      content URLs to supported `imageGeneration.savedPath` files.
  - `public/app.js`
    - `imageViewPath()` recognizes `savedPath`.
    - `renderItemBody()` renders `imageGeneration` through
      `renderImageView()` instead of generic JSON.
    - Label map shows `imageGeneration` as `Image`.
  - `public/app.js` / `public/sw.js`
    - Static shell bumped to
      `0.1.11|codex-mobile-shell-v159` / `codex-mobile-shell-v159`.
  - Tests/docs updated:
    - `test/generated-image-cache-service.test.js`
    - `test/file-preview-ui.test.js`
    - `test/mobile-viewport.test.js`
    - `test/thread-task-card-route.test.js`
    - README, Architecture, Modules, Complex Feature Paths, Troubleshooting,
      and Project Context.
- Validation:
  - Focused `node --test test\generated-image-cache-service.test.js
    test\file-preview-ui.test.js test\mobile-viewport.test.js
    test\thread-task-card-route.test.js test\conversation-render.test.js`
    passed: 27/27.
  - `node --check adapters\generated-image-cache-service.js`,
    `node --check server.js`, `node --check public\app.js`, and
    `node --check public\sw.js` passed.
  - `npm.cmd test` passed: 289/289.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
- Runtime verification:
  - Restarted the 8787 listener after validation:
    old PID `88964`, new PID `79304`.
  - Post-restart `/api/public-config` returns
    `clientBuildId=0.1.11|codex-mobile-shell-v159` and
    `shellCacheName=codex-mobile-shell-v159`.
  - Authenticated `/api/status` is healthy:
    `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`,
    `lastError=null`.
  - Process check still shows one mux/app-server pair:
    mux PID `27004`, app-server PID `21860`.
  - Re-reading `Hermes 05-31` last turn now shows both `imageGeneration` items
    have authenticated `/api/generated-images/file` content URLs and
    `generatedImage.contentType=image/png`.
  - Fetching one generated-image URL returned `HTTP 200`, `Content-Type:
    image/png`, `Content-Length: 1288868`, and `X-Content-Type-Options:
    nosniff`.
- Status:
  - Open clients need the v159 refresh prompt, hard refresh, close/reopen, or
    Hermes plugin refresh path to load the new frontend renderer.

## 2026-06-01 Hermes Plugin Startup Loading Gate v147

- User report:
  - In Hermes plugin embed mode, slow network startup visibly stepped through
    multiple intermediate screens: the default `Select a thread` main pane,
    a `Loading threads...` primary/sidebar state, then the final plugin page.
  - Desired behavior is one stable loading hint and then the final page.
- Local fix:
  - `public/index.html`
    - Added `#pluginStartupLoading`, a stable embed startup loading layer with
      `正在加载 Codex...`.
  - `public/app.js`
    - Added `pluginStartupLoading` state plus
      `showPluginStartupLoading()` / `hidePluginStartupLoading()`.
    - `start()` shows the loading layer immediately in `/?embed=hermes`, before
      `/api/public-config` and plugin session exchange can expose a blank or
      partial page.
    - `showApp()` keeps embed app layout hidden behind the loading layer.
    - `bootstrap()` only hides the layer after Workspace/thread-list loading
      and final primary page, launch target, or route hint rendering completes.
    - Auth/recovering paths clear the startup layer before showing their bounded
      plugin recovering/auth state.
  - `public/styles.css`
    - Added fixed full-iframe loading layer styling and hides app/login while
      `html.embed-hermes.plugin-startup-loading` is active.
  - `public/app.js` / `public/sw.js`
    - Static shell bumped to `0.1.11|codex-mobile-shell-v147` /
      `codex-mobile-shell-v147`.
  - Tests/docs:
    - Updated `test/mobile-viewport.test.js` and
      `test/thread-task-card-route.test.js`.
    - Updated README, Architecture, Troubleshooting, Project Context, and this
      handoff.
- Validation:
  - `node --check public\app.js` passed.
  - `node --check public\sw.js` passed.
  - Focused `node --test test\mobile-viewport.test.js
    test\plugin-embed.test.js` passed: 11/11.
  - `npm.cmd test` passed: 281/281.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - BOM check for touched source/test/docs/context files had no output.
- Deployment/runtime:
  - Restarted the 8787 Node listener by stopping old PID `97032`; the
    windowless supervisor restarted it as PID `86808`.
  - `/api/public-config` now returns
    `clientBuildId=0.1.11|codex-mobile-shell-v147`,
    `shellCacheName=codex-mobile-shell-v147`, and
    `imageContextMode=reference`.
  - Authenticated `/api/status` is healthy:
    `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`,
    `lastError=null`.
- Status:
  - Local changes remain uncommitted.
  - This is a static frontend/PWA behavior change. Open clients need the refresh
    prompt, hard refresh, close/reopen, or Hermes plugin refresh to load v147.
  - Public repository was not synced or pushed.

## 2026-06-01 Workspace Token Stats Mojibake Cwd Fix

- User report:
  - In the full-screen `Token 统计` page, the project list showed a garbled
    Workspace row `ϵͳ¹¤¾ß` below normal rows like `Agent`,
    `codex-mobile-web`, and `email`.
- Diagnosis:
  - Authenticated `/api/threads?limit=3&archived=false` already returned a
    `mobileTokenUsage.workspaces` row with
    `cwd=C:\Users\xuxin\Documents\ϵͳ¹¤¾ß`.
  - Authenticated `/api/workspaces` returned the real visible Workspace root as
    `C:\Users\xuxin\Documents\系统工具`, confirming the bug was in the token
    usage SQLite cwd grouping, not the frontend layout.
- Local fix:
  - `adapters/token-usage-stats-service.js`
    - Added known Windows mojibake path-segment normalization.
    - New `recordTurnUsage()` calls normalize cwd before writing future rows.
    - `workspaceSummary()` / `decorateThreadListResult()` now accept visible
      `workspaceCwds` aliases, merge historical mojibake cwd rows into the real
      Unicode Workspace cwd, and include mojibake variants when filtering a
      selected Workspace.
  - `server.js`
    - Passes visible Codex and Mobile-registered Workspace roots into token
      usage decoration and recording.
  - Tests/docs:
    - Added service coverage for merging `ϵͳ¹¤¾ß` into `系统工具`.
    - Updated README, Architecture, Modules, Troubleshooting, Project Context,
      and this handoff.
- Validation:
  - `node --check adapters\token-usage-stats-service.js` passed.
  - `node --check server.js` passed.
  - Focused `node --test test\token-usage-stats-service.test.js
    test\mobile-viewport.test.js` passed: 8/8.
  - `npm.cmd test` passed: 282/282.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - BOM check for touched source/test/docs/context files had no output.
- Deployment/runtime:
  - Restarted the 8787 Node listener by stopping old PID `86808`; the
    windowless supervisor restarted it as PID `6244`.
  - `/api/public-config` still returns
    `clientBuildId=0.1.11|codex-mobile-shell-v147` and
    `shellCacheName=codex-mobile-shell-v147`.
  - Authenticated `/api/status` is healthy:
    `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`,
    `lastError=null`.
  - Authenticated `/api/threads?limit=3&archived=false` now returns the
    project stats row as `C:\Users\xuxin\Documents\系统工具` instead of
    `C:\Users\xuxin\Documents\ϵͳ¹¤¾ß`.
- Status:
  - Local changes remain uncommitted.
  - This is a server-side stats/API fix; no static PWA shell bump is required.
  - Public repository was not synced or pushed.

## 2026-06-01 Public PR #42/#43 Merge And Private Sync

- User request:
  - Review open public PRs `pentiumxp/codex-mobile-web-public` #42 and #43.
  - If mergeable, update public README Chinese release notes, run validation and privacy scan, push public, then sync back to private and revalidate.
- Public result:
  - PR #42 `允许预览已知工作区内的本地文件` was merge-committed to public main as `ba7eddbd44df2e75458a1bdc9712d29dd4d69bc8`.
  - PR #43 `修复 worktree 线程在 Mobile 中不可见` was merge-committed to public main as `8540fe0272a5f4103ae95ca3d52f12546a87ca0b`.
  - Follow-up public docs commit `0cc2c98` synced the public `docs/` architecture/module/troubleshooting/complex-path docs for PR #42/#43.
  - GitHub reports both PRs as `MERGED`.
  - Public README now has separate 2026-06-01 Chinese release notes for known-workspace file preview, worktree thread visibility, and public docs synchronization.
- Product behavior:
  - Local file preview roots now include explicit env roots, visible workspace roots, current thread cwd, and enclosing Obsidian vaults when present; it still rejects out-of-root paths, sensitive file types, unsupported binary content, and broad runtime/temp/.codex/upload/diagnostic roots.
  - Markdown file preview preserves source ordered-list numbering.
  - Thread visibility accepts Codex worktree cwd values under `%USERPROFILE%\.codex\worktrees\<id>\<repo>` only when `<repo>` matches a visible workspace basename.
  - Thread list responses merge bounded state DB / session-index fallback rows when app-server omits visible rows, and `thread/turns/list` fallback sorting can use rollout item timestamps.
  - Static browser build/cache advanced to `0.1.11|codex-mobile-shell-v140` / `codex-mobile-shell-v140`.
- Private sync:
  - Synced only product files and public docs from public into private: README, `server.js`, `public/app.js`, `public/sw.js`, focused tests, new `test/thread-visibility.test.js`, and the tracked `docs/` updates.
  - Updated private docs and project context: `docs/ARCHITECTURE.md`, `docs/MODULES.md`, `docs/TROUBLESHOOTING.md`, `docs/COMPLEX_FEATURE_PATHS.md`, `.agent-context/PROJECT_CONTEXT.md`, and this handoff.
  - Did not copy `.agent-context` from public, runtime state, local keys, uploads, or machine-specific diagnostics.
- Validation:
  - Public: focused tests passed 24/24; after code PR merge `npm.cmd test` passed 262/262, `npm.cmd run check` passed, `npm.cmd run check:macos` passed, `git diff --check HEAD~2..HEAD` passed, privacy scan passed, and BOM check passed. After the public docs follow-up, `npm.cmd test` again passed 262/262, `npm.cmd run check` passed, `npm.cmd run check:macos` passed, `git diff --check` passed, privacy scan passed, and BOM check passed.
  - Private after sync: focused tests passed 24/24; `npm.cmd test` passed 262/262; `npm.cmd run check` passed; `npm.cmd run check:macos` passed; `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings; privacy scan passed.
- Activation:
  - Server-side changes require restarting the 8787 Node listener.
  - Static frontend/PWA changes require clients to accept the refresh prompt, hard refresh, or close/reopen to load `codex-mobile-shell-v140`.

## 2026-06-01 Cross-Thread Task Card Draft Lookup v141

- User report:
  - From Hermes, a `#` cross-thread task card was sent to the Wardrobe thread,
    but Wardrobe did not receive a pending task card.
- Diagnosis:
  - Runtime task-card store `%USERPROFILE%\.codex-mobile-web\thread-task-cards.json`
    was still last written on `2026-05-31T09:05:23Z`; it had 33 cards and no
    new 2026-06-01 entry.
  - Wardrobe target thread `019e7c0b-96d0-7e92-84fa-cb7b55d73466` had
    `pendingIncomingTaskCardCount=0` and no attached `threadTaskCards`.
  - Hermes source rollout `019e7c19-c797-7ed0-bd7d-494b5efea678` did contain a
    valid `<codex-mobile-thread-task-card-draft>` targeting that Wardrobe
    thread, so the model draft existed but the browser did not create the real
    `/api/thread-task-cards` record.
  - Root cause was `public/app.js` `findThreadTaskCardDraftByKey()`: while
    scanning current-thread items for the queued draft key, it returned `null`
    on the first non-draft assistant/plan item instead of continuing. Long
    source threads usually have earlier assistant messages before the final
    draft, so auto-create was skipped before the API call.
- Local fix:
  - `public/app.js` now continues scanning past non-draft assistant/plan items.
  - `public/app.js` / `public/sw.js` bumped to
    `0.1.11|codex-mobile-shell-v141` / `codex-mobile-shell-v141`.
  - `test/thread-task-card-route.test.js` now asserts the queued draft lookup
    uses `continue` and does not regress to early `return null`.
  - Documentation updated in README, Architecture, Modules, Troubleshooting,
    Cross-Thread design/implementation docs, Project Context, and this handoff.
- Validation/status:
  - `node --check public\app.js` passed.
  - `node --check public\sw.js` passed.
  - Focused `node --test test\thread-task-card-route.test.js
    test\conversation-render.test.js test\mobile-viewport.test.js` passed:
    23/23.
  - `npm.cmd test` passed: 262/262.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - BOM check for touched source/test/docs/context files had no output.
  - Restarted the 8787 Node listener: old PID `41696`, new PID `88388`.
  - Post-restart `/api/public-config` returns
    `clientBuildId=0.1.11|codex-mobile-shell-v141`,
    `shellCacheName=codex-mobile-shell-v141`, and
    `imageContextMode=reference`.
  - Post-restart authenticated `/api/status` is healthy:
    `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`,
    `lastError=null`.
  - After v141 activation, the previously generated Hermes draft was converted
    into task card `ttc_13b81b24283ad6fa0b` for Wardrobe thread
    `019e7c0b-96d0-7e92-84fa-cb7b55d73466`, then approved from the target side
    into injected turn `019e8089-1558-79f2-b164-9c53f7cb1fc5`.
  - Public repository was synced, validated, committed, and pushed:
    `1a386c4 修复跨线程任务卡片 draft 自动创建`.
  - Private local changes are still uncommitted at this handoff update point.

## Preserved Recent Handoff Tail

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

## 2026-05-30 Mobile Workspace Creation v131

- User request:
  - Add a create-workspace feature, but place the entry at the bottom of the
    Workspace dropdown list instead of beside the new-thread button.
- Local implementation:
  - Added `adapters/workspace-registry-service.js`.
    - Creates or registers a simple local workspace folder under allowed parent
      roots.
    - Rejects absolute paths, path traversal, slash/backslash names, invalid
      Windows filename characters, and reserved Windows device names.
    - Stores only bounded metadata in
      `%USERPROFILE%\.codex-mobile-web\workspace-registry.json` by default.
    - Uses `CODEX_MOBILE_WORKSPACE_CREATE_ROOTS` for allowed parent roots and
      `CODEX_MOBILE_WORKSPACE_REGISTRY_FILE` for registry-file override.
  - `server.js`
    - `GET /api/workspaces` now merges Codex-visible roots with Mobile
      Web-created registry roots.
    - `POST /api/workspaces` creates/registers a workspace through the adapter.
    - `visibleWorkspaceRoots()` includes registry roots so new-thread
      visibility checks accept Mobile Web-created cwd values without editing
      `.codex` global state.
    - `/api/public-config` exposes safe `workspaceCreate` diagnostics.
  - `public/app.js`, `public/index.html`, `public/styles.css`
    - Workspace dropdown appends a bottom `Create Workspace` action.
    - Creation opens a small dialog, then selects the created cwd and opens a
      new-thread draft.
    - The new-thread button placement is unchanged; no extra button was added
      beside it.
    - Static shell build/cache bumped to
      `0.1.11|codex-mobile-shell-v131` / `codex-mobile-shell-v131`.
  - Documentation updated in README, Architecture, Modules, Troubleshooting,
    Complex Feature Paths, and this handoff.
- Validation:
  - `node --check adapters\workspace-registry-service.js`, `node --check
    server.js`, `node --check public\app.js`, and `node --check public\sw.js`
    passed.
  - Focused `node --test test\workspace-registry-service.test.js
    test\new-thread-route.test.js test\mobile-viewport.test.js
    test\new-thread-ui.test.js test\thread-task-card-route.test.js` passed:
    22/22.
  - Hidden-window rerun after Windows process recovery:
    - focused tests passed: 22/22;
    - `npm.cmd run check` passed;
    - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings;
    - `npm.cmd test` passed: 233/233;
    - `npm.cmd run check:macos` passed.
- Status:
  - Local changes are uncommitted.

## 2026-06-01 Workspace Token Usage SQLite Ledger v143

- User request:
  - Add token consumption statistics with Workspace as the primary unit.
  - Persist in real time to SQLite because continuation compaction or rollout
    cleanup can remove transient context; do not depend on browser memory or
    later rollout scans for project totals.
  - Sidebar should show Workspace cumulative, weekly, and daily usage in `万`,
    with a button for per-day details. Per-thread stats are secondary because
    completed turns already show their own Usage card.
- Local implementation:
  - Added `adapters/token-usage-stats-service.js`.
    - Creates `%USERPROFILE%\.codex-mobile-web\token-usage-stats.sqlite` by
      default, overrideable with `CODEX_MOBILE_TOKEN_USAGE_DB`.
    - Stores one row per `(thread_id, turn_id)` with cwd, local day, token
      components, model, and source.
    - Upserts repeated turn completions instead of double-counting.
    - Aggregates Workspace total/today/week/daily stats for `/api/threads`.
  - Extended `adapters/sqlite-cli.js` with `runSqliteExec()` for schema/upsert
    execution.
  - `server.js`
    - Records completed-turn usage into SQLite on `turn/completed` after
      resolving the scoped turn usage summary.
    - Decorates thread-list results with Workspace `mobileTokenUsage`.
    - Changed `/api/public-config` build/cache reporting to use the shell
      snapshot captured at server startup, so editing static files on disk does
      not trigger "页面有新版本" before the 8787 listener actually restarts into
      the new build.
  - `public/app.js` / `public/index.html` / `public/styles.css`
    - Adds Workspace token summary under the Workspace selector:
      `总 / 周 / 今`, unit `万`.
    - Adds a compact `每日` toggle with recent per-day totals.
    - Keeps thread-list token display as a small today badge only.
  - `public/app.js` / `public/sw.js`
    - Static shell bumped to `0.1.11|codex-mobile-shell-v143` /
      `codex-mobile-shell-v143`.
  - Documentation updated:
    - README
    - `.agent-context/PROJECT_CONTEXT.md`
    - `docs/ARCHITECTURE.md`
    - `docs/MODULES.md`
    - `docs/COMPLEX_FEATURE_PATHS.md`
    - `docs/TROUBLESHOOTING.md`
- Validation so far:
  - `node --check adapters\sqlite-cli.js` passed.
  - `node --check adapters\token-usage-stats-service.js` passed.
  - `node --check adapters\turn-usage-summary-service.js` passed.
  - `node --check server.js` passed.
  - `node --check public\app.js` passed.
  - `node --check public\sw.js` passed.
  - Focused `node --test test\token-usage-stats-service.test.js
    test\turn-usage-summary-service.test.js` passed: 11/11.
- Status:
  - Local changes are uncommitted.
  - Need rerun focused mobile viewport test after updating its shell-cache
    expectation to v143, then run broader validation.

## 2026-06-01 Codex Profile Switcher v142

- User request:
  - Continue the simpler dual-Codex-provider direction as a single active
    profile switcher.
  - Settings should show `previous` and `current` with the logged-in account,
    not only profile ids, and switching should apply to all workspaces.
- Local fix:
  - Added `adapters/codex-profile-service.js`.
    - Discovers the default `.codex` home plus `.codex-homes\current` and
      `.codex-homes\previous`.
    - Safely reads `auth.json` to expose account labels such as email/name or a
      redacted account id without returning raw token fields.
    - Scans recent rollout tails per profile for quota snapshots.
    - Persists the selected `activeProfileId` in
      `%USERPROFILE%\.codex-mobile-web\codex-profiles.json`.
    - Disables switching when the process is pinned to fixed external app-
      server endpoints instead of the per-profile mux endpoint path.
  - `server.js`
    - Uses the profile store during startup when `CODEX_HOME` is not explicitly
      set.
    - Adds authenticated `GET /api/codex-profiles` and
      `POST /api/codex-profiles/active`.
    - Includes `codexProfiles` in `/api/public-config` and `/api/status`.
    - Active-profile switching writes the store and delegates to the shared-
      chain restart service.
  - `start-codex-mobile-web-windowless.ps1`
    - Reads `%USERPROFILE%\.codex-mobile-web\codex-profiles.json` before
      starting the standalone mux or Node listener, so the selected
      `CODEX_HOME` applies after restart.
  - `public/app.js`, `public/index.html`, `public/styles.css`
    - Settings panel now renders Codex profile rows with profile label,
      logged-in account label, `CODEX_HOME` path, quota snapshot, and switch
      button.
    - Switching shows a confirmation, calls `/api/codex-profiles/active`, then
      waits for restart/reconnect.
  - `public/app.js` / `public/sw.js`
    - Static shell build/cache bumped to
      `0.1.11|codex-mobile-shell-v142` / `codex-mobile-shell-v142`.
  - Documentation updated:
    - README
    - `docs/ARCHITECTURE.md`
    - `docs/MODULES.md`
    - `docs/MULTI_ACCOUNT_CODEX_CLI.md`
    - `docs/TROUBLESHOOTING.md`
    - `.agent-context/PROJECT_CONTEXT.md`
- Validation/status:
  - Focused `node --test test\codex-profile-service.test.js
    test\codex-profile-ui.test.js test\mobile-viewport.test.js
    test\manual-restart-ui.test.js test\composer-quota.test.js` passed: 20/20.
  - `npm.cmd test` passed: 269/269.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - BOM check for touched source/test/docs/context files had no output.
  - Restarted the 8787 listener by stopping old PID `88388`; the hidden
    launcher restarted it as PID `63732`.
  - Post-restart `/api/public-config` returns
    `clientBuildId=0.1.11|codex-mobile-shell-v142` and
    `shellCacheName=codex-mobile-shell-v142`.
  - Post-restart authenticated `/api/status` is healthy:
    `ready=true`, `transport=external-jsonl-tcp`, `lastError=null`.
  - Post-restart `GET /api/codex-profiles` returns:
    - active profile: `default`
    - `default`: logged in as `5gdxrncpzf@privaterelay.appleid.com`
    - `current`: logged in as `lkf12101975@icloud.com`
    - `previous`: not logged in
  - Local changes are uncommitted.
- Follow-up note:
  - User suggested deferring client refresh prompts until server-side restart
    and resource readiness are fully confirmed. This was not implemented in
    v142, but should be considered for the next frontend update/restart prompt
    pass so a client is not prompted to refresh before the new listener is
    actually ready.

## 2026-06-01 Codex Profile Quota Snapshot Persistence

- User report:
  - Non-active profiles were expected to show quota snapshots when available,
    but the settings panel showed no snapshot for `current` / `previous`.
- Diagnosis:
  - `/api/codex-profiles` returned live quota for active `default`, but
    `.codex-homes\current` and `.codex-homes\previous` had no rollout JSONL
    files with `rate_limits` events, so there was no snapshot to scan.
  - The first v142 implementation also did not persist the active profile's
    live quota into the profile store, so a profile would lose its last known
    quota display after it became inactive unless a rollout file contained
    usable `rate_limits`.
- Local fix:
  - `adapters/codex-profile-service.js`
    - Added `quotaSnapshots` persistence in
      `%USERPROFILE%\.codex-mobile-web\codex-profiles.json`.
    - `profiles({ activeQuota })` now stores the current active profile's live
      quota snapshot and reuses stored snapshots when rollout scanning has no
      usable data.
  - `server.js`
    - Passes active `latestRateLimits` / `rateLimitsByModelObject()` into
      profile responses for `/api/public-config`, `/api/status`, and
      `/api/codex-profiles`.
  - `test/codex-profile-service.test.js` now covers persisted snapshot reuse
    and snapshot assignment to the selected active profile.
- Validation/status:
  - Focused `node --test test\codex-profile-service.test.js
    test\codex-profile-ui.test.js test\composer-quota.test.js` passed: 15/15.
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - Restarted 8787 by stopping old PID `63732`; hidden launcher restarted it
    as PID `58832`.
  - Runtime `GET /api/codex-profiles` now persists `default` quota snapshot:
    5-hour used `66%` and weekly used `22%`, stored under
    `quotaSnapshots.default`.
  - `current` and `previous` still have no quota snapshot yet because their
    homes currently have no rollout `rate_limits` events and have not been
    active under the new snapshot-persistence code.

## 2026-05-31 Composer Fast Dot Toggle v139

- User request:
  - Add a Codex Fast switch, not a Spark-model switch or reasoning-effort change.
  - Place it in the runtime row before model/reasoning/permission/quota while
    keeping the footprint minimal.
- Local fix:
  - `public/index.html`
    - Added `composerCommandControl` before `composerModelControl` as a tiny
      Fast status dot instead of a full-width command card.
  - `public/app.js`
    - Added persistent `codexMobileCodexFastMode` browser state.
    - The dot toggles directly: green is normal mode, red is Fast mode.
    - Toggling briefly shows `Fast on` / `Fast off` in the connection status
      area and updates the button title / `aria-label`.
    - When Fast is enabled, normal existing-thread and new-thread message
      submissions include hidden `fastMode=1` instead of adding visible `/Fast`
      text.
  - `server.js`
    - Maps requested `fastMode` to Codex `serviceTier: "priority"` on the next
      `turn/start`, matching the Fast service tier exposed in
      `%USERPROFILE%\.codex\models_cache.json`.
    - The Fast toggle does not change model, reasoning effort, permission mode,
      quota grouping, or Spark model selection.
    - `#` cross-thread task-card commands keep their bounded draft-request flow
      and active-turn steering waits until the next new turn for the speed tier.
  - `public/styles.css`
    - Composer runtime row now uses a left-aligned 18px Fast dot column before
      model, reasoning, permission, and quota.
  - `public/app.js` / `public/sw.js`
    - Static shell build/cache bumped to
      `0.1.11|codex-mobile-shell-v139` / `codex-mobile-shell-v139`.
  - Documentation updated:
    - README
    - `.agent-context/PROJECT_CONTEXT.md`
    - `docs/MODULES.md`
- Validation/status:
  - `node --check public\app.js` and `node --check public\sw.js` passed.
  - Focused `node --test test\composer-quota.test.js
    test\mobile-viewport.test.js test\tablet-layout.test.js
    test\new-thread-route.test.js` passed: 19/19.
  - Focused `node --test test\thread-task-card-route.test.js
    test\composer-quota.test.js test\mobile-viewport.test.js
    test\tablet-layout.test.js test\new-thread-route.test.js` passed: 22/22.
  - `npm.cmd test` passed: 255/255.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - BOM check for touched source/test/docs/context files had no output.
  - Restart was attempted after validation but was interrupted by the next user
    request. Last observed 8787 listener before the v139 restart was PID
    `29792`, still serving the pre-bump runtime.
  - The last authenticated `/api/status` check before the v139 restart attempt
    was healthy:
    `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`,
    `lastError=null`.
  - Static frontend/PWA change requires restarting/reloading the Mobile Web
    listener and clients refreshing/reopening to load v139
    after deployment.

## 2026-05-31 Public Sync v139

- User request:
  - Push the current private product state to the clean public repository.
- Public repository:
  - Path: `C:\Users\xuxin\Documents\codex-mobile-web-public`
  - Commit pushed: `d66cc63 发布 Hermes 外观同步、跨线程卡片修复与 Fast 圆点`
  - Remote branch: `origin/main`
- Scope:
  - Synchronized public-safe product, docs, scripts, and tests from private
    through v139.
  - Excluded `.agent-context`, `AGENTS.md`, runtime state, uploads, keys, and
    machine-local diagnostics.
  - Added a detailed Chinese public README release note covering Hermes
    appearance sync, notification title resolution, task-card re-entry /
    source Sending fixes, autonomous workflows, workspace registry, and the
    Fast dot service-tier toggle.
- Public validation:
  - `npm.cmd test` passed: 255/255.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` / staged check passed with only Windows LF-to-CRLF
    working-copy warnings.
  - BOM check had no output.
  - Staged privacy scan found no raw secrets.
- Status:
  - Public repository is clean and aligned with `origin/main`.
  - Private repository product code remains clean; this handoff entry is the
    only follow-up private context update.

## 2026-05-31 Hermes Plugin HTTPS Manifest Runtime Fix

- User report:
  - The Hermes embedded Codex plugin eventually opened, but its settings page
    showed an update-settings check failure.
- Diagnosis:
  - `/api/public-config` was reachable and returned
    `0.1.11|codex-mobile-shell-v131`.
  - Authenticated `/api/status` was healthy:
    `ready=true`, `transport=external-jsonl-tcp`, `lastError=null`.
  - Authenticated `/api/app-update/status?force=1` did not fail; it returned
    `state=blocked`, `reason=working tree has local changes`, `dirty=true`.
    That is expected while v131 local changes are uncommitted.
  - The Hermes plugin manifest for
    `hermesOrigin=https://hermes-xuxin.synology.me:8445` still returned
    `entry.url=http://127.0.0.1:8787/?embed=hermes` and
    `program_api.base_url=http://127.0.0.1:8787`, because the running
    windowless supervisor had been started without `-HermesPluginBaseUrl` or
    `-PublicBaseUrl`.
  - The `Codex Mobile Web` scheduled task was updated, but the old windowless
    supervisor kept running with stale arguments until its specific process tree
    was stopped.
- Runtime fix:
  - Updated the `Codex Mobile Web` Scheduled Task arguments to include:
    - `-HermesPluginBaseUrl "https://gmk.tail62e8ce.ts.net:8443"`;
    - `-PublicBaseUrl "https://gmk.tail62e8ce.ts.net:8443"`;
    - `-HermesPluginFrameOrigins "https://hermes-xuxin.synology.me:8445"`;
    - existing Hermes notification delegate base URL and key-file parameters.
  - Stopped only the verified stale Mobile Web process tree for this workspace:
    the old `server.js` listener, its `start-codex-mobile-web-windowless.ps1`
    parent, and the hidden VBS launcher parent.
  - Started the updated `Codex Mobile Web` scheduled task.
- Verification:
  - New 8787 listener PID `21640` is parented by
    `start-codex-mobile-web-windowless.ps1` with the new
    `-HermesPluginBaseUrl`, `-PublicBaseUrl`, and `-HermesPluginFrameOrigins`
    arguments.
  - Manifest now returns:
    - `entry.url=https://gmk.tail62e8ce.ts.net:8443/?embed=hermes`;
    - `program_api.base_url=https://gmk.tail62e8ce.ts.net:8443`;
    - `frame_ancestors='self' https://hermes-xuxin.synology.me:8445`;
    - empty mixed-content diagnostics.
  - Authenticated `/api/status` remains healthy.
- Status:
  - This was an operational scheduled-task/runtime fix plus context update.
  - No code was changed for this fix, and nothing was committed or pushed.

## 2026-05-31 Thread Task Card Route Error-Code Closure

- User request:
  - Confirm the cross-thread task-card implementation was not affected by the
    recent runtime/startup rollback work, then close the small issue found and
    commit/push.
- Diagnosis:
  - CodeGraph and direct inspection confirmed the card implementation still
    exists:
    - `adapters/thread-task-card-service.js`;
    - `/api/thread-task-cards*` routes in `server.js`;
    - `thread.threadTaskCards` detail enrichment;
    - frontend `#` draft path, pending-card rendering, and approve/focus logic.
  - Focused harness passed for card creation, target approval injection, delete,
    revoke, reply, route exposure, thread-detail enrichment, frontend signatures,
    and XML-suppression.
  - A no-side-effect runtime probe for a missing card reached the route but
    returned a generic 500. The service already throws `statusCode=404`; the
    route was letting that escape to the top-level 500 handler.
- Local fix:
  - `server.js`
    - Wrapped all thread-task-card routes (`create`, `get`, `approve`, `delete`,
      `revoke`, `reply`) in route-local error handlers that preserve
      `err.statusCode || 500`.
    - Missing-card reads now return `404 task_card_not_found`; wrong-thread and
      settled-card actions can return their existing `403` / `409` service codes.
  - `test/thread-task-card-route.test.js`
    - Added a static harness assertion that the route block preserves service
      status codes for all six task-card routes.
  - `docs/TROUBLESHOOTING.md`
    - Documented expected `404` / `403` / `409` task-card API diagnostics.
- Status:
  - Validation:
    - `node --check server.js` passed.
    - Focused `node --test test\thread-task-card-harness.test.js
      test\thread-task-card-service.test.js test\thread-task-card-route.test.js
      test\conversation-render.test.js test\mobile-viewport.test.js` passed:
      31/31.
    - `npm.cmd test` passed: 234/234.
    - `npm.cmd run check` passed.
    - `npm.cmd run check:macos` passed.
    - `git diff --check` passed with only Windows LF-to-CRLF warnings.
  - Deployment:
    - Restarted the verified stale Mobile Web process tree and started the
      `Codex Mobile Web` scheduled task.
    - New 8787 listener PID is `29796`.
    - Runtime missing-card probe now returns HTTP `404` instead of generic `500`.
  - Commit/push are the next required steps in this turn.

## 2026-05-31 Multi-Target Task Cards And Embed Primary Startup v132

- User request:
  - Let cross-thread task cards target multiple threads.
  - In Hermes plugin mode, do not automatically enter the most recent/restored
    Codex thread.
- Local implementation:
  - `adapters/thread-task-card-service.js`
    - Added `createMany()` and multi-target normalization.
    - A batch request expands to one stored pending card per unique target
      thread, with target-specific idempotency keys.
    - The existing single-target `create()` path remains compatible.
  - `server.js`
    - `POST /api/thread-task-cards` now accepts either `targetThreadId` or
      `targetThreadIds`.
    - The response keeps `card` for old callers and adds `cards` for the full
      batch result.
  - `public/app.js`
    - `#` draft prompts now ask the model for `targetThreadIds`.
    - Draft parsing still accepts legacy `targetThreadId`.
    - Source-side draft approval creates all target cards in one request.
    - Single-target drafts still open the target thread directly; multi-target
      drafts stay on the source thread and update outgoing/incoming card counts.
    - The manual `Send task card` prompt accepts comma/semicolon/newline
      separated target names or ids.
    - Hermes `?embed=hermes` startup ignores locally saved recent thread restore
      when there is no explicit launch target, URL thread hint, or Hermes route
      hint, so the plugin opens on the embedded primary thread-switcher/settings
      page.
  - `public/app.js` / `public/sw.js`
    - Static shell build/cache bumped to `0.1.11|codex-mobile-shell-v132` /
      `codex-mobile-shell-v132`.
  - Documentation updated:
    - README, Architecture, Modules, Complex Feature Paths, Cross-Thread design
      and implementation docs, Project Context, and this handoff.
- Validation:
  - `node --check adapters\thread-task-card-service.js`, `node --check server.js`,
    `node --check public\app.js`, and `node --check public\sw.js` passed.
  - Focused `node --test test\thread-task-card-service.test.js
    test\thread-task-card-route.test.js test\conversation-render.test.js
    test\mobile-viewport.test.js test\plugin-embed.test.js` passed: 33/33.
  - `npm.cmd test` passed: 235/235.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
- Deployment:
  - Restarted the 8787 Node listener: old PID `29796`, new PID `50680`.
  - `/api/public-config` now returns
    `clientBuildId=0.1.11|codex-mobile-shell-v132` and
    `shellCacheName=codex-mobile-shell-v132`.
  - Authenticated `/api/status` remains healthy:
    `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`,
    `lastError=null`.
- Status:
  - Local changes are uncommitted.
  - Static frontend/PWA changes require clients to refresh/reopen to load v132.

## 2026-05-31 Hermes Plugin Appearance Sync v133

- User request:
  - When Hermes opens embedded plugins, pass the current tone/theme and font
    settings into the plugin and make the plugin apply them before initializing,
    so the iframe does not flash the wrong appearance.
  - After Codex implementation, send cross-thread task cards to the Hermes/Codex,
    Finance, and Wardrobe-related threads for host/plugin cooperation.
- Local implementation:
  - `adapters/hermes-plugin-service.js`
    - Added a metadata-only `appearance_sync` manifest contract.
    - `POST /api/v1/hermes/plugin/launch` now accepts bounded
      `appearance.theme` (`system`, `dark`, `light`) and
      `appearance.fontSize` (`small`, `default`, `large`, `xlarge`,
      `xxlarge`).
    - The short `entry_path` carries only safe `pluginTheme` /
      `pluginFontSize` query params, and `/session` returns the same sanitized
      `appearance` object.
  - `public/plugin-embed.js`
    - Parses bounded appearance query params alongside launch and route hints.
  - `public/index.html`
    - Applies plugin theme and font size before `styles.css` and `public/app.js`
      load, reusing local preferences only when Hermes provides no appearance.
  - `public/app.js`
    - Applies session appearance after launch-token exchange, preserves safe
      appearance params when scrubbing the launch token, and keeps standalone
      `localStorage` preferences unchanged outside embed mode.
  - `public/app.js` / `public/sw.js`
    - Static shell build/cache bumped to
      `0.1.11|codex-mobile-shell-v133` / `codex-mobile-shell-v133`.
  - Documentation updated:
    - README, Architecture, Modules, Complex Feature Paths, Project Context,
      and this handoff.
- Validation/status:
  - `node --check adapters\hermes-plugin-service.js`,
    `node --check public\plugin-embed.js`, `node --check public\app.js`, and
    `node --check public\sw.js` passed.
  - Focused `node --test test\hermes-plugin-service.test.js
    test\hermes-plugin-route.test.js test\plugin-embed.test.js
    test\mobile-viewport.test.js` passed: 25/25.
  - `npm.cmd test` passed: 237/237.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - Deployment:
    - The first `/api/restart/shared-chain` request returned accepted but did
      not change the 8787 listener PID, so the service was restarted through the
      Windows scheduled task path with explicit old-PID verification.
    - Old listener PID `50680` was stopped; new listener PID `47248` is serving
      `clientBuildId=0.1.11|codex-mobile-shell-v133` and
      `shellCacheName=codex-mobile-shell-v133`.
    - Authenticated `/api/status` is healthy:
      `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`,
      `lastError=null`.
    - Manifest probe for Hermes HTTPS origin returns the HTTPS Codex entry,
      `appearance_sync`, registered frame ancestor, and no mixed-content
      diagnostics.
    - Launch/session probe with `appearance.theme=light` and
      `appearance.fontSize=xlarge` returned safe `pluginTheme` /
      `pluginFontSize` in `entry_path` and sanitized session `appearance`
      without leaking the injected test field.
  - Cross-thread cards:
    - A first PowerShell-sent Chinese JSON request created mojibake task-card
      content. Two pending cards were revoked. The Wardrobe card had already
      been approved into turn `019e7b62-f45c-78f1-81f3-05b49d7c14ed`, so that
      bad turn was interrupted and left in `interrupted` state.
    - Replacement ASCII/UTF-8-safe pending cards were created:
      `ttc_4ea4082609d6e8fa1d` for Hermes 05-26,
      `ttc_c720ba1fe6eb724c97` for Finance, and
      `ttc_cb2fdc78f4ca2b3098` for Wardrobe.
  - Local changes are uncommitted.
  - Static frontend/PWA changes require clients to refresh/reopen or receive a
    Hermes plugin refresh to load v133.

## 2026-05-31 Thread Task Card Sending Harness Hardening

- User request:
  - Solidify the cross-thread task-card sending flow with harness coverage after
    a manual PowerShell-sent Chinese JSON request created duplicate/mojibake
    cards.
  - Also send the appearance-sync coordination card to the Finance thread.
- Local implementation:
  - `adapters/thread-task-card-service.js`
    - Added a readable visible-text guard for task-card `title`, `summary`, and
      `body`.
    - The service now rejects likely encoding-damaged card text before
      persistence, including replacement characters, typical UTF-8/Latin-1
      mojibake markers, and high-density repeated `?` clusters such as
      `?? Hermes ?????? v133`.
    - Oversized optional source-thread title metadata is truncated to its
      existing 200-character bound instead of failing otherwise valid card
      creation. Visible card title/summary/body bounds still reject over-limit
      content.
  - Harness/tests:
    - `test/thread-task-card-harness.test.js` now asserts encoding-damaged
      visible card text is rejected.
    - `test/thread-task-card-service.test.js` now covers UTF-8 card text
      preservation, stable idempotency, bad-text rejection before store writes,
      replacement-character rejection, oversized source-title metadata bounding,
      and reply bad-text rejection without settling the original card.
  - Documentation updated:
    - `.agent-context/PROJECT_CONTEXT.md`
    - `docs/CROSS_THREAD_TASK_CARDS_DESIGN.md`
    - `docs/CROSS_THREAD_TASK_CARDS_IMPLEMENTATION.md`
    - `docs/MODULES.md`
- Validation:
  - `node --check adapters\thread-task-card-service.js` passed.
  - Focused `node --test test\thread-task-card-harness.test.js
    test\thread-task-card-service.test.js test\thread-task-card-route.test.js
    test\conversation-render.test.js` passed: 34/34.
  - `npm.cmd test` passed: 243/243.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - BOM check for touched source/test/docs/context files had no output.
- Deployment/runtime verification:
  - Restarted the 8787 Node listener after the service change: old PID `60804`,
    new PID `57788`.
  - Authenticated `/api/status` is healthy:
    `ready=true`, `transport=external-jsonl-tcp`, `lastError=null`.
  - Runtime bad-card probe returned HTTP `400` with
    `task_card_text_encoding_damaged:title` and did not persist the probe card.
- Finance card:
  - Sent a replacement safe ASCII task card to Finance thread
    `019e6e22-e3d3-7e60-bcc2-027d40895193`.
  - New card id: `ttc_fccaf8f25a9438d02e`.
  - Status after runtime verification: `pending`.
- Status:
  - Local changes remain uncommitted.
  - No public repository sync was performed.

## 2026-05-31 Source-Side Task Card Auto-Send v134

- User report:
  - A feature had regressed: when sending a cross-thread card from the source
    thread, the source thread should not require a local approval step. The
    target thread is where `Approve` belongs.
- Diagnosis:
  - `public/app.js` still rendered the parsed `#` command draft as a
    source-side `Cross-thread task card draft` approval card with
    `data-task-card-draft-action="approve"`.
  - `.agent-context/PROJECT_CONTEXT.md` and README still described the older
    source-side approval behavior, so the current code and docs both reflected
    the stale rule.
- Local fix:
  - `public/app.js`
    - A valid parsed `#` draft now queues automatic pending-card creation via
      `queueThreadTaskCardDraftCreation()` / `createThreadTaskCardDraft()`.
    - The shipped source-side draft UI no longer includes
      `data-task-card-draft-action="approve"` and no longer references
      `approveThreadTaskCardDraft`.
    - While the automatic create request is in progress, the source turn shows
      only a short `Sending cross-thread task card...` placeholder.
    - If the model draft is incomplete or names missing target threads, the
      source thread shows a bounded failed diagnostic that can be dismissed.
    - Target-side pending cards still keep `Approve`; only target approval
      injects a real target-thread turn.
  - `public/app.js` / `public/sw.js`
    - Static shell build/cache bumped to
      `0.1.11|codex-mobile-shell-v134` / `codex-mobile-shell-v134`.
  - Documentation updated:
    - README
    - `.agent-context/PROJECT_CONTEXT.md`
    - `docs/CROSS_THREAD_TASK_CARDS_DESIGN.md`
    - `docs/CROSS_THREAD_TASK_CARDS_IMPLEMENTATION.md`
    - `docs/MODULES.md`
- Validation:
  - `node --check public\app.js` passed.
  - `node --check public\sw.js` passed.
  - Focused `node --test test\thread-task-card-route.test.js
    test\conversation-render.test.js test\mobile-viewport.test.js` passed:
    23/23.
  - `npm.cmd test` passed: 243/243.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
- Status:
  - Local changes remain uncommitted.
  - Static frontend/PWA change requires clients to refresh/reopen or receive a
    Hermes plugin refresh to load v134.

## 2026-05-31 Target Task Card Approve Compaction Race Fix

- User report:
  - A target-thread cross-thread task card was approved and began executing,
    but a continuation compaction happened during that window. After compaction,
    the same actionable `Approve` card appeared again even though the injected
    target turn was already running.
- Diagnosis:
  - `adapters/thread-task-card-service.js` previously called the external
    target-thread `turn/start` path while the card still had `status=pending`,
    and only persisted `approved` after that external call returned.
  - Any thread refresh, reconnect, or continuation compaction during that
    in-flight window could re-read the task-card store and render a duplicate
    pending approval card.
- Local fix:
  - `approve()` now persists a transient non-pending `approving` state before
    calling the external injected-turn path.
  - `approving` cards do not count as pending and are not actionable in thread
    detail, so refresh/compaction cannot resurrect a second `Approve` button.
  - If external execution fails before acceptance, the service restores the
    card to `pending` with a bounded `approvalError` audit field so the target
    can retry.
  - Documentation updated in README, Architecture, Modules, Cross-Thread design
    and implementation docs, Project Context, and this handoff.
- Validation:
  - `node --check adapters\thread-task-card-service.js` passed.
  - Focused `node --test test\thread-task-card-service.test.js
    test\thread-task-card-harness.test.js test\thread-task-card-route.test.js
    test\conversation-render.test.js` passed: 37/37.
  - `npm.cmd test` passed: 246/246.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - BOM check for touched source/test/docs/context files had no output.
- Deployment/runtime verification:
  - Restarted the 8787 Node listener by stopping old PID `57788`; the existing
    hidden windowless launcher restarted it as PID `49964`.
  - `/api/public-config` still returns
    `clientBuildId=0.1.11|codex-mobile-shell-v134` and
    `shellCacheName=codex-mobile-shell-v134`.
  - Authenticated `/api/status` is healthy:
    `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`,
    `lastError=null`.
- Status:
  - Local changes remain uncommitted.
  - This is server-side service behavior; no static shell cache bump was
    required.

## 2026-05-31 Hermes Plugin Notification Thread Title Fix

- User report:
  - Web Push / Hermes plugin delegated notifications did not show the correct
    Codex thread name; the posted notification title could use a wrong generic
    plugin/post label.
  - Follow-up screenshot showed the top external notification title as the
    old continuation bootstrap prompt (`# 压缩续接启动上下文...`) instead of
    `Codex Mobile 05-26`.
- Diagnosis:
  - The local `state_5.sqlite` row for the current thread still carried the
    old bootstrap prompt as `title` / `first_user_message`.
  - The first resolver fix was insufficient because completed-turn events may
    not carry an explicit thread name, and `pushThreadSummary()` still checked
    SQLite before any app-server display summary.
- Local fix:
  - `adapters/push-notification-service.js`
    - Added `resolveThreadTitleForNotification()`.
    - Completed-turn notification title resolution now prefers explicit
      app-server thread names/titles, including nested `turn.thread.name` and
      `turn.thread.title`, before stale started-turn labels or preview text.
    - Persisted thread `name` wins over persisted `preview`; preview remains
      only a fallback.
    - Owns the bounded app-server display-summary cache used by notification
      title resolution before the local SQLite fallback.
  - `server.js`
    - Uses the new resolver for both direct Web Push and Hermes plugin
      delegated notifications.
    - Instantiates the adapter-owned display cache and populates it from
      successful app-server `thread/list` and `thread/read` display summaries.
    - `pushThreadSummary()` now checks this app-server display cache before
      the local SQLite fallback so stale continuation bootstrap titles do not
      win over the name the Mobile Web UI is already showing.
    - Completed-turn notification sending refreshes the app-server summary
      before delivery when the display cache is empty, so a freshly restarted
      server is not forced back to the stale SQLite title.
  - Documentation updated:
    - README
    - `docs/ARCHITECTURE.md`
    - `docs/MODULES.md`
    - `.agent-context/PROJECT_CONTEXT.md`
    - this handoff.
- Validation:
  - `node --check adapters\push-notification-service.js` passed.
  - `node --check server.js` passed.
  - Focused `node --test test\push-notification-service.test.js
    test\hermes-notification-delegate-service.test.js
    test\hermes-plugin-route.test.js` passed: 28/28.
  - `npm.cmd test` passed: 252/252.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - BOM check for touched source/test/docs/context files had no output.
- Deployment/runtime verification:
  - Restarted the 8787 Node listener through the Windows scheduled-task
    configuration, then stopped the old child Node PID `65488` and relaunched
    with the same hidden scheduled-task parameters. Final listener PID after
    the service-boundary follow-up: `82632`.
  - `/api/public-config` still returns
    `clientBuildId=0.1.11|codex-mobile-shell-v134` and
    `shellCacheName=codex-mobile-shell-v134`; Hermes notification delegate is
    configured and `imageContextMode=reference`.
  - Authenticated `/api/status` is healthy:
    `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`,
    `lastError=null`.
  - Authenticated `/api/threads?limit=200` finds current thread
    `019e63ea-b64f-7e93-a92f-4c1dd9a79326` with display `name=Codex Mobile
    05-26` while its preview still starts with the old continuation bootstrap,
    confirming the display-summary source needed for Push titles.
- Status:
  - This entry is included in the local private commit for the notification
    title fix and service-boundary cleanup; use `git log -1 --oneline` for the
    final commit hash.
  - Public repository was not synced or pushed.

## 2026-06-01 Profile-Aware Desktop Recovery And Restart Scope

- User concern:
  - Even though Mobile Web can now switch Codex CLI profiles, Desktop remains
    important as an escape hatch if Mobile Web breaks. Desktop/Mobile must not
    silently diverge when profiles are switched.
- Local fix:
  - `start-codex-desktop-shared.ps1`
    - Added `-ProfileId default|current|previous` and `-CodexHome`.
    - Resolves the selected profile home and uses that profile's
      `<CODEX_HOME>\app-server-mux\endpoint.json`.
    - Sets `CODEX_HOME` for the launched Desktop bridge process.
  - Added convenience wrappers:
    - `start-codex-desktop-default.cmd`
    - `start-codex-desktop-current.cmd`
    - `start-codex-desktop-previous.cmd`
    - The wrappers call the shared launcher with `-ForceRestartMux` so the
      Desktop recovery path starts from the selected profile's current bridge
      files.
  - `restart-codex-mobile-shared-chain.ps1`
    - Added `-ProfileId` and `-CodexHome`.
    - Resolves the active profile from
      `%USERPROFILE%\.codex-mobile-web\codex-profiles.json` before selecting the
      mux endpoint.
    - Stops only the selected endpoint's recorded mux/child PIDs plus the
      Mobile Web listener/launcher processes, instead of sweeping every mux
      process created from this repository.
  - `adapters/shared-chain-restart-service.js`
    - `buildRestartPowerShellCommand()` can pass explicit `-ProfileId` or
      `-CodexHome`; the normal restart path leaves them unset so the script
      reads the latest active profile store after a profile switch request.
  - Documentation updated:
    - README
    - `.agent-context/PROJECT_CONTEXT.md`
    - `docs/ARCHITECTURE.md`
    - `docs/MODULES.md`
    - `docs/TROUBLESHOOTING.md`
    - `docs/MULTI_ACCOUNT_CODEX_CLI.md`
- Validation:
  - Focused `node --test test\desktop-profile-launcher.test.js
    test\shared-chain-restart-script.test.js
    test\shared-chain-restart-service.test.js
    test\codex-profile-service.test.js test\codex-profile-ui.test.js` passed:
    22/22.
  - `npm.cmd test` passed: 277/277.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - Dry-run verification:
    - `restart-codex-mobile-shared-chain.ps1 -DryRun -NoStart -ProfileId
      default` resolved `C:\Users\xuxin\.codex` and listed only the default
      endpoint mux/child PIDs plus Mobile Web listener/launcher processes.
    - `... -ProfileId previous` resolved
      `C:\Users\xuxin\.codex-homes\previous`; because that profile currently
      has no endpoint file, it did not list unrelated profile mux/child PIDs.
- Status:
  - Local changes remain uncommitted.
  - No public repository sync was performed in this continuation after this
    change.
  - Desktop shortcuts were created under
    `C:\Users\xuxin\OneDrive\Desktop\Codecs 快捷方式` and renamed by safe login
    account label: `5gdxrncpzf@privaterelay.appleid.com.lnk`,
    `lkf12101975@icloud.com.lnk`, and `2261065@qq.com.lnk`. They point to the
    repository `start-codex-desktop-*.cmd` wrappers.

## 2026-06-01 Public/Profile v142 Publish

- User request:
  - Commit and push, including public.
- Public repository:
  - Path: `C:\Users\xuxin\Documents\codex-mobile-web-public`
  - Commit pushed: `fc85ee4 发布 Codex Profile 切换与 Desktop 逃生路径`
  - Scope:
    - Codex profile service and settings UI.
    - v142 PWA shell.
    - Profile-aware Windows windowless startup, shared-chain restart, and
      Desktop shared launcher wrappers.
    - Profile/restart/Desktop launcher tests.
    - README and docs updates.
  - Validation before public commit:
    - `npm.cmd test` passed: 277/277.
    - `npm.cmd run check` passed.
    - `npm.cmd run check:macos` passed.
    - `git diff --check` and `git diff --cached --check` passed with only
      Windows LF-to-CRLF working-copy warnings.
    - Staged privacy scan found only documentation placeholders and fake test
      token fixtures; no real token/private key/account email/runtime state was
      staged.
- Private repository:
  - This handoff records the public publish state before the private commit.
  - This is server-side notification behavior; no static shell cache bump is
    required.

## 2026-05-31 Cross-Thread Autonomous Workflow v135

- User request:
  - Cross-thread task-card collaboration should support a special workflow in
    which only the first card requires human approval. After that approval, the
    cooperating threads can send cards back and forth inside the same workflow
    without another manual approval click.
- Local fix:
  - `adapters/thread-task-card-service.js`
    - Store now preserves an optional `workflows` array alongside `cards`.
    - Create/reply normalization accepts `workflowMode` and `workflowId`.
    - Ordinary cards remain manual.
    - `workflowMode="autonomous"` creates an autonomous workflow card with a
      bounded workflow id. If no id is supplied, the service derives a stable
      id from source thread, target thread, and idempotency key.
    - The first target-side approval executes normally, then activates a
      workflow grant scoped to the workflow id plus the unordered pair of the
      source and target thread ids.
    - Later pending cards with the same workflow id and same two thread ids use
      the same approval/injection path automatically. A reused workflow id with
      a different thread pair stays pending and needs its own first approval.
    - Automatic execution still persists `approving` before external
      `turn/start`; if injection fails before acceptance, the card is restored
      to `pending` with a bounded audit error.
  - `public/app.js`
    - `#` draft schema now lets the model return
      `workflowMode:"manual|autonomous"` and optional `workflowId`.
    - Draft rules tell the model to use autonomous mode only when the command
      explicitly asks for automatic/no-further-approval collaboration.
    - First autonomous target cards label the action as `Approve workflow` and
      show workflow id/status in details.
    - Source-side pending counters only increment for returned cards that are
      still `pending`, so auto-approved follow-up cards do not create stale
      task badges.
  - `public/app.js` / `public/sw.js`
    - Static shell build/cache bumped to
      `0.1.11|codex-mobile-shell-v135` / `codex-mobile-shell-v135`.
  - Documentation updated:
    - README
    - `.agent-context/PROJECT_CONTEXT.md`
    - `docs/ARCHITECTURE.md`
    - `docs/MODULES.md`
    - `docs/TROUBLESHOOTING.md`
    - `docs/COMPLEX_FEATURE_PATHS.md`
    - `docs/CROSS_THREAD_TASK_CARDS_REQUIREMENTS.md`
    - `docs/CROSS_THREAD_TASK_CARDS_DESIGN.md`
    - `docs/CROSS_THREAD_TASK_CARDS_IMPLEMENTATION.md`
- Validation:
  - `node --check adapters\thread-task-card-service.js` passed.
  - `node --check public\app.js` passed.
  - `node --check public\sw.js` passed.
  - Focused `node --test test\thread-task-card-service.test.js
    test\thread-task-card-harness.test.js test\thread-task-card-route.test.js
    test\conversation-render.test.js test\mobile-viewport.test.js` passed:
    44/44.
  - `npm.cmd test` passed: 255/255.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - BOM check for touched source, test, docs, README, and context files had no
    output.
- Status:
  - Local changes are uncommitted.
  - Restarted the 8787 Node listener after the service/frontend change:
    old PID `82632`, new PID `88428`.
  - Post-restart `/api/public-config` returns
    `clientBuildId=0.1.11|codex-mobile-shell-v135`,
    `shellCacheName=codex-mobile-shell-v135`, and
    `imageContextMode=reference`.
  - Post-restart authenticated `/api/status` is healthy:
    `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`,
    `lastError=null`.
  - This is both server-side task-card behavior and static frontend/PWA
    behavior. Open clients need the refresh prompt, hard refresh, close/reopen,
    or the Hermes plugin refresh path to load v135.
  - Public repository was not synced or pushed.

## 2026-05-31 Task Card Re-entry Resurrection Fix v136

- User report:
  - After a source thread sent a cross-thread task card, the source thread still
    retained task-card UI.
  - The target thread could also show the task card again after leaving and
    re-entering, even though this class of issue had previously been fixed.
- Diagnosis:
  - The source-side draft settled key depended on `turn.id + item.id`.
  - App-server refresh/compaction can change the visible assistant item id for
    the same draft XML, so the browser missed the stored `created` state and
    could auto-send the same draft again.
  - Source outgoing pending cards were also still eligible for thread-detail
    rendering, which made the source thread retain a local card after send.
- Local fix:
  - `public/app.js`
    - Source draft keys now use `turn.id` plus a hash of the normalized draft
      content and targets, not the volatile app-server item id.
    - On render, a pending source draft checks existing stored cards from the
      same source turn and marks itself `created` before auto-sending again.
    - Thread detail now renders only target-side `pending` cards; source
      outgoing pending cards stay in store/count state but do not render as
      local work items.
    - Immediate settlement count updates now use the actual service roles
      `target` and `source`, not stale `incoming` / `outgoing` names.
    - Persisted draft-state records now keep bounded `cardIds` as well as the
      first `cardId`.
  - `public/app.js` / `public/sw.js`
    - Static shell build/cache bumped to
      `0.1.11|codex-mobile-shell-v136` / `codex-mobile-shell-v136`.
  - Documentation updated:
    - README
    - `.agent-context/PROJECT_CONTEXT.md`
    - `docs/ARCHITECTURE.md`
    - `docs/MODULES.md`
    - `docs/CROSS_THREAD_TASK_CARDS_DESIGN.md`
    - `docs/CROSS_THREAD_TASK_CARDS_IMPLEMENTATION.md`
- Validation:
  - `node --check public\app.js` passed.
  - `node --check public\sw.js` passed.
  - Focused `node --test test\thread-task-card-route.test.js
    test\conversation-render.test.js test\mobile-viewport.test.js` passed:
    23/23.
  - Focused `node --test test\thread-task-card-service.test.js
    test\thread-task-card-harness.test.js test\thread-task-card-route.test.js
    test\conversation-render.test.js test\mobile-viewport.test.js` passed:
    44/44.
  - `npm.cmd test` passed: 255/255.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - BOM check for touched source/test/docs/context files had no output.
- Status:
  - Local changes are uncommitted.
  - Restarted the 8787 Node listener after the static/frontend change:
    old PID `25504`, new PID `49812`.
  - Post-restart `/api/public-config` returns
    `clientBuildId=0.1.11|codex-mobile-shell-v136`,
    `shellCacheName=codex-mobile-shell-v136`, and
    `imageContextMode=reference`.
  - Post-restart authenticated `/api/status` is healthy:
    `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`,
    `lastError=null`.
  - Static frontend/PWA change requires clients to refresh/reopen or receive a
    Hermes plugin refresh to load v136.

## 2026-05-31 Source Task Card Auto-Send UI Regression v137

- User report:
  - After the v136 source-side auto-send change, a newly sent cross-thread card
    showed a source-thread `Cross-thread task card draft` card with status
    `Sending` and text `Sending cross-thread task card...`.
  - The behavior reproduced when sending to another target thread, so it was a
    regression in the source-thread auto-send UI rather than an old cached card
    or a specific target-thread failure.
- Diagnosis:
  - `public/app.js` parsed a valid assistant draft, queued
    `/api/thread-task-cards`, changed the local draft state to `creating`, and
    rendered that `creating` state as a visible source-side `Sending` draft
    card.
  - Runtime checks showed no persisted task card for the source screenshot
    thread, confirming the visible card was browser-local draft state rather
    than a real server-side pending card.
- Local fix:
  - `public/app.js`
    - Source-side `creating` state is now silent in the conversation. A valid
      draft still queues automatic card creation, but no interim `Sending`
      source draft card is rendered.
    - Real creation failures still render a bounded dismissible diagnostic.
    - The creation path now guards duplicate active create attempts and returns
      a bounded failure if the server returns no created cards.
    - Failure rendering uses the same stable turn-and-draft-content key as the
      auto-send path instead of falling back to volatile app-server item ids.
  - `public/app.js` / `public/sw.js`
    - Static shell build/cache bumped to
      `0.1.11|codex-mobile-shell-v137` / `codex-mobile-shell-v137`.
  - Documentation updated:
    - README
    - `.agent-context/PROJECT_CONTEXT.md`
    - `docs/ARCHITECTURE.md`
    - `docs/MODULES.md`
    - `docs/CROSS_THREAD_TASK_CARDS_DESIGN.md`
    - `docs/CROSS_THREAD_TASK_CARDS_IMPLEMENTATION.md`
- Validation/status:
  - Focused `node --check public\app.js` and `node --check public\sw.js`
    passed.
  - Focused `node --test test\thread-task-card-route.test.js
    test\conversation-render.test.js test\mobile-viewport.test.js` passed:
    23/23.
  - Focused `node --test test\thread-task-card-service.test.js
    test\thread-task-card-harness.test.js test\thread-task-card-route.test.js
    test\conversation-render.test.js test\mobile-viewport.test.js` passed:
    44/44.
  - `npm.cmd test` passed: 255/255.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - BOM check for touched source/test/docs/context files had no output.
  - Restarted the 8787 Node listener after the static/frontend change:
    old PID `49812`, new PID `49176`.
  - Post-restart `/api/public-config` returns
    `clientBuildId=0.1.11|codex-mobile-shell-v137`,
    `shellCacheName=codex-mobile-shell-v137`, and
    `imageContextMode=reference`.
  - Post-restart authenticated `/api/status` is healthy:
    `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`,
    `lastError=null`.
  - Local changes are uncommitted.

## 2026-06-01 Workspace Token Usage SQLite Ledger v143 Final

- User request:
  - Track token consumption primarily by Workspace/project.
  - Persist immediately to SQLite because continuation compaction and rollout
    cleanup can remove transient context.
  - Show Workspace cumulative, week, today, and per-day detail in the sidebar.
  - Per-thread stats are secondary because completed turns already show Usage.
- Implemented:
  - Added `adapters/token-usage-stats-service.js`.
    - Default DB:
      `%USERPROFILE%\.codex-mobile-web\token-usage-stats.sqlite`.
    - Optional override: `CODEX_MOBILE_TOKEN_USAGE_DB`.
    - One row per `(thread_id, turn_id)`, with cwd, local day, token fields,
      model, and source.
    - Upsert prevents duplicate completion notifications from double-counting.
  - Extended `adapters/sqlite-cli.js` with `runSqliteExec()`.
  - `server.js` records completed-turn usage on `turn/completed` and decorates
    `/api/threads` with Workspace `mobileTokenUsage`.
  - `public/index.html`, `public/app.js`, and `public/styles.css` show the
    Workspace token ledger below the Workspace selector as total/week/today in
    unit `wan`, with a compact daily-detail toggle. Thread rows keep only a
    small today badge.
  - Static shell bumped to `0.1.11|codex-mobile-shell-v143` /
    `codex-mobile-shell-v143`.
  - `/api/public-config` now reports the app-shell build/cache snapshot captured
    at 8787 listener startup. Static files edited on disk should not trigger
    a page-refresh prompt until the server actually restarts into the new
    build and the browser preflights the target shell cache.
  - Documentation updated in README, Project Context, Architecture, Modules,
    Complex Feature Paths, Troubleshooting, and this handoff.
- Validation:
  - Focused `node --test test\app-update.test.js
    test\thread-task-card-route.test.js test\mobile-viewport.test.js
    test\token-usage-stats-service.test.js
    test\turn-usage-summary-service.test.js` passed: 23/23.
  - `npm.cmd test` passed: 281/281.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
- Status:
  - Local changes are uncommitted.
  - Restarted the 8787 listener after validation: old PID `58832`, new PID
    `67896`.
  - Post-restart `/api/public-config` returns
    `clientBuildId=0.1.11|codex-mobile-shell-v143`,
    `shellCacheName=codex-mobile-shell-v143`, and
    `imageContextMode=reference`.
  - Authenticated `/api/status` is healthy:
    `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`,
    `lastError=null`.
  - Authenticated `/api/threads?limit=3&archived=false` returns a
    `mobileTokenUsage` object with local `todayDate=2026-06-01` and
    `weekStartDate=2026-06-01`; totals are currently zero until future
    completed turns are recorded into the new SQLite ledger.
  - Open clients need the v143 refresh prompt, hard refresh, or close/reopen
    to load the new sidebar UI.

## 2026-06-01 Page Refresh Prompt Detection v144

- User report:
  - After the server had actually restarted into a newer shell build, an
    already-open client still did not show the page-refresh prompt.
- Diagnosis:
  - The v143 server-side startup build snapshot was correct: it prevents
    mid-edit files from appearing as a new build before restart.
  - The open browser client still relied mainly on startup, a 60-second timer,
    visibility/pageshow/focus events, and the manual refresh button path to
    discover a changed `/api/public-config` build id.
  - EventSource reconnect/open, status events, and successful thread-list
    refreshes could prove the server was alive again without immediately
    forcing a shell-build check, so a real restart could be missed or delayed
    on an unchanged foreground page.
- Local fix:
  - `public/app.js`
    - Added `scheduleVisiblePageRefreshCheck()`.
    - EventSource `onopen` now forces a build check shortly after reconnect.
    - EventSource `status` messages schedule a visible-page build check.
    - Successful `loadThreads()` schedules a normal visible-page build check.
  - `public/app.js` / `public/sw.js`
    - Static shell bumped to `0.1.11|codex-mobile-shell-v144` /
      `codex-mobile-shell-v144`.
  - Documentation updated in README, Project Context, Architecture, Complex
    Feature Paths, Troubleshooting, and this handoff.
- Status:
  - Local changes are uncommitted.
  - Validation and runtime restart still need to be rerun for v144.
  - An already-open pre-v144 page may need one manual refresh to load the
    stronger detection path; v144 is intended to prevent the same class of
    missed prompt on future restarts.

## 2026-06-01 Workspace Token Daily Breakdown v145

- User request:
  - In the Workspace token daily detail, distinguish cached input, uncached
    input, and output because these token classes do not have the same value.
- Local fix:
  - `public/app.js`
    - Daily Workspace token rows now show total plus:
      - uncached input: `inputTokens - cachedInputTokens`;
      - cached input;
      - output;
      - reasoning output.
  - `public/styles.css`
    - Daily detail rows now use a compact two-column breakdown under each
      date/total header.
  - `public/app.js` / `public/sw.js`
    - Static shell bumped to `0.1.11|codex-mobile-shell-v145` /
      `codex-mobile-shell-v145`.
  - Documentation updated in README, Project Context, Architecture, Complex
    Feature Paths, Troubleshooting, and this handoff.
- Status:
  - Local changes are uncommitted.
  - Validation and runtime restart still need to be rerun for v145.

## 2026-06-01 Workspace Token Full-Screen Stats v146

- User refinement:
  - Keep only one compact Workspace token row under the Workspace selector.
  - Rename the detail button to `统计`.
  - Clicking `统计` should open a full-screen stats page instead of expanding
    inline details.
  - The compact sidebar `总/周/今` row should be red; the full-screen page should
    carry the detailed daily/project breakdown.
- Local fix:
  - `adapters/token-usage-stats-service.js`
    - `workspaceSummary()` now also returns `workspaces`, grouped by `cwd`
      across all recorded Workspace rows, ordered by total tokens.
  - `public/index.html`
    - Added `workspaceStatsDialog`, a full-screen stats page container.
  - `public/app.js`
    - The Workspace token line is now a compact red `总/周/今` row with a
      `统计` button.
    - `统计` opens the full-screen stats page with overview, daily detail, and
      per-project detail.
    - Daily and project rows split uncached input, cached input, output, and
      reasoning output.
  - `public/styles.css`
    - Added full-screen stats page styling and red compact sidebar row styling.
  - `public/app.js` / `public/sw.js`
    - Static shell bumped to `0.1.11|codex-mobile-shell-v146` /
      `codex-mobile-shell-v146`.
  - Documentation updated in README, Project Context, Architecture, Complex
    Feature Paths, Troubleshooting, and this handoff.
- Status:
  - Local changes are uncommitted.
  - Validation and runtime restart still need to be rerun for v146.

## 2026-06-01 Startup Loading Instrumentation and Resume Dedupe v153

- User report:
  - Cold opening a saved thread still felt slow. The visible flow paused on the
    app shell and then again on `Loading thread...`.
  - User asked to inspect startup logs and also suggested using Chrome for a
    local reproduction.
- Diagnosis:
  - Backend thread detail reads were not the main bottleneck for the current
    thread; recent `thread_switch_complete` detail calls were generally in the
    low hundreds of milliseconds, with larger rollout threads using the
    bounded `large-rollout-turns-list` mode.
  - The remaining cold-start path still did too much serial work and emitted no
    precise client-side startup timings.
  - After adding startup diagnostics, iPhone logs showed `pageshow` scheduling
    a full `resumeMobileSession()` while `bootstrap()` was already opening the
    saved thread. That produced duplicate status/workspace/thread-list/detail
    reads and a `mobile_resume_slow` around 3.2-3.7s.
- Local fix:
  - `public/app.js`
    - Shows `Opening thread...` as soon as a stored thread intent is known,
      before waiting for `/api/public-config`.
    - Starts the saved-thread restore read in parallel with `/api/status`,
      workspace loading, and thread-list loading.
    - Emits `startup_stage` client events for early shell render, public config,
      app shown, bootstrap start, restore start, status, workspaces, threads,
      bootstrap done, and startup done.
    - Tracks `state.startupInProgress`.
    - `scheduleMobileResume()` now skips the full network resume during startup,
      keeps only visual recovery, and emits `mobile_resume_skipped_startup`.
  - `public/app.js` / `public/sw.js`
    - Static shell bumped to `0.1.11|codex-mobile-shell-v153` /
      `codex-mobile-shell-v153`.
  - Tests and docs updated:
    - `test/mobile-viewport.test.js`
    - `test/thread-task-card-route.test.js`
    - README, Project Context, Architecture, and Troubleshooting.
- Validation:
  - `node --check public\app.js` passed.
  - `node --check public\sw.js` passed.
  - Focused `node --test test\mobile-viewport.test.js
    test\thread-task-card-route.test.js test\app-update.test.js` passed: 12/12.
  - `npm.cmd test` passed: 284/284.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - BOM check for touched files had no output.
- Runtime verification:
  - Restarted the 8787 listener after validation: old PID `59580`, new PID
    `103360`.
  - `/api/public-config` returns
    `clientBuildId=0.1.11|codex-mobile-shell-v153`,
    `shellCacheName=codex-mobile-shell-v153`, and
    `imageContextMode=reference`.
  - Authenticated `/api/status` is healthy:
    `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`,
    `lastError=null`.
  - Chrome headless reproduction through CDP with a temporary profile loaded
    the saved thread successfully. Server client-event logs show
    `mobile_resume_skipped_startup` during startup and no Chrome
    `mobile_resume_slow`; the Chrome run reached `thread_switch_complete` in
    about 1.4s and `bootstrap_done` in about 2.1s.
  - Fresh iPhone logs after v153 also show `mobile_resume_skipped_startup`; a
    subsequent startup reached `thread_switch_complete` in about 1.1s and
    `bootstrap_done` in about 2.0s.
- Status:
  - Local changes are uncommitted.
  - Open clients need the v153 refresh prompt, hard refresh, close/reopen, or
    Hermes plugin refresh path to load the new startup behavior.

## 2026-06-02 Public Sync for Generated Image Rendering v159

- User request:
  - Push and sync public after the private v159 generated-image rendering fix.
- Private repository:
  - Already committed and pushed `a4638f6 支持生成图片渲染 v159`.
  - Final private status before this handoff-only update was clean on
    `main...origin/main`.
- Public repository:
  - Path: `C:\Users\xuxin\Documents\codex-mobile-web-public`.
  - Synced only public-safe product, docs, README, and tests from private:
    README, `server.js`, `adapters/generated-image-cache-service.js`,
    `public/app.js`, `public/markdown-renderer.js`, `public/styles.css`,
    `public/sw.js`, generated-image/Markdown/mobile viewport/file preview/task
    card route tests, and the relevant docs.
  - Did not sync `.agent-context`, uploads, runtime databases, access keys,
    VAPID/subscription files, or other machine-local state.
  - Added a detailed Chinese public README release note for v158-v159:
    safe bitmap data URL rendering, `imageGeneration.savedPath` generated PNG
    cache rendering, authenticated `/api/generated-images/file`, and
    `codex-mobile-shell-v159`.
  - Public commit pushed:
    `2f9caab 发布生成图片渲染 v159`.
- Public validation:
  - `npm.cmd test` passed: 289/289.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` and `git diff --cached --check` passed with only
    Windows LF-to-CRLF working-copy warnings.
  - Staged privacy scan found no staged private/runtime files or raw secret
    values; matches were only documentation statements about excluded uploads
    and context paths.

## 2026-06-02 Autonomous Task Card Completion Auto-Return

- User report:
  - The user expected an autonomous cross-thread workflow to send a return card
    automatically after the target thread finished. The current implementation
    only auto-approved later cards that already existed with the same
    workflow id; it did not create the return card when the target turn
    completed.
  - Follow-up clarification: this auto-return behavior is the default contract
    for automatic/autonomous collaboration cards. The unrelated plugin
    provisioning note was sent to the wrong thread and should not be treated as
    part of this workspace change.
- Diagnosis:
  - Runtime `thread-task-cards.json` showed recent autonomous Health workflow
    cards were approved and active workflow grants existed, but no
    reverse-direction Health -> Hermes card was created after target work.
  - This was an implementation gap rather than a user prompt issue.
- Local fix:
  - `adapters/thread-task-card-service.js`
    - Added `maybeAutoReplyCompletedTurn()`.
    - When an approved autonomous card's recorded `injectedTurnId` completes
      in the target thread, the service creates one reverse-direction return
      card carrying the completed turn receipt.
    - The return card reuses the same workflow id and is auto-approved through
      the existing workflow grant, creating a real source-thread turn.
    - The return is idempotent by original card id plus completed turn id, and
      the original card records `autoReplyCardId` / `autoReturn*` audit fields.
  - `server.js`
    - Imports `finalReceiptTextFromParams()`.
    - Calls `threadTaskCardService.maybeAutoReplyCompletedTurn()` on fresh
      `turn/completed` notifications, independently of Web Push delivery.
  - `public/app.js` / `public/sw.js`
    - The `#` draft prompt now states that autonomous workflow means first
      approval once, then automatic return after target completion without
      another approval.
    - Static shell bumped to `0.1.11|codex-mobile-shell-v160` /
      `codex-mobile-shell-v160`.
  - Documentation updated:
    - README
    - `docs/ARCHITECTURE.md`
    - `docs/COMPLEX_FEATURE_PATHS.md`
    - `docs/CROSS_THREAD_TASK_CARDS_REQUIREMENTS.md`
    - `docs/CROSS_THREAD_TASK_CARDS_DESIGN.md`
    - `docs/CROSS_THREAD_TASK_CARDS_IMPLEMENTATION.md`
    - `docs/MODULES.md`
    - `docs/TROUBLESHOOTING.md`
    - `.agent-context/PROJECT_CONTEXT.md`
- Validation:
  - `node --check adapters\thread-task-card-service.js` passed.
  - `node --check server.js` passed.
  - `node --check public\app.js` passed.
  - `node --check public\sw.js` passed.
  - Focused `node --test test\thread-task-card-service.test.js
    test\thread-task-card-route.test.js test\conversation-render.test.js
    test\mobile-viewport.test.js` passed: 37/37.
  - `npm.cmd test` passed: 290/290.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - BOM check for touched source, tests, docs, README, and context files had
    no output.
- Runtime:
  - Restarted the 8787 Node listener so the server-side hook is active:
    first old PID `79304`, intermediate PID `53452`, final PID `124576`.
  - `/api/public-config` returns
    `clientBuildId=0.1.11|codex-mobile-shell-v160` and
    `shellCacheName=codex-mobile-shell-v160`.
  - Authenticated `/api/status` is healthy:
    `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`,
    `lastError=null`.
- Status:
  - Local changes are uncommitted.
  - This is both server-side task-card behavior and static frontend/PWA
    behavior. Open clients need the v160 refresh prompt, hard refresh,
    close/reopen, or Hermes plugin refresh path to load the updated `#` draft
    prompt and shell cache.
  - Public repository was not synced or pushed.

## 2026-06-02 Page Refresh Applies Quota Snapshot v162

- User report:
  - After the page showed `页面有新版本，点击刷新`, tapping the prompt did not
    refresh the visible quota chips.
  - Killing and reopening the PWA did refresh quota, proving the shell-refresh
    path and full app restart path were not equivalent for quota state.
- Diagnosis:
  - `refreshPageForNewBuild()` fetched `/api/public-config` to preflight the
    target shell cache and then called `window.location.reload()`.
  - Quota state was only applied on startup, `/api/status`, or SSE status
    snapshots. On iOS/PWA, a reload can fail to behave like a full app process
    restart, leaving the old browser quota cache visible.
- Local fix:
  - `public/app.js`
    - Added `rememberRateLimitsFromConfig(config)`.
    - Startup and the page-refresh click path now share the same public-config
      quota snapshot application.
    - `refreshPageForNewBuild()` applies latest `rateLimits` /
      `rateLimitsByModel` before service-worker update, cache pruning, and
      `window.location.reload()`.
  - `public/app.js` / `public/sw.js`
    - Static shell bumped to `0.1.11|codex-mobile-shell-v162` /
      `codex-mobile-shell-v162`.
  - Tests/docs:
    - `test/app-update.test.js` now checks that refresh prompt handling applies
      public-config quota before preparing shell assets.
    - README, Architecture, Troubleshooting, Project Context, and this handoff
      document that page refresh and quota refresh are separate paths joined by
      the v162 fix.
- Validation:
  - `node --check public\app.js` passed.
  - `node --check public\sw.js` passed.
  - Focused `node --test test\app-update.test.js test\codex-profile-ui.test.js
    test\mobile-viewport.test.js test\thread-task-card-route.test.js` passed:
    17/17.
  - `npm.cmd test` passed: 292/292.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
- Status:
  - Runtime restart completed before commit. Listener PID `97568` is serving
    `clientBuildId=0.1.11|codex-mobile-shell-v162` and
    `shellCacheName=codex-mobile-shell-v162`.
  - Authenticated `/api/status` is healthy:
    `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`,
    `lastError=null`, `codexHome=C:\Users\xuxin\.codex-homes\previous`.
  - Local changes remain uncommitted.

## 2026-06-02 Public Sync for v160-v162

- User request:
  - Push Public after private commit `e816f87 修复自动协作回传、账号切换线程延续与刷新额度 v162`.
- Public repository:
  - Path: `C:\Users\xuxin\Documents\codex-mobile-web-public`.
  - Synced public-safe product, test, docs, README, and startup-script files:
    `README.md`, `server.js`, `adapters/thread-task-card-service.js`,
    `public/app.js`, `public/sw.js`,
    `start-codex-mobile-web-windowless.ps1`, relevant docs, and relevant
    tests for app update, profile UI/restart, protocol, viewport, and
    task-card service/route behavior.
  - Did not sync `.agent-context`, uploads, runtime databases, access keys,
    VAPID/subscription files, profile auth/config backups, state backups, or
    other machine-local runtime state.
  - Added detailed Chinese README release notes for v160-v162:
    autonomous task-card completion auto-return, profile switch shared thread
    state, explicit profile restart handling, and v162 page-refresh quota
    snapshot application.
  - Public commit pushed:
    `a41dfa2 发布自动协作回传、Profile 线程延续与刷新额度 v162`.
- Public validation:
  - `npm.cmd test` passed: 292/292.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` and `git diff --cached --check` passed with only
    Windows LF-to-CRLF working-copy warnings.
  - Staged path scan found no private/runtime files.
  - Staged sensitive-content scan only matched README documentation saying
    runtime access key / VAPID / subscription files are excluded; no raw secret
    values were staged.
- Status:
  - Public repository is clean on `main...origin/main` after push.
  - Private repository needs this handoff update committed after this entry.
