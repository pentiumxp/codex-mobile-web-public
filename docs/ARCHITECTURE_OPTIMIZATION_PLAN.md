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
   The current active-detail response-size slice closes a later proof-gated
   payload gap rather than changing the proof gate: live overlay turns were
   merged into already compacted projection results after response compaction,
   so raw MCP tool arguments/results and long operation payloads could survive
   in `projection-active-overlay` responses. Read orchestration now injects the
   existing server `compactTurn()` policy into the overlay merge seam, with
   `MAX_LIVE_OPERATION_ITEMS` live-operation retention. MCP and dynamic tool
   calls are counted as operation evidence, and the merged detail response
   contains only compact operation metadata. This is the closure path for the
   observed 500KB-900KB active-overlay responses; if latency remains high after
   deployment, the next owner is earlier active-overlay snapshot normalization
   or projection work, not client de-duplication.
   The follow-up response-budget slice handles the next measured shape: Home AI
   and Movie detail requests could return quickly at the HTTP layer but still
   deliver 340KB-380KB responses, because ordinary projection detail responses
   carried many completed-turn operation/reasoning items and every detail
   response attached full historical task-card bodies. The root-cause fix is
   server-side response budgeting, not client refresh masking:
   `thread-detail-response-budget-service` trims operation/reasoning tails and
   rebuilds v4 visible keys, while task-card lists now carry summary metadata
   only and load full card bodies through `GET /api/thread-task-cards/:id` when
   the user expands a card. Later first-paint byte slices keep the same service
   boundary for task-card metadata: when active progressive response budgeting
   has already protected all visible items but the detail JSON is still over
   the active first-paint ceiling, task cards are reduced to an action-safe
   first-paint shape that keeps pending-card buttons and minimal
   workflow/source/target/message metadata while the single-card detail endpoint
   remains authoritative for full card details. Settled non-actionable cards
   can be reduced further to id/status/thread-role placeholders because the
   thread-detail renderer only exposes pending target cards for action.
   The follow-up active-detail hot-path slice keeps that same proof gate but
   changes the common active window source. A naive reuse of the active dynamic
   projection regressed production because the lookup still cloned/normalized
   the currently growing live turn; that attempt was reverted. The corrected
   path lets active-overlay projection lookup pass `omitActiveTurnId`, so the
   cached partial projection window is cloned without the live active turn and
   the provider's clone-free active-overlay snapshot is merged separately after
   proof. Production readback then showed `threadReadMs=0`,
   `turnsListMs=0`, and `activeOverlayWindowMs=0`, but still kept
   `activeOverlayMs` around the one-second range because the active-overlay
   retry was still routed through full projected-detail response assembly. The
   next correction splits a dedicated lightweight
   `activeOverlayProjectionWindowLookup`: it uses the same proof-gated cache
   semantics, passes `skipNormalizeResult` through v4 projection lookup, and
   returns only the projection window needed for the overlay proof/merge. A
   later timing readback showed this lookup itself was effectively zero-cost;
   the remaining one-second `activeOverlayMs` came from using `await` on the
   synchronous active-overlay provider, which let the event loop process other
   active-session work before continuing the detail response. Read orchestration
   now only awaits promise-like provider results; synchronous provider output
   continues in the same call stack. The provider also caches bounded
   active-turn evidence counts for repeated reads of the same active turn
   shape; this keeps proof-gate evidence out of the request hot path without
   caching message text, tool payloads, uploads, or private content.
   `turns-list-active-overlay-window` remains a fail-closed fallback only when
   no usable projection window exists.
   A later production timing sample on a roughly 392MB active Codex Mobile
   session explained the new "long spinner but eventual success" shape:
   the first detail open after the active-window cache was cleared spent about
   1.3 seconds in `activeOverlayWindowMs`, while repeated reads immediately
   returned with `activeOverlayWindowMs=0`. That is not the older timeout
   failure; it is a synchronous active-window rebuild from app-server
   on the first read. A later active Codex Mobile sample showed a different
   warm-path peak: `activeOverlayWindowMs=0`, `prepareResponseMs` around
   35-45ms, but `activeOverlayMs` still around 1.8-3.0s. The owning layer was
   local active-overlay backfill merge, not app-server RPC. The backfill helper
   was deep-cloning every active-window and live-overlay item with
   `JSON.stringify` before merging, so large command/assistant payloads paid a
   repeated CPU serialization cost even when the overlay proof itself was
   ready. The root-cause fix is to keep top-level result immutability while
   using shallow item copies for the merge and to expose
   `activeOverlayBackfillWindowMs`, `activeOverlayFullProjectionMs`, and
   `activeOverlayHistoryBaselineMs` through detail diagnostics / Phase-B
   readback so future peaks are attributable instead of hidden under
   `activeOverlayMs`. The next residual showed that the remaining peak was not
   the merge helper itself but the orchestration rule that treated every
   `projection-live` overlay as requiring a fresh app-server active-window read.
   The corrected rule only forces that read for partial, notification-shell,
   missing-signature, or otherwise incomplete live overlays. Complete signed
   live overlays can reuse the projection cache; partial projection windows
   still repair history from the local full projection baseline instead of
   weakening the evidence gate.
   A later Phase B sample exposed another active-window ordering gap:
   `turnsListInitialMs` dominated while the response still ended as
   `projection-active-overlay` with `activeFullReadReason=initial-window-active-turn`.
   In that shape, summary state missed active status but the live overlay
   provider already had a concrete active turn. Read orchestration now uses that
   live overlay preprobe to try the dedicated `turns-list-active-overlay-window`
   before generic `turns-list-initial`, so active evidence is proved through the
   active-window path first and repeated reads can seed/reuse the active-window
   projection cache.
   `thread/turns/list`. The follow-up server slice adds
   `thread-detail-active-window-prewarm-service`: turn/status notifications and
   thread-list refreshes now schedule a deduplicated background
   `turns-list-active-overlay-window` prewarm for active/running threads. The
   prewarm reuses the same projection-window lookup, turns-list read, and
   partial projection seed path as the detail route. Overlay revision/timestamp
   metadata is used when the live overlay already exists, but the history window
   can be preseeded before overlay turn evidence is available. It skips
   non-active summaries and already-cached windows, and stores only bounded
   status metadata. This does not loosen the active-overlay proof gate; it
   moves the expected window build out of the user-visible first-detail request
   whenever the notification/list path has enough time to prewarm it. The
   `turn/started`, `turn/completed`, and active `thread/status/changed`
   notification-triggered prewarm path now starts with zero delay and bypasses
   the recent-attempt throttle, because the client often refetches detail
   immediately after receiving the same turn/status notification. Notification
   jobs can preempt older pending thread-list prewarm so a stale ordinary job
   cannot block completion-boundary active-window repair; thread-list batch
   prewarm remains delayed and throttled. The
   follow-up active-overlay policy fix treats that preseeded window as
   history-only evidence: its projection revision cannot mark the separately
   supplied live active-turn overlay stale, while ordinary projection windows
   still keep the stale assistant-delta fail-closed rule.
   A later production log sample showed most background prewarm attempts from
   `thread-list:warm_fallback_*` skipping with `projection-input-unavailable`:
   the fallback row proved active status but did not carry enough rollout-path
   and stat evidence for a projection signature. The prewarm coordinator now
   treats that as an incomplete-summary case, refreshes the canonical summary
   once, and retries projection input before skipping. This keeps ownership at
   the projection-input boundary and avoids moving the same app-server
   active-window read back into the foreground detail request.
   A later runtime sample showed a remaining cold-path gap: background prewarm
   and the foreground first detail open could race and both start the same
   `turns-list-active-overlay-window` app-server read for one active thread.
   The coalescing slice adds
   `thread-detail-turns-list-read-coalescer-service`, injected into both the
   prewarm coordinator and the detail orchestrator. It shares only in-flight
   reads for the same thread/mode/limit, logs `turns_list_coalesced` for
   joiners, returns cloned JSON results to each caller, and clears failures so
   retries are normal. Runtime evidence later showed the same slow-success
   shape for ordinary cold `turns-list-initial` reads on the current Codex
   Mobile thread, where repeated foreground refreshes each spent roughly
   `1.5-2.5s` in app-server window reads before the projection warmed. The
   generic coalescer therefore also covers `turns-list-initial` and
   `turns-list-large` no-warning reads. This removes duplicate cold work without
   changing active-overlay proof gates, projection cache semantics, or
   cross-thread concurrency. Residual latency after this slice is the single
   authoritative app-server window read or a prewarm/projection-readiness issue.
   The startup-readiness follow-up connects `thread-list-fallback-prewarm` to
   this path: when the process fallback baseline completes, its already-read
   active thread summaries are passed through an internal hook to schedule
   active-window prewarm. The hook does not alter public fallback status or
   expose private row data; it only starts the existing bounded active-window
   prewarm earlier after restart. Startup fallback prewarm now defaults to
   zero delay after listener start while retaining the active-detail-in-flight
   defer/retry guard.
   The stale-full-history follow-up handles a remaining successful-but-slow
   case after process restart or active-turn growth: a full projection may still
   contain a valid history window, but the ordinary signature check rejects it
   because rollout size/mtime moved with the current active turn. Only explicit
   active-overlay partial lookups with `omitActiveTurnId` may downgrade that
   full entry into a history-only `turns-list-active-overlay-window`; ordinary
   lookups and resting threads keep rejecting the mismatch and reseed through
   the authoritative app-server path.
   Once that history-only active-window cache is seeded, its comparable
   signature also ignores active-turn rollout size/mtime movement after an
   exact hash miss. The live active turn is supplied by the overlay proof seam,
   so active growth alone should not force the history window to be rebuilt;
   `turn/started` and `turn/completed` remain the explicit boundary events that
   clear and repair that window.
   A follow-up closes the foreground/prewarm contract gap where background
   prewarm could report `active-window-already-cached`, but the active-summary
   foreground detail path still looked up the projection window without
   `omitActiveTurnId` and rebuilt `turns-list-active-overlay-window`. The
   orchestrator now retries the dedicated active-overlay projection-window
   lookup with the live active turn omitted after an initial active-window miss.
   If that history-only retry succeeds and the live overlay evidence is already
   complete, the foreground merge uses the cached history rows directly instead
   of paying a fresh active-window backfill read.
   The history-baseline follow-up handles the related restart race where the
   active notification stream reaches the process before the warm full
   projection has been loaded into memory. The projection service now restores a
   persisted full projection before applying `turn/started` / active item
   notifications, then keeps that process-local full history baseline available
   for the active-overlay proof gate. Notification-only shells still cannot
   become normal detail authority, and partial active-window state is still not
   persisted.
   The next measured detail-shape problem was not timeout or window proof: after
   `threadReadMs=0`, `turnsListMs=0`, and `activeOverlayWindowMs=0`, active and
   recently completed detail responses could still carry dozens of intermediate
   `agentMessage`/`plan` items. That makes the successful response large enough
   to look like a long stall on mobile and increases DOM merge pressure. The
   response-budget v2 slice originally used a server-side assistant item
   budget for the current turn. That was corrected after production evidence
   showed active/latest replay turns could lose user-visible intermediate
   assistant progress. Current active turns and the latest completed replay now
   protect assistant/plan progress rows; operation/reasoning rows and oversized
   text/payload fields remain the first-paint budget owners. This is a
   payload-owner fix, not a client-side refresh fallback.
   The following projection-hit slice addresses a different warm-path cost:
   repeated `projection-v4-cache` / `projection-v4-dynamic` opens were still
   paying a whole-result v4 visible-item normalization pass even though cached
   v4 entries already store stable visible keys. The v4 wrapper now reuses
   normalized visible metadata when every retained item has complete v4 keys,
   refreshing only source/revision/read-mode and aggregate visible-key lists.
   The projection-result assembler also skips raw `thread/read` compaction for
   response-ready v4 hits with complete visible-key metadata. Delta-created or
   legacy items without visible metadata still fall back to full normalization
   and the normal compaction path, so this is a root-cause hot-path reduction
   rather than a display fallback.
   Full item-level expansion remains a separate future route/API slice if the
   product needs on-demand historical assistant progress, because the default
   detail route does not yet expose per-item expansion for omitted assistant
   progress rows.
   Post-v542 local pane-context work is intentionally smaller than these
   deployable Phase B modules: each slice fixes one frontend state writer,
   adds executable pane-local coverage, commits locally, and does not deploy
   until the compatible slices form a coherent runtime module. Pending server
   request arrival/update/completion is part of that boundary: a request or
   resolved-request notification from the server may omit thread metadata, but
   it must preserve the existing pane thread context already attached when the
   request was rendered or answered, and it must schedule the owning pane
   instead of falling back to the global current thread.
   Task-card pending counts follow the same rule: approving, replying,
   revoking, deleting, or draft-sending a card must update the owning pane
   detail, current detail, and thread-list mirrors from one count helper so the
   badge total and incoming/outgoing subcounts cannot drift across split-screen
   surfaces.
   Pane toolbar actions are also in scope: rollout-warning dismiss, compression
   continuation, and manual task-card creation must carry the owning pane
   thread id from rendered DOM into the action handler before invoking
   thread-specific behavior.
   Older-history pagination follows the same ownership rule: a pane-local
   history button or scheduled backfill must resolve the pane thread, fetch that
   thread's cursor, update that pane detail cache, and schedule pane-local
   render instead of mutating global `state.currentThread`.
   Continuation confirmation is fail-closed: once a compression-continuation
   dialog records a concrete source thread id, confirmation must resolve that
   thread from current detail, thread list, or visible tile details, and must
   not silently fall back to global current thread if the source disappears.
   Manual task-card creation uses the same pane ownership boundary: the source
   turn id must come from the source thread, and post-create refresh must target
   the source thread/pane rather than the global current thread.
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
   lifecycle, projection input, thread-list fallback baseline, final
   `cwd/search` filtering, fallback merge/dedupe pressure, limit-window
   truncation, cache freshness, or app-server fallback. The 2026-06-27 local
   readback routing follow-up keeps one-time cold-start rebuilds as H3 observe
   when the warm check proves the same key is already warm, but routes
   unresolved `final-filter*`, `merge-dedupe`, and `limit-drop` baseline
   reasons to distinct owner/nextAction labels. Its follow-up evidence-counter
   slice carries the same bounded final-filter, merge/dedupe, and limit-drop
   counts in `decision.evidence`, including deferred follow-up reads, so the
   selected next action is backed by numeric readback evidence instead of a
   label alone. After the active-detail proof gate became ready, the
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
   parsing rather than repeated per-row directory/tail scans. The startup
   prewarm slice then moves the existing process-lifetime fallback
   baseline/source snapshot build to a delayed background path after cold start
   or deploy restart. It uses `thread-list-fallback-prewarm-service`, is
   bounded and metadata-only, and does not change app-server authority,
   fallback merge/filter/limit semantics, persistence, frontend refresh, or
   repeated-rebuild diagnostics. If a thread detail request is in flight, the
   startup prewarm defers and retries instead of contending with first paint.
   The readback observability follow-up exposes the prewarm lifecycle as
   bounded `/api/public-config` metadata and folds it into the Phase B
   decision service, so a cold post-deploy list sample can be routed to
   prewarm failure, not-yet-completed timing, or cache-key/source-snapshot
   alignment instead of a generic fallback-baseline owner. The readback settle
   follow-up then samples `/api/public-config` before the first list read until
   prewarm reaches completed/failed or a bounded timeout, preserving both
   initial and settled metadata. This makes the module deploy gate prove
   whether a foreground cold list happened before or after startup prewarm
   rather than guessing from the list result alone. The `codex-mobile-shell-v534`
   module deploy/readback confirmed this boundary in production: prewarm
   completed, ordinary first thread-list read hit `warm-fallback-cache`, and
   targeted readback reused `fallback-source-snapshot` instead of scanning
   rollout source. The next local app-server-delay slice makes warm fallback
   initial shell explicit: the server can now read only an existing warm cache
   without building a fallback baseline, return it only for default
   `initial=warm-fallback` requests, and mark the result as
   `mobileDeferredAppServer` / `appServerDeferred`. The client then schedules a
   normal authoritative refresh. This moves already-warmed list data onto the
   first-paint path without hiding the later app-server merge. The follow-up
   app-server fetch-window slice then extracts the ordinary `thread/list`
   request limit into `thread-list-app-server-fetch-policy-service`. Default
   and search lists now use bounded overfetch (`max(limit * 2, 80)`) instead of
   the old unconditional 500-row window, while cursor pages stay exact and
   workspace/archived paths preserve the legacy 500-row window because their
   filtering semantics are not app-server-authoritative. The route and Phase B
   readback now expose `appServerRequestedLimit`, `appServerRequestLimit`,
   `appServerRequestReason`, and `appServerOverfetchFactor` as metadata-only
   diagnostics. The `codex-mobile-shell-v535` module deploy/readback confirmed
   the combined list-refresh boundary in production: public config reported
   v535, startup prewarm completed, the first list read reused
   `fallback-source-snapshot` or `warm-fallback-cache`, app-server request
   limit was bounded to `80`, and targeted active detail still returned
   `projection-active-overlay` with the active overlay gate `ready`. The same
   readback also exposed the next Phase B owner: even with an 80-row app-server
   window, `appServerMs` was still around 1.8-2.1s. The follow-up local
   attribution slice now splits that coarse field into `appServerRpcMs`,
   `appServerVisibleFilterMs`, `appServerWorkspaceFilterMs`,
   `appServerPostProcessMs`, measured/unattributed elapsed time, and
   raw/visible/filtered row counts, so the next production readback can
   distinguish mux/RPC/app-server latency from Mobile server post-processing
   without reading private thread content. The decision
   follow-up consumes the same split fields: high warm-list latency now routes
   to `app-server-thread-list-rpc`, `thread-list-visible-filter`,
   `thread-list-workspace-filter`, `mobile-thread-list-postprocess`, or an H3
   inconclusive-split observation instead of treating all warm/source-snapshot
   list reads as ready. The residual attribution follow-up adds
   `appServerMeasuredMs` and `appServerUnattributedMs`; if the unmeasured
   remainder dominates, readback now routes to
   `thread-list-app-server-attribution` / `split-thread-list-app-server-residual-timing`
   rather than guessing a runtime owner. These app-server attribution slices
   deployed as `codex-mobile-shell-v536`. Production readback showed
   `appServerMs=1939` with `appServerRpcMs=1853`, local filter timing at 86ms,
   and `appServerUnattributedMs=0`, so the next Phase B owner is
   `app-server-thread-list-rpc`, not fallback/prewarm or local filtering.
   The next local transport-diagnostics slice starts that owner path without
   changing runtime behavior: `CodexAppServerClient` now records bounded
   per-RPC metadata for the `/api/threads` app-server `thread/list` call,
   including transport kind, endpoint kind, endpoint protocol, attempt count,
   timeout/retry/timeout status, request payload bytes, request params bytes,
   and response payload bytes. Endpoint values are classified as
   `profile-mux-file`, `env-ws`, `env-tcp`, `managed-child`, or `external-*`;
   raw endpoint files, private paths, thread titles, prompts, task-card bodies,
   and response contents are not exposed. Phase B readback and decision
   evidence carry these fields so the next module deploy can determine whether
   high `appServerRpcMs` correlates with response size, retry/timeout behavior,
   or transport class before changing mux/app-server behavior. The follow-up
   mux metrics slice adds a read-only `mux/metrics/read` RPC inside
   `codex-app-server-mux.js` and exposes it only through
   `/api/status?muxMetrics=1`; it records method-level count, error count,
   total/avg/last/max elapsed time, and last request/response byte sizes for
   forwarded RPCs. The metrics are method-name and numeric only. Phase B
   readback samples them after `/api/threads`, so the next module deploy can
   compare Mobile-side `appServerRpcMs` with mux-side `thread/list` elapsed
   time without parsing mux logs or exposing request params/results.
   Those RPC/mux evidence slices deployed as `codex-mobile-shell-v537`.
   Production readback confirmed the Mobile listener and shell moved to v537
   and exposed the Mobile-side transport split: the first general sample used
   `profile-mux-file` / `jsonl-tcp`, one RPC attempt, no timeout, a 185-byte
   request payload, a 128-byte params payload, and a 235487-byte response
   payload while `appServerRpcMs` was 1705ms. A later targeted warm sample
   showed the same response payload with `appServerRpcMs=8ms` and active detail
   still on `projection-active-overlay`. The mux-side metrics read returned
   `mux-metrics-unsupported`; selected profile mux endpoint capabilities still
   lacked `muxMetricsRpc`, which means the running shared mux process did not
   restart into the newly deployed `codex-app-server-mux.js`. The local
   readback-decision follow-up now classifies high-RPC samples with unsupported
   mux metrics as `shared-mux-runtime` /
   `restart-selected-shared-mux-before-rpc-repair` before any app-server query
   semantics are changed. The next local slice closes the plugin-owned half of
   that runtime boundary: authenticated `/api/status` now exposes a sanitized
   endpoint kind, Phase B readback carries a metadata-only `muxRuntime` summary
   with capability booleans, and macOS shared-chain restart now stops only the
   selected profile mux/app-server PIDs recorded in that profile's endpoint file
   before deleting that stale endpoint. This does not change normal
   `/api/threads` behavior, but it makes manual restart capable of refreshing a
   version-stale selected mux. The remaining deploy-contract owner is Home AI
   central deploy: plugin source sync plus LaunchDaemon kickstart alone still
   does not invoke this selected-mux refresh path. Home AI has since repaired
   that central deploy contract for `plugin:codex-mobile-web`: when mux bridge
   or runtime files change, the deploy plan refreshes only the currently
   selected profile mux after source sync and plugin host restart. Codex Mobile
   module `codex-mobile-shell-v538` batched the selected mux runtime/readback
   slices with the local conversation DOM patch outcome telemetry slices. Its
   closure gate was production readback, not a query-semantic change. The final
   v538 readback now proves `muxRuntime.muxMetricsRpc=true` and
   `/api/status?muxMetrics=1` returns supported bounded mux metrics; the same
   sample reported `threadListMuxRpcCount=2384`,
   `threadListMuxRpcLastMs=7`, and Mobile-side `appServerRpcMs=9`.
   A deployment-contract gap remains in Home AI: after a prior post-sync repair
   failure, retry can see no source file diff and skip selected mux refresh
   while runtime is still stale. That has been routed to Home AI as task card
   `ttc_6bd6684e3319218f84`. Phase B can now use the mux evidence to compare
   Mobile-side visible filtering/post-process cost and thread-list merge cost
   before changing app-server query semantics.
   The next local Phase B slice therefore extracts route-level thread-list
   merge attribution without changing behavior: `thread-list-route-merge-service`
   wraps the existing `mergeThreadSummaryList` path and records bounded
   app-server/fallback/input/unique/duplicate/merged/output/limit-drop counts.
   Phase B readback and decision evidence now route dominant warm-list
   `mergeMs` to `thread-list-route-merge` / `route-merge-latency`, so future
   optimization can target duplicate pressure, limit-window behavior, or cached
   display-summary cost with evidence instead of changing app-server query
   semantics prematurely. The follow-up summary-merge attribution slice moves
   the existing `mergeThreadSummaryList` behavior behind
   `thread-list-summary-merge-service` and records bounded internal stage
   counters/timings: cached display summary, normalize/detail strip, duplicate
   display merge, title hydration, final hidden/subagent/archive filtering, and
   sort. Dominant route-merge decisions can now name the likely internal stage,
   for example `route-merge-latency:cached_display`, before any optimization
   changes row ownership or ordering. The follow-up request-context
   optimization is the first direct cost reduction on this path: `/api/threads`
   now shares archived ids, session-index entries, and cached display-summary
   reads within one request. This removes repeated archived-session scans,
   repeated title-hydration reads, and duplicate-id cached-summary reads while
   preserving all row merge, ordering, hidden/subagent/archive, fallback cache,
   and app-server query semantics. A follow-up request-context rollout-stat
   slice adds one more direct reduction: `annotateThreadRolloutStats`,
   visible filtering, cached display-summary merge, and duplicate display merge
   now share the same request-scoped `rolloutStatsForPath` reader. This only
   deduplicates synchronous file metadata reads for identical rollout paths
   inside one `/api/threads` request; rollout-tail status evidence remains on
   the existing authoritative fallback/status path. Phase B readback now
   carries only bounded request-context read counts so production can prove
   whether the request used one shared archive/session-index read, how many
   unique cached display summaries were read, and how many unique rollout stat
   paths were read, without exposing titles, paths, prompts, or logs. The next
   rollout fallback status slice keeps the same authority boundary: the
   fallback summary reader stores the already verified `fs.Stats` on the
   in-memory thread row as non-enumerable metadata, and final status attach
   reuses that metadata instead of running another `statSync`. The status attach
   path still reads rollout tail through `inferRolloutFallbackStatus`, so
   active/completed evidence remains tail-authoritative. Readback exposes only
   numeric `fallbackRolloutStatusStatReadCount` and
   `fallbackRolloutStatusStatReuseCount`. These route/summary/request-context
   slices are batched as `codex-mobile-shell-v539` so production readback can
   validate the module as one coherent thread-list request/fallback boundary
   change rather than as several isolated micro-deploys.
   The next app-server peak slice targets burst refresh behavior directly.
   Live sampling showed five identical default `/api/threads?limit=40`
   requests could serialize into rising Mobile-side `appServerRpcMs` values
   even when the mux-side `thread/list` RPC itself stayed small; each request
   also repeated the same route merge and token-usage decoration. The fix is a
   server-side in-flight response coalescer for identical default full-list
   requests. One leader performs the authoritative app-server `thread/list`,
   fallback merge, and decoration; concurrent followers await and reuse the
   bounded public response with `threadListCoalesced*` diagnostics. Cursor,
   search, workspace, archived, fallback-defer, and warm-initial requests are
   deliberately excluded so filtering, pagination, and first-paint warm-cache
   semantics do not change.
   Earlier local
   fallback attribution slices also made baseline source work explicit:
   fallback baseline source reads now
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
   ownership. The 2026-06-27 local attribution follow-up also uses those
   counters in `thread-list-cold-path-diagnosis-service`: when state DB,
   rollout, or session-index is not the dominant source, `coldPathReason` can
   now name `final-filter-empty`, `final-filter`, `merge-dedupe`, or
   `limit-drop` instead of the generic `baseline` reason. This keeps Phase B
   readback actionable without changing any fallback source, merge, filter,
   limit, or cache behavior. The follow-up readback decision slice consumes
   those labels directly, so the next action can name final-filter work,
   fallback merge pressure, or limit-window review instead of sending all
   unresolved baseline rebuilds back to the generic fallback-baseline bucket.
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
uses that evidence to add a recent-only signed partial projection warm
path: a first `mode=recent` `turns-list-initial` response can seed a
`recent-window` projection that later recent opens may reuse, while full/detail
reads still reject partial cache as complete history. Signed partial windows may
be persisted and restored after restart when their backing signature still
matches, so the first post-restart recent open does not need to synchronously
call app-server `thread/turns/list`.

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

