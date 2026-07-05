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

## Current Addendum - 2026-07-04 POST/detail latency and settled large-window fix

- Existing-thread `POST /api/threads/:threadId/messages` is not the current
  production bottleneck after `82d1cf08` / `d38d6e23`: the latest isolated
  existing-thread follow-up smoke after the detail fix had route max/last
  `12ms`, slow `0`, and `steeringQueued=false`. No real Home AI large-thread
  message was injected for verification.
- Commit `79093e2b126b` (`fix: bound display summary cache memory`) was
  deployed through Codex Mobile Deploy Lane. Backup:
  `/Users/hermes-host/HermesMobile/backups/deploy/20260704T165412Z-plugin-codex-mobile-web-codex-mobile-display-summary-cache-memory-79093e2b`.
  The display summary cache no longer retains full thread-detail payloads, but
  large-window reads can still raise V8 heap until GC.
- Commit `4ea4195ec229` (`fix: keep settled large detail on recent window`)
  was deployed through Codex Mobile Deploy Lane card
  `ttc_cb581a439344044dfb`; return card
  `ttc_e5d913b09574255ce6` completed. Backup:
  `/Users/hermes-host/HermesMobile/backups/deploy/20260704T171043Z-plugin-codex-mobile-web-codex-mobile-settled-large-detail-window-4ea4195e`.
- Root cause for the remaining user-perceived send/open latency: completed
  Home AI large thread `019eed86-2002-7cc2-b0b7-937eb5355f36` was repeatedly
  falling through to `turns-list-large` because stale active-like window turns
  promoted recent reads to full/large fallback. Explicit `budget=compact` also
  did not map to recent-window orchestration.
- Fix: terminal summaries now downgrade stale active turns in projected/initial
  windows with bounded `mobileStaleActiveTurn` markers and seed/reuse recent
  partial projection. Explicit compact budget maps to recent-window
  orchestration unless `mode=full`.
- Validation: source focused node tests, `npm run --silent check`, and
  `git diff --check -- ':!.agent-context'` passed. Production focused tests
  passed `153/153`, and source/production SHA parity matched all changed files.
- Production readback for the Home AI large thread: first
  `?mode=recent&budget=compact` cold seed was `3365ms`, then warm partial
  projection reads were `160-174ms` external / `25-29ms` server. Plain
  `?budget=compact` repeated reads were `158-159ms` external / `25-26ms`
  server. Repeated `turns-list-large` fallback was closed.
- Residuals: first cold seed still costs about `3.36s`; listener heap can rise
  near `1GB` after large-window reads until V8 GC; shared app-server had a
  moderate residual CPU sample. If latency or CPU spikes persist, the next
  bounded targets are cold seed cost and large-window allocation/GC, then
  app-server CPU profiling.

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

## 2026-07-04T23:35:00+08:00 - Orphaned receipts submitted and message-submit timing aliases committed

- Home AI sent `ttc_aabe26409e8caf766c` requesting replacement closure
  evidence for cleaned original task cards:
  `ttc_622c96b5e25347aaa3` and `ttc_3212b56b20e1706387`.
- Direct `return_to_source` for `ttc_622c96b5e25347aaa3` returned bounded
  no-op `task_card_not_found`; MCP return produced the same result. Production
  task-card store only had bounded reverse-return metadata showing prior
  `partially_completed` records, not enough original-card state for normal
  terminal attachment.
- Created replacement source-visible receipts in Home AI 06-22:
  - `ttc_b4345e134762ea6bf7` for original lifecycle API card
    `ttc_622c96b5e25347aaa3`;
  - `ttc_f7775a30238bf3b8a4` for original compact lane title card
    `ttc_3212b56b20e1706387`.
- Returned `ttc_aabe26409e8caf766c` completed via reply card
  `ttc_54193ba7fd3e47415f`.
- Home AI returned terminal receipt acknowledgements:
  - `ttc_15be6a51104a1b1bdf` accepted lifecycle replacement receipt;
  - `ttc_086f5ee8205cb5e51e` accepted compact-title replacement receipt.
  Both explicitly said not to send acknowledgement returns.
- Additional source commit `7483f4d7`
  (`fix: add explicit message submit timing fields`) adds production-friendly
  message-submit timing aliases: `readMessageMs`, `threadResumeMs`,
  `notifyLocalTurnStartedMs`, and `sendJsonMs`, while preserving existing
  timing aliases.
- Validation for `7483f4d7` passed:
  `node --test test/thread-message-secret-ref-route.test.js
  test/new-thread-route.test.js test/server-http-runtime-service.test.js`
  (`38` tests), plus `npm run check` and `git diff --check`.
- Deployment request to `Codex Mobile Deploy Lane` was attempted with source
  ref `7483f4d79b93`, but both dynamic tool and MCP delegation returned
  `deploy_lane_required` / `deploy_lane_missing`, even though
  `list_threads(search="Codex Mobile Deploy Lane")` showed the configured lane
  visible and `idle`. This is a deploy-lane routing/policy blocker; production
  has not been updated with `7483f4d7` or `509b50de` yet.
- Follow-up gap remains: task-card cleanup should preserve return-routing
  tombstones/stubs for recently delegated or non-terminal cards, and
  `return_to_source` should attach via the stub or return a bounded
  `task_card_cleaned_return_stub_available` style response.
- Privacy boundary respected: no raw secrets, access keys, cookies, launch
  tokens, private thread bodies, task-card bodies, endpoint bodies, provider
  payloads, screenshots, DB rows, raw auth URLs, password paths, or long logs
  were exposed.

## 2026-07-04T22:42:00+08:00 - Deploy-lane routing inconsistency fixed locally; Home AI bootstrap card sent

- User asked to fix the inconsistency behind routine Codex Mobile deployment
  cards failing with `deploy_lane_required` / `deploy_lane_missing` despite the
  `Codex Mobile Deploy Lane` being visible.
- Root cause in local source: task-card deploy-lane routing evaluated stale
  stored target summaries and live visible target summaries inconsistently.
  After merging live visible metadata into target summaries, the deploy-lane
  matcher could also see the same lane twice through target and visible
  summaries and treat the configured lane as non-unique/missing.
- Source commit `09d9b9bd` (`fix: resolve deploy lane task-card routing`)
  fixes the owning Codex Mobile Web layer:
  - `server-routes/thread-task-card-route-service.js` now merges stored target
    summaries with live visible target summaries before deploy-lane policy
    evaluation, and prefers live visible metadata when filling target
    workspace ids;
  - `services/task-cards/thread-task-card-deploy-lane-policy-service.js`
    de-duplicates deploy-lane matches by thread id before deciding whether the
    configured lane is unique;
  - route/policy tests cover explicit deploy-lane id/title requests when state
    DB metadata is stale but the live visible summary is correct.
- Validation passed:
  `node --test test/thread-task-card-route.test.js
  test/thread-task-card-deploy-lane-policy-service.test.js` (`47` tests),
  `npm run check`, and `git diff --check`.
- A new deployment task-card attempt to `Codex Mobile Deploy Lane` with source
  ref `09d9b9bd` still failed in production with
  `deploy_lane_required` / `deploy_lane_missing`, which is expected until the
  local routing fix is bootstrapped into production.
- Sent Home AI repair/bootstrap card `ttc_27da18564fee0b046b` to Home AI 06-22
  (`019eed86-2002-7cc2-b0b7-937eb5355f36`) requesting central deploy or route
  repair for `codex-mobile-web` commit `09d9b9bd`, with bounded evidence and
  readback requirements.
- Production still has not been confirmed updated with `509b50de`, `7483f4d7`,
  or `09d9b9bd`. No raw secrets, access keys, cookies, launch tokens, private
  thread bodies, task-card bodies, endpoint bodies, provider payloads,
  screenshots, DB rows, raw auth URLs, password paths, or long logs were
  exposed.

## 2026-07-04T22:55:00+08:00 - Home AI large-thread detail fluctuation diagnosed; rollout enrichment cache fix sent to deploy lane

- User reported that the large Home AI thread sometimes opens slowly, whereas
  it previously felt consistently fast with cache. User also noted the
  fluctuation could be CPU pressure rather than cache miss.
- Production readback before the fix:
  - repeated reads of Home AI 06-22 (`019eed86-2002-7cc2-b0b7-937eb5355f36`)
    showed projection hits, not repeated full `thread/read` misses;
  - observed modes included `projection-active-overlay` and
    `projection-v4-dynamic`, with `threadReadMs=0`;
  - rollout size was about `589MB`;
  - first read after cold enrichment state could show `prepareResponseMs`
    hundreds of ms, followed by same-stat reads in tens of ms;
  - listener `server.js` could spike to high CPU while app-server CPU stayed
    low, pointing at listener-side response preparation / JSONL enrichment
    work rather than app-server queueing.
- Local source commit `c68243f0`
  (`fix: cache rollout enrichment detail parsing`) was created:
  - `adapters/rollout-detail-enrichment-service.js` now keeps a small
    process-local parsed enrichment entries cache, reuses it only when rollout
    `size` and `mtime` match, and parses only appended bytes when an active
    rollout grows within the bounded enrichment window;
  - parsed-entry cache is capped separately at a small limit to avoid turning
    the fix into a heap pressure source;
  - detail response preparation now records subphase timings for completion
    backfill, usage summaries, user-input anchors, active-assistant
    enrichment, projection finalize, task-card attach, and response budget;
  - diagnostics expose those subphase timings in
    `mobileDiagnostics.threadDetailTimings`.
- Validation passed:
  `node --test test/turn-usage-summary-service.test.js
  test/thread-detail-runtime-service.test.js` (`15` tests), `npm run check`,
  and `git diff --check`.
- Home AI returned terminal receipt `ttc_4fd2eb35d4e47d8d52` stating the prior
  deploy-lane bootstrap completed: production deployed `54f73f5d`, with
  `09d9b9bd` as an ancestor, and a pending-only smoke proved routine
  `plugin_deployment` cards to `Codex Mobile Deploy Lane` no longer fail with
  `deploy_lane_missing`. Per receipt policy, no acknowledgement return was
  sent.
- Created deployment card `ttc_228aeb19b95bce23c5` to `Codex Mobile Deploy
  Lane` (`019f16e6-9131-79e2-9b6b-ad41f7e65d92`) requesting deployment of
  `c68243f0` and bounded readback of Home AI large-thread detail timings plus
  runtime pressure.
- User noted a future logging strategy cleanup: normal operation should avoid
  writing most logs, with debug logging enabled by an explicit flag. This is
  recorded as a follow-up direction, not part of the current performance fix.
- Privacy boundary respected: no raw secrets, access keys, cookies, launch
  tokens, private thread bodies, task-card bodies, endpoint bodies, provider
  payloads, screenshots, DB rows, raw auth URLs, password paths, full rollout
  contents, full prompts, or long logs were exposed.

