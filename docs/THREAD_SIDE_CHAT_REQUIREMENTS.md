# Thread Side Chat Requirements

This document captures the product requirements for a current-thread side chat
surface in Codex Mobile Web.

## Problem

Codex Mobile users often notice a new idea, product concern, or possible bug
while the main thread is already running. Sending that thought directly to the
main composer has two failure modes:

- if the main turn is running, a live steer can interrupt or redirect work that
  is already in progress;
- if the main thread is idle, discussing the idea inside the main transcript
  still pollutes the thread context before the user has decided what should
  become actionable.

The current left-swipe Subagent panel helps inspect child-agent activity, but it
does not provide a protected place to discuss and refine ideas attached to the
current thread.

## Primary Goal

Add a per-thread **side chat** that is attached to the currently open thread but
does not enter the main thread transcript or model-visible history by default.

The user can discuss, refine, save, and later apply side-chat output to the main
thread through an explicit action.

## Required User Behaviors

The user can:

- open the existing left-swipe panel from thread detail;
- see Subagent status in the upper region of that panel;
- use side chat in the lower region of that panel;
- type and send side-chat messages without steering the active main turn;
- preserve the side-chat transcript and unsent draft when switching threads;
- return to a thread and see that thread's own side-chat state restored;
- convert a side-chat result into a proposed main-thread instruction;
- explicitly apply or queue that instruction for the main thread;
- cancel, edit, or clear side-chat drafts and queued instructions.

## Required Isolation Rules

- A side-chat message must not create a normal main-thread `userMessage`.
- A side-chat message must not call `turn/steer` on the active main turn.
- Side-chat discussion must not become model-visible main-thread context until
  the user explicitly applies or queues it.
- Each main thread owns an independent side-chat state.
- Switching threads must switch side-chat state with the thread.
- Side-chat state must survive browser refresh and ordinary PWA/plugin
  navigation.
- Side-chat state must not appear in the normal thread list as an independent
  user-visible thread.

## Apply And Queue Rules

When the user turns side-chat content into a main-thread instruction, Mobile Web
must make the boundary explicit.

Supported first-version apply modes:

- **Save draft**: put the generated instruction into a server-saved side-chat
  candidate without sending.
- **Queue for main thread**: keep the instruction pending until the current main
  turn is idle, then start the next main turn only after explicit user
  confirmation or an explicit "auto-send after current turn" choice.
- **Send now**: when the main thread is idle, start a normal main-thread turn
  with the selected instruction.

If the main thread is running, "send now" must degrade to a visible queued
state instead of steering the active turn.

## Persistence Requirements

The first implementation must persist, per main thread:

- side-chat transcript;
- current side-chat input draft;
- generated main-thread instruction candidates;
- queued apply state;
- last applied candidate ids, for idempotency;
- lightweight timestamps and status metadata.

Persistence must be server-side under the Codex Mobile runtime state root. Side
chat must not use browser localStorage, sessionStorage, IndexedDB, or
`public/draft-store.js` as a persistence layer or draft backup. Browser memory
may hold the currently rendered state only until the next server sync.

## UI Requirements

- The existing left-swipe gesture remains the entry point from thread detail.
- The panel becomes a two-region current-thread side panel:
  - upper region: Subagent status;
  - lower region: side chat.
- Each region must scroll independently when content is long.
- The lower side-chat region must remain usable on small mobile viewports with
  the software keyboard open.
- The side-chat composer must visually differ from the main composer.
- Pending or queued apply state must be visible and cancellable.
- Empty states must be concise and must not describe hidden implementation
  details.

## Safety Requirements

- Do not store raw access keys, cookies, bearer tokens, one-time approval state,
  or full diagnostic logs in side-chat records.
- Bound saved text sizes so a side-chat transcript cannot grow without limit.
- Do not expose side-chat records through generated-image, file-preview, upload,
  or local-file preview roots.
- Do not add broad local preview roots for side-chat attachments in the first
  version.
- Side-chat application to the main thread must be auditable in local state.

## Non-Goals For First Version

- automatic active-turn steering from side chat;
- automatic model-context injection without a user action;
- cross-thread side-chat sharing;
- binary attachment forwarding through side chat;
- showing side chat as a normal thread in the thread list;
- full Desktop parity if Desktop uses an unreleased private side-chat API.

## Acceptance Criteria

The feature is acceptable when:

1. Left swipe opens a panel with Subagent status above side chat.
2. Side-chat messages do not create main-thread messages.
3. Side-chat messages do not steer an active main turn.
4. Side-chat transcript and draft are restored after switching away and back.
5. Each thread restores only its own side-chat state.
6. A side-chat candidate can be saved, edited, queued, cancelled, and applied.
7. A queued apply starts at most one main-thread turn after the main thread is
   idle.
8. Reloading the page does not duplicate queued applies or lose saved side-chat
   drafts.
9. Existing Subagent panel behavior remains available in the upper region.
10. Focused tests and mobile visual validation cover the panel, persistence, and
    no-main-thread-pollution guarantees.
