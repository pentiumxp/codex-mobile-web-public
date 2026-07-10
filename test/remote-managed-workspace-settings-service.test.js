"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  createRemoteManagedWorkspaceSettingsService,
} = require("../services/remote-managed-workspaces/remote-managed-workspace-settings-service");

function makeTempService() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rmw-settings-"));
  const projectRoot = path.join(root, "project");
  fs.mkdirSync(projectRoot, { recursive: true });
  const service = createRemoteManagedWorkspaceSettingsService({
    fs,
    path,
    settingsFile: path.join(root, "settings.json"),
    stateFile: path.join(root, "state.json"),
    enrollmentTokenFile: path.join(root, "secret", "enrollment-token"),
    now: () => new Date("2026-07-08T00:00:00.000Z"),
  });
  return { root, projectRoot, service };
}

function makeMemoryFs(existingDirs = new Set()) {
  const files = new Map();
  return {
    files,
    mkdirSync() {},
    chmodSync() {},
    readFileSync(file) {
      if (!files.has(file)) throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      return files.get(file);
    },
    writeFileSync(file, value) {
      files.set(file, String(value));
    },
    renameSync(from, to) {
      if (!files.has(from)) throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      files.set(to, files.get(from));
      files.delete(from);
    },
    rmSync(file) {
      files.delete(file);
    },
    statSync(file) {
      if (!existingDirs.has(file)) throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      return { isDirectory: () => true };
    },
  };
}