## 2026-07-04T23:11:00+08:00 - Codex Mobile deploy-lane self-redirect blocked locally

- User flagged a routing contradiction: routine `codex-mobile-web` deployment
  should run in the dedicated `Codex Mobile Deploy Lane`, but the previous
  card `ttc_228aeb19b95bce23c5` was redirected by that lane to generic
  `Home AI Deploy` as `ttc_d38c5a88850906822f`; the terminal deploy receipt
  then returned to `Codex Mobile Deploy Lane` instead of the original
  implementation source.
- Contract readback confirmed the user was correct: the central macOS deploy
  contract and deployment module say plugin-specific deploy lanes take
  precedence while live; `codex-mobile-web` maps to `Codex Mobile Deploy Lane`,
  with fallback to another shared deploy lane only when the dedicated lane is
  missing, terminal, stuck, hidden, archived, or transport-failing.
- Local source commit `82ff6cce`
  (`fix: block deploy lane self-redirects`) closes the Codex Mobile Web routing
  gap: `services/task-cards/thread-task-card-deploy-lane-policy-service.js`
  now rejects a routine plugin deployment when the source thread is already
  that plugin's assigned deploy lane and the target is another lane. The
  bounded reject code is `deploy_lane_already_at_expected_lane`, with reason
  `source_thread_is_assigned_deploy_lane`.
- Regression coverage:
  - policy test proves a `codex-mobile-web` `plugin_deployment` card already
    in `Codex Mobile Deploy Lane` cannot redirect to `Home AI Deploy`;
  - route test proves `buildThreadTaskCardCreatePayload()` surfaces the same
    409 bounded error at the dynamic tool boundary.
- Validation passed:
  `node --test test/thread-task-card-deploy-lane-policy-service.test.js
  test/thread-task-card-route.test.js` (`49` tests),
  `npm run --silent check`, and `git diff --check`.
- New deployment/repair card sent to `Codex Mobile Deploy Lane`:
  `ttc_e1664dd87af3390f16`. It requests central deployment of `82ff6cce`,
  forbids redirecting this live dedicated-lane task to `Home AI Deploy`, and
  asks the lane to include bounded evidence about whether the previous
  misrouted Home AI deploy result actually deployed the earlier performance
  fix and whether a replacement source-visible receipt remains needed.
- Production deployment of `82ff6cce` has not been returned yet in this
  thread. No raw secrets, access keys, cookies, launch tokens, private thread
  bodies, task-card bodies, endpoint bodies, provider payloads, screenshots,
  DB rows, raw auth URLs, password paths, or long logs were exposed.

## 2026-07-04T23:24:00+08:00 - CPU spike check found residual active-overlay backfill hot path

- User asked whether the previous performance code actually solved the CPU
  spike problem.
- Production readback after deploy-lane self-redirect repair confirmed
  `82ff6cce` was deployed by `Codex Mobile Deploy Lane`, and the previous
  performance ref `c68243f0` was present in production.
- Bounded production sampling of Home AI large thread
  `019eed86-2002-7cc2-b0b7-937eb5355f36` showed the old full-rollout parsing
  path was avoided:
  - `readMode=projection-active-overlay`;
  - `projectionState=hit`;
  - `threadReadMs=0`;
  - `rolloutSizeBytes≈589651282`;
  - response body about `121KB`;
  - `prepareResponseMs≈77-173ms`.
- The CPU/latency issue was not fully solved. Slow route evidence moved to the
  active-overlay foreground backfill path:
  - repeated large-thread detail samples had `activeOverlayWindowMs` around
    `1814-2366ms` and `activeOverlayBackfillWindowMs` around `1816-2365ms`;
  - `/api/status?detail=1` showed listener pid `89871`, RSS around
    `2.0-2.2GB`, heap around `1.19-1.32GB`, and event-loop lag max around
    `2311ms` after slow samples;
  - one direct `ps` sample showed listener CPU around `105%`;
  - `codex app-server` CPU was also spiky during sampling.
- Root cause found in `services/thread-detail/thread-detail-read-orchestration-service.js`:
  `projection-live` incomplete active overlays force fresh active-window
  backfill for correctness. After the first fresh backfill, the service seeds a
  `turns-list-active-overlay-window` partial projection, but the next read
  still ignored that version-matched active-window cache and performed the same
  foreground `turnsListThreadReadResult(mode=turns-list-active-overlay-window)`
  again.
- Local source commit `6b120666`
  (`fix: reuse trusted active overlay window cache`) reuses cached active-window
  backfill only when it is explicitly an active-overlay window, contains the
  active turn, carries overlay revision/timestamp evidence, and its
  revision/timestamp is at least the live overlay revision/timestamp. Stale,
  missing, unversioned, or turn-missing cache still falls back to the previous
  fresh-read behavior.
- Validation passed:
  `node --test test/thread-detail-read-orchestration-service.test.js
  test/thread-detail-active-overlay-provider-service.test.js
  test/thread-detail-projection-v4-service.test.js` (`62` tests);
  `node --test test/thread-detail-runtime-service.test.js
  test/turn-usage-summary-service.test.js
  test/thread-detail-read-orchestration-service.test.js` (`55` tests);
  `npm run --silent check`; and `git diff --check`.
- Deployment/readback card sent to `Codex Mobile Deploy Lane`:
  `ttc_3ff02a441298e60f36`. It requests central deployment of `6b120666` and
  repeated production large-thread timing/CPU readback focused on
  `activeOverlayWindowMs`, `activeOverlayBackfillWindowMs`, listener CPU/RSS,
  event-loop lag, and `codex app-server` CPU.
- Production deployment of `6b120666` has not yet returned in this thread. No
  raw secrets, access keys, cookies, launch tokens, private thread bodies,
  task-card bodies, endpoint bodies, provider payloads, screenshots, DB rows,
  raw auth URLs, password paths, full prompts, full rollout contents, or long
  logs were exposed.

## 2026-07-04T23:27:00+08:00 - Active-overlay CPU fix deployed and production readback confirmed

- Codex Mobile Deploy Lane returned terminal completed receipt
  `ttc_eb5b744b83550dcc2b` for deployment card
  `ttc_3ff02a441298e60f36`. Per terminal receipt policy, no acknowledgement
  return was sent.
- Deployed ref:
  `6b120666f3e021d218ffb90594f997c6c99c37dd`
  (`fix: reuse trusted active overlay window cache`).
- Central private macOS deploy result: `ok=true`; backup path:
  `/Users/hermes-host/HermesMobile/backups/deploy/20260704T152332Z-plugin-codex-mobile-web-codex-mobile-active-overlay-cache-6b120666`.
- Runtime readback:
  - launchd `com.hermesmobile.plugin.codex-mobile` running;
  - listener `127.0.0.1:8787` pid `44844`;
  - `/api/public-config` HTTP `200`, default shell `vite-app-preview`;
  - `/api/status?detail=1` HTTP `200`, `ready=true`, issue codes `[]`;
  - `/api/vite-shell-artifact` HTTP `200`, `ok=true`, published files `23`.
- Source/prod SHA prefixes matched for:
  - `services/thread-detail/thread-detail-read-orchestration-service.js`;
  - `test/thread-detail-read-orchestration-service.test.js`.
- Production large-thread readback for Home AI 06-22
  `019eed86-2002-7cc2-b0b7-937eb5355f36` with `?budget=compact` confirmed:
  - all samples HTTP `200`;
  - `mobileReadMode=projection-active-overlay`;
  - `phase=warm-projection-active-overlay`;
  - `projectionState=hit`;
  - `threadReadMs=0`, `rawThreadReadMs=0`, `turnsListInitialMs=0`,
    `turnsListBeforeFullMs=0`, `turnsListFallbackMs=0`;
  - rollout size about `590178051` bytes;
  - `activeOverlayWindowMs=0` and `activeOverlayBackfillWindowMs=0` on all
    reported samples;
  - first cold sample still had `prepareResponseMs=1439ms`, then warm repeated
    reads stabilized around `51-65ms` server total and about `73KB` response
    bytes.
- Process/route pressure after readback:
  - listener RSS about `1549MB`, heap used about `984MB`;
  - event-loop utilization `0.025`, lag p95 `22.1ms`, p99 `42.2ms`;
  - `GET /api/threads/:threadId` route stats count `10`, slow count `1`,
    max `1474ms`, average `225ms`, last `56ms`;
  - first cold read briefly pushed listener CPU above `100%`, after cooldown
    listener sampled around `18%`;
  - `codex app-server` stayed out of the foreground detail path but had
    background fluctuation around `5-31%`.
- Closure state: repeated active-overlay backfill CPU path is fixed in
  production. Residual performance target, if needed, is first-cold
  `prepareResponseMs`; this is not the repeated CPU spike path fixed by
  `6b120666`.
- Privacy boundary respected: only bounded ids, statuses, counts, short hashes,
  commit refs, backup path, route/timing metrics, and summaries were recorded;
  no raw secrets, access keys, cookies, launch tokens, password-file paths,
  private thread bodies, task-card bodies, endpoint bodies, provider payloads,
  DB rows, screenshots, raw auth URLs, full prompts, full rollout contents, or
  long logs were exposed.

## 2026-07-04T23:55:00+08:00 - Active-overlay latency fluctuation root cause narrowed and local fix prepared

- User reported Home AI large thread entry was still fluctuating and could take
  about `2-3s`.
- Bounded production sampling of Home AI 06-22
  `019eed86-2002-7cc2-b0b7-937eb5355f36` on currently deployed
  `6b120666` showed the new slow samples were not a first-cold
  `prepareResponse` problem:
  - slow samples remained `mobileReadMode=projection-active-overlay` and
    `projectionState=hit`;
  - `threadReadMs=0` and `rawThreadReadMs=0`;
  - `prepareResponseMs` stayed around `80-93ms` in slow samples;
  - slow samples had `activeOverlayWindowMs≈2263-2982ms` and
    `activeOverlayBackfillWindowMs≈2265-2983ms`;
  - `/api/status?detail=1` route stats showed
    `GET /api/threads/:threadId` slow count `28/107`, max `2950ms`, avg
    `739ms`; listener RSS about `2842MB`, heap used about `1784MB`,
    event-loop lag max about `3148ms`; `POST /api/threads/:threadId/messages`
    still had previous slow samples up to about `7815ms`.
- Root cause refined: the `6b120666` trusted active-window cache reuse path was
  correct but incomplete. When `projection-live` overlay evidence still required
  a fresh active window, the foreground cache lookup did not pass
  `omitActiveTurnId`. v4's dedicated active-window cache can often work without
  it, but fallback/base stale-full or history-window lookup only proves the
  active-turn keyed window when `omitActiveTurnId` is present. In that miss
  shape, the route fell back to `turns-list-active-overlay-window`, producing
  the observed 2-3s foreground latency.
