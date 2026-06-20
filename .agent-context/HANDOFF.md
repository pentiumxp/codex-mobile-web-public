# HANDOFF

Last compacted: 2026-06-08T13:27:43.304Z

## 2026-06-20 Public-Derived Private Branch Correction

- Status: corrected locally and pushed to private origin; public branch was not
  changed by this correction.
- User clarified the repository rule:
  - `public/main` is the public canonical branch for publishable files.
  - local/private `main` should be derived from `public/main`, with private-only
    context layered on top, so the histories do not fork into equivalent but
    separate public/private release commits.
- Fix applied:
  - Created `private-from-public-sync-20260620` from `public/main`.
  - Merged the previous private `main` into it. The merge introduced only
    tracked `.agent-context/HANDOFF.md` and `.agent-context/PROJECT_CONTEXT.md`.
  - Fast-forwarded local `main` to the resulting merge commit.
  - Added this durable rule to `.agent-context/PROJECT_CONTEXT.md`.
- Verification:
  - `git log --first-parent` now shows private `main` descending from
    `777da93` (`public/main`) through merge commit `0ed0d86`.
  - Required final checks before ending: `git merge-base --is-ancestor
    public/main main` should exit 0, and `git diff --stat public/main..main --
    ':!.agent-context'` should be empty.

## 2026-06-19 ChatGPT Pro MCP Pending Task-Card Delegation

- Status: implemented, validated, committed, and pushed to private and public;
  not deployed in this turn.
- Source commits:
  - Private: `0294bc0` `feat: 添加 ChatGPT Pro MCP 任务卡委派`
  - Public: `777da93` `feat: 发布 ChatGPT Pro MCP 任务卡委派`
- User-visible/API change:
  - `POST /api/chatgpt-pro/mcp` now exposes `delegate_to_codex_thread`.
  - The tool lets ChatGPT Pro create cross-thread task cards for Codex threads.
  - Default mode is `pending`; target threads must still approve before any
    injected Codex turn starts.
  - `mode:"draft"` stores only a runtime planner/task-card draft artifact.
  - `mode:"direct"` is rejected unless the server is explicitly started with
    `CODEX_MOBILE_CHATGPT_PRO_MCP_ALLOW_DIRECT_TASK_CARDS=1`.
  - MCP responses return bounded card metadata only; task body and raw approval
    execution payloads are not echoed back to ChatGPT.
  - No PWA shell cache change.
- Implementation notes:
  - `server.js` now reuses a shared
    `createThreadTaskCardsFromSourceThread()` helper for both the thread-callable
    task-card route and MCP delegation.
  - The existing `/api/threads/:sourceThreadId/task-cards` route still defaults
    to source-thread direct approval for trusted Codex-thread/tool calls unless
    `pending:true` or `autoApprove:false` is passed.
  - The MCP adapter passes `pending:true` by default, preserving target approval
    for ChatGPT-originated cards.
- Files changed:
  - `adapters/chatgpt-pro-mcp-service.js`
  - `server.js`
  - `test/chatgpt-pro-mcp-service.test.js`
  - `test/chatgpt-pro-bridge-service.test.js`
  - `README.md`
  - `docs/ARCHITECTURE.md`
  - `docs/CHATGPT_PRO_PLANNER_CONNECTOR_DESIGN.md`
  - `docs/MODULES.md`
- Validation:
  - `node --test test/chatgpt-pro-mcp-service.test.js test/chatgpt-pro-bridge-service.test.js test/thread-task-card-service.test.js test/thread-task-card-route.test.js`
    passed: 35 tests.
  - `npm run check` passed.
  - `git diff --check` passed.
  - Center required check passed:
    `node tests/architecture-code-test-harness-map.test.js`.
  - `npm test` passed: 523 tests.
  - Public worktree validation passed:
    `npm run check`,
    `node --test test/chatgpt-pro-mcp-service.test.js test/chatgpt-pro-bridge-service.test.js test/thread-task-card-service.test.js test/thread-task-card-route.test.js`,
    and `git diff --cached --check`.
  - AI Ops evidence ledger:
    `evidence-32aae9fa-3eae-4758-bb8f-fff60dc3c1b0`.

## 2026-06-19 Thread-Callable Direct Task-Card Interface

- Status: implemented, validated, committed, and pushed to private; public
  files were included in public commit `777da93`; not deployed in this turn.
- Source commits:
  - Private: `5409e1f` `feat: 添加线程直发任务卡接口`
  - Public: `777da93` `feat: 发布 ChatGPT Pro MCP 任务卡委派`
- User-visible/API change:
  - Existing browser/user task-card flow remains unchanged:
    `POST /api/thread-task-cards` still creates pending cards that require
    target-thread approval before injection.
  - New thread-callable route:
    `POST /api/threads/:sourceThreadId/task-cards`.
    It infers the source thread from the URL, accepts target thread ids or
    exact target titles, stores normal task-card audit state, and defaults to
    source-thread direct approval.
  - Direct cards call `threadTaskCardService.approveFromSource()`, bypass the
    target pending approval UI, and inject a real target-thread turn. Stored
    card metadata records `delivery.approvalMode="source_thread_direct"` and
    `audit.targetApprovalBypassed=true`.
  - Passing `pending:true` or `autoApprove:false` to the new route keeps the
    card in the original manual pending flow.
- CLI:
  - Added `scripts/create-thread-task-card.js` as the supported local wrapper
    for Codex-thread/tool initiated delegation.
  - It reads the Codex Mobile access key from env or
    `$HOME/.codex-mobile-web/access_key`, sends it as an Authorization header,
    and does not print key material.
  - Prefer `--body-file` or `--json-file` for long or Chinese task bodies.
- Files changed:
  - `server.js`
  - `adapters/thread-task-card-service.js`
  - `scripts/create-thread-task-card.js`
  - `package.json`
  - `test/thread-task-card-service.test.js`
  - `test/thread-task-card-route.test.js`
  - `README.md`
  - `docs/ARCHITECTURE.md`
  - `docs/COMPLEX_FEATURE_PATHS.md`
  - `docs/CROSS_THREAD_TASK_CARDS_DESIGN.md`
  - `docs/CROSS_THREAD_TASK_CARDS_IMPLEMENTATION.md`
  - `docs/MODULES.md`
- Validation:
  - `node --test test/thread-task-card-harness.test.js test/thread-task-card-service.test.js test/thread-task-card-route.test.js test/conversation-render.test.js`
    passed: 77 tests.
  - `npm run check` passed.
  - Center required checks passed:
    `node tests/architecture-code-test-harness-map.test.js`.
  - `git diff --check` passed.
  - `npm test` passed: 520 tests.
  - `npm run check:macos` passed.
  - `node scripts/create-thread-task-card.js --help` printed the expected
    bounded usage text.

## 2026-06-19 v313 Superseded Live User-Message Projection Fix

- Status: implemented, validated, committed, and pushed to private and public.
  Deployment was started with `--restart auto` but was interrupted before
  completion, so production v313 is not confirmed from this thread. Do not
  assume the server-side prune is active in production until
  `/api/public-config` reports `0.1.11|codex-mobile-shell-v313` and the
  listener has been read back after a controlled restart.
- User-visible issue:
  - Opening the Music thread could show a stack of old user-message bubbles from
    historical `mobileSupersededLive` shells.
  - Those shells could occupy the recent projected turn window, making the
    latest assistant receipt hard or impossible to see.
- Fix:
  - `public/app.js` hides `userMessage` items inside superseded live turns and
    continues to suppress usage-only superseded shells.
  - `adapters/thread-detail-projection-service.js` prunes user-only superseded
    live shells before `trimTurns`, removes stale user/reasoning items from
    retained superseded turns, and keeps only meaningful assistant/plan, image,
    or context-compaction content.
  - `server.js` now normalizes and prunes superseded live shells before compact
    turn trimming, so stale shells no longer push recent receipts out of the
    bounded response.
  - PWA shell cache advanced to `codex-mobile-shell-v313`.
- Validation:
  - `node --check public/app.js && node --check public/sw.js && node --check adapters/thread-detail-projection-service.js && node --check server.js` passed.
  - Focused tests passed:
    `node --test test/conversation-render.test.js test/thread-detail-projection-service.test.js test/thread-item-timestamp-enrichment.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js test/app-update.test.js`.
  - Additional focused tests passed:
    `node --test test/collab-agent-render.test.js test/tool-output-image-projection.test.js`.
  - `npm run check`, `npm run check:macos`, `git diff --check`, and
    `npm test` passed; full test count: 517.
  - Center AI Ops required-checks classified the touched files as H3 and
    `node tests/architecture-code-test-harness-map.test.js` passed.
- Source commits:
  - Private `origin/main`: `2567431 fix: 修复 superseded live 旧消息投影`.
  - Public `public/main`: `3d967a4 fix: 修复 superseded live 旧消息投影`.
  - Public commit excludes `.agent-context`; it includes README Chinese release
    notes, source, and tests only.
  - Public worktree validation passed `npm run check`, `npm run check:macos`,
    `git diff --check`, and `npm test` after using a temporary untracked
    `node_modules` symlink for the disposable worktree; full test count: 517.
- Deployment note:
  - Pre-deploy production readback showed
    `/api/public-config.clientBuildId=0.1.11|codex-mobile-shell-v312`,
    listener PID `10805`, and active profile `default`.
  - The attempted command was:
    `npm run --silent deploy:macos -- --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --restart auto --health-url http://127.0.0.1:8787/api/public-config --allow-dirty --execute --json`.
  - The command was aborted/interrupted; no production backup/readback/evidence
    was captured after it.

## 2026-06-19 v312 In-App Dialog Replacement

- Status: implemented, validated, deployed to Mac production with
  `--restart none`, and later included in the private/public v313 source
  commits listed above.
- User-visible issue:
  - In the iOS shell, tapping the `PR` button after a Public PR was detected
    did not show the confirmation dialog.
  - The automatic Public PR prompt had the same invisible-dialog risk.
- Fix:
  - Added a generic page-level in-app dialog (`#appNativeDialog`) supporting
    alert, confirmation, and multiline text input modes.
  - Replaced every remaining user-triggered `window.alert`,
    `window.confirm`, and `window.prompt` path in `public/app.js` with the
    in-app dialog helpers.
  - Covered Public PR auto/manual prompts, app update notices/confirmation,
    side-chat clear confirmation, thread task-card create/reply inputs, and
    removed the non-embedded native-confirm fallbacks for Profile switch and
    thread archive.
  - Advanced the static shell to `codex-mobile-shell-v312`.
- Validation:
  - `rg -n "window\\.(alert|confirm|prompt)|\\balert\\(|\\bconfirm\\(|\\bprompt\\(" public/app.js`
    found no matches.
  - `node --check public/app.js && node --check public/sw.js` passed.
  - Focused tests passed:
    `node --test test/app-update.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js test/codex-profile-ui.test.js test/thread-archive.test.js`
    passed: 42 tests.
  - `npm run check` passed.
  - `git diff --check` passed.
  - Center required-checks classified the change as H3, and
    `node tests/architecture-code-test-harness-map.test.js` passed.
  - `npm test` passed: 515 tests.
- Deployment:
  - Command:
    `npm run --silent deploy:macos -- --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --restart none --health-url http://127.0.0.1:8787/api/public-config --allow-dirty --execute --json`
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260619T125046Z-plugin-codex-mobile-web-manual`
  - Production readback confirmed:
    `/api/public-config.clientBuildId=0.1.11|codex-mobile-shell-v312`,
    `/api/public-config.shellCacheName=codex-mobile-shell-v312`, served
    `/index.html` has `#appNativeDialog`, served `/app.js` reports v312 and
    has no native dialog API matches, and served `/sw.js` contains
    `codex-mobile-shell-v312`.
  - `restartLabels` was empty; `launchctl` still showed listener PID `10805`.
  - Evidence ledger record:
    `evidence-4180c0cd-08e4-4571-93c8-58bfa74ecc4b`.

## 2026-06-19 Public PR #73 Thread List Stale Status Fix

- Status: public PR evaluated, merged, pushed to public, then reverse-synced to
  private and revalidated.
- Public PR:
  - `pentiumxp/codex-mobile-web-public#73`
  - Title: `fix: 防止线程列表 stale 状态覆盖已知状态`
  - Base was current public main `f82a02b`; PR head `2118828`.
  - Merge commit in public mirror: `9b3bce3`.
  - Public README release-note commit: `b04a62d`.
  - GitHub PR state read back as `MERGED`.
- Scope:
  - Server-only thread-list/display-summary cache merge fix.
  - No PWA shell cache bump.
  - Public README Chinese release note added.
  - No `.agent-context`, runtime state, local secrets, uploads, or
    machine-specific diagnostics were copied into public.
- Public validation:
  - `node --check server.js adapters/push-notification-service.js
    test/push-notification-service.test.js test/thread-visibility.test.js`
    passed.
  - `node --test test/push-notification-service.test.js
    test/thread-visibility.test.js` passed: 44 tests.
  - `npm run check`, `npm run check:macos`, and `npm test` passed:
    514 tests.
  - Center `node tests/architecture-code-test-harness-map.test.js` passed.
  - `git diff --check origin/main..HEAD` and final privacy scan passed; privacy
    scan only matched README policy text.
  - Evidence ledger record:
    `evidence-44343e0f-6a98-42c7-bd34-908bedb8cb97`.
- Private sync:
  - Reverse-merged public main into private with merge commit `253d505`.
  - README conflict resolved by keeping the public #73 release note before
    v311.
  - Committed private/public source diff is empty excluding `.agent-context`.
  - Existing uncommitted private working-tree changes remain in
    `public/app.js`, `public/index.html`, and `public/styles.css`; they were
    not included in public PR #73 sync commits.
- Private validation:
  - `node --check server.js adapters/push-notification-service.js
    test/push-notification-service.test.js test/thread-visibility.test.js
    public/app.js` passed.
  - `node --test test/push-notification-service.test.js
    test/thread-visibility.test.js` passed: 44 tests.
  - `npm run check`, `npm run check:macos`, and `npm test` passed:
    514 tests.
  - Center `node scripts/plugin-workspace-platform-contract-check.js --plugin
    codex-mobile --json` passed with only existing
    `handoff_pointer_missing` warning.
  - Center `node tests/architecture-code-test-harness-map.test.js` passed.
  - `git diff --check HEAD^..HEAD` and working-tree `git diff --check` passed.
  - Privacy diff scan excluding `.agent-context` found no committed
    public/private source leak.
  - Evidence ledger record:
    `evidence-b35267b2-42f4-4bb1-be6a-4e1ce27bc9eb`.

## 2026-06-19 v311 Runtime Picker Overlay Fix

- Status: implemented, validated, and deployed to Mac production with
  `--restart none`; not committed or pushed.
- User-visible issue:
  - The navigation version button proved the PWA/WebView was already running
    v310, but Composer model, reasoning-effort, and permission controls still
    could not open their option menus.
- Fix:
  - Moved `#composerRuntimeMenu` and `#quotaDetailPanel` out of the Composer
    form/control row into page-level overlay DOM, matching the existing
    `#composerIntentMenu` placement.
  - Raised runtime/quota overlay z-index to `130`.
  - Changed the runtime control touch/click fallback so the synthetic click
    after a handled `pointerdown` is swallowed only once for the same button,
    avoiding same-tap open/close races.
  - PWA shell cache advanced to `codex-mobile-shell-v311`.
- Validation:
  - `node --test test/composer-quota.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js test/app-update.test.js`
    passed: 34 tests.
  - `node --check public/app.js && node --check public/sw.js` passed.
  - `npm run check` passed.
  - `git diff --check` passed.
  - Center deploy checks passed:
    `node --check scripts/deploy-macos-production.js`,
    `node tests/macos-production-deploy-script.test.js`,
    `node tests/production-status-smoke-harness.test.js`,
    `node tests/architecture-code-test-harness-map.test.js`.
- Deployment:
  - Command:
    `npm run --silent deploy:macos -- --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --restart none --health-url http://127.0.0.1:8787/api/public-config --allow-dirty --execute --json`
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260619T114709Z-plugin-codex-mobile-web-manual`
  - Production readback confirmed:
    `/api/public-config.clientBuildId=0.1.11|codex-mobile-shell-v311`,
    `/api/public-config.shellCacheName=codex-mobile-shell-v311`, served
    `/index.html` has runtime/quota overlays after `</form>`, served
    `/app.js` contains the same-button pointer/click guard, and served
    `/sw.js` contains `codex-mobile-shell-v311`.
  - `launchctl` still showed the same running listener PID `10805`.
  - Evidence ledger record:
    `evidence-2babb030-5c02-4f35-9635-78543d7f7246`.

## 2026-06-19 v310 Navigation Client Build Display

- Status: implemented, validated, and deployed to Mac production with
  `--restart none`; not committed or pushed.
- User-visible change:
  - The existing navigation-menu version button now shows both the app version
    and the currently loaded client shell, for example
    `v0.1.11 · 客户端 v310`.
  - The client value comes from the browser-loaded `CLIENT_BUILD_ID`, so it can
    reveal when a PWA/WebView is still running an old shell after the server has
    updated.
- Files changed for this fix:
  - `public/app.js`
  - `public/sw.js`
  - `README.md`
  - `test/app-update.test.js`
  - shell-cache assertion tests
- Validation:
  - `node --test test/app-update.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js test/composer-quota.test.js`
    passed: 34 tests.
  - `node --check public/app.js && node --check public/sw.js` passed.
  - Center deployment checks passed:
    `node --check scripts/deploy-macos-production.js`,
    `node tests/macos-production-deploy-script.test.js`,
    `node tests/production-status-smoke-harness.test.js`,
    `node tests/architecture-code-test-harness-map.test.js`.
  - `npm run check` passed.
  - `git diff --check` passed.
- Deployment:
  - Command:
    `npm run --silent deploy:macos -- --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --restart none --health-url http://127.0.0.1:8787/api/public-config --allow-dirty --execute --json`
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260619T113646Z-plugin-codex-mobile-web-manual`
  - `restartLabels` was empty, and `launchctl` still showed the same running
    listener PID `10805`.
  - Production readback confirmed:
    `/api/public-config.clientBuildId=0.1.11|codex-mobile-shell-v310`,
    `/api/public-config.shellCacheName=codex-mobile-shell-v310`, served
    `/app.js` contains `clientBuildVersionText`, and served `/sw.js` contains
    `codex-mobile-shell-v310`.

## 2026-06-19 v309 Runtime Picker Reset Hotfix

- Status: implemented, validated, and present in the production source sync;
  not committed or pushed. The active production listener already reports
  `defaultPermissionMode=full` and `clientBuildId=0.1.11|codex-mobile-shell-v310`.
- User-visible issue:
  - After a local Reset used to recover Music workspace access, the Composer
    model, reasoning-effort, and permission controls no longer opened their
    option lists in the mobile shell.
  - The permission chip could show/use custom config instead of the expected
    full-access mode.
- Runtime evidence:
  - Active `/Users/xuxin/.codex/config.toml` currently has
    `sandbox_mode = "danger-full-access"`.
  - Authenticated current-thread detail for this Codex Mobile thread returned
    `runtimeSettings.permissionMode = "full"` and
    `sandboxPolicyType = "dangerFullAccess"`.
  - Production still reported `clientBuildId=0.1.11|codex-mobile-shell-v307`
    before this local fix.
- Fix:
  - `server.js` now exposes a bounded `defaultPermissionMode` in
    `/api/public-config`, derived from `config.toml` sandbox defaults.
  - `public/runtime-settings.js` and `public/app.js` now prefer that default
    permission mode before falling back to option order.
  - Existing `custom` draft values are normalized to `full` when the active
    default permission mode is full, so stale local state does not visually or
    behaviorally override full access after Reset.
  - Runtime picker buttons now have a click fallback in addition to pointerdown,
    plus bounded client events for ignored/open/closed runtime menus.
  - Runtime and quota popups now position from the clicked button and
    `visualViewport`, and set a bounded popup max height.
  - PWA shell cache advanced to `codex-mobile-shell-v309`.
- Files changed for this fix:
  - `server.js`
  - `public/app.js`
  - `public/runtime-settings.js`
  - `public/styles.css`
  - `public/sw.js`
  - `README.md`
  - `test/runtime-settings.test.js`
  - `test/composer-quota.test.js`
  - `test/new-thread-ui.test.js`
  - `test/new-thread-route.test.js`
  - shell-cache assertion tests
- Validation:
  - `node --check public/app.js && node --check public/runtime-settings.js && node --check server.js`
  - `node --test test/runtime-settings.test.js test/composer-quota.test.js test/new-thread-ui.test.js test/new-thread-route.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
    passed: 57 tests.
  - `npm run check` passed.
  - `git diff --check` passed.
  - `npm test` passed: 511 tests.
