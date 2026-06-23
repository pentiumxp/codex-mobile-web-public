# 2026-06-24 - Healthy exact task-card target deliverability fix

- Trigger:
  - Home AI reported that Healthy thread
    `019ea9d5-8f99-7d92-90a2-e9ae094a7977` was visible through
    `list_threads`, but exact `delegate_to_thread` still failed with
    `target_thread_not_visible`.
- Root cause:
  - MCP `list_threads` reads `/api/threads`, which includes app-server
    `thread/list` results plus fallback.
  - The task-card resolver only treated the fallback/current target list as
    deliverable. When a target id could be read directly from thread summary
    but was not in that fallback list slice, the resolver deliberately threw
    `target_thread_not_visible` even after successfully reading the target.
- Change:
  - `server.js` now lets exact `targetThreadId` direct-summary resolution pass
    when the target is not archived, deleted, hidden by workspace visibility,
    a subagent, or a side-chat sidecar.
  - `assertThreadTaskCardTargetDeliverable()` now applies the same visibility
    rules to direct targets and visible-list targets, while preserving
    `target_thread_archived` for archived targets.
  - `test/protocol.test.js` covers a directly readable thread that is not in
    `visibleThreads` and must still be accepted, plus a direct thread under an
    invisible workspace that must still be rejected.
- Validation so far:
  - Failed before deployment: exact Healthy diagnostic
    `delegate_to_thread` returned `target_thread_not_visible`.
  - `node --test test/protocol.test.js`
  - `node --test test/thread-task-card-route.test.js`
  - `node --check server.js && node --check test/protocol.test.js`
  - `npm run check`
  - `npm run check:macos`
  - `npm test` passed (`663` tests).
  - `git diff --check`
  - `codegraph sync && codegraph status` reported the index up to date with
    the existing earlier-engine warning.
- Next:
  - Completed.
- Commit/deploy:
  - Code commit: `8ae26f5 fix: allow exact task-card targets from summaries`.
  - Deployed through the Home AI center script from
    `/Users/hermes-dev/HermesMobileDev/app`:
    `npm run --silent deploy:macos -- --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --execute --json`.
  - Production source ref: `8ae26f500731`, dirty false.
  - Production target:
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Production backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260623T164836Z-plugin-codex-mobile-web-manual`.
  - `/api/public-config` returned `workspaceDelegation=true` and
    `clientBuildId=0.1.11|codex-mobile-shell-v400`; no frontend shell bump was
    needed.
  - Production `npm run check` passed.
- Healthy verification:
  - Exact Healthy diagnostic `delegate_to_thread` succeeded after deployment:
    card `ttc_66e0f299864a552b0e`, target thread
    `019ea9d5-8f99-7d92-90a2-e9ae094a7977`, injected turn
    `019ef562-c8ae-7100-b87a-1b15095933ec`.
  - Return card to Home AI succeeded: `ttc_484be862e3d89fb7bf`, injected turn
    `019ef563-1afe-7ac3-9569-4fc971e61c3a`.

# 2026-06-24 - Audit repair: task-card store fail-closed and exact target coverage

- Trigger:
  - Home AI `Plugin Workspace Audit` returned Codex Mobile audit findings:
    task-card store reads silently fell back to empty state on corrupt/unreadable
    persistence, and same-workspace/exact target routing semantics needed
    executable coverage beyond source-string assertions.
- Change:
  - `adapters/thread-task-card-service.js` now treats a missing task-card store
    as first-run empty state, but fails closed for unreadable files, malformed
    JSON, invalid `cards`, or invalid `workflows` shapes. Errors use bounded
    codes such as `task_card_store_malformed_json`,
    `task_card_store_invalid_shape`, and `task_card_store_unreadable`; raw card
    bodies are not logged or emitted.
  - `server.js` now lets the source-thread task-card create/payload path accept
    injected resolver and task-card service dependencies for tests while
    preserving the production route/dynamic-tool behavior.
  - `test/thread-task-card-service.test.js` covers missing file, malformed
    JSON, wrong shape, and unreadable-store behavior.
  - `test/protocol.test.js` now exercises exact same-cwd target routing through
    the create/payload path, exact id winning over cwd canonical selection,
    source-direct auto-approval, duplicate target de-dupe, and subagent target
    rejection.
- Validation so far:
  - `node --test test/thread-task-card-service.test.js`
  - `node --test test/protocol.test.js`
  - `node --test test/thread-task-card-route.test.js`
  - Media/PWA evidence checks passed:
    `test/conversation-render.test.js`,
    `test/tool-output-image-projection.test.js`,
    `test/generated-image-cache-service.test.js`,
    `test/file-preview-ui.test.js`,
    `test/build-refresh-policy.test.js`, and `test/app-update.test.js`.
  - `node --check server.js && node --check adapters/thread-task-card-service.js && node --check test/protocol.test.js && node --check test/thread-task-card-service.test.js && node --check test/thread-task-card-route.test.js`
  - `npm run check`
  - `npm run check:macos`
  - `npm test` passed (`663` tests).
  - `git diff --check`
  - `codegraph sync && codegraph status` reported the index up to date with
    the existing earlier-engine warning.
- Commit/deploy:
  - Code commit: `700215c fix: harden task-card store and routing coverage`.
  - Deployed through the Home AI center script from
    `/Users/hermes-dev/HermesMobileDev/app`:
    `npm run --silent deploy:macos -- --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --execute --json`.
  - Production source ref: `700215cf6197`, dirty false.
  - Production target:
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Production backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260623T163413Z-plugin-codex-mobile-web-manual`.
  - `/api/public-config` returned
    `clientBuildId=0.1.11|codex-mobile-shell-v400` and
    `shellCacheName=codex-mobile-shell-v400`; no frontend shell bump was needed.
  - Production `npm run check` passed.
- Remaining audit scope:
  - PWA/WebView shell lifecycle and media rendering already have focused
    source/DOM tests in this checkout, but a live iOS/WebView video harness
    remains outside this repair step.
  - No Public push has been performed for this audit repair.

# 2026-06-24 - Task-card source title and CodeGraph MCP elicitation v400 deployed

- Trigger:
  - User reported v399 injected task-card chrome still showed the wrong source
    thread title, e.g. `# Continuation Bootstrap Index`, instead of the
    original thread name.
  - User also reported the `男装衣橱` thread again showed an MCP prompt:
    `Allow the codegraph MCP server to run tool "codegraph_search"?`.
- Root cause:
  - Task-card creation paths accepted recoverable continuation bootstrap text
    from app-server `name`/`preview` as `sourceThreadTitle`.
  - `mcpServer/elicitation/request` was treated as ordinary user input and
    broadcast to the UI; the workspace/source-write guard did not cover
    CodeGraph MCP's own read-only tool permission prompt.
- Change:
  - `server.js` now normalizes thread display titles through
    `threadDisplayTitle()` / `taskCardSourceThreadTitle()`, skipping
    `# Continuation Bootstrap Index` and similar recoverable titles. It
    hydrates from the Mobile session index when available before creating
    task cards or replies.
  - `public/app.js` mirrors the same title preference so browser-created task
    cards send a real display title instead of bootstrap text.
  - `adapters/thread-task-card-service.js` now includes `Source thread id:` in
    injected task-card text so future title failures remain traceable.
  - `server.js` now auto-accepts only CodeGraph read-only MCP elicitation for
    `codegraph_search`, `codegraph_explore`, `codegraph_node`, and
    `codegraph_callers`. Other MCP servers or unknown tools still require
    explicit handling.
  - PWA shell/cache advanced to `codex-mobile-shell-v400`.
- Validation:
  - `node --check server.js && node --check public/app.js && node --check public/sw.js && node --check adapters/thread-task-card-service.js`
  - Focused suite passed:
    `test/protocol.test.js`, `test/thread-visibility.test.js`,
    `test/conversation-render.test.js`, `test/mobile-viewport.test.js`,
    `test/thread-task-card-route.test.js`, and
    `test/thread-goal-service.test.js`.
  - `npm run check`
  - `npm run check:macos`
  - `npm test` passed (`658` tests).
  - `git diff --check`
  - `codegraph sync && codegraph status` reported the index up to date with
    the existing older-engine warning.
- Commit/deploy:
  - Code commit: `bfbbc22 fix: normalize task-card source titles`.
  - Deployed through the Home AI center script:
    `npm run --silent deploy:macos -- --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --execute --json`.
  - Production source ref: `bfbbc2217707`, dirty false.
  - Production target:
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Production backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260623T162110Z-plugin-codex-mobile-web-manual`.
  - `/api/public-config` returned
    `clientBuildId=0.1.11|codex-mobile-shell-v400` and
    `shellCacheName=codex-mobile-shell-v400`.
  - Production `npm run check` passed.
  - Authenticated `/api/approvals` returned `count=0`.
- Notes:
  - Public was not pushed in this step.
  - Existing already-rendered approval cards may require a thread refresh to
    disappear, but the server no longer has pending requests after deployment.

# 2026-06-24 - Task-card chrome v399 and operation bubble minimum display deployed

- Trigger:
  - User reported the collapsed cross-thread task-card message still looked
    like an ordinary `You` user message and its source/purpose line was clipped
    on phone.
  - User clarified injected cross-thread task-card messages should use their
    own card format: the header area should show source thread first, then the
    task purpose; full card details should remain expandable.
  - User also required the compact operation bubble to remain visible for at
    least 0.5 seconds so short operations do not flash and disappear.
- Change:
  - `public/app.js` now detects injected task-card text before normal
    `userMessage` rendering and renders it through
    `renderInjectedThreadTaskCardItem()`.
  - Injected cards now use `.thread-task-card-injected` chrome instead of the
    normal user-message `You` surface. The visible header has separate source
    and purpose rows; the complete raw task-card body remains behind a
    collapsible `完整任务卡` details block.
  - Standalone injected input-text rendering now uses a compact overview block
    with source/purpose rows before the expandable raw body.
  - Compact mobile operation bubbles use
    `LIVE_OPERATION_BUBBLE_MIN_VISIBLE_MS = 500` and preserve the existing
    bubble until the minimum display window expires, then re-render once.
  - PWA shell/cache advanced to `codex-mobile-shell-v399`.
- Validation:
  - `node --check public/app.js && node --check public/sw.js`
  - Focused 118-test suite passed:
    `test/conversation-render.test.js`,
    `test/collab-agent-render.test.js`,
    `test/mobile-viewport.test.js`,
    `test/thread-task-card-route.test.js`, and
    `test/thread-goal-service.test.js`.
  - `npm run check`
  - `npm run check:macos`
  - `npm test` passed (`655` tests).
  - `git diff --check`
  - `codegraph sync && codegraph status` reported the index up to date with
    the existing older-engine warning.
- Commit/deploy:
  - Code commit: `f1e66cb fix: clarify task-card summary chrome`.
  - Deployed through the Home AI center script:
    `npm run --silent deploy:macos -- --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --execute --json`.
  - Production source ref: `f1e66cba3b16`, dirty false.
  - Production target:
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Production backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260623T161028Z-plugin-codex-mobile-web-manual`.
  - Restart label `com.hermesmobile.plugin.codex-mobile` was running after
    deploy; health URL passed on attempt 2.
  - `/api/public-config` returned
    `clientBuildId=0.1.11|codex-mobile-shell-v399` and
    `shellCacheName=codex-mobile-shell-v399`.
  - Production `npm run check` passed.
- Notes:
  - Public was not pushed in this step.
  - This fixes the task-card display/chrome and operation-bubble minimum
    visibility only. The separate audit repair card findings were not addressed
    by this UI-focused change.

# 2026-06-23 - Mobile operation sheet and long task-card folding deployed

- Trigger:
  - User reported the mobile operation bubble expanded panel was translucent
    and disappeared immediately after tapping if the underlying operation
    completed.
  - User then reported cross-thread task-card injected messages can be much
    longer than normal user messages and push the final receipt/Usage out of
    view.
  - User clarified collapsed cross-thread cards should show only the source
    thread name and task purpose, with details available on expand.
- Change:
  - `public/app.js` now pins the expanded mobile operation sheet per current
    thread. If a refresh removes the active operation while the user has the
    sheet open, the existing expanded sheet is preserved until the user
    collapses it or leaves the thread.
  - Mobile operation sheet/card surfaces now use opaque panel backgrounds.
  - Injected cross-thread task-card user messages are detected from
    `[Cross-thread task card sent by source thread]` and
    `[Cross-thread task card approved]`.
  - Those messages now render as a collapsed `<details>` card whose summary is
    `来源：<Source thread> · 目的：<Title/body heading>` plus payload length; the
    full injected task card remains available inside a bounded internal scroll
    area.
  - PWA shell/cache advanced to `codex-mobile-shell-v398`.
- Validation:
  - Focused 117-test suite passed:
    `test/conversation-render.test.js`,
    `test/thread-task-card-route.test.js`,
    `test/mobile-viewport.test.js`,
    `test/collab-agent-render.test.js`, and
    `test/thread-goal-service.test.js`.
  - `npm run check`
  - `npm run check:macos`
  - `npm test` passed (`654` tests).
  - `git diff --check`
  - `codegraph sync && codegraph status` reported the index up to date with
    the existing older-engine warning.
- Commit/deploy:
  - Code commit: `8a69483 fix: stabilize mobile operation and task cards`.
  - Deployed through the Home AI center script:
    `npm run --silent deploy:macos -- --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --execute --json`.
  - Production source ref: `8a69483bcc09`, dirty false.
  - Production target:
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Production backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260623T155832Z-plugin-codex-mobile-web-manual`.
  - Restart label `com.hermesmobile.plugin.codex-mobile` was running after
    deploy; health URL passed on attempt 2.
  - `/api/public-config` returned `clientBuildId=0.1.11|codex-mobile-shell-v398`,
    `shellCacheName=codex-mobile-shell-v398`, and `authRequired=true`.
  - Authenticated `/api/status` returned `ready=true` over
    `external-jsonl-tcp`.
  - Production `npm run check` passed.
- Visual check:
  - Attempted Home AI center visual smoke with
    `npm run ios:pwa:visual -- --scenario embedded-plugin-shell --plugin-id codex-mobile`.
  - The run did not complete: the visual harness returned
    `This operation was aborted`, and npm banner text was mixed into the JSON
    output. Do not count this as visual-pass evidence.
- Notes:
  - Public was not pushed in this step.
  - Long-card folding is a frontend rendering change only; task-card storage,
    delivery, approval, and return-card protocol were not changed.

# 2026-06-23 - Same-workspace task-card routing fix deployed

- Trigger:
  - Home AI reported same-workspace task-card sending failed from
    `Home AI 06-22` to `Plugin Workspace Audit` even with exact
    `targetThreadId=019ef506-cac2-76f2-a1df-46ed6de1e7eb`.
  - The failing error was `Target thread is not the current visible thread for
    its workspace.`
- Root cause:
  - `resolveThreadTaskCardTargetReference()` treated an exact thread id as
    stale when another visible thread with the same cwd had a newer
    `updatedAt`.
  - Dynamic-tool target hints also collapsed visible targets to one thread per
    cwd, so dedicated audit threads sharing `/Users/hermes-dev/HermesMobileDev/app`
    were omitted or misrepresented.
  - Requests that supplied exact `targetThreadId` plus `targetCwd` could treat
    the cwd as a second fuzzy target instead of metadata.
- Change:
  - Exact `targetThreadId` / `targetThreadTitle` now resolve by thread identity
    as long as the thread is visible and deliverable.
  - Archived/deleted targets are rejected with `target_thread_archived`.
  - Hidden/subagent/non-visible targets are rejected with
    `target_thread_not_visible`.
  - Exact self-cards are rejected with `target_thread_self`.
  - `targetCwd` / `targetWorkspace` remain fuzzy workspace targets and are only
    used when no exact thread id/title target is supplied.
  - Dynamic-tool visible target hints no longer collapse same-cwd threads.
  - README, cross-thread task-card implementation docs, and troubleshooting
    docs were updated to remove the stale same-cwd canonical-thread rule.
- Related durable thread facts:
  - `Home AI Platform Audit`: `019ef506-c2e1-7801-be95-a0bdb42808c9`, cwd
    `/Users/hermes-dev/HermesMobileDev/app`.
  - `Plugin Workspace Audit`: `019ef506-cac2-76f2-a1df-46ed6de1e7eb`, cwd
    `/Users/hermes-dev/HermesMobileDev/app`.
  - Both were seeded with the no-HANDOFF audit rule earlier in this run.
- Validation:
  - `node --check server.js`
  - Focused task-card suite:
    `node --test test/protocol.test.js test/thread-task-card-route.test.js test/thread-task-card-service.test.js`
  - `npm run check`
  - `npm run check:macos`
  - `npm test` passed (`653` tests).
  - `git diff --check`
  - `codegraph sync && codegraph status` reported the index up to date with the
    existing older-engine warning.
- Commit/deploy:
  - Code commit: `d1d8ad0 fix: allow same-workspace task cards`.
  - Deployed through the Home AI center script:
    `npm run --silent deploy:macos -- --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --execute --json`.
  - Production source ref: `d1d8ad0b5cc8`, dirty false.
  - Production target:
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Production backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260623T153001Z-plugin-codex-mobile-web-manual`.
  - Restart label `com.hermesmobile.plugin.codex-mobile` was running after
    deploy; health URL passed on attempt 2.
  - Production `npm run check` passed.
  - `/api/public-config` returned `authRequired=true`,
    `clientBuildId=0.1.11|codex-mobile-shell-v396`,
    `shellCacheName=codex-mobile-shell-v396`, and
    `defaultPermissionMode=full`.
- Notes:
  - This is server-only; no PWA shell/cache bump.
  - No live same-workspace test card was created because there is no dry-run
    route and a real card would pollute the audit/implementation threads.
  - Home AI later verified the real same-workspace exact target path:
    `Home AI 06-22` sent a read-only Music plugin audit request to exact
    `targetThreadId=019ef506-cac2-76f2-a1df-46ed6de1e7eb`
    (`Plugin Workspace Audit`) with the same app cwd, and the card succeeded.
    Verification card id: `ttc_f916f01ec635a3c105`; injected target turn id:
    `019ef51d-b711-74a0-a658-c10ae64343e6`.
  - Public was not pushed.

# 2026-06-23 - Server raw exec command text projection fix

- Trigger:
  - User reported that the bottom `Command` dock still had empty detail after
    v394.
- Evidence:
  - Production `/api/public-config` was already serving
    `0.1.11|codex-mobile-shell-v394`.
  - Current thread
    `019eee6c-a6f5-7b20-bfb4-f96ccb6431b3` recent detail returned
    `commandExecution.command` as an empty string for raw rollout operations,
    so the failure layer was server projection, not the v394 frontend dock
    renderer.
  - The corresponding rollout `response_item` entries used
    `payload.type=function_call`, `payload.name=exec_command`, and
    `payload.arguments` JSON shaped as `{ "cmd": "..." }`. The old server
    helper only read `arguments.command`.
- Change:
  - `server.js` `commandFromRawPayload()` now extracts command text from
    `arguments.command`, `arguments.cmd`, `arguments.shellCommand`, and
    `arguments.shell_command`, for both object arguments and JSON-string
    arguments.
  - Updated raw-operation fallback coverage so the live-turn command sample
    uses the Mac `cmd` argument shape.
  - Updated README and troubleshooting docs to classify this as a server
    raw-operation projection failure when the API command field is empty.
  - This is server-only; no PWA shell/cache bump beyond v394.
- Validation:
  - `node --check server.js`
  - `node --test test/thread-item-timestamp-enrichment.test.js`
  - `npm run check`
  - `npm run check:macos`
  - `npm test` passed (`651` tests).
  - `git diff --check`
  - `codegraph sync && codegraph status` reported the index up to date.
  - Local offline compact of the current rollout produced non-empty command
    text for recent raw operations.
- Commit/deploy:
  - Local commit: `758a1d0 fix: project raw exec command text`.
  - Deployed with the Home AI center deploy script:
    `npm run --silent deploy:macos -- --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --execute --json`.
  - Production source ref: `758a1d09f814`.
  - Production backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260623T144818Z-plugin-codex-mobile-web-manual`.
- Production smoke:
  - `/api/public-config` returned HTTP `200`,
    `clientBuildId=0.1.11|codex-mobile-shell-v394`,
    `shellCacheName=codex-mobile-shell-v394`, and `authRequired=true`.
  - Current thread recent detail returned `commandOperationCount=14` and
    `nonEmptyCommandCount=14`.
- Next:
  - Do not push this server-only follow-up to Public until production/user
    testing is confirmed.

# 2026-06-23 - v394 Command dock placeholder semantics and macOS command detail

- Trigger:
  - After v393, user pointed out that showing `思考` inside the bottom dock
    conflicts with the top-right turn status. The bottom dock's product
    meaning is command/file/tool operation detail; it should reserve a stable
    row during active turns, but not duplicate the thinking status there.
  - User also reported that after moving to Mac, `Command` rows no longer show
    detailed command text, while `File` rows still show detail.
- Root cause:
  - v393 used `liveActivityLabelForTurn()` for the synthetic dock row, so
    reasoning-only phases displayed `思考` in the bottom command area.
  - Frontend command detail rendering only read `item.command`. Mac/newer
    protocol operation items may carry the command in serialized
    `item.arguments` JSON, e.g. `{ "command": "npm run check" }`, which made
    the dock detail empty even though the operation data existed.
- Change:
  - `public/app.js` now keeps the synthetic active-turn dock row as a
    semantics-neutral `Command` placeholder with empty status and no duration.
    It preserves dock height without duplicating the top-right `思考` label.
  - Compact dock height was reduced from `54px` to `40px`, and the inner live
    operation card from `44px` to `32px`, leaving a single-line row with small
    visual padding.
  - Added `operationCommandText()` to read command text from direct
    `item.command` and from `item.arguments.command`, `cmd`, `shellCommand`, or
    `shell_command`.
  - Command summary, command name, operation summary lines, operation grouping,
    and visible-item signatures now use the unified command text helper.
  - PWA shell advanced to `codex-mobile-shell-v394`.
- Tests:
  - Updated v393 reasoning-only dock tests to assert `Command` placeholder
    semantics and empty status.
  - Added `command operation detail reads command from serialized arguments on macOS`.
- Docs:
  - `README.md`
  - `docs/TROUBLESHOOTING.md`
- Validation:
  - `node --check public/app.js && node --check public/sw.js`
  - `node --test test/collab-agent-render.test.js test/conversation-render.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
  - `npm run check`
  - `npm run check:macos`
  - `npm test` passed (`651` tests).
  - `git diff --check`
