# Cross-Thread Task Cards Requirements

This document captures the product requirements for sending a controlled task
card from one thread to another thread across workspaces without immediately
injecting that content into the target thread's message flow.

## Problem

Codex and Hermes collaboration currently has:

- notification routing;
- Inbox-level summary delivery;
- plugin deep-link routing.

It does not yet have a safe way for one thread to send a concrete actionable
request to another thread while keeping the target thread's model context
protected from automatic contamination.

## Primary Goal

Allow a source thread to send a **pending task card** to a target thread.

The target thread should show that card as a separate actionable item, not as a
normal chat message. Only after explicit user approval may the task content
enter the target thread's message flow.

There is one controlled exception for collaboration loops: an explicitly
requested autonomous workflow still requires the first target-side approval,
but that approval grants automatic execution only for later cards with the same
workflow id and the same two participating thread ids. It also grants an
automatic completion return by default: when the approved target turn finishes,
Mobile Web must send a reverse-direction return card back to the source thread
inside that same workflow.

## Required User Behaviors

### Source side

The source thread user can:

- create a cross-thread task card addressed to a target thread;
- view delivery state;
- revoke the card while it is still pending.

### Target side

The target thread user can:

- view the pending task card;
- approve it and inject it into the target thread's message flow;
- delete it without injecting it;
- reply back to the source thread through the same controlled card mechanism.
- approve the first card in an explicitly marked autonomous workflow, allowing
  later same-workflow cards between the same two threads to execute without
  another manual click.
- receive an automatic source-thread return after the approved autonomous
  target turn completes, without needing to manually compose a second `#`
  card.

## Required Delivery Rules

- The created card must appear in the target thread as a **pending task**
  surface, not a regular `userMessage`.
- A pending task card must not enter model context by default.
- Approval must create a real injected message in the target thread.
- Deletion must remove/dismiss the card without injecting anything.
- Revocation must be possible only from the source side while the card is still
  pending.
- Reply should create a controlled reverse-direction card, not a freeform
  silent cross-thread injection.
- Autonomous workflow execution is allowed only after the first approved target
  card establishes the workflow grant. The grant is scoped by workflow id plus
  the unordered pair of source/target thread ids.
- Autonomous workflow completion return must be idempotent. Replayed
  `turn/completed` notifications for the same injected target turn must not
  create duplicate source-thread return turns.
- Approved non-terminal work cards must record an active execution lease on the
  target thread. The lease must survive ordinary user interruptions and must not
  be completed, paused, or cancelled by an unrelated user question.
- When an unrelated target-thread turn completes while an execution lease is
  active, Mobile Web must schedule one bounded continuation for the oldest
  active lease in that target thread unless the owner or target explicitly
  paused or cancelled the lease.
- Terminal return/no-op cards must not create execution leases and must not
  request acknowledgements.

## States

The first implementation should support at least:

- `pending`
- `approved`
- `deleted`
- `revoked`
- `replied`

## Safety And Control Requirements

- Cross-thread sending must be explicitly controlled by workspace and thread
  policy.
- A target thread must be able to opt in or opt out of receiving such cards.
- No automatic message-flow injection without an explicit approval action,
  except follow-up and completion-return cards inside an already approved
  autonomous workflow grant.
- All operations must be auditable.
- The source of an injected message must remain traceable after approval.

## Content Requirements

Each card must support bounded:

- title
- summary
- body
- source metadata
- target metadata

The card content should support Markdown or plain text only.

Binary attachments are out of scope for the first implementation.

## Non-Goals For First Version

- automatic live-turn steering into another active turn;
- attachment forwarding;
- direct hidden model-context injection;
- default automatic approval rules for ordinary task cards;
- cross-machine or federated trust outside the current controlled server.

## Acceptance Criteria

The feature is acceptable when:

1. A source thread can create a pending card for a target thread.
2. The target thread displays the card outside the normal message flow.
3. Approving the card creates a real injected target-thread message.
4. Deleting the card does not create a target-thread message.
5. Revoking a pending card from the source side prevents future approval.
6. Reply creates a reverse-direction controlled task card.
7. Autonomous workflow follow-ups auto-execute only after first approval and
   only for the same workflow id plus same two thread ids.
8. Completing the injected target turn for an approved autonomous card creates
   exactly one reverse-direction return card and auto-injects it into the
   source thread.
9. Approving a non-terminal work card creates an active execution lease with
   `resumeRequired=true`.
10. Completing an ordinary target-thread turn while the lease is active starts
    one bounded continuation for that card, without copying the full private
    card body.
11. Explicit pause/cancel prevents continuation, and terminal return cards do
    not create leases.
12. All actions are bounded, authorized, auditable, and idempotent.