- Operational note:
  - This includes a server public-config shape change, so production needs a
    controlled listener reload before iOS clients can receive
    `defaultPermissionMode`. Do not restart automatically while user has active
    turns.

## 2026-06-19 Music Workspace Trust Sync Fix

- Status: implemented and validated locally; not committed, pushed, deployed,
  or production-restarted.
- Immediate local repair:
  - Added `[projects."/Users/xuxin/Documents/Music"] trust_level = "trusted"`
    to the active profile config `/Users/xuxin/.codex/config.toml`.
  - Backup before the edit:
    `/Users/xuxin/.codex/config.toml.bak-20260619-music-trust`.
- Root cause update:
  - Music was a Mobile-created workspace under `/Users/xuxin/Documents/Music`.
  - The active `default` profile config did not include Music as a trusted
    project, while `/Users/xuxin/.codex-homes/previous/config.toml` did.
  - The profile switch itself happened earlier, but the failure appeared after
    app-server/daemon restart because the fresh active-profile app-server no
    longer had the prior in-memory/profile context for that workspace.
  - Home AI and the current Codex Mobile plugin workspace still worked because
    they are trusted in the active profile and are not the same protected
    `~/Documents/Music` workspace boundary.
- Code fix:
  - Added `adapters/codex-project-trust-service.js` to append missing
    `[projects."<cwd>"] trust_level = "trusted"` entries idempotently.
  - `workspace-registry-service` now exposes raw `registeredPaths()` so Mobile
    registry workspaces can be trusted even if `list()` filters unavailable
    directories.
  - `server.js` syncs registered workspace trust for:
    - active profile on real server startup;
    - newly created Mobile workspaces;
    - target profile before profile-switch restart.
  - Fixed `codexAppServerChildEnv(extra)` ordering so profile-switch preflight
    can pass the target `CODEX_HOME` without being overwritten by the currently
    active profile home.
- Files changed for this fix:
  - `adapters/codex-project-trust-service.js`
  - `adapters/workspace-registry-service.js`
  - `server.js`
  - `test/codex-project-trust-service.test.js`
  - `test/workspace-registry-service.test.js`
  - `test/new-thread-route.test.js`
  - `test/manual-restart-ui.test.js`
- Validation:
  - `node --check adapters/codex-project-trust-service.js && node --check adapters/workspace-registry-service.js && node --check server.js`
  - `node --test test/codex-project-trust-service.test.js test/workspace-registry-service.test.js test/new-thread-route.test.js test/manual-restart-ui.test.js`
  - `npm run check`
  - `npm test` passed: 509 tests.
  - `git diff --check`
- Operational note:
  - Existing running app-server may still need a controlled restart to reload
    `config.toml`; do not restart automatically while user has active turns.

## 2026-06-19 v308 Blank Completed Receipt Fix / Music Permission Diagnosis

- Status: implemented and validated locally; not committed, pushed, deployed,
  or production-restarted.
- User-visible issue:
  - In the Home AI thread detail, recent assistant receipts could appear as
    blank completed blocks with only usage chips at the bottom.
- Root cause:
  - Server projection can expose superseded live-turn shells marked
    `mobileSupersededLive`.
  - Some shells contain only `turnUsageSummary`; the browser treated that as a
    visible item and rendered an empty completed receipt area.
- Fix:
  - `visibleItemsForTurn()` now hides superseded live shells only when every
    visible item is a usage summary.
  - Completed turns with real user/assistant content still keep usage summary
    rendering.
  - PWA shell cache advanced to `codex-mobile-shell-v308`.
- Files changed:
  - `public/app.js`
  - `public/sw.js`
  - `README.md`
  - `test/conversation-render.test.js`
  - `test/collab-agent-render.test.js`
  - `test/mobile-viewport.test.js`
  - `test/thread-goal-service.test.js`
  - `test/thread-task-card-route.test.js`
- Validation:
  - Home AI AI Ops intake and required-checks were run; classified H3.
  - `node --test test/collab-agent-render.test.js test/conversation-render.test.js`
  - `npm test` passed: 506 tests.
  - `npm run check` passed.
  - `git diff --check`
  - Center `node tests/architecture-code-test-harness-map.test.js` passed.
  - Evidence ledger record:
    `evidence-eec041bf-98b5-4a91-a359-f96474cd5966`.
- Deployment note:
  - No normal deploy/restart was performed because the user reported that
    recent restarts disrupted other active Codex Mobile turns.
  - If deploying this frontend-only fix, prefer the central Mac deploy path
    with `--restart none` and static/readback verification when feasible.
- Music permission diagnosis performed during the same investigation:
  - Production listener is still a system LaunchDaemon
    `system/com.hermesmobile.plugin.codex-mobile`, running as `xuxin`.
  - The managed app-server child is `/Users/xuxin/.local/bin/codex app-server`;
    that binary reports `codex-cli 0.137.0`, while
    `/Applications/Codex.app/Contents/Resources/codex` reports
    `codex-cli 0.140.0-alpha.2`.
  - The Music thread rollout was created by `codex-mobile-web` with
    `cli_version=0.137.0` and `cwd=/Users/xuxin/Documents/Music`, so it was not
    a Desktop-origin thread.
  - The failing Music turns had `sandbox_policy.type=danger-full-access` and
    `permission_profile.type=disabled`, but tool outputs still showed
    `ls: .: Operation not permitted`, `ls: /Users/xuxin/Documents: Operation not
    permitted`, and sqlite `authorization denied`.
  - Current direct shell checks as `xuxin` can stat/read the Music workspace
    paths and show normal ownership, so this is not ordinary chmod/owner drift.
    Treat it as a per-process macOS privacy/TCC or tool-execution entitlement
    issue in the running app-server chain, not as a user workspace permission
    mistake.

## 2026-06-19 v307 ChatGPT Pro MCP / UI Stabilization / Status Hint Deployment

- Status: committed locally and deployed to Mac production; not pushed.
- Commits:
  - `7e33c0c` `feat: add ChatGPT Pro MCP connector and v307 status fixes`
- Deployment:
  - Target: `plugin:codex-mobile-web`
  - Production path:
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`
  - Production owner: `xuxin:staff`
  - Restart label: `com.hermesmobile.plugin.codex-mobile`
  - Backup path:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260619T100253Z-plugin-codex-mobile-web-manual`
  - The first `--execute` command was interrupted from the Codex tool view, but
    production readback showed the deploy had already completed. To avoid a
    second restart, the deploy was not rerun.
- Production readback:
  - `/api/public-config` reports
    `clientBuildId=0.1.11|codex-mobile-shell-v307`,
    `shellCacheName=codex-mobile-shell-v307`, and production workspace path.
  - Plugin manifest returns `plugin_id=codex-mobile`, `kind=embedded_app`,
    `entry.url` present, `program_api` present, and no raw access key marker in
    the bounded manifest projection.
  - `launchctl print system/com.hermesmobile.plugin.codex-mobile` reports
    `state=running`; stdout/stderr are under
    `/Users/xuxin/.codex-mobile-web/logs`.
  - Source and production hashes matched for `public/app.js`, `server.js`, and
    `adapters/chatgpt-pro-mcp-service.js`.
  - Authenticated bounded smoke returned HTTP 200 for
    `/api/status?detail=1` and `/api/chatgpt-pro/planner/status` without
    printing keys.
- Validation before deploy:
  - `node --check public/app.js && node --check public/sw.js`
  - Focused thread/list/UI tests: 87 tests passed.
  - Center `node tests/architecture-code-test-harness-map.test.js` passed.
  - `git diff --check` passed.
  - `npm run check` passed.
  - `npm test` passed: 505 tests.
  - `npm run check:macos` passed.
  - Center deployment checks passed:
    `node --check scripts/deploy-macos-production.js`,
    `node tests/macos-production-deploy-script.test.js`,
    `node tests/production-status-smoke-harness.test.js`.
  - Center deploy plans were generated for Home AI and Codex plugin target.
- Evidence ledger records:
  - `evidence-20d05c12-201a-4840-9976-0b7938528253` for v307 local/focused
    status-hint tests.
  - `evidence-f6d6e673-e874-4eea-a6aa-37b47535122a` for production deploy
    readback.
  - `evidence-23a324ba-2c80-46f8-b453-1bf4efbe76d1` for authenticated
    production smoke.

## 2026-06-19 Thread List Running Status Hint v307

- Status: implemented, validated locally, and included in production deployment
  above.
- User-visible issue:
  - Thread list rows could continue to show a working/running status after the
    underlying thread had already stopped.
- Root cause:
  - The mobile client intentionally keeps a local `runningThreadIds` hint so a
    temporary `notLoaded` list refresh does not erase a live thread state.
  - That hint was only cleared for completed/failed-style terminal statuses.
    App-server list rows can report stopped threads as `idle`, which was not
    treated as a settled thread-list status.
  - `statusIconInfo()` could also let the stale local running hint override an
    `idle` row before reconciliation expired it.
- Fix:
  - Added `isThreadListSettledStatus()` for list-row settled states including
    `idle`, completed, failed, cancelled, interrupted, and stopped variants.
  - `reconcileThreadStatusHints()` now clears local running hints immediately
    when a settled status arrives, while still preserving hints across
    `notLoaded` refreshes.
  - `statusIconInfo()` no longer renders a local running hint over a settled
    row status.
  - PWA shell cache advanced to `codex-mobile-shell-v307`.
- Files changed:
  - `public/app.js`
  - `public/sw.js`
  - `README.md`
  - `test/conversation-render.test.js`
  - `test/mobile-viewport.test.js`
  - `test/thread-goal-service.test.js`
  - `test/thread-task-card-route.test.js`
- Validation:
  - Home AI AI Ops intake and required-checks were run; classified H3 and no
    visual lane/deployment was required.
  - `node --check public/app.js && node --check public/sw.js`
  - `node --test test/conversation-render.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js test/thread-visibility.test.js` (87 tests)
  - `cd /Users/hermes-dev/HermesMobileDev/app && node tests/architecture-code-test-harness-map.test.js`
  - `git diff --check`
  - `npm run check`
  - `npm test` (505 tests)
  - Evidence ledger record:
    `evidence-20d05c12-201a-4840-9976-0b7938528253`.

## 2026-06-19 ChatGPT Pro MCP Connector Server Implementation

- Status: implemented and validated locally; not committed, pushed, deployed,
  restarted, or production-smoked.
- Scope:
  - Implemented the server-side ChatGPT Pro MCP Connector core for planner and
    reviewer workflows.
  - This does not yet add a full Mobile artifact inbox/apply UI. Artifacts can
    be written through MCP and read through authenticated planner artifact
    routes.
- New runtime/auth boundary:
  - MCP endpoint: `POST /api/chatgpt-pro/mcp`.
  - Status/debug endpoint with the same MCP auth: `GET /api/chatgpt-pro/mcp`.
  - Browser-authenticated app routes:
    - `GET /api/chatgpt-pro/planner/status`
    - `GET /api/chatgpt-pro/planner/artifacts`
    - `POST /api/chatgpt-pro/planner/artifacts`
    - `GET /api/chatgpt-pro/planner/artifacts/:id`
  - MCP auth is separate from the normal Codex Mobile Access Key and is read
    only from `CODEX_MOBILE_CHATGPT_PRO_MCP_TOKEN` or
    `CODEX_MOBILE_CHATGPT_PRO_MCP_TOKEN_FILE`.
  - Runtime artifacts are stored under `chatgpt-pro-planner` inside the Codex
    Mobile runtime root.
- Implemented tool boundary:
  - `codex_mobile_status`
  - `list_visible_workspaces`
  - `read_thread_context`
  - `read_allowed_repo_file`
  - `create_planner_artifact`
  - `prepare_codex_goal`
  - `create_task_card_draft`
  - `list_planner_artifacts`
  - `read_planner_artifact`
  - No source writes, shell execution, approvals, arbitrary file reads, raw
    rollout reads, upload reads, or Codex turn starts are exposed.
- Files added:
  - `adapters/chatgpt-pro-planner-service.js`
  - `adapters/chatgpt-pro-mcp-service.js`
  - `test/chatgpt-pro-planner-service.test.js`
  - `test/chatgpt-pro-mcp-service.test.js`
- Files updated:
  - `server.js`
  - `package.json`
  - `README.md`
  - `docs/ARCHITECTURE.md`
  - `docs/MODULES.md`
  - `docs/COMPLEX_FEATURE_PATHS.md`
  - `docs/CHATGPT_PRO_PLANNER_CONNECTOR_DESIGN.md`
  - `test/chatgpt-pro-bridge-service.test.js`
- Validation:
  - `node --check adapters/chatgpt-pro-planner-service.js && node --check adapters/chatgpt-pro-mcp-service.js && node --check server.js`
  - `node --test test/chatgpt-pro-planner-service.test.js test/chatgpt-pro-mcp-service.test.js test/chatgpt-pro-bridge-service.test.js` (13 tests)
  - `npm run check`
  - `npm test` (505 tests)
  - `git diff --check`
  - Home AI AI Ops intake and required-checks were run.
  - Center checks passed:
    `node tests/architecture-code-test-harness-map.test.js`,
    `node tests/hermes-plugin-service.test.js`,
    `node tests/hermes-plugin-authorization-service.test.js`,
    `node tests/plugin-capability-activation-service.test.js`,
    `node tests/plugin-workspace-platform-contract-check.test.js`.
  - Evidence ledger record:
    `evidence-7fd8abd3-8bcb-4f5f-8e81-1f1f7ddfbca3`.
- Notes:
  - The current worktree also still includes the previous uncommitted v306
    frontend jitter stabilization changes and the planner design document from
    the prior step. Keep those scopes visible before committing.

## 2026-06-19 Profile Switch Restart Prompt v301

- Status: implemented and validated locally; deployment requested next.
- User-visible issue:
  - After a successful Codex Profile switch, the top
    `Service restarted. Tap to refresh.` prompt stayed visible indefinitely.
  - Tapping the prompt could refresh/recover the page but the prompt still came
    back, so the UI looked permanently stale even when the service was already
    usable.
- Root cause:
  - `showReconnectRefreshPrompt("restart")` was used for Profile switch
    restarts, but `clearReconnectRefreshPrompt()` only cleared
    `pageRefreshReason === "reconnect"`.
  - `codexProfileRestarting`, `codexProfileSwitchTargetId`, and
    `codexProfileSwitchStage` had no success cleanup after `/api/status` or
    event-stream recovery confirmed that the service was ready again.
  - `refreshPageForNewBuild()` treated restart/reconnect prompt clicks as a
    shell refresh path even when the service build had not changed.
- Fix:
  - Added `finishRestartingUiIfReady()` to clear Profile switching and manual
    restart UI state after the active profile is visible again.
  - `clearReconnectRefreshPrompt()` now clears both `reconnect` and `restart`
    prompts and invokes the restarting UI cleanup.
  - Manual restart/reconnect prompt clicks now check the latest public config;
    if the server build matches the current shell, the prompt closes without
    rebuilding shell caches or reloading.
  - PWA shell cache advanced to `codex-mobile-shell-v301`.
- Files changed:
  - `public/app.js`
  - `public/sw.js`
  - `README.md`
  - `test/app-update.test.js`
  - `test/codex-profile-ui.test.js`
  - `test/mobile-viewport.test.js`
  - `test/thread-goal-service.test.js`
  - `test/thread-task-card-route.test.js`
- Validation:
  - `node --check public/app.js`
  - `node --test test/app-update.test.js test/codex-profile-ui.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
  - `npm run check`
  - Home AI AI Ops required checks:
    `node tests/gateway-run-lifecycle-service.test.js`,
    `node tests/gateway-run-start-service.test.js`,
    `node tests/gateway-run-stream-service.test.js`,
    `node tests/runtime-config-provider.test.js`
  - `git diff --check`

## 2026-06-17 Cold Thread List Startup v297

- Status: implemented, validated, and deployed to Mac production.
- User-visible issue:
  - Codex Mobile cold load still took roughly 2-3 seconds before the thread
    list became visible.
- Runtime finding:
  - Authenticated production `/api/threads?limit=40&archived=false` can be
    fast after cache warmup, but a cold fallback miss showed
    `totalMs=1602`, with `fallbackMs=1290`, `fallbackStateDbMs=291`, and
    `fallbackRolloutMs=929`.
  - A temporary development listener on `CODEX_MOBILE_PORT=18787` confirmed
    the new `fallback=defer` path returns with `fallbackMs=0` and
    `totalMs=124` after app-server connection is warm. The normal full
    fallback path in the same listener showed a cold `totalMs=1351` with
    `fallbackMs=1179`.
- Fix:
  - `GET /api/threads` accepts `fallback=defer` for non-archived,
    non-cursor, non-search first-page reads.
  - The deferred path returns the app-server list immediately, decorates goals,
    task-card counts, token stats, and marks `mobileDeferredFallback=true`.
  - Browser cold bootstrap calls `loadThreads({ deferFallback: true })` and,
    when it sees `mobileDeferredFallback`, schedules a delayed silent normal
    `loadThreads()` so state DB / rollout / session-index fallback rows are
    still merged after first paint.
  - PWA shell cache advanced to `codex-mobile-shell-v297`.
- Files changed for this fix:
  - `server.js`
  - `public/app.js`
  - `public/sw.js`
  - `test/mobile-viewport.test.js`
  - `test/thread-visibility.test.js`
  - `docs/ARCHITECTURE.md`
  - `README.md`
- Validation:
  - `node --test test/mobile-viewport.test.js test/thread-visibility.test.js`
  - `node --test test/thread-goal-service.test.js test/thread-task-card-route.test.js test/mobile-viewport.test.js test/thread-visibility.test.js`
  - `npm run check`
  - `npm test` passed: 486/486.
  - Home AI `node tests/architecture-code-test-harness-map.test.js`.
  - `git diff --check`.
  - AI Ops evidence: `evidence-ac6c13a1-94b5-48ec-b45b-51573796231b`.
- Production deployment:
  - Deployed after explicit user request on 2026-06-17.
  - Production `/api/public-config` reports
    `clientBuildId=0.1.11|codex-mobile-shell-v297` and
    `shellCacheName=codex-mobile-shell-v297`.
  - Production file readback confirmed `server.js`, `public/app.js`,
    `public/sw.js`, and `README.md` contain the v297 deferred fallback code.
  - Production authenticated smoke:
    `/api/threads?limit=40&archived=false&fallback=defer` returned
    `mobileDeferredFallback=true`, `totalMs=190`, and `fallbackMs=0`.
  - Production full fallback smoke still works and measured `totalMs=1490`,
    `fallbackMs=1298`, `fallbackStateDbMs=332`, and `fallbackRolloutMs=883`.
  - Deploy evidence: `evidence-ed129399-6e5a-4b37-be36-209b798ac347`.

## 2026-06-16 Native Shell Thread Detail Header v295

- Status: fixed, committed, pushed to private `origin/main`, and deployed to
  Mac production.
- Commit:
  - `fb10f70 fix: 修复原生壳 Codex 详情页页眉`.
- User-visible issue:
  - After Home AI v787 restored the host iframe top and keyboard geometry,
    the Codex embedded thread list and composer were correct again, but the
    thread detail page's top thread title and running-turn status/timer area
    were still hidden under the native iOS shell status region.
- Boundary decision:
  - Do not move the host iframe down again. Home AI keeps embedded plugin
    iframe placement at top `0`.
  - Codex consumes the host-provided `hermes.plugin.viewport`
    `safeAreaTop` / `hostTopSafeArea` metadata and applies it only inside the
    iframe-owned thread detail `topbar`.
  - The embedded primary thread-list page is not moved down, and the v294
    composer/keyboard bottom avoidance remains unchanged.
- Files changed:
  - `public/app.js`
  - `public/styles.css`
  - `public/sw.js`
  - `test/mobile-viewport.test.js`
  - `test/thread-goal-service.test.js`
  - `test/thread-task-card-route.test.js`
  - `README.md`
- Validation:
  - `node --check public/app.js`
  - `node --check public/sw.js`
  - `node --check test/mobile-viewport.test.js`
  - `node --test test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
  - `npm run check`
  - Home AI required harness unit tests:
    `node tests/ios-pwa-live-debug-server.test.js`,
    `node tests/ios-pwa-visual-harness.test.js`.
  - Local Playwright static detail-state smoke used a simulated
    `--host-top-safe-area: 47px` and confirmed the app itself was not
    translated while thread title and turn timer top bounds were below the
    safe-area line.
  - `git diff --check`