- Local fix prepared in
  `services/thread-detail/thread-detail-read-orchestration-service.js`: both
  active-window cache lookups used before foreground bounded reads now pass
  `omitActiveTurnId: backfillActiveTurnId`. This preserves the proof gate and
  only avoids an unnecessary app-server `turns/list` read when the keyed
  active-window cache is already available.
- Added regression coverage in
  `test/thread-detail-read-orchestration-service.test.js` for the production-like
  shape where the unkeyed lookup returns a history window without the active
  turn, but the active-turn keyed lookup returns a trusted active-window; the
  test asserts no `turns-list-active-overlay-window` read is performed.
- Also prepared a bounded first-paint prewarm/diagnostic path:
  - new `thread-detail-first-paint-prewarm` runtime job;
  - new service under
    `services/thread-detail/thread-detail-first-paint-prewarm-service.js`;
  - scheduling from active rows in thread-list results with rollout-size,
    pending, and min-interval gates;
  - `/api/status?detail=1` exposes bounded first-paint prewarm status;
  - dedicated tests in
    `test/thread-detail-first-paint-prewarm-service.test.js`.
- Validation passed locally:
  `node --test test/thread-detail-read-orchestration-service.test.js
  test/thread-detail-active-window-prewarm-service.test.js
  test/thread-detail-first-paint-prewarm-service.test.js
  test/thread-detail-runtime-service.test.js
  test/runtime-job-scheduler-service.test.js
  test/server-runtime-config-service.test.js
  test/core-api-route-service.test.js`;
  `npm run --silent check`; and `git diff --check -- ':!.agent-context'`.
- Deployment has not yet been performed for this local fix. Privacy boundary
  respected: only bounded ids, route/status metrics, timing fields, and file
  summaries were recorded; no raw secrets, access keys, cookies, launch tokens,
  private thread bodies, task-card bodies, endpoint bodies, provider payloads,
  DB rows, screenshots, raw auth URLs, full prompts, full rollout contents, or
  long logs were exposed.

## 2026-07-05T00:17:00+08:00 - Local-turn first-paint prewarm follow-up prepared

- Codex Mobile Deploy Lane returned completed deployment receipt
  `ttc_41e0ee0f4cba287707` for `0564eccf`
  (`fix: stabilize active overlay first paint`). Per terminal receipt policy,
  no acknowledgement return was sent.
- Production readback after `0564eccf` confirmed the specific repeated
  active-overlay window/backfill path was closed:
  - sampled active-overlay reads had `activeOverlayWindowMs=0` and
    `activeOverlayBackfillWindowMs=0-1ms`;
  - remaining slow samples were different paths: projection miss to
    `turns-list-large`, one cold `thread-read`, and some projection-hit reads
    dominated by `prepareResponseMs`;
  - final pressure readback showed listener pid `83391`, event-loop lag p95
    about `22.4ms`, p99 about `85.4ms`; route stats still had residual
    `GET /api/threads/:threadId` slow count `4/14` from the cold/miss samples.
- Additional local sampling after deploy showed repeated direct Home AI detail
  reads had stable `projection-active-overlay` / projection-hit server totals
  around `124-162ms`, with one `prepareResponseMs≈495ms` sample and no
  foreground active-window backfill. `/api/status?detail=1` also showed a
  separate `POST /api/threads/:threadId/messages` slow sample around `9391ms`,
  still out of scope for the GET-entry fix.
- Thread-list readback confirmed the Home AI row
  `019eed86-2002-7cc2-b0b7-937eb5355f36` is active and has
  `rolloutSizeBytes≈591491157`, so it is eligible for first-paint prewarm.
  However `notifyLocalTurnStarted` only scheduled active-window prewarm. If
  the user opens immediately after local `message-submit`, first detail can
  race before first-paint detail prewarm has built a projection/detail cache.
- Local follow-up fix prepared:
  - `notifyLocalTurnStarted` now schedules
    `scheduleThreadDetailFirstPaintPrewarm(..., { activeHint: true })` in
    addition to active-window prewarm;
  - first-paint prewarm now resolves the real thread summary before deciding
    when the local active summary lacks `rolloutSizeBytes`, then keeps the
    rollout-size threshold so small threads are not blindly prewarmed;
  - first-paint prewarm status now records a global latest result as well as
    per-thread last result;
  - `/api/status?detail=1&threadId=<id>` passes the thread id into
    `threadDetailFirstPaintPrewarmStatus` for bounded readback.
- Validation passed locally:
  `node --test test/thread-detail-first-paint-prewarm-service.test.js
  test/thread-detail-read-orchestration-service.test.js
  test/thread-detail-runtime-service.test.js
  test/runtime-job-scheduler-service.test.js
  test/server-runtime-config-service.test.js
  test/core-api-route-service.test.js test/thread-task-card-route.test.js`;
  `npm run --silent check`; and `git diff --check -- ':!.agent-context'`.
- Deployment has not yet been performed for this follow-up. Privacy boundary
  respected: only bounded ids, route/status metrics, timing fields, and file
  summaries were recorded; no raw secrets, access keys, cookies, launch tokens,
  private thread bodies, task-card bodies, endpoint bodies, provider payloads,
  DB rows, screenshots, raw auth URLs, full prompts, full rollout contents, or
  long logs were exposed.

## 2026-07-05T00:05:14+08:00 - Existing-thread message submit latency fix prepared

- User reported Composer sends sometimes block for several seconds before the
  message is accepted. Current evidence points to
  `POST /api/threads/:threadId/messages`, not response size or request body
  parsing.
- Bounded production timing evidence from recent `[message-submit]` entries
  showed one Home AI 06-22 send with short text and no uploads taking about
  `9391ms` total. The dominant phase was `threadResumeMs≈7865ms`; by
  comparison `readMessageMs≈2ms`, `runtimeSettingsMs≈35ms`,
  `turnStartMs≈757ms`, `notifyLocalTurnStartedMs≈612ms`, and `sendJsonMs=0`.
- Root-cause hypothesis and owning layer: Codex Mobile Web's
  existing-thread message route synchronously called `thread/resume` before
  every non-steering `turn/start`. For already usable text-only threads this
  made the user-facing submit path wait on an expensive app-server resume
  round trip before the actual message mutation.
- Local fix prepared in `server-routes/thread-message-route-service.js`:
  - ordinary non-upload existing-thread sends now optimistically call
    `turn/start` first;
  - only errors explicitly indicating the thread is not loaded, unloaded,
    unmaterialized, or must be resumed trigger one bounded
    `thread/resume` + `turn/start` retry;
  - generic turn-start failures are not retried, avoiding duplicate user
    submissions;
  - upload/extended-history sends still pre-resume to preserve the existing
    history-persistence contract;
  - submit timings now record `threadResumeMode`, `threadResumeSkipped`,
    `turnStartInitialMs`, optional `turnStartRetryMs`, and
    `turnStartResumeFallback`.
- Regression coverage added in `test/thread-message-secret-ref-route.test.js`
  for optimistic text sends, resume-required retry, upload pre-resume,
  strict resume-needed classification, and bounded timing fields.
- Validation passed locally:
  `node --test test/thread-message-secret-ref-route.test.js
  test/new-thread-route.test.js test/message-input-service.test.js`;
  `node --test test/thread-task-card-route.test.js`;
  `npm run --silent check`; and
  `git diff --check -- ':!.agent-context'`.
- Deployment has not yet been requested for this fix at the time this handoff
  entry was written. Privacy boundary respected: only bounded ids, phase
  timings, file names, and summaries were recorded; no raw secrets, access
  keys, cookies, launch tokens, private thread bodies, task-card bodies,
  endpoint bodies, provider payloads, screenshots, DB rows, raw auth URLs,
  password paths, full prompts, rollout contents, or long logs were exposed.

## 2026-07-05T00:14:11+08:00 - Movie/Xcode stale Loop runtime cleanup completed

- User clarified the stale loop cleanup scope was Movie and Xcode. Music was
  not part of the final scope.
- Read-only inventory found 11 visible stale role-lane threads:
  - Movie: 6 `Movie Loop Implementation/Audit/Repair` threads under
    `/Users/hermes-dev/HermesMobileDev/Movie`;
  - Xcode: 5 `Xcode Loop Implementation/Audit/Repair` threads under
    `/Users/xuxin/Xcode/Home AI`.
- All 11 role-lane threads were already `completed` and were archived through
  the authenticated `/api/threads/:threadId/archive` route. No raw thread
  bodies or message contents were read or printed.
- Loop runtime state readback found 5 Movie/Xcode loop records. One Movie loop
  was still `waiting_source_requirements`; the others were `blocked` historical
  loops. To prevent future duplicate triggers from reusing or recovering stale
  state, all 5 loop records were terminated through the authenticated
  `/api/at-loop/returns` route with terminal `rejected` status and bounded
  operator-cancelled summaries. No new role task cards were dispatched.
- Final verification:
  - `Movie Loop` visible-thread search returned `[]`;
  - `Xcode Loop` visible-thread search returned `[]`;
  - `/api/at-loop/status` reported all 5 selected Movie/Xcode loop records as
    `status=rejected`, `nextRoute=rejected_role_return`,
    `waitingReturnCount=0`;
  - no non-terminal selected Movie/Xcode loops remained;
  - `/api/status?detail=1` remained `ready=true` with issue codes `[]`.
- Current limitation: Codex Mobile has no first-class `cancel_loop` API; this
  cleanup used terminal rejected returns as the supported state-machine path.
  A future runtime hardening item is to add an explicit loop-cancel action that
  records operator cancellation without needing to target a role slice.
- Privacy boundary respected: only bounded ids, statuses, route names, counts,
  workspace paths, and summaries were recorded; no raw secrets, access keys,
  cookies, launch tokens, private thread bodies, task-card bodies, endpoint
  bodies, provider payloads, screenshots, DB rows, raw auth URLs, password
  paths, full prompts, rollout contents, or long logs were exposed.

## 2026-07-05T00:19:37+08:00 - Android shell composer @ intent dialog fix prepared

- User reported that in the Android native shell, selecting `@目标任务` and
  `@loop` did not pop the expected dialog.
- Root-cause hypothesis and owning layer: Codex Mobile Web frontend composer
  interaction owned the failure. The `@` intent menu only listened for `click`
  and `selectComposerIntent()` only wrote the bare tag into the composer. The
  actual dialogs were opened only by a later send action, which is brittle in
  Android WebView/native-shell touch and keyboard focus paths.
- Local fix prepared:
  - `public/app-shell-runtime.js` now handles intent-menu activation through
    `pointerdown`, `touchend`, and `click` with synthetic-click suppression;
  - menu activation calls `selectComposerIntent(..., { openDialog: true })`
    so a single tap opens the intent dialog path;
  - `public/composer-runtime.js` routes selected `goal` to the existing thread
    Goal dialog and routes `loop` / `chatgpt-pro` to the existing composer
    intent dialog;
  - `@目标任务` direct selection clears the bare tag before opening the Goal
    dialog, preserving the existing `/g`/send fallback behavior;
  - static shell manifest regenerated so `shellCacheName/clientBuildId` changed
    to `0.1.11|codex-mobile-shell-v625-dfd04fe77600`.
