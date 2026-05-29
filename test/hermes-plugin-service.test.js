"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  createHermesPluginService,
  normalizeHttpOrigin,
  normalizeHttpUrl,
} = require("../adapters/hermes-plugin-service");

function tempRegistrationFile(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-mobile-plugin-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return path.join(dir, "registration.json");
}

test("builds a Hermes embedded-app plugin manifest", () => {
  const service = createHermesPluginService({ version: "0.1.11" });
  const manifest = service.manifest({ baseUrl: "https://codex.example.test:8443" });

  assert.equal(manifest.id, "codex-mobile");
  assert.equal(manifest.kind, "embedded_app");
  assert.equal(manifest.entry.url, "https://codex.example.test:8443/?embed=hermes");
  assert.equal(manifest.program_api.plugin_manifest, "/api/v1/hermes/plugin/manifest");
  assert.equal(manifest.program_api.workspace_registration, "/api/v1/hermes/plugin/workspaces");
  assert.equal(manifest.program_api.callback_registration, "/api/v1/hermes/plugin/callbacks");
  assert.equal(manifest.program_api.origin_registration, "/api/v1/hermes/plugin/origins");
  assert.equal(manifest.program_api.plugin_launch, "/api/v1/hermes/plugin/launch");
  assert.equal(manifest.program_api.plugin_session, "/api/v1/hermes/plugin/session");
  assert.equal(manifest.owner_binding.strategy, "workspace_bound_codex_mobile_key");
  assert.equal(manifest.owner_binding.raw_key_returned_by_codex_mobile, false);
  assert.equal(manifest.owner_binding.local_paths_returned_by_manifest, false);
  assert.deepEqual(manifest.frame_embedding.frame_ancestors, ["'self'"]);
  assert.doesNotMatch(JSON.stringify(manifest), /access_key_file|config_file|Bearer|secret|C:\\Users|\.codex-mobile-web[\\/]/i);
});

test("registers HTTPS Hermes callback and frame origin without storing access-key material", (t) => {
  const registrationFile = tempRegistrationFile(t);
  const service = createHermesPluginService({
    registrationFile,
    nowMs: () => Date.parse("2026-05-28T00:00:00.000Z"),
  });

  const registration = service.registerWorkspace({
    workspace_id: "owner",
    hermes_callback_url: "https://hermes.example.test/api/plugins/codex-mobile/callback",
    hermes_app_origin: "https://hermes.example.test",
    accessKey: "must-not-be-stored",
  });

  assert.equal(registration.workspaceId, "owner");
  assert.equal(registration.callbackUrl, "https://hermes.example.test/api/plugins/codex-mobile/callback");
  assert.equal(registration.appOrigin, "https://hermes.example.test");
  const raw = fs.readFileSync(registrationFile, "utf8");
  assert.doesNotMatch(raw, /must-not-be-stored|accessKey|Authorization|Bearer/);
  assert.deepEqual(service.registration({ workspaceId: "owner" }), registration);
  assert.deepEqual(service.frameAncestors(), ["'self'", "https://hermes.example.test"]);
});

test("callback URL validation accepts http/https and rejects unsafe schemes", () => {
  assert.equal(normalizeHttpUrl("https://hermes.example.test/callback", "callback"), "https://hermes.example.test/callback");
  assert.equal(normalizeHttpUrl("http://127.0.0.1:8797/callback", "callback"), "http://127.0.0.1:8797/callback");
  assert.equal(normalizeHttpOrigin("https://hermes.example.test/app/plugin?x=1", "origin"), "https://hermes.example.test");
  assert.throws(() => normalizeHttpUrl("file:///tmp/key", "callback"), /must_use_http_or_https/);
  assert.throws(() => normalizeHttpUrl("https://user:pass@example.test/callback", "callback"), /must_not_include_credentials/);
});

