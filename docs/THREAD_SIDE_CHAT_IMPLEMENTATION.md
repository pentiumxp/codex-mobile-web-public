# Thread Side Chat Implementation Plan

This document maps the current-thread side chat feature onto the Codex Mobile
Web code layout and test strategy.

## Implementation Status

The v253 implementation includes the server-owned persistence store,
authenticated routes, combined left-swipe panel UI, draft autosave, candidate
queue/cancel, main-thread apply through `turn/start`, and hidden AI sidecar
replies.

Side-chat messages are private planning messages. Sending one creates or reuses
one hidden read-only sidecar Codex thread for the current main thread, starts a
sidecar turn with bounded parent-thread context, and writes the assistant reply
back to the Codex Mobile side-chat transcript. The sidecar thread is filtered
from normal Mobile thread lists and completion notifications. The sidecar
transcript remains an implementation detail; the Codex Mobile side-chat store is
the source of truth shown in the panel.

## Module Ownership

### Server-side

- `adapters/thread-side-chat-service.js`
  - per-thread side-chat state normalization;
  - transcript/draft/candidate bounds;
  - optimistic version checks;
  - storage and compaction;
  - queued apply idempotency;
  - hidden sidecar metadata and assistant reply lifecycle state;
  - safe public shape generation for the browser.

- `server.js`
  - route wiring;
  - authenticated side-chat state reads and updates;
  - side-chat send endpoint orchestration;
  - hidden sidecar thread creation/reuse and read-only reply execution;
  - queued apply hook on `turn/completed`;
  - SSE or thread-detail refresh integration.

### Browser-side

- `public/side-chat-runtime.js`
  - owns Subagent item/status calculations for the upper section;
  - renders the two-region side panel and side-chat transcript/composer;
  - normalizes server side-chat state for the current thread;
  - wires side-chat save/send/clear/apply/cancel/candidate actions through
    injected server-route callbacks;
  - autosaves side-chat draft state through server routes only;
  - owns Subagent edge-swipe gesture policy and visual-harness fixtures.

- `public/app.js`
  - integrates the runtime into current thread open/close lifecycle;
  - injects state, DOM, API, rendering, timing, and diagnostic dependencies;
  - keeps compatibility wrappers for existing callers;
  - closes or refreshes the side panel on thread navigation.

- `public/styles.css`
  - split panel layout;
  - independent scroll regions;
  - lower side-chat composer;
  - queued/candidate visual states;
  - mobile keyboard constraints.

### Service worker

- `public/sw.js`
  - bump shell cache only when frontend assets ship.
  - no side-chat state belongs in the service worker cache.
  - side-chat state must not be cached client-side.

## Proposed Routes

Initial route shape:

- `GET /api/threads/:threadId/side-chat`
- `PUT /api/threads/:threadId/side-chat/draft`
- `POST /api/threads/:threadId/side-chat/messages`
- `POST /api/threads/:threadId/side-chat/candidates`
- `POST /api/threads/:threadId/side-chat/candidates/:candidateId/queue`
- `POST /api/threads/:threadId/side-chat/candidates/:candidateId/apply`
- `POST /api/threads/:threadId/side-chat/candidates/:candidateId/cancel`
- `POST /api/threads/:threadId/side-chat/clear`

All routes must require the normal Codex Mobile access key/session boundary.
Routes return bounded public side-chat state and must not return hidden sidecar
thread raw payloads.

The apply/send route is present only because it is wired to the main-thread
`turn/start` integration. The service marks a candidate `sending` before the
RPC, records the returned turn id on success, and marks the queue `failed` with a
bounded error if the app-server call is not accepted.

## Storage Strategy

Preferred first implementation:

- `adapters/thread-side-chat-service.js`;
- server-owned JSON or SQLite store under the Codex Mobile runtime state root;
- one record per main-thread side-chat state plus message/candidate entries.

Minimum fields:

- active profile id or resolved Codex home identity;
- main thread id;
- optional workspace/cwd label;
- monotonic version;
- transcript messages;
- current draft;
- candidates;
- queue state;
- applied idempotency keys;
- created/updated timestamps.

The first persistence foundation may use JSON for consistency with nearby
runtime stores. If JSON storage is used instead of SQLite, the service must
still provide:

- atomic write through temporary file rename;
- idempotency lookup;
- bounded compaction;
- focused tests for corrupt/missing file recovery.

The browser must not use localStorage, sessionStorage, IndexedDB, or
`public/draft-store.js` for side-chat persistence or draft backup. All saved
side-chat transcript, draft, candidate, and queue state must round-trip through
the server routes.

## Hidden Sidecar Thread Fallback

