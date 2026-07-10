"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  createRemoteManagedWorkspaceNodeClientService,
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