- Commit/deploy:
  - Local commit: `9977bc0 fix: stabilize command dock semantics`.
  - Deployed with the Home AI center deploy script:
    `npm run --silent deploy:macos -- --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --execute --json`.
  - Production source ref: `9977bc008a00`.
  - Production backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260623T143747Z-plugin-codex-mobile-web-manual`.
- Production smoke:
  - `/api/public-config` returned HTTP `200`,
    `clientBuildId=0.1.11|codex-mobile-shell-v394`,
    `shellCacheName=codex-mobile-shell-v394`, and `authRequired=true`.
  - Production `public/app.js`, `public/styles.css`, and `public/sw.js`
    contain v394 shell/build markers, the active-turn dock placeholder helper,
    command-argument extraction, `40px` dock fallback height, and `32px`
    compact card height.
- Visual verification:
  - Home AI central iOS PWA embedded shell scenario passed with video capture:
    `/tmp/homeai-codex-v394-visual/direct/codex-v394-embedded-shell.mp4`.
  - Screenshot:
    `/tmp/homeai-codex-v394-visual/direct/codex-v394-embedded-shell.png`.
  - Assertions passed for plugin id, embedded shell/frame presence, meaningful
    frame size, no horizontal overflow, and screenshot byte threshold.
  - Visual inspection showed the bottom live-operation row at single-line
    height. The visible row was an actual `Command running` operation, so
    status/duration were expected; pure reasoning placeholders stay
    semantics-neutral.
- Next:
  - Do not push v394 Public until production/user testing is confirmed.

# 2026-06-23 - v393 active-turn bottom status row stabilization

- Trigger:
  - User reported that the bottom command/status box disappeared while a turn
    was still running, then clarified the historical contract: the bottom line
    should remain present for the whole active turn, not only while an actual
    command/tool item is active.
  - User also suspected the remaining visual shake could be related to this
    row appearing/disappearing.
- Root cause:
  - `renderLiveOperationDock()` only rendered when
    `currentLiveOperationEntry()` found an active operational item
    (`commandExecution`, `fileChange`, `dynamicToolCall`, `mcpToolCall`, or
    search-like item).
  - During reasoning-only active phases, `liveActivityLabelForTurn()` already
    resolved the activity as `思考`, but the dock did not use that label and
    returned no row. The dock could therefore disappear during reasoning and
    reappear when a command/tool began, changing the fixed area above the
    composer.
- Change:
  - `public/app.js` now returns a synthetic `liveTurnStatus` entry from
    `currentLiveOperationEntry()` when the latest live turn has no active
    operational item.
  - The synthetic row uses the existing live activity label
    (`思考`, `运行`, etc.) and the existing `.live-operation` rendering path, so
    active command/tool entries still take priority while the dock height stays
    stable during reasoning-only phases.
  - PWA shell advanced to `codex-mobile-shell-v393`.
- Tests:
  - Added `live operation dock keeps a status row while active turn is reasoning only`.
  - Updated the collab-agent live operation dock test to assert completed
    operations are ignored but the active status row remains.
- Docs:
  - `README.md`
  - `docs/TROUBLESHOOTING.md`
- Validation:
  - `node --check public/app.js && node --check public/sw.js`
  - `node --test test/collab-agent-render.test.js test/conversation-render.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
  - `npm run check`
  - `npm run check:macos`
  - `npm test` passed (`650` tests).
  - `git diff --check`
- Next:
  - Commit and deploy via the Home AI center deploy script.
  - Use Home AI central visual verification after deploy.
  - Do not push Public until production/user testing is confirmed.

# 2026-06-23 - v392 post-completion refresh patch stabilization

- Trigger:
  - User reported that v391 still left visible UI flicker after the assistant
    receipt appeared.
- Evidence:
  - v391 fixed same-turn completed receipt identity, but the remaining flicker
    can still occur when `turn/completed` renders once and the scheduled
    post-completion / usage-backfill refresh returns a projection with only
    item-level changes such as Usage or projection metadata.
  - `patchCurrentThreadDetailFromRefresh()` previously required
    `conversationRootSignature(previousThread) === conversationRootSignature(nextThread)`.
    That root signature included `mobileProjectionRevision` and
    `mobileVisibleItemKeys`, so ordinary v4 notification/refresh revisions and
    Usage insertion could bypass local patch and fall back to larger
    conversation/article patching.
  - `patchVisibleItemsOnlyFromRefresh()` also only allowed latest live turns
    with the exact same item-key shape. A latest completed turn that appended
    Usage could not use this item-level patch path.
- Change:
  - `public/app.js` now adds `conversationPatchShellSignature()`, comparing
    only conversation shell factors that affect root structure while excluding
    projection revision and visible item keys.
  - `patchCurrentThreadDetailFromRefresh()` uses the shell signature gate for
    local refresh patching.
  - `patchVisibleItemsOnlyFromRefresh()` now allows the latest turn after
    completion to preserve existing visible item keys while appending new
    items such as `turnUsageSummary`; it rejects removals and reorders.
  - PWA shell advanced to `codex-mobile-shell-v392`.
- Tests:
  - Updated conversation render and mobile viewport assertions.
  - Added `visible item refresh patch shape preserves existing keys while appending usage`.
- Docs:
  - `README.md`
  - `docs/TROUBLESHOOTING.md`
- Validation:
  - `node --check public/app.js && node --check public/sw.js`
  - `node --test test/conversation-render.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
  - `npm run check`
  - `npm run check:macos`
  - `npm test` passed (`649` tests).
  - `git diff --check`
  - `codegraph sync && codegraph status` was up to date; status still warned
    the index was built by an earlier CodeGraph engine version.
- Local commit:
  - `3538b9d fix: patch completed receipt refreshes locally`
- Production deploy:
  - Used the Home AI center deploy script:
    `npm run --silent deploy:macos -- --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --execute --json`
  - Source ref was clean at `3538b9d49068`.
  - Production path:
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260623T140758Z-plugin-codex-mobile-web-manual`.
  - Deploy validation passed: log permission repair, production file hashes,
    launchd print, manifest health URL, and Codex auth profile audit.
  - `/api/public-config` returned HTTP `200`,
    `clientBuildId=0.1.11|codex-mobile-shell-v392`,
    `shellCacheName=codex-mobile-shell-v392`, and `authRequired=true`.
  - Production `public/app.js` and `public/sw.js` contain v392,
    `conversationPatchShellSignature`, and
    `visibleItemPatchShapePreservesExisting`.
- Home AI visual verification:
  - Center visual polish audit passed for plugin `codex-mobile`, scenario
    `embedded-plugin-shell`, with video:
    `/tmp/homeai-codex-v392-visual/codex-v392-receipt-refresh/videos/codex-mobile-embedded-plugin-shell-codex-mobile.mp4`.
  - Center iOS PWA visual scenario `embedded-plugin-keyboard-composer` passed
    for thread `019eee6c-a6f5-7b20-bfb4-f96ccb6431b3`, loaded
    `pluginClientBuildId=0.1.11|codex-mobile-shell-v392`, and captured video:
    `/tmp/homeai-codex-v392-visual/thread-video/codex-thread-v392-keyboard.mp4`.
  - These visual lanes verify embedded loading and thread/composer stability on
    v392; they do not submit a real Codex turn, so a send-turn flicker video
    still needs a dedicated scenario if the symptom persists.
- Next:
  - Do not push Public until production/user testing is confirmed.

# 2026-06-23 - v392 public push completed

- Trigger:
  - User explicitly approved pushing the deployed/tested v392 version to
    Public.
- Publish method:
  - Created a temporary public worktree from `public/main` at
    `/tmp/codex-mobile-public-v392.bF7ZDT`.
  - Applied `main` -> `public/main` diff excluding `.agent-context`.
  - Verified staged public paths did not include `.agent-context`, env files,
    runtime data, logs, uploads, `node_modules`, `.codegraph`, secret, or
    token-like paths.
  - Committed public release as
    `545bae2 fix: publish completed receipt refresh stabilization`.
  - Pushed `545bae2` to `public/main`.
  - Merged `public/main` back into private `main` with
    `29c364c Merge public release v392`.
- Public validation:
  - `git diff --cached --check`
  - `npm run check`
  - `npm run check:macos`
  - `NODE_PATH=/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web/node_modules npm test`
    passed (`649` tests).
- Follow-up observation:
  - User reported that the bottom command box seemed missing.
  - Screenshots showed the bottom composer was still visible; the missing card
    was the `Command running` live operation dock.
  - The screenshots' topbar state was `思考`, not `命令`. Current client logic
    only renders the live operation dock for active operational items such as
    `commandExecution`, `fileChange`, `dynamicToolCall`, `mcpToolCall`, or web
    search. Reasoning-only phases do not render that dock.

# 2026-06-23 - v391 completed receipt render-identity stabilization

- Trigger:
  - User observed a visible screen shake after a turn completed: an assistant
    receipt appeared, briefly disappeared, then reappeared one line shorter.
- Evidence:
  - The failing surface is browser V4 local-visible merge state, not a server
    duplicate projection. v390 correctly removed unrelated local-only live
    receipts once a completed server receipt plus Usage arrived, but it also
    allowed a same-origin completed receipt with a shorter text prefix and a
    different id to replace the existing live receipt node.
- Root cause:
  - `findUnusedExistingItemIndexForIncoming()` only matched text receipts when
    the incoming server text was equal to, or longer than, the existing text.
    If the existing live receipt was longer and the completed server receipt
    was a shorter stable prefix, the completed item was treated as a new
    `agentMessage`; the old local receipt was then dropped by the v390
    completed-turn cleanup. That changed the render id and could reduce item
    height by one line.
- Change:
  - `public/app.js` now treats completed authoritative `agentMessage`/`plan`
    receipts as the same render identity when they share a stable same-type
    prefix with the existing visible receipt.
  - The merge preserves the existing render id and, when the existing text is
    the longer prefix-compatible version, keeps that visible text while still
    merging the completed turn and Usage.
  - PWA shell advanced to `codex-mobile-shell-v391`.
  - Added regression coverage:
    `completed projection merge adopts shorter final receipt without repainting live receipt`.
- Docs:
  - `README.md`
  - `docs/TROUBLESHOOTING.md`
- Validation:
  - `node --check public/app.js && node --check public/sw.js`
  - `node --test test/conversation-render.test.js`
  - `node --test test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
  - `npm run check`
  - `npm run check:macos`
  - `npm test` passed (`648` tests).
  - `git diff --check`
  - `codegraph sync && codegraph status` was up to date; status still warned
    the index was built by an earlier CodeGraph engine version.
- Local commit:
  - `fca350b fix: stabilize completed receipt rendering`
- Production deploy:
  - Used the Home AI center deploy script:
    `npm run --silent deploy:macos -- --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --execute --json`
  - Source ref was clean at `fca350b233b2`.
  - Production path:
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260623T134827Z-plugin-codex-mobile-web-manual`.
  - Deploy validation passed: log permission repair, production file hashes,
    launchd print, manifest health URL, and Codex auth profile audit.
  - `/api/public-config` returned HTTP `200`,
    `clientBuildId=0.1.11|codex-mobile-shell-v391`,
    `shellCacheName=codex-mobile-shell-v391`, and `authRequired=true`.
  - Production `public/app.js` and `public/sw.js` contain v391 and the new
    completed receipt render-identity helpers.
- Release note:
  - Deploy to production first and wait for user verification before any
    `public/main` sync/push.

# 2026-06-23 - v390 public push completed

- Trigger: User explicitly requested `推送 public` after v390 production deploy
  and smoke passed.
- Publish method:
  - Created a temporary public worktree from `public/main` at
    `/tmp/codex-mobile-public-v390.zDBPfA`.
  - Applied `main` -> `public/main` diff excluding `.agent-context`.
  - Verified staged public paths did not include `.agent-context`, env files,
    runtime data, logs, uploads, `node_modules`, or `.codegraph`.
  - Committed public release as
    `6f177f4 fix: publish completed turn receipt convergence`.
  - Pushed `6f177f4` to `public/main`.
  - Merged `public/main` back into private `main` with
    `66b22b3 Merge public release v390` so public history is an ancestor of
    private history.
- Public validation:
  - `git diff --check`
  - `npm run check`
  - `npm run check:macos`
  - `NODE_PATH=/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web/node_modules npm test`
    passed (`647` tests). The first plain `npm test` in the temporary public
    worktree failed only because that worktree intentionally had no
    `node_modules` and could not resolve `web-push`; rerun with the private
    dependency tree passed.
- Final verification:
  - `git merge-base --is-ancestor public/main main` returned success.
  - `git diff --stat public/main..main -- ':!.agent-context'` was empty.
  - `git ls-tree -r --name-only public/main` had no `.agent-context`, env,
    runtime, logs, uploads, `node_modules`, or `.codegraph` paths.

# 2026-06-23 - v390 completed-turn receipt merge fix

- Trigger:
  - User observed that, without leaving the thread, two duplicate Codex receipts
    appeared after the turn settled: the first receipt had no Usage and the
    second receipt had Usage.
- Evidence:
  - Current production `/api/threads/:id?mode=recent` for the source thread and
    Home AI target thread showed one `agentMessage` plus one `turnUsageSummary`
    for the relevant completed turns. The duplicate was therefore in browser
    V4 local-visible merge state, not a duplicate service projection write.
- Root cause:
  - `mergeItemsPreservingLocalVisible()` preserved local-only visible items to
    prevent live refreshes from deleting in-progress receipts. When an incoming
    completed server turn already contained the authoritative final receipt and
    Usage, the local active-stage `agentMessage` could remain beside the final
    server `agentMessage`.
- Change:
  - `public/app.js` now drops local-only `agentMessage`/`plan` receipts when
    the incoming same-turn projection is completed and already contains a
    server receipt. Local operation cards remain eligible for preservation.
  - PWA shell advanced to `codex-mobile-shell-v390`.
  - Added a focused regression test:
    `completed projection merge drops local-only live receipts when server receipt and usage arrive`.
  - Updated README and troubleshooting notes.
- Validation:
  - `node --check public/app.js && node --check public/sw.js`
  - `node --test test/conversation-render.test.js`
  - `node --test test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
  - `npm run check`
  - `npm run check:macos`
  - `npm test` passed (`647` tests).
  - `git diff --check`
  - `codegraph sync && codegraph status` reported the index up to date, with
    the existing earlier-engine warning.
- Deployment:
  - Central Home AI deploy dry-run for `--plugin codex-mobile-web --source
    /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --json`
    resolved the production path
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`, restart label
    `com.hermesmobile.plugin.codex-mobile`, and health URL
    `http://127.0.0.1:8787/api/v1/hermes/plugin/manifest`.
  - Local commit before deploy: `9ee428f fix: converge completed turn receipts`.
  - Executed central deploy:
    `cd /Users/hermes-dev/HermesMobileDev/app && npm run --silent deploy:macos -- --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --execute --json`.
  - Deploy source ref was clean at `9ee428fa45f3`.
  - Production backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260623T132341Z-plugin-codex-mobile-web-manual`.
  - Deploy validation passed: log permission repair, shared auth permission
    repair, production proof-file hashes, launchd print, health URL, and Codex
    auth profile audit.
  - Post-deploy smoke:
    - `/api/public-config` returned
      `clientBuildId=0.1.11|codex-mobile-shell-v390` and
      `shellCacheName=codex-mobile-shell-v390`.
    - Authenticated `/api/status` returned `ready=true` and no active thread
      ids.
    - Production `public/app.js` and `public/sw.js` contain v390 and the
      completed-turn receipt drop helper.
  - Public was not pushed.

# 2026-06-23 - Home AI platform pointer version-line correction

- Trigger: Home AI central checker reported
  `codex-mobile:pointer_missing_supported_contract_version:20260623-v5|20260618-v4`
  after the fallback governance pointer adoption.
- Change: `docs/HOME_AI_PLATFORM_CONTRACT.md` now includes the supported
  `Home AI platform contract version: 20260623-v5` line while retaining the
  root-cause and fallback governance references.
- Scope: docs/context-only correction; no runtime or business-code changes.
- Validation:
  - `rg -n "Home AI platform contract version|root-cause-architecture-contract|fallback-governance-contract|fallback-registry" docs/HOME_AI_PLATFORM_CONTRACT.md .agent-context/HANDOFF.md .agent-context/PROJECT_CONTEXT.md`
  - `git diff --check`

# 2026-06-23 - Home AI fallback governance pointer adopted

- Trigger:
  - Cross-thread task card from Home AI requested Codex Mobile plugin workspace
    adoption of the central fallback governance contract and registry pointers.
- Change:
  - Updated `docs/HOME_AI_PLATFORM_CONTRACT.md` so the canonical Home AI docs
    list includes:
    - `/Users/hermes-dev/HermesMobileDev/app/docs/PLATFORM_CONTRACTS/root-cause-architecture-contract.md`
    - `/Users/hermes-dev/HermesMobileDev/app/docs/PLATFORM_CONTRACTS/fallback-governance-contract.md`
    - `/Users/hermes-dev/HermesMobileDev/app/docs/IMPLEMENTATION_NOTES/fallback-registry.md`
    - `/Users/hermes-dev/HermesMobileDev/app/docs/MODULES/ai-operations-control-plane.md`
    - `/Users/hermes-dev/HermesMobileDev/app/docs/IMPLEMENTATION_NOTES/ai-operations-control-plane.md`
  - Updated `.agent-context/PROJECT_CONTEXT.md` durable routing so future
    non-trivial fixes classify mitigation versus closure and centrally register
    any new or extended fallback behavior.
- Scope:
  - Documentation/context-only. No fallback behavior, business code, runtime
    route, deployment, or public sync changes were made for this task.
- Validation:
  - `rg -n "root-cause-architecture-contract|fallback-governance-contract|fallback-registry" docs/HOME_AI_PLATFORM_CONTRACT.md .agent-context/PROJECT_CONTEXT.md .agent-context/HANDOFF.md`
  - `git diff --check`
  - No dedicated local docs-check package script was present.

# 2026-06-23 - v389 projection ownership fix deployed, public not pushed

- User correction:
  - The duplicate `推送Public` screenshot was a real duplicate display of one
    user message. It was not contradicted by the following explanatory message.
  - The user rejected a display-layer fallback for duplicates or broken image
    receipts. The fix had to follow the central Home AI root-cause contract:
    repair projection/state ownership, not hide extra cards at render time.
- Root cause:
  - Existing-thread sends inserted a local optimistic `local-turn-*` user item,
    but the client ignored the `/api/threads/:id/messages` response `turnId`.
    Until a later detail refresh reconciled state, the local optimistic turn and
    the materialized server turn could both be visible.
  - v388 already suppressed same-upload `view_image` echoes server-side, but
    V4 client merging could preserve an older local visual receipt when a server
    refresh omitted it. The first attempted client-side upload-name inference was
    removed because it was too broad and not server-owned.
- Change:
  - `public/app.js` now reconciles submitted existing-thread messages
    immediately after message POST success by moving the matching optimistic
    user item into the returned real server `turnId`.
  - The same submitted-turn reconciliation is applied to task-card command
    sends, without referencing nonexistent `steering` state.
  - `server.js` now emits bounded turn-level
    `mobileSuppressedVisualReceiptKeys` for suppressed uploaded-image visual
    receipts. Keys contain only item id, tool call id, or basename identity;
    no upload absolute paths are added.
  - V4 browser merge consumes only those server-projection tombstone keys when
    deciding not to preserve an old local visual receipt. It no longer infers
    suppression from upload summaries on its own.
  - PWA shell cache advanced to `codex-mobile-shell-v389`.
- Tests:
  - Added/updated coverage in:
    - `test/conversation-render.test.js`
    - `test/tool-output-image-projection.test.js`
    - version assertions in `test/mobile-viewport.test.js`,
      `test/thread-goal-service.test.js`, and
      `test/thread-task-card-route.test.js`.
  - New image projection coverage proves:
    - server-suppressed upload image echoes produce a scoped tombstone;
    - a tombstone can exist without a direct `imageView` item;
    - tombstones are scoped to the matching rollout turn and do not leak to
      other upload turns.
- Validation:
  - `node --test test/conversation-render.test.js`
  - Focused 119-test suite:
    `test/conversation-render.test.js`,
    `test/tool-output-image-projection.test.js`,
    `test/mobile-viewport.test.js`,
    `test/thread-goal-service.test.js`, and
    `test/thread-task-card-route.test.js`.
  - `npm run check`
  - `npm run check:macos`
  - `git diff --check`
  - `npm test` passed (`646` tests).
- Local commit:
  - `9946773 fix: reconcile submitted turn projection`
- Production deploy:
  - Used Home AI central deploy script, not task cards:
    `npm run --silent deploy:macos -- --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --reason codex-mobile-v389-scoped-projection-tombstones --execute --json`
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260623T124551Z-plugin-codex-mobile-web-codex-mobile-v389-scoped-projection-tombstones`.
  - Deploy validation passed: log permissions repair, shared auth permissions
    repair, production file hashes, LaunchDaemon print, plugin manifest health,
    and Codex auth profile audit.
  - Production smoke:
    - `/api/public-config`: `clientBuildId=0.1.11|codex-mobile-shell-v389`,
      `shellCacheName=codex-mobile-shell-v389`, `authRequired=true`.
    - Authenticated `/api/status`: `ready=true`,
      `transport=external-jsonl-tcp`, `persistentOwnedMux=true`.
    - Current Home AI/Codex thread recent detail returned v4 projection,
      10 turns, `imageViewCount=0`, `rawAbsoluteImageSrcCount=0`, and scoped
      suppression keys distributed by turn instead of repeated as a thread-wide
      key set.
- Operational notes:
  - This has been deployed to Mac production for user testing.
  - This has not been pushed to public. Follow the release-order rule: wait for
    user confirmation on production before public sync/push.

# HANDOFF

Last compacted: 2026-06-22T08:21:02.101Z

This active handoff was automatically compacted before a Codex Mobile continuation.
The previous full handoff was archived and should be opened only when old provenance is explicitly needed.

## Compaction Summary

- Workspace: `/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web`
- Original active handoff bytes: `530493`
- Archived full handoff: `/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web/.agent-context/archive/context-compaction-20260622_082102/HANDOFF.full-before-context-budget.md`
- Preserved recent active context chars: `16808`

## Startup Guidance

- Read `.agent-context/PROJECT_CONTEXT.md` first.
- Read this compact `.agent-context/HANDOFF.md` for current status.
- Do not load the archived full handoff unless the user asks for old provenance or the compact handoff is insufficient.
- Before changing any latest-version, backup, deployment, or runtime-state fact, verify current repo/runtime state or the latest source-thread handoff; archived old sections are provenance only.
- Keep future handoff updates concise: current state, changed files, validation, risks, and next steps.
- Do not store raw secrets, tokens, one-time approvals, hidden UI state, long logs, or bulky generated output.

