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
- No automatic message-flow injection without an explicit approval action.
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
- automatic approval rules;
- cross-machine or federated trust outside the current controlled server.

## Acceptance Criteria

The feature is acceptable when:

1. A source thread can create a pending card for a target thread.
2. The target thread displays the card outside the normal message flow.
3. Approving the card creates a real injected target-thread message.
4. Deleting the card does not create a target-thread message.
5. Revoking a pending card from the source side prevents future approval.
6. Reply creates a reverse-direction controlled task card.
7. All actions are bounded, authorized, auditable, and idempotent.
