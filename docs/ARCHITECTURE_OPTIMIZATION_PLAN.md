# Codex Mobile Architecture Optimization Plan

This document records the current diagnostic findings and the staged
architecture direction for Codex Mobile Web. It is intentionally local to this
plugin: platform-wide diagnostic intake belongs in Home AI, while this
workspace owns Codex Mobile state, projection, rendering, and task-card
behavior.

## Current Diagnostics

### Empty Completed Turn

Observed in Home AI thread `019eed86-2002-7cc2-b0b7-937eb5355f36` on
2026-06-24:

- The client accepted a user message and showed an active running timer.
- After the turn completed, the visible conversation initially had no response.
- The affected turn `019ef7a6-f274-73d0-aa3c-e6f232dfb036` had
  `itemCount=0` in thread detail projection.
- Its rollout contained `task_started` and `task_complete`, but no scoped
  `user_message` / `agent_message` item and an explicit empty final assistant
  message.

Conclusion: this shape is a runtime empty completion, not a projection loss of
an existing assistant receipt. Codex Mobile must not fabricate an assistant
reply. It should render a bounded diagnostic item so the turn does not
silently vanish.

### Active No-Visible-Output Window

A later Home AI turn did eventually produce visible content, but the first
visible assistant content arrived only after a long no-visible-output interval.

Conclusion: active no-output latency is a separate diagnostic target from
empty completed turns. It needs timing evidence from server detail phases and
client first-paint/refresh events before changing projection or UI behavior.

### Thread-List Summary Rendered As Empty Detail

Observed in Music thread `019ef42b-2cb8-7332-ab17-033ec5b48947` on
2026-06-26:

- The thread list row was a lightweight summary with `turns: []`.
- The detail API returned a bounded recent window with `10` turns and visible
  items.
- The client briefly rendered the summary row as a thread-detail conversation,
  which exposed `No visible turns.` before the detail response settled.
- A follow-up report showed the same thread stuck on the empty detail view even
  though direct `/api/threads/<id>?mode=recent` and full reads returned `10`
  visible turns. The thread-list API row still carried a `turns: []` field, and
  detail-to-list merging preserved that stale detail-shaped field on the list
  object.

Conclusion: a thread-list summary row is not a loaded thread detail. During
thread switches, the client must force a loading shell until the detail response
arrives; summary metadata can provide title/status/workspace context, but it
must not own the conversation `turns` state. Thread-list rows must be sanitized
so they do not retain `turns`, task-card detail arrays, runtime settings, or
loading/error detail flags; a current thread without loaded-detail evidence must
request detail instead of taking the cached-current render path.

### Platform Incident Intake

The user proposed frontend diagnostics that POST evidence to a server and
trigger task cards. The platform-level mechanism should be implemented by Home
AI, not independently by Codex Mobile:

- Home AI owns diagnostic schema, privacy policy, deduplication, severity,
  routing, and cross-workspace task-card decisions.
- Codex Mobile should emit bounded plugin diagnostics only: build id, thread id,
  turn id, read mode, status, render/scroll state, item counts, and timing
  buckets.
- Codex Mobile must not send raw access keys, cookies, prompts, message bodies,
  image contents, provider payloads, or full logs.

## Optimization Sequence

### Execution Acceleration Rule

The next optimization rounds should batch work by architecture module instead
of deploying every small UI or diagnostic tweak. The main thread should keep
the integration path: root-cause boundary decision, code review, focused/full
test runs, commit, deploy, and production readback. Sub-agents should be used
for disjoint read-only investigations or disjoint write sets only, such as
large-session cold-path analysis while the main thread fixes frontend render
authority. This keeps velocity higher without weakening the Home AI
root-cause-first rule or introducing masking fallbacks.

Current acceleration targets:

1. Active large-thread detail opens still have the highest full-read risk. The
   active-read policy intentionally disables partial projection and bounded
   turns-list shortcuts unless an authoritative active-window overlay can prove
   operation, upload, assistant-delta, usage, and diagnostic coverage. The
   local active-overlay orchestration seam now defaults fail-closed and is
   executable in tests: incomplete evidence still falls through to full
   `thread/read`, while complete evidence can return
   `projection-active-overlay`. The local provider slice now exposes a
   memory-only, clone-only active overlay snapshot from the server-owned live
   notification projection and wires it into read orchestration. It still fails
   closed unless the snapshot has a matching active turn plus explicit
   operation/upload/assistant-delta/receipt coverage and v4 revision freshness.
   The real-service integration slice also preserves the normal projection
   invariant: ordinary projection hits must contain the local active turn, while
   only active-overlay window assembly may accept a partial projection window
   that lacks that active turn before merging the proof-gated live overlay.
   The route-boundary slice then extracts `/api/threads/:id` detail route
   coordination into a testable service so `mode=recent`, bounded request logs,
   response send, and `complete=false` semantics can be verified without
   relying on `server.js` source-string assertions. The route-smoke slice now
   proves that this route boundary can call the real read orchestration and
   return `projection-active-overlay` for a recent active-window read without
   invoking full `thread/read` or `turns-list`.
   Production readback after the Phase B deploy showed the next active-overlay
   failure reason as `missing-active-turn-id`: the summary row could say
   `status=active` while omitting a concrete active turn id. The follow-up local
   slice keeps the proof gate strict but moves active turn ownership into the
   server-owned live projection shell: `turn/started` and active item
   notifications now retain `thread.activeTurnId`, completion clears it, and
   the overlay provider may ask the projection service to infer the current
   active turn when the summary only proves active status. Focused integration
   coverage proves this can return `projection-active-overlay` without full
   `thread/read` while preserving fail-closed behavior for missing snapshots,
   stale assistant evidence, and completed turns. A later Phase B module
   readback exposed the colder restart boundary that the live snapshot path
   cannot cover: rollout fallback could mark a summary `status=active` from
   tail activity while omitting the concrete active turn id. The server-only
   follow-up carries `task_started.turn_id` from rollout tail status into the
   fallback summary as `activeTurnId`, so active-read policy can enter the same
   proof gate after cold start or deploy restart. Terminal rollout entries
   still win, so completed turns are not promoted to active. Production readback
   after deploying `f6818d7` confirmed this advanced the active detail path to
   `projection-active-overlay` with `activeOverlayGate=ready`. The next local slice
   separates ordinary projection staleness from active-overlay window
   eligibility: `dynamic-summary-stale` still invalidates normal projection
   hits, but a proof-gated active overlay lookup may reuse that same dynamic
   entry as a bounded projection window when the summary is still active and
   the caller explicitly requests `{ allowPartial: true, activeOverlay: true }`.
   The live overlay proof gate still owns the final decision; stale windows are
   not exposed as ordinary detail projections. The readback gate slice then
   makes this batch observable: the Phase B smoke summarizes active overlay as
   `activeOverlayGate`, `activeOverlayGateReason`, and
   `activeOverlayNextAction`, plus operation/upload/assistant/receipt counts.
   Post-deploy readback can now identify whether the next blocker is active
   turn ownership, stale window lookup, missing snapshot, assistant freshness,
   receipt coverage, item-kind normalization, or source authority without
   reading private message text or logs. The bounded-window slice then handles
   the `missing-projection-window` gate without turning it into a generic
   fallback: when projection lookup has no reusable window but the
   server-owned live overlay provider has already produced an active turn and
   bounded coverage evidence, read orchestration can build a
   `turns-list-active-overlay-window` skeleton, mark it as a non-persisted
   partial active-overlay window, and re-run the proof gate. Ordinary
   projection reads still reject stale or partial windows, and the active
   response is emitted only if the proof gate returns
   `use-projection-overlay`. Production readback after deploying this active
   overlay window slice showed `readMode=projection-active-overlay`,
   `activeOverlayGate=ready`, and `activeOverlayReason=overlay-evidence-complete`;
   the remaining readback decision is only H3 observation for thread-list
   deferred fallback while active thread detail is prioritized. A later
   readback sample exposed one more active-detail ownership gap: an ordinary
   `projection-v4-dynamic` hit could return before the active-overlay proof
   seam even though summary status remained active. The next runtime slice
   treats that projection hit only as a window candidate for active/running
   summaries; active detail still has to pass the server-owned live overlay
   provider and proof gate before returning without full `thread/read`.
