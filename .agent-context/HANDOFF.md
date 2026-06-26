# 2026-06-26 - local Phase B active read policy extracted

- Scope:
  - Continued Phase B active/running large-thread read-path work.
  - This slice extracts the active-thread full-read decision into a pure policy
    service. It does not enable partial projection for active threads, does not
    change `thread/read` versus `turns-list` execution order, does not change
    projection cache contents, and does not alter frontend rendering.
- Root-cause boundary:
  - Runtime sampling showed the remaining slow detail class is active/running
    large threads where partial projection could omit in-progress operation or
    intermediate items.
  - The violated long-term invariant is architectural rather than a single
    bug: active read correctness rules should not be embedded directly in the
    orchestration flow if future optimization needs an active-window overlay.
  - The new policy surface makes the current conservative rule explicit:
    active summaries require full `thread/read` until a later overlay proves it
    can preserve live/intermediate items without missing or duplicating them.
- Changes:
  - Commit `99763b1 extract active thread detail read policy`.
  - Added `adapters/thread-detail-active-read-policy-service.js`.
  - `thread-detail-active-read-policy-service` owns:
    active status normalization, active turn id detection, bounded
    full-read reason derivation, recent partial/initial turns-list eligibility,
    and active suppression of large-session bounded-read shortcuts.
  - `adapters/thread-detail-read-orchestration-service.js` now consumes the
    policy plan instead of parsing active status inline.
  - Added `test/thread-detail-active-read-policy-service.test.js`.
  - Updated README, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`,
    `docs/MODULES.md`, `package.json` check coverage, and the legacy
    source-string visibility test to point at the new policy boundary.
- Validation:
  - Focused:
    `node --test test/thread-detail-active-read-policy-service.test.js test/thread-detail-read-orchestration-service.test.js test/thread-detail-performance-service.test.js test/thread-performance-metrics.test.js`
    passed (`42` tests).
  - Failure follow-up:
    `node --test test/thread-visibility.test.js test/thread-detail-active-read-policy-service.test.js test/thread-detail-read-orchestration-service.test.js`
    passed (`61` tests) after updating an old source-string assertion that
    expected the previous inline active check.
  - Full source `npm test` passed (`1018` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment:
  - Not deployed. This is a local architecture boundary slice with no intended
    runtime behavior change and no PWA shell/cache bump.
- Next recommended slice:
  - Add a pure active-window overlay planning service/test harness. It should
    define the exact evidence required before active recent reads may use
    projection plus overlay instead of full `thread/read`: active turn id,
    operation item presence, user upload visibility, assistant delta freshness,
    usage/diagnostic receipts, and safe fallback to full read when any invariant
    is not proven.

# 2026-06-26 - local Phase B active full-read evidence committed

- Runtime sampling before this slice:
  - Production was still v522:
    `clientBuildId=0.1.11|codex-mobile-shell-v522`,
    `shellCacheName=codex-mobile-shell-v522`.
  - First observed thread-list read after local sampling hit a cold
    fallback-cache rebuild: `totalMs=2590`, `fallbackMs=2273`,
    `fallbackRolloutMs=2093`, `fallbackCacheDecision=miss-rebuild`.
  - Immediate repeated list reads were warm cache hits around `315-340ms`,
    `fallbackMs=0`, `fallbackCacheDecision=hit`; remaining cost was mostly
    app-server/list merge/decorate. This supports the current Phase B
    conclusion that ordinary refresh is not repeatedly rebuilding the fallback
    baseline once the process is warm.
  - Large detail samples:
    - 201MB active/status-error row initially fell back to full `thread-read`
      with `threadReadMs=1414` because only a partial projection was available
      and active summaries intentionally require full reads for live operation
      recovery.
    - After that full read seeded projection, repeated reads for that large
      thread hit `projection-v4-dynamic` in roughly `125-221ms`.
    - 112MB and 45MB idle rows hit warm dynamic projection in roughly
      `54-157ms`.
    - 22-40MB rows with no cache first used `turns-list-initial`
      (`137-258ms`), then repeated reads hit `projection-v4-partial`
      (`48-54ms`).
  - All sampling output was bounded to ids hashed with SHA-256 prefixes,
    status/read modes, counts, rollout-size buckets, timing fields, and reason
    codes. No titles, message bodies, card bodies, access keys, uploads,
    cookies, tokens, provider payloads, or raw logs were printed.
- Root-cause boundary:
  - The remaining measured slow detail class is not generic idle projection or
    thread-list fallback rebuild. It is active/running thread detail reads when
    partial projection would omit in-progress operation/intermediate items.
  - Correctness still requires full read unless a future active-window overlay
    strategy proves it can merge live operation evidence over a partial/current
    window without missing or duplicating items.
- Changes:
  - Commit `7cee941 report active detail full-read reasons`.
  - `adapters/thread-detail-read-orchestration-service.js` now derives a bounded
    `activeFullReadReason` (`active-turn-id`, `status-active`,
    `mobile-status-active`, or `local-active-status`) when active summaries
    force full `thread/read`.
  - `adapters/thread-detail-performance-service.js` exposes
    `activeFullReadRequired` and `activeFullReadReason` in
    `mobileDiagnostics.threadDetailTimings`.
  - README, architecture optimization plan, and module map document this as
    evidence-only Phase B diagnostics, not a runtime shortcut.
- Validation:
  - Focused:
    `node --test test/thread-detail-performance-service.test.js test/thread-detail-read-orchestration-service.test.js test/thread-performance-metrics.test.js`
    passed (`37` tests).
  - Full source `npm test` passed (`1013` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment:
  - Not deployed as a standalone local evidence slice. Production remains v522.
- Next recommended slice:
  - Design and test an active-window overlay policy before changing runtime
    reads: partial recent/dynamic projection may only replace full `thread/read`
    for active threads if current active turn operations, tool calls, user
    uploads, assistant deltas, and usage/diagnostic receipts can be merged from
    authoritative live/projection evidence without losing content.

# 2026-06-26 - local Phase B server detail phase classifier committed

- Scope:
  - Continued Phase B large-session/thread-detail cold-path evidence work.
  - This is a server diagnostics classifier cleanup only: it does not change
    thread-detail read strategy, projection cache state, frontend render/patch
    behavior, Home AI diagnostic transport, or PWA shell/cache.
  - Not deployed by design as a standalone tiny slice; production remains the
    latest deployed v522 shell until this diagnostic boundary is bundled with a
    runtime optimization or the user explicitly asks to deploy it.
- Root-cause boundary:
  - Symptom/risk: client first-paint events can classify thread detail phases
    from bounded fields, but server `mobileDiagnostics.threadDetailTimings.phase`
    could stay `unknown` or less precise when `readMode` was sparse/generic.
  - Failing layer: server thread-detail timing diagnostics phase ownership.
  - Violated invariant: production large-session evidence must distinguish warm
    projection hits, partial projection hits, bounded turns-list windows,
    cold full/raw thread reads, fallback turns-list, and summary fallback using
    bounded enum/status metadata, not private content.
- Changes:
  - Commit `49c2c78 align server thread detail phase classification`.
  - `adapters/thread-detail-performance-service.js` now classifies phase from
    `readDecision`, `projectionState`, `projectionSource`, and
    `projectionSeedStatus` when `readMode` is sparse.
  - Added coverage in `test/thread-detail-performance-service.test.js` for
    read-decision-only classification and seeded initial windows without
    leaking turn ids or message body text.
  - Updated README, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md` with the Phase B evidence boundary.
- Validation:
  - Focused:
    `node --test test/thread-detail-performance-service.test.js test/thread-performance-metrics.test.js test/thread-detail-read-orchestration-service.test.js`
    passed (`36` tests).
  - `node --check adapters/thread-detail-performance-service.js` passed.
  - Full source `npm test` passed (`1012` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Next recommended slice:
  - Use the now-aligned server/client phase evidence to sample production
    thread-detail first-paint paths for large threads, then decide whether the
    next root-cause fix belongs in projection cache persistence, summary-size
    hydration, active-thread read bypass, or client patch/render ownership.

# 2026-06-26 - v522 empty-detail browser smoke harness deployed

- Scope:
  - Added a Phase E browser/DOM replay hook for the Music empty-detail failure
    class fixed in v520/v521.
  - This is verification infrastructure, not a runtime fallback: it does not
    synthesize turns, force refresh loops, hide empty states, or alter thread
    detail authority rules.
- Changes:
  - Commit `87c9a2b add empty detail cache visual smoke`.
  - `public/app.js` Hermes embedded visual harness now exposes
    `simulateEmptyCachedDetailOpen(threadId)`.
  - The harness seeds the old bad precondition
    `turns: [] + mobileDetailLoaded:true` into the current thread, then calls
    the real `loadThread(threadId, { source: "visual-harness-empty-cache" })`
    path.
  - Added `scripts/codex-mobile-empty-detail-cache-smoke.js`, which drives the
    Home AI live debug server, calls the iframe harness, and checks that the
    DOM reaches nonempty `.turn[data-turn]` rows instead of staying on
    `No visible turns.`.
  - `package.json` `check` now syntax-checks the new smoke script.
  - README, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and `docs/MODULES.md`
    document the v522 replay boundary.
  - Static shell/cache advanced to `codex-mobile-shell-v522`.
- Privacy/safety boundary:
  - Harness/smoke results are bounded to `clientBuildId`, `thread_hash`,
    turn/item counts, loaded/loading/error flags, read mode, and DOM counts.
  - They do not return thread titles, message text, task-card bodies, upload
    contents, file paths, URLs, cookies, access keys, launch tokens, provider
    payloads, or long logs.
- Validation:
  - Focused suite passed:
    `node --test test/mobile-viewport.test.js test/conversation-render.test.js test/thread-detail-state.test.js test/thread-diagnostic-events.test.js test/home-ai-diagnostic-reporting.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
    (`171` tests).
  - `node --check public/app.js && node --check public/sw.js && node --check scripts/codex-mobile-empty-detail-cache-smoke.js`
    passed.
  - Full source `npm test` passed (`1010` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment/readback:
  - Deployed through the Home AI central macOS plugin deploy path.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260626T055446Z-plugin-codex-mobile-web-manual`.
  - Production `/api/public-config` returned
    `clientBuildId=0.1.11|codex-mobile-shell-v522`,
    `shellCacheName=codex-mobile-shell-v522`, and build id
    `677c4f047a5ab153`.
  - Production marker readback confirmed v522 in `public/app.js` / `public/sw.js`,
    `simulateEmptyCachedDetailOpen` in `public/app.js`, and
    `No visible turns` smoke logic in
    `scripts/codex-mobile-empty-detail-cache-smoke.js`.
  - Source/prod SHA-256 prefixes matched for changed runtime files, docs, tests,
    package metadata, and the new smoke script.
  - Authenticated production Music detail read returned `10` turns with item
    counts `[3,5,3,5,5,4,3,4,3,4]`, `39` visible items, and read mode
    `projection-v4-dynamic`.
- Live visual smoke attempt:
  - `node scripts/codex-mobile-empty-detail-cache-smoke.js --thread-id 019ef42b-2cb8-7332-ab17-033ec5b48947 --json`
    was attempted against the Home AI live debug server at `127.0.0.1:19073`.
  - The server existed, but the run failed before browser evidence with bounded
    error `500:spawnSync xcrun ETIMEDOUT`.
  - Treat this as a debug-lane/runtime harness availability limitation, not as
    evidence that the Codex Mobile empty-detail replay failed.
- Next recommended slice:
  - Make the live visual lane itself observable enough that `xcrun` timeouts
    are classified separately from plugin DOM failures, then run the v522 smoke
    after the debug lane is healthy. After that, continue Phase B cold/warm
    detail-path timing evidence for large sessions.

# 2026-06-26 - v521 thread-open cache-reuse policy deployed

- User-visible incident:
  - User reported `Music 06-23` could enter a state where no turns were visible.
  - Production detail API for thread `019ef42b-2cb8-7332-ab17-033ec5b48947`
    continued to return `10` turns and `39` visible items both before and after
    the fix, so the data was not lost; the failure remained in frontend
    detail/cache authority and render projection.
- Root-cause boundary:
  - Failing layer: frontend single-thread `loadThread()` cached-current reuse
    policy.
  - Invariant: opening a thread may reuse cached current detail only when the
    current detail is both loaded and reusable. An empty
    `mobileDetailLoaded + turns: []` object must not become display authority
    and skip the detail API.
  - Classification: root-cause architecture fix plus bounded diagnostic. No
    synthetic turns, forced refresh loop, duplicate suppression, or UI-only
    fallback was added.
- Changes:
  - Commit `650d711 extract thread open cache reuse policy`.
  - `public/thread-detail-state.js` adds `planThreadOpenCacheReuse()`, a pure
    policy returning `shouldUseCachedCurrent`,
    `shouldReportEmptyCachedDetail`, and bounded `reason`.
  - `public/app.js` consumes that plan in `loadThread()`. Nonempty loaded detail
    can still use `cached-current`; empty loaded detail is blocked from cache
    authority and the normal detail API path continues.
  - `public/thread-diagnostic-events.js` adds
    `empty_cached_detail_reuse_blocked` and success-clear payload builders so
    recurring empty-cache authority attempts can enter the Home AI
    Owner-gated diagnostic loop with metadata-only evidence.
  - README, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and `docs/MODULES.md`
    document the new policy boundary.
  - Static shell/cache advanced to `codex-mobile-shell-v521`.
- Validation:
  - Focused suite passed:
    `node --test test/thread-detail-state.test.js test/thread-diagnostic-events.test.js test/conversation-render.test.js test/home-ai-diagnostic-reporting.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
    (`170` tests).
  - `node --check public/app.js && node --check public/thread-detail-state.js && node --check public/thread-diagnostic-events.js && node --check public/sw.js`
    passed.
  - Full source `npm test` passed (`1009` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment/readback:
  - Deployed through the Home AI central macOS plugin deploy path.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260626T054436Z-plugin-codex-mobile-web-manual`.
  - Production `/api/public-config` returned
    `clientBuildId=0.1.11|codex-mobile-shell-v521`,
    `shellCacheName=codex-mobile-shell-v521`, and build id
    `2624c65bfdfa86bc`.
  - Production marker readback confirmed `planThreadOpenCacheReuse` in
    `public/app.js` / `public/thread-detail-state.js`,
    `empty_cached_detail_reuse_blocked` in
    `public/thread-diagnostic-events.js`, and `codex-mobile-shell-v521` in
    `public/app.js` / `public/sw.js`.
  - Source/prod SHA-256 prefixes matched for changed runtime files, docs, and
    tests.
  - Authenticated production Music detail read returned `10` turns with item
    counts `[3,5,3,5,5,4,3,4,3,4]` and `39` visible items.
- Next recommended slice:
  - Add a browser/DOM smoke for this exact failure class: seed an empty
    current-thread detail shell, open the same thread, verify the UI does not
    render `No visible turns.` from cache, verify a detail API read occurs, and
    verify the bounded diagnostic fires if the empty-cache authority attempt
    repeats.

# 2026-06-26 - local Phase B bounded-read policy service validated, not deployed

- Latest code commit:
  - `b57e060 refactor thread detail bounded read policy`
- Scope:
  - Continued Phase B large-session / cold-path architecture cleanup without
    deploying a small slice.
  - Extracted the large-session bounded-read gate from `server.js` into the
    pure `adapters/thread-detail-bounded-read-policy-service.js`.
  - `server.js` now only injects
    `CODEX_MOBILE_THREAD_DETAIL_TURNS_LIST_FIRST_BYTES` and
    `threadRolloutSizeBytes`; the pure service owns projection rollout-size
    priority, summary fallback, `>=` threshold semantics, disabled/no-size
    decisions, and source/reason metadata.
  - Added direct policy tests for disabled threshold, projection `sizeBytes`,
    projection legacy `size`, projection-below-threshold without summary
    fallback, equality-to-threshold, invalid-threshold preservation, summary
    fallback, no-size behavior, and configured service reuse.
  - Updated `package.json` `check`, `docs/MODULES.md`, and
    `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md` so the new boundary is durable.
- Root-cause boundary:
  - Symptom/risk: the large-session first-paint protection decision was still
    embedded in route assembly, making cold-path changes harder to test and
    easier to regress while investigating large session load latency.
  - Failing layer: server-side thread-detail read-path decision ownership.
  - Classification: root-cause architecture cleanup. No fallback behavior,
    runtime read strategy change, shell/cache bump, deployment, or public push
    was added.
- Validation:
  - Focused suite passed:
    `node --test test/thread-detail-bounded-read-policy-service.test.js test/thread-detail-read-orchestration-service.test.js test/thread-detail-performance-service.test.js`
    (`24` tests).
  - `node --check adapters/thread-detail-bounded-read-policy-service.js && node --check server.js` passed.
  - Full source `npm test` passed (`965` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment:
  - Not deployed by design. This is a local Phase B architecture slice and
    should accumulate into a larger completed module before production deploy.
  - Production remains at `0.1.11|codex-mobile-shell-v507`.
- Progress:
  - Overall system-level architecture optimization is now estimated at about
    `77%`.
- Next suggested slice:
  - Continue Phase B by extracting the remaining thread-detail runtime
    observation/readback boundary: compare production diagnostics for large
    threads against the server read decision, then decide whether the next
    fix belongs to summary rollout-size hydration, projection-cache lifecycle,
    app-server `turns/list` timing, or client DOM patch cost.

# 2026-06-26 - local Phase B thread-detail performance phase classifier validated, not deployed

- Latest code commit:
  - `1d61967 classify thread detail performance phases`
- Scope:
  - Started the next Phase B large-session / cold-path evidence boundary after
    the v507 Phase A module deploy.
  - Added client-side `classifyThreadDetailPhase()` in
    `public/thread-performance-metrics.js`.
  - The classifier preserves an explicit non-`unknown` server phase when
    present, but can now derive a bounded `performancePhase` from
    `readDecision`, `readMode`, `projectionState`, `projectionSource`, and
    `projectionSeedStatus` when the server phase is missing or `unknown`.
  - Covered warm projection cache, warm projection dynamic, warm projection
    partial, cold initial turns-list, cold initial turns-list with partial
    seed, bounded large turns-list, cold full `thread/read`, raw thread/read,
    turns-list fallback, summary fallback, cached-current, and unknown paths.
- Root-cause boundary:
  - Symptom/risk: large-session first-paint/refresh/full-ready client events
    could degrade to `performancePhase=unknown` even when safe server fields
    contained enough bounded evidence to classify the read path. That weakens
    root-cause triage for "slow first open" and can push the next repair toward
    guesswork instead of projection/read-path evidence.
  - Failing layer: client-side Phase B performance diagnostics interpretation.
  - Classification: root-cause evidence ownership cleanup. No server read
    strategy, projection cache behavior, thread-list cache behavior, render
    behavior, fallback, shell/cache bump, deployment, or public push was added.
- Files changed:
  - `public/thread-performance-metrics.js`
  - `test/thread-performance-metrics.test.js`
  - `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`
  - `docs/MODULES.md`
- Validation:
  - Focused suite passed:
    `node --test test/thread-performance-metrics.test.js test/thread-detail-performance-service.test.js test/thread-detail-read-orchestration-service.test.js test/mobile-viewport.test.js`
    (`34` tests).
  - Full source `npm test` passed (`956` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment:
  - Not deployed by design. This is a local Phase B evidence/diagnostic
    ownership slice and should accumulate into a larger Phase B module before
    production deploy.
  - Production remains at `0.1.11|codex-mobile-shell-v507`.
- Progress:
  - Overall system-level architecture optimization is now estimated at about
    `76%`.
- Next suggested slice:
  - Continue Phase B with server-side read-path decision ownership or runtime
    observation: compare production `thread_detail_first_paint` / `thread_refresh_ms`
    events for large threads and decide whether the next code slice belongs to
    projection-cache seeding, summary rollout-size hydration, invalid full-cache
    lifecycle, or app-server `turns/list` fallback timing.

# 2026-06-26 - v507 Phase A refresh/patch module deployed

- Latest runtime code commit deployed:
  - `49c88f4c1296 prepare phase a refresh module deploy`
- Follow-up docs/context:
  - README and this handoff record the v507 module deployment evidence after
    production readback.
- Scope:
  - Deployed the accumulated local Phase A frontend thread-detail refresh /
    patch ownership module as one production release, rather than deploying
    the prior small local slices individually.
  - The module covers `refreshCurrentThread()` request planning, patch surface
    selection, patch-attempt effect planning/aggregation, local DOM patch
    transaction ordering, completion snapshots, execution-effect planning,
    performance payload assembly, and behavior-level DOM harness coverage.
  - It does not change server projection semantics, Home AI diagnostic dispatch
    policy, task-card protocol, image projection rules, or tile/split visual
    layout.
- Root-cause boundary:
  - Symptom/risk: client/server projection display has had regressions around
    duplicate/missing messages, whole-screen refreshes, and local patch/full
    render instability. A large `public/app.js` refresh state machine made
    ownership hard to prove and regressions easy to reintroduce.
  - Failing layer: frontend thread-detail refresh/patch ownership and
    validation boundary.
  - Classification: root-cause architecture cleanup and validation hardening;
    no fallback or UI-only masking was added.
- Static build/cache:
  - `public/app.js` `CLIENT_BUILD_ID` is now
    `0.1.11|codex-mobile-shell-v507`.
  - `public/sw.js` `CACHE_NAME` is now `codex-mobile-shell-v507`.
- Validation before deploy:
  - Focused module suite passed:
    `node --test test/thread-detail-refresh-dom-harness.test.js test/thread-detail-dom-patch.test.js test/thread-detail-render-plan.test.js test/thread-detail-patch-plan.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
    (`110` tests).
  - Full source `npm test` passed (`955` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Production deploy:
  - Deployed through Home AI central macOS production script:
    `npm run --silent deploy:macos -- --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --restart-label com.hermesmobile.plugin.codex-mobile --health-url http://127.0.0.1:8787/api/public-config --reason codex-mobile-phase-a-refresh-module-v507 --execute --json`
  - Source ref at deploy: `49c88f4c1296`, dirty `false`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260626T021410Z-plugin-codex-mobile-web-codex-mobile-phase-a-refresh-module-v507`
  - LaunchDaemon validation passed for `system/com.hermesmobile.plugin.codex-mobile`.
  - Auth-profile audit passed with `blockingIssueCount=0`.
- Production readback:
  - `/api/public-config` reports `version=0.1.11`,
    `clientBuildId=0.1.11|codex-mobile-shell-v507`,
    `shellCacheName=codex-mobile-shell-v507`,
    `workspacePath=/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`,
    and `activeProfileId=previous`.
  - Source/prod short SHA-256 samples matched for:
    `public/app.js`, `public/sw.js`,
    `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`,
    `public/thread-detail-render-plan.js`,
    `public/thread-detail-patch-plan.js`,
    `public/thread-detail-dom-patch.js`, and
    `test/thread-detail-refresh-dom-harness.test.js`.
- Public:
  - Public was not pushed for v507. Follow the release order: production/user
    validation first, then public sync only after explicit request.
- Progress:
  - Overall system-level architecture optimization is now estimated at about
    `75%`.
  - Phase A refresh/patch ownership is deployed as a coherent module. The next
    optimization should use production `thread_refresh_ms` and Home AI
    `conversation_projection_mismatch` evidence before deciding whether to
    continue frontend DOM patching, server projection cache/read orchestration,
    SSE/live merge, or pane-state ownership.
- Next suggested work:
  - Observe v507 in normal phone/split-pane flows. If projection mismatch or
    whole-screen refresh reports recur, inspect bounded diagnostics first.
  - Otherwise move to the next module target: large-session cold/warm path
    evidence or pane-state/detail-load ownership, but again accumulate a
    complete module before deploying.

# 2026-06-26 - v476 thread-list fallback cache decision diagnostics deployed

- Scope:
  - Continued Phase B large-session / thread-list cold path evidence work.
  - This slice adds bounded thread-list fallback cache decision diagnostics.
  - It does not change cache invalidation, fallback aggregation, thread-list
    merge behavior, app-server calls, server projection, task-card behavior,
    pane layout, image projection, or Home AI diagnostic dispatch. No fallback
    or UI-only masking was added.
- Root-cause boundary:
  - Before v476, `/api/threads` diagnostics could expose fallback timings and
    `fallbackCacheHit`, but could not explain why a request rebuilt fallback
    state or whether a later fast request reused the same process-lifetime
    baseline.
  - That made large-session/thread-list slowness hard to distinguish between
    first baseline build, TTL expiry, cache miss, deferred fallback, and normal
    warm reuse.
- Change:
  - `adapters/thread-list-fallback-cache-service.js` now records
    `cacheDecision` (`hit`, `miss`, `expired` internally and
    `hit`, `miss-rebuild`, `expired-rebuild` in route diagnostics),
    bounded cache key hash, cache entry count, TTL, cache age/update age,
    build count/number, and incremental update count.
  - `server.js` forwards those fields into
    `mobileDiagnostics.threadListTimings` as
    `fallbackCacheDecision`, `fallbackCacheBuildReason`,
    `fallbackCacheKeyHash`, `fallbackCacheAgeMs`,
    `fallbackCacheBaselineAgeMs`, `fallbackCacheUpdatedAgeMs`,
    `fallbackCacheTtlMs`, `fallbackCacheEntryCount`,
    `fallbackCacheBuildCount`, `fallbackCacheBuildNumber`, and
    `fallbackCacheIncrementalUpdates`.
  - `public/thread-performance-metrics.js` now classifies thread-list phase as
    `warm-fallback-cache`, `cold-fallback-miss-build`, or
    `cold-fallback-expired-rebuild` from the structured decision.
  - Bumped `CLIENT_BUILD_ID` and service worker cache to
    `codex-mobile-shell-v476`.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
- Commit:
  - Runtime/docs commit: `a842723 instrument thread list fallback cache decisions`.
- Validation in source workspace:
  - Syntax checks passed for
    `adapters/thread-list-fallback-cache-service.js`,
    `public/thread-performance-metrics.js`, `server.js`, `public/app.js`, and
    `public/sw.js`.
  - Focused suite passed: `77` tests across
    `test/thread-list-fallback-cache-service.test.js`,
    `test/thread-performance-metrics.test.js`, `test/thread-visibility.test.js`,
    `test/mobile-viewport.test.js`, `test/thread-goal-service.test.js`, and
    `test/thread-task-card-route.test.js`.
  - `npm test` passed: `859` tests.
  - `npm run check`
  - `npm run check:macos`
  - `git diff --check`
- Production deploy:
  - Deployed through Home AI central macOS production script.
  - Reason: `codex-mobile-thread-list-cache-decision-diagnostics-v476`.
  - Source ref at deploy: `a842723b7d64`, dirty `false`.
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T200954Z-plugin-codex-mobile-web-codex-mobile-thread-list-cache-decision-diagnostics-v476`.
  - LaunchDaemon `system/com.hermesmobile.plugin.codex-mobile` reported
    running and manifest/profile health checks passed.
- Production readback:
  - `/api/public-config` returned
    `clientBuildId=0.1.11|codex-mobile-shell-v476`,
    `shellCacheName=codex-mobile-shell-v476`, and `version=0.1.11`.
  - Source/prod SHA-256 parity matched for:
    `adapters/thread-list-fallback-cache-service.js`, `server.js`,
    `public/thread-performance-metrics.js`, `public/app.js`, `public/sw.js`,
    `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`,
    `docs/MODULES.md`, and the focused tests listed above.
  - Production focused suite passed: same `77` tests listed above with
    production dependencies.
  - Bounded authenticated thread-list readback returned HTTP `200`; after the
    deployment restart, one observed request reported
    `fallbackCacheDecision=miss-rebuild` with `fallbackMs=2917`, and the
    immediate next request reported `fallbackCacheDecision=hit` with
    `fallbackMs=1`. Only bounded diagnostics were printed; no access key,
    thread titles, message text, task-card bodies, upload content, or raw
    paths were logged.
- Next architecture boundary:
  - Continue Phase B with thread-detail cold/warm first-paint evidence and
    projection-cache/read-path diagnosis before changing cache behavior.
  - New Home AI task card `ttc_a8ab1599a96e2e92ed` asks Codex Mobile to wire
    terminal return cards into Home AI Autonomous Delivery Loop event intake;
    this is a separate task-card protocol slice and should return by real
    card when complete.
- Public:
  - Not pushed to Public. Follow release-order rule: wait for production/user
    validation or explicit Public instruction before syncing/pushing.

# 2026-06-26 - v475 thread tile operation dock render policy deployed

- Scope:
  - Continued Phase C pane-state / split-screen architecture work.
  - This slice moves pane-local operation dock render-branch planning out of
    `public/app.js` and into `public/thread-tile-state.js`.
  - It does not change visual design, operation bubble/sheet HTML, command
    summary/duration display, server projection, thread detail reads,
    task-card behavior, Home AI diagnostics, pane layout, image projection, or
    message merge. No fallback or UI-only masking was added.
- Root-cause boundary:
  - Before v475, v474 moved operation mode toggle state into pane-state policy,
    but `renderThreadTileOperationDock` still directly decided whether to
    render a current live operation, reuse a remembered bubble during its
    minimum dwell window, clear expired remembered state, or render nothing.
  - That kept operation dock runtime branching in the app render function
    instead of a testable pane-state policy.
- Change:
  - Added pure `operationDockPlan` to `public/thread-tile-state.js`.
  - The plan emits bounded actions:
    `render-live-operation`, `render-remembered-operation`,
    `clear-remembered-operation`, or `none`.
  - `public/app.js` now keeps only real HTML rendering, timer scheduling,
    remembered-bubble Map deletion, and DOM patch ownership.
  - Removed the now-redundant `recentThreadTileOperationBubble` app helper.
  - Bumped `CLIENT_BUILD_ID` and service worker cache to
    `codex-mobile-shell-v475`.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
- Commit:
  - Runtime/docs commit: `f2be8b7 refactor thread tile operation dock planning`.
- Validation in source workspace:
  - Syntax checks passed for `public/thread-tile-state.js`, `public/app.js`,
    and `public/sw.js`.
  - Focused suite passed: `69` tests across
    `test/thread-tile-state.test.js`,
    `test/thread-tile-layout-ui.test.js`,
    `test/thread-tile-layout.test.js`, `test/mobile-viewport.test.js`,
    `test/thread-task-card-route.test.js`,
    `test/thread-goal-service.test.js`, and
    `test/composer-draft.test.js`.
  - `npm test` passed: `859` tests.
  - `npm run check`
  - `npm run check:macos`
  - `git diff --check`
- Production deploy:
  - Deployed through Home AI central macOS production script.
  - Reason: `codex-mobile-thread-tile-operation-dock-planning-v475`.
  - Source ref at deploy: `f2be8b7eb6de`, dirty `false`.
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T195946Z-plugin-codex-mobile-web-codex-mobile-thread-tile-operation-dock-planning-v475`.
  - LaunchDaemon `system/com.hermesmobile.plugin.codex-mobile` reported
    running and manifest/profile health checks passed.
- Production readback:
  - `/api/public-config` returned
    `clientBuildId=0.1.11|codex-mobile-shell-v475`,
    `shellCacheName=codex-mobile-shell-v475`, and `version=0.1.11`.
  - Source/prod SHA-256 parity matched for:
    `public/thread-tile-state.js`, `test/thread-tile-state.test.js`,
    `test/thread-tile-layout-ui.test.js`, `public/app.js`, `public/sw.js`,
    `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
  - Production focused suite passed: same `69` tests listed above with
    production dependencies.
- Next architecture boundary:
  - Continue Phase C with command detail panel content HTML extraction, split
    sizing, measured tuning of the max concurrent detail-read value, per-pane
    draft/runtime ownership, and pane-local send/approval/interrupt ownership.
  - Phase B large-session cold/warm path remains separate and should be
    tackled with timing evidence before changing cache behavior.
- Public:
  - Not pushed to Public. Follow release-order rule: wait for production/user
    validation or explicit Public instruction before syncing/pushing.

# 2026-06-26 - v474 thread tile operation mode toggle policy deployed

- Scope:
  - Continued Phase C pane-state / split-screen architecture work.
  - This slice moves pane-local operation/command detail mode toggle planning
    out of `public/app.js` and into `public/thread-tile-state.js`.
  - It does not change visual design, operation bubble content, server
    projection, thread detail reads, task-card behavior, Home AI diagnostics,
    pane layout, image projection, or message merge. No fallback or UI-only
    masking was added.
- Root-cause boundary:
  - Before v474, pane-local operation bubble dwell/expiry/mode/signature policy
    was already service-owned, but the click path for expanding/collapsing the
    operation detail sheet still directly wrote
    `state.threadTileOperationModesById`, selected the pane, and patched the
    pane from `bindThreadTileActions`.
  - That kept command detail panel mode state in the UI event handler instead
    of the pane-state policy boundary.
- Change:
  - Added pure `operationModeTogglePlan` to `public/thread-tile-state.js`.
  - The plan owns enabled/missing-id checks, compact/expanded transition,
    selected-pane intent, pane patch intent, preserve-scroll behavior, and
    patch-miss full-render fallback intent.
  - Added `applyThreadTileOperationModeTogglePlan` in `public/app.js` as the
    narrow effect executor for Map writes, selected-pane application, and DOM
    patch execution.
  - `bindThreadTileActions` now delegates operation mode toggles through the
    policy/effect pair instead of mutating app state inline.
  - Bumped `CLIENT_BUILD_ID` and service worker cache to
    `codex-mobile-shell-v474`.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
- Commit:
  - Runtime/docs commit: `9cc790a refactor thread tile operation mode toggle`.
- Validation in source workspace:
  - Syntax checks passed for `public/thread-tile-state.js`, `public/app.js`,
    and `public/sw.js`.
  - Focused suite passed: `69` tests across
    `test/thread-tile-state.test.js`,
    `test/thread-tile-layout-ui.test.js`,
    `test/thread-tile-layout.test.js`, `test/mobile-viewport.test.js`,
    `test/thread-task-card-route.test.js`,
    `test/thread-goal-service.test.js`, and
    `test/composer-draft.test.js`.
  - `npm test` passed: `859` tests.
  - `npm run check`
  - `npm run check:macos`
  - `git diff --check`
- Production deploy:
  - Deployed through Home AI central macOS production script.
  - Reason: `codex-mobile-thread-tile-operation-mode-toggle-v474`.
  - Source ref at deploy: `9cc790ab1928`, dirty `false`.
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T195335Z-plugin-codex-mobile-web-codex-mobile-thread-tile-operation-mode-toggle-v474`.
  - LaunchDaemon `system/com.hermesmobile.plugin.codex-mobile` reported
    running and manifest/profile health checks passed.
- Production readback:
  - `/api/public-config` returned
    `clientBuildId=0.1.11|codex-mobile-shell-v474`,
    `shellCacheName=codex-mobile-shell-v474`, and `version=0.1.11`.
  - Source/prod SHA-256 parity matched for:
    `public/thread-tile-state.js`, `test/thread-tile-state.test.js`,
    `test/thread-tile-layout-ui.test.js`, `public/app.js`, `public/sw.js`,
    `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
  - Production focused suite passed: same `69` tests listed above with
    production dependencies.
- Next architecture boundary:
  - Continue Phase C with command detail panel content/rendering extraction,
    split sizing, measured tuning of the max concurrent detail-read value,
    per-pane draft/runtime ownership, and pane-local send/approval/interrupt
    ownership.
  - Phase B large-session cold/warm path remains separate and should be
    tackled with timing evidence before changing cache behavior.
- Public:
  - Not pushed to Public. Follow release-order rule: wait for production/user
    validation or explicit Public instruction before syncing/pushing.

# 2026-06-26 - v473 thread tile detail load concurrency policy deployed

- Scope:
  - Continued Phase C pane-state / split-screen architecture work.
  - This slice turns the v472 detail-load queue plan into a runtime bounded
    concurrency policy.
  - It does not limit the number of visible panes; it limits only concurrent
    `loadThreadTileDetail` reads. It does not change server projection,
    task-card behavior, Home AI diagnostic dispatch, message merge, image
    projection, pane layout, visual pane design, or the thread detail API. No
    fallback or UI-only masking was added.
- Root-cause boundary:
  - Before v473, the queue plan could express `deferredIds`, but runtime still
    set max concurrent detail reads to the user pane ceiling, so a 5/6-pane
    desktop layout could still start every pane detail read at once.
  - That preserved the multi-pane fan-out pressure that can make large session
    first paint and app-server read scheduling harder to reason about.
- Change:
  - Runtime now sets `THREAD_TILE_DETAIL_LOAD_MAX_CONCURRENT` to
    `min(4, user pane ceiling)`, keeping pane count separate from detail-read
    concurrency.
  - Added pure `detailLoadQueueDrainPlan` to `public/thread-tile-state.js`.
  - Added a 120ms pane detail-load drain timer in `public/app.js`; deferred
    panes can continue quickly after an initial queue pass or after any detail
    load settles, instead of waiting for the ordinary 2.4s tile refresh timer.
  - `detailLoadQueuePlan` now accepts `readyIds`, so cached/current panes do
    not occupy candidate slots or repeatedly block deferred panes.
  - `abortThreadTileLoads` clears both the ordinary tile refresh timer and the
    detail-load drain timer.
  - Bumped `CLIENT_BUILD_ID` and service worker cache to
    `codex-mobile-shell-v473`.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
- Commit:
  - Runtime/docs commit: `7167f11 limit thread tile detail load concurrency`.
- Validation in source workspace:
  - Syntax checks passed for `public/thread-tile-state.js`, `public/app.js`,
    and `public/sw.js`.
  - Focused suite passed: `69` tests across
    `test/thread-tile-state.test.js`,
    `test/thread-tile-layout-ui.test.js`,
    `test/thread-tile-layout.test.js`, `test/mobile-viewport.test.js`,
    `test/thread-task-card-route.test.js`,
    `test/thread-goal-service.test.js`, and
    `test/composer-draft.test.js`.
  - `npm test` passed: `859` tests.
  - `npm run check`
  - `npm run check:macos`
  - `git diff --check`
- Production deploy:
  - Deployed through Home AI central macOS production script.
  - Reason: `codex-mobile-thread-tile-detail-load-concurrency-v473`.
  - Source ref at deploy: `7167f11ad9bc`, dirty `false`.
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T194510Z-plugin-codex-mobile-web-codex-mobile-thread-tile-detail-load-concurrency-v473`.
  - LaunchDaemon `system/com.hermesmobile.plugin.codex-mobile` reported
    running and manifest/profile health checks passed.
- Production readback:
  - `/api/public-config` returned
    `clientBuildId=0.1.11|codex-mobile-shell-v473`,
    `shellCacheName=codex-mobile-shell-v473`, and `version=0.1.11`.
  - Source/prod SHA-256 parity matched for:
    `public/thread-tile-state.js`, `test/thread-tile-state.test.js`,
    `test/thread-tile-layout-ui.test.js`, `public/app.js`, `public/sw.js`,
    `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
  - Production focused suite passed: same `69` tests listed above with
    production dependencies.
- Next architecture boundary:
  - Continue Phase C with measured tuning of the max concurrent detail-read
    value, command detail panels, split sizing, per-pane draft/runtime
    ownership, and pane-local send/approval/interrupt ownership.
  - Phase B large-session cold/warm path remains separate and should be
    tackled with timing evidence before changing cache behavior.
- Public:
  - Not pushed to Public. Follow release-order rule: wait for production/user
    validation or explicit Public instruction before syncing/pushing.

# 2026-06-26 - v472 thread tile detail load queue policy deployed

- Scope:
  - Continued Phase C pane-state / split-screen architecture work.
  - This slice moves pane detail-load queue selection and stale-controller
    abort planning into `public/thread-tile-state.js`.
  - It does not change server projection, task-card behavior, Home AI
    diagnostic dispatch, message merge, image projection, pane layout, visual
    pane design, or the thread detail API. No fallback or UI-only masking was
    added.
- Root-cause boundary:
  - Before v472, v471 had moved each individual detail load's
    start/success/error/finally lifecycle into effect plans, but
    `ensureThreadTileDetails` still directly decided which controllers to
    abort and which active panes to fan out into `loadThreadTileDetail`.
  - That kept multi-pane read orchestration inside the UI layer and made
    future max-concurrent detail read tuning or slow-path diagnosis difficult
    to test without touching `public/app.js`.
- Change:
  - Added pure `detailLoadQueuePlan` to `public/thread-tile-state.js`.
  - The plan emits:
    - `abortIds` for controllers whose panes are no longer active;
    - `loadIds` for active panes that are not already controlled/loading;
    - `deferredIds` for active panes that exceed `maxConcurrentLoads`;
    - bounded `activeIds`, `controllerIds`, `loadingIds`, `busyIds`, and slot
      counts for future diagnostics/tests.
  - `ensureThreadTileDetails` now delegates to that plan and
    `applyThreadTileDetailLoadQueuePlan`; `public/app.js` keeps only real
    `AbortController.abort()`, Map/Set cleanup, and network load execution.
  - Runtime currently sets `THREAD_TILE_DETAIL_LOAD_MAX_CONCURRENT` to the
    user pane ceiling, preserving existing user-visible fan-out behavior while
    making lower concurrency policy testable for the next step.
  - Bumped `CLIENT_BUILD_ID` and service worker cache to
    `codex-mobile-shell-v472`.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
- Commit:
  - Runtime/docs commit: `d7094f2 refactor thread tile detail load queue`.
- Validation in source workspace:
  - Syntax checks passed for `public/thread-tile-state.js`, `public/app.js`,
    and `public/sw.js`.
  - Focused suite passed: `68` tests across
    `test/thread-tile-state.test.js`,
    `test/thread-tile-layout-ui.test.js`,
    `test/thread-tile-layout.test.js`, `test/mobile-viewport.test.js`,
    `test/thread-task-card-route.test.js`,
    `test/thread-goal-service.test.js`, and
    `test/composer-draft.test.js`.
  - `npm test` passed: `858` tests.
  - `npm run check`
  - `npm run check:macos`
  - `git diff --check`
- Production deploy:
  - Deployed through Home AI central macOS production script.
  - Reason: `codex-mobile-thread-tile-detail-load-queue-v472`.
  - Source ref at deploy: `d7094f2ea743`, dirty `false`.
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T193707Z-plugin-codex-mobile-web-codex-mobile-thread-tile-detail-load-queue-v472`.
  - LaunchDaemon `system/com.hermesmobile.plugin.codex-mobile` reported
    running and manifest/profile health checks passed.
- Production readback:
  - `/api/public-config` returned
    `clientBuildId=0.1.11|codex-mobile-shell-v472`,
    `shellCacheName=codex-mobile-shell-v472`, and `version=0.1.11`.
  - Source/prod SHA-256 parity matched for:
    `public/thread-tile-state.js`, `test/thread-tile-state.test.js`,
    `test/thread-tile-layout-ui.test.js`, `public/app.js`, `public/sw.js`,
    `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
  - Production focused suite passed: same `68` tests listed above with
    production dependencies.
- Next architecture boundary:
  - Continue Phase C by turning the now-testable `maxConcurrentLoads` queue
    into a measured runtime policy, or continue with command detail panels,
    split sizing, per-pane draft/runtime ownership, and pane-local
    send/approval/interrupt ownership.
  - Phase B large-session cold/warm path remains separate and should be
    tackled with timing evidence before changing cache behavior.
- Public:
  - Not pushed to Public. Follow release-order rule: wait for production/user
    validation or explicit Public instruction before syncing/pushing.

# 2026-06-26 - v471 thread tile detail load effects policy deployed

- Scope:
  - Continued Phase C pane-state / split-screen architecture work.
  - This slice moves pane detail-load lifecycle side-effect planning into
    `public/thread-tile-state.js`.
  - It does not change server projection, task-card behavior, Home AI
    diagnostic dispatch, message merge, image projection, pane layout, visual
    pane design, or the thread detail API. No fallback or UI-only masking was
    added.
- Root-cause boundary:
  - Before v471, `detailLoadPlan` already owned skip/load/background/loading
    decisions, but `loadThreadTileDetail` still directly wrote controller,
    loading, detail cache, loadedAt, error, merge, and final pane render state
    through four inline branches.
  - That kept detail-load lifecycle execution outside the pane-state planning
    boundary and made future concurrent pane reads or per-pane runtime rules
    harder to reason about.
- Change:
  - Added pure lifecycle plans:
    `detailLoadStartEffectsPlan`, `detailLoadSuccessEffectsPlan`,
    `detailLoadErrorEffectsPlan`, and `detailLoadFinallyEffectsPlan`.
  - `loadThreadTileDetail` now keeps only AbortController/network ownership and
    delegates start/success/error/finally state/render intent to the lifecycle
    plans plus small app-side executors.
  - Preserved existing behavior:
    - foreground loads still mark loading and patch the pane immediately;
    - background refresh failures remain silent;
    - successful reads update `threadTileDetails`, `threadTileLoadedAtById`,
      clear pane errors, and merge the thread into the list;
    - finally clears matching controllers, clears loading ids, and patches
      visible panes with preserve-scroll.
  - Bumped `CLIENT_BUILD_ID` and service worker cache to
    `codex-mobile-shell-v471`.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
- Commit:
  - Runtime/docs commit: `0a5994d refactor thread tile detail load effects`.
- Validation in source workspace:
  - Focused suite passed: `67` tests across
    `test/thread-tile-state.test.js`,
    `test/thread-tile-layout-ui.test.js`,
    `test/thread-tile-layout.test.js`, `test/mobile-viewport.test.js`,
    `test/thread-task-card-route.test.js`,
    `test/thread-goal-service.test.js`, and
    `test/composer-draft.test.js`.
  - `npm test` passed: `857` tests.
  - `npm run check`
  - `npm run check:macos`
  - `git diff --check`
- Production deploy:
  - Deployed through Home AI central macOS production script.
  - Reason: `codex-mobile-thread-tile-detail-load-effects-v471`.
  - Source ref at deploy: `0a5994d9a49b`, dirty `false`.
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T192821Z-plugin-codex-mobile-web-codex-mobile-thread-tile-detail-load-effects-v471`.
  - LaunchDaemon `system/com.hermesmobile.plugin.codex-mobile` reported
    running and manifest/profile health checks passed.
- Production readback:
  - `/api/public-config` returned
    `clientBuildId=0.1.11|codex-mobile-shell-v471`,
    `shellCacheName=codex-mobile-shell-v471`, and `version=0.1.11`.
  - Source/prod SHA-256 parity matched for:
    `public/thread-tile-state.js`, `test/thread-tile-state.test.js`,
    `test/thread-tile-layout-ui.test.js`, `public/app.js`, `public/sw.js`,
    `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
  - Production focused suite passed: same `67` tests listed above with
    production dependencies.
- Next architecture boundary:
  - Continue Phase C by extracting command detail panels, split sizing,
    per-pane draft/runtime ownership, max concurrent detail reads, and
    pane-local send/approval/interrupt ownership from `public/app.js`.
  - Phase B large-session cold/warm path remains separate and should be
    tackled with timing evidence before changing cache behavior.
- Public:
  - Not pushed to Public. Follow release-order rule: wait for production/user
    validation or explicit Public instruction before syncing/pushing.

# 2026-06-26 - v470 thread tile selected pane effects policy deployed

- Scope:
  - Continued Phase C pane-state / split-screen architecture work.
  - This slice moves active selected-pane side-effect planning into
    `public/thread-tile-state.js`.
  - It does not change server projection, task-card behavior, Home AI
    diagnostic dispatch, message merge, image projection, pane layout, or
    visual pane design. No fallback or UI-only masking was added.
- Root-cause boundary:
  - Before v470, `selectPanePlan` already owned selected-pane validation and
    previous/next patch ids, but `setThreadTileSelectedThread` still directly
    saved draft state, wrote `state.threadTileSelectedThreadId`, restored the
    target draft, refreshed Composer controls, patched panes, and scheduled a
    full render on patch miss.
  - That kept active-pane execution outside the same pane-state effect
    boundary used by slot/count/close changes.
- Change:
  - Added pure `selectedPaneEffectsPlan` to `public/thread-tile-state.js`.
  - `setThreadTileSelectedThread` now delegates to
    `selectedPaneEffectsPlan` and `applyThreadTileSelectedPaneEffects`.
  - The effect preserves old behavior: draft save/restore and Composer refresh
    still happen, `render: false` skips pane patching, and patch misses still
    schedule a full render.
  - Bumped `CLIENT_BUILD_ID` and service worker cache to
    `codex-mobile-shell-v470`.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
- Commit:
  - Runtime/docs commit: `521449d refactor thread tile selected pane effects`.
- Validation in source workspace:
  - Focused suite passed: `67` tests across
    `test/thread-tile-state.test.js`,
    `test/thread-tile-layout-ui.test.js`,
    `test/thread-tile-layout.test.js`, `test/mobile-viewport.test.js`,
    `test/thread-task-card-route.test.js`,
    `test/thread-goal-service.test.js`, and
    `test/composer-draft.test.js`.
  - `npm test` passed: `857` tests.
  - `npm run check`
  - `npm run check:macos`
  - `git diff --check`
- Production deploy:
  - Deployed through Home AI central macOS production script.
  - Reason: `codex-mobile-thread-tile-selected-pane-effects-v470`.
  - Source ref at deploy: `521449d789dd`, dirty `false`.
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T192234Z-plugin-codex-mobile-web-codex-mobile-thread-tile-selected-pane-effects-v470`.
  - LaunchDaemon `system/com.hermesmobile.plugin.codex-mobile` reported
    running and manifest/profile health checks passed.
- Production readback:
  - `/api/public-config` returned
    `clientBuildId=0.1.11|codex-mobile-shell-v470`,
    `shellCacheName=codex-mobile-shell-v470`, and `version=0.1.11`.
  - Source/prod SHA-256 parity matched for:
    `public/thread-tile-state.js`, `test/thread-tile-state.test.js`,
    `test/thread-tile-layout-ui.test.js`, `test/composer-draft.test.js`,
    `public/app.js`, `public/sw.js`, `README.md`,
    `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and `docs/MODULES.md`.
  - Production focused suite passed: same `67` tests listed above with
    production dependencies.
- Next architecture boundary:
  - Continue Phase C by extracting detail read side effects, command detail
    panels, split sizing, per-pane draft/runtime ownership, and max concurrent
    detail reads from `public/app.js`.
  - Phase B large-session cold/warm path remains separate and should be
    tackled with timing evidence before changing cache behavior.
- Public:
  - Not pushed to Public. Follow release-order rule: wait for production/user
    validation or explicit Public instruction before syncing/pushing.

# 2026-06-26 - v469 thread tile pane count/close effects policy deployed

- Scope:
  - Continued Phase C pane-state / split-screen architecture work.
  - This slice moves pane count and close-pane side-effect execution into the
    existing `paneSlotMutationEffectsPlan` /
    `applyThreadTilePaneSlotEffects` path.
  - It does not change server projection, task-card behavior, Home AI
    diagnostic dispatch, message merge, image projection, pane layout, or
    visual pane design. No fallback or UI-only masking was added.
- Root-cause boundary:
  - Before v469, `public/thread-tile-state.js` already owned pane count/close
    planning, but `public/app.js` still executed those two actions through
    dedicated branches that wrote pane count, pinned ids, selection fallback,
    scroll-hold cleanup, settings save, draft restore, Composer refresh, and
    board render directly.
  - That left count/close outside the unified pane slot mutation executor and
    made future pane actions easy to drift from the "pane as scaled
    single-thread window" execution contract.
- Change:
  - Extended `paneSlotMutationEffectsPlan` to emit count/close effect metadata:
    pane-selection fallback policy, optional no-render behavior for count
    changes, close-pane draft save/restore, Composer refresh, scroll reset,
    and full board render intent.
  - `setThreadTilePaneCount` and `closeThreadTilePane` now delegate to
    `paneSlotMutationEffectsPlan` and `applyThreadTilePaneSlotEffects` instead
    of directly writing state and render side effects.
  - `applyThreadTilePaneSlotEffects` now owns `pane-selection` fallback after
    applying pane count/pinned/split writes.
  - Bumped `CLIENT_BUILD_ID` and service worker cache to
    `codex-mobile-shell-v469`.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
- Commit:
  - Runtime/docs commit: `728b005 refactor thread tile pane count effects`.
- Validation in source workspace:
  - Focused suite passed: `67` tests across
    `test/thread-tile-state.test.js`,
    `test/thread-tile-layout-ui.test.js`,
    `test/thread-tile-layout.test.js`, `test/mobile-viewport.test.js`,
    `test/thread-task-card-route.test.js`,
    `test/thread-goal-service.test.js`, and
    `test/composer-draft.test.js`.
  - `npm test` passed: `857` tests.
  - `npm run check`
  - `npm run check:macos`
  - `git diff --check`
- Production deploy:
  - Deployed through Home AI central macOS production script.
  - Reason: `codex-mobile-thread-tile-pane-count-effects-v469`.
  - Source ref at deploy: `728b005319cf`, dirty `false`.
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T191702Z-plugin-codex-mobile-web-codex-mobile-thread-tile-pane-count-effects-v469`.
  - LaunchDaemon `system/com.hermesmobile.plugin.codex-mobile` reported
    running and manifest/profile health checks passed.
- Production readback:
  - `/api/public-config` returned
    `clientBuildId=0.1.11|codex-mobile-shell-v469`,
    `shellCacheName=codex-mobile-shell-v469`, and `version=0.1.11`.
  - Source/prod SHA-256 parity matched for:
    `public/thread-tile-state.js`, `test/thread-tile-state.test.js`,
    `test/thread-tile-layout-ui.test.js`, `test/composer-draft.test.js`,
    `public/app.js`, `public/sw.js`, `README.md`,
    `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and `docs/MODULES.md`.
  - Production focused suite passed: same `67` tests listed above with
    production dependencies.
- Next architecture boundary:
  - Continue Phase C by extracting detail read side effects, command detail
    panels, split sizing, and remaining active-pane execution ownership from
    `public/app.js`.
  - Phase B large-session cold/warm path remains separate and should be
    tackled with timing evidence before changing cache behavior.
- Public:
  - Not pushed to Public. Follow release-order rule: wait for production/user
    validation or explicit Public instruction before syncing/pushing.

# 2026-06-26 - v468 thread tile pane slot effects policy deployed

- Scope:
  - Continued Phase C pane-state / split-screen architecture work.
  - This slice moves pane slot mutation side-effect planning into
    `public/thread-tile-state.js`.
  - It does not change server projection, task-card behavior, Home AI
    diagnostic dispatch, message merge, image projection, pane layout, or the
    visual pane design. No fallback or UI-only masking was added.
- Root-cause boundary:
  - Before v468, `public/app.js` repeated side-effect ordering across pane
    replace, move, split, and thread-list replace-last actions: draft save,
    pinned/split/selected writes, scroll-hold cleanup, settings save, draft
    restore, Composer refresh, detail load, pane patch, scheduled full render,
    or board render.
  - Those repeated branches made each pane action easy to drift from the
    intended "pane as scaled single-thread window" execution contract.
- Change:
  - Added pure `paneSlotMutationEffectsPlan` to
    `public/thread-tile-state.js`.
  - `public/app.js` now converts pane slot mutation plans through
    `threadTileStatePolicy.paneSlotMutationEffectsPlan` and executes the
    result through one `applyThreadTilePaneSlotEffects` helper.
  - The pure plan preserves existing behavior:
    - replace/select saves and restores draft, refreshes active ids, refreshes
      Composer, loads target detail, and either patches the pane or schedules a
      full render;
    - move/split saves and restores draft, writes split pairs, refreshes
      Composer, and renders the tile board with bottom stickiness;
    - thread-list replace-last updates slots, active ids, selected pane, scroll
      holds, and settings without adding draft/Composer/render side effects.
  - Bumped `CLIENT_BUILD_ID` and service worker cache to
    `codex-mobile-shell-v468`.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
- Commit:
  - Runtime/docs commit: `d3f8d4b refactor thread tile pane slot effects`.
- Validation in source workspace:
  - Focused suite passed: `67` tests across
    `test/thread-tile-state.test.js`,
    `test/thread-tile-layout-ui.test.js`,
    `test/thread-tile-layout.test.js`, `test/mobile-viewport.test.js`,
    `test/thread-task-card-route.test.js`, `test/thread-goal-service.test.js`,
    and `test/composer-draft.test.js`.
  - `npm test` passed: `857` tests.
  - `npm run check`
  - `npm run check:macos`
  - `git diff --check`
- Production deploy:
  - Deployed through Home AI central macOS production script.
  - Reason: `codex-mobile-thread-tile-pane-slot-effects-v468`.
  - Source ref at deploy: `d3f8d4b01c69`, dirty `false`.
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T190856Z-plugin-codex-mobile-web-codex-mobile-thread-tile-pane-slot-effects-v468`.
  - LaunchDaemon `system/com.hermesmobile.plugin.codex-mobile` reported
    running and manifest/profile health checks passed.
- Production readback:
  - `/api/public-config` returned
    `clientBuildId=0.1.11|codex-mobile-shell-v468`,
    `shellCacheName=codex-mobile-shell-v468`, and `version=0.1.11`.
  - Source/prod SHA-256 parity matched for:
    `public/thread-tile-state.js`, `test/thread-tile-state.test.js`,
    `test/thread-tile-layout-ui.test.js`, `test/composer-draft.test.js`,
    `public/app.js`, `public/sw.js`, `README.md`,
    `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and `docs/MODULES.md`.
  - Production focused suite passed: same `67` tests listed above with
    production dependencies.
- Next architecture boundary:
  - Continue Phase C by extracting pane count/close side-effect execution,
    detail read side effects, command detail panels, split sizing, and remaining
    active-pane execution ownership from `public/app.js`.
  - Phase B large-session cold/warm path remains separate and should be
    tackled with timing evidence before changing cache behavior.
- Public:
  - Not pushed to Public. Follow release-order rule: wait for production/user
    validation or explicit Public instruction before syncing/pushing.

# 2026-06-26 - v467 thread tile switch menu policy deployed

- Scope:
  - Continued Phase C pane-state / split-screen architecture work.
  - This slice moves thread-tile switch-menu option/control planning into
    `public/thread-tile-state.js`.
  - It does not change server projection, task-card behavior, Home AI
    diagnostic dispatch, message merge, image projection, pane layout, or the
    visual pane design. No fallback or UI-only masking was added.
- Root-cause boundary:
  - Before v467, `public/app.js` still directly owned the switch-menu option
    ordering, running/visible thread mixing, menu open/closed skip behavior,
    and close/add control eligibility.
  - That kept thread title menu behavior coupled to global thread-list state,
    active pane ids, layout count bounds, and HTML rendering.
- Change:
  - Added pure `switchMenuOptionsPlan` and `switchMenuPlan` to
    `public/thread-tile-state.js`.
  - `public/app.js` now supplies current pane id, active ids, running visible
    ids, visible ids, count bounds, and open menu id, then uses the policy plan
    while keeping only thread summary lookup and HTML rendering side effects.
  - The pure plan preserves existing rules: options are ordered as current,
    active panes, running visible threads, then visible threads; close is only
    enabled when the current pane is active and count is above the minimum;
    add is only enabled when count is below the maximum.
  - Bumped `CLIENT_BUILD_ID` and service worker cache to
    `codex-mobile-shell-v467`.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
- Commit:
  - Runtime/docs commit: `5ef53b0 refactor thread tile switch menu policy`.
- Validation in source workspace:
  - Focused suite passed: `62` tests across
    `test/thread-tile-state.test.js`,
    `test/thread-tile-layout-ui.test.js`,
    `test/thread-tile-layout.test.js`, `test/mobile-viewport.test.js`,
    `test/thread-task-card-route.test.js`, and
    `test/thread-goal-service.test.js`.
  - `npm test` passed: `856` tests.
  - `npm run check`
  - `npm run check:macos`
  - `git diff --check`
- Production deploy:
  - Deployed through Home AI central macOS production script.
  - Reason: `codex-mobile-thread-tile-switch-menu-v467`.
  - Source ref at deploy: `5ef53b02e1d3`, dirty `false`.
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T190209Z-plugin-codex-mobile-web-codex-mobile-thread-tile-switch-menu-v467`.
  - LaunchDaemon `system/com.hermesmobile.plugin.codex-mobile` reported
    running and manifest/profile health checks passed.
- Production readback:
  - `/api/public-config` returned
    `clientBuildId=0.1.11|codex-mobile-shell-v467`,
    `shellCacheName=codex-mobile-shell-v467`, and `version=0.1.11`.
  - Source/prod SHA-256 parity matched for:
    `public/thread-tile-state.js`, `test/thread-tile-state.test.js`,
    `test/thread-tile-layout-ui.test.js`, `public/app.js`, `public/sw.js`,
    `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
  - Production focused suite passed: same `62` tests listed above with
    production dependencies.
- Next architecture boundary:
  - Continue Phase C by extracting broader pane action execution
    side-effect plans, detail read side effects, command detail panels, split
    sizing, and remaining active-pane execution ownership from `public/app.js`.
  - Phase B large-session cold/warm path remains separate and should be
    tackled with timing evidence before changing cache behavior.
- Public:
  - Not pushed to Public. Follow release-order rule: wait for production/user
    validation or explicit Public instruction before syncing/pushing.

# 2026-06-26 - v466 thread tile candidate pane id policy deployed

- Scope:
  - Continued Phase C pane-state / split-screen architecture work.
  - This slice moves candidate pane id selection into
    `public/thread-tile-state.js`.
  - It does not change server projection, task-card behavior, Home AI
    diagnostic dispatch, message merge, image projection, pane layout, or the
    visual pane design. No fallback or UI-only masking was added.
- Root-cause boundary:
  - Before v466, `public/app.js` still directly owned candidate pane selection:
    visible pinned filtering, default-candidate fallback, layout-selector
    delegation, and current-thread replacement.
  - That kept stable pane slot selection coupled to global app state, visible
    thread collection, layout policy wiring, and later pane render side
    effects.
- Change:
  - Added pure `candidatePaneIdsPlan` to `public/thread-tile-state.js`.
  - `public/app.js` now collects current visible ids, default candidates,
    current thread id, and layout selector, then delegates candidate id
    planning to `threadTileStatePolicy.candidatePaneIdsPlan`.
  - The pure plan preserves the existing rules: pinned ids must be visible,
    no visible pinned ids falls back to defaults, an available layout selector
    stays authoritative, and the no-selector path keeps the current thread
    inside the candidate window.
  - Bumped `CLIENT_BUILD_ID` and service worker cache to
    `codex-mobile-shell-v466`.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
- Commit:
  - Runtime/docs commit: `c76e0b9 refactor thread tile candidate pane policy`.
- Validation in source workspace:
  - Focused suite passed: `61` tests across
    `test/thread-tile-state.test.js`,
    `test/thread-tile-layout-ui.test.js`,
    `test/thread-tile-layout.test.js`, `test/mobile-viewport.test.js`,
    `test/thread-task-card-route.test.js`, and
    `test/thread-goal-service.test.js`.
  - `npm test` passed: `855` tests.
  - `npm run check`
  - `npm run check:macos`
  - `git diff --check`
- Production deploy:
  - Deployed through Home AI central macOS production script.
  - Reason: `codex-mobile-thread-tile-candidate-pane-v466`.
  - Source ref at deploy: `c76e0b98f0c5`, dirty `false`.
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T185629Z-plugin-codex-mobile-web-codex-mobile-thread-tile-candidate-pane-v466`.
  - LaunchDaemon `system/com.hermesmobile.plugin.codex-mobile` reported
    running and manifest/profile health checks passed.
- Production readback:
  - `/api/public-config` returned
    `clientBuildId=0.1.11|codex-mobile-shell-v466`,
    `shellCacheName=codex-mobile-shell-v466`, and `version=0.1.11`.
  - Source/prod SHA-256 parity matched for:
    `public/thread-tile-state.js`, `test/thread-tile-state.test.js`,
    `test/thread-tile-layout-ui.test.js`, `public/app.js`, `public/sw.js`,
    `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
  - Production focused suite passed: same `61` tests listed above with
    production dependencies.
- Next architecture boundary:
  - Continue Phase C by extracting broader pane action execution
    side-effect plans, detail read side effects, command detail panels, split
    sizing, and remaining active-pane execution ownership from `public/app.js`.
  - Phase B large-session cold/warm path remains separate and should be
    tackled with timing evidence before changing cache behavior.
- Public:
  - Not pushed to Public. Follow release-order rule: wait for production/user
    validation or explicit Public instruction before syncing/pushing.

# 2026-06-26 - v465 thread tile selected pane action policy deployed

- Scope:
  - Continued Phase C pane-state / split-screen architecture work.
  - This slice moves explicit selected-pane action planning into
    `public/thread-tile-state.js`.
  - It does not change server projection, task-card behavior, Home AI
    diagnostic dispatch, message merge, image projection, pane layout, or the
    visual pane design. No fallback or UI-only masking was added.
- Root-cause boundary:
  - Before v465, `public/app.js` still directly owned explicit pane-selection
    validation, unchanged detection, previous/next pane patch target
    selection, and selected-pane state write planning.
  - That kept active-pane execution policy coupled to draft save/restore,
    Composer control updates, pane patching, and full-render fallback.
- Change:
  - Added pure `selectPanePlan` to `public/thread-tile-state.js`.
  - `public/app.js` now delegates `setThreadTileSelectedThread` decision
    logic to `threadTileStatePolicy.selectPanePlan`.
  - `public/app.js` still owns saving/restoring drafts, Composer updates,
    pane patch execution, and full-render fallback if pane patching fails.
  - Bumped `CLIENT_BUILD_ID` and service worker cache to
    `codex-mobile-shell-v465`.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
- Commit:
  - Runtime/docs commit: `0445b4b refactor thread tile selected pane policy`.
- Validation in source workspace:
  - Focused suite passed: `60` tests across
    `test/thread-tile-state.test.js`,
    `test/thread-tile-layout-ui.test.js`,
    `test/thread-tile-layout.test.js`, `test/mobile-viewport.test.js`,
    `test/thread-task-card-route.test.js`, and
    `test/thread-goal-service.test.js`.
  - `npm test` passed: `854` tests.
  - `npm run check`
  - `npm run check:macos`
  - `git diff --check`
- Production deploy:
  - Deployed through Home AI central macOS production script.
  - Reason: `codex-mobile-thread-tile-selected-pane-v465`.
  - Source ref at deploy: `0445b4b05831`, dirty `false`.
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T184841Z-plugin-codex-mobile-web-codex-mobile-thread-tile-selected-pane-v465`.
  - LaunchDaemon `system/com.hermesmobile.plugin.codex-mobile` reported
    running and manifest/profile health checks passed.
- Production readback:
  - `/api/public-config` returned
    `clientBuildId=0.1.11|codex-mobile-shell-v465`,
    `shellCacheName=codex-mobile-shell-v465`, and `version=0.1.11`.
  - Source/prod SHA-256 parity matched for:
    `public/thread-tile-state.js`, `test/thread-tile-state.test.js`,
    `test/thread-tile-layout-ui.test.js`, `public/app.js`, `public/sw.js`,
    `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
  - Production focused suite passed: same `60` tests listed above with
    production dependencies.
- Next architecture boundary:
  - Continue Phase C by extracting broader pane action execution
    side-effect plans, detail read side effects, command detail panels, split
    sizing, and remaining active-pane execution ownership from `public/app.js`.
  - Phase B large-session cold/warm path remains separate and should be
    tackled with timing evidence before changing cache behavior.
- Public:
  - Not pushed to Public. Follow release-order rule: wait for production/user
    validation or explicit Public instruction before syncing/pushing.

# 2026-06-26 - v464 thread tile active pane sync policy deployed

- Scope:
  - Continued Phase C pane-state / split-screen architecture work.
  - This slice moves active-pane sync planning into
    `public/thread-tile-state.js`.
  - It does not change server projection, task-card behavior, Home AI
    diagnostic dispatch, message merge, image projection, pane layout, or the
    visual pane design. No fallback or UI-only masking was added.
- Root-cause boundary:
  - Before v464, `public/app.js` still split active pane sync across
    `ensureThreadTileDetails`, `syncThreadTilePinnedIdsFromActiveIds`, and
    `syncThreadTileSelectedThread`.
  - That kept active ids, pinned-slot sync, split-pair pruning,
    selected-pane fallback, and settings-save eligibility as separate app
    decisions even though they form one pane-state invariant.
- Change:
  - Added pure `activePaneSyncPlan` to `public/thread-tile-state.js`.
  - `public/app.js` now uses `syncThreadTileActivePaneState` to execute the
    policy plan and only owns state writes, controller cleanup, detail loads,
    tile refresh scheduling, and display-settings persistence side effects.
  - Removed the separate app-level selected-pane sync helper.
  - Bumped `CLIENT_BUILD_ID` and service worker cache to
    `codex-mobile-shell-v464`.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
- Commit:
  - Runtime/docs commit: `574c74d refactor thread tile active pane sync policy`.
- Validation in source workspace:
  - Focused suite passed: `59` tests across
    `test/thread-tile-state.test.js`,
    `test/thread-tile-layout-ui.test.js`,
    `test/thread-tile-layout.test.js`, `test/mobile-viewport.test.js`,
    `test/thread-task-card-route.test.js`, and
    `test/thread-goal-service.test.js`.
  - `npm test` passed: `853` tests.
  - `npm run check`
  - `npm run check:macos`
  - `git diff --check`
- Production deploy:
  - Deployed through Home AI central macOS production script.
  - Reason: `codex-mobile-thread-tile-active-pane-sync-v464`.
  - Source ref at deploy: `574c74d11b56`, dirty `false`.
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T184417Z-plugin-codex-mobile-web-codex-mobile-thread-tile-active-pane-sync-v464`.
  - LaunchDaemon `system/com.hermesmobile.plugin.codex-mobile` reported
    running and manifest/profile health checks passed.
- Production readback:
  - `/api/public-config` returned
    `clientBuildId=0.1.11|codex-mobile-shell-v464`,
    `shellCacheName=codex-mobile-shell-v464`, and `version=0.1.11`.
  - Source/prod SHA-256 parity matched for:
    `public/thread-tile-state.js`, `test/thread-tile-state.test.js`,
    `test/thread-tile-layout-ui.test.js`, `public/app.js`, `public/sw.js`,
    `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
  - Production focused suite passed: same `59` tests listed above with
    production dependencies.
- Next architecture boundary:
  - Continue Phase C by extracting pane action execution side-effect plans,
    detail read side effects, command detail panels, split sizing, and
    active-pane execution ownership from `public/app.js`.
  - Phase B large-session cold/warm path remains separate and should be
    tackled with timing evidence before changing cache behavior.
- Public:
  - Not pushed to Public. Follow release-order rule: wait for production/user
    validation or explicit Public instruction before syncing/pushing.

# 2026-06-26 - v463 thread tile pane count/close policy deployed

- Scope:
  - Continued Phase C pane-state / split-screen architecture work.
  - This slice moves pane count changes, pane close planning, and selected-pane
    fallback into `public/thread-tile-state.js`.
  - It does not change server projection, task-card behavior, Home AI
    diagnostic dispatch, message merge, image projection, or the visual pane
    design. No fallback or UI-only masking was added.
- Root-cause boundary:
  - Before v463, `public/app.js` still directly owned pane-count bounds,
    unchanged detection, close eligibility, pinned-slot fill, close scroll
    reset ids, and selected-pane fallback after pane count/close operations.
  - That kept stable pane state coupled to draft restore, Composer target
    updates, display settings persistence, and render side effects.
- Change:
  - Added pure thread-tile helpers: `paneCountChangePlan`,
    `closePanePlan`, and `paneSelectionPlan`.
  - `public/app.js` now delegates `setThreadTilePaneCount` and
    `closeThreadTilePane` state decisions to `threadTileStatePolicy`.
  - `public/app.js` still owns saving/restoring drafts, state mutation,
    scroll-hold Map cleanup, Composer control updates, rendering, and settings
    persistence.
  - Bumped `CLIENT_BUILD_ID` and service worker cache to
    `codex-mobile-shell-v463`.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
- Commit:
  - Runtime/docs commit: `6b46307 refactor thread tile pane count policy`.
- Validation in source workspace:
  - Focused suite passed: `58` tests across
    `test/thread-tile-state.test.js`,
    `test/thread-tile-layout-ui.test.js`,
    `test/thread-tile-layout.test.js`, `test/mobile-viewport.test.js`,
    `test/thread-task-card-route.test.js`, and
    `test/thread-goal-service.test.js`.
  - `npm test` passed: `852` tests.
  - `npm run check`
  - `npm run check:macos`
  - `git diff --check`
- Production deploy:
  - Deployed through Home AI central macOS production script.
  - Reason: `codex-mobile-thread-tile-pane-count-v463`.
  - Source ref at deploy: `6b463076d017`, dirty `false`.
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T183835Z-plugin-codex-mobile-web-codex-mobile-thread-tile-pane-count-v463`.
  - LaunchDaemon `system/com.hermesmobile.plugin.codex-mobile` reported
    running and manifest/profile health checks passed.
- Production readback:
  - `/api/public-config` returned
    `clientBuildId=0.1.11|codex-mobile-shell-v463`,
    `shellCacheName=codex-mobile-shell-v463`, and `version=0.1.11`.
  - Source/prod SHA-256 parity matched for:
    `public/thread-tile-state.js`, `test/thread-tile-state.test.js`,
    `test/thread-tile-layout-ui.test.js`, `public/app.js`, `public/sw.js`,
    `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
  - Production focused suite passed: same `58` tests listed above with
    production dependencies.
- Next architecture boundary:
  - Continue Phase C by extracting pane action execution side-effect plans,
    detail read side effects, command detail panels, split sizing, and
    active-pane execution ownership from `public/app.js`.
  - Phase B large-session cold/warm path remains separate and should be
    tackled with timing evidence before changing cache behavior.
- Public:
  - Not pushed to Public. Follow release-order rule: wait for production/user
    validation or explicit Public instruction before syncing/pushing.

# 2026-06-26 - v462 thread tile pane slot mutation policy deployed

- Scope:
  - Continued Phase C pane-state / split-screen architecture work.
  - This slice moves pane slot mutation planning into
    `public/thread-tile-state.js`.
  - It does not change server projection, task-card behavior, Home AI
    diagnostic dispatch, message merge, image projection, or the visual pane
    design. No fallback or UI-only masking was added.
- Root-cause boundary:
  - Before v462, `public/app.js` directly owned pane thread replacement,
    duplicate thread swap, drag reorder, up/down split-pair placement,
    thread-list-open replacement of the last pane, and drop-zone geometry
    classification.
  - That kept stable pane slot ownership coupled to draft restore, API loads,
    DOM patching, and render side effects, which made split-screen slot
    regressions harder to test independently.
- Change:
  - Added pure thread-tile slot mutation helpers:
    `replacePaneThreadPlan`, `movePaneRelativePlan`,
    `splitPaneWithTargetPlan`, `replaceLastPaneForThreadListOpenPlan`, and
    `dropPaneIntent`.
  - `public/app.js` now delegates pane thread switching, drag reorder,
    up/down split placement, thread-list-open replacement, and drop-zone
    selection to `threadTileStatePolicy`.
  - Removed the old app-level split-pair mutation wrappers that were no
    longer needed after the plan extraction.
  - `public/app.js` still owns saving/restoring drafts, Composer target
    updates, detail loads, Map/Set mutation, pane/full render, and display
    settings persistence.
  - Bumped `CLIENT_BUILD_ID` and service worker cache to
    `codex-mobile-shell-v462`.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
- Commit:
  - Runtime/docs commit: `5ea875f refactor thread tile slot mutation policy`.
- Validation in source workspace:
  - Focused suite passed: `56` tests across
    `test/thread-tile-state.test.js`,
    `test/thread-tile-layout-ui.test.js`,
    `test/thread-tile-layout.test.js`, `test/mobile-viewport.test.js`,
    `test/thread-task-card-route.test.js`, and
    `test/thread-goal-service.test.js`.
  - `npm test` passed: `850` tests.
  - `npm run check`
  - `npm run check:macos`
  - `git diff --check`
- Production deploy:
  - Deployed through Home AI central macOS production script.
  - Reason: `codex-mobile-thread-tile-slot-mutation-v462`.
  - Source ref at deploy: `5ea875ffef9a`, dirty `false`.
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T182742Z-plugin-codex-mobile-web-codex-mobile-thread-tile-slot-mutation-v462`.
  - LaunchDaemon `system/com.hermesmobile.plugin.codex-mobile` reported
    running and manifest/profile health checks passed.
- Production readback:
  - `/api/public-config` returned
    `clientBuildId=0.1.11|codex-mobile-shell-v462`,
    `shellCacheName=codex-mobile-shell-v462`, `version=0.1.11`, and active
    profile `previous`.
  - Source/prod SHA-256 parity matched for:
    `public/thread-tile-state.js`, `test/thread-tile-state.test.js`,
    `test/thread-tile-layout-ui.test.js`, `public/app.js`, `public/sw.js`,
    `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
  - Production focused suite passed: same `56` tests listed above with
    production dependencies.
- Next architecture boundary:
  - Continue Phase C by extracting pane action execution side-effect plans,
    detail read side effects, command detail panels, split sizing, and
    active-pane execution ownership from `public/app.js`.
  - Phase B large-session cold/warm path remains separate and should be
    tackled with timing evidence before changing cache behavior.
- Public:
  - Not pushed to Public. Follow release-order rule: wait for production/user
    validation or explicit Public instruction before syncing/pushing.

# 2026-06-26 - v461 thread tile detail refresh policy deployed

- Scope:
  - Continued Phase C pane-state / split-screen architecture work.
  - This slice moves pane-local detail refresh planning into
    `public/thread-tile-state.js`.
  - It does not change server projection, task-card behavior, Home AI
    diagnostic dispatch, message merge, image projection, or the visual pane
    design. No fallback or UI-only masking was added.
- Root-cause boundary:
  - Before v461, `public/app.js` directly owned pane refresh timer scheduling,
    visible-target selection, current-thread exclusion, duplicate id collapse,
    detail-load skip checks, background-refresh classification, loading/error
    marker decisions, controller checks, and minimum refresh interval checks.
  - That kept pane-local refresh ownership coupled to DOM/API side effects and
    made split-screen refresh regressions harder to test as pure state policy.
- Change:
  - Added pure thread-tile refresh helpers:
    `uniqueIds`, `refreshDelayMs`, `refreshSchedulePlan`,
    `refreshTargetIds`, and `detailLoadPlan`.
  - `public/app.js` now delegates pane refresh scheduling, target selection,
    and detail-load skip/background/loading decisions to
    `threadTileStatePolicy`.
  - `public/app.js` still owns AbortController, API reads, loading/error Map
    mutation, render scheduling, thread-list merge, timers, and DOM patch
    side effects.
  - Bumped `CLIENT_BUILD_ID` and service worker cache to
    `codex-mobile-shell-v461`.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
- Commit:
  - Runtime/docs commit: `83f9c82 refactor thread tile refresh policy`.
- Validation in source workspace:
  - Focused suite passed: `53` tests across
    `test/thread-tile-state.test.js`,
    `test/thread-tile-layout-ui.test.js`,
    `test/thread-tile-layout.test.js`, `test/mobile-viewport.test.js`,
    `test/thread-task-card-route.test.js`, and
    `test/thread-goal-service.test.js`.
  - `npm test` passed: `847` tests.
  - `npm run check`
  - `npm run check:macos`
  - `git diff --check`
- Production deploy:
  - Deployed through Home AI central macOS production script.
  - Reason: `codex-mobile-thread-tile-refresh-policy-v461`.
  - Source ref at deploy: `83f9c82461f7`, dirty `false`.
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T181743Z-plugin-codex-mobile-web-codex-mobile-thread-tile-refresh-policy-v461`.
  - LaunchDaemon `system/com.hermesmobile.plugin.codex-mobile` reported
    running and manifest/profile health checks passed.
- Production readback:
  - `/api/public-config` returned
    `clientBuildId=0.1.11|codex-mobile-shell-v461`,
    `shellCacheName=codex-mobile-shell-v461`, `version=0.1.11`, and active
    profile `previous`.
  - Source/prod SHA-256 parity matched for:
    `public/thread-tile-state.js`, `test/thread-tile-state.test.js`,
    `test/thread-tile-layout-ui.test.js`, `public/app.js`, `public/sw.js`,
    `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
  - Production focused suite passed: same `53` tests listed above with
    production dependencies.
- Next architecture boundary:
  - Continue Phase C by extracting pane action execution, detail read side
    effects, command detail panels, split sizing, and active-pane execution
    ownership from `public/app.js`.
  - Phase B large-session cold/warm path remains separate and should be
    tackled with timing evidence before changing cache behavior.
- Public:
  - Not pushed to Public. Follow release-order rule: wait for production/user
    validation or explicit Public instruction before syncing/pushing.

# 2026-06-26 - v458 thread tile action recognition deployed

- Optimization phase:
  - Phase A eleventh slice. v457 moved single-thread thread-detail click
    action recognition into `public/thread-detail-actions.js`; v458 moves
    thread-tile interaction recognition into a dedicated helper.
- Root-cause boundary:
  - Before v458, `public/app.js` directly owned selector priority and target
    classification for thread-tile pane selection, title switch menu, pane
    thread switching, add/close pane controls, bottom jump, operation toggle,
    scroll target detection, and drag/drop target detection.
  - That kept split-screen interaction policy coupled to the main app
    coordinator and made pane interaction regressions harder to test without
    broad UI source-string assertions.
- Runtime change:
  - Added `public/thread-tile-actions.js`.
  - The helper exposes `resolveThreadTilePointerAction`,
    `resolveThreadTileFocusAction`, `resolveThreadTileClickAction`,
    `resolveThreadTileScrollAction`, `resolveThreadTileDragStartAction`,
    `resolveThreadTileDragOverAction`,
    `resolveThreadTileDragLeaveAction`, and
    `resolveThreadTileDropAction`.
  - The helper owns root containment, thread-tile selector priority, disabled
    control classification, and stable action plan fields.
  - `public/app.js` still owns event listener wiring and calls the existing
    business functions (`setThreadTileSelectedThread`,
    `toggleThreadTileSwitchMenu`, `replaceThreadTilePaneThread`,
    `changeThreadTilePaneCount`, `closeThreadTilePane`,
    `scrollThreadTilePaneToBottom`, `patchThreadTilePane`,
    `scheduleRenderCurrentThread`, and `dropThreadTilePane`).
  - No pane layout fallback, duplicate filtering, hidden refresh fallback,
    synthesized content, or task-card protocol behavior was added.
  - `CLIENT_BUILD_ID` and service-worker cache are bumped to
    `codex-mobile-shell-v458`; the new helper is registered in `index.html`,
    the app-shell asset list, the service worker, server build identity, and
    `npm run check`.
- Docs/tests:
  - `README.md` records the v458 architecture slice.
  - `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md` records that thread-tile
    interaction recognition is now outside `public/app.js`; action execution
    and pane-state execution ownership remain later boundaries.
  - `docs/MODULES.md` maps `public/thread-tile-actions.js` and its focused
    test.
  - Added `test/thread-tile-actions.test.js` for pane selection, control stop,
    click actions, disabled controls, root containment, and drag/drop
    classification.
  - Existing tile UI wiring tests now assert that `bindThreadTileActions`
    delegates recognition through `CodexThreadTileActions`.
- Validation:
  - Focused source suite passed:
    `node --test test/thread-tile-actions.test.js
    test/thread-tile-layout-ui.test.js test/thread-tile-layout.test.js
    test/mobile-viewport.test.js test/app-update.test.js
    test/plugin-voice-input.test.js test/thread-task-card-route.test.js
    test/thread-goal-service.test.js` (`61` tests).
  - Full source `npm test` passed (`836` tests).
  - Source `npm run check`, `npm run check:macos`, and `git diff --check`
    passed.
  - Production focused suite passed with `NODE_PATH` pointed at production
    dependencies (`61` tests).
- Commit/deploy:
  - Runtime commit: `57ab797` (`refactor thread tile action recognition`).
  - Deployed with Home AI central macOS script:
    `deploy-macos-production.js --plugin codex-mobile --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --reason codex-mobile-thread-tile-actions-v458 --execute --json`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T174921Z-plugin-codex-mobile-web-codex-mobile-thread-tile-actions-v458`.
  - Production `/api/public-config` reports
    `clientBuildId=0.1.11|codex-mobile-shell-v458`,
    `shellCacheName=codex-mobile-shell-v458`, and `version=0.1.11`.
  - Source/prod SHA-256 parity confirmed for `server.js`, `package.json`,
    changed public files, docs, and focused test files.
- Follow-up:
  - Phase A remains active. The next frontend boundary is action execution
    ownership and pane-state execution ownership, unless the next production
    signal points to Phase B large-session cold-path work.
  - This was deployed locally/production only. Do not push Public unless the
    user explicitly requests it after production validation.

# 2026-06-26 - v457 thread detail action recognition deployed

- Optimization phase:
  - Phase A tenth slice. v456 moved thread-detail surface hydration
    orchestration into `public/thread-detail-dom-patch.js`; v457 moves
    conversation/thread-detail click action recognition into a dedicated
    helper.
- Root-cause boundary:
  - Before v457, the `public/app.js` conversation click listener directly
    owned selector priority and target classification for image preview,
    copy controls, local-file previews, Mermaid controls, GitHub preview
    toggles, approval answers, task-card actions/drafts, and server-response
    controls.
  - That made event recognition harder to test independently from business
    execution and kept more UI state-machine policy inside the large app
    coordinator.
- Runtime change:
  - Added `public/thread-detail-actions.js`.
  - The helper exposes `previewableImageFromTarget`,
    `resolveRichContentClickAction`, and `resolveThreadDetailClickAction`.
  - The helper owns root containment, selector priority, previewable-image
    detection, rich-content action classification, approval action
    classification, task-card action/draft classification, and server-response
    classification.
  - `public/app.js` still owns event listener wiring and calls the existing
    business functions (`openImagePreviewFromImage`,
    `handleCopyButtonClick`, `openLocalFilePreview`, `handleMermaidAction`,
    `toggleGitHubLinkPreview`, `answerApproval`, `replyTaskCard`,
    `mutateThreadTaskCard`, `dismissThreadTaskCardDraft`,
    `answerServerRequest`, and `declineServerRequest`).
  - No duplicate filtering, hidden refresh fallback, synthesized content, or
    task-card protocol behavior was added.
  - `CLIENT_BUILD_ID` and service-worker cache are bumped to
    `codex-mobile-shell-v457`; the new helper is registered in `index.html`,
    the app-shell asset list, the service worker, server build identity, and
    `npm run check`.
- Docs/tests:
  - `README.md` records the v457 architecture slice.
  - `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md` records action recognition as
    outside `public/app.js`, with action execution and thread-tile action
    recognition remaining as the next boundary.
  - `docs/MODULES.md` maps `public/thread-detail-actions.js` and its focused
    test.
  - Added `test/thread-detail-actions.test.js` for previewable image
    detection, GitHub-card exclusion, selector priority, root containment,
    approval/task-card controls, drafts, server responses, and declines.
  - Existing UI wiring tests now assert that the shell loads
    `thread-detail-actions.js` and that conversation click handling depends
    on `CodexThreadDetailActions`.
- Validation:
  - Full source `npm test` passed (`831` tests).
  - Source `npm run check`, `npm run check:macos`, and `git diff --check`
    passed.
  - Production focused suite passed with `NODE_PATH` pointed at production
    dependencies:
    `test/thread-detail-actions.test.js`,
    `test/conversation-render.test.js`,
    `test/thread-task-card-route.test.js`,
    `test/mobile-viewport.test.js`, `test/app-update.test.js`,
    `test/plugin-voice-input.test.js`, and
    `test/thread-tile-layout-ui.test.js` (`137` tests).
- Commit/deploy:
  - Runtime commit: `3d82197` (`refactor thread detail action recognition`).
  - Deployed with Home AI central macOS script:
    `deploy-macos-production.js --plugin codex-mobile --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --reason codex-mobile-thread-detail-actions-v457 --execute --json`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T174033Z-plugin-codex-mobile-web-codex-mobile-thread-detail-actions-v457`.
  - Production `/api/public-config` reports
    `clientBuildId=0.1.11|codex-mobile-shell-v457`,
    `shellCacheName=codex-mobile-shell-v457`, and `version=0.1.11`.
  - Source/prod SHA-256 parity confirmed for `server.js`, `package.json`,
    changed public files, docs, and focused test files.
- Follow-up:
  - Phase A remains active. The next frontend boundary is action execution and
    thread-tile action recognition, unless the next user-visible incident
    points to a higher-priority Phase B cold-path or projection mismatch issue.
  - This was deployed locally/production only. Do not push Public unless the
    user explicitly requests it after production validation.

# 2026-06-26 - v456 thread detail hydration orchestration deployed

- Optimization phase:
  - Phase A ninth slice. v455 moved rendered turn article creation for
    insert/replace paths into `public/thread-detail-dom-patch.js`; v456 moves
    thread-detail surface hydration orchestration into the same helper.
- Root-cause boundary:
  - Before v456, `public/app.js` directly sequenced post-render hydration in
    several places: full conversation render, thread tile pane patch, and local
    DOM patch completion each called GitHub link hydration, Mermaid hydration,
    and image scan scheduling themselves.
  - That kept callback ordering and image-scan delay forwarding in the app
    coordinator even after the surrounding DOM patch execution had moved into
    `public/thread-detail-dom-patch.js`.
- Runtime change:
  - `public/thread-detail-dom-patch.js` now exposes
    `hydrateRenderedSurface`.
  - `public/app.js` adds a thin `hydrateThreadDetailSurface` wrapper that
    injects the existing `hydrateGitHubLinkCards`,
    `hydrateMermaidDiagrams`, and `scheduleFailedAppImageScan` callbacks.
  - Full conversation render, thread tile pane patch, and local patch
    completion now route through the wrapper.
  - Same-signature conversation updates preserve the old behavior by running
    only image scanning with `[0, 180]` delays and skipping GitHub/Mermaid rich
    hydration.
  - The helper does not catch callback errors, suppress refreshes, filter
    duplicate messages, synthesize content, or change image/Markdown rendering
    rules.
  - `CLIENT_BUILD_ID` and service-worker cache are bumped to
    `codex-mobile-shell-v456`.
- Docs/tests:
  - `README.md` records the v456 architecture slice.
  - `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md` records that hydration
    orchestration is now outside `public/app.js` for thread-detail surfaces.
  - `docs/MODULES.md` maps hydration orchestration ownership to
    `public/thread-detail-dom-patch.js`.
  - `test/thread-detail-dom-patch.test.js` covers hydration callback order,
    image-scan delay forwarding, bounded missing-root result, and callback
    error propagation.
  - `test/mobile-viewport.test.js`, `test/conversation-render.test.js`,
    `test/github-link-preview-ui.test.js`, and `test/mermaid-render.test.js`
    assert the new wiring without requiring old direct app-level conversation
    hydration calls.
- Validation:
  - Focused source suite passed:
    `node --test test/github-link-preview-ui.test.js
    test/mermaid-render.test.js test/thread-detail-dom-patch.test.js
    test/mobile-viewport.test.js test/conversation-render.test.js`
    (`137` tests).
  - Full `npm test` passed (`826` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Commit/deploy:
  - Runtime commit: `e3f8f73` (`refactor thread detail hydration
    orchestration`).
  - Deployed with Home AI central macOS script:
    `deploy-macos-production.js --plugin codex-mobile --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --reason codex-mobile-thread-detail-hydration-v456 --execute --json`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T172706Z-plugin-codex-mobile-web-codex-mobile-thread-detail-hydration-v456`.
  - Production `/api/public-config` reports
    `clientBuildId=0.1.11|codex-mobile-shell-v456`,
    `shellCacheName=codex-mobile-shell-v456`, and `version=0.1.11`.
  - Source/prod SHA-256 parity confirmed for changed runtime/test/doc files.
  - Production focused suite passed with `NODE_PATH` pointed at production
    dependencies (`176` tests).
- Production observation:
  - Bounded log-tail aggregation after deploy found no v456/v455/v454/v453/v452
    `thread_refresh_ms` client events yet; the recent sample contained `102`
    v447 events and `1250` events with missing client build id.
  - This is not evidence of v456 failure. It means refreshed v456 clients have
    not yet produced that metric in the sampled tail.
- Follow-up:
  - Remaining Phase A boundary is action binding. After that, proceed to
    Phase B large-session cold/warm path evidence unless a higher-priority
    production incident appears.
  - The broader system optimization goal remains active and incomplete.
  - This was deployed locally/production only. Do not push Public unless the
    user explicitly requests it after production validation.

# 2026-06-26 - v455 turn article creation deployed

- Optimization phase:
  - Phase A eighth slice. v454 moved turn article render-key lookup into
    `public/thread-detail-dom-patch.js`; v455 moves rendered turn article
    creation for insert/replace paths into the same helper.
- Root-cause boundary:
  - Before v455, `insertTurnArticleDom` and the refresh patch
    `renderTurnElement` callback in `public/app.js` still directly performed
    `renderTurn(...) -> firstElementFromHtml(...)`.
  - This kept the DOM element creation step in the app coordinator even though
    turn-level patch execution, insertion anchoring, and lookup had already
    moved to the helper.
- Runtime change:
  - `public/thread-detail-dom-patch.js` now exposes
    `createElementFromHtml` and `createTurnArticleElement`.
  - `public/app.js` still owns `renderTurn` and injects the browser `document`,
    but no longer creates turn article elements directly for insert/replace
    patch paths.
  - `firstElementFromHtml` remains as a compatibility wrapper and delegates to
    `threadDetailDomPatchApi.createElementFromHtml`.
  - Blank HTML, missing document, template creation exceptions, missing turn,
    missing renderer, and renderer exceptions return `null`. No duplicate
    filtering, skipped refresh, forced reload, or synthetic content fallback
    was added.
  - `CLIENT_BUILD_ID` and service-worker cache are bumped to
    `codex-mobile-shell-v455`.
- Docs/tests:
  - `README.md` records the v455 architecture slice.
  - `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md` records that turn article element
    creation is now outside `public/app.js` for insert/replace paths.
  - `docs/MODULES.md` maps creation ownership to
    `public/thread-detail-dom-patch.js`.
  - `test/thread-detail-dom-patch.test.js` covers HTML creation, renderer
    injection, missing input, document failure, and render failure behavior.
  - `test/mobile-viewport.test.js` asserts that `firstElementFromHtml`,
    `insertTurnArticleDom`, and refresh patch `renderTurnElement` delegate to
    the helper.
- Validation:
  - Syntax checks passed for `public/thread-detail-dom-patch.js`,
    `public/app.js`, and `public/sw.js`.
  - Focused source suite passed:
    `node --test test/thread-detail-dom-patch.test.js
    test/thread-detail-patch-plan.test.js test/conversation-render.test.js
    test/mobile-viewport.test.js test/app-update.test.js
    test/plugin-voice-input.test.js test/thread-tile-layout-ui.test.js
    test/thread-task-card-route.test.js test/thread-goal-service.test.js`
    (`160` tests).
  - Full `npm test` passed (`822` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Commit/deploy:
  - Runtime commit: `dab1dd5` (`refactor turn article creation`).
  - Deployed with Home AI central macOS script:
    `deploy-macos-production.js --plugin codex-mobile --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --reason codex-mobile-turn-article-creation-v455 --execute --json`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T171702Z-plugin-codex-mobile-web-codex-mobile-turn-article-creation-v455`.
  - Production `/api/public-config` reports
    `clientBuildId=0.1.11|codex-mobile-shell-v455`,
    `shellCacheName=codex-mobile-shell-v455`, and `version=0.1.11`.
  - Source/prod SHA-256 parity confirmed for changed runtime/test/doc files.
  - Production focused suite passed with `NODE_PATH` pointed at production
    dependencies (`160` tests).
- Production observation:
  - Bounded log-tail aggregation after deploy found no v455/v454/v453/v452/v451
    `thread_refresh_ms` client events yet; the recent sample contained `102`
    v447 events and `1250` events with missing client build id.
  - This is not evidence of v455 failure. It means refreshed v455 clients have
    not yet produced that metric in the sampled tail.
- Follow-up:
  - Remaining Phase A boundaries are hydration and action binding.
  - The broader system optimization goal remains active and incomplete. After
    these DOM boundaries are extracted or deliberately deferred, proceed to
    Phase B large-session cold/warm path evidence.
  - This was deployed locally/production only. Do not push Public unless the
    user explicitly requests it after production validation.

# 2026-06-26 - v454 turn article lookup deployed

- Optimization phase:
  - Phase A seventh slice. v453 moved new turn article insertion anchoring into
    `public/thread-detail-dom-patch.js`; v454 moves the single-thread turn
    article render-key lookup selector into the same helper.
- Root-cause boundary:
  - Before v454, `turnArticleNode` in `public/app.js` still built and queried
    `[data-render-key=...]` directly. That kept part of turn DOM lookup policy
    in the app coordinator while the surrounding patch executor had already
    moved out.
  - This change narrows `public/app.js` to computing `stableTurnKey` and
    injecting the existing selector-escape function. It does not change turn
    ordering, rendering, hydration, or action binding.
- Runtime change:
  - `public/thread-detail-dom-patch.js` now exposes
    `findElementByRenderKey` and `findTurnArticleElement`.
  - The helper returns `null` for missing root, missing key, missing
    `querySelector`, or selector exceptions. It does not hide duplicate
    messages, skip refresh, force reload, or synthesize missing content.
  - `turnArticleNode` delegates to `threadDetailDomPatchApi.findTurnArticleElement`.
  - `CLIENT_BUILD_ID` and service-worker cache are bumped to
    `codex-mobile-shell-v454`.
- Docs/tests:
  - `README.md` records the v454 architecture slice.
  - `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md` records that turn article
    render-key lookup is now outside `public/app.js`.
  - `docs/MODULES.md` maps lookup ownership to
    `public/thread-detail-dom-patch.js`.
  - `test/thread-detail-dom-patch.test.js` covers normal lookup, missing
    root/key, and selector exception behavior.
  - `test/mobile-viewport.test.js` asserts that `turnArticleNode` delegates to
    the helper and no longer directly queries the render-key selector.
- Validation:
  - Syntax checks passed for `public/thread-detail-dom-patch.js`,
    `public/app.js`, and `public/sw.js`.
  - Focused source suite passed:
    `node --test test/thread-detail-dom-patch.test.js
    test/thread-detail-patch-plan.test.js test/conversation-render.test.js
    test/mobile-viewport.test.js test/app-update.test.js
    test/plugin-voice-input.test.js test/thread-tile-layout-ui.test.js
    test/thread-task-card-route.test.js test/thread-goal-service.test.js`
    (`156` tests).
  - Full `npm test` passed (`818` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Commit/deploy:
  - Runtime commit: `ace9e0b` (`refactor turn article lookup`).
  - Deployed with Home AI central macOS script:
    `deploy-macos-production.js --plugin codex-mobile --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --reason codex-mobile-turn-article-lookup-v454 --execute --json`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T171105Z-plugin-codex-mobile-web-codex-mobile-turn-article-lookup-v454`.
  - Production `/api/public-config` reports
    `clientBuildId=0.1.11|codex-mobile-shell-v454`,
    `shellCacheName=codex-mobile-shell-v454`, and `version=0.1.11`.
  - Source/prod SHA-256 parity confirmed for changed runtime/test/doc files.
  - Production focused suite passed with `NODE_PATH` pointed at production
    dependencies (`156` tests).
- Production observation:
  - Bounded log-tail aggregation after deploy found no v454/v453/v452/v451/v450
    `thread_refresh_ms` client events yet; the recent sample contained `102`
    v447 events and `1250` events with missing client build id.
  - This is not evidence of v454 failure. It means refreshed v454 clients have
    not yet produced that metric in the sampled tail.
- Follow-up:
  - Remaining Phase A boundaries are now turn node creation, hydration, and
    action binding.
  - The broader system optimization goal remains active and incomplete. After
    these DOM boundaries are extracted or deliberately deferred, proceed to
    Phase B large-session cold/warm path evidence.
  - This was deployed locally/production only. Do not push Public unless the
    user explicitly requests it after production validation.

# 2026-06-26 - v453 turn article insertion anchoring deployed

- Optimization phase:
  - Phase A sixth slice. v451 moved visible-item DOM patch execution out of
    `public/app.js`; v452 moved turn-level refresh patch operation execution
    out of `patchCurrentThreadDetailFromRefresh`; v453 moves newly rendered
    turn article insertion anchoring into `public/thread-detail-dom-patch.js`.
- Root-cause boundary:
  - Before v453, `insertTurnArticleElementDom` in `public/app.js` still owned
    the insertion-anchor rule for a new rendered turn article: scan backward
    through visible turns, insert after the nearest rendered previous turn,
    otherwise insert before the first `.turn`, otherwise append.
  - That kept ordering/anchoring policy inside the app coordinator even after
    turn-level DOM patch execution had been extracted.
- Runtime change:
  - `public/thread-detail-dom-patch.js` now exposes
    `resolveTurnInsertAnchor` and `insertTurnArticleElement`.
  - The helper owns the after-previous / before-first / append decision and
    returns bounded results/reasons for invalid turn, invalid source, missing
    conversation insertion API, and insert exceptions.
  - `public/app.js` now injects the concrete DOM lookups only:
    `visibleTurnsForConversation`, `turnArticleNode`, and first `.turn`
    lookup. It no longer contains the backward insertion-anchor loop.
  - No duplicate filtering, skipped refresh, forced reload, or hidden fallback
    was added.
  - `CLIENT_BUILD_ID` and service-worker cache are bumped to
    `codex-mobile-shell-v453`.
- Docs/tests:
  - `README.md` records the v453 architecture slice.
  - `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md` records that turn article
    insertion anchoring is now outside `public/app.js`.
  - `docs/MODULES.md` maps `public/thread-detail-dom-patch.js` to visible-item
    patch execution, turn-level patch execution, and turn article insertion
    anchoring.
  - `test/thread-detail-dom-patch.test.js` covers after-previous insertion,
    before-first/append fallback, and bounded failure reasons.
  - Build/static tests assert `insertTurnArticleElementDom` delegates to the
    helper and no longer owns the old backward scan.
- Validation:
  - Syntax checks passed for `public/thread-detail-dom-patch.js`,
    `public/app.js`, and `public/sw.js`.
  - Focused source suite passed:
    `node --test test/thread-detail-dom-patch.test.js
    test/thread-detail-patch-plan.test.js test/conversation-render.test.js
    test/mobile-viewport.test.js test/app-update.test.js
    test/plugin-voice-input.test.js test/thread-tile-layout-ui.test.js
    test/thread-task-card-route.test.js test/thread-goal-service.test.js`
    (`154` tests).
  - Full `npm test` passed (`816` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Commit/deploy:
  - Runtime commit: `f1dcf8c` (`refactor turn article anchoring`).
  - Deployed with Home AI central macOS script:
    `deploy-macos-production.js --plugin codex-mobile --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --reason codex-mobile-turn-article-anchoring-v453 --execute --json`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T170451Z-plugin-codex-mobile-web-codex-mobile-turn-article-anchoring-v453`.
  - Production `/api/public-config` reports
    `clientBuildId=0.1.11|codex-mobile-shell-v453`,
    `shellCacheName=codex-mobile-shell-v453`, and `version=0.1.11`.
  - Source/prod SHA-256 parity confirmed for changed runtime/test/doc files.
  - Production focused suite passed with `NODE_PATH` pointed at production
    dependencies (`154` tests).
- Production observation:
  - Bounded log-tail aggregation after deploy found no v453/v452/v451/v450/v449
    `thread_refresh_ms` client events yet; the recent sample contained `102`
    v447 events and `1250` events with missing client build id.
  - This is not evidence of v453 failure. It means refreshed v453 clients have
    not yet produced that metric in the sampled tail.
- Follow-up:
  - Continue Phase A with turn node lookup, turn node creation, hydration, and
    action binding. The broader system optimization goal remains active and is
    not complete.
  - After Phase A reaches a stable boundary, move to Phase B cold/warm
    large-session evidence and cache rebuild boundaries.
  - This was deployed locally/production only. Do not push Public unless the
    user explicitly requests it after production validation.

# 2026-06-25 - v452 turn-level DOM patch executor deployed

- Optimization phase:
  - Phase A fifth slice. v451 moved visible-item DOM patch execution out of
    `public/app.js`; v452 moves the turn-level refresh patch operation loop out
    of `patchCurrentThreadDetailFromRefresh`.
- Root-cause boundary:
  - Before v452, `patchCurrentThreadDetailFromRefresh` still iterated
    `turnPatchPlan.operations` and decided inline how to execute
    `item-patch`, `insert-turn`, and `replace-turn`.
  - That kept turn-level DOM patch execution policy coupled to the refresh
    coordinator even after turn action planning and visible-item execution had
    been extracted.
- Runtime change:
  - `public/thread-detail-dom-patch.js` now exposes
    `applyThreadTurnRefreshDomPatch`.
  - The helper applies `item-patch`, `insert-turn`, and `replace-turn`
    operations with injected callbacks for turn lookup, item patch, turn
    render, turn insert, and turn replace.
  - Existing bounded failure semantics are preserved: missing turn,
    item-patch failure, render failure, insert failure, replace missing
    article, unknown operation, and invalid operation still return explicit
    reasons. No duplicate filtering, skipped refresh, forced re-render, or
    hidden fallback was added.
  - `public/app.js` keeps DOM/runtime wiring only for this path: it supplies the
    callbacks, binds actions after the helper succeeds, and runs the existing
    local patch completion path.
  - `CLIENT_BUILD_ID` and service-worker cache are bumped to
    `codex-mobile-shell-v452`.
- Docs/tests:
  - `README.md` records the v452 architecture slice.
  - `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md` records that turn-level DOM patch
    execution is now outside `public/app.js`.
  - `docs/MODULES.md` expands `public/thread-detail-dom-patch.js` ownership to
    visible-item and turn-level patch execution.
  - `test/thread-detail-dom-patch.test.js` now covers turn-level success order
    and bounded failure reasons.
  - `test/conversation-render.test.js` confirms `patchCurrentThreadDetailFromRefresh`
    calls the helper and no longer loops over `turnPatchPlan.operations`.
- Validation:
  - Syntax checks passed for `public/thread-detail-dom-patch.js`,
    `public/app.js`, and `public/sw.js`.
  - Focused source suite passed:
    `node --test test/thread-detail-dom-patch.test.js
    test/thread-detail-patch-plan.test.js test/conversation-render.test.js
    test/mobile-viewport.test.js test/app-update.test.js
    test/plugin-voice-input.test.js test/thread-tile-layout-ui.test.js
    test/thread-task-card-route.test.js test/thread-goal-service.test.js`
    (`151` tests).
  - Full `npm test` passed (`813` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Commit/deploy:
  - Runtime commit: `cd5e4f8` (`refactor turn dom patch execution`).
  - Deployed with Home AI central macOS script:
    `deploy-macos-production.js --plugin codex-mobile --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --reason codex-mobile-turn-dom-patch-v452 --execute --json`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T165625Z-plugin-codex-mobile-web-codex-mobile-turn-dom-patch-v452`.
  - Production `/api/public-config` reports
    `clientBuildId=0.1.11|codex-mobile-shell-v452`,
    `shellCacheName=codex-mobile-shell-v452`, and `version=0.1.11`.
  - Source/prod SHA-256 parity confirmed for changed runtime/test/doc files.
  - Production focused suite passed with `NODE_PATH` pointed at production
    dependencies (`151` tests).
- Production observation:
  - Bounded log-tail aggregation after deploy found no v452/v451/v450/v449
    `thread_refresh_ms` client events yet; the recent sample still contained
    `102` v447 events and `1250` events with missing client build id.
  - This is not evidence of v452 failure; refreshed v452 clients have not yet
    produced that metric in the sampled tail.
- Follow-up:
  - Remaining Phase A boundaries are now narrower: turn node lookup,
    turn node creation/anchoring, hydration, and action binding.
  - After those are extracted or deliberately deferred, move to Phase B
    cold/warm large-session timing evidence and cache rebuild boundaries.

# 2026-06-25 - v451 visible item DOM patch executor deployed

- Optimization phase:
  - Phase A fourth slice. v448 moved refresh terminal render outcome ownership
    into `thread-detail-render-plan`; v449 moved turn-level refresh DOM patch
    action planning into `thread-detail-patch-plan`; v450 moved local patch
    scroll completion into `conversation-scroll`; v451 moves visible-item DOM
    patch execution out of `public/app.js`.
- Root-cause boundary:
  - Before v451, `applyVisibleItemsOnlyRefreshPatch` in `public/app.js`
    interpreted `reuse` / `patch` / `insert` operations, queried DOM nodes,
    rendered new nodes, called `patchNode`, and inserted nodes.
  - That kept part of DOM patch execution policy inside the application
    coordinator, which is one of the paths behind duplicate/missing-message
    and refresh-jitter investigations.
- Runtime change:
  - New `public/thread-detail-dom-patch.js` exposes
    `applyVisibleItemRefreshDomPatch`.
  - The helper applies visible-item refresh patch plans with injected
    lookup/render/patch callbacks and returns bounded results/reasons for
    `plan-not-patchable`, missing article, missing existing node, render
    failure, patch failure, unknown operation, and invalid operation.
  - `public/app.js` now injects DOM lookup, visible-item HTML rendering, and
    `patchNode` work through `patchVisibleItemElement`; it no longer owns the
    visible-item patch operation loop.
  - The change does not hide duplicate messages, synthesize missing messages,
    skip refreshes, or add a fallback. If patch execution cannot explain the
    DOM shape, existing local patch rejection still allows the established full
    render path to handle the refresh.
  - `CLIENT_BUILD_ID` and service-worker cache are bumped to
    `codex-mobile-shell-v451`.
- Docs/tests:
  - `README.md` records the v451 architecture slice.
  - `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md` records that visible-item DOM
    patch execution is now outside `public/app.js`.
  - `docs/MODULES.md` maps `public/thread-detail-dom-patch.js` and
    `test/thread-detail-dom-patch.test.js`.
  - New focused tests cover reuse/patch/insert order, insertion before the
    first child, missing node, render failure, patch failure, unknown
    operation, and invalid operation.
- Validation:
  - Syntax checks passed for `public/thread-detail-dom-patch.js`,
    `public/app.js`, and `public/sw.js`.
  - Focused source suite passed:
    `node --test test/thread-detail-dom-patch.test.js
    test/thread-detail-patch-plan.test.js test/conversation-render.test.js
    test/mobile-viewport.test.js test/app-update.test.js
    test/plugin-voice-input.test.js test/thread-tile-layout-ui.test.js
    test/thread-task-card-route.test.js test/thread-goal-service.test.js`
    (`149` tests).
  - Full `npm test` passed (`811` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Commit/deploy:
  - Runtime commit: `c261332` (`refactor visible item dom patch execution`).
  - Deployed with Home AI central macOS script:
    `deploy-macos-production.js --plugin codex-mobile --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --reason codex-mobile-visible-item-dom-patch-v451 --execute --json`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T164939Z-plugin-codex-mobile-web-codex-mobile-visible-item-dom-patch-v451`.
  - Production `/api/public-config` reports
    `clientBuildId=0.1.11|codex-mobile-shell-v451`,
    `shellCacheName=codex-mobile-shell-v451`, and `version=0.1.11`.
  - Source/prod SHA-256 parity confirmed for changed runtime/test/doc files.
  - Production focused suite passed with `NODE_PATH` pointed at production
    dependencies (`149` tests).
- Production observation:
  - Bounded log-tail aggregation after deploy found no v451/v450/v449
    `thread_refresh_ms` client events yet; the recent sample still contained
    `102` v447 events and `1250` events with missing client build id.
  - This is not evidence of v451 failure; it means refreshed v451 clients have
    not yet produced that metric in the sampled tail.
- Follow-up:
  - Continue Phase A with turn-level DOM execution boundaries: turn node
    lookup, turn node creation, turn replace/insert execution, hydration, and
    action binding.
  - After those boundaries, move to Phase B cold/warm large-session timing
    evidence unless a production diagnostic case requires earlier attention.

# 2026-06-25 - v450 local patch scroll completion policy deployed

- Optimization phase:
  - Phase A third slice. v448 moved refresh terminal render outcome ownership
    into `thread-detail-render-plan`; v449 moved turn-level refresh DOM patch
    action planning into `thread-detail-patch-plan`; v450 moves local patch
    scroll completion policy out of `public/app.js`.
- Root-cause boundary:
  - Before v450, `completeLocalConversationDomUpdate` still directly decided
    whether a local DOM patch should scroll to bottom or only update the
    scroll-to-bottom affordance.
  - That kept scroll-follow policy coupled to DOM patch completion in
    `public/app.js`, which is one of the sensitive paths for long-turn
    streaming, Composer focus stability, and projection-refresh churn.
- Runtime change:
  - `public/conversation-scroll.js` adds
    `planLocalPatchScrollCompletion`, returning an explicit
    `scroll-to-bottom` or `update-button` action with a bounded reason.
  - `public/app.js` now computes user-reading, auto-scroll-hold, near-bottom,
    submitted-message-follow, and viewport-follow inputs, then executes the
    scroll helper plan instead of owning the policy inline.
  - Behavior remains intentionally conservative:
    user-reading-current-turn and auto-scroll-hold keep the viewport stable;
    near-bottom, submitted-message-follow, and viewport-follow still allow
    bottom-follow.
  - `CLIENT_BUILD_ID` and service-worker cache are bumped to
    `codex-mobile-shell-v450`.
- Docs/tests:
  - `README.md` records the v450 architecture slice.
  - `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md` records that local patch scroll
    completion policy now lives in `conversation-scroll`.
  - Focused tests cover helper policy order and app wiring away from the old
    inline scroll condition.
- Validation:
  - Syntax checks passed for `public/app.js`, `public/conversation-scroll.js`,
    and `public/sw.js`.
  - Focused source suite passed:
    `node --test test/conversation-scroll.test.js
    test/turn-scroll-controls.test.js test/conversation-render.test.js
    test/mobile-viewport.test.js test/thread-detail-patch-plan.test.js
    test/thread-task-card-route.test.js test/thread-goal-service.test.js
    test/app-update.test.js test/plugin-voice-input.test.js` (`156` tests).
  - Full `npm test` passed (`808` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Commit/deploy:
  - Runtime commit: `06db5de` (`refactor local patch scroll completion policy`).
  - Deployed with Home AI central macOS script:
    `deploy-macos-production.js --plugin codex-mobile --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --reason codex-mobile-local-patch-scroll-policy-v450 --execute --json`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T163908Z-plugin-codex-mobile-web-codex-mobile-local-patch-scroll-policy-v450`.
  - Production `/api/public-config` reports
    `clientBuildId=0.1.11|codex-mobile-shell-v450`,
    `shellCacheName=codex-mobile-shell-v450`, `version=0.1.11`, and active
    profile `previous`.
  - Source/prod SHA-256 parity confirmed for changed runtime/test/doc files.
  - Production focused suite passed with `NODE_PATH` pointed at production
    dependencies (`156` tests).
- Production observation:
  - Bounded log-tail aggregation after deploy found no v450
    `thread_refresh_ms` client events yet; the recent sample contained
    `102` v447 events and `1250` events with missing client build id.
  - This is not evidence of v450 failure; it means refreshed v450 clients have
    not yet produced that metric in the sampled tail.
- Follow-up:
  - Continue Phase A with remaining DOM ownership boundaries: node lookup,
    node creation, patch/insert execution, hydration ownership, and then
    performance/cold-session instrumentation.

# 2026-06-25 - v449 refresh DOM patch application plan deployed

- Optimization phase:
  - Phase A second slice. v448 made refresh choose one terminal render
    outcome; v449 moves the single-thread turn-level DOM patch action plan out
    of `public/app.js`.
- Root-cause boundary:
  - Before v449, `patchCurrentThreadDetailFromRefresh` iterated next turns and
    decided inline whether each turn should be item-patched, inserted,
    replaced, removed after render failure, or treated as failed.
  - That kept patch application policy mixed with DOM execution, making it
    harder to reason about missing/duplicate/old message states during refresh.
- Runtime change:
  - `public/thread-detail-patch-plan.js` adds
    `planThreadDetailRefreshDomPatch`, which produces explicit `item-patch`,
    `insert-turn`, and `replace-turn` operations from bounded turn patch
    entries.
  - `public/app.js` now builds bounded turn patch entries and executes the
    helper plan. It still owns DOM lookup, rendering, patch/insert execution,
    hydration, and scroll completion.
  - If a turn patch plan or DOM operation cannot explain the current shape,
    local patch rejects with a bounded reason and the existing full-render path
    remains responsible. The old implicit "render source missing => remove
    article and continue" behavior was removed from this refresh patch path.
  - Removed the unused `patchVisibleItemsOnlyFromRefresh` wrapper after
    splitting item-level planning and application into
    `planVisibleItemsOnlyFromRefresh` and `applyVisibleItemsOnlyRefreshPatch`.
  - `CLIENT_BUILD_ID` and service-worker cache are bumped to
    `codex-mobile-shell-v449`.
- Docs/tests:
  - `README.md` records the v449 architecture slice.
  - `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md` records that turn-level refresh
    patch action planning now lives in `thread-detail-patch-plan`.
  - Focused tests cover `item-patch`, `insert-turn`, `replace-turn`, invalid
    turn entries, and app wiring to the helper plan.
- Validation:
  - Focused source suite passed:
    `node --test test/thread-detail-patch-plan.test.js
    test/conversation-render.test.js test/mobile-viewport.test.js
    test/thread-task-card-route.test.js test/thread-goal-service.test.js
    test/app-update.test.js test/plugin-voice-input.test.js
    test/thread-tile-layout-ui.test.js` (`146` tests).
  - Full `npm test` passed (`807` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Commit/deploy:
  - Runtime commit: `92c110a` (`refactor thread detail dom patch planning`).
  - Deployed with Home AI central macOS script:
    `deploy-macos-production.js --plugin codex-mobile --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --reason codex-mobile-dom-patch-plan-v449 --execute --json`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T163411Z-plugin-codex-mobile-web-codex-mobile-dom-patch-plan-v449`.
  - Production `/api/public-config` reports
    `clientBuildId=0.1.11|codex-mobile-shell-v449`,
    `shellCacheName=codex-mobile-shell-v449`, `version=0.1.11`, and
    active profile `previous`.
  - Source/prod SHA-256 parity confirmed for changed runtime/test/doc files.
  - Production focused suite passed with `NODE_PATH` pointed at production
    dependencies (`146` tests).
- Production observation:
  - Log-tail aggregation immediately after deploy still showed no v449
    `thread_refresh_ms` client events; the tail contained old clients only
    (`codex-mobile-shell-v447` or missing build id).
  - After clients reload v449, inspect patch reject reasons and refresh render
    action distribution before deciding whether this slice reduced DOM churn.
- Follow-up:
  - Continue Phase A with the next remaining DOM boundary: node lookup /
    creation helpers, hydration ownership, and scroll completion policy.
  - Keep app.js as the executor, not the policy owner.

# 2026-06-25 - v448 refresh render outcome policy deployed

- Optimization phase:
  - This is Phase A first slice of the broader Codex Mobile architecture
    optimization goal. It is a root-cause boundary cleanup, not a visual
    fallback for flicker.
  - Goal: make thread refresh choose one explicit terminal render outcome
    before `public/app.js` performs DOM work.
- Root-cause boundary:
  - Before v448, `refreshCurrentThread` could successfully patch a tile pane
    but still continue through broader single-thread/full-render control flow.
  - That kept refresh outcome ownership split between `public/app.js` and
    `public/thread-detail-render-plan.js`, increasing the chance of projection
    signature churn causing unnecessary conversation replacement.
- Runtime change:
  - `public/thread-detail-render-plan.js` `finalizeThreadDetailRenderPlan`
    now returns a full render outcome: `detailRenderMode`,
    `locallyPatchedDetail`, `tilePanePatchedDetail`, `renderAction`, and
    `projectionConsistencyPhase`.
  - Tile pane patch success is terminal:
    - `tile-pane` for detail refreshes;
    - `tile-pane-metadata` for metadata-only tile refreshes.
  - `public/app.js` now executes `refreshRenderAction` instead of re-deciding
    patch/full-render behavior inline.
  - `thread_refresh_ms` now includes bounded diagnostic fields
    `refreshRenderAction` and `tilePanePatchedDetail`.
  - `CLIENT_BUILD_ID` and service-worker cache are bumped to
    `codex-mobile-shell-v448`.
- Docs/tests:
  - `README.md` records the v448 architecture slice.
  - `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md` records that refresh render
    outcome ownership moved into the render-plan helper.
  - Focused tests cover terminal tile-pane patch, metadata-only tile patch
    avoiding full render, app wiring, and performance metric field retention.
- Validation:
  - Focused source suite passed:
    `node --test test/thread-detail-render-plan.test.js
    test/mobile-viewport.test.js test/conversation-render.test.js
    test/thread-performance-metrics.test.js test/thread-task-card-route.test.js
    test/thread-goal-service.test.js` (`135` tests).
  - Full `npm test` passed (`805` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Commit/deploy:
  - Runtime commit: `4806efd` (`refactor refresh render outcome policy`).
  - Deployed with Home AI central macOS script:
    `deploy-macos-production.js --plugin codex-mobile --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --reason codex-mobile-refresh-render-outcome-v448 --execute --json`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T162520Z-plugin-codex-mobile-web-codex-mobile-refresh-render-outcome-v448`.
  - Production `/api/public-config` reports
    `clientBuildId=0.1.11|codex-mobile-shell-v448`,
    `shellCacheName=codex-mobile-shell-v448`, and `version=0.1.11`.
  - Source/prod SHA-256 parity confirmed for changed runtime/test/doc files.
  - Production focused suite passed with `NODE_PATH` pointed at production
    dependencies (`135` tests).
- Production observation:
  - Log-tail aggregation after deploy showed no v448 `thread_refresh_ms`
    events yet; latest client-side events were still old clients
    (`codex-mobile-shell-v447` or missing build id).
  - After real clients refresh to v448, inspect `thread_refresh_ms`
    `refreshRenderAction`, `tilePanePatchedDetail`, `renderPlanReason`, and
    `patchRejectReason` before deciding whether Phase A has reduced full-render
    churn enough.
- Follow-up:
  - Continue Phase A by extracting DOM patch application boundaries from
    `public/app.js`: node lookup, node creation, patch application, hydration,
    and scroll ownership.
  - Keep focused tests attached to each extracted boundary.

# 2026-06-25 - v447 live refresh patch signature fix deployed

- User follow-up after v445:
  - User cancelled the prior goal because the phone UI did not show replies for
    a period.
  - User also reported that typing in the Composer still sometimes causes the
    Composer and screen above it to flicker, while other times it is stable.
- Bounded evidence:
  - v445 production logs showed new live content was present in render input;
    `conversation_render_ms` `htmlChars` kept increasing.
  - v446 was committed/deployed as `4c6742b` with
    `clientBuildId=0.1.11|codex-mobile-shell-v446`, but a post-deploy log
    sample still showed many iPhone `thread_refresh_ms` events choosing
    `detailRenderMode=full-render`.
  - The same events used `projection-v4-dynamic/cache` with `threadReadMs=0`,
    so the remaining flicker is primarily frontend render/patch decision
    churn, not large-session server `thread/read`.
- Root cause fixed by v446:
  - `refreshCurrentThread` used the full `conversationRenderSignature` as both
    the "content changed" signal and the "DOM can be patched safely" signal.
  - The full signature includes projection metadata such as
    `mobileProjectionRevision` and `mobileVisibleItemKeys`, which can change
    during active projection refreshes even when the visible turn shell remains
    patchable.
  - Those metadata-only signature changes made the render plan choose
    `full-render`, causing avoidable conversation DOM replacement and visible
    flicker.
- Root cause fixed by v447:
  - The v446 render-plan call computed `previousPatchShellSignature` from
    `state.currentThread` after merge, which could be the next thread shape
    rather than the old thread shape represented by the current DOM.
  - v447 computes that signature from `previousThread` before merge, so the
    patch gate compares the rendered DOM against the correct previous shell.
- Runtime change:
  - `public/app.js` adds `renderedConversationPatchShellSignature`.
  - Single-thread conversation renders write the patch-shell signature; home,
    new-thread, plugin-recovery, and tile surfaces clear it.
  - `refreshCurrentThread` passes both full signatures and patch-shell
    signatures to `thread-detail-render-plan`.
  - `patchCurrentThreadDetailFromRefresh` accepts a stale full rendered
    signature only when the rendered patch-shell signature still matches the
    previous thread shell.
  - `public/thread-detail-render-plan.js` adds `patch-shell-stable`, allowing a
    patch when only projection metadata makes the full signature stale.
  - v447 adds bounded `clientBuildId`, `renderPlanReason`, and
    `patchRejectReason` to thread-refresh performance events.
  - `CLIENT_BUILD_ID` and service-worker cache are bumped to
    `codex-mobile-shell-v447`.
- Local validation:
  - Syntax check passed for `public/app.js` and
    `public/thread-detail-render-plan.js`; v447 also checks
    `public/thread-performance-metrics.js` and `public/sw.js`.
  - Focused suite passed:
    `node --test test/thread-detail-render-plan.test.js
    test/mobile-viewport.test.js test/turn-scroll-controls.test.js
    test/conversation-render.test.js test/thread-performance-metrics.test.js
    test/thread-task-card-route.test.js test/thread-goal-service.test.js`
    (`139` tests).
  - Full `npm test` passed (`803` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Commit/deploy:
  - Runtime commit: `ee234c9` (`fix live refresh patch signature diagnostics`).
  - Deployed with Home AI central macOS script:
    `deploy-macos-production.js --plugin codex-mobile --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --reason codex-mobile-live-refresh-patch-signature-v447 --execute --json`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T160850Z-plugin-codex-mobile-web-codex-mobile-live-refresh-patch-signature-v447`.
  - Production `/api/public-config` reports
    `clientBuildId=0.1.11|codex-mobile-shell-v447`,
    `shellCacheName=codex-mobile-shell-v447`, `version=0.1.11`, and
    `authRequired=true`.
  - Source/prod SHA-256 parity confirmed for changed runtime/test/doc files
    sampled in this fix.
  - Production focused suite passed with `NODE_PATH` pointed at production
    dependencies (`139` tests).
- Follow-up:
  - After clients reload v447, inspect new `thread_refresh_ms` fields
    `clientBuildId`, `renderPlanReason`, and `patchRejectReason` if Composer
    flicker remains. Do not claim the flicker is fully closed until v447
    runtime samples show fewer/expected `full-render` events.

# 2026-06-25 - v445 phone single-thread live visibility fix deployed

- User correction after v444:
  - User clarified the failing surface was not thread-tile/split-pane mode.
    It occurred on a phone single-thread view: the running/status box kept
    showing activity, but the conversation body did not show new content.
- Bounded evidence:
  - Production client events for thread
    `019eee6c-a6f5-7b20-bfb4-f96ccb6431b3` showed repeated successful
    `thread_refresh_ms` and `conversation_render_ms` on iPhone.
  - `htmlChars` continued to grow, proving render input was not empty, but
    `stickToBottom` moved from `true` to `false` during a long active turn.
  - Detail reads around the fresh message also showed `projection-v4-dynamic`
    hits for the large thread immediately after Mobile Web started a new turn,
    so stale dynamic projection could still race local-start state.
- Root cause:
  - Server projection result did not reject a cached projection that was missing
    the Mobile Web local active turn from `activeTurnId` /
    `mobileLocalActiveStatus.turnId`.
  - Browser full-render refreshes did not sustain the submitted-message
    bottom-follow lease. Only live delta patch extended that lease, so a long
    turn that refreshed through full render could stop following after the
    initial window even though the user had not manually scrolled away.
- Local runtime change:
  - `adapters/thread-detail-projection-result-service.js` rejects cached
    projected detail when it does not contain the local active turn from the
    summary. The route then falls through to `turns-list-initial` or another
    real read instead of returning stale projected content.
  - `public/app.js` adds full-render bottom-follow sustain for submitted
    messages when the latest live turn has non-user visible progress. Manual
    user scroll still clears the follow through the existing scroll-intent path.
  - `CLIENT_BUILD_ID` and service-worker cache are bumped to
    `codex-mobile-shell-v445`.
- Local validation completed:
  - Syntax check passed for
    `adapters/thread-detail-projection-result-service.js`, `public/app.js`,
    and `public/sw.js`.
  - Focused suite passed:
    `node --test test/thread-detail-projection-result-service.test.js
    test/turn-scroll-controls.test.js test/conversation-render.test.js
    test/thread-detail-projection-service.test.js
    test/thread-detail-read-orchestration-service.test.js
    test/home-ai-diagnostic-reporting.test.js test/mobile-viewport.test.js
    test/thread-goal-service.test.js test/thread-task-card-route.test.js`
    (`159` tests).
- Commit/deploy:
  - Runtime commit: `e83bd81` (`fix phone live turn projection and scroll
    follow`).
  - `npm test` passed (`802` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
  - Deployed via Home AI central macOS plugin deployment with reason
    `codex-mobile-phone-live-turn-follow-v445`; source ref was clean.
  - Production readback reported
    `clientBuildId=0.1.11|codex-mobile-shell-v445` and
    `shellCacheName=codex-mobile-shell-v445`.
  - Production focused suite passed (`159` tests), and source/production
    SHA-256 prefixes matched for changed runtime/test/doc files.

# 2026-06-25 - v444 thread tile current-pane refresh fix

- User-visible incident after v443:
  - User refreshed Codex Mobile after v443 deployment and the same thread still
    showed the previous failure shape: the running/status box continued to show
    active thought/file/command work, but the conversation body stayed on an
    older assistant receipt and repeatedly redrew old content.
  - Production detail for thread `019eee6c-a6f5-7b20-bfb4-f96ccb6431b3`
    still showed an active turn with many `agentMessage`, `commandExecution`,
    and `fileChange` items, so the remaining failure was not app-server output.
- Second root cause:
  - v443 fixed hidden live assistant deltas, but tile mode could still exclude
    `state.currentThreadId` from `threadTileCandidateIds` when pinned panes
    already filled the pane limit.
  - The global status/composer state was then bound to the current thread while
    no tile pane existed for that thread. `refreshCurrentThread` fell back into
    a single-thread DOM patch path on a tile surface, producing
    `detail_patch_rejected` diagnostics and full-board redraws of stale panes.
- Runtime change:
  - `public/thread-tile-layout.js` now owns
    `selectPinnedThreadTileIds`, which keeps the current thread visible by
    replacing the last pinned pane when needed.
  - `public/app.js` uses that policy for tile candidates and blocks the
    single-thread DOM patch branch whenever the active surface is tile mode.
  - `CLIENT_BUILD_ID` and service-worker cache are bumped to
    `codex-mobile-shell-v444`.
- Local validation completed:
  - `npm test` passed (`801` tests).
  - `npm run check`
  - `npm run check:macos`
  - Focused suites passed:
    `test/thread-tile-layout.test.js`,
    `test/thread-tile-layout-ui.test.js`,
    `test/conversation-render.test.js`,
    `test/turn-scroll-controls.test.js`,
    `test/mobile-viewport.test.js`,
    `test/home-ai-diagnostic-reporting.test.js`,
    `test/thread-goal-service.test.js`, and
    `test/thread-task-card-route.test.js`.
  - `git diff --check`
- Deployment state:
  - Runtime commit:
    `f1ac3cc fix thread tile current pane refresh`.
  - Deployed through the Home AI central plugin deploy script with reason
    `codex-mobile-thread-tile-current-pane-v444`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T153339Z-plugin-codex-mobile-web-codex-mobile-thread-tile-current-pane-v444`.
  - `/api/public-config` reports `clientBuildId=0.1.11|codex-mobile-shell-v444`,
    `shellCacheName=codex-mobile-shell-v444`, `buildId=ead102668ea0186c`,
    `authRequired=true`, and `platform=darwin`.
  - Production focused validation passed:
    `node --test test/thread-tile-layout.test.js
    test/thread-tile-layout-ui.test.js test/conversation-render.test.js
    test/turn-scroll-controls.test.js test/mobile-viewport.test.js
    test/home-ai-diagnostic-reporting.test.js test/thread-goal-service.test.js
    test/thread-task-card-route.test.js` (`152` tests).
  - Source/production short SHA-256 samples matched for:
    `public/app.js`, `public/sw.js`, `public/thread-tile-layout.js`,
    `README.md`, and the focused test files touched by this change.
  - In-app Browser smoke was not completed because the Browser bridge failed
    before setup with a local environment metadata error. Current validation is
    therefore server/prod-test/log based; watch for any new v444
    `detail_patch_rejected` diagnostics after clients reload.

# 2026-06-25 - v443 live assistant output visibility and task-card lease fix

- User-visible incident:
  - In the Codex Mobile implementation thread, the top-right running box kept
    showing reasoning/file/command activity, but the conversation body stayed
    stuck on an older long assistant receipt and repeatedly refreshed old
    content.
  - Bounded production detail evidence for thread
    `019eee6c-a6f5-7b20-bfb4-f96ccb6431b3` showed the active turn already had
    `agentMessage` items, so the failing layer was browser live rendering, not
    model/app-server output generation.
- Root cause:
  - `public/app.js` deferred live `item/agentMessage/delta` rendering whenever
    the latest live turn also had operational command/file items.
  - Active operation bubbles therefore kept updating while assistant text was
    hidden from the conversation DOM.
- Runtime change:
  - v443 removes the operational-item gate from live assistant text rendering.
    Agent message deltas now render immediately; receipt stability remains
    owned by the existing detail merge/patch policy.
  - `CLIENT_BUILD_ID` and service-worker cache were bumped to
    `codex-mobile-shell-v443`.
- Task-card protocol change in the same repair slice:
  - Non-terminal approved task cards now create a bounded execution lease with
    `resumeRequired=true`.
  - Ordinary user turns during an active task-card lease do not complete or
    cancel that card; after the user interruption completes, the service can
    inject a bounded continuation for the oldest active lease.
  - Pause/cancel execution routes were added, while terminal return/no-op cards
    do not create leases or acknowledgement loops.
- Local validation completed:
  - `npm test` passed (`800` tests).
  - `npm run check`
  - `npm run check:macos`
  - Focused suites passed:
    `test/conversation-render.test.js`,
    `test/turn-scroll-controls.test.js`,
    `test/thread-task-card-service.test.js`, and
    `test/thread-task-card-route.test.js`.
  - `git diff --check`
- Deployment state:
  - Runtime commit:
    `b6d1833 fix live output rendering and task card resumes`.
  - Deployed through the Home AI central plugin deploy script with reason
    `codex-mobile-live-agent-output-v443-task-card-lease`.
  - Production readback reported
    `clientBuildId=0.1.11|codex-mobile-shell-v443` and
    `shellCacheName=codex-mobile-shell-v443`.
  - v443 fixed live assistant delta suppression but did not fully close the
    tile-surface mismatch described in the v444 section above.

# 2026-06-25 - v442 frontend DOM patch surface boundary in progress

- User goal slice:
  - Continue Phase 2 frontend state ownership after the large-session
    cold-open deployment.
  - Reduce recurrence risk where single-thread DOM patch paths write state while
    the active DOM is actually a thread-tile board.
- Root-cause boundary:
  - Failing layer: browser thread detail DOM patch surface ownership.
  - v441 fixed the immediate tile local-patch signature drift, but the decision
    for tile pane patch versus single-thread patch still lived in multiple
    `public/app.js` DOM functions.
- Change:
  - `public/thread-detail-patch-plan.js` now owns
    `planThreadDetailDomPatchSurface`.
  - `public/app.js` adds `threadDetailDomPatchSurface` and
    `canPatchSingleThreadConversationDom`.
  - Tile mode can only patch through `thread-tile-pane`; single-thread DOM patch
    only runs when the policy reports a `single-thread` surface.
  - Tile/single transition mismatches reject local patch and allow the existing
    full render path to take over.
  - `CLIENT_BUILD_ID` and service worker cache bumped to
    `codex-mobile-shell-v442`.
  - `README.md` and `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md` updated.
- Validation state:
  - Runtime commit:
    `b2429ac refactor thread detail patch surface policy`.
  - Deployed through the Home AI central plugin deploy script with reason
    `codex-mobile-thread-detail-patch-surface-v442`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T150145Z-plugin-codex-mobile-web-codex-mobile-thread-detail-patch-surface-v442`.
  - `/api/public-config` reports `clientBuildId=0.1.11|codex-mobile-shell-v442`,
    `shellCacheName=codex-mobile-shell-v442`, `buildId=f54b98287ef8a856`,
    `authRequired=true`, and `platform=darwin`.
  - Local validation passed:
    - `node --check public/app.js && node --check public/thread-detail-patch-plan.js && node --check public/sw.js`
    - Focused frontend tests:
      `node --test test/thread-detail-patch-plan.test.js test/conversation-render.test.js test/thread-tile-layout-ui.test.js test/mobile-viewport.test.js test/app-update.test.js test/home-ai-diagnostic-reporting.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
      (`144` tests).
    - `npm run check`
    - `npm run check:macos`
    - `npm test` (`795` tests).
    - `git diff --check`
  - Production validation passed:
    - Same focused 144-test suite.
    - `npm run check`
    - Source/production short SHA-256 samples matched for:
      `public/app.js`, `public/sw.js`, `public/thread-detail-patch-plan.js`,
      `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`,
      `test/thread-detail-patch-plan.test.js`, and
      `test/conversation-render.test.js`.
  - Remaining goal work:
    - Continue pane-state service extraction.
    - Add browser/visual regression coverage for composer stability,
      conversation patch jitter, task-card expand/collapse, image rendering,
      and PWA refresh.

# 2026-06-25 - Large-session cold-open large-read decision tightened locally

- User goal:
  - Optimize large-session first-screen loading before moving to frontend DOM
    patch extraction, pane-state service, and visual regression coverage.
  - Required invariant: large rollout cold-open should hit disk-backed
    projection or `turns-list-large` with `threadReadMs=0`; full
    `thread/read` should remain only for small/non-rollout threads or bounded
    turns-list failure.
- Root-cause boundary:
  - Failing layer: server thread-detail read orchestration.
  - The existing `turns-list-large` gate was tied to projection input
    availability. If projection input was unavailable during restart/cold-open
    but the summary already carried rollout size, the route could still enter
    full `thread/read` for a large rollout.
- Change:
  - `server.js` now returns a structured large-read decision from
    `preferBoundedReadBeforeFullRead`: it checks projection rollout stats
    first, then summary/rollout size, and records source/reason/threshold.
  - `adapters/thread-detail-read-orchestration-service.js` normalizes the
    structured decision, uses it for `turns-list-large`, and logs bounded
    decision metadata.
  - `adapters/thread-detail-performance-service.js` adds
    `largeReadProtected`, `largeReadRolloutSizeBytes`,
    `largeReadThresholdBytes`, `largeReadSource`, and `largeReadReason` to
    `mobileDiagnostics.threadDetailTimings`.
  - `README.md` and `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md` document that
    this is a server-only cold-open correction, not a frontend deferred
    enrichment fallback.
- Validation so far:
  - `node --check server.js && node --check adapters/thread-detail-read-orchestration-service.js && node --check adapters/thread-detail-performance-service.js`
    passed.
  - Focused tests passed:
    `node --test test/thread-detail-read-orchestration-service.test.js test/thread-detail-performance-service.test.js test/thread-detail-projection-input-service.test.js test/thread-detail-projection-service.test.js`
    (`29` tests).
- Release state:
  - Runtime commit:
    `0669520 fix large thread cold read decision`.
  - Deployed through the Home AI central plugin deploy script with reason
    `codex-mobile-large-cold-read-decision`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T144935Z-plugin-codex-mobile-web-codex-mobile-large-cold-read-decision`.
  - This is server-only; `/api/public-config` still reports
    `clientBuildId=0.1.11|codex-mobile-shell-v441` and
    `shellCacheName=codex-mobile-shell-v441`.
  - Broader local validation passed:
    - `node --test test/thread-detail-read-orchestration-service.test.js test/thread-detail-performance-service.test.js test/thread-detail-summary-service.test.js test/thread-detail-projection-input-service.test.js test/thread-detail-projection-result-service.test.js test/thread-detail-projection-service.test.js test/thread-detail-projection-v4-service.test.js test/thread-visibility.test.js`
      (`83` tests).
    - `npm run check`
    - `npm run check:macos`
    - `npm test` (`793` tests).
    - `git diff --check`
  - Production validation passed:
    - Same focused 83-test suite.
    - `npm run check`
    - `npm run check:macos`
    - Source/production short SHA-256 samples matched for `server.js`,
      `adapters/thread-detail-read-orchestration-service.js`,
      `adapters/thread-detail-performance-service.js`, `README.md`,
      `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and the two focused tests.
  - Production bounded readback after deploy:
    - Current Codex Mobile large thread `019eee6c...` returned
      `mobileReadMode=turns-list-large`, phase `bounded-large-thread-window`,
      `threadReadMs=0`, `turnsListBeforeFullMs=780`,
      `largeReadProtected=true`, `largeReadSource=projection`,
      `largeReadReason=large-rollout`, rollout size `108905442`, threshold
      `8388608`.
    - Home AI large thread `019eed86...` returned
      `mobileReadMode=projection-v4-dynamic`, phase `warm-projection-dynamic`,
      `threadReadMs=0`.
  - Remaining goal work:
    - Gather/verify active-writer cold-open and static-large-thread cold-open
      evidence over real usage.
    - Continue Phase 2 frontend DOM patch extraction, Phase 5 pane-state
      service, and Phase 4 visual/DOM regression coverage.

# 2026-06-25 - v441 thread-tile local patch signature boundary repaired

- Source task card:
  - Home AI diagnostic remediation dispatched
    `diagcase_27be16978a2839942d0e` for Codex Mobile Web.
  - Task card id: `ttc_5769b2b34e8c15a2ec`.
  - Requested reasoning effort: `xhigh`.
- Bounded runtime evidence:
  - Home AI diagnostic DB path checked read-only:
    `/Users/hermes-host/HermesMobile/data/ai-ops/diagnostics/diagnostics.sqlite`.
  - Case metadata: plugin `codex-mobile`, source surface `embedded-plugin`,
    status `card_sent`, one event at `2026-06-25T14:02:33Z`.
  - Payload now preserved Home AI host fields:
    `route_kind=thread-tile`, `action=refresh-metadata`,
    `render_mode=metadata-only`, `pane_count=4`, `dom_count=168`,
    `visible_count=132`, `duplicate_count=0`,
    plugin build `0.1.11|codex-mobile-shell-v440`.
  - The issue is not the same as the v440 fixed mixed signature comparison.
    v440 correctly entered the tile diagnostic branch; the remaining failure
    was stale single-thread rendered signature state paired with a tile DOM.
- Root cause:
  - `refreshCurrentThread` and SSE local item patch paths still had a
    single-window DOM ownership assumption.
  - Metadata-only refresh updated single-window header/global operation dock
    instead of the current tile pane.
  - `completeLocalConversationDomUpdate` always wrote
    `conversationRenderSignature(state.currentThread)`.
  - In thread-tile DOM this left the tile board paired with a single-thread
    `state.renderedConversationSignature`, which produced the H2 mismatch on
    the next consistency check.
- Change:
  - Added `patchCurrentThreadTilePaneFromState`.
  - Current-thread refreshes in thread-tile mode patch the current pane and let
    `patchThreadTilePane` write `threadTileRenderSignature`.
  - Metadata-only tile refresh now uses `detailRenderMode=tile-pane-metadata`.
  - SSE/local patch paths for operation dock, visible item insert/patch, live
    text patch, and detail refresh patch use the tile pane boundary when the
    active DOM is a thread-tile board.
  - Single-thread DOM patch behavior remains unchanged outside tile mode.
  - PWA shell cache bumped to `codex-mobile-shell-v441`.
  - Updated `README.md` and `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`.
- Validation:
  - Focused tests passed:
    `node --test test/conversation-render.test.js test/home-ai-diagnostic-reporting.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
    (`126` tests).
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `npm test` passed (`791` tests).
  - `git diff --check` passed.
- Release state:
  - Committed locally as:
    `c4bc288 fix tile local patch signature drift`.
  - Deployed through the Home AI central plugin deploy script with reason
    `codex-mobile-tile-local-patch-signature-v441`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T141153Z-plugin-codex-mobile-web-codex-mobile-tile-local-patch-signature-v441`.
  - `/api/public-config` reports `version=0.1.11`,
    `clientBuildId=0.1.11|codex-mobile-shell-v441`,
    `shellCacheName=codex-mobile-shell-v441`, `authRequired=true`,
    `platform=darwin`, and build id `2d13e680136639dc`.
  - Central deploy validation passed launchd, health URL, production file hash,
    shared auth permission repair, and codex auth profile audit checks.
  - Production `npm run check`, `npm run check:macos`, and the focused
    126-test suite passed.
  - Source/production short SHA-256 samples matched for:
    `public/app.js`, `public/sw.js`, `README.md`,
    `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`,
    `test/conversation-render.test.js`, and
    `test/home-ai-diagnostic-reporting.test.js`.
  - Post-deploy diagnostic DB readback shows `diagcase_27be16978a2839942d0e`
    still as the pre-v441 one-event H2 case from
    `2026-06-25T14:02:33Z`; no new post-v441 event was present in the bounded
    readback.

# 2026-06-25 - v440 tile projection diagnostic false positive repaired

- Source task card:
  - Home AI diagnostic remediation dispatched
    `diagcase_6e638140313aa4869b05` for Codex Mobile Web.
  - Task card id: `ttc_1de42abd596c5025ab`.
  - Requested reasoning effort: `xhigh`.
- Bounded runtime evidence:
  - The v439 diagnostic channel successfully produced a Home AI case for
    `conversation_projection_mismatch` / `render_signature_mismatch`.
  - Home AI diagnostic DB path checked read-only:
    `/Users/hermes-host/HermesMobile/data/ai-ops/diagnostics/diagnostics.sqlite`.
  - Case metadata: plugin `codex-mobile`, source surface `embedded-plugin`,
    status `card_sent`, one stored event at `2026-06-25T13:18:45Z`.
  - Stored event evidence did not include raw private content. Home AI host
    currently maps plugin counts/context into a narrow frontend-state payload,
    so Codex-specific counts were not retained in the case payload.
- Root cause:
  - v439 added `checkConversationProjectionConsistency`.
  - In thread-tile mode, `state.renderedConversationSignature` is the full
    `threadTileRenderSignature` for the tile board.
  - The diagnostic check compared that tile-board signature with
    single-thread `conversationRenderSignature(state.currentThread)`.
  - During repeated wide-screen tile refreshes, this produced a stable false
    `render_signature_mismatch` after the reporter threshold was reached.
- Change:
  - Added `conversationProjectionDiagnosticSnapshot` in `public/app.js`.
  - Single-thread DOM compares only single-thread render signatures.
  - Thread-tile DOM compares only `threadTileRenderSignature`.
  - Transition frames where state and DOM rendering surface disagree are
    skipped instead of reported.
  - Duplicate DOM render-key diagnostics remain active.
  - PWA shell cache bumped to `codex-mobile-shell-v440`.
  - Updated `README.md` and `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`.
- Validation:
  - Focused tests passed:
    `node --test test/conversation-render.test.js test/home-ai-diagnostic-reporting.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
    (`124` tests).
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `npm test` passed (`789` tests).
  - `git diff --check` passed.
- Release state:
  - Committed locally as:
    `3f1c47e fix tile projection diagnostic signature`.
  - Deployed through the Home AI central plugin deploy script with reason
    `codex-mobile-tile-diagnostic-signature-v440`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T132616Z-plugin-codex-mobile-web-codex-mobile-tile-diagnostic-signature-v440`.
  - `/api/public-config` reports `version=0.1.11`,
    `clientBuildId=0.1.11|codex-mobile-shell-v440`,
    `shellCacheName=codex-mobile-shell-v440`, `authRequired=true`,
    `platform=darwin`, and build id `d84d748dcf337c13`.
  - Production `npm run check` and `npm run check:macos` passed.
  - Source/production short SHA-256 samples matched for:
    `public/app.js`, `public/sw.js`, `README.md`,
    `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`,
    `test/conversation-render.test.js`, and
    `test/home-ai-diagnostic-reporting.test.js`.
  - Post-deploy diagnostic DB readback still shows the H2 case with two
    pre-v440 events and one separate H3 `detail_patch_rejected` case. No new
    v440 event was observed in that bounded readback.

# 2026-06-25 - v439 Home AI diagnostic report channel implemented locally

- Source task card:
  - Home AI requested Codex Mobile adoption of the platform-owned diagnostic
    report channel.
  - Task card id: `ttc_28cd1a44ca922ca88d`.
  - Requested reasoning effort: `xhigh`.
- Root-cause boundary:
  - The recurring user-visible symptoms are client/server projection and
    workflow inconsistencies: duplicate/missing visible messages, route/task
    targets not opening, media render failures, and task-card workflow
    failures.
  - This change does not mask those defects with duplicate filtering,
    synthetic refreshes, or UI fallbacks. It adds bounded evidence capture so
    Home AI can dedupe cases and let Owner trigger repair cards with replayable
    metadata.
- Change:
  - Added `public/home-ai-diagnostic-reporting.js`.
    - Repeated-failure threshold defaults to `3`.
    - Same signature is throttled for `5` minutes.
    - Success for the same surface/action clears accumulated failures.
    - Payload sanitizer strips raw message/body/prompt/text/title/path/url/key/
      token/cookie-like fields and keeps only bounded enums, counts, status
      codes, duration buckets, build/cache ids, and short hashes.
  - `public/app.js` now records diagnostics for:
    - task-card creation, draft request/materialization, approve/reply/delete/
      revoke failures;
    - thread list/detail load and detail refresh failures;
    - Home AI route-hint thread/task/item missing or unavailable paths;
    - image render failures;
    - conversation render-signature mismatch, duplicate DOM render keys, and
      repeated detail-patch rejection.
  - Embedded mode posts eligible reports to the parent as
    `homeai.diagnostic.report`; standalone mode only records local client
    events. Automatic plugin reports do not create task cards directly.
  - PWA shell cache bumped to `codex-mobile-shell-v439`.
  - Updated `README.md`, `docs/ARCHITECTURE.md`,
    `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and `docs/MODULES.md`.
- Validation:
  - Focused tests passed:
    `node --test test/home-ai-diagnostic-reporting.test.js test/app-update.test.js test/mobile-viewport.test.js test/plugin-voice-input.test.js test/thread-task-card-route.test.js test/thread-goal-service.test.js`
    (`42` tests).
  - Conversation/media focused tests passed:
    `node --test test/conversation-render.test.js test/home-ai-diagnostic-reporting.test.js`
    (`98` tests).
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `npm test` passed (`786` tests).
  - `git diff --check` passed.
- Release state:
  - Committed locally as:
    `c93f8d4 feat: report repeated runtime diagnostics to Home AI`.
  - Deployed through the Home AI central plugin deploy script with reason
    `codex-mobile-diagnostic-report-channel-v439`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T125545Z-plugin-codex-mobile-web-codex-mobile-diagnostic-report-channel-v439`.
  - `/api/public-config` reports `version=0.1.11`,
    `clientBuildId=0.1.11|codex-mobile-shell-v439`,
    `shellCacheName=codex-mobile-shell-v439`, `authRequired=true`,
    `platform=darwin`, and build id `59e89dd324e92aa4`.
  - Production `npm run check` and `npm run check:macos` passed.
  - Source/production short SHA-256 samples matched for:
    `public/app.js`, `public/home-ai-diagnostic-reporting.js`,
    `public/sw.js`, `public/index.html`, `server.js`, and `package.json`.
  - Central deployment audit reported `blockingIssueCount=0`.
  - No public push in this step unless explicitly requested.

# 2026-06-25 - terminal return-card acknowledgement loop repaired

- Source task card:
  - Home AI requested repair of the terminal return-card acknowledgement loop.
  - Task card id: `ttc_6fa3f08ed5f51abe59`.
  - Requested reasoning effort: `xhigh`.
- Root cause:
  - `return_to_source`, `/reply returnToSource:true`, and autonomous
    auto-return cards were semantically receipts but still behaved like normal
    work cards in several places.
  - They could expose reply affordance and inject `Return required` guidance,
    allowing a return-card receipt to request another acknowledgement card.
- Change:
  - `adapters/thread-task-card-service.js` now assigns structured protocol
    state:
    - ordinary work cards: `requiresReturn:true`, `terminal:false`;
    - return/ack/no-op receipt cards: `terminal:true`,
      `requiresReturn:false`, `ackPolicy:"none"`.
  - Terminal cards suppress `Return required` injection text, expose
    `canReply:false`, and `/reply` rejects them with
    `task_card_terminal_no_return_required`.
  - Existing return cards with legacy `returnToSource` metadata are treated as
    terminal as a migration safety net.
  - `codex_mobile.return_to_source` / dynamic return responses now include
    bounded `terminal`, `requiresReturn`, and `ackPolicy` metadata.
  - Updated `README.md`, `docs/CROSS_THREAD_TASK_CARDS_DESIGN.md`,
    `docs/CROSS_THREAD_TASK_CARDS_IMPLEMENTATION.md`, and `docs/MODULES.md`.
- Validation:
  - Focused task-card tests passed:
    `node --test test/thread-task-card-service.test.js test/thread-task-card-route.test.js test/codex-mobile-mcp-server.test.js`
    (`38` tests).
  - `npm run check` passed.
  - `npm test` passed (`781` tests).
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Release state:
  - Code commits:
    - `11f5374 refactor: extract thread detail patch planning`
    - `3d99d87 fix: make task card returns terminal`
  - Deployed through the Home AI central plugin deploy script with reason
    `task-card-terminal-return-loop`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T123411Z-plugin-codex-mobile-web-task-card-terminal-return-loop`.
  - `/api/public-config` reports `clientBuildId=0.1.11|codex-mobile-shell-v438`,
    `shellCacheName=codex-mobile-shell-v438`, `version=0.1.11`,
    `authRequired=true`, and build id `8dd4d1864a81f8cc`.
  - Source/production short SHA-256 samples matched for:
    `adapters/thread-task-card-service.js`, `server.js`,
    `scripts/codex-mobile-mcp-server.js`, `public/app.js`,
    `public/sw.js`, `README.md`, and
    `docs/CROSS_THREAD_TASK_CARDS_IMPLEMENTATION.md`.
  - No public push in this step unless explicitly requested.

# 2026-06-25 - v438 thread detail patch-plan extraction ready locally

- Scope:
  - Continued Phase 2 frontend state ownership optimization after the v435
    thread-detail merge orchestration split.
  - Extracted visible-item refresh patch planning from `public/app.js` into a
    pure browser/CommonJS helper.
- Root-cause boundary:
  - The previous refresh path mixed two responsibilities in `public/app.js`:
    deciding whether the visible item shape still allowed incremental patching,
    and applying the resulting DOM changes.
  - This change separates the pure decision layer without adding front-end
    refresh, dedupe, or fallback masking behavior.
- Change:
  - Added `public/thread-detail-patch-plan.js`.
  - `patchVisibleItemsOnlyFromRefresh()` now consumes a
    reuse/patch/insert plan from `CodexThreadDetailPatchPlan`; `app.js` still
    owns DOM query, HTML rendering, node patch, and insertion.
  - Added `test/thread-detail-patch-plan.test.js` for append, changed
    signature, reorder/removal, and invalid-entry behavior.
  - Updated shell asset wiring in `public/index.html`, `public/sw.js`,
    `public/app.js`, `server.js`, and `package.json`.
  - PWA shell cache bumped to `codex-mobile-shell-v438`.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
- Validation:
  - Focused test command passed:
    `node --test test/thread-detail-patch-plan.test.js test/conversation-render.test.js test/thread-detail-render-plan.test.js test/thread-detail-merge-state.test.js test/mobile-viewport.test.js test/app-update.test.js test/plugin-voice-input.test.js test/thread-tile-layout-ui.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
    (`148` tests).
  - `npm run check` passed.
  - `npm test` passed (`780` tests).
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Release state:
  - Not deployed and not pushed Public in this step. Await explicit deploy or
    public instruction.

# 2026-06-25 - GitHub SSA adoption

- Source task card:
  - Home AI requested adoption of the GitHub Shared Source Account contract for
    this plugin workspace.
  - Task card id: `ttc_014b0ae1d788cdb25a`.
- Central references read:
  - `/Users/hermes-dev/HermesMobileDev/app/docs/PLATFORM_CONTRACTS/github-shared-source-account-contract.md`
  - `/Users/hermes-dev/HermesMobileDev/app/docs/RUNBOOKS/github-shared-source-account.md`
- Remote inspection:
  - Before: `origin` was `git@github.com:pentiumxp/codex-mobile-web.git`.
  - `public` remains `git@github.com:pentiumxp/codex-mobile-web-public.git`
    and was not changed.
- SSA verification:
  - Helper status reported local key/public key/SSH alias present with expected
    bounded metadata.
  - Smoke command for
    `git@github.com-homeai-ssa:pentiumxp/codex-mobile-web.git` returned
    `github_ssa_smoke_passed`.
  - Do not store or print private key bodies, tokens, cookies, or launch
    secrets in this workspace.
- Change:
  - `origin` has been set to
    `git@github.com-homeai-ssa:pentiumxp/codex-mobile-web.git`.
  - `docs/HOME_AI_PLATFORM_CONTRACT.md` now contains a short GitHub SSA pointer
    to the central contract, runbook, helper, alias, and adopted source remote.
- Validation and closure:
  - `npm run check` passed.
  - `git diff --check` passed.
  - Pointer grep for `github-shared-source-account`, `github.com-homeai-ssa`,
    and `github_ssa_smoke_passed` passed.
  - Adoption commit:
    `f3e2159 docs: adopt Home AI GitHub SSA`.
  - `git push origin main` succeeded through the SSA alias, updating
    `origin/main` from `ccf5092` to `f3e2159`.
  - Return a real task card to Home AI before ending this turn.

# 2026-06-25 - v437 tile title menu and Composer target scope deployed

- Scope:
  - User reported that tile pane thread-title clicks no longer opened the
    thread switch list.
  - User also clarified that the Composer target placeholder must appear only
    while the UI is actually in tile mode, not in single-thread mode.
- Root cause:
  - `bindThreadTileActions()` gated `toggleThreadTileSwitchMenu(...)` behind
    `if (!event.detail)`. Normal mouse/touch clicks generally have
    `event.detail=1`, so the title button selected the pane but did not open
    the switch menu.
  - The Composer placeholder checked `state.threadTileMode`, which can describe
    configured intent rather than the currently rendered conversation mode.
- Change:
  - Removed the `event.detail` gate so title button clicks always toggle the
    pane's switch menu.
  - Added `isThreadTileComposerContext()`, requiring configured tile mode, the
    actual `.conversation.thread-tile-mode` DOM state, and active tile panes.
  - `composerPlaceholderText()` and `composerShowsTargetPlaceholder()` now use
    that actual tile-context predicate, so single-thread mode keeps
    `Message Codex`.
  - `setThreadTileConversationMode()` now calls `updateComposerControls()` so
    placeholder state updates immediately when the actual layout mode changes.
  - PWA shell cache advanced to `codex-mobile-shell-v437`.
- Validation:
  - `node --check public/app.js && node --check public/sw.js` passed.
  - Focused UI tests passed:
    `node --test test/thread-tile-layout-ui.test.js test/composer-quota.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
    (`34` tests).
  - `npm run check` passed.
  - `git diff --check` passed.
- Deployment:
  - Code commit:
    `fdd7286 fix: restore tile title menu interaction`.
  - Deployed through the Home AI central plugin deploy script.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T052512Z-plugin-codex-mobile-web-manual`.
  - `/api/public-config` reports `clientBuildId=0.1.11|codex-mobile-shell-v437`,
    `shellCacheName=codex-mobile-shell-v437`, `version=0.1.11`,
    `authRequired=true`, and build id `983c98892640c564`.
  - Source/production SHA-256 samples matched for `public/app.js`,
    `public/sw.js`, `README.md`, and `test/thread-tile-layout-ui.test.js`.
  - Central deploy validation reported zero blocking auth-profile audit issues.
- Not pushed Public:
  - Follow release-order rule. Public sync requires explicit user instruction
    after production/user validation.

# 2026-06-25 - v436 tile pane contrast deployed

- Scope:
  - User requested clearer visual separation in wide tile mode and a more
    visible Composer target hint.
  - This is a visual CSS/UI polish only; it does not change pane count, active
    pane selection, send target, thread refresh, or Composer behavior.
- Code commit:
  - `09848ed fix: improve tile pane visual separation`
- Change:
  - Added tile-pane header color variables for dark, light, and system-light
    themes.
  - `.thread-tile-pane-header` now uses a deeper dedicated background and a
    stronger bottom border.
  - `.thread-tile-pane.active .thread-tile-pane-header` uses a lightly accented
    active background.
  - `updateComposerControls()` toggles `has-target-placeholder` on
    `#messageInput` when tile mode is showing `发送到：<thread>`.
  - `.message-input.has-target-placeholder:empty::before` uses a more visible
    target color and slightly stronger weight. Ordinary `Message Codex`
    placeholder styling is unchanged.
  - PWA shell cache advanced to `codex-mobile-shell-v436`.
- Validation:
  - Focused UI tests passed:
    `node --test test/thread-tile-layout-ui.test.js test/composer-quota.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
    (`34` tests).
  - `npm run check` passed.
  - `npm test` passed (`777` tests).
  - `git diff --check` passed.
- Production deploy:
  - Deployed through the Home AI central plugin deploy script.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T050430Z-plugin-codex-mobile-web-manual`.
  - `/api/public-config` reports `clientBuildId=0.1.11|codex-mobile-shell-v436`,
    `shellCacheName=codex-mobile-shell-v436`, `version=0.1.11`,
    `authRequired=true`, and build id `c44493ef6e205801`.
  - Source/production SHA-256 samples matched for `public/app.js`,
    `public/sw.js`, `public/styles.css`, and `README.md`.
  - Central deploy validation reported zero blocking auth-profile audit issues.
- Not pushed Public:
  - Follow release-order rule. Public sync requires explicit user instruction
    after production/user validation.

# 2026-06-25 - v435 thread-detail merge policy deployed

- Scope:
  - Continued the architecture optimization goal, Phase 2 frontend state
    ownership.
  - Extracted thread/turn-level thread-detail merge orchestration out of
    `public/app.js` into `public/thread-detail-merge-state.js`.
  - Also tightened the server raw-operation fallback discovered by the full
    test suite: completed/non-live turns no longer gain new raw operation cards
    from rollout fallback; they only merge existing operation items. Live turns
    can still rehydrate missing operations.
- Code commit:
  - `f92987e refactor: extract thread detail merge policy`
- Changed boundary:
  - `public/thread-detail-merge-state.js` owns v4 projection delegation,
    incoming turn merge, stale mobile load flag cleanup, active live-turn
    retention, expanded-history preservation, and initial-submission echo
    cleanup.
  - `public/app.js` now wires the helper and passes runtime `activeTurnId`; item
    merge functions remain in `app.js` for now.
  - PWA shell cache and client build id advanced to
    `codex-mobile-shell-v435`.
- Docs updated:
  - `README.md`
  - `docs/MODULES.md`
  - `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`
  - `docs/HOME_AI_PLATFORM_CONTRACT.md`
- Validation:
  - Focused tests passed:
    `node --test test/thread-detail-merge-state.test.js test/thread-detail-state.test.js test/thread-detail-render-plan.test.js test/conversation-render.test.js test/mobile-viewport.test.js test/app-update.test.js test/plugin-voice-input.test.js test/thread-tile-layout-ui.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
    (`156` tests).
  - `node --test test/thread-item-timestamp-enrichment.test.js test/thread-turn-compaction-policy-service.test.js`
    passed (`29` tests) after tightening the raw-operation fallback.
  - `npm test` passed (`777` tests).
  - `npm run check` passed.
  - `git diff --check` passed.
- Production deploy:
  - Deployed through the Home AI central plugin deploy script.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T045551Z-plugin-codex-mobile-web-manual`.
  - `/api/public-config` reports `clientBuildId=0.1.11|codex-mobile-shell-v435`,
    `shellCacheName=codex-mobile-shell-v435`, `version=0.1.11`,
    `authRequired=true`, and build id `6d07230bfa206e4f`.
  - Source/production SHA-256 samples matched for `public/app.js`,
    `public/sw.js`, `public/index.html`, `public/thread-detail-merge-state.js`,
    `server.js`, `README.md`, `docs/MODULES.md`, and
    `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`.
  - Central deploy validation reported zero blocking auth-profile audit issues.
- Not pushed Public:
  - Follow release-order rule. Public sync requires explicit user instruction
    after production/user validation.
- Remaining architecture targets:
  - Continue Phase 2 by extracting DOM patch/conversation patch ownership from
    `public/app.js`.
  - Continue Phase 3 large-session cold-path evidence/optimization with current
    projection/read orchestration boundaries.
  - Add browser/visual coverage for mobile flicker, task-card folding, image
    rendering, and PWA refresh paths.

# 2026-06-25 - v434 Public sync verified

- Scope:
  - User requested `推送public`.
  - No new source changes were published beyond the already deployed v434
    composer placeholder / tile updates.
- Public status:
  - `public/main` was already at
    `efd5c13 release: publish v434 composer and tiling updates`.
  - `git push public refs/remotes/public/main:refs/heads/main` returned
    `Everything up-to-date`.
  - Excluding `.agent-context`, `git diff --stat remotes/public/main..main`
    was empty.
  - Public tree scan found no `.agent-context`, uploads, logs, generated-images,
    or other private runtime directories.
- Private history hygiene:
  - Created a private merge commit with `-s ours` so `remotes/public/main` is
    again an ancestor of local `main`.
  - `git merge-base --is-ancestor remotes/public/main main` returned `0`.
- Current caveat:
  - `public/thread-detail-merge-state.js` remains an untracked local file from
    the next architecture-optimization slice. It is not wired into the app shell
    and was not included in the v434 public sync.

# 2026-06-25 - v434 tile composer target placeholder deployed

- Scope:
  - Corrects v433 Composer target display after user feedback.
  - v433's separate target row was too tall for tile mode and consumed vertical
    space.
  - Implemented, committed, and deployed to Mac production.
  - Not pushed Public.
  - Code commit:
    - `391551d fix: use composer placeholder for tile target`
- Change:
  - Removed `#composerTargetHint` / `#composerTargetName` from the Composer DOM.
  - Removed `.composer-target-*` styles and the extra `target` grid row.
  - Replaced the target row with `composerPlaceholderText()`: in tile mode,
    when the Composer is bound to an existing active pane, the empty input
    placeholder becomes `发送到：<thread name>`.
  - Single-thread mode keeps `Message Codex`; new-thread draft mode keeps
    `输入第一条消息`.
  - PWA shell cache bumped to `codex-mobile-shell-v434`.
- Validation:
  - `node --check public/app.js && node --check public/sw.js` passed.
  - Focused run passed:
    `node --test test/composer-quota.test.js test/thread-tile-layout-ui.test.js test/mobile-viewport.test.js test/thread-task-card-route.test.js test/thread-goal-service.test.js`
    (`34` tests).
  - `npm run check` passed.
  - `git diff --check` passed.
- Production deploy:
  - Deployed through the Home AI central plugin deploy script.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T042220Z-plugin-codex-mobile-web-manual`.
  - `/api/public-config` reports `clientBuildId=0.1.11|codex-mobile-shell-v434`,
    `shellCacheName=codex-mobile-shell-v434`, `version=0.1.11`,
    `authRequired=true`, and build id `59f4860cf1e63675`.
  - Source/production SHA-256 samples matched for `public/app.js`,
    `public/sw.js`, `public/index.html`, `public/styles.css`, and `README.md`.
  - Central deploy validation reported zero blocking auth-profile audit issues.

# 2026-06-25 - v433 tile composer target hint deployed

- Scope:
  - Small tile-mode UX guard to reduce accidental sends to the wrong pane.
  - Implemented, committed, and deployed to Mac production.
  - Not pushed Public.
  - Code commit:
    - `e1e14f3 feat: show tile composer target`
- Change:
  - Added `#composerTargetHint` / `#composerTargetName` to the shared Composer.
  - `renderComposerTargetHint()` displays `发送到 · <thread name>` when
    `threadTileMode` is active and the Composer is bound to an existing thread.
  - The hint uses the same `currentComposerThreadId()` and
    `composerTargetThread()` path as send, task-card draft, Stop, and steer
    controls; it does not introduce a separate target calculation.
  - Single-thread mode and new-thread draft mode keep the hint hidden.
  - PWA shell cache bumped to `codex-mobile-shell-v433`.
- Validation:
  - `node --check public/app.js && node --check public/sw.js` passed.
  - Focused run passed:
    `node --test test/composer-quota.test.js test/thread-tile-layout-ui.test.js test/mobile-viewport.test.js test/thread-task-card-route.test.js test/thread-goal-service.test.js`
    (`34` tests).
  - `npm run check` passed.
  - `git diff --check` passed.
- Production deploy:
  - Deployed through the Home AI central plugin deploy script.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T041731Z-plugin-codex-mobile-web-manual`.
  - `/api/public-config` reports `clientBuildId=0.1.11|codex-mobile-shell-v433`,
    `shellCacheName=codex-mobile-shell-v433`, `version=0.1.11`,
    `authRequired=true`, and build id `71415c9c95d0cc8c`.
  - Source/production SHA-256 samples matched for `public/app.js`,
    `public/sw.js`, `public/index.html`, `public/styles.css`, and `README.md`.
  - Central deploy validation reported zero blocking auth-profile audit issues.

# 2026-06-25 - v432 thread detail render-plan slice pending commit/deploy

- Scope:
  - Continuing the architecture optimization sequence without a broad rewrite.
  - This slice extracts the thread-detail refresh render-mode decision from
    `public/app.js` into a pure frontend helper.
  - Validated locally. Not deployed and not pushed Public at the time this note
    was written.
- Change:
  - Added `public/thread-detail-render-plan.js`.
  - The helper decides whether a refresh is `metadata-only`, eligible for local
    DOM `patch`, or must use `full-render` from three signatures:
    previous conversation, next conversation, and the currently rendered DOM
    conversation signature.
  - `refreshCurrentThread` now calls that helper before attempting
    `patchCurrentThreadDetailFromRefresh`.
  - Local patch is only attempted when the current DOM signature still matches
    the pre-refresh conversation signature. If the DOM signature is stale, the
    refresh goes straight to full render instead of trying to patch on an
    unreliable baseline.
  - Added the new static asset to `public/index.html`, `PAGE_SHELL_ASSETS`,
    `public/sw.js`, and the server app-shell build fingerprint list.
  - Added the new helper to `npm run check`.
  - PWA shell cache bumped to `codex-mobile-shell-v432`.
- Tests/docs:
  - Added `test/thread-detail-render-plan.test.js`.
  - Updated script-order/build-id tests.
  - Updated `README.md`, `docs/MODULES.md`, and
    `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`.
- Validation:
  - `node --check public/app.js && node --check public/sw.js && node --check public/thread-detail-render-plan.js && node --check server.js`
    passed.
  - `npm run check` passed.
  - Focused frontend/thread-detail run passed:
    `node --test test/thread-detail-render-plan.test.js test/conversation-render.test.js test/mobile-viewport.test.js test/app-update.test.js test/plugin-voice-input.test.js test/thread-performance-metrics.test.js test/thread-task-card-route.test.js test/thread-goal-service.test.js`
    (`140` tests).
  - `git diff --check` passed.

# 2026-06-25 - v431 tile local split columns and header drag deployed

- Scope:
  - Implemented, committed, and deployed a split-screen reader layout
    improvement for wide tile mode.
  - Not pushed Public.
  - Code commit:
    - `0c297f0 feat: support local split tile panes`
- Change:
  - `public/thread-tile-layout.js` now builds column groups for tile panes. If
    the visible pane count exceeds physical column capacity, overflow panes are
    placed inside existing columns as local vertical splits instead of creating
    a sparse second full row.
  - Example: 5 panes on a 4-column desktop becomes three full-height columns
    plus one column split into two panes, not 4 panes on row one and one lonely
    pane on row two.
  - `public/app.js` renders `.thread-tile-column` wrappers and persists
    `paneSplitPairs` in the existing `/api/settings/thread-display` settings.
  - Pane title buttons are draggable. Dropping onto a target pane's center pairs
    the dragged pane with that target as an up/down split; dropping on the
    target pane's left or right edge moves the dragged pane before or after the
    target.
  - `server.js` normalizes and persists `paneSplitPairs` alongside
    `paneThreadIds`, `paneCount`, and `selectedThreadId`.
  - PWA shell cache bumped to `codex-mobile-shell-v431`.
  - `README.md`, `docs/MODULES.md`, and
    `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md` document the behavior.
- Validation:
  - `node --check public/app.js && node --check public/sw.js && node --check public/thread-tile-layout.js && node --check server.js`
    passed.
  - `node --test test/thread-tile-layout.test.js test/thread-tile-layout-ui.test.js test/thread-visibility.test.js test/mobile-viewport.test.js test/thread-task-card-route.test.js test/thread-goal-service.test.js`
    passed (`84` tests).
  - Expanded focused run passed:
    `node --test test/thread-tile-layout.test.js test/thread-tile-layout-ui.test.js test/thread-visibility.test.js test/mobile-viewport.test.js test/thread-task-card-route.test.js test/thread-goal-service.test.js test/app-update.test.js test/plugin-voice-input.test.js`
    (`98` tests).
  - `git diff --check` passed.
  - A temporary source-workspace server was started on `127.0.0.1:8891` for
    browser smoke, then stopped. Browser automation through Node REPL failed
    with a tool `sandboxCwd` error, and direct local Playwright smoke was not
    run because this workspace does not have a `playwright` dependency. Use the
    Home AI central visual tool after deployment if live visual evidence is
    required.
- Production deploy:
  - Deployed through the Home AI central plugin deploy script.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T034418Z-plugin-codex-mobile-web-manual`.
  - `/api/public-config` reports `clientBuildId=0.1.11|codex-mobile-shell-v431`,
    `shellCacheName=codex-mobile-shell-v431`, `version=0.1.11`,
    `authRequired=true`, and build id `7ed7403159756514`.
  - Source/production SHA-256 samples matched for `public/app.js`,
    `public/sw.js`, `public/thread-tile-layout.js`, `public/styles.css`, and
    `server.js`.
  - Central deploy validation reported zero blocking auth-profile audit issues.

# 2026-06-25 - v430 architecture optimization slice pending deploy

- Scope:
  - Implemented the next optimization slice for the first two architecture
    priorities: large-session evidence and frontend thread-detail state
    ownership.
  - Committed locally, not deployed, and not pushed Public.
  - Code commit:
    - This commit: `refactor: add thread detail shape diagnostics`.
- Change:
  - `public/thread-performance-metrics.js` now emits bounded `detailShape`
    counts with thread-detail performance fields. The shape includes turn/item
    counts, visible item count, image/operation/receipt/usage/diagnostic item
    counts, and completed/active turn counts. It intentionally excludes message
    bodies, raw paths, command text, image contents, provider payloads, and
    prompts.
  - `public/app.js` includes `detailShape` in
    `thread_detail_first_paint`, `thread_refresh_ms`, and full-backfill
    performance events.
  - `public/thread-detail-state.js` now owns the live-to-completed same-turn
    visible-item preservation rule, reducing `public/app.js` state-policy
    ownership.
  - PWA shell cache bumped to `codex-mobile-shell-v430`.
  - `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md` document this optimization boundary.
- Validation:
  - `node --check public/app.js && node --check public/sw.js && node --check public/thread-performance-metrics.js && node --check public/thread-detail-state.js`
    passed.
  - `node --test test/thread-performance-metrics.test.js test/thread-detail-state.test.js test/conversation-render.test.js test/mobile-viewport.test.js test/thread-task-card-route.test.js test/thread-goal-service.test.js test/app-update.test.js test/plugin-voice-input.test.js`
    passed (`147` tests).
  - `git diff --check` passed.
- Next:
  - Deploy only if the user requests production deployment.
  - Continue Phase 2 by extracting broader thread-detail merge orchestration or
    DOM patch planning out of `public/app.js` after this evidence layer is
    stable.

# 2026-06-25 - v429 live-to-completed weak projection merge fix deployed

- Scope:
  - Fixed, committed, and deployed Movie/new-thread transient refresh
    regression after v428/v429 server operation projection deploys.
  - Not pushed Public.
  - Code commit:
    - `3c78e8b fix: preserve live turn details on completion refresh`
- Trigger:
  - User reported Movie initially showed normal intermediate images/process
    items for several refreshes, then suddenly refreshed into the weak state
    with mostly a user request plus final receipt. Later a new receipt/detail
    refresh restored richer content.
- Root cause:
  - Service detail API was returning rich active turns, but the browser can also
    receive a weaker completed patch containing final receipt and Usage before
    rollout-derived images/operations are present.
  - `shouldPreserveLiveTurnLocalVisibleItems()` explicitly returned `false`
    when the incoming turn was completed. If the completed final receipt was
    long enough, the weight comparison treated the weak completed patch as more
    complete and removed existing image/operation items.
- Change:
  - `public/app.js` now preserves non-receipt visible items from the same
    existing active turn during live-to-completed merges. Authoritative
    completed receipts still replace local transient receipts through the
    existing `shouldDropLocalOnlyReceiptForIncomingTurn()` rule.
  - PWA shell cache bumped to `codex-mobile-shell-v429`.
  - Regression test added for small image/operation items being preserved even
    when the incoming completed patch has a long final receipt.
  - README records v429 root cause and behavior.
- Validation:
  - `node --check public/app.js && node --check public/sw.js` passed.
  - `node --test test/conversation-render.test.js test/thread-detail-state.test.js test/mobile-viewport.test.js test/thread-task-card-route.test.js test/thread-goal-service.test.js`
    passed (`126` tests).
  - `git diff --check` passed.
- Production deploy:
  - Deployed through the Home AI central plugin deploy script.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T030147Z-plugin-codex-mobile-web-manual`.
  - `/api/public-config` reports `clientBuildId=0.1.11|codex-mobile-shell-v429`,
    `shellCacheName=codex-mobile-shell-v429`, `version=0.1.11`, and
    `authRequired=true`.
  - Source/production SHA-256 samples matched for `public/app.js`,
    `public/sw.js`, and `server.js`.
  - Central deploy validation reported zero blocking auth-profile audit issues.
- Notes:
  - The server detail API was already returning rich Movie active-turn detail
    after the prior server fix; v429 closes the browser-side merge path where a
    weaker completed patch could temporarily delete existing images and
    operation items.
  - Devices must load the v429 shell for this client-side merge fix.

# 2026-06-25 - Movie completed/live operation projection fix deployed

- Scope:
  - Implemented, validated, committed, and deployed to Mac production after the
    v428 tile-mode composer fix.
  - Not pushed Public.
  - Code commit:
    - `084b79e fix: restore rollout operations for completed turns`
- Trigger:
  - User reported a newly-created `Movie` workspace/thread showed only user
    messages and the final system/assistant receipt; intermediate process items
    were missing.
- Evidence:
  - Movie thread id: `019efca1-ea69-7292-87b7-025ba023ca87`.
  - Workspace/cwd: `/Users/hermes-dev/HermesMobileDev/Movie`.
  - Runtime rollout contains intermediate `response_item` / `function_call`,
    `event_msg` / `patch_apply_end`, and final assistant events.
  - Production `/api/threads/:id` returned `projection-v4-dynamic` with
    completed turns containing only `userMessage`, `agentMessage`, and
    `turnUsageSummary`.
- Root cause:
  - `compactThread()` only merged rollout raw operations into the latest live
    turn. Completed turns selected by `operationDetailTurnIndexes()` were still
    compacted before rollout raw operations were attached, so they became
    receipt-only when app-server detail did not already carry operation items.
- Change:
  - `server.js` replaces the live-only merge helper with
    `mergeRecentRawOperationsIntoTurn()`.
  - `compactThread()` now merges rollout raw operations into every turn selected
    by `operationDetailTurnIndexes()` before `compactTurn()` filters operation
    items.
  - Regression test added in
    `test/thread-turn-compaction-policy-service.test.js`.
  - README records the Movie projection root cause and server-only fix.
- Validation before deploy:
  - `node --check server.js` passed.
  - `node --test test/thread-turn-compaction-policy-service.test.js test/thread-detail-projection-service.test.js test/thread-detail-projection-v4-service.test.js test/conversation-render.test.js`
    passed (`115` tests).
  - `git diff --check` passed.
- Production deploy:
  - Central Home AI deploy script used from `/Users/hermes-dev/HermesMobileDev/app`:
    `npm run --silent deploy:macos -- --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --restart-label com.hermesmobile.plugin.codex-mobile --health-url http://127.0.0.1:8787/api/public-config --execute --json`
  - Source ref deployed:
    `084b79e2f5e9`.
  - Backup path:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T025336Z-plugin-codex-mobile-web-manual`.
  - Production `/api/public-config` stayed on `0.1.11|codex-mobile-shell-v428`
    / `codex-mobile-shell-v428`; this was server-only and did not require a
    PWA cache bump.
  - Source/production `server.js` short SHA-256 matched:
    `9b32557c1416f9fb`.
  - Central deployment validation passed; non-strict auth-profile audit had
    zero blocking issues.
- Post-deploy Movie verification:
  - Movie thread `019efca1-ea69-7292-87b7-025ba023ca87` detail still returns
    `projection-v4-dynamic`.
  - The current active turn now includes rollout-derived intermediate operation
    items; sampled API result showed `38` `commandExecution` items.
  - Older completed turns remain folded unless selected by
    `operationDetailTurnIndexes()`. That is the existing history compaction
    policy, not runtime data loss.

# 2026-06-25 - v428 tile-mode composer @ menu deployed

- Scope:
  - Implemented, validated, committed, and deployed to Mac production.
  - Not pushed Public.
  - Code commit:
    - `14a73bd fix: keep composer intent menu visible in tile mode`
- Trigger:
  - User reported that typing `@` in the Composer to open target-task actions
    was not visible in thread tile/split-pane mode.
- Root cause:
  - The `@` intent menu was already a page-level fixed overlay, but it used its
    own `bottom` / width variables and did not share the viewport-clamped popup
    positioning used by the Composer model/reasoning/permission menus. In
    tiled, keyboard, wide, and embedded layouts the menu could be placed outside
    the visible viewport.
- Change:
  - `positionComposerIntentMenu()` now delegates to
    `fitComposerPopupToAnchor(menu, anchor, { minWidth: 280, maxWidth: 420 })`.
  - `.composer-intent-menu` now uses the shared `--composer-popup-*` CSS
    variables, including bounded max-height.
  - PWA shell cache bumped to `codex-mobile-shell-v428`.
  - README records the v428 fix in Chinese.
  - `docs/HOME_AI_PLATFORM_CONTRACT.md` latest production evidence updated from
    v427 to v428 after deployment.
- Validation before deploy:
  - `node --check public/app.js`
  - `node --check public/sw.js`
  - `node --test test/thread-task-card-route.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js test/composer-quota.test.js test/thread-tile-layout-ui.test.js`
    passed (`34` tests).
  - `git diff --check` passed.
- Production deploy:
  - Central Home AI deploy script used from `/Users/hermes-dev/HermesMobileDev/app`:
    `npm run --silent deploy:macos -- --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --restart-label com.hermesmobile.plugin.codex-mobile --health-url http://127.0.0.1:8787/api/public-config --execute --json`
  - First source ref deployed:
    `14a73bd008cd`.
  - Production target:
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Latest backup path reported by the final deployment:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T024820Z-plugin-codex-mobile-web-manual`.
  - Note: the deploy retention policy pruned the earlier same-day
    `20260625T024619Z-plugin-codex-mobile-web-manual` backup during the final
    evidence-sync deployment.
  - Post-deploy `/api/public-config` returned `version=0.1.11`,
    `clientBuildId=0.1.11|codex-mobile-shell-v428`,
    `shellCacheName=codex-mobile-shell-v428`, `authRequired=true`, and
    production workspace path
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Source/production short SHA-256 samples matched for `public/app.js`
    (`0a05fc26e2feac68`), `public/styles.css` (`28af943f0f2f0b20`), and
    `public/sw.js` (`19339bfbe434fdf5`).
  - Central deployment validation passed; non-strict auth-profile audit had
    zero blocking issues.
- Next:
  - User next reported a new `Movie` workspace/thread where only the user
    message and final system receipt are visible, while intermediate process
    items are missing. Investigate thread detail projection/rendering for that
    thread after this deployment bookkeeping is closed.

# 2026-06-25 - v427 manual tile width and task-card protocol deployed

- Scope:
  - Implemented, validated, committed, and deployed to Mac production.
  - Not pushed Public.
  - Code commit:
    - `8a41a1e feat: add task-card reasoning return controls`
- Trigger:
  - User reported a 6K/high-DPI desktop still wrapped the 5th tile pane after
    v426. The actual browser layout width is the macOS CSS `Looks like` width
    rather than display physical pixels, so automatic 420px panes still produced
    only 4 columns with the sidebar present.
  - User also reported return task cards showing as Pending/Approve in the source
    thread. Root cause: `return_to_source` went through the ordinary `/reply`
    reverse-card path, whose persisted card status was `pending`, and the service
    did not distinguish source-thread return closure from an ordinary reply.
  - Home AI task card `ttc_f03349b5d390fa1d87` requested first-class task-card
    reasoning control for deep Product Reality audits.
- Change:
  - `public/thread-tile-layout.js` now accepts the explicit desired pane count.
    Automatic mode keeps the 420 CSS px desktop pane width; manual mode derives
    pane width from available CSS width and requested pane count, with a 300 CSS
    px desktop safety floor. A 2560 CSS px desktop with a 520px sidebar now fits
    5 manual panes in one row.
  - PWA shell cache bumped to `codex-mobile-shell-v427`.
  - `adapters/thread-task-card-service.js` now validates optional
    `reasoningEffort` (`low|medium|high|xhigh`), stores it on delivery metadata,
    shows it in injected task-card text, and persists bounded
    `injectionRuntime` evidence after approval.
  - The task-card approval executor in `server.js` applies requested
    `reasoningEffort` over the inherited target-thread runtime before
    `thread/resume` / `turn/start`.
  - `return_to_source`, `scripts/return-thread-task-card.js`, and `/reply` with
    `returnToSource:true` now create source-direct approved return cards instead
    of ordinary pending reply cards. Reusing an old `task-card-return:*`
    idempotency key can promote an already-created pending return card through
    the same direct-return path.
  - MCP/script/dynamic-tool schemas now expose bounded `reasoningEffort` and
    `partially_completed` return status.
  - `docs/HOME_AI_PLATFORM_CONTRACT.md` latest production evidence updated from
    v426 to v427 after deployment.
- Validation before deploy:
  - `node --check` for changed server/service/script/static files passed.
  - Focused suite:
    `node --test test/thread-task-card-service.test.js test/thread-task-card-route.test.js test/codex-mobile-mcp-server.test.js test/thread-tile-layout.test.js test/thread-tile-layout-ui.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js`
    passed (`68` tests).
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `npm test` passed (`759` tests).
  - `git diff --check` passed.
  - `codegraph sync && codegraph status` reported the index up to date, with an
    older-engine-version warning only.
- Production deploy:
  - Central Home AI deploy script used from `/Users/hermes-dev/HermesMobileDev/app`:
    `npm run --silent deploy:macos -- --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --restart auto --health-url http://127.0.0.1:8787/api/public-config --reason codex-mobile-v427-return-reasoning --execute --json`
  - Source ref deployed:
    `8a41a1e7e287`.
  - Production target:
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup path reported by deployment:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260624T165259Z-plugin-codex-mobile-web-codex-mobile-v427-return-reasoning`.
  - Post-deploy `/api/public-config` returned `version=0.1.11`,
    `clientBuildId=0.1.11|codex-mobile-shell-v427`,
    `shellCacheName=codex-mobile-shell-v427`, `authRequired=true`,
    production workspace path
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`, and
    `reasoningEffortOptions=["low","medium","high","xhigh"]`.
  - Source/production short SHA-256 samples matched for `server.js`,
    `adapters/thread-task-card-service.js`, task-card scripts, `public/app.js`,
    `public/sw.js`, `public/thread-tile-layout.js`, README, and task-card/
    architecture/module docs.
  - LaunchDaemon `system/com.hermesmobile.plugin.codex-mobile` was running after
    deploy.
  - Central deployment audit remained non-blocking with `blockingIssueCount=0`.
- Operational notes:
  - Browser/PWA clients must load v427 shell/cache to exercise the manual
    tile-width behavior.
  - Future deep audit task cards should pass `reasoningEffort:"xhigh"` through
    `delegate_to_thread` or `scripts/create-thread-task-card.js`.
  - Target thread local final answers still do not count as source-thread return
    cards; use `codex_mobile.return_to_source` or
    `scripts/return-thread-task-card.js`.

# 2026-06-24 - Wide tile-column v426 deployed

- Scope:
  - Implemented, validated, committed, and deployed to Mac production.
  - Not pushed Public.
  - Code commit:
    - `8ca8dae fix: keep wide tile panes in one row`
- Trigger:
  - v425 removed the 4-pane add-window stop, but desktop layout still used the
    old physical 4-column cap. On a sufficiently wide desktop screen, the 5th
    or 6th pane could wrap even though the user intentionally requested more
    panes and the screen width could hold them.
- Change:
  - `public/thread-tile-layout.js` now separates three concepts:
    automatic recommended pane capacity, physical columns/rows, and bounded
    user pane ceiling (`DEFAULT_USER_MAX_PANES=12`).
  - Desktop physical columns can grow with available width up to the user pane
    ceiling; tablet landscape remains capped at 4 columns.
  - `public/app.js` still uses recommended capacity for automatic tile mode
    (`paneCount=0`), but honors the user-selected count when explicit panes are
    added.
  - PWA shell cache bumped to `codex-mobile-shell-v426`.
  - `docs/HOME_AI_PLATFORM_CONTRACT.md` latest production evidence was updated
    from v425 to v426 after deployment.
- Validation before deploy:
  - `node --check public/thread-tile-layout.js public/app.js public/sw.js`
    passed.
  - Focused suite:
    `node --test test/thread-tile-layout.test.js test/thread-tile-layout-ui.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
    passed (`38` tests).
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `npm test` passed (`755` tests).
  - `git diff --check` passed.
- Production deploy:
  - Central Home AI deploy script used from `/Users/hermes-dev/HermesMobileDev/app`:
    `npm run --silent deploy:macos -- --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --restart-label com.hermesmobile.plugin.codex-mobile --health-url http://127.0.0.1:8787/api/public-config --reason wide-tile-columns-v426 --execute --json`
  - Source ref deployed:
    `8ca8dae0dffc`.
  - Production target:
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup path reported by deployment:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260624T161704Z-plugin-codex-mobile-web-wide-tile-columns-v426`.
  - Post-deploy `/api/public-config` returned `version=0.1.11`,
    `clientBuildId=0.1.11|codex-mobile-shell-v426`,
    `shellCacheName=codex-mobile-shell-v426`, and production workspace path
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Source/production short SHA-256 samples matched for `public/app.js`,
    `public/sw.js`, `public/plugin-embed.js`, `public/thread-tile-layout.js`,
    README, and architecture/module docs before the evidence-doc update.
  - Central deployment audit remained non-blocking with
    `blockingIssueCount=0`.
- Operational notes:
  - Browser/PWA clients must load v426 shell/cache to exercise the wide-column
    tile behavior.
  - Plugin Workspace Audit task card `ttc_d59788971449b66f5e` was already
    returned before v426 follow-up; do not re-reply to the same original card.

# 2026-06-24 - Route-hint coverage and tile user pane ceiling v425 deployed

- Scope:
  - Implemented, validated, committed, and deployed to Mac production.
  - Not pushed Public.
  - Code commit:
    - `06d8c8b feat: repair route hints and tile pane limits`
- Trigger:
  - User requested removing the hard 4-pane add-window stop because wide desktop
    screens may reasonably support 6 or more tile panes.
  - Plugin Workspace Audit card `ttc_d59788971449b66f5e` also reported that
    Hermes notification/task-card route-hint behavior was product-critical but
    mostly covered by source-string tests, and that
    `docs/HOME_AI_PLATFORM_CONTRACT.md` still presented old v251 production
    evidence as latest.
- Change:
  - `public/thread-tile-layout.js` now distinguishes automatic recommended pane
    capacity (`DEFAULT_MAX_PANES=6`) from the bounded user pane safety ceiling
    (`DEFAULT_USER_MAX_PANES=12`).
  - `public/app.js` keeps `paneCount=0` on automatic current/running-thread and
    viewport recommended capacity, but positive user pane counts are no longer
    capped by the current viewport capacity. Explicitly added panes wrap into
    extra rows when they exceed recommended columns.
  - The pane-title switch menu now shows count against the user-reachable max
    count and keeps `关闭窗口` / `新增窗口` ownership in the pane menu.
  - Hermes route-hint normalization, open/focus plan, DOM target selector order,
    and URL scrub policy moved into `public/plugin-embed.js`; `public/app.js`
    consumes the plan and performs state transitions.
  - PWA shell cache bumped to `codex-mobile-shell-v425`.
  - `docs/HOME_AI_PLATFORM_CONTRACT.md` latest production evidence replaced the
    stale v251 block with v425 bounded readback evidence.
- Validation before deploy:
  - Focused suite:
    `node --test test/plugin-embed.test.js test/hermes-plugin-route.test.js test/thread-tile-layout.test.js test/thread-tile-layout-ui.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
    passed (`52` tests).
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `npm test` passed (`754` tests).
  - `git diff --check` passed.
- Production deploy:
  - Central Home AI deploy script used from `/Users/hermes-dev/HermesMobileDev/app`:
    `npm run --silent deploy:macos -- --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --restart-label com.hermesmobile.plugin.codex-mobile --health-url http://127.0.0.1:8787/api/public-config --reason route-hint-tile-pane-v425 --execute --json`
  - Source ref deployed:
    `06d8c8b4b7d6`.
  - Production target:
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Initial v425 code-deploy backup reported at:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260624T160709Z-plugin-codex-mobile-web-route-hint-tile-pane-v425`.
  - Follow-up evidence-doc sync deployed source ref `8ba84412c2c2` with central
    reason `route-hint-tile-pane-v425-evidence`. It reported backup path
    `/Users/hermes-host/HermesMobile/backups/deploy/20260624T160929Z-plugin-codex-mobile-web-route-hint-tile-pane-v425-evidence`
    and pruned the initial v425 code-deploy backup under retention policy.
    Direct local `ls` of the backup root is permission-denied for this session,
    so do not claim backup filesystem existence from a later manual stat.
  - Post-deploy `/api/public-config` returned `version=0.1.11`,
    `clientBuildId=0.1.11|codex-mobile-shell-v425`,
    `shellCacheName=codex-mobile-shell-v425`, and production workspace path
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Source/production short SHA-256 samples matched for
    `docs/HOME_AI_PLATFORM_CONTRACT.md`, `public/app.js`, `public/sw.js`,
    `public/plugin-embed.js`, and `public/thread-tile-layout.js` after the
    evidence-doc sync.
  - Central deployment audit remained non-blocking with
    `blockingIssueCount=0`.
- Operational notes:
  - Browser/PWA clients must load v425 or newer shell/cache to exercise the
    frontend route-hint and tile-pane changes.
  - Returned a real task card to Plugin Workspace Audit for
    `ttc_d59788971449b66f5e`; return card id was
    `ttc_5493760d67b99f4fbb`.

# 2026-06-24 - Task-card manual return toolchain repaired and deployed

- Scope:
  - Implemented, validated, committed, and deployed to Mac production.
  - Not pushed Public.
  - Code commit:
    - `c079581 fix: restore task card return path`
- Trigger:
  - Home AI reported that a Note implementation thread completed a manual
    repair card but could only report in its local final answer because no
    return-card/delegation tool was visible. Home AI did not receive a real
    cross-thread return card, breaking audit/repair closure.
- Root cause:
  - `threadTaskCardService.reply()` only allowed `pending` originals. Real
    implementation task cards become `approved` after target approval or
    source-thread direct injection, so the target could not return the card
    after doing the work.
  - Approved injected task-card messages did not expose a stable original
    `Task card id`.
  - The Codex Mobile dynamic/MCP toolset only exposed `delegate_to_thread`
    for new delegation. It had no target-side `return_to_source` tool and no
    target-side script fallback, so a local final answer could be mistaken for
    closure.
- Change:
  - `adapters/thread-task-card-service.js` now allows target-side reply while
    the original card is `pending` or `approved`, keeps same-key retries
    idempotent after the original becomes `replied`, and marks approved cards
    as returnable for the target thread.
  - Approved injected messages now include `Task card id: ...` and a manual
    return requirement stating that target-thread final text is not a
    source-thread return card.
  - `server.js` now injects `codex_mobile.return_to_source` as a task-card
    closure dynamic tool independently from the workspace-delegation switch.
    The existing `codex_mobile.delegate_to_thread` remains gated by
    `跨工作区委派`.
  - Added `scripts/return-thread-task-card.js`, a target-side CLI fallback that
    calls `POST /api/thread-task-cards/:id/reply` and generates stable
    `task-card-return:*` idempotency keys.
  - `scripts/codex-mobile-mcp-server.js` now exposes `return_to_source`; the
    MCP config service registers tool-level `approval_mode = "approve"` for
    `list_threads`, `delegate_to_thread`, and `return_to_source`.
  - Updated task-card README, architecture, implementation, module, and
    troubleshooting docs to record that local final text is not a return card.
- Validation before deploy:
  - Focused suite:
    `node --test test/thread-task-card-service.test.js test/codex-mobile-mcp-server.test.js test/thread-task-card-route.test.js test/thread-task-card-harness.test.js test/new-thread-route.test.js`
    passed (`63` tests).
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `npm test` passed (`749` tests).
  - `git diff --check` passed.
  - `codegraph sync && codegraph status` reported the index is up to date
    with a non-blocking older-engine warning.
- Production deploy:
  - Central Home AI deploy script used:
    `npm run --silent deploy:macos -- --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --restart-label com.hermesmobile.plugin.codex-mobile --health-url http://127.0.0.1:8787/api/public-config --reason task-card-return-toolchain-c079581 --execute --json`
  - Source ref deployed:
    `c0795813abc8`.
  - Production target:
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup retained at:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260624T154821Z-plugin-codex-mobile-web-task-card-return-toolchain-c079581`.
  - Deploy validation:
    - central health check passed for
      `http://127.0.0.1:8787/api/public-config`;
    - central auth-profile audit returned `blockingIssueCount=0`;
    - production `npm run check` passed;
    - production MCP self-test returned
      `["list_threads","delegate_to_thread","return_to_source"]`;
    - `/Users/xuxin/.codex/config.toml` has approve-mode entries for
      `list_threads`, `delegate_to_thread`, and `return_to_source`.
- Operational notes:
  - Production listener has been restarted through the central deploy script.
  - Existing Codex Homes get the new MCP tool when Mobile Web startup/Profile
    list/workspace creation/profile-switch sync runs.
  - Return a real task card to Home AI
    `019eed86-2002-7cc2-b0b7-937eb5355f36` with completion details before
    ending the thread.

# 2026-06-24 - Tile pane management v424 committed, deployed, and pushed Public

- Scope:
  - Implemented, validated, committed, and deployed to Mac production.
  - Pushed private `origin/main` and public `codex-mobile-web-public/main`.
  - Commit:
    - `5500932 feat: 优化平铺窗口管理`
    - `aa863f1 docs: record v424 production deploy`
    - `60e5c20 docs: 标记 v424 已同步 public`
  - Public commit:
    - `b952ebc release: 发布 v424 平铺窗口管理与架构重构`
- Trigger:
  - User reported that server-persisted tile panes can hide occasionally active
    threads: if a less-used thread is actively opened from the outer thread list,
    the fixed tile panes can still occupy all visible slots.
- Root cause:
  - v421-v423 correctly stabilized pane slot order, but the only explicit pane
    replacement action was the per-pane title switch menu. The outer thread-list
    open path (`loadThread(..., { source: "thread-list" })`) changed the current
    detail thread without updating the persisted visible tile slot order.
- Change:
  - `public/app.js` adds `replaceLastThreadTilePaneForThreadListOpen()`.
  - When tile mode is active and the user opens a non-visible thread from the
    outer thread list, the browser replaces the last currently visible pane slot
    with that thread, selects it for the shared Composer/runtime controls, clears
    stale pane scroll/menu state, and schedules `threadDisplay` persistence.
  - Background recent sorting and notification refresh still cannot reorder
    fixed pane slots; title-menu pane switching keeps its existing dedicated
    path.
  - PWA shell cache bumped to `codex-mobile-shell-v424`.
- Docs updated:
  - `README.md`
  - `docs/ARCHITECTURE.md`
  - `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`
- Validation:
  - `node --check public/app.js`
  - `node --check public/sw.js`
  - Focused suite:
    `node --test test/thread-tile-layout-ui.test.js test/thread-tile-layout.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
    (`35` tests passed)
  - `npm test` (`748` tests passed)
  - `npm run check`
  - `npm run check:macos`
  - `git diff --check`
- Operational notes:
  - Browser/PWA clients must load v424 shell to exercise the frontend changes.
  - Central Home AI deploy script used:
    `npm run --silent deploy:macos -- --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --restart-label com.hermesmobile.plugin.codex-mobile --health-url http://127.0.0.1:8787/api/public-config --reason tile-pane-management-v424 --execute --json`
  - Final deployed source ref: `aa863f163afb`.
  - Production target:
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup retained at:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260624T130631Z-plugin-codex-mobile-web-tile-pane-management-v424-record`.
  - First v424 deploy used source ref `5500932e3dc3` and backup
    `/Users/hermes-host/HermesMobile/backups/deploy/20260624T130337Z-plugin-codex-mobile-web-tile-pane-management-v424`;
    the second deploy synced the README deployment-status update and pruned the
    first v424 backup. The first deploy pruned the previous v422 backup
    `/Users/hermes-host/HermesMobile/backups/deploy/20260624T123122Z-plugin-codex-mobile-web-dynamic-tile-pane-count-v422`.
  - Post-deploy health returned
    `clientBuildId=0.1.11|codex-mobile-shell-v424` and
    `shellCacheName=codex-mobile-shell-v424`.
  - Production target validation:
    `npm run check` and `npm run check:macos` both passed in
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Central deployment audit remained non-blocking:
    `auditOk=false`, `issueCount=11`, `blockingIssueCount=0`.
  - Private push:
    `origin/main` updated to `60e5c20`.
  - Public sync:
    clean public mirror `/Users/hermes-dev/HermesMobileDev/public-mirrors/codex-mobile-web-public`
    was fast-forwarded to public `2f07f09`, then product files were rsynced from
    private checkout excluding `.agent-context`, runtime state, uploads, logs,
    env files, and local-only state.
  - Public validation before push:
    `npm test` (`748` tests passed), `npm run check`,
    `npm run check:macos`, `git diff --check`, and a tracked-file privacy scan
    for `.agent-context`, `.codegraph`, `.codex`, `node_modules`, `logs`,
    `uploads`, `runtime`, `data`, `.env`, VAPID/subscription/private-key/
    access-key/secret/cookie/launch-token terms.
  - Public push:
    `public/main` updated to `b952ebc`.

# 2026-06-24 - Tile pane count controls in title menu v423 local

- Scope:
  - Implemented and validated locally.
  - Not committed, not deployed, not pushed Public.
- Trigger:
  - User reported that the tile pane `- / +` controls should not live in the
    board's top-right corner because that placement covers content and is less
    flexible. The requested interaction is to show `关闭窗口` and `新增窗口`
    at the top of the thread-title switch menu.
- Root cause:
  - v422 put pane-count controls at board level. That made the controls global
    and floating over the reading surface instead of contextual to the pane the
    user is already managing through the title menu.
- Change:
  - `public/app.js` removes the board-level window control render path.
  - `renderThreadTileSwitchMenu()` now renders a compact action row above the
    thread list with `关闭窗口`, current count/capacity, and `新增窗口`.
  - `closeThreadTilePane()` closes the current pane by removing that thread id
    from the saved pane slot order, reducing visible pane count, selecting the
    next remaining pane, and restoring the shared Composer draft target.
  - `public/styles.css` removes the old absolute floating control styles and
    adds compact menu action styles.
  - PWA shell cache bumped to `codex-mobile-shell-v423`.
- Docs updated:
  - `README.md`
  - `docs/ARCHITECTURE.md`
  - `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`
- Validation:
  - `node --check public/app.js && node --check public/sw.js`
  - Focused suite:
    `node --test test/thread-tile-layout-ui.test.js test/thread-tile-layout.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
    (`35` tests passed)
  - `npm test` initially hit an unrelated temp-directory cleanup race in
    `test/protocol.test.js`; immediate rerun passed.
  - `npm test` (`748` tests passed on rerun)
  - `npm run check`
  - `npm run check:macos`
  - `git diff --check`
- Operational notes:
  - Production still has v422 until this change is committed and deployed.
  - Browser/PWA clients must load v423 shell to exercise the frontend changes.

# 2026-06-24 - Dynamic tile pane count v422 committed and deployed

- Scope:
  - Implemented, locally validated, committed, and deployed to Mac production.
  - Not pushed Public.
  - Commit:
    - `2231717 feat: 支持动态平铺窗口数`
- Trigger:
  - User clarified that tile mode should not automatically fill every available
    device column. A four-pane-capable tablet should show two wider panes when
    only two threads are currently useful, while still allowing the user to add
    or close panes directly on the current screen.
- Root cause:
  - v421 persisted tile mode and pane slot order, but it did not persist a
    separate desired pane count. The layout policy's device capacity was still
    serving double duty as the visible window count, so wide devices could make
    panes narrower than necessary.
- Change:
  - `server.js` extends `settings.json` `threadDisplay` with bounded
    `paneCount`; `0` means automatic current/running-thread-based sizing, and a
    positive integer is the user's manual visible pane count.
  - `public/app.js` now distinguishes device capacity from visible pane count.
    The tile candidate list uses `effectiveThreadTilePaneCount()`, while the
    rendered grid columns use the actual visible pane count so two panes occupy
    two wide columns even on four-pane-capable screens.
  - Tile mode adds a compact floating `- / +` control inside the tile board.
    `-` reduces the visible pane count without deleting saved pane slots; `+`
    expands the visible count and lets existing slot order/recent threads fill
    the new pane.
  - `public/styles.css` adds the small non-layout-taking tile window controls.
  - PWA shell cache bumped to `codex-mobile-shell-v422`.
- Docs updated:
  - `README.md`
  - `docs/ARCHITECTURE.md`
  - `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`
  - `docs/MODULES.md`
- Validation:
  - `node --check server.js && node --check public/app.js && node --check public/sw.js`
  - Focused suite:
    `node --test test/thread-visibility.test.js test/thread-tile-layout.test.js test/thread-tile-layout-ui.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
    (`78` tests passed)
  - `npm test` (`748` tests passed)
  - `npm run check`
  - `npm run check:macos`
  - `git diff --check`
- Operational notes:
  - Browser/PWA clients must load v422 shell to exercise the frontend controls.
  - Central Home AI deploy script used:
    `npm run --silent deploy:macos -- --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --restart-label com.hermesmobile.plugin.codex-mobile --health-url http://127.0.0.1:8787/api/public-config --reason dynamic-tile-pane-count-v422 --execute --json`
  - Source ref: `2231717811b7`.
  - Production target:
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup retained at:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260624T123122Z-plugin-codex-mobile-web-dynamic-tile-pane-count-v422`.
  - Deploy pruned previous v421 backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260624T120947Z-plugin-codex-mobile-web-thread-display-v421`.
  - Post-deploy health returned
    `clientBuildId=0.1.11|codex-mobile-shell-v422` and
    `shellCacheName=codex-mobile-shell-v422`.
  - Production target validation:
    `npm run check` and `npm run check:macos` both passed in
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Central deployment audit remained non-blocking:
    `auditOk=false`, `issueCount=11`, `blockingIssueCount=0`.

# 2026-06-24 - Thread-display persistence and tile stability v421 committed and deployed

- Scope:
  - Implemented, locally validated, committed, and deployed to Mac production.
  - Not pushed Public.
  - Commit:
    - `034ca97 fix: 持久化平铺状态并修正线程状态刷新`
- Trigger:
  - User reported that after PR #78 absorption, outer thread-list status could
    stay refreshing after a thread had ended.
  - User also reported tile-mode pane positions changing by themselves,
    tile-mode display choice being lost after Home AI/PWA refresh, wide Android
    tablet landscape only showing three panes, tile command durations being
    clipped, and Composer runtime controls overflowing when the app font size
    is large.
- Root cause:
  - Server-generated background `thread/status/changed` notifications derived
    from `turn/completed` did not carry a fresh completion event time, so the
    browser freshness guard could treat the terminal status as stale replay and
    keep the running hint.
  - Tile mode had `threadTilePinnedIds` only in browser runtime. The display
    mode was browser-local, and pane candidates could still be influenced by
    recent thread-list ordering.
  - Tablet landscape tile policy capped tablet columns at three even when
    available width could support four.
  - Tile operation bubble duration used an 8ch slot and runtime toolbar text
    did not sufficiently constrain child widths under large font settings.
- Change:
  - `server.js` now adds `eventAtMs` to `thread/status/changed` payloads
    derived from real turn start/completion timestamps; replayed completions do
    not invent a fresh timestamp.
  - Added authenticated `GET/POST /api/settings/thread-display` backed by
    runtime `settings.json` `threadDisplay`. It stores `displayMode`, ordered
    `paneThreadIds`, and `selectedThreadId` only.
  - `public/app.js` loads server thread-display settings before the initial
    thread list, migrates legacy local tile mode once, and persists pane slot
    order only after actual tile ids are chosen or the user manually switches a
    pane title menu. Thread-list recent sorting can fill empty pane slots but
    cannot reorder existing slots.
  - `public/thread-tile-layout.js` allows tablet landscape up to four columns
    when width permits.
  - `public/styles.css` widens tile operation duration to 9.5ch and clamps
    Composer runtime control fonts/children so large app font settings do not
    overflow the fixed toolbar cards.
  - PWA shell cache bumped to `codex-mobile-shell-v421`.
- Docs updated:
  - `README.md`
  - `docs/ARCHITECTURE.md`
  - `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`
  - `docs/MODULES.md`
  - `docs/TROUBLESHOOTING.md`
- Validation:
  - `node --check server.js && node --check public/app.js`
  - Focused suite:
    `node --test test/thread-visibility.test.js test/thread-status-hints.test.js test/thread-tile-layout.test.js test/thread-tile-layout-ui.test.js test/composer-quota.test.js test/collab-agent-render.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
    (`95` tests passed)
  - `npm test` (`747` tests passed)
  - `npm run check`
  - `npm run check:macos`
  - `git diff --check`
- Operational notes:
  - Browser/PWA clients must load v421 shell to exercise the frontend changes.
  - Central Home AI deploy script used:
    `npm run --silent deploy:macos -- --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --restart-label com.hermesmobile.plugin.codex-mobile --health-url http://127.0.0.1:8787/api/public-config --reason thread-display-v421 --execute --json`
  - Source ref: `034ca979a1c9`.
  - Production target:
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup retained at:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260624T120947Z-plugin-codex-mobile-web-thread-display-v421`.
  - Deploy pruned previous v420 backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260624T113808Z-plugin-codex-mobile-web-mobile-floating-controls-v420`.
  - Post-deploy health returned
    `clientBuildId=0.1.11|codex-mobile-shell-v421` and
    `shellCacheName=codex-mobile-shell-v421`.
  - Production target validation:
    `npm run check` and `npm run check:macos` both passed in
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Central deployment audit remained non-blocking:
    `auditOk=false`, `issueCount=11`, `blockingIssueCount=0`.

# 2026-06-24 - Mobile floating controls v420 committed and deployed

- Scope:
  - Implemented, validated, committed, and deployed to Mac production.
  - Not pushed Public.
  - Commit:
    - `6020a12 fix: stabilize mobile floating controls`
- Trigger:
  - User reported the right-bottom upward arrow still appearing in the wrong
    position after several fixes. The screenshot showed the `scrollToTurnReply`
    current-turn receipt jump button, not the operation recall dot.
- Root cause:
  - The scroll-down button and scroll-to-current-turn-receipt button were still
    separate floating controls. CSS gave `.scroll-turn-reply-button` its own
    right offset, and `updateScrollToBottomButton()` computed both visibility
    predicates independently, so the two controls could appear together.
  - The mobile operation dock remembered recent operation bubble/recall state
    by thread. Without an explicit live-turn boundary, stale command UI could
    survive turn completion or reappear on the next live turn in the same
    thread.
- Change:
  - `public/styles.css` now gives `scrollToTurnReply` the same right slot as
    `scrollToBottom`.
  - `public/app.js` makes `scrollToTurnReply` visible only when
    `scrollToBottom` is not visible; the downward jump wins when both
    predicates are true.
  - `public/live-operation-dock-state.js` requires live-turn state for compact
    bubble preservation, pinned sheet preservation, and recall visibility.
  - `public/app.js` clears global and tile operation runtime caches on
    `turn/started` and `turn/completed`, preventing old command recall from
    leaking into a completed or next turn.
  - PWA shell cache bumped to `codex-mobile-shell-v420`.
- Docs updated:
  - `README.md`
  - `docs/ARCHITECTURE.md`
  - `docs/MODULES.md`
- Validation:
  - `node --check public/app.js`
  - `node --check public/live-operation-dock-state.js`
  - `node --check public/sw.js`
  - `node --test test/turn-scroll-controls.test.js test/live-operation-dock-state.test.js test/collab-agent-render.test.js test/mobile-viewport.test.js`
  - `node --test test/thread-tile-layout-ui.test.js test/thread-tile-layout.test.js test/app-update.test.js test/thread-task-card-route.test.js test/thread-goal-service.test.js`
  - `git diff --check`
  - `npm run check`
  - `npm run check:macos`
  - `npm test --silent` (`742` tests passed)
- Production deploy:
  - Central Home AI deploy script used:
    `npm run --silent deploy:macos -- --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --restart-label com.hermesmobile.plugin.codex-mobile --health-url http://127.0.0.1:8787/api/public-config --reason mobile-floating-controls-v420 --execute --json`
  - Source ref: `6020a129af24`.
  - Production target:
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup retained at:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260624T113808Z-plugin-codex-mobile-web-mobile-floating-controls-v420`.
  - Post-deploy health returned
    `clientBuildId=0.1.11|codex-mobile-shell-v420` and
    `shellCacheName=codex-mobile-shell-v420`.
  - Production target validation:
    - `npm run check`
    - `npm run check:macos`
  - Deploy audit note:
    - Central profile audit reported non-blocking issues only
      (`blockingIssueCount=0`).
  - Quota note from deployment health:
    - Current primary 5-hour quota snapshot was not exhausted at deploy time
      (`usedPercent` about `3`, reset around `2026-06-25 00:31:32 CST`).
      Weekly/secondary snapshot was high (`usedPercent` about `89`).

# 2026-06-24 - Large-session dynamic projection and bounded-window cold path deployed

- Scope:
  - Implemented, locally validated, committed, and deployed to Mac production.
  - Not pushed Public.
  - Commits:
    - `6275dea fix: persist dynamic thread projections`
    - `661507a fix: bound large thread detail cold reads`
- Trigger:
  - User asked to continue the next optimization step and start solving large
    session load slowness.
- Production evidence gathered before code change:
  - Current production health is still
    `clientBuildId=0.1.11|codex-mobile-shell-v419` from the existing deployed
    build.
  - Active thread rollout sizes from `state_5.sqlite` metadata:
    - `019eee6c-a6f5-7b20-bfb4-f96ccb6431b3` Codex Mobile: about `84 MB`.
    - `019eed86-2002-7cc2-b0b7-937eb5355f36` Home AI: about `56 MB`.
    - `019ec3c0-86d2-7852-a9ea-e4c703262cdc` older Moira: about `209 MB`,
      but hidden by current visibility rules.
  - Direct `/api/threads/:id` timing samples showed the current process is fast
    while dynamic projection is in memory:
    - Codex Mobile full/recent reads used `projection-v4-dynamic`,
      `threadReadMs=0`, total about `177-233 ms`.
    - Home AI full/recent reads used `projection-v4-dynamic`,
      `threadReadMs=0`, total about `127-146 ms`.
    - Music first read used cold `thread-read` about `172 ms`, then disk
      `projection-v4-cache` about `38-39 ms`.
  - Runtime projection cache files for Codex Mobile/Home AI existed but carried
    old rollout size/mtime signatures. The live process had newer in-memory
    dynamic projections, but those dynamic updates were not persisted. After a
    listener restart, those large threads could miss disk cache and fall back to
    full `thread/read`.
- Change:
  - Updated `adapters/thread-detail-projection-service.js` so full, non-partial
    dynamic projections are persisted with throttling after notification
    updates.
  - Before dynamic persistence, the service refreshes the projection signature
    from the actual rollout file size/mtime, so restart-time disk cache can
    match the current backing rollout.
  - Partial notification-only projection shells remain invalid as durable detail
    cache and are not persisted as valid warm cache.
  - Added a large-rollout bounded first-read path in
    `adapters/thread-detail-read-orchestration-service.js`: when projection
    misses and the rollout size is over
    `CODEX_MOBILE_THREAD_DETAIL_TURNS_LIST_FIRST_BYTES` (default `8 MB`), the
    server reads the current retained window through `thread/turns/list`, seeds
    projection from that result, and only falls back to full `thread/read` if the
    bounded read fails.
  - Added `turns-list-large` / `bounded-large-thread-window` diagnostics with
    `turnsListBeforeFullMs`.
  - Added focused test coverage in `test/thread-detail-projection-service.test.js`
    for restart-style restoration from a persisted completed dynamic projection
    after rollout size/mtime changes.
  - Added focused orchestration/performance tests for the large-rollout bounded
    read path.
- Docs updated:
  - `README.md`
  - `docs/MODULES.md`
  - `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`
  - `docs/THREAD_DETAIL_PROJECTION_V4_DESIGN.md`
- Validation:
  - `node --check adapters/thread-detail-projection-service.js`
  - `node --test test/thread-detail-projection-service.test.js test/thread-detail-projection-v4-service.test.js test/thread-detail-projection-input-service.test.js test/thread-detail-projection-result-service.test.js`
  - `node --test test/thread-detail-projection-service.test.js test/thread-detail-projection-v4-service.test.js test/thread-detail-read-orchestration-service.test.js test/thread-detail-performance-service.test.js test/thread-detail-projection-input-service.test.js test/thread-detail-projection-result-service.test.js test/thread-visibility.test.js`
  - `git diff --check`
  - `npm test --silent` (`742` tests passed after the bounded-window follow-up)
  - `npm run check --silent`
  - `npm run check:macos --silent`
- Production:
  - Central deploy script used:
    `npm run --silent deploy:macos -- --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --restart-label com.hermesmobile.plugin.codex-mobile --health-url http://127.0.0.1:8787/api/public-config --execute --json`
  - First deploy used source ref `6275deae3fca`, backup
    `/Users/hermes-host/HermesMobile/backups/deploy/20260624T104829Z-plugin-codex-mobile-web-manual`.
  - A second controlled central deploy/restart for verification used the same
    source ref and backup
    `/Users/hermes-host/HermesMobile/backups/deploy/20260624T105015Z-plugin-codex-mobile-web-manual`.
  - Final deploy used source ref `661507a78107`, backup
    `/Users/hermes-host/HermesMobile/backups/deploy/20260624T105745Z-plugin-codex-mobile-web-manual`.
  - Direct `launchctl kickstart -k system/com.hermesmobile.plugin.codex-mobile`
    as the current user failed with `Operation not permitted`; use the central
    deploy script or an approved launchd helper for system-daemon restarts.
  - Production health after restart:
    `clientBuildId=0.1.11|codex-mobile-shell-v419`,
    `shellCacheName=codex-mobile-shell-v419`,
    `workspacePath=/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`,
    `activeProfileId=default`.
  - Verification before the bounded-window follow-up showed static Music
    cold-open hit `projection-v4-cache` with `threadReadMs=0`, but actively
    advancing Home AI could still cold-read after rollout growth.
  - Verification after final deploy:
    - Home AI first open after deploy used `turns-list-large`,
      `phase=bounded-large-thread-window`, `threadReadMs=0`,
      `turnsListBeforeFullMs=539`, total about `628 ms`, body about `211 KB`.
    - Home AI second open used `projection-v4-dynamic`, `threadReadMs=0`, total
      about `204 ms`.
    - Codex Mobile used `projection-v4-dynamic`, `threadReadMs=0`, total about
      `150-151 ms`.
    - Music used `projection-v4-cache`, `threadReadMs=0`, total about `87 ms`.
- Next:
  - If the user still sees slow first detail on active large threads, the next
    measured bottleneck is the app-server `thread/turns/list` / summary path
    rather than full rollout `thread/read`.
  - Public sync remains blocked until production/user validation.

# 2026-06-24 - Thread detail orchestration deployed, Public synced, PR #78 closed

- User request:
  - Push/deploy the Phase 3 thread-detail orchestration work.
  - Handle public PR #78 so its useful content is absorbed and it no longer
    keeps prompting on login.
- Local/private commits:
  - `230f277 refactor: extract thread detail read orchestration`
  - `350a6f5 docs: update public notes for detail orchestration`
  - `e98fe98 Merge remote-tracking branch 'public/main'`
- Production deploy:
  - Used Home AI central deploy script from `/Users/hermes-dev/HermesMobileDev/app`:
    `npm run --silent deploy:macos -- --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --restart-label com.hermesmobile.plugin.codex-mobile --health-url http://127.0.0.1:8787/api/public-config --execute --json`
  - Deployed source ref `230f277a775e` to
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup path:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260624T102917Z-plugin-codex-mobile-web-manual`.
  - Deploy returned `ok: true`; LaunchDaemon
    `system/com.hermesmobile.plugin.codex-mobile` was running.
  - Production health returned
    `clientBuildId=0.1.11|codex-mobile-shell-v419`,
    `shellCacheName=codex-mobile-shell-v419`,
    `workspacePath=/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`,
    `activeProfileId=default`, and server `buildId=83af848305f59e19`.
  - No frontend shell bump was needed because the deployed code change is
    server-side orchestration plus tests/docs.
- Public sync:
  - Created filtered public worktree from `public/main`, applied
    `git diff --binary public/main..main -- ':!.agent-context'`, and scanned
    the public path list for `.agent-context`, env/key/token/auth/cookie,
    upload/log/runtime/data, and private key patterns.
  - Public validation:
    - `git diff --check`
    - `npm run check --silent`
    - `npm run check:macos --silent`
    - `NODE_PATH=/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web/node_modules npm test --silent`
      (`740` tests passed)
  - Content scan only matched fixed dummy strings inside tests; no raw secrets
    or runtime paths were published.
  - Public commit:
    `2f07f09 release: publish v419 detail orchestration`.
  - Public pushed to `pentiumxp/codex-mobile-web-public:main`.
  - After merging Public back into private `main`, verified
    `git merge-base --is-ancestor public/main main` returned `0` and
    `git diff --stat public/main..main -- ':!.agent-context'` was empty.
- PR #78:
  - Current PR state before handling: `OPEN`, `mergeable=CONFLICTING`, branch
    `franksong2702/fix-unread-dot-state`.
  - Confirmed existing v401/v402 work had already absorbed the status
    freshness / unread-running / mux replay / submitted echo concepts.
  - Confirmed deferred large-session enrichment was intentionally not merged
    because it returns incomplete first detail and risks two-stage replacement
    jitter.
  - Closed PR #78 with a comment pointing to the absorbed mainline work and the
    new server-side read orchestration.
  - `gh pr list --repo pentiumxp/codex-mobile-web-public --state open` returned
    an empty list after closure.
- Next:
  - If large-session performance remains slow, gather production
    `thread.mobileDiagnostics.threadDetailTimings` for one cold and one warm
    open, then optimize the measured slowest phase.

# 2026-06-24 - Thread detail read orchestration service extracted locally

- Scope:
  - Implemented and locally validated.
  - Not committed, not deployed, not pushed Public.
- Trigger:
  - User paused UI/tile work and asked to do the fourth optimization point:
    large-session first-paint / thread-detail read orchestration.
- Change:
  - Added `adapters/thread-detail-read-orchestration-service.js`.
  - `/api/threads/:id` now delegates detail read branch ordering to the service
    and only parses the route, tracks lifecycle count, creates bounded logs,
    sends JSON, and records completion.
  - The coordinator preserves the existing large-session first-paint contract:
    summary resolution, hidden-thread rejection, projection hit, `mode=recent`
    initial turns-list, full `thread/read`, turns-list fallback, and summary
    fallback. It does not add a client-side second-refresh workaround and does
    not skip full `thread/read` because of rollout size.
  - Server-specific app-server reads, compaction, title hydration, runtime
    settings, projection seeding, task-card enrichment, and fallback shaping
    remain injected from `server.js`.
  - Added focused executable coverage for warm projection, full `thread/read`
    before bounded turns-list fallback, recent initial turns-list, read timeout
    fallback, and hidden-thread rejection.
- Docs updated:
  - `docs/MODULES.md`
  - `docs/ARCHITECTURE.md`
  - `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`
- Validation:
  - `node --check adapters/thread-detail-read-orchestration-service.js && node --check server.js`
  - `npm run check --silent`
  - `node --test test/thread-detail-read-orchestration-service.test.js test/thread-detail-performance-service.test.js test/thread-detail-projection-input-service.test.js test/thread-detail-projection-result-service.test.js`
  - `node --test test/thread-visibility.test.js test/thread-task-card-route.test.js`
  - `npm test --silent` (`740` tests passed)
  - `npm run check:macos --silent`
  - `git diff --check`
- Next:
  - If user wants to continue this performance track, gather production
    cold/warm `thread.mobileDiagnostics.threadDetailTimings` on one large
    session after deployment, then optimize the measured slowest phase.
  - Deployment and Public push remain blocked until explicitly requested.

# 2026-06-24 - v419 tile Composer keyboard-focus jitter fix deployed

- Scope:
  - Implemented, locally validated, committed, and deployed to Mac production.
  - Not pushed to Public.
  - Commit: this local commit (`fix: stabilize tiled composer focus`).
- Trigger:
  - After v418 deployment, user reported that in tile mode tapping Composer
    made the whole interface drop briefly and then repaint.
- Root cause:
  - Tile layout decisions still used live `visualViewport.height` and live
    Composer height. iPad/WebView keyboard focus changes those values during
    keyboard animation, so the tile board was treated as a layout change.
  - The Home AI embedded shell also translated the entire `.app` by `--app-top`
    while the keyboard was open, which is correct for some single-window mobile
    keyboard recovery paths but visually moves the whole tile grid.
  - `window.resize` and `visualViewport.resize` called
    `scheduleRenderCurrentThread()` whenever tile mode was on, including during
    keyboard focus.
- Change:
  - PWA shell bumped to `codex-mobile-shell-v419`.
  - Added tile viewport and Composer-height baselines. While a
    keyboard-editable input is focused in tile mode, `threadTileLayout()` uses
    the pre-keyboard baseline instead of keyboard-shrunk visual viewport values.
  - Added `thread-tile-open` root class. In Home AI embedded tile mode with the
    keyboard open, `.app` no longer follows `--app-top`, so the tile grid does
    not drop as a unit.
  - Gated window/visualViewport resize so tile mode does not schedule a full
    `renderCurrentThread()` during Composer keyboard focus. The resize handlers
    still update viewport CSS variables, Composer height, and intent-menu
    position.
- Docs updated:
  - `README.md`
  - `docs/ARCHITECTURE.md`
  - `docs/COMPLEX_FEATURE_PATHS.md`
- Validation:
  - `node --check public/app.js && node --check public/sw.js`
  - `node --test test/thread-tile-layout-ui.test.js test/thread-tile-layout.test.js test/mobile-viewport.test.js test/thread-task-card-route.test.js test/thread-goal-service.test.js`
    (`34` tests passed)
  - `node --test test/composer-draft.test.js test/composer-quota.test.js test/collab-agent-render.test.js test/live-operation-dock-state.test.js test/turn-scroll-controls.test.js`
    (`25` tests passed)
  - `npm test` (`734` tests passed)
  - `npm run check`
  - `npm run check:macos`
  - `git diff --check`
  - Central deploy script:
    `npm run --silent deploy:macos -- --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --restart-label com.hermesmobile.plugin.codex-mobile --health-url http://127.0.0.1:8787/api/public-config --execute --json`
    returned `ok: true` from a clean source tree and `blockingIssueCount=0`
    for `codex_auth_*`.
  - Independent production health returned
    `clientBuildId=0.1.11|codex-mobile-shell-v419`,
    `shellCacheName=codex-mobile-shell-v419`,
    `workspacePath=/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`,
    and `activeProfileId=default`.
- Next:
  - Wait for iPad/Home AI production verification.
  - Public push remains blocked until explicitly requested.

# 2026-06-24 - v418 tile pane menu, active runtime toolbar, and pane-local refresh deployed

- Scope:
  - Implemented, locally validated, committed, and deployed to Mac production.
  - Not pushed to Public.
  - Commit: this local commit (`fix: stabilize tiled pane controls`).
- Trigger:
  - User reported pane title still did not open the thread list in tile mode.
  - User requested tile refresh to be pane-local/incremental where possible to
    reduce whole-screen jitter.
  - User clarified the existing Composer runtime toolbar should be reused for
    Fast/model/reasoning/permission/quota, with the toolbar bound to the active
    pane like the shared Composer. Quota remains global display.
  - User reported tile panes with new content should sink to bottom like
    single-window mobile mode unless the user has scrolled away in that pane.
  - User reported long operation summaries clipped the elapsed seconds.
- Change:
  - PWA shell bumped to `codex-mobile-shell-v418`.
  - Tile render signature now includes the open switch-menu pane id, and title
    pointer handling toggles the pane switch menu through delegated handlers and
    pane-local patching.
  - Tile detail refresh, selected-pane changes, switch menu updates, and
    operation minimum-dwell refreshes now prefer pane-local DOM replacement
    instead of re-rendering the whole tile board.
  - Added per-pane scroll-hold state: panes follow new content to bottom unless
    the user explicitly scrolled away in that pane.
  - Existing Composer runtime controls follow the active pane. Switching panes
    saves the previous pane runtime draft, restores the active pane draft, and
    clears stale runtime overrides when the new pane has no draft.
  - Operation bubble duration reserves `8ch` so `HH:MM:SS` seconds stay visible
    when command summaries are long.
- Docs updated:
  - `README.md`
  - `docs/ARCHITECTURE.md`
  - `docs/COMPLEX_FEATURE_PATHS.md`
- Validation:
  - `node --test test/thread-tile-layout-ui.test.js test/thread-tile-layout.test.js test/composer-draft.test.js test/composer-quota.test.js test/collab-agent-render.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
    (`50` tests passed)
  - `node --check public/app.js && node --check public/sw.js`
  - `npm test` (`734` tests passed)
  - `npm run check`
  - `npm run check:macos`
  - `git diff --check`
  - Visual note: Chrome headless, Computer Use Chrome capture, macOS
    screencapture, and Safari WebDriver were unavailable or blocked in this
    session. A temporary QuickLook preview confirmed the menu and full elapsed
    seconds visually, but it is weak evidence rather than browser-level visual
    verification. User then explicitly requested direct deployment.
  - First central deployment attempt synced and restarted the service, then
    failed the post-deploy `codex-auth-profile-audit` because `lowgw1/lowgw2`
    shared-auth ACLs were stale. The deploy script's bounded shared-auth repair
    corrected the ACL state; a follow-up bounded audit showed
    `codex_auth_*` issue count `0`.
  - Second central deploy script run returned `ok: true`; post-deploy health
    returned `clientBuildId=0.1.11|codex-mobile-shell-v418`,
    `shellCacheName=codex-mobile-shell-v418`, and
    `workspacePath=/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
- Next:
  - Wait for iPad/production user verification.
  - Public push remains blocked until explicitly requested.

# 2026-06-24 - v417 tile safe-area, timer reuse, and touch dock fix in progress

- Scope:
  - Implemented, validated, committed locally, and deployed to Mac production.
  - Not pushed to Public.
  - Commit: this local commit (`fix: align tiled pane chrome with mobile shell`).
- Trigger:
  - After v416 deployment, user reported tile content was too high and collided
    with the system notification/status area.
  - User also reported the command/status box still reserved a bottom row even
    after adopting mobile-style bubbles, causing wasted vertical space.
  - User clarified pane header run status should be the same as the
    single-thread `turnTimer`: `本轮`, elapsed time, and thinking/running/output
    detail, not a separate custom string.
  - User reported tapping a pane thread title did not open the thread switch
    list.
- Change:
  - PWA shell bumped to `codex-mobile-shell-v417`.
  - Extracted shared turn-timer state/render helpers so the single-thread
    header and tile pane header use the same elapsed-time/detail vocabulary.
  - Tile pane header now renders the timer through the same
    `turn-timer-time` / `turn-timer-detail` structure.
  - Pane title/menu pointer handling no longer lets pane `pointerdown`
    selection re-render before the title click opens the switch menu.
  - Tile mode top padding now includes the browser and Home AI host safe-area
    inset.
  - Tile mode removes the global live-operation dock from layout flow, and
    touch wide screens use fixed mobile operation bubble/sheet instead of a
    bottom layout row.
  - Tile pane body no longer reserves bottom padding for operation bubbles;
    bubbles and bottom arrows are overlays.
- Docs updated:
  - `README.md`
  - `docs/COMPLEX_FEATURE_PATHS.md`
  - `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`
- Validation:
  - `node --check public/app.js && node --check public/sw.js`
  - `node --test test/thread-tile-layout-ui.test.js test/mobile-viewport.test.js test/collab-agent-render.test.js`
  - `node --test test/conversation-render.test.js test/thread-tile-layout.test.js test/live-operation-dock-state.test.js test/turn-scroll-controls.test.js`
  - `node --test test/thread-tile-layout.test.js test/live-operation-dock-state.test.js test/turn-scroll-controls.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
  - `npm test` (`734` tests passed)
  - `npm run check`
  - `npm run check:macos`
  - `git diff --check`
  - Local temporary server smoke:
    `CODEX_MOBILE_PORT=8799 CODEX_MOBILE_HOST=127.0.0.1 node server.js`;
    `/api/public-config` returned
    `clientBuildId=0.1.11|codex-mobile-shell-v417` and
    `shellCacheName=codex-mobile-shell-v417`; fetched `app.js`/`styles.css`
    contained the v417 tile timer/menu/touch-dock selectors.
  - Central deploy script:
    `npm run --silent deploy:macos -- --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --restart-label com.hermesmobile.plugin.codex-mobile --health-url http://127.0.0.1:8787/api/public-config --execute --json`
  - Production health returned
    `clientBuildId=0.1.11|codex-mobile-shell-v417`,
    `shellCacheName=codex-mobile-shell-v417`,
    `workspacePath=/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`,
    and `activeProfileId=default`.
- Next:
  - Wait for production/user verification. Public push remains blocked until
    explicitly requested.

# 2026-06-24 - v416 tile pane compact header and slot-local thread switch completed locally

- Scope:
  - Implemented, validated, committed locally, and deployed to Mac production.
  - Not pushed to Public.
  - Commit: this local commit (`feat: compact thread tile panes`).
- Trigger:
  - User clarified that tile mode should preserve vertical space: no global
    `平铺视图` strip, no pane path/time/open button chrome, no per-turn
    Active/Completed footer rows, and no always-visible pane bottom arrow.
  - User also requested pane-local thread switching: click a pane title to open
    a thread list and replace only that pane's thread.
- Change:
  - PWA shell bumped to `codex-mobile-shell-v416`.
  - Tile mode adds `threadTilePinnedIds` and `threadTileSwitchMenuPaneId` so a
    pane can replace its thread slot without being overwritten by automatic
    candidate selection on the next render.
  - Tile global header now writes empty title/meta and `.main.thread-tile-main`
    collapses the topbar, leaving only compact top padding around the tile
    board.
  - Pane header now renders a clickable thread title and compact `本轮` status
    pill. The old path/time meta and `打开` button are removed.
  - Clicking the title opens a pane-local, opaque thread switch menu ordered by
    current pane, visible panes, running threads, then the ordinary visible
    thread list. Selecting an option replaces only that pane id.
  - Tile turn rendering no longer emits the bottom `turn-status` row, so
    Active/Completed labels no longer consume vertical space in panes.
  - Pane bottom arrow now starts hidden and appears only when that pane is
    scrollable and not near bottom.
  - `currentLiveOperationEntry(thread)` and tile live-turn checks now evaluate
    the passed thread's latest turn instead of relying on global
    `state.currentThread`, so non-current pane operation/status rendering is
    owned by the pane's thread.
- Docs updated:
  - `README.md`
  - `docs/COMPLEX_FEATURE_PATHS.md`
  - `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`
- Validation:
  - `node --check public/app.js`
  - `node --test test/thread-tile-layout-ui.test.js test/thread-tile-layout.test.js test/mobile-viewport.test.js test/live-operation-dock-state.test.js`
  - `node --test test/conversation-render.test.js test/thread-tile-layout-ui.test.js test/mobile-viewport.test.js`
  - `node --test test/thread-goal-service.test.js test/thread-task-card-route.test.js test/new-thread-route.test.js test/turn-scroll-controls.test.js test/chatgpt-pro-bridge-service.test.js test/composer-draft.test.js test/live-operation-dock-state.test.js test/thread-tile-layout.test.js`
  - `node --test test/collab-agent-render.test.js`
  - `npm test` (`734` tests passed)
  - `npm run check`
  - `npm run check:macos`
  - `git diff --check`
  - Local temporary server smoke:
    `CODEX_MOBILE_PORT=8799 CODEX_MOBILE_HOST=127.0.0.1 node server.js`;
    `/api/public-config` returned
    `clientBuildId=0.1.11|codex-mobile-shell-v416` and
    `shellCacheName=codex-mobile-shell-v416`; fetched `app.js`/`styles.css`
    contained the v416 tile switch/status selectors.
  - Central deploy script:
    `npm run --silent deploy:macos -- --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --restart-label com.hermesmobile.plugin.codex-mobile --health-url http://127.0.0.1:8787/api/public-config --execute --json`
  - Production health returned
    `clientBuildId=0.1.11|codex-mobile-shell-v416`,
    `shellCacheName=codex-mobile-shell-v416`,
    `workspacePath=/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`,
    and `activeProfileId=default`.
- Next:
  - Wait for production/user verification. Public push remains blocked until
    explicitly requested.

# 2026-06-24 - v415 tile active-pane composer and pane-local operation bubble completed locally

- Scope:
  - Committed locally and deployed to Mac production.
  - Not pushed to Public.
- Trigger:
  - User clarified that tile mode should treat every pane like a scaled phone
    single-thread window.
  - Exception: Composer chrome may remain shared at the bottom, but tapping a
    pane makes that pane the active Composer target.
  - In tile mode the iPad-wide global command box must not remain; operation
    status should appear inside each pane with the same mobile bubble/sheet
    vocabulary.
- Change:
  - Added `threadTileSelectedThreadId` as the active pane state. Pointer/focus
    on a pane selects it without reordering the tile board.
  - `currentDraftKey()`, Composer controls, normal send, task-card command
    source, ChatGPT Pro source, Stop/steer state, local optimistic user
    message, failed send receipt, and post-send refresh now target the active
    pane thread id in tile mode.
  - Local optimistic/failed messages for non-current panes mutate that pane's
    cached thread detail instead of writing to the first/current thread.
  - Tile mode hard-clears the global live operation dock, including compact,
    pinned, and recall state, so the iPad-wide command strip/bubble cannot
    remain in tile mode. Each pane renders its own
    `thread-tile-operation-dock` using the existing mobile operation
    bubble/sheet component, with pane-local expanded/compact mode and minimum
    bubble dwell.
  - Global tile header now shows `平铺视图`; each pane header shows title,
    path/time metadata, and `本轮` status. The global turn timer is hidden in
    tile mode, while pane status labels update on tick.
  - PWA shell bumped to `codex-mobile-shell-v415`.
- Docs updated:
  - `README.md`
  - `docs/COMPLEX_FEATURE_PATHS.md`
  - `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`
- Validation:
  - `node --check public/app.js && node --check public/sw.js`
  - `node --test test/thread-tile-layout-ui.test.js test/thread-tile-layout.test.js test/mobile-viewport.test.js test/live-operation-dock-state.test.js`
  - `node --test test/chatgpt-pro-bridge-service.test.js test/composer-draft.test.js test/conversation-render.test.js test/thread-status-hints.test.js test/turn-scroll-controls.test.js`
  - `node --test test/thread-goal-service.test.js test/new-thread-route.test.js test/thread-task-card-route.test.js`
  - `npm test` (`734` tests passed)
  - `npm run check`
  - `npm run check:macos`
  - `git diff --check`
  - Central deploy script:
    `npm run --silent deploy:macos -- --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --restart-label com.hermesmobile.plugin.codex-mobile --health-url http://127.0.0.1:8787/api/public-config --execute --json`
  - Production health returned `clientBuildId=0.1.11|codex-mobile-shell-v415`
    and `shellCacheName=codex-mobile-shell-v415`.
- Next:
  - Wait for production/user verification. Public push remains blocked until
    explicitly requested.

# 2026-06-24 - v414 tile pane bottom anchoring and live refresh deployed to Mac production

- Scope:
  - Committed locally and deployed to Mac production.
  - Not pushed to Public.
- Trigger:
  - User confirmed iPad tiling now appears, but tile pane content opens at the
    top, lacks a direct down arrow, and should feel like a shrunken normal
    thread page.
  - User also clarified that split panes should eventually allow independent
    input in each pane, and that every displayed pane should refresh like a
    normal thread.
- Change:
  - Tile panes now wrap visible content in `thread-tile-pane-content`; short
    content bottom-aligns inside the pane.
  - `renderThreadTileLayout()` captures pane scroll state before re-render and
    restores it after render. New panes or panes already near bottom land at
    the bottom; panes where the user has manually scrolled upward preserve
    their distance from bottom.
  - Each pane gets a compact `↓` button bound to that pane's body scroller.
  - Tile mode now records visible pane ids and schedules bounded recent-detail
    refreshes for non-current panes. Existing cached pane detail is updated in
    the background instead of stopping after the first load.
  - Relevant non-current thread notifications trigger a throttled tile detail
    refresh for the visible pane.
  - PWA shell bumped to `codex-mobile-shell-v414`.
- Architecture note:
  - Pane-local independent input is recorded as the next split-screen composer
    phase, not part of this read-only tile hotfix. It needs pane-level draft,
    active pane, send, approval, interrupt, and operation ownership before it
    can be implemented safely.
  - User further clarified that the command box / operation bubble must also
    be pane-local. Final split-screen behavior should treat every pane as an
    independent scaled mobile single-thread window with its own composer,
    draft, command/operation bubble, approvals, interrupt, scroll, active turn,
    and live refresh. Reusing the global composer or global command dock is not
    sufficient closure.
- Validation:
  - `node --check public/app.js && node --check public/sw.js && node --test test/thread-tile-layout-ui.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
  - `npm run check`
  - `git diff --check`
  - `npm test` passed (`733` tests).
  - `npm run check:macos`
- Production deploy:
  - Used the Home AI central deploy script directly:
    `npm run --silent deploy:macos -- --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --restart-label com.hermesmobile.plugin.codex-mobile --health-url http://127.0.0.1:8787/api/public-config --execute --json`.
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Health check returned HTTP `200` with
    `clientBuildId=0.1.11|codex-mobile-shell-v414`,
    `shellCacheName=codex-mobile-shell-v414`, and
    `workspacePath=/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - `launchctl print system/com.hermesmobile.plugin.codex-mobile` reported
    the service running.

# 2026-06-24 - v413 iPad embed tile sidebar-width fix deployed to Mac production

- Scope:
  - Committed locally and deployed to Mac production.
  - Not pushed to Public.
- Trigger:
  - After v412 deployment, user reported that iPad 11-inch still had no thread
    tiling at all.
- Root cause:
  - v412's pure `public/thread-tile-layout.js` policy can produce three panes
    for iPad Pro 11 landscape, but `public/app.js` passed the wrong
    `sidebarWidth` in Home AI embed thread-detail mode.
  - Home AI embed CSS keeps `.sidebar` as fixed/offscreen overlay. On iPad
    landscape, tablet split media can still make `isMenuOverlayMode()` return
    false, so v412 subtracted the offscreen `100vw` sidebar as though it were a
    real layout column.
  - The policy then saw available width close to 0 and returned
    `insufficient-width`, which made the UI stay single-thread.
- Change:
  - `threadTileLayout()` now computes `sidebarSplitVisible =
    splitPaneSidebarVisible()` and subtracts sidebar width only when that
    function proves the sidebar actually occupies layout space.
  - Fixed/offscreen sidebar overlays are passed as `menuOverlay=true` with
    `sidebarWidth=0`, even when tablet split media matches.
  - Updated focused UI wiring test to assert this caller boundary.
  - PWA shell bumped to `codex-mobile-shell-v413`.
- Validation:
  - `node --check public/thread-tile-layout.js && node --check public/app.js && node --check public/sw.js && node --test test/thread-tile-layout.test.js test/thread-tile-layout-ui.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
  - `npm run check`
  - `git diff --check`
  - `npm test` passed (`733` tests).
  - `npm run check:macos`
- Production deploy:
  - Used the Home AI central deploy script directly:
    `npm run --silent deploy:macos -- --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --restart-label com.hermesmobile.plugin.codex-mobile --health-url http://127.0.0.1:8787/api/public-config --execute --json`.
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Health check returned HTTP `200` with
    `clientBuildId=0.1.11|codex-mobile-shell-v413`,
    `shellCacheName=codex-mobile-shell-v413`, and
    `workspacePath=/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - `launchctl print system/com.hermesmobile.plugin.codex-mobile` reported
    the service running.

# 2026-06-24 - v412 iPad landscape tile density deployed to Mac production

- Scope:
  - Committed locally and deployed to Mac production.
  - Not pushed to Public.
- Trigger:
  - User selected `设置 -> 显示 -> 平铺` on iPad, but the thread detail still
    stayed single-thread.
  - User clarified that iPad Pro 11 landscape should have enough width for
    roughly three thread panes compared with a vertical iPhone width.
  - User also clarified the long-term product direction: this should evolve
    into a user-managed split-screen reader where panes can be added, closed,
    and resized by dragging, rather than only an automatic viewport heuristic.
- Root cause / boundary:
  - v411 made tile mode an explicit setting, but the render policy still
    required the v410 900px landscape threshold before it would render tiles.
  - In Home AI embedded iPad mode, the actual iframe CSS viewport can be
    narrower than the physical screen width after host chrome/sidebar layout,
    so the setting was persisted but the capability check still rejected tile.
- Change:
  - `public/thread-tile-layout.js` lowers tablet landscape entry width to
    760px and tablet pane minimum width to 260px.
  - Focused tests now cover 820px embedded iPad landscape and iPad Pro 11
    landscape with a 360px sidebar, both yielding three panes.
  - Settings status text reports `当前视口：平铺 N 栏`, width insufficiency,
    portrait single-thread, or normal single-thread so the user can distinguish
    a stored setting from an unavailable viewport.
  - PWA shell bumped to `codex-mobile-shell-v412`.
  - `README.md`, `docs/COMPLEX_FEATURE_PATHS.md`, and
    `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md` record that current automatic
    tile mode is an interim surface; the long-term direction is a
    user-managed draggable split reader with explicit pane identity, widths,
    order, active pane, and detail-read concurrency caps.
- Validation:
  - `node --check public/thread-tile-layout.js && node --check public/app.js && node --check public/sw.js && node --test test/thread-tile-layout.test.js test/thread-tile-layout-ui.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
  - `npm run check`
  - `git diff --check`
  - `npm test` passed (`733` tests).
  - `npm run check:macos`
- Production deploy:
  - Used the Home AI central deploy script directly:
    `npm run --silent deploy:macos -- --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --restart-label com.hermesmobile.plugin.codex-mobile --health-url http://127.0.0.1:8787/api/public-config --execute --json`.
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Health check returned HTTP `200` with
    `clientBuildId=0.1.11|codex-mobile-shell-v412`,
    `shellCacheName=codex-mobile-shell-v412`, and
    `workspacePath=/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - `launchctl print system/com.hermesmobile.plugin.codex-mobile` reported
    the service running.

# 2026-06-24 - v411 thread tile display setting deployed to Mac production

- Scope:
  - Committed locally and deployed to Mac production.
  - Not pushed to Public.
- Trigger:
  - User asked to move the thread tile feature into the settings menu as a
    visible display choice, with non-tiled single-thread mode as the default.
- Change:
  - Removed the topbar `threadTileToggle` / `▦` entry.
  - Added a settings-menu `显示` section with `单线程` and `平铺` choices.
  - Default mode is single-thread: the new persistent key is
    `codexMobileThreadDisplayMode=tile`; absence of that key means single.
  - `setThreadTileMode()` now clears the legacy `codexMobileThreadTileMode`
    key when writing the new setting, so v409 temporary toggle state does not
    force tile mode after v411.
  - The tile rendering policy remains unchanged from v410: tile mode only
    renders when the wide/iPad landscape capability check passes.
  - PWA shell bumped to `codex-mobile-shell-v411`.
- Validation:
  - `node --check public/thread-tile-layout.js && node --check public/app.js && node --check public/sw.js && node --test test/thread-tile-layout.test.js test/thread-tile-layout-ui.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
  - `npm run check`
  - `npm test` passed (`731` tests).
  - `npm run check:macos`
  - `git diff --check`
- Production deploy:
  - Used the Home AI central deploy script directly:
    `npm run --silent deploy:macos -- --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --restart-label com.hermesmobile.plugin.codex-mobile --health-url http://127.0.0.1:8787/api/public-config --execute --json`.
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Health check returned HTTP `200` with
    `clientBuildId=0.1.11|codex-mobile-shell-v411`,
    `shellCacheName=codex-mobile-shell-v411`, and
    `workspacePath=/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - `launchctl print system/com.hermesmobile.plugin.codex-mobile` reported
    the service running.

# 2026-06-24 - v410 iPad embedded tile toggle fix deployed to Mac production

- Scope:
  - Committed locally and deployed to Mac production.
  - Not pushed to Public.
- Trigger:
  - After v409 deployment, iPad did not show the thread tile toggle in the
    Home AI embedded surface.
- Root cause:
  - v409 tile availability was effectively tied to the tablet sidebar split
    shape: landscape + `pointer: coarse` + `min-height: 600px`.
  - In Home AI embedded iPad views, the iframe visual height can be below 600px
    because of host chrome, and iPadOS can report a non-coarse pointer in some
    modes. That hid the tile toggle even when horizontal reading width was
    enough for two or three panes.
- Change:
  - Updated `public/thread-tile-layout.js` so tile availability is independent
    of the sidebar split media query.
  - Tile mode now accepts landscape viewports with width >= 900px and height >=
    480px, including overlay-sidebar embedded mode and non-coarse iPad pointer
    reporting.
  - Phone/iPad portrait still stay single-thread.
  - iPad/wide command dock behavior is unchanged: the full-width command dock
    remains for iPad and desktop; the compact operation bubble remains
    phone-only.
  - PWA shell bumped to `codex-mobile-shell-v410`.
- Validation:
  - `node --check public/thread-tile-layout.js && node --check public/app.js && node --check public/sw.js && node --test test/thread-tile-layout.test.js test/thread-tile-layout-ui.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`

# 2026-06-24 - v409 wide thread tile reading mode deployed to Mac production

- Scope:
  - Committed locally and deployed to Mac production.
  - Not pushed to Public.
  - Previous v408 extraction was committed separately as
    `ea3387a refactor: extract visible text render identity policy`.
- Change:
  - Added `public/thread-tile-layout.js` as a pure browser policy for
    viewport/sidebar/orientation to thread-tile columns/rows/maxPanes.
  - The first version is a read-only multi-thread reading workspace, not
    simultaneous multi-thread editing:
    - phones and iPad portrait stay single-thread;
    - iPad landscape supports at least two panes, and 1366px-class landscape
      can use three panes;
    - desktop wide screens can use up to four columns and two rows, capped by
      `DEFAULT_MAX_PANES`;
    - composer, interrupt controls, approvals, and operation dock/bubble remain
      bound to the current active thread.
  - Added a topbar `threadTileToggle`; the mode is persisted in
    `localStorage` and recalculated on `resize` / `visualViewport.resize`.
  - `public/app.js` now fetches recent detail for tile panes through
    `mode=recent`, renders panes as read-only detail windows, and only switches
    current thread when the pane `打开` button is clicked.
  - Added tile layout CSS and PWA shell asset wiring; shell bumped to
    `codex-mobile-shell-v409`.
  - Updated `README.md`, `docs/MODULES.md`, and
    `docs/COMPLEX_FEATURE_PATHS.md` with the ownership and release boundary.
- Validation:
  - `node --check public/thread-tile-layout.js && node --check public/app.js && node --check public/sw.js && node --test test/thread-tile-layout.test.js test/thread-tile-layout-ui.test.js test/app-update.test.js test/mobile-viewport.test.js test/plugin-voice-input.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
  - `npm run check`
  - `npm test` passed (`730` tests).
  - `npm run check:macos`
  - `git diff --check`
- Production deploy:
  - Used the Home AI central deploy script directly:
    `npm run --silent deploy:macos -- --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --restart-label com.hermesmobile.plugin.codex-mobile --health-url http://127.0.0.1:8787/api/public-config --execute --json`.
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Health check returned HTTP `200` with
    `clientBuildId=0.1.11|codex-mobile-shell-v409`,
    `shellCacheName=codex-mobile-shell-v409`, and
    `workspacePath=/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - `launchctl print system/com.hermesmobile.plugin.codex-mobile` reported
    the service running.

# 2026-06-24 - v408 visible text render identity policy ready locally

- Scope:
  - Local source workspace only.
  - Not deployed to production and not pushed to Public per current release
    order.
- Change:
  - Continued Phase 2 frontend state ownership extraction in
    `public/thread-detail-state.js`.
  - Moved visible-text render identity and completed-receipt text retention
    policy behind `threadDetailStatePolicy`:
    `visibleTextItemsCanShareRenderIdentity` and
    `mergeVisibleTextItemPreservingRenderIdentity`.
  - `public/app.js` now creates the policy with local
    `comparableVisibleText`, `visibleTextItemsLikelySame`, and
    `completedReceiptItemsLikelySame` dependencies, then delegates those two
    decisions. Incoming-order array merge orchestration and DOM patching remain
    in `public/app.js`.
  - Expanded `test/thread-detail-state.test.js` to cover reusable render
    identity, completed-receipt longer text retention, existing id/start time
    retention, and the non-identity fallback to ordinary visible-field merge.
  - Updated source-evaluated conversation-render harnesses so their
    `createThreadDetailStatePolicy` calls use the same visible-text
    dependencies as the browser app.
  - PWA shell bumped locally to `codex-mobile-shell-v408`.
  - Updated `README.md`, `docs/MODULES.md`,
    `docs/COMPLEX_FEATURE_PATHS.md`, and
    `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`.
- Validation:
  - `node --check public/thread-detail-state.js`
  - `node --check public/app.js`
  - `node --check public/sw.js`
  - `node --test test/thread-detail-state.test.js test/conversation-render.test.js test/app-update.test.js test/mobile-viewport.test.js test/plugin-voice-input.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
  - `npm run check`
  - `npm test` passed (`723` tests).
  - `npm run check:macos`
  - `git diff --check`
  - `codegraph status` was up to date; it warned the index was built by an
    earlier engine version.

# 2026-06-24 - v407 local-only item policy helper ready locally

- Scope:
  - Local source workspace plus Mac production deploy.
  - Not pushed to Public per current release order.
- Change:
  - Continued Phase 2 frontend state ownership extraction in
    `public/thread-detail-state.js`.
  - Moved authoritative completed-receipt detection and local-only item
    retention/drop decisions behind `threadDetailStatePolicy`:
    `completedIncomingTurnHasAuthoritativeReceipt`,
    `shouldDropLocalOnlyReceiptForIncomingTurn`, and
    `shouldPreserveLocalOnlyItem`.
  - `public/app.js` now delegates those decisions and keeps the higher-level
    incoming-order merge orchestration in place.
  - Expanded `test/thread-detail-state.test.js` to cover authoritative
    completed receipts, dropping local-only live receipts when the incoming
    completed turn has an authoritative receipt, mux user echo preservation,
    visual receipt suppression, reasoning-item rejection, and preserve flag
    behavior.
  - PWA shell bumped locally to `codex-mobile-shell-v407`.
  - Updated `README.md`, `docs/MODULES.md`,
    `docs/COMPLEX_FEATURE_PATHS.md`, and
    `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`.
- Validation:
  - `node --check public/thread-detail-state.js`
  - `node --check public/app.js`
  - `node --check public/sw.js`
  - `node --test test/thread-detail-state.test.js test/conversation-render.test.js test/app-update.test.js test/mobile-viewport.test.js test/plugin-voice-input.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
  - `npm run check`
  - `npm test` passed (`720` tests).
  - `npm run check:macos`
  - `git diff --check`
  - `codegraph status` was up to date; it warned the index was built by an
    earlier engine version.
- Production deploy:
  - Used the Home AI central deploy script directly, not a task card:
    `npm run --silent deploy:macos -- --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --restart-label com.hermesmobile.plugin.codex-mobile --health-url http://127.0.0.1:8787/api/public-config --execute --json`.
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Validation results included log-permission repair, shared-auth permission
    repair, production file hashes, `launchctl print`, health URL, and Codex
    auth profile audit.
  - `/api/public-config` returned HTTP `200` with
    `clientBuildId=0.1.11|codex-mobile-shell-v407`,
    `shellCacheName=codex-mobile-shell-v407`, and
    `workspacePath=/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.

# 2026-06-24 - v406 thread detail state helper ready locally

- Scope:
  - Local source workspace only.
  - Not deployed to production and not pushed to Public per current release
    order.
- Change:
  - Added `public/thread-detail-state.js` as the first Phase 2 frontend state
    ownership slice. It owns `mergeItemPreservingVisibleFields` policy for
    stronger visible-field preservation, context-compaction notice cleanup, and
    operation metadata retention.
  - `public/app.js` now creates `threadDetailStatePolicy` with local
    `itemVisibleWeight`, `isContextCompactionItem`, and `isOperationalItem`
    classifiers, and delegates item merge policy instead of keeping those rules
    inline.
  - Added the new static helper to `public/index.html`, `public/sw.js`,
    `server.js` app-shell build-id asset tracking, and `npm run check`.
  - PWA shell bumped locally to `codex-mobile-shell-v406`.
  - Updated `README.md`, `docs/MODULES.md`,
    `docs/COMPLEX_FEATURE_PATHS.md`, and
    `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`.
- Validation:
  - `node --check public/thread-detail-state.js`
  - `node --check public/app.js`
  - `node --check public/sw.js`
  - `node --test test/thread-detail-state.test.js test/conversation-render.test.js test/app-update.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
  - `npm run check`
  - `npm test` passed (`717` tests).
  - `npm run check:macos`
  - `git diff --check`
  - `codegraph status` was up to date; it warned the index was built by an
    earlier engine version.

# 2026-06-24 - Empty completed-turn diagnostic ready locally

- Scope:
  - Local source workspace only.
  - Not deployed to production and not pushed to Public.
- Trigger:
  - Home AI thread `019eed86-2002-7cc2-b0b7-937eb5355f36` accepted a short
    user message, showed the running timer, then the turn ended with no visible
    feedback.
- Evidence:
  - Production `/api/public-config` was still v404 when investigated, so local
    v405/v406 changes were not the cause.
  - The affected turn `019ef7a6-f274-73d0-aa3c-e6f232dfb036` was completed in
    current detail projection with `itemCount=0`.
  - The rollout contained `task_started` and `task_complete`, but no scoped
    user/agent item for that turn and an explicit empty final assistant
    message.
  - A later Home AI turn did produce visible items, but the first visible agent
    content arrived only after a long no-visible-output window. Treat active
    no-output latency as a separate diagnostic target from explicit empty
    completion.
- Change:
  - Added `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md` to record the current
    diagnosis, the Home AI-owned platform incident-intake boundary, and the
    staged Codex Mobile optimization path.
  - Added `adapters/thread-completion-diagnostic-service.js` so explicit empty
    completed-turn diagnostics are service-owned instead of implemented inline
    in `server.js`.
  - `server.js` now detects completed rollout entries whose final assistant
    payload is explicitly empty through that service and attaches a bounded
    `turnDiagnostic` item with code
    `runtime_completed_without_response`. It does not synthesize an
    `agentMessage` for this shape and does not treat it as a normal
    completed-reply notification case.
  - `adapters/thread-turn-compaction-policy-service.js` preserves diagnostic
    receipt items through receipt-only compaction.
  - `public/app.js` renders `turnDiagnostic` as a visible diagnostic card and
    includes it in visible-item signatures/progress checks.
  - `public/styles.css` adds the diagnostic card styling.
  - `README.md`, `docs/README.md`, `docs/ARCHITECTURE.md`, `docs/MODULES.md`,
    `docs/COMPLEX_FEATURE_PATHS.md`, and `docs/TROUBLESHOOTING.md` document the
    no-final-message invariant, the service boundary, and the future
    authenticated client-incident reporting direction.
- Validation:
  - `node --check server.js`
  - `node --check public/app.js`
  - `node --test test/thread-completion-diagnostic-service.test.js test/thread-turn-compaction-policy-service.test.js test/thread-item-timestamp-enrichment.test.js test/conversation-render.test.js`
  - `node --test test/mobile-viewport.test.js`
  - `npm run check`
  - `npm run check:macos`
  - `npm test` passed (`713` tests).
  - `git diff --check`
  - `codegraph status` was up to date; it warned the index was built by an
    earlier engine version.
  - Local proof against the real Home AI rollout: compacting the affected turn
    now yields one `turnDiagnostic` with
    `runtime_completed_without_response`, and does not synthesize an
    assistant reply.
- Follow-up:
  - Add a first-class authenticated client diagnostic endpoint and bounded
    diagnostic package store before enabling any automatic task-card closure.
  - The endpoint should capture build id, thread id, turn id, read mode,
    status, render/scroll state, event source, item counts, and timing buckets
    only. It must not include access keys, cookies, raw prompts, message
    bodies, image contents, full logs, or provider payloads.
  - Task-card closure from diagnostics must be deduplicated, rate-limited, and
    reference a diagnostic package id instead of embedding private evidence.

# 2026-06-24 - v405 local performance diagnostics and operation dock helper ready

- Scope:
  - Local source workspace only.
  - Not deployed to production and not pushed to Public per current task
    boundary.
- Change:
  - Added `adapters/thread-detail-performance-service.js` to attach bounded
    `mobileDiagnostics.threadDetailTimings` metadata to thread detail
    responses. The diagnostics classify warm client/current, warm projection
    cache, dynamic projection, cold thread reads, turns-list fallback, and
    summary fallback phases without including message bodies or private
    payloads.
  - Added `public/thread-performance-metrics.js` so client telemetry events
    (`thread_list_rendered`, `thread_detail_first_paint`,
    `thread_refresh_ms`, `thread_detail_full_ready`) can include
    `serverTimings` and `performancePhase`.
  - Added `public/live-operation-dock-state.js` and routed mobile operation
    bubble/dock state decisions through it. The 500ms minimum visible window,
    recall-dot visibility, pinned-sheet preservation, and compact-bubble
    preservation are now unit-testable outside `public/app.js`.
  - Confirmed the task-card store fail-closed behavior already exists:
    missing store is first-run empty; malformed JSON, wrong shape, and
    unreadable existing stores fail closed with bounded status instead of
    silently presenting an empty normal state.
  - PWA shell was bumped locally to `codex-mobile-shell-v405`.
  - Updated `README.md`, `docs/MODULES.md`, `docs/TROUBLESHOOTING.md`,
    `docs/ARCHITECTURE.md`, and `docs/COMPLEX_FEATURE_PATHS.md` to document
    the local v405 architecture boundary and next diagnostics path.
- Validation:
  - `node --test test/thread-detail-performance-service.test.js test/thread-performance-metrics.test.js test/live-operation-dock-state.test.js`
  - `node --test test/thread-task-card-service.test.js test/thread-detail-summary-service.test.js test/thread-detail-projection-input-service.test.js test/thread-detail-projection-result-service.test.js test/thread-list-fallback-cache-service.test.js`
  - `node --test test/collab-agent-render.test.js test/mobile-viewport.test.js test/app-update.test.js test/plugin-voice-input.test.js test/conversation-render.test.js test/thread-task-card-route.test.js test/thread-goal-service.test.js test/turn-scroll-controls.test.js`
  - `npm run check`
  - `npm run check:macos`
  - `npm test` passed (`705` tests).
  - `git diff --check`
  - `codegraph sync` reported already up to date.
- Current status:
  - Ready for local commit if desired.
  - Do not treat v405 as deployed or Public-published until the user
    explicitly requests that step.

# 2026-06-24 - v404 mobile floating control alignment ready

- Trigger:
  - User screenshot showed the lower-right scroll button and operation recall
    dot appearing together as two mismatched circles: one large, one small, and
    not visually aligned.
- Change:
  - `public/styles.css` now defines a phone-width floating-control rail:
    `--mobile-floating-control-size: 36px`,
    `--mobile-floating-control-right`, and
    `--mobile-floating-control-gap`.
  - The lower-right `scrollToBottom` / `scrollToTurnReply` buttons and the
    operation recall dot now share the same 36px size and right edge.
  - The operation recall dot remains below the scroll button with a fixed gap;
    the optional turn-reply button stays horizontally offset from the
    scroll-to-bottom button, so the controls do not overlap.
  - PWA shell bumped to `codex-mobile-shell-v404`.
  - `README.md`, `docs/TROUBLESHOOTING.md`, and focused tests were updated.
- Validation:
  - `node --check public/app.js`
  - `node --test test/collab-agent-render.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
  - `npm run check`
  - `npm run check:macos`
  - `npm test` passed (`696` tests).
  - `git diff --check`
- Local commit:
  - `49ff17e fix: align mobile floating controls`.
- Production deploy:
  - Used the Home AI center script:
    `node /Users/hermes-dev/HermesMobileDev/app/scripts/deploy-macos-production.js --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --reason codex-mobile-v404-floating-controls --execute --json`
  - Target:
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260624T023734Z-plugin-codex-mobile-web-codex-mobile-v404-floating-controls`.
  - Restarted `system/com.hermesmobile.plugin.codex-mobile`.
  - Deploy validations passed: production file hashes, launchd print,
    plugin manifest health URL, Codex auth profile audit, shared auth
    permissions repair, and Codex Mobile log permission repair.
  - `/api/public-config` now returns
    `clientBuildId=0.1.11|codex-mobile-shell-v404` and
    `shellCacheName=codex-mobile-shell-v404`.
  - Production CSS/JS contains `--mobile-floating-control-size: 36px`,
    `mobile-floating-control-right`, `data-recall-visible`, and
    `codex-mobile-shell-v404`.
- Release status:
  - Deployed to production for user testing.
  - Not pushed to Public.

# 2026-06-24 - v403 mobile operation recall dot ready

- Trigger:
  - User asked for a persistent small bubble/dot near the lower-right scroll
    controls after the transient operation bubble disappears.
  - The dot should reopen the recent operation detail, stay smaller than the
    temporary operation bubble, and avoid covering the existing up/down scroll
    buttons.
- Change:
  - `public/app.js` now preserves the last same-thread mobile operation dock
    HTML as recall state whenever a real command/file/tool/search bubble is
    rendered.
  - After the 500ms transient bubble window expires and no live operation is
    present, phone-width clients render a small same-thread recall dot instead
    of hiding the dock entirely.
  - The recall dot is restricted to `isMobileViewport()` so wide desktop/iPad
    clients do not regain a stale desktop command row.
  - Tapping the dot toggles the existing opaque operation detail sheet through
    the same `data-live-operation-dock-toggle` path; the dot itself keeps its
    compact shape when expanded/collapsed.
  - `public/styles.css` positions the recall-only dock slightly lower than the
    transient bubble and uses a 32px visual dot to avoid overlapping the
    42px scroll buttons.
  - PWA shell bumped to `codex-mobile-shell-v403`.
  - `README.md`, `docs/TROUBLESHOOTING.md`, and focused tests were updated.
- Validation:
  - `node --check public/app.js`
  - `node --test test/collab-agent-render.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
  - `npm run check`
  - `npm run check:macos`
  - `npm test` passed (`696` tests).
  - `git diff --check`
- Local commit:
  - `a9f1fdf fix: keep mobile operation recall dot`.
- Production deploy:
  - Used the Home AI center script:
    `node /Users/hermes-dev/HermesMobileDev/app/scripts/deploy-macos-production.js --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --reason codex-mobile-v403-operation-recall --execute --json`
  - Target:
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260624T022954Z-plugin-codex-mobile-web-codex-mobile-v403-operation-recall`.
  - Restarted `system/com.hermesmobile.plugin.codex-mobile`.
  - Deploy validations passed: production file hashes, launchd print,
    plugin manifest health URL, Codex auth profile audit, shared auth
    permissions repair, and Codex Mobile log permission repair.
  - `/api/public-config` now returns
    `clientBuildId=0.1.11|codex-mobile-shell-v403` and
    `shellCacheName=codex-mobile-shell-v403`.
  - `/api/v1/hermes/plugin/manifest` returned HTTP 200.
  - Production files contain `codex-mobile-shell-v403`,
    `mobile-operation-recall`, and `data-recall-visible`.
- Release status:
  - Deployed to production for user testing.
  - Not pushed to Public. Public still points at v402 commit `df6cada` until
    the user explicitly requests another public sync.

# 2026-06-24 - v402 public sync completed

- User request:
  - Commit the recent work and push Public.
  - Add a complete Chinese README explanation covering the recent changes,
    the absorptive PR #78 merge, why the large-session first-screen refresh
    approach was not merged, and the follow-up plan.
- Local/private commits:
  - `4f93576 fix: stabilize thread status and mobile operation dock`
    includes the recent implementation, tests, docs, and private handoff
    update.
  - `5893d0f Merge remote-tracking branch 'public/main'`
    merges the public release commit back into private `main`.
- Public release:
  - Public branch: `public/main`.
  - Public commit: `df6cada release: publish v402 stability refactor`.
  - Public sync was produced from
    `git diff --binary public/main..main -- ':!.agent-context'`, so
    `.agent-context` remained private.
  - Public staged scope covered source, public docs, browser assets, services,
    and tests only; no `.agent-context`, runtime state, uploads, logs, data,
    env, access-key, private-key, or secret paths were staged.
- README:
  - Added the Chinese overview sections at the top of `README.md`.
  - The README now describes the staged service-first refactor, the PR #78
    status-freshness absorption, recent user-visible fixes, and follow-up
    architecture plan.
  - It explicitly records that PR #78's deferred large-session first-screen
    detail was not merged because it returns incomplete first detail and risks
    two-phase UI jitter; the remaining large-session work should be solved in
    server projection/cache/cold-path design with measurements.
- Validation:
  - Private workspace before public sync:
    - `git diff --check`
    - `npm run check`
    - `npm run check:macos`
    - `npm test` passed (`696` tests).
  - Public worktree before push:
    - `git diff --check`
    - `npm run check`
    - Secret/path scan was clean for key, env, auth bearer, and runtime
      directory patterns.
    - First direct `npm test` in the temporary worktree failed because that
      worktree intentionally had no `node_modules` and could not resolve
      `web-push`.
    - Re-run with
      `NODE_PATH=/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web/node_modules npm test`
      passed (`696` tests).
- Post-publish closure still required:
  - Verify `public/main` is an ancestor of private `main`.
  - Verify `git diff --stat public/main..main -- ':!.agent-context'` is empty.

# 2026-06-24 - v402 mobile operation bubble dwell deployed

- Trigger:
  - User reported that the mobile command/status operation bubble still flashes
    and disappears instead of staying visible for the intended 500ms minimum.
  - User also reported occasional Composer and upper-screen flicker while
    typing.
- Root cause:
  - The v399 minimum-dwell implementation only preserved the bubble when the
    DOM already contained `.mobile-operation-bubble`.
  - Very short command/file/tool events can complete before the next stable DOM
    state, so a later refresh can clear the dock before the minimum-dwell guard
    has a DOM bubble to preserve.
  - The minimum-dwell expiry timer called full `renderCurrentThread()`, which
    can update header/conversation/scroll state and contribute to Composer-area
    jitter.
- Change:
  - `public/app.js` now stores the last same-thread mobile bubble HTML,
    thread id, and minimum visible-until timestamp in dock state.
  - If a short operation completes before 500ms, the dock reuses that saved
    same-thread bubble until the deadline rather than clearing immediately.
  - The expiry timer now runs a dock-only refresh through
    `renderLiveOperationDockOnly()` instead of full `renderCurrentThread()`.
  - PWA shell bumped to `codex-mobile-shell-v402`.
  - `README.md`, `docs/TROUBLESHOOTING.md`, `public/sw.js`, and focused tests
    were updated.
- Validation:
  - `node --test test/collab-agent-render.test.js test/mobile-viewport.test.js test/thread-task-card-route.test.js test/thread-goal-service.test.js`
  - `npm run check`
  - `npm run check:macos`
  - `git diff --check`
  - Production target `npm run check`
  - `codegraph sync && codegraph status` up to date with the existing
    earlier-engine warning.
- Deployment:
  - Used the Home AI center script:
    `node /Users/hermes-dev/HermesMobileDev/app/scripts/deploy-macos-production.js --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --reason codex-mobile-v402-bubble-dwell --allow-dirty --execute --json`
  - Target:
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260624T021115Z-plugin-codex-mobile-web-codex-mobile-v402-bubble-dwell`.
  - Restarted `system/com.hermesmobile.plugin.codex-mobile`.
  - Deploy validations passed: production file hashes, launchd print,
    plugin manifest health URL, Codex auth profile audit, and Codex Mobile log
    permission repair.
  - `/api/public-config` now returns
    `clientBuildId=0.1.11|codex-mobile-shell-v402` and
    `shellCacheName=codex-mobile-shell-v402`.
  - Authenticated `/api/status` returned HTTP 200 with `ready=true`.
- Operational notes:
  - This deploy included the prior v401 thread-status freshness changes plus
    the v402 bubble dwell fix from the private workspace.
  - No public sync, commit, or push was performed. Follow the release-order
    rule and wait for production/user validation before public publishing.

# 2026-06-24 - PR #78 status freshness logic absorbed into current architecture

- Trigger:
  - User asked to absorb the useful parts of public PR #78 without merging or
    copying it wholesale, and to follow the Home AI root-cause-first contract
    rather than adding fallback behavior.
- Scope:
  - Absorbed the thread status / unread / replay freshness concept only.
  - Did not absorb PR #78's large-session deferred enrichment approach because
    it intentionally returns an incomplete first detail and can reintroduce
    visible two-phase rendering jitter; large-session slowness remains owned by
    server projection/cache behavior, not by hiding it in the browser.
- Changes:
  - Added `public/thread-status-hints.js` as the pure browser status policy for
    running hints, viewed timestamps, submitted-processing hints, terminal
    event timestamps, and mux replay freshness.
  - `public/app.js` now records `codexMobileThreadViewedAtById`, keeps short
    submitted-processing state after sends, delegates running/unread decisions
    to the helper, and uses event timestamps for `thread/status/changed`,
    `turn/started`, and `turn/completed`.
  - `codex-app-server-mux.js` annotates replayed Mobile notifications with
    `mobileReplay`, `mobileReplayReceivedAtMs`, and `mobileReplaySeq`; desktop
    replay behavior is unchanged.
  - PWA shell bumped to `codex-mobile-shell-v401`; `public/index.html`,
    `public/sw.js`, `public/app.js`, `README.md`, docs, and tests were updated.
  - `package.json` syntax check now includes `public/thread-status-hints.js`.
- Validation:
  - Focused:
    - `node --test test/thread-status-hints.test.js test/protocol.test.js test/mobile-viewport.test.js test/conversation-render.test.js`
    - `node --test test/thread-list-fallback-cache-service.test.js test/thread-visibility.test.js`
    - `node --test test/plugin-voice-input.test.js`
  - Broad:
    - `npm run check`
    - `npm run check:macos`
    - `npm test` passed (`696` tests)
    - `git diff --check`
    - `codegraph sync && codegraph status` up to date with the existing earlier-engine warning.
- Operational notes:
  - This is implemented and validated in the private workspace only.
  - No production deploy, public sync, commit, or push was performed in this
    step. Follow the release-order rule before public publishing.

# 2026-06-24 - Service-first refactor deployed after dev and production smoke

- Trigger:
  - User asked whether Codex Mobile Web needed a system-level refactor after
    projection, in-memory cache, task-card routing, and runtime behavior had
    grown beyond the original architecture.
- Scope:
  - Backend/service-first refactor only. No PWA shell cache bump and no public
    sync/push in this step.
  - Followed the Home AI center deployment contract: local/private validation,
    then Mac production deploy through the center script, then production
    smoke. Public remains separate and requires explicit approval after
    production/user validation.
- Commits:
  - `22e7b8e refactor: extract task-card routing service`
  - `0549375 refactor: extract turn compaction policy`
  - `d345726 refactor: extract projection input service`
  - `ad16a1f refactor: extract projection result service`
  - `4acc038 refactor: extract thread list fallback cache`
  - `c6aef7f refactor: extract thread detail summary service`
  - `a7b474f docs: record refactor dev smoke`
- Changed services/files:
  - `adapters/thread-task-card-routing-service.js`
  - `adapters/thread-turn-compaction-policy-service.js`
  - `adapters/thread-detail-projection-input-service.js`
  - `adapters/thread-detail-projection-result-service.js`
  - `adapters/thread-list-fallback-cache-service.js`
  - `adapters/thread-detail-summary-service.js`
  - Focused service tests were added or updated for each extracted boundary.
- Validation before deploy:
  - After the final refactor phase:
    - focused service/test set passed (`162` tests);
    - `npm run check`;
    - `npm test` passed (`691` tests);
    - `npm run check:macos`;
    - `git diff --check`;
    - Home AI platform checker passed for `codex-mobile` with the existing
      `handoff_pointer_missing` warning only;
    - `codegraph sync && codegraph status` reported up to date with the
      existing earlier-engine warning.
  - Development server smoke on `127.0.0.1:18787` with isolated runtime:
    - `/api/public-config` HTTP 200,
      `clientBuildId=0.1.11|codex-mobile-shell-v400`;
    - `/api/status` HTTP 200, `ready=true`;
    - `/api/threads?limit=5&fallback=defer` returned 5 rows and deferred
      fallback;
    - first full thread list had `fallbackCacheHit=false`, `fallbackMs=1110`;
    - second full thread list had `fallbackCacheHit=true`, `fallbackMs=0`;
    - recent thread detail returned 10 turns;
    - first full thread detail used `thread-read` / projection `seeded`;
    - second full thread detail used `projection-v4-cache` / projection
      `cache`.
- Deployment:
  - Center script plan-only preflight passed:
    `npm run --silent deploy:macos -- --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --reason codex-mobile-service-refactor --json`.
  - Executed through the Home AI center script from
    `/Users/hermes-dev/HermesMobileDev/app`:
    `npm run --silent deploy:macos -- --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --reason codex-mobile-service-refactor --execute --json`.
  - Production source ref: `a7b474f5fb99`, dirty false.
  - Production target:
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Production backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260623T193234Z-plugin-codex-mobile-web-codex-mobile-service-refactor`.
  - Production owner restored to `xuxin:staff`.
  - Restarted only `com.hermesmobile.plugin.codex-mobile`.
  - Deploy validations passed:
    `codex-mobile-log-permissions`, `codex-shared-auth-permissions-repair`,
    `deploy-backup-retention-prune`, `production-file-hashes`,
    `launchd-print`, `health-url`, and `codex-auth-profile-audit` with zero
    blocking issues.
- Production smoke after deploy:
  - LaunchDaemon `system/com.hermesmobile.plugin.codex-mobile` is running.
  - `/api/public-config` returned HTTP 200,
    `clientBuildId=0.1.11|codex-mobile-shell-v400`,
    `shellCacheName=codex-mobile-shell-v400`, and `authRequired=true`.
  - Plugin manifest returned HTTP 200 with `id=codex-mobile`,
    `kind=embedded_app`, and `version=0.1.11`.
  - Authenticated `/api/threads?limit=5` returned 5 rows and hit fallback
    cache on both checks (`fallbackMs` 0 then 1).
  - Authenticated recent detail returned 10 turns.
  - Authenticated full detail first read used `thread-read` / projection
    `seeded`; second read used `projection-v4-cache` / projection `cache`.
- Operational notes:
  - No raw secrets, access keys, cookies, launch tokens, uploads, or long logs
    were recorded.
  - This has been deployed to Mac production but has not been pushed/synced to
    public.

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

## 2026-06-25T20:55:03Z - v479 keyed DOM patch ownership slice deployed

- Context:
  - This is Phase A of the frontend render/patch ownership optimization, after
    the user said the visible flashing issue was mostly handled and wanted the
    broader architecture optimization target to continue.
  - Scope was intentionally narrow: move keyed DOM reconciliation out of
    `public/app.js` and into a dedicated helper without changing the visible
    conversation rendering contract.
- Commit:
  - `51c0549 extract keyed DOM patch helper`
- Runtime/static version:
  - `CLIENT_BUILD_ID=0.1.11|codex-mobile-shell-v479`
  - `SHELL_CACHE_NAME=codex-mobile-shell-v479`
- Changed files:
  - `public/thread-detail-dom-patch.js`
  - `public/app.js`
  - `public/sw.js`
  - `test/thread-detail-dom-patch.test.js`
  - `test/collab-agent-render.test.js`
  - `test/mobile-viewport.test.js`
  - `test/thread-goal-service.test.js`
  - `test/thread-task-card-route.test.js`
  - `README.md`
  - `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`
  - `docs/MODULES.md`
- Architecture boundary:
  - `thread-detail-dom-patch.js` now owns render-key calculation, compatible
    node checks, attribute sync, keyed/unkeyed child patching, replacement, and
    bounded `patchHtml` results.
  - `public/app.js` keeps orchestration: render surface selection, hydration,
    scroll/perf handling, and fallback/error behavior.
  - This reduces future duplicate/missing-message and full-render flash risk by
    making the keyed child DOM reconciliation independently testable.
- Source validation:
  - Focused suite passed: `node --test test/thread-detail-dom-patch.test.js
    test/collab-agent-render.test.js test/conversation-render.test.js
    test/mobile-viewport.test.js test/app-update.test.js
    test/thread-goal-service.test.js test/thread-task-card-route.test.js`
    (`161` passed).
  - `npm test` passed (`872` passed).
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Production deploy:
  - Deployed through Home AI central deploy path with reason
    `codex-mobile-keyed-dom-patch-v479`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T205503Z-plugin-codex-mobile-web-codex-mobile-keyed-dom-patch-v479`
  - Production `/api/public-config` readback:
    `clientBuildId=0.1.11|codex-mobile-shell-v479`,
    `shellCacheName=codex-mobile-shell-v479`, `version=0.1.11`,
    `authRequired=true`.
  - Source/production SHA parity verified for the changed runtime, test, and
    docs files listed above.
  - Production focused suite passed with production dependencies (`161`
    passed).
- Browser/visual note:
  - Browser automation was not available in the current callable tool list, and
    this workspace did not have a local Playwright dependency to run a direct
    browser smoke. Evidence for this slice is therefore bounded source tests,
    production focused tests, HTTP public-config readback, and SHA parity.
- Release note:
  - Public was not pushed in this slice. Keep following the local commit +
    production deploy + validation before public push rule.

## 2026-06-26 - v478 operation card content plan and Home AI return-event verification

- Active optimization slice:
  - Commit `3d3e1e3` (`extract operation card content planning`) moved live
    operation card content planning from `public/app.js` into
    `public/live-operation-dock-state.js`.
  - The helper now owns item id/type/title/detail normalization, empty-detail
    state, status visibility, duration visibility/title text, and class token
    selection.
  - `public/app.js` still owns HTML escaping, final template strings, and real
    DOM patching. This intentionally keeps the slice small instead of rewriting
    the whole command card renderer.
  - Shell/cache bumped to `codex-mobile-shell-v478`.
- Home AI Autonomous Delivery Loop task-card check:
  - The return-card event path already exists in commit `64d3b30`
    (`wire return cards to Home AI delivery events`) and is documented in the
    cross-thread task-card docs.
  - Verified that terminal cards from `return_to_source`,
    `/reply returnToSource:true`, and autonomous auto-return use terminal
    metadata with `terminal:true`, `requiresReturn:false`, and
    `ackPolicy:"none"`.
  - Verified that terminal return-card observer events send bounded metadata
    only, and Home AI `404` for an unknown original task card is recorded as
    `unknown_task_card` without blocking normal return-card delivery.
- Validation:
  - Focused v478 tests passed: `node --test
    test/live-operation-dock-state.test.js test/collab-agent-render.test.js
    test/conversation-render.test.js test/mobile-viewport.test.js
    test/app-update.test.js test/thread-goal-service.test.js
    test/thread-task-card-route.test.js` (`140` passed).
  - Focused return-card event tests passed: `node --test
    test/home-ai-autonomous-delivery-return-service.test.js
    test/thread-task-card-service.test.js test/codex-mobile-mcp-server.test.js
    test/thread-task-card-route.test.js` (`47` passed).
  - Full source `npm test` passed (`867` passed).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Production deploy:
  - Deployed with Home AI central script:
    `deploy-macos-production.js --plugin codex-mobile --reason
    codex-mobile-operation-card-content-plan-v478 --execute --json`.
  - Source ref at deploy: `3d3e1e38c258`, dirty state `false`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T204227Z-plugin-codex-mobile-web-codex-mobile-operation-card-content-plan-v478`.
  - `/api/public-config` readback returned
    `clientBuildId=0.1.11|codex-mobile-shell-v478`,
    `shellCacheName=codex-mobile-shell-v478`, `version=0.1.11`,
    `authRequired=true`.
  - Source/production SHA-256 parity was confirmed for:
    `public/app.js`, `public/sw.js`,
    `public/live-operation-dock-state.js`,
    `adapters/home-ai-autonomous-delivery-return-service.js`,
    `adapters/thread-task-card-service.js`, return-card tests, `README.md`,
    and cross-thread task-card docs.
  - Production focused suite passed with production dependencies (`63` passed).
- Operational notes:
  - Runtime/static files are deployed to Mac production. Clients need to load
    the v478 shell/cache to pick up the operation-card extraction.
  - Public push has not been performed in this step.

## 2026-06-26 - v477 live text DOM patch ownership deployed

- Goal slice:
  - Continue Phase A frontend thread-detail render/patch ownership cleanup.
  - This is not a visual fallback and does not hide duplicate/missing
    projection problems. It moves one remaining live-text patch sequencing
    branch out of `public/app.js` into the existing DOM patch helper boundary.
- Symptom/risk:
  - Streaming `agentMessage` / `plan` text updates still had selector lookup,
    HTML-to-node creation, DOM patch callback sequencing, and scroll completion
    in one `public/app.js` function. That kept local patch, full render, and
    tile-pane patch responsibilities coupled in the largest frontend file.
- Owning layer / invariant:
  - Frontend thread detail DOM patch ownership.
  - `public/app.js` should decide tile/single-thread surface availability and
    inject side-effect callbacks. Reusable render-key lookup, HTML parse,
    patch sequencing, and bounded failure reasons should live in
    `public/thread-detail-dom-patch.js`.
- Change:
  - Added `applyLiveTextItemDomPatch` to
    `public/thread-detail-dom-patch.js`.
  - `patchLiveTextItemDom()` in `public/app.js` now delegates live text
    render-key lookup, HTML parsing, and patch callback sequencing to that
    helper while preserving the existing tile/single surface checks and
    `completeLocalConversationDomUpdate` scroll completion.
  - Bumped app shell from `codex-mobile-shell-v476` to
    `codex-mobile-shell-v477`.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
- Commit:
  - `b47d2a0` (`extract live text DOM patch policy`).
- Validation:
  - Focused source suite passed (`158` tests):
    `test/thread-detail-dom-patch.test.js`,
    `test/turn-scroll-controls.test.js`,
    `test/conversation-render.test.js`,
    `test/mobile-viewport.test.js`,
    `test/app-update.test.js`, `test/thread-goal-service.test.js`, and
    `test/thread-task-card-route.test.js`.
  - Source full `npm test` passed (`866` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
  - Production focused suite passed (`158` tests) with production
    dependencies.
  - Source/production hash parity matched for `public/app.js`,
    `public/sw.js`, `public/thread-detail-dom-patch.js`, focused tests, and
    docs.
- Production deploy:
  - Deployed through Home AI central macOS production script with reason
    `codex-mobile-live-text-dom-patch-v477`.
  - Source ref: `b47d2a0d036b`, dirty state: false.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T203403Z-plugin-codex-mobile-web-codex-mobile-live-text-dom-patch-v477`.
  - LaunchDaemon `system/com.hermesmobile.plugin.codex-mobile` restarted and
    manifest health check passed.
  - `/api/public-config` readback:
    `clientBuildId=0.1.11|codex-mobile-shell-v477`,
    `shellCacheName=codex-mobile-shell-v477`, `version=0.1.11`,
    `authRequired=true`.
- Browser/visual note:
  - Attempted in-app Browser background verification, but the current browser
    control runtime returned `sandboxCwd must be an absolute file URI` before a
    page could be opened. No browser-side state was mutated. Use a future
    Browser/tooling repair or Home AI central visual harness for video-level
    evidence.
- Next boundary:
  - Continue Phase A with command detail panel content HTML or remaining
    single-thread/tile pane DOM patch branches still coupled to `app.js`.
  - Phase B cold-path work should continue using
    `threadDetailTimings` / `threadListTimings` evidence before changing cache
    invalidation.
- Operational notes:
  - This has not been pushed to public. Follow the release-order rule: wait for
    production/user confirmation before any public sync/push.

## 2026-06-26 - Home AI Autonomous Delivery return-card events deployed

- Trigger:
  - Home AI task card `ttc_a8ab1599a96e2e92ed` requested Codex Mobile terminal
    return cards to update Home AI Autonomous Delivery Loop slices without
    manual case/slice lookup.
- Root cause / invariant:
  - Codex Mobile already created terminal return cards, but the Home AI
    delivery-loop state was not notified from the authoritative return-card
    creation path. Local target-thread final text is not a source-thread return
    card, and terminal return cards must remain terminal with no acknowledgement
    loop.
- Change:
  - Added `adapters/home-ai-autonomous-delivery-return-service.js` as a
    backend-only bounded event client for
    `/api/autonomous-delivery/return-card-events`.
  - `adapters/thread-task-card-service.js` now emits one observer event when a
    terminal `returnToSource` card closes an original non-terminal work card.
    Event metadata is bounded to original task-card id, return-card id, return
    status, title/summary, source/target thread ids, workflow id,
    `terminal:true`, and `ackPolicy:"none"`.
  - The observer is idempotent after a successful send. Home AI `404` for an
    unknown original task-card id records bounded `unknown_task_card` audit
    state and does not block return-card delivery.
  - `server.js` wires the observer through the existing trusted Home AI/Hermes
    backend web-key callback path. The event path does not create repair cards,
    does not request acknowledgement, and does not inject another task card.
  - MCP and script return status validation now include `rejected`, matching
    the Home AI return-card event contract.
- Commit:
  - `64d3b30` (`wire return cards to Home AI delivery events`).
- Validation:
  - Source focused task-card/protocol/render suite passed (`146` tests):
    `test/home-ai-autonomous-delivery-return-service.test.js`,
    `test/thread-task-card-service.test.js`,
    `test/thread-task-card-route.test.js`,
    `test/codex-mobile-mcp-server.test.js`, and
    `test/conversation-render.test.js`.
  - Source full `npm test` passed (`864` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
  - Production focused suite passed with production dependencies (`146` tests).
  - Source/production hash parity matched for the new adapter, task-card
    service, server wiring, return scripts, docs, package metadata, and focused
    tests.
- Production deploy:
  - Deployed through Home AI central macOS production script with reason
    `codex-mobile-home-ai-return-card-events`.
  - Source ref: `64d3b3074422`, dirty state: false.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T202524Z-plugin-codex-mobile-web-codex-mobile-home-ai-return-card-events`.
  - LaunchDaemon `system/com.hermesmobile.plugin.codex-mobile` restarted and
    manifest health check passed.
  - `/api/public-config` readback:
    `clientBuildId=0.1.11|codex-mobile-shell-v476`,
    `shellCacheName=codex-mobile-shell-v476`, `version=0.1.11`,
    `authRequired=true`.
- Privacy:
  - Event payload excludes raw task-card bodies, conversation text, prompts,
    completions, uploads, screenshots, provider payloads, cookies, launch
    tokens, access keys, database rows, and long logs.
- Operational notes:
  - Server-only change; no static shell/cache bump beyond the already deployed
    v476 shell.
  - The real return card for `ttc_a8ab1599a96e2e92ed` was created as
    `ttc_25262fb1d46a151f36` with `returnStatus=completed`. Its Home AI
    delivery-loop observer attempted the event and recorded bounded
    `unknown_task_card` / HTTP `404`, which matches the contract for an
    original task-card id that Home AI has not registered as an autonomous
    delivery slice. The terminal return itself was delivered normally.
  - Not pushed to public yet. Follow the release-order rule: wait for
    production/user confirmation before any public sync/push.

## 2026-06-26 - v459 thread tile state policy deployed

- Scope:
  - Continued the system-level architecture optimization plan with the first
    Phase C pane-state slice.
  - This is not the full split-screen rewrite. It moves deterministic
    thread-tile pane-state policy out of `public/app.js` while leaving DOM,
    render, network save, pane detail loading, and other side effects in app
    orchestration.
- Change:
  - Added `public/thread-tile-state.js` as a pure pane-state policy helper for:
    pane count normalization, pinned thread id normalization, selected-pane
    fallback, split-pair remove/prepend/normalization, display-settings
    payload/application, and active-id-to-pinned-slot sync.
  - `public/app.js` now delegates those rules through compatibility wrappers.
  - Added the helper to `public/index.html`, PWA shell assets, service worker
    cache, server app-shell asset identity, and `npm run check`.
  - Bumped `CLIENT_BUILD_ID` and service worker cache to
    `codex-mobile-shell-v459`.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md` to describe v459 as pane-state boundary extraction and
    record the remaining split-screen boundaries.
- Commit:
  - Runtime/docs commit: `b4286a3 refactor thread tile state policy`.
- Validation in source workspace:
  - Focused suite passed: `62` tests across
    `test/thread-tile-state.test.js`,
    `test/thread-tile-layout-ui.test.js`,
    `test/thread-tile-layout.test.js`,
    `test/mobile-viewport.test.js`, `test/app-update.test.js`,
    `test/plugin-voice-input.test.js`, `test/thread-task-card-route.test.js`,
    and `test/thread-goal-service.test.js`.
  - `npm test` passed: `842` tests.
  - `npm run check`
  - `npm run check:macos`
  - `git diff --check`
- Production deploy:
  - Deployed through Home AI central macOS production script.
  - Reason: `codex-mobile-thread-tile-state-v459`.
  - Source ref at deploy: `b4286a3c2657`, dirty `false`.
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T180249Z-plugin-codex-mobile-web-codex-mobile-thread-tile-state-v459`.
  - LaunchDaemon `system/com.hermesmobile.plugin.codex-mobile` reported
    running and manifest health check passed.
- Production readback:
  - `/api/public-config` returned
    `clientBuildId=0.1.11|codex-mobile-shell-v459` and
    `shellCacheName=codex-mobile-shell-v459`.
  - Source/prod SHA-256 parity matched for:
    `public/thread-tile-state.js`, `test/thread-tile-state.test.js`,
    `public/app.js`, `public/index.html`, `public/sw.js`, `server.js`,
    `package.json`, `README.md`,
    `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and `docs/MODULES.md`.
  - Production focused suite passed: same `62` tests listed above with
    production dependencies.
- Next architecture boundary:
  - Continue Phase C by extracting pane-local detail refresh ownership,
    pane-local operation/command bubble state, and active-pane execution
    side effects out of `public/app.js`.
  - Phase B large-session cold/warm path remains a separate target; do not
    conflate it with this pane-state slice.
- Public:
  - Not pushed to Public. Follow release-order rule: wait for production/user
    validation or explicit Public instruction before syncing/pushing.

## 2026-06-26 - v460 thread tile operation state policy deployed

- Scope:
  - Continued Phase C pane-state / split-screen architecture work.
  - This slice moves pane-local operation bubble state policy into
    `public/thread-tile-state.js`.
  - It does not change server projection, message merge, task-card behavior, or
    operation bubble visual design. No fallback or UI-only masking was added.
- Change:
  - Added pure thread-tile operation state helpers:
    `operationBubbleRecord`, `operationBubbleSnapshot`,
    `normalizeOperationMode`, `toggleOperationMode`, and
    `operationSignature`.
  - `public/app.js` now delegates tile pane operation-bubble dwell/expiry,
    compact/expanded toggle, and operation signature rules to
    `threadTileStatePolicy`; app code still owns Map mutation, timers, DOM
    patch, and pane rendering.
  - Bumped `CLIENT_BUILD_ID` and service worker cache to
    `codex-mobile-shell-v460`.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
- Commit:
  - Runtime/docs commit: `7fda7a8 refactor thread tile operation state`.
- Validation in source workspace:
  - Focused suite passed: `57` tests across
    `test/thread-tile-state.test.js`,
    `test/thread-tile-layout-ui.test.js`,
    `test/thread-tile-layout.test.js`, `test/mobile-viewport.test.js`,
    `test/thread-task-card-route.test.js`, `test/thread-goal-service.test.js`,
    `test/live-operation-dock-state.test.js`, and
    `test/collab-agent-render.test.js`.
  - `npm test` passed: `844` tests.
  - `npm run check`
  - `npm run check:macos`
  - `git diff --check`
- Production deploy:
  - Deployed through Home AI central macOS production script.
  - Reason: `codex-mobile-thread-tile-operation-state-v460`.
  - Source ref at deploy: `7fda7a8290a2`, dirty `false`.
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T180936Z-plugin-codex-mobile-web-codex-mobile-thread-tile-operation-state-v460`.
  - LaunchDaemon `system/com.hermesmobile.plugin.codex-mobile` reported
    running and manifest health check passed.
- Production readback:
  - `/api/public-config` returned
    `clientBuildId=0.1.11|codex-mobile-shell-v460` and
    `shellCacheName=codex-mobile-shell-v460`.
  - Source/prod SHA-256 parity matched for:
    `public/thread-tile-state.js`, `test/thread-tile-state.test.js`,
    `test/thread-tile-layout-ui.test.js`, `public/app.js`, `public/sw.js`,
    `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
  - Production focused suite passed: same `57` tests listed above with
    production dependencies.
- Next architecture boundary:
  - Continue Phase C by extracting pane-local detail refresh ownership and
    command detail panel state from `public/app.js`.
  - Phase B large-session cold/warm path remains separate.
- Public:
  - Not pushed to Public. Follow release-order rule: wait for production/user
    validation or explicit Public instruction before syncing/pushing.

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

## 2026-06-24 - Development runtime smoke after Phase 1-6 refactor commits

- Scope:
  - Runtime smoke for the local/private development workspace after these local
    commits:
    - `22e7b8e` task-card routing service;
    - `0549375` turn compaction policy service;
    - `d345726` projection input service;
    - `ad16a1f` projection result service;
    - `4acc038` thread-list fallback cache service;
    - `c6aef7f` thread-detail summary service.
  - This was development-environment validation only, not production deploy and
    not public sync.
- Development server:
  - Started from `/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web`
    on `127.0.0.1:18787`.
  - Used temporary runtime directory
    `/tmp/codex-mobile-web-dev-runtime-18787`.
  - Auth, update check, and public-PR check were disabled for the local smoke.
  - Service was stopped after validation; `18787` was no longer listening.
- Smoke evidence:
  - `GET /api/public-config` returned HTTP `200`,
    `clientBuildId=0.1.11|codex-mobile-shell-v400`, and
    `authRequired=false` for the dev smoke environment.
  - `GET /api/status` returned HTTP `200` and `ready=true`.
  - `GET /api/threads?limit=5&fallback=defer` returned HTTP `200`, 5 rows,
    `mobileDeferredFallback=true`, `fallbackDeferredReason=client`, and
    `fallbackMs=0`.
  - First full `GET /api/threads?limit=5` returned HTTP `200`, 5 rows,
    `fallbackCacheHit=false`, `fallbackMs=1110`,
    `fallbackStateDbMs=78`, `fallbackRolloutMs=955`, and
    `fallbackSessionIndexMs=1`.
  - Second full `GET /api/threads?limit=5` returned HTTP `200`, 5 rows,
    `fallbackCacheHit=true`, `fallbackMs=0`,
    `fallbackStateDbMs=0`, `fallbackRolloutMs=0`, and
    `fallbackSessionIndexMs=0`.
  - `GET /api/threads/<visible-thread>?mode=recent` returned HTTP `200`,
    `mobileReadMode=turns-list-initial`, and 10 turns.
  - First full `GET /api/threads/<visible-thread>` returned HTTP `200`,
    `mobileReadMode=thread-read`, 10 turns, `mobileOmittedTurnCount=54`,
    and `mobileProjection.source=seeded`.
  - Second full `GET /api/threads/<visible-thread>` returned HTTP `200`,
    `mobileReadMode=projection-v4-cache`, 10 turns,
    `mobileOmittedTurnCount=54`, `mobileProjection.source=cache`, and
    `mobileProjection.ageMs=86`.
  - Server logs showed summary resolver refresh:
    `summary_app_server_refresh_start`, `summary_app_server_refresh_ok`, and
    `summary_ready` with `source=state-db+app-server`, followed by
    `thread_read_ok` on first full detail and `projection_hit` on the second.
- Deployment status:
  - Not deployed.
  - Not pushed to public.
  - Runtime smoke supports entering deployment preflight, but production deploy
    has not yet been performed in this phase.

## 2026-06-24 - Phase 6 architecture refactor: thread-detail summary resolver

- User goal:
  - Continue the phased Codex Mobile Web system-level refactor in development.
  - Keep thread-opening work tied to concrete startup/detail latency surfaces.
  - Do not deploy or push public until all requested phases are complete and
    verified.
- Phase 6 scope:
  - Extract `/api/threads/:id` summary resolution from `server.js` into
    `adapters/thread-detail-summary-service.js`.
  - Covered summary behavior:
    - lookup order: state DB, started-thread cache, rollout-session fallback,
      app-server lookup;
    - app-server refresh when a local summary exists;
    - bounded summary lookup/refresh logs;
    - local-active overlay application before hidden-thread checks and
      projection cache input construction;
    - summary-ready diagnostics for source, title, rollout size, and status.
  - `server.js` still owns detail route sequencing, hidden-thread checks,
    projection cache get/seed calls, full `thread/read`, and turns-list
    fallback.
  - No cache policy or fallback behavior was changed.
- Changed files:
  - `adapters/thread-detail-summary-service.js`
  - `server.js`
  - `test/thread-detail-summary-service.test.js`
  - `package.json`
  - `docs/MODULES.md`
  - `docs/ARCHITECTURE.md`
  - `docs/COMPLEX_FEATURE_PATHS.md`
- Validation:
  - Focused detail summary/list/projection suites passed: `47` tests across
    `test/thread-detail-summary-service.test.js`,
    `test/thread-visibility.test.js`, and
    `test/thread-detail-projection-result-service.test.js`.
  - Focused projection/list/render suites passed: `162` tests across
    `test/thread-detail-summary-service.test.js`,
    `test/thread-list-fallback-cache-service.test.js`,
    `test/thread-visibility.test.js`,
    `test/thread-detail-projection-result-service.test.js`,
    `test/thread-detail-projection-input-service.test.js`,
    `test/thread-detail-projection-service.test.js`,
    `test/thread-detail-projection-v4-service.test.js`, and
    `test/conversation-render.test.js`.
  - `npm run check`
  - `npm test` passed (`691` tests).
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
  - This is a sixth development phase, not completion of the full
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

## 2026-06-26 - Latest continuation status: v479 keyed DOM patch deployed

- Latest code commit:
  - `51c0549 extract keyed DOM patch helper`
- Note:
  - This file is not strictly chronological. Fuller v479 evidence appears
    above, but this compact EOF copy is kept so future continuations that read
    only the recent tail see the current state.
- Change:
  - Keyed DOM reconciliation moved from `public/app.js` to
    `public/thread-detail-dom-patch.js`.
  - `public/app.js` now delegates `patchNode` / `patchHtml`; the helper owns
    render keys, compatibility checks, attribute sync, keyed child patching,
    replacement, and bounded `patchHtml` results.
  - Static build/cache: `0.1.11|codex-mobile-shell-v479` /
    `codex-mobile-shell-v479`.
- Validation:
  - Source focused suite passed (`161` tests).
  - Source `npm test` passed (`872` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
  - Production focused suite passed (`161` tests).
  - Source/production SHA parity verified for changed runtime, tests, and docs.
- Deploy:
  - Deployed through Home AI central macOS plugin deploy path with reason
    `codex-mobile-keyed-dom-patch-v479`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T205503Z-plugin-codex-mobile-web-codex-mobile-keyed-dom-patch-v479`
  - Production `/api/public-config` readback:
    `clientBuildId=0.1.11|codex-mobile-shell-v479`,
    `shellCacheName=codex-mobile-shell-v479`, `version=0.1.11`,
    `authRequired=true`.
- Browser/visual note:
  - Browser automation was not callable in the current tool list, and local
    Playwright was not installed in this workspace. v479 evidence is tests,
    production focused tests, HTTP readback, and source/prod parity.
- Release:
  - Public was not pushed for v479.

## 2026-06-26 - Latest continuation status: v480 operation card template deployed

- Latest code commit:
  - `6612b0e extract operation card html template`
- Change:
  - Live operation / command detail card final HTML template ownership moved
    from `public/app.js` to `public/live-operation-dock-state.js`.
  - `operationCardHtml` now owns the section/meta/detail/duration template
    structure, empty-detail placeholder, completed class rendering, injected
    escaping, and bounded duration data-attribute filtering.
  - `public/app.js` still owns operation item extraction, duration calculation,
    render-key selection, and real DOM insertion.
  - Static build/cache: `0.1.11|codex-mobile-shell-v480` /
    `codex-mobile-shell-v480`.
- Root-cause boundary:
  - v478 had moved operation card content planning out of `app.js`, but the
    final `operation-meta-line`, `operation-detail-line`, duration HTML, and
    empty-detail card template were still hand-built in `app.js`.
  - v480 closes that specific Phase A boundary without changing visible card
    layout or adding a UI fallback.
- Validation:
  - Focused source suite passed:
    `node --test test/live-operation-dock-state.test.js
    test/collab-agent-render.test.js test/conversation-render.test.js
    test/mobile-viewport.test.js test/app-update.test.js
    test/thread-goal-service.test.js test/thread-task-card-route.test.js`
    (`144` passed).
  - Full source `npm test` passed (`875` passed).
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Production deploy:
  - Deployed through the Home AI central macOS plugin deploy path with reason
    `codex-mobile-operation-card-template-v480`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T210625Z-plugin-codex-mobile-web-codex-mobile-operation-card-template-v480`
  - The deploy retention step pruned the prior v479 backup under the same
    target/day retention policy; v480 is the current retained backup.
  - Production `/api/public-config` readback:
    `clientBuildId=0.1.11|codex-mobile-shell-v480`,
    `shellCacheName=codex-mobile-shell-v480`, `version=0.1.11`,
    `authRequired=true`.
  - Source/production SHA parity verified for:
    `public/app.js`, `public/live-operation-dock-state.js`, `public/sw.js`,
    `test/live-operation-dock-state.test.js`,
    `test/collab-agent-render.test.js`, `test/conversation-render.test.js`,
    `test/mobile-viewport.test.js`, `README.md`,
    `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and `docs/MODULES.md`.
  - Production focused suite passed (`144` passed).
- Browser/visual note:
  - Browser automation was not callable in the current tool list, and local
    Playwright is not installed in this workspace. v480 closure evidence is
    focused source tests, full source tests, production focused tests,
    production public-config readback, and source/prod SHA parity.
- Release:
  - Public was not pushed for v480.

## 2026-06-26 - v481 local architecture slice and Home AI return-event verification

- Local architecture commit:
  - `2241183 extract single-thread render shell plan`
- v481 change:
  - `public/thread-detail-render-plan.js` now owns single-thread full-render
    shell planning for loading, load-error, and detail/empty-state render
    outcomes.
  - `public/app.js` still owns live DOM writes, retry binding, scroll/bottom
    follow, hydration, and action binding.
  - Static build/cache was bumped locally to
    `0.1.11|codex-mobile-shell-v481` / `codex-mobile-shell-v481`.
- v481 validation:
  - Source `npm test` passed (`880` tests).
  - Source `npm run check`, `npm run check:macos`, and `git diff --check`
    passed.
  - v481 has not been production deployed yet; production still reported
    `0.1.11|codex-mobile-shell-v480` during this turn.
- Home AI Autonomous Delivery return-card event task:
  - Task card `ttc_a8ab1599a96e2e92ed` requested wiring terminal return
    cards into Home AI `/api/autonomous-delivery/return-card-events`.
  - Inspection found this protocol already implemented by prior commit
    `64d3b30 wire return cards to Home AI delivery events` and deployed in the
    current production mirror.
  - Source and production SHA-256 matched for
    `adapters/home-ai-autonomous-delivery-return-service.js`,
    `adapters/thread-task-card-service.js`, `server.js`,
    `scripts/codex-mobile-mcp-server.js`, `scripts/return-thread-task-card.js`,
    `docs/CROSS_THREAD_TASK_CARDS_IMPLEMENTATION.md`,
    `docs/CROSS_THREAD_TASK_CARDS_DESIGN.md`,
    `test/home-ai-autonomous-delivery-return-service.test.js`, and
    `test/thread-task-card-service.test.js`.
  - Focused return-card event tests passed in both source and production
    directories:
    `test/home-ai-autonomous-delivery-return-service.test.js`,
    `test/thread-task-card-service.test.js`, and
    `test/codex-mobile-mcp-server.test.js` (`39` tests each).
  - No new task-specific code changes were required for the Home AI return-event
    card in this continuation. The original task had already been replied to:
    `ttc_25262fb1d46a151f36` is the terminal completed return card.
  - A duplicate `return_to_source` attempt in this continuation was rejected
    with `task_card_not_returnable:replied`, which is the expected idempotency
    guard and prevented a duplicate return-card loop.

## 2026-06-26 - Latest continuation status: v482 full-render scroll plan deployed

- Latest code commit:
  - `5d57e4e extract full-render scroll plan`
- Prior local v481 deployment:
  - `2241183 extract single-thread render shell plan` was deployed first through
    the Home AI central macOS plugin deploy path with reason
    `codex-mobile-single-thread-shell-plan-v481`.
  - Production readback after v481 reported
    `clientBuildId=0.1.11|codex-mobile-shell-v481` and
    `shellCacheName=codex-mobile-shell-v481`.
  - Source/production SHA parity matched for the changed v481 files, and
    production focused suite passed (`150` tests).
- v482 change:
  - Full-render bottom-follow planning for single-thread conversation renders
    moved from `public/app.js` to `public/conversation-scroll.js` as
    `planFullRenderScroll`.
  - `public/app.js` still owns DOM/runtime observations and actual scrolling,
    but the final `stickToBottom` decision for full conversation renders now
    comes from a pure helper with bounded reasons.
  - Static build/cache: `0.1.11|codex-mobile-shell-v482` /
    `codex-mobile-shell-v482`.
- Root-cause boundary:
  - Symptom/risk: `renderCurrentThread()` still directly combined
    near-bottom, user-reading, auto-scroll hold, submitted-message follow,
    viewport follow, and explicit `stickToBottom` state. That formula is a
    high-risk ownership point for full-render flicker and incorrect bottom
    jumps.
  - Failing layer: frontend single-thread full-render scroll ownership.
  - Invariant: full-render scroll decisions should be planned by a testable
    helper; app code should provide observations and execute the result.
- Validation:
  - Source focused suite passed:
    `test/conversation-scroll.test.js`, `test/turn-scroll-controls.test.js`,
    `test/conversation-render.test.js`, `test/mobile-viewport.test.js`,
    `test/app-update.test.js`, `test/thread-goal-service.test.js`, and
    `test/thread-task-card-route.test.js` (`146` tests).
  - Full source `npm test` passed (`881` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Production deploy:
  - Deployed through Home AI central macOS plugin deploy path with reason
    `codex-mobile-full-render-scroll-plan-v482`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T212855Z-plugin-codex-mobile-web-codex-mobile-full-render-scroll-plan-v482`
  - The deploy retention step pruned the intermediate v481 backup under the
    daily latest-per-target policy; v482 is the current retained backup.
  - Production `/api/public-config` readback:
    `clientBuildId=0.1.11|codex-mobile-shell-v482`,
    `shellCacheName=codex-mobile-shell-v482`, `version=0.1.11`,
    `authRequired=true`.
  - Source/production SHA parity verified for:
    `public/app.js`, `public/conversation-scroll.js`, `public/sw.js`,
    `test/conversation-scroll.test.js`, `test/turn-scroll-controls.test.js`,
    `test/mobile-viewport.test.js`, `test/thread-goal-service.test.js`,
    `test/thread-task-card-route.test.js`, `README.md`,
    `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and `docs/MODULES.md`.
  - Production focused suite passed (`146` tests).
- Browser/visual note:
  - Browser automation remains unavailable in the current tool list. v482
    closure evidence is focused source tests, full source tests, production
    focused tests, production public-config readback, and source/prod SHA
    parity.
- Release:
  - Public was not pushed for v482.

## 2026-06-26 - v483 conversation HTML update plan deployed

- Latest code commit:
  - `140eb77 extract conversation html update plan`
- v483 change:
  - `public/thread-detail-dom-patch.js` now owns
    `planConversationHtmlUpdate`, a pure planning boundary for single-thread
    conversation HTML updates.
  - The planner decides stable-signature hydration versus changed-signature DOM
    patch/full `innerHTML`, patch-shell signature updates, hydration options,
    and scroll action.
  - `public/app.js` still owns the live DOM write, patch fallback, state
    assignment, real hydration callbacks, scroll execution, and performance
    reporting.
  - Static build/cache: `0.1.11|codex-mobile-shell-v483` /
    `codex-mobile-shell-v483`.
- Root-cause boundary:
  - Symptom/risk: `updateConversationHtml()` still mixed signature comparison,
    patch-shell signature state, DOM update strategy, rich-hydration skipping,
    and bottom-follow behavior in one UI function. That made repeated message
    disappearance/flicker regressions harder to isolate.
  - Failing layer: frontend single-thread conversation DOM update ownership.
  - Invariant: update planning should be pure and executable-testable; app code
    should execute the plan against the actual DOM.
- Validation:
  - Source focused suite passed:
    `test/thread-detail-dom-patch.test.js`,
    `test/turn-scroll-controls.test.js`, `test/conversation-render.test.js`,
    `test/mobile-viewport.test.js`, `test/app-update.test.js`,
    `test/thread-goal-service.test.js`,
    `test/thread-task-card-route.test.js`,
    `test/github-link-preview-ui.test.js`, and
    `test/mermaid-render.test.js` (`176` tests).
  - Full source `npm test` passed (`883` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Production deploy:
  - Deployed through Home AI central macOS plugin deploy path with reason
    `codex-mobile-conversation-html-update-plan-v483`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T213931Z-plugin-codex-mobile-web-codex-mobile-conversation-html-update-plan-v483`
  - Production `/api/public-config` readback:
    `clientBuildId=0.1.11|codex-mobile-shell-v483`,
    `shellCacheName=codex-mobile-shell-v483`, `version=0.1.11`,
    `authRequired=true`.
  - Source/production SHA parity verified for:
    `public/app.js`, `public/thread-detail-dom-patch.js`, `public/sw.js`,
    `test/thread-detail-dom-patch.test.js`,
    `test/turn-scroll-controls.test.js`, `test/mobile-viewport.test.js`,
    `test/github-link-preview-ui.test.js`, `test/mermaid-render.test.js`,
    `test/thread-goal-service.test.js`,
    `test/thread-task-card-route.test.js`, `README.md`,
    `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and `docs/MODULES.md`.
  - Production focused suite passed (`176` tests).
- Browser/visual note:
  - Browser automation remains unavailable in the current tool list. v483
    closure evidence is source focused tests, full source tests, production
    focused tests, production public-config readback, and source/prod SHA
    parity.
- Release:
  - Public was not pushed for v483.

## 2026-06-26 - v484 local DOM patch completion plan deployed

- Latest code commit:
  - `ad184a8 extract local dom patch completion plan`
- v484 change:
  - `public/thread-detail-dom-patch.js` now owns
    `planLocalConversationDomUpdateCompletion`, a pure planning boundary for
    local DOM patch completion.
  - The planner distinguishes tile-pane terminal completion,
    single-thread-unpatchable blocked completion, and single-thread completion
    with hydrate/signature/scroll intent.
  - `public/app.js` still owns the real tile pane patch, real hydration
    callback, state writes, and scroll scheduling.
  - Static build/cache: `0.1.11|codex-mobile-shell-v484` /
    `codex-mobile-shell-v484`.
- Root-cause boundary:
  - Symptom/risk: `completeLocalConversationDomUpdate()` still mixed tile/single
    surface completion, signature writes, hydration, and scroll scheduling in
    one app function. That is a high-risk recurrence point for local-patch
    flicker, signature mismatch, and tile/single state bleed.
  - Failing layer: frontend local DOM patch completion ownership.
  - Invariant: local patch completion decisions should be pure and
    executable-testable; app code should execute the plan against runtime DOM
    and state.
- Validation:
  - Source focused suite passed:
    `test/thread-detail-dom-patch.test.js`,
    `test/conversation-render.test.js`, `test/turn-scroll-controls.test.js`,
    `test/mobile-viewport.test.js`, `test/app-update.test.js`,
    `test/thread-goal-service.test.js`, and
    `test/thread-task-card-route.test.js` (`167` tests).
  - Full source `npm test` passed (`886` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Production deploy:
  - Deployed through Home AI central macOS plugin deploy path with reason
    `codex-mobile-local-dom-patch-completion-plan-v484`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T214645Z-plugin-codex-mobile-web-codex-mobile-local-dom-patch-completion-plan-v484`
  - Production `/api/public-config` readback:
    `clientBuildId=0.1.11|codex-mobile-shell-v484`,
    `shellCacheName=codex-mobile-shell-v484`, `version=0.1.11`,
    `authRequired=true`.
  - Source/production SHA parity verified for:
    `public/app.js`, `public/thread-detail-dom-patch.js`, `public/sw.js`,
    `test/thread-detail-dom-patch.test.js`,
    `test/conversation-render.test.js`,
    `test/turn-scroll-controls.test.js`, `test/mobile-viewport.test.js`,
    `test/thread-goal-service.test.js`,
    `test/thread-task-card-route.test.js`, `README.md`,
    `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and `docs/MODULES.md`.
  - Production focused suite passed (`167` tests).
- Browser/visual note:
  - Browser automation remains unavailable in the current tool list. v484
    closure evidence is source focused tests, full source tests, production
    focused tests, production public-config readback, and source/prod SHA
    parity.
- Release:
  - Public was not pushed for v484.

## 2026-06-26 - v485 visible item insertion anchoring deployed

- Latest code commit:
  - `4f9e626 extract visible item insertion anchoring`
- v485 change:
  - `public/thread-detail-dom-patch.js` now owns
    `insertVisibleItemElement`, the concrete visible-item insertion anchor
    policy for local single-thread item patching.
  - The helper distinguishes three cases with executable tests:
    nearest rendered previous item followed by another node, nearest rendered
    previous item at the DOM end, and no previous rendered item.
  - `public/app.js` delegates visible item insertion to the helper and still
    owns the runtime DOM lookup, render-key construction, hydration, and
    scroll completion.
  - Static build/cache: `0.1.11|codex-mobile-shell-v485` /
    `codex-mobile-shell-v485`.
- Root-cause boundary:
  - Symptom/risk: the previous inline `insertVisibleItemDom()` path searched
    for the nearest previous visible item, but when that previous node was the
    last DOM child, `previousNode.nextSibling` was `null`; the old fallback then
    reused `article.firstChild`, which could insert the new item at the start
    instead of appending after the previous item.
  - Failing layer: frontend visible-item DOM patch insertion anchoring.
  - Invariant: item insertion must preserve visible-entry order; only the
    "no previous rendered item" case may fall back to before-first insertion.
- Validation:
  - Source focused suite passed:
    `test/thread-detail-dom-patch.test.js`,
    `test/conversation-render.test.js`, `test/mobile-viewport.test.js`,
    `test/app-update.test.js`, `test/thread-goal-service.test.js`, and
    `test/thread-task-card-route.test.js` (`165` tests).
  - Full source `npm test` passed (`890` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Production deploy:
  - Deployed through Home AI central macOS plugin deploy path with reason
    `codex-mobile-visible-item-insert-anchoring-v485`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T215711Z-plugin-codex-mobile-web-codex-mobile-visible-item-insert-anchoring-v485`
  - Production `/api/public-config` readback:
    `clientBuildId=0.1.11|codex-mobile-shell-v485`,
    `shellCacheName=codex-mobile-shell-v485`, `version=0.1.11`,
    `authRequired=true`.
  - Source/production SHA parity verified for:
    `public/app.js`, `public/thread-detail-dom-patch.js`, `public/sw.js`,
    `test/thread-detail-dom-patch.test.js`,
    `test/conversation-render.test.js`, `test/mobile-viewport.test.js`,
    `test/thread-goal-service.test.js`,
    `test/thread-task-card-route.test.js`, `README.md`,
    `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and `docs/MODULES.md`.
  - Production focused suite passed (`165` tests).
- Browser/visual note:
  - Browser automation remains unavailable in the current tool list. v485
    closure evidence is source focused tests, full source tests, production
    focused tests, production public-config readback, and source/prod SHA
    parity.
- Release:
  - Public was not pushed for v485.

## 2026-06-26 - v486 refresh patch execution plan deployed

- Latest code commit:
  - `e7d8795 extract refresh patch execution plan`
- v486 change:
  - `public/thread-detail-render-plan.js` now owns
    `planThreadDetailRefreshPatchExecution`, a pure policy helper for
    `refreshCurrentThread()` patch execution.
  - The helper decides whether a refresh should try tile-pane patch, whether
    single-thread local patch is eligible, whether metadata-only tile misses
    should update metadata without full render, and which fallback action
    applies.
  - `public/app.js` still owns real DOM patch attempts, metadata writes, full
    render execution, and diagnostic/performance reporting.
  - Static build/cache: `0.1.11|codex-mobile-shell-v486` /
    `codex-mobile-shell-v486`.
- Root-cause boundary:
  - Symptom/risk: `refreshCurrentThread()` still mixed server result merge,
    render signature decisions, tile surface decisions, local patch attempts,
    metadata-only updates, and full-render fallback. Keeping the tile/single
    execution policy inline made it easy to reintroduce wrong-surface local
    patch attempts or metadata-only full renders.
  - Failing layer: frontend thread-detail refresh render execution policy.
  - Invariant: tile surface refreshes may try tile-pane patch, but must not
    fall through to single-thread local patch; metadata-only refreshes should
    update metadata after a tile miss rather than triggering full render.
- Validation:
  - Source focused suite passed:
    `test/thread-detail-render-plan.test.js`,
    `test/conversation-render.test.js`, `test/mobile-viewport.test.js`,
    `test/thread-tile-layout-ui.test.js`, `test/thread-goal-service.test.js`,
    and `test/thread-task-card-route.test.js` (`141` tests).
  - Full source `npm test` passed (`894` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Production deploy:
  - Deployed through Home AI central macOS plugin deploy path with reason
    `codex-mobile-refresh-patch-execution-plan-v486`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T220410Z-plugin-codex-mobile-web-codex-mobile-refresh-patch-execution-plan-v486`
  - Production `/api/public-config` readback:
    `clientBuildId=0.1.11|codex-mobile-shell-v486`,
    `shellCacheName=codex-mobile-shell-v486`, `version=0.1.11`,
    `authRequired=true`.
  - Source/production SHA parity verified for:
    `public/app.js`, `public/thread-detail-render-plan.js`, `public/sw.js`,
    `test/thread-detail-render-plan.test.js`,
    `test/conversation-render.test.js`, `test/mobile-viewport.test.js`,
    `test/thread-tile-layout-ui.test.js`, `test/thread-goal-service.test.js`,
    `test/thread-task-card-route.test.js`, `README.md`,
    `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and `docs/MODULES.md`.
  - Production focused suite passed (`141` tests).
- Browser/visual note:
  - Browser automation remains unavailable in the current tool list. v486
    closure evidence is source focused tests, full source tests, production
    focused tests, production public-config readback, and source/prod SHA
    parity.
- Release:
  - Public was not pushed for v486.

## 2026-06-26 - v487 refresh outcome execution plan deployed

- Latest code commit:
  - `25701ba extract refresh outcome execution plan`
- v487 change:
  - `public/thread-detail-render-plan.js` now owns
    `planThreadDetailRefreshOutcomeExecution`, a pure policy helper for
    converting `refreshCurrentThread()` render outcomes into metadata-only,
    local-patch completion, full-render, and projection-consistency execution
    decisions.
  - `public/app.js` delegates post-outcome execution decisions to that helper
    and still owns real header/dock/timer updates, full render execution, and
    runtime projection diagnostics.
  - Static build/cache: `0.1.11|codex-mobile-shell-v487` /
    `codex-mobile-shell-v487`.
- Root-cause boundary:
  - Symptom/risk: after refresh patch execution, `refreshCurrentThread()` still
    inlined `refreshRenderAction` branching for metadata update, full render,
    and projection consistency. That left a high-risk recurrence point for
    inconsistent metadata-only versus full-render completion.
  - Failing layer: frontend thread-detail refresh outcome execution policy.
  - Invariant: render outcome actions must be converted by a pure helper; full
    render and metadata/local-patch completion must report projection
    consistency through the same unified execution outlet.
- Validation:
  - Source focused suite passed:
    `test/thread-detail-render-plan.test.js`,
    `test/conversation-render.test.js`, `test/mobile-viewport.test.js`,
    `test/thread-tile-layout-ui.test.js`,
    `test/thread-goal-service.test.js`, and
    `test/thread-task-card-route.test.js` (`145` tests).
  - Full source `npm test` passed (`898` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Production deploy:
  - Deployed through Home AI central macOS plugin deploy path with reason
    `codex-mobile-refresh-outcome-execution-plan-v487`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T221010Z-plugin-codex-mobile-web-codex-mobile-refresh-outcome-execution-plan-v487`
  - Production `/api/public-config` readback:
    `clientBuildId=0.1.11|codex-mobile-shell-v487`,
    `shellCacheName=codex-mobile-shell-v487`, `version=0.1.11`,
    `authRequired=true`.
  - Source/production SHA parity verified for:
    `public/app.js`, `public/thread-detail-render-plan.js`, `public/sw.js`,
    `test/thread-detail-render-plan.test.js`,
    `test/conversation-render.test.js`, `test/mobile-viewport.test.js`,
    `test/thread-goal-service.test.js`,
    `test/thread-task-card-route.test.js`, `README.md`,
    `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and `docs/MODULES.md`.
  - Production focused suite passed (`145` tests).
- Browser/visual note:
  - Browser automation remains unavailable in the current tool list. v487
    closure evidence is source focused tests, full source tests, production
    focused tests, production public-config readback, and source/prod SHA
    parity.
- Release:
  - Public was not pushed for v487.

## 2026-06-26 - Home AI autonomous delivery return-card event path verified

- Source task card:
  - `ttc_a8ab1599a96e2e92ed` requested Codex Mobile terminal return cards be
    wired into Home AI Autonomous Delivery Loop return-card event intake.
- Current implementation status:
  - The required runtime path already exists in code commit
    `64d3b30 wire return cards to Home AI delivery events`, with deployment
    evidence recorded by `16000b0 docs record return-card event deployment`
    and `1ee1fed docs record delivery event return evidence`.
  - `server.js` wires `onTerminalReturnCard` from
    `adapters/thread-task-card-service.js` to
    `adapters/home-ai-autonomous-delivery-return-service.js`.
  - The observer emits only bounded metadata to
    `/api/autonomous-delivery/return-card-events`: original task-card id,
    terminal return-card id, status, short title/summary, source/target thread
    ids, workflow id, `terminal:true`, and `ackPolicy:"none"`.
  - Terminal/no-op/ack return cards remain terminal and do not request another
    acknowledgement or dispatch repair cards.
  - Unknown Home AI task-card ids are recorded as bounded
    `unknown_task_card` audit state and do not block return-card delivery.
- Validation:
  - Source focused suite passed:
    `test/home-ai-autonomous-delivery-return-service.test.js`,
    `test/thread-task-card-service.test.js`,
    `test/thread-task-card-route.test.js`, and
    `test/codex-mobile-mcp-server.test.js` (`47` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
  - Production `/api/public-config` readback remained
    `0.1.11|codex-mobile-shell-v487` / `codex-mobile-shell-v487`.
  - Source/production SHA parity verified for:
    `server.js`, `adapters/thread-task-card-service.js`,
    `adapters/home-ai-autonomous-delivery-return-service.js`,
    `scripts/return-thread-task-card.js`,
    `scripts/codex-mobile-mcp-server.js`,
    `docs/CROSS_THREAD_TASK_CARDS_DESIGN.md`,
    `docs/CROSS_THREAD_TASK_CARDS_IMPLEMENTATION.md`,
    `test/home-ai-autonomous-delivery-return-service.test.js`,
    `test/thread-task-card-service.test.js`,
    `test/thread-task-card-route.test.js`,
    `test/codex-mobile-mcp-server.test.js`, `public/app.js`, and
    `public/sw.js`.
  - Production focused suite passed for the same return-event/task-card tests
    (`47` tests).
- Return-card state:
  - A duplicate return attempt in this pass was correctly rejected with
    `task_card_not_returnable:replied`.
  - Runtime store bounded metadata shows source card
    `ttc_a8ab1599a96e2e92ed` is already `replied` with terminal return card
    `ttc_25262fb1d46a151f36`.
  - The existing terminal return card is `completed`,
    `terminal:true`, `requiresReturn:false`, and `ackPolicy:"none"`.
  - Its Home AI delivery-loop observer state is `unknown_task_card` with HTTP
    `404`, which matches the contract for a Home AI endpoint that does not know
    the original delivery-slice task id: record bounded diagnostic state and do
    not block normal return-card delivery.
- Code changes in this pass:
  - None. This pass verified an already deployed implementation and confirmed
    the source task card already had a terminal return.

## 2026-06-26 - v488 refresh performance event fields deployed

- Latest code commit:
  - `459340d extract refresh performance event fields`
- v488 change:
  - `public/thread-performance-metrics.js` now owns
    `threadDetailRefreshEventFields`, a pure helper that builds the bounded
    `thread_refresh_ms` performance event payload for refresh paths.
  - The helper emits server timings, performance phase, client timings,
    detail shape, read mode, status, turn counts, omitted-turn count, rollout
    size, render-plan reason, refresh render action, patch reject reason, and
    local/tile/metadata flags.
  - `public/app.js` still owns the real API call, merge, DOM/header/dock
    updates, render execution, and `postPerformanceEvent` call, but no longer
    hand-builds the refresh event payload.
  - Static build/cache: `0.1.11|codex-mobile-shell-v488` /
    `codex-mobile-shell-v488`.
- Root-cause boundary:
  - Symptom/risk: after v487, render/patch/outcome decisions were helper-owned,
    but `refreshCurrentThread()` still manually assembled `thread_refresh_ms`.
    That made diagnostic field ownership prone to drift across metadata-only,
    local patch, tile-pane patch, and full-render branches, weakening large
    session and projection-mismatch evidence.
  - Failing layer: frontend thread-detail refresh performance event ownership.
  - Invariant: refresh performance events must be generated from one pure
    bounded helper and must contain timings, counts, statuses, and reason codes
    only, not message bodies, task-card bodies, uploads, private paths, cookies,
    tokens, or long logs.
- Validation:
  - Source focused suite passed:
    `test/thread-performance-metrics.test.js`,
    `test/conversation-render.test.js`, `test/mobile-viewport.test.js`,
    `test/thread-detail-render-plan.test.js`,
    `test/thread-goal-service.test.js`, and
    `test/thread-task-card-route.test.js` (`149` tests).
  - Full source `npm test` passed (`899` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Production deploy:
  - Deployed through Home AI central macOS plugin deploy path with reason
    `codex-mobile-refresh-performance-event-fields-v488`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T222331Z-plugin-codex-mobile-web-codex-mobile-refresh-performance-event-fields-v488`
  - Production `/api/public-config` readback:
    `clientBuildId=0.1.11|codex-mobile-shell-v488`,
    `shellCacheName=codex-mobile-shell-v488`, `version=0.1.11`,
    `authRequired=true`.
  - Source/production SHA parity verified for:
    `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`,
    `docs/MODULES.md`, `public/app.js`, `public/sw.js`,
    `public/thread-performance-metrics.js`,
    `test/conversation-render.test.js`, `test/mobile-viewport.test.js`,
    `test/thread-goal-service.test.js`,
    `test/thread-performance-metrics.test.js`, and
    `test/thread-task-card-route.test.js`.
  - Production focused suite passed (`149` tests).
- Browser/visual note:
  - Browser automation remains unavailable in the current tool list. v488
    closure evidence is source focused tests, full source tests, production
    focused tests, production public-config readback, and source/prod SHA
    parity.
- Release:
  - Public was not pushed for v488.
- Next suggested slice:
  - Continue Phase A by extracting the remaining first-paint/full-backfill
    performance event payload planning into `public/thread-performance-metrics.js`,
    or move the refresh patch rejection diagnostic payload into a bounded helper
    so `refreshCurrentThread()` keeps shrinking toward orchestration only.

## 2026-06-26 - v489 first-paint/full-ready performance event fields deployed

- Latest code commit:
  - `e9ba5fc extract first paint performance event fields`
- v489 change:
  - `public/thread-performance-metrics.js` now owns
    `threadDetailFirstPaintEventFields` and
    `threadDetailFullReadyEventFields`, pure helpers that build bounded
    `thread_detail_first_paint` and `thread_detail_full_ready` payloads.
  - `public/app.js` still owns thread API calls, current-thread state,
    conversation rendering, and `postPerformanceEvent`, but no longer hand-builds
    first-paint/full-ready payloads in cached-current, initial open, or full
    backfill paths.
  - Cached current-thread first paint preserves the warm-client phase behavior
    and omits status/omitted-turn fields; uncached first paint and full-ready
    payloads include the bounded status/count/timing fields needed for
    cold-path diagnosis.
  - Static build/cache: `0.1.11|codex-mobile-shell-v489` /
    `codex-mobile-shell-v489`.
- Root-cause boundary:
  - Symptom/risk: v488 centralized `thread_refresh_ms`, but `loadThread()` and
    `backfillFullThreadDetail()` still manually assembled first-paint and
    full-ready payloads. That left large-session cold/warm evidence prone to
    drift across cached current, initial open, refresh, and full backfill.
  - Failing layer: frontend thread-detail first-paint/full-ready performance
    event ownership.
  - Invariant: first-paint and full-backfill performance events must be planned
    by pure bounded helpers and contain timing/count/status/reason metadata only,
    not message bodies, task-card bodies, uploads, private paths, cookies,
    tokens, provider payloads, or long logs.
- Validation:
  - Source focused suite passed:
    `test/thread-performance-metrics.test.js`,
    `test/conversation-render.test.js`, `test/mobile-viewport.test.js`,
    `test/thread-detail-render-plan.test.js`,
    `test/thread-goal-service.test.js`,
    `test/thread-task-card-route.test.js`, and
    `test/turn-scroll-controls.test.js` (`158` tests).
  - Full source `npm test` passed (`902` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Production deploy:
  - Deployed through Home AI central macOS plugin deploy path with reason
    `codex-mobile-first-paint-performance-event-fields-v489`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T223708Z-plugin-codex-mobile-web-codex-mobile-first-paint-performance-event-fields-v489`
  - Production `/api/public-config` readback:
    `clientBuildId=0.1.11|codex-mobile-shell-v489`,
    `shellCacheName=codex-mobile-shell-v489`, `version=0.1.11`,
    `authRequired=true`.
  - Source/production SHA parity verified for:
    `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`,
    `docs/MODULES.md`, `public/app.js`, `public/sw.js`,
    `public/thread-performance-metrics.js`,
    `test/conversation-render.test.js`, `test/mobile-viewport.test.js`,
    `test/thread-goal-service.test.js`,
    `test/thread-performance-metrics.test.js`, and
    `test/thread-task-card-route.test.js`.
  - Production focused suite passed (`158` tests).
- Browser/visual note:
  - Browser automation remains unavailable in the current tool list. v489
    closure evidence is source focused tests, full source tests, production
    focused tests, production public-config readback, and source/prod SHA
    parity.
- Release:
  - Public was not pushed for v489.
- Next suggested slice:
  - Continue Phase A by moving refresh patch rejection diagnostic payloads into
    a bounded helper, or proceed to Phase B large-session cold-path evidence now
    that first-paint, refresh, and full-ready payload ownership is unified.

## 2026-06-26 - v490 patch-reject diagnostic event planning deployed

- Latest code commit:
  - `d859324 extract patch rejection diagnostic events`
- v490 change:
  - Added `public/thread-diagnostic-events.js` with
    `detailPatchRejectedDiagnosticEvent`, a pure helper that builds the bounded
    `conversation_projection_mismatch/detail_patch_rejected` Home AI diagnostic
    payload.
  - `refreshCurrentThread()` still owns the real refresh, merge, DOM patch
    attempt, failure recording, and Home AI diagnostic transport, but no longer
    hand-builds the patch-reject diagnostic category/type/context/counts/
    breadcrumbs.
  - `public/home-ai-diagnostic-reporting.js` now allows bounded
    `render_plan_reason`, `patch_reject_reason`, and `previous_count` fields so
    patch-rejection reports preserve their root-cause reason codes instead of
    losing them in plugin-side sanitization.
  - Static build/cache: `0.1.11|codex-mobile-shell-v490` /
    `codex-mobile-shell-v490`.
- Root-cause boundary:
  - Symptom/risk: patch-reject diagnostic payloads were assembled inline in
    `refreshCurrentThread()`, and the sanitizer did not whitelist the internal
    render/patch reason-code fields. A production `detail_patch_rejected`
    report could therefore reach Home AI without the evidence needed to tell
    why local DOM patching was rejected.
  - Failing layer: frontend projection/render mismatch diagnostic event field
    ownership and plugin diagnostic sanitizer allowlist.
  - Invariant: projection mismatch diagnostics may contain bounded reason
    codes, hashes, counts, status fields, and timing buckets only; they must not
    contain message bodies, task-card bodies, uploads, screenshots, private
    paths, cookies, tokens, provider payloads, or long logs.
  - Classification: root-cause architecture cleanup; no fallback or UI-only
    mitigation added.
- Validation:
  - Source focused suite passed:
    `test/thread-diagnostic-events.test.js`,
    `test/home-ai-diagnostic-reporting.test.js`,
    `test/conversation-render.test.js`, `test/mobile-viewport.test.js`,
    `test/app-update.test.js`, `test/plugin-voice-input.test.js`,
    `test/thread-task-card-route.test.js`, and
    `test/thread-goal-service.test.js` (`144` tests).
  - Full source `npm test` passed (`905` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Production deploy:
  - Deployed through Home AI central macOS plugin deploy path with reason
    `codex-mobile-patch-reject-diagnostic-events-v490`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T224713Z-plugin-codex-mobile-web-codex-mobile-patch-reject-diagnostic-events-v490`
  - Production `/api/public-config` readback:
    `clientBuildId=0.1.11|codex-mobile-shell-v490`,
    `shellCacheName=codex-mobile-shell-v490`, `version=0.1.11`,
    `authRequired=true`.
  - Source/production SHA parity verified for:
    `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`,
    `docs/MODULES.md`, `package.json`, `server.js`, `public/app.js`,
    `public/home-ai-diagnostic-reporting.js`, `public/index.html`,
    `public/sw.js`, `public/thread-diagnostic-events.js`,
    `test/app-update.test.js`, `test/home-ai-diagnostic-reporting.test.js`,
    `test/mobile-viewport.test.js`, `test/plugin-voice-input.test.js`,
    `test/thread-diagnostic-events.test.js`,
    `test/thread-goal-service.test.js`, and
    `test/thread-task-card-route.test.js`.
  - Production focused suite passed (`144` tests).
- Browser/visual note:
  - Browser automation remains unavailable in the current tool list. v490
    closure evidence is source focused tests, full source tests, production
    focused tests, production public-config readback, and source/prod SHA
    parity.
- Release:
  - Public was not pushed for v490.
- Next suggested slice:
  - Continue Phase A by extracting the remaining conversation projection
    snapshot/report planning from `app.js`, or move to Phase B and use the now
    unified first-paint/refresh/full-ready/patch-reject evidence to identify
    the real large-session cold-path cost.

## 2026-06-26 - v491 projection consistency diagnostic events deployed

- Latest code commit:
  - `22f60ea extract projection consistency diagnostic events`
- v491 change:
  - `public/thread-diagnostic-events.js` now also owns
    `renderSignatureMismatchDiagnosticEvent`,
    `renderSignatureMismatchDiagnosticSuccess`,
    `duplicateRenderKeysDiagnosticEvent`, and
    `duplicateRenderKeysDiagnosticSuccess`.
  - `checkConversationProjectionConsistency()` still owns snapshot acquisition,
    mismatch/duplicate branching, failure/success recording, and Home AI report
    transport, but no longer hand-builds `render_signature_mismatch` or
    `duplicate_render_keys` payloads.
  - Static build/cache: `0.1.11|codex-mobile-shell-v491` /
    `codex-mobile-shell-v491`.
- Root-cause boundary:
  - Symptom/risk: v490 centralized patch-reject diagnostic payloads, but
    render-signature mismatch and duplicate-render-key report structures were
    still assembled inline in `public/app.js`. That left projection consistency
    report fields prone to drift when tile/single render consistency or
    snapshot shape changes.
  - Failing layer: frontend conversation projection consistency diagnostic
    event ownership.
  - Invariant: projection consistency diagnostics may contain bounded context,
    reason/status codes, DOM/visible/duplicate/pane counts, and breadcrumbs
    only; they must not contain message bodies, task-card bodies, uploads,
    screenshots, private paths, cookies, tokens, provider payloads, or long
    logs.
  - Classification: root-cause architecture cleanup; no fallback or UI-only
    mitigation added.
- Validation:
  - Source focused suite passed:
    `test/thread-diagnostic-events.test.js`,
    `test/home-ai-diagnostic-reporting.test.js`,
    `test/conversation-render.test.js`, `test/mobile-viewport.test.js`,
    `test/thread-task-card-route.test.js`, and
    `test/thread-goal-service.test.js` (`133` tests).
  - Full source `npm test` passed (`908` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Production deploy:
  - Deployed through Home AI central macOS plugin deploy path with reason
    `codex-mobile-projection-consistency-diagnostic-events-v491`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T225321Z-plugin-codex-mobile-web-codex-mobile-projection-consistency-diagnostic-events-v491`
  - Production `/api/public-config` readback:
    `clientBuildId=0.1.11|codex-mobile-shell-v491`,
    `shellCacheName=codex-mobile-shell-v491`, `version=0.1.11`,
    `authRequired=true`.
  - Source/production SHA parity verified for:
    `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`,
    `docs/MODULES.md`, `public/app.js`, `public/sw.js`,
    `public/thread-diagnostic-events.js`,
    `test/conversation-render.test.js`, `test/mobile-viewport.test.js`,
    `test/thread-diagnostic-events.test.js`,
    `test/thread-goal-service.test.js`, and
    `test/thread-task-card-route.test.js`.
  - Production focused suite passed (`133` tests).
- Browser/visual note:
  - Browser automation remains unavailable in the current tool list. v491
    closure evidence is source focused tests, full source tests, production
    focused tests, production public-config readback, and source/prod SHA
    parity.
- Release:
  - Public was not pushed for v491.
- Next suggested slice:
  - Either finish the Phase A diagnostic boundary by extracting
    `conversationProjectionDiagnosticSnapshot()` into a pure helper with
    injected tile/single dependencies, or move to Phase B and use the unified
    diagnostics/performance events to measure large-session cold-path costs.

## 2026-06-26 - v492 projection snapshot planning deployed

- Latest code commit:
  - `ae0f241 extract projection diagnostic snapshot planning`
- v492 change:
  - `public/thread-diagnostic-events.js` now owns
    `conversationProjectionDiagnosticSnapshot`, a pure helper that plans
    bounded single-thread versus tile-mode projection diagnostic snapshots from
    injected dependencies.
  - `public/app.js` still owns the real DOM/current-thread/tile-state reads, but
    now only passes those values and callbacks into the helper instead of
    assembling tile/single snapshot payload shape inline.
  - Static build/cache: `0.1.11|codex-mobile-shell-v492` /
    `codex-mobile-shell-v492`.
- Root-cause boundary:
  - Symptom/risk: v491 centralized projection mismatch event payloads, but the
    tile/single/transition snapshot planner still lived in `public/app.js`.
    That left diagnostic snapshot shape prone to drift from future conversation
    pane or single-thread render changes.
  - Failing layer: frontend conversation projection diagnostic snapshot
    ownership.
  - Invariant: snapshot planning must output only bounded signatures, route
    kind, read/render mode, pane/status flags, and numeric counts; it must not
    include message bodies, task-card bodies, uploads, screenshots, private
    paths, cookies, tokens, provider payloads, or long logs.
  - Classification: root-cause architecture cleanup; no fallback or UI-only
    mitigation added.
- Validation:
  - Source focused suite passed:
    `test/thread-diagnostic-events.test.js`,
    `test/home-ai-diagnostic-reporting.test.js`,
    `test/conversation-render.test.js`, `test/mobile-viewport.test.js`,
    `test/thread-task-card-route.test.js`, and
    `test/thread-goal-service.test.js` (`137` tests).
  - Full source `npm test` passed (`912` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Production deploy:
  - Deployed through Home AI central macOS plugin deploy path with reason
    `codex-mobile-projection-snapshot-planning-v492`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T230040Z-plugin-codex-mobile-web-codex-mobile-projection-snapshot-planning-v492`
  - Production `/api/public-config` readback:
    `clientBuildId=0.1.11|codex-mobile-shell-v492`,
    `shellCacheName=codex-mobile-shell-v492`, `version=0.1.11`,
    `authRequired=true`.
  - Source/production SHA parity verified for:
    `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`,
    `docs/MODULES.md`, `public/app.js`, `public/sw.js`,
    `public/thread-diagnostic-events.js`,
    `test/conversation-render.test.js`, `test/mobile-viewport.test.js`,
    `test/thread-diagnostic-events.test.js`,
    `test/thread-goal-service.test.js`, and
    `test/thread-task-card-route.test.js`.
  - Production focused suite passed (`137` tests).
- Browser/visual note:
  - Browser automation remains unavailable in the current tool list. v492
    closure evidence is source focused tests, full source tests, production
    focused tests, production public-config readback, and source/prod SHA
    parity.
- Release:
  - Public was not pushed for v492.
- Next suggested slice:
  - Move to Phase B large-session cold-path timing using the now unified
    diagnostics/performance event boundaries, unless another incident card
    proves a higher-priority task-card/projection protocol defect.

## 2026-06-26 - Home AI Autonomous Delivery return-card event card verified

- Source task card:
  - `ttc_a8ab1599a96e2e92ed`
  - Request: wire terminal Codex Mobile return cards into Home AI Autonomous
    Delivery Loop events.
- Current implementation status:
  - Already implemented in earlier commit
    `64d3b30 wire return cards to Home AI delivery events`.
  - `adapters/home-ai-autonomous-delivery-return-service.js` posts bounded
    terminal return metadata to
    `/api/autonomous-delivery/return-card-events` through the backend trusted
    Home AI/Hermes web-key path.
  - `adapters/thread-task-card-service.js` observes terminal
    `returnToSource`/auto-return cards for original non-terminal work cards,
    records send/404/failure state on return-card audit metadata, and does not
    block terminal return delivery or create acknowledgement loops.
- Validation:
  - Focused suite passed:
    `test/home-ai-autonomous-delivery-return-service.test.js`,
    `test/thread-task-card-service.test.js`,
    `test/codex-mobile-mcp-server.test.js`, and
    `test/thread-task-card-route.test.js` (`47` tests).
  - `git diff --check` passed and worktree had no uncommitted source changes
    before this handoff update.
  - Source/production SHA parity verified for:
    `adapters/home-ai-autonomous-delivery-return-service.js`,
    `adapters/thread-task-card-service.js`, `server.js`,
    `scripts/return-thread-task-card.js`,
    `scripts/codex-mobile-mcp-server.js`,
    `docs/CROSS_THREAD_TASK_CARDS_IMPLEMENTATION.md`,
    `docs/CROSS_THREAD_TASK_CARDS_DESIGN.md`,
    `test/home-ai-autonomous-delivery-return-service.test.js`, and
    `test/thread-task-card-service.test.js`.
- Privacy:
  - Return event payload tests and implementation confirm no card body, prompt,
    completion, upload bytes, screenshot, cookie, launch token, access key,
    provider payload, database row, or long log is sent.

## 2026-06-26 - v493 thread-detail cold-path diagnostics deployed

- Latest code commit:
  - `627e46c expand thread detail cold path diagnostics`
- v493 change:
  - `adapters/thread-detail-performance-service.js` now includes bounded
    thread-detail cold-path decision fields in
    `mobileDiagnostics.threadDetailTimings`: `readDecision`,
    `projectionState`, `projectionInputAvailable`, `projectionSource`,
    `projectionVersion`, `projectionAgeMs`, `projectionSeedStatus`, and
    `projectionSeedSource`.
  - `adapters/thread-detail-read-orchestration-service.js` now fills those
    fields for projection hits, projection misses, unavailable projection input,
    summary-sourced large-read decisions, bounded `turns-list-large`, full
    `thread/read`, fallback `thread/turns/list`, summary fallback, and
    projection seeding from bounded turns-list/full read.
  - Static build/cache: `0.1.11|codex-mobile-shell-v493` /
    `codex-mobile-shell-v493`.
- Root-cause boundary:
  - Symptom/risk: v492 had unified frontend first-paint/refresh/full-ready
    evidence, but server detail timings still could not fully explain whether a
    slow large-session first paint was caused by projection input being
    unavailable, projection cache miss, bounded turns-list protection, full
    `thread/read`, or projection seed failure.
  - Failing layer: server-side thread-detail cold-path diagnostic field
    ownership.
  - Invariant: thread-detail timing diagnostics may contain bounded read
    decisions, projection cache metadata, seed status, counts, and durations
    only; they must not contain message bodies, task-card bodies, uploads,
    screenshots, private paths, cookies, tokens, provider payloads, database
    rows, or long logs.
  - Classification: root-cause evidence and architecture cleanup; no fallback,
    forced refresh, hidden duplicate suppression, or UI-only mitigation added.
- Validation:
  - Source focused suite passed:
    `test/thread-detail-performance-service.test.js`,
    `test/thread-detail-read-orchestration-service.test.js`,
    `test/thread-performance-metrics.test.js`, `test/mobile-viewport.test.js`,
    `test/thread-goal-service.test.js`, and
    `test/thread-task-card-route.test.js` (`46` tests).
  - Full source `npm test` passed (`913` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Production deploy:
  - Deployed through Home AI central macOS plugin deploy path with reason
    `codex-mobile-thread-detail-cold-path-diagnostics-v493`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T231001Z-plugin-codex-mobile-web-codex-mobile-thread-detail-cold-path-diagnostics-v493`
  - Production `/api/public-config` readback:
    `clientBuildId=0.1.11|codex-mobile-shell-v493`,
    `shellCacheName=codex-mobile-shell-v493`, `version=0.1.11`,
    `authRequired=true`.
  - Source/production SHA parity verified for:
    `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`,
    `docs/MODULES.md`,
    `adapters/thread-detail-performance-service.js`,
    `adapters/thread-detail-read-orchestration-service.js`,
    `public/app.js`, `public/sw.js`, `test/mobile-viewport.test.js`,
    `test/thread-detail-performance-service.test.js`,
    `test/thread-detail-read-orchestration-service.test.js`,
    `test/thread-goal-service.test.js`, and
    `test/thread-task-card-route.test.js`.
  - Production focused suite passed (`46` tests).
- Browser/visual note:
  - Browser automation remains unavailable in the current tool list. v493
    closure evidence is source focused tests, full source tests, production
    focused tests, production public-config readback, and source/prod SHA
    parity.
- Release:
  - Public was not pushed for v493.
- Next suggested slice:
  - Use v493 `readDecision` / `projectionState` / `projectionSeedStatus`
    evidence from real large-session opens to decide the next Phase B repair:
    projection cache seeding/persistence, summary rollout-size hydration, or
    residual app-server full-read fallback. If live evidence points elsewhere,
    pivot to the matching Phase B subpath rather than changing cache invalidation
    speculatively.

## 2026-06-26 - v494 partial recent projection cache deployed

- Latest code commits:
  - `155c0c7 cache recent thread detail projections safely`
  - `4b40bf0 preserve partial projections through v4 cache`
  - `dabb8e6 allow partial cache after stale full projection`
- v494 change:
  - `mode=recent` projection misses that successfully return
    `turns-list-initial` now seed a memory-only partial projection with
    `partial:true` / `partialKind:recent-window`.
  - Later `mode=recent` reads pass `allowPartial` and can return
    `projection-v4-partial` / `projection-partial` without another app-server
    turns-list read.
  - Default projection `get()` still rejects partial cache, full/detail paths do
    not use it, partial entries are not persisted to disk, and reusable full
    projection cache is not overwritten.
  - The production-default v4 projection wrapper now forwards seed/get partial
    options to the base projection cache. This was required because the first
    production probe showed v4 was turning a recent window into full
    `projection-v4-cache`.
  - Stale full cache whose signature no longer matches no longer blocks
    `recent-window` partial seed. This was required because the second
    production probe showed `full-cache-exists` kept large sessions on repeated
    `turns-list-initial`.
  - Static build/cache: `0.1.11|codex-mobile-shell-v494` /
    `codex-mobile-shell-v494`.
- Root-cause boundary:
  - Symptom/risk: v493 evidence showed thread-list warm cache was working after
    the first process-lifetime baseline, but several large `mode=recent`
    details repeatedly returned `turns-list-initial` with projection misses.
  - Failing layer: server thread-detail recent-window warm path, including v4
    projection wrapper option propagation and stale-full-cache protection.
  - Invariant: a partial projection represents only the bounded recent window;
    it must be opt-in, memory-only, unable to overwrite reusable full cache, and
    clearly reported as `projection-v4-partial`/`source=partial` when used.
  - Classification: root-cause Phase B performance repair; no frontend duplicate
    hiding, forced refresh, or silent fallback was added.
- Validation:
  - Source focused suite passed:
    `test/thread-detail-projection-service.test.js`,
    `test/thread-detail-projection-v4-service.test.js`,
    `test/thread-detail-projection-result-service.test.js`,
    `test/thread-detail-performance-service.test.js`,
    `test/thread-detail-read-orchestration-service.test.js`,
    `test/thread-performance-metrics.test.js`, `test/mobile-viewport.test.js`,
    `test/thread-goal-service.test.js`, and
    `test/thread-task-card-route.test.js` (`74` tests).
  - Full source `npm test` passed (`921` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Production deploy:
  - Final deploy reason:
    `codex-mobile-partial-recent-projection-v494-stale-full-fix`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T233044Z-plugin-codex-mobile-web-codex-mobile-partial-recent-projection-v494-stale-full-fix`
  - Production `/api/public-config` readback:
    `clientBuildId=0.1.11|codex-mobile-shell-v494`,
    `shellCacheName=codex-mobile-shell-v494`, `version=0.1.11`,
    `authRequired=true`.
  - Source/production SHA parity verified for README/docs, projection services,
    orchestration/performance services, server/static shell files, and focused
    tests touched by v494.
  - Production focused suite passed (`74` tests).
- Production observation:
  - After final deploy, a list cold baseline showed one `miss-rebuild`; repeated
    list reads returned `fallbackCacheDecision=hit`, `fallbackMs=0/1`, and
    build count/number stayed `1`.
  - Six large-thread samples were checked using bounded ids/hashes only. Four
    large threads first returned `turns-list-initial` with
    `projectionSeedStatus=seeded-partial`, `threadReadMs=0`; their second reads
    returned `projection-v4-partial`, `readDecision=projection-partial-hit`,
    `projectionSource=partial`, `partialKind=recent-window`,
    `turnsListInitialMs=0`, `threadReadMs=0`. Two other large threads already
    had warm dynamic projection hits.
- Privacy:
  - Evidence recorded only bounded ids/hashes, statuses, modes, counts,
    durations, and cache decisions. No message bodies, task-card bodies,
    uploads, private paths, cookies, access keys, provider payloads, database
    rows, screenshots, or long logs were copied into docs or handoff.
- Release:
  - Public was not pushed for v494.
- Next suggested slice:
  - Continue Phase B by separating stale/invalid full projection disk entries
    from healthy full projection persistence more explicitly, or move to Phase A
    client render/patch ownership if new projection mismatch diagnostics appear.
    Use production `readDecision`, `projectionSource`, and client render
    diagnostics before changing cache invalidation again.

## 2026-06-26 - Home AI Autonomous Delivery return-card event task revalidated

- Source task card:
  - `ttc_a8ab1599a96e2e92ed`
  - Request: wire terminal Codex Mobile return cards into Home AI Autonomous
    Delivery Loop events.
- Result:
  - No additional runtime/source change was needed in this pass. The feature was
    already present from `64d3b30 wire return cards to Home AI delivery events`
    and remains deployed in the production mirror.
  - `adapters/home-ai-autonomous-delivery-return-service.js` posts bounded
    terminal return metadata to
    `/api/autonomous-delivery/return-card-events`.
  - `adapters/thread-task-card-service.js` calls the observer only for terminal
    return cards closing original non-terminal work cards, records sent/404/fail
    state on return-card audit metadata, and does not block return delivery or
    create acknowledgement loops.
- Validation:
  - Focused suite passed:
    `test/home-ai-autonomous-delivery-return-service.test.js`,
    `test/thread-task-card-service.test.js`,
    `test/codex-mobile-mcp-server.test.js`, and
    `test/thread-task-card-route.test.js` (`47` tests).
  - `git diff --check` passed.
  - Production `/api/public-config` readback on `127.0.0.1:8787` returned
    `clientBuildId=0.1.11|codex-mobile-shell-v494` and
    `shellCacheName=codex-mobile-shell-v494`.
  - Source/production SHA parity verified for the autonomous return service,
    task-card service, server wiring, MCP/script return paths, cross-thread
    docs, and focused tests.
- Privacy:
  - Evidence is bounded to ids, statuses, short titles/summaries, workflow/thread
    ids, terminal flag, ack policy, test counts, build ids, and short hashes. No
    card body, prompt/completion, upload, screenshot, cookie, launch token,
    access key, provider payload, database row, or long log was copied.

## 2026-06-26 - v495 projection miss reason diagnostics deployed

- Latest code commit:
  - `ea15ad5 expose projection cache miss reasons`
- v495 change:
  - `adapters/thread-detail-projection-service.js` now exposes `lookup()` with
    bounded `missReason` values including `entry-missing`,
    `partial-not-allowed`, `signature-unavailable`,
    `static-signature-mismatch`, `dynamic-summary-stale`,
    `dynamic-resting-signature-mismatch`, and
    `dynamic-age-signature-mismatch`.
  - `adapters/thread-detail-projection-v4-service.js` forwards lookup through
    the v4 visible projection wrapper.
  - `adapters/thread-detail-read-orchestration-service.js` records
    `projectionMissReason` in `mobileDiagnostics.threadDetailTimings`.
  - Recent partial projection seed now removes unusable full disk cache entries
    when the full cache miss reason proves it is stale (`dynamic-summary-stale`
    or signature mismatch). Healthy full cache still blocks partial overwrite;
    partial recent windows remain memory-only and opt-in through `allowPartial`.
  - Static build/cache: `0.1.11|codex-mobile-shell-v495` /
    `codex-mobile-shell-v495`.
- Root-cause boundary:
  - Symptom/risk: after v494, large-session recent opens could show
    `projectionState=miss` without explaining whether the miss came from absent
    cache, partial rejection, stale summary, unavailable signature, or signature
    mismatch. Stale full disk cache could also be re-read after service restart.
  - Failing layer: server projection cache lookup and invalid full-cache
    lifecycle.
  - Invariant: projection miss diagnostics are bounded reason codes only; they
    do not include message bodies, task-card bodies, uploads, private paths,
    cookies, access keys, provider payloads, database rows, screenshots, or long
    logs.
  - Classification: Phase B root-cause evidence and cache lifecycle repair; no
    frontend hiding, forced refresh, duplicate suppression, or broad fallback
    was added.
- Validation:
  - Focused source suite passed:
    `test/thread-detail-projection-service.test.js`,
    `test/thread-detail-projection-v4-service.test.js`,
    `test/thread-detail-projection-result-service.test.js`,
    `test/thread-detail-performance-service.test.js`,
    `test/thread-detail-read-orchestration-service.test.js`,
    `test/thread-performance-metrics.test.js`, `test/mobile-viewport.test.js`,
    `test/thread-goal-service.test.js`, and
    `test/thread-task-card-route.test.js` (`78` tests before the
    dynamic-summary-stale cleanup addition; focused projection subset later
    passed `41` tests).
  - Full source `npm test` passed (`926` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Production deploy:
  - Deployed through Home AI central macOS plugin deploy path with reason
    `codex-mobile-projection-miss-reason-v495`.
  - Final backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260625T235007Z-plugin-codex-mobile-web-codex-mobile-projection-miss-reason-v495`
  - Production `/api/public-config` readback:
    `clientBuildId=0.1.11|codex-mobile-shell-v495`,
    `shellCacheName=codex-mobile-shell-v495`, `version=0.1.11`,
    `authRequired=true`.
  - Source/production SHA parity verified for README/docs, projection services,
    orchestration/performance services, server/static shell files, and focused
    tests touched by v495.
  - Production focused projection suite passed (`41` tests).
- Production observation:
  - Bounded live reads used authenticated local requests without printing the
    access key. Evidence included only thread-id hashes, rollout sizes,
    decisions, durations, and bounded diagnostics.
  - Four largest visible thread samples were read twice with `mode=recent`.
    One was already `projection-v4-dynamic` on the first read. The other three
    first returned `turns-list-initial` with `projectionState=miss`,
    `projectionMissReason` of `dynamic-summary-stale` or `entry-missing`,
    `projectionSeedStatus=seeded-partial`, `threadReadMs=0`; their second reads
    returned `projection-v4-partial`, `readDecision=projection-partial-hit`,
    `projectionSource=partial`, `partialKind=recent-window`, and
    `turnsListInitialMs=0`.
  - Thread-list cache after deploy showed a rebuild for the first request with
    a new parameter set and then `fallbackCacheDecision=hit`, `fallbackMs=0`,
    with build count/number unchanged on the repeated request.
- Release:
  - Public was not pushed for v495.
- Next suggested slice:
  - Continue Phase B with cold-start/restart observation after normal user
    traffic: if repeated first reads still show `dynamic-summary-stale`, inspect
    dynamic full projection persist timing and summary updated-at ownership. If
    projection hits are warm but the UI still appears slow, pivot to Phase A
    client render/patch ownership using `thread_detail_first_paint` and
    `thread_refresh_ms` diagnostics.

## 2026-06-26 - v496 thread refresh metadata effect plan deployed

- Latest code commit:
  - `81a8965 extract thread refresh metadata effect plan`
- v496 change:
  - Continued Phase A frontend render/patch ownership convergence.
  - `public/thread-detail-render-plan.js` now includes ordered
    `metadataEffects` in `planThreadDetailRefreshOutcomeExecution()`.
  - `local-patch` refresh effects are limited to current-thread header,
    tick timer, and plugin navigation state updates.
  - `metadata-only` refresh effects are current-thread header, live operation
    dock, tick timer, and scroll-button update scheduling.
  - `refreshCurrentThread()` now executes the helper-provided effect list
    instead of re-deciding the metadata side-effect combination from
    `metadataUpdateMode`. Unknown effect names fail fast with a bounded error
    instead of being silently ignored.
  - Static build/cache: `0.1.11|codex-mobile-shell-v496` /
    `codex-mobile-shell-v496`.
- Root-cause boundary:
  - Symptom/risk: Phase A had already moved render/patch/outcome/performance
    planning out of `refreshCurrentThread()`, but metadata-only and local-patch
    side-effect combinations were still inline in app code. That made future
    fixes for flicker, missing messages, duplicate messages, and operation dock
    state more likely to re-scatter ownership.
  - Failing layer: frontend thread-detail refresh outcome execution ownership.
  - Classification: root-cause architecture boundary cleanup. No server
    projection change, frontend duplicate hiding, forced refresh, skipped
    refresh, task-card protocol change, or diagnostic-transport fallback was
    added.
- Validation:
  - Focused source suite passed:
    `test/thread-detail-render-plan.test.js`, `test/conversation-render.test.js`,
    `test/mobile-viewport.test.js`, `test/thread-goal-service.test.js`, and
    `test/thread-task-card-route.test.js` (`43` tests in the first subset;
    `129`/`144` tests in later render/production subsets).
  - Full source `npm test` passed (`926` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Production deploy:
  - Deployed through Home AI central macOS plugin deploy path with reason
    `codex-mobile-thread-refresh-metadata-effect-v496`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260626T000108Z-plugin-codex-mobile-web-codex-mobile-thread-refresh-metadata-effect-v496`
  - Production `/api/public-config` readback:
    `clientBuildId=0.1.11|codex-mobile-shell-v496`,
    `shellCacheName=codex-mobile-shell-v496`, `version=0.1.11`,
    `authRequired=true`.
  - Production focused suite passed (`144` tests).
  - Source/production SHA parity verified for README/docs, app/static shell,
    render-plan helper, and focused tests touched by v496.
- Browser/visual note:
  - Attempted to connect the in-app Browser plugin for a light visual readback,
    but the available `node_repl` tool failed before browser setup with an
    internal sandbox cwd metadata error. No visual/browser evidence was claimed
    for v496.
- Privacy:
  - Evidence recorded only statuses, build ids, test counts, bounded deploy
    metadata, and short hashes. No message bodies, task-card bodies, uploads,
    private paths, cookies, access keys, provider payloads, database rows,
    screenshots, or long logs were copied into docs or handoff.
- Release:
  - Public was not pushed for v496.
- Next suggested slice:
  - Continue Phase A by extracting the remaining `refreshCurrentThread()`
    surface execution/orchestration boundaries, especially the tile-vs-single
    patch attempt result shape and scroll/render side-effect execution. If
    live diagnostics instead show server cold-path misses, pivot back to Phase B
    with current `projectionMissReason` evidence.

## 2026-06-26 - v497 thread refresh patch attempt result plan deployed

- Latest code commit:
  - `db4688c extract thread refresh patch attempt result plan`
- v497 change:
  - Continued Phase A frontend render/patch ownership convergence.
  - `public/thread-detail-render-plan.js` now owns
    `planThreadDetailRefreshPatchAttemptResult()`, which normalizes
    tile-pane patch success, single-thread local-patch success, local-patch
    rejection, metadata-only tile misses, and the final result shape passed to
    `finalizeThreadDetailRenderPlan()`.
  - `refreshCurrentThread()` now computes the tile/single patch execution plan
    once, attempts tile-pane patch and local patch through a shared branch, and
    delegates patch-result interpretation plus local-patch rejection diagnostic
    intent to the helper.
  - Static build/cache: `0.1.11|codex-mobile-shell-v497` /
    `codex-mobile-shell-v497`.
- Root-cause boundary:
  - Symptom/risk: after v496, metadata side effects had been moved out of
    `refreshCurrentThread()`, but the patch-attempt result interpretation still
    lived inline in app code with separate render-detail and metadata-only
    branches. That made tile-pane patch, local-patch rejection, and
    metadata-only tile-miss behavior easier to diverge.
  - Failing layer: frontend thread-detail refresh patch-attempt ownership.
  - Classification: root-cause architecture boundary cleanup. No server
    projection change, frontend duplicate hiding, forced refresh, skipped
    refresh, task-card protocol change, or diagnostic-transport fallback was
    added.
- Validation:
  - Focused source suite passed:
    `test/thread-tile-layout-ui.test.js`,
    `test/thread-detail-render-plan.test.js`,
    `test/conversation-render.test.js`, and `test/mobile-viewport.test.js`
    (`135` tests).
  - Full source `npm test` passed (`929` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Production deploy:
  - Deployed through Home AI central macOS plugin deploy path with reason
    `codex-mobile-thread-refresh-patch-attempt-v497`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260626T001301Z-plugin-codex-mobile-web-codex-mobile-thread-refresh-patch-attempt-v497`
  - Production `/api/public-config` readback:
    `clientBuildId=0.1.11|codex-mobile-shell-v497`,
    `shellCacheName=codex-mobile-shell-v497`, `version=0.1.11`,
    `authRequired=true`.
  - Production focused suite passed (`150` tests).
  - Source/production SHA parity verified for README/docs, app/static shell,
    render-plan helper, and focused tests touched by v497.
- Privacy:
  - Evidence recorded only statuses, build ids, test counts, bounded deploy
    metadata, and short hashes. No message bodies, task-card bodies, uploads,
    private paths, cookies, access keys, provider payloads, database rows,
    screenshots, or long logs were copied into docs or handoff.
- Release:
  - Public was not pushed for v497.
- Next suggested slice:
  - Continue Phase A by extracting the remaining `refreshCurrentThread()`
    scroll/render side-effect execution boundaries, or pivot to Phase B if live
    diagnostics show server cold-path projection misses instead of client
    patch/render ownership issues.

## 2026-06-26 - v498 thread refresh execution action plan deployed

- Latest code commit:
  - `190e615 extract thread refresh execution action plan`
- v498 change:
  - Continued Phase A frontend render/patch ownership convergence.
  - `public/thread-detail-render-plan.js` now makes
    `planThreadDetailRefreshOutcomeExecution()` return explicit
    `executionAction` and `timingTarget` fields.
  - `executionAction=metadata-effects` drives the planned metadata effect
    sequence, `executionAction=full-render` drives `renderCurrentThread()`, and
    `executionAction=none` covers terminal tile-pane patch outcomes that need
    no additional DOM write.
  - `refreshCurrentThread()` no longer infers the execution branch from
    `metadataEffects.length` or `runFullRender`; unknown execution actions and
    empty metadata-effect action plans fail fast with bounded errors.
  - Static build/cache: `0.1.11|codex-mobile-shell-v498` /
    `codex-mobile-shell-v498`.
- Root-cause boundary:
  - Symptom/risk: after v497, patch-attempt result interpretation was
    service-owned, but outcome execution still used an implicit branch in app
    code based on metadata effect array length versus full-render flags. That
    made metadata-only, local patch, full render, and terminal tile-pane patch
    execution easier to diverge again.
  - Failing layer: frontend thread-detail refresh outcome execution action
    ownership.
  - Classification: root-cause architecture boundary cleanup. No server
    projection change, frontend duplicate hiding, forced refresh, skipped
    refresh, task-card protocol change, diagnostic-transport fallback, or visual
    layout change was added.
- Validation:
  - Focused source suite passed:
    `test/thread-detail-render-plan.test.js`,
    `test/conversation-render.test.js`, `test/mobile-viewport.test.js`,
    `test/thread-goal-service.test.js`, `test/thread-task-card-route.test.js`,
    and `test/thread-tile-layout-ui.test.js` (`150` tests).
  - Full source `npm test` passed (`929` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Production deploy:
  - Deployed through Home AI central macOS plugin deploy path with reason
    `codex-mobile-thread-refresh-execution-action-v498`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260626T001939Z-plugin-codex-mobile-web-codex-mobile-thread-refresh-execution-action-v498`
  - Production `/api/public-config` readback:
    `clientBuildId=0.1.11|codex-mobile-shell-v498`,
    `shellCacheName=codex-mobile-shell-v498`, `version=0.1.11`,
    `authRequired=true`.
  - Production focused suite passed (`150` tests).
  - Source/production SHA parity verified for README/docs, app/static shell,
    render-plan helper, and focused tests touched by v498.
- Privacy:
  - Evidence recorded only statuses, build ids, test counts, bounded deploy
    metadata, and short hashes. No message bodies, task-card bodies, uploads,
    private paths, cookies, access keys, provider payloads, database rows,
    screenshots, or long logs were copied into docs or handoff.
- Release:
  - Public was not pushed for v498.
- Next suggested slice:
  - Continue Phase A by extracting the remaining `refreshCurrentThread()`
    patch attempt execution timing/diagnostic accounting, or pivot to Phase B
    if production diagnostics show server cold-path projection misses rather
    than client render/patch ownership issues.

## 2026-06-26 - v499 thread refresh patch telemetry plan deployed

- Latest code commit:
  - `506f424 extract thread refresh patch telemetry plan`
- v499 change:
  - Continued Phase A frontend render/patch ownership convergence.
  - `public/thread-detail-render-plan.js`
    `planThreadDetailRefreshPatchAttemptResult()` now also owns patch telemetry
    selection for `detailPatchMs`, `patchTimingSource`, and normalized
    `patchRejectReason`.
  - `refreshCurrentThread()` now only measures the concrete tile/local DOM patch
    attempts and passes those bounded durations into the helper. The helper
    decides whether tile timing, local timing, or no patch timing belongs in
    `thread_refresh_ms`.
  - Local patch rejected reason is normalized and bounded by the helper before
    app code passes it to the existing bounded projection-mismatch diagnostic.
  - Static build/cache: `0.1.11|codex-mobile-shell-v499` /
    `codex-mobile-shell-v499`.
- Root-cause boundary:
  - Symptom/risk: after v498, app code no longer inferred refresh execution
    action, but it still owned patch telemetry accounting. That left
    `detailPatchMs` and local rejection reason selection beside real DOM calls,
    making performance and diagnostic payloads easier to diverge from patch
    result policy.
  - Failing layer: frontend thread-detail refresh patch telemetry ownership.
  - Classification: root-cause architecture boundary cleanup. No server
    projection change, frontend duplicate hiding, forced refresh, skipped
    refresh, task-card protocol change, diagnostic-transport fallback, or visual
    layout change was added.
- Validation:
  - Focused source suite passed:
    `test/thread-detail-render-plan.test.js`,
    `test/conversation-render.test.js`, `test/mobile-viewport.test.js`,
    `test/thread-goal-service.test.js`, `test/thread-task-card-route.test.js`,
    and `test/thread-tile-layout-ui.test.js` (`151` tests).
  - Full source `npm test` passed (`930` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Production deploy:
  - Deployed through Home AI central macOS plugin deploy path with reason
    `codex-mobile-thread-refresh-patch-telemetry-v499`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260626T002654Z-plugin-codex-mobile-web-codex-mobile-thread-refresh-patch-telemetry-v499`
  - Production `/api/public-config` readback:
    `clientBuildId=0.1.11|codex-mobile-shell-v499`,
    `shellCacheName=codex-mobile-shell-v499`, `version=0.1.11`,
    `authRequired=true`.
  - Production focused suite passed (`151` tests).
  - Source/production SHA parity verified for README/docs, app/static shell,
    render-plan helper, and focused tests touched by v499.
- Privacy:
  - Evidence recorded only statuses, build ids, test counts, bounded deploy
    metadata, and short hashes. No message bodies, task-card bodies, uploads,
    private paths, cookies, access keys, provider payloads, database rows,
    screenshots, or long logs were copied into docs or handoff.
- Release:
  - Public was not pushed for v499.
- Next suggested slice:
  - Continue Phase A by extracting projection-consistency check planning or
    refresh performance payload assembly boundaries from `refreshCurrentThread()`.
    If production diagnostics instead show server cold-path projection misses,
    pivot to Phase B with current `projectionMissReason` evidence.

## 2026-06-26 - v500 thread refresh consistency check plan deployed

- Latest code commit:
  - `45c4f33 extract thread refresh consistency check plan`
- v500 change:
  - Continued Phase A frontend render/patch ownership convergence.
  - `public/thread-detail-render-plan.js` now owns projection-consistency check
    planning through `planThreadDetailRefreshConsistencyCheck()`.
  - `planThreadDetailRefreshOutcomeExecution()` returns a structured
    `consistencyCheck` object with `shouldCheck`, bounded `phase`,
    `renderMode`, and reason.
  - `refreshCurrentThread()` no longer derives the consistency-check branch
    directly from `executionPlan.projectionConsistencyPhase`; it only invokes
    the existing real `checkConversationProjectionConsistency()` call when the
    helper-planned `consistencyCheck.shouldCheck` is true.
  - Full-render refreshes still explicitly use the `refresh-full-render`
    consistency phase, now planned by the helper.
  - Static build/cache: `0.1.11|codex-mobile-shell-v500` /
    `codex-mobile-shell-v500`.
- Root-cause boundary:
  - Symptom/risk: after v498/v499, app code no longer owned execution-action
    branching or patch telemetry selection, but it still owned
    projection-consistency check condition and render-mode wiring. That kept one
    more refresh-state branch embedded in `public/app.js`.
  - Failing layer: frontend thread-detail refresh consistency-check ownership.
  - Classification: root-cause architecture boundary cleanup. No server
    projection change, frontend duplicate hiding, forced refresh, skipped
    refresh, task-card protocol change, diagnostic-transport fallback, or
    visual layout change was added.
- Validation:
  - Focused source suite passed:
    `test/thread-detail-render-plan.test.js`,
    `test/conversation-render.test.js`, `test/mobile-viewport.test.js`,
    `test/thread-goal-service.test.js`, `test/thread-task-card-route.test.js`,
    and `test/thread-tile-layout-ui.test.js` (`152` tests).
  - Full source `npm test` passed (`931` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Production deploy:
  - Deployed through Home AI central macOS plugin deploy path with reason
    `codex-mobile-thread-refresh-consistency-check-v500`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260626T003458Z-plugin-codex-mobile-web-codex-mobile-thread-refresh-consistency-check-v500`
  - Production `/api/public-config` readback:
    `clientBuildId=0.1.11|codex-mobile-shell-v500`,
    `shellCacheName=codex-mobile-shell-v500`, `version=0.1.11`,
    `authRequired=true`.
  - Production focused suite passed (`152` tests).
  - Source/production SHA parity verified for README/docs, app/static shell,
    render-plan helper, and focused tests touched by v500.
- Privacy:
  - Evidence recorded only statuses, build ids, test counts, bounded deploy
    metadata, and short hashes. No message bodies, task-card bodies, uploads,
    private paths, cookies, access keys, provider payloads, database rows,
    screenshots, or long logs were copied into docs or handoff.
- Release:
  - Public was not pushed for v500.
- Next suggested slice:
  - Continue Phase A by extracting refresh performance payload assembly or
    scroll/render side-effect ownership from `refreshCurrentThread()`. If live
    diagnostics show remaining slow-path misses are server cold-path rather
    than client render/patch ownership, pivot to Phase B with current
    `projectionMissReason` and `thread_refresh_ms` evidence.

## 2026-06-26 - v501 thread refresh performance input plan deployed

- Latest code commit:
  - `998b668 extract thread refresh performance input plan`
- v501 change:
  - Continued Phase A frontend render/patch ownership convergence.
  - `public/thread-detail-render-plan.js` now owns refresh performance input
    assembly through `planThreadDetailRefreshPerformanceInput()`.
  - The helper combines measured timings with `renderPlan`, `renderOutcome`,
    and `patchAttemptResult`, deriving `detailRenderMode`,
    `refreshRenderAction`, `detailPatchMs`, `patchRejectReason`, skip flags,
    and patch success flags outside `public/app.js`.
  - `refreshCurrentThread()` no longer keeps performance-only
    `detailRenderMode`, `refreshRenderAction`, or `detailPatchMs` variables. It
    still owns real measurement of elapsed durations and passes those bounded
    values into the helper.
  - `public/thread-performance-metrics.js` remains the final bounded event
    field builder for `thread_refresh_ms`.
  - Static build/cache: `0.1.11|codex-mobile-shell-v501` /
    `codex-mobile-shell-v501`.
- Root-cause boundary:
  - Symptom/risk: after v499/v500, patch telemetry and consistency-check
    branching were helper-owned, but app code still hand-built the performance
    input object. That kept render outcome, patch result, and
    `thread_refresh_ms` diagnostic field selection partially duplicated in the
    app state machine.
  - Failing layer: frontend thread-detail refresh performance-input ownership.
  - Classification: root-cause architecture boundary cleanup. No server
    projection change, frontend duplicate hiding, forced refresh, skipped
    refresh, task-card protocol change, diagnostic-transport fallback, or visual
    layout change was added.
- Validation:
  - Focused source suite passed:
    `test/thread-detail-render-plan.test.js`,
    `test/conversation-render.test.js`, `test/mobile-viewport.test.js`,
    `test/thread-goal-service.test.js`, `test/thread-task-card-route.test.js`,
    and `test/thread-tile-layout-ui.test.js` (`153` tests).
  - Full source `npm test` passed (`932` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Production deploy:
  - Deployed through Home AI central macOS plugin deploy path with reason
    `codex-mobile-thread-refresh-performance-input-v501`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260626T004229Z-plugin-codex-mobile-web-codex-mobile-thread-refresh-performance-input-v501`
  - Production `/api/public-config` readback:
    `clientBuildId=0.1.11|codex-mobile-shell-v501`,
    `shellCacheName=codex-mobile-shell-v501`, `version=0.1.11`,
    `authRequired=true`.
  - Production focused suite passed (`153` tests).
  - Source/production SHA parity verified for README/docs, app/static shell,
    render-plan helper, and focused tests touched by v501.
- Privacy:
  - Evidence recorded only statuses, build ids, test counts, bounded deploy
    metadata, and short hashes. No message bodies, task-card bodies, uploads,
    private paths, cookies, access keys, provider payloads, database rows,
    screenshots, or long logs were copied into docs or handoff.
- Release:
  - Public was not pushed for v501.
- Next suggested slice:
  - Continue Phase A by extracting scroll/render side-effect ownership from
    `refreshCurrentThread()` into a pure plan, or pivot to Phase B if fresh
    diagnostics show server cold-path misses rather than client refresh
    ownership issues.

## 2026-06-26 - v502 thread refresh completion effects plan deployed

- Latest code commit:
  - `8140fcc extract thread refresh completion effects plan`
- v502 change:
  - Continued Phase A frontend render/patch ownership convergence.
  - `public/thread-detail-render-plan.js` now owns refresh completion
    side-effect planning through `planThreadDetailRefreshCompletionEffects()`.
  - The helper emits the existing refresh-success effects: clear
    `thread_detail_refresh_failed` diagnostic state, schedule usage-backfill
    refresh, and schedule live polling.
  - `public/app.js` now executes those planned effects through
    `applyThreadDetailRefreshCompletionEffect()` instead of hard-coding the
    success diagnostic payload and scheduler calls at the end of
    `refreshCurrentThread()`.
  - Static build/cache: `0.1.11|codex-mobile-shell-v502` /
    `codex-mobile-shell-v502`.
- Root-cause boundary:
  - Symptom/risk: after v499-v501, patch telemetry, consistency-check, and
    performance-input ownership had moved into helpers, but the refresh
    completion tail still directly selected diagnostic/scheduler side effects
    inside `refreshCurrentThread()`.
  - Failing layer: frontend thread-detail refresh completion side-effect
    ownership.
  - Classification: root-cause architecture boundary cleanup. No server
    projection change, frontend duplicate hiding, forced refresh, skipped
    refresh, task-card protocol change, diagnostic-transport fallback, polling
    cadence change, usage-backfill behavior change, or visual layout change was
    added.
- Validation:
  - Focused source suite passed:
    `test/thread-detail-render-plan.test.js`,
    `test/conversation-render.test.js`, `test/mobile-viewport.test.js`,
    `test/thread-goal-service.test.js`, `test/thread-task-card-route.test.js`,
    and `test/thread-tile-layout-ui.test.js` (`154` tests).
  - Full source `npm test` passed (`933` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Production deploy:
  - Deployed through Home AI central macOS plugin deploy path with reason
    `codex-mobile-thread-refresh-completion-effects-v502`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260626T004837Z-plugin-codex-mobile-web-codex-mobile-thread-refresh-completion-effects-v502`
  - Production `/api/public-config` readback:
    `clientBuildId=0.1.11|codex-mobile-shell-v502`,
    `shellCacheName=codex-mobile-shell-v502`, `version=0.1.11`,
    `authRequired=true`.
  - Production focused suite passed (`154` tests).
  - Source/production SHA parity verified for README/docs, app/static shell,
    render-plan helper, and focused tests touched by v502.
- Privacy:
  - Evidence recorded only statuses, build ids, test counts, bounded deploy
    metadata, and short hashes. No message bodies, task-card bodies, uploads,
    private paths, cookies, access keys, provider payloads, database rows,
    screenshots, or long logs were copied into docs or handoff.
- Release:
  - Public was not pushed for v502.
- Next suggested slice:
  - Continue Phase A by extracting the refresh failure diagnostic payload from
    the `refreshCurrentThread()` catch path into the diagnostic/planning helper,
    or pivot to Phase B if fresh production diagnostics show server cold-path
    misses instead of client refresh ownership issues.

## 2026-06-26 - v503 thread refresh failure diagnostic event deployed

- Latest code commit:
  - `b84ccdb extract thread refresh failure diagnostic event`
- v503 change:
  - Continued Phase A frontend thread-detail ownership convergence.
  - `public/thread-diagnostic-events.js` now owns
    `threadDetailRefreshFailedDiagnosticEvent()`, which builds the bounded
    `thread_detail_refresh_failed` Home AI diagnostic payload.
  - `refreshCurrentThread()` catch path now only extracts the real error code,
    duration bucket, status code, and thread hash, then delegates category,
    diagnostic type, severity, context, counts, and breadcrumbs to the helper.
  - Static build/cache: `0.1.11|codex-mobile-shell-v503` /
    `codex-mobile-shell-v503`.
- Root-cause boundary:
  - Symptom/risk: v502 moved successful refresh completion effects out of
    `refreshCurrentThread()`, but refresh failure diagnostic payload ownership
    still lived inside the app state machine.
  - Failing layer: frontend thread-detail refresh failure diagnostic ownership.
  - Classification: root-cause architecture boundary cleanup. No refresh
    request/mode/abort behavior, error rethrow behavior, diagnostic transport,
    server projection, DOM patch, task-card protocol, visual layout, or
    duplicate-hiding fallback changed.
- Validation:
  - Focused source suite passed:
    `test/thread-diagnostic-events.test.js`, `test/conversation-render.test.js`,
    `test/mobile-viewport.test.js`, `test/thread-goal-service.test.js`,
    `test/thread-task-card-route.test.js`, and
    `test/thread-tile-layout-ui.test.js` (`136` tests).
  - Full source `npm test` passed (`935` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Production deploy:
  - Deployed through Home AI central macOS plugin deploy path with reason
    `codex-mobile-thread-refresh-failure-diagnostic-v503`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260626T005604Z-plugin-codex-mobile-web-codex-mobile-thread-refresh-failure-diagnostic-v503`
  - Production `/api/public-config` readback:
    `clientBuildId=0.1.11|codex-mobile-shell-v503`,
    `shellCacheName=codex-mobile-shell-v503`, `version=0.1.11`,
    `authRequired=true`.
  - Production focused suite passed (`136` tests).
  - Source/production SHA parity verified for README/docs, app/static shell,
    diagnostic helper, and focused tests touched by v503.
- Privacy:
  - Evidence recorded only statuses, build ids, test counts, bounded deploy
    metadata, and short hashes. No message bodies, task-card bodies, uploads,
    private paths, cookies, access keys, provider payloads, database rows,
    screenshots, or long logs were copied into docs or handoff.
- Release:
  - Public was not pushed for v503.
- Next suggested slice:
  - Continue Phase A by extracting refresh request/mode/abort planning from
    `refreshCurrentThread()`, then move toward scroll/render side-effect
    ownership. If fresh production diagnostics show server cold-path misses,
    pivot to Phase B with current `thread_refresh_ms` and projection miss
    evidence.

## 2026-06-26 - v504 thread refresh request plan deployed

- Latest code commit:
  - `18ac01d extract thread refresh request plan`
- v504 change:
  - Continued Phase A frontend thread-detail ownership convergence.
  - `public/thread-detail-render-plan.js` now owns
    `planThreadDetailRefreshRequest()`.
  - The helper decides whether a current-thread refresh should run, snapshots
    thread id and load sequence, normalizes recent/full mode, selects the API
    query and timeout, and records whether an active refresh controller should
    be aborted.
  - `refreshCurrentThread()` now executes this plan instead of owning mode
    selection, `mode=recent` query construction, timeout selection, and
    active-controller abort intent directly.
  - Static build/cache: `0.1.11|codex-mobile-shell-v504` /
    `codex-mobile-shell-v504`.
- Root-cause boundary:
  - Symptom/risk: after v503, refresh failure diagnostics were helper-owned,
    but request/mode/abort planning still lived directly inside the app state
    machine, keeping one more refresh branch untestable outside `public/app.js`.
  - Failing layer: frontend thread-detail refresh request/abort planning
    ownership.
  - Classification: root-cause architecture boundary cleanup. No request URL
    semantics, timeout value, real AbortController side effect, error handling,
    server projection, DOM patch, task-card protocol, diagnostic transport,
    visual layout, or duplicate-hiding fallback changed.
- Validation:
  - Focused source suite passed:
    `test/thread-detail-render-plan.test.js`, `test/conversation-render.test.js`,
    `test/mobile-viewport.test.js`, `test/thread-goal-service.test.js`,
    `test/thread-task-card-route.test.js`, and
    `test/thread-tile-layout-ui.test.js` (`157` tests).
  - Full source `npm test` passed (`937` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Production deploy:
  - Deployed through Home AI central macOS plugin deploy path with reason
    `codex-mobile-thread-refresh-request-plan-v504`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260626T010206Z-plugin-codex-mobile-web-codex-mobile-thread-refresh-request-plan-v504`
  - Production `/api/public-config` readback:
    `clientBuildId=0.1.11|codex-mobile-shell-v504`,
    `shellCacheName=codex-mobile-shell-v504`, `version=0.1.11`,
    `authRequired=true`.
  - Production focused suite passed (`157` tests).
  - Source/production SHA parity verified for README/docs, app/static shell,
    render-plan helper, and focused tests touched by v504.
- Privacy:
  - Evidence recorded only statuses, build ids, test counts, bounded deploy
    metadata, and short hashes. No message bodies, task-card bodies, uploads,
    private paths, cookies, access keys, provider payloads, database rows,
    screenshots, or long logs were copied into docs or handoff.
- Release:
  - Public was not pushed for v504.
- Next suggested slice:
  - Continue Phase A by extracting the remaining scroll/render side-effect
    ownership from `refreshCurrentThread()` into a pure plan. If fresh
    production diagnostics show server cold-path misses, pivot to Phase B with
    current `thread_refresh_ms` and projection miss evidence.

## 2026-06-26 - v505 thread refresh patch surface plan deployed

- Latest code commit:
  - `ca6191e extract thread refresh patch surface plan`
- v505 change:
  - Continued Phase A frontend thread-detail ownership convergence.
  - `public/thread-detail-render-plan.js` now owns
    `planThreadDetailRefreshPatchSurface()`.
  - The helper decides whether refresh should probe tile-pane DOM state and
    whether the current refresh patch path is a tile surface, based on tile
    mode, tile conversation surface state, and the probed DOM patch surface.
  - `refreshCurrentThread()` now only reads current UI state, performs the real
    DOM surface probe, and passes the helper-planned `tileSurfaceRefresh` into
    patch execution planning. The old inline
    `tilePatchPlan.surface === "thread-tile-pane"` branch was removed from the
    app state machine.
  - Static build/cache: `0.1.11|codex-mobile-shell-v505` /
    `codex-mobile-shell-v505`.
- Root-cause boundary:
  - Symptom/risk: after v504, request/mode/abort planning was helper-owned,
    but tile/single patch surface selection still lived directly in
    `refreshCurrentThread()`, keeping surface ownership partly mixed with app
    orchestration.
  - Failing layer: frontend thread-detail refresh patch surface ownership.
  - Classification: root-cause architecture boundary cleanup. No DOM probe
    behavior, tile-pane patch behavior, single-thread patch behavior,
    full-render fallback, server projection, diagnostic transport,
    task-card protocol, visual layout, or duplicate-hiding fallback changed.
- Validation:
  - Focused source suite passed:
    `test/thread-detail-render-plan.test.js`, `test/conversation-render.test.js`,
    `test/mobile-viewport.test.js`, `test/thread-goal-service.test.js`,
    `test/thread-task-card-route.test.js`, and
    `test/thread-tile-layout-ui.test.js` (`159` tests).
  - Full source `npm test` passed (`939` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Production deploy:
  - Deployed through Home AI central macOS plugin deploy path with reason
    `codex-mobile-thread-refresh-patch-surface-v505`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260626T010854Z-plugin-codex-mobile-web-codex-mobile-thread-refresh-patch-surface-v505`
  - Production `/api/public-config` readback:
    `clientBuildId=0.1.11|codex-mobile-shell-v505`,
    `shellCacheName=codex-mobile-shell-v505`, `version=0.1.11`,
    `authRequired=true`.
  - Production focused suite passed (`159` tests).
  - Source/production SHA parity verified for README/docs, app/static shell,
    render-plan helper, and focused tests touched by v505.
- Privacy:
  - Evidence recorded only statuses, build ids, test counts, bounded deploy
    metadata, and short hashes. No message bodies, task-card bodies, uploads,
    private paths, cookies, access keys, provider payloads, database rows,
    screenshots, or long logs were copied into docs or handoff.
- Release:
  - Public was not pushed for v505.
- Next suggested slice:
  - Continue Phase A by extracting post-merge side-effect ordering or full-render
    execution side-effect planning from `refreshCurrentThread()`. If production
    diagnostics show server cold-path misses, pivot to Phase B with current
    `thread_refresh_ms` and projection miss evidence.

## 2026-06-26 - v506 thread refresh post-merge effects plan deployed

- Latest code commit:
  - `835bd65 extract thread refresh post-merge effects plan`
- v506 change:
  - Continued Phase A frontend thread-detail ownership convergence.
  - `public/thread-detail-render-plan.js` now owns
    `planThreadDetailRefreshPostMergeEffects()`.
  - The helper declares the fixed post-merge effect groups for current-thread
    refresh: thread-list merge, composer/settings plus active-turn sync, and
    thread-list render.
  - `refreshCurrentThread()` now executes those effect names through app-owned
    side-effect functions instead of inlining the order directly in the main
    refresh state machine.
  - Static build/cache: `0.1.11|codex-mobile-shell-v506` /
    `codex-mobile-shell-v506`.
- Root-cause boundary:
  - Symptom/risk: after v505, request, surface, patch, outcome, performance,
    completion, and failure-diagnostic planning were helper-owned, but the
    post-merge refresh side-effect order still lived directly in
    `refreshCurrentThread()`.
  - Failing layer: frontend thread-detail refresh post-merge side-effect
    ownership.
  - Classification: root-cause architecture boundary cleanup. No server
    projection change, DOM patch behavior, full-render fallback, scroll policy,
    diagnostic transport, task-card protocol, tile layout, duplicate hiding, or
    visual behavior change was added.
- Validation:
  - Focused source suite passed:
    `test/thread-detail-render-plan.test.js`, `test/conversation-render.test.js`,
    `test/mobile-viewport.test.js`, `test/thread-goal-service.test.js`,
    `test/thread-task-card-route.test.js`, and `test/thread-tile-layout-ui.test.js`
    (`160` tests).
  - Full source `npm test` passed (`940` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Production deploy:
  - Deployed through Home AI central macOS plugin deploy path with reason
    `codex-mobile-thread-refresh-post-merge-effects-v506`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260626T011817Z-plugin-codex-mobile-web-codex-mobile-thread-refresh-post-merge-effects-v506`
  - Production `/api/public-config` readback:
    `clientBuildId=0.1.11|codex-mobile-shell-v506`,
    `shellCacheName=codex-mobile-shell-v506`, `version=0.1.11`,
    `authRequired=true`.
  - Production focused suite passed (`160` tests).
  - Source/production SHA parity verified for README/docs, app/static shell,
    render-plan helper, and focused tests touched by v506.
- Privacy:
  - Evidence recorded only statuses, build ids, test counts, bounded deploy
    metadata, and short hashes. No message bodies, task-card bodies, uploads,
    private paths, cookies, access keys, provider payloads, database rows,
    screenshots, or long logs were copied into docs or handoff.
- Release:
  - Public was not pushed for v506.
- Progress:
  - Overall system-level architecture optimization is now estimated at about
    `67%`.
- Next suggested slice:
  - Continue Phase A by extracting full-render execution side-effect planning
    or scroll ownership from `refreshCurrentThread()`. If production
    diagnostics show server cold-path misses, pivot to Phase B with current
    `thread_refresh_ms` and projection miss evidence.

## 2026-06-26 - release cadence update

- User clarified the release cadence for the ongoing architecture optimization:
  small helper/refactor slices should not each deploy individually.
- Future Phase A/B/C/D/E optimization work should accumulate into a larger
  coherent module, run local focused/full checks, then deploy once when the
  module is complete enough for production validation.
- Public push remains after production/user validation only.
- For browser/runtime source edits inside an undeployed module, avoid needless
  per-slice shell/cache version churn; bump `CLIENT_BUILD_ID` and
  `public/sw.js` cache at the module deployment boundary.

## 2026-06-26 - local Phase A execution-effects slice validated, not deployed

- Latest code commit:
  - `302f705 extract thread refresh execution effects plan`
- Change:
  - Continued the Phase A `refreshCurrentThread()` orchestration cleanup as part
    of the next larger module, without deploying the small slice.
  - `public/thread-detail-render-plan.js` now owns
    `planThreadDetailRefreshExecutionEffects()`, mapping outcome execution
    actions to metadata-update, full-render, no-op, or bounded unknown effect
    entries.
  - `public/app.js` now executes that plan through
    `applyThreadDetailRefreshExecutionEffectsPlan()`, keeping the real DOM and
    metadata side effects in app code but removing direct
    `executionPlan.executionAction` branching from `refreshCurrentThread()`.
- Root-cause boundary:
  - Symptom/risk: after v506, outcome execution planning existed, but
    `refreshCurrentThread()` still directly branched on metadata/full-render
    execution actions and accumulated effect timings inline.
  - Failing layer: frontend thread-detail refresh execution-effect ownership.
  - Classification: root-cause architecture boundary cleanup. No server
    projection change, DOM patch algorithm change, full-render behavior change,
    scroll policy change, diagnostic transport change, task-card protocol
    change, visual layout change, duplicate hiding, fallback, or shell/cache
    version bump was added.
- Validation:
  - Focused source suite passed:
    `test/thread-detail-render-plan.test.js`, `test/conversation-render.test.js`,
    `test/mobile-viewport.test.js`, `test/thread-goal-service.test.js`,
    `test/thread-task-card-route.test.js`, and `test/thread-tile-layout-ui.test.js`
    (`161` tests).
  - Full source `npm test` passed (`941` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment:
  - Not deployed by design under the updated cadence. This slice is part of the
    next larger Phase A refresh orchestration module.
  - Production remains at `0.1.11|codex-mobile-shell-v506` until the module-level
    deploy.
- Sub-agent note:
  - A read-only sub-agent reviewed remaining Phase A candidates and recommended
    next focusing on post-merge runner consolidation, patch attempt execution,
    local DOM patch transaction ownership, and scroll snapshot/follow policy.
- Next suggested slice:
  - Continue locally with post-merge runner consolidation or patch-attempt
    executor planning. Deploy only after enough Phase A refresh orchestration
    cleanup is complete to form a coherent module.

## 2026-06-26 - local Phase A patch-attempt effects slice validated, not deployed

- Latest code commit:
  - `466ee32 extract thread refresh patch attempt effects plan`
- Change:
  - Continued local Phase A `refreshCurrentThread()` orchestration cleanup as
    part of the next larger module, without deploying this small slice.
  - `public/thread-detail-render-plan.js` now owns
    `planThreadDetailRefreshPatchAttemptEffects()`, which declares the ordered
    tile-pane and local-patch attempt effects.
  - `public/app.js` now executes that plan through
    `applyThreadDetailRefreshPatchAttemptEffectsPlan()`, keeping real DOM patch
    calls and timing in app code but removing direct tile/local patch attempt
    branching from `refreshCurrentThread()`.
  - Updated focused source-string tests so tile layout, conversation render, and
    mobile viewport coverage assert the new helper boundary rather than the old
    inline local-patch branch.
- Root-cause boundary:
  - Symptom/risk: after the execution-effects slice, `refreshCurrentThread()`
    still directly decided and timed tile-pane/local patch attempt order, keeping
    patch attempt ownership mixed into the app orchestration path.
  - Failing layer: frontend thread-detail refresh patch-attempt effect
    ownership.
  - Classification: root-cause architecture boundary cleanup. No server
    projection change, DOM patch algorithm change, full-render behavior change,
    scroll policy change, diagnostic transport change, task-card protocol
    change, visual layout change, duplicate hiding, fallback, shell/cache bump,
    deployment, or public push was added.
- Validation:
  - Focused source suite passed:
    `test/thread-detail-render-plan.test.js`, `test/conversation-render.test.js`,
    `test/mobile-viewport.test.js`, `test/thread-goal-service.test.js`,
    `test/thread-task-card-route.test.js`, and
    `test/thread-tile-layout-ui.test.js` (`163` tests).
  - Full source `npm test` passed (`943` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment:
  - Not deployed by design under the updated cadence. This slice is part of the
    next larger Phase A refresh orchestration module.
  - Production remains at `0.1.11|codex-mobile-shell-v506` until the module-level
    deploy.
- Sub-agent note:
  - The read-only sub-agent audit of the patch path completed without edits. It
    recommended the next module-internal candidates in this order:
    remove the global patch reject scratch state, extract local patch preflight
    planning, then move live-operation dock updates into a successful DOM patch
    transaction stage.
- Progress:
  - Overall system-level architecture optimization is now estimated at about
    `67.5%`, still in Phase A module assembly.
- Next suggested slice:
  - Remove `state.threadDetailPatchRejectReason` as global scratch by making the
    DOM patch helper return a structured `{ ok, reason }` result and passing
    that through the patch-attempt executor. Keep this local and undeployed
    until the Phase A module is ready for one deployment.

## 2026-06-26 - local Phase A patch reject scratch removal validated, not deployed

- Latest code commit:
  - `9a934fe remove thread detail patch reject scratch state`
- Change:
  - Removed `state.threadDetailPatchRejectReason` from the app state shape and
    refresh path.
  - `public/thread-detail-dom-patch.js` now exposes
    `threadDetailPatchResult()`, returning structured bounded `{ ok, reason }`
    patch status.
  - `patchCurrentThreadDetailFromRefresh()` now returns the structured patch
    result directly. The patch-attempt executor reads `ok` and `reason` from
    that result, and `refreshCurrentThread()` passes
    `patchAttempt.patchRejectReason` into
    `planThreadDetailRefreshPatchAttemptResult()`.
  - Source-string tests now assert the old global scratch key is absent from
    `public/app.js`.
- Root-cause boundary:
  - Symptom/risk: local DOM patch rejection reasons were written to transient
    global app state, then read back later by the refresh orchestration path.
    That made a single patch attempt's result depend on cross-function mutable
    state instead of an explicit return value.
  - Failing layer: frontend thread-detail DOM patch result ownership.
  - Classification: root-cause architecture boundary cleanup. No server
    projection change, DOM patch algorithm change, visual layout change, scroll
    policy change, diagnostic transport change, task-card protocol change,
    fallback, shell/cache bump, deployment, or public push was added.
- Validation:
  - Focused source suite passed:
    `test/thread-detail-dom-patch.test.js`,
    `test/thread-detail-render-plan.test.js`, `test/conversation-render.test.js`,
    `test/mobile-viewport.test.js`, and `test/thread-tile-layout-ui.test.js`
    (`182` tests).
  - Full source `npm test` passed (`944` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment:
  - Not deployed by design under the updated cadence. This slice is part of the
    next larger Phase A refresh orchestration module.
  - Production remains at `0.1.11|codex-mobile-shell-v506` until the module-level
    deploy.
- Progress:
  - Overall system-level architecture optimization is now estimated at about
    `68%`, still in Phase A module assembly.
- Next suggested slice:
  - Extract local patch preflight decisions out of `public/app.js` into a
    focused planner, then move live-operation dock updates into the successful
    DOM patch transaction stage. Keep both local until the Phase A module-level
    deploy boundary.

## 2026-06-26 - local Phase A local patch preflight planner validated, not deployed

- Latest code commit:
  - `a7d9f42 extract local patch preflight planning`
- Change:
  - `public/thread-detail-patch-plan.js` now owns
    `planThreadDetailRefreshLocalPatchPreflight()`.
  - The helper classifies missing conversation root, missing thread,
    root-ready, tile-pane terminal success, single-thread surface unavailable,
    loading/error state, rendered DOM stale, patch-shell changed, and
    preflight-passed outcomes.
  - `patchCurrentThreadDetailFromRefresh()` now delegates deterministic
    preflight decisions to the helper while still performing real root lookup,
    tile-pane patch attempt, signature calculation, and DOM mutation in app
    code.
  - The implementation preserves the previous tile-pane priority: root/thread
    validity is checked first, then the real tile-pane patch attempt can
    terminate before single-thread local patch checks run.
- Root-cause boundary:
  - Symptom/risk: deterministic local patch rejection rules were still embedded
    in `public/app.js`, making patch policy, telemetry reasons, and tests more
    likely to drift from helper-owned render planning.
  - Failing layer: frontend thread-detail local patch preflight ownership.
  - Classification: root-cause architecture boundary cleanup. No server
    projection change, DOM mutation algorithm change, visual layout change,
    scroll policy change, diagnostic transport change, task-card protocol
    change, fallback, shell/cache bump, deployment, or public push was added.
- Validation:
  - Focused source suite passed:
    `test/thread-detail-patch-plan.test.js`,
    `test/thread-detail-dom-patch.test.js`, `test/conversation-render.test.js`,
    `test/mobile-viewport.test.js`, `test/thread-detail-render-plan.test.js`,
    and `test/thread-tile-layout-ui.test.js` (`191` tests).
  - Full source `npm test` passed (`946` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment:
  - Not deployed by design under the updated cadence. This slice is part of the
    next larger Phase A refresh orchestration module.
  - Production remains at `0.1.11|codex-mobile-shell-v506` until the module-level
    deploy.
- Progress:
  - Overall system-level architecture optimization is now estimated at about
    `69%`, still in Phase A module assembly.
- Next suggested slice:
  - Move `updateLiveOperationDockHtml()` and follow-up bind/complete operations
    into a successful local DOM patch transaction stage so failed turn patches
    cannot partially update live-operation dock state before rejecting.

## 2026-06-26 - local Phase A local patch transaction effects validated, not deployed

- Latest code commit:
  - `39479b7 gate local patch success effects in transaction`
- Change:
  - `public/thread-detail-dom-patch.js` now exposes
    `applyThreadDetailPatchTransaction()`.
  - The transaction runner executes the core turn DOM patch first. It only runs
    success effects after the core patch returns `ok`.
  - `patchCurrentThreadDetailFromRefresh()` now passes the turn patch as
    `applyPatch` and moves operation-dock refresh, action rebinding, and local
    DOM completion into `afterSuccess`.
  - This specifically prevents failed turn patches from first updating the live
    operation dock and then rejecting, which could briefly leave operation dock
    state ahead of the conversation DOM/signature.
- Root-cause boundary:
  - Symptom/risk: the live operation dock was updated before the core local
    turn DOM patch. If the core patch failed, the dock could represent the new
    thread state while the conversation DOM stayed old.
  - Failing layer: frontend thread-detail local DOM patch transaction ordering.
  - Classification: root-cause architecture boundary cleanup. No server
    projection change, core DOM patch algorithm change, visual layout change,
    scroll policy change, diagnostic transport change, task-card protocol
    change, fallback, shell/cache bump, deployment, or public push was added.
- Validation:
  - Focused source suite passed:
    `test/thread-detail-dom-patch.test.js`,
    `test/thread-detail-patch-plan.test.js`, `test/conversation-render.test.js`,
    `test/mobile-viewport.test.js`, `test/thread-detail-render-plan.test.js`,
    and `test/thread-tile-layout-ui.test.js` (`193` tests).
  - Full source `npm test` passed (`948` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment:
  - Not deployed by design under the updated cadence. This slice is part of the
    next larger Phase A refresh orchestration module.
  - Production remains at `0.1.11|codex-mobile-shell-v506` until the module-level
    deploy.
- Progress:
  - Overall system-level architecture optimization is now estimated at about
    `70%`, still in Phase A module assembly.
- Next suggested slice:
  - Continue with scroll snapshot/follow ownership: make local patch completion
    consume captured surface and scroll policy inputs more explicitly so
    post-patch surface probes cannot change single-thread versus tile completion
    semantics.

## 2026-06-26 - local Phase A local patch completion snapshot validated, not deployed

- Latest code commit:
  - `e40bbf7 capture local patch completion snapshot`
- Change:
  - `completeLocalConversationDomUpdate()` now accepts an explicit completion
    snapshot from the refresh path while preserving the old self-probing
    behavior for callers that do not pass one.
  - `patchCurrentThreadDetailFromRefresh()` captures single-thread completion,
    conversation render signature, patch-shell signature, and scroll-follow
    policy before the core DOM patch mutates the thread surface.
  - The successful local patch transaction now completes DOM state from that
    snapshot instead of re-probing tile/single surface and re-reading scroll
    policy after mutation.
- Root-cause boundary:
  - Symptom/risk: local patch completion could depend on post-patch app state,
    making completion semantics sensitive to tile/single surface probes or
    scroll policy reads that happened after the DOM had already changed.
  - Failing layer: frontend thread-detail local DOM patch completion and scroll
    ownership.
  - Classification: root-cause architecture boundary cleanup. No server
    projection change, core DOM patch algorithm change, visual layout change,
    diagnostic transport change, task-card protocol change, fallback,
    shell/cache bump, deployment, or public push was added.
- Validation:
  - Focused source suite passed:
    `test/conversation-render.test.js`, `test/mobile-viewport.test.js`,
    `test/thread-detail-dom-patch.test.js`, `test/conversation-scroll.test.js`,
    `test/thread-detail-render-plan.test.js`, and
    `test/thread-tile-layout-ui.test.js` (`192` tests).
  - Full source `npm test` passed (`948` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment:
  - Not deployed by design under the updated cadence. This slice remains part
    of the next larger Phase A refresh orchestration module.
  - Production remains at `0.1.11|codex-mobile-shell-v506` until the module-level
    deploy.
- Progress:
  - Overall system-level architecture optimization is now estimated at about
    `71%`, still in Phase A module assembly.
- Next suggested slice:
  - Review the accumulated Phase A local refresh orchestration commits as one
    module boundary, then either prepare a module-level deploy candidate or
    continue extracting the remaining refresh completion caller defaults into
    helper-owned policies before deployment.

## 2026-06-26 - local Phase A module review plus transaction hardening, not deployed

- Latest code commits:
  - `75ef961 extract patch attempt aggregation policy`
  - `b669b1e gate local patch post-commit effects`
- Review:
  - A read-only sub-agent review checked the recent Phase A local refresh /
    projection / DOM patch orchestration commits. It concluded that the module
    boundary is substantially formed, but should not yet be marked a deploy
    candidate because real refresh DOM paths still need stronger behavior-level
    coverage beyond source-shape assertions.
  - The review also identified a concrete transaction-order risk: success
    effects could partially update dock/action state before DOM completion
    failed.
- Changes:
  - `public/thread-detail-render-plan.js` now owns patch-attempt aggregation:
    the empty attempt state, effect-context derivation, and tile/local attempt
    reducer. `public/app.js` still performs the real DOM patch effects, but no
    longer owns timing/status/reject-reason accumulation rules.
  - `public/thread-detail-dom-patch.js` now separates local patch transaction
    stages into `commitEffects` and post-commit `afterSuccess` effects.
  - `patchCurrentThreadDetailFromRefresh()` now treats
    `completeLocalConversationDomUpdate()` as the commit gate. Operation-dock
    refresh and action rebinding run only after that gate succeeds.
- Root-cause boundary:
  - Symptom/risk: refresh patch-attempt aggregation and local transaction
    effect ordering were still partially owned by `public/app.js`, leaving
    timing/status flags and success-effect commit semantics coupled to the
    orchestration body.
  - Failing layer: frontend thread-detail local refresh orchestration and DOM
    patch transaction ownership.
  - Classification: root-cause architecture boundary cleanup. No server
    projection change, core DOM patch algorithm change, visual layout change,
    diagnostic transport change, task-card protocol change, fallback,
    shell/cache bump, deployment, or public push was added.
- Validation:
  - Patch-attempt aggregation focused suite passed:
    `test/thread-detail-render-plan.test.js`,
    `test/conversation-render.test.js`, `test/mobile-viewport.test.js`,
    `test/thread-detail-dom-patch.test.js`,
    `test/thread-detail-patch-plan.test.js`, and
    `test/thread-tile-layout-ui.test.js` (`196` tests).
  - Commit/post-commit transaction focused suite passed with the same coverage
    group (`197` tests).
  - Full source `npm test` passed after both slices (`951` tests after
    aggregation, `952` tests after transaction hardening).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment:
  - Not deployed by design under the updated cadence. These are still local
    Phase A module assembly commits.
  - Production remains at `0.1.11|codex-mobile-shell-v506` until a complete
    Phase A module deploy candidate is selected and validated.
- Progress:
  - Overall system-level architecture optimization is now estimated at about
    `72%`.
- Next suggested slice:
  - Add a behavior-level DOM harness for the refresh path that proves tile
    terminal success, single-thread local patch success, and local patch
    rejection -> full render behavior without relying only on `functionBody()`
    source-shape assertions. This should be the final evidence gate before
    deciding whether Phase A can become a module-level deploy candidate.

## 2026-06-26 - local Phase A refresh DOM behavior harness added, not deployed

- Latest code commit:
  - `47f6ea9 add refresh dom behavior harness`
- Change:
  - Added `test/thread-detail-refresh-dom-harness.test.js`.
  - The harness combines the real `thread-detail-render-plan`,
    `thread-detail-patch-plan`, and `thread-detail-dom-patch` helpers with a
    lightweight fake DOM instead of relying only on source-shape assertions.
  - It proves three Phase A refresh paths:
    - tile patch success is terminal and does not run full render;
    - single-thread local patch success updates DOM text and commits before
      operation-dock post-commit work;
    - local patch rejection records the bounded reject reason and routes to
      full render.
  - `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md` now records this behavior harness
    as the Phase A evidence gate.
- Root-cause boundary:
  - Symptom/risk: prior Phase A coverage proved many extracted helper policies
    and app orchestration shapes, but did not behaviorally exercise the
    refresh DOM path across tile success, local success, and local rejection.
  - Failing layer: frontend thread-detail refresh behavior validation boundary.
  - Classification: root-cause validation hardening. No runtime behavior,
    server projection, visual layout, diagnostic transport, task-card protocol,
    fallback, shell/cache bump, deployment, or public push was added.
- Validation:
  - Focused behavior suite passed:
    `test/thread-detail-refresh-dom-harness.test.js`,
    `test/thread-detail-dom-patch.test.js`,
    `test/thread-detail-render-plan.test.js`, and
    `test/thread-detail-patch-plan.test.js` (`87` tests).
  - Full source `npm test` passed (`955` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment:
  - Not deployed by design under the updated cadence. This is a local test /
    architecture evidence slice only.
  - Production remains at `0.1.11|codex-mobile-shell-v506` until a complete
    Phase A module deploy candidate is selected and validated.
- Progress:
  - Overall system-level architecture optimization is now estimated at about
    `73%`.
- Next suggested slice:
  - Do a Phase A module-candidate review against the original objectives:
    decide whether the local refresh/patch ownership work is now ready for a
    module-level deploy candidate, or whether one more behavior harness is
    needed around `refreshCurrentThread()` network/merge/full-render execution
    rather than helper-level DOM behavior.

## 2026-06-26 - urgent workflow-dominated first-paint history auto-backfill deployed

- Trigger:
  - User reported that the Home AI thread sometimes opened on mobile with only
    a Music task-card/receipt-like window and no visible historical context,
    while later the same thread could scroll to older history.
- Root-cause boundary:
  - Symptom: recent-mode first paint could be dominated by workflow/task-card
    receipt turns while the server response still exposed `mobileOlderTurnsCursor`.
  - Failing layer: frontend first-paint history-window policy. Existing
    top-scroll/button pagination worked, but it depended on user scroll intent
    and could leave a mobile first paint looking like history was missing.
  - Fix classification: root-cause policy repair. It does not delete/hide task
    cards, synthesize messages, force full thread reads, or mask projection
    mismatches.
- Changes:
  - `public/thread-detail-render-plan.js` now owns
    `planThreadDetailHistoryAutoBackfill()`, a pure bounded classifier for
    workflow-dominated recent windows with an older cursor.
  - `public/app.js` calls the classifier after cached-current and first-paint
    renders, records one bounded `thread_history_auto_backfill` event, and loads
    one older-history page through the existing cursor route with scroll
    preservation.
  - The shell/cache build was bumped to `codex-mobile-shell-v508`.
  - Docs/tests were updated in `docs/MODULES.md`,
    `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`,
    `test/thread-detail-render-plan.test.js`, `test/mobile-viewport.test.js`,
    `test/thread-goal-service.test.js`, and
    `test/thread-task-card-route.test.js`.
- Validation:
  - Focused: `node --test test/thread-detail-render-plan.test.js
    test/mobile-viewport.test.js test/conversation-render.test.js` passed
    (`152` tests).
  - Version/focused: `node --test test/thread-detail-render-plan.test.js
    test/mobile-viewport.test.js test/thread-task-card-route.test.js
    test/thread-goal-service.test.js` passed (`65` tests).
  - Full source `npm test` passed (`969` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment:
  - Code commit: `c159e76 fix workflow dominated thread first paint history`.
  - Deployed through the central Home AI plugin deploy path with reason
    `codex-mobile-history-auto-backfill-v508`.
  - Production readback returned `clientBuildId=0.1.11|codex-mobile-shell-v508`
    and `shellCacheName=codex-mobile-shell-v508`.
  - Source/production SHA-256 prefixes matched for `public/app.js`,
    `public/sw.js`, and `public/thread-detail-render-plan.js`.
  - Bounded production API shape check on the reported Home AI thread returned
    HTTP `200`, `readMode=turns-list-initial`, projection `v4`, `10` recent
    turns, both older/newer cursors present, and no current auto-backfill trigger
    because the current window is not workflow dominated.

## 2026-06-26 - v509 client turn-order diagnostic gap fix validated

- Trigger:
  - User reported that after v508, the Codex Mobile thread on phone still opened
    with an old long receipt visually stuck at the bottom while newer replies
    appeared above it, and asked why the automatic Home AI repair diagnostic did
    not trigger.
- Root-cause boundary:
  - Failing layer: frontend single-thread visible turn ordering and diagnostic
    coverage.
  - Server turn ordering already uses `startedAt` before `completedAt`.
    The client `turnOrderMs()` still preferred `completedAt`, so when a
    completed turn's completion timestamp tied the next active turn's start
    timestamp at second precision, the client could fall back to id ordering
    and place the newer active turn above the older completed receipt.
  - Existing `conversation_projection_mismatch` diagnostics checked render
    signatures and duplicate render keys. Those can remain internally
    consistent even when the client has sorted the DOM in the wrong order, so
    no automatic repair event was emitted for the semantic latest-turn-last
    invariant violation.
- Changes:
  - `public/app.js` now matches server started-at-first turn ordering.
  - `public/app.js` also compares expected visible turn id order against DOM
    turn id order after projection consistency checks.
  - `public/thread-diagnostic-events.js` now plans bounded
    `turn_order_mismatch` failure/success events with thread/turn hashes and
    order/latest mismatch counts only.
  - `public/home-ai-diagnostic-reporting.js` allows the new safe breadcrumb
    field names through the Home AI diagnostic sanitizer.
  - Static shell/cache bumped to `codex-mobile-shell-v509`.
  - Docs/tests updated in `docs/MODULES.md`,
    `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`,
    `test/thread-diagnostic-events.test.js`, `test/mobile-viewport.test.js`,
    `test/thread-goal-service.test.js`, and
    `test/thread-task-card-route.test.js`.
- Validation:
  - Focused: `node --test test/thread-diagnostic-events.test.js
    test/mobile-viewport.test.js test/thread-detail-render-plan.test.js
    test/conversation-render.test.js test/thread-goal-service.test.js
    test/thread-task-card-route.test.js` passed (`177` tests).
  - Sanitizer/focused: `node --test test/home-ai-diagnostic-reporting.test.js
    test/thread-diagnostic-events.test.js test/mobile-viewport.test.js` passed
    (`24` tests).
  - Full source `npm test` passed (`971` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment:
  - Code commit: `93ee289 fix client turn ordering diagnostics`.
  - Deployed through the central Home AI macOS plugin deploy path with reason
    `codex-mobile-turn-order-v509`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260626T025905Z-plugin-codex-mobile-web-codex-mobile-turn-order-v509`.
  - Production readback returned `clientBuildId=0.1.11|codex-mobile-shell-v509`,
    `shellCacheName=codex-mobile-shell-v509`, and production workspace
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Source/production SHA-256 prefixes matched for `public/app.js`,
    `public/sw.js`, `public/thread-diagnostic-events.js`,
    `public/home-ai-diagnostic-reporting.js`, `docs/MODULES.md`, and
    `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`.

## 2026-06-26 - Live detail cache gap root cause fixed and deployed

- Trigger:
  - User reported Music/Home AI/Codex Mobile thread detail views showing empty
    or missing turns, stale long receipts, and active turns losing intermediate
    items after refresh/restart.
- Root-cause boundary:
  - Failing layer: server thread-detail projection/cache read orchestration.
  - Notification-created partial projection shells could be returned as recent
    detail even though they had no projection signature or item payload.
  - Active/running large-session reads could take bounded `turns-list-*`
    windows after restart, losing active-turn intermediate items even though
    full `thread/read includeTurns` still had them.
- Changes:
  - Commit `b289c68 fix live thread detail cache gaps`.
  - `adapters/thread-detail-projection-service.js` rejects unseeded partial
    projection shells as `partial-not-seeded` and labels notification shells.
  - `adapters/thread-detail-read-orchestration-service.js` bypasses partial
    projection and bounded turns-list windows for active/running summaries,
    forcing full thread/read with `largeReadReason=active-thread-requires-full-read`.
  - Tests updated for projection shell rejection, active-thread full-read
    orchestration, and visibility/source-shape guards.
- Validation:
  - Focused `node --test test/thread-detail-projection-service.test.js
    test/thread-detail-read-orchestration-service.test.js
    test/thread-visibility.test.js` passed (`78` tests).
  - Full source `npm test` passed (`976` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment/readback:
  - Deployed through the central Home AI macOS plugin deploy path with reason
    `codex-mobile-live-detail-cache-gaps`.
  - Production file hash prefixes matched for
    `adapters/thread-detail-projection-service.js`,
    `adapters/thread-detail-read-orchestration-service.js`, `docs/MODULES.md`,
    and `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`.
  - Bounded API readback after deploy showed Home AI/Codex Mobile active
    threads using `thread-read` with active item counts preserved; Music current
    thread returned recent/full detail with non-empty turn item counts.

## 2026-06-26 - v510 detail-response diagnostic module deployed

- Trigger:
  - User asked that client refresh/detail inconsistencies such as empty turns,
    missing middle content, duplicate/missing messages, and slow session loads
    be detected and reported through Home AI diagnostic intake instead of
    relying on user screenshots.
- Root-cause boundary:
  - Failing layer: plugin-owned frontend diagnostic coverage for successful
    but semantically bad thread-detail responses.
  - Existing diagnostics covered DOM render signature, duplicate render keys,
    turn order, and refresh API failures, but not detail responses that were
    already empty shells, active-thread window downgrades, or slow cold paths
    before DOM render.
- Changes:
  - Commit `3040c97 feat: report thread detail contract diagnostics`.
  - Static shell/cache bumped to `codex-mobile-shell-v510`.
  - `public/thread-performance-metrics.js` now plans:
    `thread_detail_slow_path` and
    `thread_detail_response_contract_mismatch`.
  - `public/thread-diagnostic-events.js` now builds bounded failure/success
    payloads for slow detail paths and response-contract mismatches.
  - `public/home-ai-diagnostic-reporting.js` sanitizer now allows only bounded
    read-mode, phase, projection source/kind, cursor boolean, count, timing,
    and short-hash fields for these reports.
  - `public/app.js` records the diagnostics after successful
    load/refresh/full-backfill detail responses; repeated failures use the
    existing threshold/throttle reporter and successful responses clear counts.
  - The projection-window mismatch rule intentionally reports only projection
    full/cache responses with `newerCursor`; latest windows with only
    `olderCursor` are normal recent-history pagination and are not reported.
- Validation:
  - Focused diagnostics: `node --test test/thread-performance-metrics.test.js
    test/thread-diagnostic-events.test.js test/home-ai-diagnostic-reporting.test.js
    test/mobile-viewport.test.js` passed (`45` tests after final rule
    narrowing).
  - Full source `npm test` passed (`986` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment/readback:
  - Deployed through the central Home AI macOS plugin deploy path.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260626T033752Z-plugin-codex-mobile-web-manual`.
  - Production readback returned
    `clientBuildId=0.1.11|codex-mobile-shell-v510`,
    `shellCacheName=codex-mobile-shell-v510`, and
    `buildId=d9f5f3b65cd2d1f8`.
  - Source/production SHA-256 prefixes matched for `public/app.js`,
    `public/sw.js`, `public/home-ai-diagnostic-reporting.js`,
    `public/thread-diagnostic-events.js`, `public/thread-performance-metrics.js`,
    `docs/MODULES.md`, and `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`.
  - Bounded Music readback found visible thread
    `019ef42b-2cb8-7332-ab17-033ec5b48947` (`Music 06-23`) with `10` returned
    turns and non-empty first/last item counts. Recent mode is
    `projection-v4-partial/recent-window`; full mode is `turns-list-large`.
  - Bounded Codex Mobile active-thread readback used `thread-read`,
    `largeReadReason=active-thread-requires-full-read`, and preserved the active
    turn item count.
  - Attempted to return original diagnostic-channel task card
    `ttc_28cd1a44ca922ca88d`; return tool reported
    `task_card_not_returnable:replied`, so no additional return card was sent.

## 2026-06-26 - v511 Music thread empty first-paint summary-state fix deployed

- Trigger:
  - User reported that the Music thread opened with no visible turns and showed
    `No visible turns.` in the embedded mobile UI.
- Bounded evidence:
  - Screenshot showed `Music 06-23` with `No visible turns.` while the thread was
    idle.
  - Direct production API readback for thread
    `019ef42b-2cb8-7332-ab17-033ec5b48947` returned HTTP `200` with `10` turns
    in both recent/full reads and `3` visible non-reasoning items per turn.
  - Logs showed the client rendered immediately from a thread-list summary row
    before the detail response arrived; the summary row has `turns: []` and is
    not a loaded thread-detail object.
- Root-cause boundary:
  - Failing layer: frontend thread-switch state ownership.
  - Violated invariant: thread-list summary rows may provide title/status/cwd
    metadata, but must never own the conversation `turns` state for a thread
    detail view.
  - Fix classification: root-cause state ownership repair, not a projection
    fallback. Server detail still returns real bounded detail and diagnostics.
- Changes:
  - Commit `3074e15 fix thread switch loading summary state`.
  - `public/app.js` now forces the initial thread-switch summary shell to
    `turns: []`, `mobileLoading: true`, and empty `mobileLoadError` after
    spreading summary metadata, so an unloaded summary cannot render as a final
    empty conversation.
  - Static shell/cache bumped to `codex-mobile-shell-v511` in `public/app.js`
    and `public/sw.js`.
  - `test/conversation-render.test.js` now asserts the summary -> loading-shell
    ownership order.
  - Version assertions updated in `test/mobile-viewport.test.js`,
    `test/thread-goal-service.test.js`, and `test/thread-task-card-route.test.js`.
  - `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md` records the thread-list-summary vs
    thread-detail ownership boundary.
- Validation:
  - Focused: `node --test test/conversation-render.test.js
    test/mobile-viewport.test.js test/thread-goal-service.test.js
    test/thread-task-card-route.test.js` passed (`127` tests).
  - Full source `npm test` passed (`986` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment/readback:
  - Deployed via Home AI central macOS plugin deploy path.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260626T034931Z-plugin-codex-mobile-web-manual`.
  - Production `/api/public-config` returned
    `clientBuildId=0.1.11|codex-mobile-shell-v511`,
    `shellCacheName=codex-mobile-shell-v511`, and
    `buildId=668b788f5a290d2d`.
  - Source/prod SHA-256 prefixes matched for `public/app.js`, `public/sw.js`,
    and `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`.
  - Post-deploy Music readback returned recent `readMode=turns-list-initial`,
    full `readMode=turns-list-large`, both with `10` returned turns and visible
    item counts `[3,3,3,3,3,3,3,3,3,3]`.
- Residual:
  - `.agent-context/HANDOFF.md` remains dirty as local context only and was not
    included in the deployment commit.

## 2026-06-26 - v512 thread-list summary cannot masquerade as detail deployed

- Trigger:
  - After v511, user reported the Music thread could still show `No visible
    turns.` with no turn cards visible.
- Bounded evidence:
  - Production detail for Music thread
    `019ef42b-2cb8-7332-ab17-033ec5b48947` returned `10` turns with non-empty
    visible item counts when read through the authenticated detail API.
  - Production thread-list API still returned the Music summary row with a
    `turns: []` field. The stale detail-shaped field could survive local
    summary merging and make `loadThread` treat the current thread as already
    loaded.
- Root-cause boundary:
  - Failing layer: frontend thread-list/detail state ownership.
  - Violated invariant: list summaries must not carry or preserve detail-only
    fields such as `turns`, `runtimeSettings`, task-card detail arrays, loading
    flags, or read diagnostics.
  - This is a state-boundary repair. It does not hide projection errors and does
    not add a render-only fallback.
- Changes:
  - Commit `73a0bbb fix thread summary detail boundary`.
  - `public/app.js` adds loaded-detail detection, sanitizes list responses and
    list merges through `threadListSummaryFromDetailThread`, and refuses the
    cached-current path unless the current thread has loaded-detail evidence.
  - `renderCurrentThread` detects summary-only current thread state, records a
    bounded `thread_summary_detail_recovery` client event, renders the loading
    shell, and schedules an immediate detail refresh.
  - Static shell/cache bumped to `codex-mobile-shell-v512`.
  - `test/conversation-render.test.js` adds executable coverage proving list
    summaries cannot masquerade as detail and stale `turns: []` cannot survive
    summary merge.
  - `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md` records the second-stage evidence.
- Validation:
  - Full source `npm test` passed (`987` tests).
  - `npm run check:macos` and `git diff --check` passed.
- Deployment/readback:
  - Deployed via Home AI central macOS plugin deploy path.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260626T040404Z-plugin-codex-mobile-web-manual`.
  - Production `/api/public-config` returned
    `clientBuildId=0.1.11|codex-mobile-shell-v512` and
    `shellCacheName=codex-mobile-shell-v512`.
  - Source/prod SHA-256 prefixes matched for `public/app.js`, `public/sw.js`,
    `test/conversation-render.test.js`, and
    `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`.
  - Authenticated production Music detail read returned `10` turns with visible
    counts `[3,5,3,5,5,4,3,4,3,4]`; the list row still has `turns: []`, which
    is now explicitly sanitized on the client before it can reach detail
    rendering.

## 2026-06-26 - v513 thread summary/detail state policy extracted and deployed

- Goal slice:
  - Continue Phase A frontend state-ownership architecture cleanup after the
    v511/v512 Music empty-detail incident.
- Root-cause boundary:
  - Failing layer: frontend thread-list/detail state ownership.
  - Violated invariant: thread-list summaries may carry display metadata but
    must not preserve or prove loaded thread-detail state.
  - This slice is architecture extraction plus stronger policy coverage, not a
    UI fallback or render suppression.
- Changes:
  - Commit `e79186c extract thread summary detail state policy`.
  - `public/thread-detail-state.js` now owns:
    - thread-list summary sanitization;
    - loaded-detail detection for empty `turns: []` details;
    - summary-only current-thread detection;
    - summary merge planning that cannot preserve stale detail/projection
      fields.
  - `public/app.js` now delegates the summary/detail policy to
    `CodexThreadDetailState` and keeps only real state mutation, refresh
    scheduling, and render orchestration.
  - Static shell/cache bumped to `codex-mobile-shell-v513`.
  - `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md` document the v513 boundary.
- Validation:
  - Focused:
    `node --test test/thread-detail-state.test.js test/conversation-render.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js test/app-update.test.js`
    passed (`151` tests).
  - Full source `npm test` passed (`989` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment/readback:
  - Deployed through the central Home AI macOS plugin deploy path.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260626T041218Z-plugin-codex-mobile-web-manual`.
  - Production `/api/public-config` returned
    `clientBuildId=0.1.11|codex-mobile-shell-v513` and
    `shellCacheName=codex-mobile-shell-v513`.
  - Source/prod SHA-256 prefixes matched for `public/app.js`,
    `public/sw.js`, `public/thread-detail-state.js`, `README.md`,
    `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, `docs/MODULES.md`, and
    `test/thread-detail-state.test.js`.
  - Authenticated production Music detail read returned `10` turns with visible
    counts `[3,5,3,5,5,4,3,4,3,4]`. The production list row still has
    `turns: []`, but has no `mobileReadMode` or `mobileDiagnostics`; v513
    additionally strips stale detail-only fields at client ingress and merge.

## 2026-06-26 - v514 summary-only current-thread recovery plan deployed

- Goal slice:
  - Continue Phase A frontend state-ownership architecture cleanup by removing
    summary-only current-thread recovery policy from `renderCurrentThread`.
- Root-cause boundary:
  - Failing layer: frontend thread-detail state ownership / render
    orchestration boundary.
  - Violated invariant: summary-only recovery is a state policy; app code may
    execute the planned state write, diagnostic event, and refresh, but should
    not own the detection/state-shaping branches.
  - This remains a root-cause architecture cleanup after the Music empty-detail
    incident. It is not a UI fallback.
- Changes:
  - Commit `c9265a6 extract summary recovery state plan`.
  - `public/thread-detail-state.js` adds
    `planSummaryOnlyCurrentThreadRecovery()`, which:
    - detects summary-only current-thread shells;
    - returns sanitized loading-shell thread state;
    - returns bounded `thread_summary_detail_recovery` event fields;
    - declares whether an immediate `summary-detail-recovery` refresh should be
      scheduled.
  - `public/app.js` now executes that plan instead of inlining the detection,
    state assembly, event payload, and controller checks.
  - Static shell/cache bumped to `codex-mobile-shell-v514`.
  - `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md` document the v514 boundary.
- Validation:
  - Focused:
    `node --test test/thread-detail-state.test.js test/conversation-render.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js test/app-update.test.js`
    passed (`153` tests).
  - Full source `npm test` passed (`991` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment/readback:
  - Deployed through the central Home AI macOS plugin deploy path.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260626T041741Z-plugin-codex-mobile-web-manual`.
  - Production `/api/public-config` returned
    `clientBuildId=0.1.11|codex-mobile-shell-v514` and
    `shellCacheName=codex-mobile-shell-v514`.
  - Source/prod SHA-256 prefixes matched for `public/app.js`,
    `public/sw.js`, `public/thread-detail-state.js`, `README.md`,
    `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, `docs/MODULES.md`, and
    `test/thread-detail-state.test.js`.
  - Authenticated production Music detail read returned `10` turns with visible
    counts `[3,5,3,5,5,4,3,4,3,4]`. The list row still has `turns: []` and no
    detail diagnostics; v514 keeps the client-side recovery policy centralized
    in `thread-detail-state`.

## 2026-06-26 - v515 empty-detail merge authority deployed

- Trigger:
  - User reported `Music 06-23` showing zero visible turns on mobile, with the
    page displaying `No visible turns.`.
  - Screenshot/state evidence: header showed `Music 06-23`; production list
    summary had `turns: 0`, but authenticated production detail read for
    thread `019ef42b-2cb8-7332-ab17-033ec5b48947` returned `10` turns with
    item counts `[3,5,3,5,5,4,3,4,3,4]`.
- Root-cause boundary:
  - Failing layer: frontend thread-detail merge authority / single-thread render
    orchestration.
  - Violated invariant: an empty incoming detail window cannot be treated as
    more authoritative than an existing current-thread state that already has
    visible turns.
  - This is a state merge invariant, not a UI fallback; the UI should not need
    to hide or reinterpret `No visible turns.` after a bad overwrite.
- Changes:
  - Commit `1df0986 fix empty detail merge authority`.
  - `public/thread-detail-merge-state.js` now refuses to let empty incoming
    `turns: []` erase an existing visible detail state.
  - `public/thread-detail-render-plan.js` adds
    `planSingleThreadEarlyShellExecution()` for loading/load-error terminal
    shell execution plans.
  - `public/app.js` executes the early-shell plan and no longer owns the
    loading/load-error branch policy inline.
  - Static shell/cache bumped to `codex-mobile-shell-v515`.
  - `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md` document the v515 boundary.
- Validation:
  - Focused:
    `node --test test/thread-detail-merge-state.test.js test/thread-detail-render-plan.test.js test/conversation-render.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js test/app-update.test.js`
    passed (`191` tests).
  - Full source `npm test` passed (`995` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment/readback:
  - Deployed through the central Home AI macOS plugin deploy path.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260626T042627Z-plugin-codex-mobile-web-manual`.
  - Production `/api/public-config` returned
    `clientBuildId=0.1.11|codex-mobile-shell-v515` and
    `shellCacheName=codex-mobile-shell-v515`.
  - Source/prod SHA-256 prefixes matched for `public/app.js`,
    `public/sw.js`, `public/thread-detail-merge-state.js`,
    `public/thread-detail-render-plan.js`, `README.md`,
    `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, `docs/MODULES.md`,
    `test/thread-detail-merge-state.test.js`,
    `test/thread-detail-render-plan.test.js`, and
    `test/conversation-render.test.js`.
  - Authenticated production Music detail read after deploy still returned
    `10` turns, visible counts `[3,5,3,5,5,4,3,4,3,4]`, read mode
    `projection-v4-dynamic`, projection version `v4`, and status `idle`.

## 2026-06-26 - v516 v4 projection empty-merge authority deployed

- Goal slice:
  - Continue Phase A state-ownership cleanup after reviewing v515 against the
    actual production Music path.
- Root-cause boundary:
  - v515 added the empty-incoming guard to the generic
    `thread-detail-merge-state` path.
  - Production Music detail reads through `projection-v4-dynamic`, which uses
    the dedicated `mergeV4ProjectionThread()` callback before the generic merge
    path can enforce that invariant.
  - Violated invariant: all thread-detail merge paths, including v4 projection,
    must refuse to let an empty incoming `turns: []` window erase an existing
    visible current-thread detail state.
- Changes:
  - Commit `3fb0c03 harden v4 empty detail merge`.
  - `mergeV4ProjectionThread()` now computes existing and incoming visible
    weight and preserves existing turns when incoming is empty and has no
    visible weight.
  - The v4 path still accepts bounded incoming metadata such as
    `mobileReadMode` and projection revision.
  - `test/conversation-render.test.js` adds a v4 projection regression test
    for existing visible detail plus empty incoming projection.
  - Static shell/cache bumped to `codex-mobile-shell-v516`.
  - `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md` document the v516 boundary and the remaining temporary
    app-owned v4 callback.
- Validation:
  - Focused:
    `node --test test/conversation-render.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js test/app-update.test.js`
    passed (`138` tests).
  - Full source `npm test` passed (`996` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment/readback:
  - Deployed through the central Home AI macOS plugin deploy path.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260626T043318Z-plugin-codex-mobile-web-manual`.
  - Production `/api/public-config` returned
    `clientBuildId=0.1.11|codex-mobile-shell-v516` and
    `shellCacheName=codex-mobile-shell-v516`.
  - Source/prod SHA-256 prefixes matched for `public/app.js`,
    `public/sw.js`, `README.md`,
    `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, `docs/MODULES.md`,
    `test/conversation-render.test.js`, `test/mobile-viewport.test.js`,
    `test/thread-goal-service.test.js`, and
    `test/thread-task-card-route.test.js`.
  - Authenticated production Music detail read after deploy returned `10`
    turns, visible counts `[3,5,3,5,5,4,3,4,3,4]`, read mode
    `projection-v4-dynamic`, projection version `v4`, status `idle`, and
    omitted turns `79`.
- Next recommended slice:
  - Extract the remaining v4-specific projection merge callback out of
    `public/app.js` into a pure helper so v4 merge authority, pending overlay,
    regressive-revision handling, and empty-incoming preservation live in the
    same testable module instead of app code.

## 2026-06-26 - v517 embedded thread selection ownership deployed

- Incident:
  - User reported Music showed no turns, and Home AI/Codex Mobile embedded
    threads intermittently showed only an old card/receipt or blank history
    even though the thread should have recent content.
  - Production API evidence showed Music detail was not empty:
    authenticated `GET /api/threads/019ef42b-2cb8-7332-ab17-033ec5b48947?mode=recent`
    returned read mode `projection-v4-dynamic`, projection version `v4`, `10`
    turns, and item counts `[3,5,3,5,5,4,3,4,3,4]`.
  - Production client-event evidence before the fix showed repeated
    `conversation_render_ms` events with `threadId=""`, `childCount=1`, and
    about `5.6KB` HTML under v515/v516 clients after valid thread detail
    renders. That means the client rendered the Hermes Primary shell while a
    thread view should still have owned the conversation surface.
- Root-cause boundary:
  - Failing layer: frontend embedded/mobile startup, workspace refresh, and
    thread-list restore selection ownership.
  - Violated invariant: if there is a current thread id, current thread state,
    active detail load controller, or startup thread-open intent, list/workspace
    recovery paths must not clear selection or render the Primary shell.
  - This is separate from the v515/v516 merge authority fixes: the detail data
    existed; the frontend selection owner was being reset.
- Changes:
  - Commit `93d710f fix embedded thread detail selection ownership`.
  - Added `hasThreadDetailSelectionIntent()` and
    `shouldRenderPrimaryConversationShell()` in `public/app.js`.
  - `loadWorkspaces()` and `loadThreads()` now render the Primary shell only
    through `shouldRenderPrimaryConversationShell()`, not merely because
    `state.currentThread` is temporarily null.
  - `restoreThreadSelection()` exits when there is any active thread-selection
    intent. Hermes embed now returns to Primary only when truly empty.
  - `showHermesPluginPrimaryPage()` now suppresses non-forced calls while a
    thread load/startup open/mobile loading state is active and emits bounded
    `plugin_primary_suppressed_thread_open` diagnostics instead of clearing
    selection.
  - Explicit route/back/sidebar actions call `showHermesPluginPrimaryPage()` with
    `force: true` and a bounded source label.
  - Extracted v4 projection merge policy from `public/app.js` into
    `public/thread-detail-v4-merge-state.js`; wired it into `index.html`,
    `sw.js`, `server.js` build-id inputs, `PAGE_SHELL_ASSETS`, and `npm run
    check`.
  - Added `test/thread-detail-v4-merge-state.test.js`; updated app-update,
    conversation-render, mobile-viewport, Hermes route, voice-input, and tile
    layout tests for the new module and selection-owner invariant.
  - Static shell/cache bumped to `codex-mobile-shell-v517`.
- Validation:
  - Focused:
    `node --test test/thread-detail-v4-merge-state.test.js test/thread-detail-merge-state.test.js test/conversation-render.test.js test/mobile-viewport.test.js test/hermes-plugin-route.test.js test/app-update.test.js test/plugin-voice-input.test.js test/thread-tile-layout-ui.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
    passed (`164` tests).
  - Full source `npm test` passed (`1001` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
  - In-app Browser plugin initialization failed in this continuation due a
    Node REPL sandbox metadata error, and no local Playwright package was
    installed, so browser smoke was not performed through Browser. Production
    HTTP/static readback was used instead.
- Deployment/readback:
  - Deployed through the central Home AI macOS plugin deploy path.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260626T045259Z-plugin-codex-mobile-web-manual`.
  - Production `/api/public-config` returned
    `clientBuildId=0.1.11|codex-mobile-shell-v517` and
    `shellCacheName=codex-mobile-shell-v517`.
  - Production HTTP static readback:
    `index.html` includes `thread-detail-v4-merge-state.js`; `sw.js` and
    `app.js` include `codex-mobile-shell-v517`; `app.js` includes
    `plugin_primary_suppressed_thread_open`.
  - Source/prod SHA-256 prefixes matched for `public/app.js`,
    `public/index.html`, `public/sw.js`,
    `public/thread-detail-v4-merge-state.js`, `server.js`, `package.json`,
    `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
  - Authenticated production Music detail read after deploy returned `10` turns
    with item counts `[3,5,3,5,5,4,3,4,3,4]`, read mode
    `projection-v4-dynamic`, and projection version `v4`.
- Next recommended slice:
  - Continue the diagnostic automation project: if the client renders a
    `threadId=""` Primary shell shortly after a successful thread detail read
    or while a thread-open intent exists, report a bounded
    `conversation_projection_mismatch` / selection-owner diagnostic to Home AI
    so Owner can dispatch a repair card without relying on manual screenshots.

## 2026-06-26 - v518 detail-loaded ownership and primary-shell diagnostics deployed

- Incident/evidence:
  - User reported `Music 06-23` rendered `No visible turns.` on mobile.
  - Screenshot confirmed the client was not merely scrolled behind a long
    receipt: the single-thread surface showed the task toolbar plus
    `No visible turns.`.
  - Authenticated production detail read for
    `019ef42b-2cb8-7332-ab17-033ec5b48947` returned `200`, title
    `Music 06-23`, read mode `projection-v4-dynamic`, projection version `v4`,
    `10` turns, and item counts `[3,5,3,5,5,4,3,4,3,4]`.
  - Bounded item-shape read showed those turns contained visible
    `userMessage`/`agentMessage` items. The failure layer was therefore client
    loaded-detail state ownership, not missing server data.
- Root-cause boundary:
  - Failing layer: frontend thread-detail loaded-state policy.
  - Violated invariant: an empty `turns: []` object with list/runtime metadata
    must not be treated as loaded detail unless a real detail API path produced
    it. List summaries, task-card metadata, runtime settings, or read-mode
    fields cannot own the conversation surface as a stable empty thread.
- Changes:
  - Commit `f1235ea fix thread detail empty shell ownership`.
  - `public/thread-detail-state.js` now treats empty `turns: []` as loaded only
    when client-owned `mobileDetailLoaded === true` is present.
  - `public/app.js` sets `mobileDetailLoaded` only after successful detail API
    reads in `loadThread()`, `refreshCurrentThread()`, and
    `backfillFullThreadDetail()`.
  - `mobileDetailLoaded` is stripped from thread-list summaries so list refresh
    cannot write stale loaded-detail authority back into detail state.
  - Added bounded `primary_shell_selection_conflict` diagnostics in
    `public/thread-diagnostic-events.js` and app trigger points for suppressed
    Primary-shell selection or embedded Primary shell rendered shortly after a
    successful thread-detail render.
  - Updated README and architecture/module docs with the v518 ownership rule
    and diagnostic boundary.
  - Static shell/cache bumped to `codex-mobile-shell-v518`.
- Validation:
  - Focused:
    `node --test test/thread-detail-state.test.js test/conversation-render.test.js test/thread-detail-render-plan.test.js test/thread-diagnostic-events.test.js test/home-ai-diagnostic-reporting.test.js`
    passed (`185` tests).
  - Full source `npm test` passed (`1004` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment/readback:
  - Deployed through the central Home AI macOS plugin deploy path.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260626T051514Z-plugin-codex-mobile-web-manual`.
  - Production `/api/public-config` returned
    `clientBuildId=0.1.11|codex-mobile-shell-v518` and
    `shellCacheName=codex-mobile-shell-v518`.
  - Production static readback confirmed `mobileDetailLoaded` in `app.js` and
    `thread-detail-state.js`, `primaryShellSelectionConflictDiagnosticEvent`
    and `primary_shell_selection_conflict` in `thread-diagnostic-events.js`,
    and `codex-mobile-shell-v518` in `sw.js`.
  - Source/prod SHA-256 prefixes matched for `public/app.js`,
    `public/sw.js`, `public/thread-detail-state.js`,
    `public/thread-diagnostic-events.js`, `README.md`,
    `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, `docs/MODULES.md`,
    `test/thread-detail-state.test.js`, `test/conversation-render.test.js`,
    `test/thread-diagnostic-events.test.js`, and
    `test/home-ai-diagnostic-reporting.test.js`.
  - Authenticated production Music detail read after deploy still returned
    `10` turns with item counts `[3,5,3,5,5,4,3,4,3,4]`, read mode
    `projection-v4-dynamic`, projection version `v4`, and shape hash
    `15c0c006ec704ae6`.
- Next recommended slice:
  - Add browser/DOM-level live verification around single-thread empty-state
    recovery and expand diagnostics to report repeated client-visible
    `No visible turns.` when the server detail contract reports nonzero visible
    turns.

## 2026-06-26 - v519 empty detail mismatch diagnostics deployed

- Incident/evidence:
  - v518 fixed the concrete Music `No visible turns.` root cause by tightening
    loaded-detail ownership, but the broader product requirement remains: if a
    client visibly renders an empty conversation shortly after the same client
    saw nonempty detail evidence, Codex Mobile must detect that automatically
    and report bounded evidence to Home AI instead of depending on screenshots.
- Root-cause boundary:
  - Failing layer addressed in this slice: frontend render/detail evidence
    consistency diagnostics.
  - Violated invariant: a single-thread `No visible turns.` render is suspicious
    when the same thread has recent nonempty detail API/detail render evidence;
    that contradiction must be observable via Home AI's Owner-gated diagnostic
    report channel.
  - This is diagnostic closure, not a masking fallback. The UI is not hidden,
    forcibly refreshed, or deduped to conceal the mismatch, and the plugin does
    not auto-dispatch repair cards.
- Changes:
  - Commit `a5fbef9 report empty detail render mismatches`.
  - `public/thread-diagnostic-events.js` adds bounded
    `empty_visible_detail_mismatch` failure/success payload builders.
  - `public/app.js` records bounded same-thread detail evidence on successful
    detail API paths in `loadThread()`, `refreshCurrentThread()`, and
    `backfillFullThreadDetail()` before merge/render.
  - `renderCurrentThread()` checks actual single-thread full renders that emit
    `No visible turns.`; if recent same-thread evidence has nonzero visible
    turn/item counts, it records an H2 `empty_visible_detail_mismatch` failure.
  - Normal nonempty detail renders record success clear input for the same
    diagnostic signature.
  - README, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and `docs/MODULES.md`
    document the v519 diagnostic boundary.
  - Static shell/cache bumped to `codex-mobile-shell-v519`.
- Privacy boundary:
  - Diagnostic payload includes only thread hash, read/render mode, source kind,
    visible turn/item counts, DOM/previous counts, detail-loaded flag, mobile
    loading flag, and evidence age.
  - Tests cover stripping unsafe message/body/title/url/private-token-shaped
    fields; no message text, task-card body, upload bytes, private path, URL,
    cookie, token, prompt, provider payload, or long log is reported.
- Validation:
  - Focused:
    `node --test test/thread-diagnostic-events.test.js test/home-ai-diagnostic-reporting.test.js test/conversation-render.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
    passed (`152` tests).
  - Full source `npm test` passed (`1007` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment/readback:
  - Deployed through the central Home AI macOS plugin deploy path.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260626T052519Z-plugin-codex-mobile-web-manual`.
  - Production `/api/public-config` returned
    `clientBuildId=0.1.11|codex-mobile-shell-v519` and
    `shellCacheName=codex-mobile-shell-v519`.
  - Production static marker readback confirmed
    `checkEmptyVisibleDetailMismatchAfterRender` and `mobileDetailLoaded` in
    `app.js`, `emptyVisibleDetailMismatchDiagnosticEvent` and
    `empty_visible_detail_mismatch` in `thread-diagnostic-events.js`, and
    `codex-mobile-shell-v519` in `sw.js`.
  - Source/prod SHA-256 prefixes matched for `public/app.js`, `public/sw.js`,
    `public/thread-diagnostic-events.js`, `README.md`,
    `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, `docs/MODULES.md`,
    `test/thread-diagnostic-events.test.js`,
    `test/home-ai-diagnostic-reporting.test.js`, and
    `test/conversation-render.test.js`.
  - Authenticated production Music detail read after deploy still returned `10`
    turns with item counts `[3,5,3,5,5,4,3,4,3,4]`, read mode
    `projection-v4-dynamic`, projection version `v4`, and shape hash
    `15c0c006ec704ae6`.
- Next recommended slice:
  - Build browser/DOM-level live verification for single-thread empty-state
    recovery and diagnostic emission, then broaden to duplicate/missing message
    replay diagnostics where the DOM can be compared against the current
    projection signature.

## 2026-06-26 - v520 empty cached-current detail reuse fix deployed

- Incident/evidence:
  - User reported `Music 06-23` on mobile showed the single-thread header and
    toolbar but the conversation body was stable `No visible turns.`.
  - Screenshot confirmed this was a single-thread detail surface, not tile mode
    and not a long receipt covering newer content.
  - Production detail API for
    `019ef42b-2cb8-7332-ab17-033ec5b48947` returned title `Music 06-23`,
    cwd `/Users/xuxin/Documents/Music`, status `idle`, read mode
    `projection-v4-dynamic`, projection version `v4`, `10` turns, item counts
    `[3,5,3,5,5,4,3,4,3,4]`, `39` visible items, and `79` omitted turns.
  - Production logs around the report showed server `[thread-detail]` reads for
    Music returning `returnedTurns=10`, while the visible client state was
    already an empty current-thread detail. This separated the failure from the
    server projection layer.
- Root-cause boundary:
  - Failing layer: frontend `loadThread()` cached-current detail reuse policy.
  - Violated invariant: `mobileDetailLoaded` proves only that a detail API path
    once completed; it does not make an empty `turns: []` current-thread object
    reusable as the authority for reopening the same thread.
  - Strongest root cause: after v518, an empty
    `turns: [] + mobileDetailLoaded:true` state could bypass summary-only
    recovery and also satisfy the same-thread cached-current branch. Reopening
    the same thread then rendered the cached empty detail and skipped the
    server detail API, even though the server projection had nonzero turns.
- Changes:
  - Commit `81d6f4c fix empty cached thread detail reuse`.
  - `public/thread-detail-state.js` adds
    `threadHasReusableLoadedDetailState()`, separating loaded detail from
    reusable loaded detail. Only loaded detail with nonempty `turns` can be
    reused by open-thread cached-current.
  - `public/app.js` changes `loadThread()` cached-current to require
    `threadHasReusableLoadedDetailState(state.currentThread)`.
  - `public/app.js` also strips detail-only fields from the thread-list summary
    before constructing the loading current-thread shell, so list rows cannot
    carry `mobileDetailLoaded` back into current detail authority.
  - README, architecture plan, and module map document the v520 cache authority
    rule.
  - Static shell/cache bumped to `codex-mobile-shell-v520`.
- Validation:
  - Focused:
    `node --test test/thread-detail-state.test.js test/conversation-render.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
    passed (`146` tests).
  - Full source `npm test` passed (`1007` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment/readback:
  - Deployed through the central Home AI macOS plugin deploy path.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260626T053610Z-plugin-codex-mobile-web-manual`.
  - Production `/api/public-config` returned
    `clientBuildId=0.1.11|codex-mobile-shell-v520` and
    `shellCacheName=codex-mobile-shell-v520`.
  - Production static readback confirmed `/app.js` contains
    `threadHasReusableLoadedDetailState`,
    `threadListSummaryFromDetailThread(summary) || summary`, and
    `codex-mobile-shell-v520`; `/thread-detail-state.js` contains
    `threadHasReusableLoadedDetailState`; `/sw.js` contains
    `codex-mobile-shell-v520`.
  - Source/prod SHA-256 prefixes matched for `public/app.js`, `public/sw.js`,
    `public/thread-detail-state.js`, README, architecture/module docs, and
    focused tests.
- Next recommended slice:
  - Add a live browser/DOM smoke that opens a thread from an intentionally empty
    current-thread cache and verifies that the next state reaches the detail API
    rather than rendering `No visible turns.` from cache. Then extend the
    diagnostic reporter to catch cached-current empty authority attempts if they
    recur in production.

## 2026-06-26 - v526 Music empty DOM / stable signature authority fix

- Incident/evidence:
  - User reported `Music 06-23` showed the single-thread header, task-card
    toolbar, and stable `No visible turns.` on mobile.
  - Screenshot confirmed this was the ordinary single-thread detail surface,
    not tile mode and not a long receipt covering newer content.
  - Authenticated production detail API for
    `019ef42b-2cb8-7332-ab17-033ec5b48947` returned HTTP `200`, `10` turns,
    item counts `[3,5,3,5,5,4,3,4,3,4]`, `39` visible item keys,
    `79` omitted turns, read mode `projection-v4-dynamic`, projection state
    `hit`, and shape hash `c347733fe098db40`.
  - Authenticated production list search for Music returned one row with no
    forbidden detail-only fields and no `turns` field. This separated the
    failure from server projection and list-summary authority.
- Root-cause boundary:
  - Failing layer: frontend thread-detail refresh render planning.
  - Violated invariant: `renderedConversationSignature` is valid only while the
    mounted DOM still represents the same single-thread detail surface. It must
    not by itself allow `metadata-only` refreshes when the DOM has already been
    replaced by an empty shell.
  - Strongest root cause: a stale `renderedConversationSignature` could still
    match the next nonempty detail signature while the real DOM contained zero
    `article.turn[data-turn]` nodes. The refresh plan then returned
    `signature-stable`, skipped full render, and left the empty DOM visible even
    though the detail API was nonempty.
- Changes:
  - `public/thread-detail-render-plan.js` adds a `rendered-dom-empty` branch to
    `planThreadDetailRefreshRender()`: when a single-thread surface is
    available, next detail has visible turns, and the mounted DOM has zero turn
    articles, the stable signature is invalidated and the plan requires a full
    render.
  - `public/app.js` passes `singleThreadSurfaceAvailable`,
    `renderedDomTurnCount`, and `nextVisibleTurnCount` into the refresh render
    plan after merging the latest detail API response.
  - The same release includes the v525 state-ownership slice:
    `public/thread-detail-state.js` now owns recent detail render evidence
    construction, freshness, same-thread matching, and nonempty proof for
    primary-shell and empty-visible-detail diagnostics.
  - Static shell/cache bumped to `codex-mobile-shell-v526`.
  - README, architecture optimization plan, and module map document the v526
    DOM/signature authority rule and the v525 evidence-policy extraction.
- Validation before deploy:
  - Focused:
    `node --test test/thread-detail-render-plan.test.js test/thread-detail-state.test.js test/conversation-render.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
    passed (`198` tests).
  - Full source `npm test` passed (`1035` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment/readback:
  - Committed as `e0f42ae` (`fix empty detail stable signature render`) and
    deployed through the central Home AI macOS plugin deploy path.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260626T073436Z-plugin-codex-mobile-web-codex-mobile-empty-dom-stable-signature-v526`.
  - Production `/api/public-config` returned
    `clientBuildId=0.1.11|codex-mobile-shell-v526`,
    `shellCacheName=codex-mobile-shell-v526`, and build id
    `eba4376285eb643e`.
  - Production static marker readback confirmed `codex-mobile-shell-v526` in
    `public/app.js` and `public/sw.js`, `rendered-dom-empty` /
    `renderedDomTurnCount` in `public/thread-detail-render-plan.js`, app
    refresh-plan consumption of `renderedDomTurnCount`, and evidence helpers in
    `public/thread-detail-state.js`.
  - Source/prod SHA-256 matched for `public/app.js`, `public/sw.js`,
    `public/thread-detail-render-plan.js`, `public/thread-detail-state.js`,
    README, architecture optimization plan, and module map.
  - Authenticated production Music detail read returned HTTP `200`, `10` turns,
    item counts `[3,5,3,5,5,4,3,4,3,4]`, `39` visible item keys,
    `79` omitted turns, read mode `projection-v4-dynamic`, projection state
    `hit`, and shape hash `c347733fe098db40`.
  - Authenticated production Music list search returned one matching row and no
    forbidden detail-only fields (`presentForbidden=[]`, no `turns` field).

## 2026-06-26 - v523 thread-list summary authority boundary fix

- Incident/evidence:
  - User reported `Music 06-23` showed the toolbar and `No visible turns.`
    with no turn rows.
  - Direct authenticated Codex Mobile detail read for
    `019ef42b-2cb8-7332-ab17-033ec5b48947` returned `10` turns, `39`
    visible item keys, read mode `projection-v4-dynamic`, projection version
    `v4`, and `79` omitted turns. This separated the failure from the server
    detail/projection layer.
  - A thread-list/search response for Music could expose fallback/list summary
    rows with `turns: []` and detail-shaped metadata. That violates the list
    summary boundary and can let an empty summary become current detail
    authority in the browser.
- Root-cause boundary:
  - Failing layer: server thread-list summary shaping plus frontend empty-detail
    contradiction detection.
  - Violated invariant: `/api/threads` list rows are summaries only. They must
    not carry `turns`, runtime settings, pending server requests, projection
    metadata, visible item keys, or `mobileDetailLoaded` into client detail
    state.
  - Strongest root cause: prior v520/v521 blocked empty cached-current reuse,
    but list/fallback rows could still leak detail-only empty fields into
    later current-thread state.
- Changes:
  - Added `adapters/thread-list-summary-service.js` to strip detail-only fields
    from list rows.
  - `server.js` applies that stripping during list merge, list status
    normalization, and task-card count decoration.
  - `public/app.js` records `empty_render_with_history_evidence` and schedules
    a real detail refresh when the DOM renders `No visible turns.` while the
    current thread still has bounded history evidence such as rollout size,
    omitted turns, visible item keys, active turn state, or pending task-card
    count.
  - Static shell/cache bumped to `codex-mobile-shell-v523`.
  - README, architecture plan, and module map document the new boundary.
- Validation before deploy:
  - Focused:
    `node --test test/thread-visibility.test.js test/conversation-render.test.js test/thread-detail-state.test.js test/thread-diagnostic-events.test.js test/home-ai-diagnostic-reporting.test.js test/thread-detail-active-window-overlay-policy-service.test.js`
    passed (`200` tests).
  - Full source `npm test` passed (`1030` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment status:
  - First central deploy attempt correctly failed because source was dirty:
    `deploy_source_dirty_requires_allow_dirty`.
  - Committed as `10b610d` (`fix thread list summary detail leakage`) and
    redeployed from a clean source tree through the central Home AI macOS plugin
    deploy path.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260626T070830Z-plugin-codex-mobile-web-codex-mobile-thread-list-summary-v523`.
  - Production `/api/public-config` returned
    `clientBuildId=0.1.11|codex-mobile-shell-v523` and
    `shellCacheName=codex-mobile-shell-v523`.
  - Production static marker readback confirmed `codex-mobile-shell-v523` in
    `public/app.js` and `public/sw.js`, the server require for
    `thread-list-summary-service`, and the client markers
    `empty_render_with_history_evidence` / `empty_detail_history_recovery`.
  - Source/prod SHA-256 matched for `public/app.js`, `public/sw.js`,
    `server.js`, and `adapters/thread-list-summary-service.js`.
  - Authenticated production Music detail read returned HTTP `200`, `10` turns,
    item counts `[3,5,3,5,5,4,3,4,3,4]`, `39` visible item keys, `79` omitted
    turns, read mode `projection-v4-dynamic`, projection state `hit`, and
    shape hash `c347733fe098db40`.
  - Authenticated production Music list search returned one matching row and
    no forbidden detail-only fields (`presentForbidden=[]`, no `turns` field).
  - Browser plugin DOM smoke was not executed because the Browser runtime failed
    to initialize with invalid sandbox cwd metadata, and local Playwright is not
    installed. No temporary dependency was added.

## 2026-06-26 - v524 empty-detail history recovery policy extraction

- Scope:
  - Continued Phase 2 frontend state ownership cleanup after v523.
  - No projection, list, DOM patch, or task-card protocol semantics changed.
    This slice moves the v523 empty-detail/history-evidence decision out of
    `public/app.js` into the pure `public/thread-detail-state.js` policy module.
- Root-cause boundary:
  - Failing layer addressed: frontend state ownership / empty-detail recovery
    policy placement.
  - Violated invariant: `public/app.js` should orchestrate effects but not own
    the policy that decides which bounded thread fields prove an empty detail
    render contradicts existing history.
  - Closure classification: architecture boundary cleanup; not a fallback and
    not a masking layer. The existing recovery still schedules a real detail
    refresh only after a bounded contradiction is detected.
- Changes:
  - `public/thread-detail-state.js` adds
    `rolloutSizeBytesFromThread()`, `emptyDetailHistoryEvidenceForThread()`,
    and `planEmptyDetailHistoryRecovery()`.
  - The helper owns the bounded evidence set: rollout size, omitted turns,
    visible item keys, active turn evidence, task-card count, and pending
    task-card count.
  - `public/app.js` now consumes the helper plan, keeps only cooldown storage,
    diagnostic recording, refresh scheduling, and client-event emission.
  - Static shell/cache bumped to `codex-mobile-shell-v524`.
  - README, architecture optimization plan, and module map document the new
    policy boundary.
- Validation before deploy:
  - Focused:
    `node --test test/thread-detail-state.test.js test/conversation-render.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
    passed (`150` tests).
  - Full source `npm test` passed (`1032` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment status:
  - Committed as `c1a51f9` (`extract empty detail recovery policy`) and
    deployed from a clean source tree through the central Home AI macOS plugin
    deploy path.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260626T072008Z-plugin-codex-mobile-web-codex-mobile-empty-detail-policy-v524`.
  - Production `/api/public-config` returned
    `clientBuildId=0.1.11|codex-mobile-shell-v524` and
    `shellCacheName=codex-mobile-shell-v524`.
  - Production static marker readback confirmed
    `planEmptyDetailHistoryRecovery` / `emptyDetailHistoryEvidenceForThread`
    in `public/thread-detail-state.js`, app consumption of
    `threadDetailStateApi.planEmptyDetailHistoryRecovery`, and
    `codex-mobile-shell-v524` in `public/app.js` / `public/sw.js`.
  - Source/prod SHA-256 matched for `public/app.js`, `public/sw.js`,
    `public/thread-detail-state.js`, README, architecture optimization plan,
    and module map.
  - Authenticated production Music detail read returned HTTP `200`, `10` turns,
    item counts `[3,5,3,5,5,4,3,4,3,4]`, `39` visible item keys, `79` omitted
    turns, read mode `projection-v4-dynamic`, projection state `hit`, and
    shape hash `c347733fe098db40`.
  - Authenticated production Music list search returned one matching row and
    no forbidden detail-only fields (`presentForbidden=[]`, no `turns` field).

## 2026-06-26 - v527 conversation DOM authority guard deployed

- User-visible incident:
  - Music thread `019ef42b-2cb8-7332-ab17-033ec5b48947` showed `No visible turns.` on the mobile single-thread page even though production detail reads were nonempty.
  - This was not a server projection/list-summary miss: authenticated production detail read returned `10` turns, item counts `[3,5,3,5,5,4,3,4,3,4]`, `39` visible item keys, `79` omitted turns, and read mode `projection-v4-dynamic`.
- Root-cause boundary:
  - Failing layer: frontend conversation DOM update authority.
  - Violated invariant: `renderedConversationSignature === signature` is not sufficient to skip a real DOM update when the mounted single-thread DOM has lost all `article.turn[data-turn]` nodes but the next/current thread state has visible turns.
  - Strongest root cause: v526 fixed this at the refresh render-plan layer, but `updateConversationHtml()` / `planConversationHtmlUpdate()` still had a lower-level `hydrate-existing` path that trusted the stable signature without checking rendered DOM shape.
  - Closure classification: root-cause fix, not fallback. No synthetic content, no broad retry, no client-side duplicate hiding.
- Changes:
  - `public/thread-detail-dom-patch.js` now accepts `expectedVisibleTurnCount` and `renderedDomTurnCount` in `planConversationHtmlUpdate()` and returns `stable-signature-dom-empty` instead of `hydrate-existing` when a stable signature conflicts with an empty DOM.
  - `public/app.js` passes expected visible turn count for single-thread renders, records bounded `stable_signature_dom_empty` diagnostics, emits `conversation_dom_authority_invalidated`, and reports `updateReason` in `conversation_render_ms`.
  - Static shell/cache bumped to `codex-mobile-shell-v527`.
  - README, architecture optimization plan, and module map document the DOM authority guard.
- Validation before deploy:
  - Focused:
    `node --test test/thread-detail-dom-patch.test.js test/thread-detail-render-plan.test.js test/thread-detail-state.test.js test/conversation-render.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
    passed (`237` tests).
  - Full source `npm test` passed (`1037` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment status:
  - Code committed as `e998c39` (`fix conversation dom authority guard`).
  - Deployed through the central Home AI macOS plugin deploy path from clean source.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260626T075753Z-plugin-codex-mobile-web-codex-mobile-conversation-dom-authority-v527`.
  - Production `/api/public-config` returned `clientBuildId=0.1.11|codex-mobile-shell-v527` and `shellCacheName=codex-mobile-shell-v527`.
  - Production static marker readback confirmed `codex-mobile-shell-v527`, `stable_signature_dom_empty`, `conversation_dom_authority_invalidated`, `expectedVisibleTurnCount`, and `stable-signature-dom-empty`.
  - Source/prod SHA-256 matched for `public/app.js`, `public/sw.js`, `public/thread-detail-dom-patch.js`, README, architecture optimization plan, and module map.
  - Authenticated production Music detail read returned HTTP `200` and the nonempty shape above.
- Notes:
  - The first post-deploy Music detail verification attempt used `X-Access-Key` and returned `401`; the real client header is `X-Codex-Mobile-Key`. Re-running with the correct header returned HTTP `200`.
  - Browser visual smoke was not run in this slice. User should refresh the PWA/WebView to pick up shell v527 before judging the mobile UI path.

## 2026-06-26 - v528 missing DOM turn diagnostic coverage deployed

- Scope:
  - Continued the v527 Music empty-detail incident chain by closing a diagnostic blind spot, not by changing rendering behavior.
  - `conversationTurnOrderDiagnosticSnapshot()` previously returned `null` when DOM turn ids were empty, even if expected visible turn ids were nonempty. That meant the user-visible state "no turns can be seen" could avoid normal `turn_order_mismatch` reporting.
- Root-cause boundary:
  - Failing layer: frontend projection/render diagnostic policy.
  - Violated invariant: expected-nonempty / DOM-empty is strong mismatch evidence, not insufficient evidence.
  - Closure classification: diagnostic coverage and ownership extraction. No UI hiding, no synthetic content, no broad refresh loop, no automatic repair-card dispatch.
- Changes:
  - `public/thread-diagnostic-events.js` adds `turnOrderDiagnosticSnapshot()` and `missing_dom_turn_count` support.
  - `public/app.js` delegates turn-order snapshot planning to the helper and only supplies expected ids, DOM ids, and safe thread/turn hashes.
  - Expected nonempty / DOM empty now reports bounded `turn_order_mismatch` evidence through the existing Home AI Owner-gated diagnostic channel.
  - Static shell/cache bumped to `codex-mobile-shell-v528`.
  - README, architecture optimization plan, and module map document the diagnostic boundary.
- Validation before deploy:
  - Focused:
    `node --test test/thread-diagnostic-events.test.js test/conversation-render.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
    passed (`149` tests).
  - Full source `npm test` passed (`1039` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment status:
  - Code committed as `660373e` (`improve missing dom turn diagnostics`).
  - Deployed through the central Home AI macOS plugin deploy path from clean source.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260626T080730Z-plugin-codex-mobile-web-codex-mobile-missing-dom-turn-diagnostics-v528`.
  - Production `/api/public-config` returned `clientBuildId=0.1.11|codex-mobile-shell-v528` and `shellCacheName=codex-mobile-shell-v528`.
  - Production static marker readback confirmed `turnOrderDiagnosticSnapshot`, `missing_dom_turn_count`, and `codex-mobile-shell-v528`.
  - Source/prod SHA-256 matched for `public/app.js`, `public/sw.js`, `public/thread-diagnostic-events.js`, README, architecture optimization plan, and module map.
  - Authenticated production Music detail read still returned HTTP `200`, `10` turns, `39` visible item keys, `79` omitted turns, and read mode `projection-v4-dynamic`.

## 2026-06-26 - v529 stable-signature empty-DOM visual harness ready

- Scope:
  - Continued the v527/v528 Music empty-DOM incident chain by adding a browser/
    visual replay harness for the lower-level DOM authority branch.
  - Runtime rendering semantics are unchanged. This is verification
    infrastructure so the fixed `stable-signature-dom-empty` path can be
    replayed through a real embedded browser surface.
- Root-cause boundary:
  - Failing layer covered: frontend conversation DOM update authority.
  - Violated invariant under replay: a stable render signature is not
    authoritative if the mounted single-thread conversation DOM has lost all
    turn articles while the current thread detail state still has visible turns.
  - Closure classification: Phase E harness coverage. No UI hiding, no
    synthetic content, no broad refresh loop, no automatic repair-card dispatch.
- Changes:
  - `public/app.js` adds
    `simulateStableSignatureEmptyDomForHarness(threadId)` and exposes it as
    `window.__codexMobileVisualHarness.simulateStableSignatureEmptyDom()` in
    Hermes embedded mode.
  - The harness loads a real nonempty detail through `loadThread()`, records
    the current render signature, replaces the conversation DOM with the empty
    state, then calls the real `renderCurrentThread()` path. It returns only
    bounded counts, build id, thread hash, load flags, and read mode.
  - `scripts/codex-mobile-empty-detail-cache-smoke.js` now supports
    `--scenario stable-signature-empty-dom` while keeping `empty-cache` as the
    default. Each smoke run gets a per-run browser key so repeated same-thread
    checks do not reuse stale in-page results.
  - Static shell/cache bumped to `codex-mobile-shell-v529`.
  - README, architecture optimization plan, and module map document the new
    visual replay scenario.
- Validation before deploy:
  - Focused:
    `node --test test/mobile-viewport.test.js test/thread-detail-dom-patch.test.js test/conversation-render.test.js test/thread-diagnostic-events.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
    passed (`187` tests).
  - Full source `npm test` passed (`1039` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment status:
  - Code committed as `a480f30` (`add stable signature empty dom visual harness`).
  - Deployed through the central Home AI macOS plugin deploy path from clean source.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260626T082604Z-plugin-codex-mobile-web-codex-mobile-stable-signature-empty-dom-harness-v529`.
  - Production `/api/public-config` returned
    `clientBuildId=0.1.11|codex-mobile-shell-v529` and
    `shellCacheName=codex-mobile-shell-v529`.
  - Production static marker readback confirmed `codex-mobile-shell-v529`,
    `simulateStableSignatureEmptyDom`, `stable-signature-empty-dom`,
    per-run `runKey`, and `__codexMobileEmptyDetailCacheSmoke`.
  - Source/prod SHA-256 matched for `public/app.js`, `public/sw.js`,
    `scripts/codex-mobile-empty-detail-cache-smoke.js`, README, architecture
    optimization plan, and module map.
  - Authenticated production Music detail read returned HTTP `200`, `10`
    turns, item counts `[3,5,3,5,5,4,3,4,3,4]`, `39` visible item keys,
    `79` omitted turns, read mode `projection-v4-dynamic`, and no forbidden
    detail-only fields on the matching thread-list row.
  - Note: early post-deploy readback attempts mistakenly parsed thread/list
    responses as direct `threads` / direct detail objects. Current production
    uses `data` for list rows and `{ thread: ... }` for detail. Re-running with
    the correct response shape produced the nonempty Music detail above.

## 2026-06-26 - v530 thread-tile DOM authority count ready

- Scope:
  - Continued the v527-v529 empty-DOM/root-render authority chain by applying
    the same stable-signature DOM-shape invariant to thread-tile board renders.
  - This is a root-cause frontend render authority fix, not a UI hiding layer
    and not a retry/refresh fallback.
- Root-cause boundary:
  - Failing layer addressed: frontend thread-tile conversation DOM authority.
  - Violated invariant: a stable tile-board render signature is only reusable
    when the mounted tile DOM still contains the expected renderable tile turn
    rows. Single-thread DOM counting only checks `article.turn[data-turn]`,
    while tile panes render turns as
    `article.thread-tile-turn[data-thread-tile-turn]`.
- Changes:
  - `public/app.js` adds `threadTileVisibleShape()`,
    `threadTileVisibleTurnCount()`, and `threadTileDomTurnCount()`.
  - `renderThreadTileLayout()` now passes expected tile turn count, rendered
    tile DOM turn count, tile route/action metadata, and bounded pane-id hash
    into `updateConversationHtml()`.
  - Empty visible detail mismatch diagnostics can now override route/action/hash
    so tile authority failures are reported as `thread-tile`, not mislabeled as
    single-thread empty states.
  - Static shell/cache bumped to `codex-mobile-shell-v530`.
  - README, architecture optimization plan, and module map document the new
    tile DOM authority boundary.
- Acceleration process update:
  - The architecture plan now records the faster execution model: sub-agents do
    disjoint read-only investigations or disjoint write-set work; the main
    thread keeps architecture decisions, integration, full validation, deploy,
    and production readback.
  - A read-only sub-agent identified three next high-value cold-path slices:
    active large-thread overlay provider, thread-list fallback baseline service,
    and detail cold-path diagnosis service.
- Validation before deploy:
  - Focused:
    `node --test test/conversation-render.test.js test/mobile-viewport.test.js test/thread-detail-dom-patch.test.js test/thread-tile-layout.test.js test/thread-tile-state.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
    passed (`211` tests).
  - Full source `npm test` passed (`1039` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment status:
  - Code committed as `a930fa3` (`fix thread tile dom authority count`) and
    deployed from a clean source tree through the central Home AI macOS plugin
    deploy path.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260626T084442Z-plugin-codex-mobile-web-codex-mobile-thread-tile-dom-authority-v530`.
  - Production `/api/public-config` returned
    `clientBuildId=0.1.11|codex-mobile-shell-v530` and
    `shellCacheName=codex-mobile-shell-v530`.
  - Production static marker readback confirmed
    `codex-mobile-shell-v530`, `threadTileVisibleShape`,
    `threadTileDomTurnCount`, `thread-tile-render`,
    `thread-tile-empty-state`, and `data-thread-tile-turn`.
  - Source/prod SHA-256 matched for `public/app.js`, `public/sw.js`,
    `test/conversation-render.test.js`, `test/mobile-viewport.test.js`,
    `test/thread-goal-service.test.js`, `test/thread-task-card-route.test.js`,
    README, architecture optimization plan, and module map.
  - Authenticated production Music detail read returned HTTP `200`, `10`
    turns, item counts `[3,5,3,5,5,4,3,4,3,4]`, `39` visible item keys,
    `79` omitted turns, and read mode `projection-v4-dynamic`.
  - Authenticated production Music list search returned one matching row and no
    forbidden detail-only fields.

## 2026-06-26 - v531 thread-detail cold-path diagnosis local-only

- Scope:
  - Started the next Phase B large-session optimization slice by adding a
    bounded cold-path diagnosis service for thread detail loads.
  - This slice does not change the read strategy, projection cache strategy, UI
    rendering, or deployment state. It only maps existing bounded diagnostics
    into durable attribution fields for the next optimization steps.
- Root-cause boundary:
  - Failing layer under investigation: large-session and cold thread-detail load
    latency.
  - Violated invariant being instrumented: slow detail opens must identify the
    owning path instead of collapsing every delay into a generic client or
    server slow-path report.
  - Closure classification: diagnostic attribution, not fallback behavior. No
    hidden refresh, no extra retry loop, no synthetic projection, and no
    automatic repair-card dispatch.
- Changes:
  - Added `adapters/thread-detail-cold-path-diagnosis-service.js` with bounded
    owner/reason classification for warm projection, active full-read policy,
    projection cache misses, missing projection input, summary-sourced windows,
    turns-list fallback, thread-read fallback, and unknown states.
  - `adapters/thread-detail-performance-service.js` now adds
    `coldPathOwner` and `coldPathReason` to the server timing diagnostics.
  - `public/thread-performance-metrics.js` carries those fields into slow-path
    diagnostic planning, including values nested under `serverTimings`.
  - `public/thread-diagnostic-events.js` includes the cold-path owner/reason in
    bounded diagnostic context and breadcrumb fields.
  - Static shell/cache constants were bumped to `codex-mobile-shell-v531` so the
    next batched deployment can expose the new client diagnostic fields.
  - README, architecture optimization plan, and module map document the v531
    local-only slice.
- Validation:
  - Focused:
    `node --test test/thread-detail-cold-path-diagnosis-service.test.js test/thread-detail-performance-service.test.js test/thread-detail-read-orchestration-service.test.js test/thread-performance-metrics.test.js test/thread-diagnostic-events.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
    passed (`85` tests).
  - Full source `npm test` passed (`1046` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment status:
  - Not deployed by design. The user changed the optimization cadence: small
    slices should be validated and locally committed, then deployed only after a
    larger complete module is ready.
- Next Phase B candidates:
  - Extract active large-thread overlay ownership from the route/controller.
  - Serviceize thread-list fallback baseline/freshness decisions.
  - Use the new cold-path owner/reason evidence to decide whether the next
    root-cause fix belongs to projection input, projection cache, summary
    lookup, active-read policy, or app-server fallback.

## 2026-06-26 - thread-list fallback baseline service local-only

- Scope:
  - Continued Phase B with a small thread-list cold-path architecture slice.
  - This slice separates fallback baseline construction from process-lifetime
    fallback cache policy without changing fallback behavior, source internals,
    route aggregation, deferred fallback behavior, app-server list merge, static
    client assets, or deployment state.
- Root-cause boundary:
  - Failing layer under investigation: thread-list cold/warm path attribution
    and repeated baseline rebuild cost.
  - Violated invariant being addressed: cache hit/miss/TTL policy and cold
    baseline source collection must be independently testable so a slow
    `thread_list_rendered` event can identify whether time went to state DB,
    rollout session scanning, session-index fallback, merge/result volume, or
    cache freshness.
  - Closure classification: architecture boundary extraction and bounded
    diagnostics. No prewarm, no persistence, no hidden fallback behavior, and no
    automatic repair-card dispatch.
- Changes:
  - Added `adapters/thread-list-fallback-baseline-service.js` for state DB /
    rollout session / session-index fallback source collection, per-source
    timing/counts, source-order merge, and result limiting.
  - `adapters/thread-list-fallback-cache-service.js` now delegates cold
    miss/expired baseline construction to the baseline service while keeping
    cache-key, TTL, hit/miss/expired diagnostics, remember, and incremental
    updates.
  - `/api/threads` `mobileDiagnostics.threadListTimings` now includes bounded
    fallback source/result counts:
    `fallbackStateDbCount`, `fallbackRolloutCount`,
    `fallbackSessionIndexCount`, `fallbackBaselineSourceCount`, and
    `fallbackBaselineResultCount`.
  - `package.json` check coverage includes the new adapter.
  - README, architecture optimization plan, module map, and troubleshooting
    docs now describe the baseline/cache boundary and the new diagnostic fields.
- Validation:
  - Focused:
    `node --test test/thread-list-fallback-baseline-service.test.js test/thread-list-fallback-cache-service.test.js test/thread-performance-metrics.test.js test/thread-visibility.test.js`
    passed (`70` tests).
  - Full source `npm test` passed (`1049` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment status:
  - Not deployed by design. This is another local-only small slice under the
    updated module-batch cadence.
- Next Phase B candidates:
  - Use the new thread-list source/count timings from production after the next
    batched deploy to decide whether to optimize rollout source internals,
    session-index fallback, route merge/decorate, or cache freshness.
  - Continue with active large-thread overlay proof gating as the next detail
    read-risk reduction slice.

## 2026-06-26 - active window overlay orchestration seam local-only

- Scope:
  - Continued Phase B with a small active large-thread read-risk slice.
  - This slice wires the existing active-window overlay proof gate into
    `thread-detail-read-orchestration-service` as an injected provider seam.
  - Default runtime behavior remains unchanged because no real provider is
    wired yet: active/running detail reads still fail closed to full
    `thread/read` unless a provider supplies complete authoritative evidence.
- Root-cause boundary:
  - Failing layer under investigation: active large-thread detail opens that
    still require full `thread/read` to preserve live operations, uploads,
    assistant deltas, usage, and diagnostics.
  - Violated invariant being addressed: active read shortcuts must have an
    executable proof gate in the orchestration path, not only a detached policy
    test. Incomplete evidence must remain a full-read path.
  - Closure classification: architecture seam and bounded diagnostics. No real
    overlay provider, no automatic shortcut in production, no hidden refresh,
    no client dedupe, and no automatic repair-card dispatch.
- Changes:
  - `adapters/thread-detail-active-window-overlay-policy-service.js` now
    requires explicit assistant freshness evidence. Assistant items alone no
    longer imply fresh deltas. It also exposes
    `mergeProjectionThreadWithActiveOverlay()` for the pure projection-window +
    active-overlay-turn merge after the proof gate passes.
  - `adapters/thread-detail-read-orchestration-service.js` accepts an optional
    `resolveActiveWindowOverlay` provider. If active full-read is required and
    projection input exists, the service can test a partial projection candidate
    through `planActiveWindowOverlay()`. Complete evidence returns
    `projection-active-overlay`; provider-missing, resolver errors, non-
    authoritative source, missing/stale/unknown coverage, mismatch, or empty
    evidence all continue to the old full `thread/read` path.
  - `adapters/thread-detail-performance-service.js` records bounded active
    overlay diagnostics in `threadDetailTimings`: action, reason, source, item
    counts, and `activeOverlayMs`. It also classifies
    `projection-active-overlay` as `warm-projection-active-overlay`.
  - README, architecture optimization plan, module map, and troubleshooting
    docs describe the fail-closed seam and the provider still needed before
    production can avoid active full reads.
- Validation:
  - Focused:
    `node --test test/thread-detail-active-window-overlay-policy-service.test.js test/thread-detail-active-read-policy-service.test.js test/thread-detail-read-orchestration-service.test.js test/thread-detail-performance-service.test.js test/thread-detail-cold-path-diagnosis-service.test.js test/thread-performance-metrics.test.js`
    passed (`64` tests).
  - Full source `npm test` passed (`1054` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment status:
  - Not deployed by design. This is a local-only small slice under the updated
    module-batch cadence.
- Next Phase B candidates:
  - Build the real authoritative active overlay provider from server-owned live
    projection/notification state, still fail-closed.
  - After a batched deploy, use `activeOverlayReason` and `coldPathOwner` to
    decide whether active large-thread slow opens are blocked by provider
    absence, stale deltas, missing receipt coverage, projection miss, or app-
    server fallback.

## 2026-06-26 - live active overlay provider local-only

- Scope:
  - Continued Phase B by wiring a real server-owned active overlay provider into
    the existing fail-closed read-orchestration seam.
  - This slice does not change client rendering, tile layout, task-card
    protocol, shell/cache ids, deployment state, or public repository state.
- Root-cause boundary:
  - Failing layer addressed: active/running large-thread detail reads that
    could only avoid full `thread/read` with complete server-owned live
    evidence.
  - Violated invariant: a notification-updated live projection shell must not
    become a normal detail projection, but it can provide bounded active-turn
    evidence to the active overlay proof gate.
  - Closure classification: root-cause architecture wiring, not fallback. No UI
    dedupe, no forced refresh, no hidden retry, no disk read, and no automatic
    repair-card dispatch.
- Changes:
  - `adapters/thread-detail-projection-service.js` exposes
    `activeOverlaySnapshot()`, a memory-only clone-only snapshot of the matching
    active turn from dynamic notification-updated entries. It rejects missing
    thread ids, missing active turn ids, absent entries, and non-dynamic static
    cache entries.
  - `adapters/thread-detail-projection-v4-service.js` normalizes active overlay
    snapshots with v4 visible keys and adds monotonic `overlayRevision`
    metadata for assistant-delta freshness proof.
  - Added `adapters/thread-detail-active-overlay-provider-service.js` to convert
    the snapshot into bounded active overlay policy evidence: active turn id,
    overlay source, cloned overlay turn, coverage counts, operation/upload/
    receipt coverage, and v4 revision/timestamp metadata.
  - `server.js` now injects the provider into
    `thread-detail-read-orchestration-service`. Missing snapshot, mismatched
    active turn, incomplete coverage, unknown item kinds, or missing assistant
    freshness still fail closed to full `thread/read` and report bounded
    `activeOverlayReason`.
  - `thread-detail-active-window-overlay-policy-service.js` recognizes
    `turnUsageSummary` as receipt evidence and preserves bounded provider
    unavailable reasons.
  - README, architecture optimization plan, module map, and troubleshooting docs
    record the provider boundary and local-only status.
- Validation:
  - Focused:
    `node --test test/thread-detail-active-overlay-provider-service.test.js test/thread-detail-active-window-overlay-policy-service.test.js test/thread-detail-read-orchestration-service.test.js test/thread-detail-projection-service.test.js test/thread-detail-projection-v4-service.test.js`
    passed (`62` tests).
  - Full source `npm test` passed (`1060` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment status:
  - Not deployed by design. This remains a local-only small slice under the
    updated module-batch cadence.
- Next Phase B candidates:
  - Add route-level or harness evidence that active large-thread reads in a
    live notification scenario return `projection-active-overlay` without full
    `thread/read`.
  - Batch deploy the Phase B local slices, then inspect production
    `activeOverlayReason`, `coldPathOwner`, and thread-list fallback source
    timings before choosing the next root-cause optimization.

## 2026-06-26 - active overlay real-service integration local-only

- Scope:
  - Continued Phase B by proving the active overlay path through real service
    composition instead of only provider/policy mocks.
  - This slice keeps the same local-only cadence: no deployment, no shell/cache
    bump, no frontend UI change, and no public push.
- Root-cause boundary:
  - Failing layer addressed: the provider was wired, but the real projection
    result service still rejected partial windows that lacked the local active
    turn before the provider could merge the live active turn.
  - Violated invariant: ordinary projection hits must contain the local active
    turn, but active-overlay assembly is a narrow exception because the
    provider supplies that active turn and the proof gate validates coverage
    before response.
  - Closure classification: root-cause integration fix and test coverage, not
    fallback behavior. No client dedupe, no forced refresh, no retry loop, and
    no automatic repair-card dispatch.
- Changes:
  - `adapters/thread-detail-projection-result-service.js` now accepts an
    `{ activeOverlay: true }` option. Normal projection hits still reject cached
    details missing the local active turn; only active-overlay assembly can
    prepare a partial projection window without that turn.
  - `server.js` forwards projection lookup options into
    `prepareProjectedThreadReadResult()`, so the active-overlay branch can use
    the narrow exception while normal projection lookup cannot.
  - Added `test/thread-detail-active-overlay-integration.test.js`, which uses
    real v4 projection, projection input/result, active overlay provider, and
    read orchestration services. It proves normal lookup rejects partial,
    active-overlay lookup gets the partial window, the provider merges the live
    notification turn, and no full `thread/read` or `turns-list` call occurs.
  - `test/thread-detail-projection-result-service.test.js` locks the normal
    projection invariant and the active-overlay-only exception.
  - `test/turn-usage-summary-service.test.js` source-string coverage was
    updated to assert the options wrapper instead of the old three-argument
    call shape.
  - README, architecture optimization plan, and module map document the
    integration boundary and the current local-only status.
- Validation:
  - Focused:
    `node --test test/thread-detail-active-overlay-integration.test.js test/thread-detail-projection-result-service.test.js test/turn-usage-summary-service.test.js`
    passed (`18` tests).
  - Full source `npm test` passed (`1062` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment status:
  - Not deployed by design. This remains part of the Phase B local batch.
- Next Phase B candidates:
  - Add a route/server smoke or production readback after batching these slices
    to confirm real `/api/threads/:id?mode=recent` active loads expose
    `projection-active-overlay` and bounded `activeOverlayReason` values.
  - Use the new evidence fields after deploy to decide whether remaining slow
    opens come from projection miss/staleness, assistant freshness, missing
    receipt coverage, or thread-list fallback cold paths.

## 2026-06-26 - thread detail route boundary local-only

- Scope:
  - Continued Phase B by extracting the `/api/threads/:id` read-route
    coordination from `server.js` into a focused adapter.
  - This is a small local-only architecture slice. It does not deploy, bump the
    shell/cache, change UI, or publish Public.
- Root-cause boundary:
  - Failing layer addressed: route-level behavior for large-thread detail reads
    was still partly source-string asserted inside `server.js`, making it hard
    to prove `mode=recent`, bounded route logging, response sending, and
    incomplete-response semantics independently.
  - Violated invariant: high-risk thread-detail coordination should be
    executable behavior, not coupled to a monolithic route body or regex checks
    against `server.js`.
  - Closure classification: root-cause boundary extraction and executable test
    coverage, not a fallback or client-side masking layer.
- Changes:
  - Added `adapters/thread-detail-route-service.js` with
    `handleThreadDetailReadRoute()`. It maps `mode=recent` to
    `preferRecentTurns`, builds bounded `threadLog` entries with elapsed time,
    sends the JSON response, preserves `complete=false`, and leaves HTTP
    matching/lifecycle ownership in `server.js`.
  - `server.js` now delegates `/api/threads/:id` read-route coordination to
    the adapter while continuing to track request lifecycle at the HTTP layer.
  - Added `test/thread-detail-route-service.test.js` for recent-mode mapping,
    complete logging, `complete=false` suppression, status/body response, and
    invalid wiring behavior.
  - Updated old source-string tests to assert the new route boundary instead of
    requiring inline `sendJson` / `preferRecentTurns` code in `server.js`.
  - README, architecture optimization plan, and module map document the new
    boundary.
- Validation:
  - Focused:
    `node --test test/thread-detail-route-service.test.js test/thread-visibility.test.js`
    passed (`48` tests).
  - Full source `npm test` passed (`1065` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment status:
  - Not deployed by design. This remains part of the Phase B local batch.
- Next Phase B candidates:
  - Add route/server smoke around the real `/api/threads/:id?mode=recent`
    response after batching local slices, then deploy once the module batch is
    coherent.
  - Continue decomposing `server.js` only where it creates direct evidence for
    large-session load correctness, projection consistency, or task-card
    runtime safety.

## 2026-06-26 - active overlay route smoke local-only

- Scope:
  - Continued Phase B by adding route-level integration evidence for the active
    overlay path without starting the production HTTP server or reading private
    runtime session content.
  - This is still local-only under the small-slice cadence. It does not deploy,
    bump shell/cache, change runtime/static UI, or push Public.
- Root-cause boundary:
  - Failing layer addressed: route coordination and read orchestration were now
    independently testable, but there was no single executable proof that
    `/api/threads/:id?mode=recent` route wiring can drive the real read
    orchestration to `projection-active-overlay`.
  - Violated invariant: large active-thread first paint must be verified across
    the route boundary and read orchestration boundary, not only through
    separate unit tests or source-string assertions.
  - Closure classification: executable integration coverage only. No fallback,
    no client dedupe, no forced refresh, and no route behavior change.
- Changes:
  - `test/thread-detail-active-overlay-integration.test.js` now factors the
    active-overlay fixture and adds a route smoke case. The new case calls
    `handleThreadDetailReadRoute()` with `/api/threads/thread-1?mode=recent`,
    routes into the real `thread-detail-read-orchestration-service`, captures
    route logs/response, and proves the result is `projection-active-overlay`.
  - The route smoke also proves the recent-mode request reaches orchestration,
    no full `thread/read` or `turns-list` call is made, and bounded route logs
    include active-overlay and completion events.
  - README and the architecture optimization plan now record that the
    route-level active-overlay smoke exists.
- Validation:
  - Focused:
    `node --test test/thread-detail-active-overlay-integration.test.js test/thread-detail-route-service.test.js`
    passed (`5` tests).
  - Full source `npm test` passed (`1066` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment status:
  - Not deployed by design. This remains part of the Phase B local batch.
- Next Phase B candidates:
  - The active-overlay route path is now covered locally. Next useful slice is
    either runtime readback harnessing for production deploy, or thread-list
    cold-path evidence that identifies whether slow first opens are coming from
    fallback baseline source collection, projection cache misses, or app-server
    fallback.

## 2026-06-26 - thread-list cold-path attribution local-only

- Scope:
  - Continued Phase B by adding bounded owner/reason attribution for
    `/api/threads` thread-list cold/warm paths.
  - This is a local-only evidence slice. It does not deploy, bump shell/cache,
    change UI, change fallback cache behavior, or push Public.
- Root-cause boundary:
  - Failing layer addressed: thread-list diagnostics exposed raw fallback
    cache decisions, per-source timings, counts, and app-server timings, but
    production readback still required manual interpretation to know whether
    slow opens came from warm cache reuse, deferred fallback, baseline source
    collection, TTL expiry, or app-server failure.
  - Violated invariant: Phase B cold-path evidence should classify the owning
    layer from bounded fields, not require private logs or ad hoc human
    inference.
  - Closure classification: diagnostic attribution only. No fallback,
    prewarm/persist cache, client dedupe, forced refresh, or source-reading
    behavior change.
- Changes:
  - Added `adapters/thread-list-cold-path-diagnosis-service.js`. It maps
    existing bounded thread-list timing fields to `coldPathOwner` /
    `coldPathReason` for `warm-fallback-cache`, `deferred-fallback`,
    `fallback-baseline`, `fallback-cache-policy`, `app-server-thread-list`, or
    `unknown`.
  - `/api/threads` now attaches those fields to
    `mobileDiagnostics.threadListTimings` before logging/sending the response.
  - Added `test/thread-list-cold-path-diagnosis-service.test.js` covering
    deferred fallback, warm cache hit, miss rebuild dominant source, TTL
    rebuild, app-server-only/app-server-error paths, and privacy-bounded output.
  - `test/thread-visibility.test.js` now asserts server wiring for
    `coldPathOwner` / `coldPathReason`.
  - README, architecture optimization plan, module map, and `package.json`
    check script were updated for the new adapter.
- Validation:
  - Focused:
    `node --test test/thread-list-cold-path-diagnosis-service.test.js test/thread-list-fallback-cache-service.test.js test/thread-list-fallback-baseline-service.test.js test/thread-visibility.test.js test/thread-performance-metrics.test.js`
    passed (`74` tests).
  - Full source `npm test` passed (`1070` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment status:
  - Not deployed by design. This remains part of the Phase B local batch.
- Next Phase B candidates:
  - Add a production-readback/smoke script for the batched Phase B diagnostics
    before deploy, so deployment can verify `projection-active-overlay` and
    thread-list `coldPathOwner` values without private message/log content.
  - Use production readback after the batch deploy to decide whether the next
    root-cause optimization should target fallback baseline source collection,
    cache freshness, projection miss lifecycle, or app-server fallback.

## 2026-06-26 - Phase B readback smoke local-only

- Scope:
  - Continued Phase B by adding a bounded post-deploy readback gate for the
    local Phase B diagnostics batch.
  - This is local-only tooling and documentation. It does not deploy, bump
    shell/cache, change runtime behavior, change UI, push Public, or read
    private thread/card/upload bodies.
- Root-cause boundary:
  - Failing layer addressed: prior Phase B slices added active-overlay and
    thread-list cold-path diagnostics, but the batch still lacked a single
    production readback command that proves `/api/public-config`,
    `/api/threads`, and `/api/threads/:id?mode=recent` expose the expected
    bounded evidence after deployment.
  - Violated invariant: production validation should use bounded structured
    metadata from the owning routes, not manual visual checks, private logs, or
    ad hoc thread-content inspection.
  - Closure classification: validation harness only. No fallback, client
    dedupe, forced refresh, cache rebuild policy, or projection behavior
    change.
- Changes:
  - Added `scripts/codex-mobile-phase-b-readback-smoke.js`.
    The script reads `/api/public-config`, `/api/threads`, and optionally
    `/api/threads/:id?mode=recent`; validates thread-list
    `coldPathOwner` / `coldPathReason`, thread-detail timings, and optional
    `projection-active-overlay`; and emits only safe build ids, short hashes,
    owner/reason labels, counts, and timings.
  - Added `test/phase-b-readback-smoke.test.js` covering the smoke path,
    missing cold-path fields, `--allow-missing-cold-path`, active-overlay
    requirement, and privacy-bounded summaries.
  - `package.json` now includes the readback smoke script in `npm run check`.
  - README, architecture optimization plan, and module map now document the
    Phase B readback command and evidence boundary.
- Validation:
  - Focused:
    `node --test test/phase-b-readback-smoke.test.js test/thread-list-cold-path-diagnosis-service.test.js test/thread-list-fallback-cache-service.test.js test/thread-visibility.test.js test/thread-detail-active-overlay-integration.test.js`
    passed (`60` tests).
  - Full source `npm test` passed (`1073` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment status:
  - Not deployed by design. This remains part of the Phase B local batch.
- Next Phase B candidates:
  - When the Phase B batch is ready, deploy once through the central macOS
    plugin deploy path and run
    `node scripts/codex-mobile-phase-b-readback-smoke.js --json` against
    production. For an active thread, also pass `--thread-id <id>
    --require-active-overlay`.
  - Use the readback result to choose the next root-cause target:
    fallback-baseline source collection, cache freshness, projection miss
    lifecycle, or app-server fallback.

## 2026-06-26 - Phase B readback decision local-only

- Scope:
  - Continued Phase B by making the readback smoke output directly actionable.
  - This is local-only decision tooling and documentation. It does not deploy,
    bump shell/cache, change runtime read strategy, change UI, push Public, or
    read private thread/card/upload bodies.
- Root-cause boundary:
  - Failing layer addressed: Phase B readback could verify bounded fields, but
    still required humans to map `coldPathOwner`, `coldPathReason`, read mode,
    projection state, and active-overlay evidence into the next root-cause
    repair target.
  - Violated invariant: post-deploy Phase B validation should produce an
    explicit bounded next action such as active-overlay coverage, projection
    cache lifecycle, projection input availability, thread-list fallback
    baseline, cache freshness, or app-server fallback. It should not require
    private logs, message text, card bodies, upload contents, or visual guesswork.
  - Closure classification: decision-policy extraction only. No fallback,
    cache rebuild policy, prewarm/persist behavior, forced refresh, client
    dedupe, or projection behavior change.
- Changes:
  - Added `adapters/phase-b-readback-decision-service.js`. It maps the
    bounded Phase B readback report into a `decision` with `status`,
    `priority`, `owner`, `reason`, `nextAction`, and safe evidence fields.
  - `scripts/codex-mobile-phase-b-readback-smoke.js` now includes that
    `decision` in its JSON output.
  - Added `test/phase-b-readback-decision-service.test.js` for missing
    readback contract fields, active-overlay gaps, projection-cache misses,
    thread-list fallback-baseline ownership, ready warm paths, and
    privacy-bounded evidence.
  - `package.json`, README, architecture optimization plan, and module map now
    register the decision boundary.
  - A read-only subagent reviewed the next Phase B root-cause target and
    independently recommended thread-list fallback source snapshot/reuse below
    the final-list cache as the next local coding slice.
- Validation:
  - Focused:
    `node --test test/phase-b-readback-decision-service.test.js test/phase-b-readback-smoke.test.js test/thread-list-cold-path-diagnosis-service.test.js test/thread-detail-performance-service.test.js`
    passed (`21` tests).
  - Full source `npm test` passed (`1079` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment status:
  - Not deployed by design. This remains part of the Phase B local batch.
- Next Phase B candidate:
  - Implement memory-only thread-list fallback source snapshot/reuse under
    `thread-list-fallback-baseline-service`, so repeated final-list cache misses
    for different `cwd/search/limit` keys can reuse the same state DB / rollout
    / session-index candidate source set before applying existing filtering and
    merge policy. Keep it memory-only, bounded, observable, and covered by
    focused tests.

## 2026-06-26 - thread-list source snapshot reuse local-only

- Scope:
  - Continued Phase B with the first root-cause performance optimization after
    the readback decision slice.
  - This is a local-only server/runtime source-cache optimization. It does not
    deploy, bump shell/cache, change UI, push Public, persist cache data, or
    change app-server thread-list authority.
- Root-cause boundary:
  - Failing layer addressed: final thread-list fallback cache keys include
    `cwd`, `search`, and `limit`, so multiple final-list misses in the same
    process could repeatedly call the expensive state DB / rollout /
    session-index fallback readers even when the visible source universe had
    not changed.
  - Violated invariant: after cold start or deploy restart, ordinary filtered
    list rebuilds should reuse already-read source evidence and only reapply
    existing filter/merge/limit policy, rather than rescanning all fallback
    sources for every final-list key.
  - Closure classification: memory-only source snapshot reuse below the
    final-list cache. This is not a UI fallback, forced refresh, persisted
    prewarm, app-server replacement, or masking layer. It keeps source snapshots
    process-local and bounded, and diagnostics expose hit/build/raw-count fields.
- Changes:
  - `adapters/thread-list-fallback-baseline-service.js` now supports
    visibility-scoped source snapshots. It reads state DB / rollout /
    session-index sources once per source key, then reapplies existing
    `filterFallbackThreads`, `mergeThreadSummaryList`, and `limit` for each
    final-list request.
  - `adapters/thread-list-fallback-cache-service.js` now passes a source
    snapshot key/limit to the baseline service, carries source snapshot
    diagnostics, and updates/removes snapshot rows during incremental cache
    changes so new final-list keys do not use stale source data.
  - `/api/threads` diagnostics now include bounded
    `fallbackSourceSnapshotHit`, age, limit, build, and raw-count fields.
  - `thread-list-cold-path-diagnosis-service` recognizes
    `fallback-source-snapshot` so a final-list miss that reuses source evidence
    is not misclassified as an expensive baseline rebuild.
  - Phase B readback summary and decision evidence now include source snapshot
    fields; source snapshot hits are treated as ready evidence rather than an
    H2 baseline repair signal.
  - README, architecture optimization plan, and module map were updated.
- Validation:
  - Focused:
    `node --test test/thread-list-fallback-baseline-service.test.js test/thread-list-fallback-cache-service.test.js test/thread-list-cold-path-diagnosis-service.test.js test/phase-b-readback-smoke.test.js test/phase-b-readback-decision-service.test.js test/thread-visibility.test.js test/thread-status-hints.test.js`
    passed (`76` tests).
  - Full source `npm test` passed (`1083` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment status:
  - Not deployed by design. This remains part of the Phase B local batch.
- Next Phase B candidates:
  - Batch-deploy the Phase B module when ready, then run
    `node scripts/codex-mobile-phase-b-readback-smoke.js --json` and inspect
    `decision.owner`, `fallbackSourceSnapshotHit`, and detail cold-path fields.
  - If production still shows slow thread-list reads with
    `fallback-source-snapshot` ready, shift to projection-cache or active-overlay
    evidence; if it still shows `fallback-baseline`, inspect source snapshot key
    invalidation/freshness before adding any broader cache.

## 2026-06-26 - Phase B module deployed and readback classified

- Scope:
  - Home AI redirected the routine Codex Mobile Web deploy/readback card back to
    the plugin-owned loop. The plugin thread completed the validation,
    production deploy, and bounded Phase B readback from this workspace.
  - No source edits were made in this step.
- Source state:
  - Deployed source commit: `bc9b8b3a58de` (`reuse thread list fallback source
    snapshots`).
  - Source worktree was clean before deploy.
- Validation before deploy:
  - `npm test` passed (`1083` tests).
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Deployment:
  - Central Home AI macOS deploy command succeeded for plugin
    `codex-mobile-web`.
  - Production path: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260626T103932Z-plugin-codex-mobile-web-codex-mobile-phase-b-module`.
  - Production health readback returned `version=0.1.11`,
    `clientBuildId=0.1.11|codex-mobile-shell-v531`,
    `shellCacheName=codex-mobile-shell-v531`. This batch did not touch static
    shell files, so no shell/cache bump was expected.
- Phase B readback:
  - First production smoke after restart:
    - thread list: `coldPathOwner=fallback-baseline`,
      `coldPathReason=miss-rebuild:rollout`, total about `3132ms`,
      fallback about `2671ms`, source snapshot build count `1`.
    - detail: active thread used full thread read,
      `projectionState=miss`, `projectionMissReason=dynamic-summary-stale`,
      `activeOverlayAction=require-full-read`,
      `activeOverlayReason=missing-active-turn-id`.
    - decision: `needs_repair`, `priority=H1`, `owner=active-overlay`,
      `nextAction=complete-active-window-overlay-coverage`.
  - Second production smoke:
    - thread list: `coldPathOwner=warm-fallback-cache`,
      `coldPathReason=cache-hit`, total about `499ms`, fallback about `1ms`.
    - detail remained active full read with the same active-overlay gap.
- Current conclusion:
  - The deployed Phase B source snapshot/cache work improves warm thread-list
    reads and proves that repeated entry after the initial post-restart cold
    read no longer rebuilds fallback sources.
  - The next high-priority optimization target should be active thread detail
    overlay coverage: active list/detail state lacks a reliable active turn id,
    so projection misses still force expensive full-thread reads and can
    contribute to missing/late visible replies.

## 2026-06-26 - active overlay active-turn ownership local slice

- Scope:
  - Started the next active-detail module slice after production readback
    identified `activeOverlayReason=missing-active-turn-id`.
  - This is a local source/test/docs slice. It has not been deployed or pushed
    Public under the new cadence; batch it with the rest of the active-detail
    module before production deploy/readback.
- Root-cause boundary:
  - Symptom: active thread detail can have summary `status=active` but no
    summary-level active turn id. The active overlay provider then fails before
    querying the server-owned live projection shell and read orchestration
    falls back to full `thread/read`.
  - Failing layer: server active-overlay provider / live projection shell
    ownership, not client rendering or UI dedupe.
  - Violated invariant: a server-owned live notification projection that
    receives `turn/started` and active item events must own the current active
    turn id needed by the active-overlay proof gate. Summary rows are allowed to
    prove only active status.
  - Root cause: `thread-detail-projection-service` updated the notification
    shell turn contents but did not retain `thread.activeTurnId`, and
    `thread-detail-active-overlay-provider-service` required
    `summaryActiveTurnId()` before asking the projection service for a snapshot.
  - Closure classification: root-cause ownership fix. No fallback, no client
    refresh/dedupe, no proof-gate relaxation.
- Changes:
  - `adapters/thread-detail-projection-service.js`
    - Retains `thread.activeTurnId` on `turn/started` and active item/delta
      notifications.
    - Clears it when the same turn completes.
    - Lets `activeOverlaySnapshot()` infer the active turn from live projection
      state when the caller does not provide an active turn id.
  - `adapters/thread-detail-active-overlay-provider-service.js`
    - Calls the projection snapshot API even when summary only exposes active
      status, then uses the snapshot's bounded active turn id if available.
    - Still returns bounded unavailable reasons when the snapshot or evidence
      is missing.
  - Tests:
    - Projection service snapshot inference and completion clearing.
    - Provider inference from live projection with summary-only active status.
    - Read orchestration integration returning `projection-active-overlay`
      without full `thread/read` when summary lacks `activeTurnId`.
  - README, architecture optimization plan, and module map were updated to
    reflect the deployed Phase B readback and this local follow-up slice.
- Validation so far:
  - Focused:
    `node --test test/thread-detail-projection-service.test.js test/thread-detail-projection-v4-service.test.js test/thread-detail-active-overlay-provider-service.test.js test/thread-detail-active-overlay-integration.test.js test/thread-detail-read-orchestration-service.test.js test/phase-b-readback-decision-service.test.js`
    passed (`62` tests).
- Next validation:
  - Run full `npm test`, `npm run check`, `npm run check:macos`, and
    `git diff --check`.
  - Commit locally if full validation passes. Do not deploy this single slice
    unless the active-detail module is ready or the user explicitly requests it.

## 2026-06-26 - active overlay stale-window lookup local slice

- Scope:
  - Continued the active-detail module with a second local slice after the
    production readback also showed `projectionMissReason=dynamic-summary-stale`.
  - This is not deployed or pushed Public. Batch with the active-detail module
    before production readback.
- Root-cause boundary:
  - Symptom: active overlay orchestration asks for a projection window with
    `{ allowPartial: true, activeOverlay: true }`, but the projection cache
    treats a summary timestamp newer than the dynamic entry as
    `dynamic-summary-stale`. That can leave the overlay provider with a live
    turn but no projection window, forcing full `thread/read`.
  - Failing layer: projection lookup policy for active-overlay window assembly.
  - Violated invariant: ordinary projection hits must fail closed on stale
    summary evidence, but active-overlay assembly has a stricter downstream
    proof gate and may use an older dynamic entry as a bounded window skeleton
    when the summary is still active and live overlay evidence will supply the
    current turn.
  - Root cause: `thread-detail-projection-service.lookup()` had a single
    summary-staleness rule shared by ordinary projection reads and
    proof-gated active overlay window reads.
  - Closure classification: root-cause policy split. No UI fallback, no forced
    refresh, no ordinary stale projection reuse, and no proof-gate relaxation.
- Changes:
  - `adapters/thread-detail-projection-service.js`
    - Keeps `dynamic-summary-stale` behavior for normal lookups.
    - Allows a dynamic summary-stale entry only when the caller explicitly
      passes `activeOverlay=true`, `allowPartial=true`, and the summary status
      remains active/running.
  - Tests:
    - Projection service proves ordinary stale lookup still misses, active
      overlay lookup can reuse the window, and resting summaries still miss.
    - Read orchestration integration proves active overlay can return
      `projection-active-overlay` despite active summary staleness without
      full `thread/read`.
  - README, architecture optimization plan, and module map were updated.
- Validation so far:
  - Focused:
    `node --test test/thread-detail-projection-service.test.js test/thread-detail-projection-v4-service.test.js test/thread-detail-active-overlay-provider-service.test.js test/thread-detail-active-overlay-integration.test.js test/thread-detail-read-orchestration-service.test.js test/phase-b-readback-decision-service.test.js`
    passed (`64` tests).
- Next validation:
  - Run full `npm test`, `npm run check`, `npm run check:macos`, and
    `git diff --check`.
  - Commit locally if full validation passes. Do not deploy this single slice
    unless the active-detail module is ready or the user explicitly requests it.

## 2026-06-26 - active overlay readback gate local slice

- Scope:
  - Added a third active-detail local slice so the next module deploy/readback
    can classify the active-overlay proof gate instead of only exposing raw
    timing fields.
  - This is readback/decision tooling and documentation only. It does not
    change runtime read behavior, UI, PWA shell/cache, or task-card protocol.
  - Not deployed or pushed Public. Batch with the active-detail module before
    production readback.
- Root-cause boundary:
  - Symptom: after fixing `missing-active-turn-id` and
    `dynamic-summary-stale` locally, the next production smoke would still need
    manual interpretation to decide whether any remaining failure is missing
    snapshot, assistant freshness, receipt/operation/upload coverage, item kind,
    or source authority.
  - Failing layer: post-deploy evidence classification, not the live read path.
  - Violated invariant: active-detail module deployment must produce bounded
    next-action evidence from `/api/threads/:id?mode=recent` without private
    logs or message text.
  - Root cause: `scripts/codex-mobile-phase-b-readback-smoke.js` summarized
    only raw `activeOverlayAction` / `activeOverlayReason` / item count, and
    `phase-b-readback-decision-service` reduced active full reads to generic
    `status-active` / `complete-active-window-overlay-coverage`.
  - Closure classification: diagnostic/readback gate only. No fallback, no
    forced refresh, no client dedupe, no runtime proof-gate relaxation.
- Changes:
  - `scripts/codex-mobile-phase-b-readback-smoke.js`
    - Adds `classifyActiveOverlayGate()`.
    - Detail summary now includes `activeOverlayGate`,
      `activeOverlayGateReason`, `activeOverlayNextAction`, and
      operation/upload/assistant/receipt counts.
    - Gate next actions include active turn ownership, stale window lookup,
      provider wiring, live snapshot, assistant freshness, receipt coverage,
      operation/upload coverage, item-kind normalization, and source authority.
  - `adapters/phase-b-readback-decision-service.js`
    - Carries gate fields in bounded evidence.
    - Uses gate reason/nextAction for H1 active-overlay readback decisions.
  - Tests:
    - Gate classification for ready, missing active turn, stale window, and
      non-active reads.
    - Readback privacy bounds still exclude private titles/messages.
    - Decision service uses gate reason/action instead of generic active status.
  - README, architecture optimization plan, and module map were updated.
- Validation so far:
  - Focused:
    `node --test test/phase-b-readback-smoke.test.js test/phase-b-readback-decision-service.test.js test/thread-detail-active-overlay-integration.test.js test/thread-detail-projection-service.test.js`
    passed (`41` tests).
- Next validation:
  - Run full `npm test`, `npm run check`, `npm run check:macos`, and
    `git diff --check`.
  - Commit locally if full validation passes. Do not deploy this single slice
    unless the active-detail module is ready or the user explicitly requests it.

## 2026-06-26 - active overlay bounded projection window local slice

- Scope:
  - Continued the active-detail module with a fourth local slice after the
    deployed readback gate classified the remaining active detail blocker as
    `activeOverlayGateReason=missing-projection-window`.
  - This is a server read-orchestration/root-cause slice plus tests/docs. It
    has not been pushed Public. Under the current cadence, small slices are
    committed locally and deployed only when the module is ready for a batch
    production readback.
- Root-cause boundary:
  - Symptom: an active thread can have a server-owned live overlay snapshot
    with the current active turn and coverage evidence, but no reusable
    projection window. The proof gate then reports `missing-projection-window`
    and orchestration falls back to full `thread/read`.
  - Failing layer: thread-detail read orchestration's active-overlay window
    assembly, not client render dedupe, scroll behavior, or UI refresh.
  - Violated invariant: active overlay may avoid full `thread/read` only when
    both sides are present: a bounded projection/window skeleton for stable
    historical turns and an authoritative live active turn from the provider.
    Missing the window should not force a full read if a bounded current window
    can be built and then proven by the same active overlay policy.
  - Root cause: read orchestration had only two active paths: reuse an existing
    projection window or full `thread/read`. It did not have a non-persisted
    `turns-list` window skeleton path for the strict active-overlay proof gate.
  - Closure classification: root-cause policy/ownership fix. No frontend
    duplicate hiding, no forced refresh, no ordinary stale/partial projection
    exposure, and no proof-gate relaxation.
- Changes:
  - `adapters/thread-detail-read-orchestration-service.js`
    - Adds a bounded `turns-list-active-overlay-window` path only after the
      first active-overlay plan fails with `missing-projection-window` and the
      provider has already supplied a live overlay turn.
    - Marks that result as a non-persisted partial active-overlay window, then
      re-runs `planActiveWindowOverlay()` with the provider revision/timestamp.
    - Still falls back to full `thread/read` when provider evidence is missing
      or the second proof gate does not return `use-projection-overlay`.
  - `test/thread-detail-read-orchestration-service.test.js`
    - Proves the new path returns `projection-active-overlay`, preserves older
      bounded turns plus the live active turn, records bounded diagnostics, and
      does not call full `thread/read`.
  - `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md` document the active-overlay window skeleton boundary.
- Validation:
  - Focused:
    `node --test test/thread-detail-read-orchestration-service.test.js test/thread-detail-active-overlay-integration.test.js test/thread-detail-active-overlay-provider-service.test.js test/phase-b-readback-smoke.test.js test/phase-b-readback-decision-service.test.js`
    passed (`35` tests).
  - Full `npm test` passed (`1090` tests).
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Next:
  - Commit this local slice.
  - If the active-detail module is considered ready for the next batch, deploy
    through the central macOS plugin deploy script and run
    `scripts/codex-mobile-phase-b-readback-smoke.js --require-active-overlay`
    to see whether production reaches `projection-active-overlay` or exposes
    the next proof-gate reason.

## 2026-06-26 - active overlay window deployed and readback ready

- Deployment:
  - Committed `c1497eb` (`use bounded active overlay window`) after focused,
    full, static, macOS, and diff-check validation.
  - Deployed through Home AI central macOS plugin deploy path with reason
    `codex-mobile-active-overlay-window`.
  - Deploy source ref: `c1497eb8ac3c`, dirty false.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260626T111129Z-plugin-codex-mobile-web-codex-mobile-active-overlay-window`.
  - Health check returned `version=0.1.11`,
    `clientBuildId=0.1.11|codex-mobile-shell-v531`, and
    `shellCacheName=codex-mobile-shell-v531`. Static shell files were not
    changed, so no shell/cache bump was expected.
- Production readback:
  - Command:
    `node scripts/codex-mobile-phase-b-readback-smoke.js --server http://127.0.0.1:8787 --require-active-overlay --json`
    passed.
  - Thread list readback:
    - `coldPathOwner=deferred-fallback`,
      `coldPathReason=active-thread-detail`, total about `284ms`.
    - Fallback baseline was intentionally deferred while active thread detail
      was prioritized.
  - Detail readback:
    - `readMode=projection-active-overlay`.
    - `readDecision=projection-active-overlay`.
    - `coldPathOwner=warm-path`.
    - `coldPathReason=warm-projection-active-overlay`.
    - `projectionState=hit`.
    - `activeOverlayAction=use-projection-overlay`.
    - `activeOverlayReason=overlay-evidence-complete`.
    - `activeOverlayGate=ready`.
    - `activeOverlayNextAction=observe-active-overlay-readback`.
  - Decision:
    - `status=observe`, `priority=H3`, owner
      `thread-list-deferred-fallback`, next action
      `observe-deferred-fallback-before-optimizing`.
- Current conclusion:
  - The active-detail module has moved past the prior production blockers:
    `missing-active-turn-id`, `dynamic-summary-stale`, and
    `missing-projection-window`.
  - Active thread detail can now avoid full `thread/read` through
    proof-gated `projection-active-overlay`.
  - The next Phase B target should be thread-list deferred/cold fallback
    observation or client render/patch ownership, depending on fresh live
    diagnostics. Do not regress active-overlay proof-gate strictness.

## 2026-06-26 - deferred thread-list readback verification local slice

- Scope:
  - Started the next Phase B thread-list cold/deferred path slice after active
    detail readback reached `projection-active-overlay`.
  - This slice changes only local readback/decision tooling and docs. It does
    not change runtime server behavior, frontend behavior, shell/cache files,
    fallback cache policy, prewarm, or persistence.
- Root-cause boundary:
  - Symptom: production readback can show `coldPathOwner=deferred-fallback`
    and `fallbackDeferredReason=active-thread-detail`, but a single readback
    sample cannot prove whether the deferred full list later becomes warm or
    whether the next foreground list still pays repeated cold fallback rebuild
    cost.
  - Failing layer addressed: Phase B evidence/readback classification, not the
    actual thread-list fallback runtime.
  - Violated invariant: after cold start/redeploy/restart, fallback baseline
    rebuild may happen once, but repeated normal foreground refreshes should
    hit warm cache/source snapshot or receive bounded evidence identifying the
    true cold owner.
  - Root cause: the Phase B smoke stopped at the initial deferred thread-list
    response and classified it as H3 observation without verifying the
    follow-up full list and same-key warm check.
  - Closure classification: diagnostic/readback evidence only. No fallback,
    no prewarm, no forced refresh, no cache invalidation change.
- Changes:
  - `scripts/codex-mobile-phase-b-readback-smoke.js`
    - Adds default deferred-fallback verification. If the first thread-list
      read is deferred, the smoke reads the same list again after detail
      readback. If that follow-up performs `miss-rebuild` /
      `expired-rebuild`, it immediately performs a same-key warm check.
    - Also performs the same-key warm check for an ordinary first full-list
      `miss-rebuild` / `expired-rebuild` when the read did not already hit the
      source snapshot.
    - Adds bounded `threadListAfterDeferred` and `threadListWarmCheck`
      summaries to the JSON report.
    - Adds `--no-verify-deferred-fallback` for explicitly disabling this
      follow-up during narrow smoke runs.
  - `adapters/phase-b-readback-decision-service.js`
    - Carries after-deferred/warm-check evidence in bounded decision metadata.
    - Classifies a deferred first read followed by a warm same-key check as
      H3 observe (`deferred-followup-warmed`) instead of H2 repair.
    - Classifies an ordinary post-restart/post-deploy cold rebuild followed by
      a warm same-key check as H3 observe (`cold-start-rebuild-warmed`) instead
      of H2 repair.
    - Still reports H2 if fallback baseline/cache policy appears without warm
      evidence proving the once-only invariant.
  - Tests:
    - Script-level mock servers prove initial deferred -> follow-up
      `miss-rebuild` -> warm `hit` and ordinary cold -> warm `hit` paths with
      privacy bounds.
    - Decision-service tests prove warmed deferred fallback and warmed one-time
      cold rebuild are observed, not treated as broken.
  - README, architecture optimization plan, and module map were updated.
- Validation so far:
  - Focused:
    `node --test test/phase-b-readback-smoke.test.js test/phase-b-readback-decision-service.test.js`
    passed (`15` tests).
- Next:
  - Run `npm run check`, `git diff --check`, and the relevant focused tests
    again if edits continue.
  - Commit locally if validation remains green.
  - Do not deploy this slice by itself; it is readback tooling/docs only and
    should be batched unless a later runtime/static change requires deployment.

## 2026-06-26 - active projection hit proof-gate local slice

- Scope:
  - Continued Phase B active-detail work after the updated readback script
    exposed a new production state: the selected active thread returned
    `readMode=projection-v4-dynamic`, `readDecision=projection-hit`,
    `activeFullReadRequired=true`, and no active overlay diagnostics. The
    `--require-active-overlay` readback correctly failed because the ordinary
    projection hit returned before the active-overlay proof seam.
  - This is a runtime read-orchestration fix plus tests/docs. It has not yet
    been deployed at the time this section is written.
- Root-cause boundary:
  - Symptom: active/running summary state can coexist with a warm dynamic
    projection hit. Returning that projection directly skips live overlay
    validation and can miss intermediate command/output/assistant state.
  - Failing layer: thread-detail read orchestration return ordering.
  - Violated invariant: for active/running summaries, ordinary projection hits
    may provide a stable window, but they are not the final authority. The
    server-owned live overlay provider and active-window proof gate must still
    decide whether the response can avoid full `thread/read`.
  - Root cause: `thread-detail-read-orchestration-service.js` returned any
    projection hit before the active overlay branch, even when
    `activeFullReadRequired=true`.
  - Closure classification: root-cause ownership/order fix. No client dedupe,
    no forced refresh, no proof-gate relaxation.
- Changes:
  - `adapters/thread-detail-read-orchestration-service.js`
    - Records ordinary projection hits for active summaries but does not return
      them when an active-overlay provider is available.
    - Uses the ordinary projected thread as the active-overlay window candidate
      if the explicit active-overlay lookup has no result.
    - Keeps the old fast projection return for non-active summaries or when no
      active-overlay provider is wired.
  - `test/thread-detail-read-orchestration-service.test.js`
    - Adds coverage for active `projection-v4-dynamic` hits passing through the
      overlay provider/proof gate and returning `projection-active-overlay`
      without full `thread/read`.
  - README, architecture optimization plan, and module map were updated.
- Validation so far:
  - Focused active/readback set:
    `node --test test/thread-detail-read-orchestration-service.test.js test/thread-detail-active-overlay-integration.test.js test/phase-b-readback-smoke.test.js test/phase-b-readback-decision-service.test.js`
    passed (`34` tests).
- Next:
  - Run full validation.
  - Commit this runtime fix together with the deferred-readback tooling slice.
  - Deploy, then rerun
    `node scripts/codex-mobile-phase-b-readback-smoke.js --server http://127.0.0.1:8787 --require-active-overlay --json`
    to confirm the active projection hit no longer bypasses the proof gate.

## 2026-06-26 - active projection proof gate deployed and Phase B readback observed

- Deployment:
  - Committed `756f4ba` (`gate active projection readbacks`) after focused,
    full, static, macOS, and diff-check validation.
  - Deployed through Home AI central macOS plugin deploy path with reason
    `codex-mobile-phase-b-readback-warm-check`.
  - Deploy source ref: `756f4ba6ffc1`, dirty false.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260626T112930Z-plugin-codex-mobile-web-codex-mobile-phase-b-readback-warm-check`.
  - Health check returned `version=0.1.11`,
    `clientBuildId=0.1.11|codex-mobile-shell-v531`, and
    `shellCacheName=codex-mobile-shell-v531`. Static shell files were not
    changed, so no shell/cache bump was expected.
- Validation before deploy:
  - Focused:
    `node --test test/phase-b-readback-smoke.test.js test/phase-b-readback-decision-service.test.js test/thread-detail-read-orchestration-service.test.js test/thread-detail-active-overlay-integration.test.js`
    passed (`36` tests).
  - Full `npm test` passed (`1095` tests).
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Production readback:
  - Command:
    `node scripts/codex-mobile-phase-b-readback-smoke.js --server http://127.0.0.1:8787 --require-active-overlay --json`
    passed.
  - Thread list first read:
    - `coldPathOwner=fallback-baseline`.
    - `coldPathReason=miss-rebuild:rollout`.
    - total about `2737ms`, fallback about `2348ms`.
    - `fallbackSourceSnapshotRawCount=27`.
  - Thread list warm check:
    - `coldPathOwner=warm-fallback-cache`.
    - `coldPathReason=cache-hit`.
    - total about `420ms`, fallback `0ms`.
  - Detail read:
    - `readMode=projection-active-overlay`.
    - `readDecision=projection-active-overlay`.
    - `coldPathOwner=warm-path`.
    - `coldPathReason=warm-projection-active-overlay`.
    - `activeOverlayAction=use-projection-overlay`.
    - `activeOverlayReason=overlay-evidence-complete`.
    - `activeOverlayGate=ready`.
  - Decision:
    - `status=observe`, `priority=H3`, owner
      `thread-list-fallback-baseline`, reason
      `cold-start-rebuild-warmed`, next action
      `observe-cold-start-first-rebuild-cost`.
- Current conclusion:
  - Active/running thread detail no longer bypasses the live overlay proof gate
    through ordinary projection hits.
  - The post-deploy list cold path currently satisfies the user's invariant:
    the first full list after restart may rebuild fallback baseline, and the
    same-key warm check immediately hits the process-lifetime cache.
  - The next optimization slice should focus on reducing first cold rebuild
    cost (`fallbackMs` about `2.3s` in this readback) or pivot back to
    frontend render/patch ownership if fresh diagnostics show visible message
    mismatch/flash symptoms.

## 2026-06-26 - rollout fallback status attachment deferred local slice

- Scope:
  - Continued Phase B thread-list cold-path work after production readback
    showed the first full list after deploy rebuilding fallback baseline with
    `coldPathReason=miss-rebuild:rollout` and `fallbackMs` about `2.3s`.
  - This slice changes server-side rollout fallback source internals only. It
    does not change frontend behavior, final-list cache keys, fallback cache
    TTL, app-server authority, route aggregation, source snapshot persistence,
    or shell/static files.
- Root-cause boundary:
  - Symptom: the first source snapshot build can spend seconds in rollout
    fallback even though follow-up same-key list reads are warm.
  - Failing layer: rollout-session source collection inside the thread-list
    fallback baseline, specifically tail/status inference done before
    visibility/cwd/search filtering and result limiting.
  - Violated invariant: cold start/deploy may rebuild once, but the one-time
    rebuild should avoid unnecessary rollout tail scans for rows that cannot
    survive final visibility/filter/limit rules.
  - Root cause/hypothesis: `readRolloutSessionFallback()` called
    `readRolloutSessionFallbackThreadFromFile()` with immediate status
    inference for every recent rollout candidate. Status inference reads the
    rollout tail, so filtered-out candidates still paid the expensive tail
    scan.
  - Closure classification: root-cause I/O-order optimization. No masking
    fallback, no client dedupe, no forced refresh, no prewarm.
- Changes:
  - `server.js`
    - `readRolloutSessionFallbackThreadFromFile()` now accepts
      `{ includeStatus: false }` for list-source candidate reads.
    - Added `attachRolloutFallbackStatus()` to attach active/completed/stale
      status only after final list-source candidates survive filtering and
      slicing.
    - Default/single-thread rollout fallback remains unchanged: direct calls
      still infer and return status immediately.
  - `test/thread-visibility.test.js`
    - Adds coverage proving candidate reads can defer status and final
      candidate attachment restores active status.
    - Adds a structural guard so the list fallback path does not regress to
      eager status inference for all rollout candidates.
  - `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md` were updated with the Phase B boundary.
- Validation:
  - Focused:
    `node --test test/thread-visibility.test.js` passed (`46` tests).
  - Focused fallback set:
    `node --test test/thread-list-fallback-baseline-service.test.js test/thread-list-fallback-cache-service.test.js test/thread-list-cold-path-diagnosis-service.test.js`
    passed (`15` tests).
  - Full `npm test` passed (`1096` tests).
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Deployment:
  - Not deployed by design. This is a small Phase B local runtime slice and
    should be batched with the next coherent module deploy unless a production
    incident requires immediate rollout.
- Next:
  - Commit this local slice.
  - Continue Phase B by measuring/reducing the remaining first cold rebuild
    cost: candidate file discovery/sort, repeated archive-id scans, or rollout
    status tail parsing for the final visible candidate set.
  - When the Phase B module is ready, deploy once and rerun
    `node scripts/codex-mobile-phase-b-readback-smoke.js --server http://127.0.0.1:8787 --require-active-overlay --json`
    to compare first-list `fallbackMs` and confirm warm checks still hit.

## 2026-06-26 - fallback cold rebuild repeated scan local slice

- Scope:
  - Continued Phase B first-cold thread-list fallback rebuild optimization
    after committing `9d3e05e` (`defer rollout fallback status scans`).
  - A read-only subagent independently reviewed the remaining first-cold
    costs and highlighted four candidates: rollout file discovery/stat/sort,
    final-candidate status tail reads, repeated `session_index.jsonl` reads,
    and duplicate merge/filter work. It also noted the already-started
    archived-id rescan fix as aligned.
  - This slice addresses two low-risk repeated-scan costs in `server.js`:
    per-row archived id rescans and duplicate rollout-tail reads during status
    inference.
- Root-cause boundary:
  - Symptom: after the once-only fallback baseline rebuild invariant was
    proven, the first rebuild still spent about `2.3s` in rollout fallback.
  - Failing layer: repeated synchronous source scans inside the fallback
    baseline path, not client rendering or cache policy.
  - Violated invariant: one-time cold rebuild should not repeat identical
    archive-directory scans or read the same rollout tail twice for the same
    final candidate.
  - Root cause/hypothesis:
    - `threadHasArchiveSignal()` called `archivedSessionThreadIds()` whenever
      invoked without context, so filter/merge passes could rescan the Mobile
      archive index and archived-session directories per row.
    - `inferRolloutFallbackStatus()` read a rollout tail, then called
      stale-context evidence, which read the same tail again through
      `rolloutLatestTurnEvidence()`.
  - Closure classification: root-cause I/O-order/reuse optimization. No new
    fallback, no prewarm, no persistence, no client dedupe, no route behavior
    change.
- Changes:
  - `server.js`
    - `threadHasArchiveSignal()` and `shouldHideThreadListSummary()` accept an
      optional archived id set.
    - `filterFallbackThreads()`, `mergeThreadSummaryList()`, and
      `readRolloutSessionFallback()` reuse one archived id set for a whole
      pass.
    - `rolloutLatestTurnEvidence()` accepts an optional already-read tail.
    - `inferRolloutFallbackStatus()` passes its existing tail to
      `staleContextOnlyActiveEvidenceForRollout()` so context-only active
      evidence does not read the same file twice.
  - `test/thread-visibility.test.js`
    - Adds behavior coverage for injected archived id reuse and stale
      context-only active fallback summary normalization.
    - Adds structural guards for the pass-level archived id set and single-tail
      status inference path.
  - `test/thread-archive.test.js`
    - Updates archive structural coverage for the new `threadHasArchiveSignal`
      call shape.
  - `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md` were updated.
- Validation:
  - Focused:
    `node --test test/thread-visibility.test.js` passed (`48` tests).
  - Focused fallback set:
    `node --test test/thread-list-fallback-baseline-service.test.js test/thread-list-fallback-cache-service.test.js test/thread-list-cold-path-diagnosis-service.test.js`
    passed (`15` tests).
  - Full `npm test` passed (`1098` tests).
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Deployment:
  - Not deployed by design. This is still part of the Phase B local runtime
    batch; deploy only when the module has enough changes to justify one
    production restart/readback.
- Next:
  - Commit this local slice.
  - Remaining high-value Phase B evidence/optimization candidates:
    candidate rollout file discovery/stat/sort, same-request
    `session_index.jsonl` reuse, and merge/filter duplication.
  - Before a deploy, consider adding bounded readback counters for rollout
    files statted/sorted, status-tail reads/bytes, session-index reads, and
    archived-id scans so production readback can attribute any remaining
    first-cold cost without private logs.

## 2026-06-26 - fallback cold path attribution counters local slice

- Scope:
  - Continued Phase B thread-list cold path work after `d8f4a64` (`reuse
    fallback cold rebuild scans`).
  - This slice converts the remaining first-cold uncertainty into bounded
    readback evidence. It does not change list ordering, visibility, cache
    policy, fallback semantics, static shell files, or deployment state.
- Root-cause boundary:
  - Symptom: after repeated-scan reductions, the next bottleneck still needed
    evidence before changing source discovery, session-index reuse, or
    merge/filter work.
  - Failing layer: insufficient source-internal diagnostics inside the
    thread-list fallback baseline path.
  - Violated invariant: production readback should be able to distinguish
    rollout discovery/stat/head/tail work, session-index volume, and final
    merge/filter work without private logs or message contents.
  - Closure classification: root-cause observability for Phase B cold-path
    optimization. No masking fallback, no client dedupe, no prewarm, no
    persistence, and no broad refresh behavior.
- Changes:
  - `server.js`
    - Added bounded numeric counters for rollout directory reads, JSONL
      stat/collect/sort counts, candidate file/scanned counts, rollout head
      reads/bytes, final-candidate status tail reads/bytes, and
      `session_index.jsonl` read/line/entry counts.
    - `/api/threads` maps these counters into
      `mobileDiagnostics.threadListTimings.fallbackRollout*` and
      `fallbackSessionIndex*` fields.
  - `adapters/thread-list-fallback-baseline-service.js`
    - Gives each source reader an isolated diagnostics object.
    - Merges only whitelisted positive numeric counters into baseline timings,
      dropping paths, prompts, titles, search text, and any non-counter fields.
  - `adapters/thread-list-fallback-cache-service.js`
    - Propagates the whitelisted baseline counters into `readFallback()`
      diagnostics and cached baseline timings.
  - `scripts/codex-mobile-phase-b-readback-smoke.js`
    - Includes the new metadata-only source counters in the Phase B readback
      summary.
  - Tests updated:
    - `test/thread-list-fallback-baseline-service.test.js`
    - `test/thread-list-fallback-cache-service.test.js`
    - `test/thread-visibility.test.js`
    - `test/phase-b-readback-smoke.test.js`
  - Docs updated:
    - `README.md`
    - `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`
    - `docs/MODULES.md`
- Validation:
  - Focused:
    `node --test test/thread-list-fallback-baseline-service.test.js test/thread-list-fallback-cache-service.test.js test/thread-list-cold-path-diagnosis-service.test.js test/thread-visibility.test.js test/phase-b-readback-smoke.test.js`
    passed (`70` tests).
  - Full `npm test` passed (`1099` tests).
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Deployment:
  - Not deployed by design. This is another Phase B local runtime slice. Batch
    it with the next coherent Phase B module before one production
    restart/readback.
- Next:
  - Commit this local slice.
  - Use the new counters after the next deploy/readback to decide the next
    root-cause target:
    rollout discovery/sort, session-index reuse, final-candidate status tail
    cost, or merge/filter duplication.

## 2026-06-26 - fallback baseline session-index reuse local slice

- Scope:
  - Continued Phase B thread-list cold path optimization after `a5922f7`
    (`instrument fallback cold path counters`).
  - This slice removes one confirmed duplicate synchronous source read inside a
    single fallback baseline build: rollout fallback and session-index fallback
    can now share the same `session_index.jsonl` map through a temporary
    per-baseline `sourceContext`.
  - No list ordering, visibility filtering, app-server merge behavior, static
    shell files, or deployment state changed.
- Root-cause boundary:
  - Symptom: the previous diagnostics slice made session-index read volume
    visible but still allowed rollout fallback and session-index fallback to
    read the same index independently during the same cold source pass.
  - Failing layer: source collection inside the thread-list fallback baseline,
    not the client, route cache policy, or app-server authority.
  - Violated invariant: one cold baseline build should not repeat identical
    `session_index.jsonl` reads when a larger map is already available in the
    same source pass.
  - Closure classification: root-cause I/O reuse optimization. No persistent
    cache, no prewarm, no fallback masking, and no cross-request hidden state.
- Changes:
  - `adapters/thread-list-fallback-baseline-service.js`
    - Creates a temporary `sourceContext` for one source build and passes it to
      the state DB, rollout, and session-index source readers.
    - Keeps `sourceContext` out of source snapshots and public diagnostics.
    - Whitelists `sessionIndexReuseCount` as a bounded numeric diagnostic.
  - `server.js`
    - Adds `readSessionIndexEntriesForFallback()` for fallback source reads.
    - Reuses a cached in-pass session-index `Map` only when it satisfies the
      requested line limit.
    - Reports `fallbackSessionIndexReuseCount` through `/api/threads`
      diagnostics.
  - `scripts/codex-mobile-phase-b-readback-smoke.js`
    - Includes `fallbackSessionIndexReuseCount` in metadata-only readback
      summaries.
  - Tests updated:
    - `test/thread-list-fallback-baseline-service.test.js`
    - `test/thread-list-fallback-cache-service.test.js`
    - `test/thread-visibility.test.js`
    - `test/phase-b-readback-smoke.test.js`
  - Docs updated:
    - `README.md`
    - `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`
    - `docs/MODULES.md`
- Validation:
  - Focused:
    `node --test test/thread-list-fallback-baseline-service.test.js test/thread-list-fallback-cache-service.test.js test/thread-list-cold-path-diagnosis-service.test.js test/thread-visibility.test.js test/phase-b-readback-smoke.test.js`
    passed (`71` tests).
  - Full `npm test` passed (`1100` tests).
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Deployment:
  - Not deployed by design. Batch this with the current Phase B local module
    before one production restart/readback.
- Next:
  - Commit this local slice.
  - Remaining Phase B cold-path targets: rollout discovery/sort and merge/filter
    duplication. Use the next deploy readback counters to decide which is worth
    cutting first.

## 2026-06-26 - rollout discovery newest-first local slice

- Scope:
  - Continued Phase B thread-list cold path optimization after `3206af4`
    (`reuse session index during fallback baseline`).
  - This slice narrows rollout discovery waste under the existing candidate
    cap. It does not change thread-list visibility, merge/filter behavior,
    status inference, source snapshots, static shell files, or deployment state.
- Root-cause boundary:
  - Symptom: `collectRecentRolloutFiles()` stopped after collecting
    `maxFiles * 4` rollout candidates, but directory traversal used filesystem
    order. On date-partitioned session roots, older directories could fill the
    candidate cap before newer branches were visited.
  - Failing layer: rollout discovery ordering inside server-side fallback source
    collection, not app-server authority or client rendering.
  - Violated invariant: a function named `collectRecentRolloutFiles()` should
    discover recent date branches first when it must stop early.
  - Closure classification: root-cause discovery-order optimization. No
    fallback masking, no prewarm, no persistent index, no client dedupe.
- Changes:
  - `server.js`
    - Adds `compareRecentRolloutDirents()` and uses it before visiting
      directory entries.
    - The comparator visits directories before files and sorts names
      descending, matching the `.codex/sessions/YYYY/MM/DD/rollout-...` layout.
    - Final returned files are still sorted by `mtimeMs` and sliced by
      `maxFiles`.
    - Exports `collectRecentRolloutFiles()` for focused behavior coverage.
  - `test/thread-visibility.test.js`
    - Adds a temp-dir behavior test proving a newer session branch is visited
      before an older one when `maxFiles=1` would otherwise hit the candidate
      cap.
    - Adds structural guards for the comparator wiring.
  - Docs updated:
    - `README.md`
    - `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`
    - `docs/MODULES.md`
- Validation:
  - Focused:
    `node --test test/thread-list-fallback-baseline-service.test.js test/thread-list-fallback-cache-service.test.js test/thread-list-cold-path-diagnosis-service.test.js test/thread-visibility.test.js test/phase-b-readback-smoke.test.js`
    passed (`72` tests).
  - Full `npm test` passed (`1101` tests).
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Deployment:
  - Not deployed by design. This remains a Phase B local module batch.
- Next:
  - Commit this local slice.
  - Remaining Phase B local candidate before a batch deploy: merge/filter
    duplication. After that, deploy once and run Phase B readback smoke to
    compare cold counters and warm cache behavior.

## 2026-06-26 - fallback baseline merge/filter attribution local slice

- Scope:
  - Continued Phase B thread-list cold path work after `5d5915e`
    (`prefer newest rollout discovery branches`).
  - This slice does not change thread-list visibility, ordering, merge
    semantics, app-server result merge, source snapshots, cache policy, static
    shell files, or deployment state.
  - It makes the remaining baseline final-filter / merge work measurable so
    the next Phase B production readback can distinguish source I/O cost from
    final `cwd/search` filtering, duplicate-id merge pressure, and limit
    truncation.
- Root-cause boundary:
  - Symptom: Phase B source counters could attribute rollout/session-index I/O
    but still left "merge/filter duplication" as an unmeasured candidate.
  - Failing layer under investigation: server-side thread-list fallback
    baseline assembly, not the client or public list rendering.
  - Violated invariant: a production cold-path readback should identify whether
    remaining work belongs to source I/O or baseline final assembly before
    changing filter/merge ownership.
  - Closure classification: bounded attribution for a root-cause decision. No
    fallback masking, no UI dedupe, no skipped refresh, no persistent cache, and
    no behavior change.
- Changes:
  - `adapters/thread-list-fallback-baseline-service.js`
    - Adds bounded counts for final filter passes/input/output, merge
      input/output, duplicate id pressure, and limit drops.
    - Reuses the direct merge result for non-snapshot baselines so diagnostics
      do not introduce extra merge work.
  - `adapters/thread-list-fallback-cache-service.js`
    - Whitelists and forwards the new baseline work counters through miss /
      rebuild diagnostics and cached source timings.
  - `server.js`
    - Exposes the new counters as `fallbackBaselineFinalFilter*`,
      `fallbackBaselineMerge*`, and `fallbackBaselineLimitDropCount` under
      `/api/threads` timing diagnostics.
  - `scripts/codex-mobile-phase-b-readback-smoke.js`
    - Summarizes the new counters with bounded numeric limits only.
  - Tests updated:
    - `test/thread-list-fallback-baseline-service.test.js`
    - `test/thread-list-fallback-cache-service.test.js`
    - `test/thread-visibility.test.js`
    - `test/phase-b-readback-smoke.test.js`
  - Docs updated:
    - `README.md`
    - `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`
    - `docs/MODULES.md`
- Validation:
  - Focused:
    `node --test test/thread-list-fallback-baseline-service.test.js test/thread-list-fallback-cache-service.test.js test/thread-list-cold-path-diagnosis-service.test.js test/thread-visibility.test.js test/phase-b-readback-smoke.test.js`
    passed (`72` tests).
  - Full `npm test` passed (`1101` tests).
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Deployment:
  - Not deployed by design. This remains part of the Phase B local module batch.
- Next:
  - Commit this local slice.
  - Phase B is now ready for a module-level deploy/readback candidate unless a
    current runtime incident forces a narrower hotfix first.

## 2026-06-26 - Phase B module deploy/readback and active turn-id follow-up

- Phase B module deployment:
  - Deployed Codex Mobile plugin source commit `6fc3a4a`
    (`instrument fallback baseline merge filters`) through the Home AI central
    macOS plugin deploy path.
  - Deploy reason: `codex-mobile-phase-b-module`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260626T123225Z-plugin-codex-mobile-web-codex-mobile-phase-b-module`.
  - Production health/readback returned `clientBuildId=0.1.11|codex-mobile-shell-v531`
    and `shellCacheName=codex-mobile-shell-v531`; unchanged shell is expected
    because this Phase B module did not modify static frontend shell files.
- Phase B readback result:
  - `scripts/codex-mobile-phase-b-readback-smoke.js --server http://127.0.0.1:8787 --json`
    passed with metadata-only output.
  - First list read after deploy:
    `coldPathOwner=fallback-baseline`,
    `coldPathReason=miss-rebuild:rollout`,
    `fallbackCacheDecision=miss-rebuild`,
    `fallbackMs=1457`,
    `mergeMs=48`.
  - Same-key warm check:
    `coldPathOwner=warm-fallback-cache`,
    `fallbackCacheDecision=hit`,
    `fallbackMs=1`.
  - New baseline work counters were present:
    `fallbackBaselineFinalFilterPassCount=3`,
    `fallbackBaselineFinalFilterInputCount=27`,
    `fallbackBaselineFinalFilterOutputCount=27`,
    `fallbackBaselineMergeInputCount=27`,
    `fallbackBaselineMergeOutputCount=11`,
    `fallbackBaselineMergeDuplicateCount=0`,
    `fallbackBaselineLimitDropCount=0`.
  - Interpretation: current thread-list cold sample is still dominated by
    rollout/app-server cold work, not final baseline merge/filter duplication.
    Warm cache behavior is correct after the first rebuild.
- Active detail follow-up found by readback:
  - Detail read selected by smoke still fell back to `thread-read`.
  - Bounded reason:
    `activeOverlayGate=needs_repair`,
    `activeOverlayReason=missing-active-turn-id`,
    `activeOverlayNextAction=retain-active-turn-id`.
  - Strongest root-cause hypothesis: cold/deploy restart can leave no live
    projection snapshot for an active thread. Rollout fallback can still infer
    `status=active` from tail activity but previously returned only
    `{ type: "active" }`, so the summary had no concrete `activeTurnId` for the
    active-overlay proof gate.
- Local follow-up fix:
  - `server.js`
    - `inferRolloutFallbackStatus()` now tracks the latest activity turn id
      from rollout tail, including `task_started.turn_id`.
    - Active rollout status returns `{ type: "active", turnId }` when a turn id
      is known.
    - `rowToFallbackThread()` and `attachRolloutFallbackStatus()` promote an
      active status turn id into top-level `activeTurnId` on fallback summaries.
    - Terminal rollout entries still take precedence, so completed turns are
      not promoted to active.
  - Tests updated:
    - `test/thread-visibility.test.js`.
  - Docs updated:
    - `README.md`
    - `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`
    - `docs/MODULES.md`
- Validation so far:
  - Focused:
    `node --test test/thread-visibility.test.js test/thread-detail-active-read-policy-service.test.js test/thread-detail-active-overlay-provider-service.test.js test/thread-detail-active-overlay-integration.test.js test/thread-detail-read-orchestration-service.test.js test/phase-b-readback-smoke.test.js`
    passed (`85` tests).
- Next:
  - Run full validation.
  - Commit the active turn-id follow-up.
  - Deploy and rerun Phase B readback smoke to confirm whether the active
    overlay gate advances past `missing-active-turn-id`.

## 2026-06-26 - active turn-id follow-up deployed and verified

- Commit:
  - Runtime fix committed as `f6818d7` (`retain rollout active turn ids`).
- Validation:
  - Focused active/rollout/readback set passed (`85` tests):
    `node --test test/thread-visibility.test.js test/thread-detail-active-read-policy-service.test.js test/thread-detail-active-overlay-provider-service.test.js test/thread-detail-active-overlay-integration.test.js test/thread-detail-read-orchestration-service.test.js test/phase-b-readback-smoke.test.js`
  - Full `npm test` passed (`1101` tests).
  - `npm run check` passed.
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Deployment:
  - Deployed through Home AI central macOS plugin deploy path.
  - Deploy reason: `codex-mobile-active-turn-id`.
  - Source ref: `f6818d784d68`, dirty: `false`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260626T124033Z-plugin-codex-mobile-web-codex-mobile-active-turn-id`.
  - Production health returned `clientBuildId=0.1.11|codex-mobile-shell-v531`
    and `shellCacheName=codex-mobile-shell-v531`; unchanged shell is expected.
- Production readback:
  - `scripts/codex-mobile-phase-b-readback-smoke.js --server http://127.0.0.1:8787 --json`
    passed with metadata-only output.
  - Thread list first read:
    `coldPathOwner=fallback-baseline`,
    `coldPathReason=miss-rebuild:rollout`,
    `fallbackCacheDecision=miss-rebuild`,
    `fallbackMs=1503`,
    `mergeMs=119`.
  - Thread list warm check:
    `coldPathOwner=warm-fallback-cache`,
    `fallbackCacheDecision=hit`,
    `fallbackMs=1`.
  - Detail read:
    `readMode=projection-active-overlay`,
    `readDecision=projection-active-overlay`,
    `coldPathOwner=warm-path`,
    `coldPathReason=warm-projection-active-overlay`,
    `activeOverlayGate=ready`,
    `activeOverlayReason=overlay-evidence-complete`.
  - Decision: `status=observe`, `priority=H3`, `reason=cold-start-rebuild-warmed`.
- Interpretation:
  - The `missing-active-turn-id` H1 from the previous readback is closed for
    this production sample.
  - Remaining Phase B evidence points to one expected cold fallback rebuild
    after restart/deploy, followed by warm fallback cache reuse.
- Next:
  - Observe production usage for repeated thread-list cold rebuild or
    conversation projection mismatch diagnostics.
  - If no new incident appears, move the architecture work to the next
    objective slice: Phase A render/patch ownership or Phase C pane-state,
    depending on user priority.

## 2026-06-26 - Phase A local DOM completion effects slice

- Context:
  - Continuing the system-level architecture optimization goal after Phase B
    active-overlay readback closed `missing-active-turn-id`.
  - User direction is now to avoid deploying every small optimization; local
    slices should be committed and batched into a coherent module before
    production deploy.
- Root-cause boundary:
  - Symptom/risk: `completeLocalConversationDomUpdate()` had already delegated
    tile/single completion decisions to `public/thread-detail-dom-patch.js`,
    but the post-completion side effects still branched directly in
    `public/app.js` for root hydration, rendered conversation signature
    writeback, patch-shell signature writeback, and scroll/bottom-button
    scheduling.
  - Failing layer: frontend thread-detail local DOM patch completion ownership,
    not server projection, task-card protocol, or diagnostic transport.
  - Violated invariant: local patch completion should have a testable commit
    plan, with `app.js` executing real effects but not re-deciding the effect
    list after the helper has classified completion.
  - Closure classification: architecture-boundary cleanup with no behavior
    fallback. It does not hide duplicates, force refresh, skip refresh, change
    projection semantics, change scroll-follow policy, or change shell/cache.
- Changes:
  - `public/thread-detail-dom-patch.js`
    - Added local `objectOrEmpty`.
    - Added `planLocalConversationDomUpdateCompletionEffects()` to turn a
      completion plan into ordered effects for hydration, rendered signature
      writeback, patch-shell signature writeback, and scroll/bottom-button
      scheduling.
  - `public/app.js`
    - Added `applyLocalConversationDomUpdateCompletionEffect()` and
      `applyLocalConversationDomUpdateCompletionEffectsPlan()`.
    - `completeLocalConversationDomUpdate()` now executes the planned effects
      instead of branching on `completionPlan.hydrateRoot`, signature flags, or
      `completionPlan.scrollAction`.
  - Tests/docs updated:
    - `test/thread-detail-dom-patch.test.js`
    - `test/conversation-render.test.js`
    - `test/turn-scroll-controls.test.js`
    - `test/mobile-viewport.test.js`
    - `README.md`
    - `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`
    - `docs/MODULES.md`
- Validation:
  - Focused:
    `node --test test/thread-detail-dom-patch.test.js test/conversation-render.test.js test/turn-scroll-controls.test.js test/mobile-viewport.test.js`
    passed (`165` tests).
- Deployment:
  - Not deployed by design. This is a Phase A local slice to batch before a
    future module-level deploy.
- Next:
  - Run `npm run check` / `git diff --check`, then create a local commit.
  - Continue Phase A by extracting the remaining render/patch post-effect and
    scroll ownership seams from `public/app.js`, or move to Phase C if the next
    user priority is pane-state stability.

## 2026-06-26 - Phase A conversation HTML update effects slice

- Context:
  - Follows local commit `1d695fc` (`plan local dom completion effects`).
  - This is the second local Phase A post-effect ownership slice and remains
    intentionally undeployed until batched into a module.
- Root-cause boundary:
  - Symptom/risk: `planConversationHtmlUpdate()` already decided stable
    signature hydration, changed render, DOM-empty invalidation, hydrate
    options, and scroll action, but `updateConversationHtml()` still branched
    directly on update-plan signature flags and scroll action after the plan
    was computed.
  - Failing layer: frontend conversation HTML update post-effect ownership,
    not server projection, local patch eligibility, task-card protocol, or
    diagnostic transport.
  - Violated invariant: once a DOM update plan is computed, post-DOM effects
    should be planned in a testable helper and executed by `app.js` without
    re-deciding signature writeback, hydration, or scroll scheduling.
  - Closure classification: architecture-boundary cleanup. It does not hide
    duplicate/missing messages, force refresh, skip refresh, change
    `patch-html` / `innerHTML` fallback behavior, change stable-DOM-empty
    diagnostics, or change shell/cache.
- Changes:
  - `public/thread-detail-dom-patch.js`
    - Added `scrollEffectFromAction()`.
    - Added `planConversationHtmlUpdateEffects()`.
    - Reused the scroll-effect helper from
      `planLocalConversationDomUpdateCompletionEffects()`.
  - `public/app.js`
    - Renamed the core executor boundary to
      `applyThreadDetailDomUpdateEffect()` /
      `applyThreadDetailDomUpdateEffectsPlan()`.
    - Kept local completion wrapper names for the local patch path.
    - Added `applyConversationHtmlUpdateEffectsPlan()` and changed
      `updateConversationHtml()` to execute planned effects for both
      `hydrate-existing` and changed-render paths.
  - Tests/docs updated:
    - `test/thread-detail-dom-patch.test.js`
    - `test/conversation-render.test.js`
    - `test/turn-scroll-controls.test.js`
    - `test/mobile-viewport.test.js`
    - `README.md`
    - `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`
    - `docs/MODULES.md`
	- Validation:
	  - Focused:
	    `node --test test/thread-detail-dom-patch.test.js test/conversation-render.test.js test/turn-scroll-controls.test.js test/mobile-viewport.test.js test/mermaid-render.test.js test/github-link-preview-ui.test.js`
	    passed (`180` tests).
	  - `npm run check` passed.
	  - `npm test` passed (`1106` tests).
	  - `npm run check:macos` passed.
	  - `git diff --check` passed.
	- Deployment:
	  - Not deployed by design. This is a local Phase A slice for a future
	    module-level deploy.
	- Next:
	  - Commit locally.
	  - Continue Phase A toward remaining `renderCurrentThread()` / full-render
	    shell post-effect seams or switch to Phase C pane-state if user priority
	    changes.

## 2026-06-26 - Phase A single-thread shell update input slice

- Context:
  - Follows local commit `c883d98` (`plan conversation html update effects`).
  - This is the third local Phase A render/patch ownership slice and remains
    intentionally undeployed until batched into a coherent module.
- Root-cause boundary:
  - Symptom/risk: single-thread early shell and full-render shell HTML planning
    already lived in `public/thread-detail-render-plan.js`, but
    `renderCurrentThread()` still directly assembled the
    `updateConversationHtml()` input object: conversation signature,
    patch-shell signature, bottom-follow flag, expected visible turn count, and
    source.
  - Failing layer: frontend single-thread shell update input ownership, not
    server projection, local DOM patching, task-card protocol, diagnostic
    transport, or shell/cache.
  - Violated invariant: once shell HTML is planned by a helper, the corresponding
    conversation-update input should also be planned in a testable helper.
    `public/app.js` should execute the DOM update and bind real events, not
    re-own the update-input policy.
  - Closure classification: architecture-boundary cleanup. It does not hide
    duplicate/missing messages, force refresh, skip refresh, change shell HTML,
    change retry binding, change DOM patch behavior, change scroll policy,
    change diagnostics, or change shell/cache.
- Changes:
  - `public/thread-detail-render-plan.js`
    - Added `planSingleThreadShellConversationUpdate()`.
  - `public/app.js`
    - Early shell and normal full-render shell paths now call the helper and pass
      its `{ html, conversationSignature, options }` result into
      `updateConversationHtml()`.
  - Tests/docs updated:
    - `test/thread-detail-render-plan.test.js`
    - `test/conversation-render.test.js`
    - `test/turn-scroll-controls.test.js`
    - `README.md`
    - `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`
    - `docs/MODULES.md`
- Validation so far:
  - Focused:
    `node --test test/thread-detail-render-plan.test.js test/conversation-render.test.js test/turn-scroll-controls.test.js test/mobile-viewport.test.js`
    passed (`172` tests).
  - `npm run check` passed.
  - `npm test` passed (`1107` tests).
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Deployment:
  - Not deployed by design. This is a local Phase A slice for a future
    module-level deploy.
- Next:
  - Commit locally.

## 2026-06-26 - Phase A patch rejection diagnostic input slice

- Context:
  - Follows local commit `7182cd9` (`plan refresh response effects`).
  - This is the seventh local Phase A render/patch ownership slice and remains
    intentionally undeployed until batched into a coherent module.
- Root-cause boundary:
  - Symptom/risk: after local patch rejection, `refreshCurrentThread()` still
    directly selected diagnostic fields such as read mode, render mode,
    render-plan reason, patch rejection reason, and before/after visible item
    counts before calling the existing diagnostic event builder.
  - Failing layer: frontend refresh patch-rejection diagnostic input ownership,
    not server projection, local patch eligibility, full-render fallback,
    Home AI diagnostic schema, task-card protocol, or shell/cache.
  - Violated invariant: once patch-attempt results and render-plan outcomes are
    planned by helper modules, the bounded diagnostic input for patch rejection
    should also be planned by a testable helper. `public/app.js` should only
    trigger the real diagnostic side effect when the helper requests it.
  - Closure classification: architecture-boundary cleanup. It does not hide
    duplicate/missing messages, force refresh, skip refresh, change patch
    rejection semantics, change full-render fallback behavior, change diagnostic
    payload schema, or change shell/cache.
- Changes:
  - `public/thread-detail-render-plan.js`
    - Added `planThreadDetailRefreshPatchRejectedDiagnostic()`.
  - `public/app.js`
    - `refreshCurrentThread()` now uses the planned diagnostic input instead of
      directly composing `detail_patch_rejected` input fields.
    - Removed the local `patchRejectReason` staging variable.
  - Tests/docs updated:
    - `test/thread-detail-render-plan.test.js`
    - `test/conversation-render.test.js`
    - `test/mobile-viewport.test.js`
    - `README.md`
    - `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`
    - `docs/MODULES.md`
- Validation:
  - Focused:
    `node --test test/thread-detail-render-plan.test.js test/conversation-render.test.js test/thread-diagnostic-events.test.js test/mobile-viewport.test.js`
    passed (`186` tests).
  - `npm run check` passed.
  - `npm test` passed (`1112` tests).
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Deployment:
  - Not deployed by design. This is a local Phase A slice for a future
    module-level deploy.
- Next:
  - Commit locally.

## 2026-06-26 - Phase A refresh response effects slice

- Context:
  - Follows local commit `b518060` (`plan summary recovery effects`).
  - This is the sixth local Phase A render/patch ownership slice and remains
    intentionally undeployed until batched into a coherent module.
- Root-cause boundary:
  - Symptom/risk: `refreshCurrentThread()` already delegated request planning,
    patch attempts, outcome execution, performance input, and completion
    effects, but still directly owned the post-API stale response guard and the
    ordered detail-loaded/evidence/merge state effects.
  - Failing layer: frontend refresh response ownership, not server projection,
    merge policy, local DOM patching, task-card protocol, diagnostic transport,
    or shell/cache.
  - Violated invariant: once refresh request identity is snapshotted by a pure
    plan, the response applicability check and response-state effect order
    should also be planned by a testable helper. `public/app.js` should perform
    real state mutation only after executing that plan.
  - Closure classification: architecture-boundary cleanup. It does not hide
    duplicate/missing messages, force refresh, skip refresh, alter merge
    semantics, change local patch eligibility, change full-render selection,
    change diagnostic fields, or change shell/cache.
- Changes:
  - `public/thread-detail-render-plan.js`
    - Added `planThreadDetailRefreshResponseEffects()`.
  - `public/app.js`
    - Added `applyThreadDetailRefreshResponseEffect()` /
      `applyThreadDetailRefreshResponseEffectsPlan()`.
    - `refreshCurrentThread()` now uses the planned response effects instead
      of inlining stale-response guard plus detail-loaded/evidence/merge calls.
  - Tests/docs updated:
    - `test/thread-detail-render-plan.test.js`
    - `test/conversation-render.test.js`
    - `README.md`
    - `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`
    - `docs/MODULES.md`
- Validation:
  - Focused:
    `node --test test/thread-detail-render-plan.test.js test/conversation-render.test.js test/mobile-viewport.test.js`
    passed (`169` tests).
  - `npm run check` passed.
  - `npm test` passed (`1110` tests).
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Deployment:
  - Not deployed by design. This is a local Phase A slice for a future
    module-level deploy.
- Next:
  - Commit locally.

## 2026-06-26 - Phase A summary recovery effects slice

- Context:
  - Follows local commit `0a04296` (`plan single thread post update effects`).
  - This is the fifth local Phase A state/render ownership slice and remains
    intentionally undeployed until batched into a coherent module.
- Root-cause boundary:
  - Symptom/risk: `planSummaryOnlyCurrentThreadRecovery()` already decided when
    a summary-only current thread should become a loading shell and whether a
    bounded recovery event/refresh was required, but `renderCurrentThread()`
    still directly owned the state replacement, client event, and refresh
    scheduling order.
  - Failing layer: frontend summary-only current-thread recovery effect
    ownership, not server projection, local DOM patching, task-card protocol,
    diagnostic transport, or shell/cache.
  - Violated invariant: summary-only recovery is a state-ownership strategy.
    Once the recovery plan is computed, state/event/refresh effects should be
    planned in a testable helper and executed by `public/app.js` without
    re-owning the effect order.
  - Closure classification: architecture-boundary cleanup. It does not hide
    duplicate/missing messages, force refresh, skip refresh, change
    summary-only detection, change loading-shell shape, change diagnostic
    fields, change refresh reason, or change shell/cache.
- Changes:
  - `public/thread-detail-state.js`
    - Added `objectOrEmpty()`.
    - Added `planSummaryOnlyCurrentThreadRecoveryEffects()`.
  - `public/app.js`
    - Added `applySummaryOnlyCurrentThreadRecoveryEffect()` /
      `applySummaryOnlyCurrentThreadRecoveryEffectsPlan()`.
    - `renderCurrentThread()` now executes planned recovery effects instead of
      inlining `state.currentThread`, `postClientEvent`, and
      `scheduleCurrentThreadRefresh` branches.
  - Tests/docs updated:
    - `test/thread-detail-state.test.js`
    - `test/conversation-render.test.js`
    - `README.md`
    - `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`
    - `docs/MODULES.md`
- Validation so far:
  - Focused:
    `node --test test/thread-detail-state.test.js test/conversation-render.test.js test/mobile-viewport.test.js`
    passed (`139` tests).
  - `npm run check` passed.
  - `npm test` passed (`1109` tests).
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Deployment:
  - Not deployed by design. This is a local Phase A slice for a future
    module-level deploy.
- Next:
  - Commit locally.

## 2026-06-26 - Phase A single-thread shell post-update effects slice

- Context:
  - Follows local commit `6553a63` (`plan single thread shell updates`).
  - This is the fourth local Phase A render/patch ownership slice and remains
    intentionally undeployed until batched into a coherent module.
- Root-cause boundary:
  - Symptom/risk: after `renderCurrentThread()` updated the single-thread
    conversation shell, it still directly owned the post-update sequence for
    retry binding, empty-detail mismatch diagnostics, current-thread action
    binding, optional receipt-start scrolling, plugin route hint focus, tick
    timer update, and plugin navigation publishing.
  - Failing layer: frontend single-thread shell post-update effect ordering, not
    server projection, local DOM patching, task-card protocol, diagnostic
    transport, or shell/cache.
  - Violated invariant: once shell render/update inputs are planned by helper
    modules, the post-update effect order should also be planned by a testable
    helper. `public/app.js` should execute real DOM/event/timer/scroll effects,
    not silently own the policy order.
  - Closure classification: architecture-boundary cleanup. It does not hide
    duplicate/missing messages, force refresh, skip refresh, change shell HTML,
    change retry semantics, change empty-detail diagnostic conditions, change
    scroll policy, change route-hint focus behavior, or change shell/cache.
- Changes:
  - `public/thread-detail-render-plan.js`
    - Added `planSingleThreadShellPostUpdateEffects()`.
  - `public/app.js`
    - Added `applySingleThreadShellPostUpdateEffect()` /
      `applySingleThreadShellPostUpdateEffectsPlan()`.
    - Early shell and normal full-render shell paths now execute planned
      post-update effects instead of inlining the effect sequence.
  - Tests/docs updated:
    - `test/thread-detail-render-plan.test.js`
    - `test/conversation-render.test.js`
    - `test/turn-scroll-controls.test.js`
    - `README.md`
    - `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`
    - `docs/MODULES.md`
- Validation so far:
  - Focused:
    `node --test test/thread-detail-render-plan.test.js test/conversation-render.test.js test/turn-scroll-controls.test.js test/mobile-viewport.test.js`
    passed (`174` tests).
  - `npm run check` passed.
  - `npm test` passed (`1109` tests).
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Deployment:
  - Not deployed by design. This is a local Phase A slice for a future
    module-level deploy.
- Next:
  - Commit locally.

## 2026-06-26 - Latest tail marker: Phase A patch rejection diagnostic input slice

- Latest local commit for this continuation slice:
  - Message: `plan patch rejection diagnostics`.
- Current state:
  - Worktree was clean after commit.
  - This is the seventh local Phase A render/patch ownership slice.
  - Not deployed by design; no `CLIENT_BUILD_ID` / PWA shell cache bump.
- Root-cause boundary:
  - `refreshCurrentThread()` no longer owns `detail_patch_rejected` diagnostic
    input field selection directly. `public/thread-detail-render-plan.js`
    plans the bounded diagnostic input; `public/app.js` only triggers the real
    Home AI diagnostic side effect when the plan requests it.
- Validation:
  - Focused:
    `node --test test/thread-detail-render-plan.test.js test/conversation-render.test.js test/thread-diagnostic-events.test.js test/mobile-viewport.test.js`
    passed (`186` tests).
  - `npm run check` passed.
  - `npm test` passed (`1112` tests).
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Next:
  - Continue Phase A with one more local `refreshCurrentThread()` ownership
    slice or batch the current Phase A module for a single deploy/readback when
    requested.

## 2026-06-26 - Latest tail marker: Phase A consistency check effects slice

- Latest local commit for this continuation slice:
  - Message: `plan consistency check effects`.
- Current state:
  - This is the eighth local Phase A render/patch ownership slice.
  - Not deployed by design; no `CLIENT_BUILD_ID` / PWA shell cache bump.
- Root-cause boundary:
  - `planThreadDetailRefreshOutcomeExecution()` already produced the
    consistency-check decision, but `refreshCurrentThread()` still directly
    branched on `consistencyCheck.shouldCheck`.
  - `public/thread-detail-render-plan.js` now plans ordered consistency-check
    effects; `public/app.js` only executes the real
    `checkConversationProjectionConsistency()` side effect.
- Validation:
  - Focused:
    `node --test test/thread-detail-render-plan.test.js test/conversation-render.test.js test/mobile-viewport.test.js`
    passed (`172` tests).
  - `npm run check` passed.
  - `npm test` passed (`1113` tests).
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Next:
  - Either batch the current Phase A module for one deploy/readback, or continue
    with one more local `refreshCurrentThread()` ownership slice.

## 2026-06-26 - Latest tail marker: Phase A refresh telemetry effects slice

- Latest local commit for this continuation slice:
  - Message: `plan refresh telemetry effects`.
- Current state:
  - This is the ninth local Phase A render/patch ownership slice.
  - Not deployed by design; no `CLIENT_BUILD_ID` / PWA shell cache bump.
- Root-cause boundary:
  - `thread-performance-metrics` already builds the bounded `thread_refresh_ms`
    payload, but `refreshCurrentThread()` still directly owned the telemetry
    side-effect order for `postPerformanceEvent()` followed by
    `recordThreadDetailResponseDiagnostics()`.
  - `public/thread-detail-render-plan.js` now plans ordered refresh telemetry
    effects; `public/app.js` only executes the real reporting side effects and
    supplies the runtime thread object for diagnostics.
- Validation:
  - Focused:
    `node --test test/thread-detail-render-plan.test.js test/conversation-render.test.js test/mobile-viewport.test.js`
    passed (`173` tests).
  - `npm run check` passed.
  - `npm test` passed (`1114` tests).
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Next:
  - Continue Phase A with the next `refreshCurrentThread()` ownership slice, or
    batch the current Phase A module for one deploy/readback when requested.

## 2026-06-26 - Latest tail marker: Phase A patch rejection diagnostic effects slice

- Latest local commit for this continuation slice:
  - Message: `plan patch rejection diagnostic effects`.
- Current state:
  - This is the tenth local Phase A render/patch ownership slice.
  - Not deployed by design; no `CLIENT_BUILD_ID` / PWA shell cache bump.
- Root-cause boundary:
  - `planThreadDetailRefreshPatchRejectedDiagnostic()` already planned bounded
    local patch rejection diagnostic input fields, but `refreshCurrentThread()`
    still directly branched on `patchRejectedDiagnosticPlan.shouldReport`.
  - `public/thread-detail-render-plan.js` now plans ordered patch rejection
    diagnostic effects; `public/app.js` only executes the real Home AI
    diagnostic failure side effect.
- Validation:
  - Focused:
    `node --test test/thread-detail-render-plan.test.js test/conversation-render.test.js test/mobile-viewport.test.js`
    passed (`174` tests).
  - `npm run check` passed.
  - `npm test` passed (`1115` tests).
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Next:
  - Continue Phase A or batch the current module for one deploy/readback when
    requested.

## 2026-06-26 - Latest tail marker: Phase A user-reading-current-turn planning slice

- Latest local commit for this continuation slice:
  - Message: `plan user reading current turn`.
- Current state:
  - This is the fifteenth local Phase A render/patch/scroll ownership slice.
  - Not deployed by design; no `CLIENT_BUILD_ID` / PWA shell cache bump.
- Root-cause boundary:
  - `isUserReadingCurrentTurn()` directly combined near-bottom state,
    auto-scroll hold, recent manual scroll intent, and current-turn candidate
    checks inside `public/app.js`.
  - `public/conversation-scroll.js` now owns
    `planUserReadingCurrentTurn()`, while `public/app.js` supplies the current
    DOM/state facts and preserves the original short-circuit order to avoid
    extra turn/hold reads.
- Validation:
  - Focused:
    `node --test test/conversation-scroll.test.js test/turn-scroll-controls.test.js test/mobile-viewport.test.js test/conversation-render.test.js`
    passed (`135` tests).
  - `npm run check` passed.
  - `npm test` passed (`1119` tests).
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Next:
  - Commit locally, then continue Phase A or batch the current module for one
    deploy/readback when requested.

## 2026-06-26 - Latest tail marker: Phase A conversation jump button planning slice

- Latest local commit for this continuation slice:
  - Message: `plan conversation jump button visibility`.
- Current state:
  - This is the fourteenth local Phase A render/patch/scroll ownership slice.
  - Not deployed by design; no `CLIENT_BUILD_ID` / PWA shell cache bump.
- Root-cause boundary:
  - `updateScrollToBottomButton()` still directly owned the long condition chain
    deciding whether to show the bottom jump or current-receipt jump affordance.
  - `public/conversation-scroll.js` now owns
    `planConversationJumpButtons()`, including the mutual exclusion between
    bottom-jump and receipt-jump buttons. `public/app.js` supplies DOM state and
    applies the real class/aria/tabIndex updates.
- Validation:
  - Focused:
    `node --test test/conversation-scroll.test.js test/mobile-viewport.test.js test/conversation-render.test.js test/turn-scroll-controls.test.js`
    passed (`134` tests).
  - `npm run check` passed.
  - `npm test` passed (`1118` tests).
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Next:
  - Commit locally, then continue Phase A or batch the current module for one
    deploy/readback when requested.

## 2026-06-26 - Latest tail marker: Phase A refresh completion effects executor slice

- Latest local commit for this continuation slice:
  - Message: `plan refresh completion effects executor`.
- Current state:
  - This is the thirteenth local Phase A render/patch ownership slice.
  - Not deployed by design; no `CLIENT_BUILD_ID` / PWA shell cache bump.
- Root-cause boundary:
  - `planThreadDetailRefreshCompletionEffects()` already selected bounded
    refresh-completion effects, but `refreshCurrentThread()` still directly
    iterated over `completionPlan.effects`.
  - `public/app.js` now owns a plan-level completion effects executor, so
    `refreshCurrentThread()` only asks for the plan and invokes the executor.
- Validation:
  - Focused:
    `node --test test/thread-detail-render-plan.test.js test/conversation-render.test.js test/mobile-viewport.test.js`
    passed (`176` tests).
  - `npm run check` passed.
  - `npm test` passed (`1117` tests).
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Next:
  - Commit locally, then continue Phase A or batch the current module for one
    deploy/readback when requested.

## 2026-06-26 - Latest tail marker: Phase A patch surface probe effects slice

- Latest local commit for this continuation slice:
  - Message: `plan patch surface probe effects`.
- Current state:
  - This is the twelfth local Phase A render/patch ownership slice.
  - Not deployed by design; no `CLIENT_BUILD_ID` / PWA shell cache bump.
- Root-cause boundary:
  - `planThreadDetailRefreshPatchSurface()` already decided whether the refresh
    should probe tile-pane DOM patch surface, but `refreshCurrentThread()` still
    directly branched on `patchSurfaceProbePlan.shouldProbeTilePatchSurface` to
    call `threadDetailDomPatchSurface()`.
  - `public/thread-detail-render-plan.js` now plans ordered patch-surface probe
    effects; `public/app.js` only executes the real DOM surface probe.
- Validation:
  - Focused:
    `node --test test/thread-detail-render-plan.test.js test/conversation-render.test.js test/mobile-viewport.test.js test/thread-tile-layout-ui.test.js`
    passed (`179` tests).
  - `npm run check` passed.
  - `npm test` passed (`1117` tests).
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Next:
  - Commit locally, then continue Phase A or batch the current module for one
    deploy/readback when requested.

## 2026-06-26 - Latest tail marker: Phase A refresh failure diagnostic effects slice

- Latest local commit for this continuation slice:
  - Message: `plan refresh failure diagnostic effects`.
- Current state:
  - This is the eleventh local Phase A render/patch ownership slice.
  - Not deployed by design; no `CLIENT_BUILD_ID` / PWA shell cache bump.
- Root-cause boundary:
  - `threadDiagnosticEventsApi.threadDetailRefreshFailedDiagnosticEvent()`
    already builds the bounded `thread_detail_refresh_failed` payload, but
    `refreshCurrentThread()` still called the Home AI failure reporter directly
    in the non-abort catch path.
  - `public/thread-detail-render-plan.js` now plans ordered refresh failure
    diagnostic effects; `public/app.js` only executes the real Home AI
    diagnostic failure side effect while preserving abort/throw behavior.
- Validation:
  - Focused:
    `node --test test/thread-detail-render-plan.test.js test/conversation-render.test.js test/mobile-viewport.test.js`
    passed (`175` tests).
  - `npm run check` passed.
  - `npm test` passed (`1116` tests).
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Next:
  - Continue Phase A or batch the current module for one deploy/readback when
    requested.

## 2026-06-26 - Latest tail marker: Phase A auto-scroll hold planning slice

- Latest local commit for this continuation slice:
  - Message: `plan auto scroll hold from scroll`.
- Current state:
  - This is the sixteenth local Phase A render/patch/scroll ownership slice.
  - Not deployed by design; no `CLIENT_BUILD_ID` / PWA shell cache bump.
- Root-cause boundary:
  - `updateConversationAutoScrollHoldFromScroll()` directly decided whether
    user scroll should clear auto-scroll hold, remember hold for the current
    turn, or do nothing.
  - `public/conversation-scroll.js` now owns
    `planConversationAutoScrollHoldFromScroll()`, while `public/app.js`
    supplies near-bottom/recent-scroll/current-turn facts and executes only
    the real hold side effects.
- Validation:
  - Focused:
    `node --test test/conversation-scroll.test.js test/turn-scroll-controls.test.js test/mobile-viewport.test.js test/conversation-render.test.js`
    passed (`136` tests).
  - `npm run check` passed.
  - `npm test` passed (`1120` tests).
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Next:
  - Commit locally, then continue Phase A or batch the current module for one
    deploy/readback when requested.

## 2026-06-26 - Latest tail marker: Phase A bottom-follow lease planning slice

- Latest local commit for this continuation slice:
  - Message: `plan bottom follow lease evaluation`.
- Current state:
  - This is the seventeenth local Phase A render/patch/scroll ownership slice.
  - Not deployed by design; no `CLIENT_BUILD_ID` / PWA shell cache bump.
- Root-cause boundary:
  - `shouldFollowSubmittedMessageToBottom()` and
    `shouldFollowViewportChangeToBottom()` each owned similar policy for
    clearing follow leases while the user is reading the current turn and
    clearing inactive/expired leases.
  - `public/conversation-scroll.js` now owns
    `planBottomFollowLeaseEvaluation()`, while `public/app.js` supplies
    reading/lease facts and executes only the real submitted/viewport clear
    side effects.
- Validation:
  - Focused:
    `node --test test/conversation-scroll.test.js test/turn-scroll-controls.test.js test/mobile-viewport.test.js test/conversation-render.test.js`
    passed (`137` tests).
  - `npm run check` passed.
  - `npm test` passed (`1121` tests).
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Next:
  - Commit locally, then continue Phase A or batch the current module for one
    deploy/readback when requested.

## 2026-06-26 - Latest tail marker: Phase A bottom-follow schedule planning slice

- Latest local commit for this continuation slice:
  - Message: `plan bottom follow scroll schedule`.
- Current state:
  - This is the eighteenth local Phase A render/patch/scroll ownership slice.
  - Not deployed by design; no `CLIENT_BUILD_ID` / PWA shell cache bump.
- Root-cause boundary:
  - `scheduleBottomFollowScroll()` directly owned the hard-coded
    `[0, 80, 240, 600, 1200]` retry delay sequence for bottom-follow scrolls.
  - `public/conversation-scroll.js` now owns
    `planBottomFollowScrollSchedule()`, while `public/app.js` executes only
    the real timer clear/create and bottom-scroll side effects.
- Validation:
  - Focused:
    `node --test test/conversation-scroll.test.js test/turn-scroll-controls.test.js test/mobile-viewport.test.js test/conversation-render.test.js`
    passed (`138` tests).
  - `npm run check` passed.
  - `npm test` passed (`1122` tests).
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Next:
  - Commit locally, then continue Phase A or batch the current module for one
    deploy/readback when requested.

## 2026-06-26 - Latest tail marker: Phase A local patch completion snapshot slice

- Latest local commit for this continuation slice:
  - Message: `plan local patch completion snapshot`.
- Current state:
  - This is the nineteenth local Phase A render/patch/scroll ownership slice.
  - Not deployed by design; no `CLIENT_BUILD_ID` / PWA shell cache bump.
- Root-cause boundary:
  - `completeLocalConversationDomUpdate()` already delegated completion effects
    to `public/thread-detail-dom-patch.js`, but app code still normalized the
    completion input semantics for tile-pane terminal state, single-thread
    patch facts, conversation/patch-shell signatures, and scroll action.
  - `public/thread-detail-dom-patch.js` now owns
    `planLocalConversationDomUpdateCompletionSnapshot()`, and
    `planLocalConversationDomUpdateCompletion()` consumes that normalized
    snapshot before producing tile/single/blocked completion plans.
  - `public/app.js` still collects real DOM/scroll/signature facts and executes
    real hydrate/signature/scroll effects, but no longer owns completion
    snapshot normalization.
- Validation:
  - Focused:
    `node --test test/thread-detail-dom-patch.test.js test/turn-scroll-controls.test.js test/conversation-scroll.test.js test/conversation-render.test.js`
    passed (`172` tests).
  - `npm run check` passed.
  - `npm test` passed (`1124` tests).
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Next:
  - Either batch the current Phase A module for one deploy/readback or continue
    the next small ownership slice if deployment is intentionally deferred.

## 2026-06-26 - Latest tail marker: Phase A v532 module deployed/read back

- Latest local commits for this deployment batch:
  - `13c7b4a` - `plan local patch completion snapshot`
  - `9655fac` - `prepare phase a module shell v532`
- Deployment:
  - Used Home AI central macOS plugin deploy script first with reason
    `codex-mobile-phase-a-render-patch-v532` for the runtime/static module.
  - After recording README/architecture readback evidence, used the same
    central deploy path again with reason
    `codex-mobile-phase-a-v532-docs-readback` so production docs stayed in
    source/prod parity.
  - Latest source ref deployed by the central script: `55d427891cb8`,
    dirty `false`.
  - Latest backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260626T152731Z-plugin-codex-mobile-web-codex-mobile-phase-a-v532-docs-readback`.
  - Launchd label `com.hermesmobile.plugin.codex-mobile` was running after
    deploy; codex profile audit reported `blockingIssueCount=0`.
- Production readback:
  - `/api/public-config`:
    `clientBuildId=0.1.11|codex-mobile-shell-v532`,
    `shellCacheName=codex-mobile-shell-v532`,
    `activeProfileId=previous`.
  - `scripts/codex-mobile-phase-b-readback-smoke.js --server http://127.0.0.1:8787 --json`
    passed with `status=ready`, detail `readMode=projection-active-overlay`,
    `coldPathOwner=warm-path`, and active overlay gate `ready`.
  - Source/prod short SHA-256 hashes matched for:
    `public/app.js`, `public/sw.js`, `public/thread-detail-dom-patch.js`,
    `public/conversation-scroll.js`, `public/thread-detail-render-plan.js`,
    `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
- Current state:
  - Phase A render/patch/scroll ownership batch is now deployed to production.
  - This does not complete the full system optimization goal. Remaining high
    value targets are Phase C pane-state architecture and Phase E browser /
    visual harness coverage, plus continued observation of
    `conversation_projection_mismatch` diagnostics.
- Privacy:
  - Handoff records only bounded build ids, statuses, short hashes, paths, and
    timing/owner categories. It does not include secrets, keys, cookies,
    launch tokens, private thread bodies, task-card bodies, uploads, or long
    logs.

## 2026-06-26 - Phase C pane count state planning local slice

- Latest local slice:
  - Phase C pane-state architecture continues after the deployed v532 Phase A
    baseline. This slice is local/private only and is not deployed by design.
- Root-cause boundary:
  - Symptom/risk:平铺模式的自动窗口数、显式窗口数、生效窗口数、最小关闭数和
    最大新增数仍由 `public/app.js` 直接组合 layout capacity、候选线程、运行
    线程、当前线程和用户保存的 pane count。这会让宽屏/iPad/手动加窗/
    overflow split 的状态策略继续散落在 UI 编排层。
  - Failing layer: frontend thread-tile pane-state ownership, not DOM render,
    server projection, task-card protocol, network reads, or shell/cache.
  - Violated invariant: `public/app.js` should supply real DOM/thread facts and
    execute side effects; deterministic pane-state rules should live in a pure
    helper with focused tests.
- Changes:
  - `public/thread-tile-state.js` now exposes `paneCountStatePlan()` to
    normalize layout capacity, candidate ids, max candidate ids, running/current
    thread ids, and explicit pane count into `autoPaneCount`,
    `effectivePaneCount`, `minPaneCount`, and `maxPaneCount`.
  - `public/app.js` now collects thread/list/layout facts through
    `threadTilePaneCountState()`; `autoThreadTilePaneCount()`,
    `effectiveThreadTilePaneCount()`, `threadTileMinimumPaneCount()`, and
    `threadTileMaximumPaneCount()` read helper output instead of owning the
    policy.
  - Added coverage for automatic current/running-thread sizing, explicit count
    above recommended capacity but inside candidate/user limits, empty-candidate
    fallback, and `explicitPaneCount: 0` precedence over legacy fields.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md` with the Phase C boundary.
- Validation:
  - Focused:
    `node --test test/thread-tile-state.test.js test/thread-tile-layout.test.js test/thread-tile-layout-ui.test.js test/thread-tile-actions.test.js`
    passed (`48` tests).
  - `npm run check` passed.
  - `npm test` passed (`1125` tests).
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Deployment:
  - Not deployed. No `CLIENT_BUILD_ID` / PWA shell cache bump. This is a small
    Phase C local slice to batch with the next pane-state module before one
    production deployment.
- Next:
  - Continue Phase C by moving the next pane runtime ownership boundary out of
    `public/app.js`, likely split sizing / pane-local draft/runtime ownership /
    pane-local command-detail state, before batching a deployable module.
- Privacy:
  - Only bounded file paths, test counts, build/slice labels, and architecture
    state are recorded. No secrets, cookies, launch tokens, private thread
    bodies, task-card bodies, uploads, or long logs are included.

## 2026-06-26 - Phase C pane scroll runtime planning local slice

- Latest local slice:
  - Continued Phase C pane-state/runtime architecture after `29bd2a0`
    (`plan thread tile pane counts`). This slice is local/private only and is
    not deployed by design.
- Root-cause boundary:
  - Symptom/risk: each tile pane should behave like a smaller single-thread
    window, but pane-local scroll runtime decisions were still inline in
    `public/app.js`: near-bottom threshold, scroll-hold remember/clear,
    bottom-jump button visibility, and restore-distance versus bottom-follow
    after pane patches.
  - Failing layer: frontend thread-tile pane-local runtime policy, not DOM
    structure, CSS, server projection, task-card protocol, network reads, or
    shell/cache.
  - Violated invariant: `public/app.js` should own DOM reads/writes and
    class/ARIA side effects; deterministic pane-local scroll policy should be
    helper-owned and covered by focused tests.
- Changes:
  - `public/thread-tile-state.js` now exposes `paneScrollMetrics()`,
    `paneScrollHoldPlan()`, `paneBottomButtonPlan()`, and
    `paneScrollRestorePlan()`.
  - `public/app.js` now uses those plans for tile-pane scroll snapshots,
    near-bottom checks, hold Map mutation, bottom button show/hide, and pane
    patch scroll restoration while keeping real DOM effects local.
  - Tests cover 48px near-bottom behavior, 96px scrollable button behavior,
    hold clear/remember, stick-to-bottom override, restore-distance top
    calculation, and app wiring.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md` with the Phase C boundary.
- Validation:
  - Focused:
    `node --test test/thread-tile-state.test.js test/thread-tile-layout-ui.test.js test/thread-tile-actions.test.js test/thread-tile-layout.test.js test/turn-scroll-controls.test.js`
    passed (`55` tests).
  - `npm run check` passed.
  - `npm test` passed (`1126` tests).
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Deployment:
  - Not deployed. No `CLIENT_BUILD_ID` / PWA shell cache bump. This remains a
    small Phase C local slice to batch with the next pane-state/runtime module.
- Next:
  - Continue Phase C with split sizing, pane-local draft/runtime ownership, or
    pane-local command detail state. Batch a deploy only after a coherent
    pane-state module is ready.
- Privacy:
  - Only bounded file paths, test counts, and architecture state are recorded.
    No secrets, cookies, launch tokens, private thread bodies, task-card bodies,
    uploads, screenshots, or long logs are included.

## 2026-06-27 - Phase C pane render frame planning local slice

- Latest local slice:
  - Continued Phase C pane-state/render-scheduling architecture after `828c9b5`
    (`plan thread tile render signature`). This slice is local/private only
    and is not deployed by design.
- Root-cause boundary:
  - Symptom/risk: `scheduleRenderThreadTilePane()` sits at the boundary between
    pane-local patch and full tile-board render. Inline app-layer conditions
    for missing ids, disabled tile mode, invisible panes, existing render
    frames, and patch-miss full-render fallback make duplicate frame scheduling
    and full-board refreshes harder to explain during visible jitter incidents.
  - Failing layer: frontend thread-tile pane render-frame scheduling policy,
    not DOM patching, CSS, server projection, detail reads, task-card protocol,
    or shell/cache.
  - Violated invariant: `public/app.js` should own browser timers and DOM side
    effects; deterministic pane render-frame scheduling and patch-miss policy
    should live in a pure helper with focused tests.
- Changes:
  - `public/thread-tile-state.js` now exposes `paneRenderFramePlan()` for
    missing-id, disabled, pane-not-visible, already-scheduled, and
    schedule-pane-render branches.
  - `public/app.js` now calls that helper from
    `scheduleRenderThreadTilePane()` and only executes requestAnimationFrame /
    setTimeout, pane patching, and helper-approved full-render-on-patch-miss
    side effects.
  - `test/thread-tile-state.test.js` covers the scheduling branches and the
    patch-miss full-render flag; `test/thread-tile-layout-ui.test.js` guards
    app wiring.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md` with the Phase C boundary.
- Validation:
  - Focused:
    `node --test test/thread-tile-state.test.js test/thread-tile-layout-ui.test.js test/conversation-render.test.js`
    passed (`143` tests).
  - `npm run check` passed.
  - `npm test` passed (`1133` tests).
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Deployment:
  - Not deployed. No `CLIENT_BUILD_ID` / PWA shell cache bump. This remains a
    small Phase C local slice to batch with the next pane-state/render module.
- Next:
  - Commit locally, then continue with pane patch preflight/diagnostics,
    split sizing controls, Phase E pane visual smoke, or Phase D task-card
    runtime hardening before one batch deploy.
- Privacy:
  - Only bounded file paths, test counts, and architecture state are recorded.
    No secrets, cookies, launch tokens, private thread bodies, task-card bodies,
    uploads, screenshots, or long logs are included.

## 2026-06-26 - Phase C composer target planning local slice

- Latest local slice:
  - Continued Phase C pane-state architecture after `6cb6c8a`
    (`plan thread tile pane scroll`). This slice is local/private only and is
    not deployed by design.
- Root-cause boundary:
  - Symptom/risk: tile mode uses one shared bottom Composer, but the decision
    for target thread id, tile-only target placeholder, new-thread placeholder,
    and selected/current-thread fallback was still inline in `public/app.js`.
    That kept a high-risk "send to the wrong pane" rule in UI orchestration.
  - Failing layer: frontend thread-tile shared Composer target ownership, not
    DOM structure, draft persistence, server projection, task-card protocol,
    network reads, or shell/cache.
  - Violated invariant: `public/app.js` should collect real DOM/thread facts
    and execute UI side effects; deterministic pane-state rules should live in
    pure helpers with focused tests.
- Changes:
  - `public/thread-tile-state.js` now exposes `composerTargetPlan()` for
    new-thread mode, tile-surface activation, selected-pane/current-thread
    fallback, active ids, and target thread id.
  - `public/thread-tile-state.js` now exposes
    `composerTargetPlaceholderPlan()` for the new-thread placeholder,
    tile-only `发送到：线程名` placeholder, and default `Message Codex`.
  - `public/app.js` now supplies real tile DOM state and thread-title facts,
    then reads helper output for `currentComposerThreadId()`,
    `isThreadTileComposerContext()`, `composerPlaceholderText()`, and
    `composerShowsTargetPlaceholder()`.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md` with the Phase C boundary.
- Validation:
  - Focused:
    `node --test test/thread-tile-state.test.js test/thread-tile-layout-ui.test.js test/composer-draft.test.js test/conversation-render.test.js`
    passed (`141` tests).
  - `npm run check` passed.
  - `npm test` passed (`1127` tests).
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Deployment:
  - Not deployed. No `CLIENT_BUILD_ID` / PWA shell cache bump. This remains a
    small Phase C local slice to batch with the next pane-state/runtime module.
- Next:
  - Continue Phase C with pane-local draft/runtime ownership, pane-local
    command detail state, split sizing, or browser/visual validation around
    tile Composer target switching before one batch deploy.
- Privacy:
  - Only bounded file paths, test counts, and architecture state are recorded.
    No secrets, cookies, launch tokens, private thread bodies, task-card bodies,
    uploads, screenshots, or long logs are included.

## 2026-06-26 - Phase C composer runtime restore planning local slice

- Latest local slice:
  - Continued Phase C pane-state architecture after `796d6b5`
    (`plan thread tile composer target`). This slice is local/private only and
    is not deployed by design.
- Root-cause boundary:
  - Symptom/risk: tile mode uses one shared bottom Composer whose Fast/model/
    reasoning/permission controls must follow the active pane. The restore
    policy for new-thread defaults, thread draft runtime values, missing-draft
    keep/reset behavior, and option validation was still inline in
    `public/app.js` `applyDraftRuntimeSelection()`.
  - Failing layer: frontend thread-tile shared Composer runtime ownership, not
    draft storage, attachment restore, DOM structure, server projection,
    task-card protocol, network reads, or shell/cache.
  - Violated invariant: `public/app.js` should collect current options/defaults
    and execute state writes; deterministic runtime restore policy should live
    in a pure helper with focused tests.
- Changes:
  - `public/thread-tile-state.js` now exposes
    `composerDraftRuntimeSelectionPlan()` for new-thread draft/default runtime
    values, old-thread draft runtime values, missing-draft keep/reset behavior,
    Fast state, and model/effort/permission option checks.
  - `public/app.js` now calls that helper from `applyDraftRuntimeSelection()`
    and only performs the resulting state assignments.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md` with the Phase C boundary.
- Validation:
  - Focused:
    `node --test test/thread-tile-state.test.js test/thread-tile-layout-ui.test.js test/composer-draft.test.js test/conversation-render.test.js`
    passed (`142` tests).
  - `npm run check` passed.
  - `npm test` passed (`1128` tests).
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Deployment:
  - Not deployed. No `CLIENT_BUILD_ID` / PWA shell cache bump. This remains a
    small Phase C local slice to batch with the next pane-state/runtime module.
- Next:
  - Commit locally, then continue Phase C with pane-local command detail state,
    split sizing, or browser/visual validation around tile Composer
    target/runtime switching before one batch deploy.
- Privacy:
  - Only bounded file paths, test counts, and architecture state are recorded.
    No secrets, cookies, launch tokens, private thread bodies, task-card bodies,
    uploads, screenshots, or long logs are included.

## 2026-06-27 - Phase C operation minimum refresh planning local slice

- Latest local slice:
  - Continued Phase C pane-state/runtime architecture after `b2f65f9`
    (`plan thread tile composer runtime`). This slice is local/private only and
    is not deployed by design.
- Root-cause boundary:
  - Symptom/risk: tile panes should own their compact operation bubble timing
    like independent mobile windows. The 500ms minimum-refresh timer still had
    inline `public/app.js` policy for which active panes to patch and when to
    fallback to full render after no pane patch succeeded.
  - Failing layer: frontend thread-tile pane-local operation refresh policy,
    not operation HTML, DOM structure, server projection, task-card protocol,
    network reads, or shell/cache.
  - Violated invariant: `public/app.js` should own real timers and render side
    effects; deterministic pane-local operation refresh targets should live in
    pure helper policy with focused tests.
- Changes:
  - `public/thread-tile-state.js` now exposes
    `operationMinimumRefreshPlan()` for disabled/no-active/active-pane patch
    targets and full-render-on-patch-miss policy.
  - `public/app.js` now calls that helper from
    `scheduleThreadTileOperationMinimumRefresh()` and only executes the timer,
    pane patch, and full-render side effects.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md` with the Phase C boundary.
- Validation:
  - Focused:
    `node --test test/thread-tile-state.test.js test/thread-tile-layout-ui.test.js test/conversation-render.test.js test/live-operation-dock-state.test.js`
    passed (`145` tests).
  - `npm run check` passed.
  - `npm test` passed (`1128` tests).
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Deployment:
  - Not deployed. No `CLIENT_BUILD_ID` / PWA shell cache bump. This remains a
    small Phase C local slice to batch with the next pane-state/runtime module.
- Next:
  - Commit locally, then continue Phase C with pane-local command detail state,
    split sizing, or browser/visual validation before one batch deploy.
- Privacy:
  - Only bounded file paths, test counts, and architecture state are recorded.
    No secrets, cookies, launch tokens, private thread bodies, task-card bodies,
    uploads, screenshots, or long logs are included.

## 2026-06-27 - Phase C pane display layout planning local slice

- Latest local slice:
  - Continued Phase C pane-state architecture after `2d9fe2e`
    (`plan thread tile operation refresh`). This slice is local/private only
    and is not deployed by design.
- Root-cause boundary:
  - Symptom/risk: tile mode display layout still let `public/app.js` directly
    decide visible pane count, layout capacity, actual columns, rows, and
    `columnGroups`. Those decisions govern the user's overflow/split behavior,
    such as five panes in a four-column capacity becoming one column-level
    up/down split instead of a whole-board wrap.
  - Failing layer: frontend thread-tile pane display layout state, not CSS,
    DOM templates, server-saved display settings, detail-load concurrency,
    server projection, task-card protocol, or shell/cache.
  - Violated invariant: `public/app.js` should supply current layout/id/split
    facts and render the result; deterministic pane display layout planning
    should live in a pure helper with focused tests.
- Changes:
  - `public/thread-tile-state.js` now exposes `layoutCapacity()` and
    `paneDisplayLayoutPlan()` for display capacity, visible panes, capacity
    columns, actual columns, rows, overflow column groups, and explicit
    split-pair grouping.
  - `public/app.js` now calls those helpers from `threadTileLayoutCapacity()`
    and `threadTileDisplayLayout()` while keeping DOM/render side effects.
  - `test/thread-tile-state.test.js` covers five panes in four columns and
    explicit split-pair grouping; `test/thread-tile-layout-ui.test.js` now
    guards the new helper boundary.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md` with the Phase C boundary.
- Validation:
  - Focused:
    `node --test test/thread-tile-state.test.js test/thread-tile-layout.test.js test/thread-tile-layout-ui.test.js`
    passed (`48` tests).
  - `npm run check` passed.
  - `npm test` passed (`1130` tests).
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Deployment:
  - Not deployed. No `CLIENT_BUILD_ID` / PWA shell cache bump. This remains a
    small Phase C local slice to batch with the next pane-state/split module.
- Next:
  - Commit locally, then continue Phase C with split sizing controls,
    measured pane detail-load concurrency tuning, browser/visual validation,
    or transition back to Phase D task-card runtime hardening before one batch
    deploy.
- Privacy:
  - Only bounded file paths, test counts, and architecture state are recorded.
    No secrets, cookies, launch tokens, private thread bodies, task-card bodies,
    uploads, screenshots, or long logs are included.

## 2026-06-27 - Phase C detail-load concurrency planning local slice

- Latest local slice:
  - Continued Phase C pane-state/detail-load architecture after `99d3788`
    (`plan thread tile display layout`). This slice is local/private only and
    is not deployed by design.
- Root-cause boundary:
  - Symptom/risk: wide tile mode can show more than four panes, but starting a
    detail read for every visible pane can amplify large-session cold-path
    pressure. The concurrency cap was still hardcoded in `public/app.js` as
    `Math.min(4, THREAD_TILE_USER_MAX_PANES)`.
  - Failing layer: frontend thread-tile detail-load concurrency policy, not
    network execution, detail API behavior, projection/read mode, DOM, CSS,
    server-saved display settings, task-card protocol, or shell/cache.
  - Violated invariant: `public/app.js` should collect active pane facts and
    execute network side effects; deterministic concurrency limit planning
    should live in a pure helper with focused tests.
- Changes:
  - `public/thread-tile-state.js` now exposes
    `DEFAULT_DETAIL_LOAD_MAX_CONCURRENT` and `detailLoadConcurrencyPlan()` for
    active pane count, user pane cap, configured cap, and final
    `maxConcurrentLoads`.
  - `public/app.js` now calls that helper from `ensureThreadTileDetails()` and
    passes the planned limit into `detailLoadQueuePlan()`.
  - `test/thread-tile-state.test.js` covers six-pane/four-load cap,
    two-pane/two-load cap, user max cap, invalid config fallback, and
    `test/thread-tile-layout-ui.test.js` guards the app wiring.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md` with the Phase C boundary.
- Validation:
  - Focused:
    `node --test test/thread-tile-state.test.js test/thread-tile-layout-ui.test.js`
    passed (`33` tests).
  - `npm run check` passed.
  - `npm test` passed (`1131` tests).
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Deployment:
  - Not deployed. No `CLIENT_BUILD_ID` / PWA shell cache bump. This remains a
    small Phase C local slice to batch with the next pane-state/split module.
- Next:
  - Commit locally, then continue with split sizing controls, measured
    production/browser tuning of the detail-load cap, or Phase E visual smoke
    before one batch deploy.
- Privacy:
  - Only bounded file paths, test counts, and architecture state are recorded.
    No secrets, cookies, launch tokens, private thread bodies, task-card bodies,
    uploads, screenshots, or long logs are included.

## 2026-06-27 - Phase C pane render signature planning local slice

- Latest local slice:
  - Continued Phase C pane-state/render-authority architecture after `77628d0`
    (`plan thread tile detail load concurrency`). This slice is local/private
    only and is not deployed by design.
- Root-cause boundary:
  - Symptom/risk: tile board render signatures decide whether the board can be
    reused/patched or must be fully rendered. The signature schema was still
    assembled inline in `public/app.js`, mixing DOM orchestration with
    deterministic state-signature ownership and making future
    duplicate/missing/render-mismatch diagnostics harder to reason about.
  - Failing layer: frontend thread-tile render signature schema policy, not DOM
    rendering, CSS, server projection, detail reads, task-card protocol, or
    shell/cache.
  - Violated invariant: `public/app.js` should collect current app facts and
    execute render side effects; the tile render signature schema should live
    in a pure helper with focused tests.
- Changes:
  - `public/thread-tile-state.js` now exposes `paneRenderSignaturePlan()` for
    tile board signature object/string construction.
  - The helper filters stale loading/error/operation facts to current pane ids,
    preserving current behavior while preventing non-visible pane state from
    entering the board signature.
  - `public/app.js` now calls the helper from `threadTileRenderSignature()` and
    only supplies desired pane count, split pairs, selected pane, loading ids,
    error pairs, operation signatures, and per-pane conversation signatures.
  - `test/thread-tile-state.test.js` covers the schema and stale-state
    filtering; `test/thread-tile-layout-ui.test.js` guards app wiring.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md` with the Phase C boundary.
- Validation:
  - Focused:
    `node --test test/thread-tile-state.test.js test/thread-tile-layout-ui.test.js test/conversation-render.test.js`
    passed (`142` tests).
  - `npm run check` passed.
  - `npm test` passed (`1132` tests).
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Deployment:
  - Not deployed. No `CLIENT_BUILD_ID` / PWA shell cache bump. This remains a
    small Phase C local slice to batch with the next pane-state/render module.
- Next:
  - Commit locally, then continue with split sizing controls, Phase E pane
    visual smoke, or Phase D task-card runtime hardening before one batch
    deploy.
- Privacy:
  - Only bounded file paths, test counts, and architecture state are recorded.
    No secrets, cookies, launch tokens, private thread bodies, task-card bodies,
    uploads, screenshots, or long logs are included.

## 2026-06-27 - Phase C pane patch preflight planning local slice

- Latest local slice:
  - Continued Phase C pane-state/render-patch architecture after `00d436b`
    (`plan thread tile render frames`). This slice is local/private only and
    is not deployed by design.
- Root-cause boundary:
  - Symptom/risk: `patchThreadTilePane()` is the critical branch between a
    pane-local DOM patch and upstream full tile-board render fallback. Inline
    app-layer preflight checks made patch failures harder to classify when
    investigating visible jitter, missing pane content, or full-board redraws.
  - Failing layer: frontend thread-tile pane patch preflight policy, not DOM
    patch application, CSS, server projection, detail reads, task-card
    protocol, or shell/cache.
  - Violated invariant: `public/app.js` should collect DOM/layout facts and
    execute patch side effects; deterministic patch eligibility and failure
    reason classification should live in a pure helper with focused tests.
- Changes:
  - `public/thread-tile-state.js` now exposes `panePatchPreflightPlan()` for
    missing-id, disabled, pane-not-visible, missing-conversation,
    not-tile-surface, missing-board, layout-disabled, pane-not-candidate,
    missing-pane, pending-facts, and ready branches.
  - `public/app.js` now calls the helper from `patchThreadTilePane()` while
    preserving the previous short-circuit order before DOM/layout work.
  - `test/thread-tile-state.test.js` covers the preflight branches;
    `test/thread-tile-layout-ui.test.js` guards app wiring.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md` with the Phase C boundary.
- Validation:
  - Focused:
    `node --test test/thread-tile-state.test.js test/thread-tile-layout-ui.test.js test/conversation-render.test.js`
    passed (`144` tests).
  - `npm run check` passed.
  - `npm test` passed (`1134` tests).
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Deployment:
  - Not deployed. No `CLIENT_BUILD_ID` / PWA shell cache bump. This remains a
    small Phase C local slice to batch with the next pane-state/render module.
- Next:
  - Commit locally, then continue with pane patch completion/result planning,
    Phase E pane visual smoke, or Phase D task-card runtime hardening before
    one batch deploy.
- Privacy:
  - Only bounded file paths, test counts, and architecture state are recorded.
    No secrets, cookies, launch tokens, private thread bodies, task-card bodies,
    uploads, screenshots, or long logs are included.

## 2026-06-27 - Phase C pane patch completion planning local slice

- Latest local slice:
  - Continued Phase C pane-state/render-patch architecture after `dec2538`
    (`plan thread tile patch preflight`). This slice is local/private only and
    is not deployed by design.
- Root-cause boundary:
  - Symptom/risk: after tile pane preflight succeeds, `patchThreadTilePane()`
    still owned the completion branch inline: source pane missing, patch
    result handling, hydrate, scroll restore, bottom-button update, render
    signature writeback, patch-shell signature clear, and action binding. This
    made successful pane-local patch transactions harder to audit when
    investigating jitter or fallback to full board render.
  - Failing layer: frontend thread-tile pane patch completion/result planning,
    not keyed DOM patching, CSS, server projection, detail reads, task-card
    protocol, or shell/cache.
  - Violated invariant: `public/app.js` should execute real DOM side effects;
    deterministic patch completion intent and failure reason classification
    should live in a pure helper with focused tests.
- Changes:
  - `public/thread-tile-state.js` now exposes `panePatchCompletionPlan()` for
    missing-id, missing-source-pane, source-pane-ready, missing-patched-pane,
    and complete-pane-patch branches.
  - The helper outputs side-effect intent for hydrate, restoreScroll,
    updateBottomButton, bottom-button update mode, writeRenderSignature,
    clearPatchShellSignature, and bindActions.
  - `public/app.js` now follows that plan from `patchThreadTilePane()` while
    keeping `patchNode`, hydration, scroll restore, signature writeback, and
    action binding as app-owned DOM side effects.
  - `test/thread-tile-state.test.js` covers the completion branches;
    `test/thread-tile-layout-ui.test.js` guards app wiring.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md` with the Phase C boundary.
- Validation:
  - Focused:
    `node --test test/thread-tile-state.test.js test/thread-tile-layout-ui.test.js test/conversation-render.test.js`
    passed (`145` tests).
  - `npm run check` passed.
  - `npm test` passed (`1135` tests).
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Deployment:
  - Not deployed. No `CLIENT_BUILD_ID` / PWA shell cache bump. This remains a
    small Phase C local slice to batch with the next pane-state/render module.
- Next:
  - Commit locally, then continue with Phase E pane visual smoke, split sizing
    controls, or Phase D task-card runtime hardening before one batch deploy.
- Privacy:
  - Only bounded file paths, test counts, and architecture state are recorded.
    No secrets, cookies, launch tokens, private thread bodies, task-card bodies,
    uploads, screenshots, or long logs are included.

## 2026-06-27 - Phase E thread tile visual fixture local slice

- Latest local slice:
  - Started Phase E browser/visual coverage after the Phase C pane patch
    completion slice. This slice is local/private only and is not deployed by
    design.
- Root-cause boundary:
  - Symptom/risk: unit tests could prove thread-tile helper grouping, but not
    whether the real CSS/DOM layout produced sparse second rows, overlapping
    panes, fixed bottom-control rows, operation-bubble duration clipping, or
    Composer/pane overlap on wide displays.
  - Failing layer: missing browser/visual evidence for thread-tile layout, not
    runtime thread projection, task-card protocol, CSS behavior changes,
    Home AI host/proxy, or shell/cache.
  - Violated invariant: Phase E visual closure should exercise the same helper
    output through real browser layout before relying on screenshots or
    user-observed regressions.
- Changes:
  - Added `scripts/codex-mobile-thread-tile-visual-fixture.js`.
  - The fixture uses `public/thread-tile-layout.js` and
    `public/thread-tile-state.js` to build bounded fake pane layouts, loads
    real `public/styles.css`, drives headless Chrome, writes screenshots, and
    validates DOM rect metrics.
  - Covered 3000px wide 5-pane layout as one row and overlay/tablet-landscape
    5-pane layout as four columns with only one vertical split column.
  - Validates pane/board/composer bounds, pane non-overlap, non-split column
    full height, hidden bottom buttons not occupying fixed layout, pane-local
    operation bubble overlay bounds, and visible command duration text.
  - Added `test/thread-tile-layout-ui.test.js` coverage for model/HTML/privacy
    bounds and added the new script to `npm run check`.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
- Validation:
  - Focused:
    `node --test test/thread-tile-layout-ui.test.js test/thread-tile-state.test.js test/thread-tile-layout.test.js`
    passed (`54` tests).
  - Real headless Chrome fixtures:
    `node scripts/codex-mobile-thread-tile-visual-fixture.js --width 3000 --height 1500 --panes 5 --json`
    passed, producing one-row 5-pane wide layout evidence.
  - Real headless Chrome fixtures:
    `node scripts/codex-mobile-thread-tile-visual-fixture.js --width 3000 --height 1500 --panes 5 --menu-overlay --json`
    passed, producing one vertical split-column overlay evidence.
  - `npm run check` passed.
  - `npm test` passed (`1136` tests).
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Deployment:
  - Not deployed. No `CLIENT_BUILD_ID` / PWA shell cache bump. This is a
    Phase E verification capability slice to batch with later browser/visual
    coverage before one module deploy.
- Next:
  - Continue Phase E with embedded/PWA live-debug coverage for Composer input,
    long-turn streaming, task-card expand/collapse, image rendering, or PWA
    shell refresh.
- Privacy:
  - Fixture content is fake and bounded. Artifacts record screenshots and
    layout metrics only. No secrets, cookies, launch tokens, private thread
    bodies, task-card bodies, upload bytes, private paths, provider payloads,
    prompts, or long logs are included.

## 2026-06-27 - Phase E thread tile Composer keyboard fixture local slice

- Latest local slice:
  - Continued Phase E browser/visual coverage after `ddfb029`
    (`add thread tile visual fixture`). This slice is local/private only and is
    not deployed by design.
- Root-cause boundary:
  - Symptom/risk: Composer input in tile mode can be reported as causing
    whole-screen shift/repaint. The previous Phase E fixture proved wide/overlay
    pane layout, but did not prove embedded keyboard-open and typed Composer
    content keep the app transform, board, panes, and shared Composer stable.
  - Failing layer: missing browser/visual evidence for tile Composer keyboard
    state, not runtime server projection, task-card protocol, Home AI host
    proxy, shell/cache, or a new client-side masking fallback.
  - Violated invariant: Phase E visual closure for tile mode must measure real
    Chrome DOM rects and computed transform for keyboard/input states, not only
    source-string CSS assertions.
- Changes:
  - `scripts/codex-mobile-thread-tile-visual-fixture.js` now accepts
    `--keyboard` and `--typed-lines <count>`.
  - The fixture simulates bounded fake typed Composer text, adjusts the fake
    Composer/input height, and validates app transform stability, input
    containment, typed input stability, and the existing pane/board/composer
    non-overlap checks.
  - `test/thread-tile-layout-ui.test.js` covers argument parsing, fake typed
    text, Composer height calculations, keyboard HTML output, validation hooks,
    and privacy boundaries.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
- Validation:
  - Focused:
    `node --test test/thread-tile-layout-ui.test.js test/thread-tile-state.test.js test/thread-tile-layout.test.js`
    passed (`54` tests).
  - Real headless Chrome fixture:
    `node scripts/codex-mobile-thread-tile-visual-fixture.js --width 3000 --height 1500 --panes 5 --json`
    passed, preserving the prior one-row 5-pane wide layout evidence.
  - Real headless Chrome fixture:
    `node scripts/codex-mobile-thread-tile-visual-fixture.js --width 1800 --height 920 --panes 3 --keyboard --typed-lines 4 --json`
    passed with `appTransform=none`, `inputInsideComposer=true`, and
    `typedInputStable=true`.
  - Screenshot visually inspected:
    `/Users/xuxin/.homeai-qa/artifacts/codex-mobile-thread-tile-3pane-wide-20260626T172239Z-90154-hltexz.png`.
  - `npm run check` passed.
  - `npm test` passed (`1136` tests).
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Deployment:
  - Not deployed. No `CLIENT_BUILD_ID` / PWA shell cache bump. This is another
    Phase E verification capability slice to batch with later browser/visual
    coverage before one module deploy.
- Next:
  - Continue Phase E with real embedded/PWA smoke around long-turn streaming,
    task-card expand/collapse, upload/generated image rendering, and PWA shell
    refresh; or return to Phase A/B projection mismatch and large-session
    ownership if user prioritizes runtime fixes over more harness coverage.
- Privacy:
  - Fixture content is fake and bounded. Artifacts record screenshots and
    layout metrics only. No secrets, cookies, launch tokens, private thread
    bodies, task-card bodies, upload bytes, private paths, provider payloads,
    prompts, or long logs are included.

## 2026-06-27 - Phase A thread-open loading shell ownership local slice

- Latest local slice:
  - Returned from Phase E fixture work to Phase A/B projection/render state
    ownership after `2be71e0` (`extend thread tile visual keyboard fixture`).
    This slice is local/private only and is not deployed by design.
- Root-cause boundary:
  - Symptom/risk: thread opens can show empty/partial history when a thread-list
    summary row with `turns: []` or stale detail metadata is treated as current
    conversation detail while the real detail API response is still in flight.
  - Failing layer: frontend current-thread loading-shell state ownership, not
    server projection, DOM patching, task-card protocol, Home AI host/proxy,
    CSS, or shell/cache.
  - Violated invariant: thread-list summaries may provide title/status/workspace
    context, but they must not own current conversation `turns` or detail-only
    metadata during a thread open.
- Changes:
  - `public/thread-detail-state.js` now exposes
    `planThreadOpenLoadingShell()`.
  - The helper accepts only id-matched summaries, strips detail-only fields,
    and produces a bounded loading shell with `turns: []`,
    `mobileLoading: true`, and `mobileLoadError: ""`.
  - Missing or mismatched summaries fail closed to a bounded fallback shell for
    the requested thread id.
  - `public/app.js` `loadThread()` now executes that helper instead of
    constructing the summary/loading shell inline.
  - `test/thread-detail-state.test.js` covers stale turns, task-card arrays,
    runtime settings, diagnostics, loaded-detail markers, read modes, missing
    summary, and mismatched-summary branches.
  - `test/conversation-render.test.js` guards app wiring and prevents the old
    inline summary/detail construction from returning.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
- Validation:
  - Focused:
    `node --test test/thread-detail-state.test.js test/conversation-render.test.js test/thread-detail-render-plan.test.js`
    passed (`186` tests).
  - `npm run check` passed.
  - `npm test` passed (`1137` tests).
  - `npm run check:macos` passed.
  - `git diff --check` passed.
- Deployment:
  - Not deployed. No `CLIENT_BUILD_ID` / PWA shell cache bump. This is a
    Phase A state-ownership slice to batch with the next projection/render
    ownership changes before one module deploy.
- Next:
  - Continue Phase A by extracting more current-thread render/patch authority
    from `refreshCurrentThread()` / `renderCurrentThread()`, especially
    projection mismatch outcome classification and refresh/DOM authority
    diagnostics; or continue Phase B if runtime readback points to cold-path
    source ownership.
- Privacy:
  - Only bounded file paths, helper branch names, and test counts are recorded.
    No secrets, cookies, launch tokens, private thread bodies, task-card bodies,
    upload bytes, private paths, provider payloads, prompts, or long logs are
    included.

## 2026-06-27 - Phase A projection consistency effects planning local slice

- Latest local slice:
  - Continued Phase A projection/render diagnostic ownership after `d1b5759`
    (`plan thread open loading shell ownership`).
  - This slice is local/private only and is not deployed by design.
- Root-cause boundary:
  - Symptom/risk: client/server projection drift can show duplicate, missing,
    or reordered visible items. The client needs deterministic bounded
    diagnostics, but `public/app.js` still owned the projection consistency
    mismatch/duplicate/order outcome branches.
  - Failing layer: frontend diagnostic outcome planning, not Home AI host
    intake, server projection, DOM rendering, CSS, task-card routing, or
    shell/cache.
  - Violated invariant: `public/app.js` should collect real runtime evidence
    and execute reporting side effects; pure helpers should own bounded
    diagnostic classification and payload/effect planning.
- Changes:
  - `public/thread-diagnostic-events.js` now exposes
    `conversationProjectionConsistencyEffects()`.
  - The helper converts projection and turn-order snapshots into bounded
    failure/success effects for `render_signature_mismatch`,
    `duplicate_render_keys`, and `turn_order_mismatch`.
  - `public/app.js` `checkConversationProjectionConsistency()` now gets
    snapshots, asks the helper for an effects plan, and only executes
    `recordHomeAiDiagnosticFailure()` / `recordHomeAiDiagnosticSuccess()`.
  - `test/thread-diagnostic-events.test.js` covers failure, success, no-snapshot,
    and privacy behavior for the pure effects helper.
  - `test/conversation-render.test.js` guards the app wiring so the low-level
    mismatch helper calls and inline diagnostic construction do not return.
  - `test/mobile-viewport.test.js` now asserts the same turn-order diagnostic
    wiring boundary through the projection-consistency effects helper instead
    of the old inline `hasTurnOrderMismatch()` path.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
- Validation:
  - Focused:
    `node --test test/thread-diagnostic-events.test.js test/conversation-render.test.js test/mobile-viewport.test.js`
    passed.
  - Syntax:
    `node --check public/thread-diagnostic-events.js && node --check public/app.js`
    passed.
- Deployment:
  - Not deployed. No `CLIENT_BUILD_ID` / PWA shell cache bump. This is a
    Phase A diagnostic ownership slice to batch with the next projection/render
    module before one deploy/readback.
- Next:
  - Run full validation, commit locally, then continue Phase A/B with remaining
    current-thread render/patch authority and large-session cold-path evidence.
- Privacy:
  - Only bounded file paths, helper names, diagnostic type labels, and test
    counts are recorded. No secrets, cookies, launch tokens, private thread
    bodies, task-card bodies, upload bytes, private paths, provider payloads,
    prompts, or long logs are included.

## 2026-06-27 - Phase A thread-detail switch client event plan local slice

- Latest local slice:
  - Continued Phase A `loadThread()` ownership reduction after `8af197f`
    (`delegate load failure diagnostics`).
  - This slice is local/private only and is not deployed by design.
- Root-cause boundary:
  - Symptom/risk: `loadThread()` still hand-wrote
    `thread_switch_cancelled` and `thread_switch_error` client event payloads
    while first-paint/cached-current telemetry and load-failure diagnostics had
    already moved to helpers. This left thread-switch event field ownership
    split across app orchestration and render-plan helpers.
  - Failing layer: frontend thread-detail switch client-event payload
    ownership, not API reads, projection cache, merge policy, DOM rendering,
    scroll policy, task-card routing, Home AI intake, or shell/cache.
  - Violated invariant: `public/app.js` should own abort/stale/error branch
    decisions and execute the real `postClientEvent()` side effect, while pure
    helpers own bounded client-event payload shape.
- Changes:
  - `public/thread-detail-render-plan.js` now exports
    `planThreadDetailSwitchCancelledClientEvent()` and
    `planThreadDetailSwitchErrorClientEvent()`.
  - `public/app.js` adds `applyThreadDetailSwitchClientEventPlan()` and uses it
    for API abort/stale cancellation, API error, and post-response stale
    cancellation in `loadThread()`.
  - Updated `test/thread-detail-render-plan.test.js`,
    `test/conversation-render.test.js`, and `test/mobile-viewport.test.js`.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
- Validation:
  - Focused:
    `node --test test/thread-detail-render-plan.test.js test/conversation-render.test.js test/mobile-viewport.test.js test/thread-diagnostic-events.test.js`
    passed (`201` tests).
  - Syntax:
    `node --check public/thread-detail-render-plan.js && node --check public/app.js && node --check test/thread-detail-render-plan.test.js && node --check test/conversation-render.test.js && node --check test/mobile-viewport.test.js`
    passed.
- Deployment:
  - Not deployed. No runtime restart, `CLIENT_BUILD_ID`, or PWA shell cache
    bump. This remains a local Phase A ownership slice to batch with the next
    module validation/deploy.
- Next:
  - Run full validation, commit locally, then continue Phase A with remaining
    `loadThread()` loading-shell/start side-effect ownership or switch to
    Phase B cold-path readback if large-session load time becomes immediate
    priority.
- Privacy:
  - Only bounded file paths, helper names, event names, and test counts are
    recorded. No secrets, cookies, launch tokens, private thread bodies,
    task-card bodies, upload bytes, private paths, provider payloads, prompts,
    or long logs are included.

## 2026-06-27 - Phase A cached-current post-merge plan reuse local slice

- Latest local slice:
  - Continued Phase A/B render/patch ownership after `a935d3f`
    (`reuse detail post merge plan for first paint`).
  - The previous first-paint/full-backfill post-merge slice was fully validated
    and committed as `a935d3f`; it was not deployed by design.
  - This slice is local/private only and is not deployed by design.
- Root-cause boundary:
  - Symptom/risk: ordinary refresh, API first-paint, and full-backfill detail
    paths already shared `planThreadDetailRefreshPostMergeEffects()`, but the
    cached-current `loadThread()` short path still hand-wrote thread-list merge
    and thread-list render side effects. That left one more detail-open path
    with separate post-merge ordering, increasing future duplicate/missing
    row, stale status, or flicker risk.
  - Failing layer: frontend thread-detail cached-current post-merge ownership,
    not cache-reuse eligibility, server projection, thread detail API reads,
    DOM patching, Composer behavior, Home AI diagnostics, task-card routing, or
    shell/cache.
  - Violated invariant: cached-current detail reuse should share the same
    declarative post-merge side-effect plan for thread-list merge/render while
    `public/app.js` only executes real DOM/state side effects.
- Changes:
  - `public/app.js` cached-current branch now creates the same post-merge plan
    and applies its `merge` and `thread-list-render` groups.
  - The branch preserves existing follow-to-bottom, conversation render,
    auto-backfill, tile-pane-specific Composer refresh, menu close, projection
    consistency, cached first-paint telemetry, and load-success diagnostic
    behavior.
  - `test/conversation-render.test.js` and `test/mobile-viewport.test.js` now
    guard that cached-current uses the post-merge plan and does not re-inline
    the old `mergeThreadIntoThreadList()` / `renderThreads()` sequence.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
- Validation:
  - Focused:
    `node --test test/conversation-render.test.js test/mobile-viewport.test.js test/thread-detail-render-plan.test.js test/thread-detail-refresh-dom-harness.test.js`
    passed (`180` tests).
  - Syntax:
    `node --check public/app.js` passed.
  - Standard:
    `npm run check`, `npm test` (`1145` tests), and `npm run check:macos`
    passed.
- Deployment:
  - Not deployed. No runtime restart, `CLIENT_BUILD_ID`, or PWA shell cache
    bump. This is a local Phase A/B ownership slice to batch with the next
    module validation/deploy.
- Next:
  - Run `git diff --check`, commit locally, then continue Phase A by moving the
    next remaining `loadThread()` post-render side-effect cluster or Phase B
    readback cold-path evidence into a testable plan.
- Privacy:
  - Only bounded file paths, helper names, effect group names, and test counts
    are recorded. No secrets, cookies, launch tokens, private thread bodies,
    task-card bodies, upload bytes, private paths, provider payloads, prompts,
    or long logs are included.

## 2026-06-27 - Phase B readback baseline reason routing local slice

- Latest local slice:
  - Continued Phase B cold-path readback attribution after `5896364`
    (`attribute thread list baseline cold work`).
  - The previous thread-list baseline attribution slice was fully validated and
    committed as `5896364`; it was not deployed by design.
  - This slice is local/private only and is not deployed by design.
- Root-cause boundary:
  - Symptom/risk: `thread-list-cold-path-diagnosis-service` can now emit
    `final-filter-empty`, `final-filter`, `merge-dedupe`, and `limit-drop`
    cold-path reasons, but Phase B readback decision still routed unresolved
    fallback-baseline work to one generic `optimize-thread-list-fallback-baseline`
    next action.
  - Failing layer: bounded Phase B readback root-cause decision routing, not
    thread-list data construction, cache key policy, source collection,
    merge/filter/limit semantics, UI rendering, server projection, task-card
    routing, Home AI diagnostic intake, or shell/cache.
  - Violated invariant: Phase B readback should preserve existing bounded
    evidence through to the next actionable owner instead of re-flattening
    specific cold-path reasons into a generic bucket.
- Changes:
  - `adapters/phase-b-readback-decision-service.js` now routes baseline
    `final-filter-empty` / `final-filter` reasons to
    `thread-list-final-filter` and `optimize-thread-list-final-filter`.
  - Baseline `merge-dedupe` routes to `thread-list-fallback-merge` and
    `optimize-thread-list-fallback-merge`.
  - Baseline `limit-drop` routes to `thread-list-limit-window` and
    `review-thread-list-limit-window`.
  - One-time cold rebuilds with a successful same-key warm check remain H3
    observe; the change applies only to unresolved cold-path work.
  - Deferred fallback follow-up reads that expose fallback-baseline reason
    details now use the same specific routing.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
- Validation:
  - Focused:
    `node --test test/phase-b-readback-decision-service.test.js test/phase-b-readback-smoke.test.js test/thread-list-cold-path-diagnosis-service.test.js`
    passed (`24` tests).
  - Syntax:
    `node --check adapters/phase-b-readback-decision-service.js` passed.
- Deployment:
  - Not deployed. No runtime restart, `CLIENT_BUILD_ID`, or PWA shell cache bump.
    This is a Phase B readback decision label-routing slice to batch with the
    next Phase B module validation/deploy.
- Next:
  - Run full validation, commit locally, then continue Phase B with runtime
    readback evidence or move to Phase A current-thread render authority.
- Privacy:
  - Only bounded reason labels, owner labels, next-action labels, and test
    counts are recorded. No secrets, cookies, launch tokens, private thread
    bodies, task-card bodies, upload bytes, private paths, provider payloads,
    prompts, or long logs are included.

## 2026-06-27 - Phase B readback evidence counter local slice

- Latest local slice:
  - Continued Phase B readback evidence after `05db144`
    (`route phase b baseline readback reasons`).
  - The previous baseline reason routing slice was fully validated and
    committed as `05db144`; it was not deployed by design.
  - This slice is local/private only and is not deployed by design.
- Root-cause boundary:
  - Symptom/risk: Phase B readback decision could now route
    `final-filter`, `merge-dedupe`, and `limit-drop` reasons to specific
    next actions, but `decision.evidence` did not carry the bounded counters
    needed to prove why that label was selected.
  - Failing layer: bounded Phase B readback evidence packaging, not
    thread-list data construction, cache behavior, source collection,
    merge/filter/limit semantics, UI rendering, server projection, Home AI
    diagnostic intake, task-card routing, or shell/cache.
  - Violated invariant: root-cause readback should preserve the metadata-safe
    numeric counters that support the selected owner/nextAction, so later
    closure can replay evidence without reading private logs.
- Changes:
  - `adapters/phase-b-readback-decision-service.js` now uses a shared
    `boundedCount()` for numeric evidence fields.
  - `decision.evidence` now includes bounded final-filter input/output counts,
    merge input/output/duplicate counts, and limit-drop count for both the
    first thread-list read and deferred follow-up read.
  - `test/phase-b-readback-decision-service.test.js` verifies the counters,
    deferred follow-up counter evidence, and count bounding.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
- Validation:
  - Focused:
    `node --test test/phase-b-readback-decision-service.test.js test/phase-b-readback-smoke.test.js test/thread-list-cold-path-diagnosis-service.test.js`
    passed (`24` tests).
  - Syntax:
    `node --check adapters/phase-b-readback-decision-service.js` passed.
- Deployment:
  - Not deployed. No runtime restart, `CLIENT_BUILD_ID`, or PWA shell cache bump.
    This is a Phase B readback evidence slice to batch with the next Phase B
    module validation/deploy.
- Next:
  - Run full validation, commit locally, then continue Phase B with runtime
    readback evidence or switch to Phase A render/patch ownership if user
    prioritizes projection mismatch.
- Privacy:
  - Only bounded numeric counters, reason labels, owner labels, next-action
    labels, and test counts are recorded. No secrets, cookies, launch tokens,
    private thread bodies, task-card bodies, upload bytes, private paths,
    provider payloads, prompts, or long logs are included.

## 2026-06-27 - Phase A/B detail post-merge plan reuse local slice

- Latest local slice:
  - Continued Phase A/B render/patch ownership after `2f434e5`
    (`carry phase b readback evidence counters`).
  - The previous Phase B readback evidence slice was fully validated and
    committed as `2f434e5`; it was not deployed by design.
  - This slice is local/private only and is not deployed by design.
- Root-cause boundary:
  - Symptom/risk: `refreshCurrentThread()` already used
    `planThreadDetailRefreshPostMergeEffects()` for thread-list merge,
    Composer/active-turn sync, and thread-list render ordering, but first-paint
    `loadThread()` and `backfillFullThreadDetail()` still hand-wrote the same
    post-merge sequence. Keeping three detail paths with separate side-effect
    ordering increases the chance of future first-paint/refresh/backfill drift,
    duplicate rows, missing rows, or stale running state.
  - Failing layer: frontend thread-detail post-merge side-effect ownership at
    the Phase A/B boundary, not first-paint/full-backfill API reads, server
    projection, current-thread merge policy, DOM patching, scroll behavior,
    Home AI diagnostic transport, task-card routing, or shell/cache.
  - Violated invariant: first-paint detail load, detail refresh, and
    full-backfill should share the same declarative post-merge plan for fixed
    side-effect ordering while `app.js` only executes real DOM/state/timer side
    effects.
- Changes:
  - `public/app.js` `loadThread()` first-paint API success now keeps the
    existing detail-loaded marker, render-evidence write,
    pending-server-request sync, `mergeThreadPreservingVisibleItems()`,
    localStorage, draft restore, follow-to-bottom, and EventSource connection
    order.
  - `public/app.js` `backfillFullThreadDetail()` now keeps the existing
    detail-loaded marker, render-evidence write, pending-server-request sync,
    and `mergeThreadPreservingVisibleItems()` order.
  - The post-merge thread-list merge, Composer/active-turn sync, and thread-list
    render now execute through `planThreadDetailRefreshPostMergeEffects()`.
  - Existing timing boundaries for `mergeMs`, `composerRenderMs`, and
    `threadListRenderMs` are preserved.
  - `test/conversation-render.test.js` and `test/mobile-viewport.test.js`
    assert that first paint and full backfill use the same post-merge plan and
    do not re-inline the old order.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
- Validation:
  - Focused:
    `node --test test/conversation-render.test.js test/mobile-viewport.test.js test/thread-detail-render-plan.test.js test/thread-detail-refresh-dom-harness.test.js`
    passed (`180` tests).
  - Syntax:
    `node --check public/app.js` passed.
- Deployment:
  - Not deployed. No runtime restart, `CLIENT_BUILD_ID`, or PWA shell cache bump.
    This is a local Phase A/B ownership slice to batch with the next module
    validation/deploy.
- Next:
  - Run full validation, commit locally, then continue Phase A with remaining
    first-paint/full-backfill effect planning or return to Phase B runtime
    readback evidence.
- Privacy:
  - Only bounded file paths, helper names, effect names, and test counts are
    recorded. No secrets, cookies, launch tokens, private thread bodies,
    task-card bodies, upload bytes, private paths, provider payloads, prompts,
    or long logs are included.

## 2026-06-27 - Latest tail marker: Phase A full-backfill post-render and telemetry slice

- Current local state:
  - Working slice continues Phase A ownership cleanup after `b306f5d`.
  - `public/thread-detail-render-plan.js` now owns full-backfill post-render
    side-effect ordering and full-ready telemetry ordering through
    `planThreadDetailFullBackfillPostRenderEffects()` and
    `planThreadDetailFullBackfillTelemetryEffects()`.
  - `public/app.js` now uses the shared `applyThreadDetailPostRenderEffectsPlan()`
    executor for first-paint and full-backfill post-render effects.
  - This is local/private only and is not deployed by design.
- Validation so far:
  - Focused:
    `node --test test/thread-detail-render-plan.test.js test/conversation-render.test.js test/mobile-viewport.test.js test/thread-performance-metrics.test.js test/turn-scroll-controls.test.js`
    passed (`207` tests).
  - Syntax:
    `node --check public/thread-detail-render-plan.js && node --check public/app.js && node --check test/thread-detail-render-plan.test.js && node --check test/conversation-render.test.js && node --check test/mobile-viewport.test.js && node --check test/turn-scroll-controls.test.js`
    passed.
  - Full:
    `npm test` passed (`1153` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Next:
  - Commit locally, then continue Phase A or batch the accumulated module for
    one deploy/readback when requested.

## 2026-06-27 - Phase A full-backfill post-render and telemetry plan local slice

- Latest local slice:
  - Continued Phase A `backfillFullThreadDetail()` ownership reduction after
    `b306f5d` (`plan thread switch start event`).
  - The previous switch-start slice was fully validated and committed; it was
    not deployed by design.
  - This slice is local/private only and is not deployed by design.
- Root-cause boundary:
  - Symptom/risk: full-backfill already reused the shared post-merge plan, but
    still hand-wrote post-render side effects and `thread_detail_full_ready`
    telemetry/diagnostic calls inline. That kept one more thread-detail render
    path with its own fixed ordering in `public/app.js`.
  - Failing layer: frontend full-backfill post-render/telemetry ordering, not
    server projection, read strategy, merge policy, DOM patch choice, Home AI
    diagnostic intake, task-card routing, shell/cache, or deployment.
  - Violated invariant: fixed full-backfill side-effect order should be
    declared by pure plans while `public/app.js` only executes real runtime
    side effects and supplies live timing/thread inputs.
- Changes:
  - `public/thread-detail-render-plan.js` now exports
    `planThreadDetailFullBackfillPostRenderEffects()`.
  - `public/thread-detail-render-plan.js` now exports
    `planThreadDetailFullBackfillTelemetryEffects()`.
  - `backfillFullThreadDetail()` now applies the post-render plan through the
    shared post-render executor and applies full-ready telemetry through the
    existing refresh telemetry executor.
  - `test/thread-detail-render-plan.test.js` covers full-backfill post-render
    and telemetry plan order.
  - `test/conversation-render.test.js` and `test/mobile-viewport.test.js`
    guard the app wiring and prevent direct inline post-render /
    `thread_detail_full_ready` telemetry calls from returning.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
- Validation:
  - Focused:
    `node --test test/thread-detail-render-plan.test.js test/conversation-render.test.js test/mobile-viewport.test.js test/thread-performance-metrics.test.js test/turn-scroll-controls.test.js`
    passed (`207` tests).
  - Syntax:
    `node --check public/thread-detail-render-plan.js && node --check public/app.js && node --check test/thread-detail-render-plan.test.js && node --check test/conversation-render.test.js && node --check test/mobile-viewport.test.js && node --check test/turn-scroll-controls.test.js`
    passed.
  - Full:
    `npm test` passed (`1153` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment:
  - Not deployed. No runtime restart, `CLIENT_BUILD_ID`, or PWA shell cache
    bump. This remains a local Phase A ownership slice to batch with the next
    module validation/deploy.
- Progress estimate:
  - Overall architecture optimization is about `68%` after this slice's focused
    validation; Phase A is about `78%`.
- Next:
  - Run full validation, commit locally, then continue Phase A with remaining
    current-thread render authority or prepare the accumulated Phase A module
    for a single deploy/readback when requested.
- Privacy:
  - Only bounded file paths, helper names, effect names, event names, and test
    counts are recorded. No secrets, cookies, launch tokens, private thread
    bodies, task-card bodies, upload bytes, private paths, provider payloads,
    prompts, or long logs are included.

## 2026-06-27 - Phase A thread-detail switch start client event plan local slice

- Latest local slice:
  - Continued Phase A `loadThread()` event ownership after `0dbef62`
    (`plan thread switch client events`).
  - The previous switch client-event slice moved cancel/error payloads into
    `public/thread-detail-render-plan.js`; this slice moves `thread_switch_start`
    into the same plan boundary.
  - This slice is local/private only and is not deployed by design.
- Root-cause boundary:
  - Symptom/risk: `loadThread()` still hand-built the `thread_switch_start`
    payload while cancel/error and first-paint telemetry were already planned
    by helpers. That left one more thread-open client-event schema in the large
    frontend orchestrator.
  - Failing layer: frontend thread-detail switch event payload ownership, not
    server projection, detail read mode, DOM patch selection, Home AI diagnostic
    intake, task-card routing, shell/cache, or deployment.
  - Violated invariant: thread switch client-event payload fields should be
    selected by a pure plan while `public/app.js` only executes the real
    `postClientEvent()` side effect.
- Changes:
  - `public/thread-detail-render-plan.js` now exports
    `planThreadDetailSwitchStartClientEvent()`.
  - The start plan normalizes source/from/to ids, booleans, and bounded
    `listAgeMs` while preserving the prior missing-value behavior as `null`.
  - `public/app.js` applies the start plan through the existing
    `applyThreadDetailSwitchClientEventPlan()` executor.
  - `test/thread-detail-render-plan.test.js`, `test/conversation-render.test.js`,
    and `test/mobile-viewport.test.js` now cover start/cancel/error ownership
    and prevent direct `postClientEvent("thread_switch_start")` from returning
    to `loadThread()`.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
- Validation:
  - Focused:
    `node --test test/thread-detail-render-plan.test.js test/conversation-render.test.js test/mobile-viewport.test.js test/thread-diagnostic-events.test.js`
    passed (`201` tests).
  - Syntax:
    `node --check public/thread-detail-render-plan.js && node --check public/app.js && node --check test/thread-detail-render-plan.test.js && node --check test/conversation-render.test.js && node --check test/mobile-viewport.test.js`
    passed.
  - Full:
    `npm test` passed (`1152` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment:
  - Not deployed. No runtime restart, `CLIENT_BUILD_ID`, or PWA shell cache
    bump. This remains a local Phase A ownership slice to batch with the next
    module validation/deploy.
- Progress estimate:
  - Overall architecture optimization is about `67%` after this slice's focused
    validation; Phase A is about `77%`. Exact number depends on whether the
    next step remains Phase A render authority or pivots to Phase B cold path.
- Next:
  - Run full validation, commit locally, then continue Phase A with remaining
    current-thread render authority, or batch this with the current Phase A
    module for one deploy/readback when requested.
- Privacy:
  - Only bounded file paths, helper names, event names, and test counts are
    recorded. No secrets, cookies, launch tokens, private thread bodies,
    task-card bodies, upload bytes, private paths, provider payloads, prompts,
    or long logs are included.

## 2026-06-27 - Phase A thread-detail load failure diagnostic payload local slice

- Latest local slice:
  - Continued Phase A/B diagnostic ownership after `b2b933f`
    (`plan cached current telemetry effects`).
  - This slice is local/private only and is not deployed by design.
- Root-cause boundary:
  - Symptom/risk: `loadThread()` initial API failure path still hand-wrote the
    full Home AI `thread_detail_load_failed` diagnostic payload in
    `public/app.js`, while refresh failure payloads already lived in
    `public/thread-diagnostic-events.js`. This left session-load diagnostic
    payload ownership split across app orchestration and diagnostic helpers.
  - Failing layer: frontend thread-detail load failure diagnostic payload
    ownership, not API reads, projection cache, merge policy, DOM rendering,
    scroll policy, task-card routing, Home AI intake, or shell/cache.
  - Violated invariant: `public/app.js` should collect runtime error facts and
    execute side effects, while diagnostic helpers own bounded category/type/
    context/count/breadcrumb payload selection.
- Changes:
  - `public/thread-diagnostic-events.js` now exports
    `threadDetailLoadFailedDiagnosticEvent()`.
  - `public/app.js` `loadThread()` catch branch now calls that helper with
    bounded runtime facts and preserves the existing UI update, client event,
    abort/cancel, and throw behavior.
  - Updated `test/thread-diagnostic-events.test.js`,
    `test/conversation-render.test.js`, and `test/mobile-viewport.test.js`.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
- Validation:
  - Focused:
    `node --test test/thread-diagnostic-events.test.js test/conversation-render.test.js test/mobile-viewport.test.js test/thread-detail-render-plan.test.js`
    passed (`199` tests).
  - Syntax:
    `node --check public/thread-diagnostic-events.js && node --check public/app.js && node --check test/thread-diagnostic-events.test.js && node --check test/conversation-render.test.js && node --check test/mobile-viewport.test.js`
    passed.
- Deployment:
  - Not deployed. No runtime restart, `CLIENT_BUILD_ID`, or PWA shell cache
    bump. This remains a local Phase A/B ownership slice to batch with the next
    module validation/deploy.
- Next:
  - Run full validation, commit locally, then continue Phase A with remaining
    `loadThread()` switch-cancel/error client event planning or switch to
    Phase B cold-path readback if large-session load time becomes immediate
    priority.
- Privacy:
  - Only bounded file paths, helper names, diagnostic type labels, and test
    counts are recorded. No secrets, cookies, launch tokens, private thread
    bodies, task-card bodies, upload bytes, private paths, provider payloads,
    prompts, or long logs are included.

## 2026-06-27 - Phase A cached-current telemetry plan reuse local slice

- Latest local slice:
  - Continued Phase A render/telemetry ownership after `87d7681`
    (`plan first paint telemetry effects`).
  - This slice is local/private only and is not deployed by design.
- Root-cause boundary:
  - Symptom/risk: `loadThread()` cached-current reuse still hand-wrote the
    fixed telemetry/reporting sequence for `thread_detail_first_paint`,
    `thread_switch_cached`, and Home AI load-success diagnostic clear. Keeping
    this sequence inline leaves cached-current first-paint evidence separate
    from the now-planned API first-paint telemetry path.
  - Failing layer: frontend cached-current telemetry side-effect ownership,
    not API reads, projection cache, merge policy, DOM patch choice, scroll
    policy, task-card routing, Home AI diagnostic intake, or shell/cache.
  - Violated invariant: cached-current telemetry ordering should be declared by
    a pure plan while `public/app.js` only executes real runtime reporting side
    effects. The cached-current legacy shape must remain distinct from API
    first-paint: no extra response-diagnostic effect is added.
- Changes:
  - `public/thread-detail-render-plan.js` now exports
    `planThreadDetailCachedCurrentTelemetryEffects()`.
  - The plan declares ordered effects for `thread_detail_first_paint`,
    `thread_switch_cached`, and load-success diagnostic clearing.
  - `public/app.js` cached-current branch now applies that plan through the
    existing telemetry effect executor while preserving the existing
    performance payload and bounded diagnostic fields.
  - Updated `test/thread-detail-render-plan.test.js`,
    `test/conversation-render.test.js`, and `test/mobile-viewport.test.js`.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
- Validation:
  - Focused:
    `node --test test/thread-detail-render-plan.test.js test/conversation-render.test.js test/mobile-viewport.test.js test/turn-scroll-controls.test.js test/thread-detail-refresh-dom-harness.test.js`
    passed (`189` tests).
  - Syntax:
    `node --check public/thread-detail-render-plan.js && node --check public/app.js && node --check test/conversation-render.test.js && node --check test/mobile-viewport.test.js && node --check test/thread-detail-render-plan.test.js`
    passed.
- Deployment:
  - Not deployed. No runtime restart, `CLIENT_BUILD_ID`, or PWA shell cache
    bump. This remains a local Phase A ownership slice to batch with the next
    module validation/deploy.
- Next:
  - Run full validation, commit locally, then continue Phase A with remaining
    `loadThread()` cancellation/error/success event ownership or switch to
    Phase B cold-path readback if large-session load time becomes immediate
    priority.
- Privacy:
  - Only bounded file paths, helper names, effect names, and test counts are
    recorded. No secrets, cookies, launch tokens, private thread bodies,
    task-card bodies, upload bytes, private paths, provider payloads, prompts,
    or long logs are included.

## 2026-06-27 - Phase A first-paint telemetry plan reuse local slice

- Latest local slice:
  - Continued Phase A render/telemetry ownership after `f6b8ff8`
    (`plan first paint post render effects`).
  - This slice is local/private only and is not deployed by design.
- Root-cause boundary:
  - Symptom/risk: `loadThread()` successful first-paint still hand-wrote the
    fixed telemetry/reporting sequence after first render:
    `thread_detail_first_paint`, thread-detail response diagnostics,
    `thread_switch_complete`, and Home AI load-success diagnostic clear.
    Keeping this sequence inline leaves first-paint evidence ordering separate
    from refresh/backfill planning and makes future projection/render
    regression diagnosis harder to reason about.
  - Failing layer: frontend first-paint telemetry side-effect ownership, not
    API reads, projection cache, merge policy, DOM patch choice, scroll policy,
    task-card routing, Home AI diagnostic intake, or shell/cache.
  - Violated invariant: first-paint telemetry ordering should be declared by a
    pure plan while `public/app.js` only executes real runtime reporting side
    effects and supplies runtime-only thread context.
- Changes:
  - `public/thread-detail-render-plan.js` now exports
    `planThreadDetailFirstPaintTelemetryEffects()`.
  - The plan declares ordered effects for `thread_detail_first_paint`,
    thread-detail response diagnostics, `thread_switch_complete`, and
    load-success diagnostic clearing.
  - `public/app.js` now applies that plan through
    `applyThreadDetailFirstPaintTelemetryEffectsPlan()` while preserving the
    existing performance payload and bounded diagnostic fields.
  - Updated `test/thread-detail-render-plan.test.js`,
    `test/conversation-render.test.js`, `test/mobile-viewport.test.js`, and
    `test/turn-scroll-controls.test.js`.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
- Validation:
  - Focused:
    `node --test test/thread-detail-render-plan.test.js test/conversation-render.test.js test/mobile-viewport.test.js test/turn-scroll-controls.test.js test/thread-detail-refresh-dom-harness.test.js`
    passed (`188` tests).
  - Syntax:
    `node --check public/thread-detail-render-plan.js && node --check public/app.js`
    passed.
  - Full:
    `npm run check`, `npm test` (`1147` tests), `npm run check:macos`, and
    `git diff --check` passed.
- Deployment:
  - Not deployed. No runtime restart, `CLIENT_BUILD_ID`, or PWA shell cache
    bump. This remains a local Phase A ownership slice to batch with the next
    module validation/deploy.
- Next:
  - Overall architecture optimization is about 63% after commit. Phase A is
    about 73%, Phase B about 49%, Phase C about 81%, Phase D about 55%, and
    Phase E about 15%.
  - Continue Phase A by extracting the remaining cached-current telemetry /
    diagnostic success cluster, or switch to Phase B cold-path readback if
    large-session load time becomes the immediate priority.
- Privacy:
  - Only bounded file paths, helper names, effect names, and test counts are
    recorded. No secrets, cookies, launch tokens, private thread bodies,
    task-card bodies, upload bytes, private paths, provider payloads, prompts,
    or long logs are included.

## 2026-06-27 - Phase B thread-list baseline work attribution local slice

- Latest local slice:
  - Continued Phase B cold-path evidence after `85070dd`
    (`plan thread detail response diagnostic effects`).
  - The prior Phase A/B response-diagnostic slice was fully validated and
    committed as `85070dd`; it was not deployed by design.
  - This slice is local/private only and is not deployed by design.
- Root-cause boundary:
  - Symptom/risk: thread-list cold rebuild readback could still report a
    generic `miss-rebuild:baseline` when source reader timing/counts were not
    dominant, making it harder to decide whether the remaining cost was final
    filtering, duplicate merge work, or limit truncation.
  - Failing layer: bounded Phase B cold-path diagnosis/readback attribution,
    not fallback source collection, cache key policy, app-server thread list,
    UI rendering, server projection, task-card routing, or shell/cache.
  - Violated invariant: Phase B readback should identify the next root-cause
    owner from existing bounded counters before changing cache or source
    behavior.
- Changes:
  - `adapters/thread-list-cold-path-diagnosis-service.js` now uses existing
    `fallbackBaselineFinalFilter*`, `fallbackBaselineMerge*`, and
    `fallbackBaselineLimitDropCount` counters when no dominant state-db /
    rollout / session-index source is present.
  - New bounded reasons are `final-filter-empty`, `final-filter`,
    `merge-dedupe`, and `limit-drop`, all prefixed by the existing rebuild
    reason such as `miss-rebuild`.
  - Dominant source attribution still wins when state DB, rollout, or
    session-index timing/count evidence is present.
  - `test/thread-list-cold-path-diagnosis-service.test.js` covers final
    filter, merge dedupe, and limit drop attribution.
  - Updated `README.md` and `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`.
- Validation:
  - Focused:
    `node --test test/thread-list-cold-path-diagnosis-service.test.js test/phase-b-readback-decision-service.test.js test/phase-b-readback-smoke.test.js test/thread-visibility.test.js`
    passed (`69` tests).
  - Syntax:
    `node --check adapters/thread-list-cold-path-diagnosis-service.js` passed.
- Deployment:
  - Not deployed. No runtime restart, `CLIENT_BUILD_ID`, or PWA shell cache bump.
    This is a server-side diagnosis label slice to batch with the next Phase B
    module validation/deploy.
- Next:
  - Run full validation, commit locally, then continue Phase B with readback
    evidence or return to Phase A current-thread render authority.
- Privacy:
  - Only bounded reason labels and numeric counters are recorded. No secrets,
    cookies, launch tokens, private thread bodies, task-card bodies, upload
    bytes, private paths, provider payloads, prompts, or long logs are included.

## 2026-06-27 - Phase A/B thread-detail response diagnostic effects local slice

- Latest local slice:
  - Continued Phase A/B diagnostic outcome ownership after `302b5b4`
    (`plan projection consistency diagnostic effects`).
  - The previous projection-consistency slice was fully validated and committed
    as `302b5b4`; it was not deployed by design.
  - This slice is local/private only and is not deployed by design.
- Root-cause boundary:
  - Symptom/risk: large-session or active-detail incidents need precise slow
    path and response-contract diagnostics, but `public/app.js` still owned the
    `slowPlan.shouldReport` / `contractPlan.shouldReport` failure-vs-success
    branches.
  - Failing layer: frontend diagnostic outcome planning at the Phase A/B
    boundary, not Home AI intake, performance fact extraction, server
    projection, DOM rendering, CSS, task-card routing, or shell/cache.
  - Violated invariant: performance helpers should produce bounded facts,
    diagnostic helpers should classify effects/payloads, and `public/app.js`
    should only collect live runtime input and execute Home AI reporting side
    effects.
- Changes:
  - `public/thread-diagnostic-events.js` now exposes
    `threadDetailResponseDiagnosticEffects()`.
  - The helper converts slow-path and response-contract plans into bounded
    failure/success effects for `thread_detail_slow_path` and
    `thread_detail_response_contract_mismatch`.
  - `public/app.js` `recordThreadDetailResponseDiagnostics()` still builds
    `slowPlan` and `contractPlan` from `threadPerformanceMetrics`, but now asks
    the diagnostic helper for effects and only executes
    `recordHomeAiDiagnosticFailure()` / `recordHomeAiDiagnosticSuccess()`.
  - `test/thread-diagnostic-events.test.js` covers slow failure, contract
    success, healthy slow/contract success, no-plan behavior, and privacy.
  - `test/conversation-render.test.js` and `test/mobile-viewport.test.js`
    guard the app wiring so direct `shouldReport` branches and direct payload
    builder calls do not return.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
- Validation:
  - Focused:
    `node --test test/thread-diagnostic-events.test.js test/conversation-render.test.js test/mobile-viewport.test.js test/thread-performance-metrics.test.js`
    passed (`154` tests).
  - Syntax:
    `node --check public/thread-diagnostic-events.js && node --check public/app.js`
    passed.
- Deployment:
  - Not deployed. No `CLIENT_BUILD_ID` / PWA shell cache bump. This is a
    Phase A/B diagnostic ownership slice to batch with the next projection,
    render, or cold-path module before one deploy/readback.
- Next:
  - Run full validation, commit locally, then either continue Phase A with the
    remaining `recordThreadDetailResponseDiagnostics()` adjacent side-effect
    reducers / current-thread render authority, or pivot to Phase B cold-path
    readback attribution if user prioritizes large-session load time.
- Privacy:
  - Only bounded file paths, helper names, diagnostic type labels, and test
    counts are recorded. No secrets, cookies, launch tokens, private thread
    bodies, task-card bodies, upload bytes, private paths, provider payloads,
    prompts, or long logs are included.

## 2026-06-27 - Phase A first-paint post-render plan reuse local slice

- Latest local slice:
  - Continued Phase A render/patch ownership after `5db2d87`
    (`reuse detail post merge plan for cached current`).
  - The previous cached-current post-merge slice was fully validated and
    committed as `5db2d87`; it was not deployed by design.
  - This slice is local/private only and is not deployed by design.
- Root-cause boundary:
  - Symptom/risk: `loadThread()` successful first-paint still hand-wrote a
    fixed post-render side-effect sequence after conversation render:
    plugin-navigation publish, connection restore, delayed live poll,
    Composer-control refresh, overlay-menu close, optional full-detail
    backfill, and Usage backfill. Keeping that sequence inline leaves more
    thread-open ordering rules in `public/app.js`.
  - Failing layer: frontend first-paint post-render side-effect ownership, not
    API reads, projection cache, merge policy, DOM patch choice, scroll policy,
    task-card routing, Home AI diagnostic intake, or shell/cache.
  - Violated invariant: first-paint fixed post-render ordering should be
    declared by a pure plan while `public/app.js` only executes real runtime
    side effects and evaluates runtime-only conditions at execution time.
- Changes:
  - `public/thread-detail-render-plan.js` now exports
    `planThreadDetailFirstPaintPostRenderEffects()`.
  - The plan declares ordered effects for plugin navigation publish,
    connection restore, delayed live poll, Composer controls, conditional
    overlay-menu close, conditional full-detail backfill, and Usage backfill.
  - `public/app.js` now applies that plan through
    `applyThreadDetailFirstPaintPostRenderEffectsPlan()` while preserving the
    existing runtime checks for menu-overlay state and
    `shouldBackfillFullThreadDetail()`.
  - Updated `test/thread-detail-render-plan.test.js`,
    `test/conversation-render.test.js`, and `test/mobile-viewport.test.js`.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
- Validation:
  - Focused:
    `node --test test/thread-detail-render-plan.test.js test/conversation-render.test.js test/mobile-viewport.test.js test/thread-detail-refresh-dom-harness.test.js`
    passed (`181` tests).
  - Syntax:
    `node --check public/thread-detail-render-plan.js && node --check public/app.js`
    passed.
- Deployment:
  - Not deployed. No runtime restart, `CLIENT_BUILD_ID`, or PWA shell cache
    bump. This is a local Phase A ownership slice to batch with the next module
    validation/deploy.
- Next:
  - Run full validation, commit locally, then continue Phase A by extracting the
    remaining first-paint telemetry/switch-complete/diagnostic success cluster,
    or switch to Phase B cold-path evidence if large-session load time becomes
    the priority.
- Privacy:
  - Only bounded file paths, helper names, effect names, and test counts are
    recorded. No secrets, cookies, launch tokens, private thread bodies,
    task-card bodies, upload bytes, private paths, provider payloads, prompts,
    or long logs are included.

## 2026-06-27 - Latest tail marker: Phase A full-backfill post-render and telemetry slice

- Current local state:
  - Working slice continues Phase A ownership cleanup after `b306f5d`.
  - `public/thread-detail-render-plan.js` now owns full-backfill post-render
    side-effect ordering and full-ready telemetry ordering through
    `planThreadDetailFullBackfillPostRenderEffects()` and
    `planThreadDetailFullBackfillTelemetryEffects()`.
  - `public/app.js` now uses the shared `applyThreadDetailPostRenderEffectsPlan()`
    executor for first-paint and full-backfill post-render effects.
  - This is local/private only and is not deployed by design.
- Validation so far:
  - Focused:
    `node --test test/thread-detail-render-plan.test.js test/conversation-render.test.js test/mobile-viewport.test.js test/thread-performance-metrics.test.js test/turn-scroll-controls.test.js`
    passed (`207` tests).
  - Syntax:
    `node --check public/thread-detail-render-plan.js && node --check public/app.js && node --check test/thread-detail-render-plan.test.js && node --check test/conversation-render.test.js && node --check test/mobile-viewport.test.js && node --check test/turn-scroll-controls.test.js`
    passed.
  - Full:
    `npm test` passed (`1153` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Next:
  - Committed locally as `1ef7b48` (`plan full backfill post render effects`).
    Continue Phase A or batch the accumulated module for one deploy/readback
    when requested.

## 2026-06-27 - Latest tail marker: Phase A history auto-backfill effects local slice

- Current local state:
  - Continued Phase A ownership cleanup after `1ef7b48`.
  - `maybeAutoBackfillThreadHistory()` already delegated the
    workflow-dominated/recent-window decision to `public/thread-detail-render-plan.js`,
    but still owned the follow-up side-effect sequence inline.
  - This slice moves the fixed auto-backfill follow-up sequence into a pure
    render-plan helper while leaving real state/timer/network side effects in
    `public/app.js`.
- Root-cause boundary:
  - Symptom/risk: recent-window auto-backfill decision, event payload shape,
    backfill-key recording, and older-turn load scheduling were split across
    helper and app code. That kept thread-open history recovery behavior more
    fragile during projection/render refactors.
  - Failing layer: frontend history auto-backfill side-effect ownership, not
    server projection, older-turn API reads, scroll anchoring, task-card
    routing, Home AI diagnostic intake, or shell/cache.
  - Violated invariant: fixed render/detail side-effect ordering and bounded
    event payload selection should be declared by pure planning helpers; app
    code should only execute runtime side effects.
- Changes:
  - `public/thread-detail-render-plan.js` now exports
    `planThreadDetailHistoryAutoBackfillEffects()`.
  - The helper plans ordered effects for remembering the auto-backfill key,
    posting the bounded `thread_history_auto_backfill` client event, and
    scheduling `loadOlderThreadTurns()` with the preserved scroll/source
    semantics.
  - `public/app.js` now applies those effects through
    `applyThreadDetailHistoryAutoBackfillEffectsPlan()`.
  - Updated `test/thread-detail-render-plan.test.js` and
    `test/mobile-viewport.test.js`.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
- Validation so far:
  - Focused:
    `node --test test/thread-detail-render-plan.test.js test/mobile-viewport.test.js test/conversation-render.test.js test/turn-scroll-controls.test.js`
    passed (`191` tests).
  - Syntax:
    `node --check public/thread-detail-render-plan.js && node --check public/app.js && node --check test/thread-detail-render-plan.test.js && node --check test/mobile-viewport.test.js`
    passed.
  - Full:
    `npm test` passed (`1154` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment:
  - Not deployed. No runtime restart, `CLIENT_BUILD_ID`, or PWA shell cache
    bump. This remains a local Phase A ownership slice to batch with the next
    module validation/deploy.
- Progress:
  - Overall architecture optimization is about `70%`.
  - Phase A frontend render/projection ownership is about `80%`.
- Next:
  - Committed locally as `26186f4`
    (`plan history auto backfill effects`). Continue Phase A current-thread
    render authority or batch the accumulated module for one deploy/readback
    when requested.

## 2026-06-27 - Latest tail marker: Phase A cached-current post-render effects local slice

- Current local state:
  - Continued Phase A `loadThread()` ownership cleanup after `26186f4`.
  - Cached-current thread open already reused post-merge and telemetry plans,
    but still owned its fixed post-render sequence inline after
    `renderCurrentThread({ stickToBottom: true })`.
  - This slice moves that cached-current post-render sequence into
    `public/thread-detail-render-plan.js` while preserving the existing cache
    reuse decision, render timing boundaries, and telemetry semantics.
- Root-cause boundary:
  - Symptom/risk: cached-current, API first-paint, and full-backfill thread-open
    paths had uneven post-render ownership. Cached-current still directly
    called history auto-backfill, tile-pane Composer restore, menu close,
    projection consistency, empty-cache healthy clear, and side-chat silent
    load from `public/app.js`.
  - Failing layer: frontend cached-current post-render side-effect ownership,
    not projection cache selection, app-server detail reads, server projection,
    DOM patch selection, task-card routing, Home AI diagnostic intake, or
    shell/cache.
  - Violated invariant: fixed thread-detail post-render side-effect ordering
    should be declared by pure planning helpers; app code should supply live
    runtime booleans and execute the actual side effects.
- Changes:
  - `public/thread-detail-render-plan.js` now exports
    `planThreadDetailCachedCurrentPostRenderEffects()`.
  - The plan declares ordered effects for history auto-backfill, optional
    tile-pane Composer restore, overlay menu close, projection consistency
    check, empty cached-detail healthy clear, and optional side-chat silent
    load.
  - `public/app.js` extends `applyThreadDetailPostRenderEffectsPlan()` to
    execute those effects and calls the cached-current post-render plan from
    `loadThread()`.
  - Updated `test/thread-detail-render-plan.test.js`,
    `test/mobile-viewport.test.js`, and `test/conversation-render.test.js`.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
- Validation so far:
  - Focused:
    `node --test test/thread-detail-render-plan.test.js test/mobile-viewport.test.js test/conversation-render.test.js test/turn-scroll-controls.test.js`
    passed (`192` tests).
  - Syntax:
    `node --check public/thread-detail-render-plan.js && node --check public/app.js && node --check test/thread-detail-render-plan.test.js && node --check test/mobile-viewport.test.js && node --check test/conversation-render.test.js`
    passed.
  - Full:
    `npm test` passed (`1155` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment:
  - Not deployed. No runtime restart, `CLIENT_BUILD_ID`, or PWA shell cache
    bump. This remains a local Phase A ownership slice to batch with the next
    module validation/deploy.
- Progress:
  - Overall architecture optimization is about `71%`.
  - Phase A frontend render/projection ownership is about `81%`.
- Next:
  - Committed locally as `8b492e7`
    (`plan cached current post render effects`). Continue Phase A current-thread
    render authority or batch the accumulated module for one deploy/readback
    when requested.

## 2026-06-27 - Latest tail marker: Phase A first-paint after-render effects local slice

- Current local state:
  - Continued Phase A `loadThread()` ownership cleanup after `8b492e7`.
  - Cached-current history auto-backfill now goes through a post-render plan,
    but API first-paint still directly called
    `maybeAutoBackfillThreadHistory(state.currentThread, { seq, source:
    "first-paint" })` immediately after `renderCurrentThread()`.
  - This slice moves that first-paint after-render auto-backfill into
    `public/thread-detail-render-plan.js` while preserving the existing
    performance timing boundary.
- Root-cause boundary:
  - Symptom/risk: thread-open history auto-backfill effect ownership was still
    inconsistent across cached-current and API first-paint paths.
  - Failing layer: frontend first-paint after-render side-effect ownership, not
    projection cache selection, app-server detail reads, server projection,
    DOM patch selection, scroll anchoring, task-card routing, Home AI
    diagnostic intake, or shell/cache.
  - Violated invariant: fixed thread-detail after-render side-effect ordering
    should be declared by pure planning helpers; app code should execute the
    real side effects and preserve timing boundaries explicitly.
- Changes:
  - `public/thread-detail-render-plan.js` now exports
    `planThreadDetailFirstPaintAfterRenderEffects()`.
  - The plan declares the first-paint `history-auto-backfill` effect and bounds
    `seq` / `source`.
  - `public/app.js` now applies that plan immediately after first-paint
    `renderCurrentThread({ stickToBottom: true })` and before
    `postRenderStartedAt`, preserving the previous `postRenderMs` timing
    scope.
  - Updated `test/thread-detail-render-plan.test.js` and
    `test/mobile-viewport.test.js`.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
- Validation so far:
  - Focused:
    `node --test test/thread-detail-render-plan.test.js test/mobile-viewport.test.js test/conversation-render.test.js test/turn-scroll-controls.test.js`
    passed (`193` tests).
  - Syntax:
    `node --check public/thread-detail-render-plan.js && node --check public/app.js && node --check test/thread-detail-render-plan.test.js && node --check test/mobile-viewport.test.js`
    passed.
  - Full:
    `npm test` passed (`1156` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment:
  - Not deployed. No runtime restart, `CLIENT_BUILD_ID`, or PWA shell cache
    bump. This remains a local Phase A ownership slice to batch with the next
    module validation/deploy.
- Progress:
  - Overall architecture optimization is about `72%`.
  - Phase A frontend render/projection ownership is about `82%`.
- Next:
  - Committed locally as `48e543c`
    (`plan first paint after render effects`). Continue Phase A current-thread
    render authority or batch the accumulated module for one deploy/readback
    when requested.

## 2026-06-27 - Latest tail marker: Phase A first-paint post-timing effects local slice

- Current local state:
  - Continued Phase A `loadThread()` ownership cleanup after `48e543c`.
  - API first-paint auto-backfill now goes through an after-render plan, but
    `loadThread()` still directly called
    `checkConversationProjectionConsistency("first-paint", { renderMode:
    "first-paint" })` after measuring `postRenderMs`.
  - This slice moves that post-render-timing consistency check into
    `public/thread-detail-render-plan.js` while preserving the existing
    timing boundary.
- Root-cause boundary:
  - Symptom/risk: first-paint render completion still had a fixed projection
    consistency side effect directly embedded in `loadThread()`.
  - Failing layer: frontend first-paint post-timing side-effect ownership, not
    projection cache selection, app-server detail reads, server projection,
    DOM patch selection, scroll anchoring, task-card routing, Home AI
    diagnostic intake, or shell/cache.
  - Violated invariant: fixed thread-detail side-effect selection should be
    declared by pure planning helpers; app code should execute the real effect
    and preserve timing boundaries explicitly.
- Changes:
  - `public/thread-detail-render-plan.js` now exports
    `planThreadDetailFirstPaintPostTimingEffects()`.
  - The plan declares the `check-conversation-projection-consistency` effect
    for `phase=first-paint` / `renderMode=first-paint`.
  - `public/app.js` now applies that plan immediately after `postRenderMs` is
    calculated and before `renderElapsedMs`, preserving the previous timing
    scope.
  - Updated `test/thread-detail-render-plan.test.js` and
    `test/mobile-viewport.test.js`.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
- Validation so far:
  - Focused:
    `node --test test/thread-detail-render-plan.test.js test/mobile-viewport.test.js test/conversation-render.test.js test/turn-scroll-controls.test.js`
    passed (`194` tests).
  - Syntax:
    `node --check public/thread-detail-render-plan.js && node --check public/app.js && node --check test/thread-detail-render-plan.test.js && node --check test/mobile-viewport.test.js`
    passed.
  - Full:
    `npm test` passed (`1157` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment:
  - Not deployed. No runtime restart, `CLIENT_BUILD_ID`, or PWA shell cache
    bump. This remains a local Phase A ownership slice to batch with the next
    module validation/deploy.
- Progress:
  - Overall architecture optimization is about `73%`.
  - Phase A frontend render/projection ownership is about `83%`.
- Next:
  - Commit locally, then continue Phase A current-thread render authority or
    batch the accumulated module for one deploy/readback when requested.

## 2026-06-27 - Latest tail marker: Phase A first-paint pre-render effects local slice

- Current local state:
  - Continued Phase A `loadThread()` ownership cleanup after `b34f173`.
  - Loading-shell post-state ordering now goes through a plan, but the API
    first-paint success path still directly owned several fixed local-state
    side effects after merge and before conversation render.
  - This slice moves first-paint pre-render local-state preparation and the
    timed draft restore effect into `public/thread-detail-render-plan.js`.
- Root-cause boundary:
  - Symptom/risk: successful first-paint detail opens still had a hand-written
    localStorage/draft/follow/EventSource/draft-restore sequence inside
    `loadThread()`, separate from the now-planned loading-shell, post-render,
    post-timing, and telemetry sequences.
  - Failing layer: frontend API first-paint pre-render side-effect ownership,
    not projection cache selection, app-server detail reads, server projection,
    DOM patch selection, task-card routing, Home AI diagnostic intake, or
    shell/cache.
  - Violated invariant: fixed thread-detail side-effect ordering should be
    declared by pure planning helpers, while app code executes the real
    localStorage/draft-store/EventSource/DOM effects and preserves timing
    boundaries.
- Changes:
  - `public/thread-detail-render-plan.js` now exports
    `planThreadDetailFirstPaintPreRenderEffects()` and
    `planThreadDetailFirstPaintDraftRestoreEffects()`.
  - The pre-render plan declares persist-current-thread-id,
    clear-draft-target-key, follow-thread-open-to-bottom, and optional
    connect-events when app runtime state says an EventSource exists.
  - The draft-restore plan keeps `restore-draft-for-current-target` in its own
    timed block so `draftRestoreMs` preserves the previous scope.
  - `public/app.js` applies both plans in `loadThread()` after post-merge and
    before Composer/thread-list/conversation render timing.
  - Updated `test/thread-detail-render-plan.test.js`,
    `test/mobile-viewport.test.js`, `test/conversation-render.test.js`, and
    `test/composer-draft.test.js`.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
- Validation so far:
  - Focused:
    `node --test test/thread-detail-render-plan.test.js test/mobile-viewport.test.js test/conversation-render.test.js test/composer-draft.test.js test/turn-scroll-controls.test.js`
    passed (`201` tests).
  - Syntax:
    `node --check public/thread-detail-render-plan.js && node --check public/app.js && node --check test/thread-detail-render-plan.test.js && node --check test/mobile-viewport.test.js && node --check test/conversation-render.test.js && node --check test/composer-draft.test.js`
    passed.
- Deployment:
  - Not deployed yet. No runtime restart, `CLIENT_BUILD_ID`, or PWA shell cache
    bump. This remains a local Phase A ownership slice to batch with the next
    module validation/deploy.
- Progress:
  - Overall architecture optimization is about `75%`.
  - Phase A frontend render/projection ownership is about `85%`.
- Next:
  - Run full validation, commit locally, then continue Phase A current-thread
    render authority or batch the accumulated module for one deploy/readback
    when requested.

## 2026-06-27 - Latest tail marker: Phase A loading-shell post-state effects local slice

- Current local state:
  - Continued Phase A `loadThread()` ownership cleanup after `c9cc156`.
  - `planThreadOpenLoadingShell()` already owned safe loading-shell state
    construction, but `loadThread()` still directly owned the fixed visible
    post-state sequence after assigning `state.currentThread`.
  - This slice moves that loading-shell post-state sequence into
    `public/thread-detail-render-plan.js` while preserving the existing order
    and runtime side effects.
- Root-cause boundary:
  - Symptom/risk: loading-shell open, API first-paint, cached-current, and
    full-backfill thread-detail paths still had uneven fixed side-effect
    ownership. Loading-shell display could regress by changing a direct
    `loadThread()` call sequence without touching a testable plan.
  - Failing layer: frontend loading-shell post-state side-effect ownership,
    not projection cache selection, app-server detail reads, server projection,
    DOM patch selection, task-card routing, Home AI diagnostic intake, or
    shell/cache.
  - Violated invariant: fixed thread-detail visible-open side-effect ordering
    should be declared by pure planning helpers; app code should execute the
    real DOM/state/timer/network effects.
- Changes:
  - `public/thread-detail-render-plan.js` now exports
    `planThreadDetailLoadingShellPostStateEffects()`.
  - The plan declares the ordered effects for follow-to-bottom, draft restore,
    Composer settings, active-turn sync, thread-list render, current-thread
    render, plugin navigation, Composer controls, side-chat silent load,
    connection state, activity marker, and thread-load watchdog startup.
  - `public/app.js` applies that plan after installing the loading shell and
    extends the shared post-render effect executor for those effect types.
  - Updated `test/thread-detail-render-plan.test.js`,
    `test/mobile-viewport.test.js`, `test/conversation-render.test.js`, and
    `test/composer-draft.test.js`.
  - Updated `README.md`, `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md`, and
    `docs/MODULES.md`.
- Validation so far:
  - Focused:
    `node --test test/thread-detail-render-plan.test.js test/mobile-viewport.test.js test/conversation-render.test.js test/turn-scroll-controls.test.js`
    passed (`195` tests).
  - Targeted after composer-draft guard update:
    `node --test test/composer-draft.test.js test/thread-detail-render-plan.test.js test/mobile-viewport.test.js test/conversation-render.test.js`
    passed (`193` tests).
  - Syntax:
    `node --check public/thread-detail-render-plan.js && node --check public/app.js && node --check test/thread-detail-render-plan.test.js && node --check test/mobile-viewport.test.js && node --check test/conversation-render.test.js`
    passed.
  - Full:
    `npm test` passed (`1158` tests).
  - `npm run check`, `npm run check:macos`, and `git diff --check` passed.
- Deployment:
  - Not deployed. No runtime restart, `CLIENT_BUILD_ID`, or PWA shell cache
    bump. This remains a local Phase A ownership slice to batch with the next
    module validation/deploy.
- Progress:
  - Overall architecture optimization is about `74%`.
  - Phase A frontend render/projection ownership is about `84%`.
- Next:
  - Commit locally, then continue Phase A current-thread render authority or
    batch the accumulated module for one deploy/readback when requested.
