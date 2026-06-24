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

Status: in progress.

- Keep large-session timing evidence in `mobileDiagnostics.threadDetailTimings`
  and client `performancePhase` events.
- Move deterministic completed-turn diagnostics out of `server.js` into a
  service module.
- Preserve the rule that explicit empty final assistant messages produce
  `turnDiagnostic` / `runtime_completed_without_response`, not a synthetic
  `agentMessage`.

### Phase 2: Frontend State Ownership

Status: in progress. The first slices extract item visible-field merge policy,
visible-text render identity / completed-receipt retention, and local-only item
retention/drop policy to `public/thread-detail-state.js`; broader thread detail
merge orchestration and DOM patching remain in `public/app.js`.

Target:

- Extract thread detail merge/state rules from `public/app.js` into a pure
  helper module.
- Keep `public/app.js` responsible for DOM wiring, patch application, and event
  binding only.
- Cover user-message echo convergence, live receipt preservation, completed
  receipt authority, task-card folding, and diagnostic item rendering with
  focused tests.

### Phase 3: Thread Detail Read Orchestration

Target:

- Extract `/api/threads/:id` read orchestration from `server.js` into a
  service-level coordinator.
- Keep summary lookup, projection input, projection hit assembly, thread-read
  fallback, turns-list fallback, rollout enrichment, and response diagnostics
  testable without the route handler.
- Preserve the first-paint contract for large sessions. Do not introduce
  deferred incomplete detail enrichment as a UI fallback for server cold-path
  slowness.

### Phase 4: Browser And Visual Coverage

Target:

- Add DOM/browser smoke coverage for mobile composer stability, conversation
  patch jitter, task-card expand/collapse, uploaded/generated image rendering,
  and PWA refresh behavior.
- Prefer evidence-driven fixes over client-only duplicate filtering or visual
  masking.

### Phase 5: User-Managed Split Reading

Target:

- Evolve the current explicit `单线程` / `平铺` display setting into a
  split-screen reader where the user can add panes, close panes, drag widths,
  decide how many threads stay visible, and type into each pane through a
  pane-local composer.
- Keep the current automatic tile policy as the interim capability gate for
  iPad/desktop width, not as the final interaction model.
- Preserve action ownership: v415 already routes the shared bottom Composer's
  draft key, send target, Stop/steer state, local echo, and failure receipt to
  the selected active pane, and operation bubble state is pane-local. Future
  work should continue that ownership model instead of falling back to the
  first/current global thread.
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