## 2026-06-23 - Uploaded Image Echo Suppression And Plugin Continuation Contract v388

- Status: implemented, committed, deployed to Mac production, and
  smoke-validated. Not pushed public.
- Commit:
  - `4aaf92b fix: suppress uploaded image echo receipts`
- User triggers:
  - User clarified that an uploaded image displays correctly in the local/user
    message bubble, then a later system/tool matcher receipt repeats the same
    image as an `Image` card and that duplicate receipt is the broken surface.
  - User also requested plugin-mode compression continuations to inject a
    prompt requiring the new thread to fully load and follow the Home AI
    central platform contract.
- Changes:
  - `server.js`
    - `readRolloutToolOutputImageItems()` now records `view_image` call ids
      whose source path is under the Codex Mobile upload root.
    - `compactTurn()` suppresses tool/image receipts for the same uploaded
      file when the turn already has a user upload summary, including native
      `imageView` echoes that only retain the upload filename or matching
      `view_image` call id.
    - Real generated screenshots/tool images without a matching user upload
      summary still render as generated-image cards.
    - Plugin-mode continuation bootstrap adds a `Home AI Central Contract`
      section pointing to
      `/Users/hermes-dev/HermesMobileDev/app/docs/PLATFORM_CONTRACTS/plugin-workspace-platform-contract.md`.
  - `public/app.js`
    - Embedded/plugin continuation requests now include `pluginMode=hermes`,
      `hermesPluginMode`, and `pluginId=codex-mobile`.
  - `public/sw.js`
    - PWA shell cache advanced to `codex-mobile-shell-v388`.
  - Docs updated:
    - `README.md`
    - `docs/ARCHITECTURE.md`
    - `docs/TROUBLESHOOTING.md`
- Tests:
  - Focused suites passed:
    - `test/tool-output-image-projection.test.js`
    - `test/continuation-lineage.test.js`
    - `test/new-thread-route.test.js`
    - `test/conversation-render.test.js`
    - `test/mobile-viewport.test.js`
    - `test/thread-goal-service.test.js`
    - `test/thread-task-card-route.test.js`
  - `npm run check` passed.
  - `npm test` passed: `642/642`.
- Production deploy:
  - Used Home AI central deploy script directly from
    `/Users/hermes-dev/HermesMobileDev/app`; no task card was used for deploy.
  - Source ref: `4aaf92b1ef20`, dirty `false`.
  - Production target:
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260623T121427Z-plugin-codex-mobile-web-manual`.
  - Deploy validation passed production file hashes, launchd print,
    `/api/public-config`, and Codex auth profile audit.
- Production smoke:
  - `/api/public-config` returned
    `clientBuildId=0.1.11|codex-mobile-shell-v388`,
    `shellCacheName=codex-mobile-shell-v388`, and build id
    `91955e07b8588cc1`.
  - Authenticated `/api/status` returned `ready=true` and
    `transport=external-jsonl-tcp`.
  - Production source contains `suppressedUploadViewImageCallIds` and
    `Home AI Central Contract`.
  - Current Codex Mobile thread
    `019eee6c-a6f5-7b20-bfb4-f96ccb6431b3` full detail returned HTTP `200`;
    the sampled uploaded image `homeai-upload-33BC9A93...jpg` appears only as
    the user message item and has no duplicate system `imageView` receipt.
- Operational notes:
  - Existing browser/PWA sessions must load the v388 shell for the
    plugin-mode continuation request fields; the server-side image echo
    suppression is active after the production restart.
  - Public sync/push remains pending until the user explicitly asks for public
    publication after production validation.

## 2026-06-23 - Continuation First-Open Receipt v386

- Status: implemented, locally committed, deployed to Mac production, and
  smoke-validated. Not pushed public.
- User trigger:
  - After compressing/continuing the large Music thread, Mobile Web navigated
    into the newly created continuation thread and showed the long bootstrap
    message. A short time later the UI showed the turn ended, but the final
    assistant receipt was not visible until leaving and reopening the thread.
- Evidence:
  - New Music continuation thread:
    `019ef42b-2cb8-7332-ab17-033ec5b48947`.
  - Production log sequence showed initial continuation open returned
    `turns-list-initial` with one turn, then post-completion recent refresh
    again returned `turns-list-initial` while summary status was `idle`.
  - The rollout EOF had `task_complete.last_agent_message`; current API after
    re-entry returned the final receipt and `turnUsageSummary`, proving the
    model output existed and the gap was first-open projection/detail hydration.
- Root cause:
  - Before projection was seeded, `mode=recent` could paint a
    `turns-list-initial` window. During the completion boundary the app-server
    summary could be `idle`, and the visible turn from `thread/turns/list`
    could lack completed status, so server-side rollout final receipt and scoped
    Usage backfill did not attach to that existing turn on the first render.
- Change:
  - `server.js` now allows matching rollout `task_complete` final receipts to
    attach to a turn with missing/idle status only when the thread summary is a
    successful resting state (`idle`, `completed`, `success`, `done`, etc.).
    Failed, cancelled, interrupted, running, active, pending, and progress
    statuses remain excluded.
  - `adapters/turn-usage-summary-service.js` mirrors that resting-window rule
    for scoped `token_count` summaries, and only when the current turn id has a
    scoped Usage entry.
  - `public/app.js` post-completion refreshes now request full detail for both
    scheduled refreshes instead of first asking for recent detail.
  - PWA shell cache/client build advanced to `codex-mobile-shell-v386`.
- Tests:
  - Added `resting turns-list window backfills rollout final receipt and scoped
    usage` in `test/thread-item-timestamp-enrichment.test.js`.
  - Added `attaches scoped usage during resting turns-list completion window`
    in `test/turn-usage-summary-service.test.js`.
- Validation:
  - `npm run check` passed.
  - `npm test` passed after docs update: `635` tests.
- Deployment:
  - First central deploy attempt failed safely with
    `deploy_source_dirty_requires_allow_dirty`, listing only this hotfix's
    modified files.
  - Local code commit before deploy:
    `0fb7a28 fix: show continuation completion receipt on first open`.
  - Central Home AI macOS deploy script then succeeded from the app workspace.
  - Production backup path:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260623T112319Z-plugin-codex-mobile-web-manual`.
  - `/api/public-config` returned
    `clientBuildId=0.1.11|codex-mobile-shell-v386`,
    `shellCacheName=codex-mobile-shell-v386`, and build id `ad7dba2ee83e734b`.
  - Authenticated `/api/status` returned `ready=true`,
    `transport=external-jsonl-tcp`, and active profile `default`.
  - Music continuation thread `019ef42b-2cb8-7332-ab17-033ec5b48947` recent
    detail returned HTTP `200`, `mobileReadMode=turns-list-initial`, 2 turns,
    and the latest completed turn included a final `agentMessage` and
    `turnUsageSummary`; full detail returned HTTP `200`, `mobileReadMode=thread-read`.

## 2026-06-23 - Active Thread Feedback v385 Deployed

- Status: implemented, locally committed, deployed to Mac production, and
  validated. Not pushed public.
- User trigger:
  - After recent front-end changes, the user reported that sending a message
    briefly showed input feedback, then a few seconds later the right-side turn
    timer indicated the current turn had ended.
- Evidence:
  - Production `message-submit` logs showed the POST reached app-server and
    returned a `resultTurnId`.
  - Authenticated recent detail for thread
    `019eee6c-a6f5-7b20-bfb4-f96ccb6431b3` returned thread status `active`;
    latest detail after deploy returned `projection-v4-dynamic`, v4 revision
    `67`, latest turn `019ef41f-b286-7f92-89c2-5bd202527e07`, latest status
    `active`, 19 latest-turn items, including running/in-progress command
    items.
  - The strongest failing-window hypothesis was a client-side mismatch:
    thread-level detail status could be `active` while the latest exposed turn
    row was still stale/completed before the real active turn materialized.
    The old client could stop live polling and fall through to the completed
    turn timer branch.
- Change:
  - `public/app.js`
    - Added `currentThreadHasActiveRuntimeStatus()`.
    - `shouldPollCurrentThread()` now continues polling while the current
      thread has non-stale active runtime status, even if the latest turn row is
      stale/completed.
    - `isLiveTurn()` treats the latest unfinished turn as live when the
      thread-level runtime status is active.
    - `updateTurnTimer()` now uses an active fallback timer/label when the
      thread is active but no live turn row is available, avoiding premature
      `已结束`.
    - `updateTickTimer()` keeps ticking during this active-thread fallback.
  - `public/app.js` / `public/sw.js`
    - Bumped shell to `0.1.11|codex-mobile-shell-v385` /
      `codex-mobile-shell-v385`.
  - `test/conversation-render.test.js`
    - Added regression coverage for thread-level active status preserving
      polling through a stale completed latest turn row.
  - `test/mobile-viewport.test.js`
    - Updated shell-cache assertion to v385.
  - `README.md` and `docs/TROUBLESHOOTING.md`
    - Documented the failure mode and the active-thread runtime contract.
- Validation:
  - `node --check public/app.js`
  - `node --test test/conversation-render.test.js` passed 77/77.
  - `node --test test/mobile-viewport.test.js test/collab-agent-render.test.js`
    passed 12/12.
  - `npm run check`
  - `npm run check:macos`
  - `git diff --check`
- Commit:
  - `1b30b70 fix: keep active thread feedback during stale turn refresh`
- Production deploy:
  - Used Home AI central deploy script, not a task card:
    `npm run --silent deploy:macos -- --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --restart-label com.hermesmobile.plugin.codex-mobile --health-url http://127.0.0.1:8787/api/public-config --execute --json`
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup retained at:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260623T110625Z-plugin-codex-mobile-web-manual`.
  - Deploy validation passed production file hashes, launchd print,
    `/api/public-config`, and Codex auth profile audit.
  - Post-deploy smoke:
    - Production `public/app.js` and `public/sw.js` contain
      `codex-mobile-shell-v385`.
    - `/api/public-config` returned HTTP `200`,
      `clientBuildId=0.1.11|codex-mobile-shell-v385`,
      `shellCacheName=codex-mobile-shell-v385`, and `authRequired=true`.
    - `/api/status` returned HTTP `200`, `ready=true`, and
      `transport=external-jsonl-tcp`.
    - Current thread recent detail returned HTTP `200`, thread status
      `active`, latest status `active`, and running/in-progress operation
      evidence.
- Operational notes:
  - User devices must load the v385 shell/cache before exercising the browser
    fix.
  - Branch `main` remains ahead of private `origin/main`; do not push public
    until production/user validation is confirmed.

## 2026-06-23 - Music Completed Operation Dock v383 Deployed

- Status: implemented, locally committed, deployed to Mac production, and
  validated. Not pushed public.
- User trigger:
  - User reported the Music thread bottom Command box did not show correctly
    and permanently displayed `completed`.
- Evidence:
  - Music thread id: `019ed959-27ce-7312-ba77-226ef9c526c7`.
  - Production detail returned `projection-v4-dynamic`, thread status
    `active`, latest turn `019ef403-9ac9-7183-a2e7-2a1818cf4b39` status
    `active`.
  - Latest turn had many command/file operation items, but all were completed;
    active operation count was `0`.
  - Existing front-end `currentLiveOperationEntry()` selected the last
    operation in the latest live turn without checking status, so the bottom
    live-operation dock could pin a stale completed card indefinitely.
- Root cause:
  - The live dock used a different operation-active invariant from
    `activeLiveOperationItemForTurn()`: dock selected "last operation" while
    timer/activity selected "last unfinished operation".
  - Violated invariant: the bottom Command dock represents the currently
    active operation only; completed operation history belongs in turn content
    / compact history, not a persistent live dock.
- Change:
  - `public/app.js`
    - Added shared `isActiveOperationalItem()`.
    - `currentLiveOperationEntry()`, `activeLiveOperationItemForTurn()`,
      `turnHasActiveLiveItems()`, and `liveTurnStartedAtMs()` now use the same
      active-operation predicate.
    - If a live turn has only completed operations, the bottom dock returns no
      entry and hides.
  - `public/app.js` / `public/sw.js`
    - Bumped shell to `0.1.11|codex-mobile-shell-v383` /
      `codex-mobile-shell-v383`.
  - `test/collab-agent-render.test.js`
    - Added executable regression coverage for "running operation followed by
      completed item still selects running" and "only completed operations
      returns null".
  - `README.md`
    - Added detailed Chinese v383 release note.
- Validation:
  - Focused local suite passed 102/102:
    `test/collab-agent-render.test.js`, `test/conversation-render.test.js`,
    `test/mobile-viewport.test.js`, `test/thread-goal-service.test.js`, and
    `test/thread-task-card-route.test.js`.
  - `npm run check`
  - `npm run check:macos`
  - `git diff --check`
  - Full local `npm test` passed 627/627.
  - Production focused suite passed 102/102 in
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Production `/api/public-config` returned
    `clientBuildId=0.1.11|codex-mobile-shell-v383`,
    `shellCacheName=codex-mobile-shell-v383`, and `authRequired=true`.
  - Served `/app.js` and `/sw.js` contain v383.
  - A production JS smoke using Music's current API data and the served
    `currentLiveOperationEntry()` returned `null` with
    `activeOperationCount=0`.
- Commit/deploy:
  - Private main commit:
    `062f088 fix: hide stale completed live operation dock`.
  - Deploy command:
    `npm run --silent deploy:macos -- --target plugin:codex-mobile-web --execute --reason codex-mobile-live-operation-dock-v383 --json`
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260623T103021Z-plugin-codex-mobile-web-codex-mobile-live-operation-dock-v383`
- Public state:
  - Not pushed public. `public/main` still needs a fresh public-safe worktree if
    the user later asks to publish v383.

## 2026-06-23 - Live Receipt Merge v382 Deployed, Public Paused

- Status: implemented, locally committed, deployed to Mac production, and
  validated. Not pushed public.
- User trigger:
  - User asked to pause public push after observing that, immediately after
    sending "推送 public", the assistant receipt appeared briefly and then
    disappeared.
- Evidence:
  - Current thread detail API still returned the new turn and agent receipt, so
    the service did not lose the message.
  - Production client events showed first paint/read paths followed by another
    `thread-read` / `turns-list-initial` / backfill path for the same thread.
  - Public publish was paused before any v381/v382 public commit or push.
- Root cause:
  - `mergeTurnPreservingVisibleItems()` decided whether to keep existing
    local visible items by comparing total turn visible weight.
  - A later backfill/read result could contain more old command output while
    missing a just-displayed assistant receipt. Because its total weight was
    larger, the merge could drop the already-rendered receipt.
  - Violated invariant: same live turn visible items must be monotonic until a
    completed turn result is authoritative.
- Change:
  - `public/app.js`
    - Added `shouldPreserveLiveTurnLocalVisibleItems()`.
    - Same-id, not-complete existing/incoming turns now preserve non-reasoning
      local-only visible items during merge.
    - Completed turns still converge to the incoming authoritative result.
  - `public/app.js` / `public/sw.js`
    - Bumped shell to `0.1.11|codex-mobile-shell-v382` /
      `codex-mobile-shell-v382`.
  - `test/conversation-render.test.js`
    - Added regression coverage for a displayed assistant receipt surviving a
      later `thread-read` backfill with more stale content.
  - `README.md`
    - Added detailed Chinese v382 release note.
- Validation:
  - Focused local suite passed 151/151:
    `test/conversation-render.test.js`,
    `test/thread-detail-projection-service.test.js`,
    `test/thread-detail-projection-v4-service.test.js`,
    `test/thread-visibility.test.js`, `test/mobile-viewport.test.js`,
    `test/thread-goal-service.test.js`, and
    `test/thread-task-card-route.test.js`.
  - `npm run check`
  - `npm run check:macos`
  - `git diff --check`
  - Full local `npm test` passed 626/626.
  - Production focused suite passed 151/151 in
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
- Commit/deploy:
  - Private main commit:
    `46aa5c3 fix: keep live receipts across detail backfills`.
  - Deploy command:
    `npm run --silent deploy:macos -- --target plugin:codex-mobile-web --execute --reason codex-mobile-live-receipt-merge-v382 --json`
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260623T102530Z-plugin-codex-mobile-web-codex-mobile-live-receipt-merge-v382`
  - `/api/public-config` returned
    `clientBuildId=0.1.11|codex-mobile-shell-v382`,
    `shellCacheName=codex-mobile-shell-v382`, and `authRequired=true`.
  - Served `/app.js` and `/sw.js` contain v382.
- Public state:
  - `public/main` remains
    `c5a4ee65a85b11c6378ae012255e6244caa0eaaa`.
  - Removed stale temp public worktrees:
    `/private/tmp/codex-mobile-public-v381.YDuPFd` and
    `/private/tmp/codex-mobile-public.I5p2PN`.
  - If user later asks to push public, create a fresh public-safe worktree from
    current `public/main`, exclude `.agent-context`, validate, then push.

## 2026-06-23 - Rollout EOF Completion and Recent Sort Fix

- Status: implemented, validated locally/staging/production, and deployed to
  Mac production. Not pushed public.
- Home AI contract:
  - Adopted the central Home AI root-cause architecture contract for future
    plugin bugfix/deploy/MCP/schema/provisioning work:
    `/Users/hermes-dev/HermesMobileDev/app/docs/PLATFORM_CONTRACTS/root-cause-architecture-contract.md`.
  - Recorded a direct reference in `AGENTS.md`,
    `.agent-context/PROJECT_CONTEXT.md`, `docs/README.md`, and `README.md`.
  - Do not copy the full contract locally.
- Trigger:
  - After the prior root-state deploy, user reported that reloading `Music`
    was still wrong.
  - Production cold first-open evidence showed `mode=recent` could return a
    `turns-list-initial` response where latest rollout completion was present
    only after later warming, or present but not ordered as the last visible
    turn.
- Root cause:
  - The rollout enrichment index ignored a complete JSONL event when it was the
    final file line without a trailing newline. That made just-finished
    `task_complete` invisible to the recent-window completion repair path.
  - `thread/turns/list` may include timestamp-less `rollout-*` fallback rows;
    generic sorting by id can place those after timestamped completed turns,
    making the UI bottom anchor an older fallback turn on first open.
- Change:
  - `adapters/rollout-enrichment-index-service.js`
    - Exposes a parseable EOF carry as a provisional read-only entry.
    - Keeps incomplete final JSON fragments invisible.
    - When the newline later arrives, the same event enters the persistent index
      normally without duplication.
  - `server.js`
    - Turn sorting now only treats timestamp-less `rollout-*` fallback rows as
      older than timestamped turns.
    - It does not globally reorder ordinary timestamp-less historical turns,
      preserving existing compact-detail semantics.
  - Tests/docs:
    - `test/rollout-enrichment-index-service.test.js`
    - `test/thread-visibility.test.js`
    - `README.md`
    - `docs/ARCHITECTURE.md`
    - `docs/TROUBLESHOOTING.md`
    - `docs/README.md`
- Validation:
  - Private workspace:
    - `node --test test/thread-visibility.test.js
      test/thread-detail-projection-service.test.js
      test/thread-detail-projection-v4-service.test.js
      test/conversation-render.test.js
      test/turn-usage-summary-service.test.js
      test/thread-item-timestamp-enrichment.test.js
      test/rollout-enrichment-index-service.test.js` passed 160/160.
    - `npm test` passed 624/624.
    - `npm run check`
    - `npm run check:macos`
    - `git diff --check`
  - Staging:
    - Final staging package:
      `/tmp/codex-mobile-web-stage-rollout-eof-sort.v7i9py`.
    - Excluded `.git`, `.agent-context`, `.codegraph`, `node_modules`, `data`,
      `logs`, `uploads`, env files, access-key, and secret path patterns.
    - `npm run check`
    - `npm run check:macos`
    - Focused 160-test suite passed with `NODE_PATH` pointed at private
      workspace dependencies.
    - Sensitive-content scan had no hits.
  - Production target after sync:
    - `npm run check`
    - `npm run check:macos`
    - Same focused 160-test suite passed with `NODE_PATH` pointed at production
      dependencies.
- Production deploy:
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Final backup retained at:
    `/tmp/codex-mobile-web-deploy-rollout-eof-sort-20260623T100132Z.backup`.
  - Restart:
    `launchctl kickstart -k system/com.hermesmobile.plugin.codex-mobile`.
  - Post-restart health:
    - `/api/public-config` returned HTTP `200`,
      `clientBuildId=0.1.11|codex-mobile-shell-v380`,
      `shellCacheName=codex-mobile-shell-v380`, and `authRequired=true`.
    - Authenticated `/api/status` returned HTTP `200`, `ready=true`,
      `transport=external-jsonl-tcp`, and active Codex home
      `/Users/xuxin/.codex-homes/previous`.
  - Music smoke:
    - Latest rollout `task_complete` for thread
      `019ed959-27ce-7312-ba77-226ef9c526c7` was
      `019ef3ed-69a6-71f2-bc72-e15c67b7739d` with final receipt length `194`.
    - `/api/threads/:id?mode=recent` returned `turns-list-initial`, `idle`, no
      active turn id, no empty turns, and that latest completion was the last
      visible turn with `userMessage`, `agentMessage`, and `turnUsageSummary`.
    - `/api/threads?limit=80` row for `Music` was `idle`, no active turn id,
      `updatedAt=1782208888`; warm list read hit fallback cache with
      `fallbackCacheHit=true`, `fallbackMs=0`, total about `283ms`.
- Operational notes:
  - This is server-only; no PWA shell cache bump.
  - Public has not been pushed. Follow release-order rule: production/user test
    first, public only after confirmation.

## 2026-06-23 - Root State Ownership Fix for Music Running/Receipt Drift

- Status: implemented, validated locally and in staging, deployed to Mac
  production. Not pushed public.
- New project rule:
  - Codex Mobile is a primary coding tool. Codex Mobile bugs must be fixed at
    the root cause and architecture boundary first.
  - Do not add fallback layers that merely hide projection, synchronization,
    state ownership, routing, or runtime-contract defects while leaving the
    underlying inconsistency in place.
  - Temporary diagnostics must be explicitly scoped and replaced by the
    architectural fix before release.
  - Rule recorded in `AGENTS.md` and `.agent-context/PROJECT_CONTEXT.md`.
- Trigger:
  - `Music` thread appeared stuck/running in the list after the task had
    completed.
  - Opening the thread could show status-chip activity but no visible messages
    or final receipt; a stale local `turn/start` active shell with zero items
    owned the detail view.
  - After completion, app-server `thread/turns/list` could omit the latest
    completed turn from the recent window even though rollout `task_complete`
    had the final receipt.
- Root fix:
  - `server.js`
    - Added runtime evidence ownership reconciliation so local `turn/start`
      overlays yield to a different materialized rollout/app-server active
      turn.
    - Drops empty local active shells from resting thread detail projections.
    - Prunes unmaterialized live shells when summary state is resting.
    - Appends the latest rollout completion turn when a resting thread summary
      and rollout `task_complete` prove that `thread/turns/list` omitted the
      latest completed turn.
  - `adapters/thread-detail-projection-service.js`
    - Dynamic detail cache soft-expires when a resting summary's backing
      signature changes, and when old active dynamic cache points at changed
      backing evidence.
  - Tests/docs updated:
    - `test/thread-visibility.test.js`
    - `test/thread-detail-projection-service.test.js`
    - `README.md`
    - `docs/ARCHITECTURE.md`
    - `docs/TROUBLESHOOTING.md`
- Validation:
  - Private workspace:
    - `npm test` passed 619/619.
    - `node --check server.js`
    - `npm run check`
    - `npm run check:macos`
    - `git diff --check`
  - Staging package:
    `/tmp/codex-mobile-web-stage-root-state.lBagfT`.
    - Excluded `.git`, `.agent-context`, `.codegraph`, `node_modules`, `data`,
      `logs`, `uploads`, env files, access-key, and secret path patterns.
    - `npm run check`
    - `npm run check:macos`
    - Focused 153-test suite passed with `NODE_PATH` pointed at the private
      workspace dependencies.
    - Sensitive-content scan had no hits.
  - Production target after sync:
    - `npm run check`
    - `npm run check:macos`
    - Same focused 153-test suite passed with `NODE_PATH` pointed at production
      dependencies.
- Production deploy:
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup retained at:
    `/tmp/codex-mobile-web-deploy-root-state-20260623T094901Z.backup`.
  - Restart:
    `launchctl kickstart -k system/com.hermesmobile.plugin.codex-mobile`.
  - Post-restart health:
    - LaunchDaemon running with PID `50048`, `runs=28`, last exit code `0`.
    - `/api/public-config` returned HTTP `200`,
      `clientBuildId=0.1.11|codex-mobile-shell-v380`,
      `shellCacheName=codex-mobile-shell-v380`, and `authRequired=true`.
    - Authenticated `/api/status` returned HTTP `200`, `ready=true`,
      `transport=external-jsonl-tcp`, and active Codex home
      `/Users/xuxin/.codex-homes/previous`.
  - Music smoke:
    - `/api/threads?limit=80` row for thread
      `019ed959-27ce-7312-ba77-226ef9c526c7` was `idle`, with no active turn
      id and no local active overlay.
    - Recent detail returned `projection-v4-cache`, no stale empty shell
      `019ef3cb-bbe5-7093-a909-59d58d4db562`.
    - Latest completed turn `019ef07e-7a6e-7110-b73f-30f2a297e835` appeared in
      the 10-turn recent window with final agent receipt text length `685` and
      one `turnUsageSummary`.
    - Second list read after restart hit fallback cache:
      `fallbackCacheHit=true`, `fallbackMs=0`, total about `492ms`.
- Operational notes:
  - This is server-only; no PWA shell cache bump.
  - Public has not been pushed. Follow release-order rule: production/user test
    first, public only after confirmation.

## 2026-06-23 - Thread List Fallback Baseline Incremental Cache

- Status: implemented, validated locally, committed, pushed to private
  `origin/main`, and deployed to Mac production. Not pushed public.
- User requirement:
  - Thread-list fallback memory rebuilds are unacceptable during normal use.
  - Expensive fallback baseline should be rebuilt only on server cold start,
    redeploy, or listener restart. Runtime changes should be incremental sync.
- Prior evidence:
  - Production had no `CODEX_MOBILE_THREAD_LIST_FALLBACK_CACHE_TTL_MS` override,
    so the old default 30000ms applied.
  - Controlled production probe showed one list key slow at about 2477ms,
    fast 5s later at about 513ms, slow again after 36s at about 2516ms, and fast
    again 5s later at about 472ms.
  - The same probe kept `Music` detail on `projection-v4-cache`, so the problem
    was thread-list fallback baseline expiry/rescan, not detail projection
    rebuild.
- Change:
  - `server.js`
    - `CODEX_MOBILE_THREAD_LIST_FALLBACK_CACHE_TTL_MS` default changed from
      `30000` to `0`; `0` now means no time-based expiry in the running server
      process.
    - Thread-list fallback cache keys no longer include `state_5.sqlite`,
      `session_index.jsonl`, archive-index, or `sessions/` directory
      fingerprints, so file mtime/size changes no longer force a cache miss.
    - Normal turn/status/title/archive/new-thread paths no longer clear the
      whole fallback cache. They update, remove, or status-patch the matching
      cached thread summary incrementally.
    - Kept `clearThreadListFallbackCache()` only as an explicit maintenance
      helper; normal event paths should not call it.
  - Docs/tests updated:
    - `README.md`
    - `docs/ARCHITECTURE.md`
    - `docs/TROUBLESHOOTING.md`
    - `test/thread-visibility.test.js`
    - `test/thread-task-card-route.test.js`
- Validation:
  - `node --check server.js`
  - `node --test test/thread-visibility.test.js
    test/thread-task-card-route.test.js test/mobile-viewport.test.js` passed
    47/47.
  - `npm test` passed 613/613.
  - `npm run check`
  - `npm run check:macos`
  - `git diff --check`
- Operational notes:
  - Local/private commit:
    `cf2bf8f fix: keep thread list fallback cache incremental`.
  - Mac production deploy completed through the Home AI central `deploy:macos`
    script, target `plugin:codex-mobile-web`, source
    `/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web`, production
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Production backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260623T085344Z-plugin-codex-mobile-web-manual`.
  - Production validation:
    - Deploy script completed successfully and restarted
      `com.hermesmobile.plugin.codex-mobile`.
    - Production `npm run check` passed.
    - Production `npm run check:macos` passed.
    - Production `node --test test/thread-visibility.test.js
      test/thread-task-card-route.test.js` passed 39/39.
    - Launchd env had no `CODEX_MOBILE_THREAD_LIST_FALLBACK_CACHE_TTL_MS`
      override.
    - Controlled production probe with `/api/threads?limit=41&archived=false`:
      first baseline build took about 2187ms with `fallbackCacheHit=false` and
      `fallbackRolloutMs=1257`; 5s later took about 365ms with
      `fallbackCacheHit=true`; 36s later took about 376ms with
      `fallbackCacheHit=true`; 41s later took about 405ms with
      `fallbackCacheHit=true`. `fallbackRolloutMs` stayed `0` after the first
      build.
    - `Music` detail was `turns-list-initial` immediately after restart, then
      returned to `projection-v4-cache` during the same probe. This is restart
      warming behavior, not the old 30s list fallback rebuild loop.
  - This is server-only; no PWA shell cache bump.
  - After deployment, first full fallback list read in the restarted production
    process may still be slow because it builds the baseline. Repeated list
    reads after that should remain fallback-cache hits unless a distinct
    cwd/search/visibility key is requested or the server restarts.
  - Public has not been pushed. Follow release-order rule: deploy and validate
    Mac production first, then public only after user confirmation.