2. Thread-list cold starts no longer hide source collection inside the fallback
   cache policy. The local `thread-list-fallback-baseline-service` slice now
   owns state DB / rollout session / session-index source collection,
   per-source timings/counts, source-order merge, and result limiting without
   changing behavior. The `thread-list-cold-path-diagnosis-service` slice now
   converts those existing bounded fields into `coldPathOwner` /
   `coldPathReason`, distinguishing warm cache reuse, deferred fallback, miss
   rebuild, TTL-expired rebuild, app-server-only reads, and app-server error
   fallback without changing thread-list data flow. The next thread-list slice
   can use these fields to decide whether a root-cause fix belongs to source
   internals, route aggregation, cache freshness, or a future explicit
   prewarm/persist design.
   `scripts/codex-mobile-phase-b-readback-smoke.js` now gives the Phase B batch
   a deploy/readback gate for `/api/public-config`, `/api/threads`, and
   `/api/threads/:id?mode=recent`, while reporting only build ids, short hashes,
   owner/reason labels, counts, and timings. Its readback decision service
   maps those labels into a bounded `decision` so post-deploy evidence points
   at the next root-cause owner: active overlay proof, projection cache
   lifecycle, projection input, thread-list fallback baseline, cache freshness,
   or app-server fallback. After the active-detail proof gate became ready, the
   smoke also verifies deferred thread-list fallback as a sequence instead of a
   single label: if the first list read is deferred while detail is active, it
   performs a follow-up full list read and, when that follow-up builds the
   fallback baseline, a same-key warm check. This proves whether the server is
   doing the acceptable cold-start/deploy one-time rebuild or repeatedly
   exposing cold fallback work to foreground list opens. The same-key warm
   check also runs for an ordinary first full-list `miss-rebuild` /
   `expired-rebuild` when it has not already hit the source snapshot, so a
   post-deploy cold sample can prove the once-only invariant instead of being
   misclassified as an immediate repair. The first root-cause
   optimization from that decision path is memory-only source snapshot reuse
   below the final-list
   cache: different `cwd/search/limit` final-list keys can reuse the same
   visibility-scoped state DB / rollout / session-index source set, while the
   existing filter/merge/limit semantics still produce each public list. The
   next source-internal slice reduces the first build cost without changing
   cache policy: rollout list fallback now reads head/stat first, filters and
   limits visible candidates, then reads rollout tails only for the surviving
   rows that need status inference. Default single-thread rollout fallback
   still returns active/completed status immediately; only list source
   collection defers that tail scan until the final candidates are known. The
   same source-internal slice also reuses archived-thread ids for a whole
   filter/merge pass and reuses the already-read rollout tail when checking
   stale context-only active evidence, so the remaining first cold rebuild work
   can be measured against candidate discovery/sort and final-candidate status
   parsing rather than repeated per-row directory/tail scans. The next local
   slice makes that attribution explicit: fallback baseline source reads now
   carry bounded counters for rollout directory reads, JSONL stat/collect/sort
   counts, candidate scans, head reads/bytes, final status tail reads/bytes,
   and `session_index.jsonl` read/line/entry counts. The counters are numeric
   only and pass through a whitelist in the baseline/cache layers, so production
   readback can identify the next root-cause owner without copying thread
   titles, prompts, rollout paths, or logs. A follow-up narrows one of those
   counters directly: one fallback baseline read now carries a temporary
   `sourceContext` through state DB / rollout / session-index source readers,
   so the session index map read by rollout fallback can be reused by
   session-index fallback in the same pass. This is not a persistent cache or
   prewarm; it only removes duplicate synchronous reads within one cold source
   build and exposes `fallbackSessionIndexReuseCount` as proof. The next
   source-internal slice reduces discovery waste before stat/sort: rollout
   directory entries are visited as directories first and by descending name, so
   the known `sessions/YYYY/MM/DD/rollout-...` layout reaches newer date
   branches before older ones when the discovery candidate cap is hit. Final
   results are still sorted by `mtimeMs`, so this narrows cold discovery cost
   without changing public merge/filter/status ownership. The follow-up
   attribution slice makes the remaining baseline work measurable instead of
   guessed: fallback baseline timings now include bounded
   `fallbackBaselineFinalFilter*`, `fallbackBaselineMerge*`, and
   `fallbackBaselineLimitDropCount` fields, so the Phase B batch readback can
   tell whether the remaining cold cost is source I/O, final `cwd/search`
   filtering, duplicate-id merge pressure, or limit truncation. This does not
   alter list data, ordering, visibility, app-server merge behavior, or cache
   ownership.
3. Large detail cold-path attribution now has a dedicated
   `thread-detail-cold-path-diagnosis-service` that emits bounded
   `coldPathOwner` / `coldPathReason` for projection-cache seeding,
   summary-rollout hydration, stale full-cache lifecycle, active full-read, and
   app-server fallback without changing the read strategy. The remaining Phase B
   work is to use that attribution to prioritize active-overlay and thread-list
   fallback-baseline changes.

### Phase 1: Evidence And Boundary Cleanup

Status: in progress. Earlier slices added bounded `detailShape` counts to
thread-detail performance events, so large-session investigations can compare
server phase timings with client render/merge timings and visible item shape
without collecting message bodies or file contents. The latest Phase B slice
uses that evidence to add a recent-only, memory-only partial projection warm
path: a first `mode=recent` `turns-list-initial` response can seed a
`recent-window` projection that later recent opens may reuse, while full/detail
reads still reject partial cache and disk persistence still stores only full
non-partial projections.

- Keep large-session timing evidence in `mobileDiagnostics.threadDetailTimings`
  and client `performancePhase` events. Client events now also carry
  `detailShape` counts for turns, items, visible items, image items, operation
  items, receipt items, usage items, diagnostics, and completed/active turns.
  Server detail timings also expose the exact bounded read decision,
  projection input/hit/miss/unavailable state, projection cache source/version/
  age, and projection seed status/source. This lets a first-paint event show
  whether a cold large-session open was a warm projection hit, projection miss
  protected by `turns-list-large`, summary-sourced large read, full
  `thread/read`, fallback `thread/turns/list`, or summary fallback without
  reading private conversation data. Recent-mode projection hits may now report
  `projection-v4-partial` / `projection-partial` with source `partial`; those
  modes mean only the bounded current window is cached, not the complete
  thread history. The latest local server-diagnostics slice aligns the
  server-side `threadDetailTimings.phase` classifier with the same bounded
  evidence fields used by the client: `readDecision`, `projectionState`,
  `projectionSource`, and `projectionSeedStatus`. That keeps production
  first-paint samples explainable even when `readMode` is sparse or generic,
  for example distinguishing `projection-hit` cache versus dynamic hits,
  seeded initial turns-list windows, raw/full thread reads, and summary
  fallback without changing the actual read strategy. It also records
  `activeFullReadRequired` / `activeFullReadReason` when an active/running
  summary intentionally skips partial projection or bounded turns-list shortcuts
  and falls back to full `thread/read`; `thread-detail-active-read-policy-service`
  now owns that decision boundary, so any later active-turn overlay optimization
  has to prove itself against a pure policy surface rather than patching the
  orchestration path inline. The follow-up
  `thread-detail-active-window-overlay-policy-service` defines that proof gate:
  active projection overlay remains fail-closed unless the active turn id,
  projection window, authoritative overlay source, matched active turn, operation
  coverage, upload visibility, assistant delta freshness, and usage/diagnostic
  receipt coverage are all explicit and bounded.
  `codex-mobile-shell-v531` adds the next attribution layer without changing
  read behavior: `thread-detail-cold-path-diagnosis-service` maps existing
  bounded timing fields into `coldPathOwner` / `coldPathReason`, so a cold
  `thread_detail_first_paint`, `thread_refresh_ms`, or Home AI slow-path case
  can directly distinguish projection-cache misses, missing projection input,
  summary-sourced large windows, active read policy full reads, app-server
  `thread/read`, app-server `thread/turns/list`, and summary fallback.
  The local active-overlay orchestration seam then wires that proof gate into
  `thread-detail-read-orchestration-service` without enabling a real provider:
  active reads record bounded `activeOverlayAction`, `activeOverlayReason`,
  `activeOverlaySource`, item counts, and `activeOverlayMs`; provider-missing or
  incomplete evidence remains `require-full-read`, while test-injected complete
  evidence returns `projection-active-overlay`.
- Keep thread-list fallback cache evidence in
  `mobileDiagnostics.threadListTimings`. The cache now reports
  `fallbackCacheDecision` (`hit`, `miss-rebuild`, `expired-rebuild`), bounded
  cache key hash, cache age/update age, build count/number, entry count, and
  incremental-update count. The local baseline-service slice also reports
  `fallbackStateDbCount`, `fallbackRolloutCount`, `fallbackSessionIndexCount`,
  `fallbackBaselineSourceCount`, and `fallbackBaselineResultCount` beside the
  existing per-source timings. The Phase B attribution slice extends this with
  `fallbackRolloutDirectoryReadCount`, `fallbackRolloutFileStatCount`,
  `fallbackRolloutFileCollectedCount`, `fallbackRolloutFileSortedCount`,
  `fallbackRolloutCandidateFileCount`,
  `fallbackRolloutCandidateScannedCount`, `fallbackRolloutHeadReadCount`,
  `fallbackRolloutHeadBytes`, `fallbackRolloutStatusTailReadCount`,
  `fallbackRolloutStatusTailBytes`, `fallbackSessionIndexReadCount`,
  `fallbackSessionIndexReuseCount`, `fallbackSessionIndexLineCount`, and
  `fallbackSessionIndexEntryCount`. These fields prove whether an observed slow
  list load is a first baseline build, TTL expiry, cache miss, deferred
  fallback, warm in-process reuse, source-read volume, rollout
  discovery/head/tail work, session-index volume/reuse, or post-merge result
  size.
  `thread-list-cold-path-diagnosis-service.js` also emits bounded
  `coldPathOwner` / `coldPathReason` from those fields so production readback
  can be grouped without copying thread titles, prompts, paths, or logs.
  Final-list cache misses can now report `fallback-source-snapshot` when the
  expensive raw source set was reused in memory and only the final filter/merge
  was rebuilt.