Status: Phase A module deployed and read back as `codex-mobile-shell-v533`.
The local Phase A refresh/patch ownership work now has the helper extraction,
transaction ordering, completion snapshots, attempt aggregation, evidence
resolution, and behavior-level DOM harness needed to deploy as one module
instead of many small slices. The module remains a root-cause architecture
boundary cleanup: it changes frontend refresh/patch ownership and validation,
not server projection semantics, diagnostic dispatch policy, task-card
protocol, or visual layout. Post-deploy observation should use bounded
`thread_refresh_ms`, Home AI `conversation_projection_mismatch` diagnostics,
and Phase-B readback cold-path fields before deciding whether the next repair
belongs to DOM patching, server projection, SSE/live merge, pane state, or
thread-list fallback-baseline rebuild cost.

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

The 2026-06-26 local Phase A follow-up makes the same boundary explicit for
post-plan execution: `planSummaryOnlyCurrentThreadRecoveryEffects()` now emits
ordered effects for current-thread state replacement, bounded
`thread_summary_detail_recovery` client events, and optional
`summary-detail-recovery` refresh scheduling. `public/app.js` executes these
effects but no longer re-owns the recovery state/event/refresh order.

The 2026-06-27 local Phase A follow-up moves ordinary thread-open loading-shell
construction into the same state policy. `planThreadOpenLoadingShell()` accepts
only id-matched thread-list summaries, strips detail-only fields, and produces
the bounded `turns: []` / `mobileLoading: true` shell that waits for the real
detail API response. `loadThread()` now executes this plan instead of inlining
summary/detail ownership logic, so stale list `turns`, task-card arrays,
runtime settings, diagnostics, or read-mode metadata cannot regain authority
over the current conversation while a detail open is in flight.

The next 2026-06-27 local Phase A follow-up moves projection-consistency
diagnostic outcome planning into `public/thread-diagnostic-events.js`.
`conversationProjectionConsistencyEffects()` now receives the projection and
turn-order snapshots and emits bounded failure/success effects for render
signature mismatch, duplicate render keys, and turn-order mismatch. The app
still performs the real Home AI diagnostic reporting side effects, but it no
longer owns the mismatch/duplicate/order classification branches or diagnostic
payload selection.

