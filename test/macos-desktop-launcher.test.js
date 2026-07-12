"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const launcherPath = path.join(root, "start-codex-desktop-shared-macos.sh");
const launcher = fs.readFileSync(launcherPath, "utf8");
const mobileWebLauncher = fs.readFileSync(path.join(root, "start-codex-mobile-web-macos.sh"), "utf8");

function makeFakeApp(tmp, appName) {
  const appPath = path.join(tmp, `${appName}.app`);
  const exePath = path.join(appPath, "Contents", "MacOS", appName);
  fs.mkdirSync(path.dirname(exePath), { recursive: true });
  fs.writeFileSync(exePath, "#!/usr/bin/env sh\nexit 0\n");
  fs.chmodSync(exePath, 0o755);
  return { appPath, exePath };
}

function makeExecutable(filePath, source) {
  fs.writeFileSync(filePath, source);
  fs.chmodSync(filePath, 0o755);
  return filePath;
}

function makeCommandHarness(tmp) {
  const launchctlLog = path.join(tmp, "launchctl.log");
  const openLog = path.join(tmp, "open.log");
  const launchctl = makeExecutable(path.join(tmp, "launchctl"), [
    "#!/usr/bin/env bash",
    "printf '%s\\n' \"$*\" >> \"$FAKE_LAUNCHCTL_LOG\"",
    "",
  ].join("\n"));
  const open = makeExecutable(path.join(tmp, "open"), [
    "#!/usr/bin/env bash",
    "printf '%s\\n' \"$*\" > \"$FAKE_OPEN_LOG\"",
    "",
  ].join("\n"));
  return {
    launchctlLog,
    openLog,
    env: {
      CODEX_DESKTOP_LAUNCHCTL_BIN: launchctl,
      CODEX_DESKTOP_OPEN_BIN: open,
      FAKE_LAUNCHCTL_LOG: launchctlLog,
      FAKE_OPEN_LOG: openLog,
    },
  };
}

function runLauncher(args, env = {}) {
  return execFileSync("bash", [launcherPath, ...args], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      CODEX_HOME: path.join(os.tmpdir(), "codex-mobile-web-test-home"),
      ...env,
    },
  });
}

function printLaunchEnvironment(args) {
  return runLauncher([
    "--print-only",
    "--codex",
    "/bin/echo",
    "--node",
    "/bin/sh",
    "--mux-wrapper",
    "/bin/echo",
    ...args,
  ]);
}

test("macOS desktop launcher defaults to ChatGPT app with Codex fallback", () => {
  assert.match(launcher, /\/Applications\/ChatGPT\.app/);
  assert.match(launcher, /\/Applications\/Codex\.app/);
  assert.match(launcher, /CODEX_APP_PATH="\$\{CODEX_DESKTOP_APP_PATH:-\}"/);
  assert.match(launcher, /CODEX_APP_PATH="\$\(default_app_path\)"/);
});