- Move deterministic completed-turn diagnostics out of `server.js` into a
  service module.
- Preserve the rule that explicit empty final assistant messages produce
  `turnDiagnostic` / `runtime_completed_without_response`, not a synthetic
  `agentMessage`.

### Phase 2: Frontend State Ownership

Status: Phase A module deploy candidate as of `codex-mobile-shell-v510`.
The local Phase A refresh/patch ownership work now has the helper extraction,
transaction ordering, completion snapshots, attempt aggregation, and
behavior-level DOM harness needed to deploy as one module instead of many
small slices. The module remains a root-cause architecture boundary cleanup:
it changes frontend refresh/patch ownership and validation, not server
projection semantics, diagnostic dispatch policy, task-card protocol, or
visual layout. Post-deploy observation should use bounded
`thread_refresh_ms` and Home AI `conversation_projection_mismatch` diagnostics
before deciding whether the next repair belongs to DOM patching, server
projection, SSE/live merge, or pane state.

`codex-mobile-shell-v509` also closes a diagnostic blind spot found during
mobile validation: render signatures and duplicate render keys can both look
healthy while the client has sorted visible turns differently from the server.
The client turn-order function now follows the server started-at-first order,
and the Home AI diagnostic channel can emit bounded `turn_order_mismatch`
reports when DOM turn ids do not match the expected visible turn order or when
the latest visible turn is not the latest DOM turn.

`codex-mobile-shell-v513` moves the thread-list-summary versus loaded-detail
boundary into `public/thread-detail-state.js` instead of leaving it as local
`public/app.js` state logic. The helper now strips detail-only fields before
thread rows enter or re-enter the list, detects whether an empty `turns: []`
object is a real loaded empty detail or only a summary shell, and merges
summary rows without preserving stale detail/projection fields. `public/app.js`
still owns the real state mutation, network refresh, and render scheduling, but
it no longer owns this policy. This directly follows the v511/v512 Music
incident: a list row with `turns: []` must not masquerade as a thread-detail
conversation.

`codex-mobile-shell-v514` continues that boundary extraction by moving
summary-only current-thread recovery planning into `public/thread-detail-state.js`.
The helper now decides whether a current thread is a summary shell, produces
the sanitized loading-shell thread state, emits bounded diagnostic fields, and
declares whether an immediate detail refresh should be scheduled. `public/app.js`
executes those planned effects but no longer owns the policy branches. This
keeps the v511/v512 root-cause repair in one focused state-ownership module
instead of splitting detection, sanitization, and recovery across the main app
render function.

`codex-mobile-shell-v515` adds the next ownership rule from the same Music
incident class: an incoming empty `turns: []` detail response cannot wipe out an
existing current-thread state that already has visible turns. That merge
authority lives in `public/thread-detail-merge-state.js`, because the decision
is about state strength, not UI rendering. The same slice moves the
single-thread loading/load-error early-shell execution plan into
`public/thread-detail-render-plan.js`, leaving `public/app.js` to execute DOM,
retry, tick, and navigation effects only.

`codex-mobile-shell-v516` applies the same empty-incoming authority rule to the
v4 projection merge path. Production Music detail currently reads through
`projection-v4-dynamic`, and that path uses a dedicated `mergeV4ProjectionThread`
callback before the generic thread-detail merge policy runs. The v4 path now
refuses to let an empty projection window erase existing visible turns while
still accepting bounded incoming metadata such as read mode and projection
revision.

`codex-mobile-shell-v517` fixes the next root-cause layer from the same
incident class: embedded/mobile startup, workspace refresh, and thread-list
restore paths could render the Hermes Primary shell while a thread detail open
intent was still active. Production evidence showed Music detail returning
visible projection turns while the client emitted a blank `threadId=""`
conversation render. The ownership rule is now explicit in
`public/app.js`: `hasThreadDetailSelectionIntent()` covers current thread state,
current thread id, active detail load controller, and startup thread-open intent;
`shouldRenderPrimaryConversationShell()` is the only allowed guard for list and
workspace paths that want to render the Primary shell. Non-forced
`showHermesPluginPrimaryPage()` calls are suppressed during active thread loads
and emit bounded diagnostics instead of clearing selection. The v4 projection
merge policy is also extracted into `public/thread-detail-v4-merge-state.js`,
with executable tests, so the remaining large `public/app.js` state boundary is
smaller and the Music projection invariant is directly covered.

`codex-mobile-shell-v518` closes the diagnostic gap for that same selection
ownership class and tightens the loaded-detail boundary that produced the
Music `No visible turns.` screen. Empty `turns: []` objects are no longer
treated as loaded detail merely because list/runtime metadata such as
`threadTaskCards`, `runtimeSettings`, or `mobileReadMode` is present. Only a
successful detail API path in `loadThread()`, `refreshCurrentThread()`, or
`backfillFullThreadDetail()` can set the internal `mobileDetailLoaded` marker;
that marker is stripped before thread-list summaries are written back. Summary
shells therefore recover into a loading shell and refresh instead of becoming a
stable empty conversation.

The client also records bounded evidence from recent successful thread-detail
renders, including only thread hash, read mode, visible turn/item counts, item
count, source kind, and age. If a non-forced Hermes Primary shell call is
suppressed while a thread open is active, or if the client actually renders an
embedded Primary shell shortly after a successful detail render, the frontend
records a `primary_shell_selection_conflict` diagnostic. The event uses the
existing Home AI diagnostic reporter threshold, dedupe, sanitizer, and
`homeai.diagnostic.report` postMessage transport; it does not dispatch repair
cards automatically and does not include message bodies, thread titles, URLs,
local paths, cookies, tokens, prompts, uploads, or long logs. Forced user/route
Primary navigation clears the recent detail evidence to avoid reporting
intentional navigation as a projection mismatch.

`codex-mobile-shell-v519` adds the adjacent empty-state diagnostic for the
same production failure class. Detail API success paths now also record bounded
same-thread evidence before merge/render, so a later single-thread full render
that emits `No visible turns.` after nonempty detail evidence records an
`empty_visible_detail_mismatch` diagnostic. This is intentionally diagnostic,
not a masking fallback: the UI is not force-refreshed or hidden, and plugin
reports still flow only through Home AI's Owner-gated diagnostic intake. The
payload contains only thread hash, read/render mode, source kind, visible
turn/item counts, DOM/previous counts, detail-loaded flag, and evidence age;
message bodies, task-card bodies, upload bytes, private paths, URLs, cookies,
tokens, prompts, and long logs are excluded by construction and sanitizer
tests.

`codex-mobile-shell-v520` closes the remaining cached-current ownership gap
seen on `Music 06-23`: the server projection returned nonzero turns, but the
client could still reuse an older current-thread object with
`turns: [] + mobileDetailLoaded:true` when the user opened the same thread
again. The cached-current short path now requires
`threadHasReusableLoadedDetailState()`, which only returns true for loaded
detail that already contains visible turns. Empty loaded detail may still be a
valid API result for a genuinely empty thread, but it is not reusable as an
open-thread cache authority; opening the same thread must re-read the detail
API. `loadThread()` also strips detail-only fields from thread-list summaries
before constructing a loading current-thread shell, so list rows cannot restore
`mobileDetailLoaded` into the detail owner.

`codex-mobile-shell-v521` moves that open-thread cache authority rule out of
ad-hoc `app.js` branching into `planThreadOpenCacheReuse()` in
`public/thread-detail-state.js`. The plan names whether cached-current may be
used, whether an empty cached detail authority attempt should be reported, and
the bounded reason. `loadThread()` consumes that plan, records
`empty_cached_detail_reuse_blocked` through the Home AI diagnostic reporter
when an empty `mobileDetailLoaded` state tries to become authority, and then
continues to the normal detail API path. This keeps the root-cause fix at the
state ownership boundary: no UI hiding, forced refresh loop, synthetic turns,
or duplicate suppression is introduced.