The current public app-server schema does not expose a dedicated side-chat
method. If AI replies inside side chat are required before an official method is
available, implement a hidden sidecar fallback.

Fallback requirements:

- create at most one hidden sidecar conversation per main thread unless the
  record is missing or invalid;
- mark it with metadata that ties it to the parent thread id;
- filter it out of normal Mobile thread list and archive/search surfaces;
- do not use it as the source of truth for side-chat transcript display;
- keep the Codex Mobile side-chat store as the source of truth;
- use read-only or no-side-effect settings where app-server permits;
- seed only bounded parent-thread context;
- never apply sidecar output to the parent thread automatically.

If a future Codex app-server release exposes an official side-chat primitive,
prefer that over hidden sidecar threads and update this document.

## Queued Apply Execution

Queue lifecycle:

1. User selects a candidate and chooses queue/apply.
2. Server stores queue state with an idempotency key.
3. If the main thread is idle and the user chose immediate apply, call
   `turn/start` once.
4. If the main thread is running, wait for the matching `turn/completed` or a
   later idle status refresh.
5. Before starting the queued turn, re-read queue state and confirm it is still
   queued.
6. Mark queue `sending` before calling app-server.
7. Store the returned turn id and mark queue `sent`.
8. If app-server call fails before acceptance, restore queue to `queued` or
   `failed` with a bounded retry error.

Do not implement queued apply with `turn/steer`.

## Suggested Implementation Sequence

1. Add `docs/THREAD_SIDE_CHAT_*` planning docs.
2. Add `adapters/thread-side-chat-service.js` with server-side state operations
   and no browser-local persistence fallback.
   tests.
3. Add side-chat persistence routes in `server.js`.
4. Add browser panel helper code in `public/app.js`; extract to
   `public/thread-side-chat.js` only if the side-chat client grows further.
5. Refactor the existing Subagent panel render path into a two-region side
   panel without changing Subagent item semantics.
6. Add side-chat composer, transcript, candidates, and queue controls.
7. Add queued apply execution on idle/completion, including the real main-thread
   `turn/start` call and apply route.
8. Add hidden sidecar thread fallback only if needed for AI side-chat replies.
9. Add mobile visual validation through the platform live debug tool.
10. Bump shell cache and run full checks before production deployment.

## Focused Tests

Add or update:

- `test/thread-side-chat-service.test.js`
  - per-thread isolation;
  - draft persistence;
  - transcript bounds;
  - candidate lifecycle;
  - queued apply idempotency;
  - corrupt/missing store recovery.

- `test/thread-side-chat-route.test.js`
  - auth boundaries;
  - route shapes;
  - stale version handling;
  - safe public payloads.

- `test/conversation-render.test.js`
  - side panel renders outside main message flow;
  - side-chat messages are not normal `userMessage` cards;
  - queued candidate state is visible and cancellable.

- `test/collab-agent-render.test.js`
  - existing Subagent status still renders;
  - left swipe opens the combined side panel;
  - Subagent is in the upper region and side chat is in the lower region.

- `test/mobile-viewport.test.js`
  - small viewport panel layout;
  - keyboard-safe lower side-chat composer;
  - no overlap with main composer.

- `test/thread-detail-projection-service.test.js` or route-level tests
  - side-chat private messages do not appear in thread-detail projected turns.

## Validation Expectations

For documentation-only changes:

- `git diff --check`.

For implementation changes:

- focused side-chat tests first;
- `node --check` for new JS files;
- `npm run check`;
- `npm test`;
- `npm run check:macos`;
- platform contract check;
- visual validation through the platform live debug tool, preferably
  `npm run ios:pwa:debug` from the Home AI app workspace.

Production deployment should happen only after development validation confirms:

- left swipe opens the combined panel;
- Subagent upper region still works;
- side-chat lower region restores per-thread state;
- sending side-chat messages does not add main-thread messages;
- queued apply starts exactly one main-thread turn.

## Risks

- app-server has no public side-chat primitive, so hidden sidecar fallback could
  leak if thread filtering is incomplete;
- queue replay can duplicate main-thread turns without strict idempotency;
- thread switching can lose drafts if server saves are not flushed before route
  changes;
- using main composer helpers can accidentally pollute the main transcript;
- keyboard layout bugs are likely because the side-chat composer sits in the
  lower half of an overlay panel;
- frontend complexity should be extracted early to avoid further growth in
  `public/app.js`.

## Decision Rule

Do not implement side chat as direct `turn/steer` into the active main turn.
Do not implement it as a visible normal thread. The product-visible model is a
per-current-thread sidecar with explicit apply boundaries.
