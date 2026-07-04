# HANDOFF

Last compacted: 2026-07-04T08:32:24.763Z

This active handoff was automatically compacted before a Codex Mobile continuation.
The previous full handoff was archived and should be opened only when old provenance is explicitly needed.

## Compaction Summary

- Workspace: `/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web`
- Original active handoff bytes: `1414080`
- Archived full handoff: `/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web/.agent-context/archive/context-compaction-20260704_083224/HANDOFF.full-before-context-budget.md`
- Preserved recent active context chars: `17238`

## Startup Guidance

- Read `.agent-context/PROJECT_CONTEXT.md` first.
- Read this compact `.agent-context/HANDOFF.md` for current status.
- Do not load the archived full handoff unless the user asks for old provenance or the compact handoff is insufficient.
- Before changing any latest-version, backup, deployment, or runtime-state fact, verify current repo/runtime state or the latest source-thread handoff; archived old sections are provenance only.
- Keep future handoff updates concise: current state, changed files, validation, risks, and next steps.
- Do not store raw secrets, tokens, one-time approvals, hidden UI state, long logs, or bulky generated output.

## Current Addendum - 2026-07-04 Listener Pressure Diagnostics Hotfix

- Emergency break-glass card `ttc_5b65caeb537e1d002c` was completed from the
  Home AI/Codex Mobile deploy context after normal task-card heartbeat became
  unreliable under listener pressure.
- Production symptom before the fix: light endpoints such as
  `/api/public-config` could take about a second while the listener had high
  RSS/CPU and sampling pointed at synchronous JS string/regexp/GC work after
  HTTP requests.
- Deployed private hotfix commit `21e71e6e`
  (`fix: bound listener pressure diagnostics`) from clean worktree
  `/Users/hermes-dev/HermesMobileDev/app/tmp/deploy-worktrees/codex-mobile-web-runtime-pressure-d5a11f8a`.
  A local branch `hotfix/runtime-pressure-diagnostics-21e71e6e` preserves the
  commit without moving the dirty source `main` worktree.
- Central deploy reason:
  `codex-mobile-runtime-pressure-diagnostics-21e71e6e-final`. Backup:
  `/Users/hermes-host/HermesMobile/backups/deploy/20260704T135258Z-plugin-codex-mobile-web-codex-mobile-runtime-pressure-diagnostics-21e71e6e-final`.
- Code changes: `runtime-pressure-diagnostics-service` now exposes bounded
  process/event-loop/route summaries; API dispatch records response time,
  response byte count, and object count; `/api/public-config` and
  `/api/status` schedule quota/app-server hydration in the background instead
  of waiting on it before returning.
- Tests/checks passed in clean worktree: focused route/runtime suite
  (`49` tests), `npm run check`, `npm run check:macos`, and
  `git diff --check -- ':!.agent-context'`.
- Production readback after final deploy: `/api/public-config` `200` in
  `158ms`, `/api/status?detail=1` `200` in `100ms` with
  `runtimePressurePresent=true`, `/api/vite-shell-artifact` `200` with
  `ok=true` and empty issue codes, `/api/threads?limit=30` `200` in `55ms`.
  Route stats were present for `/api/status`, `/api/public-config`,
  `/api/threads`, and `/api/vite-shell-artifact`.
- Changed-file source/prod SHA parity passed for all 12 changed files.
  One 8787 listener remained (`PID 79238`), listener RSS was about `689MB`,
  heap used about `179MB`, and a 5-second stdout/stderr sample showed zero log
  growth.
- Residual: the shared Codex app-server process was not restarted by this
  fix and still retained about `3.8GB` RSS with low-double-digit CPU at the
  latest sample. This hotfix bounds listener-side light endpoints and adds
  diagnostics; app-server memory retention remains a separate follow-up if it
  continues to affect streaming.

## Current Addendum - 2026-07-04 Task-Card Watchdog Emergency Hotfix

- Emergency deploy lane card `ttc_e82c04a77f0a2f3ee1` addressed execution
  Watchdog churn that was stalling Codex Mobile / ChatGPT Pro lanes.
- Bounded production triage found two stale approved execution leases with
  `resumeCount=6`, `lastWatchdogResumeReason=stale_heartbeat`, and
  `resumeRequired=true`; `codex-mobile-web.out.log` was about 877MB.
- Immediate mitigation backed up the task-card store and marked those two stale
  leases `resumeRequired=false` with
  `watchdogAutoResumePausedReason=emergency_watchdog_churn_mitigation`.
  They later read back as `replied/completed`; only the emergency card remained
  active.
- Durable hotfix commit `17e4eb6f56fd` (`fix: limit task-card watchdog
  resumes`) was built and deployed from clean worktree
  `/Users/hermes-dev/HermesMobileDev/app/tmp/deploy-worktrees/codex-mobile-web-watchdog-hotfix`.
  The commit was pushed to private branch
  `hotfix/task-card-watchdog-last-resort-17e4eb6f`, not `origin/main`, because
  the current deploy branch and private `origin/main` are divergent.