`codex-mobile-shell-v522` adds the Phase E browser/DOM replay hook for that same
failure class. Hermes embedded `window.__codexMobileVisualHarness` can now seed
an empty loaded current-thread detail and call the real `loadThread()` path, and
`scripts/codex-mobile-empty-detail-cache-smoke.js` drives that hook through the
Home AI live debug server to assert that the DOM reaches nonempty turn rows
instead of staying on `No visible turns.`. This is verification infrastructure,
not a runtime fallback: the smoke records only build id, thread hash,
turn/item counts, loaded/loading/error flags, read mode, and DOM counts.

`codex-mobile-shell-v523` closes the next ownership boundary for the same
visible failure class. `/api/threads` list rows are not detail authorities and
must never expose `turns: []`, `mobileDetailLoaded`, projection metadata, visible
item keys, or pending server request bodies. `adapters/thread-list-summary-service.js`
now strips those fields during list merge/status normalization/task-card count
decoration so fallback/app-server summaries cannot overwrite a loaded detail
surface with an empty shell. The client also records
`empty_render_with_history_evidence` and refreshes the real detail API when a
rendered empty state conflicts with bounded history evidence such as rollout
size, omitted turns, visible item keys, active turn state, or pending task cards.
That refresh is observable diagnostic recovery for an invariant violation, not a
UI masking fallback or synthetic content path.

`codex-mobile-shell-v524` moves that empty-detail/history-evidence recovery
decision out of `public/app.js` into `public/thread-detail-state.js`.
`emptyDetailHistoryEvidenceForThread()` and `planEmptyDetailHistoryRecovery()`
now own the bounded evidence set, recovery signature, cooldown reason, and
diagnostic event fields. `public/app.js` keeps only effect execution:
cooldown-state storage, Home AI diagnostic recording, detail refresh scheduling,
and client event emission. This continues Phase 2's ownership direction: state
authority decisions live in testable helpers; the app shell remains the
orchestrator.

`codex-mobile-shell-v525` applies the same ownership rule to recent successful
thread-detail render evidence. `buildThreadDetailRenderEvidence()`,
`recentThreadDetailRenderEvidence()`, `sameThreadDetailRenderEvidence()`, and
`hasNonemptyThreadDetailRenderEvidence()` now live in
`public/thread-detail-state.js`. These helpers own evidence construction,
freshness, current-thread matching, and nonempty proof; `public/app.js` keeps
shape/hash calculation plus the concrete diagnostic/reporting effects. This
keeps primary-shell conflict and empty-visible-detail mismatch reporting tied to
one tested state boundary.

`codex-mobile-shell-v526` closes the matching DOM authority gap for the same
Music empty-detail failure class. A refresh can no longer treat
`renderedConversationSignature === nextConversationSignature` as sufficient
proof that the currently mounted single-thread DOM is authoritative. The refresh
plan also receives the current DOM turn count, next visible turn count, and
single-thread surface availability. If the next detail is visibly nonempty but
the mounted single-thread DOM has zero turn articles, the plan invalidates the
stable signature with `rendered-dom-empty` and forces a full render. This fixes
the root state-ownership mismatch instead of adding an extra retry or synthetic
content fallback.

`codex-mobile-shell-v527` closes the lower-level conversation update path that
remained after v526. `updateConversationHtml()` previously trusted
`renderedConversationSignature === signature` before checking whether the
currently mounted DOM still contained the expected turn articles. That allowed a
single-thread surface to stay on `No visible turns.` even while the current
thread detail state was visibly nonempty. `planConversationHtmlUpdate()` now
receives `expectedVisibleTurnCount` and `renderedDomTurnCount`; stable
signatures are reusable only when the DOM shape is compatible. If the next
state has visible turns but the DOM has zero turn articles, the helper returns
`stable-signature-dom-empty`, the app executes a real HTML update, and bounded
diagnostics record `stable_signature_dom_empty` /
`conversation_dom_authority_invalidated`.

`codex-mobile-shell-v528` closes the diagnostic side of that same failure
class. Turn-order diagnostics used to treat an empty DOM turn-id list as
insufficient evidence and returned `null`, even when the current thread state
had visible turns. That made the exact user-visible state "no turns can be
seen" less likely to reach Home AI's Owner-gated diagnostic remediation loop.
`public/thread-diagnostic-events.js` now owns
`turnOrderDiagnosticSnapshot()`: expected turn ids and DOM turn ids are compared
in the helper, and expected-nonempty / DOM-empty surfaces become bounded
`turn_order_mismatch` evidence with `missing_dom_turn_count`. `public/app.js`
only supplies expected ids, DOM ids, and safe thread/turn hashes.

`codex-mobile-shell-v529` adds the browser/visual replay coverage for the lower
DOM-authority branch fixed in v527. The Hermes embedded
`window.__codexMobileVisualHarness` now exposes
`simulateStableSignatureEmptyDom(threadId)`: it opens a real nonempty thread
detail through `loadThread()`, records the current conversation render
signature as if it were still authoritative, replaces the mounted conversation
DOM with the empty-state shell, and then calls the real `renderCurrentThread()`.
The expected outcome is that `planConversationHtmlUpdate()` sees
expected-visible-turns versus zero rendered DOM turns, invalidates the stable
signature with `stable-signature-dom-empty`, and repaints nonempty turn rows.
`scripts/codex-mobile-empty-detail-cache-smoke.js` now accepts
`--scenario stable-signature-empty-dom` while keeping the original
`empty-cache` default. The harness emits only bounded build id, thread hash,
turn/item counts, DOM counts, loaded/loading/error flags, and read mode.

`codex-mobile-shell-v530` extends that same DOM-authority rule to the thread
tile board. Tile turns are rendered as
`article.thread-tile-turn[data-thread-tile-turn]`, so the single-thread DOM
count (`article.turn[data-turn]`) could not prove whether a stable tile-board
signature was still authoritative. `renderThreadTileLayout()` now computes the
expected number of renderable tile turns across visible panes and the mounted
tile DOM turn count before calling `updateConversationHtml()`. Stable
signatures are therefore reusable for tile boards only when the tile DOM shape
is compatible; otherwise the same `stable-signature-dom-empty` path performs a
real render and emits bounded diagnostics.