- Regression coverage added in `test/at-loop-composer-intent.test.js` for
  Android-safe pointer activation and direct dialog dispatch.
- Validation passed locally:
  - `node --test test/at-loop-composer-intent.test.js
    test/thread-goal-service.test.js test/thread-task-card-route.test.js
    test/chatgpt-pro-bridge-service.test.js test/composer-runtime-ui.test.js
    test/vite-shell-asset-graph.test.js test/app-update.test.js` -> 74/74;
  - `npm run --silent check:frontend-manifest`;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`;
  - Home AI AI Ops required checks for the changed files were run; no visual
    lane or deployment-required gate was returned, and required syntax/diff
    checks passed.
- Deployment not yet completed at the time of this entry. Because this is a
  static/mobile-shell interaction fix, the deployment request should go to the
  configured Codex Mobile deploy lane with bounded readback for
  `/api/public-config`, `/api/status?detail=1`, `/api/vite-shell-artifact`,
  source/prod SHA parity for the changed frontend files, served client build
  `0.1.11|codex-mobile-shell-v625-dfd04fe77600`, and an Android native-shell
  tap verification of `@目标任务` and `@loop` when available.
- Privacy boundary respected: only bounded file names, statuses, test counts,
  static build ids, and summaries were recorded; no raw secrets, access keys,
  cookies, launch tokens, private thread bodies, task-card bodies, endpoint
  bodies, provider payloads, screenshots, DB rows, raw auth URLs, password
  paths, full prompts, rollout contents, or long logs were exposed.

## 2026-07-05T00:36:36+08:00 - Message submit active-turn steering latency fix prepared

- User reported that entering large threads is now mostly acceptable, but
  sending user messages can still be intermittently slow for seconds and has
  failed before.
- Current strongest evidence and root-cause hypothesis:
  - prior production timed samples showed ordinary existing-thread sends had
    already been improved by avoiding blocking pre-resume;
  - remaining multi-second active-thread sends were dominated by
    `steerMs/dedupeWaitMs`, specifically `turn/steer` waiting before the HTTP
    `POST /api/threads/:threadId/messages` response;
  - the violated boundary was that the route treated active-turn steering as a
    synchronous foreground operation even though the UI already has optimistic
    user-message echo and `clientSubmissionId`-based submission dedupe.
- Local fix prepared:
  - `server-routes/thread-message-route-service.js` now fast-accepts slow
    active-turn steering after a bounded threshold and returns
    `steeringQueued=true` instead of holding the POST response on `turn/steer`;
  - the pending steer echo is remembered before the background steer request,
    preserving visible user input while the app-server operation completes;
  - successful background steering still notifies mux user-message state;
  - if queued `turn/steer` later reports a stale active turn, the route now
    starts a replacement turn in the background and calls the normal
    `notifyLocalTurnStarted` path instead of dropping the accepted message into
    a failure-only log;
  - foreground stale steering still falls through to the same replacement
    turn-start path;
  - `public/composer-runtime.js` and `public/navigation-runtime.js` distinguish
    queued steering from delivered steering so the Android/web composer no
    longer reports a background-queued steer as already delivered.
- Frontend artifact consistency:
  - `npm run --silent build:frontend` regenerated the static shell manifest and
    Vite shell artifacts;
  - new `clientBuildId/shellCacheName`:
    `0.1.11|codex-mobile-shell-v625-63a078fee68a`;
  - bounded readback check showed `public/shell-asset-manifest.json` and
    `public/vite-shell/vite-shell-readback.json` have matching
    client/cache ids and `publishedFiles=23`.
- Validation passed locally:
  - `node --test test/thread-message-secret-ref-route.test.js
    test/new-thread-route.test.js` -> 38/38;
  - `node --check server-routes/thread-message-route-service.js
    public/composer-runtime.js public/navigation-runtime.js`;
  - `npm run --silent build:frontend`;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`;
  - `node --test test/vite-shell-artifact-service.test.js
    test/vite-shell-asset-graph.test.js
    test/browser-runtime-self-check-service.test.js` -> 114/114.
- Deployment not yet completed at the time of this entry. Deploy should use the
  Codex Mobile dedicated deploy lane and include readback for
  `/api/public-config`, `/api/status?detail=1`, `/api/vite-shell-artifact`,
  source/prod SHA parity for the changed route/frontend/artifact files, and
  at least one bounded existing-thread POST smoke that reports a fast
  `steeringQueued=true` response for a slow active-turn steering path if a safe
  synthetic active-turn fixture is available.
- Deployment request sent after commit:
  - target: `Codex Mobile Deploy Lane`
    (`019f16e6-9131-79e2-9b6b-ad41f7e65d92`);
  - task card: `ttc_d7de5287606e84b45b`;
  - structured fields: `cardKind=plugin_deployment`,
    `pluginId=codex-mobile-web`;
  - source commit: `82d1cf082ba6` `fix: queue active turn message steering`;
  - card notes that this ref also resolves the earlier Vite artifact mismatch
    for the Android composer intent fix by shipping matching
    `codex-mobile-shell-v625-63a078fee68a` artifacts.
- Privacy boundary respected: only bounded file names, statuses, test counts,
  static build ids, route names, and timing-field names were recorded; no raw
  secrets, access keys, cookies, launch tokens, private thread bodies,
  task-card bodies, endpoint bodies, provider payloads, screenshots, DB rows,
  raw auth URLs, password paths, full prompts, rollout contents, or long logs
  were exposed.

## 2026-07-05T01:39:17+08:00 - Cold large-thread detail seed defer committed

- User reported that Home AI large-thread entry still sometimes felt like
  0.5-1s and that POST sends remained the higher-priority issue. After prior
  deploys, repeated large-thread GET reads were warm, but the first cold recent
  detail seed could still block the foreground route on app-server
  `thread/turns/list`.
- Root-cause hypothesis for this slice:
  - violated boundary: first paint for a large resting/recent thread was still
    coupled to seeding a projection window, even when a bounded empty fallback
    plus immediate deferred seed would preserve correctness and avoid foreground
    app-server work;
  - active/live thread paths must keep the stricter active-overlay/full-read
    rules and were not relaxed by this fix.
- Local fix committed:
  - commit `0348b97f53e0` `fix: defer cold detail projection seed`;
  - `services/thread-detail/thread-detail-read-orchestration-service.js`
    now coalesces and schedules `turns-list-initial` seeding for large resting
    recent projection misses, returning
    `mobileReadMode=deferred-initial-turns-list` immediately with bounded
    `mobileDeferredProjectionSeed` metadata;
  - `public/thread-detail-render-plan.js` and
    `public/pane-layout-runtime.js` schedule a delayed current-thread refresh
    only when that deferred-seed metadata is present;
  - frontend artifacts were regenerated with
    `0.1.11|codex-mobile-shell-v625-d7475b2931a4`.
- Validation passed locally:
  - `node --test test/thread-detail-read-orchestration-service.test.js
    test/thread-detail-render-plan.test.js` -> 133/133;
  - `node --test test/thread-detail-runtime-service.test.js
    test/thread-detail-projection-service.test.js
    test/thread-rollout-size-consistency.test.js
    test/thread-task-card-route.test.js` -> 70/70;
  - `node --test test/conversation-render.test.js
    test/mobile-viewport.test.js` -> 168/168;
  - `npm run --silent build:frontend` -> ok;
  - `node --test test/thread-detail-read-orchestration-service.test.js
    test/thread-detail-render-plan.test.js
    test/vite-shell-artifact-service.test.js
    test/vite-shell-asset-graph.test.js
    test/browser-runtime-self-check-service.test.js` -> 247/247;
  - `npm run --silent check` -> pass;
  - `git diff --check -- ':!.agent-context'` -> pass.
- Deployment request sent:
  - target: `Codex Mobile Deploy Lane`
    (`019f16e6-9131-79e2-9b6b-ad41f7e65d92`);
  - task card: `ttc_0c5b18436a8c9fccfb`;
  - structured fields: `cardKind=plugin_deployment`,
    `pluginId=codex-mobile-web`;
  - source ref: `0348b97f53e0`;
  - requested readback: central private macOS deploy only, artifact
    consistency, SHA parity for changed code/tests/artifacts, focused
    production tests, Home AI large-thread bounded GET samples, and synthetic
    isolated POST route stats without injecting messages into the real Home AI
    thread.
- Current source worktree state after commit: only `.agent-context/HANDOFF.md`
  remained modified locally.

## 2026-07-05T02:56:00+08:00 - Compacted detail read partial classification fix committed and deploy requested

- Deploy lane returned `a4d3b536` as `partially_completed`:
  - deployment and production focused tests succeeded;
  - initial Home AI large-thread samples could use `projection-v4-partial`;
  - residual remained: the same target later returned
    `deferred-initial-turns-list` with `projectionMissReason=result-missing`
    and seed pending metadata; listener heap/CPU still spiked after samples.
- Additional bounded diagnosis found a second projection-cache invariant break:
  - production cache for Home AI large thread had raw persisted
    `dynamic=true`, `partial=false`;
  - the same cached thread had `mobileOlderTurnsCursor` and positive
    `mobileOmittedTurnCount`, so it was a compacted/windowed `thread-read`,
    not a full reusable cache;
  - existing `isNonFullWindowThread()` only treated older cursor as partial for
    `turns-list-*` modes, so compacted `thread-read` windows could be stored as
    full cache and later block stale partial reuse.
- Source fix committed:
  - `589998085f880e14e7d0aa7b3297ce7bc95f32a7`
    `fix: classify compacted detail reads as partial`;
  - any result with `mobileOlderTurnsCursor`, `mobileNewerTurnsCursor`, or
    positive `mobileOmittedTurnCount` is now classified as a non-full window.
- Validation passed locally:
  - `node --check adapters/thread-detail-projection-service.js`;
  - `node --test test/thread-detail-active-read-policy-service.test.js
    test/thread-detail-projection-result-service.test.js
    test/thread-detail-projection-service.test.js
    test/thread-detail-read-orchestration-service.test.js
    test/thread-detail-turns-list-read-coalescer-service.test.js
    test/thread-detail-runtime-service.test.js
    test/thread-message-secret-ref-route.test.js
    test/new-thread-route.test.js` -> 145/145;
  - `npm run --silent check` -> pass;
  - `git diff --check -- ':!.agent-context'` -> pass.
- Bounded local simulation against production cache metadata after the source
  patch:
  - raw persisted entry remained `partial=false`, `dynamic=true`, with cursor
    and omitted-turn markers;
  - same-signature lookup with `allowPartial=true` returned cached
    `partial=true`;
  - changed-signature lookup with `allowPartial=true, allowStalePartial=true`
    returned cached `partial=true`, `stalePartial=true`.