- Hotfix behavior: execution Watchdog default stale window is 30 minutes;
  fresh/queued heartbeat suppresses stale resume; successful Watchdog
  continuation pauses further automatic Watchdog resumes for that card with
  `watchdogAutoResumePausedReason=watchdog_resume_attempted`.
- Validation passed in clean worktree: changed-file `node --check`; focused
  `87` tests; `npm run --silent check`; `npm run --silent check:macos`;
  `git diff --check -- ':!.agent-context'`.
- Private production deploy returned `ok=true`; backup path:
  `/Users/hermes-host/HermesMobile/backups/deploy/20260704T113622Z-plugin-codex-mobile-web-codex-mobile-task-card-watchdog-last-resort-17e4eb6f`.
  Launchd readback showed `state=running`, cwd
  `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`, one
  `127.0.0.1:8787` listener, and
  `CODEX_MOBILE_TASK_CARD_EXECUTION_WATCHDOG_INTERVAL_MS=0`.
- Production readback was healthy: `/api/public-config` HTTP 200, build
  `9503a0d2c6c42001`, default shell `vite-app-preview`; `/api/status` ready;
  `/api/vite-shell-artifact` `ok=true`; source/production SHA parity matched
  all 6 changed files. Post-mitigation log growth over 10s was about 3.5KB,
  no residual browser self-check/runtime-loop/HeadlessChrome probes were
  observed, and `codex app-server` RSS read back around 418MB.

## Preserved Recent Handoff Tail

## 2026-07-04T13:10:00+08:00 - Thread list/detail status self-check deployed

- Deploy lane completed task card `ttc_a32fb1486c54c6bceb` for source ref
  `54f4b20c14d9` with reason
  `codex-mobile-thread-list-detail-status-self-check-54f4b20c`.
  Public deploy was skipped.
- Clean deploy worktree:
  `/Users/hermes-dev/HermesMobileDev/app/tmp/deploy-worktrees/codex-mobile-web-54f4b20c`.
- Source validation rerun in the deploy lane:
  - `node --check adapters/thread-detail-self-check-service.js`;
  - `node --check test/thread-detail-self-check-service.test.js`;
  - `node --test test/thread-detail-self-check-service.test.js`: `33`
    passed;
  - `git diff --check -- adapters/thread-detail-self-check-service.js
    test/thread-detail-self-check-service.test.js docs/TROUBLESHOOTING.md`.
- Central macOS deploy returned `ok=true`; backup path:
  `/Users/hermes-host/HermesMobile/backups/deploy/20260704T050835Z-plugin-codex-mobile-web-codex-mobile-thread-list-detail-status-self-check-54f4b20c`.
  Restart label `com.hermesmobile.plugin.codex-mobile` is running from
  `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
- Production readback:
  - `/api/public-config` HTTP 200, build `8505fd7625c70ad1`,
    client/cache `0.1.11|codex-mobile-shell-v625-8abbd21e7023`,
    `defaultShellMode=vite-app-preview`;
  - `/api/status` ready, active profile `default`;
  - `/api/vite-shell-artifact` `ok=true`, issue codes `[]`;
  - default `/` remained app-preview shape with one module entry and no direct
    `/app.js` script.
- Source/production SHA prefix parity matched:
  - `adapters/thread-detail-self-check-service.js`
    `21dd33dbc5293e6c`;
  - `test/thread-detail-self-check-service.test.js`
    `acd300093fe0d873`;
  - `docs/TROUBLESHOOTING.md` `14eaafe4a3624b3e`.
- Central startup/process-pressure gate passed with browser/runtime jobs
  enabled and issue/blocking/execution-failure counts `0/0/0`.
- Production `node scripts/codex-mobile-thread-self-check.js --server
  http://127.0.0.1:8787 --json` returned process status `1`, `ok=false`,
  issue/blocking counts `2/2`, and expected H2
  `thread_list_missing_active_detail_active_mismatch`. The bounded sampled
  shape was list `idle`, detail `active`, `detailSettled=false`; the live
  mismatch remains present and is now caught by self-check.

## 2026-07-04T13:40:00+08:00 - Superseded active-turn marker fix deployed

- Deploy lane completed task card `ttc_72d5c9561efbf61465` for source ref
  `d6183fbcde54` with reason
  `codex-mobile-superseded-active-turn-marker-d6183fbc`.
  Public deploy was skipped.
- Clean deploy worktree:
  `/Users/hermes-dev/HermesMobileDev/app/tmp/deploy-worktrees/codex-mobile-web-d6183fbc`.
- Source validation rerun in the deploy lane:
  - `node --check services/thread-detail/thread-detail-response-budget-service.js
    test/thread-detail-response-budget-service.test.js`;
  - `node --test test/thread-detail-response-budget-service.test.js`: `53`
    passed;
  - `node --test test/thread-detail-self-check-service.test.js
    test/thread-self-check-script.test.js
    test/thread-detail-read-orchestration-service.test.js`: `78` passed;
  - `npm run --silent check`;
  - `npm run --silent check:macos`;
  - `git diff --check -- ':!.agent-context'`.
