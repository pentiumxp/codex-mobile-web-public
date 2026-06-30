"use strict";

const defaultPath = require("node:path");

function normalizeEnumValue(value, allowed) {
  const text = String(value || "").trim();
  return allowed.has(text) ? text : "";
}

function normalizePermissionModeValueWithOptions(value, permissionModeOptions = []) {
  const text = String(value || "").trim().toLowerCase();
  const aliases = {
    "full-access": "full",
    "workspace-write": "auto",
    "read-only": "auto",
    "auto-review": "auto",
    "auto-reviewing": "auto",
    config: "custom",
    "config.toml": "custom",
    "custom-config": "custom",
  };
  const normalized = aliases[text] || text;
  return permissionModeOptions.includes(normalized) ? normalized : "";
}

function normalizeSandboxPolicyType(type) {
  const text = String(type || "").trim();
  return {
    "danger-full-access": "dangerFullAccess",
    dangerFullAccess: "dangerFullAccess",
    disabled: "dangerFullAccess",
    "no-sandbox": "dangerFullAccess",
    "read-only": "readOnly",
    readOnly: "readOnly",
    "workspace-write": "workspaceWrite",
    workspaceWrite: "workspaceWrite",
    "external-sandbox": "externalSandbox",
    externalSandbox: "externalSandbox",
  }[text] || "";
}

function parseJsonObject(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (_) {
    return null;
  }
}

function sandboxModeFromPolicy(policy) {
  const type = normalizeSandboxPolicyType(policy && policy.type);
  return {
    dangerFullAccess: "danger-full-access",
    readOnly: "read-only",
    workspaceWrite: "workspace-write",
  }[type] || "";
}

function normalizeSandboxPolicy(value) {
  const policy = parseJsonObject(value);
  if (!policy) return null;
  const type = normalizeSandboxPolicyType(policy.type);
  if (type === "dangerFullAccess") return { type };
  if (type === "readOnly") {
    return {
      type,
      networkAccess: Boolean(policy.networkAccess ?? policy.network_access),
    };
  }
  if (type === "externalSandbox") {
    return {
      type,
      networkAccess: policy.networkAccess || policy.network_access || "restricted",
    };
  }
  if (type === "workspaceWrite") {
    return {
      type,
      writableRoots: Array.isArray(policy.writableRoots) ? policy.writableRoots : (Array.isArray(policy.writable_roots) ? policy.writable_roots : []),
      networkAccess: Boolean(policy.networkAccess ?? policy.network_access),
      excludeTmpdirEnvVar: Boolean(policy.excludeTmpdirEnvVar ?? policy.exclude_tmpdir_env_var),
      excludeSlashTmp: Boolean(policy.excludeSlashTmp ?? policy.exclude_slash_tmp),
    };
  }
  return null;
}

function normalizePermissionProfile(value) {
  const profile = parseJsonObject(value);
  if (!profile) return null;
  const fileSystem = profile.fileSystem || profile.file_system || null;
  return {
    type: profile.type || profile.kind || null,
    network: profile.network || null,
    fileSystem: fileSystem ? {
      type: fileSystem.type || null,
      entries: Array.isArray(fileSystem.entries) ? fileSystem.entries : [],
      ...(fileSystem.globScanMaxDepth || fileSystem.glob_scan_max_depth
        ? { globScanMaxDepth: fileSystem.globScanMaxDepth || fileSystem.glob_scan_max_depth }
        : {}),
    } : null,
  };
}

function isRootWritePermissionProfile(profile) {
  const entries = profile
    && profile.fileSystem
    && Array.isArray(profile.fileSystem.entries)
    ? profile.fileSystem.entries
    : [];
  return entries.some((entry) => {
    const pathValue = entry && entry.path;
    return entry
      && entry.access === "write"
      && pathValue
      && pathValue.type === "special"
      && pathValue.value
      && pathValue.value.kind === "root";
  });
}

function isFullAccessRuntime(sandboxPolicy, permissionProfile) {
  return normalizeSandboxPolicyType(sandboxPolicy && sandboxPolicy.type) === "dangerFullAccess"
    || isRootWritePermissionProfile(permissionProfile);
}

