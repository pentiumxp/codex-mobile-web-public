"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  createRuntimeSettingsService,
  normalizeFrontendDiagnosticLogSettings,
} = require("../services/runtime/runtime-settings-service");

test("frontend diagnostic log runtime settings are disabled by default and bounded", () => {
  assert.deepEqual(normalizeFrontendDiagnosticLogSettings({}, { source: "default" }), {
    enabled: false,
    upload: true,
    scopes: ["submitted_echo"],
    maxEntries: 400,
    updatedAt: "",
    source: "default",
  });
  assert.deepEqual(normalizeFrontendDiagnosticLogSettings({
    enabled: true,
    upload: false,
    scopes: ["submitted_echo", "all", "submitted_echo", "Unsafe Scope!"],
    maxEntries: 99999,
    updatedAt: "2026-07-06T00:00:00.000Z",
  }).scopes, ["submitted_echo", "all", "unsafe", "scope_"]);
  assert.equal(normalizeFrontendDiagnosticLogSettings({ maxEntries: 99999 }).maxEntries, 2000);
});

test("frontend diagnostic log runtime settings persist through runtime settings service", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-runtime-settings-"));
  const runtimeSettingsFile = path.join(dir, "runtime-settings.json");
  const service = createRuntimeSettingsService({ runtimeSettingsFile });

  assert.equal(service.frontendDiagnosticLogPublicSettings().enabled, false);
  const settings = service.setFrontendDiagnosticLogSettings({
    enabled: true,
    upload: true,
    scopes: ["submitted_echo"],
    maxEntries: 80,
  });

  assert.equal(settings.enabled, true);
  assert.equal(settings.source, "runtime");
  assert.equal(settings.maxEntries, 80);
  assert.deepEqual(settings.scopes, ["submitted_echo"]);
  assert.equal(service.frontendDiagnosticLogPublicSettings().enabled, true);
  assert.equal(JSON.parse(fs.readFileSync(runtimeSettingsFile, "utf8")).frontendDiagnosticLog.enabled, true);

  fs.rmSync(dir, { recursive: true, force: true });
});
