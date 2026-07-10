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
- `services/remote-managed-workspaces/remote-managed-workspace-settings-service.js`
  owns the local remote-node settings store. It persists non-secret config and
  connection state under the Codex Mobile runtime root, and writes enrollment
  credentials only to a separate local secret entry with masked readback.
- `services/remote-managed-workspaces/remote-managed-workspace-node-runner-service.js`
  owns the local outbound runner state machine. It registers with Home AI,
  sends node heartbeat, polls task cards, sends per-card ack/heartbeat/terminal
  return, tracks idempotency, queues bounded terminal returns while offline, and
  retries with backoff.
- `services/remote-managed-workspaces/remote-managed-workspace-local-execution-service.js`
  owns the remote-card-to-local-Codex bridge. It validates the configured local
  project root, starts a local Codex thread/turn in that project root, waits for
  bounded turn completion through the existing app-server RPC surface, and
  returns zh-CN metadata-only terminal evidence to the runner.
- `services/remote-managed-workspaces/remote-managed-workspace-service.js`
  is a local Home AI central simulator state store for tests and harnesses. It
  is not production central registry ownership.
- `server-routes/remote-managed-workspace-route-service.js` is a local Home AI
  central simulator route. It only handles `/api/remote-managed-workspaces/*`
  when constructed with `centralSimulator: true`.
- `scripts/codex-mobile-remote-managed-workspace-harness.js` runs a two-port
  simulation: Home AI central simulator plus Codex Mobile remote-node settings
  store, runner, and local project simulator.

The production Codex Mobile API dispatcher does not auto-expose
`/api/remote-managed-workspaces/*` as authoritative central routes. Remote-node
config must point `centralUrl` at the Home AI control-plane endpoint.

## Home AI Control-Plane API Shape

The Home AI app owns the production endpoints:

- `POST /api/remote-managed-workspaces/register`
- `POST /api/remote-managed-workspaces/pairing-requests`
- `GET /api/remote-managed-workspaces/pairing-requests/:requestId`
- `POST /api/remote-managed-workspaces/:workspaceId/node-heartbeat`
- `GET /api/remote-managed-workspaces/:workspaceId/task-cards/poll`
- `POST /api/remote-managed-workspaces/:workspaceId/task-cards/:taskCardId/ack`
- `POST /api/remote-managed-workspaces/:workspaceId/task-cards/:taskCardId/heartbeat`
- `POST /api/remote-managed-workspaces/:workspaceId/task-cards/:taskCardId/return`
- `POST /api/remote-managed-workspaces/:workspaceId/daily-summary`
- `POST /api/remote-managed-workspaces/:workspaceId/escalations`

Codex Mobile's simulator uses the same route shape so the remote-node client can
be tested against a local central stand-in. Pairing responses expose Home AI's
canonical `pairingRequest.requestId` shape and keep `pairing` only as a local
legacy alias. That route shape does not make Codex Mobile the central owner.

## Remote Node Contract

Remote node config must include `workspaceId`,
`workspaceKind=remote_managed_workspace`, `projectType`, `projectRoot`,
`centralUrl`, `nodeName`, `contractVersion`, roles, and capabilities. The remote
node validates that `projectRoot` exists and is within an allowed root before
registering.

The Codex Mobile settings panel exposes a simplified authorized local setting at
`/api/settings/remote-managed-workspace`. The ordinary UI shows only the global
Home AI central URL plus known local Workspace rows. Choosing `远程受控` for a
Workspace creates the remote-node config automatically: `workspaceKind`, stable
workspace id, stable node name, project root, allowed root, default project type,
HTTP polling fallback metadata, and default local role/capability set are all
derived by `remote-managed-workspace-settings-service.js`. Internal fields remain
visible only in the collapsed Advanced/Diagnostics area as bounded metadata.
Enrollment credentials remain write-only/masked; readback returns only
configured/ref/masked state and never the raw token.

The preferred connection mode is a persistent outbound abstraction. Until Home
AI exposes a persistent session endpoint, Codex Mobile reports
`effectiveConnectionMode=http_polling` and uses HTTP polling fallback. The
fallback is still remote-to-central outbound only.

Task-card relay is outbound from the remote node to Home AI. `ack`, heartbeat,
and terminal return are per task card, not per Worker lane. Terminal return
payloads are normalized to `zh-CN` for Owner-visible receipts.

`external_project_main` is treated as a source/main role for runtime reasoning
floor and receives effective `xhigh` reasoning. External Worker, audit, and
deploy roles remain ordinary lanes and are not globally upgraded.

When a task card is received, the runner acks it, starts the local execution
bridge, sends per-card heartbeats while the local turn is active, and sends one
bounded terminal return to Home AI central after the local turn completes,
fails, or times out. The bridge uses Codex Mobile's existing local app-server
RPCs (`thread/start`, `turn/start`, `thread/turns/list`); it does not expose a
central shell, broad filesystem read route, or inbound remote-machine
management surface. If the bridge is unavailable in a custom composition, the
runner still fails closed with `local_task_card_execution_bridge_unavailable`.

Structured command execution requirements are runtime contract, not task-body
inference. When a trusted central task card includes
`executionRequirements.requiresCommandExecution=true`, the local execution
bridge attaches a bounded `remoteManagedWorkspaceExecution` contract to
`turn/start`, adds trusted developer guidance for the standard command execution
tool surface, and records direct `toolSurfaceAvailability` evidence in the
per-card execution result. If `toolSurfaceRequired=true` but the command tool
surface or authority bridge is unavailable, the bridge fails closed before
starting a local turn with
`remote_managed_workspace_command_tool_surface_unavailable`. A completed local
turn with only assistant text, zero response/items, too few completed command
items, or missing required command classes remains blocked by terminal
validation; Codex Mobile must not synthesize command evidence or execute shell
commands outside the app-server approval bridge.

Daily summaries and escalations accept bounded metadata only. Forbidden
raw/private payload classes such as raw logs, endpoint bodies, secrets, cookies,
screenshots, provider payloads, private thread bodies, and raw cache data are
rejected at the simulator/client boundary and must also be rejected by Home AI
central.

## Local Validation

Focused validation for this boundary:

```bash
node --test test/remote-managed-workspace-service.test.js \
  test/remote-managed-workspace-route-service.test.js \
  test/remote-managed-workspace-settings-service.test.js \
  test/remote-managed-workspace-node-runner-service.test.js \
  test/remote-managed-workspace-integration.test.js
node scripts/codex-mobile-remote-managed-workspace-harness.js
```