The first slices extract item visible-field merge policy,
visible-text render identity / completed-receipt retention, local-only item
retention/drop policy, and live-to-completed same-turn visible-item preservation
to `public/thread-detail-state.js`. The refresh render-mode decision now lives
in `public/thread-detail-render-plan.js`: it decides metadata-only versus local
patch versus full render from previous/next/rendered conversation signatures,
prevents local patch attempts when the currently rendered DOM signature is
already stale, and owns the final refresh render outcome (`renderAction`,
`detailRenderMode`, and projection-consistency phase). Tile-pane patch success
is now a terminal render outcome instead of falling through to a single-thread
full render. Thread/turn-level merge orchestration now lives in
`public/thread-detail-merge-state.js`: it coordinates v4 projection delegation,
incoming turn merge, stale mobile load flag cleanup, active live-turn retention,
expanded-history preservation, and initial-submission echo cleanup while
`public/app.js` supplies item-level merge and DOM/runtime glue. Visible-item
refresh patch planning now lives in `public/thread-detail-patch-plan.js`: it
classifies shape-preserving updates into reuse/patch/insert operations and
rejects reorder/removal/invalid-entry cases before DOM work starts. The latest
slice also moves DOM patch surface selection and turn-level refresh patch
application planning into that policy module:
`planThreadDetailDomPatchSurface` decides whether the active surface is a
`thread-tile-pane`, a `single-thread` surface, or a blocked transition/mismatch.
`planThreadDetailRefreshDomPatch` decides whether each turn refresh should be
an item-only patch, a turn insert, or a turn replace. Local patch scroll completion now lives in
`public/conversation-scroll.js` through `planLocalPatchScrollCompletion`, so
app code consumes an explicit scroll plan instead of inlining the bottom-follow
policy. Visible-item DOM patch execution now lives in
`public/thread-detail-dom-patch.js`: app code injects lookup/render/patch
callbacks while the helper owns reuse/patch/insert sequencing and bounded
failure reasons. Turn-level DOM patch execution now also lives in
`public/thread-detail-dom-patch.js`: app code injects turn lookup, item patch,
turn render, turn insert, and turn replace callbacks while the helper owns
`item-patch` / `insert-turn` / `replace-turn` sequencing and bounded failure
reasons. Turn article insertion anchoring now lives in the same helper:
`insertTurnArticleElement` owns the after-previous / before-first / append
selection while app code injects the concrete DOM lookups. Turn article lookup
by stable render key now also lives in the same helper:
`findTurnArticleElement` owns the `[data-render-key=...]` selector lookup while
app code injects `stableTurnKey` and selector escaping. Turn article element
creation now also lives in the same helper: app code injects `renderTurn` and
`document`, while `createTurnArticleElement` owns rendered-HTML-to-element
creation for insert/replace operations. Thread detail hydration orchestration
now also lives in the same helper: app code injects GitHub-card hydration,
Mermaid hydration, and image scan callbacks while `hydrateRenderedSurface`
owns the call order and image-scan delay forwarding for full render, tile-pane
patch, and local patch completion. Live text item DOM patch sequencing now
also lives in the same helper: app code still decides tile/single surface and
scroll completion, but `applyLiveTextItemDomPatch` owns render-key lookup,
HTML-to-element creation, patch callback execution, and bounded failure reasons
for streaming `agentMessage` / `plan` updates. Keyed child DOM reconciliation
now also lives in the same helper: `patchNode`, `patchChildNodes`, and
`patchHtml` own data-render-key lookup, compatible unkeyed reuse, attribute
sync, text/comment patching, stale child removal, incompatible node
replacement, and bounded `patchHtml` failure reasons while `public/app.js`
keeps the high-level patch/fallback/hydration/scroll/performance orchestration.
Conversation HTML update planning now also lives in
`public/thread-detail-dom-patch.js`: `planConversationHtmlUpdate` owns stable
versus changed signature branching, patch-shell signature update intent,
patch-html versus `innerHTML` action choice, hydrate options, and scroll action
while app code keeps the real DOM write/fallback, callback execution, state
assignment, and performance event emission. Local DOM patch completion
planning now also lives in that helper:
`planLocalConversationDomUpdateCompletion` owns the tile-pane terminal state,
single-thread blocked state, single-thread hydrate intent, signature update
intent, and scroll action after local patch execution while app code keeps the
real tile pane patch, callback execution, state writes, and scroll scheduling.
Visible-item insert anchoring now also lives in that helper:
`insertVisibleItemElement` owns nearest-rendered-previous lookup, before-first
fallback, append-after-previous behavior when the previous node is already the
last DOM child, the concrete `insertBefore` call, and bounded failure reasons
while app code keeps item HTML rendering and local patch completion execution.
Local patch preflight policy now lives in `public/thread-detail-patch-plan.js`.
`planThreadDetailRefreshLocalPatchPreflight` owns missing root/thread
classification, tile-pane terminal classification, single-thread surface
availability, loading/error rejection, rendered-DOM stale rejection, and
patch-shell change rejection. App code still performs the real root lookup,
tile-pane patch attempt, signature calculation, and DOM mutation.
Refresh patch execution planning now also lives in
`public/thread-detail-render-plan.js`: `planThreadDetailRefreshPatchExecution`
owns whether a thread refresh should try tile-pane patch, whether
single-thread local patch is eligible, whether a metadata-only tile miss should
update metadata without full render, and which fallback action applies. App code
keeps real DOM patch attempts, metadata writes, full render execution, and
diagnostic/performance reporting.
Refresh patch attempt result planning now also lives there:
`planThreadDetailRefreshPatchAttemptResult` normalizes tile-pane success,
local-patch success, local-patch rejection, metadata-only tile misses, and
finalize-input shape. It also owns the patch telemetry selection for
`detailPatchMs`, `patchTimingSource`, and normalized `patchRejectReason`, plus
whether a failed local patch attempt should emit the projection-mismatch
diagnostic, while app code keeps real DOM calls, visible shape collection, and
the diagnostic transport.
The local DOM patch executor now returns a structured `{ ok, reason }` result
directly to the patch-attempt executor, so refresh rejection reasons no longer
move through transient global app state before telemetry and diagnostics read
them.
Local DOM patch transaction ordering now also lives in
`public/thread-detail-dom-patch.js`. `applyThreadDetailPatchTransaction` runs
the core turn DOM patch first and only executes success effects such as
operation-dock refresh, action rebinding, and local DOM completion after the
core patch succeeds. This prevents failed turn patches from updating
operation-dock state while leaving conversation DOM on the old signature.
The transaction now separates commit effects from post-commit effects:
conversation DOM completion is the commit gate, and operation-dock refresh /
action rebinding run only after that gate succeeds. This prevents a completion
failure from leaving dock/action state ahead of committed conversation
signatures.
Phase A now has a behavior-level refresh DOM harness in
`test/thread-detail-refresh-dom-harness.test.js`. The harness combines the real
render-plan, patch-plan, and DOM-patch helpers with a lightweight fake DOM to
prove tile terminal success, single-thread local patch success with commit
before dock update, and local patch rejection routing to full render without
depending only on source-shape assertions.
Local DOM patch completion can now consume an explicit completion snapshot from
the refresh path. The snapshot captures single-thread completion, render
signature, patch-shell signature, and scroll-follow policy before the turn DOM
patch is applied, so completion no longer has to re-probe tile/single surface or
re-read scroll policy after the DOM mutation.
Patch-attempt result aggregation now also lives in the render-plan helper:
the helper provides the empty attempt state, effect-context derivation, and
tile/local attempt reducer while app code only performs the real DOM patch
effect. This keeps tile/local timing, success flags, and rejection reason
ownership out of the refresh orchestration body.
Refresh outcome execution planning now also lives in the same helper module:
`planThreadDetailRefreshOutcomeExecution` maps render outcomes to metadata
update mode, full-render execution, and projection-consistency phase. This
keeps `refreshCurrentThread()` from inlining `refreshRenderAction` branching
after the render outcome is known. The same plan now also owns the ordered
metadata effect list for `local-patch` and `metadata-only` refreshes, so app
code executes explicit effect names instead of re-deciding which header,
operation-dock, timer, navigation-state, and scroll-button updates belong to
each refresh outcome. It now also exposes an explicit `executionAction`
(`metadata-effects`, `full-render`, or `none`) and `timingTarget`, so app code
does not infer the execution branch from `metadataEffects.length` or
`runFullRender`. Projection-consistency check planning now also lives in this
helper: `planThreadDetailRefreshConsistencyCheck` and the
`consistencyCheck` object on `planThreadDetailRefreshOutcomeExecution` own
whether to check, the bounded phase, and the render mode, while app code keeps
only the real `checkConversationProjectionConsistency` call. Refresh
performance input assembly now also lives in this helper:
`planThreadDetailRefreshPerformanceInput` combines measured timings with
`renderPlan`, `renderOutcome`, and `patchAttemptResult`, so app code no longer
maintains separate performance-only render mode/action/patch duration fields.
Refresh execution-effect planning now also lives in this helper:
`planThreadDetailRefreshExecutionEffects` maps outcome execution actions to
metadata-update, full-render, no-op, or bounded unknown effect entries. App code
still performs real metadata updates and `renderCurrentThread()` calls, but
`refreshCurrentThread()` no longer branches directly on
`executionPlan.executionAction`.
Refresh completion side-effect planning now also lives in this helper:
`planThreadDetailRefreshCompletionEffects` decides the success diagnostic clear,
usage-backfill refresh scheduling, and live-poll scheduling effects, while app
code only executes those effect names.
Refresh request planning now also lives in this helper:
`planThreadDetailRefreshRequest` decides whether a current-thread refresh should
run, snapshots the thread id and load sequence, normalizes recent/full mode,
selects the bounded API query and timeout, and records whether an active
refresh controller should be aborted. App code still performs the real abort
and network request.
Local conversation DOM patch completion effects are now also planned in
`public/thread-detail-dom-patch.js`:
`planLocalConversationDomUpdateCompletionEffects` maps an already-decided
tile/single completion plan to ordered commit effects for root hydration,
rendered conversation signature writeback, patch-shell signature writeback,
and scroll/bottom-button scheduling. `public/app.js` still executes the real
DOM/state/scroll calls, but `completeLocalConversationDomUpdate()` no longer
branches directly on `completionPlan.hydrateRoot`, signature writeback flags,
or `completionPlan.scrollAction`. This is a local Phase A slice only; it does
not change server projection semantics, local patch eligibility,
scroll-follow policy, diagnostic dispatch, task-card protocol, shell/cache
version, or production deployment state.
Conversation HTML update effects are now planned in the same DOM-patch helper:
`planConversationHtmlUpdateEffects` turns the result of
`planConversationHtmlUpdate` into ordered effects for hydrate-existing and
changed-render paths. It preserves the existing order of patch-shell signature
writeback before hydrate on stable-signature hydration, and hydrate before
rendered-signature writeback on changed renders. `public/app.js` still owns the
real patch-html / innerHTML mutation, fallback-to-innerHTML behavior,
performance timing, and primary-shell conflict check, but it no longer branches
directly on update-plan signature flags or scroll action after the DOM update
plan has been computed. This keeps full-render/hydrate-existing and local
patch completion on the same post-effect planning model.
Refresh patch surface planning now also lives in this helper:
`planThreadDetailRefreshPatchSurface` decides whether the refresh should probe
tile-pane DOM state and whether the current patch path is a tile surface based
on tile mode, tile conversation surface state, and the probed DOM patch surface.
App code still reads the UI state and performs the real DOM probe.
Refresh patch-attempt effect planning now also lives in this helper:
`planThreadDetailRefreshPatchAttemptEffects` declares the tile-pane patch and
local-patch attempt order. App code still performs the real DOM patch calls and
timing, but `refreshCurrentThread()` no longer inlines tile/local patch attempt
loops, synchronizes those booleans directly, or reads patch failure reasons from
global scratch state.
Refresh post-merge side-effect ordering now also lives in this helper:
`planThreadDetailRefreshPostMergeEffects` declares the fixed
thread-list-merge, composer/active-turn sync, and thread-list-render groups
after state merge. App code still performs the real side effects and preserves
the existing `mergeMs`, `composerRenderMs`, and `threadListRenderMs` timing
boundaries.
Thread refresh failure diagnostic payload planning now lives in
`public/thread-diagnostic-events.js`: `threadDetailRefreshFailedDiagnosticEvent`
builds the bounded `thread_detail_refresh_failed` failure report, so
`refreshCurrentThread()` no longer owns category/type/context/count/breadcrumb
selection for refresh API failures.
Refresh performance event field planning now lives in
`public/thread-performance-metrics.js`: `threadDetailRefreshEventFields`
builds the bounded `thread_refresh_ms` payload, including server timings,
client timings, detail shape, read/render mode, refresh action, render-plan
reason, patch rejection reason, and local/tile/full metadata flags. This keeps
diagnostic field ownership out of `refreshCurrentThread()` while preserving the
privacy boundary that performance events contain timings, counts, statuses, and
reason codes rather than message bodies, task-card bodies, uploads, private
paths, cookies, tokens, or long logs.
First-paint and full-backfill performance event field planning now also lives
in `public/thread-performance-metrics.js`:
`threadDetailFirstPaintEventFields` and `threadDetailFullReadyEventFields`
build the bounded `thread_detail_first_paint` and `thread_detail_full_ready`
payloads, including cached/warm-client phase handling, server/client timings,
detail shape, read mode, turn counts, omitted-turn counts where relevant, and
rollout size. This keeps large-session cold/warm path evidence consistent
across initial open, cached current open, refresh, and full backfill.
The same helper now plans detail-response diagnostic contracts:
`planThreadDetailSlowPathDiagnostic` detects repeated slow detail opens,
refreshes, and backfills from bounded timing fields, and
`planThreadDetailResponseContractDiagnostic` detects response shapes that would
make the client show missing or misleading history: empty projection shells,
active/running threads served by partial/windowed reads, and projection cache/
dynamic reads that still carry older/newer cursors. These diagnostics report
through Home AI only after the repeated-failure threshold and successful detail
responses clear the counter, so the fix surfaces architectural inconsistencies
without adding a silent display fallback.
Patch-rejection diagnostic event planning now lives in
`public/thread-diagnostic-events.js`:
`detailPatchRejectedDiagnosticEvent` builds the bounded
`conversation_projection_mismatch/detail_patch_rejected` report payload,
including render-plan reason, patch-reject reason, visible-count delta, and
breadcrumbs. `public/app.js` keeps the real refresh, patch attempt, failure
counter, and Home AI report transport, while the diagnostic evidence shape is
owned by a focused helper. The Home AI diagnostic sanitizer now explicitly
allows these bounded reason/count fields so they are not lost before the Owner
diagnostic loop receives them.
Projection consistency diagnostic event planning now also lives in the same
module: `renderSignatureMismatchDiagnosticEvent`,
`renderSignatureMismatchDiagnosticSuccess`, `duplicateRenderKeysDiagnosticEvent`,
and `duplicateRenderKeysDiagnosticSuccess` build the bounded failure/success
inputs for render-signature mismatch and duplicate render-key reports.
`checkConversationProjectionConsistency()` now owns snapshot acquisition and
reporter calls only, not event shape construction.
Detail response diagnostic event planning also lives there:
`threadDetailSlowPathDiagnosticEvent`,
`threadDetailSlowPathDiagnosticSuccess`,
`threadDetailResponseContractDiagnosticEvent`, and
`threadDetailResponseContractDiagnosticSuccess` produce the Home AI diagnostic
inputs for slow-path and response-contract failures using only read-mode,
performance phase, projection source/kind, cursor booleans, item/turn counts,
duration buckets, rollout size buckets, and short thread hashes.
Conversation projection diagnostic snapshot planning now also lives there:
`conversationProjectionDiagnosticSnapshot` decides tile-board, single-thread,
and mismatched transition surfaces from injected dependencies for tile layout,
tile ids, tile signatures, single-thread signatures, and visible shape. App
code now supplies real DOM/state values and callbacks, while the helper owns
the bounded snapshot shape used by later projection mismatch reports.
Single-thread full-render shell planning now also lives in
`public/thread-detail-render-plan.js`: loading, load-error retry, detail
content ordering, empty/read-warning state selection, plugin-refresh notice
placement, and operation-dock clearing intent are structured helper output
while app code keeps header/tile switching, real DOM writes, retry event
binding, hydration, and action binding. Single-thread full-render
bottom-follow planning now lives in `public/conversation-scroll.js` through
`planFullRenderScroll`: app code supplies near-bottom/user-reading/auto-hold
and follow-lease inputs, while the helper owns the final `stickToBottom`
decision and bounded reason for full conversation renders. Single-thread shell
conversation update input planning now also lives in
`public/thread-detail-render-plan.js`: early-shell and full-render shell paths
produce stable `updateConversationHtml()` inputs for HTML, conversation
signature, patch-shell signature, expected visible turn count, source, and
bottom-follow intent while app code keeps the real DOM update and retry/action
binding.
Thread detail click action recognition now
lives in `public/thread-detail-actions.js`: app code still owns event listener
wiring and business execution, but selector priority, root containment,
previewable-image detection, rich-content actions, task-card actions, approval
answers, and server-response action classification are covered by a focused
helper. Thread-tile interaction recognition now also lives in
`public/thread-tile-actions.js`: app code still owns event listener wiring and
business execution, but pane selection, switch-menu actions, pane-count/close
controls, bottom jump, operation toggles, scroll targets, and drag/drop target
classification are covered by a focused helper. The first pane-state slice now
lives in `public/thread-tile-state.js`: pane count normalization, pinned id
dedupe/order, selected pane fallback, split-pair updates, display-settings
payload/application, active-id sync, and pane-local operation bubble
dwell/expiry/mode/signature rules are pure policy. Operation/command detail
mode toggle planning is also in that helper: enabled/missing-id checks,
compact/expanded transitions, selected-pane intent, and pane patch intent are
computed as a bounded effect plan while app code keeps the real Map write and
DOM patch execution. Operation dock render-branch planning is also in that
helper: live-operation rendering, remembered-bubble reuse, expired remembered
state cleanup, and no-content states are explicit actions while app code keeps
HTML rendering, timer scheduling, and Map deletion. Operation card content and
final card-template planning now live in `public/live-operation-dock-state.js`:
title/detail/status visibility, empty-detail state, duration visibility,
class-token decisions, section/meta/detail/duration HTML structure, injected
escaping, and bounded duration data-attribute filtering are helper-owned while
app code keeps item extraction, duration computation, render-key selection, and
real DOM insertion. Pane-local detail refresh
planning is now also in that helper: refresh timer scheduling, refresh target
selection, and detail-load skip/background/loading decisions are explicit
plans. Detail-load lifecycle side-effect planning is also in that helper:
start/success/error/finally phases emit controller, loading, cache, error, and
render intent while app code keeps AbortController and network execution. Pane slot mutation planning is also in that helper: pane thread
replacement, duplicate swap, drag reorder, up/down split-pair placement,
thread-list-open replacement, and drop-zone intent are explicit plans. Pane
count/close planning is now also in that helper: count bounds, unchanged
detection, close eligibility, pinned slot fill, scroll-reset ids, and
selected-pane fallback are pure policy. Active pane sync planning is also in
that helper: active pane ids, pinned slot sync, split-pair prune, selected-pane
fallback, and display-settings save eligibility are computed as one policy.
Explicit selected-pane action and side-effect planning now emits the
previous/next pane patch set, draft save/restore intent, Composer refresh, and
patch fallback policy. Candidate pane id planning also now lives there: visible pinned
filtering, default-candidate fallback, layout-selector delegation, and current
thread replacement are computed as one policy. Switch-menu option/control
planning also now lives there: current/active/running/visible thread option
ordering, menu open/closed skip reasons, and close/add control eligibility are
computed as one policy. Pane slot mutation side-effect planning also now lives
there: replace/select, move, split, thread-list replace-last, pane count, and
close-pane actions emit one bounded effect plan for draft save/restore,
selection fallback, settings persistence, active id refresh, detail load, pane
patch, scheduled full render, or board render while
`public/app.js` keeps DOM,
rendering, network save, timers, API reads,
AbortController ownership, draft restore, and other
side effects. Detail-load queue, stale-controller abort planning, and queue
drain scheduling now also live there: active pane ids, controller ids, loading
ids, max concurrent load slots, abort ids, load ids, deferred ids, active pane
drain eligibility, and drain delay are computed as bounded plans while
`public/app.js` keeps real AbortController aborts, timers, and network
execution. Runtime detail reads are now capped separately from visible pane
count, so wide screens can still show more panes without starting every large
thread detail read at once.
App code can no
longer fall through from tile mode into the
single-thread patch path without an explicit policy decision, fall through from
a successful tile pane patch into full conversation render, silently choose
turn-level patch actions inside the application loop, inline the local-patch
scroll-completion policy, own the visible-item patch operation loop, or own the
turn-level patch operation loop, insertion anchoring loop, or turn article
render-key lookup selector, creation step, hydration callback sequence, live
text item render-key lookup / HTML patch sequencing, or
single-thread full-render shell selection, conversation click-action selector
priority, nor own the basic pane-state
normalization, pane-local operation-bubble state rules, operation card content
and final template planning, or keyed DOM child reconciliation.