- Production deployment:
  - Deployed from clean worktree
    `/Users/hermes-dev/HermesMobileDev/.deploy-staging/codex-mobile-web-v295`
    with Home AI central Mac deploy script:
    `--plugin codex-mobile-web --restart none --reason codex-native-topbar-v295`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260616T153435Z-plugin-codex-mobile-web-codex-native-topbar-v295`.
  - Production `/api/public-config` readback reports
    `clientBuildId=0.1.11|codex-mobile-shell-v295` and
    `shellCacheName=codex-mobile-shell-v295`.
  - Production static reads confirmed v295 `app.js`, `styles.css`, and
    `sw.js` include `hostTopSafeArea`, `--host-top-safe-area`, and
    `codex-mobile-shell-v295`.
- AI Ops evidence:
  - Test: `evidence-a3d92db5-fc20-4e7e-9542-7b6cdcb0e3f0`.
  - Deploy: `evidence-ee0d1e8a-d107-4e3a-9f51-ae8da9fe60c1`.

## 2026-06-16 Native Shell Layout Regression Stop Point

- Status: production rolled back; no further Codex-side production changes.
- Production readback after rollback:
  - Home AI host: `20260616-voice-provisional-smooth-v784`.
  - Codex Mobile plugin: `0.1.11|codex-mobile-shell-v294`.
- Failed direction:
  - A combined host/Codex layout attempt for native shell top inset and
    keyboard/composer inset was deployed as Home AI v785 and Codex v295.
  - Visual/user evidence showed it did not solve the top black gap or keyboard
    overlap, and it risked hiding/offsetting embedded headers.
- Current decision:
  - Do not continue patching this from Codex plugin CSS alone.
  - Treat the native WebView header/safe-area/keyboard behavior as a Home
    AI/native-shell host contract issue first, then adapt Codex only to the
    explicit host-provided contract.
  - Host-side work has started; Codex should not redeploy or restart production
    for this issue until the host contract is stable.
- Operations:
  - Rolled production back to pre-v785/pre-v295 artifacts.
  - Released AI Ops visual lanes `ios-pwa-1` and `ios-pwa-2`.
  - Evidence ledger: `evidence-a787b0c8-7fa8-4c52-8dd6-1f0c0ba89931`.

## 2026-06-16 Composer Regression Recovery v292

- Status: committed and deployed to Mac production.
- Commits:
  - Bad draft hotfix: `ef8c7e8 fix: 调整嵌入态 WebView 视口`
  - Rollback: `74ff011 Revert "fix: 调整嵌入态 WebView 视口"`
  - Recovery shell: `237b2bf fix: 发布 composer 恢复版 shell`
- Incident:
  - User reported that after the embedded WebView viewport hotfix deploy,
    standalone/PWA and native APP shell could lose access to the bottom
    composer/input area.
  - The bad hotfix had shipped under unchanged
    `codex-mobile-shell-v291`, so client caches could keep inconsistent
    frontend assets even after a source rollback.
- Recovery:
  - Reverted the viewport code changes.
  - Advanced only `CLIENT_BUILD_ID` / `public/sw.js` shell identity to
    `codex-mobile-shell-v292`.
  - Added a Chinese README note documenting v292 as a composer recovery shell.
  - Deployed with reason `codex-mobile-composer-recovery-v292`.
  - Production `/api/public-config` readback after deploy:
    `clientBuildId=0.1.11|codex-mobile-shell-v292`,
    `shellCacheName=codex-mobile-shell-v292`, production path
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
- Validation:
  - Before rollback deploy:
    `node --check public/app.js && node --check public/viewport-metrics.js &&
    node --test test/viewport-metrics.test.js test/mobile-viewport.test.js &&
    git diff --check` passed.
  - For v292:
    `node --check public/app.js && node --check public/sw.js &&
    node --test test/mobile-viewport.test.js test/thread-goal-service.test.js
    test/thread-task-card-route.test.js && git diff --check` passed: 17/17.
  - Mac deploy script completed successfully; launchd was running and plugin
    manifest health check passed. Codex auth profile audit reported
    `codexIssueCount=0`.
  - Evidence ledger: `evidence-bd352f1e-4728-4e26-81c0-8f892d90696a`.
- Native-shell visual note:
  - Simulator contains Home AI native shell bundle
    `com.xuxin.homeai.native`.
  - The production Home AI key was written into the Simulator native shell
    defaults without printing the key. The stored key hash matched the
    production `owner-web-key.secret` hash, and the same key returned HTTP 200
    from production `/api/status?detail=1`.
  - The public HTTPS origin `https://hermes-xuxin.synology.me:8445` timed out
    in the local Mac/simulator environment, leaving the native shell WebView
    black. Switching the native shell to LAN
    `http://192.168.10.110:8797` loaded the Home AI Web login page, but the
    WebView still showed `Access Key 已失效`.
  - Clearing the Simulator native shell WebKit cache did not fix the login
    state. A live-debug/Appium attempt to set `localStorage.hermesWebKey` in
    the current native WebView hung during WebView/Appium action execution, so
    it was stopped. Visual lane was released and temporary debug ports
    `19073` / `4723` were cleared.
  - Conclusion: native shell is now configured at the native defaults layer,
    but WebView login injection/loading still needs a separate native-shell
    fix before it can be used as reliable Codex composer evidence. Future
    embedded WebKit verification should use this native shell once that login
    bridge is fixed, not Safari/PWA evidence.

## 2026-06-16 Native Shell Auth Bridge Follow-Up

- Status: fixed and verified in the native Xcode workspace.
- Native workspace: `/Users/xuxin/Xcode/Home AI`.
- Fix:
  - `HomeAIWebView` now injects the Home AI Access Key into
    `localStorage.hermesWebKey` and `hermes_web_key` through a
    `.atDocumentStart` `WKUserScript` before Home AI PWA initializes.
  - The WebView replaces user scripts before reload when the stored key changes.
  - The cookie bridge keeps `Secure` only for HTTPS targets; bounded LAN HTTP
    simulator validation no longer fails because of an HTTPS-only cookie flag.
- Validation:
  - The simulator key was checked only by presence/hash prefix and returned
    `HTTP 200` from Home AI `/api/status?detail=1` with `X-Hermes-Web-Key`.
  - `xcodebuild -project 'Home AI.xcodeproj' -scheme 'Home AI' -destination
    'platform=iOS Simulator,id=C2EB6D31-F485-4DAE-BFB4-25E27FC65389' build`
    passed.
  - Installed/launched `com.xuxin.homeai.native` on the HomeAI iPhone 17 Pro
    simulator. Screenshot `/tmp/homeai-native-auth-bridge-after-fix.png`
    showed Home AI PWA, not the Access Key error page.
  - Appium tapped the bottom `Codex` tab in the native shell. Screenshot
    `/tmp/homeai-native-codex-tab-after-fix.png` showed the Codex plugin list;
    source did not contain `Access Key` or `失效`.
  - Home AI central checks passed:
    `node tests/ios-pwa-live-debug-server.test.js`,
    `node tests/ios-pwa-visual-harness.test.js`,
    `node tests/architecture-code-test-harness-map.test.js`, and
    `node scripts/plugin-workspace-platform-contract-check.js --target
    home-ai-native-ios --json`.
  - AI Ops evidence ledger:
    `evidence-150790ae-42a2-4aa9-ae93-e2c71a5f779c`.
- Notes:
  - The native code was included in local Xcode commit
    `be34c35 feat: add native voice input bridge`.
  - No Codex Mobile PWA/standalone code was changed for this follow-up.

## 2026-06-15 Windows Desktop Hidden Launcher Fix

- Status: committed, pushed private, pushed public, and public merged back into
  private.
  - Private implementation commit: `6cbd1f4`.
  - Public commit: `6a2d121`.
  - Private public-sync merge commit: `81f8f6a`.
- User-visible issue:
  - On Windows, several PowerShell console windows could appear and remain in
    front when using Codex Desktop profile launch shortcuts.
- Root cause:
  - `start-codex-desktop-default.cmd`,
    `start-codex-desktop-current.cmd`, and
    `start-codex-desktop-previous.cmd` directly invoked
    `powershell.exe -File start-codex-desktop-shared.ps1`, so any shortcut or
    double-click path through those wrappers created a visible console. The
    shared PS1 also prints launch environment diagnostics, which can make the
    window persist while Desktop remains open.
- Fix:
  - The three Desktop profile `.cmd` wrappers now launch
    `start-codex-desktop-shared-hidden.vbs` through `wscript.exe` with the same
    `-ProfileId <profile> -ForceRestartMux` arguments, then exit immediately.
  - Existing Mobile Web scheduled-task/windowless path remains unchanged:
    scheduled startup still uses `wscript.exe` plus
    `start-codex-mobile-web-hidden.vbs`; the plain
    `start-codex-mobile-web.ps1` remains a foreground/manual diagnostic entry.
  - No PWA shell cache bump was needed.
  - `README.md` includes a Chinese release note for the Windows hidden launcher
    change.
- Validation:
  - `node --test test/desktop-profile-launcher.test.js test/shared-chain-restart-service.test.js test/manual-restart-ui.test.js`
    passed: 22/22.
  - `npm run check` passed.
  - `npm test` passed: 486/486.
  - `git diff --check` passed.
  - In the public mirror, the same focused 22/22 test set, `npm run check`,
    and `git diff --check` passed before pushing `6a2d121`.
  - Public diff/path privacy scan covered only `README.md`,
    `start-codex-desktop-*.cmd`, and `test/desktop-profile-launcher.test.js`;
    no `.agent-context`, runtime state, local keys, uploads, or private paths
    were included.

## 2026-06-15 Public PR #72/#71 New Thread Echo And Refresh Path Sync

- Public/private baseline:
  - Private already had local public-safe commit
    `5fc4bfb fix: 清理已合并 Public PR 提示`, which updated public source to
    shell cache `codex-mobile-shell-v289` and added the README v289 note.
  - To keep public/private from diverging, first applied that public-safe diff
    to the clean public mirror excluding `.agent-context`, committed it as
    public `36a7b6b fix: clear merged public PR prompt`, and pushed public.
- Public PRs:
  - Evaluated `pentiumxp/codex-mobile-web-public` PR #72,
    `修复新线程首条用户消息重复显示`, and PR #71,
    `优化当前线程后台刷新路径`.
  - Both were open, non-draft, and GitHub-reported mergeable, with old base
    `3370b9a`.
  - #72 adds `mobileInitialSubmissionId` handling so a new thread's local
    optimistic first user message is dropped once the durable first turn arrives
    with matching content but a different turn id.
  - #71 makes background current-thread refreshes request recent detail by
    default, keeps the last post-completion refresh as full detail, and emits
    bounded `thread_refresh_ms` performance events.
  - Because v289 was already used by the local public PR prompt fix, #72 was
    merged as shell cache `codex-mobile-shell-v290` and #71 as
    `codex-mobile-shell-v291`.
- Public merge:
  - Used the clean public mirror
    `/Users/hermes-dev/HermesMobileDev/public-mirrors/codex-mobile-web-public`.
  - Public commits pushed:
    - local public-safe v289 sync: `36a7b6b`
    - #72 merge: `29af25f4b04349b6ed8da771848fccc4ac667b3a`
    - #71 merge: `f33e829066ca8dcc65733b3a258075799bebc102`
  - GitHub marked PR #72 and PR #71 `MERGED`.
- Public validation:
  - Focused syntax checks for `public/app.js`, `public/sw.js`, and touched
    tests passed.
  - Focused UI/projection tests passed: `node --test
    test/conversation-render.test.js test/mobile-viewport.test.js
    test/app-update.test.js test/turn-scroll-controls.test.js
    test/thread-goal-service.test.js test/thread-task-card-route.test.js`
    passed 77/77.
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - Home AI `node tests/architecture-code-test-harness-map.test.js` passed.
  - `npm test` passed: 486/486.
  - `git diff --check` passed.
  - Public privacy/path scans found no tracked `.agent-context`, runtime state,
    local keys, upload roots, or machine diagnostics. The only sensitive-word
    match was the README policy sentence saying runtime state and private
    files are not copied.
  - Evidence ledger: `evidence-ba53c4ef-84bb-49b9-904c-b7153efa82ef`.
- Private reverse sync:
  - Merged public `main` back into private with expected conflicts against the
    earlier private v289 commit.
  - Resolved conflicted public source files by taking `public/main` content
    while preserving private `.agent-context`.
  - Private merge commit: `cada455`.
  - Excluding `.agent-context`, private and `public/main` had no diff after the
    merge.
- Private validation:
  - Same focused syntax/UI/projection tests passed: 77/77.
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `node scripts/plugin-workspace-platform-contract-check.js --plugin codex-mobile --json`
    passed with the existing non-blocking `handoff_pointer_missing` warning.
  - Home AI `node tests/architecture-code-test-harness-map.test.js` passed.
  - `npm test` passed: 486/486.
  - `git diff --check` passed.
  - Privacy diff scan over `public/main..HEAD`, excluding `.agent-context`,
    had no matches. `git ls-files` showed only the private workspace's existing
    tracked `.agent-context/HANDOFF.md` and `.agent-context/PROJECT_CONTEXT.md`.
  - Evidence ledger: `evidence-65b2bb58-3405-4413-a745-46b60db3c7d0`.

## 2026-06-15 Public PR Stale Prompt Fix

- Status: committed locally as `5fc4bfb`, synced to public as clean public
  commit `36a7b6b`, and included in the 2026-06-15 public/private sync above.
- User-visible issue:
  - After a public PR was merged and the checkout was already current, the
    Mobile update/PR menu could still show an old pending PR state and allow
    preparing another merge task.
- Root cause:
  - The frontend reused a cached `state.publicPrStatus` when the PR chip/button
    was clicked, and the server-side PR check cache can last 15 minutes.
  - On PR refresh failure, the frontend merged the error onto the previous PR
    status, so old `hasOpenPullRequests=true` / `pullRequests` could remain
    actionable.
- Fix:
  - `handlePublicPrStatusClick()` now always calls
    `refreshPublicPrStatus({ force: true, skipPrompt: true })` before deciding
    whether to prepare a public merge task.
  - PR refresh errors clear stale actionable PR fields:
    `hasOpenPullRequests=false`, `openPullRequestCount=0`, and
    `pullRequests=[]`.
  - The top PR chip hides when not checking, not blocked, and no open PRs are
    present.
  - The update panel labels the PR action as `Check PR` when no open PRs are
    known, and `Review Public PR` only when a fresh/open PR state exists.
  - PWA shell cache advanced to `codex-mobile-shell-v289`.
  - `README.md` includes a Chinese release note for v289.
- Validation:
  - `node --check public/app.js && node --check public/sw.js && node --check test/app-update.test.js`
    passed.
  - `node --test test/app-update.test.js test/public-pull-request-service.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
    passed: 30/30.
  - `npm run check` passed.
  - `npm test` passed: 484/484.
  - `node --test test/app-update.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
    passed: 26/26 after README update.
  - `git diff --check` passed.

## 2026-06-14 Public PR #70 Thread List Fallback Cache Sync

- Public PR:
  - Evaluated `pentiumxp/codex-mobile-web-public` PR #70,
    `缓存线程列表 fallback 结果`.
  - PR was open, non-draft, and GitHub-reported mergeable. Its base was older
    public `main` at `6b3c261`, so it was test-merged onto current public
    `f6b35f0`.
  - Local merge onto current public `main` had no conflicts and did not remove
    #68/#69 thread-detail projection, echo dedupe, or static compression code.
  - Change is server-only: `/api/threads` now records bounded thread-list
    timing diagnostics and caches fallback aggregation from state DB, rollout
    sessions, and `session_index.jsonl` using visible workspace/projectless
    scope, search term, and source-file fingerprints. Starting a thread,
    renaming, and Mobile local archive updates clear the cache.
  - No PWA shell cache bump was needed.
- Public merge:
  - Used the clean public mirror
    `/Users/hermes-dev/HermesMobileDev/public-mirrors/codex-mobile-web-public`.
  - Public merge commit pushed:
    `e77ffc441a683c6332d73ace1c9016f6aa24e4e4`.
  - README release note commit pushed:
    `3370b9aa9e38be1279b686c4ff9f4bfd6b6fb77b`.
  - GitHub marked PR #70 `MERGED`.
- Public validation:
  - `node --check server.js && node --check test/thread-visibility.test.js`
    passed.
  - `node --test test/thread-visibility.test.js` passed: 23/23.
  - `node --test test/static-compression.test.js` passed: 4/4.
  - `node --test test/thread-detail-projection-service.test.js` passed: 9/9.
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `npm test` passed: 483/483.
  - `git diff --check` passed.
  - Public privacy scans found no tracked `.agent-context`, runtime state,
    local keys, upload roots, or machine diagnostics. Sensitive-word matches
    were limited to `tokenUsageStatsService` code identifiers.
  - Home AI AI Ops requested `tests/task-list-ui.test.js` and
    `tests/static-cache-version-harness.test.js`; those paths do not exist in
    the public mirror layout, so public validation used the available
    `test/` harnesses above.
  - Evidence ledger: `evidence-a56d2aa8-ea38-4d57-9152-7845bf74fe6f`.
- Private reverse sync:
  - Merged public `main` back into private with no conflicts.
  - Private merge commit: `6374327`.
  - Excluding `.agent-context`, private and `public/main` had no diff after the
    merge.
- Private validation:
  - Same focused syntax/thread/static/projection checks passed.
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `node scripts/plugin-workspace-platform-contract-check.js --plugin codex-mobile --json`
    passed with the existing non-blocking `handoff_pointer_missing` warning.
  - `npm test` passed: 483/483.
  - `git diff --check` passed.
  - Privacy diff scan over `public/main..HEAD`, excluding `.agent-context`,
    had no matches. `git ls-files` showed only the private workspace's existing
    tracked `.agent-context/HANDOFF.md` and `.agent-context/PROJECT_CONTEXT.md`.
  - Evidence ledger: `evidence-a0f68cc6-fd18-459d-9a2c-257fcdc8970b`.

## 2026-06-14 Public PR #68/#69 Echo Dedupe And Load Performance Sync

- Public PRs:
  - Evaluated `pentiumxp/codex-mobile-web-public` PR #68,
    `修复移动端用户消息 echo 去重`, and PR #69,
    `优化移动端加载性能基础路径`.
  - Both PRs were open, non-draft, and based on public `main` at `6b3c261`.
  - #68 narrows pending/mux/local user-message echo removal so only same-turn
    or later-turn durable user messages can shadow synthetic echoes.
  - #69 adds cached `br` / `gzip` compression for static text assets, recent
    first thread-detail loading with full-detail backfill, and bounded frontend
    performance events for shell/list/detail/render/Mermaid/GitHub-card timing.
  - Sequential merge was functionally compatible but required manual conflict
    resolution for README release notes and static shell version assertions.
    Final public shell cache is `codex-mobile-shell-v288`.
- Public merge:
  - Used the clean public mirror
    `/Users/hermes-dev/HermesMobileDev/public-mirrors/codex-mobile-web-public`.
  - Public merge commits pushed:
    - #68: `112873cb3a48238883a6355b3f55fedca7207340`
    - #69: `f6b35f032a342557becd15fe7bd730967448dbcc`
  - GitHub marked both PRs `MERGED`.
- Public validation:
  - Home AI `node tests/ios-pwa-live-debug-server.test.js` passed.
  - Home AI `node tests/ios-pwa-visual-harness.test.js` passed.
  - Home AI `node tests/static-cache-version-harness.test.js` passed.
  - Home AI `node tests/architecture-code-test-harness-map.test.js` passed.
  - AI Ops lane `ios-pwa-1` was allocated for the H2 static/visual plan and
    released after source harness checks.
  - Syntax checks for touched server/public/adapter/test JS passed.
  - Focused static-compression, echo, projection, render, viewport, visibility,
    goal, and task-card tests passed: 102/102.
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `npm test` passed: 483/483.
  - `git diff --check` passed.
  - Privacy scans over `origin/main..HEAD` found no tracked `.agent-context`,
    runtime state, local keys, upload roots, or machine diagnostics. The only
    sensitive-word match was the README policy sentence saying credentials and
    uploads are not included in the repository.
  - Evidence ledger: `evidence-9b1fafd8-0618-42d8-a1fc-1430b0d66f74`.
- Private reverse sync:
  - Merged public `main` back into private with no conflicts.
  - Private merge commit: `1785d3f`.
  - Excluding `.agent-context`, private and `public/main` had no diff after the
    merge.
- Private validation:
  - Syntax checks for touched server/public/adapter/test JS passed.
  - Focused static-compression, echo, projection, render, viewport, visibility,
    goal, and task-card tests passed: 102/102.
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `node scripts/plugin-workspace-platform-contract-check.js --plugin codex-mobile --json`
    passed with the existing non-blocking `handoff_pointer_missing` warning.
  - `npm test` passed: 483/483.
  - `git diff --check` passed.
  - Evidence ledger: `evidence-ccf7d319-592c-4182-84f3-30ddb62039c7`.