- Central macOS deploy returned `ok=true`; backup path:
  `/Users/hermes-host/HermesMobile/backups/deploy/20260704T053830Z-plugin-codex-mobile-web-codex-mobile-superseded-active-turn-marker-d6183fbc`.
  Restart label `com.hermesmobile.plugin.codex-mobile` is running from
  `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
- Production readback:
  - `/api/public-config` HTTP 200, build `e94757e996ea7413`,
    client/cache `0.1.11|codex-mobile-shell-v625-8abbd21e7023`,
    `defaultShellMode=vite-app-preview`;
  - `/api/status` ready, active profile `default`;
  - `/api/vite-shell-artifact` `ok=true`, issue codes `[]`;
  - default `/` remained app-preview shape with one module entry and no direct
    `/app.js` script.
- Source/production SHA prefix parity matched:
  - `services/thread-detail/thread-detail-response-budget-service.js`
    `0cb9fa51140935b2`;
  - `test/thread-detail-response-budget-service.test.js`
    `3dc5fd20b01fbddd`.
- Central startup/process-pressure gate passed with browser/runtime jobs
  enabled and issue/blocking/execution-failure counts `0/0/0`.
- Production `node scripts/codex-mobile-thread-self-check.js --server
  http://127.0.0.1:8787 --json` returned process status `1`, `ok=false`,
  issue/blocking counts `3/2`. Target H2
  `thread_detail_active_turn_superseded_by_completed` was absent after deploy.
  Residual bounded issues: two H2
  `thread_list_missing_active_detail_active_mismatch` occurrences with list
  `idle` / `completed` against active detail, plus H3
  `thread_list_updated_order_mismatch`.

## 2026-07-04T13:50:00+08:00 - Runtime active list-status deploy incomplete

- Deploy lane executed task card `ttc_45cc4eac71eedba7cb` for source ref
  `a21e266a0251` with reason
  `codex-mobile-runtime-active-list-status-a21e266a`.
  Public deploy was skipped.
- Clean deploy worktree:
  `/Users/hermes-dev/HermesMobileDev/app/tmp/deploy-worktrees/codex-mobile-web-a21e266a`.
- Source validation rerun in the deploy lane:
  - `node --check services/thread-list/thread-summary-state-service.js
    test/thread-visibility.test.js`;
  - `node --test test/thread-visibility.test.js
    test/thread-list-service-boundary.test.js
    test/thread-list-route-merge-service.test.js`: `76` passed;
  - `npm run --silent check`;
  - `npm run --silent check:macos`;
  - `git diff --check -- ':!.agent-context'`.
- Central macOS deploy returned `ok=true`; backup path:
  `/Users/hermes-host/HermesMobile/backups/deploy/20260704T054653Z-plugin-codex-mobile-web-codex-mobile-runtime-active-list-status-a21e266a`.
  Restart label `com.hermesmobile.plugin.codex-mobile` is running from
  `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
- Production readback:
  - `/api/public-config` HTTP 200, build `530de533b1bd8c60`,
    client/cache `0.1.11|codex-mobile-shell-v625-8abbd21e7023`,
    `defaultShellMode=vite-app-preview`;
  - `/api/status` ready, active profile `default`;
  - `/api/vite-shell-artifact` `ok=true`, issue codes `[]`;
  - default `/` remained app-preview shape with one module entry and no direct
    `/app.js` script.
- Source/production SHA prefix parity matched:
  - `services/thread-list/thread-summary-state-service.js`
    `5009093c63ef1630`;
  - `test/thread-visibility.test.js` `376498e9611be17e`;
  - `docs/ARCHITECTURE.md` `57f1a4c9261c40e1`.
- Central startup/process-pressure gate passed with browser/runtime jobs
  enabled and issue/blocking/execution-failure counts `0/0/0`.
- Closure condition failed after deploy:
  - target `019eed86-2002-7cc2-b0b7-937eb5355f36` detail read remained
    `active`, active turn present, latest turn `inProgress`;
  - `/api/threads?limit=160` still returned the target list row as
    `completed`, no active marker, even after sequential detail-then-list
    reads;
  - production thread self-check returned process status `1`, `ok=false`,
    issue/blocking counts `2/1`, with residual H2
    `thread_list_missing_active_detail_active_mismatch`.
- Returned task card as `partially_completed`: deploy/readback succeeded, but
  the required status-drift closure did not.

## 2026-07-04T13:39:00+08:00 - Superseded active-turn status drift fixed

- User asked to fix the live thread status drift after the self-check started
  detecting it.
- Live self-check before the source fix no longer showed the earlier list/detail
  mismatch as the active sample; it reported H2
  `thread_detail_active_turn_superseded_by_completed`, where detail still
  exposed an older active turn while a newer completed turn had later
  completion/activity evidence.
- Root-cause fix:
  - `services/thread-detail/thread-detail-response-budget-service.js` now clears
    thread-level active markers when a visible active turn is superseded by a
    newer completed turn;
  - the superseded active turn is downgraded to stale-completed so historical
    content remains visible without retaining live semantics;
  - compact budget evidence now includes
    `clearedSupersededActiveTurnId`.
- Regression test:
  - `test/thread-detail-response-budget-service.test.js` covers the
    old-active/newer-completed shape and verifies the compacted detail no
    longer triggers `thread_detail_active_turn_superseded_by_completed`.
- Source validation:
  - `node --check services/thread-detail/thread-detail-response-budget-service.js
    test/thread-detail-response-budget-service.test.js`;
  - `node --test test/thread-detail-response-budget-service.test.js`: `53`
    passed;
  - `node --test test/thread-detail-self-check-service.test.js
    test/thread-self-check-script.test.js
    test/thread-detail-read-orchestration-service.test.js`: `78` passed;
  - `npm run --silent check`;
  - `npm run --silent check:macos`;
  - `git diff --check -- ':!.agent-context'`.
- Commit/push:
  - `d6183fbc` (`fix: clear superseded active turn markers`) pushed to private
    `main`.
- Deploy:
  - Codex Mobile deploy-lane card `ttc_72d5c9561efbf61465` was created for
    exact ref `d6183fbc`.
  - Production source/production SHA parity for
    `services/thread-detail/thread-detail-response-budget-service.js` matched
    local source prefix `0cb9fa51140935b2`.
  - `/api/public-config` returned HTTP 200, build `e94757e996ea7413`,
    client/cache `0.1.11|codex-mobile-shell-v625-8abbd21e7023`,
    `defaultShellMode=vite-app-preview`, active profile `default`, no top-level
    error.
  - Production `node scripts/codex-mobile-thread-self-check.js --server
    http://127.0.0.1:8787 --json` returned `ok=true`, issue count `0`, blocking
    issue count `0`.
