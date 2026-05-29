# Cross-Thread Task Cards Design

This document describes the planned design for controlled cross-thread task
cards.

## Concept

A cross-thread task card is **not** a normal message. It is a separately stored
work item delivered to a target thread UI surface. The target user may then
approve, delete, or reply.

Only the approval path produces a real injected `userMessage` inside the target
thread history.

## High-Level Flow

1. Source thread creates a task card addressed to a target thread.
2. Server stores the card in a cross-thread task-card store.
3. Target thread fetch/render path includes pending task cards.
4. Target user chooses:
   - approve
   - delete
   - reply
5. Source user may revoke while the card is still pending.

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
    "allowRevoke": true
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

## API Shape

### Create

`POST /api/thread-task-cards`

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

- show mirrored status card or timeline entry:
  - sent
  - approved
  - deleted
  - revoked

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

## Observability

Every card action should be auditable:

- created
- approved
- deleted
- revoked
- replied

Each action should keep actor, timestamp, card id, and source/target thread ids.
