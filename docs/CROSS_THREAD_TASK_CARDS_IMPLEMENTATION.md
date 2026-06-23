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
  - app-server dynamic tool injection for Codex-thread initiated delegation
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
- `GET|POST /api/settings/workspace-delegation`
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
runtime Settings switch `跨工作区委派`, and is off by default. The runtime value is
stored in `settings.json`; `CODEX_MOBILE_ALLOW_WORKSPACE_DELEGATION=1` (or
compatible alias `CODEX_MOBILE_WORKSPACE_DELEGATION_ENABLED=1`) only supplies
the default when no runtime value exists. When the switch is off, the route
stores pending cards only. Passing `pending:true`, `autoApprove:false`, or
`direct:false` also keeps the card in the manual-pending flow even when the
switch is enabled.

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
auto-approval, but the server only honors that request when the runtime
`跨工作区委派` switch is enabled.

When the runtime `跨工作区委派` switch is enabled, server-side `thread/start` and
`turn/start` requests also receive a Codex app-server dynamic tool:

```text
codex_mobile.delegate_to_thread
```

This is one model-visible path for running Codex turns. The model decides from
the current request whether cross-workspace delegation is needed, calls the tool
with an exact target thread id/title or exact target workspace cwd, and the
server converts the tool call into the same
`createThreadTaskCardsFromSourceThread()` path used by
`POST /api/threads/:sourceThreadId/task-cards`. The tool returns bounded JSON
text containing card ids, target thread ids, and whether source-direct approval
was used, wrapped as app-server dynamic-tool output:
`result.content_items[{ type:"input_text" }]`. This schema is intentionally not
the MCP `content[{ type:"text" }]` response shape. Direct dynamic-tool task
cards are idempotent by explicit request id when one is supplied; otherwise the
server uses the source thread plus target/title/body/workflow semantics so retry
calls with a new tool call id do not create duplicate cards. If the switch is off, the
tool is not injected. If the tool is called without a target or source thread id
cannot be inferred, the server returns a bounded error to the model instead of
hanging the turn.

Source-thread task-card creation has a stricter target resolver than the manual
pending-card API. The resolver only accepts current visible target threads from
the non-archived Mobile thread list. Hidden, archived, sub-agent, old rollout
fallback, and non-detail-readable thread ids are rejected. When several visible
threads share the same cwd/workspace, the latest visible thread is the canonical
target for that cwd; older date-suffixed threads return `stale_target_thread`
with a bounded `currentTarget` object instead of being silently retargeted.
Completely invisible or unknown ids return `target_thread_not_visible`. This
same guard applies to both the app-server dynamic tool and the
`scripts/create-thread-task-card.js` fallback because both use
`POST /api/threads/:sourceThreadId/task-cards`.

The same runtime path appends a short developer-instruction fallback to
`thread/start` and `turn/start`. If the app-server dynamic tool is not visible
or not discoverable in a particular Codex surface, the source model should run:

```bash
node scripts/create-thread-task-card.js \
  --source-thread <current-thread-id> \
  --target-thread <target-thread-id-or-exact-title> \
  --title "<title>" \
  --body-file <markdown-file>
```

This fallback still uses the Codex Mobile task-card API and preserves the same
source-thread ownership boundary. `multi_agent_v1.spawn_agent`,
`multi_agent_v1.resume`, `multi_agent_v1.send`, and `multi_agent_v1.close` are
not Codex Mobile task-card APIs and must not be substituted for cross-workspace
file-change delegation.

App-server dynamic tools are passed in the `dynamicTools` field of
`thread/start` and `turn/start`, but they may not be listed by deferred tool
discovery surfaces such as `tool_search`. Production diagnostics should
distinguish "injected into RPC" from "discoverable through tool search". When
the dynamic tool is injected but no direct callable tool surface is visible to
the source model, the script fallback is the supported path and should create
the same source-direct task card.

Codex Mobile also registers a standard Codex MCP server named `codex_mobile`.
`server.js` calls `syncKnownCodexMobileMcpToolsets()` on startup, Profile list
reads, and workspace creation, and still calls `syncCodexMobileMcpToolset()` for
the target home before Profile-switch preflight. Those functions check every
known/target `CODEX_HOME/config.toml` and add or repair
`[mcp_servers.codex_mobile]` when it is missing or stale. The registered stdio
wrapper is `scripts/codex-mobile-mcp-server.js`; it exposes `list_threads` and
`delegate_to_thread`, and it calls the same authenticated local HTTP task-card
API as the script fallback. The config entry stores only command, script,
server URL, and key-file paths, not raw key material. It also registers
tool-level `approval_mode = "approve"` for `list_threads` and
`delegate_to_thread`, so Codex's MCP permission layer does not add a second
approval prompt around the Mobile Web runtime delegation gate. This keeps new
Codex Profiles and new Codex Homes from losing the task-card toolset after a
profile switch.