## 2026-06-14 Public PR #66/#67 Markdown And Preview Zoom Sync

- Public PRs:
  - Evaluated `pentiumxp/codex-mobile-web-public` PR #67,
    `修复 Markdown angle autolink 渲染`, and PR #66,
    `增加图片和 Mermaid 预览缩放`.
  - Both PRs were open, non-draft, and based on public `main` at `b39aeab`.
  - #67 adds Markdown angle autolink handling before HTML escaping, with tests
    for `<https://...>` and angle-target Markdown links.
  - #66 adds image preview open/zoom controls, mobile pinch zoom support for
    image and Mermaid preview surfaces, embed back-state handling for image
    preview, and related UI/test coverage.
  - Sequential merge was functionally compatible but required manual conflict
    resolution for README release notes and static shell version assertions.
    Final public shell cache is `codex-mobile-shell-v286`.
- Public merge:
  - Used the clean public mirror
    `/Users/hermes-dev/HermesMobileDev/public-mirrors/codex-mobile-web-public`.
  - Public merge commits pushed:
    - #67: `11b822df0af08aa51a8b0ee58f23f45e9bc58852`
    - #66: `6b3c261ee92cc57ad408536b85b5aff8b04f9a32`
  - GitHub marked both PRs `MERGED`.
- Public validation:
  - Syntax checks for touched public/test JS passed.
  - Focused Markdown/Mermaid/file-preview/plugin/mobile tests passed: 96/96.
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - Home AI `node tests/architecture-code-test-harness-map.test.js` passed.
  - Home AI `node tests/static-cache-version-harness.test.js` passed.
  - `npm test` passed: 473/473.
  - `git diff --check` passed.
  - Privacy scans over `origin/main..HEAD` found no tracked `.agent-context`,
    runtime state, local keys, upload roots, or machine diagnostics. Matches
    were limited to code placeholder token variables and a test fixture path.
  - AI Ops lane `ios-pwa-1` was allocated for the H2 visual/static plan and
    released after source harness checks. Home AI
    `node tests/task-list-ui.test.js` failed on an unrelated existing
    `20260612-email-content-mcp-v1` assertion outside the public diff.
  - Evidence ledger: `evidence-78671da7-058b-4b96-86b8-2d581b3d650e`.
- Private reverse sync:
  - Merged public `main` back into private with no conflicts.
  - Private merge commit: `5035555`.
  - Excluding `.agent-context`, private and `public/main` had no diff after the
    merge.
- Private validation:
  - Syntax checks for touched public/test JS passed.
  - Focused Markdown/Mermaid/file-preview/plugin/mobile tests passed: 96/96.
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `node scripts/plugin-workspace-platform-contract-check.js --plugin codex-mobile --json`
    passed with the existing non-blocking `handoff_pointer_missing` warning.
  - `npm test` passed: 473/473.
  - `git diff --check` passed.
  - Evidence ledger: `evidence-6b25e175-0eda-4b0b-bb56-840d6d1f921e`.

## 2026-06-14 Public PR #65 Projectless New Thread Sync

- Public PR:
  - Evaluated `pentiumxp/codex-mobile-web-public` PR #65,
    `允许新建项目外对话`.
  - GitHub reported `mergeable=MERGEABLE`; PR base matched current public
    `main` at `1ceca48`.
  - Change lets the Mobile new-thread page send the first message without a
    selected Workspace, omits `cwd` from `thread/start` / `turn/start` in that
    mode, and registers the returned thread id in `projectless-thread-ids` so
    existing projectless-thread visibility rules keep it open in list/detail.
  - Static shell version advanced from `codex-mobile-shell-v283` to
    `codex-mobile-shell-v284` in both `public/app.js` and `public/sw.js`.
- Public merge:
  - Used the clean public mirror
    `/Users/hermes-dev/HermesMobileDev/public-mirrors/codex-mobile-web-public`.
  - README Chinese release note was included with the PR and preserved.
  - Public merge commit pushed:
    `b39aeab92a10a5b559a4b3bb7ca5e466ed58c57b`.
- Public validation:
  - `node --check server.js && node --check public/app.js &&
    node --check public/sw.js && node --check test/new-thread-route.test.js &&
    node --check test/new-thread-ui.test.js` passed.
  - Focused projectless new-thread/visibility tests passed: 67/67.
  - `node tests/architecture-code-test-harness-map.test.js` passed in Home AI.
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `npm test` passed: 471/471.
  - `git diff --check` and public privacy/path scans passed; matches were code
    references to runtime state paths and upload variables, not copied files or
    payloads.
  - Evidence ledger: `evidence-80f52398-eece-47ec-9fc6-7cb12ad50846`.
- Private reverse sync:
  - Merged public `main` back into private with no conflicts.
  - Private merge commit: `323c60e`.
- Private validation:
  - `node --check server.js && node --check public/app.js &&
    node --check public/sw.js && node --check test/new-thread-route.test.js &&
    node --check test/new-thread-ui.test.js` passed.
  - Focused projectless new-thread/visibility tests passed: 67/67.
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `node scripts/plugin-workspace-platform-contract-check.js --plugin codex-mobile --json`
    passed with the existing non-blocking `handoff_pointer_missing` warning.
  - `npm test` passed: 471/471.
  - `git diff --check` passed.
  - Evidence ledger: `evidence-fe543d43-76c0-4b45-aaf4-8486eae06657`.

## 2026-06-14 Continuation Session Index Title Recovery

- Status: implemented locally, not deployed in this step.
- Follow-up to the compressed continuation naming issue where the `星盘`
  source thread could fall back to an old first-message title.
- Root cause:
  - The previous fix made continuation creation prefer the browser-provided
    `sourceThreadTitle`, but thread list/detail hydration still treated
    `session_index.jsonl` titles as a fallback only for UUID/bootstrap-looking
    rows.
  - If app-server returned a plausible but stale first-message title, Mobile Web
    could keep that stale `name` in `state.currentThread`, then pass it back as
    the next continuation source title.
- Fix:
  - `server.js` now applies a `session_index.jsonl` display title to thread
    list/detail/projection results whenever the index has a title for the
    thread; the index timestamp only advances sort recency when it is newer.
  - `public/app.js` continuation dialog/request paths now use
    `threadTitleForDisplay(thread)` consistently.
  - PWA shell cache advanced to `codex-mobile-shell-v283`.
  - `docs/COMPLEX_FEATURE_PATHS.md` documents the session-index title recovery
    rule for rollout continuation.
- Validation:
  - `node --check server.js`
  - `node --check public/app.js && node --check public/sw.js`
  - `node --test test/thread-visibility.test.js test/new-thread-route.test.js test/continuation-lineage.test.js`
  - `npm run check`
  - `git diff --check`

## 2026-06-14 Continuation Title Source Priority Fix

- User reported that a compressed continuation of the `星盘` thread opened with
  a long first-message title instead of the expected rule-based title.
- Production observation:
  - Continuation job `b20ba874-5f22-47e9-8c0e-d51dab9e86b7` created new
    thread `019ec3c0-86d2-7852-a9ea-e4c703262cdc`.
  - The generated title was
    `帮我看一下这个软件，它是一个已经停更的软件。只有支持 Java 的 PC 版... 06-14`
    rather than `星盘 06-14`.
- Root cause:
  - `sourceTitleForContinuation()` preferred `sourceSnapshot.summary.name`
    before the UI-provided `requestedSourceThreadTitle`.
  - In this live case app-server summary `name` was the source thread's first
    user message, while the visible current title passed by the browser was
    `星盘`.
- Fix:
  - `sourceTitleForContinuation()` now prefers `requestedTitle` before
    app-server summary fields.
  - Continuation lineage now stores the selected source title first, falling
    back to summary only when the selected title is empty.
  - Existing generated thread `019ec3c0-86d2-7852-a9ea-e4c703262cdc` was
    repaired through `/api/threads/:id/name` to `星盘 06-14`; production detail
    readback confirmed the title.
- Validation:
  - `node --check server.js`
  - `node --test test/new-thread-route.test.js test/continuation-lineage.test.js test/continuation-handoff-compaction-service.test.js test/thread-goal-service.test.js`
  - `npm run check`
  - `git diff --check`

## 2026-06-13 Recurring macOS LaunchDaemon EX_CONFIG During Normal Use

- User reported Codex Mobile disconnected during normal use, without pressing
  Restart or deploying, and then could not recover. This was the third
  occurrence in the same day.
- Production diagnosis:
  - `127.0.0.1:8787` was unavailable during the failure.
  - `launchctl print system/com.hermesmobile.plugin.codex-mobile` showed a
    scheduled respawn with prior `78: EX_CONFIG`.
  - The job runs as `xuxin`, but its loaded `StandardOutPath` and
    `StandardErrorPath` pointed at shared files under
    `/Users/hermes-host/HermesMobile/logs`.
  - When those shared files drift back to `hermes-host:staff` mode `600`,
    launchd can fail before Node starts. This affects any relaunch, including
    system/KeepAlive relaunches after an unrelated runtime exit, not only
    explicit Restart or deploy.
- Immediate production repair:
  - Moved the loaded LaunchDaemon stdout/stderr paths to
    `/Users/xuxin/.codex-mobile-web/logs/codex-mobile-web.out.log` and
    `/Users/xuxin/.codex-mobile-web/logs/codex-mobile-web.err.log`.
  - Set the runtime log directory to `xuxin:staff` mode `700` and the two log
    files to `xuxin:staff` mode `600`.
  - Reloaded only `system/com.hermesmobile.plugin.codex-mobile`; Home AI
    listener was not restarted.
- Verification after repair:
  - `plutil -p /Library/LaunchDaemons/com.hermesmobile.plugin.codex-mobile.plist`
    shows both standard log paths under `/Users/xuxin/.codex-mobile-web/logs`.
  - `launchctl print system/com.hermesmobile.plugin.codex-mobile` shows
    `state = running`, `username = xuxin`, runtime stdout/stderr paths, and
    `last exit code = (never exited)`.
  - Authenticated `/api/status?detail=1` returned `ready=true`,
    `transport=managed-ws-child`, and `lastError=null`.
- Durable code fix in Home AI app repo:
  - `/Users/hermes-dev/HermesMobileDev/app/scripts/deploy-macos-production.js`
    now makes Codex Mobile post-sync repair create runtime-owned log files,
    update the LaunchDaemon `StandardOutPath` / `StandardErrorPath`, and
    reload the Codex Mobile LaunchDaemon during deploy.
  - Updated Home AI deployment docs and deploy-script harness expectations to
    treat runtime-owned Codex Mobile logs as the contract.
- Validation:
  - `node --check scripts/deploy-macos-production.js`
  - `node tests/macos-production-deploy-script.test.js`
  - `node tests/production-status-smoke-harness.test.js`
  - `npm run --silent deploy:macos -- --target home-ai --json`
  - `npm run --silent deploy:macos -- --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --reason codex-mobile-runtime-log-plist --json`
  - `git diff --check`

## 2026-06-13 macOS Restart LaunchDaemon Log Pre-Repair

- User reported that after deployment, tapping Mobile Web `Restart` left
  Codex Mobile unavailable on `8787`; Desktop had to be used to recover.
- Production diagnosis:
  - `launchctl print system/com.hermesmobile.plugin.codex-mobile` showed
    `spawn scheduled` and last exit `78: EX_CONFIG`.
  - No listener was present on `127.0.0.1:8787`.
  - The Node app itself passed syntax checks and could start manually.
  - The failing condition was launchd opening missing or inaccessible
    `plugin-codex-mobile.out.log` / `plugin-codex-mobile.err.log` before Node
    started.
- Immediate production recovery was performed by creating/fixing the two log
  files under `/Users/hermes-host/HermesMobile/logs`, setting them to
  `xuxin:staff` mode `600`, and kickstarting
  `system/com.hermesmobile.plugin.codex-mobile`.
- Code fix:
  - `adapters/shared-chain-restart-service.js` now makes the macOS restart
    helper detect system LaunchDaemon labels through
    `launchctl print system/<label>`.
  - Before killing the current listener for KeepAlive restart, it best-effort
    repairs stdout/stderr directories and files from the LaunchDaemon record
    using the existing `HOMEAI_MAC_SUDO_PASSWORD_FILE` path when available.
  - This complements the Home AI deploy script's Codex post-sync log repair;
    it covers user-initiated `Restart`, not only deploy-time restarts.
- Validation:
  - `node --check adapters/shared-chain-restart-service.js`;
  - `node --test test/shared-chain-restart-service.test.js`;
  - `node --test test/manual-restart-ui.test.js`;
  - generated macOS restart shell passed `/bin/bash -n`;
  - `npm run check`;
  - `npm test` passed: 468/468;
  - `git diff --check`.

## 2026-06-13 Production Restart Recovery After Deploy

- User reported Codex Mobile could not be opened after a deploy and requested a
  restart.
- Initial production state:
  - `launchctl print system/com.hermesmobile.plugin.codex-mobile` showed
    `state = spawn scheduled`.
  - No listener existed on `127.0.0.1:8787`.
  - Last launchd exit code was `78: EX_CONFIG`.
  - Production `server.js`, `public/app.js`, and `public/sw.js` passed
    `node --check`.
- Diagnosis:
  - Manual startup from
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web` with the
    launchd-equivalent environment succeeded and served `/api/public-config`.
  - The LaunchDaemon runs as `xuxin`, but
    `/Users/hermes-host/HermesMobile/logs` was `700 hermes-host`, and
    `plugin-codex-mobile.out.log` / `.err.log` were `600 hermes-host`.
  - This prevented the `xuxin` LaunchDaemon job from opening stdout/stderr
    paths, causing `EX_CONFIG` before the Node app could start.
- Recovery performed:
  - Changed `/Users/hermes-host/HermesMobile/logs` to `711`.
  - Changed the two Codex Mobile log files to owner `xuxin:staff`, mode `600`.
  - Stopped the temporary manual 8787 listener.
  - Ran `launchctl kickstart -k system/com.hermesmobile.plugin.codex-mobile`.
- Verification:
  - LaunchDaemon state became `running`, PID `54713`, last exit code `0`.
  - `lsof` showed `node` user `xuxin` listening on `127.0.0.1:8787`.
  - `/api/public-config` returned `200`, workspace path
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`, shell cache
    `codex-mobile-shell-v277`.
  - Authenticated `/api/status?detail=1` returned `200`, `ready=true`,
    transport `external-jsonl-tcp`, active profile `default`,
    `lastError=null`.
- Follow-up:
  - Ensure future deploy scripts preserve or repair Codex Mobile log directory
    traversal and log file ownership for the service user `xuxin`.

## 2026-06-12 Public PR #64 File Preview Recovery Sync

- Public PR:
  - Evaluated `pentiumxp/codex-mobile-web-public` PR #64,
    `修复本地文件预览卡死与误拦截`.
  - GitHub reported `mergeable=MERGEABLE`; PR base matched current public
    `main` at `bb21d05`.
  - The raw PR added bounded rollout-tail scanning and requested-path handling
    for local file preview, but its initial requested-path authority would have
    allowed any absolute supported file path that was not under a denied
    segment. The final merge commit keeps the performance fix while narrowing
    requested-path authority to Workspace/root files or a single requested file
    that is actually referenced by the current thread text.
- Public merge:
  - Used the clean public mirror
    `/Users/hermes-dev/HermesMobileDev/public-mirrors/codex-mobile-web-public`.
  - Added the required Chinese README release note.
  - Server-only change; no PWA shell cache bump.
  - Public merge commit pushed:
    `c689ad15d93d3797ff73b99ac25463bd45b94784`.
- Public validation:
  - `node --check server.js && node --check test/file-preview.test.js &&
    node --check test/file-preview-ui.test.js` passed.
  - Focused file preview/upload tests passed: 30/30.
  - `node tests/architecture-code-test-harness-map.test.js` passed in Home AI.
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `npm test` passed: 462/462.
  - `git diff --check` and public privacy/path scans passed; matches were
    limited to README boundary notes.
  - Evidence ledger: `evidence-bcc6b9f9-6511-4d1d-85ce-a8cd17e9d44e`.
- Private reverse sync:
  - Merged public `main` back into private with no conflicts.
  - Private merge commit: `d64bdbc`.
- Private validation:
  - `node --check server.js && node --check test/file-preview.test.js &&
    node --check test/file-preview-ui.test.js` passed.
  - Focused file preview/upload tests passed: 30/30.
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `node scripts/plugin-workspace-platform-contract-check.js --plugin codex-mobile --json`
    passed with the existing non-blocking `handoff_pointer_missing` warning.
  - `npm test` passed: 462/462.
  - `git diff --check` passed.
  - Evidence ledger: `evidence-de43fb20-f7c5-4e73-b0e0-0edbbad0c955`.

## 2026-06-12 Public PR #63 PWA Boot Recovery Sync

- Public PR:
  - Evaluated `pentiumxp/codex-mobile-web-public` PR #63,
    `增加 PWA 白屏恢复页`.
  - GitHub reported `mergeable=MERGEABLE`; PR base matched current public
    `main` at `e402712`.
  - Change adds an inline `index.html` boot recovery panel that does not depend
    on `app.js`, external CSS, or service-worker startup. It appears after a
    startup script failure or a 4.5 second no-surface timeout, can delete
    `codex-mobile-shell-*` caches, unregister the current origin's service
    workers, and reload with a cache-bust parameter.
  - Static shell version advanced from `codex-mobile-shell-v274` to
    `codex-mobile-shell-v275` in both `public/app.js` and `public/sw.js`.
- Public merge:
  - Used the clean public mirror
    `/Users/hermes-dev/HermesMobileDev/public-mirrors/codex-mobile-web-public`.
  - README Chinese release note was included with the PR and preserved.
  - Public merge commit pushed:
    `bb21d05130c71d7160928a921cf8a1858fd614ab`.
- Public validation:
  - `node --check public/app.js && node --check public/sw.js &&
    node --check test/app-update.test.js` passed.
  - Focused PWA/update tests passed: 25/25.
  - Home AI required harness tests passed:
    `node tests/ios-pwa-live-debug-server.test.js`,
    `node tests/ios-pwa-visual-harness.test.js`, and
    `node tests/architecture-code-test-harness-map.test.js`.
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `npm test` passed: 460/460.
  - `git diff --check` and public privacy/path scans passed; matches were
    limited to README boundary notes and the public `codexMobileBoot` symbol.
  - Evidence ledger: `evidence-67edd6c9-b3c6-4ef3-8cc3-154f19179922`.
- Private reverse sync:
  - Merged public `main` back into private with no conflicts.
  - Private merge commit: `b340af4`.
- Private validation:
  - `node --check public/app.js && node --check public/sw.js &&
    node --check test/app-update.test.js` passed.
  - Focused PWA/update tests passed: 25/25.
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `node scripts/plugin-workspace-platform-contract-check.js --plugin codex-mobile --json`
    passed with the existing non-blocking `handoff_pointer_missing` warning.
  - `npm test` passed: 460/460.
  - `git diff --check` passed.
  - Evidence ledger: `evidence-f042c5db-b2a3-4b36-bdf1-2a67312e83f5`.

## 2026-06-12 Public PR #62 Projectless Temporary Workspace Sync

- Public PR:
  - Evaluated `pentiumxp/codex-mobile-web-public` PR #62,
    `允许项目外线程携带临时工作区`.
  - PR base was older than current public `main`, but local merge onto
    `b8e8a56` was clean.
  - Change keeps registered `projectless-thread-ids` visible when app-server
    later reports a temporary `cwd`; unregistered temporary-cwd threads,
    archived threads, and child-agent threads continue to follow the existing
    hidden-thread rules.
- Public merge:
  - Used the clean public mirror
    `/Users/hermes-dev/HermesMobileDev/public-mirrors/codex-mobile-web-public`.
  - Added the required Chinese README release note.
  - Server-only change; no PWA shell cache bump.
  - Public merge commit pushed:
    `e402712241c3cad224d3ad23bdc734f6db861a9c`.
- Public validation:
  - `node --check server.js && node --check test/thread-visibility.test.js`
    passed.
  - `node --test test/thread-visibility.test.js` passed: 23/23.
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `node tests/architecture-code-test-harness-map.test.js` passed.
  - `npm test` passed: 459/459.
  - `git diff --check` and public privacy/path scans passed; matches were
    limited to README boundary notes, not copied private/runtime files.
  - Evidence ledger: `evidence-13d2fca7-26b4-418f-8b34-b5e0d49bbc4a`.
