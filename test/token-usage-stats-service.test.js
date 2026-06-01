"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  createTokenUsageStatsService,
} = require("../adapters/token-usage-stats-service");

function tempDbPath(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-token-usage-"));
  return path.join(dir, `${name}.sqlite`);
}

test("records turn usage in sqlite and aggregates by workspace day", () => {
  const dbPath = tempDbPath("usage");
  const service = createTokenUsageStatsService({
    dbPath,
    now: () => Date.parse("2026-06-01T12:00:00.000Z"),
  });

  assert.equal(service.recordTurnUsage({
    threadId: "thread-a",
    turnId: "turn-1",
    cwd: "C:\\repo\\alpha",
    completedAtMs: Date.parse("2026-06-01T09:00:00.000Z"),
    usageSummary: {
      turnTokenUsage: {
        inputTokens: 12000,
        cachedInputTokens: 2000,
        outputTokens: 3000,
        totalTokens: 15000,
      },
    },
  }).ok, true);
  assert.equal(service.recordTurnUsage({
    threadId: "thread-b",
    turnId: "turn-2",
    cwd: "C:\\repo\\alpha",
    completedAtMs: Date.parse("2026-05-31T21:00:00.000+08:00"),
    usage: {
      inputTokens: 4000,
      outputTokens: 1000,
      totalTokens: 5000,
    },
  }).ok, true);
  assert.equal(service.recordTurnUsage({
    threadId: "thread-c",
    turnId: "turn-3",
    cwd: "C:\\repo\\beta",
    completedAtMs: Date.parse("2026-06-01T10:00:00.000Z"),
    usage: { totalTokens: 7000 },
  }).ok, true);

  const summary = service.workspaceSummary({
    cwd: "C:\\repo\\alpha",
    nowMs: Date.parse("2026-06-01T12:00:00.000Z"),
  });
  assert.equal(summary.totalTokens, 20000);
  assert.equal(summary.todayTokens, 15000);
  assert.equal(summary.weekTokens, 15000);
  assert.equal(summary.daily.length, 2);
  assert.equal(summary.daily[0].date, "2026-06-01");
  assert.equal(summary.daily[0].totalTokens, 15000);
  assert.equal(summary.daily[0].inputTokens, 12000);
  assert.equal(summary.daily[0].cachedInputTokens, 2000);
  assert.equal(summary.daily[0].outputTokens, 3000);
  assert.equal(summary.daily[1].date, "2026-05-31");
  assert.equal(summary.daily[1].totalTokens, 5000);
  assert.equal(summary.workspaces.length, 2);
  assert.equal(summary.workspaces[0].cwd, "C:\\repo\\alpha");
  assert.equal(summary.workspaces[0].totalTokens, 20000);
  assert.equal(summary.workspaces[0].todayTokens, 15000);
  assert.equal(summary.workspaces[1].cwd, "C:\\repo\\beta");
  assert.equal(summary.workspaces[1].totalTokens, 7000);
});

test("upserts the same thread turn instead of double-counting", () => {
  const dbPath = tempDbPath("dedupe");
  const service = createTokenUsageStatsService({ dbPath });

  assert.equal(service.recordTurnUsage({
    threadId: "thread-a",
    turnId: "turn-1",
    cwd: "C:\\repo\\alpha",
    completedAtMs: Date.parse("2026-06-01T09:00:00.000Z"),
    usage: { totalTokens: 10000 },
  }).ok, true);
  assert.equal(service.recordTurnUsage({
    threadId: "thread-a",
    turnId: "turn-1",
    cwd: "C:\\repo\\alpha",
    completedAtMs: Date.parse("2026-06-01T09:05:00.000Z"),
    usage: { totalTokens: 12000 },
  }).ok, true);

  const summary = service.workspaceSummary({
    cwd: "C:\\repo\\alpha",
    nowMs: Date.parse("2026-06-01T12:00:00.000Z"),
  });
  assert.equal(summary.totalTokens, 12000);
  assert.equal(summary.todayTokens, 12000);
});

test("decorates thread list results while keeping workspace totals primary", () => {
  const dbPath = tempDbPath("decorate");
  const service = createTokenUsageStatsService({ dbPath });
  service.recordTurnUsage({
    threadId: "thread-a",
    turnId: "turn-1",
    cwd: "C:\\repo\\alpha",
    completedAtMs: Date.parse("2026-06-01T09:00:00.000Z"),
    usage: { totalTokens: 8000 },
  });

  const result = service.decorateThreadListResult({
    data: [{ id: "thread-a", cwd: "C:\\repo\\alpha" }, { id: "thread-b", cwd: "C:\\repo\\alpha" }],
  }, {
    cwd: "C:\\repo\\alpha",
    nowMs: Date.parse("2026-06-01T12:00:00.000Z"),
  });

  assert.equal(result.mobileTokenUsage.totalTokens, 8000);
  assert.equal(result.mobileTokenUsage.threadCount, 1);
  assert.equal(result.data[0].mobileTokenUsage.totalTokens, 8000);
  assert.equal(result.data[1].mobileTokenUsage, undefined);
});

test("normalizes known mojibake workspace paths for project stats", () => {
  const dbPath = tempDbPath("mojibake");
  const service = createTokenUsageStatsService({ dbPath });
  const canonicalCwd = "C:\\Users\\xuxin\\Documents\\系统工具";
  const mojibakeCwd = "C:\\Users\\xuxin\\Documents\\ϵͳ¹¤¾ß";

  assert.equal(service.recordTurnUsage({
    threadId: "thread-a",
    turnId: "turn-1",
    cwd: mojibakeCwd,
    completedAtMs: Date.parse("2026-06-01T09:00:00.000Z"),
    usage: { totalTokens: 490000, inputTokens: 480000, outputTokens: 10000 },
  }).ok, true);

  const selected = service.workspaceSummary({
    cwd: canonicalCwd,
    workspaceCwds: [canonicalCwd],
    nowMs: Date.parse("2026-06-01T12:00:00.000Z"),
  });
  assert.equal(selected.totalTokens, 490000);
  assert.equal(selected.workspaces.length, 1);
  assert.equal(selected.workspaces[0].cwd, canonicalCwd);
  assert.equal(selected.workspaces[0].totalTokens, 490000);
});
