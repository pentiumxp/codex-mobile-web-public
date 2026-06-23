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

## 2026-06-23 - Thread List Fallback Baseline Incremental Cache

- Status: implemented and validated locally; not yet committed or deployed.
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
