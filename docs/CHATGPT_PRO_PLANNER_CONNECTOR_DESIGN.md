# ChatGPT Pro Planner Connector Design

Status: Phase 2 server connector implemented locally; UI apply actions remain future work
Updated: 2026-06-19

This document defines how Codex Mobile should extend the existing `@ChatGPT Pro`
entry into a planner/reviewer workflow inspired by
`Ancienttwo/repo-harness`, without copying its whole harness model or weakening
Codex Mobile's current security boundaries.

## Summary

Codex Mobile already has the outbound bridge:

```text
Codex Mobile @ChatGPT Pro
  -> dedicated ChatGPT Pro bridge thread
  -> bounded prompt
  -> Chrome / ChatGPT Pro generation request
  -> runtime output directory
```

The missing half is the inbound planner connector:

```text
ChatGPT Pro MCP Connector
  -> reads only bounded Codex Mobile / repo context
  -> writes planner artifacts
  -> Codex Mobile renders and applies those artifacts deliberately
```

The target product shape is:

```text
Idea or bug
  -> ChatGPT Pro analysis
  -> PRD / checklist sprint / review / Codex goal / task-card draft
  -> explicit user action in Codex Mobile
  -> normal Codex execution
```

ChatGPT Pro is planner/reviewer. Codex remains executor.

## References

- `Ancienttwo/repo-harness`: `https://github.com/Ancienttwo/repo-harness`
- repo-harness ChatGPT MCP setup:
  `https://raw.githubusercontent.com/Ancienttwo/repo-harness/main/docs/repo-harness-chatgpt-mcp-setup.md`
- repo-harness ChatGPT browser engine:
  `https://raw.githubusercontent.com/Ancienttwo/repo-harness/main/docs/repo-harness-chatgpt-browser-engine.md`
- OpenAI help, Developer mode and MCP apps:
  `https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt`

The repo-harness pattern worth borrowing is not the full repo-local workflow.
It is the narrower contract:

- ChatGPT writes workflow artifacts, not source code.
- Planner MCP tools have an allowlist and denylist.
- Generated artifacts are durable and reviewable.
- Codex consumes a prepared goal/task card through the local execution surface.

## Existing Codex Mobile Baseline

Current implementation:

- `adapters/chatgpt-pro-bridge-service.js`
  - detects explicit `@ChatGPT Pro`
  - builds the bounded Pro prompt
  - creates or reuses the dedicated `ChatGPT Pro` thread
  - stores bridge job state under the runtime root
  - writes generated files only under runtime `outputs/chatgpt-pro`
- `server.js`
  - exposes `GET /api/chatgpt-pro/status`
  - exposes `POST /api/chatgpt-pro/generate`
  - builds `chatGptProSourceSummary()` from bounded current-thread context
- `public/app.js`
  - routes `@ChatGPT Pro` before normal message submission
  - shows the unified `@` intent menu and long-input dialog
  - rejects attachments for this entry point
- `adapters/chatgpt-pro-planner-service.js`
  - stores planner artifacts under runtime `chatgpt-pro-planner`
  - validates artifact types and apply-action metadata
  - reads only allowlisted documentation files from visible workspaces
- `adapters/chatgpt-pro-mcp-service.js`
  - exposes the restricted JSON-RPC MCP connector
  - requires a separate runtime-only bearer token
  - supports planner/reviewer tools only; it does not expose execution tools

This baseline is valuable and should remain compatible.

## Goals

1. Keep the existing `@ChatGPT Pro` entry as the mobile-friendly initiator.
2. Add structured modes:
   - `analysis`
   - `prd`
   - `sprint`
   - `codex_goal`
   - `review`
   - `task_card_draft`
3. Add a ChatGPT MCP Connector surface so ChatGPT Web can read bounded context
   and write artifacts back to Codex Mobile.
4. Make artifacts first-class in Codex Mobile:
   - visible receipt
   - saved state
   - provenance
   - apply actions
5. Preserve the security boundary:
   - no arbitrary source writes
   - no secret reads
   - no shell execution through planner profile
   - no direct Codex turn execution by default
