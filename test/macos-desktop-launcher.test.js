"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
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

function printLaunchEnvironment(args) {
  return execFileSync("bash", [
    launcherPath,
    "--print-only",
    "--codex",
    "/bin/echo",
    "--node",
    "/bin/sh",
    "--mux-wrapper",
    "/bin/echo",
    ...args,
  ], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      CODEX_HOME: path.join(os.tmpdir(), "codex-mobile-web-test-home"),
    },
  });
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