test("remote managed workspace settings persist masked readback and separate token secret", () => {
  const { root, projectRoot, service } = makeTempService();
  try {
    const saved = service.saveSettings({
      enabled: true,
      workspaceKind: "remote_managed_workspace",
      workspaceId: "rmw_test",
      nodeName: "node-a",
      centralUrl: "https://home-ai.example.test/control",
      projectRoot,
      allowedRoot: root,
      projectType: "vite_game",
      enrollmentToken: "rmw-secret-token",
      enrollmentTokenRef: "macos-keychain:codex-mobile/rmw",
      connectionMode: "persistent",
      roles: ["external_project_main", "external_project_worker", "external_project_audit", "external_project_deploy"],
      capabilities: ["task-card-poll", "task-card-return"],
    });

    assert.equal(saved.enabled, true);
    assert.equal(saved.workspaceKind, "remote_managed_workspace");
    assert.equal(saved.projectType, "vite_game");
    assert.equal(saved.scopedCredentialConfigured, true);
    assert.equal(saved.enrollmentTokenConfigured, true);
    assert.equal(saved.enrollmentTokenPreview, "********");
    assert.equal(saved.effectiveConnectionMode, "http_polling");
    assert.equal(saved.reasoningFloorByRole.external_project_main, "xhigh");
    assert.doesNotMatch(JSON.stringify(saved), /rmw-secret-token/);

    const state = service.updateConnectionState({
      activeTaskCardId: "ttc_active",
      activeLocalThreadId: "local-thread-active",
      activeLocalTurnId: "local-turn-active",
      activeTaskCardStartedAt: "2026-07-08T00:00:00.000Z",
      lastTaskCardId: "ttc_last",
      lastLocalThreadId: "local-thread-last",
      lastLocalTurnId: "local-turn-last",
      lastExecutionBridgeStatus: "codex_mobile_local_runtime",
      lastExecutionAuthority: {
        configured: true,
        source: "remote_managed_workspace",
        version: "task-card-execution-authority-v1",
        taskCardId: "ttc_last",
        workflowId: "rmw:rmw_test:ttc_last",
        targetThreadId: "local-thread-last",
        targetWorkspaceId: "rmw_test",
        scopeClasses: ["workspace_read", "localhost_health_probe"],
        networkScope: ["localhost"],
        expiresAtPresent: true,
        approvalResolution: { status: "configured" },
        rawAuthorityToken: "must-not-leak",
      },
    });
    const publicStatus = service.publicSettings(undefined, state);
    assert.equal(publicStatus.activeTaskCardId, "ttc_active");
    assert.equal(publicStatus.activeLocalThreadId, "local-thread-active");
    assert.equal(publicStatus.activeLocalTurnId, "local-turn-active");
    assert.equal(publicStatus.lastLocalThreadId, "local-thread-last");
    assert.equal(publicStatus.lastLocalTurnId, "local-turn-last");
    assert.equal(publicStatus.lastExecutionBridgeStatus, "codex_mobile_local_runtime");
    assert.equal(publicStatus.lastExecutionAuthority.configured, true);
    assert.equal(publicStatus.lastExecutionAuthority.source, "remote_managed_workspace");
    assert.deepEqual(publicStatus.lastExecutionAuthority.networkScope, ["localhost"]);
    assert.doesNotMatch(JSON.stringify(publicStatus), /rmw-secret-token|must-not-leak/);

    const settingsFile = JSON.stringify(JSON.parse(fs.readFileSync(path.join(root, "settings.json"), "utf8")));
    assert.doesNotMatch(settingsFile, /rmw-secret-token/);
    assert.match(fs.readFileSync(path.join(root, "secret", "enrollment-token"), "utf8"), /rmw-secret-token/);

    const clientConfig = service.configForClient({ requireEnabled: true, requireToken: true });
    assert.equal(clientConfig.enrollmentToken, "rmw-secret-token");
    assert.equal(clientConfig.projectRoot, projectRoot);
    assert.deepEqual(clientConfig.allowedRoots, [root]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("remote managed workspace settings reject invalid central URL and outside project roots", () => {
  const { root, projectRoot, service } = makeTempService();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "rmw-outside-"));
  try {
    assert.throws(() => service.saveSettings({
      enabled: true,
      workspaceId: "rmw_test",
      nodeName: "node-a",
      centralUrl: "ftp://home-ai.example.test",
      projectRoot,
      allowedRoot: root,
      enrollmentToken: "token",
    }), /central_url_must_use_http_or_https/);

    assert.throws(() => service.saveSettings({
      enabled: true,
      workspaceId: "rmw_test",
      nodeName: "node-a",
      centralUrl: "http://127.0.0.1:9999",
      projectRoot: outside,
      allowedRoot: root,
      enrollmentToken: "token",
    }), /project_root_outside_allowed_root/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test("remote managed workspace settings auto-generate remote node fields from workspace row", () => {
  const { root, projectRoot, service } = makeTempService();
  try {
    service.updateConnectionState({
      connectionStatus: "config_invalid",
      issueCode: "project_root_required",
    });
    const missingToken = service.enableWorkspace({
      centralUrl: "http://192.168.10.5:8787",
      workspace: {
        cwd: projectRoot,
        label: "Game Demo",
      },
    });
    assert.equal(missingToken.enabled, true);
    assert.equal(missingToken.centralUrl, "http://192.168.10.5:8787");
    assert.equal(missingToken.workspaceKind, "remote_managed_workspace");
    assert.match(missingToken.workspaceId, /^rmw_game-demo_[a-f0-9]{12}$/);
    assert.match(missingToken.nodeName, /^[a-z0-9._-]+_game-demo_[a-f0-9]{8}$/);
    assert.equal(missingToken.projectRoot, projectRoot);
    assert.equal(missingToken.allowedRoot, projectRoot);
    assert.equal(missingToken.projectType, "vite_game");
    assert.equal(missingToken.connectionMode, "persistent");
    assert.equal(missingToken.effectiveConnectionMode, "http_polling");
    assert.equal(missingToken.scopedCredentialConfigured, false);
    assert.equal(missingToken.enrollmentTokenConfigured, false);
    assert.equal(missingToken.pairingStatus, "unconfigured");
    assert.equal(missingToken.issueCodes.includes("enrollment_token_required"), false);
    assert.equal(missingToken.issueCodes.includes("project_root_required"), false);
    assert.doesNotMatch(JSON.stringify(missingToken), /generated-secret-token/);

    const savedToken = service.saveSettings({
      enabled: true,
      enrollmentToken: "later-secret-token",
    });
    assert.equal(savedToken.enrollmentTokenConfigured, true);
    assert.equal(savedToken.scopedCredentialConfigured, true);
    assert.equal(savedToken.pairingStatus, "approved");
    assert.equal(savedToken.issueCodes.includes("enrollment_token_required"), false);
    assert.doesNotMatch(JSON.stringify(savedToken), /later-secret-token/);

    const withToken = service.enableWorkspace({
      centralUrl: "https://home-ai.example.test",
      workspace: {
        cwd: projectRoot,
        label: "Game Demo",
      },
      enrollmentToken: "generated-secret-token",
    });
    assert.equal(withToken.enrollmentTokenConfigured, true);
    assert.equal(withToken.issueCodes.includes("enrollment_token_required"), false);
    assert.equal(withToken.enrollmentTokenPreview, "********");
    assert.doesNotMatch(JSON.stringify(withToken), /generated-secret-token/);

    const clientConfig = service.configForClient({ requireEnabled: true, requireToken: true });
    assert.equal(clientConfig.workspaceId, withToken.workspaceId);
    assert.equal(clientConfig.projectRoot, projectRoot);
    assert.equal(clientConfig.allowedRoots[0], projectRoot);
    assert.equal(clientConfig.enrollmentToken, "generated-secret-token");

    const disabled = service.disableWorkspace({ cwd: projectRoot });
    assert.equal(disabled.enabled, false);
    assert.equal(disabled.centralUrl, "https://home-ai.example.test");
    assert.equal(disabled.projectRoot, projectRoot);
    assert.doesNotMatch(JSON.stringify(disabled), /generated-secret-token/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("remote managed workspace settings persist central URL while disabled", () => {
  const { root, service } = makeTempService();
  try {
    const saved = service.saveSettings({
      centralUrl: "http://127.0.0.1:8797/",
    });

    assert.equal(saved.enabled, false);
    assert.equal(saved.centralUrl, "http://127.0.0.1:8797");
    assert.equal(saved.connectionStatus, "disconnected");
    assert.equal(service.publicSettings().centralUrl, "http://127.0.0.1:8797");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("remote managed workspace settings auto-generate Windows remote node fields from workspace row", () => {
  const windowsWorkspace = "C:\\Users\\codex\\Documents\\GMK-test";
  const memoryFs = makeMemoryFs(new Set([windowsWorkspace]));
  const service = createRemoteManagedWorkspaceSettingsService({
    fs: memoryFs,
    path: path.win32,
    settingsFile: "C:\\state\\rmw-settings.json",
    stateFile: "C:\\state\\rmw-state.json",
    enrollmentTokenFile: "C:\\state\\secret\\enrollment-token",
    now: () => new Date("2026-07-08T00:00:00.000Z"),
  });

  const status = service.enableWorkspace({
    centralUrl: "http://127.0.0.1:8797",
    workspace: {
      cwd: windowsWorkspace,
      label: "GMK-test",
    },
  });

  assert.equal(status.enabled, true);
  assert.equal(status.centralUrl, "http://127.0.0.1:8797");
  assert.equal(status.projectRoot, windowsWorkspace);
  assert.equal(status.allowedRoot, windowsWorkspace);
  assert.match(status.workspaceId, /^rmw_gmk-test_[a-f0-9]{12}$/);
  assert.match(status.nodeName, /^[a-z0-9._-]+_gmk-test_[a-f0-9]{8}$/);
  assert.equal(status.scopedCredentialConfigured, false);
  assert.equal(status.pairingStatus, "unconfigured");
  assert.equal(status.issueCodes.includes("enrollment_token_required"), false);
});

test("remote managed workspace settings consume pairing approval as write-only scoped credential", () => {
  const { root, projectRoot, service } = makeTempService();
  try {
    service.enableWorkspace({
      centralUrl: "http://127.0.0.1:8797",
      workspace: {
        cwd: projectRoot,
        label: "Approval Demo",
      },
    });
    const pairing = service.applyPairingResult({
      pairing: {
        requestId: "rmw_pair_test",
        status: "pending_approval",
      },
    });
    assert.equal(pairing.pairingStatus, "pending_approval");
    assert.equal(service.publicSettings().pairingRequestId, "rmw_pair_test");

    const approved = service.applyPairingResult({
      pairing: {
        requestId: "rmw_pair_test",
        status: "approved",
        scopedCredential: "scoped-node-credential",
      },
    });
    const publicStatus = service.publicSettings(undefined, approved);
    assert.equal(publicStatus.pairingStatus, "approved");
    assert.equal(publicStatus.scopedCredentialConfigured, true);
    assert.equal(publicStatus.scopedCredentialPreview, "********");
    assert.doesNotMatch(JSON.stringify(publicStatus), /scoped-node-credential/);
    assert.equal(service.configForClient({ requireEnabled: true, requireToken: true }).scopedCredential, "scoped-node-credential");

    const rejected = service.applyPairingResult({
      pairing: {
        requestId: "rmw_pair_rejected",
        status: "rejected",
        reason: "owner_rejected",
      },
    });
    assert.equal(rejected.pairingStatus, "rejected");
    assert.equal(service.publicSettings(undefined, rejected).pairingRejectionReason, "owner_rejected");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("remote managed workspace settings ignore external credential fallback after invalid scoped credential recovery", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rmw-settings-invalid-external-"));
  const projectRoot = path.join(root, "project");
  fs.mkdirSync(projectRoot, { recursive: true });
  const service = createRemoteManagedWorkspaceSettingsService({
    fs,
    path,
    settingsFile: path.join(root, "settings.json"),
    stateFile: path.join(root, "state.json"),
    enrollmentTokenFile: path.join(root, "secret", "scoped-credential"),
    env: { STALE_RMW_TOKEN: "stale-env-credential" },
    now: () => new Date("2026-07-08T00:00:00.000Z"),
  });
  try {
    service.saveSettings({
      enabled: true,
      workspaceKind: "remote_managed_workspace",
      workspaceId: "rmw_env_invalid",
      nodeName: "runner-node",
      centralUrl: "http://127.0.0.1:9999",
      projectRoot,
      allowedRoot: root,
      enrollmentTokenRef: "env:STALE_RMW_TOKEN",
    });
    assert.equal(service.publicSettings().scopedCredentialConfigured, true);
    assert.equal(service.configForClient({ requireEnabled: true, requireToken: true }).enrollmentToken, "stale-env-credential");

    service.clearScopedCredentialForRecovery({
      issueCode: "remote_managed_workspace_scoped_node_credential_invalid",
    });
    const recovered = service.publicSettings();
    assert.equal(recovered.scopedCredentialConfigured, false);
    assert.equal(recovered.pairingStatus, "unconfigured");
    assert.throws(
      () => service.configForClient({ requireEnabled: true, requireToken: true }),
      /scoped_node_credential_unavailable/,
    );

    service.applyPairingResult({
      pairing: {
        requestId: "rmw_pair_fresh",
        status: "approved",
        scopedCredential: "fresh-write-only-credential",
      },
    });
    assert.equal(service.publicSettings().scopedCredentialConfigured, true);
    assert.equal(service.configForClient({ requireEnabled: true, requireToken: true }).enrollmentToken, "fresh-write-only-credential");
    const ignored = service.clearScopedCredentialForRecovery({
      issueCode: "remote_managed_workspace_scoped_node_credential_invalid",
      failedCredential: "stale-env-credential",
    });
    assert.equal(ignored.staleCredentialFailureIgnored, true);
    assert.equal(service.configForClient({ requireEnabled: true, requireToken: true }).enrollmentToken, "fresh-write-only-credential");
    assert.doesNotMatch(JSON.stringify(service.publicSettings()), /stale-env-credential|fresh-write-only-credential/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("remote managed workspace settings ignore external credential fallback after pairing precondition recovery", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rmw-settings-pairing-precondition-"));
  const projectRoot = path.join(root, "project");
  fs.mkdirSync(projectRoot, { recursive: true });
  const service = createRemoteManagedWorkspaceSettingsService({
    fs,
    path,
    settingsFile: path.join(root, "settings.json"),
    stateFile: path.join(root, "state.json"),
    enrollmentTokenFile: path.join(root, "secret", "scoped-credential"),
    env: { STALE_RMW_TOKEN: "stale-env-credential" },
    now: () => new Date("2026-07-08T00:00:00.000Z"),
  });
  try {
    service.saveSettings({
      enabled: true,
      workspaceKind: "remote_managed_workspace",
      workspaceId: "rmw_env_pairing_precondition",
      nodeName: "runner-node",
      centralUrl: "http://127.0.0.1:9999",
      projectRoot,
      allowedRoot: root,
      enrollmentTokenRef: "env:STALE_RMW_TOKEN",
    });
    assert.equal(service.configForClient({ requireEnabled: true, requireToken: true }).enrollmentToken, "stale-env-credential");

    service.clearScopedCredentialForRecovery({
      issueCode: "remote_managed_workspace_pairing_approval_required",
      failedCredential: "stale-env-credential",
    });
    const recovered = service.publicSettings();
    assert.equal(recovered.scopedCredentialConfigured, false);
    assert.equal(recovered.pairingStatus, "unconfigured");
    assert.equal(recovered.issueCodes.includes("remote_managed_workspace_pairing_approval_required"), true);
    assert.throws(
      () => service.configForClient({ requireEnabled: true, requireToken: true }),
      /scoped_node_credential_unavailable/,
    );
    assert.doesNotMatch(JSON.stringify(recovered), /stale-env-credential/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
