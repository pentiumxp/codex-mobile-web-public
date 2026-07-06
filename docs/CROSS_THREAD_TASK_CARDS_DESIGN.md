# Cross-Thread Task Cards Design

This document describes the planned design for controlled cross-thread task
cards.

## Concept

A cross-thread task card is **not** a normal message. It is a separately stored
work item delivered to a target thread UI surface. The target user may then
approve, delete, or reply.

Only the approval path produces a real injected `userMessage` inside the target
thread history.

Autonomous workflow cards are a special mode for automatic collaboration; the
ordinary task-card mode remains manual. The first autonomous card in the
workflow is still a normal pending target card. Once the target approves that
first card, the service stores a workflow grant scoped to the workflow id and
the exact two participating thread ids. Later cards carrying that same workflow
id between those same two threads can auto-approve and inject without another
target click. Completion auto-return is part of the default autonomous workflow
contract: when the injected target turn for an approved autonomous card
completes, the server creates an automatic reverse-direction return card that
carries the completed turn receipt, reuses the same workflow id, and
auto-injects back into the source thread through the same grant. That return
card is terminal: it does not request another completion auto-return after its
own injected turn completes, and its title collapses repeated `Auto return:`
prefixes to one prefix.

Return cards and acknowledgement cards are terminal by default. A card created
by `mcp__codex_mobile.return_to_source`, `scripts/return-thread-task-card.js`, or
`/reply` with `returnToSource:true` carries structured terminal delivery state
(`terminal:true`, `requiresReturn:false`, `ackPolicy:"none"`). It must not
inject `Return required` guidance and must not require a second acknowledgement.
If the source wants new actionable work after reviewing a terminal return, it
must create a new work card instead of replying to the terminal receipt.

When a terminal return card closes an original non-terminal work card, Codex
Mobile also emits one bounded Home AI Autonomous Delivery Loop return-card
event. The event contains only task-card ids, return-card id, return status,
bounded title/summary, source/target thread ids, workflow id, and terminal
metadata. It does not include card bodies, conversation text, prompts,
completions, uploads, provider payloads, cookies, launch tokens, access keys,
database rows, or logs. This event is state observation only: it must not
create repair cards, request acknowledgement, or affect terminal return-card
delivery. Unknown Home AI task-card ids are recorded as bounded diagnostics and
do not block normal return delivery.

Non-terminal approved work cards carry an `executionLease`. The lease records
the active card id, source/target thread ids, workflow metadata, current injected
turn id, last progress time, and `resumeRequired:true`. Ordinary user messages
in the target thread do not cancel this lease. When an unrelated target-thread
turn completes while a lease is still active, the runtime schedules a bounded
continuation turn for the oldest active lease in that target thread. The
continuation points to the original task-card id and earlier injected message;
it does not duplicate the full private card body. Explicit pause/cancel actions
set the lease to `paused` or `cancelled` and suppress continuation. Terminal
return/no-op cards never create execution leases.

## High-Level Flow

1. Source thread creates a task-card request addressed to one or more target
   threads.