6. Work for standalone and Home AI embedded-plugin modes.

## Non-Goals

- Do not replace normal Codex execution with ChatGPT Pro execution.
- Do not expose the full Codex Mobile HTTP API as MCP tools.
- Do not let ChatGPT write application source files by default.
- Do not upload arbitrary repository files to ChatGPT.
- Do not depend on ChatGPT mobile app MCP support. OpenAI's current help text
  says MCP apps are web-only.
- Do not store ChatGPT cookies, OAuth tokens, tunnel secrets, or browser tokens
  in the repository or `.agent-context`.

## Product Workflows

### Workflow A: Mobile-Initiated Pro Planning

User starts in Codex Mobile:

```text
@ -> ChatGPT Pro -> selects mode -> enters long prompt -> Submit
```

Codex Mobile creates a planner request:

```json
{
  "kind": "chatgpt_pro_planner_request",
  "mode": "prd",
  "sourceThreadId": "thread-id",
  "cwd": "/workspace",
  "title": "Short title",
  "prompt": "User's long request",
  "contextPolicy": {
    "threadSummary": true,
    "recentTurns": "bounded",
    "allowedRepoFiles": []
  }
}
```

The browser shows a receipt card:

```text
ChatGPT Pro planning request queued
Mode: PRD
Actions: Open ChatGPT, Copy prompt, View status
```

If MCP Connector is configured, ChatGPT Web can call back and write the
artifact. If it is not configured, Codex Mobile still provides a
connector-ready prompt that the user can copy/open manually.

### Workflow B: ChatGPT Web-Initiated Planning

User starts in ChatGPT Web:

```text
Use Codex Mobile Planner to inspect this workspace and turn this idea into a PRD.
```

ChatGPT MCP Connector calls tools:

```text
codex_mobile_status
list_workspaces
read_thread_context
read_allowed_repo_file
create_planner_artifact
prepare_codex_goal
```

Codex Mobile persists the artifact and shows it in the relevant thread or
workspace:

```text
ChatGPT Pro produced PRD: <title>
Actions: Open artifact, Apply as Goal, Create task card, Copy markdown
```

### Workflow C: Review-Only

User asks ChatGPT Pro to review a proposed plan or current diff summary.

Output type:

```text
review
```

Review artifacts should include:

- verdict
- risk list
- missing checks
- suggested implementation slices
- direct "do not implement yet" notes if scope is unclear

Review artifacts should not auto-apply.

### Workflow D: Codex Goal Preparation

ChatGPT Pro turns PRD/Sprint into a Codex goal artifact.

The goal is not automatically started. Codex Mobile shows:

```text
Prepared Codex Goal
Actions:
- Set as current thread goal
- Start in new thread
- Create task card
- Copy goal prompt
```

Starting execution remains a user action.

## Artifact Model

Store planner artifacts under the Codex Mobile runtime root by default, not
inside the source checkout:

```text
<runtime-root>/chatgpt-pro-planner/
  artifacts.jsonl
  artifacts/
    <artifact-id>.md
    <artifact-id>.json
```

The runtime-root default follows the existing Codex Mobile runtime state
boundary. Do not write source files unless a later explicit "apply" action is
implemented with confirmation and tests.

Public artifact shape:

```json
{
  "id": "cpp_...",
  "type": "prd",
  "status": "draft",
  "title": "Improve profile switch preflight",
  "source": {
    "kind": "chatgpt_pro",
    "sourceThreadId": "thread-id",
    "cwd": "/workspace",
    "conversationUrl": "https://chatgpt.com/...",
    "requestId": "request-id"
  },
  "bodyMarkdown": "# PRD ...",
  "createdAt": 1781850000000,
  "updatedAt": 1781850000000,
  "applyActions": [
    "copy_markdown",
    "set_goal",
    "create_task_card"
  ]
}
```

Artifact types:

| Type | Meaning | Default apply actions |
| --- | --- | --- |
| `analysis` | General analysis or decision memo | copy, save |
| `prd` | Product requirements document | copy, generate sprint |
| `sprint` | Ordered checklist sprint | copy, prepare goal |
| `codex_goal` | Goal text for a Codex thread | set goal, start thread, copy |
| `review` | Reviewer findings and missing checks | copy, create task card |
| `task_card_draft` | Cross-thread task card draft | create task card |