The follow-up Phase A/B local slice applies the same rule to thread-detail
response diagnostics. `threadPerformanceMetrics` still owns slow-path and
response-contract fact planning, but `threadDetailResponseDiagnosticEffects()`
now turns those plans into failure/success diagnostic effects. `public/app.js`
keeps the real performance event collection and Home AI reporting side effects,
without owning `shouldReport` branching for slow detail reads, response
contract mismatches, active-window downgrades, or empty projection shells.

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
`detailRenderMode`, and projection-consistency phase). Refresh render input
field selection also lives in the same helper: app code still measures the
current mounted DOM/signature facts, but `planThreadDetailRefreshRenderInput`
owns which facts form the render-plan input, including visible-shape count
normalization. The 2026-06-27 local follow-up adds
`planThreadDetailRefreshRenderStage`, so input normalization and the
metadata-only / patch / full-render decision are consumed as one policy stage by
`refreshCurrentThread`. App code still collects facts and executes effects, but
it no longer wires the two render-plan calls separately. Tile-pane patch success is now a terminal render outcome instead
of falling through to a single-thread full render. Thread/turn-level merge
orchestration now lives in
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
assignment, and performance event emission. The 2026-06-27 local follow-up
adds `planConversationHtmlUpdateApplication` in the same helper. It owns the
bounded outcome classification for hydrate-only, `patch-html`, direct
`set-inner-html`, and `patch-html-failed` replacement paths. The same helper
also owns `planConversationHtmlPatchFallbackClientEvent`, which determines
whether a patch-failure replacement should emit a client event and bounds its
payload fields. App code still executes the real DOM mutation and event post,
but a failed HTML patch now becomes observable through helper-selected
client/performance metadata instead of being only a console warning. This does
not change render strategy or hide projection mismatches; it separates normal
full render from patch-failure replacement so future diagnostics can route
flicker/repaint incidents to the DOM patch layer. The same local batch moves
`conversation_render_ms` payload ownership into
`planConversationHtmlPerformanceEvent`: render duration, child counts,
html-length, update reason, patch fallback fields, throttle interval, and
slow-render force decision are now helper-selected. App code supplies measured
facts and posts the event.
Local DOM patch completion
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
update metadata without full render, and which fallback action applies.
`planThreadDetailRefreshPatchExecutionStage` owns the composition from
`renderPlan` plus `patchSurfacePlan` into both the execution plan and ordered
patch-attempt effects. App code keeps real DOM patch attempts, metadata writes,
full render execution, and diagnostic/performance reporting. The follow-up
local slice makes post-merge timing execution plan-driven as well:
`planThreadDetailRefreshPostMergeEffects` now declares the timing field for
each group, and `refreshCurrentThread` / full-backfill consume a generic
post-merge execution helper instead of hardcoding `merge`, `composer-render`,
and `thread-list-render` timing calls. First-paint keeps its explicit split
because draft restore intentionally runs between merge and composer render.
The next local slice moves post-merge timing metadata ownership into the same
planning boundary: `planThreadDetailRefreshPostMergeTimingFields` now validates
the ordered timing/field pairs, rejects missing or duplicate timing fields, and
returns the initial timing result shape. App code no longer hardcodes
`mergeMs`, `composerRenderMs`, and `threadListRenderMs`; it only executes the
planned groups and writes durations into the planned fields.
The first-paint path now uses a dedicated sequence plan for its one special
ordering rule: draft restore must happen after merge and before composer
render. `planThreadDetailFirstPaintPostMergeTimingEffects` splits the same
post-merge timing entries into `beforeDraftRestore` and `afterDraftRestore`,
while app code only executes those entries and keeps the draft restore insertion
point. This prevents `loadThread()` first paint from diverging from
refresh/full-backfill when post-merge timing metadata changes.
These v539-follow-up Phase A slices were batched and deployed as
`codex-mobile-shell-v540`, so the thread-detail render/post-merge ownership
cleanup is read back as one coherent frontend module rather than as several
isolated micro-deploys. Production readback confirmed
`clientBuildId=0.1.11|codex-mobile-shell-v540`, `shellCacheName` v540, and the
bounded readback decision `ready/warm-or-bounded-paths`.
Refresh patch attempt result planning now also lives there:
`planThreadDetailRefreshPatchAttemptResult` normalizes tile-pane success,
local-patch success, local-patch rejection, metadata-only tile misses, and
finalize-input shape. It also owns the patch telemetry selection for
`detailPatchMs`, `patchTimingSource`, and normalized `patchRejectReason`.
`planThreadDetailRefreshPatchAttemptResultStage` owns the composition from the
executed patch-attempt aggregate to result, local-rejection visible-shape
request, diagnostic plan, and diagnostic effect plan, including whether a
failed local patch attempt should emit the projection-mismatch diagnostic. App
code keeps real DOM calls, bounded visible-shape measurement only when the
stage asks for it, and diagnostic transport execution.
The visible-shape evidence request itself is now an explicit effect-plan stage:
`planThreadDetailRefreshPatchAttemptResultEvidenceStage` returns the initial
result stage plus a `collect-patch-rejected-visible-shapes` effect only for
rejected local patches that need bounded previous/current shape counts. After
app code executes the real `visibleConversationShape()` calls,
`planThreadDetailRefreshPatchAttemptResultEvidenceCompletionStage` recomputes
the result/diagnostic stage from that bounded evidence. This keeps the evidence
collection condition and completion shape inside the render-plan helper while
leaving real DOM-derived measurement in app code.
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
Patch-surface probe stage composition now also lives in
`public/thread-detail-render-plan.js`: the helper owns the pre-probe surface
plan, DOM-probe effect plan, and final surface plan after the app executes the
real DOM probe. `refreshCurrentThread()` still executes
`threadDetailDomPatchSurface()` through the effect executor, but it no longer
hand-wires the two surface-plan calls around the probe result.
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
Refresh reporting stage composition now also lives in this helper:
`planThreadDetailRefreshReportingStage` combines the refresh performance input
with telemetry and completion config, while
`planThreadDetailRefreshReportingEffectsStage` turns the bounded performance
event into telemetry and completion effect plans. The actual
`threadPerformanceMetrics.threadDetailRefreshEventFields()` call remains in
app code because it crosses the render-plan and performance-metrics module
boundary; app code no longer hand-wires the performance-input, telemetry, and
completion helper chain.
Refresh execution-effect planning now also lives in this helper:
`planThreadDetailRefreshExecutionEffects` maps outcome execution actions to
metadata-update, full-render, no-op, or bounded unknown effect entries. App code
still performs real metadata updates and `renderCurrentThread()` calls, but
`refreshCurrentThread()` no longer branches directly on
`executionPlan.executionAction`.
The fixed composition from render outcome to execution and consistency effects
now also lives in the helper:
`planThreadDetailRefreshOutcomeExecutionStage` takes the already planned
`renderPlan` plus the executed `patchAttemptResult`, finalizes
`renderOutcome`, derives `executionPlan`, then returns the execution and
consistency effect plans as one stage. This keeps `refreshCurrentThread()` from
hand-wiring the outcome/execution/consistency helper chain while still leaving
real metadata updates, full render, and consistency checks in app code.
The refresh path now also stops mirroring patch state in app-local booleans:
`locallyPatchedDetail` and `tilePanePatchedDetail` are owned by
`patchAttemptResult` and the final `renderOutcome`, not by extra
`refreshCurrentThread()` variables that can drift across patch attempt, result,
and outcome stages.
Patch-attempt result evidence resolution now also lives in the helper:
`planThreadDetailRefreshPatchAttemptResultEvidenceResolutionStage` receives the
real visible-shape evidence result from app code and decides whether to keep the
original result stage or complete it with collected shape evidence. App code
still collects the actual DOM-derived shape evidence, but it no longer branches
directly on `patchRejectedVisibleShapeEvidence.collected` or calls the
completion stage itself.
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
Refresh response effect planning now also lives in this helper:
`planThreadDetailRefreshResponseEffects` decides whether a completed refresh
response still belongs to the current thread/load sequence, then declares the
ordered detail-loaded mark, bounded render-evidence write, and current-thread
merge effects. App code still performs the real marker/evidence/merge calls,
but `refreshCurrentThread()` no longer owns the stale-response guard or the
response-merge effect order directly.
Post-merge timing execution is now consolidated in app code:
`applyThreadDetailRefreshTimedPostMergeEffectsGroup` executes one planned
post-merge group and returns its bounded duration. This keeps
`refreshCurrentThread()`, first-paint, full-backfill, and cached-current paths
from hand-writing separate `nowPerfMs()` / group execution /
`roundedDurationMs()` patterns while preserving the planned group order from
`planThreadDetailRefreshPostMergeEffects`. First-paint merge timing intentionally
keeps its existing broader window because pre-render effects are part of that
measured phase.
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
The next local Phase A slice moves the completion input authority into the same
module: `planLocalConversationDomUpdateCompletionSnapshot` normalizes tile-pane
terminal state, single-thread completion facts, conversation/patch-shell
signatures, and scroll action before the completion plan is built. App code now
collects real DOM/scroll/signature facts and executes effects, while the
tile-versus-single completion snapshot semantics stay covered by the DOM-patch
helper tests.
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
The same helper now owns the stable-signature DOM authority invalidation
payload contract. `planConversationDomAuthorityInvalidation` decides whether a
`stable-signature-dom-empty` update should record an empty-visible-detail
mismatch and post the bounded `conversation_dom_authority_invalidated` client
event, including the expected/rendered turn counts and render action.
`public/app.js` still performs the real `recordEmptyVisibleDetailMismatch` and
`postClientEvent` side effects, but it no longer assembles those diagnostic
payloads inline. This is a local Phase A ownership slice only; it does not
change DOM mutation order, scroll policy, projection semantics, shell/cache
version, or deployment state.
The v543 follow-up local slice also removes the last hand-written completion
snapshot object from `patchCurrentThreadDetailFromRefresh()`: the refresh local
patch path now asks `planLocalConversationDomUpdateCompletionSnapshot()` to
normalize root availability, single-thread eligibility, conversation
signature, patch-shell signature, and scroll action before the transaction
commit effect calls `completeLocalConversationDomUpdate()`. The completion
executor can still collect live DOM/scroll facts for other patch callers, but
it can also consume a preplanned helper snapshot. This keeps local refresh
patch completion input authority in `thread-detail-dom-patch` instead of
duplicating a similar object shape in `public/app.js`.
The next local Phase A slice moves refresh local-patch transaction effect
planning into the same helper. `planThreadDetailRefreshLocalPatchTransactionEffects()`
now owns the ordered commit effect and after-success effect list, while
`public/app.js` only adapts those planned effects to the real DOM/state
callbacks. This keeps the local transaction boundary testable without changing
the runtime order: turn DOM patch, completion commit, then operation-dock
refresh and action rebinding.
The next local Phase B slice starts moving first-paint evidence composition out
of `loadThread()`: `planThreadDetailFirstPaintReportingStage()` now owns the
cached-current/API-first-paint performance input and telemetry input field
shape. App code still measures real timings, reads thread status/count facts,
and builds the performance event through `threadPerformanceMetrics`, but it no
longer hand-writes the reporting payload shape for the two first-paint paths.
The follow-up Phase B slice applies the same evidence-ownership boundary to
full detail backfill: `planThreadDetailFullBackfillReportingStage()` now owns
the full-ready performance input and bounded telemetry input for
`backfillFullThreadDetail()`. App code still measures real API/render/merge/
post-render timings and still emits the performance event through
`threadPerformanceMetrics`, but the field shape is no longer assembled inline
in the full-backfill route.
Refresh patch surface planning now also lives in this helper:
`planThreadDetailRefreshPatchSurface` decides whether the refresh should probe
tile-pane DOM state and whether the current patch path is a tile surface based
on tile mode, tile conversation surface state, and the probed DOM patch surface.
App code still reads the UI state and performs the real DOM probe.
Patch surface probe effect planning now also lives in this helper:
`planThreadDetailRefreshPatchSurfaceProbeEffects` converts the initial
patch-surface decision into a DOM-probe effect only when a rendered detail
refresh needs it. App code still performs the real `threadDetailDomPatchSurface`
lookup, but `refreshCurrentThread()` no longer branches directly on
`patchSurfaceProbePlan.shouldProbeTilePatchSurface`.
Patch surface execution stage composition now also lives in the same helper:
`planThreadDetailRefreshPatchSurfaceExecutionStage` takes the bounded DOM probe
result plus the current render plan and composes the final patch surface,
patch-execution plan, and ordered patch-attempt effects. App code still performs
the real DOM probe and real DOM patch timing, but `refreshCurrentThread()` no
longer hand-wires surface-result planning into patch-execution planning.
Refresh patch-attempt effect planning now also lives in this helper:
`planThreadDetailRefreshPatchAttemptEffects` declares the tile-pane patch and
local-patch attempt order. App code still performs the real DOM patch calls and
timing, but `refreshCurrentThread()` no longer inlines tile/local patch attempt
loops, synchronizes those booleans directly, or reads patch failure reasons from
global scratch state.
Local patch rejection diagnostic input planning now also lives in this helper:
`planThreadDetailRefreshPatchRejectedDiagnostic` takes the patch-attempt result,
render plan, read mode, and bounded visible-shape counts, then decides whether a
`detail_patch_rejected` diagnostic should be emitted and which bounded fields
should be passed into `threadDiagnosticEventsApi.detailPatchRejectedDiagnosticEvent`.
App code still triggers the real Home AI diagnostic side effect, but
`refreshCurrentThread()` no longer owns patch-rejection diagnostic field
selection directly.
Patch rejection diagnostic effect planning now also lives in this helper:
`planThreadDetailRefreshPatchRejectedDiagnosticEffects` converts that diagnostic
plan into a bounded effect list. App code still performs the real
`recordHomeAiDiagnosticFailure` call, but `refreshCurrentThread()` no longer
branches directly on `patchRejectedDiagnosticPlan.shouldReport`.
Projection consistency-check effect planning now also lives in this helper:
`planThreadDetailRefreshConsistencyCheckEffects` converts an already-decided
consistency-check plan into an ordered effect for
`checkConversationProjectionConsistency`. App code still performs the real
projection consistency check, but `refreshCurrentThread()` no longer branches
directly on `consistencyCheck.shouldCheck`.
Refresh telemetry effect planning now also lives in this helper:
`planThreadDetailRefreshTelemetryEffects` converts the already-built bounded
`thread_refresh_ms` performance payload into ordered telemetry effects:
`postPerformanceEvent` first, then `recordThreadDetailResponseDiagnostics`.
App code still executes the real reporting side effects and supplies the runtime
thread object for diagnostics, but `refreshCurrentThread()` no longer owns
refresh telemetry side-effect ordering.
Refresh completion effect execution is now also isolated behind an app-level
plan executor: `planThreadDetailRefreshCompletionEffects` selects bounded
completion effects, and `applyThreadDetailRefreshCompletionEffectsPlan` executes
the list. App code still performs the real diagnostic-success, usage-backfill,
and live-poll scheduling calls, but `refreshCurrentThread()` no longer directly
iterates over `completionPlan.effects`.
Refresh post-merge side-effect ordering now also lives in this helper:
`planThreadDetailRefreshPostMergeEffects` declares the fixed
thread-list-merge, composer/active-turn sync, and thread-list-render groups
after state merge. App code still performs the real side effects and preserves
the existing `mergeMs`, `composerRenderMs`, and `threadListRenderMs` timing
boundaries. The 2026-06-27 local first-paint/full-backfill follow-up applies
the same post-merge plan to `loadThread()` successful first paint and
`backfillFullThreadDetail()`. The cached-current follow-up also routes its
thread-list merge and thread-list render through the same plan while preserving
its existing follow-to-bottom, conversation render, auto-backfill,
tile-pane-specific Composer refresh, menu close, projection-consistency, and
cached first-paint telemetry behavior. Cached-current first-paint
telemetry/reporting ordering now also lives in
`planThreadDetailCachedCurrentTelemetryEffects`, preserving the legacy
`thread_detail_first_paint`, `thread_switch_cached`, and load-success
diagnostic-clear sequence without adding API first-paint response diagnostics.
Cached-current post-render side-effect ordering now also lives in
`public/thread-detail-render-plan.js`:
`planThreadDetailCachedCurrentPostRenderEffects` declares the cached-current
sequence for history auto-backfill, tile-pane Composer restore when the
thread-list open replaced a pane slot, overlay menu close, projection
consistency check, empty cached-detail healthy clear, and silent side-chat load
when needed. App code still supplies the live runtime booleans and executes the
real state/DOM/network side effects, but `loadThread()` no longer owns this
fixed cached-current post-render sequence inline.
Ordinary refresh, cached-current first
paint, API first paint, and full detail backfill no longer maintain separate
hand-written thread-list post-merge ordering in `public/app.js`; full backfill
now routes its detail-loaded marker, render-evidence write,
pending-server-request sync, and current-thread merge through the same planned
response-effect executor used by refresh and first-paint responses. App code
still owns the real full-render call and bounded full-ready telemetry
execution.
API first-paint response state/evidence effects now also live in
`public/thread-detail-render-plan.js`:
`planThreadDetailFirstPaintResponseEffects` declares detail-loaded marking,
render-evidence recording, pending server-request synchronization, and
current-thread merge ordering. App code still executes the real state writes and
merge algorithm, but `loadThread()` no longer owns this successful detail
response sequence inline.
Full-backfill response state/evidence effects now also live in
`public/thread-detail-render-plan.js`:
`planThreadDetailFullBackfillResponseEffects` declares the same
detail-loaded/render-evidence/pending-request/current-thread merge order for
`backfillFullThreadDetail()`. This keeps full-backfill API response ownership
aligned with refresh and first-paint without changing the full-backfill read
strategy, merge algorithm, scroll behavior, DOM patch path, or telemetry
payload shape.
First-paint post-render side-effect ordering now also lives in
`public/thread-detail-render-plan.js`:
`planThreadDetailFirstPaintPostRenderEffects` declares the fixed sequence for
plugin navigation publishing, connection restore, delayed live polling,
Composer control refresh, conditional overlay-menu close, conditional full
detail backfill, and Usage backfill. App code still evaluates runtime
conditions and performs the actual DOM/timer/network side effects, but
`loadThread()` no longer owns this fixed post-render ordering inline.
First-paint after-render history auto-backfill is also planned explicitly:
`planThreadDetailFirstPaintAfterRenderEffects` declares the auto-backfill effect
that runs after `renderCurrentThread({ stickToBottom: true })` and before
`postRenderStartedAt`. This keeps the original performance timing boundary
while removing the last direct first-paint history auto-backfill call from
`loadThread()`.
First-paint post-timing projection-consistency checking is planned separately:
`planThreadDetailFirstPaintPostTimingEffects` declares the
`check-conversation-projection-consistency` effect that runs after
`postRenderMs` is measured. This preserves the existing timing scope while
removing another direct fixed effect call from `loadThread()`.
Thread-open loading-shell post-state ordering now also lives in
`public/thread-detail-render-plan.js`:
`planThreadDetailLoadingShellPostStateEffects` declares the fixed sequence that
runs after `planThreadOpenLoadingShell()` installs `state.currentThread`,
including follow-to-bottom, draft restore, Composer settings, active-turn sync,
thread-list render, conversation render, plugin navigation, side-chat silent
load, connection state, activity marker, and load watchdog startup. App code
still executes the real DOM/state/timer/network effects, but `loadThread()` no
longer owns this loading-shell visible-open sequence inline.
Thread detail load-error UI ordering now follows the same rule:
`planThreadDetailLoadErrorEffects` declares the fixed load-error state/render
sequence for failed detail API reads. App code still writes the real
`state.currentThread.mobileLoadError`, updates DOM controls, and emits the
existing switch-error and Home AI failure diagnostics, but `loadThread()` no
longer owns the load-error render/update order inline.
API first-paint pre-render local-state preparation is also planned explicitly:
`planThreadDetailFirstPaintPreRenderEffects` declares current thread id
persistence, draft-target clearing, follow-to-bottom, and optional EventSource
reconnect after the successful detail response is merged. The paired
`planThreadDetailFirstPaintDraftRestoreEffects` keeps draft restoration as its
own timed effect so `draftRestoreMs` preserves the previous scope while
removing another fixed direct call from `loadThread()`.
First-paint telemetry/reporting side-effect ordering now also lives in
`public/thread-detail-render-plan.js`:
`planThreadDetailFirstPaintTelemetryEffects` declares the fixed sequence for
the `thread_detail_first_paint` performance event, thread-detail response
diagnostics, `thread_switch_complete`, and load-success Home AI diagnostic
clear. App code still supplies the runtime thread object and performs the real
reporting side effects, but `loadThread()` no longer owns this first-paint
telemetry ordering inline.
First-paint performance input selection now also lives in the same helper:
`planThreadDetailFirstPaintPerformanceInput` normalizes the cached-current and
API first-paint timing fields before `threadPerformanceMetrics` builds the
event. App code still measures the real elapsed durations, but it no longer
hand-writes the event input shape for cached versus uncached first paint.
Thread switch start/cancel/error client-event payload planning now also lives in
`public/thread-detail-render-plan.js`:
`planThreadDetailSwitchStartClientEvent`,
`planThreadDetailSwitchCancelledClientEvent`, and
`planThreadDetailSwitchErrorClientEvent` declare bounded
`thread_switch_start`, `thread_switch_cancelled`, and `thread_switch_error`
payloads for thread-detail opens, stale/aborted thread-detail loads, and API
errors. The start plan preserves the previous `listAgeMs` semantics by keeping
missing values as `null`. App code still owns abort/stale branching, UI state,
and the real `postClientEvent` side effect.
Thread refresh failure diagnostic payload planning now lives in
`public/thread-diagnostic-events.js`: `threadDetailRefreshFailedDiagnosticEvent`
builds the bounded `thread_detail_refresh_failed` failure report, so
`refreshCurrentThread()` no longer owns category/type/context/count/breadcrumb
selection for refresh API failures.
Thread detail load failure diagnostic payload planning now also lives in
`public/thread-diagnostic-events.js`: `threadDetailLoadFailedDiagnosticEvent`
builds the bounded `thread_detail_load_failed` failure report, so
`loadThread()` no longer owns category/type/context/count/breadcrumb selection
for initial thread-detail API load failures. App code still owns real UI state,
client events, abort/cancel branching, and throwing the original error.
Thread refresh failure diagnostic effect planning now also lives in
`public/thread-detail-render-plan.js`:
`planThreadDetailRefreshFailureDiagnosticEffects` converts bounded failure
metadata into a diagnostic-failure effect. App code still performs the real
Home AI diagnostic side effect and preserves abort/throw behavior, but
`refreshCurrentThread()` no longer calls the failure reporter directly.
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
Full-backfill performance input field selection also lives in
`public/thread-detail-render-plan.js`:
`planThreadDetailFullBackfillPerformanceInput` takes the measured API/render/
merge/composer/thread-list/conversation/post-render timings and returns the
bounded input object for `threadDetailFullReadyEventFields`. App code supplies
the actual measured timings and thread object but no longer hand-selects the
full-ready client timing fields inline.
Full-backfill post-render and telemetry side-effect ordering now also lives in
`public/thread-detail-render-plan.js`:
`planThreadDetailFullBackfillPostRenderEffects` declares the Usage backfill,
live poll, and Composer-control refresh sequence after the full-backfill
conversation render, while `planThreadDetailFullBackfillTelemetryEffects`
declares the forced `thread_detail_full_ready` event and
`thread-detail-full-backfill` response diagnostic call. App code still owns the
real network/DOM/timer side effects, but `backfillFullThreadDetail()` no longer
owns this fixed ordering inline.
History auto-backfill effect ordering now also lives in
`public/thread-detail-render-plan.js`:
`planThreadDetailHistoryAutoBackfillEffects` turns an already-computed
auto-backfill decision into ordered effects for remembering the backfill key,
posting the bounded `thread_history_auto_backfill` client event, and scheduling
the older-turn load. App code still owns the real state mutation, timer, and
network call, but `maybeAutoBackfillThreadHistory()` no longer owns the event
payload shape or fixed load scheduling inline.
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
decision and bounded reason for full conversation renders. Bottom-follow lease
evaluation now also lives there through `planBottomFollowLeaseEvaluation`:
submitted-message and viewport follow code supplies user-reading, lease-active,
and lease-presence facts while the helper owns the shared should-follow versus
clear-lease decision. Bottom-follow retry scheduling now also lives there
through `planBottomFollowScrollSchedule`: app code owns real timer side effects,
while the helper owns the retry delay sequence and old-timer-clear intent.
User-reading-current-turn
planning now also lives in `public/conversation-scroll.js` through
`planUserReadingCurrentTurn`: app code supplies near-bottom, active auto-scroll
hold, recent manual scroll intent, and current-turn candidate facts while the
helper owns the final `userReadingCurrentTurn` classification. Auto-scroll hold
updates from manual scroll now also live there through
`planConversationAutoScrollHoldFromScroll`: app code supplies near-bottom,
recent manual scroll intent, and current-turn candidate facts while the helper
decides whether the real side effect should clear hold, remember hold, or do
nothing. Conversation jump button visibility planning now also lives in
`public/conversation-scroll.js` through `planConversationJumpButtons`: app code
supplies thread/load state, scrollability, near-bottom state, and receipt-target
visibility while the helper owns the mutually exclusive bottom-jump versus
receipt-jump decision.
Single-thread shell
conversation update input planning now also lives in
`public/thread-detail-render-plan.js`: early-shell and full-render shell paths
produce stable `updateConversationHtml()` inputs for HTML, conversation
signature, patch-shell signature, expected visible turn count, source, and
bottom-follow intent while app code keeps the real DOM update and retry/action
binding. Single-thread shell post-update effect planning now also lives there:
early-shell retry binding plus tick/navigation, and full-render empty-detail
diagnostic checks, action binding, receipt-start scroll, route-hint focus,
tick, and navigation publish are emitted as ordered effects while app code keeps
the actual DOM queries, event binding, scroll calls, timers, and navigation
posting.
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
execution. Effective pane-count state now also lives there: layout capacity,
default candidate ids, maximum candidate ids, running/current thread ids, and
explicit user pane count are normalized into automatic, effective, min, and
max pane counts as one bounded plan while `public/app.js` only supplies current
thread/list facts. Pane display layout planning now also lives there: layout
capacity, visible panes, capacity columns, actual columns, rows, overflow
column groups, and explicit split-pair grouping are helper-owned while
`public/app.js` keeps DOM rendering and supplies current layout/id/split facts.
Runtime detail-read concurrency planning now also lives there: active pane
count, user pane cap, configured cap, and final `maxConcurrentLoads` are
helper-owned while `public/app.js` keeps network execution. Runtime detail
reads are still capped separately from visible pane count, so wide screens can
show more panes without starting every large thread detail read at once.
Pane render signature schema planning now also lives there: columns/rows,
visible/capacity panes, desired pane count, column groups, split pairs,
selected pane, loading/error/operation signatures, and per-pane thread
conversation signatures are assembled into one helper-owned JSON signature
while `public/app.js` only supplies current facts and render callbacks.
Pane-local scroll runtime policy now also
lives there: near-bottom metrics, hold clear/remember decisions, bottom-jump
button visibility, and restore-distance versus bottom-follow choices are
planned from bounded scroll facts while `public/app.js` keeps DOM reads/writes
and ARIA/class side effects. Shared Composer target planning now also lives
there: new-thread mode, tile-surface activation, selected-pane/current-thread
fallback, and the tile-only `发送到：线程名` placeholder are helper-owned while
`public/app.js` keeps real DOM surface detection, thread-title lookup, draft
storage, and control rendering. Composer draft runtime restore planning now
also lives there: new-thread defaults, old-thread draft runtime restore,
missing-draft keep/reset behavior, Fast, model, reasoning effort, and
permission option validation are helper-owned while `public/app.js` keeps
normalized permission input and state write side effects. Pane-local operation
minimum-refresh planning now also lives there: disabled/no-active/active-pane
patch targets and full-render-on-patch-miss policy are helper-owned while
`public/app.js` keeps the real timer and render side effects.
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
  planning, shell update input planning, and shell post-update effect planning
  are now outside app.js;
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
  automatic/effective/min/max pane-count planning is also outside app.js;
  pane display layout and overflow split column planning is also outside app.js;
  pane render signature schema planning is also outside app.js;
  pane render frame scheduling and patch-miss full-render policy are also
  outside app.js;
  pane-local patch preflight and failure-reason classification are also outside
  app.js;
  pane-local patch completion side-effect planning is also outside app.js;
  pane detail-load concurrency limit planning is also outside app.js;
  pane-local scroll hold/bottom-button/restore planning is also outside app.js;
  refresh, first-paint, and full-backfill performance event field ownership is
  also outside app.js;
  operation card content and final template planning are now outside app.js;
  split sizing controls, measured production/browser tuning of the max
  concurrent detail read value, and per-pane draft/runtime ownership remain
  the next boundary.
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
- `mode=recent` can seed and reuse a signed partial projection. Partial
  projections carry `partial:true` / `partialKind:recent-window`, are only
  returned when the coordinator explicitly passes `allowPartial`, may be
  persisted/restored with a matching projection signature, and cannot overwrite a
  reusable full projection cache. When only a stale signed partial is available
  after backing movement, recent-mode first paint may return it with
  `stalePartial` metadata while scheduling a background window refresh; it still
  cannot become full-history authority.
  A stale full cache whose signature no longer matches must not block the
  recent partial warm path.
  The v4 projection wrapper must pass those seed/get options through to the
  base projection cache; otherwise production v4 would turn a recent window into
  an incorrect full `projection-v4-cache`. This optimizes repeated recent opens
  of large sessions without presenting a bounded current window as
  authoritative complete history.