2. For leading non-empty `#` natural-language commands, the model only drafts
   the bounded card JSON. Plain `# ...` defaults to a manual one-off card, while
   `#自由协作 ...` remains the autonomous compatibility shortcut. Once the draft
   parses, Mobile Web materializes the real pending cards through the task-card
   service; the source thread must not require a separate local `Approve` step.
   The browser may initiate creation, but the server also scans fresh
   `turn/completed` notifications and thread-detail reads so card creation does
   not depend on the open page, workspace filter, or PWA state.
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
8. If the injected target turn for an approved autonomous work card completes,
   service creates one idempotent reverse-direction return card keyed by the
   original card id plus completed turn id. Because the workflow grant already
   covers the same two thread ids, that return card auto-approves and starts a
   real source-thread turn without another click. The return card's delivery
   flags set `terminal:true`, `requiresReturn:false`, `ackPolicy:"none"`, and
   `autoReturnOnCompletion:false`, so workflows do not ping-pong indefinitely.
   The same terminal return is also eligible for a single Home AI delivery-loop
   event keyed by the original card id plus return-card id; replayed completion
   notifications stay idempotent.

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
    "autoRunAfterFirstApproval": false,
    "autoReturnOnCompletion": false,
    "requiresReturn": true,
    "terminal": false,
    "ackPolicy": "return_required|auto_return|none"
  },
  "executionLease": {
    "cardId": "ttc_01...",
    "sourceThreadId": "thread_src",
    "targetThreadId": "thread_dst",
    "workflowId": "workflow-id",
    "workflowMode": "manual|autonomous",
    "status": "active|resuming|paused|cancelled|completed",
    "resumeRequired": true,
    "startedAt": "2026-05-29T00:00:00Z",
    "lastProgressAt": "2026-05-29T00:00:00Z",
    "injectedTurnId": "turn_01",
    "currentTurnId": "turn_01",
    "lastInterruptedTurnId": "",
    "lastContinuationTurnId": "",
    "resumeCount": 0
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

Automatic completion returns are not model-prompt best effort. The server
observes `turn/completed` for the injected target turn recorded on the approved
card, extracts a bounded final receipt when available, creates a reverse card,
and records `autoReplyCardId` / `autoReturn*` audit fields on the original
card. Repeated or replayed completion notifications are idempotent and do not
create a second return card.

Interruption continuation is also server-side state, not model best effort. The
server observes `turn/completed` in the target thread. If that turn is not the
current turn recorded on an active execution lease, and the original card has
not been replied/returned/cancelled/paused, the service re-injects one bounded
continuation for that completed turn. Replayed completion notifications are
deduplicated by `lastInterruptedTurnId` / `resumeForTurnId`. If several active
leases exist for the same target thread, continuation uses oldest-started-first
ordering so the queue is deterministic rather than hidden model state.

## API Shape

### Create

`POST /api/thread-task-cards`

The create route accepts either the original single-target `targetThreadId` or
the batch field `targetThreadIds`. Batch creation returns one stored card per
target in `cards` while keeping `card` as the first created card for older
callers.

### Thread-callable direct create

`POST /api/threads/:sourceThreadId/task-cards`

This route is for Codex-thread/tool initiated delegation, not for the normal
browser task-card composer. It infers the source thread from the URL, accepts
the same `targetThreadId` / `targetThreadIds` shape plus exact target-thread
titles, and creates cards in the same task-card store. Direct source-thread
approval is behind the runtime Settings switch `跨工作区委派` and is off by
default. When the switch is off, the route creates pending target cards.

The normal create route above remains pending by default. The thread-callable
route can also be forced back to pending behavior with `pending:true`,
`autoApprove:false`, or `direct:false`.

### Sensitive `secretRef` Context

Home AI native shells can help the owner paste temporary passwords or API keys
without placing plaintext in chat. The iOS shell must read the pasteboard only
after an explicit user action, upload the value to the Home AI secret broker,
and pass Codex Mobile only a short-lived `secretRef` such as `sec_...`.

Codex Mobile accepts `secretRef` / `secretRefs` on message and task-card
metadata, including `sensitiveContext.secretRefs` and secretRef attachment
metadata. The stored internal card keeps the full broker reference so a
server-side action can consume it, but public card summaries, injected
task-card text, MCP responses, and message metadata render only a bounded
receipt such as:

```text
已收到安全凭据 sec_...，10 分钟内可用于当前任务。
```

Plaintext fields such as `value`, `secret`, `password`, `token`,
`accessKey`, `apiKey`, cookies, or authorization headers are rejected in
secretRef metadata. The target plugin scope must be `codex`. Expired,
unauthorized, invalid, unknown, or used-up broker references fail closed with
bounded error codes.

Codex Mobile does not expose a model-visible MCP tool that returns plaintext.
Action-specific server code must call `homeAiSecretRefService.consumeSecretRef`
with the current thread/task/workspace scope and use the returned value only in
memory for that one action. Public responses should use
`publicSecretRefConsumeResult` and must not include raw secret values, broker
payloads, access keys, or full `secretRef` ids.

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

### Execution Pause / Cancel

`POST /api/thread-task-cards/:id/execution/pause`

`POST /api/thread-task-cards/:id/execution/cancel`

These routes update the structured `executionLease` only. They do not create a
return card and do not mark the original card completed. They exist so an owner
or target thread can explicitly stop automatic continuation when an active card
should no longer resume after ordinary user interruptions.

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

Thread-callable direct create is a separate explicit route. It still requires
the authenticated Codex Mobile API key, requires the URL source thread to match
the card source, and records that target approval was bypassed. It must not be
silently enabled for the browser composer, plain `#` draft materialization, or
ordinary `POST /api/thread-task-cards` callers.

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
- do not show an approval prompt for its own `#` task-card draft; a valid draft
  auto-sends to target pending cards, and only the target thread approval
  injects a real `userMessage`;
- for a multi-target draft, keep the source thread open after creation instead
  of automatically jumping to one recipient;
- keep source-side automatic creation silent in the conversation: do not render
  an interim `Sending` draft card after a valid draft is parsed, while still
  surfacing a bounded dismissible diagnostic if card creation actually fails;
- persist source draft settlement using a stable key derived from the turn id
  and draft content, and treat already stored matching source-turn cards as
  created so thread re-entry or item-id drift cannot re-send the same draft.
- when resolving a queued draft key in a long source thread, continue scanning
  past ordinary assistant or plan messages that do not contain a valid draft;
  a non-draft item must not abort lookup before a later valid draft can create
  the target pending cards.

Autonomous workflow cards should make the first-approval boundary visible. The
first pending target card can label its approve action as `Approve workflow`;
after approval, follow-up cards normally do not render because they immediately
become approved injected turns. Completion auto-return cards are the default
for autonomous workflows and normally do not render as pending UI: they are
created from the completed injected target turn, auto-approved by the existing
workflow grant, and surface as a real new turn in the original source thread.
They are terminal receipt turns rather than another auto-return source.
Acknowledgements of those receipts are not required; new actionable work must
start as a new work card.

## Storage

First implementation should use a dedicated task-card store instead of reusing
normal message history records. This keeps pending cards separate from message
flow and avoids message-stream pollution before approval.

## Bounded Content

Recommended first-version bounds:

- `title <= 120`
- `summary <= 300`
- `body <= 8k`

Markdown and text only.

Structured model drafts may be more verbose than the persisted card limit. The
server and browser both truncate draft bodies to the 8k service limit with a
head/tail marker before calling the store, so a useful card is still created
instead of failing the whole workflow with `body_too_long`.

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
