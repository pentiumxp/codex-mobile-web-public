# PR Automation

This document defines the Codex Mobile side of scheduled pull-request intake,
absorption, release gating, public sync, and PR close orchestration.

## Boundary

The automation is not a cron job that runs `git merge`, deploys, pushes public,
or closes PRs directly. A scheduled caller runs one bounded planning pass:

```bash
node scripts/codex-mobile-pr-automation.js --json --write-state
```

The script reads private/public GitHub PR metadata through `gh`, checks the
shared worktree status, loads bounded automation state from
`.agent-context/pr-automation-state.json`, and returns metadata-only next-step
actions. External Home AI Automation or an operator-owned scheduler may invoke
the script on an interval. The script exits after one pass.

## State Machine

`services/runtime/pr-automation-service.js` owns the pure state machine:

- `discovered`
- `already_absorbed`
- `absorption_dispatched`
- `absorbed_private`
- `validation_failed`
- `deploy_dispatched`
- `deploy_readback_passed`
- `public_sync_dispatched`
- `public_ready`
- `pr_closed`
- `blocked`

Each PR uses the stable identity `github-pr:<owner/repo>:<number>` and a
revision identity that includes the current head ref/sha. Task-card dispatch
requests use deterministic idempotency keys derived from those identities.

## Gates

The planner must fail closed or wait when any gate is missing:

- GitHub CLI/auth unavailable: `github_credentials_missing`.
- Shared checkout is dirty and no clean detached worktree is available:
  `shared_checkout_dirty`.
- PR contains generated shell/Vite artifacts: direct merge is rejected with
  `generated_artifacts_rebuild_required`; source intent must be absorbed on
  private main and artifacts regenerated locally.
- Private absorption needs tests before deploy: `public_ready_gate_required`.
- Deploy/readback has not passed: `deploy_readback_required`.
- Public parity/public-ready sync has not passed: `public_sync_required` or
  `public_ready_gate_required`.
- PR close is not explicitly allowed after public-ready: `pr_close_gate_required`.
- Known release/combined-head hold: `release_hold_active` or a specific hold
  code supplied by the scheduler.

## Configuration

Environment variables:

- `CODEX_MOBILE_PRIVATE_REPOSITORY`, default `pentiumxp/codex-mobile-web`.
- `CODEX_MOBILE_PUBLIC_REPOSITORY`, default
  `pentiumxp/codex-mobile-web-public`.
- `CODEX_MOBILE_PR_AUTOMATION_STATE`, default
  `.agent-context/pr-automation-state.json`.

For tests or dry-run automation, pass `--fixture <file>`; fixture mode never
requires GitHub credentials and still produces the same sanitized plan shape.

## Release Policy

Public push and PR close remain behind explicit deploy/readback and public-ready
evidence. The PR automation service can request follow-up Worker/Deploy/Public
sync task cards, but those lanes own mutation and terminal return evidence.
Owner-visible terminal receipts must remain Chinese and metadata-only.