## 2026-06-23 - Thread List Fallback Detail-Contention Fix v380

- Status: implemented, validated locally, committed, pushed to private
  `origin/main`, and deployed to Mac production. Not pushed public.
- Trigger:
  - User reported that large-thread loading can still feel slow on first entry
    but fast on the second entry, and asked whether the app-server memory cache
    should be rebuilt more often.
- Diagnosis:
  - Production logs for the `Music` thread showed recent detail refreshes mostly
    returning `projection-v4-dynamic` in sub-second times while the rollout was
    about 244MB.
  - One slow sample showed `/api/threads/:id` detail blocked for about 3.3s
    while a background thread-list full fallback ran for about 2.9s, including
    about 1.46s in `fallbackRolloutMs`.
  - Direct production probes matched this: `mode=recent` detail was about
    445ms then 146ms, `fallback=defer` list was about 240ms, full list cold was
    about 2811ms, and full list warm was about 578ms.
  - Conclusion: the symptom is primarily synchronous thread-list fallback
    contention, not a signal to rebuild the thread-detail projection memory
    cache more frequently.
- Change:
  - `server.js`
    - Tracks active `/api/threads/:id` detail responses.
    - Unfiltered ordinary `/api/threads` list requests now return a deferred
      app-server-only list when a detail request is active, with
      `mobileDeferredFallback=true` and
      `fallbackDeferredReason=active-thread-detail`, instead of running the
      expensive state DB / rollout fallback scan.
  - `public/app.js`
    - Adds `hasThreadDetailRequestInFlight()` and treats thread switching,
      live detail refresh, Usage backfill, and full-detail backfill as detail
      activity for deferred-list scheduling.
    - Reschedules full fallback whenever the server returns
      `mobileDeferredFallback`, not only for the initial `fallback=defer`
      startup request.
    - PWA shell/client build advanced to `codex-mobile-shell-v380`.
  - `public/sw.js`
    - Cache advanced to `codex-mobile-shell-v380`.
  - Docs/tests updated:
    - `README.md`
    - `docs/ARCHITECTURE.md`
    - `docs/TROUBLESHOOTING.md`
    - `test/mobile-viewport.test.js`
    - `test/thread-visibility.test.js`
    - `test/thread-goal-service.test.js`
    - `test/thread-task-card-route.test.js`
- Validation:
  - `node --test test/thread-goal-service.test.js
    test/thread-task-card-route.test.js test/thread-visibility.test.js
    test/mobile-viewport.test.js` passed 54/54.
  - `npm test` passed 613/613.
  - `npm run check`
  - `npm run check:macos`
  - `git diff --check`
- Operational notes:
  - Local/private commit:
    `cb748ab fix: defer list fallback during active detail reads`.
  - Pushed to `origin/main`.
  - Mac production deploy was completed directly through the Home AI central
    `deploy:macos` script, target `plugin:codex-mobile-web`, from source
    `/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web` to production
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Production backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260623T083815Z-plugin-codex-mobile-web-manual`.
  - Post-deploy production validation:
    - Deploy script completed successfully, restarted
      `com.hermesmobile.plugin.codex-mobile`, and `/api/public-config` returned
      `clientBuildId=0.1.11|codex-mobile-shell-v380` and
      `shellCacheName=codex-mobile-shell-v380`.
    - `npm run check` passed in production.
    - `npm run check:macos` passed in production.
    - `node --test test/thread-visibility.test.js
      test/mobile-viewport.test.js` passed 39/39 in production.
    - Authenticated `/api/status` returned `ready=true` with
      `transport=external-jsonl-tcp`.
    - Production probes: `Music` recent detail returned HTTP 200 in about
      722ms then 31ms; `fallback=defer` thread list returned HTTP 200 in about
      145ms with `mobileDeferredFallback=true`.
  - A deployment task card was mistakenly sent to Home AI thread
    `019eed86-2002-7cc2-b0b7-937eb5355f36` with card id
    `ttc_88f91779895e5db9ef`. Per the central platform deployment contract,
    this class of plugin-local deploy closure is plugin-owned and should be
    completed directly by calling the Home AI central `deploy:macos` script,
    not by sending a Home AI card.
  - A revoke attempt for that card returned
    `task_card_not_pending:approved`, so it cannot be revoked by the source
    thread and should be ignored rather than used as the deployment path.
  - Follow the release-order rule for any later public sync/push: public publish
    only after production/user confirmation.

## 2026-06-23 - Thread List Cache Timing Follow-Up

- User asked how often the in-memory rebuild path triggers because repeated
  entry over several minutes still feels alternately fast and slow.
- Findings:
  - Production launchd env has no override for
    `CODEX_MOBILE_THREAD_LIST_FALLBACK_CACHE_TTL_MS`, so the default 30000ms
    thread-list fallback cache TTL is active.
  - Thread detail projection v4 does not have a fixed TTL rebuild interval.
    It uses an in-memory Map plus disk cache and invalidates by projection
    signature: rollout path hash, rollout size/mtime, summary updated/status,
    max turn window, and policy version. Dynamic projections are invalidated
    when summary updated time is more than 2s newer than the projection update.
  - Controlled production probe with an otherwise unused
    `/api/threads?limit=41&archived=false` cache key reproduced the timing:
    first list fallback miss took about 2477ms, 5s later cache hit took about
    513ms, 36s later cache miss took about 2516ms, and 5s later cache hit took
    about 472ms.
  - The same probe showed `Music` detail remained `projection-v4-cache` across
    those checks: about 426ms, 144ms, 471ms, and 137ms. That supports the
    conclusion that the observed alternating slow/fast behavior is primarily
    the 30s thread-list fallback cache expiry and rescan, not periodic rebuild
    of the Music thread detail projection memory.
- Potential next fix:
  - Increase or make adaptive the thread-list fallback cache TTL, and/or make
    ordinary background list refreshes use the deferred fallback path more
    aggressively while detail navigation is active. Validate against stale
    active-turn/list-state risk before changing.

## 2026-06-23 - Embedded Image Card Rendering v379 Deployed

- Status: implemented, validated, locally committed, deployed to Mac
  production, and not pushed public.
- Trigger:
  - Home AI task card reported that the embedded Codex `Music` thread showed a
    broken `Image` card on iOS/PWA for
    `1782199969807-4e31c10e9220-homeai-upload-2E2E2EB6-136A-4EA9-96B6-84C29D358A87.jpg`.
  - Home AI-side evidence showed the upload file and generated-image copy were
    valid `882x1280` RGB JPEGs, 164771 bytes, and Home AI proxy returned the
    exact same bytes with HTTP 200 / `image/jpeg`.
- Diagnosis:
  - v378 allowed embedded protected images to start with direct same-origin
    `/api/uploads/file` or `/api/generated-images/file` URLs, but scheduled
    image scans could still fetch and proactively replace still-loading direct
    images with `data:image/...` or `blob:` URLs.
  - Chromium could render the data URL path, but the reported failure was on
    iOS/PWA; the safer embedded/iOS path is to keep proxy-safe same-origin file
    URLs and use fetch only for error recovery.
  - Production `Music` recent API showed the target filename only inside
    bounded reasoning metadata in the latest 10 turns; a post-deploy embedded
    Chromium check did not find the target figure in the currently visible
    window, likely because the large Music thread had shifted it into older
    history. Route and focused DOM harness checks covered the target URL path.
- Change:
  - `public/app.js`
    - Added `codexMobileUploadIdForPath()` so default-runtime upload paths
      render as `/api/uploads/file?id=<upload-root-relative-id>` instead of
      `path=<absolute local path>` in browser image `src`.
    - Embedded/Hermes direct protected images are no longer proactively
      hydrated by scheduled scans while they are still loading.
    - Embedded and iOS recovery keeps a cache-busted same-origin file URL
      before falling back to page-local `data:` / `blob:` recovery.
    - PWA shell/client build advanced to `codex-mobile-shell-v379`.
  - `server.js`
    - `/api/uploads/file` accepts an `id` query parameter resolved only under
      `UPLOAD_ROOT`; legacy `path` remains as a compatibility fallback.
  - Docs updated:
    - `README.md`
    - `docs/ARCHITECTURE.md`
    - `docs/TROUBLESHOOTING.md`
- Tests and validation:
  - Focused local:
    - `node --test test/conversation-render.test.js test/file-preview-ui.test.js`
      passed 75/75.
    - `node --test test/conversation-render.test.js test/file-preview-ui.test.js
      test/mobile-viewport.test.js test/thread-task-card-route.test.js
      test/thread-goal-service.test.js` passed 98/98.
    - `node --test test/generated-image-cache-service.test.js
      test/tool-output-image-projection.test.js` passed 12/12.
  - Full local:
    - `npm run check`
    - `npm run check:macos`
    - `npm test` passed 613/613.
    - `git diff --check`
  - Production target after deploy:
    - `npm run check`
    - `npm run check:macos`
    - `node --test test/conversation-render.test.js test/file-preview-ui.test.js
      test/mobile-viewport.test.js` passed 83/83.
    - Direct Codex route
      `/api/uploads/file?id=2026-06-23/.../1782199969807-...jpg` returned HTTP
      200, `image/jpeg`, 164771 bytes, short SHA `687f8f083cf0e92a`, and bytes
      equal to disk.
    - Home AI proxy route for the same `id` returned HTTP 200, `image/jpeg`,
      164771 bytes, short SHA `687f8f083cf0e92a`, and bytes equal to disk.
    - `/api/public-config` returned
      `clientBuildId=0.1.11|codex-mobile-shell-v379` and
      `shellCacheName=codex-mobile-shell-v379`.
    - Authenticated `/api/status` returned `ready=true`.
    - LaunchDaemon `system/com.hermesmobile.plugin.codex-mobile` is running.
- Commit/deploy:
  - Local code commit:
    `c71c619 fix: stabilize embedded image card rendering`.
  - Production deploy used Home AI central Mac deploy:
    `npm run --silent deploy:macos -- --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --restart-label com.hermesmobile.plugin.codex-mobile --health-url http://127.0.0.1:8787/api/public-config --execute --json`.
  - Target:
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260623T075712Z-plugin-codex-mobile-web-manual`.
- Operational notes:
  - This has not been pushed public.
  - iOS/WebKit was not directly available in this thread; coverage is through
    production route smoke, Chromium embedded route checks, and focused DOM
    harness tests for embedded direct URL and error recovery behavior.

## 2026-06-23 - Public Sync After Dynamic Task Card Fix

- Status: public sync completed after Mac production deploy and user
  confirmation.
- Public remote:
  - `public/main` was advanced from `8da296e` to
    `d7b9ffb fix: return valid dynamic task card responses`.
  - Published commits on the clean public branch:
    - `97900af fix: make Fast thread-local`
    - `0212d3e fix: allow tool workspaces under source guard`
    - `3307eae fix: recover embedded protected images`
    - `d7b9ffb fix: return valid dynamic task card responses`
- Public/private hygiene:
  - A first temporary publish branch was discarded because cherry-picking older
    commits also changed `.agent-context/HANDOFF.md`.
  - The final publish branch was rebuilt from `public/main`; every
    cherry-pick explicitly restored `.agent-context` before committing.
  - `public/main..d7b9ffb` contains no `.agent-context` diff.
  - Local backup of the prior private main:
    `backup/main-before-public-sync-20260623-140315`.
- Validation on the clean public branch before push:
  - `npm run check`
  - `npm run check:macos`
  - `npm test` passed with 610/610 tests.
  - `git diff --check`
- Next local-state requirement:
  - Keep private `main` derived from `public/main`; only private
    `.agent-context` changes should remain ahead of public.

## 2026-06-23 - Dynamic Task Card Response Schema Deployed

- Status: diagnosed, fixed, locally committed, deployed to Mac production, and
  pushed to public after user confirmation.
- Trigger:
  - User reported Home AI -> 星盘/Moira task-card sends repeatedly failed, while
    星盘/Moira -> Home AI task cards still worked.
  - Home AI latest turn `019ef2e0-29f4-7620-b658-f8d879b9a776` contained three
    failed `dynamicToolCall` items for `codex_mobile.delegate_to_thread`, each
    with rollout output `dynamic tool response was invalid`.
- Root cause evidence:
  - Mobile Web injected the app-server dynamic tool into the Home AI turn:
    `[workspace-delegation-rpc] ... dynamicToolsCount:1 ...
    hasWorkspaceDelegationTool:true`.
  - app-server mux broadcast real `item/tool/call` requests for the failed calls
    and forwarded Mobile Web responses.
  - mux logged the concrete app-server deserialization error:
    `failed to deserialize DynamicToolCallResponse: missing field contentItems`.
  - The deployed response was still `result.content_items[{type:"input_text"}]`;
    app-server currently expects camelCase `result.success` and
    `result.contentItems[{type:"inputText"}]`.
  - No latest Home AI -> Moira card was persisted for the failed 05:16 turn;
    the recent task-card store showed only older Home AI -> Moira cards and a
    later Moira -> Home AI card.
- Change:
  - `server.js` dynamic tool responses now return
    `result.success` plus `result.contentItems[{ type:"inputText" }]`.
  - Dynamic tool error payloads now return `success:false`.
  - Tests were updated for the current app-server response schema.
  - Stale frontend build-id assertions in two tests were updated from v377 to
    the already-deployed v378 shell.
- Changed files:
  - `server.js`
  - `test/protocol.test.js`
  - `test/thread-task-card-route.test.js`
  - `test/thread-goal-service.test.js`
  - `README.md`
  - `docs/CROSS_THREAD_TASK_CARDS_IMPLEMENTATION.md`
  - `.agent-context/HANDOFF.md`
- Validation:
  - Private workspace:
    - `node --test test/protocol.test.js test/thread-task-card-route.test.js
      test/thread-goal-service.test.js test/codex-mobile-mcp-server.test.js`
      passed with 33/33 tests.
    - `npm run check`
    - `npm run check:macos`
    - `git diff --check`
    - `npm test` passed with 610/610 tests.
  - Production target after deploy:
    - `npm run check`
    - `npm run check:macos`
    - same focused 33-test suite passed.
    - Direct production function probe returned
      `{"result":{"success":true,"contentItems":[{"type":"inputText","text":"ok"}]}}`.
    - `/api/public-config` returned HTTP 200 with
      `clientBuildId=0.1.11|codex-mobile-shell-v378`,
      `shellCacheName=codex-mobile-shell-v378`, and
      `workspacePath=/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
    - Authenticated `/api/status` returned HTTP 200 and `ready=true`.
    - LaunchDaemon `system/com.hermesmobile.plugin.codex-mobile` is running
      with PID `58288`, `runs=21`, and last exit code `0`.
