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
  - automatic completion return cards for autonomous workflows, with terminal
    return-card delivery flags and single-prefix `Auto return:` titles
  - idempotency
  - storage
  - injection payload generation
  - multi-target expansion into one stored card per target

- `server.js`
  - route wiring
  - `turn/completed` notification hook for autonomous completion auto-return
  - `turn/completed` and thread-detail hooks that materialize structured `#`
    task-card drafts through the same idempotent create service path
  - fallback `thread/turns/list` detail mode must still run task-card draft
    materialization before attaching visible cards
  - source-thread direct task-card route for model/tool initiated delegation
  - disabled compatibility route for the removed local cross-workspace
    delegation preflight
  - SSE/broadcast integration only

### Browser-side

- `public/app.js`
  - minimal orchestration
  - render task-card stack
  - action handlers
  - source-side `#` task-card draft parsing and automatic pending-card creation;
    source drafts must not require a second local approval click
  - source-side automatic creation must not render an interim `Sending` draft
    card in the conversation; only real creation failures should render a
    bounded dismissible diagnostic
  - stable source draft settlement keyed by turn id plus draft content, with a
    matching-card lookup so app-server item-id drift does not re-send an already
    created card
  - queued source draft creation must scan the current thread until it finds
    the matching draft key; ordinary earlier assistant/plan messages are skipped
    rather than treated as lookup failure
  - source-side draft body submission must use the same 8k truncation policy as
    the server, so model verbosity cannot turn a valid target draft into a
    `body_too_long` failure
  - target-thread detail rendering only for `pending` cards whose
    `threadRole` is `target`; source outgoing pending cards should not render
    as local work items
  - no ordinary-send local cross-workspace preflight. Cross-workspace work must
    come from an explicit model-produced task-card draft or a model/tool call to
    the thread-callable route, not from browser-side keyword/path matching.

- future optional helper:
  - `public/thread-task-cards.js`
  - if card rendering/action logic becomes large enough to extract

## Proposed Routes

- `POST /api/thread-task-cards`
- `POST /api/threads/:sourceThreadId/task-cards`
- `POST /api/threads/:sourceThreadId/workspace-delegation`
- `GET /api/thread-task-cards/:id`
- `POST /api/thread-task-cards/:id/approve`
- `POST /api/thread-task-cards/:id/delete`
- `POST /api/thread-task-cards/:id/revoke`
- `POST /api/thread-task-cards/:id/reply`

`POST /api/threads/:sourceThreadId/task-cards` is the thread-callable
delegation route. It uses `buildThreadTaskCardCreatePayload()` to infer source
metadata, resolve target ids or exact target titles, truncate overlong bodies to
the 8k card limit, and derive a stable `thread-call:*` idempotency key when the
caller does not provide one. Source-thread direct auto-approval is gated by the
server config switch `CODEX_MOBILE_ALLOW_WORKSPACE_DELEGATION=1` (or compatible
alias `CODEX_MOBILE_WORKSPACE_DELEGATION_ENABLED=1`) and is off by default.
When the switch is off, the route stores pending cards only. Passing
`pending:true`, `autoApprove:false`, or `direct:false` also keeps the card in
the manual-pending flow even when the switch is enabled.

The supported local CLI wrapper is:

```bash
node scripts/create-thread-task-card.js \
  --source-thread <source-thread-id> \
  --target-thread <target-thread-id-or-exact-title> \
  --title "<title>" \
  --body-file <markdown-file>
```

The script reads the access key from `CODEX_MOBILE_KEY`,
`CODEX_MOBILE_ACCESS_KEY`, `CODEX_MOBILE_KEY_FILE`, or
`$HOME/.codex-mobile-web/access_key`, sends it as an Authorization header, and
prints only the bounded JSON response. Prefer `--body-file` or `--json-file`
for Chinese or long Markdown payloads. The script can request direct
auto-approval, but the server only honors that request when
`CODEX_MOBILE_ALLOW_WORKSPACE_DELEGATION=1` is configured.

`POST /api/threads/:sourceThreadId/workspace-delegation` is retained only as a
compatibility endpoint for clients that shipped during the v363 experiment. It
returns `delegated:false`, `disabled:true`, and
`analysis.reason:"workspace_delegation_disabled"` by default. If
`CODEX_MOBILE_ALLOW_WORKSPACE_DELEGATION=1` is configured, it still must not
create cards and instead reports
`analysis.reason:"model_driven_delegation_requires_explicit_task_card"`.
The v363 local heuristic was removed because directory names and thread titles
are not reliable enough to decide target workspaces. New cross-workspace
delegation must be model/tool explicit through `POST
/api/threads/:sourceThreadId/task-cards`, `scripts/create-thread-task-card.js`,
or structured model output that is materialized by the existing task-card
draft flow.

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
8. For the leading non-empty `#` natural-language path, ask the model for
   `targetThreadIds`, keep accepting legacy `targetThreadId`, and automatically
   create target pending cards when the draft parses. Do not show a source-side
   `Approve` button. Plain `#` defaults to `workflowMode:"manual"` unless the
   command explicitly asks for autonomous/free collaboration; `#自由协作` defaults
   to `workflowMode:"autonomous"` unless the command explicitly asks for a
   one-off manual card.
9. Back the browser auto-create path with server-side materialization. On fresh
   `turn/completed`, fetch a bounded recent-turn window, parse assistant/plan
   draft XML, resolve target workspace metadata, truncate overlong draft bodies
   to the 8k card limit, and call `createMany()` with a stable draft idempotency
   key. Thread-detail reads run the same materialization before attaching cards,
   including fallback `thread/turns/list` reads.
10. For autonomous workflow cards, observe `turn/completed` for the recorded
   `injectedTurnId`. `server.js` calls
   `threadTaskCardService.maybeAutoReplyCompletedTurn()`, which creates an
   idempotent reverse-direction card with the completed turn receipt and the
   same workflow id. The existing workflow grant auto-approves that return card
   and injects it into the original source thread. Return cards must set
   `delivery.autoReturnOnCompletion=false` and their injected message must not
   advertise another auto-return; otherwise a completed return turn can start an
   indefinite ping-pong loop.

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
- automatic completion return for autonomous workflows, including duplicate
  `turn/completed` idempotency.

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
- service tests for target injected-turn completion creating one auto-approved
  reverse card back to the source thread, refusing recursive completion returns,
  and collapsing stacked `Auto return:` title prefixes;
- route tests for authorization and action endpoints;
- route/static tests that `server.js` wires `turn/completed` through
  `maybeAutoReplyCompletedTurn`;
- route/static tests that `server.js` wires `turn/completed` through
  `maybeMaterializeThreadTaskCardDrafts`, that detail reads await
  `materializeThreadTaskCardDraftsForThread()`, and that materialization
  truncates draft bodies before `createMany()`;
- conversation/thread-detail tests for card rendering outside message flow;
- SSE/live update tests if task cards are pushed in real time.
- frontend/static harness checks that source-side draft cards auto-send and no
  `data-task-card-draft-action="approve"` control is shipped, and that the
  auto-create `creating` state is silent instead of rendering a `Sending` card.
- frontend/static harness checks that source draft keys are content-stable, that
  existing matching cards mark a draft created, and that only target-side
  pending cards render in thread detail.
- regression checks that ordinary Composer sends do not call a local
  `workspace-delegation` preflight and that the compatibility route remains
  disabled.

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

The Node script and the thread-callable route are intentionally direct-send
surfaces. They are suitable when the current Codex thread is explicitly asked to
delegate scoped work to another thread. They must not replace the ordinary
target approval chain for user-composer task cards.
