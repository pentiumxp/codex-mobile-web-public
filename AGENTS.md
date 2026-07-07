# Workspace Agent Instructions

回答保持中性、客观、科学、证据导向，不迎合，不提供情绪价值，不夸张，不主观拔高。

## Shared Workspace Context

Before substantial work in this workspace, read:

1. `.agent-context/PROJECT_CONTEXT.md`
2. `.agent-context/HANDOFF.md`

Treat them as the durable project context.

Before ending substantial work, update `.agent-context/HANDOFF.md`.

Do not store raw secrets, access tokens, passwords, or one-time approval state in shared context files.

## Codex Mobile Reliability Rule

Codex Mobile is a primary coding tool. Bugs in Codex Mobile itself must be fixed
from the root cause and architecture boundary first. Do not add fallback layers
that merely hide projection, synchronization, state ownership, routing, or
runtime-contract defects while leaving the underlying inconsistency in place.
Any temporary diagnostic workaround must be clearly scoped, documented, and
removed or replaced by the architectural fix before release.

## Home AI Root-Cause Contract

For plugin bugfix, deploy, MCP, schema, provisioning, and platform-boundary
work, follow the central Home AI root-cause architecture contract:
`/Users/hermes-dev/HermesMobileDev/app/docs/PLATFORM_CONTRACTS/root-cause-architecture-contract.md`.
Reference that file as the canonical contract; do not copy it locally.

Before non-trivial fixes, identify the symptom, failing layer, owning workspace,
violated invariant, root cause or strongest hypothesis, and closure validation.
Fallbacks must be bounded, observable, temporary, validated, and have an owner
and removal path.

## Plugin Main Routing Preflight

Plugin main/source threads must run the Home AI routing preflight before
non-trivial implementation, investigation, review, Harness, deploy-routing, or
cross-thread dispatch work:

```bash
node /Users/hermes-dev/HermesMobileDev/app/scripts/main-thread-routing-preflight.js --source-thread-role plugin_main --task "<task>" --changed-file <path> --mode classify
```

If the preflight returns `classification=plugin_worker`, dispatch a bounded
`plugin_worker` card or return `blocked` with the missing lane. Do not use Task
Intake, deploy lanes, audit lanes, Loop lanes, or the current plugin source
thread as a Worker fallback.