## MCP Connector Surface

Use a dedicated MCP endpoint and auth boundary. Do not reuse the broad
standalone app API as-is.

Proposed endpoint:

```text
POST /api/chatgpt-pro/mcp
```

The first implementation keeps this in the existing local listener. It can
later move to a separate listener if deployment or tunnel constraints require
it.

Authentication:

- MCP connector auth should be separate from the normal Codex Mobile Access Key.
- Store MCP secrets under runtime root, never in source or `.agent-context`.
- Prefer OAuth / signed connector flow when available.
- For local testing, a bearer token may be acceptable if it is runtime-only and
  never logged.
- Current implementation reads the token from
  `CODEX_MOBILE_CHATGPT_PRO_MCP_TOKEN` or
  `CODEX_MOBILE_CHATGPT_PRO_MCP_TOKEN_FILE`. There is no automatic source-tree
  token generation.

Proposed planner tools:

| Tool | Purpose | Writes |
| --- | --- | --- |
| `codex_mobile_status` | Return safe version/config readiness | none |
| `list_visible_workspaces` | Return bounded workspace list | none |
| `read_thread_context` | Return bounded thread title/status/recent user intent | none |
| `read_allowed_repo_file` | Read allowlisted docs/plans/tasks files only | none |
| `create_planner_artifact` | Save analysis/PRD/sprint/review markdown | runtime artifact store |
| `prepare_codex_goal` | Save `codex_goal` artifact from PRD/Sprint | runtime artifact store |
| `create_task_card_draft` | Save task-card draft without sending | runtime artifact store |
| `list_planner_artifacts` | List recent artifacts for current workspace/thread | none |
| `read_planner_artifact` | Read one saved artifact | none |

Explicitly excluded from planner profile:

- source-code writes
- package manifest or lockfile writes
- CI config writes
- shell execution
- app-server `turn/start`
- approval responses
- raw rollout or full log reads
- arbitrary local file reads

## File Policy

Default allowed reads:

- `AGENTS.md`
- `README.md`
- `docs/**`
- `.agent-context/PROJECT_CONTEXT.md` and `.agent-context/HANDOFF.md` only as
  bounded summaries, not full raw dumps
- task-card docs
- side-chat docs
- current public module/architecture docs

Default denied reads:

- `.env`, `.env.*`
- `*.pem`, `*.key`, certificates
- `.ssh/**`
- `.git/**`
- `node_modules/**`
- runtime roots under `.codex`, `.codex-mobile-web`
- uploads
- logs
- browser profiles and cookies
- access-key files
- raw rollout JSONL by default

Default write targets:

- runtime planner artifact store only

Future explicit apply targets:

- thread goal through app-server goal RPC
- task-card draft through existing task-card service
- side-chat candidate
- optionally a repo-local markdown file after confirmation

## UI Design

### Composer Intent Dialog

Extend the existing `@ChatGPT Pro` dialog with a mode selector:

```text
Analysis | PRD | Sprint | Goal | Review | Task card
```

Keep the current large textarea and draft-save behavior.

Mode-specific placeholders:

- Analysis: "写清要分析的方案、代码区域、风险或取舍。"
- PRD: "写清用户、问题、目标、非目标、验收标准。"
- Sprint: "写清要拆分的阶段、每阶段交付物和检查。"
- Goal: "写清 Codex 需要执行的目标、约束和完成条件。"
- Review: "贴入方案或说明要审查的范围。"
- Task card: "写清目标线程、背景、输出和约束。"

### Receipt Card

After submission, show a receipt in the conversation surface:

```text
ChatGPT Pro Planner
Mode: PRD
Status: waiting for ChatGPT / submitted / artifact ready / failed
Actions:
- Open ChatGPT
- Copy prompt
- Refresh
- View artifact
- Apply
```

The receipt must not appear as a normal user message in the current Codex work
thread unless the user explicitly applies it.