- Note: direct `/api/status` and `/api/vite-shell-artifact` reads from this
  shell returned HTTP 401 without a usable auth header; closure relied on
  production file parity plus the authenticated/allowed production self-check
  path.

## 2026-07-04T14:03:03+08:00 - Active display-cache list-status deploy partially closed

- Home AI deploy lane processed task card `ttc_72fdc010976cfff746` for ref
  `5e3ee416815f` (`fix: protect active display cache from list writeback`).
- Clean source validation passed before deploy: changed-file `node --check`,
  focused thread-list tests (`78` passed), `npm run --silent check`,
  `npm run --silent check:macos`, and
  `git diff --check -- ':!.agent-context'`.
- Central private plugin deploy completed with `ok=true`; backup path:
  `/Users/hermes-host/HermesMobile/backups/deploy/20260704T055907Z-plugin-codex-mobile-web-codex-mobile-active-display-cache-list-status-5e3ee416`.
- Production remained on `CODEX_MOBILE_DEFAULT_SHELL=vite-app-preview`;
  `/api/public-config` returned HTTP 200 with build `84460e00c46238a3` and
  client/cache `0.1.11|codex-mobile-shell-v625-8abbd21e7023`.
- `/api/status` was ready, `/api/vite-shell-artifact` was `ok=true` with issue
  codes `[]`, and default `/` remained app-preview shape with one module entry
  and no direct `/app.js`.
- Source/production SHA prefix parity matched for:
  `adapters/push-notification-service.js`,
  `services/thread-list/thread-list-summary-service.js`,
  `services/thread-list/thread-summary-state-service.js`,
  `test/thread-visibility.test.js`, and `docs/ARCHITECTURE.md`.
- Central startup/process-pressure gate passed with issue/blocking/execution
  failure counts `0/0/0`.
- Required closure still failed:
  - production `scripts/codex-mobile-thread-self-check.js --server
    http://127.0.0.1:8787 --json` returned `ok=false`, issue/blocking counts
    `3/2`, with residual H2
    `thread_list_missing_active_detail_active_mismatch`;
  - bounded H2 shape included list `idle` versus detail `active`;
  - deploy-lane target `019f16e6-9131-79e2-9b6b-ad41f7e65d92` showed
    list/detail active after deploy;
  - Home AI 06-22 target `019eed86-2002-7cc2-b0b7-937eb5355f36` still showed
    detail `active` with active turn/latest `inProgress`, but list row
    `completed` without active marker.
- Source task card was returned as `partially_completed`; next fix should focus
  on why Home AI 06-22 active detail evidence is not promoted into the
  `/api/threads?limit=160` list row despite the display-cache writeback guard.

## 2026-07-04T14:50:24+08:00 - @loop source requirements fix deployed

- Home AI deploy lane processed task card `ttc_7b6176e426b3dcf30e` for ref
  `6b5ba0e4718c` (`fix: wait for at-loop source requirements`).
- Clean source validation passed before deploy: changed-file `node --check`,
  focused @loop route/parser/routing/MCP/task-card tests (`45` passed),
  `npm run --silent check`, `npm run --silent check:macos`, and
  `git diff --check -- ':!.agent-context'`.