function workspaceWriteSandboxPolicy(cwd, inheritedPolicy) {
  const inherited = normalizeSandboxPolicyType(inheritedPolicy && inheritedPolicy.type) === "workspaceWrite"
    ? inheritedPolicy
    : {};
  const writableRoots = [];
  const workspace = String(cwd || "").trim();
  if (workspace) writableRoots.push(workspace);
  for (const root of Array.isArray(inherited.writableRoots) ? inherited.writableRoots : []) {
    const text = String(root || "").trim();
    if (text && !writableRoots.includes(text)) writableRoots.push(text);
  }
  return {
    type: "workspaceWrite",
    writableRoots,
    networkAccess: Boolean(inherited.networkAccess),
    excludeTmpdirEnvVar: Boolean(inherited.excludeTmpdirEnvVar),
    excludeSlashTmp: Boolean(inherited.excludeSlashTmp),
  };
}

function readOnlySandboxPolicy(inheritedPolicy) {
  const inherited = normalizeSandboxPolicyType(inheritedPolicy && inheritedPolicy.type) === "readOnly"
    ? inheritedPolicy
    : {};
  return {
    type: "readOnly",
    networkAccess: Boolean(inherited.networkAccess),
  };
}

function createRuntimePermissionPolicyService(dependencies = {}) {
  const path = dependencies.path || defaultPath;
  const permissionModeOptions = Array.isArray(dependencies.permissionModeOptions) ? dependencies.permissionModeOptions : [];
  const codexConfigDefaults = dependencies.codexConfigDefaults || {};

  function normalizePermissionModeValue(value) {
    return normalizePermissionModeValueWithOptions(value, permissionModeOptions);
  }

  function permissionModeFromRuntimeSettings(settings) {
    if (!settings) return "";
    const sandboxType = normalizeSandboxPolicyType(settings.sandboxPolicy && settings.sandboxPolicy.type);
    if (sandboxType === "dangerFullAccess" || isRootWritePermissionProfile(settings.permissionProfile)) return "full";
    if (sandboxType === "externalSandbox" || settings.permissionProfile) return "custom";
    if (sandboxType === "workspaceWrite" || sandboxType === "readOnly") return "auto";
    return "default";
  }

  function defaultPermissionModeFromConfigDefaults() {
    const sandboxType = normalizeSandboxPolicyType(codexConfigDefaults.sandboxMode);
    if (sandboxType === "dangerFullAccess") return "full";
    if (sandboxType === "workspaceWrite" || sandboxType === "readOnly") return "auto";
    return "default";
  }

  function publicRuntimeSettings(settings) {
    if (!settings) return null;
    const sandboxType = normalizeSandboxPolicyType(settings.sandboxPolicy && settings.sandboxPolicy.type);
    return Object.fromEntries(Object.entries({
      permissionMode: permissionModeFromRuntimeSettings(settings),
      approvalPolicy: settings.approvalPolicy || null,
      sandboxPolicyType: sandboxType || null,
      reasoningSummary: settings.reasoningSummary || null,
      modelVerbosity: settings.modelVerbosity || null,
    }).filter(([, value]) => value != null && value !== ""));
  }

  function workspaceDelegationWriteGuardPermissionProfile(cwd, inheritedPolicy) {
    const workspace = String(cwd || "").trim();
    const policy = workspaceWriteSandboxPolicy(workspace, inheritedPolicy);
    const entries = [
      {
        path: { type: "special", value: { kind: "root" } },
        access: "read",
      },
    ];
    for (const root of policy.writableRoots || []) {
      if (!root) continue;
      entries.push({
        path: { type: "path", path: root },
        access: "read",
      });
      entries.push({
        path: { type: "path", path: root },
        access: "write",
      });
      entries.push({
        path: { type: "path", path: path.join(root, ".agents") },
        access: "read",
      });
      entries.push({
        path: { type: "path", path: path.join(root, ".codex") },
        access: "read",
      });
      entries.push({
        path: { type: "path", path: path.join(root, ".git") },
        access: "read",
      });
      entries.push({
        path: { type: "path", path: path.join(root, ".git") },
        access: "write",
      });
    }
    if (!policy.excludeSlashTmp) {
      entries.push({
        path: { type: "special", value: { kind: "slash_tmp" } },
        access: "write",
      });
    }
    if (!policy.excludeTmpdirEnvVar) {
      entries.push({
        path: { type: "special", value: { kind: "tmpdir" } },
        access: "write",
      });
    }
    return {
      type: "managed",
      fileSystem: {
        type: "restricted",
        entries,
      },
      network: policy.networkAccess ? "enabled" : "restricted",
    };
  }

  function applyPermissionModeOverride(settings, mode, cwd) {
    const normalized = normalizePermissionModeValue(mode);
    if (!normalized) return settings;
    const next = Object.assign({}, settings || {});
    if (normalized === "default") {
      if (!cwd) return next;
      next.approvalPolicy = "on-request";
      next.sandboxPolicy = workspaceWriteSandboxPolicy(cwd, next.sandboxPolicy);
      next.sandboxMode = "workspace-write";
      next.permissionProfile = null;
      return next;
    }
    if (normalized === "auto") {
      if (!cwd) return next;
      next.approvalPolicy = "on-request";
      next.sandboxPolicy = workspaceWriteSandboxPolicy(cwd, next.sandboxPolicy);
      next.sandboxMode = "workspace-write";
      next.permissionProfile = null;
      return next;
    }
    if (normalized === "full") {
      next.approvalPolicy = "never";
      next.sandboxPolicy = { type: "dangerFullAccess" };
      next.sandboxMode = "danger-full-access";
      next.permissionProfile = null;
      return next;
    }
    if (normalized === "custom") {
      const sandboxType = normalizeSandboxPolicyType(codexConfigDefaults.sandboxMode);
      const approvalPolicy = normalizeEnumValue(
        codexConfigDefaults.approvalPolicy,
        new Set(["untrusted", "on-request", "on-failure", "never"]),
      );
      if (sandboxType === "dangerFullAccess") {
        next.approvalPolicy = approvalPolicy || "never";
        next.sandboxPolicy = { type: "dangerFullAccess" };
        next.sandboxMode = "danger-full-access";
        next.permissionProfile = null;
      } else if (sandboxType === "readOnly") {
        next.approvalPolicy = approvalPolicy || "on-request";
        next.sandboxPolicy = readOnlySandboxPolicy(next.sandboxPolicy);
        next.sandboxMode = "read-only";
        next.permissionProfile = null;
      } else if (sandboxType === "workspaceWrite") {
        next.approvalPolicy = approvalPolicy || "on-request";
        next.sandboxPolicy = workspaceWriteSandboxPolicy(cwd, next.sandboxPolicy);
        next.sandboxMode = "workspace-write";
        next.permissionProfile = null;
      }
      return next;
    }
    return settings;
  }

  return {
    applyPermissionModeOverride,
    defaultPermissionModeFromConfigDefaults,
    isFullAccessRuntime,
    isRootWritePermissionProfile,
    normalizeEnumValue,
    normalizePermissionModeValue,
    normalizePermissionProfile,
    normalizeSandboxPolicy,
    normalizeSandboxPolicyType,
    permissionModeFromRuntimeSettings,
    publicRuntimeSettings,
    readOnlySandboxPolicy,
    sandboxModeFromPolicy,
    workspaceDelegationWriteGuardPermissionProfile,
    workspaceWriteSandboxPolicy,
  };
}

module.exports = {
  createRuntimePermissionPolicyService,
  isFullAccessRuntime,
  isRootWritePermissionProfile,
  normalizeEnumValue,
  normalizePermissionModeValueWithOptions,
  normalizePermissionProfile,
  normalizeSandboxPolicy,
  normalizeSandboxPolicyType,
  readOnlySandboxPolicy,
  sandboxModeFromPolicy,
  workspaceWriteSandboxPolicy,
};