### Artifact Detail

Artifact detail should be a bounded markdown view with metadata:

- type
- source thread
- workspace
- created time
- ChatGPT conversation URL if present
- raw provider/session id if present
- apply actions

## Server Implementation Plan

### New Adapter

Add:

```text
adapters/chatgpt-pro-planner-service.js
```

Responsibilities:

- normalize modes and artifact types
- validate request size
- validate file read/write policy
- persist planner requests and artifacts
- expose public artifact shapes
- map artifact type to allowed apply actions
- redact unsafe text

Keep `server.js` as route glue.

Implemented server-side companion:

```text
adapters/chatgpt-pro-mcp-service.js
```

Responsibilities:

- JSON-RPC `initialize`, `tools/list`, and `tools/call`
- separate bearer token authorization
- MCP tool schema projection
- JSON result wrapping without raw secrets or logs

### Routes

Proposed authenticated app routes:

```text
GET  /api/chatgpt-pro/planner/status
POST /api/chatgpt-pro/planner/requests
GET  /api/chatgpt-pro/planner/requests/:id
GET  /api/chatgpt-pro/planner/artifacts
GET  /api/chatgpt-pro/planner/artifacts/:id
POST /api/chatgpt-pro/planner/artifacts/:id/actions
```

Proposed MCP route:

```text
POST /api/chatgpt-pro/mcp
```

Current implemented routes:

```text
GET  /api/chatgpt-pro/planner/status
GET  /api/chatgpt-pro/planner/artifacts
POST /api/chatgpt-pro/planner/artifacts
GET  /api/chatgpt-pro/planner/artifacts/:id
GET  /api/chatgpt-pro/mcp
POST /api/chatgpt-pro/mcp
```

If implementing MCP in-process makes `server.js` too broad, move the MCP
protocol implementation into:

```text
adapters/chatgpt-pro-mcp-service.js
```

### Apply Actions

Apply action behavior:

| Action | Implementation |
| --- | --- |
| `copy_markdown` | Browser-only copy |
| `set_goal` | Existing thread goal route |
| `start_thread_with_goal` | Existing new-thread route plus goal set |
| `create_task_card` | Existing task-card draft/create route |
| `create_side_chat_candidate` | Existing side-chat candidate store |
| `save_runtime_artifact` | Already persisted by planner service |

Do not add `execute_now` in the first implementation.

## ChatGPT Prompt Contract

Every connector-ready prompt should include:

```text
You are ChatGPT Pro acting as planner/reviewer for Codex Mobile.

Do:
- inspect only allowed bounded context
- produce the requested artifact type
- include assumptions and risks
- include verification suggestions
- write the artifact through the Codex Mobile Planner connector when available

Do not:
- write source code
- ask for secrets
- run shell commands
- start Codex turns
- treat your output as already implemented
```

For Codex goal output, preserve this shape:

```text
Objective:
...

Constraints:
...

Execution steps:
1. ...

Required checks:
- ...

Done when:
- ...
```

## Security And Privacy Rules

1. ChatGPT planner tools default to read-only plus runtime artifact writes.
2. Planner profile cannot write source, package manifests, lockfiles, CI, or
   secret-like files.
3. Planner profile cannot run shell commands or call app-server turn execution.
4. Connector auth material is runtime-only and redacted from logs.
5. ChatGPT-generated markdown is untrusted content. Render through the existing
   markdown sanitizer path.
6. Artifact application must be explicit and reversible where possible.
7. Public release must not include private connector URLs, tunnel domains,
   tokens, OAuth files, session transcripts, or raw Pro outputs.

## Implementation Phases

### Phase 1: Runtime Artifact Store And UI Modes

Goal: make `@ChatGPT Pro` produce structured planner requests/artifacts even
before MCP is live.

Tasks:

1. Add `adapters/chatgpt-pro-planner-service.js`.
2. Add mode field to current `@ChatGPT Pro` dialog.
3. Persist planner requests and placeholder artifacts in runtime state.
4. Add receipt cards and artifact detail view.
5. Keep existing direct `@ChatGPT Pro ...` compatibility by mapping it to
   `analysis` mode.

