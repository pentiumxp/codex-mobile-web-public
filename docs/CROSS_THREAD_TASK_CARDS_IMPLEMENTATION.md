# Cross-Thread Task Cards Implementation Plan

This document maps the planned feature onto the current Codex Mobile Web code
layout and test strategy.

## Proposed Module Ownership

### Server-side

- `adapters/thread-task-card-service.js`
  - normalization
  - readable-text guard for `title`, `summary`, and `body`
  - authorization checks
  - status transitions
  - target-side approval in-flight persistence before external `turn/start`
  - autonomous workflow grants after first target approval
  - idempotency
  - storage
  - injection payload generation
  - multi-target expansion into one stored card per target

- `server.js`
  - route wiring only
  - SSE/broadcast integration only

### Browser-side

- `public/app.js`
  - minimal orchestration
  - render task-card stack
  - action handlers
  - source-side `#` draft parsing and automatic pending-card creation; source
    drafts must not require a second local approval click

- future optional helper:
  - `public/thread-task-cards.js`
  - if card rendering/action logic becomes large enough to extract

## Proposed Routes

- `POST /api/thread-task-cards`
- `GET /api/thread-task-cards/:id`
- `POST /api/thread-task-cards/:id/approve`
- `POST /api/thread-task-cards/:id/delete`
- `POST /api/thread-task-cards/:id/revoke`
- `POST /api/thread-task-cards/:id/reply`

## Proposed Read Integration

Target-thread read responses should include a bounded list of pending task cards
for that thread, but those cards must remain outside `thread.turns[*].items`
until approval injects a real message.

This implies:

- thread detail server responses need an extra field such as
  `pendingTaskCards`;
- browser render signature must account for those cards;
- approval/delete/revoke/reply should trigger thread refresh or live update.

## Storage Strategy

First implementation can use a dedicated JSONL or small sqlite-backed store.

Requirements:

- stable ids
- idempotency key index
- source/target queryability
- status transition audit trail
- optional `workflows` array for autonomous workflow grants scoped by
  workflow id plus participating thread ids

If sqlite is chosen, keep it separate from normal thread message history.

## Suggested Implementation Sequence

1. Implement server-side normalization and state machine in a dedicated adapter.
2. Add route handlers in `server.js`.
3. Add target-thread read enrichment with pending task cards.
4. Add browser rendering outside the normal message flow.
5. Add approve/delete/revoke/reply handlers.
6. Add injection path for approved cards.
7. Add audit logging and focused diagnostics.
8. For the `#` natural-language path, ask the model for `targetThreadIds`, keep
   accepting legacy `targetThreadId`, and automatically create target pending
   cards when the draft parses. Do not show a source-side `Approve` button.
   The draft may include `workflowMode:"autonomous"` only when the command
   explicitly requests an automatic/no-further-approval collaboration loop.

## Harness

The initial harness for this feature lives in:

- `test/thread-task-card-harness.test.js`

This harness is intentionally implementation-light. It codifies:

- payload shape expectations;
- readable UTF-8 expectations for visible card text;
- status transitions;
- target approval leaving `pending` before external injection settles, so
  refresh/compaction cannot resurrect a duplicate `Approve` card;
- allowed actor/action combinations;
- injected message shape after approval;
- reply-card direction reversal.
- autonomous workflow first-approval semantics and same-pair-only auto-run.

The harness should be kept green while the real server/browser implementation is
added.

## Future Focused Tests

After implementation begins, expand coverage with:

- service tests for normalization/state transitions/idempotency;
- service tests rejecting likely encoding-damaged visible card text before store
  writes;
- service tests for multi-target create count and per-target pending counts;
- service tests for autonomous workflow activation, same-pair auto-approval,
  reverse-direction auto-approval, and unrelated-pair rejection;
- route tests for authorization and action endpoints;
- conversation/thread-detail tests for card rendering outside message flow;
- SSE/live update tests if task cards are pushed in real time.
- frontend/static harness checks that source-side draft cards auto-send and no
  `data-task-card-draft-action="approve"` control is shipped.

## Activation Expectations

This feature will be primarily server-side plus thread-rendering UI.

Expected activation rules:

- route/service changes require 8787 restart;
- browser rendering changes require normal frontend validation;
- bump shell cache only if static asset behavior changes in shipped frontend.

## Risks

- accidental automatic injection into target message flow;
- ambiguous authorization between source and target users;
- reply/revoke race conditions;
- duplicated injected messages without idempotency enforcement;
- accidental workflow-id reuse across unrelated threads;
- visible mojibake if a caller sends non-ASCII card payloads through an unsafe
  shell/encoding path.
- overloading `public/app.js` if card rendering is not extracted in time.

## Decision Rule

Do not implement this feature by pretending pending cards are ordinary
`userMessage` items. That would violate the main safety requirement.
`POST /api/thread-task-cards` accepts either `targetThreadId` or
`targetThreadIds`. For multiple targets, `server.js` resolves safe target
workspace metadata per id, calls `threadTaskCardService.createMany()`, returns
`cards`, and keeps `card` as the first result for compatibility.

For manual or operational sending, use the browser flow, a checked Node script,
or another UTF-8-safe JSON client. Do not hand-compose Chinese card JSON through
PowerShell command strings. The service now rejects likely damaged text, but the
canonical sending path should still use stable idempotency keys and a
UTF-8-safe request builder.