- Central private plugin deploy completed with `ok=true`; backup path:
  `/Users/hermes-host/HermesMobile/backups/deploy/20260704T064715Z-plugin-codex-mobile-web-codex-mobile-at-loop-source-requirements-6b5ba0e4`.
- Production remained on `CODEX_MOBILE_DEFAULT_SHELL=vite-app-preview`;
  `/api/public-config` returned HTTP 200 with build `5ec4b64cedfbf424` and
  client/cache `0.1.11|codex-mobile-shell-v625-8abbd21e7023`.
- `/api/status` was ready, `/api/vite-shell-artifact` was `ok=true` with issue
  codes `[]`, `/api/at-loop/status` was `ok=true`, and default `/` remained
  app-preview shape with one module entry and no direct `/app.js`.
- Source/production SHA prefix parity matched for:
  `services/at-loop/loop-task-runtime-service.js`,
  `test/loop-task-runtime.test.js`, `docs/ARCHITECTURE.md`,
  `docs/COMPLEX_FEATURE_PATHS.md`, and `docs/MODULES.md`.
- Central startup/process-pressure gate passed with issue/blocking/execution
  failure counts `0/0/0`.
- Synthetic production-module @loop smoke used a temp state file and fake
  task-card dispatcher only:
  - source-thread local trigger without packets remained
    `waiting_source_requirements` / `source_requirements_pending`;
  - bounded `/status` projection exposed `sourceRequirementsStatus` with
    missing `requirements_packet` and `design_contract_packet`;
  - duplicate trigger stayed waiting and did not dispatch implementation;
  - after local requirements/design return, the loop advanced to implementation,
    created implementation/audit role lanes, and dispatched one implementation
    card with source thread distinct from target thread.
- Separate residual observed outside this @loop card: production thread
  self-check still returned issue codes
  `thread_list_missing_active_detail_active_mismatch` and
  `thread_list_updated_order_mismatch`.

## 2026-07-04T15:20:18+08:00 - @loop source-requirements visible status deployed

- Home AI deploy lane processed task card `ttc_8622d8a198c144caf6` for ref
  `c85de16d8cdb` (`fix: 显示 at-loop 需求分析等待态`).
- Clean source validation passed before deploy:
  `node --check public/composer-runtime.js`,
  `node --check test/at-loop-composer-intent.test.js`,
  `node --test test/at-loop-composer-intent.test.js` (`5` passed),
  `npm run --silent build:frontend`,
  `npm run --silent check:frontend-build`,
  `npm run --silent check`, `npm run --silent check:macos`,
  `git diff --check -- ':!.agent-context'`, and
  `git diff --cached --check`.
- Central private plugin deploy completed with `ok=true`; backup path:
  `/Users/hermes-host/HermesMobile/backups/deploy/20260704T071712Z-plugin-codex-mobile-web-codex-mobile-at-loop-source-requirements-visible-c85de16d`.
- Production remained on `CODEX_MOBILE_DEFAULT_SHELL=vite-app-preview`;
  `/api/public-config` returned HTTP 200 with build `063797c58b763912` and
  client/cache `0.1.11|codex-mobile-shell-v625-08034bec5ea4`.
- `/api/status` was ready, `/api/vite-shell-artifact` was `ok=true` with issue
  codes `[]`, `publishedFileCount=23`, `esmCompatibilityModuleCount=49`, and
  default `/` remained app-preview shape with one module entry and no direct
  `/app.js`.
- Source/production SHA prefix parity matched for all `29` changed deployable
  paths, including `public/composer-runtime.js`, the focused test/doc, shell
  manifests/readback, and the new Vite chunks.
- Central startup/process-pressure gate passed. Direct rerun returned
  process status `0`, `ok=true`, issue count `1`, blocking/execution-failure
  counts `0/0`; only non-blocking issue code:
  `stale_app_server_mux_present`.
- Production module smoke used fake response data only:
  - `CodexComposerRuntime.createComposerRuntime` loaded;
  - `atLoopRequestClientOutcome()` for fake
    `waiting_source_requirements` / `source_requirements_pending` returned
    `waitingSourceRequirements=true`;
  - status text included `Loop 等待主线程需求分析`, `需求包`, and
    `设计契约包`;
  - activity text was `Loop 等待需求分析`;
  - generic `Loop 已启动` was avoided;
  - `at_loop_request_success` carries waiting fields, and the `@` dialog path
    keeps the waiting status instead of silently closing.
- Existing Movie loop `loop_982e0100cba1cfc1` remained correctly waiting after
  deploy with missing `requirements_packet` and `design_contract_packet`;
  implementation/product-audit/repair roles still had no task-card ids. The
  deploy smoke did not create real Movie implementation/audit cards.

## 2026-07-04T17:14:35+08:00 - Task-card execution heartbeat deployed

- Home AI deploy lane processed task card `ttc_628bf9ff366fb4e823` from the
  ChatGPT Pro source thread for ref `6f1ba778ebcf`
  (`fix: add task-card execution heartbeat`).
