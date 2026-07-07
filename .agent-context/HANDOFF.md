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

## Current Addendum - 2026-07-07 Empty visible detail task-card-only diagnostic repair

- Active Home AI diagnostic card `ttc_3ee119effd61a5ae27` was routed through
  plugin Worker card `ttc_d00d4bf6aea26e2a7f` for
  `diagcase_3fbdb02cf11e1d123f64` (`conversation_projection_mismatch` /
  `empty_visible_detail_mismatch`, error
  `empty_render_with_history_evidence`).
- Bounded log/event lookup found no raw matching record in this plugin
  workspace, Home AI diagnostics metadata workspace, or readable production
  plugin path; direct broad host-root log access was denied. Diagnosis used
  the task-card digest plus local bounded reproduction.
- Root cause: `thread-detail-state` treated task-card metadata
  (`threadTaskCards` / `pendingTaskCardCount`) as sufficient history evidence
  for `planEmptyDetailHistoryRecovery()`. On embedded/plugin surfaces, a
  no-turn detail with only task-card side metadata could report an H2 empty
  visible detail projection mismatch even when no conversation projection
  content was proven missing.
- Source fix: `emptyDetailHistoryEvidenceForThread()` now separates
  conversation projection evidence from task-card-only metadata. Recovery and
  H2 `empty_visible_detail_mismatch` reporting require conversation evidence
  (`rolloutSizeBytes`, omitted turns, visible item keys, or active-turn
  evidence). Task-card-only evidence remains bounded in the evidence object but
  fails closed with reason `task-card-only-evidence`.
- Files changed: `frontend/native/thread-detail-state.mjs`,
  `public/thread-detail-state.js`, generated frontend shell/Vite artifacts,
  and `test/thread-detail-state.test.js`.
- Validation passed:
  - bounded reproduction before fix: `pendingTaskCardCount=1` planned recovery;
    after fix it returns `shouldRecover=false`, reason
    `task-card-only-evidence`;
  - `node --test test/thread-detail-state.test.js` (`24/24`);
  - focused diagnostic/runtime slice:
    `node --test test/thread-detail-state.test.js test/conversation-render.test.js
    test/thread-diagnostic-events.test.js test/home-ai-diagnostic-reporting.test.js`
    (`237/237`);
  - Vite/runtime artifact slice:
    `node --test test/vite-shell-artifact-service.test.js
    test/vite-shell-asset-graph.test.js test/browser-runtime-self-check-service.test.js
    test/runtime-self-check-loop.test.js` (`154/154`);
  - `npm run --silent build:frontend`;
  - `npm run --silent check:frontend-manifest`;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`;
  - fallback governance classification: closure, no new fallback; Home AI
    fallback-governance check `ok=true` and plugin changed-line scan
    `ok=true`.
- Runtime artifacts now read back cache/client build
  `0.1.11|codex-mobile-shell-v625-86de04383378`.
- Deployment/readback status is still pending at this handoff point and must be
  delegated through the central Codex Mobile deploy lane before reporting full
  production closure to Home AI.

## Current Addendum - 2026-07-07 Public release sync

- Current production/private source ref `1aa939ba` (`fix: suppress thread
  tile self-healing diagnostics`) was deployed successfully by the central
  Codex Mobile deploy lane and serves cache
  `0.1.11|codex-mobile-shell-v625-82df4674ce40`.
- Public repository `pentiumxp/codex-mobile-web-public` previously lagged at
  `c138d92a` / cache `0.1.11|codex-mobile-shell-v625-63d53108eec7`.
- Created public-clean sync commit `e97c0a08` (`chore: sync public release`)
  from `public/main`, applying the current private non-`.agent-context`
  publishable diff only. The large line count is generated Vite/ESM assets;
  `.agent-context` private handoff changes were intentionally excluded.
- Pushed `e97c0a08` to public `main`; GitHub Actions run `28855382981`
  completed with conclusion `success`.
- Merged public `main` back into private `main` with merge commit `15733b99`
  (`chore: absorb public release baseline`) so public history is now an
  ancestor of private history and future publishes should not keep equivalent
  public/private SHA divergence.

## Current Addendum - 2026-07-07 Active overlay diagnostic and public CI

- Active Home AI diagnostic card `ttc_5470d4a7c40dcc9f27`
  (`diagcase_5640b29d6b7827f84988`,
  `conversation_projection_mismatch` /
  `active-thread-window-downgrade`) was repaired in source.
- Root cause: frontend thread-performance diagnostic planning did not treat
  `projection-active-overlay` / `turns-list-active-overlay-window` as valid
  active progressive projection evidence, so embedded/proxy diagnostics could
  report a false active-window downgrade even when visible/budget evidence was
  present.
- Source fix commits:
  - `451621d6` (`fix: accept active overlay projection diagnostics`) updates
    `frontend/native/thread-performance-metrics.mjs`,
    `public/thread-performance-metrics.js`, generated Vite artifacts, and
    `test/thread-performance-metrics.test.js`.
  - `a8490d99` (`test: align public ci assertions`) updates public CI
    assertions for current source behavior.
  - `d6cae0ac` (`test: stabilize deferred seed timeout`) makes the deferred
    initial turns/list seed timeout test deterministic by injecting a test-only
    timeout scheduler while preserving production timeout defaults.
- Source validation passed after `d6cae0ac`:
  - `npm test` (`2337/2337`);
  - `npm run --silent check`;
  - `npm run --silent check:macos`;
  - `git diff --check -- ':!.agent-context'`;
  - focused diagnostic slice (`97/97`) for thread-performance metrics,
    diagnostic reporting, runtime gate, and Vite artifact/asset graph.
- Public repo repair:
  - Pushed public `main` fixes `788c33a0` and `c138d92a` to cover the two
    failing public commits.
  - GitHub Actions run `28837366858` on public `main` passed.
- Deployment status:
  - MCP-prefixed deployment card `ttc_590f606b0733b30f4e` was sent to Codex
    Mobile Deploy Lane for central deploy/readback of ref `d6cae0ac`.
  - Do not mark the diagnostic task fully completed until the deploy lane
    returns bounded production readback; source-side status is complete,
    production validation is delegated.

## Current Addendum - 2026-07-06T09:55Z Server-switchable frontend diagnostics

- Owner reproduced the submitted-user duplicate/disappearing-message issue, but
  production log inspection only showed Home AI `conversation_projection_mismatch`
  / `active-thread-window-downgrade` reports. No `frontend_diagnostic_log`
  submitted-echo lifecycle rows reached the server.
- Root cause for the diagnostic gap: the first diagnostic switch was
  URL/localStorage/console controlled, not server-controlled, and server
  `client-event` logging would also throttle same-named
  `frontend_diagnostic_log` rows inside the normal 30s event coalescing window.
- Committed source fix `6f0301a9` (`fix: make frontend diagnostics server
  switchable`):
  - persisted runtime setting `frontendDiagnosticLog`;
  - `/api/public-config` now exposes the setting;
  - authorized `/api/settings/frontend-diagnostic-log` can enable/disable it;
  - app shell applies the public config on startup;
  - `frontend_diagnostic_log` client events bypass same-event runtime log
    throttling while retaining bounded/sanitized metadata;
  - classic public runtime and native ESM/Vite artifacts were regenerated.
- Validation passed:
  - `node --test test/runtime-settings-service.test.js
    test/server-http-runtime-service.test.js test/core-api-route-service.test.js
    test/api-client-runtime-ui.test.js test/vite-shell-artifact-service.test.js
    test/vite-shell-asset-graph.test.js` (`59/59`);
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`;
  - central fallback governance check for changed source/test files
    returned `ok=true`.
- Deployment is delegated, not completed in this source thread:
  `ttc_622e1aef9a91b00f5a` to Codex Mobile Deploy Lane, requesting central
  deploy of `6f0301a9`, production enablement of submitted-echo diagnostics,
  `/api/public-config`/settings readback, Vite artifact readback, SHA parity,
  focused production tests, and a three-row `frontend_diagnostic_log` server log
  smoke proving no throttle collapse.
- Follow-up 2026-07-06: production readback served the new cache but
  `POST /api/settings/frontend-diagnostic-log` returned
  `frontend_diagnostic_log_settings_unavailable`. Root cause was a wiring miss
  in `server-routes/server-route-composition-service.js`: the composition layer
  did not forward the new frontend diagnostic settings dependencies into the
  core route service. Commit `9754fbab6258` (`fix: forward frontend diagnostic
  settings route deps`) fixes this and adds regression coverage in
  `test/api-route-boundary-service.test.js`.
- Follow-up deployment is delegated as `ttc_29be196cf4a35e7215`, requesting
  central deploy of `9754fbab6258`, settings POST/GET success, public-config
  readback with diagnostics enabled, Vite artifact readback, SHA parity,
  focused production tests, and three-row `frontend_diagnostic_log` log-channel
  smoke.
- Active Home AI diagnostic card `ttc_59016aa654d05b4990` remains open until
  the deploy/readback evidence returns; do not close it without bounded
  production evidence or an explicit partial/blocked reason.

## Current Addendum - 2026-07-06T07:36Z Frontend diagnostic log switch

- Owner asked to stop guessing the submitted-user duplicate/disappearance
  issue and add persistent client-side diagnostics that can be enabled during
  reproduction and disabled normally.
- Implemented default-off frontend diagnostics in
  `frontend/native/api-client-runtime.mjs` with localStorage-backed ring
  buffer, optional upload through existing client events, URL toggles, and
  `window.CodexFrontendLog`.
- Operator controls:
  - enable: `CodexFrontendLog.enable({ scopes: ["submitted_echo"], upload:
    true, maxEntries: 400 })` or URL `?codexFrontendLog=1`;
  - disable: `CodexFrontendLog.disable()` or URL `?codexFrontendLog=0`;
  - export local entries: `CodexFrontendLog.export()`;
  - clear entries: `CodexFrontendLog.clear()`.
- Logged submitted-message stages across composer/settings/pane refresh:
  `submit-start`, local insert/apply/render, POST response, reconcile,
  refresh merge, early shell render, full render, DOM probe, errors/finally.
  Entries include ids/hashes/counts/order/DOM tail positions only; raw message
  text, HTML, paths, tokens, cookies, and file names are hashed or omitted.
- Classic fallback files under `public/*.js` and native ESM/Vite artifacts were
  regenerated. New readback: `0.1.11|codex-mobile-shell-v625-75ff8c622f17`,
  `productionExecution=vite-app-preview-native-esm`, published files `24`.
