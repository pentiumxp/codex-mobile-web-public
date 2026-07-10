"use strict";

const path = require("node:path");

function createRuntimeWorkspaceBootstrapService(options = {}) {
  const {
    appRoot = process.cwd(),
    activeCodexHome = "",
    authKeyFile = "",
    port = 8787,
    runtimeRoot = "",
    env = process.env,
    processExecPath = process.execPath,
    workspaceRegistryService,
    codexProfileService,
    ensureCodexProjectsTrusted,
    ensureCodexMobileMcpServer,
    logger = console,
  } = options;

  function syncRegisteredWorkspaceTrust(codexHome = activeCodexHome) {
    try {
      const result = ensureCodexProjectsTrusted({
        codexHome,
        projectPaths: workspaceRegistryService.registeredPaths(),
      });
      if (result.changed) {
        logger.log(`[workspace-trust] added ${result.added.length} registered workspace(s) to ${result.configPath}`);
      }
      return result;
    } catch (err) {
      logger.error(`[workspace-trust] failed to sync registered workspaces: ${err.message || err}`);
      return { changed: false, added: [], error: err.message || String(err) };
    }
  }

  function syncCodexMobileMcpToolset(codexHome = activeCodexHome) {
    try {
      const result = ensureCodexMobileMcpServer({
        codexHome,
        command: processExecPath,
        scriptPath: path.join(appRoot, "scripts", "codex-mobile-mcp-server.js"),
        baseUrl: env.CODEX_MOBILE_MCP_SERVER_URL || `http://127.0.0.1:${port}`,
        keyFile: authKeyFile,
        rmwControlUrl: env.CODEX_MOBILE_RMW_CONTROL_URL || env.HOME_AI_RMW_CONTROL_URL || "http://127.0.0.1:8797",
        rmwControlCredentialFile: env.CODEX_MOBILE_RMW_CONTROL_CREDENTIAL_FILE
          || env.CODEX_MOBILE_RMW_CONTROL_TOKEN_FILE
          || env.HOME_AI_RMW_CONTROL_TOKEN_FILE
          || (runtimeRoot ? path.join(runtimeRoot, "rmw-control-credential") : ""),
        rmwControlStateFile: env.CODEX_MOBILE_RMW_CONTROL_STATE_FILE
          || (runtimeRoot ? path.join(runtimeRoot, "rmw-control-client-state.json") : ""),
      });
      if (result.changed) {
        logger.log(`[codex-mobile-mcp] registered ${result.serverName} in ${result.configPath}`);
      }
      return result;
    } catch (err) {
      logger.error(`[codex-mobile-mcp] failed to sync toolset: ${err.message || err}`);
      return { changed: false, added: false, error: err.message || String(err) };
    }
  }

  function syncKnownCodexMobileMcpToolsets(profileOptions = {}) {
    const homes = new Set([activeCodexHome]);
    let profileError = "";
    try {
      const profileState = profileOptions.profileState || codexProfileService.profiles(profileOptions);
      for (const profile of profileState.profiles || []) {
        const codexHome = String(profile && profile.codexHome || "").trim();
        if (!codexHome) continue;
        if (profile.exists || profile.active || codexHome === activeCodexHome) homes.add(codexHome);
      }
    } catch (err) {
      profileError = err && err.message || String(err);
      logger.error(`[codex-mobile-mcp] failed to enumerate known profiles: ${profileError}`);
    }
    const results = [];
    for (const codexHome of homes) {
      results.push(syncCodexMobileMcpToolset(codexHome));
    }
    return {
      changed: results.some((item) => item && item.changed),
      count: results.length,
      results,
      profileError,
    };
  }

  function ensureWorkspaceVisibleForContinuation(cwd) {
    const registered = workspaceRegistryService.registerExisting({ cwd });
    syncRegisteredWorkspaceTrust(activeCodexHome);
    syncKnownCodexMobileMcpToolsets();
    return registered;
  }

  function activeProfileRestartOptions(profile = null) {
    const selected = profile || codexProfileService.profiles().profiles.find((item) => item.active) || null;
    if (!selected || !selected.id || !selected.codexHome) return {};
    return {
      profileId: selected.id,
      codexHome: selected.codexHome,
    };
  }

  return {
    activeProfileRestartOptions,
    ensureWorkspaceVisibleForContinuation,
    syncCodexMobileMcpToolset,
    syncKnownCodexMobileMcpToolsets,
    syncRegisteredWorkspaceTrust,
  };
}

module.exports = {
  createRuntimeWorkspaceBootstrapService,
};
