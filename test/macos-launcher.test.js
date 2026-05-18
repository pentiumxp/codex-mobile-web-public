"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const sharedLauncher = fs.readFileSync(path.join(root, "start-codex-shared-mobile-macos.sh"), "utf8");

test("macOS shared launcher defaults to restarting Mobile Web only", () => {
  assert.match(sharedLauncher, /RESTART_DESKTOP=0/);
  assert.match(sharedLauncher, /--restart-desktop\s+Restart Codex Desktop through the shared mux launcher/);
  assert.match(sharedLauncher, /Leaving Codex Desktop running; Mobile Web will reconnect/);
  assert.match(sharedLauncher, /if \[\[ "\$RESTART_DESKTOP" -eq 1 \]\]; then\n\s+desktop_args=/);
});

test("macOS shared launcher keeps desktop restart as an explicit opt-in", () => {
  assert.match(sharedLauncher, /--restart-desktop\)\n\s+RESTART_DESKTOP=1/);
  assert.match(sharedLauncher, /--force-quit\)\n\s+RESTART_DESKTOP=1/);
  assert.match(sharedLauncher, /Note: Codex Desktop may ask for quit confirmation on the Mac/);
});