- Validation passed:
  - `node --test test/api-client-runtime-ui.test.js
    test/conversation-render.test.js
    test/browser-runtime-self-check-service.test.js
    test/runtime-self-check-loop.test.js test/vite-shell-artifact-service.test.js
    test/vite-shell-asset-graph.test.js` (`331/331`);
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`.
- Next step: commit this diagnostic facility and deploy through the central
  Codex Mobile deploy lane so the Owner can reproduce in production and we can
  inspect bounded client-side logs instead of inferring from code.

## Current Addendum - 2026-07-05 Frontend native ESM migration pane-layout slice

- Objective remains active: finish the source-side native ESM migration in
  development and deploy only after Owner approval.
- Migrated `pane-layout-runtime` for Vite/app-preview by adding
  `frontend/native/pane-layout-runtime.mjs`, wiring its `nativeSource` in
  `scripts/frontend-shell-asset-graph.mjs`, and regenerating
  `public/vite-shell/*` artifacts.
- Classic fallback remains present at `public/pane-layout-runtime.js`.
- Readback after `npm run --silent build:frontend`:
  `nativeEsmModuleCount=41`, `classicGlobalCompatibilityModuleCount=8`.
  Remaining classic modules are `thread-list-runtime`, `composer-runtime`,
  `composer-bridge-runtime`, `api-client-runtime`, `thread-detail-runtime`,
  `task-card-runtime`, `conversation-render-runtime`, and
  `event-stream-runtime`.
- Validation passed:
  - `node --check frontend/native/pane-layout-runtime.mjs
    scripts/frontend-shell-asset-graph.mjs
    test/vite-shell-asset-graph.test.js`;
  - `node --test test/vite-shell-asset-graph.test.js
    test/browser-runtime-self-check-service.test.js
    test/runtime-self-check-loop.test.js test/conversation-render.test.js
    test/thread-detail-runtime-ui.test.js
    test/client-event-stall-self-check-service.test.js` (`316/316`);
  - `npm run --silent build:frontend`;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`;
  - local dev server on `127.0.0.1:8917` with
    `CODEX_MOBILE_DEFAULT_SHELL=vite-app-preview`: browser startup gate
    `ok=true`, app visible, runtime ready, blocking issue count `0`, browser
    exception count `0`. The dev server was stopped.
- Source-only status: no production deploy was run for this ESM slice.

## Current Addendum - 2026-07-05 Frontend native ESM migration thread-list slice

- Objective remains active: continue source-only native ESM migration with
  development validation; production deploy still requires Owner approval.
- Migrated `thread-list-runtime` by adding
  `frontend/native/thread-list-runtime.mjs`, wiring `nativeSource` in
  `scripts/frontend-shell-asset-graph.mjs`, and regenerating
  `public/vite-shell/*` artifacts.
- Classic fallback remains present at `public/thread-list-runtime.js`.
- Readback after `npm run --silent build:frontend`:
  `nativeEsmModuleCount=42`, `classicGlobalCompatibilityModuleCount=7`.
  Remaining classic modules are `composer-runtime`, `composer-bridge-runtime`,
  `api-client-runtime`, `thread-detail-runtime`, `task-card-runtime`,
  `conversation-render-runtime`, and `event-stream-runtime`.
- Validation passed:
  - `node --check frontend/native/thread-list-runtime.mjs
    scripts/frontend-shell-asset-graph.mjs
    test/vite-shell-asset-graph.test.js`;
  - `node --test test/vite-shell-asset-graph.test.js
    test/browser-runtime-self-check-service.test.js
    test/runtime-self-check-loop.test.js test/conversation-render.test.js
    test/thread-detail-runtime-ui.test.js
    test/client-event-stall-self-check-service.test.js` (`316/316`);
  - `npm run --silent build:frontend`;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`;
  - local dev server on `127.0.0.1:8918` with
    `CODEX_MOBILE_DEFAULT_SHELL=vite-app-preview`: browser startup gate
    `ok=true`, app visible, runtime ready, blocking issue count `0`, browser
    exception count `0`. The dev server was stopped.
- Source-only status: no production deploy was run for this ESM slice.

## Current Addendum - 2026-07-05 Frontend native ESM migration api-client-runtime slice

- Objective remains active: continue source-only native ESM migration with
  development validation; production deploy still requires Owner approval.
- Migrated `api-client-runtime` by adding
  `frontend/native/api-client-runtime.mjs`, wiring `nativeSource` in
  `scripts/frontend-shell-asset-graph.mjs`, and regenerating
  `public/vite-shell/*` artifacts.
- Classic fallback remains present at `public/api-client-runtime.js`.
- Readback after `npm run --silent build:frontend`:
  `nativeEsmModuleCount=43`, `classicGlobalCompatibilityModuleCount=6`.
  Remaining classic modules are `composer-runtime`, `composer-bridge-runtime`,
  `thread-detail-runtime`, `task-card-runtime`,
  `conversation-render-runtime`, and `event-stream-runtime`.
- Validation passed:
  - `node --check frontend/native/api-client-runtime.mjs
    scripts/frontend-shell-asset-graph.mjs
    test/vite-shell-asset-graph.test.js`;
  - `node --test test/vite-shell-asset-graph.test.js
    test/browser-runtime-self-check-service.test.js
    test/runtime-self-check-loop.test.js test/conversation-render.test.js
    test/thread-detail-runtime-ui.test.js
    test/client-event-stall-self-check-service.test.js` (`316/316`);
  - `npm run --silent build:frontend`;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`;
  - local dev server on `127.0.0.1:8919` with
    `CODEX_MOBILE_DEFAULT_SHELL=vite-app-preview`: browser startup gate
    `ok=true`, app visible, runtime ready, blocking issue count `0`, browser
    exception count `0`. The dev server was stopped.
- Source-only status: no production deploy was run for this ESM slice.

## Current Addendum - 2026-07-05 Frontend native ESM migration composer-bridge slice

- Objective remains active: continue source-only native ESM migration with
  development validation; production deploy still requires Owner approval.
- Migrated `composer-bridge-runtime` by adding
  `frontend/native/composer-bridge-runtime.mjs`, wiring `nativeSource` in
  `scripts/frontend-shell-asset-graph.mjs`, and regenerating
  `public/vite-shell/*` artifacts.
- Classic fallback remains present at `public/composer-bridge-runtime.js`.
- Readback after `npm run --silent build:frontend`:
  `nativeEsmModuleCount=44`, `classicGlobalCompatibilityModuleCount=5`.
  Remaining classic modules are `composer-runtime`, `thread-detail-runtime`,
  `task-card-runtime`, `conversation-render-runtime`, and
  `event-stream-runtime`.
- Validation passed:
  - `node --check frontend/native/composer-bridge-runtime.mjs
    scripts/frontend-shell-asset-graph.mjs
    test/vite-shell-asset-graph.test.js`;
  - `node --test test/vite-shell-asset-graph.test.js
    test/browser-runtime-self-check-service.test.js
    test/runtime-self-check-loop.test.js test/conversation-render.test.js
    test/thread-detail-runtime-ui.test.js
    test/client-event-stall-self-check-service.test.js` (`316/316`);
  - `npm run --silent build:frontend`;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`;
  - local dev server on `127.0.0.1:8920` with
    `CODEX_MOBILE_DEFAULT_SHELL=vite-app-preview`: browser startup gate
    `ok=true`, app visible, runtime ready, blocking issue count `0`, browser
    exception count `0`. The dev server was stopped.
- Source-only status: no production deploy was run for this ESM slice.

## Current Addendum - 2026-07-05 Frontend native ESM migration task-card slice

- Objective remains active: continue source-only native ESM migration with
  development validation; production deploy still requires Owner approval.
- Migrated `task-card-runtime` by adding
  `frontend/native/task-card-runtime.mjs`, wiring `nativeSource` in
  `scripts/frontend-shell-asset-graph.mjs`, and regenerating
  `public/vite-shell/*` artifacts.
- Classic fallback remains present at `public/task-card-runtime.js`.
- Readback after `npm run --silent build:frontend`:
  `nativeEsmModuleCount=45`, `classicGlobalCompatibilityModuleCount=4`.
  Remaining classic modules are `composer-runtime`, `thread-detail-runtime`,
  `conversation-render-runtime`, and `event-stream-runtime`.
- Validation passed:
  - `node --check frontend/native/task-card-runtime.mjs
    scripts/frontend-shell-asset-graph.mjs
    test/vite-shell-asset-graph.test.js`;
  - `node --test test/vite-shell-asset-graph.test.js
    test/browser-runtime-self-check-service.test.js
    test/runtime-self-check-loop.test.js test/conversation-render.test.js
    test/thread-detail-runtime-ui.test.js
    test/client-event-stall-self-check-service.test.js` (`316/316`);
  - `npm run --silent build:frontend`;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`;
  - local dev server on `127.0.0.1:8921` with
    `CODEX_MOBILE_DEFAULT_SHELL=vite-app-preview`: browser startup gate
    `ok=true`, app visible, runtime ready, blocking issue count `0`, browser
    exception count `0`. The dev server was stopped.
- Source-only status: no production deploy was run for this ESM slice.

## Current Addendum - 2026-07-05 Frontend native ESM migration composer-runtime slice

- Objective remains active: continue source-only native ESM migration with
  development validation; production deploy still requires Owner approval.
- Migrated `composer-runtime` by adding
  `frontend/native/composer-runtime.mjs`, wiring `nativeSource` in
  `scripts/frontend-shell-asset-graph.mjs`, and regenerating
  `public/vite-shell/*` artifacts.
- Classic fallback remains present at `public/composer-runtime.js`.
- Readback after `npm run --silent build:frontend`:
  `nativeEsmModuleCount=46`, `classicGlobalCompatibilityModuleCount=3`.
  Remaining classic modules are `thread-detail-runtime`,
  `conversation-render-runtime`, and `event-stream-runtime`.
- Validation passed:
  - `node --check frontend/native/composer-runtime.mjs
    scripts/frontend-shell-asset-graph.mjs
    test/vite-shell-asset-graph.test.js`;
  - `node --test test/vite-shell-asset-graph.test.js
    test/browser-runtime-self-check-service.test.js
    test/runtime-self-check-loop.test.js test/conversation-render.test.js
    test/thread-detail-runtime-ui.test.js
    test/client-event-stall-self-check-service.test.js` (`316/316`);
  - `npm run --silent build:frontend`;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`;
  - local dev server on `127.0.0.1:8922` with
    `CODEX_MOBILE_DEFAULT_SHELL=vite-app-preview`: browser startup gate
    `ok=true`, app visible, runtime ready, blocking issue count `0`, browser
    exception count `0`. The dev server was stopped.
- Source-only status: no production deploy was run for this ESM slice.

## Current Addendum - 2026-07-05 Frontend native ESM migration conversation-render slice

- Objective remains active: continue source-only native ESM migration with
  development validation; production deploy still requires Owner approval.
- Migrated `conversation-render-runtime` by adding
  `frontend/native/conversation-render-runtime.mjs`, wiring `nativeSource` in
  `scripts/frontend-shell-asset-graph.mjs`, and regenerating
  `public/vite-shell/*` artifacts.
- Classic fallback remains present at `public/conversation-render-runtime.js`.
- Readback after `npm run --silent build:frontend`:
  `nativeEsmModuleCount=47`, `classicGlobalCompatibilityModuleCount=2`.
  Remaining classic modules are `thread-detail-runtime` and
  `event-stream-runtime`.
- Validation passed:
  - `node --check frontend/native/conversation-render-runtime.mjs
    scripts/frontend-shell-asset-graph.mjs
    test/vite-shell-asset-graph.test.js`;
  - `node --test test/vite-shell-asset-graph.test.js
    test/browser-runtime-self-check-service.test.js
    test/runtime-self-check-loop.test.js test/conversation-render.test.js
    test/thread-detail-runtime-ui.test.js
    test/client-event-stall-self-check-service.test.js` (`316/316`);
  - `npm run --silent build:frontend`;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`;
  - local dev server on `127.0.0.1:8923` with
    `CODEX_MOBILE_DEFAULT_SHELL=vite-app-preview`: browser startup gate
    `ok=true`, app visible, runtime ready, blocking issue count `0`, browser
    exception count `0`. The dev server was stopped.
- Source-only status: no production deploy was run for this ESM slice.

## Current Addendum - 2026-07-05 Independent submitted-message echo hotfix deploy request

- Owner asked to deploy the non-ESM duplicate/disappearing submitted-message
  fix independently because the issue was impacting usage.
- ESM migration work in the main worktree remains paused and uncommitted; do
  not mix those files into this hotfix deploy.
- Created isolated worktree
  `tmp/hotfix-submitted-echo-order` from non-ESM base `dcb2cb63`
  (`fix: retire submitted echoes by submission identity`) and applied the
  submitted-message stash patch only.
- Hotfix commit: `5d4515ab42e7` (`fix: drop stale same-submission user echoes`).
  Preservation branch: `hotfix/submitted-echo-order-5d4515ab`.
- Source behavior: `public/thread-detail-runtime.js` now treats shared
  `clientSubmissionId` as authoritative regardless of candidate direction, so
  durable/higher-authority same-submission user messages shadow stale later
  projection/optimistic echoes; equal authority keeps the earlier visible item.
- Regression added in `test/conversation-render.test.js` for a later
  same-submission projected user bubble below newer receipts.
- Regenerated frontend artifacts for client/cache
  `0.1.11|codex-mobile-shell-v625-14d250f3a235`.
- Validation in the isolated worktree passed:
  - `node --check public/thread-detail-runtime.js test/conversation-render.test.js`;
  - `node --test test/conversation-render.test.js
    test/thread-detail-v4-merge-state.test.js
    test/thread-user-message-echo-normalizer-service.test.js
    test/message-pending-echo-service.test.js` (`201/201`);
  - `npm run --silent build:frontend`;
  - `node --test test/vite-shell-asset-graph.test.js
    test/vite-shell-artifact-service.test.js
    test/browser-runtime-self-check-service.test.js
    test/runtime-self-check-loop.test.js` (`135/135`);
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`.
- Deployment delegated to Codex Mobile Deploy Lane card
  `ttc_8f8683b8421cd5aad1` for ref `5d4515ab42e7`; no local production
  deploy was run from this thread.

## Current Addendum - 2026-07-05 Frontend native ESM migration Phase 4 helper slice

- Objective remains active: continue `docs/FRONTEND_ESM_MIGRATION_PLAN.md`
  native ESM migration, run development tests, and deploy only after Owner
  approval.
- Phase 4 helper slice in the main worktree is implemented but not committed
  because the Owner requested the independent submitted-message hotfix first.
- Added native ESM helper sources:
  `frontend/native/thread-list-stable-order.mjs`,
  `frontend/native/thread-status-hints.mjs`, and
  `frontend/native/thread-detail-actions.mjs`.
- Wired `nativeSource` entries in `scripts/frontend-shell-asset-graph.mjs` and
  extended `test/vite-shell-asset-graph.test.js` with classic/native behavior
  parity and manifest assertions.
- Regenerated artifacts in the main worktree; readback shows native modules
  increased to `19` and classic compatibility modules reduced to `30`.
- Validation passed before the hotfix interruption:
  - `npm run --silent build:frontend`;
  - focused helper/artifact tests (`39/39`);
  - broader thread-detail/browser/artifact tests (`441/441`);
  - supplemental UI/route shell tests (`63/63`);
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`;
  - local dev server on `127.0.0.1:8901` with
    `CODEX_MOBILE_DEFAULT_SHELL=vite-app-preview`: startup/browser gate
    `deployPass=true`, blocking `0`, actionable issue codes `[]`; only existing
    H3 `active_codex_app_server_rss_elevated` advisory. The dev server was
    stopped.
- Do not deploy this ESM slice until the Owner explicitly approves the ESM
  migration deploy path.

## Current Addendum - 2026-07-05 Frontend native ESM migration Phase 4 tile helper slice

- Objective remains active: continue `docs/FRONTEND_ESM_MIGRATION_PLAN.md`
  native ESM migration with development validation; production deploy still
  requires Owner approval.
- Migrated the thread tile helper policies, not the main tile runtime:
  `frontend/native/thread-tile-layout.mjs`,
  `frontend/native/thread-tile-actions.mjs`, and
  `frontend/native/thread-tile-state.mjs`.
- Wired `nativeSource` entries in `scripts/frontend-shell-asset-graph.mjs` and
  extended `test/vite-shell-asset-graph.test.js` with classic/native parity
  coverage for tile layout, tile actions, and tile state planning.
- Regenerated artifacts; `public/vite-shell/vite-shell-readback.json` now
  reports `nativeEsmModuleCount=22` and
  `classicGlobalCompatibilityModuleCount=27`.
- Validation passed:
  - `node --check frontend/native/thread-tile-layout.mjs
    frontend/native/thread-tile-actions.mjs
    frontend/native/thread-tile-state.mjs
    scripts/frontend-shell-asset-graph.mjs
    test/vite-shell-asset-graph.test.js`;
  - focused tile/artifact tests (`26/26`);
  - broader shell/browser/artifact set (`151/151`);
  - thread-detail/conversation/task-card/mobile coverage (`371/371`);
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`;
  - local dev server on `127.0.0.1:8902` with
    `CODEX_MOBILE_DEFAULT_SHELL=vite-app-preview`: startup/browser gate
    `deployPass=true`, blocking `0`, actionable issue codes `[]`; only existing
    H3 `active_codex_app_server_rss_elevated` advisory. The dev server was
    stopped.
- This slice is source-validated only. No production deployment was performed.

## Current Addendum - 2026-07-05 Submitted message same-submission authority fix

- Symptom: submitted user messages could alternate between disappearing after
  send and later reappearing as duplicates, including stale duplicate user
  bubbles below newer assistant receipts.
- Root cause: local optimistic echo, mux/server pending echo, V4 projected
  echo, and durable user history did not all treat `clientSubmissionId` as the
  authoritative identity. A durable user message could already exist earlier in
  the thread while a synthetic pending echo with the same submission id remained
  in a later turn and survived frontend normalization.
- Fix in source:
  - `adapters/message-pending-echo-service.js` now scans the whole thread for a
    durable same-submission user message and removes matching synthetic pending
    echoes anywhere in the thread before deleting the pending store entry;
  - `adapters/thread-user-message-echo-normalizer-service.js` treats shared
    submission id as stronger than content equivalence;
  - `public/thread-detail-runtime.js` lets durable same-submission user
    messages shadow optimistic/local/mux echoes regardless of turn order;
  - `public/thread-detail-v4-merge-state.js` drops stale same-submission
    synthetic overlays once durable projection authority exists.
- Tests added/updated: pending echo removal when durable same-submission history
  already exists earlier, V4 stale overlay same-submission drop, echo normalizer
  same-submission authority, and visible conversation cross-turn normalization
  after durable receipt.
- Validation passed:
  - `node --test test/message-pending-echo-service.test.js test/thread-detail-v4-merge-state.test.js test/thread-user-message-echo-normalizer-service.test.js test/conversation-render.test.js` (`200/200`);
  - `node --test test/thread-detail-projection-service.test.js test/thread-detail-self-check-service.test.js test/browser-runtime-self-check-service.test.js` (`170/170`);
  - `node --check adapters/message-pending-echo-service.js adapters/thread-user-message-echo-normalizer-service.js public/thread-detail-runtime.js public/thread-detail-v4-merge-state.js`;
  - `npm run --silent build:frontend`;
  - `node --test test/vite-shell-asset-graph.test.js test/vite-shell-artifact-service.test.js test/runtime-self-check-loop.test.js test/browser-runtime-self-check-service.test.js test/client-event-stall-self-check-service.test.js` (`150/150`);
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`;
  - production-matching temporary dev server on `127.0.0.1:8897` with
    `CODEX_MOBILE_DEFAULT_SHELL=vite-app-preview` and controlled submit thread
    `019f307c-56fb-7261-a584-2636051ee724`: full behavior gate
    `deployPass=true`, blocking `0`, actionable issue codes `[]`.
- Deployment status: not deployed from this source workspace yet. Temporary dev
  server was stopped after validation.
- Residual/local state:
  - H3 runtime pressure advisory and non-blocking browser downgrade advisories
    remained in the dev behavior gate;
  - unrelated untracked `frontend/native/*.mjs` ESM migration files remain in
    the worktree and must not be included in this submitted-message fix.

## Current Addendum - 2026-07-05 Frontend native ESM migration Phase 2 diagnostics

- Objective: continue `docs/FRONTEND_ESM_MIGRATION_PLAN.md` without deployment
  until Owner explicitly approves.
- Current migration state after this source-workspace slice:
  - `esmCompatibility.moduleCount=49`;
  - `nativeEsmModuleCount=10`;
  - `classicGlobalCompatibilityModuleCount=39`;
  - native modules are `build-refresh-policy`, `runtime-settings`,
    `viewport-metrics`, `thread-performance-metrics`, `draft-store`,
    `image-compressor`, `frontend-runtime-health`,
    `home-ai-diagnostic-reporting`, `thread-diagnostic-events`, and
    `thread-list-load-policy`.
- Source changes in progress:
  - added native ESM sources for diagnostic/metrics helpers:
    `frontend/native/thread-performance-metrics.mjs`,
    `frontend/native/frontend-runtime-health.mjs`,
    `frontend/native/home-ai-diagnostic-reporting.mjs`, and
    `frontend/native/thread-diagnostic-events.mjs`;
  - wired their `nativeSource` entries in
    `scripts/frontend-shell-asset-graph.mjs`;
  - extended `test/vite-shell-asset-graph.test.js` with classic/native API
    equivalence samples and exact native module manifest assertions;
  - regenerated `public/vite-shell/*` artifacts. Current client/cache remains
    `0.1.11|codex-mobile-shell-v625-cbb2ef9490a1`.
- Validation passed:
  - `node --check frontend/native/thread-performance-metrics.mjs
    frontend/native/frontend-runtime-health.mjs
    frontend/native/home-ai-diagnostic-reporting.mjs
    frontend/native/thread-diagnostic-events.mjs
    scripts/frontend-shell-asset-graph.mjs
    test/vite-shell-asset-graph.test.js`;
  - `node --test test/vite-shell-asset-graph.test.js` (`11/11`);
  - `npm run --silent build:frontend`;
  - `node --test test/vite-shell-asset-graph.test.js
    test/vite-shell-artifact-service.test.js
    test/browser-runtime-self-check-service.test.js
    test/runtime-self-check-loop.test.js` (`136/136`);
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`;
  - temporary dev server on `127.0.0.1:8897` with
    `CODEX_MOBILE_DEFAULT_SHELL=vite-app-preview`: browser-only full runtime
    gate with startup-only/skip-api/skip-client-events returned
    `deployPass=true`, blocking `0`, actionable issue codes `[]`.
- Blocking evidence before deploy:
  - full deploy-mode dev behavior gate with API and controlled submit returned
    `deployPass=false` due `latest_completed_assistant_projection_gap`;
  - all Vite/app-preview browser jobs in that run were `ok=true`;
  - therefore this ESM slice is not deploy-ready until the projection-gap
    behavior-gate blocker is fixed or cleared in current runtime evidence.
- Deployment status: not deployed from this source workspace. Temporary dev
  server was stopped after validation.

## Current Addendum - 2026-07-05 Frontend native ESM migration Phase 1

- Objective: make the Vite/app-preview ESM migration measurable and begin
  moving runtime modules from classic-global compatibility to native ESM without
  switching the default production shell away from `classic-script-fallback`.
- Implemented Phase 1 migration contract in
  `scripts/frontend-shell-asset-graph.mjs`,
  `scripts/publish-vite-shell-artifact.mjs`,
  `scripts/verify-vite-shell-manifest.mjs`, and
  `services/runtime/vite-shell-artifact-service.js`.
- Added `frontend/native/build-refresh-policy.mjs` as the first native ESM
  runtime module. The existing `public/build-refresh-policy.js` remains present
  for classic fallback; app-preview/Vite imports the native source and publishes
  the same `CodexBuildRefreshPolicy` global.
- Added docs: `docs/FRONTEND_ESM_MIGRATION_PLAN.md`; linked from
  `docs/README.md`.
- Regenerated `public/vite-shell/*` artifacts. Readback now reports
  `esmCompatibility.moduleCount=49`, `nativeEsmModuleCount=1`,
  `classicGlobalCompatibilityModuleCount=48`, native module
  `build-refresh-policy`, published files `23`, retained artifact files `507`.
- Validation passed:
  - `npm run --silent build:frontend`
  - `node --test test/vite-shell-asset-graph.test.js test/vite-shell-artifact-service.test.js`
  - `node --test test/browser-runtime-self-check-service.test.js test/runtime-self-check-loop.test.js`
  - `npm run --silent check`
  - `git diff --check -- ':!.agent-context'`
- Remaining migration: 48 classic-global compatibility modules. Next low-risk
  candidates are `thread-list-load-policy`, `viewport-metrics`,
  `runtime-settings`, `draft-store`, and `image-compressor`.

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

## 2026-07-05T09:58:00+08:00 - Protect active detail state from stale partial projections

- User reported that Home AI main still behaved as running and produced new
  receipts, but the Codex Mobile UI showed the thread footer/list state as
  `completed`; user bubbles and receipts could also appear late or duplicate.
- Bounded live evidence from Home AI main
  `019eed86-2002-7cc2-b0b7-937eb5355f36` showed a state-source inconsistency:
  - a list/detail read reported an active thread and active turn;
  - the following partial projection read returned the same latest turn as
    stale/completed with `summary-resting-active-window`;
  - that non-authoritative partial result could then update the fallback/list
    cache and clear visible active state.
- Root cause fixed in source:
  - `summary-resting-active-window` stale partial detail reads are marked
    `mobileDetailStatusAuthority=false`;
  - thread-list fallback/detail sync no longer treats that partial status as
    terminal active-clear evidence;
  - runtime-active fallback state is protected when a partial detail read is
    explicitly non-authoritative;
  - API self-check now detects active-turn downgrade across consecutive detail
    readbacks with `thread_detail_refresh_active_status_downgrade`.
- User-behavior self-check/Honeycomb follow-up:
  - existing behavior harness entrypoints were found in
    `scripts/codex-mobile-runtime-self-check-loop.js`,
    `scripts/codex-mobile-browser-runtime-self-check.js`,
    `services/runtime/browser-runtime-self-check-service.js`, and
    `adapters/thread-detail-self-check-service.js`;
  - no current source implementation named `Honeycomb` was found in the plugin
    or central Home AI code search; current deploy gates mainly run startup
    checks, so the full behavior harness must be restored to deployment and
    incident validation;
  - a source-directed Home AI task card was sent to fix the central deploy gate
    gap so Codex Mobile deploys do not rely only on browser startup checks.
- Validation passed locally:
  - `node --check services/thread-list/thread-summary-state-service.js &&
    node --check adapters/thread-detail-self-check-service.js` -> pass;
  - `node --test test/thread-list-service-boundary.test.js
    test/thread-detail-self-check-service.test.js` -> 45/45;
  - `node --test test/thread-visibility.test.js
    test/thread-detail-read-orchestration-service.test.js
    test/browser-runtime-self-check-service.test.js
    test/runtime-self-check-loop.test.js` -> 215/215;
  - `npm run --silent check` -> pass;
  - `git diff --check -- ':!.agent-context'` -> pass.
- Commit/deploy status:
  - committed as `6d020289` `fix: protect active detail from stale partials`;
  - deployment request sent to Codex Mobile Deploy Lane
    (`019f16e6-9131-79e2-9b6b-ad41f7e65d92`) as task card
    `ttc_2f040c134ac5448293`;
  - deploy lane returned `completed` as receipt `ttc_85adbbd5d879369bbf`;
  - central private macOS deploy returned `ok=true`, listener pid `82384`,
    socket `*:8787`, and selected live mux/app-server pid/port/start time were
    preserved through listener restart;
  - production readback passed `/api/public-config`, `/api/status?detail=1`,
    `/api/vite-shell-artifact`, SHA parity for changed files, focused tests
    45/45, broader behavior/unit tests 215/215, and deploy-mode runtime
    self-check without submit exercise.
- Production residual:
  - Home AI main was already settled during deploy readback, so the active-turn
    stale-partial edge could not be observed live;
  - metadata self-check was `ok=true` with one existing H3
    `thread_list_updated_order_mismatch` advisory;
  - compact detail samples were `projection-stale-partial-hit` with completed
    status and no active turn, foreground `thread/read` and `turns/list` both
    zero;
  - final pressure still showed H3 `active_codex_app_server_rss_elevated`, but
    active/stale mux counts were normal at 1/0.
- Privacy boundary respected: only bounded ids, route names, issue codes,
  timings, status labels, hashes, and file paths were recorded; no raw secrets,
  access keys, cookies, launch tokens, private thread/task-card bodies, provider
  payloads, DB rows, screenshots, raw auth URLs, password paths, full prompts,
  rollout contents, raw cache JSON, raw message text, or long logs were exposed.

## 2026-07-05T10:25:00+08:00 - Public publish readiness check

- User asked whether the current Codex Mobile state is ready to submit Public.
- Current source state:
  - HEAD is `6d020289` `fix: protect active detail from stale partials`;
  - `main` is `45` commits ahead of `origin/main`;
  - worktree has only `.agent-context/HANDOFF.md` modified from this status
    update;
  - `public/main` fetched at `dd642363`, and `public/main` is an ancestor of
    `main`.
- Validation run during the check:
  - `npm run --silent check` -> pass;
  - public/update/Vite/browser focused set
    (`test/public-pull-request-service.test.js`,
    `test/app-maintenance-service.test.js`, `test/app-update.test.js`,
    `test/vite-shell-artifact-service.test.js`,
    `test/vite-shell-asset-graph.test.js`,
    `test/browser-runtime-self-check-service.test.js`) -> 137/137;
  - `git diff --check public/main..main -- ':!.agent-context'` -> pass;
  - staged changed-file name scan found no runtime/upload/log/key/DB-style
    file paths outside `.agent-context`;
  - staged diff secret-pattern scan only matched privacy-policy prose, not raw
    secrets.
- Public delta:
  - `git diff public/main..main -- ':!.agent-context'` contains 214 product
    files, about 81 non-merge commits, and Vite generated artifact changes;
  - this is a release-batch-sized sync, not a single-fix public patch.
- Blocking workflow observation:
  - public GitHub repo currently has one open non-draft PR, #82
    `修复 Session 列表活动后不自动排序`;
  - fetched PR head is `23857d18` and is not an ancestor of current `main`;
  - it changes thread-list runtime/stable-order files and Vite artifacts, so it
    must be merged, superseded, or explicitly closed before final public sync
    per `docs/COMPLEX_FEATURE_PATHS.md` public/private publish guidance.
- Readiness verdict recorded:
  - production/private validation is sufficient to prepare a Public sync;
  - direct push of private `main` to `public/main` is not the correct path;
  - final Public submission should use a clean public workspace/branch, sync
    only product files, handle PR #82 first, add the required detailed Chinese
    README/release commit message, then rerun public checks/privacy scan before
    push.

## 2026-07-05T10:37:00+08:00 - Public PR #82 triage

- User asked whether Public PR #82 needs to be absorbed before Public sync.
- PR metadata:
  - GitHub PR #82 title: `修复 Session 列表活动后不自动排序`;
  - head `23857d18` `fix: reorder thread list on activity`;
  - non-draft, open, mergeable, GitHub mergeable state `unstable`;
  - PR head is not an ancestor of current private `main`.
- Patch summary:
  - adds activity-aware invalidation to `public/thread-list-stable-order.js`;
  - passes `threadUpdatedAtMs` into `public/thread-list-runtime.js`;
  - updates `updateThreadListStatus(..., { eventAtMs })` calls in
    `public/event-stream-runtime.js`;
  - adds `promoteThreadListActivity` so active/status events bump local
    `updatedAt` and sort the sidebar list by updated activity;
  - adds a focused `test/thread-list-stable-order.test.js` case for newer
    activity breaking the stable-order hold;
  - includes generated Vite/shell artifacts tied to the old public base.
- Current private `main` behavior check:
  - the same focused activity scenario still returns `held=true` and keeps
    order `["a","b","c"]` instead of adopting the incoming active order
    `["a","c","b"]`;
  - current event-stream code still calls `updateThreadListStatus` without
    passing `eventAtMs`;
  - current `thread-list-runtime` lacks `promoteThreadListActivity`.
- Triage verdict:
  - absorb the logic from #82 before Public sync; it likely corresponds to the
    remaining H3 `thread_list_updated_order_mismatch` advisory and is a real
    user-visible list freshness issue;
  - do not directly merge the whole PR into current private `main`, because
    merge-tree shows conflicts in shell/Vite generated artifacts and the
    artifacts are based on the older public cache/build;
  - manually reapply the source/test logic on current private `main`, rebuild
    frontend artifacts, run focused and public checks, then close/supersede PR
    #82 in the Public release path.

## 2026-07-05T11:08:00+08:00 - Submitted user-message stability and PR #82 absorption

- User reported current-thread submitted user-message instability:
  - some messages were accepted but not immediately visible;
  - after the latest visibility fixes, a new regression showed duplicate
    identical `You` bubbles for one submitted message;
  - user also approved absorbing public PR #82 before stabilizing and preparing
    Public release.
- Root-cause boundary:
  - duplicate submitted user bubbles were fixed at the message/projection
    convergence boundary, not by hiding DOM rows;
  - PR #82 was absorbed at the thread-list stable-order policy/event boundary,
    not by merging the stale public PR generated artifacts.
- Source fix committed:
  - commit `af027848` `fix: stabilize submitted user messages`;
  - `adapters/thread-user-message-echo-normalizer-service.js` now collapses
    same-turn durable duplicate user-message echoes only when content matches
    and timestamps are within the bounded duplicate window, while preserving
    repeated durable messages without same-event evidence;
  - `public/thread-detail-runtime.js` adds same-turn duplicate-event convergence
    for visible user messages, and `public/event-stream-runtime.js` uses that
    convergence in live `upsertItem` before render;
  - PR #82 logic was manually applied: `public/thread-list-stable-order.js`
    tracks `updatedAtById`; `public/thread-list-runtime.js` promotes local
    thread activity timestamps and sorts by activity; `public/event-stream-runtime.js`
    passes `eventAtMs` to status updates;
  - frontend artifacts were regenerated with client/cache
    `0.1.11|codex-mobile-shell-v625-634d1204a898`.
- Local validation passed:
  - `node --test test/thread-list-stable-order.test.js
    test/thread-user-message-echo-normalizer-service.test.js
    test/conversation-render.test.js test/vite-shell-artifact-service.test.js
    test/vite-shell-asset-graph.test.js test/browser-runtime-self-check-service.test.js`
    -> 293/293;
  - `npm run --silent build:frontend` -> ok, published files `23`;
  - `npm run --silent check` -> pass;
  - `git diff --check -- ':!.agent-context'` -> pass.
- Deploy status:
  - deployment request sent to Codex Mobile Deploy Lane
    (`019f16e6-9131-79e2-9b6b-ad41f7e65d92`) as task card
    `ttc_82c4d1e4efc89f327c`;
  - deploy lane was asked to use the central private macOS plugin deploy
    contract, prove `/api/public-config`, `/api/status?detail=1`,
    `/api/vite-shell-artifact`, SHA parity, focused production tests, and the
    repaired full Codex Mobile behavior gate;
  - Public publishing remains blocked until this production deploy/readback
    returns clean and the user confirms the runtime is stable.
- Privacy boundary respected: only bounded ids, route names, hashes, status
  labels, timings, test counts, and artifact cache ids were recorded; no raw
  secrets, access keys, cookies, launch tokens, private thread/task-card bodies,
  provider payloads, DB rows, screenshots, raw auth URLs, password paths, full
  prompts, rollout contents, raw cache JSON, raw message text, command output
  bodies, or long logs were exposed.

## 2026-07-05T11:35:00+08:00 - Behavior gate/runtime-pressure preflight repair

- After `af027848` deploy, Deploy Lane returned `partially_completed`:
  - source ref synced and focused production tests passed;
  - central full behavior gate failed with
    `browser_dom_visible_items_downgraded_after_nonempty` plus browser
    exception codes;
  - production still had active mux/app-server `1/1` and stale
    mux/app-server `1/1`.
- Current production pressure probe before this repair showed:
  - active mux endpoint pid `25124`;
  - active codex app-server RSS around `4GB`;
  - stale codex app-server RSS around `4GB`;
  - old stale mux itself was only around `304MB`, so previous
    stale-mux-only thresholds reported it as H3 and did not block deploy
    behavior checks.
- Source fix in progress:
  - `services/runtime/runtime-process-pressure-service.js` now reports H2
    `stale_codex_app_server_pressure` when stale codex app-server count/RSS
    crosses bounded thresholds, independent of stale mux RSS;
  - `scripts/codex-mobile-runtime-self-check-loop.js` now runs a deploy-mode
    process-pressure preflight before high-cost browser behavior jobs and
    returns a bounded gate failure without starting browser self-checks when
    process pressure is already blocking.
- Validation performed:
  - `node --test test/runtime-process-pressure-service.test.js
    test/runtime-self-check-loop.test.js` -> 23/23;
  - repaired local deploy-mode full gate against current production returned
    in about 8s with actionable code `stale_codex_app_server_pressure` and
    `viteAppPreviewDefaultRootGate=skipped-process-pressure-preflight`;
  - `npm run --silent check` -> pass;
  - `git diff --check -- ':!.agent-context'` -> pass.
- Remaining work:
  - deployment request `ttc_f921959ebbbc2ae7d7` was sent for `275da035`, but
    it should be superseded by the follow-up V4 window downgrade fix below;
  - Public release remains blocked until process pressure is clean and the full
    behavior gate no longer reports visible-item downgrade.

## 2026-07-05T11:50:00+08:00 - V4 partial window downgrade guard

- Deploy Lane behavior-gate evidence for the previous production deploy showed
  `browser_dom_visible_items_downgraded_after_nonempty`:
  - one thread hash had visible items first reach `87`, then fall to `28/32`
    while turn count stayed `10`;
  - this indicates a later smaller detail/projection window was allowed to
    overwrite an already confirmed richer window.
- Source fix:
  - `public/thread-detail-v4-merge-state.js` now treats a V4 projection refresh
    as a regressive visible window only when it is multi-turn, static
    (no active-like turns), substantially smaller than the existing confirmed
    window, and has no newer turn evidence;
  - in that bounded case, merge keeps the existing richer turns while accepting
    incoming metadata such as projection revision/read mode;
  - single-turn active progress, final receipts, durable user reconciliation,
    and server-suppressed upload-image echoes continue through the normal merge
    path.
- Artifact rebuild:
  - `npm run --silent build:frontend` regenerated client/cache
    `0.1.11|codex-mobile-shell-v625-d15e7368401c`;
  - Vite shell published files remain `23`.
- Validation passed:
  - `node --test test/conversation-render.test.js
    test/vite-shell-artifact-service.test.js test/vite-shell-asset-graph.test.js
    test/browser-runtime-self-check-service.test.js
    test/runtime-process-pressure-service.test.js
    test/runtime-self-check-loop.test.js` -> 297/297;
  - `npm run --silent check` -> pass;
  - `git diff --check -- ':!.agent-context'` -> pass.
- Next deployment must supersede `275da035` and deploy the new head containing:
  - runtime process-pressure preflight;
  - V4 partial window downgrade guard;
  - regenerated frontend/Vite artifacts.
- Source commits and routing:
  - `275da035` committed runtime pressure preflight;
  - `8f31294b` committed the V4 partial-window downgrade guard and regenerated
    artifacts;
  - deployment request `ttc_a6a247431557afb716` was sent to Codex Mobile Deploy
    Lane (`019f16e6-9131-79e2-9b6b-ad41f7e65d92`) to supersede
    `ttc_f921959ebbbc2ae7d7`, clean stale mux/app-server state, deploy
    `8f31294b`, and run the full behavior gate.
  - follow-up urgent card `ttc_97889e47d0009b67e9` was sent after a read-only
    process check still showed the old `275da035` deploy path running; it asks
    Deploy Lane to stop/return the old path and use `8f31294b` instead.
- Post-card source-thread readback:
  - stale mux/app-server had been cleaned to `0/0`;
  - active mux/app-server remained `1/1`;
  - process-pressure blocking issue count was `0`;
  - `/api/public-config` still reported the earlier cache
    `0.1.11|codex-mobile-shell-v625-634d1204a898`, so `8f31294b` was not yet
    observed as deployed at the time this handoff entry was written.

## 2026-07-05T12:05:27+08:00 - Home AI stale-active behavior harness and fix

- User reported Home AI main thread still showing old/lagging receipts, a
  bottom `completed` state while new activity/receipts were expected, and user
  messages appearing above receipts in a way that broke reading order.
- Current production was already serving source cache
  `0.1.11|codex-mobile-shell-v625-d15e7368401c` from `8f31294b`, so this was
  not an old-client issue.
- Read-only current Home AI detail sample showed:
  - thread status `{ type: "completed", mobileClearedStaleActiveSummary: true,
    previousType: "active" }`;
  - latest visible turn status `{ type: "completed", mobileStaleActiveTurn:
    true, previousType: "active", reason: "summary-resting-active-window" }`;
  - existing metadata self-check returned `ok=true` and only H3 list-order
    advisory, so the user-visible stale-active tail state was not being gated.
- Local source fix:
  - `services/thread-detail/thread-detail-read-orchestration-service.js`
    preserves active projection windows when their activity timestamp is newer
    than, or near, the resting summary timestamp;
  - active-looking turns with terminal `turnUsageSummary` are normalized to
    ordinary completed state with `mobileCompletedActiveTurn`, not
    `mobileStaleActiveTurn`;
  - stale active tail turns are now H2 in
    `adapters/thread-detail-self-check-service.js`;
  - browser behavior harness now carries `staleActive` API turn-shape metadata
    and reports H2 `browser_api_stale_active_turn_downgraded`.
- Development harness proof:
  - local analyzer fed with current production Home AI detail returns
    `ok=false` with H2 `thread_detail_stale_active_turn_downgraded`;
  - local browser self-check script against current production Home AI returns
    `ok=false` with H2 `browser_api_stale_active_turn_downgraded`, proving the
    behavior gate now detects the screenshot-class issue before deployment.
- Validation passed:
  - `node --test test/thread-detail-read-orchestration-service.test.js` ->
    47/47;
  - `node --test test/thread-detail-self-check-service.test.js
    test/browser-runtime-self-check-service.test.js` -> 129/129;
  - `npm run --silent check` -> pass;
  - `git diff --check -- ':!.agent-context'` -> pass.
- Deployment should use a new source commit and require full behavior gate
  closure; do not publish Public until production Home AI detail no longer
  reports stale-active tail downgrade and behavior self-check is clean.

## 2026-07-05T12:40:29+08:00 - Dev user-behavior harness closure before deploy

- User requested that Codex Mobile user-visible behavior regressions be found
  and fixed in the development environment before any further production/Public
  deployment.
- Controlled submit fixture:
  - thread id `019f307c-56fb-7261-a584-2636051ee724`;
  - title `Codex Mobile Behavior Harness`;
  - used only for bounded submit exercise, not Home AI private content.
- Root causes fixed in source:
  - first `turns-list-initial` detail responses skipped bounded usage-summary
    decoration, so first paint could later gain a Usage/receipt row and trigger
    visible item downgrade behavior;
  - `event-stream-runtime` referenced detail-runtime user-message merge helpers
    that were not exposed across the split Vite/module runtime boundary, causing
    bounded browser `ReferenceError` during submit/event refresh;
  - completed-turn Usage backfill refresh waited too long after submit, so the
    API could contain the completed/Usage state while the DOM stayed temporarily
    stale inside the behavior window.
- Source changes:
  - `services/thread-detail/thread-detail-response-preparation-service.js`
    always attaches bounded usage summaries, including turns-list window reads;
  - `public/thread-detail-runtime.js` exports
    `userMessagesAreSameTurnDuplicateEvent`;
  - `public/runtime-wiring-runtime.js` exposes the detail-runtime merge helpers
    to the split runtime boundary;
  - `public/event-stream-runtime.js` and `public/pane-layout-runtime.js` shorten
    Usage backfill scheduling after `turn/completed`;
  - browser self-check now reports bounded exception codes/labels/hashes.
- Rebuilt frontend artifacts:
  - `npm run --silent build:frontend` -> client/cache
    `0.1.11|codex-mobile-shell-v625-92a6f52f98e3`.
- Development validation passed on local listener `127.0.0.1:18878`:
  - `node scripts/codex-mobile-thread-self-check.js --server
    http://127.0.0.1:18878 --thread-id 019f307c-56fb-7261-a584-2636051ee724
    --repeat 2 --json` -> `ok=true`, no issues;
  - narrowed submit browser harness against the controlled thread with
    `--exercise-submit` and submit sample delays
    `100,350,900,1600,2800,6000` -> `ok=true`, issue count `0`, exception
    count `0`, max client submissions `1`;
  - full browser behavior harness against both Home AI main
    `019eed86-2002-7cc2-b0b7-937eb5355f36` and the controlled submit thread
    with two rounds plus submit exercise -> `ok=true`, issue count `0`,
    blocking issue count `0`, exception count `0`;
  - `node --test test/thread-rollout-size-consistency.test.js
    test/thread-detail-self-check-service.test.js
    test/thread-detail-read-orchestration-service.test.js
    test/turn-usage-summary-service.test.js` -> 100/100;
  - `node --test test/turn-scroll-controls.test.js
    test/event-stream-runtime-ui.test.js test/thread-detail-runtime-ui.test.js
    test/browser-runtime-self-check-service.test.js` -> 105/105;
  - `npm run --silent check` -> pass;
  - `git diff --check -- ':!.agent-context'` -> pass.
- Deployment status:
  - not deployed/Public at this handoff point;
  - next step is to commit deployable source/artifacts, run central deploy plan,
  then send a `cardKind=plugin_deployment`, `pluginId=codex-mobile-web`
  request to Codex Mobile Deploy Lane with the controlled submit thread id so
  production `codex-mobile-behavior-gate` includes submit exercise.

## 2026-07-05T14:50:12+08:00 - Platform Worker lifecycle interface implementation

- Received Home AI task card `ttc_e7c0e29c8b74dab586` requesting explicit
  platform-controlled Worker lane lifecycle operations, plus follow-up
  `ttc_55fcc9c777728b0774` clarifying that plugin main threads must use the
  same mechanism through `plugin_worker` lanes.
- Source implementation is complete but not deployed:
  - `/api/at-loop/thread-lifecycle` now supports Worker lifecycle actions for
    explicit roles `home_ai_worker` and `plugin_worker`: list, resolve,
    ensure/create, retire, disable, archive, mark_available, mark_idle,
    mark_completed, status, and heartbeat;
  - Worker state is stored as metadata-only `workerLanes` in the existing
    at-loop state file, keeping ordinary Worker lanes distinct from Loop role
    slices;
  - plugin Worker lanes require `pluginId`, workspace cwd, source thread id,
    purpose, and stable request/idempotency keys;
  - `completed` lifecycle status remains deliverable, while retired/disabled
    / archived Worker lanes become non-deliverable;
  - task-card target routing now rejects retired/disabled Worker lanes through
    the canonical target deliverability check, so lifecycle state prevents
    later task-card delivery without Home AI-side fallback logic;
  - MCP `thread_lifecycle` schema exposes plugin/worker fields and the new
    Worker actions.
- Focused validation passed:
  - `node --test test/loop-task-runtime.test.js
    test/thread-task-card-routing-service.test.js
    test/codex-mobile-mcp-server.test.js test/at-loop-route-service.test.js
    test/thread-task-card-loop-routing-service.test.js
    test/thread-task-card-runtime-service.test.js` -> 64/64;
  - `npm run --silent check` -> pass;
  - `git diff --check -- ':!.agent-context'` -> pass.
- Bounded behavior covered by tests:
  - Home AI Worker ensure creates/returns a `home_ai_worker` lane, duplicate
    idempotency returns the same lane, completed remains deliverable, retired
    becomes non-deliverable and is excluded from normal list;
  - plugin Worker ensure requires `pluginId`, creates/returns `plugin_worker`,
    excludes plugin Loop/deploy lanes, supports metadata-only heartbeat, and
    retires without deleting history;
  - routing rejects a retired Worker target with a bounded lifecycle error.
- Residual state:
  - no production deploy was performed for this lifecycle card;
  - the broader Codex Mobile user-behavior stability/Public-release WIP remains
    separate and should still be validated/deployed through the central behavior
    gate before Public publishing.

## 2026-07-05T15:10:00+08:00 - Deployable stability + Worker lifecycle commit

- User requested commit and deployment after the behavior-stability and Worker
  lifecycle implementation work.
- Created deployable source commit:
  - `d4b0add0dff2fb423c0c068f79d84435c7805663`
    `fix: stabilize Codex Mobile behavior and worker lanes`;
  - staged source, tests, docs, and current Vite shell manifest/readback assets
    referenced by the current artifact graph;
  - left this handoff file unstaged as local/shared operating context.
- Pre-commit validation:
  - `git diff --check --cached` -> pass;
  - `npm run --silent check` -> pass.
- Deployment must be routed as a routine `plugin_deployment` card for
  `pluginId=codex-mobile-web` to the Codex Mobile dedicated deploy lane, using
  the central Home AI Mac deploy contract and the full Codex Mobile behavior
  gate with controlled submit thread
  `019f307c-56fb-7261-a584-2636051ee724`.

## 2026-07-05T15:16:43+08:00 - Stale v4 detail projection invalidation WIP

- Deploy lane returned the `d4b0add0dff2` deployment as
  `partially_completed`: production synced and focused tests passed, but the
  full Codex Mobile behavior gate failed with stale-active/detail downgrade
  and conversation patch fallback issue codes.
- Root-cause hypothesis after source/prod self-checks: the previous behavior
  work changed active/stale visible-item authority, but persisted v4 detail
  projections still used policy version `state-relevant-receipt-v4`; cold
  first paint after deploy could therefore reuse old partial windows until a
  later refresh rebuilt the corrected projection.
- Source patch bumps the v4 detail projection policy to
  `state-relevant-receipt-v5` in both the projection service default and the
  runtime wiring, and adds a regression test proving persisted v4 entries are
  ignored after the bump.
- Validation passed before commit/deploy request:
  - `node --test test/thread-detail-projection-v4-service.test.js
    test/thread-detail-read-orchestration-service.test.js
    test/browser-runtime-self-check-service.test.js
    test/runtime-self-check-loop.test.js` -> 175/175;
  - `npm run --silent check` -> pass;
  - `git diff --check -- ':!.agent-context'` -> pass;
  - local cold listener on `127.0.0.1:18879` plus full runtime behavior gate
    with controlled submit thread `019f307c-56fb-7261-a584-2636051ee724` ->
    `ok=true`, `deployPass=true`, no actionable behavior issue codes.
- Local listener `127.0.0.1:18879` was stopped after validation.

## 2026-07-05T15:39:00+08:00 - Development behavior gate repair before Public

- User reported two remaining behavior regressions after the `0b12d81f`
  production sync failed the full behavior gate:
  - Home AI large thread submit could appear slow, disappear, then reappear
    after several seconds;
  - current Codex Mobile thread submit could render duplicate visible user
    messages.
- Root-cause finding in development self-check:
  - production/browser controlled submit previously raised an uncaught
    `approvalThreadId is not defined` exception from the split event-stream
    runtime path;
  - `public/event-stream-runtime.js` calls `approvalThreadId(request)`, but
    `public/navigation-runtime.js` did not expose that helper through the
    runtime global wiring.
- Source repair:
  - expose `approvalThreadId` from `navigation-runtime`;
  - add a regression test proving the event-stream split runtime helper is
    exported by navigation runtime;
  - rebuild Vite shell artifacts, producing client/cache
    `0.1.11|codex-mobile-shell-v625-ce84215bc072`.
- PR #82 readback:
  - public PR `pentiumxp/codex-mobile-web-public#82` is closed but not merged
    (`mergedAt=null`);
  - its core thread-list stable-order test and activity-ordering behavior are
    already present in current `main`;
  - direct merge/cherry-pick of PR #82 would now regress newer runtime wiring,
    so no further absorption is required.
- Development validation passed:
  - `node --test test/conversation-render.test.js
    test/browser-runtime-self-check-service.test.js
    test/runtime-self-check-loop.test.js test/thread-list-stable-order.test.js`
    -> 277/277;
  - `npm run --silent check:frontend-manifest` -> pass;
  - `npm run --silent check` -> pass;
  - `git diff --check -- ':!.agent-context'` -> pass;
  - local API behavior self-check on `127.0.0.1:18879` for current thread,
    Home AI main, and controlled submit thread -> `ok=true`, only H3
    `thread_list_updated_order_mismatch`;
  - local full browser controlled-submit self-check on
    `127.0.0.1:18879` / thread `019f307c-56fb-7261-a584-2636051ee724` ->
    `ok=true`, no duplicate user message, no runtime exception, no status-hint
    drop.
- Next required steps:
  - deploy the newer source ref that supersedes the earlier `d5daa3f5`
    deploy request through the configured Codex Mobile/Home AI deploy lane
    using the central Mac deploy contract;
  - require the full `codex-mobile-behavior-gate` with automatic controlled
    submit before declaring this Public-ready.

## 2026-07-05T15:48:43+08:00 - Codex Mobile MCP tool namespace guidance repair

- User reported that the Codex Mobile task-card tool itself being unavailable
  is a product bug, after the current thread had to use
  `scripts/create-thread-task-card.js` instead of a direct tool call.
- Root-cause finding:
  - the Codex Mobile MCP backend/tooling is available through deferred tool
    discovery as `mcp__codex_mobile.*`;
  - existing generated instructions and task-card injected text only named the
    older app-server dynamic namespace `codex_mobile.*`, so models could treat
    the direct tool as unavailable and fall back to scripts.
- Source repair:
  - update task-card route runtime guidance to prefer
    `mcp__codex_mobile.delegate_to_thread` / `mcp__codex_mobile.return_to_source`
    when MCP tools are visible, while retaining `codex_mobile.*` as the
    equivalent app-server dynamic namespace;
  - update injected task-card, watchdog, and continuation text to name both
    return tool surfaces before the local script fallback;
  - update MCP initialize instructions to document the `mcp__codex_mobile`
    namespace explicitly;
  - update focused tests for task-card route/service and MCP initialize text,
    plus align one route-boundary assertion with the current
    latest-completed-assistant preparation stage.
- Validation passed:
  - `node --test test/thread-task-card-service.test.js
    test/thread-task-card-route.test.js test/codex-mobile-mcp-server.test.js`
    -> 87/87;
  - `git diff --check -- ':!.agent-context'` -> pass;
  - `npm run --silent check` -> pass.
- Next required step: commit this namespace guidance repair and send a newer
  deployment card that supersedes the earlier `d5daa3f5` deployment request.

## 2026-07-05T15:56:52+08:00 - Listener OOM causing 8787 unavailable

- User reported that every deploy can leave Codex Mobile unreachable for a long
  time: direct 8787 access and PWA both fail, and recovery is uncertain.
- Production readback before source repair:
  - `127.0.0.1:8787` had no listener;
  - system launchd service `com.hermesmobile.plugin.codex-mobile` existed but
    was `spawn scheduled`, `active count=0`, with last exit code `78`;
  - recent stderr showed V8 heap OOM around 4GB during `JSON.parse` /
    string-processing paths;
  - non-root `launchctl kickstart` was rejected with `Operation not permitted`,
    so local kickstart is not a reliable closure path.
- Root-cause hypothesis:
  - listener still accepted unbounded app-server inbound messages over JSONL /
    WebSocket;
  - when a large Home AI thread path produced a huge app-server response, the
    listener buffered the full line/message and then tried to `JSON.parse`,
    allowing a single RPC response to kill the process and trigger launchd
    throttling.
- Source repair:
  - add a bounded app-server inbound message limit, defaulting to 64MB and
    configurable through `CODEX_MOBILE_APP_SERVER_MAX_MESSAGE_BYTES`;
  - enforce the limit in JSONL streaming before buffering beyond the cap;
  - enforce the same cap before WebSocket/RPC `JSON.parse`;
  - fail pending RPCs with bounded `APP_SERVER_MESSAGE_TOO_LARGE` diagnostics
    and reset the app-server transport instead of OOM-crashing the listener;
  - expose `maxInboundMessageBytes` in app-server client status.
- Validation passed:
  - `node --test test/codex-app-server-client-service.test.js
    test/runtime-process-pressure-service.test.js test/runtime-self-check-loop.test.js`
    -> 36/36;
  - `node --test test/codex-app-server-client-service.test.js
    test/thread-task-card-service.test.js test/thread-task-card-route.test.js
    test/codex-mobile-mcp-server.test.js test/runtime-process-pressure-service.test.js
    test/runtime-self-check-loop.test.js` -> 123/123;
  - `node --check services/runtime/codex-app-server-client-service.js
    services/runtime/server-runtime-config-service.js server.js
    test/codex-app-server-client-service.test.js` -> pass;
  - `git diff --check -- ':!.agent-context'` -> pass;
  - `npm run --silent check` -> pass.
- Next required steps:
  - commit the OOM guard repair;
  - deploy latest source ref through the central Mac plugin deploy path;
  - production readback must prove `*:8787` is listening, status is ready,
    `maxInboundMessageBytes` is visible, and MCP task-card delegation works
    without script fallback.

## 2026-07-05T16:01:49+08:00 - Listener OOM guard deployed and 8787 restored

- Source commit deployed:
  - `dec625ced01d2a9a6438989809d7f567f5f02e07`
    `fix: bound app-server inbound messages`.
- Deployment path:
  - central private Mac plugin deploy contract;
  - reason `codex-mobile-listener-inbound-cap-dec625ce`;
  - plan `ok=true`, source ref `dec625ced01d`, deployable dirty files `[]`;
  - execute `ok=true`;
  - backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260705T075756Z-plugin-codex-mobile-web-codex-mobile-listener-inbound-cap-dec625ce`.
- Central gate/readback results:
  - launchd print: service `com.hermesmobile.plugin.codex-mobile` active and
    running;
  - listener startup gate: `ok=true`, `deployPass=true`, blocking issues `0`,
    actionable issue codes `[]`;
  - full behavior gate: `ok=true`, `deployPass=true`, blocking issues `0`,
    actionable issue codes `[]`;
  - codex auth profile audit: `auditOk=true`, blocking issues `0`.
- Independent production readback:
  - listener socket restored as `*:8787`, pid observed as `93655`;
  - `/api/public-config`: HTTP 200, default shell `vite-app-preview`, client /
    cache `0.1.11|codex-mobile-shell-v625-ce84215bc072`;
  - `/api/status?detail=1`: HTTP 200, `ready=true`, issue codes `[]`;
  - `/api/vite-shell-artifact`: HTTP 200, `ok=true`, issue codes `[]`,
    published files `23`;
  - runtime app-server client status exposes `maxInboundMessageBytes=67108864`.
- Source/production SHA parity matched for:
  - `server.js`;
  - `services/runtime/codex-app-server-client-service.js`;
  - `services/runtime/server-runtime-config-service.js`;
  - `test/codex-app-server-client-service.test.js`;
  - `scripts/codex-mobile-mcp-server.js`;
  - `server-routes/thread-task-card-route-service.js`;
  - `services/task-cards/thread-task-card-service.js`.
- Production focused tests passed:
  - `node --test test/codex-app-server-client-service.test.js
    test/codex-mobile-mcp-server.test.js test/thread-task-card-route.test.js
    test/thread-task-card-service.test.js` -> 98/98.
- MCP direct tool path recovered:
  - `mcp__codex_mobile.list_threads` returned `ok=true` after deploy;
  - no script fallback was needed for the read-only MCP probe.
- Residual:
  - deploy behavior gate still reported submit exercise as manual because no
    controlled submit thread was configured for this deploy invocation;
  - this OOM guard prevents listener death from oversized app-server inbound
    messages, but user-behavior submit harness coverage should still be wired
    to a controlled thread before Public readiness decisions.

## 2026-07-05T16:57:35+08:00 - Approval and continuation routing repairs

- File-change approval click repair:
  - source commit `70ff34529ca6af0ce9d13633feea312cab2cf037`
    `fix: submit stale approval decisions`;
  - root cause: visible `item/fileChange/requestApproval` actions could remain
    in the DOM after the client pending-approval map no longer contained the
    request, causing approval buttons to no-op instead of submitting a bounded
    approval decision;
  - source validation passed:
    - `node --test test/conversation-render.test.js
      test/thread-detail-actions.test.js test/protocol.test.js` -> 187/187;
    - `npm run --silent build:frontend`;
    - `npm run --silent check`;
    - `git diff --check -- ':!.agent-context'`;
  - production deploy lane synced the ref and passed focused production tests,
    but central behavior acceptance failed with `thread_detail_empty`, so the
    Home AI task card was returned as partially completed via
    `ttc_82ad2bb64b2425ed7a`.
- Continuation main-thread role inheritance repair:
  - source commit `ed7db4950e894282f7922f6b4907f68c25266db0`
    `fix: resolve main thread continuations`;
  - root cause: continuation creation recorded lineage/started-thread cache
    only, while current-main lookup could still classify Worker, deploy, audit,
    task-intake, or plugin lanes as deliverable `home_ai_main` candidates;
  - source repair:
    - added `services/runtime/workspace-main-thread-routing-service.js`;
    - continuation creation now records inherited/preferred-main metadata for
      true main-thread continuations;
    - `thread_lifecycle` now supports `home_ai_main`, `plugin_main`, and
      `workspace_main` resolution/listing through role-aware filtering;
    - Worker lanes, deploy lanes, audit lanes, task intake, Public PR lanes,
      source/current self-targets, and non-deliverable threads are excluded from
      ordinary current-main selection;
    - exact task-card return metadata remains unchanged and is not rewritten to
      a continuation.
  - source validation passed:
    - `node --test test/workspace-main-thread-routing-service.test.js
      test/loop-task-runtime.test.js` -> 40/40;
    - `node --test test/new-thread-route.test.js
      test/codex-mobile-mcp-server.test.js
      test/thread-task-card-routing-service.test.js
      test/thread-task-card-route.test.js` -> 78/78;
    - `npm run --silent check`;
    - `git diff --check -- ':!.agent-context'`.
  - deployment was delegated to Codex Mobile Deploy Lane as
    `ttc_93049c19049876f4f3`; at last readback that deploy card was still
    `approved` with an active resume-required execution lease, so no formal
    terminal deploy receipt had arrived yet.
  - direct production readback after sync showed the intended behavior live:
    - `/api/public-config`, `/api/status?detail=1`, and
      `/api/vite-shell-artifact` all returned HTTP 200 with ready/artifact OK;
    - source/production SHA parity matched the new routing service,
      continuation service, loop runtime service, focused tests, and docs;
    - production focused tests passed:
      `node --test test/workspace-main-thread-routing-service.test.js
      test/loop-task-runtime.test.js test/codex-mobile-mcp-server.test.js`
      -> 45/45;
    - `thread_lifecycle list role=home_ai_main
      cwd=/Users/hermes-dev/HermesMobileDev/app` returned only
      `Home AI 07-05` as the deliverable main candidate, excluding legacy
      Worker/deploy lanes that were returned by the old path.
- Residual:
  - central deploy card `ttc_93049c19049876f4f3` still needs its formal terminal
    receipt or watchdog recovery;
  - the live model-facing MCP tool schema exposed to this thread did not include
    `pluginId` for `plugin_worker ensure`, even though the source MCP schema
    includes it; direct authenticated `/api/at-loop/thread-lifecycle` verified
    the production service can create Codex Mobile plugin Worker lanes.
- Codex Mobile plugin Worker scheduling:
  - ensured `plugin_worker` lane for `pluginId=codex-mobile-web` and cwd
    `/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web`;
  - created/deliverable worker thread:
    `019f3181-4f2f-7aa3-8ae8-d12f6e23e7a5`
    (`codex mobile 07-04 Worker implementation`);
  - delegated Home AI task `ttc_04235144d871ef0e05` (Worker lifecycle exact
    target retirement repair) to that plugin Worker as child task card
    `ttc_dbc9bc03896b9ca845`;
  - sent heartbeat on `ttc_04235144d871ef0e05` with status
    `delegated-to-plugin-worker`.

## 2026-07-05T17:04:51+08:00 - Exact Worker lifecycle target repair

- Source task:
  - Home AI card `ttc_04235144d871ef0e05`
    `Repair Worker lifecycle exact target retirement`.
- Source commit:
  - `98730995d406f891dd4c985797b3b7c3dd15df18`
    `fix: honor exact worker lifecycle targets`.
- Root cause:
  - Worker lifecycle mutation used `findWorkerLaneRecord()`; when a supplied
    exact `targetThreadId` / `threadId` / `workerLaneId` was not present in the
    managed Worker lane state, lookup continued to request-id or
    role/cwd/purpose fallback;
  - this allowed an exact retirement request for a legacy title-based Worker to
    mutate the current/default managed Worker lane instead;
  - `achieve` / `mark_role_complete` for Worker roles also fell through to Loop
    role-slice logic and could return `thread_lifecycle_loop_not_found`.
- Repair:
  - added exact Worker lifecycle target parsing;
  - exact Worker selectors now stop lookup if they do not match a managed lane;
  - exact visible legacy Worker lanes can be adopted into lifecycle metadata and
    then retired/disabled/archived safely;
  - non-manageable exact targets return bounded
    `worker_lifecycle_target_not_manageable` with the requested id metadata;
  - Worker `achieve` / `mark_role_complete` now use Worker lifecycle completion
    instead of Loop slice lookup.
- Validation passed:
  - `node --test test/loop-task-runtime.test.js` -> 38/38;
  - `node --test test/loop-task-runtime.test.js
    test/thread-task-card-routing-service.test.js
    test/codex-mobile-mcp-server.test.js test/at-loop-route-service.test.js
    test/thread-task-card-loop-routing-service.test.js
    test/thread-task-card-runtime-service.test.js` -> 67/67;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`.
- Deployment:
  - delegated to Codex Mobile Deploy Lane as `ttc_48405ebdf271a6d24d`;
  - original Home AI card heartbeat updated with status `deploy-delegated`.
- Source return:
  - returned Home AI card `ttc_04235144d871ef0e05` as
    `partially_completed`;
  - return receipt card `ttc_8aa7f1478a226a21b4`;
  - reason: source fix is committed and validated, but deploy lane card
    `ttc_48405ebdf271a6d24d` was still approved/active/resume-required without
    terminal deployment readback at return time.
- Residual:
  - wait for deploy lane terminal readback before marking the Home AI source
    task fully completed;
  - if the deploy lane is blocked by the known `thread_detail_empty` behavior
    gate, return the Home AI task as partially completed with source/test
    evidence and deploy blocker metadata.

## 2026-07-05T20:05:00+08:00 - Worker approval full-access repair

- User-visible symptoms:
  - Worker lane showed an in-thread `item/fileChange/requestApproval` card with
    approve/reject buttons, but clicking did not resume the Worker;
  - screenshot showed the Worker footer already in full-access mode, while
    `/api/approvals` no longer listed the visible request, so the approval card
    was stale client/detail state rather than a live server approval request.
- Root-cause hypothesis and owning layer:
  - Worker task-card execution inherited approval settings instead of forcing
    Worker lanes through the trusted full-access task-card path;
  - composer approval handling did not clear local pending approval UI when the
    server replied that a file-change approval request was no longer pending.
- Repair implemented in source:
  - Worker lane task-card execution now applies full-access runtime settings by
    default for `home_ai_worker`, `plugin_worker`, and title/classified Worker
    lanes;
  - runtime result metadata exposes `workerLaneFullAccess`;
  - stale/missing approval request responses clear the local pending approval
    card, surface a bounded "approval ended" activity state, and schedule a
    current-thread refresh instead of leaving a dead waiting card.
- Validation passed before commit/deploy:
  - `node --test test/thread-task-card-runtime-service.test.js
    test/conversation-render.test.js` -> 168/168;
  - `npm run --silent build:frontend`;
  - `node --test test/thread-task-card-runtime-service.test.js
    test/conversation-render.test.js test/vite-shell-artifact-service.test.js
    test/vite-shell-asset-graph.test.js
    test/browser-runtime-self-check-service.test.js` -> 284/284;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`.
- Deployment state:
  - source commit `cbfcc0b6` (`fix: grant worker lanes full access by
    default`);
  - delegated to Codex Mobile Deploy Lane as `ttc_da2f944240dee8fc20`;
  - deployment receipt still pending at handoff update time.

## 2026-07-05T21:32:00+08:00 - Task-card MCP namespace guidance repair

- Symptom:
  - current model turn attempted `codex_mobile.delegate_to_thread` because the
    prompt included an app-server dynamic-tool namespace, but the runtime
    rejected it with `Unsupported dynamic tool namespace: codex_mobile`;
  - after `tool_search`, the callable MCP surface appeared under
    `mcp__codex_mobile.*`.
- Root cause:
  - task-card injected return/delegation guidance still treated
    `mcp__codex_mobile.*` and `codex_mobile.*` as near-equal options;
  - in deferred-tool sessions, this can steer the model toward an unsupported
    namespace before discovering the MCP-prefixed tool.
- Repair:
  - task-card continuation/return hints now say to use
    `mcp__codex_mobile.return_to_source` after Codex Mobile MCP discovery when
    needed;
  - runtime guidance now explicitly tells the model to call `tool_search` for
    Codex Mobile task-card tools if the MCP-prefixed tool is not visible yet;
  - unprefixed `codex_mobile.*` is now documented as valid only when that
    app-server namespace is directly visible and actually callable, and
    unsupported-namespace errors must switch to MCP or script fallback.
- Validation passed:
  - `node --test test/thread-task-card-service.test.js
    test/thread-task-card-route.test.js` -> 82/82;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`.
- Source commit pending at handoff update time.
- Follow-up root cause found in MCP delegate:
  - `mcp__codex_mobile.delegate_to_thread` itself was callable, but the MCP
    schema/payload did not include `sourceWorkspaceId`;
  - direct task-card route currently requires source workspace metadata, so the
    MCP call failed with `source_workspace_id_required`;
  - script fallback succeeded earlier only because the request JSON manually
    included `sourceWorkspaceId`.
- Additional repair:
  - MCP `delegate_to_thread` schema now exposes `sourceWorkspaceId` /
    `sourceWorkspace`;
  - MCP delegate payload forwards source workspace metadata to
    `/api/threads/:sourceThreadId/task-cards`.
- Additional validation passed:
  - `node --test test/codex-mobile-mcp-server.test.js
    test/thread-task-card-service.test.js test/thread-task-card-route.test.js`
    -> 87/87;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`.
- Source commits:
  - `f8500851` (`fix: prefer mcp task-card tool guidance`);
  - `5b032df3` (`fix: include source workspace in mcp delegation`).
- Deployment:
  - delegated to Codex Mobile Deploy Lane as `ttc_243548611f1de4348d`;
  - deployment receipt still pending at handoff update time.

## 2026-07-05T22:05:00+08:00 - Worker lane ownership inheritance on main continuation

- Task card:
  - source `Home AI 07-05` card `ttc_bfcf9577acaa83523e`;
  - requested repair: when Home AI main continues from `Home AI 06-22` to
    `Home AI 07-05`, eligible Worker lanes owned by the old main should inherit
    current-main ownership, while active or terminal lanes must not be stolen.
- Source repair:
  - commit `03337c5e` (`fix: inherit worker lanes across main continuations`);
  - changed files:
    - `services/at-loop/loop-task-runtime-service.js`;
    - `test/loop-task-runtime.test.js`.
- Behavior after fix:
  - Worker lifecycle `list` / `resolve` / `ensure` reconciles same-workspace
    continuation ownership before selecting Worker lanes;
  - eligible `home_ai_worker` / `plugin_worker` lane records update
    `sourceThreadId` to the current main and retain bounded metadata:
    `previousSourceThreadIds`, `inheritedFromSourceThreadId`,
    `currentMainThreadId`, and `ownershipInheritanceStatus`;
  - retired / disabled / archived lanes are not inherited;
  - lanes with active heartbeat or active task-card evidence become
    non-deliverable with bounded `ownership_inheritance_blocked_*` reason, so a
    current main `ensure` can create or select a different safe Worker;
  - historical task-card return metadata is not rewritten.
- Validation passed:
  - `node --test test/loop-task-runtime.test.js` -> 40/40;
  - `node --test test/loop-task-runtime.test.js
    test/thread-task-card-routing-service.test.js
    test/codex-mobile-mcp-server.test.js test/at-loop-route-service.test.js
    test/thread-task-card-loop-routing-service.test.js
    test/thread-task-card-runtime-service.test.js` -> 70/70;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`.
- Deployment status:
  - source-only repair committed; not deployed from this implementation turn.
  - If production readback is required, route `03337c5e` through the Codex
    Mobile Deploy Lane and verify `thread_lifecycle list/resolve` for
    `home_ai_worker` in `/Users/hermes-dev/HermesMobileDev/app`.
- Residual:
  - Public behavior-gate blocker remains separate from this card:
    `browser_latest_turn_item_below_api_expectation` /
    `browser_latest_turn_usage_missing` after controlled submit.

## 2026-07-05T18:45:00+08:00 - Submit catch-up refresh fix staged

- Current public-readiness blocker before this fix: production browser behavior gate after `6f28eaf4` still failed on controlled-submit DOM/API mismatch with `browser_latest_turn_item_below_api_expectation` and `browser_latest_turn_usage_missing`; API thread self-checks for deploy lane/source/control threads were clean.
- Root-cause hypothesis/fix: ordinary existing-thread submit success only scheduled one `message-submit` refresh plus live polling. The stronger completion path (`turn/completed`) owns post-completion full refreshes and forced usage backfill, so browser DOM could stay behind API when completion/event-stream delivery arrived late or was missed. `public/composer-runtime.js` now injects and calls bounded post-submit catch-up using `scheduleComposerTargetRefresh(..., 250)`, `schedulePostCompletionThreadRefreshes(..., [900, 2200, 5200])`, and `scheduleUsageBackfillRefresh(900, { force: true })` for the current thread.
- Wiring: `public/runtime-wiring-runtime.js` now passes `schedulePostCompletionThreadRefreshes` and `scheduleUsageBackfillRefresh` into the composer runtime. This keeps the fix on the same current-thread refresh/suppression path as the existing completion handler rather than adding an unbounded fallback.
- Frontend artifacts regenerated with `npm run --silent build:frontend`; new client/cache is `0.1.11|codex-mobile-shell-v625-85de3721f5c1`.
- Source validation passed: `node --test test/conversation-render.test.js`; `node --check public/composer-runtime.js public/runtime-wiring-runtime.js test/conversation-render.test.js`; `node --test test/conversation-render.test.js test/browser-runtime-self-check-service.test.js test/runtime-self-check-loop.test.js test/vite-shell-artifact-service.test.js test/vite-shell-asset-graph.test.js` (`296/296`); `npm run --silent check`; `git diff --check -- ':!.agent-context'`.
- Not yet deployed at this handoff update. Required next validation: commit this source fix, delegate central Codex Mobile deploy with controlled submit thread `019f307c-56fb-7261-a584-2636051ee724`, and require full behavior gate to clear `browser_latest_turn_item_below_api_expectation` / `browser_latest_turn_usage_missing` before Public.

## 2026-07-05T18:47:00+08:00 - Submit catch-up refresh commit and deploy handoff

- Source commit created: `e0617964` (`fix: refresh submitted turns after send`). `.agent-context/HANDOFF.md` remained uncommitted by design.
- Commit includes regenerated frontend shell/Vite artifacts for client/cache `0.1.11|codex-mobile-shell-v625-85de3721f5c1`.
- Deploy handoff sent through MCP Codex Mobile task-card tool to Codex Mobile Deploy Lane:
  - deploy card `ttc_1670c8e9f32e5a48b1`;
  - target thread `019f16e6-9131-79e2-9b6b-ad41f7e65d92`;
  - request id `codex-mobile-submit-catchup-refresh-e0617964`;
  - required controlled submit thread `019f307c-56fb-7261-a584-2636051ee724`;
  - required acceptance: full `codex-mobile-behavior-gate` clears `browser_latest_turn_item_below_api_expectation` and `browser_latest_turn_usage_missing` before Public.
- Deploy receipt was still pending at this handoff update time.

## 2026-07-05T19:05:00+08:00 - Preserve submitted user through completion refresh

- Follow-up after `e0617964` deploy receipt:
  - production synced `e0617964` but full behavior gate still failed on
    `browser_latest_turn_item_below_api_expectation` and
    `browser_latest_turn_user_message_below_api_expectation`;
  - local full behavior gate against production also reproduced transient
    submit/refresh issues including `thread_detail_refresh_lost_user_input`,
    `duplicate_item_ids`, and `browser_latest_turn_usage_missing`.
- Root-cause fix:
  - `public/thread-detail-state.js` now preserves a pending submitted
    `userMessage` with `mobilePendingSubmission` / `clientSubmissionId` when a
    completed incoming turn contains authoritative assistant/usage content but
    does not yet contain the durable server `userMessage`;
  - stale local-only user history without pending-submit identity still drops,
    and local-only assistant receipts still drop when server authoritative
    receipts arrive.
- Submit catch-up timing:
  - `public/composer-runtime.js` now schedules post-submit full refreshes at
    `[450, 1100, 2400, 5200]` and forced usage backfill at `450ms`, reducing
    the window where the behavior harness can sample a half-populated
    completion frame.
- Source commit:
  - `eac76bf9` (`fix: preserve submitted users through completion refresh`);
  - regenerated frontend shell/Vite artifacts;
  - new client/cache `0.1.11|codex-mobile-shell-v625-e2b1a7428fa9`.
- Source validation passed:
  - `node --check public/thread-detail-state.js public/composer-runtime.js test/conversation-render.test.js`;
  - `node --test test/conversation-render.test.js` -> 165/165;
  - `npm run --silent build:frontend`;
  - `node --test test/conversation-render.test.js test/browser-runtime-self-check-service.test.js test/runtime-self-check-loop.test.js test/vite-shell-artifact-service.test.js test/vite-shell-asset-graph.test.js` -> 297/297;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`.
- Deployment status:
  - delegated to Codex Mobile Deploy Lane as task card
    `ttc_9a08e9ab095d2f1a5b`;
  - target thread `019f16e6-9131-79e2-9b6b-ad41f7e65d92`;
  - request id `codex-mobile-submitted-user-completion-refresh-eac76bf9`;
  - required central private macOS deploy with controlled submit thread
    `019f307c-56fb-7261-a584-2636051ee724` and full behavior gate.
  - Public readiness requires clearing latest-turn item/user-message/usage
    blockers plus refresh lost-user / duplicate-id regressions.

## 2026-07-05T19:24:00+08:00 - Semantic refresh self-check and pre-900ms submit catch-up

- Follow-up after `eac76bf9` deploy receipt:
  - production synced `eac76bf9` and cleared prior latest-turn
    item/user-message/usage blockers;
  - remaining deploy blocker was `thread_detail_refresh_lost_user_input`.
- Local full behavior gate with `eac76bf9` production and local source changes
  showed the issue had moved to semantic refresh comparison:
  - `thread_detail_refresh_lost_user_input` cleared after unique user-input
    comparison;
  - remaining API refresh issues were item/assistant count drops caused by
    assistant progress consolidation;
  - browser still showed `browser_latest_turn_usage_missing` at
    `submit-post-900`, which requires a production frontend timing change.
- Source repair:
  - commit `3e38466b` (`fix: compare semantic refresh items in self-check`);
  - `adapters/thread-detail-self-check-service.js` now compares semantic
    unique user-input and assistant receipt counts for refresh downgrades,
    avoiding false H2s when pending/durable user echoes or progressive/final
    assistant receipts collapse to one visible semantic item;
  - real distinct user-input / assistant-output loss remains H2.
  - `public/composer-runtime.js` schedules submit catch-up full refreshes at
    `[350, 750, 1200, 2400, 5200]` and usage backfill at `750ms`, so the
    browser `submit-post-900` sample has a refresh opportunity before it runs.
- Frontend artifacts regenerated:
  - client/cache `0.1.11|codex-mobile-shell-v625-19d47a01beb9`.
- Validation passed:
  - `node --test test/thread-detail-self-check-service.test.js test/thread-self-check-script.test.js test/conversation-render.test.js` -> 210/210;
  - `npm run --silent build:frontend`;
  - `node --test test/thread-detail-self-check-service.test.js test/thread-self-check-script.test.js test/conversation-render.test.js test/browser-runtime-self-check-service.test.js test/runtime-self-check-loop.test.js test/vite-shell-artifact-service.test.js test/vite-shell-asset-graph.test.js` -> 342/342;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`;
  - local API thread self-check for deploy lane and controlled submit thread
    repeated 4 times returned `ok=true` with only H3
    `thread_list_updated_order_mismatch`.
- Deployment status:
  - delegated to Codex Mobile Deploy Lane as task card
    `ttc_05a03ed837e7810e49`;
  - target thread `019f16e6-9131-79e2-9b6b-ad41f7e65d92`;
  - request id `codex-mobile-semantic-refresh-selfcheck-3e38466b`;
  - deploy must use controlled submit thread
    `019f307c-56fb-7261-a584-2636051ee724` and full behavior gate.

## 2026-07-05T22:45:00+08:00 - ESM migration phase 3 conversation scroll slice

- Goal context:
  - continuing `docs/FRONTEND_ESM_MIGRATION_PLAN.md` migration under the
    "development environment first, Owner approval before deploy" rule.
- Source repair:
  - added native ESM module `frontend/native/conversation-scroll.mjs`;
  - wired `conversation-scroll` to `nativeSource` in
    `scripts/frontend-shell-asset-graph.mjs`;
  - extended `test/vite-shell-asset-graph.test.js` to prove the native ESM
    export surface and representative behavior match the classic fallback.
- Frontend build/readback:
  - `npm run --silent build:frontend` regenerated Vite shell artifacts;
  - `nativeEsmModuleCount` advanced from `10` to `11`;
  - `classicGlobalCompatibilityModuleCount` moved from `39` to `38`;
  - client/cache remained
    `0.1.11|codex-mobile-shell-v625-cbb2ef9490a1`.
- Validation passed:
  - `node --check frontend/native/conversation-scroll.mjs
    scripts/frontend-shell-asset-graph.mjs test/vite-shell-asset-graph.test.js`;
  - `node --test test/vite-shell-asset-graph.test.js
    test/conversation-scroll.test.js` -> 27/27;
  - `node --test test/conversation-scroll.test.js
    test/turn-scroll-controls.test.js test/conversation-render.test.js
    test/vite-shell-asset-graph.test.js test/vite-shell-artifact-service.test.js
    test/browser-runtime-self-check-service.test.js
    test/runtime-self-check-loop.test.js` -> 325/325;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`;
  - local dev browser startup/full shell gate against `127.0.0.1:8897`
    returned `deployPass=true`, blocking issues `0`, actionable codes `[]`,
    with only existing H3 `active_codex_app_server_rss_elevated`.
- Deployment status:
  - source-only ESM slice; no production deploy requested or performed.
  - Full production/Public readiness remains governed separately by the
    behavior gate and Owner approval.

## 2026-07-05T22:52:00+08:00 - ESM migration phase 3 thread detail state slice

- Goal context:
  - continued `docs/FRONTEND_ESM_MIGRATION_PLAN.md` Phase 3 in source/dev
    only; no production deploy without Owner approval.
- Source repair:
  - added native ESM module `frontend/native/thread-detail-state.mjs`;
  - wired `thread-detail-state` to `nativeSource` in
    `scripts/frontend-shell-asset-graph.mjs`;
  - extended `test/vite-shell-asset-graph.test.js` with native/classic
    equivalence checks for loaded-state, cache reuse, summary-only recovery,
    and visible item preservation policy behavior.
- Frontend build/readback:
  - `npm run --silent build:frontend` regenerated Vite shell artifacts;
  - `nativeEsmModuleCount` advanced from `11` to `12`;
  - `classicGlobalCompatibilityModuleCount` moved from `38` to `37`;
  - client/cache remained
    `0.1.11|codex-mobile-shell-v625-cbb2ef9490a1`.
- Validation passed:
  - `node --check frontend/native/thread-detail-state.mjs
    scripts/frontend-shell-asset-graph.mjs test/vite-shell-asset-graph.test.js`;
  - `node --test test/vite-shell-asset-graph.test.js
    test/thread-detail-state.test.js` -> 37/37;
  - `node --test test/thread-detail-state.test.js
    test/conversation-render.test.js test/thread-detail-render-plan.test.js
    test/thread-detail-patch-plan.test.js test/thread-detail-merge-state.test.js
    test/thread-detail-v4-merge-state.test.js test/vite-shell-asset-graph.test.js
    test/vite-shell-artifact-service.test.js
    test/browser-runtime-self-check-service.test.js
    test/runtime-self-check-loop.test.js` -> 454/454;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`;
  - local dev browser startup/full shell gate against `127.0.0.1:8898`
    returned `deployPass=true`, blocking issues `0`, actionable codes `[]`,
    with only existing H3 `active_codex_app_server_rss_elevated`.
- Deployment status:
  - source-only ESM slice; no production deploy requested or performed.
  - Remaining Phase 3 modules in order include `thread-detail-render-plan`,
    `thread-detail-patch-plan`, `thread-detail-merge-state`, and
    `thread-detail-v4-merge-state`.

## 2026-07-05T22:57:00+08:00 - ESM migration phase 3 thread detail render-plan slice

- Goal context:
  - continued `docs/FRONTEND_ESM_MIGRATION_PLAN.md` Phase 3 in source/dev
    only; no production deploy without Owner approval.
- Source repair:
  - added native ESM module `frontend/native/thread-detail-render-plan.mjs`;
  - wired `thread-detail-render-plan` to `nativeSource` in
    `scripts/frontend-shell-asset-graph.mjs`;
  - extended `test/vite-shell-asset-graph.test.js` with native/classic
    equivalence checks for refresh request planning, history auto-backfill,
    single-thread shell planning, and refresh outcome execution.
- Frontend build/readback:
  - `npm run --silent build:frontend` regenerated Vite shell artifacts;
  - `nativeEsmModuleCount` advanced from `12` to `13`;
  - `classicGlobalCompatibilityModuleCount` moved from `37` to `36`;
  - client/cache remained
    `0.1.11|codex-mobile-shell-v625-cbb2ef9490a1`.
- Validation passed:
  - `node --check frontend/native/thread-detail-render-plan.mjs
    scripts/frontend-shell-asset-graph.mjs test/vite-shell-asset-graph.test.js`;
  - `node --test test/vite-shell-asset-graph.test.js
    test/thread-detail-render-plan.test.js` -> 106/106;
  - `node --test test/thread-detail-render-plan.test.js
    test/thread-detail-state.test.js test/conversation-render.test.js
    test/thread-detail-patch-plan.test.js test/thread-detail-merge-state.test.js
    test/thread-detail-v4-merge-state.test.js test/vite-shell-asset-graph.test.js
    test/vite-shell-artifact-service.test.js
    test/browser-runtime-self-check-service.test.js
    test/runtime-self-check-loop.test.js` -> 455/455;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`;
  - local dev browser startup/full shell gate against `127.0.0.1:8899`
    returned `deployPass=true`, blocking issues `0`, actionable codes `[]`,
    with only existing H3 `active_codex_app_server_rss_elevated`.
- Deployment status:
  - source-only ESM slice; no production deploy requested or performed.
  - Remaining Phase 3 helper modules: `thread-detail-patch-plan`,
    `thread-detail-merge-state`, and `thread-detail-v4-merge-state`.

## 2026-07-05T23:08:00+08:00 - Submitted user message duplicate/order residual

- User evidence:
  - Xcode thread screenshot still showed an older `You` user message below
    newer Codex receipts after the same submitted-message duplicate class was
    previously reported as only partially deployed.
- Current diagnosis:
  - the prior same-submission authority fix was not sufficient for a stale
    projected/local user item that appears in a later turn after the durable
    user message has already appeared earlier;
  - `shouldDropDuplicateUserMessageEvent` only let later candidates shadow
    earlier items, so a lower-authority same-submission duplicate could survive
    at the bottom of the visible window.
- Source fix in progress:
  - `public/thread-detail-runtime.js` now treats shared `clientSubmissionId`
    as a cross-turn identity regardless of candidate direction, keeps the
    higher-authority item, and on equal authority keeps the earlier visible
    item so stale tail duplicates cannot remain below newer receipts.
  - `test/conversation-render.test.js` adds
    `cross-turn normalization drops later same-submission projected user after
    durable receipt`.
- Validation passed:
  - `node --check public/thread-detail-runtime.js
    test/conversation-render.test.js`;
  - `node --test test/conversation-render.test.js
    test/thread-detail-v4-merge-state.test.js
    test/thread-user-message-echo-normalizer-service.test.js
    test/message-pending-echo-service.test.js` -> 201/201.
- Deployment status:
  - not deployed and not committed yet;
  - current local `HEAD` includes ESM migration commits that are not approved
    for deploy, so this duplicate/order fix must either be isolated onto the
    current production/public baseline as a hotfix or wait for the ESM slice to
    complete and pass full behavior gates before deployment.

## 2026-07-05T23:12:00+08:00 - ESM migration phase 3 thread detail helper slice

- Goal context:
  - continued `docs/FRONTEND_ESM_MIGRATION_PLAN.md` Phase 3 in source/dev
    only; no production deploy without Owner approval.
- Source repair:
  - added native ESM modules
    `frontend/native/thread-detail-patch-plan.mjs`,
    `frontend/native/thread-detail-merge-state.mjs`, and
    `frontend/native/thread-detail-v4-merge-state.mjs`;
  - wired their `nativeSource` entries in
    `scripts/frontend-shell-asset-graph.mjs`;
  - extended `test/vite-shell-asset-graph.test.js` with native/classic
    equivalence checks for patch planning, thread-detail merge policy, and V4
    projection merge policy.
- Frontend build/readback:
  - `npm run --silent build:frontend` regenerated Vite shell artifacts;
  - `nativeEsmModuleCount` advanced from `13` to `16`;
  - `classicGlobalCompatibilityModuleCount` moved from `36` to `33`;
  - native helper modules now include `thread-detail-patch-plan`,
    `thread-detail-merge-state`, and `thread-detail-v4-merge-state`;
  - client/cache remained
    `0.1.11|codex-mobile-shell-v625-cbb2ef9490a1`.
- Validation passed:
  - `node --check frontend/native/thread-detail-patch-plan.mjs
    frontend/native/thread-detail-merge-state.mjs
    frontend/native/thread-detail-v4-merge-state.mjs
    scripts/frontend-shell-asset-graph.mjs test/vite-shell-asset-graph.test.js`;
  - `node --test test/vite-shell-asset-graph.test.js
    test/thread-detail-patch-plan.test.js
    test/thread-detail-merge-state.test.js
    test/thread-detail-v4-merge-state.test.js` -> 49/49;
  - `node --test test/thread-detail-render-plan.test.js
    test/thread-detail-state.test.js test/conversation-render.test.js
    test/thread-detail-patch-plan.test.js test/thread-detail-merge-state.test.js
    test/thread-detail-v4-merge-state.test.js test/vite-shell-asset-graph.test.js
    test/vite-shell-artifact-service.test.js
    test/browser-runtime-self-check-service.test.js
    test/runtime-self-check-loop.test.js` -> 456/456;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`;
  - local dev browser startup/full shell gate against `127.0.0.1:8900`
    returned `deployPass=true`, blocking issues `0`, actionable codes `[]`,
    with only existing H3 `active_codex_app_server_rss_elevated`.
- Deployment status:
  - source-only ESM slice; no production deploy requested or performed.
  - Phase 3 rendering planners/state helpers are now migrated through
    `thread-detail-v4-merge-state`. Remaining ESM migration is the larger UI
    runtime group from Phase 4.

## 2026-07-05T23:27:00+08:00 - Submitted echo hotfix deploy residual

- Independent non-ESM hotfix:
  - isolated ref `5d4515ab42e7` (`fix: drop stale same-submission user
    echoes`) was deployed/synced by the Codex Mobile Deploy Lane;
  - production served client/cache
    `0.1.11|codex-mobile-shell-v625-14d250f3a235`;
  - source/prod SHA parity matched `28/28`;
  - focused production tests passed `336/336`;
  - deploy-lane and controlled-submit API self-checks returned `ok=true`.
- Acceptance blocker:
  - central full behavior gate failed, so this ref is not Public-ready;
  - blocking codes were `thread_detail_refresh_item_downgrade` and
    `thread_detail_refresh_lost_assistant_items`;
  - startup gate and API/Vite artifact health were green.
- Runtime notes:
  - `GET /api/threads/:threadId` had slow count `0`;
  - the single sampled `POST /api/threads/:threadId/messages` was slow at
    about `1473ms`;
  - listener RSS/heap at readback were about `961MB/301MB`.
- Boundary:
  - do not mix this hotfix state into ESM migration commits;
  - continue ESM as source/dev-only until the Owner explicitly approves a
    production deploy.

## 2026-07-05T23:31:00+08:00 - ESM migration phase 4 standalone helper slice

- Goal context:
  - continued `docs/FRONTEND_ESM_MIGRATION_PLAN.md` in source/dev only;
  - no production deploy requested or performed for this ESM slice.
- Source repair:
  - added native ESM modules
    `frontend/native/plugin-voice-input.mjs`,
    `frontend/native/api-client.mjs`,
    `frontend/native/markdown-renderer.mjs`, and
    `frontend/native/plugin-embed.mjs`;
  - wired their `nativeSource` entries in
    `scripts/frontend-shell-asset-graph.mjs`;
  - extended `test/vite-shell-asset-graph.test.js` with classic/native
    equivalence coverage for voice-input protocol messages, API request
    behavior, markdown rendering, and Hermes plugin embed route/navigation
    helpers.
- Frontend build/readback:
  - `npm run --silent build:frontend` regenerated Vite shell artifacts;
  - `nativeEsmModuleCount` advanced from `22` to `26`;
  - `classicGlobalCompatibilityModuleCount` moved from `27` to `23`;
  - client/cache remained
    `0.1.11|codex-mobile-shell-v625-cbb2ef9490a1`.
- Validation passed:
  - `node --check frontend/native/plugin-voice-input.mjs
    frontend/native/api-client.mjs frontend/native/markdown-renderer.mjs
    frontend/native/plugin-embed.mjs scripts/frontend-shell-asset-graph.mjs
    test/vite-shell-asset-graph.test.js`;
  - `node --test test/vite-shell-asset-graph.test.js
    test/plugin-voice-input.test.js test/api-client.test.js
    test/markdown-render.test.js test/mermaid-render.test.js
    test/plugin-embed.test.js` -> `67/67`;
  - broader shell/runtime helper set -> `222/222`;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`;
  - local dev browser startup/full shell gate against `127.0.0.1:8903`
    returned `deployPass=true`, blocking issues `0`, actionable codes `[]`,
    with only existing H3 `active_codex_app_server_rss_elevated`.
- Deployment status:
  - source-only ESM slice; do not deploy until Owner approves.

## 2026-07-05T23:34:00+08:00 - ESM migration phase 4 app update runtime slice

- Goal context:
  - continued `docs/FRONTEND_ESM_MIGRATION_PLAN.md` in source/dev only;
  - no production deploy requested or performed.
- Source repair:
  - added native ESM module `frontend/native/app-update-runtime.mjs`;
  - wired `app-update-runtime` to `nativeSource` in
    `scripts/frontend-shell-asset-graph.mjs`;
  - extended `test/vite-shell-asset-graph.test.js` with classic/native
    equivalence checks for update status text, public release matching,
    Public PR prompt keys/summaries, and workspace routing helpers.
- Frontend build/readback:
  - `npm run --silent build:frontend` regenerated Vite shell artifacts;
  - `nativeEsmModuleCount` advanced from `26` to `27`;
  - `classicGlobalCompatibilityModuleCount` moved from `23` to `22`;
  - `app-update-runtime` read back as `compatibilityMode=native-esm`;
  - client/cache remained
    `0.1.11|codex-mobile-shell-v625-cbb2ef9490a1`.
- Validation passed:
  - `node --check frontend/native/app-update-runtime.mjs
    scripts/frontend-shell-asset-graph.mjs test/vite-shell-asset-graph.test.js`;
  - focused app-update/mobile viewport set -> `50/50`;
  - broader shell/runtime/update/helper set -> `224/224`;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`;
  - local dev browser startup/full shell gate against `127.0.0.1:8904`
    returned `deployPass=true`, blocking issues `0`, actionable codes `[]`,
    with only existing H3 `active_codex_app_server_rss_elevated`.
- Deployment status:
  - source-only ESM slice; do not deploy until Owner approves.

## 2026-07-05T23:39:00+08:00 - ESM migration phase 4 modal runtime slice

- Goal context:
  - continued `docs/FRONTEND_ESM_MIGRATION_PLAN.md` in source/dev only;
  - no production deploy requested or performed.
- Source repair:
  - added native ESM module `frontend/native/modal-runtime.mjs`;
  - wired `modal-runtime` to `nativeSource` in
    `scripts/frontend-shell-asset-graph.mjs`;
  - extended `test/vite-shell-asset-graph.test.js` with classic/native
    equivalence checks for modal global helper exposure, profile-switch stage
    labels, and progress formatting.
- Frontend build/readback:
  - `npm run --silent build:frontend` regenerated Vite shell artifacts;
  - `nativeEsmModuleCount` advanced from `27` to `28`;
  - `classicGlobalCompatibilityModuleCount` moved from `22` to `21`;
  - `modal-runtime` read back as `compatibilityMode=native-esm`;
  - client/cache remained
    `0.1.11|codex-mobile-shell-v625-cbb2ef9490a1`.
- Validation passed:
  - `node --check frontend/native/modal-runtime.mjs
    scripts/frontend-shell-asset-graph.mjs test/vite-shell-asset-graph.test.js`;
  - focused app-update/mobile/voice set -> `50/50`;
  - broader shell/runtime/update/helper set -> `225/225`;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`;
  - local dev browser startup/full shell gate against `127.0.0.1:8905`
    returned `deployPass=true`, blocking issues `0`, actionable codes `[]`,
    with only existing H3 `active_codex_app_server_rss_elevated`.
- Deployment status:
  - source-only ESM slice; do not deploy until Owner approves.

## 2026-07-05T23:43:00+08:00 - ESM migration phase 4 small policy helper slice

- Goal context:
  - continued `docs/FRONTEND_ESM_MIGRATION_PLAN.md` in source/dev only;
  - no production deploy requested or performed.
- Source repair:
  - added native ESM modules
    `frontend/native/client-render-stability-guard.mjs` and
    `frontend/native/live-operation-dock-state.mjs`;
  - wired both modules to `nativeSource` entries in
    `scripts/frontend-shell-asset-graph.mjs`;
  - extended `test/vite-shell-asset-graph.test.js` with classic/native
    equivalence checks for submitted-turn identity keys and live operation dock
    policy planning.
- Frontend build/readback:
  - `npm run --silent build:frontend` regenerated Vite shell artifacts;
  - `nativeEsmModuleCount` advanced from `28` to `30`;
  - `classicGlobalCompatibilityModuleCount` moved from `21` to `19`;
  - both modules read back as `compatibilityMode=native-esm`;
  - client/cache remained
    `0.1.11|codex-mobile-shell-v625-cbb2ef9490a1`.
- Validation passed:
  - `node --check frontend/native/client-render-stability-guard.mjs
    frontend/native/live-operation-dock-state.mjs
    scripts/frontend-shell-asset-graph.mjs test/vite-shell-asset-graph.test.js`;
  - focused guard/dock/render set -> `37/37`;
  - broader shell/runtime/render set -> `331/331`;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`;
  - local dev browser startup/full shell gate against `127.0.0.1:8906`
    returned `deployPass=true`, blocking issues `0`, actionable codes `[]`,
    with only existing H3 `active_codex_app_server_rss_elevated`.
- Deployment status:
  - source-only ESM slice; do not deploy until Owner approves.

## 2026-07-05T23:46:00+08:00 - ESM migration phase 4 runtime wiring slice

- Goal context:
  - continued `docs/FRONTEND_ESM_MIGRATION_PLAN.md` in source/dev only;
  - no production deploy requested or performed.
- Source repair:
  - added native ESM module `frontend/native/runtime-wiring-runtime.mjs`;
  - wired `runtime-wiring-runtime` to `nativeSource` in
    `scripts/frontend-shell-asset-graph.mjs`;
  - extended `test/vite-shell-asset-graph.test.js` to verify the startup
    factory is exposed without executing initialization during unit tests.
- Frontend build/readback:
  - `npm run --silent build:frontend` regenerated Vite shell artifacts;
  - `nativeEsmModuleCount` advanced from `30` to `31`;
  - `classicGlobalCompatibilityModuleCount` moved from `19` to `18`;
  - `runtime-wiring-runtime` read back as `compatibilityMode=native-esm`;
  - client/cache remained
    `0.1.11|codex-mobile-shell-v625-cbb2ef9490a1`.
- Validation passed:
  - `node --check frontend/native/runtime-wiring-runtime.mjs
    scripts/frontend-shell-asset-graph.mjs test/vite-shell-asset-graph.test.js`;
  - focused startup/runtime set -> `135/135`;
  - broader startup/render/runtime set -> `317/317`;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`;
  - local dev browser startup/full shell gate against `127.0.0.1:8907`
    returned `deployPass=true`, blocking issues `0`, actionable codes `[]`,
    with only existing H3 `active_codex_app_server_rss_elevated`.
- Deployment status:
  - source-only ESM slice; do not deploy until Owner approves.

## 2026-07-05T23:52:00+08:00 - ESM migration phase 4 app entry slice

- Goal context:
  - continued `docs/FRONTEND_ESM_MIGRATION_PLAN.md` in source/dev only;
  - no production deploy requested or performed.
- Source repair:
  - added native ESM module `frontend/native/app-entry.mjs`;
  - wired `app-entry` to `nativeSource` in
    `scripts/frontend-shell-asset-graph.mjs`;
  - updated `test/vite-shell-asset-graph.test.js` native-count and native
    module contract assertions.
- Frontend build/readback:
  - `npm run --silent build:frontend` regenerated Vite shell artifacts;
  - `nativeEsmModuleCount` advanced from `31` to `32`;
  - `classicGlobalCompatibilityModuleCount` moved from `18` to `17`;
  - `app-entry` read back as `compatibilityMode=native-esm`;
  - client/cache remained
    `0.1.11|codex-mobile-shell-v625-cbb2ef9490a1`.
- Validation passed:
  - `node --check frontend/native/app-entry.mjs
    scripts/frontend-shell-asset-graph.mjs test/vite-shell-asset-graph.test.js`;
  - focused shell/runtime set -> `132/132`;
  - broader shell/render/runtime set -> `331/331`;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`;
  - targeted local dev browser startup gate against `127.0.0.1:8908`
    returned `ok=true`, app visible, runtime/loadThread/shell-refresh ready,
    exception count `0`.
- Note:
  - the broader runtime-loop invocation that includes legacy `browser-vite-preview`
    still reports `vite_preview_esm_compatibility_missing`; the targeted
    app-preview default-root gate passed and is the relevant coverage for this
    `app-entry` migration slice.
- Deployment status:
  - source-only ESM slice; do not deploy until Owner approves.

## 2026-07-05T23:55:00+08:00 - ESM migration phase 4 DOM patch slice

- Goal context:
  - continued `docs/FRONTEND_ESM_MIGRATION_PLAN.md` in source/dev only;
  - no production deploy requested or performed.
- Source repair:
  - added native ESM module `frontend/native/thread-detail-dom-patch.mjs`
    by mechanically removing the classic IIFE/CommonJS wrapper from the
    existing DOM patch helper and exporting the same API surface;
  - wired `thread-detail-dom-patch` to `nativeSource` in
    `scripts/frontend-shell-asset-graph.mjs`;
  - updated `test/vite-shell-asset-graph.test.js` native-count and native
    module contract assertions.
- Frontend build/readback:
  - `npm run --silent build:frontend` regenerated Vite shell artifacts;
  - `nativeEsmModuleCount` advanced from `32` to `33`;
  - `classicGlobalCompatibilityModuleCount` moved from `17` to `16`;
  - `thread-detail-dom-patch` read back as `compatibilityMode=native-esm`
    with all `33` expected functions present;
  - client/cache remained
    `0.1.11|codex-mobile-shell-v625-cbb2ef9490a1`.
- Validation passed:
  - `node --check frontend/native/thread-detail-dom-patch.mjs
    scripts/frontend-shell-asset-graph.mjs test/vite-shell-asset-graph.test.js`;
  - focused DOM patch/render set -> `206/206`;
  - broader shell/render/runtime set -> `331/331`;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`;
  - targeted local dev browser startup gate against `127.0.0.1:8909`
    returned `ok=true`, app visible, runtime/loadThread/shell-refresh ready,
    exception count `0`.
- Deployment status:
  - source-only ESM slice; do not deploy until Owner approves.

## 2026-07-05T23:57:00+08:00 - ESM migration phase 4 side chat slice

- Goal context:
  - continued `docs/FRONTEND_ESM_MIGRATION_PLAN.md` in source/dev only;
  - no production deploy requested or performed.
- Source repair:
  - added native ESM module `frontend/native/side-chat-runtime.mjs`
    by mechanically removing the classic IIFE/CommonJS wrapper while
    preserving the `createSideChatRuntime` factory/deps boundary;
  - wired `side-chat-runtime` to `nativeSource` in
    `scripts/frontend-shell-asset-graph.mjs`;
  - updated `test/vite-shell-asset-graph.test.js` native-count and native
    module contract assertions.
- Frontend build/readback:
  - `npm run --silent build:frontend` regenerated Vite shell artifacts;
  - `nativeEsmModuleCount` advanced from `33` to `34`;
  - `classicGlobalCompatibilityModuleCount` moved from `16` to `15`;
  - `side-chat-runtime` read back as `compatibilityMode=native-esm`;
  - client/cache remained
    `0.1.11|codex-mobile-shell-v625-cbb2ef9490a1`.
- Validation passed:
  - `node --check frontend/native/side-chat-runtime.mjs
    scripts/frontend-shell-asset-graph.mjs test/vite-shell-asset-graph.test.js`;
  - focused side-chat/shell/render set -> `301/301`;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`;
  - targeted local dev browser startup gate against `127.0.0.1:8910`
    returned `ok=true`, app visible, runtime/loadThread/shell-refresh ready,
    exception count `0`.
- Deployment status:
  - source-only ESM slice; do not deploy until Owner approves.

## 2026-07-06T00:02:00+08:00 - ESM migration phase 4 settings runtime slice

- Goal context:
  - continued `docs/FRONTEND_ESM_MIGRATION_PLAN.md` in source/dev only;
  - no production deploy requested or performed.
- Source repair:
  - added native ESM module `frontend/native/settings-runtime.mjs`
    by mechanically removing the classic IIFE/CommonJS wrapper while
    preserving the `createSettingsRuntime` factory and legacy global
    publication used by the shell;
  - wired `settings-runtime` to `nativeSource` in
    `scripts/frontend-shell-asset-graph.mjs`;
  - updated `test/vite-shell-asset-graph.test.js` native-count and native
    module contract assertions.
- Frontend build/readback:
  - `npm run --silent build:frontend` regenerated Vite shell artifacts;
  - `nativeEsmModuleCount` advanced from `34` to `35`;
  - `classicGlobalCompatibilityModuleCount` moved from `15` to `14`;
  - `settings-runtime` read back as `compatibilityMode=native-esm`;
  - client/cache remained
    `0.1.11|codex-mobile-shell-v625-cbb2ef9490a1`.
- Validation passed:
  - `node --check frontend/native/settings-runtime.mjs
    scripts/frontend-shell-asset-graph.mjs test/vite-shell-asset-graph.test.js`;
  - broader shell/render/runtime set -> `331/331`;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`;
  - targeted local dev browser startup gate against `127.0.0.1:8911`
    returned `ok=true`, app visible, runtime/loadThread/shell-refresh ready,
    exception count `0`.
- Deployment status:
  - source-only ESM slice; do not deploy until Owner approves.

## 2026-07-06T00:04:00+08:00 - ESM migration phase 4 media preview slice

- Goal context:
  - continued `docs/FRONTEND_ESM_MIGRATION_PLAN.md` in source/dev only;
  - no production deploy requested or performed.
- Source repair:
  - added native ESM module `frontend/native/media-preview-runtime.mjs`
    by mechanically removing the classic IIFE/CommonJS wrapper while
    preserving the `createMediaPreviewRuntime` factory and legacy
    `CodexMediaPreviewRuntime` global;
  - wired `media-preview-runtime` to `nativeSource` in
    `scripts/frontend-shell-asset-graph.mjs`;
  - updated `test/vite-shell-asset-graph.test.js` native-count and native
    module contract assertions.
- Frontend build/readback:
  - `npm run --silent build:frontend` regenerated Vite shell artifacts;
  - `nativeEsmModuleCount` advanced from `35` to `36`;
  - `classicGlobalCompatibilityModuleCount` moved from `14` to `13`;
  - `media-preview-runtime` read back as `compatibilityMode=native-esm`;
  - client/cache remained
    `0.1.11|codex-mobile-shell-v625-cbb2ef9490a1`.
- Validation passed:
  - `node --check frontend/native/media-preview-runtime.mjs
    scripts/frontend-shell-asset-graph.mjs test/vite-shell-asset-graph.test.js`;
  - focused shell/render/runtime set -> `301/301`;
  - broader shell/render/runtime set -> `331/331`;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`;
  - targeted local dev browser startup gate against `127.0.0.1:8912`
    returned `ok=true`, app visible, runtime/loadThread/shell-refresh ready,
    exception count `0`.
- Deployment status:
  - source-only ESM slice; do not deploy until Owner approves.

## 2026-07-06T00:06:00+08:00 - ESM migration phase 4 notification UI slice

- Goal context:
  - continued `docs/FRONTEND_ESM_MIGRATION_PLAN.md` in source/dev only;
  - no production deploy requested or performed.
- Source repair:
  - added native ESM module `frontend/native/notification-ui-runtime.mjs`
    by converting the existing top-level runtime plus expose wrapper into
    an ESM export while preserving legacy globals and
    `CodexNotificationUiRuntime`;
  - wired `notification-ui-runtime` to `nativeSource` in
    `scripts/frontend-shell-asset-graph.mjs`;
  - updated `test/vite-shell-asset-graph.test.js` native-count and native
    module contract assertions.
- Frontend build/readback:
  - `npm run --silent build:frontend` regenerated Vite shell artifacts;
  - `nativeEsmModuleCount` advanced from `36` to `37`;
  - `classicGlobalCompatibilityModuleCount` moved from `13` to `12`;
  - `notification-ui-runtime` read back as `compatibilityMode=native-esm`;
  - client/cache remained
    `0.1.11|codex-mobile-shell-v625-cbb2ef9490a1`.
- Validation passed:
  - `node --check frontend/native/notification-ui-runtime.mjs
    scripts/frontend-shell-asset-graph.mjs test/vite-shell-asset-graph.test.js`;
  - focused shell/render/runtime set -> `298/298`;
  - broader shell/render/runtime set -> `331/331`;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`;
  - targeted local dev browser startup gate against `127.0.0.1:8913`
    returned `ok=true`, app visible, runtime/loadThread/shell-refresh ready,
    exception count `0`.
- Deployment status:
  - source-only ESM slice; do not deploy until Owner approves.

## 2026-07-06T00:08:00+08:00 - ESM migration phase 4 thread tile runtime slice

- Goal context:
  - continued `docs/FRONTEND_ESM_MIGRATION_PLAN.md` in source/dev only;
  - no production deploy requested or performed.
- Source repair:
  - added native ESM module `frontend/native/thread-tile-runtime.mjs`
    by mechanically removing the classic IIFE/CommonJS wrapper while
    preserving the `createThreadTileRuntime` factory/deps boundary and
    `CodexThreadTileRuntime` global;
  - wired `thread-tile-runtime` to `nativeSource` in
    `scripts/frontend-shell-asset-graph.mjs`;
  - updated `test/vite-shell-asset-graph.test.js` native-count and native
    module contract assertions.
- Frontend build/readback:
  - `npm run --silent build:frontend` regenerated Vite shell artifacts;
  - `nativeEsmModuleCount` advanced from `37` to `38`;
  - `classicGlobalCompatibilityModuleCount` moved from `12` to `11`;
  - `thread-tile-runtime` read back as `compatibilityMode=native-esm`;
  - client/cache remained
    `0.1.11|codex-mobile-shell-v625-cbb2ef9490a1`.
- Validation passed:
  - `node --check frontend/native/thread-tile-runtime.mjs
    scripts/frontend-shell-asset-graph.mjs test/vite-shell-asset-graph.test.js`;
  - focused shell/render/runtime set -> `301/301`;
  - broader shell/render/runtime set -> `331/331`;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`;
  - targeted local dev browser startup gate against `127.0.0.1:8914`
    returned `ok=true`, app visible, runtime/loadThread/shell-refresh ready,
    exception count `0`.
- Deployment status:
  - source-only ESM slice; do not deploy until Owner approves.

## 2026-07-06T00:10:00+08:00 - ESM migration phase 4 navigation runtime slice

- Goal context:
  - continued `docs/FRONTEND_ESM_MIGRATION_PLAN.md` in source/dev only;
  - no production deploy requested or performed.
- Source repair:
  - added native ESM module `frontend/native/navigation-runtime.mjs`
    by converting the top-level navigation helper set plus expose wrapper
    into an ESM export while preserving legacy globals, approval helper
    globals, and `CodexNavigationRuntime`;
  - wired `navigation-runtime` to `nativeSource` in
    `scripts/frontend-shell-asset-graph.mjs`;
  - updated `test/vite-shell-asset-graph.test.js` native-count and native
    module contract assertions.
- Frontend build/readback:
  - `npm run --silent build:frontend` regenerated Vite shell artifacts;
  - `nativeEsmModuleCount` advanced from `38` to `39`;
  - `classicGlobalCompatibilityModuleCount` moved from `11` to `10`;
  - `navigation-runtime` read back as `compatibilityMode=native-esm`;
  - client/cache remained
    `0.1.11|codex-mobile-shell-v625-cbb2ef9490a1`.
- Validation passed:
  - `node --check frontend/native/navigation-runtime.mjs
    scripts/frontend-shell-asset-graph.mjs test/vite-shell-asset-graph.test.js`;
  - focused shell/render/runtime/action set -> `307/307`;
  - broader shell/render/runtime/action set -> `337/337`;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`;
  - targeted local dev browser startup gate against `127.0.0.1:8915`
    returned `ok=true`, app visible, runtime/loadThread/shell-refresh ready,
    exception count `0`.
- Deployment status:
  - source-only ESM slice; do not deploy until Owner approves.

## 2026-07-06T00:12:00+08:00 - ESM migration phase 4 app shell runtime slice

- Goal context:
  - continued `docs/FRONTEND_ESM_MIGRATION_PLAN.md` in source/dev only;
  - no production deploy requested or performed.
- Source repair:
  - added native ESM module `frontend/native/app-shell-runtime.mjs`
    by converting the app shell expose wrapper into an ESM export while
    preserving `CodexAppShellRuntime`;
  - wired `app-shell-runtime` to `nativeSource` in
    `scripts/frontend-shell-asset-graph.mjs`;
  - updated `test/vite-shell-asset-graph.test.js` native-count and native
    module contract assertions.
- Frontend build/readback:
  - `npm run --silent build:frontend` regenerated Vite shell artifacts;
  - `nativeEsmModuleCount` advanced from `39` to `40`;
  - `classicGlobalCompatibilityModuleCount` moved from `10` to `9`;
  - `app-shell-runtime` read back as `compatibilityMode=native-esm`;
  - client/cache remained
    `0.1.11|codex-mobile-shell-v625-cbb2ef9490a1`.
- Validation passed:
  - `node --check frontend/native/app-shell-runtime.mjs
    scripts/frontend-shell-asset-graph.mjs test/vite-shell-asset-graph.test.js`;
  - focused shell/render/runtime set -> `301/301`;
  - broader shell/render/runtime set -> `331/331`;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`;
  - targeted local dev browser startup gate against `127.0.0.1:8916`
    returned `ok=true`, app visible, runtime/loadThread/shell-refresh ready,
    exception count `0`.
- Deployment status:
  - source-only ESM slice; do not deploy until Owner approves.

## 2026-07-06T00:30:00+08:00 - ESM migration phase 4 event stream runtime slice

- Goal context:
  - continued `docs/FRONTEND_ESM_MIGRATION_PLAN.md` in source/dev only;
  - no production deploy requested or performed.
- Source repair:
  - added native ESM module `frontend/native/event-stream-runtime.mjs`
    by converting the event stream expose wrapper into an ESM export while
    preserving legacy globals and `CodexEventStreamRuntime`;
  - wired `event-stream-runtime` to `nativeSource` in
    `scripts/frontend-shell-asset-graph.mjs`;
  - updated `test/vite-shell-asset-graph.test.js` native-count and native
    module contract assertions.
- Frontend build/readback:
  - `npm run --silent build:frontend` regenerated Vite shell artifacts;
  - `nativeEsmModuleCount` advanced to `48`;
  - `classicGlobalCompatibilityModuleCount` moved to `1`;
  - remaining classic compatibility module: `thread-detail-runtime`;
  - `event-stream-runtime` read back as `compatibilityMode=native-esm`;
  - client/cache remained
    `0.1.11|codex-mobile-shell-v625-cbb2ef9490a1`.
- Validation passed:
  - `node --check frontend/native/event-stream-runtime.mjs
    scripts/frontend-shell-asset-graph.mjs test/vite-shell-asset-graph.test.js`;
  - focused shell/render/runtime set -> `316/316`;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`;
  - targeted local dev browser startup gate against `127.0.0.1:8924`
    returned `ok=true`, app visible, runtime/loadThread/shell-refresh ready,
    exception count `0`.
- Deployment status:
  - source-only ESM slice; do not deploy until Owner approves.

## 2026-07-06T00:35:00+08:00 - ESM migration phase 4 complete native runtime slice

- Goal context:
  - completed the source/dev native ESM migration target from
    `docs/FRONTEND_ESM_MIGRATION_PLAN.md`;
  - no production deploy requested or performed.
- Source repair:
  - added native ESM module `frontend/native/thread-detail-runtime.mjs`
    by converting the last remaining classic compatibility runtime into an
    ESM export while preserving `CodexThreadDetailRuntime`;
  - wired `thread-detail-runtime` to `nativeSource` in
    `scripts/frontend-shell-asset-graph.mjs`;
  - updated `test/vite-shell-asset-graph.test.js` native-count and native
    module contract assertions.
- Frontend build/readback:
  - `npm run --silent build:frontend` regenerated Vite shell artifacts;
  - `nativeEsmModuleCount` is now `49`;
  - `classicGlobalCompatibilityModuleCount` is now `0`;
  - `classicModules=[]`;
  - app-preview classic loader script count is `0`;
  - client/cache remained
    `0.1.11|codex-mobile-shell-v625-cbb2ef9490a1`.
- Validation passed:
  - `node --check frontend/native/thread-detail-runtime.mjs
    scripts/frontend-shell-asset-graph.mjs test/vite-shell-asset-graph.test.js`;
  - focused shell/render/runtime set -> `316/316`;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`;
  - targeted local dev browser startup gate against `127.0.0.1:8925`
    returned `ok=true`, app visible, runtime/loadThread/shell-refresh ready,
    exception count `0`.
- Validation gap:
  - a local full deploy-mode behavior gate with controlled submit thread
    `019f307c-56fb-7261-a584-2636051ee724` was started against
    `127.0.0.1:8925`, but produced no terminal JSON within about `120s`;
    the process was stopped and the local server was cleaned up.
- Deployment status:
  - source-only ESM completion; do not deploy until Owner approves and the
    behavior-gate execution path is either proven or separately repaired.

## 2026-07-06T00:45:00+08:00 - ESM migration full behavior gate repair

- Goal context:
  - completion audit found the source-side ESM migration was structurally
    complete (`49` native ESM modules, `0` classic compatibility modules), but
    the local full deploy-mode behavior gate initially failed on
    `/vite-shell/preview.html`.
- Root cause:
  - `frontend/native/app-entry.mjs` auto-started the full app when imported by
    the Vite preview artifact page;
  - `/vite-shell/preview.html` is an artifact/contract probe page, not an app
    runtime page, so auto-start entered runtime wiring without classic global
    script bindings and rejected ESM compatibility with
    `threadDetailRuntime is not defined`.
- Source repair:
  - guarded native app-entry auto-start against the
    `codex-vite-shell-preview` marker while preserving explicit manual start
    and app-preview controlled startup;
  - added focused regression coverage in `test/app-entry-ui.test.js`;
  - regenerated Vite shell artifacts.
- Frontend build/readback:
  - `nativeEsmModuleCount=49`;
  - `classicGlobalCompatibilityModuleCount=0`;
  - `classicModules=[]`;
  - app-preview classic loader script count `0`;
  - `productionExecution` remains `classic-script-fallback` as required by the
    current migration plan until Owner-approved deploy/release.
- Validation passed:
  - `node --test test/app-entry-ui.test.js` -> `4/4`;
  - `npm run --silent build:frontend`;
  - `/vite-shell/preview.html` browser probe returned `ok=true`,
    `esmCompatibilityModuleCount=49`, `esmCompatibilityReadyCount=49`;
  - full local deploy-mode runtime self-check against `127.0.0.1:8926` with
    controlled submit thread `019f307c-56fb-7261-a584-2636051ee724` returned
    `ok=true`, `deployPass=true`, `blockingIssueCount=0`,
    `actionableIssueCodes=[]`;
  - focused shell/render/runtime/artifact set -> `335/335`;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`.
- Cleanup:
  - local `8926` dev server stopped;
  - no local 8926 self-check/browser process remained after cleanup.
- Deployment status:
  - source-only repair; production deploy still requires explicit Owner
    approval.

## 2026-07-06T01:10:00+08:00 - Public PR triage #83/#84/#85

- Scope:
  - read-only triage of public repo open PRs; no source merge/cherry-pick,
    no production deploy.
- Open PRs found:
  - public PR #83 `fix-all-workspaces-session-pruning`
    (`fix: keep all workspace sessions visible`);
  - public PR #84 `fix-refresh-prompt-loop`
    (`fix: stop stale page refresh prompts`);
  - public PR #85 `fix-stale-running-spinner`
    (`fix: clear stale running spinner hints`).
- Shared finding:
  - all three PRs are based on older public base `3e38466b` and each carries
    old regenerated Vite/PWA artifacts, producing about 63k-line artifact
    diffs against the current ESM source line;
  - public CI for each PR reports `Node checks` failure / unstable merge
    state;
  - none of the three PR commit hashes are contained in current private
    `main`.
- Current source comparison:
  - #83 core behavior is not covered: current thread-list runtime still
    filters All Workspaces threads by the local workspace registry, and
    `/api/workspaces` does not merge token-usage workspace cwds;
  - #84 core behavior is not covered: current app-update runtime lacks
    loaded-client build acceptance for stale refresh prompts;
  - #85 core behavior is not covered: current status-hints policy still keeps
    idle/no-terminal running hints before checking fresh submitted-processing
    evidence.
- Recommendation:
  - do not GitHub-merge these PRs directly;
  - absorb the three small business patches into the current ESM source
    structure, including native modules plus classic fallback where applicable,
    then regenerate current artifacts and close the public PRs as superseded
    after equivalent source commits exist.

## 2026-07-06T08:00:00+08:00 - Absorbed public PR #83/#84/#85 into current ESM main

- Scope:
  - source-only absorption of the three public PR business patches;
  - no production deploy was requested or performed;
  - GitHub PRs were not closed in this step.
- Absorbed behavior:
  - PR #83: `/api/workspaces` now reconciles `listWorkspaces()` rows with
    shared token-usage workspace cwd snapshots, and All Workspaces no longer
    hides server-visible threads just because the local workspace registry is
    stale;
  - PR #84: page refresh checks now accept the actually loaded
    `CLIENT_BUILD_ID` when it already matches server public config, clearing
    stale "New version available" loops instead of re-prompting;
  - PR #85: idle/no-terminal running hints are kept only with fresh local
    submitted-processing evidence, otherwise stale list spinners are cleared.
- Files changed:
  - server route wiring: `server-routes/api-dispatch-route-service.js`,
    `server-routes/workspace-route-service.js`;
  - ESM/classic runtime pairs:
    `frontend/native/thread-list-runtime.mjs`, `public/thread-list-runtime.js`,
    `frontend/native/app-update-runtime.mjs`, `public/app-update-runtime.js`,
    `frontend/native/thread-status-hints.mjs`, `public/thread-status-hints.js`;
  - regression tests:
    `test/api-route-boundary-service.test.js`,
    `test/thread-list-runtime-ui.test.js`, `test/app-update.test.js`,
    `test/thread-status-hints.test.js`;
  - regenerated current Vite/PWA artifacts under `public/shell-asset-manifest*`
    and `public/vite-shell/*`.
- Build/readback:
  - `npm run --silent build:frontend` succeeded;
  - new client/cache:
    `0.1.11|codex-mobile-shell-v625-8aa93b62b26b`;
  - `productionExecution` remains `classic-script-fallback`;
  - app-preview classic loader script count remains `0`;
  - published Vite shell files: `23`.
- Validation passed:
  - focused PR behavior set:
    `node --test test/api-route-boundary-service.test.js
    test/thread-list-runtime-ui.test.js test/app-update.test.js
    test/build-refresh-policy.test.js test/client-render-stability-guard.test.js
    test/thread-status-hints.test.js` -> `47/47`;
  - shell/runtime/artifact set:
    `node --test test/vite-shell-artifact-service.test.js
    test/vite-shell-asset-graph.test.js
    test/browser-runtime-self-check-service.test.js
    test/runtime-self-check-loop.test.js` -> `147/147`;
  - `npm run --silent check:frontend-manifest`;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`.
- Residual:
  - production deploy still requires explicit Owner approval;
  - public PRs #83/#84/#85 can be closed as superseded only after this source
    absorption is committed/published according to the release order rule.

## 2026-07-06T08:29:00+08:00 - Native ESM production switch validated locally

- Owner approved production switching after the ESM migration.
- Source switch:
  - production shell execution contract changed from
    `classic-script-fallback` to `vite-app-preview-native-esm`;
  - classic public files are retained as rollback/fallback artifacts, but
    app-preview production execution now expects native ESM compatibility;
  - generated Vite readback/artifacts now report
    `productionExecution=vite-app-preview-native-esm`.
- Harness hardening:
  - browser self-check now includes bounded `notReadyModuleIds` and
    `notReadyModules` fields on ESM compatibility failures;
  - root cause found by the new evidence path was an outdated
    `thread-status-hints` compatibility sample: exports/global publication were
    correct, but the sample expected idle/no-terminal running hints to expire,
    which conflicts with the current status-hints policy;
  - compatibility sample now uses the stable stale-active expiration semantic.
- Build/readback:
  - `npm run --silent build:frontend` succeeded;
  - client/cache remains `0.1.11|codex-mobile-shell-v625-8aa93b62b26b`;
  - app-preview loader script count remains `0`;
  - ESM compatibility module count is `49`, ready count `49`;
  - published Vite shell files: `23`.
- Local browser validation:
  - `node scripts/codex-mobile-browser-runtime-self-check.js --server
    http://127.0.0.1:8927 --vite-app-preview-only --json` -> `ok=true`,
    `49/49`;
  - `node scripts/codex-mobile-browser-runtime-self-check.js --server
    http://127.0.0.1:8927 --vite-preview-only --json` -> `ok=true`,
    `49/49`;
  - full deploy-mode behavior gate with controlled submit thread
    `019f307c-56fb-7261-a584-2636051ee724` -> `deployPass=true`,
    actionable issue codes `[]`;
  - remaining findings were H3/advisory only:
    `active_codex_app_server_rss_elevated`,
    `codex_mobile_mcp_child_accumulation_elevated`, and active-progressive
    latest-turn consolidation advisories.
- Validation passed:
  - `node --test test/browser-runtime-self-check-service.test.js
    test/vite-shell-asset-graph.test.js test/vite-shell-artifact-service.test.js
    test/runtime-self-check-loop.test.js` -> `147/147`;
  - `npm run --silent check:frontend-manifest`;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`.
- Next step:
  - commit native ESM production switch and delegate central production deploy
    to the Codex Mobile deploy lane with full behavior gate and controlled
    submit enabled.

## 2026-07-06T09:05:00+08:00 - Submitted user duplicate echo root-cause fix validated locally

- User-visible symptom:
  - current ESM build could still show two visible user messages after submit,
    especially after thread navigation/refresh; recent client events showed
    `conversation_patch_html_fallback` with
    `reason=post-apply-duplicate-user-messages`.
- Root cause / owning layer:
  - browser/local pending echo reconciliation did not treat durable server
    user-message `clientId` as the same submission identity as the local
    `clientSubmissionId` / `local-user-*` echo;
  - the server/API detail path could contain a single durable user message
    while the browser merge/render layer kept a stale local echo, so the
    duplicate belonged to the client projection/echo ownership boundary.
- Source changes:
  - expanded submitted-message identity candidates in native/classic
    `thread-detail-runtime` and `thread-detail-state`;
  - updated `thread-user-message-echo-normalizer-service` to compare
    candidate identity sets, not only `clientSubmissionId`;
  - added client build id to conversation patch fallback client events;
  - made deploy-mode client-event self-check ignore pre-gate fallback events
    and report bounded fallback reason/build metadata for post-gate events.
- Build/readback:
  - `npm run --silent build:frontend` succeeded;
  - client/cache `0.1.11|codex-mobile-shell-v625-6d031619209f`;
  - `productionExecution=vite-app-preview-native-esm`;
  - native ESM ready modules `49/49`, classic compatibility modules `0`;
  - app-preview classic loader script count `0`.
- Validation passed:
  - focused/browser/runtime test set:
    `node --test test/conversation-render.test.js
    test/thread-user-message-echo-normalizer-service.test.js
    test/thread-detail-v4-merge-state.test.js
    test/thread-detail-dom-patch.test.js
    test/client-event-stall-self-check-service.test.js
    test/browser-runtime-self-check-service.test.js
    test/runtime-self-check-loop.test.js
    test/vite-shell-artifact-service.test.js
    test/vite-shell-asset-graph.test.js` -> `416/416`;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`;
  - `npm run --silent check:frontend-manifest`;
  - local full behavior gate on `127.0.0.1:8927` with controlled submit
    thread `019f307c-56fb-7261-a584-2636051ee724` -> `deployPass=true`,
    blocking/actionable issue codes `[]`;
  - same gate reported current-window
    `conversationPatchFallbackEventCount=0`; two older fallback events were
    outside the gate window and ignored by the hardened self-check.
- Residual:
  - production deploy still must be delegated through the central Codex Mobile
    deploy lane before Public readiness can be claimed;
  - process-pressure advisories remain separate H3 items:
    `active_codex_app_server_rss_elevated` and
    `codex_mobile_mcp_child_accumulation_elevated`.

## 2026-07-06T09:18:00+08:00 - Follow-up for native ESM artifact missing deploy blocker

- Deploy lane return for `aab5862a`:
  - production synced/restarted, focused production tests passed, but central
    listener startup gate failed before full behavior gate;
  - blocking root code included `vite_artifact_file_missing`, which cascaded
    into Vite app-preview/browser visibility startup failures.
- Root cause:
  - source commit accidentally omitted two current `publishedFiles` assets
    from Git after a manual stale-hash cleanup:
    `assets/app-bootstrap-CcMgmjtV.js` and
    `assets/vite-deferred-entry-topology-DAKQEs19.js`;
  - local HTML direct-reference checks were insufficient because
    `vite-shell-readback.json.publishedFiles` is the authoritative deploy
    artifact contract.
- Fix:
  - reran `npm run --silent build:frontend`, restoring the two missing
    published assets and updating retained artifact readback;
  - added a regression test in `test/vite-shell-artifact-service.test.js`
    that checks the checked-in public Vite readback status and fails if any
    `publishedFiles` entry is missing or mismatched.
- Validation passed:
  - `node --test test/vite-shell-artifact-service.test.js
    test/vite-shell-asset-graph.test.js` -> `38/38`;
  - focused duplicate-echo/browser/runtime/Vite set -> `417/417`;
  - `npm run --silent check:frontend-manifest`;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`;
  - local startup-only deploy gate on `127.0.0.1:8927` ->
    `deployPass=true`, blocking/actionable issue codes `[]`.
- Next step:
  - commit the artifact follow-up and redelegate central production deploy for
    the follow-up ref; Public remains blocked until central full behavior gate
    passes.

## 2026-07-06T09:38:00+08:00 - Browser behavior gate latest completed-tail stability fix

- Deploy lane return for `7ff587d1`:
  - native ESM artifact/startup blocker was cleared in production;
  - full behavior gate still failed only on
    `browser_latest_turn_usage_missing`.
- Reproduction / bounded evidence:
  - reran full deploy-mode behavior gate against production `127.0.0.1:8787`
    with controlled submit thread `019f307c-56fb-7261-a584-2636051ee724`;
  - failing sample was a single dynamic submit catch-up window around
    `submit-post-1600`;
  - API latest turn was completed and expected completed tail usage, while DOM
    had already kept the submitted user message and assistant content but had
    not yet merged the completed tail/usage;
  - per-turn mismatch logic already treated the one-off dynamic gap as H3, but
    latest-turn aggregate usage/item logic still emitted H2.
- Root cause / owning layer:
  - browser behavior harness severity policy was inconsistent between
    per-turn and latest-turn aggregate checks for dynamic thread plans;
  - this was a self-check classification bug, not a duplicate user-message
    rendering regression in the observed sample.
- Fix:
  - `browser_latest_turn_usage_missing` now uses the same observation-counted
    latest-turn severity path as latest item/user checks;
  - dynamic latest aggregate gaps are H3 for one observation and H2 only when
    repeated/stable;
  - latest usage issue details now include bounded turn-shape metadata.
- Validation passed:
  - `node --test test/browser-runtime-self-check-service.test.js
    test/runtime-self-check-loop.test.js` -> `112/112`;
  - focused browser/ESM/echo/render/Vite set -> `307/307`;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`;
  - full deploy-mode behavior gate against production using the fixed local
    harness -> `ok=true`, `deployPass=true`, `blockingIssueCount=0`,
    `executionFailureCount=0`, `actionableIssueCodes=[]`;
  - the former latest usage/item gap remained H3-only advisory with
    `observationCount=1`.
- Next step:
  - commit this harness fix and delegate central production deploy; Public
    readiness still requires central deploy/readback to pass after production
    sync.

## 2026-07-06T09:47:00+08:00 - Public publish completed for native ESM / stability line

- Production readiness source:
  - deploy lane returned `completed` for `e4855d8c6a43`;
  - central deploy `ok=true`;
  - startup gate and full behavior gate passed with `blockingIssueCount=0`,
    `executionFailureCount=0`, and `actionableIssueCodes=[]`;
  - duplicate/disappearing submitted-message blockers,
    `browser_conversation_patch_fallback`, artifact/startup blockers,
    `thread_detail_refresh_lost_user_input`, `duplicate_item_ids`, and
    `thread_detail_empty` were absent from blocking/actionable results.
- Public push:
  - pushed local `main` to `public/main`;
  - public remote advanced `3e38466b..e4855d8c`;
  - public readback confirmed `refs/heads/main` =
    `e4855d8c6a43da9bc6d815d712259f1dceb83f45`;
  - after fetching public, `git diff --name-only public/main..HEAD --
    ':!.agent-context' | wc -l` returned `0`.
- Release contents:
  - includes native ESM production shell switch, current Vite shell artifacts,
    absorbed public PR #83/#84/#85 business fixes, submitted echo duplicate
    repairs, native ESM artifact follow-up, and the latest behavior-gate
    usage self-check stabilization.
- Local state:
  - `.agent-context/HANDOFF.md` remains local private context and is not part
    of the public diff.

## 2026-07-06 submitted echo duplicate root-cause fix

- Context: user screenshot showed a stale duplicate green `You` card at the bottom after the durable completed turn had already rendered the same user message and assistant receipt. API thread self-check and fresh browser self-check were clean, indicating a long-lived client local submitted-echo state defect rather than server/detail duplication.
- Root cause: `reconcileSubmittedUserMessageTurn` transfers submission identity to the durable server turn via `mobileLocalSubmissionRenderKey`, but cross-turn optimistic echo cleanup only treated item-level submission ids as authoritative. When server projection omitted the item-level client submission id, a later stale local pending echo was preserved as a possible genuine repeated send.
- Fix: `optimisticEchoCanMatchEarlierDurable` now also recognizes a durable turn's submitted render identity and drops the matching local pending echo only when the render key corresponds to the local `clientSubmissionId` and the user message content still matches. The existing repeated-send protection remains covered.
- Changed source surfaces: `frontend/native/thread-detail-runtime.mjs`, `public/thread-detail-runtime.js`, generated Vite/native ESM shell artifacts, and `test/conversation-render.test.js`.
- New regression: `cross-turn normalization drops local pending echo after completed durable turn keeps submitted render identity` covers the screenshot class while `cross-turn normalization keeps nearby repeated send after completed durable turn` continues to pass.
- Validation: `node --test test/conversation-render.test.js`; `node --test test/thread-detail-v4-merge-state.test.js test/thread-user-message-echo-normalizer-service.test.js test/browser-runtime-self-check-service.test.js test/runtime-self-check-loop.test.js`; `npm run --silent build:frontend`; `node --test test/conversation-render.test.js test/thread-detail-v4-merge-state.test.js test/thread-user-message-echo-normalizer-service.test.js test/browser-runtime-self-check-service.test.js test/runtime-self-check-loop.test.js test/vite-shell-artifact-service.test.js test/vite-shell-asset-graph.test.js` (345 pass); `npm run --silent check`; `git diff --check -- ':!.agent-context'`; `node scripts/verify-vite-shell-manifest.mjs`.
- Deploy status: source validated locally only at this point; deploy lane handoff still required before production/public readiness.

## 2026-07-06 submitted echo turn-identity hotfix public push

- Production deploy receipt: ref `22b006582d7aea75baf8c9b0a3ffaa236192494f` deployed by central Codex Mobile lane; startup gate and full behavior gate passed; controlled submit configured; duplicate/disappearing submitted-message blockers absent; focused production tests `345/345` passed.
- Public push: `git push public main:main` advanced `public/main` from `e4855d8c6a43d` to `22b006582d7a`.
- Public readback: `git ls-remote public refs/heads/main`, `git rev-parse public/main`, and local `git rev-parse HEAD` all returned `22b006582d7aea75baf8c9b0a3ffaa236192494f`.
- Diff readback: `git diff --name-only public/main..HEAD -- ':!.agent-context'` returned no files.
- Remaining local state: `.agent-context/HANDOFF.md` contains local operational notes only.

## 2026-07-06T12:45:00+08:00 - Owner Console stale at-loop projection deployed, duplicate echo follow-up in source

- Owner Console / at-loop task:
  - source commit `e8b568739a97` (`fix: classify terminal at-loop residuals`) added
    metadata-only `statusProjection` for terminal/rejected loops and role slices;
  - production deploy lane synced the ref and focused production tests passed
    `69/69`;
  - production `/api/at-loop/status` readback showed `loopCount=5`,
    `activeLoopCount=0`, `activeBlockedCount=0`,
    `activeWaitingReturnCount=0`, `terminalLoopCount=5`, and
    `terminalResidualRoleSliceCount=5`;
  - target stale loop `loop_e5148ad7ed0b6fae` remained raw `rejected` with
    `blockedReason=at_loop_dispatch_failed`, but projected
    `terminal=true`, `active=false`, `activeBlocked=false`,
    `nonBlockingReason=loop_terminal_rejected`;
  - deploy lane returned `partially_completed` because the unrelated browser
    behavior gate still reported duplicate/downgrade issues.
- Duplicate submitted user-message follow-up:
  - user screenshot still showed a duplicated green `You` bubble after the
    durable completed turn had already rendered the same message;
  - bounded API detail for `Home AI 07-05`
    (`019f316b-27cd-7622-9944-0b909fec3c70`) showed no durable duplicate
    user-message events, confirming this remains a long-lived client local
    echo/projection issue rather than a server double-write;
  - new source fix narrows cleanup to local pending submission echoes whose
    text matches an earlier durable completed turn and whose local timestamp is
    settled by that turn's completed/updated timestamp;
  - repeated same-text sends remain protected when they have a distinct
    submission and no settled timestamp evidence, or when they start after the
    completed durable turn.
- Changed duplicate-echo surfaces:
  - `frontend/native/thread-detail-runtime.mjs`;
  - `public/thread-detail-runtime.js`;
  - generated Vite shell artifacts/readback;
  - `test/conversation-render.test.js`.
- Development validation passed:
  - `node --test test/conversation-render.test.js` -> `170/170`;
  - focused browser/echo/V4/Vite set -> `347/347`;
  - `npm run --silent build:frontend`;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`;
  - central fallback governance script from Home AI app -> `ok=true`.
- Next step: commit the duplicate-echo follow-up and send a central Codex
  Mobile deploy card; production/Public readiness depends on the central
  startup and full behavior gate passing with controlled submit.

## 2026-07-06T12:38Z - completed submitted echo follow-up deployed; behavior gate settled green

- Source commit `95ab4c418a83` (`fix: settle completed submitted echoes`)
  was committed and handed to the central Codex Mobile deploy lane.
- Production sync/readback succeeded:
  - listener stayed on single `*:8787`;
  - `/api/public-config` returned client/cache
    `0.1.11|codex-mobile-shell-v625-f1ced9d3357c`;
  - `/api/status?detail=1` returned `ready=true` with issue codes `[]`;
  - `/api/vite-shell-artifact` returned `ok=true`, native ESM execution, and
    `49/49` native ESM modules.
- Deploy lane parity/tests:
  - source/prod SHA parity matched `28/28` changed files;
  - focused production tests passed `347/347`.
- First central full behavior gate after sync returned nonzero with latest-turn
  assistant/user/usage blockers. A later independent full deploy-mode gate with
  controlled submit thread `019f307c-56fb-7261-a584-2636051ee724` passed:
  - `deployPass=true`;
  - `blockingIssueCount=0`;
  - `executionFailureCount=0`;
  - `actionableIssueCodes=[]`.
- Follow-up narrow thread self-checks were clean for:
  - controlled submit thread `019f307c-56fb-7261-a584-2636051ee724`;
  - Codex Mobile deploy lane `019f16e6-9131-79e2-9b6b-ad41f7e65d92`;
  - Home AI 07-05 `019f316b-27cd-7622-9944-0b909fec3c70`.
- Remaining observations were advisory only:
  - `active_codex_app_server_rss_elevated`;
  - `codex_mobile_mcp_child_accumulation_elevated`;
  - transient `browser_dom_sparse_after_nonempty`.
- Closure interpretation: the duplicate submitted echo root-cause fix is live,
  and the production behavior gate is green after the post-deploy projection
  window settled. A clean central deploy rerun can be used for final Public
  release evidence if required by release policy.
- Public push:
  - pushed `main` to `public/main`;
  - public remote advanced `22b00658..95ab4c41`;
  - `git ls-remote public refs/heads/main` returned
    `95ab4c418a83414ff0a349849edb8db368ea495f`;
  - after `git fetch public main`, local `HEAD` and `public/main` both resolved
    to `95ab4c418a83414ff0a349849edb8db368ea495f`;
  - `git diff --name-only public/main..HEAD -- ':!.agent-context'` returned no
    files.

## 2026-07-06T14:36Z - submitted echo ordering root cause isolated in development

- Owner-reported duplicate bottom user bubbles were reproduced with the
  browser behavior harness using controlled repeat submit. The failing window:
  API expected latest turn item order `userMessage -> agentMessage ->
  userMessage`, while DOM temporarily rendered `userMessage -> userMessage ->
  agentMessage` before a later projection corrected it.
- Root cause: V4 pending overlay insertion still anchored unresolved submitted
  user echoes before the first non-user item. For follow-up/interruption submits
  after assistant progress already exists, that rule places the local echo above
  the assistant receipt and creates the visual duplicate/order inversion.
- Source fix in progress:
  - `frontend/native/thread-detail-v4-merge-state.mjs` and
    `public/thread-detail-v4-merge-state.js` now insert pending overlay items
    by item timestamp when available, appending when no reliable timestamp is
    present.
  - `scripts/codex-mobile-browser-runtime-self-check.js` now supports bounded
    repeat-submit diagnostics and item-kind sequence samples.
  - `services/runtime/browser-runtime-self-check-service.js` now reports
    `browser_turn_user_message_order_mismatch` when DOM/API user-after-assistant
    order counts diverge.
- Validation passed so far:
  - `node --check` for changed runtime/harness/test files;
  - `node --test test/thread-detail-v4-merge-state.test.js
    test/browser-runtime-self-check-service.test.js
    test/vite-shell-artifact-service.test.js
    test/vite-shell-asset-graph.test.js` -> `148/148`;
  - `node --test test/conversation-render.test.js
    test/thread-detail-v4-merge-state.test.js
    test/browser-runtime-self-check-service.test.js
    test/runtime-self-check-loop.test.js
    test/vite-shell-artifact-service.test.js
    test/vite-shell-asset-graph.test.js` -> `334/334`;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`.
- Next step: commit source fix and delegate a central Codex Mobile deploy with
  post-deploy repeat-submit browser verification before any Public push.

## 2026-07-06T15:00Z - repeat-submit delayed window fixed; immediate sample gate refined

- Central deploy/readback for `1c012cda6f6e` confirmed production served
  client/cache `0.1.11|codex-mobile-shell-v625-32fd5edc0dca`, artifact/readiness
  were green, parity matched, and focused production tests passed.
- The deploy lane still returned partial because the full behavior gate saw
  `browser_turn_user_message_order_mismatch`.
- A bounded production rerun with repeat submit showed the delayed observable
  windows were actually correct:
  - `submit-post-900` and `submit-post-1600` expected and DOM sequences both
    matched `userMessage -> agentMessage -> userMessage`;
  - `submit-post-2800` and `submit-post-6000` expected and DOM sequences both
    matched `userMessage -> agentMessage -> userMessage -> agentMessage ->
    turnUsageSummary`;
  - user duplicate counters stayed `0` in delayed samples.
- The remaining mismatch was at `submit-after-2` with `delayMs=0`, immediately
  after the second submit completed and before the delayed/API refresh window.
  That is useful diagnostic metadata but should not block release.
- Committed `d8a5ae2342c2` (`fix: keep immediate submit order samples
  diagnostic`) to keep `delayMs=0` submit-order divergences diagnostic-only
  while preserving H2 blocking for any delayed sample (`delayMs > 0`).
- Validation for `d8a5ae23` passed:
  - `node --check services/runtime/browser-runtime-self-check-service.js
    test/browser-runtime-self-check-service.test.js`;
  - `node --test test/browser-runtime-self-check-service.test.js
    test/runtime-self-check-loop.test.js` -> `115/115`;
  - wider behavior/Vite set -> `335/335`;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`.
- Delegated deploy card `ttc_0df6a5d035f848d1b4` to Codex Mobile Deploy Lane
  for central deploy/readback of `d8a5ae23`. Public push remains blocked until
  that deploy/readback returns green.

## 2026-07-06T14:25Z - duplicate submitted user message root-cause fix ready for deploy

- Owner re-reported duplicate submitted user bubbles after `2201667e` failed
  production behavior acceptance. Current work stayed in
  `/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web`.
- Root cause was split across two browser-owned layers:
  - visible-item refresh patch could keep stale duplicate render-key nodes and
    patch user-message shape changes instead of replacing the visible turn;
  - local-only submitted user echoes were reinserted by previous array index
    instead of timestamp, so repeat submits after assistant progress could
    briefly render in the wrong position.
- Source changes now:
  - reject visible-item patch when user-message shape changes;
  - remove unexpected/extra duplicate visible-item DOM nodes before validating
    refresh patch order;
  - anchor local pending submitted user echoes by timestamp relative to
    timestamped assistant/user items during merge;
  - treat a submit-post DOM tail that only contains extra local pending user
    messages as API catch-up, not an order mismatch, while preserving true
    duplicate/order disappearance checks.
- Frontend artifacts rebuilt with native ESM readback:
  `0.1.11|codex-mobile-shell-v625-6b37193bc613`,
  `productionExecution=vite-app-preview-native-esm`,
  `nativeEsmModuleCount=49`, published file count `23`.
- Local dev browser validation:
  - dev server `127.0.0.1:8898`;
  - startup-only runtime gate passed with no blocking/actionable codes;
  - fresh fixture `019f3619-a9a7-71f0-90a6-5b2fa50d5bbb`;
  - repeat submit attempted/success `2/2`;
  - browser behavior result `ok=true`, `browserReport.ok=true`, issue count
    `0`; no order, pending disappearance, duplicate, thread-empty, or patch
    fallback codes.
- Validation passed:
  - focused behavior/artifact tests `338/338`;
  - earlier broader behavior set `354/354`;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`.
- Next step: commit and delegate central production deploy/readback. Public push
  remains blocked until the deploy lane full behavior gate passes.

## 2026-07-06T06:55Z - submitted user duplicate false-positive identity fix

- Owner re-reported duplicate user bubbles on V625 after the prior
  submitted-user echo ordering deploy still failed with
  `browser_conversation_patch_fallback` / `post-apply-duplicate-user-messages`.
- Bounded production readback showed current served cache before this fix was
  `0.1.11|codex-mobile-shell-v625-6b37193bc613`; a read-only current-thread
  browser sample did not find a stable duplicate at rest, so the failure is a
  timing/window issue rather than persistent dirty thread state.
- Root cause identified in the browser shape identity contract:
  same-submission user messages were counted by `data-client-submission-hash`
  alone. Active turns can contain distinct durable user entries with the same
  submission diagnostic hash but different text identity, so DOM/API duplicate
  comparison could falsely trigger `post-apply-duplicate-user-messages` and
  force a patch fallback.
- Source changes:
  - `frontend/native/api-client-runtime.mjs` and `public/api-client-runtime.js`
    now use `submission + text` for user-message event duplicate signatures
    when both are present, preserving duplicate detection for same submission
    and same text;
  - `scripts/codex-mobile-browser-runtime-self-check.js` uses the same
    submission/text identity for bounded all-user event duplicate diagnostics;
  - `test/conversation-render.test.js` and
    `test/browser-runtime-self-check-service.test.js` cover the regression.
- Frontend rebuilt with client/cache
  `0.1.11|codex-mobile-shell-v625-17fc0ceb8cf6`,
  native ESM production execution, and published file count `23`.
- Validation passed:
  - focused same-submission/browser snapshot set passed;
  - broader behavior/artifact set `416/416` passed;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`.
- Local dev server `127.0.0.1:8899` startup-only gate passed. A local
  repeat-submit fixture still hit `composer_disabled` on the second immediate
  submit and is not used as acceptance evidence.
- Next step: commit and delegate central production deploy/readback with full
  behavior gate and controlled submit. Public push remains blocked until the
  Deploy Lane returns green.

## 2026-07-06T10:05Z - frontend diagnostic hot-refresh and visible client hash

- Owner reproduced the submitted-user duplicate window again: a just-sent user
  message could render twice immediately, then collapse to one after sending a
  later message. Current evidence still points to a browser reconciliation
  window between local submitted echo and durable/projection user item, not a
  server-side double POST.
- Bounded live log readback before this change showed iPhone client events and
  `/api/public-config` on the same served client/cache
  `0.1.11|codex-mobile-shell-v625-a3d371b929b9`. The app UI only displayed
  `V625`, so screenshots could not prove which exact build was running.
- Another observability gap was found: `frontendDiagnosticLog` settings from
  `/api/public-config` were applied at startup only. Already-open PWA/shell
  clients did not pick up a newly enabled runtime diagnostic switch during the
  Owner's reproduction, so real `submitted_echo` lifecycle logs were missing.
- Source changes now:
  - `app-update-runtime` renders client text as
    `客户端 v<seq> · <12-char build hash>`;
  - page build/public-config polling hot-applies frontend diagnostic log
    settings and emits one bounded metadata event when the setting signature
    changes;
  - classic fallback and native ESM behavior stay aligned through
    `public/app-update-runtime.js`, `public/app-bootstrap.js`, and tests.
- Frontend rebuilt with client/cache
  `0.1.11|codex-mobile-shell-v625-7156a5d26073`, native ESM production
  execution, and published file count `24`.
- Validation passed:
  - `node --test test/vite-shell-asset-graph.test.js
    test/api-client-runtime-ui.test.js test/conversation-render.test.js`
    -> `199/199`;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`.
- Next step: commit and delegate central production deploy/readback. This does
  not claim the submitted-user duplicate is fixed; it makes the next
  production reproduction attributable from client-side lifecycle logs and
  visible exact build id.

## 2026-07-06T10:30Z - Vite app-preview proxy-safe entry and refresh failure telemetry

- Owner reported the Home AI embedded plugin was again stuck on the inline
  `Codex Mobile 没有正常启动` recovery screen while an already-open direct PWA
  session still worked but would not refresh to the newest version. The direct
  PWA session is the Owner's current communication path, so production restarts
  must remain centralized and non-duplicated.
- Bounded evidence before the fix:
  - live client-event logs still contained iPhone/PWA events on old build
    `0.1.11|codex-mobile-shell-v625-a3d371b929b9` while production had already
    served newer cache ids, confirming a real stale-client/update problem;
  - the visible failure page is the app shell boot recovery UI, meaning the
    page shell loaded but the Vite app runtime did not reach
    `codexMobileBoot.ready()`;
  - the native ESM `app-preview-entry.js` first-hop import was absolute
    `/vite-shell/assets/...`, which is fragile when mounted behind the Home AI
    plugin proxy or stale PWA/SW refresh paths.
- Commit `4311e7b9` (`fix: make vite preview entry proxy safe`) changes:
  - `scripts/publish-vite-shell-artifact.mjs` now emits
    `app-preview-entry.js` with relative first-hop import
    `./assets/vite-shell-entry-*.js`, while preserving absolute
    `targetEntryScript` metadata for readback;
  - generated production artifacts now record
    `targetEntryImportSpecifier` and source cache
    `0.1.11|codex-mobile-shell-v625-0e3a8130de85`;
  - `public/app-update-runtime.js` and
    `frontend/native/app-update-runtime.mjs` upload bounded
    `page_refresh_failed` events and keep the new-version refresh prompt
    retryable instead of silently hiding it after failure.
- Validation before deploy handoff:
  - `npm run --silent build:frontend` passed and generated
    `0.1.11|codex-mobile-shell-v625-0e3a8130de85`;
  - `node --test test/vite-shell-artifact-service.test.js
    test/app-update.test.js test/vite-shell-asset-graph.test.js
    test/api-client-runtime-ui.test.js` -> `54/54`;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`.
- Deployment was delegated to Codex Mobile Deploy Lane with task card
  `ttc_41f77e97664d429a97`. At the time of this handoff update, the card is
  approved/active but still shows `resumeRequired=true`; no central deploy
  return has arrived yet. Do not treat production as updated until that return
  confirms served cache `0.1.11|codex-mobile-shell-v625-0e3a8130de85`.

## 2026-07-06T10:43Z - Vite app-preview query-preserving entry follow-up

- Deploy return for `4311e7b9` later reported central execute `ok=true`,
  startup gate and full behavior gate passed, and production served
  `0.1.11|codex-mobile-shell-v625-0e3a8130de85`; however the Owner still
  reported the embedded plugin could not start, and the already-open iPhone
  PWA session remained on older build `a3d371b929b9`.
- Follow-up root-cause evidence:
  - 8787 static readback is healthy, but Home AI same-origin plugin proxy
    requires `workspaceId`/authorized workspace context;
  - `app-preview.html` is proxied with `workspaceId`, but a module import from
    same-named `app-preview-entry.js` to `./assets/vite-shell-entry-*.js`
    resolves to a new URL that does not preserve the entry script query;
  - this makes the embedded Vite first-hop depend on referrer/cookie fallback
    through the Home AI proxy, which is not a sound plugin boundary.
- Source fix in progress:
  - `scripts/publish-vite-shell-artifact.mjs` now emits
    `app-preview.html` with `app-preview-entry.js?targetEntry=<hash>.js` so the
    stable entry URL is cache-busted per target Vite entry;
  - generated `app-preview-entry.js` now computes the target module URL from
    `import.meta.url`, copies current search params to that target URL, and
    dynamically imports it, preserving proxy workspace/query context instead
    of relying on referrer inference;
  - `services/runtime/vite-shell-artifact-service.js` accepts module script
    srcs with query parameters in artifact validation.
- Validation passed so far:
  - `npm run --silent build:frontend`;
  - `node --test test/vite-shell-artifact-service.test.js test/app-update.test.js
    test/vite-shell-asset-graph.test.js test/api-client-runtime-ui.test.js`
    -> `54/54`;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`;
  - local Vite default-root rehearsal with browser startup probe returned
    `ok=true`, `appVisible=true`, `runtimeReady=true`, and `issueCodes=[]`.
- Next step: commit the follow-up and delegate one central deploy/readback.
  Do not run ad-hoc production restarts from this source thread because the
  Owner's direct PWA session is still their communication fallback.

## 2026-07-06T11:20Z - MCP-prefixed task-card tool contract cleanup

- Owner reported that Codex Mobile task-card tools are exposed through the
  MCP-prefixed names, not the app-server-style `codex_mobile.*` namespace, and
  asked to remove the old dual-channel guidance.
- Root cause: task-card runtime guidance, server runtime config, and tests still
  exposed or accepted `codex_mobile.delegate_to_thread` /
  `codex_mobile.return_to_source` as model-visible full names. That caused
  injected task-card instructions to keep suggesting a namespace that can be
  unsupported in current Codex threads.
- Source changes now make the model-visible task-card tool contract exact:
  `mcp__codex_mobile.delegate_to_thread`,
  `mcp__codex_mobile.return_to_source`, and
  `mcp__codex_mobile.task_card_heartbeat`. Local scripts remain documented as
  the fallback only when the MCP tool surface is unavailable.
- `[mcp_servers.codex_mobile]` remains the Codex Home MCP server config name;
  docs now distinguish that config name from the model-visible
  `mcp__codex_mobile.*` callable tool names.
- Validation passed:
  - exact old-callable scan returned no
    `codex_mobile.delegate_to_thread` / `codex_mobile.return_to_source` /
    `codex_mobile.task_card_heartbeat` full-name hits;
  - focused task-card/MCP tests `90/90`;
  - `node --check` on changed JS/test files;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`;
  - fallback-governance check `ok=true`.
- Related deploy state: old `c71e9019` duplicate-user-message deploy synced but
  failed startup/app-preview compatibility with `app-update-runtime` not ready,
  so this MCP contract cleanup should be deployed as a newer ref rather than
  accepting the old failed deploy.
- Source commit: `b8ebbadc6d0074df19c1e5569412d83cf76c1b85`
  (`fix: require mcp-prefixed task-card tools`).
- Deployment delegated to Codex Mobile Deploy Lane with task card
  `ttc_a494fa8e3b860e97d8`, targeting exact ref `b8ebbadc6d0074df19c1e5569412d83cf76c1b85`.
  The deploy card explicitly requires production readback that generated
  task-card/runtime guidance contains only `mcp__codex_mobile.*` callable names
  and no app-server-style `codex_mobile.*` alternatives, plus startup/full
  behavior gates and the prior `app-update-runtime` ESM compatibility check.
- During this source-thread handoff, attempting the app-server dynamic tool
  namespace returned `Unsupported dynamic tool namespace: codex_mobile`, so the
  deploy card was created through `scripts/create-thread-task-card.js`.

## 2026-07-06T11:39Z - app-update-runtime ESM readiness probe fix

- Deploy Lane reported the MCP-prefix task-card contract deploy for `b8ebbadc`
  passed that contract but failed startup/app-preview compatibility with
  `vite_app_preview_esm_compatibility_missing` and
  `vite_preview_esm_compatibility_missing`; the not-ready module was
  `app-update-runtime` with ESM readiness `49/48`.
- Root cause: `scripts/frontend-shell-asset-graph.mjs` still generated the
  `app-update-runtime` compatibility probe with an old 12-character visible
  client hash expectation (`客户端 v625 · a5a3d596240d`) while the runtime and UI
  contract now intentionally use the compact 8-character hash
  (`客户端 v625 · a5a3d596`). This made the module load but marked readiness
  false in browser startup gates.
- Source fix committed as `f636ef4765f11ee81a7e57e68a965594bb37d96b`
  (`fix: align app update esm readiness probe`): updated the generated probe,
  added a regression assertion in `test/vite-shell-asset-graph.test.js`, and
  rebuilt active Vite app-preview/readback artifacts.
- Source validation passed:
  - `node --test test/vite-shell-asset-graph.test.js` -> `22/22`;
  - `npm run --silent build:frontend` -> `0.1.11|codex-mobile-shell-v625-ebf0a8218576`, native ESM, published files `24`;
  - `node --test test/vite-shell-asset-graph.test.js test/vite-shell-artifact-service.test.js test/app-update.test.js test/api-client-runtime-ui.test.js` -> `54/54`;
  - `node scripts/codex-mobile-vite-default-root-rehearsal.js --json` -> `ok=true`, `issueCount=0`, `appVisible=true`, `runtimeReady=true`;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`;
  - fallback-governance check `ok=true`.
- Deployment delegated to Codex Mobile Deploy Lane with task card
  `ttc_150d415af3fffbe62b`, targeting exact ref
  `f636ef4765f11ee81a7e57e68a965594bb37d96b`. The deploy card asks the lane to
  verify that `app-update-runtime` is no longer not-ready and the previous Vite
  compatibility issue codes are absent, while confirming the MCP-prefixed tool
  contract remains intact.

## 2026-07-06T12:01Z - active overlay user-message dedupe local fix

- Owner reported two current blockers after Vite/native ESM migration: plugin
  embed/startup still failing in production and submitted user messages still
  sometimes rendering twice at the bottom of a thread.
- Local development server was run on `http://127.0.0.1:8897` with
  `CODEX_MOBILE_DEFAULT_SHELL=vite-app-preview` and auth disabled. Local startup
  gate passed for direct runtime, Vite preview, app-preview, app-preview root,
  default root, embed, and session surfaces with `blockingIssueCount=0` and no
  actionable startup codes. This confirms the source-side app-update-runtime ESM
  readiness fix is green locally; production still needs central deploy/readback.
- Frontend diagnostic log for Owner iPhone PWA reproduction showed the submitted
  echo chain itself was not duplicated by POST: local insert had one matching
  submission, post-response reconciled the local turn to a server turn, and the
  later duplicate appeared after a refresh/patch fallback. Key bounded evidence:
  after settlement, DOM probe reported `duplicateUserMessageCount=1`,
  `domHasSubmission=false`, and `hasThreadSubmission=false`, with a preceding
  `conversation_patch_html_fallback` reason `post-apply-duplicate-user-messages`.
- Local API detail for the same current Home AI thread before the source fix
  showed `projection-active-overlay` output with one visible active turn carrying
  two `userMessage` items. That made the duplicate a server active-overlay merge
  invariant issue, not a repeated POST or same-submission echo-retirement issue.
- Root fix: `mergeProjectionThreadWithActiveOverlay` now applies the existing
  `dedupeUserMessageEchoesInItems` policy before replacing/appending the active
  overlay turn. This closes the gap where window-backfill overlay used the
  normalizer but direct projection-overlay replacement did not.
- Validation so far:
  - `node --test test/thread-detail-active-window-overlay-policy-service.test.js test/thread-user-message-echo-normalizer-service.test.js` -> `39/39`;
  - broader focused set including Vite startup/assets and app-update tests ->
    `93/93`;
  - local startup gate on `8897` -> `ok=true`, `deployPass=true`,
    `blockingIssueCount=0`, `actionableIssueCodes=[]`;
  - local browser sampling of thread `019f316b-27cd-7622-9944-0b909fec3c70` ->
    `ok=true`, `issueCount=0`, `maxAllUserEventDuplicates=0`;
  - local API detail of the same thread after restart -> `userMessageCount=10`,
    `duplicateTurnGroups=[]`, latest user row count one;
  - `npm run --silent check` passed;
  - `git diff --check -- ':!.agent-context'` passed.
- Source commit: `3283aa52ac83994e8c2b8d4f9822e3a5eb7215b5`
  (`fix: dedupe active overlay user echoes`), on top of the app-update-runtime
  ESM readiness fix `f636ef4765f1`.
- Deployment handoff: sent central Deploy Lane task card
  `ttc_e532a35fb80a9f8c3b` targeting exact ref
  `3283aa52ac83994e8c2b8d4f9822e3a5eb7215b5`. The card requires production
  startup/app-preview/embed/session gate readback and duplicate-user evidence
  against a real active-overlay thread or controlled submit thread before
  acceptance.
- Task-card channel note: attempting `codex_mobile.delegate_to_thread` from this
  thread returned `Unsupported Codex Mobile dynamic tool: codex_mobile.delegate_to_thread`.
  The deploy request was therefore created through `scripts/create-thread-task-card.js`.

## 2026-07-06T12:18Z - MCP-prefixed task-card tool contract hardening

- Owner reported that task-card tools were still being attempted through the
  non-MCP app-server namespace after the MCP-prefix repair. Live reproduction in
  this source thread confirmed the failure mode: direct calls to the old
  app-server dynamic namespace were rejected, while `tool_search` exposed
  `mcp__codex_mobile.*` and `mcp__codex_mobile.list_threads` returned `ok=true`.
- Source fix committed as `5232b22b010bca937c897ffc440e8d40fd73f211`
  (`fix: require mcp-prefixed task card tools`), on top of the active-overlay
  duplicate-user fix `3283aa52` and app-update-runtime ESM readiness fix
  `f636ef47`.
- Changed surfaces:
  - `server-routes/thread-task-card-route-service.js`: dynamic tool
    descriptions and script fallback guidance now state that only MCP-prefixed
    Codex Mobile tool names are valid in model context, and non-MCP namespace
    variants must be treated as unavailable.
  - `services/task-cards/thread-task-card-service.js`: injected return-card
    guidance now points to `mcp__codex_mobile.return_to_source` after MCP/tool
    discovery and marks non-MCP namespace variants unsupported.
  - `scripts/codex-mobile-mcp-server.js`: MCP initialize instructions now carry
    the same exact-prefix contract.
  - tests assert that non-MCP task-card callable names for delegation, return,
    and heartbeat do not re-enter model-visible guidance.
- Validation passed:
  - `node --test test/thread-task-card-route.test.js test/thread-task-card-service.test.js test/codex-mobile-mcp-server.test.js` -> `87/87`;
  - `node --check` for changed source/tests;
  - `rg --pcre2 -n "(?<!mcp__)codex_mobile\\.(delegate_to_thread|return_to_source|task_card_heartbeat)" server.js services server-routes scripts docs test README.md frontend public --glob '!public/vite-shell/assets/**'` -> no matches;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`.
- Deployment delegated through the actual MCP-prefixed tool
  `mcp__codex_mobile.delegate_to_thread` and succeeded:
  task card `ttc_71f1e320f5e3992556`, target deploy lane
  `019f16e6-9131-79e2-9b6b-ad41f7e65d92`, exact ref `5232b22b010b...`.
  This proves the source thread's own delegation path can use the MCP-prefixed
  tool once discovered.

## 2026-07-06T13:25Z - Steered submitted echo reconciliation root fix

- Owner reproduced the remaining user-message duplicate/disappear issue with
  frontend diagnostic logging enabled. Bounded runtime logs showed the client was
  current at reproduction time (`0.1.11|codex-mobile-shell-v625-ebf0a8218576`),
  so the issue was not a stale-client artifact.
- Diagnostic chain for a steering submit:
  - `submit-start`, `recent-submission-registered`, and `local-insert-applied`
    created one optimistic submitted-user item inside the active turn
    (`createdLocalTurn=false`);
  - POST returned a server turn id (`post-response` had `turnId`);
  - `post-reconcile-result` reported `reconciled=false`;
  - later refreshes/patches could then show the optimistic active-turn user item
    and the durable server user item in unstable order until another refresh
    collapsed/moved it.
- Root cause: the composer send path skipped submitted-user reconciliation when
  `steering === true` even when the POST returned a concrete server turn id.
  That left the optimistic user item owned by the active/live projection instead
  of moving it to the returned server turn immediately.
- Source fix committed as `a9fc316e32ec2abb49563d7710506f73e3971146`
  (`fix: reconcile steered submitted echoes`):
  - `frontend/native/composer-runtime.mjs`;
  - `public/composer-runtime.js`;
  - `test/conversation-render.test.js`;
  - current Vite/native ESM artifacts for
    `0.1.11|codex-mobile-shell-v625-410076677afd`.
- Regression test added:
  `steered send reconciles optimistic user message from active turn to returned server turn`.
- Validation passed before deploy delegation:
  - `node --test test/conversation-render.test.js` -> `178/178`;
  - `node --check frontend/native/composer-runtime.mjs public/composer-runtime.js test/conversation-render.test.js`;
  - `npm run --silent build:frontend`;
  - `npm run --silent check:frontend-build`;
  - focused browser/runtime/Vite regression set -> `360/360`;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`;
  - local startup gate on `127.0.0.1:8897` -> `deployPass=true`,
    `blockingIssueCount=0`, direct/Vite/app-preview/embed/session startup green;
  - local Playwright URL matrix for direct, app-preview, workspace, embed,
    session, and shell embed query surfaces all loaded visible Codex Mobile UI
    with no startup fallback and client label `客户端 v625 · 41007667`.
- Deployment delegated via MCP-prefixed tool:
  task card `ttc_914f1dd9adf5551de9`, target deploy lane
  `019f16e6-9131-79e2-9b6b-ad41f7e65d92`, exact ref
  `a9fc316e32ec2abb49563d7710506f73e3971146`.
- Separate embedded Home AI shell startup note: local direct/app-preview/embed
  Codex surfaces are green after the proxy-safe/Vite fixes. Owner-visible plugin
  shell blank/fallback evidence points at the Home AI proxy/session asset path
  side, so Home AI app mutation was delegated separately rather than edited from
  this plugin workspace.
- Urgent Home AI embedded-launch repair supplement sent through MCP-prefixed
  task card `ttc_2b761cb0da427726fc` to current Home AI main thread
  `019f316b-27cd-7622-9944-0b909fec3c70`. The card includes the local green
  Codex direct/app-preview/embed/session evidence and asks Home AI to repair the
  iframe/proxy/session asset path with embedded-browser validation.
- Production deploy return for `a9fc316e` initially came back
  `partially_completed` (`ttc_97e144de5593f6cdb8`) because the central full gate
  ran with `submit exercise mode: manual` and failed on unrelated/default-thread
  projection issues. The deployed production readback itself was healthy:
  client/cache `0.1.11|codex-mobile-shell-v625-410076677afd`,
  `/api/status?detail=1` ready, `/api/vite-shell-artifact` ok, and startup gate
  green for direct/Vite/app-preview/root/default-root/embed/session surfaces.
- Follow-up production full behavior self-check was run with both explicit
  controlled submit and explicit target thread:
  `--thread-id 019f307c-56fb-7261-a584-2636051ee724
  --browser-exercise-submit --browser-submit-thread-id
  019f307c-56fb-7261-a584-2636051ee724`. Result: `ok=true`,
  `deployPass=true`, `blockingIssueCount=0`, `executionFailureCount=0`,
  `actionableIssueCodes=[]`. The submitted-message acceptance blockers were
  absent, including duplicate, disappearance, order mismatch, patch fallback,
  duplicate item ids, empty detail, and Vite ESM compatibility codes.
- Supplement card `ttc_0940df2b439f8feb34` was sent to the Deploy Lane with the
  explicit controlled-submit readback so the earlier manual-submit partial does
  not remain the final acceptance signal for the steered-submit fix.

## 2026-07-06T14:25Z - Embedded plugin session replay repair

- Home AI Owner-cookie embedded smoke after the Home AI proxy repair showed
  visible Codex first paint and clean Vite assets, but `/api/v1/hermes/plugin/session`
  produced `[200,401]` during embedded startup.
- Root cause in Codex Mobile: the session endpoint mixed two different
  semantics. It always passed `requestAuthToken(req)` into the one-shot launch
  exchange path when the body lacked an explicit launch token. If the launch URL
  still contained a consumed `codexPluginLaunch` query while the valid
  `codex_mobile_plugin_session` cookie was also present, the route preferred the
  already-consumed launch token and returned `plugin_launch_invalid_or_expired`.
- Source fix prepared:
  - `adapters/hermes-plugin-service.js` now has `readSession` for stable
    existing plugin-session reads while keeping launch tokens one-shot.
  - `server-routes/core-api-route-service.js`,
    `server-routes/server-route-composition-service.js`, and `server.js` pass
    and use `requestAuthTokens` so `/session` can find an authorized plugin
    session from all request tokens instead of the first token only.
  - `frontend/native/notification-ui-runtime.mjs`,
    `public/notification-ui-runtime.js`, and `public/app-bootstrap.js` dedupe
    the same embedded launch exchange with in-flight/completed launch markers.
  - Vite/native ESM artifacts regenerated for
    `0.1.11|codex-mobile-shell-v625-d64da72cac49`.
- Regression coverage added:
  - launch token remains one-shot but a plugin session can be read repeatedly;
  - `/api/v1/hermes/plugin/session` replays an existing plugin session without
    reusing a consumed launch token when both tokens are present;
  - explicit launch-token exchange still works;
  - frontend source retains same-launch exchange dedupe state.
- Validation passed before deploy delegation:
  - `node --test test/hermes-plugin-service.test.js test/core-api-route-service.test.js test/hermes-plugin-route.test.js test/conversation-render.test.js`
    -> `206/206`;
  - `npm run --silent build:frontend`;
  - `npm run --silent check`;
  - `git diff --check -- ':!.agent-context'`;
  - focused post-build artifact set
    `node --test test/hermes-plugin-service.test.js test/core-api-route-service.test.js test/hermes-plugin-route.test.js test/conversation-render.test.js test/vite-shell-artifact-service.test.js test/vite-shell-asset-graph.test.js`
    -> `244/244`;
  - `git diff --cached --check`.
- Pending after this handoff entry: commit source changes, delegate deployment
  through the Codex Mobile Deploy Lane, then return task card
  `ttc_db709e027679d0c94a` to Home AI with production readback or deploy blocker.
- Commit completed as `4d036f5a7b5a3b1322927cff16642367a20f7400`
  (`fix: stabilize embedded plugin session replay`) and deploy/readback returned
  from Deploy Lane.
- Production readback for `4d036f5a`:
  - client/cache `0.1.11|codex-mobile-shell-v625-d64da72cac49`;
  - `/api/public-config`, `/api/status?detail=1`, and
    `/api/vite-shell-artifact` HTTP 200, artifact `ok=true`, native ESM
    `49/49`, published files `24`;
  - startup-only gate passed for direct runtime, Vite preview, app-preview,
    app-preview root/default-root, embed, and session surfaces;
  - explicit controlled-submit full gate passed with `blockingIssueCount=0`,
    `executionFailureCount=0`, and no actionable/reportable issue codes;
  - Home AI Owner-cookie embedded smoke passed `3/3`; plugin session statuses
    were `[200]` in each sample, so the prior `[200,401]` residual did not
    recur.
- Focused production tests passed `244/244` across Hermes plugin service/route,
  core route service, conversation render, and Vite artifact/asset graph tests.
- SHA parity matched for changed source, test, and Vite artifact readback files.
- Residual unrelated to this session replay repair: central default/manual full
  gate still reported `thread_list_missing_active_detail_active_mismatch`.

## 2026-07-06T15:10Z - Submitted user duplicate DOM acceptance repair

- Owner reproduced visible duplicate user messages on the `codex mobile 07-04`
  thread. Production API detail later showed only one durable user item for the
  reproduced text, so this was a client DOM/render authority problem rather
  than a persistent backend duplicate.
- Frontend diagnostic logs for thread `019f2d75-39bd-7462-8dca-de24f97aeaf6`
  showed `conversation_patch_html_fallback` with
  `post-apply-duplicate-user-messages` and
  `conversation_dom_authority_invalidated` with
  `stable-signature-duplicate-user-messages`.
- Root cause: current-thread and tile-pane render paths passed
  `visibleConversationShape(...).duplicateUserMessageCount` as the expected DOM
  duplicate count. That made duplicate user-message DOM states acceptable when
  the render shape itself already contained the duplicate, so later patch or
  authority checks could preserve a duplicate instead of forcing canonical
  repaint.
- Fix: `expectedDuplicateUserMessageCount` is now always `0` for current-thread
  and tile-pane conversation DOM consistency checks in both native source and
  published classic runtime files. Tests assert the contract in
  `test/conversation-render.test.js`.
- Build/readback:
  - regenerated Vite/native ESM artifacts with client/cache
    `0.1.11|codex-mobile-shell-v625-a8a0493e87a2`;
  - retained only current `vite-shell-readback.json` published assets from the
    generated untracked shard set.
- Validation:
  - `node --test test/conversation-render.test.js
    test/thread-detail-dom-patch.test.js test/vite-shell-artifact-service.test.js
    test/vite-shell-asset-graph.test.js` -> `274/274` pass;
  - `npm run --silent check` passed;
  - `git diff --check -- ':!.agent-context'` passed.
- Local browser verification on `127.0.0.1:8897` with service workers blocked:
  - opened 07-04 thread under local `v625-a8a0493e`;
  - submitted two unique metadata-only markers through the real composer;
  - message POST count was `1` for the sampled submit;
  - samples from 100ms through 6000ms showed exactly one visible user message
    article/card for the marker;
  - the temporary second text occurrence at 100ms was traced to disabled
    `#messageInput`, not a second conversation article.
- Pending: commit this fix and deploy through the Codex Mobile Deploy Lane with
  startup and controlled-submit behavior readback.

## 2026-07-07T01:15Z - Quota popup and submitted-message harness hardening

- Owner reported quota usage click regression: clicking the quota chip did not
  open the quota detail panel. This repeated an earlier class of UI regression,
  so the fix now includes a dedicated Playwright harness gate.
- Root cause found with local browser probing on `127.0.0.1:8897`: native ESM
  app shell called `bridge.toggleQuotaDetails(anchor)` through
  `createComposerBridgeRuntime()`, but the bridge factory did not expose quota
  methods. After exposing them, a second issue remained: quota runtime toggles
  returned `undefined`, so app-shell treated the pointerdown toggle as failure
  and did not suppress the synthetic click; the click immediately toggled the
  panel closed again. The startup-time direct button listener was also brittle
  under dynamic shell rendering.
- Fixes:
  - `composer-bridge-runtime` factory now exports `closeQuotaDetails` and
    `toggleQuotaDetails`;
  - `composer-runtime` quota close/toggle functions return explicit success
    values;
  - `app-shell-runtime` handles quota clicks via document-level delegation to
    `#quotaUsage`, so clicks on nested chip spans use the same path;
  - added `scripts/codex-mobile-quota-popup-harness.js` and
    `test/quota-popup-harness.test.js`;
  - added `check:quota-harness` and included the harness syntax/test files in
    the main `npm run check`;
  - kept the submitted-message Playwright harness in
    `scripts/codex-mobile-submitted-message-harness.js`, with explicit session
    key install, thread targeting via both `thread` and `threadId`, DOM/API
    duplicate/missing checks, and reopen sampling;
  - send-button voice gesture remains disabled; direct button send path remains
    isolated;
  - version chip displays short `客户端 v625`; full client/cache hash is shown
    in the update panel.
- Build/readback:
  - regenerated Vite/native ESM artifacts with client/cache
    `0.1.11|codex-mobile-shell-v625-d77c1845e647`;
  - `productionExecution=vite-app-preview-native-esm`, published files `24`,
    retained artifact files `1149`.
- Local Playwright acceptance on `127.0.0.1:8897`:
  - quota harness against thread `019f2d75-39bd-7462-8dca-de24f97aeaf6` passed
    with service workers `block` and `allow`; after click, `aria-expanded=true`,
    `quotaDetailPanel.hidden=false`, and panel text included `5小时额度` and
    `周额度`;
  - submitted-message harness against Codex thread
    `019f2d75-39bd-7462-8dca-de24f97aeaf6` passed with SW `block` and `allow`:
    one POST, one visible user article/node, one durable API user item, and
    reopen samples still one;
  - submitted-message harness against Home AI main thread
    `019f316b-27cd-7622-9944-0b909fec3c70` passed with SW `block` and `allow`
    with the same one-post/one-visible/one-durable/reopen-one evidence.
- Validation:
  - `npm run --silent check:quota-harness` passed;
  - `npm run --silent check:submitted-harness` passed;
  - `node --test test/composer-runtime-ui.test.js test/quota-popup-harness.test.js test/vite-shell-asset-graph.test.js` -> `32/32`;
  - `node --test test/plugin-voice-input.test.js test/conversation-render.test.js test/app-update.test.js test/submitted-message-harness.test.js test/quota-popup-harness.test.js` -> `216/216`;
  - `node --test test/browser-runtime-self-check-service.test.js test/runtime-self-check-loop.test.js test/vite-shell-artifact-service.test.js test/vite-shell-asset-graph.test.js` -> `154/154`;
  - `npm run --silent check` passed;
  - `git diff --check -- ':!.agent-context'` passed.
- Pending: commit this source fix, then deploy through the Codex Mobile Deploy
  Lane for production startup/full behavior/readback before claiming production
  closure.
- Commit completed as `322c1fb79f9760f3c64336725277efe96bde99dd`
  (`fix: harden quota popup and submitted message harness`).
- Deployment card sent through the MCP-prefixed task-card tool
  `mcp__codex_mobile.delegate_to_thread`:
  `ttc_f3019d132ba7e29abf`.
- Immediate production readback after card creation still showed old build
  `0.1.11|codex-mobile-shell-v625-a8a0493e87a2`, not the requested local build
  `0.1.11|codex-mobile-shell-v625-d77c1845e647`.
- Production quota harness against old build reproduced the quota regression:
  missing `toggleQuotaDetails`/`closeQuotaDetails` bridge functions,
  `aria-expanded=false` after click, and quota panel still hidden. This is
  old-build evidence and should not be used to judge `322c1fb7`.
- Production submitted-message harness against old build submitted one marker
  and saw one visible user card through the live sampling window, but failed
  after reopen/API with `durable_user_item_missing` and `stale_client_build`.
  This also belongs to the old production build.
- Supplement card `ttc_3c78aa6c79aeaa21fd` was sent to the Deploy Lane asking
  it to execute the pending `322c1fb7` deploy and run quota/submitted harnesses
  against the deployed build rather than the stale `a8a0493e87a2` build.
- Deploy Lane returned `322c1fb7` as blocked: central execute failed the
  default/manual behavior gate and final production remained on
  `a8a0493e87a2`. During the attempted target-validation window, quota harness
  was observed green, but final production was not the target build, so no
  production closure was claimed.
- Local reproduction on the fixed `d77c1845e647` build found a source-owned
  gate regression from the shortened version label: the ESM compatibility
  sample for `app-update-runtime` still expected `客户端 v625 · <hash>`. This
  made Vite/app-preview readiness report `app-update-runtime` not ready.
- Follow-up fix committed as `6fc199495d0bee3a0dd28232d78eb09de26c1f1a`
  (`fix: align app update esm readiness check`): the compatibility sample now
  expects the short visible label while checking the full client/cache hash via
  `fullClientBuildVersionText()`.
- Follow-up validation:
  - `node --test test/vite-shell-artifact-service.test.js test/vite-shell-asset-graph.test.js test/app-update.test.js`
    -> `52/52`;
  - `npm run --silent check` passed;
  - local startup-only deploy gate on `127.0.0.1:8897` passed with no
    actionable issue codes;
  - local full deploy gate on `127.0.0.1:8897` passed with no
    actionable/reportable issue codes.
- New deploy card sent through MCP-prefixed delegation:
  `ttc_be64480beffc36e619`, requesting central deployment of `6fc19949` and
  quota/submitted harness readback against live `d77c1845e647`.

## 2026-07-07T02:05Z - Submitted user DOM animation residue semantic duplicate fix

- Owner continued to reproduce visible duplicate user messages after earlier
  submit/durable echo fixes. Production Home AI main harness on
  `019f316b-27cd-7622-9944-0b909fec3c70` showed the critical shape: one
  backend POST, one durable API user item, but two same-turn visible DOM user
  message nodes at the transient sample; one had the live/animated class and
  one had the stable/durable shape. Reopen collapsed back to one message.
- Root cause: the existing DOM duplicate guard only counted event-level
  duplicate signatures. When the transient local/animated node lacked the same
  timestamp/event attributes as the durable node, the duplicate was invisible to
  the guard even though it was semantically the same submitted user message in
  the same turn.
- Fix: `conversationDomShape()` and `visibleConversationShape()` now compare the
  max of event-level duplicate signatures and same-turn semantic user-message
  signatures. The semantic signature prefers `submission + text` when both are
  present, then falls back to submission-only, then text-only. This keeps real
  distinct same-submission diagnostics from false-positive collapse while
  detecting the observed animation residue.
- Added focused regression coverage in `test/conversation-render.test.js` for
  two same-turn submitted-user DOM nodes with identical text but different
  render/timestamp shape.
- Rebuilt frontend artifacts. Current local client/cache:
  `0.1.11|codex-mobile-shell-v625-852b517ddf87`.
- Local validation:
  - `node --test test/conversation-render.test.js test/thread-detail-dom-patch.test.js`
    -> `237/237` pass;
  - `node --test test/conversation-render.test.js test/submitted-message-harness.test.js test/quota-popup-harness.test.js test/browser-runtime-self-check-service.test.js test/runtime-self-check-loop.test.js test/vite-shell-artifact-service.test.js test/vite-shell-asset-graph.test.js`
    -> `347/347` pass;
  - `npm run --silent build:frontend && npm run --silent check` passed;
  - `git diff --check -- ':!.agent-context'` passed.
- Local browser/harness validation on `127.0.0.1:8897`:
  - Codex source thread `019f2d75-39bd-7462-8dca-de24f97aeaf6` submitted-message
    harness passed with service workers `block` and `allow`: one POST, one
    visible user card across samples, one durable API user item, and one visible
    user card after reopen;
  - quota popup harness still passed with service workers `block` and `allow`.
- Local Home AI main thread `019f316b-27cd-7622-9944-0b909fec3c70` cannot be
  read by the local Codex Mobile dev server on `8897` (`404` outside visible
  workspace), so Home AI main acceptance must be rerun from production after
  deployment of the new cache.
- Pending: commit this source fix and send a deploy card through the
  MCP-prefixed delegation tool. Required production acceptance: deployed cache
  `852b517ddf87`, startup gate, focused tests/parity, quota harness, Codex
  submitted-message harness, and Home AI main submitted-message harness on
  `019f316b-27cd-7622-9944-0b909fec3c70`.

## 2026-07-07T03:10Z - Submitted user duplicate DOM probe render effect follow-up

- Production settled validation for `4c370212` later reported green for the
  standard gate, quota harness, Codex submitted-message harness, and Home AI
  main submitted-message harness. A separate local follow-up remains useful
  because the submitted-message probe path did not yet act on same-turn
  semantic duplicate counts.
- Root cause: `probeSubmittedMessageDom()` computed the conversation DOM shape
  but only sent DOM/visible counts to `submittedMessageDomProbeEffects()`. The
  runtime health effect path therefore could report missing submitted messages
  but could not detect or repair a transient duplicate user DOM node that
  collapsed after reopen.
- Fix: submitted-message DOM probes now include
  `duplicateUserMessageCount` and `expectedDuplicateUserMessageCount`.
  `submittedMessageDomProbeEffects()` emits a bounded
  `submitted_message_dom_duplicate` diagnostic and a `render-current-thread`
  effect when the DOM duplicate count exceeds the expected visible shape. The
  API client applies that effect by rerendering the current thread with bottom
  stickiness, preserving the architectural source of truth instead of deleting
  DOM nodes manually.
- Rebuilt frontend artifacts. Current local client/cache:
  `0.1.11|codex-mobile-shell-v625-6816dd7f9690`.
- Source validation:
  - `node --test test/frontend-runtime-health.test.js test/conversation-render.test.js test/submitted-message-harness.test.js test/quota-popup-harness.test.js test/browser-runtime-self-check-service.test.js test/runtime-self-check-loop.test.js test/vite-shell-artifact-service.test.js test/vite-shell-asset-graph.test.js`
    -> `361/361` pass;
  - `npm run --silent check` passed;
  - `git diff --check -- ':!.agent-context'` passed.
- Local browser/harness validation on `127.0.0.1:8897`:
  - Codex source thread `019f2d75-39bd-7462-8dca-de24f97aeaf6` submitted-message
    harness passed with service workers `block` and `allow`, expected hash
    `6816dd7f9690`, one POST per scenario, one visible user card/node across
    all samples, one durable API user item, and one visible user card after
    reopen;
  - quota popup harness passed with service workers `block` and `allow`.
- Production acceptance, if this follow-up is deployed, must prove both real
  threads rather than only the controlled submit fixture:
  - Codex source thread `019f2d75-39bd-7462-8dca-de24f97aeaf6`;
  - Home AI main thread `019f316b-27cd-7622-9944-0b909fec3c70`;
  - both with submitted-message harness, service workers `block` and `allow`,
    expected hash `6816dd7f9690`, and no visible/durable/transient duplicate or
    disappearing submitted-user issue codes.

## 2026-07-07T03:35Z - V4 pending overlay settlement for durable user without submission id

- Deployed/local follow-up `6a70bad5` switched production to
  `0.1.11|codex-mobile-shell-v625-6816dd7f9690`, but real Home AI main thread
  harness still reproduced the owner-visible bug in service-worker `block`
  mode:
  - one POST;
  - one durable API user item;
  - one visible article;
  - two visible user DOM nodes at 2800ms and 6000ms;
  - one visible user node after reopen.
- Root cause was narrowed below DOM rendering: V4 projection merge re-applied
  the local pending overlay because durable user-message settlement only treated
  a durable message as resolved when it carried the same `clientSubmissionId`.
  Home AI production durable projection can omit the submission id while still
  carrying the same submitted user message. In that case the current in-memory
  thread kept both the local pending item and the durable user item; a rerender
  could not fix it because the duplicate was in state, not just DOM residue.
- Fix: `thread-detail-v4-merge-state` now accepts an explicit
  `durableUserMessageSettlesPendingEcho` policy. V4 pending-match and durable
  submission-match checks use this policy for durable user messages that do not
  expose the client submission id. The production policy delegates to the
  existing bounded `optimisticEchoCanMatchEarlierDurable()` settlement rules,
  preserving the guard that old same-text durable messages must not erase a
  newer user submission.
- Added focused V4 merge tests:
  - durable matching user message without submission id drops the pending
    overlay;
  - old same-text durable user message does not drop a newer pending overlay.
- Rebuilt frontend artifacts. Current local client/cache:
  `0.1.11|codex-mobile-shell-v625-d9f0435feebd`.
- Source validation:
  - `node --test test/thread-detail-v4-merge-state.test.js test/conversation-render.test.js test/frontend-runtime-health.test.js test/submitted-message-harness.test.js test/quota-popup-harness.test.js test/browser-runtime-self-check-service.test.js test/runtime-self-check-loop.test.js test/vite-shell-artifact-service.test.js test/vite-shell-asset-graph.test.js`
    -> `375/375` pass;
  - `npm run --silent check` passed;
  - `git diff --check -- ':!.agent-context'` passed.
- Local browser/harness validation on `127.0.0.1:8897`, hash
  `d9f0435feebd`:
  - Codex source thread `019f2d75-39bd-7462-8dca-de24f97aeaf6`
    submitted-message harness passed with service workers `block` and `allow`;
  - quota popup harness passed with service workers `block` and `allow`.
- Production acceptance for this fix must rerun the Home AI main thread harness
  on `019f316b-27cd-7622-9944-0b909fec3c70`, expected hash `d9f0435feebd`;
  the known previous failure code pair was `visible_user_card_duplicate` and
  `transient_visible_user_duplicate_clears_after_reopen`.

## 2026-07-07T03:45Z - Production validation for V4 pending overlay settlement

- MCP-prefixed deploy card sent to Codex Mobile Deploy Lane:
  `ttc_32653e3b7701dc7697`, requesting deployment of
  `c7c44b9ee74ae058d57d4958cf64b89137d8c105`.
- Production `/api/public-config` switched to
  `0.1.11|codex-mobile-shell-v625-d9f0435feebd`; shell cache matched.
- Production Home AI main thread submitted-message harness:
  - thread `019f316b-27cd-7622-9944-0b909fec3c70`;
  - service workers `block` and `allow`;
  - expected hash `d9f0435feebd`;
  - result `ok=true`, issue codes `[]`;
  - block mode, which previously failed, now showed one POST, one durable API
    user item, one visible user article/node at 100/350/900/1600/2800/6000ms,
    and one visible user node after reopen.
- Production Codex source thread submitted-message evidence:
  - combined `block`/`allow` run had `allow` green but one `block` scenario
    reported `durable_user_item_missing`; the visible samples still had one
    visible user node, so this was not the duplicate-node bug;
  - immediate `block` rerun on `019f2d75-39bd-7462-8dca-de24f97aeaf6`
    passed with one POST, one durable API user item, one visible user node at
    all samples, and one after reopen.
- Production quota popup harness on `019f2d75-39bd-7462-8dca-de24f97aeaf6`
  passed with service workers `block` and `allow`; quota panel opened and
  labels were visible.
- Residual: the one-off Codex `block` `durable_user_item_missing` result is a
  separate persistence/readback-window signal, not the duplicate user-message
  symptom. The submitted-message harness should be enhanced later to record
  POST response status/summary so this class can be classified without guessing.

## 2026-07-06T19:24Z - Submitted user DOM duplicate cleanup hardening

- New local reproduction after the V4 overlay settlement showed the remaining
  duplicate was a current-page DOM residue, not a durable backend duplicate:
  Home AI main thread had one POST and one durable API user item, but the
  visible DOM temporarily contained two `.item.userMessage` nodes for the same
  marker before reopen collapsed to one.
- Fixes in this slice:
  - `thread-detail-runtime` collapses same-turn submitted-user durable/local
    visible-item echoes before render;
  - `thread-detail-dom-patch` exposes `removeDuplicateUserMessageDomNodes()`
    and removes same-turn duplicate user DOM nodes by visible text, preferring
    durable/non-local nodes over local/mux/client-submission residue;
  - `pane-layout-runtime` runs the DOM cleanup after conversation patch/full
    render and after local completion cleanup;
  - submitted-message and quota Playwright harnesses now default to the Vite
    `app-preview` surface and submit login by clicking the form button, matching
    embedded/plugin startup more closely while still allowing `--entry-surface direct`.
- Rebuilt frontend artifacts. Current local client/cache:
  `0.1.11|codex-mobile-shell-v625-503cbb124641`.
- Source validation:
  - `node --test test/thread-detail-dom-patch.test.js test/conversation-render.test.js test/thread-detail-v4-merge-state.test.js test/submitted-message-harness.test.js test/quota-popup-harness.test.js test/browser-runtime-self-check-service.test.js test/runtime-self-check-loop.test.js test/vite-shell-artifact-service.test.js test/vite-shell-asset-graph.test.js`
    -> `425/425` pass;
  - `npm run --silent check` passed;
  - `git diff --check -- ':!.agent-context'` passed.
- Local browser/harness validation on `127.0.0.1:8897`, expected hash
  `503cbb124641`:
  - Home AI main thread `019f316b-27cd-7622-9944-0b909fec3c70` submitted-message
    harness passed with service workers `block` and `allow`; both modes showed
    one POST, one durable API user item, one visible user node at every sample
    and after reopen;
  - Codex source thread `019f2d75-39bd-7462-8dca-de24f97aeaf6` submitted-message
    harness passed with service workers `block` and `allow`; both modes showed
    one POST, one durable API user item, one visible user node at every sample
    and after reopen;
  - quota popup harness passed on the Codex source thread in `block` and
    `allow` modes; the combined `both` run hung during browser cleanup, so the
    acceptance evidence is the two single-mode runs.
- Production acceptance still required: deploy this ref and rerun the same
  Home AI main submitted-message harness in `block` and `allow` modes against
  expected hash `503cbb124641`, plus Codex source submitted-message and quota
  harnesses.

## 2026-07-06T19:34Z - Production validation for submitted user DOM cleanup

- Production switched to requested commit `d5113f35` and serves
  `0.1.11|codex-mobile-shell-v625-503cbb124641`.
- Production status/readback:
  - `/api/public-config`: HTTP 200, client/cache
    `0.1.11|codex-mobile-shell-v625-503cbb124641`, default shell
    `vite-app-preview`;
  - `/api/status?detail=1`: HTTP 200, `ready=true`, issue codes `[]`;
  - `/api/vite-shell-artifact`: HTTP 200, `ok=true`,
    `productionExecution=vite-app-preview-native-esm`, published files `24`.
- Production submitted-message harness on Home AI main thread
  `019f316b-27cd-7622-9944-0b909fec3c70`, expected hash `503cbb124641`:
  - service workers `block` and `allow`;
  - result `ok=true`, issue codes `[]`;
  - one POST per scenario;
  - one durable API user item;
  - one visible user node at `100/350/900/1600/2800/6000ms`;
  - one visible user node after reopen.
- Production submitted-message harness on Codex source thread
  `019f2d75-39bd-7462-8dca-de24f97aeaf6`, expected hash `503cbb124641`:
  - service workers `block` and `allow`;
  - result `ok=true`, issue codes `[]`;
  - one POST per scenario;
  - one durable API user item;
  - one visible user node at `100/350/900/1600/2800/6000ms`;
  - one visible user node after reopen.
- Production quota popup harness on Codex source thread
  `019f2d75-39bd-7462-8dca-de24f97aeaf6`:
  - service workers `block` and `allow`;
  - result `ok=true`, issue codes `[]`;
  - quota toggle/close runtime bridge functions present;
  - click sets `aria-expanded=true`;
  - quota panel visible with quota labels.
- Startup-only deploy gate passed:
  - `deployPass=true`, blocking/actionable issue codes `[]`;
  - direct runtime, Vite preview, app-preview, root/default-root, embed, and
    session startup surfaces all green.
- Explicit controlled-submit full gate on thread
  `019f307c-56fb-7261-a584-2636051ee724` passed:
  - `deployPass=true`;
  - blocking/actionable/reportable/observe-only issue codes `[]`;
  - advisory-only codes: `thread_list_updated_order_mismatch`,
    one dynamic `browser_latest_turn_item_below_api_expectation`,
    `active_codex_app_server_rss_elevated`,
    `codex_mobile_mcp_child_accumulation_elevated`.
- Targeted regressions absent from production harness/gate evidence:
  - visible submitted-user DOM duplicate;
  - transient duplicate that clears after reopen;
  - durable submitted-user duplicate;
  - pending submitted-user disappearance;
  - submitted-user delayed order mismatch;
  - quota popup bridge/panel failure.

## 2026-07-07 - Quota Popup Fast-Click Fix

- Symptom: quota detail panel opens on normal click, but rapid repeated quota button clicks can immediately close it.
- Failing layer: client interaction contract in `app-shell-runtime` quota button event handling; composer runtime owns the detail panel as a toggle, so repeated button activation could toggle an already-open panel closed.
- Fix: added `quotaDetailsAreOpen(anchor)` guard in `frontend/native/app-shell-runtime.mjs` and generated `public/app-shell-runtime.js`; quota button activations now keep the details panel open when it is already open. Outside pointer close remains owned by composer runtime.
- Harness: extended `scripts/codex-mobile-quota-popup-harness.js` with `--click-count` and `--click-interval-ms`; default repeated-click interval is 760ms so it crosses the existing 650ms synthetic-event suppression window and catches the old close-on-second-click behavior.
- Local validation:
  - `node --test test/quota-popup-harness.test.js test/composer-quota.test.js test/composer-runtime-ui.test.js` passed `21/21`.
  - `npm run --silent build:frontend` produced `0.1.11|codex-mobile-shell-v625-b43560c1055b`.
  - `node --test test/quota-popup-harness.test.js test/composer-quota.test.js test/composer-runtime-ui.test.js test/vite-shell-artifact-service.test.js test/vite-shell-asset-graph.test.js` passed `59/59`.
  - Local Playwright harness on `http://127.0.0.1:8897`, thread `019f2d75-39bd-7462-8dca-de24f97aeaf6`, `--service-workers both --click-count 2`, passed with issue codes `[]`; both block and allow modes ended with `ariaExpanded=true` and visible quota panel.
  - `npm run --silent check` passed.
- Deployment status: not yet delegated/deployed in this local implementation slice.

## 2026-07-07 - Public PR #87 Manual Title Preservation Absorbed

- Triage: private `origin` had no open PRs. Public repo had PR #87 (`fix: preserve manual thread titles`) and PR #86 (`html-preview-render-fullscreen`). PR #87 was the latest and was not covered locally; PR #86 remains a separate HTML preview feature and was not absorbed in this slice.
- Absorbed PR #87 code/test logic manually instead of merging the public branch, because public PR base is behind the private main and direct branch diff includes unrelated/stale generated artifacts.
- Fix: `applySessionIndexTitleToThread()` now applies session-index/manual titles to `displayTitle`, `threadTitle`, `thread_name`, `name`, `title`, and `preview`, and records `mobileSessionIndexTitle` plus timestamp marker. `mergeThreadDisplaySummary()` now preserves the preferred session-index title marker over stale display/app-server summaries while still merging non-title fields such as `cwd`.
- Validation:
  - `node --check adapters/thread-visibility-service.js && node --check services/thread-list/thread-summary-state-service.js && node --check test/thread-visibility.test.js && node --check test/thread-title-source.test.js` passed.
  - `node --test test/thread-visibility.test.js test/thread-title-source.test.js` passed `69/69`.
  - `node --test test/thread-list-service-boundary.test.js test/thread-list-summary-merge-service.test.js test/thread-list-runtime-service.test.js test/thread-list-fallback-cache-service.test.js test/thread-list-route-service.test.js test/thread-visibility.test.js test/thread-title-source.test.js` passed `114/114`.
  - `npm run --silent check` passed.
- Deployment status: not deployed; this is a source absorption of the public PR.

## 2026-07-07 - Public PR #86 HTML File Preview Absorbed

- Absorbed public PR #86 (`fix: render html file previews`) manually instead of merging the public branch, because the PR branch was based behind private `main` and carried unrelated/stale generated shell artifact churn.
- Fix: local `.html`/`.htm` file previews now use `kind="html"`, receive a sandbox CSP on `/api/files/preview/content`, and render in a controlled sandboxed iframe with source/render tabs plus fullscreen support. Escape and dialog close clear fullscreen state.
- Runtime surfaces updated in both native ESM and classic public outputs:
  - `frontend/native/media-preview-runtime.mjs` / `public/media-preview-runtime.js`;
  - `frontend/native/conversation-render-runtime.mjs` / `public/conversation-render-runtime.js`;
  - `frontend/native/app-shell-runtime.mjs` / `public/app-shell-runtime.js`;
  - `public/styles.css`;
  - `adapters/media-file-service.js`.
- Build: `npm run --silent build:frontend` produced `0.1.11|codex-mobile-shell-v625-63d53108eec7`.
- Validation:
  - syntax checks passed for edited service/runtime files;
  - `node --test test/file-preview.test.js test/file-preview-ui.test.js test/media-preview-runtime-ui.test.js` passed `25/25`;
  - `node --test test/file-preview.test.js test/file-preview-ui.test.js test/media-preview-runtime-ui.test.js test/vite-shell-artifact-service.test.js test/vite-shell-asset-graph.test.js` passed `63/63`;
  - `npm run --silent check` passed;
  - `git diff --check -- ':!.agent-context'` passed.
- Deployment status: not deployed; this is source/public absorption and generated artifact sync.

## 2026-07-07 - Active Overlay Projection Diagnostic Contract

- Task card: `ttc_5470d4a7c40dcc9f27`, diagnostic case `diagcase_5640b29d6b7827f84988`.
- Symptom: Home AI diagnostic reported `conversation_projection_mismatch` / `active-thread-window-downgrade` on the Codex Mobile embedded thread detail route.
- Failing layer: Codex Mobile frontend diagnostic planner, not the Home AI proxy. Current production readback for Home AI main and Codex source threads showed valid active overlay responses: `mobileReadMode=projection-active-overlay`, `partialKind=turns-list-active-overlay-window`, active turns present, visible items present, and response budget evidence present.
- Root-cause fix: `planThreadDetailResponseContractDiagnostic()` now treats explicit `projection-active-overlay` / `active-overlay-window` projection windows as valid active progressive projection evidence when active and visible evidence are present. The existing downgrade detector still reports real active window downgrades when the response lacks projection/budget evidence.
- Files changed:
  - `frontend/native/thread-performance-metrics.mjs`;
  - `public/thread-performance-metrics.js`;
  - `test/thread-performance-metrics.test.js`;
  - generated Vite/native ESM shell artifacts.
- Build: `npm run --silent build:frontend` produced `0.1.11|codex-mobile-shell-v625-6a2f01188284`, native ESM execution, published file count `24`.
- Validation:
  - focused diagnostic/runtime/Vite tests passed `97/97`;
  - `npm run --silent check` passed;
  - fallback governance scan passed with `issues=[]`;
  - `git diff --check -- ':!.agent-context'` passed.
- Deployment status: source fix ready for central plugin deploy; production pre-fix read-only self-check against Home AI main thread was green and did not reproduce the H2 event during this local slice.
- Privacy: only bounded ids, statuses, modes, counts, hashes, and issue-code summaries were recorded. No raw thread bodies, message text, endpoint bodies, secrets, cookies, launch tokens, screenshots, raw cache JSON, or long logs stored.

## 2026-07-07 - Thread List Runtime Stall Diagnostic Contract

- Task card: `ttc_1022a3c5c713b700b7`, diagnostic case `diagcase_cb9cbfde7c2988626393`.
- Symptom: Home AI diagnostic reported `frontend_runtime_mismatch` /
  `browser_thread_list_interaction_blocked` from embedded Codex Mobile.
- Bounded log replay since `2026-07-07T03:00:00Z` showed only
  `thread_list_runtime_stall` heartbeat events:
  - actions were `thread-list-heartbeat`;
  - maximum rAF delay was about `11884ms`;
  - `maxScrollApplyMs=0`, `maxLongTaskMs=0`, `longTaskCount=0`;
  - thread list count was present, but no recent input evidence existed.
- Failing layer: Codex Mobile frontend/runtime diagnostic classification.
  Passive thread-list heartbeat rAF gaps were being promoted to H2
  interaction-blocked diagnostics without requiring recent user input, delayed
  scroll application, or long-task evidence.
- Root-cause fix:
  - frontend runtime now records `recentThreadListInput` and
    `recentInputAgeMs` for thread-list input probes;
  - passive `thread-list-heartbeat` rAF-only delays are classified as H3
    `browser_thread_list_runtime_heartbeat_delayed`;
  - recent-input, scroll-apply, or long-task stalls still remain eligible for
    H2 `browser_thread_list_interaction_blocked` or
    `browser_main_thread_long_task`.
- Files changed:
  - `frontend/native/api-client-runtime.mjs`;
  - `frontend/native/frontend-runtime-health.mjs`;
  - `public/api-client-runtime.js`;
  - `public/frontend-runtime-health.js`;
  - `services/runtime/client-event-stall-self-check-service.js`;
  - `test/frontend-runtime-health.test.js`;
  - `test/client-event-stall-self-check-service.test.js`;
  - generated Vite/native ESM shell artifacts.
- Build: `npm run --silent build:frontend` produced
  `0.1.11|codex-mobile-shell-v625-778d0b55ee22`, native ESM execution, and
  published file count `24`.
- Validation:
  - focused runtime/self-check/Vite tests passed `186/186`;
  - replay of the original production client-event window returned `ok=true`,
    `blockingIssueCount=0`, five H3
    `browser_thread_list_runtime_heartbeat_delayed` issues, and H2 stall count
    `0`;
  - `npm run --silent check` passed;
  - fallback governance scan passed with `issues=[]`;
  - `git diff --check -- ':!.agent-context'` passed.
- Deployment status: source fix ready for central plugin deploy.
- Privacy: only bounded event codes, counts, timings, and log hash were
  recorded. No raw logs, raw thread/message bodies, endpoint bodies, secrets,
  cookies, launch tokens, screenshots, provider payloads, or raw cache JSON
  stored.

## 2026-07-07 - Active Window Downgrade Diagnostic Readback

- Task card: `ttc_8ce0ce8121d27fe3e3`, diagnostic case
  `diagcase_194e1222606caf2fd4a8`.
- Symptom: Home AI diagnostic reported `conversation_projection_mismatch` /
  `active-thread-window-downgrade` for the embedded Codex Mobile proxy route at
  `2026-07-07T03:19:54.998Z`.
- Current production readback after `3394517f`:
  - `/api/public-config` reports
    `0.1.11|codex-mobile-shell-v625-778d0b55ee22`;
  - current published `public/thread-performance-metrics.js` and current Vite
    shard include the active-overlay projection acceptance rule;
  - default phase-B readback passed with `readMode=projection-active-overlay`,
    `activeOverlayGate=ready`, `activeOverlayAction=use-projection-overlay`,
    response budget applied, active turn count `1`, and retained visible items;
  - Codex source thread `019f2d75-39bd-7462-8dca-de24f97aeaf6` passed
    active-overlay readback with `activeOverlayGate=ready`;
  - Home AI main thread `019f316b-27cd-7622-9944-0b909fec3c70` returned
    `projection-v4-partial` with `activeOverlayGate=not-active` because active
    full read was not required, so `--require-active-overlay` is not applicable
    for that current idle/non-active sample.
- Validation:
  - `node --test test/thread-performance-metrics.test.js
    test/thread-diagnostic-events.test.js
    test/home-ai-diagnostic-reporting.test.js
    test/runtime-self-check-gate-service.test.js` passed `59/59`;
  - `git diff --check -- ':!.agent-context'` passed.
- Classification: the exact `active-thread-window-downgrade` event was not
  reproducible on current production. Current self-check still reports separate
  assistant projection gaps (`active_turn_assistant_projection_gap` and
  `latest_completed_assistant_projection_gap`) on a different invariant.
- No Codex Mobile source repair was performed for this card in this slice.
- Privacy: bounded metadata only; no raw thread/message bodies, endpoint
  bodies, raw logs, screenshots, secrets, cookies, launch tokens, provider
  payloads, or raw cache JSON stored.

## 2026-07-07 - Active Bounded Overlay Close Diagnostic Repair

- Task card: `ttc_010c409066bd2356f2`, diagnostic case
  `diagcase_3cd7d20ca8aa06e8fd47`.
- Symptom: Home AI diagnostic reported `conversation_projection_mismatch` /
  `active-thread-window-downgrade` for the embedded Codex Mobile proxy route at
  `2026-07-07T05:18:06.271Z`.
- Current production reproduction before the fix:
  - build/cache was `0.1.11|codex-mobile-shell-v625-778d0b55ee22`;
  - Home AI main thread `019f316b-27cd-7622-9944-0b909fec3c70` first read
    `readMode=turns-list-large`, `readDecision=bounded-large-turns-list`,
    `activeFullReadRequired=true`, `activeFullReadReason=active-turn-id`,
    `activeOverlayGate=needs_repair`,
    `activeOverlayReason=missing-projection-window`,
    `responseBudgetActiveTurnCount=1`, and
    `responseBudgetRetainedItemCount=49`;
  - an immediate repeated read then returned `projection-active-overlay` with
    `activeOverlayGate=ready`, proving the first response was a transient
    server-orchestration window close gap rather than durable projection loss.
- Root cause: when an active detail read missed an active overlay projection
  window and fell through to bounded `turns-list-large`, the service seeded the
  newly read window for the next request but returned the current response as
  `turns-list-large`, allowing the frontend contract diagnostic to classify the
  first response as an active-window downgrade.
- Fix:
  - `services/thread-detail/thread-detail-read-orchestration-service.js` now
    derives bounded server-active overlay evidence from a freshly read active
    `turns-list-large` window and reuses the existing
    `planActiveWindowOverlay()` gate to close the same response as
    `projection-active-overlay` when evidence is complete;
  - `test/thread-detail-read-orchestration-service.test.js` covers the
    snapshot-missing / bounded-active-window path.
- Source commit: `bb995b95c790` (`fix: close active bounded windows as
  overlays`).
- Source validation:
  - `node --test test/thread-detail-read-orchestration-service.test.js` passed
    `49/49`;
  - `node --test test/thread-detail-read-orchestration-service.test.js
    test/thread-performance-metrics.test.js test/thread-diagnostic-events.test.js
    test/home-ai-diagnostic-reporting.test.js test/phase-b-readback-smoke.test.js
    test/runtime-self-check-gate-service.test.js` passed `116/116`;
  - `npm run --silent check` passed;
  - fallback governance scan passed with `issues=[]`;
  - `git diff --check -- ':!.agent-context'` passed.
- Production deploy/readback:
  - central deploy synced/restarted requested ref `bb995b95c790`;
  - route/artifact health remained green with unchanged client/cache
    `0.1.11|codex-mobile-shell-v625-778d0b55ee22` because this ref changed
    server/test files only;
  - startup-only browser gate passed with blocking/actionable/reportable issue
    codes `[]`;
  - Home AI main phase-B readback passed with `decision.status=ready`,
    `readMode=projection-v4-partial`, `activeFullReadRequired=false`,
    `activeOverlayGate=not-active`, and no active-window downgrade;
  - Codex source/control thread readback passed with
    `readMode=projection-active-overlay`, `activeOverlayGate=ready`, and
    `responseBudgetActiveTurnCount=1`;
  - focused production tests passed `116/116`;
  - source/prod SHA parity matched for the two changed files.
- Residual: default full behavior gate is still not Public-ready due unrelated
  latest-turn/task-card/usage expectation codes:
  `browser_latest_turn_item_below_api_expectation`,
  `browser_turn_task_card_below_api_expectation`, and
  `browser_turn_usage_missing`.
- Privacy: bounded metadata only; no raw user messages, thread/task bodies,
  endpoint bodies, raw logs, screenshots, secrets, cookies, launch tokens,
  provider payloads, database rows, or raw cache JSON stored.

## 2026-07-07 - Direct vs Embedded Plugin Startup AB Readback

- User request: compare direct Codex Mobile startup with Home AI embedded plugin
  startup because direct use felt faster.
- Contract check: central Home AI root-cause contract requires real workflow
  Harness evidence for iframe/plugin boot differences; embedded plugin bugs
  require the embedded iframe path.
- Codex 8787 startup gate:
  - `node scripts/codex-mobile-runtime-self-check-loop.js --server
    http://127.0.0.1:8787 --gate-mode deploy --browser-mode full
    --browser-startup-only --skip-api --skip-client-events --iterations 1
    --json`;
  - passed with direct runtime, Vite preview, app-preview, root/default-root,
    embed, and session surfaces green;
  - served client/cache `0.1.11|codex-mobile-shell-v625-778d0b55ee22`;
  - no blocking startup issue codes.
- Central visual Harness:
  - broker plan for `embedded-plugin-shell` / `codex-mobile` selected
    `browser-mobile` and confirmed Playwright available;
  - unauthenticated browser-mobile child stopped at Home AI login and is not
    valid plugin startup evidence;
  - iOS/PWA central visual path was available through debug server `19073` and
    executed `embedded-plugin-shell` / `codex-mobile` successfully;
  - iOS/PWA evidence: assertions `6/6` passed, plugin shell exists, iframe
    exists with meaningful size, no horizontal overflow, screenshot present,
    authenticated true, Home AI client
    `20260707-wardrobe-action-icon-v1128`.
- Same-debug-lane lightweight AB:
  - direct `http://127.0.0.1:8787/vite-shell/app-preview.html?embed=hermes`
    on iOS live-debug: URL/title correct, app visible, login false;
  - Home AI `http://127.0.0.1:8797/?_hmv=ab-startup` then
    `loadSelectedView:codex`: authenticated, plugin shell/frame meaningful;
  - one URL-verified sample: direct navigation duration `57ms`; Home AI host
    navigation duration `165ms`; plugin iframe prepare/readiness adds roughly
    tens of milliseconds after Home AI is loaded;
  - 5-sample warm-path median from the same live-debug lane: direct open+ready
    `28ms`, plugin host open+prepare+ready `47ms`; navigation medians were
    close (`166ms` direct vs `169ms` Home AI host), but the mixed-origin
    WebView navigation entries showed cache/context reuse and should be treated
    as directional rather than strict lab-grade performance numbers.
- Interpretation: current evidence does not show an embedded plugin startup
  failure. Direct Codex can feel faster because the plugin path includes the
  Home AI shell plus iframe/proxy/session orchestration; the measured warm-path
  overhead is small in current local/iOS debug samples, while cold cache,
  service-worker refresh, or Home AI shell loading can amplify the perceived
  difference.
- Privacy: bounded metadata only. No raw keys, cookies, launch tokens,
  screenshots, raw endpoint bodies, or private thread/message content stored.

## 2026-07-07 - User Behavior Harness Coverage Review

- User request: review whether current user-behavior self-check/Harness coverage
  is broad enough, how the document contract defines it, and whether enforcement
  is hard enough.
- Contract readback:
  - central root-cause contract requires real workflow Harness proof for
    user-visible state synchronization bugs, including optimistic UI,
    submitted echo, projection/detail refresh, message ordering, EventSource,
    iframe/plugin boot, static cache/PWA/native shell differences, and visible
    rows that disappear/duplicate/reorder;
  - after repeated Owner reproduction, no Home AI/plugin/Worker/deploy/audit
    thread should return `completed` from code inspection, logs, or unit tests
    alone; it must include failing-then-passing Harness evidence, return
    `blocked_missing_repro_harness`, or return `partially_completed` with the
    missing Harness path;
  - accepted evidence must stay metadata-only: counts, hashes, thread ids,
    pending/durable item counts, visible DOM row counts, status codes, build ids,
    and timing buckets;
  - acceptance must enter through the owning symptom surface: embedded iframe
    for embedded plugin bugs, installed PWA/native shell for PWA/native bugs,
    production origin/client version for cache/version bugs.
- Current Codex Mobile Harness surfaces found:
  - submitted-message Playwright Harness:
    `scripts/codex-mobile-submitted-message-harness.js`, with app-preview/direct/
    custom entry surfaces, service-worker block/allow/both, button/enter/auto
    submit, sampled windows, API durable item readback, visible DOM node counts,
    POST count, build-hash expectation, and reopen verification;
  - quota popup Playwright Harness:
    `scripts/codex-mobile-quota-popup-harness.js`, with direct/custom/app-preview
    entry surfaces, service-worker block/allow/both, repeated-click support, and
    checks for runtime bridge, aria-expanded, visible panel, and quota labels;
  - runtime/browser behavior gate:
    `scripts/codex-mobile-runtime-self-check-loop.js` dispatches API thread
    self-check, browser-runtime self-check, process-pressure preflight, Vite
    preview/app-preview/root/default-root/embed/session startup surfaces, and
    deploy gate classification;
  - diagnostic/smoke scripts exist for phase-B readback, thread self-check,
    projection replay visual smoke, media render visual smoke, image-order
    visual smoke, PWA shell refresh smoke, and empty-detail cache smoke;
  - Home AI central visual broker and iOS/PWA harness are documented through
    `docs/HOME_AI_PLATFORM_CONTRACT.md`.
- Coverage assessment:
  - strong for the recently failing submitted-message duplicate/disappear/order
    path and quota popup path;
  - adequate for startup/app-preview/ESM/session checks through the runtime gate;
  - partial for embedded/PWA/mobile visual entry paths because the authoritative
    tools live in Home AI central visual harnesses and are not wrapped as a
    first-class Codex Mobile local script;
  - partial for visual smoke families because runtime diagnostic jobs are
    registered as manual jobs with `deployDefaultEnabled=false`;
  - weak as a repo-wide policy because `package.json` exposes
    `check:submitted-harness` and `check:quota-harness`, while the main `check`
    script mostly syntax-checks Harness scripts rather than executing the real
    browser workflows.
- Enforcement assessment:
  - document-level contract is strong enough;
  - implementation-level enforcement is not yet hard enough. Deploy gates can
    fail and still leave a synced build live, then rely on return status/Public
    readiness classification. Harness selection is still per-task/manual rather
    than a mandatory symptom-to-command matrix.
- Recommended closure path:
  - add a Codex Mobile user-behavior Harness contract/matrix that maps symptom
    class to required command(s), target threads/surfaces, service-worker modes,
    and blocking status;
  - add a single `check:user-behavior` entrypoint that runs the required
    submitted-message/quota/runtime gate slices for local/dev validation;
  - add a central-compatible visual script or npm alias so Home AI
    `visual:central --delegate-local` can discover Codex Mobile evidence;
  - make deploy/Public-ready status require the mapped Harness set for the
    changed symptom class, with `completed` allowed only when required Harnesses
    pass on the owning surface.

## 2026-07-07 - User Behavior Harness Enforcement Entrypoints

- User approved implementing the three recommended hardening items from the
  Harness coverage review.
- Added fixed user-behavior bundle:
  - `scripts/codex-mobile-user-behavior-check.js`;
  - npm script `check:user-behavior`;
  - behavior: fails closed when submitted-message, quota, or runtime-submit
    targets are missing; with targets, plans/runs submitted-message Harness for
    each target, quota rapid-click Harness, and full runtime behavior gate with
    submit exercise.
- Added Home AI central visual delegate-local compatibility:
  - `scripts/codex-mobile-central-compatible-visual.js`;
  - npm scripts `visual:central-compatible` and `visual:plugin`;
  - output matches Home AI central broker plugin-local evidence schema with
    metadata-only `schemaVersion`, `pluginId`, `scenario`, `surface`,
    `harnessKind`, `mode`, assertions, client version, and issue codes;
  - when no access key is provided, authenticated Vite artifact readback 401 is
    recorded as `authRequired` instead of failing local supplemental evidence.
- Added local contract/matrix:
  - `docs/USER_BEHAVIOR_HARNESS_CONTRACT.md`;
  - `docs/README.md` now points user-visible duplicate/disappearing message,
    quota popup, embedded/PWA workflow Harness work to that matrix;
  - `docs/HOME_AI_PLATFORM_CONTRACT.md` now records the
    `visual:central-compatible` entry and keeps Home AI iOS/PWA visual evidence
    as final signoff for embedded/PWA regressions.
- Added executable contract tests:
  - `test/user-behavior-harness-contract.test.js`;
  - covers fail-closed missing targets, planned submitted/quota/runtime command
    bundle, central-compatible evidence schema/privacy, package script presence,
    and documented matrix anchors.
- Validation:
  - `node --check scripts/codex-mobile-user-behavior-check.js` passed;
  - `node --check scripts/codex-mobile-central-compatible-visual.js` passed;
  - `node --check test/user-behavior-harness-contract.test.js` passed;
  - `node --test test/user-behavior-harness-contract.test.js` passed `5/5`;
  - `npm run --silent check:user-behavior -- --plan-only
    --submitted-thread-id controlled:019f-controlled --submitted-thread-id
    reported:019f-reported --quota-thread-id 019f-quota
    --runtime-submit-thread-id 019f-controlled --json` passed in plan-only mode
    and produced four planned commands;
  - Home AI central broker delegate-local execution passed:
    `npm run --silent visual:central -- --plugin-id codex-mobile --scenario
    embedded-plugin-shell --delegate-local --plugin-root
    /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --execute
    --json`;
  - `git diff --check -- ':!.agent-context'` passed.
- Privacy: stored only bounded filenames, commands, status, counts, issue-code
  semantics, and non-secret dummy ids. No raw messages, keys, cookies, launch
  tokens, endpoint bodies, screenshots, private thread/task bodies, raw cache
  JSON, provider payloads, or long logs stored.

## 2026-07-07 - Thread Tile DOM Authority Diagnostic Semantics

- AI Ops diagnostic remediation card: `ttc_53a3023460cf7c25cc`;
  case `diagcase_4cbec33fb7c2e9ea927b`.
- Bounded symptom: Home AI embedded-plugin diagnostic
  `empty_visible_detail_mismatch` / `stable_signature_dom_item_mismatch`
  reached H2 threshold on client/cache `0.1.11|codex-mobile-shell-v625-778d0b55ee22`.
- Minimal local log readback showed the event signature came from
  `action=thread-tile-empty-state`, `routeKind=thread-tile`,
  `sourceKind=thread-tile-render`, not the primary single-thread detail path.
- Root cause: pre-render stable-signature DOM authority invalidation for
  thread-tile self-healing reused `recordEmptyVisibleDetailMismatch`, so a
  recoverable tile DOM rewrite was counted as a Home AI H2 failure. The later
  healthy signal did not share the same action/route/thread-hash clear key.
- Source fix:
  - `frontend/native/thread-detail-dom-patch.mjs` and public counterpart now
    suppress Home AI failure recording for thread-tile self-healing invalidation
    while preserving bounded `conversation_dom_authority_invalidated` client
    events with `diagnosticFailureSuppressed=true`;
  - `frontend/native/api-client-runtime.mjs` and public counterpart now let
    empty-detail healthy records inherit action/route/thread-hash/render-mode
    details;
  - `frontend/native/pane-layout-runtime.mjs` and public counterpart pass those
    details from `updateConversationHtml` consistency checks.
- Generated Vite/native ESM artifact after `npm run --silent build:frontend`:
  `clientBuildId=0.1.11|codex-mobile-shell-v625-82df4674ce40`.
- Validation:
  - `node --test test/thread-detail-dom-patch.test.js
    test/conversation-render.test.js test/thread-diagnostic-events.test.js
    test/home-ai-diagnostic-reporting.test.js` passed `274/274`;
  - `node --test test/vite-shell-artifact-service.test.js
    test/vite-shell-asset-graph.test.js
    test/user-behavior-harness-contract.test.js` passed `43/43`;
  - `npm run --silent check` passed;
  - `git diff --check` passed;
  - Home AI fallback governance check over changed runtime/test files passed;
  - `check:user-behavior` correctly failed closed without live target env vars,
    and plan-only with known submitted/quota/runtime targets produced four
    real Harness commands.
- Privacy: metadata only. No raw messages, raw client logs, endpoint bodies,
  cookies, launch tokens, private thread/task bodies, screenshots, raw cache
  JSON, provider payloads, database rows, or long logs stored.

## 2026-07-07 - Submitted-User Incident Worker Repair Cards

- Request: because submitted user-message duplication/disappearance is now rare
  and hard to catch with later visual smoke, create a runtime path that sends a
  repair task card when a real client session observes the issue.
- Added `services/runtime/user-behavior-repair-card-service.js`.
  - Classifies bounded `/api/client-events` metadata for
    `submitted_message_dom_duplicate` and `submitted_message_dom_missing`;
  - accepts both Home AI diagnostic failure events and frontend
    `submitted_echo_lifecycle` `dom-probe` diagnostics;
  - dedupes per source thread, issue code, client build, and time window;
  - creates autonomous `plugin_worker` repair cards with the required
    submitted-message Harness command for the exact source thread;
  - keeps the card body metadata-only: ids, issue codes, build id/hash,
    entry-surface flags, timing/count buckets, and privacy instructions.
- Server wiring:
  - `/api/client-events` now schedules the repair-card classifier in the
    background after logging the original event; the route still returns `204`
    and logs only bounded create/fail outcomes.
  - `server.js` injects `createThreadTaskCardsFromSourceThread` into the new
    service through route composition.
- Runtime controls:
  - default target role is `plugin_worker`;
  - exact target override:
    `CODEX_MOBILE_USER_BEHAVIOR_REPAIR_TARGET_THREAD_ID`;
  - optional target role/workspace:
    `CODEX_MOBILE_USER_BEHAVIOR_REPAIR_TARGET_ROLE`,
    `CODEX_MOBILE_USER_BEHAVIOR_REPAIR_TARGET_WORKSPACE`;
  - dedupe window:
    `CODEX_MOBILE_USER_BEHAVIOR_REPAIR_DEDUPE_WINDOW_MS`;
  - disable switches:
    `CODEX_MOBILE_USER_BEHAVIOR_REPAIR_CARDS_DISABLED=1` or
    `CODEX_MOBILE_USER_BEHAVIOR_REPAIR_CARDS=off`.
- Docs updated:
  - `docs/USER_BEHAVIOR_HARNESS_CONTRACT.md` now defines runtime repair-card
    intake as incident routing, not completion evidence;
  - `docs/MODULES.md` documents the new runtime service boundary.
- Validation:
  - `node --check services/runtime/user-behavior-repair-card-service.js
    server.js test/user-behavior-repair-card-service.test.js
    test/core-api-route-service.test.js test/server-runtime-config-service.test.js`
    passed;
  - `node --test test/user-behavior-repair-card-service.test.js
    test/core-api-route-service.test.js test/server-runtime-config-service.test.js`
    passed `20/20`;
  - `node --test test/user-behavior-repair-card-service.test.js
    test/user-behavior-harness-contract.test.js` passed `10/10`;
  - `npm run --silent check` passed;
  - `git diff --check -- ':!.agent-context'` passed.
- Privacy: metadata only. No raw user message text, endpoint bodies, cookies,
  launch tokens, screenshots, raw cache JSON, private thread/task bodies,
  provider payloads, database rows, or long logs stored.

## 2026-07-07 - Compact Turn Timer Header

- Request: reduce the top-right running status/timer box footprint on portrait
  phones so the current thread title has more horizontal space.
- Source/UI change:
  - `frontend/native/navigation-runtime.mjs` and `public/navigation-runtime.js`
    now render timer text as `00:00:00` instead of `本轮 00:00:00`;
  - `public/index.html` and generated app-preview HTML initial placeholder now
    use `00:00:00`;
  - `public/styles.css` compresses topbar gap, timer padding/font size,
    timer max-width, time column width, and mobile portrait max-width.
- Generated frontend artifact:
  - `npm run --silent build:frontend` produced
    `clientBuildId=0.1.11|codex-mobile-shell-v625-7653c2f963e5`.
- Validation:
  - `node --check frontend/native/navigation-runtime.mjs
    public/navigation-runtime.js test/mobile-viewport.test.js` passed;
  - `node --test test/mobile-viewport.test.js` passed `12/12`;
  - `node --test test/mobile-viewport.test.js
    test/vite-shell-asset-graph.test.js` passed `34/34`;
  - `npm run --silent check:frontend-manifest` passed;
  - `node scripts/verify-vite-shell-manifest.mjs` passed;
  - `npm run --silent check` passed;
  - `git diff --check -- ':!.agent-context'` passed.
- Privacy: source/layout-only change; no raw messages, endpoint bodies, secrets,
  cookies, launch tokens, screenshots, private thread/task bodies, raw cache
  JSON, or long logs stored.

## 2026-07-07 - Plugin Main Routing Preflight Pointer

- Task card: `ttc_5c84b8ce1f94953bd2`.
- Request: update local Codex Mobile guidance after Home AI commit `1c9ab01a`
  strengthened the plugin Worker preflight contract.
- Scope stayed within allowed files: `AGENTS.md`,
  `docs/HOME_AI_PLATFORM_CONTRACT.md`, and this handoff.
- Added `AGENTS.md` pointer requiring plugin main/source threads to run:
  `node /Users/hermes-dev/HermesMobileDev/app/scripts/main-thread-routing-preflight.js --source-thread-role plugin_main --task "<task>" --changed-file <path> --mode classify`
  before non-trivial implementation, investigation, review, Harness,
  deploy-routing, or cross-thread dispatch work.
- Added fail-closed Worker routing guidance: when classification is
  `plugin_worker`, dispatch a bounded `plugin_worker` card or return blocked
  with the missing lane; do not use Task Intake, deploy lanes, audit lanes,
  Loop lanes, or the current source thread as Worker fallback.
- Updated `docs/HOME_AI_PLATFORM_CONTRACT.md` to Home AI platform contract
  `20260707-v7`, added central references to
  `autonomous-delivery-loop-contract.md` and
  `worker-pool-lifecycle-contract.md`, and added local
  `plugin_main_preflight_command` / `plugin_worker_dispatch_policy` rows.
- Validation:
  - initial routing preflight for this pointer update returned
    `classification=inline`;
  - required sample routing preflight returned
    `classification=plugin_worker`, `reasonCode=plugin_worker_required`,
    `inlineAllowed=false`, and issues `[]`;
  - required `plugin-workspace-platform-contract-check.js --plugin codex-mobile
    --json` passed with no issues and one existing nonblocking warning:
    `handoff_pointer_missing`;
  - plugin-local `npm run --silent check` passed;
  - `git diff --check -- ':!.agent-context'` passed.
- Privacy: metadata only. No raw secrets, access keys, cookies, launch tokens,
  endpoint bodies, private thread/message bodies, screenshots, raw logs, or
  long diffs stored.

## 2026-07-07 - Worker Lane Creation Runtime Fix

- Request: fix Worker creation after `thread_lifecycle.create` for
  `plugin_worker` could not create a separate Worker lane.
- Root cause:
  - MCP/server source and production script schema already exposed
    `thread_lifecycle.pluginId`;
  - the current model-visible MCP schema was stale in this session, but the
    deeper runtime blocker was that `createLoopRoleThread()` used
    `applyStartThreadRuntimeSettings()` with default workspace-delegation
    guidance injection;
  - that injected `mcp__codex_mobile` dynamic-tool namespace into `thread/start`
    for internally created Worker/Loop role threads, and app-server rejected it
    as a reserved MCP namespace.
- Fix:
  - `services/task-cards/task-card-runtime-policy-service.js` now supports
    `skipWorkspaceDelegationRuntimeGuidance` for start-thread runtime settings;
  - `services/task-cards/thread-task-card-runtime-service.js` uses that option
    only for internal Loop/Worker role thread creation;
  - ordinary delegated task turns still receive workspace-delegation guidance.
- Validation:
  - `node --test test/task-card-runtime-policy-service.test.js
    test/thread-task-card-runtime-service.test.js
    test/codex-mobile-mcp-server.test.js test/loop-task-runtime.test.js`
    passed `56/56`;
  - `npm run --silent check` passed;
  - `git diff --check -- ':!.agent-context'` passed.
- Privacy: metadata only. No raw secrets, access keys, cookies, launch tokens,
  endpoint bodies, private thread/message bodies, screenshots, raw logs, or
  long diffs stored.

## 2026-07-07 - Active Window Downgrade Diagnostic Readback

- Home AI diagnostic remediation card: `ttc_d2100a75e1b6bb5db1`;
  case `diagcase_b2dc3ac22b104bd5eba7`, event
  `diagevt_c940581bbf7e4e7a86385c8b`.
- Bounded symptom: embedded-plugin `thread_detail_response_contract_mismatch`
  with error code `active-thread-window-downgrade` on build
  `20260707-account-boundary-v1129`.
- Case-specific local/prod-readable log lookup did not find the exact
  case/event/hash in the inspected bounded locations, so no raw diagnostic log
  body was copied or stored.
- Current source planner behavior:
  - `projection-active-overlay` with active and visible projection evidence
    returns `shouldReport=false`, `reason=ok`;
  - an active window with no active/visible evidence still returns
    `shouldReport=true`, `reason=active-thread-window-downgrade`, `H2`.
- Production readback against `http://127.0.0.1:8787`:
  - public config was `0.1.11|codex-mobile-shell-v625-7653c2f963e5`;
  - Home AI source thread `019f316b-27cd-7622-9944-0b909fec3c70` Phase B
    readback passed with warm partial projection and decision `ready`;
  - Codex source thread `019f2d75-39bd-7462-8dca-de24f97aeaf6` with
    `--require-active-overlay` passed with `projection-active-overlay` and
    decision `ready`.
- Diagnosis: current source and deployed active-overlay contract do not
  reproduce the reported downgrade. The strongest bounded hypothesis is that
  the event was stale/transient or came from an active response without
  active/visible projection evidence; that condition remains a valid H2 signal
  rather than a false-positive class to silence.
- No code change or fallback was added for this active-window case.
- Validation:
  - local metadata-only planner probe passed for both accepted overlay and
    empty active-window cases;
  - `node --test test/thread-detail-read-orchestration-service.test.js
    test/thread-performance-metrics.test.js test/thread-diagnostic-events.test.js
    test/home-ai-diagnostic-reporting.test.js test/phase-b-readback-smoke.test.js
    test/runtime-self-check-gate-service.test.js` passed `116/116`;
  - central Home AI `scripts/fallback-governance-check.js --json` passed with
    zero issues and warnings;
  - `npm run --silent check` passed;
  - `git diff --check -- ':!.agent-context'` passed.
- Separate deploy note: the earlier task-card-only empty-detail source fix is
  committed in `79098285` and included in current source `671e8090`, but
  production public config still reports the previous cache. Central deploy
  readback was delegated to deploy lane card `ttc_9bf965654f18b97ff7`.
- Privacy: metadata only. No raw secrets, access keys, cookies, launch tokens,
  endpoint bodies, private thread/message bodies, screenshots, raw diagnostic
  logs, raw cache JSON, provider payloads, database rows, or long logs stored.

## 2026-07-07 - Diagnostic/Worker Runtime Deploy Readback

- Deploy lane return card: `ttc_e3a8b5efc99dc4cc14`.
- Joined deployment request: `ttc_9bf965654f18b97ff7`.
- Requested source ref: `671e8090d1e9417f1275ca587de7abc9074df106`;
  included prior diagnostic fix `79098285`.
- Production cache after deploy:
  `0.1.11|codex-mobile-shell-v625-86de04383378`, newer than previous
  `7653c2f963e5`.
- Backup path:
  `/Users/hermes-host/HermesMobile/backups/deploy/20260707T153621Z-plugin-codex-mobile-web-codex-mobile-worker-lane-creation-fix-671e8090`.
- Readback:
  - central plan/execute passed;
  - listener PID `14781`, socket `*:8787`;
  - `/api/status?detail=1` ready with no issue codes;
  - `/api/vite-shell-artifact` passed with native ESM, 24 published files,
    and zero not-ready modules;
  - source/prod SHA parity matched `26/26` deployable changed files.
- Validation:
  - central startup-only gate passed;
  - central full behavior gate passed;
  - focused production tests for task-card runtime policy, thread-task-card
    runtime, Codex Mobile MCP server, and loop task runtime passed `56/56`;
  - Phase-B projection smoke for thread `019f2d75-39bd-7462-8dca-de24f97aeaf6`
    passed with decision `ready`, read mode `projection-v4-partial`, read
    decision `projection-partial-hit`, and no issue codes.
- Worker lane side effect:
  - production `thread_lifecycle.create` validated the worker-lane creation fix;
  - created plugin worker `019f3d3c-6311-7431-8f10-31defdc62a43` for
    `codex-mobile-web` purpose `pr_absorption`;
  - deliverable `true`, lifecycle `available`, distinct from busy Worker
    `019f3181-4f2f-7aa3-8ae8-d12f6e23e7a5`.
- Residual:
  - independent default full-gate follow-up after deploy reported
    `thread_detail_empty`;
  - deploy lane classified it as residual default-thread/projection follow-up
    evidence, not a blocker for this joined deploy/readback because central
    execute gates and explicit projection smoke were green.
- Privacy: metadata only. No raw secrets, access keys, cookies, launch tokens,
  endpoint bodies, private thread/message bodies, screenshots, raw cache JSON,
  provider payloads, database rows, or long logs stored.
