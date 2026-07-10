"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const hostRestartScript = fs.readFileSync(path.join(root, "restart-codex-mobile-host-macos.sh"), "utf8");
const helperScript = fs.readFileSync(path.join(root, "scripts", "codex-mobile-macos-profile-helper.js"), "utf8");
const {
  listProfiles,
  selectProfile,
} = require("../scripts/codex-mobile-macos-profile-helper");

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-macos-host-restart-"));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

test("macOS host restart script is a LaunchDaemon recovery entrypoint", () => {
  assert.match(hostRestartScript, /SERVICE_LABEL="\$\{CODEX_MOBILE_LAUNCHD_LABEL:-com\.hermesmobile\.plugin\.codex-mobile\}"/);
  assert.match(hostRestartScript, /plist_get_root\(\)/);
  assert.match(hostRestartScript, /PLIST_USER_NAME="\$\(plist_get_root UserName\)"/);
  assert.match(hostRestartScript, /TARGET_USER_NAME="\$\{PLIST_USER_NAME:-\$\{USER:-\}\}"/);
  assert.match(hostRestartScript, /TARGET_USER_NAME="\$\(\/usr\/bin\/id -un\)"/);
  assert.match(hostRestartScript, /--list-homes/);
  assert.match(hostRestartScript, /--profile-id/);
  assert.match(hostRestartScript, /--codex-home/);
  assert.match(hostRestartScript, /--default-shell-mode/);
  assert.match(hostRestartScript, /--restart-mux/);
  assert.match(hostRestartScript, /codex-mobile-macos-profile-helper\.js/);
  assert.match(hostRestartScript, /plist_set_env CODEX_HOME "\$SELECTED_CODEX_HOME"/);
  assert.match(hostRestartScript, /SELECTED_MUX_ENDPOINT_FILE="\$\{SELECTED_CODEX_HOME\}\/app-server-mux\/endpoint\.json"/);
  assert.match(hostRestartScript, /plist_set_env CODEX_MOBILE_MUX_ENDPOINT_FILE "\$SELECTED_MUX_ENDPOINT_FILE"/);
  assert.match(hostRestartScript, /TASK_CARD_EXECUTION_WATCHDOG_INTERVAL_MS="1800000"/);
  assert.match(hostRestartScript, /TASK_CARD_EXECUTION_WATCHDOG_STALE_MS="1800000"/);
  assert.match(hostRestartScript, /TASK_CARD_EXECUTION_WATCHDOG_LIMIT="8"/);
  assert.match(hostRestartScript, /plist_set_env CODEX_MOBILE_TASK_CARD_EXECUTION_WATCHDOG_INTERVAL_MS "\$TASK_CARD_EXECUTION_WATCHDOG_INTERVAL_MS"/);
  assert.match(hostRestartScript, /plist_set_env CODEX_MOBILE_TASK_CARD_EXECUTION_WATCHDOG_STALE_MS "\$TASK_CARD_EXECUTION_WATCHDOG_STALE_MS"/);
  assert.match(hostRestartScript, /plist_set_env CODEX_MOBILE_TASK_CARD_EXECUTION_WATCHDOG_LIMIT "\$TASK_CARD_EXECUTION_WATCHDOG_LIMIT"/);
  assert.match(hostRestartScript, /plist_set_env CODEX_MOBILE_DEFAULT_SHELL "\$DEFAULT_SHELL_MODE"/);
  assert.match(hostRestartScript, /select_args\+=\(--no-write\)/);
  assert.match(hostRestartScript, /stop_selected_mux_endpoint\(\) \{/);
  assert.match(hostRestartScript, /RESTART_SELECTED_MUX=0/);
  assert.match(hostRestartScript, /RESTART_SELECTED_MUX=1/);
  assert.match(hostRestartScript, /listener_restart_preserves_independent_app_server/);
  assert.match(hostRestartScript, /SELECTED_MUX_STOP_JSON="\$\(stop_selected_mux_endpoint/);
  assert.match(hostRestartScript, /process\.kill\(pid, "SIGTERM"\)/);
  assert.match(hostRestartScript, /fs\.rmSync\(endpointFile, \{ force: true \}\)/);
  assert.match(hostRestartScript, /launchctl bootout "system\/\$\{SERVICE_LABEL\}"/);
  assert.match(hostRestartScript, /bootstrap_service_with_retry/);
  assert.match(hostRestartScript, /launchctl bootstrap system "\$PLIST_PATH"/);
  assert.match(hostRestartScript, /curl -fsS "\$READINESS_URL"/);
  assert.doesNotMatch(hostRestartScript, /cat "\$SUDO_PASSWORD_FILE"/);
});

test("macOS host restart script fails safely around bootstrap and postflight", () => {
  assert.match(hostRestartScript, /json_error\(\) \{/);
  assert.match(hostRestartScript, /stage:\s*process\.argv\[1\]/);
  assert.match(hostRestartScript, /validate_preflight_selection/);
  assert.match(hostRestartScript, /validate_postflight_selection/);
  assert.match(hostRestartScript, /public_config_active_profile/);
  assert.match(hostRestartScript, /public_config_default_shell_mode/);
  assert.match(hostRestartScript, /launchd_env_value CODEX_HOME/);
  assert.match(hostRestartScript, /launchd_env_value CODEX_MOBILE_MUX_ENDPOINT_FILE/);
  assert.match(hostRestartScript, /launchd_env_value CODEX_MOBILE_DEFAULT_SHELL/);
  assert.match(hostRestartScript, /launchd_env_value CODEX_MOBILE_TASK_CARD_EXECUTION_WATCHDOG_INTERVAL_MS/);
  assert.match(hostRestartScript, /launchd_env_value CODEX_MOBILE_TASK_CARD_EXECUTION_WATCHDOG_STALE_MS/);
  assert.match(hostRestartScript, /launchd_env_value CODEX_MOBILE_TASK_CARD_EXECUTION_WATCHDOG_LIMIT/);
  assert.match(hostRestartScript, /task-card watchdog interval does not match platform default/);
  assert.match(hostRestartScript, /task-card watchdog stale window does not match platform default/);
  assert.match(hostRestartScript, /task-card watchdog batch limit does not match platform default/);
  assert.match(hostRestartScript, /taskCardExecutionWatchdog/);
  assert.match(hostRestartScript, /LaunchDaemon plist default shell does not match selected mode/);
  assert.match(hostRestartScript, /Public config default shell does not match selected mode/);
  assert.match(hostRestartScript, /Running LaunchDaemon default shell does not match selected mode/);
  assert.match(hostRestartScript, /bootstrap_service_with_retry\(\) \{/);
  assert.match(hostRestartScript, /ensure_service_loaded_on_exit\(\) \{/);
  assert.match(hostRestartScript, /trap ensure_service_loaded_on_exit EXIT HUP INT TERM/);
  assert.match(hostRestartScript, /BOOTOUT_PERFORMED=1\s*\nrun_sudo \/bin\/launchctl bootout "system\/\$\{SERVICE_LABEL\}"/);
  assert.match(hostRestartScript, /BOOTSTRAP_COMPLETED=1/);
  assert.match(hostRestartScript, /"\$status" -eq 5/);
  assert.match(hostRestartScript, /if service_loaded; then/);
  assert.match(hostRestartScript, /LaunchDaemon bootstrap failed/);
  assert.match(hostRestartScript, /"bootstrap"/);
  assert.match(hostRestartScript, /POSTFLIGHT_JSON/);
  assert.match(hostRestartScript, /SELECTED_MUX_STOP_JSON="\$SELECTED_MUX_STOP_JSON"/);
  assert.match(hostRestartScript, /selectedMuxStop/);
});

test("macOS host restart script reports stale non-selected mux endpoints without killing them", () => {
  assert.match(hostRestartScript, /detect_stale_muxes\(\) \{/);
  assert.match(hostRestartScript, /selectedCodexHome/);
  assert.match(hostRestartScript, /endpoint\.json/);
  assert.match(hostRestartScript, /pidAlive/);
  assert.match(hostRestartScript, /childPidAlive/);
  assert.match(hostRestartScript, /action:\s*"reported_only"/);
  assert.match(hostRestartScript, /STALE_MUX_JSON="\$\(detect_stale_muxes/);
  assert.doesNotMatch(hostRestartScript, /kill -9/);
});

test("macOS profile helper lists configured homes without raw auth tokens", () => {
  const userHome = tempRoot();
  const runtimeDir = path.join(userHome, ".codex-mobile-web");
  const profileFile = path.join(runtimeDir, "codex-profiles.json");
  const defaultHome = path.join(userHome, ".codex");
  const currentHome = path.join(userHome, ".codex-homes", "current");
  const previousHome = path.join(userHome, ".codex-homes", "previous");
  fs.mkdirSync(defaultHome, { recursive: true });
  fs.mkdirSync(currentHome, { recursive: true });
  fs.mkdirSync(previousHome, { recursive: true });
  writeJson(profileFile, {
    activeProfileId: "previous",
    profiles: [
      { id: "current", label: "Current", codexHome: currentHome },
      { id: "previous", label: "Previous", codexHome: previousHome },
    ],
  });

  const result = listProfiles({
    userHome,
    runtimeDir,
    profileFile,
    activeCodexHome: previousHome,
    env: {},
  });

  assert.equal(result.ok, true);
  assert.equal(result.activeProfileId, "previous");
  assert.deepEqual(result.profiles.map((profile) => profile.id), ["default", "current", "previous"]);
  assert.equal(result.profiles.find((profile) => profile.id === "previous").active, true);
  assert.equal(result.profiles.find((profile) => profile.id === "previous").exists, true);
  assert.doesNotMatch(JSON.stringify(result), /id_token|access_token|refresh_token|account_id/);
  assert.match(helperScript, /function shellQuote/);
});

test("macOS profile helper selects existing and explicit Codex Homes offline", () => {
  const userHome = tempRoot();
  const runtimeDir = path.join(userHome, ".codex-mobile-web");
  const profileFile = path.join(runtimeDir, "codex-profiles.json");
  const currentHome = path.join(userHome, ".codex-homes", "current");
  const previousHome = path.join(userHome, ".codex-homes", "previous");
  const customHome = path.join(userHome, ".codex-homes", "review");
  fs.mkdirSync(currentHome, { recursive: true });
  fs.mkdirSync(previousHome, { recursive: true });
  fs.mkdirSync(customHome, { recursive: true });
  writeJson(profileFile, {
    activeProfileId: "previous",
    profiles: [
      { id: "current", label: "Current", codexHome: currentHome },
      { id: "previous", label: "Previous", codexHome: previousHome },
    ],
  });

  const selected = selectProfile({
    userHome,
    runtimeDir,
    profileFile,
    activeCodexHome: previousHome,
    profileId: "current",
    env: {},
  });
  assert.equal(selected.id, "current");
  assert.equal(JSON.parse(fs.readFileSync(profileFile, "utf8")).activeProfileId, "current");

  const custom = selectProfile({
    userHome,
    runtimeDir,
    profileFile,
    activeCodexHome: currentHome,
    codexHome: customHome,
    env: {},
  });
  const store = JSON.parse(fs.readFileSync(profileFile, "utf8"));
  assert.equal(custom.codexHome, customHome);
  assert.equal(store.activeProfileId, "custom-review");
  assert.equal(store.profiles.find((profile) => profile.id === "custom-review").codexHome, customHome);
});

test("macOS profile helper can resolve a selection without writing state", () => {
  const userHome = tempRoot();
  const runtimeDir = path.join(userHome, ".codex-mobile-web");
  const profileFile = path.join(runtimeDir, "codex-profiles.json");
  const currentHome = path.join(userHome, ".codex-homes", "current");
  const previousHome = path.join(userHome, ".codex-homes", "previous");
  fs.mkdirSync(currentHome, { recursive: true });
  fs.mkdirSync(previousHome, { recursive: true });
  writeJson(profileFile, {
    activeProfileId: "previous",
    profiles: [
      { id: "current", label: "Current", codexHome: currentHome },
      { id: "previous", label: "Previous", codexHome: previousHome },
    ],
  });

  const selected = selectProfile({
    userHome,
    runtimeDir,
    profileFile,
    activeCodexHome: previousHome,
    profileId: "current",
    noWrite: true,
    env: {},
  });

  assert.equal(selected.id, "current");
  assert.equal(JSON.parse(fs.readFileSync(profileFile, "utf8")).activeProfileId, "previous");
});