- Private reverse sync:
  - Merged public `main` back into private.
  - README conflict resolved by preserving the PR #62 Chinese note and existing
    v274 public notes.
  - Private merge commit: `bdaf7e5`.
- Private validation:
  - `node --check server.js && node --check test/thread-visibility.test.js`
    passed.
  - `node --test test/thread-visibility.test.js` passed: 23/23.
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `node scripts/plugin-workspace-platform-contract-check.js --plugin codex-mobile --json`
    passed with the existing non-blocking `handoff_pointer_missing` warning.
  - `npm test` passed: 459/459.
  - Evidence ledger: `evidence-d5c6d49a-2537-4bd4-b8ae-11ab90c34b0e`.

## 2026-06-12 Public CI Follow-Up For v274

- User asked why the Public v274 publish had a CI error and reiterated that
  Public releases require Chinese notes.
- Verification:
  - Public README already contains the v274 Chinese note explaining profile
    switch feedback and auth send failure receipts.
  - Public GitHub Actions run `27391466010` failed in `npm test`, before
    `npm run check` and `npm run check:macos`.
  - The failure was 4 stale full-suite harness assertions:
    `test/codex-profile-ui.test.js`,
    `test/mobile-viewport.test.js`,
    `test/thread-goal-service.test.js`,
    `test/thread-task-card-route.test.js`.
- Root cause:
  - Pre-public validation ran focused tests plus `npm run check`, but not the
    same full `npm test` that Public CI runs.
  - The missed assertions still expected shell cache `v273` or the old profile
    switch status text.
- Fix:
  - Updated the affected tests to assert `codex-mobile-shell-v274` and the new
    row-level profile switch stages (`预检中...`, `重启中...`, `失败`).
  - Added a README Chinese follow-up note for the v274 Public CI repair.
- Validation:
  - `npm test` passed locally: 458/458.
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Publish:
  - Private commits pushed:
    `c17aaee test: repair v274 public ci harness`,
    `d86b923 docs: note v274 public ci follow-up`.
  - Public commit pushed:
    `b8e8a56 test: repair v274 public ci harness`.
  - Public CI run `27391720176` passed. It still shows the unrelated GitHub
    Actions Node.js 20 deprecation warning from `actions/checkout@v4` /
    `actions/setup-node@v4`.

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

## 2026-06-12 Codex Profile Switch Feedback And Auth Failure Receipts

- User reported switching to `Default` appeared to do nothing after Desktop
  re-login under `/Users/xuxin/.codex`.
- Diagnosis:
  - Default auth itself was valid: `CODEX_HOME=/Users/xuxin/.codex codex exec`
    returned `OK`.
  - `/api/codex-profiles/active` returned
    `409 target_profile_preflight_failed` because the new profile-switch
    preflight attempted the temporary app-server WebSocket only once before the
    app-server had finished listening.
  - Production deploy initially failed because `.codegraph/daemon.sock` existed
    in both source and production plugin trees and rsync tried to copy/backup
    the socket.
- Implemented in Codex Mobile:
  - `server.js`: profile-switch preflight WebSocket connection now retries
    until the preflight timeout instead of failing on the first connection
    error.
  - `public/app.js` / `public/styles.css`: profile switching now shows row-level
    status (`预检中...`, `重启中...`, `失败`) and the frontend wait timeout is
    widened to 90 seconds.
  - `public/api-client.js`, `server.js`, `public/app.js`: Codex account
    auth/token failures during message send now return/preserve stable
    `codex_account_auth_invalid` errors and render an inline
    `.send-error-receipt` under the submitted user message instead of only using
    the top-right connection/status area.
  - Shell cache bumped to `codex-mobile-shell-v274`.
- Implemented in Home AI deploy tooling:
  - `/Users/hermes-dev/HermesMobileDev/app/scripts/deploy-macos-production.js`
    now excludes `.codegraph/` and applies rsync excludes during production
    backup as well as source sync.
- Validation:
  - `node --test test/api-client.test.js test/new-thread-route.test.js
    test/conversation-render.test.js test/codex-profile-preflight.test.js
    test/manual-restart-ui.test.js test/codex-profile-service.test.js`
    passed.
  - `npm run check` passed.
  - Home AI required checks passed:
    `node tests/gateway-run-lifecycle-service.test.js`,
    `node tests/gateway-run-start-service.test.js`,
    `node tests/gateway-run-stream-service.test.js`,
    `node tests/runtime-config-provider.test.js`.
  - Deploy script harness passed:
    `node tests/macos-production-deploy-script.test.js`.
  - `git diff --check` passed in both plugin and app repos.
  - Production files under
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web` match source
    SHA-256 for changed Codex Mobile files.
  - Production `/api/public-config` returned `200`, workspace path
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`, build id
    `d5a4759f39714221`, cache `0.1.11|codex-mobile-shell-v274`.
- Evidence ledger:
  - `evidence-8dd15183-c36a-4d03-bf44-6da1473ab053`.
- Commit / publish:
  - Private local commit message:
    `fix: surface profile and auth send failures`.
  - Public release commit:
    `758a651 fix: surface profile and auth send failures` pushed to
    `git@github.com:pentiumxp/codex-mobile-web-public.git` `main`.
  - README Chinese release note added for v274.
- Remaining state:
  - Codex Mobile plugin source working tree was clean immediately after the
    private commit and public push, except this handoff status update before it
    was amended into the private commit.
  - Plugin dirty files:
    `server.js`, `public/api-client.js`, `public/app.js`,
    `public/styles.css`, `public/sw.js`, `test/api-client.test.js`,
    `test/conversation-render.test.js`, `test/manual-restart-ui.test.js`,
    `test/new-thread-route.test.js`.
  - App dirty files:
    `scripts/deploy-macos-production.js`,
    `tests/macos-production-deploy-script.test.js`.

## 2026-06-10 CodeGraph Install For Codex Mobile Web

- User requested CodeGraph installation in
  `/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web`.
- Initial state:
  - No `.codegraph/` directory existed in this repository.
  - `codegraph` was not on the non-interactive shell PATH.
- Installed `@colbymchenry/codegraph-darwin-arm64@0.9.9` under the Hermes
  Node runtime:
  `/Users/hermes-dev/HermesMobileDev/runtime/node-v24.14.1-darwin-arm64`.
- Added a `codegraph` symlink in that runtime's `bin/`, but non-interactive
  shells may still need the absolute path because the runtime `bin` is not
  always on PATH.
- Initialized the repository index with CodeGraph:
  - Files: 102.
  - Nodes: 3,129.
  - Edges: 10,669.
  - Status: index up to date.
- Configured Codex MCP in `/Users/xuxin/.codex/config.toml`:
  - `mcp_servers.codegraph.command` points to the absolute runtime path
    `/Users/hermes-dev/HermesMobileDev/runtime/node-v24.14.1-darwin-arm64/bin/codegraph`.
  - Args are `["serve", "--mcp"]`.
- Verification:
  - `codegraph status` passed.
  - `codegraph query renderLiveOperationDock` returned
    `public/app.js:9525`.
- Operational note:
  - Restart Codex to load the new CodeGraph MCP tools in future sessions.
- Evidence ledger:
  - `evidence-eddd05b5-96f9-4b84-878d-8fe8119891fe`.

## 2026-06-10 macOS Service And Login Boundary Check

- User asked whether Codex Mobile service depends on a logged-in user and
  whether Codex Mobile can log in after a reboot with no desktop login.
- Runtime/service evidence:
  - `/Library/LaunchDaemons/com.hermesmobile.plugin.codex-mobile.plist` is a
    system `LaunchDaemon`.
  - It has `RunAtLoad=true`, `KeepAlive=true`, and `UserName=xuxin`.
  - `launchctl print system/com.hermesmobile.plugin.codex-mobile` reported
    `state = running`, `spawn type = daemon`, `username = xuxin`.
  - Current PID `44054` listens on `127.0.0.1:8787`, has PPID `1`, and runs
    `/Users/hermes-host/HermesMobile/runtime/node-current/bin/node server.js`.
- Dependency boundary:
  - The service does not depend on a terminal session or Codex Desktop being
    open.
  - It still depends on the `xuxin` Unix account identity and readable files
    under `/Users/xuxin`, including `/Users/xuxin/.codex`,
    `/Users/xuxin/.codex-mobile-web`, and the active profile `auth.json`.
  - After reboot, it should start once macOS reaches the daemon phase and
    `/Users/xuxin` is accessible. If FileVault or other pre-boot unlock keeps
    the home volume unavailable, no user-space daemon can read those files
    before unlock.
- Login distinction:
  - `/api/login` is only Codex Mobile access-key login; it sets the
    `codex_mobile_key` cookie and does not perform ChatGPT/Codex account auth.
  - Codex/ChatGPT account login remains owned by the Codex CLI
    `CODEX_HOME/auth.json` flow. If that token is absent/expired, Mobile can
    show the access-key login page but sends will fail until the selected
    `CODEX_HOME` is re-authenticated through Codex login/device auth.

## 2026-06-10 LKF Codex Profile Auth Diagnostic

- User reported that switching Codex Mobile to the LKF account made message
  sending fail, while the other two accounts worked.
- Current production status at the time of diagnosis:
  - `/api/status?detail=1` returned `ready=true`,
    `transport=managed-ws-child`, `lastError=null`.
  - Active profile was `default`, not LKF/current.
  - The LKF profile was listed as `current`, home
    `/Users/xuxin/.codex-homes/current`, auth label
    `lkf12101975@icloud.com`, auth status `loggedIn`.
- Isolated LKF CLI checks:
  - `CODEX_HOME=/Users/xuxin/.codex-homes/current codex login status`
    returned `Logged in using ChatGPT`.
  - A minimal `codex exec --ephemeral --sandbox read-only` request under the
    LKF home failed before model response with 401 auth errors.
  - Error text, with secrets redacted, said the access token could not be
    refreshed because the refresh token had already been used, and instructed
    to log out and sign in again.
- Conclusion:
  - This is a stale/invalid ChatGPT auth token for the LKF `CODEX_HOME`, not a
    Codex Mobile projection or UI send bug.
  - The settings/profile list can still show `loggedIn` from `auth.json`, but
    real sends fail when Codex attempts token refresh.
- Evidence ledger:
  - `evidence-4d91b712-0fa2-4378-b7eb-c523ce1ee55e`.

## 2026-06-10 Server-Only Stale Steering Fallback

- User reported Home AI thread steering message showed `引导失败，请重试`,
  while steering in this Codex Mobile thread worked.
- Production logs showed repeated Home AI message submissions failing with:
  `expected active turn id <old> but found <current>`.
- Root cause:
  - Existing stale active-turn fallback already skipped `turn/steer` and fell
    through to `thread/resume` / `turn/start` for many stale-turn errors.
  - The app-server's exact `expected active turn id ... but found ...` text was
    not included in `isStaleActiveTurnError()`, so the error surfaced to the
    mobile UI as a failed steer.
- Fix:
  - Extended `isStaleActiveTurnError()` to recognize
    `expected active turn id`.
  - Updated `test/new-thread-route.test.js` to keep this error text covered.
  - This is server-only; no PWA shell cache bump is required.
- Validation:
  - `node --check server.js && git diff --check` passed.
  - Focused tests passed:
    `node --test test/new-thread-route.test.js test/conversation-render.test.js`.
  - `npm run check` passed.
  - Home AI architecture harness check passed:
    `node tests/architecture-code-test-harness-map.test.js`.

## 2026-06-10 v267 Startup/Resume Loading Guard

- User reported occasional `Loading thread` stalls and occasional white screen
  when entering Codex.
- Log findings:
  - Production Codex plugin process was PID `80096`, listening on
    `127.0.0.1:8787`, logging to
    `/Users/hermes-host/HermesMobile/logs/plugin-codex-mobile.out.log` and
    `.err.log`.
  - Authenticated probes succeeded: `/api/status?detail=1` around 140 ms,
    `/api/threads` around 1.07 s, large Home AI thread detail around 650 ms,
    current Codex Mobile thread detail around 260 ms.
  - Recent thread-detail server logs showed 200 completions, not hanging start
    records or 5xx failures.
  - Client event logs did show `mobile_resume_error` / `client_error` with
    `Load failed` on iPhone Chrome/Safari under the Home AI proxy path
    `/api/hermes-plugins/codex-mobile/proxy/`.
- Root cause/risk:
  - Startup used a raw `fetch("/api/public-config")` without timeout, retry, or
    catch. A transient iOS/proxy `Load failed` could abort `start()` before the
    app rendered, matching the white-screen symptom.
  - Mobile resume rethrew transient fetch errors into `showError()`, which could
    leave the embedded page in a degraded state even after the next request would
    succeed.
- Implemented v267:
  - Added bounded timeout/retry helper for `/api/public-config`.
  - Added final startup fallback: embedded mode requests a plugin refresh and
    shows a recovery message instead of staying blank.
  - Treats transient resume errors such as `Load failed`, `Failed to fetch`, and
    timeout/cancel as recoverable: logs bounded event, forces visual recovery,
    and schedules a delayed retry instead of throwing to global error UI.
  - Added `thread_switch_stall` watchdog after 12 s of thread Loading to record
    future stalls with thread id/source/event state and attempt a refresh.
  - Bumped shell/cache to `codex-mobile-shell-v267`.
- Validation:
  - `node --check public/app.js && node --check public/sw.js` passed.
  - `git diff --check` passed.
  - Focused tests passed:
    `node --test test/mobile-viewport.test.js test/thread-goal-service.test.js
    test/thread-task-card-route.test.js`.
  - `npm run check` passed.
- Remaining risk:
  - The issue is intermittent and came from production client logs; no live iOS
    reproduction was captured in this step. Future occurrences should now leave
    `thread_switch_stall` or `public_config_retry/public_config_failed` events
    in `plugin-codex-mobile.out.log`.

## 2026-06-10 v266 Turn Timer Activity Priority

- User reported the top-right run box now almost always showed `思考` and hid
  other live states.
- Root cause:
  - v264/v265 made the timer infer live turns from unfinished reasoning or
    operational items, but `liveActivityLabelForTurn()` still scanned from the
    newest item and returned active reasoning before checking live operations.
  - A long-running unfinished reasoning item could therefore mask newer live
    Command/File/Tool/WebSearch activity.
- Implemented v266:
  - Added `activeLiveOperationItemForTurn()` and changed
    `liveActivityLabelForTurn()` to prioritize the latest unfinished
    operational item before falling back to `思考`.
  - Bumped frontend shell/cache to `codex-mobile-shell-v266`.
  - Added README release note and focused render/version assertions.
- Validation:
  - `node --check public/app.js && node --check public/sw.js` passed.
  - `git diff --check` passed.
  - Focused tests passed:
    `node --test test/conversation-render.test.js
    test/mobile-viewport.test.js test/thread-goal-service.test.js
    test/thread-task-card-route.test.js` with 53 tests.
  - `npm run check` passed.
  - Home AI architecture harness check passed:
    `node tests/architecture-code-test-harness-map.test.js`.
  - Live-debug visual/DOM check on Codex dev `18787` verified:
    reasoning+command shows `命令`, reasoning+file shows `文件`, and
    reasoning-only shows `思考`; elapsed timer values were nonzero.
  - Screenshot artifact:
    `/Users/xuxin/.homeai-qa/artifacts/codex-mobile-turn-timer-v266-20260610T015758Z.png`.
- Operational note:
  - The central allocator had given `ios-pwa-2`, but its Appium lane was not
    usable. The final visual measurement used the already-running live-debug
    server on `19073` with a short debug lease and non-destructive DOM actions.
  - Release any stale `ios-pwa-2` lane lease if still present after this work.

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

## 2026-06-10 Codex Mobile v261 Command Dock Layout

- User reported the live Command/File/Tool box still overlapped message text
  and looked transparent in production.
- Confirmed production had briefly served v259, but v259's fixed overlay dock
  still covered conversation content. Reworked the command dock into a real
  layout row between `#conversation` and `#composer`.
- Product changes:
  - Added `#liveOperationDock` as the dedicated dock container.
  - Removed command dock rendering from the conversation HTML stream.
  - Dock background is opaque and participates in the main grid layout, so it
    does not cover messages or composer controls.
  - Default dock mode is three rows: metadata/status row plus two detail rows.
  - Added compact one-row mode and expanded mode, with small controls and
    vertical swipe handling.
  - PWA shell cache advanced to `codex-mobile-shell-v261`.
- Validation:
  - `npm run check` passed.
  - Focused tests passed:
    `node --test test/collab-agent-render.test.js
    test/conversation-render.test.js test/mobile-viewport.test.js
    test/thread-goal-service.test.js test/thread-task-card-route.test.js`.
  - Home AI harness tests passed:
    `node tests/ios-pwa-live-debug-server.test.js
    tests/ios-pwa-visual-harness.test.js`.
  - Deployment harness checks passed:
    `node --check scripts/deploy-macos-production.js`,
    `node tests/macos-production-deploy-script.test.js`, and
    `node tests/production-status-smoke-harness.test.js`.
  - `git diff --check` passed.
- Visual evidence:
  - Used Home AI live debug against Codex dev port `18787`.
  - Verified normal dock height about `87.5px`, compact about `46px`, expanded
    about `218px`, with no conversation/dock or dock/composer overlap.
  - Screenshot:
    `/Users/xuxin/.homeai-qa/artifacts/codex-mobile-command-dock-v261-20260610T003354Z.png`.
- Evidence ledger:
  - `evidence-d77d3813-dc1e-4cdc-acc7-0207ff0cce5a`.
  - `evidence-17336ea2-6e87-4443-8e6a-0649e4511bef`.

## 2026-06-10 Codex Mobile v262 Command Dock Toggle

- User simplified the command dock control before public push.
- Product changes:
  - Removed the three text controls `1行 / 3行 / 展开`.
  - Dock now defaults to compact one-line mode.
  - Compact mode shows only an upward arrow button to expand.
  - Expanded mode shows a downward arrow button to collapse back to one line.
  - Vertical swipe handling remains: swipe up expands, swipe down collapses.
  - PWA shell cache advanced to `codex-mobile-shell-v262`.
- Validation:
  - `node --check public/app.js && node --check public/sw.js` passed.
  - Focused tests passed:
    `node --test test/collab-agent-render.test.js
    test/conversation-render.test.js test/mobile-viewport.test.js
    test/thread-goal-service.test.js test/thread-task-card-route.test.js`.
  - `npm run check` passed.
- Deployment/public boundary:
  - Private source commit should include this handoff entry.
  - Public sync must exclude `.agent-context` and include only public-safe
    source, README, and tests.

## 2026-06-10 Codex Mobile v263 Turn Timer Activity Priority

- User reported the top-right run box mostly showed `同步` / thread-loading
  status and no longer showed `思考`, file, or command activity.
- Root cause:
  - `refreshCurrentThread()` periodically called `markIdleActivity("同步")`.
  - The existing 3-second guard still allowed low-priority sync labels to
    overwrite longer-running live reasoning/operation labels.
- Product fix:
  - Added `liveActivityLabelForTurn()` and made `updateTurnTimer()` prefer the
    current live turn's actual reasoning/operation/output activity over the
    global idle activity label.
  - `markIdleActivity()` now no-ops while a live turn has inferable activity.
  - PWA shell cache advanced to `codex-mobile-shell-v263`.
- Validation:
  - `node --check public/app.js && node --check public/sw.js` passed.
  - Focused tests passed:
    `node --test test/conversation-render.test.js test/mobile-viewport.test.js
    test/thread-goal-service.test.js test/thread-task-card-route.test.js`.
  - `npm run check` passed.

## 2026-06-10 Codex Mobile v265 Side Chat Bottom Composer

- User reported side chat composer stayed near the top when there was no side
  chat content; it should remain at the bottom of the side-chat panel.
- Root cause:
  - `.side-chat-section` used fixed grid rows for optional queue/error/notice
    blocks. When those optional elements were absent, the scroll/form elements
    occupied earlier auto rows and the flexible row stayed empty below them.
- Product fix:
  - Converted `.side-chat-section` to a column flex layout.
  - `.side-chat-scroll` now flexes to fill the available middle area.
  - `.side-chat-form` is fixed at the bottom of the side-chat section.
  - PWA shell cache advanced to `codex-mobile-shell-v265`.
- Validation:
  - `node --check public/app.js && node --check public/sw.js` passed.
  - Focused tests passed:
    `node --test test/conversation-render.test.js test/mobile-viewport.test.js
    test/thread-goal-service.test.js test/thread-task-card-route.test.js
    test/collab-agent-render.test.js`.
  - `npm run check` passed.
  - Home AI live-debug visual measurement verified empty side-chat composer
    bottom alignment and the right-top timer showing nonzero `思考`.
  - Screenshot:
    `/Users/xuxin/.homeai-qa/artifacts/codex-mobile-side-chat-v265-20260610T011529Z.png`.