When injected, the tool's model-visible description is a mandatory boundary,
not just an optional shortcut. If the requested implementation, file edit,
command, test, deployment, or other mutation belongs to another workspace or
thread, the model should call `codex_mobile.delegate_to_thread` before doing
target-workspace work. It should not `cd` into, inspect, edit, patch, test,
deploy, or otherwise mutate the other workspace from the current thread.
Mobile Web still does not restore local keyword/path heuristics; the model is
responsible for deciding whether the user's request crosses a workspace/thread
boundary. If the current thread already attempted the target-workspace mutation
and received a sandbox, permission, cwd, or approval-policy failure, that
failure is treated as evidence for the source model to evaluate. The server
must not scan failure logs and auto-create a card in the background; the source
model must call `codex_mobile.delegate_to_thread` itself so the delegated body
preserves the source-thread context, intent, and failure evidence. Because this
is the free delegation path for an already trusted Codex thread, the dynamic
tool always forces `direct:true`, `autoApprove:true`, and `pending:false` before
calling the shared task-card helper. Manual/API callers can still request
Pending cards through the explicit task-card route; the model dynamic-tool
schema does not expose that override.

For production triage, Mobile Web emits bounded workspace-delegation diagnostics
around this path. `thread/start`, `turn/start`, and `thread/resume` log a
`[workspace-delegation-rpc]` summary with the dynamic tool names/count,
`hasWorkspaceDelegationTool`, `hasFallbackGuidance`, and sandbox/approval
summary. `item/tool/call` handling logs `[workspace-delegation-tool-call]` with
the called tool identity, source/turn ids, target reference count, body
presence, and outcome such as `ok`, `unsupported_dynamic_tool`,
`source_thread_id_required`, or `target_thread_required`. These logs are
diagnostic only: they must not contain user message bodies, full developer
instructions, access keys, cookies, or full task-card Markdown.

The switch also normalizes runtime write permissions for new or resumed work.
The server applies `applyWorkspaceDelegationRuntimeGuard()` from the shared
runtime settings helpers so ordinary plugin `thread/start`, `thread/resume`,
and `turn/start` use a real `workspace-write` / managed profile and
`approvalPolicy:"on-request"`. The profile keeps root read-only, allows writes
to the current cwd, temporary directories, and the current cwd's `.git`
metadata, and keeps `.codex` / `.agents` under the cwd read-only. The
workspace-write sandbox policy also adds the current `.git` as an explicit
writable root; otherwise current app-server builds can still reject git metadata
writes before the managed permission profile is consulted. If the Codex
app-server still asks for current-workspace `.git` or ordinary write
permissions, Mobile Web auto-allows them through
`adapters/workspace-source-write-guard-service.js`; explicit writes into another
known source root are auto-denied. Existing active turns are not retroactively
changed; the guard applies when the next start/resume request is sent.

Home AI central control-plane scripts are treated as provided tools, not as
arbitrary cross-workspace source edits. The approval guard allows narrow command
forms for `ai-ops-control-plane.js`, platform contract checks, visual harnesses,
and `deploy:macos` when the cwd is the Home AI control-plane root and the
command is not shell-chained. Direct `apply_patch`, file writes, `git add`,
`git commit`, or arbitrary write commands against Home AI source remain denied
from a plugin workspace. The request classifier resolves the source workspace
from thread/turn ownership before consulting the command cwd, so a plugin thread
cannot bypass the guard by running a shell command with `cwd` set to Home AI.
The guard is intentionally about source mutation, not about closing tool
workspaces. Foreign-cwd tool commands are allowed when they do not target the
foreign source root, including local Playwright / Chromium validation and
diagnostics that write bounded artifacts to temporary paths. Inline JavaScript
`=>` is not treated as shell redirection.

The old `danger-full-access` approval-proxy-only compatibility mode is available
only when `CODEX_MOBILE_WORKSPACE_DELEGATION_APPROVAL_PROXY_ONLY=1` is set and
`CODEX_MOBILE_WORKSPACE_DELEGATION_ENFORCE_SANDBOX_GUARD` is not set. That mode
is an emergency fallback only: it cannot block direct tool writes that do not
raise app-server approval requests. The guard also preserves the original
runtime permission profile for trusted maintenance source workspaces when they
are the source thread cwd: the Codex Mobile source workspace itself, the Home AI
central control-plane workspace that owns deployment scripts, and any cwd explicitly listed in
`CODEX_MOBILE_WORKSPACE_DELEGATION_GUARD_EXEMPT_CWDS`. Operators can disable
the write guard in an emergency with
`CODEX_MOBILE_WORKSPACE_DELEGATION_WRITE_GUARD=0` or
`CODEX_MOBILE_WORKSPACE_DELEGATION_DISABLE_WRITE_GUARD=1`. These exceptions are
for self-maintenance and bounded central deployment; ordinary plugin workspaces
should still delegate cross-workspace writes through the model-visible tool or
script fallback.

`POST /api/threads/:sourceThreadId/workspace-delegation` is retained only as a
compatibility endpoint for clients that shipped during the v363 experiment. It
returns `delegated:false`, `disabled:true`, and
`analysis.reason:"workspace_delegation_disabled"` by default. If the runtime
`跨工作区委派` switch is enabled, it still must not create cards and instead reports
`analysis.reason:"model_driven_delegation_requires_explicit_task_card"`.
The v363 local heuristic was removed because directory names and thread titles
are not reliable enough to decide target workspaces. New cross-workspace
delegation must be model/tool explicit through `POST
/api/threads/:sourceThreadId/task-cards`, `scripts/create-thread-task-card.js`,
the `codex_mobile.delegate_to_thread` app-server dynamic tool,
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