- Deployment request sent:
  - target: `Codex Mobile Deploy Lane`
    (`019f16e6-9131-79e2-9b6b-ad41f7e65d92`);
  - task card: `ttc_e686e5bfc558599996`;
  - source ref: `589998085f880e14e7d0aa7b3297ce7bc95f32a7`;
  - requested readback must verify no `deferred-initial-turns-list` recurrence
    for the target during bounded samples and include bounded cache
    classification evidence.
- Completion state:
  - source-side second fix is committed and deploy requested;
  - do not mark the CPU/POST latency goal complete until production readback
    confirms the seed cycle and listener CPU/heap spike are closed.

## 2026-07-05T03:08:00+08:00 - Active steering POST fast-accept fix committed and deploy requested

- Production/source-thread readback after `58999808` was positive for the CPU
  seed-cycle path:
  - 14 Home AI large-thread compact samples across the old delayed-seed window
    all returned `projection-v4-partial` / `projection-partial-hit`;
  - no `deferred-initial-turns-list`, no foreground `thread/read`, no
    foreground `turns-list`;
  - production cache metadata still had raw `partial=false`, `dynamic=true`,
    but with cursor/omitted markers; deployed classification read it as
    partial at lookup time;
  - cooldown `ps` sample showed listener, mux, and app-server CPU near `0%`.
- Remaining POST evidence before the next source fix:
  - isolated existing-thread active follow-up POST returned HTTP `200`, no
    error, active steer response shape;
  - route stats for `POST /api/threads/:threadId/messages` showed count `2`,
    slow `0`, max route `378ms`, avg `365ms`;
  - root cause for this residual was the default active steering fast-accept
    wait of `350ms`.
- Source fix committed:
  - `92e106a92b6618a47344cb117fb85f99bd6fa94d`
    `fix: shorten active steering submit wait`;
  - `DEFAULT_ACTIVE_TURN_STEER_FAST_ACCEPT_MS` changed from `350` to `120`;
  - existing background queued steering path is retained.
- Validation passed locally:
  - `node --check server-routes/thread-message-route-service.js`;
  - `node --check test/thread-message-secret-ref-route.test.js`;
  - `node --test test/thread-detail-active-read-policy-service.test.js
    test/thread-detail-projection-result-service.test.js
    test/thread-detail-projection-service.test.js
    test/thread-detail-read-orchestration-service.test.js
    test/thread-detail-turns-list-read-coalescer-service.test.js
    test/thread-detail-runtime-service.test.js
    test/thread-message-secret-ref-route.test.js
    test/new-thread-route.test.js` -> 146/146;
  - `npm run --silent check` -> pass;
  - `git diff --check -- ':!.agent-context'` -> pass.
- Deployment request sent:
  - target: `Codex Mobile Deploy Lane`
    (`019f16e6-9131-79e2-9b6b-ad41f7e65d92`);
  - task card: `ttc_f9769e4717a81ae54d`;
  - source ref: `92e106a92b6618a47344cb117fb85f99bd6fa94d`;
  - requested readback must verify large-thread seed-cycle remains closed and
    active-turn existing-thread POST route no longer waits about 350ms before
    queued return.
- Completion state:
  - source-side POST wait fix is committed and deploy requested;
  - wait for production readback before marking the CPU/POST latency goal
    complete.
- Residual risk after this local fix until deploy readback:
  - if production state is already warm, deploy lane may not naturally prove a
    cold `deferred-initial-turns-list` sample without mutating the real Home AI
    thread;
  - POST send latency remains a separate foreground path; prior deployed
    fixes made ordinary synthetic existing-thread POST fast, but real active
    Home AI sends still need natural phase-timing evidence if users continue
    seeing multi-second sends.
- Privacy boundary respected: only bounded file names, statuses, test counts,
  static build ids, route names, timing-field names, short refs, task-card id,
  and target ids were recorded; no raw secrets, access keys, cookies, launch
  tokens, private thread bodies, task-card bodies, endpoint bodies, provider
  payloads, screenshots, DB rows, raw auth URLs, password paths, full prompts,
  rollout contents, or long logs were exposed.

## 2026-07-05T01:48:03+08:00 - POST preflight and deferred seed follow-up deployed request sent

- Deploy lane returned `0348b97f53e0`
  `fix: defer cold detail projection seed` as `partially_completed`:
  - production deploy succeeded and artifact/readback were healthy;
  - Home AI large-thread foreground GET became fast, with cold recent samples
    returning `deferred-initial-turns-list` in about tens to hundreds of ms and
    no foreground `turns-list` or full `thread/read`;
  - residual: background deferred seed stayed `already-pending` and did not
    warm to `projection-v4-partial` within bounded readback.
- Additional source fixes committed:
  - `ceb6c308` `fix: bound active turn preflight on submit`:
    active-turn message submit now bounds stale-active preflight, logs
    `active-turn-stale-preflight-queued`, and proceeds to the existing
    `turn/steer` fast-accept path instead of letting `thread/turns/list`
    preflight block the HTTP POST;
  - `3b46182b` `fix: release stalled deferred detail seeds`:
    deferred `turns-list-initial` seed now has a bounded local timeout that
    releases `deferredInitialTurnsListSeeds`, and the turns-list coalescer
    evicts stale in-flight reads instead of joining a stuck promise forever.
- Validation passed locally:
  - `node --check server-routes/thread-message-route-service.js &&
    node --test test/thread-message-secret-ref-route.test.js` -> 11/11;
  - `node --test test/new-thread-route.test.js` -> 28/28;
  - `node --check services/thread-detail/thread-detail-read-orchestration-service.js &&
    node --check services/thread-detail/thread-detail-turns-list-read-coalescer-service.js &&
    node --check services/thread-detail/thread-detail-runtime-service.js` -> pass;
  - `node --test test/thread-detail-read-orchestration-service.test.js
    test/thread-detail-turns-list-read-coalescer-service.test.js
    test/thread-detail-runtime-service.test.js` -> 51/51;
  - `node --test test/thread-message-secret-ref-route.test.js
    test/new-thread-route.test.js` -> 39/39;
  - `npm run --silent check` -> pass;
  - `git diff --check -- ':!.agent-context'` -> pass.
- Deployment request sent:
  - target: `Codex Mobile Deploy Lane`
    (`019f16e6-9131-79e2-9b6b-ad41f7e65d92`);
  - task card: `ttc_7f0139e182a8012ce1`;
  - structured fields: `cardKind=plugin_deployment`,
    `pluginId=codex-mobile-web`;
  - source ref: `3b46182b8f36d3122f816aa52797b8069e588295`;
  - requested readback: central private macOS deploy only, status/artifact
    readback, SHA parity for changed POST/detail/coalescer files, focused
    production tests, bounded Home AI large-thread GET samples, and isolated
    synthetic POST route stats without injecting messages into the real Home AI
    thread.
- Current source worktree state after commit: only `.agent-context/HANDOFF.md`
  remained modified locally.
- Privacy boundary respected: only bounded refs, task-card id, target id, test
  counts, route names, timing-field names, and status summaries were recorded;
  no raw secrets, access keys, cookies, launch tokens, private thread bodies,
  task-card bodies, endpoint bodies, provider payloads, screenshots, DB rows,
  raw auth URLs, password paths, full prompts, rollout contents, or long logs
  were exposed.

## 2026-07-05T03:09:36+08:00 - Large-thread GET seed-cycle and existing-thread POST latency fixes deployed

- Root-cause closure for the Home AI large-thread entry regression:
  - deployed `82552f38dec903fbb4458775acd008b9ad282e4c`
    `fix: reuse summary-stale partial detail windows`;
  - production route now accepts summary-stale partial recent-window projections
    for non-active summaries instead of re-entering `deferred-initial-turns-list`
    / `result-missing`;
  - deploy-lane return card `ttc_34b4c2dbc045a942ee` reported status
    `completed`, deploy `ok=true`, focused production tests `137/137`;
  - Home AI large-thread readback for
    `019eed86-2002-7cc2-b0b7-937eb5355f36?budget=compact` showed
    `deferred-initial-turns-list` `0/14`, mode `projection-v4-partial`,
    decision `projection-stale-partial-hit`, foreground `threadReadMs=0`,
    `turnsListInitialMs=0`, and `turnsListBeforeFullMs=0`, with server totals
    about `40-102ms`.
- Root-cause closure for existing-thread `POST /api/threads/:threadId/messages`
  waiting on local notification/projection work:
  - deployed `08d3e48949bb0e4093d04752ae6416f2e7858878`
    `fix: queue local turn-start notification on submit`;
  - deploy-lane return card `ttc_5ba542eac70eb6af7a` reported status
    `completed`, deploy `ok=true`, focused production tests `167/167`;
  - remaining evidence showed the background notification could still run in
    the same microtask turn before response flush.
- Response-first follow-up for existing-thread POST:
  - deployed `6a0b68034bc74a9afa442d256a68d5f4251e9eb0`
    `fix: defer submit notification work past response`;
  - deploy-lane return card `ttc_e30af10c1fab76da6c` reported status
    `completed`, deploy `ok=true`, focused production tests `168/168`;
  - production existing-thread synthetic follow-up route stats after deploy:
    `POST /api/threads/:threadId/messages` count `2`, slow count `0`,
    max `32ms`, average `22ms`, last `32ms`;
  - the same return reported Home AI large-thread spot check:
    `deferred-initial-turns-list` `0/8`, mode `projection-v4-partial`,
    decision `projection-stale-partial-hit`, foreground `threadReadMs=0`,
    `turnsListInitialMs=0`, `turnsListBeforeFullMs=0`, server totals about
    `41-54ms`.
- Local source validation for the final POST response-first patch passed:
  - `node --test test/thread-message-secret-ref-route.test.js` -> 14/14;
  - `node --test test/thread-message-secret-ref-route.test.js
    test/new-thread-route.test.js test/thread-task-card-route.test.js
    test/thread-detail-projection-result-service.test.js
    test/thread-detail-runtime-service.test.js
    test/thread-detail-read-orchestration-service.test.js
    test/thread-detail-projection-service.test.js` -> 168/168;
  - `npm run --silent check` -> pass;
  - `git diff --check -- ':!.agent-context'` -> pass.
- Current residuals:
  - `new-message` creation can still take seconds and is a separate route from
    existing-thread `POST /api/threads/:threadId/messages`;
  - listener RSS/heap can rise after large-thread projection activity until V8
    GC, but the repeated foreground seed/read loop and existing-thread POST
    notification wait are closed by production route evidence.
- Current source worktree state after commits: only `.agent-context/HANDOFF.md`
  remained modified locally.
