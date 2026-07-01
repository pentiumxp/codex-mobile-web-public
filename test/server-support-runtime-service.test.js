"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const adapter = require("../adapters/server-support-runtime-service");
const service = require("../services/runtime/server-support-runtime-service");

test("server support runtime adapter re-exports canonical runtime service", () => {
  assert.equal(adapter.createServerSupportRuntimeService, service.createServerSupportRuntimeService);
  assert.equal(adapter.timestampToMs, service.timestampToMs);
});

test("server support runtime owns bounded helpers and app maintenance wiring", async () => {
  const counters = {};
  service.incrementBoundedDiagnosticCounter(counters, "validCounter", 2);
  service.incrementBoundedDiagnosticCounter(counters, "invalid-key", 100);
  assert.deepEqual(counters, { validCounter: 2 });
  assert.equal(service.timestampToMs(10), 10000);
  assert.equal(service.timestampToMs(1_700_000_000_000), 1_700_000_000_000);
  assert.equal(service.shortIdentifier("1234567890abcdefghi"), "12345678...fghi");
  assert.equal(service.compactOneLine(" a   b   c ", 80), "a b c");
  assert.deepEqual(service.parseJsonLine("{\"ok\":true}"), { ok: true });
  assert.equal(service.parseJsonLine("{"), null);
  assert.deepEqual(service.clonePlainJson({ a: 1 }), { a: 1 });
  assert.equal(service.clonePlainJson(undefined), undefined);
  assert.deepEqual(service.turnListFromResult({ turns: [{ id: "t1" }] }), [{ id: "t1" }]);
  assert.deepEqual(service.turnListFromResult({ data: [{ id: "t2" }] }), [{ id: "t2" }]);
  assert.equal(service.lastString("", "  value  "), "value");
  assert.equal(service.isUnmaterializedThreadError(new Error("includeTurns is unavailable before first user message")), true);

  const runtime = service.createServerSupportRuntimeService({
    appRoot: "/app",
    appVersion: "0.1.test",
    appUpdateRemote: "origin",
    appUpdateBranch: "main",
    appMaintenanceServiceFactory: (options) => ({
      options,
      applyAppUpdate: async () => ({ updated: false }),
      refreshAppUpdateStatus: async () => ({ ok: true }),
      refreshGitHubLinkPreview: async () => ({ ok: true }),
      refreshPublicPullRequestStatus: async () => ({ ok: true }),
      refreshPublicReleaseStatus: async () => ({ ok: true }),
      safeAppUpdateError: (err) => err.message,
      scheduleAppRestart: () => {},
      scheduleStartupAppUpdateCheck: () => {},
    }),
  });

  assert.equal(runtime.appMaintenanceService.options.appRoot, "/app");
  assert.equal(typeof runtime.refreshAppUpdateStatus, "function");
  assert.equal((await runtime.refreshAppUpdateStatus()).ok, true);
  const statusErr = runtime.httpStatusErrorWithDetails(409, "conflict", "Conflict", { id: "x" });
  assert.equal(statusErr.statusCode, 409);
  assert.equal(statusErr.code, "conflict");
  assert.deepEqual(statusErr.details, { id: "x" });
});
