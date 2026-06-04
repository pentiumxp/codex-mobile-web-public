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
| File/module ownership, where to implement changes, test map | `docs/MODULES.md` |
| Live production issue, stuck turn, missing message, PWA cache, Push, mux drift | `docs/TROUBLESHOOTING.md` |
| Model context size, image upload context, continuation bootstrap strategy, workspace context compaction | `docs/CONTEXT_STRATEGY.md` |
| Non-trivial feature or cross-cutting fix | `docs/COMPLEX_FEATURE_PATHS.md` |
| Cross-thread task-card collaboration planning | `docs/CROSS_THREAD_TASK_CARDS_DESIGN.md` |
| Multi-account Codex CLI on Windows | `docs/MULTI_ACCOUNT_CODEX_CLI.md` |
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

## Standard Verification

For code changes, use the narrowest relevant focused tests, then scale by risk:

```powershell
npm.cmd test
npm.cmd run check
npm.cmd run check:macos
git diff --check
```

For server-side runtime changes, restart only the 8787 Node listener unless the change touches the mux, startup scripts, service worker shell cache, or external Codex app-server process.