test("origin-only registration updates frame ancestors without requiring a callback URL", (t) => {
  const registrationFile = tempRegistrationFile(t);
  const service = createHermesPluginService({ registrationFile });

  const registration = service.registerOrigin({
    workspace_id: "owner",
    hermes_origin: "https://pwa.hermes.example.test/plugins/codex-mobile",
    accessKey: "must-not-be-stored",
  });

  assert.equal(registration.callbackUrl, "");
  assert.equal(registration.appOrigin, "https://pwa.hermes.example.test");
  assert.deepEqual(service.registeredOrigins(), ["https://pwa.hermes.example.test"]);
  assert.match(service.frameAncestorsHeader(), /'self' https:\/\/pwa\.hermes\.example\.test/);
  assert.doesNotMatch(fs.readFileSync(registrationFile, "utf8"), /must-not-be-stored|accessKey|Bearer/);
});

test("manifest reports HTTPS Hermes mixed-content diagnostics for HTTP Codex entry", () => {
  const service = createHermesPluginService({ version: "0.1.11", hermesOrigins: "https://hermes.example.test" });
  const manifest = service.manifest({
    baseUrl: "http://127.0.0.1:8787",
    hermesOrigin: "https://hermes.example.test",
  });
  assert.equal(manifest.entry.url, "http://127.0.0.1:8787/?embed=hermes");
  assert.deepEqual(manifest.frame_embedding.registered_origins, ["https://hermes.example.test"]);
  assert.equal(manifest.frame_embedding.diagnostics[0].code, "https_hermes_cannot_embed_http_codex_entry");
});

test("manifest advertises configured HTTPS Codex entry for HTTPS Hermes origins", () => {
  const service = createHermesPluginService({ version: "0.1.11", hermesOrigins: "https://hermes.example.test" });
  const manifest = service.manifest({
    baseUrl: "https://codex.example.test:8443",
    hermesOrigin: "https://hermes.example.test",
  });
  assert.equal(manifest.entry.url, "https://codex.example.test:8443/?embed=hermes");
  assert.equal(manifest.program_api.base_url, "https://codex.example.test:8443");
  assert.deepEqual(manifest.frame_embedding.frame_ancestors, ["'self'", "https://hermes.example.test"]);
  assert.deepEqual(manifest.frame_embedding.diagnostics, []);
});

test("launch returns only a short entry path and browser exchanges it for a plugin session", () => {
  let now = 1000;
  const service = createHermesPluginService({
    launchTokenTtlMs: 60_000,
    pluginSessionTtlMs: 120_000,
    nowMs: () => now,
    randomToken: () => "cpl_testLaunchToken_1234567890",
    randomSessionToken: () => "cps_testSessionToken_1234567890",
  });

  const launch = service.createLaunch({ workspace_id: "owner" });
  assert.equal(launch.ok, true);
  assert.equal(launch.expires_in, 60);
  assert.match(launch.entry_path, /^\/\?embed=hermes&codexPluginLaunch=cpl_testLaunchToken_1234567890&workspaceId=owner$/);
  assert.doesNotMatch(JSON.stringify(launch), /access|Authorization|Bearer/i);
  assert.equal(service.isLaunchTokenAuthorized("cpl_testLaunchToken_1234567890"), true);
  const session = service.createSession({ codexPluginLaunch: "cpl_testLaunchToken_1234567890" });
  assert.equal(session.session_key, "cps_testSessionToken_1234567890");
  assert.equal(session.expires_in, 120);
  assert.equal(service.isLaunchTokenAuthorized("cpl_testLaunchToken_1234567890"), false);
  assert.equal(service.isSessionAuthorized("cps_testSessionToken_1234567890"), true);
  assert.doesNotMatch(JSON.stringify(session), /codex_mobile_access_key|Authorization|Bearer/i);
  now += 60_001;
  assert.equal(service.isLaunchTokenAuthorized("cpl_testLaunchToken_1234567890"), false);
  assert.equal(service.isSessionAuthorized("cps_testSessionToken_1234567890"), true);
  now += 60_000;
  assert.equal(service.isSessionAuthorized("cps_testSessionToken_1234567890"), false);
});