Target:

- Continue extracting thread detail merge/state and DOM patch application rules
  from `public/app.js` into pure helper modules. The surface decision is now
  outside app.js, the refresh outcome decision is now outside app.js, and the
  turn-level patch action plan, local patch scroll-completion policy, and
  visible-item and turn-level patch operation loops are now outside app.js;
  turn article anchoring and render-key lookup are also outside app.js; turn
  node creation is now outside app.js for turn article insert/replace paths;
  hydration orchestration is now outside app.js for thread detail surfaces;
  live text item DOM patch sequencing is now outside app.js for streaming
  assistant/plan updates; keyed DOM child reconciliation and `patchHtml`
	  parsing/execution are now outside app.js; single-thread full-render shell
	  planning and shell update input planning are now outside app.js;
  click-action recognition is now outside app.js for conversation surfaces;
  thread-tile interaction recognition is now outside app.js for tile surfaces;
  core thread-tile pane-state normalization and operation bubble signature/
  dwell/mode policy are now outside app.js. Operation/command detail mode
  toggle planning and operation dock render-branch planning are now also
  outside app.js. Pane-local detail refresh planning, pane slot mutation
  planning, pane count/close planning, and active pane sync planning are now
  outside app.js; explicit selected-pane action/effect planning is also outside app.js; candidate pane id planning is also outside app.js;
  switch-menu option/control planning is also outside app.js;
  pane slot mutation side-effect planning including pane count/close execution
  is also outside app.js; detail-load lifecycle side-effect planning is also
  outside app.js; detail-load queue/abort/drain planning is also outside app.js;
  refresh, first-paint, and full-backfill performance event field ownership is
  also outside app.js;
  operation card content and final template planning are now outside app.js;
  split sizing, measured tuning of the max concurrent detail read
  value, and per-pane draft/runtime ownership remain the next boundary.