- Cursor-backed `turns-list*` windows are now treated as partial projection
  state even if the seeding caller forgot to pass `partial:true`. The projection
  cache also normalizes legacy disk entries that persisted such a window as a
  full dynamic cache, so `mode=full` cannot reuse a recent/current turns-list
  window as `projection-v4-dynamic`.
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
  healthy full cache. Summary timestamp-only changes no longer force
  `dynamic-summary-stale` when rollout size/mtime, retained-window policy, and
  thread identity still match; those summary-only changes are metadata
  freshness, not content backing invalidation.
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

Current local coverage:

- The first thread-tile Phase E fixture is local/private and not deployed.
  `scripts/codex-mobile-thread-tile-visual-fixture.js` uses the existing
  `public/thread-tile-layout.js` and `public/thread-tile-state.js` policies
  plus real `public/styles.css` to render bounded fake pane content in headless
  Chrome. It verifies that wide desktop CSS viewports can keep five panes in
  one row, while overlay/tablet-landscape capacity pressure packs overflow
  panes into one vertical split column instead of creating a sparse second row.
  It also checks pane/board/composer bounds, non-overlap, non-split columns
  staying full height, hidden bottom buttons not occupying fixed layout rows,
  pane-local operation bubble overlay bounds, and command duration visibility.
  The fixture records only bounded layout metrics and screenshots with fake
  content; it does not read private thread bodies, task-card bodies, uploads,
  paths, cookies, tokens, prompts, or logs.