test("macOS desktop launcher prefers bundled Codex CLI while preserving override", () => {
  assert.match(launcher, /resolve_codex_command\(\) \{/);
  assert.match(launcher, /if \[\[ -n "\$value" \]\]; then[\s\S]*resolve_command "\$value" codex/);
  assert.match(launcher, /\$CODEX_APP_PATH\/Contents\/Resources\/codex/);
  assert.match(launcher, /\/Applications\/ChatGPT\.app\/Contents\/Resources\/codex/);
  assert.match(launcher, /REAL_CODEX_EXE="\$\(resolve_codex_command "\$REAL_CODEX_EXE"\)"/);
});

test("macOS mobile web launcher prefers bundled Codex CLI while preserving override", () => {
  assert.match(mobileWebLauncher, /resolve_codex_command\(\) \{/);
  assert.match(mobileWebLauncher, /if \[\[ -n "\$value" \]\]; then[\s\S]*resolve_command "\$value" codex/);
  assert.match(mobileWebLauncher, /\/Applications\/ChatGPT\.app\/Contents\/Resources\/codex/);
  assert.match(mobileWebLauncher, /\/Applications\/Codex\.app\/Contents\/Resources\/codex/);
  assert.match(mobileWebLauncher, /CODEX_EXE_VALUE="\$\(resolve_codex_command "\$CODEX_EXE_VALUE"\)"/);
});

test("macOS desktop launcher resolves app executable and force-quit name from bundle metadata", () => {
  assert.match(launcher, /resolve_desktop_executable\(\) \{/);
  assert.match(launcher, /read_info_plist_value "\$app_path" "CFBundleExecutable"/);
  assert.match(launcher, /resolve_app_name\(\) \{/);
  assert.match(launcher, /read_info_plist_value "\$app_path" "CFBundleName"/);
  assert.match(launcher, /tell application \(item 1 of argv\) to quit/);
  assert.doesNotMatch(launcher, /tell application "Codex" to quit/);
});

test("macOS desktop launcher running detection uses the resolved executable path", () => {
  assert.match(launcher, /pattern="\$\(escape_pgrep_pattern "\$CODEX_DESKTOP_EXE"\)"/);
  assert.match(launcher, /pgrep -f "\$pattern"/);
  assert.doesNotMatch(launcher, /pgrep -f "\/Contents\/MacOS\/Codex"/);
});

test("macOS desktop launcher print-only resolves ChatGPT app executable", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "codex-chatgpt-app-"));
  try {
    const { appPath, exePath } = makeFakeApp(tmp, "ChatGPT");
    const output = printLaunchEnvironment(["--app", appPath]);
    assert.match(output, new RegExp(`Desktop app: ${appPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    assert.match(output, new RegExp(`Desktop app name: ChatGPT`));
    assert.match(output, new RegExp(`Desktop executable: ${exePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("macOS desktop launcher print-only preserves Codex app compatibility", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "codex-legacy-app-"));
  try {
    const { appPath, exePath } = makeFakeApp(tmp, "Codex");
    const output = printLaunchEnvironment(["--app", appPath]);
    assert.match(output, new RegExp(`Desktop app: ${appPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    assert.match(output, new RegExp(`Desktop app name: Codex`));
    assert.match(output, new RegExp(`Desktop executable: ${exePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("macOS desktop launcher persists the shared environment before opening ChatGPT", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "codex-launch-env-"));
  try {
    const { appPath } = makeFakeApp(tmp, "ChatGPT");
    const harness = makeCommandHarness(tmp);

    runLauncher([
      "--app", appPath,
      "--codex", "/bin/echo",
      "--node", "/bin/sh",
      "--mux-wrapper", "/bin/echo",
    ], harness.env);

    const persisted = fs.readFileSync(harness.launchctlLog, "utf8").trim().split("\n");
    assert.equal(persisted.length, 6);
    assert.ok(persisted.some((line) => (
      line === `setenv CODEX_HOME ${path.join(os.tmpdir(), "codex-mobile-web-test-home")}`
    )));
    assert.ok(persisted.some((line) => line.includes("setenv CODEX_CLI_PATH /bin/echo")));
    assert.ok(persisted.some((line) => line === "setenv CODEX_MUX_KEEP_ALIVE 1"));
    assert.match(fs.readFileSync(harness.openLog, "utf8"), /--env CODEX_MUX_KEEP_ALIVE=1/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("macOS desktop launcher can limit shared variables to one launch", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "codex-launch-env-once-"));
  try {
    const { appPath } = makeFakeApp(tmp, "ChatGPT");
    const harness = makeCommandHarness(tmp);

    runLauncher([
      "--no-persist-launch-env",
      "--app", appPath,
      "--codex", "/bin/echo",
      "--node", "/bin/sh",
      "--mux-wrapper", "/bin/echo",
    ], harness.env);

    assert.equal(fs.existsSync(harness.launchctlLog), false);
    assert.match(fs.readFileSync(harness.openLog, "utf8"), /--env CODEX_CLI_PATH=\/bin\/echo/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("macOS desktop launcher clear mode removes every persisted shared variable", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "codex-launch-env-clear-"));
  try {
    const harness = makeCommandHarness(tmp);

    const output = runLauncher(["--clear-launch-env"], harness.env);

    const cleared = fs.readFileSync(harness.launchctlLog, "utf8").trim().split("\n");
    assert.equal(cleared.length, 6);
    assert.ok(cleared.every((line) => line.startsWith("unsetenv CODEX_")));
    assert.match(output, /Cleared persisted Codex shared environment/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("macOS desktop launcher print-only never mutates LaunchServices", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "codex-launch-env-print-"));
  try {
    const { appPath } = makeFakeApp(tmp, "ChatGPT");
    const harness = makeCommandHarness(tmp);

    const output = runLauncher([
      "--print-only",
      "--app", appPath,
      "--codex", "/bin/echo",
      "--node", "/bin/sh",
      "--mux-wrapper", "/bin/echo",
    ], harness.env);

    assert.equal(fs.existsSync(harness.launchctlLog), false);
    assert.match(output, /LaunchServices environment: persist for the current login session/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("macOS desktop launcher rejects clear and print-only together without mutation", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "codex-launch-env-conflict-"));
  try {
    const harness = makeCommandHarness(tmp);
    const result = spawnSync("bash", [
      launcherPath,
      "--clear-launch-env",
      "--print-only",
    ], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        ...harness.env,
      },
    });

    assert.equal(result.status, 2);
    assert.match(result.stderr, /mutually exclusive/);
    assert.equal(fs.existsSync(harness.launchctlLog), false);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
