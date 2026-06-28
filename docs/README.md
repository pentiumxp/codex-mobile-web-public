# Codex Mobile Web Project Docs

This directory is the project-facing documentation set for engineering work in this repository. It is intentionally split by task so future agents do not have to load the full README or long handoff history for every change.

## Reading Guide

Always start substantial work by reading:

1. `.agent-context/PROJECT_CONTEXT.md`
2. `.agent-context/HANDOFF.md`
3. The smallest relevant document below.

| Task | Read |
| --- | --- |
| System design, process boundaries, runtime state, request flow | `docs/ARCHITECTURE.md` |
| Current architecture diagnosis and staged optimization plan | `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md` |
| File/module ownership, where to implement changes, test map | `docs/MODULES.md` |
| Live production issue, stuck turn, missing message, PWA cache, Push, mux drift | `docs/TROUBLESHOOTING.md` |
| Model context size, image upload context, continuation bootstrap strategy, workspace context compaction | `docs/CONTEXT_STRATEGY.md` |
| Non-trivial feature or cross-cutting fix | `docs/COMPLEX_FEATURE_PATHS.md` |
| Thread detail projection redesign, visible-item contract, v3/v4 migration | `docs/THREAD_DETAIL_PROJECTION_V4_DESIGN.md` |
| Cross-thread task-card collaboration planning | `docs/CROSS_THREAD_TASK_CARDS_DESIGN.md` |
| Current-thread side chat planning | `docs/THREAD_SIDE_CHAT_REQUIREMENTS.md`, `docs/THREAD_SIDE_CHAT_DESIGN.md`, `docs/THREAD_SIDE_CHAT_IMPLEMENTATION.md` |
| ChatGPT Pro planner / MCP connector planning | `docs/CHATGPT_PRO_PLANNER_CONNECTOR_DESIGN.md` |
| Multi-account Codex CLI on this Windows machine | `docs/MULTI_ACCOUNT_CODEX_CLI.md` |
| Public/private release decision | `.agent-context/PROJECT_CONTEXT.md` plus current git state |

## Source Of Truth Order

Use this precedence when facts conflict:

1. Current local repository state and runtime checks.
2. `.agent-context/thread-handoffs/<latest>.md` for explicit continuation threads.
3. `.agent-context/PROJECT_CONTEXT.md` and `.agent-context/HANDOFF.md`.
4. These `docs/` files.
5. README and older handoff/archive notes.

Do not assume a new thread inherits prior UI state, shell PATH, running process state, old approvals, or hidden reasoning. Re-check cheap runtime facts such as `/api/public-config`, `/api/status`, `git status`, and current service worker build id.

## Safety

- Never commit raw access keys, VAPID private keys, Web Push subscription endpoints, uploaded attachment content, full rollout logs, full prompts, or `.codex` runtime state.
- Keep `%USERPROFILE%\.codex` read-only except through app-server RPCs.
- Keep generated continuation handoff files under `.agent-context/thread-handoffs/` ignored.
- Keep model-context and continuation-size policy changes documented in `docs/CONTEXT_STRATEGY.md`.
- Outside explicit public-release work, do not sync or push the clean public repository.
- For plugin bugfix, deploy, MCP, schema, provisioning, and platform-boundary work, follow the central Home AI root-cause architecture contract at `/Users/hermes-dev/HermesMobileDev/app/docs/PLATFORM_CONTRACTS/root-cause-architecture-contract.md`; reference that file directly instead of copying it here.

## Standard Verification

For code changes, use the narrowest relevant focused tests, then scale by risk:

```powershell
npm.cmd test
npm.cmd run check
npm.cmd run check:macos
git diff --check
```

For server-side runtime changes, restart only the 8787 Node listener unless the change touches the mux, startup scripts, service worker shell cache, or external Codex app-server process.

## Current Architecture Cadence