- The same fixture now covers embedded keyboard/composer input stability with
  `--keyboard --typed-lines <n>`. It verifies computed `.app` transform remains
  stable, typed message input stays inside the shared Composer, Composer stays
  below the tile conversation, and panes/board do not overlap after input growth.
  This is a Phase E evidence hook for the intermittent Composer input/full-screen
  repaint complaint, not a runtime fallback or masking layer.
- The fixture now also covers injected cross-thread task-card presentation with
  `--task-card collapsed|expanded`. It renders synthetic task-card content
  through the same CSS classes used by real injected task cards and verifies
  summary visibility, pane containment, bounded expanded-body scrolling,
  Composer non-overlap, and the existing pane/operation-bubble layout
  invariants. The new keyboard-open expanded-card fixture exposed that tile
  panes still inherited the single-thread `420px` task-card body height cap,
  which could push the expanded card outside the pane and into the shared
  Composer. The local slice adds a pane-specific body cap so expanded task-card
  content scrolls inside the scaled pane. It does not read private task-card
  bodies. Because this touches `public/styles.css`, it remains local until the
  next Phase E module shell/cache bump and deploy.
- The image-order live-debug smoke is now privacy-bounded before it is used as a
  Phase E closure tool. `scripts/codex-mobile-image-order-visual-smoke.js`
  still uses raw ids internally to open the requested thread through the
  live-debug lane, but its report output now contains only endpoint kind,
  build ids, turn/item hashes, route kind, rects, timestamps, counts, screenshot
  path hash, and bounded error codes. It no longer prints raw thread/turn/item
  ids, debug URLs, screenshot paths, `location.href`, DOM labels, DOM text, or
  error message bodies. The focused `test/image-order-visual-smoke.test.js`
  covers this metadata-only contract.
- This does not replace Home AI embedded/PWA live-debug coverage. Remaining
  Phase E slices still need real browser smoke around long-turn streaming and
  more scenario-specific projection repair cases, but the generic API-vs-DOM
  replay smoke now exists locally.
- The next local Phase E slice starts the PWA shell-refresh live-debug coverage
  without executing a reload. `scripts/codex-mobile-pwa-shell-refresh-smoke.js`
  opens the embedded Codex Mobile shell through the Home AI debug lane,
  compares the visual harness client build id with `/api/public-config`, and
  verifies boot recovery is hidden, the app shell is visible, hard-refresh and
  page-refresh controls are present, shell refresh functions are callable, and
  service-worker/cache capabilities are observable. It reports only endpoint
  kind, expected build/cache ids, bounded booleans, screenshot path hash, and
  error codes. It does not output raw debug/server URLs, paths, DOM text,
  cookies, tokens, launch material, or logs. This is a harness/evidence slice,
  not a runtime fallback and not an automatic page reload.
- The media-render live-debug smoke now covers uploaded/generated image DOM
  surfaces as a local evidence slice. `scripts/codex-mobile-media-render-visual-smoke.js`
  opens a bounded target thread, inspects `.input-image`, `.image-view`,
  `.markdown-image`, and file-preview image surfaces, and verifies they are
  visible, loaded, not failed, not leaking local paths, and proxy-safe when the
  app is running under the Home AI plugin proxy. Reports are metadata-only:
  endpoint kind, expected build/cache ids, hashed thread/turn/item/source ids,
  route-kind counts, image dimensions, rects, failure counts, screenshot path
  hash, and bounded error codes. It does not output raw image URLs, filenames,
  local paths, DOM text, uploads, cookies, tokens, provider payloads, or logs.
  This is browser evidence for future media incidents, not a rendering fallback.
- The projection-replay live-debug smoke now compares server/API thread detail
  structure with the actual embedded DOM as a local evidence slice.
  `scripts/codex-mobile-projection-replay-visual-smoke.js` opens a bounded
  thread, fetches `mode=recent` detail through the same direct/proxy-safe route
  the iframe can use, and compares visible turn/item counts, latest turn hash,
  turn order hashes, duplicate DOM render keys, and duplicate DOM item ids.
  Reports contain only endpoint kind, expected build/cache ids, hashed
  thread/turn/item ids, read mode, mismatch counts, screenshot path hash, and
  bounded error codes. It does not output raw ids, message text, task-card
  bodies, private routes, cookies, tokens, provider payloads, or logs. This
  gives Home AI diagnostics a replay target for "missing/duplicate/only one
  receipt visible" incidents without adding a client-side masking fallback.
- The long-turn viewport fixture now covers the mobile single-thread shape that
  triggered repeated "new replies hidden behind a long receipt" and scroll
  button regressions. `scripts/codex-mobile-long-turn-viewport-fixture.js`
  renders bounded fake `.item.agentMessage` and `.item.turnUsageSummary`
  content with real `public/styles.css`, then verifies the long final-receipt
  start can be anchored into the conversation viewport, Usage remains visible
  at bottom, `#scrollToBottom` and `#scrollToTurnReply` share one mutually
  exclusive floating slot, and the visible receipt/Usage bands do not overlap
  the Composer. It reports only viewport/rect/scroll booleans plus artifact
  path hashes and byte counts, and does not read private threads, messages,
  task-card bodies, URLs, cookies, tokens, screenshots, or logs. This is
  regression evidence for the existing scroll policy, not a runtime fallback.

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
  intent. Effective pane-count planning also now lives there, so automatic
  current/running-thread sizing, explicit user-requested counts, min close
  bounds, and max add bounds share one helper-owned plan. Pane-local scroll
  planning also now lives there, so near-bottom, hold, bottom-jump visibility,
  and patch restore-distance decisions are helper-owned. Shared Composer
  target/placeholder planning also now lives there, so selected-pane send
  target, current-thread fallback, new-thread placeholder, and tile-only
  target placeholder no longer depend on scattered `app.js` branches. Composer
  draft runtime restore planning also now lives there, so Fast/model/effort/
  permission recovery across pane switches no longer depends on scattered
  `app.js` branches. Shared Composer action-control planning also now lives
  there, so Stop/steer/send/retry/Goal/task-card/voice affordance state is
  helper-owned while `app.js` only applies the planned label, disabled state,
  aria label, and CSS classes. Operation minimum-refresh planning also now lives there,
  so remembered command bubbles can expire through pane-local patch targets
  without `app.js` owning that state decision. Thread-tile viewport baseline
  and Composer chrome-height planning also now live there, so keyboard-active
  split-screen layouts use a helper-owned stable viewport/composer baseline
  while `app.js` only reads DOM viewport facts and writes the planned baseline.
  Pane slot patch-miss full-render escalation intent also now lives there, so
  failed pane-level patch attempts no longer unconditionally schedule a full
  render from `app.js` without a helper-owned policy bit. Continue moving pane
  Display-settings load/migration planning also now lives there, so server
  runtime settings, legacy local tile migration, and load-error local recovery
  are helper-owned while `app.js` keeps API/localStorage/apply/save side
  effects. Continue moving pane
  widths, per-pane drafts, max concurrent detail reads, pane-local
  approval surfaces, command detail panels, and mobile collapse
  behavior into testable helpers without DOM side effects.
  Task-card action context is now pane-aware: rendered task-card buttons carry
  their owning thread id, the shared click resolver returns that id, and
  mutation/reply calls send and settle against that action thread instead of
  unconditionally using global `state.currentThreadId`.
  Pane toolbar action context is now pane-aware as well: rollout warning,
  continuation, and manual task-card buttons carry their owning thread id, and
  the shared resolver reads that id or nearest pane id before falling back to
  the global current thread.
  Older-history pagination is now pane-aware: history buttons carry their
  owning thread id, tile panes render the same history loader affordance as the
  single-thread surface, and `loadOlderThreadTurns()` updates the target pane
  detail cache before scheduling pane-local render.
  Continuation confirmation is also pane-aware: the dialog confirm path resolves
  tile-detail-only source threads and fails closed if a concrete source id can
  no longer be found, instead of compressing the unrelated current thread.
  Manual task-card creation now uses `activeTurnIdForThread(sourceThread)` and
  `refreshThreadAfterTaskCard(sourceThread.id)`, so a pane-local task-card
  source does not borrow the global current live turn or repaint the wrong
  detail surface.
  Approval/server-request action context is now pane-aware as well: rendered
  approval and user-input controls carry their owning thread id, the shared
  click resolver returns it, and pending/resolved/request-response refreshes
  patch the current detail or the visible tile pane that owns the request.
  Conversation signatures and in-turn approval rendering now use the active
  render context thread id, so tile-pane approval state is no longer keyed to
  the global current thread. When an in-turn approval/user-input request lacks
  its own `threadId`, rendered action controls must receive the active
  render-context thread id rather than falling back to `state.currentThreadId`.
  Tile-pane rendering now mirrors that single-thread approval split: approvals
  attached to visible turns render inline in `renderThreadTileTurn()`, while
  still-active approvals not attached to a visible turn render in the pane body
  through `renderPendingApprovals(thread)`.
  Local file preview context is now pane-aware: local image/file preview
  content URLs, imageView file paths, explicit preview opens, and nested file
  preview links resolve against the render/action/file-preview thread context
  rather than global `state.currentThreadId`.
  Stable render keys are now pane-context-aware as well:
  `stableItemKey()`, `stableOperationRenderKey()`, and `stableTurnKey()` use
  `renderContextThreadId()` so tile panes do not mint item/operation/turn keys
  from the global current thread during pane-local DOM patching.
  The render context now also carries the thread object, not only the id:
  `withRenderContextThread()` scopes conversation signatures and tile-pane turn
  rendering so latest/live/context-compaction/raw-mode visible-item decisions
  read the pane thread instead of `state.currentThread`.
  Visible item signatures now follow the same ownership rule:
  `visibleItemSignature()` accepts the explicit thread and passes it through to
  `contextCompactionNotice()`, so pane-local render signatures and operation
  signatures do not infer context-compaction state from the global current
  thread.
  Thread-tile visible-shape evidence now follows that same context too:
  `visibleRenderableTurnIds()` and `threadTileVisibleShape()` pass the pane
  thread into `visibleItemsForTurn()`, so tile patch expected counts and
  render diagnostics use the same visible-item filter as the pane renderer.
  The shared `visibleConversationShape()` evidence helper now also passes its
  input thread into `visibleItemsForTurn()`, so render evidence, empty-detail
  mismatch checks, and patch-rejection shape evidence do not count items using
  global current-thread state.
  The actual `renderTurn()` and `visibleItemPatchEntries()` paths now follow
  the same rule: both call `visibleItemsForTurn(turn, thread)` with the active
  render context thread, and patch-entry signatures reuse that same thread.
  Visible item source-index lookup and local insertion/live-text patch paths
  now also pass the render context thread into visible-item filtering, so
  pane-local DOM keys and insertion anchors derive from the same filtered item
  list as the renderer.
  Submitted-message bottom-follow sustain now also evaluates visible progress
  with `visibleItemsForTurn(liveTurn, thread)`, so scroll-follow leases do not
  read global current-thread progress while rendering another pane/thread.
  Visible item HTML rendering now carries the same explicit context into
  context-compaction notes, reasoning visibility, task-card injected item
  timestamps, and item timestamp fallback through
  `renderVisibleItemPatchHtml(..., thread)`.
  Pending approval rendering now follows the same rule: thread-detail
  `pendingServerRequests` that omit `params.threadId` are tagged with their
  source thread before entering client state, and approval/user-input action
  HTML receives the pane thread id instead of falling back to global
  `state.currentThreadId`.
  Task-card draft rendering now also uses the render context thread when it
  checks whether a generated draft already has matching materialized task
  cards, so pane-local draft visibility is not decided from global
  `state.currentThread.threadTaskCards`.
  The queued draft materialization path follows that same ownership boundary:
  `queueThreadTaskCardDraftCreation(..., thread)` captures the pane source
  thread id and `createThreadTaskCardDraft(..., { threadId })` uses it for
  source payload metadata, local card upsert, pending counts, and diagnostics.
- Treat each pane as a scaled mobile single-thread runtime instance. Shared
  global Composer chrome is only an interim input surface; global command dock
  or shared operation bubble are no longer acceptable in tile mode and must not
  be considered closure for the split-screen feature.

### 2026-06-27 Post-v542 Local Slice Acceleration Rule

After v542, Phase C continues as small, locally committed context-ownership
slices instead of one long open-ended refactor. Each slice must:

- name one violated invariant and one owning layer;
- keep runtime scope narrow enough for focused tests plus full local checks;
- avoid shell/cache bumps, production deploys, and Public pushes until a
  coherent module is ready;
- update README and handoff with the slice boundary and validation evidence;
- commit locally after validation so later slices do not accumulate into an
  unreviewable diff.

The current follow-up slices focus on pane-local thread context propagation:
task-card action controls, approval controls, file preview controls, visible
item signatures, render/patch visible items, submitted progress state,
approval-request context, task-card draft render matching, queued draft
materialization, and draft state transitions. The draft state slice requires
`Dismiss` and materialization status changes to carry source thread id and
schedule either current-thread render or pane-local render, not global
`renderCurrentThread()` by default.
Server request answer handling follows the same rule: if an approval/user-input
response comes back without thread metadata, the client must preserve the
action's pane thread id before storing the returned request, so later
resolved/removal renders cannot fall back to the wrong current thread.
Thread goal notifications follow the same pane ownership boundary: updates and
clears must write both list state and visible pane detail cache, then schedule
the affected pane render instead of relying only on the global current thread.
Thread title/name updates follow that boundary too: local title changes must
write list state, current detail, and visible pane detail cache before
scheduling only the owning detail surface.
Thread title/name notifications must reuse that same local update path rather
than manually rewriting list/current/tile state in `applyNotification()`.
Optimistic thread running status now follows the same rule: a send from the
shared Composer must update the target thread's list row, current detail or
visible pane detail cache, and thread-status hint context before scheduling
only the owning detail surface.
The send-failure restore path is part of that invariant: thread status
snapshots must capture visible pane detail status, and restore must reset list,
current detail, and pane detail state before scheduling the owning detail
surface. A failed send must not leave a non-current pane looking active.
Thread status notifications follow the same helper path: `thread/status/changed`
must derive hint context from the local target thread, update list/current/pane
detail status through `updateThreadListStatus()`, and schedule pane-local
render before any background tile-detail reload.

