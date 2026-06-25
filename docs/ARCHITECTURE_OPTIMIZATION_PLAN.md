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
  thread history.
- Keep thread-list fallback cache evidence in
  `mobileDiagnostics.threadListTimings`. The cache now reports
  `fallbackCacheDecision` (`hit`, `miss-rebuild`, `expired-rebuild`), bounded
  cache key hash, cache age/update age, build count/number, entry count, and
  incremental-update count. These fields prove whether an observed slow list
  load is a first baseline build, TTL expiry, cache miss, deferred fallback, or
  warm in-process reuse.
- Move deterministic completed-turn diagnostics out of `server.js` into a
  service module.
- Preserve the rule that explicit empty final assistant messages produce
  `turnDiagnostic` / `runtime_completed_without_response`, not a synthetic
  `agentMessage`.

### Phase 2: Frontend State Ownership

Status: in progress. The first slices extract item visible-field merge policy,
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
Refresh patch execution planning now also lives in
`public/thread-detail-render-plan.js`: `planThreadDetailRefreshPatchExecution`
owns whether a thread refresh should try tile-pane patch, whether
single-thread local patch is eligible, whether a metadata-only tile miss should
update metadata without full render, and which fallback action applies. App code
keeps real DOM patch attempts, metadata writes, full render execution, and
diagnostic/performance reporting.
Refresh outcome execution planning now also lives in the same helper module:
`planThreadDetailRefreshOutcomeExecution` maps render outcomes to metadata
update mode, full-render execution, and projection-consistency phase. This
keeps `refreshCurrentThread()` from inlining `refreshRenderAction` branching
after the render outcome is known.
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
decision and bounded reason for full conversation renders.
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
  planning is now outside app.js;
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
  `projectionSeedStatus`, `projectionSeedSource`, `largeReadProtected`,
  `largeReadRolloutSizeBytes`, `largeReadThresholdBytes`, `largeReadSource`,
  and `largeReadReason` in the thread-detail timing diagnostics. This lets
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
  `projectionState`, `projectionSeedStatus`, and `projectionSource` first when
  deciding whether the next repair belongs to projection-cache seeding, summary
  rollout-size hydration, or app-server read fallback.
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