- Clean source validation passed before deploy:
  `node --test test/thread-task-card-service.test.js
  test/thread-task-card-route.test.js test/server-runtime-config-service.test.js`
  (`80` passed), `npm run --silent check`,
  `npm run --silent check:macos`, and
  `git diff --check -- ':!.agent-context'`.
- Central private plugin deploy completed with `ok=true`; backup path:
  `/Users/hermes-host/HermesMobile/backups/deploy/20260704T091133Z-plugin-codex-mobile-web-codex-mobile-task-card-heartbeat-6f1ba778`.
- Production remained on `CODEX_MOBILE_DEFAULT_SHELL=vite-app-preview`;
  `/api/public-config` returned HTTP 200 with build `c20ea0306b2064d1` and
  client/cache `0.1.11|codex-mobile-shell-v625-08034bec5ea4`.
- `/api/status` was ready, `/api/vite-shell-artifact` was `ok=true` with issue
  codes `[]`, `publishedFileCount=23`, `esmCompatibilityModuleCount=49`, and
  default `/` remained app-preview shape with one module entry and no direct
  `/app.js`.
- Source/production SHA prefix parity matched for all `15` changed deployable
  paths between `c85de16d` and `6f1ba778`, including:
  `services/task-cards/thread-task-card-service.js`,
  `server-routes/thread-task-card-route-service.js`,
  `services/task-cards/thread-task-card-runtime-service.js`, docs, @loop
  helper follow-up files, and tests.
- Central startup/process-pressure gate passed. Direct rerun returned
  process status `0`, `ok=true`, issue count `2`, blocking/execution-failure
  counts `0/0`; non-blocking issue codes:
  `production_listener_rss_elevated`, `stale_app_server_mux_present`.
- Production-module heartbeat smoke used a temp task-card store only:
  - heartbeat recorded bounded status/source metadata and incremented count;
  - watchdog ignored the fresh heartbeat;
  - after the stale window, watchdog resumed one continuation and preserved
    private-body exclusion;
  - an immediate duplicate watchdog pass inspected `0` and did not resume
    again;
  - dynamic tool `codex_mobile.task_card_heartbeat` returned bounded payload.
- Production HTTP heartbeat route smoke with fake missing card id returned
  HTTP 404 / `task_card_not_found`, confirming route presence and fail-closed
  behavior without touching real task cards.

## 2026-07-04T17:42:00+08:00 - @loop audit blocked routing source fix pending validation

- Task card `ttc_f6a14e966a895535b9` from Movie requested a Codex Mobile
  runtime fix for `loop_982e0100cba1cfc1`, where requirements,
  implementation, and product-audit returns existed but the loop ended
  `blocked` with `lastAuditVerdict=""` and a pending repair slice without a
  target card.
- Source diagnosis: `services/at-loop/loop-task-runtime-service.js` only
  routed blocked product-audit returns to repair when
  `productAuditBlockedRepairRoute()` could infer missing packet evidence. A
  blocked/malformed audit return with no explicit verdict and no missing
  requirements/design section could fall through to `blocked_role_return`,
  leaving no actionable route.
- Source changes pending final validation:
  - normalize product-audit terminal returns into explicit audit verdicts from
    structured fields or bounded return text;
  - route requirements/design gaps back to the source requirements lane;
  - route implementation/UX/test/privacy findings to repair and include the
    bounded audit return summary in the repair card input;
  - classify malformed completed audit returns as an explicit routing error
    instead of leaving `lastAuditVerdict` empty;
  - recover historical blocked audit returns with pending repair slices by
    normalizing the missing verdict and dispatching repair only after a
    concrete target lane is selected.
- Focused validation already passed:
  `node --check services/at-loop/loop-task-runtime-service.js`,
  `node --check test/loop-task-runtime.test.js`, and
  `node --test test/loop-task-runtime.test.js` (`31` passed).
- No Movie workspace files were read or modified, and no raw thread bodies,
  secrets, provider payloads, screenshots, DB rows, or long logs were exposed.

## 2026-07-04T17:50:00+08:00 - Task-card registry routing and heartbeat MCP fix deployed

- Source task card `ttc_ee4888e5a0d16da328` requested repair for stale
  thread registry/task-card routing after Codex compaction continuation.
- Commits:
  - `1ab69c1b` `fix: route task cards to current codex mobile lane`;
  - `77e05864` `fix: expose task-card heartbeat MCP tool`.
- Routing behavior:
  - `codex_mobile_implementation` excludes `ChatGPT Pro` and
    `Codex Mobile Public PR`;
  - exact archived/non-deliverable implementation ids fail closed with bounded
    same-role `suggestedTargets` metadata instead of being revived;
  - task-card target summaries/hints hydrate titles from `session_index`.
- Heartbeat exposure:
  - standalone `scripts/codex-mobile-mcp-server.js` now exposes
    `task_card_heartbeat`;
  - MCP config generation registers the tool so task-card worker threads can
    report bounded progress without reading or printing access keys.