- Privacy boundary respected: only bounded refs, task-card ids, target ids, test
  counts, route names, status summaries, and aggregate timings were recorded;
  no raw secrets, access keys, cookies, launch tokens, private thread bodies,
  task-card bodies, endpoint bodies, provider payloads, screenshots, DB rows,
  raw auth URLs, password paths, full prompts, rollout contents, raw cache JSON,
  raw message text, command output bodies, or long logs were exposed.

## 2026-07-05T04:33:41+08:00 - Runtime pressure attribution repair deployed and audit return ready

- Accepted Home AI Platform Audit task card `ttc_71c502eacddfcf1cf4`
  for Codex Mobile runtime pressure.
- Read-only before/current investigation:
  - Home AI collector originally attributed degraded
    `system_resource_health` to `codex_mobile_runtime_pressure`, with CPU,
    memory, swap, disk, and Home AI launchd service health otherwise ok.
  - Current runtime showed selected mux/app-server plus many Codex Mobile MCP
    children, not general host pressure.
  - Codex Mobile process-pressure probe was using the default mux endpoint
    instead of the production launchd-selected mux endpoint, so the selected
    mux/app-server tree could be reported as `stale-*`.
- Source fix committed:
  - `4cd6dddb560a527d2303d97f2a1975a98306de39`
    `fix: classify active mux runtime pressure`;
  - `runtime-process-pressure-service` now reads selected mux endpoint from
    explicit process-pressure config, launchd service environment, then normal
    env fallback;
  - returned pressure summary bounds launchd metadata and does not expose the
    endpoint path;
  - moderate active app-server RSS and long-lived Codex Mobile MCP child
    accumulation are visible as H3 issues.
- Source validation passed:
  - `node --test test/runtime-process-pressure-service.test.js` -> 5/5;
  - `node --test test/runtime-process-pressure-service.test.js
    test/runtime-self-check-loop.test.js test/core-api-route-service.test.js`
    -> 28/28;
  - `npm run --silent check` -> pass;
  - `git diff --check -- ':!.agent-context'` -> pass.
- Deployment:
  - deploy card `ttc_f5d5bf4b6712640efc` sent to Codex Mobile Deploy Lane;
  - return card `ttc_c3b4df2a3fa013b784` reported `completed`;
  - deployed ref `4cd6dddb560a527d2303d97f2a1975a98306de39`, deploy
    `ok=true`, focused production tests `28/28`, and SHA parity for the changed
    service/test files matched;
  - deploy restart recycled listener only and preserved selected mux/app-server
    state.
- Production readback after deploy:
  - Codex Mobile process-pressure classified `activeAppServerMuxCount=1`,
    `staleAppServerMuxCount=0`, `activeCodexAppServerCount=1`,
    `staleCodexAppServerCount=0`;
  - app-server children remained elevated but observable: Codex Mobile MCP
    children about `36-37`, node-repl children about `36-37`, child RSS around
    `2.3GB`;
  - current Codex Mobile process-pressure issues were H3 only:
    `production_listener_rss_elevated`,
    `active_codex_app_server_rss_elevated`, and
    `codex_mobile_mcp_child_accumulation_elevated`.
- Home AI system-resource closure probe:
  - final probe returned `overallStatus=warning`, not degraded;
  - CPU status `ok`, memory status `ok`, memory pressure free about `94%`,
    swap `0%`;
  - `codex_mobile_runtime_pressure=warning`, process count about `40`, total
    Codex Mobile RSS about `9.1GB`, max process CPU about `55%`, max process
    RSS about `4.3GB`.
- Residual risk:
  - short-window probes during deploy/test cooldown showed intermittent
    one-sample CPU spikes that could briefly make Home AI collector report
    degraded; the final closure probe returned warning;
  - RSS remains high but host memory/swap are healthy, so this is retained as
    warning evidence by the Home AI contract;
  - next root-cause work, if needed, should target Codex app-server/MCP child
    lifecycle and listener heap retention, not broad restarts or Home AI
    threshold suppression.
- Current source worktree after commit: only `.agent-context/HANDOFF.md`
  remained modified locally.
- Privacy boundary respected: only bounded refs, task-card ids, role names,
  issue codes, counts, RSS/CPU fields, and status summaries were recorded; no
  raw secrets, access keys, cookies, launch tokens, private task/thread bodies,
  endpoint file paths, command lines with sensitive args, provider payloads,
  DB rows, screenshots, raw auth URLs, password paths, full prompts, rollout
  contents, raw cache JSON, raw message text, or long logs were exposed.

## 2026-07-05T02:42:00+08:00 - Stale partial resting-summary CPU fix committed and deploy requested

- Residual issue after `7df06321` delayed deferred seeds:
  - foreground Home AI large-thread detail reads were fast, but delayed
    background `turns-list-initial` seed still ran after about 3s;
  - observed production bounded evidence showed the deferred seed took about
    2.9s and was followed by listener heap/RSS growth and later CPU/GC spikes;
  - this could still indirectly delay existing-thread POST messages by blocking
    the listener event loop even though POST route internals were fast.
- Root-cause hypothesis tightened:
  - a usable persisted stale partial window existed for the Home AI large
    thread;
  - the thread summary top-level status was terminal/resting, but residual
    `activeTurnId` / `mobileLocalActiveStatus` markers caused active-read
    policy and projection-result checks to reject the stale partial before
    orchestration could downgrade stale active turns;
  - rejection produced `result-missing` / deferred seed behavior instead of
    `projection-stale-partial-hit`.
- Source fix committed:
  - `a4d3b536bb3a59b910dd32362ff27c6be59bd093`
    `fix: reuse stale partials for resting summaries`;
  - active-read policy, projection-result preparation, and read orchestration
    now treat primary terminal/resting summary status (`completed`, `failed`,
    `cancelled`, etc.) as authoritative over residual active markers;
  - `idle` is intentionally not treated as terminal/resting override, so
    `idle + activeTurnId` still follows the active-turn/full-read protection;
  - stale partial windows can be reused and their old active turns downgraded
    for terminal/resting summaries.
- Validation passed locally:
  - `node --check services/thread-detail/thread-detail-active-read-policy-service.js`;
  - `node --check adapters/thread-detail-projection-result-service.js`;
  - `node --check services/thread-detail/thread-detail-read-orchestration-service.js`;
  - `node --test test/thread-detail-active-read-policy-service.test.js
    test/thread-detail-projection-result-service.test.js
    test/thread-detail-read-orchestration-service.test.js
    test/thread-detail-projection-service.test.js
    test/thread-detail-turns-list-read-coalescer-service.test.js
    test/thread-detail-runtime-service.test.js
    test/thread-message-secret-ref-route.test.js
    test/new-thread-route.test.js` -> 144/144;
  - `npm run --silent check` -> pass;
  - `git diff --check -- ':!.agent-context'` -> pass.
- Deployment request sent:
  - target: `Codex Mobile Deploy Lane`
    (`019f16e6-9131-79e2-9b6b-ad41f7e65d92`);
  - task card: `ttc_3739fcd783aa5671e1`;
  - source ref: `a4d3b536bb3a59b910dd32362ff27c6be59bd093`;
  - requested bounded readback must verify that the Home AI large thread
    reuses stale partials instead of returning `deferred-initial-turns-list`
    and starting a new `deferred_turns_list_initial_seed_start`.
- Completion state:
  - source-side fix is committed and deploy requested;
  - do not mark the CPU/POST latency goal complete until deploy-lane production
    readback confirms no repeated deferred seed and no listener CPU/heap spike
    during bounded Home AI large-thread samples.
- Current source worktree state after commit: only `.agent-context/HANDOFF.md`
  remained modified locally.

## 2026-07-05T02:20:41+08:00 - Deferred detail seed delay committed and deploy requested

- Current residual after `985db7b4` production readback:
  - `GET /api/threads/:threadId` and synthetic existing-thread
    `POST /api/threads/:threadId/messages` route-handler stats were bounded
    in production;
  - Home AI large-thread foreground detail reads stayed fast, but logs still
    showed `deferred-initial-turns-list` scheduling an immediate background
    `turns-list-initial` seed after the foreground response;
  - one recent bounded log sample showed foreground detail returning in about
    `16ms`, then a background `turns-list-initial` seed taking about
    `1933ms`;
  - listener RSS/heap remained high and background seed work can overlap with
    user message submission, causing event-loop/CPU pressure outside the POST
    handler's internal route timing.
- Root-cause hypothesis refined:
  - the new cold-detail deferred seed path lived inside
    `thread-detail-read-orchestration-service` and used the local default
    `setTimeout(0)` scheduling path;
  - therefore it did not inherit the existing prewarm/runtime-job foreground
    preemption policy and could start immediately after a user opened a large
    thread, just before a message submit.
- Source fix committed:
  - `7df06321` `fix: delay deferred detail projection seeds`;
  - large-thread deferred initial turns-list seeds now default to a bounded
    `3000ms` delay, configurable with
    `CODEX_MOBILE_THREAD_DETAIL_DEFERRED_INITIAL_SEED_DELAY_MS`;
  - `mobileDeferredProjectionSeed` exposes `delayMs`, `retryAfterMs`, and an
    adjusted `refreshAfterMs` so readback can prove the seed is not the old
    immediate `900ms` refresh path;
  - bounded `deferred_turns_list_initial_seed_start` logging records
    `delayMs` and scheduled wait metadata without private content.
- Validation passed locally:
  - `node --check services/thread-detail/thread-detail-read-orchestration-service.js &&
    node --check services/thread-detail/thread-detail-runtime-service.js &&
    node --check services/runtime/server-runtime-config-service.js &&
    node --check server.js` -> pass;
  - `node --test test/thread-detail-read-orchestration-service.test.js
    test/thread-detail-turns-list-read-coalescer-service.test.js
    test/thread-detail-runtime-service.test.js
    test/runtime-job-scheduler-service.test.js` -> 62/62;
  - `node --test test/thread-message-secret-ref-route.test.js
    test/new-thread-route.test.js test/runtime-pressure-diagnostics-service.test.js
    test/core-api-route-service.test.js` -> 49/49;
  - `npm run --silent check` -> pass;
  - `git diff --check -- ':!.agent-context'` -> pass.
- Central deploy plan from Home AI app workspace returned `ok=true`:
  - target `plugin:codex-mobile-web`;
  - source ref `7df0632118f8`;
  - `deployDirtyFiles=[]`;
  - ignored dirty file `.agent-context/HANDOFF.md`;
  - planned restart label `com.hermesmobile.plugin.codex-mobile`;
  - planned backup
    `/Users/hermes-host/HermesMobile/backups/deploy/20260704T182001Z-plugin-codex-mobile-web-codex-mobile-deferred-seed-delay-7df06321`.
