# Thread Side Chat Design

This document describes the planned design for a current-thread side chat in
Codex Mobile Web.

## Concept

Thread side chat is a **sidecar conversation** attached to a main Codex thread.
It is not a normal message stream and it is not a user-visible independent
thread.

The side chat can help the user think through a new idea while the main thread
continues its current work. Only the user's explicit apply action can move a
distilled instruction into the main thread.

The design follows the same safety principle as cross-thread task cards:
pending or exploratory content stays outside normal message flow until the user
approves a boundary crossing.

## Official Product Alignment

OpenAI's Codex documentation describes side chats as useful for status recaps or
explanations without interrupting the main task. The public app-server API also
distinguishes active-turn steering from history injection:

- `turn/steer` appends input to the current in-flight turn;
- `thread/inject_items` appends model-visible items to loaded thread history
  without starting a user turn.

Codex Mobile should treat `turn/steer` as the wrong primitive for ordinary side
chat. Side chat is a protected discussion surface first; apply-to-main is a
separate explicit action.

## Panel Layout

The current left-swipe Subagent panel becomes a current-thread side panel.

```
+------------------------------------+
| Current-thread side panel          |
|                                    |
| Subagent status                    |
| - running / queued / completed     |
| - compact child-agent rows         |
|                                    |
|------------------------------------|
| Side chat                          |
| - transcript                       |
| - generated candidates             |
| - queued apply state               |
| - side-chat composer               |
+------------------------------------+
```

Layout rules:

- the panel is opened by the existing left-swipe gesture from thread detail;
- Subagent status occupies the upper region;
- side chat occupies the lower region;
- each region has its own scroll container;
- if height is constrained, side chat keeps enough height for transcript,
  queued state, and composer;
- the main composer remains separate and must not be confused with the side-chat
  composer.

## State Model

Canonical per-thread state:

```json
{
  "threadId": "019e...",
  "workspaceId": "optional-workspace-id",
  "profileId": "active-codex-profile",
  "version": 7,
  "messages": [
    {
      "id": "scm_01...",
      "role": "user",
      "text": "I noticed a possible edge case.",
      "createdAt": "2026-06-09T00:00:00.000Z"
    }
  ],
  "draft": {
    "text": "Need to ask about..."
  },
  "candidates": [
    {
      "id": "scc_01...",
      "title": "Follow-up instruction",
      "body": "After the current turn finishes, verify...",
      "status": "draft|queued|applied|cancelled",
      "createdFromMessageId": "scm_01..."
    }
  ],
  "queue": {
    "candidateId": "scc_01...",
    "mode": "confirmWhenIdle|autoSendWhenIdle",
    "status": "queued|sending|sent|cancelled|failed",
    "idempotencyKey": "sidechat:019e...:scc_01..."
  },
  "audit": {
    "createdAt": "2026-06-09T00:00:00.000Z",
    "updatedAt": "2026-06-09T00:00:00.000Z"
  }
}
```

The `version` field is a monotonic optimistic-concurrency token. Route handlers
should reject stale destructive updates or merge text-only draft updates safely.

## Side-Chat Conversation Engine

The preferred integration is an upstream official side-chat API if Codex
app-server exposes one in a future release.

Current public schema does not expose a dedicated side-chat request. If no
official primitive is available, the fallback design is:

- store the side-chat transcript in Codex Mobile runtime state;
- use a hidden sidecar conversation only as an implementation detail when AI
  replies are required;
- mark any sidecar app-server thread as hidden and filter it from normal Mobile
  thread lists;
- run the sidecar in read-only/no-side-effect mode where possible;
- seed the sidecar with bounded main-thread metadata, not the full rollout;
- never write sidecar transcript into the main thread unless the user applies a
  candidate.

Product behavior must still present this as "current-thread side chat", not as a
new normal thread.

## Apply Flow

### Save draft

The user can ask side chat to shape an idea into a main-thread instruction. The
result is stored as a candidate and does not affect the main thread.

### Queue for main thread