- Keep `public/app.js` responsible for DOM wiring, patch application, and event
  binding only.
- Cover user-message echo convergence, live receipt preservation, completed
  receipt authority, task-card folding, and diagnostic item rendering with
  focused tests.

### Phase 3: Thread Detail Read Orchestration

Status: in progress. The first slice extracts the `/api/threads/:id` branch
ordering into `adapters/thread-detail-read-orchestration-service.js` while
preserving the existing first-paint contract and read strategy. The second
slice addresses the first measured large-session cold-path issue: full dynamic
projection state was fast while the server process lived, but was not persisted
with refreshed rollout stats, so a service restart could miss disk cache and
fall back to full `thread/read` on large rollouts. A follow-up production
restart check showed active external writers can still advance rollout size
between cache persistence and restart, so large rollout projection misses now
use bounded `thread/turns/list` for the current visible window before trying
full `thread/read`. The current slice makes that large-rollout gate independent
from projection-cache input availability: if projection input cannot be built
but the thread summary still carries a rollout size at or above
`CODEX_MOBILE_THREAD_DETAIL_TURNS_LIST_FIRST_BYTES`, the coordinator uses
`turns-list-large` and records the decision source/reason in
`mobileDiagnostics.threadDetailTimings`. The latest slice adds a separate
recent-only warm path: if `mode=recent` misses projection and succeeds through
`turns-list-initial`, the coordinator seeds a memory-only partial
`recent-window` projection; later `mode=recent` reads pass `allowPartial` and
can return `projection-v4-partial` without another app-server turns-list read.
The newest slice turns projection cache lookup into an explicit `{ cached,
missReason }` contract so production first-paint evidence can distinguish
missing entries, partial-not-allowed, unavailable signatures, static signature
mismatch, dynamic summary staleness, and dynamic signature mismatch. It also
cleans up unusable stale full disk cache entries when a recent partial seed
proves the old full cache is no longer reusable through `dynamic-summary-stale`
or signature mismatch, so service restarts do not re-read the same invalid full
projection. This slice extracts the large-session bounded-read decision into
`adapters/thread-detail-bounded-read-policy-service.js`: `server.js` now only
supplies the configured threshold and summary rollout-size resolver, while the
pure service owns projection-vs-summary size priority, `>=` threshold
semantics, disabled/no-size behavior, and bounded decision source/reason
metadata.

- The coordinator owns summary resolution, hidden-thread rejection, projection
  hit, `mode=recent` initial turns-list, full `thread/read`, turns-list
  fallback, summary fallback, and bounded timing aggregation.
- `server.js` now supplies the concrete Codex app-server reads, compaction,
  projection seed, fallback shaping, and JSON transport response only.
- Focused tests cover warm projection, full `thread/read` before turns-list
  fallback, recent initial turns-list, timeout fallback, and hidden-thread
  rejection without relying on route source-string assertions.
- Full non-partial dynamic projections are now persisted with throttling and
  refreshed rollout size/mtime before write. Partial notification-only shells
  are still not persisted as valid detail cache.
- Large rollout projection misses use a server-side bounded turns-list current
  window and seed projection from that result. This keeps the first response
  authoritative for the current retained window without adding a frontend
  second-refresh replacement path.
- Large rollout protection now uses a structured decision with
  `readDecision`, `projectionState`, `projectionInputAvailable`,
  `projectionSource`, `projectionVersion`, `projectionAgeMs`,
  `projectionMissReason`, `projectionSeedStatus`, `projectionSeedSource`,
  `largeReadProtected`, `largeReadRolloutSizeBytes`,
  `largeReadThresholdBytes`, `largeReadSource`, and `largeReadReason` in the
  thread-detail timing diagnostics. This lets
  cold-open evidence distinguish projection hit, projection miss, unavailable
  projection input, projection-sourced large read, summary-sourced large read,
  projection seeding from bounded turns-list/full read, below-threshold,
  disabled, and no-rollout-size decisions without logging message bodies or
  raw thread data.
- `mode=recent` can seed and reuse a memory-only partial projection. Partial
  projections carry `partial:true` / `partialKind:recent-window`, are only
  returned when the coordinator explicitly passes `allowPartial`, are never
  persisted to disk, and cannot overwrite a reusable full projection cache.
  A stale full cache whose signature no longer matches must not block the
  recent partial warm path.
  The v4 projection wrapper must pass those seed/get options through to the
  base projection cache; otherwise production v4 would turn a recent window into
  an incorrect full `projection-v4-cache`. This optimizes repeated recent opens
  of large sessions without presenting a bounded current window as
  authoritative complete history.
- Cursor-backed `turns-list*` windows are now treated as partial projection
  state even if the seeding caller forgot to pass `partial:true`. The projection
  cache also drops legacy disk entries that persisted such a window as a full
  dynamic cache, so `mode=full` cannot reuse a recent/current turns-list window
  as `projection-v4-dynamic`.
- Notification-only partial shells without a projection signature are not valid
  thread-detail hits, even when a `mode=recent` caller permits partial cache.
  They may carry transient status patches, but they must not render as an empty
  current thread.
- Active/running summaries require a full `thread/read` path. `mode=recent`
  skips partial projection hits and `turns-list-initial` for those summaries,
  and the large-session bounded-read gate is disabled with
  `largeReadReason=active-thread-requires-full-read`. This preserves active
  turn intermediate items that `thread/turns/list` can omit.
- Projection cache lookup now reports bounded miss reasons and may delete a
  stale full disk entry only when the existing full cache is proven unusable by
  `dynamic-summary-stale` or a signature mismatch reason. It does not delete
  healthy full cache and does not persist partial recent windows to disk.
- Client-side large-session performance events now classify thread-detail
  cold/warm phases from bounded server fields when the server phase is absent
  or `unknown`. `public/thread-performance-metrics.js` owns the client
  `classifyThreadDetailPhase()` policy for projection hits, projection partial
  hits, initial turns-list reads, seeded partial windows, large bounded
  turns-list reads, full `thread/read`, raw reads, turns-list fallback, and
  summary fallback. This keeps `thread_detail_first_paint`,
  `thread_refresh_ms`, and `thread_detail_full_ready` evidence interpretable
  without changing the server read path or logging private message/task-card
  content.