- Deployment request sent:
  - target: `Codex Mobile Deploy Lane`
    (`019f16e6-9131-79e2-9b6b-ad41f7e65d92`);
  - task card: `ttc_9b6d46b7acdae669b1`;
  - card kind `plugin_deployment`, `pluginId=codex-mobile-web`;
  - requested readback: central private macOS deploy only, status/artifact
    health, SHA parity for changed files, focused production tests, bounded
    Home AI large-thread GET samples proving delayed seed metadata, synthetic
    existing-thread POST stats without mutating the real Home AI thread, and
    runtime pressure/cooldown CPU.
- Current source worktree after commit: `.agent-context/HANDOFF.md` modified
  only.
- Privacy boundary respected: only bounded ids, refs, route/timing names,
  test counts, status summaries, aggregate timings, and paths were recorded;
  no raw secrets, access keys, cookies, launch tokens, private thread bodies,
  task-card bodies, endpoint bodies, provider payloads, screenshots, DB rows,
  raw auth URLs, password paths, full prompts, rollout contents, raw message
  text, or long logs were exposed.

## 2026-07-05T02:07:51+08:00 - Stale partial detail-window fix committed and deploy requested

- Production after `a11c8b6b` still showed residual detail/projection pressure:
  - existing-thread POST route stats stayed fast: `POST /api/threads/:threadId/messages`
    count `1`, slow `0`, max/avg/last about `16ms`;
  - Home AI large-thread compact GET could still hit
    `projection-active-overlay` with server total about `2914ms` while
    `threadReadMs=0`, `turnsListInitialMs=0`, and `prepareResponseMs` about
    `25ms`;
  - following reads repeatedly returned `projectionMissReason=result-missing`
    with `projectionSeedStatus=deferred/deferred-pending` as the about
    `601MB` rollout kept growing;
  - listener pressure rose to about RSS `2119MB`, heap used `1303MB`, and max
    event-loop lag about `2844ms`.
- Root-cause hypothesis refined:
  - partial/stale projection cache can be returned by the cache layer, but
    `prepareProjectedThreadReadResult` still rejected stale partial windows
    when summary `updatedAt` was newer;
  - this collapsed a usable stale-first-paint window into `result-missing`,
    causing repeated deferred background `thread/turns/list` seeds and large
    object allocation pressure;
  - background seed also passed raw turns-list data farther than necessary
    before window compaction.
- Source fix committed:
  - `985db7b4` `fix: reuse stale partial detail windows`;
  - stale partial windows now bypass only the summary freshness check, while
    still preserving the current-active-turn safety check;
  - window-only `thread/turns/list` results are compacted with the canonical
    `compactTurnsListResult` before building the detail thread/projection seed.
- Validation passed locally:
  - `node --check adapters/thread-detail-projection-result-service.js &&
    node --check services/thread-detail/thread-detail-response-preparation-service.js &&
    node --check services/thread-detail/thread-detail-runtime-service.js` -> pass;
  - `node --test test/thread-detail-projection-result-service.test.js
    test/thread-rollout-size-consistency.test.js
    test/thread-detail-read-orchestration-service.test.js` -> 61/61;
  - `node --test test/thread-runtime-settings-service.test.js
    test/thread-message-secret-ref-route.test.js test/new-thread-route.test.js`
    -> 43/43;
  - `node --test test/thread-detail-projection-service.test.js
    test/thread-detail-projection-v4-service.test.js
    test/thread-detail-active-overlay-integration.test.js
    test/thread-detail-response-budget-service.test.js` -> 108/108;
  - `npm run --silent check` -> pass;
  - `git diff --check -- ':!.agent-context'` -> pass.
- Deployment request sent:
  - target: `Codex Mobile Deploy Lane`
    (`019f16e6-9131-79e2-9b6b-ad41f7e65d92`);
  - task card: `ttc_6d344573cf195ba00e`;
  - source ref: `985db7b4`;
  - requested readback focuses on repeated Home AI large-thread compact GET
    stability, absence of repeated `result-missing -> deferred` cycles, POST
    route stats, and listener/app-server pressure.
- Current source worktree after commit: `.agent-context/HANDOFF.md` modified
  only.
- Privacy boundary respected: only bounded ids, refs, route/timing names,
  test counts, status summaries, and aggregate metrics were recorded; no raw
  secrets, cookies, launch tokens, private thread bodies, task-card bodies,
  endpoint bodies, provider payloads, screenshots, DB rows, raw auth URLs,
  password paths, full prompts, rollout contents, raw message text, or long
  logs were exposed.

## 2026-07-05T01:58:00+08:00 - 552dcf70 deployed; a11c8b6b still pending readback

- Deploy lane returned task card `ttc_dc5cd837e5974bed05` as `completed`:
  - deployed ref `552dcf706d0cfd9629d4df5088495e883c77766d`
    `fix: reuse runtime context during active writes`;
  - includes `3b46182b` and `ceb6c308`;
  - central deploy `ok=true`, startup/process-pressure gate `ok=true`,
    `deployPass=true`, blocking/execution-failure `0/0`;
  - `/api/public-config`, `/api/status?detail=1`, and
    `/api/vite-shell-artifact` all returned healthy bounded readback;
  - focused production tests passed `94/94`.
- Production GET readback for Home AI large thread:
  - initial recent compact read returned
    `mobileReadMode=deferred-initial-turns-list` in about `35ms` elapsed and
    server `totalMs=18`, with no foreground `turns-list` or full
    `thread/read`;
  - after waiting beyond the seed/coalescer window, reads warmed to
    `projection-v4-partial` / `projection-partial-hit`;
  - first warm partial sample had server `totalMs=1317` with
    `projectionMs=1238`, then subsequent samples were much faster:
    server `totalMs=27ms` and `25ms`.
- Production POST readback:
  - isolated synthetic existing-thread active follow-up returned HTTP `200`,
    elapsed about `304ms`, `steeringQueued=false`,
    `stalePreflightQueued=false`;
  - route stats: `POST /api/threads/:threadId/messages` count `1`, slow `0`,
    max/avg/last `15ms`.
- Runtime pressure after smokes:
  - listener pid `50072`, RSS about `1598MB`, heap used about `981MB`;
  - event-loop utilization about `0.217`, p95/p99 lag about `22.3/94.7ms`,
    max observed lag about `1480.6ms`;
  - GET route stats count `26`, slow `1`, max `1317ms`, avg `101ms`,
    last `25ms`.
- Current status:
  - `552dcf70` readback closes the prior `3b46182b` residual where deferred
    seed failed to warm to partial projection;
  - latest local ref `a11c8b6b274f73ef7f9f0bfd935b9744edf9a309`
    `fix: back off stalled deferred detail seeds` remains queued/pending via
    task card `ttc_5b5134d6f4e5ebb6bb`;
  - do not mark CPU/POST goal complete until `a11c8b6b` deploy readback or
    equivalent current production evidence proves no repeated background seed
    pressure and no slow POST route samples.
- Privacy boundary respected: only bounded refs, task-card ids, route names,
  test counts, timings, status summaries, and pressure metrics were recorded;
  no raw secrets, access keys, cookies, launch tokens, private thread bodies,
  task-card bodies, endpoint bodies, provider payloads, screenshots, DB rows,
  raw auth URLs, password paths, full prompts, rollout contents, or long logs
  were exposed.

## 2026-07-05T01:55:54+08:00 - Deferred seed backoff committed and superseding deploy requested

- After the `3b46182b` deploy readback, remaining detail-side pressure was
  narrowed to background deferred seed behavior:
  - foreground large-thread GET stayed fast;
  - local pending could release and reschedule once;
  - app-server/background `turns-list-initial` did not prove stable completion
    to warm `projection-v4-partial`;
  - repeated entries could therefore keep starting or joining stalled
    background seed RPCs.
- Additional source fix committed:
  - `a11c8b6b` `fix: back off stalled deferred detail seeds`;
  - deferred `turns-list-initial` seed now records a bounded failure backoff
    after timeout/error;
  - during backoff, foreground response stays fast and exposes
    `projectionSeedStatus=deferred-backoff`, `reason=seed-backoff`,
    `retryAfterMs`, and a longer `refreshAfterMs`;
  - this prevents immediate repeated background seed RPC attempts while
    app-server is failing to complete the seed.
- Validation passed locally:
  - `node --check services/thread-detail/thread-detail-read-orchestration-service.js &&
    node --test test/thread-detail-read-orchestration-service.test.js
    test/thread-detail-turns-list-read-coalescer-service.test.js
    test/thread-detail-runtime-service.test.js` -> 51/51;
  - `node --test test/thread-runtime-settings-service.test.js
    test/thread-message-secret-ref-route.test.js
    test/new-thread-route.test.js` -> 43/43;
  - `npm run --silent check` -> pass;
  - `git diff --check -- ':!.agent-context'` -> pass.
- Superseding deployment request sent:
  - target: `Codex Mobile Deploy Lane`
    (`019f16e6-9131-79e2-9b6b-ad41f7e65d92`);
  - task card: `ttc_5b5134d6f4e5ebb6bb`;
  - source ref: `a11c8b6b274f73ef7f9f0bfd935b9744edf9a309`;
  - card states it supersedes `ttc_dc5cd837e5974bed05` if that card had not
    started, or should deploy as a follow-up if `552dcf70` already landed.
- Current source worktree state after commit: only `.agent-context/HANDOFF.md`
  remained modified locally.
- Privacy boundary respected: only bounded refs, task-card id, target id, test
  counts, route names, timing-field names, and status summaries were recorded;
  no raw secrets, access keys, cookies, launch tokens, private thread bodies,
  task-card bodies, endpoint bodies, provider payloads, screenshots, DB rows,
  raw auth URLs, password paths, full prompts, rollout contents, or long logs
  were exposed.

## 2026-07-05T01:52:35+08:00 - Runtime context cache follow-up committed and superseding deploy requested

- Deploy lane returned prior task card `ttc_7f0139e182a8012ce1` as
  `partially_completed` after deploying `3b46182b`:
  - production deploy succeeded and focused tests passed;
  - included `ceb6c308` POST preflight fix;
  - POST synthetic isolated existing-thread route stats were fast:
    count `2`, slow `0`, max route stat `16ms`;
  - foreground GET stayed fast with no foreground `turns-list` or full
    `thread/read`;
  - residual: background deferred seed could release and reschedule once, but
    did not prove stable warm `projection-v4-partial`, and later returned to
    `already-pending`; one residual detail sample showed
    `projection-active-overlay` with server total about `2627ms`.
- Additional source fix committed:
  - `552dcf70` `fix: reuse runtime context during active writes`;
  - `thread-runtime-settings-service` now keeps exact stat cache behavior while
    also reusing a recent non-empty `turn_context` by normalized rollout path
    within the existing runtime context TTL when the rollout file grows during
    active writes;
  - purpose: avoid repeated synchronous 32MB rollout tail scans in
    `resolveThreadRuntimeSettings(threadId)` as active rollout mtime changes,
    reducing POST `runtimeSettingsMs` CPU/GC pressure.
