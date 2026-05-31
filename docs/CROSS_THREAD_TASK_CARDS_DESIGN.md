# Cross-Thread Task Cards Design

This document describes the planned design for controlled cross-thread task
cards.

## Concept

A cross-thread task card is **not** a normal message. It is a separately stored
work item delivered to a target thread UI surface. The target user may then
approve, delete, or reply.

Only the approval path produces a real injected `userMessage` inside the target
thread history.

Autonomous workflow cards are a special mode, not the default. The first card
in the workflow is still a normal pending target card. Once the target approves
that first card, the service stores a workflow grant scoped to the workflow id
and the exact two participating thread ids. Later cards carrying that same
workflow id between those same two threads can auto-approve and inject without
another target click.

## High-Level Flow

1. Source thread creates a task-card request addressed to one or more target
   threads.
2. For `#` natural-language commands, the model only drafts the bounded card
   JSON. Once the draft parses and names visible target threads, the source
   client creates the real pending cards immediately; the source thread must not
   require a separate local `Approve` step.
3. Server stores one card per target thread in a cross-thread task-card store.
4. Each target thread fetch/render path includes its own pending task cards.
5. Target user chooses:
   - approve
   - delete
   - reply
6. Source user may revoke while the card is still pending.
7. If the approved card has `workflow.mode=autonomous`, that approval activates
   the workflow grant. Later same-workflow cards between the same thread pair
   skip the pending UI and execute the approval path automatically.

## Data Model

Planned canonical object:

```json
{
  "id": "ttc_01...",
  "idempotencyKey": "finance:thread_src:turn_src:1",
  "status": "pending",
  "source": {
    "workspaceId": "finance",
    "threadId": "thread_src",
    "turnId": "turn_src",
    "title": "Finance / month-end close"
  },
  "target": {
    "workspaceId": "ops",
    "threadId": "thread_dst"
  },
  "message": {
    "format": "markdown",
    "title": "Need verification",
    "summary": "Please verify this mapping.",
    "body": "Detailed request."
  },
  "delivery": {
    "injectOnApprove": true,
    "allowReply": true,
    "allowRevoke": true,
    "autoRunAfterFirstApproval": false
  },
  "workflow": {
    "mode": "manual|autonomous",
    "id": "workflow-id",
    "authorized": false
  },
  "audit": {
    "createdAt": "2026-05-29T00:00:00Z",
    "approvedAt": null,
    "deletedAt": null,
    "revokedAt": null
  }
}
```

## Status Model

Allowed states:

- `pending`
- `approving` (transient target-side state after approval is accepted locally
  but before the external target-thread `turn/start` call settles)
- `approved`
- `deleted`
- `revoked`
- `replied`

Allowed actions:

- source:
  - create
  - revoke while pending
- target:
  - approve while pending
  - delete while pending
  - reply while pending or approved, depending on final policy

Target-side approval must leave `pending` before calling the external
target-thread turn injection path. This prevents thread refresh, continuation
compaction, or reconnect reads from showing a second actionable `Approve` card
while the approved turn is already starting. If the external call fails before
acceptance, the service may restore the card to `pending` with a bounded audit
error so the target can retry.

For autonomous workflows, the same `approving` state is used for automatic
follow-up execution. If automatic injection fails before acceptance, the card is
restored to `pending` with an audit error so it can be inspected or retried
manually instead of being silently dropped.

## API Shape

### Create

`POST /api/thread-task-cards`

The create route accepts either the original single-target `targetThreadId` or
the batch field `targetThreadIds`. Batch creation returns one stored card per
target in `cards` while keeping `card` as the first created card for older
callers.

### Read one

`GET /api/thread-task-cards/:id`

### Approve

`POST /api/thread-task-cards/:id/approve`

### Delete

`POST /api/thread-task-cards/:id/delete`

### Revoke

`POST /api/thread-task-cards/:id/revoke`

### Reply

`POST /api/thread-task-cards/:id/reply`

## Injection Result

Approval should generate a real target-thread `userMessage` with explicit origin
metadata. The injected text should not pretend to be original local typing.

Suggested wrapper:

```md
[跨线程待办已批准导入]

来源工作区：finance
来源线程：Finance / month-end close

Detailed request.
```

Suggested message metadata:

```json
{
  "bridgeSource": {
    "cardId": "ttc_01...",
    "workspaceId": "finance",
    "threadId": "thread_src",
    "turnId": "turn_src"
  }
}
```

## Authorization Model

Three layers are required:

1. Workspace allowlist
2. Target-thread opt-in
3. Action-level role checks

No cross-thread card creation should succeed merely because the caller has a
global session key.

Autonomous workflow grants add a fourth check: the grant must be active, have
the same workflow id, and match the unordered pair of source/target thread ids.
The same workflow id with any other thread pair is not authorized and remains a
normal pending card until that pair receives its own first approval.

## UI Model

Target thread:

- render task cards outside the normal message flow;
- show source workspace/thread/title;
- allow expand/collapse of body;
- show actions:
  - approve
  - reply
  - delete

Source thread:

- do not render outgoing pending cards as local work items after auto-send;
- keep outgoing cards in the store/audit state and thread summary counts only;
- do not show an approval prompt for its own `#` draft; a valid draft auto-sends
  to target pending cards, and only the target thread approval injects a real
  `userMessage`;
- for a multi-target draft, keep the source thread open after creation instead
  of automatically jumping to one recipient;
- persist source draft settlement using a stable key derived from the turn id
  and draft content, and treat already stored matching source-turn cards as
  created so thread re-entry or item-id drift cannot re-send the same draft.

Autonomous workflow cards should make the first-approval boundary visible. The
first pending target card can label its approve action as `Approve workflow`;
after approval, follow-up cards normally do not render because they immediately
become approved injected turns.

## Storage

First implementation should use a dedicated task-card store instead of reusing
normal message history records. This keeps pending cards separate from message
flow and avoids message-stream pollution before approval.

## Bounded Content

Recommended first-version bounds:

- `title <= 120`
- `summary <= 300`
- `body <= 8k` to `12k`

Markdown and text only.

Visible `title`, `summary`, and `body` text must be readable user-facing text.
The service rejects likely encoding-damaged payloads before persistence,
including replacement characters, typical UTF-8/Latin-1 mojibake markers, and
high-density repeated `?` clusters such as the PowerShell-damaged
`?? Hermes ?????? v133` pattern. A rejected card must not be written to the
task-card store, so retrying with a corrected UTF-8 payload does not create a
second visible card.

## Observability

Every card action should be auditable:

- created
- approved
- deleted
- revoked
- replied

Each action should keep actor, timestamp, card id, and source/target thread ids.
