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