- Validation passed locally:
  - `node --check services/runtime/thread-runtime-settings-service.js &&
    node --test test/thread-runtime-settings-service.test.js` -> 4/4;
  - `node --test test/thread-message-secret-ref-route.test.js
    test/new-thread-route.test.js` -> 39/39;
  - `node --test test/thread-detail-read-orchestration-service.test.js
    test/thread-detail-turns-list-read-coalescer-service.test.js
    test/thread-detail-runtime-service.test.js` -> 51/51;
  - `npm run --silent check` -> pass;
  - `git diff --check -- ':!.agent-context'` -> pass.
- Superseding deployment request sent:
  - target: `Codex Mobile Deploy Lane`
    (`019f16e6-9131-79e2-9b6b-ad41f7e65d92`);
  - task card: `ttc_dc5cd837e5974bed05`;
  - source ref: `552dcf706d0cfd9629d4df5088495e883c77766d`;
  - card states it supersedes prior `ttc_7f0139e182a8012ce1` if that card had
    not started, or should deploy as a follow-up if `3b46182b` already landed.
- Current source worktree state after commit: only `.agent-context/HANDOFF.md`
  remained modified locally.
- Privacy boundary respected: only bounded refs, task-card id, target id, test
  counts, route names, timing-field names, and status summaries were recorded;
  no raw secrets, access keys, cookies, launch tokens, private thread bodies,
  task-card bodies, endpoint bodies, provider payloads, screenshots, DB rows,
  raw auth URLs, password paths, full prompts, rollout contents, or long logs
  were exposed.

## 2026-07-05T08:48:52+08:00 - Message-submit thread-not-found recovery committed; deploy pending

- User reported Home AI main and worker sends failing with a thread-does-not-exist
  style message.
- Bounded production/source investigation:
  - 8787 LAN bind was already active (`*:8787`) after the prior deploy card;
  - `/api/status?detail=1` was HTTP `200`, `ready=true`, active profile
    `previous`, endpoint kind `profile-mux-file`;
  - Home AI main and worker thread ids were still present in local state DB, so
    the user-facing error was not caused by deleted thread rows;
  - safe content-free GET probes for Home AI main and worker returned HTTP
    `200`;
  - safe `/api/threads/:threadId/resume` probes returned HTTP `200` for both
    targets; Home AI main resume was slow at about `10.3s`, worker resume about
    `294ms`;
  - bounded listener log sample showed an active-turn path can surface
    `thread not found` for an existing thread after mux/app-server runtime
    state changes, then recover through replacement turn.
- Root-cause fix committed:
  - `59b656c3` `fix: recover message submit after mux thread misses`;
  - `server-routes/thread-message-route-service.js` now treats container-level
    `thread not found` / `thread_not_found` and conversation/session not-found
    errors from optimistic existing-thread `turn/start` as resume-required,
    then retries once after `thread/resume`;
  - truly missing threads still fail through the `thread/resume` path, so this
    is not a silent success fallback;
  - `services/runtime/runtime-process-pressure-service.js` now classifies
    listener sockets by port and accepts LAN/wildcard binds such as `*:8787`,
    preventing the false `production_listener_missing` signal after opening the
    LAN listener.
- Validation passed locally:
  - `node --test test/thread-message-secret-ref-route.test.js
    test/runtime-process-pressure-service.test.js` -> 21/21;
  - `node --check server-routes/thread-message-route-service.js &&
    node --check services/runtime/runtime-process-pressure-service.js` -> pass;
  - `npm run --silent check` -> pass;
  - `git diff --check -- ':!.agent-context'` -> pass.
- Deployment request sent to Codex Mobile Deploy Lane:
  - task card `ttc_2f9f818c08af2bd9d8`;
  - target thread `019f16e6-9131-79e2-9b6b-ad41f7e65d92`;
  - requested central macOS plugin deploy/readback for `59b656c3`;
  - current source-side readback: card `approved`, execution lease `active`,
    no completion/blocked return yet.
- Separate LAN-listener return card received:
  - `ttc_f9b2f4480a6105c067` marked completed;
  - launchd env `CODEX_MOBILE_HOST=0.0.0.0`, `CODEX_MOBILE_PORT=8787`;
  - socket `*:8787`; local and LAN `/api/public-config` HTTP `200`.
- Current source worktree after commit: `.agent-context/HANDOFF.md` modified
  only.
- Privacy boundary respected: only bounded ids, refs, status/timing summaries,
  route names, and aggregate diagnostics were recorded; no raw secrets, access
  keys, cookies, launch tokens, endpoint file contents, private thread bodies,
  task-card private bodies, provider payloads, DB rows, screenshots, raw auth
  URLs, password paths, full prompts, rollout contents, raw message text, or
  long logs were exposed.

## 2026-07-05T09:05:23+08:00 - Preserve live profile mux across listener deploy restarts

- User reported a regression: deploying/restarting only the Codex Mobile
  listener used to be effectively invisible when app-server stayed alive, but
  recent deploys caused Codex Mobile/thread reads/sends to time out or remain
  unreachable for a noticeable window.
- Bounded production readback:
  - listener/API were up on `*:8787`; `/api/status?detail=1` was HTTP `200`
    with active profile `previous`, endpoint kind `profile-mux-file`, and no
    top-level issue codes;
  - process snapshot showed two mux/app-server groups at once: an older
    long-lived group and a newer listener-started group;
  - current selected profile endpoint pointed at the newer group, which means
    the latest listener path had replaced the warm profile mux/app-server
    instead of preserving it;
  - route stats after the replacement showed the user-visible symptom:
    `GET /api/threads/:threadId` max about `17s`, `POST
    /api/threads/:threadId/messages` max about `9.6s`, and `/resume` about
    `7.9s`.
- Root-cause hypothesis confirmed in source:
  - `services/runtime/codex-app-server-client-service.js` treated any profile
    mux connect/initialize failure as permission to start a Mobile-owned mux;
  - that branch also launched the replacement mux with unconditional endpoint
    publishing, so a slow-but-live selected profile mux could be overwritten by
    a cold app-server during a deploy/readback window.
- Source fix implemented:
  - endpoint resolver now preserves bounded mux metadata (`pid`, `childPid`,
    `startedAt`) from the selected profile endpoint;
  - app-server client now checks whether the selected profile mux process is
    alive before replacing it;
  - if the mux process is alive, connect/initialize failure preserves the
    endpoint and returns an observable shared-endpoint error for retry instead
    of replacing the warm app-server;
  - if the endpoint is missing or the mux process is dead, recovery still starts
    a Mobile-owned mux;
  - replacement mux publishing now uses guarded `auto` mode so it does not
    unconditionally overwrite a live endpoint.
- Validation passed locally:
  - `node --test test/codex-app-server-client-service.test.js
    test/new-thread-route.test.js test/thread-message-secret-ref-route.test.js
    test/runtime-process-pressure-service.test.js` -> 58/58;
  - `node --check services/runtime/codex-app-server-client-service.js` -> pass;
  - `npm run --silent check` -> pass;
  - `git diff --check -- ':!.agent-context'` -> pass.
- Commit/deploy status:
  - committed as `56d300e8` `fix: preserve live profile mux on listener restart`;
  - deployment request sent to Codex Mobile Deploy Lane
    (`019f16e6-9131-79e2-9b6b-ad41f7e65d92`) as task card
    `ttc_ed514f94618203534b`;
  - requested readback must prove central deploy health, SHA parity, focused
    production tests, and that listener deploy/readback does not create an
    additional mux/app-server group when the selected profile endpoint process
    is alive.
- Privacy boundary respected: only bounded ids, roles, route names, timings,
  process-group counts, and status summaries were recorded; no raw endpoint
  contents, secrets, access keys, cookies, launch tokens, private thread bodies,
  task-card private bodies, provider payloads, DB rows, screenshots, raw auth
  URLs, password paths, full prompts, rollout contents, raw message text, or
  long logs were exposed.

## 2026-07-05T09:28:29+08:00 - Fix visible item ordering and text-only user bubbles

- User reported severe display regressions after mux cleanup:
  - new user messages could be accepted instantly but not appear in the current
    Codex Mobile thread until later refresh;
  - older receipts could appear below newer user bubbles, for example a
    `09:18` Codex receipt below a newer `09:21` user message;
  - Home AI main still showed a completed status despite user expectation that
    it was active.
- Bounded production/source diagnostics:
  - stale mux/app-server group was cleaned first per user request; selected
    live mux/app-server remained intact;
  - current Codex thread detail returned `projection-active-overlay` with an
    active turn, but a `contextCompaction` item timestamped around `01:12Z`
    was ordered after newer `01:23Z` user messages;
  - detail self-check had already flagged `visible_item_timestamp_order_mismatch`;
  - focused Home AI detail probe showed text-only userMessage rows (`text`
    populated, `content` absent/empty), while the browser renderer only used
    `item.content`, explaining blank user bubbles after durable projection
    replaced the optimistic local echo.
- Source fix implemented:
  - `itemDisplayTimestampMs` now lets `contextCompaction` use its own timestamp
    in `orderItemsByDisplayTimestamp`; only `turnUsageSummary` keeps the
    tail-summary no-timestamp behavior;
  - `renderUserMessageBody` now derives renderable text content from
    `item.content`, string `item.content`, `item.text`, or `item.message`, so
    text-only durable userMessage rows no longer render as blank bubbles;
  - regenerated frontend shell manifest and Vite preview artifact with matching
    cache id `codex-mobile-shell-v625-53ebcbc5b25c`.
- Validation passed locally:
  - `node --test test/thread-detail-active-window-overlay-policy-service.test.js
    test/thread-detail-response-budget-service.test.js
    test/thread-detail-self-check-service.test.js test/conversation-render.test.js`
    -> 265/265;
  - `npm run --silent build:frontend` -> pass;
  - `npm run --silent check` -> pass;
  - `git diff --check -- ':!.agent-context'` -> pass;
  - `node --test test/vite-shell-artifact-service.test.js
    test/vite-shell-asset-graph.test.js
    test/browser-runtime-self-check-service.test.js` -> 114/114.
- Deployment pending:
  - source changes need commit and Codex Mobile Deploy Lane central macOS plugin
    deploy/readback;
  - post-deploy readback should verify `/api/vite-shell-artifact ok=true`,
    current-thread detail no longer reports `visible_item_timestamp_order_mismatch`,
    and text-only userMessage rows render nonblank in browser behavior harness.
- Privacy boundary respected: only bounded ids, roles, route names, timings,
  process-group counts, hashes, and status summaries were recorded; no raw
  secrets, access keys, cookies, launch tokens, private thread/task-card bodies,
  provider payloads, DB rows, screenshots, raw auth URLs, password paths, full
  prompts, rollout contents, raw message text, raw cache JSON, or long logs were
  exposed.