- Commit/deploy:
  - Local commit:
    `5a2d630 fix: return valid dynamic task card responses`.
  - Production deploy used Home AI central Mac deploy:
    `npm run --silent deploy:macos -- --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --restart-label com.hermesmobile.plugin.codex-mobile --health-url http://127.0.0.1:8787/api/public-config --execute --json`.
  - Target:
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260623T052711Z-plugin-codex-mobile-web-manual`.
- Operational notes:
  - This is server-only; no PWA cache bump.
  - The fix has not been live-tested by starting a new Home AI -> Moira
    delegation turn after deployment, to avoid creating another unintended card.
    The next dynamic-tool call should no longer hit the
    `missing field contentItems` app-server error.
  - Public sync completed after production deploy and user confirmation.

## 2026-06-23 - Embedded Upload Image Recovery v378 Deployed

- Status: implemented, validated, locally committed, deployed to Mac
  production, and not pushed public.
- Trigger:
  - User reported that the same uploaded image displayed in the current Codex
    Mobile thread but roon thread images did not display.
  - Live checks showed roon upload files existed, were valid baseline JPEGs,
    and `/api/uploads/file` returned `200 image/jpeg` with auth. Plugin
    session authorization also worked, including stale query token plus current
    plugin-session cookie.
- Change:
  - In `public/app.js`, Hermes/Home AI embed images still render the direct
    same-origin `/api/uploads/file` or `/api/generated-images/file` URL first,
    but now also retain `data-protected-image-src`.
  - Scheduled image scans can hydrate those direct embedded images by fetching
    with the current in-memory session key and replacing unstable direct loads
    with page-local `data:image/...` or `blob:` URLs.
  - Already-loaded embedded images are skipped, so the fallback does not disturb
    working direct loads.
  - PWA shell cache/client build advanced to `codex-mobile-shell-v378`.
- Changed files:
  - `public/app.js`
  - `public/sw.js`
  - `test/conversation-render.test.js`
  - `test/mobile-viewport.test.js`
  - `README.md`
  - `docs/ARCHITECTURE.md`
  - `docs/TROUBLESHOOTING.md`
  - `.agent-context/HANDOFF.md`
- Validation:
  - Private workspace:
    - `node --test test/conversation-render.test.js`
    - `node --test test/conversation-render.test.js test/mobile-viewport.test.js`
      passed with 79/79 tests.
    - `npm run check`
    - `npm run check:macos`
    - `git diff --check`
  - Staging:
    - Staged under `/tmp/codex-mobile-web-stage-image-recover.ryMXle`.
    - Blocked-path scan excluded `.git`, `.agent-context`, `.codegraph`,
      `node_modules`, runtime data/log/upload directories, env files, access
      key files, and secret/private-key patterns.
  - Production target after sync:
    - `npm run check`
    - `npm run check:macos`
    - `node --test test/conversation-render.test.js test/mobile-viewport.test.js`
      passed with 79/79 tests.
- Commit/deploy:
  - Local commit:
    `0ab5a94 fix: recover embedded protected images`.
  - Target:
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup:
    `/tmp/codex-mobile-web-deploy-image-recover-v378-20260623T034120Z.backup`.
    The standard `/Users/hermes-host/HermesMobile/backups/deploy` path was not
    writable from this thread and passwordless sudo was unavailable, so no
    production files were synced until the `/tmp` backup completed.
  - Static-only deploy; listener restart was not required. Current server reads
    build metadata from static files on each `/api/public-config` request.
  - Production smoke:
    - `/api/public-config` returned HTTP 200 with
      `clientBuildId=0.1.11|codex-mobile-shell-v378`,
      `shellCacheName=codex-mobile-shell-v378`, and
      `workspacePath=/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
    - Authenticated `/api/status` returned HTTP 200 and `ready=true`.
    - Served `/app.js` and `/sw.js` both contained
      `codex-mobile-shell-v378`.
    - roon uploaded image route returned 401 without auth and
      `200 image/jpeg` with auth.
- Operational notes:
  - The user observed roon photos displaying again before the v378 deploy
    completed, which supports the diagnosis that the backend/file path was
    already healthy and the bug was in transient frontend/WebView image
    recovery state.
  - This has not been pushed public.

## 2026-06-23 - Workspace Delegation Tool Workspace Allowance

- Status: implemented, validated, locally committed, deployed to Mac
  production, and not pushed public.
- User clarification:
  - Cross-workspace delegation protection should prevent modifying other source
    trees.
  - Tool workspaces must remain usable for validation and diagnostics, including
    local Playwright / Chromium and Home AI visual harness flows.
- Change:
  - `adapters/workspace-source-write-guard-service.js` no longer treats
    JavaScript `=>` as shell redirection.
  - Foreign-cwd tool commands are allowed when they do not write into the
    foreign source root, including writing bounded artifacts to `/tmp` or
    `/private/tmp`.
  - Direct foreign source mutations remain denied: `apply_patch`, file-change
    requests, relative-path source writes, `git add` / `git commit`, install or
    update commands, and write-like file-system grants.
- Changed files:
  - `adapters/workspace-source-write-guard-service.js`
  - `test/workspace-source-write-guard-service.test.js`
  - `README.md`
  - `docs/ARCHITECTURE.md`
  - `docs/CROSS_THREAD_TASK_CARDS_IMPLEMENTATION.md`
  - `.agent-context/HANDOFF.md`
- Validation so far:
  - `node --test test/workspace-source-write-guard-service.test.js`
  - `node --test test/new-thread-route.test.js`
  - `node --check adapters/workspace-source-write-guard-service.js`
  - `npm run check`
  - `npm run check:macos`
  - `npm test` passed with 609/609 tests.
  - `git diff --check`
- Commit/deploy:
  - Local commit subject:
    `fix: allow tool workspaces under source guard`.
  - Production deploy used Home AI central Mac deploy:
    `npm run --silent deploy:macos -- --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --restart-label com.hermesmobile.plugin.codex-mobile --health-url http://127.0.0.1:8787/api/public-config --execute --json`.
  - Production backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260623T025203Z-plugin-codex-mobile-web-manual`.
  - LaunchDaemon:
    `system/com.hermesmobile.plugin.codex-mobile` running, PID `87679`,
    runs `20`, last exit code `0`.
  - Production health:
    `/api/public-config` returned HTTP 200 with
    `clientBuildId=0.1.11|codex-mobile-shell-v377`.
  - Authenticated `/api/status` returned HTTP 200 and `ready=true`.
  - Production target readback contains `CWD_SOURCE_MUTATING_COMMAND_PATTERN`
    and the JavaScript arrow-function redirection fix.
  - Production target
    `node --test test/workspace-source-write-guard-service.test.js` passed
    with 9/9 tests.
- Operational notes:
  - This is server-only; no PWA shell cache bump is needed.
  - This has not been pushed public.

## 2026-06-23 - Fast Thread-Local Tag v377 Deployed

- Status: implemented, validated, deployed to Mac production, and pending local
  private commit.
- User decision:
  - Mobile Web Fast should intentionally differ from the official/global model:
    it is now a thread-persistent tag, not a global browser switch.
  - Turning Fast on/off affects only the current thread. A new-thread draft can
    carry Fast into the created thread, but it does not change other threads.
- Change:
  - `public/app.js` no longer initializes Fast from the retired global
    `codexMobileCodexFastMode` key and no longer writes that key.
  - Current-target draft state is the source of truth:
    `draft.fastMode === true` turns Fast on for that thread/new-thread draft;
    missing `fastMode` turns it off for that target.
  - Switching targets clears Fast until the target draft is restored.
  - Toggling Fast clears the retired global key best-effort so old browser state
    cannot re-enable Fast.
  - The Fast button now suppresses synthetic `click` / `touchend` after
    `pointerdown`, preventing one touch from toggling twice.
  - UI title/aria text now says `Fast tag`.
  - PWA shell cache/client build advanced to `codex-mobile-shell-v377`.
- Changed files:
  - `public/app.js`
  - `public/index.html`
  - `public/sw.js`
  - `test/composer-draft.test.js`
  - `test/composer-quota.test.js`
  - `test/mobile-viewport.test.js`
  - `test/thread-goal-service.test.js`
  - `test/thread-task-card-route.test.js`
  - `README.md`
  - `docs/ARCHITECTURE.md`
  - `docs/TROUBLESHOOTING.md`
- Validation:
  - Private workspace:
    - Focused 60-test suite passed:
      `test/composer-draft.test.js`, `test/composer-quota.test.js`,
      `test/draft-store.test.js`, `test/mobile-viewport.test.js`,
      `test/thread-goal-service.test.js`,
      `test/thread-task-card-route.test.js`, and
      `test/new-thread-route.test.js`.
    - `node --check public/app.js`
    - `node --check public/draft-store.js`
    - `git diff --check`
    - `npm run check`
    - `npm run check:macos`
    - `npm test` passed (`608` tests).
  - Staging:
    - Source staged at:
      `/tmp/codex-mobile-web-stage-fast-thread.Xo8YE9`.
    - Blocked-path scan was clean for `.git`, `.agent-context`, `.codegraph`,
      `node_modules`, `data`, `logs`, `uploads`, env files, access-key,
      private-key, and secret path patterns.
    - `npm run check`
    - `npm run check:macos`
    - Same focused 60-test suite passed with `NODE_PATH` pointed at the private
      workspace `node_modules`.
  - Production target after sync:
    - `npm run check`
    - `npm run check:macos`
    - Same focused 60-test suite passed.
    - Note: direct use of the production runtime `npm` symlink from the source
      user failed with a `readlink` permission error, so target checks used the
      normal available `npm` binary while running in the production target cwd.
- Production deploy:
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup retained at:
    `/tmp/codex-mobile-web-deploy-fast-thread-20260623T014608Z.backup.tar.gz`.
  - Sync used `sudo -S` with the configured local sudo password file as stdin;
    no secret content was printed. Runtime directories and machine-specific
    state were preserved.
  - Restart:
    `launchctl kickstart -k system/com.hermesmobile.plugin.codex-mobile`.
  - Post-restart smoke:
    - LaunchDaemon `system/com.hermesmobile.plugin.codex-mobile` is running
      with PID `69706`, `runs=19`, and last exit code `0`.
    - `/api/public-config` returned HTTP `200`,
      `clientBuildId=0.1.11|codex-mobile-shell-v377`,
      `shellCacheName=codex-mobile-shell-v377`, `platform=darwin`, and
      `authRequired=true`.
    - Authenticated `/api/status` returned HTTP `200`, `ready=true`, and
      `lastError=null`.
    - Production HTTP static checks for `/app.js`, `/sw.js`, and `/` returned
      HTTP `200`; `/app.js` and `/sw.js` contain `codex-mobile-shell-v377`,
      `/app.js` no longer restores Fast from a global `localStorage` read, and
      `/` contains the `Fast tag off for this thread` initial title.
- Operational notes:
  - This has not been pushed to public. Follow the release-order rule: wait for
    production/user confirmation before any public sync/push.
  - Already-open PWA/browser clients must accept the refresh prompt, hard
    refresh, or close/reopen to load `codex-mobile-shell-v377`.

## Preserved Recent Handoff Tail

## 2026-06-21 Per-thread Incremental Rollout Enrichment Index

- Status: implemented, validated, committed, and deployed to Mac production.
- Trigger:
  - Large rollout threads still showed projection/enrichment instability. A
    simple server-side tail increase from 32 MiB to 100 MiB was considered, but
    the chosen implementation is a per-thread incremental rollout index so the
    server does not repeatedly rescan a large suffix just to recover historical
    enrichment.
- Server change:
  - Added `adapters/rollout-enrichment-index-service.js`.
  - `server.js` now creates `rolloutEnrichmentIndexService` and uses
    `readRolloutEnrichmentEntries()` for historical item timestamp candidates,
    tool output image projection, and missing turn usage summaries.
  - The index is keyed by normalized rollout real path. It tracks file offset,
    carry text for incomplete JSONL lines, parsed entries, mtime/size, parse
    error counts, reset count, and last update time.
  - If a rollout grows, the service reads only appended bytes. If the file is
    truncated or rotated, the index resets. Old indexes are pruned by
    `RUNTIME_CONTEXT_CACHE_MAX`.
  - `CODEX_MOBILE_ROLLOUT_ENRICHMENT_CONTEXT_BYTES` remains as a legacy fallback
    only if the incremental index read fails. Normal enrichment is no longer
    bounded by the 32/100 MiB tail window.
- Client behavior:
  - No broader client payload is introduced. Thread detail still projects the
    latest client window; server enrichment can now recover older metadata from
    the per-thread index without sending a huge rollout to the browser.
- Tests and docs:
  - `package.json` `npm run check` now syntax-checks the new adapter.
  - `README.md` documents the legacy role of
    `CODEX_MOBILE_ROLLOUT_ENRICHMENT_CONTEXT_BYTES`.
  - Added `test/rollout-enrichment-index-service.test.js`.
  - Updated `test/tool-output-image-projection.test.js` to prove uploaded
    `view_image` suppression works when the source call is outside the ordinary
    rollout tail but available through the index.
  - Updated `test/turn-usage-summary-service.test.js` to assert the server uses
    the incremental enrichment entry path.
- Validation:
  - `node --check server.js && node --check adapters/rollout-enrichment-index-service.js`
  - `node --test test/rollout-enrichment-index-service.test.js test/tool-output-image-projection.test.js test/turn-usage-summary-service.test.js`
  - `git diff --check`
  - `npm run check`
  - `npm test`
  - Home AI required guard:
    `cd /Users/hermes-dev/HermesMobileDev/app && node tests/architecture-code-test-harness-map.test.js`
  - Real rollout smoke on
    `/Users/xuxin/.codex/sessions/2026/06/08/rollout-2026-06-08T21-28-43-019ea76b-d846-7892-bda0-c0fff9cf7581.jsonl`
    at 140,953,084 bytes:
    first read parsed 59,283 entries in 267 ms; second read was a cache hit in
    0 ms with `bytesRead=0` and `parsedLines=0`.
- Known boundary:
  - The index is in-memory. After a listener/server restart, the first access to
    a large rollout still parses the full file once; subsequent reads only parse
    appended bytes.
- Commit/deploy:
  - Private source commit: `0f99474 feat: add rollout enrichment index`.
  - Local public-safe deployment source commit:
    `38ee0a7 feat: sync rollout enrichment deployment`.
  - Private main merged the local public-safe deployment source with
    `e3a64f8 merge: sync public deployment source` so the private branch keeps
    the public-source commit in its ancestry.
  - Production target:
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260621T110719Z-plugin-codex-mobile-web-rollout-index-38ee0a7.tar.gz`.
  - Deploy path used a direct local equivalent of `scripts/deploy-macos-plugin.ps1`
    because no PowerShell runtime was available in the current Mac process:
    public-safe git archive, blocked-path check, staging checks, target backup,
    target sync preserving runtime directories, target checks, one
    `launchctl kickstart -k system/com.hermesmobile.plugin.codex-mobile`, then
    loopback smoke.
  - Post-restart smoke:
    `/api/public-config` returned `version=0.1.11`,
    `clientBuildId=0.1.11|codex-mobile-shell-v366`,
    `shellCacheName=codex-mobile-shell-v366`, `platform=darwin`,
    `authRequired=true`; target file
    `adapters/rollout-enrichment-index-service.js` exists.

## 2026-06-21 Thread Open Latency Diagnosis And v367 Deploy

- Status: diagnosed, patched, committed, and deployed to Mac production as
  `codex-mobile-shell-v367`.
- User report:
  - Opening a thread felt slower after the per-thread rollout enrichment index
    deployment. The user also noted the current device might be on 5G, not home
    Wi-Fi.
- Production evidence:
  - Local loopback `/api/threads/<threadId>` timing after restart showed cold
    calls can be slower, then hot calls become fast:
    - `codex mobile`: `2.635s`, then `0.499s`, `0.503s`.
    - `Music`: `0.359s`, then `0.096s`, `0.093s`.
    - `Home AI 06-18`: `1.031s`, then `0.187s`, `0.111s`.
  - Local loopback thread list timings showed the bigger contention source:
    `/api/threads?limit=40&archived=false` was `2.458s` cold and
    `0.602s` / `0.494s` hot, while
    `/api/threads?limit=40&archived=false&fallback=defer` was
    `0.226s`, `0.187s`, `0.169s`.
  - Runtime logs showed full thread-list fallback repeatedly taking around
    `2.2s-2.6s`, with `fallbackRolloutMs` around `1.2s-1.4s`, while thread
    detail projection hits were usually `80ms-260ms`. Client first-paint events
    on iPhone still reported `2s-3.4s` when these operations overlapped.
- Root cause assessment:
  - Network/5G latency can amplify the visible delay, but origin-side work is
    also significant.
  - The per-thread enrichment index is not the only cost. The slower visible
    path is often an overlapping silent thread-list full fallback refresh that
    scans state DB / recent rollout files while the thread detail first paint is
    also loading.
  - `THREAD_LIST_FALLBACK_CACHE_TTL_MS` was only `5000`, so active use could
    miss cache frequently.
- Patch:
  - `server.js`: default `CODEX_MOBILE_THREAD_LIST_FALLBACK_CACHE_TTL_MS`
    changed from `5000` to `30000`.
  - `public/app.js`: silent thread-list refreshes that happen while a thread
    detail is still opening now request `fallback=defer`, avoiding the expensive
    fallback scan on the critical first-paint path. The startup deferred-list
    follow-up still explicitly runs a full fallback refresh with
    `deferFallback:false`.
  - `README.md`: documented
    `CODEX_MOBILE_THREAD_LIST_FALLBACK_CACHE_TTL_MS` and the silent refresh
    defer behavior.
  - `test/mobile-viewport.test.js`: updated static assertions for the new
    defer behavior.
  - `public/app.js` and `public/sw.js`: client shell cache advanced to
    `codex-mobile-shell-v367`.
- Validation:
  - `node --test test/mobile-viewport.test.js test/thread-visibility.test.js`
  - `node --check server.js && node --check public/app.js`
  - `git diff --check`
  - `npm run check`
  - `node --test test/mobile-viewport.test.js test/thread-visibility.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
    in both source/public mirror and production target.
- Commit/deploy:
  - Private source commit:
    `f345e5a fix: defer list fallback during thread open`.
  - Local public-safe deployment source commit:
    `079e51f release: publish v367 thread load fix`.
  - Private main merged the local public-safe deployment source with
    `merge: sync public v367 deployment source`.
  - Production target:
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260621T111936Z-plugin-codex-mobile-web-v367-thread-load-079e51f.tar.gz`.
  - Production smoke after one
    `launchctl kickstart -k system/com.hermesmobile.plugin.codex-mobile`:
    `/api/public-config` returned `clientBuildId=0.1.11|codex-mobile-shell-v367`
    and `shellCacheName=codex-mobile-shell-v367`.
  - Post-deploy loopback timing:
    `fallback=defer` list calls were about `0.206s`, `0.213s`, `0.360s`;
    full list remained `2.399s` cold and `0.445s` / `0.421s` hot. This confirms
    the fix reduces contention during thread first paint; it does not remove
    the full fallback scan path.

## 2026-06-22 Codex Mobile MCP Toolset Registration

- Status: implemented, deployed to Mac production, and smoke-tested through the
  Android thread.
- User requirement:
  - Codex Mobile cross-workspace delegation must be available as a real Codex
    toolset, not only a model-instruction fallback.
  - Registration must be dynamic and per Profile/Codex Home. If a new Profile
    or Codex Home lacks the toolset, Mobile Web should register it as part of a
    fixed flow.
- Patch:
  - Added `adapters/codex-mobile-mcp-config-service.js`.
    - Registers or repairs `[mcp_servers.codex_mobile]` in each target
      `CODEX_HOME/config.toml`.
    - Stores only command, script path, server URL, and key-file path. It does
      not store raw keys.
    - Writes tool-level `approval_mode = "approve"` for both tools so Codex's
      MCP elicitation layer does not add an extra approval dialog.
  - Added `scripts/codex-mobile-mcp-server.js`.
    - Stdio MCP server named `codex_mobile`.
    - Exposes `list_threads` and `delegate_to_thread`.
    - Calls the authenticated local Codex Mobile HTTP APIs and reads the access
      key from env or the configured key file.
    - Tool list includes MCP annotations: `list_threads` is read-only;
      `delegate_to_thread` is non-destructive but state-changing, with final
      source-direct approval still gated by Mobile Web runtime settings.
  - Updated `server.js`.
    - `syncCodexMobileMcpToolset()` registers a single Codex Home.
    - `syncKnownCodexMobileMcpToolsets()` enumerates all known Profiles and
      registers every existing Codex Home.
    - Registration now runs on startup, `/api/public-config`, `/api/codex-profiles`,
      workspace creation, and target Profile switch before preflight.
  - Updated docs: `README.md`,
    `docs/CROSS_THREAD_TASK_CARDS_IMPLEMENTATION.md`, `docs/ARCHITECTURE.md`,
    and `docs/MODULES.md`.
- Validation:
  - `node --check scripts/codex-mobile-mcp-server.js`
  - `node --check adapters/codex-mobile-mcp-config-service.js`
  - `node --test test/codex-mobile-mcp-server.test.js test/manual-restart-ui.test.js`
  - `npm run check`
  - `git diff --check`
  - Central checks:
    `node tests/plugin-workspace-platform-contract-check.test.js`,
    `node tests/plugin-capability-activation-service.test.js`,
    `node tests/hermes-plugin-service.test.js`,
    `node tests/hermes-plugin-authorization-service.test.js`.
- Production deploys:
  - `codex-mobile-mcp-known-profile-registration`
  - `codex-mobile-mcp-auto-approval-registration`
  - `codex-mobile-mcp-approve-tool-registration`
  - All deploys used the Mac production plugin deploy harness and passed
    health, LaunchDaemon, and auth-profile audit validation.
- Production readback:
  - `/api/status`: `ready=true`, transport `external-jsonl-tcp`,
    persistent owned mux enabled, active Codex Home
    `/Users/xuxin/.codex-homes/previous`.
  - After `/api/public-config`, all known Profiles had
    `[mcp_servers.codex_mobile]`:
    `/Users/xuxin/.codex`, `/Users/xuxin/.codex-homes/current`,
    `/Users/xuxin/.codex-homes/previous`.
  - Each `codex_mobile` section had two `approval_mode = "approve"` tool
    entries.
- Runtime reload:
  - Restarting only the 8787 listener did not reload MCP approval config because
    persistent Mobile-owned mux/app-server stayed alive.
  - A controlled mux/app-server reload was performed by terminating the
    Mobile-owned mux parent and letting the listener recreate it.
  - Final active chain:
    listener PID `14345`, mux PID `24765`, app-server PID `24766`, endpoint
    port `59607`, `/api/status` ready.
- Final smoke:
  - Sent a direct diagnostic card to Android:
    `ttc_4135a9e8eb6568c404`,
    target turn `019eed27-fd7b-76c0-a0fb-84db43849b78`.
  - Android confirmed `mcp__codex_mobile.list_threads` is visible.
  - `list_threads` with limit 3 returned directly, without
    `mcpServer/elicitation/request` and without waiting for MCP approval.
- Important boundary:
  - Running app-server processes do not appear to hot-reload MCP approval
    config. If the config is changed again, reload the Mobile-owned mux/app-server
    once before testing tool approval behavior.

## 2026-06-22 Workspace Delegation Source Write Guard Hardening

- Status: implemented locally and validated; deployment/commit may follow this
  handoff entry.
- User issue:
  - With `跨工作区委派` enabled, the Music workspace thread was still able to
    modify, commit, and deploy Home AI source files, then send a task card after
    the fact.
  - Official Home AI-provided tools should remain callable, but direct
    cross-workspace source edits must be blocked.
