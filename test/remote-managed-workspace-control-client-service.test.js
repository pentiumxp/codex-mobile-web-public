"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  createRemoteManagedWorkspaceControlBootstrapService,
  createRemoteManagedWorkspaceControlClientService,
  publicTaskCard,
  publicWorkspace,
} = require("../services/remote-managed-workspaces/remote-managed-workspace-control-client-service");

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

test("RMW control client returns bounded workspace metadata and contract fields", async () => {
  const requests = [];
  const client = createRemoteManagedWorkspaceControlClientService({
    fetch: async (url, init) => {
      requests.push({ url, init });
      return response(200, {
        ok: true,
        contractVersion: "remote-managed-workspace-central-contract-v1",
        contractOwner: "home-ai-central",
        contractRef: "docs/PLATFORM_CONTRACTS/remote-managed-workspace-contract.md",
        controlSurface: "remote-managed-workspace-control",
        controlAuthMode: "scoped-control",
        workspaces: [{
          workspaceId: "rmw_127",
          label: "127 Fixture",
          trusted: true,
          pairingStatus: "paired",
          status: "active",
          session: { fresh: true, lastSeenAt: "2026-07-09T00:00:00.000Z" },
          counts: { queuedTaskCardCount: 2, activeTaskCardCount: 1, terminalTaskCardCount: 3 },
          issueCodes: ["none"],
          secretToken: "should-not-appear",
        }],
      });
    },
  });

  const result = await client.listWorkspaces({
    centralUrl: "http://127.0.0.1:1234",
    controlToken: "rmw_control_secret",
  });

  assert.equal(result.count, 1);
  assert.equal(result.workspaces[0].workspaceId, "rmw_127");
  assert.equal(result.workspaces[0].paired, true);
  assert.equal(result.workspaces[0].connected, true);
  assert.equal(result.workspaces[0].queuedCount, 2);
  assert.equal(result.workspaces[0].activeCount, 1);
  assert.equal(result.workspaces[0].terminalCount, 3);
  assert.equal(result.contract.contractOwner, "home-ai-central");
  assert.equal(requests[0].init.headers.authorization, "Bearer rmw_control_secret");
  assert.doesNotMatch(JSON.stringify(result), /rmw_control_secret|should-not-appear/i);
});

test("RMW control public workspace mapper keeps count aliases compatible", () => {
  const workspace = publicWorkspace({
    workspaceId: "rmw_counts",
    label: "Counts",
    pairingStatus: "approved",
    counts: { queued: 4, activeCount: 2, completed: 7 },
  });

  assert.equal(workspace.paired, true);
  assert.equal(workspace.connected, false);
  assert.equal(workspace.queuedCount, 4);
  assert.equal(workspace.activeCount, 2);
  assert.equal(workspace.terminalCount, 7);
});

