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
