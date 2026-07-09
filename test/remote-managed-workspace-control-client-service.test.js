"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
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
          pairingStatus: "approved",
          status: "active",
          session: { fresh: true, lastSeenAt: "2026-07-09T00:00:00.000Z" },
          counts: { queued: 2, active: 1, terminal: 3 },
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

test("RMW control client dispatch and readback hide raw task and return bodies", async () => {
  const client = createRemoteManagedWorkspaceControlClientService({
    fetch: async (url, init) => {
      if (init.method === "POST") {
        const body = JSON.parse(init.body);
        assert.equal(body.bodyMarkdown, "raw task body");
        return response(200, {
          ok: true,
          duplicate: true,
          card: {
            taskCardId: "ttc_127",
            status: "queued",
            idempotencyKey: body.idempotencyKey,
            bodyMarkdown: "raw task body",
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
  });
  const read = await client.readTaskCard(config, {
    workspaceId: "rmw_127",
    taskCardId: dispatched.taskCardId,
  });

  assert.equal(dispatched.taskCardId, "ttc_127");
  assert.equal(dispatched.duplicate, true);
  assert.equal(read.card.terminalStatus, "completed");
  assert.equal(read.card.terminalSummary, "bounded terminal summary");
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