test("RMW control client dispatch and readback hide raw task and return bodies", async () => {
  const client = createRemoteManagedWorkspaceControlClientService({
    fetch: async (url, init) => {
      if (init.method === "POST") {
        const body = JSON.parse(init.body);
        assert.equal(body.bodyMarkdown, "raw task body");
        assert.deepEqual(body.executionRequirements, {
          requiresCommandExecution: true,
          minimumCompletedCommandCount: 1,
          requiredCommandClasses: ["workspace_read"],
          toolSurfaceRequired: true,
        });
        return response(200, {
          ok: true,
          duplicate: true,
          card: {
            taskCardId: "ttc_127",
            status: "queued",
            idempotencyKey: body.idempotencyKey,
            bodyMarkdown: "raw task body",
            executionRequirements: body.executionRequirements,
          },
        });
      }
      return response(200, {
        ok: true,
        card: {
          taskCardId: "ttc_127",
          status: "returned",
          terminalStatus: "completed",
          summary: "bounded task summary",
          bodyMarkdown: "raw task body",
          terminalReturn: {
            status: "completed",
            summary: "bounded terminal summary",
            bodyMarkdown: "raw return body",
            logs: "raw logs",
          },
          executionRequirements: {
            requiresCommandExecution: true,
            minimumCompletedCommandCount: 1,
            requiredCommandClasses: ["workspace_read"],
            toolSurfaceRequired: true,
          },
        },
      });
    },
  });
  const config = { centralUrl: "http://127.0.0.1:1234", controlToken: "rmw_control_secret" };
  const dispatched = await client.dispatchTaskCard(config, {
    workspaceId: "rmw_127",
    title: "Dispatch",
    bodyMarkdown: "raw task body",
    idempotencyKey: "idem-127",
    executionRequirements: {
      requiresCommandExecution: true,
      minimumCompletedCommandCount: 1,
      requiredCommandClasses: ["workspace_read"],
      toolSurfaceRequired: true,
    },
  });
  const read = await client.readTaskCard(config, {
    workspaceId: "rmw_127",
    taskCardId: dispatched.taskCardId,
  });

  assert.equal(dispatched.taskCardId, "ttc_127");
  assert.equal(dispatched.duplicate, true);
  assert.equal(read.card.terminalStatus, "completed");
  assert.equal(read.card.terminalSummary, "bounded terminal summary");
  assert.equal(read.card.executionRequirements.requiresCommandExecution, true);
  assert.deepEqual(read.card.executionRequirements.requiredCommandClasses, ["workspace_read"]);
  assert.doesNotMatch(JSON.stringify({ dispatched, read }), /raw task body|raw return body|raw logs|rmw_control_secret/i);
});

test("RMW control public mappers do not pass through unsafe fields", () => {
  const workspace = publicWorkspace({
    workspaceId: "rmw_safe",
    label: "Safe",
    trusted: true,
    paired: true,
    connected: true,
    queuedCount: 1,
    accessToken: "secret-token",
  });
  const card = publicTaskCard({
    taskCardId: "ttc_safe",
    status: "returned",
    bodyMarkdown: "raw task body",
    terminalReturn: { status: "completed", summary: "done", bodyMarkdown: "raw return body" },
  });

  assert.equal(workspace.workspaceId, "rmw_safe");
  assert.equal(card.terminalSummary, "done");
  assert.doesNotMatch(JSON.stringify({ workspace, card }), /secret-token|raw task body|raw return body/i);
});

