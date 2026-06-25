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

Status: in progress. The latest slice adds bounded `detailShape` counts to
thread-detail performance events, so large-session investigations can compare
server phase timings with client render/merge timings and visible item shape
without collecting message bodies or file contents.

- Keep large-session timing evidence in `mobileDiagnostics.threadDetailTimings`
  and client `performancePhase` events. Client events now also carry
  `detailShape` counts for turns, items, visible items, image items, operation
  items, receipt items, usage items, diagnostics, and completed/active turns.
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
and prevents local patch attempts when the currently rendered DOM signature is
already stale. Thread/turn-level merge orchestration now lives in
`public/thread-detail-merge-state.js`: it coordinates v4 projection delegation,
incoming turn merge, stale mobile load flag cleanup, active live-turn retention,
expanded-history preservation, and initial-submission echo cleanup while
`public/app.js` supplies item-level merge and DOM/runtime glue. Visible-item
refresh patch planning now lives in `public/thread-detail-patch-plan.js`: it
classifies shape-preserving updates into reuse/patch/insert operations and
rejects reorder/removal/invalid-entry cases before DOM work starts. DOM patch
application still remains in `public/app.js`.

Target:

- Continue extracting thread detail merge/state rules from `public/app.js` into
  pure helper modules, with DOM patch application as the next remaining
  boundary.
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
full `thread/read`.

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
- Preserve the first-paint contract for large sessions. Do not introduce
  deferred incomplete detail enrichment as a UI fallback for server cold-path
  slowness.

Remaining target:

- After deployment, verify restart/cold-open paths for both static and actively
  advancing large threads. Expected first detail result should be either
  disk-backed projection or `turns-list-large`, with `threadReadMs=0`; full
  `thread/read` should only remain for small/non-rollout threads or bounded
  turns-list failure.

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
- Add a dedicated pane-state helper before expanding `public/app.js`: pane ids,
  widths, ordering, active pane, per-pane drafts, max concurrent detail reads,
  pane-local send/approval/interrupt ownership, command/operation bubble state,
  command detail panels, and mobile collapse behavior should be testable
  without DOM side effects.
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