- Preserve the first-paint contract for large sessions. Do not introduce
  deferred incomplete detail enrichment as a UI fallback for server cold-path
  slowness.

Remaining target:

- After deployment, verify restart/cold-open paths for both static and actively
  advancing large threads. Expected first detail result should be either
  disk-backed projection, `turns-list-large`, or a first recent
  `turns-list-initial` that seeds `seeded-partial`; a repeated recent open
  should be able to return `projection-v4-partial` with `threadReadMs=0` and no
  app-server turns-list timing. Full `thread/read` should only remain for
  small/non-rollout threads or bounded turns-list failure. Use `readDecision`,
  `projectionState`, `projectionMissReason`, `projectionSeedStatus`, and
  `projectionSource` first when deciding whether the next repair belongs to
  projection-cache seeding, summary rollout-size hydration, invalid full-cache
  lifecycle, or app-server read fallback.
- For thread-list cold/warm behavior, use `fallbackCacheDecision`,
  `fallbackCacheBuildCount`, `fallbackCacheBuildNumber`, and
  `fallbackCacheIncrementalUpdates` before changing cache invalidation. Normal
  refreshes should trend toward `hit` after the first process-lifetime baseline
  build; repeated `miss-rebuild` or `expired-rebuild` is the evidence needed
  for the next cache-boundary repair.

### Phase 3b: Task-Card Protocol Runtime

Status: in progress. The terminal return-card and interruption-safe lease
foundations are already in place: return/no-op cards are terminal by default,
manual `return_to_source` cards are source-direct approved, automatic
autonomous completion returns are idempotent, and non-terminal work cards carry
active execution leases so ordinary user interruptions do not silently abandon
work.

The latest slice wires terminal return cards into Home AI Autonomous Delivery
Loop state tracking. When a terminal return closes an original non-terminal
work card, Codex Mobile emits one bounded Home AI event with original card id,
return card id, return status, bounded title/summary, original source/target
thread ids, workflow id, `terminal:true`, and `ackPolicy:"none"`. This is
protocol observation only. It does not create repair cards, request
acknowledgement, or block normal terminal return-card delivery. Unknown Home AI
task-card ids are recorded as bounded `unknown_task_card` audit status on the
return card.

Remaining target:

- Keep return-card delivery and Home AI delivery-loop event reporting separate:
  return-card generation/injection must remain authoritative even if Home AI's
  event endpoint is unavailable.
- Continue hardening active task-card lease queueing, pause/cancel/resume
  affordances, same-workspace routing, archived-target rejection, and manual
  return-path visibility with executable tests.

### Phase 4: Browser And Visual Coverage

Target:

- Add DOM/browser smoke coverage for mobile composer stability, conversation
  patch jitter, task-card expand/collapse, uploaded/generated image rendering,
  and PWA refresh behavior.
- Prefer evidence-driven fixes over client-only duplicate filtering or visual
  masking.

Current diagnostic intake bridge:

- v441 closes the remaining thread-tile local-patch signature boundary.
  Current-thread refreshes and SSE-driven local item patches now route through
  `patchCurrentThreadTilePaneFromState` when the active DOM is a thread-tile
  board. The tile pane renderer owns the DOM patch and writes back the
  `threadTileRenderSignature`; single-thread paths remain unchanged. This
  prevents metadata-only refreshes from leaving a tile DOM paired with a
  single-thread rendered signature.
- v440 narrows conversation projection mismatch diagnostics to the active
  rendering surface. Single-thread mode compares against
  `conversationRenderSignature`; thread-tile mode compares against
  `threadTileRenderSignature`; transition frames where state and DOM surface do
  not match are skipped. This keeps the diagnostic channel sensitive to real
  projection/DOM divergence without reporting the expected difference between a
  tile-board signature and a single-thread signature.
- v439 adds `public/home-ai-diagnostic-reporting.js` as the browser-side
  repeated-failure state machine for Home AI's diagnostic remediation loop.
  It gates automatic reports by stable privacy-preserving signatures, clears
  counters on success, throttles repeated reports, and sanitizes all payloads
  before `homeai.diagnostic.report` is posted to the Home AI parent frame.
- Initial probes cover task-card workflow failures, thread/session load and
  route-hint failures, visible media render failures, and conversation
  projection consistency anomalies such as render-signature mismatch or
  duplicate DOM render keys.
- This is evidence capture, not a UI fallback. It must not filter duplicate
  messages, synthesize missing messages, auto-refresh to hide projection bugs,
  or auto-dispatch repair cards. Home AI owns case dedupe, Owner notification,
  and Owner-triggered repair-card dispatch.

### Phase 5: User-Managed Split Reading

Target:

- Evolve the current explicit `单线程` / `平铺` display setting into a
  split-screen reader where the user can add panes, close panes, drag widths,
  decide how many threads stay visible, and type into each pane through a
  pane-local composer.
- Current interim state: v427 persists `单线程` / `平铺`, ordered pane thread ids,
  selected pane thread id, and desired pane count in server runtime
  `settings.json` `threadDisplay`. Device width decides the automatic
  recommended capacity only; `paneCount=0` keeps an automatic
  current/running-thread-based count, and the pane title menu lets the user
  expand or close visible panes without reordering unrelated slots. Explicit
  user-added panes can exceed the recommended viewport capacity. Layout uses
  browser CSS viewport width, not display physical pixels; automatic mode keeps
  the wider default pane width, while manual mode derives pane width from the
  requested pane count and current available CSS width. Wide desktop screens
  keep five or six requested panes in one row when the CSS width allows it;
  after the requested pane count exceeds physical column capacity, overflow panes
  are packed into existing columns as local up/down splits instead of creating a
  sparse second full row. v431 adds persisted `paneSplitPairs`: dragging a pane
  title onto another pane can either move the pane before/after the target or
  pair the two panes into one vertical split column. When the user explicitly
  opens a non-visible thread from the outer thread list, the last visible pane is
  replaced and that slot order is saved; background recent ordering still cannot
  move fixed panes.
- Keep the current automatic tile policy as the interim capability gate for
  iPad/desktop width, not as the final interaction model. Manual pane count is
  now the owner of "how many windows should be visible" until draggable split
  sizing exists.
- Preserve action ownership: v417 routes the shared bottom Composer's
  draft key, send target, Stop/steer state, local echo, and failure receipt to
  the selected active pane, operation bubble state is pane-local, and pane
  title thread switching replaces only that pane's slot. Pane header run state
  should reuse the single-thread `turn-timer` state/render vocabulary, and
  title/menu pointer handling must not re-render the pane before click opens
  the switch menu. Future work should continue that ownership model instead of
  falling back to the first/current global thread.
- The first dedicated pane-state helper now exists in
  `public/thread-tile-state.js` for pane count, pinned ids, split pairs,
  selected pane, display settings, active-id sync, and operation bubble
  dwell/expiry/mode/signature policy. It also owns refresh timer planning,
  refresh target selection, detail-load skip/background/loading decisions, and
  pane slot mutation planning for thread replacement, drag reorder, up/down
  split, thread-list-open replacement, pane count/close planning, pane
  count/close side-effect execution planning, and selected-pane fallback. Active
  pane sync planning also now lives there,
  including active ids, pinned slot sync, split-pair prune, selected-pane
  fallback, and display-settings save eligibility. Explicit selected-pane
  action planning also now lives there, including skip reasons and previous/
  next pane patch ids. Candidate pane id planning also now lives there,
  including visible pinned filtering, default-candidate fallback,
  layout-selector delegation, and current-thread replacement. Switch-menu
  option/control planning also now lives there, including current/active/
  running/visible option ordering and close/add control eligibility. Pane slot
  mutation side-effect planning also now lives there, including draft/
  Composer/settings/detail-load/render intent for replace/select, move, split,
  thread-list replace-last, pane count, and close-pane actions. Selected-pane
  side-effect planning also now lives there, including draft/Composer/patch
  intent for active pane changes. Detail-load lifecycle side-effect planning
  also now lives there, including start/success/error/finally state/render
  intent. Continue moving pane widths, per-pane drafts, max concurrent detail reads, pane-local
  send/approval/interrupt ownership, command detail panels, and mobile collapse
  behavior into testable helpers without DOM side effects.
- Treat each pane as a scaled mobile single-thread runtime instance. Shared
  global Composer chrome is only an interim input surface; global command dock
  or shared operation bubble are no longer acceptable in tile mode and must not
  be considered closure for the split-screen feature.

## Release Rule

Follow the current release order:

1. Implement and validate locally.
2. Deploy to Mac production only after the user asks for deployment.
3. Push or sync Public only after production/user validation.

Do not publish `.agent-context`, runtime state, local keys, upload contents,
full rollouts, access keys, launch tokens, private logs, or machine-specific
diagnostics.
