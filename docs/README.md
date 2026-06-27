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

The current local module candidate is focused on pane-local context ownership:
thread metadata, metadata notifications, pending actions, pending-action
request/update notifications, pending-action resolution notifications,
task-card draft state, task-card pending counts, optimistic thread status,
failed-send status restore, thread status notifications, and pane toolbar
actions, older-history pagination, and continuation confirmation dialogs must
all update or operate on the target pane instead of falling back to the global
current thread. Manual task-card creation must also use the source pane's live
turn id and refresh the source pane after card creation. In-turn approval and
user-input controls must render action thread ids from the active pane/render
context when the server request itself omits a thread id.