The user can queue a candidate. If the main thread is running, the queue remains
visible in side chat. When the main turn completes, Mobile Web either:

- asks for final confirmation; or
- auto-sends once if the user explicitly chose auto-send-after-current-turn.

The queue must be idempotent. Replayed `turn/completed` events must not start a
second turn for the same candidate.

### Send now

If the main thread is idle, the user can send the candidate as a normal
main-thread turn. The injected text should include a small origin marker in
metadata or local audit state, but the visible user message should read like the
user's selected instruction, not a debug wrapper.

## Main-Thread Boundary

Side chat has three boundary states:

- `private`: visible only in the side panel, not model-visible to the main
  thread;
- `queued`: selected by the user, waiting to become a main-thread turn;
- `applied`: sent or injected into the main thread through an explicit action.

Only `applied` content can affect future main-thread model context.

## Persistence And Restoration

The side-chat store should live under the Codex Mobile runtime state root, for
example:

- `~/.codex-mobile-web/thread-side-chats.jsonl`; or
- `~/.codex-mobile-web/thread-side-chats.sqlite`.

SQLite is preferred if implementation complexity is acceptable because it gives
stable thread lookups, update versioning, and bounded cleanup. JSONL is
acceptable for a first pass if the service owns compaction and idempotency.

Browser behavior:

- fetch side-chat state when a thread opens;
- autosave side-chat draft to the server with debounce;
- flush pending draft changes to the server when switching threads;
- clear in-memory side-chat state when leaving thread detail.
- never persist side-chat transcript, draft, candidates, or queue state in
  browser localStorage, sessionStorage, IndexedDB, or `public/draft-store.js`.

Server behavior:

- key records by active Codex profile plus main thread id;
- keep bounded transcript size per thread;
- expose only the current thread's side-chat state to the authenticated caller;
- keep update operations idempotent where possible.
- own the durable state completely; browser state is only a view/cache of the
  server response.

## Interaction With Existing Features

### Subagents

Subagent status remains in the panel and becomes the upper section. Existing
Subagent item detection, active-turn preference, wheel gesture, and empty state
should continue to work.

### Main composer

The side-chat composer must not reuse the main composer send path. It should
have separate handlers and separate draft persistence.

### Cross-thread task cards

Side chat is same-thread sidecar state. It does not replace task cards. If a
side-chat candidate needs to address another thread, it should create a
cross-thread task card through the existing explicit task-card flow.

### Hermes embed mode

The side panel remains iframe-owned UI. Hermes should continue to receive normal
navigation/back messages and must not inspect side-chat DOM.

## Content Bounds

Recommended first-version bounds:

- side-chat message text: 8k characters;
- per-thread saved transcript: latest 100 side-chat messages or 128k
  characters, whichever comes first;
- candidate title: 120 characters;
- candidate body: 8k characters;
- queued instruction body: 8k characters.

Older side-chat messages may be summarized or compacted later, but the first
version can trim oldest private side-chat messages after preserving applied
candidate audit fields.

## Empty And Error States

Required states:

- no side-chat history for this thread;
- saving draft;
- save failed with retry;
- side-chat reply failed;
- queued for current turn completion;
- queued send failed and can retry;
- candidate applied;
- candidate cancelled.

Errors should be bounded and user-facing. They must not include raw app-server
payloads, tokens, private paths beyond existing safe labels, or full logs.

## Design Risks

- hidden sidecar thread leakage into normal thread list;
- accidental use of `turn/steer` for exploratory side-chat messages;
- duplicate queued sends after reconnect or replayed completion events;
- losing unsaved side-chat drafts during thread switching;
- keyboard overlap in the lower panel on mobile;
- overloading `public/app.js` if side-chat rendering and state management are
  not extracted soon enough.

## Decision Rules

- If a side-chat input is exploratory, keep it private.
- If a side-chat output should guide the main agent, require an apply or queue
  action.
- If the main turn is active, do not steer it from side chat.
- If an implementation detail uses a sidecar app-server thread, hide it from
  normal product surfaces and keep it tied to the parent thread.