- Root cause:
  - The previous compatibility runtime defaulted delegated plugin turns to
    `danger-full-access` plus an approval proxy. Direct tools such as
    `apply_patch` or shell commands do not necessarily raise app-server approval
    requests, so the proxy could not block them.
  - Server approval classification also treated explicit command `params.cwd`
    as the source workspace before resolving the source thread/turn cwd. A
    plugin thread could therefore set command cwd to Home AI and make Home AI
    appear to be the current workspace for guard decisions.
- Patch:
  - `server.js`
    - Default workspace-delegation runtime now uses real
      `workspace-write` / managed profile plus `approvalPolicy:"on-request"`.
    - Old `danger-full-access` approval-proxy-only behavior is only available
      through explicit `CODEX_MOBILE_WORKSPACE_DELEGATION_APPROVAL_PROXY_ONLY=1`.
    - App-server approval guard remains active in real sandbox mode.
    - Source cwd resolution now prefers thread/turn ownership; command cwd is
      only a fallback when no source thread cwd is known.
  - `adapters/workspace-source-write-guard-service.js`
    - Adds a narrow Home AI official-tool allowlist:
      `scripts/ai-ops-control-plane.js`,
      `scripts/deploy-macos-production.js`,
      `scripts/plugin-workspace-platform-contract-check.js`,
      `tests/architecture-code-test-harness-map.test.js`,
      `npm run deploy:macos`, and `npm run ios:pwa:visual`.
    - Shell-chained commands are not trusted.
    - Direct `apply_patch`, file-change approvals, `git add/commit`, write-like
      commands, and write-like file-system grants against another source root
      are denied.
  - Tests/docs updated:
    - `test/workspace-source-write-guard-service.test.js`
    - `test/new-thread-route.test.js`
    - `README.md`
    - `docs/ARCHITECTURE.md`
    - `docs/CROSS_THREAD_TASK_CARDS_IMPLEMENTATION.md`
    - `docs/MODULES.md`
- Validation:
  - `node --test test/workspace-source-write-guard-service.test.js test/new-thread-route.test.js test/thread-task-card-route.test.js test/protocol.test.js test/codex-profile-service.test.js`
  - `npm run check`
  - `git diff --check`
  - Center architecture harness:
    `cd /Users/hermes-dev/HermesMobileDev/app && node tests/architecture-code-test-harness-map.test.js`
  - Evidence ledger:
    `/Users/xuxin/.homeai-qa/codex-mobile-web-evidence-ledger.jsonl`
    record `evidence-435833f2-c22f-4550-8564-cbf91e890093`.
- Operational note:
  - Existing active turns keep the sandbox they were started with. New
    thread/start, thread/resume, and turn/start requests pick up the hardened
    runtime.

### Follow-up smoke finding

- A source-direct test card was sent to idle `Note`
  (`019ea7f4-223e-7c12-a389-4efb75df8ec5`), target turn
  `019eee26-7f24-7bb3-87ec-76f5efad22c1`.
- Result before the follow-up patch:
  - Foreign Home AI source write was denied and left no test file.
  - Home AI AI Ops intake command was allowed.
  - Current workspace `.git` write still failed under the ordinary sandbox and
    only succeeded after escalation.
- Follow-up patch:
  - `workspaceDelegationWriteGuardSandboxPolicy()` now explicitly adds each
    current writable root's `.git` directory to `sandboxPolicy.writableRoots`,
    because the app-server sandbox can reject git metadata writes before the
    managed permission profile is consulted.
  - Added `test/new-thread-route.test.js` guard assertions for explicit `.git`
    writable roots.
- Required post-deploy validation:
  - Send another source-direct test card to an idle thread and confirm ordinary
    `.git` temp write succeeds without escalation, foreign source write is
    denied, and Home AI official tool invocation still works.

## 2026-06-22 Dynamic Delegation Duplicate Task Cards

- Status: public-synced, merged back into private main, deployed to Mac
  production, and smoke verified.
- User issue:
  - The 星盘 06-22 source thread delegated a Moira/Home AI task and ended up
    creating three task cards for the same work.
  - The visible thread transcript showed two
    `codex_mobile.delegate_to_thread` attempts returning "dynamic tool response
    was invalid", followed by the documented fallback script path.
- Evidence:
  - Task-card store contained three approved cards for the same semantic task:
    two from the app-server dynamic tool path and one from the fallback script.
  - The 星盘 rollout recorded both dynamic tool calls as
    `function_call_output` text `"dynamic tool response was invalid"`, even
    though the cards had already been created.
- Root cause:
  - `dynamicToolTextResponse()` returned
    `result.contentItems[{ type:"inputText" }]`, which the current Codex
    app-server treated as an invalid dynamic tool response.
  - The dynamic tool body also copied `params.callId` into `requestId`; because
    call ids change on every retry, the existing task-card idempotency key could
    not collapse identical retry calls.
- Patch:
  - `server.js`
    - Dynamic tool responses now use `result.content[{ type:"text" }]`.
    - Dynamic tool requests no longer use volatile `callId` as the default
      request id.
    - Task-card idempotency now uses explicit `requestId` when supplied,
      otherwise source/target/title/body/workflow semantics. It no longer uses
      `sourceTurnId` / `turnId` as the request id seed.
  - `test/protocol.test.js`
    - Added a schema assertion for dynamic tool text responses and a guard
      against `contentItems` / `inputText`.
  - `test/thread-task-card-route.test.js`
    - Added structural guards for dynamic tool response schema and semantic
      retry idempotency.
  - Docs:
    - `README.md`
    - `docs/CROSS_THREAD_TASK_CARDS_IMPLEMENTATION.md`
- Validation:
  - `node --test test/protocol.test.js test/thread-task-card-route.test.js`
  - `node --test test/thread-task-card-service.test.js test/new-thread-route.test.js test/codex-mobile-mcp-server.test.js`
  - `npm run check`
  - `git diff --check`
  - `npm test` (`601` tests passed)
- Public/private sync:
  - Public commit:
    `4e243b6 fix: publish dynamic task card tool response`.
  - Private main merged `public/main` with:
    `c54a257 merge: sync public dynamic task card response`.
  - Public release included only publishable source/docs/tests:
    `README.md`, `docs/CROSS_THREAD_TASK_CARDS_IMPLEMENTATION.md`,
    `server.js`, `test/protocol.test.js`, and
    `test/thread-task-card-route.test.js`.
  - Public path scan rejected `.agent-context`, runtime state, uploads, logs,
    local keys, auth files, and secret-like paths.
- Production deploy:
  - Source archive: public mirror commit `4e243b6`.
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup retained at:
    `/tmp/codex-mobile-web-deploy-4e243b6-20260622T100719Z.backup.tar.gz`.
  - Deployment used the local equivalent of `scripts/deploy-macos-plugin.ps1`
    because `pwsh` was not available in the current Mac shell: git archive,
    blocked-path check, staging checks, target backup, rsync preserving runtime
    dirs, target checks, `launchctl kickstart -k
    system/com.hermesmobile.plugin.codex-mobile`, then loopback smoke.
  - Target checks:
    `npm run check`, `npm run check:macos`, and focused dynamic
    task-card/thread-card tests passed in the production target.
  - Post-restart smoke:
    `/api/public-config` returned `version=0.1.11`,
    `clientBuildId=0.1.11|codex-mobile-shell-v373`,
    `shellCacheName=codex-mobile-shell-v373`, `platform=darwin`,
    and `authRequired=true`.
  - Authenticated `/api/status` returned `ready=true`,
    `lastError=null`, and active profile `default`.
  - Production `dynamicToolTextResponse("ok")` returned
    `{"result":{"content":[{"type":"text","text":"ok"}]}}`.
  - Production `server.js` matched the public mirror copy after deploy, and
    LaunchDaemon `system/com.hermesmobile.plugin.codex-mobile` was running with
    a new PID.
- Operational note:
  - Existing already-approved duplicate cards/messages were not removed.
  - Existing active turns that already loaded old runtime instructions are not
    retroactively changed; new start/resume/turn requests use the deployed
    response schema and semantic retry idempotency.

### Follow-up schema correction

- Status: public-synced, merged back into private main, deployed to Mac
  production, and smoke verified.
- Evidence from the Home AI source thread:
  - At `2026-06-22T10:28:17Z`, Home AI called
    `codex_mobile.delegate_to_thread` for Moira and the task card was created.
  - The app-server returned `dynamic tool response was invalid`, so the source
    model used the documented fallback script and created a second card for the
    same Moira work.
  - Both cards targeted old Moira thread
    `019ec3c0-86d2-7852-a9ea-e4c703262cdc`, not current visible
    `星盘 06-22` / `019eee78-681b-7db0-b314-aafc85f624cd`.
  - The old Moira rollout did run. Turn
    `019eeedf-bcb3-75a1-a9ee-8920aaa4013a` completed at
    `2026-06-22T10:33:59Z` and deployed Moira `0.2.385`.
- Root cause update:
  - The earlier follow-up changed dynamic tool responses to
    `result.content[{ type:"text" }]`, but the current app-server still treats
    that MCP-style response shape as invalid for dynamic tools.
  - Current evidence from app-server dynamic-tool event naming indicates the
    accepted response is snake_case dynamic-tool output:
    `result.content_items[{ type:"input_text" }]`.
- Patch:
  - `server.js`
    - `dynamicToolTextResponse()` now returns
      `result.content_items[{ type:"input_text" }]`.
  - `test/protocol.test.js`
    - Asserts the snake_case schema and rejects `contentItems`, `inputText`,
      `"content":`, and `"type":"text"`.
  - `test/thread-task-card-route.test.js`
    - Structural guard updated to require `content_items` / `input_text` and
      reject the two previous invalid shapes.
  - Docs:
    - `README.md`
    - `docs/CROSS_THREAD_TASK_CARDS_IMPLEMENTATION.md`
- Validation:
  - Private workspace:
    - `node --test test/protocol.test.js test/thread-task-card-route.test.js`
    - `node --test test/protocol.test.js test/thread-task-card-route.test.js test/thread-task-card-service.test.js test/new-thread-route.test.js test/codex-mobile-mcp-server.test.js`
    - `npm run check`
    - `npm test` (`601` tests passed)
    - `git diff --check`
  - Public mirror:
    - `node --test test/protocol.test.js test/thread-task-card-route.test.js test/thread-task-card-service.test.js test/new-thread-route.test.js test/codex-mobile-mcp-server.test.js`
    - `npm run check`
    - `git diff --check`
    - Public path scan passed for the five publishable files only.
- Public/private sync:
  - Public commit:
    `f6e7c7b fix: align dynamic tool response schema`.
  - Private main merged `public/main` with:
    `c4d8616 Merge remote-tracking branch 'public/main'`.
  - Private main pushed to origin.
- Production deploy:
  - Source archive: public mirror commit `f6e7c7b`.
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup retained at:
    `/tmp/codex-mobile-web-deploy-f6e7c7b-20260622T104039Z.backup.tar.gz`.
  - Stage syntax checks passed. Focused tests in pure git archive could not run
    because archive excludes `node_modules`; the same tests passed in the public
    mirror and in the production target after sync.
  - Target checks:
    `npm run check`, `npm run check:macos`, and focused dynamic
    task-card/thread-card tests passed in the production target.
  - Production `dynamicToolTextResponse("ok")` returned
    `{"result":{"content_items":[{"type":"input_text","text":"ok"}]}}`.
  - Post-restart smoke:
    `/api/public-config` returned `version=0.1.11`,
    `clientBuildId=0.1.11|codex-mobile-shell-v373`,
    `shellCacheName=codex-mobile-shell-v373`, `platform=darwin`,
    and `authRequired=true`.
  - Authenticated `/api/status` returned `ready=true`, `lastError=null`,
    `codexProfileActiveId=default`, and `codexHomeSource=profile-store`.
  - LaunchDaemon `system/com.hermesmobile.plugin.codex-mobile` is running with
    PID `74321` after restart.
- Operational note:
  - Existing duplicate cards were not removed.
  - The old hidden/not-listable Moira thread completed the delegated work; the
    current visible `星盘 06-22` thread did not receive those Home AI cards.
  - New dynamic delegation calls should no longer report invalid solely because
    of the response schema.

### Strict task-card target resolver

- Status: public-synced, merged back into private main, deployed to Mac
  production, and smoke verified.
- Problem addressed:
  - Source-thread direct task-card creation accepted stale target thread ids
    from older rollout state or fallback scripts.
  - If a source model had an old visible-hints snapshot, it could send cards to
    an old hidden/not-current thread for the same cwd.
- Patch:
  - `server.js`
    - Source-thread task-card target resolution now uses the current visible
      non-archived, non-subagent thread list.
    - For a cwd with multiple visible/history candidates, only the latest
      visible canonical thread for that cwd is accepted.
    - Exact ids from stale state, old rollout fallback, hidden threads, archived
      threads, or non-detail-readable threads are rejected instead of falling
      through as raw target ids.
    - Rejections return structured codes:
      `stale_target_thread` (`409`) or `target_thread_not_visible` (`404`),
      with bounded `details.currentTarget` when available.
    - Dynamic tool hints now list only canonical visible targets per cwd.
    - Dynamic-tool and fallback-script error paths preserve `code` and
      `details`, so fallback callers can switch to the current target instead
      of blindly retrying the stale id.
  - `scripts/create-thread-task-card.js`
    - Usage now documents that target ids/titles must be current visible
      targets.
  - Tests:
    - `test/protocol.test.js`
    - `test/thread-task-card-route.test.js`
  - Docs:
    - `README.md`
    - `docs/CROSS_THREAD_TASK_CARDS_IMPLEMENTATION.md`
    - `docs/TROUBLESHOOTING.md`
- Validation:
  - Private workspace:
    - `npm run check`
    - `node --test test/protocol.test.js test/thread-task-card-route.test.js test/thread-task-card-service.test.js test/new-thread-route.test.js test/codex-mobile-mcp-server.test.js`
    - `git diff --check`
  - Public mirror:
    - `npm run check`
    - Same 61-test focused suite passed.
    - `npm test` passed (`602` tests).
    - `git diff --check`
    - New-change scan confirmed the regression test uses synthetic paths and
      synthetic UUID-like thread ids, not the incident's real local ids/paths.
- Public/private sync:
  - Public commit:
    `19963af fix: reject stale task card targets`.
  - Private main merged `public/main` with:
    `53c003c Merge remote-tracking branch 'public/main'`.
  - Public and private main were pushed.
  - Excluding `.agent-context`, `public/main..main` has no source diff.
- Production deploy:
  - Source archive: public mirror commit `19963af`.
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup retained at:
    `/tmp/codex-mobile-web-deploy-19963af-20260622_190326.backup.tar.gz`.
  - Staging checks passed:
    `npm run check`, `npm run check:macos`, and blocked-path scan.
  - Target checks passed after sync:
    `npm run check`, `npm run check:macos`, and the same 61-test focused
    suite.
  - Restart:
    `launchctl kickstart -k system/com.hermesmobile.plugin.codex-mobile`.
  - Post-restart smoke:
    `/api/public-config` returned HTTP `200`, `version=0.1.11`,
    `clientBuildId=0.1.11|codex-mobile-shell-v373`, and
    `authRequired=true`.
  - Authenticated `/api/status` returned HTTP `200`.
  - A no-side-effect production POST to the source-thread task-card route with
    a synthetic invisible target returned `404 target_thread_not_visible` with
    details, confirming the deployed guard is active before card persistence.
  - LaunchDaemon `system/com.hermesmobile.plugin.codex-mobile` is running after
    restart.
- Operational note:
  - This prevents new wrong-card sends through the source-thread direct path
    used by the dynamic tool and fallback script.
  - It does not delete the three duplicate cards that already existed before
    this deploy.
  - Manual pending-card APIs remain unchanged; the strict resolver applies to
    source-thread direct task-card creation.

### Usage card initial-open backfill

- Status: public-synced, merged back into private main, deployed to Mac
  production, and smoke verified.
- Problem addressed:
  - A completed thread could show no `Usage` card on the first open after the
    browser had been away, then show Usage after leaving and reopening the
    thread.
  - Production/server data for the reported Home AI turn already had
    `turnUsageSummary`; the missing card was caused by the client first-open
    detail path not scheduling the existing bounded Usage backfill when it
    rendered an older projection cache.
- Patch:
  - `public/app.js`
    - `loadThread()` now schedules `scheduleUsageBackfillRefresh()` after the
      first successful detail render, matching the post-completion and detail
      refresh backfill behavior.
    - `CLIENT_BUILD_ID` bumped to
      `0.1.11|codex-mobile-shell-v374`.
  - `public/sw.js`
    - PWA shell cache bumped to `codex-mobile-shell-v374`.
  - Tests:
    - `test/turn-scroll-controls.test.js`
    - `test/mobile-viewport.test.js`
    - `test/thread-goal-service.test.js`
    - `test/thread-task-card-route.test.js`
  - Docs:
    - `README.md`
    - `docs/TROUBLESHOOTING.md`
- Validation:
  - Private workspace:
    - `node --test test/turn-scroll-controls.test.js test/conversation-render.test.js test/mobile-viewport.test.js test/app-update.test.js`
    - `npm run check`
    - `npm run check:macos`
    - `npm test` passed (`602` tests).
    - `git diff --check`
  - Public mirror:
    - `npm run check`
    - `npm run check:macos`
    - Focused 109-test suite passed.
    - `npm test` passed (`602` tests).
    - `git diff --check`
- Public/private sync:
  - Public commit:
    `16cab26 fix: backfill usage on initial thread load`.
  - Private main merged `public/main` with:
    `f72eaee Merge remote-tracking branch 'public/main'`.
  - Public main was pushed.
  - Excluding `.agent-context`, `public/main..main` has no source diff.
- Production deploy:
  - Source archive: public mirror commit `16cab26`.
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup retained at:
    `/tmp/codex-mobile-web-deploy-16cab26-20260622T113507Z.backup.tar.gz`.
  - The first deploy attempt's blocked-path scan was overbroad and matched
    legitimate `token-usage-stats` source files; no production sync occurred in
    that attempt. A later non-sudo rsync attempt also failed on target file
    permissions before restart. Final sync used sudo rsync with production
    owner/group restored.
  - Staging checks passed:
    `npm run check`, `npm run check:macos`, blocked-path scan, and the focused
    109-test suite.
  - Target checks passed after sync:
    `npm run check`, `npm run check:macos`, and the same focused 109-test
    suite.
  - Restart:
    `launchctl kickstart -k system/com.hermesmobile.plugin.codex-mobile`.
  - Post-restart smoke:
    `/api/public-config` returned HTTP `200`, `version=0.1.11`,
    `clientBuildId=0.1.11|codex-mobile-shell-v374`,
    `shellCacheName=codex-mobile-shell-v374`, and `authRequired=true`.
  - Authenticated `/api/status` returned HTTP `200`, `ready=true`,
    `lastError=null`, `codexProfileActiveId=default`, and
    `codexHomeSource=profile-store`.
  - LaunchDaemon `system/com.hermesmobile.plugin.codex-mobile` is running after
    restart with a new PID.
- Operational note:
  - Existing open clients may still need to accept the refresh prompt or
    hard-reopen the PWA/WebView to load shell v374.
  - In-app Browser verification was attempted but the Browser MCP/Node REPL
    channel returned `sandboxCwd` metadata errors before page navigation; HTTP
    smoke and production target tests are the current verification evidence.

### v375 large-thread cold-cache fallback delay

- Status: diagnosed, public-synced, merged back into private main, deployed to
  Mac production, and smoke verified.
- User report:
  - Music is about 200 MiB and still felt slow even though thread detail should
    read only the latest 10 turns. The user suspected the immediately preceding
    update/restart might have made the issue visible.
- Production evidence:
  - Music thread id: `019ed959-27ce-7312-ba77-226ef9c526c7`.
  - Music rollout path:
    `/Users/xuxin/.codex/sessions/2026/06/18/rollout-2026-06-18T14-09-19-019ed959-27ce-7312-ba77-226ef9c526c7.jsonl`.
  - Pre-patch production detail API returned only 10 turns and about 111 KiB,
    with `mobileReadMode=projection-v4-dynamic`; repeated loopback calls were
    around `309ms`, then `33ms` and `34ms`.
  - Phone logs showed Music first paint after a cold/restart window at about
    `656ms`, later `490ms`, then `143ms`; it still returned 10 turns and
    omitted older turns.
  - The slower overlapping path was thread-list fallback, not Music detail:
    production logs showed `[thread-list] complete` around `2019ms-2341ms`,
    with `fallbackRolloutMs` around `1274ms-1400ms`, and client
    `thread_list_rendered` around `2160ms-3943ms`.
  - The update likely contributed by restarting the listener and clearing
    in-memory projection/fallback caches. The server is in-memory while
    running, but full thread-list fallback still reads disk rollout/session
    metadata after restart.
- Patch:
  - `public/app.js`
    - Added a cancellable `threadListDeferredFallbackTimer`.
    - Replaced the previous unconditional `800ms` full list fallback follow-up
      with `THREAD_LIST_DEFERRED_FALLBACK_DELAY_MS=8000`.
    - If a thread detail or another list request is active, the fallback now
      retries after `2500ms` instead of competing with first paint.
    - Any non-deferred list load clears the queued fallback timer.
    - `CLIENT_BUILD_ID` bumped to
      `0.1.11|codex-mobile-shell-v375`.
  - `public/sw.js`
    - PWA shell cache bumped to `codex-mobile-shell-v375`.
  - Tests:
    - `test/mobile-viewport.test.js`
    - `test/thread-goal-service.test.js`
    - `test/thread-task-card-route.test.js`
  - Docs:
    - `README.md`
    - `docs/ARCHITECTURE.md`
    - `docs/TROUBLESHOOTING.md`
- Validation:
  - Private workspace:
    - Focused 138-test suite passed:
      `test/mobile-viewport.test.js`, `test/app-update.test.js`,
      `test/thread-visibility.test.js`, `test/thread-goal-service.test.js`,
      `test/thread-task-card-route.test.js`, `test/conversation-render.test.js`,
      `test/turn-scroll-controls.test.js`.
    - `npm run check`
    - `npm run check:macos`
    - `npm test` passed (`602` tests).
    - `git diff --check`
    - `codegraph status` was up to date; it warned the index was built by an
      earlier engine version, but no stale edited files were reported.
  - Public mirror:
    - `npm run check`
    - `npm run check:macos`
    - Same focused 138-test suite passed.
    - `npm test` passed (`602` tests).
    - `git diff --check`
  - Staging archive from public commit:
    - Blocked-path scan was clean for `.agent-context`, runtime data/logs,
      uploads, env files, access-key, private-key, and secret patterns. The
      scan intentionally did not block legitimate token-usage source filenames.
    - `npm run check`
    - `npm run check:macos`
    - Same focused 138-test suite passed.
  - Production target after sync:
    - `npm run check`
    - `npm run check:macos`
    - Same focused 138-test suite passed.