### 2026-06-27 Phase C pane-context v544 deployable candidate

The post-v542 pane/context slices are now bundled as a deployable candidate
instead of continuing as open-ended micro-slices. Static shell/cache is advanced
to `codex-mobile-shell-v544`.

Deployable scope:

- pane toolbar actions, continuation confirmation, older-history pagination,
  and manual task-card creation resolve their owning pane/source thread before
  mutating state;
- pending approval/server-request writers, answer/resolution paths, and
  in-turn approval controls preserve pane thread id when server payloads omit
  `threadId`;
- task-card pending counts, draft state, draft creation, and visible draft
  matching update current detail, tile detail, and thread-list mirrors through
  pane-aware state paths;
- tile panes mirror the single-thread approval split: visible-turn approvals
  render inline in the turn, while active non-visible-turn approvals render in
  the pane body;
- thread metadata/status/title/goal notifications update visible non-current
  pane detail caches instead of relying on global current-thread render.

Pre-deploy validation for this candidate includes full local tests/checks plus
bounded fixture smoke:

- `node --test test/conversation-render.test.js test/thread-tile-state.test.js test/thread-tile-actions.test.js`
- `npm test`
- `npm run check`
- `npm run check:macos`
- `git diff --check`
- `node scripts/codex-mobile-thread-tile-visual-fixture.js --width 3000 --height 1800 --panes 5 --json`
- `node scripts/codex-mobile-thread-tile-visual-fixture.js --width 1366 --height 1024 --panes 3 --menu-overlay --json`
- `node scripts/codex-mobile-thread-tile-visual-fixture.js --width 1600 --height 1100 --panes 4 --task-card expanded --json`
- `node scripts/codex-mobile-long-turn-viewport-fixture.js --width 430 --height 932 --json`

This candidate is not deployed and not pushed Public at this point. Next action
should be either deploy/readback of v544 or an explicit decision to pause Phase
C and move to another phase.

### 2026-06-27 Thread-list local merge latency module

This server-only module follows the v550 projection diagnostic deployment.
Fresh production sampling showed the remaining default list-entry cost was not
the mux/app-server RPC: `/api/threads?limit=25` spent roughly `397-473ms` while
`appServerRpcMs` stayed around `7-9ms`. The hot path was local Mobile Node
merge work: warm fallback rows duplicated app-server ids, summary merge still
ran duplicate/display merge accounting across the effective list, and rollout
stat decoration could be repeated inside the same request.

Deployable scope:

- `/api/threads` passes `dropDuplicateFallbackThreads: true` into
  `thread-list-route-merge-service` so fallback rows are used for app-server
  omissions, but same-id fallback duplicates do not enter summary merge.
- `thread-list-summary-merge-service` only invokes duplicate display merge for
  actual duplicate ids; unique ids keep existing filter/strip/sort semantics.
- `server.js` reuses already-attached rollout size/stat metadata during
  same-request display-summary merge.
- The module does not change app-server authority, fallback cache lifecycle,
  thread-detail projection, list ordering rules, archived/hidden/sub-agent
  filtering, shell/cache version, or client UI behavior.

Closure requires focused route/summary/visibility coverage, full local checks,
central macOS plugin deployment, and bounded post-deploy samples proving
`routeMergeFallbackDuplicateDropCount`, `summaryMergeInputCount`,
`summaryMergeDisplayMergeMs`, `summaryMergeTotalMs`, `mergeMs`, and total list
latency move in the expected direction without leaking private thread content.

### 2026-06-28 Active Overlay Window-First Detail module

This module targets the residual active-detail latency after active overlay and
response-budget work. Production readback showed active detail could be warm and
already use `projection-active-overlay`, but the orchestrator still ran an
ordinary projection lookup before the active-overlay proof gate even when the
server had a dedicated lightweight active-overlay projection-window lookup.

Deployable scope:

- `adapters/thread-detail-read-orchestration-service.js` uses the dedicated
  `activeOverlayProjectionWindowLookup` first for active/running summaries when
  the active overlay provider is available. This avoids a duplicate normal
  projection normalize/assemble pass before proof-gating the live active turn.
- `adapters/thread-detail-performance-service.js` records
  `activeOverlayWindowFirst` so production readback can distinguish the hot
  path from the compatibility path that falls back to ordinary projection
  lookup.
- The module preserves fail-closed active overlay proof gates, projection-window
  authority, active-overlay merge rules, visible-item policy, and response
  budgeting. It is server orchestration cleanup, not client refresh masking.

Required validation:

- focused active-overlay integration, read-orchestration, performance, route,
  overlay-provider, overlay-policy, and client performance-metrics tests;
- full `npm test`;
- `npm run check`;
- `npm run check:macos`;
- `git diff --check`;
- central Home AI macOS plugin deployment;
- production readback comparing `activeOverlayWindowFirst`,
  `projectionMs`, `activeOverlayProjectionLookupMs`, `activeOverlayMergeMs`,
  `prepareResponseMs`, active detail response bytes, and
  `mobileDetailResponseBudget`.

### 2026-06-28 Active Turn Progressive Detail Budget module

This module targets the remaining active-detail payload pressure after
`projection-active-overlay` and thread-list first-paint deferral were deployed.
Production readback showed the detail path could be warm and still return a
large body because stale active-looking turns and the current active turn kept
many visible operation/reasoning/assistant progress rows.

Deployable scope:

- `adapters/thread-detail-response-budget-service.js` treats a known
  `activeTurnId` as the only current active response-budget owner. Older
  `inProgress` rows are counted as `staleActiveTurnCount` and shaped by
  completed-turn budgets.
- The same service applies pressure-triggered progressive active limits when
  the detail window crosses the item-count threshold or active/thread byte
  thresholds, lowering active operation/reasoning tails while protecting
  current active and latest-replay assistant/plan progress rows. The replay
  protection is bounded under progressive active pressure: active turns keep a
  trailing assistant/plan tail controlled by
  `CODEX_MOBILE_THREAD_DETAIL_PROGRESSIVE_REPLAY_ASSISTANT_ITEMS` (default
  `8`), while protected completed replay turns keep a separate tail controlled
  by `CODEX_MOBILE_THREAD_DETAIL_PROGRESSIVE_COMPLETED_REPLAY_ASSISTANT_ITEMS`
  (default `12`). The response records `progressiveReplayAssistantItems`,
  `progressiveCompletedReplayAssistantItems`, `limitedReplayAssistantItems`,
  and `limitedCompletedReplayAssistantItems`. This prevents a large active
  overlay from retaining every older completed assistant fragment while
  preserving the newest active progress. Under that progressive active pressure only, oversized retained active
  assistant/reasoning text fields are reduced to a bounded first-paint preview
  and marked with `mobileActiveTextBudget` / `mobileTextTruncated`. The text
  preview budget can be disabled for diagnostics with
  `CODEX_MOBILE_THREAD_DETAIL_PROGRESSIVE_ACTIVE_TEXT_CHARS=0`.
- Retained active operation items now get the same pressure-gated payload
  treatment. Large command output, file-change lists, collab-agent display text
  such as task/prompt fields, tool arguments/results, content item arrays, and
  bounded action/request/response payloads are reduced to bounded previews through
  `CODEX_MOBILE_THREAD_DETAIL_PROGRESSIVE_ACTIVE_OPERATION_PAYLOAD_CHARS`
  (default `6KB`, `0` disables). Affected operation items carry
  `mobileOperationPayloadBudget` / `mobilePayloadTruncated`; command output
  uses the existing `outputTruncated` / `outputTotalChars` UI path so the
  default first paint keeps the latest output tail without shipping the full
  payload.
- Retained active user-input items now have a matching pressure-gated first-paint
  budget for the cases that are not ordinary short prompts: large injected task
  cards, continuation/bootstrap text, and inline `data:image` input echoes.
  `CODEX_MOBILE_THREAD_DETAIL_PROGRESSIVE_ACTIVE_USER_TEXT_CHARS` (default
  `10KB`, `0` disables) bounds text previews, inline image data is replaced with
  metadata-only truncation markers, and affected user rows carry
  `mobileUserInputBudget` / `mobileUserInputTruncated`. This is HTTP response
  shaping only; the session/rollout source remains unchanged.
- After those per-type budgets, the same pressure condition can apply a
  first-paint visible item ceiling
  (`CODEX_MOBILE_THREAD_DETAIL_PROGRESSIVE_VISIBLE_ITEM_CEILING`, default `48`,
  `0` disables). The ceiling prunes older operation/reasoning rows before
  current active operation/reasoning rows and records
  `progressiveVisibleItemBudgetApplied`, `omittedVisibleItems`, and per-turn
  `mobileVisibleItemBudget`; user messages, images, Usage rows, diagnostics,
  and retained final assistant/plan receipts remain protected.
- The v558 browser slice renders per-turn `mobileVisibleItemBudget` as a compact
  first-paint omission notice in both single-thread and tiled panes. The notice
  enters the conversation render signature but is not a real `data-item`, so
  DOM/projection diagnostics can distinguish intentional server response
  budgeting from client-side lost messages.
- A follow-up first-paint byte ceiling now handles the residual case where the
  visible item count is bounded but retained completed receipts still make the
  detail body heavy. Under active progressive pressure, or on resting recent
  detail responses whose historical completed receipts still exceed first-paint
  byte pressure, when the post-item-budget thread JSON remains above
  `CODEX_MOBILE_THREAD_DETAIL_PROGRESSIVE_FIRST_PAINT_THREAD_BYTES` (default
  `160KB`), non-current/historical completed assistant/reasoning receipts are
  reduced to bounded previews using
  `CODEX_MOBILE_THREAD_DETAIL_PROGRESSIVE_COMPLETED_TEXT_CHARS` (default `8KB`
  per item). Under active first-paint pressure this preview rule can include the
  protected latest completed replay turn because the live active turn is the
  current reading target; resting responses still protect the latest completed
  turn. Items carry `mobileFirstPaintTextBudget`; the response records
  before/after first-paint byte counts, scope, skipped-latest count, and
  completed-text counters in `mobileDetailResponseBudget`.
- The protected-byte attribution follow-up does not change budget policy. It
  records bounded retained visible item counts/bytes by kind plus the largest
  retained item kind/size in `mobileDetailResponseBudget`, Phase-B readback,
  and decision evidence. This closes the evidence gap when
  `progressiveActiveFirstPaintItemBudgetReason` is
  `protected-visible-items` or `no-removable-visible-items`: the next slice can
  target the dominant protected shape instead of weakening user/assistant/Usage
  protection generically.
- When that protected attribution identifies assistant rows, the next evidence
  slice records retained assistant counts/bytes by turn state (`active`,
  `completed`, `staleActive`, `other`). Completed/replay assistant pressure can
  then be tightened through the completed replay assistant first-paint budget
  without weakening the current active assistant progress budget.
- Production readback after that attribution slice showed the protected active
  first-paint over-ceiling payload was dominated by completed `userMessage`
  items, not the current active input. The follow-up budget previews only
  historical/completed user input under active first-paint byte pressure using
  `mobileFirstPaintUserInputBudget` and
  `CODEX_MOBILE_THREAD_DETAIL_PROGRESSIVE_COMPLETED_USER_TEXT_CHARS` (default
  1024 chars). Later tightening makes that completed-user-input limit a shared
  newest-first first-paint budget across retained historical inputs instead of
  a per-row budget. Older completed inputs that exceed the shared budget retain
  a short placeholder so API-visible user-message counts still line up with
  browser-visible DOM rows; the placeholder includes a short stable token so
  multiple exhausted historical inputs in one turn stay distinct under client
  user-message shadowing/dedupe rules. It preserves active/current user input
  and does not mutate the stored rollout/session data.
- The next protected-payload slice handles completed `turnUsageSummary` rows
  under the same active first-paint byte pressure. It preserves the Usage row
  and the fields consumed by the UI, but drops repeated internal summary
  metadata from the HTTP response with `mobileFirstPaintUsageBudget` and
  `progressiveCompletedUsageBudgetApplied`. This keeps Usage visible while
  avoiding a generic budget that would hide user input, active assistant
  progress, images, or diagnostics. Production readback of the first version
  showed the per-row evidence marker could offset the summary savings for small
  Usage rows, so the follow-up makes that marker lightweight and skips Usage
  compaction unless the row remains smaller after the marker is attached.
  When task-card and user-input budgets leave only a small active first-paint
  residual, the follow-up Usage pass can compact already-budgeted completed
  Usage rows to summary-only fields: context percent, risk level, rollout size
  and threshold state, plus `totalTokenUsage.totalTokens`. That pass is still
  HTTP response shaping only, keeps the Usage row visible, and reports
  `progressiveCompletedUsageSummaryOnly*` plus
  `progressiveActiveFirstPaintBytesAfterUsageSummaryOnlyBudget` so Phase-B can
  attribute the remaining byte pressure without touching user/assistant text or
  `mobileVisibleItemKeys`.
- A later HTTP evidence slice keeps the budget policy and v4 visible-key
  contract unchanged but reduces ordinary first-paint detail bytes by emitting
  compact `mobileDetailResponseBudget` evidence on normal `/api/threads/:id`
  reads. The compact shape keeps the version, applied/progressive flags, key
  omitted/truncated counters, first-paint byte counters, and bounded retained
  item maps, while dropping zero/empty long-tail diagnostics. Phase-B,
  browser-runtime, and API thread self-checks request `budget=full` so deploy
  gates still validate the full response-budget contract.
- A later summary-phase slice targets warm projection hits whose `summaryMs`
  dominates `totalMs` even though `threadReadMs=0`. Detail summary resolution
  now merges the existing display-summary cache for local summaries and skips
  the synchronous app-server `thread/list limit=1000` refresh on display-cache
  hits. Repeated app-server summary refreshes for the same thread are suppressed
  for `CODEX_MOBILE_THREAD_DETAIL_SUMMARY_APP_SERVER_REFRESH_TTL_MS` (default
  `30s`). Missing local and display-cache summaries still use the app-server
  lookup so deep-link and true cold paths remain observable.
- `server.js` wires the progressive thresholds and effective active limits from
  bounded environment variables.
- Operation budgets now include `collabAgentToolCall`, and v4 visible-item
  normalization classifies those calls as `operation` so response-budget and
  browser status semantics stay aligned.
- The module preserves projection/read authority, active-overlay proof gates,
  visible-key rebuilds, and browser render semantics. It is server response
  shaping, not client refresh masking.

Required validation:

- focused response-budget, visible-key, active-overlay, orchestration, route,
  render, and performance-metrics tests;
- full `npm test`;
- `npm run check`;
- `npm run check:macos`;
- `git diff --check`;
- central Home AI macOS plugin deployment;
- production readback comparing active detail response bytes,
  `activeTurnCount`, `staleActiveTurnCount`,
  `progressiveActiveBudgetApplied`, `progressiveActiveBudgetReason`,
  active/thread byte counters, omitted item counts, and active text-budget
  counters.

### 2026-06-28 Thread List Default Warm-Cache Early Return module