- Source validation:
  - changed-file `node --check`;
  - routing focused suite (`105` passed);
  - MCP/routing focused suite (`47` passed);
  - `npm run --silent check`;
  - `npm run --silent check:macos`;
  - scoped `git diff --check`.
- Private central deploy completed for ref `77e058641f96` with reason
  `codex-mobile-task-card-routing-heartbeat-mcp-77e05864`; backup:
  `/Users/hermes-host/HermesMobile/backups/deploy/20260704T094508Z-plugin-codex-mobile-web-codex-mobile-task-card-routing-heartbeat-mcp-77e05864`.
- Production readback passed: `/api/public-config`, `/api/status`,
  `/api/vite-shell-artifact`, app-preview default `/`, startup gate, source /
  production SHA parity, MCP tool-list smoke, heartbeat fake-card fail-closed
  smoke, and routing-module smoke.
- Current implementation target for Codex Mobile source threads:
  `019f2c43-6176-7582-b412-32ef9dc027d2` / `codex mobile 07-04` /
  `/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web`.
- Privacy boundary respected: no raw secrets, access keys, cookies, endpoint
  bodies, private thread bodies, provider payloads, DB rows, screenshots, raw
  auth URLs, or long logs were exposed.

## 2026-07-04T20:16:00+08:00 - Runtime pressure hotfix deployed and expired task cards purged

- Source commit `4740f181` (`fix: reduce task-card watchdog and runtime log
  pressure`) was deployed privately through the central Home AI Mac deploy
  script with reason `codex-mobile-runtime-pressure-hotfix-4740f181`.
- Deploy backup:
  `/Users/hermes-host/HermesMobile/backups/deploy/20260704T120735Z-plugin-codex-mobile-web-codex-mobile-runtime-pressure-hotfix-4740f181`.
- Production deploy validation passed: log permission repair, selected mux
  refresh check, production proof-file hashes, launchd print, public-config
  health readback, Codex Mobile listener startup gate, and Codex auth profile
  audit.
- Execution Watchdog remains temporarily disabled in
  `/Library/LaunchDaemons/com.hermesmobile.plugin.codex-mobile.plist` via
  `CODEX_MOBILE_TASK_CARD_EXECUTION_WATCHDOG_INTERVAL_MS=0`.
- Runtime task-card store purge was applied to
  `/Users/xuxin/.codex-mobile-web/thread-task-cards.json` after acquiring the
  same lock convention used by the service. Backup:
  `/Users/xuxin/.codex-mobile-web/backups/task-card-store-purge/thread-task-cards.before-expired-purge.20260704T121319Z.json`.
- Purge result: card count reduced from `1668` to `23`; removed `1645`
  expired/settled/stale cards and `8` unreferenced workflows. Kept cards:
  `22` approved and `1` approving, including the single approved card with an
  active execution lease.
- After purge, `thread-task-cards.json` is about `174KB`; `/api/public-config`
  returns HTTP `200` in milliseconds after warmup.
- 8787 listener was kickstarted after purge to release old heap state. Latest
  observed listener pid `71858`, RSS about `425MB`, CPU falling to low single
  digits. Desktop `codex app-server` pid `44682` still retained about `3.8GB`
  RSS but had low CPU at the last sample; this remains a separate app-server
  memory-retention follow-up.

## 2026-07-04T21:22:00+08:00 - Thread-list cache bulk-upsert performance fix deployed

- Follow-up root-cause investigation found the post-compaction slowdown was not
  only task-card/watchdog pressure. A stale active summary on a very large
  rollout triggered background active-window prewarm, and cold thread-list
  cache miss/rebuilds spent most time in the server-side `mergeMs` bucket.
- The active-window prewarm path now skips huge summaries before background
  app-server reads when `rolloutSizeBytes` exceeds the bounded threshold. This
  prevents the Home AI `~586MB` rollout from being prewarmed as an active
  background detail read after compaction/continuation state drift.
- A second root cause was the fallback thread-list cache update path:
  list-refresh upserts previously processed rows one at a time, repeatedly
  filtering and merging cache entries, updating source snapshots, and writing
  the persistent JSON cache. This made a small list refresh appear as
  multi-second CPU/disk pressure.
- Implemented true bulk upsert across:
  `services/thread-list/thread-list-fallback-cache-service.js`,
  `services/thread-list/thread-list-fallback-baseline-service.js`,
  `services/thread-list/thread-list-runtime-service.js`,
  `services/thread-list/thread-list-state-service.js`,
  `services/thread-list/thread-list-server-boundary-service.js`, and
  `server.js`.
- Added regression tests in `test/thread-list-fallback-cache-service.test.js`
  and `test/thread-list-state-service.test.js` proving bulk list refreshes use
  one persistent cache save path and state service prefers the bulk boundary.
- Validation passed:
  `node --test test/thread-list-fallback-cache-service.test.js
  test/thread-list-state-service.test.js test/thread-list-runtime-service.test.js
  test/thread-list-service-boundary.test.js test/thread-visibility.test.js`
  (`101` tests), plus `npm run check`.