- Evidence ledger:
  - `evidence-adf51d2f-b060-4e5b-94a4-7b296176cbcb`.
  - `evidence-ff4dc770-8be1-45d9-8c9d-d98d284f8ac3`.

## 2026-06-10 Public PR #59 Local File Preview Sync

- Public PR:
  - Evaluated `pentiumxp/codex-mobile-web-public#59`.
  - PR was open, non-draft, mergeable/clean, and `Node checks` passed at head
    commit `f0c0618461774355d85907836ff5bbf5754e9c99`.
  - The PR allows authenticated file preview for exact local files referenced
    by the current thread rollout, while preserving absolute-path, extension,
    denylist, size, and exact-file authorization boundaries.
  - Codex skill directories are allowed as explicit preview roots, but the
    whole `.codex` state tree, runtime state, upload roots, local keys, and
    machine diagnostics remain outside preview roots.
- Public merge:
  - Used clean public mirror
    `/Users/hermes-dev/HermesMobileDev/public-mirrors/codex-mobile-web-public`.
  - Public was already pure-synced with current private source except for
    private-only `.agent-context`.
  - Merged PR #59, resolved README by keeping v253-v262 release notes and
    adding a server-only Chinese #59 release note.
  - Pushed public `main` at merge commit
    `69006ff4bcdab207aa8eb6ffea488bd6530f5328`.
  - GitHub reported PR #59 closed and merged at that commit.
- Public validation:
  - `node --check server.js && node --check test/file-preview.test.js`
    passed.
  - Focused checks passed with 34 tests:
    `node --test test/file-preview.test.js test/file-preview-ui.test.js
    test/markdown-render.test.js`.
  - Home AI architecture map guard passed:
    `node tests/architecture-code-test-harness-map.test.js`.
  - `npm run check`, `npm run check:macos`, `git diff --check --cached`, and
    `npm test` passed with 443 tests.
  - Privacy/file scans found no tracked `.agent-context`, runtime state,
    uploads, local keys, private key blocks, or raw private material. Staged
    hits were limited to the new public boundary note, existing public docs
    wording, and test-only fake `.env` / `TOKEN=secret` denylist samples.
  - Evidence ledger entry:
    `evidence-f5b3b725-ce7a-49c3-99b1-127579836f2a`.
- Private reverse sync:
  - Merged public `main` back into private `main` after the public push.
  - README conflict was resolved by preserving private v262/v261 notes and the
    new #59 server-only note.
  - Private merge commit:
    `45f6821c17908881e9a1e4498f7dd07c68865e89`.
- Private validation:
  - Syntax checks and focused file-preview/Markdown checks passed with 34
    tests.
  - `npm run check`, `npm run check:macos`, staged diff hygiene, and the Home
    AI plugin platform contract checker passed.
  - Full `npm test` passed with 443 tests.
  - Evidence ledger entry:
    `evidence-56e2dc52-2075-4e13-86ef-9926af545f0e`.

## 2026-06-10 Public PR #60 Copy Session ID Sync

- Public PR:
  - Evaluated `pentiumxp/codex-mobile-web-public#60`.
  - PR was open, non-draft, mergeable/clean, and `Node checks` passed at head
    commit `df8c75940bfa1797e25a926b886441610e306754`.
  - The PR adds a `复制 Session ID` action to the mobile thread long-press
    menu. The action closes the menu, writes the thread id to the clipboard,
    and shows `已复制 Session ID`.
- Public sync before merge:
  - User directed syncing our private work to public first so public/private do
    not diverge and later public merges do not drop local work.
  - Synced private v267 public-safe files into the clean public mirror
    `/Users/hermes-dev/HermesMobileDev/public-mirrors/codex-mobile-web-public`
    and pushed public commit `33f26c7`.
  - Excluded `.agent-context`, runtime state, local keys, uploads, and
    machine-specific diagnostics.
  - Author metadata note: the already-pushed public sync and merge commits were
    mistakenly authored as `Frank Song <franksong2702@gmail.com>` because that
    environment was still active from PR handling. Do not rewrite public
    history without explicit user approval; future own public/private commits
    should use `PentiumXP <xuxinxp@gmail.com>`.
- Public merge:
  - Merged PR #60, bumped the PWA shell to `codex-mobile-shell-v268`, and added
    the public README Chinese release note.
  - Pushed public `main` at merge commit
    `9a0d0a4b2d762873eb92dbd3641a4a5fa627059e`.
  - GitHub reported PR #60 closed and merged at that commit.
- Public validation:
  - `node --check public/app.js && node --check public/sw.js &&
    node --check test/thread-archive.test.js` passed.
  - Focused checks passed with 47 tests before the v268 assertion fix, then 23
    focused tests after the fix.
  - Home AI architecture map guard, `npm run check`, `npm run check:macos`,
    `git diff --check`, and full `npm test` passed with 445 tests.
  - Privacy/file scans found no tracked `.agent-context`, runtime state,
    uploads, local keys, private key blocks, or raw private material. Diff hits
    were limited to the public README boundary note.
  - Evidence ledger entry:
    `evidence-62c203c0-5e6c-422f-9931-1242fd961b8a`.
- Private reverse sync:
  - Merged public `main` back into private `main`.
  - Resolved v267/v268 conflicts in `public/app.js`, `public/sw.js`, and cache
    assertion tests by keeping v268 plus the PR #60 action.
  - Private merge commit:
    `7b35c7f`.
- Private validation:
  - Syntax checks passed for `public/app.js`, `public/sw.js`, and
    `test/thread-archive.test.js`.
  - Focused private checks passed with 59 tests.
  - `npm run check`, `npm run check:macos`, staged diff hygiene, and the Home
    AI plugin platform contract checker passed.
  - Full `npm test` passed with 445 tests.
  - Evidence ledger entry:
    `evidence-e697c37e-9966-466f-a7c0-98c0373cd4f3`.

## 2026-06-10 Public PR #61 Windows System Startup Sync

- Public PR:
  - Evaluated `pentiumxp/codex-mobile-web-public#61`.
  - PR was open, non-draft, mergeable/clean, and `Node checks` passed at head
    commit `74c3e35ea9c579a878c02a8f98f7b9101b72e6ae`.
  - The PR adds Windows `LocalSystem`/system-startup support: the startup task
    can run before user login, while the windowless launcher maps
    `USERPROFILE`, `HOME`, `APPDATA`, `LOCALAPPDATA`, `TEMP`, and `TMP` back to
    the target user's profile before resolving Codex state, runtime files, and
    installed Codex binaries.
- Merge review finding:
  - The PR's restart service initially routed all Windows `/api/restart` calls
    through a `SYSTEM` helper scheduled task.
  - That is correct for `-RunAsSystem`, but would regress ordinary user-logon
    or manual Windows startup because those processes may not be allowed to
    register a `SYSTEM` task.
  - The public merge was amended before push so ordinary Windows restarts keep
    the previous detached hidden PowerShell path, and only explicit
    `CODEX_MOBILE_WINDOWS_SYSTEM_TASK=1` / `-RunAsSystemTask` deployments use
    the `SYSTEM` helper task.
- Public merge:
  - Used clean public mirror
    `/Users/hermes-dev/HermesMobileDev/public-mirrors/codex-mobile-web-public`.
  - Merged PR #61, added the conditional restart fix above, updated the public
    README Chinese release note, and did not change PWA shell cache because the
    change is server/startup-script only.
  - Pushed public `main` at merge commit
    `3e474435f9ce8d3dd5303942b47239f3443e5858`.
  - GitHub reported PR #61 closed and merged at that commit.
- Public validation:
  - Syntax checks passed for `adapters/shared-chain-restart-service.js`,
    `server.js`, and focused tests.
  - Focused checks passed with 22 tests:
    `node --test test/shared-chain-restart-service.test.js
    test/codex-profile-ui.test.js test/hermes-plugin-route.test.js`.
  - Home AI architecture map guard, `npm run check`, `npm run check:macos`,
    `git diff --check`, and full `npm test` passed with 450 tests.
  - Privacy/file scans found no tracked `.agent-context`, runtime state,
    uploads, local keys, private key blocks, or raw private material. Diff hits
    were limited to the public README boundary note and test-only safe sample
    paths such as `.codex-homes`.
  - Evidence ledger entry:
    `evidence-5edfd633-f0f5-4581-8051-b1d4ba2b2f94`.
- Private reverse sync:
  - Merged public `main` back into private `main`.
  - Private merge commit:
    `4ed8d1b`.
- Private validation:
  - Syntax checks and focused restart/profile/plugin route checks passed with
    22 tests.
  - `npm run check`, `npm run check:macos`, diff hygiene, and the Home AI
    plugin platform contract checker passed.
  - Full `npm test` passed with 450 tests.
  - Evidence ledger entry:
    `evidence-6a960b94-2b46-481c-9694-dc75f65d2b02`.

## 2026-06-10 v270 Side Chat Composer Autosize

- User requested the side-chat composer behave like the main thread composer:
  textarea grows with additional lines, and the clear action must not occupy
  the bottom composer row.
- Implemented in the private workspace, not yet deployed to production:
  - `public/app.js` adds side-chat textarea autosizing using the same
    scroll-height clamp pattern as the main composer, refreshes sizing after
    side-chat panel renders, and exposes it through the visual harness facade.
  - `public/app.js` moves side-chat clear from the bottom composer row to the
    side-chat header and keeps its disabled state synced while typing.
  - `public/styles.css` changes the side-chat composer row back to
    `+ / textarea / Send`, styles the header clear button, and keeps keyboard
    compact max-height behavior.
  - `scripts/side-chat-layout-visual-fixture.js` now verifies the new header
    clear location and autosized textarea in full and keyboard fixture modes.
  - PWA shell/cache advanced to `codex-mobile-shell-v270`.
- This working tree also still contains the earlier v269 fix for hiding
  durable historical user bubbles in an active live turn after non-user
  progress has started.
- Validation:
  - `node --check public/app.js && node --check public/sw.js &&
    node --check test/mobile-viewport.test.js` passed.
  - Focused tests passed with 48 tests:
    `node --test test/mobile-viewport.test.js test/conversation-render.test.js
    test/turn-scroll-controls.test.js`.
  - `npm run check`, `git diff --check`, and Home AI
    `node tests/architecture-code-test-harness-map.test.js` passed.
  - Side-chat visual fixture passed in both full and keyboard modes:
    `node scripts/side-chat-layout-visual-fixture.js --json` and
    `node scripts/side-chat-layout-visual-fixture.js --keyboard --json`.
  - Evidence ledger entry:
    `evidence-d2fffdb4-7fb6-4add-bf41-f6672dc92e3a`.

## 2026-06-11 v271 Current Submitted User Message Visibility

- User reported that after sending a long message, the message initially
  appeared, then disappeared once model intermediate progress started, and did
  not return.
- Root cause:
  - The v269 live-turn old-user-message filter hid any non-optimistic durable
    `userMessage` after assistant/reasoning/Command progress appeared.
  - When the app-server durable echo replaced the local pending echo, it was no
    longer optimistic, so the filter incorrectly hid the current submission.
- Implemented:
  - Frontend keeps a short-lived in-memory map of this browser session's recent
    submitted `clientSubmissionId`s.
  - Durable user messages that preserve one of those `clientSubmissionId`s are
    not filtered by the old-history hiding rule.
  - User-message merge keeps `clientSubmissionId` metadata when collapsing a
    local/mux echo into a durable app-server echo.
  - Existing v269 behavior remains for already-existing historical durable
    user messages in long-running live turns.
  - PWA shell/cache advanced to `codex-mobile-shell-v271`.
- Validation:
  - `node --check public/app.js && node --check public/sw.js &&
    node --check test/conversation-render.test.js` passed.
  - `node --test test/conversation-render.test.js` passed with 38 tests,
    including the regression that keeps this-session durable user messages
    visible after live progress starts.
  - Focused combined tests passed with 49 tests:
    `node --test test/mobile-viewport.test.js test/conversation-render.test.js
    test/turn-scroll-controls.test.js`.
  - `npm run check`, `git diff --check`, and Home AI
    `node tests/architecture-code-test-harness-map.test.js` passed.
- Production:
  - Initial deploy failed because production contained
    `.codegraph/daemon.sock`; rsync cannot back up that socket.
  - Removed only that production diagnostic socket file and reran deploy. The
    deploy command output was interrupted, but production files and service
    state confirm the update landed.
  - Production `/api/public-config` returned
    `clientBuildId=0.1.11|codex-mobile-shell-v271` and
    `shellCacheName=codex-mobile-shell-v271`.
  - Authenticated `/api/status?detail=1` returned ready with
    `transport=managed-ws-child` and no last error; launchd showed
    `com.hermesmobile.plugin.codex-mobile` running with PID `92093`.
  - Evidence ledger entry:
    `evidence-a1dfca7b-9175-4240-abcb-7b595fa418ef`.

## 2026-06-11 v272 Current Submitted User Message Fallback Match

- User reported the v271 fix still had the opposite failure mode: after
  sending a message, the current user bubble could disappear once model
  progress started.
- Root cause:
  - v271 only exempted durable current-user echoes when the projected
    `userMessage` still carried `clientSubmissionId`.
  - Some durable projection paths can drop that frontend-only id, so the v269
    historical-user-message filter still treated the current submission as an
    old user bubble and hid it.
- Implemented:
  - `isRecentlySubmittedUserMessage` still prefers exact
    `clientSubmissionId` matches.
  - If the id is absent, it now checks same-thread recent submitted records and
    uses the existing `userMessagesLikelySame` content/signature matcher against
    the locally registered submitted item.
  - Existing behavior remains: old durable user messages in already-running
    live turns are still hidden after assistant/reasoning/Command progress
    appears.
  - PWA shell/cache advanced to `codex-mobile-shell-v272`.
  - README Chinese interface note documents the v272 behavior.
- Validation:
  - `node --check public/app.js && node --check public/sw.js &&
    node --check test/conversation-render.test.js` passed.
  - `node --test test/conversation-render.test.js` passed with 39 tests,
    including the new no-`clientSubmissionId` durable echo regression.
  - Focused combined tests passed with 23 tests:
    `node --test test/mobile-viewport.test.js test/thread-goal-service.test.js
    test/thread-task-card-route.test.js test/turn-scroll-controls.test.js`.
  - `npm run check`, `git diff --check`, and Home AI
    `node tests/architecture-code-test-harness-map.test.js` passed.
  - Evidence ledger entry:
    `evidence-09653502-cc1a-4b5c-b7a3-7bfc53571321`.
- Git:
  - Private local commit: `13fea3a fix: keep current submitted user message
    visible`.
  - Public mirror pushed: `549541c fix: keep current submitted user message
    visible`.
- Production:
  - User observed the fix as already effective.
  - A follow-up deploy command was started by mistake and interrupted after the
    user clarified not to redeploy; no further restart/deploy action was taken
    after that clarification.

## 2026-06-11 v273 Empty Active Turn / Stop State Repair

- User reported Home AI thread display was still wrong:
  - A completed thread showed a false `Stop` state.
  - Clicking Stop could not stop anything, making the thread look stuck.
  - Recent user guidance inside the same Home AI turn could disappear, while
    Codex replies remained visible.
  - An older-looking message could remain near the bottom even after many newer
    items had arrived.
- Root cause confirmed from real Home AI thread
  `019ea77e-4e36-7820-adf4-9bf0272965b8`:
  - API/projection returned a trailing `inProgress` turn with zero items after
    the real latest completed turn.
  - v272 frontend treated the raw last turn as latest/active, so Composer and
    side-chat state showed Stop/steer mode even though the thread status was
    `idle`.
  - The live-turn user-message hiding rule was still too broad for real Home AI
    shape: it could hide a mid-turn user steer that later had a Codex text
    response.
- Implemented:
  - `latestTurn()` skips empty projection tails and returns the latest turn that
    has display items.
  - `syncActiveTurnFromThread()` and `currentLiveTurn()` now use that same
    latest-turn helper, so empty active tails do not drive Stop, running state,
    side-chat queue labels, or live docks.
  - Durable live user-message filtering now keeps:
    - initial prompt user messages,
    - mid-turn user steer messages that have a later visible Codex text reply,
    - recent/optimistic locally submitted messages.
  - It still hides unanswered trailing durable user bubbles after non-user
    progress unless they are recent/optimistic, preventing stale old inputs from
    sitting at the bottom.
  - PWA shell/cache advanced to `codex-mobile-shell-v273`.
  - README Chinese interface note documents the v273 behavior.
- Validation:
  - `node --check public/app.js && node --check public/sw.js &&
    node --check test/conversation-render.test.js` passed.
  - `node --test test/conversation-render.test.js test/new-thread-route.test.js
    test/turn-scroll-controls.test.js` passed with 62 tests.
  - `node --test test/mobile-viewport.test.js test/thread-goal-service.test.js
    test/thread-task-card-route.test.js` passed with 17 tests.
  - `npm run check`, `git diff --check`, and Home AI
    `node tests/architecture-code-test-harness-map.test.js` passed.
  - Real Home AI thread data-level helper smoke passed:
    raw last turn had zero items, latest display turn became the completed turn,
    `activeTurnId` cleared, interrupt disabled, and both the 09:35 prompt and
    09:37 responded steer were visible.
  - Evidence ledger entry:
    `evidence-50e53bc7-ac2b-41d1-94bf-add2376dd68f`.
- Production:
  - User confirmed the behavior was OK.
  - Production `/api/public-config` showed
    `clientBuildId=0.1.11|codex-mobile-shell-v273` and
    `shellCacheName=codex-mobile-shell-v273`.
  - After user explicitly said not to update production again, no further
    production deploy/restart was performed.

## 2026-06-12 Default Profile No-Response Diagnosis

- User reported that switching Codex Mobile to the `Default` account/profile,
  restarting, and sending a message produced no response. They then switched
  back to `Previous`, which restored operation.
- Current production state after the user switched back:
  - Active profile is `previous`.
  - Mobile Web is running as LaunchDaemon
    `system/com.hermesmobile.plugin.codex-mobile` on port `8787`.
  - The managed app-server child is running with
    `CODEX_HOME=/Users/xuxin/.codex-homes/previous`.
- Diagnosis performed without switching production back to `Default`:
  - Started a separate local app-server on an ephemeral localhost port with
    `CODEX_HOME=/Users/xuxin/.codex` and the same Mobile-owned app-server style
    environment.
  - `initialize` succeeded and `thread/list` returned normally, so the Default
    profile can start the app-server and read local thread state.
  - `account/rateLimits/read` failed with 401 from ChatGPT usage API, reporting
    `token_expired` and `refresh_token_reused`; the app-server log said the
    access token could not be refreshed and the user must sign in again.
- Conclusion:
  - The Default profile auth file exists, so the profile list can still appear
    logged-in from local file presence, but the live auth token chain is invalid.
  - The required recovery is re-login for `CODEX_HOME=/Users/xuxin/.codex`.
  - Do not copy tokens between profiles; use the normal Codex login flow for
    Default.
- No production restart, deploy, or profile switch was performed during this
  diagnosis.

## 2026-06-12 Profile Switch Preflight Guard

- User asked to change account switching so Codex Mobile tests the target
  account login before switching, instead of blindly activating a broken
  profile and then failing after restart.
- Implemented in `server.js`:
  - `/api/codex-profiles/active` now resolves the target profile without
    writing state.
  - It starts a temporary localhost app-server for the target `CODEX_HOME`,
    sends `initialize`, then sends `account/rateLimits/read`.
  - Only after preflight succeeds does it call `setActiveProfile()` and trigger
    shared-chain restart.
  - Preflight failure returns `409` with a stable code such as
    `target_profile_auth_invalid`, and does not write `activeProfileId` or
    restart Mobile Web.
  - Error messages are bounded and do not include auth file contents or tokens.
- Tests:
  - Added `test/codex-profile-preflight.test.js` for expired-token and
    app-server-startup error classification.
  - Strengthened `test/manual-restart-ui.test.js` so profile switch preflight
    must happen before `setActiveProfile()` and restart.
- Validation:
  - `node --check server.js`
  - `node --check adapters/codex-profile-service.js`
  - `node --test test/codex-profile-preflight.test.js
    test/manual-restart-ui.test.js test/codex-profile-service.test.js`
  - `npm run check`
  - `git diff --check`
  - AI Ops required gateway/runtime checks:
    `node tests/gateway-run-lifecycle-service.test.js`,
    `node tests/gateway-run-start-service.test.js`,
    `node tests/gateway-run-stream-service.test.js`,
    `node tests/runtime-config-provider.test.js`