This module targets the residual "successful but slow" ordinary thread-list
open after the process already has a compatible fallback cache. Production
sampling showed a first `/api/threads?limit=20` request could spend about two
seconds waiting in the Mobile Web app-server bridge while the mux's own
thread/list execution was only single-digit milliseconds. The same request
settled back to hundreds of milliseconds on repeat reads. The violated
invariant is that an ordinary unfiltered list request should not block first
paint on a synchronous app-server refresh when the same process already has a
compatible warm list baseline.

Deployable scope:

- `adapters/thread-list-app-server-fetch-policy-service.js` now owns
  `planThreadListInitialFallbackAttempt()`, separating explicit
  `initial=warm-fallback`, ordinary default warm-cache early return, and
  ineligible filtered/cursor/archived paths.
- `server.js` can answer no-search/no-cursor/non-archived default and Workspace
  `/api/threads` requests from an already-warm fallback cache and mark the
  app-server refresh deferred. Default reads report
  `appServerDeferredReason=warm-fallback-default` /
  `appServerDeferredInitialReason=default-warm-cache`; Workspace reads report
  `appServerDeferredReason=warm-fallback-workspace` /
  `appServerDeferredInitialReason=workspace-warm-cache`.
- Workspace reads can derive first-paint rows from the default visible-thread
  warm cache when an exact Workspace cache is not present; this reports
  `fallbackCacheDecision=workspace-derived-hit`.
- Ordinary default/workspace reads do not build a cold fallback baseline on cache miss.
  They fall through to the existing app-server path so true cold startup cost
  remains visible instead of being hidden by a new fallback layer.
- Search, archived, cursor, explicit `fallback=defer`, and explicit
  `initial=warm-fallback` semantics remain separate.

Required validation:

- focused thread-list app-server policy, visibility route, load-policy,
  coalescer, Phase-B readback, and performance-metrics tests;
- full `npm test`;
- `npm run check`;
- `npm run check:macos`;
- `git diff --check`;
- central Home AI macOS plugin deployment;
- bounded production readback proving ordinary default list reads can report
  `appServerMs=0`, `mobileDeferredAppServer=true`,
  `appServerDeferredReason=warm-fallback-default`, and
  `fallbackCacheDecision=compatible-hit` when the warm cache is available.

### 2026-06-28 Thread List Cold Initial App-Server Deferral module

This module closes the remaining first-paint coupling where
`/api/threads?initial=warm-fallback` still fell through to synchronous
app-server `thread/list` when the process fallback cache was cold. The route now
tries the warm fallback cache first, then builds the local fallback baseline on
cache miss, returns that baseline as the initial list, and marks the
authoritative app-server refresh as deferred.

Deployable scope:

- `server.js` handles cold initial fallback before app-server `thread/list`, so
  first-paint diagnostics can show `mobileInitialSource=fallback-baseline`,
  `mobileDeferredAppServer=true`, and
  `appServerDeferredReason=cold-fallback-initial`.
- `adapters/thread-list-app-server-fetch-policy-service.js` owns the bounded
  metadata that separates warm-cache and cold-baseline initial first paint.
- Existing deferred client refresh behavior in `public/app.js` remains the
  authority follow-up; search, workspace-filtered, archived, cursor, and
  explicitly full list reads are unchanged.
- The module does not change fallback baseline contents, thread-list authority,
  thread-detail projection, or UI ordering.

Required validation:

- focused thread-list app-server policy, fallback cache/baseline, visibility
  route, viewport, and Phase-B readback tests;
- full `npm test`;
- `npm run check`;
- `npm run check:macos`;
- `git diff --check`;
- central Home AI macOS plugin deployment;
- bounded production readback proving initial first paint reports
  `appServerMs=0` and deferred app-server refresh metadata.

### 2026-06-27 Large Session List First Paint v546 deployable module

This batched module targets the remaining large-session startup/load cost after
v545 proved thread detail could already use `projection-active-overlay`. Runtime
readback showed the ordinary default thread-list open still waited on local
summary merge and token-usage decoration even when the fallback cache was warm.

Deployable scope:

- `public/thread-list-load-policy.js` owns first-list request policy. Ordinary
  initial list paint uses the existing `initial=warm-fallback` path; active
  detail still uses `fallback=defer`; search/workspace-filtered requests remain
  full authoritative requests.
- `public/index.html`, `public/app.js`, `public/sw.js`, and the shell asset list
  load/cache the new helper under `codex-mobile-shell-v546`.
- `adapters/push-notification-service.js` display-summary cache can skip
  repeated read-time decoration when the list merge already has request-scoped
  rollout/session metadata.
- `adapters/token-usage-stats-service.js` adds a bounded in-process query cache
  for thread-list token decoration and invalidates it on completed-turn writes.
- The follow-up token-decoration peak slice makes that cache replay-aware:
  duplicate `turn/completed` events whose aggregate Usage row is unchanged no
  longer clear the query cache, and thread-list first paint may reuse an expired
  in-process Usage aggregate when the date/thread/workspace key still matches
  and no real completed-turn write invalidated it. `threadListTimings` now
  exposes token usage cache/query counters, and cold-path attribution can report
  `coldPathOwner=token-usage-decoration` when `decorateMs` dominates the list
  response.
- The module does not change thread-detail projection authority, visible-item
  ordering, task-card rendering, or fallback-cache data semantics.

Required validation for this module:

- focused thread-list load-policy, token-usage, display-summary cache, list
  route/merge/cold-path, and mobile-shell tests;
- full `npm test`;
- `npm run check`;
- `npm run check:macos`;
- `git diff --check`;
- central Home AI macOS plugin deployment with `/api/public-config` v546
  readback;
- bounded Phase-B readback smoke proving warm fallback cache and active-overlay
  detail still pass after deployment.

### 2026-06-27 Projection Consistency v545 deployable module

The next batched module closes the recurring projection/DOM mismatch class
instead of adding UI-only dedupe or refresh fallbacks. Static shell/cache is
advanced to `codex-mobile-shell-v545`.

Deployable scope:

- `planThreadDetailRefreshRender()` treats DOM shape as part of render
  authority. A stable signature still requires a full render when the DOM is
  missing visible turns/items, has duplicate render keys, or has a mismatched
  single-thread turn order.
- `planConversationHtmlUpdate()` and `updateConversationHtml()` carry expected
  visible turn/item counts, DOM turn/item counts, duplicate render-key count,
  and turn ids through the same planning boundary.
- After patch application, the browser re-reads the DOM shape. If the patch
  leaves a partial/corrupt DOM, it falls back to canonical HTML and emits
  bounded projection diagnostics.
- v4 notification normalization now uses nested `params.turn.id` for item-only
  notifications and makes duplicate visible keys unique inside one turn.
- Projection replay visual smoke compares API visible-key hashes against DOM
  render-key hashes and reports mismatch counts without raw ids, text, paths,
  or keys.

Required validation for this module:

- focused projection and render tests;
- full `npm test`;
- `npm run check`;
- `npm run check:macos`;
- `git diff --check`;
- central Home AI macOS plugin deployment with `/api/public-config` readback;
- bounded projection replay/readback smoke after deployment.

### 2026-06-27 Phase E Visual Harness Module v542

Phase E now has its first batched visual-harness module after the cadence
change. The module bundles two local slices instead of deploying each small
change separately:

- task-card tile visual coverage for collapsed, expanded, and keyboard-open
  pane states, including the pane-local CSS cap that keeps expanded task-card
  content inside the scaled pane and away from the shared Composer;
- image-order live-debug smoke privacy hardening, so the harness can be used as
  closure evidence without printing raw thread/turn/item ids, debug URLs,
  screenshot paths, DOM text, `location.href`, or error message bodies.

Static shell/cache is advanced to `codex-mobile-shell-v542` because the module
includes a `public/styles.css` runtime style fix. Local focused validation for
the module passed:

- `node --test test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js test/thread-tile-layout-ui.test.js test/image-order-visual-smoke.test.js`
  (`34` tests).
- full `npm test` (`1226` tests);
- `npm run check`;
- `npm run check:macos`;
- `git diff --check`.

Production deployment/readback:

- commit `a1d98d8b7f07`;
- deploy reason `codex-mobile-v542-phase-e-visual-harness`;
- production `/api/public-config` returned
  `clientBuildId=0.1.11|codex-mobile-shell-v542`,
  `shellCacheName=codex-mobile-shell-v542`, and `activeProfileId=previous`;
- selected mux refresh was skipped with `reason=no_mux_runtime_change`;
- source/prod hashes matched for `public/app.js`, `public/sw.js`,
  `public/styles.css`, the two Phase E visual scripts, and their focused tests;
- the bounded 1800px / 3-pane keyboard-open expanded-task-card fixture passed
  with `taskCardInsidePane=true`, `taskCardBodyScrollBounded=true`, and
  `taskCardNoComposerOverlap=true`.

Public publishing remains gated by production/user validation.

### 2026-06-27 Phase C Pane-State Module v541

Phase C is now batched as a coherent local pane-state module instead of a long
open-ended refactor. The five local slices move split-screen policy decisions
out of `public/app.js` and into `public/thread-tile-state.js`:

- viewport/composer chrome baseline planning;
- detail-load queue drain and settle follow-up planning;
- pane patch-miss full-render escalation intent;
- display-settings load, legacy migration, and local recovery planning.

This is an acceleration boundary, not a broad rewrite. The implementation
keeps `app.js` responsible for DOM/API/localStorage side effects while
`thread-tile-state.js` owns the tested policy decisions. Static shell/cache is
advanced to `codex-mobile-shell-v541`, and the module was deployed as one
runtime unit after the local validation gate passed.

Local validation for the module passed:

- focused Phase C suite:
  `node --test test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js test/thread-tile-state.test.js test/thread-tile-layout-ui.test.js test/tablet-layout.test.js`
  (`66` tests);
- full `npm test` (`1222` tests);
- `npm run check`;
- `npm run check:macos`;
- `git diff --check`.

Production deployment/readback:

- commit `7ba66236f480`;
- deploy reason `codex-mobile-v541-phase-c-pane-state`;
- production `/api/public-config` returned
  `clientBuildId=0.1.11|codex-mobile-shell-v541`,
  `shellCacheName=codex-mobile-shell-v541`, and `activeProfileId=previous`;
- source/prod hashes matched for `public/app.js`, `public/sw.js`,
  `public/thread-tile-state.js`, and focused pane-state tests; this deployment
  evidence section was updated locally after readback and is not itself
  production runtime evidence;
- the bounded 3000px / 5-pane visual fixture passed with a single row, no pane
  overlap, bottom Composer, and visible operation duration.

Public publishing remains gated by production/user validation.

### 2026-06-28 Thread-List Prewarm Source-Snapshot Coverage Module

This module targets the remaining first-entry peak after active-detail hot path
work. Production sampling showed default `limit=40&initial=warm-fallback`
requests using the warm process fallback cache in about hundreds of
milliseconds, while larger same-scope first-paint requests such as
`limit=137&initial=warm-fallback` could still rebuild the fallback baseline and
scan rollout tails even after prewarm had completed.

Root cause: final fallback cache entries are intentionally limit-scoped, and
the prewarm service warmed only the default final list. The underlying
source-snapshot mechanism could serve later filter/final-window misses, but the
prewarmed source snapshot did not have a guaranteed width covering larger
desktop/tablet first-paint limits. The result was a second cold source scan
for wider requests.

Scope:

- Keep final fallback cache limit-scoped so narrow cache entries are not used as
  wider authoritative lists.
- Let prewarm request a wider bounded `sourceSnapshotLimit` for the current
  process.
- Let wider same-scope final-list misses rebuild from that source snapshot
  without re-reading state DB, rollout tails, or `session_index.jsonl`.
- Expose `threadListFallbackPrewarm.sourceSnapshotLimit` and
  `lastSourceSnapshotLimit` through public-config/readback diagnostics.

Non-goals:

- Do not make fallback persistent authority.
- Do not change search/workspace/archive/cursor semantics.
- Do not add client refresh masking or UI dedupe.

Required validation:

- Focused tests for fallback cache, baseline, prewarm, Phase-B readback, and
  thread-list route visibility.
- Full `npm test`, `npm run check`, `npm run check:macos`, and
  `git diff --check`.
- Production readback should prove that prewarm reports
  `sourceSnapshotLimit=1000`, and a larger same-scope
  `initial=warm-fallback` request avoids rollout/source rereads after prewarm.

### 2026-06-28 Thread-List Persistent Warm Baseline Module

This module targets the remaining restart/deploy peak where the process-local
fallback cache and source snapshot are both lost. Hot production sampling showed
ordinary list reads in tens of milliseconds once warm, but `/api/public-config`
could still report startup prewarm `lastCacheDecision=miss-rebuild` with
multi-second elapsed time after a listener restart.

Root cause: the fallback cache service owned the correct in-process baseline,
but it had no bounded persistent warm-start record. A fresh process therefore
had to rediscover the same thread-list summaries by scanning state DB, rollout
session files, and `session_index.jsonl` before the first default list could
hit `warm-fallback-cache`.

Scope:

- Persist only bounded thread-list summary cache entries under the runtime root.
- Restore those entries into the process fallback cache at service startup.
- Keep final cache entries limit-scoped and still keyed by visible workspace
  roots/projectless ids/search/cwd.
- Keep app-server list rows, visibility filters, source snapshots, and
  notification-driven upsert/remove/status updates as the live correctness
  owners.
- Treat missing/corrupt/unsupported persistent files as cold cache misses, not
  normal empty state.
- Expose `fallbackCachePersistentRestored` in thread-list timings for production
  readback.

Non-goals:

- Do not persist full conversations, task-card bodies, prompts, uploads, or raw
  rollout paths.
- Do not turn fallback cache into authoritative state.
- Do not add a client-side timeout or loading-mask workaround.

Required validation:

- Focused cache/store tests proving a new service instance restores a warm
  entry without reading state DB, rollout, or session-index sources.
- Corrupt-file test proving fail-cold behavior.
- Thread-list route/readback evidence showing first default list after restart
  can hit `warm-fallback-cache` with `fallbackCachePersistentRestored=true` once
  a previous process has written the runtime cache.

### 2026-06-28 Thread-List Successful Slow-Path Diagnostics Module

This module targets the residual user-visible shape where a thread list or
startup list load takes noticeably long but eventually succeeds. Before this
slice, detail had a slow-path watchdog, while successful thread-list loads only
posted `thread_list_rendered` performance events and then cleared ordinary
load-failure diagnostics. That meant repeated successful stalls could fail to
enter the Home AI Owner-gated repair loop.

Root cause: the client treated successful list responses as normal completion
regardless of elapsed/API/render duration. The list performance event already
had the right bounded timing evidence, but there was no slow-path diagnostic
planner or event payload for list success.

Scope:

- `public/thread-performance-metrics.js` plans `thread_list_slow_path` from
  `thread_list_rendered` evidence when elapsed, API, or render time crosses the
  bounded list threshold.
