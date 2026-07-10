"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  createRemoteManagedWorkspaceNodeClientService,
  normalizePolledTaskCardsPayload,
  normalizeRemoteManagedWorkspaceNodeErrorCode,
} = require("../services/remote-managed-workspaces/remote-managed-workspace-node-client-service");

function makeConfig(root) {
  const projectRoot = path.join(root, "project");
  fs.mkdirSync(projectRoot, { recursive: true });
  return {
    workspaceId: "rmw_node_client",
    workspaceKind: "remote_managed_workspace",
    projectType: "node",
    projectRoot,
    allowedRoots: [root],
    centralUrl: "http://127.0.0.1:8797",
    nodeName: "node-client-test",
    scopedCredential: "node-client-secret",
  };
}

function makeFetch(status, body) {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  });
}

async function assertRegisterError(body, expectedCode, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rmw-node-client-"));
  const client = createRemoteManagedWorkspaceNodeClientService({
    fs,
    path,
    fetch: makeFetch(options.status || 403, body),
  });
  try {
    await assert.rejects(
      () => client.register(makeConfig(root)),
      (err) => {
        assert.equal(err.code, expectedCode);
        assert.equal(err.statusCode, options.status || 403);
        assert.doesNotMatch(String(err.message), /node-client-secret|Bearer|<html>|login page/i);
        return true;
      },
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("RMW node client preserves canonical invalid scoped credential code", async () => {
  await assertRegisterError(
    JSON.stringify({ error: "remote_managed_workspace_scoped_node_credential_invalid" }),
    "remote_managed_workspace_scoped_node_credential_invalid",
    { status: 401 },
  );
});

test("RMW node client normalizes live invalid scoped credential alias", async () => {
  await assertRegisterError(
    JSON.stringify({ code: "remote_managed_workspace_scoped_node_credential_is_invalid" }),
    "remote_managed_workspace_scoped_node_credential_invalid",
  );
});

test("RMW node client prefers invalid scoped credential alias over preceding diagnostic issue codes", async () => {
  await assertRegisterError(
    JSON.stringify({
      issueCodes: [
        "remote_managed_workspace_pairing_must_be_approved_before_node_access",
        "remote_managed_workspace_scoped_node_credential_is_invalid",
        "remote_managed_workspace_response_not_json",
      ],
    }),
    "remote_managed_workspace_scoped_node_credential_invalid",
  );
});

test("RMW node client normalizes pairing approval required aliases and exact text", async () => {
  await assertRegisterError(
    JSON.stringify({ code: "remote_managed_workspace_pairing_must_be_approved_before_node_access" }),
    "remote_managed_workspace_pairing_approval_required",
  );
  await assertRegisterError(
    JSON.stringify({ error: "remote_managed_workspace_pairing_approval_required" }),
    "remote_managed_workspace_pairing_approval_required",
    { status: 401 },
  );
  await assertRegisterError(
    "Remote managed workspace pairing must be approved before node access",
    "remote_managed_workspace_pairing_approval_required",
    { status: 403 },
  );
});

test("RMW node client normalizes exact non-JSON invalid scoped credential message on auth status", async () => {
  await assertRegisterError(
    "Remote managed workspace scoped node credential is invalid",
    "remote_managed_workspace_scoped_node_credential_invalid",
    { status: 403 },
  );
});

test("RMW node client does not treat unrelated non-JSON auth response as invalid scoped credential", async () => {
  await assertRegisterError(
    "<html>login page</html>",
    "remote_managed_workspace_response_not_json",
    { status: 403 },
  );
});

test("RMW node client keeps exact invalid message bounded to auth status", async () => {
  await assertRegisterError(
    "Remote managed workspace scoped node credential is invalid",
    "remote_managed_workspace_response_not_json",
    { status: 500 },
  );
});

test("RMW node client error normalizer uses canonical code for recovery decisions", () => {
  assert.equal(
    normalizeRemoteManagedWorkspaceNodeErrorCode("remote_managed_workspace_scoped_node_credential_is_invalid"),
    "remote_managed_workspace_scoped_node_credential_invalid",
  );
  assert.equal(
    normalizeRemoteManagedWorkspaceNodeErrorCode("Remote managed workspace scoped node credential is invalid", { statusCode: 403, responseText: "other" }),
    "Remote managed workspace scoped node credential is invalid",
  );
  assert.equal(
    normalizeRemoteManagedWorkspaceNodeErrorCode("remote_managed_workspace_response_not_json", {
      statusCode: 403,
      responseText: "Remote managed workspace scoped node credential is invalid",
    }),
    "remote_managed_workspace_scoped_node_credential_invalid",
  );
});

test("RMW node client normalizes canonical poll taskCards", () => {
  const card = { taskCardId: "rmwtc_canonical", retryOfTaskCardId: "rmwtc_parent", title: "Canonical" };
  const normalized = normalizePolledTaskCardsPayload({
    ok: true,
    taskCards: [card],
    count: 1,
  });
  assert.equal(normalized.count, 1);
  assert.equal(normalized.taskCards[0].taskCardId, "rmwtc_canonical");
  assert.equal(normalized.taskCards[0].retryOfTaskCardId, "rmwtc_parent");
  assert.equal(normalized.cards[0].taskCardId, "rmwtc_canonical");
});

test("RMW node client preserves legacy poll cards compatibility", () => {
  const card = { id: "rmwtc_legacy", retry_of_task_card_id: "rmwtc_parent_legacy", title: "Legacy" };
  const normalized = normalizePolledTaskCardsPayload({
    ok: true,
    cards: [card],
    count: 1,
  });
  assert.deepEqual(normalized.taskCards.map((entry) => entry.taskCardId), ["rmwtc_legacy"]);
  assert.deepEqual(normalized.cards.map((entry) => entry.taskCardId), ["rmwtc_legacy"]);
  assert.equal(normalized.taskCards[0].id, "rmwtc_legacy");
  assert.equal(normalized.taskCards[0].retryOfTaskCardId, "rmwtc_parent_legacy");
  assert.equal(normalized.taskCards[0].retry_of_task_card_id, undefined);
});

test("RMW node client de-duplicates canonical and legacy poll fields by task-card id", () => {
  const normalized = normalizePolledTaskCardsPayload({
    ok: true,
    taskCards: [{ taskCardId: "rmwtc_same", title: "Canonical" }],
    cards: [{ taskCardId: "rmwtc_same", title: "Legacy alias" }],
    count: 1,
  });
  assert.equal(normalized.taskCards.length, 1);
  assert.equal(normalized.cards.length, 1);
  assert.equal(normalized.taskCards[0].title, "Canonical");
});

test("RMW node client fails closed on malformed poll payloads", () => {
  assert.throws(
    () => normalizePolledTaskCardsPayload({ ok: true, taskCards: { taskCardId: "bad" }, count: 1 }),
    /remote_managed_workspace_poll_task_cards_invalid/,
  );
  assert.throws(
    () => normalizePolledTaskCardsPayload({ ok: true, taskCards: [{}], count: 1 }),
    /remote_managed_workspace_poll_task_card_id_missing/,
  );
  assert.throws(
    () => normalizePolledTaskCardsPayload({ ok: true, taskCards: [{ taskCardId: "rmwtc_one" }], count: 2 }),
    /remote_managed_workspace_poll_count_mismatch/,
  );
  assert.throws(
    () => normalizePolledTaskCardsPayload({ ok: true, taskCards: [{ taskCardId: "rmwtc_one", retryOfTaskCardId: "x".repeat(181) }], count: 1 }),
    /remote_managed_workspace_poll_retry_of_task_card_id_too_long/,
  );
});