- No production restart, deploy, or profile switch was performed.

## 2026-06-12 Profile Switch Preflight Deploy And Moria Recovery

- Committed profile-switch preflight guard as:
  `f38285d fix: preflight codex profile switches`.
- Production deploy command was interrupted from the tool side, but production
  state showed the sync and restart had already taken effect:
  - Production `server.js` contains `preflightCodexProfileSwitch` and
    `target_profile_auth_invalid`.
  - Source and production `server.js` SHA-256 prefixes matched:
    `9e29f32a348b76a0`.
  - `/api/public-config` returned 200 from production path
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - `/api/status?detail=1` returned `ready=true`,
    `transport=managed-ws-child`, `lastError=null`, active profile `previous`.
- User then reported the `moria` thread could not be accessed.
- Diagnosis:
  - Thread id: `019eb533-09ae-72b3-a54a-1a797fa208e1`.
  - Workspace: `/Users/xuxin/Documents/moria`.
  - Thread detail API returned 200, but the thread was stuck active because an
    automatic goal continuation loop had produced multiple failed empty turns
    and a final empty `inProgress` turn.
  - Goal remained active, causing new continuation turns to be created after
    repeated stream-disconnect failures.
- Recovery performed:
  - Paused the thread goal through `/api/threads/<id>/goal/actions` with
    action `pause`; goal became `blocked`.
  - Interrupted the latest active empty turn
    `7f1d5a88-75ea-4e53-88f3-851e495b9b8f`.
  - Final verification: thread detail returned 200, thread status `idle`, goal
    status `blocked`, final empty turn status `interrupted`.
- No additional production restart was performed after the moria recovery.

## 2026-06-12 Embedded Voice Input Bridge

- Status: completed for the Codex Mobile Web embedded-plugin side; committed
  and deployed to Mac production. Standalone Codex Mobile behavior remains out
  of scope and is gated off by embedded-mode checks.
- Commit:
  - `7300c29 feat: add embedded voice input bridge`.
  - Local `main` is ahead of `origin/main` by 1 commit after this work; no push
    was performed in this closure step.
- Scope:
  - Added `public/plugin-voice-input.js` as the Home AI voice input bridge
    helper.
  - Embedded Codex responds to `voice_input.capability_query` and handles
    bounded draft insertion/replacement/append messages from Home AI.
  - Embedded send-button long press posts `voice_input.start_request` to the
    Home AI host; release posts `voice_input.stop_request`.
  - Successful sends post `voice_input.commit_result` so Home AI can learn
    bounded correction pairs.
  - Empty send buttons are enabled only for embedded voice availability; normal
    empty click still no-ops.
- Validation:
  - `node --check public/plugin-voice-input.js public/app.js public/sw.js`.
  - Focused `node --test` set covering plugin voice input, embedded mode,
    composer draft, viewport, goal, and task-card routes passed.
  - `npm run check`, `npm test`, and `npm run check:macos` passed.
  - Home AI platform contract checker passed for `codex-mobile`, with only the
    existing `handoff_pointer_missing` warning.
  - Local temp-port smoke confirmed shell/cache `codex-mobile-shell-v276`,
    script order, and voice bridge assets.
- Production deployment:
  - Deployed from `/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web`
    to `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web` using the
    central Mac deploy script with reason `codex-voice-input-v276`.
  - Production smoke confirmed `/api/public-config` reports
    `clientBuildId=0.1.11|codex-mobile-shell-v276` and
    `shellCacheName=codex-mobile-shell-v276`.
  - Production manifest still reports `plugin_id=codex-mobile`,
    `kind=embedded_app`, and entry URL `http://127.0.0.1:8787/?embed=hermes`.
  - Production `/?embed=hermes` includes `plugin-voice-input.js` before
    `app.js`, and `/plugin-voice-input.js` is served.

## 2026-06-13 Embedded Stop Voice Hold v278

- Status: fixed, committed, deployed, and production-smoked for the Codex Mobile
  Web embedded Home AI plugin. This was a Codex plugin-side issue, not the Home
  AI host composer: Codex renders its own active-turn Stop button inside the
  iframe.
- Commit:
  - `663fb75 fix: harden embedded stop voice hold`.
- Behavior change:
  - In Hermes embedded mode, an active Codex turn with an empty composer now
    still exposes the send/Stop button as a voice long-press gesture target.
  - Pointer down prevents default selection immediately, so iOS should not show
    a text selection/copy callout before the long-press threshold.
  - Embedded active-turn Stop no longer renders visible selectable `Stop` text in
    the button DOM; it uses a CSS visual proxy while preserving aria/title text.
  - Short tap on the active-turn button remains the interrupt path; long press
    is consumed by the Home AI voice bridge.
  - Standalone Codex Mobile remains gated by `isHermesEmbedMode()` for the voice
    bridge/proxy behavior.
- Files changed:
  - `public/app.js`
  - `public/styles.css`
  - `public/sw.js`
  - `test/plugin-voice-input.test.js`
  - `test/mobile-viewport.test.js`
  - `test/thread-goal-service.test.js`
  - `test/thread-task-card-route.test.js`
  - `README.md`
- Validation:
  - `npm run check` passed.
  - Focused `npm test -- --test-reporter=spec test/plugin-voice-input.test.js
    test/mobile-viewport.test.js test/thread-goal-service.test.js
    test/thread-task-card-route.test.js` passed.
  - Full `npm test` passed before the README-only release note was added: 467
    tests passed.
  - Local Chrome headless smoke against a temp 18878 listener loaded
    `0.1.11|codex-mobile-shell-v278` and verified embedded active-turn Stop had
    `text=""`, `data-visual-label="Stop"`, empty selection, and prevented
    pointerdown/pointerup/click defaults.
- Production deployment:
  - Deployed to `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web` via
    Home AI central Mac deploy script for plugin `codex-mobile-web`, reason
    `codex-stop-voice-hold-v278`.
  - Production `/api/public-config` readback reports
    `clientBuildId=0.1.11|codex-mobile-shell-v278` and
    `shellCacheName=codex-mobile-shell-v278`.
  - Production `launchctl print system/com.hermesmobile.plugin.codex-mobile`
    showed state `running`, working directory
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`, pid `21256`, and
    last exit code `0`.
  - Production manifest returned `id=codex-mobile`, `kind=embedded_app`, entry
    `http://127.0.0.1:8787/?embed=hermes`.
  - Production static reads confirmed v278 app/sw and the new Stop proxy CSS.
  - Production Chrome headless smoke verified the same Stop long-press DOM/event
    behavior against `http://127.0.0.1:8787/?embed=hermes`.

## 2026-06-13 Embedded Voice Steering Insert v279

- Status: fixed, committed, pushed, deployed without restarting the Codex
  listener, and production-smoked.
- Commit:
  - `de86135 fix: allow embedded voice steering insert`.
- User-visible issue:
  - After v278, active-turn Stop long press could start voice recording, but the
    transcribed text was rejected as `composer_not_writable` and the user could
    only cancel.
- Root cause:
  - v278 relaxed the long-press start path for embedded active turns, but the
    return `voice_input.insert_text` / `replace_draft` path still used the
    ordinary `pluginVoiceInputComposerWritable()` gate. In active-turn Stop
    state, the DOM composer can be temporarily marked non-editable even though
    Codex can still accept steering text.
- Fix:
  - Added `pluginVoiceInputCanReceiveText()`.
  - `pluginVoiceInputCapabilityPayload().writable` and insert rejection
    telemetry now use the new receive-text gate.
  - The gate returns true when the ordinary composer is writable, or when this
    is a Hermes embedded active turn that can receive steering text.
  - Bumped shell cache to `codex-mobile-shell-v279`.
- Validation:
  - `npm run check` passed.
  - Focused `npm test -- --test-reporter=spec test/plugin-voice-input.test.js
    test/mobile-viewport.test.js test/thread-goal-service.test.js
    test/thread-task-card-route.test.js` passed.
  - Dev Chrome headless smoke against `127.0.0.1:18879` forced
    `messageInput.contentEditable=false` and `aria-disabled=true`, then called
    `applyPluginVoiceInputTextMessage(...)`; before insert
    `normalWritable=false`, `canReceive=true`, `capabilityWritable=true`; after
    insert composer text was `吴萍是我老婆` and the button became `引导`.
- Production deployment:
  - Pushed `main` to `origin`.
  - Deployed through the Home AI central Mac deploy script with
    `--restart none` and explicit health URL, so `com.hermesmobile.plugin.codex-mobile`
    was not restarted.
  - Production readback:
    `clientBuildId=0.1.11|codex-mobile-shell-v279`,
    `shellCacheName=codex-mobile-shell-v279`.
  - Launchd readback after deploy: state `running`, `runs=112`, pid `21256`,
    last exit code `0`; same pid as v278 smoke, confirming no listener restart.
  - Production static readback confirmed `pluginVoiceInputCanReceiveText()` and
    v279 app/sw.
  - Production Chrome headless smoke against `127.0.0.1:8787` reproduced the
    forced-non-writable active-turn insert case and confirmed text was inserted
    and the button switched to `引导`.

## 2026-06-13 Listener/App-Server Reconnect Auto Turn Recovery v280

- Status: implemented and locally validated; not deployed in this turn.
- Deployment update: committed and deployed after user requested submit/deploy.
  First upgrade cannot auto-recover turns that were already running in pages
  loaded with v279, because the browser-side trigger only exists after the
  client loads v280. Future listener/app-server reconnects after the page has
  loaded v280 should use the auto-recover route.
- Commit:
  - `c8e7e90 fix: 自动续接断线后的 Codex turn`
- User-visible goal:
  - If a Listener/app-server update disconnects an in-progress Codex Mobile
    turn, the mobile page should automatically continue the current thread after
    the app-server becomes ready again. It should prefer continuing the existing
    live turn when possible, but may start a new turn if the old turn is no
    longer steerable.
- Implementation:
  - `server.js` adds `POST /api/threads/:id/auto-recover`.
  - The server first reads recent `thread/turns/list`, tries `turn/steer` with a
    bounded continuation prompt for a still-live turn, then falls back to
    `thread/resume` plus `turn/start` when steering is unavailable/stale.
  - The route has a thread-level in-memory cooldown controlled by
    `CODEX_MOBILE_AUTO_TURN_RECOVERY_COOLDOWN_MS` and prompt override
    `CODEX_MOBILE_AUTO_TURN_RECOVERY_PROMPT`.
  - `public/app.js` triggers recovery only when `/api/status` or an app-server
    status notification shows a transition from unavailable/not-ready to ready;
    plain EventSource errors are not enough, to avoid injecting `继续` during
    ordinary SSE jitter.
  - PWA shell cache advanced to `codex-mobile-shell-v280`.
- Files changed:
  - `server.js`
  - `public/app.js`
  - `public/sw.js`
  - `README.md`
  - `docs/ARCHITECTURE.md`
  - `docs/COMPLEX_FEATURE_PATHS.md`
  - `docs/TROUBLESHOOTING.md`
  - `test/new-thread-route.test.js`
  - `test/mobile-viewport.test.js`
  - `test/thread-goal-service.test.js`
  - `test/thread-task-card-route.test.js`
- Validation:
  - `node --check server.js`
  - `node --check public/app.js`
  - `node --check test/new-thread-route.test.js`
  - `node --check test/mobile-viewport.test.js`
  - `node --test test/new-thread-route.test.js`
  - `node --test test/mobile-viewport.test.js`
  - `node --test test/active-turn-staleness-service.test.js`
  - `npm run check`
  - `npm test` passed: 468/468.
  - `git diff --check`
  - Dev runtime smoke with a fake JSONL TCP app-server and temporary Mobile Web
    listener passed without touching real Codex threads:
    - still-live thread result:
      `{ recovered: true, action: "steered", turnId: "turn-live" }`
    - fallback thread result:
      `{ recovered: true, action: "started", turnId: "turn-new" }`
    - observed fake app-server calls:
      `thread-steer`: `thread/turns/list -> turn/steer`;
      `thread-fallback`: `thread/turns/list -> turn/steer -> thread/resume -> turn/start`.
- Production deployment:
  - Deployed through Home AI central Mac deploy script for plugin
    `codex-mobile-web`, timestamp `20260613T132000Z`, reason
    `codex-auto-turn-recovery-v280`.
  - Production `/api/public-config` readback:
    `clientBuildId=0.1.11|codex-mobile-shell-v280`,
    `shellCacheName=codex-mobile-shell-v280`.
  - Production authenticated `/api/status?detail=1` readback:
    `ready=true`, `transport=managed-ws-child`, `lastError=null`,
    active profile `default`.
  - Production launchd readback:
    `com.hermesmobile.plugin.codex-mobile` state `running`, pid `55684`,
    `runs=113`, last exit code `0`.
  - AI Ops evidence:
    `evidence-bfec11c1-e986-4c30-b882-71e2501b935c`.

## 2026-06-13 Restart Risk Thread Auto Recovery v281

- Status: implemented and locally validated after production v280 showed that
  Restart recovery only covered the current thread.
- Production observation before fix:
  - `/api/threads?limit=20&archived=false` showed `Home AI 06-12` and `星盘`
    still `status={ type: "active" }`.
  - No `auto_turn_recovery` client events were found in bounded log search.
  - Manual `/auto-recover` call for `Home AI 06-12` succeeded with
    `{ recovered: true, action: "steered" }`.
  - Manual `/auto-recover` call for `星盘` returned
    `no active turn to steer`, revealing a stale-turn error text not covered by
    the v280 fallback matcher.
- Fix:
  - `public/app.js` now stores the Restart confirmation risk thread list as a
    one-shot local recovery queue before calling `/api/restart/shared-chain`.
  - When app-server status recovers to ready, the client calls
    `/api/threads/:id/auto-recover` for every queued risk thread, plus the
    current thread if applicable.
  - The queue stores bounded metadata only: thread id, active turn id, cwd,
    name, and status.
  - `server.js` treats `no active turn` as a stale active-turn error so
    auto-recovery can fall back to `thread/resume` plus `turn/start`.
  - PWA shell cache advanced to `codex-mobile-shell-v281`.
- Validation:
  - `node --check server.js && node --check public/app.js`
  - `node --test test/new-thread-route.test.js test/mobile-viewport.test.js test/manual-restart-ui.test.js`
  - `npm run check`
  - Dev runtime smoke with fake JSONL TCP app-server verified:
    `thread-steer` uses `thread/turns/list -> turn/steer`, and
    `thread-fallback` handles `no active turn to steer` with
    `thread/turns/list -> turn/steer -> thread/resume -> turn/start`.
  - `npm test` passed: 468/468.
- Commit:
  - `2684137 fix: 恢复重启风险线程`
- Production deployment:
  - Deployed through Home AI central Mac deploy script for plugin
    `codex-mobile-web`, timestamp `20260613T133500Z`, reason
    `codex-restart-risk-auto-recovery-v281`.
  - Production `/api/public-config` readback:
    `clientBuildId=0.1.11|codex-mobile-shell-v281`,
    `shellCacheName=codex-mobile-shell-v281`.
  - Production authenticated `/api/status?detail=1` readback:
    `ready=true`, `transport=managed-ws-child`, `lastError=null`,
    active profile `default`.
  - Production launchd readback:
    `com.hermesmobile.plugin.codex-mobile` state `running`, pid `69827`,
    `runs=115`, last exit code `0`.
  - Manual production recovery after v281 deploy:
    `星盘` `/auto-recover` returned
    `{ recovered: true, action: "started", turnId: "019ec12c-ee77-7593-b1a9-f04ac1512822" }`.
    The earlier Home AI manual recovery on v280 had already returned
    `{ recovered: true, action: "steered" }`.
  - AI Ops evidence:
    `evidence-9268c3ff-1773-4f85-88d0-1f8a8fc8ea7f`.

## 2026-06-17 iOS WebView Profile Switch Confirmation

- Status: implemented locally; not deployed in this turn.
- Symptom:
  - In the iOS native shell WebView, Codex Profile switching was unreliable when
    tapping the target account. PWA behavior was reported as working.
  - Authenticated `/api/status` still showed profile discovery and switch
    support as healthy, so the failure boundary was the client-side confirmation
    path rather than profile store discovery.
- Fix:
  - `public/app.js` splits Profile switching into confirmation and execution
    phases.
  - PWA/standalone keeps the existing `window.confirm` flow.
  - Hermes embedded mode uses a DOM confirmation dialog
    `profileSwitchConfirmDialog`, avoiding native WebView `window.confirm`
    focus/callback behavior.
  - The existing `/api/codex-profiles/active` preflight, POST, restart prompt,
    and status text are unchanged.
- Changed files:
  - `public/app.js`
  - `public/index.html`
  - `public/styles.css`
  - `test/codex-profile-ui.test.js`
- Validation:
  - `node --check public/app.js`
  - `node --check server.js`
  - `node --test test/codex-profile-ui.test.js test/codex-profile-service.test.js test/codex-profile-preflight.test.js`
  - `git diff --check`
  - `npm run check`
  - `npm test` passed: 486/486.
  - Lightweight runtime assertion verified embedded-mode confirmation opens the
    DOM dialog path while PWA remains isolated on `window.confirm`.
- Note:
  - `docs/HOME_AI_PLATFORM_CONTRACT.md` was already dirty before this fix and
    was not touched for this task.

## 2026-06-18 iOS WebView Archive And Continuation Source Hide v298

- Status: committed and deployed to Mac production.
- Commit:
  - `21f8bd1 fix: 修复续接归档与 WebView 归档确认`
- User-visible issue:
  - After `压缩续接`, the old source thread could remain visible in Codex
    Mobile, as observed with `Home AI 06-12`.
  - In the iOS native shell WebView, manual archive could appear to do nothing
    because the confirmation path still used native `window.confirm()`.
- Fix:
  - Manual archive now uses an in-app `threadArchiveConfirmDialog` in Hermes
    embedded mode; PWA/standalone keeps the native confirm path.
  - After archive POST succeeds, the thread row is removed from the current
    client list immediately before the silent list refresh.
  - Continuation source archiving still tries app-server `thread/archive` first.
    If that RPC fails after the new continuation thread is already created, the
    server writes the source thread id to the Mobile local archive index and
    returns `sourceArchive.archived=true` with bounded `archiveError` metadata.
  - PWA shell cache advanced to `codex-mobile-shell-v298`.
- Changed files:
  - `server.js`
  - `public/app.js`
  - `public/index.html`
  - `public/styles.css`
  - `public/sw.js`
  - `test/thread-archive.test.js`
  - `test/continuation-lineage.test.js`
  - `test/mobile-viewport.test.js`
  - `test/thread-goal-service.test.js`
  - `test/thread-task-card-route.test.js`
  - `docs/TROUBLESHOOTING.md`
  - `README.md`
- Validation:
  - `node --check public/app.js`
  - `node --check server.js`
  - `node --test test/thread-archive.test.js test/mobile-archive-index-service.test.js test/thread-visibility.test.js test/continuation-lineage.test.js`
  - `node --test test/thread-archive.test.js test/mobile-archive-index-service.test.js test/thread-visibility.test.js test/continuation-lineage.test.js test/mobile-viewport.test.js test/thread-task-card-route.test.js test/thread-goal-service.test.js`
  - `npm run check`
  - `npm test` passed: 488/488.
  - Home AI center harness:
    `node tests/architecture-code-test-harness-map.test.js`.
  - `git diff --check`
- Production deployment:
  - Deployed through Home AI central Mac deploy script for plugin
    `codex-mobile-web`.
  - Production `/api/public-config` readback:
    `clientBuildId=0.1.11|codex-mobile-shell-v298`,
    `shellCacheName=codex-mobile-shell-v298`.
  - Deploy evidence:
    `evidence-28ce981d-8e50-4a15-a39f-1a8aa63c606a`.
- Note:
  - `docs/HOME_AI_PLATFORM_CONTRACT.md` was already dirty before this fix and
    remains unrelated.

## 2026-06-18 Deferred Thread List Title Hydration v299

- Status: committed and deployed to Mac production.
- Commit:
  - `5382d2c fix: 首屏水合线程正式标题`
- User-visible issue:
  - After the v297 cold-start `fallback=defer` optimization, some renamed or
    continuation threads briefly displayed their initial app-server title before
    the delayed full fallback refresh restored the official display name.
- Fix:
  - The deferred `/api/threads?fallback=defer` path still skips expensive state
    DB and rollout fallback scans for first paint.
  - It now applies the lightweight `session_index.jsonl` title hydration to the
    app-server result before decoration and response, so renamed/continuation
    thread titles are correct on the first visible list render.
  - PWA shell cache advanced to `codex-mobile-shell-v299`.