- `public/thread-diagnostic-events.js` builds metadata-only list slow-path
  failure/success payloads with phase labels and bounded timing/count fields.
- `public/app.js` records the slow-path failure or clears the signature after
  each successful list load, while preserving the existing load-failed
  diagnostic for true errors.
- Static shell/cache is bumped because browser scripts changed.

Non-goals:

- Do not add a loading-mask, client retry loop, or duplicate-render fallback.
- Do not include thread titles, prompts, task-card bodies, upload names, local
  paths, cookies, tokens, or raw app-server payloads in diagnostics.

Required validation:

- Focused tests for list slow-path planning, diagnostic payload privacy, and
  app wiring.
- Full `npm test`, `npm run check`, `npm run check:macos`, and
  `git diff --check`.
- Production readback should confirm the v556+ shell and still show fast warm
  list/detail paths; future repeated slow list cases should surface as Home AI
  `thread_list_slow_path` diagnostics.

### 2026-06-28 Thread Detail Slow-Success Diagnostic Aggregation module

Production and client logs showed the user-visible shape where a thread can
keep loading for 1-3 seconds, then eventually render normally. This is not the
old timeout path: recent samples showed `turns-list-initial` detail reads around
1.2-2.3s followed by warm projection reads around tens of milliseconds. The
existing slow-path reporter recorded some of these cases, but the repeat
signature included volatile client build id, read mode, render mode, and source
kind, so repeated user-visible slow opens could stay below the Home AI reporting
threshold while builds and projection paths changed.

Deployable scope:

- `public/thread-performance-metrics.js` lowers the default successful
  thread-detail slow threshold from 8s to 1.5s while keeping explicit caller
  thresholds supported.
- `public/home-ai-diagnostic-reporting.js` aggregates slow-path repeated
  failures by stable surface/action/thread/error identity. Build id, read mode,
  render mode, and source kind remain in the bounded report payload for
  attribution, but no longer split the repeat counter.
- The diagnostic sanitizer preserves safe cold-path labels such as
  `cold_path_owner` and `cold_path_reason` while still stripping raw paths,
  URLs, prompts, message bodies, task bodies, uploads, cookies, tokens, and
  long logs.

Required validation:

- Focused diagnostic-reporting, thread-performance, and diagnostic-event tests.
- Full local checks and a central deploy/readback if this module is released.

### 2026-06-28 Thread Display Self-Check Repeat Module

This module expands the production self-check path so projection/list display
regressions can be found by tooling instead of waiting for a user screenshot.
It is diagnostic/verification code only; it does not add a rendering fallback or
change thread-detail projection authority.

Root cause addressed: `scripts/codex-mobile-thread-self-check.js` exposed
`--repeat`, but only performed one second read for list/detail checks. A
transient middle-sample failure could recover before the final read and escape
the summary, which made intermittent missing-message, stale-list, or timestamp
loss reports harder to reproduce.

Scope:

- `scripts/codex-mobile-thread-self-check.js` now samples list/detail reads for
  the full repeat count. It records only repeat comparisons with issues, while
  keeping the existing first/final compatibility fields.
- `adapters/thread-detail-self-check-service.js` now classifies additional
  metadata-only display-contract issues: latest completed Usage without an
  assistant response, latest completed replay without user-input rows as an H3
  warning, refresh loss of user-input rows, assistant rows, visible timestamps,
  and turn start/completion timestamps, plus thread-list repeat lost rows and
  updated-at downgrades.
- Combined summaries deduplicate identical issue metadata so repeated samples
  do not inflate the blocking/warning counts. They now retain bounded
  occurrence counts and produce metadata-only `diagnosticCandidates` for H1/H2
  findings and repeated H3 warnings, so Home AI can create an Owner-gated
  remediation case without private thread text or screenshots. This remains
  diagnostic evidence only; self-check ingestion must not directly dispatch a
  repair card.

Required validation:

- Focused self-check service/script tests.
- Live self-check with `--sample-threads 5 --repeat 5` should return no H1/H2
  blockers before using the result as a deployment gate.
- Full local checks and central deploy/readback when this module is released.

### 2026-06-29 Runtime Self-Check Gate v2

This module turns the production self-check loop into an explicit deployment
and periodic-health gate instead of leaving callers to infer policy from raw
child-check `ok` flags.

Root cause addressed: after slow-path diagnostics were added, repeated
`thread_session_slow_path` samples could look like H2 failures even when the
thread eventually loaded correctly. At the same time, user-visible projection,
image, duplicate-message, timestamp, submit, and list/detail failures must
still block deploys and remain reportable.

Scope:

- `adapters/runtime-self-check-gate-service.js` owns the deterministic policy:
  H1/H2 user-visible runtime regressions and self-check execution failures are
  deploy-blocking/reportable; slow-success thread-session timing findings are
  observe-only; lower severity nonblocking findings are advisory.
- `scripts/codex-mobile-runtime-self-check-loop.js` emits the service result as
  `gate` with `deployPass`, reportable/observe-only/advisory counts, and
  bounded issue-code groups. `--gate-mode deploy` labels deploy-time runs while
  periodic loop output stays metadata-only JSONL.
- The gate does not dispatch repair cards and does not alter thread projection
  or browser rendering. Home AI diagnostic intake and Owner approval still own
  remediation-card creation.

Required validation:

- Focused tests for the gate service and runtime loop policy.
- Full local checks and `git diff --check`.
- Private deployment through the Home AI Deploy lane, followed by production
  runtime self-check with `--gate-mode deploy`.

### 2026-06-29 Runtime Self-Check Scheduler Readback v2

This module makes the existing macOS 10-minute runtime self-check LaunchAgent
auditable from source-controlled tooling. It does not create a new renderer
fallback, change projection authority, or dispatch repair cards.

Root cause addressed: the periodic checker existed as a local LaunchAgent, but
operators still had to inspect `launchctl` and raw JSONL tails manually to know
whether the checker was loaded, fresh, gate-bearing, and healthy. That made
post-deploy closure depend on ad hoc shell evidence instead of a repeatable
bounded readback.

Scope:

- `adapters/runtime-self-check-launchagent-service.js` owns pure readback
  policy for plist shape, launchctl state, latest JSONL gate event, freshness,
  and health classification.
- `scripts/codex-mobile-runtime-self-check-launchagent-readback.js` reads the
  user LaunchAgent, current launchctl state, and latest runtime self-check JSONL
  without mutating launchd. It reports only metadata-safe state, counts, path
  hashes, and issue codes.
- Missing/unloaded/stale/no-gate/unhealthy periodic self-check state is
  blocking. A checker that is actively running after a previous nonzero exit is
  advisory, so natural recovery is not marked failed before the current run can
  write a fresh result.

Required validation:

- Focused LaunchAgent service/readback tests.
- Live readback against `com.hermesmobile.codex-mobile-runtime-self-check`.
- Full local checks and central private deploy/readback when this module is
  released.

### 2026-06-28 Initial Active Window Overlay Module

Production readback after the recent rich-replay repair showed a remaining
slow-success active-detail path:

- `turns-list-initial` discovered an active turn that the summary had missed;
- correctness protection promoted the request to active full read;
- the detail response was correct, but one sample still spent several seconds
  in `thread/read`.

This module keeps the same fail-closed projection authority but removes that
unnecessary full-read step when evidence is already sufficient. If the initial
recent `turns/list` response contains an active turn, read orchestration upgrades
that window into a `turns-list-active-overlay-window` proof input and asks the
server-owned active-overlay provider for live overlay evidence. Only a complete
`thread-detail-active-window-overlay-policy-service` proof may return
`projection-active-overlay`; missing, stale, mismatched, non-authoritative, or
incomplete evidence still falls through to full `thread/read`.

The module does not add a client fallback, does not relax the active-overlay
proof gate, and does not persist raw live turn payloads. It moves an already
available bounded initial window into the existing server-side overlay proof
path.

Required validation:

- focused `thread-detail-read-orchestration-service` coverage proving a
  summary-missed active initial window can return `projection-active-overlay`
  without full `thread/read`;
- focused projection/active-overlay related suite;
- full local checks and central deploy/readback when released;
- Phase-B readback should no longer classify the same sample as
  `activeFullReadReason=initial-window-active-turn` with
  `activeOverlayGate=needs_repair` when overlay evidence is complete.

### 2026-06-28 Active Overlay Completeness Gate Module

User reports after the initial active-window overlay repair showed a separate
correctness risk: an in-progress turn could display only the latest few
assistant items when the process had only a notification-tail live snapshot.
That snapshot was useful evidence that a turn was active, but it was not proof
that the active turn body was complete.

Deployable scope:

- `thread-detail-active-overlay-provider-service` now labels live projection
  snapshots with bounded completeness metadata. Notification-shell snapshots,
  explicit partial snapshots, and snapshots without signature evidence are
  treated as partial.
- `thread-detail-active-window-overlay-policy-service` requires complete active
  overlay evidence. A `projection-live` overlay must be `full`, `backfilled`, or
  `preserved`; partial live evidence fails closed with
  `active-overlay-turn-incomplete`.
- `thread-detail-read-orchestration-service` may still use the pre-initial
  active-overlay hot path, but a live overlay must first be backfilled from an
  active-window projection and re-proven as `backfilled` before this preprobe is
  allowed to return a detail response. If backfill is unavailable, the route
  continues to the initial active-window/full-read path rather than returning a
  stale or truncated live snapshot.
- `thread-detail-projection-service` allows stale full active-window history to
  be used only when the live overlay already proves active status, preserving
  the server-side proof boundary without promoting notification shells.

Required validation:

- focused active-overlay provider, policy, projection, and read-orchestration
  tests proving notification-shell snapshots are rejected, full snapshots can
  use the fast path, and partial snapshots are backfilled before return;
- broader detail/projection/self-check suite;
- `npm test`, `npm run check`, `npm run check:macos`, and `git diff --check`;
- central plugin deployment and production self-check/readback proving active
  raw/detail assistant counts match and `projection-active-overlay` responses
  report `activeOverlayCompleteness=full` or `backfilled`, not `partial`.

### 2026-06-29 Public Config Hot-Path Module

After the active-overlay fresh-window rule reduced large active-thread detail
reads to low hundreds or tens of milliseconds, repeated production probes still
showed `/api/public-config` taking hundreds of milliseconds and occasionally
close to one second. This request is part of startup, refresh, embedded recovery,
and self-check entry, so it can make thread entry feel unstable even when
thread-detail itself is warm.

Root cause boundary:

- `public-config` was assembling profile/quota state and then calling MCP
  registration with another profile enumeration in the same request;
- `codex-profile-service.profiles()` scans account-scoped rollout quota tails for
  each known profile, which is correct profile evidence but unnecessary to repeat
  for every immediate startup/refresh probe when active quota evidence has not
  changed;
- build identity fields (`buildId`, `clientBuildId`, `shellCacheName`) must still
  be read live on every request and cannot be cached at Node startup.

Deployable scope:

- add `adapters/public-config-runtime-cache-service.js` as the owner of the
  short process-local profile/quota snapshot cache;
- key the cache by bounded active quota evidence and expire it quickly;
- invalidate it when profile switching writes a new active profile;
- reuse the single profile state for both public response assembly and
  `syncKnownCodexMobileMcpToolsets()` so one request does not scan profiles
  twice;
- keep profile-list and profile-switch routes strongly current.

Required validation:

- focused service tests for cache hit, active-quota signature miss, TTL expiry,
  and explicit invalidation;
- existing profile/restart/new-thread route assertions proving quota refresh and
  MCP toolset registration remain wired;
- production readback comparing repeated `/api/public-config` wall time before
  and after deploy, plus Phase-B/runtime self-check gate for regression.

### 2026-06-30 Active Thread Frontend Consistency Hotfix

User-reported regressions exposed three browser-owned consistency failures while
the server/API projection remained authoritative:

- visible items could remain in an older DOM order after a local patch reused
  existing nodes, even when `/api/threads/:id?mode=recent&budget=full` returned
  the correct order;
- entering an active thread could first paint a previously cached in-progress
  receipt for several seconds before the fresh detail response arrived;
- a sent user message could be durable and visible while the local failed
  optimistic Composer echo still showed a retry state.

Scope:

- `public/thread-detail-dom-patch.js` now moves reused/patched visible-item DOM
  nodes into the next projection order and validates post-apply item order.
- `public/thread-detail-state.js` rejects active/running loaded detail as
  reusable `cached-current` first-paint state, returning
  `active-detail-cache-not-reusable` so active threads use a loading/fresh detail
  path instead of stale exit-state detail.
- `public/app.js` hides failed optimistic user-message echoes once a durable
  matching user message is visible and clears `mobileSendError` when the durable
  row wins a same-message merge.
- Static shell/cache identity advances to `codex-mobile-shell-v599`.

Required validation:

- focused DOM patch, thread-detail state, conversation render, and static build
  guard tests;
- broader render/self-check tests covering browser runtime expectations;
- full local checks, `git diff --check`, CodeGraph sync/status, then central
  private deploy/readback before considering the user-visible regressions
  closed.

### 2026-06-30 Active Thread Loading Preview Follow-Up

The v599 production deploy proved the ordering and failed-retry markers were
present, but the deploy-mode browser gate still failed on
`browser_dom_sparse_after_nonempty` and `browser_pending_user_message_disappeared`.
The API child remained clean and client-event stalls were zero, so the residual
was a browser first-paint state transition rather than server projection order
or a main-thread stall.

Root cause: v599 correctly stopped treating active cached detail as reusable
completed-state detail, but the fallback path first painted an empty loading
shell while waiting for `/api/threads/:id?mode=recent`. On slow active-thread
detail reads or repeated browser self-check switches, that empty shell looked
like a real content disappearance and made thread entry feel slow.

Scope:

- `public/thread-detail-state.js` builds an active loading preview from cached
  active detail. Completed history and current user input remain visible, while
  stale active assistant/plan/Usage/operation progress is stripped before fresh
  detail replaces the preview.
- `public/app.js` uses that preview for thread-open first paint when
  `planThreadOpenCacheReuse()` returns `shouldUseActivePreview`.
- `adapters/browser-runtime-self-check-service.js` treats nonempty loading
  previews as transitional for latest-turn downgrade and pending-message
  disappearance checks, while still blocking empty/sparse settled samples and
  real completed/resting downgrades.
- Static shell/cache identity advances to `codex-mobile-shell-v600`.

Required validation:

- focused active-preview and browser-runtime self-check tests;
- runtime deploy gate after private deploy must be clean of H1/H2
  `browser_dom_sparse_after_nonempty`,
  `browser_pending_user_message_disappeared`, and latest-turn downgrade codes;
- loading-speed readback should record thread-list/detail timings and browser
  sample duration, because the user reported all threads feeling slow after the
  update.

## Release Rule

Follow the current release order:

1. Implement and validate locally.
2. Deploy to Mac production only after the user asks for deployment.
3. Push or sync Public only after production/user validation.

Do not publish `.agent-context`, runtime state, local keys, upload contents,
full rollouts, access keys, launch tokens, private logs, or machine-specific
diagnostics.