- Public/private sync:
  - Public commit:
    `e53036c fix: delay full thread-list fallback`.
  - Public main was pushed to
    `git@github.com:pentiumxp/codex-mobile-web-public.git`.
  - Private main merged `public/main` with:
    `c32db44 Merge remote-tracking branch 'public/main'`.
- Production deploy:
  - Source archive: public mirror commit `e53036c`.
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup retained at:
    `/tmp/codex-mobile-web-deploy-e53036c-20260622T114509Z.backup.tar.gz`.
  - Sync used sudo `rsync` and preserved `data/`, `logs/`, `node_modules/`,
    `uploads/`, `.git/`, `.agent-context/`, and `AGENTS.md`; target ownership
    was restored to `hermes-host:staff`.
  - Restart:
    `launchctl kickstart -k system/com.hermesmobile.plugin.codex-mobile`.
  - Post-restart smoke:
    - `/api/public-config` returned
      `clientBuildId=0.1.11|codex-mobile-shell-v375` and
      `shellCacheName=codex-mobile-shell-v375`.
    - LaunchDaemon `system/com.hermesmobile.plugin.codex-mobile` is running
      with PID `25816`, `runs=11`, and last exit code `0`.
    - Authenticated `/api/status` returned HTTP `200`, `ready=true`.
    - Authenticated Music recent detail calls returned HTTP `200`, about
      `83275` bytes, `10` turns, `mobileReadMode=projection-v4-cache`,
      `status=idle`, `mobileOmittedTurnCount=234`,
      `rolloutSizeBytes=218711473`, and an older cursor. Timings were
      `297ms`, `30ms`, and `28ms`.
    - Served `app.js` contains shell v375, `8000ms` fallback delay,
      `2500ms` retry, mobile-loading retry guard, and non-defer timer clearing.
- Operational note:
  - This does not remove the full fallback scan. It makes the scan delayed and
    cancellable so it does not normally compete with thread first paint.
  - Existing open clients may need to accept the refresh prompt or reopen the
    WebView/PWA to run v375 client code.

### Local turn-start active status broadcast

- Status: diagnosed, public-synced before the new release-order rule was
  recorded, merged back into private main, deployed to Mac production, and
  smoke verified.
- User report:
  - A turn could already be started, but the thread list was not notified and
    did not show the thread as started.
  - The same symptom applied to automatic/source-direct task cards sent from
    other threads.
- Root cause:
  - The server already derived `thread/status/changed` from raw app-server
    `turn/started` notifications.
  - Several Mobile Web-owned local `turn/start` success paths did not
    immediately broadcast the active summary. They relied on later raw
    notifications or full list refreshes, which could leave background or
    target threads appearing idle for too long.
- Patch:
  - `server.js`
    - Added `notifyLocalTurnStarted(threadId, result, meta)` to update thread
      detail projection and broadcast `thread/status/changed` with
      `status.type=active` immediately after local `turn/start` success.
    - Wired the helper into message submit, new-thread first turn,
      continuation handoff/bootstrap, source-direct and automatic task-card
      execution, task-card approval execution, auto-turn recovery,
      ChatGPT Pro bridge starts, and main-thread side-chat candidate apply.
    - Kept raw app-server notification handling unchanged; duplicate active
      summaries are idempotent.
  - `test/thread-task-card-route.test.js`
    - Updated the task-card path assertion to use the unified helper.
    - Added coverage that verifies local turn-start success updates projection
      and broadcasts active status for all wired sources.
  - Docs:
    - `README.md`
    - `docs/ARCHITECTURE.md`
    - `docs/TROUBLESHOOTING.md`
- Validation:
  - Private workspace:
    - Focused 153-test suite passed:
      `test/thread-task-card-route.test.js`,
      `test/thread-task-card-service.test.js`,
      `test/new-thread-route.test.js`, `test/thread-visibility.test.js`,
      `test/conversation-render.test.js`, and
      `test/mobile-viewport.test.js`.
    - `npm run check`
    - `npm run check:macos`
    - `npm test` passed (`603` tests).
    - `git diff --check`
    - `codegraph status` was up to date; it warned the index was built by an
      earlier engine version, but no stale edited files were reported.
  - Public mirror:
    - `npm run check`
    - `npm run check:macos`
    - Same focused 153-test suite passed.
    - `npm test` passed (`603` tests).
    - `git diff --check`
  - Staging archive from public commit:
    - Blocked-path scan was clean for `.agent-context`, runtime data/logs,
      uploads, env files, access-key, private-key, and secret patterns.
    - `npm run check`
    - `npm run check:macos`
    - Same focused 153-test suite passed.
  - Production target after sync:
    - `npm run check`
    - `npm run check:macos`
    - Same focused 153-test suite passed.
- Public/private sync:
  - Public commit:
    `55f5d30998ec1d1a7886cf293e78804e28dedaa8 fix: broadcast local turn starts`.
  - Public main was pushed to
    `git@github.com:pentiumxp/codex-mobile-web-public.git` before the user
    recorded the new rule that future work must deploy and test before pushing
    public.
  - Private main merged `public/main` with:
    `39a34266990e93c4dd11376186c1c18f2e772aad Merge remote-tracking branch 'public/main'`.
- Production deploy:
  - Source archive: public mirror commit `55f5d30`.
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup retained at:
    `/tmp/codex-mobile-web-deploy-55f5d30-20260622T132508Z.backup.tar.gz`.
  - Sync used sudo `rsync` and preserved `data/`, `logs/`, `node_modules/`,
    `uploads/`, `.git/`, `.agent-context/`, and `AGENTS.md`; target ownership
    was restored to `hermes-host:staff`.
  - Restart:
    `launchctl kickstart -k system/com.hermesmobile.plugin.codex-mobile`.
  - Post-restart smoke:
    - `/api/public-config` returned
      `clientBuildId=0.1.11|codex-mobile-shell-v375`,
      `shellCacheName=codex-mobile-shell-v375`, and `authRequired=true`.
    - LaunchDaemon `system/com.hermesmobile.plugin.codex-mobile` is running
      with PID `60923`, `runs=12`, and last exit code `0`.
    - Authenticated `/api/status` returned HTTP `200`, `ready=true`, and
      `lastError=null`.
    - Production `server.js` contains `notifyLocalTurnStarted` and the expected
      source wiring for task cards, message submit, auto-recovery, and active
      status broadcast.
- Operational notes:
  - This is a server-only fix; there is no PWA cache bump and existing clients
    do not need a shell refresh for the broadcast behavior.
  - No real production test turn was started during smoke verification, to
    avoid mutating a live thread.
  - Future release order is now: local/private implementation and validation,
    deploy to Mac production, user/production test confirmation, then public
    push. Before that confirmation, at most create a local/private commit.

### Local active-status overlay for turn-start regression

- Status: implemented in private workspace, deployed to Mac production, smoke
  verified, not pushed to public.
- User report:
  - After the prior local turn-start broadcast fix, Home AI became worse:
    exiting to the thread list did not show the started/running marker, and
    entering the thread then returning no longer refreshed the marker.
- Production evidence before fix:
  - Home AI thread id:
    `019eed86-2002-7cc2-b0b7-937eb5355f36`.
  - A user send created turn
    `019eef85-b5b3-7741-81c0-ce061bc324af`.
  - Rollout showed `task_started` at `2026-06-22T13:29:37.972Z` and
    `task_complete` at `2026-06-22T13:29:57.183Z`.
  - During that active window, `/api/threads/:id` and thread-list refreshes
    could still log/return `status=idle` from `state-db+app-server`, so the
    broadcast-only fix was being overwritten by later summary synthesis.
- Root cause:
  - `notifyLocalTurnStarted()` broadcast `thread/status/changed active` and
    updated detail projection, but `/api/threads` and `/api/threads/:id`
    had no server-side queryable active state to merge after state-db/app-server
    summaries.
  - A list/detail refresh could immediately recompute and cache an idle row,
    erasing the browser's running marker.
- Patch:
  - `server.js`
    - Added bounded in-memory `localActiveThreadStatuses`.
    - `notifyLocalTurnStarted()` records an active overlay after local
      `turn/start` success.
    - Raw `turn/started` notifications also record the overlay; raw
      `turn/completed` clears it.
    - List/detail summary synthesis applies the overlay after stale-active
      normalization through `normalizeThreadSummaryLiveStatus()` and
      `applyLocalActiveThreadStatusToSummary()`.
    - The overlay clears when a later rollout-tail terminal event such as
      `task_complete` is seen, or when its TTL expires.
  - Tests:
    - `test/thread-visibility.test.js`
      - Added behavior coverage that local active overlay keeps rows active
        over immediate app-server idle summaries.
      - Added behavior coverage that a later rollout terminal event clears the
        overlay.
    - `test/thread-task-card-route.test.js`
      - Added structural coverage for active overlay wiring.
  - Docs:
    - `README.md`
    - `docs/ARCHITECTURE.md`
    - `docs/TROUBLESHOOTING.md`
- Validation:
  - Private workspace:
    - Focused 155-test suite passed:
      `test/thread-visibility.test.js`,
      `test/thread-task-card-route.test.js`,
      `test/thread-task-card-service.test.js`, `test/new-thread-route.test.js`,
      `test/conversation-render.test.js`, and
      `test/mobile-viewport.test.js`.
    - `npm run check`
    - `npm run check:macos`
    - `npm test` passed (`605` tests).
    - `git diff --check`
    - `codegraph status` was up to date; it warned the index was built by an
      earlier engine version.
  - Staging:
    - Source staged from the private working tree, not the public mirror:
      `/tmp/codex-mobile-web-stage-local-active.mgSn4Q`.
    - Blocked-path scan was clean for `.agent-context`, runtime data/logs,
      uploads, env files, access-key, private-key, and secret path patterns.
    - `npm run check`
    - `npm run check:macos`
    - Focused 155-test suite passed with `NODE_PATH` pointed at the local
      workspace `node_modules`; the clean staging source intentionally omits
      `node_modules`, while production preserves the target dependency tree.
  - Production target after sync:
    - `npm run check`
    - `npm run check:macos`
    - Same focused 155-test suite passed.
- Production deploy:
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup retained at:
    `/tmp/codex-mobile-web-deploy-local-active-20260622T134437Z.backup.tar.gz`.
  - Sync used sudo `rsync` from private staging and preserved `data/`, `logs/`,
    `node_modules/`, `uploads/`, `.git/`, `.agent-context/`, and `AGENTS.md`;
    target ownership was restored to `hermes-host:staff`.
  - Restart:
    `launchctl kickstart -k system/com.hermesmobile.plugin.codex-mobile`.
  - Post-restart smoke:
    - LaunchDaemon `system/com.hermesmobile.plugin.codex-mobile` is running
      with PID `87711`, `runs=13`, and last exit code `0`.
    - `/api/public-config` returned HTTP `200`,
      `clientBuildId=0.1.11|codex-mobile-shell-v375`,
      `shellCacheName=codex-mobile-shell-v375`, and `authRequired=true`.
    - Authenticated `/api/status` returned HTTP `200`, `ready=true`,
      `lastError=null`, `transport=external-jsonl-tcp`,
      `codexProfileActiveId=default`, and `codexHomeSource=profile-store`.
    - Production `server.js` contains the active overlay map, remember/apply
      helpers, notification update hook, list/detail overlay hooks, and
      rollout-terminal clearing logic.
    - A later user Home AI send created turn
      `019eef94-4e55-7e11-877e-e8eb1f1c2288`; production logs showed
      `summary_ready status=active` during the active window after local
      `turn/start`. The rollout then showed `task_complete` at
      `2026-06-22T13:45:44.957Z`, after which `/api/threads` and
      `/api/threads/:id` correctly returned `idle` with no
      `mobileLocalActiveStatus`.
- Operational notes:
  - This is server-only; no PWA cache bump.
  - This has not been pushed to public. Follow the release-order rule: wait for
    production/user confirmation before any public sync/push.

## 2026-06-24 - Phase 1 architecture refactor: task-card target routing service

- User goal:
  - Execute the Codex Mobile Web system-level refactor in phases.
  - Keep this in development validation until all phases are complete and
    verified; do not deploy from this phase alone.
  - Follow Home AI central platform/root-cause/fallback governance: prefer
    root-cause closure, avoid broad fallbacks, and document durable ownership.
- Phase 1 scope:
  - Extract cross-thread task-card target routing and deliverability rules from
    `server.js` into `adapters/thread-task-card-routing-service.js`.
  - Keep `server.js` as HTTP/app-server composition glue with thin wrappers so
    existing routes, dynamic tool handling, MCP/CLI fallback, and tests keep
    the same public function names.
  - No fallback behavior was added.
- Changed files:
  - `adapters/thread-task-card-routing-service.js`
  - `server.js`
  - `test/thread-task-card-routing-service.test.js`
  - `test/thread-task-card-route.test.js`
  - `package.json`
  - `docs/MODULES.md`
  - `docs/ARCHITECTURE.md`
  - `docs/COMPLEX_FEATURE_PATHS.md`
- Validation:
  - Focused task-card and related suites passed: `159` tests across
    `test/thread-task-card-routing-service.test.js`,
    `test/protocol.test.js`, `test/thread-task-card-route.test.js`,
    `test/thread-task-card-service.test.js`,
    `test/thread-task-card-harness.test.js`,
    `test/conversation-render.test.js`, and
    `test/workspace-source-write-guard-service.test.js`.
  - `npm run check`
  - `npm test` passed (`668` tests).
  - `npm run check:macos`
  - `git diff --check`
  - Home AI central checker:
    `node scripts/plugin-workspace-platform-contract-check.js --plugin codex-mobile --json`
    returned `ok: true`; existing warning: `handoff_pointer_missing`.
  - `codegraph sync && codegraph status` reported the index is up to date; it
    still warns the index was built by an earlier engine version.
- Deployment status:
  - Not deployed.
  - Not pushed to public.
  - This is one completed development phase, not completion of the full
    system-level refactor objective.

## 2026-06-24 - Phase 2 architecture refactor: thread turn compaction policy

- User goal:
  - Continue the phased Codex Mobile Web system-level refactor in development.
  - Prefer central-contract/root-cause closure over broad fallbacks.
  - Keep work effective and bounded; no deployment until all requested phases
    are complete and verified.
- Phase 2 scope:
  - Extract pure thread-detail turn compaction policy from `server.js` into
    `adapters/thread-turn-compaction-policy-service.js`.
  - Covered policies:
    - trailing operation retention;
    - receipt-only item index selection;
    - ended-turn and visible non-live turn discovery;
    - operation-detail turn selection for live/resting detail windows.
  - `server.js` still composes rollout, image, Usage, pending echo, stale
    active, and raw-operation fallback enrichment.
  - No fallback behavior was added.
- Changed files:
  - `adapters/thread-turn-compaction-policy-service.js`
  - `server.js`
  - `test/thread-turn-compaction-policy-service.test.js`
  - `package.json`
  - `docs/MODULES.md`
  - `docs/ARCHITECTURE.md`
  - `docs/COMPLEX_FEATURE_PATHS.md`
- Validation:
  - Focused thread-detail/render/projection/Usage suites passed: `154` tests
    across `test/thread-turn-compaction-policy-service.test.js`,
    `test/thread-item-timestamp-enrichment.test.js`,
    `test/conversation-render.test.js`,
    `test/thread-detail-projection-service.test.js`,
    `test/thread-visible-item-normalizer.test.js`,
    `test/thread-detail-projection-v4-service.test.js`,
    `test/turn-scroll-controls.test.js`, and
    `test/turn-usage-summary-service.test.js`.
  - `npm run check`
  - `npm test` passed (`674` tests).
  - `npm run check:macos`
  - `git diff --check`
  - Home AI central checker:
    `node scripts/plugin-workspace-platform-contract-check.js --plugin codex-mobile --json`
    returned `ok: true`; existing warning: `handoff_pointer_missing`.
  - `codegraph sync && codegraph status` reported the index is up to date; it
    still warns the index was built by an earlier engine version.
- Deployment status:
  - Not deployed.
  - Not pushed to public.
  - This is a second completed development phase, not completion of the full
    system-level refactor objective.

## 2026-06-24 - Phase 5 architecture refactor: thread-list fallback cache policy

- User goal:
  - Continue the phased Codex Mobile Web system-level refactor in development.
  - Keep the memory/cache work tied to a real user problem: slow thread-list
    fallback scans and accidental cache rebuilds.
  - Do not deploy or push public until all requested phases are complete and
    verified.
- Phase 5 scope:
  - Extract thread-list fallback cache policy from `server.js` into
    `adapters/thread-list-fallback-cache-service.js`.
  - Covered cache behavior:
    - stable cache-key construction from visible workspace roots, projectless
      thread ids, cwd, search, and bounded limit;
    - process-lifetime default retention (`ttlMs=0`) with opt-in TTL expiry;
    - cache-hit diagnostics and source timing preservation;
    - first-run fallback aggregation from injected state-db, rollout-session,
      and session-index providers;
    - incremental status/title/archive mutations without forcing full fallback
      scanner rebuilds.
  - `server.js` still owns app-server route sequencing, visibility helpers, and
    state-db/rollout/session-index scanner implementations.
  - No timer-based rebuild or broad fallback behavior was added.
- Changed files:
  - `adapters/thread-list-fallback-cache-service.js`
  - `server.js`
  - `test/thread-list-fallback-cache-service.test.js`
  - `test/thread-visibility.test.js`
  - `package.json`
  - `docs/MODULES.md`
  - `docs/ARCHITECTURE.md`
  - `docs/COMPLEX_FEATURE_PATHS.md`
- Validation:
  - Focused fallback/list suites passed: `44` tests across
    `test/thread-list-fallback-cache-service.test.js` and
    `test/thread-visibility.test.js`.
  - Focused projection/list/render suites passed: `157` tests across
    `test/thread-list-fallback-cache-service.test.js`,
    `test/thread-visibility.test.js`,
    `test/thread-detail-projection-result-service.test.js`,
    `test/thread-detail-projection-input-service.test.js`,
    `test/thread-detail-projection-service.test.js`,
    `test/thread-detail-projection-v4-service.test.js`, and
    `test/conversation-render.test.js`.
  - `npm run check`
  - `npm test` passed (`686` tests).
  - `npm run check:macos`
  - `git diff --check`
  - Home AI central checker:
    `node scripts/plugin-workspace-platform-contract-check.js --plugin codex-mobile --json`
    returned `ok: true`; existing warning: `handoff_pointer_missing`.
  - `codegraph sync && codegraph status` reported the index is up to date; it
    still warns the index was built by an earlier engine version.
- Deployment status:
  - Not deployed.
  - Not pushed to public.
  - This is a fifth development phase, not completion of the full
    system-level refactor objective.

## 2026-06-24 - Phase 4 architecture refactor: projection-hit result assembly contract

- User goal:
  - Continue the phased Codex Mobile Web system-level refactor in development.
  - Keep each step tied to a real architecture boundary, with root-cause
    closure and central-contract discipline.
  - Do not deploy or push public until all requested phases are complete and
    verified.
- Phase 4 scope:
  - Extract projection-hit thread-detail result assembly from `server.js` into
    `adapters/thread-detail-projection-result-service.js`.
  - Covered result fields:
    - cached projection thread merged with display summary data;
    - session-index title hydration;
    - runtime model/effort decoration from state-db summary;
    - stale/live status normalization;
    - public runtime settings;
    - projection read mode and `mobileProjection` metadata, including cache vs
      dynamic source, v4 mode, timestamps, and age.
  - `server.js` still owns route sequencing, hidden-thread checks, projection
    cache get/seed calls, and fallback reads.
  - No new fallback or UI-only masking behavior was added.
- Changed files:
  - `adapters/thread-detail-projection-result-service.js`
  - `server.js`
  - `test/thread-detail-projection-result-service.test.js`
  - `package.json`
  - `docs/MODULES.md`
  - `docs/ARCHITECTURE.md`
  - `docs/COMPLEX_FEATURE_PATHS.md`
- Validation:
  - Focused unit test passed:
    `node --test test/thread-detail-projection-result-service.test.js`
    (`3` tests).
  - Focused thread-detail/render/projection/visibility suites passed: `152`
    tests across `test/thread-detail-projection-result-service.test.js`,
    `test/thread-detail-projection-input-service.test.js`,
    `test/thread-detail-projection-service.test.js`,
    `test/thread-detail-projection-v4-service.test.js`,
    `test/thread-visibility.test.js`, and
    `test/conversation-render.test.js`.
  - `npm run check`
  - `npm test` passed (`681` tests).
  - `npm run check:macos`
  - `git diff --check`
  - Home AI central checker:
    `node scripts/plugin-workspace-platform-contract-check.js --plugin codex-mobile --json`
    returned `ok: true`; existing warning: `handoff_pointer_missing`.
  - `codegraph sync && codegraph status` reported the index is up to date; it
    still warns the index was built by an earlier engine version.
- Deployment status:
  - Not deployed.
  - Not pushed to public.
  - This is a fourth development phase, not completion of the full
    system-level refactor objective.

## 2026-06-24 - Phase 3 architecture refactor: projection cache input contract

- User goal:
  - Continue the phased Codex Mobile Web system-level refactor in development.
  - Focus on effective structural optimization around thread-detail projection
    and memory/cache rebuild behavior.
  - Do not deploy until all requested phases are complete and verified.
- Phase 3 scope:
  - Extract thread-detail projection cache-signature input construction from
    `server.js` into `adapters/thread-detail-projection-input-service.js`.
  - Covered input fields:
    - thread id;
    - rollout path aliases (`path`, `rolloutPath`, `rollout_path`);
    - rollout stats provider output;
    - retained turn window (`maxTurns`);
    - summary updated timestamp;
    - summary status.
  - `server.js` still owns route sequencing and the projection services still
    own memory/disk storage, cache comparison, miss, and reseed behavior.
  - No cache policy fallback or behavioral shortcut was added.
- Changed files:
  - `adapters/thread-detail-projection-input-service.js`
  - `server.js`
  - `test/thread-detail-projection-input-service.test.js`
  - `package.json`
  - `docs/MODULES.md`
  - `docs/ARCHITECTURE.md`
  - `docs/COMPLEX_FEATURE_PATHS.md`