After `codex-mobile-shell-v542`, pane/context reliability work uses small
local commits as the default cadence. A slice should name one owning layer and
one violated invariant, add focused executable coverage, pass full local
checks, and stay undeployed until several compatible slices form a coherent
runtime module. Do not bump shell/cache, deploy production, or push Public for
each micro-slice unless the user explicitly asks.

The latest deployed performance modules target thread-list/detail cold-start
and first-entry peak latency after the active-detail hot path work. Production
readback first showed larger first-paint list requests such as
`limit=137&initial=warm-fallback` could still miss the process cache even after
the default 40-row prewarm had completed. The deployed prewarm fix makes
prewarm build a wider source snapshot so larger same-scope first-paint requests
can rebuild their final window from warm source data instead of synchronously
scanning rollout tails again.

The latest active-detail payload slice extends the response-budget service from
item-count pressure to item-count plus byte-pressure decisions. Active turns now
enter progressive operation/reasoning/assistant budgets when either the active
turn body or returned detail window is too large, and collab-agent tool calls
are classified as operation items across server budget, v4 visible keys, and the
browser activity label. When progressive active pressure is already triggered,
oversized retained active assistant/reasoning text fields are also reduced to a
bounded first-paint preview and marked with `mobileActiveTextBudget`. This
targets the successful-but-heavy state where a thread does not time out but
still waits too long before first paint. The next performance slice should
target the remaining cold/deferred app-server and active projection peaks:
immediately after restart, a first list/detail request can still take seconds
and then settle back to hundreds of milliseconds.

The latest projection-hit slice targets the remaining warm `projection-v4-cache`
and `projection-v4-dynamic` detail cost after payload budgeting. Cached v4
results already carry stable visible keys, so ordinary hits now refresh only
read-mode/source/revision metadata and aggregate visible-key lists when all
retained items are already normalized. If a dynamic delta has produced an
unnormalized item, the service still falls back to full v4 normalization before
returning the response. The projection-result assembler also skips raw
`thread/read` compaction for response-ready v4 hits with complete visible-key
metadata, while keeping the compaction path for invalid or legacy cache shapes.

The latest response-budget slice adds a second-stage first-paint visible item
ceiling for active/progressive pressure. After operation/reasoning/assistant
tails and active text are compacted, the server can prune older
operation/reasoning rows until the first-paint detail shape is below the
configured ceiling (`CODEX_MOBILE_THREAD_DETAIL_PROGRESSIVE_VISIBLE_ITEM_CEILING`,
default `48`, `0` disables). User messages, images, Usage rows, diagnostics,
and retained final assistant/plan receipts remain protected, and the response
records the omitted visible-item counts in `mobileDetailResponseBudget`.
Active operation payload budgeting also covers retained operation display and
structured fields used by command/file/tool/MCP/collab-agent cards, including
file-change `changes`, collab-agent task/prompt text, and bounded
action/request/response payloads, so these rows cannot bypass first-paint
budgets just because their item count is already small. The next server-side
budget slice also brings oversized active `userMessage` payloads into the same
progressive pressure boundary: long task-card/bootstrap text is reduced to a
bounded first-paint preview, and inline `data:image` input parts are replaced by
metadata-only placeholders before the HTTP detail response is sent. This does
not change the persisted session and does not affect ordinary short user input
when progressive active pressure is absent.
The follow-up first-paint byte slice closes the remaining case where the item
count is already small but retained completed assistant/plan receipts still
make the detail body heavy. When active progressive pressure is present, or
when a resting recent detail is still oversized because of historical completed
receipts, and the post-item-budget thread JSON still exceeds
`CODEX_MOBILE_THREAD_DETAIL_PROGRESSIVE_FIRST_PAINT_THREAD_BYTES` (default
`160KB`), non-current/historical completed assistant/reasoning text is reduced
to a bounded preview (`CODEX_MOBILE_THREAD_DETAIL_PROGRESSIVE_COMPLETED_TEXT_CHARS`,
default `8KB` per item) with `mobileFirstPaintTextBudget` evidence. Resting
details protect the latest completed turn so the current final answer remains
visible by default.

