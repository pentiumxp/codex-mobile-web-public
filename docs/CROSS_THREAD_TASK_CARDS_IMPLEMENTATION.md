# Cross-Thread Task Cards Implementation Plan

This document maps the planned feature onto the current Codex Mobile Web code
layout and test strategy.

## Proposed Module Ownership

### Server-side

- `adapters/thread-task-card-service.js`
  - normalization
  - authorization checks
  - status transitions
  - idempotency
  - storage
  - injection payload generation

- `server.js`
  - route wiring only
  - SSE/broadcast integration only

### Browser-side

- `public/app.js`
  - minimal orchestration
  - render task-card stack
  - action handlers

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

If sqlite is chosen, keep it separate from normal thread message history.

## Suggested Implementation Sequence

1. Implement server-side normalization and state machine in a dedicated adapter.
2. Add route handlers in `server.js`.
3. Add target-thread read enrichment with pending task cards.
4. Add browser rendering outside the normal message flow.
5. Add approve/delete/revoke/reply handlers.
6. Add injection path for approved cards.
7. Add audit logging and focused diagnostics.

## Harness

The initial harness for this feature lives in:

- `test/thread-task-card-harness.test.js`

This harness is intentionally implementation-light. It codifies:

- payload shape expectations;
- status transitions;
- allowed actor/action combinations;
- injected message shape after approval;
- reply-card direction reversal.

The harness should be kept green while the real server/browser implementation is
added.

## Future Focused Tests

After implementation begins, expand coverage with:

- service tests for normalization/state transitions/idempotency;
- route tests for authorization and action endpoints;
- conversation/thread-detail tests for card rendering outside message flow;
- SSE/live update tests if task cards are pushed in real time.

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
- overloading `public/app.js` if card rendering is not extracted in time.

## Decision Rule

Do not implement this feature by pretending pending cards are ordinary
`userMessage` items. That would violate the main safety requirement.