- Validation:
  - Focused projection/detail/visibility suites passed: `170` tests across
    `test/thread-detail-projection-input-service.test.js`,
    `test/thread-detail-projection-service.test.js`,
    `test/thread-detail-projection-v4-service.test.js`,
    `test/thread-item-timestamp-enrichment.test.js`,
    `test/conversation-render.test.js`, and
    `test/thread-visibility.test.js`.
  - `npm run check`
  - `npm test` passed (`678` tests).
  - `npm run check:macos`
  - `git diff --check`
  - Home AI central checker:
    `node scripts/plugin-workspace-platform-contract-check.js --plugin codex-mobile --json`
    returned `ok: true`; existing warning: `handoff_pointer_missing`.
  - `codegraph sync && codegraph status` reported the index is up to date; it
    still warns the index was built by an earlier engine version.
- Deployment status:
  - Not deployed.
  - Not pushed to public.
  - This is a third completed development phase, not completion of the full
    system-level refactor objective.

## 2026-06-23 - System/assistant image output media contract fix

- User-facing symptom:
  - User-uploaded images rendered in the Home AI embedded Codex Mobile view,
    but system/assistant `Image` outputs could render as a broken-image box
    with only a filename caption.
- Failing layer:
  - Codex Mobile server image projection/media normalization.
  - User-upload serving through `/api/uploads/file` was not the broken layer.
- Root cause:
  - The generated-image cache path only treated `path`, `filePath`,
    `imagePath`, `savedPath`, and related fields as source files.
  - Assistant/system image items can carry local image files in `url`,
    `imageUrl`, `image_url`, or `file://` fields. Those fields were not copied
    into the runtime generated-image cache, so the client could receive a raw
    local path or a bare filename and create an `<img src>` the WebView could
    not fetch.
- Change:
  - `adapters/generated-image-cache-service.js`
    - Extracts local filesystem image sources from `url`, `imageUrl`,
      `image_url`, and `file://` values while ignoring already-safe browser
      routes such as `/api/generated-images/file`.
  - `server.js`
    - Normalizes assistant/system image sources into
      `/api/generated-images/file?id=...`.
    - Removes raw local path, `file://`, data URL, and unservable bare-image
      filename source fields from compacted image items after caching.
    - Marks missing/unresolvable image sources as
      `generatedImage.unavailable` with `reason=source_unavailable` instead of
      letting the browser render a broken `<img>`.
  - `public/app.js`
    - Renders `generatedImage.unavailable` items with the existing neutral
      `image-load-failed` card and no `<img src>`.
  - `public/sw.js` / `public/app.js`
    - Shell cache/build bumped to `codex-mobile-shell-v384`.
- Tests:
  - Added assistant/system-specific coverage in:
    - `test/generated-image-cache-service.test.js`
    - `test/tool-output-image-projection.test.js`
    - `test/conversation-render.test.js`
  - Updated shell version assertions in:
    - `test/mobile-viewport.test.js`
    - `test/thread-goal-service.test.js`
    - `test/thread-task-card-route.test.js`
- Validation before deploy:
  - Minimal pre-fix reproduction showed an `imageView` item with local image
    source in `url` extracted no source path and did not cache.
  - `node --test test/generated-image-cache-service.test.js
    test/tool-output-image-projection.test.js test/conversation-render.test.js
    test/file-preview-ui.test.js`
  - `npm run check`
  - `node --test test/generated-image-cache-service.test.js
    test/tool-output-image-projection.test.js test/conversation-render.test.js
    test/file-preview-ui.test.js test/mobile-viewport.test.js
    test/thread-goal-service.test.js test/thread-task-card-route.test.js`
  - `npm run check:macos`
  - `git diff --check`
  - `npm test` passed (`632` tests).
- Deployment status:
  - Deployed from private commit `de2f34867944`.
  - Command:
    `npm run --silent deploy:macos -- --target plugin:codex-mobile-web
    --execute --reason codex-mobile-system-image-render-v384 --json`
  - Target:
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260623T104755Z-plugin-codex-mobile-web-codex-mobile-system-image-render-v384`.
  - Deploy validation passed:
    - dirty-source protection clean after local commit;
    - LaunchDaemon `system/com.hermesmobile.plugin.codex-mobile` running;
    - plugin manifest health URL returned HTTP 200;
    - profile audit reported no blocking issues.
  - Runtime verification after deploy:
    - `/api/public-config` returned HTTP 200 with
      `clientBuildId=0.1.11|codex-mobile-shell-v384` and
      `shellCacheName=codex-mobile-shell-v384`.
    - Authenticated `/api/status` returned HTTP 200 and `ready=true`.
    - A production `compactThread` verification item with assistant
      `image_url=<local temp png>` produced
      `/api/generated-images/file?id=<cache-id>`, removed the raw local source
      from the item, and `/api/generated-images/file` returned HTTP 200 with
      `Content-Type: image/png`.
    - A known user upload still served through `/api/uploads/file?id=<upload-id>`
      with HTTP 200 and `Content-Type: image/jpeg`.
    - `/?embed=hermes` returned HTTP 200 and CSP frame ancestors included the
      Home AI origins.
    - Served `app.js` contains
      `CLIENT_BUILD_ID = "0.1.11|codex-mobile-shell-v384"` and
      `isImageViewUnavailable`.
  - Browser/DOM limitation:
    - Browser MCP initialization failed before code execution with
      `sandboxCwd must be an absolute file URI`.
    - Local Playwright, Puppeteer, and Chromium were not installed, so this
      handoff records HTTP/media-route verification rather than a live DOM
      screenshot from the embedded WebView.
- Public status:
  - Not pushed to public. Follow the project rule: deploy and validate first,
    then push public only after explicit user instruction.

## 2026-06-23 - Public sync after thread state consistency repairs

- User requested pushing the already production-validated thread state fixes to
  public, then clarified that public README entries must be detailed Chinese
  explanations.
- Local private commits before public sync:
  - `443e8ea fix: reconcile thread runtime state ownership`
  - `d378c60 fix: include rollout eof completions in recent detail`
  - `c22c9bc docs: expand chinese public release notes`
- Public-safe publication:
  - Created a temporary public worktree from `public/main`, copied only
    publishable files from private `main`, and committed:
    `c5a4ee6 fix: publish thread state consistency repairs`.
  - Pushed `c5a4ee6` to `public/main`.
  - The public commit intentionally deletes previously tracked
    `.agent-context/HANDOFF.md` and `.agent-context/PROJECT_CONTEXT.md` from
    the public tree. Private `main` keeps those files.
  - Public worktree validation passed:
    - `npm run check`
    - `npm run check:macos`
    - `git diff --check`
    - Focused 160-test suite with private workspace `node_modules`.
    - Sensitive-pattern scan found only README placeholder examples, not real
      keys.
  - Private `main` merged `public/main` back and resolved the expected
    `.agent-context` modify/delete conflict by keeping private context files.

## 2026-06-23 - v381 live/detail merge item-order fix deployed

- Symptom:
  - During an active Home AI thread, the initial `You` message could appear
    below newer Codex receipt cards, disappear when a new receipt streamed, and
    reappear after a later refresh.
- Failing layer:
  - Frontend live/detail merge layer in `public/app.js`.
- Owning workspace:
  - Codex Mobile Web plugin workspace.
- Violated invariant:
  - Detail/projection refresh item order is the authority for a turn. SSE/live
    incremental append may add or update items, but it must not keep a local
    transient item position after a refresh has returned the same item in its
    canonical order.
- Root cause:
  - `mergeItemsPreservingLocalVisible()` iterated `existingItems` first and
    merged matching incoming items into the existing local order.
  - If a live SSE event had appended a durable `userMessage` at the tail of a
    running turn, a later refresh containing the same item at the canonical
    beginning of the turn still preserved the tail position.
  - That made the already-answered initial prompt render below later assistant
    receipts until another render path temporarily rebuilt the turn.
- Change:
  - `mergeItemsPreservingLocalVisible()` now iterates `incomingItems` first,
    using refresh/projection order as authority.
  - Matching existing items still preserve richer local visible fields when
    appropriate, such as longer streamed agent text, but cannot override the
    incoming item order.
  - Truly local-only pending/overlay items are inserted back near matched
    existing anchors instead of globally overriding refresh order.
  - Removed the old `hasMatchingIncomingVisibleItem()` helper so the previous
    existing-first fallback path cannot be reintroduced accidentally.
  - Bumped frontend shell cache from `codex-mobile-shell-v380` to
    `codex-mobile-shell-v381`.
- Tests:
  - Added `test/conversation-render.test.js` coverage for:
    - durable user message appended locally at the tail is moved back to the
      incoming refresh order;
    - v4 projection merge corrects local SSE user-message order;
    - longer local agent text remains preserved while order follows incoming.
  - Updated version assertions in:
    - `test/mobile-viewport.test.js`
    - `test/thread-goal-service.test.js`
    - `test/thread-task-card-route.test.js`
- Validation:
  - Private workspace:
    - Focused 150-test suite passed:
      `test/conversation-render.test.js`,
      `test/thread-detail-projection-service.test.js`,
      `test/thread-detail-projection-v4-service.test.js`,
      `test/thread-visibility.test.js`,
      `test/mobile-viewport.test.js`,
      `test/thread-goal-service.test.js`, and
      `test/thread-task-card-route.test.js`.
    - `npm run check`
    - `npm run check:macos`
    - `git diff --check`
    - `npm test` passed (`625` tests).
  - Production deploy:
    - Commit deployed: `5933772 fix: preserve projection item order during live merges`.
    - Deploy harness:
      `npm run --silent deploy:macos -- --target plugin:codex-mobile-web --execute --reason codex-mobile-live-merge-order-v381 --json`.
    - Production target:
      `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
    - Backup:
      `/Users/hermes-host/HermesMobile/backups/deploy/20260623T101842Z-plugin-codex-mobile-web-codex-mobile-live-merge-order-v381`.
    - Deploy validation passed: log permissions repair, shared auth permission
      repair, file hashes, LaunchDaemon print, Hermes plugin manifest health,
      and codex auth profile audit.
    - Runtime smoke:
      `/api/public-config` returned HTTP `200`,
      `clientBuildId=0.1.11|codex-mobile-shell-v381`,
      `shellCacheName=codex-mobile-shell-v381`, and `authRequired=true`.
      Authenticated `/api/status` returned HTTP `200`, `ready=true`,
      `transport=external-jsonl-tcp`, and
      `codexHome=/Users/xuxin/.codex-homes/previous`.
      Served `/app.js` and `/sw.js` both contain `codex-mobile-shell-v381`.
    - Production focused 150-test suite passed in
      `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
- Operational notes:
  - This is deployed to Mac production.
  - This has not been pushed to public. Follow the release-order rule and wait
    for user confirmation before a public sync.
  - The in-app Browser tool was not available in this session; validation used
    production HTTP/runtime checks and the production focused test suite.

## 2026-06-22 - Foreground resume final receipt fix v376 deployed

- Root cause:
  - Production server detail for Home AI thread
    `019eed86-2002-7cc2-b0b7-937eb5355f36` already returned the normal final
    receipt and Usage in stable `projection-v4-cache` responses.
  - The first foreground/open path could keep stale `state.currentThread`
    because `resumeMobileSession()` skipped current-thread detail refresh when
    the thread was idle/completed. Logs showed
    `mobile_resume_thread_refresh_skipped` for the Home AI thread.
  - Exiting to the thread list and entering again forced a fresh detail fetch,
    which explained why the final receipt appeared on the second entry.
- Change:
  - `public/app.js` bumped `CLIENT_BUILD_ID` to
    `0.1.11|codex-mobile-shell-v376`.
  - Foreground resume now schedules or runs a bounded current-thread detail
    refresh instead of skipping idle/completed threads.
  - Running/active threads still use the existing short delayed refresh path;
    idle/completed threads refresh directly.
  - `public/sw.js` bumped the shell cache to `codex-mobile-shell-v376`.
- Tests/docs:
  - Updated mobile viewport/task-card/goal tests for the v376 build id and
    resume-refresh behavior.
  - Updated `README.md` and `docs/TROUBLESHOOTING.md` with the final-receipt
    foreground refresh diagnosis.
- Validation:
  - Private workspace:
    - `node --check public/app.js public/sw.js server.js`
    - Focused 94-test suite passed:
      `test/mobile-viewport.test.js`, `test/conversation-render.test.js`,
      `test/thread-task-card-route.test.js`, and
      `test/thread-goal-service.test.js`.
    - `npm run check`
    - `npm run check:macos`
    - `git diff --check`
    - `npm test` passed (`608` tests).
  - Staging:
    - Source staged at:
      `/tmp/codex-mobile-web-stage-resume-refresh.93d0z1`.
    - Staging excluded `.git`, `.agent-context`, `.codegraph`,
      `node_modules`, `data`, `logs`, `uploads`, env files, and machine local
      runtime state.
    - Narrow secret scan passed for private-key and raw-secret assignment
      patterns.
    - `npm run check`
    - `npm run check:macos`
    - Same focused 94-test suite passed with `NODE_PATH` pointed at private
      workspace dependencies.
  - Production target after sync:
    - `npm run check`
    - `npm run check:macos`
    - Same focused 94-test suite passed with `NODE_PATH` pointed at production
      dependencies.
- Production deploy:
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup retained at:
    `/tmp/codex-mobile-web-deploy-resume-refresh-20260622T144855Z.backup.tar.gz`.
  - Sync used sudo `rsync` from private staging and preserved `data/`, `logs/`,
    `node_modules/`, `uploads/`, `.git/`, `.agent-context`, env files, and
    machine-specific runtime state.
  - Restart:
    `launchctl kickstart -k system/com.hermesmobile.plugin.codex-mobile`.
  - Post-restart smoke:
    - LaunchDaemon `system/com.hermesmobile.plugin.codex-mobile` is running
      with PID `77209`, `runs=17`, and last exit code `0`.
    - `/api/public-config` returned HTTP `200`,
      `clientBuildId=0.1.11|codex-mobile-shell-v376`,
      `shellCacheName=codex-mobile-shell-v376`, and `authRequired=true`.
    - Authenticated `/api/status` returned HTTP `200`, `ready=true`, and
      `transport=external-jsonl-tcp`.
    - Home AI thread `019eed86-2002-7cc2-b0b7-937eb5355f36` recent detail
      returned `projection-v4-cache`, 10 turns, latest completed turn
      `019eefb8-f6dc-7a91-a634-75fc2c3726f7`, agent receipt count `19`, last
      agent text length `479`, usage count `1`, and synthetic final receipt
      count `0`.
- Operational notes:
  - This is deployed to Mac production and requires the client to load the
    v376 shell/cache to exercise the fix.
  - This has not been pushed to public. Follow the release-order rule: deploy
    and validate before any public sync/push.

## 2026-06-22 - Final receipt fallback v2 deployed

- User-observed correction:
  - The first response could briefly show the final receipt, then a follow-up
    detail refresh/projection result removed it. Re-entering the same thread
    made it stable.
- Root cause:
  - The first fallback only checked whether the completed turn had any
    assistant/plan item.
  - Stale projection results can contain intermediate `agentMessage` progress
    items while still lacking the real rollout
    `task_complete.last_agent_message`; that made the server skip the fallback.
- Change:
  - `server.js` now treats rollout `last_agent_message` as the text identity of
    the final receipt.
  - Completed/successful turns receive a synthetic final `agentMessage` when
    they do not already contain an assistant/plan item with matching final
    text, even if they contain intermediate `agentMessage` items.
  - Matching existing receipts are not duplicated or replaced.
  - Failed, cancelled, interrupted, running, active, progress, pending, and
    unknown turns still do not receive this fallback.
  - The raw thread-read branch now also runs the same final-receipt enrichment
    before returning.
  - `/api/threads/:id/turns` compacted turns-list responses now receive the
    same enrichment when a rollout-backed summary is available.
- Tests:
  - Added coverage in `test/thread-item-timestamp-enrichment.test.js` for a
    completed turn that has only an intermediate `agentMessage`; the rollout
    final receipt must still be appended.
  - Updated existing-receipt coverage to assert that matching final text is not
    duplicated, while failed turns are still skipped.
- Docs:
  - `README.md`
  - `docs/ARCHITECTURE.md`
  - `docs/TROUBLESHOOTING.md`
- Validation:
  - Private workspace:
    - `npm run check`
    - `npm run check:macos`
    - Focused 114-test suite passed:
      `test/thread-item-timestamp-enrichment.test.js`,
      `test/thread-detail-projection-service.test.js`,
      `test/thread-detail-projection-v4-service.test.js`,
      `test/conversation-render.test.js`, and
      `test/turn-usage-summary-service.test.js`.
    - `npm test` passed (`608` tests).
    - `git diff --check`
  - Staging:
    - Source staged from the private working tree:
      `/tmp/codex-mobile-web-stage-final-receipt-v2.hrgPqq`.
    - Blocked-path scan was clean for runtime/private paths including `.git`,
      `.agent-context`, `.codegraph`, `node_modules`, `data`, `logs`,
      `uploads`, env files, access-key, private-key, and secret patterns.
    - `npm run check`
    - `npm run check:macos`
    - Same focused 114-test suite passed with `NODE_PATH` pointed at the
      private workspace `node_modules`.
  - Production target after sync:
    - `npm run check`
    - `npm run check:macos`
    - Same focused 114-test suite passed with `NODE_PATH` pointed at the
      production dependency tree.
- Production deploy:
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup retained at:
    `/tmp/codex-mobile-web-deploy-final-receipt-v2-20260622T143732Z.backup.tar.gz`.
  - Restart:
    `launchctl kickstart -k system/com.hermesmobile.plugin.codex-mobile`.
  - Post-restart smoke:
    - LaunchDaemon `system/com.hermesmobile.plugin.codex-mobile` is running
      with PID `63072`, `runs=16`, and last exit code `0`.
    - `/api/public-config` returned HTTP `200`,
      `clientBuildId=0.1.11|codex-mobile-shell-v375`,
      `shellCacheName=codex-mobile-shell-v375`, and `authRequired=true`.
    - Authenticated `/api/status` returned HTTP `200` and `ready=true`.
    - Home AI thread `019eed86-2002-7cc2-b0b7-937eb5355f36` recent detail
      returned `projection-v4-cache`, 10 turns, latest completed turn with
      agent receipt count `19`, last agent text length `479`, usage count `1`,
      and synthetic final receipt count `0` because the stable projection
      already contains the normal final receipt.
    - Production `server.js` contains `normalizeFinalReceiptText`,
      `turnHasMatchingAssistantReceipt`, raw-read enrichment, and turns-list
      enrichment hooks.
- Operational notes:
  - This is server-only; no PWA cache bump.
  - This has not been pushed to public. Follow the release-order rule: wait for
    production/user confirmation before any public sync/push.

## 2026-06-22 - First-open final receipt fallback deployed

- User clarification:
  - The observed first-open problem is missing the final agent receipt, not
    primarily missing Usage. Usage was a symptom in earlier descriptions.
- Change:
  - `server.js` now reads bounded rollout completion events
    `task_complete` / `task_completed` and caches their
    `last_agent_message` payloads by rollout fingerprint.
  - During compact thread detail projection, completed/successful turns that
    have no existing assistant/plan receipt get a synthetic `agentMessage`
    from that rollout final receipt before `turnUsageSummary` is attached.
  - Existing app-server receipts are not overwritten.
  - Failed, cancelled, interrupted, running, active, progress, pending, and
    unknown turns do not get synthetic final receipts.
  - The synthetic receipt intentionally has no timestamp fields so ordering
    remains user message, final receipt, then Usage.
- Tests:
  - Added coverage in `test/thread-item-timestamp-enrichment.test.js` for:
    - completed turn missing app-server receipt is backfilled from rollout
      `task_complete`;
    - existing receipts are preserved and failed turns are not backfilled.
- Docs:
  - `README.md`
  - `docs/ARCHITECTURE.md`
  - `docs/TROUBLESHOOTING.md`
- Validation:
  - Private workspace:
    - Focused 113-test suite passed:
      `test/thread-item-timestamp-enrichment.test.js`,
      `test/thread-detail-projection-service.test.js`,
      `test/thread-detail-projection-v4-service.test.js`,
      `test/conversation-render.test.js`, and
      `test/turn-usage-summary-service.test.js`.
    - `node --check server.js`
    - `git diff --check`
    - `codegraph sync`
    - `codegraph status` was up to date; it warned the index was built by an
      earlier engine version.
    - `npm run check`
    - `npm run check:macos`
    - `npm test` passed (`607` tests).
  - Staging:
    - Source staged from the private working tree, not the public mirror:
      `/tmp/codex-mobile-web-stage-final-receipt.Gq2ba3`.
    - Blocked-path scan was clean for exact runtime/private paths including
      `.git`, `.agent-context`, `.codegraph`, `node_modules`, `data`, `logs`,
      `uploads`, env files, access-key, private-key, and secret path patterns.
    - `npm run check`
    - `npm run check:macos`
    - Focused 113-test suite passed with `NODE_PATH` pointed at the private
      workspace `node_modules`; staging intentionally omits `node_modules`.
  - Production target after sync:
    - `npm run check`
    - `npm run check:macos`
    - Same focused 113-test suite passed with `NODE_PATH` pointed at the
      production dependency tree.
- Production deploy:
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup retained at:
    `/tmp/codex-mobile-web-deploy-final-receipt-20260622T142901Z.backup.tar.gz`.
  - Sync used sudo `rsync` from private staging and preserved `data/`, `logs/`,
    `node_modules/`, `uploads/`, `.git/`, `.agent-context`, env files, and
    machine-specific runtime state.
  - Restart:
    `launchctl kickstart -k system/com.hermesmobile.plugin.codex-mobile`.
  - Post-restart smoke:
    - LaunchDaemon `system/com.hermesmobile.plugin.codex-mobile` is running
      with PID `43931`, `runs=15`, and last exit code `0`.
    - `/api/public-config` returned HTTP `200`,
      `clientBuildId=0.1.11|codex-mobile-shell-v375`,
      `shellCacheName=codex-mobile-shell-v375`, and `authRequired=true`.
    - Authenticated `/api/status` returned HTTP `200` and `ready=true`.
    - Production `server.js` contains the rollout final-receipt cache,
      scanner, compact-thread attachment hook, and synthetic receipt marker.
    - Home AI thread `019eed86-2002-7cc2-b0b7-937eb5355f36` recent detail
      returned 10 turns; the latest completed turn had item types
      `userMessage`, `agentMessage`, and `turnUsageSummary`. It did not need a
      synthetic final receipt because the normal app-server receipt was already
      present.
- Operational notes:
  - This is server-only; no PWA cache bump.
  - This has not been pushed to public. Follow the release-order rule: wait for
    production/user confirmation before any public sync/push.
