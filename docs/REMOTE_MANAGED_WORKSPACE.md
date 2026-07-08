# Remote Managed Workspace

Remote Managed Workspace support lets an external local project run a Codex
Mobile node that connects outbound to the central Home AI control plane. The
remote computer does not expose an inbound public management port.

## Ownership Boundary

- Home AI owns the Remote Managed Workspace control plane.
- Home AI owns the central listener/API, workspace registry, Owner-visible
  status, governance policy, daily-summary projection, escalation routing,
  task-card dispatch, audit policy, approval boundary, and lifecycle ledger.
- Codex Mobile owns the remote node/runtime client plus local simulator and test
  helpers.
- Codex Mobile is not the system-of-record for the remote workspace registry or
  central policy decisions.

The direction of control is:

```text
Home AI control plane/listener
  <- outbound register/poll/heartbeat/return -
Remote Codex Mobile node
  -> local Codex Desktop / local project runtime
```

## Codex Mobile Components

- `services/remote-managed-workspaces/remote-managed-workspace-node-client-service.js`
  owns remote-node startup validation and outbound client behavior.
- `services/remote-managed-workspaces/remote-managed-workspace-service.js`
  is a local Home AI central simulator state store for tests and harnesses. It
  is not production central registry ownership.
- `server-routes/remote-managed-workspace-route-service.js` is a local Home AI
  central simulator route. It only handles `/api/remote-managed-workspaces/*`
  when constructed with `centralSimulator: true`.
- `scripts/codex-mobile-remote-managed-workspace-harness.js` runs a two-port
  simulation: Home AI central simulator plus Codex Mobile remote-node simulator.

The production Codex Mobile API dispatcher does not auto-expose
`/api/remote-managed-workspaces/*` as authoritative central routes. Remote-node
config must point `centralUrl` at the Home AI control-plane endpoint.

## Home AI Control-Plane API Shape

The Home AI app owns the production endpoints:

- `POST /api/remote-managed-workspaces/register`
- `POST /api/remote-managed-workspaces/:workspaceId/node-heartbeat`
- `GET /api/remote-managed-workspaces/:workspaceId/task-cards/poll`
- `POST /api/remote-managed-workspaces/:workspaceId/task-cards/:taskCardId/ack`
- `POST /api/remote-managed-workspaces/:workspaceId/task-cards/:taskCardId/heartbeat`
- `POST /api/remote-managed-workspaces/:workspaceId/task-cards/:taskCardId/return`
- `POST /api/remote-managed-workspaces/:workspaceId/daily-summary`
- `POST /api/remote-managed-workspaces/:workspaceId/escalations`

Codex Mobile's simulator uses the same route shape so the remote-node client can
be tested against a local central stand-in. That route shape does not make
Codex Mobile the central owner.

## Remote Node Contract

Remote node config must include `workspaceId`,
`workspaceKind=remote_managed_workspace`, `projectType`, `projectRoot`,
`centralUrl`, `nodeName`, `contractVersion`, roles, and capabilities. The remote
node validates that `projectRoot` exists and is within an allowed root before
registering.

Task-card relay is outbound from the remote node to Home AI. `ack`, heartbeat,
and terminal return are per task card, not per Worker lane. Terminal return
payloads are normalized to `zh-CN` for Owner-visible receipts.

`external_project_main` is treated as a source/main role for runtime reasoning
floor and receives effective `xhigh` reasoning. External Worker, audit, and
deploy roles remain ordinary lanes and are not globally upgraded.

Daily summaries and escalations accept bounded metadata only. Forbidden
raw/private payload classes such as raw logs, endpoint bodies, secrets, cookies,
screenshots, provider payloads, private thread bodies, and raw cache data are
rejected at the simulator/client boundary and must also be rejected by Home AI
central.