- Deployed privately through the central Home AI Mac deploy script with reason
  `codex-mobile-thread-list-cache-true-bulk-upsert`. Backup:
  `/Users/hermes-host/HermesMobile/backups/deploy/20260704T132126Z-plugin-codex-mobile-web-codex-mobile-thread-list-cache-true-bulk-upsert`.
- Production readback confirmed the new bulk functions are present in
  `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web` and launchd
  `com.hermesmobile.plugin.codex-mobile` is running with execution watchdog
  still disabled.
- Bounded production timing after deploy:
  default `/api/threads?limit=200` returned `86-89ms` total with `mergeMs`
  `30-35ms`; controlled search cold misses that were previously `3.5-3.8s`
  dropped to about `0.5-1.0s` depending on rollout baseline reads.
- Residual: search-filtered thread-list requests still spend about `450-540ms`
  in the merge/update bucket because the route still refreshes fallback cache
  from app-server/fallback rows on every search request. The primary default
  thread-list path is back under `100ms`; search refresh can be optimized
  separately if it becomes user-visible.

## 2026-07-04T22:30:00+08:00 - Message-submit hot-path timing and dedupe guard

- User-provided production evidence narrowed the remaining send-message
  latency to the Codex Mobile listener `POST /api/threads/:threadId/messages`
  path, with listener event-loop lag and CPU/heap pressure while mux pending
  was `0` and app-server pressure was low.
- Root-cause hypothesis: the route performed synchronous/heavy listener-side
  work before or around the mutation RPCs, especially runtime settings
  resolution before the submission dedupe boundary, making duplicate submits
  repeat thread-runtime resolution and leaving no phase evidence for the slow
  path.
- Source change in `server-routes/thread-message-route-service.js`:
  message-submit now records bounded phase timings for body read, input build,
  submission key, runtime settings, stale preflight, interrupt, steer, resume,
  turn start, local notify, dedupe wait, and total route time in the existing
  `[message-submit]` runtime log. `resolveThreadRuntimeSettings()` is now
  executed inside the `runMessageSubmissionOnce()` leader callback so reused
  duplicate submissions do not repeat runtime settings resolution.
- Regression tests added in `test/thread-message-secret-ref-route.test.js`
  prove duplicate-submission reuse does not resolve runtime settings again and
  normal sends emit bounded timing fields.
- Validation passed:
  `node --test test/thread-message-secret-ref-route.test.js
  test/new-thread-route.test.js test/server-http-runtime-service.test.js`
  (`38` tests), plus `npm run check`.
- Not deployed yet. No raw secrets, access keys, cookies, endpoint bodies,
  private thread bodies, provider payloads, DB rows, screenshots, raw auth
  URLs, or long logs were exposed.

## 2026-07-04T23:05:00+08:00 - Home AI Loop lifecycle and compact lane titles pending deploy

- Continued Home AI cards `ttc_622c96b5e25347aaa3` and
  `ttc_3212b56b20e1706387` in the Codex Mobile workspace.
- Source changes:
  - `services/at-loop/loop-task-runtime-service.js` now generates compact role
    lane titles: `<Workspace> Loop Requirements`, `<Workspace> Loop Implement`,
    `<Workspace> Loop Audit`, `<Workspace> Loop Repair`, and strips old long
    `Loop Implementation: ...` source title tails before naming new lanes.
  - The same runtime now exposes a bounded `threadLifecycle()` surface with
    `list`, `resolve`, `ensure`/`create`, `refresh`, and
    `achieve`/`mark_role_complete` actions. It classifies by role/purpose/cwd
    and explicit deliverability metadata; latest-turn `status=completed` is
    preserved as informational and does not make a role lane non-deliverable.
  - `server-routes/at-loop-route-service.js` exposes
    `POST /api/at-loop/thread-lifecycle`.
  - `scripts/codex-mobile-mcp-server.js` exposes the model-visible
    `thread_lifecycle` MCP tool, and
    `adapters/codex-mobile-mcp-config-service.js` registers its tool approval
    section.
  - `docs/MODULES.md` was updated for the new MCP surface.
- Regression coverage:
  - completed implementation lanes remain lifecycle-deliverable unless
    explicit non-deliverability metadata such as `archived` is present;
  - lifecycle `ensure` creates a compact `Movie Loop Implement` lane from an
    old long title source;
  - lifecycle `mark_role_complete` marks the role slice achieved;
  - MCP and HTTP route tests cover `thread_lifecycle`.
- Validation passed:
  `node --test test/loop-task-runtime.test.js test/at-loop-route-service.test.js
  test/codex-mobile-mcp-server.test.js
  test/thread-task-card-loop-routing-service.test.js` (`43` tests), plus
  `npm run check`.
- Not deployed yet and no return cards have been sent yet. No raw secrets,
  access keys, cookies, endpoint bodies, private thread bodies, provider
  payloads, DB rows, screenshots, raw auth URLs, or long logs were exposed.