Validation:

- planner service tests
- frontend render tests
- `test/chatgpt-pro-bridge-service.test.js`
- `test/thread-task-card-route.test.js`
- `test/mobile-viewport.test.js`

### Phase 2: MCP Planner Connector

Goal: allow ChatGPT Web to write planner artifacts through a restricted MCP
surface.

Tasks:

1. Implement MCP route/service with planner tools.
2. Add runtime-only MCP auth config.
3. Add setup/status route for connector readiness.
4. Add allowlist/denylist file policy tests.
5. Add connector-ready prompt generation in the receipt card.

Validation:

- MCP service tests
- auth failure tests
- file policy tests
- artifact creation route tests

### Phase 3: Apply Actions

Goal: let users deliberately apply artifacts to Codex Mobile workflow.

Tasks:

1. Implement `set_goal` from `codex_goal`.
2. Implement `create_task_card` from `task_card_draft` or `review`.
3. Implement `create_side_chat_candidate` from analysis/review.
4. Add UI action buttons and result receipts.
5. Ensure failed apply actions show inline error receipts.

Validation:

- thread goal tests
- task-card service/route tests
- side-chat service/route tests
- conversation render tests

### Phase 4: Optional Orchestrator Profile

Goal: support controlled execution only after the planner workflow is stable.

This is not part of the first implementation.

If added later:

- separate `orchestrator` auth/profile
- fixed `codex_goal` input only
- explicit user confirmation
- timeout-bounded
- full audit trail
- no arbitrary shell

### Phase 5: Production And Public Release

Tasks:

1. Document setup for standalone and Home AI embedded-plugin mode.
2. Add public-safe README Chinese notes.
3. Validate no runtime connector state enters public release.
4. Run full `npm test`, `npm run check`, and public mirror validation before
   publishing.

## Test Matrix

Minimum focused tests:

| Area | Tests |
| --- | --- |
| planner artifact service | new `test/chatgpt-pro-planner-service.test.js` |
| MCP planner policy | new `test/chatgpt-pro-mcp-service.test.js` |
| existing bridge compatibility | `test/chatgpt-pro-bridge-service.test.js` |
| composer `@` UI | `test/thread-task-card-route.test.js`, `test/composer-draft.test.js` |
| artifact rendering | `test/conversation-render.test.js`, `test/mobile-viewport.test.js` |
| goal apply | `test/thread-goal-service.test.js` |
| task-card apply | `test/thread-task-card-service.test.js`, `test/thread-task-card-route.test.js` |
| security/path policy | service tests plus `git diff --check` |

Full validation before publish:

```bash
npm test
npm run check
git diff --check
```

For Home AI embedded-plugin production changes, also follow the center AI Ops
intake / required-check / evidence-ledger workflow from the Home AI platform
contract.

## Open Questions

1. Should MCP auth use OAuth first, or begin with a runtime bearer token behind
   an HTTPS tunnel?
2. Should artifacts remain runtime-only forever, or should users be able to
   explicitly save PRD/Sprint files into a workspace repo?
3. Should ChatGPT Web write artifacts to a current thread, current workspace,
   or a global planner inbox when no source thread exists?
4. Should Home AI host own the public HTTPS tunnel, or should standalone Codex
   Mobile provide its own connector setup path?
5. Should `@ChatGPT Pro` in mobile show "Open ChatGPT Web" only on desktop, or
   also on phone with a warning that custom MCP apps are web-only?

## Acceptance Criteria

- Existing `@ChatGPT Pro ...` behavior remains compatible.
- A user can choose a structured Pro mode from the `@` intent path.
- ChatGPT Web can write a PRD/Sprint/Review/Goal artifact through a restricted
  connector.
- Artifacts are visible in Codex Mobile and can be applied only by explicit
  user action.
- Planner connector cannot read secrets, upload arbitrary files, edit source,
  run shell commands, or start Codex turns by default.
- Public release contains no connector secrets, raw Pro outputs, private tunnel
  URLs, `.agent-context`, runtime state, or user uploads.
