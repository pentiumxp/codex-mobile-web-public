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

test("decorating thread list reuses token query cache and record writes invalidate it", () => {
  const calls = [];
  let totalTokens = 8000;
  const service = createTokenUsageStatsService({
    dbPath: tempDbPath("decorate-cache"),
    queryCacheTtlMs: 60_000,
    now: () => Date.parse("2026-06-01T12:00:00.000Z"),
    sqlite: {
      exec: () => ({ ok: true }),
      json: (_dbPath, sql) => {
        calls.push(sql);
        if (/GROUP BY thread_id/i.test(sql)) {
          return { ok: true, rows: [{ thread_id: "thread-a", total_tokens: totalTokens, today_tokens: totalTokens, week_tokens: totalTokens, input_tokens: totalTokens, cached_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0 }] };
        }
        if (/GROUP BY day/i.test(sql)) return { ok: true, rows: [] };
        if (/GROUP BY cwd/i.test(sql)) return { ok: true, rows: [] };
        return { ok: true, rows: [{ total_tokens: totalTokens, today_tokens: totalTokens, week_tokens: totalTokens, input_tokens: totalTokens, cached_input_tokens: 0, output_tokens: 0, reasoning_output_tokens: 0 }] };
      },
    },
  });

  const options = {
    cwd: "C:\\repo\\alpha",
    nowMs: Date.parse("2026-06-01T12:00:00.000Z"),
  };
  service.decorateThreadListResult({ data: [{ id: "thread-a" }] }, options);
  const firstCallCount = calls.length;
  service.decorateThreadListResult({ data: [{ id: "thread-a" }] }, options);
  assert.equal(calls.length, firstCallCount);

  totalTokens = 9000;
  service.recordTurnUsage({
    threadId: "thread-a",
    turnId: "turn-2",
    cwd: "C:\\repo\\alpha",
    completedAtMs: Date.parse("2026-06-01T11:00:00.000Z"),
    usage: { totalTokens: 9000 },
  });
  const result = service.decorateThreadListResult({ data: [{ id: "thread-a" }] }, options);
  assert.ok(calls.length > firstCallCount);
  assert.equal(result.mobileTokenUsage.totalTokens, 9000);
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

test("merges historical Windows mojibake workspace rows under visible workspace cwd", () => {
  const financeCwd = "C:\\Users\\xuxin\\Documents\\\u8d22\u52a1";
  const wardrobeCwd = "C:\\Users\\xuxin\\Documents\\\u7537\u88c5\u8863\u6a71";
  const toolsCwd = "C:\\Users\\xuxin\\Documents\\\u7cfb\u7edf\u5de5\u5177";
  const financeBad = "C:\\Users\\xuxin\\Documents\\\u00b2\u00c6\u00ce\u00f1";
  const wardrobeBad = "C:\\Users\\xuxin\\Documents\\\u00c4\u00d0\u05f0\u00d2\u00b3\u00f7";
  const toolsBad = "C:\\Users\\xuxin\\Documents\\\u03f5\u0373\u00b9\u00a4\u00be\u00df";
  const workspaceRows = [
    { cwd: financeBad, total_tokens: 32000000, today_tokens: 32000000, week_tokens: 32000000, input_tokens: 30000000, cached_input_tokens: 1000000, output_tokens: 2000000, reasoning_output_tokens: 0 },
    { cwd: wardrobeBad, total_tokens: 16000000, today_tokens: 16000000, week_tokens: 16000000, input_tokens: 15000000, cached_input_tokens: 500000, output_tokens: 1000000, reasoning_output_tokens: 0 },
    { cwd: toolsBad, total_tokens: 1500000, today_tokens: 1500000, week_tokens: 1500000, input_tokens: 1400000, cached_input_tokens: 100000, output_tokens: 100000, reasoning_output_tokens: 0 },
  ];
  const service = createTokenUsageStatsService({
    dbPath: tempDbPath("historical-mojibake"),
    sqlite: {
      exec: () => ({ ok: true }),
      json: (_dbPath, sql) => {
        if (/GROUP BY cwd/i.test(sql)) return { ok: true, rows: workspaceRows };
        if (/GROUP BY day/i.test(sql)) return { ok: true, rows: [] };
        if (sql.includes("WHERE lower(cwd)") && sql.includes(financeBad)) {
          return { ok: true, rows: [{ total_tokens: 32000000, today_tokens: 32000000, week_tokens: 32000000, input_tokens: 30000000, cached_input_tokens: 1000000, output_tokens: 2000000, reasoning_output_tokens: 0 }] };
        }
        return { ok: true, rows: [{ total_tokens: 49500000, today_tokens: 49500000, week_tokens: 49500000, input_tokens: 46400000, cached_input_tokens: 1600000, output_tokens: 3100000, reasoning_output_tokens: 0 }] };
      },
    },
  });

  const summary = service.workspaceSummary({
    workspaceCwds: [financeCwd, wardrobeCwd, toolsCwd],
    nowMs: Date.parse("2026-06-01T12:00:00.000Z"),
  });
  const byCwd = new Map(summary.workspaces.map((workspace) => [workspace.cwd, workspace]));

  assert.equal(byCwd.get(financeCwd).totalTokens, 32000000);
  assert.equal(byCwd.get(wardrobeCwd).totalTokens, 16000000);
  assert.equal(byCwd.get(toolsCwd).totalTokens, 1500000);
  assert.equal(byCwd.has(financeBad), false);
  assert.equal(byCwd.has(wardrobeBad), false);
  assert.equal(byCwd.has(toolsBad), false);

  const selectedFinance = service.workspaceSummary({
    cwd: financeCwd,
    workspaceCwds: [financeCwd, wardrobeCwd, toolsCwd],
    nowMs: Date.parse("2026-06-01T12:00:00.000Z"),
  });
  assert.equal(selectedFinance.totalTokens, 32000000);
});