test("RMW control bootstrap creates one pairing request, stores one-time credential, and restarts without exposing token", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rmw-control-bootstrap-"));
  const stateFile = path.join(dir, "state.json");
  const credentialFile = path.join(dir, "credential");
  let requestCount = 0;
  let pollCount = 0;
  let approved = false;
  const scopedToken = "rmw_control_scoped_secret";
  const seenBodies = [];
  const fetchImpl = async (url, init = {}) => {
    const parsed = new URL(url);
    if (init.method === "POST" && parsed.pathname === "/api/remote-managed-workspace-control/client-pairing-requests") {
      requestCount += 1;
      seenBodies.push(JSON.parse(init.body));
      return response(202, {
        ok: true,
        pairingRequest: {
          requestId: "cpr_1",
          status: "pending_approval",
          clientId: seenBodies[0].clientId,
          clientKind: "local_codex_mobile_dev",
          localWorkspaceId: seenBodies[0].localWorkspaceId,
        },
      });
    }
    if (init.method === "GET" && parsed.pathname === "/api/remote-managed-workspace-control/client-pairing-requests/cpr_1") {
      pollCount += 1;
      assert.equal(parsed.searchParams.get("clientId"), seenBodies[0].clientId);
      assert.equal(parsed.searchParams.get("installId"), seenBodies[0].installId);
      assert.equal(parsed.searchParams.get("deviceId"), seenBodies[0].deviceId);
      assert.equal(parsed.searchParams.get("localWorkspaceId"), seenBodies[0].localWorkspaceId);
      return response(approved ? 200 : 202, {
        ok: true,
        pairingRequest: {
          requestId: "cpr_1",
          status: approved ? "paired" : "pending_approval",
          clientId: seenBodies[0].clientId,
          clientKind: "local_codex_mobile_dev",
          localWorkspaceId: seenBodies[0].localWorkspaceId,
          approvedScopes: ["list", "dispatch", "read"],
          controlCredential: approved ? { token: scopedToken } : undefined,
        },
      });
    }
    throw new Error(`unexpected_request:${init.method}:${parsed.pathname}`);
  };
  const bootstrap = createRemoteManagedWorkspaceControlBootstrapService({
    centralUrl: "http://127.0.0.1:8797",
    credentialFile,
    fetch: fetchImpl,
    stateFile,
  });

  const pending = await bootstrap.ensureControlCredential();
  assert.equal(pending.ok, false);
  assert.equal(pending.status.skipped, "control_pairing_pending_approval");
  assert.equal(pending.status.pairingRequest.requestId, "cpr_1");
  assert.equal(requestCount, 1);
  assert.equal(fs.existsSync(credentialFile), false);
  assert.doesNotMatch(JSON.stringify(pending.status), /rmw_control_scoped_secret|Bearer/i);

  const stillPending = await bootstrap.ensureControlCredential();
  assert.equal(stillPending.ok, false);
  assert.equal(requestCount, 1);
  assert.equal(pollCount, 1);

  approved = true;
  const paired = await bootstrap.ensureControlCredential();
  assert.equal(paired.ok, true);
  assert.equal(paired.controlToken, scopedToken);
  assert.equal(requestCount, 1);
  assert.equal(fs.readFileSync(credentialFile, "utf8").trim(), scopedToken);
  assert.doesNotMatch(JSON.stringify(paired.status), /rmw_control_scoped_secret|Bearer/i);

  const restarted = createRemoteManagedWorkspaceControlBootstrapService({
    centralUrl: "http://127.0.0.1:8797",
    credentialFile,
    fetch: fetchImpl,
    stateFile,
  });
  const readyAfterRestart = await restarted.ensureControlCredential();
  assert.equal(readyAfterRestart.ok, true);
  assert.equal(readyAfterRestart.controlToken, scopedToken);
  assert.equal(requestCount, 1);
  assert.equal(pollCount, 2);
});

test("RMW control bootstrap preserves rejected pairing fail-closed without replacement request", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rmw-control-rejected-"));
  const stateFile = path.join(dir, "state.json");
  const credentialFile = path.join(dir, "credential");
  let requestCount = 0;
  let pollCount = 0;
  const fetchImpl = async (url, init = {}) => {
    const parsed = new URL(url);
    if (init.method === "POST" && parsed.pathname === "/api/remote-managed-workspace-control/client-pairing-requests") {
      requestCount += 1;
      return response(202, {
        ok: true,
        pairingRequest: {
          requestId: "cpr_rejected",
          status: "pending_approval",
        },
      });
    }
    if (init.method === "GET" && parsed.pathname === "/api/remote-managed-workspace-control/client-pairing-requests/cpr_rejected") {
      pollCount += 1;
      return response(200, {
        ok: true,
        pairingRequest: {
          requestId: "cpr_rejected",
          status: "rejected",
        },
      });
    }
    throw new Error(`unexpected_request:${init.method}:${parsed.pathname}`);
  };
  const bootstrap = createRemoteManagedWorkspaceControlBootstrapService({
    centralUrl: "http://127.0.0.1:8797",
    credentialFile,
    fetch: fetchImpl,
    stateFile,
  });

  assert.equal((await bootstrap.ensureControlCredential()).status.skipped, "control_pairing_pending_approval");
  const rejected = await bootstrap.ensureControlCredential();
  assert.equal(rejected.ok, false);
  assert.equal(rejected.status.skipped, "control_pairing_rejected");
  const stillRejected = await bootstrap.ensureControlCredential();
  assert.equal(stillRejected.status.skipped, "control_pairing_rejected");
  assert.equal(requestCount, 1);
  assert.equal(pollCount, 1);
  assert.equal(fs.existsSync(credentialFile), false);
});