The latest thread-list slice targets the ordinary default list read after a
process warm cache already exists. A no-search, no-workspace, no-cursor,
non-archived `/api/threads` request can now return the process warm fallback
cache immediately and defer app-server refresh, reporting
`appServerDeferredReason=warm-fallback-default` and
`appServerDeferredInitialReason=default-warm-cache`. It does not build a cold
local baseline for ordinary default reads; if the warm cache is missing, the
request continues through the existing app-server path so true cold startup
cost stays observable. Explicit `initial=warm-fallback` first-paint requests
keep their existing cold-baseline behavior.
The token-usage decoration follow-up keeps that warm path from being dominated
by repeated SQLite aggregate work: replayed identical completed-turn Usage
events do not invalidate the process query cache, and thread-list first paint
can reuse an expired in-process Usage aggregate when the date/thread/workspace
key still matches and no real Usage write has invalidated it. Repeated list
paints also reuse a compiled visible-Workspace snapshot so Chinese/mojibake path
aliases and stable Workspace cache keys are not rebuilt for the same Workspace
set. The server also reports token usage cache/query/snapshot counters in
thread-list timings so `decorateMs` can be diagnosed separately from fallback
and app-server latency.

The follow-up client diagnostics slice treats thread-list "slow but eventually
successful" loads as a first-class slow path. Successful list loads now plan a
bounded `thread_list_slow_path` diagnostic from the same `thread_list_rendered`
performance evidence, including client elapsed/API/render timings plus safe
server timing labels such as `performancePhase`, fallback-cache decision,
app-server request reason, and bounded source/app-server counters. Repeated
matching stalls can enter Home AI's Owner-gated diagnostic loop instead of
being cleared as ordinary success.

The v557 diagnostics slice applies the same "slow success is observable"
contract to thread detail first paint. Successful detail loads that cross the
default 1.5s threshold now plan `thread_detail_slow_path`, and slow-path repeat
counting aggregates by stable surface/action/thread/error identity instead of
splitting on client build id, read mode, render mode, or source kind. Those
volatile fields remain in the bounded report payload as evidence, but they no
longer prevent repeated cold peaks from reaching the Home AI Owner-gated
diagnostic loop.

The active-window coalescing slice targets the "long spinner, then eventual
success" shape seen on active large sessions. That shape is not a network/RPC
timeout: the request completes after synchronously building
`turns-list-active-overlay-window`. The current server now shares an in-flight
active-window read between background prewarm and the foreground
`/api/threads/:id` detail route for the same thread/mode, so a cold first open
does not duplicate the same app-server turns-list work. Residual latency after
this slice belongs to the single authoritative app-server active-window read or
earlier prewarm readiness, not duplicate frontend refreshes.

The same module also links startup thread-list fallback prewarm to
active-window prewarm. When the process-lifetime fallback baseline finishes, the
server inspects only the already-returned active thread summaries and schedules
active-window prewarm for those rows. This keeps list fallback authority and
public diagnostics unchanged while increasing the chance that a restarted
server has the active detail window ready before the user opens the large
thread.

The active-overlay lookup path can now also reuse a stale full projection as a
history-only active-window input when the stable projection identity still
matches but the rollout size/mtime moved because the current active turn kept
growing. This is limited to explicit `activeOverlay` partial lookups with an
`omitActiveTurnId`; ordinary detail lookups and resting threads still reject the
same stale signature and reseed from the authoritative app-server path.

The follow-up active history-baseline slice closes another restart/notification
race: if a `turn/started` or active item notification arrives before the process
has reloaded the warm full projection into memory, the projection service first
restores the persisted full cache and then applies the live notification. That
keeps a full history baseline available for the active-overlay proof gate, so a
foreground detail read is less likely to join a background
`turns-list-active-overlay-window` rebuild.