- Changed files:
  - `server.js`
  - `public/app.js`
  - `public/sw.js`
  - `test/thread-visibility.test.js`
  - `test/mobile-viewport.test.js`
  - `test/thread-goal-service.test.js`
  - `test/thread-task-card-route.test.js`
  - `docs/ARCHITECTURE.md`
  - `README.md`
- Validation:
  - `node --check server.js && node --check public/app.js && node --check public/sw.js`
  - `node --test test/thread-visibility.test.js test/mobile-viewport.test.js test/thread-task-card-route.test.js test/thread-goal-service.test.js`
  - `npm run check`
  - `npm test` passed: 489/489.
  - `git diff --check`
  - AI Ops evidence: `evidence-4fdaf8a8-df75-43cb-ac0c-36610e9f2eac`.
- Production deployment:
  - Deployed through Home AI central Mac deploy script for plugin
    `codex-mobile-web`.
  - Production `/api/public-config` readback:
    `clientBuildId=0.1.11|codex-mobile-shell-v299`,
    `shellCacheName=codex-mobile-shell-v299`.
  - Deploy evidence:
    `evidence-970e6dab-df49-45cf-9021-966c6e2902e6`.
- Note:
  - `docs/HOME_AI_PLATFORM_CONTRACT.md` remains an unrelated pre-existing dirty
    file and was not touched for this fix.

## 2026-06-19 Superseded Live Turn Image Projection Fix

- Status: implemented and validated locally; not committed or deployed yet.
- User-visible issue:
  - Historical uploaded/tool-viewed images could reappear near the bottom of a
    thread, and in one observed thread an old image card stayed under an
    `inProgress` separator.
- Finding:
  - The current thread-detail API output contained multiple older turns whose
    durable status was still `inProgress`, even though newer turns existed.
    This allowed old image cards and old live-turn state to be treated as a
    current running area by the mobile projection/UI.
- Fix:
  - `compactThread()` now normalizes any non-latest live turn to a completed
    historical status with `mobileSupersededLive=true`.
  - Existing image cards remain in their original historical turn; only the
    latest turn can remain live.
  - Thread-detail projection cache policy advanced from
    `state-relevant-receipt-v1` to `state-relevant-receipt-v2`, so stale cached
    projections with old live markers are bypassed.
- Changed files:
  - `server.js`
  - `test/thread-item-timestamp-enrichment.test.js`
- Validation:
  - `node --check server.js`
  - `node --test test/thread-item-timestamp-enrichment.test.js test/tool-output-image-projection.test.js test/conversation-render.test.js`
  - `npm run check`
  - Home AI center harness:
    `node tests/architecture-code-test-harness-map.test.js`.
  - `git diff --check`
  - Current-thread local readback through the existing API output plus the new
    `compactThread()` logic showed `oldLive: 0`; only the latest turn remained
    live, while historical image turns stayed historical.
  - AI Ops evidence: `evidence-e6eb0cb9-4d79-4db7-a556-5a9d444a71d0`.
- Note:
  - `docs/HOME_AI_PLATFORM_CONTRACT.md` remains an unrelated pre-existing dirty
    file and was not touched for this fix.

## 2026-06-19 Embedded Shell Stale v295 Slow Startup Finding

- Status: root-caused and local v300 fix implemented; not committed or
  deployed yet.
- User-visible issue:
  - Entering/opening Codex Mobile felt slower even though recent thread detail
    reads were expected to be small.
- Findings:
  - Current production server and files report
    `clientBuildId=0.1.11|codex-mobile-shell-v299`.
  - iOS/Home AI embedded client logs showed the loaded iframe client was still
    `0.1.11|codex-mobile-shell-v295`.
  - v295 startup used the full `/api/threads` fallback path instead of the
    v297+ `fallback=defer` fast path. Recent iPhone logs showed cold thread
    list loads around 1.38-1.40s, with most time in fallback rollout/state DB
    scans. After fallback cache warmed, the same list load dropped to about
    189ms.
  - The active Codex Mobile thread detail endpoint itself was not the bottleneck:
    repeated local reads returned roughly 86-88KB, 10 turns, about 120 items,
    and completed in about 41-79ms.
- Fix:
  - `initializePageBuildState()` now immediately calls
    `requestHermesPluginRefresh("server_build_changed", { force: true })` in
    Hermes embedded mode when the startup public config reports a newer server
    client build.
  - PWA shell cache advanced to `codex-mobile-shell-v300`.
  - README Chinese release note added for v300.
- Changed files:
  - `public/app.js`
  - `public/sw.js`
  - `README.md`
  - `test/hermes-plugin-route.test.js`
  - `test/mobile-viewport.test.js`
  - `test/thread-goal-service.test.js`
  - `test/thread-task-card-route.test.js`
- Validation:
  - `node --test test/hermes-plugin-route.test.js test/app-update.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js test/thread-item-timestamp-enrichment.test.js test/tool-output-image-projection.test.js test/conversation-render.test.js`
  - `node --test test/mobile-viewport.test.js test/app-update.test.js`
  - `npm run check`
  - Home AI center harness:
    `node tests/architecture-code-test-harness-map.test.js`.
  - `git diff --check`
- Note:
  - A client already stuck on v295 still needs one host refresh / hard refresh
    to load the newer shell. The v300 change prevents future embedded sessions
    from silently staying on an outdated shell after detecting a server build
    mismatch.

## 2026-06-19 Standalone ChatGPT Pro Analysis Entry v302

- Status: local implementation complete and validated; not deployed in this
  handoff entry.
- User-visible behavior:
  - Composer text containing an explicit `@ChatGPT Pro`, `@ChatGPTPro`, or
    `@GPT Pro` mention is intercepted before normal message submission.
  - The request is not injected into the current work thread. Codex Mobile
    creates or reuses a dedicated `ChatGPT Pro` thread and starts one turn
    there with a bounded analysis prompt.
  - Attachments are rejected for this first version; the user should put the
    analysis target in text.
- Implementation boundary:
  - `adapters/chatgpt-pro-bridge-service.js` owns mention detection, prompt
    construction, dedicated-thread state, and runtime output directory
    selection.
  - `server.js` exposes `/api/chatgpt-pro/status` and
    `/api/chatgpt-pro/generate`.
  - `public/app.js` intercepts the explicit mention and posts to the bridge
    route instead of sending a normal current-thread message.
  - README documents the Chinese public-facing v302 behavior.
- Security and correctness constraints:
  - The generated prompt explicitly requires the target thread to use Chrome /
    ChatGPT Pro when available, and to report failure instead of impersonating
    ChatGPT Pro output.
  - The prompt forbids reading or exposing cookies, tokens, passwords, SSH
    keys, or raw profile files.
  - Output is constrained to the runtime output directory under
    `.codex-mobile-web/outputs/chatgpt-pro`, not repository source folders.
- Changed files:
  - `adapters/chatgpt-pro-bridge-service.js`
  - `server.js`
  - `public/app.js`
  - `public/sw.js`
  - `package.json`
  - `README.md`
  - `test/chatgpt-pro-bridge-service.test.js`
  - shell version expectations in existing tests.
- Validation:
  - `node --check adapters/chatgpt-pro-bridge-service.js && node --check server.js && node --check public/app.js && node --check public/sw.js`
  - `node --test test/chatgpt-pro-bridge-service.test.js test/mobile-viewport.test.js test/new-thread-ui.test.js test/new-thread-route.test.js`
  - `npm run check`
  - `npm test`
  - Home AI center harness:
    `node tests/architecture-code-test-harness-map.test.js`
  - `git diff --check`
- Note:
  - No live ChatGPT Pro / Chrome smoke was run, to avoid starting a long
    external browser generation turn without an explicit deployment or live-test
    request.

## 2026-06-19 Unified Composer @ Intent Entry v303

- Status: local implementation complete and validated; not deployed in this
  handoff entry.
- User-visible behavior:
  - Typing a bare `@` in the main Composer opens a bounded intent menu.
  - Selecting `@目标任务`, `@任务卡片`, `@自由协作`, or `@ChatGPT Pro` writes only
    that tag into Composer. The user then presses Send / Enter to open the
    appropriate input dialog.
  - `@目标任务` opens the existing Goal dialog.
  - `@任务卡片`, `@自由协作`, and `@ChatGPT Pro` open a shared action dialog with
    a large textarea, Save draft, Cancel, and Send.
  - Direct old paths remain compatible: `/g`, `#`, `#自由协作`, and direct
    `@ChatGPT Pro ...` with body still work.
- Implementation boundary:
  - `public/app.js` owns the intent menu/dialog, local intent-draft storage,
    exact-tag routing, and the shared task-card send helper.
  - `public/index.html` adds the menu and dialog DOM.
  - `public/styles.css` adds the bounded menu/dialog styling.
  - `docs/MODULES.md` documents the frontend ownership.
  - README documents the Chinese v303 user-facing behavior.
- State and privacy notes:
  - Intent dialog drafts are browser-local and scoped by current draft/thread
    key plus intent kind.
  - Draft saving does not write to a thread, start a model turn, or store
    secrets outside the existing browser-local draft surface.
- Changed files:
  - `public/app.js`
  - `public/index.html`
  - `public/styles.css`
  - `public/sw.js`
  - `README.md`
  - `docs/MODULES.md`
  - focused tests for task cards, goals, ChatGPT Pro, composer drafts, and
    shell version expectations.
- Validation:
  - `node --check public/app.js && node --check public/sw.js`
  - `node --test test/thread-task-card-route.test.js test/thread-goal-service.test.js test/chatgpt-pro-bridge-service.test.js test/mobile-viewport.test.js`
  - `npm run check`
  - `npm test`
  - Home AI center harness:
    `node tests/architecture-code-test-harness-map.test.js`
  - `git diff --check`

## 2026-06-19 Composer @ Intent Menu iOS/WebView Fix v304

- Status: implemented, validated, committed, and deployed to Mac production.
- Commit:
  - `6f27ed8 fix: 修复 iOS 下 @ 意图菜单弹出`.
- User-visible issue:
  - In the iOS/Home AI WebView keyboard flow, typing a bare `@` in Composer did
    not show the v303 intent menu.
- Likely causes fixed:
  - iOS/IME input may leave zero-width characters in the contenteditable text,
    so strict `composerText() === "@"` can miss.
  - The v303 menu used the generic fixed-position composer popup calculation;
    with the native keyboard/candidate bar open, visual viewport geometry can
    place the menu outside the visible area.
- Fix:
  - Added `normalizedComposerIntentText()` to strip zero-width characters before
    matching the bare `@` and intent tags.
  - Added async menu rechecks after `input`, `keyup`, `focus`, and
    `compositionend`.
  - Anchored `.composer-intent-menu` absolutely above the Composer instead of
    relying on fixed bottom/visualViewport placement.
  - PWA shell cache advanced to `codex-mobile-shell-v304`.
- Changed files:
  - `public/app.js`
  - `public/styles.css`
  - `public/sw.js`
  - `README.md`
  - shell/version and focused interaction tests.
- Validation:
  - `node --check public/app.js && node --check public/sw.js`
  - `node --test test/thread-task-card-route.test.js test/thread-goal-service.test.js test/chatgpt-pro-bridge-service.test.js test/mobile-viewport.test.js test/composer-draft.test.js`
  - `npm run check`
  - `npm test`
  - Home AI center harness:
    `node tests/architecture-code-test-harness-map.test.js`
  - `git diff --check`
- Production deployment:
  - Deployed with Home AI central Mac deploy script for plugin
    `codex-mobile-web`, restart label
    `com.hermesmobile.plugin.codex-mobile`, and health URL
    `http://127.0.0.1:8787/api/public-config`.
  - Production `/api/public-config` reported
    `clientBuildId=0.1.11|codex-mobile-shell-v304` and
    `shellCacheName=codex-mobile-shell-v304`.
  - Production static readback confirmed `public/app.js`, `public/styles.css`,
    `public/sw.js`, and README include the v304 intent-menu fix.
  - Plugin manifest smoke at
    `http://127.0.0.1:8787/api/v1/hermes/plugin/manifest` returned
    `id=codex-mobile`, `name=Codex Mobile`, `version=0.1.11`.
  - `launchctl print system/com.hermesmobile.plugin.codex-mobile` showed the
    service active.
  - Evidence ledger:
    `evidence-f80cb2e9-a855-4ecd-bcd0-5af468c2ef7e`.
  - The production backup directory under
    `/Users/hermes-host/HermesMobile/backups/deploy` was not listed in this
    shell because the directory is not readable by the current user.

## 2026-06-19 Composer @ Intent Menu Page-Level Overlay v305

- Status: implemented, locally validated, committed, deployed to Mac production,
  and production-smoked.
- Commit:
  - `cafbd5a fix: 将 @ 意图菜单改为页面级浮层`.
- User-visible issue:
  - After v304, the iOS/Home AI WebView still did not show the bare `@` intent
    chooser, while the Home AI host chat showed a page-level chooser above its
    input.
- Root cause addressed:
  - v304 still kept the intent menu in the Composer/layout positioning context,
    so it could be clipped or stacked behind the `.main` / Composer / WebView
    keyboard layout path.
  - `sendMessage()` still used a strict raw-text `text === "@"` branch, which
    could miss the normalized bare-`@` path used by the popup trigger.
- Fix:
  - Moved `#composerIntentMenu` out of the Composer form and into a page-level
    overlay DOM position.
  - Positioned the menu with `position: fixed` and CSS variables derived from
    `#messageInput.getBoundingClientRect()`, keeping it aligned to the input
    width and above the Composer.
  - Repositioned the menu on window and visualViewport resize/scroll.
  - Changed Send handling to use `normalizedComposerIntentText(text)` for the
    bare-`@` branch.
  - Advanced the shell cache/build id to `codex-mobile-shell-v305`.
- Changed files:
  - `public/app.js`
  - `public/index.html`
  - `public/styles.css`
  - `public/sw.js`
  - `README.md`
  - shell/version and task-card route tests.
- Validation:
  - `git diff --check`
  - `node --check public/app.js && node --check public/sw.js`
  - Home AI center harness:
    `node tests/architecture-code-test-harness-map.test.js`
  - `npm run check`
  - `npm test`
- Production deployment:
  - The Mac deploy command output was interrupted by the active Codex turn, but
    production readback confirmed the deployment completed.
  - Production `/api/public-config` reported
    `clientBuildId=0.1.11|codex-mobile-shell-v305` and
    `shellCacheName=codex-mobile-shell-v305`.
  - Production static readback confirmed `public/app.js`,
    `public/styles.css`, and `public/sw.js` include the v305 menu overlay and
    shell cache changes.
  - Plugin manifest smoke at
    `http://127.0.0.1:8787/api/v1/hermes/plugin/manifest` returned
    `id=codex-mobile`, `title=Codex Mobile`, `version=0.1.11`.
  - `launchctl print system/com.hermesmobile.plugin.codex-mobile` showed the
    service running with last exit code 0.
  - Browser smoke using system Chrome against production 8787 focused
    `#messageInput`, inserted a bare `@`, and observed:
    `#composerIntentMenu.hidden=false`, 4 intent options, fixed positioning,
    and a menu rectangle above the Composer input rectangle.
  - Evidence ledger:
    `evidence-636cacd3-d467-4c7e-8e7d-a899ef7a24d4`.

## 2026-06-19 Public/Private Sync for v302-v305

- Status: public-safe sync committed and pushed; private reverse-merged public
  main and is ready to push.
- Public mirror:
  - `/Users/hermes-dev/HermesMobileDev/public-mirrors/codex-mobile-web-public`.
- Public commit:
  - `c7696e1 feat: 发布 v302-v305 移动端更新`.
- Private reverse-sync merge:
  - `d6425bf Merge public v302-v305 sync`.
- Scope:
  - Synced the public-safe tracked file tree from private HEAD into the clean
    public mirror using a git archive export and excluding `.agent-context`.
  - Published the v302 standalone `@ChatGPT Pro` bridge, v303 unified `@`
    intent entry, v304 iOS/WebView bare-`@` trigger fix, and v305 page-level
    `@` intent overlay.
  - README public-facing notes remain Chinese.
- Public privacy checks:
  - `git ls-files .agent-context` returned no files.
  - Diff-name scan found no `.agent-context`, `node_modules`, `.pem`,
    `access_key`, secret/token paths, uploads, logs, or runtime state paths.
- Public validation:
  - Initial `npm test` failed only because the local public mirror had no
    installed `web-push` dependency; after `npm ci`, the same test suite passed.
  - `npm ci`
  - `git diff --check`
  - `node --check server.js && node --check public/app.js && node --check
    public/sw.js && node --check adapters/chatgpt-pro-bridge-service.js`
  - `npm test` passed: 495 tests.
  - `npm run check` passed.

## 2026-06-19 ChatGPT Pro Planner Connector Design

- Status: design documentation drafted; no implementation code changed yet.
- User intent:
  - Borrow the useful parts of `Ancienttwo/repo-harness` for Codex Mobile's
    `@ChatGPT Pro` workflow.
  - Treat existing `@ChatGPT Pro` as the outbound bridge, then add a ChatGPT
    MCP Connector as the inbound planner/reviewer writeback path.
- New documentation:
  - `docs/CHATGPT_PRO_PLANNER_CONNECTOR_DESIGN.md`
  - Linked from `docs/README.md`
  - Added implementation-path summary in `docs/COMPLEX_FEATURE_PATHS.md`
- Design boundary:
  - ChatGPT Pro is planner/reviewer; Codex remains executor.
  - Default MCP planner tools may read bounded context and write runtime planner
    artifacts only.
  - No source-code writes, package/lockfile/CI writes, shell execution,
    approval responses, or Codex turn starts through the default connector
    profile.
  - Planner artifacts default to the Codex Mobile runtime root, with explicit
    user apply actions for goal/task-card/side-chat integration.
- Validation:
  - `git diff --check`
- Parallel follow-up:
  - Started subagent `frontend-jitter-stabilization` for the separate thread
    detail / Composer few-pixel jitter issue. The subagent is scoped to
    frontend layout/scroll files and tests only, with no deploy, restart,
    commit, push, runtime secret/state, or production access.

## 2026-06-19 Frontend Jitter Stabilization v306

- Status: implemented locally by subagent `frontend-jitter-stabilization` and
  integrated into the main worktree; not committed, pushed, deployed, or
  production-smoked yet.
- User-visible issue:
  - Thread detail information flow and Composer input can shift by a few pixels
    during live updates or typing, making reading uncomfortable.
- Root cause hypothesis from subagent:
  - The thread stream was not broadly re-rendering on unchanged signatures.
  - Jitter was more likely caused by layout metric churn:
    live timer/update paths repeatedly wrote `--composer-height`, viewport CSS
    variables accepted 1px visualViewport noise, and Composer autosize reset
    height to `auto` on every keystroke before restoring a measured height.
- Fix:
  - Added stable CSS pixel helpers in `public/viewport-metrics.js`.
  - Guarded root viewport/safe-area and Composer height CSS variable writes so
    no-op or 1px measurement noise does not trigger layout updates.
  - Changed Composer autosize to avoid per-keystroke `height = auto` unless
    shrinking or forced.
  - Fixed `.message-input` baseline height and default overflow behavior.
  - Advanced shell cache/build id to `codex-mobile-shell-v306`.
- Changed files:
  - `public/app.js`
  - `public/styles.css`
  - `public/viewport-metrics.js`
  - `public/sw.js`
  - `README.md`
  - `test/mobile-viewport.test.js`
  - `test/viewport-metrics.test.js`
  - version expectation tests for shell cache.
- Validation so far:
  - Subagent reported `node --check public/app.js`,
    `node --check public/viewport-metrics.js`, focused viewport/composer tests,
    `npm run check`, and targeted `git diff --check` passed before integration.
  - Main-thread validation after v306 version bump passed:
    - `git diff --check`
    - `node --check public/app.js && node --check public/viewport-metrics.js && node --check public/sw.js`
    - `node --test test/viewport-metrics.test.js test/mobile-viewport.test.js test/conversation-scroll.test.js test/conversation-render.test.js test/chatgpt-pro-bridge-service.test.js test/thread-task-card-route.test.js test/thread-goal-service.test.js` (84 tests)
    - `npm run check`
    - `npm test` (497 tests)
  - No live browser, production smoke, deploy, restart, commit, or push has
    been performed for this v306 work.
  - Home AI AI Ops control-plane intake and required-checks were run from the
    center workspace for this plugin change. The required center docs entry
    sections were checked, `node tests/architecture-code-test-harness-map.test.js`
    passed, and evidence ledger record
    `evidence-f3196dd8-0e1c-4b4a-8fba-2b2692a6a325` was appended to
    `$HOME/.homeai-qa/codex-mobile-web-evidence-ledger.jsonl`.
